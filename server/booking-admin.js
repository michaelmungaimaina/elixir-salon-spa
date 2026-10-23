// Admin API for bookings, specialists, closures and the email log. Mounted inside the authenticated admin router.
const express = require('express');
const db = require('./db');
const B = require('./booking');
const BM = require('./booking-mail');
const mailer = require('./mailer');
const T = require('./timeutil');
const u = require('./util');
const auth = require('./auth');

const router = express.Router();
const { q } = db;
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch((e) => (e instanceof B.HttpError ? res.status(e.status).json({ error: e.message }) : next(e)));
const ACTIVE = "('pending','confirmed')";
const notify = (req) => req.body.notify !== false;

// ---------------------------------------------------------------- bookings
router.get('/bookings', wrap(async (req, res) => {
  const sched = await B.getSched(); const now = T.nowIn(sched.timezone);
  const scope = req.query.scope || 'upcoming', where = [], params = [];
  if (scope === 'upcoming') { where.push(`b.status IN ${ACTIVE} AND b.starts_at >= ?`); params.push(now.iso); }
  else if (scope === 'pending') where.push("b.status = 'pending'");
  else if (scope === 'today') { where.push("b.status NOT IN ('cancelled','declined') AND DATE(b.starts_at) = ?"); params.push(now.date); }
  else if (scope === 'past') { where.push('b.starts_at < ?'); params.push(now.iso); }
  else if (scope === 'cancelled') where.push("b.status IN ('cancelled','declined')");
  if (req.query.q) { const like = `%${u.str(req.query.q, 60)}%`; where.push('(b.client_name LIKE ? OR b.client_phone LIKE ? OR b.client_email LIKE ? OR b.reference LIKE ?)'); params.push(like, like, like, like); }
  const order = ['upcoming', 'pending', 'today'].includes(scope) ? 'ASC' : 'DESC';
  res.json(await B.attachItems(await q(`${B.SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY b.starts_at ${order} LIMIT 300`, params)));
}));

router.get('/bookings/day', wrap(async (req, res) => {
  const sched = await B.getSched();
  const date = T.validDate(req.query.date) ? req.query.date : T.nowIn(sched.timezone).date;
  const h = sched.hours.find((x) => x.day === T.weekday(date));
  const bookings = await B.attachItems(await q(`${B.SELECT} WHERE DATE(b.starts_at) = ? AND b.status NOT IN ('cancelled','declined') ORDER BY b.starts_at`, [date]));
  const blocks = await q('SELECT id, staff_id, starts_at, ends_at, reason FROM time_blocks WHERE starts_at < ? AND ends_at > ?', [`${T.addDays(date, 1)} 00:00:00`, `${date} 00:00:00`]);
  const staff = (await B.loadStaff()).filter((s) => s.active).map((s) => ({ id: s.id, name: s.name, title: s.title, working: s.days.includes(T.weekday(date)) }));
  res.json({ date, today: T.nowIn(sched.timezone), open: h && h.open ? { from: h.from, to: h.to } : null, staff, bookings, blocks });
}));

router.get('/bookings/:id', wrap(async (req, res) => {
  const b = await B.getBooking('id', u.int(req.params.id));
  if (!b) return res.status(404).json({ error: 'Not found' });
  res.json({ ...b, emails: await q('SELECT kind, status, error, created_at FROM email_log WHERE booking_id = ? ORDER BY id DESC LIMIT 10', [b.id]), whatsapp: BM.varsOf(b) });
}));

router.post('/bookings', wrap(async (req, res) => {
  const b = await B.createBooking(req.body, { admin: true, force: !!req.body.force });
  if (notify(req) && b.email) BM.bg(BM.toClient(b.status === 'confirmed' ? 'confirmed' : 'received', b));
  res.status(201).json(b);
}));

