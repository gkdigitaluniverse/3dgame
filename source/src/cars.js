/* ============================================================
   CARS — procedural sports cars.
   One continuous side silhouette (nose → hood → windscreen →
   roof → fastback → tail) extruded and sculpted with plan-taper
   and tumblehome, then glazed with inset panels.
   ============================================================ */
const CAR_SPECS = [
  {
    id: 'falcon', name: 'Falcon GT', cls: 'Sports', price: 0, body: 0xff5a1f, accent: 0x14171b,
    stats: { speed: 0.62, accel: 0.66, grip: 0.60, nitro: 0.58 },
    shape: { len: 4.36, wid: 1.90, roof: 1.00, nose: 0.56, hood: 0.64, cowl: 0.70, deck: 0.80, tail: 0.66, wheelR: 0.35, spoiler: 0 },
    blurb: 'Balanced all-rounder. Forgiving, quick out of corners.'
  },
  {
    id: 'vortex', name: 'Vortex R', cls: 'Tuned', price: 600, body: 0x17b8a6, accent: 0x0c1116,
    stats: { speed: 0.70, accel: 0.74, grip: 0.72, nitro: 0.64 },
    shape: { len: 4.42, wid: 1.94, roof: 0.98, nose: 0.52, hood: 0.60, cowl: 0.67, deck: 0.77, tail: 0.62, wheelR: 0.36, spoiler: 1 },
    blurb: 'Low nose, high grip. Loves long sweepers.'
  },
  {
    id: 'nighthawk', name: 'Nighthawk', cls: 'Muscle', price: 1600, body: 0x24272d, accent: 0xd21f2b,
    stats: { speed: 0.82, accel: 0.86, grip: 0.56, nitro: 0.72 },
    shape: { len: 4.72, wid: 2.02, roof: 1.06, nose: 0.60, hood: 0.70, cowl: 0.76, deck: 0.86, tail: 0.72, wheelR: 0.38, spoiler: 2 },
    blurb: 'Brutal straight-line speed. Tame it with brakes.'
  },
  {
    id: 'apex', name: 'Apex RS', cls: 'Track', price: 2600, body: 0xeef2f5, accent: 0x1d4ed8,
    stats: { speed: 0.76, accel: 0.78, grip: 0.92, nitro: 0.68 },
    shape: { len: 4.30, wid: 2.00, roof: 1.00, nose: 0.50, hood: 0.58, cowl: 0.66, deck: 0.76, tail: 0.60, wheelR: 0.35, spoiler: 1 },
    blurb: 'Track weapon. Surgical turn-in, huge mechanical grip.'
  },
  {
    id: 'thunder', name: 'Thunderbolt', cls: 'Hyper', price: 3800, body: 0xffc93c, accent: 0x1a1d22,
    stats: { speed: 0.90, accel: 0.88, grip: 0.74, nitro: 0.94 },
    shape: { len: 4.60, wid: 1.98, roof: 0.96, nose: 0.48, hood: 0.56, cowl: 0.64, deck: 0.74, tail: 0.58, wheelR: 0.37, spoiler: 2 },
    blurb: 'Nitro monster. Biggest tank, biggest kick.'
  },
  {
    id: 'phantom', name: 'Phantom X', cls: 'Hyper', price: 5500, body: 0xb9c4cf, accent: 0x101418,
    stats: { speed: 1.00, accel: 0.96, grip: 0.88, nitro: 0.82 },
    shape: { len: 4.66, wid: 2.02, roof: 0.94, nose: 0.46, hood: 0.54, cowl: 0.62, deck: 0.72, tail: 0.56, wheelR: 0.37, spoiler: 2 },
    blurb: 'The flagship. Everything, turned to eleven.'
  }
];
const CAR_BY_ID = {};
CAR_SPECS.forEach(c => CAR_BY_ID[c.id] = c);

function carPerf(spec) {
  const s = spec.stats;
  return {
    maxSpeed: 38 + s.speed * 13,          // m/s  -> 166 .. 184 km/h
    accel: 6.6 + s.accel * 3.6,           // m/s^2
    maxLat: 11.5 + s.grip * 4.5,          // m/s^2 lateral grip limit
    grip: 0.88 + s.grip * 0.28,
    steerMax: 0.52 + s.grip * 0.10,
    nitroMul: 1.14 + s.nitro * 0.14,
    nitroCap: 70 + s.nitro * 45
  };
}


