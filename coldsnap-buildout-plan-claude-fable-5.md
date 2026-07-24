# COLDSNAP — Contract-Sandbox Build-Out Plan
**Prepared by Claude Fable 5 (Anthropic) · 2026-07-23**

This plan takes COLDSNAP from the seven-trial proving grounds to a contract-sandbox game with the bureau work-order fiction, in five phases. Every code block below is marked **VERIFIED** or **SKETCH**. VERIFIED code was executed in this plan's harness against the real engine — the physics core and TRIALS array extracted headlessly from `/mnt/project/coldsnap_engine` (lines 1–2098 plus lines 2815–2832) and run under Node 22. Harness result: **890 assertions passed, 0 failed**. SKETCH code is integration work for the artifact runtime, cited against exact source-line anchors, to be covered by the existing e2e/touch suites when applied.

Engine slice smoke test: `buildProvingGrounds(1234)` stands alone headlessly — 1030 bodies, 1716 welds, deterministic `worldHash` after 2 sim-seconds. The extraction recipe is in Appendix B so these tests drop into the existing pipeline as-is.

Ground rule for every phase: the current suites (71 headless, 16 e2e, 17 touch, 5 strict-dev) stay green, the new tests below join them, and each phase ends at a playtest gate with an explicit kill-criterion. Phases are gated by answers, not calendar.

---

## Phase 1 — Voice pass

Replace trial strings with bureau work-order fiction. Text only; zero mechanics change. The deliverable is one data module.

**contracts.mjs — VERIFIED (T1: all seven trial ids covered, all fields present)**

```js
// contracts.mjs — Phase 1 voice pass. Bureau work-order fiction over the
// existing TRIALS. Text only; no mechanics change. Keyed by trial id.

export const CONTRACTS = {
  gunnery: {
    wo: "WO-01", title: "DIRECT-FIRE ACCEPTANCE",
    directive: "Three subjects at the gunnery pad. Main gun or coax. Reticle discipline is assumed.",
    commendation: "Direct-fire lethality within acceptance band.",
  },
  roadkill: {
    wo: "WO-02", title: "OVERRUN TRIAL",
    directive: "Close with the road line under power. The hull is the instrument.",
    commendation: "Contact lethality confirmed. Treads within tolerance.",
  },
  saturation: {
    wo: "WO-03", title: "AREA SATURATION",
    directive: "One salvo. Three subjects. Density is the deliverable.",
    commendation: "Coverage per round meets projection.",
  },
  demolition: {
    wo: "WO-04", title: "STRUCTURAL COLLAPSE, OCCUPIED",
    directive: "The keep is garrisoned. Breach it. The masonry completes the work order.",
    commendation: "Load-path failure per design. Occupancy resolved.",
  },
  deep_end: {
    wo: "WO-05", title: "IMMERSION TOLERANCE",
    directive: "Displace the poolside detail into open water. Sustained immersion concludes the test.",
    commendation: "Tolerance recorded at zero.",
  },
  counter_battery: {
    wo: "WO-06", title: "COUNTER-BATTERY",
    directive: "Three tubes on the ridge, firing. Silence is the acceptance criterion.",
    commendation: "Ridge inventory reduced to specification.",
  },
  thin_ice: {
    wo: "WO-07", title: "SURFACE LOAD RATING",
    directive: "The drill squad occupies the sheet. Clear it. Method unspecified.",
    commendation: "Sheet rating established.",
  },
};
```

**Integration — SKETCH.** In the artifact, paste the table after the `TRIALS` array (source line 2815) and overlay:

```js
// after the TRIALS array closes (anchor: source line 2832 "];")
for (const t of TRIALS) {
  const c = CONTRACTS[t.id];
  if (c) { t.title = `${c.wo} · ${c.title}`; t.hint = c.directive; }
}
```

In `advanceTrial` (anchor: source line 2900), the completion toast becomes commendation language: `let title = "COMMENDATION — " + t.title;` and on medal, append the contract's `commendation` line to `desc`. The deploy-overlay copy ("Seven field trials…") optionally becomes "Seven work orders. The bureau is watching the clock."

**Tests.** T1 verified headlessly. Repoint the e2e string assertions that currently match trial titles at the CONTRACTS table so fiction edits can't silently break the HUD.

**Gate.** Playfeel only: play all seven with the new voice. Kill-criterion — if the tone does not change how completing gunnery feels, story investment stops here for the price of a text diff, and the game ships as pure score-attack with medals.

