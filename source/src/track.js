/* ============================================================
   TRACKS — procedural closed circuits + environments
   Road, kerbs, markings, armco, terrain, scenery, sky, lights.
   ============================================================ */
const THEMES = {
  coast: {
    skyTop: 0x0d4f8c, skyBottom: 0xffb277, sun: 0xffe3bd, sunInt: 1.55, sunPos: [-0.55, 0.34, 0.4],
    hemiSky: 0xa9d3f5, hemiGround: 0x9c8f66, hemiInt: 0.45,
    fog: 0xe6c3a0, fogNear: 130, fogFar: 900,
    ground: 0x8e8460, groundTex: 'grass', road: 0xd6dae0, sea: 0x2e7fa8, night: false,
    mountain: 0x5b5069, propSet: 'coast'
  },
  canyon: {
    skyTop: 0x1f5c9c, skyBottom: 0xf7c294, sun: 0xfff0cf, sunInt: 1.7, sunPos: [0.5, 0.55, -0.3],
    hemiSky: 0xcfe4f7, hemiGround: 0xa8714a, hemiInt: 0.42,
    fog: 0xdcb28a, fogNear: 110, fogFar: 780,
    ground: 0x8a5730, groundTex: 'dirt', road: 0xd8d4cc, sea: null, night: false,
    mountain: 0x8a5236, propSet: 'canyon'
  },
  city: {
    skyTop: 0x080d1c, skyBottom: 0x3a2b46, sun: 0x9fc0ff, sunInt: 0.50, sunPos: [-0.3, 0.7, 0.5],
    hemiSky: 0x2a3550, hemiGround: 0x120f16, hemiInt: 0.40,
    fog: 0x141828, fogNear: 50, fogFar: 620,
    ground: 0x1a1d24, groundTex: 'asphalt', road: 0x9aa0aa, sea: null, night: true,
    mountain: 0x161a28, propSet: 'city'
  }
};

const TRACK_DEFS = [
  {
    id: 'coast', name: 'Costa Verde', sub: 'Coastal Highway · Golden Hour', theme: 'coast',
    base: 232, harm: [[57.6, 2, 5.905], [27.8, 4, 2.430]], sx: 1.14, sz: 1.0,
    width: 17, laps: 2, difficulty: 1, targetTime: 120000, targetCoins: 20, reward: 520,
    desc: 'Sun-bleached cliffs, palms and open sea. Fast sweepers.'
  },
  {
    id: 'canyon', name: 'Redrock Canyon', sub: 'Desert Gorge · High Noon', theme: 'canyon',
    base: 212, harm: [[24.2, 4, 2.625], [8.7, 5, 4.683], [50.2, 3, 2.602]], sx: 1.0, sz: 1.12,
    width: 16, laps: 2, difficulty: 2, targetTime: 115000, targetCoins: 20, reward: 720,
    desc: 'Tight canyon walls, blind crests and hard braking zones.'
  },
  {
    id: 'city', name: 'Neo Harbour', sub: 'Downtown Night · Wet Asphalt', theme: 'city',
    base: 252, harm: [[45.2, 2, 0.598], [57.5, 3, 5.304]], sx: 1.05, sz: 0.95,
    width: 18, laps: 2, difficulty: 3, targetTime: 128000, targetCoins: 22, reward: 900,
    desc: 'Neon towers, long straights and a midnight skyline.'
  }
];

/* ---------------- shared textures ---------------- */
const TexCache = {};
function tex(name, fn) { return TexCache[name] || (TexCache[name] = fn()); }

function asphaltTex() {
  return tex('asphalt', () => makeTex(512, 512, (x, w, h) => {
    noiseFill(x, w, h, '#4a4e56', 90, 14000, 0.30);
    x.globalAlpha = 0.10;
    for (let i = 0; i < 90; i++) {
      x.strokeStyle = Math.random() > .5 ? '#20242a' : '#585e66';
      x.lineWidth = Math.random() * 1.6 + 0.4;
      x.beginPath();
      let px = Math.random() * w, py = Math.random() * h;
      x.moveTo(px, py);
      for (let k = 0; k < 4; k++) { px += (Math.random() - .5) * 90; py += (Math.random() - .5) * 90; x.lineTo(px, py); }
      x.stroke();
    }
    x.globalAlpha = 1;
  }));
}
function curbTex() {
  return tex('curb', () => makeTex(64, 256, (x, w, h) => {
    for (let i = 0; i < 8; i++) {
      x.fillStyle = i % 2 ? '#f2f2ee' : '#d8342a';
      x.fillRect(0, i * h / 8, w, h / 8);
    }
    noiseFill2(x, w, h, 0.06);
  }));
}
function noiseFill2(x, w, h, a) {
  x.globalAlpha = a;
  for (let i = 0; i < 2500; i++) {
    const g = (Math.random() * 255) | 0;
    x.fillStyle = `rgb(${g},${g},${g})`;
    x.fillRect(Math.random() * w, Math.random() * h, 1.6, 1.6);
  }
  x.globalAlpha = 1;
}
function dashTex() {
  return tex('dash', () => makeTex(32, 128, (x, w, h) => {
    x.clearRect(0, 0, w, h);
    x.fillStyle = '#f5f2e6';
    x.fillRect(4, 0, w - 8, h * 0.42);
  }));
}
function lineTex() {
  return tex('line', () => makeTex(16, 16, (x, w, h) => { x.fillStyle = '#eceae0'; x.fillRect(0, 0, w, h); }));
}
function checkTex() {
  return tex('check', () => makeTex(256, 64, (x, w, h) => {
    const c = 32;
    for (let i = 0; i < w / c; i++) for (let j = 0; j < h / c; j++) {
      x.fillStyle = (i + j) % 2 ? '#0d0f12' : '#f2f2ee';
      x.fillRect(i * c, j * c, c, c);
    }
  }));
}
function groundTex(kind, color) {
  return tex('g_' + kind, () => makeTex(256, 256, (x, w, h) => {
    x.fillStyle = '#' + new THREE.Color(color).getHexString();
    x.fillRect(0, 0, w, h);
    const base = new THREE.Color(color);
    for (let i = 0; i < 9000; i++) {
      const v = (Math.random() - .5) * 0.30;
      const c = base.clone().offsetHSL(0, 0, v);
      x.fillStyle = '#' + c.getHexString();
      const s = Math.random() * 3 + 1;
      x.fillRect(Math.random() * w, Math.random() * h, s, s);
    }
    if (kind === 'grass') {
      for (let i = 0; i < 1400; i++) {
        x.fillStyle = `rgba(${150 + Math.random() * 50 | 0},${140 + Math.random() * 40 | 0},${90 + Math.random() * 40 | 0},.35)`;
        x.beginPath(); x.arc(Math.random() * w, Math.random() * h, 1 + Math.random() * 4, 0, TAU); x.fill();
      }
      for (let i = 0; i < 1800; i++) {
        x.strokeStyle = `rgba(${60 + Math.random() * 60 | 0},${110 + Math.random() * 70 | 0},${50 + Math.random() * 40 | 0},.5)`;
        x.beginPath(); const px = Math.random() * w, py = Math.random() * h;
        x.moveTo(px, py); x.lineTo(px + (Math.random() - .5) * 4, py - Math.random() * 6); x.stroke();
      }
    }
  }, { aniso: 8 }));
}
function windowTex() {
  return tex('windows', () => makeTex(128, 256, (x, w, h) => {
    x.fillStyle = '#0a0d14'; x.fillRect(0, 0, w, h);
    for (let yy = 6; yy < h - 6; yy += 12) {
      for (let xx = 6; xx < w - 6; xx += 12) {
        const on = Math.random();
        if (on > 0.42) {
          const hue = on > 0.93 ? '#7fd8ff' : (on > 0.85 ? '#ffcf8a' : '#ffd9a0');
          x.fillStyle = hue; x.globalAlpha = 0.35 + Math.random() * 0.65;
          x.fillRect(xx, yy, 7, 8);
        } else {
          x.fillStyle = '#12161f'; x.fillRect(xx, yy, 7, 8);
        }
      }
    }
    x.globalAlpha = 1;
  }));
}

