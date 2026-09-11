import React, { useEffect, useRef, useState } from "react";

// RUBBLE WORLDS — block planets under real gravity, a proving-range demo.
// Two scenarios: BINARY (two 96-block planets in a decaying mutual orbit that
// end in collision) and BLACK HOLE (one 96-block planet streaming into a
// heavy body's kill radius in pieces). Blocks pull on everything by the same
// 1/r^2.3 softened law the ark flies; soft repulsion keeps them apart and
// bleeds orbital energy in pileups. WELDS and SLEEP are test arms, toggled
// live: welds are neighbor springs that tear past a stretch limit; sleep
// collapses settled clumps into aggregate bodies until tide, contact, or a
// torn weld wakes them. Every tuning number here is a design choice until
// watched. The seed is rolled fresh at mount and shown on the panel.
const DT = 1 / 60, SF = 8, G = 210, C30 = Math.cos(Math.PI / 6), S30 = 0.5;
const BS = 6;              // block edge in sim units
const BR = BS * 0.55;      // contact radius
const NBLOCK = 96;         // blocks per planet (design 2026-09-10)
const PMASS = 6000;        // one planet's whole mass — parity with the ark's planets
const KSOFT = 900;         // soft-repulsion stiffness
const CDAMP = 4;           // contact normal damping — the energy bleed
const WELD_K = 260;        // weld spring stiffness
const WELD_BREAK = 1.9;    // weld tears past this stretch ratio
const SLEEP_V = 2.2;       // a clump sleeps under this relative speed
const WAKE_TIDE = 0.35;    // aggregate wakes when tidal spread exceeds this fraction of its own hold

function makeRand(seed) { let ri = 0; return () => { const v = Math.sin(seed + (ri++) * 9973) * 43758.5453; return v - Math.floor(v); }; }

function makePlanet(cx, cz, vx, vz, tint, rand) {
  const blocks = []; const m = PMASS / NBLOCK;
  let ring = 0, placed = 0;
  while (placed < NBLOCK) {
    const n = ring === 0 ? 1 : Math.floor(ring * 6.28);
    for (let i = 0; i < n && placed < NBLOCK; i++) {
      const a = (i / n) * Math.PI * 2 + ring * 0.7 + rand() * 0.05;
      const r = ring * BS * (1 + rand() * 0.04);
      blocks.push({ x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r, vx, vz, m, tint, alive: true, sleeping: false, clump: -1 });
      placed++;
    }
    ring++;
  }
  return blocks;
}

function buildWelds(blocks) {
  const welds = [];
  for (let i = 0; i < blocks.length; i++) for (let j = i + 1; j < blocks.length; j++) {
    if (blocks[i].tint !== blocks[j].tint) continue;
    const dx = blocks[j].x - blocks[i].x, dz = blocks[j].z - blocks[i].z, d = Math.sqrt(dx * dx + dz * dz);
    if (d < BS * 1.45) welds.push({ a: i, b: j, rest: d, alive: true });
  }
  return welds;
}

function makeScenario(kind, seed) {
  const rand = makeRand(seed);
  const world = { kind, blocks: [], welds: [], hole: null, eaten: 0, aggs: [], t: 0 };
  if (kind === "binary") {
    const d = 190;
    // mutual orbit at 55% of the circular speed for this law — measured headless:
    // first contact near 14 seconds, full merge by 29
    const vOrb = Math.sqrt(G * PMASS * d / Math.pow(2 * d, 2.3)) * 0.55;
    world.blocks = [
      ...makePlanet(-d, 0, 0, -vOrb, 0, rand),
      ...makePlanet(d, 0, 0, vOrb, 1, rand),
    ];
  } else {
    world.hole = { x: 0, z: 0, m: 42000, killR: 26 };
    const px = 240, pz = 0;
    // 60% of circular: the ellipse dips into the tide — measured headless:
    // streaming from 4 seconds, about two thirds of the blocks eaten by 90
    const v = Math.sqrt(G * world.hole.m / Math.pow(px, 1.3)) * 0.6;
    world.blocks = makePlanet(px, pz, 0, v, 0, rand);
  }
  world.welds = buildWelds(world.blocks);
  return world;
}

