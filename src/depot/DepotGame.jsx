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
  applyDamage, mulberry32, heading,
} from "../engine/core.js";
import { makeRenderer } from "../render/renderer.js";
import { makeGameAudio } from "../platform/audio.js";
import { TOWER_SPECS, TOWER_ORDER, ENEMY_SPECS, MASON, INFANTRY_ARMS, BISON, APC } from "./specs.js";
import { windAt } from "./wind.js";
import { makeAssaultState, HUD0, BELL_PERIOD_S, stepBell, fireBell, nextSpawnTag, withdrawDue, executeWithdrawal, ASSAULT_TIMEOUT, checkLoss, makeEndDispatch, towerShot, friendlyFouls, fieldReaches, effRange, validatePlacement, PENDING_ARM_S, pendingArmed, pendingButtonsVisible, canvasTapConsumesPending, END_CARD_DELAY_S, stampEnd, endCardReady, censusDepotChunks, depotStandingFraction, stepDepotCensus, squadFire, possessedVolley, possessedTowerFire, spawnSquadMembers, spawnSandbag, sandbagOrientAt, SANDBAG_COST, WALL_COST, SANDBAG_FIELD_COST, WALL_FIELD_COST, WALL_LAY_PAUSE_S, SANDBAG_HX, SANDBAG_HY, SANDBAG_HZ, WALL_HALF, WALL_THIN, spawnWallCourses, wallOrientAt, stepWallSupport, forgetWelds, WALL_UPPER_GROUP, pruneSquads, makeManifestState, makeFoeState, pickManifest, TIER_BELLS, memberNearRow } from "./state.js";
import { marketCounts, computePrices, fieldPrices, priced } from "./market.js";
import { stepMines, minePrices, mineSeedRoll, mineSeedPlace, MINE_COST, WIRE_COST } from "./mines.js";
import { homeShare, pickHomeDetail, HOME_GUARD_CAP, cmdrOf, cmdrBellOrders, ferryDecide, flankDrop } from "./ai.js";
import { SQUAD_SPECS, makeSquad, stepSquad, slotBlockedPublic, drivePossessedSquad, clearSlot } from "./squads.js";
import { reachPolygon, arcClears, squadReach, towerReachCached } from "./accuracy.js";
import { stepUnits, spawnUnit, stepBreakerRam, payBounties } from "./units.js";
import { stepDrivers, possessedArmorFire, possessedArmorMg } from "./drivers.js";
import { stepTransports, unloadApc, apcSeated, unloadEnemyRiders } from "./transports.js";
import { planRoute, stampTerrainMasks } from "./route.js";
import { makeRegiment, payTown } from "./economy.js";
import { makeTerritory, stepTerritory, holderAt, canBuild, fogStateFor, valueAt, EMIT } from "./territory.js";
import { makeSight, stepSight, seenAt, eyeOf, steerReticle, reclampReticle } from "./sight.js";
import { fwdUFor, fwdDirFor, invWFor, clampToRimFor } from "./orient.js";
import { SAVE_KEY, serializeFront, burnFront, restoreBodies, restoreWelds, restoreCensus, restoreSquads } from "./save.js";
import { makeBodyLists, rebuildBodyLists } from "./lists.js";
import Dispatch from "./Dispatch.jsx";
import FieldManual from "../ui/FieldManual.jsx";
import { GRID_CS, GRID_W, GRID_H, GRID_OX, GRID_OZ, RIM_HALF_U, RIM_HALF_V, ORIENT, fwdU, fwdDir, invW, clampToRim, OBJ_POS, SPAWN_POINTS, PONDS, ROCKS, TOWN, ROADS, PASSES, BANDS, MAP_SEED, SPAWN_U, STREAM, HILLS, genMap, makeMap, buildDepotTerrain, pondAt, rockAt, makeGrid, streamAt, planTrees, computeFlowField, checkConnectivity } from "./mapgen.js";
import { armorSpread, armorStable, parkArmor, seedBags, musterFreshStart } from "./muster.js";
import { lineCells, pieceHalf, startBuildLine, linePieces, layPieceAt, stepBuildLine } from "./buildlines.js";
import { ringBell as ringBellOut } from "./bell.js";

// THE FIELD MANUAL's don't-show-again flag (P6 T8). "off" means never
// auto-open again; anything else (including absent) means the tour greets
// every fresh war. A resumed war never auto-opens it either way.
const MANUAL_KEY = "coldsnap-wf-manual";


// P6 T1: route bookkeeping, one squad, once per sim tick (stepDepot calls
// it before stepSquad). Draws a route when the destination is new, rewrites
// an unreachable destination to the route's honest end (and a patrol's
// matching endpoint with it), and redraws the route when progress stalls
// (under half a meter of approach in three seconds — the mid-march stall's
// tombstone). Deterministic, zero rng, no draws.
function stepSquadRouting(grid, sq, world) {
  if (!sq.dest || (sq.order !== "move" && sq.order !== "attack" && sq.order !== "build" && sq.order !== "patrol")) {
    sq._route = null; sq._routeDest = null; return;
  }
  const destChanged = !sq._routeDest || Math.hypot(sq._routeDest.x - sq.dest.x, sq._routeDest.z - sq.dest.z) > 0.5;
  const wp = sq._route && sq._route.length ? sq._route[0] : sq.dest;
  const dWp = Math.hypot(wp.x - sq.anchor.x, wp.z - sq.anchor.z);
  let stalled = false;
  if (!destChanged) {
    // the stall watch: approach distance must shrink, or the route is stale
    if (sq._routeD == null || dWp < sq._routeD - 0.5) { sq._routeD = dWp; sq._routeT = 0; }
    else { sq._routeT = (sq._routeT || 0) + 1 / 120; }
    if (sq._routeT < 3) return;
    stalled = true;
  }
  sq._routeD = null; sq._routeT = 0;
  // P7 T16: the stall's usual cause is a LIVING blocker the grid can't see —
  // a parked friendly hull, a standing squad. Mark their ground for this
  // redraw and route around them. Friendly flesh and any friendly hull only —
  // enemy contact is combat, not traffic. Runs ONLY on the stalled redraw,
  // never the fresh-dest path (destChanged never sets stalled).
  if (stalled) {
    const sx = sq.anchor.x, sz = sq.anchor.z;
    const dx = wp.x - sx, dz = wp.z - sz, dl = Math.hypot(dx, dz) || 1;
    const ux = dx / dl, uz = dz / dl, segLen = Math.min(10, dl);
    for (const b of world.bodies) {
      if (!b.alive) continue;
      const isHull = b.kind === "vehicle" && b.team === sq.team;
      const isFlesh = b.kind === "unit" && b.team === sq.team && !sq.memberIds.includes(b.id);
      if (!isHull && !isFlesh) continue;
      const bx = b.pos.x - sx, bz = b.pos.z - sz;
      const along = bx * ux + bz * uz;
      if (along < 0 || along > segLen) continue;
      if (Math.abs(bx * uz - bz * ux) > 3.5) continue;
      const g = grid.worldToGrid(b.pos.x, b.pos.z);
      if (grid.inBounds(g.gx, g.gz)) (sq._avoid || (sq._avoid = [])).push({ ci: grid.idx(g.gx, g.gz), until: world.t + 25 });
    }
  }
  if (sq._avoid) sq._avoid = sq._avoid.filter((a) => a.until > world.t);
  const route = planRoute(grid, sq.anchor.x, sq.anchor.z, sq.dest.x, sq.dest.z,
    sq._avoid && sq._avoid.length ? { avoid: new Set(sq._avoid.map((a) => a.ci)) } : null);
  if (!route || !route.pts.length) { sq._route = null; sq._routeDest = { x: sq.dest.x, z: sq.dest.z }; return; }
  if (!route.reached) {
    // the honest clamp: they go as close as ground allows, and the order
    // (and a patrol's turnaround point) now SAYS so.
    const end = route.pts[route.pts.length - 1];
    if (sq.order === "patrol") {
      if (sq._patA && Math.hypot(sq.dest.x - sq._patA.x, sq.dest.z - sq._patA.z) < 0.5) sq._patA = { x: end.x, z: end.z };
      else if (sq._patB && Math.hypot(sq.dest.x - sq._patB.x, sq.dest.z - sq._patB.z) < 0.5) sq._patB = { x: end.x, z: end.z };
    }
    sq.dest = { x: end.x, z: end.z };
  }
  sq._route = route.pts;
  sq._routeDest = { x: sq.dest.x, z: sq.dest.z };
}

