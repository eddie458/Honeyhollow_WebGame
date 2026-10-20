<?php
// Honeyhollow server configuration.
//
// 1. Copy this file to config.php (same folder: api/_private/config.php).
// 2. Fill in the database details from hPanel -> Databases -> Management.
// 3. Replace the secret with a long random string (at least 32 characters).
//    You can generate one at https://www.random.org/strings/ or type any
//    long mix of letters and numbers. Never share it.
//
// This folder is blocked from the web by .htaccess, and this file only returns
// an array (it prints nothing), so the values can't be seen by visitors.
// When you update the game later, keep your config.php - don't overwrite it.
declare(strict_types=1);

if (!defined('HH_API')) {
    http_response_code(403);
    exit;
}

return [
    'db' => [
        'host' => 'localhost',
        'port' => 3306,
        'name' => 'u123456789_honeyhollow',
        'user' => 'u123456789_hhuser',
        'pass' => 'your-database-password',
    ],

    // Used to sign security tokens. Change it to your own long random string.
    'secret' => 'CHANGE-ME-to-a-long-random-string-of-at-least-32-characters',

    // 'auto' marks cookies Secure when the site is opened over HTTPS.
    'cookie_secure' => 'auto',

    // Set to true only if your host puts a proxy in front of PHP and you need
    // the visitor IP from X-Forwarded-For (Hostinger does not need this).
    'trust_proxy' => false,

    // Allow new accounts to be created.
    'allow_register' => true,

    // Largest accepted cloud save in bytes.
    'max_save_bytes' => 524288,
];
