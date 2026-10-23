// Booking engine – availability, double-booking-proof creation, reschedule / cancel, calendar files.
const crypto = require('crypto');
const db = require('./db');
const T = require('./timeutil');
const seed = require('./seed-data');

class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const err = (status, msg) => new HttpError(status, msg);

const ACTIVE = "('pending','confirmed')";
const q = (sql, params) => db.q(sql, params);

// ---------------------------------------------------------------- settings
async function getSched() {
  const s = (await db.getSetting('scheduling')) || {};
  const d = seed.settings.scheduling;
  const out = { ...d, ...s };
  out.hours = d.hours.map((h) => ({ ...h, ...((s.hours || []).find((x) => +x.day === h.day) || {}) }));
  for (const k of ['slotMinutes', 'leadHours', 'advanceDays', 'bufferMinutes', 'cancelHours', 'maxActive', 'maxServices', 'reminderHours']) out[k] = Number(out[k]) || 0;
  out.slotMinutes = out.slotMinutes || 30; out.maxServices = out.maxServices || 6; out.advanceDays = out.advanceDays || 60;
  out.enabled = out.enabled !== false; out.autoConfirm = out.autoConfirm !== false; out.requireEmail = out.requireEmail !== false;
  return out;
}

// ---------------------------------------------------------------- helpers
function parsePrice(text) {
  const nums = (String(text || '').match(/\d[\d,]*/g) || []).map((n) => parseInt(n.replace(/,/g, ''), 10)).filter(Number.isFinite);
  return nums.length ? { min: Math.min(...nums), max: Math.max(...nums), known: true } : { min: 0, max: 0, known: false };
}
function normalizePhone(p) {
  let d = String(p || '').replace(/[^\d+]/g, '');
  const plus = d.startsWith('+'); d = d.replace(/\+/g, '');
  if (!plus) {
    if (/^0[17]\d{8}$/.test(d)) return '+254' + d.slice(1);
    if (/^[17]\d{8}$/.test(d)) return '+254' + d;
    if (/^254[17]\d{8}$/.test(d)) return '+' + d;
  }
  return /^\d{9,15}$/.test(d) ? '+' + d : '';
}
const CODE = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const code = (n) => Array.from(crypto.randomBytes(n), (b) => CODE[b % CODE.length]).join('');
const staffRow = (r) => ({
  id: r.id, name: r.name, title: r.title, photo: r.photo, selectable: !!r.selectable, active: !!r.active, sort: r.sort_order,
  cats: r.categories ? (() => { try { return JSON.parse(r.categories); } catch { return null; } })() : null,
  days: String(r.work_days || '').split(',').filter((x) => x !== '').map(Number),
});
async function loadStaff(conn) {
  const [rows] = await (conn || db.pool()).query('SELECT * FROM staff ORDER BY sort_order, id');
  return rows.map(staffRow);
}
async function loadServices(ids) {
  if (!ids.length) return [];
  return q(`SELECT si.id, si.name, si.price, si.duration_min, si.bookable, si.visible, sc.id AS category_id, sc.name AS category, sc.visible AS cat_visible
            FROM service_items si JOIN service_categories sc ON sc.id = si.category_id WHERE si.id IN (?)`, [ids]);
}
const parseIds = (v, max = 12) => [...new Set((Array.isArray(v) ? v : String(v || '').split(',')).map((x) => parseInt(x, 10)).filter((n) => n > 0))].slice(0, max);

// Turn requested ids into a validated service list (keeps the requested order).
async function resolveServices(ids, sched, admin) {
  if (!ids.length) throw err(400, 'Please choose at least one service.');
  if (ids.length > sched.maxServices) throw err(400, `You can book up to ${sched.maxServices} services at a time.`);
  const rows = await loadServices(ids);
  const list = ids.map((id) => rows.find((r) => r.id === id)).filter(Boolean);
  if (list.length !== ids.length || list.some((r) => !admin && (!r.bookable || !r.visible || !r.cat_visible))) throw err(400, 'One of the selected services is no longer available.');
  const total = list.reduce((a, r) => { const p = parsePrice(r.price); return { dur: a.dur + r.duration_min, min: a.min + p.min, max: a.max + p.max }; }, { dur: 0, min: 0, max: 0 });
  return { list, duration: total.dur, priceMin: total.min, priceMax: total.max, catIds: [...new Set(list.map((r) => r.category_id))] };
}

