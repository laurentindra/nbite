'use strict';
require('dotenv').config();
/* Night Bite web server. Node.js HTTP server + MySQL database. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  db, nowParts, toMins, hashPassword, verifyPassword,
  initializeDatabase, ensureDailyStock, cleanSessions
} = require('./db');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC = path.join(__dirname, 'public');
const SESSION_DAYS = 30;
const COOKIE = 'nb_session';
const PARTNER_COOKIE = 'nb_partner_session';
const SERVICE_FEE = 1000;
const MAX_QTY = 5;
const CANCEL_CUTOFF_MIN = 60;
const ADMIN_KEY = process.env.NB_ADMIN_KEY || '';

/* ---------- helpers ---------- */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
class HttpError extends Error {
  constructor(status, message, extra = {}) { super(message); this.status = status; this.extra = extra; }
}
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const json = (res, status, body, headers = {}) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify(body));
};
function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach(part => {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}
const isSecure = req => process.env.NB_SECURE === '1' || req.headers['x-forwarded-proto'] === 'https';
function setSessionCookie(req, token, maxAge, name = COOKIE) {
  return `${name}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${isSecure(req) ? '; Secure' : ''}`;
}
async function readBody(req) {
  const chunks = []; let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 6000000) throw new HttpError(413, 'Request too large.');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    return body && typeof body === 'object' ? body : {};
  } catch { throw new HttpError(400, 'Invalid JSON.'); }
}
const str = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

/* simple in-memory rate limit for login and registration */
const hits = new Map();
function rateLimit(key, max, windowMs) {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter(time => now - time < windowMs);
  if (arr.length >= max) throw new HttpError(429, 'Too many attempts. Please wait a few minutes and try again.');
  arr.push(now);
  hits.set(key, arr);
}
setInterval(() => {
  const now = Date.now();
  for (const [key, values] of hits) if (!values.some(time => now - time < 900000)) hits.delete(key);
  cleanSessions().catch(error => console.error('Session cleanup failed:', error.message));
}, 600000).unref();

/* ---------- data mapping ---------- */
const LISTING_SQL = `SELECT l.*, m.name AS merchant, m.address, m.area FROM listings l JOIN merchants m ON m.id = l.merchant_id`;
function listingOut(row, now) {
  const status = row.qty <= 0 ? 'sold' : now.mins >= toMins(row.pickup_end) ? 'expired' : 'active';
  const discounted = !!row.is_discounted;
  return {
    id: Number(row.id), merchantId: Number(row.merchant_id), m: row.merchant, t: row.title,
    cat: row.category, o: Number(row.orig_price), p: discounted ? Number(row.price) : Number(row.orig_price),
    discounted, q: Number(row.qty), initialQty: Number(row.initial_qty), s: row.pickup_start,
    e: row.pickup_end, d: Number(row.distance_km), art: row.art, unit: row.unit,
    area: row.area, addr: row.address, x: Number(row.map_x), y: Number(row.map_y),
    desc: row.description, inside: row.contents, allergen: row.allergens, note: row.note,
    photo: row.photo_url || null,
    status, minsLeft: toMins(row.pickup_end) - now.mins
  };
}
const ORDER_SQL = `SELECT o.*, l.title, l.pickup_start, l.pickup_end, l.art, m.name AS merchant, m.address
  FROM orders o JOIN listings l ON l.id = o.listing_id JOIN merchants m ON m.id = l.merchant_id`;
function dayLabel(date, today) {
  const dateString = String(date).slice(0, 10);
  if (dateString === today) return 'Today';
  const [year, month, day] = dateString.split('-').map(Number);
  return `${day} ${MONTHS[month - 1]}`;
}
function orderOut(row, now) {
  const pickupDate = String(row.pickup_date).slice(0, 10);
  const windowOver = pickupDate < now.date || (pickupDate === now.date && now.mins >= toMins(row.pickup_end));
  const upcoming = row.status === 'reserved' && !windowOver;
  const missed = row.status === 'reserved' && windowOver;
  const startMins = toMins(row.pickup_start);
  const canCancel = upcoming && (pickupDate > now.date || now.mins <= startMins - CANCEL_CUTOFF_MIN);
  return {
    ref: row.ref, lid: Number(row.listing_id), m: row.merchant, t: row.title, addr: row.address,
    qty: Number(row.qty), total: Number(row.total),
    saved: (Number(row.orig_price) - Number(row.unit_price)) * Number(row.qty),
    code: row.pickup_code, pay: row.payment_method,
    st: row.status === 'collected' ? 'Completed' : upcoming ? 'Upcoming' : 'Cancelled', missed,
    win: `${row.pickup_start}–${row.pickup_end}`, day: dayLabel(pickupDate, now.date), art: row.art,
    canCancel, cancelNote: upcoming && !canCancel ? 'Cancellation closed. Pickup starts within 1 hour.' : ''
  };
}
const userOut = user => ({ id: Number(user.id), name: user.name, email: user.email, notifications: !!user.notifications });
async function favIds(userId) {
  return (await db.all('SELECT listing_id FROM favorites WHERE user_id = ?', [userId])).map(row => Number(row.listing_id));
}

