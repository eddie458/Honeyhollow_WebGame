<?php
// Router for PHP's built-in development server (not used on Hostinger):
//   php -S localhost:8080 -t server server/dev-router.php
// It mimics the .htaccess rules by refusing anything inside _private.
declare(strict_types=1);

$path = parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH) ?: '/';
if (preg_match('#(^|/)_private(/|$)#', $path) || preg_match('#config(\.sample)?\.php$#', $path)) {
    http_response_code(403);
    header('Content-Type: text/plain');
    echo 'Forbidden';
    return true;
}
if (preg_match('#^/api/?(index\.php)?$#', $path)) {
    $_SERVER['SCRIPT_NAME'] = '/api/index.php';
    require __DIR__ . '/api/index.php';
    return true;
}
return false;
