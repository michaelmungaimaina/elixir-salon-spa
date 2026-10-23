require('dotenv').config();
const path = require('path');

const root = path.join(__dirname, '..');

module.exports = {
  root,
  port: parseInt(process.env.PORT, 10) || 3000,
  siteUrl: (process.env.SITE_URL || '').replace(/\/$/, ''),
  publicDir: path.join(root, 'public'),
  mediaDir: path.join(root, 'public', 'media'),
  uploadsDir: path.join(root, 'uploads'), // private (CVs) – never served statically
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'elixir_salon',
  },
  mail: {
    user: process.env.EMAIL_USER || '',
    pass: process.env.EMAIL_PASS || '',
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    // Shown as the sender (defaults to the login). Replies are directed to the address set in Admin > Email.
    from: process.env.MAIL_FROM || process.env.EMAIL_USER || '',
    // Set to "false" only if your mail host's certificate does not match its hostname.
    rejectUnauthorized: process.env.SMTP_REJECT_UNAUTHORIZED !== 'false',
  },
  bootstrapAdmin: {
    name: process.env.ADMIN_NAME || 'Owner',
    email: process.env.ADMIN_EMAIL || '',
    password: process.env.ADMIN_PASSWORD || '',
  },
};
