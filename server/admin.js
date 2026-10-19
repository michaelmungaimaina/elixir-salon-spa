const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const db = require('./db');
const auth = require('./auth');
const mailer = require('./mailer');
const seed = require('./seed-data');
const u = require('./util');

const router = express.Router();
const { q } = db;
// CV paths saved on Windows contain backslashes – accept both separators.
const cvFile = (cv) => path.join(config.uploadsDir, String(cv).split(/[\\/]/).pop());
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Hook so the public site cache is dropped after any admin write.
let onChange = () => {};
router.setChangeHook = (fn) => { onChange = fn; };

// ================= Auth (public part) =================
const loginLimiter = auth.rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: 'Too many sign-in attempts. Try again in 15 minutes.' });

router.get('/status', wrap(async (req, res) => {
  const [{ n }] = await q('SELECT COUNT(*) AS n FROM admin_users');
  const user = await auth.getUser(req);
  res.json({ needsSetup: n === 0, user, mailConfigured: user ? mailer.isConfigured() : undefined });
}));

router.post('/setup', loginLimiter, wrap(async (req, res) => {
  const [{ n }] = await q('SELECT COUNT(*) AS n FROM admin_users');
  if (n) return res.status(403).json({ error: 'Setup has already been completed.' });
  const name = u.str(req.body.name, 120), email = u.str(req.body.email, 190).toLowerCase(), password = String(req.body.password || '');
  if (!name || !u.isEmail(email)) return res.status(400).json({ error: 'Enter your name and a valid email.' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  const [r] = await db.pool().query('INSERT INTO admin_users (name, email, password_hash, role) VALUES (?, ?, ?, ?)', [name, email, auth.hashPassword(password), 'owner']);
  const [user] = await q('SELECT * FROM admin_users WHERE id = ?', [r.insertId]);
  await auth.setSession(req, res, user);
  await db.log(name, 'Created the owner account');
  res.json({ user: { id: user.id, name, email, role: 'owner' } });
}));

router.post('/login', loginLimiter, wrap(async (req, res) => {
  const email = u.str(req.body.email, 190).toLowerCase(), password = String(req.body.password || '');
  const [user] = await q('SELECT * FROM admin_users WHERE email = ? AND active = 1', [email]);
  if (!user || !auth.verifyPassword(password, user.password_hash)) return res.status(401).json({ error: 'Incorrect email or password.' });
  loginLimiter.clear(req.ip);
  await q('UPDATE admin_users SET last_login = NOW() WHERE id = ?', [user.id]);
  await auth.setSession(req, res, user);
  await db.log(user.name, 'Signed in');
  res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
}));

router.post('/logout', (req, res) => { auth.clearSession(res); res.json({ ok: true }); });

// ================= Everything below needs a session =================
router.use(auth.requireAuth);

// Record every successful write in the activity log.
router.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && !req.path.startsWith('/media')) {
    res.on('finish', () => {
      if (res.statusCode < 400) {
        db.log(req.user.name, `${req.method} ${req.path}`.replace(/\/\d+/g, '/#'));
        onChange();
      }
    });
  }
  next();
});

router.get('/me', (req, res) => res.json({ user: req.user, mailConfigured: mailer.isConfigured() }));

// ---------- Dashboard ----------
router.get('/dashboard', wrap(async (req, res) => {
  const one = async (sql) => (await q(sql))[0].n;
  const counts = {
    messagesNew: await one("SELECT COUNT(*) n FROM contact_data WHERE status = 'new'"),
    messages: await one('SELECT COUNT(*) n FROM contact_data'),
    applicationsNew: await one("SELECT COUNT(*) n FROM applications WHERE status = 'new'"),
    applications: await one('SELECT COUNT(*) n FROM applications'),
    reviewsPending: await one("SELECT COUNT(*) n FROM ratings WHERE status = 'pending'"),
    reviews: await one("SELECT COUNT(*) n FROM ratings WHERE status = 'approved'"),
    services: await one('SELECT COUNT(*) n FROM service_items WHERE visible = 1'),
    gallery: await one('SELECT COUNT(*) n FROM gallery_items WHERE visible = 1'),
    media: await one('SELECT COUNT(*) n FROM media'),
  };
  const series = await q(`SELECT d, SUM(c) AS n FROM (
      SELECT DATE(created_at) d, COUNT(*) c FROM contact_data WHERE created_at >= CURDATE() - INTERVAL 13 DAY GROUP BY d
      UNION ALL SELECT DATE(created_at), COUNT(*) FROM applications WHERE created_at >= CURDATE() - INTERVAL 13 DAY GROUP BY 1
      UNION ALL SELECT DATE(created_at), COUNT(*) FROM ratings WHERE created_at >= CURDATE() - INTERVAL 13 DAY GROUP BY 1
    ) t GROUP BY d`);
  const recentMessages = await q('SELECT id, name, message, status, created_at FROM contact_data ORDER BY id DESC LIMIT 5');
  const recentApplications = await q('SELECT id, name, position, status, created_at FROM applications ORDER BY id DESC LIMIT 5');
  const activity = await q('SELECT user_name, action, created_at FROM activity_log ORDER BY id DESC LIMIT 8');
  res.json({ counts, series, recentMessages, recentApplications, activity, mailConfigured: mailer.isConfigured() });
}));

