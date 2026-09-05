// COLDSNAP suite era 24 — THE QUARTERMASTER'S CRATES (mk2.27-mk2.30).
// mk2.27: the names — towers wear proper nouns, the colliding trades
// re-sign, and no two labels on the stock list read the same. No seed is
// special; no seed is used.
import { ok } from "./harness.mjs";
import { TOWER_SPECS, ENEMY_SPECS } from "../../src/depot/specs.js";
import { SQUAD_SPECS } from "../../src/depot/squads.js";

ok("names: the five towers wear proper nouns",
  TOWER_SPECS.mg.label === "SPITTER" && TOWER_SPECS.gun.label === "FIELD GUN" &&
  TOWER_SPECS.mortar.label === "MORTAR" && TOWER_SPECS.rocket.label === "SALVO RACK" &&
  TOWER_SPECS.tesla.label === "TESLA COIL");
ok("names: the colliding trades re-sign", SQUAD_SPECS.mg.label === "GUNNERS" && SQUAD_SPECS.sniper.label === "SNIPERS");
ok("names: his mg men match the trade", ENEMY_SPECS.mg.label === "gunners");
{
  const all = [...Object.values(TOWER_SPECS).map((s) => s.label), ...Object.values(SQUAD_SPECS).map((s) => s.label)];
  ok("names: no two labels on the stock list collide", new Set(all).size === all.length, all.join("|"));
}
