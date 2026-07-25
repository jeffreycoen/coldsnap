// game/closeout.js — FORM AA-9, the program close-out. Computed from the
// append-only campaign record after all eight orders close. Three tiers
// (decided 2026-07-25): a clean record, discretion, and the quiet ending —
// which requires ALL FOUR deviation-armed orders deviated AND total
// collateral under the gate (mercy after leveling the village doesn't read
// as mercy). Pure over the record object; no JSON imports so the node gates
// can consume it.

export const DEVIATION_ARMED = ["ac04", "ac06", "ac07", "ac08"];
export const COLLATERAL_GATE = 10;

export function closeOut(rec) {
  const collateral = (rec && rec.collateral) || 0;
  const deviations = DEVIATION_ARMED.filter((id) => rec && rec[id] && rec[id].deviated > 0).length;
  const quiet = deviations === DEVIATION_ARMED.length && collateral < COLLATERAL_GATE;
  return { tier: quiet ? "quiet" : deviations > 0 ? "some" : "clean", deviations, collateral };
}

// The Grade baseline — the record as a scalar in [-1, 1]. Deviations pull
// warm (alive winter), fulfilled orders and collateral pull gray, and later
// maps start colder regardless (per-map baseline, decided 2026-07-25). The
// runner drifts DOWN from here per kill, capped subliminal. Weights are
// tuned so a pure kill path reaches ~-1 by AC-08 and a quiet path plays its
// finale under the aurora.
export function gradeBaseline(rec, missionIndex) {
  const dev = DEVIATION_ARMED.filter((id) => rec && rec[id] && rec[id].deviated > 0).length;
  let ful = 0;
  if (rec) for (const k of Object.keys(rec)) if (k !== "collateral" && rec[k] && rec[k].fulfilled > 0) ful++;
  const coll = (rec && rec.collateral) || 0;
  return Math.max(-1, Math.min(1, 0.35 * dev - 0.10 * ful - 0.02 * coll - 0.04 * (missionIndex || 0)));
}

// The document. On the quiet tier the bars sit inline in the text — the
// redaction rule: bars only ever cover grid references, headcounts, and
// directions of dispersal, everything that would let copy 1 find survivors.
// "[margin] " is the second hand. "PROCUREMENT APPROVED." is identical
// across tiers — the unchanged stamp is the indictment.
export function composeAA9(rec) {
  const c = closeOut(rec);
  const lines = ["CLEARANCE PROGRAM — CLOSE-OUT", "ORDERS ISSUED: 8 · ORDERS CLOSED: 8"];
  if (c.tier === "clean") {
    lines.push("Deviation watch: armed on four orders. Deviations recorded: nil.");
    lines.push("The instrument performed. The territory lets clean.");
  } else if (c.tier === "some") {
    lines.push(`Deviations recorded: ${c.deviations}. Dispositions on file.`);
    lines.push("Deviations noted. The instrument exhibits discretion.");
  } else {
    lines.push("Resurvey flagged movement at grid ██–██, heading ███. Count: ██.");
    lines.push("Recovered at resurvey: nil findings.");
    lines.push("Dispersal directions withheld: ████████.");
    lines.push("The instrument ██████.");
  }
  lines.push("PROCUREMENT APPROVED.");
  if (c.tier === "quiet") lines.push("[margin] The originals are safe. So are they.");
  return { ...c, lines };
}