// ---------- Settings (all editable copy lives here) ----------
router.get('/settings', wrap(async (req, res) => res.json(await db.allSettings())));

router.put('/settings/:group', wrap(async (req, res) => {
  const g = req.params.group;
  if (!(g in seed.settings)) return res.status(404).json({ error: 'Unknown settings group.' });
  if (g === 'email' && req.user.role !== 'owner') return res.status(403).json({ error: 'Only the owner can change email settings.' });
  const def = seed.settings[g];
  const val = u.clean(req.body);
  if (Array.isArray(def) !== Array.isArray(val) || typeof val !== 'object' || val === null) return res.status(400).json({ error: 'Invalid data.' });
  if (g === 'theme') {
    val.green = u.hex(val.green, def.green); val.gold = u.hex(val.gold, def.gold); val.ground = u.hex(val.ground, def.ground);
  }
  if (g === 'sections') {
    // Keys, ids and order are fixed; only label / nav / visible may change.
    const byKey = Object.fromEntries(val.map((s) => [s.key, s]));
    for (const s of def) { const n = byKey[s.key] || {}; s.label = u.str(n.label || s.label, 40); s.nav = !!n.nav; s.visible = n.visible !== false; }
    return res.json(await save('sections', def));
  }
  res.json(await save(g, val));
}));
async function save(key, val) { await db.setSetting(key, val); return val; }

// ---------- Generic CRUD for ordered collections ----------
function crud(route, table, fields, { parent } = {}) {
  const cols = Object.keys(fields);
  router.get(`/${route}`, wrap(async (req, res) => {
    const where = parent && req.query[parent] ? `WHERE ${parent} = ${u.int(req.query[parent])}` : '';
    res.json(await q(`SELECT * FROM ${table} ${where} ORDER BY sort_order, id`));
  }));
  router.post(`/${route}`, wrap(async (req, res) => {
    const vals = cols.map((c) => fields[c](req.body[c]));
    const scope = parent ? `WHERE ${parent} = ${u.int(req.body[parent])}` : '';
    const [{ m }] = await q(`SELECT COALESCE(MAX(sort_order), 0) m FROM ${table} ${scope}`);
    const [r] = await db.pool().query(`INSERT INTO ${table} (${cols.join(',')}, sort_order) VALUES (${cols.map(() => '?').join(',')}, ?)`, [...vals, m + 1]);
    res.status(201).json((await q(`SELECT * FROM ${table} WHERE id = ?`, [r.insertId]))[0]);
  }));
  router.put(`/${route}/:id`, wrap(async (req, res) => {
    const present = cols.filter((c) => req.body[c] !== undefined);
    if (!present.length) return res.status(400).json({ error: 'Nothing to update.' });
    await q(`UPDATE ${table} SET ${present.map((c) => `${c} = ?`).join(',')} WHERE id = ?`, [...present.map((c) => fields[c](req.body[c])), u.int(req.params.id)]);
    res.json((await q(`SELECT * FROM ${table} WHERE id = ?`, [u.int(req.params.id)]))[0] || {});
  }));
  router.delete(`/${route}/:id`, wrap(async (req, res) => {
    await q(`DELETE FROM ${table} WHERE id = ?`, [u.int(req.params.id)]);
    res.json({ ok: true });
  }));
  router.post(`/${route}/reorder`, wrap(async (req, res) => {
    const ids = (Array.isArray(req.body.ids) ? req.body.ids : []).map((i) => u.int(i));
    await Promise.all(ids.map((id, i) => q(`UPDATE ${table} SET sort_order = ? WHERE id = ?`, [i + 1, id])));
    res.json({ ok: true });
  }));
}

