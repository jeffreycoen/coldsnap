# TASK 4 — THE PAGED SERIES AND THE BRIEF COPY (mk2.42)

Owner's ruling, 2026-08-25: no more one popup per radial open — a surface's cards come as one pageable series (BACK / NEXT / SKIP), and every card's wording is cut to as brief as the fact survives. This task rewrites the copy and gives the door paging.

**Suggested model: Sonnet** — every edit and every word is in this plan.

## THE BRIEF COPY — all 28, verbatim, for your ruling

*(phone)* marks the touch voice where controls differ. Longest body is under 180 characters; the test pins that ceiling.

| # | key | title | body |
|---|---|---|---|
| 1 | `the_hand` | THE HAND | Seven cards dealt. Pick five, free. Units place near your depot; plans open your build bar. The enemy drafts its own five. |
| 2 | `placing` | PLACING | Tap ground near the depot. ✓ fields it, ✗ puts it back. Green ground is yours to use. |
| 3 | `scrap` | SCRAP | The till. One scrap a second, both sides. Kills pay more. |
| 4 | `bell` | THE BELL | Every 90 seconds: the convoy's offer. The war saves at every bell. |
| 5 | `kill_price` | THE SCORE | Every death is priced at its live market value. Yours green, theirs red. |
| 6 | `convoy` | THE CONVOY | The war waits while the window is up. Plans cost half and open the bar; hires field at once. LATER parks it until the next bell. |
| 7 | `fog` | SIGHT | What your side can't see, you can't shoot. This switch only paints the fog. |
| 8 | `wind` | WIND | One wind. Every shot drifts, both sides. OFF is dead calm. |
| 9 | `spare_ours` | SPARE OURS | On: the tesla and the atomic crew hold fire while your own stand in the blast. |
| 10 | `market` | THE MARKET | One market, both armies. What the field is full of costs more. One purchase a second. |
| 11 | `sell` | SELLING | 60 percent back. Tap SELL, then the tower or wall. |
| 12 | `defend` | DEFEND | Dig in where they stand. |
| 13 | `move` | MOVE | Tap the ground. They walk there without picking fights. |
| 14 | `attack` | ATTACK | Tap the ground. They fight their way there. |
| 15 | `possess_squad` | TAKE CONTROL | WASD walks. Mouse aims; hold left to fire. RELEASE hands them back. *(phone)* Left stick walks. Right stick aims; hold FIRE. RELEASE hands them back. |
| 16 | `select_all` | SELECT ALL | Every squad of this type joins the order. |
| 17 | `patrol` | PATROL | Two taps: start, far end. ✓ and they walk it forever. |
| 18 | `structures` | STRUCTURES | On: walls and towers before men. |
| 19 | `engineer_lines` | THE LINES | Two taps: start, far end. The ghost shows pieces and price. ✓ and they lay. |
| 20 | `sapper_lines` | MINES & WIRES | The same two taps, buried. Invisible to the enemy — theirs to you. Wires flare; mines wait. |
| 21 | `discipline` | CAREFUL / FREE | CAREFUL holds a shot that would hit your own stone. FREE fires regardless. |
| 22 | `possess_tower` | TAKE CONTROL | Mouse aims; hold left to fire. Your trigger — CAREFUL does not hold it for you. *(phone)* Right stick aims; hold FIRE. Your trigger — CAREFUL does not hold it for you. |
| 23 | `escort` | ESCORT | Tap a squad. The hull shadows it. |
| 24 | `tracks` | TRACKS | CAREFUL brakes for your own men. FREE does not. |
| 25 | `possess_vehicle` | TAKE CONTROL | WASD drives. Mouse aims; left fires the gun, right the coax. The APC has one gun — FIRE alone. *(phone)* Left stick drives; right stick aims. FIRE the gun, MG the coax. The APC has one gun — FIRE alone. |
| 26 | `possess_mech` | TAKE CONTROL | WASD walks; A/D turn, hold to pivot. Mouse aims. Hold left to fire; V missiles, B barrage, C punt, T about-face. *(phone)* Left stick walks; right stick turns, hard over pivots. Slider sets range, ◀ ▶ trim. FIRE, MSL, BRG, PUNT. |
| 27 | `load` | LOAD | LOAD: tap a squad; they board. Sealed seats — riders die with the hull. UNLOAD drops the ramp. |
| 28 | `desktop_keys` | THE KEYS | WASD pans. Q/E rotate — tap snaps, hold swings. Wheel zooms. M mutes. ESC leaves. |

