<?php
// Accounts: username + password (bcrypt/argon via password_hash), a one-time
// recovery code instead of email, avatar choice and full account deletion.
declare(strict_types=1);

if (!defined('HH_API')) {
    http_response_code(403);
    exit;
}

/** @param array<string,mixed>|null $user */
function hh_h_session(?array $user): array
{
    return [
        'user' => $user ? hh_public_user($user) : null,
        'csrf' => hh_csrf_token(),
        'server' => ['now' => hh_now_ms(), 'day' => hh_today(), 'saveVersion' => (int) hh_balance()['saveVersion']],
    ];
}

/** @param array<string,mixed>|null $user */
function hh_h_register(?array $user): array
{
    if (empty(hh_config()['allow_register'])) {
        hh_fail('closed', 403);
    }
    hh_rate('ip:' . hh_ip_key() . ':register', 6, 3600);
    $in = hh_input();
    $username = hh_str($in, 'username', 3, 20);
    $password = hh_str($in, 'password', 8, 200);
    if (!hh_valid_username($username) || !hh_valid_password($password)) {
        hh_fail('invalid', 400);
    }
    $avatar = (string) ($in['avatar'] ?? 'beekeeper');
    if (!in_array($avatar, HH_AVATARS, true)) {
        $avatar = 'beekeeper';
    }
    $city = hh_clean_text(is_string($in['cityName'] ?? null) ? $in['cityName'] : 'Honeyhollow', 28) ?: 'Honeyhollow';
    $lc = strtolower($username);
    if (hh_one('SELECT id FROM hh_users WHERE username_lc = ?', [$lc]) !== null) {
        hh_fail('taken', 409);
    }
    $recovery = hh_random_code(4);
    $id = 0;
    for ($attempt = 0; $attempt < 6 && $id === 0; $attempt++) {
        $code = hh_random_code(2);
        try {
            hh_q(
                'INSERT INTO hh_users (username, username_lc, pass_hash, recovery_hash, avatar, city_name, friend_code, created_at, last_seen)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [$username, $lc, password_hash($password, PASSWORD_DEFAULT), password_hash($recovery, PASSWORD_DEFAULT), $avatar, $city, $code, hh_datetime(), hh_datetime()],
            );
            $id = (int) hh_db()->lastInsertId();
        } catch (PDOException $e) {
            // 23000 = duplicate key: username race or friend-code collision
            if ($e->getCode() !== '23000') {
                throw $e;
            }
            if (hh_one('SELECT id FROM hh_users WHERE username_lc = ?', [$lc]) !== null) {
                hh_fail('taken', 409);
            }
        }
    }
    if ($id === 0) {
        hh_fail('server', 500);
    }
    hh_start_session($id);
    $row = hh_one('SELECT * FROM hh_users WHERE id = ?', [$id]);
    return ['user' => hh_public_user($row ?? []), 'recoveryCode' => $recovery, 'csrf' => hh_csrf_token()];
}

/** @param array<string,mixed>|null $user */
function hh_h_login(?array $user): array
{
    $in = hh_input();
    $username = hh_str($in, 'username', 1, 40);
    $password = hh_str($in, 'password', 1, 200);
    hh_rate('ip:' . hh_ip_key() . ':login', 12, 600);
    hh_rate('name:' . strtolower($username) . ':login', 10, 600);
    $row = hh_one('SELECT * FROM hh_users WHERE username_lc = ?', [strtolower($username)]);
    // Always run a hash check so timing doesn't reveal which usernames exist.
    $hash = $row['pass_hash'] ?? password_hash(random_bytes(12), PASSWORD_DEFAULT);
    if (!password_verify($password, (string) $hash) || $row === null) {
        hh_fail('badLogin', 401);
    }
    if (password_needs_rehash((string) $row['pass_hash'], PASSWORD_DEFAULT)) {
        hh_q('UPDATE hh_users SET pass_hash = ? WHERE id = ?', [password_hash($password, PASSWORD_DEFAULT), $row['id']]);
    }
    hh_q('UPDATE hh_users SET last_seen = ? WHERE id = ?', [hh_datetime(), $row['id']]);
    hh_start_session((int) $row['id']);
    return ['user' => hh_public_user($row), 'csrf' => hh_csrf_token()];
}

/** @param array<string,mixed>|null $user */
function hh_h_logout(?array $user): array
{
    hh_end_session();
    return ['csrf' => hh_csrf_token()];
}

