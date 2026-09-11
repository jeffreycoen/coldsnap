import React, { useEffect, useRef, useState } from "react";
import { MK } from "../version.js";

// RUBBLE WORLDS — block planets under real gravity, a proving-range demo.
// The cross of both games: coldsnap's cubes and coldsnap's SOLVER under the
// ark's sky. Contact is not a force here — it is a constraint, solved the
// way the war engine solves it: sequential impulses, accumulated and clamped,
// a capped positional bias, warm-started between frames. Springs lost to
// self-gravity and detonated or collapsed; constraints hold any load, which
// is why coldsnap stacks stand and real rubble keeps its shape. Welds are
// distance constraints in the same iteration loop, breaking past a stretch
// ratio — a welded planet meets the tide as one body, a rubble pile sheds.
// Planets are true spheres of cubes in a 3D lattice, lit by their outward
// face from the clump center. The gravity-well grid re-reads every clump
// every frame. Two scenarios: BINARY (a decaying mutual orbit, met and
// merged into one bound, spinning world — measured headless: contact near
// 14.5 seconds, bound inside radius ~40 after a minute) and BLACK HOLE
// (53% of circular sits just inside the capture threshold — streaming from
// 4 seconds, roughly two thirds eaten across two minutes). SLEEP collapses
// calm clumps into aggregates that wake by proximity or tide before anything
// can touch them. Every tuning number is a design choice until watched.
// The seed is rolled fresh at mount and shown on the panel.
const DT = 1 / 60, SF = 8, G = 210, C30 = Math.cos(Math.PI / 6), S30 = 0.5;
const BS = 6;              // block edge in sim units
const BR = BS * 0.55;      // contact radius
const PMASS = 6000;        // one planet's whole mass — parity with the ark's planets
const ITERS = 8;           // solver sweeps per frame — the war engine tiers 4-12
const SLOP = 0.05;         // penetration allowance before the bias pushes
const BETA = 0.18;         // Baumgarte factor, the engine's own number
const BIAS_CAP = 5;        // bias ceiling, the engine's own number
const WELD_BREAK = 2.2;    // weld tears past this stretch ratio — measured: the welded planet passes the tide as chunks, 11 eaten against 66 weldless
const WELD_BIAS = 0.35;    // weld positional bias — stiff enough that welds carry load before breaking
const SLEEP_V = 2.2;       // a clump sleeps under this relative speed
const WAKE_TIDE = 0.35;    // aggregate wakes when tidal spread exceeds this fraction of its own hold

function makeRand(seed) { let ri = 0; return () => { const v = Math.sin(seed + (ri++) * 9973) * 43758.5453; return v - Math.floor(v); }; }

// a true sphere of cubes: every lattice cell within R of center. `pitch` is the
// block edge — big worlds use bigger blocks so the count stays payable.
function makePlanet(cx, cz, vx, vz, tint, rand, R = BS * 2.85, mass = PMASS, pitch = BS) {
  const blocks = []; const n = Math.ceil(R / pitch);
  for (let ix = -n; ix <= n; ix++) for (let iy = -n; iy <= n; iy++) for (let iz = -n; iz <= n; iz++) {
    const px = ix * pitch, py = iy * pitch, pz = iz * pitch;
    if (Math.sqrt(px * px + py * py + pz * pz) > R) continue;
    blocks.push({ x: cx + px + (rand() - 0.5), y: py + (rand() - 0.5), z: cz + pz + (rand() - 0.5), vx, vy: 0, vz, tint, alive: true, sleeping: false, clump: -1, s: pitch, cr: pitch * 0.55 });
  }
  for (const b of blocks) b.m = mass / blocks.length;
  return blocks;
}

function buildWelds(blocks) {
  const welds = [];
  for (let i = 0; i < blocks.length; i++) for (let j = i + 1; j < blocks.length; j++) {
    if (blocks[i].tint !== blocks[j].tint) continue;
    const dx = blocks[j].x - blocks[i].x, dy = blocks[j].y - blocks[i].y, dz = blocks[j].z - blocks[i].z;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d < Math.max(blocks[i].s, blocks[j].s) * 1.45) welds.push({ a: i, b: j, rest: d, alive: true, acc: 0 });
  }
  return welds;
}

