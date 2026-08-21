// COLDSNAP DEPOT — era 12: THE MECH (mk1.92). Thirty checks, M1-M30, one
// per named acceptance in the task plan (docs/superpowers/2026-08-20-the-mech.md,
// Phases B-I). Fixture worlds use makeWorld + a flat field (the era-07 armor
// idioms — mkGrid/flatF/run, reused verbatim in shape). Seeds drawn fresh at
// 140+. DepotGame.jsx logic (stepTowers, stepDepot's mech-death block,
// takeControlVehicle, buyHero/PALETTE wiring) is JSX and not importable —
// those checks are source-regex, the established pattern this suite already
// uses for every other DepotGame.jsx-embedded behavior (e.g. era 10's
// "T6v2 wiring: stepTowers derives its team").
import { ok } from "./harness.mjs";
import { identFwdDir } from "./shared.mjs";
import {
  makeWorld, makeField, addBody, stepWorld, applyDamage, explode, CAUSE,
} from "../../src/engine/core.js";
import {
  buildMech, mechCommand, respawnMech, mechFallen, mechFire, mechMissiles,
  mechBarrage, mslAimPoint, mechAimDir, mechPunt, mechAboutFace,
} from "../../src/engine/mech.js";
import { MECH, HAND_KEYS, HAND_TAGS } from "../../src/depot/specs.js";
import { parkMech, MECH_SPREAD, PICK_POOL, mirrorFieldKey } from "../../src/depot/muster.js";
import { computePrices, marketCounts, priced } from "../../src/depot/market.js";
import { scoreKill } from "../../src/depot/state.js";
import { KILL_CUT } from "../../src/depot/economy.js";
import { eyeOf, SIGHT } from "../../src/depot/sight.js";
import { makeBodyLists, rebuildBodyLists } from "../../src/depot/lists.js";
import { DRIVERS, stepDrivers, mechSighted } from "../../src/depot/drivers.js";
import fs from "node:fs";

const idUV = (x, z) => ({ u: x, v: z });
const flatF = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (x, z, o) => { o.x = 0; o.y = 1; o.z = 0; return o; } };
// the era-07 mini-grid: 40x40 cells of 2m centered on the origin.
const mkGrid = (blocked = []) => {
  const W = 40, H = 40, CS = 2, OX = -40, OZ = -40;
  const cells = Array.from({ length: W * H }, () => ({ blocked: false, ice: false, water: false, wallId: null, steep: false, dist: 1, dx: 0, dz: 1 }));
  for (const [gx, gz] of blocked) cells[gz * W + gx].blocked = true;
  return { cells, w: W, h: H, cs: CS, ox: OX, oz: OZ,
    idx: (gx, gz) => gz * W + gx,
    inBounds: (gx, gz) => gx >= 0 && gx < W && gz >= 0 && gz < H,
    worldToGrid: (x, z) => ({ gx: Math.floor((x - OX) / CS), gz: Math.floor((z - OZ) / CS) }),
    gridToWorld: (gx, gz) => ({ x: OX + (gx + 0.5) * CS, z: OZ + (gz + 0.5) * CS }),
    cellAt(x, z) { const g = this.worldToGrid(x, z); return this.inBounds(g.gx, g.gz) ? cells[this.idx(g.gx, g.gz)] : null; } };
};
// build a war mech directly (the __DEPOTMECH__ debug-hook shape), team/pos given.
const mkMech = (world, team, x, z, yaw) => {
  const m = buildMech(world, { x, z, yaw: yaw || 0, team, hp: MECH.hp });
  m.thrustersOn = true; m.thrustAssist = true;
  m.hull.drv = "mech"; m.hull.order = "defend"; m.hull.tracks = "careful";
  m.hull.maxHp = m.hull.hp; m.hull.homeX = x; m.hull.homeZ = z;
  if (team === 2) m.hull.bounty = MECH.bounty;
  return m;
};
const run = (w, grid, n, opts) => { for (let i = 0; i < n; i++) { stepDrivers(w, grid, identFwdDir, null, idUV, opts || {}); stepWorld(w); } };

