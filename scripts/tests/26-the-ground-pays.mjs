// COLDSNAP suite era 26 — THE GROUND PAYS (mk2.49-). Income is the clock,
// scaled by held ground — one law, one per-second schedule, both sides;
// the bell stipend is dead. No seed is special; no seed is used.
import { ok } from "./harness.mjs";
import { INCOME_CELLS, groundRate, STIPEND } from "../../src/depot/economy.js";
import { EMIT } from "../../src/depot/territory.js";

ok("G1: INCOME_CELLS is one depot disc of ground (pi r^2 over the 4 m^2 cell)",
  INCOME_CELLS === Math.round(Math.PI * EMIT.depot.r * EMIT.depot.r / 4) && INCOME_CELLS === 1018, INCOME_CELLS);
ok("G1: the floor — holding nothing still pays 1/second", groundRate(0) === 1);
ok("G1: the starting ground pays exactly the old clock", groundRate(INCOME_CELLS) === 1);
ok("G1: below the start the floor holds", groundRate(Math.floor(INCOME_CELLS / 2)) === 1);
ok("G1: held ground scales continuously, fractions included",
  groundRate(2 * INCOME_CELLS) === 2 &&
  Math.abs(groundRate(Math.round(1.5 * INCOME_CELLS)) - 1.5) < 0.01);
{
  ok("G2: STIPEND stands only as the fixtures' shorthand", STIPEND === 90);
}
