// COLDSNAP DEPOT — era 13: THE KILL LAW AND THE SCORE (mk1.93). Sixteen
// checks, K1-K16, one per named acceptance in the task plan
// (docs/superpowers/plans/2026-08-20-the-kill-law.md, Phases A-F). Fixture
// seeds drawn fresh at 160+.
import { ok } from "./harness.mjs";
import { makeWorld, addBody, applyDamage, stepWorld, CAUSE } from "../../src/engine/core.js";
import { spawnUnit } from "../../src/depot/units.js";
import { TOWER_SPECS, ENEMY_SPECS } from "../../src/depot/specs.js";
import { killPrice, priced } from "../../src/depot/market.js";
import { KILL_CUT, RESULTS, payResults } from "../../src/depot/economy.js";
import {
  WALL_COST, SANDBAG_COST, WALL_UPPER_GROUP, spawnWallCourses, spawnSandbag,
  makeRunState, scoreKill, executeWithdrawal, towerShot, makeEndDispatch,
} from "../../src/depot/state.js";
import { serializeFront, parseFront } from "../../src/depot/save.js";

const flatF = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (x, z, o) => { o.x = 0; o.y = 1; o.z = 0; return o; } };

// ============================================================ PHASE A (K1-K2)
// K1: under depotCombat, a killed team-2 unit's kill event carries team:2
// and its tag.
{
  const w = makeWorld({ field: flatF, seed: 160 });
  w.depotCombat = true;
  const u = spawnUnit(w, { x: 0, z: 0 }, "");
  applyDamage(w, u, 1e9, { cause: CAUSE.PROJECTILE, attacker: "player" });
  const ev = w.events.find((e) => e.type === "kill" && e.id === u.id);
  ok("K1: depotCombat kill event carries team and tag", !!ev && ev.team === 2 && ev.tag === "", JSON.stringify(ev));
}
// K2: without depotCombat, the event carries no team field (frozen worlds'
// events stay byte-identical).
{
  const w = makeWorld({ field: flatF, seed: 161 });
  const u = spawnUnit(w, { x: 0, z: 0 }, "");
  applyDamage(w, u, 1e9, { cause: CAUSE.PROJECTILE, attacker: "player" });
  const ev = w.events.find((e) => e.type === "kill" && e.id === u.id);
  ok("K2: non-depotCombat kill event carries no team field", !!ev && !("team" in ev), JSON.stringify(ev));
}

// ============================================================ PHASE B (K3-K7)
// killPrice's own arithmetic — a shared non-trivial counts object, so the
// market curve is actually exercised (not just the n=0 baseline).
{
  const counts = { rifles: 5, marksman: 2, mgtower: 1, wall: 3, sandbag: 4, _men: 20 };

  // K3: an enemy conscript prices at the foe table's per-man value.
  {
    const kp = killPrice({ kind: "unit", team: 2, tag: "" }, counts, WALL_COST, SANDBAG_COST);
    const expected = priced(ENEMY_SPECS[""].bounty, "rifles", counts);
    ok("K3: enemy conscript prices at the foe table's per-man value",
      !!kp && kp.price === expected && kp.counted === true, JSON.stringify(kp));
  }

  // K4: an enemy marksman-pair man prices at half the family price.
  {
    const kp = killPrice({ kind: "unit", team: 2, tag: "sniper" }, counts, WALL_COST, SANDBAG_COST);
    const expected = priced(ENEMY_SPECS.sniper.bounty, "marksman", counts) / 2;
    ok("K4: enemy marksman-pair man prices at half the family price",
      !!kp && kp.price === expected && kp.counted === true, JSON.stringify(kp));
  }

  // K5: a player rifleman prices at the rifles squad price over four.
  {
    const kp = killPrice({ kind: "unit", team: 1, utype: "rifles" }, counts, WALL_COST, SANDBAG_COST);
    const expected = priced(30, "rifles", counts) / 4; // SQUAD_SPECS.rifles: n 4, cost 30
    ok("K5: player rifleman prices at the rifles squad price over four",
      !!kp && kp.price === expected && kp.counted === true, JSON.stringify(kp));
  }

  // K6: tower, wall, and sandbag price at their family prices with counted false.
  {
    const kpT = killPrice({ kind: "tower", towerType: "mg" }, counts, WALL_COST, SANDBAG_COST);
    const expectedT = priced(TOWER_SPECS.mg.cost, "mgtower", counts);
    ok("K6a: tower prices at its family price, counted false",
      !!kpT && kpT.price === expectedT && kpT.counted === false, JSON.stringify(kpT));

    const kpW = killPrice({ kind: "wall" }, counts, WALL_COST, SANDBAG_COST);
    const expectedW = priced(WALL_COST, "wall", counts);
    ok("K6b: wall prices at the wall family price, counted false",
      !!kpW && kpW.price === expectedW && kpW.counted === false, JSON.stringify(kpW));

    const kpB = killPrice({ kind: "chunk", sandbag: 1 }, counts, WALL_COST, SANDBAG_COST);
    const expectedB = priced(SANDBAG_COST, "sandbag", counts);
    ok("K6c: sandbag prices at the sandbag family price, counted false",
      !!kpB && kpB.price === expectedB && kpB.counted === false, JSON.stringify(kpB));
  }

  // K7: a town chunk and a flag price null — the law cannot reach them.
  {
    const kpChunk = killPrice({ kind: "chunk" }, counts, WALL_COST, SANDBAG_COST);
    ok("K7a: an unsandbagged chunk (town stone) prices null", kpChunk === null, JSON.stringify(kpChunk));
    const kpFlag = killPrice({ kind: "flag" }, counts, WALL_COST, SANDBAG_COST);
    ok("K7b: a flag prices null", kpFlag === null, JSON.stringify(kpFlag));
  }
}

