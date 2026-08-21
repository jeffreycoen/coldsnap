# Sapper Siege Fix (code-bearing; for Jeff's approval; no code until approved)

*HISTORY (stamped 2026-08-20, owner's order): this document is a record of shipped work, not authority. Design truth lives in CLAUDE.md and the ACTIVE phase's plan documents; where this file disagrees with them, it is wrong.*

> **For agentic workers:** ONE Opus 5 implementer, one task, one commit (next mk bump at dispatch time). Failing asserts FIRST. SCOPED verification only. FOREGROUND everything. Max 3 cycles then BLOCKED. Report plainly, every deviation its own labeled bullet, and INCLUDE the "files read before first edit" list.

**Jeff's directives (2026-08-11):**
1. Satchel explosions TWICE as powerful.
2. SHOW the explosion — the detonation must be visibly unmistakable.
3. Sappers walk past rubble — plant only on the standing structure.
4. Sappers get as close as possible to the target before planting.

**Context from the diagnosis (scripts/diag-sapper-breach.mjs, on disk):** 20 massed teams plateaued at 0.751 standing (never breached, line 0.58): ~30/34 surviving charges wasted on rubble; carriers fratricided at one wall face; stones nudged <1.2m count as standing. Sequential teams breach at ~11. These directives attack the waste and power channels; the census/threshold stays untouched (Jeff's set).

## The changes

**A — twice the power (specs.js):**

```js
// SATCHEL — Jeff 2026-08-11: doubled. Force AND damage double; radius stays
// (reach is a separate dial he didn't move). // provisional (F5)
export const SATCHEL = { r: 5, kv: 90, dmg: 300, crater: 0.6, hitStruct: true };
```
- kv 45→90, dmg 150→300, r unchanged. KNOWN CONSEQUENCES to re-measure and report (not tune): the mk0.17 Pin A wall-damage band WILL break — re-measure --sides, update the pin band and the recorded table (a declared re-pin, not drift); infantry lethal radius grows; the earlier sweep showed {r:8, kv:90} flattens a depot in ONE team — {r:5, kv:90} sits below that but expect teams-to-breach to drop hard; enemy sappers hit YOUR walls/depot with the same doubled charge (symmetry — state the new threat numbers plainly).

**B — the explosion shows (renderer.js, DEPOT-gated):** verify what a satchel detonation currently emits (core.js explode pushes the standard "boom" event — READ the event shape and the renderer's boom consumer). Requirement: a satchel blast must read as a DEMOLITION, distinct from shell hits — bigger flash/smoke column using the existing instanced pools scaled by a satchel tag (e.g. explode opts carry `big: true` → event field → renderer scales the existing effect; NO new pools, NO core changes if the event already carries r — scale by radius). If the event lacks the needed field and core.js would need a change: STOP, report BLOCKED (core is frozen; there may be a depot-side path — the detonation site is squads.js/units.js, which can push a parallel cosmetic event).

**C — walk past rubble (squads.js + units.js, symmetric):**

```js
// stepSapperCharges target filter — STANDING masonry only: the stone must
// still be near its recorded home (the census's own rule). Rubble is a
// corpse; sappers assault the building.
// standingStone(b): b.alive && b.gpos-home check via the census map the mode
// already builds (thread depotCensus/depotCensus2 home positions in — or
// recompute home from b.town lattice origin; pick at read time, document).
// Enemy stepSapper gets the IDENTICAL filter (symmetry law).
```

**D — as close as possible (squads.js + units.js, symmetric):** plant trigger tightens from `hx + 1.3` to CONTACT range (`hx + 0.55` — half a body past the stone's face; read clearSlot's pad so pathing can actually reach it, and verify seekGoal's steer-around doesn't orbit at that radius — the diag script's approach traces show where they stop). Closer plant = more force on the wall (the physics reason the old distance under-delivered). Same constant both sides, one export.

## Atomic steps
- [ ] **1 — failing asserts** (scoped block in depot-test): satchel spec pin {kv:90, dmg:300}; sapper ignores a rubble stone (displaced 3m) and walks to standing wall (fails today — plants on rubble); plant distance ≤ the new contact constant (fails today at 1.3); detonation event carries the demolition/size marker (fails today); enemy sapper mirrors all three (spec/filter/distance pins); zero new rng draws; twin determinism.
- [ ] **2 —** verify fail. **3 —** implement A-D. **4 — re-measure, foreground:** measure-satchel --sides (new table → plan doc + mk0.17 Pin A band updated, declared); massed-20-team and sequential teams-to-breach via the diag harness (both numbers in the report; if massed STILL never breaches, report it plainly — fratricide fix 3 was deliberately excluded and this is the evidence Jeff needs).
- [ ] **5 — scoped gates:** `node scripts/depot-test.mjs && npm run lint:depot && npm run build`, one `SMOKE_ONLY=depot node scripts/smoke.mjs` (renderer visible change; flake retry rule applies). **6 —** Commit "sappers: double the charge, spurn the rubble, hug the wall (mk<next>)" + MK bump → PUSH → FOREGROUND CI poll → report.

## What the agent needs for success (mandatory reading list — confirm in report)
- `src/depot/squads.js` — stepSapperCharges (plant gate, trigger distance), seekGoal/clearSlot (can a man physically reach contact range without steer-orbit), spawnSquadMembers.
- `src/depot/units.js` — enemy stepSapper (the mirror; byte-parity expectations from prior pins — the shared-constant spell may change, behavior pins re-measured).
- `src/depot/specs.js` — SATCHEL (the one shared constant; A edits here only).
- `src/depot/state.js` — censusDepotChunks/depotStandingFraction (the standing rule C reuses; DEPOT_STANDING_TOL), hostileStructure (the target set C filters).
- `src/engine/core.js` — explode() and its event emission (READ ONLY — what the boom event carries; core is FROZEN, any needed change = BLOCKED).
- `src/render/renderer.js` — the boom/explosion consumer and instanced pools (B's scaling point; DEPOT-gated pattern).
- `scripts/measure-satchel.mjs` + `scripts/diag-sapper-breach.mjs` — the measurement harnesses (extend, don't fork; the diag script has the massed/sequential/live run modes).
- `scripts/depot-test.mjs` — existing pins that WILL move: mk0.17 Pin A band, Task 4½ breach-through-play team count, enemy-sapper behavior fingerprints; every moved pin is a declared re-measure in the report.
- **Trap notes:** depot stones have NO hp — displacement/joint-break is the only demolition currency (walls DO have hp — dmg 300 one-shots them, was already one-shot at 150; state plainly); depot welds 120k, town 80k; rng contracts (satchel path draws zero); coordinate spaces (canonical vs world) irrelevant here but hover near territory code; the sleep/wake rule if touching movement.

## Re-measured after implementation (mk0.21, 2026-08-11) — measured, not tuned

**SATCHEL side-measurements** (`node scripts/measure-satchel.mjs --sides`), old
`{r:3.4, kv:9, dmg:150}` → shipped `{r:5, kv:90, dmg:300}`, chest-height charge:

| probe | 1m | 2m | 3m | 4m | 5m | 6m |
|---|---|---|---|---|---|---|
| WALL hp-damage (hp 100) | 113.6 → 246.9 | 79.5 → 197.2 | 44.8 → 146.7 | 10.1 → 96.0 | 0.0 → 45.3 | 0.0 → 0.0 |
| TOWER hp-damage (hp 130) | 118.0 → 251.8 | 88.1 → 206.7 | 57.7 → 160.8 | 27.2 → 114.9 | 0.0 → 68.8 | 0.0 → 22.7 |

- UNIT (hp 58): lethal radius **2.5m → 4.6m**; shove |v| at 0.5m **7.5 → 79.3 m/s**.
- OWN-TEAM SPLASH: planter always dies (unchanged). A friendly at 3m and at 4m
  now **dies too** (previously lived) — the fratricide channel WIDENED. Fixing
  fratricide was deliberately excluded from this task.
- mk0.17 Pin A band re-pinned in depot-test: satchel-vs-wall at 4m was 47
  (band 35–60), now **96.0** (band 80–115). Declared re-measure.

**Teams-to-breach** (real depot2 lattice, 233 stones, breach < 0.58 standing):

| measurement | before | after |
|---|---|---|
| sequential walk-in teams (`diag-sapper-breach.mjs quiet 20`) | ~11 | **3** |
| 20 teams massed at once (`diag-sapper-breach.mjs mass 20`) | NEVER (plateau 0.751) | **BREACHED at t=60s**, final 0.056 |
| depot-test F1/4.5i through-play | 9 | **2** |

The massed case now breaches — on **3** planted charges, all 3 on standing
masonry, **0** on rubble (was ~30 of 34 wasted on rubble). Fratricide is still
present (22 carriers lost to their own side's blasts before planting) and is now
worse per blast, but it no longer decides the outcome.
