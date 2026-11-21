/* ============================================================
   AUDIO — 100% procedural Web Audio. No samples downloaded.
   Engine = detuned saw stack + sub square through a soft-clip
   waveshaper and a tracking low-pass, plus intake noise.
   ============================================================ */
const SFX = (() => {
  let ctx = null, master = null, bus = null, noiseBuf = null;
  let eng = null, skidN = null, windN = null, nitroN = null, boostOsc = null;
  let muted = false, started = false;

  function makeNoise(seconds = 2) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const b = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;      // slightly pink
      d[i] = w * 0.7 + last * 3;
    }
    return b;
  }

  function noiseSource(loop = true) {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf; s.loop = loop;
    return s;
  }

  function distortion(k = 22) {
    const ws = ctx.createWaveShaper();
    const n = 1024, curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
    }
    ws.curve = curve; ws.oversample = '2x';
    return ws;
  }

  function init() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try { ctx = new AC(); } catch (e) { return false; }

    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 22;
    comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.22;
    comp.connect(master); master.connect(ctx.destination);
    bus = comp;
    noiseBuf = makeNoise(2);

    /* ---- engine ---- */
    const eGain = ctx.createGain(); eGain.gain.value = 0;
    const eLP = ctx.createBiquadFilter(); eLP.type = 'lowpass';
    eLP.frequency.value = 700; eLP.Q.value = 5.5;
    const shaper = distortion(14);
    shaper.connect(eLP); eLP.connect(eGain); eGain.connect(bus);

    const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 60;
    const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 90; o2.detune.value = 9;
    const o3 = ctx.createOscillator(); o3.type = 'square';   o3.frequency.value = 30;
    const g1 = ctx.createGain(); g1.gain.value = 0.55;
    const g2 = ctx.createGain(); g2.gain.value = 0.34;
    const g3 = ctx.createGain(); g3.gain.value = 0.22;
    o1.connect(g1); o2.connect(g2); o3.connect(g3);
    g1.connect(shaper); g2.connect(shaper); g3.connect(shaper);
    o1.start(); o2.start(); o3.start();

    const intake = noiseSource(); const iBP = ctx.createBiquadFilter();
    iBP.type = 'bandpass'; iBP.frequency.value = 1400; iBP.Q.value = 0.9;
    const iG = ctx.createGain(); iG.gain.value = 0.0;
    intake.connect(iBP); iBP.connect(iG); iG.connect(eGain);
    intake.start();

    eng = { o1, o2, o3, eGain, eLP, iG };

    /* ---- tyre skid ---- */
    const sk = noiseSource(); const skBP = ctx.createBiquadFilter();
    skBP.type = 'bandpass'; skBP.frequency.value = 2100; skBP.Q.value = 2.6;
    const skG = ctx.createGain(); skG.gain.value = 0;
    sk.connect(skBP); skBP.connect(skG); skG.connect(bus); sk.start();
    skidN = { g: skG, f: skBP };

    /* ---- wind ---- */
    const wn = noiseSource(); const wnLP = ctx.createBiquadFilter();
    wnLP.type = 'lowpass'; wnLP.frequency.value = 760;
    const wnG = ctx.createGain(); wnG.gain.value = 0;
    wn.connect(wnLP); wnLP.connect(wnG); wnG.connect(bus); wn.start();
    windN = { g: wnG, f: wnLP };

    /* ---- nitro ---- */
    const nn = noiseSource(); const nnHP = ctx.createBiquadFilter();
    nnHP.type = 'highpass'; nnHP.frequency.value = 900;
    const nnG = ctx.createGain(); nnG.gain.value = 0;
    nn.connect(nnHP); nnHP.connect(nnG); nnG.connect(bus); nn.start();
    const bo = ctx.createOscillator(); bo.type = 'triangle'; bo.frequency.value = 180;
    const boG = ctx.createGain(); boG.gain.value = 0;
    bo.connect(boG); boG.connect(bus); bo.start();
    nitroN = { g: nnG, f: nnHP }; boostOsc = { o: bo, g: boG };

    started = true;
    return true;
  }

  function resume() {
    if (!ctx) init();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function setMuted(m) {
    muted = m;
    if (master) master.gain.setTargetAtTime(m ? 0 : 0.9, ctx.currentTime, 0.05);
  }
  function isMuted() { return muted; }

  /* live engine update: rpm 0..1, load 0..1, speed 0..1 */
  function engine(rpm, load, speed) {
    if (!eng || !ctx) return;
    const t = ctx.currentTime;
    const f = 46 + rpm * 232;
    eng.o1.frequency.setTargetAtTime(f, t, 0.045);
    eng.o2.frequency.setTargetAtTime(f * 1.503, t, 0.045);
    eng.o3.frequency.setTargetAtTime(f * 0.5, t, 0.05);
    eng.eLP.frequency.setTargetAtTime(420 + rpm * 2600 + load * 900, t, 0.06);
    eng.eGain.gain.setTargetAtTime(0.055 + load * 0.10 + speed * 0.05, t, 0.07);
    eng.iG.gain.setTargetAtTime(0.012 + load * 0.05, t, 0.08);
  }
  function engineOff() {
    if (!eng || !ctx) return;
    eng.eGain.gain.setTargetAtTime(0, ctx.currentTime, 0.12);
    if (skidN) skidN.g.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
    if (windN) windN.g.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
  }
  function skid(a) {
    if (!skidN || !ctx) return;
    skidN.g.gain.setTargetAtTime(Math.min(0.14, a * 0.14), ctx.currentTime, 0.05);
    skidN.f.frequency.setTargetAtTime(1700 + a * 1400, ctx.currentTime, 0.1);
  }
  function wind(s) {
    if (!windN || !ctx) return;
    windN.g.gain.setTargetAtTime(Math.min(0.09, s * 0.09), ctx.currentTime, 0.15);
    windN.f.frequency.setTargetAtTime(500 + s * 900, ctx.currentTime, 0.2);
  }
  function nitro(on, strength = 1) {
    if (!nitroN || !ctx) return;
    const t = ctx.currentTime;
    nitroN.g.gain.setTargetAtTime(on ? 0.11 * strength : 0, t, on ? 0.06 : 0.18);
    nitroN.f.frequency.setTargetAtTime(on ? 1500 : 900, t, 0.1);
    boostOsc.g.gain.setTargetAtTime(on ? 0.05 : 0, t, on ? 0.08 : 0.2);
    boostOsc.o.frequency.setTargetAtTime(on ? 240 : 150, t, 0.2);
  }

  /* one-shots */
  function blip(freq, dur, type = 'sine', vol = 0.2, slideTo = null) {
    if (!ctx || muted || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.02);
  }
  function coin() {
    if (!ctx || muted || ctx.state !== 'running') return;
    try {
      blip(1180, 0.07, 'triangle', 0.13);
      setTimeout(() => blip(1760, 0.1, 'triangle', 0.10), 55);
    } catch (e) { }
  }
  function crash(power = 1) {
    if (!ctx || muted || ctx.state !== 'running') return;
    try { _crash(power); } catch (e) { }
  }
  function _crash(power = 1) {
    const t = ctx.currentTime;
    const s = noiseSource(false);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(2600 * power + 400, t);
    lp.frequency.exponentialRampToValueAtTime(180, t + 0.42);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.36 * power, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    s.connect(lp); lp.connect(g); g.connect(bus);
    s.start(t); s.stop(t + 0.55);
    blip(70, 0.25, 'square', 0.18 * power, 40);
  }
  function beep(high = false) { blip(high ? 1040 : 620, high ? 0.4 : 0.16, 'square', 0.14); }
  function click() { blip(1500, 0.03, 'square', 0.06, 900); }
  function whoosh() {
    if (!ctx || muted || ctx.state !== 'running') return;
    try { _whoosh(); } catch (e) { }
  }
  function _whoosh() {
    const t = ctx.currentTime;
    const s = noiseSource(false);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.1;
    bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(2400, t + 0.35);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    s.connect(bp); bp.connect(g); g.connect(bus); s.start(t); s.stop(t + 0.5);
  }
  function levelUp() {
    try {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.16, 'triangle', 0.12), i * 85));
    } catch (e) { }
  }

  return {
    init, resume, setMuted, isMuted, engine, engineOff, skid, wind, nitro,
    coin, crash, beep, click, whoosh, levelUp,
    get ready() { return started; }
  };
})();
