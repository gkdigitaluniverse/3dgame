/* ============================================================
   GAME — renderer, driving model, camera, traffic, race logic
   ============================================================ */
const Game = (() => {
  let renderer, scene, camera, clock;
  let track = null, trackDef = null, world = null, env = null;
  let player = null, playerSpec = null, perf = null;
  let carGroup = null;

  let trafficPool = null, rivalPool = null;
  let coins = [], coinInst = null;
  let skidInst = null, skidIdx = 0;
  let particles = [], boostFlames = [];

  let state = 'boot';           // boot | menu | showroom | countdown | race | paused | finished
  let quality = 2;
  let handlingLevel = 'easy';
  const HANDLING = {
    easy:   { lat: 1.30, speed: 0.86, grip: 1.30 },
    normal: { lat: 1.00, speed: 1.00, grip: 1.00 },
    pro:    { lat: 0.94, speed: 1.10, grip: 0.88 }
  };
  let mode = 'race';
  let timeScale = 1;

  const pr = {};                // projection scratch
  const tmpV = new THREE.Vector3();

  const P = {
    pos: new THREE.Vector3(), yaw: 0, vel: new THREE.Vector3(),
    vF: 0, vS: 0, steer: 0, wheelSpin: 0,
    nitro: 100, nitroMax: 100, nitroOn: false,
    lap: 1, lastS: 0, dist: 0, position: 1, racers: 1,
    offroad: false, slip: 0, shake: 0, boostVis: 0,
    prevVF: 0, pitch: 0, roll: 0,
    lapTimes: [], lapStart: 0, raceStart: 0, raceTime: 0,
    coinsRun: 0, topSpeed: 0, drifts: 0, crashCd: 0, gates: 0, travel: 0, lapCd: 0
  };

  const input = { steer: 0, throttle: 0, brake: 0, nitro: false, handbrake: false };
  const hooks = {};

  /* ---------------- showroom ---------------- */
  const showScene = new THREE.Scene();
  const showCam = new THREE.PerspectiveCamera(36, 1, 0.1, 120);
  let showCar = null, showT = 0, showSpin = 0;
  const showGroup = new THREE.Group();

  /* ============================================================
     INIT
     ============================================================ */
  function init(canvas) {
    renderer = new THREE.WebGLRenderer({
      canvas, antialias: true, powerPreference: 'high-performance',
      alpha: false, stencil: false
    });
    renderer.setClearColor(0x05070a, 1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(62, 1, 0.4, 5000);
    camera.position.set(0, 6, -12);
    clock = new THREE.Clock();

    /* showroom */
    showScene.background = new THREE.Color(0x070a0e);
    showScene.add(showGroup);
    const key = new THREE.DirectionalLight(0xffffff, 1.55); key.position.set(4, 7, 6); showScene.add(key);
    const fill = new THREE.DirectionalLight(0x88b6ff, 0.75); fill.position.set(-6, 3, -4); showScene.add(fill);
    const rim = new THREE.DirectionalLight(0xff7a3c, 1.25); rim.position.set(-2, 2, -8); showScene.add(rim);
    showScene.add(new THREE.HemisphereLight(0x9fc4e8, 0x151a20, 0.45));
    const plat = new THREE.Mesh(
      new THREE.CylinderGeometry(3.3, 3.5, 0.22, 64),
      new THREE.MeshStandardMaterial({ color: 0x151b22, metalness: 0.8, roughness: 0.35 })
    );
    plat.position.y = -0.11;
    showGroup.add(plat);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(3.35, 0.03, 8, 96),
      new THREE.MeshBasicMaterial({ color: 0xff5a1f, toneMapped: false })
    );
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.01;
    showGroup.add(ring);
    const grid = new THREE.GridHelper(22, 22, 0x2a333d, 0x161d24);
    grid.position.y = -0.23;
    showGroup.add(grid);

    applyEnv(THEMES.coast);
    try {
      const pm = new THREE.PMREMGenerator(renderer);
      const st = new THREE.CanvasTexture(studioEnvCanvas());
      st.mapping = THREE.EquirectangularReflectionMapping;
      st.encoding = THREE.sRGBEncoding;
      showScene.environment = pm.fromEquirectangular(st).texture;
      st.dispose(); pm.dispose();
    } catch (e) { }
    resize();
    window.addEventListener('resize', resize);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
  }

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, quality >= 2 ? 2 : (quality === 1 ? 1.6 : 1.25));
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    showCam.aspect = w / h;
    showCam.updateProjectionMatrix();
  }

  function setQuality(q) {
    quality = q;
    if (!renderer) return;
    renderer.shadowMap.enabled = q > 0;
    if (env && env.sun) {
      env.sun.castShadow = q > 0;
      const S = q >= 2 ? 2048 : (q === 1 ? 1024 : 512);
      env.sun.shadow.mapSize.set(S, S);
      if (env.sun.shadow.map) { env.sun.shadow.map.dispose(); env.sun.shadow.map = null; }
    }
    resize();
  }

  /* ============================================================
     SHOWROOM
     ============================================================ */
  function showroom(carId) {
    state = 'showroom';
    const spec = CAR_BY_ID[carId] || CAR_SPECS[0];
    if (showCar) { showGroup.remove(showCar); disposeObj(showCar); }
    showCar = buildCar(spec, { headlights: false });
    showCar.position.y = 0;
    showGroup.add(showCar);
    showT = 0; showSpin = 0;
    showCam.position.set(0, 2.35, 9.6);
    showCam.lookAt(0, 0.62, 0);
    return spec;
  }

  function disposeObj(o) {
    o.traverse(n => {
      if (n.geometry) n.geometry.dispose();
    });
  }

  function renderShowroom(dt) {
    showT += dt;
    showSpin += dt * 0.30;
    showGroup.rotation.y = showSpin;
    const portrait = window.innerHeight > window.innerWidth;
    const bx = portrait ? 0 : -2.15;
    const by = portrait ? -0.32 : 0;
    showGroup.position.x = damp(showGroup.position.x, bx, 4, dt);
    showGroup.position.y = damp(showGroup.position.y, by, 4, dt);
    showCam.position.x = Math.sin(showT * 0.18) * 1.4;
    showCam.position.y = 2.3 + Math.sin(showT * 0.24) * 0.22;
    showCam.lookAt(0, 0.6, 0);
    renderer.render(showScene, showCam);
  }

  /* ============================================================
     TRACK / RACE SETUP
     ============================================================ */
  function clearScene() {
    if (track) { scene.remove(track.group); track.dispose(); track = null; }
    if (world) { scene.remove(world.group); world.dispose(); world = null; }
    env = null;
    if (carGroup) { scene.remove(carGroup); carGroup = null; }
    for (const k of ['trafficPool', 'rivalPool', 'coinInst', 'skidInst']) {
      const o = { trafficPool, rivalPool, coinInst, skidInst }[k];
      if (o) { scene.remove(o.mesh || o); }
    }
    trafficPool = rivalPool = coinInst = skidInst = null;
    for (const p of particles) if (p.sprite.parent) scene.remove(p.sprite);
    particles.length = 0;
    coins.length = 0;
    boostFlames.length = 0;
    while (scene.children.length) scene.remove(scene.children[0]);
  }

  function startRace(trackId, carId, md) {
    mode = md || 'race';
    const def = TRACK_DEFS.find(t => t.id === trackId) || TRACK_DEFS[0];
    trackDef = def;
    playerSpec = CAR_BY_ID[carId] || CAR_SPECS[0];
    perf = carPerf(playerSpec);

    clearScene();
    if (mode === 'open') {
      world = new OpenWorld(quality);
      scene.add(world.build());
      env = world;
      trackDef = { id: 'meridian', name: 'Meridian City', sub: 'Open world · free roam', theme: 'metro',
                   laps: 0, targetTime: 0, targetCoins: 0, reward: 0, width: 18, difficulty: 2 };
      applyEnv(world.theme);
      scene.fog = new THREE.Fog(world.theme.fog, world.theme.fogNear, world.theme.fogFar);
    } else {
      track = new Track(def, quality);
      scene.add(track.build());
      env = track;
      applyEnv(track.theme);
      scene.fog = new THREE.Fog(track.theme.fog, track.theme.fogNear, track.theme.fogFar);
    }
    scene.background = null;

    /* player car */
    carGroup = buildCar(playerSpec, { headlights: !!env.theme.night });
    carGroup.rotation.order = 'YXZ';
    scene.add(carGroup);

    /* boost flames */
    boostFlames.length = 0;
    const flameGeo = new THREE.ConeGeometry(0.16, 1.1, 8, 1, true);
    for (const s of [1, -1]) {
      const m = new THREE.Mesh(flameGeo, new THREE.MeshBasicMaterial({
        color: 0x8fd8ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending,
        depthWrite: false, toneMapped: false
      }));
      m.rotation.x = -Math.PI / 2;
      m.position.set(s * 0.30, playerSpec.shape.wheelR + 0.03, -playerSpec.shape.len / 2 - 0.5);
      m.scale.set(0.001, 0.001, 0.001);
      m.visible = false;
      carGroup.add(m);
      boostFlames.push(m);
    }

    /* traffic + rivals */
    if (world) { buildOpenTraffic(); buildOpenCoins(); }
    else { buildTraffic(); buildCoins(); }
    buildSkids();

    /* reset physics */
    if (mode === 'open') {
      P.pos.set(0, 0, world.half * 0.72);
      P.yaw = Math.PI;
    } else {
      const s0 = track._at(6);
      P.pos.set(s0.x, 0, s0.z);
      P.yaw = Math.atan2(s0.tx, s0.tz);
    }
    P.vel.set(0, 0, 0);
    P.vF = P.vS = 0; P.steer = 0; P.wheelSpin = 0;
    P.nitro = perf.nitroCap; P.nitroMax = perf.nitroCap; P.nitroOn = false;
    P.lap = 1; P.lastS = 6; P.dist = 6; P.position = 1;
    P.gates = 0; P.travel = 0; P.lapCd = 0;
    P.offroad = false; P.slip = 0; P.shake = 0; P.boostVis = 0;
    P.prevVF = 0; P.pitch = 0; P.roll = 0;
    P.lapTimes = []; P.lapStart = 0; P.raceTime = 0;
    P.coinsRun = 0; P.topSpeed = 0; P.drifts = 0; P.crashCd = 0;
    P.racers = 1 + (rivalPool ? rivalPool.count : 0);

    carGroup.position.copy(P.pos);
    carGroup.rotation.set(0, P.yaw, 0);

    /* camera snap */
    const f = { x: Math.sin(P.yaw), z: Math.cos(P.yaw) };
    camera.position.set(P.pos.x - f.x * 9, 4, P.pos.z - f.z * 9);
    camera.fov = 62; camera.updateProjectionMatrix();
    camera.lookAt(P.pos.x + f.x * 8, 1.2, P.pos.z + f.z * 8);

    input.steer = 0; input.throttle = 0; input.brake = 0; input.nitro = false;
    state = 'countdown';
    P.countdown = 3.9;
    P.cdFlags = {};
    P.goFired = false;
    SFX.engineOff();
    return def;
  }

  function applyEnv(theme) {
    try {
      const pmrem = new THREE.PMREMGenerator(renderer);
      const cv = envCanvasFor(theme);
      const tex = new THREE.CanvasTexture(cv);
      tex.mapping = THREE.EquirectangularReflectionMapping;
      tex.encoding = THREE.sRGBEncoding;
      const env = pmrem.fromEquirectangular(tex).texture;
      scene.environment = env;
      tex.dispose(); pmrem.dispose();
    } catch (e) { console.warn('env failed', e); }
  }

  /* ---------- traffic ---------- */
  function trafficGeo(kind) {
    const parts = [];
    const bodyC = 0xffffff, dark = 0x0e1216, glassC = 0x1a2530, lightC = 0xfff2cc, tailC = 0xd42a20;
    if (kind === 0) {           // sedan
      parts.push({ geo: BOX(1.86, 0.52, 4.3), matrix: T(0, 0.62, 0), color: bodyC });
      parts.push({ geo: BOX(1.70, 0.46, 2.15), matrix: T(0, 1.08, -0.15), color: glassC });
      parts.push({ geo: BOX(1.74, 0.12, 2.3), matrix: T(0, 1.33, -0.15), color: bodyC });
      parts.push({ geo: BOX(1.90, 0.14, 4.34), matrix: T(0, 0.40, 0), color: dark });
    } else if (kind === 1) {    // hatch
      parts.push({ geo: BOX(1.78, 0.56, 3.6), matrix: T(0, 0.64, 0), color: bodyC });
      parts.push({ geo: BOX(1.62, 0.56, 2.1), matrix: T(0, 1.16, -0.3), color: glassC });
      parts.push({ geo: BOX(1.66, 0.12, 2.2), matrix: T(0, 1.44, -0.3), color: bodyC });
      parts.push({ geo: BOX(1.82, 0.14, 3.64), matrix: T(0, 0.40, 0), color: dark });
    } else {                    // van
      parts.push({ geo: BOX(2.0, 1.1, 5.0), matrix: T(0, 0.95, 0), color: bodyC });
      parts.push({ geo: BOX(1.94, 0.5, 1.1), matrix: T(0, 1.55, 1.75), color: glassC });
      parts.push({ geo: BOX(2.04, 0.14, 5.04), matrix: T(0, 0.42, 0), color: dark });
    }
    /* wheels */
    for (const z of [1.35, -1.35]) for (const s of [1, -1]) {
      const g = CYL(0.34, 0.34, 0.24, 10);
      parts.push({ geo: g, matrix: TRS(s * 0.9, 0.34, z, 0, 0, Math.PI / 2), color: 0x0b0d10 });
    }
    /* lights */
    for (const s of [1, -1]) {
      parts.push({ geo: BOX(0.34, 0.12, 0.06), matrix: T(s * 0.6, 0.72, kind === 2 ? 2.52 : 2.16), color: lightC });
      parts.push({ geo: BOX(0.30, 0.12, 0.06), matrix: T(s * 0.62, 0.76, kind === 2 ? -2.52 : -2.16), color: tailC });
    }
    return mergeParts(parts);
  }

  function rivalGeo() {
    const parts = [];
    parts.push({ geo: BOX(1.94, 0.5, 4.5), matrix: T(0, 0.6, 0), color: 0xffffff });
    parts.push({ geo: BOX(1.6, 0.42, 2.0), matrix: T(0, 1.02, -0.2), color: 0x101820 });
    parts.push({ geo: BOX(1.98, 0.1, 4.54), matrix: T(0, 0.36, 0), color: 0x0d1013 });
    parts.push({ geo: BOX(1.7, 0.06, 0.34), matrix: T(0, 1.28, -2.05), color: 0x1b1f24 });
    for (const z of [1.4, -1.4]) for (const s of [1, -1]) {
      parts.push({ geo: CYL(0.36, 0.36, 0.26, 10), matrix: TRS(s * 0.94, 0.36, z, 0, 0, Math.PI / 2), color: 0x0b0d10 });
    }
    for (const s of [1, -1]) {
      parts.push({ geo: BOX(0.4, 0.1, 0.06), matrix: T(s * 0.62, 0.68, 2.26), color: 0xfff4d6 });
      parts.push({ geo: BOX(0.36, 0.1, 0.06), matrix: T(s * 0.64, 0.7, -2.26), color: 0xff2a1a });
    }
    return mergeParts(parts);
  }

  const TRAFFIC_COLORS = [0xcfd6dd, 0x8d99a6, 0x2d3742, 0xb03a2e, 0x2f5d7c, 0xd9c48c, 0x3f6b4a, 0x6b4a7a, 0xe0e4e8, 0x4a4f57];

  function buildTraffic() {
    const nT = [7, 10, 13][quality];
    const geos = [trafficGeo(0), trafficGeo(1), trafficGeo(2)];
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.45, roughness: 0.42 });
    const counts = [Math.ceil(nT * 0.55), Math.ceil(nT * 0.3), Math.floor(nT * 0.15)];
    trafficPool = { list: [], meshes: [] };
    const rnd = mulberry32(99);
    let idx = 0;
    const lanes = [-4.2, -1.4, 1.4, 4.2];
    for (let k = 0; k < 3; k++) {
      const mesh = new THREE.InstancedMesh(geos[k], mat, Math.max(1, counts[k]));
      mesh.castShadow = quality > 1;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(mesh);
      trafficPool.meshes.push(mesh);
      for (let i = 0; i < counts[k]; i++) {
        const s = 120 + rnd() * (track.length - 260);
        trafficPool.list.push({
          kind: k, mesh, slot: i,
          s, lat: lanes[Math.floor(rnd() * lanes.length)] + (rnd() - .5) * 0.6,
          speed: 13 + rnd() * 15,
          targetLat: 0, phase: rnd() * 10,
          yaw: 0, x: 0, z: 0, active: true
        });
        mesh.setColorAt(i, new THREE.Color(TRAFFIC_COLORS[Math.floor(rnd() * TRAFFIC_COLORS.length)]));
        idx++;
      }
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }

    /* rivals */
    const nR = mode === 'race' ? [3, 4, 5][quality] : 0;
    rivalPool = { list: [], mesh: null, count: nR };
    if (nR > 0) {
      const rmesh = new THREE.InstancedMesh(rivalGeo(), mat, nR);
      rmesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      rmesh.castShadow = quality > 1;
      scene.add(rmesh);
      rivalPool.mesh = rmesh;
      const rc = [0xff5a1f, 0x17b8a6, 0xffc93c, 0x2f7fff, 0xff3b8a, 0x9ee83c];
      for (let i = 0; i < nR; i++) {
        const s = 70 + i * 26 + rnd() * 18;
        rivalPool.list.push({
          s, lat: [-3.0, 0, 3.0][i % 3], speed: 33 + rnd() * 7 + quality * 1.8,
          targetLat: 0, phase: rnd() * 10, lap: 1, lastS: s, dist: s, name: 'RIVAL ' + (i + 1),
          yaw: 0, x: 0, z: 0, slot: i
        });
        rmesh.setColorAt(i, new THREE.Color(rc[i % rc.length]));
      }
      if (rmesh.instanceColor) rmesh.instanceColor.needsUpdate = true;
    }
  }

  /* ---------- open-world traffic & coins ---------- */
  function buildOpenTraffic() {
    const nT = [10, 15, 20][quality];
    const geos = [trafficGeo(0), trafficGeo(1), trafficGeo(2)];
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.45, roughness: 0.42 });
    const counts = [Math.ceil(nT * 0.55), Math.ceil(nT * 0.3), Math.floor(nT * 0.15)];
    trafficPool = { list: [], meshes: [], open: true };
    rivalPool = { list: [], mesh: null, count: 0 };
    const rnd = mulberry32(1234);
    for (let k = 0; k < 3; k++) {
      const mesh = new THREE.InstancedMesh(geos[k], mat, Math.max(1, counts[k]));
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.castShadow = quality > 1;
      scene.add(mesh);
      trafficPool.meshes.push(mesh);
      for (let i = 0; i < counts[k]; i++) {
        const rp = world.randomRoadPoint(rnd);
        const dir = rnd() > 0.5 ? 1 : -1;
        trafficPool.list.push({
          kind: k, mesh, slot: i, axis: rp.axis,
          fixed: rp.axis === 'z' ? rp.x : rp.z,
          pos: rp.axis === 'z' ? rp.z : rp.x,
          dir, speed: 9 + rnd() * 11, x: rp.x, z: rp.z, yaw: 0
        });
        mesh.setColorAt(i, new THREE.Color(TRAFFIC_COLORS[Math.floor(rnd() * TRAFFIC_COLORS.length)]));
      }
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  function buildOpenCoins() {
    const n = 90;
    const geo = new THREE.CylinderGeometry(0.55, 0.55, 0.10, 16);
    geo.rotateX(Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffc247, metalness: 1.0, roughness: 0.22,
      emissive: 0xffa000, emissiveIntensity: 0.55
    });
    coinInst = new THREE.InstancedMesh(geo, mat, n);
    coinInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(coinInst);
    const rnd = mulberry32(555);
    coins.length = 0;
    for (let i = 0; i < n; i++) {
      const rp = world.randomRoadPoint(rnd);
      coins.push({ s: 0, lat: 0, x: rp.x, z: rp.z, taken: false, spin: rnd() * TAU });
    }
    updateCoinMatrices();
  }

  /* ---------- coins ---------- */
  function buildCoins() {
    const n = Math.round(track.length / 34);
    const geo = new THREE.CylinderGeometry(0.55, 0.55, 0.10, 16);
    geo.rotateX(Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffc247, metalness: 1.0, roughness: 0.22,
      emissive: 0xffa000, emissiveIntensity: 0.55
    });
    coinInst = new THREE.InstancedMesh(geo, mat, n);
    coinInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(coinInst);
    const rnd = mulberry32(31);
    coins.length = 0;
    for (let i = 0; i < n; i++) {
      const s = 90 + i * (track.length - 140) / n;
      const lat = [-4.2, -1.4, 1.4, 4.2][Math.floor(rnd() * 4)];
      const p = track._at(s);
      coins.push({ s, lat, x: p.x + p.nx * lat, z: p.z + p.nz * lat, taken: false, spin: rnd() * TAU });
    }
    updateCoinMatrices();
  }

  function updateCoinMatrices() {
    if (!coinInst) return;
    let k = 0;
    for (const c of coins) {
      if (c.taken) { coinInst.setMatrixAt(k++, TRS(0, -50, 0, 0, 0, 0, 0.001, 0.001, 0.001)); continue; }
      coinInst.setMatrixAt(k++, TRS(c.x, 1.05 + Math.sin(c.spin) * 0.10, c.z, 0, c.spin, 0));
    }
    coinInst.count = k;
    coinInst.instanceMatrix.needsUpdate = true;
  }

  /* ---------- skid marks ---------- */
  function buildSkids() {
    const g = new THREE.PlaneGeometry(0.34, 0.9);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.MeshBasicMaterial({ color: 0x0b0d10, transparent: true, opacity: 0.32, depthWrite: false });
    skidInst = new THREE.InstancedMesh(g, m, 260);
    skidInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    skidInst.frustumCulled = false;
    scene.add(skidInst);
    for (let i = 0; i < 260; i++) skidInst.setMatrixAt(i, TRS(0, -60, 0, 0, 0, 0, 0.001, 0.001, 0.001));
    skidInst.instanceMatrix.needsUpdate = true;
    skidIdx = 0;
  }

  function addSkid(x, z, yaw) {
    if (!skidInst) return;
    skidInst.setMatrixAt(skidIdx, TRS(x, 0.06, z, 0, yaw, 0));
    skidIdx = (skidIdx + 1) % 260;
    skidInst.instanceMatrix.needsUpdate = true;
  }

  /* ---------- particles ---------- */
  const smokeTex = (() => {
    let t = null;
    return () => t || (t = makeTex(64, 64, (x, w, h) => {
      const g = x.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
      g.addColorStop(0, 'rgba(255,255,255,.75)');
      g.addColorStop(.5, 'rgba(255,255,255,.28)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
    }, { clamp: true }));
  })();

  function spawnSmoke(x, z, color = 0xdddddd, size = 1.6, life = 0.8, vy = 0.9) {
    if (particles.length > 70) return;
    const m = new THREE.SpriteMaterial({
      map: smokeTex(), color, transparent: true, opacity: 0.55,
      depthWrite: false, blending: THREE.NormalBlending
    });
    const sp = new THREE.Sprite(m);
    sp.position.set(x, 0.5, z);
    sp.scale.set(size, size, 1);
    scene.add(sp);
    particles.push({ sprite: sp, life, max: life, vy, size });
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        scene.remove(p.sprite); p.sprite.material.dispose();
        particles.splice(i, 1); continue;
      }
      const t = 1 - p.life / p.max;
      p.sprite.position.y += p.vy * dt;
      p.sprite.material.opacity = 0.55 * (1 - t);
      const s = p.size * (1 + t * 1.8);
      p.sprite.scale.set(s, s, 1);
    }
  }

  /* ============================================================
     PHYSICS
     ============================================================ */
  function stepPlayer(dt) {
    const fwdX = Math.sin(P.yaw), fwdZ = Math.cos(P.yaw);
    const rgtX = Math.cos(P.yaw), rgtZ = -Math.sin(P.yaw);

    /* decompose velocity */
    let vF = P.vel.x * fwdX + P.vel.z * fwdZ;
    let vS = P.vel.x * rgtX + P.vel.z * rgtZ;

    const nitroWant = input.nitro && P.nitro > 1.5;
    P.nitroOn = nitroWant;
    const offroad = P.offroad;

    const hand = HANDLING[handlingLevel] || HANDLING.normal;
    const maxS = perf.maxSpeed * hand.speed * (nitroWant ? perf.nitroMul : 1) * (offroad ? 0.60 : 1);

    /* longitudinal */
    let aF = 0;
    const th = clamp(input.throttle, 0, 1);
    const br = clamp(input.brake, 0, 1);
    if (th > 0.02) {
      const t = clamp(vF / maxS, 0, 1);
      aF += perf.accel * hand.speed * th * (1 - 0.70 * Math.pow(t, 1.8)) *
            (nitroWant ? 1.45 : 1) * (offroad ? 0.55 : 1);
    }
    if (br > 0.02) {
      if (vF > 0.6) aF -= 22 * br;
      else aF -= 7 * br;
    }
    if (th <= 0.02 && br <= 0.02) aF -= vF * 0.62;
    if (input.handbrake) aF -= vF * 1.2;

    vF += aF * dt;
    if (vF > maxS) vF = lerp(vF, maxS, 1 - Math.exp(-8 * dt));
    if (vF < -10) vF = -10;

    /* ---- steering: lateral-grip limited ---- */
    P.steer = damp(P.steer, clamp(input.steer, -1, 1), 9, dt);
    const spd = Math.abs(vF);
    const maxLat = perf.maxLat * hand.lat * (input.handbrake ? 0.62 : 1) * (offroad ? 0.62 : 1);
    const blend = clamp(spd / 7, 0, 1);
    const demand = P.steer * maxLat * (1 - 0.10 * clamp(spd / perf.maxSpeed, 0, 1));
    let yawRate = (demand / Math.max(spd, 4.5)) * blend;
    if (vF < -0.3) yawRate = -yawRate;
    if (input.handbrake) yawRate *= 1.30;
    P.yaw -= yawRate * dt;

    /* lateral grip */
    const gripK = perf.grip * hand.grip * (input.handbrake ? 0.32 : 1) * (offroad ? 0.55 : 1);
    vS *= Math.exp(-gripK * 9 * dt);

    /* recompose */
    P.vel.x = fwdX * vF + rgtX * vS;
    P.vel.z = fwdZ * vF + rgtZ * vS;
    P.pos.x += P.vel.x * dt;
    P.pos.z += P.vel.z * dt;

    P.slip = Math.min(1, Math.abs(vS) / (Math.abs(vF) * 0.55 + 3.5));
    P.vS = vS;
    P.vF = vF;

    /* nitro tank */
    if (nitroWant) P.nitro = Math.max(0, P.nitro - 27 * dt);
    else P.nitro = Math.min(P.nitroMax, P.nitro + 4.2 * dt);
    if (P.nitro <= 0) P.nitroOn = false;

    /* ---- world / track constraints ---- */
    if (track) {
      track.project(P.pos.x, P.pos.z, pr);
      P.offroad = Math.abs(pr.lat) > track.halfW + 0.7;
      const lim = track.halfW + 3.85;
      if (Math.abs(pr.lat) > lim) {
        const over = Math.abs(pr.lat) - lim;
        const sgn = Math.sign(pr.lat);
        P.pos.x -= pr.nx * sgn * over;
        P.pos.z -= pr.nz * sgn * over;
        const vn = P.vel.x * pr.nx + P.vel.z * pr.nz;
        if (vn * sgn > 0) {
          P.vel.x -= pr.nx * vn * 1.45;
          P.vel.z -= pr.nz * vn * 1.45;
          P.vel.multiplyScalar(0.78);
          wallHit(Math.abs(vn));
        }
      }
      const s = pr.s;
      const dS = s - P.lastS;
      P.lapCd = Math.max(0, (P.lapCd || 0) - dt);
      if (dS < -track.length * 0.5 && vF > 0.5 && P.lapCd <= 0) {
        P.lap++;
        P.lapCd = 5;
        const t = P.raceTime - P.lapStart;
        P.lapTimes.push(t);
        P.lapStart = P.raceTime;
        if (hooks.onLap) hooks.onLap(P.lap, t);
        if (mode === 'race' && P.lap > trackDef.laps) { finish(); return; }
      }
      P.lastS = s;
      P.dist = (P.lap - 1) * track.length + s;
    } else if (world) {
      const before = Math.abs(P.vF);
      const hitB = world.resolve(P.pos, 1.15);
      if (hitB) {
        P.vel.multiplyScalar(0.28);
        P.vF *= 0.28;
        P.shake = Math.min(1, before / 22);
        if (P.crashCd <= 0) {
          P.crashCd = 0.55;
          SFX.crash(clamp(before / 26, 0.3, 1));
          if (hooks.onCrash) hooks.onCrash(before);
        }
      }
      P.offroad = !world.onRoad(P.pos.x, P.pos.z);
      P.travel += Math.hypot(P.vel.x, P.vel.z) * dt;
      P.dist = P.travel;
    }

    /* ---- coins ---- */
    for (const c of coins) {
      if (c.taken) continue;
      const dx = c.x - P.pos.x, dz = c.z - P.pos.z;
      if (dx * dx + dz * dz < 9) {
        c.taken = true;
        P.coinsRun++;
        P.nitro = Math.min(P.nitroMax, P.nitro + 13);
        SFX.coin();
        if (hooks.onCoin) hooks.onCoin(P.coinsRun);
      }
    }
    updateCoinMatrices();

    /* ---- checkpoint gates (open world) ---- */
    if (world) {
      for (const gt of world.gates) {
        if (gt.taken) continue;
        const dx = gt.x - P.pos.x, dz = gt.z - P.pos.z;
        if (dx * dx + dz * dz < 46) {
          gt.taken = true;
          P.gates++;
          P.nitro = Math.min(P.nitroMax, P.nitro + 20);
          SFX.coin();
          if (hooks.onGate) hooks.onGate(P.gates, world.gates.length);
          if (P.gates >= world.gates.length) { finishOpen(); return; }
        }
      }
    }

    /* ---- collisions with traffic / rivals ---- */
    if (P.crashCd > 0) P.crashCd -= dt;
    for (const t of trafficPool.list) {
      const dx = t.x - P.pos.x, dz = t.z - P.pos.z;
      if (dx * dx + dz * dz < 7.2) collideWith(t);
    }
    if (rivalPool) for (const r of rivalPool.list) {
      const dx = r.x - P.pos.x, dz = r.z - P.pos.z;
      if (dx * dx + dz * dz < 7.2) collideWith(r);
    }

    /* ---- visuals ---- */
    P.prevVF = P.prevVF || vF;
    const longA = (vF - P.prevVF) / Math.max(dt, 0.0001);
    P.prevVF = vF;
    P.pitch = damp(P.pitch, clamp(-longA * 0.0045, -0.07, 0.07), 8, dt);
    const latA = vF * yawRate;
    P.roll = damp(P.roll, clamp(-latA * 0.0075, -0.10, 0.10), 8, dt);

    carGroup.position.set(P.pos.x, 0, P.pos.z);
    carGroup.rotation.set(P.pitch, P.yaw, P.roll);

    /* wheel spin */
    const spin = (vF / playerSpec.shape.wheelR) * dt;
    const visSteer = P.steer * perf.steerMax * (1 / (1 + spd * 0.10));
    animateWheels(carGroup, spin, -visSteer);

    /* brake lights */
    const braking = br > 0.1 && vF > 0.5;
    const u = carGroup.userData;
    u.tailMat.emissiveIntensity = braking ? 3.2 : 0.7;
    u.headMat.emissiveIntensity = env.theme.night ? 2.4 : 1.4;

    /* nitro visuals */
    P.boostVis = damp(P.boostVis, P.nitroOn ? 1 : 0, 9, dt);
    for (const f of boostFlames) {
      const sc = P.boostVis;
      f.visible = sc > 0.02;
      const flick = 0.85 + Math.random() * 0.3;
      f.scale.set(sc * 0.9, sc * 0.9, sc * (1.5 + Math.random() * 0.8) * flick);
      f.material.opacity = 0.85 * sc;
    }

    /* smoke + skids */
    if (P.slip > 0.45 && spd > 6) {
      P.drifts += dt;
      if (Math.random() < 0.7) {
        const sgn = Math.sign(vS) || 1;
        spawnSmoke(P.pos.x - rgtX * sgn * 0.9, P.pos.z - rgtZ * sgn * 0.9, 0xe8e8e8, 1.3, 0.7, 0.7);
      }
      if (Math.random() < 0.5) addSkid(P.pos.x - fwdX * 1.3, P.pos.z - fwdZ * 1.3, P.yaw);
    }
    if (P.offroad && spd > 8 && Math.random() < 0.55) {
      const gtx = env ? env.theme.groundTex : 'asphalt';
      const c = gtx === 'dirt' ? 0xd9a86a : (gtx === 'sand' ? 0xe4cf9a : 0x9aa4ad);
      spawnSmoke(P.pos.x - fwdX * 1.5, P.pos.z - fwdZ * 1.5, c, 1.7, 0.9, 1.1);
    }

    /* engine audio */
    const ratio = clamp(spd / perf.maxSpeed, 0, 1.2);
    const gearPos = (ratio * 6.2) % 1;
    const rpm = clamp(0.18 + gearPos * 0.82, 0, 1);
    SFX.engine(rpm, th * 0.85 + (P.nitroOn ? 0.35 : 0), ratio);
    SFX.wind(ratio);
    SFX.skid(P.slip > 0.4 ? (P.slip - 0.4) * 1.6 : 0);
    SFX.nitro(P.nitroOn, 1);

    P.topSpeed = Math.max(P.topSpeed, spd * 3.6);
    P.shake = Math.max(0, P.shake - dt * 2.4);
  }

  function collideWith(t) {
    if (P.crashCd > 0) return;
    const dx = P.pos.x - t.x, dz = P.pos.z - t.z;
    const d = Math.hypot(dx, dz) || 0.001;
    const push = (2.7 - d);
    P.pos.x += (dx / d) * push * 0.9;
    P.pos.z += (dz / d) * push * 0.9;
    const impact = Math.abs(P.vF);
    P.vel.multiplyScalar(0.55);
    P.vF *= 0.55;
    P.shake = 0.55;
    P.crashCd = 0.6;
    SFX.crash(clamp(impact / 40, 0.35, 1));
    if (hooks.onCrash) hooks.onCrash(impact);
    for (let i = 0; i < 5; i++) {
      spawnSmoke(P.pos.x + (Math.random() - .5) * 2, P.pos.z + (Math.random() - .5) * 2, 0xffffff, 1.2, 0.5, 1.4);
    }
  }

  function wallHit(vn) {
    if (P.crashCd > 0) return;
    P.crashCd = 0.45;
    P.shake = 0.4;
    SFX.crash(clamp(vn / 30, 0.25, 0.9));
    if (hooks.onWall) hooks.onWall(vn);
    for (let i = 0; i < 3; i++) spawnSmoke(P.pos.x, P.pos.z, 0xffe0a0, 0.9, 0.35, 1.2);
  }

  /* ============================================================
     CAMERA
     ============================================================ */
  let camMode = 0;
  function updateCamera(dt) {
    const fwdX = Math.sin(P.yaw), fwdZ = Math.cos(P.yaw);
    const spd = Math.abs(P.vF);
    const ratio = clamp(spd / perf.maxSpeed, 0, 1.2);

    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    const narrow = aspect < 1 ? clamp(1 / aspect, 1, 2.2) : 1;
    let dist = (7.5 + ratio * 3.2) * (1 + (narrow - 1) * 0.42);
    let height = (2.65 + ratio * 0.50) * (1 + (narrow - 1) * 0.30);
    let ahead = 7 + ratio * 6;
    let fovT = 60 + ratio * 14 + (P.nitroOn ? 5 : 0) + (narrow - 1) * 9;

    if (camMode === 1) { dist = -0.2; height = 1.28; ahead = 14; fovT = 66 + ratio * 12; }
    else if (camMode === 2) { dist = 13 + ratio * 5; height = 5.4 + ratio; fovT = 56 + ratio * 10; }

    const sway = P.steer * 0.9;
    const tx = P.pos.x - fwdX * dist + Math.cos(P.yaw) * sway;
    const tz = P.pos.z - fwdZ * dist - Math.sin(P.yaw) * sway;

    const k = camMode === 1 ? 22 : 7.5;
    camera.position.x = damp(camera.position.x, tx, k, dt);
    camera.position.z = damp(camera.position.z, tz, k, dt);
    camera.position.y = damp(camera.position.y, height, k * 0.8, dt);

    if (P.shake > 0.001) {
      const s = P.shake * 0.42;
      camera.position.x += (Math.random() - .5) * s;
      camera.position.y += (Math.random() - .5) * s;
      camera.position.z += (Math.random() - .5) * s;
    }

    tmpV.set(P.pos.x + fwdX * ahead, 1.02, P.pos.z + fwdZ * ahead);
    camera.lookAt(tmpV);

    camera.fov = damp(camera.fov, fovT, 4, dt);
    camera.updateProjectionMatrix();
  }

  /* ============================================================
     WORLD UPDATE
     ============================================================ */
  function updateWorld(dt) {
    const time = performance.now() / 1000;
    /* traffic */
    if (trafficPool.open) {
      const lim = world.half + world.cell * 0.8;
      for (const t of trafficPool.list) {
        t.pos += t.dir * t.speed * dt;
        if (t.pos > lim) t.pos = -lim;
        if (t.pos < -lim) t.pos = lim;
        if (t.axis === 'z') { t.x = t.fixed; t.z = t.pos; t.yaw = t.dir > 0 ? 0 : Math.PI; }
        else { t.x = t.pos; t.z = t.fixed; t.yaw = t.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
        t.mesh.setMatrixAt(t.slot, TRS(t.x, 0, t.z, 0, t.yaw, 0));
      }
    } else {
      for (const t of trafficPool.list) {
        t.s += t.speed * dt;
        if (t.s > track.length) t.s -= track.length;
        const p = track._at(t.s);
        t.lat += Math.sin(time * 0.4 + t.phase) * dt * 0.55;
        t.lat = clamp(t.lat, -track.halfW + 1.2, track.halfW - 1.2);
        t.x = p.x + p.nx * t.lat;
        t.z = p.z + p.nz * t.lat;
        t.yaw = Math.atan2(p.tx, p.tz);
        t.mesh.setMatrixAt(t.slot, TRS(t.x, 0, t.z, 0, t.yaw, 0));
      }
    }
    for (const m of trafficPool.meshes) m.instanceMatrix.needsUpdate = true;

    /* checkpoint gates */
    if (world) {
      for (const gt of world.gates) {
        gt.spin += dt * 0.9;
        gt.mesh.rotation.z = gt.spin;
        gt.mesh.visible = !gt.taken;
        gt.pillar.visible = !gt.taken;
      }
    }

    /* rivals */
    if (rivalPool && rivalPool.list.length) {
      for (const r of rivalPool.list) {
        r.s += r.speed * dt;
        if (r.s > track.length) { r.s -= track.length; r.lap++; }
        const p = track._at(r.s);
        r.targetLat = Math.sin(time * 0.35 + r.phase) * (track.halfW - 3.2);
        r.lat = damp(r.lat, r.targetLat, 0.8, dt);
        r.x = p.x + p.nx * r.lat;
        r.z = p.z + p.nz * r.lat;
        r.yaw = Math.atan2(p.tx, p.tz);
        r.dist = (r.lap - 1) * track.length + r.s;
        rivalPool.mesh.setMatrixAt(r.slot, TRS(r.x, 0, r.z, 0, r.yaw, 0));
      }
      rivalPool.mesh.instanceMatrix.needsUpdate = true;
      /* position */
      let pos = 1;
      for (const r of rivalPool.list) if (r.dist > P.dist) pos++;
      if (pos !== P.position) {
        if (pos < P.position && hooks.onOvertake) hooks.onOvertake(pos);
        P.position = pos;
      }
    }

    /* coins spin */
    for (const c of coins) c.spin += dt * 2.4;
    updateCoinMatrices();

    updateParticles(dt);
    if (track && track.sea) {
      track.sea.material.map.offset.y = (time * 0.006) % 1;
      track.sea.material.map.offset.x = (time * 0.003) % 1;
    }
    if (env && env.sun) {
      const th = env.theme;
      env.sun.position.set(P.pos.x + th.sunPos[0] * 90, 90 + th.sunPos[1] * 60, P.pos.z + th.sunPos[2] * 90);
      env.sun.target.position.set(P.pos.x, 0, P.pos.z);
      env.sun.target.updateMatrixWorld();
    }
  }

  /* ============================================================
     RACE FLOW
     ============================================================ */
  function finishOpen() {
    state = 'finished';
    SFX.nitro(false);
    SFX.engineOff();
    if (hooks.onFinishOpen) hooks.onFinishOpen({
      time: P.raceTime, coins: P.coinsRun, gates: P.gates, gatesTotal: world.gates.length,
      topSpeed: P.topSpeed, travel: P.travel, drifts: P.drifts, carId: playerSpec.id
    });
  }

  function finish() {
    state = 'finished';
    SFX.nitro(false);
    SFX.engineOff();
    const total = P.raceTime;
    if (hooks.onFinish) hooks.onFinish({
      time: total, lapTimes: P.lapTimes.slice(), coins: P.coinsRun,
      position: P.position, racers: P.racers, topSpeed: P.topSpeed,
      drifts: P.drifts, trackId: trackDef.id, mode
    });
  }

  function update(dt) {
    if (state === 'showroom') { renderShowroom(dt); return; }
    if (!track && !world) return;

    if (state === 'countdown') {
      P.countdown -= dt;
      const f = P.cdFlags || (P.cdFlags = {});
      if (P.countdown < 3.0 && !f.a) { f.a = true; SFX.beep(false); if (hooks.onCount) hooks.onCount(3); }
      if (P.countdown < 2.0 && !f.b) { f.b = true; SFX.beep(false); if (hooks.onCount) hooks.onCount(2); }
      if (P.countdown < 1.0 && !f.c) { f.c = true; SFX.beep(false); if (hooks.onCount) hooks.onCount(1); }
      if (P.countdown <= 0) {
        state = 'race';
        P.raceStart = 0; P.raceTime = 0; P.lapStart = 0;
        SFX.beep(true);
        if (hooks.onGo) hooks.onGo();
      }
      updateCamera(dt);
      updateWorld(dt);
      renderer.render(scene, camera);
      return;
    }

    if (state === 'race') {
      P.raceTime += dt * 1000;
      const steps = 2;
      for (let i = 0; i < steps; i++) stepPlayer(dt / steps);
      if (state !== 'race') return;   // finished inside step
      updateCamera(dt);
      updateWorld(dt);
      if (hooks.onTick) hooks.onTick(dt);
      renderer.render(scene, camera);
      return;
    }

    if (state === 'paused' || state === 'finished') {
      updateWorld(dt * 0.25);
      updateCamera(dt);
      renderer.render(scene, camera);
    }
  }

  function pause() { if (state === 'race' || state === 'countdown') { state = 'paused'; SFX.engineOff(); } }
  function resume() { if (state === 'paused') { state = 'race'; } }
  function cycleCamera() { camMode = (camMode + 1) % 3; return camMode; }

  return {
    init, resize, setQuality, startRace, showroom, update, pause, resume,
    cycleCamera, hooks, input, P, orbit: (d) => { showSpin += d; },
    setHandling: (l) => { if (HANDLING[l]) handlingLevel = l; },
    get handling() { return handlingLevel; },
    get world() { return world; }, get env() { return env; },
    get state() { return state; }, set state(v) { state = v; },
    get rivals() { return rivalPool ? rivalPool.list : null; },
    get track() { return track; }, get perf() { return perf; }, get mode() { return mode; },
    get camMode() { return camMode; }
  };
})();