// ---------------------------------------------------------------- availability core
const eligible = (staff, catIds, wd, filter) => staff.filter((s) => s.active && s.days.includes(wd) && (!s.cats || catIds.every((c) => s.cats.includes(c))) && (filter === 'any' || s.id === filter));
const absOf = (stampStr) => T.epochMin(stampStr.slice(0, 10), T.toMin(stampStr.slice(11, 16)));

async function loadBusy(from, to, conn, excludeId) {
  const c = conn || db.pool();
  const end = `${T.addDays(to, 1)} 00:00:00`, start = `${T.addDays(from, -1)} 00:00:00`;
  const [bk] = await c.query(`SELECT id, staff_id, starts_at, ends_at FROM bookings WHERE status IN ${ACTIVE} AND starts_at < ? AND ends_at > ? ${excludeId ? 'AND id <> ?' : ''}`, excludeId ? [end, start, excludeId] : [end, start]);
  const [bl] = await c.query('SELECT staff_id, starts_at, ends_at FROM time_blocks WHERE starts_at < ? AND ends_at > ?', [end, start]);
  return { bookings: bk.map((b) => ({ staff_id: b.staff_id, s: absOf(b.starts_at), e: absOf(b.ends_at) })), blocks: bl.map((b) => ({ staff_id: b.staff_id, s: absOf(b.starts_at), e: absOf(b.ends_at) })) };
}

// Everything needed to answer "which start times are free on this date?"
function buildDay({ date, duration, catIds, staffFilter, sched, staff, busy, now, admin }) {
  const empty = { slots: [], per: new Map(), res: [] };
  const wd = T.weekday(date);
  const h = sched.hours.find((x) => x.day === wd);
  if (!h || !h.open) return empty;
  if (!admin && (date < now.date || T.daysBetween(now.date, date) > sched.advanceDays)) return empty;
  const res = eligible(staff, catIds, wd, staffFilter);
  if (!res.length) return empty;

  const open = T.toMin(h.from), close = T.toMin(h.to), step = sched.slotMinutes, buf = sched.bufferMinutes;
  const base = T.epochMin(date);
  const salon = busy.blocks.filter((b) => b.staff_id == null);
  const per = new Map(res.map((r) => [r.id, [...salon, ...busy.blocks.filter((b) => b.staff_id === r.id), ...busy.bookings.filter((b) => b.staff_id === r.id).map((b) => ({ s: b.s, e: b.e + buf }))]]));
  const earliest = admin ? -Infinity : now.epochMin + sched.leadHours * 60;
  const slots = [];
  for (let t = open; t + duration <= close; t += step) {
    const s = base + t, e = s + duration + buf;
    if (s < earliest) continue;
    const free = res.filter((r) => per.get(r.id).every((iv) => !(s < iv.e && e > iv.s)));
    if (free.length) slots.push({ time: T.fromMin(t), staffIds: free.map((r) => r.id) });
  }
  return { slots, per, res, base, open };
}

// "Best fit": give the booking to the free person whose previous appointment ends closest to it,
// which keeps the rest of the day open for longer services.
function pickStaff(day, slot) {
  const s = day.base + T.toMin(slot.time);
  let best = null;
  for (const id of slot.staffIds) {
    const prevEnd = Math.max(day.base + day.open, ...day.per.get(id).filter((iv) => iv.e <= s).map((iv) => iv.e));
    const gap = s - prevEnd;
    if (!best || gap < best.gap) best = { id, gap };
  }
  return best.id;
}

const staffFilterOf = (v) => (v === undefined || v === null || v === '' || v === 'any' ? 'any' : parseInt(v, 10) || 'any');

