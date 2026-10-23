// Emails about bookings: to the client (confirmation, update, cancellation, reminder) and to the salon team.
const config = require('./config');
const T = require('./timeutil');
const B = require('./booking');
const mail = require('./mailer');
const { esc, fill } = mail;

let seenOrigin = '';
const setOrigin = (o) => { seenOrigin = o; };
const baseUrl = () => config.siteUrl || seenOrigin || `http://localhost:${config.port}`;
const hasBase = () => !!(config.siteUrl || seenOrigin); // false right after a restart on a server with no SITE_URL

function totalText(b) {
  if (!b.priceMin && !b.priceMax) return 'Confirmed at the salon';
  const range = b.priceMin !== b.priceMax || b.items.some((i) => !i.min && !i.max);
  return range ? `From ${T.fmtMoney(b.priceMin)}` : T.fmtMoney(b.priceMin);
}
const varsOf = (b) => ({
  name: b.name.split(' ')[0], fullName: b.name, reference: b.reference, date: T.fmtDateLong(b.date), time: T.fmtTime(b.startMin),
  services: b.items.map((i) => i.name).join(', '), specialist: b.staffRequested ? b.staffName : '', total: totalText(b),
  duration: T.fmtDuration(b.duration), manageUrl: `${baseUrl()}/booking/${b.token}`,
});

const TPL = { received: 'bookingPending', confirmed: 'bookingConfirmed', updated: 'bookingUpdated', cancelled: 'bookingCancelled', declined: 'bookingDeclined', reminder: 'bookingReminder' };
const BANNER = {
  received: ['Awaiting confirmation', '#E9C46A', '#3b2d05'], confirmed: ['Confirmed', '#7ED6A0', '#0b3a1d'], updated: ['Updated', '#7ED6A0', '#0b3a1d'],
  reminder: ['Upcoming appointment', '#7ED6A0', '#0b3a1d'], cancelled: ['Cancelled', '#F2A7A0', '#4a1511'], declined: ['Not available', '#F2A7A0', '#4a1511'],
};