/* ---------- auth ---------- */
async function createSession(req, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  await db.run('INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (?,?,?)', [sha(token), userId, Date.now() + SESSION_DAYS * 86400000]);
  return setSessionCookie(req, token, SESSION_DAYS * 86400);
}
async function getUser(req) {
  const token = parseCookies(req)[COOKIE];
  if (!token) return null;
  return await db.get(
    'SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?',
    [sha(token), Date.now()]
  );
}
async function createPartnerSession(req, partnerId) {
  const token = crypto.randomBytes(32).toString('base64url');
  await db.run('INSERT INTO partner_sessions (token_hash,partner_id,expires_at) VALUES (?,?,?)', [sha(token), partnerId, Date.now() + SESSION_DAYS * 86400000]);
  return setSessionCookie(req, token, SESSION_DAYS * 86400, PARTNER_COOKIE);
}
async function getPartner(req) {
  const token = parseCookies(req)[PARTNER_COOKIE];
  if (!token) return null;
  return await db.get(
    `SELECT p.*, m.name AS merchant_name, m.address AS merchant_address, m.area AS merchant_area
     FROM partner_sessions s JOIN partner_users p ON p.id=s.partner_id
     JOIN merchants m ON m.id=p.merchant_id WHERE s.token_hash=? AND s.expires_at>?`,
    [sha(token), Date.now()]
  );
}
const need = ctx => {
  if (!ctx.user) throw new HttpError(401, 'Please log in to continue.', { code: 'auth' });
  return ctx.user;
};
const partnerNeed = ctx => {
  if (!ctx.partner) throw new HttpError(401, 'Please log in with a Food Partner account.', { code: 'partner_auth' });
  return ctx.partner;
};
const partnerOut = partner => ({
  id: Number(partner.id), name: partner.name, email: partner.email,
  merchantId: Number(partner.merchant_id), merchant: partner.merchant_name,
  address: partner.merchant_address, area: partner.merchant_area
});
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/;
const DUMMY_HASH = '00000000000000000000000000000000:' + '0'.repeat(128);

/* ---------- routes ---------- */
const routes = [];
const route = (method, pattern, handler) => routes.push([method, new RegExp('^' + pattern + '$'), handler]);

route('GET', '/api/me', async ctx => {
  const user = ctx.user;
  return { user: user ? userOut(user) : null, favs: user ? await favIds(user.id) : [] };
});

route('POST', '/api/register', async ctx => {
  rateLimit('reg:' + ctx.ip, 10, 3600000);
  const name = str(ctx.body.name, 60);
  const email = str(ctx.body.email, 254).toLowerCase();
  const password = typeof ctx.body.password === 'string' ? ctx.body.password : '';
  const errors = {};
  if (name.length < 2) errors.name = 'Enter your name (at least 2 characters).';
  if (!EMAIL_RE.test(email)) errors.email = 'Enter a valid email address.';
  if (password.length < 8) errors.password = 'Use at least 8 characters.';
  else if (password.length > 128) errors.password = 'Use at most 128 characters.';
  if (Object.keys(errors).length) throw new HttpError(422, 'Please fix the highlighted fields.', { errors });
  if (await db.get('SELECT 1 FROM users WHERE email = ?', [email])) {
    throw new HttpError(409, 'An account with this email already exists.', { errors: { email: 'An account with this email already exists. Try logging in.' } });
  }
  const hash = await hashPassword(password);
  const result = await db.run('INSERT INTO users (email,name,password_hash) VALUES (?,?,?)', [email, name, hash]);
  const userId = Number(result.insertId);
  const cookie = await createSession(ctx.req, userId);
  const user = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
  return { status: 201, headers: { 'Set-Cookie': cookie }, body: { user: userOut(user), favs: [] } };
});

route('POST', '/api/login', async ctx => {
  rateLimit('login:' + ctx.ip, 15, 600000);
  const email = str(ctx.body.email, 254).toLowerCase();
  const password = typeof ctx.body.password === 'string' ? ctx.body.password.slice(0, 128) : '';
  const user = EMAIL_RE.test(email) ? await db.get('SELECT * FROM users WHERE email = ?', [email]) : null;
  const ok = await verifyPassword(password, user ? user.password_hash : DUMMY_HASH).catch(() => false);
  if (!user || !ok) throw new HttpError(401, 'Email or password is incorrect.');
  const cookie = await createSession(ctx.req, user.id);
  return { headers: { 'Set-Cookie': cookie }, body: { user: userOut(user), favs: await favIds(user.id) } };
});

