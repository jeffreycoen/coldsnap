// Campaign content gate. Every campaign scenario must: stay in budget,
// double-load deterministically, be completable with the intended tactic,
// and recover from a wrong-cause wipe via pg.respawnGroup (the runner's
// restock). Missions are added here one at a time as they are built.
import { readFileSync } from "node:fs";
import { stepWorld, bisonFire, explode, worldHash } from "../src/engine/core.js";
import { buildScenario, lintScenario } from "../src/game/scenario.js";
import { matchKill } from "../src/game/predicate.js";

const fails = [];
const ok = (name, cond, detail = "") => {
  console.log(`${cond ? "PASS" : "FAIL"} — ${name}${detail ? ` (${detail})` : ""}`);
  if (!cond) fails.push(name);
};
const loadSpec = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));

const plates = (w) => w.bodies.filter((b) => b.group === "plate" && b.kind === "vehicle" && b.alive);

// --- AC-01 ARMOR PLATE ACCEPTANCE
{
  const spec = loadSpec("../src/game/scenarios/ac-01-plate.json");
  const w1 = buildScenario(spec, { shelters: true });
  ok("AC-01: loads, in budget", lintScenario(spec, w1).length === 0, `${w1.bodies.length} bodies`);
  ok("AC-01: eight plates staged", plates(w1).length === 8);
  const w2 = buildScenario(spec, { shelters: true });
  ok("AC-01: double-load deterministic", worldHash(w1) === worldHash(w2));

  // the runner's exhaustion check must see a live pool from frame one — a
  // kind-blind count (the unit-only bug) restock-spammed an untouched map
  {
    const wIdle = buildScenario(spec, { shelters: true });
    let everEmpty = false;
    for (let i = 0; i < 1200 && !everEmpty; i++) {
      stepWorld(wIdle);
      let alive = 0;
      for (const b of wIdle.bodies) if ((b.kind === "unit" || b.kind === "vehicle") && b.group === spec.contract.subjects && b.alive) { alive = 1; break; }
      if (!alive) everEmpty = true;
    }
    ok("AC-01: subject pool visible to the runner through 10 idle seconds", !everEmpty);
  }

  // completability: aimed shells, one per plate, until 6 PROJECTILE credits
  const run = (w) => {
    let prog = 0, nextFire = 0, t0 = w.t;
    while (w.t - t0 < 60 && prog < spec.contract.need) {
      if (w.t >= nextFire) {
        const tg = plates(w)[0];
        if (!tg) break;
        bisonFire(w, { x: tg.pos.x, z: tg.pos.z });
        nextFire = w.t + 1.2;
      }
      w.events.length = 0;
      stepWorld(w);
      for (const e of w.events) if (e.type === "kill" && matchKill(spec.contract.predicate, e)) prog++;
    }
    return { prog, t: w.t - t0 };
  };
  const r = run(w1);
  ok("AC-01: completable by direct fire", r.prog >= spec.contract.need, `${r.prog}/${spec.contract.need} in ${r.t.toFixed(1)}s`);
  ok("AC-01: inside silver par", r.t <= spec.contract.par[1], `${r.t.toFixed(1)}s vs ${spec.contract.par[1]}s`);

  // strand-proof: wipe every plate by blast (no PROJECTILE credit), then the
  // runner's restock path must reissue the full rack and stay completable
  const w3 = buildScenario(spec, { shelters: true });
  for (let i = 0; i < 30 && plates(w3).length; i++) {
    const tg = plates(w3)[0];
    explode(w3, tg.pos.x + 1.0, tg.pos.y, tg.pos.z, { r: 3.0, kv: 26, dmg: 220, crater: 0 });
    for (let s = 0; s < 30; s++) { w3.events.length = 0; stepWorld(w3); }
  }
  ok("AC-01: blast wipe leaves no live subject", plates(w3).length === 0);
  w3.pg.respawnGroup("plate");
  ok("AC-01: respawnGroup reissues the rack", plates(w3).length === 8);
  const r3 = run(w3);
  ok("AC-01: still completable after restock", r3.prog >= spec.contract.need, `${r3.prog}/${spec.contract.need}`);
}

if (fails.length) {
  console.error(`\n${fails.length} FAILURE(S)`);
  process.exit(1);
}
console.log("\nCAMPAIGN GATE: ALL PASS");
