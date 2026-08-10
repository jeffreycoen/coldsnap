// COLDSNAP DEPOT — Phase 0/1 playable scaffold. Seeded from
// src/game/ColdsnapTD.jsx (the frozen reference implementation — read it
// before touching this file). Same map/grid/flow-field/build-sell/tower-fire
// skeleton, stripped to what Phase 0/1 ships: no tanks, no mech boss, no
// off-map strikes, no village-protection payouts, flat conscript-only waves.
// Every gameplay rng call runs through world.rng() (mulberry32, seeded with
// the map) — the JS built-in unseeded generator is forbidden here — so runs
// replay exactly from ?seed=.
import React, { useEffect, useRef, useState } from "react";
import {
  makeField, makeWorld, addBody, addWeld, stepWorld, fireProjectile,
  applyDamage, mulberry32,
} from "../engine/core.js";
import { makeRenderer } from "../render/renderer.js";
import { makeGameAudio } from "../platform/audio.js";
import { TOWER_SPECS, TOWER_ORDER, ENEMY_SPECS, WAVES, MASON } from "./specs.js";
import { windAt } from "./wind.js";
import { PHASE, makeWaveState, HUD0, startWave as phaseStartWave, nextSpawnTag, tryStall, advance as phaseAdvance, checkLoss, makeEndDispatch, towerShot, friendlyFouls, fieldReaches, effRange, validatePlacement, PENDING_ARM_S, pendingArmed, censusDepotChunks, depotStandingFraction, stepDepotCensus } from "./state.js";
import { reachPolygon, arcClears } from "./accuracy.js";
import { stepUnits, spawnUnit, stepBreakerRam, checkLeaks, payBounties } from "./units.js";
import { makeRegiment, payTown } from "./economy.js";
import { makeTerritory, stepTerritory, holderAt, canBuild, fogStateFor, valueAt, EMIT } from "./territory.js";
import { fwdUFor, fwdDirFor, invWFor } from "./orient.js";
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
  const town = [{ id: "depot", x: 0, z: 52, nx: 9, nz: 7, ny: 6, door: 4, depot: true }];
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
  return { seed, bands, passes, rocks, ponds, spawns, spawnU, town, roads };
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
    if (TOWN.length >= 6 && checkConnectivity(g, SPAWN_POINTS, og.gx, og.gz)) return;
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
function stepTowers(world, T, discipline) {
  const dt = world.dt;
  for (const b of world.bodies) {
    if (b.kind !== "tower" || !b.alive) continue;
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
    if (best && (!best.alive || best.team !== 2 || best.kind !== "unit")) best = null;
    if (best) {
      const dx = best.pos.x - b.pos.x, dz = best.pos.z - b.pos.z;
      if (dx * dx + dz * dz > eR * eR) best = null;
    }
    // Targeting gate (symmetric with the attacker's own check in units.js):
    // a tower may only acquire/keep a target where the PLAYER field reaches
    // it, AND where its own round's flight path (arc for mg/gun, muzzle
    // climb-out only for mortar/rocket) actually clears the terrain — a
    // sticky target that has walked into fog, or that a rock has since risen
    // between, is dropped right here so "next rescan" is immediate.
    if (best) { const c = invW(best.pos.x, best.pos.z); if (!fieldReaches(T, c.u, c.v, 1)) best = null; }
    if (best && !arcClears(world, muzzle, best.pos, spec)) best = null;
    b.scanCd = (b.scanCd || 0) - dt;
    if (!best && b.scanCd <= 0) {
      b.scanCd = 0.11 + (b.id % 8) * 0.011;
      let bd = eR * eR;
      for (const e of world.bodies) {
        if (e.kind !== "unit" || !e.alive || e.team !== 2) continue;
        const c = invW(e.pos.x, e.pos.z);
        if (!fieldReaches(T, c.u, c.v, 1)) continue;
        const dx = e.pos.x - b.pos.x, dz = e.pos.z - b.pos.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < bd && arcClears(world, muzzle, e.pos, spec)) { bd = d2; best = e; }
      }
    }
    b.targetId = best ? best.id : null;
    if (!best || b.fireCd > 0) continue;
    // CAREFUL discipline: a shot whose flight path would hit our own wall/
    // tower/town chunk holds the trigger pull (cadence still resets — keeps
    // the target, retries next cadence; target movement usually clears it).
    // Enemy fire (units.js) never runs this check.
    if (discipline !== "free" && friendlyFouls(world, muzzle, best.pos, spec, b.id)) {
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
    const cells = [];
    const hx = (t.nx * pitch) / 2, hz = (t.nz * pitch) / 2;
    for (let gz = 0; gz < GRID_H; gz++) for (let gx = 0; gx < GRID_W; gx++) {
      const wp = grid.gridToWorld(gx, gz);
      if (Math.abs(wp.x - t.x) < hx + 1.0 && Math.abs(wp.z - t.z) < hz + 1.0) {
        if (Math.hypot(wp.x - OBJ_POS.x, wp.z - OBJ_POS.z) < 5) continue;
        const c = grid.cells[grid.idx(gx, gz)];
        c.blocked = true; c.building = t.id;
        cells.push(grid.idx(gx, gz));
      }
    }
    if (t.depot) {
      // roof-peak flag anchor: kinematic marker body, no collision role —
      // the renderer draws pole+cloth at any body with flagPole === true
      const fx = t.x, fz = t.z;
      const flag = addBody(world, {
        kind: "flag", team: 1, mass: 0, hx: 0.05, hy: 0.05, hz: 0.05,
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

// ==================================================================waves
function makeDepotWaveState() { return makeWaveState(); }
function spawnEnemy(world, sp, tag) {
  return spawnUnit(world, sp, tag);
}

// ================================================================== step
function stepDepot(world, grid, onStructureLost, town, onRuin, T, discipline) {
  stepEnemies(world, grid, T);
  stepTowers(world, T, discipline);
  world.wind = windAt(MAP_SEED, world.t);
  stepWorld(world);
  stepBreakerRam(world); // heavies (breakers) ram walls/towers — TD's ColdsnapTD.jsx :964-972
  for (let i = world.bodies.length - 1; i >= 0; i--) {
    const b = world.bodies[i];
    if ((b.kind === "wall" || b.kind === "tower") && !b.alive) {
      shatterStructure(world, b, { ny: b.kind === "tower" ? 4 : 3 });
      world.events.push({ type: "structureLost", id: b.id, kind: b.kind });
      world.byId.delete(b.id); world.bodies.splice(i, 1);
      if (onStructureLost) onStructureLost(b);
    }
  }
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
  checkLeaks(world, OBJ_POS);
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
  stat: { display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", background: "rgba(20,26,34,0.75)", border: "1px solid #303a48", borderRadius: 6 },
  bar: { position: "absolute", left: 0, right: 0, bottom: 0, display: "flex", gap: 6, padding: "8px 8px calc(8px + env(safe-area-inset-bottom, 0px))", justifyContent: "center", background: "linear-gradient(rgba(10,13,18,0), rgba(10,13,18,0.9))", zIndex: 4, flexWrap: "wrap" },
  slot: { display: "flex", flexDirection: "column", alignItems: "center", gap: 2, minWidth: 52, padding: "6px 6px", background: "#1a212b", border: "1px solid #48515f", borderRadius: 8, fontSize: 11, cursor: "pointer" },
  ovl: { position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(10,13,18,0.72)", zIndex: 8, textAlign: "center", padding: 20 },
  toastWrap: { position: "absolute", top: 54, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, zIndex: 6, pointerEvents: "none" },
  toast: { background: "rgba(14,18,24,0.92)", border: "1px solid #ffb45e", color: "#ffd9a0", borderRadius: 6, padding: "4px 12px", fontSize: 12 },
};

export default function DepotGame({ onExit }) {
  const canvasRef = useRef(null);
  const stateRef = useRef(null);
  const [isTouch] = useState(detectTouch);
  const [hud, setHud] = useState(HUD0);
  const [fatal, setFatal] = useState(null);
  const [runId, setRunId] = useState(0);
  const [rereadDispatch, setRereadDispatch] = useState(false);
  const restart = () => { setFatal(null); setHud({ ...HUD0 }); setRunId((r) => r + 1); };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let raf = 0, disposed = false;
    let R = null;
    try {
      const urlSeed = parseInt(new URLSearchParams(window.location.search).get("seed"), 10);
      const seed = Number.isFinite(urlSeed) ? urlSeed : Math.floor(Date.now() % 1000000);
      makeMap(seed);
      const field = makeField(121, 2.0, MAP_SEED);
      buildDepotTerrain(field, MAP_SEED);
      const grid = makeGrid(field);
      const world = makeWorld({ field, seed: MAP_SEED });
      world._tdStruct = true;
      world.depotCombat = true; // Phase 0 combat hooks: glancing, armor, tree fire/shredding
      const town = buildTown(world, grid, field);
      // Structural loss (Task 5): the depot's own chunk lattice IS its health
      // bar — census taken once here (ids + home world positions), read back
      // at ~1Hz via stepDepotCensus below against world.byId (live pos/alive).
      const depotCensus = censusDepotChunks(world.bodies);
      // Territory (Phase 4 Task 2): who holds the ground. Cells over the
      // same playable rim the renderer clips to (halfU 29 / halfV 57, see
      // makeRenderer's rim opt above) — reuse rather than reinvent extents.
      const T = makeTerritory(29, 57);
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
      // renderer's pole overlay, so this checks kind, not the flag). Anchor
      // emitters are permanent and sit on the attacker's own spawn points
      // (SPAWN_POINTS, from genMap's wave-spawn logic) — 3 of them here,
      // within the brief's 2-4 width-covering range.
      // territory.js is CANONICAL (u,v) space (the un-rotated map frame, same
      // as the renderer's rim) — every body/spawn position here is rotated
      // WORLD space, so every emitter goes through invW (DEPOT's
      // world-to-canonical transform) before it's pushed.
      const buildEmitters = () => {
        const out = [];
        for (const b of world.bodies) {
          if (b.kind === "tower" && b.team === 1 && b.alive) { const c = invW(b.pos.x, b.pos.z); out.push({ x: c.u, z: c.v, w: EMIT.tower.w, r: EMIT.tower.r, sign: 1 }); }
          else if (b.kind === "wall" && b.team === 1 && b.alive) { const c = invW(b.pos.x, b.pos.z); out.push({ x: c.u, z: c.v, w: EMIT.wall.w, r: EMIT.wall.r, sign: 1 }); }
          else if (b.kind === "flag" && b.team === 1) { const c = invW(b.pos.x, b.pos.z); out.push({ x: c.u, z: c.v, w: EMIT.depot.w, r: EMIT.depot.r, sign: 1 }); }
          else if (b.kind === "unit" && b.team === 2 && b.alive) { const c = invW(b.pos.x, b.pos.z); out.push({ x: c.u, z: c.v, w: EMIT.unit.w, r: EMIT.unit.r, sign: -1 }); }
          else if (b.kind === "vehicle" && b.team === 2 && b.alive) { const c = invW(b.pos.x, b.pos.z); out.push({ x: c.u, z: c.v, w: EMIT.vehicle.w, r: EMIT.vehicle.r, sign: -1 }); }
        }
        for (const sp of SPAWN_POINTS) { const c = invW(sp.x, sp.z); out.push({ x: c.u, z: c.v, w: EMIT.anchor.w, r: EMIT.anchor.r, sign: -1 }); }
        return out;
      };
      const rocksLive = ROCKS.slice();
      for (const k of ROCKS) {
        const b = addBody(world, { kind: "rock", team: 0, mass: 0, hx: k.r * 0.55, hy: k.h * 0.8, hz: k.r * 0.55, x: k.x, y: field.heightAt(k.x, k.z) - k.h * 0.2, z: k.z, hp: 380 + k.r * 90 });
        b.maxHp = b.hp; b.rockRef = k;
      }
      const treeAt = (tx, tz) => {
        const ty = field.heightAt(tx, tz);
        const u = addBody(world, { kind: "tree", team: 0, mass: 260, hx: 0.28, hy: 1.6, hz: 0.28, x: tx, y: ty + 1.62, z: tz, hp: 70, friction: 0.5 });
        u.sleeping = true;
        return u;
      };
      {
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
      }
      const objG = grid.worldToGrid(OBJ_POS.x, OBJ_POS.z);
      computeFlowField(grid, objG.gx, objG.gz);
      R = makeRenderer(canvas, world, {
        town: false, camera: "tactical", fadeDecals: true,
        // playable rim (matches buildDepotTerrain's falloff box, 29x57
        // canonical): ground/grid/decals beyond it get no geometry to
        // paint on (see renderer.js). TD/campaign/demo pass no rim.
        rim: { halfU: 29, halfV: 57, toCanonical: invW, toWorld: fwdU },
        // Phase 4 Task 4: grid-line faction tint + three-state fog. sample()
        // (WORLD space) drives per-frame enemy visibility/silhouette gating;
        // sampleUV (CANONICAL space, matches T's own grid) drives the 4Hz
        // splat-line retint + terrain fog wash via R.updateTerritory().
        territory: {
          T,
          toWorld: fwdU,
          sample: (x, z) => { const c = invW(x, z); return fogStateFor(T, c.u, c.v, 1); },
          sampleUV: (u, v) => fogStateFor(T, u, v, 1),
          // Task 3: raw signed field strength (world space), feeding the
          // area-wash alpha ramp — sample()/sampleUV() only return the
          // tri-state bucket, not enough for a continuous fade.
          sampleVal: (x, z) => { const c = invW(x, z); return valueAt(T, c.u, c.v); },
        },
      });
      const EXT = ORIENT % 2 ? { x: 62, z: 34 } : { x: 34, z: 62 };
      const A = makeGameAudio();
      A.setReflectors([
        ...ROCKS.filter((k) => k.r >= 4),
        ...TOWN.map((t) => ({ x: t.x, z: t.z, r: Math.max(t.nx, t.nz) * MASON.pitch * 0.6 })),
      ]);
      R.setDressing({ rocks: ROCKS, ponds: PONDS });
      R.overlay.setObjective(OBJ_POS.x, OBJ_POS.z, field.heightAt(OBJ_POS.x, OBJ_POS.z));
      R.overlay.setBanners(SPAWN_POINTS);
      const AIM_OFF = { x: 0, z: -500 };
      // FOG toggle: visuals only (see renderer.js setFog) — default ON,
      // persisted with the same localStorage-key pattern CampaignRunner uses
      // for "coldsnap-camp-deployed". Targeting (fogStateFor in units.js /
      // state.js) is untouched by this flag.
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
        resources: 120, lives: 20, kills: 0,
        ws: makeDepotWaveState(), spawnRR: 0,
        mode: "wall", sellMode: false, inspectId: null,
        started: false, gameOver: false, victory: false,
        paused: false, speed: 1, fogOn, discipline,
        setFog: (v) => { fogOn = v; S.fogOn = v; R.setFog(v); try { window.localStorage.setItem("coldsnap-depot-fog", v ? "1" : "0"); } catch (e) {} },
        setDiscipline: (v) => { discipline = v; S.discipline = v; try { window.localStorage.setItem("coldsnap-depot-discipline", v); } catch (e) {} },
        phase: PHASE.BUILD, dispatch: null, lastDispatch: null,
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
        hudT: 0, keys: {}, sellById: null, audio: A,
        // The attacker's economy — seeded off the run's own rng stream, not
        // an unseeded generator, so ?seed= replays reproduce the same
        // regiment. Mutated in place by planWave (buy-time depletion — the
        // only depletion path; a fielded unit's cost is spent at muster
        // and never returns, dead or alive) and payResults; never replaced.
        reg: makeRegiment(world.rng),
      };
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
          if (b.kind === "wall") { walls++; continue; }
          if (b.kind !== "tower") continue;
          if (b.towerType === "mortar") mortars++;
          else if (b.towerType === "mg") mgs++;
          else if (b.towerType === "gun") guns++;
          else if (b.towerType === "rocket") rockets++;
          else if (b.towerType === "frost") frosts++;
          elevSum += b.pos.y; elevN++;
        }
        return { mortars, mgs, guns, rockets, frosts, walls, towerElev: elevN ? elevSum / elevN : 0 };
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
        const cost = spec ? spec.cost : 5;
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
          b.effRange = effRange(world, { x: wp.x, y: y + spec.hy + 0.45, z: wp.z }, spec);
        } else {
          b = addBody(world, { kind: "wall", team: 1, mass: 0, hx: 0.9, hy: 0.9, hz: 0.9, x: wp.x, y: y + 0.9, z: wp.z, hp: 70 });
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
        const muzzle = { x: wp.x, y: y + spec.hy + 0.45, z: wp.z };
        let poly = null, ringR = 0, color = 0xff5544;
        if (mode === "frost") {
          // aura, not a gun: plain radius, no LOS clipping, blue-white —
          // "honest about what it does" (brief).
          ringR = spec.range;
          color = 0x9fdcff;
        } else {
          poly = reachPolygon(world, T, muzzle, spec, 1, invW);
        }
        S.pending = { gx, gz, mode, wp, y, poly, ringR, color, cost: spec.cost, armedAt: world.t + PENDING_ARM_S };
      };
      const confirmPending = () => {
        const p = S.pending;
        if (!pendingArmed(p, world.t)) return;
        S.pending = null;
        buildAt(p.gx, p.gz, p.mode);
      };
      const sellAt = (gx, gz) => {
        if (!grid.inBounds(gx, gz)) return;
        const cell = grid.cells[grid.idx(gx, gz)];
        const id = cell.wallId;
        if (!id || !world.byId.has(id)) { toast("NOTHING HERE"); return; }
        const b = world.byId.get(id);
        const refund = b.kind === "tower" ? Math.floor(TOWER_SPECS[b.towerType].cost * 0.6) : 3;
        world.byId.delete(id);
        const bi = world.bodies.indexOf(b);
        if (bi >= 0) world.bodies.splice(bi, 1);
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
        for (let t = 0; t <= 400; t += 1.5) {
          const x = ox + f.x * t, y2 = oy + f.y * t, z = oz + f.z * t;
          if (y2 <= field.heightAt(x, z)) { found = t; lo = prev; hi = t; break; }
          prev = t;
        }
        if (found < 0) return null;
        for (let i = 0; i < 12; i++) {
          const mid = (lo + hi) / 2;
          const x = ox + f.x * mid, y2 = oy + f.y * mid, z = oz + f.z * mid;
          if (y2 <= field.heightAt(x, z)) hi = mid; else lo = mid;
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
        if (S.pending) { clearPending(); return; }
        const p = groundPoint(cx, cy);
        if (!p) { S.inspectId = null; return; }
        const g = grid.worldToGrid(p.x, p.z);
        if (!grid.inBounds(g.gx, g.gz)) { S.inspectId = null; return; }
        const cell2 = grid.cells[grid.idx(g.gx, g.gz)];
        if (S.sellMode) { S.inspectId = null; sellAt(g.gx, g.gz); return; }
        if (cell2.wallId && world.byId.has(cell2.wallId)) { S.inspectId = cell2.wallId; return; }
        S.inspectId = null;
        if (S.mode === "wall") { buildAt(g.gx, g.gz, "wall"); return; } // walls exempt: instant, as today
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

      const startWave = () => {
        phaseStartWave(S, WAVES, { reg: S.reg, snap: buildSnapshot(), rng: world.rng });
        toast("WAVE " + (S.ws.waveIdx + 1));
      };
      const spawnOne = () => {
        const ws = S.ws;
        const tag = nextSpawnTag(S);
        const sp = SPAWN_POINTS[S.spawnRR++ % SPAWN_POINTS.length];
        spawnEnemy(world, sp, tag);
        ws.spawnQueue--;
      };
      const sendNow = () => { const ws = S.ws; if (S.started && S.phase === PHASE.BUILD && ws.betweenWaves && !S.gameOver && !S.victory) { ws.countdown = 0; } };
      S.sendNow = sendNow;
      // THE single entry point out of a stall — the ACKNOWLEDGE button calls
      // this and nothing else. A network-ready multiplayer gate replaces the
      // button later without touching this function.
      const doAdvance = () => {
        if (phaseAdvance(S, WAVES, buildSnapshot())) {
          if (S.victory) toast("THE DEPOT HOLDS");
          else toast("WAVE CLEAR +12");
        }
      };
      S.doAdvance = doAdvance;

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
          } else if (e.type === "leak") {
            S.lives -= e.dmg;
            toast(`LEAK — -${e.dmg} life${e.dmg === 1 ? "" : "s"}`);
            if (S.ws.results) S.ws.results.leaks++;
          } else if (e.type === "kill") {
            if (e.attacker === "enemy" && S.ws.results) {
              if (e.kind === "tower") S.ws.results.towerKills++;
              else if (e.kind === "wall") S.ws.results.wallKills++;
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

      window.__DEPOT__ = () => ({ t: world.t, scrap: S.resources, lives: S.lives, kills: S.kills, wave: S.ws.waveIdx + 1, bodies: world.bodies.length, fps: S.fps, paused: S.paused, speed: S.speed, phase: S.phase, reg: { ...S.reg }, depotStanding: S.depotStanding != null ? S.depotStanding : 1, breach: !!S.breach });
      window.__DEPOTACK__ = () => { if (S.doAdvance) S.doAdvance(); };
      window.__DEPOTBUILD__ = (gx, gz, mode) => buildAt(gx, gz, mode || "wall");
      window.__DEPOTSPAWN__ = (n) => { for (let i = 0; i < (n || 1); i++) spawnEnemy(world, SPAWN_POINTS[S.spawnRR++ % SPAWN_POINTS.length]); };
      window.__DEPOTSTART__ = () => { S.started = true; };
      window.__DEPOTSETT__ = (t) => { world.t = t; world.wind = windAt(MAP_SEED, world.t); };
      window.__DEPOTFLAGS__ = () => world.bodies.filter((b) => b.flagPole).map((b) => ({ id: b.id, kind: b.kind, x: +b.pos.x.toFixed(2), y: +b.pos.y.toFixed(2), z: +b.pos.z.toFixed(2) }));
      window.__DEPOTTREES__ = () => world.bodies.filter((b) => b.kind === "tree").map((b) => ({ id: b.id, x: +b.pos.x.toFixed(2), z: +b.pos.z.toFixed(2), y: +b.pos.y.toFixed(2), hp: +b.hp.toFixed(1), alive: b.alive, burning: b.burning }));
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
        // debug harness: instantly drain the current wave — zero the spawn
        // queue and kill every live enemy — so tests can force wave -> stall
        // without waiting real time for a full wave to walk/leak (smoke.mjs
        // uses this to stay inside its budget under swiftshader).
        S.ws.spawnQueue = 0;
        for (const b of world.bodies) if (b.kind === "unit" && b.team === 2 && b.alive) applyDamage(world, b, 1e6, { cause: "BLAST", attacker: "player" });
      };
      window.__DEPOTEND__ = (victory) => {
        // debug harness: force the run into its end state for screenshotting
        // the WIN/LOSS end card without simming 50 waves — pattern matches
        // the other window.__DEPOT*__ hooks above.
        if (victory) S.victory = true; else { S.lives = 0; S.gameOver = true; }
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
      // debug harness (Task 2): the nearest buildable+held cell to the depot
      // flag. Build rights now gate placement on holderAt===1 — the depot's
      // own emitter greens ground near itself, but the smoke test's original
      // build-tap point (canvas center at the initial camera focus) sits
      // well outside that radius on the pinned seed. The smoke test polls
      // this until non-null, then points the camera there before tapping.
      window.__DEPOTFINDBUILDABLE__ = () => {
        const flag = world.bodies.find((b) => b.kind === "flag");
        if (!flag) return null;
        let best = null, bestD = 1e9;
        for (let gz = 0; gz < GRID_H; gz++) for (let gx = 0; gx < GRID_W; gx++) {
          const cell = grid.cells[grid.idx(gx, gz)];
          if (cell.blocked || cell.wallId || cell.ice) continue;
          const wp = grid.gridToWorld(gx, gz);
          const c = invW(wp.x, wp.z);
          if (!canBuild(T, c.u, c.v)) continue;
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
      window.__DEPOTENEMYPOS__ = () => {
        const b = world.bodies.find((b2) => b2.kind === "unit" && b2.alive && b2.team === 2);
        return b ? { x: b.pos.x, z: b.pos.z } : null;
      };

      let last = performance.now();
      const STEP = 1 / 120;
      const frame = (now) => {
        if (disposed) return;
        raf = requestAnimationFrame(frame);
        let dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        try {
          S.fpsAcc += dt; S.fpsN++;
          if (S.fpsAcc > 0.5) { S.fps = Math.round(S.fpsN / S.fpsAcc); S.fpsAcc = 0; S.fpsN = 0; }
          const sdt = S.paused || !S.started || S.gameOver || S.victory ? 0 : dt * S.speed;
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
            if (!ib) S.inspectId = null;
            else {
              const ispec = ib.kind === "tower" ? TOWER_SPECS[ib.towerType] : null;
              S.hover = { x: ib.pos.x, z: ib.pos.z, valid: true, range: ispec ? ispec.range : 0 };
            }
          }
          const ws = S.ws;
          if (S.started && !S.gameOver && !S.victory) {
            if (S.phase === PHASE.BUILD) {
              ws.countdown -= sdt;
              if (ws.countdown <= 0 && ws.waveIdx < WAVES.length) startWave();
            } else if (S.phase === PHASE.WAVE) {
              if (ws.spawnQueue > 0) {
                ws.spawnTimer -= sdt;
                if (ws.spawnTimer <= 0) { ws.spawnTimer = ws.spawnDelay; spawnOne(); }
              } else {
                let live = 0;
                for (const b of world.bodies) if (b.kind === "unit" && b.alive && b.team === 2) live++;
                if (tryStall(S, WAVES, live, world.rng)) {
                  const paid = payTown(townUV, T);
                  S.resources += paid.player;
                  if (S.reg) S.reg.scrap += paid.regiment;
                  toast("WAVE " + (ws.waveIdx + 1) + " CLEARED");
                }
              }
            }
            // phase === "stall": sim keeps ticking (idle world) — no spawns,
            // no countdown, until ACKNOWLEDGE calls doAdvance().
            if (S.started && !S.gameOver && !S.victory) S.resources += 2.2 * sdt;
          }
          S.acc += sdt;
          terrAcc += sdt;
          let terrGuard = 0;
          while (terrAcc >= TERR_STEP && terrGuard++ < 8) {
            terrAcc -= TERR_STEP;
            stepTerritory(T, buildEmitters(), TERR_STEP);
          }
          // grid-line retint + terrain fog wash: same 4Hz cadence as the
          // territory field itself, not per frame (see renderer.js
          // updateTerritory/retintTerritory/updateFogWash).
          if (terrGuard > 0 && R.updateTerritory) R.updateTerritory();
          world.events.length = 0;
          let guard = 0;
          while (S.acc >= STEP && guard++ < 6) {
            S.acc -= STEP;
            stepDepot(world, grid, onStructureLost, town, onRuin, T, S.discipline);
          }
          if (S.acc > STEP * 6) S.acc = 0;
          const evs = drainEvents();
          // Structural loss census — ~1Hz (stepDepotCensus's own accumulator
          // gate, not this per-frame call site) — gated by sdt like the rest
          // of the sim clock, so it doesn't run while paused/pre-start/
          // post-game. Fraction is exposed on hud for the smoke test; there
          // is deliberately no health-bar UI — the building is the readout.
          stepDepotCensus(S, sdt, () => depotStandingFraction(depotCensus, world.byId));
          R.consume(evs);
          A.setListener(S.focus.x, S.focus.z, 46 / Math.max(0.6, S.zoom));
          A.consume(evs);
          A.tick(world, dt);
          if (S.hover) R.overlay.setHover(true, S.hover.x, S.hover.z, field.heightAt(S.hover.x, S.hover.z), S.hover.range, S.hover.valid, GRID_CS);
          else R.overlay.setHover(false);
          if (S.pending) {
            const P0 = S.pending;
            R.overlay.setPending(true, P0.wp.x, P0.y, P0.wp.z, P0.poly, P0.ringR, P0.color);
          } else R.overlay.setPending(false);
          R.render(dt, S.focus, AIM_OFF, 0);
          // ✓/✗ screen-space anchor (Task 3): rotation-proof because it's
          // recomputed from the live camera every frame via project() —
          // Q/E view rotation or a pan moves the cell's projected point,
          // and this just follows it, rather than being pinned once at tap
          // time. Written to a ref-adjacent plain field on S (not React
          // state) so it doesn't force a rerender every frame; the hud tick
          // below (throttled to ~8Hz) is what actually pushes it to React.
          if (S.pending) {
            const P0 = S.pending;
            const nd = R.project ? R.project(P0.wp.x, P0.y + 1.6, P0.wp.z) : null;
            if (nd) {
              const rect = canvas.getBoundingClientRect();
              S.pendingScreen = { x: rect.left + (nd.x * 0.5 + 0.5) * rect.width, y: rect.top + (-nd.y * 0.5 + 0.5) * rect.height };
            } else S.pendingScreen = null;
          } else S.pendingScreen = null;
          S.hudT += dt;
          if (S.hudT > 0.12) {
            S.hudT = 0;
            let en = 0, nw = 0, nt = 0;
            for (const b of world.bodies) {
              if (b.kind === "unit" && b.alive && b.team === 2) en++;
              else if (b.kind === "wall") nw++;
              else if (b.kind === "tower") nt++;
            }
            const nowS = performance.now() / 1000;
            S.toasts = S.toasts.filter((t) => nowS - t.t < 2.2);
            setHud({
              fps: S.fps, wave: Math.min(WAVES.length, S.ws.waveIdx + 1), lives: S.lives, enemies: en,
              resources: Math.floor(S.resources), walls: nw, towers: nt, kills: S.kills,
              totalWaves: WAVES.length, between: S.ws.betweenWaves, countdown: Math.max(0, Math.ceil(S.ws.countdown)),
              phase: S.phase, dispatch: S.dispatch, lastDispatch: S.lastDispatch,
              started: S.started, gameOver: S.gameOver, victory: S.victory,
              attrition: S.attrition, spent: S.spent, ledgerLoss: S.ledgerLoss, breach: S.breach,
              depotStanding: S.depotStanding != null ? S.depotStanding : 1,
              mode: S.mode, sellMode: S.sellMode,
              paused: S.paused, speed: S.speed,
              muted: A.muted, fogOn: S.fogOn, discipline: S.discipline, seed: MAP_SEED,
              toasts: S.toasts.map((t) => t.txt),
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
            });
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
        for (const k of ["__DEPOT__", "__DEPOTACK__", "__DEPOTBUILD__", "__DEPOTSPAWN__", "__DEPOTSTART__", "__DEPOTTREES__", "__DEPOTMG__", "__DEPOTSHELL__", "__DEPOTTHIN__", "__DEPOTEND__", "__DEPOTFOCUS__", "__DEPOTGETFOCUS__", "__DEPOTSETT__", "__DEPOTFLAGS__", "__DEPOTHOLD__", "__DEPOTFINDBUILDABLE__", "__DEPOTFINDRISE__", "__DEPOTFINDNEARROCK__", "__DEPOTFOGDBG__", "__DEPOTFOGAT__", "__DEPOTENEMYPOS__"]) delete window[k];
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
    S.mode = m; S.sellMode = false; S.inspectId = null; S.pending = null;
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
  const toggleDiscipline = () => {
    const S = stateRef.current; if (!S || !S.setDiscipline) return;
    S.setDiscipline(S.discipline === "careful" ? "free" : "careful");
    setHud((h) => ({ ...h, discipline: S.discipline }));
  };
  const sellInspected = () => { const S = stateRef.current; if (S && S.inspectId && S.sellById) S.sellById(S.inspectId); };

  const palette = [
    { key: "wall", label: "WALL", icon: "▦", cost: 5 },
    ...TOWER_ORDER.map((k) => ({ key: k, label: TOWER_SPECS[k].label, icon: TOWER_SPECS[k].icon, cost: TOWER_SPECS[k].cost })),
  ];

  return (
    <div style={P.root}>
      <canvas key={runId} ref={canvasRef} style={P.cv} />
      <div style={P.top}>
        <div style={P.stat}><span style={{ color: "#ffd27a" }}>◆</span>{hud.resources}</div>
        <div style={P.stat}><span style={{ color: "#ff7a7a" }}>♥</span>{hud.lives}</div>
        <div style={{ ...P.stat, cursor: hud.lastDispatch ? "pointer" : "default" }}
          onClick={() => { if (hud.lastDispatch) setRereadDispatch(true); }}
          title={hud.lastDispatch ? "re-read last dispatch" : undefined}>
          W {hud.wave}/{hud.totalWaves}
        </div>
        <div style={P.stat}>☠ {hud.enemies}</div>
        {hud.started && hud.between && !hud.gameOver && !hud.victory && (
          <button style={{ ...P.btn, borderColor: "#4aff8c", color: "#4aff8c", padding: isTouch ? "5px 10px" : "4px 10px" }} onClick={() => { const S = stateRef.current; if (S && S.sendNow) S.sendNow(); }}>
            SEND {hud.countdown}s
          </button>
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
        <button style={{ ...P.btn, padding: isTouch ? "5px 10px" : "4px 10px", borderColor: hud.discipline === "free" ? "#ff7a7a" : "#4aff8c" }} onClick={toggleDiscipline}>
          FIRE DISCIPLINE: {hud.discipline === "free" ? "FREE" : "CAREFUL"}
        </button>
        <button style={{ ...P.btn, padding: isTouch ? "5px 10px" : "4px 10px", opacity: hud.muted ? 0.5 : 1 }} onClick={toggleMute}>
          {hud.muted ? "🔇" : "🔊"}
        </button>
        {onExit && (
          <button style={{ ...P.btn, padding: isTouch ? "5px 10px" : "4px 10px" }} onClick={onExit}>⏏ MENU</button>
        )}
        <div style={{ ...P.stat, opacity: 0.65 }}>{hud.fps} fps</div>
      </div>

      {hud.toasts && hud.toasts.length > 0 && (
        <div style={P.toastWrap}>
          {hud.toasts.map((t, i) => <div key={i} style={P.toast}>{t}</div>)}
        </div>
      )}

      {(() => {
        const gating = hud.phase === PHASE.STALL && !!hud.dispatch;
        const active = gating ? hud.dispatch : (rereadDispatch ? hud.lastDispatch : null);
        if (!active) return null;
        return (
          <Dispatch
            dispatch={active}
            gating={gating}
            onAcknowledge={() => {
              if (gating) { const S = stateRef.current; if (S && S.doAdvance) S.doAdvance(); }
              setRereadDispatch(false);
            }}
          />
        );
      })()}

      {hud.pending && (
        <div style={{ position: "absolute", left: hud.pending.x, top: hud.pending.y, transform: "translate(-50%, -50%)", zIndex: 7, display: "flex", gap: 6, pointerEvents: "auto" }}>
          <button data-pending-confirm
            style={{ ...P.btn, borderColor: "#4aff8c", color: "#4aff8c", opacity: hud.pending.armed ? 1 : 0.5, fontWeight: "bold", fontSize: 16, padding: "2px 10px" }}
            onClick={() => stateRef.current && stateRef.current.confirmPending()}>
            ✓ ◆{hud.pending.cost}
          </button>
          <button data-pending-cancel
            style={{ ...P.btn, borderColor: "#ff6b5e", color: "#ff6b5e", fontWeight: "bold", fontSize: 16, padding: "2px 10px" }}
            onClick={() => stateRef.current && stateRef.current.clearPending()}>
            ✗
          </button>
        </div>
      )}

      {hud.inspect && (
        <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", bottom: isTouch ? 96 : 104, zIndex: 5 }}>
          <div style={{ ...P.panel, position: "static", borderColor: "#7fd7ff", display: "flex", alignItems: "center", gap: 10, padding: "6px 10px" }}>
            <div>
              <div style={{ color: "#7fd7ff", letterSpacing: 1 }}>{hud.inspect.label}</div>
              <div style={{ fontSize: 10, opacity: 0.8 }}>HP {hud.inspect.hp}/{hud.inspect.maxHp} · {hud.inspect.blurb}</div>
            </div>
            <button style={{ ...P.btn, borderColor: "#ffb45e", color: "#ffb45e" }} onClick={sellInspected}>
              SELL ◆{hud.inspect.refund}
            </button>
          </div>
        </div>
      )}

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
          <div style={{ ...P.slot, borderColor: hud.sellMode ? "#ffb45e" : "#48515f", color: hud.sellMode ? "#ffb45e" : "#e6ebf1", minWidth: isTouch ? 56 : 52 }}
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
          <div style={{ fontSize: 13, letterSpacing: 8, color: "#ffd27a", marginBottom: 14 }}>DEPOT</div>
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

      {(hud.gameOver || hud.victory) && !fatal && (
        <Dispatch
          dispatch={makeEndDispatch({ victory: hud.victory, kills: hud.kills, wave: hud.wave, totalWaves: hud.totalWaves, attrition: hud.attrition, spent: hud.spent, ledgerLoss: hud.ledgerLoss, breach: hud.breach })}
          gating={false}
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