const S = (n) => (v) => u.str(v, n);
crud('categories', 'service_categories', { name: S(160), blurb: S(500), image_a: u.url, image_b: u.url, book_url: u.url, visible: u.bool });
crud('items', 'service_items', { category_id: (v) => u.int(v), name: S(200), price: S(80), note: S(300), visible: u.bool }, { parent: 'category_id' });
crud('gallery', 'gallery_items', { type: (v) => (v === 'video' ? 'video' : 'photo'), src: u.url, caption: S(300), visible: u.bool });
crud('promotions', 'promotions', { title: S(240), body: S(2000), cta_label: S(80), cta_url: u.url, starts_on: u.date, ends_on: u.date, visible: u.bool });
crud('jobs', 'jobs', { title: S(200), description: S(500), visible: u.bool });

router.post('/gallery/bulk', wrap(async (req, res) => {
  const srcs = (Array.isArray(req.body.srcs) ? req.body.srcs : []).map(u.url).filter(Boolean).slice(0, 100);
  let [{ m }] = await q('SELECT COALESCE(MAX(sort_order), 0) m FROM gallery_items');
  for (const src of srcs) {
    const type = /\.(mp4|webm)$/i.test(src) ? 'video' : 'photo';
    await q('INSERT INTO gallery_items (type, src, sort_order) VALUES (?, ?, ?)', [type, src, ++m]);
  }
  res.status(201).json({ added: srcs.length });
}));

// ---------- Reviews / testimonials ----------
router.get('/ratings', wrap(async (req, res) => {
  const st = ['pending', 'approved', 'hidden'].includes(req.query.status) ? req.query.status : null;
  res.json(await q(`SELECT * FROM ratings ${st ? 'WHERE status = ?' : ''} ORDER BY sort_order = 0 DESC, sort_order, id DESC`, st ? [st] : []));
}));
const ratingFields = (b) => [u.str(b.client_name, 120), u.str(b.client_type, 50) || 'Customer', u.str(b.comment, 2000), Math.min(5, Math.max(1, u.int(b.stars, 5))), u.str(b.feedback, 2000), ['pending', 'approved', 'hidden'].includes(b.status) ? b.status : 'approved'];
router.post('/ratings', wrap(async (req, res) => {
  const [n, t, c, s, f, st] = ratingFields(req.body);
  if (!n || !c) return res.status(400).json({ error: 'Name and comment are required.' });
  const [r] = await db.pool().query("INSERT INTO ratings (client_name, client_email, client_phone, client_type, comment, stars, feedback, status) VALUES (?, '', '', ?, ?, ?, ?, ?)", [n, t, c, s, f, st]);
  res.status(201).json({ id: r.insertId });
}));
router.put('/ratings/:id', wrap(async (req, res) => {
  const [n, t, c, s, f, st] = ratingFields(req.body);
  await q('UPDATE ratings SET client_name=?, client_type=?, comment=?, stars=?, feedback=?, status=? WHERE id=?', [n, t, c, s, f, st, u.int(req.params.id)]);
  res.json({ ok: true });
}));
router.delete('/ratings/:id', wrap(async (req, res) => { await q('DELETE FROM ratings WHERE id = ?', [u.int(req.params.id)]); res.json({ ok: true }); }));

