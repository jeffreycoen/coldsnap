// COLDSNAP DEPOT — mapgen.js: the map frame, moved VERBATIM out of
// DepotGame.jsx (P7 T18, the route.js precedent). One canonical square,
// four rotations; the generator, the terrain, the trees, the grid, the
// flow, the connectivity — and the frame's own state (ORIENT, the drawn
// map data), exported as live bindings so makeMap's writes reach every
// reader exactly as they did in the component. Zero behavior change; the
// T6 keystone (hash AND draws) pins the proof.
import { fwdUFor, fwdDirFor, invWFor, clampToRimFor } from "./orient.js";
import { mulberry32 } from "../engine/core.js";
import { MASON } from "./specs.js";
import { stampTerrainMasks } from "./route.js";
// ============================================================== the map
// THE FRONT (mk1.00): a 120x120 SQUARE — one canonical frame, four rotations.
// AMENDMENT 3 (mk1.02): the flow/build grid covers the FULL rim — the old
// 1m inset is gone. Cell centers sit at u,v = ±59; cell edges land exactly
// on the ±60 rim, so a stream running the rim's full width has no off-grid
// endpoint.
export const GRID_CS = 2.0, GRID_W = 90, GRID_H = 90;
export const GRID_OX = -(GRID_W * GRID_CS) / 2, GRID_OZ = -(GRID_H * GRID_CS) / 2;
export let ORIENT = 0;
// Transform formulas live in orient.js (pure, ORIENT-explicit, headlessly
// testable) — these wrappers just apply them against the module's current
// ORIENT, same call sites/behavior as before.
export const fwdU = (u, v) => fwdUFor(ORIENT, u, v);
export const fwdDir = (du, dv) => fwdDirFor(ORIENT, du, dv);
export const invW = (x, z) => invWFor(ORIENT, x, z);
// THE PLAYABLE RIM, once. buildDepotTerrain's falloff box is 60x60 in
// canonical (u, v) — beyond it there is no ground to stand on, only the
// painted horizon. world.inRim, the renderer's rim descriptor and the order
// clamp below all read THESE two numbers so they cannot drift apart.
export const RIM_HALF_U = 90, RIM_HALF_V = 90;
// P1.5 Task 1 (mk0.50): an off-map destination tap becomes the nearest point
// still on the field. The transform itself is orient.js's (pure, testable);
// this is the same thin ORIENT-binding wrapper fwdU/invW are.
export const clampToRim = (x, z) => clampToRimFor(ORIENT, x, z, RIM_HALF_U, RIM_HALF_V);
export let OBJ_POS = { x: 0, z: 49 };
export let SPAWN_POINTS = [], PONDS = [], ROCKS = [], TOWN = [], ROADS = [], PASSES = [], BANDS = [], MAP_SEED = 0, SPAWN_U = [];
export let STREAM = null; // T3: { pts:[{u,v}...], w, v, bridgeU } — canonical, regrown from seed
// STREAM OFF (mk1.94, owner): the water made too many impassable places. One
// switch guards the draw, the road bend and every clearance in genMap; the
// downstream machinery (the carve, grid water, slot and order refusals, the
// ribbons) already keys off STREAM staying null and waits dormant. Flip to
// true and the stream returns whole.
export const STREAM_ON = false;
export let HILLS = []; // T5: [{u, v, r, h}...] — canonical, regrown from seed

