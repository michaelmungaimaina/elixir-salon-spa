// Branded 404 page – rendered on the server so it works even if scripts fail. All wording is editable in Admin > Navigation.
const seed = require('./seed-data');
const u = require('./util');

const ICON = { about: 'circle-info', services: 'scissors', gallery: 'images', booking: 'calendar-check', contact: 'envelope', work: 'briefcase', promo: 'tag', testimonials: 'star' };
const digits = (s) => String(s || '').replace(/\D/g, '').replace(/^0/, '254');
const safeIcon = (n) => (/^[a-z0-9-]+$/.test(n) ? n : 'star');

function render(site, req) {
  const S = site.settings;
  const { brand, contact, theme } = S;
  const nf = { ...seed.settings.notFound, ...(S.notFound || {}) };
  const bookingOn = !!(site.scheduling && site.scheduling.enabled);
  const bookHref = bookingOn ? '/?book=1' : (u.url(brand.bookingUrl) || '/');
  const green = u.hex(theme.green, '#1A5B38'), gold = u.hex(theme.gold, '#D4AC52'), ground = u.hex(theme.ground, '#2A2519');

  let asked = req.path || '/';
  try { asked = decodeURIComponent(asked); } catch { /* keep raw */ }
  asked = asked.slice(0, 120);

  const links = (S.sections || []).filter((x) => x.nav && x.visible && x.key !== 'home');
  const navHtml = links.map((x) => `<a href="/#${u.esc(x.id)}">${u.esc(x.label)}</a>`).join('');
  const chips = links.slice(0, 6).map((x) => `<a class="nf-chip" href="/#${u.esc(x.id)}"><i class="fa-solid fa-${safeIcon(ICON[x.key] || 'star')}"></i>${u.esc(x.label)}</a>`).join('');
  const tel = contact.phone ? `<a href="tel:+${digits(contact.phone)}">${u.esc(contact.phone)}</a>` : '';
  const wa = contact.whatsapp ? `<a href="https://wa.me/${digits(contact.whatsapp)}?text=${encodeURIComponent(contact.whatsappMessage || '')}" rel="noopener">WhatsApp</a>` : '';
  const help = [tel, wa].filter(Boolean).join(' &nbsp;·&nbsp; ');
  const logo = u.esc(u.url(brand.logo));

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>Page not found | ${u.esc(brand.name)}</title>
  <meta name="robots" content="noindex,nofollow">
  <meta name="theme-color" content="${green}">
  <link rel="icon" href="${logo}">
  <link rel="preload" href="/fonts/cormorant-garamond-latin-600-normal.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="/css/fonts.css">
  <link rel="stylesheet" href="/vendor/fa/css/all.min.css">
  <link rel="stylesheet" href="/css/site.css">
  <link rel="stylesheet" href="/css/notfound.css">
  <style id="theme">:root{--emerald:${green};--gold:${gold};--ground:${ground}}</style>
</head>
<body class="nf">
  <a class="skip" href="#main">Skip to content</a>
  <header class="header" id="top"><div class="header-in">
    <a class="logo-tab" href="/" aria-label="${u.esc(brand.name)} – home"><img src="${logo}" alt=""></a>
    <nav class="nav" aria-label="Main"><a href="/">Home</a>${navHtml}<a class="btn desk" href="${u.esc(bookHref)}"><i class="fa-regular fa-calendar-check"></i> Book Now</a></nav>
    <a class="btn mob" href="${u.esc(bookHref)}" style="margin-left:auto">Book Now</a>
  </div></header>

  <main id="main" class="nf-main"><div class="wrap nf-grid">
    <div class="nf-art" aria-hidden="true">
      <span class="nf-num">4</span>
      <span class="nf-mirror"><img src="${u.esc(u.url(nf.image))}" alt="" decoding="async"></span>
      <span class="nf-num">4</span>
    </div>
    <div class="nf-copy">
      <span class="ribbon">Error 404</span>
      <h1>${u.esc(nf.heading)}</h1>
      <p class="lead">${u.esc(nf.message)}</p>
      <p class="nf-path">Address requested: <code>${u.esc(asked)}</code></p>
      <div class="cta-row">
        <a class="btn" href="/"><i class="fa-solid fa-house"></i> ${u.esc(nf.homeLabel)}</a>
        <a class="btn btn-ghost" href="${u.esc(bookHref)}"><i class="fa-regular fa-calendar-check"></i> ${u.esc(nf.bookLabel)}</a>
      </div>
      ${chips ? `<div class="nf-links"><h2>${u.esc(nf.linksHeading)}</h2><div class="nf-chips">${chips}</div></div>` : ''}
      ${help ? `<p class="nf-help">${u.esc(nf.helpText)} ${help}</p>` : ''}
    </div>
  </div></main>

  <footer class="nf-foot"><div class="wrap">© ${new Date().getFullYear()} <a href="/">${u.esc(brand.name)}</a>. All rights reserved.</div></footer>
</body>
</html>`;
}

module.exports = { render };