## The paging mechanism

- `S.teachPie` enqueues **all** of a pie's unseen wedge cards (today: first one only). `teachFire`'s seen/queued gates dedupe.
- The queue gains an index: the card shown is `_teachQ[_teachIdx]`. NEXT marks the shown card seen and advances; BACK steps back (no unmarking); the last card's button reads CLOSE; SKIP ✕ marks the whole remainder seen and clears. A one-card queue is today's plain CLOSE — no counter, no skip.
- The chrome is the field manual's own (counter · BACK · NEXT · SKIP ✕) — the idiom this game's players already know, now inside `InfoCard` as a real `teach` door.
- The revision stamp bumps to 2 (material copy change — everyone is greeted once more). The load accepts the `"*"` sentinel at **any** revision, so the smoke test's silencer survives every future bump.

## Pre-licensed re-teaches (era 25, each old→new reported)

1. `T3: cards.js stamps the revision` — `TEACH_REV = 1` → `TEACH_REV = 2`.
2. `T3: closing marks seen and persists the set` — the marking lives in `teachNext` now; the pinned shape (`_teachSeen.add(k)` … `storage.set(CARDS_KEY`) is preserved inside it, so the pin survives unedited — stated here so a surprise pass is not mistaken for a stale check.
3. `T3: the pie teaches one card per open` — re-taught to pin the whole-series enqueue.

