# P7.1 Task 8 — the seed purge and the dealt hand (mk1.72)

*HISTORY (stamped 2026-08-20, owner's order): this document is a record of shipped work, not authority. Design truth lives in CLAUDE.md and the ACTIVE phase's plan documents; where this file disagrees with them, it is wrong.*

Two phases, one task, one mark.

**PHASE A — THE SEED PURGE (owner, 2026-08-19: "remove this pollution now").** Seed 4242 leaves the test suite entirely. It seeded the T6 keystone, the engine-era suite's rng, two map-routing fixtures, one stream-carve fixture, and the T21 bell fixture's map. Every one re-seeds to an ordinary seed; measured pins re-measure and re-pin; thresholds are NEVER weakened — a candidate seed that fails a threshold is discarded for the next, exactly the T15 precedent (re-seed rather than weaken). **THE KEYSTONE RE-PIN IS OWNER-RATIFIED (2026-08-19): the engine law's anchor moves to a fresh seed; its hash and draw count re-measure and re-pin, reported old → new.** Phase A runs entirely under current (mk1.71) behavior, so every movement is isolated to the re-seeding.

**PHASE B — THE DEALT HAND (owner, 2026-08-19).** The starting pick dies: every war opens with FOUR RANDOMLY ASSIGNED units off the fifteen-type pool — four DISTINCT, BOTH sides (supersedes Task 6's duplicates-field-nothing clamp). The cards deal ONE AT A TIME: deal a card, read it, PLACE IT, tap the ground for that unit, next card — then TAKE COMMAND. Hand placement inside the homeland stays as Task 6 built it.

Suggested model: **Sonnet** — every edit is literal or a stated mechanical procedure; the boot arithmetic is pre-computed.

**GOING FORWARD (owner's standing order, added to CLAUDE.md with this task): every task report names the fixture seeds its tests ran — new pins and re-pins alike. No seed is ever special.**

## Phase A — the purge

Five sites carry the old seed. For each: swap the seed literal, run the suite, re-pin exact measured values old → new, hold every threshold. Where a candidate seed must satisfy thresholds, try candidates IN ORDER from the stated list and pin the FIRST that passes all of that fixture's existing asserts unchanged; report the chosen seed. Comments naming the old seed are reworded with the pin they sit beside.

**A1 — the keystone** (`scripts/tests/05-the-front.mjs:601-605`, `M6.makeMap(...)` + `makeWorld({... seed: ...})`): both literals become **1000**. Run; the T6 keystone assert prints the measured hash and draw count; pin them. License: hash `3465970890`-era pin `3465970090` → measured, draws `695` → measured, both reported old → new. No threshold exists here — any seed is lawful; the value is identity, not luck.

**A2 — the stream-carve fixture** (`scripts/tests/05-the-front.mjs:235-238`, T3(c)): candidates **1001, 1002, … 1010**, first whose map holds BOTH existing thresholds verbatim (mid-channel bed below the pinned line, causeway crown above it). The comment block naming the old seed rewords to the chosen one.

**A3 — the routing pair** (`scripts/tests/06-troops-physics.mjs:97` and `:116`, P6T1(b)/(c) — both blocks share one map): candidates **1001 … 1010**, first where every existing assert in both blocks passes unchanged (route exists, zero fouls, clamp inside its band).

**A4 — the engine-era rng** (`scripts/tests/01-engine-era.mjs:27`, `const rngS = mulberry32(4242)`): becomes **1001**. rngS feeds the two fireBell calls at `:39`/`:48`; any downstream literal pin that moves re-pins old → new. If a threshold-style assert there fails on 1001, candidates continue 1002 … 1010.

**A5 — the T21 bell fixture's map** (`scripts/tests/09-reorg.mjs:182`, `makeMap(...)`): becomes **1001**. Its asserts are floors and properties (two saves, ≥16 draws, a filled queue) — expected to hold; any failure is a STOP, not a re-pin.

**A6 — the checkpoint.** `node scripts/depot-test.mjs`: **1439 passed / 0 failed** — same count as today, values moved only where A1-A5 licensed. Then `grep -rn 4242 scripts/ src/` returns NOTHING (the decision record's historical lines stay — history is append-only; the codebase is what purges).

## Phase B — the dealt hand

### The draw arithmetic

- Boot draws 7 → 11 (regiment 2 + commander 1 + THE PLAYER'S HAND 4 + the mirror 4). The two fixtures calling `musterFreshStart` directly count 5 → **9**.
- Both hands draw through ONE helper, `dealHand` — the manifest's splice-draw shape (`drawOffers`, state.js:1118-1129): four draws always, the splice makes a collision impossible. Distinct and count-stable by construction.
- The boot fixtures re-seed with the purge: the 09-reorg T19 fixture to **seed 91**, the 10-command-refit T6v2 fixture to **seed 92** (two different seeds on purpose — two different opening shapes get exercised). Pre-computed under the new shape: seed 91 deals the mirror a gun tower, an mg team, breakers, and a sniper pair — **garrison 6**; seed 92 deals it three towers and an mg team — squad-light, and still fields bodies. Commander on both: a lawful profile (91 draws "bold").
- The KEYSTONE must NOT move in Phase B (its fixture never musters — proven at T6 and T7). Movement here is a defect, STOP.

### Stated lines

- The pick grid, the pick chips, the `picks` React state, and `togglePick` die. The overlay keeps the intro copy, TAKE COMMAND, and FIELD MANUAL.
- `S.hand` is drawn at boot in `musterFreshStart` and lives on S only. NEVER saved: a save is only written after the war starts, and a resumed war never deals.
- The hand draws BEFORE `musterFreshStart`'s early return, exactly as the mirror's draws do — bare fixtures still burn all nine draws.
- THE DEAL DOOR: the Task 4 info card gains a third door, `"deal"` — one button, PLACE IT, no price row, no cancel.
- THE FROZEN-CLOCK TRAP (found at plan-writing): the card's arming guard reads `world.t`, which is 0 and never advances before the war starts — a deal card armed on sim time would refuse PLACE IT forever. The deal door arms on the wall clock (`performance.now()/1000`, the toast queue's own clock). Manifest and bar doors keep sim-time arming.
- A ground tap never places while a card is up (`S.infoKey` guards the place branch).
- Phone AND desktop, by law: the whole flow is taps/clicks on the same buttons; PLACE IT carries the 44px minimum.
- The mirror's dead dedupe (`fielded` set) is removed — distinct draws cannot collide.
- Known and OUT OF SCOPE (pre-existing since mk1.68): the hold flag does not bind sapper or grenadier mirror men (units.js branch order), so a dealt sapper mirror pick marches at second zero instead of standing guard. Flagged for the owner's queue, untouched here.

### Required reading, in order

1. This plan, whole.
2. `src/depot/muster.js` — whole (dealHand lands beside PICK_POOL; the deal replaces the clamp draws at `:223-235`).
3. `src/depot/state.js:1118-1129` (drawOffers — the splice shape being mirrored).
4. `src/depot/DepotGame.jsx:782` (the picks state), `:1547-1588` (placePick), `:2123-2128` (tapAt's place branch), `:2386-2394` (openInfo/confirmInfo), `:3308` (the hud info line), `:3514-3539` (togglePick + startGame), `:4090-4130` (the start overlay), `:4137-4155` (the placing ticker).
5. `src/depot/InfoCard.jsx` — whole (the deal door lands in its button row).
6. `src/depot/infocards.js` — whole (cardFor supplies the dealt card's content).
7. `scripts/tests/05-the-front.mjs:230-240` and `:555-610` (the A1/A2 sites), `scripts/tests/06-troops-physics.mjs:90-130` (A3), `scripts/tests/01-engine-era.mjs:25-60` (A4).
8. `scripts/tests/09-reorg.mjs:60-85` (the T19 fixture — re-seeds and re-teaches) and `:180-216` (A5 + the T21 floor), `scripts/tests/10-command-refit.mjs:260-274` (the T6v2 fixture) and the file's tail (the T7 blocks — new asserts append after).

### The sweep license (Phase B)

- `scripts/tests/09-reorg.mjs` T19 block: the fixture re-seeds to **91**; `draws === 5` → `draws === 9`; T19(b3) `guard === 2` → `guard === 6`, its label rewritten plainly ("measured on seed 91"); the block's seed comments follow. Labels gain `(re-taught P7.1 T8)`.
- `scripts/tests/10-command-refit.mjs` T6v2 block: the fixture re-seeds to **92**; `draws === 5` → `draws === 9`; label gains `(re-taught P7.1 T8)`.
- Everything else stands: T19(a), T19(b2)/(b4)/(b5), T6v2's pool-of-fifteen and fielded-something asserts, every T7 pin, the Phase-A re-pinned keystone.
- Anything else failing: STOP.

### Steps

**Step 1 — muster.js: the hand is dealt.** Below `PICK_POOL`'s closing `];` add:

```js
// P7.1 T8 (owner): THE DEALT HAND — four DISTINCT picks off the pool, the
// manifest's splice-draw shape (drawOffers, state.js): four draws always,
// the splice makes a collision impossible. One helper, both armies.
export function dealHand(rng, pool) {
  const rest = pool.slice(), out = [];
  for (let d = 0; d < 4; d++) {
    const j = Math.min(rest.length - 1, Math.floor(rng() * rest.length));
    out.push(rest.splice(j, 1)[0]);
  }
  return out;
}
```

In `musterFreshStart`, replace (current `:223-227`):

```js
  // P7.1 T6 (owner): THE BARE OPENING — his four picks, the same fifteen-
  // type pool as the player's, deduped draw-then-clamp (all four draws
  // always burn; duplicates field nothing). Boot: exactly 7 draws, any seed.
  const mirrorPicks = [];
  for (let d = 0; d < 4; d++) mirrorPicks.push(PICK_POOL[Math.min(PICK_POOL.length - 1, Math.floor(world.rng() * PICK_POOL.length))]);
```

with:

```js
  // P7.1 T8 (owner): THE DEALT HAND — the player's four, then his four,
  // both DISTINCT off the same fifteen-type pool (supersedes T6's
  // duplicates-field-nothing clamp). Draws here: exactly 9, any seed
  // (commander 1 + hand 4 + mirror 4), all before the early return.
  S.hand = dealHand(world.rng, PICK_POOL.map((p) => p.key));
  const mirrorPicks = dealHand(world.rng, PICK_POOL.map((p) => p.key)).map((k) => PICK_POOL.find((p) => p.key === k));
```

and remove the dead dedupe — `const fielded = new Set();` (`:231`) and the loop's first two lines (`if (fielded.has(pick.key)) continue; // deduped like the player (owner)` / `fielded.add(pick.key);`).

**Step 2 — DepotGame.jsx: the deal flow.** Nine edits, literal:

- (a) `:782` — delete `const [picks, setPicks] = useState([]);`.
- (b) `:3514-3524` — delete the whole `togglePick` function.
- (c) `startGame` (`:3525`) — the first branch becomes the deal:

```js
    if (S.hand && S.hand.length && S._placeQueue == null) {
      // P7.1 T8: THE DEAL — the overlay steps aside; each dealt unit shows
      // its card first, then lands by a ground tap inside the homeland.
      S._placeQueue = S.hand.slice();
      if (S.openInfo) S.openInfo(S._placeQueue[0], "deal");
      setHud((h) => ({ ...h, placing: S._placeQueue[0] }));
      return;
    }
```

  (replacing the `if (picks.length > 0 && S._placeQueue == null) { ... }` branch; the `S._placeQueue = null;` start tail is untouched).
- (d) `placePick`'s tail (`:1584-1587`) — one inserted line after `const next = S._placeQueue[0];`:

```js
        if (next && S.openInfo) S.openInfo(next, "deal"); // P7.1 T8: the next card deals before its unit places
```

- (e) tapAt's place branch (`:2123`) — first line inside the block:

```js
          if (S.infoKey) return; // P7.1 T8: the card is up — read it first (PLACE IT closes it)
```

- (f) `S.openInfo` (`:2386`) gains the wall-clock arm (the frozen-clock trap):

```js
      S.openInfo = (key, door) => { S.infoKey = key; S.infoDoor = door; S.infoArmedAt = world.t + PENDING_ARM_S; S.infoArmedWall = performance.now() / 1000 + PENDING_ARM_S; };
```

  and `S.confirmInfo` becomes door-aware:

```js
      S.confirmInfo = () => {
        const armed = S.infoDoor === "deal" ? performance.now() / 1000 >= S.infoArmedWall : world.t >= S.infoArmedAt;
        if (!armed) { toast("HOLD — ARMING"); return; }
        const k = S.infoKey, door = S.infoDoor;
        S.closeInfo();
        if (k && door === "manifest") S.pickManifest(k);
        // P7.1 T8: the deal door just closes — the ground tap places next.
      };
```

- (g) the hud info line (`:3308`) arms the same way:

```js
              info: S.infoKey ? { key: S.infoKey, door: S.infoDoor, armed: S.infoDoor === "deal" ? performance.now() / 1000 >= S.infoArmedWall : world.t >= S.infoArmedAt } : null,
```

- (h) the overlay (`:4090-4130`): the "Pick up to four" line, the fifteen-tile grid (`data-pick`), and the picks-chips/`none picked` block are replaced by ONE line:

```jsx
          <div style={{ fontSize: 11, opacity: 0.85, maxWidth: 460, marginBottom: 10 }}>
            The convoy deals you four units — read each card, place each one by hand near your depot, then take command.
          </div>
```

  TAKE COMMAND and FIELD MANUAL stay verbatim.
- (i) the placing ticker (`:4137-4155`): `const n = Math.max(1, picks.length - remaining + 1);` → `const n = Math.max(1, 4 - remaining + 1);` and `({n} of {picks.length})` → `({n} of 4)`.
- The InfoCard render call (`hud.info` block): the price prop becomes deal-aware — `price={hud.info.door === "deal" ? null : (hud.prices?.[hud.info.key] ?? PALETTE_BY_KEY[hud.info.key]?.cost)}`.

**Step 3 — InfoCard.jsx: the third door.** The button row's ternary gains a middle branch (and the header comment's "two doors" becomes "three doors"):

```jsx
        ) : door === "deal" ? (
          <button data-info-place style={{ ...B, flex: 1, borderColor: "#4aff8c", color: "#4aff8c", opacity: armed ? 1 : 0.5 }} onClick={onConfirm}>PLACE IT</button>
        ) : (
```

**Step 4 — the licensed re-teaches** (the Phase B license list: both boot fixtures re-seed to 91/92, `draws` 5 → 9 twice, `guard` 2 → 6, labels and seed comments rewritten plainly).

**Step 5 — the internal checkpoint.** `node scripts/depot-test.mjs`: **1439 passed / 0 failed exactly.** Any other movement: STOP.

**Step 6 — the asserts.** Two additions:

(1) Inside the re-taught T6v2 block (`10-command-refit.mjs`, S6 in scope, after its last assert):

```js
  ok("T8: the player's hand is four distinct pool keys", S6.hand.length === 4 && new Set(S6.hand).size === 4 && S6.hand.every((k) => PICK_POOL.some((p) => p.key === k)));
```

(2) Appended after the T7 blocks (imports gain `dealHand` from muster.js):

```js
// ---- P7.1 T8: THE DEALT HAND
{
  const mkRng = (vals) => { let i = 0; return () => vals[(i++) % vals.length]; };
  const h1 = dealHand(mkRng([0.99, 0.99, 0.99, 0.99]), PICK_POOL.map((p) => p.key));
  ok("T8: four draws, four distinct — the splice forbids collision", h1.length === 4 && new Set(h1).size === 4);
  let n8 = 0; const counting = () => { n8++; return 0.5; };
  dealHand(counting, PICK_POOL.map((p) => p.key));
  ok("T8: exactly four draws, always", n8 === 4);
}
{
  const src8 = fs.readFileSync("src/depot/DepotGame.jsx", "utf8");
  ok("T8 wiring: the deal opens the first card", /S\.openInfo\(S\._placeQueue\[0\], "deal"\)/.test(src8));
  ok("T8 wiring: each placement deals the next card", /S\.openInfo\(next, "deal"\)/.test(src8));
  ok("T8 wiring: a ground tap never places under an open card", /if \(S\.infoKey\) return;/.test(src8));
  ok("T8 wiring: the pick grid is gone", !/data-pick=/.test(src8) && !/togglePick/.test(src8));
  const ic8 = fs.readFileSync("src/depot/InfoCard.jsx", "utf8");
  ok("T8 wiring: the card carries the deal door", /door === "deal"/.test(ic8) && /PLACE IT/.test(ic8));
}
```

**Step 7 — version.** `src/version.js`: `mk1.71` → `mk1.72`. Build AFTER the bump.

## Gates — run ONLY these

1. `node scripts/depot-test.mjs` — 0 failed; 8 new asserts, expected total **1447/0**, reported exact. Licensed movements ONLY: Phase A's re-pins (keystone included, owner-ratified) and Phase B's re-teaches, all named above. Anything else: stop.
2. `node scripts/smoke.mjs` — preview pattern, all green, mark mk1.72. (Smoke starts wars through `__DEPOTSTART__` and never drives the overlay — a smoke movement is a STOP.)
3. `node scripts/depot-lint.mjs` — clean.

Green → commit `src/depot/muster.js`, `src/depot/DepotGame.jsx`, `src/depot/InfoCard.jsx`, `scripts/tests/01-engine-era.mjs`, `scripts/tests/05-the-front.mjs`, `scripts/tests/06-troops-physics.mjs`, `scripts/tests/09-reorg.mjs`, `scripts/tests/10-command-refit.mjs`, `src/version.js` — subject "the seed purge and the dealt hand (mk1.72)" — standing trailers, push.

## Report requirements

Read-confirmation (eight items), one outcome line, then bullets: each phase-A site with its CHOSEN SEED and every re-pin old → new (the keystone's hash and draws explicitly); each Phase B step; every re-teach old → new; the checkpoint's and each gate's exact counts; commit hash; **the full list of fixture seeds the task's tests ran**. Every deviation its own labeled bullet. The owner's live acceptance: a fresh war shows no pick grid — TAKE COMMAND deals card 1 of 4 (PLACE IT armed after a beat, no price row), each placement deals the next card, the fourth ends on ALL PLACED — TAKE COMMAND, and no two wars deal the same hand.

## Amendment 1 — one popup at a time; the manual learns the deal (mk1.73)

TWO FINDINGS (owner, 2026-08-19, live check of mk1.72 on the phone):

1. THE OVERLAP (screenshot): the place ticker (top-center, z-index 9) draws OVER the deal card (top-right, z-index 7) — on a phone's width they collide, and the ticker covers the card's title. The ticker is also misleading at that moment: it says "tap ground" while ground taps are refused until PLACE IT. RULED (the question tool): one at a time — while a card is up the ticker hides; the card's PLACE IT is the only instruction.
2. THE MANUAL'S STALE WORD: the YOUR ARMOR card still claims "A Bison and a transport stand at your depot" — false since the bare opening (mk1.68, pre-existing staleness, caught now), and nothing in the tour teaches the deal. The manual gains a deal card, YOUR ARMOR rewrites, and the revision stamp bumps so every player gets the tour once more (the standing MANUAL_REV law).

**Step A1-1 — DepotGame.jsx, the ticker's render gate.** The line

```jsx
      {hud.placing && !fatal && (() => {
```

becomes

```jsx
      {hud.placing && !hud.info && !fatal && (() => {
```

(`hud.info` is set only while a card is up; during placement only the deal door can raise one, so the condition is exact.)

**Step A1-2 — FieldManual.jsx: the manual learns the deal.** Three edits; the two card texts below are served for the owner's approval WITH this amendment — his word on this document approves the copy.

- `MANUAL_REV = 2` → `MANUAL_REV = 3` (the cards changed; the tour greets everyone once more).
- A NEW CARD, inserted directly after REAL STONE (second seat — the opening is the first thing a fresh commander meets):

```js
  { title: "THE HAND YOU'RE DEALT", body: "Every war opens with a dealt hand — four units, shown one card at a time. Place each near your depot, then take command. The enemy is dealt four of his own. No two wars open alike." },
```

- YOUR ARMOR's body replaced (title and seat unchanged):

```js
  { title: "YOUR ARMOR", body: "Armor is dealt to you or bought off a late convoy, never free. Order a hull like a squad — or take the controls yourself. The tracks brake for your own men until you say otherwise. Dear iron: a lost hull returns only at a price." },
```

**Step A1-3 — the licensed re-teaches** (both in `scripts/tests/09-reorg.mjs`, the T23 block, each label gaining `(re-taught P7.1 T8 A1)`, each reported old → new):

- T23(a2): the card count `=== 8` → `=== 9` (the order regex is untouched — YOUR ARMOR through THE FALL keep their sequence; the new card sits ahead of them).
- T23(b): `/export const MANUAL_REV = 2;/` → `/export const MANUAL_REV = 3;/`.
- T23(a) — THE GROUND BITES verbatim pin — must NOT move; movement is a STOP.

**Step A1-4 — the pin** (appended inside `10-command-refit.mjs`'s T8 wiring block):

```js
  ok("T8 A1: the ticker yields while a deal card is up", /hud\.placing && !hud\.info && !fatal/.test(src8));
```

**Step A1-5 — version.** `src/version.js`: `mk1.72` → `mk1.73`. Build AFTER the bump.

Gates: the standing three — depot-test expected **1448/0** (one new assert; two re-teaches), smoke green at mark mk1.73, lint clean. Green → commit `src/depot/DepotGame.jsx`, `src/ui/FieldManual.jsx`, `scripts/tests/09-reorg.mjs`, `scripts/tests/10-command-refit.mjs`, `src/version.js` — subject "one popup at a time; the manual learns the deal (mk1.73)" — standing trailers, push. Report: gate counts exact, every re-teach old → new, the seed list (no new fixture seeds — state that plainly), any deviation its own bullet. The owner's live acceptance: the deal shows one popup at a time, and a fresh entry replays the tour with the deal card second and the armor card telling the truth.