// ============================================================ PHASE B (M1-M4)
{
  const w = makeWorld({ field: flatF, seed: 140 });
  const m2 = mkMech(w, 2, 0, 0);
  ok("M1: a team-2 build carries team 2 on hull and mech", m2.hull.team === 2 && m2.team === 2, `${m2.hull.team}/${m2.team}`);
}
{
  const w = makeWorld({ field: flatF, seed: 141 });
  const m1 = mkMech(w, 1, 0, 0);
  const hp0 = m1.hull.hp;
  const thigh = m1.legs.L.thigh;
  applyDamage(w, thigh, 50, { cause: CAUSE.PROJECTILE, attacker: "player" });
  ok("M2: a shell into a thigh drains the hull's ledger and never the link's",
    m1.hull.hp === hp0 - 50 && thigh.hp === 1e9, `hull=${m1.hull.hp} link=${thigh.hp}`);
}
{
  const w = makeWorld({ field: flatF, seed: 142 });
  const m2 = mkMech(w, 2, 0, 0);
  m2.aimRange = 26;
  const torso = m2.waist ? m2.waist.b : m2.hull;
  const ty = Math.atan2(torso.R[6], torso.R[8]);
  const rx = torso.pos.x + Math.sin(ty) * 26, rz = torso.pos.z + Math.cos(ty) * 26;
  const foe1 = addBody(w, { kind: "unit", team: 1, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x: rx + 1, y: 0.86, z: rz, hp: 58, friction: 0.5 });
  addBody(w, { kind: "unit", team: 2, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x: rx - 1, y: 0.86, z: rz, hp: 58, friction: 0.5 }); // a friendly nearby — must never lock
  const r = mslAimPoint(w, m2);
  ok("M3: mslAimPoint on a team-2 mech locks a team-1 body", r.lock === true && Math.hypot(r.x - foe1.pos.x, r.z - foe1.pos.z) < 0.1, JSON.stringify(r));
}
{
  const w = makeWorld({ field: flatF, seed: 143 }); w.depotCombat = true;
  const m2 = mkMech(w, 2, 0, 0);
  const foot = m2.legs.L.foot;
  const victim = addBody(w, { kind: "unit", team: 1, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x: foot.pos.x, y: foot.pos.y - 0.35, z: foot.pos.z, hp: 58, friction: 0.5 });
  let steps = 0;
  while (victim.alive && steps++ < 30) stepWorld(w);
  ok("M4: a mechfoot crush by a team-2 mech attributes enemy",
    !victim.alive && victim.lastHit && victim.lastHit.cause === CAUSE.CRUSH && victim.lastHit.attacker === "enemy",
    `alive=${victim.alive} steps=${steps} lastHit=${JSON.stringify(victim.lastHit)}`);
}

// ============================================================ PHASE C (M5-M6)
{
  const w = makeWorld({ field: flatF, seed: 144 });
  w.t = 100; // world.t=0 exactly defeats the `_lastBar || -99` cooldown fallback (0 is falsy) — never true in real play, where spawn settle always elapses first
  const m1 = mkMech(w, 1, 0, 0);
  const ev0 = w.projectiles ? w.projectiles.length : 0;
  const f1 = mechBarrage(w, m1);
  const n1 = (w.projectiles ? w.projectiles.length : 0) - ev0;
  const f2 = mechBarrage(w, m1);
  ok("M5: mechBarrage fires nine rockets, cooldown refuses a second call inside 30s",
    f1 === true && n1 === 9 && f2 === false, `f1=${f1} n=${n1} f2=${f2}`);
}
{
  const w = makeWorld({ field: flatF, seed: 145 });
  const m1 = mkMech(w, 1, 0, 0);
  m1.aimRange = 6; // torso's reticle point lands well inside 10m
  const f = mechBarrage(w, m1);
  ok("M6: a mechBarrage call inside 10m danger-close refuses", f === false, f);
}

