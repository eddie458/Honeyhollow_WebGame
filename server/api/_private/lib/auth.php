<?php
// Sessions (random token in a Secure/HttpOnly/SameSite=Strict cookie, only its
// SHA-256 stored in the database), CSRF tokens (HMAC of the session token, or
// of a pre-session cookie before login) and small identity helpers.
declare(strict_types=1);

if (!defined('HH_API')) {
    http_response_code(403);
    exit;
}

const HH_SESSION_COOKIE = 'hh_session';
const HH_PRE_COOKIE = 'hh_pre';
const HH_SESSION_DAYS = 30;
const HH_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const HH_AVATARS = ['beekeeper', 'baker', 'sailor', 'gardener', 'painter', 'chef', 'explorer', 'mechanic', 'musician', 'scientist', 'firefighter', 'librarian'];

function hh_cookie_path(): string
{
    $dir = str_replace('\\', '/', dirname((string) ($_SERVER['SCRIPT_NAME'] ?? '/api/index.php')));
    return rtrim($dir, '/') . '/';
}

function hh_https(): bool
{
    $setting = hh_config()['cookie_secure'] ?? 'auto';
    if ($setting === true || $setting === false) {
        return $setting;
    }
    if (!empty($_SERVER['HTTPS']) && strtolower((string) $_SERVER['HTTPS']) !== 'off') {
        return true;
    }
    if ((int) ($_SERVER['SERVER_PORT'] ?? 0) === 443) {
        return true;
    }
    return !empty(hh_config()['trust_proxy']) && strtolower((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https';
}

function hh_set_cookie(string $name, string $value, int $maxAge): void
{
    setcookie($name, $value, [
        'expires' => $maxAge > 0 ? time() + $maxAge : time() - 3600,
        'path' => hh_cookie_path(),
        'secure' => hh_https(),
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    if ($maxAge > 0) {
        $_COOKIE[$name] = $value;
    } else {
        unset($_COOKIE[$name]);
    }
}

function hh_token_cookie(string $name): ?string
{
    $v = $_COOKIE[$name] ?? null;
    return is_string($v) && preg_match('/^[a-f0-9]{64}$/', $v) ? $v : null;
}

function hh_hmac(string $data): string
{
    return hash_hmac('sha256', $data, (string) hh_config()['secret']);
}

/** @var array<string,mixed>|null|false $GLOBALS['hh_user_cache'] */
function hh_current_user(): ?array
{
    if (array_key_exists('hh_user_cache', $GLOBALS)) {
        return $GLOBALS['hh_user_cache'];
    }
    $GLOBALS['hh_user_cache'] = null;
    $token = hh_token_cookie(HH_SESSION_COOKIE);
    if ($token === null) {
        return null;
    }
    $row = hh_one(
        'SELECT s.token_hash, s.last_used, u.* FROM hh_sessions s JOIN hh_users u ON u.id = s.user_id
         WHERE s.token_hash = ? AND s.expires_at > ?',
        [hash('sha256', $token), hh_datetime()],
    );
    if ($row === null) {
        return null;
    }
    // Sliding expiry: refresh at most once a day.
    if (strtotime((string) $row['last_used'] . ' UTC') < time() - 86400) {
        hh_q('UPDATE hh_sessions SET last_used = ?, expires_at = ? WHERE token_hash = ?', [
            hh_datetime(),
            hh_datetime(time() + HH_SESSION_DAYS * 86400),
            $row['token_hash'],
        ]);
        hh_set_cookie(HH_SESSION_COOKIE, $token, HH_SESSION_DAYS * 86400);
    }
    unset($row['token_hash'], $row['last_used']);
    $GLOBALS['hh_user_cache'] = $row;
    return $row;
}

function hh_start_session(int $userId): void
{
    $token = bin2hex(random_bytes(32));
    hh_q('INSERT INTO hh_sessions (token_hash, user_id, created_at, last_used, expires_at) VALUES (?, ?, ?, ?, ?)', [
        hash('sha256', $token),
        $userId,
        hh_datetime(),
        hh_datetime(),
        hh_datetime(time() + HH_SESSION_DAYS * 86400),
    ]);
    hh_set_cookie(HH_SESSION_COOKIE, $token, HH_SESSION_DAYS * 86400);
    unset($GLOBALS['hh_user_cache']);
}

function hh_end_session(): void
{
    $token = hh_token_cookie(HH_SESSION_COOKIE);
    if ($token !== null) {
        hh_q('DELETE FROM hh_sessions WHERE token_hash = ?', [hash('sha256', $token)]);
    }
    hh_set_cookie(HH_SESSION_COOKIE, '', -1);
    unset($GLOBALS['hh_user_cache']);
}

/** CSRF token for the current browser (signed, never stored). */
function hh_csrf_token(): string
{
    $session = hh_token_cookie(HH_SESSION_COOKIE);
    if ($session !== null) {
        return hh_hmac('csrf|' . $session);
    }
    $pre = hh_token_cookie(HH_PRE_COOKIE);
    if ($pre === null) {
        $pre = bin2hex(random_bytes(32));
        hh_set_cookie(HH_PRE_COOKIE, $pre, 7 * 86400);
    }
    return hh_hmac('pre|' . $pre);
}

function hh_check_csrf(): void
{
    $sent = (string) ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    $ok = false;
    $session = hh_token_cookie(HH_SESSION_COOKIE);
    if ($session !== null && hash_equals(hh_hmac('csrf|' . $session), $sent)) {
        $ok = true;
    }
    $pre = hh_token_cookie(HH_PRE_COOKIE);
    if (!$ok && $pre !== null && hash_equals(hh_hmac('pre|' . $pre), $sent)) {
        $ok = true;
    }
    if (!$ok) {
        hh_fail('csrf', 403);
    }
}

function hh_random_code(int $groups, int $size = 4): string
{
    $parts = [];
    $n = strlen(HH_CODE_ALPHABET);
    for ($g = 0; $g < $groups; $g++) {
        $chunk = '';
        for ($i = 0; $i < $size; $i++) {
            $chunk .= HH_CODE_ALPHABET[random_int(0, $n - 1)];
        }
        $parts[] = $chunk;
    }
    return implode('-', $parts);
}

/**
 * Public view of a user row.
 * @param array<string,mixed> $u
 * @return array<string,mixed>
 */
function hh_public_user(array $u): array
{
    return [
        'id' => (int) $u['id'],
        'username' => (string) $u['username'],
        'avatar' => (string) $u['avatar'],
        'cityName' => (string) $u['city_name'],
        'level' => (int) $u['level'],
        'friendCode' => (string) $u['friend_code'],
    ];
}

function hh_are_friends(int $a, int $b): bool
{
    return hh_one('SELECT 1 AS x FROM hh_friends WHERE user_id = ? AND friend_id = ?', [$a, $b]) !== null;
}
