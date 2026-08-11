# Rockets, the Contested-Ground Fix, and Two Small Repairs

---

# PART ONE — THE PLAIN VERSION (Jeff reads this)

**Four fixes, four deployments, in this order:**

1. **Rockets finally lob (mk0.25).** The rocket tower arcs its salvos over hills like it always claimed. Its aim wobble gets re-tuned by measurement so lobbed damage matches today's flat damage within 10%.
2. **Enemies at the front line stop being weapon-proof (mk0.26).** Your report, confirmed by reading the rules: a soldier standing on ground *his* side controls is invisible to your guns — even standing in plain sight at your line — because the targeting rule only allows shots into ground *you* hold. Where the two control zones butt against each other, each side's men are protected by their own zone. Exactly as you said: control can't be mutually exclusive for shooting. The fix: **contested ground is shootable ground** — anywhere within one zone-cell of the boundary counts as engageable by both sides. Deep behind their line stays dark (that's fog working); the front line becomes a real firefight.
   *Why not the full fix now:* the true rule you already picked — "you shoot what your side can see" — arrives with the vision phase. This is the smallest honest bridge until then, and it dies cleanly when vision lands.
3. **The confirm-button tap thefts (mk0.27).** Two cases where a tap silently vanishes: tapping ✓ before it's armed, and panning away from an open confirm. Both become visible/harmless.
4. **The coin-flip test gets fixed (mk0.28).** One browser check fails randomly on a quarter of runs and costs a retry every task. The agent must find *why* it flakes and fix the cause — papering over it with a longer wait is banned.

5. **MOVE and ATTACK become separate orders, and the buttons grow (mk0.29).** Today a squad has DEFEND and ATTACK, and ATTACK is both "go there" and "fight on the way." They separate: **MOVE** — travel fast, don't stop to fight (double-time the whole way, weapons quiet until you arrive); **ATTACK** — advance fighting, cover to cover, as today. And every order/confirm button gets visibly bigger — they're too small, especially under a thumb.

**What you'll playtest:** rockets arcing over ridges onto targets they could never reach; firefights at the front line where both sides can actually shoot each other; snappier build confirms; ordering squads to rush ground without picking fights, and buttons you can actually hit.

**Risk worth knowing:** fix 2 cuts both ways — *their* riflemen also get to shoot *your* men standing at the boundary. Symmetric, as everything.

---

# PART TWO — TECHNICAL BRIEF (agents; Jeff stops here)

> Opus 5, one implementer, four sequenced commits, each scoped-tested and pushed separately. Reading list verified against the tree at dispatch. Failing asserts first. FOREGROUND everything; 3 cycles then BLOCKED; deviations bulleted; "files read before first edit" in the report.

## T1 — rocket retune (mk0.25)
Per the approved artillery plan A1: sweep acc 0.020-0.035 lobbed, 20+ salvos/candidate vs the pinned soft fixture, target flat baseline 2.4592 ±10%; `towerShot` high for rocket; record curve into the artillery plan; close the 6.5 held-task STATUS. Reading: specs.js rocket, state.js towerShot (~:158), 6.5 plan STATUS block, depot-test rocket fixtures. Traps: acc cliff (0.340 lobbed = 0.00 measured); volley 4 @ 0.12s pinned; windF 1.3 exposure grows (intended). Gates: depot-test + test:accuracy + lint + build.

## T2 — contested ground is shootable (mk0.26)
**Root cause (verify by reading, then pin):** fieldReaches (state.js:25-28) blocks UNIT acquisition where fogStateFor reads "unheld" for the shooter's team. At zone boundaries the defender's own emission makes his ground "unheld" for the attacker and vice versa — mutual protection at contact. ("seam" band |v|<=0.15 already allows both; the bug is the hard edge just past it.)

```js
// territory.js — contestedReaches: the F1.6-bridge targeting read (DIES when
// vision B3 lands — marked for deletion there). A cell is engageable if the
// shooter's side reads it held/seam OR any of its 4-neighbors at cell pitch
// does — one cell of grace across the boundary, symmetric by construction.
export function fogStateForContested(T, x, z, team) {
  if (fogStateFor(T, x, z, team) !== "unheld") return "held";
  const cs = T.cs;
  if (fogStateFor(T, x + cs, z, team) !== "unheld" || fogStateFor(T, x - cs, z, team) !== "unheld" ||
      fogStateFor(T, x, z + cs, team) !== "unheld" || fogStateFor(T, x, z - cs, team) !== "unheld") return "seam";
  return "unheld";
}
```
- fieldReaches switches to it (one line — every unit-targeting consumer inherits: towers, squadFire, nearestPlayerUnit, sticky revalidation). RENDER fog untouched (display keeps the old read until vision).
- [ ] Failing asserts: the reported case — enemy on red ground one cell past the boundary, tower/squad in range with clear arc, acquisition SUCCEEDS (fails today); mirror for enemy shooters vs player men; two cells deep stays blocked (fog still real); seam behavior unchanged; deletion marker comment pinned (grep) so vision B3 can't forget it; twin determinism. Reading: territory.js (fogStateFor, cell math), state.js fieldReaches + every caller, units.js nearestPlayerUnit/unitTargetValid, DepotGame stepTowers. Traps: canonical coords (callers pass u,v already converted — the neighbor probe works in canonical space, cs = 2); do NOT touch structure fire (never gated — law).

## T3 — confirm-tap thefts (mk0.27)
Diagnosed lines (re-verify): confirmPending no-ops while unarmed (DepotGame ~:950) leaving pending set → next canvas tap silently consumed (~:1131); panning moves ✓/✗ offscreen → next ground tap cancels. Fix: unarmed ✓ tap is inert AND does not leave a swallow armed (the pending stays, the NEXT tap still opens/cancels normally — i.e. the canvas-tap pending-clear only fires when the pending's buttons are actually on-screen); pending auto-cancels (with toast) when its anchor leaves the viewport. Asserts headless where possible + one smoke tap-sequence. Reading: DepotGame tapAt/confirmPending/pendingScreen block, state.js pendingArmed/PENDING_ARM_S.

## T4 — kill the flake (mk0.28)
"rotated advance observed" fails ~1 in 4 clean runs. DIAGNOSE root cause first (timing? camera tween race? the known swiftshader load sensitivity? the smoke-race lessons in project memory: never raf-poll expensive predicates, always waitForFunction+polling) and fix the CAUSE — test or game, wherever it lives. A longer sleep is a banned fix. Report the mechanism. Reading: smoke.mjs depot rotated-advance section + the smoke-race lesson comments, DepotGame rotation/camera tween, prior flake notes in F1 Task 1's report (present on clean builds).

## T5 — MOVE order + bigger buttons (mk0.29)
- **MOVE order:** third chip (MOVE | ATTACK | DEFEND). MOVE = the existing double-time path unconditionally (squads.js attack branch already has the unthreatened straight-leg mode — force it regardless of threat) + members DO NOT fire en route (squadFire's stationary gate already blocks moving shooters; assert the leg-pause case too: a MOVE squad pauses only at arrival, so add `order === "move"` to squadFire's skip). On arrival → defend, same as attack's arrival. RNG CONTRACT: the double-time path already draws its one-per-leg unconditionally — MOVE reuses it exactly; stream identity pinned vs an attack order of equal legs.
- **Buttons grow:** the squad order chips, ✓/✗ confirm pair, and bottom build bar get a size pass — chips/confirm ~1.5x tap target (padding+font, min ~44px touch height), build-bar slots wider on touch. Render-only. One phone-framed screenshot for Jeff.
- [ ] Failing asserts: MOVE squad crosses a threatened field without firing (attack twin fires); draws identical between MOVE and unthreatened-ATTACK of equal path; arrival flips to defend; chips render 3 orders. Reading: squads.js stepSquad (attack branch, _threatened, leg draws), state.js squadFire stationary gate, DepotGame orderSquad/squadSel chip block + P styles, smoke squad-order taps (update selectors if labels change). Traps: the one-draw-per-leg contract; trailing-tap arming (~350ms) applies to the new chip; smoke taps must use data- attributes not label text.

Each task: bump MK, commit with trailers, push, FOREGROUND CI poll, report per practice.
