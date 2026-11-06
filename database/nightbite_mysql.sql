-- Night Bite MySQL schema
-- Compatible with MySQL 8+ and modern XAMPP MariaDB versions.
-- Import this file in phpMyAdmin. The app will add sample restaurants/packages on first start.

CREATE TABLE IF NOT EXISTS meta (
    key_name VARCHAR(100) NOT NULL PRIMARY KEY,
    value TEXT NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(254) NOT NULL,
    name VARCHAR(60) NOT NULL,
    password_hash VARCHAR(200) NOT NULL,
    notifications TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_users_email (email)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS merchants (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    address VARCHAR(255) NOT NULL,
    area VARCHAR(120) NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS listings (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    merchant_id BIGINT UNSIGNED NOT NULL,
    title VARCHAR(160) NOT NULL,
    category VARCHAR(30) NOT NULL,
    orig_price INT UNSIGNED NOT NULL,
    price INT UNSIGNED NOT NULL,
    is_discounted TINYINT(1) NOT NULL DEFAULT 0,
    initial_qty INT UNSIGNED NOT NULL,
    qty INT UNSIGNED NOT NULL,
    pickup_start CHAR(5) NOT NULL,
    pickup_end CHAR(5) NOT NULL,
    distance_km DECIMAL(7,2) NOT NULL,
    art VARCHAR(40) NOT NULL,
    unit VARCHAR(30) NOT NULL,
    description TEXT NOT NULL,
    contents TEXT NOT NULL,
    allergens TEXT NOT NULL,
    note TEXT NOT NULL,
    map_x INT NOT NULL DEFAULT 50,
    map_y INT NOT NULL DEFAULT 50,
    active TINYINT(1) NOT NULL DEFAULT 1,
    KEY idx_listings_merchant (merchant_id),
    CONSTRAINT fk_listings_merchant FOREIGN KEY (merchant_id) REFERENCES merchants(id)
      ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT chk_listings_price CHECK (orig_price > 0 AND price > 0),
    CONSTRAINT chk_listings_qty CHECK (initial_qty >= 0 AND qty >= 0)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS orders (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    ref VARCHAR(40) NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    listing_id BIGINT UNSIGNED NOT NULL,
    qty INT UNSIGNED NOT NULL,
    unit_price INT UNSIGNED NOT NULL,
    orig_price INT UNSIGNED NOT NULL,
    service_fee INT UNSIGNED NOT NULL,
    total INT UNSIGNED NOT NULL,
    payment_method VARCHAR(30) NOT NULL,
    pickup_code CHAR(4) NOT NULL,
    pickup_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'reserved',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    cancelled_at DATETIME NULL,
    collected_at DATETIME NULL,
    UNIQUE KEY uq_orders_ref (ref),
    KEY idx_orders_user (user_id, created_at),
    KEY idx_orders_listing (listing_id),
    CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id)
      ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_orders_listing FOREIGN KEY (listing_id) REFERENCES listings(id)
      ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT chk_orders_qty CHECK (qty > 0),
    CONSTRAINT chk_orders_status CHECK (status IN ('reserved','collected','cancelled'))
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sessions (
    token_hash CHAR(64) NOT NULL PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at BIGINT NOT NULL,
    KEY idx_sessions_user (user_id),
    KEY idx_sessions_expiry (expires_at),
    CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id)
      ON UPDATE CASCADE ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS partner_users (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(254) NOT NULL,
    name VARCHAR(60) NOT NULL,
    password_hash VARCHAR(200) NOT NULL,
    merchant_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_partner_email (email),
    UNIQUE KEY uq_partner_merchant (merchant_id),
    CONSTRAINT fk_partner_merchant FOREIGN KEY (merchant_id) REFERENCES merchants(id)
      ON UPDATE CASCADE ON DELETE RESTRICT
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS partner_sessions (
    token_hash CHAR(64) NOT NULL PRIMARY KEY,
    partner_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at BIGINT NOT NULL,
    KEY idx_partner_sessions_user (partner_id),
    KEY idx_partner_sessions_expiry (expires_at),
    CONSTRAINT fk_partner_sessions_user FOREIGN KEY (partner_id) REFERENCES partner_users(id)
      ON UPDATE CASCADE ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chats (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    merchant_id BIGINT UNSIGNED NOT NULL,
    listing_id BIGINT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_chat_user_merchant (user_id, merchant_id),
    KEY idx_chats_merchant (merchant_id, updated_at),
    CONSTRAINT fk_chats_user FOREIGN KEY (user_id) REFERENCES users(id)
      ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_chats_merchant FOREIGN KEY (merchant_id) REFERENCES merchants(id)
      ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_chats_listing FOREIGN KEY (listing_id) REFERENCES listings(id)
      ON UPDATE CASCADE ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chat_messages (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    chat_id BIGINT UNSIGNED NOT NULL,
    sender_type VARCHAR(20) NOT NULL,
    sender_id BIGINT UNSIGNED NOT NULL,
    body TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_chat_messages_chat (chat_id, id),
    CONSTRAINT fk_chat_messages_chat FOREIGN KEY (chat_id) REFERENCES chats(id)
      ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT chk_chat_sender CHECK (sender_type IN ('customer','partner'))
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS favorites (
    user_id BIGINT UNSIGNED NOT NULL,
    listing_id BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (user_id, listing_id),
    CONSTRAINT fk_favorites_user FOREIGN KEY (user_id) REFERENCES users(id)
      ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_favorites_listing FOREIGN KEY (listing_id) REFERENCES listings(id)
      ON UPDATE CASCADE ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

