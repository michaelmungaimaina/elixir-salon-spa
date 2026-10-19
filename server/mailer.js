const nodemailer = require('nodemailer');
const config = require('./config');
const db = require('./db');

let transporter;
function getTransporter() {
  if (transporter !== undefined) return transporter;
  const m = config.mail;
  if (!m.user || !m.pass) { transporter = null; return null; }
  transporter = nodemailer.createTransport(
    m.host
      ? { host: m.host, port: m.port, secure: m.secure, auth: { user: m.user, pass: m.pass } }
      : { service: 'gmail', auth: { user: m.user, pass: m.pass } }
  );
  return transporter;
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fill = (tpl, vars) => String(tpl || '').replace(/{{\s*(\w+)\s*}}/g, (_, k) => (vars[k] ?? ''));

function render({ brand, email, contact }, bodyText, vars, withBooking) {
  const paragraphs = fill(bodyText, vars)
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px;line-height:1.65">${esc(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
  const site = config.siteUrl || '#';
  const btn = withBooking && brand.bookingUrl
    ? `<p style="margin:24px 0"><a href="${esc(brand.bookingUrl)}" style="display:inline-block;padding:12px 28px;background:#D4AC52;color:#1b1608;font-weight:700;text-decoration:none;border-radius:8px">Book an Appointment</a></p>`
    : '';
  return `<!doctype html><html><body style="margin:0;background:#2A2519;padding:24px;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:600px;margin:0 auto;background:#1A5B38;border-radius:14px;overflow:hidden;border-bottom:4px solid #D4AC52">
    <div style="padding:22px 32px;border-bottom:1px solid rgba(212,172,82,.45);color:#EBCE27;font-size:20px;font-weight:700;letter-spacing:.5px">${esc(brand.name)}</div>
    <div style="padding:28px 32px;color:#f6f1dc;font-size:15px">${paragraphs}${btn}
      <p style="margin:24px 0 0;line-height:1.6">Warm regards,<br><strong style="color:#EBCE27">The ${esc(brand.name)} Team</strong></p>
    </div>
    <div style="padding:18px 32px;background:rgba(0,0,0,.25);color:#cfc6a0;font-size:13px;line-height:1.7">
      ${esc(email.address || contact.address)}<br>
      ${esc(contact.phone)}${contact.phone2 ? ' / ' + esc(contact.phone2) : ''}<br>
      ${esc(contact.email)} &middot; <a href="${esc(site)}" style="color:#EBCE27;text-decoration:none">${esc(site.replace(/^https?:\/\//, ''))}</a>
    </div>
  </div></body></html>`;
}

async function send({ to, subject, html, text, replyTo }) {
  const t = getTransporter();
  const s = (await db.getSetting('email')) || {};
  if (!t) { console.log(`[mail skipped – EMAIL_USER/EMAIL_PASS not set] → ${to}: ${subject}`); return { skipped: true }; }
  await t.sendMail({ from: `"${s.fromName || 'Elixir Salon & Spa'}" <${config.mail.user}>`, to, subject, html, text, replyTo });
  return { sent: true };
}

async function ctx() {
  const [brand, email, contact] = await Promise.all([db.getSetting('brand'), db.getSetting('email'), db.getSetting('contact')]);
  return { brand: brand || {}, email: email || {}, contact: contact || {} };
}

// Fire-and-forget helpers – a mail failure must never break a form submission.
async function contactReceipt(name, to) {
  try {
    const c = await ctx();
    const first = String(name).trim().split(/\s+/)[0];
    await send({ to, subject: fill(c.email.contactSubject, { name: first }), html: render(c, c.email.contactBody, { name: first }, true) });
  } catch (e) { console.error('Contact receipt email failed:', e.message); }
}
async function applicationReceipt(name, to) {
  try {
    const c = await ctx();
    const first = String(name).trim().split(/\s+/)[0];
    await send({ to, subject: fill(c.email.applicationSubject, { name: first }), html: render(c, c.email.applicationBody, { name: first }, false) });
  } catch (e) { console.error('Application receipt email failed:', e.message); }
}
async function notifyStaff(subject, lines, replyTo) {
  try {
    const c = await ctx();
    if (!c.email.notifyTo) return;
    const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6">${lines.map((l) => `<p style="margin:0 0 8px">${esc(l)}</p>`).join('')}<p style="color:#777;font-size:13px">Open the admin panel to manage this.</p></div>`;
    await send({ to: c.email.notifyTo, subject, html, replyTo });
  } catch (e) { console.error('Staff notification failed:', e.message); }
}
async function testEmail(to) {
  const c = await ctx();
  return send({ to, subject: 'Test email from your Elixir admin panel', html: render(c, 'Hi {{name}},\n\nThis is a test. If you can read this, your email settings work.', { name: 'there' }, true) });
}

module.exports = { contactReceipt, applicationReceipt, notifyStaff, testEmail, isConfigured: () => !!getTransporter() };
