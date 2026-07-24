// Deviation detector gate — the buildout plan's T4: disperseState against the
// REAL thin_ice setup (freeze the pool, spawn the drill squad on the sheet).
import { disperseState } from "../src/game/altcheck.js";
import { buildProvingGrounds, freezePool, thawPool, addBody, POOL } from "../src/engine/core.js";

const fails = [];
const ok = (name, cond) => {
  console.log(`${cond ? "PASS" : "FAIL"} — ${name}`);
  if (!cond) fails.push(name);
};

// replicate the thin_ice trial setup verbatim
const w = buildProvingGrounds(1234);
for (let i = w.bodies.length - 1; i >= 0; i--) if (w.bodies[i].group === "ponddrill") { w.byId.delete(w.bodies[i].id); w.bodies.splice(i, 1); }
freezePool(w);
for (let i = 0; i < 6; i++) {
  const x = -3 + (i % 3) * 3, z = 25 + Math.floor(i / 3) * 5;
  addBody(w, { kind: "unit", team: 2, group: "ponddrill", mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x, z, y: 1.132 + 0.88, hp: 30, friction: 0.55 });
}
const squad = w.bodies.filter((b) => b.group === "ponddrill");

ok("six subjects spawn on the sheet", squad.length === 6);
ok("spawn state reads OCCUPIED", disperseState(w.bodies, POOL, "ponddrill") === "OCCUPIED");

// a man on the dry apron (inside margin) still counts as on the sheet
squad.forEach((b) => { b.pos.x = 20; b.pos.z = 28; });
squad[0].pos.x = POOL.x1 + 0.5; // 8.5: within the 1m margin
ok("margin keeps the apron legal (still OCCUPIED)", disperseState(w.bodies, POOL, "ponddrill") === "OCCUPIED");
squad[0].pos.x = POOL.x1 + 1.5; // 9.5: past the margin
ok("all clear of rect+margin reads CLEAR", disperseState(w.bodies, POOL, "ponddrill") === "CLEAR");

// one death voids the deviation permanently for the attempt
squad[2].alive = false;
ok("one dead subject reads VOID", disperseState(w.bodies, POOL, "ponddrill") === "VOID");
squad[2].alive = true;

// no subjects at all reads VOID (kill path finished them)
for (const b of squad) b.alive = false;
ok("all dead reads VOID", disperseState(w.bodies, POOL, "ponddrill") === "VOID");

thawPool(w);

if (fails.length) {
  console.error(`\n${fails.length} FAILURE(S)`);
  process.exit(1);
}
console.log("\nDEVIATION GATE: ALL PASS");