router.patch('/bookings/:id', wrap(async (req, res) => {
  const id = u.int(req.params.id);
  let b = await B.getBooking('id', id);
  if (!b) return res.status(404).json({ error: 'Not found' });
  const prev = b.status;
  if (req.body.admin_note !== undefined) await q('UPDATE bookings SET admin_note = ? WHERE id = ?', [u.str(req.body.admin_note, 2000), id]);
  if (req.body.status && req.body.status !== prev) {
    b = await B.setStatus(id, req.body.status, u.str(req.body.reason, 300));
    if (notify(req) && b.email) {
      if (b.status === 'confirmed' && prev === 'pending') BM.bg(BM.toClient('confirmed', b));
      else if (b.status === 'cancelled') BM.bg(BM.toClient('cancelled', b));
      else if (b.status === 'declined') BM.bg(BM.toClient('declined', b));
    }
  }
  res.json(await B.getBooking('id', id));
}));

router.post('/bookings/:id/reschedule', wrap(async (req, res) => {
  const b = await B.rescheduleBooking(u.int(req.params.id), { date: req.body.date, time: req.body.time, staff: req.body.staff }, { admin: true, force: !!req.body.force });
  if (notify(req) && b.email) BM.bg(BM.toClient('updated', b));
  res.json(b);
}));

router.post('/bookings/:id/reminder', wrap(async (req, res) => {
  const b = await B.getBooking('id', u.int(req.params.id));
  if (!b || !b.email) return res.status(400).json({ error: 'This booking has no email address.' });
  const r = await BM.toClient('reminder', b);
  if (r.status === 'failed') return res.status(502).json({ error: 'The mail server refused the message: ' + r.error });
  res.json({ ok: true, status: r.status });
}));

router.delete('/bookings/:id', wrap(async (req, res) => { await q('DELETE FROM bookings WHERE id = ?', [u.int(req.params.id)]); res.json({ ok: true }); }));

// Availability helpers for the admin screens (no minimum-notice / booking-window limits).
router.get('/availability', wrap(async (req, res) => res.json(await B.availability({ date: req.query.date, services: req.query.services, staff: req.query.staff, excludeId: u.int(req.query.exclude) || undefined, admin: true }))));
router.get('/availability/days', wrap(async (req, res) => res.json(await B.monthDays({ month: req.query.month, services: req.query.services, staff: req.query.staff, excludeId: u.int(req.query.exclude) || undefined, admin: true }))));

// ---------------------------------------------------------------- specialists
const cleanStaff = async (b) => {
  const cats = (Array.isArray(b.categories) ? b.categories : []).map((x) => u.int(x)).filter(Boolean);
  const total = (await q('SELECT COUNT(*) AS n FROM service_categories'))[0].n;
  const days = [...new Set((Array.isArray(b.work_days) ? b.work_days : String(b.work_days || '').split(',')).map((x) => parseInt(x, 10)).filter((n) => n >= 0 && n <= 6))].sort();
  return {
    name: u.str(b.name, 120), title: u.str(b.title, 160), photo: u.url(b.photo),
    categories: cats.length && cats.length < total ? JSON.stringify(cats) : null,
    work_days: days.join(','), selectable: u.bool(b.selectable), active: u.bool(b.active),
  };
};
const staffOut = (r) => ({ ...r, categories: r.categories ? JSON.parse(r.categories) : null, work_days: String(r.work_days).split(',').filter(Boolean).map(Number) });

