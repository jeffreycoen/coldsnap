// COLDSNAP DEPOT — Phase 0/1 playable scaffold. Seeded from
// src/game/ColdsnapTD.jsx (the frozen reference implementation — read it
// before touching this file). Same map/grid/flow-field/build-sell/tower-fire
// skeleton, stripped to what Phase 0/1 ships: no tanks, no mech boss, no
// off-map strikes, no village-protection payouts, flat conscript-only waves.
// Every gameplay rng call runs through world.rng() (mulberry32, seeded with
// the map) — the JS built-in unseeded generator is forbidden here — so runs
// replay exactly from ?seed=.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { MK } from "../version.js";
import {
  makeField, makeWorld, addBody, addWeld, stepWorld, fireProjectile,
  applyDamage, mulberry32,
} from "../engine/core.js";
import { makeRenderer } from "../render/renderer.js";
import { makeGameAudio } from "../platform/audio.js";
import { TOWER_SPECS, TOWER_ORDER, ENEMY_SPECS, MASON, INFANTRY_ARMS } from "./specs.js";
import { windAt } from "./wind.js";
import { makeAssaultState, HUD0, BELL_PERIOD_S, BELL_SCRAP, stepBell, fireBell, nextSpawnTag, withdrawDue, executeWithdrawal, ASSAULT_TIMEOUT, checkLoss, makeEndDispatch, towerShot, friendlyFouls, fieldReaches, effRange, validatePlacement, PENDING_ARM_S, pendingArmed, pendingButtonsVisible, canvasTapConsumesPending, END_CARD_DELAY_S, stampEnd, endCardReady, censusDepotChunks, depotStandingFraction, stepDepotCensus, squadFire, spawnSquadMembers, spawnSandbag, sandbagOrientAt, SANDBAG_COST, WALL_COST, SANDBAG_FIELD_COST, WALL_FIELD_COST, WALL_LAY_PAUSE_S, SANDBAG_HX, SANDBAG_HZ, WALL_HALF, WALL_THIN, spawnWallCourses, wallOrientAt, stepWallSupport, forgetWelds, WALL_UPPER_GROUP, pruneSquads, makeManifestState, makeFoeState, pickManifest } from "./state.js";
import { SQUAD_SPECS, makeSquad, stepSquad, slotBlockedPublic } from "./squads.js";
import { reachPolygon, arcClears, squadReach, towerReachCached } from "./accuracy.js";
import { stepUnits, spawnUnit, stepBreakerRam, payBounties } from "./units.js";
import { makeRegiment, payTown } from "./economy.js";
import { makeTerritory, stepTerritory, holderAt, canBuild, fogStateFor, valueAt, EMIT } from "./territory.js";
import { makeSight, stepSight, seenAt } from "./sight.js";
import { fwdUFor, fwdDirFor, invWFor, clampToRimFor } from "./orient.js";
import { SAVE_KEY, serializeFront, burnFront, restoreBodies, restoreWelds, restoreCensus, restoreSquads } from "./save.js";
import Dispatch from "./Dispatch.jsx";

// ============================================================== the map
// Same 28x56 canonical frame as HOLD THE DEPOT — one field, one depot.
const GRID_CS = 2.0, GRID_W = 28, GRID_H = 56;
const GRID_OX = -(GRID_W * GRID_CS) / 2, GRID_OZ = -(GRID_H * GRID_CS) / 2;
let ORIENT = 0;
// Transform formulas live in orient.js (pure, ORIENT-explicit, headlessly
// testable) — these wrappers just apply them against the module's current
// ORIENT, same call sites/behavior as before.
const fwdU = (u, v) => fwdUFor(ORIENT, u, v);
const fwdDir = (du, dv) => fwdDirFor(ORIENT, du, dv);
const invW = (x, z) => invWFor(ORIENT, x, z);
// THE PLAYABLE RIM, once. buildDepotTerrain's falloff box is 29x57 in
// canonical (u, v) — beyond it there is no ground to stand on, only the
// painted horizon. world.inRim, the renderer's rim descriptor and the order
// clamp below all read THESE two numbers so they cannot drift apart.
const RIM_HALF_U = 29, RIM_HALF_V = 57;
// P1.5 Task 1 (mk0.50): an off-map destination tap becomes the nearest point
// still on the field. The transform itself is orient.js's (pure, testable);
// this is the same thin ORIENT-binding wrapper fwdU/invW are.
const clampToRim = (x, z) => clampToRimFor(ORIENT, x, z, RIM_HALF_U, RIM_HALF_V);
let OBJ_POS = { x: 0, z: 49 };
let SPAWN_POINTS = [], PONDS = [], ROCKS = [], TOWN = [], ROADS = [], PASSES = [], BANDS = [], MAP_SEED = 0, SPAWN_U = [];

function genMap(seed) {
  const r = mulberry32(seed);
  const bands = [-17 + (r() - 0.5) * 6, 7 + (r() - 0.5) * 8, 31 + (r() - 0.5) * 6];
  const passes = bands.map((z) => [{ x: -20 + r() * 13, z }, { x: 5 + r() * 15, z }]);
  const rocks = [];
  for (let bi = 0; bi < bands.length; bi++) {
    const density = 0.35 + r() * 0.65;
    for (let x = -25; x <= 25; x += 5.5 + r() * 3) {
      if (r() > density) continue;
      const z = bands[bi] + (r() - 0.5) * 2.5;
      if (passes[bi].some((g) => Math.abs(x - g.x) < 6.5)) continue;
      rocks.push({ x, z, r: 3.4 + r() * 1.2, h: 3.0 + r() * 0.9 });
    }
  }
  const spawns = [-18 + r() * 5, -3 + r() * 6, 13 + r() * 5].map((x) => ({ x, z: GRID_OZ + 2 }));
  const roads = [0, 1].map((side) => {
    const pts = [[spawns[side === 0 ? 0 : 2].x, GRID_OZ + 2]];
    for (const band of passes) pts.push([band[side].x, band[side].z]);
    pts.push([0, 49]);
    return pts;
  });
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
    const x = -18 + r() * 36, z = -12 + r() * 48, rad = 5.5 + r() * 2.5;
    if (passes.flat().some((g) => Math.abs(x - g.x) < 9 && Math.abs(z - g.z) < 14)) continue;
    if (roadDist(x, z) < rad + 6) continue;
    if (Math.hypot(x - 0, z - 49) < 16) continue;
    if (ponds.some((q) => Math.hypot(x - q.x, z - q.z) < q.r + rad + 6)) continue;
    ponds.push({ x, z, r: rad, level: 0 });
  }
  const TPL = [
    { t: "croft", nx: 4, nz: 3, ny: 3 }, { t: "house", nx: 6, nz: 5, ny: 4 },
    { t: "house", nx: 5, nz: 4, ny: 4 }, { t: "long", nx: 8, nz: 4, ny: 3 },
    { t: "watch", nx: 2, nz: 2, ny: 8 }, { t: "granary", nx: 3, nz: 3, ny: 7 },
    { t: "yard", nx: 6, nz: 5, ny: 2, roof: false }, { t: "shed", nx: 4, nz: 4, ny: 3 },
    { t: "chapel", nx: 5, nz: 6, ny: 5 }, { t: "keep", nx: 7, nz: 6, ny: 5 },
  ];
  // FRONT F1: the enemy depot — same lattice as ours (symmetry), centered on
  // the enemy end behind the spawn line's midpoint gap. Canonical (0, -46):
  // spawns sit at v = -54, roads run from them THROUGH the passes toward
  // (0, 49) — at v = -46 the two roads are still near their spawn-x origins
  // (|x| >= ~3 by construction), and the depot footprint (9*0.83/2 ≈ 3.7m
  // half-width) needs the road-clearance check below regardless: makeMap's
  // existing retry loop re-rolls the seed when the placement is fouled.
  const town = [
    { id: "depot", x: 0, z: 52, nx: 9, nz: 7, ny: 6, door: 4, depot: true },
    { id: "depot2", x: 0, z: -46, nx: 9, nz: 7, ny: 6, door: 4, depot: true, team: 2 }, // provisional (F5)
  ];
  // depot2 placement clearance: fouled by a road or a spawn -> flag the map
  // bad; makeMap's retry loop (the same one that re-rolls on failed
  // connectivity) rolls a fresh seed. No second loop, no extra rng draws.
  const d2 = town[1];
  const d2HalfDiag = Math.hypot(d2.nx, d2.nz) * MASON.pitch / 2;
  const depot2Foul =
    roadDist(d2.x, d2.z) <= d2HalfDiag + 2 ||
    spawns.some((sp) => Math.hypot(d2.x - sp.x, d2.z - sp.z) < d2HalfDiag + 2) ||
    ponds.some((q) => Math.hypot(d2.x - q.x, d2.z - q.z) < q.r + d2HalfDiag) ||
    rocks.some((q) => Math.hypot(d2.x - q.x, d2.z - q.z) < q.r + d2HalfDiag);
  const benches = [[bands[0] + 8, bands[1] - 7], [bands[1] + 8, bands[2] - 7], [bands[2] + 8, 46]];
  let bid = 0;
  for (let bi = 0; bi < benches.length; bi++) {
    const want = 2 + Math.floor(r() * 4);
    for (let k = 0, placed = 0; k < 90 && placed < want; k++) {
      const tpl = TPL[Math.floor(r() * TPL.length)];
      const swap = r() < 0.5;
      const nx = swap ? tpl.nz : tpl.nx, nz = swap ? tpl.nx : tpl.nz;
      const x = -21 + r() * 42;
      const z = benches[bi][0] + r() * Math.max(2, benches[bi][1] - benches[bi][0]);
      const rad = Math.max(nx, nz) * MASON.pitch / 2 + 2;
      if (passes.flat().some((g) => Math.abs(x - g.x) < rad + 4 && Math.abs(z - g.z) < 12)) continue;
      if (ponds.some((q) => Math.hypot(x - q.x, z - q.z) < q.r + rad + 3)) continue;
      if (rocks.some((q) => Math.hypot(x - q.x, z - q.z) < q.r + rad + 1.5)) continue;
      if (town.some((q) => Math.hypot(x - q.x, z - q.z) < rad + Math.max(q.nx, q.nz) * MASON.pitch / 2 + 2.5)) continue;
      const decay = r() < 0.2 ? 0.12 + r() * 0.3 : 0;
      town.push({ id: tpl.t + bid++, x, z, nx, nz, ny: tpl.ny, door: r() < 0.5 ? 0 : nx - 1, roof: tpl.roof, ruin: decay || undefined });
      placed++;
    }
  }
  const nRuin = Math.floor(r() * 3);
  for (let k = 0, placed = 0; k < 14 && placed < nRuin; k++) {
    const x = -18 + r() * 36, z = -46 + r() * 20;
    if (spawns.some((sp) => Math.hypot(x - sp.x, z - sp.z) < 10)) continue;
    if (town.some((q) => Math.hypot(x - q.x, z - q.z) < 10)) continue;
    town.push({ id: "oldruin" + placed, x, z, nx: 4, nz: 4, ny: 3, door: 0, ruin: 0.5 });
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
  return { seed, bands, passes, rocks, ponds, spawns, spawnU, town, roads, depot2Foul };
}
function makeMap(seed) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const sd = seed + attempt * 7919;
    ORIENT = sd % 4;
    OBJ_POS = fwdU(0, 49);
    const m = genMap(sd);
    MAP_SEED = sd; BANDS = m.bands; PASSES = m.passes; ROCKS = m.rocks;
    PONDS = m.ponds; SPAWN_POINTS = m.spawns; TOWN = m.town; ROADS = m.roads;
    SPAWN_U = m.spawnU;
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
    // FRONT F1: the map must also let every spawn reach the enemy depot's
    // doorway (canonical (0, -51), just outside depot2's door face) — the
    // enemy must be able to defend home ground later (guards F3).
    const d2door = fwdU(0, -51);
    const dg = g.worldToGrid(d2door.x, d2door.z);
    if (TOWN.length >= 6 && !m.depot2Foul &&
        checkConnectivity(g, SPAWN_POINTS, og.gx, og.gz) &&
        checkConnectivity(g, SPAWN_POINTS, dg.gx, dg.gz)) return;
  }
}

