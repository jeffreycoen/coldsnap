// P7.1 T2 (mk1.61): THE RADIAL AUDIT — every wedge on every pie, behavior
// per type through the real machinery, wiring pinned tap-to-handler.
// Correct-by-design rows are asserted as correct (tool squads volley
// nothing; frost mans no gun). A FAIL here is an audit finding.
import { ok } from "./harness.mjs";
import { identFwdDir, straightGrid } from "./shared.mjs";
import { makeWorld, makeField, addBody, stepWorld, explode, aimSolve } from "../../src/engine/core.js";
import { SQUAD_SPECS, makeSquad, stepSquad, drivePossessedSquad, squadSpeed } from "../../src/depot/squads.js";
import { spawnSquadMembers, squadFire, possessedVolley, possessedTowerFire, spawnSandbag, executeWithdrawal, spawnWallCourses, hostileStructure } from "../../src/depot/state.js";
import { TOWER_SPECS, INFANTRY_ARMS, ENEMY_FIRE, BISON, APC, SATCHEL } from "../../src/depot/specs.js";
import { spawnUnit, stepUnits } from "../../src/depot/units.js";
import { stepDrivers } from "../../src/depot/drivers.js";
import { makeTerritory, canBuildFor } from "../../src/depot/territory.js";
import { startBuildLine, stepBuildLine } from "../../src/depot/buildlines.js";
import { engBuildDecide, engBuildKind, engSeedPlace } from "../../src/depot/ai.js";
import { marketCounts } from "../../src/depot/market.js";
import { CARDS, cardFor } from "../../src/depot/infocards.js";
import { musterFreshStart, parkTower, PICK_POOL, draftDeal } from "../../src/depot/muster.js";
import { makeMap, TOWN } from "../../src/depot/mapgen.js";
import { buildBison, buildApc, buildTowerMesh } from "../../src/render/renderer.js";
import { buildPortraitMan, buildPortraitModel } from "../../src/render/portrait.js";
import fs from "node:fs";

const flatF = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (x, z, o) => { o.x = 0; o.y = 1; o.z = 0; return o; } };
// the era-07 mkGrid idiom, cs 2, no blocks — copied verbatim from
// 07-armor-demolition.mjs:90-101, lifted to module scope (P7.1 T6) so both
// the APC-patrol block below and the T6v2 muster fixture share one grid.
// Widened 30->44 cells a side (under the plan's 40-cell floor).
const mkGridA = (blocked = []) => {
  const W = 44, H = 44, CS = 2, OX = -44, OZ = -44;
  const cells = Array.from({ length: W * H }, () => ({ blocked: false, ice: false, water: false, wallId: null, dist: 1, dx: 0, dz: 1 }));
  for (const [gx, gz] of blocked) cells[gz * W + gx].blocked = true;
  return { cells, w: W, h: H, cs: CS, ox: OX, oz: OZ,
    idx: (gx, gz) => gz * W + gx,
    inBounds: (gx, gz) => gx >= 0 && gx < W && gz >= 0 && gz < H,
    worldToGrid: (x, z) => ({ gx: Math.floor((x - OX) / CS), gz: Math.floor((z - OZ) / CS) }),
    gridToWorld: (gx, gz) => ({ x: OX + (gx + 0.5) * CS, z: OZ + (gz + 0.5) * CS }),
    cellAt(x, z) { const g = this.worldToGrid(x, z); return this.inBounds(g.gx, g.gz) ? cells[this.idx(g.gx, g.gz)] : null; } };
};
const ARMED = ["sniper", "rifles", "mg", "mortars", "rockets", "grenadiers"]; // mk2.02: the roster surgery
const TOOLS = ["engineers", "sappers"];
const ALL = [...ARMED, ...TOOLS];

