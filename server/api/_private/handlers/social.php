<?php
// Friends (by friend code), visiting, help actions (5 per neighbor per day,
// enforced here), gifts (1 per neighbor per day), wishlists, job requests and
// the weekly leaderboard. There is no chat, so nothing needs moderation.
declare(strict_types=1);

if (!defined('HH_API')) {
    http_response_code(403);
    exit;
}

const HH_HELPS_PER_DAY = 5;
const HH_MAX_FRIENDS = 200;
const HH_HELP_ACTIONS = ['tourbus', 'harvest', 'water', 'revive', 'build'];
const HH_GIFTS = ['energy' => ['energy' => 2], 'goods' => ['goods' => 30], 'coins' => ['coins' => 200], 'volunteer' => ['volunteers' => 1], 'wish' => []];

function hh_helps_left(int $helper, int $host): int
{
    $row = hh_one('SELECT COUNT(*) AS n FROM hh_helps WHERE helper_id = ? AND host_id = ? AND day = ?', [$helper, $host, hh_today()]);
    return max(0, HH_HELPS_PER_DAY - (int) ($row['n'] ?? 0));
}

/** @param array<string,mixed> $user */
function hh_h_friends(array $user): array
{
    $me = (int) $user['id'];
    $today = hh_today();
    $rows = hh_all(
        'SELECT u.id, u.username, u.avatar, u.city_name, u.level, u.wishlist,
            (SELECT COUNT(*) FROM hh_helps h WHERE h.helper_id = ? AND h.host_id = u.id AND h.day = ?) AS helps_used,
            (SELECT COUNT(*) FROM hh_gifts g WHERE g.from_id = ? AND g.to_id = u.id AND g.day = ?) AS gifts_sent
         FROM hh_friends f JOIN hh_users u ON u.id = f.friend_id
         WHERE f.user_id = ? ORDER BY u.level DESC, u.username ASC',
        [$me, $today, $me, $today, $me],
    );
    $friends = array_map(static fn (array $r): array => [
        'id' => (int) $r['id'],
        'username' => (string) $r['username'],
        'avatar' => (string) $r['avatar'],
        'cityName' => (string) $r['city_name'],
        'level' => (int) $r['level'],
        'helpsLeft' => max(0, HH_HELPS_PER_DAY - (int) $r['helps_used']),
        'giftSent' => (int) $r['gifts_sent'] > 0,
        'wishlist' => array_values(array_filter(explode(',', (string) $r['wishlist']))),
    ], $rows);
    return ['code' => (string) $user['friend_code'], 'friends' => $friends];
}

/** @param array<string,mixed> $user */
function hh_h_friend_add(array $user): array
{
    $me = (int) $user['id'];
    hh_rate('user:' . $me . ':friend_add', 20, 600);
    $code = strtoupper(trim(hh_str(hh_input(), 'code', 4, 16)));
    if (!preg_match('/^[A-Z0-9]{4}-[A-Z0-9]{4}$/', $code)) {
        hh_fail('notFound', 404);
    }
    $other = hh_one('SELECT * FROM hh_users WHERE friend_code = ?', [$code]);
    if ($other === null) {
        hh_fail('notFound', 404);
    }
    $them = (int) $other['id'];
    if ($them === $me) {
        hh_fail('self', 400);
    }
    if (hh_are_friends($me, $them)) {
        hh_fail('already', 409);
    }
    foreach ([$me, $them] as $uid) {
        $n = hh_one('SELECT COUNT(*) AS n FROM hh_friends WHERE user_id = ?', [$uid]);
        if ((int) ($n['n'] ?? 0) >= HH_MAX_FRIENDS) {
            hh_fail('full', 409);
        }
    }
    hh_tx(static function () use ($me, $them): void {
        hh_q('INSERT IGNORE INTO hh_friends (user_id, friend_id, created_at) VALUES (?, ?, ?), (?, ?, ?)', [$me, $them, hh_datetime(), $them, $me, hh_datetime()]);
    });
    return ['friend' => ['id' => $them, 'username' => (string) $other['username'], 'avatar' => (string) $other['avatar'], 'cityName' => (string) $other['city_name'], 'level' => (int) $other['level']]];
}

/** @param array<string,mixed> $user */
function hh_h_friend_remove(array $user): array
{
    $me = (int) $user['id'];
    $them = hh_int(hh_input(), 'userId', 1, PHP_INT_MAX);
    hh_q('DELETE FROM hh_friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)', [$me, $them, $them, $me]);
    return [];
}