route('POST', '/api/logout', async ctx => {
  const token = parseCookies(ctx.req)[COOKIE];
  if (token) await db.run('DELETE FROM sessions WHERE token_hash = ?', [sha(token)]);
  return { headers: { 'Set-Cookie': setSessionCookie(ctx.req, '', 0) }, body: { ok: true } };
});

route('PATCH', '/api/me', async ctx => {
  const user = need(ctx);
  if (ctx.body.name !== undefined) {
    const name = str(ctx.body.name, 60);
    if (name.length < 2) throw new HttpError(422, 'Enter your name (at least 2 characters).');
    await db.run('UPDATE users SET name = ? WHERE id = ?', [name, user.id]);
  }
  if (ctx.body.notifications !== undefined) {
    await db.run('UPDATE users SET notifications = ? WHERE id = ?', [ctx.body.notifications ? 1 : 0, user.id]);
  }
  return { user: userOut(await db.get('SELECT * FROM users WHERE id = ?', [user.id])) };
});

route('GET', '/api/merchants', async () => ({ merchants: await db.all('SELECT id,name,area FROM merchants ORDER BY name') }));

route('POST', '/api/partner/register', async ctx => {
  rateLimit('partner-reg:' + ctx.ip, 8, 3600000);
  const name = str(ctx.body.name, 60);
  const email = str(ctx.body.email, 254).toLowerCase();
  const password = typeof ctx.body.password === 'string' ? ctx.body.password : '';
  const storeName = str(ctx.body.storeName, 120);
  const address = str(ctx.body.address, 255);
  const area = str(ctx.body.area, 120);
  const errors = {};
  if (name.length < 2) errors.name = 'Enter your full name.';
  if (!EMAIL_RE.test(email)) errors.email = 'Enter a valid email address.';
  if (password.length < 8 || password.length > 128) errors.password = 'Use a password between 8 and 128 characters.';
  if (storeName.length < 2) errors.storeName = 'Enter your store name.';
  if (address.length < 5) errors.address = 'Enter the complete store address.';
  if (area.length < 2) errors.area = 'Enter the store area or district.';
  if (Object.keys(errors).length) throw new HttpError(422, 'Please check the highlighted fields.', { errors });
  if (await db.get('SELECT 1 FROM partner_users WHERE email=?', [email])) {
    throw new HttpError(409, 'An account with this email already exists.', { errors: { email: 'This email is already registered.' } });
  }
  const hash = await hashPassword(password);
  const partnerId = await db.transaction(async tx => {
    const merchant = await tx.run('INSERT INTO merchants (name,address,area) VALUES (?,?,?)', [storeName, address, area]);
    const result = await tx.run('INSERT INTO partner_users (email,name,password_hash,merchant_id) VALUES (?,?,?,?)', [email, name, hash, merchant.insertId]);
    return Number(result.insertId);
  });
  const partner = await db.get(
    `SELECT p.*,m.name AS merchant_name,m.address AS merchant_address,m.area AS merchant_area
     FROM partner_users p JOIN merchants m ON m.id=p.merchant_id WHERE p.id=?`, [partnerId]
  );
  return { status: 201, headers: { 'Set-Cookie': await createPartnerSession(ctx.req, partnerId) }, body: { partner: partnerOut(partner) } };
});

route('POST', '/api/partner/login', async ctx => {
  rateLimit('partner-login:' + ctx.ip, 15, 600000);
  const email = str(ctx.body.email, 254).toLowerCase();
  const password = typeof ctx.body.password === 'string' ? ctx.body.password.slice(0, 128) : '';
  const partner = EMAIL_RE.test(email) ? await db.get(
    `SELECT p.*,m.name AS merchant_name,m.address AS merchant_address,m.area AS merchant_area
     FROM partner_users p JOIN merchants m ON m.id=p.merchant_id WHERE p.email=?`, [email]
  ) : null;
  const ok = await verifyPassword(password, partner ? partner.password_hash : DUMMY_HASH).catch(() => false);
  if (!partner || !ok) throw new HttpError(401, 'Email or password is incorrect.');
  return { headers: { 'Set-Cookie': await createPartnerSession(ctx.req, partner.id) }, body: { partner: partnerOut(partner) } };
});

route('GET', '/api/partner/me', async ctx => {
  const partner = partnerNeed(ctx);
  const row = await db.get(
    `SELECT p.*,m.name AS merchant_name,m.address AS merchant_address,m.area AS merchant_area
     FROM partner_users p JOIN merchants m ON m.id=p.merchant_id WHERE p.id=?`, [partner.id]
  );
  return { partner: partnerOut(row) };
});

route('POST', '/api/partner/logout', async ctx => {
  const token = parseCookies(ctx.req)[PARTNER_COOKIE];
  if (token) await db.run('DELETE FROM partner_sessions WHERE token_hash=?', [sha(token)]);
  return { headers: { 'Set-Cookie': setSessionCookie(ctx.req, '', 0, PARTNER_COOKIE) }, body: { ok: true } };
});

