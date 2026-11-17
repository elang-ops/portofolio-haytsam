'use strict';

/* ==========================================================
   Halaman publik.
   Semua teks diambil dari content.js (window.PORTFOLIO_CONTENT).
   Untuk mengubah kalimat, pakai halaman admin.html, jangan
   edit file ini.
   ========================================================== */

const PREVIEW = new URLSearchParams(location.search).has('pratinjau');

function loadContent() {
  if (PREVIEW) {
    try {
      const draft = localStorage.getItem('hsw-draft');
      if (draft) return JSON.parse(draft);
    } catch (err) { /* pakai versi terbit */ }
  }
  return window.PORTFOLIO_CONTENT;
}

const C = loadContent();

/* ==========================================================
   Konten dinamis
   ========================================================== */
function showPreviewBar() {
  if (!PREVIEW) return;
  const bar = document.createElement('div');
  bar.className = 'preview-bar';
  bar.innerHTML = '<span>Mode pratinjau: ini draf dari halaman admin, belum terbit.</span><a href="admin.html">Kembali ke admin</a>';
  document.body.prepend(bar);
}

function typeRoles(el, roles) {
  if (!el || !roles.length) return;
  if (reduceMotion) { el.textContent = roles[0].toUpperCase(); return; }
  let i = 0, j = 0, deleting = false;
  (function tick() {
    const word = roles[i].toUpperCase();
    el.textContent = word.slice(0, j);
    if (!deleting && j === word.length) { deleting = true; setTimeout(tick, 1700); return; }
    if (deleting && j === 0) { deleting = false; i = (i + 1) % roles.length; setTimeout(tick, 350); return; }
    j += deleting ? -1 : 1;
    setTimeout(tick, deleting ? 30 : 70);
  })();
}

function renderHero() {
  $('#hero-title').textContent = C.hero.name;
  $('#hero-lede').textContent = C.hero.lede;
  document.title = `${C.hero.name} | Portofolio`;

  const items = C.projects.items;
  const cats = new Set(items.map((p) => p.category));
  $('#hud').innerHTML = `
    <div><dt>Proyek</dt><dd><span data-count="${items.length}">0</span></dd></div>
    <div><dt>Kategori</dt><dd><span data-count="${cats.size}">0</span></dd></div>
    <div><dt>Fokus</dt><dd>${esc(C.hero.focus)}</dd></div>`;

  $$('[data-count]', $('#hud')).forEach((el) => {
    const target = Number(el.dataset.count);
    if (reduceMotion) { el.textContent = target; return; }
    const t0 = performance.now() + 400;
    (function step(now) {
      const p = clamp((now - t0) / 900, 0, 1);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    })(performance.now());
  });
}

function renderAbout() {
  $('#tentang-title').textContent = C.about.title;
  $('#about-text').innerHTML = C.about.paragraphs.map((t) => `<p>${esc(t)}</p>`).join('');
  $('#facts').innerHTML = C.about.facts.map((f) => `<div><dt>${esc(f.k)}</dt><dd>${esc(f.v)}</dd></div>`).join('');
}

let lastTrigger = null;

function renderProjects() {
  $('#proyek-title').textContent = C.projects.title;
  const grid = $('#project-grid');
  const bar = $('#project-filters');
  const count = $('#project-count');
  const items = C.projects.items;
  const categories = ['Semua', ...new Set(items.map((p) => p.category).filter(Boolean))];
  let active = 'Semua';

  bar.innerHTML = categories.map((c) => (
    `<button type="button" class="chip${c === active ? ' is-active' : ''}" data-filter="${esc(c)}" aria-pressed="${c === active}">${esc(c)}</button>`
  )).join('');

  function paint() {
    const list = items.filter((p) => active === 'Semua' || p.category === active);
    count.textContent = `${list.length} proyek`;
    grid.innerHTML = list.length ? list.map((p, i) => `
      <button type="button" class="card reveal" data-index="${items.indexOf(p)}" aria-haspopup="dialog">
        <span class="card-top"><span class="tag">${esc(p.category)}</span><span class="year">${esc(p.year)}</span></span>
        <span class="card-title">${esc(p.title)}</span>
        <span class="card-sum">${esc(p.summary)}</span>
        <span class="card-stack">${(p.stack || []).map((s) => `<span class="stack-item">${esc(s)}</span>`).join('')}</span>
      </button>`).join('') : '<p class="empty">Belum ada proyek di kategori ini.</p>';
    observeReveal(grid);
  }

  bar.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-filter]');
    if (!btn) return;
    active = btn.dataset.filter;
    $$('.chip', bar).forEach((c) => {
      const on = c === btn;
      c.classList.toggle('is-active', on);
      c.setAttribute('aria-pressed', String(on));
    });
    paint();
  });

  grid.addEventListener('click', (e) => {
    const card = e.target.closest('[data-index]');
    if (card) openProject(items[Number(card.dataset.index)], card);
  });

  paint();
}

