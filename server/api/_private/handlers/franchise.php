<?php
// Franchises: an owner builds a copy of one of their shops on a neighbor's
// Empty Lot. The host accepts it; once a day the owner supplies every
// franchise (the host receives the shop's full goods amount while the owner
// pays half), deliveries raise the franchise's stars and the owner's bonus.
declare(strict_types=1);

if (!defined('HH_API')) {
    http_response_code(403);
    exit;
}

function hh_franchise_stars(int $deliveries): int
{
    return match (true) {
        $deliveries >= 60 => 5,
        $deliveries >= 30 => 4,
        $deliveries >= 14 => 3,
        $deliveries >= 7 => 2,
        $deliveries >= 3 => 1,
        default => 0,
    };
}

/** @param array<string,mixed> $user */
function hh_h_franchises(array $user): array
{
    $me = (int) $user['id'];
    $owned = hh_all(
        'SELECT f.*, u.username AS host_name, u.avatar AS host_avatar FROM hh_franchises f JOIN hh_users u ON u.id = f.host_id WHERE f.owner_id = ? ORDER BY f.id',
        [$me],
    );
    $hosted = hh_all(
        'SELECT f.*, u.username AS owner_name, u.avatar AS owner_avatar FROM hh_franchises f JOIN hh_users u ON u.id = f.owner_id WHERE f.host_id = ? ORDER BY f.id',
        [$me],
    );
    $map = static fn (array $r): array => [
        'id' => (int) $r['id'],
        'item' => (string) $r['item'],
        'lotId' => (int) $r['lot_id'],
        'stars' => (int) $r['stars'],
        'deliveries' => (int) $r['deliveries'],
        'suppliedToday' => ($r['last_supply'] ?? '') === hh_today(),
        'status' => ['pending', 'active', 'declined'][(int) $r['status']] ?? 'pending',
        'pendingGoods' => (int) $r['host_pending'],
    ];
    return [
        'owned' => array_map(static fn (array $r): array => $map($r) + ['hostId' => (int) $r['host_id'], 'hostName' => (string) $r['host_name'], 'hostAvatar' => (string) $r['host_avatar']], $owned),
        'hosted' => array_map(static fn (array $r): array => $map($r) + ['ownerId' => (int) $r['owner_id'], 'ownerName' => (string) $r['owner_name'], 'ownerAvatar' => (string) $r['owner_avatar']], $hosted),
    ];
}

/** Build a franchise of one of your shops on a neighbor's empty lot. @param array<string,mixed> $user */
function hh_h_franchise_place(array $user): array
{
    $me = (int) $user['id'];
    hh_rate('user:' . $me . ':franchise', 20, 3600);
    $in = hh_input();
    $host = hh_int($in, 'hostId', 1, PHP_INT_MAX);
    $lotId = hh_int($in, 'lotId', 1, 10_000_000);
    $item = hh_str($in, 'item', 2, 24);
    $def = hh_items()[$item] ?? null;
    if ($def === null || ($def['kind'] ?? '') !== 'business') {
        hh_fail('invalid', 400, ['field' => 'item']);
    }
    if ($host === $me || !hh_are_friends($me, $host)) {
        hh_fail('forbidden', 403);
    }
    // the lot must be an Empty Lot in the host's saved city
    $save = hh_one('SELECT data FROM hh_saves WHERE user_id = ?', [$host]);
    $state = $save ? (json_decode((string) $save['data'], true)['state'] ?? null) : null;
    $lot = is_array($state) ? ($state['objects'][(string) $lotId] ?? null) : null;
    if (!is_array($lot) || ($lot['item'] ?? '') !== 'emptylot') {
        hh_fail('notApplicable', 409);
    }
    // the owner must own (a finished copy of) that shop
    $mine = hh_one('SELECT data FROM hh_saves WHERE user_id = ?', [$me]);
    $myState = $mine ? (json_decode((string) $mine['data'], true)['state'] ?? null) : null;
    $owns = false;
    foreach ((array) ($myState['objects'] ?? []) as $o) {
        if (is_array($o) && ($o['item'] ?? '') === $item && !empty($o['built'])) {
            $owns = true;
            break;
        }
    }
    if (!$owns) {
        hh_fail('notOwned', 409);
    }
    try {
        hh_q('INSERT INTO hh_franchises (owner_id, host_id, item, lot_id, stars, deliveries, status, created_at) VALUES (?, ?, ?, ?, 0, 0, 0, ?)', [$me, $host, $item, $lotId, hh_datetime()]);
    } catch (PDOException $e) {
        if ($e->getCode() === '23000') {
            hh_fail('taken', 409);
        }
        throw $e;
    }
    return ['id' => (int) hh_db()->lastInsertId(), 'cost' => (int) round((int) $def['price'] * 0.8)];
}

