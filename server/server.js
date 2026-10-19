const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('./config');
const db = require('./db');
const auth = require('./auth');
const mailer = require('./mailer');
const adminRouter = require('./admin');
const u = require('./util');

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const { q } = db;

// ---------------------------------------------------------------
// Public content payload (cached until the admin changes something)
// ---------------------------------------------------------------
let siteCache = null, siteBuiltAt = 0;
const CACHE_MS = 5 * 60 * 1000; // also lets scheduled promotions switch on/off by themselves
const invalidate = () => { siteCache = null; };
adminRouter.setChangeHook(invalidate);

async function buildSite() {
  if (siteCache && Date.now() - siteBuiltAt < CACHE_MS) return siteCache;
  const settings = await db.allSettings();
  delete settings.email; // internal only

  const cats = await q('SELECT * FROM service_categories WHERE visible = 1 ORDER BY sort_order, id');
  const items = await q('SELECT * FROM service_items WHERE visible = 1 ORDER BY sort_order, id');
  const categories = cats.map((c) => ({
    id: c.id, name: c.name, blurb: c.blurb, imageA: c.image_a, imageB: c.image_b, bookUrl: c.book_url,
    items: items.filter((i) => i.category_id === c.id).map((i) => ({ name: i.name, price: i.price, note: i.note })),
  }));
  const gallery = (await q('SELECT id, type, src, caption FROM gallery_items WHERE visible = 1 ORDER BY sort_order, id'));
  const promotions = (await q(
    'SELECT id, title, body, cta_label, cta_url FROM promotions WHERE visible = 1 AND (starts_on IS NULL OR starts_on <= CURDATE()) AND (ends_on IS NULL OR ends_on >= CURDATE()) ORDER BY sort_order, id'
  )).map((p) => ({ id: p.id, title: p.title, body: p.body, ctaLabel: p.cta_label, ctaUrl: p.cta_url }));
  const jobs = (await q('SELECT id, title, description FROM jobs WHERE visible = 1 ORDER BY sort_order, id'));
  const testimonials = (await q("SELECT id, client_name, client_type, comment, stars, feedback FROM ratings WHERE status = 'approved' ORDER BY sort_order = 0 DESC, sort_order, id DESC LIMIT 60"))
    .map((r) => ({ id: r.id, name: r.client_name, type: r.client_type, comment: r.comment, stars: r.stars, feedback: r.feedback || '' }));

  siteCache = { settings, categories, gallery, promotions, jobs, testimonials };
  siteBuiltAt = Date.now();
  return siteCache;
}

// ---------------------------------------------------------------
// HTML page with SEO tags + preloaded data
// ---------------------------------------------------------------
const templatePath = path.join(config.publicDir, 'index.html');
let tpl = { mtime: 0, html: '' };
function getTemplate() { // re-read only when the file changes
  const m = fs.statSync(templatePath).mtimeMs;
  if (m !== tpl.mtime) tpl = { mtime: m, html: fs.readFileSync(templatePath, 'utf8') };
  return tpl.html;
}
const origin = (req) => config.siteUrl || `${req.protocol}://${req.get('host')}`;
const abs = (o, p) => (/^https?:/.test(p || '') ? p : o + (p || ''));

app.get(['/', '/index.html'], wrap(async (req, res) => {
  const site = await buildSite();
  const { brand, seo, contact, theme } = site.settings;
  const o = origin(req);
  const ld = {
    '@context': 'https://schema.org', '@type': 'BeautySalon', name: brand.name, url: o,
    image: abs(o, seo.ogImage), telephone: contact.phone, email: contact.email,
    address: { '@type': 'PostalAddress', streetAddress: contact.address, addressCountry: 'KE' },
    sameAs: (contact.social || []).map((s) => s.url).filter(Boolean),
  };
  const gtm = String(brand.gtmId || '').replace(/[^A-Za-z0-9-]/g, '');
  const head = `
    <title>${u.esc(seo.title)}</title>
    <meta name="description" content="${u.esc(seo.description)}">
    <link rel="canonical" href="${u.esc(o)}/">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="${u.esc(brand.name)}">
    <meta property="og:title" content="${u.esc(seo.title)}">
    <meta property="og:description" content="${u.esc(seo.description)}">
    <meta property="og:image" content="${u.esc(abs(o, seo.ogImage))}">
    <meta property="og:url" content="${u.esc(o)}/">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="theme-color" content="${u.hex(theme.green, '#1A5B38')}">
    <link rel="icon" href="${u.esc(brand.logo)}">
    <style id="theme">:root{--emerald:${u.hex(theme.green, '#1A5B38')};--gold:${u.hex(theme.gold, '#D4AC52')};--ground:${u.hex(theme.ground, '#2A2519')}}</style>
    <script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>
    ${gtm ? `<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtm}');</script>` : ''}`;
  const data = `<script>window.__SITE__=${JSON.stringify(site).replace(/</g, '\\u003c').replace(/\u2028|\u2029/g, '')};</script>`;
  res.setHeader('Cache-Control', 'no-cache');
  res.type('html').send(getTemplate().replace('<!--HEAD-->', head).replace('<!--DATA-->', data));
}));

app.get('/api/site', wrap(async (req, res) => { res.setHeader('Cache-Control', 'no-cache'); res.json(await buildSite()); }));

