// COLDSNAP suite era 24 — THE QUARTERMASTER'S CRATES (mk2.27-mk2.30).
// mk2.27: the names — towers wear proper nouns, the colliding trades
// re-sign, and no two labels on the stock list read the same. No seed is
// special; no seed is used.
import { ok } from "./harness.mjs";
import { readFileSync } from "node:fs";
import { TOWER_SPECS, ENEMY_SPECS } from "../../src/depot/specs.js";
import { SQUAD_SPECS } from "../../src/depot/squads.js";

const src = (p) => readFileSync(new URL("../../" + p, import.meta.url), "utf8");
const dg = src("src/depot/DepotGame.jsx");

ok("names: the five towers wear proper nouns",
  TOWER_SPECS.mg.label === "SPITTER" && TOWER_SPECS.gun.label === "FIELD GUN" &&
  TOWER_SPECS.mortar.label === "MORTAR" && TOWER_SPECS.rocket.label === "SALVO RACK" &&
  TOWER_SPECS.tesla.label === "TESLA COIL");
ok("names: the colliding trades re-sign", SQUAD_SPECS.mg.label === "GUNNERS" && SQUAD_SPECS.sniper.label === "MARKSMEN");
ok("names: his mg men match the trade", ENEMY_SPECS.mg.label === "gunners");
ok("names: the bar follows the trades",
  dg.includes('key: "sq_mg", label: "GUNNERS"') && dg.includes('key: "sq_sniper", label: "MARKSMEN"') &&
  dg.includes('key: "sq_rockets", label: "ROCKET TEAM"'));
ok("names: the enemy rack follows",
  dg.includes('key: "foe_t_mg", label: "SPITTER"') && dg.includes('key: "foe_t_rocket", label: "SALVO RACK"') &&
  dg.includes('key: "foe_mg", label: "GUNNERS"') && dg.includes('key: "foe_rocket", label: "ROCKET TEAM"'));
{
  const all = [...Object.values(TOWER_SPECS).map((s) => s.label), ...Object.values(SQUAD_SPECS).map((s) => s.label)];
  ok("names: no two labels on the stock list collide", new Set(all).size === all.length, all.join("|"));
}

{ // mk2.28: the crate desk — wiring pins (the component cannot run headless)
  const dg2 = src("src/depot/DepotGame.jsx");
  const cr = src("src/depot/Crate.jsx");
  ok("crates: the crate file exists and draws a hinged lid", cr.includes("CrateChip") && cr.includes("transformOrigin"));
  ok("crates: the deal keyframe replaced the unfurl", dg2.includes("cs-deal") && !dg2.includes("cs-unfurl"));
  ok("crates: the deal never pins its final frame", !dg2.match(/cs-deal[^"]*both/));
  ok("crates: the branches are crates", dg2.includes("<CrateChip") && dg2.includes('import CrateChip'));
  ok("crates: the bar's doors survived", dg2.includes("data-build-toggle") && dg2.includes("data-sell-toggle") && dg2.includes("data-tower-key") && dg2.includes("data-foe-key") && dg2.includes("data-dev-reroll"));
  ok("crates: the quartermaster lines exist and go quiet", dg2.includes("QM_KEY") && dg2.includes("qmQuiet"));
}

{ // mk2.29: the convoy crate
  const dg3 = src("src/depot/DepotGame.jsx");
  ok("convoy: the hand deals out of a crate", dg3.match(/data-manifest-offer[\s\S]{0,600}cs-deal/) != null);
  ok("convoy: the hand rows kept their kinds", dg3.includes('data-hand-kind={c.hire ? "hire" : "plan"}'));
}