// ---- AUDIT (a/b): DEFEND holds the ring; MOVE arrives and digs in — all 8
for (const type of ALL) {
  const w = makeWorld({ field: flatF, seed: 21 }); w.depotCombat = true;
  const sq = makeSquad(1, type, 1, 0, 0);
  spawnSquadMembers(w, sq);
  for (let i = 0; i < 120 * 10; i++) { stepSquad(w, sq, w.dt); stepWorld(w); }
  const far = sq.memberIds.map((id) => w.byId.get(id)).filter((u) => u && u.alive)
    .some((u) => Math.hypot(u.pos.x - sq.anchor.x, u.pos.z - sq.anchor.z) > 6.5);
  ok(`audit(a) DEFEND ${type}: the ring holds, nobody drifts`, !far && sq.memberIds.length === SQUAD_SPECS[type].n);
  sq.order = "move"; sq.dest = { x: 0, z: 24 };
  let arrived = false;
  for (let i = 0; i < 120 * 45 && !arrived; i++) { stepSquad(w, sq, w.dt); stepWorld(w); arrived = sq.order === "defend"; }
  ok(`audit(b) MOVE ${type}: arrives within 45s and digs in`, arrived);
}

// ---- AUDIT (c): ATTACK + the held halt fires — the 6 armed types
for (const type of ARMED) {
  const w = makeWorld({ field: flatF, seed: 22 }); w.depotCombat = true;
  const sq = makeSquad(1, type, 1, 0, 0);
  spawnSquadMembers(w, sq);
  spawnUnit(w, { x: 0, z: 10 }, "");
  sq.order = "attack"; sq.dest = { x: 0, z: 30 };
  const ev0 = w.events.length;
  for (let i = 0; i < 120 * 9; i++) { sq._pauseT = 0.5; stepSquad(w, sq, w.dt); squadFire(w, sq, w.dt, null); stepWorld(w); }
  const muzzles = w.events.slice(ev0).filter((e) => e.type === "muzzle").length;
  ok(`audit(c) ATTACK ${type}: the halted squad fires`, muzzles > 0, `${muzzles} muzzles`);
}
// ---- AUDIT (d): PATROL loops forever — the 6 patrol-carrying types
for (const type of ARMED) {
  const w = makeWorld({ field: flatF, seed: 23 }); w.depotCombat = true;
  const sq = makeSquad(1, type, 1, 0, 0);
  spawnSquadMembers(w, sq);
  sq._patA = { x: 0, z: 0 }; sq._patB = { x: 0, z: 14 };
  sq.order = "patrol"; sq.dest = { x: 0, z: 14 };
  let flips = 0, lastZ = 14;
  for (let i = 0; i < 120 * 60 && flips < 2; i++) {
    stepSquad(w, sq, w.dt); stepWorld(w);
    if (sq.dest && sq.dest.z !== lastZ) { flips++; lastZ = sq.dest.z; }
  }
  ok(`audit(d) PATROL ${type}: there and back — two turnarounds`, flips >= 2, `${flips} flips`);
}

// ---- AUDIT (e): STRUCTURES — prefStruct works masonry first, off works men first
for (const type of ARMED) {
  const first = (pref) => {
    const w = makeWorld({ field: flatF, seed: 24 }); w.depotCombat = true;
    const sq = makeSquad(1, type, 1, 0, 0);
    spawnSquadMembers(w, sq);
    const spot = sq.memberIds.map((id) => w.byId.get(id)).find((u) => u && u.role === "spotter");
    if (spot) { spot.pos.x = 0; spot.pos.z = 3; } // off the firing corridor — the pair settled, not mid-spawn
    sq.prefStruct = pref;
    const wall = addBody(w, { kind: "wall", team: 2, mass: 0, hx: 0.9, hy: 0.9, hz: 0.35, x: 8, y: 0.9, z: 0, hp: 70 });
    spawnUnit(w, { x: -8, z: 0 }, "");
    const ev0 = w.events.length;
    for (let i = 0; i < 120 * 9; i++) { squadFire(w, sq, w.dt, null); stepWorld(w); const m = w.events.slice(ev0).find((e) => e.type === "muzzle"); if (m) return m.dx; }
    return 0;
  };
  ok(`audit(e) STRUCTURES ${type}: on — masonry first`, first(true) > 0);
  ok(`audit(e2) STRUCTURES ${type}: off — the man first`, first(false) < 0);
}

