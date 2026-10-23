/* Elixir Salon & Spa – public site.
   Every word, image, price and link on the page comes from the admin panel via /api/site. */
(() => {
  'use strict';

  // ---------- helpers ----------
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safe = (u) => (/^(https?:\/\/|mailto:|tel:|\/(?!\/)|#|\?)/i.test(u || '') ? u : '');
  const paras = (t) => String(t || '').split(/\n{2,}/).filter(Boolean).map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
  const digits = (s) => String(s || '').replace(/[^\d]/g, '');
  const telHref = (s) => 'tel:+' + digits(s).replace(/^0/, '254');

  // Tiny, safe markdown: "## heading", "- bullet", **bold**, blank-line paragraphs, bare emails.
  function md(text) {
    const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/([\w.+-]+@[\w-]+\.[\w.-]+\w)/g, '<a href="mailto:$1">$1</a>');
    let html = '', list = false, para = [];
    const flush = () => { if (para.length) { html += `<p>${para.map(inline).join('<br>')}</p>`; para = []; } };
    const close = () => { if (list) { html += '</ul>'; list = false; } };
    for (const line of String(text || '').split('\n')) {
      if (/^##\s+/.test(line)) { flush(); close(); html += `<h4>${inline(line.replace(/^##\s+/, ''))}</h4>`; }
      else if (/^-\s+/.test(line)) { flush(); if (!list) { html += '<ul>'; list = true; } html += `<li>${inline(line.replace(/^-\s+/, ''))}</li>`; }
      else if (!line.trim()) { flush(); close(); }
      else { close(); para.push(line); }
    }
    flush(); close();
    return html;
  }

  let D, cfg, booking;

  // ---------- section renderers ----------
  const ribbon = (key) => `<span class="ribbon">${esc(sec(key).label)}</span>`;
  const sec = (key) => D.settings.sections.find((s) => s.key === key) || { label: '', id: key };
  const wrapSection = (key, inner, cls = '') => `<section id="${esc(sec(key).id)}" class="section ${cls}" aria-label="${esc(sec(key).label)}"><div class="wrap">${inner}</div></section>`;

  const durTxt = (m) => { const h = Math.floor(m / 60), r = m % 60; return h ? (r ? `${h} hr ${r} min` : `${h} hr`) : `${m} min`; };
  const icoName = (n, d = 'star') => (/^[a-z0-9-]{1,40}$/.test(n || '') ? n : d);
  const bookOn = () => !!(D.scheduling && D.scheduling.enabled);
  // Opening hours come from the booking schedule (Admin > Schedule), grouped: "Tue – Fri: 07:30 – 20:00".
  function hoursRows() {
    const sch = D.scheduling && D.scheduling.hours;
    if (!sch) return (D.settings.contact.hours || []).filter((h) => h.days);
    const order = [1, 2, 3, 4, 5, 6, 0], N = { 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat', 0: 'Sun' };
    const by = Object.fromEntries(sch.map((x) => [x.day, x])), key = (x) => (x.open ? `${x.from}-${x.to}` : 'closed');
    const rows = []; let i = 0;
    while (i < order.length) {
      let j = i; while (j + 1 < order.length && key(by[order[j + 1]]) === key(by[order[i]])) j++;
      const x = by[order[i]];
      rows.push({ days: i === j ? N[order[i]] : `${N[order[i]]} – ${N[order[j]]}`, time: x.open ? `${x.from} – ${x.to}` : 'Closed' });
      i = j + 1;
    }
    return rows;
  }

  function header() {
    const links = D.settings.sections.filter((s) => s.nav && s.visible);
    const nav = (cls) => links.map((s) => `<a class="${cls}" href="#${esc(s.id)}">${esc(s.label)}</a>`).join('');
    const b = D.settings.brand, bk = esc(safe(b.bookingUrl)), on = bookOn() ? ' data-book' : '';
    return `
    <header class="header" id="top"><div class="header-in">
      <a class="logo-tab" href="#${esc(sec('home').id)}" aria-label="${esc(b.name)} – home"><img src="${esc(safe(b.logo))}" alt=""></a>
      <nav class="nav" aria-label="Main">${nav('nl')}<a class="btn desk" href="${bk}"${on}><i class="fa-regular fa-calendar-check"></i> Book Now</a></nav>
      <a class="btn mob" href="${bk}"${on}>Book Now</a>
      <button class="burger" id="burger" aria-label="Open menu" aria-expanded="false"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>
    </div></header>
    <div class="drawer" id="drawer" aria-hidden="true"><div class="drawer-bg" data-close></div>
      <aside class="drawer-panel" aria-label="Menu">
        <div class="drawer-top"><img src="${esc(safe(b.logo))}" alt=""><button class="burger" data-close aria-label="Close menu" style="display:block"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg></button></div>
        ${nav('dl')}
        <a class="btn" href="${bk}"${on}><i class="fa-regular fa-calendar-check"></i> Book Appointment Now</a>
      </aside></div>`;
  }

  function hero() {
    const h = D.settings.hero;
    const slides = (h.slides || []).filter(Boolean);
    const stats = (h.stats || []).filter((s) => s.value || s.label);
    const on = bookOn() ? ' data-book' : '';
    return `<section id="${esc(sec('home').id)}" class="hero" aria-label="${esc(sec('home').label)}"><div class="wrap hero-in"><div class="hero-grid">
      <div class="hero-copy">
        <h1>${esc(h.headline)}</h1>
        <p class="lead">${esc(h.subheadline)}</p>
        ${stats.length ? `<div class="stats">${stats.map((s) => `<div class="stat"><b>${esc(s.value)}</b><span>${esc(s.label)}</span></div>`).join('')}</div>` : ''}
        <div class="cta-row">
          <a class="btn" href="${esc(safe(booking))}"${on}>${esc(h.primaryCta)} <i class="fa-solid fa-arrow-right"></i></a>
          ${h.secondaryCta ? `<a class="btn btn-ghost" href="#${esc(sec('services').id)}">${esc(h.secondaryCta)}</a>` : ''}
        </div>
      </div>
      ${slides.length ? `<div class="hero-art"><div class="arch" id="arch">
        ${slides.map((s, i) => `<img src="${esc(safe(s))}" alt="" class="${i === 0 ? 'on' : ''}" ${i === 0 ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`).join('')}</div>
        ${slides.length > 1 ? `<div class="dots" id="dots">${slides.map((_, i) => `<button class="${i === 0 ? 'on' : ''}" aria-label="Show photo ${i + 1}"></button>`).join('')}</div>` : ''}</div>` : ''}
    </div>${quickbar()}</div></section>`;
  }

  // "Book in under a minute" – pick a service, jump straight to live availability.
  function quickbar() {
    if (!bookOn()) return '';
    const ui = D.settings.bookingUi;
    const groups = D.categories.map((c) => ({ name: c.name, items: c.items.filter((i) => i.bookable) })).filter((g) => g.items.length);
    if (!groups.length) return '';
    return `<form class="quick" id="quick" aria-label="Quick booking">
      <div class="quick-lab"><span class="ico"><i class="fa-regular fa-calendar-check"></i></span><div><b>${esc(ui.quickLabel)}</b><span>Live availability, instant confirmation</span></div></div>
      <label class="quick-sel"><span class="sr">Service</span><select id="quickSvc"><option value="">${esc(ui.quickPlaceholder)}</option>
        ${groups.map((g) => `<optgroup label="${esc(g.name)}">${g.items.map((i) => `<option value="${i.id}">${esc(i.name)} · ${esc(durTxt(i.duration))}</option>`).join('')}</optgroup>`).join('')}</select><i class="fa-solid fa-chevron-down"></i></label>
      <button class="btn" type="submit">${esc(ui.quickButton)} <i class="fa-solid fa-arrow-right"></i></button></form>`;
  }

  function stepsBand() {
    const ui = D.settings.bookingUi, steps = (ui.steps || []).filter((s) => s.title);
    if (!bookOn() || !steps.length) return '';
    return `<div class="howto"><div class="wrap"><h2 class="howto-h">${esc(ui.stepsHeading)}</h2>
      <ol class="howto-list">${steps.map((st, i) => `<li class="step"><span class="step-ico"><i class="fa-solid fa-${icoName(st.icon, 'check')}"></i><em>${i + 1}</em></span><div><h3>${esc(st.title)}</h3><p>${esc(st.text)}</p></div></li>`).join('')}</ol></div></div>`;
  }

  function about() {
    const a = D.settings.about;
    const row = (h, body, img, cta, flip, target) => `<div class="about-row ${flip ? 'flip' : ''}" ${target ? `id="${target}"` : ''}>
      <div class="about-copy"><h2>${esc(h)}</h2>${paras(body)}${cta ? `<a class="btn btn-ghost" href="${flip ? '#' + esc(sec('gallery').id) : '#aboutMore'}">${esc(cta)}</a>` : ''}</div>
      ${img ? `<div class="frame"><img src="${esc(safe(img))}" alt="" loading="lazy" decoding="async"></div>` : ''}</div>`;
    return wrapSection('about', `<div class="section-head">${ribbon('about')}</div>
      ${row(a.heading, a.body, a.image, a.cta, false)}
      ${a.heading2 || a.body2 ? row(a.heading2, a.body2, a.image2, a.cta2, true, 'aboutMore') : ''}`);
  }

  function services() {
    const s = D.settings.servicesSection;
    if (!D.categories.length) return '';
    return wrapSection('services', `<div class="section-head">${ribbon('services')}<h2>${esc(s.heading)}</h2>${s.intro ? `<p>${esc(s.intro)}</p>` : ''}</div>
      <div class="svc"><div class="tabs" role="tablist" aria-label="Service categories" id="tabs">
        ${D.categories.map((c, i) => `<button class="tab" role="tab" id="tab-${c.id}" aria-selected="${i === 0}" aria-controls="svcPanel" tabindex="${i === 0 ? 0 : -1}" data-i="${i}">${esc(c.name)}</button>`).join('')}
      </div><div id="svcPanel" role="tabpanel"></div></div>`);
  }
  function servicePanel(i) {
    const c = D.categories[i], s = D.settings.servicesSection;
    const ext = safe(c.bookUrl);
    const pics = [c.imageA, c.imageB].filter(Boolean);
    const rowBtn = (it) => (bookOn() && it.bookable ? `<button class="bk-btn" data-book="${it.id}" aria-label="Book ${esc(it.name)}"><i class="fa-regular fa-calendar-plus"></i><span>Book</span></button>` : '');
    return `<div class="panel${bookOn() ? ' bk-on' : ''}" aria-labelledby="tab-${c.id}"><div>
      <h3>${esc(c.name)}</h3>${c.blurb ? `<p class="blurb">${esc(c.blurb)}</p>` : ''}
      ${c.items.length ? `<div class="price-head"><span>${esc(s.priceHeading)}</span><span>${esc(s.priceHeading2)}</span></div>
      <ul class="prices">${c.items.map((it) => `<li><span class="nm">${esc(it.name)}<small>${bookOn() && it.bookable ? `<i class="fa-regular fa-clock"></i> ${esc(durTxt(it.duration))}` : ''}${it.note ? `${bookOn() && it.bookable ? ' · ' : ''}${esc(it.note)}` : ''}</small></span><span class="lead-dots"></span>${it.price ? `<span class="pr">${esc(it.price)}</span>` : '<span class="pr ask">On request</span>'}${rowBtn(it)}</li>`).join('')}</ul>`
        : `<p class="empty-note">${esc(s.emptyNote)}</p>`}
      <a class="btn" href="${esc(ext || booking)}"${!ext && bookOn() ? ' data-book' : ''}><i class="fa-regular fa-calendar-check"></i> ${esc(s.bookLabel)}</a></div>
      ${pics.length ? `<div class="pics">${pics.map((p) => `<div class="frame"><img src="${esc(safe(p))}" alt="${esc(c.name)}" loading="lazy" decoding="async"></div>`).join('')}</div>` : ''}</div>`;
  }

  function gallery() {
    const g = D.settings.gallerySection;
    if (!D.gallery.length) return '';
    const hasV = D.gallery.some((x) => x.type === 'video'), hasP = D.gallery.some((x) => x.type === 'photo');
    return wrapSection('gallery', `<div class="section-head">${ribbon('gallery')}<h2>${esc(g.heading)}</h2>${g.intro ? `<p>${esc(g.intro)}</p>` : ''}</div>
      ${hasV && hasP ? `<div class="filters" role="group" aria-label="Filter gallery">${[['all', 'All'], ['photo', 'Photos'], ['video', 'Videos']].map(([k, l], i) => `<button class="pill" data-f="${k}" aria-pressed="${i === 0}">${l}</button>`).join('')}</div>` : ''}
      <div class="masonry" id="masonry"></div><div class="more-row"><button class="btn btn-ghost hide" id="moreBtn">Show more</button></div>`);
  }

  function booking_() {
    const b = D.settings.booking;
    const pics = [b.image, b.image2].filter(Boolean);
    const on = bookOn() ? ' data-book' : '';
    return wrapSection('booking', `<div class="booking-grid"><div>${ribbon('booking')}<h2>${esc(b.heading)}</h2>
      <h3>${esc(b.subheading)}</h3><p>${esc(b.text)}</p><a class="btn" href="${esc(safe(booking))}"${on}><i class="fa-regular fa-calendar-check"></i> ${esc(b.cta)}</a></div>
      ${pics.length ? `<div class="pair">${pics.map((p) => `<div class="frame"><img src="${esc(safe(p))}" alt="" loading="lazy" decoding="async"></div>`).join('')}</div>` : ''}</div>`, 'booking');
  }

  const SOCIAL_LABEL = { 'x-twitter': 'X', facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', whatsapp: 'WhatsApp', linkedin: 'LinkedIn', pinterest: 'Pinterest', snapchat: 'Snapchat', telegram: 'Telegram' };
  const socials = () => (D.settings.contact.social || []).filter((s) => safe(s.url) && /^[a-z0-9-]+$/.test(s.platform)).map((s) => `<a href="${esc(safe(s.url))}" target="_blank" rel="noopener" aria-label="${esc(SOCIAL_LABEL[s.platform] || s.platform)}"><i class="fa-brands fa-${s.platform}"></i></a>`).join('');
  const waLink = (c) => `https://wa.me/${digits(c.whatsapp).replace(/^0/, '254')}?text=${encodeURIComponent(c.whatsappMessage || '')}`;

  function field(id, label, type, extra = '', tag = 'input') {
    const el = tag === 'textarea' ? `<textarea id="${id}" name="${id}" ${extra}></textarea>` : `<input id="${id}" name="${id}" type="${type}" ${extra}>`;
    return `<label class="field"><span>${label}</span>${el}<div class="err" role="alert"></div></label>`;
  }

  function contact() {
    const c = D.settings.contact;
    const hours = hoursRows();
    return wrapSection('contact', `<div class="section-head">${ribbon('contact')}<h2>${esc(c.heading)}</h2><p>${esc(c.intro)}</p></div>
      <div class="contact-grid"><div>
        <ul class="info-list">
          ${c.address ? `<li><i class="fa-solid fa-location-dot"></i><div><small>Visit us</small><a href="${esc(safe(c.mapsUrl) || '#')}" target="_blank" rel="noopener">${esc(c.address)}</a></div></li>` : ''}
          ${c.email ? `<li><i class="fa-solid fa-envelope"></i><div><small>Email</small><a href="mailto:${esc(c.email)}?subject=${encodeURIComponent('Request the Service')}&body=${encodeURIComponent('Dear Elixir Team,')}">${esc(c.email)}</a></div></li>` : ''}
          ${c.phone ? `<li><i class="fa-solid fa-phone"></i><div><small>Phone</small><a href="${esc(telHref(c.phone))}">${esc(c.phone)}</a>${c.phone2 ? ` &nbsp;/&nbsp; <a href="${esc(telHref(c.phone2))}">${esc(c.phone2)}</a>` : ''}</div></li>` : ''}
          ${c.whatsapp ? `<li><i class="fa-brands fa-whatsapp"></i><div><small>WhatsApp</small><a href="${esc(waLink(c))}" target="_blank" rel="noopener">${esc(c.whatsapp)}</a></div></li>` : ''}
          ${hours.length ? `<li><i class="fa-regular fa-clock"></i><div><small>Opening hours</small><dl class="hours">${hours.map((h) => `<div><dt>${esc(h.days)}</dt><dd>${esc(h.time)}</dd></div>`).join('')}</dl>${c.hoursNote ? `<small style="margin-top:6px">${esc(c.hoursNote)}</small>` : ''}</div></li>` : ''}
        </ul>${socials() ? `<div class="socials">${socials()}</div>` : ''}
      </div>
      <form class="card-form" id="contactForm" novalidate><h3>Send us a message</h3><p>${esc(c.formIntro)}</p>
        <div class="notice" role="status"></div>
        ${field('c_name', 'Full name', 'text', 'autocomplete="name" required placeholder="Your full name"')}
        ${field('c_email', 'Email', 'email', 'autocomplete="email" inputmode="email" required placeholder="you@example.com"')}
        ${field('c_phone', 'Phone number', 'tel', 'autocomplete="tel" inputmode="tel" required placeholder="0712 345 678"')}
        ${field('c_message', 'How can we help?', 'text', 'required placeholder="Tell us something here!"', 'textarea')}
        <input class="hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
        <button class="btn" type="submit">Submit</button></form></div>`);
  }

  function work() {
    const w = D.settings.work;
    const list = (a) => `<ul class="checks">${(a || []).filter(Boolean).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
    return wrapSection('work', `<div class="section-head">${ribbon('work')}<h2>${esc(w.heading)}</h2><p>${esc(w.intro)}</p></div>
      <div class="work-grid"><div>
        ${(w.why || []).length ? `<h3>${esc(w.whyHeading)}</h3>${list(w.why)}` : ''}
        ${(w.requirements || []).length ? `<h3>${esc(w.requirementsHeading)}</h3>${list(w.requirements)}` : ''}
      </div><aside class="openings">
        ${w.image ? `<div class="frame"><img src="${esc(safe(w.image))}" alt="" loading="lazy" decoding="async"></div>` : ''}
        <h3>${esc(w.openingsHeading)}</h3>
        ${D.jobs.length ? `<ul class="checks">${D.jobs.map((j) => `<li>${esc(j.title)}${j.description ? `<small>${esc(j.description)}</small>` : ''}</li>`).join('')}</ul>` : '<p class="no-reviews">No openings right now – send us your CV and we will keep it on file.</p>'}
        <button class="btn" id="applyBtn">${esc(w.cta)}</button></aside></div>`);
  }

  function promo() {
    const p = D.settings.promoSection;
    if (!D.promotions.length) return '';
    const on = bookOn() ? ' data-book' : '';
    return wrapSection('promo', `<div class="section-head">${ribbon('promo')}<h2>${esc(p.heading)}</h2></div>
      <div class="promos">${D.promotions.map((x) => `<article class="promo"><span class="promo-ic"><i class="fa-solid fa-${icoName(x.icon)}"></i></span><h3>${esc(x.title)}</h3><p>${esc(x.body)}</p>
        <a class="btn btn-sm" href="${esc(safe(x.ctaUrl) || booking)}"${safe(x.ctaUrl) ? '' : on}>${esc(x.ctaLabel || p.claimLabel)} <i class="fa-solid fa-arrow-right"></i></a></article>`).join('')}</div>
      <div class="closing"><h2>${esc(p.closingHeading)}</h2><p>${esc(p.closingText)}</p><a class="btn" href="${esc(safe(booking))}"${on}><i class="fa-regular fa-calendar-check"></i> ${esc(p.closingCta)}</a></div>`);
  }

  function testimonials() {
    const t = D.settings.testimonialsSection;
    const star = '<i class="fa-solid fa-star"></i>';
    return wrapSection('testimonials', `<div class="t-head"><div class="section-head">${ribbon('testimonials')}<h2>${esc(t.heading)}</h2></div>
      <div class="t-nav"><button id="tPrev" aria-label="Previous reviews"><i class="fa-solid fa-arrow-left"></i></button><button id="tNext" aria-label="Next reviews"><i class="fa-solid fa-arrow-right"></i></button></div></div>
      ${D.testimonials.length ? `<div class="track" id="track" tabindex="0" aria-label="Client reviews">${D.testimonials.map((r) => `<figure class="review" style="margin:0">
        <div class="stars" role="img" aria-label="${r.stars} out of 5 stars">${star.repeat(r.stars)}<span class="off">${star.repeat(5 - r.stars)}</span></div>
        <blockquote>${esc(r.comment)}</blockquote><figcaption class="who"><b>${esc(r.name)}</b><span>${esc(r.type)}</span></figcaption>
        ${r.feedback ? `<div class="reply"><b>${esc(t.replyLabel)}</b>${esc(r.feedback)}</div>` : ''}</figure>`).join('')}</div>` : '<p class="no-reviews">Be the first to share your experience.</p>'}
      <div style="margin-top:14px"><button class="btn btn-ghost" id="rateBtn"><i class="fa-regular fa-star"></i> ${esc(t.rateLabel)}</button></div>`);
  }

  function footer() {
    const c = D.settings.contact, b = D.settings.brand;
    const hours = hoursRows();
    const S = (k) => sec(k);
    const on = bookOn() ? ' data-book' : '';
    const bk = esc(safe(booking));
    return `<footer><div class="wrap"><div class="foot-grid">
      <div class="foot-logo"><img src="${esc(safe(b.logo))}" alt="${esc(b.name)}"><p>${esc(b.tagline)}</p>${socials() ? `<div class="socials">${socials()}</div>` : ''}</div>
      <div><h4>Contact Us</h4><ul>
        ${c.address ? `<li><i class="fa-solid fa-location-dot"></i><a href="${esc(safe(c.mapsUrl) || '#')}" target="_blank" rel="noopener">${esc(c.address)}</a></li>` : ''}
        ${c.email ? `<li><i class="fa-solid fa-envelope"></i><a href="mailto:${esc(c.email)}?subject=${encodeURIComponent('Request the Service')}&body=${encodeURIComponent('Dear Elixir Team,')}">${esc(c.email)}</a></li>` : ''}
        ${c.phone2 || c.phone ? `<li><i class="fa-solid fa-phone"></i><a href="${esc(telHref(c.phone2 || c.phone))}">${esc(c.phone2 || c.phone)}</a></li>` : ''}
        ${c.whatsapp ? `<li><i class="fa-brands fa-whatsapp"></i><a href="${esc(waLink(c))}" target="_blank" rel="noopener">${esc(c.whatsapp)}</a></li>` : ''}
        ${hours.length ? `<li style="display:flex"><i class="fa-regular fa-clock" style="margin-top:.3em"></i><span>${hours.map((h) => `${esc(h.days)}: ${esc(h.time)}`).join('<br>')}</span></li>` : ''}
      </ul></div>
      <div><h4>Quick Links</h4><ul>
        <li><a href="#${esc(S('services').id)}">Services</a></li><li><a href="#${esc(S('about').id)}">About Us</a></li><li><a href="#${esc(S('contact').id)}">Contact Us</a></li>
        <li><a href="#${esc(S('booking').id)}">Book Appointment</a></li><li><a href="#${esc(S('work').id)}">Work With Us</a></li><li><a href="?privacy-policy=true" data-open="privacy">Privacy Policy</a></li></ul></div>
      <div><h4>Book Online</h4><p style="color:var(--muted)">${esc(D.settings.booking.text)}</p><a class="btn btn-sm" href="${bk}"${on}><i class="fa-regular fa-calendar-check"></i> Book Now</a></div>
    </div><div class="foot-bottom"><p>© ${new Date().getFullYear()} <a href="/">${esc(b.name)}.</a> All rights reserved.</p>
      ${b.creditName ? `<p>${esc(b.creditLabel)}: <a href="${esc(safe(b.creditUrl) || '#')}">${esc(b.creditName)}</a></p>` : ''}</div></div></footer>
      ${c.whatsapp ? `<a class="wa-float" href="${esc(waLink(c))}" target="_blank" rel="noopener" aria-label="Chat on WhatsApp"><i class="fa-brands fa-whatsapp"></i></a>` : ''}
      <nav class="mbar" aria-label="Quick actions"><a class="btn" href="${bk}"${on}><i class="fa-regular fa-calendar-check"></i> Book now</a>
        ${c.phone ? `<a class="mb" href="${esc(telHref(c.phone))}" aria-label="Call us"><i class="fa-solid fa-phone"></i></a>` : ''}
        ${c.whatsapp ? `<a class="mb wa" href="${esc(waLink(c))}" target="_blank" rel="noopener" aria-label="WhatsApp"><i class="fa-brands fa-whatsapp"></i></a>` : ''}</nav>`;
  }

  function dialogs() {
    const p = D.settings.privacy;
    const jobs = D.jobs;
    return `
    <dialog id="dApply"><div class="dlg"><button class="dlg-x" data-x aria-label="Close"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg></button>
      <h3>Application Form</h3><form id="applyForm" novalidate><div class="notice" role="status"></div>
        ${field('a_name', 'Full name', 'text', 'autocomplete="name" required')}
        ${field('a_email', 'Email address', 'email', 'autocomplete="email" inputmode="email" required')}
        ${field('a_phone', 'Phone number', 'tel', 'autocomplete="tel" inputmode="tel" required placeholder="0712345678"')}
        <label class="field"><span>Position</span><select id="a_position" name="position"><option value="">General application</option>${jobs.map((j) => `<option>${esc(j.title)}</option>`).join('')}</select></label>
        <label class="field"><span>Your CV (PDF, DOC or DOCX, max 5 MB)</span><input id="a_cv" name="cv" type="file" accept=".pdf,.doc,.docx" required><div class="err" role="alert"></div></label>
        <input class="hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
        <button class="btn" type="submit">Submit application</button></form></div></dialog>

    <dialog id="dRate"><div class="dlg"><button class="dlg-x" data-x aria-label="Close"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg></button>
      <h3>Please Rate Us</h3><form id="rateForm" novalidate><div class="notice" role="status"></div>
        ${field('r_name', 'Your name', 'text', 'autocomplete="name" required')}
        <fieldset class="starpick"><legend class="sr">Rating</legend>
          ${[5, 4, 3, 2, 1].map((n) => `<input type="radio" name="stars" id="s${n}" value="${n}"><label for="s${n}" title="${n} star${n > 1 ? 's' : ''}"><i class="fa-solid fa-star"></i></label>`).join('')}</fieldset>
        <div class="field" id="starErr"><div class="err" role="alert"></div></div>
        ${field('r_comment', 'Your comment', 'text', 'required placeholder="Tell us about your visit"', 'textarea')}
        <input class="hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
        <button class="btn" type="submit">Submit</button></form></div></dialog>

    <dialog id="dPrivacy"><div class="dlg wide legal"><button class="dlg-x" data-x aria-label="Close"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg></button>
      <h3>${esc(p.heading)}</h3>${p.effective ? `<p class="eff">Effective: ${esc(p.effective)}</p>` : ''}${md(p.body)}</div></dialog>

    <div class="lightbox" id="lb" role="dialog" aria-modal="true" aria-label="Gallery viewer">
      <button class="lb-btn lb-close" id="lbClose" aria-label="Close"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg></button>
      <button class="lb-btn lb-prev" id="lbPrev" aria-label="Previous"><i class="fa-solid fa-chevron-left"></i></button>
      <div class="stage" id="lbStage"></div>
      <button class="lb-btn lb-next" id="lbNext" aria-label="Next"><i class="fa-solid fa-chevron-right"></i></button>
      <div class="lb-count" id="lbCount"></div></div>`;
  }

  // ---------- behaviours ----------
  function initHeader() {
    const header = $('.header'), drawer = $('#drawer'), burger = $('#burger');
    const onScroll = () => header.classList.toggle('stuck', scrollY > 8);
    addEventListener('scroll', onScroll, { passive: true }); onScroll();
    const setDrawer = (open) => { drawer.classList.toggle('open', open); drawer.setAttribute('aria-hidden', !open); burger.setAttribute('aria-expanded', open); document.body.style.overflow = open ? 'hidden' : ''; };
    burger.addEventListener('click', () => setDrawer(true));
    $$('[data-close]', drawer).forEach((b) => b.addEventListener('click', () => setDrawer(false)));
    $$('a.dl', drawer).forEach((a) => a.addEventListener('click', () => setDrawer(false)));
    addEventListener('keydown', (e) => { if (e.key === 'Escape') setDrawer(false); });

    // highlight the section in view
    const links = $$('.nav a.nl, .drawer a.dl');
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) links.forEach((l) => l.classList.toggle('on', l.getAttribute('href') === '#' + en.target.id)); });
    }, { rootMargin: '-45% 0px -50% 0px' });
    D.settings.sections.forEach((s) => { const el = document.getElementById(s.id); if (el) io.observe(el); });
  }

  function initHero() {
    const arch = $('#arch'); if (!arch) return;
    const imgs = $$('img', arch), dots = $$('#dots button');
    if (imgs.length < 2) return;
    let i = 0, timer;
    const show = (n) => { i = (n + imgs.length) % imgs.length; imgs.forEach((im, k) => im.classList.toggle('on', k === i)); dots.forEach((d, k) => d.classList.toggle('on', k === i)); };
    const start = () => { if (!matchMedia('(prefers-reduced-motion: reduce)').matches) timer = setInterval(() => show(i + 1), 5000); };
    dots.forEach((d, k) => d.addEventListener('click', () => { clearInterval(timer); show(k); start(); }));
    document.addEventListener('visibilitychange', () => { clearInterval(timer); if (!document.hidden) start(); });
    start();
  }

  function initServices() {
    const tabs = $('#tabs'); if (!tabs) return;
    const panel = $('#svcPanel'), btns = $$('.tab', tabs);
    const select = (i, focus) => {
      btns.forEach((b, k) => { b.setAttribute('aria-selected', k === i); b.tabIndex = k === i ? 0 : -1; });
      panel.innerHTML = servicePanel(i);
      if (focus) btns[i].focus();
    };
    btns.forEach((b, i) => b.addEventListener('click', () => select(i)));
    tabs.addEventListener('keydown', (e) => {
      const cur = btns.findIndex((b) => b.getAttribute('aria-selected') === 'true');
      const dir = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
      if (dir) { e.preventDefault(); select((cur + dir + btns.length) % btns.length, true); }
    });
    select(0);
  }

  function initGallery() {
    const grid = $('#masonry'); if (!grid) return;
    const STEP = 16, moreBtn = $('#moreBtn');
    let filter = 'all', shown = STEP, list = [];
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { const v = e.target; v.src = v.dataset.src; v.load(); io.unobserve(v); } }), { rootMargin: '300px' });

    function draw() {
      list = D.gallery.filter((g) => filter === 'all' || g.type === filter);
      grid.innerHTML = list.slice(0, shown).map((g, i) => g.type === 'video'
        ? `<button class="tile" data-i="${i}" aria-label="Play video ${i + 1}"><video muted loop playsinline preload="metadata" data-src="${esc(safe(g.src))}#t=0.4"></video><span class="play"><i class="fa-solid fa-play"></i></span></button>`
        : `<button class="tile" data-i="${i}" aria-label="${esc(g.caption || 'Open photo ' + (i + 1))}"><img src="${esc(safe(g.src))}" alt="${esc(g.caption)}" loading="lazy" decoding="async"></button>`).join('');
      $$('video', grid).forEach((v) => {
        io.observe(v);
        const tile = v.parentElement;
        if (matchMedia('(hover: hover)').matches) { tile.addEventListener('mouseenter', () => v.play().catch(() => {})); tile.addEventListener('mouseleave', () => v.pause()); }
      });
      moreBtn.classList.toggle('hide', shown >= list.length);
    }
    $$('.pill').forEach((p) => p.addEventListener('click', () => { filter = p.dataset.f; shown = STEP; $$('.pill').forEach((x) => x.setAttribute('aria-pressed', x === p)); draw(); }));
    moreBtn.addEventListener('click', () => { shown += STEP; draw(); });
    grid.addEventListener('click', (e) => { const t = e.target.closest('.tile'); if (t) openLB(list, +t.dataset.i); });
    draw();
  }

  // Lightbox
  let lbList = [], lbI = 0;
  function openLB(list, i) { lbList = list; lbI = i; $('#lb').classList.add('open'); document.body.style.overflow = 'hidden'; showLB(); $('#lbClose').focus(); }
  function closeLB() { $('#lb').classList.remove('open'); $('#lbStage').innerHTML = ''; document.body.style.overflow = ''; }
  function showLB() {
    const g = lbList[lbI];
    $('#lbStage').innerHTML = g.type === 'video' ? `<video src="${esc(safe(g.src))}" controls autoplay playsinline></video>` : `<img src="${esc(safe(g.src))}" alt="${esc(g.caption)}">`;
    $('#lbCount').textContent = `${lbI + 1} / ${lbList.length}${g.caption ? ' – ' + g.caption : ''}`;
  }
  const stepLB = (d) => { lbI = (lbI + d + lbList.length) % lbList.length; showLB(); };
  function initLightbox() {
    const lb = $('#lb');
    $('#lbClose').onclick = closeLB; $('#lbPrev').onclick = () => stepLB(-1); $('#lbNext').onclick = () => stepLB(1);
    lb.addEventListener('click', (e) => { if (e.target === lb) closeLB(); });
    addEventListener('keydown', (e) => { if (!lb.classList.contains('open')) return; if (e.key === 'Escape') closeLB(); if (e.key === 'ArrowLeft') stepLB(-1); if (e.key === 'ArrowRight') stepLB(1); });
    let x0 = null;
    lb.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', (e) => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 50) stepLB(dx < 0 ? 1 : -1); x0 = null; });
  }

  function initTestimonials() {
    const tr = $('#track');
    if (tr) {
      $('#tPrev').onclick = () => tr.scrollBy({ left: -tr.clientWidth * .8, behavior: 'smooth' });
      $('#tNext').onclick = () => tr.scrollBy({ left: tr.clientWidth * .8, behavior: 'smooth' });
    }
  }

  // ---------- dialogs & URL params (keeps ?privacy-policy=true, ?apply-for-work=true, ?rate-us=true working) ----------
  const PARAMS = { dPrivacy: 'privacy-policy', dApply: 'apply-for-work', dRate: 'rate-us' };
  function openDlg(id) {
    const d = document.getElementById(id); if (!d || d.open) return;
    d.showModal();
    const u = new URL(location.href); u.search = ''; u.searchParams.set(PARAMS[id], 'true'); history.replaceState({}, '', u);
  }
  function initDialogs() {
    $$('dialog').forEach((d) => {
      d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('[data-x]')) d.close(); });
      d.addEventListener('close', () => { const u = new URL(location.href); u.search = ''; history.replaceState({}, '', u); });
    });
    $('#applyBtn')?.addEventListener('click', () => openDlg('dApply'));
    $('#rateBtn')?.addEventListener('click', () => openDlg('dRate'));
    $$('[data-open="privacy"]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); openDlg('dPrivacy'); }));
    const p = new URLSearchParams(location.search);
    for (const [id, key] of Object.entries(PARAMS)) if (p.get(key) === 'true') openDlg(id);
  }

  // ---------- forms ----------
  const rules = {
    name: (v) => (v.trim().length >= 2 ? '' : 'Please enter your name.'),
    email: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? '' : 'Please enter a valid email address.'),
    phone: (v) => (/^\d{9,15}$/.test(v.replace(/[\s\-().+]/g, '')) ? '' : 'Please enter a valid phone number.'),
    text: (v) => (v.trim().length >= 5 ? '' : 'Please write a little more.'),
  };
  function setErr(input, msg) {
    const f = input.closest('.field'); if (!f) return !msg;
    f.classList.toggle('bad', !!msg); const e = $('.err', f); if (e) e.textContent = msg || '';
    return !msg;
  }
  const notice = (form, msg, ok) => { const n = $('.notice', form); n.className = `notice show ${ok ? 'ok' : 'fail'}`; n.textContent = msg; n.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); };
  async function send(form, url, body, isForm) {
    const btn = $('button[type=submit]', form), label = btn.textContent;
    btn.disabled = true; btn.textContent = 'Sending…';
    try {
      const r = await fetch(url, isForm ? { method: 'POST', body } : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Something went wrong. Please try again.');
      return j;
    } finally { btn.disabled = false; btn.textContent = label; }
  }

  function initForms() {
    const hpOf = (f) => f.elements.website.value;
    $('#contactForm')?.addEventListener('submit', async (e) => {
      e.preventDefault(); const f = e.target;
      const ok = [setErr(f.c_name, rules.name(f.c_name.value)), setErr(f.c_email, rules.email(f.c_email.value)), setErr(f.c_phone, rules.phone(f.c_phone.value)), setErr(f.c_message, rules.text(f.c_message.value))].every(Boolean);
      if (!ok) return $('.bad input, .bad textarea', f)?.focus();
      try {
        await send(f, '/api/contact', { name: f.c_name.value, email: f.c_email.value, phone: f.c_phone.value, message: f.c_message.value, website: hpOf(f) });
        f.reset(); notice(f, 'Thank you! Your message is on its way – please check your email for a confirmation.', true);
      } catch (err) { notice(f, err.message, false); }
    });

    $('#applyForm')?.addEventListener('submit', async (e) => {
      e.preventDefault(); const f = e.target, file = f.a_cv.files[0];
      const cvErr = !file ? 'Please attach your CV.' : file.size > 5 * 1024 * 1024 ? 'That file is larger than 5 MB.' : !/\.(pdf|docx?)$/i.test(file.name) ? 'Please use a PDF, DOC or DOCX file.' : '';
      const ok = [setErr(f.a_name, rules.name(f.a_name.value)), setErr(f.a_email, rules.email(f.a_email.value)), setErr(f.a_phone, rules.phone(f.a_phone.value)), setErr(f.a_cv, cvErr)].every(Boolean);
      if (!ok) return;
      const fd = new FormData();
      fd.append('name', f.a_name.value.trim()); fd.append('email', f.a_email.value.trim()); fd.append('phone', f.a_phone.value.trim());
      fd.append('position', f.a_position.value); fd.append('cv', file); fd.append('website', hpOf(f));
      try { await send(f, '/api/applications', fd, true); f.reset(); notice(f, 'Application submitted! Please check your email for a confirmation.', true); }
      catch (err) { notice(f, err.message, false); }
    });

    $('#rateForm')?.addEventListener('submit', async (e) => {
      e.preventDefault(); const f = e.target, stars = f.querySelector('input[name=stars]:checked');
      const starEl = $('#starErr'); starEl.classList.toggle('bad', !stars); $('.err', starEl).textContent = stars ? '' : 'Please choose a star rating.';
      const ok = [setErr(f.r_name, rules.name(f.r_name.value)), !!stars, setErr(f.r_comment, rules.text(f.r_comment.value))].every(Boolean);
      if (!ok) return;
      try {
        const j = await send(f, '/api/ratings', { name: f.r_name.value, stars: +stars.value, comment: f.r_comment.value, website: hpOf(f) });
        f.reset(); notice(f, j.pending ? 'Thank you! Your review will appear once our team has had a look.' : 'Thank you for your review!', true);
        if (!j.pending) setTimeout(() => location.reload(), 1200);
      } catch (err) { notice(f, err.message, false); }
    });
    // clear an error as soon as the person fixes the field
    document.addEventListener('input', (e) => { if (e.target.closest('.field.bad')) e.target.closest('.field').classList.remove('bad'); });
  }

  // ---------- booking hooks, reveal-on-scroll ----------
  function initBooking() {
    document.addEventListener('click', (e) => {
      const t = e.target.closest('[data-book]');
      if (!t || !bookOn() || !window.ElixirBooking || e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      const dr = $('#drawer'); if (dr) { dr.classList.remove('open'); dr.setAttribute('aria-hidden', 'true'); document.body.style.overflow = ''; }
      const raw = t.dataset.book;
      window.ElixirBooking.open({ services: raw ? raw.split(',').map(Number).filter(Boolean) : [] });
    });
    const q = $('#quick');
    if (q) q.addEventListener('submit', (e) => { e.preventDefault(); const v = +$('#quickSvc').value; window.ElixirBooking.open({ services: v ? [v] : [] }); });
    if (window.ElixirBooking) window.ElixirBooking.init(D);
  }

  function initReveal() {
    if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const els = $$('.section-head, .about-row, .panel, .promo, .review, .contact-grid > *, .work-grid > *, .step, .quick, .closing, .booking-grid > *, .howto-h');
    document.documentElement.classList.add('rv-on');
    els.forEach((e, i) => { e.classList.add('rv'); if (/promo|review|step/.test(e.className)) e.style.transitionDelay = `${(i % 4) * 90}ms`; });
    const io = new IntersectionObserver((es) => es.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { rootMargin: '0px 0px -6% 0px', threshold: 0.04 });
    els.forEach((e) => io.observe(e));
  }

  // ---------- boot ----------
  function render() {
    cfg = D.settings; booking = safe(cfg.brand.bookingUrl) || '#';
    D.scheduling = D.scheduling || { enabled: false, hours: [] };
    const map = { home: () => hero() + stepsBand(), about, services, gallery, booking: booking_, contact, work, promo, testimonials };
    const body = cfg.sections.filter((s) => s.visible && map[s.key]).map((s) => map[s.key]()).join('');
    $('#app').innerHTML = header() + `<main id="main">${body}</main>` + footer() + dialogs();
    initHeader(); initHero(); initServices(); initGallery(); initLightbox(); initTestimonials(); initDialogs(); initForms(); initBooking(); initReveal();
    if (location.hash) { const t = document.getElementById(location.hash.slice(1)); if (t) setTimeout(() => t.scrollIntoView(), 50); }
  }

  (async () => {
    try { D = window.__SITE__ || await fetch('/api/site').then((r) => r.json()); render(); }
    catch (e) { console.error(e); $('#app').innerHTML = '<div class="boot">We could not load the page. Please refresh, or call us to book.</div>'; }
  })();
})();