export function genMap(seed) {
  const r = mulberry32(seed);
  // THE SEAT OF THE WAR (P7 T3, owner): the depots press into OPPOSITE
  // CORNERS, point-symmetric — the longest front the square holds. Depth
  // hugs the rim; the u side is drawn once and mirrored with a hair of
  // jitter. genMap's rng is its own free stream — draw shape is ours.
  const depotDepth = 66 + r() * 12;                       // provisional (F5)
  const cornerSide = r() < 0.5 ? 1 : -1;
  const depotU1 = cornerSide * (51 + r() * 21);          // the player's corner
  const depotU2 = -depotU1 + (r() - 0.5) * 12;            // the far corner
  const objU = depotU1, objV = depotDepth - 3; // the objective sits 3m field-side of the player depot
  // THE BANDS (T2): 2-4 rock bands, evenly seeded across the middle ground,
  // each jittered — the fixed three-band skeleton is gone.
  const nBands = 2 + Math.floor(r() * 3);
  const bands = [];
  for (let i = 0; i < nBands; i++) bands.push(-42 + (i + 0.5) * (87 / nBands) + (r() - 0.5) * 15);
  // THE PASSES (T2): 1-3 gaps per band, drawn anywhere across the width.
  const passes = bands.map((z) => {
    const n = 1 + Math.floor(r() * 3);
    const out = [];
    for (let i = 0; i < n; i++) out.push({ x: -75 + r() * 150, z });
    return out;
  });
  // THE STREAM (T3, mk1.02): one per map — full width, meandering, in a
  // drawn gap clear of the bands, capped |v|<=22 so it can never touch a
  // depot pad. ONE causeway crossing at bridgeU. Canonical space throughout.
  // Drawn here (right after the bands, ahead of rocks) so every clearance
  // chain below — rocks, spawns-adjacent ponds, benches, ruins — can read
  // streamV; genMap's rng is its own free stream, so the draw order is ours.
  let stream = null, streamV = 0, bridgeU = 0;
  if (STREAM_ON) {
    streamV = (bands[0] + bands[1]) / 2;   // fallback: between the first two bands
    for (let i = 0; i < 20; i++) {
      const v = -33 + r() * 66;
      if (bands.every((b) => Math.abs(v - b) >= 8)) { streamV = v; break; }
    }
    const streamW = 2.2 + r() * 1.8;         // half-width: a 4.4-8m channel // provisional (F5)
    bridgeU = (r() - 0.5) * 135;
    const streamPts = [];
    for (let u = -90; u <= 90; u += 15) streamPts.push({ u, v: streamV + (r() - 0.5) * 6 });
    stream = { pts: streamPts, w: streamW, v: streamV, bridgeU };
  }
  const rocks = [];
  for (let bi = 0; bi < bands.length; bi++) {
    const density = 0.35 + r() * 0.65;
    for (let x = -82.5; x <= 82.5; x += 8.25 + r() * 4.5) {
      if (r() > density) continue;
      const z = bands[bi] + (r() - 0.5) * 2.5;
      if (passes[bi].some((g) => Math.abs(x - g.x) < 6.5)) continue;
      // T2: a wandering depot can meet a band — rocks keep 12m off both
      if (Math.hypot(x - depotU1, z - depotDepth) < 12 || Math.hypot(x - depotU2, z + depotDepth) < 12) continue;
      if (STREAM_ON && Math.abs(z - streamV) < 9) continue; // T3: rocks stay clear of the stream
      rocks.push({ x, z, r: 3.4 + r() * 1.2, h: 3.0 + r() * 0.9 });
    }
  }
  // THE SPAWNS (T2): 2-4, spread across the enemy edge with jitter.
  const nSpawn = 2 + Math.floor(r() * 3);
  const spawns = [];
  for (let i = 0; i < nSpawn; i++) spawns.push({ x: -67.5 + (i + 0.5) * (135 / nSpawn) + (r() - 0.5) * 15, z: GRID_OZ + 2 });
  // THE ROADS (T2): 0-3 — a front owes nobody a road. Each drawn road runs
  // spawn -> one pass per band -> the objective. Roads are terrain and looks;
  // the march runs the flow field either way.
  const nRoads = Math.floor(r() * 4);
  const roads = [];
  for (let ri = 0; ri < nRoads; ri++) {
    const pts = [[spawns[ri % spawns.length].x, GRID_OZ + 2]];
    let bridged = false;
    for (const band of passes) {
      const g = band[Math.floor(r() * band.length)];
      if (STREAM_ON && !bridged && g.z > streamV) { pts.push([bridgeU, streamV]); bridged = true; }
      pts.push([g.x, g.z]);
    }
    if (STREAM_ON && !bridged) pts.push([bridgeU, streamV]);
    pts.push([objU, objV]);
    roads.push(pts);
  }
  const roadDist = (x, z) => {
    let best = 1e9;
    for (const route of roads) for (let i = 0; i < route.length - 1; i++) {
      const a = route[i], b2 = route[i + 1];
      const dx = b2[0] - a[0], dz = b2[1] - a[1];
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
      best = Math.min(best, Math.hypot(x - (a[0] + dx * t), z - (a[1] + dz * t)));
    }
    return best;
  };
  const ponds = [];
  const nP = 1 + Math.floor(r() * 4);
  for (let i = 0; i < 30 && ponds.length < nP; i++) {
    const x = -75 + r() * 150, z = -18 + r() * 72, rad = 5.5 + r() * 2.5;
    if (passes.flat().some((g) => Math.abs(x - g.x) < 9 && Math.abs(z - g.z) < 14)) continue;
    if (roadDist(x, z) < rad + 6) continue;
    // T2: clear of BOTH depots (the old check knew one fixed objective)
    if (Math.hypot(x - depotU1, z - depotDepth) < 16 || Math.hypot(x - depotU2, z + depotDepth) < 16) continue;
    if (ponds.some((q) => Math.hypot(x - q.x, z - q.z) < q.r + rad + 6)) continue;
    if (STREAM_ON && Math.abs(z - streamV) < rad + 10) continue; // T3: ponds stay clear of the stream
    ponds.push({ x, z, r: rad, level: 0 });
  }
  // T5: THE HIGH GROUND (owner's rulings: 1-3 hills, never zero; overlook
  // allowed — only the stream, ponds and roads push a hill away). Canonical
  // coords like the stream; buildDepotTerrain lifts them in its own frame.
  const hills = [];
  const nHills = 1 + Math.floor(r() * 3);
  for (let k = 0, placed = 0; k < 60 && placed < nHills; k++) {
    const hu = -72 + r() * 144, hv = -69 + r() * 132;
    const hr = 10 + r() * 5, hh = 3 + r() * 2;
    if (STREAM_ON && Math.abs(hv - streamV) < hr + 10) continue;
    if (ponds.some((q) => Math.hypot(hu - q.x, hv - q.z) < q.r + hr * 0.7 + 4)) continue;
    if (roadDist(hu, hv) < hr * 0.7 + 4) continue;
    hills.push({ u: hu, v: hv, r: hr, h: hh });
    placed++;
  }
  const TPL = [
    { t: "croft", nx: 4, nz: 3, ny: 3 }, { t: "house", nx: 6, nz: 5, ny: 4, cols: true },
    { t: "house", nx: 5, nz: 4, ny: 4 }, { t: "long", nx: 8, nz: 4, ny: 3, cols: true },
    { t: "watch", nx: 2, nz: 2, ny: 8 }, { t: "granary", nx: 3, nz: 3, ny: 7 },
    { t: "yard", nx: 6, nz: 5, ny: 2, roof: false }, { t: "shed", nx: 4, nz: 4, ny: 3 },
    { t: "chapel", nx: 5, nz: 6, ny: 5, cols: true }, { t: "keep", nx: 7, nz: 6, ny: 5, cols: true },
  ];
  // T2: both depots at their DRAWN positions — same lattice, same template.
  const town = [
    { id: "depot", x: depotU1, z: depotDepth, nx: 12, nz: 9, ny: 7, door: 5, depot: true },
    { id: "depot2", x: depotU2, z: -depotDepth, nx: 12, nz: 9, ny: 7, door: 5, depot: true, team: 2 },
  ];
  // T2: BOTH depots run the foul check the enemy's alone used to run —
  // except the ROAD clause, which checks depot2 only (AMENDMENT 2): every
  // drawn road terminates AT the player depot by design (its own supply
  // road), so road proximity is a foul for the enemy's ground alone.
  // P7 T3 fix (dispatch-time anchor mismatch): this was hardcoded to the OLD
  // 9x7 dims, not derived from the TOWN entries above — with the depot grown
  // to 12x9 it under-cleared the real footprint (found by FRONT F1's sweep,
  // two seeds where depot2 read as clear of a spawn it actually crowded).
  const dHalfDiag = Math.hypot(town[0].nx, town[0].nz) * MASON.pitch / 2;
  const dFoul = (d, roadChecked) =>
    (roadChecked && roadDist(d.x, d.z) <= dHalfDiag + 2) ||
    spawns.some((sp) => Math.hypot(d.x - sp.x, d.z - sp.z) < dHalfDiag + 2) ||
    ponds.some((q) => Math.hypot(d.x - q.x, d.z - q.z) < q.r + dHalfDiag) ||
    rocks.some((q) => Math.hypot(d.x - q.x, d.z - q.z) < q.r + dHalfDiag);
  const depotFoul = dFoul(town[0], false) || dFoul(town[1], true);
  // T4: THE BIG FORMS (owner's ruling: 2-4 per map) — the proving grounds'
  // slab-roof drive-through hangar and columned warehouse, placed before the
  // benches so the landmarks go down first and the benches fill around them.
  // The shape flags (slab/drive/cols) are read by buildTown.
  const BIG = [
    { t: "hangar", nx: 9, nz: 10, ny: 5, slab: true, drive: true },
    { t: "warehouse", nx: 8, nz: 6, ny: 4, cols: true },
  ];
  let bid = 0;
  const nBig = 2 + Math.floor(r() * 3);
  for (let k = 0, placed = 0; k < 120 && placed < nBig; k++) {
    const tpl = BIG[Math.floor(r() * BIG.length)];
    const swap = r() < 0.5;
    const nx = swap ? tpl.nz : tpl.nx, nz = swap ? tpl.nx : tpl.nz;
    const x = -72 + r() * 144;
    const z = -66 + r() * 126;
    const rad = Math.max(nx, nz) * MASON.pitch / 2 + 2;
    if (passes.flat().some((g) => Math.abs(x - g.x) < rad + 4 && Math.abs(z - g.z) < 12)) continue;
    if (spawns.some((sp) => Math.hypot(x - sp.x, z - sp.z) < rad + 4)) continue;
    if (ponds.some((q) => Math.hypot(x - q.x, z - q.z) < q.r + rad + 3)) continue;
    if (rocks.some((q) => Math.hypot(x - q.x, z - q.z) < q.r + rad + 1.5)) continue;
    if (roadDist(x, z) < rad + 3) continue;
    if (town.some((q) => Math.hypot(x - q.x, z - q.z) < rad + Math.max(q.nx, q.nz) * MASON.pitch / 2 + 2.5)) continue;
    if (STREAM_ON && Math.abs(z - streamV) < rad + 9) continue;
    town.push({ id: tpl.t + bid++, x, z, nx, nz, ny: tpl.ny,
      door: tpl.drive ? -1 : (r() < 0.5 ? 0 : nx - 1),
      slab: tpl.slab, drive: tpl.drive, cols: tpl.cols });
    placed++;
  }
  // T2: benches between consecutive bands, plus the last band to depot ground.
  const benches = [];
  for (let i = 0; i + 1 < bands.length; i++) benches.push([bands[i] + 8, bands[i + 1] - 7]);
  benches.push([bands[bands.length - 1] + 8, depotDepth - 8]);
  for (let bi = 0; bi < benches.length; bi++) {
    const want = 2 + Math.floor(r() * 4);
    for (let k = 0, placed = 0; k < 90 && placed < want; k++) {
      const tpl = TPL[Math.floor(r() * TPL.length)];
      const swap = r() < 0.5;
      const nx = swap ? tpl.nz : tpl.nx, nz = swap ? tpl.nx : tpl.nz;
      const x = -78 + r() * 156;
      const z = benches[bi][0] + r() * Math.max(2, benches[bi][1] - benches[bi][0]);
      const rad = Math.max(nx, nz) * MASON.pitch / 2 + 2;
      if (passes.flat().some((g) => Math.abs(x - g.x) < rad + 4 && Math.abs(z - g.z) < 12)) continue;
      if (ponds.some((q) => Math.hypot(x - q.x, z - q.z) < q.r + rad + 3)) continue;
      if (rocks.some((q) => Math.hypot(x - q.x, z - q.z) < q.r + rad + 1.5)) continue;
      if (town.some((q) => Math.hypot(x - q.x, z - q.z) < rad + Math.max(q.nx, q.nz) * MASON.pitch / 2 + 2.5)) continue;
      if (STREAM_ON && Math.abs(z - streamV) < rad + 9) continue; // T3: bench buildings stay clear of the stream
      const decay = r() < 0.2 ? 0.12 + r() * 0.3 : 0;
      town.push({ id: tpl.t + bid++, x, z, nx, nz, ny: tpl.ny, door: r() < 0.5 ? 0 : nx - 1, roof: tpl.roof, ruin: decay || undefined, cols: tpl.cols });
      placed++;
    }
  }
  const nRuin = Math.floor(r() * 3);
  for (let k = 0, placed = 0; k < 14 && placed < nRuin; k++) {
    const x = -75 + r() * 150, z = -depotDepth + r() * 30;
    if (spawns.some((sp) => Math.hypot(x - sp.x, z - sp.z) < 10)) continue;
    if (town.some((q) => Math.hypot(x - q.x, z - q.z) < 10)) continue;
    if (STREAM_ON && Math.abs(z - streamV) < 9) continue; // T3: old ruins stay clear of the stream
    town.push({ id: "oldruin" + placed, x, z, nx: 4, nz: 4, ny: 3, door: 0, ruin: 0.5 });
    placed++;
  }
  // T4: FIELD WALLS (owner's rulings: they block the grid; axis-aligned) —
  // freestanding masonry screens, 3-8 stones long, 2-4 courses, one stone
  // thick. Town entries like any building: footprint claim, ruin bookkeeping.
  const nWalls = 2 + Math.floor(r() * 4);
  for (let k = 0, placed = 0; k < 90 && placed < nWalls; k++) {
    const L = 3 + Math.floor(r() * 6), H = 2 + Math.floor(r() * 3);
    const swap = r() < 0.5;
    const nx = swap ? 1 : L, nz = swap ? L : 1;
    const x = -75 + r() * 150;
    const z = -66 + r() * 126;
    const rad = L * MASON.pitch / 2 + 1;
    if (passes.flat().some((g) => Math.abs(x - g.x) < rad + 4 && Math.abs(z - g.z) < 8)) continue;
    if (spawns.some((sp) => Math.hypot(x - sp.x, z - sp.z) < rad + 3)) continue;
    if (ponds.some((q) => Math.hypot(x - q.x, z - q.z) < q.r + rad + 2)) continue;
    if (rocks.some((q) => Math.hypot(x - q.x, z - q.z) < q.r + rad + 1.5)) continue;
    if (roadDist(x, z) < rad + 2.5) continue;
    if (town.some((q) => Math.hypot(x - q.x, z - q.z) < rad + Math.max(q.nx, q.nz) * MASON.pitch / 2 + 2)) continue;
    if (STREAM_ON && Math.abs(z - streamV) < rad + 9) continue;
    town.push({ id: "fwall" + placed, x, z, nx, nz, ny: H, door: -1, roof: false });
    placed++;
  }
  const T = (o) => { const w = fwdU(o.x, o.z); o.x = w.x; o.z = w.z; return o; };
  for (const k of rocks) T(k);
  for (const q of ponds) T(q);
  for (const t of town) { T(t); if (ORIENT % 2) { const nx0 = t.nx; t.nx = t.nz; t.nz = nx0; t.door = Math.min(t.door, t.nx - 1); } }
  const spawnU = spawns.map((sp) => sp.x);
  for (const sp of spawns) T(sp);
  for (const band of passes) for (const g of band) T(g);
  for (const route of roads) for (const pt of route) { const w = fwdU(pt[0], pt[1]); pt[0] = w.x; pt[1] = w.z; }
  return { seed, bands, passes, rocks, ponds, spawns, spawnU, town, roads, depotFoul, objU, objV, depotU1, depotU2, depotDepth, stream, hills };
}
export function makeMap(seed) {
  for (let attempt = 0; attempt < 24; attempt++) {   // T2: wilder maps foul more — a deeper retry pocket
    const sd = seed + attempt * 7919;
    ORIENT = sd % 4;
    const m = genMap(sd);
    OBJ_POS = fwdU(m.objU, m.objV);                  // T2: the objective follows the DRAWN depot, set after genMap
    MAP_SEED = sd; BANDS = m.bands; PASSES = m.passes; ROCKS = m.rocks;
    PONDS = m.ponds; SPAWN_POINTS = m.spawns; TOWN = m.town; ROADS = m.roads;
    SPAWN_U = m.spawnU; STREAM = m.stream; HILLS = m.hills;
    const g = makeGrid(null);
    for (const t of TOWN) {
      const hx = (t.nx * MASON.pitch) / 2, hz = (t.nz * MASON.pitch) / 2;
      for (let gz = 0; gz < GRID_H; gz++) for (let gx = 0; gx < GRID_W; gx++) {
        const wp = g.gridToWorld(gx, gz);
        if (Math.abs(wp.x - t.x) < hx + 1.0 && Math.abs(wp.z - t.z) < hz + 1.0) {
          if (Math.hypot(wp.x - OBJ_POS.x, wp.z - OBJ_POS.z) < 5) continue;
          g.cells[g.idx(gx, gz)].blocked = true;
        }
      }
    }
    const og = g.worldToGrid(OBJ_POS.x, OBJ_POS.z);
    // T2: the enemy doorway derives from the DRAWN depot2 — 5m behind its center.
    const d2door = fwdU(m.depotU2, -m.depotDepth - 5);
    const dg = g.worldToGrid(d2door.x, d2door.z);
    // T2: the grown predicate — town minimum, no depot foul, explicit spacing
    // (guaranteed by construction, asserted anyway), both connectivities.
    if (TOWN.length >= 6 && !m.depotFoul &&
        Math.hypot(m.depotU1 - m.depotU2, 2 * m.depotDepth) >= 105 &&
        checkConnectivity(g, SPAWN_POINTS, og.gx, og.gz) &&
        checkConnectivity(g, SPAWN_POINTS, dg.gx, dg.gz)) return;
  }
}

