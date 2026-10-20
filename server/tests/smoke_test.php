<?php
// API smoke test: exercises accounts, cloud saves, friends, visits, the daily
// help limit, gifts and account deletion against a running server.
//
//   php server/tests/smoke_test.php http://localhost:8080/api/
//   php server/tests/smoke_test.php https://your-domain.com/api/
//
// It creates two throwaway accounts and deletes them at the end.
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    exit(1);
}
if (!function_exists('curl_init')) {
    fwrite(STDERR, "The PHP curl extension is required.\n");
    exit(2);
}

$base = rtrim($argv[1] ?? 'http://localhost:8080/api/', '/') . '/';
$failures = 0;
$passes = 0;

final class Client
{
    public string $csrf = '';
    private string $jar;

    public function __construct(private string $base)
    {
        $this->jar = tempnam(sys_get_temp_dir(), 'hhjar') ?: '';
    }

    /** @return array{0:int,1:array<string,mixed>} */
    public function call(string $action, ?array $body = null, array $query = [], bool $csrf = true): array
    {
        $url = $this->base . 'index.php?' . http_build_query(['a' => $action] + $query);
        $ch = curl_init($url);
        $headers = ['Accept: application/json'];
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_COOKIEJAR => $this->jar,
            CURLOPT_COOKIEFILE => $this->jar,
            CURLOPT_TIMEOUT => 20,
        ]);
        if ($body !== null) {
            $headers[] = 'Content-Type: application/json';
            if ($csrf) {
                $headers[] = 'X-CSRF-Token: ' . $this->csrf;
            }
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
        }
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        $raw = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);
        $data = is_string($raw) ? json_decode($raw, true) : null;
        if (!is_array($data)) {
            $data = ['ok' => false, 'error' => 'non-json', 'raw' => is_string($raw) ? substr($raw, 0, 200) : ''];
        }
        if (isset($data['csrf']) && is_string($data['csrf'])) {
            $this->csrf = $data['csrf'];
        }
        return [$status, $data];
    }

    public function __destruct()
    {
        if ($this->jar !== '' && is_file($this->jar)) {
            @unlink($this->jar);
        }
    }
}

function check(bool $cond, string $label, mixed $detail = null): void
{
    global $failures, $passes;
    if ($cond) {
        $passes++;
        echo "PASS  {$label}\n";
    } else {
        $failures++;
        echo "FAIL  {$label}" . ($detail !== null ? ' -> ' . json_encode($detail) : '') . "\n";
    }
}

function make_save(array $objects, int $coins = 7000, int $xp = 0, int $level = 1): array
{
    $now = (int) floor(microtime(true) * 1000);
    return [
        'format' => 'honeyhollow',
        'version' => 1,
        'savedAt' => $now,
        'state' => [
            'v' => 1, 'createdAt' => $now, 'now' => $now, 'cityName' => 'Smoke Town', 'avatar' => 'baker',
            'coins' => $coins, 'xp' => $xp, 'level' => $level, 'energy' => 20, 'energyAt' => $now, 'goods' => 0,
            'reputation' => 0, 'permits' => 0, 'volunteers' => 3, 'volunteersAt' => $now, 'parts' => (object) [],
            'objects' => (object) $objects, 'nextId' => count($objects) + 1, 'lots' => ['0,0', '1,0', '0,1', '1,1'],
            'expansions' => 0, 'inventory' => (object) [], 'collectibles' => (object) [], 'collectionsDone' => (object) [],
            'mastery' => (object) [], 'goals' => ['active' => [], 'done' => []], 'stats' => (object) [], 'daily' => ['day' => '', 'streak' => 0],
            'boosts' => [], 'pickupBank' => 0, 'settings' => ['relaxed' => false, 'noWither' => false], 'rng' => 1,
            'wishlist' => [], 'gifts' => [], 'helps' => [], 'applied' => [], 'npc' => (object) [], 'train' => null,
            'achievements' => (object) [], 'events' => (object) [], 'flags' => (object) [],
        ],
    ];
}

$suffix = substr(bin2hex(random_bytes(3)), 0, 5);
$pw = 'smoke-pass-' . $suffix;
$a = new Client($base);
$b = new Client($base);