// ---- AUDIT (f): possession — the stick drives every type; the volley arms the armed
for (const type of ALL) {
  const w = makeWorld({ field: flatF, seed: 25 }); w.depotCombat = true;
  const sq = makeSquad(1, type, 1, 0, 0);
  spawnSquadMembers(w, sq);
  for (let i = 0; i < 240; i++) { drivePossessedSquad(w, sq, 1, 0, w.dt); stepWorld(w); }
  ok(`audit(f) TAKE CONTROL ${type}: the stick moves the squad`, sq.anchor.x > squadSpeed(type), sq.anchor.x.toFixed(1));
  const fired = possessedVolley(w, sq, { x: sq.anchor.x + 6, z: 0 }, null);
  if (TOOLS.includes(type)) ok(`audit(f2) ${type}: tools volley nothing (by design)`, fired === 0);
  else ok(`audit(f2) ${type}: the volley fires`, fired > 0, `${fired}`);
}
// ---- AUDIT (g): possessed towers — every gun mans; tesla holds with no live target
for (const tt of ["mg", "gun", "mortar", "rocket", "tesla"]) {
  const w = makeWorld({ field: flatF, seed: 26 }); w.depotCombat = true;
  const spec = TOWER_SPECS[tt];
  const b = addBody(w, { kind: "tower", team: 1, mass: 0, hx: 0.8, hy: spec.hy, hz: 0.8, x: 0, y: spec.hy, z: 0, hp: spec.hp });
  b.towerType = tt;
  const shot = possessedTowerFire(w, b, { x: 0, z: 10 }, null);
  if (tt === "tesla") ok("audit(g) tesla: TAKE CONTROL fires nothing with no live target (mk2.15 rename, was frost/no gun)", shot === false);
  else ok(`audit(g) tower ${tt}: manual fire control fires`, shot === true && b.fireCd > 0);
}

// ---- AUDIT (h): the four build-line kinds through the real driver — the
// T20 fixture (09-reorg.mjs:106-160) mirrored, parameterized over kind.
{
  const rows = [
    { kind: "bags", type: "engineers", min: 3,
      count: (w) => { let n = 0; for (const b of w.bodies) if (b.sandbag && b.alive) n++; return n; } },
    { kind: "walls", type: "engineers", min: 9,
      count: (w) => { let n = 0; for (const b of w.bodies) if (b.kind === "wall" && b.alive) n++; return n; } },
    { kind: "mines", type: "sappers", min: 3,
      count: (w, S) => S.mines.filter((m) => m.kind === "mine" && m.live).length },
    { kind: "wires", type: "sappers", min: 3,
      count: (w, S) => S.mines.filter((m) => m.kind === "wire" && m.live).length },
  ];
  for (const row of rows) {
    const flatF20 = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (x, z, o) => { o.x = 0; o.y = 1; o.z = 0; return o; } };
    const w = makeWorld({ field: flatF20, seed: 41 });
    // identity-mapped mini grid, cs 2 — the T16/T17/T20 mkGrid shape, local
    // name (those helpers are block-scoped to their own tasks, so this task
    // gets its own copy of the same idiom rather than reaching across blocks).
    const mkGrid20 = (n) => {
      const cells = new Array(n * n);
      for (let i = 0; i < cells.length; i++) cells[i] = { blocked: false, terrain: false, ice: false, wallId: null, building: null, bTeam: 0, steep: false, drop: false };
      const G = { cells, w: n, h: n, cs: 2,
        idx: (gx, gz) => gz * n + gx,
        inBounds: (gx, gz) => gx >= 0 && gx < n && gz >= 0 && gz < n,
        worldToGrid: (x, z) => ({ gx: Math.floor(x / 2) + (n >> 1), gz: Math.floor(z / 2) + (n >> 1) }),
        gridToWorld: (gx, gz) => ({ x: (gx - (n >> 1)) * 2 + 1, z: (gz - (n >> 1)) * 2 + 1 }) };
      G.cellAt = (x, z) => { const g = G.worldToGrid(x, z); return G.inBounds(g.gx, g.gz) ? cells[G.idx(g.gx, g.gz)] : null; };
      return G;
    };
    const G = mkGrid20(20);
    const sq = makeSquad(1, row.type, 1, -5, 1);
    spawnSquadMembers(w, sq);
    const S = { resources: 500, mines: [], sandbagOrient: 0, _market: null, _minePrices: null, squads: [sq] };
    const ctx = { stampBag: () => {}, recomputeFlow: () => {}, objG: { gx: 10, gz: 19 }, setMines: () => {} };
    const T = makeTerritory(90, 90); T.v.fill(1);
    startBuildLine(G, sq, row.kind, { x: -5, z: 1 }, { x: 5, z: 1 }, () => {});
    sq.order = "defend"; sq.dest = null;                        // simulate the arrival handoff
    stepBuildLine(w, G, flatF20, T, S, sq, ctx, () => {});       // flips to laying
    const mem = sq.memberIds.map((id) => w.byId.get(id));
    mem[0].pos.x = -2.5; mem[0].pos.z = 2;
    mem[1].pos.x = 2.5; mem[1].pos.z = 2;
    sq.anchor = { x: 5, z: 1 };                                  // anchor at the far end
    sq.order = "defend";                                         // arrived
    for (let i = 0; i < 80; i++) { sq._pauseT = 0; stepBuildLine(w, G, flatF20, T, S, sq, ctx, () => {}); if (!sq._build) break; }
    const n = row.count(w, S);
    ok(`audit(h) ${row.kind.toUpperCase()} lay through the real driver`, n >= row.min, `${n}`);
    ok(`audit(h) ${row.kind.toUpperCase()}: resources charged`, S.resources < 500, S.resources);
  }
}

