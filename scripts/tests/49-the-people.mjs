import { ok } from "./harness.mjs";
import { makeWorld, addBody } from "../../src/engine/core.js";
import { DEAD, DEAD_TEAM, MAN, PERSON, INFANTRY_ARMS } from "../../src/depot/specs.js";
import { spawnDead, stepDead, stepSick } from "../../src/depot/dead.js";
import { spawnPerson, spawnPeople, stepPeople, peopleOf } from "../../src/depot/people.js";
import { scoreKill, creditKill, friendlyFouls } from "../../src/depot/state.js";
import { marketCounts } from "../../src/depot/market.js";
import { stepMedicTend } from "../../src/depot/squads.js";
import { unloadApc } from "../../src/depot/transports.js";
import { bootWar } from "../../src/depot/boot.js";
import { tickWar } from "../../src/depot/tick.js";
import { serializeRun, defaultTickInput } from "../../src/depot/api.js";
import { parseFront } from "../../src/depot/save.js";

// ==== 0.6.2: the people and the carriers ====================================
// Seed rolled each run.
{
  console.log("\n[0.6.2: the people and the carriers]");
  const SEED = (Date.now() % 1000000) + 1;
  console.log("  fixture seed base", SEED);
  const flat = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (x, z, o) => { o.x = 0; o.y = 1; o.z = 0; return o; } };
  const flatMap = { clampToRim: (x, z) => ({ x, z }) };
  const man = (w, team, x, z) => { const u = addBody(w, { kind: "unit", team, mass: MAN.rifle.mass, hx: MAN.rifle.hx, hy: MAN.rifle.hy, hz: MAN.rifle.hz, x, z, y: MAN.rifle.hy + 0.02, hp: MAN.rifle.hp, friction: 0.5 }); u.maxHp = MAN.rifle.hp; return u; };
  const integrate = (w, u, dt) => { u.pos.x += u.v.x * dt; u.pos.z += u.v.z * dt; };

  // (a) the person's body
  {
    const w = makeWorld({ field: flat, seed: SEED }); w.depotCombat = true;
    const p = spawnPerson(w, 3, 4);
    ok("(a) a person: a unit on team 0, the tag, a man's points, a door to stand at", p.kind === "unit" && p.team === 0 && p.tag === PERSON.tag && p.hp === MAN.rifle.hp && p.maxHp === MAN.rifle.hp && p.pdoor && Math.abs(p.pdoor.x - 3) < 5 && Math.abs(p.pdoor.z - 4) < 5, `${p.team}/${p.tag}/${p.hp}`);
  }

  // (b) the boot: people by the rule, none in the war, the boot draws untouched
  {
    const warW = bootWar({ seed: SEED }), ob = bootWar({ seed: SEED, outbreak: true });
    ok("(b) the war fields no people", peopleOf(warW.world).length === 0);
    let want = 0;
    for (const t of ob.map.TOWN) {
      if (t.depot || t.marker || t.dead || t.id.startsWith("fwall")) continue;
      if (/^hangar/.test(t.id)) { want += 3; continue; }
      if (t.door == null || t.door < 0) continue;
      want += /^warehouse/.test(t.id) ? 3 : 2;
    }
    const got = peopleOf(ob.world).length;
    ok("(b) the outbreak fields two per doored form and three per hangar or warehouse", got === want && want > 0, `${got}/${want}`);
    ok("(b) the outbreak spends no draw the war does not — the next draw is the same number", warW.world.rng() === ob.world.rng());
  }

  // (c) fear of the dead: a person 10 m from one of the dead runs away and stamps the clock
  {
    const w = makeWorld({ field: flat, seed: SEED }); w.depotCombat = true; w.t = 50;
    const p = spawnPerson(w, 0, 0); spawnDead(w, 10, 0);
    for (let i = 0; i < 120; i++) { stepPeople(w, flatMap, 1 / 120); integrate(w, p, 1 / 120); w.t += 1 / 120; }
    ok("(c) she runs away from the dead", p.pos.x < -2, p.pos.x.toFixed(2));
    ok("(c) the fear stamps the clock", p.fleeT != null && p.fleeT >= 50, String(p.fleeT));
  }

  // (d) fear of gunfire: a shot 20 m off this tick sends her running; one 50 m off does not
  {
    const w = makeWorld({ field: flat, seed: SEED }); w.depotCombat = true; w.t = 10;
    const p = spawnPerson(w, 0, 0);
    w.events.push({ type: "muzzle", x: 50, y: 1, z: 0 });
    stepPeople(w, flatMap, 1 / 120);
    ok("(d) a shot 50 m off is not heard", !p._fleeing);
    w.events.length = 0; w.events.push({ type: "muzzle", x: 20, y: 1, z: 0 });
    stepPeople(w, flatMap, 1 / 120);
    ok("(d) a shot 20 m off sends her running, away from it", !!p._fleeing && p.goal && p.goal.x < 0, p.goal ? p.goal.x.toFixed(1) : "-");
  }

  // (e) home: thirty quiet seconds and she walks back to her door
  {
    const w = makeWorld({ field: flat, seed: SEED }); w.depotCombat = true; w.t = 100;
    const p = spawnPerson(w, 0, 0); const d = spawnDead(w, 10, 0);
    for (let i = 0; i < 120; i++) { stepPeople(w, flatMap, 1 / 120); integrate(w, p, 1 / 120); w.t += 1 / 120; }
    d.alive = false;
    const far = Math.hypot(p.pos.x - p.pdoor.x, p.pos.z - p.pdoor.z);
    for (let i = 0; i < 120 * 29; i++) { stepPeople(w, flatMap, 1 / 120); integrate(w, p, 1 / 120); w.t += 1 / 120; }
    const still = Math.hypot(p.pos.x - p.pdoor.x, p.pos.z - p.pdoor.z);
    ok("(e) inside thirty seconds she stays where she stopped", far > 2 && Math.abs(still - far) < 1.0, `${far.toFixed(1)}/${still.toFixed(1)}`);
    for (let i = 0; i < 120 * 8; i++) { stepPeople(w, flatMap, 1 / 120); integrate(w, p, 1 / 120); w.t += 1 / 120; }
    ok("(e) after thirty quiet seconds she is home", Math.hypot(p.pos.x - p.pdoor.x, p.pos.z - p.pdoor.z) < 1.0, Math.hypot(p.pos.x - p.pdoor.x, p.pos.z - p.pdoor.z).toFixed(2));
  }

  // (f) the ledger: a person killed by an army scores one for the other army and pays nobody; the dead's kill scores nothing
  {
    const S = { resources: 100, score: { p: { kills: 0, value: 0 }, e: { kills: 0, value: 0 } }, reg: { scrap: 100 } };
    const r1 = scoreKill(S, { type: "kill", kind: "unit", tag: PERSON.tag, team: 0, attacker: "player" }, null);
    ok("(f) your fire on a person scores one for the enemy", r1 && S.score.e.kills === 1 && S.score.p.kills === 0 && S.score.e.value === 0, `${S.score.e.kills}/${S.score.p.kills}`);
    ok("(f) and pays nobody", S.resources === 100 && S.reg.scrap === 100);
    scoreKill(S, { type: "kill", kind: "unit", tag: PERSON.tag, team: 0, attacker: "enemy" }, null);
    ok("(f) its fire on a person scores one for you", S.score.p.kills === 1);
    const r3 = scoreKill(S, { type: "kill", kind: "unit", tag: PERSON.tag, team: 0, attacker: "dead" }, null);
    ok("(f) the dead's kill carries no ledger", r3 === null && S.score.p.kills === 1 && S.score.e.kills === 1);
  }

  // (g) the credit trail: a person's death credits no squad
  {
    const w = makeWorld({ field: flat, seed: SEED }); const s = man(w, 1, 0, 0);
    const sq = { id: 1, memberIds: [s.id], kills: 0 };
    creditKill(w, [sq], [], { type: "kill", kind: "unit", tag: PERSON.tag, team: 0, srcId: s.id });
    ok("(g) no credit for a person", !sq.kills);
  }

  // (h) the market: people are not men on the market
  {
    const w = makeWorld({ field: flat, seed: SEED }); man(w, 1, 0, 0); man(w, 2, 2, 0); spawnPerson(w, 4, 0); spawnPerson(w, 6, 0);
    ok("(h) two men count, two people do not", marketCounts(w, [], [])._men === 2, `${marketCounts(w, [], [])._men}`);
  }

  // (i) the medic's cure: kneeling on a bitten comrade clears the stamp
  {
    const w = makeWorld({ field: flat, seed: SEED }); w.depotCombat = true; w.t = 20;
    const medic = man(w, 1, 0, 0); const pat = man(w, 1, 0.8, 0); pat.hp -= 15; pat.sickAt = 20;
    stepMedicTend(w, medic, 0, 0, 1 / 120);
    ok("(i) the kneel clears the sickness", pat.sickAt == null && medic.kneel === true, `${pat.sickAt}/${medic.kneel}`);
  }

  // (j) CAREFUL holds for a person in the flight path
  {
    const w = makeWorld({ field: flat, seed: SEED }); w.depotCombat = true;
    const muzzle = { x: 0, y: 1.5, z: 0 }, tgt = { x: 10, y: 1.0, z: 0 };
    ok("(j) an empty lane does not foul", !friendlyFouls(w, muzzle, tgt, INFANTRY_ARMS.rifles, null));
    spawnPerson(w, 5, 0);
    ok("(j) a person in the lane fouls the shot", friendlyFouls(w, muzzle, tgt, INFANTRY_ARMS.rifles, null));
  }

  // (k) the hold: a bitten rider turns inside, bites the rider with him, and comes out at the unload
  {
    const w = makeWorld({ field: flat, seed: SEED }); w.depotCombat = true; w.t = 30;
    const v = addBody(w, { kind: "vehicle", team: 1, mass: 2600, hx: 1.6, hy: 1.0, hz: 3.0, x: 0, y: 1.05, z: 0, hp: 300 }); v.vtype = "apc"; v.apcSeq = 1;
    const a = man(w, 1, 0, 0), b = man(w, 1, 0, 0);
    for (const u of [a, b]) { u.riding = true; u.pinned = true; u.pos.y = -60; }
    const run = { squads: [{ id: 1, type: "rifles", team: 1, order: "ride", dest: null, memberIds: [a.id, b.id], anchor: { x: 0, z: 0 }, ridingIn: 1 }], foeSquads: [] };
    a.sickAt = 20;
    stepSick(w, run);
    ok("(k) the bitten rider turns inside the hold and keeps his seat", a.team === DEAD_TEAM && a.rideApc === 1 && a.riding === true, `${a.team}/${a.rideApc}/${a.riding}`);
    stepDead(w, 1 / 120, run);
    ok("(k) he bites the rider with him at the turn", b.hp === MAN.rifle.hp - 15 && b.sickAt === 30, `${b.hp}/${b.sickAt}`);
    for (let i = 0; i < 60; i++) { w.t += 1 / 120; stepDead(w, 1 / 120, run); }
    ok("(k) inside a second he has not bitten again", b.hp === MAN.rifle.hp - 15, `${b.hp}`);
    for (let i = 0; i < 70; i++) { w.t += 1 / 120; stepDead(w, 1 / 120, run); }
    ok("(k) a second on, he bites again", b.hp === MAN.rifle.hp - 30, `${b.hp}`);
    unloadApc(w, run.squads, v);
    ok("(k) the unload puts the dead out with the living", a.rideApc == null && a.riding === false && b.riding === false && a.pos.y > -1, `${a.rideApc}/${a.riding}/${b.riding}/${a.pos.y.toFixed(1)}`);
  }

  // (l) the save: people ride the outbreak's save and come back
  {
    const ob = bootWar({ seed: SEED, outbreak: true }); ob.run.started = true;
    const input = defaultTickInput();
    for (let i = 0; i < 120; i++) tickWar(ob, 1 / 120, input);
    const n0 = peopleOf(ob.world).length;
    const p = parseFront(serializeRun(ob));
    const back = bootWar({ seed: p.data.map.seed, resume: p.data, outbreak: true });
    const n1 = peopleOf(back.world).length;
    ok("(l) the people come back, every one, with their doors", n1 === n0 && n0 > 0 && peopleOf(back.world).every((b) => b.pdoor && Number.isFinite(b.pdoor.x)), `${n0}->${n1}`);
  }
}