/** A neighbor's city as a read-only snapshot. @param array<string,mixed> $user */
function hh_h_city(array $user): array
{
    $me = (int) $user['id'];
    $them = hh_int($_GET, 'id', 1, PHP_INT_MAX);
    if (!hh_are_friends($me, $them)) {
        hh_fail('forbidden', 403);
    }
    $other = hh_one('SELECT * FROM hh_users WHERE id = ?', [$them]);
    $save = hh_one('SELECT data FROM hh_saves WHERE user_id = ?', [$them]);
    if ($other === null || $save === null) {
        hh_fail('notFound', 404);
    }
    $helped = hh_all('SELECT object_id FROM hh_helps WHERE helper_id = ? AND host_id = ? AND day = ?', [$me, $them, hh_today()]);
    // franchises standing (or waiting) on the host's empty lots
    $franchises = hh_all(
        'SELECT f.lot_id, f.item, f.stars, f.status, f.owner_id, u.username, u.avatar FROM hh_franchises f JOIN hh_users u ON u.id = f.owner_id WHERE f.host_id = ? AND f.status IN (0, 1)',
        [$them],
    );
    return [
        'user' => hh_public_user($other),
        'save' => json_decode((string) $save['data'], true),
        'helpsLeft' => hh_helps_left($me, $them),
        'helped' => array_map(static fn (array $r): int => (int) $r['object_id'], $helped),
        'franchises' => array_map(static fn (array $r): array => [
            'lotId' => (int) $r['lot_id'],
            'item' => (string) $r['item'],
            'stars' => (int) $r['stars'],
            'pending' => (int) $r['status'] === 0,
            'mine' => (int) $r['owner_id'] === $me,
            'ownerName' => (string) $r['username'],
            'ownerAvatar' => (string) $r['avatar'],
        ], $franchises),
        'day' => hh_today(),
    ];
}

/** One help action in a neighbor's city. @param array<string,mixed> $user */
function hh_h_help(array $user): array
{
    $me = (int) $user['id'];
    hh_rate('user:' . $me . ':help', 60, 60);
    $in = hh_input();
    $host = hh_int($in, 'hostId', 1, PHP_INT_MAX);
    $objectId = hh_int($in, 'objectId', 1, 10_000_000);
    $action = hh_str($in, 'action', 2, 12);
    if (!in_array($action, HH_HELP_ACTIONS, true)) {
        hh_fail('invalid', 400, ['field' => 'action']);
    }
    if ($host === $me || !hh_are_friends($me, $host)) {
        hh_fail('forbidden', 403);
    }
    return hh_tx(static function () use ($me, $host, $objectId, $action): array {
        // lock the helper/host pair so two parallel requests can't both pass the limit
        $used = hh_one('SELECT COUNT(*) AS n FROM hh_helps WHERE helper_id = ? AND host_id = ? AND day = ? FOR UPDATE', [$me, $host, hh_today()]);
        if ((int) ($used['n'] ?? 0) >= HH_HELPS_PER_DAY) {
            hh_fail('limit', 429, ['left' => 0]);
        }
        $save = hh_one('SELECT data FROM hh_saves WHERE user_id = ?', [$host]);
        $state = $save ? (json_decode((string) $save['data'], true)['state'] ?? null) : null;
        if (!is_array($state) || !hh_help_applies($state, $objectId, $action, hh_now_ms())) {
            hh_fail('notApplicable', 409);
        }
        try {
            hh_q('INSERT INTO hh_helps (helper_id, host_id, object_id, action, day, status, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)', [$me, $host, $objectId, $action, hh_today(), hh_datetime()]);
        } catch (PDOException $e) {
            if ($e->getCode() === '23000') {
                hh_fail('already', 409);
            }
            throw $e;
        }
        $reward = (array) (hh_balance()['visit']['helpReward'] ?? ['coins' => 25, 'xp' => 1, 'reputation' => 1]);
        hh_allow($me, (int) ($reward['coins'] ?? 0) + 10, (int) ($reward['xp'] ?? 0) + 2);
        return ['left' => HH_HELPS_PER_DAY - (int) ($used['n'] ?? 0) - 1, 'reward' => $reward];
    });
}

