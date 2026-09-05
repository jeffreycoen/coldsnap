// COLDSNAP suite era 14 — THE PLACEMENT LAW AND THE HERO MARKET (mk1.95).
// The hero hulls leave the two-tap arm and field by the one placement law
// (mode -> ghost -> confirm); every confirm placement shows its zone while
// armed; hero prices leave K 1 and ride the ordinary curve, one shared
// table, both sides. This era draws no rng and names no fixture seed.
import { ok } from "./harness.mjs";
import { computePrices, MARKET_K } from "../../src/depot/market.js";
import { placeZoneMask } from "../../src/depot/state.js";

{
  console.log("\n[era 14: the placement law and the hero market]");

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
}
