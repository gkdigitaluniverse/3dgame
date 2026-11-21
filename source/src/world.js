/* ============================================================
   OPEN WORLD — "Meridian City"
   A drivable grid city: road network, blocks of towers, parks,
   landmarks, roaming traffic, coins and checkpoint gates.
   ============================================================ */
function cityRoadTex(axis) {
  return makeTex(256, 256, (x, w, h) => {
    noiseFill(x, w, h, '#4a4e56', 90, 12000, 0.30);
    const band = 34;
    const band2 = (x0, y0, x1, y1) => { x.fillStyle = '#7d838c'; x.fillRect(x0, y0, x1 - x0, y1 - y0); };
    if (axis === 'u') {
      band2(0, 0, band, h); band2(w - band, 0, w, h);
      x.fillStyle = 'rgba(0,0,0,.45)';
      x.fillRect(band - 3, 0, 4, h); x.fillRect(w - band - 1, 0, 4, h);
    } else {
      band2(0, 0, w, band); band2(0, h - band, w, h);
      x.fillStyle = 'rgba(0,0,0,.45)';
      x.fillRect(0, band - 3, w, 4); x.fillRect(0, h - band - 1, w, 4);
    }
  });
}

const METRO_THEME = {
  skyTop: 0x1d2b52, skyBottom: 0xff9c62, sun: 0xffd9b0, sunInt: 1.25, sunPos: [-0.62, 0.26, 0.35],
  hemiSky: 0x9fb6e0, hemiGround: 0x3a2c26, hemiInt: 0.55,
  fog: 0x4a3b47, fogNear: 110, fogFar: 780,
  ground: 0x2b2d33, groundTex: 'asphalt', road: 0x9aa0aa, sea: null, night: true,
  mountain: 0x241f2e, propSet: 'city'
};

class OpenWorld {
  constructor(quality) {
    this.theme = METRO_THEME;
    this.q = quality;
    this.group = new THREE.Group();
    this.cell = 82;
    this.roadW = 18;
    this.n = 9;
    this.extent = (this.n - 1) * this.cell;
    this.half = this.extent / 2;
    this.buildings = [];
    this.bgrid = new Map();
    this.gates = [];
    this.length = this.extent * 2;
    this.halfW = this.roadW / 2;
  }

  _key(x, z, c) { return (Math.floor(x / c) + 512) * 4096 + (Math.floor(z / c) + 512); }

  build() {
    const g = this.group, th = this.theme;
    const rnd = mulberry32(4242);

    /* ---- ground ---- */
    const gt = groundTex('asphalt', 0x33363c);
    gt.repeat.set(520, 520);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(4200, 4200),
      new THREE.MeshStandardMaterial({ map: gt, roughness: 0.95, metalness: 0.02 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    g.add(ground);

    /* ---- road grid ---- */
    const asphZ = cityRoadTex('u'); asphZ.repeat.set(1, 46);
    const asphX = cityRoadTex('v'); asphX.repeat.set(46, 1);
    const roadMatZ = new THREE.MeshStandardMaterial({ map: asphZ, color: 0xcfd4da, roughness: 0.88, metalness: 0.05 });
    const roadMatX = new THREE.MeshStandardMaterial({ map: asphX, color: 0xcfd4da, roughness: 0.88, metalness: 0.05 });
    const roadGeoX = new THREE.PlaneGeometry(this.extent + this.cell * 2, this.roadW);
    const roadGeoZ = new THREE.PlaneGeometry(this.roadW, this.extent + this.cell * 2);
    for (let k = 0; k < this.n; k++) {
      const p = -this.half + k * this.cell;
      const rx = new THREE.Mesh(roadGeoZ, roadMatZ);
      rx.rotation.x = -Math.PI / 2;
      rx.position.set(p, 0.01, 0);
      rx.receiveShadow = true;
      g.add(rx);
      const rz = new THREE.Mesh(roadGeoX, roadMatX);
      rz.rotation.x = -Math.PI / 2;
      rz.position.set(0, 0.012, p);
      rz.receiveShadow = true;
      g.add(rz);
    }

    /* ---- lane markings ---- */
    const dashGeo = new THREE.PlaneGeometry(0.26, 3.4);
    dashGeo.rotateX(-Math.PI / 2);
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xd8d2bc, transparent: true, opacity: 0.40 });
    const perRoad = Math.floor((this.extent + this.cell) / 8);
    const dashCount = this.n * perRoad * 2;
    const dashes = new THREE.InstancedMesh(dashGeo, dashMat, dashCount);
    let di = 0;
    for (let k = 0; k < this.n; k++) {
      const p = -this.half + k * this.cell;
      for (let i = 0; i < perRoad; i++) {
        const t = -this.half - this.cell * 0.5 + i * 8;
        dashes.setMatrixAt(di++, TRS(p, 0.03, t, 0, 0, 0));
        dashes.setMatrixAt(di++, TRS(t, 0.032, p, 0, Math.PI / 2, 0));
      }
    }
    dashes.count = di;
    dashes.instanceMatrix.needsUpdate = true;
    g.add(dashes);

    /* ---- blocks ---- */
    const wt = windowTex();
    const bMat = new THREE.MeshStandardMaterial({
      map: wt, emissiveMap: wt, emissive: 0xffffff, emissiveIntensity: 1.25,
      color: 0x3a4050, roughness: 0.62, metalness: 0.3
    });
    const boxGeo = BOX(1, 1, 1);
    boxGeo.translate(0, 0.5, 0);
    {
      const uv = boxGeo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2.0, uv.getY(i) * 3.2);
      uv.needsUpdate = true;
    }
    const MAXB = 320;
    const bMesh = new THREE.InstancedMesh(boxGeo, bMat, MAXB);
    bMesh.castShadow = true; bMesh.receiveShadow = true;
    let bi = 0;
    const col = new THREE.Color();

