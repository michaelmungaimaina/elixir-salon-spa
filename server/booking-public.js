// Public booking API: availability, creating a booking, and the client's "manage my booking" actions.
const express = require('express');
const B = require('./booking');
const BM = require('./booking-mail');
const auth = require('./auth');
const T = require('./timeutil');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch((e) => (e instanceof B.HttpError ? res.status(e.status).json({ error: e.message }) : next(e)));

const read = auth.rateLimit({ windowMs: 60 * 1000, max: 120, message: 'Too many requests – please slow down a moment.' });
const create = auth.rateLimit({ windowMs: 30 * 60 * 1000, max: 10, message: 'You have made several booking attempts. Please try again later or call us.' });
const manage = auth.rateLimit({ windowMs: 10 * 60 * 1000, max: 60, message: 'Too many attempts. Please try again in a few minutes.' });

const TOKEN = /^[A-Za-z0-9_-]{20,40}$/;

// What a client may see about their own booking.
async function view(b) {
  const sched = await B.getSched();
  return {
    reference: b.reference, token: b.token, status: b.status, name: b.name, email: b.email, phone: b.phone,
    date: b.date, start: b.start, end: b.end, duration: b.duration, priceMin: b.priceMin, priceMax: b.priceMax,
    staffName: b.staffRequested ? b.staffName : '', items: b.items.map((i) => ({ id: i.id, name: i.name, duration: i.duration, price: i.price, min: i.min, max: i.max })),
    canChange: ['pending', 'confirmed'].includes(b.status) && B.insideCancelWindow(b, sched), cancelHours: sched.cancelHours,
    total: BM.totalText(b), longDate: T.fmtDateLong(b.date), timeLabel: `${T.fmtTime(b.startMin)} – ${T.fmtTime(b.endMin)}`, durationLabel: T.fmtDuration(b.duration),
    manageUrl: `${BM.baseUrl()}/booking/${b.token}`,
  };
}
async function byToken(token) {
  if (!TOKEN.test(token || '')) throw B.err(404, 'We could not find that booking.');
  const b = await B.getBooking('token', token);
  if (!b) throw B.err(404, 'We could not find that booking.');
  return b;
}
const idsOf = (b) => b.items.map((i) => i.id).filter(Boolean);

// ---- availability for a new booking ----
router.get('/availability', read, wrap(async (req, res) => res.json(await B.availability({ date: req.query.date, services: req.query.services, staff: req.query.staff }))));
router.get('/days', read, wrap(async (req, res) => res.json(await B.monthDays({ month: req.query.month, services: req.query.services, staff: req.query.staff }))));
router.get('/next', read, wrap(async (req, res) => res.json(await B.nextAvailable({ services: req.query.services, staff: req.query.staff, from: req.query.from }))));

// ---- create ----
router.post('/', create, wrap(async (req, res) => {
  if (req.body.website) return res.status(201).json({ ok: true }); // honeypot
  if (!req.body.consent) throw B.err(400, 'Please accept the booking policy to continue.');
  const b = await B.createBooking(req.body);
  BM.afterCreate(b);
  res.status(201).json(await view(b));
}));

// ---- manage (token = the secret in the client's email link) ----
router.get('/manage/:token', manage, wrap(async (req, res) => res.json(await view(await byToken(req.params.token)))));

router.get('/manage/:token/availability', read, wrap(async (req, res) => { const b = await byToken(req.params.token); res.json(await B.availability({ date: req.query.date, services: idsOf(b), staff: b.staffRequested ? b.staffId : 'any', excludeId: b.id })); }));
router.get('/manage/:token/days', read, wrap(async (req, res) => { const b = await byToken(req.params.token); res.json(await B.monthDays({ month: req.query.month, services: idsOf(b), staff: b.staffRequested ? b.staffId : 'any', excludeId: b.id })); }));
router.get('/manage/:token/next', read, wrap(async (req, res) => { const b = await byToken(req.params.token); res.json(await B.nextAvailable({ services: idsOf(b), staff: b.staffRequested ? b.staffId : 'any' })); }));

router.post('/manage/:token/cancel', manage, wrap(async (req, res) => {
  const cur = await byToken(req.params.token);
  const b = await B.cancelBooking(cur.id, { by: 'client', reason: req.body.reason });
  BM.bg(BM.toClient('cancelled', b)); BM.bg(BM.toStaff('cancelled', b));
  res.json(await view(b));
}));

router.post('/manage/:token/reschedule', manage, wrap(async (req, res) => {
  const cur = await byToken(req.params.token);
  const b = await B.rescheduleBooking(cur.id, { date: req.body.date, time: req.body.time });
  BM.bg(BM.toClient(b.status === 'confirmed' ? 'updated' : 'received', b)); BM.bg(BM.toStaff('rescheduled', b));
  res.json(await view(b));
}));

module.exports = router;
module.exports.byToken = byToken;