// ============================================================ PHASE C
// (K8-K11, K16) — the law itself.
const freshS = () => ({ score: { p: { kills: 0, value: 0 }, e: { kills: 0, value: 0 } }, resources: 100, reg: { scrap: 50 } });

// K8: world-attributed and friendly-fire kills score nobody.
{
  const S1 = freshS();
  const r1 = scoreKill(S1, { type: "kill", attacker: "world", kind: "unit", team: 2, tag: "" }, {});
  ok("K8a: a world-attributed kill scores nobody", r1 === null && S1.resources === 100 && S1.reg.scrap === 50
    && S1.score.p.kills === 0 && S1.score.e.kills === 0, JSON.stringify(S1));

  const S2 = freshS();
  const r2 = scoreKill(S2, { type: "kill", attacker: "enemy", kind: "unit", team: 2, tag: "" }, {});
  ok("K8b: enemy-on-enemy friendly fire scores nobody", r2 === null && S2.reg.scrap === 50 && S2.score.e.kills === 0, JSON.stringify(S2));

  const S3 = freshS();
  const r3 = scoreKill(S3, { type: "kill", attacker: "player", kind: "unit", team: 1, utype: "rifles" }, {});
  ok("K8c: player-on-player friendly fire scores nobody", r3 === null && S3.resources === 100 && S3.score.p.kills === 0, JSON.stringify(S3));
}

// K9: an enemy-attributed team-1 man pays KILL_CUT x price onto reg.scrap
// and moves the enemy ledger.
{
  const S = freshS();
  const price = priced(30, "rifles", {}) / 4; // SQUAD_SPECS.rifles cost 30 / n 4
  const r = scoreKill(S, { type: "kill", attacker: "enemy", kind: "unit", team: 1, utype: "rifles" }, {});
  const pay = price * KILL_CUT;
  ok("K9: enemy-attributed team-1 kill pays KILL_CUT x price onto reg.scrap and moves the enemy ledger",
    !!r && Math.abs(r.price - price) < 1e-9 && Math.abs(r.pay - pay) < 1e-9 && r.counted === true
    && Math.abs(S.reg.scrap - (50 + pay)) < 1e-9 && S.resources === 100
    && S.score.e.kills === 1 && Math.abs(S.score.e.value - price) < 1e-9
    && S.score.p.kills === 0 && S.score.p.value === 0,
    JSON.stringify({ r, S }));
}

// K10: a player-attributed team-2 conscript pays S.resources and moves the
// player ledger.
{
  const S = freshS();
  const price = priced(ENEMY_SPECS[""].bounty, "rifles", {});
  const r = scoreKill(S, { type: "kill", attacker: "player", kind: "unit", team: 2, tag: "" }, {});
  const pay = price * KILL_CUT;
  ok("K10: player-attributed team-2 kill pays S.resources and moves the player ledger",
    !!r && Math.abs(r.price - price) < 1e-9 && r.counted === true
    && Math.abs(S.resources - (100 + pay)) < 1e-9 && S.reg.scrap === 50
    && S.score.p.kills === 1 && Math.abs(S.score.p.value - price) < 1e-9
    && S.score.e.kills === 0,
    JSON.stringify({ r, S }));
}

