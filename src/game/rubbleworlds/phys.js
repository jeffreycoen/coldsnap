// rubbleworlds/phys.js — the demo's whole physics, carved from the component:
// the war engine's sequential-impulse solver, welds that tear by carried
// force, the clump scan, sleep and aggregates, the hole's horizon. Pure
// math; no screen in it. stepWorld advances one fixed step and returns the
// count of living welds. The spatial hash and solver tiers land here.
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

const WELD_STRENGTH_BY_SIZE = { 1: 30, 2: 160, 5: 185 };
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
function stepWorld(world, k) {
  const wb = world.blocks, welds = world.welds;
  let weldsAlive = 0;
      // --- CLUMP SCAN every 20 frames: union-find over touch distance ---
      if (world.frame % 20 === 0) {
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
      world.t += DT; world.frame++;
  return weldsAlive;
}
export { DT, SF, G, BS, BR, PMASS, ITERS, SLOP, BETA, BIAS_CAP, WELD_BREAK, WELD_BIAS, SLEEP_V, WAKE_TIDE, WELD_STRENGTH_BY_SIZE, C30, S30, stepWorld };