router.get('/staff', wrap(async (req, res) => res.json((await q('SELECT * FROM staff ORDER BY sort_order, id')).map(staffOut))));
router.post('/staff', wrap(async (req, res) => {
  const s = await cleanStaff(req.body);
  if (!s.name) return res.status(400).json({ error: 'Please enter a name.' });
  const [{ m }] = await q('SELECT COALESCE(MAX(sort_order), 0) m FROM staff');
  const [r] = await db.pool().query('INSERT INTO staff (name, title, photo, categories, work_days, selectable, active, sort_order) VALUES (?,?,?,?,?,?,?,?)', [s.name, s.title, s.photo, s.categories, s.work_days, s.selectable, s.active, m + 1]);
  res.status(201).json({ id: r.insertId });
}));
router.put('/staff/:id', wrap(async (req, res) => {
  const s = await cleanStaff(req.body);
  if (!s.name) return res.status(400).json({ error: 'Please enter a name.' });
  await q('UPDATE staff SET name=?, title=?, photo=?, categories=?, work_days=?, selectable=?, active=? WHERE id=?', [s.name, s.title, s.photo, s.categories, s.work_days, s.selectable, s.active, u.int(req.params.id)]);
  res.json({ ok: true });
}));
router.delete('/staff/:id', wrap(async (req, res) => {
  const id = u.int(req.params.id), now = T.nowIn((await B.getSched()).timezone);
  const [{ n }] = await q(`SELECT COUNT(*) AS n FROM bookings WHERE staff_id = ? AND status IN ${ACTIVE} AND starts_at >= ?`, [id, now.iso]);
  if (n) return res.status(409).json({ error: `This person has ${n} upcoming booking${n > 1 ? 's' : ''}. Reschedule or cancel them first, or switch the person to “inactive” instead of deleting.` });
  await q('DELETE FROM staff WHERE id = ?', [id]);
  res.json({ ok: true });
}));
router.post('/staff/reorder', wrap(async (req, res) => {
  const ids = (Array.isArray(req.body.ids) ? req.body.ids : []).map((i) => u.int(i));
  await Promise.all(ids.map((id, i) => q('UPDATE staff SET sort_order = ? WHERE id = ?', [i + 1, id])));
  res.json({ ok: true });
}));

// ---------------------------------------------------------------- closures & time off
router.get('/blocks', wrap(async (req, res) => {
  const now = T.nowIn((await B.getSched()).timezone);
  const past = req.query.scope === 'past';
  res.json(await q(`SELECT tb.*, s.name AS staff_name FROM time_blocks tb LEFT JOIN staff s ON s.id = tb.staff_id WHERE tb.ends_at ${past ? '<' : '>='} ? ORDER BY tb.starts_at ${past ? 'DESC' : 'ASC'} LIMIT 200`, [now.iso]));
}));
router.post('/blocks', wrap(async (req, res) => {
  const b = req.body;
  if (!T.validDate(b.from_date)) return res.status(400).json({ error: 'Please choose a start date.' });
  const toDate = T.validDate(b.to_date) ? b.to_date : b.from_date;
  let start, end;
  if (b.all_day) { start = `${b.from_date} 00:00:00`; end = `${T.addDays(toDate, 1)} 00:00:00`; }
  else {
    if (!T.validTime(b.from_time) || !T.validTime(b.to_time)) return res.status(400).json({ error: 'Please enter a start and end time.' });
    start = `${b.from_date} ${b.from_time}:00`; end = `${toDate} ${b.to_time}:00`;
  }
  if (end <= start) return res.status(400).json({ error: 'The end must be after the start.' });
  const staffId = u.int(b.staff_id) || null;
  const [{ n }] = await q(`SELECT COUNT(*) AS n FROM bookings WHERE status IN ${ACTIVE} AND starts_at < ? AND ends_at > ? ${staffId ? 'AND staff_id = ?' : ''}`, staffId ? [end, start, staffId] : [end, start]);
  const [r] = await db.pool().query('INSERT INTO time_blocks (staff_id, starts_at, ends_at, reason) VALUES (?,?,?,?)', [staffId, start, end, u.str(b.reason, 200)]);
  res.status(201).json({ id: r.insertId, conflicts: n });
}));
router.delete('/blocks/:id', wrap(async (req, res) => { await q('DELETE FROM time_blocks WHERE id = ?', [u.int(req.params.id)]); res.json({ ok: true }); }));

// ---------------------------------------------------------------- email health
router.get('/email/log', auth.requireOwner, wrap(async (req, res) => res.json(await q('SELECT id, to_addr, subject, kind, status, error, created_at FROM email_log ORDER BY id DESC LIMIT 40'))));
router.post('/email/verify', auth.requireOwner, wrap(async (req, res) => res.json(await mailer.verify())));

module.exports = router;
