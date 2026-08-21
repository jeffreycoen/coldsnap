import { ok } from "./harness.mjs";
import { identFwdDir, straightGrid } from "./shared.mjs";
import { towerShot, shooterFire, squadFire, possessedVolley, possessedTowerFire, POSSESS_ACC, POSSESS_SNAP_R, snapTargetNear, stickyLock, mateBlocks, fieldReaches, effRange, PENDING_ARM_S, pendingArmed, spawnSquadMembers, spawnSandbag, pruneSquads, spawnWallCourses, WALL_HALF, WALL_THIN, WALL_COURSE_HY, friendlyFouls, throwGrenade, stepGrenades } from "../../src/depot/state.js";
import { makeWorld, makeField, addBody, addWeld, stepWorld, applyDamage, CAUSE, mulberry32 } from "../../src/engine/core.js";
import { reachPolygon, arcClears, scatterSigma, losGraze, bracedAt, applyScatter, SCATTER_CAP, deflect, flightImpact, predictRing, elevSolve, speedForPitch, RING_RAYS } from "../../src/depot/accuracy.js";
import { TOWER_SPECS, ENEMY_FIRE, MASON, INFANTRY_ARMS, ENEMY_SPECS, MAN, BISON_FIRE, HAND_TAGS, GRENADE, BARRELS } from "../../src/depot/specs.js";
import { stepUnits } from "../../src/depot/units.js";
import { barrelTip } from "../../src/depot/drivers.js";
import { SQUAD_SPECS, makeSquad, stepSquad, drivePossessedSquad, COHESION_M, clearSlot } from "../../src/depot/squads.js";
import { makeTerritory, holderAt, valueAt, canBuild } from "../../src/depot/territory.js";
import { SIGHT, eyeOf, canSee, fillMaps, gridEye, makeSight, seenAt, stepSight, RETICLE_SPEED, steerReticle, reclampReticle, surfaceAt } from "../../src/depot/sight.js";
import { serializeFront, parseFront, restoreBodies, restoreSquads } from "../../src/depot/save.js";
import { startBuildLine } from "../../src/depot/buildlines.js";
import { ringBell } from "../../src/depot/bell.js";
import fs from "node:fs";

// ==== VISION T1: sight =======================================================
// The eye itself (mk0.70), re-pinned to cell resolution at mk0.71. sight.js is
// pure geometry and inert — nothing in the game imports it yet, so every
// assert below runs against hand-built fixture worlds. ORIENT 0 here, so the
// world<->canonical transforms DepotGame hands stepSight (invW/fwdU) are the
// identity.
//
// mk0.71 re-pin: canSee no longer walks the world in meters asking bodies —
// it marches the swept cell maps. Every canSee assert therefore builds the
// maps first (fillMaps) and names the target as the CELL a spot falls in.
// The meanings are unchanged; the fixture coordinates are unchanged too (each
// already sits on a cell center, and each blocker already owns its own cell).
{
  const idUV = (x, z) => ({ u: x, v: z });   // DepotGame's invW at ORIENT 0
  const idW = (u, v) => ({ x: u, z: v });    // DepotGame's fwdU at ORIENT 0
  const flatField = { heightAt: () => 0, dirty: false };
  // sees(world, eye, tx, tz): the mk0.70 canSee question, asked the mk0.71 way.
  const sees = (world, eye, tx, tz) => {
    const SG = makeSight(makeTerritory(29, 57));
    fillMaps(world, SG, idUV, idW);
    return canSee(SG, gridEye(SG, eye, idUV),
      Math.floor((tx + SG.halfU) / SG.cs), Math.floor((tz + SG.halfV) / SG.cs));
  };

  // (a) range — an eye sees clear ground inside its reach and nothing past it.
  {
    const flat = { field: { heightAt: () => 0 }, bodies: [] };
    const eye = eyeOf({ kind: "unit", pos: { x: 0, y: 0, z: 0 } });
    ok("VISION T1(a) (re-taught mk2.02): a plain infantryman's eye carries SIGHT.unit and sits 0.8m up — the 2m man",
      eye.r === SIGHT.unit && eye.y === 0.8);
    ok("VISION T1(a): clear open ground 20m off is seen", sees(flat, eye, 0, 20) === true);
    ok("VISION T1(a): the same open ground 30m off is past the eye's reach", sees(flat, eye, 0, 30) === false);
    ok("VISION T1(a): a spotter's glasses reach farther than a sniper's scope, which reaches farther than a rifleman",
      SIGHT.spotter > SIGHT.sniper && SIGHT.sniper > SIGHT.unit);
    ok("VISION T1(a): a spotter body gets the spotter's reach",
      eyeOf({ kind: "unit", role: "spotter", pos: { x: 0, y: 0, z: 0 } }).r === SIGHT.spotter);
    ok("VISION T1(a): a sniper body gets the sniper's reach",
      eyeOf({ kind: "unit", role: "sniper", pos: { x: 0, y: 0, z: 0 } }).r === SIGHT.sniper &&
      eyeOf({ kind: "unit", tag: "sniper", pos: { x: 0, y: 0, z: 0 } }).r === SIGHT.sniper);
    ok("VISION T1(a): a tower's eye sits at the top of the tower, not at its feet",
      eyeOf({ kind: "tower", hy: 1.6, pos: { x: 0, y: 9, z: 0 } }).y === 9 + 1.6 + 0.45);
  }

  // (b) a ridge between the eye and the spot blocks it.
  {
    const ridge = { field: { heightAt: (x, z) => (Math.abs(z - 10) < 1.5 ? 6 : 0) }, bodies: [] };
    const eye = eyeOf({ kind: "unit", pos: { x: 0, y: 0, z: 0 } });
    ok("VISION T1(b): a ridge standing between eye and spot blocks the view", sees(ridge, eye, 0, 20) === false);
    ok("VISION T1(b): the same distance the other way, with no ridge, stays clear", sees(ridge, eye, 0, -20) === true);
  }

  // (c) a three-course wall blocks a man on the ground; a raised eye sees over.
  {
    const world = makeWorld({ field: flatField, seed: 1 });
    spawnWallCourses(world, 0, 0, 8, 0);   // broad across x, thin across z, at z=8
    const low = { x: 0, y: 0.5, z: 0, r: SIGHT.unit };            // a man on the ground
    const high = { x: 0, y: 3.5, z: 0, r: SIGHT.unit };           // the same man 3m higher
    ok("VISION T1(c): a wall blocks a man standing on the ground behind it", sees(world, low, 0, 16) === false);
    ok("VISION T1(c): an eye raised 3m looks straight over the same wall", sees(world, high, 0, 16) === true);
  }

  // (d) a spot on a hill is seen from below when nothing stands in the way.
  {
    const hill = { field: { heightAt: (x, z) => Math.max(0, Math.min(4, (z - 14) * 2)) }, bodies: [] };
    const eye = eyeOf({ kind: "unit", pos: { x: 0, y: 0, z: 0 } });
    ok("VISION T1(d): a spot on the hillside is seen from the flat below it", sees(hill, eye, 0, 18) === true);
  }

  // (e) the team map: only team-2 eyes stand in the far corner, so the corner
  // is lit for team 2 and dark for team 1.
  {
    const T = makeTerritory(29, 57);
    const SG = makeSight(T);
    ok("VISION T1(e): the sight map shares the territory grid's own frame",
      SG.nx === T.nx && SG.nz === T.nz && SG.cs === T.cs && SG.halfU === T.halfU && SG.halfV === T.halfV);
    const world = makeWorld({ field: flatField, seed: 1 });
    addBody(world, { kind: "unit", team: 2, mass: 80, hx: 0.3, hy: 0.9, hz: 0.3, x: 20, y: 0.9, z: 40, hp: 40 });
    addBody(world, { kind: "unit", team: 1, mass: 80, hx: 0.3, hy: 0.9, hz: 0.3, x: -20, y: 0.9, z: -40, hp: 40 });
    stepSight(world, SG, idUV, idW);
    ok("VISION T1(e): the enemy corner is lit for the side standing in it", seenAt(SG, 20, 40, 2) === true);
    ok("VISION T1(e): the same corner is dark for the side with no eyes there", seenAt(SG, 20, 40, 1) === false);
    ok("VISION T1(e): each side sees the ground its own man stands on", seenAt(SG, -20, -40, 1) === true);
    ok("VISION T1(e): and not the ground the other man stands on", seenAt(SG, -20, -40, 2) === false);
    ok("VISION T1(e): a spot off the grid is never seen", seenAt(SG, 900, 900, 1) === false && seenAt(SG, -900, -900, 2) === false);

    // (g) the dice never move: building the map draws nothing from world.rng.
    let draws = 0;
    const rng0 = world.rng;
    world.rng = () => { draws++; return rng0(); };
    stepSight(world, SG, idUV, idW);
    world.rng = rng0;
    ok("VISION T1(g): building the sight map draws nothing from the world's dice", draws === 0, `${draws} draws`);
  }

  // (f) two identical worlds produce identical maps, byte for byte.
  {
    const build = () => {
      const world = makeWorld({ field: flatField, seed: 7 });
      addBody(world, { kind: "unit", team: 1, mass: 80, hx: 0.3, hy: 0.9, hz: 0.3, x: -6, y: 0.9, z: -12, hp: 40 });
      addBody(world, { kind: "unit", team: 1, mass: 80, hx: 0.3, hy: 0.9, hz: 0.3, x: 4, y: 0.9, z: -8, hp: 40 });
      addBody(world, { kind: "unit", team: 2, mass: 80, hx: 0.3, hy: 0.9, hz: 0.3, x: 2, y: 0.9, z: 14, hp: 40 });
      spawnWallCourses(world, 0, 0, 2, 0);
      const T = makeTerritory(29, 57);
      const SG = makeSight(T);
      stepSight(world, SG, idUV, idW);
      return SG;
    };
    const A = build(), B = build();
    let same = A.seen1.length === B.seen1.length && A.seen2.length === B.seen2.length;
    for (let i = 0; same && i < A.seen1.length; i++) same = A.seen1[i] === B.seen1[i] && A.seen2[i] === B.seen2[i];
    ok("VISION T1(f): two identical worlds give identical sight maps", same);
    let lit1 = 0, lit2 = 0;
    for (let i = 0; i < A.seen1.length; i++) { lit1 += A.seen1[i]; lit2 += A.seen2[i]; }
    ok("VISION T1(f): and the map is not trivially empty", lit1 > 0 && lit2 > 0, `${lit1}/${lit2}`);
  }

  // (h) walls and sandbags are never eyes (owner's rule, 2026-08-12) — they
  // block sight, they never grant it.
  {
    const world = makeWorld({ field: flatField, seed: 3 });
    for (let i = -3; i <= 3; i++) spawnWallCourses(world, i * 2, 0, 0, 0);
    for (let i = -3; i <= 3; i++) spawnSandbag(world, i * 2, 6, 0);
    const T = makeTerritory(29, 57);
    const SG = makeSight(T);
    stepSight(world, SG, idUV, idW);
    let lit = 0;
    for (let i = 0; i < SG.seen1.length; i++) lit += SG.seen1[i] + SG.seen2[i];
    ok("VISION T1(h): a field of walls and sandbags and nothing else is all dark, both sides", lit === 0, `${lit} lit cells`);
  }

  // (i) THE CLOCK (mk0.71). mk0.70's exact-box ray asked every body in the
  // world at every step of every line and cost 2,284ms per recompute at the
  // mid-fight census — 570x its budget. This rebuilds that same census
  // headless (the real 121x121 @2m field carrying buildDepotTerrain's base
  // relief, ~1,190 bodies, 120 troops, both flags, six towers) and fails if
  // one recompute ever again costs more than three times the 4ms budget.
  {
    const field = makeField(121, 2.0, 11);
    {
      const r = mulberry32(11);
      const { n, cs, h, half } = field;
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const x = i * cs - half, z = j * cs - half;
        const stepUp = (v0, w, h2) => { const t = Math.min(1, Math.max(0, (z - v0) / w + 0.5)); return h2 * t * t * (3 - 2 * t); };
        let y = 2.0
          + Math.sin(x * 0.075 + 1.3) * 0.42
          + Math.cos(z * 0.061 - 0.6) * 0.38
          + Math.sin((x + z) * 0.032) * 0.30
          + (r() - 0.5) * 0.06
          + stepUp(-18, 10, 1.8) + stepUp(6, 10, 2.0) + stepUp(30, 10, 2.2);
        const over = Math.max(0, Math.abs(x) - 29, Math.abs(z) - 57);
        if (over > 0) y = Math.max(-6, y - over * over * 0.55);
        h[j * n + i] = y;
      }
    }
    const gy = (x, z) => field.heightAt(x, z);
    const world = makeWorld({ field, seed: 11 });
    const r = mulberry32(99);
    // town masonry — ten hollow lattices, the bulk of the census
    const towns = [
      { x: 0, z: 49, nx: 9, nz: 8, ny: 5 }, { x: 0, z: -51, nx: 9, nz: 8, ny: 5 },
      { x: -14, z: 20, nx: 6, nz: 5, ny: 4 }, { x: 12, z: 24, nx: 5, nz: 4, ny: 4 },
      { x: -8, z: -6, nx: 8, nz: 4, ny: 3 }, { x: 16, z: -2, nx: 4, nz: 4, ny: 3 },
      { x: -18, z: 36, nx: 5, nz: 6, ny: 5 }, { x: 10, z: 40, nx: 7, nz: 6, ny: 5 },
      { x: -12, z: -28, nx: 6, nz: 5, ny: 4 }, { x: 14, z: -34, nx: 5, nz: 4, ny: 4 },
    ];
    let chunks = 0;
    outer:
    for (const t of towns) {
      const base = gy(t.x, t.z);
      for (let ky = 0; ky < t.ny; ky++) for (let kz = 0; kz < t.nz; kz++) for (let kx = 0; kx < t.nx; kx++) {
        if (ky > 0 && kx > 0 && kx < t.nx - 1 && kz > 0 && kz < t.nz - 1) continue; // hollow: walls only
        if (chunks >= 1120) break outer;
        const b = addBody(world, {
          kind: "chunk", team: 0, mass: MASON.mass, hx: MASON.hcs, hy: MASON.hcs, hz: MASON.hcs,
          x: t.x + (kx - (t.nx - 1) / 2) * MASON.pitch,
          y: base + MASON.hcs + ky * MASON.pitch,
          z: t.z + (kz - (t.nz - 1) / 2) * MASON.pitch, hp: 40,
        });
        b.sleeping = true; chunks++;
      }
    }
    let rocks = 0;
    for (const bz of [-17, 7, 31]) for (let x = -25; x <= 25; x += 5.5) {
      if (rocks >= 40) break;
      const z = bz + (r() - 0.5) * 2.5, rad = 3.4 + r() * 1.2, hh = 3.0 + r() * 0.9;
      addBody(world, { kind: "rock", team: 0, mass: 0, hx: rad * 0.55, hy: hh * 0.8, hz: rad * 0.55, x, y: gy(x, z) - hh * 0.2, z, hp: 400 });
      rocks++;
    }
    for (let i = 0; i < 15; i++) {
      const x = -26 + r() * 52, z = -50 + r() * 100;
      addBody(world, { kind: "tree", team: 0, mass: 260, hx: 0.28, hy: 1.6, hz: 0.28, x, y: gy(x, z) + 1.62, z, hp: 70 }).sleeping = true;
    }
    addBody(world, { kind: "flag", team: 1, mass: 0, hx: 0.1, hy: 0.1, hz: 0.1, x: 0, y: gy(0, 49) + 6, z: 49, hp: 10 });
    addBody(world, { kind: "flag", team: 2, mass: 0, hx: 0.1, hy: 0.1, hz: 0.1, x: 0, y: gy(0, -51) + 6, z: -51, hp: 10 });
    for (let i = 0; i < 6; i++) {
      const x = -10 + i * 4, z = 40 + (i % 2) * 3;
      addBody(world, { kind: "tower", team: 1, mass: 0, hx: 0.8, hy: 1.2, hz: 0.8, x, y: gy(x, z) + 1.2, z, hp: 120 });
    }
    const put = (team, x, z) => addBody(world, { kind: "unit", team, mass: 80, hx: 0.3, hy: 0.9, hz: 0.3, x, y: gy(x, z) + 0.9, z, hp: 40 });
    for (let c = 0; c < 3; c++) for (let i = 0; i < 34 && c * 34 + i < 100; i++) {
      put(2, -18 + c * 16 + (r() - 0.5) * 5, -24 + (i % 12) * 1.4 + (r() - 0.5) * 3);
    }
    for (let i = 0; i < 20; i++) put(1, -14 + (r() - 0.5) * 24, 34 + (r() - 0.5) * 8);

    const SG = makeSight(makeTerritory(29, 57));
    stepSight(world, SG, idUV, idW);          // warm
    let best = Infinity;
    for (let rep = 0; rep < 5; rep++) {
      const t0 = process.hrtime.bigint();
      stepSight(world, SG, idUV, idW);
      const ms = Number(process.hrtime.bigint() - t0) / 1e6;
      if (ms < best) best = ms;               // fastest of five: noise-proof, still catches any real regression
    }
    const troops = world.bodies.filter((b) => b.kind === "unit").length;
    let lit1 = 0, lit2 = 0;
    for (let i = 0; i < SG.seen1.length; i++) { lit1 += SG.seen1[i]; lit2 += SG.seen2[i]; }
    ok("VISION T1(i): one recompute at the mid-fight census stays inside three times its 4ms budget",
      best < 12, `${best.toFixed(2)} ms — ${world.bodies.length} bodies, ${troops} troops`);
    ok("VISION T1(i): and that recompute really lit the map for both sides", lit1 > 0 && lit2 > 0, `${lit1}/${lit2}`);
  }
}
// ==== end VISION T1 ==========================================================

