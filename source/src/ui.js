/* ============================================================
   UI — save data, screens, HUD, minimap, speedometer, controls
   ============================================================ */
const SAVE_KEY = 'apexdrive.save.v2';
const IS_TOUCH = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

const DEFAULT_CONTROLS = {
  scheme: 'buttons', hand: 'right', size: 1, sens: 1,
  autoThrottle: IS_TOUCH, nitroBtn: true, opacity: 0.85
};

const DEFAULT_SAVE = {
  coins: 500, cars: ['falcon'], selCar: 'falcon', selTrack: 'coast',
  best: {}, stars: {}, muted: false, quality: IS_TOUCH ? 1 : 2,
  handling: 'easy', controls: Object.assign({}, DEFAULT_CONTROLS),
  totalCoins: 0, bestSpeed: 0, runs: 0, gatesBest: 0, distBest: 0
};

const S = (() => {
  let data;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    data = raw ? Object.assign({}, DEFAULT_SAVE, JSON.parse(raw)) : Object.assign({}, DEFAULT_SAVE);
  } catch (e) { data = Object.assign({}, DEFAULT_SAVE); }
  if (!Array.isArray(data.cars) || !data.cars.length) data.cars = ['falcon'];
  if (!CAR_BY_ID[data.selCar]) data.selCar = 'falcon';
  if (data.selTrack !== 'meridian' && !TRACK_DEFS.find(t => t.id === data.selTrack)) data.selTrack = 'coast';
  data.controls = Object.assign({}, DEFAULT_CONTROLS, data.controls || {});
  return {
    get d() { return data; },
    commit() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) { } },
    reset() { data = Object.assign({}, DEFAULT_SAVE); data.controls = Object.assign({}, DEFAULT_CONTROLS); this.commit(); }
  };
})();

const OPEN_CARD = {
  id: 'meridian', name: 'Meridian City', sub: 'Open world · free roam',
  open: true, laps: 0, reward: 0
};