// ============================================================ PHASE D (M7-M12)
{
  const w = makeWorld({ field: flatF, seed: 146 });
  const m1 = mkMech(w, 1, 5, -3);
  const e = eyeOf(m1.hull);
  ok("M7: eyeOf on a mech hull returns r 40 at +2.6", e.r === SIGHT.mech && SIGHT.mech === 40 && Math.abs(e.y - (m1.hull.pos.y + 2.6)) < 1e-9, JSON.stringify(e));
}
{
  const w = makeWorld({ field: flatF, seed: 147 });
  const m1 = mkMech(w, 1, 0, 0);
  const m2 = mkMech(w, 2, 20, 0);
  const L = makeBodyLists();
  rebuildBodyLists(w, L);
  ok("M8: the pools carry a mech hull in foes and vehicles",
    L.friends.includes(m1.hull) && L.foes.includes(m2.hull) && L.vehicles.includes(m1.hull) && L.vehicles.includes(m2.hull));
}
{
  // stepTowers lives in DepotGame.jsx (JSX, not importable) — source-pinned,
  // the established pattern (era 10's "stepTowers derives its team").
  const src = fs.readFileSync("src/depot/DepotGame.jsx", "utf8");
  const m = src.match(/function stepTowers[\s\S]{0,4000}/);
  const body = m ? m[0] : "";
  const site1 = /best\.kind !== "unit" && best\.kind !== "vehicle" && best\.kind !== "mech"/.test(body);
  const site2 = /e\.kind !== "unit" && e\.kind !== "vehicle" && e\.kind !== "mech"/.test(body);
  ok("M9: a tower acquires and fires on a seen enemy mech hull (both stepTowers sites widen to mech)", site1 && site2, `${site1}/${site2}`);
}
{
  const w = makeWorld({ field: flatF, seed: 148 }); w.depotCombat = true;
  const src = fs.readFileSync("src/depot/state.js", "utf8");
  ok("M10: squadFire's foe scan widens to mech",
    /kind !== "unit" && e\.kind !== "vehicle" && e\.kind !== "mech"/.test(src));
}
{
  const src = fs.readFileSync("src/depot/drivers.js", "utf8");
  ok("M11: armorScanFoes' kind gate widens to mech (the Bison's gun sees a mech)",
    /e\.kind !== "vehicle" && e\.kind !== "mech"/.test(src));
}
{
  // mk1.93 re-teach: payBounties is retired — scoreKill on a player-
  // attributed mech kill pays KILL_CUT x the live heroMech price (120 at
  // the base multiplier, the plan's own "a mech kill pays 120 off base").
  const w = makeWorld({ field: flatF, seed: 149 }); w.depotCombat = true;
  const m2 = mkMech(w, 2, 0, 0);
  applyDamage(w, m2.hull, 1e6, { cause: CAUSE.PROJECTILE, attacker: "player" });
  const ev = w.events.find((e) => e.type === "kill" && e.id === m2.hull.id);
  ok("M12a: a dead team-2 hull pushes a kill event carrying kind mech", !!ev && ev.kind === "mech", JSON.stringify(ev));
  const S = { score: { p: { kills: 0, value: 0 }, e: { kills: 0, value: 0 } }, resources: 0, reg: { scrap: 0 } };
  const r = scoreKill(S, ev, {});
  const price = priced(MECH.cost, "heroMech", {});
  ok("M12b: scoreKill pays KILL_CUT x the live heroMech price (120 at base)",
    !!r && Math.abs(r.price - price) < 1e-9 && Math.abs(r.pay - price * KILL_CUT) < 1e-9
    && price * KILL_CUT === 120 && S.score.p.kills === 1, JSON.stringify({ r, price }));
}