// ==== VISION T2: one law — you shoot what you see ============================
// mk0.72. fieldReaches (state.js) is the one gate every shot passes through,
// and it now reads the sight map instead of the ground-control field. These
// asserts drive the two ends of that law: a tower that must wait for eyes,
// and enemy fire that may no longer bombard masonry nobody on its side sees.
// ORIENT 0 throughout, so the world<->canonical transforms are the identity.
{
  const idUV = (x, z) => ({ u: x, v: z });
  const idW = (u, v) => ({ x: u, z: v });

  // (a) THE TOWER WAITS FOR EYES. A ridge stands between a mortar tower and
  // an attacker beyond it. The tower's shell arcs over the ridge happily
  // (lofted fire ignores terrain), so nothing but sight can stop the
  // acquisition — and nothing on our side can see that ground until a man
  // walks over the crest.
  {
    // the ridge: 6m tall, one cell deep, running across the map at z=10
    const ridgeF = { heightAt: (x, z) => (Math.abs(z - 10) < 1.5 ? 6 : 0), dirty: false };
    const spec = { kind: "mortar", projSpeed: 33, occl: "lofted", range: 30, fireRate: 1 };
    const world = makeWorld({ field: ridgeF, seed: 71 });
    const tower = addBody(world, { kind: "tower", team: 1, mass: 0, hx: 0.8, hy: 1.2, hz: 0.8, x: 0, y: 1.2, z: 0, hp: 120 });
    const foe = addBody(world, { kind: "unit", team: 2, mass: 80, hx: 0.3, hy: 0.9, hz: 0.3, x: 0, y: 0.9, z: 20, hp: 40 });
    const T = makeTerritory(29, 57);
    T.sight = makeSight(T);
    // stepTowers' own scan loop, mirrored (it lives in DepotGame.jsx, which
    // this headless file cannot import — the same mirroring the fire
    // discipline fixture above uses).
    const acquires = () => {
      const muzzle = { x: tower.pos.x, y: tower.pos.y + tower.hy + 0.45, z: tower.pos.z };
      const eR = effRange(world, muzzle, spec);
      let best = null, bd = eR * eR;
      for (const e of world.bodies) {
        if ((e.kind !== "unit" && e.kind !== "vehicle") || !e.alive || e.team !== 2) continue;
        const c = idUV(e.pos.x, e.pos.z);
        if (!fieldReaches(T, c.u, c.v, 1)) continue;
        const dx = e.pos.x - tower.pos.x, dz = e.pos.z - tower.pos.z, d2 = dx * dx + dz * dz;
        if (d2 < bd && arcClears(world, muzzle, e.pos, spec, tower.id)) { bd = d2; best = e; }
      }
      return best;
    };
    stepSight(world, T.sight, idUV, idW);
    ok("VISION T2(a): the tower's own eye cannot see over the ridge", fieldReaches(T, 0, 20, 1) === false);
    ok("VISION T2(a): so it does not acquire the man standing behind it", acquires() === null);
    // a rifleman walks over the crest — now our side has eyes on that ground
    addBody(world, { kind: "unit", team: 1, mass: 80, hx: 0.3, hy: 0.9, hz: 0.3, x: 0, y: 0.9, z: 12, hp: 40 });
    stepSight(world, T.sight, idUV, idW);
    ok("VISION T2(a): a man over the crest lights that ground for the whole side", fieldReaches(T, 0, 20, 1) === true);
    ok("VISION T2(a): and the next scan acquires", acquires() === foe);
  }

  // (b) NO BOMBARDING WHAT NOBODY SEES. An enemy grenadier lobs over a ridge
  // at a player wall. Lofted fire ignores terrain entirely, so before this
  // phase he shelled masonry his side had never laid eyes on; now he holds
  // until one of his own can see it.
  // DEVIATION from the plan's wording ("an enemy rifleman"): a rifleman
  // cannot show this law. His gun reaches 13m and his eyes reach 24m, and
  // his shot already needs a clear flight path — so anything he can shoot he
  // can already see, and the gate is a no-op on him. The grenadier's lobbed
  // fire is where the law actually bites, and it is the same gate, in the
  // same shape, in the same file.
  {
    // ridge as above but finite across x, so a flanking eye can see past it
    const ridgeF = { heightAt: (x, z) => (Math.abs(z - 10) < 1.5 && Math.abs(x) < 6 ? 6 : 0), dirty: false };
    const world = makeWorld({ field: ridgeF, seed: 72 });
    const gren = addBody(world, { kind: "unit", team: 2, mass: 80, hx: 0.3, hy: 0.9, hz: 0.3, x: 0, y: 0.9, z: 0, hp: 40 });
    gren.tag = "mortar"; gren.utype = "mortar"; gren.wph = 0; // mk2.02: the mortar team holds the long lob now; the grenadier's throw is 12m
    const wall = addBody(world, { kind: "wall", team: 1, mass: 0, hx: 0.9, hy: 0.9, hz: 0.9, x: 0, y: 0.9, z: 18, hp: 70 });
    const T = makeTerritory(29, 57);
    T.sight = makeSight(T);
    stepSight(world, T.sight, idUV, idW);
    ok("VISION T2(b): the attacker's side cannot see the wall behind the ridge", fieldReaches(T, 0, 18, 2) === false);
    for (let i = 0; i < 30; i++) stepUnits(world, straightGrid(0, 1), identFwdDir, T, idUV);
    ok("VISION T2(b) (re-taught mk2.02): so the mortar man takes no target", gren.tgtId == null);
    ok("VISION T2(b): and nothing is fired at it", world.projectiles.length === 0);
    // one of theirs comes round the flank, far enough off that his own rifle
    // never reaches the wall — he brings eyes, nothing else
    addBody(world, { kind: "unit", team: 2, mass: 80, hx: 0.3, hy: 0.9, hz: 0.3, x: 20, y: 0.9, z: 8, hp: 40 });
    stepSight(world, T.sight, idUV, idW);
    ok("VISION T2(b): the flanker sees the wall for his whole side", fieldReaches(T, 0, 18, 2) === true);
    for (let i = 0; i < 30; i++) stepUnits(world, straightGrid(0, 1), identFwdDir, T, idUV);
    ok("VISION T2(b) (re-taught mk2.02): the mortar man takes the wall the moment his side can see it", gren.tgtId === wall.id);
    ok("VISION T2(b): and the shell is away", world.projectiles.length > 0);
  }

  // (c) the contested-boundary and orientation fixtures are re-pinned in
  // place, up in the Phase 4 Task 2 block — one law, one set of asserts.

  // (d) THE SAVE CARRIES NOTHING NEW. Sight is derived state: the file never
  // holds it, and a resumed run rebuilds it on the first territory tick
  // because the map is made where the territory is made.
  {
    const saveSrc = fs.readFileSync(new URL("../../src/depot/save.js", import.meta.url), "utf8");
    ok("VISION T2(d): save.js stores no sight at all (derived, rebuilt on resume)", !/\bsight\b/i.test(saveSrc));
    const gameSrc = fs.readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");
    ok("VISION T2(d): the sight map is made where the territory is made", /T\.sight\s*=\s*makeSight\(T\)/.test(gameSrc));
    ok("VISION T2(d): and it recomputes on the territory clock", /stepSight\(world,\s*T\.sight/.test(gameSrc));
  }

  // (e) THE GATE ITSELF, AND THE CARVE-OUTS THAT DIED. Structure fire used to
  // skip the gate entirely because a wall's own territory emission made it
  // permanently untargetable — a pathology sight does not have.
  {
    const stateSrc = fs.readFileSync(new URL("../../src/depot/state.js", import.meta.url), "utf8");
    ok("VISION T2(e): fieldReaches reads the sight map", /seenAt\(T\.sight,\s*x,\s*z,\s*team\)/.test(stateSrc));
    ok("VISION T2(e): and no longer imports the ground-control bridge", !/fogStateForContested/.test(stateSrc));
    const terrSrc = fs.readFileSync(new URL("../../src/depot/territory.js", import.meta.url), "utf8");
    ok("VISION T2(e): the contested-ground bridge is deleted", !/export function fogStateForContested/.test(terrSrc));
    ok("VISION T2(e): ownership, build rights and the wash are untouched",
      /export function fogStateFor\(/.test(terrSrc) && /export function valueAt\(/.test(terrSrc) &&
      /export function holderAt\(/.test(terrSrc) && /export function canBuild\(/.test(terrSrc));
    const unitsSrc = fs.readFileSync(new URL("../../src/depot/units.js", import.meta.url), "utf8");
    const driversSrc = fs.readFileSync(new URL("../../src/depot/drivers.js", import.meta.url), "utf8");
    ok("VISION T2(e): no enemy shooter claims an ungated structure scan any more", !/NO fieldReaches/.test(unitsSrc));
    // re-pinned mk1.30 (P7 T1): the tank's acquisition path moved verbatim to
    // drivers.js — 6 of the seven remain in units.js, the 7th (the tank's
    // structure scan) now lives in the motor pool, same gate, same law.
    ok("VISION T2(e): six of the seven enemy acquisition paths gate on sight in units.js",
      (unitsSrc.match(/fieldReaches\(T,/g) || []).length === 6, (unitsSrc.match(/fieldReaches\(T,/g) || []).length);
    // re-pinned P7 T2 (mk1.31): the Bison's armor policy joined the motor
    // pool — armorGuns' two scans (unit/vehicle foes, hostile structures) and
    // the two possessed triggers (main gun, coax) all gate on sight, the same
    // law every other shot obeys. Count moves 1 -> 5, honestly, four new
    // sight-gated call sites, none loosened.
    ok("VISION T2(e): the tank's, the Bison's, and the mech's acquisition paths gate on sight in drivers.js (re-pinned mk1.92 — the mech's shared possessed-fire gate, mechSighted, joined the motor pool: 5 -> 6)",
      (driversSrc.match(/fieldReaches\(T,/g) || []).length === 6, (driversSrc.match(/fieldReaches\(T,/g) || []).length);
    ok("VISION T2(e): the sapper's contact plant stays ungated (he IS the eye, at arm's length)",
      /stepSapper/.test(unitsSrc) && !/fieldReaches[\s\S]{0,200}SAPPER_PLANT_PAD/.test(unitsSrc));
  }
}
// ==== end VISION T2 ==========================================================

// ==== VISION T4: halt and fight ==============================================
// mk0.74. The owner's playtest ruling: an attacking squad that SEES an enemy
// in weapon reach halts and fights until it's dead or gone, then resumes.
// MOVE stays quiet; sappers never halt for men. The halt lives in
// DepotGame.jsx's stepDepot (engageCheck, called just before stepSquad each
// tick) — game-layer code this headless file cannot import, so it is
// mirrored here verbatim, the same convention VISION T1/T2's tower- and
// stepDepot-scan mirrors already use. ORIENT 0, so world<->canonical is the
// identity; territory + sight are built and stepped every tick, same as
// VISION T2's fixtures.
{
  const idUV = (x, z) => ({ u: x, v: z });
  const idW = (u, v) => ({ x: u, z: v });
  const flat = { heightAt: () => 0, dirty: false, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } };

  // mirrors DepotGame.jsx's stepDepot engageCheck, byte-for-byte in logic.
  const ENGAGE_CHECK_S = 0.2, ENGAGE_HOLD_S = 0.35;
  const makeEngageCheck = (world, T, invW) => (sq) => {
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
      sq._pauseT = Math.max(sq._pauseT || 0, ENGAGE_HOLD_S);
      return;
    }
  };

  // fixture: a rifle squad at the origin ordered ATTACK to (0,30), an enemy
  // conscript 8m off the path at (8,12) — inside the rifle's 15m reach and
  // its 24m sight the moment territory+sight are stepped.
  const mkFixture = (order, seed = 12) => {
    const world = makeWorld({ field: flat, seed });
    world.dt = 1 / 60;
    const sq = makeSquad(1, "rifles", 1, 0, 0);
    spawnSquadMembers(world, sq);
    sq.order = order; sq.dest = { x: 0, z: 30 };
    const foe = addBody(world, { kind: "unit", team: 2, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x: 8, y: 0.86, z: 12, hp: 58 });
    const T = makeTerritory(29, 57);
    T.sight = makeSight(T);
    return { world, sq, foe, T };
  };

  // (a) ATTACK past the conscript halts within a second and fires. Pinned
  // to fail before the change (zero muzzles, anchor sails past 3m in the
  // first second) and pass after.
  {
    const { world, sq, T } = mkFixture("attack");
    const engageCheck = makeEngageCheck(world, T, idUV);
    let muzzles = 0, anchorAt1s = null;
    for (let i = 0; i < 60; i++) {
      stepSight(world, T.sight, idUV, idW);
      engageCheck(sq);
      const before = world.projectiles.length;
      stepSquad(world, sq, world.dt);
      squadFire(world, sq, world.dt, T, idUV);
      if (world.projectiles.length > before) muzzles += world.projectiles.length - before;
      stepWorld(world);
      if (i === 59) anchorAt1s = sq.anchor.z;
    }
    ok("VISION T4(a): the squad halts within a second (anchor well short of the 3.2m unhalted march)",
      anchorAt1s < 1.0, `anchor.z=${anchorAt1s.toFixed(2)}`);
    ok("VISION T4(a): and it fires on the seen conscript (muzzle events)", muzzles > 0, `muzzles=${muzzles}`);
  }

  // (b) the conscript dies, the squad resumes, arrives, and digs in.
  {
    const { world, sq, foe, T } = mkFixture("attack");
    const engageCheck = makeEngageCheck(world, T, idUV);
    let killedAt = -1, arrivedAt = -1;
    for (let i = 0; i < 3000; i++) {
      stepSight(world, T.sight, idUV, idW);
      engageCheck(sq);
      stepSquad(world, sq, world.dt);
      squadFire(world, sq, world.dt, T, idUV);
      stepWorld(world);
      if (killedAt < 0 && i === 120) { applyDamage(world, foe, 1e9, { attacker: "player" }); killedAt = i; }
      if (arrivedAt < 0 && sq.order === "defend") { arrivedAt = i; break; }
    }
    ok("VISION T4(b): killing the conscript by hand lets the squad resume and arrive",
      arrivedAt > killedAt && Math.abs(sq.anchor.z - 30) < 1.01, `arrived=${arrivedAt} anchor.z=${sq.anchor.z.toFixed(2)}`);
    ok("VISION T4(b): arrival flips the order to defend", sq.order === "defend");
  }

  // (c) MOVE stays silent the whole way — stop short of arrival (order
  // flips to defend on arrival and a defending squad rightly opens fire;
  // that's untouched, unrelated behavior, not what this ruling governs).
  {
    const { world, sq, T } = mkFixture("move");
    const engageCheck = makeEngageCheck(world, T, idUV);
    let muzzles = 0;
    for (let i = 0; i < 690; i++) {
      stepSight(world, T.sight, idUV, idW);
      engageCheck(sq);
      const before = world.projectiles.length;
      stepSquad(world, sq, world.dt);
      squadFire(world, sq, world.dt, T, idUV);
      if (world.projectiles.length > before) muzzles += world.projectiles.length - before;
      stepWorld(world);
    }
    ok("VISION T4(c): a MOVE squad stays silent the whole way", muzzles === 0, `muzzles=${muzzles}`);
    ok("VISION T4(c): (still travelling, not yet dug in — the silence is the road, not the halt)", sq.order === "move");
  }

  // (d) a SAPPER squad under ATTACK never halts for men.
  {
    const { world, foe, T } = mkFixture("attack");
    const sap = makeSquad(2, "sappers", 1, 0, 0);
    spawnSquadMembers(world, sap);
    sap.order = "attack"; sap.dest = { x: 0, z: 30 };
    const engageCheck = makeEngageCheck(world, T, idUV);
    stepSight(world, T.sight, idUV, idW);
    for (let i = 0; i < 30; i++) engageCheck(sap);
    ok("VISION T4(d): engageCheck never touches a sapper squad's pause, enemy in reach or not",
      !sap._pauseT, `_pauseT=${sap._pauseT}`);
  }

  // (e) dice stability: the halt draws nothing. Isolated from squadFire
  // (whose own scatter draws legitimately scale with how much a squad
  // fires, unrelated to this law) — stepSquad + engageCheck only, so the
  // ONLY rng site in play is stepSquad's one-per-leg dwell draw. With
  // enemy and without, old (no engageCheck) and new (with engageCheck)
  // draw identically: the halt adds zero draws, and the pre-existing
  // with/without-enemy offset (today's truth: threatened cover-hop legs
  // are shorter than double-time legs, so leg counts already differ) is
  // unchanged by adding it.
  {
    const drawsFor = (withEnemy, withHalt) => {
      const world = makeWorld({ field: flat, seed: 12 });
      world.dt = 1 / 60;
      const sq = makeSquad(1, "rifles", 1, 0, 0);
      spawnSquadMembers(world, sq);
      sq.order = "attack"; sq.dest = { x: 0, z: 30 };
      let foe = null;
      if (withEnemy) foe = addBody(world, { kind: "unit", team: 2, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x: 8, y: 0.86, z: 12, hp: 1e9 });
      const T = makeTerritory(29, 57);
      T.sight = makeSight(T);
      const engageCheck = makeEngageCheck(world, T, idUV);
      let draws = 0;
      const raw = world.rng;
      world.rng = () => { draws++; return raw(); };
      for (let i = 0; i < 6000; i++) {
        stepSight(world, T.sight, idUV, idW);
        if (withHalt) engageCheck(sq);
        stepSquad(world, sq, world.dt);
        stepWorld(world);
        if (i === 120 && foe) foe.alive = false; // release the engagement so movement resumes either way
        if (sq.order === "defend") break;
      }
      return draws;
    };
    const eOldNo = drawsFor(true, false), eOldYes = drawsFor(true, true);
    const noEOldNo = drawsFor(false, false), noEOldYes = drawsFor(false, true);
    ok("VISION T4(e): with an enemy on the path, the halt draws exactly what the leg machine already drew",
      eOldNo === eOldYes, `no-halt=${eOldNo} with-halt=${eOldYes}`);
    ok("VISION T4(e): with no enemy at all, the halt (a no-op scan) still draws nothing extra",
      noEOldNo === noEOldYes, `no-halt=${noEOldNo} with-halt=${noEOldYes}`);
  }
}
// ==== end VISION T4 ==========================================================

// ==== COMMAND T1: per-tower discipline =======================================
// mk0.80. stepTowers (DepotGame.jsx :365) starts reading b.discipline first,
// falling back to its own argument only when the field is absent (old saves,
// bare fixtures). stepTowers lives in DepotGame.jsx — JSX, not importable
// headlessly — so its gate is mirrored here, the same convention the fire
// discipline fixture above (and the VISION T4/scan mirrors) already use. The
// mirror below is written to match stepTowers's gate LINE FOR LINE; it is
// intentionally updated in lockstep with :414 in the same task (1.2), which
// is why (a) fails before 1.2 and passes after — see the report.
{
  const gunSpec = { kind: "gun", projSpeed: 58, occl: "arc", volley: 1, acc: 0.02, blastR: 0, kv: 1, dmg: 1, fireRate: 0.2 };
  const makeFixture = () => {
    const world = makeWorld({ field: { heightAt: () => 0, dirty: false }, seed: 1 });
    const tower = addBody(world, { kind: "tower", team: 1, mass: 0, hx: 0.8, hy: 1, hz: 0.8, x: 0, y: 1, z: 0, hp: 80 });
    addBody(world, { kind: "wall", team: 1, mass: 0, hx: 0.9, hy: 0.9, hz: 0.9, x: 8, y: 0.9, z: 0, hp: 70 });
    const target = addBody(world, { kind: "unit", team: 2, mass: 90, hx: 0.4, hy: 0.9, hz: 0.4, x: 16, y: 0.9, z: 0, hp: 30 });
    target.v = { x: 0, y: 0, z: 0 };
    return { world, tower, target };
  };
  // mirrors stepTowers's gate (DepotGame.jsx :414) — post-1.2:
  //   const disc = b.discipline || discipline || "careful";
  //   if (disc !== "free" && friendlyFouls(...)) hold; else fire.
  const runCadence = (towerDiscipline, fallbackDiscipline, spec, pulls = 5) => {
    const { world, tower, target } = makeFixture();
    if (towerDiscipline != null) tower.discipline = towerDiscipline;
    const muzzle = { x: tower.pos.x, y: tower.pos.y + tower.hy + 0.45, z: tower.pos.z };
    for (let i = 0; i < pulls; i++) {
      // mirrors stepTowers's gate (DepotGame.jsx :414) post-1.2 — the
      // fail-first probe (pre-1.2: `fallbackDiscipline || "careful"`, which
      // ignores b.discipline) is recorded in the task report.
      const disc = tower.discipline || fallbackDiscipline || "careful";
      if (disc === "free" || !friendlyFouls(world, muzzle, target.pos, spec)) {
        towerShot(world, tower, target, spec);
      }
    }
    return world.projectiles.length;
  };

  // (a) per-tower field wins: a "free" tower fires through the friendly wall
  // while a "careful" tower in the identical situation holds — proves the
  // field is read PER TOWER, not off one shared argument.
  ok("COMMAND T1(a): a tower with discipline \"free\" fires through the friendly wall",
    runCadence("free", "careful", gunSpec) > 0);
  ok("COMMAND T1(a): a tower with discipline \"careful\" holds in the same situation",
    runCadence("careful", "free", gunSpec) === 0);

  // (b) compatibility contract: no discipline field on the body — the
  // fallback argument (stepTowers's old parameter) decides, exactly as
  // before this task.
  ok("COMMAND T1(b): no discipline field + fallback \"free\" fires (old-argument behavior preserved)",
    runCadence(null, "free", gunSpec) > 0);
  ok("COMMAND T1(b): no discipline field + fallback \"careful\" holds (old-argument behavior preserved)",
    runCadence(null, "careful", gunSpec) === 0);

  // (c) save/resume round-trip: discipline is a plain string on the tower
  // body — save.js's generic per-body sweep (BODY_HANDLED doesn't list it)
  // carries it through serializeFront -> parseFront -> restoreBodies with no
  // special-case code anywhere in save.js.
  {
    const field = makeField(9, 2.0, 1);
    const world = makeWorld({ field, seed: 1 });
    addBody(world, { kind: "tower", team: 1, mass: 0, hx: 0.8, hy: 1, hz: 0.8, x: 0, y: 1, z: 0, hp: 80 }).discipline = "free";
    const T = makeTerritory(5, 5);
    const S = {
      bell: 0, resources: 0, score: { p: { kills: 0, value: 0 }, e: { kills: 0, value: 0 } }, spawnRR: 0, started: false, mode: "wall", sandbagOrient: 0,
      nextSquadId: 1, zoom: 1, focus: { x: 0, z: 0 }, depotCensusAcc: 0, depotStanding: 1, enemyStanding: 1,
      starvedStreak: 0, _reportedBreak: false, _reportedSpent: false,
      manifest: {}, foe: {}, intelUp: false, intelArmedAt: 0, lastDispatch: null,
      pendingPlan: null, intelPlan: null, ws: {}, reg: {}, squads: [],
    };
    const json = serializeFront({ S, world, T, town: [], census: [], census2: [], rocks: [], smears: [], mapSeed: 1, rngSeed: 1 });
    const parsed = parseFront(json);
    ok("COMMAND T1(c): the save round-trip parses back", parsed.ok, parsed.reason);
    const world2 = makeWorld({ field: makeField(9, 2.0, 1), seed: 1 });
    const bodies2 = parsed.ok ? restoreBodies(world2, parsed.data, []) : [];
    const tower2 = bodies2.find((b) => b.kind === "tower");
    ok("COMMAND T1(c): tower.discipline rides the save/resume round-trip",
      !!tower2 && tower2.discipline === "free", tower2 && tower2.discipline);
  }
}
// ==== end COMMAND T1 ==========================================================

// ==== COMMAND T2: the proposed line ==========================================
// mk0.84. Two-point build orders no longer fire on the second tap — they
// propose. The order machinery (consumeOrderTap's build branch, acceptLine,
// __DEPOTORDER__'s auto-accept) lives in DepotGame.jsx — JSX, not importable
// headlessly — so its shape is pinned by source regex, the same convention
// COMMAND T1 and mk0.60/6 already use. The ghost-piece filter is mirrored
// over a hand grid, the same convention VISION T4's scan mirrors use.
{
  const dsrc = fs.readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");
  // P7 T20: linePieces (and its cell-filter predicate) moved to
  // buildlines.js — the (e) pin below retargets there (sweep license,
  // unchanged content).
  const blSrcCmd2 = fs.readFileSync(new URL("../../src/depot/buildlines.js", import.meta.url), "utf8");

  // (a) the second tap PROPOSES: consumeOrderTap's build branch creates
  // S.linePending and never calls startBuildLine itself (only acceptLine
  // does, gated on accept — see (b)).
  const cotBody = (dsrc.match(/const consumeOrderTap = \(p\) => \{[\s\S]*?\n      const sellAt = \(gx, gz\) => \{/) || [""])[0];
  ok("COMMAND T2(a): consumeOrderTap's build branch creates S.linePending",
    /S\.linePending = \{ kind: om === "build_walls" \? "walls" : "bags", sq: osq\.id,/.test(cotBody));
  ok("COMMAND T2(a): consumeOrderTap itself never calls startBuildLine (only acceptLine does)",
    cotBody.length > 0 && !/startBuildLine\(/.test(cotBody));

  // (b) acceptLine: the only path that calls startBuildLine, and it nulls
  // S.selSquadId (the deselect the owner's rule requires on accept).
  const acceptBody = (dsrc.match(/const acceptLine = \(\) => \{[\s\S]*?\n      const rejectLine = \(\) => \{/) || [""])[0];
  ok("COMMAND T2(b): acceptLine exists and calls startBuildLine (re-taught mk1.50, P7 T20: startBuildLine's new-arity call)",
    /else startBuildLine\(grid, sq, lp\.kind, lp\.a, lp\.b, toast\);/.test(acceptBody));
  ok("COMMAND T2(b): acceptLine nulls S.selSquadId (full deselect on accept)",
    /S\.selSquadId = null; S\.orderMode = null; S\.buildPt0 = null;/.test(acceptBody));

  // (c) __DEPOTORDER__ auto-accepts — staging keeps driving the real order
  // path end to end without a screen to tap the confirm button on.
  const orderBody = (dsrc.match(/window\.__DEPOTORDER__ = \(id, kind, pts\) => \{[\s\S]*?\n      window\.__DEPOTFOCUS__ = \(x, z, zoom\) => \{/) || [""])[0];
  ok("COMMAND T2(c): __DEPOTORDER__ auto-accepts a proposed line (S.acceptLine())",
    /if \(S\.linePending\) \{ S\.linePending\.armedAt = world\.t; S\.acceptLine\(\); \}/.test(orderBody));
  // AUDIT FIX (mk0.85): the mk0.84 auto-accept no-opped — the pending's
  // armedAt was set THIS tick to world.t + PENDING_ARM_S, so acceptLine's
  // own pendingArmed(lp, world.t) gate always failed and silently swallowed
  // the accept. Staging has no trailing tap to guard against, so the fix
  // backdates the arm before accepting. Pinned directly, not just via (c)'s
  // re-pin above.
  ok("COMMAND T2(c) AUDIT FIX (mk0.85): __DEPOTORDER__ backdates armedAt before accepting a staged line",
    /S\.linePending\.armedAt = world\.t/.test(orderBody));

  // (d) the renderer overlay carries setLinePreview — the game-layer-only
  // furniture the brief said this file may grow (setReach's family).
  const rsrc = fs.readFileSync(new URL("../../src/render/renderer.js", import.meta.url), "utf8");
  ok("COMMAND T2(d): renderer.js overlay carries setLinePreview",
    /setLinePreview\(on, spec\) \{/.test(rsrc));

  // (e) mirror — linePieces's cell filter (DepotGame.jsx, inside the COMMAND
  // T2 block) skips exactly the cells layPieceAt would skip: blocked,
  // occupied, iced, unheld — so a gap in the preview is a gap in the wall.
  // Mirrored here over a hand grid, kept in lockstep with the source line:
  //   if (cell.blocked || cell.wallId || cell.ice || !canBuild(T, c0.u, c0.v)) continue; // an honest gap
  ok("COMMAND T2(e): the source predicate matches the mirror line-for-line (retargeted mk1.50, P7 T20: linePieces moved to buildlines.js)",
    /if \(cell\.blocked \|\| cell\.wallId \|\| cell\.ice \|\| !canBuild\(T, c0\.u, c0\.v\)\) continue; \/\/ an honest gap/.test(blSrcCmd2));
  {
    const handGrid = [
      { blocked: false, wallId: null, ice: false, held: true },   // laid
      { blocked: true, wallId: null, ice: false, held: true },    // gap: blocked
      { blocked: false, wallId: "w1", ice: false, held: true },   // gap: occupied (a wall stands there)
      { blocked: false, wallId: null, ice: true, held: true },    // gap: iced
      { blocked: false, wallId: null, ice: false, held: false },  // gap: unheld ground
      { blocked: false, wallId: null, ice: false, held: true },   // laid
    ];
    // mirror of: cell.blocked || cell.wallId || cell.ice || !canBuild(...)
    const isGap = (c) => !!(c.blocked || c.wallId || c.ice || !c.held);
    const laid = handGrid.filter((c) => !isGap(c));
    const gaps = handGrid.filter(isGap);
    ok("COMMAND T2(e) mirror: honest gaps land exactly on blocked/occupied/iced/unheld cells, nowhere else",
      laid.length === 2 && gaps.length === 4, `${laid.length} laid / ${gaps.length} gaps`);
  }
}
// ==== end COMMAND T2 ==========================================================

// ==== COMMAND T3: patrol ======================================================
// mk0.85. Two taps propose a route through Task 2's proposed-line confirm
// (kind "patrol": discs + dashed line, no ghost pieces — linePieces already
// returns [] for "patrol"). Accept and the squad walks A->B->A forever,
// fighting per the halt-and-fight rule (VISION T4, mk0.74). The order fields
// are set directly on the fixtures below — the tap interface (S.orderSquad,
// consumeOrderTap, acceptLine's patrol arm) is DepotGame.jsx game-layer code,
// already pinned by (f) and by Task 2's COMMAND T2 pins.
{
  const idUV = (x, z) => ({ u: x, v: z });
  const idW = (u, v) => ({ x: u, z: v });
  const flat = { heightAt: () => 0, dirty: false, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } };

  // (a) the loop is real: starting off the line, the squad is observed near
  // A, then later near B (it turned around), then later near A again —
  // three sampled epochs, order-independent of exact timing (watches for
  // the anchor crossing near-A/near-B thresholds in sequence, generous tick
  // budget) rather than predicting arrival ticks.
  {
    const world = makeWorld({ field: flat, seed: 5 });
    world.dt = 1 / 60;
    const sq = makeSquad(1, "rifles", 1, 0, 10);
    spawnSquadMembers(world, sq);
    sq.order = "patrol"; sq._patA = { x: 0, z: 0 }; sq._patB = { x: 0, z: 30 }; sq.dest = { x: 0, z: 0 };
    let sawA = false, sawB = false, sawA2 = false;
    for (let i = 0; i < 6000 && !sawA2; i++) {
      stepSquad(world, sq, world.dt);
      stepWorld(world);
      if (!sawA && sq.anchor.z < 2) sawA = true;
      else if (sawA && !sawB && sq.anchor.z > 25) sawB = true;
      else if (sawB && !sawA2 && sq.anchor.z < 2) sawA2 = true;
    }
    ok("COMMAND T3(a): the patrol reaches the near end (A)", sawA);
    ok("COMMAND T3(a): later it is observed near the far end (B) — it turned around", sawB);
    ok("COMMAND T3(a): later still it is back near A — the loop is real and endless", sawA2);
  }

  // (b) an enemy beside the patrol line gets fired on and the anchor holds
  // while he lives — halt-and-fight (VISION T4, mk0.74) applies to patrol.
  // Mirrors VISION T4(a)'s idiom exactly, order "patrol" in place of
  // "attack" — engageCheck (DepotGame.jsx, game-layer) is mirrored here,
  // updated for COMMAND T3's patrol gate (3.3); squadFire and stepSquad are
  // the real imports, already carrying the state.js/squads.js edits.
  const ENGAGE_CHECK_S = 0.2, ENGAGE_HOLD_S = 0.35;
  const makeEngageCheck = (world, T, invW) => (sq) => {
    if ((sq.order !== "attack" && sq.order !== "patrol") || sq.type === "sappers" || sq.type === "engineers") return;
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
      sq._pauseT = Math.max(sq._pauseT || 0, ENGAGE_HOLD_S);
      return;
    }
  };
  {
    const world = makeWorld({ field: flat, seed: 12 });
    world.dt = 1 / 60;
    const sq = makeSquad(1, "rifles", 1, 0, 0);
    spawnSquadMembers(world, sq);
    sq.order = "patrol"; sq._patA = { x: 0, z: 0 }; sq._patB = { x: 0, z: 30 }; sq.dest = { x: 0, z: 30 };
    addBody(world, { kind: "unit", team: 2, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x: 8, y: 0.86, z: 12, hp: 58 });
    const T = makeTerritory(29, 57);
    T.sight = makeSight(T);
    const engageCheck = makeEngageCheck(world, T, idUV);
    let muzzles = 0, anchorAt1s = null;
    for (let i = 0; i < 60; i++) {
      stepSight(world, T.sight, idUV, idW);
      engageCheck(sq);
      const before = world.projectiles.length;
      stepSquad(world, sq, world.dt);
      squadFire(world, sq, world.dt, T, idUV);
      if (world.projectiles.length > before) muzzles += world.projectiles.length - before;
      stepWorld(world);
      if (i === 59) anchorAt1s = sq.anchor.z;
    }
    ok("COMMAND T3(b): a patrol halts within a second of seeing an enemy in reach (anchor well short of the 3.2m unhalted march)",
      anchorAt1s < 1.0, `anchor.z=${anchorAt1s.toFixed(2)}`);
    ok("COMMAND T3(b): and fires on him (muzzle events)", muzzles > 0, `muzzles=${muzzles}`);
  }

  // (c) MOVE and BUILD squads still never fire — pinned unchanged.
  {
    const mkQuiet = (order) => {
      const world = makeWorld({ field: flat, seed: 3 });
      const sq = makeSquad(1, "rifles", 1, 0, 0);
      spawnSquadMembers(world, sq);
      sq.order = order; sq.dest = { x: 0, z: 30 };
      addBody(world, { kind: "unit", team: 2, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x: 2, y: 0.86, z: 0, hp: 58 });
      const T = makeTerritory(29, 57);
      T.sight = makeSight(T);
      stepSight(world, T.sight, idUV, idW);
      squadFire(world, sq, 1 / 60, T, idUV);
      return world.projectiles.length;
    };
    ok("COMMAND T3(c): a MOVE squad still never fires", mkQuiet("move") === 0);
    ok("COMMAND T3(c): a BUILD squad still never fires", mkQuiet("build") === 0);
  }

  // (d) dice law: patrol reuses attack's leg machine verbatim (squads.js
  // :543, unedited) — the same 30m double-time crossing draws the same
  // number of times whichever order carries it. Twin run: an ATTACK squad
  // and a PATROL squad crossing the identical A->B path, no enemies (so
  // both double-time straight at MOVE_SPEED, no threatened cover-hop, no
  // dwell) — draws land exactly at each 9m leg boundary (HOP_R*1.5) and
  // nowhere else; the final partial leg settles inside ARRIVE_TOL before any
  // ld<0.3 draw site is reached, so 30m draws exactly 3 times (9/18/27m).
  {
    const drawsFor = (order) => {
      const world = makeWorld({ field: flat, seed: 9 });
      world.dt = 1 / 60;
      const sq = makeSquad(1, "rifles", 1, 0, 0);
      spawnSquadMembers(world, sq);
      sq.order = order;
      if (order === "patrol") { sq._patA = { x: 0, z: 0 }; sq._patB = { x: 0, z: 30 }; }
      sq.dest = { x: 0, z: 30 };
      let draws = 0;
      const raw = world.rng;
      world.rng = () => { draws++; return raw(); };
      for (let i = 0; i < 6000; i++) {
        stepSquad(world, sq, world.dt);
        stepWorld(world);
        if (order === "attack" && sq.order === "defend") break;         // arrived, no turnaround
        if (order === "patrol" && Math.abs(sq.dest.z - 30) > 0.5) break; // turned around: A->B leg done
      }
      return draws;
    };
    const attackDraws = drawsFor("attack"), patrolDraws = drawsFor("patrol");
    ok("COMMAND T3(d): a patrol crossing the same ground draws exactly what an attack draws (shared leg machine, no extra rng)",
      attackDraws === patrolDraws && attackDraws > 0, `attack=${attackDraws} patrol=${patrolDraws}`);
    ok("COMMAND T3(d): and that count is exactly the number of legs (3 nine-metre hops over 30m; the final partial leg settles inside ARRIVE_TOL before any draw)",
      patrolDraws === 3, `patrol=${patrolDraws}`);
  }

  // (e) save/resume: a patrolling squad comes back patrolling — order, both
  // endpoints and the current destination all ride (plain scalars through
  // save.js's generic squad serializer, same convention COMMAND T1(c) pins
  // for tower.discipline).
  {
    const field = makeField(9, 2.0, 1);
    const world = makeWorld({ field, seed: 1 });
    const sq = makeSquad(1, "rifles", 1, 0, 5);
    spawnSquadMembers(world, sq);
    sq.order = "patrol"; sq._patA = { x: 0, z: 0 }; sq._patB = { x: 0, z: 30 }; sq.dest = { x: 0, z: 30 };
    const T = makeTerritory(5, 5);
    const S = {
      bell: 0, resources: 0, score: { p: { kills: 0, value: 0 }, e: { kills: 0, value: 0 } }, spawnRR: 0, started: false, mode: "wall", sandbagOrient: 0,
      nextSquadId: 2, zoom: 1, focus: { x: 0, z: 0 }, depotCensusAcc: 0, depotStanding: 1, enemyStanding: 1,
      starvedStreak: 0, _reportedBreak: false, _reportedSpent: false,
      manifest: {}, foe: {}, intelUp: false, intelArmedAt: 0, lastDispatch: null,
      pendingPlan: null, intelPlan: null, ws: {}, reg: {}, squads: [sq],
    };
    const json = serializeFront({ S, world, T, town: [], census: [], census2: [], rocks: [], smears: [], mapSeed: 1, rngSeed: 1 });
    const parsed = parseFront(json);
    ok("COMMAND T3(e): the save round-trip parses back", parsed.ok, parsed.reason);
    const world2 = makeWorld({ field: makeField(9, 2.0, 1), seed: 1 });
    const bodies2 = parsed.ok ? restoreBodies(world2, parsed.data, []) : [];
    const squads2 = parsed.ok ? restoreSquads(parsed.data, bodies2) : [];
    const sq2 = squads2[0];
    ok("COMMAND T3(e): a patrolling squad comes back patrolling",
      !!sq2 && sq2.order === "patrol", sq2 && sq2.order);
    ok("COMMAND T3(e): both endpoints ride the round-trip",
      !!sq2 && sq2._patA && sq2._patA.x === 0 && sq2._patA.z === 0 && sq2._patB && sq2._patB.x === 0 && sq2._patB.z === 30,
      sq2 && JSON.stringify([sq2._patA, sq2._patB]));
    ok("COMMAND T3(e): the current destination rides the round-trip",
      !!sq2 && sq2.dest && sq2.dest.x === 0 && sq2.dest.z === 30, sq2 && JSON.stringify(sq2.dest));
  }

  // (f) pin — acceptLine's patrol arm sets _patA/_patB/order/dest. Source
  // regex, the same convention COMMAND T2(a)/(b) use for this JSX-only file.
  {
    const dsrc = fs.readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");
    const acceptBody = (dsrc.match(/const acceptLine = \(\) => \{[\s\S]*?\n      const rejectLine = \(\) => \{/) || [""])[0];
    ok("COMMAND T3(f): acceptLine's patrol arm sets _patA, _patB, order and dest",
      /sq\._patA = \{ x: lp\.a\.x, z: lp\.a\.z \};/.test(acceptBody) &&
      /sq\._patB = \{ x: lp\.b\.x, z: lp\.b\.z \};/.test(acceptBody) &&
      /sq\.order = "patrol";/.test(acceptBody) &&
      /sq\.dest = \{ x: lp\.a\.x, z: lp\.a\.z \};/.test(acceptBody));
  }
}
// ==== end COMMAND T3 ==========================================================

// ==== COMMAND T4: attack structures ==========================================
// mk0.86. A pie toggle (STRUCTURES, armed types only — an INFANTRY_ARMS row,
// not engineers/sappers) sets squad.prefStruct: on, squadFire's structure
// scan runs FIRST with the man-scan as the automatic fallback when no
// structure is in reach; off, today's man-first order (structure scan still
// the automatic fallback, unchanged). The two scans are today's code, moved
// into named closures (state.js's squadFire: scanUnits/scanStructs) — sight
// gating (VISION, mk0.72) is unedited on both paths.
{
  const idUV = (x, z) => ({ u: x, v: z });
  const idW = (u, v) => ({ x: u, z: v });
  const flat = { heightAt: () => 0, dirty: false, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } };

  // fixture: a rifle squad (DEFEND, the default order) at the origin, an
  // enemy man 5m off on the +x bearing and an enemy wall 8m off on the
  // PERPENDICULAR +z bearing (no LOS overlap between the two candidate
  // targets), both well inside the rifle's 15m reach the moment sight comes
  // up.
  const mkFixture = (prefStruct, withWall = true) => {
    const world = makeWorld({ field: flat, seed: 21 });
    world.dt = 1 / 60;
    const sq = makeSquad(1, "rifles", 1, 0, 0);
    spawnSquadMembers(world, sq);
    sq.prefStruct = prefStruct;
    const man = addBody(world, { kind: "unit", team: 2, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x: 5, y: 0.86, z: 0, hp: 58 });
    let wall = null;
    if (withWall) {
      wall = addBody(world, {
        kind: "wall", team: 2, mass: 0, hx: WALL_HALF, hy: WALL_COURSE_HY, hz: WALL_THIN,
        x: 0, y: WALL_COURSE_HY, z: 8, hp: 100, friction: 0.65, restitution: 0.02,
      });
      wall.maxHp = wall.hp;
      wall.sleeping = true;
    }
    const T = makeTerritory(29, 29);
    T.sight = makeSight(T);
    return { world, sq, man, wall, T };
  };

  // (a) flag set, man AND wall both in sight/reach: the wall's hp drops
  // first (structure preferred).
  {
    const { world, sq, man, wall, T } = mkFixture(true, true);
    const manHp0 = man.hp, wallHp0 = wall.hp;
    let firstDrop = null;
    for (let i = 0; i < 600 && !firstDrop; i++) {
      stepSight(world, T.sight, idUV, idW);
      squadFire(world, sq, world.dt, T, idUV);
      stepWorld(world);
      if (wall.hp < wallHp0) firstDrop = "wall";
      else if (man.hp < manHp0) firstDrop = "man";
    }
    ok("COMMAND T4(a): STRUCTURES on — the wall's hp drops first",
      firstDrop === "wall", `first=${firstDrop} wall.hp=${wall.hp.toFixed(2)} man.hp=${man.hp}`);
    ok("COMMAND T4(a): the man is untouched while the wall is worked",
      man.hp === manHp0, `man.hp=${man.hp}`);
  }

  // (b) same fixture, flag off: the man dies first — today's priority,
  // pinned.
  {
    const { world, sq, man, wall, T } = mkFixture(false, true);
    const manHp0 = man.hp, wallHp0 = wall.hp;
    let firstDrop = null;
    for (let i = 0; i < 600 && !firstDrop; i++) {
      stepSight(world, T.sight, idUV, idW);
      squadFire(world, sq, world.dt, T, idUV);
      stepWorld(world);
      if (man.hp < manHp0) firstDrop = "man";
      else if (wall.hp < wallHp0) firstDrop = "wall";
    }
    ok("COMMAND T4(b): STRUCTURES off — the man's hp drops first (today's priority, pinned)",
      firstDrop === "man", `first=${firstDrop} wall.hp=${wall.hp} man.hp=${man.hp.toFixed(2)}`);
    ok("COMMAND T4(b): the wall is untouched while the man is worked",
      wall.hp === wallHp0, `wall.hp=${wall.hp}`);
  }

  // (c) the flag survives a save/resume — a plain boolean on the squad,
  // same convention COMMAND T1(c)/T3(e) pin for tower.discipline/patrol.
  {
    const field = makeField(9, 2.0, 1);
    const world = makeWorld({ field, seed: 1 });
    const sq = makeSquad(1, "rifles", 1, 0, 5);
    spawnSquadMembers(world, sq);
    sq.prefStruct = true;
    const T = makeTerritory(5, 5);
    const S = {
      bell: 0, resources: 0, score: { p: { kills: 0, value: 0 }, e: { kills: 0, value: 0 } }, spawnRR: 0, started: false, mode: "wall", sandbagOrient: 0,
      nextSquadId: 2, zoom: 1, focus: { x: 0, z: 0 }, depotCensusAcc: 0, depotStanding: 1, enemyStanding: 1,
      starvedStreak: 0, _reportedBreak: false, _reportedSpent: false,
      manifest: {}, foe: {}, intelUp: false, intelArmedAt: 0, lastDispatch: null,
      pendingPlan: null, intelPlan: null, ws: {}, reg: {}, squads: [sq],
    };
    const json = serializeFront({ S, world, T, town: [], census: [], census2: [], rocks: [], smears: [], mapSeed: 1, rngSeed: 1 });
    const parsed = parseFront(json);
    ok("COMMAND T4(c): the save round-trip parses back", parsed.ok, parsed.reason);
    const world2 = makeWorld({ field: makeField(9, 2.0, 1), seed: 1 });
    const bodies2 = parsed.ok ? restoreBodies(world2, parsed.data, []) : [];
    const squads2 = parsed.ok ? restoreSquads(parsed.data, bodies2) : [];
    const sq2 = squads2[0];
    ok("COMMAND T4(c): prefStruct rides the round-trip", !!sq2 && sq2.prefStruct === true, sq2 && sq2.prefStruct);
  }

  // (d) flag set, NO structure in reach: the squad still fights men — the
  // fallback is automatic, nobody stands idle.
  {
    const { world, sq, man, T } = mkFixture(true, false);
    const manHp0 = man.hp;
    let dropped = false;
    for (let i = 0; i < 600 && !dropped; i++) {
      stepSight(world, T.sight, idUV, idW);
      squadFire(world, sq, world.dt, T, idUV);
      stepWorld(world);
      if (man.hp < manHp0) dropped = true;
    }
    ok("COMMAND T4(d): STRUCTURES on but no structure in reach — the squad still fights the man (automatic fallback)",
      dropped, `man.hp=${man.hp}`);
  }
}
// ==== end COMMAND T4 ==========================================================

// ==== POSSESSION T1: take control — the possessed squad walks ================
// mk0.90 (Phase 4 Task 1). drivePossessedSquad (squads.js) walks a squad's
// anchor by the stick vector at MOVE_SPEED and reissues member formation
// goals every tick — no orders, no rng, no fire. The command loop
// (DepotGame.jsx stepDepot) skips a possessed squad entirely; RELEASE and
// the bell (ringBell) hand it back to standing orders. Possession itself
// never rides a save (S.possess is not read by serializeFront). DepotGame.jsx
// is JSX, not importable headlessly — its shape is pinned by source regex,
// the convention COMMAND T1-T4 already use.
{
  const flatField = { heightAt: () => 0, dirty: false, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } };
  const dsrc = fs.readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");

  // (a) mirror+pin: driving a squad straight for 2 sim-seconds moves the
  // anchor ~6.4m (MOVE_SPEED 3.2 * 2s), and every live member holds within
  // the formation ring (+tolerance) of it — the ring closes on the anchor
  // as it walks, exactly as DEFEND's own micro-slots do.
  {
    const world = makeWorld({ field: flatField, seed: 5 });
    const sq = makeSquad(1, "rifles", 1, 0, 0);
    spawnSquadMembers(world, sq);
    const dt = world.dt;
    const steps = Math.round(2 / dt);
    for (let i = 0; i < steps; i++) { drivePossessedSquad(world, sq, 0, 1, dt); stepWorld(world); }
    ok("POSSESSION T1(a): the anchor moves ~6.4m (MOVE_SPEED*2s) driving straight for 2 sim-seconds",
      Math.abs(sq.anchor.z - 6.4) < 0.1, `anchor=(${sq.anchor.x.toFixed(2)},${sq.anchor.z.toFixed(2)})`);
    let maxD = 0;
    for (const id of sq.memberIds) {
      const u = world.byId.get(id);
      const d = Math.hypot(u.pos.x - sq.anchor.x, u.pos.z - sq.anchor.z);
      if (d > maxD) maxD = d;
    }
    // 4.44m measured, cohesion-clamped (see squads.js's plan-deviation
    // comment on drivePossessedSquad): the trailing member's own top speed
    // equals the anchor's, so the rubber band (COHESION_M=6) is what bounds
    // him, not the 1.5m ring alone. Tolerance set above the measured value,
    // below the COHESION_M ceiling.
    ok("POSSESSION T1(a): every live member holds within the formation ring (+tolerance) of the walking anchor",
      maxD < 5.5, `maxD=${maxD.toFixed(2)}`);
  }

  // (a2) mk0.90 drift audit item B: the rubber-band clamp, actually
  // exercised over a longer drive (2s wasn't enough to show a runaway) —
  // sampled once per sim-second across a straight 6s drive, the rear
  // member's distance from the anchor must never exceed COHESION_M + 1.5m
  // (the cap itself, plus slack for the ring radius / catch-up lag). FAILS
  // against the plan's original UNCLAMPED drivePossessedSquad (Phase 4's
  // Step 1.2 code, verbatim — no rubber band, no cap, the anchor simply
  // never waits): verified by reverting squads.js's band+cap to that literal
  // code and re-running this assertion (the trail opens past COHESION_M+1.5m
  // inside the 6s window and keeps climbing), then re-applying the shipped
  // band+cap.
  {
    const world = makeWorld({ field: flatField, seed: 11 });
    const sq = makeSquad(1, "rifles", 1, 0, 0);
    spawnSquadMembers(world, sq);
    const dt = world.dt;
    const stepsPerSec = Math.round(1 / dt);
    let worstTrail = 0;
    const samples = [];
    for (let sec = 1; sec <= 6; sec++) {
      for (let i = 0; i < stepsPerSec; i++) { drivePossessedSquad(world, sq, 0, 1, dt); stepWorld(world); }
      let maxD = 0;
      for (const id of sq.memberIds) {
        const u = world.byId.get(id);
        const d = Math.hypot(u.pos.x - sq.anchor.x, u.pos.z - sq.anchor.z);
        if (d > maxD) maxD = d;
      }
      samples.push(maxD.toFixed(2));
      if (maxD > worstTrail) worstTrail = maxD;
    }
    ok("POSSESSION T1(a2) [mk0.90 audit item B]: the rear member never trails the anchor past COHESION_M+1.5m over a straight 6s drive",
      worstTrail < COHESION_M + 1.5, `worst=${worstTrail.toFixed(2)} samples/sec=[${samples.join(",")}]`);
  }

  // (b) source pin: stepDepot's squad loop skips a possessed squad entirely
  // (no engageCheck, no stepSquad, no squadFire — the stick drives it
  // instead) as the loop's FIRST line, and a squad whose members all die
  // while possessed releases automatically right after pruneSquads.
  {
    const stepDepotBody = (dsrc.match(/function stepDepot\(world, grid, onStructureLost, town, onRuin, T, discipline, S\) \{[\s\S]*?\n\}/) || [""])[0];
    const guardIdx = stepDepotBody.indexOf('if (S.possess && S.possess.kind === "squad" && sq.id === S.possess.id) {');
    const engageIdx = stepDepotBody.indexOf("engageCheck(sq);");
    ok("POSSESSION T1(b): stepDepot's squad loop carries a possession guard",
      guardIdx >= 0, stepDepotBody.length);
    ok("POSSESSION T1(b): the guard is the loop's first line — it runs before engageCheck",
      guardIdx >= 0 && engageIdx >= 0 && guardIdx < engageIdx, `guard=${guardIdx} engage=${engageIdx}`);
    const pruneIdx = stepDepotBody.indexOf("S.squads = pruneSquads(world, S.squads);");
    const autoRelIdx = stepDepotBody.indexOf('if (S.possess && S.possess.kind === "squad" && !S.squads.some((q) => q.id === S.possess.id)) S.releasePossession();');
    ok("POSSESSION T1(b): a wiped-out possessed squad auto-releases, wired right after pruneSquads",
      pruneIdx >= 0 && autoRelIdx >= 0 && autoRelIdx > pruneIdx && autoRelIdx - pruneIdx < 200,
      `prune=${pruneIdx} autoRel=${autoRelIdx}`);
  }

  // (c) possession never serializes: S.possess is not part of serializeFront's
  // whitelisted run{} fields, and a save taken with possession live carries
  // no "possess" key anywhere in its JSON.
  {
    const field = makeField(9, 2.0, 1);
    const world = makeWorld({ field, seed: 1 });
    const T = makeTerritory(5, 5);
    const S = {
      bell: 0, resources: 0, score: { p: { kills: 0, value: 0 }, e: { kills: 0, value: 0 } }, spawnRR: 0, started: false, mode: "wall", sandbagOrient: 0,
      nextSquadId: 1, zoom: 1, focus: { x: 0, z: 0 }, depotCensusAcc: 0, depotStanding: 1, enemyStanding: 1,
      starvedStreak: 0, _reportedBreak: false, _reportedSpent: false,
      manifest: {}, foe: {}, intelUp: false, intelArmedAt: 0, lastDispatch: null,
      pendingPlan: null, intelPlan: null, ws: {}, reg: {}, squads: [],
      possess: { kind: "squad", id: 1 }, possessInput: { vx: 0, vz: 1 }, // live at save time
    };
    const json = serializeFront({ S, world, T, town: [], census: [], census2: [], rocks: [], smears: [], mapSeed: 1, rngSeed: 1 });
    ok("POSSESSION T1(c): serializeFront never writes a \"possess\" key anywhere in the saved JSON",
      !json.includes("possess"), json.includes("possess") ? "LEAKED" : "clean");
    const dsaveSrc = fs.readFileSync(new URL("../../src/depot/save.js", import.meta.url), "utf8");
    ok("POSSESSION T1(c) source pin: save.js's run{} writer never reads S.possess",
      !/S\.possess/.test(dsaveSrc));
  }

  // (d) source pin, REVERSED by the owner's mk0.93 playtest ruling (T5,
  // mk0.94): the bell no longer releases possession — you keep the unit
  // through the round change. The save it writes still carries no
  // possession: T1(c) above proves that with a live possession at save time.
  {
    // retargeted mk1.51, P7 T21: ringBell moved to bell.js — the body is
    // read off its new home, and the save call re-teaches to ctx.saveFront().
    const bellSrcT1d = fs.readFileSync(new URL("../../src/depot/bell.js", import.meta.url), "utf8");
    const ringBellBody = (bellSrcT1d.match(/export function ringBell\(world, grid, field, T, S, ctx\) \{[\s\S]*?\n\}/) || [""])[0];
    ok("POSSESSION T1(d): ringBell no longer releases possession — the bell keeps your hands on the unit",
      ringBellBody.length > 0 && !ringBellBody.includes("releasePossession"), ringBellBody.slice(0, 80));
    ok("POSSESSION T1(d): the bell still writes the save",
      ringBellBody.includes("ctx.saveFront();"));
  }

  // (e) zero new rng draws while driving: player input is not a replayed
  // stream — the drive path itself never touches world.rng, with or without
  // an enemy standing nearby.
  {
    const dt = 1 / 120;
    const steps = Math.round(2 / dt);
    const drive = (withEnemy) => {
      const world = makeWorld({ field: flatField, seed: 7 });
      const sq = makeSquad(1, "rifles", 1, 0, 0);
      spawnSquadMembers(world, sq);
      if (withEnemy) addBody(world, { kind: "unit", team: 2, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x: 5, y: 0.88, z: 5, hp: 58 });
      let draws = 0;
      const raw = world.rng;
      world.rng = () => { draws++; return raw(); };
      for (let i = 0; i < steps; i++) drivePossessedSquad(world, sq, 0, 1, dt);
      return draws;
    };
    const drawsNoEnemy = drive(false), drawsWithEnemy = drive(true);
    ok("POSSESSION T1(e): drivePossessedSquad draws ZERO rng, with or without an enemy nearby, and the counts match",
      drawsNoEnemy === 0 && drawsWithEnemy === 0, `noEnemy=${drawsNoEnemy} withEnemy=${drawsWithEnemy}`);
  }
}
// ==== end POSSESSION T1 =======================================================

// ==== POSSESSION T2: the trigger — volley at the aim =========================
// mk0.91 (Phase 4 Task 2). possessedVolley (state.js) is one trigger pull:
// every living armed member off cooldown fires once at a synthetic ground
// target through shooterFire, exactly like squadFire's own trigger pull —
// same scatter/lead/wind, same sight law (fieldReaches at the aim cell).
// Spotters (and any type with no INFANTRY_ARMS row — engineers, sappers)
// never fire.
{
  const flatField = { heightAt: () => 0, dirty: false, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } };
  const idUV = (x, z) => ({ u: x, v: z }); // DepotGame's invW at ORIENT 0
  const muzzlesOf = (world) => world.events.filter((e) => e.type === "muzzle");

  // (a) mirror+pin: a 4-man rifle squad volleys once each at an aim 10m off.
  // RE-PINNED (T7, mk0.97, 4 -> 3): the ring's rear-most man (i=2, diametrically
  // opposite i=0 on this exact aim axis) now stands in i=0's corridor —
  // the new mate-hold discipline holds his shot. Deterministic geometry, no
  // rng; verified by hand (mateBlocks's own t/dist formula against the ring's
  // fixed spawn positions), not guessed.
  {
    const world = makeWorld({ field: flatField, seed: 21 });
    const sq = makeSquad(1, "rifles", 1, 0, 0);
    spawnSquadMembers(world, sq);
    world.events.length = 0;
    const fired = possessedVolley(world, sq, { x: 10, z: 0 }, null);
    const muzzles = muzzlesOf(world);
    ok("POSSESSION T2(a): possessedVolley fires one shooterFire per living armed member at the aim (3 of 4 — the 4th is corridor-held, T7)",
      fired === 3 && muzzles.length === 3, `fired=${fired} muzzles=${muzzles.length}`);
    ok("POSSESSION T2(a): every muzzle carries weapon:\"rifle\"",
      muzzles.every((m) => m.weapon === "rifle"), muzzles.map((m) => m.weapon).join(","));
  }

  // (b) the sight law holds: an aim in a cell team 1 does not see draws zero
  // muzzles; the identical aim in a cell it does see fires normally (the
  // control). Sight map hand-stamped (lit only west of x=8), same convention
  // reachPolygon's own sight-boundary test uses.
  {
    const world = makeWorld({ field: flatField, seed: 22 });
    const sq = makeSquad(1, "rifles", 1, 0, 0);
    spawnSquadMembers(world, sq);
    const T = makeTerritory(29, 57);
    T.sight = makeSight(T);
    for (let iz = 0; iz < T.sight.nz; iz++) for (let ix = 0; ix < T.sight.nx; ix++) {
      const u = -T.sight.halfU + (ix + 0.5) * T.sight.cs;
      if (u < 8) T.sight.seen1[iz * T.sight.nx + ix] = 1;
    }
    world.events.length = 0;
    const firedDark = possessedVolley(world, sq, { x: 20, z: 0 }, T, idUV);
    ok("POSSESSION T2(b): a dark aim cell (unseen) draws zero muzzles",
      firedDark === 0 && muzzlesOf(world).length === 0, `fired=${firedDark}`);
    world.events.length = 0;
    const firedLit = possessedVolley(world, sq, { x: 0, z: 0 }, T, idUV);
    ok("POSSESSION T2(b) control: the identical squad, aim in a SEEN cell, fires normally",
      firedLit === 4, `fired=${firedLit}`);
  }

  // (c) spotters and unarmed types never fire: a sniper pair volleys once
  // (the spotter never pulls a trigger), and an engineer squad — no
  // INFANTRY_ARMS row — refuses outright.
  {
    const world = makeWorld({ field: flatField, seed: 23 });
    const sniperSq = makeSquad(1, "sniper", 1, 0, 0);
    spawnSquadMembers(world, sniperSq);
    world.events.length = 0;
    const firedSniper = possessedVolley(world, sniperSq, { x: 10, z: 0 }, null);
    const muzzlesSniper = muzzlesOf(world);
    ok("POSSESSION T2(c): a sniper pair volleys ONCE, not twice — the spotter never fires",
      firedSniper === 1 && muzzlesSniper.length === 1, `fired=${firedSniper} muzzles=${muzzlesSniper.length}`);
    ok("POSSESSION T2(c): the one muzzle is the sniper's (weapon:\"sniper\")",
      !!muzzlesSniper[0] && muzzlesSniper[0].weapon === "sniper");

    const engSq = makeSquad(2, "engineers", 1, 0, 0);
    spawnSquadMembers(world, engSq);
    world.events.length = 0;
    const firedEng = possessedVolley(world, engSq, { x: 10, z: 0 }, null);
    ok("POSSESSION T2(c): engineers carry no INFANTRY_ARMS row — the volley refuses, zero muzzles",
      firedEng === 0 && muzzlesOf(world).length === 0, `fired=${firedEng}`);
  }

  // (d) per-member cooldowns are honored: a second pull 0.1s later (the
  // game layer's own decay, u.fireCd -= dt, mirrored here) finds every man
  // still on cooldown — zero muzzles.
  // RE-PINNED (T7, mk0.97, fired1 4 -> 3): same corridor hold as T2(a) —
  // the geometry is identical (same aim, same spawn ring).
  {
    const world = makeWorld({ field: flatField, seed: 24 });
    const sq = makeSquad(1, "rifles", 1, 0, 0);
    spawnSquadMembers(world, sq);
    world.events.length = 0;
    const fired1 = possessedVolley(world, sq, { x: 10, z: 0 }, null);
    for (const id of sq.memberIds) { const u = world.byId.get(id); u.fireCd -= 0.1; }
    world.events.length = 0;
    const fired2 = possessedVolley(world, sq, { x: 10, z: 0 }, null);
    ok("POSSESSION T2(d): per-member cooldowns are honored — 0.1s after a full volley (fireRate 1.3s), nobody is off cooldown yet (3 of 4 fired — the 4th is corridor-held, T7)",
      fired1 === 3 && fired2 === 0, `fired1=${fired1} fired2=${fired2}`);
  }

  // (e) source pin: possessedVolley reads INFANTRY_ARMS[squad.type] and
  // shares squadFire's own blast fallbacks verbatim (INFANTRY_BLAST_R/
  // INFANTRY_KV), not a re-derived pair of numbers.
  {
    const stateSrc = fs.readFileSync(new URL("../../src/depot/state.js", import.meta.url), "utf8");
    const volleyBody = (stateSrc.match(/export function possessedVolley\([\s\S]*?\n\}/) || [""])[0];
    ok("POSSESSION T2(e) source pin: possessedVolley reads INFANTRY_ARMS[squad.type]",
      /const spec = INFANTRY_ARMS\[squad\.type\];/.test(volleyBody), volleyBody.length);
    ok("POSSESSION T2(e) source pin: possessedVolley shares squadFire's own blast fallbacks (INFANTRY_BLAST_R/INFANTRY_KV)",
      /blastR: spec\.blastR != null \? spec\.blastR : INFANTRY_BLAST_R/.test(volleyBody) &&
      /kv: spec\.kv != null \? spec\.kv : INFANTRY_KV/.test(volleyBody));
  }

  // mk0.91 audit item A (possession hygiene, drift audit), re-pinned
  // POSSESSION T4 (mk0.93): a stale FIRE flag stuck by a mid-hold bell
  // release can never carry into the next possession — S.takeControl and
  // S.releasePossession both clear it (S.fireHeld = false). possessAim is
  // gone; in its place S.takeControl freshly SEEDS S.reticle (inside the
  // unit's own sight circle) instead of merely nulling it, and
  // S.releasePossession clears it outright (S.reticle = null).
  {
    const gameSrc = fs.readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");
    const takeControlBody = (gameSrc.match(/S\.takeControl = \(\) => \{[\s\S]*?\n      \};/) || [""])[0];
    const releaseBody = (gameSrc.match(/S\.releasePossession = \(\) => \{[\s\S]*?\n      \};/) || [""])[0];
    ok("POSSESSION T4 audit item A source pin (re-pinned from T2): S.takeControl clears fireHeld and seeds a fresh offset reticle",
      /S\.fireHeld = false;/.test(takeControlBody) && /S\.reticleOff = pc0 \? reclampReticle\(T\.sight, 1, pc0, possessSightR\(\), \{ dx: 0, dz: 4 \}, invW\) : null;/.test(takeControlBody),
      takeControlBody.length);
    ok("POSSESSION T4 audit item A source pin (re-pinned from T2): S.releasePossession clears reticle/offset/fireHeld",
      /S\.reticle = null; S\.reticleOff = null; S\.fireHeld = false;/.test(releaseBody), releaseBody.length);
  }
}
// ==== end POSSESSION T2 =======================================================

// ==== POSSESSION T3: manual fire control — the possessed tower =============
// mk0.92 (Phase 4 Task 3). possessedTowerFire (state.js) is one trigger pull
// on the tower's own real spec/cooldown/muzzle, at the owner's aim — through
// towerShot, exactly like the tower's own auto-fire. Sight-gated at the aim
// cell. stepTowers (DepotGame.jsx) gains a possession guard that skips
// acquisition/fire outright for the possessed body; DepotGame.jsx is JSX and
// cannot be imported headlessly, so (a)/(e) are source pins / mirrors — the
// same convention COMMAND T1 and VISION T2(a)'s tower fixtures already use.
{
  const flatField = { heightAt: () => 0, dirty: false, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } };
  const idUV = (x, z) => ({ u: x, v: z });
  const idW = (u, v) => ({ x: u, z: v });
  const muzzlesOf = (world) => world.events.filter((e) => e.type === "muzzle");
  const makeTower = (world, type = "gun") => {
    const spec = TOWER_SPECS[type];
    const b = addBody(world, { kind: "tower", team: 1, mass: 0, hx: 0.8, hy: spec.hy, hz: 0.8, x: 0, y: 1 + spec.hy, z: 0, hp: spec.hp });
    b.towerType = type;
    return b;
  };

  // (a) source pin: stepTowers takes a possessedId argument and its guard —
  // the loop's first body line after the kind/alive filter — skips straight
  // past the possessed tower, no acquisition, no fire.
  {
    const gameSrc = fs.readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");
    const stepTowersBody = (gameSrc.match(/export function stepTowers\([\s\S]*?\n\}/) || [""])[0];
    ok("POSSESSION T3(a) source pin: stepTowers takes a possessedId argument",
      /export function stepTowers\(world, T, discipline, possessedId\)/.test(gameSrc));
    ok("POSSESSION T3(a) source pin: the guard skips the possessed body — no acquisition, no fire",
      /if \(possessedId === b\.id\) \{ b\.fireCd = \(b\.fireCd \|\| 0\) - dt; continue; \}/.test(stepTowersBody), stepTowersBody.length);
  }

  // (b) mirror+pin: a gun tower fires its real spec at the aim, honoring its
  // own cooldown — a second pull 0.1s later (fireRate 1.05s) finds it cold.
  {
    const world = makeWorld({ field: flatField, seed: 31 });
    const tower = makeTower(world, "gun");
    world.events.length = 0;
    const fired1 = possessedTowerFire(world, tower, { x: 10, z: 0 }, null);
    const muzzles1 = muzzlesOf(world);
    ok("POSSESSION T3(b): possessedTowerFire fires the tower's real spec at the aim",
      fired1 === true && muzzles1.length === 1, `fired=${fired1} muzzles=${muzzles1.length}`);
    ok("POSSESSION T3(b): the muzzle carries weapon:\"shell\" (TOWER_SPECS.gun)",
      !!muzzles1[0] && muzzles1[0].weapon === "shell", muzzles1[0] && muzzles1[0].weapon);
    tower.fireCd -= 0.1;
    world.events.length = 0;
    const fired2 = possessedTowerFire(world, tower, { x: 10, z: 0 }, null);
    ok("POSSESSION T3(b): a second pull 0.1s later (fireRate 1.05s) is refused — the cooldown holds",
      fired2 === false && muzzlesOf(world).length === 0, `fired2=${fired2}`);
  }

  // (c) the sight law holds at the aim cell: a dark cell refuses outright;
  // the identical aim in a seen cell fires normally (the control).
  {
    const world = makeWorld({ field: flatField, seed: 32 });
    const tower = makeTower(world, "gun");
    const T = makeTerritory(29, 57);
    T.sight = makeSight(T);
    for (let iz = 0; iz < T.sight.nz; iz++) for (let ix = 0; ix < T.sight.nx; ix++) {
      const u = -T.sight.halfU + (ix + 0.5) * T.sight.cs;
      if (u < 8) T.sight.seen1[iz * T.sight.nx + ix] = 1;
    }
    world.events.length = 0;
    const firedDark = possessedTowerFire(world, tower, { x: 20, z: 0 }, T, idUV);
    ok("POSSESSION T3(c): a dark aim cell (unseen) refuses — zero muzzles",
      firedDark === false && muzzlesOf(world).length === 0, `fired=${firedDark}`);
    world.events.length = 0;
    const firedLit = possessedTowerFire(world, tower, { x: 0, z: 0 }, T, idUV);
    ok("POSSESSION T3(c) control: the identical tower, aim in a SEEN cell, fires normally",
      firedLit === true && muzzlesOf(world).length === 1, `fired=${firedLit}`);
  }

  // (d) source pin: frost offers no possession — the tower pie's possess
  // wedge is gated on canPossess, itself gated on spec.fireRate > 0 (frost's
  // is 0 — no gun to man).
  {
    const gameSrc = fs.readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");
    ok("POSSESSION T3(d) source pin: the tower radial's canPossess field gates on spec.fireRate > 0",
      /canPossess: ispec\.fireRate > 0/.test(gameSrc));
    ok("POSSESSION T3(d) source pin: the possess wedge only pushes when canPossess",
      /if \(tr\.canPossess\) \{[\s\S]{0,200}key: "possess"/.test(gameSrc));
  }

  // (e) release restores auto-fire: stepTowers' own guard + scan/acquire
  // loop, mirrored (JSX, not importable headlessly — the same convention
  // VISION T2(a)'s tower fixture uses), the guard LINE FOR LINE the one
  // pinned in (a). While possessed the guard skips acquisition outright;
  // released, the very next scan acquires the enemy in range exactly as an
  // unpossessed tower would.
  {
    const spec = TOWER_SPECS.gun;
    const world = makeWorld({ field: flatField, seed: 33 });
    const tower = makeTower(world, "gun");
    const foe = addBody(world, { kind: "unit", team: 2, mass: 80, hx: 0.3, hy: 0.9, hz: 0.3, x: 10, y: 0.9, z: 0, hp: 40 });
    const T = makeTerritory(29, 57);
    T.sight = makeSight(T);
    stepSight(world, T.sight, idUV, idW);
    const scan = (possessedId) => {
      // mirrors stepTowers' guard (DepotGame.jsx, pinned above) + scan loop
      // (:365-410) — possessedId set skips acquisition entirely, same as
      // the real function.
      if (possessedId === tower.id) return tower.targetId || null;
      const muzzle = { x: tower.pos.x, y: tower.pos.y + tower.hy + 0.45, z: tower.pos.z };
      const eR = effRange(world, muzzle, spec);
      let best = null, bd = eR * eR;
      for (const e of world.bodies) {
        if ((e.kind !== "unit" && e.kind !== "vehicle") || !e.alive || e.team !== 2) continue;
        const c = idUV(e.pos.x, e.pos.z);
        if (!fieldReaches(T, c.u, c.v, 1)) continue;
        const dx = e.pos.x - tower.pos.x, dz = e.pos.z - tower.pos.z, d2 = dx * dx + dz * dz;
        if (d2 < bd && arcClears(world, muzzle, e.pos, spec, tower.id)) { bd = d2; best = e; }
      }
      tower.targetId = best ? best.id : tower.targetId;
      return best ? best.id : null;
    };
    ok("POSSESSION T3(e): possessed, the tower does not acquire even with the enemy in range",
      scan(tower.id) == null, `target=${scan(tower.id)}`);
    ok("POSSESSION T3(e): released, the very next scan acquires the enemy",
      scan(undefined) === foe.id, `target=${scan(undefined)}`);
  }
}
// ==== end POSSESSION T3 =======================================================

// ==== POSSESSION T4: the steered reticle ====================================
// mk0.93 (Phase 4 Task 4, amendment). steerReticle/reclampReticle (sight.js)
// are pure, zero-rng ground-point helpers: the reticle moves at
// RETICLE_SPEED per second of stick tilt, bounded to the possessed unit's
// own sight circle on ground the side currently sees — dark ground stops it
// dead (steer) or drags it home to the circle's center (reclamp, the walk-
// drag path). possessAim is gone; both fire paths and the steer/reclamp
// wiring in DepotGame.jsx are pinned by source regex (JSX, not importable
// headlessly — the same convention T1-T3 already use).
{
  const idUV = (x, z) => ({ u: x, v: z }); // DepotGame's invW at ORIENT 0
  const litTerritory = () => {
    const T = makeTerritory(29, 57);
    T.sight = makeSight(T);
    T.sight.seen1.fill(1);
    return T;
  };
  const bandTerritory = (loU, hiU) => {
    const T = makeTerritory(29, 57);
    T.sight = makeSight(T);
    for (let iz = 0; iz < T.sight.nz; iz++) for (let ix = 0; ix < T.sight.nx; ix++) {
      const u = -T.sight.halfU + (ix + 0.5) * T.sight.cs;
      if (u >= loU && u <= hiU) T.sight.seen1[iz * T.sight.nx + ix] = 1;
    }
    return T;
  };

  // (a) mirror+pin: steerReticle moves the reticle at RETICLE_SPEED per
  // second of stick tilt — a flat, fully-lit sight map, 1s at full tilt.
  {
    const T = litTerritory();
    const r = steerReticle(T.sight, 1, { x: 0, z: 0 }, 50, { dx: 0, dz: 0 }, 0, 1, 1, idUV);
    ok("POSSESSION T4(a): steerReticle moves the offset RETICLE_SPEED (14) m in 1s at full tilt",
      RETICLE_SPEED === 14 && Math.abs(r.dx - 0) < 0.01 && Math.abs(r.dz - 14) < 0.01,
      `r=(${(r.dx ?? NaN).toFixed(2)},${(r.dz ?? NaN).toFixed(2)})`);
  }

  // (b) the sight-circle clamp holds: steering hard away for 3s from a 24m
  // radius, the reticle sits ON the circle, never past it.
  {
    const T = litTerritory();
    const center = { x: 0, z: 0 }, radius = 24;
    let cur = { dx: 0, dz: 0 };
    let worstD = 0;
    for (let i = 0; i < 30; i++) {
      cur = steerReticle(T.sight, 1, center, radius, cur, 1, 0, 0.1, idUV);
      const d = Math.hypot(cur.dx ?? NaN, cur.dz ?? NaN);
      if (d > worstD) worstD = d;
    }
    const finalD = Math.hypot(cur.dx ?? NaN, cur.dz ?? NaN);
    ok("POSSESSION T4(b): steering hard away for 3s never carries the reticle past the 24m sight circle",
      worstD <= radius + 1e-6, `worstD=${worstD.toFixed(4)}`);
    ok("POSSESSION T4(b): the reticle sits ON the circle at the end of the 3s steer",
      Math.abs(finalD - radius) < 0.01, `finalD=${finalD.toFixed(4)}`);
  }

  // (c) an unseen cell stops the reticle dead: hand-lit sight map, lit only
  // west of u=8 — steering east into the dark band leaves the reticle at its
  // last (lit) position, unchanged.
  {
    const T = bandTerritory(-29, 8);
    const cur = { dx: 0, dz: 0 };
    const r = steerReticle(T.sight, 1, { x: 0, z: 0 }, 50, cur, 1, 0, 1, idUV);
    ok("POSSESSION T4(c): steering into an unseen cell leaves the reticle exactly where it was",
      r.dx === cur.dx && r.dz === cur.dz, `r=(${r.dx},${r.dz})`);
  }

  // (d) the carry law (T5, mk0.94, replacing the old drag-behind test): the
  // reticle is an OFFSET from the unit — a lit, in-circle offset survives
  // the walk unchanged (the reticle is carried), and an oversized one is
  // pulled to the circle's edge, direction kept.
  {
    const T = litTerritory();
    const off = reclampReticle(T.sight, 1, { x: 20, z: 0 }, 10, { dx: 0, dz: 8 }, idUV);
    ok("POSSESSION T4(d): a lit, in-circle offset survives the walk unchanged — the reticle is carried",
      Math.abs(off.dx - 0) < 0.01 && Math.abs(off.dz - 8) < 0.01, `off=(${(off.dx ?? NaN).toFixed(2)},${(off.dz ?? NaN).toFixed(2)})`);
    // (center at the origin: a center of x=20 would put the clamped point at
    // u=30, off the 29-wide sight map — out-of-bounds reads as dark and the
    // offset would fall home, testing the map edge instead of the clamp)
    const far = reclampReticle(T.sight, 1, { x: 0, z: 0 }, 10, { dx: 25, dz: 0 }, idUV);
    ok("POSSESSION T4(d): an oversized offset is pulled to the circle's edge, direction kept",
      Math.abs(far.dx - 10) < 0.01 && Math.abs(far.dz - 0) < 0.01, `far=(${(far.dx ?? NaN).toFixed(2)},${(far.dz ?? NaN).toFixed(2)})`);
  }

  // (e) stranded-on-dark falls back to the center: the reclamped point on
  // the circle's edge lands in the dark, so reclampReticle falls all the way
  // home to the unit's own cell (lit only in a narrow band around the
  // center — the unit's own eye lights it).
  {
    const T = bandTerritory(-2, 2);
    const r = reclampReticle(T.sight, 1, { x: 0, z: 0 }, 10, { dx: 50, dz: 0 }, idUV);
    ok("POSSESSION T4(e): a reclamp that would land on dark ground falls all the way back to the unit",
      r.dx === 0 && r.dz === 0, `r=(${r.dx},${r.dz})`);
  }

  // (f) source pin: both fire paths read S.reticle, and possessAim appears
  // nowhere in DepotGame.jsx — it is fully replaced by the steered reticle.
  {
    const gameSrc = fs.readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");
    ok("POSSESSION T4(f) source pin: the squad volley trigger reads S.reticle",
      /possessedVolley\(world, psq, S\.reticle, T, invW\)/.test(gameSrc));
    ok("POSSESSION T4(f) source pin: the tower fire trigger reads S.reticle",
      /possessedTowerFire\(world, ptw, S\.reticle, T, invW\)/.test(gameSrc));
    ok("POSSESSION T4(f) source pin: possessAim appears nowhere in DepotGame.jsx",
      !/possessAim/.test(gameSrc));
  }

  // (g) source pin: the right-stick steer runs through steerReticle and the
  // walk-drag through reclampReticle — no second, hand-rolled clamp.
  {
    const gameSrc = fs.readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");
    ok("POSSESSION T4(g) source pin: DepotGame.jsx imports steerReticle/reclampReticle from sight.js",
      /import \{[^}]*steerReticle[^}]*reclampReticle[^}]*\} from "\.\/sight\.js"/.test(gameSrc) ||
      /import \{[^}]*reclampReticle[^}]*steerReticle[^}]*\} from "\.\/sight\.js"/.test(gameSrc));
    ok("POSSESSION T4(g) source pin: the frame loop steers the OFFSET through steerReticle",
      /S\.reticleOff = steerReticle\(T\.sight, 1, rc, rR, S\.reticleOff, rv\.vx, rv\.vz, dt, invW\);/.test(gameSrc));
    ok("POSSESSION T4(g) source pin: the walk-carry runs through reclampReticle and derives the world point",
      /S\.reticleOff = reclampReticle\(T\.sight, 1, rc, rR, S\.reticleOff, invW\);/.test(gameSrc) &&
      /S\.reticle = \{ x: rc\.x \+ S\.reticleOff\.dx, z: rc\.z \+ S\.reticleOff\.dz \};/.test(gameSrc));
  }
}
// ==== end POSSESSION T4 =======================================================

// ==== POSSESSION T5: the red carried reticle, the bell keeps your hands =====
// mk0.94 (Phase 4 Task 5, playtest amendment). The reticle is an offset from
// the unit — walking carries it — and draws as its own red ring, not the
// build ghost's square. The bell no longer ends possession (reversal pinned
// in T1(d) above). JSX/renderer wiring pinned by source regex, T1-T3's own
// convention.
{
  const gameSrc = fs.readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");
  const rendSrc = fs.readFileSync(new URL("../../src/render/renderer.js", import.meta.url), "utf8");
  ok("POSSESSION T5(a) source pin (re-taught mk2.01): the renderer owns a setReticle overlay drawn in crimson, solid",
    /setReticle\(on, x, z, y, r, hit, pts\)/.test(rendSrc) && /0xf0143c/.test(String(rendSrc.match(/setReticle\(on, x, z, y, r, hit, pts\) \{[\s\S]*?\n    \},/) || "")));
  ok("possessed frames never paint the build hover (re-pinned mk1.12 — the old pin was a character-distance accident)",
    /R\.overlay\.setReticle\(/.test(gameSrc) && /if \(!S\.possess && S\.hover\)/.test(gameSrc));
  ok("POSSESSION T5(c) source pin: the build hover never paints while possessed",
    /!S\.possess && S\.hover/.test(gameSrc));
}
// ==== end POSSESSION T5 =====================================================

// ==== WIND TOGGLE (mk0.95) ==================================================
// The owner's accuracy-tuning switch: WIND OFF must mean dead calm through
// the ONE world.wind assignment every shooter reads — not a second wind
// source somewhere. Source pins (JSX, T1-T3's convention).
{
  const gameSrc = fs.readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");
  ok("WIND TOGGLE source pin: stepDepot's one wind assignment is gated by S.windOn",
    /world\.wind = S\.windOn === false \? \{ x: 0, z: 0, mag: 0 \} : windAt\(MAP_SEED, world\.t\);/.test(gameSrc));
  ok("WIND TOGGLE source pin: no other stepDepot-path windAt assignment exists",
    (gameSrc.match(/world\.wind = windAt/g) || []).length === 1); // the __DEPOTSETT__ debug hook only
  // mk0.96 (Task 6): OFF must also be QUIET and STILL — the audible bed and
  // the flag cloth follow the same world.wind the mechanics read.
  ok("WIND TOGGLE source pin: the audio wind bed is scaled by the real wind (world.wind.mag)",
    /const wScale = world\.wind \? Math\.min\(1, \(world\.wind\.mag \|\| 0\) \/ 3\.5\) : 1;/.test(
      fs.readFileSync(new URL("../../src/platform/audio.js", import.meta.url), "utf8")));
  {
    const rendSrc = fs.readFileSync(new URL("../../src/render/renderer.js", import.meta.url), "utf8");
    ok("WIND TOGGLE source pin: flag ripple has no floor — dead calm means limp cloth",
      /const amp = Math\.min\(0\.55, mag \* 0\.13\);/.test(rendSrc) && !/0\.12 \+ mag \* 0\.09/.test(rendSrc));
  }
  ok("FIRE FEEDBACK source pin: the FIRE button's held state routes through setFireHeld",
    /const setFireHeld = \(v\) => \{/.test(fs.readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8")));
}
// ==== end WIND TOGGLE =======================================================

// ==== POSSESSION T7: the sharpened hand ======================================
// mk0.97 (Phase 4 Task 7, owner's amendment). Possessed fire sharpens: spread
// tightens to a quarter (POSSESS_ACC), the reticle snaps to a live SEEN enemy
// for a real lead solve (snapTargetNear), cover exempts the muzzle's first
// 2.5m and braces tighten scatter x0.85 (both sides, symmetric), a possessed
// squad fans into a firing line perpendicular to the aim, and any shooter
// whose teammate stands in the corridor HOLDS fire (mateBlocks) — possessed
// AND auto squads alike. Mortars are exempt: arcing over your own men is the
// tube's purpose.
{
  const flatField = { heightAt: () => 0, dirty: false, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } };
  const idUV = (x, z) => ({ u: x, v: z });
  const muzzlesOf = (world) => world.events.filter((e) => e.type === "muzzle");
  // Angle between a fired muzzle event's own direction and the straight line
  // from that event's own (x,y,z) to a given 3D point — the "ideal" line.
  const angleOff = (ev, tx, ty, tz) => {
    const ix = tx - ev.x, iy = ty - ev.y, iz = tz - ev.z;
    const il = Math.hypot(ix, iy, iz);
    const dot = (ix / il) * ev.dx + (iy / il) * ev.dy + (iz / il) * ev.dz;
    return Math.acos(Math.max(-1, Math.min(1, dot)));
  };

  // (a) the constants exist and are pinned — real imports, no mirrors.
  ok("POSSESSION T7(a): POSSESS_ACC is pinned at 0.25 (the sharpened hand)",
    POSSESS_ACC === 0.25, POSSESS_ACC);
  ok("POSSESSION T7(a) (re-taught mk1.99): POSSESS_SNAP_R is pinned at 4m — the forgiving snap",
    POSSESS_SNAP_R === 4, POSSESS_SNAP_R);

  // (b) possessed spread tightens to the hand (mean angle off the aim line
  // under 0.035 rad); the machine (squadFire) stays loose (mean > 0.06 rad).
  // AMENDMENT (14m control): rifles range is 15 and squadFire refuses beyond
  // effRange, so the control fixture fires at 14m; the possessed fixture has
  // no such ceiling and stays at 20m. 15 volleys, cooldowns hand-decayed
  // between pulls (the possessed path does not decay fireCd on its own).
  {
    const world = makeWorld({ field: flatField, seed: 31 });
    const sq = makeSquad(1, "rifles", 1, 0, 0);
    spawnSquadMembers(world, sq);
    const aim = { x: 0, z: 20 };
    const angles = [];
    for (let v = 0; v < 15; v++) {
      world.events.length = 0;
      possessedVolley(world, sq, aim, null);
      const ty = world.field.heightAt(aim.x, aim.z) + 0.9;
      for (const ev of muzzlesOf(world)) angles.push(angleOff(ev, aim.x, ty, aim.z));
      for (const id of sq.memberIds) { const u = world.byId.get(id); if (u) u.fireCd = 0; }
    }
    const mean = angles.reduce((a, b) => a + b, 0) / angles.length;
    ok("POSSESSION T7(b) (re-pinned mk2.02, named): possessed volley mean angle off the aim line is under 0.045 rad — the 2m muzzle (1.5m) grazes lower cover on the way down; measured 0.0399 vs the old geometry's 0.031",
      angles.length > 0 && mean < 0.045, `n=${angles.length} mean=${mean.toFixed(4)}`);
  }
  {
    const world = makeWorld({ field: flatField, seed: 31 });
    const sq = makeSquad(1, "rifles", 1, 0, 0);
    spawnSquadMembers(world, sq);
    const enemy = addBody(world, { kind: "unit", team: 2, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x: 0, y: 0.86, z: 14, hp: 58 });
    const angles = [];
    for (let v = 0; v < 15; v++) {
      world.events.length = 0;
      squadFire(world, sq, world.dt, null);
      for (const ev of muzzlesOf(world)) angles.push(angleOff(ev, enemy.pos.x, enemy.hy, enemy.pos.z));
      for (const id of sq.memberIds) { const u = world.byId.get(id); if (u) u.fireCd = 0; }
    }
    const mean = angles.reduce((a, b) => a + b, 0) / angles.length;
    ok("POSSESSION T7(b) control: squadFire's machine spread stays loose, mean > 0.06 rad",
      angles.length > 0 && mean > 0.06, `n=${angles.length} mean=${mean.toFixed(4)}`);
  }

  // (c) lead is live: a snapped target's lateral motion pulls the fired
  // azimuth ahead of his CURRENT bearing; standing still, the same shot
  // fires straight at him. Averaged over 15 volleys (scatter is zero-mean
  // per shot; the lead bias is not).
  {
    const bearingDev = (vx) => {
      const world = makeWorld({ field: flatField, seed: 41 });
      const sq = makeSquad(1, "rifles", 1, 0, 0);
      spawnSquadMembers(world, sq);
      const enemy = addBody(world, { kind: "unit", team: 2, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x: 0, y: 0.86, z: 20, hp: 58 });
      enemy.v.x = vx;
      const devs = [];
      for (let v = 0; v < 15; v++) {
        world.events.length = 0;
        possessedVolley(world, sq, { x: enemy.pos.x, z: enemy.pos.z }, null);
        for (const ev of muzzlesOf(world)) {
          const shotAz = Math.atan2(ev.dx, ev.dz);
          const straightAz = Math.atan2(enemy.pos.x - ev.x, enemy.pos.z - ev.z);
          devs.push(shotAz - straightAz);
        }
        for (const id of sq.memberIds) { const u = world.byId.get(id); if (u) u.fireCd = 0; }
      }
      return devs.reduce((a, b) => a + b, 0) / devs.length;
    };
    const movingDev = bearingDev(3);
    const stillDev = bearingDev(0);
    ok("POSSESSION T7(c): a live target leading at 3 m/s pulls the fired azimuth ahead of his current bearing",
      movingDev > 0.015, `movingDev=${movingDev.toFixed(4)}`);
    ok("POSSESSION T7(c): the identical shot at a standing target fires straight (near-zero mean deviation)",
      Math.abs(stillDev) < 0.015, `stillDev=${stillDev.toFixed(4)}`);
  }

  // (d) snap respects the sight law: an enemy within snap radius but on
  // unseen ground is not snapped — the volley aims at the GROUND point.
  // Sight map hand-stamped exactly like T2(b): lit only west of u=8.
  {
    const world = makeWorld({ field: flatField, seed: 51 });
    const sq = makeSquad(1, "rifles", 1, 0, 0);
    spawnSquadMembers(world, sq);
    const T = makeTerritory(29, 57);
    T.sight = makeSight(T);
    for (let iz = 0; iz < T.sight.nz; iz++) for (let ix = 0; ix < T.sight.nx; ix++) {
      const u = -T.sight.halfU + (ix + 0.5) * T.sight.cs;
      if (u < 8) T.sight.seen1[iz * T.sight.nx + ix] = 1;
    }
    const aim = { x: 6.3, z: 0 };
    const enemy = addBody(world, { kind: "unit", team: 2, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x: 8.0, y: 0.86, z: 1.0, hp: 58 });
    const groundDevs = [], enemyDevs = [];
    for (let v = 0; v < 10; v++) {
      world.events.length = 0;
      possessedVolley(world, sq, aim, T, idUV);
      const gy = world.field.heightAt(aim.x, aim.z); // mk2.02: ground aim targets the SURFACE
      for (const ev of muzzlesOf(world)) {
        groundDevs.push(angleOff(ev, aim.x, gy, aim.z));
        enemyDevs.push(angleOff(ev, enemy.pos.x, enemy.hy, enemy.pos.z));
      }
      for (const id of sq.memberIds) { const u = world.byId.get(id); if (u) u.fireCd = 0; }
    }
    const meanGround = groundDevs.reduce((a, b) => a + b, 0) / groundDevs.length;
    const meanEnemy = enemyDevs.reduce((a, b) => a + b, 0) / enemyDevs.length;
    ok("POSSESSION T7(d): the enemy sits on unseen ground — the volley still aims at the ground point",
      groundDevs.length > 0 && meanGround < 0.05, `n=${groundDevs.length} meanGround=${meanGround.toFixed(4)}`);
    ok("POSSESSION T7(d): no snap happened — the shots sit well off the (unseen) enemy's own line",
      meanEnemy > 0.1, `meanEnemy=${meanEnemy.toFixed(4)}`);
  }

  // (e) cover is a bonus now: losGraze exempts a solid within the muzzle's
  // first 2.5m; a solid further down the lane still grazes; bracedAt is true
  // beside a solid, and scatterSigma there is base x0.85 (BRACE_K), isolated
  // from the graze term by reusing the exempt (non-grazing) solid.
  {
    const muzzle = { x: 0, y: 1.5, z: 0 };
    const aim = { x: 0, y: 1.5, z: 20 };
    const nearBag = { alive: true, kind: "chunk", pos: { x: 0.8, y: 1.5, z: 0.3 }, hx: 0.3, hy: 0.3, hz: 0.3, invM: 0 };
    const midBag = { alive: true, kind: "chunk", pos: { x: 0.8, y: 1.5, z: 10 }, hx: 0.3, hy: 0.3, hz: 0.3, invM: 0 };
    ok("POSSESSION T7(e): losGraze exempts a solid within the muzzle's first 2.5m",
      losGraze({ bodies: [nearBag] }, muzzle, aim) === 0);
    ok("POSSESSION T7(e): losGraze still grazes a solid mid-path",
      losGraze({ bodies: [midBag] }, muzzle, aim) > 0);
    ok("POSSESSION T7(e): bracedAt is true beside a solid",
      bracedAt({ bodies: [nearBag] }, muzzle.x, muzzle.z) === true);
    const spec = { acc: 0.09 };
    const sigmaOpen = scatterSigma({ bodies: [] }, muzzle, aim, spec);
    const sigmaBraced = scatterSigma({ bodies: [nearBag] }, muzzle, aim, spec);
    ok("POSSESSION T7(e): scatterSigma tightens x0.85 beside a solid (BRACE_K), graze isolated by the muzzle exemption",
      Math.abs(sigmaBraced - sigmaOpen * 0.85) < 1e-9, `open=${sigmaOpen} braced=${sigmaBraced}`);
  }

  // (f) the firing line: driving WITH an aim fans the squad perpendicular to
  // anchor->aim, goals collinear and spaced ~1.5m (clearSlot is exact on
  // flat, empty ground — no clearance deflection). WITHOUT an aim the ring
  // still holds (T1(a)'s own coverage; reasserted here as a regression guard).
  {
    const world = makeWorld({ field: flatField, seed: 61 });
    const sq = makeSquad(1, "rifles", 1, 0, 0);
    spawnSquadMembers(world, sq);
    const aim = { x: 0, z: 20 };
    drivePossessedSquad(world, sq, 0, 0, world.dt, aim);
    const goals = sq.memberIds.map((id) => world.byId.get(id).goal);
    ok("POSSESSION T7(f): every member's line goal sits on the perpendicular axis (z ~ anchor.z)",
      goals.every((g) => Math.abs(g.z - sq.anchor.z) < 1e-6), goals.map((g) => g.z.toFixed(3)).join(","));
    const xs = goals.map((g) => g.x).sort((a, b) => a - b);
    let spacingOk = true;
    for (let i = 1; i < xs.length; i++) if (Math.abs((xs[i] - xs[i - 1]) - 1.5) > 1e-6) spacingOk = false;
    ok("POSSESSION T7(f): the four goals are evenly spaced ~1.5m along that axis",
      spacingOk, xs.map((x) => x.toFixed(3)).join(","));

    const world2 = makeWorld({ field: flatField, seed: 62 });
    const sq2 = makeSquad(1, "rifles", 1, 0, 0);
    spawnSquadMembers(world2, sq2);
    drivePossessedSquad(world2, sq2, 0, 0, world2.dt);
    const g0 = world2.byId.get(sq2.memberIds[0]).goal;
    ok("POSSESSION T7(f): without an aim, the ring formation holds (T1(a) untouched)",
      Math.abs(g0.x) < 2 && Math.abs(g0.z) < 2, `g0=(${g0.x.toFixed(2)},${g0.z.toFixed(2)})`);
  }

  // (g) check fire: a mate standing on the muzzle->aim line 3m out holds the
  // shooter's shot (1 muzzle, not 2), and his cooldown is untouched — he
  // fires the instant the lane clears. Stepped 1.5m aside, both fire.
  {
    const mkMember = (world, sq, x, z) => {
      const u = addBody(world, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28,
        x, y: 0.74, z, hp: 58, friction: 0.5 });
      u.utype = "rifles"; u.squadId = sq.id; u.dress = "human";
      sq.memberIds.push(u.id);
      return u;
    };
    {
      const world = makeWorld({ field: flatField, seed: 71 });
      const sq = makeSquad(1, "rifles", 1, 0, 0);
      const shooter = mkMember(world, sq, 0, 0);
      mkMember(world, sq, 0, 3);
      world.events.length = 0;
      possessedVolley(world, sq, { x: 0, z: 20 }, null);
      ok("POSSESSION T7(g): a mate standing in the corridor holds the shooter's shot — 1 muzzle, not 2",
        muzzlesOf(world).length === 1, `muzzles=${muzzlesOf(world).length}`);
      ok("POSSESSION T7(g): the held man's cooldown is untouched — he fires the instant the lane clears",
        (shooter.fireCd || 0) === 0, `fireCd=${shooter.fireCd}`);
    }
    {
      const world = makeWorld({ field: flatField, seed: 72 });
      const sq = makeSquad(1, "rifles", 1, 0, 0);
      mkMember(world, sq, 0, 0);
      mkMember(world, sq, 1.5, 3);
      world.events.length = 0;
      possessedVolley(world, sq, { x: 0, z: 20 }, null);
      ok("POSSESSION T7(g): the mate stepped 1.5m aside — both fire, 2 muzzles",
        muzzlesOf(world).length === 2, `muzzles=${muzzlesOf(world).length}`);
    }
  }

  // (h) mortars exempt: the same blocked geometry, but INFANTRY_ARMS.mortars
  // is occl "lofted" — the corridor check never runs. Both tubes fire.
  {
    const mkMortar = (world, sq, x, z) => {
      const u = addBody(world, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28,
        x, y: 0.74, z, hp: 58, friction: 0.5 });
      u.utype = "mortars"; u.squadId = sq.id; u.dress = "human";
      sq.memberIds.push(u.id);
      return u;
    };
    const world = makeWorld({ field: flatField, seed: 73 });
    const sq = makeSquad(1, "mortars", 1, 0, 0);
    mkMortar(world, sq, 0, 0);
    mkMortar(world, sq, 0, 3);
    world.events.length = 0;
    possessedVolley(world, sq, { x: 0, z: 20 }, null);
    ok("POSSESSION T7(h): mortars are exempt from the corridor check — both tubes fire despite the blocked geometry",
      muzzlesOf(world).length === 2, `muzzles=${muzzlesOf(world).length}`);
  }

  // (i) auto squads inherit the discipline: squadFire holds the shooter
  // whose mate stands in the corridor to the acquired target, same rule.
  {
    const mkMember = (world, sq, x, z) => {
      const u = addBody(world, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28,
        x, y: 0.74, z, hp: 58, friction: 0.5 });
      u.utype = "rifles"; u.squadId = sq.id; u.dress = "human";
      sq.memberIds.push(u.id);
      return u;
    };
    const world = makeWorld({ field: flatField, seed: 74 });
    const sq = makeSquad(1, "rifles", 1, 0, 0);
    sq.order = "defend";
    const shooter = mkMember(world, sq, 0, 0);
    mkMember(world, sq, 0, 3);
    addBody(world, { kind: "unit", team: 2, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x: 0, y: 0.86, z: 14, hp: 58 });
    world.events.length = 0;
    squadFire(world, sq, world.dt, null);
    ok("POSSESSION T7(i): squadFire holds the shooter whose mate stands in the corridor to the acquired target",
      muzzlesOf(world).length === 1, `muzzles=${muzzlesOf(world).length}`);
    ok("POSSESSION T7(i): the held man's cooldown is untouched (squadFire's own per-tick decay only)",
      (shooter.fireCd || 0) <= 0, `fireCd=${shooter.fireCd}`);
  }
}
// ==== end POSSESSION T7 ======================================================

// ==== POSSESSION T8: stone stands ============================================
{
  const stoneField = () => ({
    heightAt: () => 0,
    normalAt: (x, z, o) => { o.x = 0; o.y = 1; o.z = 0; return o; },
    carve: () => {},
    dirty: false,
  });
  const buildStand = (depotFlag, moverMass) => {
    const world = makeWorld({ field: stoneField(), seed: 1 });
    if (depotFlag) world.depotCombat = true;
    const c1 = addBody(world, { kind: "chunk", team: 0, mass: MASON.mass, hx: MASON.hcs, hy: MASON.hcs, hz: MASON.hcs, x: 2, y: MASON.hcs, z: 0, friction: 0.65, restitution: 0.02 });
    const c2 = addBody(world, { kind: "chunk", team: 0, mass: MASON.mass, hx: MASON.hcs, hy: MASON.hcs, hz: MASON.hcs, x: 2 + MASON.pitch, y: MASON.hcs, z: 0, friction: 0.65, restitution: 0.02 });
    c1.sleeping = true; c2.sleeping = true;
    const w = addWeld(world, c1, c2, MASON.breakF);
    const mover = addBody(world, { kind: "unit", team: 1, mass: moverMass, hx: 0.28, hy: 0.72, hz: 0.28, x: 0, y: 0.72, z: 0, friction: 0.5 });
    return { world, c1, c2, w, mover };
  };
  const p1a = { x: 2, z: 0 }, p2a = { x: 2 + MASON.pitch, z: 0 };

  // (a) the law: an 82kg unit driven into welded, asleep stones -> stones
  // stay put, weld holds.
  {
    const { world, c1, c2, w, mover } = buildStand(true, 82);
    for (let i = 0; i < 120; i++) { mover.v.x = 3.2; stepWorld(world); }
    ok("POSSESSION T8(a): stone 1 still sleeping (82kg unit can't wake a welded, standing chunk)", c1.sleeping === true);
    ok("POSSESSION T8(a): stone 2 still sleeping", c2.sleeping === true);
    ok("POSSESSION T8(a): stone 1 unmoved to 1mm", Math.abs(c1.pos.x - p1a.x) < 1e-3 && Math.abs(c1.pos.z - p1a.z) < 1e-3, `pos=${c1.pos.x},${c1.pos.z}`);
    ok("POSSESSION T8(a): stone 2 unmoved to 1mm", Math.abs(c2.pos.x - p2a.x) < 1e-3 && Math.abs(c2.pos.z - p2a.z) < 1e-3, `pos=${c2.pos.x},${c2.pos.z}`);
    ok("POSSESSION T8(a): weld unbroken", w.broken === false);
  }

  // (b) heavy still rams: a 340kg breaker-class body still wakes at least one stone.
  {
    const { world, c1, c2, mover } = buildStand(true, 340);
    for (let i = 0; i < 120; i++) { mover.v.x = 3.2; stepWorld(world); }
    ok("POSSESSION T8(b): a 340kg breaker still wakes the stones", c1.sleeping === false || c2.sleeping === false, `c1=${c1.sleeping} c2=${c2.sleeping}`);
  }

  // (c) rubble still kicks: a single UNWELDED sleeping chunk still wakes —
  // the exemption keys on the live weld, not on kind.
  {
    const world = makeWorld({ field: stoneField(), seed: 1 });
    world.depotCombat = true;
    const c = addBody(world, { kind: "chunk", team: 0, mass: MASON.mass, hx: MASON.hcs, hy: MASON.hcs, hz: MASON.hcs, x: 2, y: MASON.hcs, z: 0, friction: 0.65, restitution: 0.02 });
    c.sleeping = true;
    const mover = addBody(world, { kind: "unit", team: 1, mass: 82, hx: 0.28, hy: 0.72, hz: 0.28, x: 0, y: 0.72, z: 0, friction: 0.5 });
    for (let i = 0; i < 120; i++) { mover.v.x = 3.2; stepWorld(world); }
    ok("POSSESSION T8(c): an unwelded sleeping chunk still wakes (exemption keys on the live weld, not kind)", c.sleeping === false);
  }

  // (d) the demo is untouched: the same two-stone fixture WITHOUT
  // world.depotCombat -> the man wakes the island exactly as before (the
  // guard's own control).
  {
    const { world, c1, c2, mover } = buildStand(false, 82);
    for (let i = 0; i < 120; i++) { mover.v.x = 3.2; stepWorld(world); }
    ok("POSSESSION T8(d): without depotCombat, the man wakes the island exactly as before (guard's own control)",
      c1.sleeping === false || c2.sleeping === false, `c1=${c1.sleeping} c2=${c2.sleeping}`);
  }

  // (e) source pin: the possessed anchor's building clamp exists — the
  // branch captures the pre-drive anchor and reverts when the clamped cell
  // is blocked or a wall.
  {
    const dsrc8 = fs.readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");
    ok("POSSESSION T8(e) source pin: the possessed branch captures the pre-drive anchor",
      /const a0 = \{ x: sq\.anchor\.x, z: sq\.anchor\.z \};/.test(dsrc8));
    ok("POSSESSION T8(e) source pin: the anchor reverts when the clamped cell is blocked or a wall",
      /sq\.anchor = cellA && \(cellA\.blocked \|\| cellA\.wallId\) \? a0 : \{ x: cl\.x, z: cl\.z \};/.test(dsrc8));
  }

  // (f) source pin: the build bar renders only when !hud.possessed.
  {
    const dsrc8b = fs.readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");
    ok("POSSESSION T8(f): the build bar condition gains !hud.possessed",
      /hud\.started && !hud\.gameOver && !hud\.victory && !hud\.possessed && \(/.test(dsrc8b));
    ok("POSSESSION T8(f): the old bar condition (without the possessed guard) is gone",
      !/hud\.started && !hud\.gameOver && !hud\.victory && \(/.test(dsrc8b));
  }
}
// ==== end POSSESSION T8 =======================================================

// ==== LETHALITY T9: killing rifles ===========================================
// mk0.99 (Phase 4 Task 9, owner's ruling after mk0.97 play: "bullets pass
// right through"). Rifle/mg dirDmg rise so infantry fire actually kills; a
// struck man stamps b.dmgT so the renderer can flinch/flash him. Sniper
// (130) and every blast weapon (the rifles' own dmg 5 splash included) are
// untouched.
{
  const flatF9 = { heightAt: () => 0, normalAt: (x, z, o) => { o.x = 0; o.y = 1; o.z = 0; return o; }, carve: () => {}, dirty: false };

  // (a) spec pins, real imports.
  ok("LETHALITY T9(a): INFANTRY_ARMS.rifles.dirDmg is 15", INFANTRY_ARMS.rifles.dirDmg === 15, INFANTRY_ARMS.rifles.dirDmg);
  ok("LETHALITY T9(a): INFANTRY_ARMS.mg.dirDmg is 8", INFANTRY_ARMS.mg.dirDmg === 8, INFANTRY_ARMS.mg.dirDmg);
  ok("LETHALITY T9(a): ENEMY_FIRE.rifle.dirDmg is 15", ENEMY_FIRE.rifle.dirDmg === 15, ENEMY_FIRE.rifle.dirDmg);
  ok("LETHALITY T9(a): TOWER_SPECS.mg.dirDmg is 8", TOWER_SPECS.mg.dirDmg === 8, TOWER_SPECS.mg.dirDmg);
  ok("LETHALITY T9(a): the sniper's dirDmg (130) did not move", INFANTRY_ARMS.sniper.dirDmg === 130, INFANTRY_ARMS.sniper.dirDmg);
  ok("LETHALITY T9(a): the rifles' blast splash component (dmg 5) did not move", INFANTRY_ARMS.rifles.dmg === 5, INFANTRY_ARMS.rifles.dmg);

  // (b) time-to-kill: a possessed rifle squad at 14m now kills a 58hp
  // conscript in <= 8 rounds (mk0.97's 4.1 dirDmg took far more). Member
  // cooldowns cleared between pulls; each pull steps the world 40 ticks so
  // rounds fly and land before the next pull.
  {
    const world = makeWorld({ field: flatF9, seed: 5 });
    world.depotCombat = true;
    const sq = makeSquad(1, "rifles", 1, 0, 0);
    spawnSquadMembers(world, sq);
    const enemy = addBody(world, { kind: "unit", team: 2, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x: 0, y: 0.86, z: 14, hp: 58 });
    const aim = { x: enemy.pos.x, z: enemy.pos.z };
    let rounds = 0, pulls = 0;
    while (enemy.alive && pulls < 20) {
      rounds += possessedVolley(world, sq, aim, null);
      for (let i = 0; i < 40; i++) stepWorld(world);
      for (const id of sq.memberIds) { const u = world.byId.get(id); if (u) u.fireCd = 0; }
      pulls++;
    }
    ok("LETHALITY T9(b): a possessed rifle squad kills a 58hp conscript at 14m in 3-8 rounds now (rifles kill)",
      !enemy.alive && rounds >= 3 && rounds <= 8, `rounds=${rounds} pulls=${pulls} enemyAlive=${enemy.alive} hp=${enemy.hp}`);
  }

  // (c) the hit stamp: applyDamage under world.depotCombat stamps b.dmgT to
  // world.t on any positive damage; without the flag, or on a non-unit body,
  // dmgT stays undefined.
  {
    const world = makeWorld({ field: flatF9, seed: 1 });
    world.depotCombat = true;
    world.t = 3.5;
    const u = addBody(world, { kind: "unit", team: 1, mass: 82, hx: 0.28, hy: 0.72, hz: 0.28, x: 0, y: 0.72, z: 0, hp: 58 });
    applyDamage(world, u, 5, { cause: CAUSE.PROJECTILE, attacker: "player" });
    ok("LETHALITY T9(c): applyDamage stamps b.dmgT === world.t under world.depotCombat", u.dmgT === 3.5, u.dmgT);

    const world2 = makeWorld({ field: flatF9, seed: 1 });
    const u2 = addBody(world2, { kind: "unit", team: 1, mass: 82, hx: 0.28, hy: 0.72, hz: 0.28, x: 0, y: 0.72, z: 0, hp: 58 });
    applyDamage(world2, u2, 5, { cause: CAUSE.PROJECTILE, attacker: "player" });
    ok("LETHALITY T9(c): without world.depotCombat, dmgT stays undefined", u2.dmgT === undefined, u2.dmgT);

    const world3 = makeWorld({ field: flatF9, seed: 1 });
    world3.depotCombat = true;
    const wall = addBody(world3, { kind: "wall", team: 0, mass: 0, hx: 1, hy: 1, hz: 1, x: 0, y: 1, z: 0, hp: 100 });
    applyDamage(world3, wall, 5, { cause: CAUSE.PROJECTILE, attacker: "player" });
    ok("LETHALITY T9(c): a wall body never gets stamped (units only)", wall.dmgT === undefined, wall.dmgT);
  }

  // (d) renderer source pins: hurtK gated on world.depotCombat off b.dmgT,
  // the dip term in the oy math, the flash lerp in the color branch keeping
  // fogSil's absolute precedence.
  {
    const rendSrc = fs.readFileSync(new URL("../../src/render/renderer.js", import.meta.url), "utf8");
    ok("LETHALITY T9(d): hurtK is computed from b.dmgT, gated on world.depotCombat",
      /const hurtAge = world\.depotCombat && b\.alive && b\.dmgT != null \? world\.t - b\.dmgT : 1;/.test(rendSrc) &&
      /const hurtK = hurtAge < 0\.18 \? 1 - hurtAge \/ 0\.18 : 0;/.test(rendSrc));
    ok("LETHALITY T9(d): the dip term (-0.10 * hurtK) sits in the oy math",
      /- 0\.10 \* hurtK;/.test(rendSrc));
    ok("LETHALITY T9(d): the flash lerp sits in the color branch, fogSil keeping first precedence",
      /if \(fogSil\) pools\[pi\]\.setColorAt\(idx, SIL_C\);[\s\S]{0,300}hurtK > 0[\s\S]{0,150}lerp\(HIT_C, 0\.7 \* hurtK\)/.test(rendSrc));
  }
}
// ==== end LETHALITY T9 ========================================================

// ==== THE RETICLE (mk1.99) ==================================================
// The owner's aim pass: the ring is the spread drawn solid, a tap jumps the
// reticle, the fire line stops at the first surface it would hit
// (clampToImpact), and the enemy snap is 4m and sticky (stickyLock). Pure
// helpers tested on hand-built maps and stub worlds; JSX/renderer wiring
// pinned by source regex, the file's own convention.
{
  const flatField = { heightAt: () => 0, dirty: false, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } };
  const idUV = (x, z) => ({ u: x, v: z });

  // (d) stickyLock acquires a live enemy within the 4m snap radius.
  {
    const world = makeWorld({ field: flatField, seed: 61 });
    const enemy = addBody(world, { kind: "unit", team: 2, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x: 0, y: 0.86, z: 20, hp: 58 });
    const lk = stickyLock(world, null, { x: 3, z: 20 }, null, idUV);
    ok("RETICLE mk1.99(d): stickyLock acquires a live enemy 3m from the aim (4m radius)",
      lk === enemy, lk && lk.id);
  }
  // (e) the hold: a locked man stays locked while the raw aim stays within
  // 4m of him; past 4m the lock breaks and, with no other enemy near, drops.
  {
    const world = makeWorld({ field: flatField, seed: 62 });
    const enemy = addBody(world, { kind: "unit", team: 2, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x: 0, y: 0.86, z: 20, hp: 58 });
    const held = stickyLock(world, enemy.id, { x: 3.5, z: 20 }, null, idUV);
    ok("RETICLE mk1.99(e): a held lock survives the raw aim 3.5m off the man",
      held === enemy, held && held.id);
    const dropped = stickyLock(world, enemy.id, { x: 4.5, z: 20 }, null, idUV);
    ok("RETICLE mk1.99(e): the raw aim steered past 4m breaks the lock",
      dropped === null, dropped && dropped.id);
  }
  // (f) a dead man sheds the lock even at zero distance.
  {
    const world = makeWorld({ field: flatField, seed: 63 });
    const enemy = addBody(world, { kind: "unit", team: 2, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x: 0, y: 0.86, z: 20, hp: 58 });
    enemy.alive = false;
    const lk = stickyLock(world, enemy.id, { x: 0, z: 20 }, null, idUV);
    ok("RETICLE mk1.99(f): a dead man sheds the lock", lk === null, lk && lk.id);
  }
  // (g) source pins: the tap jumps the reticle; the loop clamps to impact and
  // runs the sticky lock; the ring reads the live scatter.
  {
    const gameSrc = fs.readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");
    ok("RETICLE mk1.99(g) source pin: a possessed ground tap jumps the reticle through the sight-circle clamp and the seen test",
      /if \(seenAt\(T\.sight, cc0\.u, cc0\.v, 1\)\) \{\s*S\.reticleOff = \{ dx: dx0, dz: dz0 \};/.test(gameSrc));
    ok("RETICLE mk1.99(g) source pin: the frame loop derives the aim through stickyLock",
      /const lk9 = stickyLock\(world, S\.reticleLockId, S\.reticle, T, invW\);/.test(gameSrc));
    ok("RETICLE mk1.99(g) source pin: the ring radius reads the live scatterSigma under POSSESS_ACC",
      /scatterSigma\(world, muzzle9, aim9, \{ \.\.\.spec9, acc: spec9\.acc \* POSSESS_ACC \}\)/.test(gameSrc));
  }
  // (h) source pin: the ring's material is solid — no opacity in its block.
  {
    const rendSrc = fs.readFileSync(new URL("../../src/render/renderer.js", import.meta.url), "utf8");
    const block = String(rendSrc.match(/setReticle\(on, x, z, y, r, hit, pts\) \{[\s\S]*?\n    \},/) || "");
    ok("RETICLE mk1.99(h) source pin: the ring draws solid — its material carries no opacity",
      block.length > 0 && !/opacity/.test(block) && /depthWrite: false/.test(block), block.length);
  }
}
// ==== end THE RETICLE (mk1.99) ==============================================

// ==== THE RETICLE, SECOND PASS (mk2.00) =====================================
// Playtest findings against mk1.99: the destination cell takes the hit (the
// steer parks the reticle ON a wall's own cell — the one cell mk1.99 never
// tested, so the ring fell flat at the wall's foot), the ring's band and red
// re-tuned, and possession closes the build tree and holds it shut. Pure
// helper on hand-built maps; JSX/renderer wiring pinned by source regex.
{
  // (c) source pin: the ring's re-tuned band and red.
  {
    const rendSrc = fs.readFileSync(new URL("../../src/render/renderer.js", import.meta.url), "utf8");
    const block = String(rendSrc.match(/setReticle\(on, x, z, y, r, hit, pts\) \{[\s\S]*?\n    \},/) || "");
    ok("RETICLE mk2.00(c) source pin (re-taught mk2.02): the crosshair draws in crimson — the band is dead",
      /PlaneGeometry\(0\.12, 0\.85\)/.test(block) && /0xf0143c/.test(block), block.length);
  }
  // (d) source pins: every TAKE CONTROL closes the build tree with the take.
  {
    const gameSrc = fs.readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");
    ok("RETICLE mk2.00(d) source pin: the squad's TAKE CONTROL closes the build tree",
      /act: \(\) => \{ closeBuild\(\); const S = stateRef\.current; if \(S\) S\.takeControl\(\); \}/.test(gameSrc));
    ok("RETICLE mk2.00(d) source pin: the tower's TAKE CONTROL closes the build tree",
      /act: \(\) => \{ closeBuild\(\); const S = stateRef\.current; if \(S\) S\.takeControlTower\(tr\.id\); \},/.test(gameSrc));
    ok("RETICLE mk2.00(d) source pin: the vehicle's TAKE CONTROL closes the build tree",
      /act: \(\) => \{ closeBuild\(\); const S = stateRef\.current; if \(S\) S\.takeControlVehicle\(\); \} \},/.test(gameSrc));
    // (e) source pin: the BUILD toggle refuses to open over a live possession.
    ok("RETICLE mk2.00(e) source pin: the BUILD toggle refuses while possessed",
      /if \(buildOpen\) \{ closeBuild\(\); return; \}[\s\S]{0,240}if \(S && S\.possess\) return;/.test(gameSrc));
  }
}
// ==== end THE RETICLE, SECOND PASS (mk2.00) =================================

// ==== THE TRUE RETICLE (mk2.01) =============================================
// The ring is the landing bound: nominal trajectory integrated with the
// engine's own arithmetic, radius at applyScatter's hard cap. The surface
// law aims the guns at whatever the reticle rests on (rooftops included);
// nothing blocks the steer. Pure helpers on hand-built maps; wiring pinned
// by source regex, the file's own convention.
{
  const flatField = { heightAt: () => 0, dirty: false, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } };
  const idUV = (x, z) => ({ u: x, v: z });
  const bareSG = () => ({ nx: 32, nz: 32, cs: 2, halfU: 32, halfV: 32,
    seen1: new Uint8Array(32 * 32).fill(1), seen2: new Uint8Array(32 * 32),
    gnd: new Float32Array(32 * 32), occ: new Float32Array(32 * 32).fill(-Infinity) });
  const wallSG = () => { const SG = bareSG(); for (let iz = 0; iz < 32; iz++) SG.occ[iz * 32 + 21] = 3; return SG; }; // a 3m wall at u≈11

  // (a) the cap is the formula's own tail: sqrt(-2 ln 1e-4) x 0.6.
  ok("TRUE RETICLE mk2.01(a): SCATTER_CAP pins the draw's hard edge (~2.5751)",
    Math.abs(SCATTER_CAP - Math.sqrt(-2 * Math.log(1e-4)) * 0.6) < 1e-9, SCATTER_CAP);

  // (b) no real draw exceeds it: 500 draws at sigma 0.1, every deflection
  // angle at or under atan(cap x 0.1).
  {
    const world = makeWorld({ field: flatField, seed: 71 });
    const dir = { x: 0, y: 0, z: 1 };
    let worst = 0;
    for (let i = 0; i < 500; i++) {
      const d2 = applyScatter(world, dir, 0.1);
      worst = Math.max(worst, Math.acos(Math.max(-1, Math.min(1, d2.z))));
    }
    ok("TRUE RETICLE mk2.01(b): 500 applyScatter draws all sit inside the cap angle",
      worst <= Math.atan(SCATTER_CAP * 0.1) + 1e-9, worst);
  }
  // (c) still air, flat gun: the round flies level, drops under 9.8, and
  // lands on the dirt where the fall time says — not at the aim's chest line.
  {
    const hit = flightImpact(bareSG(), { x: -30, y: 1.5, z: 0 }, { x: 1, y: 0, z: 0 }, 100, { windF: 0 }, null, idUV);
    ok("TRUE RETICLE mk2.01(c): a level 100 m/s round from 1.5m lands ~55m out on the ground",
      hit.wall === false && Math.abs(hit.y) < 1e-6 && hit.x > 20 && hit.x < 32, JSON.stringify(hit));
  }
  // (d) a flat shot into a 3m wall terminates on its near face.
  {
    const hit = flightImpact(wallSG(), { x: 0, y: 1.5, z: 0 }, { x: 1, y: 0, z: 0 }, 100, { windF: 0 }, null, idUV);
    ok("TRUE RETICLE mk2.01(d): a flat round into the wall stops on the face",
      hit.wall === true && hit.x >= 10 && hit.x <= 12.5 && hit.y > 0 && hit.y < 3, JSON.stringify(hit));
  }
  // (e) the same wall, a lofted round: the arc clears it and lands behind.
  {
    const hit = flightImpact(wallSG(), { x: -30, y: 0.5, z: 0 }, { x: Math.cos(75 * Math.PI / 180), y: Math.sin(75 * Math.PI / 180), z: 0 }, 33, { windF: 0 }, null, idUV);
    ok("TRUE RETICLE mk2.01(e): a 75-degree mortar round clears the 3m wall and lands behind it",
      hit.wall === false && hit.x > 12.5, JSON.stringify(hit));
  }
  // (f) surfaceAt: dirt reads ground; a solid's cell reads its top.
  {
    const SG = wallSG();
    const s0 = surfaceAt(SG, 0, 0, idUV), s1 = surfaceAt(SG, 11, 0, idUV);
    ok("TRUE RETICLE mk2.01(f): open dirt reads ground height, not solid", s0.y === 0 && s0.solid === false, JSON.stringify(s0));
    ok("TRUE RETICLE mk2.01(f): the wall's cell reads its top — the rooftop", s1.y === 3 && s1.solid === true, JSON.stringify(s1));
  }
  // (g) THE LAW: 100 real scatter draws through the real flight, mortar in
  // a crosswind — every landing inside the ring the predictor promised.
  {
    const world = makeWorld({ field: flatField, seed: 72 });
    const SG = bareSG();
    const spec = { projSpeed: 33, occl: "lofted", windF: 0.04, windComp: 0.6 };
    const wind = { x: 2.5, z: 0, mag: 2.5 };
    const muzzle = { x: -20, y: 0.5, z: 0 }, aim = { x: 6, y: 0.9, z: 0 };
    const pr = predictRing(SG, muzzle, aim, spec, 0.02, wind, idUV);
    let worst = 0;
    for (let i = 0; i < 100; i++) {
      const dir = applyScatter(world, pr.rawDir, 0.02);
      const hit = flightImpact(SG, muzzle, dir, spec.projSpeed, spec, wind, idUV);
      worst = Math.max(worst, Math.hypot(hit.x - pr.center.x, hit.z - pr.center.z));
    }
    ok("TRUE RETICLE mk2.01(g): 100 drawn mortar rounds in a crosswind all land inside the predicted ring",
      worst <= pr.r + 0.25, `worst=${worst.toFixed(3)} r=${pr.r.toFixed(3)}`);
  }
  // (h) the rooftop: a mortar aimed at the wall's TOP lands ON the top —
  // flat ring on the roof, not a face hit.
  {
    const SG = wallSG();
    const spec = { projSpeed: 33, occl: "lofted", windF: 0 };
    const pr = predictRing(SG, { x: -20, y: 0.5, z: 0 }, { x: 11, y: 3.9, z: 0 }, spec, 0.005, null, idUV);
    ok("TRUE RETICLE mk2.01(h): a mortar aimed at the rooftop lands on the roof, flat",
      pr.center.wall === false && Math.abs(pr.center.y - 3) < 0.01 && pr.center.x >= 10 && pr.center.x <= 12.5,
      JSON.stringify(pr.center));
  }
  // (i) source pins: the surface law aims the guns, the fire paths honor
  // aim.y, the ring is the predictor's, the crosshair rides the ring.
  {
    const gameSrc = fs.readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");
    const stateSrc = fs.readFileSync(new URL("../../src/depot/state.js", import.meta.url), "utf8");
    const driversSrc = fs.readFileSync(new URL("../../src/depot/drivers.js", import.meta.url), "utf8");
    const rendSrc = fs.readFileSync(new URL("../../src/render/renderer.js", import.meta.url), "utf8");
    ok("TRUE RETICLE mk2.01(i) source pin: the frame loop reads the surface under the reticle",
      /S\.reticle\.y = surfaceAt\(T\.sight, S\.reticle\.x, S\.reticle\.z, invW\)\.y;/.test(gameSrc));
    ok("TRUE RETICLE mk2.01(i) source pin: all four possessed fire paths aim at the surface (aim.y)",
      (stateSrc.match(/aim\.y != null \? aim\.y : world\.field\.heightAt\(aim\.x, aim\.z\)/g) || []).length === 2 &&
      (driversSrc.match(/aim\.y != null \? aim\.y : world\.field\.heightAt\(aim\.x, aim\.z\)/g) || []).length === 2);
    ok("TRUE RETICLE mk2.01(i) source pin: the ring is the predictor's landing bound",
      /const pr9 = predictRing\(T\.sight, muzzle9, aim9, spec9, sig9, world\.wind, invW\);/.test(gameSrc));
    const block = String(rendSrc.match(/setReticle\(on, x, z, y, r, hit, pts\) \{[\s\S]*?\n    \},/) || "");
    ok("TRUE RETICLE mk2.01(i) source pin: the crosshair bars ride the ring, fog opted out",
      /PlaneGeometry\(0\.12, 0\.85\)/.test(block) && /fog: false/.test(block), block.length);
  }
}
// ==== end THE TRUE RETICLE (mk2.01) =========================================

// ==== THE TALL ORDER (mk2.02) ===============================================
// Footprint polygon, surface aim, automatic lob, convoy lockout, 2m men on
// one shared body table, and the ruled roster: grenadiers with their own
// throw, rocket troops for runners, mortars for the enemy, no heavy at all.
{
  const flatField = { heightAt: () => 0, dirty: false, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } };
  const idUV = (x, z) => ({ u: x, v: z });
  const bareSG = () => ({ nx: 32, nz: 32, cs: 2, halfU: 32, halfV: 32,
    seen1: new Uint8Array(32 * 32).fill(1), seen2: new Uint8Array(32 * 32),
    gnd: new Float32Array(32 * 32), occ: new Float32Array(32 * 32).fill(-Infinity) });

  // (a) the footprint: 16 landed points, each on the dirt it landed on.
  {
    const pr = predictRing(bareSG(), { x: -20, y: 1.5, z: 0 }, { x: 0, y: 0, z: 0 }, { projSpeed: 90, occl: "arc", windF: 0 }, 0.02, null, idUV);
    ok("TALL ORDER mk2.02(a): the predictor returns the 48-point laser footprint (re-taught mk2.05)", Array.isArray(pr.pts) && pr.pts.length === 48, pr.pts && pr.pts.length);
    ok("TALL ORDER mk2.02(a): on flat dirt every footprint point lies on the ground", pr.pts.every((p) => Math.abs(p.y) < 1e-6));
  }
  // (b) surface aim: the four possessed tgt lines carry the surface, no phantom.
  {
    const stateSrc = fs.readFileSync(new URL("../../src/depot/state.js", import.meta.url), "utf8");
    const driversSrc = fs.readFileSync(new URL("../../src/depot/drivers.js", import.meta.url), "utf8");
    ok("TALL ORDER mk2.02(b) source pin: ground aim targets the surface in all four fire paths",
      (stateSrc.match(/hy: sy - world\.field\.heightAt\(aim\.x, aim\.z\)/g) || []).length === 2 &&
      (driversSrc.match(/hy: sy - world\.field\.heightAt\(aim\.x, aim\.z\)/g) || []).length === 2);
  }
  // (c) THE AUTOMATIC LOB: clear line flat, walled line takes the mortar root.
  {
    const world = makeWorld({ field: flatField, seed: 81 });
    world.depotCombat = true;
    const shooter = addBody(world, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 1.0, hz: 0.28, x: 0, y: 1.0, z: 0, hp: 58 });
    const tgt = { pos: { x: 20, y: 0, z: 0 }, v: { x: 0, y: 0, z: 0 }, hy: 0 };
    world.events.length = 0;
    shooterFire(world, shooter, { x: 0, y: 1.5, z: 0 }, tgt, { ...BISON_FIRE.gun }, { attacker: "player", owner: shooter.id });
    const flat = world.events.find((e) => e.type === "muzzle");
    ok("TALL ORDER mk2.02(c): a clear line fires the flat root", flat && flat.dy < 0.35, flat && flat.dy);
    addBody(world, { kind: "wall", team: 1, mass: 0, hx: 0.9, hy: 1.8, hz: 0.2, x: 10, y: 1.8, z: 0, hp: 200 });
    world.events.length = 0;
    shooterFire(world, shooter, { x: 0, y: 1.5, z: 0 }, tgt, { ...BISON_FIRE.gun }, { attacker: "player", owner: shooter.id });
    const lob = world.events.find((e) => e.type === "muzzle");
    ok("TALL ORDER mk2.02(c): a wall across the line raises the barrel inside the 35° cap (re-taught mk2.03)",
      lob && lob.dy > flat.dy + 0.02 && lob.dy < Math.sin(35 * Math.PI / 180) + 0.02, lob && lob.dy);
  }
  // (d) the grant is exact; the rocket tower keeps the gentle arc.
  ok("TALL ORDER mk2.02(d): both tank guns and the tower GUN lob automatically",
    BISON_FIRE.gun.occl === "auto" && ENEMY_FIRE.tank.occl === "auto" && TOWER_SPECS.gun.occl === "auto");
  ok("TALL ORDER mk2.02(d): the rocket tower keeps the gentle arc", TOWER_SPECS.rocket.occl === "arc");
  // (e) THE CONVOY WAITS: the bell gate and the release-opens, pinned.
  {
    const stateSrc = fs.readFileSync(new URL("../../src/depot/state.js", import.meta.url), "utf8");
    const gameSrc = fs.readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");
    ok("TALL ORDER mk2.02(e) source pin: the bell's deal never opens over a live possession",
      /M\.cardUp = M\.hand\.length > 0 && !S\.possess;/.test(stateSrc));
    ok("TALL ORDER mk2.02(e) source pin: release opens the held deal",
      /if \(S\.manifest && S\.manifest\.hand\.length && !S\.manifest\.cardUp\) \{ S\.manifest\.cardUp = true;/.test(gameSrc));
  }
  // (f) ONE BODY: every enemy row IS MAN.rifle's body, and 2m.
  {
    const FIELDS = ["mass", "hx", "hy", "hz", "hp"];
    ok("TALL ORDER mk2.02(f): every enemy body reads the one MAN row",
      Object.keys(ENEMY_SPECS).every((k) => FIELDS.every((fd) => ENEMY_SPECS[k][fd] === MAN.rifle[fd])));
    ok("TALL ORDER mk2.02(f): the man stands two meters", MAN.rifle.hy === 1.0);
  }
  // (g) the 2m eye rides at 1.8m.
  {
    const e = eyeOf({ kind: "unit", pos: { x: 0, y: 1.0, z: 0 } });
    ok("TALL ORDER mk2.02(g): the infantry eye rides at 1.8m", Math.abs(e.y - 1.8) < 1e-9, e.y);
  }
  // (h) the drawn man stretches to the 2m body, depot-gated.
  {
    const rendSrc = fs.readFileSync(new URL("../../src/render/renderer.js", import.meta.url), "utf8");
    ok("TALL ORDER mk2.02(h) source pin: depot troops draw at the 2m stretch, demo untouched",
      /KIT\.bh \* \(world\.depotCombat \? 2\.0 \/ 1\.44 : 1\)/.test(rendSrc));
  }
  // (i) THE ROSTER: paired, armed, and the old names gone.
  {
    ok("TALL ORDER mk2.02(i): the rosters pair one-to-one, no heavy, no fast",
      !ENEMY_SPECS.heavy && !ENEMY_SPECS.fast && !!ENEMY_SPECS.mortar && !!ENEMY_SPECS.rocket &&
      !SQUAD_SPECS.runners && !SQUAD_SPECS.breakers && !!SQUAD_SPECS.rockets && !!SQUAD_SPECS.grenadiers);
    ok("TALL ORDER mk2.02(i): a thrown body on a 2s fuse (re-taught mk2.03)",
      INFANTRY_ARMS.grenadiers.thrown === true && GRENADE.fuse === 2.0 &&
      INFANTRY_ARMS.grenadiers.range < INFANTRY_ARMS.mortars.range);
    ok("TALL ORDER mk2.02(i): the shoulder rocket is armed on both sides' row",
      INFANTRY_ARMS.rockets.weapon === "rocket" && INFANTRY_ARMS.rockets.kind === "shell");
    ok("TALL ORDER mk2.02(i): the hand maps the new keys to the new tags",
      HAND_TAGS.sq_rockets === "rocket" && HAND_TAGS.sq_grenadiers === "gren" && HAND_TAGS.sq_mortars === "mortar" && HAND_TAGS.sq_breakers === undefined && HAND_TAGS.sq_runners === undefined);
  }
  // (j) the enemy's new hands fire: a mortar-team man lobs the mortar table,
  // a rocket man fires the rocket row — through the real branches.
  {
    const stateSrc = fs.readFileSync(new URL("../../src/depot/units.js", import.meta.url), "utf8");
    ok("TALL ORDER mk2.02(j) source pin: the grenadier/mortar branch reads the shared arms table",
      /INFANTRY_ARMS\[u\.tag === "mortar" \? "mortars" : "grenadiers"\]/.test(stateSrc));
    ok("TALL ORDER mk2.02(j) source pin: the rocket man fires the shared rocket row",
      /u\.tag === "rocket" \? INFANTRY_ARMS\.rockets/.test(stateSrc));
    ok("TALL ORDER mk2.02(j) source pin: the breaker ram is dead",
      !/stepBreakerRam/.test(stateSrc) && !/BREAKER_GRIND/.test(stateSrc));
  }
}
// ==== end THE TALL ORDER (mk2.02) ===========================================

// ==== THE GUN AND THE GRENADE (mk2.03) ======================================
// Actual elevation (the mortar root returns to the mortars), faces on every
// vertical, and the thrown 2.0s-fuse grenade.
{
  const flatField = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } };
  const idUV = (x, z) => ({ u: x, v: z });
  const bareSG = () => ({ nx: 32, nz: 32, cs: 2, halfU: 32, halfV: 32,
    seen1: new Uint8Array(32 * 32).fill(1), seen2: new Uint8Array(32 * 32),
    gnd: new Float32Array(32 * 32), occ: new Float32Array(32 * 32).fill(-Infinity) });

  // (a) elevation solves: clear ground takes the low root at full speed; a
  // wall raises the pitch inside the cap at a fitted, lower speed.
  {
    const world = makeWorld({ field: flatField, seed: 91 });
    const clear = elevSolve(world, { x: 0, y: 1.5, z: 0 }, { x: 20, y: 0, z: 0 }, { projSpeed: 85 }, 0);
    ok("GUN mk2.03(a): clear ground fires the low root at full speed", clear && clear.v === 85 && clear.pitch < 0.1, JSON.stringify(clear));
    addBody(world, { kind: "wall", team: 1, mass: 0, hx: 0.9, hy: 1.8, hz: 0.2, x: 10, y: 1.8, z: 0, hp: 200 });
    const walled = elevSolve(world, { x: 0, y: 1.5, z: 0 }, { x: 20, y: 0, z: 0 }, { projSpeed: 85 }, 0);
    ok("GUN mk2.03(a): the wall raises the barrel inside the 35° cap, speed fitted under full",
      walled && walled.pitch > 0.1 && walled.pitch <= 35 * Math.PI / 180 + 1e-9 && walled.v < 85, JSON.stringify(walled));
  }
  // (b) past the cap the gun holds: a tall wall right at the target's feet.
  {
    const world = makeWorld({ field: flatField, seed: 92 });
    addBody(world, { kind: "wall", team: 1, mass: 0, hx: 0.9, hy: 9, hz: 0.2, x: 18, y: 9, z: 0, hp: 999 });
    const sol = elevSolve(world, { x: 0, y: 1.5, z: 0 }, { x: 20, y: 0, z: 0 }, { projSpeed: 85 }, 0);
    ok("GUN mk2.03(b): an arc the cap cannot clear returns null — the gun holds its fire", sol === null, JSON.stringify(sol));
    world.events.length = 0;
    const shooter = addBody(world, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 1.0, hz: 0.28, x: 0, y: 1.0, z: 5, hp: 58 });
    shooterFire(world, shooter, { x: 0, y: 1.5, z: 0 }, { pos: { x: 20, y: 0, z: 0 }, v: { x: 0, y: 0, z: 0 }, hy: 0 }, { ...BISON_FIRE.gun }, { attacker: "player", owner: shooter.id });
    ok("GUN mk2.03(b): shooterFire fires nothing when no lawful arc exists", world.events.filter((e) => e.type === "muzzle").length === 0);
  }
  // (c) the barrel pitch rides the shooter: a fired auto shot writes _aimPitch.
  {
    const world = makeWorld({ field: flatField, seed: 93 });
    const shooter = addBody(world, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 1.0, hz: 0.28, x: 0, y: 1.0, z: 5, hp: 58 });
    shooterFire(world, shooter, { x: 0, y: 1.5, z: 0 }, { pos: { x: 20, y: 0, z: 0 }, v: { x: 0, y: 0, z: 0 }, hy: 0 }, { ...BISON_FIRE.gun }, { attacker: "player", owner: shooter.id });
    ok("GUN mk2.03(c): the fired pitch is written to the shooter for the barrel mesh", typeof shooter._aimPitch === "number");
  }
  // (d) faces by entry direction: a flat round entering below the top hits
  // the FACE even in the last 0.4m; a descending round takes the roof.
  {
    const SG = bareSG();
    for (let iz = 0; iz < 32; iz++) SG.occ[iz * 32 + 21] = 3;
    const grazeTop = flightImpact(SG, { x: 0, y: 2.8, z: 0 }, { x: 1, y: 0, z: 0 }, 100, { windF: 0 }, null, idUV);
    ok("GUN mk2.03(d): a flat round entering 0.2m under the top still hits the FACE", grazeTop.wall === true, JSON.stringify(grazeTop));
    const drop = flightImpact(SG, { x: 6, y: 26, z: 0 }, { x: 0.232, y: -0.97, z: 0 }, 25, { windF: 0 }, null, idUV);
    ok("GUN mk2.03(d): a descending round crossing the top takes the ROOF, flat", drop.wall === false && Math.abs(drop.y - 3) < 0.01, JSON.stringify(drop));
  }
  // (e) THE GRENADE: thrown as a body with exactly 2 draws; the fuse is 2.0s
  // from release; it never detonates on impact; a long lob bursts in the air.
  {
    const world = makeWorld({ field: flatField, seed: 94 });
    world.depotCombat = true;
    const man = addBody(world, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 1.0, hz: 0.28, x: 0, y: 1.0, z: 0, hp: 58 });
    let draws = 0; const raw = world.rng; world.rng = () => { draws++; return raw(); };
    const g = throwGrenade(world, man, { x: 0, y: 1.5, z: 0 }, { pos: { x: 8, y: 0, z: 0 }, v: { x: 0, y: 0, z: 0 } });
    ok("GRENADE mk2.03(e): the throw draws exactly twice (applyScatter's contract)", draws === 2, draws);
    ok("GRENADE mk2.03(e): the grenade is a live body owned by physics", g && g.alive && world.byId.get(g.id) === g);
    let boomed = null;
    for (let i = 0; i < 400; i++) {
      world.events.length = 0;
      stepWorld(world); stepGrenades(world);
      const b = world.events.find((e) => e.type === "boom" && e.kind === "grenade");
      if (b) { boomed = { t: world.t, e: b }; break; }
    }
    ok("GRENADE mk2.03(e): the fuse fires at 2.0s from release, not on impact",
      boomed && Math.abs(boomed.t - (g.grenade.t0 + 2.0)) < 0.03, boomed && (boomed.t - g.grenade.t0).toFixed(3));
    ok("GRENADE mk2.03(e): the spent grenade leaves the world", world.byId.get(g.id) === undefined);
  }
  // (f) the pair and the tables.
  ok("GRENADE mk2.03(f): grenadier squads are pairs", SQUAD_SPECS.grenadiers.n === 2);
  ok("GRENADE mk2.03(f): the grenade's dials — 2.0s fuse, 12m throw ceiling", GRENADE.fuse === 2.0 && INFANTRY_ARMS.grenadiers.range === 12);
  // (g) source pins: both sides throw; the barrels pitch; the sounds exist.
  {
    const stateSrc = fs.readFileSync(new URL("../../src/depot/state.js", import.meta.url), "utf8");
    const unitsSrc = fs.readFileSync(new URL("../../src/depot/units.js", import.meta.url), "utf8");
    const gameSrc = fs.readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");
    const rendSrc = fs.readFileSync(new URL("../../src/render/renderer.js", import.meta.url), "utf8");
    const audioSrc = fs.readFileSync(new URL("../../src/platform/audio.js", import.meta.url), "utf8");
    const boardSrc = fs.readFileSync(new URL("../../src/ui/SoundBoard.jsx", import.meta.url), "utf8");
    ok("mk2.03(g) source pin: squadFire and possessedVolley throw for grenadiers",
      (stateSrc.match(/throwGrenade\(world, u, muzzle/g) || []).length === 2);
    ok("mk2.03(g) source pin: the enemy grenadier throws the same grenade",
      /throwGrenade\(world, u, muzzle, tgt\)/.test(unitsSrc));
    ok("mk2.03(g) source pin: the sim steps the fuses", /stepGrenades\(world\);/.test(gameSrc));
    ok("mk2.03(g) source pin: vehicle and tower barrels wear the live pitch",
      (rendSrc.match(/g\.userData\.gunPitch\.rotation\.x = -\(b\._aimPitch \|\| 0\);/g) || []).length === 2);
    ok("mk2.03(g) source pin: the wave tank has a barrel to raise",
      /buildWaveTank/.test(rendSrc) && /b\.vtype === "tank" \? buildWaveTank\(b\.team\)/.test(rendSrc));
    ok("mk2.03(g) source pin: toss, bounce, and the grenade's own blast are voiced",
      /grenade: \(x, z\)/.test(audioSrc) && /gbounce/.test(audioSrc) && /function gblast/.test(audioSrc));
    ok("mk2.03(g) source pin: the soundboard benches all three",
      /id: "gren-toss"/.test(boardSrc) && /id: "gren-bounce"/.test(boardSrc) && /id: "gren-blast"/.test(boardSrc));
  }

  // (h) mk2.04: the grenade is SEEN — a per-frame pool setter exists and the
  // game layer feeds it the live grenades.
  {
    const rendSrc = fs.readFileSync(new URL("../../src/render/renderer.js", import.meta.url), "utf8");
    const gameSrc = fs.readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");
    ok("VISIBLE GRENADE mk2.04(h): the renderer pools green grenades blinking red",
      /function setGrenades\(list, t\)/.test(rendSrc) && /0x35ff6a/.test(rendSrc) && /0xff2020/.test(rendSrc) && /period = 0\.05 \+ 0\.11 \* left/.test(rendSrc));
    ok("VISIBLE GRENADE mk2.04(h): the game feeds the live grenades every frame",
      /R\.setGrenades\(world\._grenades, world\.t\);/.test(gameSrc));
  }

  // (i) mk2.05: THE LASER FOOTPRINT — 48 rays, one exported constant.
  ok("LASER mk2.05(i): the bound walks RING_RAYS = 48 rays", RING_RAYS === 48);
  // (j) mk2.05: THE TRUE MUZZLE — the tip sits at the end of the drawn tube,
  // forward of the hull and above the pivot, and the fire paths use it.
  {
    const v = { pos: { x: 0, y: 0.95, z: 0 } };
    const m = barrelTip(v, { x: 20, y: 0, z: 0 }, { projSpeed: 85 }, BARRELS.bison);
    ok("MUZZLE mk2.05(j): the Bison's tip sits ~4.2m forward of the hull center", m.x > 3.5 && m.x < 4.6 && Math.abs(m.z) < 0.3, JSON.stringify(m));
    ok("MUZZLE mk2.05(j): the tip rides at the tube's height, not the hull's", m.y > 2.2, m.y);
    const driversSrc = fs.readFileSync(new URL("../../src/depot/drivers.js", import.meta.url), "utf8");
    const gameSrc = fs.readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");
    ok("MUZZLE mk2.05(j) source pin: possessed and auto tank guns fire from the tip",
      (driversSrc.match(/barrelTip\(/g) || []).length >= 4);
    ok("MUZZLE mk2.05(j) source pin: the projector's light leaves the tip too",
      /muzzle9 = pb0 && P9\.kind === "vehicle" \? barrelTip\(pb0, aim9, spec9, pb0\.vtype === "tank" \? BARRELS\.tank : BARRELS\.bison\)/.test(gameSrc));
  }
}
// ==== end THE GUN AND THE GRENADE (mk2.03) ==================================
