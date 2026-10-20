<?php
// Fixed-window rate limits stored in MySQL (works on any shared host - no
// APCu/Redis needed). Old windows are removed by cron/cleanup.php.
declare(strict_types=1);

if (!defined('HH_API')) {
    http_response_code(403);
    exit;
}

/** Counts one hit in `bucket`; fails with 429 when over `limit` per `window` seconds. */
function hh_rate(string $bucket, int $limit, int $window): void
{
    $bucket = substr($bucket, 0, 96);
    $start = intdiv(time(), $window) * $window;
    hh_q(
        'INSERT INTO hh_rate (bucket, window_start, hits) VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE hits = hits + 1',
        [$bucket, $start],
    );
    $row = hh_one('SELECT hits FROM hh_rate WHERE bucket = ? AND window_start = ?', [$bucket, $start]);
    if ($row !== null && (int) $row['hits'] > $limit) {
        hh_fail('rate', 429, ['retryAfter' => $start + $window - time()]);
    }
}
