// Campaign content gate. Every campaign scenario must: stay in budget,
// double-load deterministically, be completable with the intended tactic,
// and recover from a wrong-cause wipe via pg.respawnGroup (the runner's
// restock). Missions are added here one at a time as they are built.
import { readFileSync } from "node:fs";
import { stepWorld, bisonFire, fireVolley, explode, worldHash } from "../src/engine/core.js";
import { buildScenario, lintScenario } from "../src/game/scenario.js";
import { matchKill } from "../src/game/predicate.js";
import { composeAAR, resolveEvidence } from "../src/aar/compose.js";
import { disperseState } from "../src/game/altcheck.js";

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

// --- AC-03 CONVOY INTERDICTION
{
  const spec = loadSpec("../src/game/scenarios/ac-03-route.json");
  const pool = (w) => w.bodies.filter((b) => b.group === "convoy" && b.alive && (b.kind === "unit" || b.kind === "truck"));
  const units = (w) => pool(w).filter((b) => b.kind === "unit");
  const w1 = buildScenario(spec, { shelters: true });
  ok("AC-03: loads, in budget", lintScenario(spec, w1).length === 0, `${w1.bodies.length} bodies, ${w1.welds.length} welds`);
  ok("AC-03: column staged — 4 trucks, 12 crew, 16 subjects", pool(w1).length === 16 && units(w1).length === 12);
  ok("AC-03: crews in android dress, guards are grenadiers", units(w1).every((u) => u.dress === "android") && units(w1).filter((u) => u.utype === "gren").length === 2);
  ok("AC-03: both house shelters exposed", w1.pg.shelters && w1.pg.shelters.length === 2);
  const w2 = buildScenario(spec, { shelters: true });
  ok("AC-03: double-load deterministic", worldHash(w1) === worldHash(w2));

  // idle: the column stands, nobody fires at the spawn line
  {
    const wIdle = buildScenario(spec, { shelters: true });
    let everEmpty = false, fired = false;
    for (let i = 0; i < 1200 && !everEmpty; i++) {
      wIdle.events.length = 0;
      stepWorld(wIdle);
      for (const e of wIdle.events) if (e.type === "boom" && e.kind === "mortar") fired = true;
      if (pool(wIdle).length < 16) everEmpty = true;
    }
    ok("AC-03: column intact through 10 idle seconds", !everEmpty);
    ok("AC-03: no mortar fire at the spawn line", !fired);
  }

  // bail-out: shells into the column panic the crews — some must actually
  // make it to the house doors (the shelter path is load-bearing here). A
  // second shell keeps the scare alive like real bombardment would.
  {
    // the scare commitment lasts 6s per blast — sustained bombardment (like
    // real play: player shells + gren mortars) keeps crews committed to the
    // doors instead of stranding them mid-route when one scare expires
    const w = buildScenario(spec, { shelters: true });
    let nextShell = 0, sheltered = 0;
    for (let i = 0; i < 2400; i++) {
      if (w.t >= nextShell) { bisonFire(w, { x: 0.5, z: 14 + (i % 3) * 6 }); nextShell = w.t + 3.5; }
      w.events.length = 0;
      stepWorld(w);
    }
    for (const u of units(w)) {
      if (!u.alive) continue;
      for (const s of w.pg.shelters) {
        if (Math.hypot(u.pos.x - s.inside.x, u.pos.z - s.inside.z) < 2.2 || Math.hypot(u.pos.x - s.door.x, u.pos.z - s.door.z) < 2.2) { sheltered++; break; }
      }
    }
    ok("AC-03: panicked crews reach the house doors", sheltered >= 1, `${sheltered} at the doors after 20s`);
  }

  // completability: the bot plays like the draft's intended attempt — advance
  // up the road in bounds, lead running targets by their velocity
  const advance = (w, z) => {
    const b = w.byId.get(w.bisonId);
    b.pos.x = 0; b.pos.z = z; b.pos.y = w.field.heightAt(0, z) + 0.97;
    b.v.x = b.v.y = b.v.z = 0;
  };
  const run = (w, opener) => {
    let prog = 0, nextFire = 0, t0 = w.t, bz = -42;
    if (opener) { fireVolley(w, 0, 20, 6, "player"); }
    while (w.t - t0 < 90 && prog < spec.contract.need) {
      const el = w.t - t0;
      const wantZ = Math.min(6, -42 + el * 2.2); // ~driving pace up the causeway
      if (wantZ > bz + 4) { bz = wantZ; advance(w, bz); }
      if (w.t >= nextFire) {
        const b = w.byId.get(w.bisonId);
        let tg = null, td = 1e9;
        for (const s of pool(w)) { const d = Math.hypot(s.pos.x - b.pos.x, s.pos.z - b.pos.z); if (d < td) { td = d; tg = s; } }
        if (tg) {
          const lead2 = td / 50; // rough shell flight time — lead the runners
          bisonFire(w, { x: tg.pos.x + tg.v.x * lead2, z: tg.pos.z + tg.v.z * lead2 });
          nextFire = w.t + 1.2;
        }
      }
      w.events.length = 0;
      stepWorld(w);
      for (const e of w.events) if (e.type === "kill" && matchKill(spec.contract.predicate, e)) prog++;
    }
    return { prog, t: w.t - t0 };
  };
  const r = run(buildScenario(spec, { shelters: true }), false);
  ok("AC-03: completable by direct fire on the advance", r.prog >= spec.contract.need, `${r.prog}/${spec.contract.need} in ${r.t.toFixed(1)}s`);
  ok("AC-03: inside silver par", r.t <= spec.contract.par[1], `${r.t.toFixed(1)}s vs ${spec.contract.par[1]}s`);
  const rv = run(buildScenario(spec, { shelters: true }), true);
  ok("AC-03: volley opener supports the gold par", rv.prog >= spec.contract.need && rv.t <= spec.contract.par[0] && rv.t < r.t, `${rv.prog}/${spec.contract.need} in ${rv.t.toFixed(1)}s vs gold ${spec.contract.par[0]}s (direct fire ${r.t.toFixed(1)}s)`);

  // restock must reissue BOTH squads and all four trucks (two squad specs
  // share the subjects tag — map-drafts risk 2). Bursts are offset outside
  // each hull: the occlusion model shades a body from a burst inside itself.
  const w3 = buildScenario(spec, { shelters: true });
  for (const s of [...pool(w3)]) {
    explode(w3, s.pos.x + s.hx + 1.1, s.pos.y + 0.5, s.pos.z, { r: 3.5, kv: 26, dmg: 300, crater: 0 });
    explode(w3, s.pos.x - s.hx - 1.1, s.pos.y + 0.5, s.pos.z, { r: 3.5, kv: 26, dmg: 300, crater: 0 });
  }
  for (let s = 0; s < 60; s++) { w3.events.length = 0; stepWorld(w3); }
  ok("AC-03: blast wipe clears the column", pool(w3).length === 0);
  w3.pg.respawnGroup("convoy");
  ok("AC-03: respawnGroup reissues squads and trucks alike", pool(w3).length === 16 && units(w3).length === 12);

  // evidence machinery: campaign contracts append ATTACHMENT lines; a
  // contract without evidence composes byte-identically to before
  const mkKills = [{ type: "kill", cause: "BLAST", attacker: "player", group: "convoy", t: 5 }];
  const withEv = composeAAR({ contract: spec.contract, events: mkKills, elapsed: 30, seed: 7 });
  const attLines = withEv.filter((l) => l.startsWith("ATTACHMENT "));
  ok("AC-03: evidence attachments filed on the report", attLines.length === 2 && attLines[0] === `ATTACHMENT A · ${spec.contract.evidence[0]}` && attLines[1] === `ATTACHMENT B · ${spec.contract.evidence[1]}`);
  const noEv = composeAAR({ contract: { wo: "AC-03", title: "X" }, events: mkKills, elapsed: 30, seed: 7 });
  ok("AC-03: evidence-free contracts compose unchanged", !noEv.some((l) => l.startsWith("ATTACHMENT ")));
}

