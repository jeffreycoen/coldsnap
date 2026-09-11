// rubbleworlds/phys.js — the demo's whole physics: the war engine's
// sequential-impulse solver, welds that tear by carried force, the clump
// scan, sleep and aggregates, the hole's horizon. Pure math; no screen.
//
// THE BROADPHASE (the HASH chip, an A/B arm — measured slower at every count
// this demo reaches today because the grid is XZ-flat under 3D balls and
// gravity dominates regardless; kept switchable so the owner's own drive can
// judge it, and so it stands ready when block counts rise): the war engine's
// own two-tier grid, mirrored
// from collectContacts — sleeping blocks file into cells ONCE and stay on
// the books until they wake or die; moving blocks re-file each step,
// epoch-stamped. Contact candidates and the clump scan both read the grid.
// Contact pairs are re-sorted into the exact order the old brute walk
// emitted, so a becalmed scene is numerically identical to 0.5.18 — the
// pinned evolution hash proves it.
//
// GRAVITY FAR-FIELD: an awake block takes every other AWAKE clump as a
// point mass at its center unless that clump is near (inside its radius
// plus NEAR) — near clumps are summed exactly, block by block. Sleeping
// aggregates were already points; the hole and the star always pull exact.
//
// SOLVER TIERS: the war engine's LOD — sweeps drop from 8 only under
// constraint loads that calm scenes never reach, so quiet physics is
// untouched and collisions pay less exactly when they cost most.
//
// FRICTION (the chip): translational tangential clamping against the
// engine's own mu of 0.6 — accumulated per contact, capped by mu times the
// normal impulse. Off by default; welded pairs never feel it (the weld owns
// the pair). Blocks do not rotate, so this is friction's translational half.
const DT = 1 / 60, SF = 8, G = 210, C30 = Math.cos(Math.PI / 6), S30 = 0.5;
const BS = 6;              // block edge in sim units
const BR = BS * 0.55;      // contact radius
const PMASS = 6000;        // one planet's whole mass — parity with the ark's planets
const ITERS = 8;           // resting sweep count — tiers drop it only under load
const SLOP = 0.05;         // penetration allowance before the bias pushes
const BETA = 0.18;         // Baumgarte factor, the engine's own number
const BIAS_CAP = 5;        // bias ceiling, the engine's own number
const WELD_BREAK = 2.2;    // weld tears past this stretch ratio — measured: the welded planet passes the tide as chunks, 11 eaten against 66 weldless
const WELD_BIAS = 0.35;    // weld positional bias — stiff enough that welds carry load before breaking
const SLEEP_V = 2.2;       // a clump sleeps under this relative speed
const WAKE_TIDE = 0.35;    // aggregate wakes when tidal spread exceeds this fraction of its own hold
const MU = 0.6;            // friction coefficient — the war engine's default
const REWELD_V = 0.3;      // fuse when the NORMAL relative velocity is calmer than this — co-rotating neighbors carry omega-times-spacing tangentially with zero normal motion, so the fuse test must read the normal alone (the raw test never fired in a spinner)
const REWELD_T = 30;       // dwell frames before the fuse takes — hysteresis against weld-break flicker
const REWELD_STR = 0.6;    // a formed weld's strength against a born weld's — accretion is weaker than bedrock
const RIGID_N = 10;        // an awake weld-island this big promotes to a rigid body — one mass, one spin
const SHATTER = 12;        // an island whose velocity the solver jerks harder than this in one frame (speed plus spin-at-rim) demotes for LOOSE_T frames — resting contact only cancels gravity and reads near zero
const LOOSE_T = 20;
const SHIP_WELD = 4;       // hull welds are engineering, not accretion — four times born strength, so a landing survives and a crash still shears
// ship modules: never cold-weld (damage stays damage) and their island promotes at any size
const NEAR_F = 6;          // far-field near radius, in largest-block units

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

