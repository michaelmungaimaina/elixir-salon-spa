/* Elixir admin – core utilities & UI kit (no build step, no dependencies) */
window.A = (() => {
  'use strict';

  // ---------- DOM builder (text is always inserted as text – safe for user-submitted content) ----------
  const h = (tag, attrs, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === false || v == null) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v; // only used for our own static SVG
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else if (k === 'checked' || k === 'disabled' || k === 'selected') el[k] = !!v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    const add = (k) => { if (k == null || k === false) return; if (Array.isArray(k)) k.forEach(add); else el.append(k.nodeType ? k : document.createTextNode(k)); };
    kids.forEach(add);
    return el;
  };
  const $ = (s, r = document) => r.querySelector(s);

  // ---------- icons (inline so the admin never depends on a CDN) ----------
  const P = {
    dash: 'M3 12l9-8 9 8M5 10v10h5v-6h4v6h5V10',
    home: 'M3 12l9-8 9 8M5 10v10h14V10',
    user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0',
    users: 'M9 11a4 4 0 100-8 4 4 0 000 8zM2 21a7 7 0 0114 0M17 11a3 3 0 100-6M22 21a6 6 0 00-4-5.6',
    scissors: 'M6 9a3 3 0 100-6 3 3 0 000 6zM6 21a3 3 0 100-6 3 3 0 000 6zM20 4L8.1 15.9M14.5 14.5L20 20M8.1 8.1L12 12',
    image: 'M4 5h16v14H4zM8.5 10a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM20 15l-5-5L5 19',
    tag: 'M20.6 13.4l-7.2 7.2a2 2 0 01-2.8 0L3 13V3h10l7.6 7.6a2 2 0 010 2.8zM7.5 7.5h.01',
    star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
    mail: 'M3 5h18v14H3zM3 7l9 6 9-6',
    brief: 'M3 7h18v13H3zM8 7V4h8v3M3 13h18',
    folder: 'M3 6h6l2 2h10v11H3z',
    gear: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z',
    menu: 'M4 7h16M4 12h16M4 17h16',
    plus: 'M12 5v14M5 12h14',
    trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
    up: 'M6 15l6-6 6 6', down: 'M6 9l6 6 6-6', left: 'M15 6l-6 6 6 6', right: 'M9 6l6 6-6 6',
    x: 'M6 6l12 12M18 6L6 18',
    ext: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
    upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
    check: 'M5 12l5 5 9-10',
    out: 'M9 4H4v16h5M16 8l4 4-4 4M20 12H9',
    shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
    nav: 'M4 6h16M4 12h10M4 18h16',
    lock: 'M6 11h12v9H6zM8 11V8a4 4 0 118 0v3',
    palette: 'M12 3a9 9 0 100 18c1.4 0 2-1 1.5-2.2-.5-1.2.2-2.3 1.5-2.3H17a4 4 0 004-4c0-5-4-9.5-9-9.5z',
    download: 'M12 4v12M7 11l5 5 5-5M4 20h16',
    copy: 'M8 8h12v12H8zM4 16V4h12',
    play: 'M8 5l11 7-11 7z',
    calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
    clock: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2',
    grip: 'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01',
    ban: 'M12 21a9 9 0 100-18 9 9 0 000 18zM5.6 5.6l12.8 12.8',
    send: 'M22 2L11 13M22 2l-7 20-4-9-9-4z',
    refresh: 'M20 11a8 8 0 10-2.3 6M20 4v7h-7',
    circlecheck: 'M12 21a9 9 0 100-18 9 9 0 000 18zM8 12l3 3 5-6',
    minus: 'M5 12h14',
    phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z',
  };
  const icon = (n) => h('span', { html: `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="${P[n] || P.tag}"/></svg>` });

  // ---------- API ----------
  async function api(method, path, body) {
    const opts = { method, headers: { 'X-Requested-With': 'elixir-admin' }, credentials: 'same-origin' };
    if (body instanceof FormData) opts.body = body;
    else if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    const r = await fetch('/api/admin' + path, opts);
    const j = await r.json().catch(() => ({}));
    if (r.status === 401 && !path.startsWith('/login') && !path.startsWith('/setup')) { A.onUnauthorized?.(); throw new Error(j.error || 'Please sign in.'); }
    if (!r.ok) { const e = new Error(j.error || 'Something went wrong.'); e.data = j; e.status = r.status; throw e; }
    return j;
  }
  api.get = (p) => api('GET', p); api.post = (p, b) => api('POST', p, b); api.put = (p, b) => api('PUT', p, b); api.patch = (p, b) => api('PATCH', p, b); api.del = (p) => api('DELETE', p);

  // ---------- toast / modal / confirm ----------
  function toast(msg, type) {
    const t = h('div', { class: 'toast' + (type === 'err' ? ' err' : ''), role: 'status' }, msg);
    $('#toasts').append(t); setTimeout(() => t.remove(), type === 'err' ? 6000 : 3200);
  }
  const fail = (e) => toast(e.message || 'Something went wrong.', 'err');

  function modal({ title, body, foot, wide, onClose }) {
    const dlg = h('dialog', { class: 'modal' + (wide ? ' wide' : '') },
      h('div', { class: 'm-head' }, h('h3', {}, title), h('button', { class: 'btn icon sm', 'aria-label': 'Close', onclick: () => dlg.close() }, icon('x'))),
      h('div', { class: 'm-body' }, body), foot ? h('div', { class: 'm-foot' }, foot) : null);
    dlg.addEventListener('close', () => { dlg.remove(); onClose?.(); });
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
    document.body.append(dlg); dlg.showModal();
    return dlg;
  }
  function confirmBox(message, { okLabel = 'Delete', danger = true, title = 'Are you sure?' } = {}) {
    return new Promise((resolve) => {
      let done = false;
      const finish = (v) => { done = true; dlg.close(); resolve(v); };
      const dlg = modal({ title, body: h('p', { style: 'margin:0' }, message),
        foot: [h('button', { class: 'btn', onclick: () => finish(false) }, 'Cancel'), h('button', { class: 'btn ' + (danger ? 'danger' : 'primary'), onclick: () => finish(true) }, okLabel)],
        onClose: () => { if (!done) resolve(false); } });
    });
  }

  // ---------- drag-and-drop reordering (desktop) – arrow buttons cover touch ----------
  function sortable(container, itemSel, onDrop) {
    let drag = null;
    container.addEventListener('dragstart', (e) => { const it = e.target.closest(itemSel); if (!it || !container.contains(it)) return; drag = it; it.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', ''); } catch { /* */ } });
    container.addEventListener('dragover', (e) => { if (!drag) return; e.preventDefault(); const over = e.target.closest(itemSel); container.querySelectorAll('.dropline').forEach((n) => n.classList.remove('dropline')); if (over && over !== drag) over.classList.add('dropline'); });
    container.addEventListener('drop', (e) => { if (!drag) return; e.preventDefault(); const over = e.target.closest(itemSel); if (over && over !== drag) over.before(drag); end(); onDrop([...container.querySelectorAll(itemSel)]); });
    container.addEventListener('dragend', end);
    function end() { container.querySelectorAll('.dropline').forEach((n) => n.classList.remove('dropline')); drag?.classList.remove('dragging'); drag = null; }
  }
  function move(el, dir) { const sib = dir < 0 ? el.previousElementSibling : el.nextElementSibling; if (!sib) return false; dir < 0 ? sib.before(el) : sib.after(el); return true; }

  // ---------- Media picker ----------
  const isVideo = (u) => /\.(mp4|webm)$/i.test(u || '');
  // Video thumbnails load only when scrolled into view (a library can hold dozens of videos)
  const vio = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.src = e.target.dataset.src; vio.unobserve(e.target); } }), { rootMargin: '200px' });
  const lazyVideo = (url) => { const v = h('video', { muted: true, preload: 'metadata', playsinline: true, 'data-src': url + '#t=0.4' }); vio.observe(v); return v; };
  const thumb = (url, cls = 'thumb') => h('div', { class: cls }, url ? (isVideo(url) ? lazyVideo(url) : h('img', { src: url, alt: '', loading: 'lazy' })) : 'No image');
  const fmtSize = (n) => (n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');

  function uploadFiles(files, onProgress) {
    return new Promise((resolve, reject) => {
      const fd = new FormData(); [...files].forEach((f) => fd.append('files', f));
      const x = new XMLHttpRequest(); x.open('POST', '/api/admin/media'); x.setRequestHeader('X-Requested-With', 'elixir-admin');
      x.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
      x.onload = () => { let j = {}; try { j = JSON.parse(x.responseText); } catch { /* */ } x.status < 300 ? resolve(j) : reject(new Error(j.error || 'Upload failed.')); };
      x.onerror = () => reject(new Error('Upload failed – check your connection.'));
      x.send(fd);
    });
  }

  // Reusable upload dropzone (used by the media library and the picker)
  function dropzone(onDone, accept = 'image/*,video/*') {
    const bar = h('i'), prog = h('div', { class: 'progress hide' }, bar);
    const input = h('input', { type: 'file', multiple: true, accept, class: 'hide' });
    const zone = h('div', { class: 'drop' }, h('div', {}, 'Drag photos or videos here, or '), h('button', { class: 'btn primary sm', style: 'margin-top:10px', onclick: () => input.click() }, icon('upload'), 'Choose files'),
      h('div', { class: 'hint', style: 'font-size:.8rem;margin-top:8px' }, 'JPG, PNG, WEBP, GIF · MP4, WEBM (up to 80 MB each)'), prog, input);
    async function go(files) {
      if (!files.length) return;
      prog.classList.remove('hide'); bar.style.width = '0';
      try { const r = await uploadFiles(files, (p) => (bar.style.width = (p * 100) + '%')); toast(`${r.uploaded.length} file(s) uploaded`); await onDone(r.uploaded); }
      catch (e) { fail(e); } finally { prog.classList.add('hide'); input.value = ''; }
    }
    input.addEventListener('change', () => go(input.files));
    ['dragenter', 'dragover'].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.remove('over'); }));
    zone.addEventListener('drop', (e) => go(e.dataTransfer.files));
    return zone;
  }

  // Returns Promise<string[] | null>
  function pickMedia({ multiple = false, kind = 'image' } = {}) {
    return new Promise((resolve) => {
      let items = [], filter = kind === 'any' ? 'all' : kind, selected = [], settled = false;
      const grid = h('div', { class: 'mgrid' }), count = h('span', { class: 'hint' });
      const urlIn = h('input', { class: 'in', type: 'text', placeholder: 'https://… (link to an image hosted elsewhere)' });
      const doneBtn = h('button', { class: 'btn primary', onclick: () => finish(selected) }, 'Use selected');
      const finish = (v) => { settled = true; dlg.close(); resolve(v && v.length ? v : null); };
      function draw() {
        const list = items.filter((m) => filter === 'all' || m.kind === filter);
        grid.replaceChildren(...list.map((m) => {
          const t = h('button', { class: 'mtile' + (selected.includes(m.url) ? ' sel' : ''), title: m.original_name, onclick: () => {
            if (multiple) selected = selected.includes(m.url) ? selected.filter((u) => u !== m.url) : [...selected, m.url]; else selected = [m.url];
            if (!multiple) return finish(selected);
            draw();
          } }, m.kind === 'video' ? lazyVideo(m.url) : h('img', { src: m.url, alt: '', loading: 'lazy' }), h('span', { class: 'ck' }, icon('check')), m.kind === 'video' ? h('span', { class: 'kind' }, 'video') : null);
          return t;
        }));
        if (!list.length) grid.replaceChildren(h('div', { class: 'empty', style: 'grid-column:1/-1' }, 'Nothing here yet – upload some files above.'));
        count.textContent = multiple ? `${selected.length} selected` : '';
        doneBtn.disabled = !selected.length;
      }
      async function load() { items = await api.get('/media'); draw(); }
      const filters = kind === 'any' ? h('div', { class: 'tabs' }, ...[['all', 'All'], ['image', 'Photos'], ['video', 'Videos']].map(([k, l]) => h('button', { class: filter === k ? 'on' : '', onclick: (e) => { filter = k; [...e.target.parentNode.children].forEach((b) => b.classList.toggle('on', b === e.target)); draw(); } }, l))) : null;
      const dlg = modal({ title: multiple ? 'Choose files' : 'Choose a file', wide: true,
        body: [dropzone(async (urls) => { await load(); if (urls.length) { selected = multiple ? [...selected, ...urls] : [urls[0]]; if (!multiple) return finish(selected); draw(); } }, kind === 'image' ? 'image/*' : 'image/*,video/*'), filters, grid,
          h('div', { class: 'f', style: 'margin-top:18px' }, h('label', {}, 'Or use a link'), h('div', { style: 'display:flex;gap:8px' }, urlIn, h('button', { class: 'btn', onclick: () => urlIn.value.trim() && finish([urlIn.value.trim()]) }, 'Use link')))],
        foot: [count, h('button', { class: 'btn', onclick: () => dlg.close() }, 'Cancel'), multiple ? doneBtn : null], onClose: () => { if (!settled) resolve(null); } });
      load().catch(fail);
    });
  }

  // ---------- Form builder (schema → fields) ----------
  // field: {k,label,type,hint,half,rows,options,cols,fixed,placeholder}
  function buildField(f, value) {
    let get, node;
    const wrap = (inner, labelFor) => h('div', { class: 'f' + (f.half ? '' : ' full') }, f.label ? h(labelFor ? 'label' : 'div', { class: labelFor ? '' : 'lbl' }, f.label) : null, inner, f.hint ? h('div', { class: 'hint' }, f.hint) : null);
    const v = value;
    switch (f.type) {
      case 'textarea': { const el = h('textarea', { rows: f.rows || 4, placeholder: f.placeholder || '', value: v ?? '' }); get = () => el.value; node = wrap(el, true); break; }
      case 'heading': { node = h('div', { class: 'f full fh' }, h('h3', {}, f.label), f.hint ? h('p', { class: 'hint' }, f.hint) : null); get = () => undefined; break; }
      case 'number': { const el = h('input', { type: 'number', min: f.min, max: f.max, step: f.step || 1, inputmode: 'numeric', value: v ?? '' }); get = () => (el.value === '' ? '' : Number(el.value)); node = wrap(el, true); break; }
      case 'bool': { const el = h('input', { type: 'checkbox', checked: !!v }); get = () => el.checked; node = h('div', { class: 'f' + (f.half ? '' : ' full') }, h('label', { class: 'switch' }, el, h('i'), h('span', {}, f.label)), f.hint ? h('div', { class: 'hint' }, f.hint) : null); break; }
      case 'color': { const c = h('input', { type: 'color', value: v || '#000000' }), t = h('input', { class: 'in', type: 'text', value: v || '', maxlength: 7, style: 'max-width:130px' }); c.addEventListener('input', () => (t.value = c.value)); t.addEventListener('input', () => /^#[0-9a-f]{6}$/i.test(t.value) && (c.value = t.value)); get = () => t.value; node = wrap(h('div', { class: 'colorrow' }, c, t)); break; }
      case 'select': { const el = h('select', {}, ...f.options.map((o) => h('option', { value: o.v ?? o, selected: (o.v ?? o) === v }, o.l ?? o))); get = () => el.value; node = wrap(el, true); break; }
      case 'image': {
        let cur = v || ''; const box = h('div', { class: 'imgfield' });
        const draw = () => box.replaceChildren(thumb(cur), h('div', { class: 'acts' }, h('button', { class: 'btn sm', type: 'button', onclick: async () => { const r = await pickMedia({ kind: 'image' }); if (r) { cur = r[0]; draw(); } } }, icon('image'), cur ? 'Change' : 'Choose'), cur ? h('button', { class: 'btn sm danger', type: 'button', onclick: () => { cur = ''; draw(); } }, 'Remove') : null));
        draw(); get = () => cur; node = wrap(box); break;
      }
      case 'images': {
        let cur = [...(v || [])]; const box = h('div', { class: 'imgs' });
        const draw = () => box.replaceChildren(...cur.map((u, i) => h('div', { class: 'it' }, thumb(u, ''), h('div', { class: 'tools' },
          h('button', { class: 'mini', type: 'button', 'aria-label': 'Move earlier', disabled: i === 0, onclick: () => { [cur[i - 1], cur[i]] = [cur[i], cur[i - 1]]; draw(); } }, icon('left')),
          h('button', { class: 'mini x', type: 'button', 'aria-label': 'Remove', onclick: () => { cur.splice(i, 1); draw(); } }, icon('trash')),
          h('button', { class: 'mini', type: 'button', 'aria-label': 'Move later', disabled: i === cur.length - 1, onclick: () => { [cur[i + 1], cur[i]] = [cur[i], cur[i + 1]]; draw(); } }, icon('right')))),
          h('button', { class: 'add', type: 'button', onclick: async () => { const r = await pickMedia({ multiple: true, kind: 'image' }); if (r) { cur.push(...r); draw(); } } }, h('div', {}, icon('plus'), h('div', {}, 'Add photos')))));
        draw(); get = () => cur; node = wrap(box); break;
      }
      case 'list': {
        let cur = [...(v || [])]; const box = h('div', { class: 'rows' });
        const draw = () => box.replaceChildren(...cur.map((s, i) => h('div', { class: 'row' }, h('div', { class: 'cols', style: 'grid-template-columns:1fr' }, h('input', { class: 'in', type: 'text', value: s, oninput: (e) => (cur[i] = e.target.value) })),
          h('div', { class: 'tail' }, h('button', { class: 'mini', type: 'button', disabled: i === 0, 'aria-label': 'Up', onclick: () => { [cur[i - 1], cur[i]] = [cur[i], cur[i - 1]]; draw(); } }, icon('up')), h('button', { class: 'mini', type: 'button', disabled: i === cur.length - 1, 'aria-label': 'Down', onclick: () => { [cur[i + 1], cur[i]] = [cur[i], cur[i + 1]]; draw(); } }, icon('down')), h('button', { class: 'mini x', type: 'button', 'aria-label': 'Remove', onclick: () => { cur.splice(i, 1); draw(); } }, icon('trash'))))),
          h('div', {}, h('button', { class: 'btn sm', type: 'button', onclick: () => { cur.push(''); draw(); box.querySelector('.row:last-of-type input')?.focus(); } }, icon('plus'), f.addLabel || 'Add line')));
        draw(); get = () => cur.map((s) => s.trim()).filter(Boolean); node = wrap(box); break;
      }
      case 'rows': {
        let cur = (v || []).map((r) => ({ ...r })); const box = h('div', { class: 'rows' });
        const draw = () => box.replaceChildren(...cur.map((r, i) => h('div', { class: 'row' },
          f.fixed ? null : h('div', { class: 'mv' }, h('button', { class: 'mini', type: 'button', disabled: i === 0, 'aria-label': 'Up', onclick: () => { [cur[i - 1], cur[i]] = [cur[i], cur[i - 1]]; draw(); } }, icon('up')), h('button', { class: 'mini', type: 'button', disabled: i === cur.length - 1, 'aria-label': 'Down', onclick: () => { [cur[i + 1], cur[i]] = [cur[i], cur[i + 1]]; draw(); } }, icon('down'))),
          h('div', { class: 'cols' }, ...f.cols.map((c) => {
            let ctl;
            if (c.type === 'bool') ctl = h('label', { class: 'switch' }, h('input', { type: 'checkbox', checked: !!r[c.k], onchange: (e) => (r[c.k] = e.target.checked) }), h('i'), h('span', {}, c.label));
            else if (c.type === 'static') ctl = h('div', { class: 'static' }, r[c.k]);
            else if (c.type === 'time') ctl = h('input', { class: 'in', type: 'time', value: r[c.k] || '', oninput: (e) => (r[c.k] = e.target.value) });
            else if (c.type === 'number') ctl = h('input', { class: 'in', type: 'number', min: c.min, max: c.max, step: c.step || 1, value: r[c.k] ?? '', oninput: (e) => (r[c.k] = e.target.value === '' ? '' : Number(e.target.value)) });
            else if (c.type === 'select') ctl = h('select', { class: 'in', onchange: (e) => (r[c.k] = e.target.value) }, ...c.options.map((o) => h('option', { value: o.v, selected: o.v === r[c.k] }, o.l)));
            else ctl = h('input', { class: 'in', type: 'text', value: r[c.k] ?? '', placeholder: c.placeholder || '', oninput: (e) => (r[c.k] = e.target.value) });
            return h('div', { class: 'c' + (c.wide ? ' wide' : '') }, c.type === 'bool' || c.type === 'static' ? null : h('small', {}, c.label), ctl);
          })),
          f.fixed ? null : h('div', { class: 'tail' }, h('button', { class: 'mini x', type: 'button', 'aria-label': 'Remove', onclick: () => { cur.splice(i, 1); draw(); } }, icon('trash'))))),
          f.fixed ? null : h('div', {}, h('button', { class: 'btn sm', type: 'button', onclick: () => { cur.push(Object.fromEntries(f.cols.map((c) => [c.k, c.type === 'bool' ? true : c.def ?? '']))); draw(); } }, icon('plus'), f.addLabel || 'Add')));
        draw(); get = () => cur; node = wrap(box); break;
      }
      default: { // text, url, email, date, number
        const el = h('input', { type: f.type === 'date' ? 'date' : 'text', placeholder: f.placeholder || '', value: v ?? '', maxlength: f.max || 600 }); get = () => el.value; node = wrap(el, true);
      }
    }
    return { node, get };
  }

  // schema -> { el, get() }
  function buildForm(schema, data) {
    const fields = schema.map((f) => ({ f, ...buildField(f, data?.[f.k]) }));
    return { el: h('div', { class: 'grid2' }, ...fields.map((x) => x.node)), get: () => Object.fromEntries(fields.filter((x) => x.f.type !== 'heading').map((x) => [x.f.k, x.get()])) };
  }

  const fmtDate = (s) => { if (!s) return ''; const d = new Date(String(s).replace(' ', 'T') + (String(s).includes('T') ? '' : 'Z')); return isNaN(d) ? s : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) + ', ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); };

  const star = (on) => h('span', { html: `<svg class="ic star ${on ? 'on' : ''}" viewBox="0 0 24 24" aria-hidden="true"><path d="${P.star}"/></svg>` });
  const stars = (n) => h('span', { class: 'stars', role: 'img', 'aria-label': `${n} out of 5 stars` }, ...[1, 2, 3, 4, 5].map((i) => star(i <= n)));

  const A = { stars, h, $, icon, api, toast, fail, modal, confirmBox, sortable, move, pickMedia, dropzone, thumb, fmtSize, fmtDate, buildField, buildForm, isVideo, onUnauthorized: null, state: {} };
  return A;
})();
