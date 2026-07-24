// AAR generator gate — the buildout plan's T2/T5 coverage: determinism,
// grammar, salvo indexing, attribution, zero-kill and tie remarks, plus a
// composition from REAL engine kill events (scripted volley on the pad).
import { composeAAR, REMARKS } from "../src/aar/compose.js";
import { buildProvingGrounds, stepWorld, fireVolley } from "../src/engine/core.js";

const fails = [];
const ok = (name, cond) => {
  console.log(`${cond ? "PASS" : "FAIL"} — ${name}`);
  if (!cond) fails.push(name);
};

const CONTRACT = { wo: "WO-03", title: "AREA SATURATION" };
const kill = (o) => ({ type: "kill", cause: "BLAST", attacker: "player", group: "gunnery", buildingId: "", volley: 0, t: 10, ...o });

// determinism: byte-identical under same inputs + seed
{
  const events = [kill({ t: 11.1 }), kill({ t: 11.4, cause: "PROJECTILE" })];
  const args = { contract: CONTRACT, events, ordnance: { shell: 2, mg: 0, volley: 0 }, t0: 10, elapsed: 5, medal: "GOLD", seed: 42 };
  ok("byte-identical under same seed", composeAAR(args).join("\n") === composeAAR(args).join("\n"));
  const r = composeAAR(args);
  ok("header carries the work order", r[0] === "WORK ORDER WO-03 — AREA SATURATION");
  ok("status carries outcome, time, commendation", r[1] === "STATUS: FULFILLED · 5.0s · COMMENDATION: GOLD");
  ok("subjects counted", r[2] === "SUBJECTS: 2 PROCESSED");
  ok("subject line grammar", r[3] === "  01 · blast · 1s");
  ok("expenditure line", r[5] === "EXPENDITURE: 2 SHELL · 0 MG · 0 SALVO");
}

// salvo indices in first-seen order, regardless of volley id values
{
  const events = [kill({ volley: 7, t: 11 }), kill({ volley: 3, t: 12 }), kill({ volley: 7, t: 13 })];
  const r = composeAAR({ contract: CONTRACT, events, t0: 10, elapsed: 4, seed: 1 });
  ok("salvo indexing is first-seen", r[3].includes("salvo 1") && r[4].includes("salvo 2") && r[5].includes("salvo 1"));
}

// attribution mapping
{
  const events = [kill({ attacker: "world" }), kill({ attacker: "gren" })];
  const r = composeAAR({ contract: CONTRACT, events, t0: 10, elapsed: 4, seed: 1 });
  ok("world reads unattributed, gren reads counter-fire", r[3].includes("unattributed") && r[4].includes("counter-fire"));
}

// zero-kill deviation shape + dispersed suffix + NONE remark
{
  const r = composeAAR({ contract: CONTRACT, events: [], t0: 0, elapsed: 9, outcome: "UNFULFILLED — DEVIATION", dispersed: 6, seed: 5 });
  ok("deviation status renders", r[1].startsWith("STATUS: UNFULFILLED — DEVIATION"));
  ok("dispersed subjects render", r[2] === "SUBJECTS: 0 PROCESSED · 6 DISPERSED");
  ok("zero-kill remark drawn from NONE pool", REMARKS.NONE.includes(r[r.length - 1].replace("REMARK: ", "")));
}

// cause-count tie reads as MIXED
{
  const events = [kill({ cause: "CRUSH" }), kill({ cause: "DROWN" })];
  const r = composeAAR({ contract: CONTRACT, events, t0: 10, elapsed: 4, seed: 9 });
  ok("tie across causes reads MIXED", REMARKS.MIXED.includes(r[r.length - 1].replace("REMARK: ", "")));
}

// building annotation
{
  const r = composeAAR({ contract: CONTRACT, events: [kill({ buildingId: "garrison" })], t0: 10, elapsed: 4, seed: 2 });
  ok("structure annotation renders uppercase", r[3].includes("struct GARRISON"));
}

// composition from REAL engine kill events: volley the gunnery pad
{
  const w = buildProvingGrounds(1234);
  const killEvents = [];
  for (let i = 0; i < 240; i++) { w.events.length = 0; stepWorld(w); }
  fireVolley(w, 0, -30, 6, "player");
  for (let i = 0; i < 600; i++) {
    w.events.length = 0; stepWorld(w);
    for (const e of w.events) if (e.type === "kill") killEvents.push({ ...e });
  }
  const r = composeAAR({ contract: CONTRACT, events: killEvents, ordnance: { shell: 0, mg: 0, volley: 1 }, t0: 2, elapsed: 7, medal: "GOLD", seed: 77 });
  ok("real volley produces kills to report", killEvents.length >= 3);
  ok("every real kill gets a subject line", r.length === 3 + killEvents.length + 2);
  ok("real kills carry salvo annotation", r[3].includes("salvo 1"));
  ok("real kills leave default attribution unwritten", !r[3].includes("operator"));
}

if (fails.length) {
  console.error(`\n${fails.length} FAILURE(S)`);
  process.exit(1);
}
console.log("\nAAR GATE: ALL PASS");
