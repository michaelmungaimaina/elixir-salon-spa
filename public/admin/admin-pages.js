/* Elixir admin – pages & router */
(() => {
  'use strict';
  const { h, $, icon, api, toast, fail, modal, confirmBox, sortable, move, pickMedia, dropzone, thumb, fmtSize, fmtDate, buildField, buildForm } = A;
  const root = $('#root');
  let me = null, counts = {}, mailConfigured = true;

  // =========================================================
  // Content schemas – these drive every editable form
  // =========================================================
  const T = (k, label, o = {}) => ({ k, label, type: 'text', ...o });
  const SOCIALS = ['facebook', 'instagram', 'tiktok', 'x-twitter', 'youtube', 'whatsapp', 'linkedin', 'pinterest', 'snapchat', 'telegram'].map((v) => ({ v, l: v === 'x-twitter' ? 'X (Twitter)' : v[0].toUpperCase() + v.slice(1) }));

  const SCHEMA = {
    brand: [T('name', 'Business name', { half: 1 }), T('tagline', 'Tagline', { half: 1 }), T('logo', 'Logo', { type: 'image', hint: 'Shown in the header, footer and browser tab. Transparent PNG works best.' }),
      T('bookingUrl', 'Booking link', { type: 'url', hint: 'Fallback only: used when online booking is switched off (Bookings > Schedule & hours). Normally every “Book” button opens your own booking window.' }),
      T('gtmId', 'Google Tag Manager ID', { half: 1, hint: 'e.g. GTM-XXXXXXX – leave empty to turn tracking off.' }), T('creditLabel', 'Footer credit label', { half: 1 }), T('creditName', 'Footer credit name', { half: 1 }), T('creditUrl', 'Footer credit link', { half: 1, type: 'url' })],
    seo: [T('title', 'Page title', { hint: 'Shown on Google and in the browser tab. About 60 characters.' }), T('description', 'Description', { type: 'textarea', rows: 3, hint: 'Shown under your title on Google. About 150 characters.' }), T('ogImage', 'Sharing image', { type: 'image', hint: 'Shown when the site is shared on WhatsApp, Facebook, etc.' })],
    theme: [T('green', 'Brand green', { type: 'color', half: 1 }), T('gold', 'Brand gold', { type: 'color', half: 1 }), T('ground', 'Page background', { type: 'color', half: 1, hint: 'A deep, dark shade keeps text readable.' })],
    sections: [{ k: '_', type: 'rows', fixed: true, cols: [{ k: 'key', type: 'static' }, { k: 'label', label: 'Name (menu & ribbon)' }, { k: 'nav', type: 'bool', label: 'In menu' }, { k: 'visible', type: 'bool', label: 'Visible' }] }],
    hero: [T('headline', 'Headline', { type: 'textarea', rows: 2 }), T('subheadline', 'Introduction', { type: 'textarea', rows: 3 }),
      { k: 'stats', label: 'Highlights', type: 'rows', addLabel: 'Add highlight', cols: [{ k: 'value', label: 'Number', placeholder: '10+' }, { k: 'label', label: 'Caption', placeholder: 'Years of Experience' }] },
      T('primaryCta', 'Main button text', { half: 1 }), T('secondaryCta', 'Second button text', { half: 1, hint: 'Leave empty to hide.' }), T('slides', 'Hero photos', { type: 'images', hint: 'These fade one after another. The first is shown first.' })],
    about: [T('heading', 'First heading'), T('body', 'First text', { type: 'textarea', rows: 6, hint: 'Leave a blank line between paragraphs.' }), T('image', 'First photo', { type: 'image' }), T('cta', 'Button text', { half: 1 }),
      { k: 'sp1', type: 'text', label: '', hidden: 1 },
      T('heading2', 'Second heading'), T('body2', 'Second text', { type: 'textarea', rows: 9 }), T('image2', 'Second photo', { type: 'image' }), T('cta2', 'Button text', { half: 1, hint: 'Scrolls down to the gallery.' })].filter((f) => !f.hidden),
    servicesSection: [T('heading', 'Section heading'), T('intro', 'Intro text (optional)', { type: 'textarea', rows: 2 }), T('bookLabel', 'Book button text', { half: 1 }), T('priceHeading', 'Price list – left heading', { half: 1 }), T('priceHeading2', 'Price list – right heading', { half: 1 }), T('emptyNote', 'Message for categories with no prices yet', { type: 'textarea', rows: 2 })],
    gallerySection: [T('heading', 'Section heading'), T('intro', 'Intro text', { type: 'textarea', rows: 2 })],
    booking: [T('heading', 'Heading'), T('subheading', 'Sub-heading'), T('text', 'Text', { type: 'textarea', rows: 2 }), T('cta', 'Button text', { half: 1 }), T('image', 'Photo 1', { type: 'image', half: 1 }), T('image2', 'Photo 2', { type: 'image', half: 1 })],
    contact: [T('heading', 'Heading'), T('intro', 'Intro text', { type: 'textarea', rows: 2 }), T('formIntro', 'Text above the form', { type: 'textarea', rows: 2 }),
      T('email', 'Email', { half: 1 }), T('phone', 'Phone', { half: 1 }), T('phone2', 'Second phone', { half: 1 }), T('whatsapp', 'WhatsApp number', { half: 1 }), T('whatsappMessage', 'WhatsApp starter message', { hint: 'Pre-filled when someone taps the WhatsApp button.' }),
      T('address', 'Address', { half: 1 }), T('mapsUrl', 'Google Maps link', { half: 1, type: 'url' }),
      T('hoursNote', 'Note under opening hours', { hint: 'Opening hours themselves come from Bookings > Schedule & hours, so they are always the same everywhere. Use this for notes like “Closed on public holidays”.' }),
      { k: 'social', label: 'Social media', type: 'rows', addLabel: 'Add network', hint: 'Networks with an empty link are hidden.', cols: [{ k: 'platform', label: 'Network', type: 'select', options: SOCIALS, def: 'facebook' }, { k: 'url', label: 'Link (https://…)', wide: false }] }],
    work: [T('heading', 'Heading'), T('intro', 'Intro text', { type: 'textarea', rows: 3 }), T('image', 'Photo', { type: 'image' }), T('whyHeading', '“Why join” heading', { half: 1 }), T('openingsHeading', '“Openings” heading', { half: 1 }),
      T('why', 'Reasons to join', { type: 'list', addLabel: 'Add reason' }), T('requirementsHeading', 'Requirements heading', { half: 1 }), T('cta', 'Apply button text', { half: 1 }), T('requirements', 'Requirements', { type: 'list', addLabel: 'Add requirement' })],
    promoSection: [T('heading', 'Heading'), T('claimLabel', 'Default offer button text', { half: 1 }), T('closingHeading', 'Closing heading'), T('closingText', 'Closing text', { type: 'textarea', rows: 2 }), T('closingCta', 'Closing button text', { half: 1 })],
    testimonialsSection: [T('heading', 'Heading'), T('rateLabel', '“Share your experience” button', { half: 1 }), T('replyLabel', 'Label above your replies', { half: 1 }), T('autoApprove', 'Publish new reviews automatically', { type: 'bool', hint: 'Off (recommended): reviews wait for your approval first.' })],
    privacy: [T('heading', 'Heading', { half: 1 }), T('effective', 'Effective date', { half: 1 }), T('body', 'Policy text', { type: 'textarea', rows: 24, hint: 'Use “## Title” for headings, “- ” for bullet points, **bold** for emphasis, and a blank line between paragraphs.' })],
    email: [
      { k: 'h1', type: 'heading', label: 'Sender & alerts', hint: 'Emails are sent from the mailbox set on the server (info@…). When a client presses Reply, the message goes to the “Reply-To” address.' },
      T('replyTo', 'Reply-To address', { half: 1, hint: 'Where client replies arrive, e.g. admin@elixirsalonandspa.co.ke' }), T('notifyTo', 'Send team alerts to', { half: 1, hint: 'New bookings, messages, applications and reviews. Separate several addresses with commas.' }),
      T('fromName', 'Sender name', { half: 1 }), T('address', 'Address shown in email footer', { half: 1 }),
      { k: 'h2', type: 'heading', label: 'Booking emails', hint: 'Use {{name}}, {{reference}}, {{date}}, {{time}} and {{services}}. The booking details, buttons and calendar invite are added automatically.' },
      T('bookingConfirmedSubject', 'Confirmed – subject'), T('bookingConfirmedBody', 'Confirmed – message', { type: 'textarea', rows: 5 }),
      T('bookingPendingSubject', 'Awaiting approval – subject'), T('bookingPendingBody', 'Awaiting approval – message', { type: 'textarea', rows: 4 }),
      T('bookingUpdatedSubject', 'Rescheduled – subject'), T('bookingUpdatedBody', 'Rescheduled – message', { type: 'textarea', rows: 3 }),
      T('bookingCancelledSubject', 'Cancelled – subject'), T('bookingCancelledBody', 'Cancelled – message', { type: 'textarea', rows: 3 }),
      T('bookingDeclinedSubject', 'Declined – subject'), T('bookingDeclinedBody', 'Declined – message', { type: 'textarea', rows: 3 }),
      T('bookingReminderSubject', 'Reminder – subject'), T('bookingReminderBody', 'Reminder – message', { type: 'textarea', rows: 3 }),
      { k: 'h3', type: 'heading', label: 'Contact form & job applications' },
      T('contactSubject', 'Contact form – reply subject'), T('contactBody', 'Contact form – reply message', { type: 'textarea', rows: 7, hint: 'Use {{name}} to insert the person’s first name.' }),
      T('applicationSubject', 'Job application – reply subject'), T('applicationBody', 'Job application – reply message', { type: 'textarea', rows: 7 })],
    notFound: [T('heading', 'Heading'), T('message', 'Message', { type: 'textarea', rows: 3 }), T('image', 'Photo inside the mirror', { type: 'image', hint: 'It forms the “0” of 404. A portrait photo works best.' }),
      T('homeLabel', 'Home button', { half: 1 }), T('bookLabel', 'Booking button', { half: 1 }), T('linksHeading', 'Quick links heading', { half: 1 }), T('helpText', 'Help line', { half: 1, hint: 'Your phone number and WhatsApp link are added after it.' })],
    scheduling: [
      T('enabled', 'Accept online bookings', { type: 'bool', hint: 'Turn off to send visitors to your external booking link instead (Brand & SEO).' }),
      T('autoConfirm', 'Confirm bookings automatically', { type: 'bool', hint: 'On: clients are confirmed instantly. Off: every booking waits for you to approve it.' }),
      T('requireEmail', 'Ask clients for an email address', { type: 'bool', hint: 'Needed to send confirmations and reminders.' }),
      { k: 'h1', type: 'heading', label: 'Opening hours for appointments', hint: 'These also appear in the Contact section and footer of your website.' },
      { k: 'hours', type: 'rows', fixed: true, cols: [{ k: 'name', type: 'static' }, { k: 'open', type: 'bool', label: 'Open' }, { k: 'from', type: 'time', label: 'Opens' }, { k: 'to', type: 'time', label: 'Closes' }] },
      { k: 'h2', type: 'heading', label: 'Rules' },
      T('slotMinutes', 'Time between start times (minutes)', { type: 'select', half: 1, options: [10, 15, 20, 30, 45, 60].map((n) => ({ v: n, l: `Every ${n} minutes` })), hint: 'How often a new appointment can begin.' }),
      T('leadHours', 'Minimum notice (hours)', { type: 'number', half: 1, min: 0, max: 168, hint: 'Clients cannot book closer to the appointment than this.' }),
      T('advanceDays', 'How far ahead clients can book (days)', { type: 'number', half: 1, min: 1, max: 365 }),
      T('bufferMinutes', 'Clean-up time between clients (minutes)', { type: 'number', half: 1, min: 0, max: 120 }),
      T('maxServices', 'Most services per booking', { type: 'number', half: 1, min: 1, max: 12 }),
      T('maxActive', 'Most upcoming bookings per client', { type: 'number', half: 1, min: 0, max: 20, hint: 'Stops one person reserving many slots. 0 = no limit.' }),
      T('cancelHours', 'Clients can change or cancel until (hours before)', { type: 'number', half: 1, min: 0, max: 168 }),
      T('reminderHours', 'Send a reminder email (hours before)', { type: 'number', half: 1, min: 0, max: 168, hint: '0 turns reminders off.' }),
      T('timezone', 'Salon time zone', { hint: 'Leave as Africa/Nairobi unless you move.' })],
    bookingUi: [
      { k: 'h1', type: 'heading', label: 'Booking window wording' },
      T('title', 'Title', { half: 1 }), T('stepServices', 'Step 1 heading', { half: 1 }), T('stepTime', 'Step 2 heading', { half: 1 }), T('stepDetails', 'Step 3 heading', { half: 1 }),
      T('introServices', 'Step 1 intro', { type: 'textarea', rows: 2 }), T('introTime', 'Step 2 intro', { type: 'textarea', rows: 2 }), T('introDetails', 'Step 3 intro', { type: 'textarea', rows: 2 }),
      T('confirmLabel', 'Confirm button (instant confirmation)', { half: 1 }), T('requestLabel', 'Request button (needs your approval)', { half: 1 }),
      T('successTitle', 'Success title', { half: 1 }), T('successPendingTitle', 'Success title – awaiting approval', { half: 1 }),
      T('successText', 'Success message', { type: 'textarea', rows: 2 }), T('successPendingText', 'Success message – awaiting approval', { type: 'textarea', rows: 2 }),
      T('policy', 'Booking policy shown before confirming', { type: 'textarea', rows: 3, hint: 'Cancellation terms, deposits, lateness – this also goes in the confirmation email.' }),
      T('consent', 'Consent checkbox text'),
      { k: 'h2', type: 'heading', label: 'Home page booking bar' },
      T('quickLabel', 'Bar title', { half: 1 }), T('quickPlaceholder', 'Placeholder', { half: 1 }), T('quickButton', 'Button text', { half: 1 }),
      { k: 'h3', type: 'heading', label: '“How it works” strip' }, T('stepsHeading', 'Heading'),
      { k: 'steps', type: 'rows', addLabel: 'Add step', cols: [{ k: 'icon', label: 'Icon name', placeholder: 'calendar-check' }, { k: 'title', label: 'Title' }, { k: 'text', label: 'Text', wide: true }] }],
  };

  // =========================================================
  // Small building blocks
  // =========================================================
  const t12 = (hhmm) => { const [h, m] = String(hhmm).split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };
  const page = (...kids) => h('div', { class: 'page' }, ...kids);
  const lede = (t) => h('p', { class: 'lede' }, t);
  const card = (title, sub, ...kids) => h('section', { class: 'card' }, title ? h('h2', {}, title) : null, sub ? h('p', { class: 'sub' }, sub) : null, ...kids);
  const empty = (t) => h('div', { class: 'empty' }, t);

  // A card that edits one settings group
  function settingsCard(group, title, sub, { extra } = {}) {
    const wrap = h('section', { class: 'card' }, h('h2', {}, title), sub ? h('p', { class: 'sub' }, sub) : null);
    (async () => {
      const all = await api.get('/settings');
      const form = buildForm(SCHEMA[group], group === 'sections' ? { _: all.sections } : all[group]);
      const btn = h('button', { class: 'btn primary' }, icon('check'), 'Save changes');
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        try {
          let data = form.get();
          if (group === 'sections') data = data._;
          await api.put('/settings/' + group, data);
          toast('Saved – your website is updated.');
          if (group === 'sections' || group === 'brand') refreshShellIdentity();
        } catch (e) { fail(e); } finally { btn.disabled = false; }
      });
      wrap.append(form.el, h('div', { class: 'savebar' }, extra || null, h('span', { class: 'hint' }, 'Changes go live as soon as you save.'), btn));
    })().catch(fail);
    return wrap;
  }

  // Inline-editable ordered rows (service prices, job openings)
  function inlineList({ endpoint, query = '', cols, make, emptyText, addLabel }) {
    const box = h('div', { class: 'rows' }), root_ = h('div', {}, box);
    const save = (id, patch) => api.put(`/${endpoint}/${id}`, patch).catch(fail);
    const reorder = () => api.post(`/${endpoint}/reorder`, { ids: [...box.children].filter((c) => c.dataset.id).map((c) => c.dataset.id) }).catch(fail);
    const rowEl = (it) => {
      const row = h('div', { class: 'row' });
      row.dataset.id = it.id;
      const ctl = (c) => {
        if (c.type === 'bool') return h('label', { class: 'switch', title: c.label }, h('input', { type: 'checkbox', checked: !!it[c.k], onchange: (e) => { row.style.opacity = e.target.checked ? 1 : .55; save(it.id, { [c.k]: e.target.checked }); } }), h('i'), h('span', {}, c.label));
        return h('div', { class: 'c' + (c.wide ? ' wide' : '') }, h('small', {}, c.label), h('input', { class: 'in', type: c.type === 'number' ? 'number' : 'text', min: c.min, step: c.step, inputmode: c.type === 'number' ? 'numeric' : undefined, value: it[c.k] ?? '', placeholder: c.placeholder || '', maxlength: 300, onchange: (e) => save(it.id, { [c.k]: e.target.value }) }));
      };
      row.style.opacity = it.visible === 0 ? .55 : 1;
      row.append(h('div', { class: 'mv' }, h('span', { class: 'grip', draggable: 'true', title: 'Drag to reorder' }, icon('grip')), h('button', { class: 'mini', 'aria-label': 'Move up', onclick: () => move(row, -1) && reorder() }, icon('up')), h('button', { class: 'mini', 'aria-label': 'Move down', onclick: () => move(row, 1) && reorder() }, icon('down'))),
        h('div', { class: 'cols' }, ...cols.filter((c) => c.type !== 'bool').map(ctl)),
        h('div', { class: 'tail' }, ...cols.filter((c) => c.type === 'bool').map(ctl), h('button', { class: 'mini x', 'aria-label': 'Delete', onclick: async () => { if (await confirmBox(`Delete “${row.querySelector('input.in').value || 'this item'}”?`)) { try { await api.del(`/${endpoint}/${it.id}`); row.remove(); if (!box.children.length) box.append(empty(emptyText)); } catch (e) { fail(e); } } } }, icon('trash'))));
      return row;
    };
    sortable(box, '.row', reorder);
    async function load() {
      const items = await api.get(`/${endpoint}${query}`);
      box.replaceChildren(...(items.length ? items.map(rowEl) : [empty(emptyText)]));
    }
    root_.append(h('div', { style: 'margin-top:14px' }, h('button', { class: 'btn primary sm', onclick: async () => {
      try { const it = await api.post(`/${endpoint}`, make()); box.querySelector('.empty')?.remove(); const r = rowEl(it); box.append(r); r.querySelector('input.in')?.select(); r.scrollIntoView({ block: 'nearest' }); } catch (e) { fail(e); }
    } }, icon('plus'), addLabel)));
    load().catch(fail);
    return root_;
  }

  // =========================================================
  // Pages
  // =========================================================
  const PROMO_ICONS = ['gift','cake-candles','gem','crown','star','heart','wand-magic-sparkles','spa','percent','tag','calendar-check','scissors'];
  const PAGES = {};

  // ----- Dashboard -----
  PAGES.dashboard = { title: 'Dashboard', render: async (el) => {
    const d = await api.get('/dashboard');
    const c = d.counts;
    const tile = (n, label, href, badge, word = 'new') => h('a', { class: 'tile', href }, h('b', {}, String(n)), h('span', {}, label), badge ? h('em', {}, badge + ' ' + word) : null);
    // 14-day activity sparkline
    const days = [...Array(14)].map((_, i) => { const t = new Date(); t.setDate(t.getDate() - (13 - i)); return t.toISOString().slice(0, 10); });
    const map = Object.fromEntries(d.series.map((s) => [String(s.d).slice(0, 10), +s.n]));
    const vals = days.map((k) => map[k] || 0), max = Math.max(3, ...vals);
    const pts = vals.map((v, i) => `${(i / 13) * 580 + 10},${100 - (v / max) * 80}`).join(' ');
    const spark = h('div', { html: `<svg class="spark" viewBox="0 0 600 110" preserveAspectRatio="none" role="img" aria-label="Enquiries over the last 14 days"><defs><linearGradient id="g" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#D4AC52" stop-opacity=".5"/><stop offset="1" stop-color="#D4AC52" stop-opacity="0"/></linearGradient></defs><polygon points="10,100 ${pts} 590,100" fill="url(#g)"/><polyline points="${pts}" fill="none" stroke="#B07614" stroke-width="2.5" stroke-linejoin="round"/></svg>` });
    el.append(page(
      !d.mailConfigured ? h('div', { class: 'callout' }, icon('mail'), h('div', {}, h('b', {}, 'Email is not switched on yet. '), 'Messages and applications are still saved here, but clients will not receive confirmation emails until you add EMAIL_USER and EMAIL_PASS to the server’s .env file.')) : null,
      lede(`Welcome back, ${me.name.split(' ')[0]}. Here is what is happening on your website.`),
      h('div', { class: 'tiles' }, tile(d.bookings.today, 'Appointments today', '#/bookings'), tile(d.bookings.pending, 'Awaiting approval', '#/bookings?scope=pending'), tile(d.bookings.next7, 'Next 7 days', '#/bookings'), tile(c.messages, 'Messages', '#/messages', c.messagesNew), tile(c.applications, 'Job applications', '#/applications', c.applicationsNew), tile(c.reviews, 'Published reviews', '#/testimonials', c.reviewsPending, 'waiting')),
      h('div', { class: 'two' },
        h('div', {}, card("Today's schedule", d.onlineBooking ? null : 'Online booking is switched off.', d.bookings.today_list.length ? h('ul', { class: 'list' }, ...d.bookings.today_list.map((b) => h('li', {}, h('time', { style: 'min-width:92px;color:var(--ink);font-weight:700' }, t12(b.start) + ' – ' + t12(b.end)), h('div', { class: 'grow' }, h('a', { href: '#/bookings' }, b.name), h('small', {}, b.items.map((i) => i.name).join(', '))), h('span', { class: 'pill ' + b.status }, b.status)))) : empty('No appointments today.')),
          card('Activity – last 14 days', 'New messages, applications and reviews.', spark),
          card('Latest messages', null, d.recentMessages.length ? h('ul', { class: 'list' }, ...d.recentMessages.map((m) => h('li', {}, h('div', { class: 'grow' }, h('a', { href: '#/messages' }, m.name), h('small', {}, m.message)), h('span', { class: 'pill ' + m.status }, m.status), h('time', {}, fmtDate(m.created_at))))) : empty('No messages yet.'))),
        h('div', {}, card('Quick actions', null, h('div', { class: 'actions', style: 'margin:0' }, h('a', { class: 'btn primary', href: '#/bookings?new=1' }, icon('plus'), 'New booking'), h('a', { class: 'btn', href: '#/services' }, icon('scissors'), 'Update prices'), h('a', { class: 'btn', href: '#/gallery' }, icon('image'), 'Add photos'), h('a', { class: 'btn', href: '#/promotions' }, icon('tag'), 'New promotion'), h('a', { class: 'btn', href: '/', target: '_blank' }, icon('ext'), 'View website'))),
          card('Latest applications', null, d.recentApplications.length ? h('ul', { class: 'list' }, ...d.recentApplications.map((m) => h('li', {}, h('div', { class: 'grow' }, h('a', { href: '#/applications' }, m.name), h('small', {}, m.position || 'General application')), h('time', {}, fmtDate(m.created_at))))) : empty('No applications yet.')),
          card('Recent changes', null, d.activity.length ? h('ul', { class: 'list' }, ...d.activity.map((a) => h('li', {}, h('div', { class: 'grow' }, a.user_name, h('small', {}, a.action)), h('time', {}, fmtDate(a.created_at))))) : empty('Nothing yet.')))),
    ));
  } };

  // ----- Simple content pages -----
  const simple = (title, group, sub, lead) => ({ title, render: (el) => el.append(page(lead ? lede(lead) : null, settingsCard(group, title, sub))) });
  PAGES.home = simple('Home', 'hero', 'The first thing visitors see.', 'The big welcome at the top of your website.');
  PAGES.about = simple('About', 'about', 'Tell your story – the founder, the team, the experience.');
  PAGES.booking = simple('Booking banner', 'booking', 'The call-to-action band that sends visitors to your booking page.');
  PAGES.contact = simple('Contact', 'contact', 'Details shown in the Contact section and footer.', 'Phone numbers, address, opening hours and social links appear in the Contact section, the footer and the floating WhatsApp button.');
  PAGES.privacy = simple('Privacy policy', 'privacy', 'Shown when visitors tap “Privacy Policy” in the footer.');
  PAGES.brand = { title: 'Brand & SEO', render: (el) => {
    const reset = h('button', { class: 'btn', onclick: async (e) => { if (!await confirmBox('Restore the original brand colours?', { okLabel: 'Restore', danger: false })) return; try { await api.put('/settings/theme', { green: '#1A5B38', gold: '#D4AC52', ground: '#2A2519' }); toast('Colours restored.'); route(); } catch (x) { fail(x); } } }, 'Restore original colours');
    el.append(page(lede('Your name, logo, booking link, how you appear on Google, and the colours of the website.'), settingsCard('brand', 'Business & links'), settingsCard('seo', 'Google & social sharing'), settingsCard('theme', 'Colours', 'Pick the three brand colours. Changes apply across the whole website.', { extra: reset })));
  } };
  PAGES.navigation = { title: 'Navigation & 404', render: (el) => el.append(page(lede('Rename sections, hide them from the menu, or take a section off the website entirely. The order is fixed so the page always flows well. Below it, the page visitors see when a link does not exist.'), settingsCard('sections', 'Sections & menu'),
    settingsCard('notFound', '404 page', 'Shown whenever someone opens an address that does not exist.', { extra: h('a', { class: 'btn', href: '/page-not-found-preview', target: '_blank', rel: 'noopener' }, icon('ext'), 'Preview 404 page') }))) };
  PAGES.email = { title: 'Email', render: (el) => {
    const to = h('input', { class: 'in', type: 'text', placeholder: 'you@example.com', style: 'max-width:260px' });
    const test = card('Send a test email', mailConfigured ? 'Check that your email connection works.' : 'Email is not configured on the server yet – add EMAIL_USER and EMAIL_PASS to the .env file, then restart.', h('div', { style: 'display:flex;gap:10px;flex-wrap:wrap' }, to, h('button', { class: 'btn', onclick: async (e) => { e.target.disabled = true; try { await api.post('/email/test', { to: to.value }); toast('Test email sent.'); } catch (x) { fail(x); } finally { e.target.disabled = false; } } }, icon('mail'), 'Send test')));
    el.append(page(lede('The automatic emails clients receive, and the alerts you receive.'), settingsCard('email', 'Automatic emails'), test));
  } };

  // ----- Services -----
  PAGES.services = { title: 'Services', render: (el) => {
    const left = h('div', { class: 'listcol' }), right = h('div', { class: 'detailcol inbox' });
    let cats = [], sel = null;
    const catForm = (c, onSave) => {
      const form = buildForm([T('name', 'Category name', { half: 0 }), T('blurb', 'Short description (optional)', { type: 'textarea', rows: 2 }), T('image_a', 'Photo 1', { type: 'image', half: 1 }), T('image_b', 'Photo 2', { type: 'image', half: 1 }), T('book_url', 'Special booking link (optional)', { type: 'url', hint: 'Leave empty to use your main booking link.' }), T('visible', 'Show on website', { type: 'bool' })], { ...c, visible: c.visible !== 0 });
      const dlg = modal({ title: c.id ? 'Edit category' : 'New category', body: form.el, foot: [h('button', { class: 'btn', onclick: () => dlg.close() }, 'Cancel'), h('button', { class: 'btn primary', onclick: async () => { const d = form.get(); if (!d.name.trim()) return toast('Please enter a name.', 'err'); try { await onSave(d); dlg.close(); } catch (e) { fail(e); } } }, 'Save')] });
    };
    async function loadCats(keep) {
      cats = await api.get('/categories'); if (!cats.find((c) => c.id === sel)) sel = cats[0]?.id ?? null; if (keep) sel = keep;
      drawLeft(); drawRight();
    }
    function drawLeft() {
      const list = h('div', { class: 'catlist' }, ...cats.map((c) => { const b = h('div', { class: 'cat' + (c.id === sel ? ' on' : '') + (c.visible ? '' : ' off'), role: 'button', tabindex: 0, onclick: () => { const sp = b.closest('.split'); sel = c.id; drawLeft(); drawRight(); sp?.classList.add('detail-open'); }, onkeydown: (e) => e.key === 'Enter' && b.click() },
        h('span', { class: 'grip', draggable: 'true' }, icon('grip')), h('div', { class: 'nm' }, c.name, h('small', {}, c.visible ? '' : 'Hidden')),
        h('button', { class: 'mini', 'aria-label': 'Up', onclick: (e) => { e.stopPropagation(); if (move(b, -1)) saveOrder(list); } }, icon('up')), h('button', { class: 'mini', 'aria-label': 'Down', onclick: (e) => { e.stopPropagation(); if (move(b, 1)) saveOrder(list); } }, icon('down')));
        b.dataset.id = c.id; return b; }));
      sortable(list, '.cat', () => saveOrder(list));
      const saveOrder = (l) => api.post('/categories/reorder', { ids: [...l.children].map((x) => x.dataset.id) }).then(() => api.get('/categories').then((r) => (cats = r))).catch(fail);
      left.replaceChildren(card('Categories', null, list, h('div', { style: 'margin-top:14px' }, h('button', { class: 'btn primary sm', onclick: () => catForm({}, async (d) => { const r = await api.post('/categories', d); toast('Category added.'); await loadCats(r.id); }) }, icon('plus'), 'Add category'))));
    }
    function drawRight() {
      const c = cats.find((x) => x.id === sel);
      if (!c) return right.replaceChildren(card('No categories yet', 'Add your first category (for example “Hair” or “Massage”) to start listing services.'));
      right.replaceChildren(card(c.name, c.blurb || 'Edit prices directly – every change saves automatically.',
        h('div', { class: 'actions' }, h('button', { class: 'btn sm back', onclick: (e) => e.currentTarget.closest('.split').classList.remove('detail-open') }, icon('left'), 'All categories'),
          h('button', { class: 'btn sm', onclick: () => catForm(c, async (d) => { await api.put('/categories/' + c.id, d); toast('Category saved.'); await loadCats(); }) }, 'Edit category & photos'),
          h('button', { class: 'btn sm danger', onclick: async () => { if (await confirmBox(`Delete “${c.name}” and all of its services?`)) { try { await api.del('/categories/' + c.id); toast('Category deleted.'); sel = null; await loadCats(); } catch (e) { fail(e); } } } }, icon('trash'), 'Delete')),
        h('div', { class: 'grid2', style: 'margin-bottom:14px' }, h('div', { class: 'imgfield' }, thumb(c.image_a), thumb(c.image_b))),
        inlineList({ endpoint: 'items', query: '?category_id=' + c.id, addLabel: 'Add service', emptyText: 'No services yet – add the first one below. Categories without prices show your “consultation” message instead.', make: () => ({ category_id: c.id, name: 'New service', price: '', note: '', duration_min: 60, bookable: true, visible: true }),
          cols: [{ k: 'name', label: 'Service' }, { k: 'price', label: 'Price (KES)', placeholder: '3,000 or 3,000 - 7,000' }, { k: 'duration_min', type: 'number', label: 'Minutes', min: 5, step: 5 }, { k: 'note', label: 'Note (optional)' }, { k: 'bookable', type: 'bool', label: 'Bookable' }, { k: 'visible', type: 'bool', label: 'Show' }] })));
    }
    el.append(page(lede('Your price list. Pick a category on the left, then edit names and prices right in the list. “Minutes” is how long the service takes – it decides how much calendar time a booking uses. Only services marked Bookable can be booked online.'),
      h('div', { class: 'split' }, left, right), settingsCard('servicesSection', 'Section wording', 'The headings and labels around the price list.')));
    loadCats().catch(fail);
  } };

  // ----- Gallery -----
  PAGES.gallery = { title: 'Gallery', render: (el) => {
    let items = [], filter = 'all'; const grid = h('div', { class: 'mgrid' }), tabs = h('div', { class: 'tabs' });
    const draw = () => {
      tabs.replaceChildren(...[['all', 'All'], ['photo', 'Photos'], ['video', 'Videos']].map(([k, l]) => h('button', { class: filter === k ? 'on' : '', onclick: () => { filter = k; draw(); } }, `${l} (${k === 'all' ? items.length : items.filter((i) => i.type === k).length})`)));
      const list = items.filter((i) => filter === 'all' || i.type === filter);
      grid.replaceChildren(...(list.length ? list.map((it) => {
        const t = h('div', { class: 'mtile' + (it.visible ? '' : ' off'), title: it.caption || '' }, thumb(it.src, ''), it.type === 'video' ? h('span', { class: 'kind' }, 'video') : null,
          h('div', { class: 'tools' }, filter === 'all' ? [h('button', { class: 'mini', 'aria-label': 'Move earlier', onclick: () => shift(it, -1) }, icon('left')), h('button', { class: 'mini', 'aria-label': 'Move later', onclick: () => shift(it, 1) }, icon('right'))] : null, h('span', { style: 'flex:1' }),
            h('button', { class: 'mini', title: it.visible ? 'Hide' : 'Show', onclick: async () => { try { await api.put('/gallery/' + it.id, { visible: !it.visible }); it.visible = it.visible ? 0 : 1; draw(); } catch (e) { fail(e); } } }, icon(it.visible ? 'check' : 'x')),
            h('button', { class: 'mini', title: 'Caption', onclick: () => cap(it) }, icon('star')), h('button', { class: 'mini x', title: 'Delete', onclick: async () => { if (await confirmBox('Remove this from the gallery? (The file stays in your media library.)', { okLabel: 'Remove' })) { try { await api.del('/gallery/' + it.id); items = items.filter((x) => x.id !== it.id); draw(); } catch (e) { fail(e); } } } }, icon('trash'))));
        return t;
      }) : [empty('Nothing here yet.')]));
    };
    async function shift(it, dir) { const i = items.indexOf(it), j = i + dir; if (j < 0 || j >= items.length) return; [items[i], items[j]] = [items[j], items[i]]; draw(); try { await api.post('/gallery/reorder', { ids: items.map((x) => x.id) }); } catch (e) { fail(e); } }
    function cap(it) { const inp = h('input', { class: 'in', type: 'text', value: it.caption || '', maxlength: 300, placeholder: 'Describe this photo (helps accessibility & Google)' }); const dlg = modal({ title: 'Caption', body: h('div', { class: 'f' }, inp), foot: [h('button', { class: 'btn', onclick: () => dlg.close() }, 'Cancel'), h('button', { class: 'btn primary', onclick: async () => { try { await api.put('/gallery/' + it.id, { caption: inp.value }); it.caption = inp.value; dlg.close(); draw(); } catch (e) { fail(e); } } }, 'Save')] }); inp.focus(); }
    async function load() { items = await api.get('/gallery'); draw(); }
    el.append(page(lede('Photos and videos shown in the website gallery. Upload new files, or add ones already in your media library.'), card('Gallery items', 'Use the arrows on a tile to reorder it, the tick to hide it, or the bin to remove it.',
        h('div', { class: 'actions' }, h('button', { class: 'btn primary', onclick: async () => { const r = await pickMedia({ multiple: true, kind: 'any' }); if (r) { try { await api.post('/gallery/bulk', { srcs: r }); toast(`${r.length} added to the gallery.`); await load(); } catch (e) { fail(e); } } } }, icon('plus'), 'Add photos & videos')), tabs, grid), settingsCard('gallerySection', 'Section wording')));
    load().catch(fail);
  } };

  // ----- Promotions -----
  PAGES.promotions = { title: 'Promotions', render: (el) => {
    const list = h('div', { class: 'rows' });
    const state = (p) => { const t = new Date().toISOString().slice(0, 10); return !p.visible ? ['Hidden', 'hidden'] : p.starts_on && p.starts_on > t ? ['Scheduled', 'pending'] : p.ends_on && p.ends_on < t ? ['Expired', 'hidden'] : ['Live', 'approved']; };
    function edit(p) {
      const form = buildForm([T('icon', 'Icon', { type: 'select', half: 1, options: PROMO_ICONS.map((v) => ({ v, l: v.replace(/-/g, ' ').replace(/^./, (x) => x.toUpperCase()) })) }), T('title', 'Title', { half: 1 }), T('body', 'Description', { type: 'textarea', rows: 3 }), T('cta_label', 'Button text (optional)', { half: 1 }), T('cta_url', 'Button link (optional)', { half: 1, type: 'url', hint: 'Empty = your booking link.' }), T('starts_on', 'Starts on (optional)', { half: 1, type: 'date' }), T('ends_on', 'Ends on (optional)', { half: 1, type: 'date', hint: 'It disappears from the website after this date.' }), T('visible', 'Show on website', { type: 'bool' })], { ...p, visible: p.id ? p.visible !== 0 : true });
      const dlg = modal({ title: p.id ? 'Edit promotion' : 'New promotion', body: form.el, foot: [h('button', { class: 'btn', onclick: () => dlg.close() }, 'Cancel'), h('button', { class: 'btn primary', onclick: async () => { const d = form.get(); if (!d.title.trim()) return toast('Please enter a title.', 'err'); try { p.id ? await api.put('/promotions/' + p.id, d) : await api.post('/promotions', d); dlg.close(); toast('Saved.'); load(); } catch (e) { fail(e); } } }, 'Save')] });
    }
    async function load() {
      const items = await api.get('/promotions');
      list.replaceChildren(...(items.length ? items.map((p) => { const [lab, cls] = state(p); const row = h('div', { class: 'row' }, h('div', { class: 'mv' }, h('span', { class: 'grip', draggable: 'true' }, icon('grip')), h('button', { class: 'mini', 'aria-label': 'Up', onclick: () => move(row, -1) && save() }, icon('up')), h('button', { class: 'mini', 'aria-label': 'Down', onclick: () => move(row, 1) && save() }, icon('down'))),
        h('div', { style: 'flex:1;min-width:0' }, h('b', {}, p.title), p.icon ? h('span', { class: 'hint', style: 'margin-left:8px' }, '· ' + p.icon.replace(/-/g, ' ')) : null, h('div', { class: 'hint', style: 'margin:2px 0 6px' }, p.body.length > 140 ? p.body.slice(0, 140) + '…' : p.body), h('span', { class: 'pill ' + cls }, lab), p.starts_on || p.ends_on ? h('span', { class: 'hint', style: 'margin-left:8px' }, `${p.starts_on || '…'} → ${p.ends_on || '…'}`) : null),
        h('div', { class: 'tail' }, h('button', { class: 'btn sm', onclick: () => edit(p) }, 'Edit'), h('button', { class: 'mini x', 'aria-label': 'Delete', onclick: async () => { if (await confirmBox(`Delete “${p.title}”?`)) { try { await api.del('/promotions/' + p.id); load(); } catch (e) { fail(e); } } } }, icon('trash')))); row.dataset.id = p.id; return row; }) : [empty('No promotions yet. Add one to show the offers section on your website.')]));
    }
    const save = () => api.post('/promotions/reorder', { ids: [...list.children].map((c) => c.dataset.id) }).catch(fail);
    sortable(list, '.row', save);
    el.append(page(lede('Special offers shown as cards on your website. If there are no live promotions, the whole section is hidden automatically.'), card('Your promotions', null, h('div', { class: 'actions' }, h('button', { class: 'btn primary', onclick: () => edit({}) }, icon('plus'), 'New promotion')), list), settingsCard('promoSection', 'Section wording')));
    load().catch(fail);
  } };

  // ----- Work with us -----
  PAGES.work = { title: 'Work with us', render: (el) => el.append(page(lede('The careers section. Current openings also appear in the application form’s position list.'), settingsCard('work', 'Section content'),
    card('Current openings', 'Edit directly – changes save automatically.', inlineList({ endpoint: 'jobs', addLabel: 'Add opening', emptyText: 'No openings. Visitors can still send a general application.', make: () => ({ title: 'New role', description: '', visible: true }), cols: [{ k: 'title', label: 'Role' }, { k: 'description', label: 'Short note (optional)' }, { k: 'visible', type: 'bool', label: 'Show' }] })))) };

  // ----- Testimonials -----
  PAGES.testimonials = { title: 'Testimonials', render: (el) => {
    let filter = 'all', items = []; const list = h('div', { class: 'rows' }), tabs = h('div', { class: 'tabs' });
        function edit(r) {
      const form = buildForm([T('client_name', 'Name', { half: 1 }), T('client_type', 'Type', { half: 1, hint: 'e.g. Customer' }), T('stars', 'Stars', { type: 'select', half: 1, options: [5, 4, 3, 2, 1].map((n) => ({ v: n, l: `${n} stars` })) }), T('status', 'Status', { type: 'select', half: 1, options: [{ v: 'approved', l: 'Published' }, { v: 'pending', l: 'Waiting for approval' }, { v: 'hidden', l: 'Hidden' }] }), T('comment', 'Review', { type: 'textarea', rows: 4 }), T('feedback', 'Your reply (shown under the review)', { type: 'textarea', rows: 2 })], { client_type: 'Customer', stars: 5, status: 'approved', ...r });
      const dlg = modal({ title: r.id ? 'Edit review' : 'Add a testimonial', body: form.el, foot: [h('button', { class: 'btn', onclick: () => dlg.close() }, 'Cancel'), h('button', { class: 'btn primary', onclick: async () => { const d = form.get(); d.stars = +d.stars; if (!d.client_name.trim() || !d.comment.trim()) return toast('Name and review are required.', 'err'); try { r.id ? await api.put('/ratings/' + r.id, d) : await api.post('/ratings', d); dlg.close(); toast('Saved.'); load(); } catch (e) { fail(e); } } }, 'Save')] });
    }
    const setStatus = async (r, status) => { try { await api.put('/ratings/' + r.id, { ...r, status }); toast(status === 'approved' ? 'Published.' : 'Updated.'); load(); } catch (e) { fail(e); } };
    function draw() {
      const n = (s) => items.filter((i) => i.status === s).length;
      tabs.replaceChildren(...[['all', `All (${items.length})`], ['pending', `Waiting (${n('pending')})`], ['approved', `Published (${n('approved')})`], ['hidden', `Hidden (${n('hidden')})`]].map(([k, l]) => h('button', { class: filter === k ? 'on' : '', onclick: () => { filter = k; draw(); } }, l)));
      const vis = items.filter((i) => filter === 'all' || i.status === filter);
      list.replaceChildren(...(vis.length ? vis.map((r) => h('div', { class: 'row' }, h('div', { style: 'flex:1;min-width:0' }, h('div', { style: 'display:flex;gap:10px;flex-wrap:wrap;align-items:center' }, h('b', {}, r.client_name), A.stars(r.stars), h('span', { class: 'pill ' + r.status }, r.status === 'approved' ? 'Published' : r.status === 'pending' ? 'Waiting' : 'Hidden'), h('span', { class: 'hint' }, fmtDate(r.created_at))),
        h('p', { style: 'margin:6px 0' }, r.comment), r.feedback ? h('div', { class: 'hint' }, 'Your reply: ' + r.feedback) : null),
        h('div', { class: 'tail', style: 'flex-wrap:wrap;justify-content:flex-end' }, r.status !== 'approved' ? h('button', { class: 'btn sm primary', onclick: () => setStatus(r, 'approved') }, 'Publish') : h('button', { class: 'btn sm', onclick: () => setStatus(r, 'hidden') }, 'Hide'), h('button', { class: 'btn sm', onclick: () => edit(r) }, 'Edit / reply'), h('button', { class: 'mini x', 'aria-label': 'Delete', onclick: async () => { if (await confirmBox(`Delete the review from ${r.client_name}?`)) { try { await api.del('/ratings/' + r.id); load(); } catch (e) { fail(e); } } } }, icon('trash'))))) : [empty('No reviews here.')]));
    }
    async function load() { items = await api.get('/ratings'); draw(); }
    el.append(page(lede('Reviews left by visitors wait here until you publish them. You can also reply publicly and add testimonials yourself.'), card('Reviews', null, h('div', { class: 'actions' }, h('button', { class: 'btn primary', onclick: () => edit({}) }, icon('plus'), 'Add testimonial'), h('a', { class: 'btn', href: '/api/admin/export/reviews', download: '' }, icon('download'), 'Export CSV')), tabs, list), settingsCard('testimonialsSection', 'Section wording', 'Headings, and whether new reviews need your approval first.')));
    load().catch(fail);
  } };

  // ----- Inbox (messages & applications) -----
  function inbox(kind) {
    const isApp = kind === 'applications';
    return { title: isApp ? 'Job applications' : 'Messages', render: (el) => {
      let items = [], sel = null, status = '', q = '';
      const listCol = h('div', { class: 'listcol' }), detail = h('div', { class: 'detailcol inbox' });
      const split = h('div', { class: 'split' }, listCol, detail);
      const search = h('input', { class: 'in', type: 'search', placeholder: 'Search…', oninput: (e) => { q = e.target.value; clearTimeout(search.t); search.t = setTimeout(load, 250); } });
      const tabs = h('div', { class: 'tabs' }, ...[['', 'All'], ['new', 'New'], ['read', 'Read'], ['done', 'Done']].map(([k, l]) => h('button', { class: status === k ? 'on' : '', onclick: (e) => { status = k; [...tabs.children].forEach((b) => b.classList.toggle('on', b === e.target)); load(); } }, l)));
      function drawList() {
        listCol.replaceChildren(h('div', { style: 'margin-bottom:12px' }, search), tabs, h('a', { class: 'btn sm', style: 'margin-bottom:12px', href: `/api/admin/export/${kind}`, download: '' }, icon('download'), 'Export CSV'),
          ...(items.length ? items.map((m) => h('button', { class: 'mailitem' + (m.id === sel ? ' on' : '') + (m.status === 'new' ? ' unread' : ''), onclick: () => open(m.id) }, h('b', {}, m.name), h('small', {}, isApp ? (m.position || 'General application') : m.message), h('small', {}, fmtDate(m.created_at)))) : [empty(q || status ? 'No matches.' : isApp ? 'No applications yet.' : 'No messages yet.')]));
      }
      async function setStatus(m, s) { try { await api.patch(`/${kind}/${m.id}`, { status: s }); m.status = s; drawList(); drawDetail(); refreshCounts(); } catch (e) { fail(e); } }
      function drawDetail() {
        const m = items.find((x) => x.id === sel);
        if (!m) return detail.replaceChildren(card(null, null, empty(isApp ? 'Select an application to read it.' : 'Select a message to read it.')));
        const wa = String(m.phone).replace(/[^\d]/g, '').replace(/^0/, '254');
        const note = h('textarea', { class: 'in', rows: 3, placeholder: 'Private note (only visible here)…' }, m.admin_note || ''); note.value = m.admin_note || '';
        detail.replaceChildren(card(null, null, h('div', { class: 'detail' },
          h('button', { class: 'btn sm back', onclick: () => split.classList.remove('detail-open') }, icon('left'), 'Back'),
          h('div', { class: 'card-head' }, h('h2', {}, m.name), h('span', { class: 'pill ' + m.status }, m.status)),
          h('dl', {}, h('dt', {}, 'Email'), h('dd', {}, h('a', { href: 'mailto:' + m.email }, m.email)), h('dt', {}, 'Phone'), h('dd', {}, h('a', { href: 'tel:' + m.phone }, m.phone)), isApp ? [h('dt', {}, 'Role'), h('dd', {}, m.position || 'General application')] : null, h('dt', {}, 'Received'), h('dd', {}, fmtDate(m.created_at))),
          isApp ? null : h('div', { class: 'msgbody' }, m.message),
          h('div', { class: 'actions' },
            isApp ? h('a', { class: 'btn primary', href: `/api/admin/applications/${m.id}/cv` }, icon('download'), 'Download CV') : null,
            h('a', { class: 'btn' + (isApp ? '' : ' primary'), href: `mailto:${m.email}?subject=${encodeURIComponent(isApp ? 'Your application to Elixir Salon & Spa' : 'Re: your message to Elixir Salon & Spa')}` }, icon('mail'), 'Reply by email'),
            h('a', { class: 'btn', href: `https://wa.me/${wa}`, target: '_blank', rel: 'noopener' }, icon('phone'), 'WhatsApp'),
            m.status === 'done' ? h('button', { class: 'btn', onclick: () => setStatus(m, 'read') }, 'Reopen') : h('button', { class: 'btn', onclick: () => setStatus(m, 'done') }, icon('check'), 'Mark as done'),
            m.status !== 'new' ? h('button', { class: 'btn', onclick: () => setStatus(m, 'new') }, 'Mark unread') : null),
          h('div', { class: 'f' }, h('label', {}, 'Private note'), note, h('div', { style: 'margin-top:8px' }, h('button', { class: 'btn sm', onclick: async () => { try { await api.patch(`/${kind}/${m.id}`, { admin_note: note.value }); m.admin_note = note.value; toast('Note saved.'); } catch (e) { fail(e); } } }, 'Save note'))),
          h('div', { style: 'margin-top:18px' }, h('button', { class: 'btn sm danger', onclick: async () => { if (await confirmBox(`Permanently delete ${isApp ? 'this application (and the CV file)' : 'this message'}?`)) { try { await api.del(`/${kind}/${m.id}`); sel = null; split.classList.remove('detail-open'); await load(); refreshCounts(); } catch (e) { fail(e); } } } }, icon('trash'), 'Delete')))));
      }
      async function open(id) { sel = id; split.classList.add('detail-open'); const m = items.find((x) => x.id === id); if (m && m.status === 'new') await setStatus(m, 'read'); drawList(); drawDetail(); }
      async function load() { try { items = await api.get(`/${kind}?status=${status}&q=${encodeURIComponent(q)}`); if (!items.find((x) => x.id === sel)) sel = null; drawList(); drawDetail(); } catch (e) { fail(e); } }
      el.append(page(lede(isApp ? 'CVs and details from people who applied through the website.' : 'Messages sent through the contact form on your website.'), split));
      load();
    } };
  }
  PAGES.messages = inbox('messages');
  PAGES.applications = inbox('applications');

  // ----- Media library -----
  PAGES.media = { title: 'Media library', render: (el) => {
    let items = [], filter = 'all'; const grid = h('div', { class: 'mgrid' }), tabs = h('div', { class: 'tabs' });
    const draw = () => {
      tabs.replaceChildren(...[['all', 'All'], ['image', 'Photos'], ['video', 'Videos']].map(([k, l]) => h('button', { class: filter === k ? 'on' : '', onclick: () => { filter = k; draw(); } }, `${l} (${k === 'all' ? items.length : items.filter((i) => i.kind === k).length})`)));
      const vis = items.filter((i) => filter === 'all' || i.kind === filter);
      grid.replaceChildren(...(vis.length ? vis.map((m) => h('button', { class: 'mtile', title: m.original_name, onclick: () => info(m) }, thumb(m.url, ''), m.kind === 'video' ? h('span', { class: 'kind' }, 'video') : null)) : [empty('No files yet.')]));
    };
    function info(m) {
      const dlg = modal({ title: 'File details', body: h('div', {}, h('div', { style: 'text-align:center;margin-bottom:14px' }, m.kind === 'video' ? h('video', { src: m.url, controls: true, style: 'max-width:100%;max-height:50vh;border-radius:12px' }) : h('img', { src: m.url, alt: '', style: 'max-width:100%;max-height:50vh;border-radius:12px' })), h('div', { class: 'detail' }, h('dl', {}, h('dt', {}, 'Name'), h('dd', {}, m.original_name), h('dt', {}, 'Size'), h('dd', {}, fmtSize(m.size)), h('dt', {}, 'Link'), h('dd', {}, m.url)))),
        foot: [h('button', { class: 'btn', onclick: () => { navigator.clipboard?.writeText(location.origin + m.url); toast('Link copied.'); } }, icon('copy'), 'Copy link'),
          h('button', { class: 'btn danger', onclick: async () => { try { await api.del('/media/' + m.id); } catch (e) { if (e.status === 409) { if (!await confirmBox(e.message + ' Delete it anyway? It will disappear from those places.', { okLabel: 'Delete anyway' })) return; try { await api.del('/media/' + m.id + '?force=1'); } catch (x) { return fail(x); } } else return fail(e); } dlg.close(); toast('File deleted.'); load(); } }, icon('trash'), 'Delete')] });
    }
    async function load() { items = await api.get('/media'); draw(); }
    el.append(page(lede('Every photo and video on your website lives here. Upload once, then use it anywhere.'), card(null, null, dropzone(load), tabs, grid)));
    load().catch(fail);
  } };

  // ----- Team -----
  PAGES.users = { title: 'Team', owner: true, render: (el) => {
    const body = h('div', { class: 'tscroll' });
    function form(u) {
      const f = buildForm([T('name', 'Name', { half: 1 }), T('email', 'Email', { half: 1 }), T('role', 'Role', { type: 'select', half: 1, options: [{ v: 'editor', l: 'Editor – manages content' }, { v: 'owner', l: 'Owner – full access incl. team & email' }] }), T('password', u.id ? 'New password (leave empty to keep)' : 'Password', { half: 1, hint: 'At least 8 characters.' })], u);
      f.el.querySelectorAll('input')[3].type = 'password'; f.el.querySelectorAll('input')[3].autocomplete = 'new-password';
      const dlg = modal({ title: u.id ? 'Edit team member' : 'Add team member', body: f.el, foot: [h('button', { class: 'btn', onclick: () => dlg.close() }, 'Cancel'), h('button', { class: 'btn primary', onclick: async () => { const d = f.get(); try { if (u.id) { if (!d.password) delete d.password; await api.put('/users/' + u.id, d); } else await api.post('/users', d); dlg.close(); toast('Saved.'); load(); } catch (e) { fail(e); } } }, 'Save')] });
    }
    async function load() {
      const us = await api.get('/users');
      body.replaceChildren(h('table', { class: 't stack' }, h('thead', {}, h('tr', {}, ...['Name', 'Email', 'Role', 'Last sign-in', ''].map((x) => h('th', {}, x)))), h('tbody', {}, ...us.map((u) => h('tr', {}, h('td', {}, h('b', {}, u.name), u.active ? null : h('span', { class: 'pill hidden', style: 'margin-left:8px' }, 'disabled')), h('td', {}, u.email), h('td', {}, u.role === 'owner' ? 'Owner' : 'Editor'), h('td', {}, u.last_login ? fmtDate(u.last_login) : '—'),
        h('td', { style: 'text-align:right;white-space:nowrap' }, h('button', { class: 'btn sm', onclick: () => form(u) }, 'Edit'), ' ', u.id !== me.id ? [h('button', { class: 'btn sm', onclick: async () => { try { await api.put('/users/' + u.id, { active: !u.active }); load(); } catch (e) { fail(e); } } }, u.active ? 'Disable' : 'Enable'), ' ', h('button', { class: 'btn sm danger', onclick: async () => { if (await confirmBox(`Delete ${u.name}’s account?`)) { try { await api.del('/users/' + u.id); load(); } catch (e) { fail(e); } } } }, 'Delete')] : null))))));
    }
    el.append(page(lede('People who can sign in to this admin panel.'), card(null, null, h('div', { class: 'actions' }, h('button', { class: 'btn primary', onclick: () => form({ role: 'editor' }) }, icon('plus'), 'Add team member')), body)));
    load().catch(fail);
  } };

  // ----- Account -----
  PAGES.account = { title: 'My account', render: (el) => {
    const f = buildForm([T('current', 'Current password'), T('next', 'New password', { hint: 'At least 8 characters.' }), T('again', 'Repeat new password')], {});
    f.el.querySelectorAll('input').forEach((i) => (i.type = 'password'));
    el.append(page(card('Change password', `Signed in as ${me.email} (${me.role}).`, f.el, h('div', { class: 'savebar' }, h('button', { class: 'btn primary', onclick: async () => { const d = f.get(); if (d.next !== d.again) return toast('The new passwords do not match.', 'err'); try { await api.post('/account/password', { current: d.current, next: d.next }); toast('Password changed.'); route(); } catch (e) { fail(e); } } }, icon('lock'), 'Update password')))));
  } };

  // =========================================================
  // Shell, navigation, auth
  // =========================================================
  const NAV = [
    ['Overview', [['dashboard', 'Dashboard', 'dash']]],
    ['Bookings', [['bookings', 'Appointments', 'calendar'], ['schedule', 'Schedule & hours', 'clock'], ['specialists', 'Specialists', 'users'], ['closures', 'Closures & time off', 'ban']]],
    ['Website', [['home', 'Home', 'home'], ['about', 'About', 'user'], ['services', 'Services', 'scissors'], ['gallery', 'Gallery', 'image'], ['booking', 'Booking banner', 'tag'], ['contact', 'Contact', 'phone'], ['work', 'Work with us', 'brief'], ['promotions', 'Promotions', 'tag'], ['testimonials', 'Testimonials', 'star'], ['privacy', 'Privacy policy', 'shield']]],
    ['Inbox', [['messages', 'Messages', 'mail'], ['applications', 'Applications', 'folder']]],
    ['Manage', [['media', 'Media library', 'image'], ['brand', 'Brand & SEO', 'palette'], ['navigation', 'Navigation & 404', 'nav'], ['email', 'Email', 'mail'], ['users', 'Team', 'users'], ['account', 'My account', 'lock']]],
  ];
  let brandInfo = { name: 'Elixir', logo: '/resources/elixir_logo.png' };

  async function refreshCounts() {
    try { const d = await api.get('/dashboard'); counts = d.counts; mailConfigured = d.mailConfigured; const set = (id, n) => { const b = document.getElementById('b-' + id); if (b) { b.textContent = n; b.classList.toggle('hide', !n); } }; set('messages', counts.messagesNew); set('bookings', d.bookings ? d.bookings.pending : 0); set('applications', counts.applicationsNew); set('testimonials', counts.reviewsPending); } catch { /* ignore */ }
  }
  async function refreshShellIdentity() { try { const s = await api.get('/settings'); brandInfo = { name: s.brand.name, logo: s.brand.logo }; const i = document.querySelector('.brand img'), n = document.querySelector('.brand b'); if (i) i.src = brandInfo.logo; if (n) n.textContent = brandInfo.name; } catch { /* ignore */ } }

  function shell() {
    const nav = h('nav', { 'aria-label': 'Admin' }, ...NAV.map(([group, links]) => {
      const vis = links.filter(([k]) => !(PAGES[k]?.owner && me.role !== 'owner'));
      return h('div', { class: 'nav-group' }, h('small', {}, group), ...vis.map(([k, label, ic]) => h('a', { class: 'nav-item', href: '#/' + k, 'data-k': k }, icon(ic), label, ['messages', 'applications', 'testimonials', 'bookings'].includes(k) ? h('span', { class: 'badge hide', id: 'b-' + k }) : null)));
    }));
    root.replaceChildren(h('div', { class: 'shell' },
      h('aside', { class: 'side' }, h('div', { class: 'brand' }, h('img', { src: brandInfo.logo, alt: '' }), h('div', {}, h('b', {}, brandInfo.name), h('span', {}, 'Admin panel'))), nav,
        h('div', { class: 'side-foot' }, h('div', { class: 'who' }, h('span', { class: 'avatar' }, me.name[0].toUpperCase()), h('div', {}, me.name, h('small', {}, me.role === 'owner' ? 'Owner' : 'Editor'))),
          h('div', { style: 'display:flex;gap:8px' }, h('a', { class: 'btn sm', href: '/', target: '_blank', style: 'flex:1' }, icon('ext'), 'View site'), h('button', { class: 'btn sm', style: 'flex:1', onclick: async () => { await api.post('/logout'); location.hash = ''; location.reload(); } }, icon('out'), 'Sign out')))),
      h('div', { class: 'main' }, h('header', { class: 'topbar' }, h('button', { class: 'btn icon menu-btn', 'aria-label': 'Menu', onclick: () => document.body.classList.toggle('nav-open') }, icon('menu')), h('h1', { id: 'ptitle' }), h('span', { class: 'spacer' }), h('a', { class: 'btn sm', href: '/', target: '_blank' }, icon('ext'), 'View website')), h('div', { id: 'view' }))));
    document.body.addEventListener('click', (e) => { if (document.body.classList.contains('nav-open') && (e.target.closest('.nav-item') || e.target === document.body)) document.body.classList.remove('nav-open'); });
  }

  async function route() {
    const key = (location.hash.replace(/^#\//, '') || 'dashboard').split('?')[0];
    const p = PAGES[key] && !(PAGES[key].owner && me.role !== 'owner') ? PAGES[key] : PAGES.dashboard;
    document.querySelectorAll('.nav-item').forEach((a) => a.classList.toggle('on', a.dataset.k === (PAGES[key] ? key : 'dashboard')));
    $('#ptitle').textContent = p.title;
    document.title = `${p.title} · Elixir Admin`;
    const view = $('#view'); view.replaceChildren(h('div', { class: 'page' }, h('p', { class: 'lede' }, 'Loading…')));
    const holder = h('div');
    try { await p.render(holder); view.replaceChildren(...holder.childNodes); window.scrollTo(0, 0); } catch (e) { fail(e); view.replaceChildren(page(card('Something went wrong', e.message))); }
    refreshCounts();
  }

  function authScreen(needsSetup) {
    const err = h('p', { class: 'err-msg', role: 'alert' });
    const f = buildForm(needsSetup ? [T('name', 'Your name'), T('email', 'Email'), T('password', 'Password', { hint: 'At least 8 characters.' })] : [T('email', 'Email'), T('password', 'Password')], {});
    const inputs = f.el.querySelectorAll('input'); inputs[inputs.length - 1].type = 'password'; inputs[inputs.length - 1].autocomplete = needsSetup ? 'new-password' : 'current-password'; f.el.querySelector('input[type=text]:not([type=password])') ; inputs.forEach((i) => { if (i.closest('.f').querySelector('label')?.textContent === 'Email') { i.type = 'email'; i.autocomplete = 'username'; } });
    f.el.style.gridTemplateColumns = '1fr';
    const btn = h('button', { class: 'btn gold', style: 'width:100%', type: 'submit' }, needsSetup ? 'Create owner account' : 'Sign in');
    const form = h('form', { onsubmit: async (e) => { e.preventDefault(); err.textContent = ''; btn.disabled = true; try { const d = f.get(); const r = await api.post(needsSetup ? '/setup' : '/login', d); me = r.user; await start(); } catch (x) { err.textContent = x.message; } finally { btn.disabled = false; } } }, f.el, err, btn);
    root.replaceChildren(h('div', { class: 'auth' }, h('div', { class: 'auth-art' }, h('img', { src: '/resources/elixir_logo.png', alt: 'Elixir Salon & Spa' }), h('div', {}, h('h1', {}, 'Your website, in your hands.'), h('p', {}, 'Update prices, photos, offers and wording – and read messages from clients – all from here.')), h('small', { style: 'opacity:.6' }, 'Elixir Salon & Spa · Admin')),
      h('div', { class: 'auth-form' }, h('div', { class: 'auth-card' }, h('h2', {}, needsSetup ? 'Welcome! Let’s begin.' : 'Welcome back'), h('p', {}, needsSetup ? 'Create the owner account for this admin panel.' : 'Sign in to manage your website.'), form))));
    inputs[0].focus();
  }

  async function start() {
    try {
      const st = await fetch('/api/admin/status', { credentials: 'same-origin' }).then((x) => x.json());
      if (!st.user) return authScreen(st.needsSetup);
      me = st.user; mailConfigured = st.mailConfigured;
      await refreshShellIdentity();
      shell(); await route();
    } catch (e) { authScreen(false); }
  }
  A.onUnauthorized = () => { if (me) { me = null; toast('Your session ended – please sign in again.', 'err'); setTimeout(() => start(), 600); } };
  window.addEventListener('hashchange', () => me && route());
  // Shared with admin-bookings.js, then admin-boot.js starts everything.
  Object.assign(A, { PAGES, NAV, SCHEMA, T, t12, page, lede, card, empty, settingsCard, inlineList, route, refreshCounts, start, me: () => me, mailConfigured: () => mailConfigured });
})();