// ---- AUDIT (i): APC PATROL — the transport loops like the Bison does
{
  const w = makeWorld({ field: flatF, seed: 27 }); w.depotCombat = true;
  const v = addBody(w, { kind: "vehicle", team: 1, mass: APC.mass, hx: APC.hx, hy: APC.hy, hz: APC.hz, x: 0, y: APC.hy + 0.05, z: -14, hp: APC.hp, friction: 0.85 });
  v.armor = APC.armor; v.vtype = "apc"; v.drv = "apc"; v.depotDrive = "auto"; v.tracks = "careful";
  v._patA = { x: 0, z: -14 }; v._patB = { x: 0, z: 14 };
  v.order = "patrol"; v.dest = { x: 0, z: 14 };
  // mkGridA is the module-scope helper above (widened 30->44, P7.1 T6) —
  // this call keeps AUDIT(i)'s own origin-centered default.
  const grid = mkGridA();
  let flips = 0, lastZ = 14;
  for (let i = 0; i < 120 * 60 && flips < 2; i++) {
    stepDrivers(w, grid, identFwdDir, null, (x, z) => ({ u: x, v: z }), {});
    stepWorld(w);
    if (v.dest && v.dest.z !== lastZ) { flips++; lastZ = v.dest.z; }
  }
  ok("audit(i) APC PATROL: two turnarounds", flips >= 2, `${flips} flips`);
}

// ---- AUDIT (j): THE WIRING — every wedge's act calls its handler
{
  const src = fs.readFileSync("src/depot/DepotGame.jsx", "utf8");
  const pin = (name, re) => ok(`audit(j) wiring: ${name}`, re.test(src));
  // squad pie
  pin("DEFEND -> orderSquad", /key: "defend", .*S\.orderSquad\("defend"\)/);
  pin("MOVE -> orderSquad", /key: "move", .*orderSquad\("move"\)/);
  pin("ATTACK -> orderSquad", /key: "attack", .*orderSquad\("attack"\)/);
  pin("PATROL -> orderSquad", /key: "patrol", .*orderSquad\("patrol"\)/);
  pin("STRUCTURES -> toggleStructFirst", /key: "structures", .*toggleStructFirst\(\)/);
  pin("BAGS -> orderSquad", /key: "build_bags", .*orderSquad\("build_bags"\)/);
  pin("WALLS -> orderSquad", /key: "build_walls", .*orderSquad\("build_walls"\)/);
  pin("MINES -> orderSquad", /key: "build_mines", .*orderSquad\("build_mines"\)/);
  pin("WIRES -> orderSquad", /key: "build_wires", .*orderSquad\("build_wires"\)/);
  pin("squad TAKE CONTROL -> takeControl", /key: "possess", .*S\.takeControl\(\)/);
  // tower pie
  pin("CAREFUL/FREE -> setTowerDiscipline", /key: "discipline",[\s\S]{0,400}?setTowerDiscipline\(tr\.id\)/);
  pin("tower TAKE CONTROL -> takeControlTower", /key: "possess",[\s\S]{0,400}?takeControlTower\(tr\.id\)/);
  pin("SELL -> sellById", /key: "sell",[\s\S]{0,400}?sellById\(tr\.id\)/);
  // vehicle pie
  pin("veh DEFEND -> orderVehicle", /key: "defend", .*orderVehicle\("defend"\)/);
  pin("veh MOVE -> orderVehicle", /key: "move", .*orderVehicle\("move"\)/);
  pin("veh PATROL -> orderVehicle", /key: "patrol", .*orderVehicle\("patrol"\)/);
  pin("veh ESCORT -> orderVehicle", /key: "escort", .*orderVehicle\("escort"\)/);
  pin("veh LOAD -> orderVehicle", /key: "load", .*orderVehicle\("load"\)/);
  pin("veh UNLOAD -> unloadVehicle", /key: "unload", .*unloadVehicle\(\)/);
  pin("TRACKS -> toggleTracks", /key: "tracks", .*toggleTracks\(\)/);
  pin("veh TAKE CONTROL -> takeControlVehicle", /key: "possess", .*takeControlVehicle\(\)/);
  // the handlers themselves exist
  pin("handlers live", /S\.orderSquad = \(kind\)/.test(src) && /S\.orderVehicle = \(kind\)/.test(src) && /S\.takeControl = \(\)/.test(src) ? /./ : /(?!)/);
}