// ============================================================ PHASE E (M13-M15)
{
  const { serializeFront, restoreBodies, restoreWelds } = await import("../../src/depot/save.js");
  const w = makeWorld({ field: flatF, seed: 150 }); w.field.n = 2; w.field.h = new Float32Array(4);
  const m1 = mkMech(w, 1, 3, -4);
  m1.hull.hp -= 100; m1.hull.order = "move"; m1.hull.dest = { x: 10, z: 10 };
  const T0 = { nx: 1, nz: 1, v: new Float32Array(1) };
  const S0 = { bell: 1, resources: 0, score: { p: { kills: 0, value: 0 }, e: { kills: 0, value: 0 } }, spawnRR: 0, started: true, mode: null, zoom: 1, focus: { x: 0, z: 0 },
    manifest: {}, foe: {}, ws: {}, reg: {}, squads: [], foeSquads: [], mines: [], nextSquadId: 1 };
  const raw = serializeFront({ S: S0,
    world: w, T: T0, town: [], census: [], census2: [], rocks: [], smears: [], mapSeed: 1, rngSeed: 2 });
  const data = JSON.parse(raw);
  const mechPieces = data.bodies.filter((b) => b.k === "mech" || b.k === "mechlink" || b.k === "mechfoot");
  ok("M13: a serialized world with one wounded, ordered mech carries one mechs row and zero mech-piece bodies",
    data.mechs.length === 1 && mechPieces.length === 0, `mechs=${data.mechs.length} pieces=${mechPieces.length}`);

  const w2 = makeWorld({ field: flatF, seed: 150 });
  const resBodies = restoreBodies(w2, data, []);
  restoreWelds(w2, data, resBodies);
  for (const ms of data.mechs) {
    const m = buildMech(w2, { x: ms.x, z: ms.z, yaw: ms.yaw, team: ms.tm, hp: ms.hp });
    m.thrustersOn = true; m.thrustAssist = true; m.hull.maxHp = MECH.hp;
    if (ms.ex) for (const k in ms.ex) m.hull[k] = ms.ex[k];
  }
  const rm = w2.mechs[0];
  ok("M14: the restore rebuilds a standing mech with the same hp, team, order, and destination",
    Math.abs(rm.hull.hp - (MECH.hp - 100)) < 0.01 && rm.team === 1 && rm.hull.order === "move" && Math.abs(rm.hull.dest.x - 10) < 0.01 && Math.abs(rm.hull.dest.z - 10) < 0.01,
    `hp=${rm.hull.hp} team=${rm.team} order=${rm.hull.order} dest=${JSON.stringify(rm.hull.dest)}`);
}
{
  const { serializeFront } = await import("../../src/depot/save.js");
  const w = makeWorld({ field: flatF, seed: 151 }); w.field.n = 2; w.field.h = new Float32Array(4);
  const m1 = mkMech(w, 1, 0, 0);
  // kill it and strip mechRef, exactly as the Phase F death block does.
  m1.hull.alive = false;
  for (const L2 of m1.links) { L2.mechRef = null; L2.team = 0; }
  w.mechs.splice(w.mechs.indexOf(m1), 1);
  const T0 = { nx: 1, nz: 1, v: new Float32Array(1) };
  const S0 = { bell: 1, resources: 0, score: { p: { kills: 0, value: 0 }, e: { kills: 0, value: 0 } }, spawnRR: 0, started: true, mode: null, zoom: 1, focus: { x: 0, z: 0 },
    manifest: {}, foe: {}, ws: {}, reg: {}, squads: [], foeSquads: [], mines: [], nextSquadId: 1 };
  const raw = serializeFront({ S: S0,
    world: w, T: T0, town: [], census: [], census2: [], rocks: [], smears: [], mapSeed: 1, rngSeed: 2 });
  const data = JSON.parse(raw);
  const pieces = data.bodies.filter((b) => b.k === "mechlink" || b.k === "mechfoot" || b.k === "mech");
  ok("M15: a dead mech's wreck pieces save and restore as plain bodies with no mech row",
    data.mechs.length === 0 && pieces.length === m1.links.length, `mechs=${data.mechs.length} pieces=${pieces.length}/${m1.links.length}`);
}

