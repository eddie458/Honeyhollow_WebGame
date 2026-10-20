<?php
// Server-side sanity checks for cloud saves: structure, size, internal
// consistency, and resource gains that are possible in the elapsed time.
declare(strict_types=1);

if (!defined('HH_API')) {
    http_response_code(403);
    exit;
}

/**
 * Validates an uploaded save. Returns a summary used for bookkeeping, or
 * fails with 'invalid' (malformed) / 'sanity' (impossible progress).
 *
 * @param mixed $save the uploaded SaveFile
 * @param array<string,mixed>|null $prev previous hh_saves row (if any)
 * @return array{level:int,xp:int,coins:int,goods:int,cityName:string,avatar:string,relaxed:bool}
 */
function hh_check_save(mixed $save, ?array $prev, int $nowMs, bool $force): array
{
    if (!is_array($save) || ($save['format'] ?? null) !== 'honeyhollow' || !is_array($save['state'] ?? null)) {
        hh_fail('invalid', 400, ['field' => 'save']);
    }
    $version = $save['version'] ?? null;
    if (!is_int($version) || $version < 1 || $version > (int) hh_balance()['saveVersion']) {
        hh_fail('invalid', 400, ['field' => 'version']);
    }
    $s = $save['state'];
    $num = static function (mixed $v, int|float $max) {
        if (!is_int($v) && !is_float($v)) {
            hh_fail('invalid', 400, ['field' => 'state']);
        }
        if ($v < 0 || $v > $max) {
            hh_fail('sanity', 422, ['field' => 'range']);
        }
        return (int) $v;
    };
    $level = $num($s['level'] ?? null, 1000);
    $xp = $num($s['xp'] ?? null, 1e13);
    $coins = $num($s['coins'] ?? null, 1e12);
    $goods = $num($s['goods'] ?? null, 1e9);
    $num($s['energy'] ?? null, 100000);
    if (!is_array($s['objects'] ?? null) || count($s['objects']) > (int) hh_balance()['sanity']['maxObjects']) {
        hh_fail('sanity', 422, ['field' => 'objects']);
    }
    // the level must be earned by the XP it claims
    if ($level > hh_level_for_xp($xp)) {
        hh_fail('sanity', 422, ['field' => 'level']);
    }
    $relaxed = !empty($s['settings']['relaxed']);

    if ($prev !== null) {
        $cfg = hh_balance()['sanity'];
        $minutes = max(1.0, min(60 * 24 * 14, ($nowMs - (int) $prev['saved_at']) / 60000));
        $lvl = max($level, (int) $prev['level']);
        $mult = $relaxed ? (float) $cfg['relaxedMultiplier'] : 1.0;
        if ($force) {
            $mult *= 4; // a different device may have played offline for a while
        }
        $coinsAllow = $cfg['coinsBurst'] + ($cfg['coinsPerMinuteBase'] + $cfg['coinsPerMinutePerLevel'] * $lvl) * $minutes * $mult + (int) $prev['allow_coins'];
        $xpAllow = $cfg['xpBurst'] + ($cfg['xpPerMinuteBase'] + $cfg['xpPerMinutePerLevel'] * $lvl) * $minutes * $mult + (int) $prev['allow_xp'];
        if ($coins - (int) $prev['coins'] > $coinsAllow) {
            hh_fail('sanity', 422, ['field' => 'coins']);
        }
        if ($xp - (int) $prev['xp'] > $xpAllow) {
            hh_fail('sanity', 422, ['field' => 'xp']);
        }
    }
    $city = is_string($s['cityName'] ?? null) ? hh_clean_text($s['cityName'], 28) : 'Honeyhollow';
    $avatar = is_string($s['avatar'] ?? null) && in_array($s['avatar'], HH_AVATARS, true) ? $s['avatar'] : 'beekeeper';
    return [
        'level' => $level,
        'xp' => $xp,
        'coins' => $coins,
        'goods' => $goods,
        'cityName' => $city !== '' ? $city : 'Honeyhollow',
        'avatar' => $avatar,
        'relaxed' => $relaxed,
    ];
}

/** Records server-granted rewards so the next save may include them. */
function hh_allow(int $userId, int $coins, int $xp, int $goods = 0): void
{
    hh_q('UPDATE hh_saves SET allow_coins = allow_coins + ?, allow_xp = allow_xp + ?, allow_goods = allow_goods + ? WHERE user_id = ?', [$coins, $xp, $goods, $userId]);
}
