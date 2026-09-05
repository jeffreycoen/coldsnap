// COLDSNAP suite era 28 — THE EARNED MUSTER (mk2.53). The enemy budgets
// what it actually earned since the last bell; fixtures without the
// accumulator take the old curve, byte-stable. No seed is special.
import { ok } from "./harness.mjs";
import { mulberry32 } from "../../src/engine/core.js";
import { planWave, bellBudget } from "../../src/depot/ai.js";
import { makeRunState, fireBell, BELL_PERIOD_S } from "../../src/depot/state.js";

// E1 — the earned baseline governs the steady band: a mid-till regiment
// (150 scrap) under the OLD bell-1 curve (baseline ~20) sits far past the
// 2.2x surge line and DUMPS the till (~125 spent, measured pre-fix); with
// earned 90 the bank threshold is 162 > 150, so it spends its earnings
// (~77-90) and holds the rest — steady pressure, not dump-and-bank.
{
  const mk = (earned) => {
    const reg = { heads: 400, tanks: 10, heads0: 400, tanks0: 10, scrap: 150 };
    if (earned != null) reg.earned = earned;
    planWave(reg, {}, 1, mulberry32(281));
    return 150 - reg.scrap; // scrap actually spent
  };
  const spentOld = mk(null), spentEarned = mk(90);
  ok("E1: the earned baseline steadies the muster (seed 281) — spends the earnings, not the till",
    spentEarned < spentOld && spentEarned <= 90.001 && spentEarned >= 70, `${spentEarned} vs ${spentOld}`);
}

// E2 — the fallback is exact: earned === bellBudget(bell) buys the identical
// plan a fieldless regiment buys.
{
  const run = (withField) => {
    const reg = { heads: 400, tanks: 10, heads0: 400, tanks0: 10, scrap: 400 };
    if (withField) reg.earned = bellBudget(7);
    const p = planWave(reg, {}, 7, mulberry32(282));
    return JSON.stringify([p, reg.scrap, reg.heads, reg.tanks]);
  };
  ok("E2: the fallback equals the curve to the byte (seed 282)", run(false) === run(true));
}

// E3 — the bell spends the accumulator and zeroes it.
{
  const S = makeRunState();
  S.started = true;
  S.reg = { heads: 400, tanks: 10, heads0: 400, tanks0: 10, scrap: 400, earned: 250 };
  fireBell(S, { reg: S.reg, snap: {}, rng: mulberry32(283), t: BELL_PERIOD_S });
  ok("E3: the muster zeroes the earned accumulator (seed 283)", S.reg.earned === 0, S.reg.earned);
}
