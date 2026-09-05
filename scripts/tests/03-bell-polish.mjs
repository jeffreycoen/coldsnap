import { ok } from "./harness.mjs";
import { fatReg } from "./shared.mjs";
import { makeRunState, fireBell, BELL_PERIOD_S, squadFire, validatePlacement, spawnSquadMembers, spawnSandbag, SANDBAG_COST, WALL_COST, SANDBAG_FIELD_COST, WALL_FIELD_COST, WALL_LAY_PAUSE_S, spawnWallCourses, stepWallSupport, wallCourseHp, WALL_HP, WALL_COURSES, WALL_H, WALL_HALF, WALL_THIN, wallOrientAt, WALL_COURSE_PITCH, WALL_COURSE_HY, WALL_WELD_BREAK_F, WALL_UPPER_GROUP } from "../../src/depot/state.js";
import { makeWorld, addBody, fireProjectile, stepWorld, applyDamage, mulberry32 } from "../../src/engine/core.js";
import { TOWER_SPECS, ENEMY_SPECS, TANK, MASON, INFANTRY_ARMS, PLAYER_START, PLAYER_TIERS } from "../../src/depot/specs.js";
import { SQUAD_SPECS, makeSquad, stepSquad, clearSlot } from "../../src/depot/squads.js";
import { canBuild } from "../../src/depot/territory.js";
import { fwdUFor, invWFor, clampToRimFor } from "../../src/depot/orient.js";
import { TOWN } from "../../src/depot/mapgen.js";
import { startBuildLine, stepBuildLine } from "../../src/depot/buildlines.js";
import fs from "node:fs";

