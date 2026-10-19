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

async function seedAll() {
  // Settings groups – only add the ones that are missing, never overwrite edits.
  for (const [key, value] of Object.entries(seed.settings)) {
    const rows = await q('SELECT 1 FROM settings WHERE k = ?', [key]);
    if (!rows.length) await setSetting(key, value);
  }
  if (!(await getSetting('_secret'))) await setSetting('_secret', crypto.randomBytes(48).toString('hex'));

  // Collections – only once, so deleting content later never brings it back.
  if (await getSetting('_seeded')) return;

  let order = 0;
  for (const c of seed.categories) {
    const [res] = await pool.query(
      'INSERT INTO service_categories (name, image_a, image_b, sort_order) VALUES (?, ?, ?, ?)',
      [c.name, c.imageA, c.imageB, ++order]
    );
    let i = 0;
    for (const [name, price] of c.items) {
      await q('INSERT INTO service_items (category_id, name, price, sort_order) VALUES (?, ?, ?, ?)', [res.insertId, name, price, ++i]);
    }
  }
  order = 0;
  for (const src of seed.photos) await q('INSERT INTO gallery_items (type, src, sort_order) VALUES (?, ?, ?)', ['photo', src, ++order]);
  for (const src of seed.videos) await q('INSERT INTO gallery_items (type, src, sort_order) VALUES (?, ?, ?)', ['video', src, ++order]);
  order = 0;
  for (const p of seed.promotions) await q('INSERT INTO promotions (title, body, cta_label, cta_url, sort_order) VALUES (?, ?, ?, ?, ?)', [p.title, p.body, '', '', ++order]);
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