// K11: a mech-hull event counts a kill while a wall event moves value only,
// and a wall's upper course scores nothing.
{
  const S = freshS();
  const r = scoreKill(S, { type: "kill", attacker: "player", kind: "mech", team: 2 }, {});
  ok("K11a: a mech-hull kill counts the kill integer", !!r && r.counted === true && S.score.p.kills === 1, JSON.stringify({ r, S }));

  const S2 = freshS();
  const rw = scoreKill(S2, { type: "kill", attacker: "enemy", kind: "wall", team: 1, group: "" }, {});
  ok("K11b: a wall base-course kill moves value only, no kill integer",
    !!rw && rw.counted === false && S2.score.e.kills === 0 && S2.score.e.value === rw.price, JSON.stringify({ rw, S2 }));

  const S3 = freshS();
  const ru = scoreKill(S3, { type: "kill", attacker: "enemy", kind: "wall", team: 1, group: WALL_UPPER_GROUP }, {});
  ok("K11c: a wall's upper course scores nothing", ru === null && S3.score.e.value === 0 && S3.reg.scrap === 50, JSON.stringify({ ru, S3 }));
}

// K16: executeWithdrawal deletes bodies with zero events and zero score
// movement — the timeout sweep is not a kill.
{
  const w = makeWorld({ field: flatF, seed: 162 });
  const u1 = addBody(w, { kind: "unit", team: 2, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x: 0, y: 0.9, z: 0, hp: 58 });
  const u2 = addBody(w, { kind: "unit", team: 2, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x: 2, y: 0.9, z: 2, hp: 58 });
  const S = { ws: { withdrew: 0 }, reg: { heads: 0, tanks: 0 }, score: { p: { kills: 0, value: 0 }, e: { kills: 0, value: 0 } } };
  const before = w.bodies.length;
  const { inf, tanks } = executeWithdrawal(S, w);
  ok("K16: executeWithdrawal removes the bodies, pushes zero events, moves zero score",
    inf === 2 && tanks === 0 && w.bodies.length === before - 2 && w.events.length === 0
    && S.score.p.kills === 0 && S.score.e.kills === 0 && S.score.p.value === 0 && S.score.e.value === 0,
    `inf=${inf} tanks=${tanks} bodies=${w.bodies.length} events=${w.events.length}`);
}

// ============================================================ PHASE D
// (K12-K13) — the old payouts die.
// K12: a fixture tower kills a conscript through the real fire path (real
// projectile flight, real applyDamage/killBody) and scoreKill over
// world.events pays and scores exactly once.
{
  const w = makeWorld({ field: flatF, seed: 163 });
  w.depotCombat = true;
  const towerSpec = TOWER_SPECS.mg;
  // muzzle = tower.pos.y + tower.hy + 0.45; aligned to the conscript's own
  // resting height (ground + hy + 0.02) so a straight shot is a direct hit.
  const tower = addBody(w, { kind: "tower", team: 1, mass: 0, hx: towerSpec.hx, hy: towerSpec.hy, hz: towerSpec.hz, x: 0, y: -0.57, z: 0, hp: towerSpec.hp, towerType: "mg" });
  const spec0 = ENEMY_SPECS[""];
  const target = addBody(w, { kind: "unit", team: 2, mass: spec0.mass, hx: spec0.hx, hy: spec0.hy, hz: spec0.hz, x: 3, y: 0.88, z: 0, hp: 1, friction: 0.38 });
  target.tag = ""; target.bounty = spec0.bounty; target.maxHp = 1;
  const S = { score: { p: { kills: 0, value: 0 }, e: { kills: 0, value: 0 } }, resources: 100, reg: { scrap: 50 } };
  let paid = 0;
  for (let i = 0; i < 30 && target.alive; i++) {
    towerShot(w, tower, target, towerSpec);
    for (let k = 0; k < 60; k++) stepWorld(w);
    const evs = w.events.slice(); w.events.length = 0;
    for (const e of evs) { if (e.type !== "kill") continue; const r = scoreKill(S, e, {}); if (r) paid++; }
  }
  ok("K12: a tower kill through the real fire path pays and scores exactly once",
    target.alive === false && paid === 1 && S.score.p.kills === 1,
    `alive=${target.alive} paid=${paid} kills=${S.score.p.kills}`);
}