// ==== P1.5 TASK 1 — the tuning batch (mk0.50) ================================
// Seven changes, all Jeff-ratified numbers. The asserts below are the pins for
// the six that are product changes (the seventh was a measurement run).
{
  console.log("\n[mk0.50: the tuning batch]");

  // (1) the bell tightens. Everything downstream is expressed in BELL_PERIOD_S
  // already (the asserts above all do their bell math off the constant), so
  // this is the one place the literal is pinned.
  ok("mk0.50/1: BELL_PERIOD_S is 90 (re-pinned from 120)", BELL_PERIOD_S === 90, BELL_PERIOD_S);

  // (2) the formation tightens. Behavioural, not a source grep: a 4-man squad
  // under orders puts every man's goal on a 1.5m ring around the anchor. Flat
  // empty world, so clearSlot passes each slot through untouched.
  {
    const world = makeWorld({ field: { heightAt: () => 0, dirty: false, cs: 2, half: 40, carve: () => {}, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } }, seed: 77 });
    const sq = makeSquad(1, "rifles", 1, 0, 0);
    spawnSquadMembers(world, sq);
    sq.order = "move"; sq.dest = { x: 0, z: 30 };
    stepSquad(world, sq, 1 / 60);
    const radii = sq.memberIds.map((id) => {
      const u = world.byId.get(id);
      return Math.hypot(u.goal.x - sq.anchor.x, u.goal.z - sq.anchor.z);
    });
    const tight = radii.every((r) => Math.abs(r - 1.5) < 1e-6);
    ok("mk0.50/2: formation slots sit on a 1.5m ring (re-pinned from 2.4)", tight, radii.map((r) => r.toFixed(3)).join(","));
  }

  // (3) the interim price raise, +~50% on every PLAYER price, integers.
  {
    ok("mk0.50/3: squad prices raised (sniper 68, rifles 30, mg 38, sappers 38, mortars 45)",
      SQUAD_SPECS.sniper.cost === 68 && SQUAD_SPECS.rifles.cost === 30 && SQUAD_SPECS.mg.cost === 38
      && SQUAD_SPECS.sappers.cost === 38 && SQUAD_SPECS.mortars.cost === 45,
      JSON.stringify(Object.fromEntries(Object.entries(SQUAD_SPECS).map(([k, v]) => [k, v.cost]))));
    ok("mk0.50/3: tower prices raised (mg 23, gun 38, mortar 53, rocket 75)",
      TOWER_SPECS.mg.cost === 23 && TOWER_SPECS.gun.cost === 38 && TOWER_SPECS.mortar.cost === 53
      && TOWER_SPECS.rocket.cost === 75,
      JSON.stringify(Object.fromEntries(Object.entries(TOWER_SPECS).map(([k, v]) => [k, v.cost]))));
    ok("mk0.50/3: WALL_COST 8 and SANDBAG_COST 5", WALL_COST === 8 && SANDBAG_COST === 5, `${WALL_COST}/${SANDBAG_COST}`);
    ok("mk0.50/3: every raised price is an integer",
      [...Object.values(SQUAD_SPECS).map((s) => s.cost), ...Object.values(TOWER_SPECS).map((s) => s.cost), WALL_COST, SANDBAG_COST]
        .every((c) => Number.isInteger(c)));
    // The wall price exists ONCE — buildAt's fallback reads state.js's
    // constant instead of a bare 5 (re-pinned mk1.12 — the bar row died,
    // the harness fallback remains; re-aimed again mk1.13 — the spec path
    // now reads the living market's live price, the harness fallback still
    // pays WALL_COST flat).
    const wsrc = fs.readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");
    // The knowing asymmetry is documented where the raise is, not just in the
    // plan — a reader who finds a rich enemy finds the reason.
    const sqsrc = fs.readFileSync(new URL("../../src/depot/squads.js", import.meta.url), "utf8");
    ok("mk0.50/3: the interim cost asymmetry is written down beside the raised prices",
      /ASYMMETRY/.test(sqsrc) && /mercenary market/.test(sqsrc));
    ok("mk0.50/3 (re-taught mk2.02): enemy bounties were NOT raised with them — surviving rows pinned, the roster surgery's rows at their born values",
      ENEMY_SPECS.gren.bounty === 8 && ENEMY_SPECS.sapper.bounty === 7
      && ENEMY_SPECS.rocket.bounty === 8 && ENEMY_SPECS[""].bounty === 4 && TANK.bounty === 25);
  }

  // (4) the intel card stops auto-raising — pinned at the fireBell asserts
  // above; here we only confirm the report itself survives every bell, which
  // is what the bell chip re-reads.
  {
    const S = makeRunState();
    S.started = true; S.reg = fatReg();
    let composed = 0;
    for (let b = 1; b <= 3; b++) {
      S.reg.scrap += 200;
      fireBell(S, { reg: S.reg, snap: {}, rng: mulberry32(50 + b), t: b * BELL_PERIOD_S });
      if (S.lastDispatch && S.lastDispatch.lines.length > 0) composed++;
      if (S.intelUp !== false) composed = -99;
    }
    ok("mk0.50/4: the report is composed every bell and the card never raises itself", composed === 3, composed);
  }

  // (5) the first-manifest teaching line: bell 1 only, deterministic on the
  // bell index, nothing stored.
  {
    const src = fs.readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");
    ok("mk0.50/5: the teaching line renders on bell 1 only",
      /hud\.manifest\.bell === 1 &&/.test(src) && /The convoy returns each bell — plans build, hires march\./.test(src));
    ok("mk0.50/5: it is bell-index deterministic — no flag, no storage",
      !/taughtManifest|seenManifest|firstManifestShown/.test(src));
  }

  // (6) the off-map clamp. The rim is axis-aligned in CANONICAL space only, so
  // the clamp is proved at all four orientations — a world-space clamp would
  // pass at ORIENT 0 and cut corners at the other three.
  {
    const HU = 29, HV = 57;
    const inRim = (ORIENT, p) => { const c = invWFor(ORIENT, p.x, p.z); return Math.abs(c.u) <= HU + 1e-9 && Math.abs(c.v) <= HV + 1e-9; };
    let allIn = true, untouched = true, cornerOK = true;
    for (let ORIENT = 0; ORIENT < 4; ORIENT++) {
      for (const far of [{ x: 0, z: 400 }, { x: -400, z: 0 }, { x: 250, z: -250 }, { x: 0, z: -400 }, { x: 400, z: 400 }]) {
        if (!inRim(ORIENT, clampToRimFor(ORIENT, far.x, far.z, HU, HV))) allIn = false;
      }
      // a point already on the field comes back bit-identical
      const on = fwdUFor(ORIENT, 10, -20);
      const back = clampToRimFor(ORIENT, on.x, on.z, HU, HV);
      if (back.x !== on.x || back.z !== on.z) untouched = false;
      // corner honesty: only the axis that was out of bounds moves
      const one = fwdUFor(ORIENT, 200, 13); // u far out, v legal
      const clamped = clampToRimFor(ORIENT, one.x, one.z, HU, HV);
      const cl = invWFor(ORIENT, clamped.x, clamped.z);
      if (Math.abs(cl.u - HU) > 1e-9 || Math.abs(cl.v - 13) > 1e-9) cornerOK = false;
    }
    ok("mk0.50/6: an off-map tap clamps inside the rim at every orientation", allIn);
    ok("mk0.50/6: a destination already on the field is returned untouched", untouched);
    ok("mk0.50/6: only the out-of-bounds axis moves (canonical clamp, not a world-space box)", cornerOK);
    const src = fs.readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");
    ok("mk0.50/6: the order flow clamps at the ONE site where a tap becomes a dest (wee-t2b: map.clampToRim)",
      /const d = map\.clampToRim\(p\.x, p\.z\);/.test(src) && /gsq\.dest = \{ x: d\.x, z: d\.z \}/.test(src));
    // P7 T18: RIM_HALF_U/V moved to mapgen.js.
    const mgSrc050 = fs.readFileSync(new URL("../../src/depot/mapgen.js", import.meta.url), "utf8");
    ok("mk0.50/6: the rim half-extents exist once (inRim and the clamp share them)",
      /const RIM_HALF_U = 90, RIM_HALF_V = 90;/.test(mgSrc050) && !/halfU: 29, halfV: 57/.test(mgSrc050) && !/halfU: 29, halfV: 57/.test(src));
  }
}
// ==== end mk0.50 =============================================================