function safeUrl(u) {
  return /^(https?:\/\/|mailto:)/i.test(u || '') ? u : '';
}

function openProject(p, trigger) {
  const dlg = $('#project-dialog');
  if (!p || !dlg) return;
  lastTrigger = trigger || null;

  const links = [];
  if (safeUrl(p.link)) links.push(`<a class="btn btn-primary" href="${esc(safeUrl(p.link))}" target="_blank" rel="noopener">Buka proyek</a>`);
  if (safeUrl(p.repo)) links.push(`<a class="btn btn-ghost" href="${esc(safeUrl(p.repo))}" target="_blank" rel="noopener">Lihat kode</a>`);

  $('#dlg-body').innerHTML = `
    <p class="card-top"><span class="tag">${esc(p.category)}</span><span class="year">${esc(p.year)}</span></p>
    <h3 class="dlg-title" id="dlg-title">${esc(p.title)}</h3>
    <p class="dlg-desc">${esc(p.description)}</p>
    <p class="card-stack">${(p.stack || []).map((s) => `<span class="stack-item">${esc(s)}</span>`).join('')}</p>
    ${links.length ? `<div class="dlg-links">${links.join('')}</div>` : ''}`;

  if (typeof dlg.showModal === 'function') dlg.showModal();
  else dlg.setAttribute('open', '');
}

function initDialog() {
  const dlg = $('#project-dialog');
  const close = () => {
    if (typeof dlg.close === 'function') dlg.close();
    else dlg.removeAttribute('open');
  };
  $('#dlg-close').addEventListener('click', close);
  dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
  dlg.addEventListener('close', () => { if (lastTrigger) lastTrigger.focus(); });
}

function renderTimeline() {
  $('#perjalanan-title').textContent = C.timeline.title;
  $('#timeline').innerHTML = C.timeline.items.map((t) => `
    <li class="tl-item reveal">
      <span class="tl-dot" aria-hidden="true"></span>
      <p class="tl-period">${esc(t.period)}</p>
      <h3 class="tl-title">${esc(t.title)}</h3>
      <p class="tl-place">${esc(t.place)}</p>
      <p class="tl-text">${esc(t.text)}</p>
    </li>`).join('');
}

function renderSkills() {
  $('#keahlian-title').textContent = C.skills.title;
  $('#skills').innerHTML = C.skills.groups.map((g) => `
    <div class="skill-card reveal">
      <h3>${esc(g.group)}</h3>
      <ul class="skill-list">${(g.items || []).map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
    </div>`).join('');
}

/* ---------- Kolaborasi ---------- */
function renderCollab() {
  const c = C.collab;
  $('#kontak-title').textContent = c.title;
  $('#contact-lede').textContent = c.lede;
  $('#contact-list').innerHTML = c.links.map((l) => {
    const href = safeUrl(l.href);
    return `<li><span class="k">${esc(l.label)}</span>${
      href
        ? `<a href="${esc(href)}"${href.startsWith('http') ? ' target="_blank" rel="noopener"' : ''}>${esc(l.text)}</a>`
        : `<span>${esc(l.text)}</span>`
    }</li>`;
  }).join('');

  $('#f-jenis').innerHTML = (c.types.length ? c.types : ['Lainnya'])
    .map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join('');

  const status = $('#copy-status');
  $('#copy-email').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(c.email);
      status.textContent = 'Email disalin.';
    } catch (err) {
      status.textContent = `Salin manual: ${c.email}`;
    }
  });
}

