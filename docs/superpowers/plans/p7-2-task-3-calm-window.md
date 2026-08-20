# P7.2 Task 3 — The Calm Window (mk1.82)

**Suggested model: Sonnet** (interface + one sim gate, fully specced).
**Scope (the owner's three convoy rulings, 2026-08-20):** (1) THE WAR PAUSES while the hand's window is up — clock, prices, combat, everything; LATER or buying out the hand resumes it. (2) THE BAR STARTS EMPTY — the free rifles and engineer plans die; every build option is bought off the hand; the dealt four still open the war; the plans pool grows to fifteen. (3) The dealt hand's start placements and the hire's placement gain the ✓/✗ CONFIRM GHOST — a tap sets the ghost, another ground tap MOVES it, ✓ fields it (refusal keeps the ghost), ✗ cancels (a cancelled hire's card returns to the hand). Bar builds already confirm and are untouched.
**Ships phone AND desktop:** taps and clicks through the existing pending ✓/✗ idiom; no new binding.

## Required reading (verified against the mk1.81 tree; re-verify at dispatch)

- `src/depot/DepotGame.jsx` — the frame loop's sim gate (the one line `const sdt = S.paused || !S.started || cardUp ? 0 : dt * S.speed;` and the `cardUp` const above it), clearPending/confirmPending (~1481–1513), placePick (~1551–1595), placeHire and S.armHire/S.cancelHire (the Task 2 block after S.pickManifest), tapAt's three opening branches (the pre-start `_placeQueue` branch, the started guard, the `S.hirePlace` branch), the hud tick's `pending:` mapping, the ✓/✗ button JSX (`data-pending-confirm`, the `✓ ◆` label).
- `src/depot/state.js` — 77–80 (pendingArmed), HUD0 (unlocked seeds PLAYER_START).
- `src/depot/specs.js` — PLAYER_START (line ~164) and the comment above it.
- Tests: `scripts/tests/11-hiring-hall.mjs` whole; `01-engine-era.mjs` the hand block (the re-taught 109–193 region) — the start-kit and pool-count pins; `03-bell-polish.mjs` ~330–340 (the mk0.60/2 PLAYER_START pins); `scripts/smoke.mjs` 210–255 (read-only — its depot section starts via `__DEPOTSTART__` and never builds, so the bare bar cannot break it).

## The design, plainly

1. **The pause is one gate.** Every clock in the war feeds on `sdt` — the bell, income, the market's repricing, the territory tick, the sim bracket. A `convoyUp` flag joins the existing gate, so the whole freeze is one condition; prices freeze for free because `_marketAcc` stops. The frame that RINGS the bell computes its `sdt` before the ring — one frame of war after the toll, invisible, accepted. Re-opening the hand from the chip re-pauses; that is a free tactical pause and the owner's ruling accepts it.
2. **The bare bar is one constant.** `PLAYER_START` empties; `makeManifestState` and `HUD0` seed from it and follow for free. The plans pool becomes the full fifteen. If neither engineer plan nor hire is bought, no lines can be laid — intended: every option is bought.
3. **The confirm ghost reuses `S.pending`.** Two new pending kinds — `{ deal }` pre-start, `{ hire }` mid-war — ride the existing ghost pad, ✓/✗ pair, off-screen auto-cancel, and arming law. The deal's ghost arms on the WALL clock (the sim is frozen pre-start — the T8 lesson, now a `wallArm` branch inside `pendingArmed` itself). ✓ commits through the real placers (`placePick`/`placeHire`), and a refusal (bad ground, too far, no scrap) keeps the ghost standing where it was. The hire's ✗ returns the card: `hirePlace` clears and the hand reopens. The deal's ✗ just lifts the ghost; the ticker still owns the flow.
4. **Untouched:** the draw contract (zero rng change), fireBell, bell.js, market.js, the manual, InfoCard, save.js, renderer, engine. Keystone and golden expected unmoved.

## Sweep license

Pre-computed re-teaches, count-neutral, each old → new in the report: 01's hand block start-kit and pool-count pins (Step 5), 03's PLAYER_START pin (Step 6), 11's own T2 fixtures (Step 7). Additionally: any pin over the exact `sdt` line, the ✓-label literal, or the two tap branches this task rewrites may be re-taught content-identical if the dispatch grep finds one the plan missed. Anything else red = honest stop.

## The steps

**Step 1 — the failing asserts.** Append to `scripts/tests/11-hiring-hall.mjs` (add `PLAYER_START` to its specs import and `pendingArmed` to its state import):

```js
// ---- P7.2 T3 (mk1.82): THE CALM WINDOW
{
  // (a) the bare bar
  ok("T3(a): PLAYER_START is empty — the bar starts bare (owner)", PLAYER_START.length === 0);
  ok("T3(a2): the fresh manifest owns nothing", makeManifestState().unlocked.length === 0);
  ok("T3(a3): the plans pool is the full fifteen",
    dealConvoyHand([], HAND_KEYS, mulberry32(9)).filter((c) => !c.hire).length === 3 &&
    HAND_KEYS.filter((k) => makeManifestState().unlocked.indexOf(k) < 0).length === 15);
  // (b) the pause — one gate, source-pinned (the loop is unimportable)
  {
    const src = fs.readFileSync("src/depot/DepotGame.jsx", "utf8");
    ok("T3(b): the convoy freezes the whole sim through the one gate",
      /const convoyUp = !!\(S\.manifest && S\.manifest\.cardUp\);/.test(src) &&
      /S\.paused \|\| !S\.started \|\| cardUp \|\| convoyUp \? 0 : dt \* S\.speed/.test(src));
  }
  // (c) the confirm ghost
  {
    const src = fs.readFileSync("src/depot/DepotGame.jsx", "utf8");
    ok("T3(c): a pre-start tap sets the ghost, never fields", /S\.pending = \{ deal: S\._placeQueue\[0\]/.test(src));
    ok("T3(c2): the deal ghost arms on the wall clock (the sim is frozen pre-start)",
      /wallArm: true, armedAtWall: performance\.now\(\) \/ 1000 \+ PENDING_ARM_S/.test(src));
    ok("T3(c3): a hire tap sets the ghost, never fields", /S\.pending = \{ hire: S\.hirePlace\.key/.test(src));
    ok("T3(c4): the ✓ fields through the real placers, and refusal keeps the ghost",
      /const n0 = S\._placeQueue\.length; placePick\(p\.wp\); if \(S\._placeQueue\.length !== n0\) S\.pending = null;/.test(src) &&
      /placeHire\(p\.wp\); if \(!S\.hirePlace\) S\.pending = null;/.test(src));
    ok("T3(c5): the ✗ returns a hire's card to the hand",
      /if \(S\.pending && S\.pending\.hire\) \{ S\.hirePlace = null; if \(S\.openManifest\) S\.openManifest\(\); \}/.test(src));
  }
  // (d) the wall-armed pending law, tested for real
  ok("T3(d): a wall-armed pending arms on real seconds, sim pendings on sim time",
    pendingArmed({ wallArm: true, armedAtWall: 0 }, -1) === true && pendingArmed({ armedAt: 5 }, 4) === false);
}
```

Ten checks. Run the suite — this block red, the 1496 unmoved.

**Step 2 — the bare bar.** `src/depot/specs.js`, PLAYER_START's line becomes:

```js
export const PLAYER_START = []; // P7.2 T3 (owner): THE BAR STARTS EMPTY — the free starting plans die; every build option is bought off the hand. Supersedes the mk0.60/mk1.12 starting kit.
```

**Step 3 — the arming law.** `src/depot/state.js`, `pendingArmed` (78–80) becomes:

```js
export function pendingArmed(pending, nowT) {
  if (!pending) return false;
  // P7.2 T3: a WALL-ARMED pending (the deal's confirm ghost — the sim
  // clock is frozen pre-start, the T8 lesson) arms on real seconds;
  // every other pending stays on sim time, byte-identical.
  if (pending.wallArm) return (typeof performance !== "undefined" ? performance.now() / 1000 : nowT) >= pending.armedAtWall;
  return nowT >= pending.armedAt;
}
```

**Step 4 — DepotGame.jsx.**
- (4a) The sim gate: the line `const sdt = S.paused || !S.started || cardUp ? 0 : dt * S.speed;` becomes:

```js
          // P7.2 T3 (owner): THE WAR PAUSES FOR THE CONVOY — the whole sim
          // freezes while the hand's window is up; LATER or buying out the
          // hand resumes it. Prices and the bell freeze for free: every
          // accumulator below feeds on sdt.
          const convoyUp = !!(S.manifest && S.manifest.cardUp);
          const sdt = S.paused || !S.started || cardUp || convoyUp ? 0 : dt * S.speed;
```
- (4b) `clearPending` becomes (the hire's ✗ returns the card):

```js
      const clearPending = () => {
        if (S.pending && S.pending.hire) { S.hirePlace = null; if (S.openManifest) S.openManifest(); }
        S.pending = null;
      };
```
- (4c) `confirmPending` gains the two branches, ABOVE the existing squad/build lines, with the keep-ghost-on-refusal detectors:

```js
      const confirmPending = () => {
        const p = S.pending;
        if (!pendingArmed(p, world.t)) { if (p) toast("HOLD — ARMING"); return; }
        // P7.2 T3: the confirm ghosts — ✓ runs the REAL placer; a refusal
        // (bad ground, too far, no scrap) leaves the ghost standing.
        if (p.deal) { const n0 = S._placeQueue.length; placePick(p.wp); if (S._placeQueue.length !== n0) S.pending = null; return; }
        if (p.hire) { placeHire(p.wp); if (!S.hirePlace) S.pending = null; return; }
        S.pending = null;
        if (p.squad) { placeSquadAt(p.gx, p.gz, p.squad); return; }
        buildAt(p.gx, p.gz, p.mode);
      };
```
(NOTE the ordering: `confirmPending` is defined before `placePick`/`placeHire` in the file — both are called only at tap time, long after mount, so the hoisting is safe; `placeHire` is a `const` declared later in the same closure, so move `confirmPending`'s DEFINITION to after `placeHire`'s if the reference errors — the suite's boot smoke catches it; report the move if made.)
- (4d) tapAt's pre-start branch body becomes:

```js
        if (!S.started && S._placeQueue && S._placeQueue.length) {
          if (S.infoKey) return; // P7.1 T8: the card is up — read it first (PLACE IT closes it)
          const p0 = groundPoint(cx, cy);
          // P7.2 T3 (owner): the tap sets or MOVES a confirm ghost — nothing
          // fields until the ✓. Wall-clock arming: the sim is frozen here.
          if (p0) S.pending = { deal: S._placeQueue[0], wp: { x: p0.x, z: p0.z }, y: field.heightAt(p0.x, p0.z), poly: null, ringR: 0, color: 0x4aff8c, cost: 0, wallArm: true, armedAtWall: performance.now() / 1000 + PENDING_ARM_S };
          return;
        }
```
- (4e) tapAt's hire branch body becomes:

```js
        if (S.hirePlace) {
          const ph = groundPoint(cx, cy);
          // P7.2 T3 (owner): the tap sets or MOVES the confirm ghost.
          if (ph) S.pending = { hire: S.hirePlace.key, wp: { x: ph.x, z: ph.z }, y: field.heightAt(ph.x, ph.z), poly: null, ringR: 0, color: 0x7dffa8, cost: priceNow(S.hirePlace.key, (PALETTE_BY_KEY[S.hirePlace.key] || { cost: 10 }).cost), armedAt: world.t + PENDING_ARM_S };
          return;
        }
```
- (4f) The ✓ button's label handles the free deal: `✓ ◆{hud.pending.cost}` becomes `{hud.pending.cost ? "✓ ◆" + hud.pending.cost : "✓ PLACE"}`.

**Step 5 — era-01 re-taught (licensed, count-neutral).** In the hand block: (a)'s first pin re-teaches to the bare bar (`M.unlocked.length === 0`, nothing free); (a3) 13 → 15; (b)'s pool counts 13 → 15 and 12 → 14; the "kit's own keys are never plans" pin re-teaches to its opposite — `pool().includes("sq_rifles") && pool().includes("sq_engineers")` ("rifles and engineers are plans like everything else now"); the 200-seed sweep's `["sq_rifles", "sq_engineers"]` argument becomes `[]`; block (e)'s `unlocked.length === 2` becomes `=== 0`. Each old → new in the report.

**Step 6 — era-03 re-taught (licensed).** The mk0.60/2 PLAYER_START pin becomes: `ok("mk0.60/2 (re-taught P7.2 T3): PLAYER_START is EMPTY — the bare bar; every option is bought off the hand", PLAYER_START.length === 0, PLAYER_START.join(","));` — its sibling (engineers not on PLAYER_TIERS) still holds and stays.

**Step 7 — era-11's own T2 fixtures re-taught (licensed, count-neutral).** T2(b)'s `dealConvoyHand(["sq_rifles", "sq_engineers"], ...)` fixtures become `dealConvoyHand(["mg", "gun"], ...)` with (b3) asserting `x.k !== "mg" && x.k !== "gun"` (the owned-key test keeps teeth); T2(d3)'s `unlocked.length === 2` becomes `=== 0`.

**Step 8 — the gates and the deploy.** Bump `src/version.js` to `mk1.82`. In order: `node scripts/depot-test.mjs` — expected **1506/0** (1496 + the 10 new checks; re-teaches count-neutral); `node scripts/depot-lint.mjs` clean; `npm run build` AFTER the bump; smoke (leave the stale 4173 preview alone; preview on 4174 with SMOKE_URL) — all green at mk1.82; keystone 843448507 / 749 unmoved. Gates green → commit `the calm window (mk1.82)` → push.

## Trap notes

- The `cardUp` const in the frame loop is the END card — the new flag is named `convoyUp`; do not merge them.
- `pendingArmed`'s sim-time path must stay byte-identical — every existing pending (towers, squads, lines) rides it.
- The pre-start tap branch's `if (S.infoKey) return;` first line is pinned by era-10 (T8) — keep it verbatim.
- `canvasTapConsumesPending` never sees deal/hire taps (both branches return before it) — do not add cases to it.
- placePick still vets the homeland radius and advances the queue itself; placeHire still vets held ground and clears `S.hirePlace` on success — the ✓ detectors in Step 4c rely on exactly those behaviors; do not restructure the placers.
- smoke's depot section starts via `__DEPOTSTART__` and never builds or places — the bare bar and the ghost cannot break it.
- No edits to fireBell, bell.js, market.js, InfoCard.jsx, FieldManual.jsx, save.js, muster.js, renderer, or engine.

## The owner's live check (phone AND desktop)

- The bell rings, the hand opens — the countdown, the fighting, and every price hold still; LATER resumes all three at once; the chip re-opens and re-freezes.
- A fresh war's build bar is bare — BUILD shows nothing until a plan is bought.
- Placing a dealt unit: the tap drops a ghost with ✓ PLACE / ✗; tapping other ground slides the ghost; ✓ fields it.
- A hire's tap does the same with its price on the ✓; ✗ hands the card back to the hand.

## Report requirements

Fixture seeds named (9 is the one new seed). Every re-teach old → new, each its own bullet. Deviations labeled (the possible confirmPending definition move in Step 4c, if made, is a named deviation). The suite count to the digit.

## AMENDMENT 1 (after the agent's honest stop at gate 1 — the defect is the plan-writer's)

Steps 1–7 landed clean; the suite sits at 1505/1506 with ONE red the plan's sweep missed: `scripts/tests/07-armor-demolition.mjs:873`, T7(f) — the pool pin Task 2's own re-teach set to "thirteen plans at bell one," which the bare bar legitimately moves to fifteen. The plan-writer re-taught that pin one task ago and failed to carry it into this task's sweep.

**The correction:** `07-armor-demolition.mjs` joins the touchable list for exactly this one re-teach — T7(f) becomes:

```js
    ok("T7(f): the ungated plans pool at bell one is fifteen — the bare bar (re-taught P7.2 T3), runners and breakers included", (() => { const p = HAND_KEYS.filter((k) => makeManifestState().unlocked.indexOf(k) < 0); return p.length === 15 && p.includes("sq_runners") && p.includes("sq_breakers"); })());
```

Count-neutral, content follows the ruled bare bar. Nothing else changes; Step 8 proceeds against 1506/0.