/* ============================================================
   TRACK
   ============================================================ */
class Track {
  constructor(def, quality) {
    this.def = def;
    this.theme = THEMES[def.theme];
    this.quality = quality;             // 0 low, 1 med, 2 high
    this.group = new THREE.Group();
    this.halfW = def.width / 2;
    this.wallOff = this.halfW + 4.6;
    this.N = 1100;
    this.props = [];
  }

  /* ---------- build ---------- */
  build() {
    const d = this.def, th = this.theme;
    this._makeCurve();
    this._makeSamples();
    this._makeGrid();

    const g = this.group;
    g.name = 'track';

    /* ground */
    const gSize = (th.sea !== null && th.sea !== undefined) ? 1250 : 2600;
    const gt = groundTex(th.groundTex, th.ground);
    gt.repeat.set(gSize / 26, gSize / 26);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(gSize, gSize),
      new THREE.MeshStandardMaterial({ map: gt, roughness: 1, metalness: 0 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.06;
    ground.receiveShadow = false;
    g.add(ground);

    if (th.sea !== null && th.sea !== undefined) {
      const st = makeTex(256, 256, (x, w, h) => {
        x.fillStyle = '#2f7fa4'; x.fillRect(0, 0, w, h);
        for (let i = 0; i < 900; i++) {
          x.strokeStyle = `rgba(255,255,255,${0.04 + Math.random() * 0.10})`;
          x.lineWidth = Math.random() * 1.6;
          const px = Math.random() * w, py = Math.random() * h, ww = 6 + Math.random() * 26;
          x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + ww / 2, py - 3, px + ww, py); x.stroke();
        }
      }, { repeat: [70, 70] });
      const sea = new THREE.Mesh(
        new THREE.PlaneGeometry(9000, 9000),
        new THREE.MeshStandardMaterial({ map: st, color: th.sea, roughness: 0.42, metalness: 0.22 })
      );
      sea.rotation.x = -Math.PI / 2;
      sea.position.y = -0.75;
      g.add(sea);
      this.sea = sea;
    }

    /* road surface */
    const asph = asphaltTex();
    asph.repeat.set(1, 1);
    const road = new THREE.Mesh(
      this._ribbon(-this.halfW, this.halfW, 0.02, 1 / 8, 1 / 8),
      new THREE.MeshStandardMaterial({ map: asph, color: th.road, roughness: 0.86, metalness: 0.06 })
    );
    road.receiveShadow = true;
    g.add(road);

    /* tyre-wear bands */
    const wearTex = makeTex(64, 8, (x, w, h) => {
      const gr = x.createLinearGradient(0, 0, w, 0);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(.5, 'rgba(0,0,0,.30)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = gr; x.fillRect(0, 0, w, h);
    });
    for (const off of [-this.halfW * 0.45, this.halfW * 0.45]) {
      const m = new THREE.Mesh(this._ribbon(off - 1.35, off + 1.35, 0.032, 1 / 4, 1 / 6),
        new THREE.MeshBasicMaterial({ map: wearTex, transparent: true, depthWrite: false, opacity: 0.30 }));
      g.add(m);
    }

    /* kerbs */
    const ct = curbTex(); ct.repeat.set(1, 1);
    const curbMat = new THREE.MeshStandardMaterial({ map: ct, roughness: 0.7 });
    for (const s of [1, -1]) {
      const a = s > 0 ? this.halfW : -this.halfW - 0.9;
      const b = s > 0 ? this.halfW + 0.9 : -this.halfW;
      g.add(new THREE.Mesh(this._ribbon(a, b, 0.045, 1, 1 / 3.2), curbMat));
    }

    /* edge lines */
    const lm = new THREE.MeshStandardMaterial({ map: lineTex(), roughness: 0.6, color: 0xf0eee4 });
    for (const s of [1, -1]) {
      const a = s > 0 ? this.halfW - 0.42 : -this.halfW + 0.10;
      const b = s > 0 ? this.halfW - 0.10 : -this.halfW + 0.42;
      g.add(new THREE.Mesh(this._ribbon(a, b, 0.05, 1, 1 / 4), lm));
    }

    /* centre dashes */
    const dm = new THREE.MeshStandardMaterial({ map: dashTex(), transparent: true, roughness: 0.6, color: 0xf3f0e2, depthWrite: false });
    g.add(new THREE.Mesh(this._ribbon(-0.16, 0.16, 0.055, 1, 1 / 9), dm));

    /* shoulders */
    const st2 = groundTex(th.groundTex, th.ground); st2.repeat.set(6, 6);
    const shMat = new THREE.MeshStandardMaterial({ map: st2, roughness: 1, color: th.ground });
    for (const s of [1, -1]) {
      const a = s > 0 ? this.halfW + 0.9 : -this.wallOff;
      const b = s > 0 ? this.wallOff : -this.halfW - 0.9;
      g.add(new THREE.Mesh(this._ribbon(a, b, -0.02, 1 / 6, 1 / 6), shMat));
    }

    /* armco barriers */
    const armTex = makeTex(64, 64, (x, w, h) => {
      x.fillStyle = '#b9c0c8'; x.fillRect(0, 0, w, h);
      x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(0, h * 0.10, w, 4);
      x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(0, h * 0.55, w, 5);
      x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(0, h * 0.88, w, 4);
    }, { repeat: [1, 1] });
    const armMat = new THREE.MeshStandardMaterial({ map: armTex, roughness: 0.45, metalness: 0.65, side: THREE.DoubleSide, color: th.night ? 0x8892a0 : 0xffffff });
    for (const s of [1, -1]) {
      const wall = new THREE.Mesh(this._wall(s * this.wallOff, 0.95, 1 / 6, 1 / 2.4), armMat);
      wall.receiveShadow = false;
      g.add(wall);
      /* top rail */
      const rail = new THREE.Mesh(this._ribbon(s * (this.wallOff - 0.09), s * (this.wallOff + 0.09), 0.98, 1, 1 / 3),
        new THREE.MeshStandardMaterial({ color: 0x6b737d, roughness: 0.35, metalness: 0.85 }));
      g.add(rail);
    }

    /* start / finish */
    const start = new THREE.Group();
    const s0 = this._at(0);
    start.position.set(s0.x, 0.06, s0.z);
    start.rotation.y = Math.atan2(s0.tx, s0.tz);
    const cp = new THREE.Mesh(new THREE.PlaneGeometry(this.halfW * 2, 3.4),
      new THREE.MeshStandardMaterial({ map: checkTex(), roughness: 0.7 }));
    cp.rotation.x = -Math.PI / 2;
    start.add(cp);
    /* gantry */
    const postMat = new THREE.MeshStandardMaterial({ color: 0x2c3238, roughness: 0.5, metalness: 0.6 });
    for (const s of [1, -1]) {
      const post = new THREE.Mesh(BOX(0.5, 7.5, 0.5), postMat);
      post.position.set(s * (this.halfW + 1.6), 3.75, 0);
      post.castShadow = true;
      start.add(post);
    }
    const beam = new THREE.Mesh(BOX((this.halfW + 1.9) * 2, 1.5, 0.45), postMat);
    beam.position.y = 7.3; start.add(beam);
    const bannerTex = makeTex(1024, 128, (x, w, h) => {
      const gr = x.createLinearGradient(0, 0, w, 0);
      gr.addColorStop(0, '#14181e'); gr.addColorStop(.5, '#ff5a1f'); gr.addColorStop(1, '#14181e');
      x.fillStyle = gr; x.fillRect(0, 0, w, h);
      x.fillStyle = '#0b0e12'; x.fillRect(0, 0, w, 14); x.fillRect(0, h - 14, w, 14);
      x.font = '700 64px Chakra Petch, Arial, sans-serif';
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillStyle = '#fff'; x.fillText('APEX DRIVE', w / 2, h / 2 + 4);
    }, { clamp: true });
    const banner = new THREE.Mesh(new THREE.PlaneGeometry((this.halfW + 1.9) * 2, 1.4),
      new THREE.MeshBasicMaterial({ map: bannerTex, toneMapped: false }));
    banner.position.set(0, 7.3, 0.25);
    start.add(banner);
    g.add(start);

    /* scenery */
    this._scenery();

    /* sky + lights */
    this._sky();
    this._lights();

    return g;
  }

  /* ---------- curve & samples ---------- */
  _makeCurve() {
    const d = this.def;
    const pts = [];
    const SEG = 18;
    for (let i = 0; i < SEG; i++) {
      const a = i / SEG * TAU;
      let r = d.base;
      for (const h of d.harm) r += h[0] * Math.sin(h[1] * a + h[2]);
      pts.push(new THREE.Vector3(Math.cos(a) * r * d.sx, 0, Math.sin(a) * r * d.sz));
    }
    this.curve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.5);
    this.curve.arcLengthDivisions = 2400;
    this.length = this.curve.getLength();
  }

  _makeSamples() {
    const N = this.N;
    this.px = new Float32Array(N); this.pz = new Float32Array(N);
    this.tx = new Float32Array(N); this.tz = new Float32Array(N);
    this.nx = new Float32Array(N); this.nz = new Float32Array(N);
    this.ss = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const u = i / N;
      const p = this.curve.getPointAt(u);
      const t = this.curve.getTangentAt(u);
      const l = Math.hypot(t.x, t.z) || 1;
      this.px[i] = p.x; this.pz[i] = p.z;
      this.tx[i] = t.x / l; this.tz[i] = t.z / l;
      this.nx[i] = -this.tz[i]; this.nz[i] = this.tx[i];
      this.ss[i] = u * this.length;
    }
  }

