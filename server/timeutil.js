// Time helpers. Appointments are stored as "salon local time" (naive DATETIME strings),
// so the server can run in any timezone. "Now" is always computed in the salon's zone.

const pad = (n) => String(n).padStart(2, '0');

function partsIn(date, tz) {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, hh: +p.hour % 24, mm: +p.minute, ss: +p.second };
}

// Current date/time in the salon's timezone.
function nowIn(tz, at = new Date()) {
  const p = partsIn(at, tz);
  const date = `${p.y}-${pad(p.m)}-${pad(p.d)}`;
  const minutes = p.hh * 60 + p.mm;
  return { date, minutes, iso: `${date} ${pad(p.hh)}:${pad(p.mm)}:${pad(p.ss)}`, epochMin: epochMin(date, minutes) };
}

// Minutes since 1970 for a local date + minutes-of-day (timezone-free comparison key).
const epochMin = (date, minutes = 0) => {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 60000 + minutes;
};

const toMin = (hhmm) => { const [h, m] = String(hhmm).split(':').map(Number); return (h || 0) * 60 + (m || 0); };
const fromMin = (min) => `${pad(Math.floor(min / 60) % 24)}:${pad(min % 60)}`;
const validDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s)) && !isNaN(Date.parse(s + 'T00:00:00Z'));
const validTime = (s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s));

function addDays(date, n) {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}
const weekday = (date) => { const [y, m, d] = date.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); }; // 0 = Sunday
const daysBetween = (a, b) => Math.round((epochMin(b) - epochMin(a)) / 1440);

// 'YYYY-MM-DD HH:MM:SS' from date + minutes-of-day (may roll into the next day)
function stamp(date, minutes) {
  const extra = Math.floor(minutes / 1440);
  const d = extra ? addDays(date, extra) : date;
  const mm = ((minutes % 1440) + 1440) % 1440;
  return `${d} ${fromMin(mm)}:00`;
}
const splitStamp = (s) => ({ date: String(s).slice(0, 10), minutes: toMin(String(s).slice(11, 16)) });

// UTC Date for a salon-local date + minutes (used for calendar files).
function localToUtc(date, minutes, tz) {
  const [y, m, d] = date.split('-').map(Number);
  let guess = Date.UTC(y, m - 1, d, 0, minutes);
  for (let i = 0; i < 2; i++) {
    const p = partsIn(new Date(guess), tz);
    const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm, p.ss);
    const offset = asUtc - guess;
    guess = Date.UTC(y, m - 1, d, 0, minutes) - offset;
  }
  return new Date(guess);
}
const icsStamp = (dt) => dt.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

// ---- friendly formatting ----
const fmtDateLong = (date) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
};
const fmtDateShort = (date) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
};
const fmtTime = (minutes) => {
  const h = Math.floor(minutes / 60) % 24, m = minutes % 60;
  return `${h % 12 || 12}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`;
};
const fmtDuration = (min) => {
  const h = Math.floor(min / 60), m = min % 60;
  return h ? (m ? `${h} hr ${m} min` : `${h} hr`) : `${m} min`;
};
const fmtMoney = (n) => 'KES ' + Number(n || 0).toLocaleString('en-US');

module.exports = { pad, partsIn, nowIn, epochMin, toMin, fromMin, validDate, validTime, addDays, weekday, daysBetween, stamp, splitStamp, localToUtc, icsStamp, fmtDateLong, fmtDateShort, fmtTime, fmtDuration, fmtMoney };