    const blockCount = this.n - 1;
    for (let ix = 0; ix < blockCount; ix++) {
      for (let iz = 0; iz < blockCount; iz++) {
        const cx = -this.half + (ix + 0.5) * this.cell;
        const cz = -this.half + (iz + 0.5) * this.cell;
        const mid = (ix === 3 && iz === 3) || (ix === 4 && iz === 4);
        const park = (ix + iz * 3) % 11 === 0 || (ix === 1 && iz === 6) || (ix === 7 && iz === 2);
        const inner = this.cell - this.roadW - 12;

        if (mid) { this._landmark(g, cx, cz, ix === 3); continue; }
        if (park) { this._park(g, cx, cz, inner, rnd); continue; }

        const layout = rnd();
        const slots = layout > 0.62 ? [[0, 0, inner]] :
          (layout > 0.3 ? [[-inner / 4, 0, inner / 2], [inner / 4, 0, inner / 2]] :
            [[-inner / 4, -inner / 4, inner / 2], [inner / 4, -inner / 4, inner / 2],
             [-inner / 4, inner / 4, inner / 2], [inner / 4, inner / 4, inner / 2]]);
        for (const [ox, oz, sz] of slots) {
          if (bi >= MAXB) break;
          const w = sz * (0.62 + rnd() * 0.3);
          const d = sz * (0.62 + rnd() * 0.3);
          const dist = Math.hypot(cx, cz) / this.half;
          const h = 14 + rnd() * (28 + dist * 62);
          bMesh.setMatrixAt(bi, TRS(cx + ox, 0, cz + oz, 0, 0, 0, w, h, d));
          col.setHSL(0.60 + rnd() * 0.06, 0.16 + rnd() * 0.14, 0.20 + rnd() * 0.14);
          bMesh.setColorAt(bi, col);
          const b = { x: cx + ox, z: cz + oz, hw: w / 2, hd: d / 2 };
          this.buildings.push(b);
          const kk = this._key(b.x, b.z, 40);
          let arr = this.bgrid.get(kk); if (!arr) { arr = []; this.bgrid.set(kk, arr); }
          arr.push(b);
          bi++;
        }
      }
    }
    bMesh.count = bi;
    bMesh.instanceMatrix.needsUpdate = true;
    if (bMesh.instanceColor) bMesh.instanceColor.needsUpdate = true;
    g.add(bMesh);