route('GET', '/api/partner/listings', async ctx => {
  const partner = partnerNeed(ctx);
  const now = nowParts();
  const rows = await db.all(LISTING_SQL + ' WHERE l.merchant_id=? ORDER BY l.id', [partner.merchant_id]);
  return { listings: rows.map(row => listingOut(row, now)) };
});

route('POST', '/api/partner/listings', async ctx => {
  const partner = partnerNeed(ctx);
  const title = str(ctx.body.title, 160);
  const category = str(ctx.body.category, 30) || 'Other';
  const price = Number(ctx.body.price);
  const quantity = Number(ctx.body.quantity);
  const pickupStart = str(ctx.body.pickupStart, 5) || '18:00';
  const pickupEnd = str(ctx.body.pickupEnd, 5) || '21:00';
  const description = str(ctx.body.description, 1000);
  let photoUrl = null;
  if (ctx.body.photo) {
    const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+=*)$/.exec(ctx.body.photo);
    if (!match) throw new HttpError(422, 'Choose a valid JPG, PNG, or WEBP photo.');
    const image = Buffer.from(match[2], 'base64');
    if (!image.length || image.length > 4 * 1024 * 1024) throw new HttpError(422, 'Photo must be 4 MB or smaller.');
    const signatures = { jpeg: image.subarray(0,3).equals(Buffer.from([0xff,0xd8,0xff])), png: image.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])), webp: image.length >= 12 && image.toString('ascii',0,4)==='RIFF' && image.toString('ascii',8,12)==='WEBP' };
    if (!signatures[match[1]]) throw new HttpError(422, 'The uploaded file is not a valid image.');
    const uploadDir = path.join(PUBLIC, 'uploads');
    await fs.promises.mkdir(uploadDir, { recursive: true });
    const filename = `${crypto.randomBytes(16).toString('hex')}.${match[1] === 'jpeg' ? 'jpg' : match[1]}`;
    await fs.promises.writeFile(path.join(uploadDir, filename), image, { flag: 'wx' });
    photoUrl = `/uploads/${filename}`;
  }
  if (title.length < 2 || !Number.isInteger(price) || price < 100 || price > 10000000 || !Number.isInteger(quantity) || quantity < 0 || quantity > 500) {
    throw new HttpError(422, 'Enter a package name, valid price, and quantity between 0 and 500.');
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(pickupStart) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(pickupEnd) || toMins(pickupEnd) <= toMins(pickupStart)) {
    throw new HttpError(422, 'Enter a valid pickup time range.');
  }
  const result = await db.run(
    `INSERT INTO listings (merchant_id,title,category,orig_price,price,is_discounted,initial_qty,qty,pickup_start,pickup_end,distance_km,art,photo_url,unit,description,contents,allergens,note,map_x,map_y,active)
     VALUES (?,?,?,?,?,0,?,?,?,?,0,'meal',?,'packages',?,?, '', '',50,50,1)`,
    [partner.merchant_id,title,category,price,price,quantity,quantity,pickupStart,pickupEnd,photoUrl,description || 'Prepared fresh by the store. Contents may vary.',description || title]
  );
  const row = await db.get(LISTING_SQL + ' WHERE l.id=? AND l.merchant_id=?', [result.insertId,partner.merchant_id]);
  return { status: 201, body: { listing: listingOut(row,nowParts()) } };
});

route('PATCH', '/api/partner/listings/(\\d+)', async ctx => {
  const partner = partnerNeed(ctx);
  const id = Number(ctx.params[0]);
  const current = await db.get('SELECT * FROM listings WHERE id=? AND merchant_id=?', [id, partner.merchant_id]);
  if (!current) throw new HttpError(404, 'Package not found in your store.');
  const discounted = ctx.body.discounted === undefined ? !!current.is_discounted : !!ctx.body.discounted;
  const originalPrice = ctx.body.originalPrice === undefined ? Number(current.orig_price) : Number(ctx.body.originalPrice);
  const salePrice = ctx.body.price === undefined ? Number(current.price) : Number(ctx.body.price);
  if (!Number.isInteger(originalPrice) || originalPrice < 100 || originalPrice > 10000000) throw new HttpError(422, 'Enter a valid regular price.');
  if (discounted && (!Number.isInteger(salePrice) || salePrice < 100 || salePrice >= originalPrice)) {
    throw new HttpError(422, 'Promo price must be at least Rp100 and lower than the regular price.');
  }
  let initial = Number(current.initial_qty);
  let quantity = Number(current.qty);
  if (ctx.body.quantity !== undefined) {
    const next = Number(ctx.body.quantity);
    if (!Number.isInteger(next) || next < 0 || next > 500) throw new HttpError(422, 'Quantity must be between 0 and 500.');
    const sold = Math.max(0, initial - quantity);
    initial = next;
    quantity = Math.max(0, next - sold);
  }
  await db.run(
    'UPDATE listings SET orig_price=?,price=?,is_discounted=?,initial_qty=?,qty=? WHERE id=? AND merchant_id=?',
    [originalPrice, discounted ? salePrice : Math.min(Number(current.price), originalPrice - 1), discounted ? 1 : 0, initial, quantity, id, partner.merchant_id]
  );
  const row = await db.get(LISTING_SQL + ' WHERE l.id=? AND l.merchant_id=?', [id, partner.merchant_id]);
  return { listing: listingOut(row, nowParts()) };
});