No test pins card prose (Task 2's checks are structural) — the copy rewrite breaks nothing.

## Required reading (read-confirmation opens the report)

1. This plan.
2. `src/depot/cards.js` (all).
3. `src/depot/InfoCard.jsx` (all).
4. `src/depot/DepotGame.jsx` — the Task-3 door block (search `THE FIRST-ENCOUNTER DOOR`), the hud tick's `teach:` line, and the `data-teach-card` render block.
5. `scripts/tests/25-the-teaching-cards.mjs` (all).

## Steps

### Step 1 — failing asserts first: era 25 edits

Replace the two named pins and append the Task-4 block:

Replace `ok("T3: cards.js stamps the revision", /export const TEACH_REV = 1;/...` with:

```js
  ok("T3: cards.js stamps the revision (re-taught T4: rev 2, the brief copy)", /export const TEACH_REV = 2;/.test(src("src/depot/cards.js")));
```

Replace `ok("T3: the pie teaches one card per open", ...)` with:

```js
  ok("T3/T4: the pie enqueues its whole series", /for \(const k of PIE_CARDS\[kind\]\(thing\)\) S\.teachFire\(k\);/.test(dg));
```

Append:

```js
// ---- Task 4 (mk2.42): THE PAGED SERIES AND THE BRIEF COPY
{
  const dg = src("src/depot/DepotGame.jsx");
  const ic = src("src/depot/InfoCard.jsx");
  ok("T4: the card carries the teach door's paging chrome",
    /door === "teach"/.test(ic) && /data-teach-next/.test(ic) && /data-teach-back/.test(ic) && /data-teach-skip/.test(ic));
  ok("T4: the queue pages by index", /_teachIdx/.test(dg) && /S\.teachBack = /.test(dg) && /S\.teachSkip = /.test(dg));
  ok("T4: the sentinel survives any revision", /d\.rev === TEACH_REV \|\| d\.seen\.includes\("\*"\)/.test(dg));
  ok("T4: every body is brief", Object.values(TEACH).every((c) => c.role.length <= 180 && (!c.roleTouch || c.roleTouch.length <= 180)));
}
```

Run `node scripts/gate.mjs depot-test` — the re-taught rev pin, the re-taught pie pin, and the four T4 checks FAIL (the brevity check fails on the long Task-2 bodies). Record the PASS count.

### Step 2 — `cards.js`: the brief copy and rev 2

Change `export const TEACH_REV = 1;` to `export const TEACH_REV = 2;` (comment line gains: `Rev 2 = Task 4, the brief copy.`).

Replace the whole `export const TEACH = { ... };` block with the table above as data — same shape as Task 2 (`label`, `role`, `roleTouch` where *(phone)* exists, `skills: []`, `desktopOnly: true` on `desktop_keys`):

```js
export const TEACH = {
  the_hand: { label: "THE HAND", role: "Seven cards dealt. Pick five, free. Units place near your depot; plans open your build bar. The enemy drafts its own five.", skills: [] },
  placing: { label: "PLACING", role: "Tap ground near the depot. ✓ fields it, ✗ puts it back. Green ground is yours to use.", skills: [] },
  scrap: { label: "SCRAP", role: "The till. One scrap a second, both sides. Kills pay more.", skills: [] },
  bell: { label: "THE BELL", role: "Every 90 seconds: the convoy's offer. The war saves at every bell.", skills: [] },
  kill_price: { label: "THE SCORE", role: "Every death is priced at its live market value. Yours green, theirs red.", skills: [] },
  convoy: { label: "THE CONVOY", role: "The war waits while the window is up. Plans cost half and open the bar; hires field at once. LATER parks it until the next bell.", skills: [] },
  fog: { label: "SIGHT", role: "What your side can't see, you can't shoot. This switch only paints the fog.", skills: [] },
  wind: { label: "WIND", role: "One wind. Every shot drifts, both sides. OFF is dead calm.", skills: [] },
  spare_ours: { label: "SPARE OURS", role: "On: the tesla and the atomic crew hold fire while your own stand in the blast.", skills: [] },
  market: { label: "THE MARKET", role: "One market, both armies. What the field is full of costs more. One purchase a second.", skills: [] },
  sell: { label: "SELLING", role: "60 percent back. Tap SELL, then the tower or wall.", skills: [] },
  defend: { label: "DEFEND", role: "Dig in where they stand.", skills: [] },
  move: { label: "MOVE", role: "Tap the ground. They walk there without picking fights.", skills: [] },
  attack: { label: "ATTACK", role: "Tap the ground. They fight their way there.", skills: [] },
  possess_squad: { label: "TAKE CONTROL", role: "WASD walks. Mouse aims; hold left to fire. RELEASE hands them back.", roleTouch: "Left stick walks. Right stick aims; hold FIRE. RELEASE hands them back.", skills: [] },
  select_all: { label: "SELECT ALL", role: "Every squad of this type joins the order.", skills: [] },
  patrol: { label: "PATROL", role: "Two taps: start, far end. ✓ and they walk it forever.", skills: [] },
  structures: { label: "STRUCTURES", role: "On: walls and towers before men.", skills: [] },
  engineer_lines: { label: "THE LINES", role: "Two taps: start, far end. The ghost shows pieces and price. ✓ and they lay.", skills: [] },
  sapper_lines: { label: "MINES & WIRES", role: "The same two taps, buried. Invisible to the enemy — theirs to you. Wires flare; mines wait.", skills: [] },
  discipline: { label: "CAREFUL / FREE", role: "CAREFUL holds a shot that would hit your own stone. FREE fires regardless.", skills: [] },
  possess_tower: { label: "TAKE CONTROL", role: "Mouse aims; hold left to fire. Your trigger — CAREFUL does not hold it for you.", roleTouch: "Right stick aims; hold FIRE. Your trigger — CAREFUL does not hold it for you.", skills: [] },
  escort: { label: "ESCORT", role: "Tap a squad. The hull shadows it.", skills: [] },
  tracks: { label: "TRACKS", role: "CAREFUL brakes for your own men. FREE does not.", skills: [] },
  possess_vehicle: { label: "TAKE CONTROL", role: "WASD drives. Mouse aims; left fires the gun, right the coax. The APC has one gun — FIRE alone.", roleTouch: "Left stick drives; right stick aims. FIRE the gun, MG the coax. The APC has one gun — FIRE alone.", skills: [] },
  possess_mech: { label: "TAKE CONTROL", role: "WASD walks; A/D turn, hold to pivot. Mouse aims. Hold left to fire; V missiles, B barrage, C punt, T about-face.", roleTouch: "Left stick walks; right stick turns, hard over pivots. Slider sets range, ◀ ▶ trim. FIRE, MSL, BRG, PUNT.", skills: [] },
  load: { label: "LOAD", role: "LOAD: tap a squad; they board. Sealed seats — riders die with the hull. UNLOAD drops the ramp.", skills: [] },
  desktop_keys: { label: "THE KEYS", role: "WASD pans. Q/E rotate — tap snaps, hold swings. Wheel zooms. M mutes. ESC leaves.", desktopOnly: true, skills: [] },
};
```

### Step 3 — `InfoCard.jsx`: the real teach door

3a. Signature (line 8) gains two props: `onBack, series` —

```js
export default function InfoCard({ card, price, armed, door, portrait, onConfirm, onCancel, afford, onBack, series }) {
```

3b. Directly above the label line (`<div style={{ color: "#9fdcff", ...`), the series header — counter left, SKIP right, only when paging:

```jsx
      {door === "teach" && series && series.n > 1 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
          <span style={{ fontSize: 10, letterSpacing: 2, opacity: 0.6 }}>{series.i + 1}/{series.n}</span>
          <button data-teach-skip style={{ ...B, minHeight: 0, minWidth: 0, padding: "2px 8px", fontSize: 10, opacity: 0.8 }} onClick={onCancel}>SKIP ✕</button>
        </div>
      )}
```

3c. In the footer's door chain, a `teach` branch before the final else (between the `"deal"` branch and the fallback):

```jsx
        ) : door === "teach" ? (
          <>
            {series && series.i > 0 && <button data-teach-back style={B} onClick={onBack}>← BACK</button>}
            <button data-teach-next style={{ ...B, flex: 1, borderColor: "#9fd4e4", color: "#9fd4e4" }} onClick={onConfirm}>
              {series && series.i < series.n - 1 ? "NEXT →" : "CLOSE"}
            </button>
          </>
        ) : (
```

### Step 4 — `DepotGame.jsx`: paging state and handlers

4a. In the S literal, the Task-3 line `_teachQ: [], _teachSeen: null,` gains the index:

```js
        _teachQ: [], _teachIdx: 0, _teachSeen: null, // Task 3/4: the door — the queue pages by index; seen null until the load lands
```

4b. Replace `S.teachClose = () => { ... };` (whole function) with:

```js
      S.teachNext = () => {
        const k = S._teachQ[S._teachIdx];
        if (k && S._teachSeen) {
          S._teachSeen.add(k);
          try { window.storage.set(CARDS_KEY, JSON.stringify({ rev: TEACH_REV, seen: [...S._teachSeen] })); } catch (e) {}
        }
        S._teachIdx++;
        if (S._teachIdx >= S._teachQ.length) { S._teachQ = []; S._teachIdx = 0; }
      };
      S.teachBack = () => { if (S._teachIdx > 0) S._teachIdx--; };
      S.teachSkip = () => {
        if (S._teachSeen) {
          for (const k of S._teachQ) S._teachSeen.add(k);
          try { window.storage.set(CARDS_KEY, JSON.stringify({ rev: TEACH_REV, seen: [...S._teachSeen] })); } catch (e) {}
        }
        S._teachQ = []; S._teachIdx = 0;
      };
```

4c. Replace `S.teachPie`'s body — the whole series enqueues:

```js
      S.teachPie = (kind, thing) => {
        if (!thing || !S._teachSeen || S._teachSeen.has("*")) return;
        for (const k of PIE_CARDS[kind](thing)) S.teachFire(k);
      };
```

4d. The load accepts the sentinel at any revision — replace the load's accept line:

```js
          if (d && Array.isArray(d.seen) && (d.rev === TEACH_REV || d.seen.includes("*"))) seen = d.seen;
```

4e. hud tick — the `teach:` line becomes:

```js
              teach: S._teachQ.length ? { key: S._teachQ[S._teachIdx], i: S._teachIdx, n: S._teachQ.length } : null,
```

4f. The render block — the InfoCard call gains the paging props (the wrapper and voice line stay):

```jsx
              <InfoCard card={card} door="teach" series={{ i: hud.teach.i, n: hud.teach.n }}
                onConfirm={() => { const S = stateRef.current; if (S && S.teachNext) S.teachNext(); }}
                onBack={() => { const S = stateRef.current; if (S && S.teachBack) S.teachBack(); }}
                onCancel={() => { const S = stateRef.current; if (S && S.teachSkip) S.teachSkip(); }} />
```

### Step 5 — gates

- `node scripts/gate.mjs depot-test` — green; state the arithmetic against Step 1's count.
- `node scripts/gate.mjs depot-lint` — green.
- `node scripts/gate.mjs smoke` — green (the sentinel now survives the rev bump by 4d).

### Step 6 — the deploy

Bump `src/version.js` to `mk2.42`; build after the bump; commit ("the teaching cards — the paged series and the brief copy, mk2.42"); push. The owner's live check — a fresh war's radial series on phone and desktop — is the acceptance.

## Report

Read-confirmation, one line of outcome, PASS counts before/after with each re-teach old→new, gates and verdicts, commit hash, seeds (smoke's pinned 11; eras none).
