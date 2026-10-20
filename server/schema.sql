-- Honeyhollow database schema (MySQL 5.7+ / MariaDB 10.3+).
-- Import this file in phpMyAdmin into the database you created in hPanel.
-- It creates tables only: no CREATE DATABASE, triggers, procedures or DEFINER
-- clauses, so it works on shared hosting. Safe to import again (IF NOT EXISTS).

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS hh_users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(20) NOT NULL,
  username_lc VARCHAR(20) NOT NULL,
  pass_hash VARCHAR(255) NOT NULL,
  recovery_hash VARCHAR(255) NOT NULL,
  avatar VARCHAR(20) NOT NULL DEFAULT 'beekeeper',
  city_name VARCHAR(40) NOT NULL DEFAULT 'Honeyhollow',
  level SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  xp BIGINT UNSIGNED NOT NULL DEFAULT 0,
  week_start DATE NULL,
  week_xp_base BIGINT UNSIGNED NOT NULL DEFAULT 0,
  friend_code CHAR(9) NOT NULL,
  wishlist VARCHAR(255) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL,
  last_seen DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_username (username_lc),
  UNIQUE KEY uq_friend_code (friend_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS hh_sessions (
  token_hash CHAR(64) NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL,
  last_used DATETIME NOT NULL,
  expires_at DATETIME NOT NULL,
  PRIMARY KEY (token_hash),
  KEY idx_sessions_user (user_id),
  KEY idx_sessions_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS hh_saves (
  user_id INT UNSIGNED NOT NULL,
  rev INT UNSIGNED NOT NULL DEFAULT 0,
  data MEDIUMTEXT NOT NULL,
  saved_at BIGINT UNSIGNED NOT NULL,
  level SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  coins BIGINT NOT NULL DEFAULT 0,
  xp BIGINT NOT NULL DEFAULT 0,
  goods BIGINT NOT NULL DEFAULT 0,
  allow_coins BIGINT NOT NULL DEFAULT 0,
  allow_xp BIGINT NOT NULL DEFAULT 0,
  allow_goods BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS hh_friends (
  user_id INT UNSIGNED NOT NULL,
  friend_id INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (user_id, friend_id),
  KEY idx_friends_friend (friend_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS hh_helps (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  helper_id INT UNSIGNED NOT NULL,
  host_id INT UNSIGNED NOT NULL,
  object_id INT UNSIGNED NOT NULL,
  action VARCHAR(12) NOT NULL,
  day DATE NOT NULL,
  status TINYINT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_helps_once (helper_id, host_id, object_id, day),
  KEY idx_helps_host (host_id, status),
  KEY idx_helps_daily (helper_id, host_id, day)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS hh_gifts (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  from_id INT UNSIGNED NOT NULL,
  to_id INT UNSIGNED NOT NULL,
  gift VARCHAR(16) NOT NULL,
  payload VARCHAR(255) NOT NULL DEFAULT '{}',
  day DATE NOT NULL,
  claimed TINYINT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_gifts_daily (from_id, to_id, day),
  KEY idx_gifts_to (to_id, claimed)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS hh_jobs (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  host_id INT UNSIGNED NOT NULL,
  object_id INT UNSIGNED NOT NULL,
  item VARCHAR(24) NOT NULL,
  slots TINYINT UNSIGNED NOT NULL DEFAULT 1,
  closed TINYINT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_jobs_host (host_id, closed)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS hh_job_fills (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  job_id INT UNSIGNED NOT NULL,
  host_id INT UNSIGNED NOT NULL,
  worker_id INT UNSIGNED NOT NULL,
  object_id INT UNSIGNED NOT NULL,
  applied TINYINT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_fills_one (host_id, object_id, worker_id),
  KEY idx_fills_host (host_id, applied),
  KEY idx_fills_job (job_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS hh_franchises (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  owner_id INT UNSIGNED NOT NULL,
  host_id INT UNSIGNED NOT NULL,
  item VARCHAR(24) NOT NULL,
  lot_id INT UNSIGNED NOT NULL,
  stars TINYINT UNSIGNED NOT NULL DEFAULT 0,
  deliveries INT UNSIGNED NOT NULL DEFAULT 0,
  last_supply DATE NULL,
  host_pending INT UNSIGNED NOT NULL DEFAULT 0,
  status TINYINT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL,
  -- only pending/active franchises (status 0/1) hold their lot and shop type;
  -- a declined one (status 2) frees both while its owner sees the refund
  live_lot INT UNSIGNED AS (IF(status < 2, lot_id, NULL)) STORED,
  live_item VARCHAR(24) AS (IF(status < 2, item, NULL)) STORED,
  PRIMARY KEY (id),
  UNIQUE KEY uq_franchise_type (host_id, live_item),
  UNIQUE KEY uq_franchise_lot (host_id, live_lot),
  KEY idx_franchise_owner (owner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS hh_rate (
  bucket VARCHAR(96) NOT NULL,
  window_start INT UNSIGNED NOT NULL,
  hits INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, window_start)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