function initForm() {
  const form = $('#contact-form');
  const status = $('#form-status');
  const submit = $('#form-submit');
  const rules = {
    nama: (v) => (v.trim().length >= 2 ? '' : 'Tulis nama minimal 2 huruf.'),
    email: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? '' : 'Tulis alamat email yang valid.'),
    pesan: (v) => (v.trim().length >= 10 ? '' : 'Pesan minimal 10 karakter.')
  };

  function check(name) {
    const input = form.elements[name];
    const msg = rules[name](input.value);
    $(`#e-${name}`).textContent = msg;
    input.closest('.field').classList.toggle('invalid', Boolean(msg));
    input.setAttribute('aria-invalid', String(Boolean(msg)));
    return !msg;
  }

  Object.keys(rules).forEach((name) => {
    form.elements[name].addEventListener('blur', () => check(name));
    form.elements[name].addEventListener('input', () => {
      if (form.elements[name].closest('.field').classList.contains('invalid')) check(name);
    });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    status.className = 'status';
    const results = Object.keys(rules).map(check);
    if (results.includes(false)) {
      status.textContent = 'Periksa kolom yang ditandai.';
      const firstBad = Object.keys(rules).find((n) => rules[n](form.elements[n].value) !== '');
      if (firstBad) form.elements[firstBad].focus();
      return;
    }
    if (form.elements._gotcha.value) return; // jebakan untuk bot

    const payload = {
      nama: form.elements.nama.value.trim(),
      email: form.elements.email.value.trim(),
      jenis: form.elements.jenis.value,
      pesan: form.elements.pesan.value.trim()
    };

    const endpoint = C.collab.endpoint;
    if (endpoint && /^https:\/\//i.test(endpoint)) {
      submit.disabled = true;
      status.textContent = 'Mengirim…';
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error(String(res.status));
        form.reset();
        status.textContent = 'Terima kasih, pesanmu sudah terkirim.';
      } catch (err) {
        status.textContent = 'Pesan belum terkirim. Coba lagi, atau kirim lewat email di samping.';
      } finally {
        submit.disabled = false;
      }
      return;
    }

    // Tanpa layanan formulir: buka aplikasi email.
    const subject = encodeURIComponent(`Ajakan kolaborasi: ${payload.jenis} (${payload.nama})`);
    const body = encodeURIComponent(`${payload.pesan}\n\n${payload.nama}\n${payload.email}`);
    status.textContent = 'Membuka aplikasi email Anda…';
    window.location.href = `mailto:${C.collab.email}?subject=${subject}&body=${body}`;
  });
}

/* ==========================================================
   6. NAVIGASI
   ========================================================== */
function initNav() {
  const header = $('#header');
  const btn = $('#menu-btn');
  const links = $$('.nav a');

  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 10);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  btn.addEventListener('click', () => {
    const open = header.classList.toggle('nav-open');
    btn.setAttribute('aria-expanded', String(open));
    btn.setAttribute('aria-label', open ? 'Tutup menu' : 'Buka menu');
  });
  links.forEach((a) => a.addEventListener('click', () => {
    header.classList.remove('nav-open');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', 'Buka menu');
  }));
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && header.classList.contains('nav-open')) {
      header.classList.remove('nav-open');
      btn.setAttribute('aria-expanded', 'false');
      btn.focus();
    }
  });

  if (!('IntersectionObserver' in window)) return;
  const map = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
  const sectionIO = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      links.forEach((a) => a.classList.remove('is-active'));
      const link = map.get(entry.target.id);
      if (link) link.classList.add('is-active');
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  map.forEach((_, id) => { const s = document.getElementById(id); if (s) sectionIO.observe(s); });
}

/* ==========================================================
   Mulai
   ========================================================== */
document.addEventListener('DOMContentLoaded', () => {
  $('#year').textContent = new Date().getFullYear();

  showPreviewBar();
  renderHero();
  renderAbout();
  renderProjects();
  renderTimeline();
  renderSkills();
  renderCollab();

  initDialog();
  initForm();
  initNav();
  typeRoles($('#role'), C.hero.roles);

  observeReveal();
  initStars();
  initOrbit();
});