/* ---------- materials ---------- */
const CarMat = {};
function carMats(spec) {
  if (CarMat[spec.id]) return CarMat[spec.id];
  const m = {
    body: new THREE.MeshStandardMaterial({ color: spec.body, metalness: 0.34, roughness: 0.22, envMapIntensity: 0.95 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x14181d, metalness: 0.30, roughness: 0.55 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x0a1017, metalness: 0.62, roughness: 0.16, envMapIntensity: 0.60, side: THREE.DoubleSide }),
    accent: new THREE.MeshStandardMaterial({ color: spec.accent, metalness: 0.45, roughness: 0.35, envMapIntensity: 1.2 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xc8d2dc, metalness: 0.95, roughness: 0.16, envMapIntensity: 1.6 }),
    tyre: new THREE.MeshStandardMaterial({ color: 0x0d0f12, metalness: 0.05, roughness: 0.95 }),
    head: new THREE.MeshStandardMaterial({ color: 0xf2f8ff, emissive: 0xbfe4ff, emissiveIntensity: 1.4, toneMapped: false }),
    tail: new THREE.MeshStandardMaterial({ color: 0x5a0a0a, emissive: 0xff1e10, emissiveIntensity: 0.7, toneMapped: false })
  };
  CarMat[spec.id] = m;
  return m;
}

const RIM_TEX = (() => {
  let t = null;
  return () => {
    if (t) return t;
    t = makeTex(128, 128, (x, w, h) => {
      x.clearRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2;
      x.fillStyle = '#0e1114'; x.beginPath(); x.arc(cx, cy, 62, 0, TAU); x.fill();
      x.fillStyle = '#c9d3dd';
      for (let i = 0; i < 5; i++) {
        const a = i / 5 * TAU;
        x.save(); x.translate(cx, cy); x.rotate(a);
        x.beginPath();
        x.moveTo(-5, -58); x.lineTo(5, -58); x.lineTo(9, -16); x.lineTo(-9, -16);
        x.closePath(); x.fill();
        x.restore();
      }
      x.fillStyle = '#8d99a5'; x.beginPath(); x.arc(cx, cy, 18, 0, TAU); x.fill();
      x.fillStyle = '#2b3138'; x.beginPath(); x.arc(cx, cy, 9, 0, TAU); x.fill();
      x.strokeStyle = '#aab6c2'; x.lineWidth = 4; x.beginPath(); x.arc(cx, cy, 56, 0, TAU); x.stroke();
    }, { clamp: true });
    return t;
  };
})();

/* ---------- helpers ---------- */
function extrudeShape(pts, depth, bevel = 0.045) {
  const sh = new THREE.Shape();
  sh.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i];
    if (p.length === 4) sh.quadraticCurveTo(p[0], p[1], p[2], p[3]);
    else sh.lineTo(p[0], p[1]);
  }
  sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, {
    depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.85,
    bevelSegments: 2, curveSegments: 8, steps: 1
  });
  g.translate(0, 0, -depth / 2);
  g.rotateY(-Math.PI / 2);
  g.computeVertexNormals();
  return g;
}