async function chatMessages(chatId) {
  return db.all(
    'SELECT id,sender_type AS senderType,sender_id AS senderId,body,created_at AS createdAt FROM chat_messages WHERE chat_id=? ORDER BY id',
    [chatId]
  );
}
function chatOut(row) {
  return {
    id: Number(row.id), merchantId: Number(row.merchant_id), merchant: row.merchant,
    area: row.area, listingId: row.listing_id === null ? null : Number(row.listing_id),
    listing: row.listing_title || null, updatedAt: row.updated_at, lastMessage: row.last_message || ''
  };
}

route('GET', '/api/chats', async ctx => {
  const user = need(ctx);
  const rows = await db.all(
    `SELECT c.*,m.name AS merchant,m.area,l.title AS listing_title,
      (SELECT body FROM chat_messages cm WHERE cm.chat_id=c.id ORDER BY cm.id DESC LIMIT 1) AS last_message
     FROM chats c JOIN merchants m ON m.id=c.merchant_id LEFT JOIN listings l ON l.id=c.listing_id
     WHERE c.user_id=? ORDER BY c.updated_at DESC,c.id DESC`, [user.id]
  );
  return { chats: rows.map(chatOut) };
});

route('POST', '/api/chats', async ctx => {
  const user = need(ctx);
  const merchantId = Number(ctx.body.merchantId);
  const listingId = ctx.body.listingId === undefined ? null : Number(ctx.body.listingId);
  if (!Number.isInteger(merchantId) || !await db.get('SELECT 1 FROM merchants WHERE id=?', [merchantId])) throw new HttpError(404, 'Store not found.');
  if (listingId !== null && (!Number.isInteger(listingId) || !await db.get('SELECT 1 FROM listings WHERE id=? AND merchant_id=?', [listingId, merchantId]))) {
    throw new HttpError(422, 'This package does not belong to the selected store.');
  }
  await db.run(
    `INSERT INTO chats (user_id,merchant_id,listing_id) VALUES (?,?,?)
     ON DUPLICATE KEY UPDATE listing_id=COALESCE(chats.listing_id, VALUES(listing_id))`,
    [user.id, merchantId, listingId]
  );
  const row = await db.get('SELECT id FROM chats WHERE user_id=? AND merchant_id=?', [user.id, merchantId]);
  return { chatId: Number(row.id) };
});

route('GET', '/api/chats/(\\d+)', async ctx => {
  const user = need(ctx);
  const id = Number(ctx.params[0]);
  const row = await db.get(
    `SELECT c.*,m.name AS merchant,m.area,l.title AS listing_title
     FROM chats c JOIN merchants m ON m.id=c.merchant_id LEFT JOIN listings l ON l.id=c.listing_id
     WHERE c.id=? AND c.user_id=?`, [id, user.id]
  );
  if (!row) throw new HttpError(404, 'Conversation not found.');
  return { chat: chatOut(row), messages: await chatMessages(id) };
});

route('POST', '/api/chats/(\\d+)/messages', async ctx => {
  const user = need(ctx);
  const id = Number(ctx.params[0]);
  const body = str(ctx.body.message, 1000);
  if (!body) throw new HttpError(422, 'Write a message first.');
  if (!await db.get('SELECT 1 FROM chats WHERE id=? AND user_id=?', [id, user.id])) throw new HttpError(404, 'Conversation not found.');
  await db.run("INSERT INTO chat_messages (chat_id,sender_type,sender_id,body) VALUES (?,'customer',?,?)", [id, user.id, body]);
  await db.run('UPDATE chats SET updated_at=CURRENT_TIMESTAMP WHERE id=?', [id]);
  return { messages: await chatMessages(id) };
});

route('GET', '/api/partner/chats', async ctx => {
  const partner = partnerNeed(ctx);
  const rows = await db.all(
    `SELECT c.*,u.name AS customer_name,m.name AS merchant,m.area,l.title AS listing_title,
      (SELECT body FROM chat_messages cm WHERE cm.chat_id=c.id ORDER BY cm.id DESC LIMIT 1) AS last_message
     FROM chats c JOIN users u ON u.id=c.user_id JOIN merchants m ON m.id=c.merchant_id
     LEFT JOIN listings l ON l.id=c.listing_id WHERE c.merchant_id=?
     ORDER BY c.updated_at DESC,c.id DESC`, [partner.merchant_id]
  );
  return { chats: rows.map(row => ({ ...chatOut(row), customer: row.customer_name })) };
});

