import React, { useEffect, useRef, useState } from "react";

// RUBBLE WORLDS — block planets under real gravity, a proving-range demo.
// The cross of both games: coldsnap's cubes, the ark's sky. Planets are true
// spheres built from cube blocks in a 3D lattice, physics runs in all three
// axes under the ark's 1/r^2.3 softened law, and the ark's gravity-well grid
// bends under every clump. Two scenarios: BINARY (two block spheres in a
// decaying mutual orbit that meet and merge) and BLACK HOLE (a sphere
// streaming past an event horizon in pieces, the hole growing as it eats).
// Soft repulsion keeps blocks apart and bleeds orbital energy in pileups.
// WELDS and SLEEP are live test arms: welds are neighbor springs that tear
// past a stretch limit; sleep collapses calm clumps into aggregate bodies
// woken by tide or touch. Every tuning number is a design choice until
// watched. The seed is rolled fresh at mount and shown on the panel.
const DT = 1 / 60, SF = 8, G = 210, C30 = Math.cos(Math.PI / 6), S30 = 0.5;
const BS = 6;              // block edge in sim units
const BR = BS * 0.55;      // contact radius
const PMASS = 6000;        // one planet's whole mass — parity with the ark's planets
const KSOFT = 150;         // soft-repulsion stiffness — 900 was unstable at the 1/60 step and detonated every contact; 150 measured bound
const CDAMP = 10;          // contact normal damping — the energy bleed
const WELD_K = 260;        // weld spring stiffness
const WELD_BREAK = 1.9;    // weld tears past this stretch ratio
const SLEEP_V = 2.2;       // a clump sleeps under this relative speed
const WAKE_TIDE = 0.35;    // aggregate wakes when tidal spread exceeds this fraction of its own hold

function makeRand(seed) { let ri = 0; return () => { const v = Math.sin(seed + (ri++) * 9973) * 43758.5453; return v - Math.floor(v); }; }

// a true sphere of cubes: every lattice cell within 2.85 blocks of center — 93 blocks
function makePlanet(cx, cz, vx, vz, tint, rand) {
  const blocks = []; const R = BS * 2.85;
  for (let ix = -3; ix <= 3; ix++) for (let iy = -3; iy <= 3; iy++) for (let iz = -3; iz <= 3; iz++) {
    const px = ix * BS, py = iy * BS, pz = iz * BS;
    if (Math.sqrt(px * px + py * py + pz * pz) > R) continue;
    blocks.push({ x: cx + px + (rand() - 0.5), y: py + (rand() - 0.5), z: cz + pz + (rand() - 0.5), vx, vy: 0, vz, tint, alive: true, sleeping: false, clump: -1 });
  }
  for (const b of blocks) b.m = PMASS / blocks.length;
  return blocks;
}

function buildWelds(blocks) {
  const welds = [];
  for (let i = 0; i < blocks.length; i++) for (let j = i + 1; j < blocks.length; j++) {
    if (blocks[i].tint !== blocks[j].tint) continue;
    const dx = blocks[j].x - blocks[i].x, dy = blocks[j].y - blocks[i].y, dz = blocks[j].z - blocks[i].z;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d < BS * 1.45) welds.push({ a: i, b: j, rest: d, alive: true });
  }
  return welds;
}

function makeScenario(kind, seed) {
  const rand = makeRand(seed);
  const world = { kind, blocks: [], welds: [], hole: null, eaten: 0, aggs: [], wells: [], t: 0 };
  if (kind === "binary") {
    const d = 190;
    // half the circular speed for this law — measured headless in 3D with the
    // stable contact: first contact near 14.5 seconds, merged by 19, and the
    // pile stays bound — every block inside radius 200 a minute after the meeting
    const vOrb = Math.sqrt(G * PMASS * d / Math.pow(2 * d, 2.3)) * 0.5;
    world.blocks = [
      ...makePlanet(-d, 0, 0, -vOrb, 0, rand),
      ...makePlanet(d, 0, 0, vOrb, 1, rand),
    ];
  } else {
    world.hole = { x: 0, z: 0, m: 42000, killR: 26 };
    const px = 240;
    // 53% of circular sits just inside the capture threshold — measured headless
    // in 3D with the stable contact: streaming from 4 seconds, 86 of 93 eaten
    // across two minutes, a thin tail of survivors
    const v = Math.sqrt(G * world.hole.m / Math.pow(px, 1.3)) * 0.53;
    world.blocks = makePlanet(px, 0, 0, v, 0, rand);
  }
  world.welds = buildWelds(world.blocks);
  return world;
}

