/* Elixir Salon & Spa – online booking wizard + "manage my booking" view.
   Opened from any [data-book] button, ?book=1 deep links, and /booking/<token> email links. */
(() => {
  'use strict';

  const API = '/api/booking';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n) => String(n).padStart(2, '0');

  let D, cfg, ui, cats = [], byId = {}, dlg = null;
  const S = { pick: 0, mode: 'new', step: 1, sel: [], date: null, time: null, staff: 'any', month: null, cache: {}, sig: '', slots: [], slotState: 'idle', slotMeta: null, err: '', note: '', result: null, token: null, booking: null, q: '', cat: 'all', req: 0, busy: false, cancelOpen: false, details: loadDetails() };

  // ---------- formatting ----------
  const dur = (m) => { const h = Math.floor(m / 60), r = m % 60; return h ? (r ? `${h} hr ${r} min` : `${h} hr`) : `${m} min`; };
  const money = (n) => 'KES ' + Number(n).toLocaleString('en-US');
  const priceOf = (it) => (!it.min && !it.max ? 'On request' : it.min === it.max ? money(it.min) : `${money(it.min)} – ${Number(it.max).toLocaleString('en-US')}`);
  const parseD = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
  const longDate = (iso) => parseD(iso).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  const monthName = (ym) => parseD(ym + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const t12 = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return `${h % 12 || 12}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`; };
  const addDays = (iso, n) => { const d = parseD(iso); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  function estimate(list) {
    const min = list.reduce((a, i) => a + (i.min || 0), 0), max = list.reduce((a, i) => a + (i.max || 0), 0);
    const unknown = list.some((i) => !i.min && !i.max);
    if (!min && !max) return 'Confirmed at the salon';
    return min === max && !unknown ? money(min) : `From ${money(min)}`;
  }
  const chosen = () => S.sel.map((id) => byId[id]).filter(Boolean);
  const totalMin = () => (S.mode === 'new' ? chosen().reduce((a, i) => a + i.duration, 0) : S.booking ? S.booking.duration : 0);

  function loadDetails() { try { return { name: '', phone: '', email: '', notes: '', consent: false, ...JSON.parse(localStorage.getItem('elx_client') || '{}'), consent: false }; } catch { return { name: '', phone: '', email: '', notes: '', consent: false }; } }
  function saveDetails() { try { localStorage.setItem('elx_client', JSON.stringify({ name: S.details.name, phone: S.details.phone, email: S.details.email })); } catch { /* private mode */ } }
  const track = (event, extra = {}) => { try { (window.dataLayer = window.dataLayer || []).push({ event, ...extra }); } catch { /* ignore */ } };

  async function api(path, opts) {
    const r = await fetch(path, opts);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.error || 'Something went wrong. Please try again.'); e.status = r.status; throw e; }
    return j;
  }
  const post = (path, body) => api(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const base = () => (S.mode === 'reschedule' ? `${API}/manage/${S.token}` : API);
  const qsNew = () => (S.mode === 'new' ? `&services=${S.sel.join(',')}&staff=${S.staff}` : '');

  // ---------- init ----------
  function init(site) {
    D = site; cfg = D.scheduling; ui = D.settings.bookingUi;
    cats = D.categories.map((c) => ({ id: c.id, name: c.name, items: c.items.filter((i) => i.bookable).map((i) => ({ ...i, cat: c.name, catId: c.id })) })).filter((c) => c.items.length);
    byId = {}; cats.forEach((c) => c.items.forEach((i) => (byId[i.id] = i)));
    const p = new URLSearchParams(location.search);
    const m = location.pathname.match(/^\/booking\/([A-Za-z0-9_-]{20,40})/);
    if (m) return manage(m[1]); // existing bookings can always be viewed / changed
    if (cfg.enabled && p.get('book')) open({ services: (p.get('service') || '').split(',').map(Number).filter((id) => byId[id]) });
  }

  // ---------- public API ----------
  function open({ services = [], step } = {}) {
    if (!cfg || !cfg.enabled || !cats.length) { location.href = D.settings.brand.bookingUrl || '#'; return; }
    build();
    if (S.mode !== 'new' || S.step === 4) reset();
    if (services.length) { S.sel = services.filter((id) => byId[id]).slice(0, cfg.maxServices); S.date = null; S.time = null; }
    S.step = step || (S.sel.length ? 2 : 1);
    S.err = '';
    if (!dlg.open) { dlg.showModal(); document.documentElement.style.overflow = 'hidden'; track('booking_open', { services: S.sel.length }); }
    render();
  }
  function reset() { Object.assign(S, { mode: 'new', step: 1, sel: [], date: null, time: null, staff: 'any', month: null, cache: {}, sig: '', slots: [], slotState: 'idle', err: '', note: '', result: null, token: null, booking: null, cancelOpen: false, details: { ...loadDetails() } }); }

  async function manage(token) {
    build(); reset(); S.mode = 'manage'; S.token = token; S.step = 'manage';
    dlg.showModal(); document.documentElement.style.overflow = 'hidden';
    $('#bkBody').innerHTML = '<div class="bk-none">Loading your booking…</div>'; renderChrome();
    try { S.booking = await api(`${API}/manage/${token}`); } catch (e) { S.booking = null; S.err = e.message; }
    render();
  }

  // ---------- shell ----------
  function build() {
    if (dlg) return;
    const b = D.settings.brand, c = D.settings.contact;
    dlg = document.createElement('dialog');
    dlg.className = 'bk'; dlg.id = 'bk'; dlg.setAttribute('aria-label', ui.title);
    dlg.innerHTML = `<div class="bk-shell">
      <aside class="bk-side"><div class="bk-brand"><img src="${esc(b.logo)}" alt=""><div><b>${esc(b.name)}</b><span>${esc(ui.title)}</span></div></div>
        <ol class="bk-steps" id="bkSteps"></ol><div class="bk-summary" id="bkSummary"></div>
        <p class="bk-help"><i class="fa-solid fa-phone"></i>Prefer to talk? <a href="tel:+${String(c.phone).replace(/\D/g, '').replace(/^0/, '254')}">${esc(c.phone)}</a></p></aside>
      <section class="bk-main"><header class="bk-top">
        <button class="bk-iconbtn" id="bkBack" aria-label="Back"><i class="fa-solid fa-arrow-left"></i></button>
        <div class="bk-title"><small id="bkStepNo"></small><h2 id="bkTitle"></h2></div>
        <button class="bk-iconbtn" id="bkClose" aria-label="Close booking"><i class="fa-solid fa-xmark"></i></button></header>
        <div class="bk-progress"><i id="bkBar"></i></div>
        <div class="bk-body" id="bkBody" tabindex="-1"></div>
        <footer class="bk-foot"><div class="bk-mini" id="bkMini"></div><button class="btn" id="bkNext"></button></footer></section></div>`;
    document.body.append(dlg);
    $('#bkClose').onclick = () => dlg.close();
    $('#bkBack').onclick = back;
    $('#bkNext').onclick = next;
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener('close', () => { document.documentElement.style.overflow = ''; if (S.mode === 'manage' || location.pathname.startsWith('/booking/')) history.replaceState({}, '', '/'); });
    dlg.addEventListener('cancel', () => { document.documentElement.style.overflow = ''; });
  }

  const stepsFor = () => (S.mode === 'reschedule' ? [ui.stepTime.replace(/^Pick a /, '').replace(/^./, (x) => x.toUpperCase()), 'Confirmation'] : [ui.stepServices.replace('Choose your ', '').replace(/^./, (x) => x.toUpperCase()), 'Date & time', 'Your details']);
  const stepIndex = () => (S.mode === 'reschedule' ? (S.step === 4 ? 2 : 1) : S.mode === 'manage' ? 1 : Math.min(S.step, 4));

  function renderChrome() {
    const idx = stepIndex(), steps = stepsFor();
    const titles = { 1: ui.stepServices, 2: S.mode === 'reschedule' ? 'Choose a new time' : ui.stepTime, 3: ui.stepDetails, 4: 'Confirmation', manage: 'Your booking' };
    $('#bkTitle').textContent = titles[S.step] || ui.title;
    $('#bkStepNo').textContent = S.step === 4 ? 'All done' : S.step === 'manage' ? 'Manage' : `Step ${idx} of ${steps.length}`;
    $('#bkBar').style.width = S.step === 'manage' ? '100%' : `${Math.min(100, (Math.min(idx, steps.length) / steps.length) * 100)}%`;
    $('#bkSteps').innerHTML = S.step === 'manage' ? '' : steps.map((s, i) => `<li class="${i + 1 === idx ? 'on' : i + 1 < idx || S.step === 4 ? 'done' : ''}">${esc(s)}</li>`).join('');
    const canBack = (S.step === 2 && S.mode === 'new') || S.step === 3 || (S.step === 2 && S.mode === 'reschedule');
    $('#bkBack').hidden = !canBack;
    const next = $('#bkNext'), foot = $('.bk-foot');
    foot.hidden = S.step === 'manage';
    if (S.step === 4) { next.textContent = 'Done'; next.disabled = false; }
    else if (S.step === 3 || (S.mode === 'reschedule' && S.step === 2)) { next.innerHTML = `${S.mode === 'reschedule' ? 'Confirm new time' : cfg.autoConfirm ? esc(ui.confirmLabel) : esc(ui.requestLabel)} <i class="fa-solid fa-check"></i>`; next.disabled = S.mode === 'reschedule' ? !S.time : S.busy; }
    else { next.innerHTML = 'Continue <i class="fa-solid fa-arrow-right"></i>'; next.disabled = S.step === 1 ? !S.sel.length : !S.time; }
    if (S.busy) next.disabled = true;
    renderSummary();
  }

  function renderSummary() {
    const box = $('#bkSummary'), mini = $('#bkMini'), list = S.mode === 'new' ? chosen() : S.booking ? S.booking.items : [];
    if (S.step === 'manage') { box.innerHTML = ''; mini.innerHTML = ''; return; }
    const total = list.reduce((a, i) => a + i.duration, 0);
    const when = S.time && S.date ? `<div class="sum-line"><i class="fa-regular fa-calendar"></i><div><b>${esc(longDate(S.date))}</b><br>${esc(t12(S.time))}</div></div>` : '';
    const who = S.mode === 'new' && S.staff !== 'any' ? `<div class="sum-line"><i class="fa-regular fa-user"></i><div>${esc((cfg.staff.find((s) => s.id === S.staff) || {}).name || '')}</div></div>` : '';
    box.innerHTML = `<h4>Your booking</h4>${list.length ? list.map((i) => `<div class="sum-item"><div><b>${esc(i.name)}</b><small>${esc(dur(i.duration))} · ${esc(priceOf(i))}</small></div>${S.mode === 'new' && S.step === 1 ? `<button class="sum-x" data-rm="${i.id}" aria-label="Remove ${esc(i.name)}"><i class="fa-solid fa-xmark"></i></button>` : ''}</div>`).join('') : '<p class="sum-empty">No services selected yet.</p>'}
      ${when}${who}${list.length ? `<div class="sum-total"><span>${esc(dur(total))}</span><b>${esc(estimate(list))}</b></div>` : ''}`;
    $$('[data-rm]', box).forEach((b) => (b.onclick = () => toggle(+b.dataset.rm)));
    if (S.step === 4) { mini.innerHTML = ''; return; }
    mini.innerHTML = list.length ? `<b>${esc(estimate(list))}</b>${list.length} service${list.length > 1 ? 's' : ''} · ${esc(dur(total))}${S.time ? ` · ${esc(t12(S.time))}` : ''}` : 'Select a service to begin';
  }

  // ---------- navigation ----------
  function go(step) { S.step = step; S.err = ''; render(); $('#bkBody').focus({ preventScroll: true }); }
  function back() {
    if (S.mode === 'reschedule' && S.step === 2) { S.mode = 'manage'; S.step = 'manage'; S.cache = {}; S.date = null; S.time = null; return render(); }
    go(S.step - 1);
  }
  function next() {
    if (S.step === 1 && S.sel.length) return go(2);
    if (S.step === 2 && S.mode === 'reschedule') return submit();
    if (S.step === 2 && S.time) return go(3);
    if (S.step === 3) return submit();
    if (S.step === 4) return dlg.close();
  }

  function render() {
    S.step === 'manage' ? renderManage() : S.step === 1 ? renderServices() : S.step === 2 ? renderTime() : S.step === 3 ? renderDetails() : renderDone();
    renderChrome();
    const body = $('#bkBody'); body.scrollTop = 0; body.style.animation = 'none'; void body.offsetHeight; body.style.animation = '';
    track('booking_step', { step: S.step });
  }
  const errBox = () => (S.err ? `<div class="bk-err" role="alert"><i class="fa-solid fa-triangle-exclamation"></i><div>${esc(S.err)}</div></div>` : '');

  // ---------- step 1: services ----------
  function renderServices() {
    $('#bkBody').innerHTML = `${errBox()}<p class="bk-intro">${esc(ui.introServices)}</p>
      <div class="bk-search"><i class="fa-solid fa-magnifying-glass"></i><input id="bkQ" type="search" placeholder="Search services" aria-label="Search services" value="${esc(S.q)}" autocomplete="off"></div>
      <div class="bk-chips" role="tablist" aria-label="Categories"><button class="chip ${S.cat === 'all' ? 'on' : ''}" data-cat="all">All</button>${cats.map((c) => `<button class="chip ${S.cat == c.id ? 'on' : ''}" data-cat="${c.id}">${esc(c.name)}</button>`).join('')}</div>
      <div id="bkList"></div>`;
    $('#bkQ').oninput = (e) => { S.q = e.target.value; drawList(); };
    $$('.chip').forEach((c) => (c.onclick = () => { S.cat = c.dataset.cat; $$('.chip').forEach((x) => x.classList.toggle('on', x === c)); drawList(); }));
    drawList();
  }
  function drawList() {
    const q = S.q.trim().toLowerCase();
    const html = cats.filter((c) => S.cat === 'all' || String(c.id) === String(S.cat)).map((c) => {
      const items = c.items.filter((i) => !q || i.name.toLowerCase().includes(q) || c.name.toLowerCase().includes(q));
      return items.length ? `<div class="bk-grp">${esc(c.name)}</div>${items.map(svcRow).join('')}` : '';
    }).join('');
    $('#bkList').innerHTML = html || '<div class="bk-none">No services match your search.</div>';
    $$('.bsvc').forEach((b) => (b.onclick = () => toggle(+b.dataset.id)));
  }
  const svcRow = (i) => `<button class="bsvc ${S.sel.includes(i.id) ? 'on' : ''}" data-id="${i.id}" aria-pressed="${S.sel.includes(i.id)}">
      <span class="svc-main"><b>${esc(i.name)}</b><small>${esc(dur(i.duration))}${i.note ? ' · ' + esc(i.note) : ''}</small></span>
      <span class="svc-price">${esc(priceOf(i))}</span><span class="svc-tick"><i class="fa-solid ${S.sel.includes(i.id) ? 'fa-check' : 'fa-plus'}"></i></span></button>`;
  function toggle(id) {
    const i = S.sel.indexOf(id);
    if (i >= 0) S.sel.splice(i, 1);
    else if (S.sel.length >= cfg.maxServices) return toast(`You can book up to ${cfg.maxServices} services at once.`);
    else S.sel.push(id);
    S.date = null; S.time = null; S.cache = {};
    if (S.step === 1) { const row = $(`.bsvc[data-id="${id}"]`); if (row) { row.outerHTML = svcRow(byId[id]); $(`.bsvc[data-id="${id}"]`).onclick = () => toggle(id); } }
    renderChrome();
  }
  function toast(msg) { const t = document.createElement('div'); t.className = 'bk-toast'; t.textContent = msg; $('.bk-main').append(t); setTimeout(() => t.remove(), 2600); }

  // ---------- step 2: date & time ----------
  const sig = () => `${S.mode}|${S.sel.join(',')}|${S.staff}`;
  function staffHtml() {
    if (S.mode !== 'new' || !cfg.staff.length) return '';
    const cs = chosen().map((i) => i.catId);
    const list = cfg.staff.filter((s) => !s.cats || cs.every((c) => s.cats.includes(c)));
    if (!list.length) return '';
    const av = (s) => (s.photo ? `<span class="av" style="background-image:url('${esc(s.photo)}')"></span>` : `<span class="av">${esc(s.name.trim()[0] || '?')}</span>`);
    return `<div class="bk-staff"><p class="bk-lab">Specialist</p><div class="staff-row" role="group" aria-label="Choose a specialist">
      <button class="stf ${S.staff === 'any' ? 'on' : ''}" data-staff="any"><span class="av"><i class="fa-solid fa-users" style="font-size:.8rem"></i></span><span>Any available<small>Soonest times</small></span></button>
      ${list.map((s) => `<button class="stf ${S.staff === s.id ? 'on' : ''}" data-staff="${s.id}">${av(s)}<span>${esc(s.name)}${s.title ? `<small>${esc(s.title)}</small>` : ''}</span></button>`).join('')}</div></div>`;
  }
  function renderTime() {
    if (S.mode === 'new' && S.staff !== 'any') { const cs = chosen().map((i) => i.catId); const st = cfg.staff.find((x) => x.id === S.staff); if (!st || (st.cats && !cs.every((c) => st.cats.includes(c)))) S.staff = 'any'; }
    if (S.sig !== sig()) { S.sig = sig(); S.cache = {}; S.date = null; S.time = null; S.slots = []; S.slotState = 'idle'; }
    const tzNote = Intl.DateTimeFormat().resolvedOptions().timeZone !== cfg.timezone ? `<div class="bk-note"><i class="fa-regular fa-clock"></i> Times are shown in salon time (${esc(cfg.timezone.replace(/^.*\//, '').replace(/_/g, ' '))}).</div>` : '';
    $('#bkBody').innerHTML = `${errBox()}<p class="bk-intro">${esc(S.mode === 'reschedule' ? 'Choose a new day and time for your appointment.' : ui.introTime)}</p>${staffHtml()}${tzNote}
      <div class="bk-time"><div class="cal" id="cal"></div><div class="slots" id="slots"></div></div>`;
    $$('.stf').forEach((b) => (b.onclick = () => { S.staff = b.dataset.staff === 'any' ? 'any' : +b.dataset.staff; renderTime(); renderChrome(); }));
    drawCal(); drawSlots();
    if (!S.date) autoPick(); else if (S.slotState === 'idle') loadSlots(S.date); else drawSlots();
  }
  async function autoPick(from) {
    const my = ++S.pick; S.slotState = 'loading'; S.slotMeta = null; drawSlots();
    try {
      const r = await api(`${base()}/next?x=1${qsNew()}${from ? `&from=${from}` : ''}`);
      if (my !== S.pick) return;
      if (!r.date) { S.slotState = 'none'; S.slotMeta = { noneAtAll: true }; return drawSlots(); }
      S.date = r.date; S.month = r.date.slice(0, 7); S.time = null;
      await Promise.all([loadMonth(S.month), loadSlots(r.date)]);
      if (my !== S.pick) return;
      drawCal(); renderChrome();
    } catch (e) { if (my === S.pick) { S.slotState = 'error'; S.slotMeta = { msg: e.message }; drawSlots(); } }
  }
  async function loadMonth(m) {
    if (S.cache[m]) return S.cache[m];
    const sg = S.sig;
    const r = await api(`${base()}/days?month=${m}${qsNew()}`);
    if (sg === S.sig) S.cache[m] = r; // ignore answers that belong to an older selection
    return r;
  }
  function drawCal() {
    const box = $('#cal'); if (!box) return;
    const m = S.month || (S.date ? S.date.slice(0, 7) : new Date().toISOString().slice(0, 7));
    S.month = m;
    const data = S.cache[m];
    const first = parseD(m + '-01'), lead = (first.getUTCDay() + 6) % 7; // Monday-first
    const count = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
    const todayIso = (S.cache[m] || Object.values(S.cache)[0] || {}).today;
    const prevOk = todayIso ? m > todayIso.slice(0, 7) : true;
    const maxMonth = (Object.values(S.cache)[0] || {}).maxDate;
    const nextOk = maxMonth ? m < maxMonth.slice(0, 7) : true;
    let cells = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => `<div class="dow">${d}</div>`).join('') + '<span></span>'.repeat(lead);
    for (let d = 1; d <= count; d++) {
      const iso = `${m}-${pad(d)}`, n = data && data.days[iso];
      cells += `<button class="day ${n ? 'has' : ''} ${iso === S.date ? 'sel' : ''} ${iso === todayIso ? 'today' : ''}" data-d="${iso}" ${n ? '' : 'disabled'} aria-label="${esc(longDate(iso))}${n ? `, ${n} times available` : ', unavailable'}">${d}</button>`;
    }
    box.className = 'cal' + (data ? '' : ' loading');
    box.innerHTML = `<div class="cal-head"><button id="calPrev" aria-label="Previous month" ${prevOk ? '' : 'disabled'}><i class="fa-solid fa-chevron-left"></i></button><b>${esc(monthName(m))}</b><button id="calNext" aria-label="Next month" ${nextOk ? '' : 'disabled'}><i class="fa-solid fa-chevron-right"></i></button></div><div class="cal-grid">${cells}</div>`;
    $$('.day:not(:disabled)', box).forEach((b) => (b.onclick = () => pickDate(b.dataset.d)));
    const shift = async (n) => { const d = parseD(m + '-01'); d.setUTCMonth(d.getUTCMonth() + n); S.month = d.toISOString().slice(0, 7); drawCal(); try { await loadMonth(S.month); } catch { /* retry on next click */ } drawCal(); };
    $('#calPrev', box).onclick = () => shift(-1); $('#calNext', box).onclick = () => shift(1);
    if (!data) loadMonth(m).then(drawCal).catch(() => {});
  }
  function pickDate(iso) { S.date = iso; S.time = null; drawCal(); renderChrome(); loadSlots(iso); }
  async function loadSlots(iso) {
    const my = ++S.req; S.slotState = 'loading'; drawSlots();
    try {
      const r = await api(`${base()}/availability?date=${iso}${qsNew()}`);
      if (my !== S.req) return;
      S.slots = r.slots; S.slotMeta = { duration: r.duration }; S.slotState = r.slots.length ? 'ready' : 'none';
    } catch (e) { if (my !== S.req) return; S.slotState = 'error'; S.slotMeta = { msg: e.message }; }
    drawSlots();
  }
  function drawSlots() {
    const box = $('#slots'); if (!box) return;
    if (S.slotState === 'loading') { box.innerHTML = `<h3>${S.date ? esc(longDate(S.date)) : 'Finding the next available time…'}</h3><p>Checking availability…</p><div class="slot-row">${'<div class="skel"></div>'.repeat(8)}</div>`; return; }
    if (S.slotState === 'error') { box.innerHTML = `<div class="slots-empty"><i class="fa-solid fa-triangle-exclamation"></i>${esc((S.slotMeta || {}).msg || 'Could not load times.')}<br><button class="btn btn-sm" id="retry">Try again</button></div>`; $('#retry').onclick = () => (S.date ? loadSlots(S.date) : autoPick()); return; }
    if (S.slotMeta && S.slotMeta.noneAtAll) { box.innerHTML = `<div class="slots-empty"><i class="fa-regular fa-calendar-xmark"></i>No online times are available in the coming weeks for this selection.<br>Please call us on <a href="tel:+${digits(D.settings.contact.phone)}"><b>${esc(D.settings.contact.phone)}</b></a>.</div>`; return; }
    if (S.slotState === 'none' || !S.slots.length) { box.innerHTML = `<h3>${S.date ? esc(longDate(S.date)) : ''}</h3><div class="slots-empty"><i class="fa-regular fa-calendar-xmark"></i>No times left on this day.<br><button class="btn btn-sm" id="nextDay">Show next available day</button></div>`; $('#nextDay').onclick = () => autoPick(addDays(S.date || new Date().toISOString().slice(0, 10), 1)); return; }
    const groups = [['Morning', 'fa-sun', (h) => h < 12], ['Afternoon', 'fa-cloud-sun', (h) => h >= 12 && h < 17], ['Evening', 'fa-moon', (h) => h >= 17]];
    box.innerHTML = `<h3>${esc(longDate(S.date))}</h3><p>${S.slots.length} time${S.slots.length > 1 ? 's' : ''} available · appointment length ${esc(dur(S.slotMeta.duration))}</p>` +
      groups.map(([name, ic, fn]) => { const l = S.slots.filter((s) => fn(+s.time.slice(0, 2))); return l.length ? `<div class="slot-grp"><h4><i class="fa-solid ${ic}"></i>${name}</h4><div class="slot-row">${l.map((s) => `<button class="slot ${s.time === S.time ? 'on' : ''}" data-t="${s.time}">${esc(s.label)}</button>`).join('')}</div></div>` : ''; }).join('');
    $$('.slot', box).forEach((b) => (b.onclick = () => { S.time = b.dataset.t; $$('.slot', box).forEach((x) => x.classList.toggle('on', x === b)); renderChrome(); }));
  }
  const digits = (s) => String(s || '').replace(/\D/g, '').replace(/^0/, '254');

  // ---------- step 3: details ----------
  function renderDetails() {
    const d = S.details, list = chosen();
    const fld = (id, label, type, val, extra = '', req = true) => `<label class="f ${id === 'notes' ? 'full' : ''}" data-f="${id}"><span>${label}${req ? '' : ' <em>(optional)</em>'}</span>${type === 'textarea' ? `<textarea id="f_${id}" ${extra}>${esc(val)}</textarea>` : `<input id="f_${id}" type="${type}" value="${esc(val)}" ${extra}>`}<div class="e" role="alert"></div></label>`;
    $('#bkBody').innerHTML = `${errBox()}<p class="bk-intro">${esc(ui.introDetails)}</p>
      <div class="bk-recap"><div><small>When</small><b>${esc(longDate(S.date))}</b><br>${esc(t12(S.time))}</div><div><small>Length</small><b>${esc(dur(totalMin()))}</b></div>
        <div class="wide"><small>Services</small><b>${esc(list.map((i) => i.name).join(', '))}</b></div></div>
      <form class="bkf" id="bkForm" novalidate>
        ${fld('name', 'Full name', 'text', d.name, 'autocomplete="name" placeholder="e.g. Wanjiru Kamau"')}
        ${fld('phone', 'Mobile number', 'tel', d.phone, 'autocomplete="tel" inputmode="tel" placeholder="0712 345 678"')}
        <div class="full">${fld('email', 'Email', 'email', d.email, 'autocomplete="email" inputmode="email" placeholder="you@example.com"', cfg.requireEmail)}</div>
        ${fld('notes', 'Anything we should know?', 'textarea', d.notes, 'maxlength="1000" placeholder="Allergies, preferences, special occasion…"', false)}
        <input type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;height:0">
        <label class="consent full"><input type="checkbox" id="f_consent" ${d.consent ? 'checked' : ''}><span>${esc(ui.consent)} <a href="/?privacy-policy=true" target="_blank" rel="noopener">Privacy policy</a></span></label>
 <button type="submit" tabindex="-1" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px"></button>
        <div class="e full" id="consentErr" style="color:#b3261e;font-size:.8rem;display:none">Please accept to continue.</div>
      </form>${ui.policy ? `<p class="bk-policy"><i class="fa-solid fa-shield-halved"></i><span>${esc(ui.policy)}</span></p>` : ''}`;
    $('#bkForm').addEventListener('input', (e) => { const t = e.target; if (t.id === 'f_consent') d.consent = t.checked; else if (t.id && t.id.startsWith('f_')) d[t.id.slice(2)] = t.value; t.closest('.bad')?.classList.remove('bad'); });
    $('#bkForm').addEventListener('submit', (e) => { e.preventDefault(); next(); });
    setTimeout(() => !d.name && $('#f_name') && !matchMedia('(max-width:900px)').matches && $('#f_name').focus(), 60);
  }
  function validate() {
    const d = S.details; let ok = true;
    const bad = (id, msg) => { const f = $(`[data-f="${id}"]`); f.classList.add('bad'); $('.e', f).textContent = msg; ok = false; };
    if (d.name.trim().length < 2) bad('name', 'Please enter your name.');
    if (!/^(\+?254|0)?[17]\d{8}$/.test(d.phone.replace(/[\s\-().]/g, '')) && !/^\+\d{9,15}$/.test(d.phone.replace(/[\s\-().]/g, ''))) bad('phone', 'Enter a valid mobile number, e.g. 0712 345 678.');
    if (d.email.trim() ? !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim()) : cfg.requireEmail) bad('email', 'Enter a valid email so we can send your confirmation.');
    $('#consentErr').style.display = d.consent ? 'none' : 'block'; if (!d.consent) ok = false;
    if (!ok) { const f = $('.bad input, .bad textarea'); f ? f.focus() : $('#f_consent').focus(); }
    return ok;
  }

  async function submit() {
    if (S.mode === 'new' && !validate()) return;
    S.busy = true; S.err = ''; renderChrome();
    const label = $('#bkNext').innerHTML; $('#bkNext').innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Please wait';
    try {
      if (S.mode === 'reschedule') S.result = await post(`${API}/manage/${S.token}/reschedule`, { date: S.date, time: S.time });
      else {
        const d = S.details;
        S.result = await post(API, { services: S.sel, date: S.date, time: S.time, staff: S.staff, name: d.name, phone: d.phone, email: d.email, notes: d.notes, consent: d.consent, website: ($('input[name=website]') || {}).value || '' });
        saveDetails();
      }
      track('booking_complete', { reference: S.result.reference, value: S.result.priceMin });
      S.busy = false; go(4);
    } catch (e) {
      S.busy = false; $('#bkNext').innerHTML = label;
      if (e.status === 409) { S.err = e.message; S.time = null; S.cache = {}; S.slotState = 'idle'; S.step = 2; render(); return; }
      S.err = e.message; render();
    }
  }

  // ---------- step 4: done ----------
  function bookingCard(b) {
    const r = (ic, k, v) => `<div class="r"><i class="${ic}"></i><div><small>${k}</small>${v}</div></div>`;
    return `<div class="bk-card">${r('fa-regular fa-calendar', 'When', `<b>${esc(b.longDate)}</b><br>${esc(b.timeLabel)}`)}
      ${r('fa-solid fa-scissors', 'Services', b.items.map((i) => `${esc(i.name)} <span style="color:var(--ink-2)">(${esc(dur(i.duration))})</span>`).join('<br>'))}
      ${b.staffName ? r('fa-regular fa-user', 'Specialist', esc(b.staffName)) : ''}
      ${r('fa-solid fa-tag', 'Estimated total', esc(b.total))}
      ${r('fa-solid fa-location-dot', 'Where', `${esc(D.settings.contact.address)}`)}</div>`;
  }
  function renderDone() {
    const b = S.result, pending = b.status === 'pending', rs = S.mode === 'reschedule';
    const title = rs ? 'Booking updated' : pending ? ui.successPendingTitle : ui.successTitle;
    const text = rs ? (pending ? 'Your new time is awaiting confirmation. We will email you shortly.' : 'Your new appointment time is confirmed. A fresh confirmation is on its way to your email.') : pending ? ui.successPendingText : ui.successText;
    $('#bkBody').innerHTML = `<div class="bk-done">
      <svg class="check" viewBox="0 0 72 72" aria-hidden="true"><circle cx="36" cy="36" r="30"/><path d="M22 37l10 10 18-21"/></svg>
      <h3>${esc(title)}</h3><p>${esc(text)}${b.email ? ` <br><b>${esc(b.email)}</b>` : ''}</p>
      <div class="ref"><small>Booking reference</small><b>${esc(b.reference)}</b></div>${bookingCard(b)}
      <div class="bk-actions"><a class="btn" href="/booking/${esc(b.token)}/calendar.ics"><i class="fa-regular fa-calendar-plus"></i> Add to calendar</a>
        <a class="btn light" href="/booking/${esc(b.token)}"><i class="fa-solid fa-sliders"></i> Manage booking</a>
        <button class="btn light" id="again"><i class="fa-solid fa-plus"></i> Book another</button></div></div>`;
    $('#again').onclick = () => { const keep = S.details; reset(); S.details = keep; S.step = 1; render(); };
  }

  // ---------- manage view ----------
  function renderManage() {
    const b = S.booking, body = $('#bkBody');
    if (!b) { body.innerHTML = `<div class="bk-done"><h3>Booking not found</h3><p>${esc(S.err || 'This link may have expired.')}</p>${cfg.enabled ? '<div class="bk-actions"><button class="btn" id="mNew">Book an appointment</button></div>' : ''}</div>`; if ($('#mNew')) $('#mNew').onclick = () => { reset(); S.step = 1; history.replaceState({}, '', '/'); render(); }; return; }
    const active = ['pending', 'confirmed'].includes(b.status);
    const label = { pending: 'Awaiting confirmation', confirmed: 'Confirmed', cancelled: 'Cancelled', declined: 'Not available', completed: 'Completed', no_show: 'Missed' }[b.status] || b.status;
    body.innerHTML = `<div class="bk-done"><span class="status-pill ${esc(b.status)}">${esc(label)}</span>
      <div class="ref"><small>Booking reference</small><b>${esc(b.reference)}</b></div>${bookingCard(b)}
      ${S.err ? errBox() : ''}
      ${active && !b.canChange ? `<div class="bk-note" style="max-width:520px;margin:0 auto 16px;text-align:left">Online changes close ${b.cancelHours} hours before your appointment. Please call <a href="tel:+${digits(D.settings.contact.phone)}"><b>${esc(D.settings.contact.phone)}</b></a> and we will gladly help.</div>` : ''}
      ${S.cancelOpen ? `<div class="cancel-box"><b>Cancel this appointment?</b><textarea id="cReason" placeholder="Reason (optional)" maxlength="300"></textarea><div class="bk-actions" style="justify-content:flex-start"><button class="btn danger" id="cYes">Yes, cancel booking</button><button class="btn light" id="cNo">Keep booking</button></div></div>` : ''}
      <div class="bk-actions">
        ${active && b.canChange ? '<button class="btn" id="mResch"><i class="fa-solid fa-rotate"></i> Reschedule</button>' : ''}
        ${active ? `<a class="btn light" href="/booking/${esc(b.token)}/calendar.ics"><i class="fa-regular fa-calendar-plus"></i> Add to calendar</a>` : ''}
        ${active && b.canChange && !S.cancelOpen ? '<button class="btn danger" id="mCancel"><i class="fa-solid fa-ban"></i> Cancel booking</button>' : ''}
        ${cfg.enabled ? '<button class="btn light" id="mNew"><i class="fa-solid fa-plus"></i> New booking</button>' : ''}</div></div>`;
    const on = (id, fn) => { const el = $(id); if (el) el.onclick = fn; };
    on('#mResch', () => { S.mode = 'reschedule'; S.sel = []; S.cache = {}; S.date = null; S.time = null; S.sig = ''; S.err = ''; go(2); });
    on('#mCancel', () => { S.cancelOpen = true; renderManage(); });
    on('#cNo', () => { S.cancelOpen = false; renderManage(); });
    on('#cYes', async () => { try { S.booking = await post(`${API}/manage/${S.token}/cancel`, { reason: ($('#cReason') || {}).value || '' }); S.cancelOpen = false; S.err = ''; track('booking_cancel'); } catch (e) { S.err = e.message; } renderManage(); });
    on('#mNew', () => { reset(); S.step = 1; history.replaceState({}, '', '/'); render(); });
  }

  window.ElixirBooking = { init, open, manage };
})();
