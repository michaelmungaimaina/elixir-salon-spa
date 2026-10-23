const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('./config');
const seed = require('./seed-data');

let pool;

const q = (sql, params) => pool.query(sql, params).then(([rows]) => rows);

async function ensureColumn(table, column, ddl) {
  const rows = await q(
    'SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?',
    [config.db.database, table, column]
  );
  if (!rows[0].n) await q(`ALTER TABLE \`${table}\` ADD COLUMN ${column} ${ddl}`);
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS settings (
     k VARCHAR(64) PRIMARY KEY,
     v LONGTEXT NOT NULL,
     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
   )`,
  `CREATE TABLE IF NOT EXISTS admin_users (
     id INT AUTO_INCREMENT PRIMARY KEY,
     name VARCHAR(120) NOT NULL,
     email VARCHAR(190) NOT NULL UNIQUE,
     password_hash VARCHAR(255) NOT NULL,
     role VARCHAR(16) NOT NULL DEFAULT 'editor',
     active TINYINT(1) NOT NULL DEFAULT 1,
     last_login TIMESTAMP NULL,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE TABLE IF NOT EXISTS service_categories (
     id INT AUTO_INCREMENT PRIMARY KEY,
     name VARCHAR(160) NOT NULL,
     blurb VARCHAR(500) NOT NULL DEFAULT '',
     image_a VARCHAR(500) NOT NULL DEFAULT '',
     image_b VARCHAR(500) NOT NULL DEFAULT '',
     book_url VARCHAR(500) NOT NULL DEFAULT '',
     sort_order INT NOT NULL DEFAULT 0,
     visible TINYINT(1) NOT NULL DEFAULT 1
   )`,
  `CREATE TABLE IF NOT EXISTS service_items (
     id INT AUTO_INCREMENT PRIMARY KEY,
     category_id INT NOT NULL,
     name VARCHAR(200) NOT NULL,
     price VARCHAR(80) NOT NULL DEFAULT '',
     note VARCHAR(300) NOT NULL DEFAULT '',
     sort_order INT NOT NULL DEFAULT 0,
     visible TINYINT(1) NOT NULL DEFAULT 1,
     FOREIGN KEY (category_id) REFERENCES service_categories(id) ON DELETE CASCADE
   )`,
  `CREATE TABLE IF NOT EXISTS gallery_items (
     id INT AUTO_INCREMENT PRIMARY KEY,
     type VARCHAR(10) NOT NULL DEFAULT 'photo',
     src VARCHAR(500) NOT NULL,
     caption VARCHAR(300) NOT NULL DEFAULT '',
     sort_order INT NOT NULL DEFAULT 0,
     visible TINYINT(1) NOT NULL DEFAULT 1
   )`,
  `CREATE TABLE IF NOT EXISTS promotions (
     id INT AUTO_INCREMENT PRIMARY KEY,
     title VARCHAR(240) NOT NULL,
     body TEXT NOT NULL,
     cta_label VARCHAR(80) NOT NULL DEFAULT '',
     cta_url VARCHAR(500) NOT NULL DEFAULT '',
     starts_on DATE NULL,
     ends_on DATE NULL,
     sort_order INT NOT NULL DEFAULT 0,
     visible TINYINT(1) NOT NULL DEFAULT 1
   )`,
  `CREATE TABLE IF NOT EXISTS jobs (
     id INT AUTO_INCREMENT PRIMARY KEY,
     title VARCHAR(200) NOT NULL,
     description VARCHAR(500) NOT NULL DEFAULT '',
     sort_order INT NOT NULL DEFAULT 0,
     visible TINYINT(1) NOT NULL DEFAULT 1
   )`,
  `CREATE TABLE IF NOT EXISTS media (
     id INT AUTO_INCREMENT PRIMARY KEY,
     url VARCHAR(500) NOT NULL UNIQUE,
     original_name VARCHAR(255) NOT NULL DEFAULT '',
     kind VARCHAR(10) NOT NULL DEFAULT 'image',
     size INT NOT NULL DEFAULT 0,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE TABLE IF NOT EXISTS activity_log (
     id INT AUTO_INCREMENT PRIMARY KEY,
     user_name VARCHAR(120) NOT NULL DEFAULT '',
     action VARCHAR(255) NOT NULL,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   )`,
  // ---- Booking system ----
  `CREATE TABLE IF NOT EXISTS staff (
     id INT AUTO_INCREMENT PRIMARY KEY,
     name VARCHAR(120) NOT NULL,
     title VARCHAR(160) NOT NULL DEFAULT '',
     photo VARCHAR(500) NOT NULL DEFAULT '',
     categories VARCHAR(500) NULL,
     work_days VARCHAR(20) NOT NULL DEFAULT '0,1,2,3,4,5,6',
     selectable TINYINT(1) NOT NULL DEFAULT 0,
     active TINYINT(1) NOT NULL DEFAULT 1,
     sort_order INT NOT NULL DEFAULT 0
   )`,
  `CREATE TABLE IF NOT EXISTS bookings (
     id INT AUTO_INCREMENT PRIMARY KEY,
     reference VARCHAR(16) NOT NULL UNIQUE,
     token VARCHAR(48) NOT NULL UNIQUE,
     status VARCHAR(16) NOT NULL DEFAULT 'pending',
     source VARCHAR(12) NOT NULL DEFAULT 'online',
     client_name VARCHAR(120) NOT NULL,
     client_phone VARCHAR(30) NOT NULL,
     client_email VARCHAR(190) NOT NULL DEFAULT '',
     notes VARCHAR(1000) NOT NULL DEFAULT '',
     admin_note TEXT NULL,
     staff_id INT NULL,
     staff_requested TINYINT(1) NOT NULL DEFAULT 0,
     starts_at DATETIME NOT NULL,
     ends_at DATETIME NOT NULL,
     duration_min INT NOT NULL,
     price_min INT NOT NULL DEFAULT 0,
     price_max INT NOT NULL DEFAULT 0,
     reminder_sent TINYINT(1) NOT NULL DEFAULT 0,
     cancel_reason VARCHAR(300) NOT NULL DEFAULT '',
     cancelled_by VARCHAR(10) NOT NULL DEFAULT '',
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
     KEY idx_start (starts_at), KEY idx_status (status), KEY idx_phone (client_phone), KEY idx_email (client_email), KEY idx_staff (staff_id),
     FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE SET NULL
   )`,
  `CREATE TABLE IF NOT EXISTS booking_items (
     id INT AUTO_INCREMENT PRIMARY KEY,
     booking_id INT NOT NULL,
     service_id INT NULL,
     category_id INT NULL,
     name VARCHAR(200) NOT NULL,
     category VARCHAR(160) NOT NULL DEFAULT '',
     price_text VARCHAR(80) NOT NULL DEFAULT '',
     duration_min INT NOT NULL,
     price_min INT NOT NULL DEFAULT 0,
     price_max INT NOT NULL DEFAULT 0,
     sort_order INT NOT NULL DEFAULT 0,
     FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
   )`,
  `CREATE TABLE IF NOT EXISTS time_blocks (
     id INT AUTO_INCREMENT PRIMARY KEY,
     staff_id INT NULL,
     starts_at DATETIME NOT NULL,
     ends_at DATETIME NOT NULL,
     reason VARCHAR(200) NOT NULL DEFAULT '',
     KEY idx_block (starts_at, ends_at),
     FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
   )`,
  `CREATE TABLE IF NOT EXISTS email_log (
     id INT AUTO_INCREMENT PRIMARY KEY,
     to_addr VARCHAR(255) NOT NULL,
     subject VARCHAR(300) NOT NULL,
     kind VARCHAR(30) NOT NULL DEFAULT '',
     status VARCHAR(12) NOT NULL,
     error VARCHAR(500) NOT NULL DEFAULT '',
     booking_id INT NULL,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   )`,
  // ---- Tables that already exist in the original project (kept compatible) ----
  `CREATE TABLE IF NOT EXISTS users (
     id INT AUTO_INCREMENT PRIMARY KEY,
     name VARCHAR(255) NOT NULL,
     email VARCHAR(255) NOT NULL,
     password VARCHAR(255) NOT NULL,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE TABLE IF NOT EXISTS contact_data (
     id INT AUTO_INCREMENT PRIMARY KEY,
     name VARCHAR(255) NOT NULL,
     email VARCHAR(255) NOT NULL,
     phone VARCHAR(255) NOT NULL,
     message TEXT NOT NULL,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE TABLE IF NOT EXISTS ratings (
     id INT AUTO_INCREMENT PRIMARY KEY,
     client_name VARCHAR(255) NOT NULL,
     client_email VARCHAR(255) NOT NULL,
     client_phone VARCHAR(20) NOT NULL,
     client_type VARCHAR(50) NOT NULL,
     comment TEXT NOT NULL,
     stars INT NOT NULL,
     feedback TEXT NULL,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE TABLE IF NOT EXISTS applications (
     id INT AUTO_INCREMENT PRIMARY KEY,
     name VARCHAR(255) NOT NULL,
     email VARCHAR(255) NOT NULL,
     phone VARCHAR(20) NOT NULL,
     cv VARCHAR(255) NOT NULL,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   )`,
];

async function migrate() {
  for (const sql of SCHEMA) await q(sql);

  // New columns on legacy tables (existing rows are preserved).
  await ensureColumn('contact_data', 'status', "VARCHAR(16) NOT NULL DEFAULT 'new'");
  await ensureColumn('contact_data', 'admin_note', 'TEXT NULL');
  await ensureColumn('applications', 'status', "VARCHAR(16) NOT NULL DEFAULT 'new'");
  await ensureColumn('applications', 'position', "VARCHAR(200) NOT NULL DEFAULT ''");
  await ensureColumn('applications', 'original_name', "VARCHAR(255) NOT NULL DEFAULT ''");
  await ensureColumn('applications', 'admin_note', 'TEXT NULL');
  // Legacy reviews were publicly visible, so they default to "approved".
  await ensureColumn('ratings', 'status', "VARCHAR(16) NOT NULL DEFAULT 'approved'");
  await ensureColumn('ratings', 'sort_order', 'INT NOT NULL DEFAULT 0');
  await ensureColumn('service_categories', 'book_url', "VARCHAR(500) NOT NULL DEFAULT ''");
  await ensureColumn('service_items', 'duration_min', 'INT NOT NULL DEFAULT 60');
  await ensureColumn('service_items', 'bookable', 'TINYINT(1) NOT NULL DEFAULT 1');
  await ensureColumn('promotions', 'icon', "VARCHAR(40) NOT NULL DEFAULT ''");
}

// ---------- settings ----------
async function getSetting(key) {
  const rows = await q('SELECT v FROM settings WHERE k = ?', [key]);
  if (!rows.length) return null;
  try { return JSON.parse(rows[0].v); } catch { return rows[0].v; }
}
async function setSetting(key, value) {
  const v = JSON.stringify(value);
  await q('INSERT INTO settings (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)', [key, v]);
}
async function allSettings() {
  const rows = await q("SELECT k, v FROM settings WHERE k NOT LIKE '\\_%'");
  const out = {};
  for (const r of rows) { try { out[r.k] = JSON.parse(r.v); } catch { /* ignore */ } }
  return out;
}

// ---------- seed ----------
const NOT_MEDIA = /^(call|email|location|next-icon|prev-icon|star-rating|time|whatsapp|home-splitter|gallery-icon)\./;

async function syncMediaFromDisk() {
  const dir = path.join(config.publicDir, 'resources');
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir)) {
    if (NOT_MEDIA.test(f)) continue;
    const ext = path.extname(f).toLowerCase();
    const kind = ['.mp4', '.webm'].includes(ext) ? 'video' : ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext) ? 'image' : null;
    if (!kind) continue;
    const size = fs.statSync(path.join(dir, f)).size;
    await q('INSERT IGNORE INTO media (url, original_name, kind, size) VALUES (?, ?, ?, ?)', ['/resources/' + f, f, kind, size]);
  }
}

// One-time upgrade steps for sites created with an earlier version. Each runs once.
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu;
async function once(flag, fn) {
  if (await getSetting(flag)) return;
  await fn();
  await setSetting(flag, '1');
}
async function upgrades() {
  // Booking: realistic durations for the services that came with the original site.
  await once('_up_durations', async () => {
    for (const c of seed.categories) for (const [name, , mins] of c.items) {
      await q('UPDATE service_items si JOIN service_categories sc ON sc.id = si.category_id SET si.duration_min = ? WHERE sc.name = ? AND si.name = ?', [mins || 60, c.name, name]);
    }
  });
  // Promotions: emojis replaced by icons.
  await once('_up_promo_icons', async () => {
    const rows = await q('SELECT id, title, icon FROM promotions');
    const byTitle = [['New Clients', 'gift'], ['Special Day', 'cake-candles'], ['Loyalty', 'gem'], ['Seventh', 'crown']];
    let i = 0;
    for (const r of rows) {
      const clean = r.title.replace(EMOJI, '').replace(/\s{2,}/g, ' ').trim();
      const icon = r.icon || (byTitle.find(([k]) => r.title.includes(k)) || [0, ['star', 'gift', 'gem', 'heart'][i % 4]])[1];
      await q('UPDATE promotions SET title = ?, icon = ? WHERE id = ?', [clean, icon, r.id]); i++;
    }
  });
  // Mail: staff alerts go to the admin mailbox; replies from clients are directed there too.
  await once('_up_mail_v3', async () => {
    const e = await getSetting('email');
    if (e && typeof e === 'object') {
      if (!e.notifyTo || e.notifyTo === 'info@elixirsalonandspa.co.ke') e.notifyTo = 'admin@elixirsalonandspa.co.ke';
      if (!e.replyTo) e.replyTo = 'admin@elixirsalonandspa.co.ke';
      await setSetting('email', e);
    }
  });
  // The booking banner button used to say "Click to Continue" (it led to an external site).
  await once('_up_booking_cta', async () => {
    const b = await getSetting('booking');
    if (b && b.cta === 'Click to Continue') { b.cta = 'Book Appointment'; await setSetting('booking', b); }
  });
  // Booking: a starter set of workstations so the calendar works on day one.
  await once('_up_staff', async () => {
    const [{ n }] = await q('SELECT COUNT(*) AS n FROM staff');
    if (n) return;
    for (let i = 1; i <= 4; i++) await q('INSERT INTO staff (name, title, selectable, sort_order) VALUES (?, ?, 0, ?)', [`Team member ${i}`, 'Stylist', i]);
  });
}

async function seedAll() {
  // Settings groups – only add the ones that are missing, never overwrite edits.
  for (const [key, value] of Object.entries(seed.settings)) {
    const current = await getSetting(key);
    if (current === null) { await setSetting(key, value); continue; }
    // Existing site: add any NEW fields introduced by an update, never overwrite what was edited.
    if (value && !Array.isArray(value) && typeof value === 'object' && current && typeof current === 'object') {
      let changed = false;
      for (const [k, v] of Object.entries(value)) if (!(k in current)) { current[k] = v; changed = true; }
      if (changed) await setSetting(key, current);
    }
  }
  if (!(await getSetting('_secret'))) await setSetting('_secret', crypto.randomBytes(48).toString('hex'));

  await upgrades();

  // Collections – only once, so deleting content later never brings it back.
  if (await getSetting('_seeded')) return;

  let order = 0;
  for (const c of seed.categories) {
    const [res] = await pool.query(
      'INSERT INTO service_categories (name, image_a, image_b, sort_order) VALUES (?, ?, ?, ?)',
      [c.name, c.imageA, c.imageB, ++order]
    );
    let i = 0;
    for (const [name, price, mins] of c.items) {
      await q('INSERT INTO service_items (category_id, name, price, duration_min, sort_order) VALUES (?, ?, ?, ?, ?)', [res.insertId, name, price, mins || 60, ++i]);
    }
  }
  order = 0;
  for (const src of seed.photos) await q('INSERT INTO gallery_items (type, src, sort_order) VALUES (?, ?, ?)', ['photo', src, ++order]);
  for (const src of seed.videos) await q('INSERT INTO gallery_items (type, src, sort_order) VALUES (?, ?, ?)', ['video', src, ++order]);
  order = 0;
  for (const p of seed.promotions) await q('INSERT INTO promotions (title, body, icon, cta_label, cta_url, sort_order) VALUES (?, ?, ?, ?, ?, ?)', [p.title, p.body, p.icon || '', '', '', ++order]);
  order = 0;
  for (const j of seed.jobs) await q('INSERT INTO jobs (title, sort_order) VALUES (?, ?)', [j.title, ++order]);

  const [{ n }] = await q('SELECT COUNT(*) AS n FROM ratings');
  if (!n) {
    order = 0;
    for (const [name, type, comment, stars, feedback] of seed.testimonials) {
      await q(
        "INSERT INTO ratings (client_name, client_email, client_phone, client_type, comment, stars, feedback, status, sort_order) VALUES (?, '', '', ?, ?, ?, ?, 'approved', ?)",
        [name, type, comment, stars, feedback, ++order]
      );
    }
  }
  await setSetting('_seeded', '1');
}

async function init() {
  const { database, ...rest } = config.db;
  const boot = await mysql.createConnection(rest);
  await boot.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await boot.end();

  pool = mysql.createPool({ ...config.db, waitForConnections: true, connectionLimit: 10, charset: 'utf8mb4', dateStrings: true });
  await migrate();
  await seedAll();
  await syncMediaFromDisk();
  return pool;
}

async function log(user, action) {
  try { await q('INSERT INTO activity_log (user_name, action) VALUES (?, ?)', [user || 'system', String(action).slice(0, 250)]); } catch { /* non-fatal */ }
}

module.exports = { init, q, getSetting, setSetting, allSettings, log, pool: () => pool };
