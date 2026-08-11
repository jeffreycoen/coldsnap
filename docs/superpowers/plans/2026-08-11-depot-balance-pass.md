# DEPOT Balance Pass — Measure, Tune, Verify (for Jeff's approval; no code until approved)

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
- [ ] Gates: probe completes; matrix recorded in report + this plan; depot-test/lint/build green (probe-only changes).
- [ ] Commit "DEPOT balance: the probe learns today's game — baseline matrix recorded" → PUSH + report with the matrix.

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
