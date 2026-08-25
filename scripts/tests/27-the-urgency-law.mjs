// COLDSNAP suite era 27 — THE URGENCY LAW (mk2.51). A man in weapon range
// outranks masonry at FULL range, both sides — the enemy's 60% radius is
// dead (probe-measured: it refused 62% of in-range shots at player men).
// No seed is special; fixture seeds are named below.
import { ok } from "./harness.mjs";
import { readFileSync } from "node:fs";
import { makeWorld, stepWorld, addBody } from "../../src/engine/core.js";
import { spawnUnit, stepUnits } from "../../src/depot/units.js";
import { stepDrivers } from "../../src/depot/drivers.js";
import { identFwdDir, straightGrid } from "./shared.mjs";

const src = (p) => readFileSync(new URL("../../" + p, import.meta.url), "utf8");

ok("U1: the urgency radius is the whole effective range",
  /const URGENCY = 1;/.test(src("src/depot/units.js")) && !/const URGENCY = 0\.6;/.test(src("src/depot/units.js")));

// U2 — behavior: a held enemy rifleman engages a player man at 11m — inside
// his 13m rifle range, OUTSIDE the old 7.8m radius that silenced him.
// (07-armor-demolition's own T3(e) fixture shape, the man moved out to 11m.)
{
  const flatF = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (x, z, o) => { o.x = 0; o.y = 1; o.z = 0; return o; } };
  const w = makeWorld({ field: flatF, seed: 271 }); w.depotCombat = true;
  const g = spawnUnit(w, { x: 0, z: 0 }, "");
  g.hold = true; g.garrison = true;
  addBody(w, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x: g.pos.x, y: 0.74, z: g.pos.z + 11, hp: 5000 });
  for (let i = 0; i < 2400; i++) { stepUnits(w, straightGrid(0, 1), identFwdDir, null); stepWorld(w); }
  ok("U2: a rifleman works his rifle at 11m (seed 271) — the old radius left him silent",
    w.events.filter((ev) => ev.type === "muzzle").length > 0);
}

// ---- mk2.52: THE ONE TARGET LAW — the enemy's soft-target set is the
// player's own: men, hulls, and mechs, preferred at full range.
ok("U5: the soft-target set is shared law in units.js",
  /const soft = \(b\) => b\.kind === "unit" \|\| b\.kind === "vehicle" \|\| b\.kind === "mech";/.test(src("src/depot/units.js")));
ok("U5b: the wave tank runs the armor scan first",
  /armorScanFoes\(world, t, muzzle, fspec, false, T, toUV\)/.test(src("src/depot/drivers.js")));

// U6 — behavior: a held enemy rifleman engages a player HULL at 10m.
{
  const flatF = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (x, z, o) => { o.x = 0; o.y = 1; o.z = 0; return o; } };
  const w = makeWorld({ field: flatF, seed: 272 }); w.depotCombat = true;
  const g = spawnUnit(w, { x: 0, z: 0 }, "");
  g.hold = true; g.garrison = true;
  addBody(w, { kind: "vehicle", team: 1, mass: 2600, hx: 1.6, hy: 1.0, hz: 3.0, x: 0, y: 1.05, z: 10, hp: 50000 });
  for (let i = 0; i < 2400; i++) { stepUnits(w, straightGrid(0, 1), identFwdDir, null); stepWorld(w); }
  ok("U6: a rifleman engages a player hull at 10m (seed 272) — hulls were invisible to him",
    w.events.filter((ev) => ev.type === "muzzle").length > 0);
}

// U7 — behavior: the wave tank fires on a player man (structures absent).
{
  const flatF = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (x, z, o) => { o.x = 0; o.y = 1; o.z = 0; return o; } };
  const w = makeWorld({ field: flatF, seed: 273 }); w.depotCombat = true;
  spawnUnit(w, { x: 0, z: -15 }, "tank");
  addBody(w, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x: 0, y: 0.74, z: 10, hp: 50000 });
  for (let i = 0; i < 1200; i++) { stepDrivers(w, straightGrid(0, 0), identFwdDir, null); stepUnits(w, straightGrid(0, 0), identFwdDir, null); stepWorld(w); }
  ok("U7: the wave tank fires on a player man (seed 273) — its gun knew only masonry",
    w.events.filter((ev) => ev.type === "boom").length > 0);
}