// one source's pull, softened, with the mission weight already applied
function pull(b, sx, sy, sz, m, w, out) {
  const dx = sx - b.x, dy = sy - b.y, dz = sz - b.z;
  const r2 = dx * dx + dy * dy + dz * dz + SF * SF, rn = Math.pow(r2, 1.65);
  out[0] += w * G * m * dx / rn; out[1] += w * G * m * dy / rn; out[2] += w * G * m * dz / rn;
}

const cellKey = (gx, gz) => gx * 73856093 ^ gz * 19349663;

function fileBlocks(world) {
  const wb = world.blocks;
  if (!world._bp) { world._bp = new Map(); world._bpEpoch = 0; }
  // cells carry a drift budget: sleeping blocks RIDE their orbiting aggregates
  // (unlike the war's stationary stone), so a filed position goes stale — the
  // cell is wide enough that a block may drift world.thr before its books lie,
  // and a sleeping block re-files itself past that budget
  if (!world.cell) { let mx = BS; for (const b of wb) if (b.s > mx) mx = b.s; world.cell = mx * 2.9; world.thr = mx * 1.4; }
  const grid = world._bp, cell = world.cell, epoch = ++world._bpEpoch;
  for (let i = 0; i < wb.length; i++) {
    const b = wb[i]; b.idx = i;
    const still = b.alive && b.sleeping;
    const stale = still && b._filed && (Math.abs(b.x - b._fx) > world.thr || Math.abs(b.z - b._fz) > world.thr);
    if ((!still || !b.alive || stale) && b._filed) { // woke, died, or drifted past the budget
      for (const key of b._cells) { const c = grid.get(key); if (c) { const at = c.stat.indexOf(b); if (at >= 0) c.stat.splice(at, 1); } }
      b._filed = false; b._cells = null;
    }
    if (!b.alive) continue;
    if (still && b._filed) continue; // the sleeping stone is already on the books
    const gx = Math.floor(b.x / cell), gz = Math.floor(b.z / cell);
    const key = cellKey(gx, gz);
    let c = grid.get(key);
    if (!c) { c = { stat: [], dyn: [], epoch: 0 }; grid.set(key, c); }
    if (still) {
      let at = c.stat.length; // sorted insert by index — the walk replays block order
      while (at > 0 && c.stat[at - 1].idx > i) at--;
      c.stat.splice(at, 0, b);
      b._cells = [key]; b._filed = true; b._fx = b.x; b._fz = b.z;
    } else {
      if (c.epoch !== epoch) { c.dyn.length = 0; c.epoch = epoch; }
      c.dyn.push(b);
    }
  }
}

// every alive block within `dist` of block b (XZ cells, exact 3D filter by caller)
function neighborsOf(world, b, out) {
  const grid = world._bp, cell = world.cell, epoch = world._bpEpoch;
  const gx = Math.floor(b.x / cell), gz = Math.floor(b.z / cell);
  out.length = 0;
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
    const c = grid.get(cellKey(gx + dx, gz + dz));
    if (!c) continue;
    for (const o of c.stat) out.push(o);
    if (c.epoch === epoch) for (const o of c.dyn) out.push(o);
  }
  return out;
}

const _nb = [];

