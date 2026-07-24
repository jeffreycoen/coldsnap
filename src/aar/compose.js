// aar/compose.js — After-Action Report generator for COLDSNAP contracts.
// Pure and deterministic: same inputs + seed => byte-identical report.
// Consumes the engine's kill events verbatim ({cause, attacker, group,
// buildingId, volley, t}) plus action-layer ordnance counters.
// Verbatim from the buildout plan's verified aar.mjs (T2a/b/c, T5), with
// mulberry32 imported from the engine instead of redeclared.
import { mulberry32 } from "../engine/core.js";

export const ATTR = { player: "operator", world: "unattributed", gren: "counter-fire" };
// ledger vocabulary: one plain word per cause (jargon rule — the long enum
// names made phone reports a wall of text)
export const CAUSE_WORD = { PROJECTILE: "round", BLAST: "blast", CRUSH: "treads", TOSS: "thrown", COLLAPSE: "collapse", DROWN: "drowned", FLIP: "flipped", IMPACT: "impact" };

export const REMARKS = {
  PROJECTILE: ["Direct fire within acceptance band.", "One round, one line item."],
  BLAST: ["Fragmentation coverage nominal.", "Overpressure did the accounting."],
  CRUSH: ["Hull contact within specification.", "The instrument requires no reload."],
  TOSS: ["Ballistic disposition of subjects noted."],
  COLLAPSE: ["The structure performed as rated. The occupants did not.", "Masonry completed the work order. File under materials."],
  FLIP: ["Vehicle attitude exceeded recovery envelope."],
  DROWN: ["The pond accepted delivery.", "Immersion tolerance confirmed at zero."],
  IMPACT: ["Terrain concluded the test."],
  MIXED: ["Method varied. Outcome uniform.", "The bureau does not rank causes. The bureau records them."],
  NONE: ["No expenditure justified. Note to file."],
};

const pad2 = (n) => String(n).padStart(2, "0");

export function composeAAR({ contract, events, ordnance = { shell: 0, mg: 0, volley: 0 }, t0 = 0, elapsed, medal = null, outcome = "FULFILLED", dispersed = 0, seed = 1 }) {
  const rng = mulberry32(seed);
  const kills = events.filter((e) => e.type === "kill");
  const lines = [];
  lines.push(`WORK ORDER ${contract.wo} — ${contract.title}`);
  lines.push(`STATUS: ${outcome} · ${elapsed.toFixed(1)}s${medal ? ` · COMMENDATION: ${medal}` : ""}`);
  lines.push(`SUBJECTS: ${kills.length} PROCESSED${dispersed > 0 ? ` · ${dispersed} DISPERSED` : ""}`);
  // salvo indices in first-seen order, so reports read stably
  const salvo = new Map();
  for (const e of kills) if (e.volley && !salvo.has(e.volley)) salvo.set(e.volley, salvo.size + 1);
  // one compact ledger line per subject; operator attribution is the default
  // and goes unwritten — only exceptions (unattributed, counter-fire) print
  kills.forEach((e, i) => {
    const bits = [`${pad2(i + 1)} · ${CAUSE_WORD[e.cause] || e.cause.toLowerCase()}`];
    if (e.buildingId) bits.push(`struct ${String(e.buildingId).toUpperCase()}`);
    if (e.volley) bits.push(`salvo ${salvo.get(e.volley)}`);
    bits.push(`${Math.round(e.t - t0)}s`);
    if (e.attacker !== "player") bits.push(ATTR[e.attacker] || e.attacker);
    lines.push("  " + bits.join(" · "));
  });
  lines.push(`EXPENDITURE: ${ordnance.shell} SHELL · ${ordnance.mg} MG · ${ordnance.volley} SALVO`);
  // closing remark keyed by dominant cause; tie across causes reads as MIXED
  let key = "NONE";
  if (kills.length) {
    const counts = new Map();
    for (const e of kills) counts.set(e.cause, (counts.get(e.cause) || 0) + 1);
    let best = null, bn = 0, tie = false;
    for (const [c, n] of counts) { if (n > bn) { best = c; bn = n; tie = false; } else if (n === bn) tie = true; }
    key = tie && counts.size > 1 ? "MIXED" : best;
  }
  const pool = REMARKS[key] || REMARKS.MIXED;
  lines.push(`REMARK: ${pool[Math.floor(rng() * pool.length) % pool.length]}`);
  // evidence attachments: campaign contracts author these in their JSON —
  // the bureau's recovery paperwork, filed under the report. Sandbox
  // contracts carry none, so sandbox reports are byte-identical to before.
  (contract.evidence || []).forEach((ev, i) => {
    lines.push(`ATTACHMENT ${String.fromCharCode(65 + i)} · ${ev}`);
  });
  return lines;
}