// --- session + CSRF ---------------------------------------------------------
[$st, $r] = $a->call('session');
check($st === 200 && ($r['ok'] ?? false) && is_string($r['csrf'] ?? null), 'session issues a CSRF token', $r);
[$st, $r] = $a->call('register', ['username' => "smokeA_$suffix", 'password' => $pw], [], false);
check($st === 403 && ($r['error'] ?? '') === 'csrf', 'POST without CSRF token is refused', $r);

// --- accounts ---------------------------------------------------------------
[$st, $r] = $a->call('register', ['username' => "smokeA_$suffix", 'password' => $pw, 'avatar' => 'sailor']);
check($st === 200 && ($r['ok'] ?? false) && is_string($r['recoveryCode'] ?? null), 'register A (with one-time recovery code)', $r);
$userA = $r['user'] ?? [];
[$st, $r] = $a->call('register', ['username' => "SMOKEa_$suffix", 'password' => $pw]);
check($st === 409 && ($r['error'] ?? '') === 'taken', 'usernames are unique (case-insensitive)', $r);
[$st, $r] = $b->call('session');
[$st, $r] = $b->call('register', ['username' => "smokeB_$suffix", 'password' => $pw, 'avatar' => 'chef']);
check($st === 200 && ($r['ok'] ?? false), 'register B', $r);
$userB = $r['user'] ?? [];
$recoveryB = (string) ($r['recoveryCode'] ?? '');

// --- cloud saves -------------------------------------------------------------
[$st, $r] = $a->call('save_put', ['save' => make_save([]), 'baseRev' => 0]);
check($st === 200 && ($r['rev'] ?? 0) === 1, 'A uploads a first cloud save', $r);
[$st, $r] = $a->call('save_get');
check($st === 200 && ($r['rev'] ?? 0) === 1 && ($r['save']['state']['cityName'] ?? '') === 'Smoke Town', 'A reads it back', $r);
[$st, $r] = $a->call('save_put', ['save' => make_save([]), 'baseRev' => 0]);
check($st === 409 && ($r['error'] ?? '') === 'conflict', 'a stale revision is a conflict', $r);
[$st, $r] = $a->call('save_put', ['save' => make_save([], 900000000), 'baseRev' => 1]);
check($st === 422 && ($r['error'] ?? '') === 'sanity', 'impossible coin gains are rejected', $r);
[$st, $r] = $a->call('save_put', ['save' => make_save([], 7000, 0, 40), 'baseRev' => 1]);
check($st === 422 && ($r['error'] ?? '') === 'sanity', 'a level not backed by XP is rejected', $r);

// B's city has seven ripe strawberry plots and an open shop to help with
$now = (int) floor(microtime(true) * 1000);
$objs = [];
for ($i = 1; $i <= 7; $i++) {
    $objs[(string) $i] = ['id' => $i, 'item' => 'plot', 'x' => ($i - 1) * 3, 'y' => 0, 'rot' => 0, 'clicks' => 0, 'built' => true, 'placedAt' => $now, 'crop' => ['id' => 'strawberry', 'plantedAt' => $now - 400000]];
}
$objs['8'] = ['id' => 8, 'item' => 'bakery', 'x' => 0, 'y' => 6, 'rot' => 0, 'clicks' => 4, 'built' => true, 'placedAt' => $now, 'shop' => ['state' => 'open', 'served' => 2]];
$objs['9'] = ['id' => 9, 'item' => 'emptylot', 'x' => 12, 'y' => 6, 'rot' => 0, 'clicks' => 0, 'built' => true, 'placedAt' => $now];
[$st, $r] = $b->call('save_put', ['save' => make_save($objs), 'baseRev' => 0]);
check($st === 200 && ($r['rev'] ?? 0) === 1, 'B uploads a city with things to help', $r);

// --- friends -----------------------------------------------------------------
[$st, $r] = $a->call('friend_add', ['code' => 'ZZZZ-ZZZZ']);
check($st === 404, 'unknown friend code is refused', $r);
[$st, $r] = $a->call('friend_add', ['code' => (string) ($userA['friendCode'] ?? '')]);
check($st === 400 && ($r['error'] ?? '') === 'self', "can't add yourself", $r);
[$st, $r] = $a->call('friend_add', ['code' => (string) ($userB['friendCode'] ?? '')]);
check($st === 200 && ($r['friend']['id'] ?? 0) === ($userB['id'] ?? -1), 'A adds B by friend code', $r);
[$st, $r] = $b->call('friends');
check($st === 200 && count($r['friends'] ?? []) === 1, 'the friendship is mutual', $r);