// gravity of every source on (x,z), skipping index `self` in the flat source list
function accel(x, z, srcs, self) {
  let ax = 0, az = 0;
  for (let i = 0; i < srcs.length; i++) {
    if (i === self) continue;
    const s = srcs[i], dx = s.x - x, dz = s.z - z, r2 = dx * dx + dz * dz + SF * SF, rn = Math.pow(r2, 1.65);
    ax += G * s.m * dx / rn; az += G * s.m * dz / rn;
  }
  return [ax, az];
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
          const dx = wb[j].x - wb[i].x, dz = wb[j].z - wb[i].z;
          if (dx * dx + dz * dz < (BS * 1.35) ** 2) { const a = find(i), b = find(j); if (a !== b) par[b] = a; } } }
        const groups = new Map();
        for (let i = 0; i < wb.length; i++) { if (!wb[i].alive) continue; const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(i); wb[i].clump = r; }
        // sleep pass: a big, calm clump becomes an aggregate
        world.aggs = [];
        for (const [root, ids] of groups) {
          if (!k.sleep || ids.length < 10) { for (const i of ids) wb[i].sleeping = false; continue; }
          let mx = 0, mz = 0, mvx = 0, mvz = 0, M = 0;
          for (const i of ids) { const b = wb[i]; M += b.m; mx += b.x * b.m; mz += b.z * b.m; mvx += b.vx * b.m; mvz += b.vz * b.m; }
          mx /= M; mz /= M; mvx /= M; mvz /= M;
          let rel = 0, rad = 0;
          for (const i of ids) { const b = wb[i]; rel = Math.max(rel, Math.hypot(b.vx - mvx, b.vz - mvz)); rad = Math.max(rad, Math.hypot(b.x - mx, b.z - mz)); }
          if (rel < SLEEP_V) {
            const agg = { x: mx, z: mz, vx: mvx, vz: mvz, m: M, rad, ids, offs: ids.map(i => [wb[i].x - mx, wb[i].z - mz]) };
            for (const i of ids) wb[i].sleeping = true;
            world.aggs.push(agg);
          } else for (const i of ids) wb[i].sleeping = false;
        }
      }

      // --- SOURCES: awake blocks + aggregates + the hole ---
      const srcs = [];
      const awakeIdx = [];
      for (let i = 0; i < wb.length; i++) if (wb[i].alive && !wb[i].sleeping) { awakeIdx.push(i); srcs.push(wb[i]); }
      const aggBase = srcs.length;
      for (const a of world.aggs) srcs.push(a);
      if (world.hole) srcs.push(world.hole);

      // --- INTEGRATE awake blocks (leapfrog kick-drift) ---
      for (let n = 0; n < awakeIdx.length; n++) {
        const b = wb[awakeIdx[n]];
        const [ax, az] = accel(b.x, b.z, srcs, n);
        b.vx += ax * DT; b.vz += az * DT; b.x += b.vx * DT; b.z += b.vz * DT;
      }
      // --- INTEGRATE aggregates as single bodies; members ride as offsets ---
      for (let n = 0; n < world.aggs.length; n++) {
        const a = world.aggs[n];
        const [ax, az] = accel(a.x, a.z, srcs, aggBase + n);
        a.vx += ax * DT; a.vz += az * DT; a.x += a.vx * DT; a.z += a.vz * DT;
        for (let q = 0; q < a.ids.length; q++) { const b = wb[a.ids[q]]; b.x = a.x + a.offs[q][0]; b.z = a.z + a.offs[q][1]; b.vx = a.vx; b.vz = a.vz; }
        // wake by tide: gravity spread across the clump against its own hold
        let ext = 0;
        if (world.hole) { const d = Math.hypot(a.x - world.hole.x, a.z - world.hole.z); ext = Math.max(ext, G * world.hole.m * (Math.pow(Math.max(d - a.rad, SF), -2.3) - Math.pow(d + a.rad, -2.3))); }
        for (const o of world.aggs) if (o !== a) { const d = Math.hypot(a.x - o.x, a.z - o.z); ext = Math.max(ext, G * o.m * (Math.pow(Math.max(d - a.rad, SF), -2.3) - Math.pow(d + a.rad, -2.3))); }
        const hold = G * a.m / Math.pow(Math.max(a.rad, SF), 2.3);
        if (ext > hold * WAKE_TIDE) { for (const i of a.ids) wb[i].sleeping = false; a.dead = true; }
      }
      world.aggs = world.aggs.filter(a => !a.dead);

      // --- CONTACT: soft repulsion with normal damping, awake pairs; sleeping blocks wake on touch ---
      for (let p = 0; p < awakeIdx.length; p++) {
        const i = awakeIdx[p], bi = wb[i];
        for (let j = 0; j < wb.length; j++) {
          if (j <= i || !wb[j].alive) continue;
          const bj = wb[j];
          const dx = bj.x - bi.x, dz = bj.z - bi.z, d2 = dx * dx + dz * dz, cd = BR * 2;
          if (d2 > cd * cd || d2 === 0) continue;
          if (bj.sleeping) { const cl = bj.clump; for (const b2 of wb) if (b2.clump === cl) b2.sleeping = false; world.aggs = world.aggs.filter(a => !a.ids.includes(j)); }
          const d = Math.sqrt(d2), nx = dx / d, nz = dz / d, ov = cd - d;
          const rv = (bj.vx - bi.vx) * nx + (bj.vz - bi.vz) * nz;
          const f = (KSOFT * ov - CDAMP * rv * Math.min(ov, BR)) * DT * 0.5;
          bi.vx -= nx * f; bi.vz -= nz * f; bj.vx += nx * f; bj.vz += nz * f;
        }
      }

      // --- WELDS: springs that tear ---
      let weldsAlive = 0;
      if (k.welds) for (const w of welds) {
        if (!w.alive) continue;
        const a = wb[w.a], b = wb[w.b];
        if (!a.alive || !b.alive) { w.alive = false; continue; }
        if (a.sleeping && b.sleeping) { weldsAlive++; continue; }
        const dx = b.x - a.x, dz = b.z - a.z, d = Math.sqrt(dx * dx + dz * dz) || 1;
        if (d > w.rest * WELD_BREAK) { w.alive = false; continue; }
        weldsAlive++;
        const f = WELD_K * (d - w.rest) / d * DT;
        a.vx += dx * f; a.vz += dz * f; b.vx -= dx * f; b.vz -= dz * f;
      }

      // --- THE HOLE EATS ---
      if (world.hole) for (const b of wb) {
        if (!b.alive) continue;
        if (Math.hypot(b.x - world.hole.x, b.z - world.hole.z) < world.hole.killR) { b.alive = false; world.hole.m += b.m; world.eaten++; }
      }
      world.t += DT; frame++;

      // --- DRAW ---
      ctx.fillStyle = "#f5f4f0"; ctx.fillRect(0, 0, W, H);
      let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
      const pts = [...wb.filter(b => b.alive), ...(world.hole ? [world.hole] : [])];
      for (const p of pts) { const sx = (p.x - p.z) * C30, sy = (p.x + p.z) * S30; minX = Math.min(minX, sx); maxX = Math.max(maxX, sx); minY = Math.min(minY, sy); maxY = Math.max(maxY, sy); }
      const sc = Math.min(W * 0.82 / Math.max(maxX - minX, 60), H * 0.66 / Math.max(maxY - minY, 60), 2.2);
      const cx = W / 2 - (minX + maxX) / 2 * sc, cy = H / 2 - (minY + maxY) / 2 * sc;
      const iso = (x, z) => ({ x: cx + (x - z) * C30 * sc, y: cy + (x + z) * S30 * sc });
      if (world.hole) {
        const hp = iso(world.hole.x, world.hole.z), hr = world.hole.killR * sc;
        const g2 = ctx.createRadialGradient(hp.x, hp.y, hr * 0.2, hp.x, hp.y, hr * 2.4);
        g2.addColorStop(0, "rgba(20,16,28,1)"); g2.addColorStop(0.45, "rgba(60,40,90,.35)"); g2.addColorStop(1, "rgba(60,40,90,0)");
        ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(hp.x, hp.y, hr * 2.4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#14101c"; ctx.beginPath(); ctx.arc(hp.x, hp.y, hr, 0, Math.PI * 2); ctx.fill();
      }
      const tints = [["70,90,140", "42,52,72"], ["150,90,60", "84,50,40"]];
      for (const b of wb) {
        if (!b.alive) continue;
        const p = iso(b.x, b.z), r = Math.max(BS * sc * 0.5, 1.4);
        ctx.fillStyle = b.sleeping ? `rgba(${tints[b.tint][1]},.55)` : `rgba(${tints[b.tint][0]},.92)`;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.PI / 4); ctx.fillRect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4); ctx.restore();
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