function buildDepotTerrain(field, seed = 11) {
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
      + (r() - 0.5) * 0.06
      + stepUp(BANDS[0] - 1, 10, 1.8) + stepUp(BANDS[1] - 1, 10, 2.0) + stepUp(BANDS[2] - 1, 10, 2.2);
    const over = Math.max(0, Math.abs(cuv.u) - 29, Math.abs(cuv.v) - 57);
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
    const rad = Math.hypot(t.nx, t.nz) * MASON.pitch / 2 + 2.0;
    const ph = h[Math.round((t.z + half) / cs) * n + Math.round((t.x + half) / cs)];
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = i * cs - half, z = j * cs - half;
      const d = Math.hypot(x - t.x, z - t.z);
      if (d >= rad) continue;
      h[j * n + i] += (ph - h[j * n + i]) * Math.min(1, (rad - d) / 1.8);
    }
  }
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = i * cs - half, z = j * cs - half;
    const d = Math.hypot(x - OBJ_POS.x, z - OBJ_POS.z);
    if (d < 9) {
      const t = Math.min(1, (9 - d) / 4.5);
      const ph = 2.0 + 1.8 + 2.0 + 2.2 + 0.5;
      h[j * n + i] += (ph - h[j * n + i]) * t;
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
function pondAt(x, z) { for (const p of PONDS) if (Math.hypot(x - p.x, z - p.z) < p.r) return p; return null; }
function rockAt(x, z) { for (const k of ROCKS) if (Math.hypot(x - k.x, z - k.z) < k.r * 0.78) return k; return null; }

// ========================================================== grid + flow
function makeGrid(field) {
  const cells = new Array(GRID_W * GRID_H);
  for (let i = 0; i < cells.length; i++) cells[i] = { blocked: false, terrain: false, ice: false, dx: 0, dz: 0, dist: 1e9, wallId: null };
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
    else if (pondAt(wp.x, wp.z)) c.ice = true;
  }
  return G;
}
function computeFlowField(grid, objGx, objGz) {
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
      const nd = cd + step * (cells[ni].ice ? 0.72 : 1);
      if (nd < cells[ni].dist - 1e-6) { cells[ni].dist = nd; q.push({ gx: nx, gz: nz }); }
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
function checkConnectivity(grid, spawns, objGx, objGz) {
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

// ================================================================ towers
export function stepTowers(world, T, discipline) {
  const dt = world.dt;
  for (const b of world.bodies) {
    if (b.kind !== "tower" || !b.alive) continue;
    // COMMAND T1 (mk0.80): fire discipline is per tower now — the radial
    // sets b.discipline; the old argument is the fallback for bodies that
    // predate the field (old saves, bare fixtures).
    const disc = b.discipline || discipline || "careful";
    const spec = TOWER_SPECS[b.towerType] || TOWER_SPECS.gun;
    if (spec.fireRate <= 0) continue;
    b.fireCd = (b.fireCd || 0) - dt;
    // effRange: towers don't move, so this is computed once at build time
    // (buildAt below) and cached on the body — b.effRange falls back to
    // spec.range for any tower predating that cache (shouldn't happen, but
    // keeps old saves/tests that construct tower bodies directly working).
    const eR = b.effRange != null ? b.effRange : spec.range;
    const muzzle = { x: b.pos.x, y: b.pos.y + b.hy + 0.45, z: b.pos.z };
    let best = b.targetId ? world.byId.get(b.targetId) : null;
    if (best && (!best.alive || best.team !== 2 || (best.kind !== "unit" && best.kind !== "vehicle"))) best = null;
    if (best) {
      const dx = best.pos.x - b.pos.x, dz = best.pos.z - b.pos.z;
      if (dx * dx + dz * dz > eR * eR) best = null;
    }
    // Targeting gate (symmetric with the attacker's own check in units.js):
    // a tower may only acquire/keep a target OUR SIDE CAN SEE (VISION
    // mk0.72 — fieldReaches reads the sight map now, not ground control),
    // AND where its own round's flight path (arc for mg/gun, muzzle
    // climb-out only for mortar/rocket) actually clears the terrain — a
    // sticky target that has walked into dead ground, or that a rock has
    // since risen between, is dropped right here so "next rescan" is
    // immediate. The tower is itself an eye (sight.js SIGHT.tower), and a
    // tall one: it often sees ground its own guns cannot reach.
    if (best) { const c = invW(best.pos.x, best.pos.z); if (!fieldReaches(T, c.u, c.v, 1)) best = null; }
    if (best && !arcClears(world, muzzle, best.pos, spec, b.id)) best = null;
    b.scanCd = (b.scanCd || 0) - dt;
    if (!best && b.scanCd <= 0) {
      b.scanCd = 0.11 + (b.id % 8) * 0.011;
      let bd = eR * eR;
      for (const e of world.bodies) {
        if ((e.kind !== "unit" && e.kind !== "vehicle") || !e.alive || e.team !== 2) continue;
        const c = invW(e.pos.x, e.pos.z);
        if (!fieldReaches(T, c.u, c.v, 1)) continue;
        const dx = e.pos.x - b.pos.x, dz = e.pos.z - b.pos.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < bd && arcClears(world, muzzle, e.pos, spec, b.id)) { bd = d2; best = e; }
      }
    }
    b.targetId = best ? best.id : null;
    if (!best || b.fireCd > 0) continue;
    // CAREFUL discipline: a shot whose flight path would hit our own wall/
    // tower/town chunk holds the trigger pull (cadence still resets — keeps
    // the target, retries next cadence; target movement usually clears it).
    // Enemy fire (units.js) never runs this check.
    if (disc !== "free" && friendlyFouls(world, muzzle, best.pos, spec, b.id)) {
      b.fireCd = spec.fireRate;
      continue;
    }
    b.fireCd = spec.fireRate;
    b.flashT = world.t;
    towerShot(world, b, best, spec);
  }
}

// ================================================================== town
// The depot itself lives in TOWN (see genMap) — this machinery stays even
// though village-protection payouts (Phase-later scripting) do not.
// townFootprint(grid, t): which grid cells one TOWN entry stands on. Pulled
// out of buildTown so the SAVE's restore path can recompute the identical
// footprint without re-laying a single stone (the stones come back off the
// save; only the grid bookkeeping has to be redone).
function townFootprint(grid, t) {
  const cells = [];
  const hx = (t.nx * MASON.pitch) / 2, hz = (t.nz * MASON.pitch) / 2;
  for (let gz = 0; gz < GRID_H; gz++) for (let gx = 0; gx < GRID_W; gx++) {
    const wp = grid.gridToWorld(gx, gz);
    if (Math.abs(wp.x - t.x) < hx + 1.0 && Math.abs(wp.z - t.z) < hz + 1.0) {
      if (Math.hypot(wp.x - OBJ_POS.x, wp.z - OBJ_POS.z) < 5) continue;
      cells.push(grid.idx(gx, gz));
    }
  }
  return cells;
}
function buildTown(world, grid, field) {
  const { hcs, pitch, mass, breakF } = MASON;
  const out = [];
  for (const t of TOWN) {
    const grid3 = [], base = field.heightAt(t.x, t.z) + hcs + 0.02;
    for (let ix = 0; ix < t.nx; ix++) for (let iy = 0; iy <= t.ny; iy++) for (let iz = 0; iz < t.nz; iz++) {
      const perim = ix === 0 || ix === t.nx - 1 || iz === 0 || iz === t.nz - 1;
      const corner = (ix <= 1 || ix >= t.nx - 2) && (iz <= 1 || iz >= t.nz - 2);
      if (iy < t.ny && !perim) continue;
      if (iy === t.ny && t.roof === false) continue;
      if (ix === t.door && (iz === 1 || iz === 2) && iy <= 2) continue;
      if (t.depot && iy === t.ny && perim && !corner && (ix + iz) % 2) continue;
      if (t.ruin && ((ix * 31 + iy * 17 + iz * 7) % 100) / 100 < t.ruin && iy > 0) continue;
      const c = addBody(world, {
        kind: "chunk", team: 0, mass, hx: hcs, hy: hcs, hz: hcs,
        x: t.x + (ix - (t.nx - 1) / 2) * pitch,
        y: base + iy * pitch,
        z: t.z + (iz - (t.nz - 1) / 2) * pitch,
        friction: 0.65, restitution: 0.02,
      });
      c.sleeping = true;
      c.town = t.id;
      c.gpos = [ix, iy, iz];
      grid3.push(c);
    }
    if (t.depot) for (const [bx, bz] of [[0, 0], [t.nx - 1, 0], [0, t.nz - 1], [t.nx - 1, t.nz - 1]]) {
      for (let iy = t.ny + 1; iy <= t.ny + 2; iy++) {
        const c = addBody(world, {
          kind: "chunk", team: 0, mass, hx: hcs, hy: hcs, hz: hcs,
          x: t.x + (bx - (t.nx - 1) / 2) * pitch,
          y: base + iy * pitch,
          z: t.z + (bz - (t.nz - 1) / 2) * pitch,
          friction: 0.65, restitution: 0.02,
        });
        c.sleeping = true; c.town = t.id; c.gpos = [bx, iy, bz];
        grid3.push(c);
      }
    }
    const key = (a, b, c2) => a + "," + b + "," + c2;
    const map = new Map(grid3.map((c) => [key(c.gpos[0], c.gpos[1], c.gpos[2]), c]));
    const townBreakF = t.depot ? breakF * 1.5 : breakF; // the depot is built like it matters
    for (const c of grid3) {
      const g = c.gpos;
      for (const d of [[1, 0, 0], [0, 1, 0], [0, 0, 1]]) {
        const o = map.get(key(g[0] + d[0], g[1] + d[1], g[2] + d[2]));
        if (o) addWeld(world, c, o, townBreakF);
      }
    }
    const cells = townFootprint(grid, t);
    for (const ci of cells) { const c = grid.cells[ci]; c.blocked = true; c.building = t.id; }
    if (t.depot) {
      // roof-peak flag anchor: kinematic marker body, no collision role —
      // the renderer draws pole+cloth at any body with flagPole === true
      const fx = t.x, fz = t.z;
      const flag = addBody(world, {
        kind: "flag", team: t.team || 1, mass: 0, hx: 0.05, hy: 0.05, hz: 0.05,
        x: fx, y: base + (t.ny + 2.6) * pitch, z: fz,
      });
      flag.sleeping = true; flag.flagPole = true;
    }
    out.push({ id: t.id, cells, stones: grid3, n0: grid3.length, ruined: false, x: t.x, z: t.z });
  }
  return out;
}
function stepTown(world, grid, town, onRuin) {
  for (const b of town) {
    if (b.ruined) continue;
    let standing = 0;
    for (const s of b.stones) if (world.byId.has(s.id) && s.sleeping) standing++;
    if (standing > b.n0 * 0.66) continue;
    b.ruined = true;
    for (const ci of b.cells) { const c = grid.cells[ci]; c.blocked = false; c.building = null; }
    world.events.push({ type: "collapse", x: b.x, y: world.field.heightAt(b.x, b.z) + 2, z: b.z });
    if (onRuin) onRuin(b);
  }
}

// =============================================================== masonry
const STONE = 0.30;
const STONE_PITCH = 0.63;
function shatterStructure(world, b, opts) {
  const NX = 3, NY = (opts && opts.ny) || 3, NZ = 3;
  const grid = [], base = b.pos.y - b.hy;
  for (let ix = 0; ix < NX; ix++) for (let iy = 0; iy < NY; iy++) for (let iz = 0; iz < NZ; iz++) {
    const c = addBody(world, {
      kind: "chunk", team: 0, mass: 88, hx: STONE, hy: STONE, hz: STONE,
      x: b.pos.x + (ix - (NX - 1) / 2) * STONE_PITCH,
      y: base + STONE + iy * STONE_PITCH,
      z: b.pos.z + (iz - (NZ - 1) / 2) * STONE_PITCH,
      friction: 0.65, restitution: 0.02,
    });
    c.gpos = [ix, iy, iz];
    c.bornT = world.t;
    grid.push(c);
  }
  const key = (a, b2, c2) => a + "," + b2 + "," + c2;
  const map = new Map(grid.map((c) => [key(c.gpos[0], c.gpos[1], c.gpos[2]), c]));
  for (const c of grid) {
    const g = c.gpos;
    for (const d of [[1, 0, 0], [0, 1, 0], [0, 0, 1]]) {
      const o = map.get(key(g[0] + d[0], g[1] + d[1], g[2] + d[2]));
      if (o) addWeld(world, c, o, 1.8e4);
    }
  }
  return grid;
}

// =============================================================== enemies
// March + combat driver — full roster (conscript/runner/breaker/grenadier/
// sapper/tank). Lives in src/depot/units.js; DepotGame just supplies the
// flow field and the orientation-aware fwdDir (ORIENT is module-local here,
// so units.js can't reimplement it without drifting).
function stepEnemies(world, grid, T) {
  stepUnits(world, grid, fwdDir, T, invW);
}

// ================================================================assaults
function makeDepotAssaultState() { return makeAssaultState(); }
// Bell countdown readout: m:ss, ceiling-rounded so the chip reads 0:01 for
// the whole final second rather than blinking 0:00 early.
function clockStr(s) {
  const t = Math.max(0, Math.ceil(s || 0));
  return Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0");
}
function spawnEnemy(world, sp, tag) {
  return spawnUnit(world, sp, tag);
}

// ================================================================== step
// Team-1 infantry uprighting — same quaternion-settle snippet units.js's
// stepUnits applies to team-2 marchers (which deliberately skips team 1).
// Without it a member shoved by a blast stays toppled forever; squads.js is
// movement-pure (goal seeking only) and owns no engine-orientation state.
function uprightMember(u, dt) {
  const supported = u.grounded || Math.abs(u.v.y) < 0.6;
  if (!supported || u.R[4] <= -0.5) return;
  if (u.R[4] < 0.995) {
    const yaw2 = Math.atan2(u.R[6], u.R[8]) * 0.5;
    const ty = Math.sin(yaw2), tw = Math.cos(yaw2);
    const a = Math.min(1, 14 * dt);
    const sgn = u.q.y * ty + u.q.w * tw < 0 ? -1 : 1;
    u.q.x += (0 - u.q.x) * a; u.q.y += (ty * sgn - u.q.y) * a;
    u.q.z += (0 - u.q.z) * a; u.q.w += (tw * sgn - u.q.w) * a;
    const L2 = Math.hypot(u.q.x, u.q.y, u.q.z, u.q.w) || 1;
    u.q.x /= L2; u.q.y /= L2; u.q.z /= L2; u.q.w /= L2;
  }
  u.w.x *= 1 - Math.min(1, 6 * dt); u.w.z *= 1 - Math.min(1, 6 * dt);
}

function stepDepot(world, grid, onStructureLost, town, onRuin, T, discipline, S) {
  stepEnemies(world, grid, T);
  // Squads (Phase 5 Task 3), after enemies, before towers — the brief's
  // loop-order contract: prune dead members -> delete empty squads ->
  // stepSquad (movement) -> squadFire (combat). squadFire threads T + invW
  // so player squads fog-gate on the SAME field towers do (team 1).
  if (S && S.squads) {
    S.squads = pruneSquads(world, S.squads);
    if (S.selSquadId != null && !S.squads.some((q) => q.id === S.selSquadId)) { S.selSquadId = null; S.orderMode = null; S.buildPt0 = null; }
    // VISION T4 (mk0.74, owner's ruling): an attacking squad that SEES an
    // enemy in weapon reach halts and fights — the halt is the squad's own
    // leg-pause field held open, so the fire rule and the leg machinery are
    // untouched and no rng is drawn. MOVE and BUILD stay quiet; sappers
    // never halt for men (their attack is the charge, not the rifle).
    // Throttled like every scan in this codebase; deterministic.
    const ENGAGE_CHECK_S = 0.2, ENGAGE_HOLD_S = 0.35;
    const engageCheck = (sq) => {
      if (sq.order !== "attack" || sq.type === "sappers" || sq.type === "engineers") return;
      sq._engageCd = (sq._engageCd || 0) - world.dt;
      if (sq._engageCd > 0) return;
      sq._engageCd = ENGAGE_CHECK_S;
      const arms = INFANTRY_ARMS[sq.type];
      if (!arms) return;
      const R2 = arms.range * arms.range;
      for (const e of world.bodies) {
        if ((e.kind !== "unit" && e.kind !== "vehicle") || !e.alive || e.team !== 2) continue;
        const dx = e.pos.x - sq.anchor.x, dz = e.pos.z - sq.anchor.z;
        if (dx * dx + dz * dz > R2) continue;
        const c = invW(e.pos.x, e.pos.z);
        if (!fieldReaches(T, c.u, c.v, 1)) continue;
        sq._pauseT = Math.max(sq._pauseT || 0, ENGAGE_HOLD_S);  // hold the halt open
        return;
      }
    };
    for (const sq of S.squads) {
      engageCheck(sq);
      stepSquad(world, sq, world.dt);
      // P1.5 T4: the two-point build line, driven straight after the squad's
      // own movement so the accumulator reads THIS tick's anchor. It lives in
      // the game layer (S.stepBuildLine, installed by the mount effect below)
      // because it spends scrap and places bodies — both barred from
      // squads.js by that module's law. Squads with no job cost one test.
      if (sq._build && S.stepBuildLine) S.stepBuildLine(sq);
      squadFire(world, sq, world.dt, T, invW);
      for (const id of sq.memberIds) {
        const u = world.byId.get(id);
        if (u && u.alive) uprightMember(u, world.dt);
      }
    }
  }
  stepTowers(world, T, discipline);
  world.wind = windAt(MAP_SEED, world.t);
  stepWorld(world);
  stepBreakerRam(world); // heavies (breakers) ram walls/towers — TD's ColdsnapTD.jsx :964-972
  for (let i = world.bodies.length - 1; i >= 0; i--) {
    const b = world.bodies[i];
    if ((b.kind === "wall" || b.kind === "tower") && !b.alive) {
      // A wall COURSE is a third of a wall, so it breaks into a third of the
      // rubble (one 3x3 layer instead of three) — a three-course wall coming
      // down leaves exactly the 27 stones the old single-body wall left.
      shatterStructure(world, b, { ny: b.kind === "tower" ? 4 : (b.course != null ? 1 : 3) });
      world.events.push({ type: "structureLost", id: b.id, kind: b.kind, course: b.course != null ? b.course : -1 });
      forgetWelds(world, b);
      world.byId.delete(b.id); world.bodies.splice(i, 1);
      if (onStructureLost) onStructureLost(b);
    }
  }
  // THE SUPPORT RULE (P1.5 T2): straight after the dead structures are gone,
  // so a course that lost its footing this tick finds nothing under it and
  // comes down for real. Game-layer only — the engine knows nothing about it.
  stepWallSupport(world);
  payBounties(world);
  for (let i = world.bodies.length - 1; i >= 0; i--) {
    const b = world.bodies[i];
    if (b.kind === "unit" && !b.alive && world.t - (b.deadT || 0) > 2.5) { world.byId.delete(b.id); world.bodies.splice(i, 1); }
    else if (b.kind === "chunk" && !b.town && b.sleeping && b.bornT && world.t - b.bornT > 14) {
      const wl = world.weldsOf.get(b.id);
      if (wl) for (const wd of wl) wd.broken = true;
      world.weldsOf.delete(b.id);
      world._weldPairsDirty = true;
      world.byId.delete(b.id); world.bodies.splice(i, 1);
    }
  }
  if (town) stepTown(world, grid, town, onRuin);
  // FRONT F1: no leak check — an enemy at the depot stays and chews masonry.
}

// ============================================================== component
function detectTouch() {
  return (typeof window !== "undefined") && ("ontouchstart" in window || (navigator.maxTouchPoints || 0) > 0);
}
const P = {
  root: { position: "fixed", inset: 0, background: "#0e1218", overflow: "hidden", fontFamily: "ui-monospace, Menlo, Consolas, monospace", color: "#e6ebf1", userSelect: "none", WebkitUserSelect: "none", touchAction: "none" },
  cv: { position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" },
  top: { position: "absolute", top: 0, left: 0, right: 0, display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "linear-gradient(rgba(10,13,18,0.88), rgba(10,13,18,0))", zIndex: 4, fontSize: 12, flexWrap: "wrap" },
  panel: { position: "absolute", background: "rgba(14,18,24,0.88)", border: "1px solid #48515f", borderRadius: 8, padding: 10, fontSize: 12, zIndex: 5 },
  btn: { background: "#1a212b", border: "1px solid #48515f", color: "#e6ebf1", borderRadius: 6, padding: "4px 10px", fontFamily: "inherit", fontSize: 12, cursor: "pointer" },
  // mk0.28: the in-world taps (squad order chips, the ✓/✗ confirm pair) are
  // the ones a thumb has to find mid-game — ~1.5x the chrome button, and at
  // least the 44px touch target every phone guideline asks for.
  btnBig: { background: "#1a212b", border: "1px solid #48515f", color: "#e6ebf1", borderRadius: 8, padding: "10px 16px", fontFamily: "inherit", fontSize: 15, lineHeight: "20px", minHeight: 44, minWidth: 44, cursor: "pointer" },
  stat: { display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", background: "rgba(20,26,34,0.75)", border: "1px solid #303a48", borderRadius: 6 },
  bar: { position: "absolute", left: 0, right: 0, bottom: 0, display: "flex", gap: 6, padding: "8px 8px calc(8px + env(safe-area-inset-bottom, 0px))", justifyContent: "center", background: "linear-gradient(rgba(10,13,18,0), rgba(10,13,18,0.9))", zIndex: 4, flexWrap: "wrap" },
  slot: { display: "flex", flexDirection: "column", alignItems: "center", gap: 2, minWidth: 64, minHeight: 52, padding: "8px 10px", background: "#1a212b", border: "1px solid #48515f", borderRadius: 8, fontSize: 12, cursor: "pointer" }, // mk0.28: wider/taller build slots — bottom bar, thumb reach
  ovl: { position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(10,13,18,0.72)", zIndex: 8, textAlign: "center", padding: 20 },
  toastWrap: { position: "absolute", top: 54, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, zIndex: 6, pointerEvents: "none" },
  // The manifest card's parking spot: top-right, under the top bar, mirroring
  // the intel card's top-left (Dispatch.jsx's `float`). pointerEvents none on
  // the wrapper — only the card box itself takes taps, so the battle behind it
  // keeps every pixel it isn't actually covering.
  cardWrap: { position: "absolute", top: 52, right: 10, zIndex: 6, pointerEvents: "none" },
  toast: { background: "rgba(14,18,24,0.92)", border: "1px solid #ffb45e", color: "#ffd9a0", borderRadius: 6, padding: "4px 12px", fontSize: 12 },
};

// COMMAND 1b (mk0.82): THE PIE. One disc of wedges around the selected
// thing. Equal sectors, twelve o'clock first, hole in the middle so the
// unit stays visible. Choosing ANY wedge closes the pie (the owner's rule:
// the screen must be free for the follow-up taps an order needs) — every
// wedge's onClick runs its action, then onChoose (the call site sets
// S.pieOpen = false there), one mechanism for every slot rather than
// repeating a close in each act.
function RadialMenu({ cx, cy, label, slots, armed, onChoose }) {
  const N = slots.length, R0 = 36, R1 = 104;
  const wedge = (i) => {
    const a0 = -Math.PI / 2 + (i - 0.5) * (2 * Math.PI / N);
    const a1 = a0 + 2 * Math.PI / N;
    const p = (r, a) => `${cx + Math.cos(a) * r},${cy + Math.sin(a) * r}`;
    const large = (2 * Math.PI / N) > Math.PI ? 1 : 0;
    return `M ${p(R0, a0)} A ${R0} ${R0} 0 ${large} 1 ${p(R0, a1)} L ${p(R1, a1)} A ${R1} ${R1} 0 ${large} 0 ${p(R1, a0)} Z`;
  };
  return (
    <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 7, pointerEvents: "none", overflow: "visible" }}>
      {slots.map((s, i) => {
        const mid = -Math.PI / 2 + i * (2 * Math.PI / N);
        const lx = cx + Math.cos(mid) * 72, ly = cy + Math.sin(mid) * 72;
        return (
          <g key={s.key} data-radial={s.key} style={{ pointerEvents: "auto", cursor: "pointer" }} onClick={() => { s.act(); onChoose && onChoose(); }} opacity={armed ? 1 : 0.5}>
            {/* mk0.83 (owner: "green text on green background is illegible"):
                the wedge keeps its dark panel fill even when lit — the lit
                state is the accent BORDER and a faint tint, and every label
                paints a dark halo under itself (paintOrder stroke) so it
                reads on any fill, any terrain. */}
            <path d={wedge(i)} fill="rgba(14,18,24,0.88)" stroke={s.on ? s.color : "#48515f"} strokeWidth={s.on ? 2.5 : 1.5} />
            {s.on && <path d={wedge(i)} fill={s.color} fillOpacity="0.14" stroke="none" />}
            <text x={lx} y={ly - 4} textAnchor="middle" fontSize="15" fill={s.color} stroke="#0e1218" strokeWidth="3" paintOrder="stroke" style={{ userSelect: "none" }}>{s.icon || ""}</text>
            <text x={lx} y={ly + 12} textAnchor="middle" fontSize="10" letterSpacing="1" fill={s.color} stroke="#0e1218" strokeWidth="3" paintOrder="stroke" fontFamily="inherit" style={{ userSelect: "none" }}>{s.label}</text>
          </g>
        );
      })}
      <foreignObject x={cx - 60} y={cy + R1 + 6} width="120" height="40" style={{ pointerEvents: "none", overflow: "visible" }}>
        <div style={{ textAlign: "center" }}>
          <span style={{ fontSize: 10, letterSpacing: 1, color: "#7dffa8", background: "rgba(14,18,24,0.85)", padding: "1px 6px", borderRadius: 4 }}>{label}</span>
        </div>
      </foreignObject>
    </svg>
  );
}

// The build palette, in bar order — every buildable the match can ever offer.
// Keys are the mode keys tapAt/setMode dispatch on and, since P1 Task 2, the
// exact keys specs.js's PLAYER_START/PLAYER_TIERS ladder is written in, so the
// unlocked filter below is a plain membership test.
const PALETTE = [
  // The wall price lives in state.js (WALL_COST) — the bar label and buildAt's
  // fallback both read it, so the number exists once (mk0.50).
  { key: "wall", label: "WALL", icon: "▦", cost: WALL_COST },
  ...TOWER_ORDER.map((k) => ({ key: k, label: TOWER_SPECS[k].label, icon: TOWER_SPECS[k].icon, cost: TOWER_SPECS[k].cost })),
  // Squads (Phase 5 Task 3): mode keys prefixed sq_ — the MG tower owns "mg"
  { key: "sq_sniper", label: "SNIPER", icon: "✛", cost: SQUAD_SPECS.sniper.cost },
  { key: "sq_rifles", label: "RIFLES", icon: "∴", cost: SQUAD_SPECS.rifles.cost },
  { key: "sq_mg", label: "MG TEAM", icon: "≣", cost: SQUAD_SPECS.mg.cost },
  // F1 Task 4.5: the demolition team — the only player weapon that moves
  // reinforced depot masonry (rifles measured at zero).
  { key: "sq_sappers", label: "SAPPERS", icon: "✸", cost: SQUAD_SPECS.sappers.cost },
  // F1.5 Task 1: the mortar team — selection shows squadReach's lofted
  // near-circle fan (accuracy.js handles occl "lofted" already).
  { key: "sq_mortars", label: "MORTAR TEAM", icon: "◎", cost: SQUAD_SPECS.mortars.cost },
  // P1.5 T4: the engineer team — in the starting kit, so this slot is on the
  // bar from the first frame of every match.
  { key: "sq_engineers", label: "ENGINEERS", icon: "⚒", cost: SQUAD_SPECS.engineers.cost },
  { key: "sandbag", label: "SANDBAG", icon: "▬", cost: SANDBAG_COST },
];
const PALETTE_BY_KEY = Object.fromEntries(PALETTE.map((p) => [p.key, p]));
const PALETTE_LABEL = Object.fromEntries(PALETTE.map((p) => [p.key, p.label]));

// `resume` (P1 Task 3): a PARSED save object, or null for a fresh front. The
// start screen does the async probe and the mark check (save.js's probeFront)
// and hands the data down already validated, so this mount effect stays
// synchronous — a boot that awaited storage mid-construction would be a world
// half-built for however long the read took.
export default function DepotGame({ onExit, resume = null }) {
  const canvasRef = useRef(null);
  const stateRef = useRef(null);
  // Held in a ref, not read from props inside the effect, for the same reason
  // every other loop input is: the effect must never close over a value React
  // can change under it. Captured once, at mount.
  const resumeRef = useRef(resume);
  const [isTouch] = useState(detectTouch);
  const [hud, setHud] = useState(HUD0);
  const [fatal, setFatal] = useState(null);
  const [runId, setRunId] = useState(0);
  const [rereadDispatch, setRereadDispatch] = useState(false);
  const restart = () => { setFatal(null); setHud({ ...HUD0 }); setRunId((r) => r + 1); };
  // mk0.29 — THE DEAD BUTTON, diagnosed: makeEndDispatch() was called inline
  // in the render, so every HUD tick (~8Hz) handed Dispatch a brand-new
  // object. Dispatch's arming effect keys on [dispatch] and re-arms over
  // 500ms, so the timer restarted every 120ms and RETURN TO BASE never armed
  // — permanently disabled, exactly as it played. Memoized on the values the
  // card actually shows, so the reference is stable and the arm completes.
  // (The between-wave card was always fine: its dispatch is a stable object
  // carried on state.)
  const endDispatch = useMemo(
    () => (hud.gameOver || hud.victory ? makeEndDispatch({ victory: hud.victory, kills: hud.kills }) : null),
    [hud.gameOver, hud.victory, hud.kills],
  );
  // mk0.29 — leaving a live battle is a two-tap decision (the NEW CAMPAIGN
  // pattern): first tap arms, five seconds of silence disarms.
  const [menuArmed, setMenuArmed] = useState(false);
  useEffect(() => {
    if (!menuArmed) return;
    const t = setTimeout(() => setMenuArmed(false), 5000);
    return () => clearTimeout(t);
  }, [menuArmed]);
  // mk0.34 — DRAW RATE. Touch draws every other frame by default; the sim is
  // untouched either way (see the frame loop). The ref is what the loop boots
  // from — the loop effect must not re-key on this, or toggling would restart
  // the run — and the state is only the button's label. Persisted through
  // window.storage (the artifact/Pages shim), NOT the localStorage the fog
  // and discipline toggles use, per the settings-restore discipline in
  // platform/autosave.js: the default writes nothing, so a saved choice can
  // never be clobbered before the async restore lands, and only a real toggle
  // saves.
  // The 30fps draw toggle is GONE (Jeff, 2026-08-12, off the mk0.50 evidence
  // run): drawing is ~5ms flat in every scenario and physics is the whole
  // cost, so halving draws bought visible stutter for ~1ms. Stale
  // "coldsnap-depot-fps" storage keys are simply ignored.

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let raf = 0, disposed = false;
    let R = null;
    try {
      // ------------------------------------------------------- THE BOOT ORDER
      // RES non-null means this mount is a RESUME (P1 Task 3) — the start
      // screen handed us a parsed save. The order below is the contract, and
      // it is the order the save was written against; nothing in the game
      // layer runs until every line of it has:
      //   1. makeMap(saved seed) — ORIENT, ROCKS, PONDS, TOWN, ROADS, SPAWNS
      //      all regrow from the seed (the map is never serialized)
      //   2. buildDepotTerrain, THEN the saved heightfield over the top —
      //      craters and breached ridges are what the war did to the terrain
      //   3. the grid off that terrain, then the world, reseeded + re-clocked
      //   4. bodies -> welds -> town bookkeeping -> censuses -> grid claims
      //   5. territory field, squads, run state
      //   6. flow field, renderer, smear replay
      // Only then does the frame loop start.
      const RES = resumeRef.current;
      const urlSeed = parseInt(new URLSearchParams(window.location.search).get("seed"), 10);
      const seed = RES ? RES.map.seed
        : Number.isFinite(urlSeed) ? urlSeed : Math.floor(Date.now() % 1000000);
      makeMap(seed);
      const field = makeField(121, 2.0, MAP_SEED);
      buildDepotTerrain(field, MAP_SEED);
      if (RES) {
        // The heightfield goes back OVER the freshly grown terrain — same
        // grid, so a straight copy. Craters, the depot mound's dents, the
        // hollow a breached ridge left: all of it lives here and nowhere else.
        const hs = RES.field.h;
        const n = Math.min(field.h.length, hs.length);
        for (let i = 0; i < n; i++) field.h[i] = hs[i];
        field.dirty = true;
      }
      const grid = makeGrid(field);
      const world = makeWorld({ field, seed: MAP_SEED });
      if (RES) {
        // Law 2 (save.js): a fresh stream from the seed the save drew at the
        // bell. A return, not a replay. world.t comes back too — every stamp
        // in the file (spawn-done, corpse ages, card arm times, the wind) is
        // an absolute sim-clock reading and would be nonsense against 0.
        world.rng = mulberry32(RES.rng.seed);
        world.t = RES.world.t;
      }
      world._tdStruct = true;
      world.depotCombat = true; // Phase 0 combat hooks: glancing, armor, tree fire/shredding
      // The pair's survey vets (6.5 Task 6): thread the mode's pond test and
      // playable rim onto the world so squads.js's surveyHighGround /
      // bestStandPoint can reject ice and off-rim candidates without
      // importing mode-local map state. Pure functions of the static map —
      // twin worlds read identically (determinism-safe).
      world.pondAt = (x, z) => !!pondAt(x, z);
      world.inRim = (x, z) => { const c = invW(x, z); return Math.abs(c.u) <= RIM_HALF_U && Math.abs(c.v) <= RIM_HALF_V; };
      // town / censuses / rocks: laid fresh, or lifted back off the save.
      let town, depotCensus, depotCensus2, rocksLive, resBodies = null;
      if (RES) {
        // Step 4. Every body in the file goes back in saved order (ids are
        // reassigned, so everything that pointed at one points at an INDEX);
        // then the welds, by index pair, with their original joint anchors.
        resBodies = restoreBodies(world, RES, ROCKS);
        restoreWelds(world, RES, resBodies);
        // The town array is bookkeeping over bodies that are already back:
        // stones by b.town, n0 and ruined off the file, footprint cells
        // recomputed from the regrown TOWN layout. A ruined building has
        // already had its cells released (stepTown does that once) — restoring
        // it blocked would wall off ground the player can walk and build on.
        const stonesBy = new Map();
        for (const b of resBodies) if (b.kind === "chunk" && b.town) {
          const arr = stonesBy.get(b.town); if (arr) arr.push(b); else stonesBy.set(b.town, [b]);
        }
        town = TOWN.map((t) => {
          const saved = (RES.towns || []).find((s) => s.id === t.id) || {};
          const cells = townFootprint(grid, t);
          const ruined = !!saved.ruined;
          if (!ruined) for (const ci of cells) { const c = grid.cells[ci]; c.blocked = true; c.building = t.id; }
          const stones = stonesBy.get(t.id) || [];
          return { id: t.id, cells, stones, n0: saved.n0 != null ? saved.n0 : stones.length, ruined, x: t.x, z: t.z };
        });
        // The censuses keep their ORIGINAL rows (including rows whose stone is
        // gone — see save.js's -1 rule) and their built-time homes. Re-taking
        // a census here would stamp displaced stone as "home" and forgive
        // every hit the depot has taken.
        depotCensus = restoreCensus(RES.census, resBodies);
        depotCensus2 = restoreCensus(RES.census2, resBodies);
        // The player's own structures re-claim their grid cells (buildAt does
        // this at build time; nothing else would).
        for (const b of resBodies) {
          if ((b.kind !== "wall" && b.kind !== "tower") || !b.alive) continue;
          // A wall's upper courses share the bottom course's cell (P1.5 T2) —
          // cell.wallId must come back pointing at the BOTTOM one, exactly as
          // buildAt set it, or a shot-off top course would release the ground
          // under a wall that is still standing.
          if (b.course > 0) continue;
          const g = grid.worldToGrid(b.pos.x, b.pos.z);
          if (!grid.inBounds(g.gx, g.gz)) continue;
          const c = grid.cells[grid.idx(g.gx, g.gz)];
          c.blocked = true; c.wallId = b.id;
        }
        // Rocks: the live set is whatever rock bodies came back. A ridge that
        // was breached during the run has no body in the file, so its cells
        // must be released here exactly as breachRock released them — the
        // saved heightfield already carries the hole it left.
        rocksLive = resBodies.filter((b) => b.kind === "rock" && b.alive && b.rockRef).map((b) => b.rockRef);
        for (const k of ROCKS) {
          if (rocksLive.indexOf(k) >= 0) continue;
          for (let gz = 0; gz < GRID_H; gz++) for (let gx = 0; gx < GRID_W; gx++) {
            const wp = grid.gridToWorld(gx, gz);
            if (Math.hypot(wp.x - k.x, wp.z - k.z) < k.r * 0.78 + 0.9) {
              const c = grid.cells[grid.idx(gx, gz)];
              if (c.terrain) { c.blocked = false; c.terrain = false; }
            }
          }
        }
      } else {
        town = buildTown(world, grid, field);
        // Structural loss (Task 5): the depot's own chunk lattice IS its health
        // bar — census taken once here (ids + home world positions), read back
        // at ~1Hz via stepDepotCensus below against world.byId (live pos/alive).
        depotCensus = censusDepotChunks(world.bodies);
        // FRONT F1: the enemy depot's own census — same snapshot moment, read
        // back through the same 1Hz gate (no second timer).
        depotCensus2 = censusDepotChunks(world.bodies, "depot2");
        rocksLive = ROCKS.slice();
      }
      // Territory (Phase 4 Task 2): who holds the ground. Cells over the
      // same playable rim the renderer clips to (halfU 29 / halfV 57, see
      // makeRenderer's rim opt above) — reuse rather than reinvent extents.
      const T = makeTerritory(29, 57);
      if (RES && RES.terr && RES.terr.v && RES.terr.v.length === T.v.length) T.v.set(RES.terr.v);
      // VISION (mk0.72): who can SEE what, on the territory grid's own frame
      // and carried on the territory object — so every function already
      // handed T gets sight for free. Purely derived: nothing saves it, and a
      // resumed run rebuilds it on the first territory tick below.
      T.sight = makeSight(T);
      // town buildings' (x, z) are rotated WORLD space (same as any body);
      // territory reads canonical (u, v) — precompute once (buildings don't
      // move) rather than re-converting every stall.
      const townUV = town.map((b) => { const c = invW(b.x, b.z); return { id: b.id, x: c.u, z: c.v, get ruined() { return b.ruined; } }; });
      let terrAcc = 0;
      const TERR_STEP = 0.25; // stepTerritory at ~4Hz — accumulated below, not every frame
      // Emitter list, rebuilt fresh each territory step from live bodies:
      // team-signed by kind -> EMIT weight (see territory.js). The depot's
      // own emitter is its roof-peak flag body (kind "flag", team 1 — built
      // in buildTown above; towers also carry flagPole=true for the
      // renderer's pole overlay, so this checks kind, not the flag). Each
      // depot's flag is its side's permanent anchor (FRONT F1) — team 2's
      // flag at depot2 replaces the old spawn-point anchor emitters.
      // territory.js is CANONICAL (u,v) space (the un-rotated map frame, same
      // as the renderer's rim) — every body/spawn position here is rotated
      // WORLD space, so every emitter goes through invW (DEPOT's
      // world-to-canonical transform) before it's pushed.
      const buildEmitters = () => {
        const out = [];
        for (const b of world.bodies) {
          // Towers repel fog by HALF THEIR SIGHT (effRange/2, cached at
          // build off the true muzzle) instead of the flat EMIT.tower.r:
          // gun ~9.5, mortar ~13, rocket ~11.5, mg ~7.5 on flat ground,
          // scaled up on high ground. Frost has no fire range — its
          // spec.range IS its slow-field radius, so the same effRange/2
          // rule gives it slow-radius/2 (~6). EMIT.tower.r stays as the
          // fallback for any tower missing the cache.
          if (b.kind === "tower" && b.team === 1 && b.alive) { const c = invW(b.pos.x, b.pos.z); out.push({ x: c.u, z: c.v, w: EMIT.tower.w, r: (b.effRange != null ? b.effRange : TOWER_SPECS[b.towerType].range) / 2, sign: 1 }); }
          // ONE emitter per WALL, not per course (P1.5 T2): the bottom course
          // carries it, so three stacked bodies push the same green influence
          // one body used to.
          else if (b.kind === "wall" && b.team === 1 && b.alive && !b.course) { const c = invW(b.pos.x, b.pos.z); out.push({ x: c.u, z: c.v, w: EMIT.wall.w, r: EMIT.wall.r, sign: 1 }); }
          // FRONT F1: flags emit their OWN team's influence at homeland
          // strength — the enemy depot IS the enemy anchor now.
          else if (b.kind === "flag") { const c = invW(b.pos.x, b.pos.z); out.push({ x: c.u, z: c.v, w: EMIT.depot.w, r: EMIT.depot.r, sign: b.team === 2 ? -1 : 1 }); }
          else if (b.kind === "unit" && b.team === 1 && b.alive) { const c = invW(b.pos.x, b.pos.z); out.push({ x: c.u, z: c.v, w: EMIT.unit.w, r: EMIT.unit.r, sign: 1 }); }
          else if (b.kind === "chunk" && b.sandbag && b.alive) { const c = invW(b.pos.x, b.pos.z); out.push({ x: c.u, z: c.v, w: EMIT.wall.w, r: EMIT.wall.r, sign: 1 }); }
          else if (b.kind === "unit" && b.team === 2 && b.alive) { const c = invW(b.pos.x, b.pos.z); out.push({ x: c.u, z: c.v, w: EMIT.unit.w, r: EMIT.unit.r, sign: -1 }); }
          else if (b.kind === "vehicle" && b.team === 2 && b.alive) { const c = invW(b.pos.x, b.pos.z); out.push({ x: c.u, z: c.v, w: EMIT.vehicle.w, r: EMIT.vehicle.r, sign: -1 }); }
        }
        // FRONT F1: the SPAWN_POINTS anchor emitters are gone — spawn points
        // are spawn locations only; the enemy's permanent red is its depot flag.
        return out;
      };
      const treeAt = (tx, tz) => {
        const ty = field.heightAt(tx, tz);
        const u = addBody(world, { kind: "tree", team: 0, mass: 260, hx: 0.28, hy: 1.6, hz: 0.28, x: tx, y: ty + 1.62, z: tz, hp: 70, friction: 0.5 });
        u.sleeping = true;
        return u;
      };
      // Rocks and trees are BODIES, and bodies come off the save — a burnt
      // treeline and a breached ridge are things the war did, not things the
      // seed says. On a resume both blocks are skipped entirely; the fresh
      // path below is untouched.
      if (!RES) {
        for (const k of ROCKS) {
          const b = addBody(world, { kind: "rock", team: 0, mass: 0, hx: k.r * 0.55, hy: k.h * 0.8, hz: k.r * 0.55, x: k.x, y: field.heightAt(k.x, k.z) - k.h * 0.2, z: k.z, hp: 380 + k.r * 90 });
          b.maxHp = b.hp; b.rockRef = k;
        }
        const rT = mulberry32(MAP_SEED ^ 0x517);
        for (let tu = -26; tu <= 26; tu += 3.2) {
          const w = fwdU(tu + (rT() - 0.5) * 1.6, -54.5 + rT() * 3.2);
          if (SPAWN_POINTS.some((sp) => Math.hypot(w.x - sp.x, w.z - sp.z) < 4.5)) continue;
          if (rockAt(w.x, w.z)) continue;
          treeAt(w.x, w.z);
        }
        const clumps = [];
        for (let c = 0, nC = 1 + Math.floor(rT() * 4); c < nC; c++) { const w = fwdU(-20 + rT() * 40, -46 + rT() * 24); clumps.push([w.x, w.z, 5 + Math.floor(rT() * 3)]); }
        for (const [cx, cz, n2] of clumps) {
          for (let i = 0; i < n2; i++) {
            const a = rT() * 6.28, rr = 1.5 + rT() * 4;
            const jx = cx + Math.cos(a) * rr, jz = cz + Math.sin(a) * rr;
            if (rockAt(jx, jz) || pondAt(jx, jz)) continue;
            treeAt(jx, jz);
          }
        }
        // P1.5 T4 (mk0.60) — THE DEPOT COMES WITH COVER. Four to six sandbags
        // ringed on the player depot at map-build time, so a fresh front opens
        // with something to lie behind instead of bare ground.
        //
        // Drawn off a DEDICATED map-seed stream (the same mulberry32(MAP_SEED ^
        // k) pattern the treeline above uses) and never world.rng: the world
        // stream's draw counts are a determinism contract and this feature must
        // not appear in them at all. Draw count is fixed at 1 + 2 per bag
        // whatever the vetting rejects, so the stream is stable too.
        //
        // Vetting is clearSlot's rule (squads.js's own static-solid test, at a
        // bag's own half-extent plus a man's clearance) plus the grid's verdict
        // — a blocked cell is the depot footprint or a rock, ice is water — plus
        // road and objective clearance. Each bag gets a fan of candidates around
        // its drawn spot (four radii out, then the same four either side of the
        // azimuth) because the depot's own approach road and mound reject a lot
        // of the ring; a bag that clears none of the twelve is simply dropped.
        const bagR = mulberry32(MAP_SEED ^ 0x5ba6);
        const depotT = TOWN.find((t) => t.depot && t.team !== 2);
        if (depotT) {
          const roadClear = (x, z) => {
            let best = 1e9;
            for (const route of ROADS) for (let i = 0; i < route.length - 1; i++) {
              const a2 = route[i], b2 = route[i + 1];
              const rdx = b2[0] - a2[0], rdz = b2[1] - a2[1];
              const tt = Math.max(0, Math.min(1, ((x - a2[0]) * rdx + (z - a2[1]) * rdz) / (rdx * rdx + rdz * rdz || 1)));
              best = Math.min(best, Math.hypot(x - (a2[0] + rdx * tt), z - (a2[1] + rdz * tt)));
            }
            return best;
          };
          const nBags = 4 + Math.floor(bagR() * 3);
          for (let i = 0; i < nBags; i++) {
            const az0 = ((i + 0.5) / nBags) * Math.PI * 2 + (bagR() - 0.5) * 0.5;
            const r0 = 6.4 + bagR() * 1.6;
            let placed = false;
            for (let swing = 0; swing < 3 && !placed; swing++) {
              const az = az0 + [0, 0.38, -0.38][swing];
              for (let nudge = 0; nudge < 4; nudge++) {
                const rr = r0 + nudge * 1.3;
                const bx = depotT.x + Math.sin(az) * rr, bz = depotT.z + Math.cos(az) * rr;
                const cell = grid.cellAt(bx, bz);
                if (!cell || cell.blocked || cell.ice) continue;
                if (Math.hypot(bx - OBJ_POS.x, bz - OBJ_POS.z) < 3) continue;
                if (roadClear(bx, bz) < 3) continue;
                if (slotBlockedPublic(world, bx, bz, SANDBAG_HX + 0.35)) continue;
                // laid ACROSS the radius, so the ring reads as cover facing out
                spawnSandbag(world, bx, bz, Math.abs(Math.cos(az)) >= Math.abs(Math.sin(az)) ? 0 : 1);
                placed = true;
                break;
              }
            }
          }
        }
      }
      const objG = grid.worldToGrid(OBJ_POS.x, OBJ_POS.z);
      computeFlowField(grid, objG.gx, objG.gz);
      R = makeRenderer(canvas, world, {
        town: false, camera: "tactical", fadeDecals: true,
        // playable rim (matches buildDepotTerrain's falloff box, 29x57
        // canonical): ground/grid/decals beyond it get no geometry to
        // paint on (see renderer.js). TD/campaign/demo pass no rim.
        rim: { halfU: RIM_HALF_U, halfV: RIM_HALF_V, toCanonical: invW, toWorld: fwdU },
        // Grid-line faction tint + fog. sample() (WORLD space) drives
        // per-frame enemy visibility and the terrain fog cast; sampleUV
        // (CANONICAL space, matches T's own grid) drives the 4Hz splat-line
        // retint + terrain fog wash via R.updateTerritory().
        territory: {
          T,
          toWorld: fwdU,
          // VISION (mk0.73): what the screen hides now follows what your side
          // SEES, not what it holds. Binary — a spot is seen or it is not, so
          // the renderer's "seam" silhouette branch never fires again.
          sample: (x, z) => { const c = invW(x, z); return seenAt(T.sight, c.u, c.v, 1) ? "held" : "unheld"; },
          sampleUV: (u, v) => fogStateFor(T, u, v, 1),   // grid tint: ownership, unchanged
          // Raw signed field strength (world space), feeding the area-wash
          // alpha ramp — the ground wash still shows who HOLDS the ground,
          // which is also what build rights read.
          sampleVal: (x, z) => { const c = invW(x, z); return valueAt(T, c.u, c.v); },
        },
      });
      const EXT = ORIENT % 2 ? { x: 62, z: 34 } : { x: 34, z: 62 };
      const A = makeGameAudio();
      A.setReflectors([
        ...ROCKS.filter((k) => k.r >= 4),
        ...TOWN.map((t) => ({ x: t.x, z: t.z, r: Math.max(t.nx, t.nz) * MASON.pitch * 0.6 })),
      ]);
      // rocksLive, not ROCKS: on a resume a ridge the war already breached
      // must not be painted back onto the ground it no longer occupies.
      R.setDressing({ rocks: rocksLive, ponds: PONDS });
      R.overlay.setObjective(OBJ_POS.x, OBJ_POS.z, field.heightAt(OBJ_POS.x, OBJ_POS.z));
      R.overlay.setBanners(SPAWN_POINTS);
      const AIM_OFF = { x: 0, z: -500 };
      // FOG toggle: visuals only (see renderer.js setFog) — default ON,
      // persisted with the same localStorage-key pattern CampaignRunner uses
      // for "coldsnap-camp-deployed". Targeting (fieldReaches in state.js,
      // a sight read since mk0.72) is untouched by this flag.
      let fogOn = true;
      try { fogOn = window.localStorage.getItem("coldsnap-depot-fog") !== "0"; } catch (e) {}
      R.setFog(fogOn);

      // FIRE DISCIPLINE toggle: CAREFUL (default) holds a tower's trigger
      // pull when its round's flight path would foul a friendly wall/tower/
      // town chunk (state.js's friendlyFouls) — FREE fires regardless, the
      // pre-Task-2 behavior. Same coldsnap-depot-* persistence pattern as
      // the FOG toggle above. Enemy fire never consults this.
      let discipline = "careful";
      try { const v = window.localStorage.getItem("coldsnap-depot-discipline"); if (v === "free" || v === "careful") discipline = v; } catch (e) {}

      const S = {
        resources: 120, kills: 0,
        ws: makeDepotAssaultState(), spawnRR: 0,
        mode: "wall", sellMode: false, inspectId: null,
        started: false, gameOver: false, victory: false,
        paused: false, speed: 1, fogOn, discipline,
        setFog: (v) => { fogOn = v; S.fogOn = v; R.setFog(v); try { window.localStorage.setItem("coldsnap-depot-fog", v ? "1" : "0"); } catch (e) {} },
        setDiscipline: (v) => { discipline = v; S.discipline = v; try { window.localStorage.setItem("coldsnap-depot-discipline", v); } catch (e) {} },
        // The clock (P1 Task 1): bellAt is the absolute SIM-clock stamp the
        // next bell is due at, bellT the readout stepBell derives from it.
        bell: 0, bellT: BELL_PERIOD_S, bellAt: BELL_PERIOD_S, lastDispatch: null,
        // The two ladders (P1 Task 2). manifest holds what the player has
        // unlocked (START only, at mount) plus this bell's live offer; foe
        // holds the attacker's own picks, which feed the assault's tier cap.
        // Both start EMPTY of any card: a fresh mount is bell 0, nothing rung,
        // nothing on screen.
        manifest: makeManifestState(), foe: makeFoeState(),
        intelUp: false, intelArmedAt: 0,
        // Opens on the depot, not the middle of the field. TOWN[i].x/z for
        // the depot entry ({id:"depot", x:0, z:52, ...} in genMap) are
        // already WORLD-space — genMap's T() helper runs every town entry
        // through fwdU before storing it — so this is exactly the same
        // point fwdU(0, 52) would give under the map's live ORIENT; reading
        // it off TOWN directly (rather than re-deriving via fwdU(0, 52))
        // can't drift out of sync with wherever genMap actually placed it.
        focus: (() => {
          const depotT = TOWN.find((t) => t.depot);
          const w = depotT ? { x: depotT.x, z: depotT.z } : fwdU(0, 52);
          return { x: w.x, y: field.heightAt(w.x, w.z), z: w.z };
        })(),
        zoom: 1, acc: 0, t: 0, fps: 60, fpsAcc: 0, fpsN: 0,
        hover: null, pointer: null, toasts: [], pending: null,
        // Squads (Phase 5 Task 3): live squad rosters + selection/order UI
        // state. selArmedAt mirrors pending's 350ms trailing-tap guard so
        // the tap that selected a squad can't double-fire an order chip.
        // buildPt0 (mk0.60): the FIRST of a build order's two taps, held here
        // until the second lands. Null whenever no build order is half-given.
        // pieOpen (COMMAND 1b, mk0.82): true while the wedge disc is on
        // screen around the selected squad/tower; a wedge tap closes it
        // (S.pieOpen = false) but an aiming order keeps the squad selected
        // so the ground stays tappable — see consumeOrderTap.
        squads: [], nextSquadId: 1, selSquadId: null, selArmedAt: 0, orderMode: null, buildPt0: null, pieOpen: false,
        hudT: 0, keys: {}, sellById: null, audio: A,
        // The attacker's economy — seeded off the run's own rng stream, not
        // an unseeded generator, so ?seed= replays reproduce the same
        // regiment. Mutated in place by planWave (buy-time depletion — the
        // only depletion path; a fielded unit's cost is spent at muster
        // and never returns, dead or alive) and payResults; never replaced.
        // On a RESUME the saved regiment is the regiment — makeRegiment is not
        // called at all, so the resumed run doesn't spend two draws re-rolling
        // a formation it already has.
        reg: RES ? { ...RES.run.reg } : makeRegiment(world.rng),
      };
      // Step 5. The run state itself, straight off the file. The bell is the
      // ONE deliberate exception: the countdown restarts at a full period
      // rather than resuming a half-elapsed one (ratified — simpler, and
      // kinder than dropping the player into a bell that rings in nine
      // seconds). Everything else — scrap, kills, the unlocked set, the
      // convoy's live offer, the enemy's pick list, the mustered assault's
      // spawn queue — is exactly what it was.
      if (RES) {
        const r = RES.run;
        S.resources = r.resources; S.kills = r.kills; S.spawnRR = r.spawnRR;
        S.started = !!r.started; S.mode = r.mode; S.sandbagOrient = r.sandbagOrient || 0;
        S.zoom = r.zoom; R.setZoom(r.zoom);
        S.focus = { x: r.focus.x, y: field.heightAt(r.focus.x, r.focus.z), z: r.focus.z };
        S.bell = r.bell;
        S.bellAt = world.t + BELL_PERIOD_S; S.bellT = BELL_PERIOD_S;
        S.depotCensusAcc = r.depotCensusAcc;
        S.depotStanding = r.depotStanding; S.enemyStanding = r.enemyStanding;
        S.starvedStreak = r.starvedStreak;
        S._reportedBreak = r.reportedBreak; S._reportedSpent = r.reportedSpent;
        S.manifest = r.manifest; S.foe = r.foe;
        S.intelUp = r.intelUp; S.intelArmedAt = r.intelArmedAt;
        S.lastDispatch = r.lastDispatch;
        S.pendingPlan = r.pendingPlan; S.intelPlan = r.intelPlan;
        S.ws = r.ws;
        S.squads = restoreSquads(RES, resBodies);
        S.nextSquadId = r.nextSquadId;
        // Step 6, last: the ground remembers. Every mark where a man fell is
        // replayed through the same paint the kill handler uses, so the snow
        // comes back stained exactly as it was left. Scorch and tread
        // staining are NOT in the ledger and do not come back — the accepted
        // visual loss, stated in the plan.
        if (R._splat && R._splat.smear) for (const m of RES.smears || []) R._splat.smear(m.u, m.v, m.s, m.x, m.z);
      }
      stateRef.current = S;
      // id -> last-observed hp for wall/tower/building bodies, so structure
      // damage dealt (not just kills) can be attributed to the attacker
      // across ticks — there is no discrete "damage" event to read instead
      // (see applyDamage in engine/core.js: it sets b.lastHit but pushes no
      // event unless the hit is lethal).
      const structHp = new Map();

      // buildSnapshot: the counter-signal read planWave uses to weight its
      // buy — a fresh count of the player's live defenses every stall.
      const buildSnapshot = () => {
        // guns and rockets are counted separately so the book-value verdict
        // (state.js's playerBookValue) can price each at its own real spec
        // cost — rockets are NOT gun-priced here (Phase 3 Task 7 fix). The
        // AI's counter-play read (ai.js's signals()) never looks at either
        // field, so this split changes nothing about wave-planning pressure.
        let mortars = 0, mgs = 0, guns = 0, rockets = 0, frosts = 0, walls = 0, elevSum = 0, elevN = 0;
        for (const b of world.bodies) {
          // WALLS, not courses (P1.5 T2): three would treble planWave's read and playerBookValue.
          if (b.kind === "wall") { if (!b.course) walls++; continue; }
          if (b.kind !== "tower") continue;
          if (b.towerType === "mortar") mortars++;
          else if (b.towerType === "mg") mgs++;
          else if (b.towerType === "gun") guns++;
          else if (b.towerType === "rocket") rockets++;
          else if (b.towerType === "frost") frosts++;
          elevSum += b.pos.y; elevN++;
        }
        // squads: live player squads (ai.js snapSquads — the sniper-buy
        // gate). S.squads is already pruned each sim tick, but count only
        // squads holding a live member so a same-tick wipe can't inflate it.
        const squads = S.squads.filter((sq) => sq.memberIds.some((id) => { const u = world.byId.get(id); return u && u.alive; })).length;
        return { mortars, mgs, guns, rockets, frosts, walls, squads, towerElev: elevN ? elevSum / elevN : 0 };
      };

      const toast = (txt) => { S.toasts.push({ txt, t: performance.now() / 1000 }); if (S.toasts.length > 4) S.toasts.shift(); };

      const recomputeFlow = () => computeFlowField(grid, objG.gx, objG.gz);
      const buildAt = (gx, gz, mode) => {
        if (!grid.inBounds(gx, gz)) return;
        const cell = grid.cells[grid.idx(gx, gz)];
        if (cell.blocked || cell.wallId) { toast("OCCUPIED"); return; }
        if (cell.ice) { toast("NO GROUND — frozen water"); return; }
        {
          const wp0 = grid.gridToWorld(gx, gz), c0 = invW(wp0.x, wp0.z);
          if (!canBuild(T, c0.u, c0.v)) { toast("GROUND NOT HELD"); return; }
        }
        const spec = mode === "wall" ? null : TOWER_SPECS[mode];
        const cost = spec ? spec.cost : WALL_COST; // walls: no TOWER_SPECS row, state.js owns the price
        if (S.resources < cost) { toast("NO SCRAP"); return; }
        cell.blocked = true;
        if (!checkConnectivity(grid, SPAWN_POINTS, objG.gx, objG.gz)) {
          cell.blocked = false;
          toast("Leave them a road");
          return;
        }
        const wp = grid.gridToWorld(gx, gz);
        const y = field.heightAt(wp.x, wp.z);
        let b;
        if (spec) {
          b = addBody(world, { kind: "tower", team: 1, mass: 0, hx: 0.8, hy: spec.hy, hz: 0.8, x: wp.x, y: y + spec.hy, z: wp.z, hp: spec.hp });
          b.towerType = mode;
          b.flagPole = true;
          // effRange cached once (Task 3): towers are static, so the
          // elevation-scaled acquisition range never changes after this.
          // Derived from the LIVE body so it matches towerShot's muzzle
          // (pos.y + hy + 0.45 = turret TOP + 0.45) and can never drift —
          // the old ground+hy+0.45 form sat a full half-height below the
          // muzzle and under-computed the elevation bonus.
          b.effRange = effRange(world, { x: b.pos.x, y: b.pos.y + b.hy + 0.45, z: b.pos.z }, spec);
        } else {
          // P1.5 T2: one wall, three welded courses (state.js owns the
          // dimensions, the hp split and the weld). The CELL owns all three;
          // cell.wallId is the BOTTOM course, because its death is what
          // releases the ground and brings the rest down.
          // mk0.55: walls are thin faces now — default broadside to the
          // enemy's advance (canonical v is the advance axis, so the long
          // axis lies along canonical u: world x when ORIENT is even, world
          // z when odd), and a wall built next to a wall continues its line.
          b = spawnWallCourses(world, wp.x, y, wp.z, wallOrientAt(world, wp.x, wp.z, ORIENT % 2))[0];
        }
        b.maxHp = b.hp;
        cell.wallId = b.id;
        S.resources -= cost;
        recomputeFlow();
      };
      // Validate-only twin of buildAt's early checks (Task 3): used to gate
      // entry into the pending-confirm flow WITHOUT mutating anything —
      // cell.blocked stays false, no scrap moves, until confirmPending()
      // below actually calls buildAt. Mirrors buildAt's checks exactly
      // (same order, same toasts) so a cell that would fail at confirm time
      // never gets this far in the first place.
      const canBuildAt = (gx, gz, mode) => {
        if (!grid.inBounds(gx, gz)) return { ok: false };
        const cell = grid.cells[grid.idx(gx, gz)];
        const wp = grid.gridToWorld(gx, gz), c0 = invW(wp.x, wp.z);
        const spec = TOWER_SPECS[mode];
        const v = validatePlacement({
          blocked: !!(cell.blocked || cell.wallId), ice: !!cell.ice,
          held: canBuild(T, c0.u, c0.v), resources: S.resources, cost: spec.cost,
        });
        return v.ok ? { ok: true, spec, wp } : v;
      };
      // Pending placement (Task 3): tap a buildable cell in tower mode ->
      // ghost + reach polygon + ✓/✗, armed after 350ms, no scrap spent until
      // confirmPending. Walls stay exempt (instant, via buildAt directly) —
      // a ring/confirm pair on a 5-scrap wall is meaningless (brief).
      const clearPending = () => { S.pending = null; };
      const startPending = (gx, gz, mode, v) => {
        const spec = v.spec, wp = v.wp;
        const y = field.heightAt(wp.x, wp.z);
        // Ghost muzzle at the TRUE turret top (ground + 2*hy + 0.45) —
        // same height buildAt's body-derived effRange and towerShot use, so
        // the preview's sightlines originate where the tower will fire from.
        const muzzle = { x: wp.x, y: y + spec.hy * 2 + 0.45, z: wp.z };
        let poly = null, ringR = 0, color = 0xff5544;
        if (mode === "frost") {
          // aura, not a gun: plain radius, no LOS clipping, blue-white —
          // "honest about what it does" (brief).
          ringR = spec.range;
          color = 0x9fdcff;
        } else {
          // T deliberately null (playtest fix): the preview shows what the
          // tower COULD reach — terrain/solid clipping only (arcClears is
          // unconditional inside reachPolygon). Live acquisition stays
          // fog-gated (stepTowers' own fieldReaches) — the guns obey what is.
          poly = reachPolygon(world, null, muzzle, spec, 1, invW);
        }
        S.pending = { gx, gz, mode, wp, y, poly, ringR, color, cost: spec.cost, armedAt: world.t + PENDING_ARM_S };
      };
      const confirmPending = () => {
        const p = S.pending;
        // mk0.27: the arm guard stays (the opening tap must not double-fire
        // as the confirm), but an early ✓ tap SAYS so instead of vanishing —
        // and leaves the pending exactly as it was, so the next tap works.
        if (!pendingArmed(p, world.t)) { if (p) toast("HOLD — ARMING"); return; }
        S.pending = null;
        if (p.squad) { placeSquadAt(p.gx, p.gz, p.squad); return; }
        buildAt(p.gx, p.gz, p.mode);
      };
      // ---------------------------------------------- squads (Phase 5 Task 3)
      // Build-bar mode keys -> squad type. Prefixed (sq_mg vs mg) because the
      // MG TOWER already owns the bare "mg" mode key.
      const SQUAD_MODE = { sq_sniper: "sniper", sq_rifles: "rifles", sq_mg: "mg", sq_sappers: "sappers", sq_mortars: "mortars", sq_engineers: "engineers" };
      // Infantry/sandbag placement checks: same validatePlacement gate as
      // towers (occupied/ice/held/afford) — men don't claim the grid cell
      // (no cell.blocked write, no connectivity re-check: bodies, not
      // structures), but they place by the same ground rules.
      const canPlaceInfantryAt = (gx, gz, cost) => {
        if (!grid.inBounds(gx, gz)) return { ok: false, msg: "OFF THE FIELD" };
        const cell = grid.cells[grid.idx(gx, gz)];
        const wp = grid.gridToWorld(gx, gz), c0 = invW(wp.x, wp.z);
        const v = validatePlacement({
          blocked: !!(cell.blocked || cell.wallId), ice: !!cell.ice,
          held: canBuild(T, c0.u, c0.v), resources: S.resources, cost,
        });
        return v.ok ? { ok: true, wp } : v;
      };
      const placeSquadAt = (gx, gz, type) => {
        const v = canPlaceInfantryAt(gx, gz, SQUAD_SPECS[type].cost);
        if (!v.ok) { toast(v.msg); return; }
        const sq = makeSquad(S.nextSquadId++, type, 1, v.wp.x, v.wp.z);
        spawnSquadMembers(world, sq);
        S.squads.push(sq);
        // COMMAND T1 (mk0.80): a placed squad comes up already selected with
        // its radial open — defend-here is already its standing order (the
        // intrinsic default, no tap needed).
        S.selSquadId = sq.id; S.selArmedAt = world.t + PENDING_ARM_S; S.pieOpen = true;
        S.resources -= SQUAD_SPECS[type].cost;
      };
      // Sandbag: instant, wall-exempt (brief) — same reasoning as walls: a
      // ring/confirm pair on a 3-scrap bag is meaningless.
      const placeSandbagAt = (gx, gz) => {
        const v = canPlaceInfantryAt(gx, gz, SANDBAG_COST);
        if (!v.ok) { toast(v.msg); return; }
        // AUTO-CONTINUE: adjacent (2.2m) to an existing bag -> orient along
        // the line to it; isolated line starts use the bar toggle.
        spawnSandbag(world, v.wp.x, v.wp.z, sandbagOrientAt(world, v.wp.x, v.wp.z, S.sandbagOrient || 0));
        S.resources -= SANDBAG_COST;
      };
      // Squad placement rides the tower pending-confirm flow. Sniper preview
      // is the reachPolygon fan with INFANTRY_ARMS.sniper, fog-INDEPENDENT
      // (null territory — the Phase-5 preview rule: show what he COULD see,
      // clipped by terrain/solids only; live fire stays fog-gated in
      // squadFire). Rifles/MG get a plain range ring — their reach is short
      // and omnidirectional enough that a fan reads as noise.
      const startPendingSquad = (gx, gz, mode, wp) => {
        const type = SQUAD_MODE[mode];
        const arms = INFANTRY_ARMS[type];
        const y = field.heightAt(wp.x, wp.z);
        let poly = null, ringR = 0;
        if (type === "sniper") {
          const muzzle = { x: wp.x, y: y + 1.24, z: wp.z }; // ground + 0.74 seat + 0.5 squadFire muzzle
          poly = reachPolygon(world, null, muzzle, arms, 1, invW);
        } else {
          // sappers carry no arms entry (no rifle) — no reach preview at all;
          // their reach is their feet.
          ringR = arms ? arms.range : 0;
        }
        S.pending = { gx, gz, mode, squad: type, wp, y, poly, ringR, color: 0xffd27a, cost: SQUAD_SPECS[type].cost, armedAt: world.t + PENDING_ARM_S }; // amber: a green fan vanishes into the held-terrain wash
      };
      // Selection: tap within 1.6m of any live member selects his squad.
      const squadAtPoint = (p) => {
        for (const sq of S.squads) for (const id of sq.memberIds) {
          const u = world.byId.get(id);
          if (u && u.alive && Math.hypot(u.pos.x - p.x, u.pos.z - p.z) < 1.6) return sq;
        }
        return null;
      };
      const selectedSquad = () => (S.selSquadId != null ? S.squads.find((q) => q.id === S.selSquadId) || null : null);
      // Order chips (DEFEND | ATTACK). 350ms arming (selArmedAt, same
      // trailing-tap guard as pending ✓) so the selecting tap can't
      // double-fire a chip. DEFEND digs in where the men stand (anchor =
      // live-member centroid); ATTACK arms the next ground tap as dest.
      S.orderSquad = (kind) => {
        if (S.gameOver || S.victory) return;   // mk0.29: the war is over — no more orders
        const sq = selectedSquad();
        if (!sq || world.t < S.selArmedAt) return;
        if (kind === "defend") {
          let cx = 0, cz = 0, n = 0;
          for (const id of sq.memberIds) { const u = world.byId.get(id); if (u && u.alive) { cx += u.pos.x; cz += u.pos.z; n++; } }
          if (n) sq.anchor = { x: cx / n, z: cz / n };
          sq.order = "defend"; sq.dest = null; sq._legTarget = null; sq._pauseT = 0; sq._threatSig = undefined;
          sq._surveyPending = true; // DEFEND re-anchor: the pair re-surveys (6.5 Task 6)
          sq._build = null;         // mk0.60: a new order abandons the line where it stands
          S.orderMode = null; S.buildPt0 = null;
        } else if (kind === "attack" || kind === "move") {
          // mk0.28: both aiming orders arm the same "tap the ground" flow —
          // the chip only decides whether the men fight their way there.
          S.orderMode = kind; S.buildPt0 = null;
        } else if (kind === "build_bags" || kind === "build_walls") {
          // mk0.60: engineers only. The chip arms a TWO-tap flow (start, then
          // end); re-tapping the armed chip before the second point cancels it
          // cleanly, which is the only way out of a half-given order.
          if (sq.type !== "engineers") return;
          if (S.orderMode === kind) { S.orderMode = null; S.buildPt0 = null; return; }
          S.orderMode = kind; S.buildPt0 = null;
        }
      };

      // =================================== THE TWO-POINT BUILD LINE (P1.5 T4)
      // Tap where the line starts, tap where it ends. The squad walks to the
      // start, lays end-to-end along the line, and digs in at the far end.
      //
      // GEOMETRY, stated once because it is the whole design constraint: the
      // build grid's pitch is GRID_CS (2.0m) and BOTH pieces are 1.8m along
      // their long axis (a bag is 1.8 x 0.9 x 0.7; a wall course is a 1.8m-wide
      // face, WALL_HALF 0.9 / WALL_THIN 0.35). So a straight run lays pieces
      // 2.0m apart that are each 1.8m long: end-to-end bar a 0.2m joint at every
      // cell boundary — exactly the joint a hand-built line already has, since
      // both go through the same grid. The pitch is the constraint, not the
      // piece, and closing it would mean re-pitching every buildable in the game.
      //
      // ONE ROTATION FOR THE WHOLE LINE (Jeff, 2026-08-12 — this supersedes the
      // per-step "staircase" rotation the brief described). The engine's boxes
      // are axis-aligned and there is no rotated collider in this codebase, so
      // a line gets the CLOSEST LOGICAL ROTATION to its overall start->end
      // direction — its dominant axis, computed once at order time — and every
      // piece on the line is laid at that one angle. Most orders are drawn
      // axis-aligned anyway; on an off-axis order the cell path still walks the
      // true segment (4-connected, so consecutive cells always share an EDGE),
      // which puts the uniformly-rotated pieces into parallel offset runs where
      // the path sidesteps. That offset is accepted: a line of pieces all facing
      // the same way reads as one work, and alternating them at every sidestep
      // reads as scatter.
      //
      // NO RNG ANYWHERE IN HERE. Cell order is Bresenham, the advance is a
      // projection of the squad anchor onto the line (a distance accumulator by
      // another name), and every rejection is a deterministic test.
      // Two numbers, and they are set against each other rather than guessed.
      // The formation ring is 1.5m (squads.js slotFor), a piece is 0.9m from
      // its centre to its end, a man is 0.28m — so a man standing on the line
      // beside the anchor physically overlaps a piece within 1.18m of him, and
      // has 0.32m of daylight at his slot. LAY_AHEAD therefore puts each piece
      // down 4.5m in front of the anchor (3.0m clear of the leading man, who
      // can never be more than the ring's 1.5m ahead of it), and LAY_MAN_PAD is
      // a 0.15m safety margin on the hard overlap rather than the 0.35m slot
      // pad — at 0.35 the formation's own men blocked every cell of a line run
      // along their ring axis, and half a straight order laid nothing (measured,
      // staging run, mk0.60: 4 of 8 bags).
      const LAY_AHEAD = 4.5;      // m — a piece goes down this far in FRONT of the anchor
      const LINE_MAX_CELLS = 64;  // a hard ceiling on one order's line
      const LAY_MAN_PAD = 0.15;   // m — margin on top of a hard man-vs-piece overlap
      // lineCells: the grid cells a start->end segment runs through, in order.
      // Bresenham with ONE axis moved per step (never the diagonal shortcut the
      // stock algorithm takes) — that is what makes the staircase.
      const lineCells = (a, b) => {
        const g0 = grid.worldToGrid(a.x, a.z), g1 = grid.worldToGrid(b.x, b.z);
        let x = g0.gx, z = g0.gz;
        const dx = Math.abs(g1.gx - x), dz = Math.abs(g1.gz - z);
        const sx = g1.gx >= x ? 1 : -1, sz = g1.gz >= z ? 1 : -1;
        let err = dx - dz, guard = 0;
        const out = [{ gx: x, gz: z }];
        while ((x !== g1.gx || z !== g1.gz) && guard++ < LINE_MAX_CELLS) {
          const stepX = z === g1.gz ? true : x === g1.gx ? false : 2 * err > -dz;
          if (stepX) { err -= dz; x += sx; } else { err += dx; z += sz; }
          out.push({ gx: x, gz: z });
        }
        return out;
      };
      // The footprint a piece will occupy, given its orientation. Bags and wall
      // courses share one shape family (mk0.54/mk0.55) so this is one rule.
      const pieceHalf = (kind, orient) => {
        const long = kind === "walls" ? WALL_HALF : SANDBAG_HX;   // 0.9 either way
        const thin = kind === "walls" ? WALL_THIN : SANDBAG_HZ;   // 0.35 either way
        return orient === 1 ? { hx: thin, hz: long } : { hx: long, hz: thin };
      };
      const startBuildLine = (sq, kind, a, b) => {
        const dxw = b.x - a.x, dzw = b.z - a.z;
        const len = Math.hypot(dxw, dzw);
        const ux = len > 1e-6 ? dxw / len : 0, uz = len > 1e-6 ? dzw / len : 1;
        const cells = lineCells(a, b);
        // THE LINE'S ONE ROTATION: the closest logical rotation to the whole
        // start->end direction — its dominant axis. |dx| vs |dz| in WORLD space
        // is the exact convention sandbagOrientAt/wallOrientAt already use, so
        // the two can never disagree and no ORIENT reasoning is needed here.
        // null only for a degenerate (zero-length) order, which then falls back
        // to the auto-continue convention.
        const orient = len > 1e-6 ? (Math.abs(dxw) >= Math.abs(dzw) ? 0 : 1) : null;
        const rows = cells.map((c) => {
          const wp = grid.gridToWorld(c.gx, c.gz);
          return { gx: c.gx, gz: c.gz, x: wp.x, z: wp.z, t: (wp.x - a.x) * ux + (wp.z - a.z) * uz };
        });
        sq._build = { kind, orient, ax: a.x, az: a.z, ux, uz, len, rows, i: 0, laid: 0, skipped: 0, dry: false, phase: "toStart" };
        sq.order = "build";
        sq.dest = { x: a.x, z: a.z };
        sq._legTarget = null; sq._pauseT = 0; sq._cohesionHoldT = 0; sq._threatSig = undefined;
        toast((kind === "walls" ? "WALL" : "BAG") + " LINE — " + rows.length + " SECTIONS");
      };
      // One piece. Returns "laid" | "skip" | "dry". Placement runs the REAL
      // spawners and the REAL gate (validatePlacement, the same four checks the
      // build menu makes) — a cell that is occupied, iced or unheld is skipped,
      // never double-filled; running out of scrap stops the line for good.
      const layPieceAt = (job, row) => {
        if (!grid.inBounds(row.gx, row.gz)) return "skip";
        const cell = grid.cells[grid.idx(row.gx, row.gz)];
        const c0 = invW(row.x, row.z);
        const cost = job.kind === "walls" ? WALL_FIELD_COST : SANDBAG_FIELD_COST;
        const v = validatePlacement({
          blocked: !!(cell.blocked || cell.wallId), ice: !!cell.ice,
          held: canBuild(T, c0.u, c0.v), resources: S.resources, cost,
        });
        if (!v.ok) return v.msg === "NO SCRAP" ? "dry" : "skip";
        // The LINE's rotation, not the cell's: every piece on one order faces
        // the same way. The auto-continue conventions are the fallback for a
        // degenerate order only — they must never override the line's angle, or
        // a run laid beside an older line would turn to match the wrong thing.
        const orient = job.orient != null ? job.orient
          : job.kind === "walls" ? wallOrientAt(world, row.x, row.z, ORIENT % 2)
            : sandbagOrientAt(world, row.x, row.z, S.sandbagOrient || 0);
        // Never lay a piece around a living man. A static body spawned over a
        // dynamic one gets him depenetration-ejected, and the impact classifier
        // reads that ejection as a lethal slam (the masonry-slam hazard
        // squads.js's clearSlot exists for). A gap in the line is cheaper than a
        // dead engineer, so an occupied cell is skipped for good rather than
        // retried — retrying would deadlock behind the squad's own trailing man.
        const ph = pieceHalf(job.kind, orient);
        for (const u of world.bodies) {
          if (u.kind !== "unit" || !u.alive) continue;
          if (Math.abs(u.pos.x - row.x) <= ph.hx + u.hx + LAY_MAN_PAD &&
              Math.abs(u.pos.z - row.z) <= ph.hz + u.hz + LAY_MAN_PAD) return "skip";
        }
        if (job.kind === "walls") {
          // A wall claims the cell, so it owes the same road the build menu
          // owes: a line that seals the map off is refused cell by cell.
          cell.blocked = true;
          if (!checkConnectivity(grid, SPAWN_POINTS, objG.gx, objG.gz)) { cell.blocked = false; return "skip"; }
          const b = spawnWallCourses(world, row.x, field.heightAt(row.x, row.z), row.z, orient)[0];
          cell.wallId = b.id;
          recomputeFlow();
        } else {
          spawnSandbag(world, row.x, row.z, orient);
        }
        S.resources -= cost;
        return "laid";
      };
      // The driver, once per sim tick per squad carrying a job.
      S.stepBuildLine = (sq) => {
        const job = sq._build;
        if (!job) return;
        if (job.phase === "toStart") {
          // squads.js flips a finished leg to "defend" — that arrival IS the
          // handoff. The men are on the start point; now the dest becomes the
          // far end and the laying begins.
          if (sq.order === "build" && sq.dest) return;
          job.phase = "laying";
          sq.order = "build";
          sq.dest = { x: job.ax + job.ux * job.len, z: job.az + job.uz * job.len };
          sq._legTarget = null; sq._pauseT = 0; sq._cohesionHoldT = 0; sq._threatSig = undefined;
          return;
        }
        // THE ACCUMULATOR: how far along the start->end line the squad anchor
        // has travelled, as a projection — a pure function of the anchor, with
        // no clock and no rng in it.
        const t = (sq.anchor.x - job.ax) * job.ux + (sq.anchor.z - job.az) * job.uz;
        const arrived = sq.order !== "build"; // squads.js dug them in at the far end
        if (!job.dry && !(sq._pauseT > 0)) {
          while (job.i < job.rows.length) {
            const row = job.rows[job.i];
            if (!arrived && row.t > t + LAY_AHEAD) break;
            const r = layPieceAt(job, row);
            if (r === "dry") { job.dry = true; toast("NO SCRAP — THE LINE STOPS HERE"); break; }
            job.i++;
            if (r === "laid") {
              job.laid++;
              // A WALL IS A COMMITMENT: the squad stands still while it goes up.
              // squad._pauseT is the attack-leg dwell field, reused verbatim —
              // squads.js holds the anchor and issues no new leg, and no rng is
              // touched by either side of the arrangement.
              if (job.kind === "walls" && !arrived) { sq._pauseT = WALL_LAY_PAUSE_S; break; }
            } else job.skipped++;
          }
        }
        if (arrived || job.i >= job.rows.length) {
          if (arrived) sq._build = null; // the line is finished and so is the order
        }
      };
      // The order flow's ground taps, in one place. tapAt calls this with the
      // point its ray hit; the debug harness calls it with a world point
      // directly, so both drive the identical code.
      const consumeOrderTap = (p) => {
        const om = S.orderMode;
        if (!om) return false;
        const osq = selectedSquad();
        // OFF-MAP CLAMP (mk0.50): the tap ray hits the painted ground well past
        // the playable rim, and a squad ordered out there walks off the field
        // and never arrives. BOTH points of a build order clamp through here
        // too — this is THE site where a ground tap becomes a destination.
        const d = clampToRim(p.x, p.z);
        if (om === "attack" || om === "move") {
          if (osq) { osq.order = om; osq.dest = { x: d.x, z: d.z }; osq._legTarget = null; osq._pauseT = 0; osq._build = null; }
          S.orderMode = null;
          // COMMAND 1b (mk0.82): the order's final ground tap landed — the
          // squad is released (deselected), same as an instant order.
          S.selSquadId = null;
          return true;
        }
        if (om === "build_bags" || om === "build_walls") {
          if (!osq || osq.type !== "engineers") { S.orderMode = null; S.buildPt0 = null; S.selSquadId = null; return true; }
          if (!S.buildPt0) { S.buildPt0 = { x: d.x, z: d.z }; toast("LINE START — TAP THE FAR END"); return true; }
          startBuildLine(osq, om === "build_walls" ? "walls" : "bags", S.buildPt0, d);
          S.buildPt0 = null; S.orderMode = null;
          // COMMAND 1b (mk0.82): second tap completes the build order —
          // release the squad exactly as MOVE/ATTACK do above.
          S.selSquadId = null;
          return true;
        }
        return false;
      };
      const sellAt = (gx, gz) => {
        if (!grid.inBounds(gx, gz)) return;
        const cell = grid.cells[grid.idx(gx, gz)];
        const id = cell.wallId;
        if (!id || !world.byId.has(id)) { toast("NOTHING HERE"); return; }
        const b = world.byId.get(id);
        const refund = b.kind === "tower" ? Math.floor(TOWER_SPECS[b.towerType].cost * 0.6) : 3;
        // ONE cell, ONE structure — and since P1.5 T2 a wall is three courses
        // standing on that cell, so selling takes the whole stack. Matched by
        // FOOTPRINT (which cell each body stands on), never by id: ids do not
        // survive a save/resume, a wall never moves, and this is exactly the
        // rule the restore path re-claims cells by.
        const stack = b.kind === "wall"
          ? world.bodies.filter((w) => {
            if (w.kind !== "wall") return false;
            const wg = grid.worldToGrid(w.pos.x, w.pos.z);
            return wg.gx === gx && wg.gz === gz;
          })
          : [b];
        for (const s of stack) {
          forgetWelds(world, s);
          world.byId.delete(s.id);
          const bi = world.bodies.indexOf(s);
          if (bi >= 0) world.bodies.splice(bi, 1);
        }
        cell.wallId = null; cell.blocked = false;
        S.resources += refund;
        recomputeFlow();
        toast("+" + refund + " scrap");
      };
      const sellById = (id) => {
        const b = world.byId.get(id);
        if (!b) return;
        const g = grid.worldToGrid(b.pos.x, b.pos.z);
        sellAt(g.gx, g.gz);
        S.inspectId = null;
      };
      S.sellById = sellById;
      // COMMAND T1 (mk0.80): per-tower fire discipline toggle — the tower
      // radial's CAREFUL/FREE slot. Mirrors stepTowers's own fallback chain.
      S.setTowerDiscipline = (id) => {
        const b = world.byId.get(id);
        if (!b || b.kind !== "tower") return;
        b.discipline = (b.discipline || discipline || "careful") === "careful" ? "free" : "careful";
      };
      S.confirmPending = confirmPending;
      S.clearPending = clearPending;
      S.rotate = (d) => R.rotateStep(d);
      const onStructureLost = (b) => {
        for (const c of grid.cells) if (c.wallId === b.id) { c.wallId = null; c.blocked = false; }
        recomputeFlow();
      };
      const onRuin = () => recomputeFlow();

      const toNdc = (cx, cy) => {
        const r = canvas.getBoundingClientRect();
        return { x: ((cx - r.left) / Math.max(1, r.width)) * 2 - 1, y: -(((cy - r.top) / Math.max(1, r.height)) * 2 - 1) };
      };
      // pickHeightAt (mound-ray smallfix): height of the RENDERED terrain —
      // the same triangulated PlaneGeometry surface the player sees (two
      // triangles per grid quad, split on the b–d anti-diagonal, matching
      // THREE.PlaneGeometry's index order; syncTerrain maps vertex (i,j) to
      // F.h[j*n+i] 1:1) — NOT field.heightAt's bilinear patch. On convex
      // relief (the depot mound's crest) the bilinear surface bulges ABOVE
      // the drawn triangles, so a tap ray grazing the crest hit a phantom
      // bulge the player can't see and selected a nearer cell than the one
      // visibly under the cursor. Picking against the drawn surface makes
      // taps land where they look. Sim/physics still use field.heightAt —
      // this is view-space picking only.
      const pickHeightAt = (x, z) => {
        const F = field, fx = (x + F.half) / F.cs, fz = (z + F.half) / F.cs;
        let i = Math.floor(fx), j = Math.floor(fz);
        i = Math.max(0, Math.min(F.n - 2, i)); j = Math.max(0, Math.min(F.n - 2, j));
        const tx = Math.max(0, Math.min(1, fx - i)), tz = Math.max(0, Math.min(1, fz - j));
        const h00 = F.h[j * F.n + i], h10 = F.h[j * F.n + i + 1];
        const h01 = F.h[(j + 1) * F.n + i], h11 = F.h[(j + 1) * F.n + i + 1];
        return tx + tz <= 1
          ? h00 + tx * (h10 - h00) + tz * (h01 - h00)
          : h11 + (1 - tx) * (h01 - h11) + (1 - tz) * (h10 - h11);
      };
      const groundPoint = (cx, cy) => {
        const nd = toNdc(cx, cy);
        const cb = R.camBasis, cam = R._cam;
        const hw = cb.halfW(), hh = cb.halfH();
        const ox = cam.position.x + cb.right.x * nd.x * hw + cb.up.x * nd.y * hh;
        const oy = cam.position.y + cb.right.y * nd.x * hw + cb.up.y * nd.y * hh;
        const oz = cam.position.z + cb.right.z * nd.x * hw + cb.up.z * nd.y * hh;
        const f = cb.fwd;
        let lo = 0, hi = 400;
        let prev = 0, found = -1;
        // 0.75m march (was 1.5): a thin crest wholly inside one step would be
        // skipped and the tap would land BEHIND the visible ridge.
        for (let t = 0; t <= 400; t += 0.75) {
          const x = ox + f.x * t, y2 = oy + f.y * t, z = oz + f.z * t;
          if (y2 <= pickHeightAt(x, z)) { found = t; lo = prev; hi = t; break; }
          prev = t;
        }
        if (found < 0) return null;
        for (let i = 0; i < 12; i++) {
          const mid = (lo + hi) / 2;
          const x = ox + f.x * mid, y2 = oy + f.y * mid, z = oz + f.z * mid;
          if (y2 <= pickHeightAt(x, z)) hi = mid; else lo = mid;
        }
        const t = (lo + hi) / 2;
        return { x: ox + f.x * t, z: oz + f.z * t };
      };
      const tapAt = (cx, cy) => {
        if (!S.started || S.gameOver || S.victory) return;
        // any tap on the canvas while a placement is pending resolves it —
        // confirm/cancel are the ✓/✗ HTML buttons (separate DOM elements,
        // so their own onClick fires instead of this canvas handler); a tap
        // that reaches here is by definition "elsewhere" and cancels.
        // mk0.27: only while the ✓/✗ pair is actually ON SCREEN. Panned off
        // the viewport, the pending is invisible, and eating the player's
        // next ground tap to "resolve" it is a stolen tap.
        if (canvasTapConsumesPending(S.pending, S.pendingScreen, canvas.getBoundingClientRect())) { clearPending(); return; }
        if (S.pending) clearPending();
        const p = groundPoint(cx, cy);
        if (!p) { S.inspectId = null; return; }
        // Squad order flow: an armed ATTACK/MOVE consumes this ground tap as the
        // destination (flag marker renders at dest until arrival); an armed
        // BUILD consumes TWO — the line's start, then its far end (mk0.60).
        if (consumeOrderTap(p)) return;
        // Tap on a squad member selects his squad; tap elsewhere while one
        // is selected deselects (and consumes the tap — no accidental build).
        const tappedSquad = squadAtPoint(p);
        // COMMAND 1b (mk0.82): tapping a squad (selecting it, or re-tapping
        // the one already selected) opens/reopens the pie.
        if (tappedSquad) { S.selSquadId = tappedSquad.id; S.selArmedAt = world.t + PENDING_ARM_S; S.orderMode = null; S.buildPt0 = null; S.inspectId = null; S.pieOpen = true; return; }
        if (S.selSquadId != null) { S.selSquadId = null; S.orderMode = null; S.buildPt0 = null; S.pieOpen = false; return; }
        const g = grid.worldToGrid(p.x, p.z);
        if (!grid.inBounds(g.gx, g.gz)) { S.inspectId = null; return; }
        const cell2 = grid.cells[grid.idx(g.gx, g.gz)];
        if (S.sellMode) { S.inspectId = null; sellAt(g.gx, g.gz); return; }
        if (cell2.wallId && world.byId.has(cell2.wallId)) { S.inspectId = cell2.wallId; S.pieOpen = true; return; }
        S.inspectId = null;
        if (S.mode === "wall") { buildAt(g.gx, g.gz, "wall"); return; } // walls exempt: instant, as today
        if (S.mode === "sandbag") { placeSandbagAt(g.gx, g.gz); return; } // sandbags: instant, wall-exempt (brief)
        if (SQUAD_MODE[S.mode]) {
          const v = canPlaceInfantryAt(g.gx, g.gz, SQUAD_SPECS[SQUAD_MODE[S.mode]].cost);
          if (!v.ok) { toast(v.msg); return; }
          startPendingSquad(g.gx, g.gz, S.mode, v.wp);
          return;
        }
        const v = canBuildAt(g.gx, g.gz, S.mode);
        if (!v.ok) { toast(v.msg); return; }
        startPending(g.gx, g.gz, S.mode, v);
      };

      const pointers = new Map();
      let pinchD0 = 0, pinchZ0 = 1, dragTotal = 0, downPt = null;
      const onPointerDown = (e) => {
        A.ensure();
        canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.size === 1) { dragTotal = 0; downPt = { x: e.clientX, y: e.clientY }; }
        else if (pointers.size === 2) {
          const ps = [...pointers.values()];
          pinchD0 = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y);
          pinchZ0 = S.zoom;
          downPt = null;
        }
      };
      const onPointerMove = (e) => {
        S.pointer = { x: e.clientX, y: e.clientY };
        const pt = pointers.get(e.pointerId);
        if (!pt) return;
        const dx = e.clientX - pt.x, dy = e.clientY - pt.y;
        pt.x = e.clientX; pt.y = e.clientY;
        if (pointers.size === 1) {
          dragTotal += Math.hypot(dx, dy);
          if (dragTotal > 12) {
            const cb = R.camBasis;
            const r = canvas.getBoundingClientRect();
            const kx = (2 * cb.halfW()) / Math.max(1, r.width);
            const ky = (2 * cb.halfH()) / Math.max(1, r.height);
            S.focus.x -= cb.right.x * dx * kx - cb.up.x * dy * ky;
            S.focus.z -= cb.right.z * dx * kx - cb.up.z * dy * ky;
            S.focus.x = Math.max(-EXT.x, Math.min(EXT.x, S.focus.x));
            S.focus.z = Math.max(-EXT.z, Math.min(EXT.z, S.focus.z));
          }
        } else if (pointers.size === 2 && pinchD0 > 0) {
          const ps = [...pointers.values()];
          const d = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y);
          S.zoom = Math.max(0.5, Math.min(2.6, pinchZ0 * (d / pinchD0)));
          R.setZoom(S.zoom);
        }
      };
      const onPointerUp = (e) => {
        pointers.delete(e.pointerId);
        if (downPt && dragTotal <= 12 && pointers.size === 0) tapAt(e.clientX, e.clientY);
        if (pointers.size < 2) pinchD0 = 0;
        if (pointers.size === 0) downPt = null;
      };
      const onWheel = (e) => {
        e.preventDefault();
        S.zoom = Math.max(0.5, Math.min(2.6, S.zoom * (e.deltaY > 0 ? 0.9 : 1.11)));
        R.setZoom(S.zoom);
      };
      const onKey = (e, down) => { S.keys[e.key.toLowerCase()] = down; };
      const kd = (e) => { A.ensure(); if (e.key === "m" || e.key === "M") { A.setMuted(!A.muted); setHud((h) => ({ ...h, muted: A.muted })); } if (e.key === "q" || e.key === "Q") R.rotateStep(-1); if (e.key === "e" || e.key === "E") R.rotateStep(1); onKey(e, true); };
      const ku = (e) => onKey(e, false);
      const blockTouch = (e) => e.preventDefault();
      canvas.addEventListener("pointerdown", onPointerDown);
      canvas.addEventListener("pointermove", onPointerMove);
      canvas.addEventListener("pointerup", onPointerUp);
      canvas.addEventListener("pointercancel", onPointerUp);
      canvas.addEventListener("wheel", onWheel, { passive: false });
      canvas.addEventListener("touchstart", blockTouch, { passive: false });
      window.addEventListener("keydown", kd);
      window.addEventListener("keyup", ku);

      // --- THE FRONT, KEPT (P1 Task 3) -------------------------------------
      // One slot, written at every bell and nowhere else. saveFront draws the
      // resumed run's seed FIRST and unconditionally — that draw is the only
      // rng this feature spends, it happens exactly once per bell whatever
      // else goes right or wrong below, and the draw-count law holds because
      // saving is not optional (see save.js law 2). Serialization is
      // synchronous into a string; the store write is fire-and-forget so the
      // frame never awaits it.
      // --- THE CUE QUEUE (P1 Task 4) ---------------------------------------
      // Audio-only events for the bell cycle. They cannot ride world.events
      // directly: that array is wiped at the top of every frame's sim bracket
      // (see `world.events.length = 0` in the loop) and the bell — like every
      // UI tap — lands outside that bracket, so anything pushed there would be
      // erased unheard. Cues queue here instead and are merged into the drained
      // stream once per frame, downstream of the wipe, so A.consume hears each
      // exactly once. They carry a type and nothing else: no coordinates, no
      // randomness, no sim effect. R.consume ignores types it doesn't know.
      const cues = [];
      const cueN = {};   // debug tally only — see window.__DEPOTCUES__
      const cue = (type) => { cues.push({ type }); cueN[type] = (cueN[type] || 0) + 1; };
      // Last whole second the countdown was seen at — the pre-toll's edge.
      let preTollSec = null;

      let saveStat = null;
      const saveFront = () => {
        const rngSeed = Math.floor(world.rng() * 4294967296); // THE ONE DRAW — 1/bell, always
        try {
          const t0 = performance.now();
          const json = serializeFront({
            S, world, T, town, census: depotCensus, census2: depotCensus2,
            rocks: ROCKS, smears: R._splat ? R._splat.log : [],
            mapSeed: MAP_SEED, rngSeed,
          });
          saveStat = { ms: +(performance.now() - t0).toFixed(2), bytes: json.length, bell: S.bell };
          cue("uitick"); // the record was written — the one acknowledgement it gets
          // fire-and-forget, but never an unhandled rejection: a store that
          // refuses the write (quota, a runtime that says no) must cost the
          // frame nothing and must not surface as a page error.
          Promise.resolve(window.storage.set(SAVE_KEY, json)).catch(() => {});
        } catch (e) {
          console.warn("COLDSNAP front save failed", e);
          saveStat = { ms: -1, bytes: 0, bell: S.bell, error: String(e && e.message ? e.message : e) };
        }
      };
      // A lost war does not get replayed, and a won one has nothing left to
      // resume: the slot burns the moment the verdict lands, six seconds
      // BEFORE the end card mounts. Idempotent — the first verdict tick owns
      // it, same discipline as stampEnd.
      const burnSave = () => {
        if (S._saveBurned) return;
        S._saveBurned = true;
        burnFront();
      };

      // THE BELL rings here and nowhere else. Town pay closes the cycle
      // alongside the assault's results (fireBell books those): green ground
      // pays the player, red ground pays the regiment, seam ground nobody.
      const ringBell = () => {
        cue("bell"); // the toll itself, at the ring — before anything it causes
        const paid = payTown(townUV, T);
        S.resources += paid.player;
        if (S.reg) S.reg.scrap += paid.regiment;
        // fireBell runs the whole sequence and raises both cards; the assault
        // it musters marches regardless of whether either is ever read.
        fireBell(S, { reg: S.reg, snap: buildSnapshot(), rng: world.rng, t: world.t });
        // The convoy is heard when its card comes up, and only then — a bell
        // whose pool had nothing left to offer raises no card and makes no
        // truck noise.
        if (S.manifest && S.manifest.cardUp) cue("manifest");
        toast("BELL " + S.bell + " — THEY MARCH");
        // The income's ledger line: the bell's flat cycle scrap plus whatever
        // the town paid this bell (green ground only) — one honest number.
        toast("◆ +" + Math.round(BELL_SCRAP + paid.player) + " — CYCLE PAY");
        // ...and the front is written down. The muster has been planned and
        // the queue is full, but not one man has walked yet — this is the
        // state you would want back, so this is the state that is kept.
        saveFront();
      };
      // --- the bell's cards (Task 2). Nothing here touches the sim: they are
      // presentation state, armed on WORLD time via the same trailing-tap law
      // the ✓/✗ confirm pair lives under (PENDING_ARM_S), and they never gate
      // anything. The manifest chip re-opens a dismissed card until the NEXT
      // bell overwrites the offer.
      S.ackIntel = () => { S.intelUp = false; };
      S.openManifest = () => {
        const M = S.manifest;
        if (!M || M.offers.length === 0) return;
        M.cardUp = true;
        M.armedAt = world.t + PENDING_ARM_S;
      };
      S.dismissManifest = () => { if (S.manifest) S.manifest.cardUp = false; };
      S.pickManifest = (key) => {
        const M = S.manifest;
        if (!M || world.t < M.armedAt) { toast("HOLD — ARMING"); return; }
        if (!pickManifest(M, key)) return;
        cue("uitick"); // the pick is taken
        const item = PALETTE_LABEL[key] || key;
        toast(item + " — ON THE MANIFEST");
      };
      const spawnOne = () => {
        const ws = S.ws;
        const tag = nextSpawnTag(S);
        const sp = SPAWN_POINTS[S.spawnRR++ % SPAWN_POINTS.length];
        spawnEnemy(world, sp, tag);
        ws.spawnQueue--;
        // The withdrawal clock starts at spawn-completion, not at the bell —
        // a long assault gets its full window; only the aftermath is clamped
        // (withdrawDue's ASSAULT_TIMEOUT clause reads this).
        if (ws.spawnQueue <= 0) ws.spawnDoneT = world.t;
      };

      const breachRock = (b) => {
        const k = b.rockRef;
        if (!k) return;
        const { n, cs, h, half } = field;
        const i0 = Math.max(0, Math.floor((k.x - k.r * 1.7 + half) / cs)), i1 = Math.min(n - 1, Math.ceil((k.x + k.r * 1.7 + half) / cs));
        const j0 = Math.max(0, Math.floor((k.z - k.r * 1.7 + half) / cs)), j1 = Math.min(n - 1, Math.ceil((k.z + k.r * 1.7 + half) / cs));
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
          const px = i * cs - half, pz = j * cs - half;
          const d = Math.hypot(px - k.x, pz - k.z) / k.r;
          if (d < 1.6) h[j * n + i] -= k.h * Math.exp(-d * d * 2.1);
        }
        field.dirty = true;
        for (let gz = 0; gz < GRID_H; gz++) for (let gx = 0; gx < GRID_W; gx++) {
          const wp = grid.gridToWorld(gx, gz);
          if (Math.hypot(wp.x - k.x, wp.z - k.z) < k.r * 0.78 + 0.9) {
            const c = grid.cells[grid.idx(gx, gz)];
            if (c.terrain) { c.blocked = false; c.terrain = false; }
          }
        }
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * 6.28, rr = k.r * (0.2 + 0.5 * ((i * 7) % 5) / 5);
          const c = addBody(world, { kind: "chunk", team: 0, mass: 320, hx: 0.55, hy: 0.55, hz: 0.55, x: k.x + Math.cos(a) * rr, y: field.heightAt(k.x, k.z) + 1.2 + (i % 3) * 0.9, z: k.z + Math.sin(a) * rr, friction: 0.7, restitution: 0.02 });
          c.bornT = world.t;
        }
        const ri = rocksLive.indexOf(k);
        if (ri >= 0) rocksLive.splice(ri, 1);
        R.setDressing({ rocks: rocksLive, ponds: PONDS });
        recomputeFlow();
        toast("THE RIDGE IS BREACHED");
      };
      const drainEvents = () => {
        const evs = world.events.slice();
        world.events.length = 0;
        for (let i = world.bodies.length - 1; i >= 0; i--) {
          const rb = world.bodies[i];
          if (rb.kind === "rock" && !rb.alive) {
            breachRock(rb);
            world.byId.delete(rb.id);
            world.bodies.splice(i, 1);
          }
        }
        // Structure damage dealt this frame, attributed via b.lastHit —
        // there's no discrete per-hit damage event, so this rides the hp
        // delta since the last frame's snapshot (see structHp above).
        if (S.ws.results) {
          for (const b of world.bodies) {
            if (b.kind !== "wall" && b.kind !== "tower" && b.kind !== "building") continue;
            const prev = structHp.get(b.id);
            if (prev != null && b.hp < prev && b.lastHit && b.lastHit.attacker === "enemy") {
              S.ws.results.structureDmg += prev - b.hp;
            }
            structHp.set(b.id, b.hp);
          }
          for (const id of structHp.keys()) if (!world.byId.get(id)) structHp.delete(id);
        }
        for (const e of evs) {
          if (e.type === "tdkill") {
            S.resources += e.bounty; S.kills++;
          } else if (e.type === "kill") {
            if (e.attacker === "enemy" && S.ws.results) {
              if (e.kind === "tower") S.ws.results.towerKills++;
              // ONE wall pays ONE wallKill (P1.5 T2). A wall stands as three
              // courses and the enemy can chew through more than one of them;
              // the upper two carry WALL_UPPER_GROUP on the body, which rides
              // out on the kill event, so only the wall's own death pays.
              else if (e.kind === "wall" && e.group !== WALL_UPPER_GROUP) S.ws.results.wallKills++;
              else if (e.kind === "building") S.ws.results.buildingKills++;
            }
          }
        }
        // The single place a run flips to LOSS (depot destroyed, or the
        // stubbed regiment-destroyed hook) — same function depot-test.mjs
        // drives headlessly.
        checkLoss(S);
        return evs;
      };

      window.__DEPOT__ = () => ({ t: world.t, scrap: S.resources, kills: S.kills, bell: S.bell, bellT: S.bellT, bodies: world.bodies.length, fps: S.fps, paused: S.paused, speed: S.speed, reg: { ...S.reg }, depotStanding: S.depotStanding != null ? S.depotStanding : 1, breach: !!S.breach, enemyStanding: S.enemyStanding != null ? S.enemyStanding : 1, enemyBreach: !!S.enemyBreach, withdrew: S.ws.withdrew || 0, endedAt: S.endedAt != null ? S.endedAt : null, endCard: endCardReady(S, world.t) });
      // mk0.27 debug harness: the live pending + its screen anchor (smoke
      // asserts the tap-theft repairs through this).
      window.__DEPOTPENDING__ = () => (S.pending ? { armed: pendingArmed(S.pending, world.t), screen: S.pendingScreen, gx: S.pending.gx, gz: S.pending.gz } : null);
      window.__DEPOTBUILD__ = (gx, gz, mode) => buildAt(gx, gz, mode || "wall");
      // debug harness: world point -> grid cell, so a staging script can build
      // at a point __DEPOTFINDBUILDABLE__ handed it without driving the tap UI.
      window.__DEPOTGRIDAT__ = (x, z) => grid.worldToGrid(x, z);
      window.__DEPOTSPAWN__ = (n) => { for (let i = 0; i < (n || 1); i++) spawnEnemy(world, SPAWN_POINTS[S.spawnRR++ % SPAWN_POINTS.length]); };
      window.__DEPOTSTART__ = () => { S.started = true; };
      window.__DEPOTSETT__ = (t) => { world.t = t; world.wind = windAt(MAP_SEED, world.t); };
      window.__DEPOTFLAGS__ = () => world.bodies.filter((b) => b.flagPole).map((b) => ({ id: b.id, kind: b.kind, x: +b.pos.x.toFixed(2), y: +b.pos.y.toFixed(2), z: +b.pos.z.toFixed(2) }));
      window.__DEPOTTREES__ = () => world.bodies.filter((b) => b.kind === "tree").map((b) => ({ id: b.id, x: +b.pos.x.toFixed(2), z: +b.pos.z.toFixed(2), y: +b.pos.y.toFixed(2), hp: +b.hp.toFixed(1), alive: b.alive, burning: b.burning }));
      // P1.5 T2 staging harness: the live wall courses, the welds holding them
      // and the loose rubble — so a save/resume run can prove three courses,
      // two welds and a half-dead wall all came back, and a collapse run can
      // watch the uppers leave the wall set.
      window.__DEPOTWALLS__ = () => ({
        courses: world.bodies.filter((b) => b.kind === "wall").map((b) => ({
          course: b.course != null ? b.course : -1, hp: +b.hp.toFixed(1), maxHp: b.maxHp, cap: !!b.capTop,
          x: +b.pos.x.toFixed(2), y: +b.pos.y.toFixed(2), z: +b.pos.z.toFixed(2),
        })),
        welds: world.welds.filter((w) => !w.broken && w.a.kind === "wall" && w.b.kind === "wall").length,
        fallen: world.bodies.filter((b) => b.kind === "chunk" && !b.town && !b.sandbag && b.invM > 0 && b.mass === 100 && b.hy > 0.2).length,
      });
      window.__DEPOTMG__ = (tx, ty, tz) => {
        // debug harness: fire a single mg round at a point (a tree, typically)
        // from 3m out — used for smoke-testing tree shredding under
        // depotCombat, same shot shape combat-test.mjs uses
        const from = { x: tx, y: ty, z: tz - 3 };
        fireProjectile(world, from, { x: 0, y: 0, z: 1 }, 90,
          { kind: "mg", r: 0.05, kv: 0.3, dmg: 1, crater: 0, attacker: "player" });
      };
      window.__DEPOTSHELL__ = (tx, ty, tz) => {
        // debug harness: a real GUN-tower round (noImpact:true, matching
        // TOWER_SPECS.gun and towerShot's fireProjectile call exactly — the
        // flat +55 point-blank impact bonus only applies to non-noImpact
        // specs, which a live tower never fires). A direct shell hit sets
        // tree.burning and, at 70hp (Task 5), leaves it alive to burn down
        // ~2hp/s rather than dying in the same tick.
        const from = { x: tx, y: ty, z: tz - 3 };
        fireProjectile(world, from, { x: 0, y: 0, z: 1 }, 90,
          { kind: "shell", r: 2.3, kv: 8, dmg: 25, crater: 0.55, noImpact: true, attacker: "player" });
      };
      window.__DEPOTTHIN__ = () => {
        // debug harness: instantly clear the field — zero the spawn queue and
        // kill every live enemy — so tests can empty an assault without
        // waiting real time for it to walk (smoke.mjs uses this to stay
        // inside its budget under swiftshader).
        S.ws.spawnQueue = 0;
        for (const b of world.bodies) if (b.kind === "unit" && b.team === 2 && b.alive) applyDamage(world, b, 1e6, { cause: "BLAST", attacker: "player" });
      };
      window.__DEPOTWEDGE__ = () => {
        // debug harness: wedge the current assault — drain the spawn queue and
        // backdate its clock past ASSAULT_TIMEOUT so the next tick times out
        // and every live enemy withdraws (instead of waiting 75 real seconds).
        S.ws.spawnQueue = 0;
        S.ws.withdrawn = false;
        S.ws.spawnDoneT = world.t - (ASSAULT_TIMEOUT + 1);
      };
      window.__DEPOTBELL__ = (inS = 0) => {
        // debug harness: ring the bell now — pulls the next assault forward
        // without waiting out the period. An argument moves the due stamp that
        // many SIM seconds out instead (P1 T4: reaching the pre-toll window
        // without waiting two minutes).
        S.bellAt = world.t + Math.max(0, inS);
      };
      // debug harness (P1 T4): how many of each audio cue this run has raised.
      // Audio cannot be asserted headlessly; this at least proves the cues are
      // pushed where the design says they are.
      window.__DEPOTCUES__ = () => ({ ...cueN });
      window.__DEPOTMANIFEST__ = () => ({
        unlocked: S.manifest.unlocked.slice(), offers: S.manifest.offers.slice(),
        offerBell: S.manifest.offerBell, cardUp: !!S.manifest.cardUp,
        armed: world.t >= S.manifest.armedAt, intelUp: !!S.intelUp,
        foe: S.foe.unlocked.slice(),
      });
      window.__DEPOTPICK__ = (key) => { S.pickManifest(key); return S.manifest.unlocked.slice(); };
      // debug harness (P1 T3): what the last bell's save cost and whether this
      // mount is a resume. Reading it costs nothing; the numbers are recorded
      // by saveFront itself, not measured on demand.
      window.__DEPOTSAVE__ = () => ({ resumed: !!RES, burned: !!S._saveBurned, last: saveStat });
      window.__DEPOTEND__ = (victory) => {
        // debug harness: force the run into its end state for screenshotting
        // the WIN/LOSS end card without simming 50 waves — pattern matches
        // the other window.__DEPOT*__ hooks above.
        if (victory) { S.victory = true; S.enemyBreach = true; } else { S.gameOver = true; S.breach = true; }
      };
      window.__DEPOTPAIR__ = (x, z) => {
        // debug harness (6.5 Task 6): field a sniper PAIR at a world point,
        // cost-free — smoke asserts the spotter climbs / the sniper settles
        // and frames the screenshot without driving the placement UI.
        const sq = makeSquad(S.nextSquadId++, "sniper", 1, x, z);
        spawnSquadMembers(world, sq);
        S.squads.push(sq);
        return sq.id;
      };
      window.__DEPOTPAIRSTATE__ = (id) => {
        const sq = S.squads.find((q) => q.id === id);
        if (!sq) return null;
        return {
          type: sq.type,
          spotGoal: sq._spotGoal || null, snipeGoal: sq._snipeGoal || null,
          members: sq.memberIds.map((mid) => { const u = world.byId.get(mid); return u && { role: u.role || null, x: +u.pos.x.toFixed(2), z: +u.pos.z.toFixed(2), settled: !!u.settled, alive: u.alive }; }),
        };
      };
      window.__DEPOTCELL__ = (x, z) => {
        // debug harness: the grid's verdict on one world point — the same four
        // facts validatePlacement asks about, so a staging run can choose ground
        // that is actually buildable instead of walking a line into a ridge.
        const g = grid.worldToGrid(x, z);
        if (!grid.inBounds(g.gx, g.gz)) return null;
        const cell = grid.cells[grid.idx(g.gx, g.gz)];
        const wp = grid.gridToWorld(g.gx, g.gz), c0 = invW(wp.x, wp.z);
        return { gx: g.gx, gz: g.gz, x: +wp.x.toFixed(2), z: +wp.z.toFixed(2),
          blocked: !!(cell.blocked || cell.wallId), ice: !!cell.ice, held: canBuild(T, c0.u, c0.v) };
      };
      window.__DEPOTSQUAD__ = (type, x, z) => {
        // debug harness (P1.5 T4): field ANY squad type at a world point,
        // cost-free — __DEPOTPAIR__ generalised, so a staging run can put an
        // engineer team on the ground without driving the placement UI.
        if (!SQUAD_SPECS[type]) return null;
        const sq = makeSquad(S.nextSquadId++, type, 1, x, z);
        spawnSquadMembers(world, sq);
        S.squads.push(sq);
        return sq.id;
      };
      window.__DEPOTORDER__ = (id, kind, pts) => {
        // debug harness (P1.5 T4): give a squad an order through the REAL order
        // path — S.orderSquad arms the chip, consumeOrderTap eats the ground
        // points (one for ATTACK/MOVE, two for a build line). Only the camera
        // raycast is skipped; every clamp, gate and arming rule still applies.
        const sq = S.squads.find((q) => q.id === id);
        if (!sq) return null;
        S.selSquadId = id; S.selArmedAt = 0; S.orderMode = null; S.buildPt0 = null;
        S.orderSquad(kind);
        for (const p of (pts || [])) consumeOrderTap(p);
        return { order: sq.order, dest: sq.dest, armed: S.orderMode, pt0: S.buildPt0,
          build: sq._build ? { kind: sq._build.kind, cells: sq._build.rows.length, phase: sq._build.phase, orient: sq._build.orient } : null };
      };
      window.__DEPOTFOCUS__ = (x, z, zoom) => {
        // debug harness: point the camera at a world point (e.g. a tree) so
        // smoke-test screenshots can frame a specific body tightly
        S.focus.x = x; S.focus.z = z; S.focus.y = field.heightAt(x, z);
        if (zoom) { S.zoom = zoom; R.setZoom(zoom); }
      };
      // debug harness: read the current camera focus (canvas-center world
      // point) — used by the smoke test's rotation-invariance check to know
      // the intended build cell without racing the render loop's tween.
      window.__DEPOTGETFOCUS__ = () => ({ x: S.focus.x, z: S.focus.z });
      window.__DEPOTHOLD__ = (x, z) => { const c = invW(x, z); return holderAt(T, c.u, c.v); };
      // VISION (mk0.72): the sight census — how many cells each side can see
      // right now. Sight is derived and never saved, so this is also the
      // resume check: after a reload the count comes back on the first
      // territory tick, from nothing but the bodies on the field.
      window.__DEPOTSIGHT__ = () => {
        const a = T.sight.seen1, b = T.sight.seen2;
        let lit1 = 0, lit2 = 0;
        for (let i = 0; i < a.length; i++) { lit1 += a[i]; lit2 += b[i]; }
        return { cells: a.length, lit1, lit2 };
      };
      window.__DEPOTSELREACH__ = () => {
        // Task 2b: reports whichever fan is live — selected squad first,
        // else the inspected tower's cached fan (kind flags the source).
        const r = S.selReach || (S.inspectReach && S.inspectReach.pts ? S.inspectReach : null);
        if (!r) return null;
        return { id: r.id, kind: r === S.selReach ? "squad" : "tower", n: r.pts.length, cx: +r.cx.toFixed(2), cz: +r.cz.toFixed(2), maxR: +Math.max(...r.pts.map((p) => Math.hypot(p.x - r.cx, p.z - r.cz))).toFixed(2) };
      };
      // debug harness (Task 2): the nearest buildable+held cell to the depot
      // flag. Build rights now gate placement on holderAt===1 — the depot's
      // own emitter greens ground near itself, but the smoke test's original
      // build-tap point (canvas center at the initial camera focus) sits
      // well outside that radius on the pinned seed. The smoke test polls
      // this until non-null, then points the camera there before tapping.
      // clearR (optional, Task 3): also require no tower/wall/sandbag body
      // within clearR meters of the cell — squad members spawn on a 1.2m
      // ring and seek 2.4m formation slots, and a slot inside a static body
      // gets a man ejected/crushed by contact resolution (found live in the
      // Task 3 smoke: 1 of 4 riflemen died at spawn next to the mg tower).
      window.__DEPOTFINDBUILDABLE__ = (clearR) => {
        const flag = world.bodies.find((b) => b.kind === "flag");
        if (!flag) return null;
        let best = null, bestD = 1e9;
        for (let gz = 0; gz < GRID_H; gz++) for (let gx = 0; gx < GRID_W; gx++) {
          const cell = grid.cells[grid.idx(gx, gz)];
          if (cell.blocked || cell.wallId || cell.ice) continue;
          const wp = grid.gridToWorld(gx, gz);
          const c = invW(wp.x, wp.z);
          if (!canBuild(T, c.u, c.v)) continue;
          if (clearR && world.bodies.some((b) => b.alive && (b.kind === "tower" || b.kind === "wall" || b.kind === "rock" || b.kind === "tree" || b.kind === "chunk") &&
            Math.hypot(wp.x - b.pos.x, wp.z - b.pos.z) < clearR)) continue;
          const d = Math.hypot(wp.x - flag.pos.x, wp.z - flag.pos.z);
          if (d < bestD) { bestD = d; best = { x: wp.x, z: wp.z }; }
        }
        return best;
      };
      // Screenshot harness only (Task 3 verification, not a smoke-test dep):
      // the highest buildable+held cell within reach of the flag, and the
      // buildable+held cell nearest a live rock — so a ring-on-a-rise and a
      // ring-bitten-by-an-obstacle shot can be composed deterministically
      // on the pinned seed instead of eyeballing the procedural map.
      window.__DEPOTFINDRISE__ = () => {
        const flag = world.bodies.find((b) => b.kind === "flag");
        if (!flag) return null;
        let best = null, bestY = -1e9;
        for (let gz = 0; gz < GRID_H; gz++) for (let gx = 0; gx < GRID_W; gx++) {
          const cell = grid.cells[grid.idx(gx, gz)];
          if (cell.blocked || cell.wallId || cell.ice) continue;
          const wp = grid.gridToWorld(gx, gz);
          const c = invW(wp.x, wp.z);
          if (!canBuild(T, c.u, c.v)) continue;
          if (Math.hypot(wp.x - flag.pos.x, wp.z - flag.pos.z) > 40) continue;
          const y = field.heightAt(wp.x, wp.z);
          if (y > bestY) { bestY = y; best = { x: wp.x, z: wp.z, y }; }
        }
        return best;
      };
      window.__DEPOTFINDNEARROCK__ = () => {
        const rocks = world.bodies.filter((b) => b.kind === "rock" && b.alive);
        let best = null, bestD = 1e9;
        for (let gz = 0; gz < GRID_H; gz++) for (let gx = 0; gx < GRID_W; gx++) {
          const cell = grid.cells[grid.idx(gx, gz)];
          if (cell.blocked || cell.wallId || cell.ice) continue;
          const wp = grid.gridToWorld(gx, gz);
          const c = invW(wp.x, wp.z);
          if (!canBuild(T, c.u, c.v)) continue;
          for (const r of rocks) {
            const d = Math.hypot(wp.x - r.pos.x, wp.z - r.pos.z);
            if (d < bestD && d > 2) { bestD = d; best = { x: wp.x, z: wp.z }; }
          }
        }
        return best;
      };
      // Task 4 debug hooks: DOM/pixel-cheap fog asserts for smoke.mjs.
      // __DEPOTFOGDBG__ reports the renderer's own per-frame count of
      // team-2-alive bodies vs how many it actually rendered (some hidden
      // by fog when unheld) — no pixel sampling needed. __DEPOTFOGAT__
      // exposes fogStateFor at a world point for direct state checks.
      window.__DEPOTFOGDBG__ = () => R.getFogDebug();
      window.__DEPOTFOGAT__ = (x, z) => { const c = invW(x, z); return fogStateFor(T, c.u, c.v, 1); };
      // Task 3 debug hooks: squad + sandbag state reads for smoke.mjs, plus
      // the live center-ray ground point — the camera pivot TWEENS toward
      // S.focus, so a fixed post-focus sleep lands taps meters off under
      // swiftshader; the smoke polls this until it converges instead.
      window.__DEPOTGROUNDAT__ = (cx, cy) => groundPoint(cx, cy);
      // ...and the inverse: a world point's current client-pixel position,
      // so the smoke can tap a KNOWN cell instead of hoping the tweening
      // center ray lands on one.
      window.__DEPOTSCREENAT__ = (x, z) => {
        if (!R.project) return null;
        // pickHeightAt, not heightAt: project the point where it is DRAWN,
        // so the projection round-trips with groundPoint's mesh picking.
        const nd = R.project(x, pickHeightAt(x, z), z);
        if (!nd) return null;
        const rect = canvas.getBoundingClientRect();
        return { x: rect.left + (nd.x * 0.5 + 0.5) * rect.width, y: rect.top + (-nd.y * 0.5 + 0.5) * rect.height };
      };
      window.__DEPOTSQUADS__ = () => S.squads.map((sq) => ({
        id: sq.id, type: sq.type, order: sq.order,
        anchor: { x: +sq.anchor.x.toFixed(2), z: +sq.anchor.z.toFixed(2) },
        dest: sq.dest ? { x: +sq.dest.x.toFixed(2), z: +sq.dest.z.toFixed(2) } : null,
        sel: S.selSquadId === sq.id, ordering: S.selSquadId === sq.id && S.orderMode === "attack",
        // P1.5 T4: the live build job, if any — kind, how far down the cell list
        // the laying has got, what actually went down and what was skipped.
        build: sq._build ? {
          kind: sq._build.kind, phase: sq._build.phase, cells: sq._build.rows.length,
          i: sq._build.i, laid: sq._build.laid, skipped: sq._build.skipped, dry: !!sq._build.dry,
          pause: +(sq._pauseT || 0).toFixed(2), orient: sq._build.orient,
        } : null,
        members: sq.memberIds.map((id) => {
          const u = world.byId.get(id);
          return u ? { id, x: +u.pos.x.toFixed(2), z: +u.pos.z.toFixed(2), alive: u.alive } : null;
        }).filter(Boolean),
      }));
      window.__DEPOTSANDBAGS__ = () => world.bodies.filter((b) => b.sandbag).map((b) => ({ id: b.id, x: +b.pos.x.toFixed(2), z: +b.pos.z.toFixed(2), hx: b.hx, hz: b.hz, alive: b.alive }));
      window.__DEPOTENEMYPOS__ = () => {
        const b = world.bodies.find((b2) => b2.kind === "unit" && b2.alive && b2.team === 2);
        return b ? { x: b.pos.x, y: b.pos.y, z: b.pos.z } : null;
      };

      let last = performance.now();
      const STEP = 1 / 120;
      // mk0.35 — THE STOPWATCH (?perf=1). A measurement probe, not a feature:
      // it brackets the fixed-step sim block and the R.render call and drops
      // the pair into a ring buffer that scripts/diag-perf.mjs reads back.
      // The flag is resolved ONCE, here — with no ?perf=1 in the URL every
      // probe site below is a single already-false boolean test, nothing is
      // allocated, nothing is sampled and window.__DEPOTPERF__ never exists.
      // Typed arrays, never per-frame objects, so the stopwatch cannot feed
      // the garbage collector it is trying to measure. Body/chunk counts are
      // sampled at ~1Hz (the census cadence), not per frame.
      const perf = new URLSearchParams(window.location.search).get("perf") === "1";
      const PCAP = 4096; // ~68s at 60fps, ~136s at 30 — a 60s window always fits
      let pT = null, pSimA = null, pRenA = null, pFrmA = null, pDrewA = null;
      let pI = 0, pN = 0, pSampT = 0, pBodies = 0, pChunksDrawn = 0, pChunksTotal = 0;
      if (perf) {
        pT = new Float64Array(PCAP); pSimA = new Float64Array(PCAP);
        pRenA = new Float64Array(PCAP); pFrmA = new Float64Array(PCAP);
        pDrewA = new Uint8Array(PCAP);
        window.__DEPOTPERF__ = () => {
          const n = Math.min(pN, PCAP), out = [];
          for (let k = 0; k < n; k++) {
            const j = (pI - n + k + PCAP) % PCAP; // oldest-first
            out.push({ t: pT[j], sim: pSimA[j], render: pRenA[j], frame: pFrmA[j], drew: !!pDrewA[j] });
          }
          return {
            n, cap: PCAP, overflowed: pN > PCAP,
            bodies: pBodies, chunksDrawn: pChunksDrawn, chunksTotal: pChunksTotal,
            frames: out,
          };
        };
        window.__DEPOTPERF__.reset = () => { pI = 0; pN = 0; };
      }
      const frame = (now) => {
        if (disposed) return;
        raf = requestAnimationFrame(frame);
        let dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        const pFrame0 = perf ? performance.now() : 0;
        let pSim = 0, pRen = 0, pDrew = 0;
        try {
          S.fpsAcc += dt; S.fpsN++;
          if (S.fpsAcc > 0.5) { S.fps = Math.round(S.fpsN / S.fpsAcc); S.fpsAcc = 0; S.fpsN = 0; }
          // mk0.29 (savor the fall): the verdict no longer freezes the world.
          // It stamps the clock; the collapse plays out for END_CARD_DELAY_S
          // of world time, and only when the card is actually up does the sim
          // stop. Orders and building are locked from the verdict itself.
          stampEnd(S, world.t);
          // The record burns with the war, and it burns FIRST — the end card
          // is still six world-seconds away when this runs.
          if (S.gameOver || S.victory) burnSave();
          const cardUp = endCardReady(S, world.t);
          const sdt = S.paused || !S.started || cardUp ? 0 : dt * S.speed;
          const pan = 34 * dt / Math.max(0.5, S.zoom);
          // screen-relative like touch drag: W = screen-up whatever the Q/E yaw
          const cb = R.camBasis;
          const ul = Math.hypot(cb.up.x, cb.up.z) || 1, rl = Math.hypot(cb.right.x, cb.right.z) || 1;
          const ux = cb.up.x / ul, uz = cb.up.z / ul, rx = cb.right.x / rl, rz = cb.right.z / rl;
          if (S.keys.w || S.keys.arrowup) { S.focus.x += ux * pan; S.focus.z += uz * pan; }
          if (S.keys.s || S.keys.arrowdown) { S.focus.x -= ux * pan; S.focus.z -= uz * pan; }
          if (S.keys.a || S.keys.arrowleft) { S.focus.x -= rx * pan * 0.8; S.focus.z -= rz * pan * 0.8; }
          if (S.keys.d || S.keys.arrowright) { S.focus.x += rx * pan * 0.8; S.focus.z += rz * pan * 0.8; }
          S.focus.x = Math.max(-EXT.x, Math.min(EXT.x, S.focus.x));
          S.focus.z = Math.max(-EXT.z, Math.min(EXT.z, S.focus.z));
          S.focus.y = field.heightAt(S.focus.x, S.focus.z);
          if (!isTouch && S.pointer && S.started && !S.gameOver && !S.victory && !S.pending) {
            const p = groundPoint(S.pointer.x, S.pointer.y);
            if (p) {
              const g = grid.worldToGrid(p.x, p.z);
              if (grid.inBounds(g.gx, g.gz)) {
                const cell = grid.cells[grid.idx(g.gx, g.gz)];
                const wp = grid.gridToWorld(g.gx, g.gz);
                const spec = S.mode === "wall" ? null : TOWER_SPECS[S.mode];
                S.hover = { x: wp.x, z: wp.z, valid: !cell.blocked && !cell.wallId && !cell.ice, range: spec ? spec.range : 0 };
              } else S.hover = null;
            } else S.hover = null;
          } else S.hover = null;
          if (S.inspectId) {
            const ib = world.byId.get(S.inspectId);
            if (!ib) { S.inspectId = null; S.inspectReach = null; }
            else {
              const ispec = ib.kind === "tower" ? TOWER_SPECS[ib.towerType] : null;
              if (ispec && ib.towerType !== "frost") {
                // Task 2b: an inspected GUN tower shows its true reach fan
                // (towerReachCached: real muzzle, fog-independent, computed
                // once per selection — static body). Frost keeps its aura
                // ring below (it is not a gun); walls keep no fan.
                if (!S.inspectReach) S.inspectReach = {};
                towerReachCached(S.inspectReach, world, ib, ispec, invW);
                S.hover = { x: ib.pos.x, z: ib.pos.z, valid: true, range: 0 };
              } else {
                S.inspectReach = null;
                S.hover = { x: ib.pos.x, z: ib.pos.z, valid: true, range: ispec ? ispec.range : 0 };
              }
            }
          } else S.inspectReach = null;
          // Selected squad: ring overlay at the anchor via the EXISTING hover
          // overlay API (read-only use — renderer belongs to a parallel
          // task). Ring radius = the squad's own weapon range.
          const selSq = S.selSquadId != null ? S.squads.find((q) => q.id === S.selSquadId) : null;
          // Honest ring: ring + chip render at the LIVE-MEMBER CENTROID, not
          // squad.anchor — the anchor is a virtual march point and can lead
          // the men (rubber-band bounds it to COHESION_M, but the ring should
          // sit on the troops, not the ghost). Render-only; falls back to the
          // anchor if no member is alive this frame.
          let sqCx = 0, sqCz = 0;
          if (selSq) {
            let nLive = 0;
            for (const id of selSq.memberIds) {
              const u = world.byId.get(id);
              if (u && u.alive) { sqCx += u.pos.x; sqCz += u.pos.z; nLive++; }
            }
            if (nLive) { sqCx /= nLive; sqCz /= nLive; }
            else { sqCx = selSq.anchor.x; sqCz = selSq.anchor.z; }
          }
          if (selSq) {
            // Every selected squad shows the TRUE reach fan (Task 2b: the
            // sniper's path, generalized to rifles/mg) — squadReach fires
            // from the member's head (pos.y + 0.5, squadFire's own muzzle),
            // elevation-scaled and terrain/solid-clipped, fog-independent
            // like the placement preview (null territory: what he COULD
            // see). The old flat spec.range ring read from the anchor's
            // ground and under-sold every elevated or crest-line shooter.
            // 1Hz refresh: defend micro-shuffles and attack legs move him.
            if (!S.selReach || S.selReach.id !== selSq.id || world.t - S.selReach.t > 1) {
              const u0 = selSq.memberIds.map((id) => world.byId.get(id)).find((u) => u && u.alive);
              const pts = u0 ? squadReach(world, selSq, null, invW) : null;
              S.selReach = pts ? { id: selSq.id, t: world.t, pts, cx: u0.pos.x, cz: u0.pos.z } : null;
            }
            S.hover = { x: sqCx, z: sqCz, valid: true, range: 0 };
          } else S.selReach = null;
          const ws = S.ws;
          if (S.started && !S.gameOver && !S.victory) {
            // THE CLOCK. Read off world.t — the fixed-step sim clock — never
            // wall time and never a React value; a paused run holds the bell
            // exactly where it stood because world.t stops with it.
            if (stepBell(S, world.t)) ringBell();
            // THE PRE-TOLL (Task 4). The last five seconds are counted out
            // loud. Edge-triggered on the countdown crossing each whole second
            // — ceiling-rounded exactly as the chip reads it — so it fires once
            // per second at any frame rate, once at 30fps and once at 120, and
            // not at all while paused (S.bellT only moves with world.t). The
            // ring itself resets bellT upward, which is not a crossing
            // downward, so the bell never gets a sixth tick.
            const bellSec = Math.ceil(S.bellT);
            if (bellSec !== preTollSec) {
              if (preTollSec != null && bellSec < preTollSec && bellSec >= 1 && bellSec <= 5) cue("pretoll");
              preTollSec = bellSec;
            }
            if (ws.spawnQueue > 0) {
              ws.spawnTimer -= sdt;
              if (ws.spawnTimer <= 0) { ws.spawnTimer = ws.spawnDelay; spawnOne(); }
            } else if (withdrawDue(S, world.t)) {
              // A spent assault breaks contact on its own clock. Silent exit
              // — no kill events, no bounty, no smears; heads/tanks return to
              // the regiment inside executeWithdrawal. The bell is unmoved by
              // it: the next assault comes on schedule regardless.
              const w = executeWithdrawal(S, world);
              if (w.inf + w.tanks > 0) toast("THEY BREAK CONTACT");
            }
            // Between bells nothing pauses: build, orders and combat with
            // whatever is still standing all run straight through.
            S.resources += 2.2 * sdt;
          }
          S.acc += sdt;
          terrAcc += sdt;
          let terrGuard = 0;
          while (terrAcc >= TERR_STEP && terrGuard++ < 8) {
            terrAcc -= TERR_STEP;
            stepTerritory(T, buildEmitters(), TERR_STEP);
          }
          // Sight rides the same 4Hz clock the territory field does. ONE
          // recompute per frame, after the catch-up loop rather than inside
          // it: a recompute reads only the world's current bodies, so running
          // it twice in a row would burn the time and give the same map.
          if (terrGuard > 0) stepSight(world, T.sight, invW, fwdU);
          // grid-line retint + terrain fog wash: same 4Hz cadence as the
          // territory field itself, not per frame (see renderer.js
          // updateTerritory/retintTerritory/updateFogWash).
          if (terrGuard > 0 && R.updateTerritory) R.updateTerritory();
          world.events.length = 0;
          const pSim0 = perf ? performance.now() : 0; // stopwatch: sim bracket opens
          let guard = 0;
          while (S.acc >= STEP && guard++ < 6) {
            S.acc -= STEP;
            stepDepot(world, grid, onStructureLost, town, onRuin, T, S.discipline, S);
          }
          if (perf) pSim = performance.now() - pSim0; // ...and closes
          if (S.acc > STEP * 6) S.acc = 0;
          const evs = drainEvents();
          // ...and the frame's audio-only cues join the stream here, after the
          // wipe that would have eaten them (see the cue queue above).
          if (cues.length) { for (const c of cues) evs.push(c); cues.length = 0; }
          // Structural loss census — ~1Hz (stepDepotCensus's own accumulator
          // gate, not this per-frame call site) — gated by sdt like the rest
          // of the sim clock, so it doesn't run while paused/pre-start/
          // post-game. Fraction is exposed on hud for the smoke test; there
          // is deliberately no health-bar UI — the building is the readout.
          stepDepotCensus(S, sdt, () => ({
            player: depotStandingFraction(depotCensus, world.byId),
            enemy: depotStandingFraction(depotCensus2, world.byId),
          }));
          R.consume(evs);
          A.setListener(S.focus.x, S.focus.z, 46 / Math.max(0.6, S.zoom));
          A.consume(evs);
          A.tick(world, dt);
          if (S.hover) {
            // Sandbag ghost: oriented footprint read LIVE each frame — the
            // toggle (and auto-continue near an existing line) re-renders the
            // preview immediately, never a cached orientation.
            const pad = S.mode === "sandbag" && !S.sellMode && !S.inspectId && S.selSquadId == null
              ? (sandbagOrientAt(world, S.hover.x, S.hover.z, S.sandbagOrient || 0) === 1 ? { x: 0.7, z: 1.8 } : { x: 1.8, z: 0.7 })
              : GRID_CS;
            R.overlay.setHover(true, S.hover.x, S.hover.z, field.heightAt(S.hover.x, S.hover.z), S.hover.range, S.hover.valid, pad);
          }
          else R.overlay.setHover(false);
          if (S.pending) {
            const P0 = S.pending;
            R.overlay.setPending(true, P0.wp.x, P0.y, P0.wp.z, P0.poly, P0.ringR, P0.color);
          } else R.overlay.setPending(false);
          if (R.overlay.setReach) {
            // One overlay slot, one look: squad fan wins if a squad is
            // selected, else the inspected tower's cached fan (Task 2b).
            const fan = S.selReach || (S.inspectReach && S.inspectReach.pts ? S.inspectReach : null);
            if (fan) R.overlay.setReach(true, fan.cx, field.heightAt(fan.cx, fan.cz), fan.cz, fan.pts, 0xffd27a);
            else R.overlay.setReach(false);
          }
          // mk0.53: the mk0.34 draw gate is gone — every frame draws (the
          // evidence run showed physics, not drawing, owns the frame budget).
          {
            const pRen0 = perf ? performance.now() : 0; // stopwatch: draw bracket
            R.render(dt, S.focus, AIM_OFF, 0);
            if (perf) { pRen = performance.now() - pRen0; pDrew = 1; }
            // ✓/✗ screen-space anchor (Task 3): rotation-proof because it's
            // recomputed from the live camera via project() — Q/E view
            // rotation or a pan moves the cell's projected point, and this
            // just follows it, rather than being pinned once at tap time.
            // Written to a ref-adjacent plain field on S (not React state)
            // so it doesn't force a rerender every frame; the hud tick
            // below (throttled to ~8Hz) is what actually pushes it to React.
            if (S.pending) {
              const P0 = S.pending;
              const nd = R.project ? R.project(P0.wp.x, P0.y + 1.6, P0.wp.z) : null;
              if (nd) {
                const rect = canvas.getBoundingClientRect();
                S.pendingScreen = { x: rect.left + (nd.x * 0.5 + 0.5) * rect.width, y: rect.top + (-nd.y * 0.5 + 0.5) * rect.height };
              } else S.pendingScreen = null;
              // mk0.27: pan/rotate far enough and the ✓/✗ pair leaves the
              // viewport — an invisible pending that still eats taps. Cancel
              // it out loud the moment its anchor goes off screen.
              if (!pendingButtonsVisible(S.pendingScreen, canvas.getBoundingClientRect())) {
                clearPending(); S.pendingScreen = null; toast("PLACEMENT CANCELLED — MOVED OFF SCREEN");
              }
            } else S.pendingScreen = null;
            // Squad chip + attack-flag anchors: screen-space, recomputed from
            // the live camera (rotation/pan-proof, same rationale as
            // pendingScreen above).
            if (selSq && R.project) {
              const rect2 = canvas.getBoundingClientRect();
              const toScreen = (x, y, z) => {
                const nd = R.project(x, y, z);
                return nd ? { x: rect2.left + (nd.x * 0.5 + 0.5) * rect2.width, y: rect2.top + (-nd.y * 0.5 + 0.5) * rect2.height } : null;
              };
              S.squadScreen = toScreen(sqCx, field.heightAt(sqCx, sqCz) + 2.2, sqCz);
              S.flagScreen = selSq.dest ? toScreen(selSq.dest.x, field.heightAt(selSq.dest.x, selSq.dest.z) + 1.6, selSq.dest.z) : null;
            } else { S.squadScreen = null; S.flagScreen = null; }
            // Tower radial anchor (COMMAND T1, mk0.80): the same screen-space
            // convention as the squad chip anchor above — projected off the
            // tower's top from the live camera every frame, rotation/pan-proof.
            if (S.inspectId && R.project) {
              const ib2 = world.byId.get(S.inspectId);
              if (ib2 && ib2.kind === "tower") {
                const rect3 = canvas.getBoundingClientRect();
                const nd3 = R.project(ib2.pos.x, ib2.pos.y + ib2.hy + 1.2, ib2.pos.z);
                S.towerScreen = nd3 ? { x: rect3.left + (nd3.x * 0.5 + 0.5) * rect3.width, y: rect3.top + (-nd3.y * 0.5 + 0.5) * rect3.height } : null;
              } else S.towerScreen = null;
            } else S.towerScreen = null;
          }
          S.hudT += dt;
          if (S.hudT > 0.12) {
            S.hudT = 0;
            let en = 0, nw = 0, nt = 0;
            for (const b of world.bodies) {
              if (b.kind === "unit" && b.alive && b.team === 2) en++;
              else if (b.kind === "wall") { if (!b.course) nw++; } // the HUD counts WALLS, not courses (P1.5 T2)
              else if (b.kind === "tower") nt++;
            }
            const nowS = performance.now() / 1000;
            S.toasts = S.toasts.filter((t) => nowS - t.t < 2.2);
            setHud({
              // The bell being counted down TO — S.bell is the one that last
              // rang, so the top bar names the next one.
              fps: S.fps, bell: S.bell + 1, bellT: S.bellT, enemies: en,
              stones: R.chunkStats ? `${R.chunkStats().drawn}/${R.chunkStats().cap}` : "",
              resources: Math.floor(S.resources), walls: nw, towers: nt, kills: S.kills,
              lastDispatch: S.lastDispatch,
              // The manifest's mirror. Both cards arm on WORLD time (the
              // trailing-tap law), so the armed flag is computed here on the
              // hud tick exactly the way the pending ✓ already is.
              unlocked: S.manifest.unlocked.slice(),
              manifest: S.manifest.offers.length > 0 ? {
                up: !!S.manifest.cardUp, armed: world.t >= S.manifest.armedAt,
                bell: S.manifest.offerBell, offers: S.manifest.offers.slice(),
              } : null,
              intel: S.intelUp && S.lastDispatch ? { armed: world.t >= S.intelArmedAt } : null,
              started: S.started, gameOver: S.gameOver, victory: S.victory,
              endCard: endCardReady(S, world.t),   // mk0.29: the card waits out the collapse
              breach: S.breach, enemyBreach: S.enemyBreach,
              depotStanding: S.depotStanding != null ? S.depotStanding : 1,
              enemyStanding: S.enemyStanding != null ? S.enemyStanding : 1,
              mode: S.mode, sellMode: S.sellMode, sandbagOrient: S.sandbagOrient || 0,
              paused: S.paused, speed: S.speed,
              muted: A.muted, fogOn: S.fogOn, discipline: S.discipline, seed: MAP_SEED,
              toasts: S.toasts.map((t) => t.txt),
              squadSel: (() => {
                const sq = S.selSquadId != null ? S.squads.find((q) => q.id === S.selSquadId) : null;
                if (!sq || !S.squadScreen) return null;
                return { id: sq.id, label: SQUAD_SPECS[sq.type].label, order: sq.order, x: S.squadScreen.x, y: S.squadScreen.y, armed: world.t >= S.selArmedAt, aiming: S.orderMode === "attack", aimingMove: S.orderMode === "move",
                  // COMMAND 1b (mk0.82): the pie is up only while S.pieOpen —
                  // a wedge tap closes it but (for aiming orders) keeps the
                  // squad selected, so the status chip renders on its own.
                  showPie: !!S.pieOpen,
                  // P1.5 T4: the BUILD chips exist for engineer squads and no
                  // other type, so the row is per-squad-type by construction.
                  engineer: sq.type === "engineers",
                  building: S.orderMode === "build_bags" ? "bags" : S.orderMode === "build_walls" ? "walls" : null,
                  buildStart: !!S.buildPt0 };
              })(),
              squadFlag: S.flagScreen ? { x: S.flagScreen.x, y: S.flagScreen.y } : null,
              pending: S.pending && S.pendingScreen ? {
                x: S.pendingScreen.x, y: S.pendingScreen.y,
                cost: S.pending.cost, armed: pendingArmed(S.pending, world.t),
              } : null,
              inspect: (() => {
                if (!S.inspectId) return null;
                const b = world.byId.get(S.inspectId);
                if (!b) return null;
                const ispec = b.kind === "tower" ? TOWER_SPECS[b.towerType] : null;
                return {
                  id: b.id,
                  label: ispec ? ispec.label : "WALL",
                  hp: Math.max(0, Math.ceil(b.hp)), maxHp: b.maxHp,
                  refund: b.kind === "tower" ? Math.floor(ispec.cost * 0.6) : 3,
                  blurb: ispec ? ispec.blurb : "Bends their road.",
                };
              })(),
              // COMMAND T1 (mk0.80): the tower radial — CAREFUL/FREE toggle
              // (frost towers have no gun, so they skip that slot) and SELL,
              // for the inspected tower only. Walls keep their inspect
              // behavior untouched (no radial).
              towerRadial: (() => {
                if (!S.inspectId || !S.towerScreen) return null;
                const b = world.byId.get(S.inspectId);
                if (!b || b.kind !== "tower") return null;
                const ispec = TOWER_SPECS[b.towerType];
                return {
                  id: b.id, x: S.towerScreen.x, y: S.towerScreen.y,
                  label: ispec.label,
                  discipline: b.discipline || discipline || "careful",
                  refund: Math.floor(ispec.cost * 0.6),
                  frost: b.towerType === "frost",
                  showPie: !!S.pieOpen,   // COMMAND 1b (mk0.82)
                };
              })(),
            });
          }
          if (perf) {
            // stopwatch: one ring slot per rAF, written last so `frame` covers
            // the whole tick. Skipped draws record render 0 with drew false —
            // the reader averages the draw cost over drawn frames only.
            const pNow = performance.now();
            pSampT += dt;
            if (pSampT >= 1) {
              pSampT = 0;
              pBodies = world.bodies.length;
              const cs = R.chunkStats ? R.chunkStats() : null;
              pChunksDrawn = cs ? cs.drawn : 0; pChunksTotal = cs ? cs.total : 0;
            }
            pT[pI] = pNow; pSimA[pI] = pSim; pRenA[pI] = pRen;
            pFrmA[pI] = pNow - pFrame0; pDrewA[pI] = pDrew;
            pI = (pI + 1) % PCAP; pN++;
          }
        } catch (err) {
          console.error("COLDSNAP DEPOT frame failed", err);
          setFatal(String(err && err.message ? err.message : err));
          disposed = true;
        }
      };
      raf = requestAnimationFrame(frame);

      return () => {
        disposed = true;
        cancelAnimationFrame(raf);
        canvas.removeEventListener("pointerdown", onPointerDown);
        canvas.removeEventListener("pointermove", onPointerMove);
        canvas.removeEventListener("pointerup", onPointerUp);
        canvas.removeEventListener("pointercancel", onPointerUp);
        canvas.removeEventListener("wheel", onWheel);
        canvas.removeEventListener("touchstart", blockTouch);
        window.removeEventListener("keydown", kd);
        window.removeEventListener("keyup", ku);
        for (const k of ["__DEPOT__", "__DEPOTBELL__", "__DEPOTBUILD__", "__DEPOTSPAWN__", "__DEPOTSTART__", "__DEPOTTREES__", "__DEPOTMG__", "__DEPOTSHELL__", "__DEPOTTHIN__", "__DEPOTEND__", "__DEPOTFOCUS__", "__DEPOTGETFOCUS__", "__DEPOTSETT__", "__DEPOTFLAGS__", "__DEPOTHOLD__", "__DEPOTFINDBUILDABLE__", "__DEPOTFINDRISE__", "__DEPOTFINDNEARROCK__", "__DEPOTFOGDBG__", "__DEPOTFOGAT__", "__DEPOTENEMYPOS__", "__DEPOTSQUADS__", "__DEPOTSANDBAGS__", "__DEPOTGROUNDAT__", "__DEPOTSCREENAT__", "__DEPOTPENDING__", "__DEPOTMANIFEST__", "__DEPOTPICK__", "__DEPOTSAVE__", "__DEPOTGRIDAT__", "__DEPOTSQUAD__", "__DEPOTORDER__", "__DEPOTCELL__"]) delete window[k];
        A.dispose();
        if (R) R.dispose();
        stateRef.current = null;
      };
    } catch (err) {
      console.error("COLDSNAP DEPOT boot failed", err);
      setFatal(String(err && err.message ? err.message : err));
      if (R) R.dispose();
    }
  }, [isTouch, runId]);

  const setMode = (m) => {
    const S = stateRef.current; if (!S) return;
    if (S.gameOver || S.victory) return;   // mk0.29: the war is over — nothing left to build
    // Re-tap SANDBAG while already in sandbag mode: cycle pending
    // orientation 90 degrees (two states). Placement-state only.
    if (m === "sandbag" && S.mode === "sandbag" && !S.sellMode) {
      S.sandbagOrient = ((S.sandbagOrient || 0) + 1) % 2;
      setHud((h) => ({ ...h, sandbagOrient: S.sandbagOrient }));
      return;
    }
    S.mode = m; S.sellMode = false; S.inspectId = null; S.pending = null; S.selSquadId = null; S.orderMode = null; S.buildPt0 = null;
    setHud((h) => ({ ...h, mode: m, sellMode: false }));
  };
  const toggleSell = () => {
    const S = stateRef.current; if (!S) return;
    S.sellMode = !S.sellMode; S.inspectId = null; S.pending = null;
    setHud((h) => ({ ...h, sellMode: S.sellMode }));
  };
  const startGame = () => {
    const S = stateRef.current; if (!S) return;
    if (S.audio) S.audio.ensure();
    S.started = true;
    setHud((h) => ({ ...h, started: true }));
  };
  const toggleMute = () => {
    const S = stateRef.current; if (!S || !S.audio) return;
    S.audio.ensure();
    S.audio.setMuted(!S.audio.muted);
    setHud((h) => ({ ...h, muted: S.audio.muted }));
  };
  const toggleFog = () => {
    const S = stateRef.current; if (!S || !S.setFog) return;
    S.setFog(!S.fogOn);
    setHud((h) => ({ ...h, fogOn: S.fogOn }));
  };
  const sellInspected = () => { const S = stateRef.current; if (S && S.inspectId && S.sellById) S.sellById(S.inspectId); };

  // The bar shows the UNLOCKED set and nothing else (P1 Task 2): a locked
  // item does not render at all — no greyed teasers, because the manifest
  // card IS the reveal. PALETTE's own order is preserved, so an item always
  // arrives in the same slot position it will keep for the rest of the match.
  const unlocked = hud.unlocked || [];
  const palette = PALETTE.filter((p) => unlocked.indexOf(p.key) >= 0)
    // icon reflects pending orientation (sandbagOrient): ▬ (long x) vs ▮ (long z)
    .map((p) => (p.key === "sandbag" ? { ...p, icon: hud.sandbagOrient ? "▮" : "▬" } : p));

  return (
    <div style={P.root}>
      <canvas key={runId} ref={canvasRef} style={P.cv} />
      <div style={P.top}>
        <div style={P.stat}><span style={{ color: "#ffd27a" }}>◆</span>{hud.resources}</div>
        <div data-bell style={{ ...P.stat, cursor: hud.lastDispatch ? "pointer" : "default" }}
          onClick={() => { if (hud.lastDispatch) setRereadDispatch(true); }}
          title={hud.lastDispatch ? "re-read last dispatch" : undefined}>
          BELL {hud.bell} · {clockStr(hud.bellT)}
        </div>
        <div style={P.stat}>☠ {hud.enemies}</div>
        {/* The dismissed manifest waits here — and only until the next bell,
            which re-pools the offer. A skipped bell is a skipped pick. */}
        {hud.manifest && !hud.manifest.up && !hud.gameOver && !hud.victory && (
          <div data-manifest-chip style={{ ...P.stat, cursor: "pointer", borderColor: "#ffd27a", color: "#ffd27a" }}
            title="the convoy is still waiting on your pick"
            onClick={() => { const S = stateRef.current; if (S && S.openManifest) S.openManifest(); }}>
            ⛊ MANIFEST
          </div>
        )}
        {hud.started && !hud.victory && !hud.gameOver && (
          <>
            <button style={{ ...P.btn, padding: isTouch ? "5px 10px" : "4px 10px", borderColor: hud.paused ? "#ffd27a" : "#48515f", color: hud.paused ? "#ffd27a" : "#e6ebf1" }}
              onClick={() => { const S = stateRef.current; if (S) { S.paused = !S.paused; setHud((h) => ({ ...h, paused: S.paused })); } }}>
              {hud.paused ? "▶" : "❚❚"}
            </button>
            <button style={{ ...P.btn, padding: isTouch ? "5px 10px" : "4px 10px", borderColor: hud.speed > 1 ? "#7fd7ff" : "#48515f" }}
              onClick={() => { const S = stateRef.current; if (S) { S.speed = S.speed > 1 ? 1 : 2; setHud((h) => ({ ...h, speed: S.speed })); } }}>
              {hud.speed > 1 ? "2×" : "1×"}
            </button>
          </>
        )}
        <button style={{ ...P.btn, marginLeft: "auto", padding: isTouch ? "5px 10px" : "4px 10px" }} title="rotate view (Q/E)"
          onClick={() => { const S = stateRef.current; if (S && S.rotate) S.rotate(1); }}>⟳</button>
        <button style={{ ...P.btn, padding: isTouch ? "5px 10px" : "4px 10px", borderColor: hud.fogOn ? "#7fd7ff" : "#48515f", opacity: hud.fogOn ? 1 : 0.6 }} title="fog of war (visual only)" onClick={toggleFog}>
          FOG {hud.fogOn ? "ON" : "OFF"}
        </button>
        <button style={{ ...P.btn, padding: isTouch ? "5px 10px" : "4px 10px", opacity: hud.muted ? 0.5 : 1 }} onClick={toggleMute}>
          {hud.muted ? "🔇" : "🔊"}
        </button>
        {onExit && (
          <button data-menu-exit
            style={{ ...P.btn, padding: isTouch ? "5px 10px" : "4px 10px", borderColor: menuArmed ? "#ff6b5e" : "#48515f", color: menuArmed ? "#ff6b5e" : "#e6ebf1" }}
            onClick={() => { if (menuArmed) { setMenuArmed(false); onExit(); } else setMenuArmed(true); }}>
            {menuArmed ? "LEAVE THE FIELD?" : "⏏ MENU"}
          </button>
        )}
        <div style={{ ...P.stat, opacity: 0.65 }}>{hud.fps} fps · {hud.stones || "0/0"} · {MK}</div>
      </div>

      {hud.toasts && hud.toasts.length > 0 && (
        <div style={P.toastWrap}>
          {hud.toasts.map((t, i) => <div key={i} style={P.toast}>{t}</div>)}
        </div>
      )}

      {/* THE INTEL CARD — first thing in the bell sequence. Floating, so it
          cannot eat a combat tap; dismissible; and the assault it precedes
          marches whether or not it is ever read. The bell chip re-reads it
          (as a proper modal) any time after. */}
      {hud.intel && hud.lastDispatch && !rereadDispatch && !hud.gameOver && !hud.victory && (
        <Dispatch
          dispatch={hud.lastDispatch}
          gating={false}
          floating
          armed={hud.intel.armed}
          label="ACKNOWLEDGE"
          onAcknowledge={() => { const S = stateRef.current; if (S && S.ackIntel) S.ackIntel(); }}
        />
      )}

      {/* Re-read: the bell chip's modal copy of the same dispatch. */}
      {rereadDispatch && hud.lastDispatch && (
        <Dispatch
          dispatch={hud.lastDispatch}
          gating={false}
          onAcknowledge={() => setRereadDispatch(false)}
        />
      )}

      {/* THE MANIFEST CARD — the convoy's offer. Same floating idiom as the
          intel card (no scrim, corner-parked, only the card box takes taps),
          pick buttons armed on world time. LATER dismisses it to the top-bar
          chip; the next bell overwrites the offer either way. */}
      {hud.manifest && hud.manifest.up && !hud.gameOver && !hud.victory && (
        <div style={P.cardWrap}>
          <div data-manifest-card style={{ ...P.panel, position: "static", pointerEvents: "auto", borderColor: "#ffd27a", width: "min(300px, 44vw)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 10, borderBottom: "1px solid #2c3846", paddingBottom: 8 }}>
              <span style={{ color: "#ffd27a", letterSpacing: 2 }}>CONVOY MANIFEST</span>
              <span style={{ opacity: 0.6 }}>BELL {hud.manifest.bell}</span>
            </div>
            <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 10, lineHeight: 1.5 }}>
              One crate comes off the truck. The rest go back on.
              {/* The teaching line, first truck only (mk0.50). Deterministic on
                  the bell index — bell 1 is the first bell of any match, so
                  nothing is stored, nothing is flagged, and a resumed save
                  shows it again only if it resumed to bell 1. */}
              {hud.manifest.bell === 1 && (
                <div data-manifest-teach style={{ marginTop: 6, color: "#ffd27a", opacity: 0.9 }}>
                  Pick one reinforcement — the convoy returns each bell.
                </div>
              )}
            </div>
            {hud.manifest.offers.map((key) => {
              const it = PALETTE_BY_KEY[key];
              if (!it) return null;
              return (
                <button key={key} data-manifest-offer={key}
                  style={{ ...P.btnBig, width: "100%", marginBottom: 6, display: "flex", alignItems: "center", gap: 10, textAlign: "left", opacity: hud.manifest.armed ? 1 : 0.5 }}
                  onClick={() => { const S = stateRef.current; if (S && S.pickManifest) S.pickManifest(key); }}>
                  <span style={{ fontSize: 18 }}>{it.icon}</span>
                  <span style={{ flex: 1 }}>{it.label}</span>
                  <span style={{ color: "#ffd27a", fontSize: 12 }}>◆{it.cost}</span>
                </button>
              );
            })}
            <button data-manifest-later
              style={{ ...P.btn, width: "100%", marginTop: 4, opacity: 0.75 }}
              onClick={() => { const S = stateRef.current; if (S && S.dismissManifest) S.dismissManifest(); }}>
              LATER
            </button>
          </div>
        </div>
      )}

      {hud.pending && (
        <div style={{ position: "absolute", left: hud.pending.x, top: hud.pending.y, transform: "translate(-50%, -50%)", zIndex: 7, display: "flex", gap: 6, pointerEvents: "auto" }}>
          <button data-pending-confirm
            style={{ ...P.btnBig, borderColor: "#4aff8c", color: "#4aff8c", opacity: hud.pending.armed ? 1 : 0.5, fontWeight: "bold" }}
            onClick={() => stateRef.current && stateRef.current.confirmPending()}>
            ✓ ◆{hud.pending.cost}
          </button>
          <button data-pending-cancel
            style={{ ...P.btnBig, borderColor: "#ff6b5e", color: "#ff6b5e", fontWeight: "bold" }}
            onClick={() => stateRef.current && stateRef.current.clearPending()}>
            ✗
          </button>
        </div>
      )}

      {hud.squadSel && (() => {
        const sq = hud.squadSel;
        // COMMAND T1 (mk0.80): DEFEND, MOVE, ATTACK — engineers additionally
        // get BAGS and WALLS. Same S.orderSquad actions, same order-state
        // colors the old chip row used.
        // COMMAND 1b (mk0.82): DEFEND is instant — its act also fully
        // deselects (S.selSquadId = null), the same rule SELL/CAREFUL-FREE
        // follow on the tower pie. MOVE/ATTACK/BAGS/WALLS stay selected —
        // they arm S.orderMode and consumeOrderTap's ground tap(s) finish
        // them (and deselect there, at completion).
        const slots = [
          { key: "defend", icon: "∴", label: "DEFEND", color: "#7dffa8", on: sq.order === "defend", act: () => { const S = stateRef.current; if (S) { S.orderSquad("defend"); S.selSquadId = null; } } },
          { key: "move", icon: "→", label: "MOVE", color: "#7fd7ff", on: sq.aimingMove || sq.order === "move", act: () => stateRef.current && stateRef.current.orderSquad("move") },
          { key: "attack", icon: "⚑", label: "ATTACK", color: "#ff6b5e", on: sq.aiming, act: () => stateRef.current && stateRef.current.orderSquad("attack") },
        ];
        if (sq.engineer) {
          slots.push(
            { key: "build_bags", icon: "▬", label: "BAGS", color: "#ffd27a", on: sq.building === "bags", act: () => stateRef.current && stateRef.current.orderSquad("build_bags") },
            { key: "build_walls", icon: "▦", label: "WALLS", color: "#ffd27a", on: sq.building === "walls", act: () => stateRef.current && stateRef.current.orderSquad("build_walls") },
          );
        }
        const status = sq.building
          ? (sq.buildStart ? " — TAP THE FAR END" : " — TAP THE LINE START")
          : sq.aiming || sq.aimingMove ? " — TAP GROUND" : "";
        // COMMAND 1b (mk0.82): pie open -> the wedge disc; pie closed but
        // still selected (an aiming order armed) -> the center label chip
        // alone, so the ground stays fully tappable for the follow-up taps.
        return sq.showPie
          ? <RadialMenu cx={sq.x} cy={sq.y} label={sq.label + status} slots={slots} armed={sq.armed} onChoose={() => { const S = stateRef.current; if (S) S.pieOpen = false; }} />
          : <div style={{ position: "absolute", left: sq.x, top: sq.y + 26, transform: "translate(-50%,0)", fontSize: 10, letterSpacing: 1, color: "#7dffa8", background: "rgba(14,18,24,0.85)", padding: "1px 6px", borderRadius: 4, zIndex: 7, pointerEvents: "none" }}>{sq.label + status}</div>;
      })()}
      {hud.squadFlag && (
        <div data-squad-flag style={{ position: "absolute", left: hud.squadFlag.x, top: hud.squadFlag.y, transform: "translate(-50%, -100%)", zIndex: 6, pointerEvents: "none", color: "#ff6b5e", fontSize: 18 }}>⚑</div>
      )}

      {hud.inspect && (
        <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", bottom: isTouch ? 96 : 104, zIndex: 5 }}>
          <div style={{ ...P.panel, position: "static", borderColor: "#7fd7ff", display: "flex", alignItems: "center", gap: 10, padding: "6px 10px" }}>
            <div>
              <div style={{ color: "#7fd7ff", letterSpacing: 1 }}>{hud.inspect.label}</div>
              <div style={{ fontSize: 10, opacity: 0.8 }}>HP {hud.inspect.hp}/{hud.inspect.maxHp} · {hud.inspect.blurb}</div>
            </div>
            {/* COMMAND T1 (mk0.80): SELL moved into the tower radial below —
                walls keep today's inspect behavior untouched (no radial). */}
            {!hud.towerRadial && (
              <button style={{ ...P.btn, borderColor: "#ffb45e", color: "#ffb45e" }} onClick={sellInspected}>
                SELL ◆{hud.inspect.refund}
              </button>
            )}
          </div>
        </div>
      )}
      {hud.towerRadial && (() => {
        const tr = hud.towerRadial;
        const slots = [];
        // COMMAND 1b (mk0.82): both tower actions are instant — each act
        // also fully deselects (S.inspectId = null). sellById already nulls
        // it internally; the discipline flip does so explicitly here.
        if (!tr.frost) {
          slots.push({
            key: "discipline",
            icon: tr.discipline === "free" ? "●" : "◐",
            label: tr.discipline === "free" ? "FREE" : "CAREFUL",
            color: tr.discipline === "free" ? "#ff7a7a" : "#4aff8c",
            on: true,
            act: () => { const S = stateRef.current; if (S) { S.setTowerDiscipline(tr.id); S.inspectId = null; } },
          });
        }
        slots.push({
          key: "sell",
          icon: "◆",
          label: `SELL ◆${tr.refund}`,
          color: "#ffb45e",
          on: true,
          act: () => stateRef.current && stateRef.current.sellById(tr.id),
        });
        return tr.showPie
          ? <RadialMenu cx={tr.x} cy={tr.y} label={tr.label} slots={slots} armed={true} onChoose={() => { const S = stateRef.current; if (S) S.pieOpen = false; }} />
          : null;
      })()}

      {hud.started && !hud.gameOver && !hud.victory && (
        <div style={P.bar}>
          {palette.map((p) => {
            const sel = !hud.sellMode && hud.mode === p.key;
            const afford = hud.resources >= p.cost;
            return (
              <div key={p.key} data-tower-key={p.key}
                style={{ ...P.slot, borderColor: sel ? "#4aff8c" : "#48515f", opacity: afford ? 1 : 0.45, minWidth: isTouch ? 56 : 52 }}
                onClick={() => setMode(p.key)}>
                <div style={{ fontSize: 16 }}>{p.icon}</div>
                <div>{p.label}</div>
                <div style={{ color: "#ffd27a" }}>◆{p.cost}</div>
              </div>
            );
          })}
          <div data-sell-toggle style={{ ...P.slot, borderColor: hud.sellMode ? "#ffb45e" : "#48515f", color: hud.sellMode ? "#ffb45e" : "#e6ebf1", minWidth: isTouch ? 56 : 52 }}
            onClick={toggleSell}>
            <div style={{ fontSize: 16 }}>✕</div>
            <div>SELL</div>
            <div style={{ opacity: 0.7 }}>60%</div>
          </div>
        </div>
      )}

      {!hud.started && !fatal && (
        <div style={P.ovl}>
          <div style={{ fontSize: 26, letterSpacing: 4, color: "#9fdcff" }}>COLDSNAP</div>
          <div style={{ fontSize: 13, letterSpacing: 8, color: "#ffd27a", marginBottom: 14 }}>WINTER FRONT</div>
          <div style={{ fontSize: 12, opacity: 0.85, maxWidth: 420, lineHeight: 1.6, marginBottom: 18 }}>
            They come out of the southern treeline for the depot. Wall their road, gun the choke points.
            Rock is free cover. The frozen ponds carry them faster — and you cannot build on ice.
            {isTouch ? " Drag to pan, pinch to zoom, tap to build. Tap a tower to inspect it." : " WASD pans, wheel zooms, Q/E rotates, click builds. Click a tower to inspect it."}
          </div>
          <button style={{ ...P.btn, fontSize: 15, padding: "10px 26px", borderColor: "#4aff8c", color: "#4aff8c" }} onClick={startGame}>
            DIG IN
          </button>
          <div style={{ fontSize: 10, opacity: 0.55, marginTop: 12, letterSpacing: 2 }}>FIELD ORDER #{hud.seed || "—"} · ?seed= replays a map</div>
        </div>
      )}

      {(hud.gameOver || hud.victory) && hud.endCard && !fatal && (
        <Dispatch
          dispatch={endDispatch}
          gating={false}
          outcome={hud.victory ? "win" : "loss"}
          label="RETURN TO BASE"
          onAcknowledge={() => { if (onExit) onExit(); else restart(); }}
        />
      )}

      {fatal && (
        <div style={P.ovl}>
          <div style={{ fontSize: 18, color: "#ff7a7a", marginBottom: 10 }}>ENGINE FAULT</div>
          <div style={{ fontSize: 11, opacity: 0.8, maxWidth: 480, marginBottom: 16, wordBreak: "break-word" }}>{fatal}</div>
          <button style={{ ...P.btn, borderColor: "#9fdcff", color: "#9fdcff" }} onClick={restart}>RESTART</button>
        </div>
      )}
    </div>
  );
}