/* plan-taper + tumblehome so the slab becomes a sculpted body */
function sculptBody(geo, L, bodyY, roofY) {
  const pos = geo.attributes.position;
  const span = Math.max(0.001, roofY - bodyY);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const tz = clamp(z / (L * 0.5), -1.25, 1.25);
    const taper = 1 - 0.16 * tz * tz - 0.06 * Math.max(0, tz);
    const ty = clamp((y - bodyY) / span, 0, 1);
    const tumble = 1 - 0.26 * Math.pow(ty, 1.45);
    pos.setX(i, x * taper * tumble);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/* quad spanning the width: pts = [[z,y],[z,y]] bottom->top */
function quadAcross(z1, y1, z2, y2, w1, w2, mat, off) {
  const g = new THREE.BufferGeometry();
  const nz = (y2 - y1), ny = -(z2 - z1);
  const nl = Math.hypot(nz, ny) || 1;
  off = off === undefined ? 0.055 : off;
  const oz = (nz / nl) * off, oy = (ny / nl) * off;
  const v = new Float32Array([
    -w1 / 2, y1 + oy, z1 + oz, w1 / 2, y1 + oy, z1 + oz, w2 / 2, y2 + oy, z2 + oz,
    -w1 / 2, y1 + oy, z1 + oz, w2 / 2, y2 + oy, z2 + oz, -w2 / 2, y2 + oy, z2 + oz
  ]);
  g.setAttribute('position', new THREE.BufferAttribute(v, 3));
  g.computeVertexNormals();
  return new THREE.Mesh(g, mat);
}

/* flat side panel at x = ±xo, pts = [[z,y] x4] */
function quadSide(pts, xo, mat) {
  const g = new THREE.BufferGeometry();
  const v = new Float32Array([
    xo, pts[0][1], pts[0][0], xo, pts[1][1], pts[1][0], xo, pts[2][1], pts[2][0],
    xo, pts[0][1], pts[0][0], xo, pts[2][1], pts[2][0], xo, pts[3][1], pts[3][0]
  ]);
  g.setAttribute('position', new THREE.BufferAttribute(v, 3));
  g.computeVertexNormals();
  return new THREE.Mesh(g, mat);
}

function makeWheel(r, w, mats, simple) {
  const pivot = new THREE.Group();
  const steer = new THREE.Group();
  const spin = new THREE.Group();
  pivot.add(steer); steer.add(spin);

  const tire = new THREE.Mesh(CYL(r, r, w, simple ? 12 : 20), mats.tyre);
  tire.rotation.z = Math.PI / 2;
  tire.castShadow = true;
  spin.add(tire);

  if (!simple) {
    const rt = RIM_TEX();
    const rimMat = new THREE.MeshStandardMaterial({ map: rt, transparent: true, metalness: 0.85, roughness: 0.3, side: THREE.DoubleSide });
    for (const s of [1, -1]) {
      const face = new THREE.Mesh(new THREE.CircleGeometry(r * 0.94, 18), rimMat);
      face.rotation.y = s > 0 ? Math.PI / 2 : -Math.PI / 2;
      face.position.x = s * (w / 2 + 0.006);
      spin.add(face);
    }
  }
  return { pivot, steer, spin };
}

/* ---------- main builder ---------- */
function buildCar(spec, opts = {}) {
  const P = spec.shape, M = carMats(spec);
  const simple = !!opts.simple;
  const grp = new THREE.Group();
  const L = P.len, W = P.wid, hw = L / 2, hwid = W / 2;
  const wheelR = P.wheelR;
  const bodyY = wheelR - 0.03;
  const roofY = P.roof;

  /* profile stations along the length */
  const zNose = hw * 0.965, zHoodF = hw * 0.60, zCowl = hw * 0.24;
  const zRoofF = hw * 0.06, zRoofR = -hw * 0.17, zDeck = -hw * 0.70, zTail = -hw * 0.975;

  /* ---- body ---- */
  const bodyPts = [
    [-hw, bodyY],
    [hw, bodyY],
    [hw, bodyY + 0.12],
    [zNose, P.nose],
    [zHoodF, P.hood],
    [zCowl, P.cowl],
    [zRoofF, roofY],
    [zRoofR, roofY + 0.004],
    [zDeck, P.deck],
    [zTail, P.tail],
    [-hw, P.tail - 0.05],
    [-hw, bodyY]
  ];
  const bev = simple ? 0.03 : 0.04;
  const bodyGeo = sculptBody(extrudeShape(bodyPts, W, bev), L, bodyY, roofY);
  const bevT = bev;                      // extrusion-axis bevel (half-width)
  const bevS = bev * 0.85;               // profile-plane bevel (outward)
  const body = new THREE.Mesh(bodyGeo, M.body);
  body.castShadow = true; body.receiveShadow = true;
  grp.add(body);

  /* ---- underbody ---- */
  const tub = new THREE.Mesh(BOX(W * 0.97, 0.26, L * 0.88), M.dark);
  tub.position.set(0, bodyY - 0.05, 0);
  grp.add(tub);

  /* ---- glazing (offset clear of the bevel) ---- */
  const gOff = bevS + 0.014;
  const glassW = W * 0.78;
  grp.add(quadAcross(zCowl - 0.03, P.cowl + 0.015, zRoofF, roofY - 0.005, glassW, glassW * 0.90, M.glass, gOff));
  grp.add(quadAcross(zRoofR + 0.03, roofY - 0.005, zDeck + 0.02, P.deck + 0.015, glassW * 0.90, glassW * 0.84, M.glass, gOff));

  /* side glass follows the sculpted flank */
  const surfX = (z, y) => {
    const tz = clamp(z / (L * 0.5), -1.25, 1.25);
    const taper = 1 - 0.16 * tz * tz - 0.06 * Math.max(0, tz);
    const ty = clamp((y - bodyY) / (roofY - bodyY), 0, 1);
    return (hwid + bevT) * taper * (1 - 0.26 * Math.pow(ty, 1.45));
  };
  const dlo = [
    [zCowl + 0.04, P.cowl - 0.01],
    [zRoofF + 0.02, roofY - 0.055],
    [zRoofR - 0.03, roofY - 0.055],
    [zDeck + 0.12, P.deck - 0.015]
  ];
  for (const s of [1, -1]) {
    const pts = dlo.map(([z, y]) => [z, y]);
    const g = new THREE.BufferGeometry();
    const x = pts.map(([z, y]) => (surfX(z, y) + 0.012) * s);
    const v = new Float32Array([
      x[0], pts[0][1], pts[0][0], x[1], pts[1][1], pts[1][0], x[2], pts[2][1], pts[2][0],
      x[0], pts[0][1], pts[0][0], x[2], pts[2][1], pts[2][0], x[3], pts[3][1], pts[3][0]
    ]);
    g.setAttribute('position', new THREE.BufferAttribute(v, 3));
    g.computeVertexNormals();
    grp.add(new THREE.Mesh(g, M.glass));
  }

  /* ---- widebody wheel arches ---- */
  const axles = [L * 0.305, -L * 0.295];
  const trackW = hwid + 0.055;
  for (const z of axles) {
    for (const s of [1, -1]) {
      const g = new THREE.RingGeometry(wheelR * 1.00, wheelR * 1.30, 20, 1, 0, Math.PI);
      g.rotateY(Math.PI / 2);
      const archMat = new THREE.MeshStandardMaterial({
        color: spec.body, metalness: 0.34, roughness: 0.22,
        envMapIntensity: 0.95, side: THREE.DoubleSide
      });
      const arch = new THREE.Mesh(g, archMat);
      arch.position.set(s * (hwid + 0.035), wheelR, z);
      grp.add(arch);
    }
  }

  /* ---- side skirts ---- */
  for (const s of [1, -1]) {
    const sk = new THREE.Mesh(BOX(0.12, 0.11, L * 0.30), M.dark);
    sk.position.set(s * (hwid - 0.02), bodyY + 0.01, 0);
    grp.add(sk);
  }

  /* ---- aero ---- */
  const splitter = new THREE.Mesh(BOX(W * 0.92, 0.055, 0.44), M.dark);
  splitter.position.set(0, bodyY - 0.055, hw - 0.10);
  grp.add(splitter);

  const diffuser = new THREE.Mesh(BOX(W * 0.80, 0.11, 0.38), M.dark);
  diffuser.position.set(0, bodyY + 0.01, -hw + 0.14);
  grp.add(diffuser);
  for (const fx of [-0.28, -0.09, 0.09, 0.28]) {
    const fin = new THREE.Mesh(BOX(0.04, 0.12, 0.30), M.chrome);
    fin.position.set(fx * W, bodyY + 0.06, -hw + 0.16);
    grp.add(fin);
  }

  /* ---- face: grille, intakes, lights ---- */
  const grille = new THREE.Mesh(BOX(W * 0.50, 0.10, 0.05), M.dark);
  grille.position.set(0, bodyY + 0.07, hw + 0.005);
  grp.add(grille);
  for (const s of [1, -1]) {
    const intake = new THREE.Mesh(BOX(0.30, 0.085, 0.04), M.dark);
    intake.position.set(s * W * 0.33, bodyY + 0.02, hw + 0.002);
    grp.add(intake);
    const hl = new THREE.Mesh(BOX(0.30, 0.055, 0.05), M.head);
    hl.position.set(s * W * 0.29, P.nose - 0.045, hw - 0.02);
    hl.rotation.y = s * 0.10;
    grp.add(hl);
  }
  /* tail bar */
  const tail = new THREE.Mesh(BOX(W * 0.66, 0.06, 0.05), M.tail);
  tail.position.set(0, P.tail - 0.055, -hw + 0.005);
  grp.add(tail);
  const tail2 = new THREE.Mesh(BOX(W * 0.22, 0.035, 0.04), M.tail);
  tail2.position.set(0, P.tail + 0.015, -hw + 0.01);
  grp.add(tail2);

  /* exhausts */
  for (const s of [1, -1]) {
    const ex = new THREE.Mesh(CYL(0.05, 0.05, 0.12, 8), M.chrome);
    ex.rotation.x = Math.PI / 2;
    ex.position.set(s * 0.26, bodyY + 0.03, -hw + 0.02);
    grp.add(ex);
  }

  /* ---- mirrors ---- */
  if (!simple) {
    for (const s of [1, -1]) {
      const arm = new THREE.Mesh(BOX(0.10, 0.03, 0.05), M.dark);
      arm.position.set(s * (hwid * 0.86 + 0.03), P.cowl + 0.02, zCowl + 0.10);
      grp.add(arm);
      const mir = new THREE.Mesh(BOX(0.085, 0.06, 0.11), M.body);
      mir.position.set(s * (hwid * 0.86 + 0.09), P.cowl + 0.025, zCowl + 0.10);
      grp.add(mir);
    }
    /* bonnet vents */
    for (const s of [1, -1]) {
      const v = new THREE.Mesh(BOX(0.13, 0.012, 0.34), M.dark);
      v.position.set(s * 0.30, P.hood + 0.015, zHoodF + 0.14);
      v.rotation.x = -0.09;
      grp.add(v);
    }
    /* racing stripe */
    if (spec.id !== 'nighthawk') {
      for (const s of [1, -1]) {
        const st = new THREE.Mesh(BOX(0.115, 0.008, L * 0.52), M.accent);
        st.position.set(s * 0.16, P.hood + 0.014, hw * 0.12);
        st.rotation.x = -0.055;
        grp.add(st);
      }
    }
  }

  /* ---- rear wing ---- */
  if (P.spoiler > 0) {
    const wingW = W * (P.spoiler === 2 ? 0.92 : 0.78);
    const wingY = P.tail + (P.spoiler === 2 ? 0.26 : 0.13);
    const wing = new THREE.Mesh(BOX(wingW, 0.05, 0.32), M.accent);
    wing.position.set(0, wingY, -hw + 0.14);
    wing.rotation.x = -0.12;
    wing.castShadow = true;
    grp.add(wing);
    for (const s of [1, -1]) {
      const stay = new THREE.Mesh(BOX(0.05, wingY - P.tail + 0.04, 0.12), M.dark);
      stay.position.set(s * wingW * 0.33, (wingY + P.tail) / 2, -hw + 0.16);
      grp.add(stay);
    }
  }

  /* ---- wheels ---- */
  const wheels = [];
  for (let i = 0; i < 4; i++) {
    const front = i < 2;
    const s = (i % 2 === 0) ? -1 : 1;
    const w = makeWheel(wheelR, 0.27, M, simple);
    w.pivot.position.set(s * trackW, wheelR, front ? axles[0] : axles[1]);
    grp.add(w.pivot);
    wheels.push({ ...w, front, side: s });
  }

  /* ---- night headlights ---- */
  let spots = null;
  if (opts.headlights) {
    spots = [];
    for (const s of [1, -1]) {
      const sp = new THREE.SpotLight(0xdcefff, 4.0, 90, 0.52, 0.5, 1.2);
      sp.position.set(s * W * 0.29, P.nose - 0.04, hw - 0.05);
      sp.target.position.set(s * W * 0.55, -0.7, hw + 24);
      grp.add(sp); grp.add(sp.target);
      spots.push(sp);
    }
  }

  grp.userData = { spec, wheels, tailLight: tail, tailLight2: tail2, spots, headMat: M.head, tailMat: M.tail, bodyMat: M.body };
  return grp;
}

function animateWheels(car, spinDelta, steerAngle) {
  const u = car.userData;
  if (!u || !u.wheels) return;
  for (const w of u.wheels) {
    w.spin.rotation.x += spinDelta;
    if (w.front) w.steer.rotation.y = steerAngle;
  }
}