export function buildDepotTerrain(field, seed = 11) {
  const r = mulberry32(seed);
  const { n, cs, h, half } = field;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = i * cs - half, z = j * cs - half;
    const cuv = invW(x, z);
    const stepUp = (v0, w, h2) => { const t = Math.min(1, Math.max(0, (cuv.v - v0) / w + 0.5)); return h2 * t * t * (3 - 2 * t); };
    let y = 2.0
      + Math.sin(x * 0.075 + 1.3) * 0.42
      + Math.cos(z * 0.061 - 0.6) * 0.38
      + Math.sin((x + z) * 0.032) * 0.30
      + (r() - 0.5) * 0.06;
    for (let bi = 0; bi < BANDS.length; bi++) y += stepUp(BANDS[bi] - 1, 10, 1.8 + 0.2 * (bi % 3));
    // T5: the high ground — the proving grounds' bump form, per drawn hill.
    for (const hb of HILLS) {
      const dh = ((cuv.u - hb.u) * (cuv.u - hb.u) + (cuv.v - hb.v) * (cuv.v - hb.v)) / (hb.r * hb.r);
      y += hb.h * Math.exp(-dh);
    }
    const over = Math.max(0, Math.abs(cuv.u) - RIM_HALF_U, Math.abs(cuv.v) - RIM_HALF_V);
    if (over > 0) y = Math.max(-6, y - over * over * 0.55);
    for (const k of ROCKS) {
      const d = Math.hypot(x - k.x, z - k.z) / k.r;
      if (d < 1.6) y += k.h * Math.exp(-d * d * 2.1);
    }
    for (const p of PONDS) {
      const d = Math.hypot(x - p.x, z - p.z);
      const lip = p.r + 4.5;
      if (d < lip) {
        const t = Math.min(1, (lip - d) / 4.5);
        y = y * (1 - t) + p.level * t;
      }
    }
    h[j * n + i] = y;
  }
  for (const t of TOWN) {
    const rad = Math.hypot(t.nx, t.nz) * MASON.pitch / 2 + (t.depot ? 4.0 : 2.0);
    const ph = h[Math.round((t.z + half) / cs) * n + Math.round((t.x + half) / cs)] + (t.depot ? 0.5 : 0);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = i * cs - half, z = j * cs - half;
      const d = Math.hypot(x - t.x, z - t.z);
      if (d >= rad) continue;
      h[j * n + i] += (ph - h[j * n + i]) * Math.min(1, (rad - d) / 1.8);
    }
  }
  const maxStep = Math.tan(0.52) * cs, dStep = maxStep * Math.SQRT2;
  for (let pass = 0; pass < 3; pass++) {
    for (let j = 1; j < n - 1; j++) for (let i = 1; i < n - 1; i++) {
      const k = j * n + i;
      const lo = Math.min(h[k - 1], h[k + 1], h[k - n], h[k + n]) + maxStep;
      const lod = Math.min(h[k - n - 1], h[k - n + 1], h[k + n - 1], h[k + n + 1]) + dStep;
      const cap = Math.min(lo, lod);
      if (h[k] > cap) h[k] = cap;
    }
  }
  // T3: THE STREAM. Carved after the relax (banks stay banks), before the
  // roads (the causeway ramp smooths). Bed at 0.2, water at 0.78 — absolute
  // levels; base terrain never dips below ~0.9, so the plane stays banked.
  if (STREAM) {
    const P = STREAM.pts, W = STREAM.w;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = i * cs - half, z = j * cs - half;
      const c = invW(x, z);
      let dS = 1e9;
      for (let k2 = 0; k2 + 1 < P.length; k2++) {
        const a = P[k2], b = P[k2 + 1];
        const du = b.u - a.u, dv = b.v - a.v;
        const t = Math.max(0, Math.min(1, ((c.u - a.u) * du + (c.v - a.v) * dv) / (du * du + dv * dv)));
        dS = Math.min(dS, Math.hypot(c.u - (a.u + du * t), c.v - (a.v + dv * t)));
      }
      if (dS >= W + 3) continue;
      const k = j * n + i;
      const target = dS < W ? 0.2 : 0.2 + ((dS - W) / 3) * (h[k] - 0.2);
      // the causeway: untouched within 3m of the crossing, full carve by 6m
      const cw = Math.min(1, Math.max(0, (Math.abs(c.u - STREAM.bridgeU) - 3) / 3));
      const carved = h[k] * (1 - cw) + Math.min(h[k], target) * cw;
      if (carved < h[k]) h[k] = carved;
    }
  }
  const segD = (x, z, a, b) => {
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
    return Math.hypot(x - (a[0] + dx * t), z - (a[1] + dz * t));
  };
  const onRoad = new Uint8Array(n * n);
  for (let j = 1; j < n - 1; j++) for (let i = 1; i < n - 1; i++) {
    const x = i * cs - half, z = j * cs - half;
    for (const route of ROADS) {
      for (let sgi = 0; sgi < route.length - 1 && !onRoad[j * n + i]; sgi++) {
        if (segD(x, z, route[sgi], route[sgi + 1]) < 4.5) onRoad[j * n + i] = 1;
      }
    }
  }
  const roadStep = Math.tan(0.10) * cs;
  for (let pass = 0; pass < 60; pass++) {
    for (let j = 1; j < n - 1; j++) for (let i = 1; i < n - 1; i++) {
      const k = j * n + i;
      if (!onRoad[k]) continue;
      const cap = Math.min(h[k - 1], h[k + 1], h[k - n], h[k + n]) + roadStep;
      if (h[k] > cap) h[k] = cap;
    }
  }
  field.dirty = true;
}
export function pondAt(x, z) { for (const p of PONDS) if (Math.hypot(x - p.x, z - p.z) < p.r) return p; return null; }
export function rockAt(x, z) { for (const k of ROCKS) if (Math.hypot(x - k.x, z - k.z) < k.r * 0.78) return k; return null; }