const SCENES = ["binary", "duet", "moons", "trio", "system", "hole"];
const SCENE_LABEL = { binary: "TWINS", duet: "DUET", moons: "MOONS", trio: "TRIO", system: "SYSTEM", hole: "HOLE" };
// weld strength per planet size — measured calm loads 17/90/105, same 1.76x margin each
const WELD_STRENGTH_BY_SIZE = { 1: 30, 2: 160, 5: 185 };
function makeScenario(kind, seed, size = 1) {
  const rand = makeRand(seed);
  const world = { kind, size, blocks: [], welds: [], hole: null, eaten: 0, aggs: [], wells: [], warm: new Map(), t: 0 };
  // SIZE arm: every planet's radius scales by `size`, its mass by size cubed,
  // and every orbit distance by `size`. The block pitch comes from a budget —
  // more cells for roundness where the scene can pay, bigger cubes where it
  // cannot: a scene carries about 1700 blocks at most, split across planets.
  const nPlanets = kind === "trio" ? 3 : kind === "system" ? 9 : kind === "binary" || kind === "duet" ? 2 : 1;
  const pitchFor = (R) => Math.max(BS, R / Math.cbrt((1700 / nPlanets) / 4.19));
  const world_mk = (cx, cz, vx, vz, tint, R1, m1) => makePlanet(cx * size, cz * size, vx, vz, tint, rand, R1 * size, m1 * size ** 3, pitchFor(R1 * size));
  if (kind === "binary") {
    const d = 190;
    // half the circular speed for this law — measured headless with the
    // constraint solver: first contact near 14.5 seconds, and the merged
    // world stays bound inside radius ~40 a minute after the meeting
    const dS = d * size, mS = PMASS * size ** 3;
    const vOrb = Math.sqrt(G * mS * dS / Math.pow(2 * dS, 2.3)) * 0.5;
    world.blocks = [
      ...world_mk(-d, 0, 0, -vOrb, 0, BS * 2.85, PMASS),
      ...world_mk(d, 0, 0, vOrb, 1, BS * 2.85, PMASS),
    ];
    world.span = 250 * size;
  } else if (kind === "duet") {
    // a heavy and a light world on the law's own circular speeds around their
    // shared center — measured headless: separation holds 199-201 for three minutes
    const M1 = PMASS * size ** 3, M2 = 1500 * size ** 3, R = 200 * size;
    const d1 = R * M2 / (M1 + M2), d2 = R * M1 / (M1 + M2);
    const v1 = Math.sqrt(G * M2 * d1 / Math.pow(R * R + SF * SF, 1.15));
    const v2 = Math.sqrt(G * M1 * d2 / Math.pow(R * R + SF * SF, 1.15));
    world.blocks = [
      ...world_mk(-d1 / size, 0, 0, -v1, 0, BS * 2.85, PMASS),
      ...world_mk(d2 / size, 0, 0, v2, 1, BS * 1.8, 1500),
    ];
    world.span = 260 * size;
  } else if (kind === "trio") {
    // three equal worlds on a rotating equilateral triangle — the relative
    // equilibrium measured headless (radius band 161-162 for three minutes as
    // points); the blocks' own unevenness is what eventually breaks it
    const L = 280 * size, R2 = L / Math.sqrt(3), mS = PMASS * size ** 3;
    const aC = 2 * G * mS * Math.cos(Math.PI / 6) / Math.pow(L * L + SF * SF, 1.15);
    const vT = Math.sqrt(aC * R2);
    for (let i = 0; i < 3; i++) {
      const th = i * 2 * Math.PI / 3;
      world.blocks.push(...world_mk(Math.cos(th) * R2 / size, Math.sin(th) * R2 / size, -Math.sin(th) * vT, Math.cos(th) * vT, i % 2, BS * 2.85, PMASS));
    }
    world.span = 300 * size;
  } else if (kind === "system") {
    // the mission's own sky: a pinned star, nine light planets on rings, and
    // planet-to-planet gravity at 1% — the ark's law, measured headless:
    // every ring held for three minutes, worst excursion 36%
    world.star = { x: 0, z: 0, m: 40000 * size ** 3, r: 34 * size };
    world.weak = true;
    for (const r of [110, 150, 190, 235, 280, 325, 370, 415, 460]) {
      const rS = r * size, th = rand() * Math.PI * 2;
      const v = Math.sqrt(G * world.star.m * rS / Math.pow(rS * rS + SF * SF, 1.15));
      world.blocks.push(...world_mk(Math.cos(th) * r, Math.sin(th) * r, -Math.sin(th) * v, Math.cos(th) * v, world.blocks.length % 2 === 0 ? 0 : 1, BS * 1.6, 1200));
    }
    world.span = 500 * size;
  } else if (kind === "moons") {
    // three light moons on circular speed, spaced wide so their mutual tug stays
    // small — measured headless: a lone moon holds a 97-101 band for three minutes
    world.blocks = world_mk(0, 0, 0, 0, 0, BS * 2.85, PMASS);
    for (const r of [60, 105, 160]) {
      const rS = r * size, mS = PMASS * size ** 3;
      const v = Math.sqrt(G * mS * rS / Math.pow(rS * rS + SF * SF, 1.15));
      world.blocks.push(...makePlanet(rS, 0, 0, v, 1, rand, BS * 0.9, 80 * size ** 3));
    }
    world.span = 200 * size;
  } else {
    world.hole = { x: 0, z: 0, m: 42000 * size ** 3, killR: 26 * size };
    const px = 240 * size;
    // 53% of circular sits just inside the capture threshold — measured
    // headless with the constraint solver: streaming from 4 seconds,
    // 66 of 93 eaten weldless across two minutes, 51 welded
    const v = Math.sqrt(G * world.hole.m / Math.pow(px, 1.3)) * 0.53;
    world.blocks = world_mk(px / size, 0, 0, v, 0, BS * 2.85, PMASS);
    world.span = 300 * size;
  }
  world.welds = buildWelds(world.blocks);
  world.weldOf = new Map();
  for (const w of world.welds) world.weldOf.set(w.a * 100000 + w.b, w);
  world.log = [];
  return world;
}

// gravity of every source on (x,y,z), skipping index `self`. Under the
// mission law (weak=true) two different clumps pull at 1% — the ark's own
// planet-to-planet rule; the star and the hole always pull at full strength.
function accel(x, y, z, srcs, self, weak, myClump) {
  let ax = 0, ay = 0, az = 0;
  for (let i = 0; i < srcs.length; i++) {
    if (i === self) continue;
    const s = srcs[i], dx = s.x - x, dy = (s.y || 0) - y, dz = s.z - z;
    const r2 = dx * dx + dy * dy + dz * dz + SF * SF, rn = Math.pow(r2, 1.65);
    const w = weak && s.clump != null && myClump != null && s.clump !== myClump ? 0.01 : 1;
    ax += w * G * s.m * dx / rn; ay += w * G * s.m * dy / rn; az += w * G * s.m * dz / rn;
  }
  return [ax, ay, az];
}

