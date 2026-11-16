'use strict';

/* ==========================================================
   Halaman admin: kata sandi + editor teks portofolio.

   Cara kerja:
   1. Kata sandi dicek di browser (PBKDF2) terhadap hash di content.js.
   2. Perubahan disimpan otomatis sebagai DRAF di browser ini
      (localStorage). Draf bisa dilihat lewat tombol Pratinjau.
   3. Untuk menerbitkan: unduh content.js, lalu ganti file
      content.js di repositori GitHub.
   ========================================================== */
(function () {
  const PUB = window.PORTFOLIO_CONTENT;
  const DRAFT_KEY = 'hsw-draft';
  const AUTH_KEY = 'hsw-auth';
  const FAIL_KEY = 'hsw-fail';
  const MAX_FAILS = 5;

  /* ---------- Penyimpanan aman ---------- */
  const store = {
    get(k, fallback) { try { const v = localStorage.getItem(k); return v == null ? fallback : JSON.parse(v); } catch (e) { return fallback; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* abaikan */ } }
  };
  const session = {
    get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* abaikan */ } },
    del(k) { try { sessionStorage.removeItem(k); } catch (e) { /* abaikan */ } }
  };

  const clone = (o) => JSON.parse(JSON.stringify(o));

  /* ==========================================================
     Kata sandi
     ========================================================== */
  const hex = (buf) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');

  async function derive(password, salt, iterations) {
    if (!window.crypto || !crypto.subtle) throw new Error('nocrypto');
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations },
      key, 256
    );
    return hex(bits);
  }

  function lockState() {
    const f = store.get(FAIL_KEY, { n: 0, until: 0 });
    const wait = Math.max(0, Math.ceil((f.until - Date.now()) / 1000));
    return { n: f.n, wait };
  }

  function recordFail() {
    const f = store.get(FAIL_KEY, { n: 0, until: 0 });
    const n = f.n + 1;
    const until = n >= MAX_FAILS ? Date.now() + Math.min(600, 15 * Math.pow(2, n - MAX_FAILS)) * 1000 : 0;
    store.set(FAIL_KEY, { n, until });
  }

  function initLogin() {
    const form = $('#login-form');
    const input = $('#pw');
    const err = $('#login-error');
    const btn = $('#login-btn');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      err.textContent = '';

      const lock = lockState();
      if (lock.wait > 0) {
        err.textContent = `Terlalu banyak percobaan. Coba lagi dalam ${lock.wait} detik.`;
        return;
      }
      if (!input.value) {
        err.textContent = 'Masukkan kata sandi.';
        input.focus();
        return;
      }
      if (!PUB || !PUB.auth) {
        err.textContent = 'Data kata sandi tidak ditemukan di content.js.';
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Memeriksa…';
      try {
        const h = await derive(input.value, PUB.auth.salt, PUB.auth.iter);
        if (h === PUB.auth.hash) {
          store.del(FAIL_KEY);
          session.set(AUTH_KEY, '1');
          input.value = '';
          openEditor();
        } else {
          recordFail();
          const left = MAX_FAILS - lockState().n;
          err.textContent = left > 0 ? 'Kata sandi salah.' : 'Kata sandi salah. Terlalu banyak percobaan, tunggu sebentar.';
          input.select();
        }
      } catch (ex) {
        err.textContent = ex.message === 'nocrypto'
          ? 'Browser ini tidak mendukung pemeriksaan kata sandi. Buka lewat https atau localhost.'
          : 'Terjadi kesalahan. Muat ulang halaman lalu coba lagi.';
      } finally {
        btn.disabled = false;
        btn.textContent = 'Masuk';
      }
    });
  }

  /* ==========================================================
     Draf
     ========================================================== */
  let state = null;
  let saveTimer = null;

  function loadDraft() {
    const d = store.get(DRAFT_KEY, null);
    if (d && typeof d === 'object' && d.hero && d.about && d.projects && d.collab) {
      // auth selalu mengikuti versi terbit kecuali kata sandi diganti di draf
      d.auth = d.auth || clone(PUB.auth);
      return d;
    }
    return clone(PUB);
  }

  const isDirty = () => JSON.stringify(state) !== JSON.stringify(PUB);

  function paintState(msg) {
    const el = $('#ed-state');
    const dirty = isDirty();
    el.classList.toggle('dirty', dirty);
    el.textContent = msg || (dirty ? 'Ada perubahan yang belum diterbitkan' : 'Sama dengan versi terbit');
  }

  function touch() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const ok = store.set(DRAFT_KEY, state);
      const t = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      paintState(ok ? `Draf tersimpan ${t} · belum diterbitkan` : 'Draf gagal disimpan di browser ini');
      if (!isDirty()) paintState();
      refreshCode();
    }, 350);
  }

  /* ==========================================================
     Pembuat elemen
     ========================================================== */
  function h(tag, props, ...kids) {
    const e = document.createElement(tag);
    Object.entries(props || {}).forEach(([k, v]) => {
      if (v == null || v === false) return;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (v === true) e.setAttribute(k, '');
      else e.setAttribute(k, v);
    });
    kids.flat().forEach((c) => { if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c)); });
    return e;
  }

  let uid = 0;

  // Satu kolom teks. rows > 0 berarti textarea.
  function field(label, get, set, opt = {}) {
    const id = `f${++uid}`;
    const input = opt.rows
      ? h('textarea', { id, rows: opt.rows })
      : h('input', { id, type: opt.type || 'text', autocomplete: opt.autocomplete || 'off' });
    input.value = get();
    input.addEventListener('input', () => { set(input.value); touch(); });
    return h('div', { class: 'field' },
      h('label', { for: id, text: label }),
      input,
      opt.hint ? h('p', { class: 'hint', text: opt.hint }) : null);
  }

  const lines = (a) => (a || []).join('\n');
  const fromLines = (s) => s.split('\n').map((x) => x.trim()).filter(Boolean);
  const commas = (a) => (a || []).join(', ');
  const fromCommas = (s) => s.split(',').map((x) => x.trim()).filter(Boolean);
  const paras = (a) => (a || []).join('\n\n');
  const fromParas = (s) => s.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);

  // Daftar item yang bisa ditambah, dipindah, dan dihapus.
  function arrayEditor(arr, opt) {
    const wrap = h('div', { class: 'items' });
    let openIndex = -1;

    function paint() {
      wrap.replaceChildren();
      arr.forEach((item, i) => {
        const title = opt.title(item, i) || `${opt.noun} ${i + 1}`;
        const del = h('button', { type: 'button', class: 'btn btn-ghost btn-danger', text: 'Hapus' });
        let armed = false;
        del.addEventListener('click', () => {
          if (!armed) {
            armed = true;
            del.textContent = 'Yakin hapus?';
            setTimeout(() => { armed = false; del.textContent = 'Hapus'; }, 3000);
            return;
          }
          arr.splice(i, 1);
          openIndex = -1;
          touch();
          paint();
        });
        const move = (d) => () => {
          const j = i + d;
          if (j < 0 || j >= arr.length) return;
          [arr[i], arr[j]] = [arr[j], arr[i]];
          openIndex = j;
          touch();
          paint();
        };
        const tools = h('div', { class: 'item-tools' },
          h('button', { type: 'button', class: 'btn btn-ghost', text: 'Naik', onclick: move(-1), disabled: i === 0 ? true : null }),
          h('button', { type: 'button', class: 'btn btn-ghost', text: 'Turun', onclick: move(1), disabled: i === arr.length - 1 ? true : null }),
          del);
        wrap.append(h('details', { class: 'item', open: i === openIndex ? true : null },
          h('summary', { text: title }),
          h('div', { class: 'item-body' }, opt.fields(item), tools)));
      });
      wrap.append(h('button', {
        type: 'button',
        class: 'btn btn-ghost btn-sm add-row',
        text: `Tambah ${opt.noun.toLowerCase()}`,
        onclick: () => { arr.push(opt.make()); openIndex = arr.length - 1; touch(); paint(); }
      }));
    }
    paint();
    return wrap;
  }

  /* ==========================================================
     Isi tiap bagian
     ========================================================== */
  const views = {
    beranda: () => [
      h('h2', { text: 'Beranda' }),
      h('p', { class: 'ed-note', text: 'Bagian paling atas halaman: nama, peran yang diketik bergantian, dan kalimat pembuka.' }),
      field('Nama', () => state.hero.name, (v) => { state.hero.name = v; }),
      field('Peran (satu per baris)', () => lines(state.hero.roles), (v) => { state.hero.roles = fromLines(v); }, { rows: 4, hint: 'Ditampilkan bergantian dengan efek mengetik.' }),
      field('Kalimat pembuka', () => state.hero.lede, (v) => { state.hero.lede = v; }, { rows: 3 }),
      field('Fokus singkat', () => state.hero.focus, (v) => { state.hero.focus = v; }, { hint: 'Tampil di kotak kecil di bawah tombol.' })
    ],

    tentang: () => [
      h('h2', { text: 'Tentang' }),
      field('Judul bagian', () => state.about.title, (v) => { state.about.title = v; }),
      field('Paragraf (pisahkan dengan baris kosong)', () => paras(state.about.paragraphs), (v) => { state.about.paragraphs = fromParas(v); }, { rows: 8 }),
      h('p', { class: 'ed-note', text: 'Fakta singkat' }),
      arrayEditor(state.about.facts, {
        noun: 'Fakta',
        title: (f) => f.k,
        make: () => ({ k: '', v: '' }),
        fields: (f) => [
          field('Label', () => f.k, (v) => { f.k = v; }),
          field('Isi', () => f.v, (v) => { f.v = v; })
        ]
      })
    ],

    proyek: () => [
      h('h2', { text: 'Proyek' }),
      field('Judul bagian', () => state.projects.title, (v) => { state.projects.title = v; }),
      arrayEditor(state.projects.items, {
        noun: 'Proyek',
        title: (p) => p.title,
        make: () => ({ id: `p${Date.now()}`, title: '', category: '', year: '', summary: '', description: '', stack: [], link: '', repo: '' }),
        fields: (p) => [
          field('Judul', () => p.title, (v) => { p.title = v; }),
          field('Kategori', () => p.category, (v) => { p.category = v; }, { hint: 'Dipakai untuk tombol filter, misalnya Web, Peta, Aplikasi, Lomba.' }),
          field('Tahun', () => p.year, (v) => { p.year = v; }),
          field('Ringkasan (di kartu)', () => p.summary, (v) => { p.summary = v; }, { rows: 2 }),
          field('Deskripsi (di jendela detail)', () => p.description, (v) => { p.description = v; }, { rows: 5 }),
          field('Teknologi (pisahkan dengan koma)', () => commas(p.stack), (v) => { p.stack = fromCommas(v); }),
          field('Tautan proyek', () => p.link, (v) => { p.link = v.trim(); }, { type: 'url', hint: 'Harus diawali https://. Kosongkan bila tidak ada.' }),
          field('Tautan kode', () => p.repo, (v) => { p.repo = v.trim(); }, { type: 'url', hint: 'Misalnya tautan repositori GitHub.' })
        ]
      })
    ],

    perjalanan: () => [
      h('h2', { text: 'Perjalanan' }),
      field('Judul bagian', () => state.timeline.title, (v) => { state.timeline.title = v; }),
      arrayEditor(state.timeline.items, {
        noun: 'Peristiwa',
        title: (t) => `${t.period} · ${t.title}`,
        make: () => ({ period: '', title: '', place: '', text: '' }),
        fields: (t) => [
          field('Periode', () => t.period, (v) => { t.period = v; }),
          field('Judul', () => t.title, (v) => { t.title = v; }),
          field('Tempat atau penyelenggara', () => t.place, (v) => { t.place = v; }),
          field('Cerita singkat', () => t.text, (v) => { t.text = v; }, { rows: 3 })
        ]
      })
    ],

    keahlian: () => [
      h('h2', { text: 'Keahlian' }),
      field('Judul bagian', () => state.skills.title, (v) => { state.skills.title = v; }),
      arrayEditor(state.skills.groups, {
        noun: 'Kelompok',
        title: (g) => g.group,
        make: () => ({ group: '', items: [] }),
        fields: (g) => [
          field('Nama kelompok', () => g.group, (v) => { g.group = v; }),
          field('Keahlian (pisahkan dengan koma)', () => commas(g.items), (v) => { g.items = fromCommas(v); }, { rows: 2 })
        ]
      })
    ],

    kolaborasi: () => [
      h('h2', { text: 'Kolaborasi' }),
      h('p', { class: 'ed-note', text: 'Teks di sebelah formulir kolaborasi yang diisi pengunjung.' }),
      field('Judul bagian', () => state.collab.title, (v) => { state.collab.title = v; }),
      field('Kalimat pengantar', () => state.collab.lede, (v) => { state.collab.lede = v; }, { rows: 3 }),
      field('Pilihan jenis kolaborasi (satu per baris)', () => lines(state.collab.types), (v) => { state.collab.types = fromLines(v); }, { rows: 5 }),
      field('Email penerima pesan', () => state.collab.email, (v) => { state.collab.email = v.trim(); }, { type: 'email', hint: 'Dipakai bila formulir dikirim lewat aplikasi email.' }),
      field('Alamat layanan formulir (opsional)', () => state.collab.endpoint, (v) => { state.collab.endpoint = v.trim(); }, {
        type: 'url',
        hint: 'Misalnya alamat dari Formspree (https://formspree.io/f/xxxx). Bila diisi, pesan terkirim langsung ke layanan itu tanpa membuka aplikasi email.'
      }),
      h('p', { class: 'ed-note', text: 'Tautan kontak' }),
      arrayEditor(state.collab.links, {
        noun: 'Tautan',
        title: (l) => l.label,
        make: () => ({ label: '', text: '', href: '' }),
        fields: (l) => [
          field('Label', () => l.label, (v) => { l.label = v; }),
          field('Teks yang tampil', () => l.text, (v) => { l.text = v; }),
          field('Alamat tautan', () => l.href, (v) => { l.href = v.trim(); }, { hint: 'Diawali https:// atau mailto:' })
        ]
      })
    ],

    sandi: () => {
      const status = h('p', { class: 'status', role: 'status', 'aria-live': 'polite' });
      const a = h('input', { id: 'pw-new', type: 'password', autocomplete: 'new-password' });
      const b = h('input', { id: 'pw-new2', type: 'password', autocomplete: 'new-password' });
      const btn = h('button', { type: 'button', class: 'btn btn-primary btn-sm add-row', text: 'Buat kata sandi baru' });
      btn.addEventListener('click', async () => {
        status.className = 'status';
        if (a.value.length < 10) { status.textContent = 'Kata sandi minimal 10 karakter.'; return; }
        if (a.value !== b.value) { status.textContent = 'Kedua isian kata sandi belum sama.'; return; }
        btn.disabled = true;
        try {
          const salt = `hsw-${hex(crypto.getRandomValues(new Uint8Array(12)))}`;
          const iter = 200000;
          const hash = await derive(a.value, salt, iter);
          state.auth = { salt, iter, hash };
          a.value = '';
          b.value = '';
          touch();
          status.textContent = 'Kata sandi baru masuk ke draf. Unduh content.js dan unggah ke GitHub agar mulai berlaku.';
        } catch (ex) {
          status.textContent = 'Gagal membuat kata sandi di browser ini.';
        } finally {
          btn.disabled = false;
        }
      });
      return [
        h('h2', { text: 'Kata sandi' }),
        h('p', { class: 'callout', text: 'Kata sandi awal bersifat sementara. Ganti sekarang, lalu terbitkan content.js agar kata sandi lama tidak berlaku lagi.' }),
        h('div', { class: 'field' }, h('label', { for: 'pw-new', text: 'Kata sandi baru' }), a,
          h('p', { class: 'hint', text: 'Pakai kalimat panjang yang mudah kamu ingat dan sulit ditebak orang lain.' })),
        h('div', { class: 'field' }, h('label', { for: 'pw-new2', text: 'Ulangi kata sandi baru' }), b),
        btn,
        status
      ];
    },

    terbitkan: () => {
      const box = h('details', { class: 'code-box' },
        h('summary', { text: 'Lihat isi content.js' }),
        h('textarea', { id: 'code-out', readonly: true, 'aria-label': 'Isi file content.js', spellcheck: 'false' }));
      const reset = h('button', { type: 'button', class: 'btn btn-ghost btn-danger btn-sm add-row', text: 'Buang draf, kembali ke versi terbit' });
      let armed = false;
      reset.addEventListener('click', () => {
        if (!armed) {
          armed = true;
          reset.textContent = 'Yakin? Perubahan di draf akan hilang';
          setTimeout(() => { armed = false; reset.textContent = 'Buang draf, kembali ke versi terbit'; }, 4000);
          return;
        }
        store.del(DRAFT_KEY);
        state = clone(PUB);
        paintState();
        show('beranda');
      });
      setTimeout(refreshCode, 0);
      return [
        h('h2', { text: 'Terbitkan' }),
        h('p', { class: 'ed-note', text: 'Perubahan baru terlihat oleh pengunjung setelah file content.js di GitHub diganti.' }),
        h('ol', { class: 'steps' },
          h('li', { text: 'Klik "Unduh content.js" di bagian atas (atau "Salin content.js").' }),
          h('li', { text: 'Buka repositori di GitHub, klik file content.js, lalu ikon pensil.' }),
          h('li', { text: 'Hapus isi lama, tempel isi baru (atau gunakan Add file > Upload files untuk mengganti file), lalu Commit changes.' }),
          h('li', { text: 'Tunggu satu sampai dua menit, lalu muat ulang situs publik.' })),
        box,
        reset
      ];
    }
  };

  const TABS = [
    ['beranda', 'Beranda'],
    ['tentang', 'Tentang'],
    ['proyek', 'Proyek'],
    ['perjalanan', 'Perjalanan'],
    ['keahlian', 'Keahlian'],
    ['kolaborasi', 'Kolaborasi'],
    ['sandi', 'Kata sandi'],
    ['terbitkan', 'Terbitkan']
  ];

  let current = 'beranda';

  function show(name) {
    current = name;
    $$('.ed-tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === name)));
    const panel = $('#ed-panel');
    panel.replaceChildren(...views[name]());
  }

  /* ==========================================================
     Ekspor content.js
     ========================================================== */
  function buildCode() {
    return '/* Isi portofolio yang tampil ke publik.\n   File ini dibuat oleh halaman admin (tombol "Unduh content.js").\n   Ganti file ini di GitHub untuk mempublikasikan perubahan. */\n'
      + 'window.PORTFOLIO_CONTENT = ' + JSON.stringify(state, null, 2) + ';\n';
  }

  function refreshCode() {
    const out = $('#code-out');
    if (out) out.value = buildCode();
  }

  function download() {
    const blob = new Blob([buildCode()], { type: 'text/javascript;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: 'content.js' });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    paintState('content.js diunduh. Ganti file itu di GitHub untuk menerbitkan.');
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(buildCode());
      paintState('Isi content.js disalin. Tempel ke file content.js di GitHub.');
    } catch (err) {
      show('terbitkan');
      const box = $('.code-box');
      if (box) box.open = true;
      setTimeout(() => { const out = $('#code-out'); if (out) { out.focus(); out.select(); } }, 50);
      paintState('Salin otomatis tidak didukung. Pilih dan salin isi kotak di bawah.');
    }
  }

  /* ==========================================================
     Alur halaman
     ========================================================== */
  function openEditor() {
    $('#login-view').hidden = true;
    $('#editor-view').hidden = false;
    state = loadDraft();
    paintState();
    show(current);
    window.scrollTo(0, 0);
  }

  function logout() {
    session.del(AUTH_KEY);
    state = null;
    $('#editor-view').hidden = true;
    $('#login-view').hidden = false;
    $('#pw').focus();
  }

  function initEditor() {
    const tabs = $('#ed-tabs');
    TABS.forEach(([id, label]) => {
      tabs.append(h('button', {
        type: 'button', class: 'ed-tab', role: 'tab', 'data-tab': id, 'aria-selected': 'false', text: label,
        onclick: () => show(id)
      }));
    });
    $('#btn-download').addEventListener('click', download);
    $('#btn-copy').addEventListener('click', copyCode);
    $('#btn-logout').addEventListener('click', logout);
    window.addEventListener('beforeunload', () => { if (state) store.set(DRAFT_KEY, state); });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initStars();
    initLogin();
    initEditor();
    if (session.get(AUTH_KEY) === '1' && PUB) openEditor();
    else $('#pw').focus();
  });
})();
