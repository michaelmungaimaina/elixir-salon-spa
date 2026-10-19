// Usage: npm run reset-admin -- you@example.com NewPassword123
// Creates (or resets the password of) an owner account. Handy if you ever lock yourself out.
const db = require('./db');
const auth = require('./auth');

(async () => {
  const [email, password] = process.argv.slice(2);
  if (!email || !password || password.length < 8) {
    console.log('Usage: npm run reset-admin -- <email> <password (min 8 chars)>');
    process.exit(1);
  }
  await db.init();
  const hash = auth.hashPassword(password);
  const rows = await db.q('SELECT id FROM admin_users WHERE email = ?', [email.toLowerCase()]);
  if (rows.length) {
    await db.q('UPDATE admin_users SET password_hash = ?, active = 1, role = "owner" WHERE id = ?', [hash, rows[0].id]);
    console.log('Password reset for', email);
  } else {
    await db.q('INSERT INTO admin_users (name, email, password_hash, role) VALUES (?, ?, ?, "owner")', ['Owner', email.toLowerCase(), hash]);
    console.log('Owner account created for', email);
  }
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
