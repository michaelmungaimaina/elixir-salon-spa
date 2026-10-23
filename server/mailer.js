// Outgoing email. Sent FROM the mailbox in .env (info@…); client replies go to the "Reply-To" address in Admin > Email (admin@…).
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
      ? { host: m.host, port: m.port, secure: m.secure, auth: { user: m.user, pass: m.pass }, tls: { rejectUnauthorized: m.rejectUnauthorized }, connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 30000 }
      : { service: 'gmail', auth: { user: m.user, pass: m.pass } }
  );
  return transporter;
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fill = (tpl, vars) => String(tpl || '').replace(/{{\s*(\w+)\s*}}/g, (_, k) => (vars[k] ?? ''));

async function ctx() {
  const [brand, email, contact] = await Promise.all([db.getSetting('brand'), db.getSetting('email'), db.getSetting('contact')]);
  return { brand: brand || {}, email: email || {}, contact: contact || {} };
}

async function record(to, subject, kind, status, error, bookingId) {
  try {
    await db.q('INSERT INTO email_log (to_addr, subject, kind, status, error, booking_id) VALUES (?, ?, ?, ?, ?, ?)', [String(to).slice(0, 250), String(subject).slice(0, 290), kind || '', status, String(error || '').slice(0, 480), bookingId || null]);
    db.q('DELETE FROM email_log WHERE id < (SELECT m FROM (SELECT MAX(id) - 400 AS m FROM email_log) t)').catch(() => {});
  } catch { /* logging must never break a send */ }
}

// Low-level send. Never throws – returns { status: 'sent' | 'failed' | 'skipped', error? } and records it in the delivery log.
async function deliver({ to, subject, html, text, replyTo, ical, kind = '', bookingId = null }) {
  if (!to) return { status: 'skipped', error: 'No recipient' };
  const t = getTransporter();
  if (!t) {
    console.log(`[mail skipped – email not configured] -> ${to}: ${subject}`);
    await record(to, subject, kind, 'skipped', 'Email is not configured on the server', bookingId);
    return { status: 'skipped', error: 'Email is not configured' };
  }
  const e = (await db.getSetting('email')) || {};
  try {
    await t.sendMail({
      from: `"${e.fromName || 'Elixir Salon & Spa'}" <${config.mail.from}>`, to, subject, html, text,
      replyTo: replyTo || e.replyTo || undefined,
      icalEvent: ical ? { method: 'PUBLISH', filename: 'appointment.ics', content: ical } : undefined,
    });
    await record(to, subject, kind, 'sent', '', bookingId);
    return { status: 'sent' };
  } catch (err) {
    console.error(`Email to ${to} failed:`, err.message);
    await record(to, subject, kind, 'failed', err.message, bookingId);
    return { status: 'failed', error: err.message };
  }
}

async function verify() {
  const t = getTransporter();
  const info = { configured: !!t, host: config.mail.host || (t ? 'gmail' : ''), port: config.mail.port, user: config.mail.user, from: config.mail.from };
  if (!t) return { ...info, ok: false, error: 'EMAIL_USER and EMAIL_PASS are not set in the server .env file.' };
  try { await t.verify(); return { ...info, ok: true }; } catch (e) { return { ...info, ok: false, error: e.message }; }
}

// ---------- branded HTML shell ----------
const GOLD = '#D4AC52', GREEN = '#1A5B38', UMBER = '#2A2519';
function shell({ brand, email, contact }, inner, { footerExtra = '' } = {}) {
  return `<!doctype html><html><body style="margin:0;background:${UMBER};padding:24px 12px;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:620px;margin:0 auto;background:${GREEN};border-radius:16px;overflow:hidden;border-bottom:4px solid ${GOLD}">
    <div style="padding:22px 32px;border-bottom:1px solid rgba(212,172,82,.45);color:#EBCE27;font-size:20px;font-weight:700;letter-spacing:.5px">${esc(brand.name)}</div>
    <div style="padding:28px 32px;color:#f6f1dc;font-size:15px;line-height:1.65">${inner}
      <p style="margin:24px 0 0">Warm regards,<br><strong style="color:#EBCE27">The ${esc(brand.name)} Team</strong></p></div>
    <div style="padding:18px 32px;background:rgba(0,0,0,.25);color:#cfc6a0;font-size:13px;line-height:1.7">
      ${esc(email.address || contact.address)}<br>${esc(contact.phone)}${contact.phone2 ? ' / ' + esc(contact.phone2) : ''}<br>
      <a href="mailto:${esc(contact.email)}" style="color:#EBCE27;text-decoration:none">${esc(contact.email)}</a>${footerExtra}
    </div></div></body></html>`;
}
const paragraphs = (text, vars) => fill(text, vars).split(/\n{2,}/).map((p) => `<p style="margin:0 0 16px">${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
const button = (href, label, primary = true) => `<a href="${esc(href)}" style="display:inline-block;margin:6px 8px 6px 0;padding:12px 24px;border-radius:9px;font-weight:700;text-decoration:none;${primary ? `background:${GOLD};color:#1b1608` : `border:1.5px solid ${GOLD};color:#EBCE27`}">${esc(label)}</a>`;

// ---------- form receipts (existing features) ----------
async function contactReceipt(name, to) {
  const c = await ctx(); const first = String(name).trim().split(/\s+/)[0]; const vars = { name: first };
  const bookBtn = c.brand.name ? `<p style="margin:24px 0">${button((config.siteUrl || '') + '/?book=1', 'Book an Appointment')}</p>` : '';
  return deliver({ to, kind: 'contact', subject: fill(c.email.contactSubject, vars), html: shell(c, paragraphs(c.email.contactBody, vars) + bookBtn), text: fill(c.email.contactBody, vars) });
}
async function applicationReceipt(name, to) {
  const c = await ctx(); const first = String(name).trim().split(/\s+/)[0]; const vars = { name: first };
  return deliver({ to, kind: 'application', subject: fill(c.email.applicationSubject, vars), html: shell(c, paragraphs(c.email.applicationBody, vars)), text: fill(c.email.applicationBody, vars) });
}
async function notifyStaff(subject, lines, replyTo, kind = 'alert') {
  const c = await ctx();
  if (!c.email.notifyTo) return { status: 'skipped' };
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6">${lines.map((l) => `<p style="margin:0 0 8px">${esc(l)}</p>`).join('')}<p style="color:#777;font-size:13px">Open the admin panel to manage this.</p></div>`;
  return deliver({ to: c.email.notifyTo, subject, html, text: lines.join('\n'), replyTo, kind });
}
async function testEmail(to) {
  const c = await ctx();
  return deliver({ to, kind: 'test', subject: 'Test email from your Elixir admin panel', html: shell(c, paragraphs('Hi there,\n\nThis is a test. If you can read this, your email settings work and clients will receive their confirmations from this address.', {})), text: 'This is a test email from your Elixir admin panel.' });
}

module.exports = { deliver, verify, shell, paragraphs, button, fill, esc, ctx, contactReceipt, applicationReceipt, notifyStaff, testEmail, isConfigured: () => !!getTransporter() };