route('GET', '/api/partner/chats/(\\d+)', async ctx => {
  const partner = partnerNeed(ctx);
  const id = Number(ctx.params[0]);
  const row = await db.get(
    `SELECT c.*,u.name AS customer_name,m.name AS merchant,m.area,l.title AS listing_title
     FROM chats c JOIN users u ON u.id=c.user_id JOIN merchants m ON m.id=c.merchant_id
     LEFT JOIN listings l ON l.id=c.listing_id WHERE c.id=? AND c.merchant_id=?`,
    [id, partner.merchant_id]
  );
  if (!row) throw new HttpError(404, 'Conversation not found.');
  return { chat: { ...chatOut(row), customer: row.customer_name }, messages: await chatMessages(id) };
});

route('POST', '/api/partner/chats/(\\d+)/messages', async ctx => {
  const partner = partnerNeed(ctx);
  const id = Number(ctx.params[0]);
  const body = str(ctx.body.message, 1000);
  if (!body) throw new HttpError(422, 'Write a message first.');
  if (!await db.get('SELECT 1 FROM chats WHERE id=? AND merchant_id=?', [id, partner.merchant_id])) throw new HttpError(404, 'Conversation not found.');
  await db.run("INSERT INTO chat_messages (chat_id,sender_type,sender_id,body) VALUES (?,'partner',?,?)", [id, partner.id, body]);
  await db.run('UPDATE chats SET updated_at=CURRENT_TIMESTAMP WHERE id=?', [id]);
  return { messages: await chatMessages(id) };
});

route('GET', '/api/listings', async () => {
  const now = nowParts();
  const rows = await db.all(LISTING_SQL + ' WHERE l.active = 1 ORDER BY l.id');
  return { listings: rows.map(row => listingOut(row, now)) };
});

route('POST', '/api/favorites/(\\d+)', async ctx => {
  const user = need(ctx);
  const id = Number(ctx.params[0]);
  if (!await db.get('SELECT 1 FROM listings WHERE id=?', [id])) throw new HttpError(404, 'Deal not found.');
  const has = await db.get('SELECT 1 FROM favorites WHERE user_id=? AND listing_id=?', [user.id, id]);
  if (has) await db.run('DELETE FROM favorites WHERE user_id=? AND listing_id=?', [user.id, id]);
  else await db.run('INSERT INTO favorites (user_id,listing_id) VALUES (?,?)', [user.id, id]);
  return { favs: await favIds(user.id) };
});

route('GET', '/api/orders', async ctx => {
  const user = need(ctx);
  const now = nowParts();
  const rows = await db.all(ORDER_SQL + ' WHERE o.user_id = ? ORDER BY o.id DESC', [user.id]);
  return { orders: rows.map(row => orderOut(row, now)) };
});