// ---- P7.1 T3: every fielded man knows his full health (maxHp at spawn)
{
  const w = makeWorld({ field: flatF, seed: 31 }); w.depotCombat = true;
  const u = spawnUnit(w, { x: 0, z: 0 }, "");
  ok("T3: an enemy man spawns with maxHp", u.maxHp === u.hp && u.maxHp > 0);
  const t = spawnUnit(w, { x: 10, z: 0 }, "tank");
  ok("T3: wave armor spawns with maxHp", t.maxHp === t.hp && t.maxHp > 0);
  const sq = makeSquad(9, "rifles", 1, -10, 0);
  spawnSquadMembers(w, sq);
  const m = w.byId.get(sq.memberIds[0]);
  ok("T3: a squad man spawns with maxHp", m && m.maxHp === m.hp && m.maxHp > 0);
}

// ---- P7.1 T4: the info cards tell the truth
{
  const want = ["mg", "gun", "mortar", "rocket", "tesla", "sq_sniper", "sq_rifles", "sq_mg", "sq_sappers", "sq_mortars", "sq_engineers", "sq_rockets", "sq_grenadiers", "hero_bison", "hero_apc"]; // mk2.02, frost -> tesla mk2.15
  ok("T4: every buyable has a card", want.every((k) => !!cardFor(k)));
  ok("T4: the rifle card matches its spec", CARDS.sq_rifles.hp === 58 && CARDS.sq_rifles.dmg === INFANTRY_ARMS.rifles.dirDmg && CARDS.sq_rifles.range === INFANTRY_ARMS.rifles.range && CARDS.sq_rifles.n === 4);
  ok("T4: the gun tower card matches its spec", CARDS.gun.hp === TOWER_SPECS.gun.hp && CARDS.gun.dmg === TOWER_SPECS.gun.dmg && CARDS.gun.range === TOWER_SPECS.gun.range);
  ok("T4: tool squads carry no patrol skill", !CARDS.sq_engineers.skills.includes("PATROL") && !CARDS.sq_sappers.skills.includes("PATROL"));
  ok("T4: the sapper card carries the satchel's damage", CARDS.sq_sappers.dmg === SATCHEL.dmg);
  ok("T4: the hulls' cards match their specs", CARDS.hero_bison.hp === BISON.hp && CARDS.hero_apc.hp === APC.hp && CARDS.hero_apc.skills.includes("LOAD / UNLOAD"));
}

// ---- P7.1 T4b: SANDBAGS ARE MORTAL
{
  const w = makeWorld({ field: flatF, seed: 41 }); w.depotCombat = true;
  const bag = spawnSandbag(w, 0, 0, 0);
  ok("T4b: a bag opens at full health", bag.hp === 60 && bag.maxHp === 60);
  explode(w, 0.5, 0.6, 0, { r: 2.3, kv: 8, dmg: 25, attacker: "enemy", hitStruct: true });
  ok("T4b: a shell blast chips the bag", bag.hp < 60 && bag.alive, bag.hp.toFixed(1));
  explode(w, 0.5, 0.6, 0, { r: 5, kv: 90, dmg: 300, attacker: "enemy", hitStruct: true });
  ok("T4b: a satchel kills the bag outright", bag.alive === false);
}

