// COLDSNAP suite era 26 — THE GROUND PAYS (mk2.49-). Income is the clock,
// scaled by held ground — one law, one per-second schedule, both sides;
// the bell stipend is dead. No seed is special; no seed is used.
import { ok } from "./harness.mjs";
import { readFileSync } from "node:fs";
import { INCOME_CELLS, groundRate, STIPEND } from "../../src/depot/economy.js";
import { EMIT } from "../../src/depot/territory.js";

const src = (p) => readFileSync(new URL("../../" + p, import.meta.url), "utf8");

ok("G1: INCOME_CELLS is one depot disc of ground (pi r^2 over the 4 m^2 cell)",
  INCOME_CELLS === Math.round(Math.PI * EMIT.depot.r * EMIT.depot.r / 4) && INCOME_CELLS === 1018, INCOME_CELLS);
ok("G1: the floor — holding nothing still pays 1/second", groundRate(0) === 1);
ok("G1: the starting ground pays exactly the old clock", groundRate(INCOME_CELLS) === 1);
ok("G1: below the start the floor holds", groundRate(Math.floor(INCOME_CELLS / 2)) === 1);
ok("G1: held ground scales continuously, fractions included",
  groundRate(2 * INCOME_CELLS) === 2 &&
  Math.abs(groundRate(Math.round(1.5 * INCOME_CELLS)) - 1.5) < 0.01);
{
  const dg = src("src/depot/DepotGame.jsx");
  ok("G2: the player's income line reads the ground rate", /run\.resources \+= run\._groundRate1 \* sdt/.test(dg));
  ok("G2: the regiment accrues on the same clock, the same gate", /run\.reg\.scrap \+= run\._groundRate2 \* sdt/.test(dg));
  ok("G2: the rates ride the territory tick", /run\._groundRate1 = groundRate\(pc\)/.test(dg) && /run\._groundRate2 = groundRate\(ec\)/.test(dg));
  ok("G2: the bell stipend is dead", !/reg\.scrap \+= STIPEND/.test(src("src/depot/state.js")));
  ok("G2: STIPEND stands only as the fixtures' shorthand", STIPEND === 90);
}

// ---- Task 2 (mk2.50): THE TOWN FLAGS — render-only holder markers.
{
  const dg = src("src/depot/DepotGame.jsx");
  const rr = src("src/render/renderer.js");
  ok("F1: the renderer takes render-only town flags (setter + draw loop)",
    /function setTownFlags\(list\)/.test(rr) && /for \(const f of townFlags\)/.test(rr) && /setTownFlags,/.test(rr));
  ok("F2: the game layer hands holder rows on the territory clock",
    /R\.setTownFlags\(rows\)/.test(dg) && /if \(h !== 1 && h !== 2\) continue;/.test(dg));
  ok("F2: ruined buildings, depots, field walls and markers fly nothing (re-taught mk2.63, the markers join)",
    /m\.depot \|\| m\.fwall \|\| m\.marker \|\| b\.ruined\) continue;/.test(dg));
}