  _makeGrid() {
    this.cell = 26;
    this.grid = new Map();
    for (let i = 0; i < this.N; i++) {
      const k = this._key(this.px[i], this.pz[i]);
      let arr = this.grid.get(k);
      if (!arr) { arr = []; this.grid.set(k, arr); }
      arr.push(i);
    }
  }
  _key(x, z) {
    return (Math.floor(x / this.cell) + 4096) * 8192 + (Math.floor(z / this.cell) + 4096);
  }

  /* nearest sample on the road */
  project(x, z, out = {}) {
    const c = this.cell;
    const cx = Math.floor(x / c), cz = Math.floor(z / c);
    let best = -1, bestD = Infinity;
    for (let ax = -1; ax <= 1; ax++) for (let az = -1; az <= 1; az++) {
      const arr = this.grid.get(((cx + ax) + 4096) * 8192 + ((cz + az) + 4096));
      if (!arr) continue;
      for (let k = 0; k < arr.length; k++) {
        const i = arr[k];
        const dx = x - this.px[i], dz = z - this.pz[i];
        const dd = dx * dx + dz * dz;
        if (dd < bestD) { bestD = dd; best = i; }
      }
    }
    if (best < 0) {
      for (let i = 0; i < this.N; i += 2) {
        const dx = x - this.px[i], dz = z - this.pz[i];
        const dd = dx * dx + dz * dz;
        if (dd < bestD) { bestD = dd; best = i; }
      }
    }
    if (best < 0) best = 0;
    const i = best;
    out.i = i;
    out.dist = Math.sqrt(bestD);
    out.lat = (x - this.px[i]) * this.nx[i] + (z - this.pz[i]) * this.nz[i];
    out.s = this.ss[i];
    out.tx = this.tx[i]; out.tz = this.tz[i];
    out.nx = this.nx[i]; out.nz = this.nz[i];
    out.x = this.px[i]; out.z = this.pz[i];
    return out;
  }