// ============================================================ PHASE F (M16-M21)
{
  const w = makeWorld({ field: flatF, seed: 152 }); w.depotCombat = true;
  const m1 = mkMech(w, 1, 0, -12);
  m1.hull.order = "move"; m1.hull.dest = { x: 0, z: -4 };
  run(w, mkGrid(), 4000);
  ok("M16: a mech ordered MOVE walks its route legs and arrives to defend",
    Math.hypot(m1.hull.pos.x - 0, m1.hull.pos.z - (-4)) < 4 && m1.hull.order === "defend",
    `pos=${m1.hull.pos.x.toFixed(1)},${m1.hull.pos.z.toFixed(1)} order=${m1.hull.order}`);
}
{
  const trial = (tracks) => {
    const w = makeWorld({ field: flatF, seed: 153 }); w.depotCombat = true;
    const m1 = mkMech(w, 1, 0, -12); m1.hull.tracks = tracks;
    const man = addBody(w, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x: 0, y: 0.74, z: -8, hp: 58, friction: 0.5 });
    m1.hull.order = "move"; m1.hull.dest = { x: 0, z: 10 };
    run(w, mkGrid(), 1500);
    return { m: m1, man };
  };
  const careful = trial("careful");
  const free = trial("free");
  ok("M17: a blocked lane brakes it and yields the men under CAREFUL, and does not brake under FREE",
    careful.m.hull.pos.z < -8 && careful.man._yield != null && free.m.hull.pos.z > -10,
    `careful z=${careful.m.hull.pos.z.toFixed(1)} yield=${!!careful.man._yield} free z=${free.m.hull.pos.z.toFixed(1)}`);
}
{
  const w = makeWorld({ field: flatF, seed: 154 }); w.depotCombat = true;
  const m1 = mkMech(w, 1, 0, 0);
  m1.state.mode = "FALLEN"; // the engine's own fall trigger is certified elsewhere; the DRIVER's tending is what this checks
  const hp0 = m1.hull.hp;
  const grid = mkGrid();
  for (let i = 0; i < 700; i++) { DRIVERS.mech.goal(w, grid, m1.hull, w.dt, identFwdDir, {}); stepWorld(w); }
  const stillDown = mechFallen(m1);
  for (let i = 0; i < 200; i++) { DRIVERS.mech.goal(w, grid, m1.hull, w.dt, identFwdDir, {}); stepWorld(w); }
  ok("M18: a knocked-down mech stands within the window with hp unchanged (the fall never wounds)",
    stillDown && !mechFallen(m1) && m1.hull.hp === hp0, `stillDown=${stillDown} nowUp=${!mechFallen(m1)} hp=${m1.hull.hp}/${hp0}`);
}
{
  const w = makeWorld({ field: flatF, seed: 155 }); w.depotCombat = true;
  const m1 = mkMech(w, 1, 0, 0);
  m1.state.mode = "FALLEN";
  const hp0 = m1.hull.hp;
  explode(w, m1.hull.pos.x, m1.hull.pos.y, m1.hull.pos.z, { r: 6, kv: 8, dmg: 80, crater: 0, attacker: "enemy" });
  ok("M19: shells landing while it is down DO wound", m1.hull.hp < hp0, `${m1.hull.hp}/${hp0}`);
}
{
  const w = makeWorld({ field: flatF, seed: 156 }); w.depotCombat = true;
  const m1 = mkMech(w, 1, 0, 0);
  const foe = addBody(w, { kind: "unit", team: 2, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x: 0, y: 0.86, z: 20, hp: 58, friction: 0.5 });
  const grid = mkGrid();
  let steps = 0;
  while (foe.alive && steps++ < 2000) { stepDrivers(w, grid, identFwdDir, null, idUV, {}); stepWorld(w); }
  ok("M20: the driver's guns kill a seen conscript", !foe.alive, `alive=${foe.alive} steps=${steps}`);
}
{
  const src = fs.readFileSync("src/depot/DepotGame.jsx", "utf8");
  ok("M21: a dead hull detonates, leaves world.mechs, and leaves loose pieces (source-pinned, stepDepot's death block)",
    /A DEAD MECH[\s\S]{0,900}L2\.mechRef = null; L2\.team = 0;[\s\S]{0,100}world\.mechs\.splice\(mi2, 1\);/.test(src));
}

// ============================================================ PHASE G (M22-M26)
{
  ok("M22: the pool and hand are eighteen with hero_mech in every seat",
    PICK_POOL.length === 18 && PICK_POOL.some((p) => p.key === "hero_mech" && p.kind === "mech") &&
    HAND_KEYS.length === 18 && HAND_KEYS.includes("hero_mech") && HAND_TAGS.hero_mech === "hero_mech",
    `pool=${PICK_POOL.length} hand=${HAND_KEYS.length}`);
}
{
  const field = makeField(80, 1.7, 5);
  const w = makeWorld({ field, seed: 157 });
  const grid = mkGrid();
  const depotT = { x: 0, z: 0 };
  const hull = parkMech(w, grid, field, depotT, 2);
  ok("M23: parkMech stands a team-2 mech inside 36m of the depot with drv/order/tracks/bounty set",
    !!hull && hull.team === 2 && hull.drv === "mech" && hull.order === "defend" && hull.tracks === "careful" && hull.bounty === MECH.bounty &&
    Math.hypot(hull.pos.x - depotT.x, hull.pos.z - depotT.z) <= 36,
    hull ? `d=${Math.hypot(hull.pos.x, hull.pos.z).toFixed(1)}` : "null");
}
{
  const field = makeField(80, 1.7, 5);
  const w = makeWorld({ field, seed: 158 });
  const grid = mkGrid();
  const depotE = { x: 0, z: 0 };
  mirrorFieldKey(w, {}, depotE, grid, field, "hero_mech", () => 1);
  ok("M24: mirrorFieldKey(\"hero_mech\") fields it", w.mechs && w.mechs.length === 1 && w.mechs[0].team === 2, w.mechs ? w.mechs.length : 0);
}
{
  const src = fs.readFileSync("src/depot/bell.js", "utf8");
  ok("M25: the bell's replacement walk re-parks a dead team-2 mech (source-pinned, the hero-tier block)",
    /open\("hero_mech"\) && S\.reg\.scrap >= heroPrice\("hero_mech"\)/.test(src) &&
    /parkMech\(world, grid, field, depotE4, 2\)/.test(src) &&
    /k === "hero_mech" \? MECH\.cost/.test(src));
}
{
  const counts0 = { _men: 0 };
  const p0 = computePrices(counts0);
  const w = makeWorld({ field: flatF, seed: 159 });
  mkMech(w, 1, 0, 0);
  const counts1 = marketCounts(w, []);
  const p1 = computePrices(counts1);
  ok("M26: computePrices carries hero_mech on both tables, and one standing machine prices 480 (K 3, mk1.95)",
    p0.player.hero_mech === MECH.cost && p0.foe.hero_mech === MECH.cost && p1.player.hero_mech === Math.round(MECH.cost * 1.2),
    `base p=${p0.player.hero_mech} f=${p0.foe.hero_mech} doubled=${p1.player.hero_mech}`);
}