/** @param array<string,mixed>|null $user */
function hh_h_recover(?array $user): array
{
    hh_rate('ip:' . hh_ip_key() . ':recover', 6, 3600);
    $in = hh_input();
    $username = hh_str($in, 'username', 1, 40);
    $code = strtoupper(trim(hh_str($in, 'recoveryCode', 4, 40)));
    $password = hh_str($in, 'newPassword', 8, 200);
    hh_rate('name:' . strtolower($username) . ':recover', 5, 3600);
    $row = hh_one('SELECT * FROM hh_users WHERE username_lc = ?', [strtolower($username)]);
    if ($row === null || !password_verify($code, (string) $row['recovery_hash'])) {
        hh_fail('badCode', 401);
    }
    $newCode = hh_random_code(4);
    hh_q('UPDATE hh_users SET pass_hash = ?, recovery_hash = ?, last_seen = ? WHERE id = ?', [
        password_hash($password, PASSWORD_DEFAULT),
        password_hash($newCode, PASSWORD_DEFAULT),
        hh_datetime(),
        $row['id'],
    ]);
    // sign out everywhere else
    hh_q('DELETE FROM hh_sessions WHERE user_id = ?', [$row['id']]);
    hh_start_session((int) $row['id']);
    return ['user' => hh_public_user($row), 'recoveryCode' => $newCode, 'csrf' => hh_csrf_token()];
}

/** @param array<string,mixed> $user */
function hh_h_password(array $user): array
{
    hh_rate('user:' . $user['id'] . ':password', 6, 600);
    $in = hh_input();
    $old = hh_str($in, 'oldPassword', 1, 200);
    $new = hh_str($in, 'newPassword', 8, 200);
    if (!password_verify($old, (string) $user['pass_hash'])) {
        hh_fail('badLogin', 401);
    }
    hh_q('UPDATE hh_users SET pass_hash = ? WHERE id = ?', [password_hash($new, PASSWORD_DEFAULT), $user['id']]);
    return [];
}

/** @param array<string,mixed> $user */
function hh_h_profile(array $user): array
{
    $in = hh_input();
    $avatar = (string) ($in['avatar'] ?? $user['avatar']);
    if (!in_array($avatar, HH_AVATARS, true)) {
        hh_fail('invalid', 400, ['field' => 'avatar']);
    }
    $city = is_string($in['cityName'] ?? null) ? hh_clean_text($in['cityName'], 28) : (string) $user['city_name'];
    hh_q('UPDATE hh_users SET avatar = ?, city_name = ? WHERE id = ?', [$avatar, $city !== '' ? $city : 'Honeyhollow', $user['id']]);
    $row = hh_one('SELECT * FROM hh_users WHERE id = ?', [$user['id']]);
    return ['user' => hh_public_user($row ?? $user)];
}

/** @param array<string,mixed> $user */
function hh_h_delete_account(array $user): array
{
    hh_rate('user:' . $user['id'] . ':delete', 5, 600);
    $in = hh_input();
    $password = hh_str($in, 'password', 1, 200);
    if (!password_verify($password, (string) $user['pass_hash'])) {
        hh_fail('badLogin', 401);
    }
    $id = (int) $user['id'];
    hh_tx(static function () use ($id): void {
        hh_q('DELETE FROM hh_saves WHERE user_id = ?', [$id]);
        hh_q('DELETE FROM hh_friends WHERE user_id = ? OR friend_id = ?', [$id, $id]);
        hh_q('DELETE FROM hh_helps WHERE helper_id = ? OR host_id = ?', [$id, $id]);
        hh_q('DELETE FROM hh_gifts WHERE from_id = ? OR to_id = ?', [$id, $id]);
        hh_q('DELETE FROM hh_job_fills WHERE host_id = ? OR worker_id = ?', [$id, $id]);
        hh_q('DELETE FROM hh_jobs WHERE host_id = ?', [$id]);
        hh_q('DELETE FROM hh_franchises WHERE owner_id = ? OR host_id = ?', [$id, $id]);
        hh_q('DELETE FROM hh_sessions WHERE user_id = ?', [$id]);
        hh_q('DELETE FROM hh_users WHERE id = ?', [$id]);
    });
    hh_set_cookie(HH_SESSION_COOKIE, '', -1);
    return ['csrf' => hh_csrf_token()];
}
