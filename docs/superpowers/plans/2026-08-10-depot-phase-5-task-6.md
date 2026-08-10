# DEPOT Phase 5 Task 6 — Wave Timeout (code-bearing plan)

> **For agentic workers:** superpowers:subagent-driven-development. Single implementer (state.js + DepotGame.jsx + economy touch). Commit + PUSH when green (Jeff live-tests). Iteration budget: 3 cycles, then BLOCKED.

**Goal (Jeff, locked):** waves end by annihilation OR the clock — a stuck straggler must never wedge the run. At timeout, survivors *withdraw in order*: no deaths, no bounties, their manpower returns to the regiment, and the stall card says so.

## Global Constraints
- Files: `src/depot/state.js`, `src/depot/DepotGame.jsx`, `src/depot/economy.js` (only if a return helper fits there), `scripts/depot-test.mjs`, smoke.
- Withdrawal must produce NO kill events, NO bounty, NO smears, NO leak damage — bodies leave the world silently (the leak-removal pattern at DepotGame.jsx:1262 is the reference for clean removal; read how leaked bodies exit and mirror it minus the lives cost).
- Muster-accounting law: planWave depleted heads/tanks at buy; withdrawal RETURNS reg.heads += survivingInfantry, reg.tanks += survivingTanks (they didn't die — the books stay honest).
- Spent-counter law (learned interaction): a withdrawn wave FIELDED troops — it must never increment the starved streak (ws.fielded already exists from the misfire fix at state.js:654 — assert the interaction, don't re-derive it).
- Dispatch line truthfulness: the withdrawal line appears ONLY when ≥1 unit actually withdrew; digit-free.
- No Math.random; the timeout uses world-time, never wall clock.
- Commit trailer: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

---

### The implementation

**state.js — wave clock + timeout check (in/next to tryStall, state.js:692):**

```js
export const WAVE_TIMEOUT = 75;   // s after spawning completes; Task 7 probe may tune

// startWave already drives spawning via spawnRR; the wave state records when
// the last queued unit left the spawner:
//   ws.spawnDoneT = world.t   (set by the spawn driver when the queue empties —
//                              find the actual spawn-completion point in
//                              DepotGame's spawn section and stamp it there)

// tryStall gains the OR-clause:
export function tryStall(S, WAVES, liveEnemies, rng = null, world = null) {
  const timedOut = world && S.ws.spawnDoneT != null &&
                   (world.t - S.ws.spawnDoneT) > WAVE_TIMEOUT;
  if (liveEnemies > 0 && !timedOut) return false;
  if (liveEnemies > 0 && timedOut) S.ws.withdrawPending = true;  // DepotGame executes it
  // ... existing stall flow; the stall card composer appends the withdrawal
  // line when S.ws.withdrew > 0:
  //   "Contact broken off. The remainder withdrew in order."
}
```

**DepotGame.jsx — executing the withdrawal (loop, where tryStall is consulted):**

```js
// When ws.withdrawPending: sweep live team-2 bodies (unit|vehicle), count
// infantry/tanks, remove them via the leak-removal mechanics MINUS the lives
// cost and MINUS the leak results event: no kill event, no bounty (the _paid
// guard never fires because there is no death), no smear. Then:
//   reg.heads += withdrawnInfantry; reg.tanks += withdrawnTanks;
//   ws.withdrew = withdrawnInfantry + withdrawnTanks; ws.withdrawPending = false;
// Squad members are team-1 — structurally untouchable by the sweep (assert anyway).
```

**Interaction guards (each asserted):** off-grid write-off (12s) still runs mid-wave — a withdrawn wave returns only ACTUALLY-alive bodies; the spent-offensive starved streak reads ws.fielded, unaffected by withdrawal; territory decay handles the sudden emitter loss naturally (no special-casing — the red field fades at τ).

### Steps
- [ ] **1. Failing asserts** (scripts/depot-test.mjs): (a) immortal-straggler fixture (hp 1e9 conscript parked off-path) → stall fires at spawnDoneT+75±dt, not before; (b) survivor count returns exactly (reg.heads delta == live infantry at timeout; tanks likewise); (c) zero bounty paid, zero kill events, zero leak damage during withdrawal; (d) annihilation before 75s stalls immediately (existing asserts untouched); (e) withdrawal line present when withdrew>0, ABSENT on annihilated waves (truthfulness both ways), digit-free; (f) starved streak unaffected by a withdrawn (fielded) wave; (g) team-1 squad members never swept; (h) twin determinism through a timeout wave.
- [ ] **2.** verify fail → **3.** implement → **4.** `node scripts/depot-test.mjs && npm run lint:depot && npm run build && SMOKE_ONLY=depot node scripts/smoke.mjs` (smoke: force a timeout via debug straggler hook if cheap — else headless-only coverage, say so) → **5.** Commit "DEPOT: waves end by annihilation or the clock — nobody wedges the war" → PUSH, foreground CI poll (until-loop, NEVER background waits), prod SMOKE_ONLY=depot ALL PASS.

---
## Self-review notes
- The timeout clock starts at spawn-completion (not wave start): a slow, long wave gets its full assault window; only the aftermath is clamped.
- Withdrawal reuses leak-removal mechanics rather than inventing a despawn path — one body-exit pattern in the codebase.
- WAVE_TIMEOUT=75 is Task 7 probe-tunable; rule (e) there (withdrawals < 20% of waves) treats heavy withdrawal as a stuck-unit bug signal, not a dial.
- Sequencing: runs AFTER Task 4 lands (both touch units-adjacent flow; and 4's firefights change how often stragglers survive to timeout).
