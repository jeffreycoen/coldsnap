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
ok("names: the colliding trades re-sign", SQUAD_SPECS.mg.label === "GUNNERS" && SQUAD_SPECS.sniper.label === "SNIPERS");
ok("names: his mg men match the trade", ENEMY_SPECS.mg.label === "gunners");
ok("names: the bar follows the trades",
  dg.includes('key: "sq_mg", label: "GUNNERS"') && dg.includes('key: "sq_sniper", label: "SNIPERS"') &&
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
  ok("convoy: the hand deals out of a crate (re-taught mk2.33: the deal rides StockTag)", dg3.match(/<StockTag[^>]*data-manifest-offer/) != null && src("src/depot/Crate.jsx").includes("cs-deal"));
  ok("convoy: the hand rows kept their kinds", dg3.includes('data-hand-kind={c.hire ? "hire" : "plan"}'));
}

{ // mk2.30: the desk drawn properly — the box chrome dies on the bar
  const dg5 = src("src/depot/DepotGame.jsx");
  const cr5 = src("src/depot/Crate.jsx");
  ok("desk: the stock tag exists on paper", cr5.includes("StockTag") && cr5.includes("clipPath"));
  ok("desk: the crate paints its own label", cr5.match(/<text[\s\S]{0,200}\{label\}/) != null);
  ok("desk: the bar's slots left the box chrome", !dg5.match(/data-tower-key[\s\S]{0,200}P\.slot/) && !dg5.match(/data-sell-toggle[\s\S]{0,200}P\.slot/) && !dg5.match(/data-foe-key[\s\S]{0,200}P\.slot/));
  ok("desk: the tags rest tilted, the deal respects it", dg5.includes("--restT") && dg5.match(/cs-deal[^"]*both/) == null);
  ok("desk: every door survived", dg5.includes("data-build-toggle") && dg5.includes("data-branch") && dg5.includes("data-tower-key") && dg5.includes("data-info=") && dg5.includes("data-sell-toggle") && dg5.includes("data-foe-key"));
}

{ // mk2.31: the lattice — rungs by price, the fold, the sniper's true name
  const dg6 = src("src/depot/DepotGame.jsx");
  ok("lattice: snipers are snipers", (() => { const s = src("src/depot/squads.js"); return /sniper: \{ n: 2, cost: 68, label: "SNIPERS" \}/.test(s); })());
  ok("lattice: the enemy pair follows", dg6.includes('label: "SNIPER PAIR"') && src("src/depot/specs.js").includes('label: "sniper"'));
  ok("lattice: the rungs stand as ruled", dg6.includes("const LATTICE = {") &&
    dg6.match(/troops:[\s\S]{0,400}\["sq_rifles", "sq_engineers", "sq_mg", "sq_sappers"\]/) != null &&
    dg6.match(/troops:[\s\S]{0,600}\["sq_davy"\]/) != null &&
    dg6.match(/vehicles:[\s\S]{0,200}\["hero_apc"\]/) != null &&
    dg6.match(/vehicles:[\s\S]{0,300}\["hero_bison", "hero_mech"\]/) != null);
  ok("lattice: the trunk climbs and the pack folds", dg6.includes("cs-climb") && dg6.includes("cs-pack") && dg6.includes("data-lattice"));
  ok("lattice: packing is inert and finishes on the trunk", dg6.match(/pointerEvents: packing/) != null && dg6.match(/onAnimationEnd=\{packing \? finishPack/) != null);
  ok("lattice: every door survived", dg6.includes("data-build-toggle") && dg6.includes("data-branch") && dg6.includes("data-tower-key") && dg6.includes("data-info=") && dg6.includes("data-sell-toggle") && dg6.includes("data-foe-key"));
  ok("lattice: a fold with no trunk closes at once", dg6.match(/if \(!branch\) \{ setBranch\(next\); if \(closeAll\) setBuildOpen\(false\); return; \}/) != null);
}

{ // mk2.33: the convoy on paper
  const dg7 = src("src/depot/DepotGame.jsx");
  ok("convoy: the hand rows are paper", dg7.match(/<StockTag[^>]*data-manifest-offer/) != null && dg7.includes('data-hand-kind={c.hire ? "hire" : "plan"}'));
}

{ // mk2.34: the draft deal
  const dg8 = src("src/depot/DepotGame.jsx");
  ok("draft: the seven deal as paper from the crate", dg8.match(/<StockTag[^>]*data-draft-card/) != null && dg8.match(/DraftScreen[\s\S]{0,900}<CrateChip/) != null);
  ok("draft: the pick machinery stands", dg8.includes("data-draft-confirm") && dg8.includes("picked.length === 5"));
}