// ==== P1.5 TASK 2 — the masonry look (mk0.52) ================================
// A built wall stands as three welded courses that break one at a time, and a
// course with nothing under it falls. Nothing about the wall's footprint,
// height, price or cover moved — only how it comes apart.
{
  console.log("\n[mk0.52: the masonry look]");
  const flatF = { heightAt: () => 0, dirty: false, cs: 2, half: 40, carve: () => {}, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } };
  const wallsOf = (w) => w.bodies.filter((b) => b.kind === "wall");
  const chunksOf = (w) => w.bodies.filter((b) => b.kind === "chunk");

  // (a) THE STACK. Three bodies where there was one, same silhouette.
  {
    const world = makeWorld({ field: flatF, seed: 5 });
    const cs = spawnWallCourses(world, 0, 0, 0);
    ok("mk0.52/a: a wall is THREE kind-\"wall\" bodies (was one)",
      cs.length === WALL_COURSES && WALL_COURSES === 3 && wallsOf(world).length === 3);
    ok("mk0.52/a: courses are numbered bottom-up", cs.map((b) => b.course).join(",") === "0,1,2");
    ok("mk0.55/a: a course is a thin face — long axis 0.9, one block deep (Jeff: 3x3x1)",
      cs.every((b) => Math.max(b.hx, b.hz) === WALL_HALF && Math.min(b.hx, b.hz) === WALL_THIN));
    ok("mk0.55/a: orient 1 swaps the face to run along z",
      (() => { const w2 = makeWorld({ field: flatF, seed: 5 });
        const c2 = spawnWallCourses(w2, 0, 0, 0, 1);
        return c2.every((b) => b.hz === WALL_HALF && b.hx === WALL_THIN); })());
    ok("mk0.55/a: wallOrientAt continues a neighbouring wall's line",
      (() => { const w3 = makeWorld({ field: flatF, seed: 6 });
        spawnWallCourses(w3, 0, 0, 0, 0);
        return wallOrientAt(w3, 2, 0, 1) === 0 && wallOrientAt(w3, 30, 30, 1) === 1; })());
    // total silhouette: bottom face of course 0 to top face of course 2
    const lo = cs[0].pos.y - cs[0].hy, hi = cs[2].pos.y + cs[2].hy;
    ok("mk0.52/a: the wall still stands 1.8m, within one masonry joint",
      Math.abs(lo) < 0.02 && Math.abs(hi - WALL_H) < 0.02, `lo=${lo.toFixed(3)} hi=${hi.toFixed(3)}`);
    ok("mk0.52/a: courses sit on a 0.6m pitch with a real joint between them",
      Math.abs(cs[1].pos.y - cs[0].pos.y - WALL_COURSE_PITCH) < 1e-9
      && Math.abs((cs[1].pos.y - cs[1].hy) - (cs[0].pos.y + cs[0].hy) - 0.03) < 1e-9,
      `hy=${WALL_COURSE_HY}`);
    // NOT a split (the brief's word): with the support rule, everything aims
    // at the base course and the base's death drops the wall, so a split wall
    // is a third as durable. Measured 6 -> 2 grenadier rounds and 48 -> 17
    // rifle rounds; whole-hp courses measure 6 -> 6 and 48 -> 48, i.e. exactly
    // today's wall. The look changed, the fight did not.
    ok("mk0.52/a: every course carries the WHOLE 70hp wall, so the wall is as hard to drop as it ever was",
      cs.every((b) => b.hp === WALL_HP) && WALL_HP === 70 && wallCourseHp(0) === 70 && wallCourseHp(2) === 70,
      cs.map((b) => b.hp).join("/"));
    ok("mk0.52/a: every course carries its own maxHp", cs.every((b) => b.maxHp === b.hp));
    // sleeping discipline (the brief's trap): three static bodies where there
    // was one, all asleep at birth like spawnSandbag's cover.
    ok("mk0.52/a: courses spawn STATIC and ASLEEP", cs.every((b) => b.invM === 0 && b.sleeping === true));
    ok("mk0.52/a: two vertical welds at MASON strength",
      world.welds.length === 2 && world.welds.every((w) => w.breakF === WALL_WELD_BREAK_F && w.breakF === MASON.breakF),
      `${world.welds.length} welds @ ${world.welds[0] && world.welds[0].breakF}`);
    ok("mk0.52/a: the upper courses are grouped so ONE wall pays ONE wallKill",
      cs[0].group === "" && cs[1].group === WALL_UPPER_GROUP && cs[2].group === WALL_UPPER_GROUP);
    ok("mk0.52/a: the snow cap rides the TOP course", cs[2].capTop === true && cs[0].capTop === false && cs[1].capTop === false);
  }

  // (b) THE SUPPORT RULE. Shoot the base out and the wall comes down — this
  // is the ONLY collapse mechanism (static-static welds are solver-inert).
  {
    const world = makeWorld({ field: flatF, seed: 5 });
    const cs = spawnWallCourses(world, 0, 0, 0);
    ok("mk0.52/b: an intact wall drops nothing", stepWallSupport(world) === 0 && wallsOf(world).length === 3);
    // the live path kills a course and the death pass removes it before the
    // support pass runs; reproduce exactly that.
    applyDamage(world, cs[0], 1e9, { attacker: "enemy" });
    world.byId.delete(cs[0].id); world.bodies.splice(world.bodies.indexOf(cs[0]), 1);
    const fell = stepWallSupport(world);
    ok("mk0.52/b: base shot out -> BOTH courses above come down", fell === 2 && wallsOf(world).length === 0, `fell=${fell}`);
    const rubble = chunksOf(world);
    ok("mk0.52/b: they come down as DYNAMIC mass-100 chunks, awake",
      rubble.length === 2 && rubble.every((c) => c.mass === 100 && c.invM > 0 && c.sleeping === false), `${rubble.length} chunks`);
    ok("mk0.52/b: rubble is stamped for the 14-second sweep (bornT)", rubble.every((c) => c.bornT === world.t));
    ok("mk0.52/b: the fallen courses keep the hp they had left", rubble.every((c) => c.hp === WALL_HP));
    ok("mk0.52/b: nothing is left welded to a body that has gone", world.welds.every((w) => w.broken));
    // and they really fall: no support, gravity, they end up lower than they stood.
    const y0 = rubble.map((c) => c.pos.y);
    for (let i = 0; i < 240; i++) stepWorld(world);
    ok("mk0.52/b: and they FALL — both end up below where they stood",
      rubble.every((c, i) => c.pos.y < y0[i] - 0.3), rubble.map((c) => c.pos.y.toFixed(2)).join(","));
  }

  // (c) A MIDDLE course dies: the top falls, the bottom keeps standing and
  // takes the cap over.
  {
    const world = makeWorld({ field: flatF, seed: 5 });
    const cs = spawnWallCourses(world, 0, 0, 0);
    applyDamage(world, cs[1], 1e9, { attacker: "enemy" });
    world.byId.delete(cs[1].id); world.bodies.splice(world.bodies.indexOf(cs[1]), 1);
    const fell = stepWallSupport(world);
    const left = wallsOf(world);
    ok("mk0.52/c: middle course out -> only the top falls", fell === 1 && left.length === 1 && left[0].course === 0, `fell=${fell} left=${left.length}`);
    ok("mk0.52/c: the surviving bottom course takes the snow cap", left[0].capTop === true);
    ok("mk0.52/c: the ground keeps its wall — the cell's course is still alive", left[0].alive === true && left[0].hp === WALL_HP);
  }

  // (d) A TOP course dies and the wall just stands shorter — no cascade.
  {
    const world = makeWorld({ field: flatF, seed: 5 });
    const cs = spawnWallCourses(world, 0, 0, 0);
    applyDamage(world, cs[2], 1e9, { attacker: "enemy" });
    world.byId.delete(cs[2].id); world.bodies.splice(world.bodies.indexOf(cs[2]), 1);
    ok("mk0.52/d: losing the top course drops nothing else", stepWallSupport(world) === 0 && wallsOf(world).length === 2);
    ok("mk0.52/d: the cap moves down to the new top course",
      wallsOf(world).find((b) => b.course === 1).capTop === true && wallsOf(world).find((b) => b.course === 0).capTop === false);
  }

  // (e) Two walls on two footprints don't confuse each other's courses —
  // stacks are keyed by FOOTPRINT (ids do not survive a save).
  {
    const world = makeWorld({ field: flatF, seed: 5 });
    const a = spawnWallCourses(world, 0, 0, 0);
    spawnWallCourses(world, 6, 0, 0);
    world.byId.delete(a[0].id); world.bodies.splice(world.bodies.indexOf(a[0]), 1);
    const fell = stepWallSupport(world);
    ok("mk0.52/e: one wall collapsing leaves its neighbour standing",
      fell === 2 && wallsOf(world).filter((b) => b.pos.x === 6).length === 3, `fell=${fell}`);
  }

  // (f) The consumers of kind "wall". Every one of them was read and either
  // left alone (it works per body and wants to) or taught the difference.
  {
    const wsrc = fs.readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");
    const usrc = fs.readFileSync(new URL("../../src/depot/units.js", import.meta.url), "utf8");
    const ssrc = fs.readFileSync(new URL("../../src/depot/state.js", import.meta.url), "utf8");
    // stepDepot moved to sim.js (war-engine-extraction task 1) — the support
    // pass and the rubble-count pin below read its new home.
    const simSrc = fs.readFileSync(new URL("../../src/depot/sim.js", import.meta.url), "utf8");
    const bootSrc = fs.readFileSync(new URL("../../src/depot/boot.js", import.meta.url), "utf8");
    const tickSrc = fs.readFileSync(new URL("../../src/depot/tick.js", import.meta.url), "utf8");
    ok("mk0.52/f: the support pass runs in stepDepot, after the dead are cleared",
      /structureLost[\s\S]{0,700}stepWallSupport\(world\)/.test(simSrc));
    ok("mk0.52/f: resume re-claims the cell with the BOTTOM course", /if \(b\.course > 0\) continue;/.test(bootSrc));
    ok("mk0.52/f: one territory emitter per wall, not per course", /b\.kind === "wall" && b\.team === 1 && b\.alive && !b\.course/.test(bootSrc));
    ok("mk0.52/f: the counters count walls, not courses",
      /if \(b\.kind === "wall"\) \{ if \(!b\.course\) walls\+\+; continue; \}/.test(tickSrc) && /if \(b\.kind === "wall"\) \{ if \(!b\.course\) nw\+\+; \}/.test(wsrc));
    // mk1.93 re-teach: the one-wall-one-death shape moved off DepotGame's own
    // wallKill counter (retired with the kill law) into scoreKill's own
    // early-return — the upper courses never reach the killer's ledger.
    ok("mk1.93/f: one wall pays one death (scoreKill's upper-course exclusion, state.js)",
      /ev\.kind === "wall" && ev\.group === WALL_UPPER_GROUP\) return null;/.test(ssrc));
    ok("mk0.52/f: a course leaves a THIRD of the rubble (27 stones per wall, as before)",
      /ny: b\.kind === "tower" \? 4 : \(b\.course != null \? 1 : 3\)/.test(simSrc));
  }

  // (h) The crater re-seat. core.js drops static structures onto the ground
  // when a shell craters beside them so nothing floats over its own hole; it
  // assumed every structure rides exactly its own half-height. Courses do not,
  // and without the seatY generalisation the first crater beside a wall
  // imploded all three courses into one block at ground level (found in
  // staging, not in theory).
  {
    let carvedBy = 0;
    const craterF = { heightAt: () => -carvedBy, dirty: false, cs: 2, half: 40, carve: () => { carvedBy = 0.55; }, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } };
    const world = makeWorld({ field: craterF, seed: 5 });
    const cs = spawnWallCourses(world, 0, 0, 0);
    ok("mk0.52/h: a course records how high it rides above its ground",
      cs.map((b) => b.seatY).join("/") === "0.3/0.8999999999999999/1.5" || cs.every((b, i) => Math.abs(b.seatY - (i + 0.5) * WALL_COURSE_PITCH) < 1e-9),
      cs.map((b) => b.seatY).join("/"));
    // a real shell, cratering right beside the wall
    fireProjectile(world, { x: 1.6, y: 3, z: 0 }, { x: 0, y: -1, z: 0 }, 40,
      { kind: "shell", r: 2.3, kv: 8, dmg: 5, crater: 0.55, noImpact: true, attacker: "enemy" });
    for (let i = 0; i < 200 && world.projectiles.length; i++) stepWorld(world);
    const ys = cs.map((b) => b.pos.y);
    ok("mk0.52/h: after the crater the courses are still STACKED, not collapsed into one block",
      Math.abs(ys[1] - ys[0] - WALL_COURSE_PITCH) < 1e-6 && Math.abs(ys[2] - ys[1] - WALL_COURSE_PITCH) < 1e-6,
      ys.map((y) => y.toFixed(3)).join(","));
    ok("mk0.52/h: and they followed the ground down into the crater",
      Math.abs(ys[0] - (-0.55 + WALL_COURSE_PITCH / 2)) < 1e-6, ys[0].toFixed(3));
    const csrc = fs.readFileSync(new URL("../../src/engine/core.js", import.meta.url), "utf8");
    ok("mk0.52/h: the core re-seat is a guarded ADDITIVE divergence — no seatY, no change",
      /s\.seatY != null \? s\.seatY : s\.hy/.test(csrc));
  }

  // (g) The seams are a RENDER inset — the bodies keep their true size, so
  // nothing about cover, sightlines or occupancy moved with the look.
  {
    const rsrc = fs.readFileSync(new URL("../../src/render/renderer.js", import.meta.url), "utf8");
    ok("mk0.52/g: walls and sandbags draw inset so the outline finds the joints",
      /const SEAM_XZ = 0\.05, SEAM_Y = 0\.045, SEAM_BAG = 0\.04;/.test(rsrc)
      && /b\.hx - SEAM_XZ/.test(rsrc) && /b\.sandbag \? SEAM_BAG : 0/.test(rsrc));
    ok("mk0.54/g: the block pool holds 27 instances per wall (3x3 per course, ~85 walls fully drawn)",
      /const WALL_INST = 2304;/.test(rsrc) && /wi >= WALL_INST/.test(rsrc) && /WALL_BLOCKS = 3/.test(rsrc));
    ok("mk0.52/g: one snow cap per wall, on the top living course",
      /b\.capTop !== false && wci < 256/.test(rsrc));
  }
}
// ==== end mk0.52 =============================================================