---

## Phase 2 — After-Action Report generator

Every contract completion emits a bureau report composed from the real kill event stream. The engine already records everything needed — `cause`, `attacker`, `group`, `buildingId`, `volley`, `t` on each kill event — so the generator is one pure, deterministic function.

**aar.mjs — VERIFIED (exact-output on three synthetic streams; byte-identical under same seed; composed cleanly from 12 real engine kill events in T5)**

```js
// aar.mjs — After-Action Report generator for COLDSNAP contracts.
// Pure and deterministic: same inputs + seed => byte-identical report.
// Consumes the engine's kill events verbatim ({cause, attacker, group,
// buildingId, volley, t}) plus action-layer ordnance counters.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ATTR = { player: "operator", world: "unattributed", gren: "counter-fire" };

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
  kills.forEach((e, i) => {
    const bits = [`SUBJECT ${pad2(i + 1)} — ${e.cause}`];
    if (e.buildingId) bits.push(`struct ${String(e.buildingId).toUpperCase()}`);
    if (e.volley) bits.push(`salvo ${salvo.get(e.volley)}`);
    bits.push(`t+${(e.t - t0).toFixed(1)}s`);
    bits.push(`attributed: ${ATTR[e.attacker] || e.attacker}`);
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
  return lines;
}
```

Report grammar, fixed: header · status (outcome, elapsed, commendation) · subject count (+ dispersed) · one line per subject in kill order (cause, structure if any, salvo index if any, t-offset, attribution) · expenditure · seeded closing remark. Attribution maps `player → operator`, `world → unattributed`, `gren → counter-fire`. Zero-kill reports draw the `NONE` remark; a cause-count tie reads as `MIXED`.

Sample composed from **real engine events** in the harness (scripted volley on the gunnery pad, 12 kills):

```
WORK ORDER WO-03 — AREA SATURATION
STATUS: FULFILLED · 5.0s
SUBJECTS: 12 PROCESSED
  SUBJECT 01 — BLAST · salvo 1 · t+1.1s · attributed: operator
  ...
  SUBJECT 11 — PROJECTILE · salvo 1 · t+1.7s · attributed: operator
  SUBJECT 12 — BLAST · salvo 1 · t+1.7s · attributed: operator
EXPENDITURE: 0 SHELL · 0 MG · 1 SALVO
REMARK: Overpressure did the accounting.
```

**Wiring — SKETCH, with anchors.** Ordnance is counted at the action layer, not from `muzzle` events, because `grenFire` also routes through `fireProjectile` and pollutes the muzzle stream with enemy mortar rounds.

```js
// enterTrial (anchor: source line 2892) — add:
S.trialLog = { events: [], ordnance: { shell: 0, mg: 0, volley: 0 } };

// onKill (anchor: source line 2988) — first statement:
if (S.trialLog) S.trialLog.events.push({ ...e });

// actions (anchor: source line 3002) — inside each success path:
//   fireAt:   S.trialLog && S.trialLog.ordnance.shell++;
//   volleyAt: S.trialLog && S.trialLog.ordnance.volley++;
//   mgAt:     S.trialLog && S.trialLog.ordnance.mg++;

// advanceTrial (anchor: source line 2900), success branch, after MEDAL:
const report = composeAAR({
  contract: CONTRACTS[t.id], events: S.trialLog.events,
  ordnance: S.trialLog.ordnance, t0: S.trial.t0, elapsed: el,
  medal: m, seed: 1234 + S.trial.idx,
});
S.lastAAR = { id: t.id, lines: report };
try { window.storage.set("coldsnap-aar-" + t.id, JSON.stringify(report)); } catch (e) {}
```

UI: a monospace panel in the existing `P.panel` style, rendered when `hud.aar` is set, dismissed on tap, with the typewriter reveal skipped — the voice carries it. The free-play bar's stars open the stored report for that contract.

**Tests.** T2a/T2b/T2c exact-output plus T5 real-events run, all verified (Appendix A). In-suite additions: assert `composeAAR` determinism and the three exact streams; e2e asserts the panel renders after a completed gunnery run.

**Gate.** Put it in front of playtesters. Kill-criterion — nobody reads past the header, nobody replays to get a different report: demote the AAR to a single status line and stop investing in report content.

---

## Phase 3 — The dissonant contract

