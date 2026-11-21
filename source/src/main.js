/* ============================================================
   MAIN — boot, input, fullscreen, loop, race flow wiring
   ============================================================ */
(function () {
  const $ = id => document.getElementById(id);
  const keys = Object.create(null);
  const touch = { left: false, right: false, gas: false, brake: false, nitro: false };
  let tiltSteer = 0, tiltZero = null, wheelSteer = 0;
  let last = 0;
  let currentMode = 'race';

  /* ---------------- input ---------------- */
  function updateInput() {
    const c = S.d.controls;
    let steer = 0;

    if (c.scheme === 'wheel') steer = wheelSteer;
    else if (c.scheme === 'tilt' && tiltZero !== null) steer = tiltSteer;
    else {
      if (touch.left) steer -= 1;
      if (touch.right) steer += 1;
    }
    if (keys.ArrowLeft || keys.KeyA) steer = -1;
    if (keys.ArrowRight || keys.KeyD) steer = 1;
    Game.input.steer = clamp(steer * (c.sens || 1), -1, 1);

    const gasKey = keys.ArrowUp || keys.KeyW;
    const brakeKey = keys.ArrowDown || keys.KeyS;
    Game.input.throttle = (touch.gas || gasKey || (c.autoThrottle && !touch.brake && !brakeKey)) ? 1 : 0;
    Game.input.brake = (touch.brake || brakeKey) ? 1 : 0;
    Game.input.nitro = !!(touch.nitro || keys.ShiftLeft || keys.ShiftRight || keys.KeyN);
    Game.input.handbrake = !!keys.Space;
  }

  const held = [];
  function bindHold(node, on, off) {
    if (!node) return;
    held.push({ node, off });
    const start = e => {
      e.preventDefault();
      try { node.setPointerCapture(e.pointerId); } catch (err) { }
      node.classList.add('act'); on();
    };
    const end = e => {
      if (e) e.preventDefault();
      node.classList.remove('act'); off();
    };
    node.addEventListener('pointerdown', start);
    node.addEventListener('pointerup', end);
    node.addEventListener('pointercancel', end);
    node.addEventListener('lostpointercapture', end);
    node.addEventListener('contextmenu', e => e.preventDefault());
  }
  function releaseAll() { for (const r of held) { r.node.classList.remove('act'); r.off(); } }

  function wireTouch() {
    bindHold($('t-left'), () => touch.left = true, () => touch.left = false);
    bindHold($('t-right'), () => touch.right = true, () => touch.right = false);
    bindHold($('t-gas'), () => touch.gas = true, () => touch.gas = false);
    bindHold($('t-brake'), () => touch.brake = true, () => touch.brake = false);
    bindHold($('t-nitro'), () => { touch.nitro = true; SFX.whoosh(); }, () => touch.nitro = false);
  }

  function wireWheel() {
    const w = $('wheel');
    if (!w) return;
    const ring = w.querySelector('.wheel__ring');
    let active = false, startX = 0, pid = null;
    const down = e => {
      e.preventDefault();
      active = true; startX = e.clientX; pid = e.pointerId;
      try { w.setPointerCapture(pid); } catch (err) { }
      ring.classList.add('act');
    };
    const move = e => {
      if (!active) return;
      e.preventDefault();
      wheelSteer = clamp((e.clientX - startX) / 72, -1, 1);
      ring.style.transform = `rotate(${(wheelSteer * 115).toFixed(1)}deg)`;
    };
    const up = () => {
      active = false; wheelSteer = 0;
      ring.classList.remove('act');
      ring.style.transform = 'rotate(0deg)';
    };
    w.addEventListener('pointerdown', down);
    w.addEventListener('pointermove', move);
    w.addEventListener('pointerup', up);
    w.addEventListener('pointercancel', up);
    w.addEventListener('lostpointercapture', up);
    w.addEventListener('contextmenu', e => e.preventDefault());
  }

  function wireKeys() {
    window.addEventListener('keydown', e => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      keys[e.code] = true;
      if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
      if (e.code === 'KeyC') Game.cycleCamera();
      if (e.code === 'KeyR' && Game.state === 'race') restartRace();
      if (e.code === 'KeyF') toggleFullscreen();
      if (e.code === 'Enter' && document.body.dataset.screen === 'menu') startSelected('race');
    });
    window.addEventListener('keyup', e => { keys[e.code] = false; });
    window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; releaseAll(); });
    window.addEventListener('pointerup', () => releaseAll());
    window.addEventListener('pointercancel', () => releaseAll());
  }

  /* ---------------- tilt ---------------- */
  function onOrient(e) {
    const portrait = window.innerHeight > window.innerWidth;
    const v = portrait ? e.gamma : e.beta;
    if (v === null || v === undefined) return;
    if (tiltZero === null) tiltZero = v;
    tiltSteer = clamp((v - tiltZero) / 20, -1, 1);
  }
  function setTilt(on) {
    if (!on) {
      window.removeEventListener('deviceorientation', onOrient);
      tiltZero = null; tiltSteer = 0;
      return;
    }
    const attach = () => {
      window.addEventListener('deviceorientation', onOrient);
      tiltZero = null;
      UI.toast('TILT READY — HOLD PHONE LEVEL');
    };
    if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) {
      DeviceOrientationEvent.requestPermission().then(r => {
        if (r === 'granted') attach();
        else UI.toast('TILT NOT ALLOWED');
      }).catch(() => { });
    } else if (typeof DeviceOrientationEvent !== 'undefined') {
      attach();
    } else UI.toast('NO TILT SENSOR');
  }

  /* ---------------- fullscreen ---------------- */
  function fsElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement;
  }
  function syncFsButtons() {
    const on = !!fsElement();
    ['m-full', 'btn-full'].forEach(id => {
      const b = $(id);
      if (b) { b.classList.toggle('fs-on', on); b.textContent = on ? '⤡' : '⛶'; b.title = on ? 'Exit fullscreen' : 'Fullscreen'; }
    });
  }
  async function toggleFullscreen() {
    SFX.click();
    const el = document.documentElement;
    try {
      if (!fsElement()) {
        if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
        else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
        else if (el.msRequestFullscreen) el.msRequestFullscreen();
        else {
          UI.toast('USE “ADD TO HOME SCREEN” FOR FULLSCREEN', 2600);
          return;
        }
      } else {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        else if (document.msExitFullscreen) document.msExitFullscreen();
      }
    } catch (e) {
      UI.toast('FULLSCREEN BLOCKED BY BROWSER', 2200);
    }
    setTimeout(() => { syncFsButtons(); Game.resize(); UI.applyControls(); }, 120);
  }

  /* ---------------- race flow ---------------- */
  function startSelected(mode) {
    const isOpen = S.d.selTrack === 'meridian';
    startRace(isOpen ? 'open' : mode);
  }

  function startRace(mode) {
    currentMode = mode || 'race';
    SFX.resume();
    if (S.d.muted) SFX.setMuted(true);
    Game.setHandling(S.d.handling);
    UI.show(null);
    UI.hud(true);
    UI.garageId = null;
    Game.startRace(S.d.selTrack, S.d.selCar, currentMode);
    UI.buildMinimap();
    UI.applyControls();
    UI.message('', null, 1);
    document.body.dataset.screen = 'race';
    if (window.innerHeight > window.innerWidth && !S.d.sawHint) {
      S.d.sawHint = true; S.commit();
      const rh = $('rotate-hint');
      if (rh) { rh.classList.add('show'); setTimeout(() => rh.classList.remove('show'), 4200); }
    }
  }

  function restartRace() { startRace(currentMode); }

  function togglePause() {
    const st = Game.state;
    if (st === 'race' || st === 'countdown') {
      Game.pause();
      UI.show('pause');
      SFX.click();
    } else if (st === 'paused') {
      Game.resume();
      UI.show(null);
      document.body.dataset.screen = 'race';
      SFX.click();
    }
  }

  function bankRun() {
    if ((currentMode === 'free' || currentMode === 'open') &&
        (Game.state === 'race' || Game.state === 'paused') && Game.P.coinsRun > 0) {
      const bonus = Game.P.coinsRun * 4;
      S.d.coins += bonus;
      S.d.totalCoins += Game.P.coinsRun;
      S.d.bestSpeed = Math.max(S.d.bestSpeed, Game.P.topSpeed);
      S.commit();
      UI.toast('+' + fmtNum(bonus) + ' COINS BANKED', 2000);
    }
  }

  function quitRace() {
    bankRun();
    Game.state = 'menu';
    Game.hooks.onTick = null;
    UI.hud(false);
    UI.show('menu');
    UI.refreshMenu();
    UI.buildTrackCards();
    SFX.engineOff();
    SFX.nitro(false);
    document.body.dataset.screen = 'menu';
  }

  function onFinish(data) {
    const def = Game.track.def;
    const stars = [true, data.time <= def.targetTime, data.coins >= def.targetCoins];
    const posBonus = Math.max(0, (data.racers - data.position)) * 150;
    const reward = Math.round(def.reward + posBonus + data.coins * 4 + (stars[1] ? 180 : 0));

    S.d.coins += reward;
    S.d.totalCoins += data.coins;
    S.d.runs++;
    S.d.bestSpeed = Math.max(S.d.bestSpeed, data.topSpeed);
    const prevBest = S.d.best[def.id];
    const isBest = !prevBest || data.time < prevBest;
    if (isBest) S.d.best[def.id] = data.time;
    const prevStars = S.d.stars[def.id] || [false, false, false];
    S.d.stars[def.id] = stars.map((s, i) => s || prevStars[i]);
    S.commit();

    Game.state = 'finished';
    const bestLap = data.lapTimes.length ? Math.min.apply(null, data.lapTimes) : 0;
    UI.hud(false);
    UI.results({
      title: data.position === 1 ? 'Victory' : (isBest ? 'New record' : 'Race complete'),
      sub: def.name + ' · ' + (data.position === 1 ? 'P1 finish' : 'P' + data.position) + (isBest ? ' · best time' : ''),
      stars: S.d.stars[def.id],
      time: data.time, bestLap, posText: `${data.position} / ${data.racers}`,
      topSpeed: data.topSpeed, coins: data.coins, drifts: data.drifts, reward
    });
    UI.show('results');
    document.body.dataset.screen = 'results';
    if (stars[1] && stars[2]) SFX.levelUp();
    UI.refreshMenu();
  }

  function onFinishOpen(d) {
    const reward = Math.round(300 + d.coins * 4 + d.gates * 60 + Math.round(d.travel / 100) * 2);
    S.d.coins += reward;
    S.d.totalCoins += d.coins;
    S.d.bestSpeed = Math.max(S.d.bestSpeed, d.topSpeed);
    S.d.gatesBest = Math.max(S.d.gatesBest || 0, d.gates);
    S.d.distBest = Math.max(S.d.distBest || 0, Math.round(d.travel));
    S.commit();
    Game.state = 'finished';
    UI.hud(false);
    UI.results({
      title: 'City run complete',
      sub: 'Meridian City · every gate found',
      stars: [true, true, true],
      time: d.time, bestLap: 0, v2: `${d.gates} / ${d.gatesTotal}`, v3: (d.travel / 1000).toFixed(2) + ' km',
      topSpeed: d.topSpeed, coins: d.coins, drifts: d.drifts, reward,
      l2: 'Gates found', l3: 'Distance'
    });
    UI.show('results');
    document.body.dataset.screen = 'results';
    SFX.levelUp();
    UI.refreshMenu();
  }

  /* ---------------- hooks ---------------- */
  function wireHooks() {
    Game.hooks.onCount = n => UI.message(String(n), null, 620);
    Game.hooks.onGo = () => { UI.message('GO', null, 700); SFX.whoosh(); };
    Game.hooks.onLap = (lap, t) => {
      const def = Game.track.def;
      if (lap <= def.laps) UI.message('LAP ' + lap, fmtTime(t), 1100);
      if (lap === def.laps) UI.toast('FINAL LAP');
    };
    Game.hooks.onCoin = n => { if (n % 10 === 0) UI.toast('+' + n + ' COINS'); };
    Game.hooks.onGate = (n, total) => {
      UI.toast('GATE ' + n + ' / ' + total, 1100);
      UI.message(n === total ? 'ALL GATES' : '+GATE', n === total ? 'run complete' : null, 900);
    };
    Game.hooks.onCrash = () => { UI.flash(); };
    Game.hooks.onWall = () => { UI.flash(); };
    Game.hooks.onOvertake = p => { UI.toast('POSITION ' + p); };
    Game.hooks.onFinish = onFinish;
    Game.hooks.onFinishOpen = onFinishOpen;
    Game.hooks.onTick = () => { };
  }

  /* ---------------- screens ---------------- */
  function wireScreens() {
    $('m-race').addEventListener('click', () => { SFX.resume(); SFX.click(); startSelected('race'); });
    $('m-free').addEventListener('click', () => { SFX.resume(); SFX.click(); startSelected('free'); });
    $('m-garage').addEventListener('click', () => {
      SFX.click(); UI.show('garage');
      Game.state = 'showroom';
      UI.buildCarStrip();
      UI.selectCarInGarage(S.d.selCar);
      document.body.dataset.screen = 'garage';
    });
    $('m-tracks').addEventListener('click', () => {
      SFX.click(); UI.buildTrackCards(); UI.show('tracks');
      document.body.dataset.screen = 'tracks';
    });
    $('m-settings').addEventListener('click', () => {
      SFX.click(); UI.syncSettingsUI(); UI.show('settings');
      document.body.dataset.screen = 'settings';
    });
    $('m-controls').addEventListener('click', () => {
      SFX.click(); UI.syncControlsUI(); UI.show('controls');
      document.body.dataset.screen = 'controls';
    });
    $('p-controls').addEventListener('click', () => {
      SFX.click(); UI.syncControlsUI(); UI.show('controls');
      document.body.dataset.screen = 'controls';
    });

    document.querySelectorAll('[data-back]').forEach(b => {
      b.addEventListener('click', () => {
        SFX.click();
        const target = b.dataset.back;
        if (target === 'menu' && document.body.dataset.screen === 'controls' && Game.state === 'paused') {
          UI.show('pause');
          document.body.dataset.screen = 'pause';
          return;
        }
        UI.show(target);
        if (target === 'menu') { Game.state = 'menu'; UI.refreshMenu(); }
        document.body.dataset.screen = target;
      });
    });

    $('btn-launch').addEventListener('click', () => { SFX.click(); startSelected('race'); });
    $('btn-car').addEventListener('click', () => UI.carButtonAction());

    $('btn-pause').addEventListener('click', e => { e.stopPropagation(); togglePause(); });
    $('btn-cam').addEventListener('click', e => {
      e.stopPropagation();
      const m = Game.cycleCamera();
      UI.toast(['CHASE CAM', 'HOOD CAM', 'FAR CAM'][m], 900);
      SFX.click();
    });
    $('btn-full').addEventListener('click', e => { e.stopPropagation(); toggleFullscreen(); });
    $('m-full').addEventListener('click', toggleFullscreen);

    $('p-resume').addEventListener('click', () => togglePause());
    $('p-restart').addEventListener('click', () => { SFX.click(); UI.show(null); restartRace(); });
    $('p-cam').addEventListener('click', () => { const m = Game.cycleCamera(); UI.toast(['CHASE CAM', 'HOOD CAM', 'FAR CAM'][m], 900); });
    $('p-quit').addEventListener('click', () => { SFX.click(); quitRace(); });

    $('res-retry').addEventListener('click', () => { SFX.click(); startRace(currentMode); });
    $('res-menu').addEventListener('click', () => { SFX.click(); quitRace(); });

    $('seg-quality').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      S.d.quality = +b.dataset.q; S.commit();
      Game.setQuality(S.d.quality); UI.syncSettingsUI(); SFX.click();
      UI.toast(['LOW DETAIL', 'MEDIUM DETAIL', 'HIGH DETAIL'][S.d.quality]);
    });
    $('seg-handling').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      S.d.handling = b.dataset.h; S.commit();
      Game.setHandling(S.d.handling); UI.syncSettingsUI(); SFX.click();
      UI.toast(b.dataset.h.toUpperCase() + ' DRIVING');
    });
    $('seg-sound').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      S.d.muted = +b.dataset.s === 0; S.commit();
      SFX.setMuted(S.d.muted); UI.syncSettingsUI();
      if (!S.d.muted) { SFX.resume(); SFX.click(); }
    });
    $('btn-reset').addEventListener('click', () => {
      if (confirm('Reset all progress? Coins, cars and records will be cleared.')) {
        S.reset(); UI.refreshMenu(); UI.buildCarStrip(); UI.buildTrackCards();
        UI.syncSettingsUI(); UI.syncControlsUI();
        Game.setQuality(S.d.quality); Game.setHandling(S.d.handling);
        UI.toast('PROGRESS RESET');
      }
    });

    const c = () => S.d.controls;
    const saveC = () => { S.commit(); UI.syncControlsUI(); };
    $('seg-scheme').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      c().scheme = b.dataset.scheme;
      if (b.dataset.scheme === 'tilt') setTilt(true); else setTilt(false);
      saveC(); SFX.click();
    });
    $('seg-hand').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      c().hand = b.dataset.hand; saveC(); SFX.click();
    });
    $('seg-size').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      c().size = +b.dataset.size; saveC(); SFX.click();
    });
    $('seg-auto').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      c().autoThrottle = +b.dataset.a === 1; saveC(); SFX.click();
    });
    $('seg-nitro').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      c().nitroBtn = +b.dataset.n === 1; saveC(); SFX.click();
    });
    $('seg-opacity').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      c().opacity = +b.dataset.op; saveC(); SFX.click();
    });
    $('sens').addEventListener('input', e => {
      c().sens = +e.target.value; saveC();
    });
    $('ctl-reset').addEventListener('click', () => {
      S.d.controls = Object.assign({}, DEFAULT_CONTROLS);
      S.commit(); UI.syncControlsUI(); SFX.click();
      UI.toast('CONTROLS RESET');
    });

    const stage = document.querySelector('.garage__stage');
    let dragging = false, lastX = 0;
    stage.addEventListener('pointerdown', e => { dragging = true; lastX = e.clientX; });
    window.addEventListener('pointermove', e => {
      if (!dragging) return;
      const dx = e.clientX - lastX; lastX = e.clientX;
      Game.orbit(dx * 0.012);
    });
    window.addEventListener('pointerup', () => dragging = false);
    window.addEventListener('pointercancel', () => dragging = false);

    document.addEventListener('fullscreenchange', syncFsButtons);
    document.addEventListener('webkitfullscreenchange', syncFsButtons);
  }

  /* ---------------- loop ---------------- */
  function loop() {
    requestAnimationFrame(loop);
    const now = performance.now();
    let dt = (now - last) / 1000;
    last = now;
    if (!isFinite(dt) || dt <= 0) dt = 1 / 60;
    dt = Math.min(dt, 0.05);

    updateInput();
    if (Game.state === 'race' || Game.state === 'countdown') UI.hudTick();
    Game.update(dt);
  }

  /* ---------------- boot ---------------- */
  function boot() {
    try {
      UI.init();
      Game.init($('gl'));
      Game.setQuality(S.d.quality);
      Game.setHandling(S.d.handling);
      SFX.setMuted(S.d.muted);
      wireHooks();
      wireScreens();
      wireTouch();
      wireWheel();
      wireKeys();
      if (S.d.controls.scheme === 'tilt') setTilt(true);
      syncFsButtons();

      const unlock = () => {
        SFX.init(); SFX.resume();
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('keydown', unlock);
      };
      window.addEventListener('pointerdown', unlock);
      window.addEventListener('keydown', unlock);

      let p = 0;
      const step = () => {
        p += 0.14 + Math.random() * 0.1;
        UI.loading(Math.min(p, 1), p > 0.85 ? 'ready to race' : (p > 0.5 ? 'tuning engines…' : 'building circuits…'));
        if (p < 1) setTimeout(step, 90);
        else {
          setTimeout(() => {
            UI.show('menu');
            UI.refreshMenu();
            UI.loading(1, 'ready');
            Game.state = 'menu';
            document.body.dataset.screen = 'menu';
            last = performance.now();
            loop();
          }, 220);
        }
      };
      step();

      document.addEventListener('visibilitychange', () => {
        if (document.hidden && (Game.state === 'race' || Game.state === 'countdown')) {
          Game.pause(); UI.show('pause');
        }
      });
      window.addEventListener('contextmenu', e => {
        if (document.body.dataset.screen === 'race') e.preventDefault();
      });
      window.addEventListener('resize', () => { Game.resize(); UI.applyControls(); });
      window.addEventListener('orientationchange', () => setTimeout(() => { Game.resize(); UI.applyControls(); }, 250));
    } catch (err) {
      console.error(err);
      const t = document.getElementById('load-txt');
      if (t) t.textContent = 'WebGL not available on this device';
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
