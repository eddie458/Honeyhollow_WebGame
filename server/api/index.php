<?php
// Honeyhollow API front controller. Every request goes through here:
//   GET  index.php?a=session
//   POST index.php?a=login   (JSON body, X-CSRF-Token header)
// All other PHP files live in _private/, which the web server refuses to serve.
declare(strict_types=1);

define('HH_API', true);
require __DIR__ . '/_private/bootstrap.php';

hh_run();