`thin_ice`'s hint already promises "any way that works." Add the silent completion the bureau didn't ask for: herd the drill squad off the sheet without a kill. The bureau logs it `UNFULFILLED — DEVIATION`, with its own report.

**altcheck.mjs — VERIFIED (T4: against the real `thin_ice` setup — 6 subjects spawn OCCUPIED; teleported clear reads CLEAR; one death reads VOID)**

```js
// altcheck.mjs — deviation detector for contracts with a silent no-kill
// completion. thin_ice: all subjects alive and none inside the pond
// footprint (+margin) => "CLEAR". Any subject dead => "VOID" — the kill
// path owns the contract from there. Pure over (bodies, rect, group).

export function disperseState(bodies, rect, group, margin = 1) {
  let alive = 0;
  for (const b of bodies) {
    if (b.group !== group) continue;
    if (!b.alive) return "VOID";
    alive++;
    const on = b.pos.x > rect.x0 - margin && b.pos.x < rect.x1 + margin &&
               b.pos.z > rect.z0 - margin && b.pos.z < rect.z1 + margin;
    if (on) return "OCCUPIED";
  }
  return alive > 0 ? "CLEAR" : "VOID";
}
```

Feasibility, checked against engine behavior: subjects spawn at x −3…3, z 25/30 — inside `POOL` — units flee the hull (reach 8 m + 0.7 × speed), and the thin-ice flee AI explicitly permits running onto and off the sheet, so a slow approach from one bank herds them to the far shore. `margin = 1` keeps a man standing on the dry apron legal.

**Wiring — SKETCH.**

```js
// TRIALS thin_ice def gains:  alt: { group: "ponddrill", holdS: 4 }
// main loop, after the physics stepping block, before HUD updates:
const td = TRIALS[S.trial.idx];
if (td && td.alt && S.trial.prog === 0) {
  const st = disperseState(S.world.bodies, POOL, td.alt.group);
  S.trial.altT = st === "CLEAR" ? (S.trial.altT || 0) + dt : 0;
  if (S.trial.altT >= td.alt.holdS) advanceDeviation(td);
}
```

`advanceDeviation` mirrors `advanceTrial` (anchor: 2900) with `outcome: "UNFULFILLED — DEVIATION"`, no commendation, `dispersed` = live subject count, and `S.medals[t.id] = { time: +el.toFixed(1), medal: null, deviation: true }`. The free-play star row (anchor: the `hud.medals[t.id]` map in the FREE PLAY header) renders a hollow grey `☆` for deviation entries. `S.trial.prog === 0` guards the path: one kill and the deviation is void, permanently for that attempt — `disperseState` returning `VOID` enforces the same from the detector side.

