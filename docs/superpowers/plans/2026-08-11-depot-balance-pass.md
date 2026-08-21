# DEPOT Balance Pass — Measure, Tune, Verify (for Jeff's approval; no code until approved)

*HISTORY (stamped 2026-08-20, owner's order): this document is a record of shipped work, not authority. Design truth lives in CLAUDE.md and the ACTIVE phase's plan documents; where this file disagrees with them, it is wrong.*

> **For agentic workers:** superpowers:subagent-driven-development, tasks in order, one implementer at a time. Failing/sanity gates before tuning, measurements before every change, numbers recorded in the report AND back into this plan. Commit + PUSH per task, FOREGROUND CI polls. Iteration budget 3 cycles/task then BLOCKED. Reports to Jeff: plain language, every nonconformity its own labeled bullet.

**Goal:** Re-tune the game's difficulty and prices against everything shipped since the last tune (fire discipline fix, infantry, wave timeout, armor wiring, sleep fix, honest sightlines, absolute cover, the sniper/spotter pair). This is the phase 5 closer that never ran, widened to cover the physics changes since.

**Why now:** the last probe tune predates: CAREFUL towers actually holding depot-fouling shots (fires less), masonry/trees blocking aim (fires less), no pass-through rounds (cover much stronger for BOTH sides), snipers shooting downslope (fires more), squads that actually arrive (player infantry stronger), and the pair (45 scrap, spotter unarmed). Net direction unknown — measure first, no assumptions.

## The sanity rules (from phase 3/5, carried + extended)
A tuned game must satisfy ALL, across 20 seeds per tier (none/median/strong scripted defenses):
- (a) A strong defense breaks the offensive (attrition, ledger, or spent) in ≥30% of seeds.
- (b) No defense never survives past wave ~2.
- (c) A median defense reaches the low-20s average wave with a genuine mix of win and loss verdicts.
- (d) Zero spurious depot-breach losses.
- (e) Withdrawals (wave timeouts) in < 20% of waves — more reads as stuck units, a bug signal not a dial.
- (f) No empty waves while the attacker is solvent.
- (g) NEW: the pair earns its keep — a median defense WITH one sniper pair measurably outperforms the same defense with 45 scrap of extra walls/towers in at least some seeds, and never strictly dominates (trap-vs-dominant check).

## Global Constraints
- Frozen modes + core.js untouched. No `Math.random()` in src/depot. Rng contracts exact.
- Tuning levers, in priority order: early waveBudget ramp (waves 1-8), player start scrap/stipend, spec prices (all provisional by standing decision), enemy counter-weights. NEVER: fire-discipline default, accuracy values (rockets stay held), results-pay rates before consulting Jeff.
- Every change: measure before, change one lever, re-run, record. No blind multi-lever sweeps.
- The probe is `scripts/economy-probe.mjs` — update its scripted defense plans to today's game first (Task 1), or its verdicts are fiction.
- Commit trailer: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

---

### Task 1: make the probe honest again

**Files:** `scripts/economy-probe.mjs`, `scripts/depot-test.mjs` (probe-harness pins only).

- Update the probe's three scripted defense tiers to the current game: build costs, the pair (median tier gains one sniper pair — it's now a normal purchase), sandbags, squads that actually march (sleep fix changes probe pathing assumptions), CAREFUL default ON as shipped.
- Verify the probe still runs headless within its time budget (the pair's placement solvers run at placement only — assert no per-tick cost).
- Baseline run: 20 seeds × 3 tiers, NO tuning — record the full matrix (waves survived, verdicts, withdrawal rate, breach count, regiment remainder) as the before picture.
- [x] Gates: probe completes; matrix recorded in report + this plan; depot-test/lint/build green (probe-only changes).
- [x] Commit "DEPOT balance: the probe learns today's game — baseline matrix recorded" → PUSH + report with the matrix.

#### Task 1 baseline matrix (recorded 2026-08-11, 20 seeds/cell, NO tuning)

Probe refreshed to today's game: sandbags (3), the pair (45, 2-man, spotter unarmed) via real makeSquad/stepSquad/squadFire, CAREFUL default, wave-timeout clock + executeWithdrawal (exact shipped sequence), stall gate counts infantry only (mirrors DepotGame.jsx), tank-escape workaround no longer charges a life (shipped game charges none). `median-alt` = median with the pair's 45 scrap in 3 mg towers instead (rule (g) comparator, now a default probe cell).

| tier | avg wave | verdicts | withdrawal rate | breach LOSSes | regiment remainder (avg) |
|---|---|---|---|---|---|
| none | 1.0 | 20/20 LOSS (overrun), all wave 1 | 0/40 (0%) | 0 | ~357 heads, ~10 tanks, ~13 scrap |
| median (pair) | 50.0 | 20/20 WIN (ledger) | 102/1000 (10.2%) | 0 | ~147 heads, ~10 tanks, ~10 scrap |
| strong | 50.0 | 2/20 WIN (ledger), 18/20 LOSS (ledger) — every seed survives all 50 waves with 8-10 lives | 345/1000 (34.5%) | 0 | ~144 heads, ~1.7 tanks, ~19 scrap |
| median-alt (g) | 46.1 | 20/20 WIN (11 ledger, 9 attrition) | 371/922 (40.2%) | 0 | ~55 heads, ~0.3 tanks, ~30 scrap |

Sanity rules: (a) FAIL 10% (2/20; threshold 30%) — (b) PASS max wave 1 — (c) FAIL max wave 50 but verdicts all WIN, no mix — (d) PASS 0 spurious/0 total — (e) FAIL 27.6% pooled (818/2962; median alone 10.2% passes, strong 34.5% and median-alt 40.2% blow it) — (f) PASS 0 empty-solvent waves — (g) PASS by letter (pair better 9/20, alt >= pair 11/20) but see caveat: median-alt out-attrites the pair badly (9 attrition WINs and ~55 heads left vs 0 and ~147).

Headline oddities for Task 2: strong LOSES on the ledger while never being overrun (its book value grinds to ~250 vs regiment ~650 — the fortress survives but bankrupts itself; pre-absolute-cover this plan went 20/20 WIN); median never loses (no verdict mix at all); withdrawals over the line for strong/median-alt (attackers time out against standing defenses rather than dying); probe runtime now ~24 min for the full sweep (old 10-seed auto-degrade guard retired — it would have corrupted the matrix).

### Task 2: read the baseline with Jeff — STOP POINT

No code. Present the baseline matrix against the sanity rules: which pass, which fail, by how much. Jeff decides which levers to move and roughly where (the plan's lever priority is the default). Nothing tunes without his read. If the baseline already satisfies (a)-(g): report that and stop — the pass closes with zero changes.

### Task 3: tune to the rules

**Files:** `src/depot/ai.js` (waveBudget ramp), `src/depot/specs.js` / `src/depot/squads.js` (prices, only those Jeff approved), `src/depot/state.js` (stipend/start scrap constants if approved), `scripts/economy-probe.mjs` (record), `scripts/depot-test.mjs` (pin any changed constant).

- One lever at a time: change → 20-seed re-run → record delta → keep or revert. Repeat until (a)-(g) hold or a lever conflict emerges (report BLOCKED with the tradeoff, Jeff picks).
- Every final number pinned by an assert and written back into this plan.
- [ ] Gates: full suite + probe matrix satisfying (a)-(g) recorded.
- [ ] Commit "DEPOT balance: tuned to the sanity rules — final numbers recorded" → PUSH + report: every changed number, before → after, and the final matrix.

### Task 4: Jeff playtests — the real gate

The probe is scripted play; Jeff is the playtester. Report hands him: what changed, what should feel different (early waves gentler/harsher, pair value, cover strength), and what to watch for (death spirals, boring middles, wave timeouts). His verdict either closes the pass or reopens Task 3 with his observations as the new targets.

---

## Self-review notes
- Two hard stop points (Tasks 2 and 4) — measurement and playtest both gate tuning; nothing moves on momentum.
- Rule (g) is new and deliberately weak ("at least some seeds") — the pair is fresh; a strict dominance rule would tune the fun out before Jeff has played it.
- Rockets stay held and untouched; their retune joins a later pass or their own task.
- The probe models scripted builds, not human play — its verdicts bound the tune, Jeff's hands finish it.