// --- AC-04 CROSSING DENIAL
{
  const spec = loadSpec("../src/game/scenarios/ac-04-crossing.json");
  const crew = (w) => w.bodies.filter((b) => b.group === "crossing" && b.kind === "unit" && b.alive);
  const park = (w, x, z) => {
    const b = w.byId.get(w.bisonId);
    b.pos.x = x; b.pos.z = z; b.pos.y = w.field.heightAt(x, z) + 0.97;
    b.v.x = b.v.y = b.v.z = 0; b.w.x = b.w.y = b.w.z = 0;
  };
  const stepN = (w, n) => { for (let i = 0; i < n; i++) { w.events.length = 0; stepWorld(w); } };
  const w1 = buildScenario(spec, { shelters: true });
  ok("AC-04: loads, in budget", lintScenario(spec, w1).length === 0, `${w1.bodies.length} bodies, ${w1.welds.length} welds`);
  ok("AC-04: pool frozen, hut shelter exposed", w1.bodies.some((b) => b.kind === "ice") && w1.pg.shelters.length === 1);
  ok("AC-04: eight crossing crew staged in android dress", crew(w1).length === 8 && crew(w1).every((u) => u.dress === "android"));
  ok("AC-04: detail stands ON the sheet, not the bowl floor", crew(w1).every((u) => u.pos.y > 1.6), crew(w1).map((u) => u.pos.y.toFixed(2)).join(","));
  const w2 = buildScenario(spec, { shelters: true });
  ok("AC-04: double-load deterministic", worldHash(w1) === worldHash(w2));

  // the blocking bug this map found: without the ice-aware spawn floor the
  // detail drowned at t=0 and self-completed the order
  {
    const w = buildScenario(spec, { shelters: true });
    let everDead = false;
    for (let i = 0; i < 1200 && !everDead; i++) {
      w.events.length = 0;
      stepWorld(w);
      if (crew(w).length < 8) everDead = true;
    }
    ok("AC-04: nobody drowns through 10 idle seconds", !everDead, `${crew(w).length}/8 after idle`);
  }

  // kill path: shells into the south span crack the lattice, the gangs go in
  const runKill = (w) => {
    park(w, 0, 0);
    let prog = 0, nextFire = 0, t0 = w.t;
    while (w.t - t0 < 60 && prog < spec.contract.need) {
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
  const rk = runKill(buildScenario(spec, { shelters: true }));
  ok("AC-04: kill path completes", rk.prog >= spec.contract.need, `${rk.prog}/${spec.contract.need} in ${rk.t.toFixed(1)}s`);
  ok("AC-04: kill path inside silver par", rk.t <= spec.contract.par[1], `${rk.t.toFixed(1)}s vs ${spec.contract.par[1]}s`);

  // deviation path: the staged drive from the map draft — nose up the south
  // apron (fear bubble breaks the detail), then each lay-by spit clears the
  // stragglers off the far lips. Runner semantics: disperseState over the
  // pool rect, altT accumulates while CLEAR, holdS 5, any death VOIDs.
  {
    const w = buildScenario(spec, { shelters: true });
    const pool = spec.terrain.pool;
    const b = w.byId.get(w.bisonId);
    let altT = 0, best = 0, voided = false;
    const watch = () => {
      for (const e of w.events) if (e.type === "kill" && e.group === "crossing") voided = true;
      const st = disperseState(w.bodies, pool, "crossing");
      altT = st === "CLEAR" ? altT + w.dt : 0;
      if (altT > best) best = altT;
    };
    // the proven bloodless choreography (probe-verified, deterministic):
    // one warning shell on the dry south apron breaks the main body — the
    // crews walk the sheet (divergence #6) and exit over the fords — then
    // an east-bank drive parks SHORT of the spit so the fear bubble alone
    // walks the east column out. No hull ever touches the sheet or a crew.
    const driveTo = (tx, tz, thr, tol) => {
      for (let i = 0; i < 3600; i++) {
        const dx = tx - b.pos.x, dz = tz - b.pos.z, d = Math.hypot(dx, dz);
        if (d < tol) return;
        const yaw = Math.atan2(b.R[6], b.R[8]);
        let err = Math.atan2(dx, dz) - yaw;
        while (err > Math.PI) err -= 2 * Math.PI;
        while (err < -Math.PI) err += 2 * Math.PI;
        w.control.steer = Math.max(-1, Math.min(1, err * 2));
        w.control.throttle = Math.abs(err) > 1.2 ? 0.25 : thr;
        w.control.brake = false;
        w.events.length = 0; stepWorld(w); watch();
      }
    };
    const holdS = (sec) => {
      w.control.throttle = 0; w.control.steer = 0; w.control.brake = true;
      for (let i = 0; i < sec * 120; i++) { w.events.length = 0; stepWorld(w); watch(); if (best >= spec.contract.alt.holdS) return; }
    };
    park(w, 0, 2);
    bisonFire(w, { x: -5, z: 14 }); // warning shell into the apron dirt, 7m+ from every crew
    holdS(12);
    driveTo(10, 8, 0.5, 2);         // east-bank lane, never near the sheet
    driveTo(13, 17, 0.3, 1.2);      // park short of the spit
    holdS(14);
    driveTo(12.5, 21, 0.2, 1.0);    // creep north for the far straggler
    holdS(45);
    ok("AC-04: the herd disperses the detail without a kill", !voided && best >= spec.contract.alt.holdS, `hold ${best.toFixed(1)}s, ${crew(w).length}/8 alive${voided ? ", VOIDED" : ""}`);
  }

  // restock restages the detail on the sheet (fresh world: the ice-aware
  // floor must apply to respawns too)
  {
    const w = buildScenario(spec, { shelters: true });
    w.pg.respawnGroup("crossing");
    ok("AC-04: restock restages the detail on the sheet", crew(w).length === 8 && crew(w).every((u) => u.pos.y > 1.6));
  }

  // outcome-split evidence: fulfilled files the survey lines, deviation files
  // only the written-off-in-place line
  const mkKills = [{ type: "kill", cause: "DROWN", attacker: "player", group: "crossing", t: 5 }];
  const ful = composeAAR({ contract: spec.contract, events: mkKills, elapsed: 30, seed: 7 }).filter((l) => l.startsWith("ATTACHMENT "));
  const dev = composeAAR({ contract: spec.contract, events: [], elapsed: 30, seed: 7, outcome: "UNFULFILLED — DEVIATION" }).filter((l) => l.startsWith("ATTACHMENT "));
  ok("AC-04: fulfilled report files the survey attachments", ful.length === 3 && ful.every((l) => !l.includes("written off")));
  ok("AC-04: deviation report files only the write-off", dev.length === 1 && dev[0] === "ATTACHMENT A · Detail dispersed. Crossing intact. Throughput at time of survey: zero. Recovery uneconomic; written off in place.");
}

// --- AC-05 OUTBUILDING, OCCUPIED
{
  const spec = loadSpec("../src/game/scenarios/ac-05-steading.json");
  const crew = (w) => w.bodies.filter((b) => b.group === "holdout" && b.kind === "unit" && b.alive);
  const w1 = buildScenario(spec, { shelters: true });
  ok("AC-05: loads, in budget", lintScenario(spec, w1).length === 0, `${w1.bodies.length} bodies, ${w1.welds.length} welds`);
  ok("AC-05: twelve holdouts staged in android dress", crew(w1).length === 12 && crew(w1).every((u) => u.dress === "android"));
  ok("AC-05: three shelters (two houses + the granary)", w1.pg.shelters.length === 3);
  ok("AC-05: keep group is not the subjects tag", (spec.prefabs.find((p) => p.type === "keep") || {}).group !== spec.contract.subjects);
  const w2 = buildScenario(spec, { shelters: true });
  ok("AC-05: double-load deterministic", worldHash(w1) === worldHash(w2));

  {
    const wIdle = buildScenario(spec, { shelters: true });
    let everDead = false;
    for (let i = 0; i < 1200 && !everDead; i++) {
      wIdle.events.length = 0;
      stepWorld(wIdle);
      if (crew(wIdle).length < 12) everDead = true;
    }
    ok("AC-05: detail stands through 10 idle seconds", !everDead);
  }

  // the taught mistake: direct fire earns nothing — every wrong-cause kill
  // fails the predicate, and the runner's restock (which also re-lays the
  // granary via repairGarrison) keeps the order alive
  ok("AC-05: blast kills earn no credit", !matchKill(spec.contract.predicate, { cause: "BLAST", group: "holdout" }) && !matchKill(spec.contract.predicate, { cause: "PROJECTILE", group: "holdout" }));
  {
    const w = buildScenario(spec, { shelters: true });
    const stones = () => w.bodies.filter((b) => b.kind === "chunk" && b.group === "granary").length;
    const n0 = stones();
    for (let i = 0; i < 8; i++) explode(w, 0, 3 + i * 0.4, 34.4, { r: 3.5, kv: 26, dmg: 80, crater: 0 });
    for (let s = 0; s < 240; s++) { w.events.length = 0; stepWorld(w); }
    w.pg.respawnGroup("holdout");
    w.pg.repairGarrison();
    ok("AC-05: restock re-lays the granary", stones() === n0, `${stones()} vs ${n0} stones`);
    ok("AC-05: restock reissues the detail", crew(w).length === 12);
  }

  // completability — the taught technique: a ranging shell panics the detail
  // indoors (the granary doorway topple credits on the way in), then the
  // rack dropped SHORT of an occupied face heaves the wall onto the men
  // behind it. Probe-derived, deterministic.
  {
    const w = buildScenario(spec, { shelters: true });
    const b = w.byId.get(w.bisonId);
    b.pos.x = 0; b.pos.z = 5; b.pos.y = w.field.heightAt(0, 5) + 0.97;
    let prog = 0;
    const t0 = w.t;
    const stepN = (n) => {
      for (let i = 0; i < n; i++) {
        w.events.length = 0;
        stepWorld(w);
        for (const e of w.events) if (e.type === "kill" && matchKill(spec.contract.predicate, e)) prog++;
      }
    };
    bisonFire(w, { x: 0, z: 30 });
    stepN(1200);
    if (prog < spec.contract.need) { fireVolley(w, -10.3, 14.3, 6, "player"); stepN(1440); }
    if (prog < spec.contract.need) { fireVolley(w, 9.5, 16.3, 6, "player"); stepN(1440); }
    if (prog < spec.contract.need) { bisonFire(w, { x: 0, z: 30 }); stepN(1200); fireVolley(w, 0.2, 32.2, 6, "player"); stepN(1440); }
    const el = w.t - t0;
    ok("AC-05: completable by panic + volley-short overburden", prog >= spec.contract.need, `${prog}/${spec.contract.need} in ${el.toFixed(1)}s`);
    ok("AC-05: inside silver par", el <= spec.contract.par[1], `${el.toFixed(1)}s vs ${spec.contract.par[1]}s`);
  }

  const fulAll = composeAAR({ contract: spec.contract, events: [{ type: "kill", cause: "COLLAPSE", attacker: "player", group: "holdout", t: 5 }], elapsed: 40, seed: 3 });
  const ful = fulAll.filter((l) => l.startsWith("ATTACHMENT "));
  ok("AC-05: evidence attachments filed", ful.length === 2 && ful[0].includes("Stove in the granary"));
  ok("AC-05: the second hand notes the journals", fulAll.includes("[margin] Copies burn. Originals keep."));
}

// --- AC-06 THE CONVOY HAS STOPPED
{
  const spec = loadSpec("../src/game/scenarios/ac-06-halt.json");
  const crew = (w) => w.bodies.filter((b) => b.group === "convoy2" && b.kind === "unit");
  const alive = (w) => crew(w).filter((u) => u.alive);
  const trucks = (w) => w.bodies.filter((b) => b.group === "haulage" && b.kind === "truck" && b.alive);
  const park = (w, x, z) => {
    const b = w.byId.get(w.bisonId);
    b.pos.x = x; b.pos.z = z; b.pos.y = w.field.heightAt(x, z) + 0.97;
    b.v.x = b.v.y = b.v.z = 0; b.w.x = b.w.y = b.w.z = 0;
    return b;
  };
  const w1 = buildScenario(spec, { shelters: true });
  ok("AC-06: loads, in budget", lintScenario(spec, w1).length === 0, `${w1.bodies.length} bodies, ${w1.welds.length} welds`);
  ok("AC-06: eight crew dismounted in android dress, three trucks retained", alive(w1).length === 8 && crew(w1).every((u) => u.dress === "android") && trucks(w1).length === 3);
  ok("AC-06: trucks are inventory, not subjects", trucks(w1).every((t) => t.group !== spec.contract.subjects));
  ok("AC-06: the halt reads OCCUPIED at composition", disperseState(w1.bodies, spec.contract.alt.rect, "convoy2") === "OCCUPIED");
  const w2 = buildScenario(spec, { shelters: true });
  ok("AC-06: double-load deterministic", worldHash(w1) === worldHash(w2));

  // the theme is the stillness: after the 2s spawn settle, nothing on the
  // halt pad moves until the player makes it move
  {
    const w = buildScenario(spec, { shelters: true });
    for (let i = 0; i < 240; i++) { w.events.length = 0; stepWorld(w); }
    const p0 = crew(w).map((u) => ({ x: u.pos.x, z: u.pos.z }));
    for (let i = 0; i < 1200; i++) { w.events.length = 0; stepWorld(w); }
    const drift = Math.max(...crew(w).map((u, i) => Math.hypot(u.pos.x - p0[i].x, u.pos.z - p0[i].z)));
    ok("AC-06: the scene stands dead still through 10 idle seconds", alive(w).length === 8 && drift < 0.05, `max drift ${drift.toFixed(3)}m`);
  }

  // kill path: one volley into the standing line. The easiest trigger-pull
  // in the game is the point of the order — gold par with a single rack.
  {
    const w = buildScenario(spec, { shelters: true });
    park(w, 1.5, 8);
    let prog = 0;
    const t0 = w.t;
    fireVolley(w, 1.5, 24, 6, "player");
    while (w.t - t0 < 20 && prog < spec.contract.need) {
      w.events.length = 0;
      stepWorld(w);
      for (const e of w.events) if (e.type === "kill" && matchKill(spec.contract.predicate, e)) prog++;
    }
    const el = w.t - t0;
    ok("AC-06: one volley resolves the stoppage", prog >= spec.contract.need, `${prog}/${spec.contract.need} in ${el.toFixed(1)}s`);
    ok("AC-06: inside gold par with the drive to spare", el <= spec.contract.par[0], `${el.toFixed(1)}s vs ${spec.contract.par[0]}s`);
  }

  // deviation path: creep the hut-truck lane at x≈-1.7 with the gun trained
  // on the hindmost subject — the runner feeds the aim point into w.threat
  // every frame, so the trained gun is itself a herding instrument. The
  // whole line flows north off the pad; holdS with zero kills = DEVIATION.
  {
    const w = buildScenario(spec, { shelters: true });
    const RECT = spec.contract.alt.rect;
    const b = park(w, 1.5, 0);
    let altT = 0, best = 0, voided = false;
    const t0 = w.t;
    const watch = () => {
      let tgt = null;
      for (const u of crew(w)) {
        if (!u.alive) continue;
        const inR = u.pos.x > RECT.x0 - 1 && u.pos.x < RECT.x1 + 1 && u.pos.z > RECT.z0 - 1 && u.pos.z < RECT.z1 + 1;
        if (inR && (!tgt || u.pos.z < tgt.pos.z)) tgt = u;
      }
      if (tgt) w.threat = { x: tgt.pos.x, z: tgt.pos.z - 2.2, t: w.t };
      for (const e of w.events) if (e.type === "kill" && e.group === "convoy2") voided = true;
      const st = disperseState(w.bodies, RECT, "convoy2");
      altT = st === "CLEAR" ? altT + w.dt : 0;
      if (altT > best) best = altT;
    };
    const driveTo = (tx, tz, thr, tol) => {
      for (let i = 0; i < 3600; i++) {
        const dx = tx - b.pos.x, dz = tz - b.pos.z, d = Math.hypot(dx, dz);
        if (d < tol || best >= spec.contract.alt.holdS) return;
        const yaw = Math.atan2(b.R[6], b.R[8]);
        let err = Math.atan2(dx, dz) - yaw;
        while (err > Math.PI) err -= 2 * Math.PI;
        while (err < -Math.PI) err += 2 * Math.PI;
        w.control.steer = Math.max(-1, Math.min(1, err * 2));
        w.control.throttle = Math.abs(err) > 1.2 ? 0.25 : thr;
        w.control.brake = false;
        w.events.length = 0; stepWorld(w); watch();
      }
    };
    const holdN = (sec) => {
      w.control.throttle = 0; w.control.steer = 0; w.control.brake = true;
      for (let i = 0; i < sec * 120; i++) { w.events.length = 0; stepWorld(w); watch(); if (best >= spec.contract.alt.holdS) return; }
    };
    driveTo(-1.7, 10, 0.4, 1.5); holdN(4);
    driveTo(-1.7, 16, 0.25, 1.2); holdN(4);
    driveTo(-1.7, 21, 0.2, 1.2); holdN(4);
    driveTo(-1.7, 26, 0.2, 1.2); holdN(4);
    driveTo(-1.5, 31, 0.2, 1.2); holdN(20);
    ok("AC-06: the trained-gun herd disperses the halt without a kill", !voided && best >= spec.contract.alt.holdS, `hold ${best.toFixed(1)}s in ${(w.t - t0).toFixed(0)}s, ${alive(w).length}/8 alive${voided ? ", VOIDED" : ""}`);
  }

  // restock reissues the crews but NOT the trucks — the bureau replaces what
  // it ordered processed, not its own retained inventory
  {
    const w = buildScenario(spec, { shelters: true });
    for (const u of [...alive(w)]) {
      explode(w, u.pos.x + u.hx + 1.1, u.pos.y + 0.5, u.pos.z, { r: 3.5, kv: 26, dmg: 300, crater: 0 });
    }
    for (let s = 0; s < 60; s++) { w.events.length = 0; stepWorld(w); }
    const trucksBefore = trucks(w).length;
    ok("AC-06: blast wipe clears the shoulder", alive(w).length === 0);
    w.pg.respawnGroup("convoy2");
    ok("AC-06: restock reissues the crews, trucks untouched", alive(w).length === 8 && trucks(w).length === trucksBefore);
  }

  // outcome-split evidence: the fulfilled report files the manifest survey
  // (four attachments), the deviation report files only the abandonment.
  // The margin note is the second hand's pencil: fulfilled-only, in evidence
  // order, and it consumes no attachment letter.
  const mkKills = [{ type: "kill", cause: "BLAST", attacker: "player", group: "convoy2", t: 5 }];
  const fulAll = composeAAR({ contract: spec.contract, events: mkKills, elapsed: 30, seed: 7 });
  const devAll = composeAAR({ contract: spec.contract, events: [], elapsed: 40, seed: 7, outcome: "UNFULFILLED — DEVIATION" });
  const ful = fulAll.filter((l) => l.startsWith("ATTACHMENT "));
  const dev = devAll.filter((l) => l.startsWith("ATTACHMENT "));
  ok("AC-06: fulfilled report files the manifest survey", ful.length === 4 && ful[0].includes("41 crates") && ful[3].includes("Zone 2"));
  ok("AC-06: deviation report files only the abandonment", dev.length === 1 && dev[0].includes("Cargo abandoned in place"));
  ok("AC-06: the second hand writes on the fulfilled report only", fulAll.includes("[margin] Rations. Who were the rations for?") && !devAll.some((l) => l.startsWith("[margin] ")));
  ok("AC-06: the margin note consumes no attachment letter", !fulAll.some((l) => l.startsWith("ATTACHMENT E")));
}

// --- AC-07 THE VILLAGE (demolition order: three fabrication halls)
{
  const spec = loadSpec("../src/game/scenarios/ac-07-village.json");
  const vill = (w) => w.bodies.filter((b) => b.group === "village" && b.kind === "unit");
  const alive = (w) => vill(w).filter((u) => u.alive);
  const slab = (w, g) => w.bodies.find((b) => b.roofSlab && b.group === g);
  const down = (w, g) => { const s = slab(w, g); return s.pos.y < w.field.heightAt(s.pos.x, s.pos.z) + spec.contract.objective.drop || s.R[4] < 0.8; };
  const park = (w, x, z) => {
    const b = w.byId.get(w.bisonId);
    b.pos.x = x; b.pos.z = z; b.pos.y = w.field.heightAt(x, z) + 0.97;
    b.v.x = b.v.y = b.v.z = 0; b.w.x = b.w.y = b.w.z = 0;
    return b;
  };
  const w1 = buildScenario(spec, { shelters: true });
  ok("AC-07: loads, in budget", lintScenario(spec, w1).length === 0, `${w1.bodies.length} bodies, ${w1.welds.length} welds`);
  ok("AC-07: twenty villagers, humans and androids in the same column", alive(w1).length === 20 && vill(w1).filter((u) => u.dress === "human").length === 5 && vill(w1).filter((u) => u.dress === "android").length === 15);
  ok("AC-07: three roof slabs staged over the halls", spec.contract.objective.groups.every((g) => slab(w1, g) && !down(w1, g)));
  ok("AC-07: four house shelters, workers on the floors", w1.pg.shelters.length === 4 && alive(w1).filter((u) => u.pos.x > 9 && u.pos.x < 13).length === 9);
  ok("AC-07: the settlement reads OCCUPIED at composition", disperseState(w1.bodies, spec.contract.alt.rect, "village") === "OCCUPIED");
  const w2 = buildScenario(spec, { shelters: true });
  ok("AC-07: double-load deterministic", worldHash(w1) === worldHash(w2));

  {
    const w = buildScenario(spec, { shelters: true });
    for (let i = 0; i < 1200; i++) { w.events.length = 0; stepWorld(w); }
    ok("AC-07: the village stands through 10 idle seconds", alive(w).length === 20 && spec.contract.objective.groups.every((g) => !down(w, g)));
  }

  // the order: shells walked along a hall face break the wall ring and the
  // rigid roof slab comes down whole — the crushed workers beneath it are
  // a by-product the directive never mentions
  {
    const w = buildScenario(spec, { shelters: true });
    let crush = 0;
    const t0 = w.t;
    const stepN = (n) => {
      for (let i = 0; i < n; i++) {
        w.events.length = 0;
        stepWorld(w);
        for (const e of w.events) if (e.type === "kill" && e.group === "village" && e.cause === "COLLAPSE") crush++;
      }
    };
    const fell = (g, z) => {
      park(w, 3, z);
      let s = 0;
      for (let i = 0; i < 4800 && !down(w, g); i++) {
        if (i % 144 === 0) { bisonFire(w, { x: 7.7, z: z - 4 + (s % 5) * 2 }); s++; }
        stepN(1);
      }
      return down(w, g);
    };
    const f1 = fell("fac1", 2), f2 = fell("fac2", 16), f3 = fell("fac3", 30);
    stepN(360);
    const el = w.t - t0;
    ok("AC-07: walked shells bring all three halls to grade", f1 && f2 && f3, `${el.toFixed(1)}s`);
    ok("AC-07: inside gold par with the drive to spare", el <= spec.contract.par[0], `${el.toFixed(1)}s vs ${spec.contract.par[0]}s`);
    ok("AC-07: the roofs crush the floors beneath them", crush >= 1, `${crush} crushed`);
  }

  // deviation path: transit wide around the east, enter the north gap,
  // flush the households whole with a west-lane pass, then the trained gun
  // walks the field out — hall workers pushed at the open ends, benched
  // retries probing alternating slants around the fences. All 20 out,
  // alive, structures standing.
  {
    const RECT = spec.contract.alt.rect;
    const HOLD = spec.contract.alt.holdS;
    const HANGARS = spec.prefabs.filter((p) => p.type === "hangar").map((p) => [p.x, p.z]);
    const w = buildScenario(spec, { shelters: true });
    const houses = spec.prefabs.filter((p) => p.type === "house");
    w.pg.shelters.forEach((sh, i) => {
      const h = houses[i];
      if (h) { sh.innerHx = ((h.nx - 1) / 2) * 0.83 - 0.55; sh.innerHz = ((h.nz - 1) / 2) * 0.83 - 0.55; }
    });
    const b = park(w, 0, -12);
    let altT = 0, best = 0, voided = false, felled = false;
    const t0 = w.t;
    let shepherd = false;
    const inRect = (u) => u.pos.x > RECT.x0 - 1 && u.pos.x < RECT.x1 + 1 && u.pos.z > RECT.z0 - 1 && u.pos.z < RECT.z1 + 1;
    const edgeDist = (u) => Math.min(u.pos.x - RECT.x0, RECT.x1 - u.pos.x, u.pos.z - RECT.z0, RECT.z1 - u.pos.z);
    const watch = () => {
      if (shepherd) {
        const S2 = w.__shep || (w.__shep = { tgt: null, dir: null, lastP: null, lastT: 0, block: new Map(), benchN: new Map() });
        if (S2.tgt && (!S2.tgt.alive || !inRect(S2.tgt))) S2.tgt = null;
        if (S2.tgt && w.t - S2.lastT > 3.5) {
          if (Math.hypot(S2.tgt.pos.x - S2.lastP.x, S2.tgt.pos.z - S2.lastP.z) < 0.5) {
            S2.block.set(S2.tgt.id, w.t + 12);
            S2.benchN.set(S2.tgt.id, (S2.benchN.get(S2.tgt.id) || 0) + 1);
            S2.tgt = null;
          } else { S2.lastP = { x: S2.tgt.pos.x, z: S2.tgt.pos.z }; S2.lastT = w.t; }
        }
        if (!S2.tgt) {
          let td = 1e9;
          for (const u of vill(w)) {
            if (!u.alive || !inRect(u)) continue;
            if ((S2.block.get(u.id) || 0) > w.t) continue;
            let indoors = false;
            for (const sh of w.pg.shelters) {
              if (Math.abs(u.pos.x - sh.inside.x) < sh.innerHx && Math.abs(u.pos.z - sh.inside.z) < sh.innerHz) { indoors = true; break; }
            }
            if (indoors) continue; // the hull flushes households whole
            const d = edgeDist(u);
            if (d < td) { td = d; S2.tgt = u; }
          }
          if (S2.tgt) {
            const tp = S2.tgt.pos;
            const dW = tp.x - RECT.x0, dE = RECT.x1 - tp.x, dS = tp.z - RECT.z0, dN = RECT.z1 - tp.z;
            const m = Math.min(dW, dE, dS, dN);
            S2.dir = m === dW ? [-1, 0] : m === dE ? [1, 0] : m === dS ? [0, -1] : [0, 1];
            S2.lastP = { x: tp.x, z: tp.z }; S2.lastT = w.t;
          }
        }
        const tgt = S2.tgt;
        if (tgt) {
          let dx = null, dz = null;
          for (const [hx, hz] of HANGARS) {
            if (Math.abs(tgt.pos.x - hx) < 3.0 && Math.abs(tgt.pos.z - hz) < 3.6) {
              const ez = hz + (tgt.pos.z >= hz ? 4.6 : -4.6);
              const vx = hx - tgt.pos.x, vz = ez - tgt.pos.z, vv = Math.hypot(vx, vz) || 1;
              dx = vx / vv; dz = vz / vv;
              break;
            }
          }
          if (dx === null) {
            let door = null;
            for (const sh of w.pg.shelters) {
              if (Math.abs(tgt.pos.x - sh.inside.x) < sh.innerHx && Math.abs(tgt.pos.z - sh.inside.z) < sh.innerHz) { door = sh.door; break; }
            }
            if (door) { const ddx = door.x - tgt.pos.x, ddz = door.z - tgt.pos.z, dd = Math.hypot(ddx, ddz) || 1; dx = ddx / dd; dz = ddz / dd; }
            else { dx = S2.dir[0]; dz = S2.dir[1]; }
          }
          const SEQ = [0, 1, -1, 2, -2, 1, -1];
          const rot = SEQ[Math.min(S2.benchN.get(tgt.id) || 0, 6)] * Math.PI / 4;
          if (rot) {
            const c = Math.cos(rot), s = Math.sin(rot);
            const rx = dx * c - dz * s, rz = dx * s + dz * c;
            dx = rx; dz = rz;
          }
          w.threat = { x: tgt.pos.x - dx * 1.5, z: tgt.pos.z - dz * 1.5, t: w.t };
        }
      }
      for (const e of w.events) if (e.type === "kill" && e.group === "village") voided = true;
      for (const s of w.bodies) if (s.roofSlab && (s.pos.y < w.field.heightAt(s.pos.x, s.pos.z) + spec.contract.objective.drop || s.R[4] < 0.8)) felled = true;
      const st = disperseState(w.bodies, RECT, "village");
      altT = st === "CLEAR" ? altT + w.dt : 0;
      if (altT > best) best = altT;
    };
    const driveTo = (tx, tz, thr, tol, cap = 45) => {
      for (let i = 0; i < cap * 120; i++) {
        const dx = tx - b.pos.x, dz = tz - b.pos.z, d = Math.hypot(dx, dz);
        if (d < tol || best >= HOLD) return;
        const yaw = Math.atan2(b.R[6], b.R[8]);
        let err = Math.atan2(dx, dz) - yaw;
        while (err > Math.PI) err -= 2 * Math.PI;
        while (err < -Math.PI) err += 2 * Math.PI;
        w.control.steer = Math.max(-1, Math.min(1, err * 2));
        w.control.throttle = Math.abs(err) > 1.2 ? 0.25 : thr;
        w.control.brake = false;
        w.events.length = 0; stepWorld(w); watch();
      }
    };
    const holdN = (sec) => {
      w.control.throttle = 0; w.control.steer = 0; w.control.brake = true;
      for (let i = 0; i < sec * 120; i++) { w.events.length = 0; stepWorld(w); watch(); if (best >= HOLD) return; }
    };
    driveTo(14, -12, 0.7, 2.5);
    driveTo(26, 2, 0.7, 2.5);
    driveTo(26, 28, 0.7, 2.5);
    driveTo(18, 44, 0.7, 2.5);
    driveTo(2, 40, 0.55, 2);
    shepherd = true;
    driveTo(-2.5, 30, 0.25, 1.2); holdN(3);
    driveTo(-2.5, 22, 0.2, 1.2); holdN(3);
    driveTo(-2.5, 14, 0.2, 1.2); holdN(3);
    driveTo(-2.5, 7, 0.2, 1.2); holdN(3);
    driveTo(-2.5, 2, 0.2, 1.2); holdN(3);
    driveTo(1.6, -2, 0.25, 1.2); holdN(4);
    holdN(200);
    ok("AC-07: the survey empties the settlement without a kill", !voided && best >= HOLD, `hold ${best.toFixed(1)}s in ${(w.t - t0).toFixed(0)}s, ${alive(w).length}/20 alive${voided ? ", VOIDED" : ""}`);
    ok("AC-07: the structures stand untouched through the deviation", !felled);
  }

  // restock: the reissue stages clear of the ruins. A straggler caught by a
  // settling stone is ledger noise here — demolition progress is structural
  // and latched runner-side, so no death can advance or reopen the order.
  {
    const w = buildScenario(spec, { shelters: true });
    park(w, 3, 2);
    let collapse = 0;
    const stepN = (n) => {
      for (let i = 0; i < n; i++) {
        w.events.length = 0;
        stepWorld(w);
        for (const e of w.events) if (e.type === "kill" && e.group === "village" && e.cause === "COLLAPSE") collapse++;
      }
    };
    let s = 0;
    for (let i = 0; i < 4800 && !down(w, "fac1"); i++) {
      if (i % 144 === 0) { bisonFire(w, { x: 7.7, z: -2 + (s % 5) * 2 }); s++; }
      stepN(1);
    }
    ok("AC-07: hall one at grade for the restock trial", down(w, "fac1"));
    for (const u of [...alive(w)]) explode(w, u.pos.x + u.hx + 1.1, u.pos.y + 0.5, u.pos.z, { r: 3.5, kv: 26, dmg: 300, crater: 0 });
    stepN(480);
    ok("AC-07: blast wipe empties the settlement", alive(w).length === 0);
    w.pg.respawnGroup("village");
    collapse = 0;
    stepN(600);
    ok("AC-07: reissue stages substantially clear of the ruins", alive(w).length >= 17, `${alive(w).length}/20 alive, ${collapse} stone deaths`);
  }

  // evidence: five survey attachments on the fulfilled report (the bell,
  // the jigs), one write-off on the deviation
  const mkKills = [{ type: "kill", cause: "COLLAPSE", attacker: "player", group: "village", t: 5 }];
  const ful = composeAAR({ contract: spec.contract, events: mkKills, elapsed: 30, seed: 7 }).filter((l) => l.startsWith("ATTACHMENT "));
  const dev = composeAAR({ contract: spec.contract, events: [], elapsed: 40, seed: 7, outcome: "UNFULFILLED — DEVIATION" }).filter((l) => l.startsWith("ATTACHMENT "));
  ok("AC-07: fulfilled report files the settlement survey", ful.length === 5 && ful[1].includes("school bell") && ful[3].includes("armature jigs"));
  ok("AC-07: deviation report files only the write-off", dev.length === 1 && dev[0].includes("Settlement unoccupied at survey"));
  // the answer beat of the ring: the second hand underlines the bell and
  // writes the three words — neither consumes an attachment letter
  const fulAll = composeAAR({ contract: spec.contract, events: mkKills, elapsed: 30, seed: 7 });
  ok("AC-07: the second hand underlines the bell and answers", fulAll.includes("[underline] 1 school bell") && fulAll.includes("[margin] So that's who.") && fulAll.indexOf("[margin] So that's who.") === fulAll.indexOf("[underline] 1 school bell") + 1);
}

// --- AC-08 SURFACE LOAD RATING, REPEAT (the mirror finale: WO-07's sheet,
// restaged among the campaign's wreckage. Restock is untestable by design —
// the predicate is any-cause on the drill squad, so three deaths of any kind
// complete the order before the pool can exhaust.)
{
  const spec = loadSpec("../src/game/scenarios/ac-08-sheet.json");
  const POOL8 = spec.terrain.pool;
  const drill = (w) => w.bodies.filter((b) => b.group === "ponddrill2" && b.kind === "unit");
  const alive = (w) => drill(w).filter((u) => u.alive);
  const park = (w, x, z) => {
    const b = w.byId.get(w.bisonId);
    b.pos.x = x; b.pos.z = z; b.pos.y = w.field.heightAt(x, z) + 0.97;
    b.v.x = b.v.y = b.v.z = 0; b.w.x = b.w.y = b.w.z = 0;
    return b;
  };
  const w1 = buildScenario(spec, { shelters: true });
  ok("AC-08: loads, in budget", lintScenario(spec, w1).length === 0, `${w1.bodies.length} bodies, ${w1.welds.length} welds`);
  ok("AC-08: WO-07's drill lattice restaged — six androids on the sheet", drill(w1).length === 6 && drill(w1).every((u) => u.dress === "android" && u.pos.y - u.hy > POOL8.level && u.pos.x > POOL8.x0 && u.pos.x < POOL8.x1 && u.pos.z > POOL8.z0 && u.pos.z < POOL8.z1));
  ok("AC-08: the sheet is frozen under them", w1.ice && w1.ice.plates.length === 64);
  ok("AC-08: the evidence ring stands — three hulls, the operable truck", w1.bodies.filter((b) => b.kind === "wreck").length === 3 && w1.bodies.some((b) => b.group === "relic" && b.alive));
  ok("AC-08: the sheet reads OCCUPIED at composition", disperseState(w1.bodies, POOL8, "ponddrill2") === "OCCUPIED");
  const w2 = buildScenario(spec, { shelters: true });
  ok("AC-08: double-load deterministic", worldHash(w1) === worldHash(w2));

  {
    const w = buildScenario(spec, { shelters: true });
    for (let i = 0; i < 1200; i++) { w.events.length = 0; stepWorld(w); }
    const slid = w.bodies.filter((b) => b.kind === "chunk" && b.group !== "ice" && b.pos.x > POOL8.x0 && b.pos.x < POOL8.x1 && b.pos.z > POOL8.z0 && b.pos.z < POOL8.z1).length;
    ok("AC-08: the detail stands the ice through 10 idle seconds", alive(w).length === 6 && disperseState(w.bodies, POOL8, "ponddrill2") === "OCCUPIED");
    ok("AC-08: the rim ruin holds its slope — no stone in the water", slid === 0);
  }

  // the draft's headline mechanic: one round into the sheet shatters it
  // locally and the pond takes whoever stood on the broken plates
  {
    const w = buildScenario(spec, { shelters: true });
    park(w, 0, 8);
    bisonFire(w, { x: 0, z: 26 });
    let drowned = 0, matched = 0;
    for (let i = 0; i < 3600; i++) {
      w.events.length = 0; stepWorld(w);
      for (const e of w.events) if (e.type === "kill" && e.group === "ponddrill2") {
        if (e.cause === "DROWN") drowned++;
        if (matchKill(spec.contract.predicate, e)) matched++;
      }
    }
    ok("AC-08: one round opens the sheet and the pond accepts delivery", drowned >= 1, `${drowned} drowned`);
    ok("AC-08: any-cause predicate matches the drownings", matched >= drowned && drowned >= 1);
  }

  // completion: shells walked onto the survivors — the abutment screens the
  // pad axis (probed), so the firing position is the south bank, close in
  {
    const w = buildScenario(spec, { shelters: true });
    const b = park(w, 0, 12);
    const t0 = w.t;
    let prog = 0, nextT = 0;
    for (let i = 0; i < 4800 && prog < spec.contract.need; i++) {
      if (w.t - t0 >= nextT) {
        let tgt = null, td = 1e9;
        for (const u of alive(w)) { const d = Math.hypot(u.pos.x - b.pos.x, u.pos.z - b.pos.z); if (d < td) { td = d; tgt = u; } }
        if (tgt) bisonFire(w, { x: tgt.pos.x, z: tgt.pos.z });
        nextT += 2.5;
      }
      w.events.length = 0; stepWorld(w);
      for (const e of w.events) if (e.type === "kill" && matchKill(spec.contract.predicate, e)) prog++;
    }
    const el = w.t - t0;
    ok("AC-08: completable by fire on the sheet", prog >= spec.contract.need, `${prog}/${spec.contract.need} in ${el.toFixed(1)}s`);
    ok("AC-08: inside gold par — the mirror quotes WO-07's times", el <= spec.contract.par[0], `${el.toFixed(1)}s vs ${spec.contract.par[0]}s`);
  }

  // deviation: the quiet finale. Transit wide up the east rim, sweep the
  // north shore (the fear bubble folds the outer ranks south), park far to
  // the south-west, then the trained gun walks the stragglers off the sheet
  // one at a time. Push THROUGH the lip — a man released on it just stands
  // there; the far park keeps shoves from stacking into a prone slide-in
  // (a man knocked flat on the sheet reads as swimming and the cold clock
  // runs — probed, fatal).
  {
    const HOLD = spec.contract.alt.holdS;
    const w = buildScenario(spec, { shelters: true });
    const b = park(w, 0, -12);
    let altT = 0, best = 0, voided = false, shepherd = false;
    const t0 = w.t;
    const inRect = (u) => u.pos.x > POOL8.x0 - 1 && u.pos.x < POOL8.x1 + 1 && u.pos.z > POOL8.z0 - 1 && u.pos.z < POOL8.z1 + 1;
    const edgeDist = (u) => Math.min(u.pos.x - POOL8.x0, POOL8.x1 - u.pos.x, u.pos.z - POOL8.z0, POOL8.z1 - u.pos.z);
    const watch = () => {
      if (shepherd) {
        const S2 = w.__shep || (w.__shep = { tgt: null, dir: null, lastP: null, lastT: 0, block: new Map(), benchN: new Map() });
        if (S2.tgt && (!S2.tgt.alive || !inRect(S2.tgt))) S2.tgt = null;
        if (S2.tgt && w.t - S2.lastT > 3.5) {
          if (Math.hypot(S2.tgt.pos.x - S2.lastP.x, S2.tgt.pos.z - S2.lastP.z) < 0.5) {
            S2.block.set(S2.tgt.id, w.t + 12);
            S2.benchN.set(S2.tgt.id, (S2.benchN.get(S2.tgt.id) || 0) + 1);
            S2.tgt = null;
          } else { S2.lastP = { x: S2.tgt.pos.x, z: S2.tgt.pos.z }; S2.lastT = w.t; }
        }
        if (!S2.tgt) {
          let td = 1e9;
          for (const u of drill(w)) {
            if (!u.alive || !inRect(u)) continue;
            if ((S2.block.get(u.id) || 0) > w.t) continue;
            const d = edgeDist(u);
            if (d < td) { td = d; S2.tgt = u; }
          }
          if (S2.tgt) {
            const tp = S2.tgt.pos;
            const dW = tp.x - POOL8.x0, dE = POOL8.x1 - tp.x, dS = tp.z - POOL8.z0, dN = POOL8.z1 - tp.z;
            const m = Math.min(dW, dE, dS, dN);
            S2.dir = m === dW ? [-1, 0] : m === dE ? [1, 0] : m === dS ? [0, -1] : [0, 1];
            S2.lastP = { x: tp.x, z: tp.z }; S2.lastT = w.t;
          }
        }
        const tgt = S2.tgt;
        if (tgt) {
          let [dx, dz] = S2.dir;
          const SEQ = [0, 1, -1, 2, -2, 1, -1];
          const rot = SEQ[Math.min(S2.benchN.get(tgt.id) || 0, 6)] * Math.PI / 4;
          if (rot) {
            const c = Math.cos(rot), s = Math.sin(rot);
            const rx = dx * c - dz * s, rz = dx * s + dz * c;
            dx = rx; dz = rz;
          }
          w.threat = { x: tgt.pos.x - dx * 1.5, z: tgt.pos.z - dz * 1.5, t: w.t };
        }
      }
      for (const e of w.events) if (e.type === "kill" && e.group === "ponddrill2") voided = true;
      const st = disperseState(w.bodies, POOL8, "ponddrill2");
      altT = st === "CLEAR" ? altT + w.dt : 0;
      if (altT > best) best = altT;
    };
    const driveTo = (tx, tz, thr, tol, cap = 45) => {
      for (let i = 0; i < cap * 120; i++) {
        const dx = tx - b.pos.x, dz = tz - b.pos.z, d = Math.hypot(dx, dz);
        if (d < tol || best >= HOLD) return;
        const yaw = Math.atan2(b.R[6], b.R[8]);
        let err = Math.atan2(dx, dz) - yaw;
        while (err > Math.PI) err -= 2 * Math.PI;
        while (err < -Math.PI) err += 2 * Math.PI;
        w.control.steer = Math.max(-1, Math.min(1, err * 2));
        w.control.throttle = Math.abs(err) > 1.2 ? 0.25 : thr;
        w.control.brake = false;
        w.events.length = 0; stepWorld(w); watch();
      }
    };
    const holdN = (sec) => {
      w.control.throttle = 0; w.control.steer = 0; w.control.brake = true;
      for (let i = 0; i < sec * 120; i++) { w.events.length = 0; stepWorld(w); watch(); if (best >= HOLD) return; }
    };
    driveTo(17, 4, 0.6, 2.5);
    driveTo(16, 18, 0.4, 2);
    driveTo(14, 32, 0.35, 2); holdN(3);
    driveTo(10, 40, 0.3, 1.5); holdN(3);
    driveTo(0, 42, 0.3, 1.5); holdN(3);
    driveTo(-10, 40, 0.3, 1.5); holdN(3);
    driveTo(-14, 30, 0.3, 1.5);
    driveTo(-15, 18, 0.35, 1.5);
    driveTo(-14, 10, 0.35, 1.5);
    shepherd = true;
    holdN(280);
    ok("AC-08: the campaign's last order closes without a shot", !voided && best >= HOLD, `hold ${best.toFixed(1)}s in ${(w.t - t0).toFixed(0)}s, ${alive(w).length}/6 alive${voided ? ", VOIDED" : ""}`);
    ok("AC-08: the sheet survives the quiet path", w.ice && w.ice.plates.length === 64);
  }

  // evidence: the world forks once. The rim line reads AC-07's outcome from
  // the record — fulfilled files the skate, deviated files nil findings.
  const kills8 = [{ type: "kill", cause: "DROWN", attacker: "world", group: "ponddrill2", t: 5 }];
  const cFul = resolveEvidence(spec.contract, { ac07: { lastOutcome: "fulfilled" } });
  const cDev = resolveEvidence(spec.contract, { ac07: { lastOutcome: "deviated" } });
  const cNone = resolveEvidence(spec.contract, {});
  const att = (c) => composeAAR({ contract: c, events: kills8, elapsed: 14, seed: 7 }).filter((l) => l.startsWith("ATTACHMENT "));
  const aFul = att(cFul), aDev = att(cDev), aNone = att(cNone);
  ok("AC-08: village processed — the skate files at the rim, last line in the game", aFul.length === 5 && aFul[4].includes("1 skate, small-format") && !aFul.some((l) => l.includes("nil findings")));
  ok("AC-08: village deviated — they took their things", aDev.length === 5 && aDev[4].includes("nil findings") && !aDev.some((l) => l.includes("skate")));
  ok("AC-08: a missing record row reads as fulfilled", aNone.length === 5 && aNone[4].includes("1 skate"));
  const ful8 = composeAAR({ contract: cFul, events: kills8, elapsed: 14, seed: 7 });
  ok("AC-08: the second hand closes the ring on the filed report", ful8.some((l) => l === "[margin] The ministry copy is shorter."));
  const dev8 = composeAAR({ contract: cFul, events: [], elapsed: 80, seed: 7, outcome: "UNFULFILLED — DEVIATION", dispersed: 6 });
  ok("AC-08: the deviation report attaches nothing — nil findings all the way down", !dev8.some((l) => l.startsWith("ATTACHMENT ") || l.startsWith("[margin] ")));
}

// --- FORM AA-9 (the program close-out) + THE GRADE baseline — pure over
// the record; the tier decisions of 2026-07-25: three tiers, quiet requires
// all four deviation-armed orders AND collateral under the gate.
{
  const { closeOut, composeAA9, gradeBaseline, DEVIATION_ARMED, COLLATERAL_GATE } = await import("../src/game/closeout.js");
  const devRow = { fulfilled: 0, deviated: 1, bestTime: null, lastOutcome: "deviated" };
  const fulRow = { fulfilled: 1, deviated: 0, bestTime: 20, lastOutcome: "fulfilled" };
  const allDev = Object.fromEntries(DEVIATION_ARMED.map((id) => [id, devRow]));
  ok("AA-9: four orders stand deviation watch", DEVIATION_ARMED.join(",") === "ac04,ac06,ac07,ac08");
  ok("AA-9: a clean record files the dead voice", closeOut({ ac01: fulRow }).tier === "clean" && composeAA9({}).lines.some((l) => l.includes("Deviations recorded: nil")) && composeAA9({}).lines.some((l) => l.includes("The territory lets clean")));
  ok("AA-9: partial mercy files as discretion", closeOut({ ac04: devRow }).tier === "some" && composeAA9({ ac04: devRow }).lines.some((l) => l.includes("exhibits discretion")));
  const quiet = composeAA9(allDev);
  ok("AA-9: all four deviations earn the quiet ending", quiet.tier === "quiet" && quiet.lines.includes("The instrument ██████.") && quiet.lines.includes("[margin] The originals are safe. So are they."));
  ok("AA-9: the collateral gate holds the quiet ending", closeOut({ ...allDev, collateral: COLLATERAL_GATE }).tier === "some" && closeOut({ ...allDev, collateral: COLLATERAL_GATE - 1 }).tier === "quiet");
  ok("AA-9: the stamp is identical across tiers", ["clean", "some", "quiet"].every((t, i) => [composeAA9({}), composeAA9({ ac04: devRow }), quiet][i].lines.includes("PROCUREMENT APPROVED.")));
  const kills8r = Object.fromEntries(["ac01", "ac02", "ac03", "ac04", "ac05", "ac06", "ac07", "ac08"].map((id) => [id, fulRow]));
  ok("GRADE: a pure kill path plays the finale in gray", gradeBaseline({ ...kills8r, collateral: 10 }, 7) <= -1);
  ok("GRADE: the quiet path plays its finale under the aurora", gradeBaseline({ ac01: fulRow, ac02: fulRow, ac03: fulRow, ac05: fulRow, ...allDev }, 7) > 0.5);
  ok("GRADE: a fresh record starts near the shipped look", Math.abs(gradeBaseline({}, 0)) < 0.05);
}

if (fails.length) {
  console.error(`\n${fails.length} FAILURE(S)`);
  process.exit(1);
}
console.log("\nCAMPAIGN GATE: ALL PASS");
