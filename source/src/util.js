/* ============================================================
   UTIL — geometry merging, canvas textures, math helpers
   ============================================================ */
if (THREE.ColorManagement) THREE.ColorManagement.legacyMode = false;
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const damp = (cur, target, lambda, dt) => lerp(cur, target, 1 - Math.exp(-lambda * dt));

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* ---------- canvas texture ---------- */
function makeTex(w, h, draw, opts = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  draw(x, w, h);
  const t = new THREE.CanvasTexture(c);
  t.encoding = opts.linear ? THREE.LinearEncoding : THREE.sRGBEncoding;
  t.wrapS = t.wrapT = opts.clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  t.anisotropy = opts.aniso || 4;
  if (opts.repeat) t.repeat.set(opts.repeat[0], opts.repeat[1]);
  t.needsUpdate = true;
  return t;
}

function noiseFill(x, w, h, base, amp, count, alpha = 0.5) {
  x.fillStyle = base; x.fillRect(0, 0, w, h);
  for (let i = 0; i < count; i++) {
    const g = (Math.random() * amp) | 0;
    x.fillStyle = `rgba(${g},${g},${g},${alpha})`;
    const s = Math.random() * 2.4 + 0.4;
    x.fillRect(Math.random() * w, Math.random() * h, s, s);
  }
}

/* ---------- merge parts into one vertex-coloured geometry ---------- */
const _m4 = new THREE.Matrix4();
function mergeParts(parts) {
  const posArr = [], norArr = [], colArr = [], uvArr = [];
  const n = new THREE.Vector3();
  const nm = new THREE.Matrix3();
  for (const p of parts) {
    let g = p.geo.index ? p.geo.toNonIndexed() : p.geo.clone();
    if (p.matrix) {
      g.applyMatrix4(p.matrix);
    }
    const pos = g.attributes.position;
    const nor = g.attributes.normal;
    const uv = g.attributes.uv;
    const c = new THREE.Color(p.color === undefined ? 0xffffff : p.color);
    const vc = g.attributes.color;
    for (let i = 0; i < pos.count; i++) {
      posArr.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      if (nor) norArr.push(nor.getX(i), nor.getY(i), nor.getZ(i));
      else norArr.push(0, 1, 0);
      if (vc) colArr.push(vc.getX(i), vc.getY(i), vc.getZ(i));
      else colArr.push(c.r, c.g, c.b);
      if (uv) uvArr.push(uv.getX(i), uv.getY(i));
      else uvArr.push(0, 0);
    }
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(posArr, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(norArr, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(colArr, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uvArr, 2));
  return out;
}

/* ---------- shared small builders ---------- */
const BOX = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const CYL = (rt, rb, h, seg = 14, open = false) => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open);
function T(x, y, z) { return new THREE.Matrix4().makeTranslation(x, y, z); }
function TRS(x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz));
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx, sy, sz));
}

function fmtTime(ms) {
  if (!isFinite(ms) || ms < 0) ms = 0;
  const total = ms / 1000;
  const m = Math.floor(total / 60);
  const s = Math.floor(total % 60);
  const t = Math.floor((total * 100) % 100);
  return `${m}:${String(s).padStart(2, '0')}.${String(t).padStart(2, '0')}`;
}
function fmtNum(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