  _at(s) {
    const N = this.N;
    let u = (s / this.length) % 1; if (u < 0) u += 1;
    const i = Math.min(N - 1, Math.floor(u * N));
    return {
      x: this.px[i], z: this.pz[i], tx: this.tx[i], tz: this.tz[i],
      nx: this.nx[i], nz: this.nz[i], i
    };
  }

  /* ---------- geometry builders ---------- */
  _ribbon(offA, offB, y, uScale, vScale) {
    const N = this.N;
    const pos = new Float32Array((N + 1) * 2 * 3);
    const uv = new Float32Array((N + 1) * 2 * 2);
    const idx = [];
    for (let i = 0; i <= N; i++) {
      const k = i % N;
      const px = this.px[k], pz = this.pz[k], nx = this.nx[k], nz = this.nz[k];
      const s = i === N ? this.length : this.ss[k];
      const o = i * 6;
      pos[o] = px + nx * offA; pos[o + 1] = y; pos[o + 2] = pz + nz * offA;
      pos[o + 3] = px + nx * offB; pos[o + 4] = y; pos[o + 5] = pz + nz * offB;
      const u = i * 4;
      uv[u] = offA * uScale; uv[u + 1] = s * vScale;
      uv[u + 2] = offB * uScale; uv[u + 3] = s * vScale;
    }
    for (let i = 0; i < N; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      idx.push(a, b, c, b, d, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  _wall(off, height, uScale, vScale) {
    const N = this.N;
    const pos = new Float32Array((N + 1) * 2 * 3);
    const uv = new Float32Array((N + 1) * 2 * 2);
    const idx = [];
    for (let i = 0; i <= N; i++) {
      const k = i % N;
      const px = this.px[k] + this.nx[k] * off, pz = this.pz[k] + this.nz[k] * off;
      const s = i === N ? this.length : this.ss[k];
      const o = i * 6;
      pos[o] = px; pos[o + 1] = 0; pos[o + 2] = pz;
      pos[o + 3] = px; pos[o + 4] = height; pos[o + 5] = pz;
      const u = i * 4;
      uv[u] = s * uScale; uv[u + 1] = 0;
      uv[u + 2] = s * uScale; uv[u + 3] = height * vScale;
    }
    for (let i = 0; i < N; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      idx.push(a, b, c, b, d, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  /* ---------- scenery ---------- */
  _scenery() {
    const th = this.theme, d = this.def, q = this.quality;
    const rnd = mulberry32(d.base | 0);
    const g = this.group;
    const wall = this.wallOff;

    const place = (minOff, maxOff) => {
      for (let tries = 0; tries < 8; tries++) {
        const i = Math.floor(rnd() * this.N);
        const side = rnd() > 0.5 ? 1 : -1;
        const off = side * (wall + 1.5 + rnd() * (maxOff - minOff) + minOff);
        const x = this.px[i] + this.nx[i] * off;
        const z = this.pz[i] + this.nz[i] * off;
        const pr = this.project(x, z);
        if (pr.dist > wall + 2.2) return { x, z, i };
      }
      return null;
    };

    const set = th.propSet;

    /* --- trees / rocks / cacti --- */
    if (set === 'coast') {
      this._instanced(g, this._palmGeo(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }),
        Math.round(160 * [0.5, 0.8, 1][q]), 18, 150, place, rnd, 0.85, 1.5, true);
      this._instanced(g, this._bushGeo(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }),
        Math.round(220 * [0.4, 0.75, 1][q]), 8, 90, place, rnd, 0.7, 1.6);
      this._instanced(g, this._rockGeo(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }),
        Math.round(90 * [0.4, 0.75, 1][q]), 10, 130, place, rnd, 0.7, 2.4);
    } else if (set === 'canyon') {
      this._instanced(g, this._cactusGeo(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }),
        Math.round(120 * [0.5, 0.8, 1][q]), 14, 130, place, rnd, 0.8, 1.4);
      this._instanced(g, this._rockGeo(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.98 }),
        Math.round(200 * [0.4, 0.75, 1][q]), 8, 140, place, rnd, 0.9, 3.4);
      this._instanced(g, this._bushGeo(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }),
        Math.round(110 * [0.4, 0.7, 1][q]), 8, 90, place, rnd, 0.5, 1.1);
    } else {
      this._instanced(g, this._treeGeo(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }),
        Math.round(120 * [0.5, 0.8, 1][q]), 12, 110, place, rnd, 0.85, 1.4);
      this._buildings(g, place, rnd, q);
      this._lamps(g, place, rnd, q);
    }