route('POST', '/api/orders', async ctx => {
  const user = need(ctx);
  const now = nowParts();
  const listingId = Number(ctx.body.listingId);
  const quantity = Number(ctx.body.qty);
  const payment = str(ctx.body.payment, 20);
  if (!Number.isInteger(listingId) || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QTY) {
    throw new HttpError(422, `Choose between 1 and ${MAX_QTY} packages.`);
  }
  if (payment !== 'cash') throw new HttpError(422, 'Choose a payment method that is available.');
  rateLimit('order:' + user.id, 20, 3600000);

  let orderRef = '';
  await db.transaction(async tx => {
    // Lock the listing row so two customers cannot reserve the last package at once.
    const listing = await tx.get('SELECT * FROM listings WHERE id=? AND active=1 FOR UPDATE', [listingId]);
    if (!listing) throw new HttpError(404, 'This deal is no longer available.', { code: 'gone' });
    if (now.mins >= toMins(listing.pickup_end)) throw new HttpError(409, 'The pickup window for this package has ended.', { code: 'expired' });
    if (Number(listing.qty) < quantity) {
      throw new HttpError(409, Number(listing.qty) <= 0 ? 'Sorry, this package just sold out.' : `Only ${listing.qty} left. Lower the quantity and try again.`, { code: 'stock' });
    }
    const changed = await tx.run('UPDATE listings SET qty=qty-? WHERE id=? AND qty>=?', [quantity, listingId, quantity]);
    if (changed.affectedRows !== 1) throw new HttpError(409, 'The available stock has changed. Please try again.', { code: 'stock' });

    const unitPrice = Number(listing.is_discounted) ? Number(listing.price) : Number(listing.orig_price);
    const total = unitPrice * quantity + SERVICE_FEE;
    const pickupCode = String(crypto.randomInt(1000, 10000));
    for (let attempt = 0; attempt < 6; attempt++) {
      const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const tail = Array.from({ length: 4 }, () => alphabet[crypto.randomInt(alphabet.length)]).join('');
      const candidate = 'NB-' + now.date.slice(2).replace(/-/g, '') + '-' + tail;
      if (!await tx.get('SELECT 1 FROM orders WHERE ref=?', [candidate])) { orderRef = candidate; break; }
    }
    if (!orderRef) throw new HttpError(500, 'Could not create the order. Please try again.');
    await tx.run(
      `INSERT INTO orders (ref,user_id,listing_id,qty,unit_price,orig_price,service_fee,total,payment_method,pickup_code,pickup_date)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [orderRef, user.id, listingId, quantity, unitPrice, Number(listing.orig_price), SERVICE_FEE, total, payment, pickupCode, now.date]
    );
  });

  const savedOrder = await db.get(ORDER_SQL + ' WHERE o.ref=?', [orderRef]);
  return { status: 201, body: { order: orderOut(savedOrder, now) } };
});

route('POST', '/api/orders/([A-Z0-9-]+)/cancel', async ctx => {
  const user = need(ctx);
  const now = nowParts();
  await db.transaction(async tx => {
    const lockedOrder = await tx.get('SELECT * FROM orders WHERE ref=? AND user_id=? FOR UPDATE', [ctx.params[0], user.id]);
    if (!lockedOrder) throw new HttpError(404, 'Order not found.');
    const row = await db.get(ORDER_SQL + ' WHERE o.ref=? AND o.user_id=?', [ctx.params[0], user.id]);
    const order = orderOut(row, now);
    if (row.status !== 'reserved') throw new HttpError(409, 'This order can no longer be cancelled.');
    if (!order.canCancel) throw new HttpError(409, order.cancelNote || 'This order can no longer be cancelled.');
    await tx.run("UPDATE orders SET status='cancelled', cancelled_at=CURRENT_TIMESTAMP WHERE id=?", [row.id]);
    if (String(row.pickup_date).slice(0, 10) === now.date) {
      await tx.run('UPDATE listings SET qty=LEAST(initial_qty, qty+?) WHERE id=?', [row.qty, row.listing_id]);
    }
  });
  return { ok: true };
});

/* Mark an order as collected after checking its pickup code. Disabled unless NB_ADMIN_KEY is set. */
route('POST', '/api/admin/orders/([A-Z0-9-]+)/collect', async ctx => {
  const key = String(ctx.req.headers['x-admin-key'] || '');
  const actual = Buffer.from(key);
  const expected = Buffer.from(ADMIN_KEY);
  if (!ADMIN_KEY || actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) throw new HttpError(403, 'Not allowed.');
  const row = await db.get('SELECT * FROM orders WHERE ref=?', [ctx.params[0]]);
  if (!row || row.status !== 'reserved') throw new HttpError(404, 'No open order with that reference.');
  if (String(ctx.body.code) !== row.pickup_code) throw new HttpError(422, 'Pickup code does not match.');
  await db.run("UPDATE orders SET status='collected', collected_at=CURRENT_TIMESTAMP WHERE id=?", [row.id]);
  return { ok: true };
});

// --- AI Chatbot Endpoint ---
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
// Model cadangan dicoba berurutan kalau model utama sibuk (503), timeout, atau tidak tersedia (404).
const GEMINI_FALLBACKS = (process.env.GEMINI_FALLBACK_MODELS || 'gemini-3.7-flash,gemini-3.5-flash-lite')
  .split(',').map(name => name.trim()).filter(Boolean);
const GEMINI_MODELS = [...new Set([GEMINI_MODEL, ...GEMINI_FALLBACKS])];
const GEMINI_TIMEOUT_MS = 9000;

async function callGemini(model, apiKey, payload) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const send = body => fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS)
  });
  // Mode berpikir ringan supaya balasan cepat. Kalau model menolak pengaturan ini (400), kirim ulang tanpa itu.
  let res = await send({ ...payload, generationConfig: { thinkingConfig: { thinkingLevel: 'low' } } });
  if (res.status === 400) res = await send(payload);
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

route('POST', '/api/ai-chat', async ctx => {
  rateLimit('ai:' + ctx.ip, 20, 60000);
  const message = str(ctx.body.message, 1000);
  if (!message) throw new HttpError(422, 'Pesan tidak boleh kosong.');

  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) throw new HttpError(500, 'API Key Gemini belum diatur di file .env server.');

  let listingsContext = 'Tidak ada menu aktif saat ini.';
  try {
    const now = nowParts();
    const rows = await db.all(LISTING_SQL + ' WHERE l.active = 1 ORDER BY l.id LIMIT 15');
    const available = rows.map(r => listingOut(r, now)).filter(l => l.status === 'active');
    if (available.length) {
      listingsContext = available.map(l =>
        `- ${l.t} di ${l.m} (${l.area}): Rp${l.p} (harga asli Rp${l.o}), sisa ${l.q}, ambil ${l.s}-${l.e}`
      ).join('\n');
    }
  } catch (e) {
    console.error('Gagal mengambil context listing:', e.message);
  }

  const systemPrompt = `Kamu adalah Asisten AI untuk Night Bite, platform penyelamat makanan surplus di Indonesia.
Bantu pelanggan dengan ramah dan rekomendasikan hanya dari daftar menu yang tersedia saat ini:
${listingsContext}

Aturan: jawab singkat dalam bahasa Indonesia, jangan mengarang menu atau harga di luar daftar,
dan jika tidak ada menu yang cocok, katakan dengan jujur.`;

  // riwayat obrolan (maks 6 pesan terakhir)
  const history = Array.isArray(ctx.body.history) ? ctx.body.history.slice(-6) : [];
  const contents = [];
  for (const h of history) {
    const text = str(h && h.text, 1000);
    if (!text) continue;
    contents.push({ role: h.role === 'bot' ? 'model' : 'user', parts: [{ text }] });
  }
  while (contents.length && contents[0].role === 'model') contents.shift();
  contents.push({ role: 'user', parts: [{ text: message }] });

  const payload = { systemInstruction: { parts: [{ text: systemPrompt }] }, contents };

  for (const model of GEMINI_MODELS) {
    try {
      const result = await callGemini(model, apiKey, payload);
      if (result.ok) {
        const reply = result.data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('').trim();
        if (reply) return { reply };
        console.error(`Gemini ${model}: balasan kosong`, JSON.stringify(result.data).slice(0, 300));
      } else {
        console.error(`Gemini ${model} error:`, result.status, JSON.stringify(result.data).slice(0, 300));
      }
    } catch (err) {
      console.error(`Gemini ${model} gagal:`, err.name || err.message);
    }
  }
  throw new HttpError(503, 'Asisten AI sedang sibuk. Coba lagi beberapa detik lagi ya.');
});

/* ---------- static files ---------- */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json'
};
const SEC = {
  'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'same-origin',
  'Permissions-Policy': 'geolocation=(self), camera=(), microphone=()',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
};
function serveStatic(req, res) {
  let requestPath;
  try { requestPath = decodeURIComponent(new URL(req.url, 'http://x').pathname); }
  catch { res.writeHead(400, SEC); return res.end('Bad request'); }
  if (requestPath === '/' || requestPath === '/customer.html') requestPath = '/index.html';
  if (requestPath === '/food-partner' || requestPath === '/food-partner/') requestPath = '/food-partner.html';
  const file = path.normalize(path.join(PUBLIC, requestPath));
  if (!file.startsWith(PUBLIC + path.sep)) { res.writeHead(403, SEC); return res.end('Forbidden'); }
  fs.readFile(file, (error, buffer) => {
    if (error) { res.writeHead(404, { ...SEC, 'Content-Type': 'text/plain' }); return res.end('Not found'); }
    const ext = path.extname(file);
    res.writeHead(200, { ...SEC, 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': (ext === '.html' || ext === '.svg') ? 'no-cache' : 'public, max-age=300' });
    res.end(req.method === 'HEAD' ? undefined : buffer);
  });
}

/* ---------- server ---------- */
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    if (!url.pathname.startsWith('/api/')) {
      if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, SEC); return res.end(); }
      return serveStatic(req, res);
    }
    for (const [key, value] of Object.entries(SEC)) res.setHeader(key, value);
    await ensureDailyStock();
    const unsafe = req.method !== 'GET' && req.method !== 'HEAD';
    if (unsafe) {
      const origin = req.headers.origin;
      if (origin && new URL(origin).host !== req.headers.host) throw new HttpError(403, 'Cross-site requests are not allowed.');
      if (!/^application\/json/.test(req.headers['content-type'] || '') && req.headers['content-length'] !== '0' && req.headers['content-length'] !== undefined) {
        throw new HttpError(415, 'Send JSON.');
      }
    }
    let match = null;
    for (const [method, regex, handler] of routes) {
      const result = regex.exec(url.pathname);
      if (result && method === req.method) { match = [handler, result.slice(1)]; break; }
      if (result && !match) match = 'method';
    }
    if (!match) throw new HttpError(404, 'Not found.');
    if (match === 'method') throw new HttpError(405, 'Method not allowed.');
    const ctx = {
      req, res, params: match[1],
      user: await getUser(req), partner: await getPartner(req),
      body: unsafe ? await readBody(req) : {}, ip: req.socket.remoteAddress || ''
    };
    const output = await match[0](ctx);
    if (output && output.body !== undefined) json(res, output.status || 200, output.body, output.headers || {});
    else json(res, 200, output);
  } catch (error) {
    if (error instanceof HttpError) return json(res, error.status, { error: error.message, ...error.extra });
    console.error(error);
    if (!res.headersSent) json(res, 500, { error: 'Something went wrong on our side. Please try again.' });
    else res.end();
  }
});

async function start() {
  await initializeDatabase();
  server.listen(PORT, () => console.log(`Night Bite is running at http://localhost:${PORT}`));
}
start().catch(error => {
  console.error('Night Bite could not start. Check your MySQL connection and DB settings.');
  console.error(error);
  process.exitCode = 1;
});

module.exports = server;