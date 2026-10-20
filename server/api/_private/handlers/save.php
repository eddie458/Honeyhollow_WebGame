<?php
// Cloud saves with optimistic concurrency (revision numbers) and sanity checks.
declare(strict_types=1);

if (!defined('HH_API')) {
    http_response_code(403);
    exit;
}

/** @param array<string,mixed> $user */
function hh_h_save_get(array $user): array
{
    $row = hh_one('SELECT rev, data, saved_at FROM hh_saves WHERE user_id = ?', [$user['id']]);
    if ($row === null) {
        return ['save' => null, 'rev' => 0, 'savedAt' => 0];
    }
    return ['save' => json_decode((string) $row['data'], true), 'rev' => (int) $row['rev'], 'savedAt' => (int) $row['saved_at']];
}

/** @param array<string,mixed> $user */
function hh_h_save_put(array $user): array
{
    $id = (int) $user['id'];
    hh_rate('user:' . $id . ':save', 20, 60);
    $in = hh_input();
    $baseRev = hh_int($in, 'baseRev', 0, PHP_INT_MAX);
    $force = ($in['force'] ?? false) === true;
    $save = $in['save'] ?? null;
    $json = json_encode($save, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    $max = (int) (hh_config()['max_save_bytes'] ?? 524288);
    if ($json === false || strlen($json) > $max) {
        hh_fail('too_large', 413);
    }
    $now = hh_now_ms();
    return hh_tx(static function () use ($id, $baseRev, $force, $save, $json, $now, $user): array {
        $prev = hh_one('SELECT * FROM hh_saves WHERE user_id = ? FOR UPDATE', [$id]);
        if ($prev !== null && (int) $prev['rev'] !== $baseRev && !$force) {
            $info = json_decode((string) $prev['data'], true);
            hh_fail('conflict', 409, [
                'rev' => (int) $prev['rev'],
                'savedAt' => (int) $prev['saved_at'],
                'level' => (int) $prev['level'],
                'cityName' => (string) ($info['state']['cityName'] ?? ''),
                // lets a device recognise its own upload whose reply it never got
                'device' => is_string($info['device'] ?? null) ? $info['device'] : '',
            ]);
        }
        $summary = hh_check_save($save, $prev, $now, $force);
        $rev = $prev === null ? 1 : (int) $prev['rev'] + 1;
        hh_q(
            'INSERT INTO hh_saves (user_id, rev, data, saved_at, level, coins, xp, goods, allow_coins, allow_xp, allow_goods)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0)
             ON DUPLICATE KEY UPDATE rev = VALUES(rev), data = VALUES(data), saved_at = VALUES(saved_at), level = VALUES(level),
               coins = VALUES(coins), xp = VALUES(xp), goods = VALUES(goods), allow_coins = 0, allow_xp = 0, allow_goods = 0',
            [$id, $rev, $json, $now, $summary['level'], $summary['coins'], $summary['xp'], $summary['goods']],
        );
        // weekly leaderboard: remember the XP at the start of each week
        $week = hh_week_start();
        if (($user['week_start'] ?? null) !== $week) {
            hh_q('UPDATE hh_users SET week_start = ?, week_xp_base = ? WHERE id = ?', [$week, min((int) $user['xp'], $summary['xp']), $id]);
        }
        hh_q('UPDATE hh_users SET level = ?, xp = ?, city_name = ?, avatar = ?, last_seen = ? WHERE id = ?', [
            $summary['level'],
            $summary['xp'],
            $summary['cityName'],
            $summary['avatar'],
            hh_datetime(),
            $id,
        ]);
        return ['rev' => $rev, 'savedAt' => $now];
    });
}