/** @param array<string,mixed> $user */
function hh_h_inbox(array $user): array
{
    $me = (int) $user['id'];
    $helps = hh_all('SELECT id, helper_id, object_id, action, created_at FROM hh_helps WHERE host_id = ? AND status = 0 ORDER BY id LIMIT 100', [$me]);
    $gifts = hh_all('SELECT id, from_id, payload, created_at FROM hh_gifts WHERE to_id = ? AND claimed = 0 ORDER BY id LIMIT 100', [$me]);
    $jobs = hh_all(
        'SELECT j.id, j.host_id, j.object_id, j.item FROM hh_jobs j
         JOIN hh_friends f ON f.user_id = ? AND f.friend_id = j.host_id
         WHERE j.closed = 0 AND j.created_at > ?
           AND NOT EXISTS (SELECT 1 FROM hh_job_fills x WHERE x.host_id = j.host_id AND x.object_id = j.object_id AND x.worker_id = ?)
         ORDER BY j.id DESC LIMIT 30',
        [$me, hh_datetime(time() - 7 * 86400), $me],
    );
    $staffed = hh_all('SELECT id, worker_id, object_id FROM hh_job_fills WHERE host_id = ? AND applied = 0 ORDER BY id LIMIT 100', [$me]);
    $ts = static fn (string $dt): int => (int) (strtotime($dt . ' UTC') ?: time()) * 1000;
    return [
        'helps' => array_map(static fn (array $r): array => ['id' => (int) $r['id'], 'from' => (int) $r['helper_id'], 'objectId' => (int) $r['object_id'], 'action' => (string) $r['action'], 'at' => $ts((string) $r['created_at'])], $helps),
        'gifts' => array_map(static fn (array $r): array => ['id' => (int) $r['id'], 'from' => (int) $r['from_id'], 'reward' => json_decode((string) $r['payload'], true) ?: [], 'at' => $ts((string) $r['created_at'])], $gifts),
        'jobs' => array_map(static fn (array $r): array => ['id' => (int) $r['id'], 'from' => (int) $r['host_id'], 'objectId' => (int) $r['object_id'], 'item' => (string) $r['item']], $jobs),
        'staffed' => array_map(static fn (array $r): array => ['id' => (int) $r['id'], 'from' => (int) $r['worker_id'], 'objectId' => (int) $r['object_id']], $staffed),
    ];
}

/** Host accepted (or declined) help shown on their map. @param array<string,mixed> $user */
function hh_h_help_ack(array $user): array
{
    $in = hh_input();
    $ids = hh_int_list($in, 'ids', 100);
    $status = ($in['decline'] ?? false) === true ? 2 : 1;
    if ($ids) {
        hh_q('UPDATE hh_helps SET status = ? WHERE host_id = ? AND status = 0 AND id IN (' . hh_in(count($ids)) . ')', [$status, $user['id'], ...$ids]);
        if ($status === 1) {
            hh_allow((int) $user['id'], 20 * count($ids), 2 * count($ids));
        }
    }
    return [];
}

/** @param array<string,mixed> $user */
function hh_h_gift_send(array $user): array
{
    $me = (int) $user['id'];
    hh_rate('user:' . $me . ':gift', 60, 600);
    $in = hh_input();
    $to = hh_int($in, 'toId', 1, PHP_INT_MAX);
    $gift = hh_str($in, 'giftId', 2, 16);
    if (!array_key_exists($gift, HH_GIFTS)) {
        hh_fail('invalid', 400, ['field' => 'giftId']);
    }
    if ($to === $me || !hh_are_friends($me, $to)) {
        hh_fail('forbidden', 403);
    }
    $payload = HH_GIFTS[$gift];
    if ($gift === 'wish') {
        $other = hh_one('SELECT wishlist FROM hh_users WHERE id = ?', [$to]);
        $wish = array_values(array_filter(explode(',', (string) ($other['wishlist'] ?? ''))));
        if (!$wish) {
            hh_fail('noWishlist', 409);
        }
        $payload = ['collectibles' => [$wish[random_int(0, count($wish) - 1)] => 1]];
    }
    try {
        hh_q('INSERT INTO hh_gifts (from_id, to_id, gift, payload, day, claimed, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)', [$me, $to, $gift, json_encode($payload), hh_today(), hh_datetime()]);
    } catch (PDOException $e) {
        if ($e->getCode() === '23000') {
            hh_fail('limit', 429);
        }
        throw $e;
    }
    return [];
}

/** Recipient's client took the gifts into its inbox. @param array<string,mixed> $user */
function hh_h_gift_ack(array $user): array
{
    $ids = hh_int_list(hh_input(), 'ids', 100);
    if (!$ids) {
        return [];
    }
    $me = (int) $user['id'];
    $rows = hh_all('SELECT payload FROM hh_gifts WHERE to_id = ? AND claimed = 0 AND id IN (' . hh_in(count($ids)) . ')', [$me, ...$ids]);
    $coins = 0;
    $goods = 0;
    foreach ($rows as $r) {
        $p = json_decode((string) $r['payload'], true) ?: [];
        $coins += (int) ($p['coins'] ?? 0);
        $goods += (int) ($p['goods'] ?? 0);
    }
    hh_q('UPDATE hh_gifts SET claimed = 1 WHERE to_id = ? AND id IN (' . hh_in(count($ids)) . ')', [$me, ...$ids]);
    hh_allow($me, $coins, 0, $goods);
    return [];
}