async function dayContext(sched, { services, staff, excludeId, admin }, from, to) {
  const sv = await resolveServices(parseIds(services), sched, admin);
  const staffList = await loadStaff();
  const busy = await loadBusy(from, to, null, excludeId);
  return { sv, staffList, busy, now: T.nowIn(sched.timezone) };
}

async function availability({ date, services, staff, excludeId, admin = false }) {
  const sched = await getSched();
  if (!T.validDate(date)) throw err(400, 'Invalid date.');
  const c = await dayContext(sched, { services, staff, excludeId, admin }, date, date);
  const day = buildDay({ date, duration: c.sv.duration, catIds: c.sv.catIds, staffFilter: staffFilterOf(staff), sched, staff: c.staffList, busy: c.busy, now: c.now, admin });
  return { date, duration: c.sv.duration, priceMin: c.sv.priceMin, priceMax: c.sv.priceMax, slots: day.slots.map((s) => ({ time: s.time, label: T.fmtTime(T.toMin(s.time)) })) };
}

async function monthDays({ month, services, staff, excludeId, admin = false }) {
  const sched = await getSched();
  if (!/^\d{4}-\d{2}$/.test(month || '')) throw err(400, 'Invalid month.');
  const first = `${month}-01`, last = T.addDays(T.addDays(first, 32).slice(0, 8) + '01', -1);
  const c = await dayContext(sched, { services, staff, excludeId, admin }, first, last);
  const limitTo = admin ? last : T.addDays(c.now.date, sched.advanceDays);
  const days = {};
  for (let d = first; d <= last; d = T.addDays(d, 1)) {
    if (d < c.now.date && !admin) continue;
    if (d > limitTo) break;
    const n = buildDay({ date: d, duration: c.sv.duration, catIds: c.sv.catIds, staffFilter: staffFilterOf(staff), sched, staff: c.staffList, busy: c.busy, now: c.now, admin }).slots.length;
    if (n) days[d] = n;
  }
  return { month, today: c.now.date, maxDate: T.addDays(c.now.date, sched.advanceDays), days };
}

async function nextAvailable({ services, staff, from, admin = false }) {
  const sched = await getSched();
  const now = T.nowIn(sched.timezone);
  const start = from && T.validDate(from) && from > now.date ? from : now.date;
  const span = Math.min(sched.advanceDays, 120);
  const c = await dayContext(sched, { services, staff, admin }, start, T.addDays(start, span));
  for (let i = 0; i <= span; i++) {
    const d = T.addDays(start, i);
    const day = buildDay({ date: d, duration: c.sv.duration, catIds: c.sv.catIds, staffFilter: staffFilterOf(staff), sched, staff: c.staffList, busy: c.busy, now: c.now, admin });
    if (day.slots.length) return { date: d, first: day.slots[0].time };
  }
  return { date: null };
}

// ---------------------------------------------------------------- reading bookings
const fmtBooking = (b, items) => {
  const s = T.splitStamp(b.starts_at), e = T.splitStamp(b.ends_at);
  return {
    id: b.id, reference: b.reference, token: b.token, status: b.status, source: b.source,
    name: b.client_name, phone: b.client_phone, email: b.client_email, notes: b.notes, adminNote: b.admin_note || '',
    staffId: b.staff_id, staffName: b.staff_name || '', staffRequested: !!b.staff_requested,
    date: s.date, start: T.fromMin(s.minutes), end: T.fromMin(e.minutes), startMin: s.minutes, endMin: e.minutes,
    startsAt: b.starts_at, endsAt: b.ends_at, duration: b.duration_min, priceMin: b.price_min, priceMax: b.price_max,
    cancelReason: b.cancel_reason, cancelledBy: b.cancelled_by, createdAt: b.created_at,
    items: (items || []).map((i) => ({ id: i.service_id, categoryId: i.category_id, name: i.name, category: i.category, price: i.price_text, duration: i.duration_min, min: i.price_min, max: i.price_max })),
  };
};
async function attachItems(rows) {
  if (!rows.length) return [];
  const items = await q('SELECT * FROM booking_items WHERE booking_id IN (?) ORDER BY sort_order, id', [rows.map((r) => r.id)]);
  return rows.map((r) => fmtBooking(r, items.filter((i) => i.booking_id === r.id)));
}
const SELECT = 'SELECT b.*, s.name AS staff_name FROM bookings b LEFT JOIN staff s ON s.id = b.staff_id';
async function getBooking(by, value) {
  const col = { id: 'b.id', token: 'b.token', ref: 'b.reference' }[by];
  const rows = await attachItems(await q(`${SELECT} WHERE ${col} = ? LIMIT 1`, [value]));
  return rows[0] || null;
}

