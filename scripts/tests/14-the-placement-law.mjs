// COLDSNAP suite era 14 — THE PLACEMENT LAW AND THE HERO MARKET (mk1.95).
// The hero hulls leave the two-tap arm and field by the one placement law
// (mode -> ghost -> confirm); every confirm placement shows its zone while
// armed; hero prices leave K 1 and ride the ordinary curve, one shared
// table, both sides. This era draws no rng and names no fixture seed.
import { ok } from "./harness.mjs";
import fs from "node:fs";
import { computePrices, MARKET_K } from "../../src/depot/market.js";
import { placeZoneMask } from "../../src/depot/state.js";

{
  console.log("\n[era 14: the placement law and the hero market]");
  const dgSrc = fs.readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");
  const rSrc = fs.readFileSync(new URL("../../src/render/renderer.js", import.meta.url), "utf8");

  // (a) the hero market rides the ordinary curve
  ok("K1: the three hero families carry K 3 (the machine precedent)",
    MARKET_K.heroBison === 3 && MARKET_K.heroApc === 3 && MARKET_K.heroMech === 3,
    JSON.stringify({ b: MARKET_K.heroBison, a: MARKET_K.heroApc, m: MARKET_K.heroMech }));
  ok("K2: one standing bison prices 240, no longer double",
    computePrices({ heroBison: 1 }).player.hero_bison === 240, computePrices({ heroBison: 1 }).player.hero_bison);
  ok("K2b: two standing bisons price 300",
    computePrices({ heroBison: 2 }).player.hero_bison === 300, computePrices({ heroBison: 2 }).player.hero_bison);
  ok("K2c: the type wall tops out at 6x past the pole (1200)",
    computePrices({ heroBison: 6 }).player.hero_bison === 1200, computePrices({ heroBison: 6 }).player.hero_bison);
  ok("K3: one standing mech prices 480",
    computePrices({ heroMech: 1 }).player.hero_mech === 480, computePrices({ heroMech: 1 }).player.hero_mech);
  const pSym = computePrices({ heroBison: 1, heroApc: 2, heroMech: 1 });
  ok("K4: the foe table carries the same hero prices — one shared market, symmetric",
    pSym.foe.hero_bison === pSym.player.hero_bison && pSym.foe.hero_apc === pSym.player.hero_apc && pSym.foe.hero_mech === pSym.player.hero_mech);

  // (b) the zone mask, functional — a hand-built stub grid, no rng, no seed
  {
    const cells = [];
    for (let i = 0; i < 16; i++) cells.push({ blocked: false, wallId: null, ice: false, water: false });
    cells[5].blocked = true; cells[6].ice = true;
    const grid = { w: 4, h: 4, cs: 2, cells, idx: (gx, gz) => gz * 4 + gx, gridToWorld: (gx, gz) => ({ x: gx * 2, z: gz * 2 }) };
    const m1 = placeZoneMask(grid, (x, z) => z >= 4);
    let held1 = 0; for (let i = 0; i < 16; i++) held1 += m1[i];
    ok("K5: the mask holds exactly the held half-plane", held1 === 8 && m1[grid.idx(0, 2)] === 1 && m1[grid.idx(0, 1)] === 0, `${held1} cells`);
    grid.cells[grid.idx(1, 2)].wallId = 7;
    const m2 = placeZoneMask(grid, (x, z) => z >= 4);
    let held2 = 0; for (let i = 0; i < 16; i++) held2 += m2[i];
    ok("K5b: blocked, iced and walled cells leave the mask", held2 === 7 && m2[grid.idx(1, 2)] === 0, `${held2} cells`);
  }

  // (c) the game layer: the two-tap arm is dead, the one placement law holds
  ok("K6: buyHero, heroArm and HERO_ARM_S are gone from the game layer",
    !/buyHero|heroArm|HERO_ARM_S/.test(dgSrc));
  ok("K7: the hero mode map exists beside the squad map",
    /const HERO_MODE = \{ hero_bison: "bison", hero_apc: "apc", hero_mech: "mech" \};/.test(dgSrc));
  ok("K8: setMode carries no hero special-case",
    !/m === "hero_bison" \|\| m === "hero_apc" \|\| m === "hero_mech"/.test(dgSrc));
  ok("K9: a hero-mode ground tap sets a pending ghost with its footprint",
    /S\.pending = \{ hero: S\.mode,[^\n]*fp: ghostFp\(S\.mode\)/.test(dgSrc));
  ok("K10: the ✓ runs placeHero; a refusal leaves the ghost standing",
    /if \(p\.hero\) \{ if \(placeHero\(p\.hero, p\.wp\)\) S\.pending = null; return; \}/.test(dgSrc));
  ok("K11: placeHero checks the price first and the ground's own laws (the mk1.86 precedent)",
    /const placeHero = \(key, p\) => \{[\s\S]{0,700}toast\("NO SCRAP"\); return false;[\s\S]{0,700}toast\("GROUND NOT HELD"\); return false;/.test(dgSrc));
  ok("K12: the hire and deal ghosts carry their footprints",
    /S\.pending = \{ hire: S\.hirePlace\.key[^\n]*fp: ghostFp\(S\.hirePlace\.key\)/.test(dgSrc) &&
    /S\.pending = \{ deal: S\._placeQueue\[0\][^\n]*fp: ghostFp\(S\._placeQueue\[0\]\)/.test(dgSrc));
  ok("K13: the zone refreshes on its own wall-time tick (the deal phase has no sim clock)",
    /zoneAcc \+= dt;[\s\S]{0,120}refreshZone\(\);/.test(dgSrc));
  ok("K14: the zone opens for the deal, the hires, the squads, the towers and the heroes",
    /const dealPhase = !S\.started && S\._placeQueue && S\._placeQueue\.length;/.test(dgSrc) &&
    /TOWER_SPECS\[S\.mode\] \|\| SQUAD_MODE\[S\.mode\] \|\| HERO_MODE\[S\.mode\]/.test(dgSrc));
  ok("K15: the bought plan arms the bar for EVERY key — heroes included",
    !/startsWith\("hero_"\)\) setMode/.test(dgSrc));

  // (d) the renderer: additive divergences only (golden stays green)
  ok("K16: the zone overlay exists with the passed-mask signature",
    /setZone\(on, grid, mask, heightAt, color\)/.test(rSrc));
  ok("K17: the pending ghost scales to the passed footprint",
    /setPending\(on, x, y, z, pts, ringR, color, fp\)/.test(rSrc) &&
    /pendingPad\.scale\.set\(fp\.x, fp\.h \/ 1\.8, fp\.z\)/.test(rSrc));
}