// apply a normal impulse (velocity units) to a contact's two sides — free
// blocks directly, rigid members through their body's mass and inertia
function applyN(world, wb, cnt, bi, bj, dPn) {
  applyJ(world, cnt, bi, bj, cnt.nx * dPn, cnt.ny * dPn, cnt.nz * dPn);
}
// a general impulse (velocity units) on a contact's two sides
function applyJ(world, cnt, bi, bj, Jx, Jy, Jz) {
  if (cnt.Ra) {
    const R = cnt.Ra, m = cnt.ma;
    R.vx -= Jx * m / R.M; R.vy -= Jy * m / R.M; R.vz -= Jz * m / R.M;
    R.om -= ((bi.x - R.x) * Jz - (bi.z - R.z) * Jx) * m / R.Iy;
    R.dirty = true;
  } else { bi.vx -= Jx; bi.vy -= Jy; bi.vz -= Jz; }
  if (cnt.Rb) {
    const R = cnt.Rb, m = cnt.mb;
    R.vx += Jx * m / R.M; R.vy += Jy * m / R.M; R.vz += Jz * m / R.M;
    R.om += ((bj.x - R.x) * Jz - (bj.z - R.z) * Jx) * m / R.Iy;
    R.dirty = true;
  } else { bj.vx += Jx; bj.vy += Jy; bj.vz += Jz; }
}
// the velocity of a block's material point — rigid members move with their body
function ptVel(world, i, b, out) {
  const ri = world.rigidOf ? world.rigidOf[i] : -1;
  if (ri >= 0) { const R = world.rigids[ri]; out[0] = R.vx - R.om * (b.z - R.z); out[1] = R.vy; out[2] = R.vz + R.om * (b.x - R.x); }
  else { out[0] = b.vx; out[1] = b.vy; out[2] = b.vz; }
}
const _va = [0, 0, 0], _vb = [0, 0, 0];

// after impulses, every member of a dirty rigid conforms to the body again
function conformRigids(world, wb) {
  for (const R of world.rigids) {
    if (!R.dirty) continue; R.dirty = false;
    for (const i2 of R.ids) { const b = wb[i2]; const rx = b.x - R.x, rz = b.z - R.z;
      b.vx = R.vx - R.om * rz; b.vy = R.vy; b.vz = R.vz + R.om * rx; }
  }
}

