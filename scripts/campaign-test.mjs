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
  ok("AC-01: dock detail carries the human smear tag", w1.bodies.filter((b) => b.group === "dockcrew" && b.kind === "unit").every((u) => u.smearStyle === "human"));

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

// --- AC-02 BATTERY REDUCTION
{
  const spec = loadSpec("../src/game/scenarios/ac-02-battery.json");
  const crew = (w) => w.bodies.filter((b) => b.group === "battery" && b.kind === "unit" && b.alive);
  const park = (w, x, z) => {
    const b = w.byId.get(w.bisonId);
    b.pos.x = x; b.pos.z = z; b.pos.y = w.field.heightAt(x, z) + 0.97;
    b.v.x = b.v.y = b.v.z = 0;
    return b;
  };
  const w1 = buildScenario(spec, { shelters: true });
  ok("AC-02: loads, in budget", lintScenario(spec, w1).length === 0, `${w1.bodies.length} bodies, ${w1.welds.length} welds`);
  ok("AC-02: nine crew staged on three terraces", crew(w1).length === 9);
  ok("AC-02: crews are grenadiers in android dress", crew(w1).every((u) => u.utype === "gren" && u.dress === "android" && u.smearStyle === "android"));
  const w2 = buildScenario(spec, { shelters: true });
  ok("AC-02: double-load deterministic", worldHash(w1) === worldHash(w2));

  // idle: the spawn line sits outside the 26m mortar envelope — the pool must
  // stay whole and visible to the runner's exhaustion check, with no fire
  {
    const wIdle = buildScenario(spec, { shelters: true });
    let everEmpty = false, fired = false;
    for (let i = 0; i < 1200 && !everEmpty; i++) {
      wIdle.events.length = 0;
      stepWorld(wIdle);
      for (const e of wIdle.events) if (e.type === "boom" && e.kind === "mortar") fired = true;
      if (!crew(wIdle).length) everEmpty = true;
    }
    ok("AC-02: subject pool visible through 10 idle seconds", !everEmpty);
    ok("AC-02: no mortar fire at the spawn line", !fired);
  }

  // return fire: park on the apron inside the envelope; rounds must arrive
  // NEAR the instrument — mortars that clip their own parapet never leave
  // the terrace (map-drafts risk 4: if this fails, slide the squads north)
  {
    const w = buildScenario(spec, { shelters: true });
    const b = park(w, 0, -9);
    let mortars = 0, near = 0;
    for (let i = 0; i < 1200; i++) {
      w.events.length = 0;
      stepWorld(w);
      for (const e of w.events) if (e.type === "boom" && e.kind === "mortar") {
        mortars++;
        if (Math.hypot(e.x - b.pos.x, e.z - b.pos.z) < 14) near++;
      }
    }
    ok("AC-02: batteries fire on the apron", mortars > 0, `${mortars} impacts in 20s`);
    ok("AC-02: rounds clear the parapets and land on target", near > 0, `${near}/${mortars} within 14m`);
  }

  // completability: shell the terraces from the apron while return fire is
  // live. Any-cause group predicate — every crew death credits, need 9
  const run = (w) => {
    park(w, 0, -12);
    let prog = 0, nextFire = 0, t0 = w.t;
    while (w.t - t0 < 90 && prog < spec.contract.need) {
      if (w.t >= nextFire) {
        const tg = crew(w)[0];
        if (tg) { bisonFire(w, { x: tg.pos.x, z: tg.pos.z }); nextFire = w.t + 1.2; }
      }
      w.events.length = 0;
      stepWorld(w);
      for (const e of w.events) if (e.type === "kill" && matchKill(spec.contract.predicate, e)) prog++;
    }
    return { prog, t: w.t - t0 };
  };
  const r = run(buildScenario(spec, { shelters: true }));
  ok("AC-02: completable under return fire", r.prog >= spec.contract.need, `${r.prog}/${spec.contract.need} in ${r.t.toFixed(1)}s`);
  ok("AC-02: inside silver par", r.t <= spec.contract.par[1], `${r.t.toFixed(1)}s vs ${spec.contract.par[1]}s`);

  // restock (unreachable in play — any-cause credits everything — but the
  // runner inherits it, so the mechanism must reissue ALL three squads)
  const w3 = buildScenario(spec, { shelters: true });
  for (const u of [...crew(w3)]) explode(w3, u.pos.x, u.pos.y + 0.5, u.pos.z, { r: 3.0, kv: 26, dmg: 220, crater: 0 });
  for (let s = 0; s < 60; s++) { w3.events.length = 0; stepWorld(w3); }
  ok("AC-02: blast wipe clears the crews", crew(w3).length === 0);
  w3.pg.respawnGroup("battery");
  const re = crew(w3);
  ok("AC-02: respawnGroup reissues all three squads", re.length === 9);
  ok("AC-02: reissued crews keep the android dress", re.every((u) => u.dress === "android" && u.smearStyle === "android"));
}

if (fails.length) {
  console.error(`\n${fails.length} FAILURE(S)`);
  process.exit(1);
}
console.log("\nCAMPAIGN GATE: ALL PASS");
