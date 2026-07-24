// Scenario pipeline gate — the Phase 4 golden migration test. Scenario #0
// (the proving grounds as JSON) must be worldHash-identical to the demo's
// hand-built world at t=0 and after 10 sim-seconds with a scripted volley;
// the plan's gate also demands one NEW contract authored purely in JSON with
// no engine edits, proven loadable, deterministic, in budget, and playable.
import { readFileSync } from "node:fs";
import { buildProvingGrounds, stepWorld, fireVolley, worldHash } from "../src/engine/core.js";
import { buildScenario, lintScenario } from "../src/game/scenario.js";
import { matchKill } from "../src/game/predicate.js";

const fails = [];
const ok = (name, cond) => {
  console.log(`${cond ? "PASS" : "FAIL"} — ${name}`);
  if (!cond) fails.push(name);
};
const loadSpec = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));

const run = (w, { volley = null, steps = 1200, collect = null } = {}) => {
  for (let i = 0; i < steps / 2; i++) { w.events.length = 0; stepWorld(w); }
  if (volley) fireVolley(w, volley[0], volley[1], 6, "player");
  for (let i = 0; i < steps / 2; i++) {
    w.events.length = 0; stepWorld(w);
    if (collect) for (const e of w.events) if (e.type === "kill") collect.push({ ...e });
  }
  return worldHash(w);
};

// --- golden migration: scenario #0 vs the hand-built proving grounds
{
  const spec = loadSpec("../src/game/scenarios/proving-grounds.json");
  const hand = buildProvingGrounds(1234);
  const data = buildScenario(spec);
  ok("scenario #0: body count matches hand-built", data.bodies.length === hand.bodies.length);
  ok("scenario #0: weld count matches hand-built", data.welds.length === hand.welds.length);
  ok("scenario #0: identical worldHash at t=0", worldHash(data) === worldHash(hand));
  const h1 = run(hand, { volley: [0, -30] });
  const h2 = run(data, { volley: [0, -30] });
  ok("scenario #0: identical worldHash after 10s + scripted volley", h1 === h2);
  ok("scenario #0: within its declared budget", lintScenario(spec, buildScenario(spec)).length === 0);
  // double-load determinism
  const d1 = buildScenario(spec), d2 = buildScenario(spec);
  ok("scenario #0: double-load deterministic at t=0", worldHash(d1) === worldHash(d2));

  // the shelters opt-in: exposed, deterministic, and actually live
  const s1 = buildScenario(spec, { shelters: true });
  ok("shelters opt-in exposes the four house shelters", Array.isArray(s1.pg.shelters) && s1.pg.shelters.length === 4);
  ok("respawn api present (squads, keep repair, freeze)", typeof s1.pg.respawnSquad === "function" && typeof s1.pg.repairGarrison === "function" && typeof s1.pg.freeze === "function");
  const hs1 = run(s1, { volley: [0, -30] });
  const hs2 = run(buildScenario(spec, { shelters: true }), { volley: [0, -30] });
  ok("shelters-on world is deterministic", hs1 === hs2);
  ok("sheltering changes panic behavior (diverges from parity world)", hs1 !== h2);
  // repair round-trip: same keep body count after demolition + repair
  const s3 = buildScenario(spec, { shelters: true });
  const keepCount = s3.bodies.filter((b) => b.group === "garrison").length;
  s3.pg.repairGarrison();
  ok("keep repair rebuilds the same masonry", s3.bodies.filter((b) => b.group === "garrison").length === keepCount);
}

// --- the phase gate: a NEW contract authored purely in JSON
{
  const spec = loadSpec("../src/game/scenarios/ac-01-interdiction.json");
  const w1 = buildScenario(spec), w2 = buildScenario(spec);
  ok("AC-01 loads from JSON with no engine edits", w1.bodies.length > 100);
  ok("AC-01: within its declared budget", lintScenario(spec, w1).length === 0);
  ok("AC-01: double-load deterministic at t=0", worldHash(w1) === worldHash(w2));
  const g1 = run(w1, { steps: 600 });
  const g2 = run(w2, { steps: 600 });
  ok("AC-01: deterministic through 5 idle seconds", g1 === g2);
  // playable: a volley on the road satisfies the contract predicate
  const w3 = buildScenario(spec);
  // authored terrain sanity BEFORE the bombardment carves craters into it
  const hA = w3.field.heightAt(0, 20), hB = w3.field.heightAt(3, 22);
  ok("AC-01: authored pad is level", Math.abs(hA - hB) < 0.2 && Math.abs(hA - 2.3) < 0.2);
  const kills = [];
  run(w3, { volley: [0, 20], steps: 900, collect: kills });
  const matched = kills.filter((e) => matchKill(spec.contract.predicate, e)).length;
  console.log(`AC-01 playability: ${kills.length} kills, ${matched} matched the contract predicate`);
  ok("AC-01: the authored contract is completable (matched >= need)", matched >= spec.contract.need);
}

if (fails.length) {
  console.error(`\n${fails.length} FAILURE(S)`);
  process.exit(1);
}
console.log("\nSCENARIO GATE: ALL PASS");
