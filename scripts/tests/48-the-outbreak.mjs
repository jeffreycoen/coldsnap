import { ok } from "./harness.mjs";
import { makeWorld, addBody } from "../../src/engine/core.js";
import { DEAD, DEAD_TEAM, MAN } from "../../src/depot/specs.js";
import { spawnDead, biteBody, turnDead, stepDead, stepSick, outbreakCenter } from "../../src/depot/dead.js";
import { hostileUnit, pruneSquads } from "../../src/depot/state.js";
import { marketCounts } from "../../src/depot/market.js";
import { squadCanBoard } from "../../src/depot/transports.js";
import { bootWar } from "../../src/depot/boot.js";
import { tickWar } from "../../src/depot/tick.js";
import { serializeRun, defaultTickInput } from "../../src/depot/api.js";
import { parseFront } from "../../src/depot/save.js";
import { stepTowers } from "../../src/depot/sim.js";
import { makeMap } from "../../src/depot/mapgen.js";

// ==== 0.6.1: the outbreak — the door and the dead ===========================
// The third side: hostile to both armies, hunted by both, firing nothing.
// Seed rolled each run.
{
  console.log("\n[0.6.1: the outbreak — the door and the dead]");
  const SEED = (Date.now() % 1000000) + 1;
  console.log("  fixture seed base", SEED);
  const flat = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (x, z, o) => { o.x = 0; o.y = 1; o.z = 0; return o; } };
  const man = (w, team, x, z) => { const u = addBody(w, { kind: "unit", team, mass: MAN.rifle.mass, hx: MAN.rifle.hx, hy: MAN.rifle.hy, hz: MAN.rifle.hz, x, z, y: MAN.rifle.hy + 0.02, hp: MAN.rifle.hp, friction: 0.5 }); u.maxHp = MAN.rifle.hp; return u; };

  // (a) hostileUnit: the other army and the dead, both signs
  ok("(a) team 1 is hostile to the enemy and the dead, not to itself or scenery", hostileUnit({ team: 2 }, 1) && hostileUnit({ team: DEAD_TEAM }, 1) && !hostileUnit({ team: 1 }, 1) && !hostileUnit({ team: 0 }, 1));
  ok("(a) team 2 is hostile to the player and the dead, not to itself", hostileUnit({ team: 1 }, 2) && hostileUnit({ team: DEAD_TEAM }, 2) && !hostileUnit({ team: 2 }, 2));

  // (b) the body
  {
    const w = makeWorld({ field: flat, seed: SEED }); w.depotCombat = true;
    const d = spawnDead(w, 0, 0);
    ok("(b) one of the dead: a unit on the third team, the tag, 116 points", d.kind === "unit" && d.team === DEAD_TEAM && d.tag === DEAD.tag && d.hp === 116 && d.maxHp === 116, `${d.team}/${d.tag}/${d.hp}`);
  }

  // (c) the bite: 15 points and the stamp; the fourth bite turns a 58-point man at once
  {
    const w = makeWorld({ field: flat, seed: SEED }); w.depotCombat = true; w.t = 5;
    const d = spawnDead(w, 0, 0); const m = man(w, 1, 1, 0);
    biteBody(w, d, m);
    ok("(c) a bite takes 15 and stamps the clock", m.hp === MAN.rifle.hp - 15 && m.sickAt === 5 && m.team === 1, `${m.hp}/${m.sickAt}`);
    biteBody(w, d, m); biteBody(w, d, m);
    ok("(c) three bites leave him living and stamped", m.alive && m.team === 1 && m.hp === MAN.rifle.hp - 45, `${m.hp}`);
    biteBody(w, d, m);
    ok("(c) the fourth bite turns him at once — no corpse, 116 points, the third team", m.alive && m.team === DEAD_TEAM && m.tag === DEAD.tag && m.hp === 116 && m.sickAt == null && w.events.filter((e) => e.type === "kill").length === 0, `${m.team}/${m.hp}`);
  }

  // (d) the turn: ten seconds after the stamp, not before
  {
    const w = makeWorld({ field: flat, seed: SEED }); w.depotCombat = true;
    const m = man(w, 2, 0, 0); m.sickAt = 100;
    w.t = 109.9; stepSick(w);
    ok("(d) at 9.9 seconds he still stands as a man", m.team === 2);
    w.t = 110; stepSick(w);
    ok("(d) at ten seconds he turns", m.team === DEAD_TEAM && m.tag === DEAD.tag && m.hp === 116);
  }

  // (e) the hunt: 12 meters closed and a bite landed inside four seconds; 30 meters is not sensed
  {
    const w = makeWorld({ field: flat, seed: SEED }); w.depotCombat = true;
    const d = spawnDead(w, 0, 0); const m = man(w, 1, 12, 0);
    const hp0 = m.hp; let bitAt = null;
    for (let i = 0; i < 480 && bitAt == null; i++) { stepDead(w, 1 / 120); w.t += 1 / 120; d.pos.x += d.v.x / 120; d.pos.z += d.v.z / 120; if (m.hp < hp0) bitAt = w.t; }
    ok("(e) the dead close 12 meters and bite inside four seconds", bitAt != null && bitAt < 4, bitAt == null ? "no bite" : bitAt.toFixed(2) + "s");
    const w2 = makeWorld({ field: flat, seed: SEED }); const d2 = spawnDead(w2, 0, 0); man(w2, 1, 30, 0);
    for (let i = 0; i < 60; i++) stepDead(w2, 1 / 120);
    ok("(e) a man 30 meters off is not sensed — the dead stand", Math.hypot(d2.v.x, d2.v.z) < 1e-6 && d2.tgtId == null);
  }

  // (f) the roster: a turned member leaves his squad on the prune
  {
    const w = makeWorld({ field: flat, seed: SEED }); const m = man(w, 1, 0, 0);
    const sq = { id: 1, type: "rifles", team: 1, order: "defend", dest: null, memberIds: [m.id], anchor: { x: 0, z: 0 } };
    let out = pruneSquads(w, [sq]);
    ok("(f) a living man stays on the roster", out.length === 1 && out[0].memberIds.length === 1);
    turnDead(w, m); out = pruneSquads(w, [sq]);
    ok("(f) a turned man leaves it and the empty squad is dropped", out.length === 0);
  }

  // (g) the market: the dead are not men on the market
  {
    const w = makeWorld({ field: flat, seed: SEED }); man(w, 1, 0, 0); man(w, 2, 2, 0); spawnDead(w, 4, 0); spawnDead(w, 6, 0);
    const c = marketCounts(w, [], []);
    ok("(g) two men count, two dead do not", c._men === 2, `${c._men}`);
  }

  // (h) the ramp: a squad with a bitten man cannot board
  {
    const w = makeWorld({ field: flat, seed: SEED }); const a = man(w, 1, 0, 0), b = man(w, 1, 1, 0);
    const sq = { memberIds: [a.id, b.id] };
    ok("(h) a clean squad may board", squadCanBoard(w, sq));
    b.sickAt = 1;
    ok("(h) a bitten man keeps his squad off the ramp", !squadCanBoard(w, sq));
  }

  // (i) the tower shoots the dead: a player tower acquires one of the dead in reach
  {
    const w = makeWorld({ field: flat, seed: SEED }); w.depotCombat = true;
    const t = addBody(w, { kind: "tower", team: 1, mass: 0, hx: 0.8, hy: 1.0, hz: 0.8, x: 0, y: 1.0, z: 0, hp: 80 }); t.towerType = "mg"; t.maxHp = 80;
    spawnDead(w, 6, 0);
    const map = makeMap(SEED);
    for (let i = 0; i < 30; i++) { stepTowers(w, null, "free", undefined, [], null, map); w.t += 1 / 120; }
    ok("(i) the player's tower takes one of the dead as its target", t.targetId != null && w.byId.get(t.targetId).team === DEAD_TEAM, String(t.targetId));
  }

  // (j) the boot: the outbreak fields exactly six dead at the middle town; the war fields none; the boot draws are untouched
  {
    const warW = bootWar({ seed: SEED }), ob = bootWar({ seed: SEED, outbreak: true });
    const deadOf = (w) => w.world.bodies.filter((b) => b.kind === "unit" && b.team === DEAD_TEAM && b.alive);
    ok("(j) the war fields no dead", deadOf(warW).length === 0);
    const dd = deadOf(ob);
    ok("(j) the outbreak fields six", dd.length === 6, `${dd.length}`);
    const c = outbreakCenter(ob.map);
    ok("(j) they stand at the middle town", dd.every((b) => Math.hypot(b.pos.x - c.x, b.pos.z - c.z) < 14), dd.map((b) => Math.hypot(b.pos.x - c.x, b.pos.z - c.z).toFixed(1)).join(","));
    ok("(j) the war's run carries no outbreak key; the outbreak's does", warW.run.outbreak === undefined && ob.run.outbreak === true);
    ok("(j) the outbreak spends no draw the war does not — the next draw is the same number", warW.world.rng() === ob.world.rng());
  }

  // (k) the save: an outbreak serializes through the war's own save and resumes with its dead and its sickness
  {
    const ob = bootWar({ seed: SEED, outbreak: true }); ob.run.started = true;
    const input = defaultTickInput();
    for (let i = 0; i < 240; i++) tickWar(ob, 1 / 120, input);
    const m = ob.world.bodies.find((b) => b.kind === "unit" && b.team === 2 && b.alive); if (m) m.sickAt = ob.world.t;
    const n0 = ob.world.bodies.filter((b) => b.kind === "unit" && b.team === DEAD_TEAM && b.alive).length;
    const p = parseFront(serializeRun(ob));
    ok("(k) the outbreak serializes through the war's own save", p.ok);
    const back = bootWar({ seed: p.data.map.seed, resume: p.data, outbreak: true });
    const n1 = back.world.bodies.filter((b) => b.kind === "unit" && b.team === DEAD_TEAM && b.alive).length;
    ok("(k) the dead come back, every one", n1 === n0 && n0 > 0, `${n0}->${n1}`);
    const sick = back.world.bodies.filter((b) => b.sickAt != null).length;
    ok("(k) the sickness stamp rides the save", !m || sick === 1, `${sick}`);
    ok("(k) the resumed run is an outbreak", back.run.outbreak === true);
  }
}
