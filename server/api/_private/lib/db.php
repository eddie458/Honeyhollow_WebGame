<?php
// PDO connection and prepared-statement helpers. Every query in the API goes
// through hh_q() with bound parameters - no string-built SQL with user input.
declare(strict_types=1);

if (!defined('HH_API')) {
    http_response_code(403);
    exit;
}

function hh_db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }
    $db = hh_config()['db'] ?? [];
    $dsn = sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
        (string) ($db['host'] ?? 'localhost'),
        (int) ($db['port'] ?? 3306),
        (string) ($db['name'] ?? ''),
    );
    $pdo = new PDO($dsn, (string) ($db['user'] ?? ''), (string) ($db['pass'] ?? ''), [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
        PDO::ATTR_STRINGIFY_FETCHES => false,
    ]);
    $pdo->exec("SET time_zone = '+00:00'");
    return $pdo;
}

/** @param array<int|string, mixed> $params */
function hh_q(string $sql, array $params = []): PDOStatement
{
    $st = hh_db()->prepare($sql);
    $st->execute($params);
    return $st;
}

/**
 * @param array<int|string, mixed> $params
 * @return array<string,mixed>|null
 */
function hh_one(string $sql, array $params = []): ?array
{
    $row = hh_q($sql, $params)->fetch();
    return is_array($row) ? $row : null;
}

/**
 * @param array<int|string, mixed> $params
 * @return list<array<string,mixed>>
 */
function hh_all(string $sql, array $params = []): array
{
    return hh_q($sql, $params)->fetchAll();
}

/**
 * Runs $fn inside a transaction.
 * @template T
 * @param callable():T $fn
 * @return T
 */
function hh_tx(callable $fn): mixed
{
    $pdo = hh_db();
    $pdo->beginTransaction();
    try {
        $result = $fn();
        $pdo->commit();
        return $result;
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
}

/** Placeholder list "?, ?, ?" for an IN (...) clause with n values (n >= 1). */
function hh_in(int $n): string
{
    return implode(', ', array_fill(0, max(1, $n), '?'));
}