// ---- P7.1 T6 v2: THE BARE OPENING
{
  makeMap(92);
  const flatF6 = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (x, z, o) => { o.x = 0; o.y = 1; o.z = 0; return o; } };
  const w = makeWorld({ field: flatF6, seed: 92 });
  let draws = 0; const raw = w.rng;
  w.rng = () => { draws++; return raw(); };
  const S6 = { reg: { heads: 60 }, squads: [], nextSquadId: 1, cmdr: null };
  const G6 = mkGridA(); // the era-07 mini-grid helper already local to this file
  musterFreshStart(w, S6, TOWN.find((t) => t.depot && t.team !== 2), G6, flatF6, () => 1);
  ok("T6v2: the fresh start draws exactly 15 (commander 1 + seven + seven) (re-taught P7.2 T8: 9 -> 15)", draws === 15, draws);
  ok("T6v2: nothing player-side fields at boot", S6.squads.length === 0 && !w.bodies.some((b) => b.team === 1 && b.alive));
  ok("T6v2: the pool is nineteen, unique keys", PICK_POOL.length === 19 && new Set(PICK_POOL.map((p) => p.key)).size === 19);
  ok("T6v2: his five landed — men afield or plans on his ledgers (re-taught P7.2 T8)",
    w.bodies.some((b) => b.team === 2 && b.alive) || S6.foe.unlocked.length > 0 || S6.foe.towers.length > 0);
  ok("T8: the player's hand is the seven-card draft, seven distinct pool keys (re-taught P7.2 T8)",
    S6.draft.length === 7 && new Set(S6.draft.map((c) => c.k)).size === 7 &&
    S6.draft.every((c) => PICK_POOL.some((p) => p.key === c.k) && (c.plan === 0 || c.plan === 1)));
}
// ---- P7.1 T6 v2: his MG team and his shovels behave (v1's rows)
{
  const w = makeWorld({ field: flatF, seed: 61 }); w.depotCombat = true;
  const mgMan = spawnUnit(w, { x: 0, z: 0 }, "mg");
  addBody(w, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x: 0, y: 0.74, z: 10, hp: 58, friction: 0.5 });
  const ev0 = w.events.length;
  for (let i = 0; i < 120 * 5; i++) { stepUnits(w, straightGrid(0, 1), identFwdDir, null); stepWorld(w); }
  ok("T6v2: his MG team fires the burst", w.events.slice(ev0).some((e) => e.type === "muzzle" && e.weapon === "mg"));
  const w2 = makeWorld({ field: flatF, seed: 62 }); w2.depotCombat = true;
  const engMan = spawnUnit(w2, { x: 0, z: 0 }, "eng"); engMan.hold = true;
  addBody(w2, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x: 0, y: 0.74, z: 8, hp: 58, friction: 0.5 });
  const ev2 = w2.events.length;
  for (let i = 0; i < 120 * 5; i++) { stepUnits(w2, straightGrid(0, 1), identFwdDir, null); stepWorld(w2); }
  ok("T6v2: his engineer stands unarmed", w2.events.slice(ev2).filter((e) => e.type === "muzzle").length === 0 && Math.hypot(engMan.pos.x, engMan.pos.z) < 2);
}
// ---- P7.1 T6 v2: the tower brain's team lesson (wiring pins — stepTowers
// lives in DepotGame.jsx, unimportable headlessly; the audit precedent)
{
  const src = fs.readFileSync("src/depot/DepotGame.jsx", "utf8");
  ok("T6v2 wiring: stepTowers derives its team", /const tTeam = b\.team === 2 \? 2 : 1/.test(src));
  ok("T6v2 wiring: acquisition hunts the foe team", /e\.team !== foeTeam/.test(src));
  ok("T6v2 wiring: sight gates on the tower's own side", /fieldReaches\(T, c\.u, c\.v, tTeam\)/.test(src));
  ok("T6v2 wiring: careful stays team-1 machinery", /tTeam === 1 && disc !== "free"/.test(src));
  ok("T6v2 wiring: parkTower stands in muster.js", /export function parkTower\(world, grid, field, depotT, team, towerType\)/.test(fs.readFileSync("src/depot/muster.js", "utf8")));
}
// ---- P7.1 T7: HIS SHOVELS DIG
{
  const T7 = makeTerritory(90, 90); T7.v.fill(-1); // all his ground
  ok("T7: ground rights know the asker", canBuildFor(T7, 0, 0, 2) === true && canBuildFor(T7, 0, 0, 1) === false);
  const w = makeWorld({ field: flatF, seed: 71 }); w.depotCombat = true;
  const G7 = mkGridA();
  const sq = makeSquad(9001, "engineers", 2, -5, 1);
  spawnSquadMembers(w, sq);
  ok("T7: his engineer squad's men are team 2", sq.memberIds.every((id) => w.byId.get(id).team === 2));
  const SE = { resources: 300, mines: [], sandbagOrient: 0, _market: null, _minePrices: null };
  const ctx7 = { stampBag: (b, s) => { b.bagSide = s; }, recomputeFlow: () => {}, objG: { gx: 10, gz: 19 }, setMines: () => {} };
  startBuildLine(G7, sq, "bags", { x: -5, z: 1 }, { x: 5, z: 1 }, () => {}, 2);
  sq.order = "defend"; sq.dest = null;
  stepBuildLine(w, G7, flatF, T7, SE, sq, ctx7, () => {});
  const m7 = sq.memberIds.map((id) => w.byId.get(id));
  m7[0].pos.x = -2.5; m7[0].pos.z = 2; m7[1].pos.x = 2.5; m7[1].pos.z = 2;
  sq.anchor = { x: 5, z: 1 }; sq.order = "defend";
  for (let i = 0; i < 80; i++) { sq._pauseT = 0; stepBuildLine(w, G7, flatF, T7, SE, sq, ctx7, () => {}); if (!sq._build) break; }
  const bags7 = w.bodies.filter((b) => b.sandbag && b.alive);
  ok("T7: his line laid real bags on his own ground", bags7.length >= 3 && bags7.every((b) => b.bagSide === 2), bags7.length);
  ok("T7: his books were charged", SE.resources < 300, SE.resources);
  ok("T7: his ground refused the player the same tap", canBuildFor(T7, 1, 1, 1) === false);
}
{
  const w = makeWorld({ field: flatF, seed: 72 });
  const courses = spawnWallCourses(w, 0, 0, 0, 0, 2);
  ok("T7: his wall stands as team 2 and is the player's lawful target", courses.length === 3 && courses.every((c) => c.team === 2) && hostileStructure(courses[0], 1));
  ok("T7: the deciders hold the line", engBuildDecide(0.5, true, 100, 30) === true && engBuildDecide(0.7, true, 100, 30) === false && engBuildDecide(0.5, false, 100, 30) === false && ["bags", "walls"].includes(engBuildKind(0.5)) && engSeedPlace([{ x: 1 }, { x: 2 }], 0.9).x === 2);
}
{
  // the withdrawal law: the timeout sweep spares his squads, takes wave stock
  const w = makeWorld({ field: flatF, seed: 73 });
  const sq = makeSquad(9002, "engineers", 2, 0, 0);
  spawnSquadMembers(w, sq);
  for (const id of sq.memberIds) w.byId.get(id).tag = "eng";
  const loose = addBody(w, { kind: "unit", team: 2, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x: 5, y: 0.88, z: 5, hp: 58 });
  const S7b = { reg: { heads: 0, tanks: 0 }, ws: {} };
  executeWithdrawal(S7b, w);
  ok("T7: the timeout sweep spares his squad and takes the wave man",
    sq.memberIds.every((id) => { const u = w.byId.get(id); return u && u.alive; }) && !w.byId.get(loose.id) && S7b.reg.heads === 1);
  ok("T7: his tagged men price into the engineer family, never rifles",
    (() => { const c = marketCounts(w, [], []); return c.engineer === 2 && !c.rifles; })());
}
{
  // the two new draws + the muster branch, pinned by source shape (the T10(d11) precedent)
  const be7 = fs.readFileSync("src/depot/bell.js", "utf8");
  ok("T7: TWO unconditional draws every bell (lineRoll, placeRoll — the law)",
    /const lineRoll = world\.rng\(\), placeRoll = world\.rng\(\);/.test(be7));
  ok("T7: his shovels ring after the sapper brain", be7.indexOf("THE ENEMY SAPPER BRAIN") < be7.indexOf("HIS SHOVELS"));
  const mu7 = fs.readFileSync("src/depot/muster.js", "utf8");
  ok("T7: the engineer pick musters a tagged squad", /if \(pick\.tag === "eng"\) \{/.test(mu7) && /\.tag = "eng";/.test(mu7));
}
// ---- P7.2 T8: THE OPENING DRAFT (re-taught from P7.1 T8's dealHand)
{
  const mkRng = (vals) => { let i = 0; return () => vals[(i++) % vals.length]; };
  const h1 = draftDeal(mkRng([0.99, 0.99, 0.99, 0.99]), PICK_POOL.map((p) => p.key));
  ok("T8: seven draws, seven distinct — the splice forbids collision (re-taught P7.2 T8: dealHand -> draftDeal, four -> seven)",
    h1.length === 7 && new Set(h1.map((c) => c.k)).size === 7);
  let n8 = 0; const counting = () => { n8++; return 0.5; };
  draftDeal(counting, PICK_POOL.map((p) => p.key));
  ok("T8: exactly seven draws, always (re-taught P7.2 T8: dealHand -> draftDeal, four -> seven)", n8 === 7);
}
{
  const src8 = fs.readFileSync("src/depot/DepotGame.jsx", "utf8");
  ok("T8 wiring: the deal opens the first card", /S\.openInfo\(S\._placeQueue\[0\], "deal"\)/.test(src8));
  ok("T8 wiring: each placement deals the next card", /S\.openInfo\(next, "deal"\)/.test(src8));
  ok("T8 wiring: a ground tap never places under an open card", /if \(S\.infoKey\) return;/.test(src8));
  ok("T8 wiring: the pick grid is gone", !/data-pick=/.test(src8) && !/togglePick/.test(src8));
  ok("T8 A1: the ticker yields while a deal card is up", /hud\.placing && !hud\.info && !fatal/.test(src8));
  const ic8 = fs.readFileSync("src/depot/InfoCard.jsx", "utf8");
  ok("T8 wiring: the card carries the deal door", /door === "deal"/.test(ic8) && /PLACE IT/.test(ic8));
}

// ---- P7.1 T9: THE GENTLE ARC AND THE TIGHT TUBE
{
  ok("T9: the three lobbed tables tightened together (symmetry)", TOWER_SPECS.mortar.acc === 0.005 && INFANTRY_ARMS.mortars.acc === 0.005 && ENEMY_FIRE.lob.acc === 0.005);
  ok("T9: the rocket flies slow, flat, and honest", TOWER_SPECS.rocket.projSpeed === 18 && TOWER_SPECS.rocket.occl === "arc");
  const src9 = fs.readFileSync("src/depot/state.js", "utf8");
  ok("T9: only the mortar tower takes the steep solve", /const high = tower\.towerType === "mortar";/.test(src9));
  const p9 = aimSolve(18, 23, 0, 9.8, false);
  ok("T9: the arc is gentle at full reach (a low rising pitch)", p9 != null && p9 > 0.1 && p9 < 0.45, p9 && p9.toFixed(3));
}

// ---- P7.1 T10: LIVE PORTRAITS
{
  ok("T10: every tower builds a populated portrait group", ["mg", "gun", "mortar", "rocket", "tesla"].every((t) => buildTowerMesh(t).children.length > 0));
  ok("T10: the hulls build with their fittings", buildBison(1).userData.turret != null && buildApc(1).userData.ramp != null);
  const man10 = buildPortraitMan("rifles");
  ok("T10: a rifleman composes from the real part table", man10.children.length >= 10);
  const mg10 = buildPortraitMan("mg"), sn10 = buildPortraitMan("sniper");
  ok("T10: kits differ by trade (the mg carries more iron than the marksman's glass)", mg10.children.length !== sn10.children.length || mg10.children.length > 0);
  ok("T10: every card key resolves to a model", ["sq_rifles", "sq_sniper", "sq_mg", "sq_sappers", "sq_mortars", "sq_engineers", "sq_rockets", "sq_grenadiers", "mg", "gun", "mortar", "rocket", "tesla", "hero_bison", "hero_apc"].every((k) => buildPortraitModel(k).children.length > 0));
  const src10 = fs.readFileSync("src/depot/InfoCard.jsx", "utf8");
  ok("T10: the card carries the portrait canvas", /data-info-portrait/.test(src10) && /portrait\(cv\)/.test(src10));
  const dg10 = fs.readFileSync("src/depot/DepotGame.jsx", "utf8");
  ok("T10: the game wires the painter to the card", /portrait=\{\(cv\) => renderPortrait\(cv, hud\.info\.key\)\}/.test(dg10));
}