function stepWorld(world, k) {
  const wb = world.blocks, welds = world.welds;
  let weldsAlive = 0;
      // --- THE BOOKS: file every block into the two-tier grid (hash arm only) ---
      if (k.hash) fileBlocks(world);
      // --- CLUMP SCAN every 20 frames: union-find over touch distance ---
      if (world.frame % 20 === 0) {
        const par = wb.map((_, i) => i);
        const find = (i) => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; };
        if (k.hash) {
          for (let i = 0; i < wb.length; i++) { if (!wb[i].alive) continue;
            neighborsOf(world, wb[i], _nb);
            for (const o of _nb) { const j = o.idx; if (j <= i || !o.alive) continue;
              const dx = o.x - wb[i].x, dy = o.y - wb[i].y, dz = o.z - wb[i].z;
              const link = Math.max(wb[i].s, o.s) * 1.35;
              if (dx * dx + dy * dy + dz * dz < link * link) { const a = find(i), b = find(j); if (a !== b) par[b] = a; } } }
        } else {
          for (let i = 0; i < wb.length; i++) { if (!wb[i].alive) continue; for (let j = i + 1; j < wb.length; j++) { if (!wb[j].alive) continue;
            const dx = wb[j].x - wb[i].x, dy = wb[j].y - wb[i].y, dz = wb[j].z - wb[i].z;
            const link = Math.max(wb[i].s, wb[j].s) * 1.35;
            if (dx * dx + dy * dy + dz * dz < link * link) { const a = find(i), b = find(j); if (a !== b) par[b] = a; } } }
        }
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
          // THE SPINNING SLEEPER: a merged world keeps its orbital angular momentum
          // and a rigid spin reads as internal motion to a translation-only calm
          // test — so no merged spinner could ever sleep (the owner's red log,
          // 2026-09-11). Fit the clump's rigid rotation about the vertical axis
          // (the orbital plane's normal) and measure calm as deviation from
          // rotation plus translation; the aggregate then carries the spin.
          let Lz = 0, Iy = 0;
          for (const i of ids) { const b = wb[i]; const rx = b.x - mx, rz = b.z - mz;
            Lz += b.m * (rx * (b.vz - mvz) - rz * (b.vx - mvx)); Iy += b.m * (rx * rx + rz * rz); }
          const om = Iy > 1e-9 ? Lz / Iy : 0;
          let rel = 0, rad = 0;
          for (const i of ids) { const b = wb[i]; const rx = b.x - mx, rz = b.z - mz;
            rel = Math.max(rel, Math.hypot(b.vx - mvx + om * rz, b.vy - mvy, b.vz - mvz - om * rx));
            rad = Math.max(rad, Math.hypot(b.x - mx, b.y - my, b.z - mz)); }
          gInfo.push({ root, ids, mx, my, mz, mvx, mvy, mvz, M, rel, rad, om });
        }
        world.aggs = [];
        for (const g of gInfo) {
          let near = false;
          if (world.hole && Math.hypot(g.mx - world.hole.x, g.my, g.mz - world.hole.z) < g.rad + world.hole.killR + BS * 6) near = true;
          if (world.star && Math.hypot(g.mx - world.star.x, g.my, g.mz - world.star.z) < g.rad + world.star.r + BS * 6) near = true;
          for (const o of gInfo) if (o !== g && Math.hypot(g.mx - o.mx, g.my - o.my, g.mz - o.mz) < g.rad + o.rad + BS * 6) near = true;
          if (!k.sleep || g.ids.length < 10 || near || g.rel >= SLEEP_V) { for (const i of g.ids) wb[i].sleeping = false; continue; }
          const agg = { x: g.mx, y: g.my, z: g.mz, vx: g.mvx, vy: g.mvy, vz: g.mvz, m: g.M, rad: g.rad, ids: g.ids, clump: g.root, om: g.om, offs: g.ids.map(i => [wb[i].x - g.mx, wb[i].y - g.my, wb[i].z - g.mz]) };
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

      // --- SOURCES for aggregate integration (unchanged shape) ---
      const srcs = [];
      const awakeIdx = [];
      for (let i = 0; i < wb.length; i++) if (wb[i].alive && !wb[i].sleeping) { awakeIdx.push(i); srcs.push(wb[i]); }
      const aggBase = srcs.length;
      for (const a of world.aggs) srcs.push(a);
      if (world.hole) srcs.push(world.hole);
      if (world.star) srcs.push(world.star);

      // --- RIGID PROMOTION: an awake weld-island moves as one body (the owner's
      // grouping rule, 2026-09-11). Islands are weld-connected components among
      // awake blocks; a promoted island carries one velocity and one vertical
      // spin, contacts against it resolve as impulses with rotational response,
      // and its internal welds cost nothing. Cold welding keeps fusing islands,
      // so a merged world converges to ONE island — exactly rigid, which is
      // what the spin-aware sleep test needs. Internal fracture is deferred:
      // a rigid island breaks only at its seams (cross-island welds), marked.
      world.rigidOf = new Array(wb.length).fill(-1);
      world.rigids = [];
      if (k.welds) {
        const rpar = wb.map((_, i2) => i2);
        const rfind = (i2) => { while (rpar[i2] !== i2) { rpar[i2] = rpar[rpar[i2]]; i2 = rpar[i2]; } return i2; };
        for (const w of welds) {
          if (!w.alive) continue;
          const a = wb[w.a], b = wb[w.b];
          if (!a.alive || !b.alive || a.sleeping || b.sleeping) continue;
          const ra = rfind(w.a), rb = rfind(w.b); if (ra !== rb) rpar[rb] = ra;
        }
        const isl = new Map();
        for (const i2 of awakeIdx) { const r = rfind(i2); if (!isl.has(r)) isl.set(r, []); isl.get(r).push(i2); }
        for (const [root, ids] of isl) {
          if (ids.length < RIGID_N && !ids.some(i2 => wb[i2].ship)) continue;
          if (ids.some(i2 => wb[i2].loose > 0)) continue; // knocked loose: the welds face the solver until the dust settles
          let M = 0, cx2 = 0, cy2 = 0, cz2 = 0, vx2 = 0, vy2 = 0, vz2 = 0;
          for (const i2 of ids) { const b = wb[i2]; M += b.m; cx2 += b.x * b.m; cy2 += b.y * b.m; cz2 += b.z * b.m; vx2 += b.vx * b.m; vy2 += b.vy * b.m; vz2 += b.vz * b.m; }
          cx2 /= M; cy2 /= M; cz2 /= M; vx2 /= M; vy2 /= M; vz2 /= M;
          let Lz = 0, Iy = 0;
          for (const i2 of ids) { const b = wb[i2]; const rx = b.x - cx2, rz = b.z - cz2;
            Lz += b.m * (rx * (b.vz - vz2) - rz * (b.vx - vx2)); Iy += b.m * (rx * rx + rz * rz); }
          const R = { ids, M, x: cx2, y: cy2, z: cz2, vx: vx2, vy: vy2, vz: vz2, om: Iy > 1e-9 ? Lz / Iy : 0, Iy: Math.max(Iy, 1e-9) };
          R.rad = 0; for (const i2 of ids) { const b = wb[i2]; const r = Math.hypot(b.x - R.x, b.z - R.z); if (r > R.rad) R.rad = r; }
          const ri = world.rigids.length; world.rigids.push(R);
          for (const i2 of ids) world.rigidOf[i2] = ri;
          // the members conform exactly to the body NOW — rigidity is enforced, not hoped for
          for (const i2 of ids) { const b = wb[i2]; const rx = b.x - R.x, rz = b.z - R.z;
            b.vx = R.vx - R.om * rz; b.vy = R.vy; b.vz = R.vz + R.om * rx; }
        }
      }

      // --- AWAKE CLUMPS for the far-field: group the awake blocks live ---
      const awakeClumps = new Map();
      for (const i of awakeIdx) {
        const b = wb[i];
        let g = awakeClumps.get(b.clump);
        if (!g) { g = { ids: [], mx: 0, my: 0, mz: 0, M: 0, rad: 0 }; awakeClumps.set(b.clump, g); }
        g.ids.push(i); g.mx += b.x * b.m; g.my += b.y * b.m; g.mz += b.z * b.m; g.M += b.m;
      }
      for (const g of awakeClumps.values()) { g.mx /= g.M; g.my /= g.M; g.mz /= g.M; }
      for (const [root, g] of awakeClumps) for (const i of g.ids) { const b = wb[i]; const r = Math.hypot(b.x - g.mx, b.y - g.my, b.z - g.mz); if (r > g.rad) g.rad = r; }
      const NEAR = NEAR_F * (world.cell || BS * 1.45);

      // --- GRAVITY KICK on awake blocks: exact near, clump points far.
      // Rigid members contribute their pull to the BODY as force and torque;
      // free blocks kick as before ---
      const out = [0, 0, 0];
      for (const i of awakeIdx) {
        const b = wb[i];
        const rIdx = world.rigidOf ? world.rigidOf[i] : -1;
        out[0] = 0; out[1] = 0; out[2] = 0;
        for (const [root, g] of awakeClumps) {
          const w = world.weak && root !== b.clump ? 0.01 : 1;
          const d = Math.hypot(g.mx - b.x, g.my - b.y, g.mz - b.z);
          if (root === b.clump || d < g.rad + NEAR) {
            for (const j of g.ids) { if (j === i) continue; const o = wb[j]; pull(b, o.x, o.y, o.z, o.m, w, out); }
          } else pull(b, g.mx, g.my, g.mz, g.M, w, out);
        }
        for (const a of world.aggs) { const w = world.weak && a.clump !== b.clump ? 0.01 : 1; pull(b, a.x, a.y, a.z, a.m, w, out); }
        if (world.hole) pull(b, world.hole.x, 0, world.hole.z, world.hole.m, 1, out);
        if (world.star) pull(b, world.star.x, 0, world.star.z, world.star.m, 1, out);
        if (rIdx >= 0) { const R = world.rigids[rIdx];
          R.vx += out[0] * b.m / R.M * DT; R.vy += out[1] * b.m / R.M * DT; R.vz += out[2] * b.m / R.M * DT;
          R.om += ((b.x - R.x) * out[2] - (b.z - R.z) * out[0]) * b.m / R.Iy * DT; R.dirty = true;
        } else { b.vx += out[0] * DT; b.vy += out[1] * DT; b.vz += out[2] * DT; }
      }
      conformRigids(world, wb);
      // --- AGGREGATES integrate as single bodies; members ride as offsets ---
      for (let n = 0; n < world.aggs.length; n++) {
        const a = world.aggs[n];
        const [ax, ay, az] = accel(a.x, a.y, a.z, srcs, aggBase + n, world.weak, a.clump);
        a.vx += ax * DT; a.vy += ay * DT; a.vz += az * DT; a.x += a.vx * DT; a.y += a.vy * DT; a.z += a.vz * DT;
        // a sleeping top keeps turning: rotate the member offsets by the spin
        const co = Math.cos(a.om * DT), si = Math.sin(a.om * DT);
        for (let q = 0; q < a.ids.length; q++) {
          const o = a.offs[q], ox = o[0], oz = o[2];
          o[0] = ox * co - oz * si; o[2] = ox * si + oz * co;
          const b = wb[a.ids[q]];
          b.x = a.x + o[0]; b.y = a.y + o[1]; b.z = a.z + o[2];
          b.vx = a.vx - a.om * o[2]; b.vy = a.vy; b.vz = a.vz + a.om * o[0];
        }
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

      // --- CONTACTS: candidates from the grid, replayed in the brute walk's order ---
      const contacts = [];
      for (let p = 0; p < awakeIdx.length; p++) {
        const i = awakeIdx[p], bi = wb[i];
        let cand;
        if (k.hash) {
          neighborsOf(world, bi, _nb);
          cand = [];
          for (const o of _nb) { const j = o.idx; if (j === i || !o.alive) continue;
            if (!o.sleeping && j < i) continue; // both awake: the lower index owns the pair
            cand.push(j); }
          cand.sort((a2, b2) => a2 - b2); // the exact order the brute walk emits
        } else {
          cand = null;
        }
        const jMax = cand ? cand.length : wb.length;
        for (let q = 0; q < jMax; q++) {
          const j = cand ? cand[q] : q;
          if (!cand) { if (j === i || !wb[j].alive) continue; if (!wb[j].sleeping && j < i) continue; }
          const bj = wb[j];
          const dx = bj.x - bi.x, dy = bj.y - bi.y, dz = bj.z - bi.z, d2 = dx * dx + dy * dy + dz * dz;
          const cd = bi.cr + bj.cr;
          if (d2 > cd * cd || d2 === 0) continue;
          const key = Math.min(i, j) * 100000 + Math.max(i, j);
          // a welded pair is the weld's alone — contact fighting a weld over the
          // same pair pumps energy and detonates the body (measured, 2026-09-11)
          if (k.welds) { const wq = world.weldOf.get(key); if (wq && wq.alive) continue; }
          if (bj.sleeping) { const cl = bj.clump; for (const b2 of wb) if (b2.clump === cl) b2.sleeping = false; world.aggs = world.aggs.filter(a => !a.ids.includes(j)); }
          const d = Math.sqrt(d2);
          const cnt = { i, j, nx: dx / d, ny: dy / d, nz: dz / d, depth: cd - d, pn: world.warm.get(key) || 0, key, ptx: 0, pty: 0, ptz: 0 };
          // effective inverse-mass factors, in the solver's velocity units: a free
          // block answers an impulse fully; a rigid member answers through its
          // body's mass and inertia at the contact arm
          const rig = (bidx, bb) => { const ri = world.rigidOf[bidx]; if (ri < 0) return null; return world.rigids[ri]; };
          const Ra = rig(i, bi), Rb = rig(j, bj);
          const arm = (R, b) => { const rx = b.x - R.x, rz = b.z - R.z; const t = rx * cnt.nz - rz * cnt.nx; return b.m * (1 / R.M + (t * t) / R.Iy); };
          cnt.fa = Ra ? arm(Ra, bi) : 1; cnt.fb = Rb ? arm(Rb, bj) : 1;
          cnt.Ra = Ra; cnt.Rb = Rb; cnt.ma = bi.m; cnt.mb = bj.m;
          cnt.bias = Math.min(BETA / DT * Math.max(0, cnt.depth - SLOP), BIAS_CAP);
          if (cnt.pn) applyN(world, wb, cnt, bi, bj, cnt.pn); // warm start through the SAME routing as the solver — never directly to a rigid member
          contacts.push(cnt);
        }
      }
      for (const R of world.rigids) { R.v0x = R.vx; R.v0y = R.vy; R.v0z = R.vz; R.om0 = R.om; }
      // --- SOLVER TIERS: the war engine's LOD — calm scenes never leave 8 sweeps ---
      let activeWelds = 0;
      if (k.welds) for (const w of welds) if (w.alive && wb[w.a].alive && wb[w.b].alive && !(wb[w.a].sleeping && wb[w.b].sleeping)) activeWelds++;
      const load = contacts.length + activeWelds;
      const itn = load > 1200 ? 4 : load > 600 ? 6 : ITERS;
      weldsAlive = 0;
      for (let it = 0; it < itn; it++) {
        if (k.welds) for (const w of welds) {
          if (!w.alive) continue;
          const a = wb[w.a], b = wb[w.b];
          if (!a.alive || !b.alive) { w.alive = false; continue; }
          if (a.sleeping && b.sleeping) continue;
          const ra = world.rigidOf[w.a], rb = world.rigidOf[w.b];
          if (ra >= 0 && ra === rb) continue; // inside a rigid island the weld carries no solver work
          const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, d = Math.hypot(dx, dy, dz) || 1;
          if (d > w.rest * WELD_BREAK) { w.alive = false; continue; }
          const nx = dx / d, ny = dy / d, nz = dz / d;
          ptVel(world, w.a, a, _va); ptVel(world, w.b, b, _vb);
          const vn = (_vb[0] - _va[0]) * nx + (_vb[1] - _va[1]) * ny + (_vb[2] - _va[2]) * nz;
          const bias = Math.max(-6, Math.min(6, (WELD_BIAS / DT) * (d - w.rest)));
          const P = -(vn + bias) * 0.5;
          w.acc += Math.abs(P);
          a.vx -= nx * P; a.vy -= ny * P; a.vz -= nz * P; b.vx += nx * P; b.vy += ny * P; b.vz += nz * P;
        }
        for (const cnt of contacts) {
          const bi = wb[cnt.i], bj = wb[cnt.j];
          // contact-point velocities come from the BODY state, not the member
          // blocks — members only re-conform at sweep's end, so reading them
          // let every interface contact apply a full correction against the
          // same stale velocities: a fifty-fold overshoot per sweep and the
          // seed-24199 detonation (2026-09-11). Through ptVel the sweep is
          // truly sequential over bodies, the war engine's own discipline.
          ptVel(world, cnt.i, bi, _va); ptVel(world, cnt.j, bj, _vb);
          const vn = (_vb[0] - _va[0]) * cnt.nx + (_vb[1] - _va[1]) * cnt.ny + (_vb[2] - _va[2]) * cnt.nz;
          let dPn = -(vn - cnt.bias) / (cnt.fa + cnt.fb);
          const pn0 = cnt.pn; cnt.pn = Math.max(0, cnt.pn + dPn); dPn = cnt.pn - pn0;
          applyN(world, wb, cnt, bi, bj, dPn);
          if (k.friction && cnt.pn > 0) {
            // tangential clamp against mu times the normal impulse — the engine's
            // rule, and for rigid members the slip is measured at the MATERIAL
            // POINT (body velocity plus spin at the arm): interface friction is
            // what couples two spinning bodies, syncs them, and lets the cold
            // welds finally take — without it they ride a frictionless bearing
            ptVel(world, cnt.i, bi, _va); ptVel(world, cnt.j, bj, _vb);
            const rvx = _vb[0] - _va[0], rvy = _vb[1] - _va[1], rvz = _vb[2] - _va[2];
            const rn2 = rvx * cnt.nx + rvy * cnt.ny + rvz * cnt.nz;
            let tx = rvx - rn2 * cnt.nx, ty = rvy - rn2 * cnt.ny, tz = rvz - rn2 * cnt.nz;
            const dtx = -tx * 0.5, dty = -ty * 0.5, dtz = -tz * 0.5;
            let npx = cnt.ptx + dtx, npy = cnt.pty + dty, npz = cnt.ptz + dtz;
            const pl = Math.hypot(npx, npy, npz), cap = MU * cnt.pn;
            if (pl > cap) { const f = cap / pl; npx *= f; npy *= f; npz *= f; }
            const ax2 = npx - cnt.ptx, ay2 = npy - cnt.pty, az2 = npz - cnt.ptz;
            cnt.ptx = npx; cnt.pty = npy; cnt.ptz = npz;
            const sc2 = 1 / (cnt.fa + cnt.fb); // through the same effective masses as the normal
            applyJ(world, cnt, bi, bj, ax2 * sc2, ay2 * sc2, az2 * sc2);
          }
        }
        conformRigids(world, wb);
      }
      // COLD WELDING: contact that holds still becomes structure — an unwelded
      // touching pair calmer than REWELD_V for REWELD_T frames fuses at its
      // current spacing, entering the same force-break law at REWELD_STR strength
      if (k.welds) {
        if (!world.dwell) world.dwell = new Map();
        const seen = new Set();
        for (const cnt of contacts) {
          const bi = wb[cnt.i], bj = wb[cnt.j];
          const dv = Math.abs((bj.vx - bi.vx) * cnt.nx + (bj.vy - bi.vy) * cnt.ny + (bj.vz - bi.vz) * cnt.nz);
          if (dv < REWELD_V) {
            seen.add(cnt.key);
            const n = (world.dwell.get(cnt.key) || 0) + 1;
            if (n >= REWELD_T) {
              const wq = world.weldOf.get(cnt.key);
              if ((!wq || !wq.alive) && !bi.ship && !bj.ship) {
                const d = Math.hypot(bj.x - bi.x, bj.y - bi.y, bj.z - bi.z);
                const nw = { a: cnt.i, b: cnt.j, rest: d, alive: true, acc: 0, gen: 2 };
                welds.push(nw); world.weldOf.set(cnt.key, nw);
              }
              world.dwell.delete(cnt.key);
            } else world.dwell.set(cnt.key, n);
          }
        }
        for (const key of world.dwell.keys()) if (!seen.has(key)) world.dwell.delete(key);
      }
      // force break, the war engine's rule: a weld that carried more than its
      // strength this frame tears — stretch alone never fires, because the
      // constraint is what prevents stretch (the unbreakable-weld flyby, 2026-09-11)
      if (k.welds) for (const w of welds) {
        if (!w.alive) continue;
        const cap = (WELD_STRENGTH_BY_SIZE[world.size] || 30) * (w.gen === 2 ? REWELD_STR : 1) * (wb[w.a].ship && wb[w.b].ship ? SHIP_WELD : 1);
        if (w.acc > cap) w.alive = false; else weldsAlive++;
        w.acc = 0;
      }
      // THE SHATTER RULE: an island the solver jerked harder than SHATTER this
      // frame demotes — its blocks go loose, its welds re-enter the solver and
      // break or hold under the true forces, survivors re-promote after the dust
      for (const R of world.rigids) {
        const jerk = Math.hypot(R.vx - R.v0x, R.vy - R.v0y, R.vz - R.v0z) + Math.abs(R.om - R.om0) * R.rad;
        if (jerk > SHATTER) for (const i2 of R.ids) wb[i2].loose = LOOSE_T;
      }
      for (const b of wb) if (b.loose > 0) b.loose--;
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