// ---------- Inbox: messages & applications ----------
function inbox(route, table, searchCols) {
  router.get(`/${route}`, wrap(async (req, res) => {
    const where = [], params = [];
    if (['new', 'read', 'done'].includes(req.query.status)) { where.push('status = ?'); params.push(req.query.status); }
    if (req.query.q) { where.push('(' + searchCols.map((c) => `${c} LIKE ?`).join(' OR ') + ')'); searchCols.forEach(() => params.push(`%${u.str(req.query.q, 80)}%`)); }
    res.json(await q(`SELECT * FROM ${table} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC LIMIT 500`, params));
  }));
  router.patch(`/${route}/:id`, wrap(async (req, res) => {
    const sets = [], params = [];
    if (['new', 'read', 'done'].includes(req.body.status)) { sets.push('status = ?'); params.push(req.body.status); }
    if (req.body.admin_note !== undefined) { sets.push('admin_note = ?'); params.push(u.str(req.body.admin_note, 2000)); }
    if (sets.length) await q(`UPDATE ${table} SET ${sets.join(',')} WHERE id = ?`, [...params, u.int(req.params.id)]);
    res.json({ ok: true });
  }));
}
inbox('messages', 'contact_data', ['name', 'email', 'phone', 'message']);
inbox('applications', 'applications', ['name', 'email', 'phone', 'position']);
router.delete('/messages/:id', wrap(async (req, res) => { await q('DELETE FROM contact_data WHERE id = ?', [u.int(req.params.id)]); res.json({ ok: true }); }));
router.delete('/applications/:id', wrap(async (req, res) => {
  const [a] = await q('SELECT cv FROM applications WHERE id = ?', [u.int(req.params.id)]);
  await q('DELETE FROM applications WHERE id = ?', [u.int(req.params.id)]);
  if (a) fs.unlink(cvFile(a.cv), () => {});
  res.json({ ok: true });
}));
router.get('/applications/:id/cv', wrap(async (req, res) => {
  const [a] = await q('SELECT cv, name, original_name FROM applications WHERE id = ?', [u.int(req.params.id)]);
  if (!a) return res.status(404).json({ error: 'Not found' });
  const file = cvFile(a.cv);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'The CV file is missing on the server.' });
  res.download(file, a.original_name || `${a.name} - CV${path.extname(file)}`);
}));
router.get('/export/:what', wrap(async (req, res) => {
  const map = {
    messages: ['SELECT id, name, email, phone, message, status, created_at FROM contact_data ORDER BY id DESC', ['id', 'name', 'email', 'phone', 'message', 'status', 'created_at']],
    applications: ['SELECT id, name, email, phone, position, status, created_at FROM applications ORDER BY id DESC', ['id', 'name', 'email', 'phone', 'position', 'status', 'created_at']],
    reviews: ['SELECT id, client_name, client_type, stars, comment, feedback, status, created_at FROM ratings ORDER BY id DESC', ['id', 'client_name', 'client_type', 'stars', 'comment', 'feedback', 'status', 'created_at']],
  };
  const m = map[req.params.what];
  if (!m) return res.status(404).end();
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${req.params.what}.csv"`);
  res.send('\ufeff' + u.csv(await q(m[0]), m[1]));
}));