// THE STONE COUNT (Settled Ground T1, mk2.61): the planned stone cost of one
// town entry, by buildTown's OWN lay rules (DepotGame.jsx, the non-depot
// branch) — perimeter walls, interior columns, the granular roof, the door
// carve, the drive-through carve, the decay hash, the slab. mapgen plans in
// the currency the renderer pays. The two depots are the precast branch and
// are outside this count by design (the suite excludes them too).
// Mirror discipline: any change to buildTown's lay rules changes this
// function in the same task, and era 33's equality sweep is the proof.
export const TOWN_STONE_CAP = 3000; // owner, 2026-08-26 — provisional until the Pi collapse capture // provisional (F5)
export function stoneCount(t) {
  const colAt = t.cols
    ? (() => {
        const c1x = Math.floor(t.nx / 3), c1z = Math.floor(t.nz / 3);
        const c2x = t.nx - 1 - c1x, c2z = t.nz - 1 - c1z;
        return (ix, iz) => (ix === c1x && iz === c1z) || (ix === c2x && iz === c2z);
      })()
    : () => false;
  const driveZ = t.drive && t.nz >= t.nx;
  let n = 0;
  for (let ix = 0; ix < t.nx; ix++) for (let iy = 0; iy <= t.ny; iy++) for (let iz = 0; iz < t.nz; iz++) {
    const perim = ix === 0 || ix === t.nx - 1 || iz === 0 || iz === t.nz - 1;
    if (iy < t.ny && !perim && !colAt(ix, iz)) continue;
    if (iy === t.ny && (t.roof === false || t.slab)) continue;
    if (ix === t.door && (iz === 1 || iz === 2) && iy <= 2) continue;
    if (t.drive && iy < t.ny - 1 && (driveZ
      ? (iz === 0 || iz === t.nz - 1) && ix >= 1 && ix <= t.nx - 2
      : (ix === 0 || ix === t.nx - 1) && iz >= 1 && iz <= t.nz - 2)) continue;
    if (t.ruin && ((ix * 31 + iy * 17 + iz * 7) % 100) / 100 < t.ruin && iy > 0) continue;
    n++;
  }
  if (t.slab) n++; // the slab is ONE body, counted like buildTown's grid3 counts it
  return n;
}

