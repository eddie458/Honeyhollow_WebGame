<?php
// Loads configuration and libraries, then routes the request.
declare(strict_types=1);

if (!defined('HH_API')) {
    http_response_code(403);
    exit;
}

ini_set('display_errors', '0');
error_reporting(E_ALL);

require __DIR__ . '/lib/http.php';
require __DIR__ . '/lib/db.php';
require __DIR__ . '/lib/auth.php';
require __DIR__ . '/lib/ratelimit.php';
require __DIR__ . '/lib/validate.php';
require __DIR__ . '/lib/game.php';
require __DIR__ . '/lib/sanity.php';
require __DIR__ . '/handlers/account.php';
require __DIR__ . '/handlers/save.php';
require __DIR__ . '/handlers/social.php';
require __DIR__ . '/handlers/franchise.php';

/** @return array<string,mixed> */
function hh_config(): array
{
    static $cfg = null;
    if ($cfg !== null) {
        return $cfg;
    }
    $file = getenv('HH_CONFIG') ?: __DIR__ . '/config.php';
    if (!is_file($file)) {
        hh_fail('config', 500);
    }
    $loaded = require $file;
    if (!is_array($loaded)) {
        hh_fail('config', 500);
    }
    $secret = (string) ($loaded['secret'] ?? '');
    if (strlen($secret) < 32 || str_starts_with($secret, 'CHANGE-ME')) {
        hh_fail('config', 500);
    }
    $cfg = $loaded;
    return $cfg;
}

/**
 * Route table: action => [method, handler, requires login].
 * @return array<string, array{0:string,1:callable,2:bool}>
 */
function hh_routes(): array
{
    return [
        'session' => ['GET', 'hh_h_session', false],
        'register' => ['POST', 'hh_h_register', false],
        'login' => ['POST', 'hh_h_login', false],
        'logout' => ['POST', 'hh_h_logout', false],
        'recover' => ['POST', 'hh_h_recover', false],
        'password' => ['POST', 'hh_h_password', true],
        'profile' => ['POST', 'hh_h_profile', true],
        'delete_account' => ['POST', 'hh_h_delete_account', true],
        'save_get' => ['GET', 'hh_h_save_get', true],
        'save_put' => ['POST', 'hh_h_save_put', true],
        'friends' => ['GET', 'hh_h_friends', true],
        'friend_add' => ['POST', 'hh_h_friend_add', true],
        'friend_remove' => ['POST', 'hh_h_friend_remove', true],
        'city' => ['GET', 'hh_h_city', true],
        'help' => ['POST', 'hh_h_help', true],
        'inbox' => ['GET', 'hh_h_inbox', true],
        'help_ack' => ['POST', 'hh_h_help_ack', true],
        'gift_send' => ['POST', 'hh_h_gift_send', true],
        'gift_ack' => ['POST', 'hh_h_gift_ack', true],
        'wishlist' => ['POST', 'hh_h_wishlist', true],
        'leaderboard' => ['GET', 'hh_h_leaderboard', true],
        'job_request' => ['POST', 'hh_h_job_request', true],
        'job_fill' => ['POST', 'hh_h_job_fill', true],
        'staffed_ack' => ['POST', 'hh_h_staffed_ack', true],
        'franchises' => ['GET', 'hh_h_franchises', true],
        'franchise_place' => ['POST', 'hh_h_franchise_place', true],
        'franchise_supply' => ['POST', 'hh_h_franchise_supply', true],
        'franchise_accept' => ['POST', 'hh_h_franchise_accept', true],
        'franchise_collect' => ['POST', 'hh_h_franchise_collect', true],
        'franchise_remove' => ['POST', 'hh_h_franchise_remove', true],
    ];
}

function hh_run(): void
{
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: same-origin');
    header('X-Frame-Options: DENY');
    try {
        if (version_compare(PHP_VERSION, '8.2.0', '<')) {
            hh_fail('php_version', 500);
        }
        hh_config();
        $action = (string) ($_GET['a'] ?? '');
        $routes = hh_routes();
        if (!isset($routes[$action])) {
            hh_fail('unknown_action', 404);
        }
        [$method, $handler, $needsUser] = $routes[$action];
        $reqMethod = $_SERVER['REQUEST_METHOD'] ?? 'GET';
        if ($reqMethod !== $method) {
            hh_fail('method', 405);
        }
        // Every client gets a modest overall request budget per IP.
        hh_rate('ip:' . hh_ip_key() . ':all', 240, 60);
        if ($method === 'POST') {
            hh_check_csrf();
        }
        $user = hh_current_user();
        if ($needsUser && $user === null) {
            hh_fail('auth', 401);
        }
        if ($user !== null) {
            hh_rate('user:' . $user['id'] . ':all', 300, 60);
        }
        $result = $handler($user);
        hh_json(['ok' => true] + $result);
    } catch (ApiError $e) {
        hh_json(['ok' => false, 'error' => $e->getMessage()] + $e->extra, $e->status);
    } catch (Throwable $e) {
        error_log('[honeyhollow] ' . get_class($e) . ': ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
        $code = $e instanceof PDOException ? 'database' : 'server';
        hh_json(['ok' => false, 'error' => $code], 500);
    }
}