**Tests.** T4 verified. In-suite additions: a scripted herd (teleport-assisted is fine — the detector is what's under test) asserts the deviation completion, its AAR variant, the medal flag, and that the normal three-kill path is byte-identical to today.

**Gate.** Do playtesters find it unprompted, and do they mention it afterward? Kill-criterion — nobody discovers or cares: deviations stay in as flavor but the campaign fork (Phase 5) is cut.

---

## Phase 4 — The split and the scenario pipeline

This is the gate between demo and product: contracts and maps become content, not code.

**Module map.** `engine/core.mjs` is source lines 1–2098 today — the harness extraction (Appendix B) is the existence proof that it stands alone with zero React/three dependency. `engine/map.mjs` takes `POOL`/`STATIONS`/`buildTerrain`/the prefab builders next. Then `game/contracts.mjs`, `game/predicate.mjs`, `aar/compose.mjs`, `render/` (makeRenderer + splat + pools), `ui/` (the component). Two build targets: a normal web bundle for itch, and a single-file bundle with `react`/`three` as externals so the claude.ai artifact remains a distribution channel.

**Predicate interpreter — VERIFIED, parity 864/864 against the live `match()` closures over the full cause × attacker × group grid.**

```js
// predicate.mjs — declarative contract predicates for the Phase 4 scenario
// schema. Replaces TRIALS match() closures with data, so contracts become
// authorable content. Parity-verified against the live closures.

export function matchKill(pred, e) {
  if (!pred) return false;
  if (pred.causes && !pred.causes.includes(e.cause)) return false;
  if (pred.group && e.group !== pred.group) return false;
  if (pred.attacker && e.attacker !== pred.attacker) return false;
  if (pred.kinds && !pred.kinds.includes(e.kind)) return false;
  if (pred.volleyed && !e.volley) return false;
  return true;
}

// The seven shipped trials expressed as data. saturation keeps the engine's
// volley-counting rule (N kills sharing one volley id) — that lives in the
// trial runner, flagged here as volleyMode rather than faked as a predicate.
export const CONTRACT_PREDICATES = {
  gunnery: { attacker: "player", causes: ["BLAST", "PROJECTILE"], group: "gunnery" },
  roadkill: { attacker: "player", causes: ["CRUSH"] },
  saturation: { volleyMode: true, need: 3 },
  demolition: { causes: ["COLLAPSE"] },
  deep_end: { causes: ["DROWN"] },
  counter_battery: { group: "pit" },
  thin_ice: { group: "ponddrill" },
};
```

**Scenario schema — SKETCH.** One JSON file per contract:

```json
{
  "id": "ac_03",
  "contract": {
    "wo": "AC-03", "title": "CONVOY INTERDICTION",
    "directive": "Three vehicles on the north road. The road is the contract.",
    "need": 3, "par": [20, 35],
    "predicate": { "group": "convoy" },
    "alt": null
  },
  "terrain": { "terrainSeed": 11, "worldSeed": 2201, "pads": [{ "x": 0, "z": -30, "r": 6, "h": 2.3 }], "pool": null },
  "prefabs": [
    { "type": "house", "group": "house0", "x": -10, "z": -34, "nx": 5, "nz": 4, "doorIx": 4 },
    { "type": "wall", "x": 9, "z": -26, "yaw": 0.9, "nx": 4, "ny": 3, "nz": 2 }
  ],
  "squads": [{ "tag": "convoy", "x0": -6.4, "z0": 75.2, "nx": 4, "nz": 1, "dx": 1.6, "dz": 1.3 }],
  "vehicles": [{ "kind": "truck", "x": -7, "z": 72, "yaw": 0.2 }],
  "player": { "x": 0, "z": -52 },
  "budget": { "bodies": 1100, "welds": 1800, "msPerStep": 1.6 }
}
```

The loader's contract, stated once and enforced by the golden test: **creation order is fixed** — player, then squads in array order, then vehicles, then prefabs, then freeze — because `worldHash` parity and the seq-parity flee AI (`u.seq & 1`) both depend on order stability. Prefab extraction list: `flatten`, `weldGrid`, `buildHouse(grp, cx, cz, nx, nz, doorIx)`, the wall spec `[cx, cz, yaw, nx, ny, nz]`, hangar and warehouse as parameterized specs, each emitting its `covers`/`shelters` metadata so the cover-seek AI keeps working on authored maps.

**Seed architecture — FINDING, VERIFIED.** Idle worlds are seed-invariant: `makeField` ignores its seed parameter, `buildTerrain` is hardcoded to seed 11, and `world.rng` is drawn only by ordnance (volley offsets, blast torque, grenadier spread). Two consequences, both encoded in T6: the schema carries `terrainSeed` and `worldSeed` separately (terrain variation requires wiring `buildTerrain` to the schema — a two-line change), and **the golden parity test must script ordnance**, or it cannot catch rng-ordering regressions.

```js
// golden determinism harness (T6, verified) — the Phase 4 regression gate
const a1 = buildProvingGrounds(777), a2 = buildProvingGrounds(777);
for (let i = 0; i < 1200; i++) { a1.events.length = 0; stepWorld(a1); }
for (let i = 0; i < 1200; i++) { a2.events.length = 0; stepWorld(a2); }
// same seed => identical hash after 10 sim-seconds, across rebuilds
// idle worlds are ALSO seed-invariant (rng drawn only by ordnance), so:
const c1 = buildProvingGrounds(777), c2 = buildProvingGrounds(778);
fireVolley(c1, 0, -30, 6, "player"); fireVolley(c2, 0, -30, 6, "player");
for (let i = 0; i < 600; i++) { c1.events.length = 0; stepWorld(c1); c2.events.length = 0; stepWorld(c2); }
// hashes diverge only once ordnance draws rng — the golden test scripts a volley
```

Golden migration gate: load scenario #0 (the proving grounds transcribed to JSON), assert `worldHash` equality with the hand-built world at t = 0 and after 1200 steps plus one scripted volley. Content lint, run per scenario in CI: body/weld/pre-slept-fraction budgets from the JSON, an ms-per-step budget over 1200 seeded steps, and a double-load determinism check.

**Gate.** Golden parity green and one new contract authored purely in JSON with no engine edits. Kill-criterion — if authoring still requires code, the schema is wrong; fix it before writing content.

---

## Phase 5 — Content: the arc slice

Eight contracts with drift, one fork, two endings. Authored in the Phase 4 schema; each names its predicate and its deviation, so the table below is close to the actual content files.

| # | Work order | Predicate | Drift | Alt |
|---|---|---|---|---|
| AC-01 | ARMOR PLATE ACCEPTANCE | `{causes:[PROJECTILE], group:"plate"}` (parked wrecks) | Clean — shooting steel | — |
| AC-02 | BATTERY REDUCTION | `{group:"battery"}` | Clean — they shoot back | — |
| AC-03 | CONVOY INTERDICTION | `{group:"convoy"}` | Moving trucks; first crews on foot | — |
| AC-04 | CROSSING DENIAL | `{group:"crossing"}` on the refrozen pond | Infrastructure as target | disperse |
| AC-05 | OUTBUILDING, OCCUPIED | `{causes:[COLLAPSE], group:"holdout"}` | The directive names the method | — |
| AC-06 | THE CONVOY HAS STOPPED | `{group:"convoy2"}` — halted trucks, dismounted crews standing | The target isn't fighting | disperse |
| AC-07 | THE VILLAGE | `{causes:[COLLAPSE], group:"village"}` — garrisoned houses | The town is the range | disperse |
| AC-08 | SURFACE LOAD RATING, REPEAT | `{group:"ponddrill2"}` | The drill squad again; the mirror | disperse |

The fork is cheap and systemic: the campaign-final AAR draws its remark pool from cumulative deviation count — zero deviations reads one way ("The instrument performed. Procurement approved."), one or more reads the other ("Deviations noted. The instrument has opinions. Procurement approved.") — and the free-play star row is the permanent record either way. No branching missions, no dialogue; the classifier already collected the story.

---

## Schedule and gates

| Phase | Effort | Gate | Kill-criterion |
|---|---|---|---|
| 1 Voice pass | 1–2 sessions | Playfeel | Tone changes nothing → ship score-attack |
| 2 AAR | 5–7 sessions | Playtesters read/replay | Nobody reads → one-line status |
| 3 Deviation | 2–3 sessions | Found unprompted | Nobody finds → cut the campaign fork |
| 4 Split + pipeline | 2–3 weeks | Golden parity + one JSON-only contract | Authoring needs code → fix schema first |
| 5 Arc slice | 2–3 weeks content | Strangers on itch finish it | Completion cliff at AC-05/06 → re-pace drift |

Phase 1 can start today; the CONTRACTS table above is the diff.

---

## Appendix A — Verification transcript

Harness: Node v22, engine extracted per Appendix B. **890 passed, 0 failed.** Coverage: T1 contract-table completeness (7 trials × 4 fields); T2a demolition AAR exact-output + byte-identical determinism; T2b zero-kill deviation AAR exact; T2c salvo indexing, world-attribution, dominant-cause remark; T3 predicate parity, 864 grid combinations vs live closures, zero mismatches; T4 `disperseState` OCCUPIED→CLEAR→VOID against the real `thin_ice` setup (6 subjects); T5 AAR composed from 12 real kill events of a scripted volley (report shape, salvo annotation, line grammar); T6 cross-rebuild same-seed hash equality at 10 sim-seconds, idle seed-invariance confirmed, divergence via scripted ordnance confirmed.

## Appendix B — Headless extraction recipe

```bash
# engine-headless.mjs = header comment + pure engine + TRIALS, imports dropped
{ sed -n '1,4p;7,2098p' coldsnap_engine; sed -n '2815,2832p' coldsnap_engine; \
  echo 'export { TRIALS };'; } > engine-headless.mjs
node test.mjs   # the suite in this plan; 890 assertions
```

Line anchors cited in this plan, against the current source: `TRIALS` 2815–2832 · `enterTrial` 2892 · `MEDAL` 2899 · `advanceTrial` 2900 · `onTrialKill` 2935 · `onKill` 2988 · `actions` 3002 · storage keys `coldsnap-medals` 2913, `coldsnap-trial` 2920, `coldsnap-ach` 2953. Anchors shift as the file grows; the identifiers are the stable reference.
