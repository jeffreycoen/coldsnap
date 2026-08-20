# P7.2 Task 8 — The Opening Draft (mk1.89)

**Suggested model: Sonnet** (draw contract + a new pre-start surface, fully specced).
**Scope (fully ruled, 2026-08-20):** the assigned dealt four DIES. Every war opens with SEVEN CARDS dealt to each side off the seventeen — seven DISTINCT types, each card's unit-or-plan kind derived from its own draw's fraction (no extra draws) — and EACH SIDE PICKS FIVE, ALL FIVE FREE (the pick is the payment; a knowing, owner-ruled amendment to nothing-is-free, scoped to the opening). Heroes are in at PLAIN ODDS — a drafted free Bison is a lucky war, accepted knowingly. The enemy picks COMMANDER-COLORED, deterministic, ZERO draws: cautious prefers towers and plans, bold prefers units, stubborn prefers standing defensive iron. Its picked units field at its depot through the Task 4 mirror machinery; its picked plans push its tags and tower ledger (so a boot tower plan starts its one-build-a-bell engine from bell one — the ruled economy, inherited free). The player's five split: unit cards run the existing one-at-a-time deal placement (cards, ghosts, homeland radius — untouched machinery); plan cards open the build bar at once. STARTING SCRAP RISES 120 → 250. Boot draws move 9 → 15 (commander 1 + player 7 + enemy 7), count-stable. The pick screen is a NEW pre-start surface — phone and desktop, shared DOM. `dealHand` dies with the assigned four.

