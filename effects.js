'use strict';

/* Efek dan utilitas bersama: dipakai halaman publik dan admin. */

/* ==========================================================
   2. UTILITAS
   ========================================================== */
document.documentElement.classList.add('js');

const TAU = Math.PI * 2;
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

// Pembangkit angka acak yang hasilnya selalu sama (supaya posisi lampu kota tidak berubah tiap muat ulang).
function seededRandom(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- Animasi muncul saat di-scroll ---------- */
const revealIO = 'IntersectionObserver' in window
  ? new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          revealIO.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 })
  : null;

function observeReveal(root = document) {
  $$('.reveal:not(.in)', root).forEach((el) => {
    if (revealIO) revealIO.observe(el);
    else el.classList.add('in');
  });
}

/* ==========================================================
   3. BINTANG LATAR BELAKANG
   Tiga lapis bintang berkelip, bergeser pelan mengikuti scroll,
   ditambah bintang jatuh sesekali.
   ========================================================== */
function initStars() {
  const canvas = $('#stars');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const LAYERS = [
    { density: 0.00012, size: [0.4, 0.9], drift: 3, parallax: 0.02 },
    { density: 0.00006, size: [0.7, 1.3], drift: 6, parallax: 0.05 },
    { density: 0.00002, size: [1.1, 1.9], drift: 10, parallax: 0.1 }
  ];
  const TINTS = ['255,255,255', '255,255,255', '207,200,255', '160,240,255'];

  let w = 0, h = 0, dpr = 1;
  let stars = [];
  let shooting = null;
  let nextShot = 3;
  let time = 0;
  let last = performance.now();

  function build() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const rand = seededRandom(20261116);
    stars = [];
    LAYERS.forEach((layer, li) => {
      const count = Math.round(w * h * layer.density);
      for (let i = 0; i < count; i++) {
        stars.push({
          layer: li,
          x: rand() * w,
          y: rand() * h,
          r: layer.size[0] + rand() * (layer.size[1] - layer.size[0]),
          phase: rand() * TAU,
          twinkle: 0.6 + rand() * 1.8,
          tint: TINTS[Math.floor(rand() * TINTS.length)]
        });
      }
    });
  }

  function spawnShootingStar() {
    const fromLeft = Math.random() > 0.5;
    shooting = {
      x: fromLeft ? Math.random() * w * 0.5 : w * 0.5 + Math.random() * w * 0.5,
      y: Math.random() * h * 0.4,
      vx: (fromLeft ? 1 : -1) * (500 + Math.random() * 300),
      vy: 220 + Math.random() * 160,
      life: 0,
      max: 0.9 + Math.random() * 0.5
    };
  }

  function draw(dt) {
    ctx.clearRect(0, 0, w, h);
    const scroll = window.scrollY;

    for (const s of stars) {
      const layer = LAYERS[s.layer];
      s.x += layer.drift * dt;
      if (s.x > w + 2) s.x = -2;

      let y = (s.y - scroll * layer.parallax) % h;
      if (y < 0) y += h;

      const tw = reduceMotion ? 0.8 : 0.55 + 0.45 * Math.sin(time * s.twinkle + s.phase);
      ctx.fillStyle = `rgba(${s.tint},${(tw * (0.5 + s.layer * 0.18)).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(s.x, y, s.r, 0, TAU);
      ctx.fill();
    }

    if (shooting) {
      shooting.life += dt;
      shooting.x += shooting.vx * dt;
      shooting.y += shooting.vy * dt;
      const p = shooting.life / shooting.max;
      if (p >= 1) {
        shooting = null;
      } else {
        const len = 120;
        const mag = Math.hypot(shooting.vx, shooting.vy);
        const tx = shooting.x - (shooting.vx / mag) * len;
        const ty = shooting.y - (shooting.vy / mag) * len;
        const grad = ctx.createLinearGradient(shooting.x, shooting.y, tx, ty);
        const a = Math.sin(p * Math.PI);
        grad.addColorStop(0, `rgba(255,255,255,${(0.9 * a).toFixed(3)})`);
        grad.addColorStop(1, 'rgba(160,240,255,0)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(shooting.x, shooting.y);
        ctx.lineTo(tx, ty);
        ctx.stroke();
      }
    }
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    time += dt;

    nextShot -= dt;
    if (nextShot <= 0 && !shooting) {
      spawnShootingStar();
      nextShot = 5 + Math.random() * 7;
    }

    draw(dt);
    requestAnimationFrame(frame);
  }

  build();
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { build(); if (reduceMotion) draw(0); }, 150);
  });

  if (reduceMotion) {
    draw(0);
    window.addEventListener('scroll', () => draw(0), { passive: true });
  } else {
    requestAnimationFrame(frame);
  }
}

/* ==========================================================
   4. PLANET DAN SATELIT YANG MENGORBIT
   - Planet berputar pelan dengan garis bujur, lintang, dan lampu kota.
   - Satelit utama mengorbit; saat melewati belakang planet ia
     tertutup dan lebih kecil, saat di depan ia memindai area studi.
   - Satu benda kecil kedua mengorbit di lintasan lain.
   ========================================================== */
function initOrbit() {
  const canvas = $('#orbit');
  if (!canvas) return;
  const wrap = canvas.parentElement;
  const ctx = canvas.getContext('2d');

  const orbits = [
    { rx: 1.32, ry: 0.44, tilt: -28 * Math.PI / 180, speed: 0.42, t: -1.05, color: '56,232,255', main: true },
    { rx: 1.2, ry: 0.28, tilt: 18 * Math.PI / 180, speed: -0.24, t: 2.2, color: '167,139,250', main: false }
  ];

  // Lampu kota: titik acak di permukaan, dikelompokkan di beberapa pusat.
  const rand = seededRandom(7);
  const cities = [];
  for (let c = 0; c < 9; c++) {
    const lat0 = Math.asin(rand() * 1.4 - 0.7);
    const lon0 = rand() * TAU;
    for (let i = 0; i < 9; i++) {
      cities.push({
        lat: lat0 + (rand() - 0.5) * 0.32,
        lon: lon0 + (rand() - 0.5) * 0.4,
        phase: rand() * TAU
      });
    }
  }

  let size = 0, dpr = 1;
  let time = 0, rot = 0.6;
  let mx = 0, my = 0, tx = 0, ty = 0;
  let visible = true, rafId = null, last = performance.now();

  function resize() {
    size = Math.max(240, wrap.clientWidth);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (reduceMotion || !rafId) draw();
  }

  function draw() {
    const k = size / 700;
    const R = size * 0.34;
    const cx = size / 2 + mx;
    const cy = size / 2 + my;

    ctx.clearRect(0, 0, size, size);

    const orbitPoint = (o, t) => {
      const x = o.rx * R * Math.cos(t);
      const y = o.ry * R * Math.sin(t);
      const c = Math.cos(o.tilt);
      const s = Math.sin(o.tilt);
      return { x: cx + x * c - y * s, y: cy + x * s + y * c, depth: Math.sin(t) };
    };

    const strokeOrbit = (o, front) => {
      ctx.save();
      ctx.beginPath();
      const t0 = front ? 0 : Math.PI;
      for (let i = 0; i <= 90; i++) {
        const p = orbitPoint(o, t0 + (i / 90) * Math.PI);
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.setLineDash([3 * k + 1, 7 * k + 2]);
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = `rgba(${o.color},${front ? 0.6 : 0.24})`;
      ctx.stroke();
      ctx.restore();
    };

    const drawSatellite = (p, o, scale, alpha) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(o.tilt);
      ctx.scale(scale * k * 1.25, scale * k * 1.25);
      ctx.fillStyle = '#7C6CFF';
      ctx.strokeStyle = '#CFC8FF';
      ctx.lineWidth = 1;
      ctx.fillRect(-30, -4, 20, 8);
      ctx.strokeRect(-30, -4, 20, 8);
      ctx.fillRect(10, -4, 20, 8);
      ctx.strokeRect(10, -4, 20, 8);
      ctx.fillStyle = '#ECEBFF';
      ctx.fillRect(-8, -5.5, 16, 11);
      ctx.strokeStyle = '#38E8FF';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, 5.5);
      ctx.lineTo(0, 13);
      ctx.stroke();
      ctx.fillStyle = '#38E8FF';
      ctx.beginPath();
      ctx.arc(0, 14, 1.8, 0, TAU);
      ctx.fill();
      ctx.restore();
    };

    const drawObjects = (front) => {
      orbits.forEach((o) => {
        // Jejak di belakang benda
        const dir = o.speed >= 0 ? -1 : 1;
        for (let i = 12; i >= 1; i--) {
          const p = orbitPoint(o, o.t + dir * i * 0.05);
          if ((p.depth >= 0) !== front) continue;
          ctx.fillStyle = `rgba(${o.color},${(0.5 * (1 - i / 13)).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 1.5 * k * 1.2, 0, TAU);
          ctx.fill();
        }

        const p = orbitPoint(o, o.t);
        if ((p.depth >= 0) !== front) return;
        const scale = 0.82 + 0.18 * (p.depth + 1) / 2 + (front ? 0.1 : 0);
        if (o.main) {
          drawSatellite(p, o, scale, front ? 1 : 0.7);
        } else {
          ctx.fillStyle = front ? '#D9CFFF' : 'rgba(217,207,255,0.6)';
          ctx.beginPath();
          ctx.arc(p.x, p.y, 4.5 * k * 1.3 * scale, 0, TAU);
          ctx.fill();
        }
      });
    };

    // --- Cahaya atmosfer di belakang planet
    const glow = ctx.createRadialGradient(cx, cy, R * 0.98, cx, cy, R * 1.28);
    glow.addColorStop(0, 'rgba(56,232,255,0.28)');
    glow.addColorStop(0.5, 'rgba(124,108,255,0.1)');
    glow.addColorStop(1, 'rgba(124,108,255,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 1.28, 0, TAU);
    ctx.fill();

    // --- Orbit dan benda di belakang planet
    orbits.forEach((o) => strokeOrbit(o, false));
    drawObjects(false);

    // --- Planet
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    const body = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.36, R * 0.1, cx, cy, R);
    body.addColorStop(0, '#3A2C9A');
    body.addColorStop(0.55, '#150F4A');
    body.addColorStop(1, '#070620');
    ctx.fillStyle = body;
    ctx.fill();
    ctx.clip();

    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(139,124,246,0.38)';

    for (let i = 0; i < 6; i++) {
      const lon = (i * Math.PI) / 6 + rot;
      ctx.beginPath();
      ctx.ellipse(cx, cy, Math.abs(Math.sin(lon)) * R, R, 0, 0, TAU);
      ctx.stroke();
    }
    [-60, -40, -20, 0, 20, 40, 60].forEach((deg) => {
      const lat = (deg * Math.PI) / 180;
      const hw = R * Math.cos(lat);
      ctx.beginPath();
      ctx.ellipse(cx, cy - R * Math.sin(lat), hw, hw * 0.14, 0, 0, TAU);
      ctx.stroke();
    });

    for (const c of cities) {
      const lon = c.lon + rot;
      const z = Math.cos(c.lat) * Math.cos(lon);
      if (z <= 0) continue;
      const x = cx + R * Math.cos(c.lat) * Math.sin(lon);
      const y = cy - R * Math.sin(c.lat);
      const tw = reduceMotion ? 1 : 0.7 + 0.3 * Math.sin(time * 2 + c.phase);
      ctx.fillStyle = `rgba(56,232,255,${(0.25 + 0.75 * z * tw).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(x, y, 1.5 * k * 1.3, 0, TAU);
      ctx.fill();
    }

    const shade = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.2, cx, cy, R * 1.05);
    shade.addColorStop(0, 'rgba(4,3,18,0)');
    shade.addColorStop(1, 'rgba(4,3,18,0.62)');
    ctx.fillStyle = shade;
    ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
    ctx.restore();

    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(56,232,255,0.72)';
    ctx.stroke();

    // --- Orbit dan benda di depan planet
    orbits.forEach((o) => strokeOrbit(o, true));

    const main = orbits[0];
    const sat = orbitPoint(main, main.t);
    if (sat.depth > 0) {
      const vis = clamp(sat.depth * 3, 0, 1);
      const dx = sat.x - cx;
      const dy = sat.y - cy;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      const fx = cx + ux * R * 0.5;
      const fy = cy + uy * R * 0.5;
      const half = R * 0.17;
      const px = -uy * half;
      const py = ux * half;

      const beam = ctx.createLinearGradient(sat.x, sat.y, fx, fy);
      beam.addColorStop(0, `rgba(56,232,255,${(0.5 * vis).toFixed(3)})`);
      beam.addColorStop(1, `rgba(56,232,255,${(0.06 * vis).toFixed(3)})`);
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(sat.x, sat.y);
      ctx.lineTo(fx + px, fy + py);
      ctx.lineTo(fx - px, fy - py);
      ctx.closePath();
      ctx.fill();

      const pulse = reduceMotion ? 0 : Math.sin(time * 4);
      ctx.globalAlpha = vis;
      ctx.strokeStyle = 'rgba(255,200,87,0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(fx, fy, (10 + pulse * 3) * k * 1.3, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = '#FFC857';
      ctx.beginPath();
      ctx.arc(fx, fy, 3.5 * k * 1.3, 0, TAU);
      ctx.fill();

      const fontPx = Math.max(10, Math.round(12 * k * 1.1));
      ctx.font = `500 ${fontPx}px 'IBM Plex Mono', monospace`;
      const label = 'AREA STUDI';
      const lw = ctx.measureText(label).width + 16;
      const lx = clamp(fx + 14, 4, size - lw - 4);
      const ly = clamp(fy + 12, 4, size - fontPx - 16);
      ctx.fillStyle = 'rgba(10,7,34,0.88)';
      ctx.fillRect(lx, ly, lw, fontPx + 10);
      ctx.strokeStyle = '#FFC857';
      ctx.strokeRect(lx + 0.5, ly + 0.5, lw - 1, fontPx + 9);
      ctx.fillStyle = '#FFC857';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, lx + 8, ly + (fontPx + 10) / 2 + 0.5);
      ctx.globalAlpha = 1;
    }

    drawObjects(true);

    // Label satelit mengikuti posisinya
    const sp = orbitPoint(main, main.t);
    const fontPx = Math.max(10, Math.round(12 * k * 1.1));
    ctx.font = `500 ${fontPx}px 'IBM Plex Mono', monospace`;
    const sl = 'SAT-01';
    const sw = ctx.measureText(sl).width + 16;
    const sx = clamp(sp.x + 18, 4, size - sw - 4);
    const sy = clamp(sp.y - 34, 4, size - fontPx - 16);
    ctx.globalAlpha = sp.depth > 0 ? 1 : 0.55;
    ctx.fillStyle = 'rgba(10,7,34,0.88)';
    ctx.fillRect(sx, sy, sw, fontPx + 10);
    ctx.strokeStyle = '#38E8FF';
    ctx.strokeRect(sx + 0.5, sy + 0.5, sw - 1, fontPx + 9);
    ctx.fillStyle = '#38E8FF';
    ctx.textBaseline = 'middle';
    ctx.fillText(sl, sx + 8, sy + (fontPx + 10) / 2 + 0.5);
    ctx.globalAlpha = 1;
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    time += dt;
    rot += dt * 0.12;
    orbits.forEach((o) => { o.t += o.speed * dt; });
    mx += (tx - mx) * 0.06;
    my += (ty - my) * 0.06;
    draw();
    rafId = visible ? requestAnimationFrame(frame) : null;
  }

  function start() {
    if (rafId || reduceMotion) return;
    last = performance.now();
    rafId = requestAnimationFrame(frame);
  }

  new ResizeObserver(resize).observe(wrap);
  resize();

  if (reduceMotion) return;

  window.addEventListener('pointermove', (e) => {
    tx = (e.clientX / window.innerWidth - 0.5) * 16;
    ty = (e.clientY / window.innerHeight - 0.5) * 16;
  }, { passive: true });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      if (visible) start();
    }, { threshold: 0.05 }).observe(wrap);
  }
  start();
}

