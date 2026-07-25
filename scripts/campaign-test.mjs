// Campaign content gate. Every campaign scenario must: stay in budget,
// double-load deterministically, be completable with the intended tactic,
// and recover from a wrong-cause wipe via pg.respawnGroup (the runner's
// restock). Missions are added here one at a time as they are built.
import { readFileSync } from "node:fs";
import { stepWorld, bisonFire, fireVolley, explode, worldHash } from "../src/engine/core.js";
import { buildScenario, lintScenario } from "../src/game/scenario.js";
import { matchKill } from "../src/game/predicate.js";
import { composeAAR } from "../src/aar/compose.js";
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

  const ful = composeAAR({ contract: spec.contract, events: [{ type: "kill", cause: "COLLAPSE", attacker: "player", group: "holdout", t: 5 }], elapsed: 40, seed: 3 }).filter((l) => l.startsWith("ATTACHMENT "));
  ok("AC-05: evidence attachments filed", ful.length === 2 && ful[0].includes("Stove in the granary"));
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
  // (four attachments), the deviation report files only the abandonment
  const mkKills = [{ type: "kill", cause: "BLAST", attacker: "player", group: "convoy2", t: 5 }];
  const ful = composeAAR({ contract: spec.contract, events: mkKills, elapsed: 30, seed: 7 }).filter((l) => l.startsWith("ATTACHMENT "));
  const dev = composeAAR({ contract: spec.contract, events: [], elapsed: 40, seed: 7, outcome: "UNFULFILLED — DEVIATION" }).filter((l) => l.startsWith("ATTACHMENT "));
  ok("AC-06: fulfilled report files the manifest survey", ful.length === 4 && ful[0].includes("41 crates") && ful[3].includes("Zone 2"));
  ok("AC-06: deviation report files only the abandonment", dev.length === 1 && dev[0].includes("Cargo abandoned in place"));
}

if (fails.length) {
  console.error(`\n${fails.length} FAILURE(S)`);
  process.exit(1);
}
console.log("\nCAMPAIGN GATE: ALL PASS");