    this._lamps(g, rnd);
    this._sky(g);
    this._lights(g);
    this._gates(g, rnd);
    return g;
  }

  _park(g, cx, cz, size, rnd) {
    const grass = new THREE.Mesh(
      new THREE.PlaneGeometry(size + 8, size + 8),
      new THREE.MeshStandardMaterial({ color: 0x2f4a30, roughness: 1 })
    );
    grass.rotation.x = -Math.PI / 2;
    grass.position.set(cx, 0.02, cz);
    g.add(grass);
    const parts = [];
    for (let i = 0; i < 9; i++) {
      const a = rnd() * TAU, r = rnd() * (size * 0.42);
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      parts.push({ geo: CYL(0.2, 0.3, 2.4, 6), matrix: T(x, 1.2, z), color: 0x4a3a28 });
      parts.push({ geo: CYL(0.05, 1.5, 2.6, 7), matrix: T(x, 3.4, z), color: 0x2f5b33 });
    }
    const mesh = new THREE.Mesh(mergeParts(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }));
    mesh.castShadow = true;
    g.add(mesh);
  }

  _landmark(g, cx, cz, stadium) {
    if (stadium) {
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(26, 28, 14, 32, 1, true),
        new THREE.MeshStandardMaterial({ color: 0x3a4152, roughness: 0.55, metalness: 0.4, side: THREE.DoubleSide })
      );
      base.position.set(cx, 7, cz);
      base.castShadow = true; base.receiveShadow = true;
      g.add(base);
      const roof = new THREE.Mesh(
        new THREE.CylinderGeometry(27.5, 27.5, 1.4, 32),
        new THREE.MeshStandardMaterial({ color: 0x20242c, roughness: 0.6, metalness: 0.5 })
      );
      roof.position.set(cx, 14.4, cz);
      g.add(roof);
      const glow = new THREE.Mesh(
        new THREE.TorusGeometry(27.6, 0.35, 6, 48),
        new THREE.MeshBasicMaterial({ color: 0xff8a3d, toneMapped: false })
      );
      glow.rotation.x = Math.PI / 2;
      glow.position.set(cx, 14.9, cz);
      g.add(glow);
      const b = { x: cx, z: cz, hw: 28, hd: 28 };
      this.buildings.push(b);
      const kk = this._key(cx, cz, 40);
      let arr = this.bgrid.get(kk); if (!arr) { arr = []; this.bgrid.set(kk, arr); }
      arr.push(b);
    } else {
      const plaza = new THREE.Mesh(
        new THREE.CircleGeometry(30, 32),
        new THREE.MeshStandardMaterial({ color: 0x4a4e57, roughness: 0.8 })
      );
      plaza.rotation.x = -Math.PI / 2;
      plaza.position.set(cx, 0.03, cz);
      g.add(plaza);
      const spire = new THREE.Mesh(
        new THREE.CylinderGeometry(0.9, 3.2, 78, 8),
        new THREE.MeshStandardMaterial({ color: 0x8d97a6, metalness: 0.8, roughness: 0.3 })
      );
      spire.position.set(cx, 39, cz);
      spire.castShadow = true;
      g.add(spire);
      const ball = new THREE.Mesh(
        new THREE.SphereGeometry(2.4, 12, 10),
        new THREE.MeshBasicMaterial({ color: 0xffc247, toneMapped: false })
      );
      ball.position.set(cx, 79, cz);
      g.add(ball);
      const water = new THREE.Mesh(
        new THREE.CylinderGeometry(9, 9, 0.6, 24),
        new THREE.MeshStandardMaterial({ color: 0x2e5f7a, metalness: 0.7, roughness: 0.15 })
      );
      water.position.set(cx, 0.4, cz);
      g.add(water);
      const b = { x: cx, z: cz, hw: 4, hd: 4 };
      this.buildings.push(b);
      const kk = this._key(cx, cz, 40);
      let arr = this.bgrid.get(kk); if (!arr) { arr = []; this.bgrid.set(kk, arr); }
      arr.push(b);
    }
  }

  _lamps(g, rnd) {
    const count = 150;
    const geo = mergeParts([
      { geo: CYL(0.10, 0.14, 8.0, 6), matrix: T(0, 4.0, 0), color: 0x2b3038 },
      { geo: BOX(1.8, 0.14, 0.14), matrix: T(0.85, 7.9, 0), color: 0x2b3038 }
    ]);
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.6 }), count);
    const glow = new THREE.InstancedMesh(BOX(1.3, 0.14, 0.4), new THREE.MeshBasicMaterial({ color: 0xffd9a0, toneMapped: false }), count);
    let n = 0;
    for (let k = 0; k < this.n && n < count; k++) {
      const p = -this.half + k * this.cell;
      for (let i = 0; i < 6 && n < count; i++) {
        const t = -this.half + (i + 0.5) * (this.extent / 6);
        const side = (k % 2 === 0) ? 1 : -1;
        const x = p + side * (this.roadW / 2 + 1.2);
        mesh.setMatrixAt(n, TRS(x, 0, t, 0, side > 0 ? Math.PI : 0, 0));
        glow.setMatrixAt(n, TRS(x - side * 1.7, 7.8, t, 0, 0, 0));
        n++;
      }
    }
    mesh.count = n; glow.count = n;
    mesh.instanceMatrix.needsUpdate = true; glow.instanceMatrix.needsUpdate = true;
    g.add(mesh); g.add(glow);
  }

  _gates(g, rnd) {
    const pts = [
      [-this.half + 2 * this.cell, -this.half + 6 * this.cell],
      [this.half - 1 * this.cell, -this.half + 2 * this.cell],
      [this.half - 4 * this.cell, this.half - 1 * this.cell],
      [-this.half + 1 * this.cell, this.half - 5 * this.cell],
      [0, 0],
      [-this.half + 6 * this.cell, this.half - 2 * this.cell],
      [this.half - 2 * this.cell, this.half - 6 * this.cell],
      [-this.half + 4 * this.cell, -this.half + 3 * this.cell]
    ];
    for (const [x, z] of pts) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(5.2, 0.32, 8, 28),
        new THREE.MeshBasicMaterial({ color: 0x35e0c0, transparent: true, opacity: 0.85, toneMapped: false })
      );
      ring.position.set(x, 4.6, z);
      g.add(ring);
      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.25, 0.25, 9.2, 6),
        new THREE.MeshBasicMaterial({ color: 0x35e0c0, transparent: true, opacity: 0.25, toneMapped: false })
      );
      pillar.position.set(x, 4.6, z);
      g.add(pillar);
      this.gates.push({ x, z, mesh: ring, pillar, taken: false, spin: rnd() * TAU });
    }
  }

  _sky(g) {
    const th = this.theme;
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
          vec3 col = mix(bottom, top, pow(clamp(h,0.0,1.0), 0.55));
          col = mix(col, bottom * 1.05, clamp(-h*3.0, 0.0, 1.0));
          float sd = max(dot(d, normalize(sunDir)), 0.0);
          col += sunCol * pow(sd, 14.0) * 0.30;
          col += sunCol * pow(sd, 300.0) * 1.5;
          col = max(col, vec3(0.0));
          col = pow(col, vec3(0.4545));
          gl_FragColor = vec4(col, 1.0);
        }`
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(4200, 24, 16), mat);
    sky.renderOrder = -10;
    g.add(sky);
  }

  _lights(g) {
    const th = this.theme;
    const sun = new THREE.DirectionalLight(th.sun, th.sunInt);
    sun.position.set(th.sunPos[0] * 140, 110, th.sunPos[2] * 140);
    sun.castShadow = true;
    const S = this.q >= 2 ? 2048 : (this.q === 1 ? 1024 : 512);
    sun.shadow.mapSize.set(S, S);
    const cam = sun.shadow.camera;
    cam.left = -70; cam.right = 70; cam.top = 70; cam.bottom = -70; cam.near = 1; cam.far = 360;
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 0.04;
    g.add(sun); g.add(sun.target);
    this.sun = sun;
    g.add(new THREE.HemisphereLight(th.hemiSky, th.hemiGround, th.hemiInt));
    g.add(new THREE.AmbientLight(0xffffff, 0.16));
  }

  resolve(pos, r) {
    let hit = false;
    const c = 40;
    const cx = Math.floor(pos.x / c), cz = Math.floor(pos.z / c);
    for (let ax = -1; ax <= 1; ax++) for (let az = -1; az <= 1; az++) {
      const arr = this.bgrid.get((cx + ax + 512) * 4096 + (cz + az + 512));
      if (!arr) continue;
      for (const b of arr) {
        const dx = pos.x - b.x, dz = pos.z - b.z;
        const ox = (b.hw + r) - Math.abs(dx);
        const oz = (b.hd + r) - Math.abs(dz);
        if (ox > 0 && oz > 0) {
          if (ox < oz) pos.x += (dx >= 0 ? ox : -ox);
          else pos.z += (dz >= 0 ? oz : -oz);
          hit = true;
        }
      }
    }
    const lim = this.half + this.cell * 0.9;
    if (Math.abs(pos.x) > lim) { pos.x = Math.sign(pos.x) * lim; hit = true; }
    if (Math.abs(pos.z) > lim) { pos.z = Math.sign(pos.z) * lim; hit = true; }
    return hit;
  }

  distToRoad(x, z) {
    const m = (v) => { const d = ((v + this.half) % this.cell + this.cell) % this.cell; return Math.min(d, this.cell - d); };
    return Math.min(m(x), m(z));
  }
  onRoad(x, z) { return this.distToRoad(x, z) < this.roadW / 2 + 2.5; }

  randomRoadPoint(rnd) {
    const k = Math.floor(rnd() * this.n);
    const p = -this.half + k * this.cell;
    const t = (rnd() - 0.5) * this.extent;
    const lane = (rnd() > 0.5 ? 1 : -1) * (2 + rnd() * 4);
    return rnd() > 0.5 ? { x: p + lane, z: t, axis: 'z' } : { x: t, z: p + lane, axis: 'x' };
  }

  dispose() {
    this.group.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach(m => m.dispose()); }
    });
  }
}
