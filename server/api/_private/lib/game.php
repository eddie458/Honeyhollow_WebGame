<?php
// Read-only access to the game's content files (the same JSON the client
// uses), copied into _private/data/ when you run `npm run package`.
declare(strict_types=1);

if (!defined('HH_API')) {
    http_response_code(403);
    exit;
}

/** @return array<string,mixed> */
function hh_data(string $name): array
{
    static $cache = [];
    if (isset($cache[$name])) {
        return $cache[$name];
    }
    $candidates = [
        __DIR__ . '/../data/' . $name . '.json',
        // development: read straight from the source tree
        __DIR__ . '/../../../../src/data/' . $name . '.json',
    ];
    foreach ($candidates as $file) {
        if (is_file($file)) {
            $json = json_decode((string) file_get_contents($file), true);
            if (is_array($json)) {
                $cache[$name] = $json;
                return $json;
            }
        }
    }
    hh_fail('config', 500, ['missing' => $name]);
}

/** @return array<string, array<string,mixed>> */
function hh_items(): array
{
    static $items = null;
    if ($items === null) {
        $items = [];
        foreach (hh_data('items')['items'] as $it) {
            $items[(string) $it['id']] = $it;
        }
    }
    return $items;
}

/** @return array<string, array<string,mixed>> */
function hh_crops(): array
{
    static $crops = null;
    if ($crops === null) {
        $crops = [];
        foreach (hh_data('items')['crops'] as $c) {
            $crops[(string) $c['id']] = $c;
        }
    }
    return $crops;
}

/** @return array<string,mixed> */
function hh_balance(): array
{
    return hh_data('balance');
}

/** Highest level reachable with this much XP. */
function hh_level_for_xp(int $xp): int
{
    $level = 1;
    foreach (hh_data('levels')['levels'] as $row) {
        if ($xp >= (int) $row['xp']) {
            $level = max($level, (int) $row['level']);
        }
    }
    return $level;
}

/** @return list<string> all collectible ids */
function hh_collectibles(): array
{
    static $ids = null;
    if ($ids === null) {
        $ids = [];
        $sets = hh_data('collections')['collections'];
        // seasonal events bring their own collections
        foreach (hh_data('events')['events'] as $e) {
            if (isset($e['collection'])) {
                $sets[] = $e['collection'];
            }
        }
        foreach ($sets as $c) {
            foreach ($c['items'] as $i) {
                $ids[] = (string) $i;
            }
        }
    }
    return $ids;
}

/**
 * Server-side plausibility check for a help action on the host's latest
 * saved city (the same rules the client simulation uses).
 * @param array<string,mixed> $state
 */
function hh_help_applies(array $state, int $objectId, string $action, int $nowMs): bool
{
    $objects = $state['objects'] ?? [];
    if (!is_array($objects)) {
        return false;
    }
    $o = $objects[(string) $objectId] ?? null;
    if (!is_array($o)) {
        return false;
    }
    $item = hh_items()[(string) ($o['item'] ?? '')] ?? null;
    if ($item === null) {
        return false;
    }
    $crop = is_array($o['crop'] ?? null) ? $o['crop'] : null;
    $stage = null;
    if ($crop !== null) {
        $def = hh_crops()[(string) ($crop['id'] ?? '')] ?? null;
        if ($def !== null) {
            $elapsed = ($nowMs - (float) ($crop['plantedAt'] ?? 0)) / 1000 + (float) ($crop['boost'] ?? 0);
            $time = (float) $def['time'];
            $wither = (float) (hh_balance()['crops']['witherFactor'] ?? 2);
            $noWither = !empty($state['settings']['noWither']);
            if ($elapsed < $time) {
                $stage = 'growing';
            } elseif ($noWither || $elapsed < $time * (1 + $wither)) {
                $stage = 'ripe';
            } else {
                $stage = 'withered';
            }
        }
    }
    return match ($action) {
        'harvest' => $stage === 'ripe',
        'water' => $stage === 'growing',
        'revive' => $stage === 'withered',
        'tourbus' => ($item['kind'] ?? '') === 'business' && (($o['shop']['state'] ?? '') === 'open'),
        'build' => empty($o['built']) && (int) ($o['clicks'] ?? 0) < (int) ($item['clicks'] ?? 0),
        default => false,
    };
}

/** Monday (UTC) of the current week, as Y-m-d. */
function hh_week_start(): string
{
    return gmdate('Y-m-d', strtotime('monday this week', time()) ?: time());
}
