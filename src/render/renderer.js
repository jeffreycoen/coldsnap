// render/renderer.js — the COLDSNAP renderer, extracted VERBATIM from
// src/demo/coldsnap-proving-grounds.jsx (lines 2099-2761), with the module
// imports the single-file version got from its own top-of-file scope.
import * as THREE from "three";
import { POOL, INFANTRY, BAYER4, snapCam, ICE_CREEP, ICE_CREEP_T } from "../engine/core.js";

// ==================================================================== render
const PAL = { bisonBlue: 0x33619c, scoutRed: 0x8a4a44, snow: 0xe9edf2, uiRed: 0xd8433a }; // player is blue steel; the enemy wears the red now
function makeGradientMap() {
  const d = new Uint8Array([70, 70, 70, 255, 128, 128, 128, 255, 190, 190, 190, 255, 255, 255, 255, 255]);
  const t = new THREE.DataTexture(d, 4, 1, THREE.RGBAFormat);
  t.minFilter = THREE.NearestFilter; t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false; t.needsUpdate = true;
  return t;
}
function makeSplat() {
  const cv = document.createElement("canvas");
  cv.width = 1024; cv.height = 1024; // DIVERGENCE from the demo (512): block-scale grid needs the resolution
  const cx = cv.getContext("2d");
  const paintBase = () => {
    cx.globalAlpha = 1; cx.fillStyle = "#f2f6fa"; cx.fillRect(0, 0, 1024, 1024);
    cx.fillStyle = "#e2eaf3";
    for (let i = 0; i < 900; i++) { const x = (i * 137) % 1024, y = (i * 89 + ((i * i) % 7) * 31) % 1024; cx.fillRect(x, y, 2, 2); }
    cx.fillStyle = "#cdd9e6";
    for (let i = 0; i < 260; i++) { const x = (i * 251) % 1024, y = (i * 173 + ((i * i) % 11) * 17) % 1024; cx.fillRect(x, y, 1, 1); }
    // ---- the town, painted into the base so a range reset repaints it ----
    // (feature-detected: the jsdom e2e canvas stub only implements what three
    // needs — path/arc calls on it would kill the mount)
    // ---- tactical grid: 4m minors, 20m majors, painted into the base so
    // range resets repaint it. fillRect only — it must draw under the jsdom
    // stub too (the feature-detect below bails before the town lanes). The
    // lines drape over the heightfield via the terrain UVs, so relief reads
    // at a glance: they bend over the hill and dive into the bowl.
    {
      // DIVERGENCE from the demo's 4m/20m grid: cells are one masonry block
      // (0.83m PITCH) with a heavier line every 4 blocks, so terrain relief
      // reads in the same visual unit as every wall and house.
      const W2Ug = 1024 / 188.7, U0g = 94.35, BLK = 0.83;
      for (let k = Math.ceil(-92 / BLK); k * BLK <= 92; k++) {
        const gp = Math.round((k * BLK + U0g) * W2Ug);
        cx.fillStyle = k % 4 === 0 ? "rgba(96,110,128,0.38)" : "rgba(139,152,168,0.16)";
        cx.fillRect(gp, 0, 1, 1024);
        cx.fillRect(0, gp, 1024, 1);
      }
    }
    if (!cx.beginPath || !cx.stroke || !cx.arc || !cx.strokeRect) return;
    const W2U = 1024 / 188.7, U0 = 94.35; // world meters -> canvas px
    const uu = (x2) => (x2 + U0) * W2U, vv2 = (z2) => (z2 + U0) * W2U;
    const lane = (x0, z0, x1, z1, wm, col) => {
      cx.strokeStyle = col || "rgba(101,92,80,0.55)"; cx.lineCap = "round";
      cx.lineWidth = wm * W2U;
      cx.beginPath(); cx.moveTo(uu(x0), vv2(z0)); cx.lineTo(uu(x1), vv2(z1)); cx.stroke();
    };
    lane(0, -50, 0, 76, 7);                       // main street: spawn to convoy road
    for (const o of [-1.2, 1.2]) lane(o, -50, o, 76, 0.6, "rgba(66,58,48,0.35)"); // wheel ruts
    lane(-3.5, 2, 14, 2, 5);                      // cross street to the east houses
    lane(-3, -26, -20, -24, 5); lane(-20, -24, -20, -8, 6); // hangar drive
    lane(3.5, 41, 15, 41, 4);                     // warehouse spur
    cx.fillStyle = "rgba(150,143,132,0.45)";      // plaza around the keep
    cx.beginPath(); cx.arc(uu(-7), vv2(2), 8.5 * W2U, 0, Math.PI * 2); cx.fill();
    cx.strokeStyle = "rgba(140,128,110,0.4)"; cx.lineWidth = 6; // pond shore
    cx.strokeRect(uu(-8.6), vv2(19.4), 17.2 * W2U, 17.2 * W2U);
  };
  paintBase();
  const tex = new THREE.CanvasTexture(cv);
  tex.minFilter = THREE.NearestFilter; tex.magFilter = THREE.NearestFilter; tex.generateMipmaps = false;
  return {
    tex,
    clear() { paintBase(); tex.needsUpdate = true; },
    treads: 0,
    tread(u, v) {
      cx.globalAlpha = 1;
      cx.fillStyle = "rgba(52,42,32,0.42)"; // churned earth through the snow
      cx.fillRect(u - 1, v - 1, 2, 2);
      this.treads++;
      tex.needsUpdate = true;
    },
    scorch(u, v, rPx) {
      const g = cx.createRadialGradient(u, v, 1, u, v, rPx);
      g.addColorStop(0, "rgba(24,20,18,0.9)"); g.addColorStop(0.55, "rgba(38,32,28,0.55)"); g.addColorStop(1, "rgba(38,32,28,0)");
      cx.globalAlpha = 1; cx.fillStyle = g;
      cx.beginPath(); cx.arc(u, v, rPx, 0, Math.PI * 2); cx.fill();
      tex.needsUpdate = true;
    },
  };
}
const POST_VERT = "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }";
const POST_FRAG = `
uniform sampler2D tCol; uniform sampler2D tNor; uniform sampler2D tDep; uniform sampler2D tBayer;
uniform vec2 uRes; uniform vec2 uShift; uniform float uOutline; uniform float uDither; uniform float uPalette; uniform float uLevels;
varying vec2 vUv;
void main(){
  vec2 px = 1.0 / uRes;
  vec2 uv = vUv + uShift * px;
  vec3 c = texture2D(tCol, uv).rgb;
  vec3 n0 = texture2D(tNor, uv).xyz;
  float d0 = texture2D(tDep, uv).x;
  vec3 nx = texture2D(tNor, uv + vec2(px.x, 0.0)).xyz;
  vec3 ny = texture2D(tNor, uv + vec2(0.0, px.y)).xyz;
  float dx = texture2D(tDep, uv + vec2(px.x, 0.0)).x;
  float dy = texture2D(tDep, uv + vec2(0.0, px.y)).x;
  float en = step(0.42, distance(n0, nx) + distance(n0, ny));
  float ed = step(0.0022, abs(d0 - dx) + abs(d0 - dy));
  float edge = max(en, ed) * uOutline;
  float bay = texture2D(tBayer, fract(uv * uRes / 4.0)).r - 0.5;
  vec3 q = floor(c * uLevels + bay * uDither + 0.5) / uLevels;
  c = mix(c, q, step(0.5, uPalette));
  c = mix(c, c * vec3(0.93, 0.97, 1.06), 0.35 * step(0.5, uPalette));
  c = mix(c, c * 0.2, edge);
  gl_FragColor = vec4(c, 1.0);
}`;
export function makeRenderer(canvas, world0) {
  let world = world0;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.BasicShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xc4d2e0);
  scene.fog = new THREE.Fog(0xc4d2e0, 95, 230);
  const NORM_BG = new THREE.Color(0x8080ff);
  const grad = makeGradientMap();
  const toon = (color, extra) => Object.assign(new THREE.MeshToonMaterial({ color, gradientMap: grad }), extra || {});
  // camera: fixed RA orientation; only position moves (texel-snapped)
  const cam = new THREE.OrthographicCamera(-40, 40, 25, -25, 2, 400);
  const yawA = (194 * Math.PI) / 180, pitchA = (32 * Math.PI) / 180, camDist = 150;
  const back = { x: Math.sin(yawA) * Math.cos(pitchA), y: Math.sin(pitchA), z: Math.cos(yawA) * Math.cos(pitchA) };
  cam.position.set(back.x * camDist, back.y * camDist, back.z * camDist);
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld();
  const camQ = cam.quaternion.clone();
  const camFwd = { x: -back.x, y: -back.y, z: -back.z };
  const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camQ);
  const camUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camQ);
  const R3 = (v) => ({ x: v.x, y: v.y, z: v.z });
  // lights
  const hemi = new THREE.HemisphereLight(0xe2ecf7, 0x7e8fa3, 0.62);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0da, 0.92);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -60; sun.shadow.camera.right = 60;
  sun.shadow.camera.top = 60; sun.shadow.camera.bottom = -60;
  sun.shadow.camera.near = 5; sun.shadow.camera.far = 220;
  sun.shadow.bias = -0.002;
  scene.add(sun); scene.add(sun.target);
  // terrain
  const F = world.field;
  const Wd = (F.n - 1) * F.cs;
  const terraGeo = new THREE.PlaneGeometry(Wd, Wd, F.n - 1, F.n - 1);
  terraGeo.rotateX(-Math.PI / 2);
  const splat = makeSplat();
  const terraMat = toon(0xffffff); terraMat.map = splat.tex;
  const terra = new THREE.Mesh(terraGeo, terraMat);
  terra.receiveShadow = true;
  scene.add(terra);
  function syncTerrain() {
    const pa = terraGeo.attributes.position;
    for (let j = 0; j < F.n; j++) for (let i = 0; i < F.n; i++) pa.setY(j * F.n + i, F.h[j * F.n + i]);
    pa.needsUpdate = true;
    terraGeo.computeVertexNormals();
    // relief shading: the toon band collapses every slope under ~24° into the
    // same white, so hills and the pond bowl were physically there yet
    // invisible. Bake slope into vertex colors (steeper = darker), with a
    // cool tint below the waterline so the basin reads as a basin.
    let ca = terraGeo.attributes.color;
    if (!ca) {
      terraGeo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(F.n * F.n * 3), 3));
      ca = terraGeo.attributes.color;
      terraMat.vertexColors = true; terraMat.needsUpdate = true;
    }
    for (let j = 0; j < F.n; j++) for (let i = 0; i < F.n; i++) {
      const k = j * F.n + i;
      const iw = i > 0 ? k - 1 : k, ie = i < F.n - 1 ? k + 1 : k;
      const jn = j > 0 ? k - F.n : k, js = j < F.n - 1 ? k + F.n : k;
      const g = Math.hypot(F.h[ie] - F.h[iw], F.h[js] - F.h[jn]) / (2 * F.cs);
      const shade = 1 - Math.min(0.3, g * 0.62);
      const wet = F.h[k] < POOL.level - 0.15;
      ca.setXYZ(k, shade * (wet ? 0.84 : 1), shade * (wet ? 0.9 : 1), shade * (wet ? 0.98 : 1));
    }
    ca.needsUpdate = true;
    F.dirty = false;
  }
  syncTerrain();
  // water
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(POOL.x1 - POOL.x0, POOL.z1 - POOL.z0),
    new THREE.MeshBasicMaterial({ color: 0x2b4a5c, transparent: true, opacity: 0.82 })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set((POOL.x0 + POOL.x1) / 2, POOL.level, (POOL.z0 + POOL.z1) / 2);
  water.layers.set(1);
  scene.add(water);
  // reticle
  const reticle = new THREE.Mesh(new THREE.RingGeometry(0.7, 1.05, 20), new THREE.MeshBasicMaterial({ color: 0xff6b5e, transparent: true, opacity: 1.0, depthWrite: false }));
  reticle.rotation.x = -Math.PI / 2; reticle.layers.set(1);
  scene.add(reticle);
  // DIVERGENCE from the frozen demo: trajectory preview — a sampled arc
  // from muzzle to reticle, fed by the game layer via setTraj(points, hitIdx).
  // Segments past the first obstruction dim; the obstruction gets a marker.
  const TRAJ_N = 48;
  const trajGeo = new THREE.BufferGeometry();
  trajGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(TRAJ_N * 3), 3));
  const trajLine = new THREE.Line(trajGeo, new THREE.LineDashedMaterial({ color: 0xffd27a, transparent: true, opacity: 0.75, depthWrite: false, dashSize: 0.7, gapSize: 0.45 }));
  trajLine.layers.set(1); trajLine.visible = false; trajLine.frustumCulled = false;
  scene.add(trajLine);
  const trajDim = new THREE.Line(
    (() => { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(TRAJ_N * 3), 3)); return g; })(),
    new THREE.LineDashedMaterial({ color: 0x8b93a0, transparent: true, opacity: 0.3, depthWrite: false, dashSize: 0.4, gapSize: 0.6 }));
  trajDim.layers.set(1); trajDim.visible = false; trajDim.frustumCulled = false;
  scene.add(trajDim);
  const trajHit = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.85, 16), new THREE.MeshBasicMaterial({ color: 0xff6b5e, transparent: true, opacity: 0.9, depthWrite: false }));
  trajHit.layers.set(1); trajHit.visible = false;
  scene.add(trajHit);
  function setTraj(points, hitIdx) {
    if (!points || points.length < 2) { trajLine.visible = trajDim.visible = trajHit.visible = false; return; }
    const cut = hitIdx == null ? points.length : Math.min(points.length, hitIdx + 1);
    const pa = trajGeo.attributes.position;
    for (let i = 0; i < TRAJ_N; i++) { const p = points[Math.min(i, cut - 1)]; pa.setXYZ(i, p.x, p.y, p.z); }
    pa.needsUpdate = true; trajGeo.computeBoundingSphere(); trajLine.computeLineDistances(); trajLine.visible = true;
    if (hitIdx != null && hitIdx < points.length) {
      const da = trajDim.geometry.attributes.position;
      for (let i = 0; i < TRAJ_N; i++) { const p = points[Math.min(points.length - 1, Math.max(hitIdx, Math.min(hitIdx + i, points.length - 1)))]; da.setXYZ(i, p.x, p.y, p.z); }
      da.needsUpdate = true; trajDim.geometry.computeBoundingSphere(); trajDim.computeLineDistances(); trajDim.visible = true;
      const h = points[hitIdx];
      trajHit.position.set(h.x, h.y + 0.15, h.z); trajHit.rotation.x = -Math.PI / 2; trajHit.visible = true;
    } else { trajDim.visible = false; trajHit.visible = false; }
  }
  // volley strike marker: pulses at the painted point while the rockets fall
  const strikeRing = new THREE.Mesh(new THREE.RingGeometry(1.6, 2.1, 24), new THREE.MeshBasicMaterial({ color: 0xffa24a, transparent: true, opacity: 0, depthWrite: false }));
  strikeRing.rotation.x = -Math.PI / 2; strikeRing.layers.set(1); strikeRing.visible = false;
  scene.add(strikeRing);
  // trial focus marker: pulsing gold ring at the current objective
  let treadAcc = 0;
  // vehicles (individual groups by body id)
  const vehMap = new Map();
  function makeTreadTex() {
    const c = document.createElement("canvas"); c.width = 16; c.height = 4;
    const x = c.getContext("2d");
    x.fillStyle = "#1b1e22"; x.fillRect(0, 0, 16, 4);
    x.fillStyle = "#3a4048"; x.fillRect(0, 0, 3, 4); x.fillRect(8, 0, 3, 4);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(7, 1);
    t.minFilter = THREE.NearestFilter; t.magFilter = THREE.NearestFilter; t.generateMipmaps = false;
    return t;
  }
  function buildBison() {
    const g = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(3.3, 1.5, 6.4), toon(PAL.bisonBlue));
    hull.position.y = 0.35;
    hull.castShadow = true; hull.receiveShadow = true; g.add(hull);
    const treadMats = [];
    for (const sx of [-1, 1]) {
      const tex = makeTreadTex();
      const tm = new THREE.MeshBasicMaterial({ map: tex, color: 0xffffff });
      treadMats.push(tm);
      const tread = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.15, 6.9), tm);
      tread.position.set(sx * 1.78, -0.42, 0); tread.castShadow = true; g.add(tread);
      for (const wz of [-2.5, -0.85, 0.85, 2.5]) {
        const wheel = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.62, 0.62), toon(0x101317));
        wheel.position.set(sx * 1.78, -0.62, wz); g.add(wheel);
      }
      const fender = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.16, 7.1), toon(0x1e3a56));
      fender.position.set(sx * 1.78, 0.28, 0); g.add(fender);
    }
    g.userData.treadMats = treadMats;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(4.8, 1.15, 0.5), toon(0x777d84));
    blade.position.set(0, -0.45, 3.5); blade.rotation.x = -0.24; blade.castShadow = true; g.add(blade);
    const tur = new THREE.Group(); tur.position.y = 1.35;
    const turBox = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.95, 2.7), toon(0x2a5082)); turBox.castShadow = true; tur.add(turBox);
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 3.6), toon(0x33383d)); barrel.position.set(0, 0.12, 2.4); barrel.castShadow = true; tur.add(barrel);
    const star = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.14, 0.9), toon(0xe0c34a)); star.position.set(0, 1.13, 0); g.add(star);
    // coax .50 stub riding right of the main gun
    const coax = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.5, 6), tur.material);
    coax.rotation.x = Math.PI / 2; coax.position.set(0.55, 0.3, 1.5);
    tur.add(coax);
    g.add(tur); g.userData.turret = tur;
    return g;
  }
  function buildTruck() {
    const g = new THREE.Group();
    const bed = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.0, 3.4), toon(0x4c5a49));
    bed.position.set(0, 0.15, -0.7); bed.castShadow = true; g.add(bed);
    const canvasTop = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.8, 3.2), toon(0x6b7565));
    canvasTop.position.set(0, 0.95, -0.7); canvasTop.castShadow = true; g.add(canvasTop);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.15, 1.5), toon(0x3f4c3e));
    cab.position.set(0, 0.2, 1.75); cab.castShadow = true; g.add(cab);
    for (const wz of [-1.6, 1.3]) for (const sx of [-1, 1]) {
      const wheel = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.75, 0.75), toon(0x15181c));
      wheel.position.set(sx * 1.05, -0.6, wz); g.add(wheel);
    }
    return g;
  }
  function buildScout() {
    const g = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.4, 3.7), toon(PAL.scoutRed));
    hull.castShadow = true; hull.receiveShadow = true; g.add(hull); g.userData.hull = hull;
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 1.4), toon(0x6f3b36)); top.position.y = 1.0; top.castShadow = true; g.add(top); g.userData.top = top;
    return g;
  }
  // instanced pools
  const dummy = new THREE.Object3D();
  function pool(geo, mat, n, shadow) {
    const m = new THREE.InstancedMesh(geo, mat, n);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // instanceColor must exist BEFORE the first compile: USE_INSTANCING_COLOR is a
    // compile-time program key (WebGLPrograms: object.instanceColor !== null), and a
    // count-0 pool that compiles early locks the define out forever — setColorAt
    // then writes into a buffer no shader reads. Born white = identity multiply.
    m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3).fill(1), 3);
    m.instanceColor.setUsage(THREE.DynamicDrawUsage);
    m.count = 0; if (shadow) m.castShadow = true;
    scene.add(m);
    return m;
  }
  // table-driven infantry pools from the INFANTRY dress spec (one pool per part)
  const buildInfPools = (spec, n, pal) => spec.map((p) => {
    let g;
    if (p.cyl) { g = new THREE.CylinderGeometry(p.cyl[0], p.cyl[1], p.cyl[2], p.cyl[3], 1); if (p.rotY) g.rotateY(p.rotY); }
    else g = new THREE.BoxGeometry(p.box[0], p.box[1], p.box[2]);
    if (p.ty) g.translate(0, p.ty, 0);
    if (p.preRot) { g.rotateX(p.preRot[0]); g.rotateY(p.preRot[1]); g.rotateZ(p.preRot[2]); }
    // material stays WHITE: instanceColor MULTIPLIES material color in the shader,
    // so painting both squares the palette (rust^2 = brick, slate^2 = black — the
    // "pencil sketch soldiers" bug). instanceColor is the single source of color.
    const m = pool(g, toon(0xffffff), n, true);
    if (p.key === "coat" || p.key === "chest") m.receiveShadow = true;
    return m;
  });
  const conPools = buildInfPools(INFANTRY.con, 96, INFANTRY.pal.con);
  const grenPools = buildInfPools(INFANTRY.gren, 24, INFANTRY.pal.gren);
  const INF_LIVE = { con: {}, gren: {} }, INF_DEAD = { con: {}, gren: {} };
  for (const t of ["con", "gren"]) for (const k in INFANTRY.pal[t]) { INF_LIVE[t][k] = new THREE.Color(INFANTRY.pal[t][k]); INF_DEAD[t][k] = new THREE.Color(INFANTRY.dead[t][k]); }
  const _swq = new THREE.Quaternion(), _bq = new THREE.Quaternion(), _AXX = new THREE.Vector3(1, 0, 0);
  const chunkGeo = new THREE.BoxGeometry(1.2, 1.2, 1.2);
  const chunkMesh = pool(chunkGeo, toon(0xa6b2c0), 1000, true); // 865 stones live now (keep 84 + walls 240 + hangar 115 + warehouse 146 + houses 280)
  chunkMesh.receiveShadow = true;
  const iceMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.66, depthWrite: true });
  const _iceC = new THREE.Color();
  const _iceR = new Float32Array(80); // display envelope: fast attack, slow decay
  const iceMesh = pool(new THREE.BoxGeometry(1, 1, 1), iceMat, 80, false); // 8x8 sheet = 64 plates (the old 20 silently truncated)
  iceMesh.receiveShadow = false;
  const wreckTint = new THREE.Color(0x3c4046);
  const debrisMesh = pool(new THREE.BoxGeometry(0.18, 0.18, 0.18), toon(0x6a6f76), 200, false);
  const smokeMat = new THREE.MeshBasicMaterial({ color: 0x2c3036, transparent: true, opacity: 0.55, depthWrite: false });
  const smokeMesh = pool(new THREE.PlaneGeometry(1, 1), smokeMat, 128, false); smokeMesh.layers.set(1);
  const fireMat = new THREE.MeshBasicMaterial({ color: 0xffb257, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
  const fireMesh = pool(new THREE.PlaneGeometry(1, 1), fireMat, 96, false); fireMesh.layers.set(1);
  const tracerMat = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
  const tracerMesh = pool(new THREE.BoxGeometry(0.09, 0.09, 1), tracerMat, 64, false); tracerMesh.layers.set(1);
  const blobMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.34, depthWrite: false });
  const blobMesh = pool(new THREE.CircleGeometry(1, 12), blobMat, 96, false); blobMesh.layers.set(1);

  // snowfall: instanced flakes drifting in a box around the camera focus
  const flakeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false });
  const flakeMesh = pool(new THREE.PlaneGeometry(0.14, 0.14), flakeMat, 220, false);
  flakeMesh.layers.set(1);
  const flakes = [];
  for (let i = 0; i < 220; i++) flakes.push({ x: (Math.random() - 0.5) * 64, y: Math.random() * 34, z: (Math.random() - 0.5) * 64, vy: 1.4 + Math.random() * 1.6, ph: Math.random() * 6.3 });

  // particles
  const debris = [], smoke = [], fire = [];
  function spawnBoom(x, y, z, r) {
    for (let i = 0; i < 12; i++) {
      if (debris.length >= 200) break;
      const a = Math.random() * Math.PI * 2, up = 3 + Math.random() * 6;
      debris.push({ x, y: y + 0.3, z, vx: Math.cos(a) * (2 + Math.random() * 5), vy: up, vz: Math.sin(a) * (2 + Math.random() * 5), rot: Math.random() * 6, spin: (Math.random() - 0.5) * 10, life: 1.3 + Math.random() * 0.5 });
    }
    for (let i = 0; i < 9; i++) {
      if (smoke.length >= 128) break;
      smoke.push({ x: x + (Math.random() - 0.5) * r * 0.5, y: y + 0.4, z: z + (Math.random() - 0.5) * r * 0.5, vy: 1.6 + Math.random() * 1.4, s: 0.8 + Math.random() * 0.9, life: 1.5 + Math.random() * 0.7, age: 0 });
    }
    for (let i = 0; i < 6; i++) {
      if (fire.length >= 96) break;
      fire.push({ x: x + (Math.random() - 0.5) * r * 0.4, y: y + 0.3 + Math.random() * 0.6, z: z + (Math.random() - 0.5) * r * 0.4, s: 0.7 + Math.random() * r * 0.35, life: 0.32, age: 0 });
    }
  }
  function puff(x, y, z, n, col) {
    for (let i = 0; i < n; i++) {
      if (smoke.length >= 128) break;
      smoke.push({ x: x + (Math.random() - 0.5) * 0.8, y, z: z + (Math.random() - 0.5) * 0.8, vy: 1.2, s: 0.5 + Math.random() * 0.5, life: 0.9, age: 0, col });
    }
  }
  // post pipeline
  const bayerTex = new THREE.DataTexture(new Uint8Array(BAYER4.flatMap((v) => [v * 17, v * 17, v * 17, 255])), 4, 4, THREE.RGBAFormat);
  bayerTex.minFilter = THREE.NearestFilter; bayerTex.magFilter = THREE.NearestFilter;
  bayerTex.wrapS = THREE.RepeatWrapping; bayerTex.wrapT = THREE.RepeatWrapping; bayerTex.needsUpdate = true;
  const postScene = new THREE.Scene();
  const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const postMat = new THREE.ShaderMaterial({
    vertexShader: POST_VERT, fragmentShader: POST_FRAG,
    uniforms: {
      tCol: { value: null }, tNor: { value: null }, tDep: { value: null }, tBayer: { value: bayerTex },
      uRes: { value: new THREE.Vector2(320, 200) }, uShift: { value: new THREE.Vector2(0, 0) },
      uOutline: { value: 1 }, uDither: { value: 1 }, uPalette: { value: 1 }, uLevels: { value: 7 },
    },
    depthTest: false, depthWrite: false,
  });
  postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMat));
  const normMat = new THREE.MeshNormalMaterial();
  let rtColor = null, rtNormal = null, rtW = 320, rtH = 200;
  const gfx = { scale: 1, outline: 1, dither: 1, palette: 1 }; // 1x default: crisp pixels at phone DPI, retro treatment kept
  let cssW = 0, cssH = 0, halfH = 22, halfW = 36, zoom = 1;
  function applyFrustum() {
    const a = cssW / Math.max(1, cssH);
    if (a >= 1) { halfH = 22 / zoom; halfW = halfH * a; }
    else { halfW = 18.5 / zoom; halfH = Math.min(halfW / a, halfW * 2.9); }
    cam.left = -halfW; cam.right = halfW; cam.top = halfH; cam.bottom = -halfH;
    cam.updateProjectionMatrix();
  }
  function rebuildRTs() {
    const w = Math.max(64, Math.floor(cssW / gfx.scale));
    const h = Math.max(64, Math.floor(cssH / gfx.scale));
    rtW = w; rtH = h;
    if (rtColor) { rtColor.dispose(); rtNormal.dispose(); }
    const depthTexture = new THREE.DepthTexture(w, h);
    rtColor = new THREE.WebGLRenderTarget(w, h, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true, depthTexture });
    rtNormal = new THREE.WebGLRenderTarget(w, h, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true });
    postMat.uniforms.tCol.value = rtColor.texture;
    postMat.uniforms.tDep.value = rtColor.depthTexture;
    postMat.uniforms.tNor.value = rtNormal.texture;
    postMat.uniforms.uRes.value.set(w, h);
  }
  function resize() {
    const w = canvas.clientWidth || +(canvas.dataset && canvas.dataset.w) || 960;
    const h = canvas.clientHeight || +(canvas.dataset && canvas.dataset.h) || 600;
    if (w === cssW && h === cssH) return;
    cssW = w; cssH = h;
    renderer.setSize(w, h, false);
    applyFrustum();
    rebuildRTs();
  }
  function setZoom(z) {
    zoom = Math.max(0.7, Math.min(2, z));
    applyFrustum();
  }
  function setGfx(p) {
    if (p.preset === "retro") Object.assign(gfx, { scale: 3, outline: 1, dither: 1, palette: 1 });
    else if (p.preset === "clean") Object.assign(gfx, { scale: 2, outline: 1, dither: 0, palette: 1 });
    if (p.scale) gfx.scale = Math.max(1, Math.min(4, p.scale | 0));
    for (const k of ["outline", "dither", "palette"]) if (p[k] != null) gfx[k] = p[k] ? 1 : 0;
    postMat.uniforms.uOutline.value = gfx.outline;
    postMat.uniforms.uDither.value = gfx.dither;
    postMat.uniforms.uPalette.value = gfx.palette;
    rebuildRTs();
  }
  let shake = 0;
  function consume(events) {
    for (const e of events) {
      if (e.type === "boom") {
        spawnBoom(e.x, e.y, e.z, e.r);
        shake = Math.min(2.4, shake + 0.5 + e.r * 0.18);
      } else if (e.type === "splat") {
        const u = ((e.x + F.half) / Wd) * 512, v = ((e.z + F.half) / Wd) * 512;
        splat.scorch(u, v, (e.r / Wd) * 512);
      } else if (e.type === "muzzle") {
        fire.push({ x: e.x, y: e.y, z: e.z, s: 1.1, life: 0.12, age: 0 });
        shake = Math.min(2.4, shake + 0.25);
      } else if (e.type === "gmuzzle") {
        fire.push({ x: e.x, y: e.y + 0.4, z: e.z, s: 0.8, life: 0.1, age: 0 });
      } else if (e.type === "weldbreak") puff(e.x, e.y, e.z, e.ice ? 3 : 2, e.ice ? 0xe8f4fb : 0x8a8f96);
      else if (e.type === "splash") puff(e.x, POOL.level + 0.2, e.z, 4, 0x9fc4d8);
    }
  }
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3();
  function writeInst(mesh, i, x, y, z, q, sx, sy, sz) {
    dummy.position.set(x, y, z);
    if (q) dummy.quaternion.set(q.x, q.y, q.z, q.w); else dummy.quaternion.identity();
    dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  function render(dt, focus, aim, turretYaw) {
    resize();
    if (F.dirty) syncTerrain();
    // vehicles sync
    for (const b of world.bodies) {
      if (b.kind !== "vehicle" && b.kind !== "wreck") continue;
      let g = vehMap.get(b.id);
      if (!g) {
        g = b.id === world.bisonId ? buildBison() : (b.vtype === "truck" ? buildTruck() : buildScout());
        vehMap.set(b.id, g); scene.add(g);
      }
      g.position.set(b.pos.x, b.pos.y, b.pos.z);
      g.quaternion.set(b.q.x, b.q.y, b.q.z, b.q.w);
      if ((b.kind === "wreck" || (b.kind === "truck" && !b.alive)) && !g.userData.dead) {
        g.userData.dead = true;
        g.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.lerp(wreckTint, 0.75); } });
      }
      if (g.userData.turret) g.userData.turret.rotation.y = turretYaw;
    }
    for (const [id, g] of vehMap) if (!world.byId.has(id)) { scene.remove(g); vehMap.delete(id); }
    // units: table-driven multi-part infantry with a speed-keyed march swing.
    // Limb quats compose body * local-X(phase); dead men freeze mid-stride and
    // take the winter-kill tint per role.
    let ci = 0, gi = 0;
    for (const b of world.bodies) {
      if (b.kind !== "unit") continue;
      const R = b.R;
      const isG = b.utype === "gren";
      if (isG ? gi >= 24 : ci >= 96) continue;
      const sp = b.alive ? Math.hypot(b.v.x, b.v.z) : 0;
      b.wph = (b.wph || 0) + sp * dt * 3.4;
      const sw = Math.sin(b.wph) * Math.min(0.5, sp * 0.24);
      const spec = isG ? INFANTRY.gren : INFANTRY.con;
      const pools = isG ? grenPools : conPools;
      const idx = isG ? gi : ci;
      for (let pi = 0; pi < spec.length; pi++) {
        const p = spec[pi], o = p.off;
        const px = b.pos.x + R[0] * o[0] + R[3] * o[1] + R[6] * o[2];
        const py = b.pos.y + R[1] * o[0] + R[4] * o[1] + R[7] * o[2];
        const pz = b.pos.z + R[2] * o[0] + R[5] * o[1] + R[8] * o[2];
        let q = b.q;
        if (p.swing) {
          _bq.set(b.q.x, b.q.y, b.q.z, b.q.w);
          _swq.setFromAxisAngle(_AXX, sw * p.swing * p.swingK);
          _bq.multiply(_swq);
          q = _bq;
        }
        writeInst(pools[pi], idx, px, py, pz, q, 1, 1, 1);
        if (pools[pi].setColorAt) pools[pi].setColorAt(idx, (b.alive ? INF_LIVE : INF_DEAD)[isG ? "gren" : "con"][p.role]);
      }
      if (isG) gi++; else ci++;
    }
    for (const m of conPools) { m.count = ci; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    for (const m of grenPools) { m.count = gi; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    // chunks
    let ki = 0;
    for (const b of world.bodies) {
      if (b.kind !== "chunk" || ki >= 1000) continue;
      writeInst(chunkMesh, ki, b.pos.x, b.pos.y, b.pos.z, b.q, b.hx / 0.6, b.hy / 0.6, b.hz / 0.6);
      ki++;
    }
    chunkMesh.count = ki; chunkMesh.instanceMatrix.needsUpdate = true;
    // ice plates — tinted by how close their welds are to failing (shock or creep)
    let ip = 0;
    if (world.ice) {
      for (const b of world.bodies) {
        if (b.kind !== "ice" || ip >= 80) continue;
        writeInst(iceMesh, ip, b.pos.x, b.pos.y, b.pos.z, b.q, b.hx * 2, b.hy * 2, b.hz * 2);
        let r = 0;
        for (const wd of world.welds) {
          if (wd.broken || (wd.a !== b && wd.b !== b)) continue;
          // danger begins at the creep threshold; full slate is the creep countdown itself
          const sr = Math.max(((wd.stress || 0) / ICE_CREEP) * 0.75, (wd.hiT || 0) / ICE_CREEP_T);
          if (sr > r) r = sr;
        }
        r = Math.pow(Math.min(1, r), 0.6);
        r = Math.max(r, _iceR[ip] - 3.0 * dt);
        _iceR[ip] = r;
        _iceC.setRGB(0.851 + (0.329 - 0.851) * r, 0.929 + (0.42 - 0.929) * r, 0.965 + (0.49 - 0.965) * r);
        iceMesh.setColorAt(ip, _iceC);
        ip++;
      }
      if (iceMesh.instanceColor) iceMesh.instanceColor.needsUpdate = true;
    }
    iceMesh.count = ip; iceMesh.instanceMatrix.needsUpdate = true;
    // debris/smoke/fire step
    let di = 0;
    for (let i = debris.length - 1; i >= 0; i--) {
      const p = debris[i];
      p.life -= dt; p.vy -= 9.8 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.rot += p.spin * dt;
      const h = F.heightAt(p.x, p.z);
      if (p.y < h + 0.09) { p.y = h + 0.09; p.vy *= -0.3; p.vx *= 0.6; p.vz *= 0.6; p.spin *= 0.5; }
      if (p.life <= 0) { debris.splice(i, 1); continue; }
      const s = Math.min(1, p.life * 2);
      dummy.position.set(p.x, p.y, p.z); dummy.quaternion.setFromEuler(new THREE.Euler(p.rot, p.rot * 0.7, 0));
      dummy.scale.set(s, s, s); dummy.updateMatrix();
      if (di < 200) chunkFillDebris(di++, dummy.matrix);
    }
    function chunkFillDebris(i, m) { debrisMesh.setMatrixAt(i, m); }
    debrisMesh.count = di; debrisMesh.instanceMatrix.needsUpdate = true;
    let si = 0;
    for (let i = smoke.length - 1; i >= 0; i--) {
      const p = smoke[i];
      p.age += dt; p.y += p.vy * dt;
      if (p.age >= p.life) { smoke.splice(i, 1); continue; }
      const t = p.age / p.life, s = p.s * (0.6 + t * 1.8);
      dummy.position.set(p.x, p.y, p.z); dummy.quaternion.copy(camQ);
      dummy.scale.set(s, s, 1); dummy.updateMatrix();
      if (si < 128) smokeMesh.setMatrixAt(si++, dummy.matrix);
    }
    smokeMesh.count = si; smokeMesh.instanceMatrix.needsUpdate = true;
    let fi = 0;
    for (let i = fire.length - 1; i >= 0; i--) {
      const p = fire[i];
      p.age += dt;
      if (p.age >= p.life) { fire.splice(i, 1); continue; }
      const t = 1 - p.age / p.life, s = p.s * (0.7 + t);
      dummy.position.set(p.x, p.y, p.z); dummy.quaternion.copy(camQ);
      dummy.scale.set(s, s, 1); dummy.updateMatrix();
      if (fi < 96) fireMesh.setMatrixAt(fi++, dummy.matrix);
    }
    fireMesh.count = fi; fireMesh.instanceMatrix.needsUpdate = true;
    // tracers from live projectiles
    let ti = 0;
    for (const p of world.projectiles) {
      if (ti >= 64 || (p.spec.delay && p.spec.delay > 0)) continue;
      const L = Math.hypot(p.v.x, p.v.y, p.v.z) || 1;
      dummy.position.set(p.pos.x, p.pos.y, p.pos.z);
      dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(p.v.x / L, p.v.y / L, p.v.z / L));
      // DIVERGENCE from the frozen demo's uniform tracers: rockets and tagged
      // MG tracer rounds draw long and thick so a volley reads as six incoming
      // things; untagged MG rounds draw short and thin so the stream has
      // rhythm instead of noise. p.tracer is set by the campaign action layer.
      const kind = p.spec.kind;
      const hot = kind === "rocket" || p.tracer;
      const th = hot ? 2.2 : kind === "mg" ? 0.7 : 1;
      dummy.scale.set(th, th, kind === "rocket" ? 4.2 : p.tracer ? 3.2 : kind === "mg" ? 1.1 : 1.8);
      dummy.updateMatrix();
      tracerMesh.setMatrixAt(ti++, dummy.matrix);
    }
    tracerMesh.count = ti; tracerMesh.instanceMatrix.needsUpdate = true;
    // blob shadows for airborne bodies
    let bi = 0;
    for (const b of world.bodies) {
      if (bi >= 96 || b.invM === 0 || b.sleeping) continue;
      if (b.airT < 0.06) continue;
      const h = F.heightAt(b.pos.x, b.pos.z);
      dummy.position.set(b.pos.x, h + 0.04, b.pos.z);
      dummy.quaternion.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
      const fp = Math.max(b.hx, b.hz) * 1.15;
      dummy.scale.set(fp, fp, 1); dummy.updateMatrix();
      blobMesh.setMatrixAt(bi++, dummy.matrix);
    }
    blobMesh.count = bi; blobMesh.instanceMatrix.needsUpdate = true;
    // snowfall drifts around the focus, wrapping in a 64x34x64 box
    for (let i = 0; i < flakes.length; i++) {
      const fk = flakes[i];
      fk.y -= fk.vy * dt;
      fk.x += Math.sin(fk.ph + fk.y * 0.4) * 0.35 * dt;
      if (fk.y < 0) { fk.y += 34; fk.x = (Math.random() - 0.5) * 64; fk.z = (Math.random() - 0.5) * 64; }
      writeInst(flakeMesh, i, focus.x + fk.x, focus.y + fk.y - 4, focus.z + fk.z, camQ, 1, 1, 1);
    }
    flakeMesh.count = flakes.length;
    flakeMesh.instanceMatrix.needsUpdate = true;

    // bison treads: scroll links with track speed, stamp marks into the splat
    const bb = world.byId.get(world.bisonId);
    const bmesh = bb ? vehMap.get(bb.id) : null;
    if (bb && bmesh && bmesh.userData.treadMats) {
      const fx = bb.R[6], fz = bb.R[8];
      const vF = bb.v.x * fx + bb.v.z * fz;
      const sL = vF + bb.w.y * 1.78, sR = vF - bb.w.y * 1.78;
      bmesh.userData.treadMats[0].map.offset.x -= sL * dt * 0.42;
      bmesh.userData.treadMats[1].map.offset.x -= sR * dt * 0.42;
      const sp = Math.hypot(bb.v.x, bb.v.z);
      if (bb.R[4] > 0.5 && sp > 0.5) {
        treadAcc += sp * dt;
        if (treadAcc > 0.34) {
          treadAcc = 0;
          const sxr = bb.R[0], szr = bb.R[2];
          for (const sgn of [-1, 1]) {
            const px = bb.pos.x + sxr * 1.78 * sgn, pz = bb.pos.z + szr * 1.78 * sgn;
            splat.tread(((px + F.half) / Wd) * 512, ((pz + F.half) / Wd) * 512);
          }
        }
      }
    }
    // reticle + beam + trial ring
    reticle.position.set(aim.x, F.heightAt(aim.x, aim.z) + 0.06, aim.z);
    const sk = world.strikeAt;
    if (sk && world.t < sk.until) {
      const ph = 1 - (sk.until - world.t) / 1.35;
      strikeRing.visible = true;
      strikeRing.position.set(sk.x, F.heightAt(sk.x, sk.z) + 0.08, sk.z);
      const sc = 1 + 0.35 * Math.sin(world.t * 18);
      strikeRing.scale.set(sc, sc, 1);
      strikeRing.material.opacity = 0.55 + 0.4 * (1 - ph);
    } else strikeRing.visible = false;
    // camera: snap position to view texels; residual + shake go to screen shift
    shake = Math.max(0, shake - dt * 4.2);
    const texel = (2 * halfW) / rtW;
    const desired = { x: focus.x + back.x * camDist, y: focus.y + back.y * camDist, z: focus.z + back.z * camDist };
    const sr = snapCam(desired, R3(camRight), R3(camUp), camFwd, texel);
    cam.position.set(sr.pos.x, sr.pos.y, sr.pos.z);
    cam.quaternion.copy(camQ);
    const shx = (Math.random() - 0.5) * shake * 2.2, shy = (Math.random() - 0.5) * shake * 2.2;
    postMat.uniforms.uShift.value.set(-sr.errX + shx, -sr.errY + shy);
    // sun rig follows focus
    sun.position.set(focus.x + 38, focus.y + 52, focus.z + 22);
    sun.target.position.set(focus.x, focus.y, focus.z);
    // pass 1: color+depth
    cam.layers.enable(1);
    renderer.setRenderTarget(rtColor);
    renderer.render(scene, cam);
    // pass 2: normals (layer 0 only)
    cam.layers.set(0);
    scene.overrideMaterial = normMat;
    const bg = scene.background; scene.background = NORM_BG;
    renderer.setRenderTarget(rtNormal);
    renderer.render(scene, cam);
    scene.overrideMaterial = null; scene.background = bg;
    cam.layers.enable(1);
    // pass 3: post to screen
    renderer.setRenderTarget(null);
    renderer.render(postScene, postCam);
  }
  function setWorld(nw) {
    world = nw;
    for (const [, g] of vehMap) scene.remove(g);
    vehMap.clear();
    debris.length = 0; smoke.length = 0; fire.length = 0;
    splat.clear();
    syncTerrain();
  }
  resize(); rebuildRTs();
  const project = (x, y, z) => { const v = new THREE.Vector3(x, y, z); v.project(cam); return { x: v.x, y: v.y }; };
  return { render, consume, setGfx, setZoom, setWorld, setTraj, gfx, dispose() { renderer.dispose(); }, _cam: cam, project, _splat: splat, _ice: iceMesh, camBasis: { right: camRight, up: camUp, fwd: camFwd, halfW: () => halfW, halfH: () => halfH } };
}