**AMENDMENT 2 (2026-08-20, the owner's live check — TAKE COMMAND flashes the draft and returns; ships as mk1.90):** the mk1.69 ticker defect, reproduced by this plan's own wiring: the 120ms hud tick rebuilds from a full literal that never mirrored `drafting`, so the screen lived one tick. The mk1.69 fix shape exactly: (1) startGame's draft branch gains `S._draftOpen = true;` before its setHud; (2) the hud tick's literal gains, beside its `placing:` line, `drafting: S._draftOpen && S.draft && !S._draftDone ? S.draft.map((c) => ({ k: c.k, plan: c.plan })) : null,`; (3) confirmDraft gains `S._draftOpen = false;` beside `S._draftDone = true;`. Two new checks pin it (the tick mirror and the flag pair, source pins in the T8v2 block): suite 1613 → **1615/0**. Version mk1.90, commit subject `the draft survives the ticker (mk1.90)`.

## Required reading (verified against the mk1.88 tree; re-verify at dispatch)

- `src/depot/muster.js` — 188–269 (PICK_POOL, dealHand — dying, spawnMirrorMan, musterFreshStart — rewritten, mirrorFieldKey below it).
- `src/depot/ai.js` — 285–303 (CMDRS/cmdrOf/cmdrBellOrders — draftPick lands beside them).
- `src/depot/state.js` — 1136–1145 (makeManifestState/makeFoeState), 1212–1233 (makeRunState — startResources), 1575–1586 (HUD0).
- `src/depot/DepotGame.jsx` — 1575–1620 (placePick whole), 2159–2171 (the pre-start tap branch), 3680–3695 (startGame), 4255–4295 (the pre-start overlay and the place ticker), the S-handlers neighborhood (openInfo/pickManifest — confirmDraft lands beside them).
- `src/ui/FieldManual.jsx` — whole (49).
- Tests: `scripts/tests/10-command-refit.mjs` 264–279 (T6v2), 357–375 (T8 — dealHand pins die, wiring pins survive); `09-reorg.mjs` 62–84 (T19(b)); `11-hiring-hall.mjs` T2(f) block (MANUAL_REV pin).

## The design, plainly

1. **The deal.** `draftDeal(rng, keys)` — seven splice draws; each draw's integer part picks the type, its residual fraction picks the kind: `plan = frac < PLAN_ODDS` (PLAN_ODDS 0.4 F5 — units slightly favored). Returns `[{ k, plan }]`, seven distinct types.
2. **Its pick.** `draftPick(cards, cmdr)` in ai.js — pure, zero draws: score each card by profile (bold: units 2; cautious: towers 2 + plans 1; stubborn: towers 2 + units 1), stable-sort, take five; deal order breaks ties.
3. **The boot.** musterFreshStart: commander (1 draw) → `S.draft = draftDeal(...)` (7) → enemy's seven (7) → `draftPick` → apply: a PLAN pushes the tag into `S.foe.unlocked` (tower plans into `S.foe.towers`); a UNIT fields through `mirrorFieldKey` draw-free. The player fields nothing at boot — the pick screen and placement do that.
4. **The pick screen.** TAKE COMMAND opens the draft overlay: seven cards (label, kind badge UNIT/PLAN, tap toggles, five max, live counter), CONFIRM FIVE arms at exactly five. Confirm splits: plans → `S.manifest.unlocked` (free), units → `S._placeQueue` → the existing deal-card placement flow verbatim (ticker counts off the real queue length now, not a literal 4). Shared DOM — phone and desktop by construction.
5. **The manual and the till.** THE HAND YOU'RE DEALT re-teaches to the draft (owner-approved copy below), MANUAL_REV 4 → 5 (the tour returns). `makeRunState` startResources default and HUD0 both 120 → 250.
6. **Interaction checklist:** the keystone never boots the muster — expected unmoved (843448507/749); saves only exist post-start — `S.draft` is transient and never rides (a reload before TAKE COMMAND redeals identically off the seed); the bell's contract is untouched (14 draws — movement = stop); `dealHand` dies and its pins re-teach to `draftDeal`; the deal-card wiring pins (openInfo "deal", the ticker-yield, the pick-grid-is-gone) all survive by construction.

Dials, provisional (F5): PLAN_ODDS 0.4, start scrap 250, the profile score table.

## Sweep license (each site pre-named; count-neutral; anything beyond = honest stop)

- **09 T19(b):** draws 9 → 15 (the new boot contract, message re-worded); (b3) seed-91 garrison count re-bases measured old → new (the enemy now fields only its PICKED units); (b2)/(b4)/(b5) must hold as properties.
- **10 T6v2:** draws 9 → 15; "his picks fielded something" re-teaches to "his five landed — men afield OR plans on his ledgers" (`w.bodies.some(team 2 alive) || S6.foe.unlocked.length > 0 || S6.foe.towers.length > 0`); line 278's "T8: the player's hand is four distinct pool keys" re-teaches to the draft (`S6.draft.length === 7`, seven distinct `k`, every k in the pool, kinds 0/1).
- **10 T8 (lines 359–364):** the two dealHand pins re-teach to draftDeal — seven draws always; seven distinct under a forced-collision rng. Count-neutral (2 for 2). The T8 wiring pins (368–374) stand untouched.
- **11 T2(f):** `MANUAL_REV = 4` → `= 5`; T2(f2)'s "Nine linked cards" count stands (a card re-worded, none added).
- **09 T23(b) (Amendment 1 — found by the agent's honest stop; the plan-writer's ledger missed it):** `scripts/tests/09-reorg.mjs:650` pins the same literal `MANUAL_REV = 4` regex — the identical kind already licensed above; re-teaches identically, 4 → 5, message noting the draft's re-tour.
- **Value-shift license (standing):** fixed-seed boot outcomes shift with the new contract; numeric re-bases measured old → new; draw-count movement anywhere = stop.

## The steps

**Step 1 — the failing asserts.** Append to `scripts/tests/11-hiring-hall.mjs`. Imports: `draftDeal, musterFreshStart` join the muster import (PICK_POOL there); `draftPick, CMDRS` as a new ai.js import; `makeGrid` already available via mapgen import; `HUD0` joins the state import; `MANUAL_REV` as a new import from `"../../src/ui/FieldManual.jsx"` is NOT possible (JSX) — the manual pins stay source-read, as T2(f) already does.

```js
// ---- P7.2 T8 (mk1.89): THE OPENING DRAFT — seven dealt, five picked, free
{
  // (a) the deal: seven draws, seven distinct types, kind from the fraction
  {
    let n = 0; const raw = mulberry32(130); const rng = () => { n++; return raw(); };
    const d = draftDeal(rng, HAND_KEYS);
    ok("T8v2(a): seven draws, seven cards, seven distinct types",
      n === 7 && d.length === 7 && new Set(d.map((c) => c.k)).size === 7 && d.every((c) => HAND_KEYS.includes(c.k) && (c.plan === 0 || c.plan === 1)));
    let units = 0, plans = 0, heroes = 0;
    for (let seed = 1; seed <= 100; seed++) {
      for (const c of draftDeal(mulberry32(seed), HAND_KEYS)) {
        if (c.plan) plans++; else units++;
        if (c.k === "hero_bison" || c.k === "hero_apc") heroes++;
      }
    }
    ok("T8v2(a2): both kinds deal across 100 seeds, units favored", units > plans && plans > 100);
    ok("T8v2(a3): heroes deal at plain odds — a lucky war is real (owner)", heroes > 0, heroes);
  }
  // (b) its pick: commander-colored, deterministic, zero draws, always five
  {
    const cards = [
      { k: "sq_rifles", plan: 0 }, { k: "gun", plan: 0 }, { k: "mortar", plan: 1 },
      { k: "sq_mg", plan: 0 }, { k: "hero_bison", plan: 0 }, { k: "sq_sappers", plan: 1 }, { k: "frost", plan: 1 },
    ];
    const bold = draftPick(cards, "bold"), caut = draftPick(cards, "cautious"), stub = draftPick(cards, "stubborn");
    ok("T8v2(b): every profile picks exactly five", bold.length === 5 && caut.length === 5 && stub.length === 5);
    ok("T8v2(b2): bold takes every unit before any plan",
      cards.filter((c) => !c.plan).every((c) => bold.includes(c)));
    ok("T8v2(b3): cautious leads with towers and plans; stubborn with standing towers",
      caut.filter((c) => ["mg", "gun", "mortar", "rocket", "frost"].includes(c.k)).length === 3 &&
      stub.includes(cards[1]) && stub.includes(cards[6]));
    ok("T8v2(b4): the pick is pure — same cards, same commander, same five",
      JSON.stringify(draftPick(cards, "cautious")) === JSON.stringify(caut));
  }
  // (c) the boot: fifteen draws; the player holds seven; its five land
  {
    makeMap(94);
    const flatF8 = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (x, z, o) => { o.x = 0; o.y = 1; o.z = 0; return o; } };
    const w = makeWorld({ field: flatF8, seed: 131 });
    let draws = 0; const raw = w.rng; w.rng = () => { draws++; return raw(); };
    const S8 = { reg: { heads: 60 }, squads: [], nextSquadId: 1, cmdr: null };
    const G8 = makeGrid(flatF8);
    musterFreshStart(w, S8, TOWN.find((t) => t.depot && t.team !== 2), G8, flatF8, () => 1);
    ok("T8v2(c): the boot draws exactly fifteen (commander 1 + seven + seven)", draws === 15, draws);
    ok("T8v2(c2): the player holds seven distinct cards and fields nothing",
      S8.draft.length === 7 && new Set(S8.draft.map((c) => c.k)).size === 7 && !w.bodies.some((b) => b.team === 1 && b.alive));
    ok("T8v2(c3): its five landed — men afield or plans on its ledgers",
      w.bodies.some((b) => b.team === 2 && b.alive) || S8.foe.unlocked.length > 0 || S8.foe.towers.length > 0);
  }
  // (d) the wiring: the pick screen, the split, the till
  {
    const src = fs.readFileSync("src/depot/DepotGame.jsx", "utf8");
    ok("T8v2(d): the draft screen exists on its own attributes, confirm arms at five",
      /data-draft-card=/.test(src) && /data-draft-confirm/.test(src) && /picked\.length === 5/.test(src));
    ok("T8v2(d2): confirm splits — plans open the bar free, units join the place queue",
      /S\.confirmDraft = \(picked\) => \{/.test(src) && /S\.manifest\.unlocked\.push\(c\.k\)/.test(src) && /S\._placeQueue = picked\.filter\(\(c\) => !c\.plan\)\.map\(\(c\) => c\.k\);/.test(src));
    ok("T8v2(d3): the ticker counts the real queue", /S\._placeTotal/.test(src) && !/n} of 4\)/.test(src));
    ok("T8v2(d4): the till opens at 250 // provisional (F5)", makeRunState().resources === 250 && HUD0.resources === 250);
  }
  // (e) the manual learns the draft
  {
    const fm = fs.readFileSync("src/ui/FieldManual.jsx", "utf8");
    ok("T8v2(e): the tour returns for the draft (MANUAL_REV 5) and the card tells it",
      /export const MANUAL_REV = 5;/.test(fm) && /seven dealt cards/.test(fm) && /Pick five, free/.test(fm));
  }
}
```

Fifteen checks — (a) 3, (b) 4, (c) 3, (d) 4, (e) 1. Expected suite after all steps: **1613/0** (1598 + 15, the sweep count-neutral). Run now: RED confined to this block plus the ledger's own pre-change sites — the failing-first proof.

**Step 2 — the deal and the pick.**

`src/depot/muster.js` — dealHand and its comment DIE; in their place:

```js
// P7.2 T8 (owner): THE OPENING DRAFT — seven cards each side, seven splice
// draws, seven DISTINCT types; each card's unit-or-plan kind derives from
// the SAME draw's residual fraction (no extra draws — the engBuildKind
// idiom). Heroes deal at plain odds (owner: a drafted Bison is a lucky
// war). PLAN_ODDS is the plan share. // provisional (F5)
export const PLAN_ODDS = 0.4;
export function draftDeal(rng, keys) {
  const rest = keys.slice(), out = [];
  for (let d7 = 0; d7 < 7; d7++) {
    const d = rng();
    const j = Math.min(rest.length - 1, Math.floor(d * rest.length));
    out.push({ k: rest.splice(j, 1)[0], plan: (d * rest.length + j) % 1 < PLAN_ODDS ? 1 : 0 });
  }
  return out;
}
```

(the kind fraction uses `(d * rest.length + j) % 1` — the raw residual of the type pick, uniform and draw-free; `rest.length` here is the post-splice length, deterministic either way — the agent applies this line verbatim.)

`src/depot/ai.js` — after cmdrBellOrders:

```js
// P7.2 T8 (owner): THE DRAFT PICK, commander-colored — pure, ZERO draws.
// Bold takes units; cautious takes towers and plans; stubborn takes
// standing defensive iron first. Stable sort; deal order breaks ties.
const DRAFT_TOWERS = ["mg", "gun", "mortar", "rocket", "frost"];
export function draftPick(cards, cmdr) {
  const score = (c) => {
    const tower = DRAFT_TOWERS.indexOf(c.k) >= 0;
    if (cmdr === "bold") return c.plan ? 0 : 2;
    if (cmdr === "cautious") return (tower ? 2 : 0) + (c.plan ? 1 : 0);
    return (tower ? 2 : 0) + (c.plan ? 0 : 1); // stubborn
  };
  return cards.slice().sort((a, b) => score(b) - score(a)).slice(0, 5);
}
```

**Step 3 — the boot.** `src/depot/muster.js`, musterFreshStart's deal block (the two dealHand lines and the mirrorPicks loop) becomes:

```js
  // P7.2 T8 (owner): THE OPENING DRAFT — the player's seven (held for the
  // pick screen; nothing player-side fields at boot), then its seven,
  // picked commander-colored (zero draws) and applied: plans push its
  // ledgers (a tower plan starts the one-build-a-bell engine from bell
  // one), units field through the dealt-hand mirror, draw-free. Draws
  // here: exactly 15, any seed (commander 1 + 7 + 7), all before the
  // early return.
  S.draft = draftDeal(world.rng, PICK_POOL.map((p) => p.key));
  const eCards = draftDeal(world.rng, PICK_POOL.map((p) => p.key));
  const depotE = TOWN.find((tt) => tt.depot && tt.team === 2);
  if (!depotE || !grid || !field) return;
  if (!S.foe) S.foe = { unlocked: [], hired: [], towers: [] };
  if (!S.foe.towers) S.foe.towers = [];
  for (const c of draftPick(eCards, S.cmdr)) {
    if (c.plan) {
      if (HAND_TAGS[c.k] === undefined) { if (S.foe.towers.indexOf(c.k) < 0) S.foe.towers.push(c.k); }
      else if (S.foe.unlocked.indexOf(HAND_TAGS[c.k]) < 0) S.foe.unlocked.push(HAND_TAGS[c.k]);
    } else {
      mirrorFieldKey(world, S, depotE, grid, field, c.k, nextApcSeq);
    }
  }
```

with the imports: muster.js gains `HAND_TAGS` in its specs import and `draftPick` from `"./ai.js"`; the old `mirrorPicks`/gR/mi/spawnMirrorMan loop inside musterFreshStart dies (spawnMirrorMan itself stays — mirrorFieldKey uses it).

**Step 4 — the pick screen.** `src/depot/DepotGame.jsx`:
- startGame's deal branch becomes the draft door:

```js
    if (S.draft && S.draft.length && !S._draftDone) {
      // P7.2 T8: THE DRAFT — seven cards up, five picks, all free.
      setHud((h) => ({ ...h, drafting: S.draft.map((c) => ({ k: c.k, plan: c.plan })) }));
      return;
    }
```

- Beside pickManifest, the handler:

```js
      // P7.2 T8 (owner): the five picks are FREE — the pick is the payment.
      // Plans open the bar at once; units join the deal-placement queue.
      S.confirmDraft = (picked) => {
        if (!picked || picked.length !== 5) return;
        for (const c of picked) if (c.plan && S.manifest.unlocked.indexOf(c.k) < 0) S.manifest.unlocked.push(c.k);
        S._placeQueue = picked.filter((c) => !c.plan).map((c) => c.k);
        S._placeTotal = S._placeQueue.length;
        S._draftDone = true; S.draft = null;
        setHud((h) => ({ ...h, drafting: null, unlocked: S.manifest.unlocked.slice(), placing: S._placeQueue[0] || "done" }));
        if (S._placeQueue.length && S.openInfo) S.openInfo(S._placeQueue[0], "deal");
      };
```

- The draft overlay (a sibling of the pre-start overlay, shown when `hud.drafting`): seven buttons `data-draft-card={c.k}` `data-draft-kind={c.plan ? "plan" : "unit"}` (label + ⓘ-style kind badge + picked highlight), local component pick state, a counter line "PICKED n OF 5", and `<button data-draft-confirm disabled={picked.length !== 5} onClick={() => S.confirmDraft(picked)}>FIELD THESE FIVE</button>` — the exact JSX styled on the pre-start overlay's own P.btn idiom; layout is the agent's mechanical fit on that idiom (flex-wrap grid, 44px minimum touch targets both platforms).
- The place ticker: `const n = Math.max(1, 4 - remaining + 1);` becomes `const n = Math.max(1, (S._placeTotal || remaining) - remaining + 1);` and its label `({n} of 4)` becomes `({n} of {S && S._placeTotal ? S._placeTotal : remaining})`.
- The pre-start blurb line "The convoy deals you four units — read each card, place each one by hand near your depot, then take command." becomes "The convoy deals seven cards — pick five, free. Units place by your hand near the depot; plans open your build bar."
- `src/depot/state.js`: makeRunState's `startResources = 120` default → `250` (comment: `// P7.2 T8 (owner): the draft's richer opening // provisional (F5)`); HUD0's `resources: 120` → `resources: 250`.

**Step 5 — the manual.** `src/ui/FieldManual.jsx`: MANUAL_REV 4 → 5; THE HAND YOU'RE DEALT's body becomes (owner-approved copy, verbatim):

```js
  { title: "THE HAND YOU'RE DEALT", body: "Every war opens with seven dealt cards — units and plans together. Pick five, free. Units place by your hand near the depot; plans open your build bar. The enemy drafts five of its own. No two wars open alike." },
```

**Step 6 — the sweep** (the license's ledger, each old → new in the report).

**Step 7 — the gates and the deploy.** In order: `node scripts/depot-test.mjs` — expected **1613/0**; `node scripts/depot-lint.mjs` clean (draftDeal's rng is threaded, never Math.random); keystone 843448507/749 unmoved; bump `src/version.js` to `mk1.89` BEFORE `npm run build`; smoke — the smoke harness drives `__DEPOTSTART__()` which bypasses the overlay: verify the smoke stays green as-is; if a smoke section walks the real TAKE COMMAND door, drive the draft (pick five, confirm) — report which; green at mk1.89 on preview 4174 (stale 4173 stays). Gates green → `git add` → commit subject exactly `the opening draft (mk1.89)` → push. No golden needed — no engine or render-path file is touched.

## Trap notes

- `__DEPOTSTART__` sets `S.started` directly — headless boots and the smoke bypass the draft screen by construction; the T8v2(c) fixture drives musterFreshStart itself.
- The kind fraction must come from the SAME draw as the type (no extra draws) — the draw-count law's letter.
- The enemy's dedupe on plan application mirrors the Task 4 walk exactly (a duplicate tag or tower key pushes once).
- `S.draft`/`S._draftDone`/`S._placeTotal` never ride the save (pre-start only; a reload redeals identically off the seed).
- dealHand dies WITH its export — grep for stragglers before deleting; the 10-era pins re-teach per the ledger.
- The existing deal-placement flow (openInfo "deal", placePick, ghosts, homeland radius, ticker-yield) is untouched beyond the count label — its pins prove it.
- No edits to bell.js, market.js, economy.js, save.js, core.js, renderer, troopkit, portrait.

## The owner's live check

- TAKE COMMAND opens the seven-card draft — units and plans marked apart, five picks, FIELD THESE FIVE; the unit cards then deal and place exactly as before; picked plans sit on the build bar from second zero.
- 250 scrap on the opening HUD.
- The enemy's opening varies with its commander — some wars it stands towers up at bell zero, some it masses men, and a tower plan in its draft means its yard grows a tower a bell from the start.
- Phone and desktop both carry the screen.

## Report requirements

Fixture seeds named (130, 131, 94 new; 91/92 re-measured under the ledger, old → new where moved). Every sweep re-teach old → new, each its own labeled bullet. The smoke's TAKE COMMAND handling stated plainly. Deviations labeled; none stated as none. The suite count to the digit.