/** Host accepts or declines a franchise on their land. @param array<string,mixed> $user */
function hh_h_franchise_accept(array $user): array
{
    $in = hh_input();
    $id = hh_int($in, 'id', 1, PHP_INT_MAX);
    $accept = ($in['accept'] ?? true) === true;
    $row = hh_one('SELECT * FROM hh_franchises WHERE id = ? AND host_id = ?', [$id, $user['id']]);
    if ($row === null) {
        hh_fail('notFound', 404);
    }
    if ($accept) {
        hh_q('UPDATE hh_franchises SET status = 1 WHERE id = ?', [$id]);
    } elseif ((int) $row['status'] === 0) {
        hh_q('UPDATE hh_franchises SET status = 2 WHERE id = ?', [$id]);
    } else {
        // removing an active franchise from your land
        hh_q('DELETE FROM hh_franchises WHERE id = ?', [$id]);
    }
    return [];
}

/** Owner's daily supply run for all active franchises. @param array<string,mixed> $user */
function hh_h_franchise_supply(array $user): array
{
    $me = (int) $user['id'];
    hh_rate('user:' . $me . ':fsupply', 20, 3600);
    return hh_tx(static function () use ($me): array {
        $rows = hh_all('SELECT * FROM hh_franchises WHERE owner_id = ? AND status = 1 AND (last_supply IS NULL OR last_supply <> ?) FOR UPDATE', [$me, hh_today()]);
        $coins = 0;
        $goodsCost = 0;
        $items = hh_items();
        foreach ($rows as $r) {
            $def = $items[(string) $r['item']] ?? null;
            if ($def === null) {
                continue;
            }
            $deliveries = (int) $r['deliveries'] + 1;
            $stars = hh_franchise_stars($deliveries);
            $goods = (int) ($def['goods'] ?? 0);
            $goodsCost += (int) ceil($goods / 2);
            $coins += (int) round((int) ($def['payout'] ?? 0) * (0.5 + 0.1 * $stars));
            hh_q('UPDATE hh_franchises SET deliveries = ?, stars = ?, last_supply = ?, host_pending = host_pending + ? WHERE id = ?', [$deliveries, $stars, hh_today(), $goods, $r['id']]);
        }
        if ($rows) {
            hh_allow($me, $coins, 5 * count($rows));
        }
        return ['delivered' => count($rows), 'goodsCost' => $goodsCost, 'reward' => ['coins' => $coins, 'xp' => 5 * count($rows)], 'day' => hh_today()];
    });
}

/** Host takes delivered goods from franchises on their land. @param array<string,mixed> $user */
function hh_h_franchise_collect(array $user): array
{
    $me = (int) $user['id'];
    $ids = hh_int_list(hh_input(), 'ids', 100);
    if (!$ids) {
        return ['goods' => 0];
    }
    return hh_tx(static function () use ($me, $ids): array {
        $rows = hh_all('SELECT id, host_pending FROM hh_franchises WHERE host_id = ? AND id IN (' . hh_in(count($ids)) . ') FOR UPDATE', [$me, ...$ids]);
        $goods = 0;
        foreach ($rows as $r) {
            $goods += (int) $r['host_pending'];
        }
        hh_q('UPDATE hh_franchises SET host_pending = 0 WHERE host_id = ? AND id IN (' . hh_in(count($ids)) . ')', [$me, ...$ids]);
        hh_allow($me, 0, 0, $goods);
        return ['goods' => $goods];
    });
}

/** Owner clears a declined franchise (after taking the refund). @param array<string,mixed> $user */
function hh_h_franchise_remove(array $user): array
{
    $id = hh_int(hh_input(), 'id', 1, PHP_INT_MAX);
    $row = hh_one('SELECT * FROM hh_franchises WHERE id = ? AND owner_id = ? AND status = 2', [$id, $user['id']]);
    if ($row === null) {
        hh_fail('notFound', 404);
    }
    $def = hh_items()[(string) $row['item']] ?? null;
    $refund = $def ? (int) round((int) $def['price'] * 0.8) : 0;
    hh_q('DELETE FROM hh_franchises WHERE id = ?', [$id]);
    hh_allow((int) $user['id'], $refund, 0);
    return ['refund' => $refund];
}