// ========================================================== grid + flow
export function makeGrid(field) {
  const cells = new Array(GRID_W * GRID_H);
  for (let i = 0; i < cells.length; i++) cells[i] = { blocked: false, terrain: false, ice: false, dx: 0, dz: 0, dist: 1e9, wallId: null, building: null, bTeam: 0, steep: false, drop: false, bag: null, bagId: null };
  const G = {
    cells, w: GRID_W, h: GRID_H, cs: GRID_CS, ox: GRID_OX, oz: GRID_OZ,
    idx: (gx, gz) => gz * GRID_W + gx,
    worldToGrid: (x, z) => { const c = invW(x, z); return { gx: Math.floor((c.u - GRID_OX) / GRID_CS), gz: Math.floor((c.v - GRID_OZ) / GRID_CS) }; },
    gridToWorld: (gx, gz) => fwdU(GRID_OX + (gx + 0.5) * GRID_CS, GRID_OZ + (gz + 0.5) * GRID_CS),
    inBounds: (gx, gz) => gx >= 0 && gx < GRID_W && gz >= 0 && gz < GRID_H,
    cellAt(x, z) {
      const g = G.worldToGrid(x, z);
      if (!G.inBounds(g.gx, g.gz)) return null;
      return cells[G.idx(g.gx, g.gz)];
    },
  };
  for (let gz = 0; gz < GRID_H; gz++) for (let gx = 0; gx < GRID_W; gx++) {
    const wp = G.gridToWorld(gx, gz);
    const c = cells[G.idx(gx, gz)];
    if (rockAt(wp.x, wp.z)) { c.blocked = true; c.terrain = true; }
    else if (streamAt(wp.x, wp.z)) { c.blocked = true; c.water = true; }
    else if (pondAt(wp.x, wp.z)) c.ice = true;
  }
  // P7 T13: the terrain masks — steep ground a hull must not climb, cliff
  // lips a man must not walk off. Stamped once; craters do not restamp
  // (their ~0.5m sits under both thresholds). AMENDMENT 2: makeMap's
  // generation-time grid (makeGrid(null), ~line 309) carries no terrain
  // field and needs no masks — it only tests footprints; the guard keeps
  // its cells' steep/drop at their false defaults.
  if (field) stampTerrainMasks(G, field);
  return G;
}
// T3: is this WORLD point open water? Canonical distance to the stream
// centerline, minus the causeway exemption. The one water test everything
// reads — grid blocking, squad slots, order taps, placement.
export function streamAt(x, z) {
  if (!STREAM) return false;
  const c = invW(x, z);
  if (Math.abs(c.u - STREAM.bridgeU) < 3) return false; // the causeway
  const P = STREAM.pts;
  let best = 1e9;
  for (let i = 0; i + 1 < P.length; i++) {
    const a = P[i], b = P[i + 1];
    const du = b.u - a.u, dv = b.v - a.v;
    const t = Math.max(0, Math.min(1, ((c.u - a.u) * du + (c.v - a.v) * dv) / (du * du + dv * dv)));
    best = Math.min(best, Math.hypot(c.u - (a.u + du * t), c.v - (a.v + dv * t)));
  }
  return best < STREAM.w;
}
// T5: THE TREE PLAN — every tree a fresh boot plants, as data: the rim
// treeline, a copse on every hill's flanks, 2-5 drawn copses, 0-2 forests.
// Pure function of the regrown map on its own map-seed stream, so the test
// suite plans the exact trees the game plants. World coordinates out.
export function planTrees() {
  const rT = mulberry32(MAP_SEED ^ 0x517);
  const out = [];
  const roadD = (x, z) => {
    let best = 1e9;
    for (const route of ROADS) for (let i = 0; i + 1 < route.length; i++) {
      const a = route[i], b = route[i + 1];
      const dx = b[0] - a[0], dz = b[1] - a[1];
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
      best = Math.min(best, Math.hypot(x - (a[0] + dx * t), z - (a[1] + dz * t)));
    }
    return best;
  };
  const clearAt = (x, z) => {
    if (rockAt(x, z) || pondAt(x, z) || streamAt(x, z)) return false;
    if (SPAWN_POINTS.some((sp) => Math.hypot(x - sp.x, z - sp.z) < 4.5)) return false;
    if (roadD(x, z) < 3.5) return false;
    const c = invW(x, z);
    if (Math.abs(c.u) > 88 || Math.abs(c.v) > 88) return false;
    for (const t of TOWN) {
      if (Math.abs(x - t.x) < (t.nx * MASON.pitch) / 2 + 1.5 &&
          Math.abs(z - t.z) < (t.nz * MASON.pitch) / 2 + 1.5) return false;
    }
    return true;
  };
  // the rim treeline — the old edge dressing, kept (draws before tests, as before)
  for (let tu = -86; tu <= 86; tu += 3.2) {
    const w = fwdU(tu + (rT() - 0.5) * 1.6, -84.5 + rT() * 3.2);
    if (clearAt(w.x, w.z)) out.push({ x: w.x, z: w.z });
  }
  // a copse on every hill's flanks (the owner's wooded hills) — these RETRY
  // until planted (free stream) so a hill is never bald by bad luck.
  for (const hb of HILLS) {
    const n = 6 + Math.floor(rT() * 4);
    for (let i = 0, got = 0; i < 24 && got < n; i++) {
      const a = rT() * 6.28, rr = hb.r * (0.35 + rT() * 0.75);
      const w = fwdU(hb.u + Math.cos(a) * rr, hb.v + Math.sin(a) * rr);
      if (clearAt(w.x, w.z)) { out.push({ x: w.x, z: w.z }); got++; }
    }
  }
  // drawn copses: 2-5, anywhere clear on the map
  const nCop = 2 + Math.floor(rT() * 4);
  for (let c = 0; c < nCop; c++) {
    const cu = -78 + rT() * 156, cv = -78 + rT() * 156;
    const n = 5 + Math.floor(rT() * 5);
    for (let i = 0; i < n; i++) {
      const a = rT() * 6.28, rr = 1.5 + rT() * 4.5;
      const w = fwdU(cu + Math.cos(a) * rr, cv + Math.sin(a) * rr);
      if (clearAt(w.x, w.z)) out.push({ x: w.x, z: w.z });
    }
  }
  // rare forests: 0-2, 20-40 trees
  const nFor = Math.floor(rT() * 3);
  for (let f = 0; f < nFor; f++) {
    const fu = -72 + rT() * 144, fv = -72 + rT() * 144;
    const n = 20 + Math.floor(rT() * 21);
    for (let i = 0; i < n; i++) {
      const a = rT() * 6.28, rr = 2 + rT() * 9;
      const w = fwdU(fu + Math.cos(a) * rr, fv + Math.sin(a) * rr);
      if (clearAt(w.x, w.z)) out.push({ x: w.x, z: w.z });
    }
  }
  return out;
}
export function computeFlowField(grid, objGx, objGz) {
  const { cells } = grid;
  for (let i = 0; i < cells.length; i++) { cells[i].dist = 1e9; cells[i].dx = 0; cells[i].dz = 0; }
  if (!grid.inBounds(objGx, objGz)) return;
  const q = [{ gx: objGx, gz: objGz }];
  cells[grid.idx(objGx, objGz)].dist = 0;
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
  let head = 0;
  while (head < q.length) {
    const cur = q[head++];
    const cd = cells[grid.idx(cur.gx, cur.gz)].dist;
    for (const d of dirs) {
      const nx = cur.gx + d[0], nz = cur.gz + d[1];
      if (!grid.inBounds(nx, nz)) continue;
      const ni = grid.idx(nx, nz);
      if (cells[ni].blocked) continue;
      if (d[0] !== 0 && d[1] !== 0) {
        if (cells[grid.idx(cur.gx + d[0], cur.gz)].blocked || cells[grid.idx(cur.gx, cur.gz + d[1])].blocked) continue;
      }
      const step = (d[0] !== 0 && d[1] !== 0) ? 1.414 : 1;
      const nd = cd + step * (cells[ni].ice ? 0.72 : 1) * (cells[ni].drop ? 3 : 1);
      if (nd < cells[ni].dist - 1e-6) { cells[ni].dist = nd; q.push({ gx: nx, gz: nz }); }
    }
  }
  // mk1.96: THE SIEGE FLOW (owner — "Leave them a road" expunged). Ground the
  // objective cannot be reached from still owes the assault a direction: the
  // player's own masonry. Every unreachable open cell beside a player claim
  // (blocked, bTeam 1 — walls, towers, the depot's stones) seeds a second
  // flood at a 1e6 base — far under the 1e8 pathable line, far over any real
  // distance, and the two regions are sealed off from each other by
  // definition, so the floods never mix. The march walks its pseudo-flow to
  // the wall's face and halts there (a seed cell's descent rests at zero);
  // the guns, satchels and rams already know the rest. A breach re-floods
  // real distances through the gap on the standing recomputeFlow calls.
  const q2 = [];
  for (let gz = 0; gz < GRID_H; gz++) for (let gx = 0; gx < GRID_W; gx++) {
    const ci = grid.idx(gx, gz);
    if (cells[ci].blocked || cells[ci].dist < 1e8) continue;
    let seed = false;
    for (const d of dirs) {
      const nx = gx + d[0], nz = gz + d[1];
      if (!grid.inBounds(nx, nz)) continue;
      const nc = cells[grid.idx(nx, nz)];
      if (nc.blocked && nc.bTeam === 1) { seed = true; break; }
    }
    if (seed) { cells[ci].dist = 1e6; q2.push({ gx, gz }); }
  }
  head = 0;
  while (head < q2.length) {
    const cur = q2[head++];
    const cd = cells[grid.idx(cur.gx, cur.gz)].dist;
    for (const d of dirs) {
      const nx = cur.gx + d[0], nz = cur.gz + d[1];
      if (!grid.inBounds(nx, nz)) continue;
      const ni = grid.idx(nx, nz);
      if (cells[ni].blocked) continue;
      if (d[0] !== 0 && d[1] !== 0) {
        if (cells[grid.idx(cur.gx + d[0], cur.gz)].blocked || cells[grid.idx(cur.gx, cur.gz + d[1])].blocked) continue;
      }
      const step = (d[0] !== 0 && d[1] !== 0) ? 1.414 : 1;
      const nd = cd + step * (cells[ni].ice ? 0.72 : 1) * (cells[ni].drop ? 3 : 1);
      if (nd < cells[ni].dist - 1e-6) { cells[ni].dist = nd; q2.push({ gx: nx, gz: nz }); }
    }
  }
  for (let gz = 0; gz < GRID_H; gz++) for (let gx = 0; gx < GRID_W; gx++) {
    const ci = grid.idx(gx, gz);
    if (cells[ci].blocked || cells[ci].dist >= 1e8) continue;
    let bestD = cells[ci].dist, bx = 0, bz = 0;
    for (const d of dirs) {
      const nx = gx + d[0], nz = gz + d[1];
      if (!grid.inBounds(nx, nz)) continue;
      const nd = cells[grid.idx(nx, nz)].dist;
      if (nd < bestD) { bestD = nd; bx = d[0]; bz = d[1]; }
    }
    const L = Math.hypot(bx, bz) || 1;
    cells[ci].dx = bx / L; cells[ci].dz = bz / L;
  }
}
export function checkConnectivity(grid, spawns, objGx, objGz) {
  const visited = new Uint8Array(grid.w * grid.h);
  const q = [{ gx: objGx, gz: objGz }];
  visited[grid.idx(objGx, objGz)] = 1;
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  let head = 0;
  while (head < q.length) {
    const cur = q[head++];
    for (const d of dirs) {
      const nx = cur.gx + d[0], nz = cur.gz + d[1];
      if (!grid.inBounds(nx, nz)) continue;
      const ni = grid.idx(nx, nz);
      if (visited[ni] || grid.cells[ni].blocked) continue;
      visited[ni] = 1; q.push({ gx: nx, gz: nz });
    }
  }
  for (const sp of spawns) {
    const g = grid.worldToGrid(sp.x, sp.z);
    if (!grid.inBounds(g.gx, g.gz)) continue;
    if (!visited[grid.idx(g.gx, g.gz)]) return false;
  }
  return true;
}
