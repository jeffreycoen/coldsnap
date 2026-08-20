# P7.2 Task 2 — The Hand (mk1.81)

**Suggested model: Sonnet** (a specced contract change plus interface work; every draw, price, and re-teach pre-computed below).
**Scope (ruled):** the bell's manifest pick becomes the convoy's five cards — THREE PLANS + TWO HIRES, every card its own seeded draw off the full ungated fifteen-type list. A plan costs HALF the live market price and unlocks the build bar (each build then pays full). A hire fields AT ONCE, placed by the player's own ground tap on held ground, paid only when it actually fields. Multi-buy while the scrap holds — the convoy window is EXEMPT from the one-buy-per-second law. Unpicked cards re-pool by construction. The enemy keeps his old one-draw pick until Task 3 — a knowing, one-task interim. The mech joins the pool in Task 7, not before.
**Ships phone AND desktop:** every new control is a tap/click through the existing card and ticker idioms; no new key binding is needed.

## Required reading (verified against the mk1.80 tree; re-verify at dispatch)

- `src/depot/state.js` — 1096–1180 (the manifest machinery this task replaces: MANIFEST_DRAWS at 1126, makeManifestState 1129, ladderPool/manifestPool/foePool 1139–1146, drawOffers 1149, drawFoePick 1162, pickManifest 1171, isUnlocked 1178), 1355–1520 (fireBell whole, step 4 at 1433–1443), line 10 (the specs import).
- `src/depot/specs.js` — 138–174 (the two ladders; HAND_KEYS lands after PLAYER_TIERS).
- `src/depot/DepotGame.jsx` — 1374–1376 (priceNow/buyPaced), 1522–1633 (canPlaceInfantryAt, HOMELAND_R, placePick — the placement law placeHire copies), 2141–2160 (tapAt's opening branches), 2424–2455 (openManifest/openInfo/confirmInfo/pickManifest), 2616–2622 (the two debug hooks), 3340–3360 (the hud manifest mirror), 3843–3880 (the manifest card JSX), 3881–3890 (the InfoCard mount), 4150+ (the placing ticker, the new ticker's neighbor), the S state object (the `heroArm: null,` row's region).
- `src/depot/InfoCard.jsx` whole (48). `src/ui/FieldManual.jsx` whole (49). `src/depot/muster.js` 188–214 (PICK_POOL, dealHand — the splice precedent). `src/depot/bell.js` whole (194, read-only — the ring calls fireBell and is NOT edited). `src/depot/market.js` whole (102, read-only).
- Tests: `01-engine-era.mjs` 1–60, 100–230, 725–770 (the manifest block and every early fireBell fixture); `03-bell-polish.mjs` 89–97; `07-armor-demolition.mjs` 871–876, 1100–1116; `09-reorg.mjs` 645–655 (the manual pins), 166–219 (the T21 ring fixture); `11-hiring-hall.mjs` whole.

## The design, plainly

1. **The deal.** Every bell, `fireBell`'s step 4 deals `M.hand` — five rows `{ k, hire }` — instead of `M.offers`. Three plan draws splice from the plans pool (the full fifteen minus what is already unlocked — no tier gate, heroes from bell 1); two hire draws splice from the full fifteen (owning a plan never blocks hiring the same type; the two groups may overlap — different products). Exactly FIVE draws every bell, draw-then-clamp: an exhausted plans pool still burns its three draws and deals fewer cards. The hires pool can never exhaust.
2. **Buying a plan** (the card's CONFIRM PICK): price = `max(1, ceil(live price / 2))`, scrap deducted, the key joins `unlocked`, the row leaves the hand, the pick arms the bar (hero keys stay two-tap buys). No `buyPaced`, no `_buyAt` stamp — the window is exempt; the build bar keeps its pacing untouched.
3. **Hiring** (the card's CONFIRM HIRE): arms `S.hirePlace = { key }`, the hand steps aside, a ticker says PLACE THE HIRE. The next ground tap places it under the standing placement laws — held ground for everything, plus the per-kind vetting `placePick` already uses (squads: clear cell; hulls: flat + clear; towers: cell claim + the road owed). Payment and the card's removal happen ONLY on a successful placement; the ✗ on the ticker cancels, charges nothing, and reopens the hand. A refused tap toasts and waits for the next tap, the placePick shape.
4. **Multi-buy:** after any purchase the hand stays up with the bought row gone; LATER dismisses to the chip; the next bell overwrites. Unpicked plans re-pool by construction (the pool derives from `unlocked`).
5. **What dies:** `MANIFEST_DRAWS`, `manifestPool`, `drawOffers`, and the pure `pickManifest` (the closure name `S.pickManifest` survives as the plan-buy handler — the T21(a2) pin keeps matching). `foePool`/`drawFoePick`/`FOE_DRAWS` stay for Task 3.
6. **The save:** the hand rides inside the existing `S.manifest` JSON clone — nothing new serialized. Old saves burn at the door by the stale-mark law. Zero engine or renderer edits; golden untouched; the keystone fixture never rings a bell (verified: 05-the-front.mjs's block is bell-free) and is expected UNMOVED.

Dials, provisional (F5): the half-price rounding `max(1, ceil(p/2))`; the 3+2 split is the owner's fixed ruling, not a dial.

## Sweep license (owner ratifies at plan approval)

- **Literal re-teaches, pre-computed** (each old → new in the report): era-01's manifest block and prediction burn (Steps 4a/4b), era-03's teaching-line literal (Step 5), era-07's three pool pins (Step 6), era-09's MANUAL_REV pin (Step 7). Every replacement keeps its block's `ok()` count IDENTICAL, so the suite's arithmetic stays: 1492 = 1472 + the 20 new checks.
- **The value-shift license (the T15-Amendment-1A precedent):** the bell now draws five where it drew four, so every fixed-seed fixture that rings `fireBell`/`ringBell` legitimately draws differently downstream. Any NUMERIC pin in such a fixture that moves for exactly this reason is licensed for a re-base — measured new value, threshold never weakened, each old → new in the report. Known-safe by inspection: 01:730–737 (structural), 01:761–766 (heads-0 arithmetic), 03's mk0.50/4 (structural), 09's T21 (a ≥16 floor; the new per-bell total is 16). A pin failing for any OTHER reason stops the task.

## The steps

**Step 1 — the failing asserts.** Append to `scripts/tests/11-hiring-hall.mjs` (and extend its import block with the names used):

```js
// ---- P7.2 T2 (mk1.81): THE HAND — five cards, three plans + two hires
// (imports to add at the top of this file:)
// import { dealConvoyHand, takeHandCard, HAND_DRAWS, FOE_DRAWS, makeManifestState, makeRunState, fireBell, BELL_PERIOD_S } from "../../src/depot/state.js";
// import { HAND_KEYS } from "../../src/depot/specs.js";
// import { PICK_POOL } from "../../src/depot/muster.js";
// import { mulberry32 } from "../../src/engine/core.js";  (extend the core import)
// import { fatReg } from "./shared.mjs";
// import { MANUAL_REV } from "../../src/ui/FieldManual.jsx" is NOT importable headless (JSX) — the manual pins below are source regexes.
{
  // (a) one table: the hand's fifteen are the pick pool's fifteen
  ok("T2(a): HAND_KEYS is the fifteen, exactly the pick pool's keys",
    HAND_KEYS.length === 15 && new Set(HAND_KEYS).size === 15 && PICK_POOL.every((p) => HAND_KEYS.includes(p.key)));

  // (b) the deal's contract — five draws, always, draw-then-clamp
  const count = () => { let n = 0; const r = mulberry32(7); return { rng: () => { n++; return r(); }, n: () => n }; };
  {
    const c = count();
    const hand = dealConvoyHand(["sq_rifles", "sq_engineers"], HAND_KEYS, c.rng);
    ok("T2(b): a full pool spends exactly HAND_DRAWS (5)", c.n() === HAND_DRAWS && HAND_DRAWS === 5, c.n());
    const plans = hand.filter((x) => !x.hire), hires = hand.filter((x) => x.hire);
    ok("T2(b2): three plans and two hires, the fixed split", plans.length === 3 && hires.length === 2);
    ok("T2(b3): plans are distinct and never an owned key",
      new Set(plans.map((x) => x.k)).size === 3 && plans.every((x) => x.k !== "sq_rifles" && x.k !== "sq_engineers"));
    ok("T2(b4): hires draw from the FULL list — owning the plan never blocks the hire",
      hires.every((x) => HAND_KEYS.includes(x.k)));
  }
  {
    const c = count();
    const owned = HAND_KEYS.slice(0, 13); // two plans left in the pool
    const hand = dealConvoyHand(owned, HAND_KEYS, c.rng);
    ok("T2(b5): a thin pool still burns five draws and deals what it has",
      c.n() === 5 && hand.filter((x) => !x.hire).length === 2 && hand.filter((x) => x.hire).length === 2);
    const c2 = count();
    const hand2 = dealConvoyHand(HAND_KEYS.slice(), HAND_KEYS, c2.rng);
    ok("T2(b6): an exhausted plans pool still burns five and deals hires only",
      c2.n() === 5 && hand2.length === 2 && hand2.every((x) => x.hire));
  }
  {
    let heroHands = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const hand = dealConvoyHand(["sq_rifles", "sq_engineers"], HAND_KEYS, mulberry32(seed));
      if (hand.some((x) => x.k === "hero_bison" || x.k === "hero_apc")) heroHands++;
    }
    ok("T2(b7): heroes appear from bell one — the tier gates are dead (owner)", heroHands > 0, heroHands);
  }

  // (c) taking cards — multi-buy is the law
  {
    const M = makeManifestState();
    M.hand = [{ k: "gun", hire: 0 }, { k: "gun", hire: 1 }, { k: "sq_mg", hire: 0 }];
    M.cardUp = true;
    ok("T2(c): a key not in the hand is refused", takeHandCard(M, "rocket", 0) === false && M.hand.length === 3);
    ok("T2(c2): taking removes exactly the one row — the hire flag tells twins apart",
      takeHandCard(M, "gun", 0) === true && M.hand.length === 2 && M.hand.some((x) => x.k === "gun" && x.hire === 1));
    ok("T2(c3): a SECOND card can be taken — multi-buy (owner, supersedes one-pick-per-bell)",
      takeHandCard(M, "sq_mg", 0) === true && M.hand.length === 1);
    takeHandCard(M, "gun", 1);
    ok("T2(c4): the last card leaving closes the window", M.hand.length === 0 && M.cardUp === false);
  }

  // (d) the bell deals the hand
  {
    const S = makeRunState();
    S.started = true; S.reg = fatReg();
    let draws = 0; const raw = mulberry32(81); const rng = () => { draws++; return raw(); };
    fireBell(S, { reg: S.reg, snap: {}, rng, t: BELL_PERIOD_S });
    ok("T2(d): the ring deals five and stamps the bell", S.manifest.hand.length === 5 && S.manifest.offerBell === 1 && S.manifest.cardUp === true);
    ok("T2(d2): bell one spends exactly ten draws (hand 5 + his pick 1 + the muster 4; opening intel draws none)", draws === 10, draws);
    const kept = S.manifest.hand.filter((x) => !x.hire).map((x) => x.k);
    fireBell(S, { reg: S.reg, snap: {}, rng, t: 2 * BELL_PERIOD_S });
    ok("T2(d3): a skipped bell is overwritten, and unpicked plans stay in the pool",
      S.manifest.offerBell === 2 && S.manifest.unlocked.length === 2 &&
      kept.every((k) => HAND_KEYS.indexOf(k) >= 0 && S.manifest.unlocked.indexOf(k) < 0));
  }

  // (e) the wiring (tap-to-handler, the audit idiom)
  {
    const src = fs.readFileSync("src/depot/DepotGame.jsx", "utf8");
    ok("T2(e): the plan buy pays half the live price", /Math\.max\(1, Math\.ceil\(priceNow\(key, it \? it\.cost : 10\) \/ 2\)\)/.test(src));
    const pmBody = (src.match(/S\.pickManifest = \(key\) => \{[\s\S]*?\n      \};/) || [""])[0];
    ok("T2(e2): the convoy window is exempt from the pacing law", pmBody.length > 0 && !/buyPaced\(/.test(pmBody) && !/_buyAt/.test(pmBody));
    ok("T2(e3): the hire arms a placement tap", /S\.armHire = \(key\) => \{/.test(src) && /S\.hirePlace = \{ key \};/.test(src));
    ok("T2(e4): the hire's tap owns the ground before the order flow",
      src.indexOf("if (S.hirePlace) {") > 0 && src.indexOf("if (S.hirePlace) {") < src.indexOf("if (consumeOrderTap(p)) return;"));
    ok("T2(e5): placement charges on success only — the card leaves when the unit fields",
      /takeHandCard\(S\.manifest, key, 1\);\n\s+S\.resources -= price;/.test(src) && /S\.cancelHire = /.test(src) && /data-hire-cancel/.test(src));
    ok("T2(e6): the hand's rows carry their kind and price", /data-hand-kind=\{c\.hire \? "hire" : "plan"\}/.test(src));
    const ic = fs.readFileSync("src/depot/InfoCard.jsx", "utf8");
    ok("T2(e7): the card carries the hire door", /door === "hire"/.test(ic) && /CONFIRM HIRE/.test(ic));
  }

  // (f) the manual tells the hand's truth
  {
    const fm = fs.readFileSync("src/ui/FieldManual.jsx", "utf8");
    ok("T2(f): the tour returns for the hand (MANUAL_REV 4)", /export const MANUAL_REV = 4;/.test(fm));
    ok("T2(f2): THE BELL card teaches plans and hires, and the header count is honest",
      /plans you buy once/.test(fm) && /hires that walk on at once/.test(fm) && /Nine linked cards/.test(fm));
  }
}
```

Twenty checks. Run the suite: this block fails on its missing imports — that red is Step 1's proof; the pre-existing 1472 must not move yet.

**Step 2 — the one table.** `src/depot/specs.js`, after PLAYER_TIERS' closing bracket (line 174):

```js
// P7.2 T2 (owner): THE HAND IS UNGATED — the full fifteen, one table, from
// bell one; price and the market wall do all the refusing. The tier ladders
// above stop gating offers (they remain as rows and price families). The
// mech joins this list in its own task, not before.
export const HAND_KEYS = ["mg", "gun", "mortar", "rocket", "frost", "sq_sniper", "sq_rifles", "sq_mg", "sq_sappers", "sq_mortars", "sq_engineers", "sq_runners", "sq_breakers", "hero_bison", "hero_apc"];
```

**Step 3 — the contract.** `src/depot/state.js`:
- Line 10: add `HAND_KEYS` to the specs import.
- Replace lines 1126–1127 (MANIFEST_DRAWS/FOE_DRAWS) with:

```js
// P7.2 T2 (owner): THE HAND — five draws per bell, the fixed split: three
// plan draws over the not-yet-unlocked pool, two hire draws over the full
// list. Draw-then-clamp: an exhausted plans pool still burns its three.
export const HAND_DRAWS = 5;
export const FOE_DRAWS = 1;        // 1 index roll (his pick — Task 3 replaces it)
```
- `makeManifestState` (1129–1131): `offers: []` becomes `hand: []` (offerBell/cardUp/armedAt unchanged).
- Delete `manifestPool` (line 1145) — `ladderPool` and `foePool` STAY (his ladder still uses them).
- Replace `drawOffers` (1149–1160) with:

```js
// dealConvoyHand(unlocked, keys, rng) -> up to five rows { k, hire }.
// Exactly HAND_DRAWS draws, always: three spliced plan picks over the
// unowned pool, two spliced hire picks over the full list. A plan and a
// hire may name the same type — different products (one teaches, one
// delivers). No bell gate anywhere (owner).
export function dealConvoyHand(unlocked, keys, rng) {
  const plans = keys.filter((k) => unlocked.indexOf(k) < 0);
  const hand = [];
  for (let i = 0; i < 3; i++) {
    const d = rng();
    if (!plans.length) continue; // the draw burned; the pool had nothing left
    const j = Math.min(plans.length - 1, Math.floor(d * plans.length));
    hand.push({ k: plans.splice(j, 1)[0], hire: 0 });
  }
  const hires = keys.slice();
  for (let i = 0; i < 2; i++) {
    const d = rng();
    const j = Math.min(hires.length - 1, Math.floor(d * hires.length));
    hand.push({ k: hires.splice(j, 1)[0], hire: 1 });
  }
  return hand;
}

// takeHandCard(M, key, hire): one row leaves the hand — multi-buy is the
// law (owner), so nothing else closes. The last row leaving drops the card.
export function takeHandCard(M, key, hire) {
  if (!M || !M.hand) return false;
  const i = M.hand.findIndex((c) => c.k === key && c.hire === (hire ? 1 : 0));
  if (i < 0) return false;
  M.hand.splice(i, 1);
  if (!M.hand.length) M.cardUp = false;
  return true;
}
```
- Delete the pure `pickManifest` (1171–1177); `isUnlocked` stays.
- fireBell step 4 (1433–1443) becomes:

```js
  // 4. the hand. Five cards — three plans, two hires — dealt fresh every
  // bell. A skipped bell is overwritten; unpicked plans are still in the
  // pool next bell (the pool derives from what is unlocked), so nothing is
  // lost and nothing banks.
  if (rng) {
    if (!S.manifest) S.manifest = makeManifestState();
    const M = S.manifest;
    M.hand = dealConvoyHand(M.unlocked, HAND_KEYS, rng);
    M.offerBell = S.bell;
    M.cardUp = M.hand.length > 0;
    M.armedAt = nowT + PENDING_ARM_S;
  }
```
- The header comment's line 1384 (`4. the manifest — the convoy's 2-3 offers...`) re-words to name the hand.

**Step 4 — era-01 re-taught (licensed).**
(4a) Import line 3: remove `MANIFEST_DRAWS, manifestPool, drawOffers, pickManifest`; add `HAND_DRAWS, dealConvoyHand, takeHandCard`. Add `HAND_KEYS` to the line-5 specs import. Replace the whole manifest block (lines 109–193, from `// --- the manifest (P1 Task 2)` through the close of block (e)) with the following — EXACTLY 29 ok() calls, matching the 29 removed:

```js
// --- the hand (P7.2 T2): one ungated table, five draws, multi-buy
{
  console.log("\n[the hand]");
  const allPicked = ENEMY_TIERS.flat();

  // (a) the player starts with START and nothing else; the bell gates are dead.
  {
    const M = makeManifestState();
    ok("hand: the starting kit is rifles + engineers",
      M.unlocked.length === 2 && isUnlocked(M, "sq_rifles") && isUnlocked(M, "sq_engineers")
      && !isUnlocked(M, "wall") && !isUnlocked(M, "sandbag"), M.unlocked.join(","));
    ok("hand: nothing is offered before the first bell", M.hand.length === 0 && M.cardUp === false);
    const p0 = HAND_KEYS.filter((k) => M.unlocked.indexOf(k) < 0);
    ok("hand: the plans pool ignores the bell entirely — one pool at any hour", p0.length === 13, p0.length);
  }

  // (b) the pool: the full list minus what is owned. No tiers, no bells.
  {
    const M = makeManifestState();
    const pool = () => HAND_KEYS.filter((k) => M.unlocked.indexOf(k) < 0);
    ok("hand: thirteen plans stand at bell one", pool().length === 13);
    M.unlocked.push("mg");
    ok("hand: a bought plan leaves the pool", pool().indexOf("mg") < 0 && pool().length === 12);
    ok("hand: heroes stand in the pool from the start (the gate is dead, owner)",
      pool().includes("hero_bison") && pool().includes("hero_apc"));
    ok("hand: the kit's own keys are never plans", pool().indexOf("sq_rifles") < 0 && pool().indexOf("sq_engineers") < 0);
    ok("hand: hires ignore ownership — the full fifteen, always",
      dealConvoyHand(HAND_KEYS.slice(), HAND_KEYS, mulberry32(4)).every((c) => c.hire === 1));
  }

  // (c) DRAW-COUNT LAW: five draws whatever the pools hold; his pick still one.
  {
    const counted = (seed) => { let n = 0; const r = mulberry32(seed); return { rng: () => { n++; return r(); }, n: () => n }; };
    for (const owned of [[], HAND_KEYS.slice(0, 5), HAND_KEYS.slice(0, 13), HAND_KEYS.slice()]) {
      const c = counted(5);
      dealConvoyHand(owned, HAND_KEYS, c.rng);
      ok(`hand: ${15 - owned.length}-plan pool still spends exactly ${HAND_DRAWS} draws`, c.n() === HAND_DRAWS, `${c.n()}`);
      const f = counted(6);
      drawFoePick(foePool([], 1), f.rng);
      ok(`foe pick: still exactly ${FOE_DRAWS} draw beside a ${15 - owned.length}-plan hand`, f.n() === FOE_DRAWS, `${f.n()}`);
    }
    let badN = 0, dupe = 0, foreign = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const h = dealConvoyHand(["sq_rifles", "sq_engineers"], HAND_KEYS, mulberry32(seed));
      const plans = h.filter((x) => !x.hire);
      if (h.length !== 5 || plans.length !== 3) badN++;
      if (new Set(plans.map((x) => x.k)).size !== plans.length) dupe++;
      if (h.some((x) => !HAND_KEYS.includes(x.k))) foreign++;
    }
    ok("hand: 200 seeded deals are all five cards, three plans", badN === 0, `${badN} bad`);
    ok("hand: 200 seeded deals never repeat a plan", dupe === 0, `${dupe} dupes`);
    ok("hand: 200 seeded deals never invent a card", foreign === 0, `${foreign} foreign`);
    const one = dealConvoyHand(HAND_KEYS.slice(0, 14), HAND_KEYS, mulberry32(3));
    ok("hand: a one-plan pool deals that plan and the two hires", one.filter((x) => !x.hire).length === 1 && one.length === 3);
    ok("hand: an exhausted plans pool deals hires alone", dealConvoyHand(HAND_KEYS.slice(), HAND_KEYS, mulberry32(3)).length === 2);
    ok("foe pick: an empty pool picks nothing", drawFoePick([], mulberry32(3)) === null);
  }

  // (d) taking cards: only what the hand holds, and MORE THAN ONCE (owner).
  {
    const M = makeManifestState();
    M.hand = [{ k: "mg", hire: 0 }, { k: "frost", hire: 0 }, { k: "mg", hire: 1 }]; M.cardUp = true;
    ok("hand: a card the convoy never dealt cannot be taken", takeHandCard(M, "rocket", 0) === false && M.hand.length === 3);
    ok("hand: taking a plan removes that row alone", takeHandCard(M, "frost", 0) === true && M.hand.length === 2);
    ok("hand: a SECOND card off the same bell is taken — multi-buy is the law (owner)", takeHandCard(M, "mg", 0) === true && M.hand.length === 1);
    ok("hand: the last card leaving closes the window", takeHandCard(M, "mg", 1) === true && M.cardUp === false);
  }

  // (e) a skipped bell is overwritten; unpicked plans re-pool by construction.
  {
    const S2 = makeRunState();
    S2.started = true; S2.reg = fatReg();
    const rng = mulberry32(41);
    fireBell(S2, { reg: S2.reg, snap: {}, rng, t: BELL_PERIOD_S });
    const first = S2.manifest.hand.slice();
    ok("hand: the bell deals five", first.length === 5 && S2.manifest.cardUp === true, first.map((c) => c.k).join(","));
    fireBell(S2, { reg: S2.reg, snap: {}, rng, t: 2 * BELL_PERIOD_S });
    ok("hand: an unread hand is overwritten at the next bell, not banked",
      S2.manifest.offerBell === 2 && S2.manifest.unlocked.length === 2, `${S2.manifest.offerBell}/${S2.manifest.unlocked.length}`);
    ok("hand: the passed-over plans are still in the pool",
      first.filter((c) => !c.hire).every((c) => S2.manifest.unlocked.indexOf(c.k) < 0));
  }
}
```
(4b) Lines 740–749 (the prediction burn): the comment re-words and the loop becomes `for (let i = 0; i < HAND_DRAWS + FOE_DRAWS; i++) rngP();` — six burned where five were.

**Step 5 — era-03 re-taught (licensed).** Line 94's literal: `"Pick one reinforcement — the convoy returns each bell."` → `"The convoy returns each bell — plans build, hires march."` (the `hud.manifest.bell === 1` half of the pin stays).

**Step 6 — era-07 re-taught (licensed).** Remove `manifestPool` from 07's state import; add `import { HAND_KEYS } from "../../src/depot/specs.js";` (or extend an existing specs import). Then:
- T7(f) (line ~875): `ok("T7(f): the ungated plans pool at bell one is thirteen, runners and breakers included", (() => { const p = HAND_KEYS.filter((k) => makeManifestState().unlocked.indexOf(k) < 0); return p.length === 13 && p.includes("sq_runners") && p.includes("sq_breakers"); })());`
- T9(a4): `ok("T9(a4): heroes stand in the plans pool at bell ONE — the tier gate is dead (owner, P7.2)", HAND_KEYS.filter((k) => makeManifestState().unlocked.indexOf(k) < 0).includes("hero_bison"));`
- T9(a5): `ok("T9(a5): ...and at bell ten, same pool — one pool at any hour", HAND_KEYS.includes("hero_apc"));`
- T9(a6) (foePool) unchanged.

**Step 7 — era-09 re-taught (licensed).** Line 650: `MANUAL_REV = 3` → `MANUAL_REV = 4` in both the assert text (`re-taught P7.2 T2: 3 -> 4`) and the regex.

**Step 8 — DepotGame.jsx.**
- Imports (line 21): remove `pickManifest`, add `takeHandCard`. Add `HAND_KEYS`? Not needed (the game layer never rebuilds pools).
- The S object: `hirePlace: null,` inserted beside `heroArm: null,`.
- `S.openManifest` (2424–2429): the gate becomes `if (!M || M.hand.length === 0) return;`.
- `S.pickManifest` (2444–2455) becomes THE PLAN BUY (the handler name survives — the T21(a2) pin):

```js
      S.pickManifest = (key) => {
        const M = S.manifest;
        if (!M || world.t < M.armedAt) { toast("HOLD — ARMING"); return; }
        // P7.2 T2 (owner): A PLAN COSTS HALF the live price — the ladder
        // itself gained a price; each build after pays full. The convoy's
        // window is EXEMPT from the one-buy-per-second law (the hand is
        // one visit): no pacing check, no purchase stamp.
        const it = PALETTE_BY_KEY[key];
        const price = Math.max(1, Math.ceil(priceNow(key, it ? it.cost : 10) / 2));
        if (S.resources < price) { toast("NO SCRAP"); return; }
        if (!takeHandCard(M, key, 0)) return;
        M.unlocked.push(key);
        S.resources -= price;
        cue("uitick"); // the plan is bought
        toast((PALETTE_LABEL[key] || key) + " — PLANS BOUGHT ◆" + price);
        // P7 T17 (owner): THE PICK ARMS THE BAR — hero keys stay two-tap buys.
        if (!key.startsWith("hero_")) setMode(key);
      };
```
- Directly after it, THE HIRE:

```js
      // P7.2 T2 (owner): A HIRE FIELDS AT ONCE, placed by your own ground
      // tap on held ground. Payment lands only when the unit actually
      // fields — the ✗ cancels, charges nothing, and reopens the hand.
      S.armHire = (key) => {
        const M = S.manifest;
        if (!M || world.t < M.armedAt) { toast("HOLD — ARMING"); return; }
        if (!M.hand.some((c) => c.k === key && c.hire === 1)) return;
        S.hirePlace = { key };
        M.cardUp = false; // the window steps aside for the placement tap
        toast("PLACE THE HIRE — tap held ground");
      };
      S.cancelHire = () => { S.hirePlace = null; };
      const placeHire = (p) => {
        const key = S.hirePlace.key;
        const pk = PICK_POOL.find((x) => x.key === key);
        if (!pk) { S.hirePlace = null; return; }
        const price = priceNow(key, PALETTE_BY_KEY[key].cost);
        if (S.resources < price) { toast("NO SCRAP"); S.hirePlace = null; return; }
        const g = grid.worldToGrid(p.x, p.z);
        if (!grid.inBounds(g.gx, g.gz)) { toast("OFF THE FIELD"); return; }
        const cell = grid.cells[grid.idx(g.gx, g.gz)];
        const wp = grid.gridToWorld(g.gx, g.gz);
        const c0 = invW(wp.x, wp.z);
        if (!canBuild(T, c0.u, c0.v)) { toast("GROUND NOT HELD"); return; }
        if (cell.water || cell.ice || cell.blocked || cell.wallId) { toast("NO GROUND"); return; }
        if (pk.kind === "squad") {
          const sq = makeSquad(S.nextSquadId++, pk.type, 1, wp.x, wp.z);
          spawnSquadMembers(world, sq);
          S.squads.push(sq);
          S.selSquadId = sq.id; S.selSquadIds = null; S.selArmedAt = world.t + PENDING_ARM_S; S.pieOpen = true;
        } else if (pk.kind === "hull") {
          const spec = pk.vtype === "apc" ? APC : BISON;
          if (!armorStable(field, wp.x, wp.z, spec)) { toast("TOO STEEP TO PARK"); return; }
          if (slotBlockedPublic(world, wp.x, wp.z, Math.hypot(spec.hx, spec.hz) + 1.0)) { toast("NO ROOM"); return; }
          const v = addBody(world, { kind: "vehicle", team: 1, mass: spec.mass, hx: spec.hx, hy: spec.hy, hz: spec.hz,
            x: wp.x, y: field.heightAt(wp.x, wp.z) + spec.hy + 0.05, z: wp.z, hp: spec.hp, friction: 0.85,
            q: heading(null, Math.atan2(-wp.x, -wp.z)) });
          v.armor = spec.armor; v.vtype = pk.vtype; v.maxHp = spec.hp;
          v.homeX = wp.x; v.homeZ = wp.z; v.sleeping = true;
          if (pk.vtype === "apc") v.apcSeq = nextApcSeq();
          v.drv = pk.vtype === "apc" ? "apc" : "armor"; v.depotDrive = "auto"; v.order = "defend"; v.tracks = "careful"; v.driver = "player";
        } else { // tower — the build law: cell claim + the road owed
          cell.blocked = true;
          if (!checkConnectivity(grid, SPAWN_POINTS, objG.gx, objG.gz)) { cell.blocked = false; toast("Leave them a road"); return; }
          const spec = TOWER_SPECS[pk.key];
          const b = addBody(world, { kind: "tower", team: 1, mass: 0, hx: 0.8, hy: spec.hy, hz: 0.8, x: wp.x, y: field.heightAt(wp.x, wp.z) + spec.hy, z: wp.z, hp: spec.hp });
          b.towerType = pk.key; b.flagPole = true; b.maxHp = b.hp;
          b.effRange = effRange(world, { x: b.pos.x, y: b.pos.y + b.hy + 0.45, z: b.pos.z }, spec);
          cell.wallId = b.id; cell.bTeam = 1;
          recomputeFlow();
        }
        takeHandCard(S.manifest, key, 1);
        S.resources -= price;
        S.hirePlace = null;
        cue("uitick");
        toast("THE HIRE FIELDS — ◆" + price);
      };
```
- `S.confirmInfo`'s dispatch line grows the hire door: `if (k && door === "manifest") S.pickManifest(k); else if (k && door === "hire") S.armHire(k);`
- `tapAt`: insert immediately after the `if (!S.started || S.gameOver || S.victory) return;` guard (before the pending-consumption rule):

```js
        // P7.2 T2: THE HIRE'S TAP — an armed placement owns the ground tap.
        if (S.hirePlace) {
          const ph = groundPoint(cx, cy);
          if (ph) placeHire(ph);
          return;
        }
```
- The hud manifest mirror (3354–3360) becomes:

```js
              manifest: S.manifest.hand.length > 0 ? {
                up: !!S.manifest.cardUp, armed: world.t >= S.manifest.armedAt,
                bell: S.manifest.offerBell,
                hand: S.manifest.hand.map((c) => {
                  const base = (PALETTE_BY_KEY[c.k] || { cost: 10 }).cost;
                  const live = priceNow(c.k, base);
                  return { k: c.k, hire: c.hire, price: c.hire ? live : Math.max(1, Math.ceil(live / 2)) };
                }),
              } : null,
              hiring: S.hirePlace ? { key: S.hirePlace.key, label: (PALETTE_BY_KEY[S.hirePlace.key] || {}).label } : null,
```
- The manifest card JSX (3843–3880): the body copy becomes `Plans build; hires march. Take what your scrap can carry.`; the bell-1 teaching line becomes `The convoy returns each bell — plans build, hires march.` (same `hud.manifest.bell === 1 && (` shape); the offers map becomes the hand's rows:

```jsx
            {hud.manifest.hand.map((c, ci) => {
              const it = PALETTE_BY_KEY[c.k];
              if (!it) return null;
              return (
                <button key={ci + ":" + c.k} data-manifest-offer={c.k} data-hand-kind={c.hire ? "hire" : "plan"}
                  style={{ ...P.btnBig, width: "100%", marginBottom: 6, display: "flex", alignItems: "center", gap: 10, textAlign: "left", opacity: hud.manifest.armed ? 1 : 0.5 }}
                  onClick={() => { const S = stateRef.current; if (S && S.openInfo) S.openInfo(c.k, c.hire ? "hire" : "manifest"); }}>
                  <span style={{ fontSize: 18 }}>{it.icon}</span>
                  <span style={{ flex: 1 }}>{it.label}</span>
                  <span style={{ color: c.hire ? "#7dffa8" : "#ffd27a", fontSize: 11, letterSpacing: 1 }}>{c.hire ? "HIRE" : "PLAN"} ◆{c.price}</span>
                </button>
              );
            })}
```
- The InfoCard mount's price prop becomes door-aware:

```jsx
          price={(() => {
            if (hud.info.door === "deal") return null;
            const base = hud.prices?.[hud.info.key] ?? PALETTE_BY_KEY[hud.info.key]?.cost;
            return hud.info.door === "manifest" ? Math.max(1, Math.ceil(base / 2)) : base;
          })()}
```
- THE HIRE TICKER, rendered beside the placing ticker's block (same top-center seat, both platforms):

```jsx
      {hud.hiring && !hud.info && !fatal && (
        <div data-hire-ticker style={{ position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)", zIndex: 9,
          background: "#1a212b", border: "1px solid #7dffa8", borderRadius: 8, padding: "8px 16px",
          display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "#e6ebf1" }}>
          <span>PLACE THE HIRE: {hud.hiring.label} — tap held ground</span>
          <button data-hire-cancel style={{ ...P.btn, borderColor: "#ff6b5e", color: "#ff6b5e" }}
            onClick={() => { const S = stateRef.current; if (S && S.cancelHire) { S.cancelHire(); if (S.openManifest) S.openManifest(); } }}>✗</button>
        </div>
      )}
```
- Debug hooks: `__DEPOTMANIFEST__`'s `offers:` field becomes `hand: S.manifest.hand.slice(),`; `__DEPOTPICK__` stays wired to `S.pickManifest` (it now charges scrap and needs the arm — its callers are staging only).

**Step 9 — InfoCard.jsx.** The door row gains the hire branch between "manifest" and "deal":

```jsx
        ) : door === "hire" ? (
          <>
            <button data-info-hire style={{ ...B, flex: 1, borderColor: "#7dffa8", color: "#7dffa8", opacity: armed ? 1 : 0.5 }} onClick={onConfirm}>CONFIRM HIRE</button>
            <button data-info-cancel style={{ ...B, borderColor: "#ff6b5e", color: "#ff6b5e" }} onClick={onCancel}>✗</button>
          </>
```

**Step 10 — the manual.** `src/ui/FieldManual.jsx`: MANUAL_REV 3 → 4; the header comment's "Eight linked cards" becomes "Nine linked cards" (the standing oddment, closed here); THE BELL card's body becomes, verbatim (owner approves this copy with the plan):

```
Scrap flows every second. Every 90 seconds the bell rings and the convoy shows its hand — plans you buy once and build from after, hires that walk on at once, placed by your tap. Take what your scrap can carry.
```

**Step 11 — the gates and the deploy.** Bump `src/version.js` to `mk1.81`. In order: `node scripts/depot-test.mjs` — expected 1492/0 (1472 + 20; every era re-teach keeps its count); `node scripts/depot-lint.mjs` clean (no rng added outside the seeded stream); `npm run build` AFTER the bump; smoke (the stale preview may still hold 4173 — use 4174 with SMOKE_URL); keystone 843448507 / 749 UNMOVED (its fixture never rings a bell — movement is an honest stop). Gates green → commit `the hand (mk1.81)` → push.

## Trap notes

- **fireBell's step ORDER is the contract:** intel composes before the hand deals, his pick and the muster follow. Only step 4's body changes; touching the order desyncs every downstream fixture.
- The bell's per-bell draw total moves 15 → 16 (+1). The value-shift license above covers fixed-seed fixture pins that move for exactly that reason; nothing else.
- `foePool`, `drawFoePick`, `FOE_DRAWS`, `ladderPool`, and `ENEMY_TIERS` gating are Task 3's ground — untouched here.
- `S.pickManifest` keeps its NAME (the T21(a2) pin `/S\.pickManifest = /`); the T8 deal-door pins (`openInfo(..., "deal")`, `PLACE IT`) and the pre-start placing ticker are untouched.
- The hire's tap branch sits BEFORE the pending-consumption rule and the possession guard in `tapAt` — placing outranks both while armed; the pre-start `_placeQueue` branch above it is untouched.
- `bell.js` is NOT edited — it calls fireBell and reads nothing this task moves.
- No edits to `market.js`, `economy.js`, `ai.js`, `save.js`, `muster.js`, `renderer.js`, or the engine.

## The owner's live check (phone AND desktop)

- The bell deals five rows — three amber PLAN prices, two green HIRE prices; heroes can show up on bell one.
- Buy two plans back to back in one window — no pacing complaint; the bar still paces its own builds.
- A plan costs half what the bar then charges to build it.
- CONFIRM HIRE, tap held ground — the unit fields on the spot and the scrap moves then, not before; ✗ on the ticker returns the card unharmed.
- The manual greets you once more and THE BELL card tells the hand's truth.

## Report requirements

Fixture seeds named (81 is the one new seed; 41 and 7 are reused fixture seeds in re-taught blocks). Every re-teach and every value-shift re-base old → new, each its own bullet. Deviations labeled. The suite count to the digit.

## AMENDMENT 1 (after the agent's honest stop before any edit — the defect is the plan-writer's)

Step 4a's replacement span is mis-cut. The original block's opening `{` (line 110) closes at line 244 — PAST the replaced span — because blocks (f) and (g) live inside the same scope and read the `allPicked` declared there. The plan's replacement text is self-balanced, so splicing it over a net-open span breaks the parse (verified by the agent with `node --check`: stray `}` at the old line 244) and would orphan `allPicked`.

**The correction, one change:** the Step 4a replacement text loses its FINAL closing `}` — nothing else in it moves. The spliced text then reads: the new header comment, the outer `{` left OPEN, `console.log("\n[the hand]")`, the `const allPicked = ENEMY_TIERS.flat();` (blocks (f)/(g) keep reading it), then blocks (a) through (e) exactly as written. The outer scope stays open through the untouched (f)/(g) blocks and closes at the original line-244 `}` exactly as today. The 29-for-29 count law and everything else in the plan stand unchanged.

## AMENDMENT 2 (after the agent's honest stop at Gate 1 — the defect is the plan-writer's)

Step 1's prose says "Twenty checks"; Step 1's own code block contains TWENTY-FOUR `ok()` calls (counted: (a) 1, (b) 7, (c) 4, (d) 3, (e) 7, (f) 2). The code is authoritative — no check is cut. Every check passes and every re-teach is count-neutral (agent-verified against a stashed baseline), so the gate's arithmetic corrects to:

- Suite expected: **1496/0** (1472 + the 24 new checks). The 1492 figure was the plan-writer's miscount, struck.

Nothing else changes. Step 11 proceeds against 1496/0.