// ================================================================ towers
export function stepTowers(world, T, discipline, possessedId) {
  const dt = world.dt;
  for (const b of world.bodies) {
    if (b.kind !== "tower" || !b.alive) continue;
    // POSSESSION (P4 T3, mk0.92): a possessed tower stops auto-acquiring —
    // the owner's aim is its aim now (possessedTowerFire, called from the
    // frame loop). Cooldown still decays here; nothing else runs.
    if (possessedId === b.id) { b.fireCd = (b.fireCd || 0) - dt; continue; }
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
      const pool = world._L ? world._L.foes : world.bodies; // T10
      let bd = eR * eR;
      for (const e of pool) {
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
    // T4: interior columns — derived from the LIVE (rotation-swapped) dims,
    // the proving grounds' warehouse rule: a third in from each end, mirrored.
    // Derived, never stored: both swaps rotate the building under the rule.
    const colAt = t.cols
      ? (() => {
          const c1x = Math.floor(t.nx / 3), c1z = Math.floor(t.nz / 3);
          const c2x = t.nx - 1 - c1x, c2z = t.nz - 1 - c1z;
          return (ix, iz) => (ix === c1x && iz === c1z) || (ix === c2x && iz === c2z);
        })()
      : () => false;
    // T4: drive doors run down the LONG axis — derived from live dims too.
    const driveZ = t.drive && t.nz >= t.nx;
    // P7 T5 (mk1.34, owner): THE PRECAST DEPOT — column-and-panel, the
    // warehouse lesson at fortress scale. A quarter the lattice's bodies
    // (the measured boom at the wall drops 5.3 -> 1.6 ms); demolition goes
    // structural — shear a panel's welds and it falls as ONE piece, drop
    // columns and the roof pancakes. Same footprint, same censuses, same
    // breach law: every piece is an ordinary chunk with town set.
    if (t.depot) {
      const NY = t.ny;
      const colXs = [0, 4, 7, t.nx - 1];
      const colZs = [0, 4, t.nz - 1];
      const isCol = (ix, iz) =>
        (iz === 0 || iz === t.nz - 1) ? colXs.indexOf(ix) >= 0
        : (ix === 0 || ix === t.nx - 1) ? colZs.indexOf(iz) >= 0 : false;
      const colTops = [];
      for (let ix = 0; ix < t.nx; ix++) for (let iz = 0; iz < t.nz; iz++) {
        if (!isCol(ix, iz)) continue;
        let below = null;
        for (let iy = 0; iy < NY; iy++) {
          const c = addBody(world, { kind: "chunk", team: 0, mass, hx: hcs, hy: hcs, hz: hcs,
            x: t.x + (ix - (t.nx - 1) / 2) * pitch, y: base + iy * pitch, z: t.z + (iz - (t.nz - 1) / 2) * pitch,
            friction: 0.65, restitution: 0.02 });
          c.sleeping = true; c.town = t.id; c.gpos = [ix, iy, iz];
          grid3.push(c);
          if (below) addWeld(world, below, c, breakF);
          below = c;
          if (iy === NY - 1) colTops.push(c);
        }
      }
      const panelH = (NY * pitch) / 2 - 0.04;
      const panels = [];
      const addPanel = (px, pz, hx2, hz2) => {
        const p = addBody(world, { kind: "chunk", team: 0, mass: 750, hx: hx2, hy: panelH, hz: hz2,
          x: px, y: base + panelH - hcs, z: pz, friction: 0.65, restitution: 0.02 });
        p.sleeping = true; p.town = t.id; p.gpos = [-2, 0, panels.length];
        grid3.push(p); panels.push(p);
        // welded to BOTH its columns at three heights — the shear points
        for (const s of grid3) {
          if (s.gpos[0] < 0 || ![1, 3, NY - 2].includes(s.gpos[1])) continue;
          if (Math.abs(s.pos.x - px) <= hx2 + pitch && Math.abs(s.pos.z - pz) <= hz2 + pitch) addWeld(world, p, s, breakF);
        }
        return p;
      };
      for (const iz of [0, t.nz - 1]) {
        for (let bi = 0; bi + 1 < colXs.length; bi++) {
          if (iz === 0 && bi === 1) continue; // THE DOOR BAY — men walk in, hulls don't fit
          const a = colXs[bi], b2 = colXs[bi + 1];
          addPanel(t.x + ((a + b2) / 2 - (t.nx - 1) / 2) * pitch, t.z + (iz - (t.nz - 1) / 2) * pitch,
            ((b2 - a) * pitch) / 2 - hcs - 0.03, hcs);
        }
      }
      for (const ix of [0, t.nx - 1]) {
        for (let bi = 0; bi + 1 < colZs.length; bi++) {
          const a = colZs[bi], b2 = colZs[bi + 1];
          addPanel(t.x + (ix - (t.nx - 1) / 2) * pitch, t.z + ((a + b2) / 2 - (t.nz - 1) / 2) * pitch,
            hcs, ((b2 - a) * pitch) / 2 - hcs - 0.03);
        }
      }
      // THE ROOF: one rigid slab on the caps and panel tops — the hangar's
      // proven pancake (1-hop convergence, falls whole when the ring shears)
      const slab = addBody(world, { kind: "chunk", team: 0, mass: 900,
        hx: ((t.nx - 1) / 2) * pitch - hcs, hy: 0.2, hz: ((t.nz - 1) / 2) * pitch - hcs,
        x: t.x, y: base + (NY - 0.5) * pitch + 0.2, z: t.z, friction: 0.65, restitution: 0.02 });
      slab.sleeping = true; slab.town = t.id; slab.gpos = [-1, NY, -1];
      grid3.push(slab);
      for (const cTop of colTops) addWeld(world, slab, cTop, breakF);
      for (const p of panels) addWeld(world, slab, p, breakF);
      // the crowns: the four corner silhouettes, on the slab
      for (const [bx, bz] of [[0, 0], [t.nx - 1, 0], [0, t.nz - 1], [t.nx - 1, t.nz - 1]]) {
        let below = slab;
        for (let iy = NY + 1; iy <= NY + 2; iy++) {
          const c = addBody(world, { kind: "chunk", team: 0, mass, hx: hcs, hy: hcs, hz: hcs,
            x: t.x + (bx - (t.nx - 1) / 2) * pitch, y: base + iy * pitch, z: t.z + (bz - (t.nz - 1) / 2) * pitch,
            friction: 0.65, restitution: 0.02 });
          c.sleeping = true; c.town = t.id; c.gpos = [bx, iy, bz];
          grid3.push(c);
          addWeld(world, below, c, breakF);
          below = c;
        }
      }
    } else {
      for (let ix = 0; ix < t.nx; ix++) for (let iy = 0; iy <= t.ny; iy++) for (let iz = 0; iz < t.nz; iz++) {
        const perim = ix === 0 || ix === t.nx - 1 || iz === 0 || iz === t.nz - 1;
        const corner = (ix <= 1 || ix >= t.nx - 2) && (iz <= 1 || iz >= t.nz - 2);
        if (iy < t.ny && !perim && !colAt(ix, iz)) continue;
        if (iy === t.ny && (t.roof === false || t.slab)) continue; // T4: a slab replaces the granular roof below
        if (ix === t.door && (iz === 1 || iz === 2) && iy <= 2) continue;
        // T4: drive-through — doors carved through BOTH end walls of the long
        // axis, full width bar the corners, every course but the top lintel.
        if (t.drive && iy < t.ny - 1 && (driveZ
          ? (iz === 0 || iz === t.nz - 1) && ix >= 1 && ix <= t.nx - 2
          : (ix === 0 || ix === t.nx - 1) && iz >= 1 && iz <= t.nz - 2)) continue;
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
      const key = (a, b, c2) => a + "," + b + "," + c2;
      const map = new Map(grid3.map((c) => [key(c.gpos[0], c.gpos[1], c.gpos[2]), c]));
      const townBreakF = breakF; // P7 T3 (owner): normal welds — the depot is big, not magic; the breach bar is what makes it a siege
      for (const c of grid3) {
        const g = c.gpos;
        for (const d of [[1, 0, 0], [0, 1, 0], [0, 0, 1]]) {
          const o = map.get(key(g[0] + d[0], g[1] + d[1], g[2] + d[2]));
          if (o) addWeld(world, c, o, townBreakF);
        }
      }
      // T4: THE SLAB — one rigid 800kg roof plate, sized inside the wall ring
      // with the standard ~2cm joint, welded to the top two courses (the
      // proving grounds' proven form: 1-hop convergence, pancakes whole when
      // the ring shears). It joins stones/n0 so a fallen roof counts as ruin.
      if (t.slab) {
        const shx = ((t.nx - 1) / 2) * pitch - hcs - 0.02;
        const shz = ((t.nz - 1) / 2) * pitch - hcs - 0.02;
        const slab = addBody(world, {
          kind: "chunk", team: 0, mass: 800, hx: shx, hy: 0.2, hz: shz,
          x: t.x, y: base + (t.ny - 1) * pitch + 0.2, z: t.z,
          friction: 0.65, restitution: 0.02,
        });
        slab.sleeping = true; slab.town = t.id; slab.gpos = [-1, t.ny, -1];
        for (const c of grid3) if (c.gpos[1] >= t.ny - 2) addWeld(world, slab, c, townBreakF);
        grid3.push(slab);
      }
    }
    const cells = townFootprint(grid, t);
    for (const ci of cells) { const c = grid.cells[ci]; c.blocked = true; c.building = t.id; c.bTeam = t.team === 2 ? 2 : (t.depot ? 1 : 0); }
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
    for (const ci of b.cells) { const c = grid.cells[ci]; c.blocked = false; c.building = null; c.bTeam = 0; }
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

// March + combat drivers. Vehicles first (drivers.js — the motor pool,
// mk1.30), then infantry (units.js) — the mk1.21 order, tanks before men,
// which is also the rng draw-order contract. DepotGame supplies the flow
// field and the orientation-aware fwdDir/invW.
function stepEnemies(world, grid, T, S) {
  stepDrivers(world, grid, fwdDir, T, invW, {
    possessedId: S.possess && S.possess.kind === "vehicle" ? S.possess.id : 0,
    squads: S.squads,
  });
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
  stepEnemies(world, grid, T, S);
  // Squads (Phase 5 Task 3), after enemies, before towers — the brief's
  // loop-order contract: prune dead members -> delete empty squads ->
  // stepSquad (movement) -> squadFire (combat). squadFire threads T + invW
  // so player squads fog-gate on the SAME field towers do (team 1).
  if (S && S.squads) {
    S.squads = pruneSquads(world, S.squads);
    // POSSESSION (P4 T1, mk0.90): every man in a possessed squad dying frees
    // the stick automatically — nothing left to drive.
    if (S.possess && S.possess.kind === "squad" && !S.squads.some((q) => q.id === S.possess.id)) S.releasePossession();
    stepTransports(world, S.squads);   // P7 T4: boarding, riding, the sealed hold
    // P7 T8: the ferry's turnaround — arrived out: drop the ramp and turn
    // for home; arrived back: the post resumes.
    for (const b of world.bodies) {
      if (b.kind !== "vehicle" || b.team !== 2 || b.vtype !== "apc" || !b.ferry || !b.alive) continue;
      if (b.order === "defend") {   // armorGoal's arrival flip
        if (b.ferry === "out") { unloadEnemyRiders(world, b); b.ferry = "back"; b.order = "move"; b.dest = { x: b.homeX != null ? b.homeX : b.pos.x, z: b.homeZ != null ? b.homeZ : b.pos.z }; b._route = null; b._routeDest = null; }
        else b.ferry = null;
      }
    }
    if (S.selSquadId != null && !S.squads.some((q) => q.id === S.selSquadId)) { S.selSquadId = null; S.orderMode = null; S.buildPt0 = null; }
    // VISION T4 (mk0.74, owner's ruling): an attacking squad that SEES an
    // enemy in weapon reach halts and fights — the halt is the squad's own
    // leg-pause field held open, so the fire rule and the leg machinery are
    // untouched and no rng is drawn. MOVE and BUILD stay quiet; sappers
    // never halt for men (their attack is the charge, not the rifle).
    // Throttled like every scan in this codebase; deterministic.
    const ENGAGE_CHECK_S = 0.2, ENGAGE_HOLD_S = 0.35;
    const engageCheck = (sq) => {
      // COMMAND T3 (mk0.85): a patrol that sees an enemy in reach halts and
      // fights exactly as an attack does — same hold, same fields.
      if ((sq.order !== "attack" && sq.order !== "patrol") || sq.type === "sappers" || sq.type === "engineers") return;
      sq._engageCd = (sq._engageCd || 0) - world.dt;
      if (sq._engageCd > 0) return;
      sq._engageCd = ENGAGE_CHECK_S;
      const arms = INFANTRY_ARMS[sq.type];
      if (!arms) return;
      const R2 = arms.range * arms.range;
      const pool = world._L ? world._L.foes : world.bodies; // T10
      for (const e of pool) {
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
      if (sq.ridingIn != null || sq.order === "ride") continue; // P7 T4: the hold is sealed — no legs, no eyes, no rifles
      if (S.possess && S.possess.kind === "squad" && sq.id === S.possess.id) {
        // POSSESSION: the stick owns this squad — no engage check, no order
        // machine, no auto-fire (T2 gives the trigger). Input is the frame's
        // snapshot; the drive runs at the fixed step like all movement.
        const a0 = { x: sq.anchor.x, z: sq.anchor.z };
        const pi = S.possessInput || { vx: 0, vz: 0 };
        drivePossessedSquad(world, sq, pi.vx, pi.vz, world.dt, S.reticle);
        const cl = clampToRim(sq.anchor.x, sq.anchor.z);
        // MASONRY (T8, mk0.98): a building footprint (or a rock, or a wall
        // line) refuses the anchor the way the rim does — the formation can
        // never be driven into a lattice it would have to shove through.
        // The whole tick's move reverts (no slide); the stick just stops.
        const gA = grid.worldToGrid(cl.x, cl.z);
        const cellA = grid.inBounds(gA.gx, gA.gz) ? grid.cells[grid.idx(gA.gx, gA.gz)] : null;
        sq.anchor = cellA && (cellA.blocked || cellA.wallId) ? a0 : { x: cl.x, z: cl.z };
        // POSSESSION (P4 T2, mk0.91): squadFire normally decays u.fireCd —
        // it's skipped for a possessed squad, so the trigger (possessedVolley)
        // does not, and the cooldown must decay somewhere or it never clears.
        for (const id of sq.memberIds) {
          const u = world.byId.get(id);
          if (u && u.alive) { uprightMember(u, world.dt); u.fireCd = (u.fireCd || 0) - world.dt; }
        }
        continue;
      }
      stepSquadRouting(grid, sq, world);
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
  // POSSESSION (P4 T3, mk0.92): a possessed tower killed out from under the
  // owner frees the trigger automatically — nothing left to fire, same rule
  // T1 gives a wiped-out possessed squad.
  if (S.possess && S.possess.kind === "tower") {
    const ptw = world.byId.get(S.possess.id);
    if (!ptw || !ptw.alive) S.releasePossession();
  }
  // POSSESSION (P7 T2): a possessed vehicle killed out from under the owner
  // frees the trigger automatically, same rule as a squad or a tower.
  if (S.possess && S.possess.kind === "vehicle") {
    const pv = world.byId.get(S.possess.id);
    if (!pv || !pv.alive) S.releasePossession();
  }
  stepTowers(world, T, discipline, S.possess && S.possess.kind === "tower" ? S.possess.id : undefined);
  // WIND TOGGLE (mk0.95, owner's accuracy-tuning request): off = dead calm
  // for BOTH sides' shots and shells (drift and hold-off zero out through
  // the same world.wind every shooter reads). Deterministic either way —
  // windAt is a pure function and the toggle draws nothing.
  world.wind = S.windOn === false ? { x: 0, z: 0, mag: 0 } : windAt(MAP_SEED, world.t);
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
  // P7 T7: the tier-1 mirror — runners and breakers join the player's own list.
  { key: "sq_runners", label: "RUNNERS", icon: "⇶", cost: SQUAD_SPECS.runners.cost },
  { key: "sq_breakers", label: "BREAKERS", icon: "⨳", cost: SQUAD_SPECS.breakers.cost },
  // P7 T9: THE HERO TIER — bell 10, both ladders. Bar-visible only once
  // unlocked like everything else; the buy is a two-tap arm (S.buyHero),
  // never a build mode.
  { key: "hero_bison", label: "BISON", icon: "⛨", cost: BISON.cost },
  { key: "hero_apc", label: "APC", icon: "⬒", cost: APC.cost },
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
  // POSSESSION (P4 T1, mk0.90): the knob's screen position is pushed
  // straight to the DOM from the pointer handlers below — not React state —
  // the same discipline ContractSandbox.jsx's own joystick uses, so a drag
  // never queues a re-render.
  const joyKnobRef = useRef(null);
  // POSSESSION T4 (mk0.93): the right stick's own knob ref — same discipline
  // as joyKnobRef, a separate DOM element and a separate live drag state.
  const joyRKnobRef = useRef(null);
  // FIRE FEEDBACK (mk0.96): the FIRE button's own ref — setFireHeld paints
  // its held state straight to the DOM.
  const fireBtnRef = useRef(null);
  // P7 T2: the Bison's coax MG button — same discipline as fireBtnRef.
  const mgBtnRef = useRef(null);
  // Held in a ref, not read from props inside the effect, for the same reason
  // every other loop input is: the effect must never close over a value React
  // can change under it. Captured once, at mount.
  const resumeRef = useRef(resume);
  const [isTouch] = useState(detectTouch);
  const [hud, setHud] = useState(HUD0);
  const [fatal, setFatal] = useState(null);
  const [runId, setRunId] = useState(0);
  const [rereadDispatch, setRereadDispatch] = useState(false);
  // P6 T8: the field manual. React state only — the sim never sees it.
  const [manualOpen, setManualOpen] = useState(false);
  useEffect(() => {
    if (resumeRef.current) return; // a resumed war is not a first entry
    let live = true;
    (async () => {
      try { const r = await window.storage.get(MANUAL_KEY); if (live && !(r && r.value === "off")) setManualOpen(true); }
      catch (e) { if (live) setManualOpen(true); }
    })();
    return () => { live = false; };
  }, []);
  const closeManual = (never) => {
    setManualOpen(false);
    if (never) { try { window.storage.set(MANUAL_KEY, "off"); } catch (e) {} }
  };
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
      const field = makeField(181, 2.0, MAP_SEED);
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
      // P7 T17 (owner): HULLS RESPECT FRIENDLY SANDBAGS — a bag claims its
      // cell for HULL routing only (men still fight over bags; foot routing,
      // the enemy flow, and connectivity never read c.bag). The side rides
      // the body (bagSide) so a resumed war re-stamps honestly — b.team is 1
      // on every bag by spawnSandbag's old shape and must not be trusted.
      // Defined here (grid exists, ahead of both the resume and fresh-boot
      // branches below) rather than beside seedBags — the resume branch
      // stamps resumed bags before seedBags' fresh-boot-only block ever runs.
      const stampBag = (b, side) => {
        b.bagSide = side;
        const cell = grid.cellAt(b.pos.x, b.pos.z);
        if (cell) { cell.bag = side; cell.bagId = b.id; }
      };
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
      world.streamAt = (x, z) => streamAt(x, z);
      // P7 T2/T3/T4: THE STARTING ARMOR — a Bison AND an APC parked by
      // each depot, the enemy's ARMED AT POST (owner) — driving doctrine
      // still waits for its commander (Task 6). FAIL-PROOF (P7 T3): a
      // widened fixed ring (10-26m) first, then a brute nearest-clear-cell
      // sweep (8-30m) backstops it — a hemmed ring must never leave a side
      // tankless. AMENDMENT 1 (P7 T4, owner): armor parks STABLE — every
      // clear cell is also vetted for a flat footprint (stableAt), and the
      // hull spawns asleep (no creep, no slide, no jitter). The brute
      // sweep tracks the flattest clear cell it sees as its own backstop —
      // stability is preferred, never blocking. Deterministic; no rng
      // stream is touched.
      // P7 T9 (owner): HOISTED TO MOUNT SCOPE — parkArmor/apcSeqN/depotP/
      // depotE used to be boot-local (the `else` branch below, fresh boot
      // only). The hero tier's player buy and the enemy's draw-free
      // replacement both need to park a fresh hull long after boot, off
      // the SAME apcSeq counter — a replacement APC must never seat-collide
      // with a surviving one. Same closure over world/grid/field/TOWN, same
      // body, unchanged.
      let apcSeqN = 0;
      const nextApcSeq = () => ++apcSeqN;
      const depotP = TOWN.find((t) => t.depot && t.team !== 2), depotE = TOWN.find((t) => t.depot && t.team === 2);
      // town / censuses / rocks: laid fresh, or lifted back off the save.
      let town, depotCensus, depotCensus2, rocksLive, resBodies = null;
      if (RES) {
        // Step 4. Every body in the file goes back in saved order (ids are
        // reassigned, so everything that pointed at one points at an INDEX);
        // then the welds, by index pair, with their original joint anchors.
        resBodies = restoreBodies(world, RES, ROCKS);
        restoreWelds(world, RES, resBodies);
        // P7 T17: resumed bags re-claim their ground for hull routing.
        for (const b of resBodies) if (b.sandbag && b.alive) stampBag(b, b.bagSide || 1);
        // P7 T9 (owner): RESUME SEAT-COLLISION GUARD — the mount-scope
        // apcSeqN counter (hoisted above) must not hand out a seat number a
        // restored APC already carries, or a hero-tier replacement's riders
        // could stash onto the wrong hull. Seeded past the highest restored
        // seat; a war with no surviving APC leaves it at 0, exactly the
        // fresh-boot start.
        for (const b of resBodies) if (b.kind === "vehicle" && b.vtype === "apc" && b.apcSeq > apcSeqN) apcSeqN = b.apcSeq;
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
          if (!ruined) for (const ci of cells) { const c = grid.cells[ci]; c.blocked = true; c.building = t.id; c.bTeam = t.team === 2 ? 2 : (t.depot ? 1 : 0); }
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
          c.blocked = true; c.wallId = b.id; c.bTeam = b.team || 1;
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
      // same playable rim the renderer clips to (halfU 60 / halfV 60, see
      // makeRenderer's rim opt above) — reuse rather than reinvent extents.
      const T = makeTerritory(RIM_HALF_U, RIM_HALF_V);
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
          // P7 T10 guard: a tripwire's flare is also kind "flag" (a temporary
          // sight-only eye, sight.js's eyeOf) — b._dieT != null marks it, and
          // it must NEVER emit territory (it lights sight, not ground).
          else if (b.kind === "flag" && b._dieT == null) { const c = invW(b.pos.x, b.pos.z); out.push({ x: c.u, z: c.v, w: EMIT.depot.w, r: EMIT.depot.r, sign: b.team === 2 ? -1 : 1 }); }
          else if (b.kind === "unit" && b.team === 1 && b.alive && !b.riding) { const c = invW(b.pos.x, b.pos.z); out.push({ x: c.u, z: c.v, w: EMIT.unit.w, r: EMIT.unit.r, sign: 1 }); }
          else if (b.kind === "chunk" && b.sandbag && b.alive) { const c = invW(b.pos.x, b.pos.z); out.push({ x: c.u, z: c.v, w: EMIT.wall.w, r: EMIT.wall.r, sign: 1 }); }
          else if (b.kind === "unit" && b.team === 2 && b.alive && !b.riding) { const c = invW(b.pos.x, b.pos.z); out.push({ x: c.u, z: c.v, w: EMIT.unit.w, r: EMIT.unit.r, sign: -1 }); }
          else if (b.kind === "vehicle" && b.team === 2 && b.alive) { const c = invW(b.pos.x, b.pos.z); out.push({ x: c.u, z: c.v, w: EMIT.vehicle.w, r: EMIT.vehicle.r, sign: -1 }); }
          else if (b.kind === "vehicle" && b.team === 1 && b.alive) { const c = invW(b.pos.x, b.pos.z); out.push({ x: c.u, z: c.v, w: EMIT.vehicle.w, r: EMIT.vehicle.r, sign: 1 }); }
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
        // T5: the whole tree plan, planted (planTrees carries the treeline,
        // the hill copses, the drawn copses and the forests — one function,
        // shared with the test suite).
        for (const p of planTrees()) treeAt(p.x, p.z);
        // P1.5 T4 (mk0.60) — THE DEPOT COMES WITH COVER. Four to six sandbags
        // ringed on each depot at map-build time, so a fresh front opens with
        // something to lie behind instead of bare ground. P7 T3 (owner):
        // generalized to both depots — the enemy's was never dressed before,
        // symmetry now — same rules, its own derived stream.
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
        // Ring radius grown to 7.8m (P7 T3) — the depots got bigger.
        seedBags(world, grid, TOWN.find((t) => t.depot && t.team !== 2), 0x5ba6, stampBag);
        seedBags(world, grid, TOWN.find((t) => t.depot && t.team === 2), 0x5ba7, stampBag); // P7 T3: their depot was never dressed — symmetry now
        // P7 T2/T3/T4: THE STARTING ARMOR — a Bison AND an APC parked by
        // each depot, fresh boot only (a RESUME's hulls are already in the
        // save). P7 T9: parkArmor/apcSeqN/depotP/depotE are MOUNT-SCOPE now
        // (hoisted above, just after world.streamAt) — the hero tier's
        // player buy and the enemy's draw-free replacement both need to
        // park a fresh hull long after boot, off this exact same function.
        parkArmor(world, grid, field, depotP, 1, "bison", nextApcSeq); parkArmor(world, grid, field, depotP, 1, "apc", nextApcSeq);
        parkArmor(world, grid, field, depotE, 2, "bison", nextApcSeq); parkArmor(world, grid, field, depotE, 2, "apc", nextApcSeq);
      }
      const objG = grid.worldToGrid(OBJ_POS.x, OBJ_POS.z);
      computeFlowField(grid, objG.gx, objG.gz);
      R = makeRenderer(canvas, world, {
        town: false, camera: "tactical", fadeDecals: true,
        // playable rim (matches buildDepotTerrain's falloff box, 60x60
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
      const EXT = { x: 95, z: 95 }; // square rim 90 + 5m margin; same at every rotation
      const A = makeGameAudio();
      A.setReflectors([
        ...ROCKS.filter((k) => k.r >= 4),
        ...TOWN.map((t) => ({ x: t.x, z: t.z, r: Math.max(t.nx, t.nz) * MASON.pitch * 0.6 })),
      ]);
      // T3: the stream's visible water — the canonical centerline sampled at
      // 2m, split at the causeway, widened, world-transformed, at 0.78.
      const streamRibs = [];
      if (STREAM) {
        let run = [];
        const flush = () => { if (run.length >= 2) streamRibs.push({ pts: run, w: STREAM.w + 1 }); run = []; };
        for (let u = -90; u <= 90; u += 2) {
          if (Math.abs(u - STREAM.bridgeU) < 3) { flush(); continue; }
          const i2 = Math.max(0, Math.min(STREAM.pts.length - 2, Math.floor((u + 90) / 15)));
          const a = STREAM.pts[i2], b = STREAM.pts[i2 + 1];
          const t = Math.max(0, Math.min(1, (u - a.u) / (b.u - a.u || 1)));
          const w = fwdU(u, a.v + (b.v - a.v) * t);
          run.push({ x: w.x, y: 0.78, z: w.z });
        }
        flush();
      }
      // rocksLive, not ROCKS: on a resume a ridge the war already breached
      // must not be painted back onto the ground it no longer occupies.
      R.setDressing({ rocks: rocksLive, ponds: PONDS, streams: streamRibs });
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

      // WIND toggle (mk0.95, owner's request while tuning possessed-fire
      // accuracy): OFF = dead calm — every shot's drift and hold-off zero
      // out through the one world.wind read in stepDepot. Both sides feel
      // it equally (aim fully equal, the standing law). Same persistence
      // pattern as FOG/DISCIPLINE above. Default ON.
      let windOn = true;
      try { windOn = window.localStorage.getItem("coldsnap-depot-wind") !== "0"; } catch (e) {}

      const S = {
        resources: 120, kills: 0,
        cmdr: null, // P7 T8: the drawn armor doctrine — one boot draw (fresh war), restored on RESUME
        ws: makeDepotAssaultState(), spawnRR: 0,
        mode: null, sellMode: false, inspectId: null,
        started: false, gameOver: false, victory: false,
        paused: false, speed: 1, fogOn, discipline, windOn,
        setFog: (v) => { fogOn = v; S.fogOn = v; R.setFog(v); try { window.localStorage.setItem("coldsnap-depot-fog", v ? "1" : "0"); } catch (e) {} },
        setWind: (v) => { windOn = v; S.windOn = v; try { window.localStorage.setItem("coldsnap-depot-wind", v ? "1" : "0"); } catch (e) {} },
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
        heroArm: null, // P7 T9: the hero tier's two-tap arm ({ key, armedAt } or null)
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
        // P7 T10: MINES AND TRIPWIRES — watched points, never bodies.
        // { x, z, team, kind: "mine"|"wire", live }. Saved verbatim (save.js).
        mines: [],
        // P7 T2: the selected vehicle's own selection/order state — the
        // squad selection fields' exact shape, one Bison at a time.
        selVehId: null, vehOrderMode: null,
        // POSSESSION (P4 T1, mk0.90): { kind: "squad", id } while live, else
        // null. possessInput is the frame's world-space stick vector; joy is
        // the touch stick's own live drag state (DOM handlers below).
        possess: null, possessInput: null, joy: null,
        // POSSESSION T4/T5 (mk0.93/0.94): THE CARRIED RETICLE. reticleOff is
        // the reticle's offset from the possessed unit — the right stick
        // steers it (touch), the mouse sets it (desktop), and walking
        // carries it; reticle is the derived world point the guns and the
        // red ring read, recomputed every possessed frame. Both bounded to
        // the unit's own sight circle on seen ground. joyR is the right
        // stick's own live drag state; fireHeld mirrors the FIRE
        // button/pointer state — true while held, read once per sim tick.
        reticle: null, reticleOff: null, joyR: null, fireHeld: false,
        // P7 T2: the Bison's coax — its own held state, mirroring fireHeld.
        mgHeld: false,
        linePending: null, // COMMAND T2 (mk0.84): the proposed line, awaiting accept/reject
        hudT: 0, keys: {}, sellById: null, audio: A,
        // THE LIVING MARKET (mk1.13): the price cache, its own 1Hz
        // accumulator (beside the census's), and the once-a-second purchase
        // stamp. Transient run state, never serialized — a resumed run
        // rebuilds both within a second (no save.js edits).
        _market: null, _marketAcc: 0, _buyAt: -9,
        _minePrices: null, // P7 T10: computed beside _market, same 1Hz cadence
        // P6 T10 / Task 5 Amendment 1 (mk1.19): the idle gate — true once
        // the war goes hot (stashed by the hud census pass); starts false.
        _hot: false,
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
      if (!RES) {
        musterFreshStart(world, S, depotP);
      }
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
        S.cmdr = r.cmdr || "cautious"; // P7 T8: restored, never redrawn on resume
        S.manifest = r.manifest; S.foe = r.foe;
        S.intelUp = r.intelUp; S.intelArmedAt = r.intelArmedAt;
        S.lastDispatch = r.lastDispatch;
        S.pendingPlan = r.pendingPlan; S.intelPlan = r.intelPlan;
        S.ws = r.ws;
        S.squads = restoreSquads(RES, resBodies);
        S.nextSquadId = r.nextSquadId;
        // P7 T10: watched points restore verbatim, live flags included.
        S.mines = (r.mines || []).map((m) => ({ x: m.x, z: m.z, team: m.t, kind: m.k, live: !!m.l }));
        // Step 6, last: the ground remembers. Every mark where a man fell is
        // replayed through the same paint the kill handler uses, so the snow
        // comes back stained exactly as it was left. Scorch and tread
        // staining are NOT in the ledger and do not come back — the accepted
        // visual loss, stated in the plan.
        if (R._splat && R._splat.smear) for (const m of RES.smears || []) R._splat.smear(m.u, m.v, m.s, m.x, m.z);
      }
      stateRef.current = S;
      // P7 T10: R.setMines is a setDressing-style setter — called once here
      // at boot/restore (fresh boot: S.mines is empty, harmless), then again
      // on every lay and every trigger tick.
      R.setMines(S.mines);
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
      // THE LIVING MARKET (mk1.13): the live price for a bar key, falling
      // back to the base cost whenever the market cache hasn't computed yet
      // (the first second of a run). buyPaced is the once-a-second purchase
      // limiter — towers and squads only (interpretation line 3: engineer
      // line pieces are priced live but not paced).
      const priceNow = (key, base) => (S._market && S._market.player[key] != null ? S._market.player[key] : base);
      const buyPaced = () => {
        if (world.t - S._buyAt < 1) { toast("THE MARKET PACES YOU — one purchase a second"); return false; }
        return true;
      };
      // P7 T9: THE HERO TIER, player-side — a two-tap arm on the bar slot
      // itself (3s, the menu-exit pattern): first tap arms and toasts the
      // price, a second tap within the window buys. No ground tap, no
      // pending ghost — the bought hull parks straight onto the depot,
      // exactly like the starting pair (parkArmor, mount-scope now).
      const HERO_ARM_S = 3; // provisional (F5)
      S.buyHero = (key) => {
        if (S.gameOver || S.victory) return;
        const kind = key === "hero_apc" ? "apc" : "bison";
        const spec = kind === "apc" ? APC : BISON;
        const label = PALETTE_BY_KEY[key].label;
        const price = priceNow(key, spec.cost);
        const armed = S.heroArm && S.heroArm.key === key && world.t < S.heroArm.armedAt;
        if (!armed) {
          S.heroArm = { key, armedAt: world.t + HERO_ARM_S };
          toast(label + " — ◆" + price + " — TAP AGAIN TO ORDER");
          return;
        }
        S.heroArm = null;
        if (S.resources < price) { toast("NO SCRAP"); return; }
        if (!buyPaced()) return;
        parkArmor(world, grid, field, depotP, 1, kind, nextApcSeq);
        S.resources -= price;
        S._buyAt = world.t;
        toast("THE CONVOY DELIVERS");
      };

      const recomputeFlow = () => computeFlowField(grid, objG.gx, objG.gz);
      const buildAt = (gx, gz, mode) => {
        if (!grid.inBounds(gx, gz)) return;
        const cell = grid.cells[grid.idx(gx, gz)];
        if (cell.water) { toast("NO GROUND — open water"); return; }
        if (cell.blocked || cell.wallId) { toast("OCCUPIED"); return; }
        if (cell.ice) { toast("NO GROUND — frozen water"); return; }
        {
          const wp0 = grid.gridToWorld(gx, gz), c0 = invW(wp0.x, wp0.z);
          if (!canBuild(T, c0.u, c0.v)) { toast("GROUND NOT HELD"); return; }
        }
        const spec = mode === "wall" ? null : TOWER_SPECS[mode];
        const cost = spec ? priceNow(mode, spec.cost) : WALL_COST; // walls: no TOWER_SPECS row, state.js owns the price
        if (S.resources < cost) { toast("NO SCRAP"); return; }
        cell.blocked = true;
        if (!checkConnectivity(grid, SPAWN_POINTS, objG.gx, objG.gz)) {
          cell.blocked = false;
          toast("Leave them a road");
          return;
        }
        if (!buyPaced()) { cell.blocked = false; return; }
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
        cell.bTeam = b.team || 1;
        S.resources -= cost;
        S._buyAt = world.t;
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
        if (cell.water) return { ok: false, msg: "NO GROUND — open water" };
        const wp = grid.gridToWorld(gx, gz), c0 = invW(wp.x, wp.z);
        const spec = TOWER_SPECS[mode];
        const v = validatePlacement({
          blocked: !!(cell.blocked || cell.wallId), ice: !!cell.ice,
          held: canBuild(T, c0.u, c0.v), resources: S.resources, cost: priceNow(mode, spec.cost),
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
        S.pending = { gx, gz, mode, wp, y, poly, ringR, color, cost: priceNow(mode, spec.cost), armedAt: world.t + PENDING_ARM_S };
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
      const SQUAD_MODE = { sq_sniper: "sniper", sq_rifles: "rifles", sq_mg: "mg", sq_sappers: "sappers", sq_mortars: "mortars", sq_engineers: "engineers", sq_runners: "runners", sq_breakers: "breakers" };
      // Infantry/sandbag placement checks: same validatePlacement gate as
      // towers (occupied/ice/held/afford) — men don't claim the grid cell
      // (no cell.blocked write, no connectivity re-check: bodies, not
      // structures), but they place by the same ground rules.
      const canPlaceInfantryAt = (gx, gz, cost) => {
        if (!grid.inBounds(gx, gz)) return { ok: false, msg: "OFF THE FIELD" };
        const cell = grid.cells[grid.idx(gx, gz)];
        if (cell.water) return { ok: false, msg: "NO GROUND — open water" };
        const wp = grid.gridToWorld(gx, gz), c0 = invW(wp.x, wp.z);
        const v = validatePlacement({
          blocked: !!(cell.blocked || cell.wallId), ice: !!cell.ice,
          held: canBuild(T, c0.u, c0.v), resources: S.resources, cost,
        });
        return v.ok ? { ok: true, wp } : v;
      };
      const placeSquadAt = (gx, gz, type) => {
        const price = priceNow("sq_" + type, SQUAD_SPECS[type].cost);
        const v = canPlaceInfantryAt(gx, gz, price);
        if (!v.ok) { toast(v.msg); return; }
        if (!buyPaced()) return;
        const sq = makeSquad(S.nextSquadId++, type, 1, v.wp.x, v.wp.z);
        spawnSquadMembers(world, sq);
        S.squads.push(sq);
        // COMMAND T1 (mk0.80): a placed squad comes up already selected with
        // its radial open — defend-here is already its standing order (the
        // intrinsic default, no tap needed).
        S.selSquadId = sq.id; S.selArmedAt = world.t + PENDING_ARM_S; S.pieOpen = true;
        S.resources -= price;
        S._buyAt = world.t;
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
        S.pending = { gx, gz, mode, squad: type, wp, y, poly, ringR, color: 0xffd27a, cost: priceNow(mode, SQUAD_SPECS[type].cost), armedAt: world.t + PENDING_ARM_S }; // amber: a green fan vanishes into the held-terrain wash
      };
      // Selection: tap within 1.6m of any live member selects his squad.
      const squadAtPoint = (p) => {
        for (const sq of S.squads) {
          if (sq.ridingIn != null) continue; // P7 T4: a sealed squad is not tappable
          for (const id of sq.memberIds) {
            const u = world.byId.get(id);
            if (u && u.alive && Math.hypot(u.pos.x - p.x, u.pos.z - p.z) < 1.6) return sq;
          }
        }
        return null;
      };
      const selectedSquad = () => (S.selSquadId != null ? S.squads.find((q) => q.id === S.selSquadId) || null : null);
      // P7 T2: the Bison's own selection — vehicleAtPoint mirrors
      // squadAtPoint, team-1 vehicles only (the player's own hulls select).
      const vehicleAtPoint = (p) => {
        for (const b of world.bodies) {
          if (b.kind !== "vehicle" || !b.alive || b.team !== 1) continue;
          if (Math.hypot(b.pos.x - p.x, b.pos.z - p.z) < 3.2) return b;
        }
        return null;
      };
      const selectedVehicle = () => (S.selVehId != null ? world.byId.get(S.selVehId) || null : null);
      // P7 T2: the Bison's own radial orders — DEFEND is instant (mirrors
      // S.orderSquad's defend branch); MOVE/PATROL/ESCORT arm the aiming
      // mode and consumeVehOrderTap's ground/squad tap finishes them.
      S.orderVehicle = (kind) => {
        if (S.gameOver || S.victory) return;
        const v = selectedVehicle();
        if (!v || world.t < S.selArmedAt) return;
        if (kind === "defend") { v.order = "defend"; v.dest = null; v.goal = null; v._route = null; v._routeDest = null; S.vehOrderMode = null; S.buildPt0 = null; }
        else if (kind === "move" || kind === "patrol" || kind === "escort" || kind === "load") {
          if (S.vehOrderMode === kind) { S.vehOrderMode = null; S.buildPt0 = null; return; }
          S.vehOrderMode = kind; S.buildPt0 = null;
        }
      };
      // P7 T2: THE OVERRUN SAFETY toggle — CAREFUL (default) brakes for the
      // Bison's own men; FREE takes the safety off (drivers.js reads v.tracks).
      S.toggleTracks = () => {
        const v = selectedVehicle();
        if (!v || world.t < S.selArmedAt) return;
        v.tracks = (v.tracks || "careful") === "careful" ? "free" : "careful";
      };
      // P7 T4: UNLOAD — the pie's own button (only shown when the APC
      // carries riders); unloadApc (transports.js) does the real work.
      S.unloadVehicle = () => {
        const v = selectedVehicle();
        if (!v || world.t < S.selArmedAt) return;
        unloadApc(world, S.squads, v);
      };
      // POSSESSION (P7 T2): TAKE CONTROL on the Bison — same hygiene as
      // S.takeControl/S.takeControlTower: digs in (order defend, goal/route
      // cleared), hands the stick over, clears every other selection/order
      // UI state.
      S.takeControlVehicle = () => {
        const v = selectedVehicle();
        if (!v || world.t < S.selArmedAt) return;
        v.order = "defend"; v.dest = null; v.goal = null; v._route = null; v._routeDest = null;
        S.possess = { kind: "vehicle", id: v.id };
        S.fireHeld = false; S.mgHeld = false;
        const pc2 = possessCenter();
        S.reticleOff = pc2 ? reclampReticle(T.sight, 1, pc2, possessSightR(), { dx: 0, dz: 6 }, invW) : null;
        S.reticle = pc2 && S.reticleOff ? { x: pc2.x + S.reticleOff.dx, z: pc2.z + S.reticleOff.dz } : null;
        S.selVehId = null; S.vehOrderMode = null; S.selSquadId = null; S.orderMode = null; S.buildPt0 = null; S.linePending = null; S.pieOpen = false;
        R.overlay.setLinePreview(false);
      };
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
        } else if (kind === "build_mines" || kind === "build_wires") {
          // P7 T10: the sapper build gate — engineers' own two-tap shape, sappers only.
          if (sq.type !== "sappers") return;
          if (S.orderMode === kind) { S.orderMode = null; S.buildPt0 = null; return; }
          S.orderMode = kind; S.buildPt0 = null;
        } else if (kind === "patrol") {
          // COMMAND T3 (mk0.85): the same two-tap flow the build orders use —
          // no type restriction here (the pie only offers the wedge to
          // squads that aren't engineers or sappers; consumeOrderTap's
          // patrol branch trusts that, same as 2.4's build branch did with
          // its engineer guard).
          if (S.orderMode === kind) { S.orderMode = null; S.buildPt0 = null; return; }
          S.orderMode = kind; S.buildPt0 = null;
        }
      };
      // COMMAND T4 (mk0.86): STRUCTURES — an instant toggle, like DEFEND: it
      // flips squad.prefStruct and the wedge's act closes the pie AND
      // deselects (call site does the deselect, same as DEFEND's). Armed
      // types only (an INFANTRY_ARMS row) — engineers and sappers never get
      // the wedge. squadFire (state.js) reads the flag every tick; it rides
      // a save as a plain boolean (save.js's generic squad serializer).
      S.toggleStructFirst = () => {
        const sq = selectedSquad();
        if (!sq || world.t < S.selArmedAt) return;
        if (!INFANTRY_ARMS[sq.type]) return;
        sq.prefStruct = !sq.prefStruct;
      };

      // POSSESSION T4 (mk0.93): the possessed unit's own sight circle: a
      // squad sees with its best living eye (a sniper pair's spotter reaches
      // 46), a tower with its height. The reticle lives inside THIS circle —
      // the owner's ruling that closes the far-eyes range question.
      const possessCenter = () => {
        const P = S.possess;
        if (!P) return null;
        if (P.kind === "tower") { const b = world.byId.get(P.id); return b ? { x: b.pos.x, z: b.pos.z } : null; }
        if (P.kind === "vehicle") { const b = world.byId.get(P.id); return b ? { x: b.pos.x, z: b.pos.z } : null; }
        const sq = S.squads.find((q) => q.id === P.id);
        return sq ? { x: sq.anchor.x, z: sq.anchor.z } : null;
      };
      const possessSightR = () => {
        const P = S.possess;
        if (!P) return 0;
        if (P.kind === "tower") { const b = world.byId.get(P.id); return b ? eyeOf(b).r : 0; }
        if (P.kind === "vehicle") { const b = world.byId.get(P.id); return b ? eyeOf(b).r : 0; }
        const sq = S.squads.find((q) => q.id === P.id);
        let r = 0;
        if (sq) for (const id of sq.memberIds) { const u = world.byId.get(id); if (u && u.alive) r = Math.max(r, eyeOf(u).r); }
        return r;
      };
      // POSSESSION (P4 T1, mk0.90): TAKE CONTROL — every squad type gets the
      // wedge. Digs the squad in where it stands (defend), hands the stick
      // over, and clears every other selection/order UI state the way
      // DEFEND's own instant action does.
      S.takeControl = () => {
        const sq = selectedSquad();
        if (!sq || world.t < S.selArmedAt) return;
        sq.order = "defend"; sq.dest = null; sq._legTarget = null; sq._pauseT = 0; sq._build = null; sq._threatSig = undefined;
        S.possess = { kind: "squad", id: sq.id };
        S.possessInput = { vx: 0, vz: 0 };
        // POSSESSION HYGIENE (mk0.91 audit item A, carried to T4/T5): a
        // stale reticle or a FIRE flag stuck by a mid-hold bell release can
        // never carry into the next possession — cleared on every take, same
        // as on release; the offset is then freshly seeded 4m ahead
        // (reclampReticle legalizes any seed) and the world point derived.
        S.fireHeld = false;
        const pc0 = possessCenter();
        S.reticleOff = pc0 ? reclampReticle(T.sight, 1, pc0, possessSightR(), { dx: 0, dz: 4 }, invW) : null;
        S.reticle = pc0 && S.reticleOff ? { x: pc0.x + S.reticleOff.dx, z: pc0.z + S.reticleOff.dz } : null;
        S.selSquadId = null; S.orderMode = null; S.buildPt0 = null; S.linePending = null;
        R.overlay.setLinePreview(false);
      };
      // POSSESSION (P4 T3, mk0.92): TAKE CONTROL on a tower — gun towers
      // only (the tower pie's possess slot is gated on spec.fireRate > 0;
      // frost has none). No stick, no selection to clear beyond inspect.
      S.takeControlTower = (id) => {
        const b = world.byId.get(id);
        if (!b || b.kind !== "tower") return;
        S.possess = { kind: "tower", id: b.id };
        S.fireHeld = false;
        const pc1 = possessCenter();
        S.reticleOff = pc1 ? reclampReticle(T.sight, 1, pc1, possessSightR(), { dx: 0, dz: 4 }, invW) : null;
        S.reticle = pc1 && S.reticleOff ? { x: pc1.x + S.reticleOff.dx, z: pc1.z + S.reticleOff.dz } : null;
        S.inspectId = null; S.pieOpen = false;
      };
      S.releasePossession = () => {
        if (!S.possess) return;
        const wasSquad = S.possess.kind === "squad";
        const sq = wasSquad ? S.squads.find((q) => q.id === S.possess.id) : null;
        // POSSESSION (P7 T2): the Bison released where you left it — back to
        // auto driving, dug in (order defend), same intrinsic default a
        // released squad gets.
        if (S.possess.kind === "vehicle") {
          const pv = world.byId.get(S.possess.id);
          if (pv && pv.alive) { pv.depotDrive = "auto"; pv.order = "defend"; pv.dest = null; pv.goal = null; }
        }
        S.possess = null; S.possessInput = null;
        // POSSESSION HYGIENE (mk0.91 audit item A, carried to T4/T5): the
        // same stale-trigger clear, on every release — the reticle and its
        // offset die with the possession, fireHeld can't stick from a
        // mid-hold bell release.
        S.reticle = null; S.reticleOff = null; S.fireHeld = false; S.mgHeld = false;
        if (sq) {
          // released where you left them: dig in — the intrinsic default
          sq.order = "defend"; sq.dest = null; sq._legTarget = null; sq._threatSig = undefined;
          sq._surveyPending = true;
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
      // COMMAND T2 (mk0.84): THE PROPOSED LINE. The second tap of a
      // two-point order proposes; nothing walks until the owner of the tap
      // accepts. Ghost pieces skip exactly the cells laying would skip
      // (scrap aside — that is walk-time), so the preview never lies.
      const LINE_END_R = 2.5;   // m — a tap this close to an endpoint disc picks it up
      const refreshLinePreview = () => {
        const lp = S.linePending;
        if (!lp) { R.overlay.setLinePreview(false); return; }
        const pieces = linePieces(grid, field, T, lp.kind, lp.a, lp.b);
        lp.count = pieces.length;
        const fpPrev = S._market ? fieldPrices(S._market.counts, WALL_FIELD_COST, SANDBAG_FIELD_COST) : { wall: WALL_FIELD_COST, bag: SANDBAG_FIELD_COST };
        const mpPrev = S._minePrices || { mine: MINE_COST, wire: WIRE_COST }; // P7 T10
        lp.cost = lp.kind === "walls" ? pieces.length * fpPrev.wall
                : lp.kind === "bags" ? pieces.length * fpPrev.bag
                : lp.kind === "mines" ? pieces.length * mpPrev.mine
                : lp.kind === "wires" ? pieces.length * mpPrev.wire : 0;
        R.overlay.setLinePreview(true, {
          a: { x: lp.a.x, z: lp.a.z, y: field.heightAt(lp.a.x, lp.a.z) },
          b: { x: lp.b.x, z: lp.b.z, y: field.heightAt(lp.b.x, lp.b.z) },
          pieces,
          color: lp.kind === "walls" ? 0x9fdcff : lp.kind === "patrol" ? 0x7fd7ff : 0xffd27a,
        });
      };
      const acceptLine = () => {
        const lp = S.linePending;
        if (!lp) return;
        if (!pendingArmed(lp, world.t)) { toast("HOLD — ARMING"); return; }
        if (lp.veh != null) {
          const v = world.byId.get(lp.veh);
          S.linePending = null;
          R.overlay.setLinePreview(false);
          if (v && v.alive) {
            v._patA = { x: lp.a.x, z: lp.a.z }; v._patB = { x: lp.b.x, z: lp.b.z };
            v.order = "patrol"; v.dest = { x: lp.a.x, z: lp.a.z }; v._route = null; v._routeDest = null;
          }
          S.selVehId = null; S.vehOrderMode = null; S.buildPt0 = null;
          return;
        }
        const sq = S.squads.find((q) => q.id === lp.sq);
        S.linePending = null;
        R.overlay.setLinePreview(false);
        if (sq) {
          if (lp.kind === "patrol") {
            // COMMAND T3 (mk0.85): accept arms the loop — the near end (A)
            // becomes the first destination, and stepSquad's turnaround
            // branch carries the squad back and forth forever from here.
            sq._patA = { x: lp.a.x, z: lp.a.z };
            sq._patB = { x: lp.b.x, z: lp.b.z };
            sq.order = "patrol";
            sq.dest = { x: lp.a.x, z: lp.a.z };   // walk to the near end first
            sq._legTarget = null; sq._pauseT = 0; sq._cohesionHoldT = 0; sq._build = null;
          }
          else startBuildLine(grid, sq, lp.kind, lp.a, lp.b, toast);
        }
        S.selSquadId = null; S.orderMode = null; S.buildPt0 = null;
      };
      const rejectLine = () => {
        S.linePending = null;
        R.overlay.setLinePreview(false);
        S.selSquadId = null; S.orderMode = null; S.buildPt0 = null;
        S.selVehId = null; S.vehOrderMode = null;
      };
      S.acceptLine = acceptLine; S.rejectLine = rejectLine;
      // The driver, once per sim tick per squad carrying a job.
      const layCtx = { stampBag, recomputeFlow, objG, setMines: (m) => R.setMines(m) };
      S.stepBuildLine = (sq) => stepBuildLine(world, grid, field, T, S, sq, layCtx, toast);
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
        // T3: open water takes no orders — the river is ground for nobody.
        if (streamAt(d.x, d.z)) { toast("OPEN WATER — find the crossing"); return true; }
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
          // COMMAND T2 (mk0.84): the second tap PROPOSES — S.linePending goes
          // up, the squad stays selected, and nothing walks until acceptLine.
          S.linePending = { kind: om === "build_walls" ? "walls" : "bags", sq: osq.id,
            a: { x: S.buildPt0.x, z: S.buildPt0.z }, b: { x: d.x, z: d.z },
            moving: null, armedAt: world.t + PENDING_ARM_S };
          S.buildPt0 = null; S.orderMode = null;
          refreshLinePreview();
          return true;
        }
        // P7 T10: MINES and WIRES — the identical two-tap shape build_bags/
        // build_walls use, sapper-gated (the type check mirrors the
        // engineer build gate above).
        if (om === "build_mines" || om === "build_wires") {
          if (!osq || osq.type !== "sappers") { S.orderMode = null; S.buildPt0 = null; S.selSquadId = null; return true; }
          if (!S.buildPt0) { S.buildPt0 = { x: d.x, z: d.z }; toast("LINE START — TAP THE FAR END"); return true; }
          S.linePending = { kind: om === "build_mines" ? "mines" : "wires", sq: osq.id,
            a: { x: S.buildPt0.x, z: S.buildPt0.z }, b: { x: d.x, z: d.z },
            moving: null, armedAt: world.t + PENDING_ARM_S };
          S.buildPt0 = null; S.orderMode = null;
          refreshLinePreview();
          return true;
        }
        if (om === "patrol") {
          // COMMAND T3 (mk0.85): same shape as the build branch above, kind
          // "patrol", no engineer guard — every squad type the pie offers
          // this wedge to (not engineers, not sappers) rides it.
          if (!osq) { S.orderMode = null; S.buildPt0 = null; S.selSquadId = null; return true; }
          if (!S.buildPt0) { S.buildPt0 = { x: d.x, z: d.z }; toast("PATROL START — TAP THE FAR END"); return true; }
          S.linePending = { kind: "patrol", sq: osq.id,
            a: { x: S.buildPt0.x, z: S.buildPt0.z }, b: { x: d.x, z: d.z },
            moving: null, armedAt: world.t + PENDING_ARM_S };
          S.buildPt0 = null; S.orderMode = null;
          refreshLinePreview();
          return true;
        }
        return false;
      };
      // P7 T2: the Bison's own ground taps — mirrors consumeOrderTap's
      // shape. ESCORT catches a squad tap here (before squad selection would
      // steal it — tapAt's order matters).
      const consumeVehOrderTap = (p) => {
        const om = S.vehOrderMode;
        if (!om) return false;
        const v = selectedVehicle();
        if (!v) { S.vehOrderMode = null; S.selVehId = null; S.buildPt0 = null; return true; }
        if (om === "escort") {
          const sq = squadAtPoint(p);
          if (!sq) { toast("TAP A SQUAD TO ESCORT"); return true; }
          v.order = "escort"; v.escortId = sq.id; v.dest = null; v.goal = null; v._route = null; v._routeDest = null;
          S.vehOrderMode = null; S.selVehId = null;
          return true;
        }
        // P7 T4: LOAD — tap a squad, it walks to the ramp and boards.
        if (om === "load") {
          if (v.vtype !== "apc") { S.vehOrderMode = null; return true; }
          const sq = squadAtPoint(p);
          if (!sq) { toast("TAP A SQUAD TO LOAD"); return true; }
          if (S.possess && S.possess.kind === "squad" && S.possess.id === sq.id) { toast("RELEASE THEM FIRST"); return true; }
          let live = 0;
          for (const id of sq.memberIds) { const u = world.byId.get(id); if (u && u.alive) live++; }
          const free = APC.seats - apcSeated(world, S.squads, v.apcSeq);
          if (live > free) { toast("NO ROOM — " + free + (free === 1 ? " SEAT" : " SEATS")); return true; }
          sq._boarding = v.apcSeq; sq._build = null;
          S.vehOrderMode = null; S.selVehId = null;
          return true;
        }
        const d = clampToRim(p.x, p.z);
        if (streamAt(d.x, d.z)) { toast("OPEN WATER — find the crossing"); return true; }
        if (om === "move") {
          v.order = "move"; v.dest = { x: d.x, z: d.z }; v._route = null; v._routeDest = null;
          S.vehOrderMode = null; S.selVehId = null;
          return true;
        }
        if (om === "patrol") {   // the two-point confirm law, verbatim from squads
          if (!S.buildPt0) { S.buildPt0 = { x: d.x, z: d.z }; toast("PATROL START — TAP THE FAR END"); return true; }
          S.linePending = { kind: "patrol", veh: v.id, a: { x: S.buildPt0.x, z: S.buildPt0.z }, b: { x: d.x, z: d.z }, moving: null, armedAt: world.t + PENDING_ARM_S };
          S.buildPt0 = null; S.vehOrderMode = null;
          refreshLinePreview();
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
        cell.wallId = null; cell.blocked = false; cell.bTeam = 0;
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
        for (const c of grid.cells) if (c.wallId === b.id) { c.wallId = null; c.blocked = false; c.bTeam = 0; }
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
        // POSSESSION T4 (mk0.93): while possessed, a ground tap is consumed
        // and does NOTHING — the reticle is stick-and-mouse only now (the
        // right stick steers it, the mouse positions it on desktop); a
        // thumb tap can no longer yank the aim. The old tap-aim field is gone.
        if (S.possess) return;
        // COMMAND T2 (mk0.84): while a proposed line is up, ground taps belong
        // to it — tap an endpoint disc to pick it up, tap ground to re-place a
        // picked-up endpoint. Accept/reject (the buttons) are the only exits;
        // a stray tap can never fire the order or steal the selection.
        if (S.linePending) {
          const lp = S.linePending;
          if (lp.moving) {
            const m = clampToRim(p.x, p.z);
            lp[lp.moving] = { x: m.x, z: m.z };
            lp.moving = null;
            lp.armedAt = world.t + PENDING_ARM_S;
            refreshLinePreview();
          } else if (Math.hypot(p.x - lp.a.x, p.z - lp.a.z) < LINE_END_R) { lp.moving = "a"; toast("TAP THE NEW START"); }
          else if (Math.hypot(p.x - lp.b.x, p.z - lp.b.z) < LINE_END_R) { lp.moving = "b"; toast("TAP THE NEW END"); }
          return;
        }
        // Squad order flow: an armed ATTACK/MOVE consumes this ground tap as the
        // destination (flag marker renders at dest until arrival); an armed
        // BUILD consumes TWO — the line's start, then its far end (mk0.60).
        if (consumeOrderTap(p)) return;
        if (consumeVehOrderTap(p)) return;
        // Tap on a squad member selects his squad; tap elsewhere while one
        // is selected deselects (and consumes the tap — no accidental build).
        const tappedSquad = squadAtPoint(p);
        // COMMAND 1b (mk0.82): tapping a squad (selecting it, or re-tapping
        // the one already selected) opens/reopens the pie.
        if (tappedSquad) { S.selSquadId = tappedSquad.id; S.selArmedAt = world.t + PENDING_ARM_S; S.orderMode = null; S.buildPt0 = null; S.inspectId = null; S.pieOpen = true; return; }
        if (S.selSquadId != null) { S.selSquadId = null; S.orderMode = null; S.buildPt0 = null; S.pieOpen = false; return; }
        // P7 T2: tap on the Bison selects it; tap elsewhere while it's
        // selected deselects (mirrors the squad pair immediately above).
        const tappedVeh = vehicleAtPoint(p);
        if (tappedVeh) { S.selVehId = tappedVeh.id; S.selArmedAt = world.t + PENDING_ARM_S; S.selSquadId = null; S.orderMode = null; S.vehOrderMode = null; S.buildPt0 = null; S.inspectId = null; S.pieOpen = true; return; }
        if (S.selVehId != null) { S.selVehId = null; S.vehOrderMode = null; S.buildPt0 = null; S.pieOpen = false; return; }
        const g = grid.worldToGrid(p.x, p.z);
        if (!grid.inBounds(g.gx, g.gz)) { S.inspectId = null; return; }
        const cell2 = grid.cells[grid.idx(g.gx, g.gz)];
        if (S.sellMode) { S.inspectId = null; sellAt(g.gx, g.gz); return; }
        if (cell2.wallId && world.byId.has(cell2.wallId)) { S.inspectId = cell2.wallId; S.pieOpen = true; return; }
        S.inspectId = null;
        if (SQUAD_MODE[S.mode]) {
          const v = canPlaceInfantryAt(g.gx, g.gz, priceNow(S.mode, SQUAD_SPECS[SQUAD_MODE[S.mode]].cost));
          if (!v.ok) { toast(v.msg); return; }
          startPendingSquad(g.gx, g.gz, S.mode, v.wp);
          return;
        }
        if (S.mode && TOWER_SPECS[S.mode]) {
          const v = canBuildAt(g.gx, g.gz, S.mode);
          if (!v.ok) { toast(v.msg); return; }
          startPending(g.gx, g.gz, S.mode, v);
        }
      };

      const pointers = new Map();
      let pinchD0 = 0, pinchZ0 = 1, dragTotal = 0, downPt = null;
      const onPointerDown = (e) => {
        A.ensure();
        // DESKTOP FIRE (P6 T12, mk1.21, owner's playtest): while possessed,
        // the left mouse button IS the trigger — held, it volleys like the
        // phone FIRE button; the click never becomes a pan or a tap. The
        // possession release paths already clear fireHeld.
        // DESKTOP COAX (P7 T2, owner's ruling): while possessing the Bison,
        // the right mouse button IS the coax trigger — held, like FIRE/MG.
        // Checked before the left-button main-gun branch so a right-click
        // never falls through to it.
        if (S.possess && S.possess.kind === "vehicle" && e.pointerType === "mouse" && e.button === 2) {
          // P7 T4: the APC has no coax-and-main-gun split — one gun, FIRE
          // alone. A right-click on the APC does nothing (consumed, not
          // captured — never falls through to a pan/tap).
          const pv0 = world.byId.get(S.possess.id);
          if (!pv0 || pv0.vtype !== "apc") {
            canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
            S.mgHeld = true;
          }
          return;
        }
        if (S.possess && e.pointerType === "mouse" && e.button === 0) {
          canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
          S.fireHeld = true;
          return;
        }
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
        if (e.pointerType === "mouse" && e.button === 2 && S.mgHeld) { S.mgHeld = false; pointers.delete(e.pointerId); return; }
        if (S.fireHeld && e.pointerType === "mouse") { S.fireHeld = false; pointers.delete(e.pointerId); return; }
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
      // P7 T2: the right mouse button is the coax trigger while possessing
      // the Bison — the browser's own context menu must never steal it.
      const onCtxMenu = (e) => e.preventDefault();
      canvas.addEventListener("pointerdown", onPointerDown);
      canvas.addEventListener("pointermove", onPointerMove);
      canvas.addEventListener("pointerup", onPointerUp);
      canvas.addEventListener("pointercancel", onPointerUp);
      canvas.addEventListener("contextmenu", onCtxMenu);
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
      const bellCtx = { cue, toast, townUV, buildSnapshot, nextApcSeq, saveFront: () => saveFront() };
      const ringBell = () => ringBellOut(world, grid, field, T, S, bellCtx);
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
        // P7 T17 (owner): THE PICK ARMS THE BAR — the next ground tap places
        // what the convoy just delivered. Hero keys stay two-tap buys.
        if (!key.startsWith("hero_")) setMode(key);
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
        R.setDressing({ rocks: rocksLive, ponds: PONDS, streams: streamRibs });
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
      window.__DEPOTTOWN__ = () => TOWN.map((t) => ({ id: t.id, x: +t.x.toFixed(2), z: +t.z.toFixed(2), nx: t.nx, nz: t.nz, ny: t.ny, slab: !!t.slab, cols: !!t.cols }));
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
        // COMMAND T2 (mk0.84): the debug path auto-accepts what a human tap
        // would still have to confirm — staging keeps driving the real order
        // path end to end without a screen to tap the ✓ on.
        // AUDIT FIX (mk0.85): acceptLine gates on pendingArmed, and the
        // pending was created THIS tick with armedAt = world.t + PENDING_ARM_S
        // — the old auto-accept always missed its own arming window and
        // silently no-opped. The arming guard protects a human's trailing
        // tap; the staging path has no trailing tap, so backdate the arm,
        // then accept.
        if (S.linePending) { S.linePending.armedAt = world.t; S.acceptLine(); } // staging has no trailing tap — backdate the arm, then accept
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
      window.__DEPOTLOAD__ = () => {
        // the load ramp's gauge (P6 close): live men and the awake/asleep
        // stone split, counted fresh on each call — read-only, no cadence.
        let men = 0, awake = 0, asleep = 0;
        for (const b of world.bodies) {
          if (!b.alive) continue;
          if (b.kind === "unit") men++;
          else if (b.kind === "chunk") { if (b.sleeping) asleep++; else awake++; }
        }
        return { men, awake, asleep };
      };
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
          // POSSESSION (P4 T1, mk0.90): while possessed, WASD drives the
          // squad, NOT the camera — the pan block is gated off entirely.
          if (!S.possess) {
            if (S.keys.w || S.keys.arrowup) { S.focus.x += ux * pan; S.focus.z += uz * pan; }
            if (S.keys.s || S.keys.arrowdown) { S.focus.x -= ux * pan; S.focus.z -= uz * pan; }
            if (S.keys.a || S.keys.arrowleft) { S.focus.x -= rx * pan * 0.8; S.focus.z -= rz * pan * 0.8; }
            if (S.keys.d || S.keys.arrowright) { S.focus.x += rx * pan * 0.8; S.focus.z += rz * pan * 0.8; }
            S.focus.x = Math.max(-EXT.x, Math.min(EXT.x, S.focus.x));
            S.focus.z = Math.max(-EXT.z, Math.min(EXT.z, S.focus.z));
            S.focus.y = field.heightAt(S.focus.x, S.focus.z);
          }
          if (S.possess && S.possess.kind === "squad") {
            // The stick, camera-relative (the sandbox's own twin-stick math,
            // ContractSandbox.jsx :508-513): joystick wins if it's live,
            // WASD/arrows otherwise. The camera locks to the squad — no pan,
            // no drift; a touch drag one finger off the stick still nudges
            // it (pointermove below), but it snaps back here next frame.
            const cb2 = R.camBasis;
            const fl = Math.hypot(cb2.up.x, cb2.up.z) || 1, rl2 = Math.hypot(cb2.right.x, cb2.right.z) || 1;
            let st = 0, ss = 0;
            if (S.joy && S.joy.active) { st = S.joy.t; ss = S.joy.s; }
            else {
              st = (S.keys.w || S.keys.arrowup ? 1 : 0) + (S.keys.s || S.keys.arrowdown ? -1 : 0);
              ss = (S.keys.d || S.keys.arrowright ? 1 : 0) + (S.keys.a || S.keys.arrowleft ? -1 : 0);
            }
            S.possessInput = {
              vx: (cb2.right.x / rl2) * ss + (cb2.up.x / fl) * st,
              vz: (cb2.right.z / rl2) * ss + (cb2.up.z / fl) * st,
            };
            const psq = S.squads.find((q) => q.id === S.possess.id);
            if (psq) { S.focus.x = psq.anchor.x; S.focus.z = psq.anchor.z; S.focus.y = field.heightAt(S.focus.x, S.focus.z); }
          } else if (S.possess && S.possess.kind === "tower") {
            // POSSESSION (P4 T3, mk0.92): towers don't walk — no stick, no
            // possessInput. Camera locks to the tower exactly as it does to
            // a possessed squad.
            const ptw = world.byId.get(S.possess.id);
            if (ptw) { S.focus.x = ptw.pos.x; S.focus.z = ptw.pos.z; S.focus.y = field.heightAt(S.focus.x, S.focus.z); }
          } else if (S.possess && S.possess.kind === "vehicle") {
            const pv = world.byId.get(S.possess.id);
            if (pv) {
              S.focus.x = pv.pos.x; S.focus.z = pv.pos.z; S.focus.y = field.heightAt(S.focus.x, S.focus.z);
              const cbv = R.camBasis;
              const flv = Math.hypot(cbv.up.x, cbv.up.z) || 1, rlv = Math.hypot(cbv.right.x, cbv.right.z) || 1;
              let st = 0, ss = 0;
              if (S.joy && S.joy.active) { st = S.joy.t; ss = S.joy.s; }
              else {
                st = (S.keys.w || S.keys.arrowup ? 1 : 0) + (S.keys.s || S.keys.arrowdown ? -1 : 0);
                ss = (S.keys.d || S.keys.arrowright ? 1 : 0) + (S.keys.a || S.keys.arrowleft ? -1 : 0);
              }
              const wxv = (cbv.right.x / rlv) * ss + (cbv.up.x / flv) * st;
              const wzv = (cbv.right.z / rlv) * ss + (cbv.up.z / flv) * st;
              const magv = Math.min(1, Math.hypot(ss, st));
              pv.depotDrive = "manual";
              if (!pv.ctl) pv.ctl = { throttle: 0, steer: 0, brake: false };
              if (magv > 0.03) {
                const desired = Math.atan2(wxv, wzv);
                let errY = desired - Math.atan2(pv.R[6], pv.R[8]);
                while (errY > Math.PI) errY -= 2 * Math.PI;
                while (errY < -Math.PI) errY += 2 * Math.PI;
                pv.ctl.steer = Math.max(-1, Math.min(1, errY * 1.8));
                pv.ctl.throttle = magv * Math.max(0, Math.cos(errY));
                pv.ctl.brake = false;
              } else { pv.ctl.throttle = 0; pv.ctl.steer = 0; pv.ctl.brake = false; }
            }
          }
          if (S.possess) {
            // POSSESSION T4/T5 (mk0.93/0.94): THE CARRIED RETICLE. The right
            // stick wins if it's live (steerReticle — deflection is
            // velocity, the OFFSET holds on release, so walking carries the
            // reticle with the unit), same precedence the left stick uses
            // (S.joy.active above); otherwise the mouse sets the offset, the
            // sandbox's own convention (ContractSandbox.jsx :413-419/:530) —
            // positional, not velocity. Either way the offset is bounded to
            // the possessed unit's live sight circle every frame
            // (reclampReticle); its ground can go dark and it falls home to
            // the unit's cell. The world point the guns and the red ring
            // read is derived last.
            const rc = possessCenter();
            const rR = possessSightR();
            if (rc && S.reticleOff) {
              if (S.joyR && S.joyR.active) {
                const cb3 = R.camBasis;
                const fl3 = Math.hypot(cb3.up.x, cb3.up.z) || 1, rl3 = Math.hypot(cb3.right.x, cb3.right.z) || 1;
                const rv = {
                  vx: (cb3.right.x / rl3) * S.joyR.s + (cb3.up.x / fl3) * S.joyR.t,
                  vz: (cb3.right.z / rl3) * S.joyR.s + (cb3.up.z / fl3) * S.joyR.t,
                };
                S.reticleOff = steerReticle(T.sight, 1, rc, rR, S.reticleOff, rv.vx, rv.vz, dt, invW);
              } else if (!isTouch && S.pointer) {
                const gp = groundPoint(S.pointer.x, S.pointer.y);
                if (gp) S.reticleOff = { dx: gp.x - rc.x, dz: gp.z - rc.z };
              }
              S.reticleOff = reclampReticle(T.sight, 1, rc, rR, S.reticleOff, invW);
              S.reticle = { x: rc.x + S.reticleOff.dx, z: rc.z + S.reticleOff.dz };
              // P7 T2: keep the turret honest while possessed — the hull's
              // own aim yaw follows the live reticle every frame, not just
              // on a shot.
              if (S.possess.kind === "vehicle" && S.reticle) {
                const pv2 = world.byId.get(S.possess.id);
                if (pv2) pv2._aimYaw = Math.atan2(S.reticle.x - pv2.pos.x, S.reticle.z - pv2.pos.z);
              }
            }
          }
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
            S.resources += 1 * sdt; // mk1.13 (owner): income is the clock — 1 scrap/second, both sides
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
          // P7 T10: TRIGGERS — a 4Hz game-layer step, beside the territory
          // accumulator (NOT per sim tick). Cheap: setMines only rewrites the
          // two instanced pools when a device actually fired this tick.
          if (terrGuard > 0) { stepMines(world, S.mines); R.setMines(S.mines); }
          // P7 T17: dead bags release their ground — same cadence as the
          // other derived overlays; bagId cells are few.
          if (terrGuard > 0) for (const c of grid.cells) {
            if (c.bagId == null) continue;
            const b = world.byId.get(c.bagId);
            if (!b || !b.alive) { c.bag = null; c.bagId = null; }
          }
          // P7 T13 (owner): THE GREEN THREADS — every friendly ordered path,
          // green on the ground, refreshed with the other derived overlays.
          if (terrGuard > 0) {
            const paths = [];
            for (const sq of S.squads) {
              if (!sq.dest || sq.ridingIn != null) continue;
              if (sq.order !== "move" && sq.order !== "attack" && sq.order !== "build" && sq.order !== "patrol") continue;
              paths.push({ pts: [{ x: sq.anchor.x, z: sq.anchor.z }, ...(sq._route || []), { x: sq.dest.x, z: sq.dest.z }] });
            }
            for (const b of world.bodies) {
              if (b.kind !== "vehicle" || !b.alive || b.team !== 1 || !b.dest) continue;
              if (b.order !== "move" && b.order !== "patrol" && b.order !== "escort") continue;
              paths.push({ pts: [{ x: b.pos.x, z: b.pos.z }, ...(b._route || []), { x: b.dest.x, z: b.dest.z }] });
            }
            R.overlay.setOrderPaths(paths);
          }
          world.events.length = 0;
          const pSim0 = perf ? performance.now() : 0; // stopwatch: sim bracket opens
          // P6 T10 (mk1.19): the pool rebuild runs ONCE PER FRAME, not once
          // per sub-step (Task 5's Amendment 1 finding — a catch-up frame
          // running six sub-steps paid six rebuilds in exactly the frames
          // that were already worst). Staleness widens from one tick to one
          // frame; still deterministic. THE IDLE GATE (Task 5 Amendment 1
          // Step A1-1): the pools exist only while the war is hot — squads,
          // towers, or enemies afield. Cold frames null the lists and every
          // consumer full-scans exactly as before the pools existed
          // (pools-vs-full-scan is proven identical, so the gate can be
          // cheap and even frame-paced without touching determinism of
          // outcomes). _hot is stashed by the hud census pass below.
          if (S.acc >= STEP) {
            if (S._hot) rebuildBodyLists(world, world._L || makeBodyLists());
            else world._L = null;
          }
          let guard = 0;
          while (S.acc >= STEP && guard++ < 6) {
            S.acc -= STEP;
            stepDepot(world, grid, onStructureLost, town, onRuin, T, S.discipline, S);
            // POSSESSION (P4 T2, mk0.91): THE TRIGGER. At most one volley
            // attempt per sim tick — cooldowns (possessedVolley's own
            // u.fireCd gate) do the real limiting, not this flag.
            if (S.fireHeld && S.possess && S.possess.kind === "squad" && S.reticle) {
              const psq = S.squads.find((q) => q.id === S.possess.id);
              if (psq) possessedVolley(world, psq, S.reticle, T, invW);
            }
            // POSSESSION (P4 T3, mk0.92): a possessed tower's trigger — same
            // one-attempt-per-tick flag, real spec, real cooldown, through
            // possessedTowerFire. Discipline note: friendlyFouls is NOT
            // consulted while possessed — your trigger, your responsibility.
            if (S.fireHeld && S.possess && S.possess.kind === "tower" && S.reticle) {
              const ptw = world.byId.get(S.possess.id);
              if (ptw) possessedTowerFire(world, ptw, S.reticle, T, invW);
            }
            // POSSESSION (P7 T2): the Bison's two triggers — same
            // one-attempt-per-tick flags, real cooldowns, through
            // possessedArmorFire/possessedArmorMg.
            if (S.possess && S.possess.kind === "vehicle" && S.reticle) {
              const pv = world.byId.get(S.possess.id);
              if (pv) {
                // P7 T4: the APC's only gun is the coax — FIRE streams it (no
                // main gun to fire), and there is no separate MG trigger.
                if (S.fireHeld) { if (pv.vtype === "apc") possessedArmorMg(world, pv, S.reticle, T, invW); else possessedArmorFire(world, pv, S.reticle, T, invW); }
                if (S.mgHeld && pv.vtype !== "apc") possessedArmorMg(world, pv, S.reticle, T, invW);
              }
            }
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
          // THE LIVING MARKET (mk1.13): its own 1Hz accumulator, sdt-gated
          // like the census above (a paused game freezes prices) — kept
          // separate from stepDepotCensus's accumulator (different
          // consumers) per the brief.
          S._marketAcc += sdt;
          if (S._marketAcc >= 1) {
            S._marketAcc -= 1;
            S._market = computePrices(marketCounts(world, S.squads, S.mines));
            S._minePrices = minePrices(S._market.counts, priced); // P7 T10: beside _market, same cadence
          }
          R.consume(evs);
          A.setListener(S.focus.x, S.focus.z, 46 / Math.max(0.6, S.zoom));
          A.consume(evs);
          A.tick(world, dt);
          // POSSESSION T5 (mk0.94): the reticle draws through its own red
          // ring (the owner's ruling — a red circle, not the build ghost's
          // square), and the build hover never paints while possessed.
          // Squad and tower share the ring.
          R.overlay.setReticle(!!(S.possess && S.reticle),
            S.reticle ? S.reticle.x : 0, S.reticle ? S.reticle.z : 0,
            S.reticle ? field.heightAt(S.reticle.x, S.reticle.z) : 0);
          if (!S.possess && S.hover) {
            R.overlay.setHover(true, S.hover.x, S.hover.z, field.heightAt(S.hover.x, S.hover.z), S.hover.range, S.hover.valid, GRID_CS);
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
            // COMMAND T2 (mk0.84): the proposed line's END point only — the
            // buttons live there. Same screen-space recipe as pendingScreen,
            // but going off-screen HIDES the buttons WITHOUT cancelling the
            // pending (the line is big; panning around it is normal work).
            if (S.linePending && R.project) {
              const lp = S.linePending;
              const rect4 = canvas.getBoundingClientRect();
              const nd4 = R.project(lp.b.x, field.heightAt(lp.b.x, lp.b.z) + 1.2, lp.b.z);
              S.lineScreen = nd4 ? { x: rect4.left + (nd4.x * 0.5 + 0.5) * rect4.width, y: rect4.top + (-nd4.y * 0.5 + 0.5) * rect4.height } : null;
            } else S.lineScreen = null;
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
            // P7 T2: the Bison's pie anchor — same screen-space recipe,
            // projected off the hull top (the towerScreen recipe).
            if (S.selVehId != null && R.project) {
              const vb = world.byId.get(S.selVehId);
              if (vb && vb.alive) {
                const rect5 = canvas.getBoundingClientRect();
                const nd5 = R.project(vb.pos.x, vb.pos.y + vb.hy + 1.4, vb.pos.z);
                S.vehScreen = nd5 ? { x: rect5.left + (nd5.x * 0.5 + 0.5) * rect5.width, y: rect5.top + (-nd5.y * 0.5 + 0.5) * rect5.height } : null;
              } else S.vehScreen = null;
            } else S.vehScreen = null;
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
            // P6 T10 / Task 5 Amendment 1 (mk1.19): the idle gate's flag —
            // the war is hot (pools worth building) while any enemy or
            // tower stands, or any squad is fielded. Stashed here (already
            // a full body walk) rather than adding a second one.
            S._hot = en > 0 || nt > 0 || S.squads.length > 0;
            const nowS = performance.now() / 1000;
            S.toasts = S.toasts.filter((t) => nowS - t.t < 2.2);
            setHud({
              // The bell being counted down TO — S.bell is the one that last
              // rang, so the top bar names the next one.
              fps: S.fps, bell: S.bell + 1, bellT: S.bellT, enemies: en,
              stones: R.chunkStats ? `${R.chunkStats().drawn}/${R.chunkStats().cap}` : "",
              resources: Math.floor(S.resources), walls: nw, towers: nt, kills: S.kills,
              lastDispatch: S.lastDispatch,
              // THE LIVING MARKET (mk1.13): the bar and the manifest read
              // prices off this same cache, out to the render each hud tick.
              prices: S._market ? { ...S._market.player } : null,
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
              muted: A.muted, fogOn: S.fogOn, windOn: S.windOn, discipline: S.discipline, seed: MAP_SEED,
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
                  // P7 T10: the sapper build gate — mirrors the engineer flag above.
                  sapper: sq.type === "sappers",
                  building: S.orderMode === "build_bags" ? "bags" : S.orderMode === "build_walls" ? "walls"
                          : S.orderMode === "build_mines" ? "mines" : S.orderMode === "build_wires" ? "wires" : null,
                  buildStart: !!S.buildPt0,
                  // COMMAND T3 (mk0.85): PATROL rides every squad type
                  // except engineers and sappers (tools, not shooters — the
                  // wedge would order them to walk a line they never fight
                  // on).
                  patrolOk: sq.type !== "engineers" && sq.type !== "sappers",
                  aimingPatrol: S.orderMode === "patrol",
                  // COMMAND T4 (mk0.86): STRUCTURES rides every armed squad
                  // type (an INFANTRY_ARMS row) — not engineers, not sappers,
                  // same population PATROL offers the wedge to. structFirst
                  // is the wedge's lit state.
                  structOk: !!INFANTRY_ARMS[sq.type],
                  structFirst: !!sq.prefStruct,
                  // COMMAND T2 (mk0.84): the squad stays selected while its
                  // line is up for confirmation — the center chip says so.
                  linePending: !!S.linePending };
              })(),
              squadFlag: S.flagScreen ? { x: S.flagScreen.x, y: S.flagScreen.y } : null,
              // POSSESSION (P4 T1/T3, mk0.90/mk0.92): the RELEASE button/
              // POSSESSED chip key off this — null the instant the squad or
              // tower is gone. The stick (data-joy) additionally checks
              // kind !== "tower" — towers don't walk.
              possessed: !S.possess ? null
                : S.possess.kind === "squad" ? (() => { const psq = S.squads.find((q) => q.id === S.possess.id); return psq ? { kind: "squad", label: SQUAD_SPECS[psq.type].label } : null; })()
                : S.possess.kind === "vehicle" ? (() => { const pv = world.byId.get(S.possess.id); return pv && pv.alive ? { kind: "vehicle", vtype: pv.vtype, label: pv.vtype === "apc" ? "APC" : "BISON" } : null; })()
                : (() => { const ptw = world.byId.get(S.possess.id); return ptw && ptw.kind === "tower" ? { kind: "tower", label: TOWER_SPECS[ptw.towerType].label } : null; })(),
              // P7 T2: the Bison's own pie, projected off the hull top (the
              // towerScreen recipe) — null unless a vehicle is selected.
              vehRadial: (() => {
                if (S.selVehId == null || !S.vehScreen) return null;
                const v = world.byId.get(S.selVehId);
                if (!v || !v.alive) return null;
                return { id: v.id, x: S.vehScreen.x, y: S.vehScreen.y, order: v.order || "defend", tracks: v.tracks || "careful",
                  vtype: v.vtype, seatsFree: v.vtype === "apc" ? APC.seats - apcSeated(world, S.squads, v.apcSeq) : 0,
                  riders: v.vtype === "apc" ? apcSeated(world, S.squads, v.apcSeq) : 0, aimingLoad: S.vehOrderMode === "load",
                  aimingMove: S.vehOrderMode === "move", aimingPatrol: S.vehOrderMode === "patrol", aimingEscort: S.vehOrderMode === "escort",
                  patrolStart: !!S.buildPt0, armed: world.t >= S.selArmedAt, showPie: !!S.pieOpen, linePending: !!S.linePending };
              })(),
              // COMMAND T2 (mk0.84): the proposed line's accept/reject pair —
              // survives the end point going off-screen (buttons just hide).
              linePending: S.linePending && S.lineScreen ? {
                x: S.lineScreen.x, y: S.lineScreen.y,
                cost: S.linePending.cost, count: S.linePending.count,
                armed: pendingArmed(S.linePending, world.t), kind: S.linePending.kind,
              } : null,
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
                  // POSSESSION (P4 T3, mk0.92): TAKE CONTROL — gun towers
                  // only. Frost's fireRate is 0 (no gun to man).
                  canPossess: ispec.fireRate > 0,
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
          // HOTFIX mk1.37: the overlay names the throwing SITE — "non-finite" alone left the fault anonymous on a phone
          const top = err && err.stack ? String(err.stack).split("\n").slice(0, 3).join(" ⏎ ") : "";
          setFatal(String(err && err.message ? err.message : err) + (top ? " — " + top : ""));
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
        canvas.removeEventListener("contextmenu", onCtxMenu);
        canvas.removeEventListener("wheel", onWheel);
        canvas.removeEventListener("touchstart", blockTouch);
        window.removeEventListener("keydown", kd);
        window.removeEventListener("keyup", ku);
        for (const k of ["__DEPOT__", "__DEPOTBELL__", "__DEPOTBUILD__", "__DEPOTSPAWN__", "__DEPOTSTART__", "__DEPOTTREES__", "__DEPOTMG__", "__DEPOTSHELL__", "__DEPOTTHIN__", "__DEPOTEND__", "__DEPOTFOCUS__", "__DEPOTGETFOCUS__", "__DEPOTSETT__", "__DEPOTFLAGS__", "__DEPOTTOWN__", "__DEPOTHOLD__", "__DEPOTFINDBUILDABLE__", "__DEPOTFINDRISE__", "__DEPOTFINDNEARROCK__", "__DEPOTFOGDBG__", "__DEPOTFOGAT__", "__DEPOTENEMYPOS__", "__DEPOTSQUADS__", "__DEPOTSANDBAGS__", "__DEPOTGROUNDAT__", "__DEPOTSCREENAT__", "__DEPOTPENDING__", "__DEPOTMANIFEST__", "__DEPOTPICK__", "__DEPOTSAVE__", "__DEPOTGRIDAT__", "__DEPOTSQUAD__", "__DEPOTORDER__", "__DEPOTCELL__"]) delete window[k];
        A.dispose();
        if (R) R.dispose();
        stateRef.current = null;
      };
    } catch (err) {
      console.error("COLDSNAP DEPOT boot failed", err);
      // HOTFIX mk1.37: the overlay names the throwing SITE — "non-finite" alone left the fault anonymous on a phone
      const top = err && err.stack ? String(err.stack).split("\n").slice(0, 3).join(" ⏎ ") : "";
      setFatal(String(err && err.message ? err.message : err) + (top ? " — " + top : ""));
      if (R) R.dispose();
    }
  }, [isTouch, runId]);

  const setMode = (m) => {
    const S = stateRef.current; if (!S) return;
    if (S.gameOver || S.victory) return;   // mk0.29: the war is over — nothing left to build
    // P7 T9: hero keys are a two-tap ARM/BUY on the bar slot itself — never
    // a build mode (no ground tap, no pending ghost). Branch before S.mode
    // is ever touched.
    if (m === "hero_bison" || m === "hero_apc") { if (S.buyHero) S.buyHero(m); return; }
    // P7 T17 (owner): TAP AGAIN TO PUT IT AWAY — the active build button is
    // a toggle; the second tap clears back to plain command.
    if (S.mode === m) {
      if (S.linePending && S.rejectLine) S.rejectLine();
      S.mode = null; S.pending = null; S.buildPt0 = null;
      setHud((h) => ({ ...h, mode: null }));
      return;
    }
    // COMMAND T2 (mk0.84): switching build-menu mode with a line still up
    // clears it through the same door ✗ uses (rejectLine also disposes the
    // renderer's preview group) — it never lingers behind the new mode.
    if (S.linePending && S.rejectLine) S.rejectLine();
    S.mode = m; S.sellMode = false; S.inspectId = null; S.pending = null; S.selSquadId = null; S.orderMode = null; S.buildPt0 = null;
    setHud((h) => ({ ...h, mode: m, sellMode: false }));
  };
  const toggleSell = () => {
    const S = stateRef.current; if (!S) return;
    if (S.linePending && S.rejectLine) S.rejectLine();
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
  const toggleWind = () => {
    const S = stateRef.current; if (!S || !S.setWind) return;
    S.setWind(!S.windOn);
    setHud((h) => ({ ...h, windOn: S.windOn }));
  };
  // FIRE FEEDBACK (mk0.96): the held state, and the LOOK of the held state,
  // set in one place — direct DOM writes (the joystick knob's discipline, no
  // React state in the hot path). A hold the browser cancels pops the button
  // dark the instant it dies, so a silent drop is visible.
  const setFireHeld = (v) => {
    const S = stateRef.current; if (S) S.fireHeld = v;
    if (fireBtnRef.current) {
      fireBtnRef.current.style.background = v ? "#ff6b5e" : "#2a1418";
      fireBtnRef.current.style.color = v ? "#1a0d0f" : "#ff6b5e";
    }
  };
  // P7 T2: the coax MG's held state — mirrors setFireHeld with its own ref.
  const setMgHeld = (v) => {
    const S = stateRef.current; if (S) S.mgHeld = v;
    if (mgBtnRef.current) {
      mgBtnRef.current.style.background = v ? "#ffd27a" : "#2a2214";
      mgBtnRef.current.style.color = v ? "#1a1608" : "#ffd27a";
    }
  };
  const sellInspected = () => { const S = stateRef.current; if (S && S.inspectId && S.sellById) S.sellById(S.inspectId); };

  // POSSESSION (P4 T1, mk0.90): the touch stick. Depot-styled port of the
  // sandbox's own joystick (ContractSandbox.jsx :365-380, :429-437) — radius
  // 56, deadzone 0.15, knob clamped to the radius and following the finger.
  // Unlike the sandbox's stick (a decorative pair with pointerEvents:none,
  // driven by a window-level proximity test) this one is its OWN real DOM
  // hit target, sitting above the canvas: a pointerdown on it never reaches
  // the canvas's pan/tap handlers at all (sibling elements, not ancestor/
  // descendant — the browser's own hit-test already settles it), and
  // setPointerCapture below pins every subsequent move/up to it too, so a
  // drag that strays off the knob still can't leak to the canvas underneath.
  const JOY_R = 56;
  const joyDz = (v) => (Math.abs(v) < 0.15 ? 0 : (v - Math.sign(v) * 0.15) / 0.85);
  const moveJoy = (e) => {
    const S = stateRef.current;
    if (!S || !S.joy || !S.joy.active) return;
    const r = e.currentTarget.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let dx = e.clientX - cx, dy = e.clientY - cy;
    const L = Math.hypot(dx, dy);
    if (L > JOY_R) { dx *= JOY_R / L; dy *= JOY_R / L; }
    if (joyKnobRef.current) { joyKnobRef.current.style.left = 70 + dx - 22 + "px"; joyKnobRef.current.style.top = 70 + dy - 22 + "px"; }
    S.joy.t = joyDz(-dy / JOY_R);
    S.joy.s = joyDz(dx / JOY_R);
  };
  const releaseJoy = () => {
    const S = stateRef.current;
    if (S) S.joy = { active: false, t: 0, s: 0 };
    if (joyKnobRef.current) { joyKnobRef.current.style.left = "48px"; joyKnobRef.current.style.top = "48px"; }
  };
  // POSSESSION T4 (mk0.93): the right stick — same math, own knob ref, own
  // live state (S.joyR), mirrored from moveJoy/releaseJoy above.
  const moveJoyR = (e) => {
    const S = stateRef.current;
    if (!S || !S.joyR || !S.joyR.active) return;
    const r = e.currentTarget.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let dx = e.clientX - cx, dy = e.clientY - cy;
    const L = Math.hypot(dx, dy);
    if (L > JOY_R) { dx *= JOY_R / L; dy *= JOY_R / L; }
    if (joyRKnobRef.current) { joyRKnobRef.current.style.left = 70 + dx - 22 + "px"; joyRKnobRef.current.style.top = 70 + dy - 22 + "px"; }
    S.joyR.t = joyDz(-dy / JOY_R);
    S.joyR.s = joyDz(dx / JOY_R);
  };
  const releaseJoyR = () => {
    const S = stateRef.current;
    if (S) S.joyR = { active: false, t: 0, s: 0 };
    if (joyRKnobRef.current) { joyRKnobRef.current.style.left = "48px"; joyRKnobRef.current.style.top = "48px"; }
  };

  // The bar shows the UNLOCKED set and nothing else (P1 Task 2): a locked
  // item does not render at all — no greyed teasers, because the manifest
  // card IS the reveal. PALETTE's own order is preserved, so an item always
  // arrives in the same slot position it will keep for the rest of the match.
  const unlocked = hud.unlocked || [];
  const palette = PALETTE.filter((p) => unlocked.indexOf(p.key) >= 0);

  return (
    <div style={P.root}>
      <canvas key={runId} ref={canvasRef} style={P.cv} />
      {/* POSSESSION (P4 T1, mk0.90) ------------------------------------- */}
      {hud.possessed && (
        <div data-possessed-chip style={{ position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)", zIndex: 6, background: "rgba(14,18,24,0.88)", border: "1px solid #7dffa8", color: "#7dffa8", borderRadius: 6, padding: "3px 12px", fontSize: 12, letterSpacing: 1, pointerEvents: "none" }}>
          POSSESSED — {hud.possessed.label}
        </div>
      )}
      {/* POSSESSION (P4 T3, mk0.92): no stick for towers — they don't walk. */}
      {isTouch && hud.possessed && hud.possessed.kind !== "tower" && (
        <div data-joy
          style={{ position: "absolute", left: 92 - 70, bottom: 128 - 70, width: 140, height: 140, zIndex: 7, touchAction: "none" }}
          onPointerDown={(e) => {
            e.stopPropagation();
            e.currentTarget.setPointerCapture(e.pointerId);
            const S = stateRef.current; if (!S) return;
            S.joy = { active: true, t: 0, s: 0 };
            moveJoy(e);
          }}
          onPointerMove={(e) => { e.stopPropagation(); moveJoy(e); }}
          onPointerUp={(e) => { e.stopPropagation(); releaseJoy(); }}
          onPointerCancel={(e) => { e.stopPropagation(); releaseJoy(); }}
        >
          <div style={{ position: "absolute", left: 70 - 56, top: 70 - 56, width: 112, height: 112, borderRadius: "50%", border: "2px solid rgba(125,255,168,0.55)", background: "rgba(20,24,30,0.35)", pointerEvents: "none" }} />
          <div ref={joyKnobRef} style={{ position: "absolute", left: 48, top: 48, width: 44, height: 44, borderRadius: "50%", background: "rgba(125,255,168,0.75)", border: "2px solid #7dffa8", pointerEvents: "none" }} />
        </div>
      )}
      {/* POSSESSION T4 (mk0.93): the right stick — steers the reticle.
          Shown for BOTH possessed kinds (towers have no left stick, so this
          is their whole interface). */}
      {isTouch && hud.possessed && (
        <div data-joyr
          style={{ position: "absolute", right: 92 - 70, bottom: 208 - 70, width: 140, height: 140, zIndex: 7, touchAction: "none" }}
          onPointerDown={(e) => {
            e.stopPropagation();
            e.currentTarget.setPointerCapture(e.pointerId);
            const S = stateRef.current; if (!S) return;
            S.joyR = { active: true, t: 0, s: 0 };
            moveJoyR(e);
          }}
          onPointerMove={(e) => { e.stopPropagation(); moveJoyR(e); }}
          onPointerUp={(e) => { e.stopPropagation(); releaseJoyR(); }}
          onPointerCancel={(e) => { e.stopPropagation(); releaseJoyR(); }}
        >
          <div style={{ position: "absolute", left: 70 - 56, top: 70 - 56, width: 112, height: 112, borderRadius: "50%", border: "2px solid rgba(125,255,168,0.55)", background: "rgba(20,24,30,0.35)", pointerEvents: "none" }} />
          <div ref={joyRKnobRef} style={{ position: "absolute", left: 48, top: 48, width: 44, height: 44, borderRadius: "50%", background: "rgba(125,255,168,0.75)", border: "2px solid #7dffa8", pointerEvents: "none" }} />
        </div>
      )}
      {hud.possessed && (
        <button data-possess-release
          style={{ ...P.btnBig, position: "absolute", right: 16, bottom: 16, zIndex: 7, borderColor: "#ffb45e", color: "#ffb45e", fontWeight: "bold" }}
          onClick={() => stateRef.current && stateRef.current.releasePossession()}>
          RELEASE
        </button>
      )}
      {/* POSSESSION (P4 T2, mk0.91) — FIRE: hold-to-repeat, like the
          sandbox's own trigger. Sets S.fireHeld; the sim bracket (frame loop)
          is what actually attempts a volley, at most once per sim tick. */}
      {isTouch && hud.possessed && (
        <button data-possess-fire ref={fireBtnRef}
          style={{ ...P.btnBig, position: "absolute", right: 132, bottom: 16, zIndex: 7, width: 64, height: 64, borderRadius: "50%", borderColor: "#ff6b5e", color: "#ff6b5e", fontWeight: "bold", background: "#2a1418", touchAction: "none" }}
          onPointerDown={(e) => { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); setFireHeld(true); }}
          onPointerUp={(e) => { e.stopPropagation(); setFireHeld(false); }}
          onPointerCancel={(e) => { e.stopPropagation(); setFireHeld(false); }}>
          FIRE
        </button>
      )}
      {/* P7 T2: the Bison's coax — vehicle possession only, beside FIRE.
          P7 T4: not the APC — one gun, FIRE alone. */}
      {isTouch && hud.possessed && hud.possessed.kind === "vehicle" && hud.possessed.vtype !== "apc" && (
        <button data-possess-mg ref={mgBtnRef}
          style={{ ...P.btnBig, position: "absolute", right: 208, bottom: 16, zIndex: 7, width: 64, height: 64, borderRadius: "50%", borderColor: "#ffd27a", color: "#ffd27a", fontWeight: "bold", background: "#2a2214", touchAction: "none" }}
          onPointerDown={(e) => { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); setMgHeld(true); }}
          onPointerUp={(e) => { e.stopPropagation(); setMgHeld(false); }}
          onPointerCancel={(e) => { e.stopPropagation(); setMgHeld(false); }}>
          MG
        </button>
      )}
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
        <button data-wind style={{ ...P.btn, padding: isTouch ? "5px 10px" : "4px 10px", borderColor: hud.windOn ? "#7fd7ff" : "#48515f", opacity: hud.windOn ? 1 : 0.6 }} title="wind (drift on every shot, both sides)" onClick={toggleWind}>
          WIND {hud.windOn ? "ON" : "OFF"}
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
                  <span style={{ color: "#ffd27a", fontSize: 12 }}>◆{hud.prices?.[key] ?? it.cost}</span>
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

      {hud.linePending && (
        <div style={{ position: "absolute", left: hud.linePending.x, top: hud.linePending.y, transform: "translate(-50%, -50%)", zIndex: 7, display: "flex", gap: 6, pointerEvents: "auto" }}>
          <button data-line-accept
            style={{ ...P.btnBig, borderColor: "#4aff8c", color: "#4aff8c", opacity: hud.linePending.armed ? 1 : 0.5, fontWeight: "bold" }}
            onClick={() => stateRef.current && stateRef.current.acceptLine()}>
            {hud.linePending.kind === "patrol" ? "✓ PATROL" : `✓ UP TO ◆${hud.linePending.cost}`}
          </button>
          <button data-line-reject
            style={{ ...P.btnBig, borderColor: "#ff6b5e", color: "#ff6b5e", fontWeight: "bold" }}
            onClick={() => stateRef.current && stateRef.current.rejectLine()}>
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
          // POSSESSION (P4 T1, mk0.90): TAKE CONTROL — every squad type,
          // instant like DEFEND (deselects on choose; the pie itself closes
          // via RadialMenu's onChoose regardless).
          { key: "possess", icon: "✥", label: "TAKE CONTROL", color: "#7dffa8", on: false, act: () => { const S = stateRef.current; if (S) S.takeControl(); } },
        ];
        // COMMAND T3 (mk0.85): PATROL — two taps propose a route through the
        // same proposed-line confirm the build orders use; accept and the
        // squad walks it forever. Every type except engineers and sappers.
        if (sq.patrolOk) {
          slots.push({ key: "patrol", icon: "⇄", label: "PATROL", color: "#7fd7ff", on: sq.aimingPatrol || sq.order === "patrol", act: () => stateRef.current && stateRef.current.orderSquad("patrol") });
        }
        // COMMAND T4 (mk0.86): STRUCTURES — instant toggle, armed types
        // only (an INFANTRY_ARMS row; not engineers, not sappers). Lit when
        // on. Its act also fully deselects, the DEFEND/SELL/CAREFUL-FREE
        // rule for instant pie actions.
        if (sq.structOk) {
          slots.push({ key: "structures", icon: "▨", label: "STRUCTURES", color: "#c9a0ff", on: sq.structFirst, act: () => { const S = stateRef.current; if (S) { S.toggleStructFirst(); S.selSquadId = null; } } });
        }
        if (sq.engineer) {
          slots.push(
            { key: "build_bags", icon: "▬", label: "BAGS", color: "#ffd27a", on: sq.building === "bags", act: () => stateRef.current && stateRef.current.orderSquad("build_bags") },
            { key: "build_walls", icon: "▦", label: "WALLS", color: "#ffd27a", on: sq.building === "walls", act: () => stateRef.current && stateRef.current.orderSquad("build_walls") },
          );
        }
        // P7 T10: MINES and WIRES — the sapper team's own two wedges, the
        // identical two-tap build shape the engineer wedges above use.
        if (sq.sapper) {
          slots.push(
            { key: "build_mines", icon: "◆", label: "MINES", color: "#ffb45e", on: sq.building === "mines", act: () => stateRef.current && stateRef.current.orderSquad("build_mines") },
            { key: "build_wires", icon: "⌁", label: "WIRES", color: "#ffb45e", on: sq.building === "wires", act: () => stateRef.current && stateRef.current.orderSquad("build_wires") },
          );
        }
        // COMMAND T2 (mk0.84): a proposed line up takes over the status —
        // it outranks the building/aiming lines below since S.orderMode is
        // already null by the time S.linePending goes up.
        const status = sq.linePending ? " — ACCEPT OR ADJUST THE LINE"
          : sq.building
          ? (sq.buildStart ? " — TAP THE FAR END" : " — TAP THE LINE START")
          // COMMAND T3 (mk0.85): patrol's two-tap status rides the same
          // S.buildPt0 field the build orders' status does.
          : sq.aimingPatrol
          ? (sq.buildStart ? " — TAP THE FAR END" : " — TAP THE PATROL START")
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
        // POSSESSION (P4 T3, mk0.92): TAKE CONTROL — same wedge as the squad
        // pie, gated on canPossess (gun towers only; frost has none).
        if (tr.canPossess) {
          slots.push({
            key: "possess",
            icon: "✥",
            label: "TAKE CONTROL",
            color: "#7dffa8",
            on: false,
            act: () => { const S = stateRef.current; if (S) S.takeControlTower(tr.id); },
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

      {hud.vehRadial && (() => {
        const vr = hud.vehRadial;
        const vLabel = vr.vtype === "apc" ? "APC" : "BISON";   // P7 T4: label by vtype
        const slots = [
          { key: "defend", icon: "∴", label: "DEFEND", color: "#7dffa8", on: vr.order === "defend", act: () => { const S = stateRef.current; if (S) { S.orderVehicle("defend"); S.selVehId = null; } } },
          { key: "move", icon: "→", label: "MOVE", color: "#7fd7ff", on: vr.aimingMove || vr.order === "move", act: () => stateRef.current && stateRef.current.orderVehicle("move") },
          { key: "patrol", icon: "⇄", label: "PATROL", color: "#7fd7ff", on: vr.aimingPatrol || vr.order === "patrol", act: () => stateRef.current && stateRef.current.orderVehicle("patrol") },
          { key: "escort", icon: "⛨", label: "ESCORT", color: "#c9a0ff", on: vr.aimingEscort || vr.order === "escort", act: () => stateRef.current && stateRef.current.orderVehicle("escort") },
          { key: "tracks", icon: vr.tracks === "free" ? "●" : "◐", label: vr.tracks === "free" ? "TRACKS FREE" : "TRACKS CAREFUL", color: vr.tracks === "free" ? "#ff7a7a" : "#4aff8c", on: true, act: () => { const S = stateRef.current; if (S) { S.toggleTracks(); S.selVehId = null; } } },
          { key: "possess", icon: "✥", label: "TAKE CONTROL", color: "#7dffa8", on: false, act: () => stateRef.current && stateRef.current.takeControlVehicle() },
        ];
        // P7 T4: LOAD/UNLOAD — APC only, offered only when there's a seat to
        // fill or a rider to drop.
        if (vr.vtype === "apc" && vr.seatsFree > 0) {
          slots.push({ key: "load", icon: "⬒", label: "LOAD (" + vr.seatsFree + ")", color: "#ffd27a", on: vr.aimingLoad, act: () => stateRef.current && stateRef.current.orderVehicle("load") });
        }
        if (vr.vtype === "apc" && vr.riders > 0) {
          slots.push({ key: "unload", icon: "⬓", label: "UNLOAD (" + vr.riders + ")", color: "#ffd27a", on: false, act: () => { const S = stateRef.current; if (S) { S.unloadVehicle(); S.selVehId = null; } } });
        }
        const status = vr.linePending ? " — ACCEPT OR ADJUST THE LINE"
          : vr.aimingPatrol ? (vr.patrolStart ? " — TAP THE FAR END" : " — TAP THE PATROL START")
          : vr.aimingEscort ? " — TAP A SQUAD"
          : vr.aimingLoad ? " — TAP A SQUAD"
          : vr.aimingMove ? " — TAP GROUND" : "";
        return vr.showPie
          ? <RadialMenu cx={vr.x} cy={vr.y} label={vLabel + status} slots={slots} armed={vr.armed} onChoose={() => { const S = stateRef.current; if (S) S.pieOpen = false; }} />
          : <div style={{ position: "absolute", left: vr.x, top: vr.y + 26, transform: "translate(-50%,0)", fontSize: 10, letterSpacing: 1, color: "#7dffa8", background: "rgba(14,18,24,0.85)", padding: "1px 6px", borderRadius: 4, zIndex: 7, pointerEvents: "none" }}>{vLabel + status}</div>;
      })()}

      {hud.started && !hud.gameOver && !hud.victory && !hud.possessed && (
        <div style={P.bar}>
          {palette.map((p) => {
            const sel = !hud.sellMode && hud.mode === p.key;
            const priceP = hud.prices?.[p.key] ?? p.cost;
            const afford = hud.resources >= priceP;
            return (
              <div key={p.key} data-tower-key={p.key}
                style={{ ...P.slot, borderColor: sel ? "#4aff8c" : "#48515f", opacity: afford ? 1 : 0.45, minWidth: isTouch ? 56 : 52 }}
                onClick={() => setMode(p.key)}>
                <div style={{ fontSize: 16 }}>{p.icon}</div>
                <div>{p.label}</div>
                <div style={{ color: "#ffd27a" }}>◆{priceP}</div>
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
            They are coming for your depot across the valley — wall your ground, gun the choke points.
            Rock is free cover. The frozen ponds carry them faster — and you cannot build on ice.
            {isTouch ? " Drag to pan, pinch to zoom, tap to build. Tap a tower to inspect it." : " WASD pans, wheel zooms, Q/E rotates, click builds. Click a tower to inspect it."}
          </div>
          <button style={{ ...P.btn, fontSize: 15, padding: "10px 26px", borderColor: "#4aff8c", color: "#4aff8c" }} onClick={startGame}>
            TAKE COMMAND
          </button>
          <button data-menu="manual" style={{ ...P.btn, marginTop: 14, opacity: 0.75, fontSize: 11, letterSpacing: 1 }} onClick={() => setManualOpen(true)}>
            FIELD MANUAL
          </button>
          <div style={{ fontSize: 10, opacity: 0.55, marginTop: 12, letterSpacing: 2 }}>FIELD ORDER #{hud.seed || "—"} · ?seed= replays a map</div>
        </div>
      )}

      {!hud.started && !fatal && manualOpen && <FieldManual onClose={closeManual} />}

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
