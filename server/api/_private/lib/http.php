<?php
// JSON responses, request parsing and small time/IP helpers.
declare(strict_types=1);

if (!defined('HH_API')) {
    http_response_code(403);
    exit;
}

final class ApiError extends Exception
{
    /** @param array<string,mixed> $extra */
    public function __construct(string $code, public int $status = 400, public array $extra = [])
    {
        parent::__construct($code);
    }
}

/** @param array<string,mixed> $extra */
function hh_fail(string $code, int $status = 400, array $extra = []): never
{
    throw new ApiError($code, $status, $extra);
}

/** @param array<string,mixed> $data */
function hh_json(array $data, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PARTIAL_OUTPUT_ON_ERROR);
    exit;
}

/**
 * Parsed JSON body (POST). Bodies are size-limited before decoding.
 * @return array<string,mixed>
 */
function hh_input(): array
{
    static $input = null;
    if ($input !== null) {
        return $input;
    }
    $limit = (int) (hh_config()['max_save_bytes'] ?? 524288) + 65536;
    $len = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($len > $limit) {
        hh_fail('too_large', 413);
    }
    $raw = file_get_contents('php://input', false, null, 0, $limit + 1);
    if ($raw === false || strlen($raw) > $limit) {
        hh_fail('too_large', 413);
    }
    if ($raw === '') {
        $input = [];
        return $input;
    }
    $data = json_decode($raw, true, 64);
    if (!is_array($data)) {
        hh_fail('invalid', 400);
    }
    $input = $data;
    return $input;
}

function hh_now_ms(): int
{
    return (int) floor(microtime(true) * 1000);
}

/** Current UTC date (daily limits reset at UTC midnight). */
function hh_today(): string
{
    return gmdate('Y-m-d');
}

function hh_datetime(?int $ts = null): string
{
    return gmdate('Y-m-d H:i:s', $ts ?? time());
}

function hh_ip(): string
{
    $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
    if (!empty(hh_config()['trust_proxy']) && !empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $first = trim(explode(',', (string) $_SERVER['HTTP_X_FORWARDED_FOR'])[0]);
        if (filter_var($first, FILTER_VALIDATE_IP)) {
            $ip = $first;
        }
    }
    return substr($ip, 0, 45);
}

/**
 * A one-way, keyed fingerprint of the visitor's IP for rate-limit counters,
 * so plain IP addresses are never written to the database.
 */
function hh_ip_key(): string
{
    return substr(hash_hmac('sha256', 'ip|' . hh_ip(), (string) hh_config()['secret']), 0, 24);
}