// --- visiting + help limit ---------------------------------------------------
[$st, $r] = $a->call('city', null, ['id' => $userB['id'] ?? 0]);
check($st === 200 && ($r['helpsLeft'] ?? 0) === 5 && is_array($r['save']['state']['objects'] ?? null), "A visits B's city (5 help actions)", $r);
for ($i = 1; $i <= 5; $i++) {
    [$st, $r] = $a->call('help', ['hostId' => $userB['id'], 'objectId' => $i, 'action' => 'harvest']);
    check($st === 200 && ($r['left'] ?? -1) === 5 - $i, "help action $i of 5 accepted", $r);
}
[$st, $r] = $a->call('help', ['hostId' => $userB['id'], 'objectId' => 6, 'action' => 'harvest']);
check($st === 429 && ($r['error'] ?? '') === 'limit', 'a 6th help action the same day is refused by the server', $r);
[$st, $r] = $b->call('help', ['hostId' => $userA['id'], 'objectId' => 1, 'action' => 'harvest']);
check($st === 409, 'help on something that does not exist is refused', $r);

// --- B sees and accepts the help --------------------------------------------
[$st, $r] = $b->call('inbox');
$helps = $r['helps'] ?? [];
check($st === 200 && count($helps) === 5 && ($helps[0]['from'] ?? 0) === ($userA['id'] ?? -1), 'B sees the 5 helps from A', $r);
[$st, $r] = $b->call('help_ack', ['ids' => array_map(static fn ($h) => $h['id'], $helps)]);
check($st === 200, 'B accepts the help', $r);
[$st, $r] = $b->call('inbox');
check($st === 200 && count($r['helps'] ?? [1]) === 0, 'accepted help leaves the inbox', $r);

// --- gifts --------------------------------------------------------------------
[$st, $r] = $a->call('gift_send', ['toId' => $userB['id'], 'giftId' => 'energy']);
check($st === 200, 'A sends B a free gift', $r);
[$st, $r] = $a->call('gift_send', ['toId' => $userB['id'], 'giftId' => 'coins']);
check($st === 429 && ($r['error'] ?? '') === 'limit', 'only one free gift per neighbor per day', $r);
[$st, $r] = $b->call('inbox');
$gifts = $r['gifts'] ?? [];
check(count($gifts) === 1 && ($gifts[0]['reward']['energy'] ?? 0) === 2, 'B receives the gift', $r);
[$st, $r] = $b->call('gift_ack', ['ids' => [$gifts[0]['id'] ?? 0]]);
check($st === 200, 'B takes the gift', $r);