// K13: RESULTS carries no towerKill/wallKill key and payResults books the
// three surviving terms exactly.
{
  ok("K13a: RESULTS carries no towerKill key", !("towerKill" in RESULTS), JSON.stringify(RESULTS));
  ok("K13b: RESULTS carries no wallKill key", !("wallKill" in RESULTS), JSON.stringify(RESULTS));
  const reg = { scrap: 10 };
  payResults(reg, { structureDmg: 50, buildingKills: 2, leaks: 3 });
  const expected = 10 + 50 * RESULTS.structureDmg + 2 * RESULTS.buildingKill + 3 * RESULTS.leak;
  ok("K13c: payResults books the three surviving terms exactly",
    Math.abs(reg.scrap - expected) < 1e-9, `${reg.scrap} vs ${expected}`);
}

// ============================================================ PHASE E (K14)
// A serialized run with a moved score round-trips all four numbers through
// serializeFront/parseFront and the restore shape.
{
  const w = makeWorld({ field: flatF, seed: 164 });
  w.field.n = 2; w.field.h = new Float32Array(4);
  const T0 = { nx: 1, nz: 1, v: new Float32Array(1) };
  const S0 = {
    bell: 1, resources: 42.5, score: { p: { kills: 5, value: 123.456 }, e: { kills: 3, value: 78.9 } },
    spawnRR: 0, started: true, mode: null, zoom: 1, focus: { x: 0, z: 0 },
    manifest: {}, foe: {}, ws: {}, reg: {}, squads: [], foeSquads: [], mines: [], nextSquadId: 1,
  };
  const raw = serializeFront({ S: S0, world: w, T: T0, town: [], census: [], census2: [], rocks: [], smears: [], mapSeed: 1, rngSeed: 2 });
  const parsed = parseFront(raw);
  ok("K14a: the save parses", parsed.ok, JSON.stringify(parsed));
  const r = parsed.ok ? parsed.data.run : null;
  ok("K14b: the run row carries the four score numbers, rounded",
    !!r && r.score && r.score.pk === 5 && Math.abs(r.score.pv - 123.456) < 1e-3
    && r.score.ek === 3 && Math.abs(r.score.ev - 78.9) < 1e-3, JSON.stringify(r && r.score));
  ok("K14c: the run row no longer carries a bare kills field", !!r && !("kills" in r), JSON.stringify(r));
  // the restore shape (mirrors DepotGame.jsx's resume block)
  const restored = r.score
    ? { p: { kills: r.score.pk, value: r.score.pv }, e: { kills: r.score.ek, value: r.score.ev } }
    : { p: { kills: 0, value: 0 }, e: { kills: 0, value: 0 } };
  ok("K14d: the restore shape matches the original score object",
    restored.p.kills === 5 && Math.abs(restored.p.value - 123.456) < 1e-3
    && restored.e.kills === 3 && Math.abs(restored.e.value - 78.9) < 1e-3, JSON.stringify(restored));
}

// ============================================================ PHASE F (K15)
// makeEndDispatch carries the tally line on BOTH endings, with the exact
// fixture numbers; the victory card still leads with its breach line.
{
  const score = { pk: 7, pv: 245, ek: 4, ev: 130 };
  const win = makeEndDispatch({ victory: true, score });
  ok("K15a: victory card still leads with the breach line", win.lines[0] === "THE OPPOSING DEPOT IS BREACHED.", JSON.stringify(win.lines));
  ok("K15b: victory card carries the exact tally line",
    win.lines.includes("7 CONFIRMED, ◆245 DESTROYED. ITS COUNT: 4, ◆130."), JSON.stringify(win.lines));

  const loss = makeEndDispatch({ victory: false, score });
  ok("K15c: loss card leads with the depot-is-breached line", loss.lines[0] === "THE DEPOT IS BREACHED.", JSON.stringify(loss.lines));
  ok("K15d: loss card carries the exact tally line (ruling 4 supersedes the old digit-free pin)",
    loss.lines.includes("7 CONFIRMED, ◆245 DESTROYED. ITS COUNT: 4, ◆130."), JSON.stringify(loss.lines));
}
