# TASK 10 — THE WALK: SHOW ME THE FRONT (mk2.48)

Design: `tutorial-cards-and-launch-design.md`, as ruled 2026-08-25 — cards with hints only, the core list, ending back on the overlay. The walk is one paged series through the existing chrome: SHOW ME THE FRONT fills the teaching queue with the taught order; NEXT pages, BACK returns, SKIP ends it; the last CLOSE lands back on the overlay, and only TAKE COMMAND starts the war. Walked cards are marked seen by the machinery that already exists — this task adds a list, a button, and a hint line.

**Suggested model: Sonnet** — every edit and every word is here.

## THE WALK — the taught order and every hint, verbatim, for your ruling

The hint renders as its own quiet line on the card, in every door (a lookup shows it too). On touch the first stop is skipped (the keys card is desktop-only).

| # | card | hint |
|---|---|---|
| 1 | `desktop_keys` | The keys, whenever you hold the field. |
| 2 | `the_hand` | The first thing after TAKE COMMAND. |
| 3 | `placing` | Right after the draft. |
| 4 | `scrap` | Top bar — the ◆ count. |
| 5 | `bell` | Top bar — the clock. |
| 6 | `convoy` | It rings in with every bell. |
| 7 | `market` | Bottom bar — the BUILD crate. |
| 8 | `sell` | Inside the BUILD crates. |
| 9 | `defend` | Tap any squad — the ring of orders. |
| 10 | `move` | The same ring. |
| 11 | `attack` | The same ring. |
| 12 | `patrol` | The same ring. |
| 13 | `engineer_lines` | The engineers' own ring. |
| 14 | `structures` | The ring, armed squads only. |
| 15 | `select_all` | The same ring. |
| 16 | `fog` | Top bar — and the whole war. |

## Required reading (read-confirmation opens the report)

1. This plan.
2. `src/depot/cards.js` (all).
3. `src/depot/InfoCard.jsx` (all).
4. `src/depot/DepotGame.jsx` — the teaching-door block (search `THE FIRST-ENCOUNTER DOOR`) and the pre-start overlay (search `TAKE COMMAND`).
5. `scripts/tests/25-the-teaching-cards.mjs` (all).

## Steps

### Step 1 — failing asserts first: append to era 25

```js
// ---- Task 10 (mk2.48): THE WALK
{
  const dg = src("src/depot/DepotGame.jsx");
  const WALK_KEYS = ["desktop_keys", "the_hand", "placing", "scrap", "bell", "convoy", "market", "sell", "defend", "move", "attack", "patrol", "engineer_lines", "structures", "select_all", "fog"];
  ok("T10w: the walk list is the ruled sixteen, in order",
    (() => { const m = dg.match(/const WALK = \[([^\]]+)\]/); if (!m) return false; const got = m[1].match(/"[a-z_]+"/g).map((s) => s.slice(1, -1)); return got.length === 16 && got.every((k, i) => k === WALK_KEYS[i]); })());
  ok("T10w: the walk fills the queue and skips the desktop card on touch", /S\.teachWalk = /.test(dg) && /desktopOnly && isTouch/.test(dg));
  ok("T10w: the overlay offers the walk", /data-menu="walk"/.test(dg) && /SHOW ME THE FRONT/.test(dg));
  ok("T10w: the card carries the hint line", /data-card-hint/.test(src("src/depot/InfoCard.jsx")));
  ok("T10w: every walked card carries its hint", WALK_KEYS.every((k) => typeof TEACH[k].hint === "string" && TEACH[k].hint.length > 0));
}
```

Run `node scripts/gate.mjs depot-test` — the five FAIL. Record the PASS count.

### Step 2 — `cards.js`: the sixteen hints

Each walked entry gains a `hint` field with the table's text verbatim, e.g. `bell: { label: "THE BELL", role: "...", hint: "Top bar — the clock.", skills: [] },`. The twelve unwalked entries take nothing.

### Step 3 — `InfoCard.jsx`: the hint line

Directly after the `{row("PRICE", ...)}` line (before the SKILLS header), one line:

```jsx
      {card.hint && <div data-card-hint style={{ marginTop: 8, fontSize: 11, letterSpacing: 1, color: "#9fdcff", opacity: 0.85 }}>{card.hint}</div>}
```

### Step 4 — `DepotGame.jsx`: the list, the walk, the button

4a. In the teaching-door block, after `S.teachPie`'s close:

```js
      // Task 10 (mk2.48): THE WALK — the ruled taught order. SHOW ME THE
      // FRONT fills the queue whole (seen-state deliberately not consulted:
      // the walk replays for whoever asks); the paging chrome does the rest,
      // NEXT marks each seen, SKIP the remainder, and an empty queue lands
      // back on the overlay. Touch skips the desktop-only keys card.
      const WALK = ["desktop_keys", "the_hand", "placing", "scrap", "bell", "convoy", "market", "sell", "defend", "move", "attack", "patrol", "engineer_lines", "structures", "select_all", "fog"];
      S.teachWalk = () => {
        S._teachQ = WALK.filter((k) => TEACH[k] && !(TEACH[k].desktopOnly && isTouch));
        S._teachIdx = 0;
      };
```

4b. The pre-start overlay, between the TAKE COMMAND button and the FIELD ORDER line:

```jsx
          <button data-menu="walk" style={{ ...P.btn, marginTop: 14, opacity: 0.8, fontSize: 12, letterSpacing: 1 }}
            onClick={() => { const S = stateRef.current; if (S && S.teachWalk) S.teachWalk(); }}>
            SHOW ME THE FRONT
          </button>
```

### Step 5 — gates

- `node scripts/gate.mjs depot-test` — green, +5 over Step 1.
- `node scripts/gate.mjs depot-lint` — green.
- `node scripts/gate.mjs smoke` — green (the overlay gains a button no scripted flow touches; the walk fires only by tap).

### Step 6 — the deploy

Bump `src/version.js` to `mk2.48`; build after the bump; commit ("the walk — show me the front, mk2.48"); push. The owner's live check — the walk end to end on phone and desktop, SKIP mid-way, and a fresh war after it showing no re-interruptions for walked cards — is the acceptance.

## Report

Read-confirmation, one line of outcome, PASS counts before/after, gates and verdicts, commit hash, seeds (smoke's pinned 11; eras none). Every nonconformity its own labeled bullet.