// --- franchises -----------------------------------------------------------------
$aObjs = ['1' => ['id' => 1, 'item' => 'bakery', 'x' => 0, 'y' => 6, 'rot' => 0, 'clicks' => 4, 'built' => true, 'placedAt' => $now, 'shop' => ['state' => 'empty', 'served' => 0]]];
[$st, $r] = $a->call('save_put', ['save' => make_save($aObjs), 'baseRev' => 1]);
check($st === 200, 'A saves a city with a finished bakery', $r);
[$st, $r] = $a->call('franchise_place', ['hostId' => $userB['id'], 'lotId' => 8, 'item' => 'bakery']);
check($st === 409 && ($r['error'] ?? '') === 'notApplicable', 'a franchise needs an Empty Lot', $r);
[$st, $r] = $a->call('franchise_place', ['hostId' => $userB['id'], 'lotId' => 9, 'item' => 'cafe']);
check($st === 409 && ($r['error'] ?? '') === 'notOwned', 'only shops you own can be franchised', $r);
[$st, $r] = $a->call('franchise_place', ['hostId' => $userB['id'], 'lotId' => 9, 'item' => 'bakery']);
check($st === 200 && ($r['cost'] ?? 0) === 160, "A opens a bakery franchise on B's Empty Lot", $r);
$fid = (int) ($r['id'] ?? 0);
[$st, $r] = $a->call('franchise_place', ['hostId' => $userB['id'], 'lotId' => 9, 'item' => 'bakery']);
check($st === 409 && ($r['error'] ?? '') === 'taken', 'the lot is taken while the request waits', $r);
[$st, $r] = $a->call('city', null, ['id' => $userB['id'] ?? 0]);
$lot = $r['franchises'][0] ?? [];
check(($lot['lotId'] ?? 0) === 9 && ($lot['pending'] ?? false) === true && ($lot['mine'] ?? false) === true, "visitors see the franchise on B's lot", $r);
[$st, $r] = $b->call('franchises');
check(($r['hosted'][0]['status'] ?? '') === 'pending' && ($r['hosted'][0]['ownerName'] ?? '') === "smokeA_$suffix", 'B sees the franchise request', $r);
[$st, $r] = $b->call('franchise_accept', ['id' => $fid, 'accept' => true]);
check($st === 200, 'B accepts it', $r);
[$st, $r] = $a->call('franchise_supply', []);
check($st === 200 && ($r['delivered'] ?? 0) === 1 && ($r['goodsCost'] ?? 0) === 5 && ($r['reward']['coins'] ?? 0) === 20, "A's daily supply run (half the goods, coins back)", $r);
[$st, $r] = $a->call('franchise_supply', []);
check($st === 200 && ($r['delivered'] ?? -1) === 0, 'only one supply run per franchise a day', $r);
[$st, $r] = $b->call('franchise_collect', ['ids' => [$fid]]);
check($st === 200 && ($r['goods'] ?? 0) === 10, 'B collects the full stock of delivered goods', $r);
[$st, $r] = $b->call('franchise_accept', ['id' => $fid, 'accept' => false]);
[$st, $r2] = $b->call('franchises');
check($st === 200 && ($r2['hosted'] ?? null) === [], 'B can close a franchise, freeing the lot', $r2);
[$st, $r] = $a->call('franchise_place', ['hostId' => $userB['id'], 'lotId' => 9, 'item' => 'bakery']);
$fid2 = (int) ($r['id'] ?? 0);
[$st, $r] = $b->call('franchise_accept', ['id' => $fid2, 'accept' => false]);
[$st, $r] = $a->call('franchise_place', ['hostId' => $userB['id'], 'lotId' => 9, 'item' => 'bakery']);
check($st === 200, 'a declined request frees the lot for a new one', $r);
[$st, $r] = $a->call('franchise_remove', ['id' => $fid2]);
check($st === 200 && ($r['refund'] ?? 0) === 160, 'the declined franchise is refunded', $r);

// --- leaderboard, logout/login, recovery --------------------------------------
[$st, $r] = $a->call('leaderboard');
check($st === 200 && count($r['rows'] ?? []) === 2, 'weekly leaderboard lists A and B', $r);
[$st, $r] = $a->call('logout', []);
[$st, $r] = $a->call('session');
check($st === 200 && array_key_exists('user', $r) && $r['user'] === null, 'logout ends the session', $r);
[$st, $r] = $a->call('login', ['username' => "smokeA_$suffix", 'password' => 'wrong-password']);
check($st === 401, 'wrong password is refused', $r);
[$st, $r] = $a->call('login', ['username' => "SmokeA_$suffix", 'password' => $pw]);
check($st === 200 && ($r['user']['id'] ?? 0) === ($userA['id'] ?? -1), 'login works (username is case-insensitive)', $r);
$newPw = $pw . '-new';
[$st, $r] = $b->call('recover', ['username' => "smokeB_$suffix", 'recoveryCode' => $recoveryB, 'newPassword' => $newPw]);
check($st === 200 && is_string($r['recoveryCode'] ?? null) && $r['recoveryCode'] !== $recoveryB, 'password reset with the recovery code', $r);

// --- private files ---------------------------------------------------------------
foreach (['_private/config.php', '_private/bootstrap.php', '_private/config.sample.php'] as $f) {
    $ch = curl_init($base . $f);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10]);
    $body = (string) curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    check(in_array($code, [403, 404], true) && !str_contains($body, 'pass'), "$f is not reachable from the web (HTTP $code)");
}

// --- delete both accounts ---------------------------------------------------------
[$st, $r] = $a->call('delete_account', ['password' => $pw]);
check($st === 200, 'A deletes their account', $r);
[$st, $r] = $b->call('delete_account', ['password' => $newPw]);
check($st === 200, 'B deletes their account', $r);
[$st, $r] = $b->call('login', ['username' => "smokeB_$suffix", 'password' => $newPw]);
check($st === 401, 'deleted accounts are gone', $r);

echo "\n{$passes} passed, {$failures} failed\n";
exit($failures === 0 ? 0 : 1);