// gravity of every source on (x,y,z), skipping index `self` in the flat source list
function accel(x, y, z, srcs, self) {
  let ax = 0, ay = 0, az = 0;
  for (let i = 0; i < srcs.length; i++) {
    if (i === self) continue;
    const s = srcs[i], dx = s.x - x, dy = (s.y || 0) - y, dz = s.z - z;
    const r2 = dx * dx + dy * dy + dz * dz + SF * SF, rn = Math.pow(r2, 1.65);
    ax += G * s.m * dx / rn; ay += G * s.m * dy / rn; az += G * s.m * dz / rn;
  }
  return [ax, ay, az];
}

// the ark's well depth, read from the coarse wells (clump centers + the hole)
function wellPot(x, z, wells) {
  let p = 0;
  for (const w of wells) { const r2 = (w.x - x) ** 2 + (w.z - z) ** 2 + SF * SF; p -= G * w.m / (1.3 * Math.pow(r2, 0.65)); }
  return p;
}

export default function RubbleWorlds({ onExit }) {
  const cvs = useRef(null);
  const [ui, setUi] = useState({ kind: "binary", welds: true, sleep: true, seed: 0, fps: 0, awake: 0, asleep: 0, eaten: 0, weldsAlive: 0 });
  const ctl = useRef({ kind: "binary", welds: true, sleep: true, reset: 1 });

  useEffect(() => {
    const c = cvs.current, ctx = c.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const resize = () => { c.width = window.innerWidth * dpr; c.height = window.innerHeight * dpr; c.style.width = window.innerWidth + "px"; c.style.height = window.innerHeight + "px"; };
    resize(); window.addEventListener("resize", resize);
    let world = null, seed = 0, lastReset = 0, anim, frame = 0, tPrev = performance.now();

    const loop = () => {
      const W = c.width / dpr, H = c.height / dpr, k = ctl.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (k.reset !== lastReset) {
        lastReset = k.reset; seed = Math.floor(Math.random() * 100000);
        world = makeScenario(k.kind, seed);
        setUi(u => ({ ...u, kind: k.kind, seed, eaten: 0 }));
      }
      const wb = world.blocks, welds = world.welds;

      // --- CLUMP SCAN every 20 frames: union-find over touch distance ---
      if (frame % 20 === 0) {
        const par = wb.map((_, i) => i);
        const find = (i) => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; };
        for (let i = 0; i < wb.length; i++) { if (!wb[i].alive) continue; for (let j = i + 1; j < wb.length; j++) { if (!wb[j].alive) continue;
          const dx = wb[j].x - wb[i].x, dy = wb[j].y - wb[i].y, dz = wb[j].z - wb[i].z;
          if (dx * dx + dy * dy + dz * dz < (BS * 1.35) ** 2) { const a = find(i), b = find(j); if (a !== b) par[b] = a; } } }
        const groups = new Map();
        for (let i = 0; i < wb.length; i++) { if (!wb[i].alive) continue; const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(i); wb[i].clump = r; }
        // the grid's wells: every clump's center and mass, plus the hole below
        world.wells = [];
        world.aggs = [];
        for (const [root, ids] of groups) {
          let mx = 0, mz = 0, my = 0, mvx = 0, mvy = 0, mvz = 0, M = 0;
          for (const i of ids) { const b = wb[i]; M += b.m; mx += b.x * b.m; my += b.y * b.m; mz += b.z * b.m; mvx += b.vx * b.m; mvy += b.vy * b.m; mvz += b.vz * b.m; }
          mx /= M; my /= M; mz /= M; mvx /= M; mvy /= M; mvz /= M;
          world.wells.push({ x: mx, z: mz, m: M });
          // sleep pass: a big, calm clump becomes an aggregate
          if (!k.sleep || ids.length < 10) { for (const i of ids) wb[i].sleeping = false; continue; }
          let rel = 0, rad = 0;
          for (const i of ids) { const b = wb[i]; rel = Math.max(rel, Math.hypot(b.vx - mvx, b.vy - mvy, b.vz - mvz)); rad = Math.max(rad, Math.hypot(b.x - mx, b.y - my, b.z - mz)); }
          if (rel < SLEEP_V) {
            const agg = { x: mx, y: my, z: mz, vx: mvx, vy: mvy, vz: mvz, m: M, rad, ids, offs: ids.map(i => [wb[i].x - mx, wb[i].y - my, wb[i].z - mz]) };
            for (const i of ids) wb[i].sleeping = true;
            world.aggs.push(agg);
          } else for (const i of ids) wb[i].sleeping = false;
        }
        if (world.hole) world.wells.push({ x: world.hole.x, z: world.hole.z, m: world.hole.m });
      }

      // --- SOURCES: awake blocks + aggregates + the hole ---
      const srcs = [];
      const awakeIdx = [];
      for (let i = 0; i < wb.length; i++) if (wb[i].alive && !wb[i].sleeping) { awakeIdx.push(i); srcs.push(wb[i]); }
      const aggBase = srcs.length;
      for (const a of world.aggs) srcs.push(a);
      if (world.hole) srcs.push(world.hole);

      // --- INTEGRATE awake blocks (kick-drift) ---
      for (let n = 0; n < awakeIdx.length; n++) {
        const b = wb[awakeIdx[n]];
        const [ax, ay, az] = accel(b.x, b.y, b.z, srcs, n);
        b.vx += ax * DT; b.vy += ay * DT; b.vz += az * DT; b.x += b.vx * DT; b.y += b.vy * DT; b.z += b.vz * DT;
      }
      // --- INTEGRATE aggregates as single bodies; members ride as offsets ---
      for (let n = 0; n < world.aggs.length; n++) {
        const a = world.aggs[n];
        const [ax, ay, az] = accel(a.x, a.y, a.z, srcs, aggBase + n);
        a.vx += ax * DT; a.vy += ay * DT; a.vz += az * DT; a.x += a.vx * DT; a.y += a.vy * DT; a.z += a.vz * DT;
        for (let q = 0; q < a.ids.length; q++) { const b = wb[a.ids[q]]; b.x = a.x + a.offs[q][0]; b.y = a.y + a.offs[q][1]; b.z = a.z + a.offs[q][2]; b.vx = a.vx; b.vy = a.vy; b.vz = a.vz; }
        // wake by tide: gravity spread across the clump against its own hold
        let ext = 0;
        if (world.hole) { const d = Math.hypot(a.x - world.hole.x, a.y, a.z - world.hole.z); ext = Math.max(ext, G * world.hole.m * (Math.pow(Math.max(d - a.rad, SF), -2.3) - Math.pow(d + a.rad, -2.3))); }
        for (const o of world.aggs) if (o !== a) { const d = Math.hypot(a.x - o.x, a.y - o.y, a.z - o.z); ext = Math.max(ext, G * o.m * (Math.pow(Math.max(d - a.rad, SF), -2.3) - Math.pow(d + a.rad, -2.3))); }
        const hold = G * a.m / Math.pow(Math.max(a.rad, SF), 2.3);
        // proximity wake: an aggregate must be awake BEFORE anything can touch it —
        // sleeping bodies run no contact, and a point-mass flyby is the ship's move, not a planet's
        let near = false;
        if (world.hole && Math.hypot(a.x - world.hole.x, a.y, a.z - world.hole.z) < a.rad + world.hole.killR + BS * 6) near = true;
        for (const o of world.aggs) if (o !== a && !o.dead && Math.hypot(a.x - o.x, a.y - o.y, a.z - o.z) < a.rad + o.rad + BS * 4) near = true;
        if (near || ext > hold * WAKE_TIDE) { for (const i of a.ids) wb[i].sleeping = false; a.dead = true; }
      }
      world.aggs = world.aggs.filter(a => !a.dead);

      // --- CONTACT: soft repulsion with normal damping; sleeping blocks wake on touch ---
      for (let p = 0; p < awakeIdx.length; p++) {
        const i = awakeIdx[p], bi = wb[i];
        for (let j = 0; j < wb.length; j++) {
          if (j <= i || !wb[j].alive) continue;
          const bj = wb[j];
          const dx = bj.x - bi.x, dy = bj.y - bi.y, dz = bj.z - bi.z, d2 = dx * dx + dy * dy + dz * dz, cd = BR * 2;
          if (d2 > cd * cd || d2 === 0) continue;
          if (bj.sleeping) { const cl = bj.clump; for (const b2 of wb) if (b2.clump === cl) b2.sleeping = false; world.aggs = world.aggs.filter(a => !a.ids.includes(j)); }
          const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, nz = dz / d, ov = cd - d;
          const rv = (bj.vx - bi.vx) * nx + (bj.vy - bi.vy) * ny + (bj.vz - bi.vz) * nz;
          const f = (KSOFT * ov - CDAMP * rv * Math.min(ov, BR)) * DT * 0.5;
          bi.vx -= nx * f; bi.vy -= ny * f; bi.vz -= nz * f; bj.vx += nx * f; bj.vy += ny * f; bj.vz += nz * f;
        }
      }

      // --- WELDS: springs that tear ---
      let weldsAlive = 0;
      if (k.welds) for (const w of welds) {
        if (!w.alive) continue;
        const a = wb[w.a], b = wb[w.b];
        if (!a.alive || !b.alive) { w.alive = false; continue; }
        if (a.sleeping && b.sleeping) { weldsAlive++; continue; }
        const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
        if (d > w.rest * WELD_BREAK) { w.alive = false; continue; }
        weldsAlive++;
        const f = WELD_K * (d - w.rest) / d * DT;
        a.vx += dx * f; a.vy += dy * f; a.vz += dz * f; b.vx -= dx * f; b.vy -= dy * f; b.vz -= dz * f;
      }

      // --- THE HOLE EATS at the event horizon ---
      if (world.hole) for (const b of wb) {
        if (!b.alive) continue;
        if (Math.hypot(b.x - world.hole.x, b.y, b.z - world.hole.z) < world.hole.killR) { b.alive = false; world.hole.m += b.m; world.eaten++; }
      }
      world.t += DT; frame++;

      // --- DRAW ---
      ctx.fillStyle = "#f5f4f0"; ctx.fillRect(0, 0, W, H);
      // faint starfield, the ark's sky
      for (let i = 0; i < 60; i++) { const sx3 = ((i * 7919 + 37) * 3.7) % W, sy3 = ((i * 4967 + 13) * 2.3) % H; ctx.fillStyle = `rgba(0,0,20,${i % 5 === 0 ? 0.06 : 0.03})`; ctx.fillRect(sx3, sy3, i % 7 === 0 ? 1.5 : 1, i % 7 === 0 ? 1.5 : 1); }
      let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
      const pts = [...wb.filter(b => b.alive), ...(world.hole ? [world.hole] : [])];
      for (const p of pts) { const sx = (p.x - p.z) * C30, sy = (p.x + p.z) * S30; minX = Math.min(minX, sx); maxX = Math.max(maxX, sx); minY = Math.min(minY, sy); maxY = Math.max(maxY, sy); }
      const sc = Math.min(W * 0.82 / Math.max(maxX - minX + 80, 120), H * 0.62 / Math.max(maxY - minY + 80, 120), 2.2);
      const cx = W / 2 - (minX + maxX) / 2 * sc, cy = H / 2 - (minY + maxY) / 2 * sc;
      const iso = (x, z, y) => ({ x: cx + (x - z) * C30 * sc, y: cy + (x + z) * S30 * sc - (y || 0) * 0.9 * sc });
      // the ark's gravity grid, bent by the wells, following the scene center
      const lookX = ((minX + maxX) / 2) / (2 * C30) + ((minY + maxY) / 2) / (2 * S30);
      const lookZ = ((minY + maxY) / 2) / (2 * S30) - ((minX + maxX) / 2) / (2 * C30);
      const gN = 56, gSp = 16, halfG = gN * gSp / 2;
      const gcx = Math.round(lookX / gSp) * gSp, gcz = Math.round(lookZ / gSp) * gSp;
      const getD = (sx2, sz2) => Math.min(Math.sqrt(Math.abs(wellPot(sx2, sz2, world.wells))) * 0.38 * sc, 150 * sc);
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
      // the hole: photon rim, black body, dashed event horizon on the grid
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
      // blocks as coldsnap cubes: top face and two sides, far-to-near
      const tints = [
        { top: "#8fa3cc", left: "#5a6c94", right: "#3e4c6e", sTop: "#6a7a9c", sLeft: "#485674", sRight: "#343e58" },
        { top: "#cc9a72", left: "#96684a", right: "#6e4834", sTop: "#9c7a5e", sLeft: "#745442", sRight: "#583c2e" },
      ];
      const order = [];
      for (const b of wb) if (b.alive) order.push(b);
      order.sort((a, b) => (a.x + a.z) - (b.x + b.z) || a.y - b.y);
      const hw = Math.max(BS * sc * C30 * 0.5, 1.2), hh = Math.max(BS * sc * S30 * 0.5, 0.7), vh = Math.max(BS * sc * 0.9, 1.6);
      for (const b of order) {
        const p = iso(b.x, b.z, b.y), t = tints[b.tint], s = b.sleeping;
        ctx.fillStyle = s ? t.sLeft : t.left;
        ctx.beginPath(); ctx.moveTo(p.x - hw, p.y - hh); ctx.lineTo(p.x, p.y); ctx.lineTo(p.x, p.y + vh); ctx.lineTo(p.x - hw, p.y + vh - hh); ctx.closePath(); ctx.fill();
        ctx.fillStyle = s ? t.sRight : t.right;
        ctx.beginPath(); ctx.moveTo(p.x + hw, p.y - hh); ctx.lineTo(p.x, p.y); ctx.lineTo(p.x, p.y + vh); ctx.lineTo(p.x + hw, p.y + vh - hh); ctx.closePath(); ctx.fill();
        ctx.fillStyle = s ? t.sTop : t.top;
        ctx.beginPath(); ctx.moveTo(p.x, p.y - hh * 2); ctx.lineTo(p.x + hw, p.y - hh); ctx.lineTo(p.x, p.y); ctx.lineTo(p.x - hw, p.y - hh); ctx.closePath(); ctx.fill();
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
    <div onClick={click} style={{ padding: "10px 14px", borderRadius: 12, background: on ? "rgba(60,90,160,.16)" : "rgba(245,244,240,.85)", border: `1.5px solid ${on ? "rgba(60,90,160,.4)" : "rgba(0,0,0,.08)"}`, cursor: "pointer", userSelect: "none", WebkitUserSelect: "none", touchAction: "none", fontSize: 11, fontWeight: 700, letterSpacing: 1.2, color: on ? "rgba(40,60,120,.85)" : "rgba(0,0,0,.45)" }}>{label}</div>
  );
  const set = (fn) => { fn(ctl.current); ctl.current.reset++; setUi(u => ({ ...u })); };
  const setLive = (fn) => { fn(ctl.current); setUi(u => ({ ...u })); };

  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden", background: "#f5f4f0", fontFamily: "-apple-system,'SF Pro Display',sans-serif", userSelect: "none", WebkitUserSelect: "none" }}>
      <canvas ref={cvs} style={{ display: "block", touchAction: "none" }} />
      <div style={{ position: "absolute", top: 14, left: 14, background: "rgba(245,244,240,.85)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderRadius: 14, padding: "10px 16px", border: "1px solid rgba(0,0,0,.06)" }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.8, color: "rgba(0,0,0,.5)" }}>RUBBLE WORLDS</div>
        <div style={{ fontSize: 8, fontWeight: 500, color: "rgba(0,0,0,.35)", marginTop: 3 }}>seed {ui.seed} · {ui.fps}fps</div>
        <div style={{ fontSize: 8, fontWeight: 500, color: "rgba(0,0,0,.35)", marginTop: 2 }}>{ui.awake} awake · {ui.asleep} asleep · welds {ui.weldsAlive}{ui.kind === "hole" ? ` · eaten ${ui.eaten}` : ""}</div>
      </div>
      {onExit && <div onClick={onExit} style={{ position: "absolute", top: 14, right: 14, background: "rgba(245,244,240,.85)", borderRadius: 10, padding: "8px 12px", border: "1px solid rgba(0,0,0,.06)", cursor: "pointer", userSelect: "none", touchAction: "none", fontSize: 10, fontWeight: 600, letterSpacing: 1, color: "rgba(0,0,0,.45)" }}>⏏ MENU</div>}
      <div style={{ position: "absolute", bottom: 24, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap", padding: "0 12px" }}>
        {chip(ui.kind === "binary" ? "SCENE: BINARY" : "SCENE: BLACK HOLE", true, () => set(k => { k.kind = k.kind === "binary" ? "hole" : "binary"; }))}
        {chip(`WELDS ${ctl.current.welds ? "ON" : "OFF"}`, ctl.current.welds, () => setLive(k => { k.welds = !k.welds; }))}
        {chip(`SLEEP ${ctl.current.sleep ? "ON" : "OFF"}`, ctl.current.sleep, () => setLive(k => { k.sleep = !k.sleep; }))}
        {chip("RESET", false, () => set(() => {}))}
      </div>
    </div>
  );
}