// ---------------------------------------------------------------- writing bookings
function checkContact(inp, sched, admin) {
  const name = String(inp.name || '').trim().replace(/\s+/g, ' ').slice(0, 120);
  const phone = normalizePhone(inp.phone);
  const email = String(inp.email || '').trim().slice(0, 190);
  if (name.length < 2) throw err(400, 'Please enter your name.');
  if (!phone) throw err(400, 'Please enter a valid phone number, for example 0712 345 678.');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw err(400, 'Please enter a valid email address.');
  if (!email && sched.requireEmail && !admin) throw err(400, 'Please enter your email so we can send your confirmation.');
  return { name, phone, email, notes: String(inp.notes || '').trim().slice(0, 1000) };
}

async function withLock(fn) {
  const conn = await db.pool().getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('SELECT id FROM staff WHERE active = 1 ORDER BY id FOR UPDATE'); // serialises concurrent bookings
    const out = await fn(conn);
    await conn.commit();
    return out;
  } catch (e) { try { await conn.rollback(); } catch { /* ignore */ } throw e; } finally { conn.release(); }
}

const reminderDone = (sched, now, date, startMin) => !sched.reminderHours || (T.epochMin(date, startMin) - now.epochMin) <= sched.reminderHours * 60 ? 1 : 0;