// ==== mk0.60: ENGINEERS, THE TWO-POINT BUILD =================================
// P1.5 Task 4. The order machine's half lives here (squads.js/state.js are
// headless); the LINE ITSELF — rasterisation, costs, placement — lives in the
// game layer, so what can be asserted offline is the module contract plus the
// source shape of the game-layer rules that must not silently drift.
{
  console.log("\n[mk0.60: engineers, the two-point build]");
  const flat = { heightAt: () => 0, dirty: false, cs: 2, half: 40, carve: () => {}, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } };

  // (1) the team itself: two men, 30 scrap, and no weapon anywhere in the stack.
  ok("mk0.60/1: SQUAD_SPECS.engineers is a two-man team at 30 scrap",
    SQUAD_SPECS.engineers && SQUAD_SPECS.engineers.n === 2 && SQUAD_SPECS.engineers.cost === 30
    && SQUAD_SPECS.engineers.label === "ENGINEER TEAM", JSON.stringify(SQUAD_SPECS.engineers));
  ok("mk0.60/1: engineers carry no arms entry at all (like sappers)",
    !INFANTRY_ARMS.engineers && !INFANTRY_ARMS.sappers);

  // (2) the starting kit: rifles + engineers only — masonry is engineer work.
  ok("mk0.60/2 (re-taught P7.2 T3): PLAYER_START is EMPTY — the bare bar; every option is bought off the hand", PLAYER_START.length === 0, PLAYER_START.join(","));
  ok("mk0.60/2: the engineer team is NOT on the convoy's ladder (it is never offered twice)",
    PLAYER_TIERS.every((tier) => tier.indexOf("sq_engineers") < 0));

  // (3) the field discount, and the pause.
  ok("mk0.60/3: field bags 3 (menu 5), field walls 5 (menu 8)",
    SANDBAG_FIELD_COST === 3 && WALL_FIELD_COST === 5 && SANDBAG_COST === 5 && WALL_COST === 8,
    `${SANDBAG_FIELD_COST}/${SANDBAG_COST} ${WALL_FIELD_COST}/${WALL_COST}`);
  ok("mk0.60/3: the field always undercuts the menu", SANDBAG_FIELD_COST < SANDBAG_COST && WALL_FIELD_COST < WALL_COST);
  ok("mk0.60/3: a wall costs the squad ~1.5s standing still", WALL_LAY_PAUSE_S === 1.5, WALL_LAY_PAUSE_S);

  // (4) squadFire: an engineer never pulls a trigger, and a BUILDING squad of
  // any type keeps quiet — neither path draws.
  {
    const world = makeWorld({ field: flat, seed: 91 });
    const eng = makeSquad(1, "engineers", 1, 0, 0);
    spawnSquadMembers(world, eng);
    // a live enemy right on top of them, so silence cannot be an empty scan
    addBody(world, { kind: "unit", team: 2, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x: 2, y: 0.88, z: 0, hp: 58 });
    const before = world.bodies.length;
    eng.order = "defend";
    for (let i = 0; i < 60; i++) squadFire(world, eng, 1 / 60);
    ok("mk0.60/4: an engineer team never fires (no round ever leaves it)", world.bodies.length === before, `${world.bodies.length} vs ${before}`);
    const rif = makeSquad(2, "rifles", 1, 0, 0);
    spawnSquadMembers(world, rif);
    rif.order = "build"; rif.dest = { x: 0, z: 20 };
    const before2 = world.bodies.length;
    for (let i = 0; i < 60; i++) squadFire(world, rif, 1 / 60);
    ok("mk0.60/4: order 'build' is a quiet order, exactly as 'move' is", world.bodies.length === before2, `${world.bodies.length} vs ${before2}`);
  }

  // (5) stepSquad rides MOVE's machine for BUILD — it does not fork it. Same
  // travel, same arrival-into-defend (which is the dig-in), threat read forced
  // false, and the one-draw-per-leg contract untouched.
  {
    const mk = (order) => {
      const world = makeWorld({ field: flat, seed: 93 });
      const sq = makeSquad(1, "engineers", 1, 0, 0);
      spawnSquadMembers(world, sq);
      sq.order = order; sq.dest = { x: 0, z: 26 };
      let draws = 0;
      const raw = world.rng;
      world.rng = () => { draws++; return raw(); };
      let arrivedAt = -1;
      for (let i = 0; i < 3000; i++) {
        stepSquad(world, sq, 1 / 60);
        stepWorld(world);
        if (sq.order === "defend" && arrivedAt < 0) { arrivedAt = i; break; }
      }
      return { draws, arrivedAt, anchor: { x: sq.anchor.x, z: sq.anchor.z } };
    };
    const mv = mk("move"), bd = mk("build");
    ok("mk0.60/5: a BUILD squad travels and arrives exactly as a MOVE squad does",
      bd.arrivedAt > 0 && bd.arrivedAt === mv.arrivedAt, `build=${bd.arrivedAt} move=${mv.arrivedAt}`);
    ok("mk0.60/5: arrival flips the order to defend — the men dig in at the far end",
      Math.abs(bd.anchor.z - 26) < 1.01, bd.anchor.z.toFixed(2));
    ok("mk0.60/5: BUILD spends the identical number of rng draws MOVE does (no new draws)",
      bd.draws === mv.draws, `build=${bd.draws} move=${mv.draws}`);
    // ...and the threat read really is forced false: a squad surrounded by
    // enemies still double-times, so its leg count (and draw count) is unmoved.
    const world = makeWorld({ field: flat, seed: 93 });
    const sq = makeSquad(1, "engineers", 1, 0, 0);
    spawnSquadMembers(world, sq);
    for (let k = 0; k < 6; k++) addBody(world, { kind: "unit", team: 2, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x: -4 + k, y: 0.88, z: 3, hp: 58 });
    sq.order = "build"; sq.dest = { x: 0, z: 26 };
    stepSquad(world, sq, 1 / 60);
    ok("mk0.60/5: under fire a BUILD leg still reads unthreatened (MOVE's rule)", sq._threatened === false, String(sq._threatened));
  }

  // (6) the game layer's rules, by source shape — the line machinery needs a
  // live world/grid/territory to run, so what is pinned here is that the rules
  // the brief fixed are actually written where they are claimed to be.
  {
    const dsrc = fs.readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");
    const muSrc60 = fs.readFileSync(new URL("../../src/depot/muster.js", import.meta.url), "utf8");
    // P7 T20: the lay machinery (lineCells/startBuildLine/linePieces/
    // layPieceAt/stepBuildLine) moved to buildlines.js — the pins below on
    // that literal text retarget there (sweep license, unchanged content).
    const blSrc60 = fs.readFileSync(new URL("../../src/depot/buildlines.js", import.meta.url), "utf8");
    ok("mk0.60/6: the two taps are start-then-end, and a re-tap of the armed chip cancels",
      /if \(!view\.buildPt0\) \{ view\.buildPt0 = \{ x: d\.x, z: d\.z \}/.test(dsrc)
      && /if \(view\.orderMode === kind\) \{ view\.orderMode = null; view\.buildPt0 = null; return; \}/.test(dsrc));
    // re-pinned COMMAND T2 (mk0.84): a second clamp site joined the first —
    // re-placing a picked-up endpoint of a proposed line clamps the same way
    // (tapAt's S.linePending block). Both taps of the ORIGINAL two-point
    // order still go through the one `const d = ...` site; the count moved
    // from 1 to 2 honestly, not loosened.
    // re-pinned POSSESSION T2 (mk0.91): a THIRD site had joined the same call
    // shape — the possessed-squad aim tap. re-pinned POSSESSION T4 (mk0.93):
    // that site is GONE — tapAt's possession branch no longer clamps an aim
    // to the rim at all (a tap while possessed is consumed and does
    // nothing; the reticle is bounded by the sight circle, not clampToRim).
    // Count moves back 3 -> 2, honestly, one caller lost, not loosened.
    // re-pinned P7 T2 (mk1.31): consumeVehOrderTap (the Bison's MOVE/PATROL
    // ground tap) joined the same clamp shape — a fourth caller, count 2 -> 3.
    // re-pinned mk2.25: devSpawnAt (the enemy rack's placer, sandbox only)
    // joined the same clamp shape — a fifth caller, count 3 -> 4.
    ok("mk0.60/6: the cell walk steps ONE axis at a time (consecutive cells share an EDGE) (retargeted mk1.50, P7 T20: lineCells moved to buildlines.js)",
      /const stepX = z === g1\.gz \? true : x === g1\.gx \? false : 2 \* err > -dz;/.test(blSrc60));
    // Jeff, 2026-08-12: ONE rotation for the whole line — the dominant axis of
    // start->end, decided once at order time. NOT per-step; and the
    // auto-continue conventions must never override it.
    ok("mk0.60/6: one rotation per line, taken from the order's dominant axis (retargeted mk1.50, P7 T20: startBuildLine/layPieceAt moved to buildlines.js)",
      /const orient = len > 1e-6 \? \(Math\.abs\(dxw\) >= Math\.abs\(dzw\) \? 0 : 1\) : null;/.test(blSrc60)
      && /const orient = job\.orient != null \? job\.orient/.test(blSrc60));
    ok("mk0.60/6: no per-cell rotation survives anywhere in the line machinery",
      !/row\.orient/.test(dsrc));
    ok("mk0.60/6: placement runs the real spawners and the real gate (retargeted mk1.50, P7 T20: layPieceAt moved to buildlines.js) (re-taught P7.1 T7)",
      /spawnWallCourses\(world, row\.x, field\.heightAt\(row\.x, row\.z\), row\.z, orient, team\)/.test(blSrc60)
      && /spawnSandbag\(world, row\.x, row\.z, orient, team\)/.test(blSrc60)
      && /const v = validatePlacement\(\{\n\s+blocked: !!\(cell\.blocked \|\| cell\.wallId\), ice: !!cell\.ice,\n\s+held: canBuildFor\(T, c0\.u, c0\.v, team\), resources: S\.resources, cost,/.test(blSrc60));
    ok("mk0.60/6: an occupied cell is SKIPPED, scrap running dry stops the line (retargeted mk1.50, P7 T20: layPieceAt/stepBuildLine moved to buildlines.js)",
      /return v\.msg === "NO SCRAP" \? "dry" : "skip";/.test(blSrc60) && /job\.dry = true;/.test(blSrc60));
    ok("mk0.60/6: a wall lay holds the squad on squad._pauseT, the existing dwell field (retargeted mk1.50, P7 T20: stepBuildLine moved to buildlines.js)",
      /sq\._pauseT = WALL_LAY_PAUSE_S;/.test(blSrc60));
    ok("mk0.60/6 (re-pinned mk1.32, P7 T3: seedBags(depotT, streamKey) generalized to both depots;" +
      " retargeted mk1.49, P7 T19: seedBags moved to muster.js;" +
      " re-taught P7.1 T6: THE BARE OPENING kills the seeded bag rings — the call sites left" +
      " DepotGame, the function's own draw-off-a-MAP-seed-stream shape stays exported for Task 7;" +
      " wee-t2b: seedBags takes map, streams off map.MAP_SEED)" +
      " the seeded depot bags draw off a MAP-seed stream, never world.rng",
      /mulberry32\(map\.MAP_SEED \^ streamKey\)/.test(muSrc60) &&
      !/seedBags\(world, grid, TOWN\.find\(\(t\) => t\.depot && t\.team !== 2\), 0x5ba6, stampBag\);/.test(dsrc) &&
      !/seedBags\(world, grid, TOWN\.find\(\(t\) => t\.depot && t\.team === 2\), 0x5ba7, stampBag\);/.test(dsrc) &&
      /const nBags = 4 \+ Math\.floor\(bagR\(\) \* 3\);/.test(muSrc60));
    // the geometry the line is built on, written down where a reader will look
    ok("mk0.60/6: the piece-vs-pitch geometry and the one-rotation rule are documented",
      /GEOMETRY, stated once/.test(dsrc) && /ONE ROTATION FOR THE WHOLE LINE/.test(dsrc));
    const ssrc = fs.readFileSync(new URL("../../src/depot/save.js", import.meta.url), "utf8");
    ok("mk0.60/6: the half-laid line is reset-on-resume, and says so",
      /THE BUILD LINE IS DELIBERATELY NOT SAVED/.test(ssrc));
  }

  // (7) the piece-vs-pitch arithmetic itself: both pieces are 1.8m along their
  // long axis on a 2.0m grid, so a straight run is end-to-end bar a 0.2m joint.
  {
    const world = makeWorld({ field: flat, seed: 95 });
    const bag = spawnSandbag(world, 0, 0, 0);
    const wall = spawnWallCourses(world, 6, 0, 0, 0)[0];
    ok("mk0.60/7: bag and wall course share one long axis — 1.8m — on a 2.0m pitch",
      bag.hx * 2 === 1.8 && wall.hx * 2 === 1.8, `${bag.hx * 2}/${wall.hx * 2}`);
    ok("mk0.60/7: consecutive cells therefore leave a 0.2m joint, nothing wider",
      Math.abs(2.0 - bag.hx * 2 - 0.2) < 1e-9);
  }
}
// ==== end mk0.60 =============================================================