function detailsCard(b, c, kind) {
  const [label, bg, fg] = BANNER[kind] || BANNER.confirmed;
  const row = (k, v) => `<tr><td style="padding:7px 0;color:#7a7358;font-size:13px;width:112px;vertical-align:top">${k}</td><td style="padding:7px 0;color:#2b2412;font-size:15px">${v}</td></tr>`;
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F4EEDC;border-radius:12px;margin:18px 0"><tr><td style="padding:20px 24px">
    <span style="display:inline-block;background:${bg};color:${fg};font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;padding:4px 12px;border-radius:99px">${label}</span>
    <div style="margin:12px 0 2px;font-size:12px;letter-spacing:1.4px;text-transform:uppercase;color:#7a7358">Booking reference</div>
    <div style="font-size:26px;font-weight:700;color:${'#1A5B38'};letter-spacing:1.5px;margin-bottom:10px">${esc(b.reference)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top:1px solid #ddd3b3">
      ${row('When', `<strong>${esc(T.fmtDateLong(b.date))}</strong><br>${esc(T.fmtTime(b.startMin))} &ndash; ${esc(T.fmtTime(b.endMin))}`)}
      ${row('Services', b.items.map((i) => `${esc(i.name)} <span style="color:#7a7358">(${esc(T.fmtDuration(i.duration))})</span>`).join('<br>'))}
      ${b.staffRequested && b.staffName ? row('Specialist', esc(b.staffName)) : ''}
      ${row('Estimated total', esc(totalText(b)))}
      ${row('Where', `${esc(c.email.address || c.contact.address)}`)}
    </table></td></tr></table>`;
}

function textVersion(b, c, intro, links) {
  return [fill(intro, varsOf(b)), '', `Reference: ${b.reference}`, `When: ${T.fmtDateLong(b.date)}, ${T.fmtTime(b.startMin)} - ${T.fmtTime(b.endMin)}`,
    `Services: ${b.items.map((i) => `${i.name} (${T.fmtDuration(i.duration)})`).join('; ')}`, `Estimated total: ${totalText(b)}`, `Where: ${c.email.address || c.contact.address}`, '', ...links, '',
    `Phone: ${c.contact.phone}`].join('\n');
}

async function toClient(kind, b) {
  if (!b.email) return { status: 'skipped', error: 'Client has no email' };
  const [c, sched, ui] = await Promise.all([mail.ctx(), B.getSched(), require('./db').getSetting('bookingUi')]);
  const key = TPL[kind], vars = varsOf(b);
  const subject = fill(c.email[key + 'Subject'] || `Your booking – {{reference}}`, vars);
  const intro = c.email[key + 'Body'] || 'Hi {{name}},\n\nHere are your booking details.';
  const active = ['received', 'confirmed', 'updated', 'reminder'].includes(kind);
  const manage = vars.manageUrl, calendar = `${manage}/calendar.ics`;
  const buttons = active
    ? mail.button(manage, 'Manage booking') + mail.button(calendar, 'Add to calendar', false)
    : mail.button(`${baseUrl()}/?book=1`, 'Book a new time');
  const policy = active && ui && ui.policy ? `<p style="margin:14px 0 0;color:#cfc6a0;font-size:13px">${esc(ui.policy)}</p>` : '';
  const reason = ['cancelled', 'declined'].includes(kind) && b.cancelReason ? `<p style="margin:0 0 14px"><strong style="color:#EBCE27">Note from the salon:</strong> ${esc(b.cancelReason)}</p>` : '';
  const html = mail.shell(c, mail.paragraphs(intro, vars) + reason + detailsCard(b, c, kind) + `<p style="margin:18px 0 0">${buttons}</p>` + policy);
  const ical = active ? B.buildIcs(b, { brandName: c.brand.name, address: c.email.address || c.contact.address, phone: c.contact.phone, manageUrl: manage, tz: sched.timezone }) : undefined;
  return mail.deliver({ to: b.email, kind: 'booking_' + kind, bookingId: b.id, subject, html, ical, text: textVersion(b, c, intro, active ? [`Manage or cancel: ${manage}`, `Add to calendar: ${calendar}`] : [`Book again: ${baseUrl()}/?book=1`]) });
}

async function toStaff(kind, b) {
  const c = await mail.ctx();
  if (!c.email.notifyTo) return { status: 'skipped' };
  const when = `${T.fmtDateShort(b.date)}, ${T.fmtTime(b.startMin)}`;
  const heads = {
    new: `New booking: ${b.name} – ${when}${b.status === 'pending' ? ' (needs approval)' : ''}`,
    rescheduled: `Booking rescheduled by client: ${b.name} – ${when}`,
    cancelled: `Booking cancelled by client: ${b.name} – ${when}`,
  };
  const lines = [heads[kind], '', `Reference: ${b.reference}`, `Status: ${b.status}`, `Client: ${b.name}`, `Phone: ${b.phone}`, `Email: ${b.email || '-'}`,
    `Services: ${b.items.map((i) => `${i.name} (${T.fmtDuration(i.duration)})`).join('; ')}`, `Duration: ${T.fmtDuration(b.duration)}`, `Estimated total: ${totalText(b)}`,
    `Specialist: ${b.staffName || 'Any'}${b.staffRequested ? ' (requested by client)' : ''}`, ...(b.notes ? [`Client notes: ${b.notes}`] : []), '', `Open in admin: ${baseUrl()}/admin#/bookings`];
  return mail.notifyStaff(heads[kind], lines, b.email || undefined, 'booking_staff');
}

// Fire-and-forget: an email problem must never break a booking.
const bg = (p) => { Promise.resolve(p).catch((e) => console.error('Booking email error:', e.message)); };
const afterCreate = (b) => { bg(toClient(b.status === 'confirmed' ? 'confirmed' : 'received', b)); bg(toStaff('new', b)); };

module.exports = { setOrigin, baseUrl, hasBase, toClient, toStaff, afterCreate, bg, totalText, varsOf };
