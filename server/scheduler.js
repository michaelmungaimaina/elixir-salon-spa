// Background job: emails a reminder before each confirmed appointment (default 24 h ahead; set in Admin > Schedule).
const db = require('./db');
const B = require('./booking');
const BM = require('./booking-mail');
const T = require('./timeutil');

async function tick() {
  const sched = await B.getSched();
  if (!sched.reminderHours) return;
  if (!BM.hasBase()) return; // wait until the site address is known so reminder links are correct
  const now = T.nowIn(sched.timezone);
  const until = T.stamp(now.date, now.minutes + sched.reminderHours * 60);
  const rows = await db.q(`${B.SELECT} WHERE b.status = 'confirmed' AND b.reminder_sent = 0 AND b.starts_at > ? AND b.starts_at <= ? ORDER BY b.starts_at LIMIT 50`, [now.iso, until]);
  for (const b of await B.attachItems(rows)) {
    await db.q('UPDATE bookings SET reminder_sent = 1 WHERE id = ?', [b.id]); // mark first so a slow send can never double-send
    if (b.email) await BM.toClient('reminder', b);
  }
}

function start() {
  const run = () => tick().catch((e) => console.error('Reminder job failed:', e.message));
  setTimeout(run, 20 * 1000).unref();
  setInterval(run, 5 * 60 * 1000).unref();
}
module.exports = { start, tick };
