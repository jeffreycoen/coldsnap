# DEPOT Phase 3 Implementation Plan — Attacker Economy, Doctrine AI, Intel

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static wave table with an opponent: a seed-varied finite regiment spending a mirrored scrap economy through one fixed counter-rule brain (banking toward tank pushes or surge waves), reported to the player as strength-word intel dispatches with one-wave delay and seeded gaps. Riflemen, grenadiers, sappers, breakers, and tanks return, all firing through the shared accuracy model at tower-equal aim.

**Architecture:** Three new pure modules — `src/depot/economy.js` (regiment + ledgers + income), `src/depot/ai.js` (buy brain), `src/depot/intel.js` (dispatch text) — consumed by the existing phase machine in `state.js`. `startWave(S, WAVES)` currently reads a static table; Phase 3 makes the table *generated per wave* by the brain (`WAVES` becomes a fallback for tests only). Enemy fire reuses `towerShot`'s scatter path via a shared `shooterFire` helper. All decisions committed at wave start (multiplayer decision-packet shape preserved).

**Tech Stack:** existing only. Scoped verification per Jeff's rule (only named gates locally; `SMOKE_ONLY=depot`; golden only when core.js is touched — NO core.js changes are planned this phase).

## Global Constraints

- `ColdsnapTD.jsx`, demo, sandbox, campaign, core.js untouched (if a core change proves necessary, STOP and surface it — plan defect).
- No `Math.random()` in `src/depot/` (lint gate). All economy/AI/intel randomness through `world.rng` or a dedicated `mulberry32(seed)` stream owned by the run state — draw counts documented per call site (multiplayer determinism).
- Decisions commit at wave start only; nothing the brain does mid-wave. The stall's `advance()` remains the single gate.
- Intel NEVER lies: strength-words only, one-wave delay, seeded silence gaps. No counts, no percentages, no enemy scrap numbers in any UI.
- Rotation invariance: any new UI (intel re-read, regiment end cards) verified under Q/E rotation in smoke.
- Jeff's locked decisions (vision doc "Phase 3 decisions") govern over any convenience: regiment 300-500 seed-varied; results pay uncapped incl. towers; equal aim; book-value ledger.
- Commit trailer: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

---

### Task 1: economy.js — regiment, income, ledgers

**Files:**
- Create: `src/depot/economy.js`, extend `scripts/depot-test.mjs` (new section)

**Interfaces (later tasks depend on exact names):**

```js
// src/depot/economy.js — the attacker's books + the book-value verdict.
// Pure state-in/state-out; rng only in makeRegiment (exactly 2 draws).
export function makeRegiment(rng) {
  // seed-varied strength: 300-500 heads, 8-14 tanks; 2 rng draws, always.
  const heads = 300 + Math.floor(rng() * 201);
  const tanks = 8 + Math.floor(rng() * 7);
  return { heads, tanks, heads0: heads, tanks0: tanks, scrap: 60 };
}
export const STIPEND = 14;                    // per round
export const RESULTS = {                      // uncapped by decision (Jeff)
  structureDmg: 0.06,                         // scrap per hp of wall/tower damage dealt
  towerKill: 12, wallKill: 2, buildingKill: 8, leak: 10,
};
export function payResults(reg, ev) {         // ev: {structureDmg, towerKills, wallKills, buildingKills, leaks}
  reg.scrap += ev.structureDmg * RESULTS.structureDmg + ev.towerKills * RESULTS.towerKill
    + ev.wallKills * RESULTS.wallKill + ev.buildingKills * RESULTS.buildingKill + ev.leaks * RESULTS.leak;
}
export function combatIneffective(reg) {      // attrition victory threshold
  return reg.heads < 0.12 * reg.heads0 && reg.tanks === 0;
}
export function bookValue(side) { /* {scrap, assets} -> number; assets = Σ build-cost/purchase-price */ }
```

- [ ] **Step 1:** Failing asserts in depot-test.mjs: makeRegiment bounds over 50 seeds (300≤heads≤500, 8≤tanks≤14) + exactly-2-draw contract; payResults arithmetic on a fixture; combatIneffective edge (12% boundary, tanks>0 blocks); bookValue symmetry fixture.
- [ ] **Step 2:** verify fail → **Step 3:** implement → **Step 4:** `node scripts/depot-test.mjs && npm run lint:depot` → **Step 5:** Commit "DEPOT economy: seed-varied regiment, uncapped results pay, book-value ledgers".

### Task 2: the roster returns — enemy units with model-true fire

**Files:**
- Modify: `src/depot/specs.js` (ENEMY_SPECS: conscript/runner/gren/sapper/breaker + TANK — port values from ColdsnapTD.jsx :569-574/:836, keep bounty=price), `src/depot/state.js` (shooterFire), `src/depot/DepotGame.jsx` (unit behavior drivers ported from TD: rifle-halt, grenadier lob, sapper satchel, breaker ram, tank shell — replace every Math.random with world.rng, route EVERY aimed shot through the accuracy model)
- Extend: `scripts/depot-test.mjs`