    /* --- canyon walls: chunky rock masses hugging the road --- */
    if (set === 'canyon') this._canyonWalls(g, rnd, q);

    /* --- billboards --- */
    this._billboards(g, place, rnd, q);

    /* --- distant mountains --- */
    this._mountains(g, rnd);

    /* --- clouds --- */
    this._clouds(g, rnd);
  }

  _instanced(parent, geo, mat, count, minOff, maxOff, place, rnd, sMin, sMax, noShadow) {
    if (count <= 0) return;
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.castShadow = !noShadow;
    mesh.receiveShadow = false;
    mesh.frustumCulled = true;
    let n = 0;
    for (let i = 0; i < count; i++) {
      const p = place(minOff, maxOff);
      if (!p) continue;
      const s = sMin + rnd() * (sMax - sMin);
      const m = TRS(p.x, 0, p.z, 0, rnd() * TAU, 0, s, s * (0.9 + rnd() * 0.25), s);
      mesh.setMatrixAt(n++, m);
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    parent.add(mesh);
  }

  _treeGeo() {
    const parts = [];
    parts.push({ geo: CYL(0.22, 0.34, 2.6, 6), matrix: T(0, 1.3, 0), color: 0x5a4230 });
    parts.push({ geo: CYL(0.05, 1.7, 2.8, 7), matrix: T(0, 3.3, 0), color: 0x2f5b33 });
    parts.push({ geo: CYL(0.05, 1.35, 2.4, 7), matrix: T(0, 4.6, 0), color: 0x356a3a });
    parts.push({ geo: CYL(0.05, 0.95, 2.0, 7), matrix: T(0, 5.8, 0), color: 0x3b7540 });
    return mergeParts(parts);
  }
  _palmGeo() {
    const parts = [];
    parts.push({ geo: CYL(0.16, 0.30, 7.2, 6), matrix: T(0, 3.6, 0), color: 0x6d5842 });
    parts.push({ geo: CYL(0.10, 0.16, 1.2, 6), matrix: TRS(0.1, 7.3, 0, 0, 0, 0.1), color: 0x6d5842 });
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * TAU;
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(Math.cos(a) * 1.5, 7.6, Math.sin(a) * 1.5),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -a, -0.42 + Math.sin(i) * 0.12, 'YXZ')),
        new THREE.Vector3(1, 1, 1));
      parts.push({ geo: CYL(0.02, 0.55, 3.4, 4), matrix: m, color: 0x2f7a3a });
    }
    return mergeParts(parts);
  }
  _bushGeo() {
    const parts = [];
    for (let i = 0; i < 3; i++) {
      const a = i / 3 * TAU;
      parts.push({
        geo: new THREE.IcosahedronGeometry(0.8 + (i % 2) * 0.25, 0),
        matrix: T(Math.cos(a) * 0.55, 0.5 + (i % 2) * 0.2, Math.sin(a) * 0.55),
        color: i % 2 ? 0x4a6b34 : 0x567a3c
      });
    }
    return mergeParts(parts);
  }
  _rockGeo() {
    const parts = [];
    for (let i = 0; i < 2; i++) {
      parts.push({
        geo: new THREE.IcosahedronGeometry(1.1, 0),
        matrix: TRS((i - .5) * 0.9, 0.5 + i * 0.15, (i - .5) * 0.4, i * 0.4, i * 0.9, i * 0.2, 1, 0.75, 1.1),
        color: i ? 0x8a7b6b : 0x9a8a78
      });
    }
    return mergeParts(parts);
  }
  _cactusGeo() {
    const parts = [];
    parts.push({ geo: CYL(0.42, 0.46, 3.4, 8), matrix: T(0, 1.7, 0), color: 0x3f6b3a });
    parts.push({ geo: CYL(0.28, 0.3, 1.1, 7), matrix: TRS(-0.75, 2.2, 0, 0, 0, Math.PI / 2), color: 0x3f6b3a });
    parts.push({ geo: CYL(0.26, 0.26, 1.5, 7), matrix: T(-1.3, 2.7, 0), color: 0x3f6b3a });
    parts.push({ geo: CYL(0.26, 0.28, 1.0, 7), matrix: TRS(0.72, 1.7, 0, 0, 0, Math.PI / 2), color: 0x3f6b3a });
    parts.push({ geo: CYL(0.24, 0.24, 1.3, 7), matrix: T(1.24, 2.1, 0), color: 0x3f6b3a });
    return mergeParts(parts);
  }

  _buildings(g, place, rnd, q) {
    const count = Math.round(150 * [0.45, 0.75, 1][q]);
    const wt = windowTex();
    const mat = new THREE.MeshStandardMaterial({
      map: wt, emissiveMap: wt, emissive: 0xffffff, emissiveIntensity: 1.15,
      color: 0x2a3040, roughness: 0.65, metalness: 0.35
    });
    const geo = BOX(1, 1, 1);
    geo.translate(0, 0.5, 0);
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    let n = 0;
    const col = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const p = place(26, 300);
      if (!p) continue;
      const w = 10 + rnd() * 16, dd = 10 + rnd() * 16, hh = 14 + rnd() * (30 + rnd() * 90);
      const m = TRS(p.x, 0, p.z, 0, rnd() * TAU, 0, w, hh, dd);
      mesh.setMatrixAt(n, m);
      col.setHSL(0.58 + rnd() * 0.08, 0.18 + rnd() * 0.15, 0.22 + rnd() * 0.16);
      mesh.setColorAt(n, col);
      n++;
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    g.add(mesh);

    /* rooftop beacons */
    const bg = new THREE.SphereGeometry(0.55, 6, 5);
    const bm = new THREE.MeshBasicMaterial({ color: 0xff3b30, toneMapped: false });
    const bmesh = new THREE.InstancedMesh(bg, bm, count);
    let bn = 0;
    for (let i = 0; i < n && bn < count; i++) {
      const m = new THREE.Matrix4(); mesh.getMatrixAt(i, m);
      const pos = new THREE.Vector3().setFromMatrixPosition(m);
      const sc = new THREE.Vector3().setFromMatrixScale(m);
      bmesh.setMatrixAt(bn++, T(pos.x, sc.y + 0.5, pos.z));
    }
    bmesh.count = bn;
    bmesh.instanceMatrix.needsUpdate = true;
    g.add(bmesh);
  }

  _lamps(g, place, rnd, q) {
    const count = Math.round(90 * [0.4, 0.7, 1][q]);
    const parts = [
      { geo: CYL(0.11, 0.15, 8.5, 6), matrix: T(0, 4.25, 0), color: 0x2b3038 },
      { geo: BOX(2.0, 0.16, 0.16), matrix: T(0.95, 8.4, 0), color: 0x2b3038 }
    ];
    const geo = mergeParts(parts);
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.6 }), count);
    const glowGeo = BOX(1.5, 0.16, 0.5);
    const glow = new THREE.InstancedMesh(glowGeo, new THREE.MeshBasicMaterial({ color: 0xffd9a0, toneMapped: false }), count);
    let n = 0;
    for (let i = 0; i < count; i++) {
      const p = place(1.0, 3.0);
      if (!p) continue;
      /* lamps hug the barrier: place explicitly just outside the wall */
      const i2 = Math.floor(rnd() * this.N);
      const side = rnd() > .5 ? 1 : -1;
      const off = side * (this.wallOff + 1.6);
      const x = this.px[i2] + this.nx[i2] * off, z = this.pz[i2] + this.nz[i2] * off;
      const yaw = Math.atan2(this.tx[i2], this.tz[i2]) + (side > 0 ? Math.PI : 0);
      mesh.setMatrixAt(n, TRS(x, 0, z, 0, yaw, 0));
      const arm = new THREE.Vector3(side > 0 ? -1.6 : 1.6, 8.3, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      glow.setMatrixAt(n, TRS(x + arm.x, arm.y, z + arm.z, 0, yaw, 0));
      n++;
    }
    mesh.count = n; glow.count = n;
    mesh.instanceMatrix.needsUpdate = true; glow.instanceMatrix.needsUpdate = true;
    g.add(mesh); g.add(glow);
  }

  _canyonWalls(g, rnd, q) {
    const parts = [];
    const step = 18;
    for (let i = 0; i < this.N; i += step) {
      for (const side of [1, -1]) {
        const off = side * (this.wallOff + 7.5 + rnd() * 6);
        const x = this.px[i] + this.nx[i] * off, z = this.pz[i] + this.nz[i] * off;
        const h = 7 + rnd() * 15;
        const w = 7 + rnd() * 7;
        const yaw = Math.atan2(this.tx[i], this.tz[i]) + (rnd() - 0.5) * 0.5;
        parts.push({
          geo: new THREE.IcosahedronGeometry(1, 0),
          matrix: TRS(x, h * 0.34, z, 0, yaw, 0, w, h, w * (0.8 + rnd() * 0.5)),
          color: new THREE.Color(0x8a4a2c).offsetHSL(0, 0, rnd() * 0.14 - 0.07).getHex()
        });
        /* a smaller shoulder boulder for depth */
        if (rnd() > 0.55) {
          const ox = this.px[i] + this.nx[i] * (off + side * (5 + rnd() * 5));
          const oz = this.pz[i] + this.nz[i] * (off + side * (5 + rnd() * 5));
          parts.push({
            geo: new THREE.IcosahedronGeometry(1, 0),
            matrix: TRS(ox, 1.2, oz, rnd(), rnd() * TAU, rnd(), 1.6 + rnd() * 2.2, 1.4 + rnd() * 2.4, 1.6 + rnd() * 2.2),
            color: new THREE.Color(0x7d4326).offsetHSL(0, 0, rnd() * 0.1 - 0.05).getHex()
          });
        }
      }
    }
    const mesh = new THREE.Mesh(mergeParts(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.98, flatShading: true }));
    mesh.castShadow = true; mesh.receiveShadow = true;
    g.add(mesh);
  }

  _billboards(g, place, rnd, q) {
    const ads = [
      ['APEX DRIVE', '#ff5a1f', '#11161d'],
      ['NITRO', '#6fd0ff', '#0a1620'],
      ['TURBO FUEL', '#ffc247', '#1a1206'],
      ['SLIPSTREAM', '#e8eef5', '#151a22']
    ];
    const count = Math.round(6 * [0.5, 0.8, 1][q]);
    for (let k = 0; k < count; k++) {
      const a = ads[k % ads.length];
      const t = makeTex(512, 256, (x, w, h) => {
        x.fillStyle = a[2]; x.fillRect(0, 0, w, h);
        x.strokeStyle = a[1]; x.lineWidth = 10; x.strokeRect(10, 10, w - 20, h - 20);
        x.fillStyle = a[1]; x.font = '700 66px Chakra Petch, Arial, sans-serif';
        x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillText(a[0], w / 2, h / 2);
      }, { clamp: true });
      const p = place(4, 26);
      if (!p) continue;
      const grp = new THREE.Group();
      grp.position.set(p.x, 0, p.z);
      grp.rotation.y = Math.atan2(this.tx[p.i], this.tz[p.i]) + (rnd() > .5 ? 0 : Math.PI);
      const board = new THREE.Mesh(new THREE.PlaneGeometry(7, 3.5),
        new THREE.MeshStandardMaterial({ map: t, roughness: 0.7, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: this.theme.night ? 0.9 : 0.18 }));
      board.position.y = 4.6;
      grp.add(board);
      for (const s of [-1, 1]) {
        const leg = new THREE.Mesh(BOX(0.25, 4.6, 0.25), new THREE.MeshStandardMaterial({ color: 0x2a2f36, roughness: 0.6 }));
        leg.position.set(s * 2.6, 2.3, 0);
        grp.add(leg);
      }
      g.add(grp);
    }
  }

  _mountains(g, rnd) {
    const parts = [];
    const col = new THREE.Color(this.theme.mountain);
    const haze = new THREE.Color(this.theme.skyBottom);
    const n = 34;
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU + rnd() * 0.05;
      const r = 2050 + rnd() * 1100;
      const h = 210 + rnd() * 360;
      const w = 380 + rnd() * 430;
      const geo = new THREE.ConeGeometry(w, h, 7 + (i % 4));
      const pos = geo.attributes.position;
      const cols = new Float32Array(pos.count * 3);
      const cLow = col.clone().offsetHSL(0, 0, (rnd() - 0.5) * 0.06).multiplyScalar(0.72);
      const cHigh = col.clone().lerp(haze, 0.26);
      const tmp = new THREE.Color();
      for (let k = 0; k < pos.count; k++) {
        const t = clamp((pos.getY(k) + h / 2) / h, 0, 1);
        tmp.copy(cLow).lerp(cHigh, t * t * 0.85 + t * 0.15);
        cols[k * 3] = tmp.r; cols[k * 3 + 1] = tmp.g; cols[k * 3 + 2] = tmp.b;
      }
      geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
      parts.push({
        geo,
        matrix: TRS(Math.cos(a) * r, h * 0.42, Math.sin(a) * r, 0, rnd() * TAU, 0, 1, 1, 1)
      });
    }
    const mesh = new THREE.Mesh(mergeParts(parts), new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }));
    mesh.renderOrder = -2;
    g.add(mesh);
  }

  _clouds(g, rnd) {
    if (this.theme.night) return;
    const t = makeTex(128, 128, (x, w, h) => {
      const gr = x.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2);
      gr.addColorStop(0, 'rgba(255,255,255,.95)');
      gr.addColorStop(.45, 'rgba(255,255,255,.55)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = gr; x.fillRect(0, 0, w, h);
    }, { clamp: true });
    const mat = new THREE.SpriteMaterial({ map: t, transparent: true, opacity: 0.30, depthWrite: false, fog: false });
    for (let i = 0; i < 16; i++) {
      const s = new THREE.Sprite(mat);
      const a = rnd() * TAU, r = 700 + rnd() * 1400;
      s.position.set(Math.cos(a) * r, 300 + rnd() * 420, Math.sin(a) * r);
      const sc = 180 + rnd() * 320;
      s.scale.set(sc, sc * (0.35 + rnd() * 0.2), 1);
      g.add(s);
    }
  }

  /* ---------- sky ---------- */
  _sky() {
    const th = this.theme;
    const geo = new THREE.SphereGeometry(4200, 24, 16);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        top: { value: new THREE.Color(th.skyTop) },
        bottom: { value: new THREE.Color(th.skyBottom) },
        sunDir: { value: new THREE.Vector3(...th.sunPos).normalize() },
        sunCol: { value: new THREE.Color(th.sun) }
      },
      vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        uniform vec3 top; uniform vec3 bottom; uniform vec3 sunDir; uniform vec3 sunCol;
        varying vec3 vP;
        void main(){
          vec3 d = normalize(vP);
          float h = clamp(d.y * 1.15 + 0.06, -1.0, 1.0);
          vec3 col = mix(bottom, top, pow(clamp(h,0.0,1.0), 0.62));
          col = mix(col, bottom * 1.06, clamp(-h*3.0, 0.0, 1.0));
          float sd = max(dot(d, normalize(sunDir)), 0.0);
          col += sunCol * pow(sd, 14.0) * 0.28;
          col += sunCol * pow(sd, 300.0) * 1.6;
          col = max(col, vec3(0.0));
          col = pow(col, vec3(0.4545));
          gl_FragColor = vec4(col, 1.0);
        }`
    });
    const sky = new THREE.Mesh(geo, mat);
    sky.renderOrder = -10;
    this.group.add(sky);
    this.skyMat = mat;

    if (th.night) {
      const n = 900, pos = new Float32Array(n * 3);
      const rnd = mulberry32(7);
      for (let i = 0; i < n; i++) {
        const a = rnd() * TAU, ph = Math.acos(rnd() * 0.9 + 0.05), r = 3600;
        pos[i * 3] = Math.sin(ph) * Math.cos(a) * r;
        pos[i * 3 + 1] = Math.cos(ph) * r;
        pos[i * 3 + 2] = Math.sin(ph) * Math.sin(a) * r;
      }
      const g2 = new THREE.BufferGeometry();
      g2.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const stars = new THREE.Points(g2, new THREE.PointsMaterial({ color: 0xdfe9ff, size: 12, sizeAttenuation: true, fog: false, transparent: true, opacity: 0.85 }));
      stars.renderOrder = -9;
      this.group.add(stars);
    }
  }

  /* ---------- lights ---------- */
  _lights() {
    const th = this.theme;
    const sun = new THREE.DirectionalLight(th.sun, th.sunInt);
    sun.position.set(th.sunPos[0] * 120, th.sunPos[1] * 160 + 60, th.sunPos[2] * 120);
    sun.castShadow = true;
    const S = this.quality >= 2 ? 2048 : (this.quality === 1 ? 1024 : 512);
    sun.shadow.mapSize.set(S, S);
    const cam = sun.shadow.camera;
    cam.left = -55; cam.right = 55; cam.top = 55; cam.bottom = -55; cam.near = 1; cam.far = 320;
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 0.035;
    this.group.add(sun); this.group.add(sun.target);
    this.sun = sun;

    const hemi = new THREE.HemisphereLight(th.hemiSky, th.hemiGround, th.hemiInt);
    this.group.add(hemi);

    const amb = new THREE.AmbientLight(0xffffff, th.night ? 0.14 : 0.13);
    this.group.add(amb);

    /* fog */
    this.group.fogColor = new THREE.Color(th.fog);
  }

  dispose() {
    this.group.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of ms) {
          for (const k in m) { }
          m.dispose();
        }
      }
    });
  }

  /* diagnostics (dev) */
  validate() {
    let minSep = Infinity, minTurn = Infinity;
    const N = this.N;
    for (let i = 0; i < N; i += 3) {
      for (let j = i + 1; j < N; j += 3) {
        let gap = Math.abs(i - j); gap = Math.min(gap, N - gap);
        if (gap < 110) continue;
        const d = Math.hypot(this.px[i] - this.px[j], this.pz[i] - this.pz[j]);
        if (d < minSep) minSep = d;
      }
    }
    for (let i = 0; i < N; i++) {
      const a = (i - 1 + N) % N, b = (i + 1) % N;
      const ax = this.px[i] - this.px[a], az = this.pz[i] - this.pz[a];
      const bx = this.px[b] - this.px[i], bz = this.pz[b] - this.pz[i];
      const la = Math.hypot(ax, az), lb = Math.hypot(bx, bz);
      const cross = ax * bz - az * bx;
      const dot = ax * bx + az * bz;
      const ang = Math.abs(Math.atan2(cross, dot));
      const R = (la + lb) / 2 / Math.max(ang, 1e-6);
      if (R < minTurn) minTurn = R;
    }
    return { length: Math.round(this.length), minSep: +minSep.toFixed(1), minTurnRadius: +minTurn.toFixed(1) };
  }
}


/* ---------- procedural environment map source ---------- */
function envCanvasFor(theme) {
  const W = 512, H = 256;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  const skyTop = new THREE.Color(theme.skyTop);
  const skyBot = new THREE.Color(theme.skyBottom);
  const gnd = new THREE.Color(theme.ground);

  const g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0.00, '#' + skyTop.getHexString());
  g.addColorStop(0.38, '#' + skyTop.clone().lerp(skyBot, 0.65).getHexString());
  g.addColorStop(0.50, '#' + skyBot.getHexString());
  g.addColorStop(0.53, '#' + gnd.clone().lerp(skyBot, 0.35).getHexString());
  g.addColorStop(1.00, '#' + gnd.clone().multiplyScalar(theme.night ? 0.5 : 0.62).getHexString());
  x.fillStyle = g; x.fillRect(0, 0, W, H);

  if (theme.night) {
    for (let i = 0; i < 120; i++) {
      x.fillStyle = 'rgba(200,220,255,' + (0.2 + Math.random() * 0.7) + ')';
      x.fillRect(Math.random() * W, Math.random() * H * 0.48, 1.4, 1.4);
    }
    for (let i = 0; i < 26; i++) {
      x.fillStyle = 'rgba(255,205,140,' + (0.10 + Math.random() * 0.3) + ')';
      const bw = 3 + Math.random() * 7, bh = 4 + Math.random() * 12;
      x.fillRect(Math.random() * W, H * 0.5 - bh, bw, bh);
    }
  }

  /* sun / key light blob */
  const sunA = Math.atan2(theme.sunPos[0], theme.sunPos[2]);
  const sx = ((sunA / (Math.PI * 2)) + 0.5) * W;
  const sy = (0.5 - theme.sunPos[1] * 0.45) * H;
  const rad = x.createRadialGradient(sx, sy, 2, sx, sy, 62);
  const sc = new THREE.Color(theme.sun);
  rad.addColorStop(0, '#' + sc.clone().multiplyScalar(1.6).getHexString());
  rad.addColorStop(0.25, '#' + sc.clone().multiplyScalar(0.9).getHexString());
  rad.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = rad; x.fillRect(0, 0, W, H);
  return c;
}


/* ---------- studio environment (showroom) ---------- */
function studioEnvCanvas() {
  const W = 512, H = 256;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#3d4b5c');
  g.addColorStop(0.42, '#1b232c');
  g.addColorStop(0.52, '#0a0e13');
  g.addColorStop(1, '#05070a');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  /* softboxes */
  const boxes = [[0.18, 0.30, 90, 34], [0.52, 0.22, 120, 26], [0.80, 0.36, 80, 30]];
  for (const [bx, by, bw, bh] of boxes) {
    const gg = x.createRadialGradient(bx * W, by * H, 2, bx * W, by * H, bw);
    gg.addColorStop(0, 'rgba(255,255,255,.95)');
    gg.addColorStop(0.5, 'rgba(190,215,255,.35)');
    gg.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = gg;
    x.fillRect(bx * W - bw, by * H - bh, bw * 2, bh * 2);
  }
  const warm = x.createRadialGradient(W * 0.62, H * 0.55, 4, W * 0.62, H * 0.55, 90);
  warm.addColorStop(0, 'rgba(255,150,80,.55)');
  warm.addColorStop(1, 'rgba(255,120,40,0)');
  x.fillStyle = warm; x.fillRect(0, 0, W, H);
  return c;
}