/** @param array<string,mixed> $user */
function hh_h_wishlist(array $user): array
{
    $in = hh_input();
    $items = $in['items'] ?? [];
    if (!is_array($items) || count($items) > 5) {
        hh_fail('invalid', 400, ['field' => 'items']);
    }
    $valid = hh_collectibles();
    $clean = array_values(array_unique(array_filter($items, static fn ($i): bool => is_string($i) && in_array($i, $valid, true))));
    hh_q('UPDATE hh_users SET wishlist = ? WHERE id = ?', [implode(',', $clean), $user['id']]);
    return ['items' => $clean];
}

/** XP earned this week by you and your neighbors. @param array<string,mixed> $user */
function hh_h_leaderboard(array $user): array
{
    $me = (int) $user['id'];
    $week = hh_week_start();
    $rows = hh_all(
        'SELECT u.id, u.username, u.avatar, u.level, CASE WHEN u.week_start = ? THEN GREATEST(0, CAST(u.xp AS SIGNED) - CAST(u.week_xp_base AS SIGNED)) ELSE 0 END AS weekly
         FROM hh_users u WHERE u.id = ? OR u.id IN (SELECT friend_id FROM hh_friends WHERE user_id = ?)
         ORDER BY weekly DESC, u.level DESC LIMIT 50',
        [$week, $me, $me],
    );
    return ['rows' => array_map(static fn (array $r): array => [
        'username' => (string) $r['username'],
        'avatar' => (string) $r['avatar'],
        'level' => (int) $r['level'],
        'xp' => (int) $r['weekly'],
        'me' => (int) $r['id'] === $me,
    ], $rows), 'week' => $week];
}

/** Ask neighbors to staff a community building. @param array<string,mixed> $user */
function hh_h_job_request(array $user): array
{
    $me = (int) $user['id'];
    hh_rate('user:' . $me . ':jobreq', 20, 3600);
    $in = hh_input();
    $objectId = hh_int($in, 'objectId', 1, 10_000_000);
    $item = hh_str($in, 'item', 2, 24);
    $def = hh_items()[$item] ?? null;
    if ($def === null || (int) ($def['jobs'] ?? 0) < 1) {
        hh_fail('invalid', 400, ['field' => 'item']);
    }
    $open = hh_one('SELECT COUNT(*) AS n FROM hh_jobs WHERE host_id = ? AND closed = 0', [$me]);
    if ((int) ($open['n'] ?? 0) >= 20) {
        hh_fail('limit', 429);
    }
    hh_q('UPDATE hh_jobs SET closed = 1 WHERE host_id = ? AND object_id = ?', [$me, $objectId]);
    hh_q('INSERT INTO hh_jobs (host_id, object_id, item, slots, closed, created_at) VALUES (?, ?, ?, ?, 0, ?)', [$me, $objectId, $item, (int) $def['jobs'], hh_datetime()]);
    return ['id' => (int) hh_db()->lastInsertId()];
}

/** A neighbor takes one job (one slot per neighbor per building). @param array<string,mixed> $user */
function hh_h_job_fill(array $user): array
{
    $me = (int) $user['id'];
    hh_rate('user:' . $me . ':jobfill', 60, 3600);
    $jobId = hh_int(hh_input(), 'requestId', 1, PHP_INT_MAX);
    return hh_tx(static function () use ($me, $jobId): array {
        $job = hh_one('SELECT * FROM hh_jobs WHERE id = ? FOR UPDATE', [$jobId]);
        if ($job === null || (int) $job['closed'] === 1 || !hh_are_friends($me, (int) $job['host_id'])) {
            hh_fail('gone', 409);
        }
        try {
            hh_q('INSERT INTO hh_job_fills (job_id, host_id, worker_id, object_id, applied, created_at) VALUES (?, ?, ?, ?, 0, ?)', [$jobId, $job['host_id'], $me, $job['object_id'], hh_datetime()]);
        } catch (PDOException $e) {
            if ($e->getCode() === '23000') {
                hh_fail('already', 409);
            }
            throw $e;
        }
        $n = hh_one('SELECT COUNT(*) AS n FROM hh_job_fills WHERE host_id = ? AND object_id = ?', [$job['host_id'], $job['object_id']]);
        if ((int) ($n['n'] ?? 0) >= (int) $job['slots']) {
            hh_q('UPDATE hh_jobs SET closed = 1 WHERE id = ?', [$jobId]);
        }
        hh_allow($me, 60, 4);
        return [];
    });
}

/** Host applied the neighbor staff to their building. @param array<string,mixed> $user */
function hh_h_staffed_ack(array $user): array
{
    $ids = hh_int_list(hh_input(), 'ids', 100);
    if ($ids) {
        hh_q('UPDATE hh_job_fills SET applied = 1 WHERE host_id = ? AND id IN (' . hh_in(count($ids)) . ')', [$user['id'], ...$ids]);
    }
    return [];
}