const UI = (() => {
  const $ = id => document.getElementById(id);
  const el = {};
  let msgTimer = 0, toastTimer = 0, flashTimer = 0;
  let mapPts = null, mapScale = 1, mapOff = { x: 0, y: 0 }, mapOpen = null;
  let garageId = null;

  function init() {
    ['loading', 'menu', 'tracks', 'garage', 'controls', 'settings', 'pause', 'results', 'hud',
      'menu-coins', 'menu-topspeed', 'menu-car', 'menu-track', 'garage-coins', 'm-race-hint',
      'car-name', 'car-cls', 'car-blurb', 'btn-car', 'car-strip', 'track-list',
      'tracks-mode', 'btn-launch', 'hud-lap', 'hud-lap-l', 'hud-time', 'hud-pos', 'hud-pos-l',
      'hud-coins', 'spd-arc', 'spd-needle', 'spd-num', 'spd-gear', 'spd-ticks', 'nitro-fill',
      'msg', 'toast', 'flash', 'minimap', 'touch', 'wheel', 'load-fill', 'load-txt',
      'res-title', 'res-sub', 'res-stars', 'res-time', 'res-bestlap', 'res-pos',
      'res-speed', 'res-coins', 'res-drift', 'res-reward', 'rotate-hint',
      'res-l1', 'res-l2', 'res-l3', 'res-l4', 'res-l5', 'res-l6',
      'st-speed', 'st-accel', 'st-grip', 'st-nitro',
      'st-speed-v', 'st-accel-v', 'st-grip-v', 'st-nitro-v', 'sens', 'sens-val', 'scheme-hint'
    ].forEach(k => el[k] = $(k));

    buildSpeedoTicks();
    buildTrackCards();
    buildCarStrip();
    refreshMenu();
    syncSettingsUI();
    syncControlsUI();
  }

  function show(id) {
    ['loading', 'menu', 'tracks', 'garage', 'controls', 'settings', 'pause', 'results'].forEach(k => {
      if (el[k]) el[k].classList.toggle('on', k === id);
    });
    document.body.dataset.screen = id || '';
  }
  function hud(on) {
    el.hud.classList.toggle('on', !!on);
    el.touch.classList.toggle('on', !!on && IS_TOUCH);
    if (!on) { el.msg.classList.remove('show'); el.toast.classList.remove('show'); }
  }

  /* ---------------- speedo ---------------- */
  const SPD_MAX = 240;
  const TICKS = 12;
  function buildSpeedoTicks() {
    const g = el['spd-ticks'];
    let html = '';
    for (let i = 0; i <= TICKS; i++) {
      const a = 135 + i * (270 / TICKS);
      const major = i % 2 === 0;
      const r1 = major ? 68 : 72, r2 = 78;
      const rad = (a - 90) * Math.PI / 180;
      const x1 = 100 + Math.cos(rad) * r1, y1 = 100 + Math.sin(rad) * r1;
      const x2 = 100 + Math.cos(rad) * r2, y2 = 100 + Math.sin(rad) * r2;
      html += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"
        stroke="${major ? 'rgba(255,255,255,.55)' : 'rgba(255,255,255,.22)'}" stroke-width="${major ? 2 : 1.4}" stroke-linecap="round"/>`;
      if (major) {
        const rx = 100 + Math.cos(rad) * 56, ry = 100 + Math.sin(rad) * 56;
        html += `<text x="${rx.toFixed(1)}" y="${(ry + 3).toFixed(1)}" fill="rgba(255,255,255,.32)"
          font-family="JetBrains Mono, monospace" font-size="9" text-anchor="middle">${Math.round(i * SPD_MAX / TICKS)}</text>`;
      }
    }
    g.innerHTML = html;
  }

  function setSpeed(kmh, gear) {
    const t = clamp(kmh / SPD_MAX, 0, 1);
    el['spd-arc'].setAttribute('stroke-dasharray', `${(t * 405.3).toFixed(1)} 999`);
    el['spd-needle'].setAttribute('transform', `rotate(${(135 + t * 270).toFixed(1)} 100 100)`);
    const n = Math.round(kmh);
    if (el['spd-num'].textContent !== String(n)) el['spd-num'].textContent = n;
    el['spd-gear'].textContent = gear;
  }

  /* ---------------- hud ---------------- */
  function hudTick() {
    const P = Game.P, perf = Game.perf;
    if (!perf) return;
    const isOpen = Game.mode === 'open';
    const def = Game.track ? Game.track.def : null;

    const kmh = Math.abs(P.vF) * 3.6;
    const ratio = clamp(kmh / (perf.maxSpeed * 3.6 * 1.15), 0, 1);
    let gear;
    if (P.vF < -0.5) gear = 'R';
    else if (kmh < 1.5) gear = 'N';
    else gear = String(clamp(Math.floor(ratio * 6.4) + 1, 1, 6));
    setSpeed(kmh, gear);

    const nf = el['nitro-fill'];
    const pct = clamp(P.nitro / P.nitroMax, 0, 1);
    nf.style.width = (pct * 100).toFixed(1) + '%';
    nf.parentElement.classList.toggle('low', pct < 0.18);
    nf.parentElement.classList.toggle('charging', P.nitroOn);

    let lapTxt, lapLabel, posTxt, posLabel;
    if (isOpen) {
      const w = Game.world;
      lapLabel = 'GATES';
      lapTxt = `${P.gates}/${w ? w.gates.length : 8}`;
      posLabel = 'DIST';
      posTxt = (P.travel / 1000).toFixed(2) + ' km';
    } else {
      lapLabel = 'LAP';
      lapTxt = Game.mode === 'race' && def ? `${Math.min(P.lap, def.laps)}/${def.laps}` : `${P.lap}`;
      posLabel = 'POS';
      posTxt = `${P.position}/${P.racers}`;
    }
    if (el['hud-lap-l'].textContent !== lapLabel) el['hud-lap-l'].textContent = lapLabel;
    if (el['hud-pos-l'].textContent !== posLabel) el['hud-pos-l'].textContent = posLabel;
    if (el['hud-lap'].textContent !== lapTxt) el['hud-lap'].textContent = lapTxt;
    if (el['hud-pos'].textContent !== posTxt) el['hud-pos'].textContent = posTxt;

    const t = fmtTime(P.raceTime);
    if (el['hud-time'].textContent !== t) el['hud-time'].textContent = t;
    const cTxt = String(P.coinsRun);
    if (el['hud-coins'].textContent !== cTxt) el['hud-coins'].textContent = cTxt;

    drawMinimap();
  }

  /* ---------------- minimap ---------------- */
  function buildMinimap() {
    const w = Game.world;
    mapOpen = null; mapPts = null;
    if (w) {
      const size = 208, pad = 16;
      mapScale = (size - pad * 2) / (w.extent + w.cell);
      mapOff.x = size / 2; mapOff.y = size / 2;
      mapOpen = w;
      return;
    }
    const tr = Game.track;
    if (!tr) return;
    mapPts = [];
    let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
    for (let i = 0; i < tr.N; i += 4) {
      minX = Math.min(minX, tr.px[i]); maxX = Math.max(maxX, tr.px[i]);
      minZ = Math.min(minZ, tr.pz[i]); maxZ = Math.max(maxZ, tr.pz[i]);
      mapPts.push([tr.px[i], tr.pz[i]]);
    }
    const size = 208, pad = 26;
    mapScale = (size - pad * 2) / Math.max(maxX - minX, maxZ - minZ);
    mapOff.x = (size - (maxX + minX) * mapScale) / 2;
    mapOff.y = (size - (maxZ + minZ) * mapScale) / 2;
    mapPts = mapPts.map(p => [p[0] * mapScale + mapOff.x, p[1] * mapScale + mapOff.y]);
  }
  const toMap = (x, z) => [x * mapScale + mapOff.x, z * mapScale + mapOff.y];

  function drawMinimap() {
    const cv = el.minimap;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, 208, 208);
    const P = Game.P;

    if (mapOpen) {
      const w = mapOpen;
      ctx.strokeStyle = 'rgba(255,255,255,.16)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let k = 0; k < w.n; k++) {
        const p = -w.half + k * w.cell;
        const a1 = toMap(p, -w.half), b1 = toMap(p, w.half);
        ctx.moveTo(a1[0], a1[1]); ctx.lineTo(b1[0], b1[1]);
        const a2 = toMap(-w.half, p), b2 = toMap(w.half, p);
        ctx.moveTo(a2[0], a2[1]); ctx.lineTo(b2[0], b2[1]);
      }
      ctx.stroke();
      for (const g of w.gates) {
        if (g.taken) continue;
        const gp = toMap(g.x, g.z);
        ctx.fillStyle = 'rgba(53,224,192,.95)';
        ctx.beginPath(); ctx.arc(gp[0], gp[1], 3.6, 0, TAU); ctx.fill();
      }
    } else if (mapPts) {
      ctx.beginPath();
      for (let i = 0; i < mapPts.length; i++) {
        const p = mapPts[i];
        i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]);
      }
      ctx.closePath();
      ctx.strokeStyle = 'rgba(255,255,255,.20)';
      ctx.lineWidth = 9; ctx.lineJoin = 'round'; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.42)';
      ctx.lineWidth = 2.4; ctx.stroke();
      const rp = Game.rivals;
      if (rp) {
        ctx.fillStyle = 'rgba(255,90,31,.95)';
        for (const r of rp) {
          const mp = toMap(r.x, r.z);
          ctx.beginPath(); ctx.arc(mp[0], mp[1], 3.4, 0, TAU); ctx.fill();
        }
      }
    } else return;

    const pp = toMap(P.pos.x, P.pos.z);
    ctx.save();
    ctx.translate(pp[0], pp[1]);
    ctx.rotate(-P.yaw + Math.PI);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5, 6);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  /* ---------------- messages ---------------- */
  function message(text, sub, dur = 900) {
    el.msg.innerHTML = sub ? `${text}<small>${sub}</small>` : text;
    el.msg.classList.add('show');
    clearTimeout(msgTimer);
    msgTimer = setTimeout(() => el.msg.classList.remove('show'), dur);
  }
  function toast(text, dur = 1400) {
    el.toast.textContent = text;
    el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove('show'), dur);
  }
  function flash() {
    el.flash.classList.add('on');
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => el.flash.classList.remove('on'), 130);
  }

  /* ---------------- menu ---------------- */
  function refreshMenu() {
    const d = S.d;
    el['menu-coins'].textContent = fmtNum(d.coins);
    el['garage-coins'].textContent = fmtNum(d.coins);
    el['menu-topspeed'].textContent = Math.round(d.bestSpeed) + ' km/h';
    const car = CAR_BY_ID[d.selCar] || CAR_SPECS[0];
    const isOpen = d.selTrack === 'meridian';
    const trk = isOpen ? OPEN_CARD : (TRACK_DEFS.find(t => t.id === d.selTrack) || TRACK_DEFS[0]);
    el['menu-car'].textContent = car.name;
    el['menu-track'].textContent = trk.name;
    el['m-race-hint'].textContent = isOpen ? 'OPEN WORLD' : (trk.laps + ' LAPS');
  }

  /* ---------------- tracks ---------------- */
  function loopPathD(def, w, h, pad) {
    const pts = [];
    for (let i = 0; i <= 160; i++) {
      const a = i / 160 * TAU;
      let r = def.base;
      for (const hh of def.harm) r += hh[0] * Math.sin(hh[1] * a + hh[2]);
      pts.push([Math.cos(a) * r * def.sx, Math.sin(a) * r * def.sz]);
    }
    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    for (const p of pts) { minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
    const sc = (Math.min(w, h) - pad * 2) / Math.max(maxX - minX, maxY - minY);
    const ox = (w - (maxX + minX) * sc) / 2, oy = (h - (maxY + minY) * sc) / 2;
    return pts.map((p, i) => `${i ? 'L' : 'M'}${(p[0] * sc + ox).toFixed(1)} ${(p[1] * sc + oy).toFixed(1)}`).join(' ') + ' Z';
  }

  function cityArt() {
    let s = '';
    for (let i = 0; i <= 8; i++) {
      const p = 30 + i * 42;
      s += `<line x1="${p}" y1="10" x2="${p}" y2="290" stroke="rgba(255,255,255,.14)" stroke-width="7"/>`;
      s += `<line x1="10" y1="${p}" x2="390" y2="${p}" stroke="rgba(255,255,255,.14)" stroke-width="7"/>`;
    }
    let r = '';
    let seed = 7;
    const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
      const x = 30 + i * 42 + 9, y = 30 + j * 42 + 9;
      r += `<rect x="${x}" y="${y}" width="26" height="26" rx="2" fill="rgba(255,160,90,${(0.10 + rnd() * 0.35).toFixed(2)})"/>`;
    }
    return `<svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice">${s}${r}</svg>`;
  }

  function buildTrackCards() {
    const list = el['track-list'];
    list.innerHTML = '';
    const all = TRACK_DEFS.concat([OPEN_CARD]);
    all.forEach(def => {
      const isOpen = !!def.open;
      const th = THEMES[isOpen ? 'city' : def.theme];
      const stars = S.d.stars[def.id] || [false, false, false];
      const starTxt = isOpen ? '' : stars.map(s => s ? '★' : '☆').join('');
      const best = S.d.best[def.id] ? fmtTime(S.d.best[def.id]) : '—';
      const card = document.createElement('div');
      card.className = 'track-card' + (def.id === S.d.selTrack ? ' sel' : '');
      card.dataset.id = def.id;
      card.innerHTML = `
        <div class="track-card__art">
          ${isOpen ? cityArt() : `<svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice">
            <defs>
              <linearGradient id="g_${def.id}" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#${new THREE.Color(th.skyTop).getHexString()}"/>
                <stop offset="100%" stop-color="#${new THREE.Color(th.skyBottom).getHexString()}"/>
              </linearGradient>
            </defs>
            <rect width="400" height="300" fill="url(#g_${def.id})" opacity=".5"/>
            <path d="${loopPathD(def, 400, 300, 46)}" fill="none" stroke="rgba(0,0,0,.45)" stroke-width="13" stroke-linejoin="round"/>
            <path d="${loopPathD(def, 400, 300, 46)}" fill="none" stroke="#ffb020" stroke-width="4.5" stroke-linejoin="round"/>
          </svg>`}
        </div>
        <div class="track-card__body">
          <h3>${def.name}</h3>
          <p>${def.sub}</p>
          <div class="meta">${isOpen ? '<span>OPEN WORLD</span><span>8 GATES</span>' :
            `<span>${def.laps} LAPS</span><span>BEST ${best}</span>`}</div>
          <div class="stars">${starTxt}</div>
        </div>`;
      card.addEventListener('click', () => {
        S.d.selTrack = def.id; S.commit();
        list.querySelectorAll('.track-card').forEach(c => c.classList.toggle('sel', c.dataset.id === def.id));
        el['tracks-mode'].textContent = isOpen ? 'Open world · free roam' : 'Race · ' + def.laps + ' laps';
        el['btn-launch'].textContent = isOpen ? 'Enter the city' : 'Start engine';
        SFX.click(); refreshMenu();
      });
      list.appendChild(card);
    });
    const sel = S.d.selTrack === 'meridian';
    el['tracks-mode'].textContent = sel ? 'Open world · free roam' : 'Race · 2 laps';
    el['btn-launch'].textContent = sel ? 'Enter the city' : 'Start engine';
  }

  /* ---------------- garage ---------------- */
  function buildCarStrip() {
    const strip = el['car-strip'];
    strip.innerHTML = '';
    CAR_SPECS.forEach(spec => {
      const owned = S.d.cars.includes(spec.id);
      const chip = document.createElement('div');
      chip.className = 'car-chip' + (spec.id === S.d.selCar ? ' sel' : '') + (owned ? '' : ' locked');
      chip.dataset.id = spec.id;
      chip.innerHTML = `<div class="sw" style="background:#${new THREE.Color(spec.body).getHexString()}"></div>
        <span>${spec.name.split(' ')[0]}</span>`;
      chip.addEventListener('click', () => selectCarInGarage(spec.id));
      strip.appendChild(chip);
    });
  }

  function selectCarInGarage(id) {
    garageId = id;
    const spec = CAR_BY_ID[id];
    SFX.click();
    el['car-name'].textContent = spec.name;
    el['car-cls'].textContent = spec.cls + (S.d.cars.includes(id) ? ' · owned' : ' · ' + fmtNum(spec.price) + ' coins');
    el['car-blurb'].textContent = spec.blurb;
    ['speed', 'accel', 'grip', 'nitro'].forEach(k => {
      const v = Math.round(spec.stats[k] * 100);
      el['st-' + k].style.width = v + '%';
      el['st-' + k + '-v'].textContent = v;
    });
    const owned = S.d.cars.includes(id);
    const btn = el['btn-car'];
    if (owned) {
      btn.textContent = (S.d.selCar === id) ? 'Selected' : 'Select';
      btn.disabled = (S.d.selCar === id);
    } else {
      btn.textContent = `Buy · ${fmtNum(spec.price)}`;
      btn.disabled = S.d.coins < spec.price;
    }
    el['car-strip'].querySelectorAll('.car-chip').forEach(c => c.classList.toggle('sel', c.dataset.id === id));
    Game.showroom(id);
  }

  function carButtonAction() {
    const id = garageId || S.d.selCar;
    const spec = CAR_BY_ID[id];
    if (S.d.cars.includes(id)) {
      S.d.selCar = id; S.commit(); SFX.click(); refreshMenu();
      el['btn-car'].textContent = 'Selected';
      el['btn-car'].disabled = true;
      toast('CAR SELECTED');
    } else if (S.d.coins >= spec.price) {
      S.d.coins -= spec.price;
      S.d.cars.push(id);
      S.d.selCar = id;
      S.commit();
      SFX.levelUp();
      refreshMenu(); buildCarStrip(); selectCarInGarage(id);
      toast('UNLOCKED · ' + spec.name.toUpperCase());
    }
  }

  /* ---------------- settings ---------------- */
  function syncSettingsUI() {
    const d = S.d;
    document.querySelectorAll('#seg-quality button').forEach(b => b.classList.toggle('on', +b.dataset.q === d.quality));
    document.querySelectorAll('#seg-sound button').forEach(b => b.classList.toggle('on', (+b.dataset.s === 1) === !d.muted));
    document.querySelectorAll('#seg-handling button').forEach(b => b.classList.toggle('on', b.dataset.h === d.handling));
  }

  /* ---------------- controls ---------------- */
  const SCHEME_HINT = {
    buttons: 'Two arrows. Most reliable on any phone.',
    wheel: 'A steering wheel you drag left and right.',
    tilt: 'Tilt the phone to steer. Calibrates when you start.'
  };
  function syncControlsUI() {
    const c = S.d.controls;
    document.querySelectorAll('#seg-scheme button').forEach(b => b.classList.toggle('on', b.dataset.scheme === c.scheme));
    document.querySelectorAll('#seg-hand button').forEach(b => b.classList.toggle('on', b.dataset.hand === c.hand));
    document.querySelectorAll('#seg-size button').forEach(b => b.classList.toggle('on', +b.dataset.size === c.size));
    document.querySelectorAll('#seg-auto button').forEach(b => b.classList.toggle('on', (+b.dataset.a === 1) === !!c.autoThrottle));
    document.querySelectorAll('#seg-nitro button').forEach(b => b.classList.toggle('on', (+b.dataset.n === 1) === !!c.nitroBtn));
    document.querySelectorAll('#seg-opacity button').forEach(b => b.classList.toggle('on', +b.dataset.op === c.opacity));
    el['sens'].value = c.sens;
    el['sens-val'].textContent = (+c.sens).toFixed(2) + '×';
    el['scheme-hint'].textContent = SCHEME_HINT[c.scheme] || '';
    applyControls();
  }

  function applyControls() {
    const c = S.d.controls;
    const t = el.touch;
    if (!t) return;
    t.classList.toggle('wheel-mode', c.scheme === 'wheel');
    t.classList.toggle('swap', c.hand === 'left');
    t.classList.toggle('hide-nitro', !c.nitroBtn);
    const portrait = window.innerHeight > window.innerWidth;
    t.style.setProperty('--btn-scale', c.size * (portrait ? 0.92 : 1));
    t.style.opacity = c.opacity;
    const pad = t.querySelector('.touch__pad--right');
    if (pad) document.documentElement.style.setProperty('--pad-h', pad.offsetHeight + 'px');
  }

  /* ---------------- results ---------------- */
  function results(r) {
    el['res-title'].textContent = r.title;
    el['res-sub'].textContent = r.sub;
    el['res-stars'].textContent = (r.stars || []).map(s => s ? '★' : '☆').join('');
    el['res-time'].textContent = fmtTime(r.time);
    el['res-bestlap'].textContent = r.v2 !== undefined ? r.v2 : (r.bestLap ? fmtTime(r.bestLap) : '—');
    el['res-pos'].textContent = r.v3 !== undefined ? r.v3 : r.posText;
    el['res-speed'].textContent = Math.round(r.topSpeed) + ' km/h';
    el['res-coins'].textContent = String(r.coins);
    el['res-drift'].textContent = Math.round(r.drifts) + 's';
    el['res-reward'].textContent = '+' + fmtNum(r.reward);
    el['res-l1'].textContent = 'Time';
    el['res-l2'].textContent = r.l2 || 'Best lap';
    el['res-l3'].textContent = r.l3 || 'Position';
    el['res-l4'].textContent = 'Top speed';
    el['res-l5'].textContent = 'Coins collected';
    el['res-l6'].textContent = 'Drift time';
  }

  function loading(pct, txt) {
    el['load-fill'].style.width = (pct * 100).toFixed(0) + '%';
    if (txt) el['load-txt'].textContent = txt;
  }

  return {
    init, show, hud, hudTick, setSpeed, buildMinimap, message, toast, flash,
    refreshMenu, buildTrackCards, buildCarStrip, selectCarInGarage, carButtonAction,
    syncSettingsUI, syncControlsUI, applyControls, results, loading,
    get garageId() { return garageId; }, set garageId(v) { garageId = v; }, el
  };
})();
