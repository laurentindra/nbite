'use strict';

/* Night Bite MySQL database layer. Uses mysql2/promise and InnoDB transactions. */
const crypto = require('crypto');
const { promisify } = require('util');
const mysql = require('mysql2/promise');

const scrypt = promisify(crypto.scrypt);
const TZ = process.env.NB_TZ || 'Asia/Jakarta';
const connectionUrl = process.env.DATABASE_URL || process.env.MYSQL_URL ? new URL(process.env.DATABASE_URL || process.env.MYSQL_URL) : null;

// Supports XAMPP DB_* variables, Railway MYSQL* variables, and a MySQL DATABASE_URL.
const poolOptions = {
  host: process.env.DB_HOST || process.env.MYSQLHOST || connectionUrl?.hostname || '127.0.0.1',
  port: Number(process.env.DB_PORT || process.env.MYSQLPORT || connectionUrl?.port || 3306),
  user: process.env.DB_USER || process.env.MYSQLUSER || (connectionUrl ? decodeURIComponent(connectionUrl.username) : 'root'),
  password: process.env.DB_PASSWORD ?? process.env.MYSQLPASSWORD ?? (connectionUrl ? decodeURIComponent(connectionUrl.password) : ''),
  database: process.env.DB_NAME || process.env.MYSQLDATABASE || (connectionUrl ? connectionUrl.pathname.replace(/^\//, '') : 'nightbite'),
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
  queueLimit: 0,
  charset: 'utf8mb4',
  timezone: 'Z',
  decimalNumbers: true,
  dateStrings: true,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
};
if (process.env.DB_SSL === '1') poolOptions.ssl = { rejectUnauthorized: true };
const pool = mysql.createPool(poolOptions);

// Keep DDL statements separate so this works with XAMPP/MariaDB and hosted MySQL.
const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS meta (
    key_name VARCHAR(100) NOT NULL PRIMARY KEY,
    value TEXT NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS users (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(254) NOT NULL,
    name VARCHAR(60) NOT NULL,
    password_hash VARCHAR(200) NOT NULL,
    notifications TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_users_email (email)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS merchants (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    address VARCHAR(255) NOT NULL,
    area VARCHAR(120) NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS listings (
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
    photo_url VARCHAR(255) NULL,
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
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS orders (
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
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token_hash CHAR(64) NOT NULL PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at BIGINT NOT NULL,
    KEY idx_sessions_user (user_id),
    KEY idx_sessions_expiry (expires_at),
    CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id)
      ON UPDATE CASCADE ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS partner_users (
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
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS partner_sessions (
    token_hash CHAR(64) NOT NULL PRIMARY KEY,
    partner_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at BIGINT NOT NULL,
    KEY idx_partner_sessions_user (partner_id),
    KEY idx_partner_sessions_expiry (expires_at),
    CONSTRAINT fk_partner_sessions_user FOREIGN KEY (partner_id) REFERENCES partner_users(id)
      ON UPDATE CASCADE ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS chats (
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
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS chat_messages (
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
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS favorites (
    user_id BIGINT UNSIGNED NOT NULL,
    listing_id BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (user_id, listing_id),
    CONSTRAINT fk_favorites_user FOREIGN KEY (user_id) REFERENCES users(id)
      ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_favorites_listing FOREIGN KEY (listing_id) REFERENCES listings(id)
      ON UPDATE CASCADE ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
];

function makeDbApi(executor) {
  return {
    async all(sql, params = []) {
      const [rows] = await executor.execute(sql, params);
      return rows;
    },
    async get(sql, params = []) {
      const [rows] = await executor.execute(sql, params);
      return rows[0] || null;
    },
    async run(sql, params = []) {
      const [result] = await executor.execute(sql, params);
      return result;
    }
  };
}

const db = makeDbApi(pool);
db.transaction = async function transaction(callback) {
  const connection = await pool.getConnection();
  const tx = makeDbApi(connection);
  try {
    await connection.beginTransaction();
    const result = await callback(tx);
    await connection.commit();
    return result;
  } catch (error) {
    try { await connection.rollback(); } catch {}
    throw error;
  } finally {
    connection.release();
  }
};
db.close = () => pool.end();

/* ---------- time helpers (pickup windows are in the store's local time zone) ---------- */
function nowParts() {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const p = Object.fromEntries(f.formatToParts(new Date()).map(x => [x.type, x.value]));
  let mins = Number(p.hour) * 60 + Number(p.minute);
  if (process.env.NB_FAKE_TIME) {
    const [h, m] = process.env.NB_FAKE_TIME.split(':').map(Number);
    mins = h * 60 + m;
  }
  return { date: `${p.year}-${p.month}-${p.day}`, mins };
}
const toMins = t => {
  const [h, m] = String(t).split(':');
  return Number(h) * 60 + Number(m);
};

/* ---------- passwords ---------- */
async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}
async function verifyPassword(password, stored) {
  const [saltHex, hashHex] = String(stored).split(':');
  if (!saltHex || !hashHex) return false;
  const hash = await scrypt(password, Buffer.from(saltHex, 'hex'), 64);
  const expected = Buffer.from(hashHex, 'hex');
  return hash.length === expected.length && crypto.timingSafeEqual(hash, expected);
}

/* ---------- sample merchants and listings ---------- */
async function seed() {
  const existing = await db.get('SELECT COUNT(*) AS n FROM merchants');
  if (Number(existing.n) > 0) return;

  const merchants = [
    ['Roti & Cerita', 'Jl. Margonda Raya No. 214, Beji, Depok', 'Beji, Depok'],
    ['Kopi Sudut', 'Jl. Margonda Raya No. 88, Pondok Cina, Depok', 'Pondok Cina, Depok'],
    ['Dapur Kampus', 'Jl. Kukusan Teknik No. 12, Kukusan, Depok', 'Kukusan, Depok'],
    ['Warung Bu Lastri', 'Gang Kelinci No. 5, Beji, Depok', 'Beji, Depok'],
    ['Seduh & Senja', 'Jl. Akses UI No. 31, Tanah Baru, Depok', 'Tanah Baru, Depok'],
    ['Bakmi Gang Kelinci', 'Jl. Kelinci No. 9, Beji Timur, Depok', 'Beji Timur, Depok'],
    ['Pagi Pagi Bakehouse', 'Jl. Raya Bogor No. 140, Cimanggis, Depok', 'Cimanggis, Depok'],
    ['Martabak Malam Sari', 'Jl. Margonda Raya No. 301, Kemiri Muka, Depok', 'Kemiri Muka, Depok'],
    ['Nasi Goreng Pak Dedi', 'Jl. Kukusan Raya No. 45, Kukusan, Depok', 'Kukusan, Depok']
  ];
  await db.transaction(async tx => {
    const merchantIds = [];
    for (const merchant of merchants) {
      const result = await tx.run('INSERT INTO merchants (name,address,area) VALUES (?,?,?)', merchant);
      merchantIds.push(result.insertId);
    }

    // merchant index, title, category, regular price, default promo price, qty, pickup start/end,
    // distance, illustration key, unit, description, contents, allergens, note, map x/y.
    const listings = [
      [0, 'Surprise Bakery Bag', 'Bakery', 35000, 15000, 4, '19:00', '20:00', 0.6, 'bakery', 'bags', 'A mixed bag of the day’s unsold breads and pastries from Roti & Cerita.', 'Contents vary each evening and depend on what is left. The store does not promise specific items.', 'Bakery items may contain wheat, milk, egg, soy and nuts. Ask the counter for the day’s ingredient list.', 'Show your pickup code at the counter. Bring a bag if you can.', 34, 42],
      [1, 'Pastry Bundle', 'Café', 40000, 18000, 3, '18:30', '20:00', 0.9, 'bundle', 'bundles', 'Three to four pastries from the day’s café display, packed together.', 'Usually a mix of danish, donut and cake. Exact items vary and are chosen by the café.', 'Contains wheat, milk and egg. May contain nuts.', 'Collect at the register, not the table service counter.', 62, 26],
      [2, 'Rice Meal Package', 'Meals', 30000, 20000, 5, '19:00', '20:30', 1.2, 'meal', 'packages', 'One portion of rice with the day’s main dish and a side.', 'Rice, one protein and one vegetable side. The main dish changes daily.', 'May contain soy, egg, peanuts and shellfish paste. Ask the vendor for the day’s menu.', 'Eat the same evening. Reheat thoroughly before eating if you wait.', 22, 70],
      [3, 'Gorengan Box', 'Snacks', 24000, 12000, 6, '20:00', '21:00', 0.4, 'snack', 'boxes', 'A box of fried snacks with chili on the side.', 'Assorted fritters from the evening batch. Varieties change.', 'Fried in vegetable oil. Contains wheat flour. May contain shrimp.', 'Best eaten within two hours of pickup.', 48, 58],
      [4, 'Cake Slice Duo', 'Café', 46000, 22000, 2, '21:00', '22:30', 2.1, 'cafe', 'duos', 'Two slices of cake from the day’s display.', 'Two slices chosen by the café. Flavours vary.', 'Contains wheat, milk and egg. May contain nuts and gelatin.', 'Keep chilled if you are not eating within two hours.', 78, 64],
      [5, 'Noodle Combo', 'Meals', 28000, 16000, 5, '21:30', '23:00', 1.5, 'noodle', 'combos', 'A bowl of noodles with toppings, packed to go.', 'Noodles with chicken or mushroom topping, depending on what is left.', 'Contains wheat, soy and egg. May contain fish sauce.', 'Broth is packed separately. Eat tonight.', 70, 84],
      [6, 'Sourdough Loaf Box', 'Bakery', 38000, 17000, 2, '18:00', '19:00', 1.8, 'loaf', 'boxes', 'A loaf and a small pastry from the afternoon bake.', 'One sourdough loaf and one small pastry. Pastry type varies.', 'Contains wheat. May contain sesame, milk and nuts.', 'Pickup closes sharp at the end of the window.', 16, 20],
      [7, 'Martabak Mini Box', 'Snacks', 36000, 18000, 4, '21:30', '23:30', 0.8, 'bakery', 'boxes', 'Sweet mini martabak cut into pieces, from the evening stall.', 'Chocolate, cheese or peanut filling depending on what is left over.', 'Contains wheat, milk, egg and peanuts. May contain soy.', 'Eat warm. Reheat in a pan, not a microwave, for best texture.', 55, 14],
      [8, 'Nasi Goreng Portion', 'Meals', 25000, 14000, 5, '22:00', '23:30', 1.3, 'meal', 'portions', 'One portion of fried rice with egg and crackers.', 'Fried rice with a fried egg and crackers. Extras vary.', 'Contains egg, soy and shrimp paste. May contain peanuts.', 'Eat tonight and keep it cool if you will not eat right away.', 38, 82]
    ];
    for (const item of listings) {
      const merchantId = merchantIds[item[0]];
      const values = [merchantId, ...item.slice(1, 5), item[5], item[5], ...item.slice(6)];
      await tx.run(
        `INSERT INTO listings (merchant_id,title,category,orig_price,price,initial_qty,qty,pickup_start,pickup_end,distance_km,art,unit,description,contents,allergens,note,map_x,map_y)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        values
      );
    }
  });
}

async function initializeDatabase() {
  for (const statement of schemaStatements) await pool.query(statement);
  // Backward-compatible migration for databases created before food photo uploads.
  try { await pool.query('ALTER TABLE listings ADD COLUMN photo_url VARCHAR(255) NULL'); }
  catch (error) { if (error.code !== 'ER_DUP_FIELDNAME') throw error; }
  await seed();
  await ensureDailyStock();
}

/* Surplus stock is per day. A transaction locks the date marker so app instances do not race. */
async function ensureDailyStock() {
  const today = nowParts().date;
  const marker = await db.get("SELECT value FROM meta WHERE key_name='stock_date'");
  if (marker && marker.value === today) return;
  await db.transaction(async tx => {
    await tx.run("INSERT IGNORE INTO meta (key_name,value) VALUES ('stock_date','')");
    const row = await tx.get("SELECT value FROM meta WHERE key_name='stock_date' FOR UPDATE");
    if (row && row.value === today) return;
    await tx.run('UPDATE listings SET qty = initial_qty');
    await tx.run("UPDATE meta SET value=? WHERE key_name='stock_date'", [today]);
  });
}

async function cleanSessions() {
  const now = Date.now();
  await db.run('DELETE FROM sessions WHERE expires_at < ?', [now]);
  await db.run('DELETE FROM partner_sessions WHERE expires_at < ?', [now]);
}

module.exports = { db, pool, initializeDatabase, nowParts, toMins, hashPassword, verifyPassword, ensureDailyStock, cleanSessions, TZ };
