/* Elixir admin – bookings, schedule, specialists, closures, email health */
(() => {
  'use strict';
  const { h, $, icon, api, toast, fail, modal, confirmBox, buildForm, fmtDate, PAGES, NAV, T, t12, page, lede, card, empty, settingsCard } = A;

  const ST = { pending: 'Awaiting approval', confirmed: 'Confirmed', completed: 'Completed', no_show: 'No-show', cancelled: 'Cancelled', declined: 'Declined' };
  const pill = (s) => h('span', { class: 'pill ' + s }, ST[s] || s);
  const pad = (n) => String(n).padStart(2, '0');
  const toMin = (t) => { const [a, b] = String(t).split(':').map(Number); return a * 60 + b; };
  const fromMin = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
  const dur = (m) => { const h_ = Math.floor(m / 60), r = m % 60; return h_ ? (r ? `${h_} hr ${r} min` : `${h_} hr`) : `${m} min`; };
  const money = (n) => 'KES ' + Number(n).toLocaleString('en-US');
  const est = (b) => (!b.priceMin && !b.priceMax ? 'Confirmed at salon' : b.priceMin === b.priceMax ? money(b.priceMin) : `From ${money(b.priceMin)}`);
  const parseD = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
  const addDays = (iso, n) => { const d = parseD(iso); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const longDate = (iso) => parseD(iso).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const shortDate = (iso) => parseD(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  const digits = (p) => String(p || '').replace(/\D/g, '');
  const qparams = () => new URLSearchParams((location.hash.split('?')[1] || ''));
  let viewDate = null, serverToday = null;

  // =============================================================== shared pieces
  // Pick services from the price list (multi-select).
  async function servicePicker(onChange, initialIds = []) {
    const site = await fetch('/api/site').then((r) => r.json());
    const cats = site.categories.map((c) => ({ id: c.id, name: c.name, items: c.items })).filter((c) => c.items.length);
    const all = Object.fromEntries(cats.flatMap((c) => c.items.map((i) => [i.id, { ...i, cat: c.name }])));
    let sel = initialIds.filter((id) => all[id]);
    const catSel = h('select', { class: 'in' }, ...cats.map((c) => h('option', { value: c.id }, c.name)));
    const svcSel = h('select', { class: 'in' });
    const chips = h('div', { class: 'chips' });
    const fillSvc = () => { const c = cats.find((x) => String(x.id) === catSel.value); svcSel.replaceChildren(...c.items.map((i) => h('option', { value: i.id }, `${i.name} · ${dur(i.duration)}`))); };
    const draw = () => {
      chips.replaceChildren(...sel.map((id) => h('span', { class: 'chip' }, all[id].name, h('small', {}, ' ' + dur(all[id].duration)), h('button', { type: 'button', 'aria-label': 'Remove', onclick: () => { sel = sel.filter((x) => x !== id); draw(); onChange(); } }, icon('x')))));
      if (!sel.length) chips.append(h('span', { class: 'hint' }, 'No services chosen yet.'));
    };
    catSel.addEventListener('change', fillSvc); fillSvc();
    const el = h('div', { class: 'f full' }, h('label', {}, 'Services'), h('div', { class: 'svcpick' }, catSel, svcSel, h('button', { type: 'button', class: 'btn sm primary', onclick: () => { const id = +svcSel.value; if (id && !sel.includes(id)) { sel.push(id); draw(); onChange(); } } }, icon('plus'), 'Add')), chips);
    draw();
    return { el, ids: () => sel, minutes: () => sel.reduce((a, id) => a + all[id].duration, 0) };
  }

  // Date + specialist + free time chips (+ optional custom time that overrides availability).
  function slotPicker({ services, excludeId, init = {}, staff = [] }) {
    const st = { time: init.time || '', custom: false, slots: [], loading: false };
    const date = h('input', { class: 'in', type: 'date', value: init.date || serverToday || new Date().toISOString().slice(0, 10) });
    const who = h('select', { class: 'in' }, h('option', { value: 'any' }, 'Any available'), ...staff.map((s) => h('option', { value: s.id, selected: String(s.id) === String(init.staff) }, s.name)));
    const grid = h('div', { class: 'slotgrid' }), msg = h('div', { class: 'hint' });
    const custom = h('input', { class: 'in', type: 'time', value: init.time || '', style: 'max-width:150px', oninput: (e) => { st.time = e.target.value; } });
    const customRow = h('div', { class: 'f', style: 'display:none' }, h('label', {}, 'Custom time'), custom, h('div', { class: 'hint' }, 'Overrides availability – the booking may overlap another appointment.'));
    const customToggle = h('label', { class: 'switch' }, h('input', { type: 'checkbox', onchange: (e) => { st.custom = e.target.checked; customRow.style.display = st.custom ? '' : 'none'; grid.style.display = st.custom ? 'none' : ''; if (st.custom) st.time = custom.value; } }), h('i'), h('span', {}, 'Choose a custom time'));
    async function refresh() {
      const ids = services();
      grid.replaceChildren(); msg.textContent = '';
      if (!ids.length) { msg.textContent = 'Choose at least one service to see free times.'; return; }
      msg.textContent = 'Checking availability…';
      try {
        const r = await api.get(`/availability?date=${date.value}&services=${ids.join(',')}&staff=${who.value}${excludeId ? `&exclude=${excludeId}` : ''}`);
        msg.textContent = r.slots.length ? `${r.slots.length} free start times · appointment length ${dur(r.duration)}` : 'No free start times that day. Pick another day, another specialist, or use a custom time.';
        grid.replaceChildren(...r.slots.map((s) => h('button', { type: 'button', class: 'slotbtn' + (s.time === st.time ? ' on' : ''), onclick: (e) => { st.time = s.time; [...grid.children].forEach((b) => b.classList.toggle('on', b === e.currentTarget)); } }, s.label)));
      } catch (e) { msg.textContent = e.message; }
    }
    date.addEventListener('change', () => { st.time = ''; refresh(); }); who.addEventListener('change', () => { st.time = ''; refresh(); });
    const el = h('div', {}, h('div', { class: 'grid2' }, h('div', { class: 'f' }, h('label', {}, 'Date'), date), h('div', { class: 'f' }, h('label', {}, 'Specialist'), who)), msg, grid, h('div', { style: 'margin:10px 0' }, customToggle), customRow);
    return { el, refresh, get: () => ({ date: date.value, time: st.time, staff: who.value, force: st.custom }) };
  }

  // =============================================================== booking detail
  async function openBooking(id, onChange) {
    let b = await api.get('/bookings/' + id);
    const dlg = modal({ title: `Booking ${b.reference}`, wide: true, body: h('div'), onClose: () => onChange && onChange() });
    const body = $('.m-body', dlg);

    const reload = async () => { b = await api.get('/bookings/' + id); draw(); };
    const act = async (fn, okMsg) => { try { await fn(); toast(okMsg); await reload(); } catch (e) { fail(e); } };
    const ask = (title, okLabel, cb, { danger = true, needReason = false } = {}) => {
      const reason = h('textarea', { class: 'in', rows: 3, placeholder: 'Reason (shown to the client)…', maxlength: 300 });
      const notify = h('input', { type: 'checkbox', checked: !!b.email, disabled: !b.email });
      const d2 = modal({ title, body: h('div', {}, h('div', { class: 'f' }, h('label', {}, 'Reason'), reason), h('label', { class: 'switch' }, notify, h('i'), h('span', {}, b.email ? 'Email the client' : 'No email on file'))),
        foot: [h('button', { class: 'btn', onclick: () => d2.close() }, 'Back'), h('button', { class: 'btn ' + (danger ? 'danger' : 'primary'), onclick: async () => { if (needReason && !reason.value.trim()) return toast('Please add a reason.', 'err'); d2.close(); await cb(reason.value.trim(), notify.checked); } }, okLabel)] });
    };
    const setStatus = (status, extra = {}, msg = 'Updated.') => act(() => api.patch('/bookings/' + id, { status, ...extra }), msg);

    function reschedule() {
      const initial = { date: b.date, time: b.start, staff: b.staffRequested ? b.staffId : 'any' };
      let sp;
      api.get('/staff').then((staff) => {
        sp = slotPicker({ services: () => b.items.map((i) => i.id).filter(Boolean), excludeId: b.id, init: initial, staff: staff.filter((s) => s.active) });
        const notify = h('input', { type: 'checkbox', checked: !!b.email, disabled: !b.email });
        const d2 = modal({ title: 'Reschedule', body: h('div', {}, sp.el, h('label', { class: 'switch', style: 'margin-top:8px' }, notify, h('i'), h('span', {}, b.email ? 'Email the client the new time' : 'No email on file'))),
          foot: [h('button', { class: 'btn', onclick: () => d2.close() }, 'Cancel'), h('button', { class: 'btn primary', onclick: async () => { const v = sp.get(); if (!v.time) return toast('Choose a time.', 'err'); try { await api.post(`/bookings/${id}/reschedule`, { ...v, notify: notify.checked }); d2.close(); toast('Rescheduled.'); await reload(); } catch (e) { fail(e); } } }, 'Save new time')] });
        sp.refresh();
      }).catch(fail);
    }

    function draw() {
      const open = ['pending', 'confirmed'].includes(b.status);
      const wa = `https://wa.me/${digits(b.phone)}?text=${encodeURIComponent(`Hello ${b.whatsapp.name}, this is Elixir Salon & Spa about your booking ${b.reference} on ${b.whatsapp.date} at ${b.whatsapp.time}.`)}`;
      const row = (k, v) => h('div', { class: 'r' }, h('small', {}, k), h('div', {}, v));
      body.replaceChildren(h('div', { class: 'bkd' },
        h('div', { class: 'bkd-head' }, pill(b.status), h('span', { class: 'hint' }, `Booked ${b.source === 'admin' ? 'by staff' : 'online'} · ${fmtDate(b.createdAt)}`)),
        h('div', { class: 'bkd-grid' },
          h('div', { class: 'bkd-card' }, row('When', [h('b', {}, longDate(b.date)), h('br'), `${t12(b.start)} – ${t12(b.end)} · ${dur(b.duration)}`]),
            row('Services', b.items.map((i) => h('div', {}, i.name, h('span', { class: 'hint' }, `  ${dur(i.duration)} · ${i.price || 'price on request'}`)))),
            row('Specialist', b.staffName ? `${b.staffName}${b.staffRequested ? ' (requested by client)' : ''}` : 'Not assigned'), row('Estimated total', est(b))),
          h('div', { class: 'bkd-card' }, row('Client', h('b', {}, b.name)), row('Phone', h('a', { href: 'tel:' + b.phone }, b.phone)), row('Email', b.email ? h('a', { href: 'mailto:' + b.email }, b.email) : '—'),
            b.notes ? row('Client notes', b.notes) : null, b.cancelReason ? row(b.status === 'declined' ? 'Decline reason' : 'Cancel reason', `${b.cancelReason}${b.cancelledBy ? ` (${b.cancelledBy})` : ''}`) : null)),
        h('div', { class: 'actions', style: 'margin:16px 0 6px' },
          b.status === 'pending' ? h('button', { class: 'btn primary', onclick: () => ask('Confirm this booking?', 'Confirm', (r, n) => setStatus('confirmed', { notify: n }, 'Confirmed.'), { danger: false }) }, icon('circlecheck'), 'Confirm') : null,
          b.status === 'pending' ? h('button', { class: 'btn danger', onclick: () => ask('Decline this booking', 'Decline booking', (r, n) => setStatus('declined', { reason: r, notify: n }, 'Declined.')) }, icon('ban'), 'Decline') : null,
          b.status === 'confirmed' ? h('button', { class: 'btn primary', onclick: () => setStatus('completed', {}, 'Marked as completed.') }, icon('check'), 'Completed') : null,
          b.status === 'confirmed' ? h('button', { class: 'btn', onclick: () => setStatus('no_show', {}, 'Marked as no-show.') }, 'No-show') : null,
          open ? h('button', { class: 'btn', onclick: reschedule }, icon('refresh'), 'Reschedule') : null,
          open ? h('button', { class: 'btn danger', onclick: () => ask('Cancel this booking', 'Cancel booking', (r, n) => setStatus('cancelled', { reason: r, notify: n }, 'Cancelled.')) }, icon('ban'), 'Cancel') : null,
          !open ? h('button', { class: 'btn', onclick: () => setStatus('confirmed', { notify: false }, 'Re-opened.') }, icon('refresh'), 'Re-open') : null),
        h('div', { class: 'actions' },
          h('a', { class: 'btn sm', href: wa, target: '_blank', rel: 'noopener' }, icon('phone'), 'WhatsApp'),
          h('a', { class: 'btn sm', href: 'tel:' + b.phone }, icon('phone'), 'Call'),
          b.email && b.status === 'confirmed' ? h('button', { class: 'btn sm', onclick: () => act(() => api.post(`/bookings/${id}/reminder`, {}), 'Reminder sent.') }, icon('send'), 'Send reminder') : null,
          h('a', { class: 'btn sm', href: `/booking/${b.token}`, target: '_blank' }, icon('ext'), 'Client view')),
        h('div', { class: 'f', style: 'margin-top:14px' }, h('label', {}, 'Private note'), (() => { const n = h('textarea', { class: 'in', rows: 2, placeholder: 'Only visible to your team…' }, b.adminNote || ''); n.value = b.adminNote || ''; return [n, h('div', { style: 'margin-top:8px;display:flex;justify-content:space-between;gap:10px' }, h('button', { class: 'btn sm', onclick: () => act(() => api.patch('/bookings/' + id, { admin_note: n.value }), 'Note saved.') }, 'Save note'), h('button', { class: 'btn sm danger', onclick: async () => { if (await confirmBox('Permanently delete this booking? This cannot be undone.')) { try { await api.del('/bookings/' + id); toast('Deleted.'); dlg.close(); } catch (e) { fail(e); } } } }, icon('trash'), 'Delete'))]; })()),
        b.emails.length ? h('div', { class: 'f' }, h('label', {}, 'Emails sent for this booking'), h('ul', { class: 'list' }, ...b.emails.map((m) => h('li', {}, h('div', { class: 'grow' }, m.kind.replace('booking_', '').replace('_', ' '), m.error ? h('small', {}, m.error) : null), h('span', { class: 'pill ' + (m.status === 'sent' ? 'approved' : m.status === 'failed' ? 'hidden' : 'read') }, m.status), h('time', {}, fmtDate(m.created_at)))))) : null));
    }
    draw();
  }

  // =============================================================== new booking (phone / walk-in)
  async function newBooking(pre = {}, onDone) {
    const staff = (await api.get('/staff')).filter((s) => s.active);
    let sp;
    const picker = await servicePicker(() => sp && sp.refresh(), pre.services || []);
    sp = slotPicker({ services: picker.ids, init: { date: pre.date || viewDate, time: pre.time, staff: pre.staff }, staff });
    const info = buildForm([T('name', 'Client name', { half: 1 }), T('phone', 'Phone', { half: 1 }), T('email', 'Email (optional)', { half: 1 }), T('status', 'Status', { type: 'select', half: 1, options: [{ v: 'confirmed', l: 'Confirmed' }, { v: 'pending', l: 'Awaiting approval' }] }), T('notes', 'Notes (optional)', { type: 'textarea', rows: 2 })], { status: 'confirmed' });
    const notify = h('input', { type: 'checkbox', checked: true });
    const dlg = modal({ title: 'New booking', wide: true, body: h('div', {}, picker.el, h('h3', { class: 'sect' }, 'Date & time'), sp.el, h('h3', { class: 'sect' }, 'Client'), info.el, h('label', { class: 'switch' }, notify, h('i'), h('span', {}, 'Email a confirmation if an address is given'))),
      foot: [h('button', { class: 'btn', onclick: () => dlg.close() }, 'Cancel'), h('button', { class: 'btn primary', onclick: async (e) => {
        const v = sp.get(), c = info.get();
        if (!picker.ids().length) return toast('Choose at least one service.', 'err');
        if (!v.time) return toast('Choose a time.', 'err');
        e.currentTarget.disabled = true;
        try { const r = await api.post('/bookings', { services: picker.ids(), ...v, ...c, notify: notify.checked }); dlg.close(); toast(`Booking ${r.reference} created.`); onDone && onDone(r); } catch (x) { fail(x); e.currentTarget.disabled = false; }
      } }, icon('check'), 'Create booking')] });
    sp.refresh();
  }

  // =============================================================== appointments page
  PAGES.bookings = { title: 'Appointments', render: async (el) => {
    const q = qparams();
    let view = q.get('scope') ? 'list' : (sessionStorage.getItem('elx_bkview') || 'day'), scope = q.get('scope') || 'upcoming', search = '';
    const box = h('div', { id: 'bkView' });
    const tabs = h('div', { class: 'tabs' });
    const toolbar = h('div', { class: 'card-head' }, h('div', { class: 'tabs', style: 'margin:0' }, ...[['day', 'Day schedule'], ['list', 'All appointments']].map(([k, l]) => h('button', { class: view === k ? 'on' : '', 'data-v': k, onclick: (e) => { view = k; sessionStorage.setItem('elx_bkview', k); [...e.currentTarget.parentNode.children].forEach((b) => b.classList.toggle('on', b === e.currentTarget)); draw(); } }, l))),
      h('button', { class: 'btn primary', onclick: () => newBooking({ date: viewDate }, draw) }, icon('plus'), 'New booking'));
    el.append(page(toolbar, box));

    async function draw() { view === 'day' ? await drawDay() : await drawList(); }

    // ---------- day timeline ----------
    async function drawDay() {
      const data = await api.get(`/bookings/day${viewDate ? '?date=' + viewDate : ''}`);
      viewDate = data.date; serverToday = data.today.date;
      const PX = 1.3, open = data.open;
      let from = open ? toMin(open.from) : 9 * 60, to = open ? toMin(open.to) : 17 * 60;
      data.bookings.forEach((b) => { from = Math.min(from, b.startMin); to = Math.max(to, b.endMin); });
      from = Math.floor(from / 60) * 60; to = Math.ceil(to / 60) * 60;
      const cols = [...data.staff];
      if (data.bookings.some((b) => !b.staffId || !cols.find((s) => s.id === b.staffId))) cols.push({ id: 0, name: 'Unassigned', title: '', working: true });
      const H = (to - from) * PX, y = (m) => (m - from) * PX;
      const hoursEl = h('div', { class: 'tl-gutter', style: `height:${H}px` }, ...Array.from({ length: (to - from) / 60 }, (_, i) => h('span', { style: `top:${i * 60 * PX + 3}px` }, t12(fromMin(from + i * 60)).replace(':00', ''))));
      const dayMin = (stamp, side) => { const d = stamp.slice(0, 10); return d < data.date ? 0 : d > data.date ? 1440 : toMin(stamp.slice(11, 16)); };
      const colEls = cols.map((s) => {
        const col = h('div', { class: 'tl-col' + (s.working === false ? ' off' : ''), style: `height:${H}px;--hr:${60 * PX}px` });
        if (!open || s.working === false) col.append(h('div', { class: 'tl-shade', style: 'top:0;bottom:0' }, !open ? 'Closed' : 'Day off'));
        else { if (toMin(open.from) > from) col.append(h('div', { class: 'tl-shade', style: `top:0;height:${y(toMin(open.from))}px` })); if (toMin(open.to) < to) col.append(h('div', { class: 'tl-shade', style: `top:${y(toMin(open.to))}px;bottom:0` })); }
        data.blocks.filter((k) => k.staff_id === null || k.staff_id === s.id).forEach((k) => { const a = Math.max(from, dayMin(k.starts_at)), z = Math.min(to, dayMin(k.ends_at)); if (z > a) col.append(h('div', { class: 'tl-block', style: `top:${y(a)}px;height:${(z - a) * PX}px`, title: k.reason || 'Closed' }, k.reason || 'Closed')); });
        data.bookings.filter((b) => (b.staffId || 0) === s.id || (s.id === 0 && !cols.find((c) => c.id === b.staffId))).forEach((b) => {
          const hgt = Math.max(26, (b.endMin - b.startMin) * PX - 2);
          col.append(h('button', { class: `tl-b st-${b.status}`, style: `top:${y(b.startMin)}px;height:${hgt}px`, onclick: (e) => { e.stopPropagation(); openBooking(b.id, draw); } }, h('b', {}, `${t12(b.start)} – ${t12(b.end)}`), h('span', {}, b.name), hgt > 52 ? h('small', {}, b.items.map((i) => i.name).join(', ')) : null));
        });
        if (data.date === data.today.date && data.today.minutes >= from && data.today.minutes <= to) col.append(h('div', { class: 'tl-now', style: `top:${y(data.today.minutes)}px` }));
        col.addEventListener('click', (e) => { if (e.target !== col && !e.target.classList.contains('tl-shade')) return; const m = Math.floor((from + e.offsetY / PX) / 15) * 15; newBooking({ date: data.date, time: fromMin(m), staff: s.id || undefined }, draw); });
        return col;
      });
      const nav = h('div', { class: 'daynav' },
        h('button', { class: 'btn icon', 'aria-label': 'Previous day', onclick: () => { viewDate = addDays(data.date, -1); drawDay(); } }, icon('left')),
        h('button', { class: 'btn', onclick: () => { viewDate = data.today.date; drawDay(); } }, 'Today'),
        h('button', { class: 'btn icon', 'aria-label': 'Next day', onclick: () => { viewDate = addDays(data.date, 1); drawDay(); } }, icon('right')),
        h('input', { class: 'in', type: 'date', value: data.date, style: 'max-width:170px', onchange: (e) => { if (e.target.value) { viewDate = e.target.value; drawDay(); } } }),
        h('div', { class: 'daytitle' }, h('b', {}, longDate(data.date)), h('span', { class: 'hint' }, `${open ? `Open ${t12(open.from)} – ${t12(open.to)}` : 'Closed'} · ${data.bookings.length} appointment${data.bookings.length === 1 ? '' : 's'}`)));
      box.replaceChildren(h('section', { class: 'card' }, nav,
        cols.length ? h('div', { class: 'tl-scroll' }, h('div', { class: 'tl', style: `grid-template-columns:56px repeat(${cols.length}, minmax(170px, 1fr))` },
          h('div', { class: 'tl-h' }), ...cols.map((s) => h('div', { class: 'tl-h' }, s.name, s.title ? h('small', {}, s.title) : null)),
          h('div', { class: 'tl-gcell' }, hoursEl), ...colEls.map((c) => h('div', { class: 'tl-ccell' }, c)))) : empty('Add specialists first (Bookings > Specialists) to see the schedule.'),
        h('p', { class: 'hint', style: 'margin:10px 0 0' }, 'Tip: click an empty spot in a column to add a booking at that time.')));
    }

    // ---------- list ----------
    async function drawList() {
      const data = await api.get(`/bookings?scope=${scope}&q=${encodeURIComponent(search)}`);
      tabs.replaceChildren(...[['upcoming', 'Upcoming'], ['pending', 'Awaiting approval'], ['today', 'Today'], ['past', 'Past'], ['cancelled', 'Cancelled'], ['all', 'All']].map(([k, l]) => h('button', { class: scope === k ? 'on' : '', onclick: () => { scope = k; drawList(); } }, l)));
      const searchBox = h('input', { class: 'in', type: 'search', placeholder: 'Search name, phone, email or reference…', value: search, style: 'max-width:340px', oninput: (e) => { search = e.target.value; clearTimeout(searchBox.t); searchBox.t = setTimeout(drawList, 280); } });
      let last = '';
      const rows = [];
      data.forEach((b) => {
        if (b.date !== last) { last = b.date; rows.push(h('div', { class: 'bk-day' }, longDate(b.date))); }
        rows.push(h('button', { class: 'bkrow', onclick: () => openBooking(b.id, drawList) },
          h('div', { class: 'when' }, h('b', {}, `${t12(b.start)}`), h('span', {}, dur(b.duration))),
          h('div', { class: 'who' }, h('b', {}, b.name), h('small', {}, b.phone)),
          h('div', { class: 'what' }, b.items.map((i) => i.name).join(', '), h('small', {}, `${b.staffName || 'Unassigned'} · ${b.reference}`)),
          pill(b.status)));
      });
      box.replaceChildren(h('section', { class: 'card' }, tabs, h('div', { style: 'margin-bottom:14px' }, searchBox), rows.length ? h('div', { class: 'bklist' }, ...rows) : empty(search ? 'No bookings match your search.' : 'No bookings here yet.')));
      if (document.activeElement === document.body && search) searchBox.focus();
    }

    await draw();
    if (q.get('new')) { history.replaceState({}, '', '#/bookings'); newBooking({ date: viewDate }, draw); }
    // keep the front desk screen fresh without reloading
    const timer = setInterval(() => { if (!document.getElementById('bkView')) return clearInterval(timer); if (!document.hidden && !document.querySelector('dialog.modal[open]')) draw().catch(() => {}); }, 60000);
  } };

  // =============================================================== schedule settings
  PAGES.schedule = { title: 'Schedule & hours', render: (el) => el.append(page(
    lede('Your opening hours, how clients book, and the rules that protect your calendar. These settings drive the booking window on your website.'),
    settingsCard('scheduling', 'Hours & rules'), settingsCard('bookingUi', 'Booking window wording', 'Every word clients see while booking.'))) };

  // =============================================================== specialists
  const DAYS = [[1, 'Mon'], [2, 'Tue'], [3, 'Wed'], [4, 'Thu'], [5, 'Fri'], [6, 'Sat'], [0, 'Sun']];
  PAGES.specialists = { title: 'Specialists', render: async (el) => {
    const list = h('div', { class: 'rows' });
    async function edit(s = {}) {
      const cats = await api.get('/categories');
      const f = buildForm([T('name', 'Name', { half: 1 }), T('title', 'Role', { half: 1, hint: 'e.g. Senior stylist' }), T('photo', 'Photo', { type: 'image' }),
        T('active', 'Active – takes appointments', { type: 'bool' }), T('selectable', 'Clients can choose this person when booking', { type: 'bool', hint: 'Off: they take appointments but clients only see “Any available”.' })], { active: s.id ? !!s.active : true, ...s, selectable: !!s.selectable });
      const days = new Set(s.id ? s.work_days : [0, 1, 2, 3, 4, 5, 6]);
      const dayBoxes = DAYS.map(([d, l]) => { const i = h('input', { type: 'checkbox', checked: days.has(d), onchange: (e) => (e.target.checked ? days.add(d) : days.delete(d)) }); return h('label', { class: 'check' }, i, h('span', {}, l)); });
      const picked = new Set(s.categories || cats.map((c) => c.id));
      const catBoxes = cats.map((c) => h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: picked.has(c.id), onchange: (e) => (e.target.checked ? picked.add(c.id) : picked.delete(c.id)) }), h('span', {}, c.name)));
      const dlg = modal({ title: s.id ? 'Edit specialist' : 'Add specialist', wide: true, body: h('div', {}, f.el, h('div', { class: 'f' }, h('label', {}, 'Works on'), h('div', { class: 'checks' }, ...dayBoxes)), h('div', { class: 'f' }, h('label', {}, 'Can perform'), h('div', { class: 'checks' }, ...catBoxes), h('div', { class: 'hint' }, 'A booking is only offered with someone who can perform every selected service.'))),
        foot: [h('button', { class: 'btn', onclick: () => dlg.close() }, 'Cancel'), h('button', { class: 'btn primary', onclick: async () => {
          const d = f.get(); if (!d.name.trim()) return toast('Please enter a name.', 'err');
          if (!picked.size) return toast('Choose at least one service group.', 'err'); if (!days.size) return toast('Choose at least one working day.', 'err');
          try { const body = { ...d, categories: [...picked], work_days: [...days] }; s.id ? await api.put('/staff/' + s.id, body) : await api.post('/staff', body); dlg.close(); toast('Saved.'); load(); } catch (e) { fail(e); }
        } }, 'Save')] });
    }
    const initials = (n) => n.trim().split(/\s+/).slice(0, 2).map((x) => x[0]).join('').toUpperCase();
    async function load() {
      const staff = await api.get('/staff');
      const saveOrder = () => api.post('/staff/reorder', { ids: [...list.children].map((c) => c.dataset.id) }).catch(fail);
      list.replaceChildren(...(staff.length ? staff.map((s) => {
        const row = h('div', { class: 'row', 'data-id': s.id },
          h('div', { class: 'mv' }, h('button', { class: 'mini', 'aria-label': 'Up', onclick: () => A.move(row, -1) && saveOrder() }, icon('up')), h('button', { class: 'mini', 'aria-label': 'Down', onclick: () => A.move(row, 1) && saveOrder() }, icon('down'))),
          h('div', { class: 'avatar', style: s.photo ? `background:url('${s.photo}') center/cover` : '' }, s.photo ? '' : initials(s.name)),
          h('div', { style: 'flex:1;min-width:0' }, h('b', {}, s.name), h('span', { class: 'hint', style: 'margin-left:8px' }, s.title), h('div', { style: 'margin-top:6px;display:flex;gap:6px;flex-wrap:wrap' }, h('span', { class: 'pill ' + (s.active ? 'approved' : 'hidden') }, s.active ? 'Active' : 'Inactive'), h('span', { class: 'pill ' + (s.selectable ? 'confirmed' : 'read') }, s.selectable ? 'Clients can choose' : 'Shown as “Any available”'), h('span', { class: 'hint' }, DAYS.filter(([d]) => s.work_days.includes(d)).map(([, l]) => l).join(' · ')))),
          h('div', { class: 'tail' }, h('button', { class: 'btn sm', onclick: () => edit(s) }, 'Edit'), h('button', { class: 'mini x', 'aria-label': 'Delete', onclick: async () => { if (await confirmBox(`Delete ${s.name}?`)) { try { await api.del('/staff/' + s.id); load(); } catch (e) { fail(e); } } } }, icon('trash'))));
        return row;
      }) : [empty('No specialists yet. Add your team so clients can book.')]));
    }
    el.append(page(lede('The people (or chairs) who can take appointments at the same time. The number of active specialists is how many clients you can look after at once.'),
      card(null, null, h('div', { class: 'actions' }, h('button', { class: 'btn primary', onclick: () => edit() }, icon('plus'), 'Add specialist')), list),
      h('div', { class: 'callout' }, icon('circlecheck'), h('div', {}, h('b', {}, 'Getting started. '), 'Your site starts with four unnamed workstations. Rename them to real people and switch on “Clients can choose”, or leave them as they are so clients simply pick “Any available”.'))));
    load().catch(fail);
  } };

  // =============================================================== closures & time off
  PAGES.closures = { title: 'Closures & time off', render: async (el) => {
    const staff = (await api.get('/staff')).filter((s) => s.active);
    const list = h('div', { class: 'rows' });
    let showPast = false;
    const who = h('select', { class: 'in' }, h('option', { value: '' }, 'Whole salon'), ...staff.map((s) => h('option', { value: s.id }, s.name)));
    const d1 = h('input', { class: 'in', type: 'date' }), d2 = h('input', { class: 'in', type: 'date' });
    const t1 = h('input', { class: 'in', type: 'time', value: '12:00' }), t2 = h('input', { class: 'in', type: 'time', value: '14:00' });
    const why = h('input', { class: 'in', type: 'text', placeholder: 'e.g. Public holiday, training, annual leave', maxlength: 200 });
    const allDay = h('input', { type: 'checkbox', checked: true });
    const timesRow = h('div', { class: 'grid2', style: 'display:none' }, h('div', { class: 'f' }, h('label', {}, 'From'), t1), h('div', { class: 'f' }, h('label', {}, 'Until'), t2));
    allDay.addEventListener('change', () => { timesRow.style.display = allDay.checked ? 'none' : ''; });
    async function load() {
      const blocks = await api.get('/blocks' + (showPast ? '?scope=past' : ''));
      list.replaceChildren(...(blocks.length ? blocks.map((b) => {
        const s = b.starts_at, e = b.ends_at, sd = s.slice(0, 10), ed = e.slice(0, 10), whole = s.slice(11, 16) === '00:00' && e.slice(11, 16) === '00:00';
        const last = whole ? addDays(ed, -1) : ed;
        const range = whole ? (sd === last ? shortDate(sd) : `${shortDate(sd)} – ${shortDate(last)}`) : (sd === ed ? `${shortDate(sd)}, ${t12(s.slice(11, 16))} – ${t12(e.slice(11, 16))}` : `${shortDate(sd)} ${t12(s.slice(11, 16))} – ${shortDate(ed)} ${t12(e.slice(11, 16))}`);
        return h('div', { class: 'row' }, h('div', { style: 'flex:1' }, h('b', {}, range), h('div', { class: 'hint' }, `${b.staff_name || 'Whole salon'}${b.reason ? ' · ' + b.reason : ''}`)), h('div', { class: 'tail' }, h('button', { class: 'mini x', 'aria-label': 'Remove', onclick: async () => { try { await api.del('/blocks/' + b.id); load(); } catch (x) { fail(x); } } }, icon('trash'))));
      }) : [empty(showPast ? 'No past closures.' : 'No upcoming closures.')]));
    }
    el.append(page(lede('Block out public holidays, training days, leave or a lunch break. Clients can never book a blocked time.'),
      card('Add a closure or time off', null,
        h('div', { class: 'grid2' }, h('div', { class: 'f' }, h('label', {}, 'Who is away?'), who), h('div', { class: 'f' }, h('label', {}, 'Reason (optional)'), why), h('div', { class: 'f' }, h('label', {}, 'From date'), d1), h('div', { class: 'f' }, h('label', {}, 'Until date (optional)'), d2)),
        h('label', { class: 'switch', style: 'margin-bottom:12px' }, allDay, h('i'), h('span', {}, 'All day')), timesRow,
        h('div', { class: 'savebar' }, h('button', { class: 'btn primary', onclick: async () => {
          try { const r = await api.post('/blocks', { staff_id: who.value, from_date: d1.value, to_date: d2.value || d1.value, all_day: allDay.checked, from_time: t1.value, to_time: t2.value, reason: why.value }); toast(r.conflicts ? `Added. Note: ${r.conflicts} existing appointment${r.conflicts > 1 ? 's' : ''} fall${r.conflicts > 1 ? '' : 's'} in this period – review them in Appointments.` : 'Closure added.', r.conflicts ? 'err' : undefined); d1.value = ''; d2.value = ''; why.value = ''; load(); } catch (e) { fail(e); }
        } }, icon('plus'), 'Add closure'))),
      card(null, null, h('div', { class: 'tabs' }, h('button', { class: 'on', onclick: (e) => { showPast = false; [...e.currentTarget.parentNode.children].forEach((b, i) => b.classList.toggle('on', i === 0)); load(); } }, 'Upcoming'), h('button', { onclick: (e) => { showPast = true; [...e.currentTarget.parentNode.children].forEach((b, i) => b.classList.toggle('on', i === 1)); load(); } }, 'Past')), list)));
    load().catch(fail);
  } };

  // =============================================================== email health + templates
  PAGES.email = { title: 'Email', owner: true, render: async (el) => {
    const status = h('div', { class: 'callout', style: 'background:#f3f0e4;border-color:var(--line-strong);color:var(--ink)' }, 'Checking connection…');
    const logBox = h('div');
    const to = h('input', { class: 'in', type: 'text', placeholder: 'you@example.com', style: 'max-width:260px' });
    async function verify() {
      status.replaceChildren('Checking connection…');
      try {
        const v = await api.post('/email/verify', {});
        status.style.background = v.ok ? '#e6f4ea' : '#fdecea'; status.style.borderColor = v.ok ? '#b8dec3' : '#efb8b2'; status.style.color = v.ok ? '#14562f' : '#7a1812';
        status.replaceChildren(icon(v.ok ? 'circlecheck' : 'ban'), h('div', {}, h('b', {}, v.ok ? 'Email is connected. ' : 'Email is not working. '), v.ok ? `Sending as ${v.from} through ${v.host}:${v.port}. Replies go to the Reply-To address below.` : v.error));
      } catch (e) { status.replaceChildren(e.message); }
    }
    async function loadLog() {
      const rows = await api.get('/email/log');
      logBox.replaceChildren(rows.length ? h('div', { class: 'tscroll' }, h('table', { class: 't stack' }, h('thead', {}, h('tr', {}, ...['When', 'To', 'Subject', 'Result'].map((x) => h('th', {}, x)))), h('tbody', {}, ...rows.map((r) => h('tr', {}, h('td', {}, fmtDate(r.created_at)), h('td', {}, r.to_addr), h('td', {}, r.subject), h('td', {}, h('span', { class: 'pill ' + (r.status === 'sent' ? 'approved' : r.status === 'failed' ? 'hidden' : 'read') }, r.status), r.error ? h('div', { class: 'hint' }, r.error) : null)))))) : empty('No emails sent yet.'));
    }
    el.append(page(lede('Everything the website emails: booking confirmations, reminders, replies to forms, and alerts to your team.'),
      status,
      card('Test it', 'Send yourself a test message to confirm delivery.', h('div', { style: 'display:flex;gap:10px;flex-wrap:wrap' }, to, h('button', { class: 'btn', onclick: async (e) => { e.currentTarget.disabled = true; try { await api.post('/email/test', { to: to.value }); toast('Test email sent.'); loadLog(); } catch (x) { fail(x); } finally { e.currentTarget.disabled = false; } } }, icon('send'), 'Send test'), h('button', { class: 'btn', onclick: verify }, icon('refresh'), 'Re-check connection'))),
      settingsCard('email', 'Addresses & email wording'),
      card('Recent deliveries', 'The last 40 emails and whether the mail server accepted them.', logBox)));
    verify(); loadLog();
  } };
})();
