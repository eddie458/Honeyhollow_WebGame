<?php
// Optional daily cleanup. Run from a cron job (hPanel -> Advanced -> Cron Jobs):
//   /usr/bin/php /home/USER/domains/DOMAIN/public_html/api/_private/cron/cleanup.php
// It removes expired sessions, old rate-limit windows and old social rows.
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit;
}

define('HH_API', true);
require __DIR__ . '/../lib/http.php';
require __DIR__ . '/../lib/db.php';

function hh_config(): array
{
    static $cfg = null;
    if ($cfg === null) {
        $cfg = require __DIR__ . '/../config.php';
    }
    return $cfg;
}

$now = time();
$steps = [
    'expired sessions' => ['DELETE FROM hh_sessions WHERE expires_at < ?', [gmdate('Y-m-d H:i:s', $now)]],
    'old rate windows' => ['DELETE FROM hh_rate WHERE window_start < ?', [$now - 2 * 86400]],
    'old help records' => ['DELETE FROM hh_helps WHERE day < ?', [gmdate('Y-m-d', $now - 30 * 86400)]],
    'old gifts' => ['DELETE FROM hh_gifts WHERE day < ?', [gmdate('Y-m-d', $now - 30 * 86400)]],
    'stale job requests' => ['UPDATE hh_jobs SET closed = 1 WHERE closed = 0 AND created_at < ?', [gmdate('Y-m-d H:i:s', $now - 7 * 86400)]],
    'old jobs' => ['DELETE FROM hh_jobs WHERE closed = 1 AND created_at < ?', [gmdate('Y-m-d H:i:s', $now - 30 * 86400)]],
    'applied job fills' => ['DELETE FROM hh_job_fills WHERE applied = 1 AND created_at < ?', [gmdate('Y-m-d H:i:s', $now - 30 * 86400)]],
    'declined franchises' => ['DELETE FROM hh_franchises WHERE status = 2 AND created_at < ?', [gmdate('Y-m-d H:i:s', $now - 30 * 86400)]],
];
foreach ($steps as $label => [$sql, $params]) {
    $n = hh_q($sql, $params)->rowCount();
    echo str_pad($label, 22) . " removed/updated: {$n}\n";
}
echo "Honeyhollow cleanup done.\n";
