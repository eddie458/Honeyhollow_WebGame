<?php
// Input validation helpers. Anything that fails validation is rejected with a
// 400 'invalid' error before touching the database.
declare(strict_types=1);

if (!defined('HH_API')) {
    http_response_code(403);
    exit;
}

/** @param array<string,mixed> $in */
function hh_str(array $in, string $key, int $min, int $max): string
{
    $v = $in[$key] ?? null;
    if (!is_string($v)) {
        hh_fail('invalid', 400, ['field' => $key]);
    }
    $len = function_exists('mb_strlen') ? mb_strlen($v, 'UTF-8') : strlen($v);
    if ($len < $min || $len > $max) {
        hh_fail('invalid', 400, ['field' => $key]);
    }
    return $v;
}

/** @param array<string,mixed> $in */
function hh_int(array $in, string $key, int $min, int $max): int
{
    $v = $in[$key] ?? null;
    if (is_string($v) && preg_match('/^-?\d{1,12}$/', $v)) {
        $v = (int) $v;
    }
    if (!is_int($v) || $v < $min || $v > $max) {
        hh_fail('invalid', 400, ['field' => $key]);
    }
    return $v;
}

/**
 * @param array<string,mixed> $in
 * @return list<int>
 */
function hh_int_list(array $in, string $key, int $max): array
{
    $v = $in[$key] ?? null;
    if (!is_array($v) || count($v) > $max) {
        hh_fail('invalid', 400, ['field' => $key]);
    }
    $out = [];
    foreach ($v as $x) {
        if (!is_int($x) || $x < 1) {
            hh_fail('invalid', 400, ['field' => $key]);
        }
        $out[] = $x;
    }
    return $out;
}

function hh_valid_username(string $u): bool
{
    return (bool) preg_match('/^[A-Za-z0-9_-]{3,20}$/', $u);
}

/** Removes control characters and angle brackets, collapses whitespace. */
function hh_clean_text(string $s, int $max): string
{
    $s = preg_replace('/[\x00-\x1F\x7F<>]/u', '', $s) ?? '';
    $s = trim(preg_replace('/\s+/u', ' ', $s) ?? '');
    return function_exists('mb_substr') ? mb_substr($s, 0, $max, 'UTF-8') : substr($s, 0, $max);
}

function hh_valid_password(string $p): bool
{
    return strlen($p) >= 8 && strlen($p) <= 200;
}