**Interfaces:**
- `shooterFire(world, shooter, muzzle, target, spec)` in state.js — the generalized `towerShot` core (extract shared internals; towers and enemies both call it; enemy specs carry `acc`/`windF`/`windComp` EQUAL to the analogous tower values per Jeff's decision: rifle=mg acc 0.090, gren lob=mortar acc 0.020/windF 0.04, tank=gun acc 0.070/windF 0.9; windComp equal too).
- [ ] **Step 1:** Failing asserts: seeded skirmish (2 riflemen vs 1 wall) → wall takes damage, impact list deterministic across twin seeds; grenadier lob deflects under strong constant world.wind (leeward twin-test, same pattern as Task 3 P2); sapper satchel still breaches; specs carry the exact acc values above.
- [ ] **Step 2:** verify fail → **Step 3:** port drivers (read TD's blocks first; DEPOT copies live in DepotGame.jsx or a new `src/depot/units.js` if DepotGame would exceed ~1500 lines — prefer units.js) → **Step 4:** `node scripts/depot-test.mjs && npm run test:accuracy && npm run lint:depot` → **Step 5:** Commit "DEPOT roster: the zoo returns, every shot through the accuracy model at tower-equal aim".

### Task 3: ai.js — the buy brain

**Files:**
- Create: `src/depot/ai.js`; extend `scripts/depot-test.mjs`

**Interfaces:**

```js
// src/depot/ai.js — one fixed brain. Deterministic: (regiment, buildSnapshot, waveIdx, rng).
// buildSnapshot (computed by DepotGame at stall): {mortars, mgs, guns, frosts, walls, towerElev}
export function planWave(reg, snap, waveIdx, rng) {
  // returns {buys: [{type, n}], banked: bool} — commits at wave start; draws ≤ 4 rng.
  // Counter-weights (blend, never a pure counter):
  //   mortar-heavy -> runners; walls>threshold -> sapper/breaker; frost farm -> gren; mg-heavy -> tank
  // Banking: if scrap > 1.8x wave budget baseline, bank toward TANK PUSH (2-4 tanks + screen)
  //   or SURGE (2.2x infantry budget) — pick by dominant counter-weight; spend on trigger wave.
  // Purchases DEPLETE reg.heads/reg.tanks; cannot buy what the regiment lacks.
}
export function waveBudget(waveIdx) { /* baseline ramp, tunable curve */ }
```

- [ ] **Step 1:** Failing asserts: determinism (same inputs → same plan); counter-response (mortar-heavy snapshot yields runner share > baseline; walled yields sapper+breaker share >; frost yields gren >; mg yields tank sooner); banking triggers on high scrap and later erupts as tanks≥2 or surge >2x median; regiment depletion (empty pool → thin/empty waves, never negative); a full 50-wave sim vs a static snapshot completes without stalling.
- [ ] **Step 2:** verify fail → **Step 3:** implement → **Step 4:** `node scripts/depot-test.mjs && npm run lint:depot` → **Step 5:** Commit "DEPOT brain: counter-rule blend, tank-push/surge banking, finite regiment".

### Task 4: wiring — the economy drives the game

**Files:**
- Modify: `src/depot/state.js` (startWave generates from planWave; results events accumulate into payResults at stall; STIPEND at advance; regiment deaths on kill events), `src/depot/DepotGame.jsx` (buildSnapshot at stall; kill/damage event routing — the tdkill/bounty path is the pattern; leaks; structure-damage accounting on the attacker's side of applyDamage events)
- Extend: `scripts/depot-test.mjs`
- [ ] **Step 1:** Failing asserts: scripted 3-wave run — attacker scrap grows by stipend+results per the fixture's dealt damage; a killed conscript decrements reg.heads permanently; a massacred wave yields a measurably poorer next wave than a leaked-through wave (the consequence loop, asserted).
- [ ] **Step 2:** verify fail → **Step 3:** implement → **Step 4:** `node scripts/depot-test.mjs && npm run lint:depot && npm run build` → **Step 5:** Commit "DEPOT: the attacker spends what it earns — economy wired into the loop".

### Task 5: intel.js — the bureau reports

**Files:**
- Create: `src/depot/intel.js`; modify `src/depot/state.js` (makeDispatch consumes intel lines), extend `scripts/depot-test.mjs`

**Interfaces:**

```js
// src/depot/intel.js — real AI state -> bureau prose. One wave old. Never lies; sometimes silent.
// strengthWord: 1-3 "a handful", 4-8 "a squad's worth", 9-15 "in number", 16+ "company strength"
export function composeIntel(prevPlan, reg, rng) {
  // returns string[] (0-3 lines). Seeded gap: each candidate line has a 25% silence chance (1 draw each).
  // Line families (exact copy in the module, workshopped not placeholder):
  //   armor loaded -> "Rail offload observed after dark. Engine noise, {strength}."
  //   surge loaded -> "Muster fires counted beyond the ridge. {Strength} under canvas."
  //   banking      -> "Enemy expenditure below establishment. Purpose unassessed."
  //   regiment low -> "Deserter interview: companies filing understrength."
  //   sappers      -> "Stores manifest intercepted: fuse wire, satchel canvas."
}
export function openingIntel(reg) { /* strength hint for the run's first dispatch: "understrength"/"establishment"/"reinforced" */ }
```

- [ ] **Step 1:** Failing asserts: armor plan → armor line present (given no-gap rng); gap rng → line absent, NEVER altered; one-wave delay (intel at wave n reflects plan n, shown at stall n → build n+1); strength-word boundaries; no digits in any emitted line (regex — the no-counts rule, mechanically enforced).
- [ ] **Step 2:** verify fail → **Step 3:** implement (this is a WRITING task as much as code — lines in bureau voice, drafted with care per Jeff's "do not short me here") → **Step 4:** `node scripts/depot-test.mjs && npm run lint:depot` → **Step 5:** Commit "DEPOT intel: strength-words, one wave old, silences but never lies".

### Task 6: victory — regiment break + real ledger

**Files:**
- Modify: `src/depot/state.js` (checkWin: real bookValue comparison replaces enemyLedger stub; combatIneffective ends the run early with its own end card copy; regimentDestroyed hook goes live), extend `scripts/depot-test.mjs`
- [ ] **Step 1:** Failing asserts: forced regiment-break mid-run → WIN with attrition end card; wave-50 with fixture ledgers → correct verdict both directions; end cards carry no digits from the enemy ledger (book-value verdict expressed in bureau words: "the field remains in Bureau hands" / "the position is judged untenable").
- [ ] **Step 2:** verify fail → **Step 3:** implement → **Step 4:** `node scripts/depot-test.mjs && npm run lint:depot` → **Step 5:** Commit "DEPOT victory: the regiment can break; turn 50 audits the books".

### Task 7: balance probe + gates + prod

**Files:**
- Create: `scripts/economy-probe.mjs` (50-wave sims × 20 seeds × 3 canned defense qualities (none/median/strong scripted builds): report waves survived, regiment remaining, both ledgers, verdicts; SANITY: strong defense breaks regiments sometimes, none never survives to 50, median reaches late waves — tune STIPEND/RESULTS/waveBudget until true, record finals in report AND plan)
- Modify: `.github/workflows/deploy.yml` (nothing new needed — test:depot already gated; confirm), `scripts/smoke.mjs` depot section (intel dispatch shows a strength-word line; rotated re-read check)
- [x] **Step 1:** probe + tune → **Step 2:** `SMOKE_ONLY=depot node scripts/smoke.mjs` local → **Step 3:** commit, push, `gh` watch CI to success, prod `SMOKE_ONLY=depot` ALL PASS → **Step 4:** final report with probe matrix + Jeff playtest request (the arms-race feel: uncapped tower pay + equal aim is the hard variant by choice — flag any death-spiral observations).

**Finalized numbers (probe run: 20 seeds none/median, 20 seeds strong — full matrix and sweep detail in `.superpowers/sdd/2026-08-10-depot-phase-3/task-7-report.md`):**
- `STIPEND` stays at **14** — every value tried above it (17/23/26/32) tipped `median`'s ledger to all-WIN, failing the "mixed verdicts" sanity check.
- `RESULTS` rates unchanged from Task 1's proposal.
- `waveBudget`'s curve unchanged (`20 + 100*(w/50)^0.85 + max(0,w-50)*0.6`) — raising its ceiling alone had no measurable effect (spend is scrap-constrained, not budget-target-constrained).
- One targeted `ai.js` addition: a fully-saturated wall-pressure signal (`sig.wall >= 0.999`, only reachable by a heavily walled build like `strong`'s 12-wall plan) now erupts banked scrap immediately rather than waiting for the 2.2x surge threshold. Bank/surge/tankPush thresholds themselves are unchanged (pinned by `depot-test.mjs` fixtures).
- Measured: `none` dies wave 1-2 every seed (20/20). `median` reaches wave 50 every seed with a real WIN/LOSS ledger mix (15/20 WIN, 5/20 LOSS). `strong` reaches wave 50 every seed, tanks always driven to 0, but the literal attrition flag (heads<12% AND tanks=0) never fires (0/20) — see the report for why this is structural under the "depletion only at muster" contract, not an undertuned constant, and the recommendation for a follow-up if Jeff wants the literal flag to fire more often.
- Also fixed in this pass: `playerBookValue`/`buildSnapshot` no longer value rocket towers at gun cost (Task 6 deferred item).

---

## Self-review notes

- Every locked decision from the vision doc has a task: regiment (1), uncapped results (1/4), fixed brain + two banking flavors (3), intel truth model (5), book-value ledger (6), equal aim (2).
- No core.js changes planned; if one emerges, the plan says STOP.
- Multiplayer shape preserved: all attacker decisions are wave-start data (planWave output is literally the future decision packet).
- Intel copy is flagged as a writing deliverable, not filler.
- Numbers (STIPEND 14, RESULTS rates, budget curve) are proposals; Task 7's probe finalizes them.