async function createBooking(inp, { admin = false, force = false } = {}) {
  const sched = await getSched();
  if (!admin && !sched.enabled) throw err(503, 'Online booking is currently unavailable. Please call us to book.');
  const ids = parseIds(inp.services);
  const sv = await resolveServices(ids, sched, admin);
  const contact = checkContact(inp, sched, admin);
  const { date, time } = inp;
  if (!T.validDate(date) || !T.validTime(time)) throw err(400, 'Please choose a date and time.');
  const filter = staffFilterOf(inp.staff);
  const startMin = T.toMin(time);

  const id = await withLock(async (conn) => {
    const now = T.nowIn(sched.timezone);
    if (!admin) {
      const [[{ n }]] = await conn.query(`SELECT COUNT(*) AS n FROM bookings WHERE status IN ${ACTIVE} AND starts_at >= ? AND (client_phone = ? OR (? <> '' AND client_email = ?))`, [now.iso, contact.phone, contact.email, contact.email]);
      if (sched.maxActive && n >= sched.maxActive) throw err(429, `You already have ${n} upcoming appointment${n > 1 ? 's' : ''}. Please manage or cancel one of them, or call us to add more.`);
    }
    const staff = await loadStaff(conn);
    const busy = await loadBusy(date, date, conn);
    const day = buildDay({ date, duration: sv.duration, catIds: sv.catIds, staffFilter: filter, sched, staff, busy, now, admin });
    const slot = day.slots.find((s) => s.time === time);
    let staffId;
    if (slot) staffId = pickStaff(day, slot);
    else if (force) staffId = (filter !== 'any' ? filter : staff.find((s) => s.active)?.id) || null;
    else throw err(409, 'Sorry, that time has just been taken. Please choose another time.');

    const status = admin ? (['pending', 'confirmed'].includes(inp.status) ? inp.status : 'confirmed') : sched.autoConfirm ? 'confirmed' : 'pending';
    const startsAt = T.stamp(date, startMin), endsAt = T.stamp(date, startMin + sv.duration);
    let bookingId;
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        const [r] = await conn.query(
          `INSERT INTO bookings (reference, token, status, source, client_name, client_phone, client_email, notes, staff_id, staff_requested, starts_at, ends_at, duration_min, price_min, price_max, reminder_sent)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          ['EL-' + code(6), crypto.randomBytes(18).toString('base64url'), status, admin ? 'admin' : 'online', contact.name, contact.phone, contact.email, contact.notes, staffId, filter === 'any' ? 0 : 1, startsAt, endsAt, sv.duration, sv.priceMin, sv.priceMax, reminderDone(sched, now, date, startMin)]);
        bookingId = r.insertId; break;
      } catch (e) { if (e.code !== 'ER_DUP_ENTRY' || attempt === 5) throw e; }
    }
    let i = 0;
    for (const s of sv.list) {
      const p = parsePrice(s.price);
      await conn.query('INSERT INTO booking_items (booking_id, service_id, category_id, name, category, price_text, duration_min, price_min, price_max, sort_order) VALUES (?,?,?,?,?,?,?,?,?,?)',
        [bookingId, s.id, s.category_id, s.name, s.category, s.price, s.duration_min, p.min, p.max, ++i]);
    }
    return bookingId;
  });
  return getBooking('id', id);
}

const insideCancelWindow = (b, sched) => T.epochMin(b.date, b.startMin) - T.nowIn(sched.timezone).epochMin >= sched.cancelHours * 60;

async function rescheduleBooking(id, { date, time, staff }, { admin = false, force = false } = {}) {
  const sched = await getSched();
  const cur = await getBooking('id', id);
  if (!cur) throw err(404, 'Booking not found.');
  if (!['pending', 'confirmed'].includes(cur.status)) throw err(400, 'This booking can no longer be changed.');
  if (!admin && !insideCancelWindow(cur, sched)) throw err(403, `Changes can be made up to ${sched.cancelHours} hours before the appointment. Please call us and we will help.`);
  if (!T.validDate(date) || !T.validTime(time)) throw err(400, 'Please choose a date and time.');
  const filter = staff === undefined ? (cur.staffRequested ? cur.staffId : 'any') : staffFilterOf(staff);
  const catIds = [...new Set(cur.items.map((i) => i.categoryId).filter(Boolean))];

  await withLock(async (conn) => {
    const now = T.nowIn(sched.timezone);
    const staffList = await loadStaff(conn);
    const busy = await loadBusy(date, date, conn, id);
    const day = buildDay({ date, duration: cur.duration, catIds, staffFilter: filter, sched, staff: staffList, busy, now, admin });
    const slot = day.slots.find((s) => s.time === time);
    let staffId;
    if (slot) staffId = pickStaff(day, slot);
    else if (force) staffId = (filter !== 'any' ? filter : cur.staffId) || null;
    else throw err(409, 'Sorry, that time is no longer available. Please choose another.');
    const status = admin ? cur.status : sched.autoConfirm ? 'confirmed' : 'pending';
    await conn.query('UPDATE bookings SET starts_at = ?, ends_at = ?, staff_id = ?, staff_requested = ?, status = ?, reminder_sent = ? WHERE id = ?',
      [T.stamp(date, T.toMin(time)), T.stamp(date, T.toMin(time) + cur.duration), staffId, filter === 'any' ? 0 : 1, status, reminderDone(sched, now, date, T.toMin(time)), id]);
  });
  return getBooking('id', id);
}

async function cancelBooking(id, { by = 'client', reason = '' } = {}) {
  const sched = await getSched();
  const cur = await getBooking('id', id);
  if (!cur) throw err(404, 'Booking not found.');
  if (!['pending', 'confirmed'].includes(cur.status)) throw err(400, 'This booking is already closed.');
  if (by === 'client' && !insideCancelWindow(cur, sched)) throw err(403, `Online cancellation closes ${sched.cancelHours} hours before the appointment. Please call us and we will help.`);
  await q("UPDATE bookings SET status = 'cancelled', cancelled_by = ?, cancel_reason = ? WHERE id = ?", [by, String(reason).slice(0, 300), id]);
  return getBooking('id', id);
}

async function setStatus(id, status, reason = '') {
  const allowed = ['pending', 'confirmed', 'completed', 'no_show', 'cancelled', 'declined'];
  if (!allowed.includes(status)) throw err(400, 'Invalid status.');
  const cur = await getBooking('id', id);
  if (!cur) throw err(404, 'Booking not found.');
  if (['pending', 'confirmed'].includes(status) && !['pending', 'confirmed'].includes(cur.status)) {
    // Re-opening a closed booking: make sure the time is still free.
    const a = await availability({ date: cur.date, services: cur.items.map((i) => i.id).filter(Boolean), staff: cur.staffId || 'any', excludeId: id, admin: true }).catch(() => ({ slots: [] }));
    if (!a.slots.some((s) => s.time === cur.start)) throw err(409, 'That time is no longer free, so the booking cannot be re-opened. Use Reschedule instead.');
  }
  await q('UPDATE bookings SET status = ?, cancelled_by = ?, cancel_reason = ? WHERE id = ?', [status, ['cancelled', 'declined'].includes(status) ? 'admin' : '', ['cancelled', 'declined'].includes(status) ? String(reason).slice(0, 300) : '', id]);
  return getBooking('id', id);
}

// ---------------------------------------------------------------- calendar file
const icsEsc = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const fold = (line) => { const out = []; let l = line; while (Buffer.byteLength(l) > 74) { let cut = 74; while (Buffer.byteLength(l.slice(0, cut)) > 74) cut--; out.push(l.slice(0, cut)); l = ' ' + l.slice(cut); } out.push(l); return out.join('\r\n'); };

function buildIcs(b, { brandName, address, phone, manageUrl, tz }) {
  const start = T.localToUtc(b.date, b.startMin, tz), end = T.localToUtc(b.date, b.endMin, tz);
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:-//${brandName}//Booking//EN`, 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT', `UID:${b.reference}@booking`, `DTSTAMP:${T.icsStamp(new Date())}`, `DTSTART:${T.icsStamp(start)}`, `DTEND:${T.icsStamp(end)}`,
    `SUMMARY:${icsEsc(`${brandName} – ${b.items.map((i) => i.name).join(', ')}`)}`, `LOCATION:${icsEsc(`${brandName}, ${address}`)}`,
    `DESCRIPTION:${icsEsc(`Booking ${b.reference}\n${b.items.map((i) => `${i.name} (${T.fmtDuration(i.duration)})`).join('\n')}${manageUrl ? `\nManage or cancel: ${manageUrl}` : ''}${phone ? `\nQuestions? Call ${phone}` : ''}`)}`,
    `STATUS:${b.status === 'confirmed' ? 'CONFIRMED' : 'TENTATIVE'}`,
    'BEGIN:VALARM', 'TRIGGER:-PT2H', 'ACTION:DISPLAY', `DESCRIPTION:${icsEsc(`Appointment at ${brandName}`)}`, 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}

// What the public booking widget needs to know (never includes private data).
async function publicConfig() {
  const sched = await getSched();
  const staff = (await loadStaff()).filter((s) => s.active && s.selectable).map((s) => ({ id: s.id, name: s.name, title: s.title, photo: s.photo, cats: s.cats }));
  return {
    enabled: sched.enabled, timezone: sched.timezone, slotMinutes: sched.slotMinutes, leadHours: sched.leadHours, advanceDays: sched.advanceDays,
    autoConfirm: sched.autoConfirm, cancelHours: sched.cancelHours, maxServices: sched.maxServices, requireEmail: sched.requireEmail,
    hours: sched.hours.map((h) => ({ day: h.day, name: h.name, open: h.open, from: h.from, to: h.to })), staff,
  };
}

module.exports = {
  HttpError, err, getSched, parsePrice, normalizePhone, parseIds, staffFilterOf, loadStaff, availability, monthDays, nextAvailable,
  createBooking, rescheduleBooking, cancelBooking, setStatus, getBooking, attachItems, SELECT, fmtBooking, buildIcs, publicConfig, insideCancelWindow,
};