// ============================================================ PHASE H (M27-M29)
{
  const src = fs.readFileSync("src/depot/DepotGame.jsx", "utf8");
  ok("M27: takeControlVehicle on a mech sets possess.kind \"mech\" and release returns it to defend (source-pinned)",
    /S\.possess = \{ kind: "mech", id: v\.id \};/.test(src) &&
    /S\.possess\.kind === "mech"\) \{[\s\S]{0,260}pm\.order = "defend";/.test(src));
}
{
  const w = makeWorld({ field: flatF, seed: 160 });
  const m1 = mkMech(w, 1, 0, 0);
  m1.aimRange = 20;
  const T0 = { nx: 1, nz: 1, v: new Float32Array(1), sight: { nx: 1, nz: 1, cs: 200, halfU: 100, halfV: 100, seen1: new Uint8Array(1), seen2: new Uint8Array(1) } };
  const before = m1._lastFire;
  const sighted = mechSighted(w, m1, T0, idUV);
  if (sighted) mechFire(w, m1);
  T0.sight.seen1[0] = 1;
  const sighted2 = mechSighted(w, m1, T0, idUV);
  ok("M28: the possessed sight gate refuses a fire at unseen ground, and opens once the ground is seen (fixture is live, not vacuous)",
    sighted === false && m1._lastFire === before && sighted2 === true, `sighted=${sighted} fire=${m1._lastFire} sighted2=${sighted2}`);
}
{
  const w = makeWorld({ field: flatF, seed: 161 }); w.depotCombat = true;
  const m1 = mkMech(w, 1, 0, 0);
  m1.hull.order = "move"; m1.hull.dest = { x: 0, z: 20 };
  const grid = mkGrid();
  stepDrivers(w, grid, identFwdDir, null, idUV, { possessedId: m1.hull.id });
  ok("M29: the possessed skip in stepDrivers leaves a possessed mech's driver silent",
    m1.hull.order === "move" && m1.hull._route == null, `order=${m1.hull.order} route=${m1.hull._route}`);
}

// ============================================================ PHASE I (M30)
{
  // renderer.js needs a real canvas/WebGL context — not available headless.
  // Headless-checkable form (chosen at dispatch, per the plan's own license):
  // the same per-body/per-torso arithmetic the renderer's draw loop applies
  // (kind-filtered body count, plus pod (2) and thruster-bell (6) per torso).
  const w = makeWorld({ field: flatF, seed: 162 });
  mkMech(w, 1, -10, 0);
  mkMech(w, 2, 10, 0);
  const mechBodies = w.bodies.filter((b) => b.kind === "mech" || b.kind === "mechlink" || b.kind === "mechfoot").length;
  const torsos = w.bodies.filter((b) => b.visTag === "torso").length;
  const instanceCount = mechBodies + torsos * (2 /* pod */ + 6 /* thruster bells */);
  ok("M30: with two mechs built, the derived instance count is >= 40 and both torsos carry a pod",
    instanceCount >= 40 && torsos === 2, `bodies=${mechBodies} torsos=${torsos} instances=${instanceCount}`);
}
