const crypto = require('crypto');
const db = require('./db');

const COOKIE = 'elx_sid';
const TTL = 1000 * 60 * 60 * 12; // 12 hours

// ---------- passwords (scrypt) ----------
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}
function verifyPassword(password, stored) {
  const [alg, salt, hash] = String(stored).split('$');
  if (alg !== 'scrypt' || !salt || !hash) return false;
  const test = crypto.scryptSync(password, salt, 64);
  const real = Buffer.from(hash, 'hex');
  return real.length === test.length && crypto.timingSafeEqual(real, test);
}
const pv = (hash) => crypto.createHash('sha256').update(hash).digest('hex').slice(0, 10);

// ---------- signed session tokens ----------
let secret;
async function getSecret() {
  if (!secret) secret = await db.getSetting('_secret');
  return secret;
}
const b64 = (s) => Buffer.from(s).toString('base64url');

async function sign(user) {
  const body = b64(JSON.stringify({ uid: user.id, exp: Date.now() + TTL, pv: pv(user.password_hash) }));
  const mac = crypto.createHmac('sha256', await getSecret()).update(body).digest('base64url');
  return `${body}.${mac}`;
}

async function readToken(token) {
  if (!token || !token.includes('.')) return null;
  const [body, mac] = token.split('.');
  const good = crypto.createHmac('sha256', await getSecret()).update(body).digest('base64url');
  const a = Buffer.from(mac), b = Buffer.from(good);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (!data.exp || data.exp < Date.now()) return null;
    return data;
  } catch { return null; }
}

function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach((p) => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

async function setSession(req, res, user) {
  const secure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.setHeader('Set-Cookie', `${COOKIE}=${await sign(user)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${TTL / 1000}${secure ? '; Secure' : ''}`);
}
function clearSession(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);
}

// ---------- middleware ----------
async function getUser(req) {
  const data = await readToken(parseCookies(req)[COOKIE]);
  if (!data) return null;
  const rows = await db.q('SELECT id, name, email, role, active, password_hash FROM admin_users WHERE id = ?', [data.uid]);
  const u = rows[0];
  if (!u || !u.active || pv(u.password_hash) !== data.pv) return null;
  return { id: u.id, name: u.name, email: u.email, role: u.role };
}

async function requireAuth(req, res, next) {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'Please sign in.' });
    req.user = user;
    // CSRF guard for state-changing requests (cookie is SameSite=Strict as well).
    if (!['GET', 'HEAD'].includes(req.method) && req.headers['x-requested-with'] !== 'elixir-admin') {
      return res.status(403).json({ error: 'Blocked request.' });
    }
    next();
  } catch (e) { next(e); }
}
const requireOwner = (req, res, next) =>
  req.user.role === 'owner' ? next() : res.status(403).json({ error: 'Only the owner can do this.' });

// ---------- tiny in-memory rate limiter ----------
function rateLimit({ windowMs, max, key = (req) => req.ip, message = 'Too many attempts. Please try again later.' }) {
  const hits = new Map();
  setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (v.reset < now) hits.delete(k); }, 60000).unref();
  const limiter = (req, res, next) => {
    const k = key(req), now = Date.now();
    let h = hits.get(k);
    if (!h || h.reset < now) h = { n: 0, reset: now + windowMs };
    h.n += 1; hits.set(k, h);
    if (h.n > max) return res.status(429).json({ error: message });
    next();
  };
  limiter.clear = (k) => hits.delete(k);
  return limiter;
}

async function bootstrapAdmin(cfg) {
  const [{ n }] = await db.q('SELECT COUNT(*) AS n FROM admin_users');
  if (n || !cfg.email || !cfg.password) return;
  await db.q('INSERT INTO admin_users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
    [cfg.name, cfg.email.toLowerCase(), hashPassword(cfg.password), 'owner']);
  console.log(`Created owner account for ${cfg.email}`);
}

module.exports = { hashPassword, verifyPassword, setSession, clearSession, getUser, requireAuth, requireOwner, rateLimit, bootstrapAdmin };