// the ark's well depth, read from the live wells. Clump wells keep the ark's
// gentle dish; a deep well (the hole, the star) gets its own throat — a far
// higher ceiling and a steeper scale, so the horizon sits in a plunge.
function wellDepth(x, z, wells, sc) {
  let pP = 0, pD = 0;
  for (const w of wells) {
    const r2 = (w.x - x) ** 2 + (w.z - z) ** 2 + SF * SF;
    const p = G * w.m / (1.3 * Math.pow(r2, 0.65));
    if (w.deep) pD += p; else pP += p;
  }
  return Math.min(Math.sqrt(pP) * 0.38, 150) * sc + Math.min(Math.sqrt(pD) * 1.15, 560) * sc;
}

export default function RubbleWorlds({ onExit }) {
  const cvs = useRef(null);
  const worldRef = useRef(null);
  const [ui, setUi] = useState({ kind: "binary", welds: true, sleep: true, seed: 0, fps: 0, awake: 0, asleep: 0, eaten: 0, weldsAlive: 0, copied: false });
  const ctl = useRef({ kind: "binary", welds: true, sleep: true, time: 1, size: 1, reset: 1 });
  const copyLog = () => {
    const data = worldRef.current && worldRef.current();
    if (!data) return;
    const text = JSON.stringify(data);
    const done = () => { setUi(u => ({ ...u, copied: true })); setTimeout(() => setUi(u => ({ ...u, copied: false })), 2000); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done).catch(() => {});
    else { const ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); done(); }
  };

  useEffect(() => {
    const c = cvs.current, ctx = c.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const resize = () => { c.width = window.innerWidth * dpr; c.height = window.innerHeight * dpr; c.style.width = window.innerWidth + "px"; c.style.height = window.innerHeight + "px"; };
    resize(); window.addEventListener("resize", resize);
    let world = null, seed = 0, lastReset = 0, anim, frame = 0, tPrev = performance.now();
    worldRef.current = () => world && { seed, kind: ctl.current.kind, size: ctl.current.size, welds: ctl.current.welds, sleep: ctl.current.sleep, mk: MK, log: world.log };

    const loop = () => {
      const W = c.width / dpr, H = c.height / dpr, k = ctl.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (k.reset !== lastReset) {
        lastReset = k.reset; seed = Math.floor(Math.random() * 100000);
        world = makeScenario(k.kind, seed, k.size);
        setUi(u => ({ ...u, kind: k.kind, seed, eaten: 0 }));
      }
      const wb = world.blocks, welds = world.welds;
      let weldsAlive = 0;
      // time chips: 2x and 5x run the physics that many steps per rendered frame;
      // half speed steps every other frame — the render never changes cadence
      const reps = k.time >= 1 ? k.time : (frame % 2 === 0 ? 1 : 0);
      for (let rep = 0; rep < reps; rep++) {

      // --- CLUMP SCAN every 20 frames: union-find over touch distance ---
      if (frame % 20 === 0) {
        const par = wb.map((_, i) => i);
        const find = (i) => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; };
        for (let i = 0; i < wb.length; i++) { if (!wb[i].alive) continue; for (let j = i + 1; j < wb.length; j++) { if (!wb[j].alive) continue;
          const dx = wb[j].x - wb[i].x, dy = wb[j].y - wb[i].y, dz = wb[j].z - wb[i].z;
          const link = Math.max(wb[i].s, wb[j].s) * 1.35;
          if (dx * dx + dy * dy + dz * dz < link * link) { const a = find(i), b = find(j); if (a !== b) par[b] = a; } } }
        const groups = new Map();
        for (let i = 0; i < wb.length; i++) { if (!wb[i].alive) continue; const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(i); wb[i].clump = r; }
        world.groups = groups;
        // group stats first, sleep decisions second — a clump near another body may
        // NOT sleep: sleeping aggregates run no contact, and a re-slept clump on an
        // approach passed clean through the other planet (the trio detonation, 2026-09-11)
        const gInfo = [];
        for (const [root, ids] of groups) {
          let mx = 0, my = 0, mz = 0, mvx = 0, mvy = 0, mvz = 0, M = 0;
          for (const i of ids) { const b = wb[i]; M += b.m; mx += b.x * b.m; my += b.y * b.m; mz += b.z * b.m; mvx += b.vx * b.m; mvy += b.vy * b.m; mvz += b.vz * b.m; }
          mx /= M; my /= M; mz /= M; mvx /= M; mvy /= M; mvz /= M;
          let rel = 0, rad = 0;
          for (const i of ids) { const b = wb[i]; rel = Math.max(rel, Math.hypot(b.vx - mvx, b.vy - mvy, b.vz - mvz)); rad = Math.max(rad, Math.hypot(b.x - mx, b.y - my, b.z - mz)); }
          gInfo.push({ root, ids, mx, my, mz, mvx, mvy, mvz, M, rel, rad });
        }
        world.aggs = [];
        for (const g of gInfo) {
          let near = false;
          if (world.hole && Math.hypot(g.mx - world.hole.x, g.my, g.mz - world.hole.z) < g.rad + world.hole.killR + BS * 6) near = true;
          if (world.star && Math.hypot(g.mx - world.star.x, g.my, g.mz - world.star.z) < g.rad + world.star.r + BS * 6) near = true;
          for (const o of gInfo) if (o !== g && Math.hypot(g.mx - o.mx, g.my - o.my, g.mz - o.mz) < g.rad + o.rad + BS * 6) near = true;
          if (!k.sleep || g.ids.length < 10 || near || g.rel >= SLEEP_V) { for (const i of g.ids) wb[i].sleeping = false; continue; }
          const agg = { x: g.mx, y: g.my, z: g.mz, vx: g.mvx, vy: g.mvy, vz: g.mvz, m: g.M, rad: g.rad, ids: g.ids, clump: g.root, offs: g.ids.map(i => [wb[i].x - g.mx, wb[i].y - g.my, wb[i].z - g.mz]) };
          for (const i of g.ids) wb[i].sleeping = true;
          world.aggs.push(agg);
        }
      }

      // --- LIVE WELLS every frame: the grid must not lag the mass ---
      world.wells = [];
      world.tracks = [];
      world.clumpCenter = new Map();
      if (world.groups) for (const [root, ids] of world.groups) {
        let mx = 0, my = 0, mz = 0, mvx = 0, mvz = 0, M = 0, n = 0;
        for (const i of ids) { const b = wb[i]; if (!b.alive) continue; M += b.m; mx += b.x * b.m; my += b.y * b.m; mz += b.z * b.m; mvx += b.vx * b.m; mvz += b.vz * b.m; n++; }
        if (!n) continue;
        mx /= M; my /= M; mz /= M; mvx /= M; mvz /= M;
        let rad = 0;
        for (const i of ids) { const b = wb[i]; if (!b.alive) continue; rad = Math.max(rad, Math.hypot(b.x - mx, b.z - mz)); }
        world.wells.push({ x: mx, z: mz, m: M });
        world.tracks.push({ x: mx, z: mz, vx: mvx, vz: mvz, m: M, rad, clump: root });
        world.clumpCenter.set(root, [mx, my, mz]);
      }
      if (world.hole) world.wells.push({ x: world.hole.x, z: world.hole.z, m: world.hole.m, deep: true });
      if (world.star) world.wells.push({ x: world.star.x, z: world.star.z, m: world.star.m, deep: true });

      // --- SOURCES: awake blocks + aggregates + the hole ---
      const srcs = [];
      const awakeIdx = [];
      for (let i = 0; i < wb.length; i++) if (wb[i].alive && !wb[i].sleeping) { awakeIdx.push(i); srcs.push(wb[i]); }
      const aggBase = srcs.length;
      for (const a of world.aggs) srcs.push(a);
      if (world.hole) srcs.push(world.hole);
      if (world.star) srcs.push(world.star);

      // --- GRAVITY KICK on awake blocks ---
      for (let n = 0; n < awakeIdx.length; n++) {
        const b = wb[awakeIdx[n]];
        const [ax, ay, az] = accel(b.x, b.y, b.z, srcs, n, world.weak, b.clump);
        b.vx += ax * DT; b.vy += ay * DT; b.vz += az * DT;
      }
      // --- AGGREGATES integrate as single bodies; members ride as offsets ---
      for (let n = 0; n < world.aggs.length; n++) {
        const a = world.aggs[n];
        const [ax, ay, az] = accel(a.x, a.y, a.z, srcs, aggBase + n, world.weak, a.clump);
        a.vx += ax * DT; a.vy += ay * DT; a.vz += az * DT; a.x += a.vx * DT; a.y += a.vy * DT; a.z += a.vz * DT;
        for (let q = 0; q < a.ids.length; q++) { const b = wb[a.ids[q]]; b.x = a.x + a.offs[q][0]; b.y = a.y + a.offs[q][1]; b.z = a.z + a.offs[q][2]; b.vx = a.vx; b.vy = a.vy; b.vz = a.vz; }
        // proximity wake: an aggregate must be awake BEFORE anything can touch it —
        // sleeping bodies run no contact, and a point-mass flyby is the ship's move, not a planet's
        let near = false;
        if (world.hole && Math.hypot(a.x - world.hole.x, a.y, a.z - world.hole.z) < a.rad + world.hole.killR + BS * 6) near = true;
        for (const o of world.aggs) if (o !== a && !o.dead && Math.hypot(a.x - o.x, a.y - o.y, a.z - o.z) < a.rad + o.rad + BS * 4) near = true;
        let ext = 0;
        if (world.hole) { const d = Math.hypot(a.x - world.hole.x, a.y, a.z - world.hole.z); ext = Math.max(ext, G * world.hole.m * (Math.pow(Math.max(d - a.rad, SF), -2.3) - Math.pow(d + a.rad, -2.3))); }
        for (const o of world.aggs) if (o !== a) { const d = Math.hypot(a.x - o.x, a.y - o.y, a.z - o.z); ext = Math.max(ext, G * o.m * (Math.pow(Math.max(d - a.rad, SF), -2.3) - Math.pow(d + a.rad, -2.3))); }
        const hold = G * a.m / Math.pow(Math.max(a.rad, SF), 2.3);
        if (near || ext > hold * WAKE_TIDE) { for (const i of a.ids) wb[i].sleeping = false; a.dead = true; }
      }
      world.aggs = world.aggs.filter(a => !a.dead);

      // --- CONTACTS: collect, warm-start, then solve with the welds ---
      const contacts = [];
      for (let p = 0; p < awakeIdx.length; p++) {
        const i = awakeIdx[p], bi = wb[i];
        for (let j = 0; j < wb.length; j++) {
          if (j === i || !wb[j].alive) continue;
          const bj = wb[j];
          // an awake block checks EVERY alive block: awake pairs once (j > i), and
          // sleeping blocks from either side — the old j > i walk left half the
          // sleeping blocks untouchable (the trio detonation, 2026-09-11)
          if (!bj.sleeping && j < i) continue;
          const dx = bj.x - bi.x, dy = bj.y - bi.y, dz = bj.z - bi.z, d2 = dx * dx + dy * dy + dz * dz;
          const cd = bi.cr + bj.cr;
          if (d2 > cd * cd || d2 === 0) continue;
          const key = Math.min(i, j) * 100000 + Math.max(i, j);
          // a welded pair is the weld's alone — contact fighting a weld over the
          // same pair pumps energy and detonates the body (measured, 2026-09-11)
          if (k.welds) { const wq = world.weldOf.get(key); if (wq && wq.alive) continue; }
          if (bj.sleeping) { const cl = bj.clump; for (const b2 of wb) if (b2.clump === cl) b2.sleeping = false; world.aggs = world.aggs.filter(a => !a.ids.includes(j)); }
          const d = Math.sqrt(d2);
          const cnt = { i, j, nx: dx / d, ny: dy / d, nz: dz / d, depth: cd - d, pn: world.warm.get(key) || 0, key };
          cnt.bias = Math.min(BETA / DT * Math.max(0, cnt.depth - SLOP), BIAS_CAP);
          if (cnt.pn) { bi.vx -= cnt.nx * cnt.pn; bi.vy -= cnt.ny * cnt.pn; bi.vz -= cnt.nz * cnt.pn; bj.vx += cnt.nx * cnt.pn; bj.vy += cnt.ny * cnt.pn; bj.vz += cnt.nz * cnt.pn; }
          contacts.push(cnt);
        }
      }
      weldsAlive = 0;
      for (let it = 0; it < ITERS; it++) {
        if (k.welds) for (const w of welds) {
          if (!w.alive) continue;
          const a = wb[w.a], b = wb[w.b];
          if (!a.alive || !b.alive) { w.alive = false; continue; }
          if (a.sleeping && b.sleeping) continue;
          const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, d = Math.hypot(dx, dy, dz) || 1;
          if (d > w.rest * WELD_BREAK) { w.alive = false; continue; }
          const nx = dx / d, ny = dy / d, nz = dz / d;
          const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny + (b.vz - a.vz) * nz;
          const bias = Math.max(-6, Math.min(6, (WELD_BIAS / DT) * (d - w.rest)));
          const P = -(vn + bias) * 0.5;
          w.acc += Math.abs(P);
          a.vx -= nx * P; a.vy -= ny * P; a.vz -= nz * P; b.vx += nx * P; b.vy += ny * P; b.vz += nz * P;
        }
        for (const cnt of contacts) {
          const bi = wb[cnt.i], bj = wb[cnt.j];
          const vn = (bj.vx - bi.vx) * cnt.nx + (bj.vy - bi.vy) * cnt.ny + (bj.vz - bi.vz) * cnt.nz;
          let dPn = -(vn - cnt.bias) * 0.5;
          const pn0 = cnt.pn; cnt.pn = Math.max(0, cnt.pn + dPn); dPn = cnt.pn - pn0;
          bi.vx -= cnt.nx * dPn; bi.vy -= cnt.ny * dPn; bi.vz -= cnt.nz * dPn; bj.vx += cnt.nx * dPn; bj.vy += cnt.ny * dPn; bj.vz += cnt.nz * dPn;
        }
      }
      // force break, the war engine's rule: a weld that carried more than its
      // strength this frame tears — stretch alone never fires, because the
      // constraint is what prevents stretch (the unbreakable-weld flyby, 2026-09-11)
      if (k.welds) for (const w of welds) {
        if (!w.alive) continue;
        if (w.acc > (WELD_STRENGTH_BY_SIZE[world.size] || 30)) w.alive = false; else weldsAlive++;
        w.acc = 0;
      }
      world.warm.clear();
      for (const cnt of contacts) world.warm.set(cnt.key, cnt.pn);

      // --- DRIFT awake blocks ---
      for (const i of awakeIdx) { const b = wb[i]; b.x += b.vx * DT; b.y += b.vy * DT; b.z += b.vz * DT; }

      // --- THE HOLE EATS at the event horizon ---
      if (world.hole) for (const b of wb) {
        if (!b.alive) continue;
        if (Math.hypot(b.x - world.hole.x, b.y, b.z - world.hole.z) < world.hole.killR) { b.alive = false; world.hole.m += b.m; world.eaten++; }
      }
      world.t += DT; frame++;
      }

      // --- DRAW ---
      ctx.fillStyle = "#f5f4f0"; ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 60; i++) { const sx3 = ((i * 7919 + 37) * 3.7) % W, sy3 = ((i * 4967 + 13) * 2.3) % H; ctx.fillStyle = `rgba(0,0,20,${i % 5 === 0 ? 0.06 : 0.03})`; ctx.fillRect(sx3, sy3, i % 7 === 0 ? 1.5 : 1, i % 7 === 0 ? 1.5 : 1); }
      // the camera is FIXED per scene: centered on the origin (the hole, the pair's
      // center, the planet) at a scale set by the scene's span — debris may leave
      // the frame; the world never swims and the hole never appears to move
      const span = world.span || 260;
      const sc = Math.min(W * 0.82 / (span * 2 * C30), H * 0.62 / (span * 2 * S30), 2.2);
      const cx = W / 2, cy = H / 2;
      const iso = (x, z, y) => ({ x: cx + (x - z) * C30 * sc, y: cy + (x + z) * S30 * sc - (y || 0) * 0.9 * sc });
      const lookX = 0, lookZ = 0;
      const gN = 56, gSp = 16, halfG = gN * gSp / 2;
      const gcx = Math.round(lookX / gSp) * gSp, gcz = Math.round(lookZ / gSp) * gSp;
      const getD = (sx2, sz2) => wellDepth(sx2, sz2, world.wells, sc);
      const gxa = new Float32Array((gN + 1) ** 2), gya = new Float32Array((gN + 1) ** 2);
      for (let ix = 0; ix <= gN; ix++) for (let iz = 0; iz <= gN; iz++) { const sx2 = ix * gSp - halfG + gcx, sz2 = iz * gSp - halfG + gcz, d = getD(sx2, sz2), idx = ix * (gN + 1) + iz; gxa[idx] = cx + (sx2 - sz2) * C30 * sc; gya[idx] = cy + (sx2 + sz2) * S30 * sc + d; }
      ctx.lineWidth = 0.7;
      for (let ix = 0; ix <= gN; ix++) { const sx2 = ix * gSp - halfG + gcx, fade = Math.max(0, 1 - (Math.abs(sx2 - gcx) / (halfG * 0.7)) ** 3);
        let w = 0; for (const wl of world.wells) { const pd = Math.abs(sx2 - wl.x); w = Math.max(w, Math.max(0, 1 - pd / 110) * 0.3); }
        const a = fade * 0.18 + w * 0.5; if (a < 0.005) continue;
        ctx.beginPath(); const b = ix * (gN + 1); ctx.moveTo(gxa[b], gya[b]); for (let iz = 1; iz <= gN; iz++) ctx.lineTo(gxa[b + iz], gya[b + iz]);
        ctx.strokeStyle = `rgba(45,55,75,${a})`; ctx.stroke(); }
      for (let iz = 0; iz <= gN; iz++) { const sz2 = iz * gSp - halfG + gcz, fade = Math.max(0, 1 - (Math.abs(sz2 - gcz) / (halfG * 0.7)) ** 3);
        let w = 0; for (const wl of world.wells) { const pd = Math.abs(sz2 - wl.z); w = Math.max(w, Math.max(0, 1 - pd / 110) * 0.3); }
        const a = fade * 0.18 + w * 0.5; if (a < 0.005) continue;
        ctx.beginPath(); ctx.moveTo(gxa[iz], gya[iz]); for (let ix = 1; ix <= gN; ix++) ctx.lineTo(gxa[ix * (gN + 1) + iz], gya[ix * (gN + 1) + iz]);
        ctx.strokeStyle = `rgba(45,55,75,${a})`; ctx.stroke(); }
      // --- PROJECTED ORBITS: each clump's future as a line, green while clear,
      // turning red through the last two seconds before a predicted contact and
      // ending at the impact — past first contact the future is unknowable.
      // A 20-second look: minutes would be honest for the stable orbits, but
      // chaos (the trio, anything post-collision) owns everything longer.
      if (frame % 3 === 0 || !world.pred) {
        const bodies = (world.tracks || []).filter(tk => tk.m >= 500).slice(0, 14)
          .map(tk => ({ x: tk.x, z: tk.z, vx: tk.vx, vz: tk.vz, m: tk.m, rad: tk.rad, clump: tk.clump, pts: [], hit: -1 }));
        const statics = [];
        if (world.hole) statics.push({ x: world.hole.x, z: world.hole.z, m: world.hole.m, rad: world.hole.killR });
        if (world.star) statics.push({ x: world.star.x, z: world.star.z, m: world.star.m, rad: world.star.r });
        const dtP = 1 / 15, NPRED = 300;
        for (let sIdx = 0; sIdx < NPRED; sIdx++) {
          for (const b of bodies) {
            if (b.hit >= 0) continue;
            let ax = 0, az = 0;
            for (const o of bodies) { if (o === b || o.hit >= 0) continue;
              const w = world.weak && o.clump !== b.clump ? 0.01 : 1;
              const dx = o.x - b.x, dz = o.z - b.z, r2 = dx * dx + dz * dz + SF * SF, rn = Math.pow(r2, 1.65);
              ax += w * G * o.m * dx / rn; az += w * G * o.m * dz / rn; }
            for (const o of statics) { const dx = o.x - b.x, dz = o.z - b.z, r2 = dx * dx + dz * dz + SF * SF, rn = Math.pow(r2, 1.65);
              ax += G * o.m * dx / rn; az += G * o.m * dz / rn; }
            b.vx += ax * dtP; b.vz += az * dtP;
          }
          for (const b of bodies) { if (b.hit >= 0) continue; b.x += b.vx * dtP; b.z += b.vz * dtP; b.pts.push([b.x, b.z]); }
          for (let a2 = 0; a2 < bodies.length; a2++) for (let b2 = a2 + 1; b2 < bodies.length; b2++) {
            const A = bodies[a2], B2 = bodies[b2]; if (A.hit >= 0 || B2.hit >= 0) continue;
            if (Math.hypot(A.x - B2.x, A.z - B2.z) < A.rad + B2.rad) { A.hit = A.pts.length; B2.hit = B2.pts.length; } }
          for (const b of bodies) { if (b.hit >= 0) continue;
            for (const o of statics) if (Math.hypot(b.x - o.x, b.z - o.z) < b.rad + o.rad) b.hit = b.pts.length; }
        }
        world.pred = bodies;
      }
      for (const b of world.pred || []) {
        const pts = b.pts; if (pts.length < 4) continue;
        const redFrom = b.hit >= 0 ? Math.max(0, b.hit - 30) : pts.length + 1;
        ctx.lineWidth = 2.2;
        for (let i2 = 3; i2 < pts.length; i2 += 3) {
          const p0 = iso(pts[i2 - 3][0], pts[i2 - 3][1], 0), p1 = iso(pts[i2][0], pts[i2][1], 0);
          const fade = Math.max(0.25, 1 - i2 / pts.length);
          ctx.strokeStyle = i2 >= redFrom ? `rgba(220,55,35,${fade * 0.95})` : `rgba(40,170,90,${fade * 0.85})`;
          ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
        }
      }
      if (world.star) {
        const sp = iso(world.star.x, world.star.z, 0), sR = Math.max(world.star.r * sc, 8);
        ctx.save();
        const cg = ctx.createRadialGradient(sp.x, sp.y, sR * 0.5, sp.x, sp.y, sR * 3);
        cg.addColorStop(0, "rgba(255,220,100,.25)"); cg.addColorStop(0.3, "rgba(255,180,60,.08)"); cg.addColorStop(1, "rgba(255,140,30,0)");
        ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(sp.x, sp.y, sR * 3, 0, Math.PI * 2); ctx.fill();
        ctx.shadowColor = "rgba(255,200,80,.8)"; ctx.shadowBlur = 30;
        const sg = ctx.createRadialGradient(sp.x - sR * 0.2, sp.y - sR * 0.2, sR * 0.1, sp.x, sp.y, sR);
        sg.addColorStop(0, "rgba(255,255,230,1)"); sg.addColorStop(0.4, "rgba(255,220,120,1)"); sg.addColorStop(1, "rgba(255,160,40,1)");
        ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sp.x, sp.y, sR, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      if (world.hole) {
        const hp = iso(world.hole.x, world.hole.z, 0), hr = Math.max(world.hole.killR * sc, 6);
        const g2 = ctx.createRadialGradient(hp.x, hp.y, hr * 0.6, hp.x, hp.y, hr * 2.6);
        g2.addColorStop(0, "rgba(24,18,34,.9)"); g2.addColorStop(0.42, "rgba(90,60,130,.22)"); g2.addColorStop(1, "rgba(90,60,130,0)");
        ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(hp.x, hp.y, hr * 2.6, 0, Math.PI * 2); ctx.fill();
        ctx.save(); ctx.shadowColor = "rgba(255,180,80,.7)"; ctx.shadowBlur = 14;
        ctx.beginPath(); ctx.arc(hp.x, hp.y, hr * 1.04, 0, Math.PI * 2); ctx.strokeStyle = "rgba(255,190,110,.55)"; ctx.lineWidth = 1.6; ctx.stroke(); ctx.restore();
        ctx.fillStyle = "#0c0a14"; ctx.beginPath(); ctx.arc(hp.x, hp.y, hr, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(hp.x, hp.y, hr * 1.5, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(120,80,180,.3)"; ctx.lineWidth = 1; ctx.setLineDash([4, 5]); ctx.stroke(); ctx.setLineDash([]);
      }
      // blocks as coldsnap cubes lit by their outward face — the sun sits up-left
      const tints = [[126, 148, 196], [188, 134, 92]];
      const LX = -0.55, LY = 0.72, LZ = -0.42; // unit-ish light direction, toward the sun
      const order = [];
      for (const b of wb) if (b.alive) order.push(b);
      order.sort((a, b) => (a.x + a.z) - (b.x + b.z) || a.y - b.y);
      // cubes at FULL lattice pitch — faces touch, the ball reads solid; each
      // block carries its own pitch, so big worlds draw big cubes
      const shade = (rgb, f) => `rgb(${Math.round(rgb[0] * f)},${Math.round(rgb[1] * f)},${Math.round(rgb[2] * f)})`;
      for (const b of order) {
        const hw = Math.max(b.s * sc * C30, 1.6), hh = Math.max(b.s * sc * S30, 0.9), vh = Math.max(b.s * sc * 0.9, 1.6);
        const cc = world.clumpCenter && world.clumpCenter.get(b.clump);
        let lam = 0.55;
        if (cc) { const ox = b.x - cc[0], oy = b.y - cc[1], oz = b.z - cc[2], ol = Math.hypot(ox, oy, oz) || 1;
          lam = 0.45 + 0.55 * Math.max(0, (ox / ol) * LX + (oy / ol) * LY + (oz / ol) * LZ); }
        if (b.sleeping) lam *= 0.82;
        const p = iso(b.x, b.z, b.y), rgb = tints[b.tint];
        ctx.fillStyle = shade(rgb, lam * 0.72);
        ctx.beginPath(); ctx.moveTo(p.x - hw, p.y - hh); ctx.lineTo(p.x, p.y); ctx.lineTo(p.x, p.y + vh); ctx.lineTo(p.x - hw, p.y + vh - hh); ctx.closePath(); ctx.fill();
        ctx.fillStyle = shade(rgb, lam * 0.5);
        ctx.beginPath(); ctx.moveTo(p.x + hw, p.y - hh); ctx.lineTo(p.x, p.y); ctx.lineTo(p.x, p.y + vh); ctx.lineTo(p.x + hw, p.y + vh - hh); ctx.closePath(); ctx.fill();
        ctx.fillStyle = shade(rgb, Math.min(lam * 1.25, 1.05));
        ctx.beginPath(); ctx.moveTo(p.x, p.y - hh * 2); ctx.lineTo(p.x + hw, p.y - hh); ctx.lineTo(p.x, p.y); ctx.lineTo(p.x - hw, p.y - hh); ctx.closePath(); ctx.fill();
      }
      if (frame % 60 === 0) {
        let awakeN = 0, asleepN = 0, weldsN = 0;
        for (const b of wb) { if (!b.alive) continue; if (b.sleeping) asleepN++; else awakeN++; }
        for (const w of welds) if (w.alive) weldsN++;
        world.log.push({ t: +world.t.toFixed(1), awake: awakeN, asleep: asleepN, welds: weldsN, eaten: world.eaten,
          clumps: world.wells.filter(w => !w.deep).map(w => [Math.round(w.x), Math.round(w.z), Math.round(w.m)]) });
        if (world.log.length > 300) world.log.shift();
      }
      const tNow = performance.now(); const fps = Math.round(1000 / Math.max(tNow - tPrev, 1)); tPrev = tNow;
      if (frame % 15 === 0) {
        let awake = 0, asleep = 0;
        for (const b of wb) { if (!b.alive) continue; if (b.sleeping) asleep++; else awake++; }
        setUi(u => ({ ...u, fps, awake, asleep, eaten: world.eaten, weldsAlive }));
      }
      anim = requestAnimationFrame(loop);
    };
    anim = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(anim); window.removeEventListener("resize", resize); };
  }, []);

  const chip = (label, on, click) => (
    <div key={label} onClick={click} style={{ padding: "10px 14px", borderRadius: 12, background: on ? "rgba(60,90,160,.16)" : "rgba(245,244,240,.85)", border: `1.5px solid ${on ? "rgba(60,90,160,.4)" : "rgba(0,0,0,.08)"}`, cursor: "pointer", userSelect: "none", WebkitUserSelect: "none", touchAction: "none", fontSize: 11, fontWeight: 700, letterSpacing: 1.2, color: on ? "rgba(40,60,120,.85)" : "rgba(0,0,0,.45)" }}>{label}</div>
  );
  const set = (fn) => { fn(ctl.current); ctl.current.reset++; setUi(u => ({ ...u })); };
  const setLive = (fn) => { fn(ctl.current); setUi(u => ({ ...u })); };

  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden", background: "#f5f4f0", fontFamily: "-apple-system,'SF Pro Display',sans-serif", userSelect: "none", WebkitUserSelect: "none" }}>
      <canvas ref={cvs} style={{ display: "block", touchAction: "none" }} />
      <div style={{ position: "absolute", top: 14, left: 14, background: "rgba(245,244,240,.85)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderRadius: 14, padding: "10px 16px", border: "1px solid rgba(0,0,0,.06)" }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.8, color: "rgba(0,0,0,.5)" }}>RUBBLE WORLDS</div>
        <div style={{ fontSize: 11, fontWeight: 500, color: "rgba(0,0,0,.45)", marginTop: 4 }}>seed {ui.seed} · {ui.fps}fps</div>
        <div style={{ fontSize: 11, fontWeight: 500, color: "rgba(0,0,0,.45)", marginTop: 2 }}>{ui.awake} awake · {ui.asleep} asleep · welds {ui.weldsAlive}{ui.kind === "hole" ? ` · eaten ${ui.eaten}` : ""}</div>
      </div>
      {onExit && <div onClick={onExit} style={{ position: "absolute", top: 14, right: 14, background: "rgba(245,244,240,.85)", borderRadius: 10, padding: "8px 12px", border: "1px solid rgba(0,0,0,.06)", cursor: "pointer", userSelect: "none", touchAction: "none", fontSize: 10, fontWeight: 600, letterSpacing: 1, color: "rgba(0,0,0,.45)" }}>⏏ MENU</div>}
      <div style={{ position: "absolute", bottom: 20, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "0 12px" }}>
        <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
          {SCENES.map(sn => chip(SCENE_LABEL[sn], ui.kind === sn, () => set(k => { k.kind = sn; })))}
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
          {[1, 2, 5].map(sz => chip("SIZE " + sz + "x", ctl.current.size === sz, () => set(k => { k.size = sz; })))}
          {[0.5, 1, 2, 5].map(tm => chip(tm === 0.5 ? "×½" : "×" + tm, ctl.current.time === tm, () => setLive(k => { k.time = tm; })))}
          {chip(`WELDS ${ctl.current.welds ? "ON" : "OFF"}`, ctl.current.welds, () => setLive(k => { k.welds = !k.welds; }))}
          {chip(`SLEEP ${ctl.current.sleep ? "ON" : "OFF"}`, ctl.current.sleep, () => setLive(k => { k.sleep = !k.sleep; }))}
          {chip(ui.copied ? "COPIED" : "⊕ LOG", ui.copied, copyLog)}
          {chip("RESET", false, () => set(() => {}))}
        </div>
      </div>
    </div>
  );
}
