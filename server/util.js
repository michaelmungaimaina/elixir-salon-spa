const SAFE_URL = /^(https?:\/\/|mailto:|tel:|\/(?!\/)|#|\?)/i;

const str = (v, max = 500) => String(v ?? '').replace(/\u0000/g, '').trim().slice(0, max);
const url = (v) => { const s = str(v, 600); return !s || SAFE_URL.test(s) ? s : ''; };
const bool = (v) => (v === true || v === 1 || v === '1' || v === 'true' ? 1 : 0);
const int = (v, d = 0) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d; };
const date = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? v : null);
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 190;
const isPhone = (v) => { const d = String(v).replace(/[\s\-().+]/g, ''); return /^\d{9,15}$/.test(d); };
const hex = (v, d) => (/^#[0-9a-f]{6}$/i.test(String(v)) ? String(v) : d);

// Deep-clean a settings object: trims strings, validates URL-ish keys, caps sizes.
const URLISH = /(url|image|logo|slides?|src|favicon)$/i;
function clean(value, key = '', depth = 0) {
  if (depth > 6) return null;
  if (Array.isArray(value)) return value.slice(0, 200).map((v) => clean(v, key, depth + 1));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === '__proto__' || k === 'constructor') continue;
      out[k] = clean(v, k, depth + 1);
    }
    return out;
  }
  if (typeof value === 'string') return URLISH.test(key) ? url(value) : str(value, 20000);
  if (typeof value === 'boolean' || typeof value === 'number') return value;
  return '';
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const csv = (rows, cols) =>
  [cols.join(','), ...rows.map((r) => cols.map((c) => `"${String(r[c] ?? '').replace(/"/g, '""')}"`).join(','))].join('\r\n');

module.exports = { str, url, bool, int, date, isEmail, isPhone, hex, clean, esc, csv };