// ---------- Media library ----------
const storage = multer.diskStorage({
  destination: (req, file, cb) => { fs.mkdirSync(config.mediaDir, { recursive: true }); cb(null, config.mediaDir); },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path.basename(file.originalname, ext).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'file';
    cb(null, `${base}-${Date.now().toString(36)}${ext}`);
  },
});
const MEDIA_EXT = { '.jpg': 'image', '.jpeg': 'image', '.png': 'image', '.webp': 'image', '.gif': 'image', '.mp4': 'video', '.webm': 'video' };
const uploadMedia = multer({
  storage, limits: { fileSize: 80 * 1024 * 1024, files: 20 },
  fileFilter: (req, file, cb) => (MEDIA_EXT[path.extname(file.originalname).toLowerCase()] && /^(image|video)\//.test(file.mimetype) ? cb(null, true) : cb(new Error('Only JPG, PNG, WEBP, GIF, MP4 and WEBM files are allowed.'))),
});

router.get('/media', wrap(async (req, res) => res.json(await q('SELECT * FROM media ORDER BY id DESC'))));
router.post('/media', uploadMedia.array('files', 20), wrap(async (req, res) => {
  const out = [];
  for (const f of req.files || []) {
    const url = '/media/' + f.filename;
    await q('INSERT INTO media (url, original_name, kind, size) VALUES (?, ?, ?, ?)', [url, f.originalname.slice(0, 250), MEDIA_EXT[path.extname(f.filename).toLowerCase()], f.size]);
    out.push(url);
  }
  await db.log(req.user.name, `Uploaded ${out.length} file(s)`);
  res.status(201).json({ uploaded: out });
}));
router.delete('/media/:id', wrap(async (req, res) => {
  const [m] = await q('SELECT * FROM media WHERE id = ?', [u.int(req.params.id)]);
  if (!m) return res.status(404).json({ error: 'Not found' });
  const like = `%${m.url}%`;
  const used = [];
  if ((await q('SELECT 1 FROM service_categories WHERE image_a = ? OR image_b = ? LIMIT 1', [m.url, m.url])).length) used.push('a service category');
  if ((await q('SELECT 1 FROM gallery_items WHERE src = ? LIMIT 1', [m.url])).length) used.push('the gallery');
  if ((await q("SELECT 1 FROM settings WHERE k NOT LIKE '\\_%' AND v LIKE ? LIMIT 1", [like])).length) used.push('page content (hero, about, brand…)');
  if (used.length && req.query.force !== '1') return res.status(409).json({ error: `This file is still used in ${used.join(', ')}.`, used });
  await q('DELETE FROM media WHERE id = ?', [m.id]);
  await q('DELETE FROM gallery_items WHERE src = ?', [m.url]);
  const file = path.join(config.publicDir, m.url);
  if (/^\/(media|resources)\//.test(m.url) && file.startsWith(config.publicDir)) fs.unlink(file, () => {});
  await db.log(req.user.name, `Deleted media ${m.original_name}`);
  onChange();
  res.json({ ok: true });
}));

// ---------- Team accounts ----------
router.get('/users', auth.requireOwner, wrap(async (req, res) => res.json(await q('SELECT id, name, email, role, active, last_login, created_at FROM admin_users ORDER BY id'))));
router.post('/users', auth.requireOwner, wrap(async (req, res) => {
  const name = u.str(req.body.name, 120), email = u.str(req.body.email, 190).toLowerCase(), password = String(req.body.password || '');
  if (!name || !u.isEmail(email)) return res.status(400).json({ error: 'Enter a name and a valid email.' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  if ((await q('SELECT 1 FROM admin_users WHERE email = ?', [email])).length) return res.status(409).json({ error: 'That email already has an account.' });
  await q('INSERT INTO admin_users (name, email, password_hash, role) VALUES (?, ?, ?, ?)', [name, email, auth.hashPassword(password), req.body.role === 'owner' ? 'owner' : 'editor']);
  res.status(201).json({ ok: true });
}));
router.put('/users/:id', auth.requireOwner, wrap(async (req, res) => {
  const id = u.int(req.params.id);
  if (id === req.user.id && (req.body.active === false || req.body.role === 'editor')) return res.status(400).json({ error: 'You cannot demote or deactivate your own account.' });
  const sets = [], params = [];
  if (req.body.name) { sets.push('name = ?'); params.push(u.str(req.body.name, 120)); }
  if (['owner', 'editor'].includes(req.body.role)) { sets.push('role = ?'); params.push(req.body.role); }
  if (typeof req.body.active === 'boolean') { sets.push('active = ?'); params.push(req.body.active ? 1 : 0); }
  if (req.body.password) {
    if (String(req.body.password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    sets.push('password_hash = ?'); params.push(auth.hashPassword(String(req.body.password)));
  }
  if (sets.length) await q(`UPDATE admin_users SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
  res.json({ ok: true });
}));
router.delete('/users/:id', auth.requireOwner, wrap(async (req, res) => {
  if (u.int(req.params.id) === req.user.id) return res.status(400).json({ error: 'You cannot delete your own account.' });
  await q('DELETE FROM admin_users WHERE id = ?', [u.int(req.params.id)]);
  res.json({ ok: true });
}));
router.post('/account/password', wrap(async (req, res) => {
  const [me] = await q('SELECT * FROM admin_users WHERE id = ?', [req.user.id]);
  if (!auth.verifyPassword(String(req.body.current || ''), me.password_hash)) return res.status(400).json({ error: 'Your current password is incorrect.' });
  const next = String(req.body.next || '');
  if (next.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters.' });
  await q('UPDATE admin_users SET password_hash = ? WHERE id = ?', [auth.hashPassword(next), me.id]);
  const [fresh] = await q('SELECT * FROM admin_users WHERE id = ?', [me.id]);
  await auth.setSession(req, res, fresh); // keep this device signed in
  res.json({ ok: true });
}));

router.post('/email/test', auth.requireOwner, wrap(async (req, res) => {
  const to = u.str(req.body.to, 190);
  if (!u.isEmail(to)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (!mailer.isConfigured()) return res.status(400).json({ error: 'Email is not configured on the server yet (set EMAIL_USER and EMAIL_PASS in .env).' });
  try { await mailer.testEmail(to); res.json({ ok: true }); }
  catch (e) { res.status(502).json({ error: 'The mail server refused the message: ' + e.message }); }
}));

module.exports = router;