app.get('/robots.txt', (req, res) => res.type('text/plain').send(`User-agent: *\nDisallow: /admin\nDisallow: /api/\nSitemap: ${origin(req)}/sitemap.xml\n`));
app.get('/sitemap.xml', (req, res) => res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${origin(req)}/</loc><changefreq>weekly</changefreq></url></urlset>`));

// ---------------------------------------------------------------
// Public form endpoints
// ---------------------------------------------------------------
const formLimit = auth.rateLimit({ windowMs: 10 * 60 * 1000, max: 6, message: 'You have sent a few messages already – please try again a little later.' });

app.post('/api/contact', formLimit, wrap(async (req, res) => {
  if (req.body.website) return res.status(201).json({ ok: true }); // honeypot
  const name = u.str(req.body.name, 120), email = u.str(req.body.email, 190), phone = u.str(req.body.phone, 40), message = u.str(req.body.message, 3000);
  if (name.length < 2) return res.status(400).json({ error: 'Please enter your name.' });
  if (!u.isEmail(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
  if (!u.isPhone(phone)) return res.status(400).json({ error: 'Please enter a valid phone number.' });
  if (message.length < 5) return res.status(400).json({ error: 'Please tell us a little more.' });
  await q('INSERT INTO contact_data (name, email, phone, message) VALUES (?, ?, ?, ?)', [name, email, phone, message]);
  mailer.contactReceipt(name, email);
  mailer.notifyStaff(`New message from ${name}`, [`Name: ${name}`, `Email: ${email}`, `Phone: ${phone}`, '', message], email);
  res.status(201).json({ ok: true });
}));

const cvUpload = multer({
  storage: multer.diskStorage({
    destination: (req, f, cb) => { fs.mkdirSync(config.uploadsDir, { recursive: true }); cb(null, config.uploadsDir); },
    filename: (req, f, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${path.extname(f.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, f, cb) => (['.pdf', '.doc', '.docx'].includes(path.extname(f.originalname).toLowerCase()) ? cb(null, true) : cb(new Error('Please upload your CV as a PDF, DOC or DOCX file.'))),
});

app.post('/api/applications', formLimit, cvUpload.single('cv'), wrap(async (req, res) => {
  const drop = () => req.file && fs.unlink(req.file.path, () => {});
  if (req.body.website) { drop(); return res.status(200).json({ ok: true }); }
  const name = u.str(req.body.name, 120), email = u.str(req.body.email, 190), phone = u.str(req.body.phone, 40), position = u.str(req.body.position, 200);
  const fail = (msg) => { drop(); return res.status(400).json({ error: msg }); };
  if (name.length < 2) return fail('Please enter your full name.');
  if (!u.isEmail(email)) return fail('Please enter a valid email address.');
  if (!u.isPhone(phone)) return fail('Please enter a valid phone number.');
  if (!req.file) return fail('Please attach your CV.');
  await q('INSERT INTO applications (name, email, phone, position, cv, original_name) VALUES (?, ?, ?, ?, ?, ?)', [name, email, phone, position, 'uploads/' + req.file.filename, req.file.originalname.slice(0, 250)]);
  mailer.applicationReceipt(name, email);
  mailer.notifyStaff(`New job application: ${name}`, [`Name: ${name}`, `Email: ${email}`, `Phone: ${phone}`, position ? `Role: ${position}` : '']);
  res.status(201).json({ ok: true });
}));

app.post('/api/ratings', formLimit, wrap(async (req, res) => {
  if (req.body.website) return res.status(201).json({ ok: true });
  const name = u.str(req.body.name, 120), comment = u.str(req.body.comment, 1000), stars = u.int(req.body.stars);
  if (name.length < 2) return res.status(400).json({ error: 'Please enter your name.' });
  if (stars < 1 || stars > 5) return res.status(400).json({ error: 'Please choose a rating from 1 to 5 stars.' });
  if (comment.length < 5) return res.status(400).json({ error: 'Please tell us a little about your visit.' });
  const auto = ((await db.getSetting('testimonialsSection')) || {}).autoApprove ? 'approved' : 'pending';
  await q("INSERT INTO ratings (client_name, client_email, client_phone, client_type, comment, stars, feedback, status) VALUES (?, '', '', 'Customer', ?, ?, '', ?)", [name, comment, stars, auto]);
  invalidate();
  mailer.notifyStaff(`New review from ${name} (${stars}/5)`, [comment]);
  res.status(201).json({ ok: true, pending: auto === 'pending' });
}));

// ---------------------------------------------------------------
// Admin
// ---------------------------------------------------------------
app.use('/api/admin', adminRouter);
app.get('/admin', (req, res) => res.sendFile(path.join(config.publicDir, 'admin', 'index.html')));

// Static files (CVs live in /uploads and are NOT exposed here)
app.use(express.static(config.publicDir, {
  index: false,
  setHeaders: (res, p) => {
    if (/\.(jpe?g|png|webp|gif|mp4|webm|woff2?)$/i.test(p)) res.setHeader('Cache-Control', 'public, max-age=604800');
    else res.setHeader('Cache-Control', 'no-cache');
  },
}));

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
app.use((req, res) => res.status(404).type('html').send('<!doctype html><meta name="viewport" content="width=device-width"><body style="font-family:sans-serif;background:#2A2519;color:#f6f1dc;display:grid;place-items:center;height:100vh;margin:0;text-align:center"><div><h1>Page not found</h1><a href="/" style="color:#D4AC52">Back to Elixir Salon &amp; Spa</a></div>'));

app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  if (err instanceof multer.MulterError || /Only JPG|Please upload/.test(err.message)) {
    return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'That file is too large.' : err.message });
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on our side. Please try again.' });
});

(async () => {
  await db.init();
  await auth.bootstrapAdmin(config.bootstrapAdmin);
  app.listen(config.port, () => console.log(`Elixir Salon & Spa running at http://localhost:${config.port}  (admin: /admin)`));
})().catch((e) => { console.error('Failed to start:', e.message); process.exit(1); });
