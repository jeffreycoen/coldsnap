# TASK 5 — THE MANUAL RETIRES; THE DOORS GO QUIET (mk2.43)

Design: `tutorial-cards-and-launch-design.md`. This task ends the double teaching: the 10-card field manual is deleted, the landing page drops to title, mark, and buttons, and the pre-start overlay drops to its buttons and the seed line. The teaching cards are the only teacher now.

**Suggested model: Sonnet** — deletions and licensed re-teaches, all specified here.

## What the player sees change

- A fresh war opens with no manual tour — the first cards arrive at their moments.
- The landing page loses the tagline and the three-law paragraph.
- The pre-start overlay loses its two paragraphs and the FIELD MANUAL button; TAKE COMMAND and the FIELD ORDER # line remain. (SHOW ME THE FRONT joins in the walk task.)

## Pre-licensed re-teaches (each old→new in the report)

| Pin | Fate |
|---|---|
| `smoke.mjs:82` — three-law literals present | re-taught: the door is quiet (both literals absent) |
| `smoke.mjs:225–229` — waits for `[data-manual]`, clicks SKIP (2 checks) | replaced by 1 check: no manual appears |
| `06-troops-physics.mjs:309` — "the door carries the three laws" | re-taught: the laws left for the teaching cards (absent) |
| `09-reorg.mjs` T23 block (5 checks reading FieldManual.jsx) | replaced by a 3-check tombstone (file gone, game forgot it) |
| `11-hiring-hall.mjs` (f) block (2 checks reading FieldManual.jsx) | replaced by 1 check: the facts live in the teaching cards |
| `11-hiring-hall.mjs` (e) T8v2 block (1 check reading FieldManual.jsx) | re-taught to pin the fact in `cards.js` |

Every remaining `readFileSync` of FieldManual.jsx must go — a read of a deleted file throws and kills the whole suite.

## Required reading (read-confirmation opens the report)

1. This plan.
2. `src/ui/StartScreen.jsx` (all).
3. `src/ui/FieldManual.jsx` (all — know what dies).
4. `src/depot/DepotGame.jsx` lines 40–60, 935–995, 5125–5160 (import, keys, manual state/effect, overlay, render).
5. `scripts/smoke.mjs` lines 78–90 and 210–235.
6. `scripts/tests/06-troops-physics.mjs` lines 300–320; `scripts/tests/09-reorg.mjs` lines 640–656; `scripts/tests/11-hiring-hall.mjs` lines 135–146 and 733–742.
7. `scripts/tests/25-the-teaching-cards.mjs` (all).

## Steps

### Step 1 — failing asserts first: append to era 25

The `src` helper exists; add `existsSync` to the fs import line of the era file (`import { readFileSync, existsSync } from "node:fs";` — the era currently imports `readFileSync` only; this line is the one permitted edit above the appended block).

```js
// ---- Task 5 (mk2.43): THE MANUAL RETIRES; THE DOORS GO QUIET
{
  const dg = src("src/depot/DepotGame.jsx");
  const ss = src("src/ui/StartScreen.jsx");
  ok("T5: the manual is gone from the tree", !existsSync(new URL("../../src/ui/FieldManual.jsx", import.meta.url)));
  ok("T5: the game forgot the manual", !/FieldManual/.test(dg) && !/MANUAL_KEY/.test(dg) && !/manualOpen/.test(dg));
  ok("T5: the front door is quiet", !/muster bell rings/.test(ss) && !/A winter war in real stone/.test(ss) && !/The save burns/.test(ss));
  ok("T5: the overlay is buttons and the seed line", !/They are coming for your depot/.test(dg) && !/The convoy deals seven cards/.test(dg) && /FIELD ORDER #/.test(dg));
}
```

Run `node scripts/gate.mjs depot-test` — the four FAIL. Record the PASS count.

### Step 2 — delete `src/ui/FieldManual.jsx` (git rm)

### Step 3 — `DepotGame.jsx`: the manual's roots come out

3a. Remove line 42: `import FieldManual, { MANUAL_REV } from "../ui/FieldManual.jsx";`

3b. Remove lines 49–52 (the MANUAL_KEY comment block and const). QM_KEY and its comment stay; the teaching-door comments that mention "the MANUAL_REV law" as history stay too — the pins test `MANUAL_KEY` and `FieldManual`, neither of which those comments carry.

3c. Remove line 942 (`const [manualOpen, setManualOpen] = useState(false);`) and its comment line 941.

3d. The first-entry effect (lines ~968–987, opening `if (resumeRef.current || dev) return;`) keeps only the quartermaster probe — the whole effect becomes:

```js
  useEffect(() => {
    if (resumeRef.current || dev) return; // a resumed war is not a first entry; the sandbox never speaks
    let live = true;
    (async () => {
      try {
        const r = await window.storage.get(QM_KEY);
        if (live && !r) setQmQuiet(false);
      }
      catch (e) {}
    })();
    return () => { live = false; };
  }, []);
```

3e. Remove `closeManual` (lines 988–991).

3f. The pre-start overlay (lines 5131–5153) becomes — paragraphs and the `data-menu="manual"` button cut, spacing joined:

```jsx
      {!hud.started && !hud.placing && !hud.drafting && !fatal && !dev && (
        <div style={P.ovl}>
          <div style={{ fontSize: 26, letterSpacing: 4, color: "#9fdcff" }}>COLDSNAP</div>
          <div style={{ fontSize: 13, letterSpacing: 8, color: "#ffd27a", marginBottom: 18 }}>WINTER FRONT</div>
          <button style={{ ...P.btn, fontSize: 15, padding: "10px 26px", borderColor: "#4aff8c", color: "#4aff8c" }} onClick={startGame}>
            TAKE COMMAND
          </button>
          <div style={{ fontSize: 10, opacity: 0.55, marginTop: 12, letterSpacing: 2 }}>FIELD ORDER #{hud.seed || "—"} · ?seed= replays a map</div>
        </div>
      )}
```

3g. Remove line 5155 (the `manualOpen && <FieldManual .../>` render line).

### Step 4 — `StartScreen.jsx`: the cuts

Remove line 60 (the tagline div `A winter war in real stone.`) and lines 63–67 (the three-law block). Nothing else moves.

### Step 5 — the licensed re-teaches

5a. `scripts/smoke.mjs:82` becomes:

```js
    ok("start screen is quiet — the laws teach in the war", !body.includes("The muster bell rings every 90 seconds") && !body.includes("The save burns"));
```

5b. `scripts/smoke.mjs:225–229` (the five manual-flow lines: waitForSelector, ok, click, waitForFunction, ok) become:

```js
    ok("depot: no manual greets the war — the teaching cards took its place", (await page.$("[data-manual]")) === null);
```

The `localStorage.removeItem("coldsnap-wf-manual")` token in the reset line above it stays — harmless, and the line is pinned elsewhere by nothing.

5c. `scripts/tests/06-troops-physics.mjs:309` becomes:

```js
  ok("T7 (re-taught mk2.43): the laws left the door for the teaching cards", !/muster bell rings/.test(ss) && !/real masonry/.test(ss) && !/The save burns/.test(ss));
```

5d. `scripts/tests/09-reorg.mjs` — the whole T23 block (lines 641–655, from the `// ==== P7 T23` header through its `// ==== end P7 T23` line) becomes:

```js
// ==== P7 T23: THE MANUAL — RETIRED (mk2.43: the teaching cards took the tour) =
{
  const dgSrc23 = fs.readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");
  ok("T23 (re-taught mk2.43): the manual left the tree", !fs.existsSync(new URL("../../src/ui/FieldManual.jsx", import.meta.url)));
  ok("T23 (re-taught mk2.43): the game forgot it", !/FieldManual/.test(dgSrc23) && !/MANUAL_KEY/.test(dgSrc23));
  ok("T23 (re-taught mk2.43): the mines lesson lives on as a card", /Wires flare; mines wait\./.test(fs.readFileSync(new URL("../../src/depot/cards.js", import.meta.url), "utf8")));
}
// ==== end P7 T23 =============================================================
```

5e. `scripts/tests/11-hiring-hall.mjs` — the (f) block (lines 140–146) becomes:

```js
  // (f) the manual retired (mk2.43) — the hand's truth lives in the cards
  {
    const cj = fs.readFileSync("src/depot/cards.js", "utf8");
    ok("T2(f) (re-taught mk2.43): the convoy's lesson is a card now", /the convoy's offer/.test(cj) && /hires field at once/.test(cj));
  }
```

5f. `scripts/tests/11-hiring-hall.mjs` — the (e) block (lines 735–740) becomes:

```js
  // (e) the manual retired (mk2.43) — the draft's truth lives in the cards
  {
    const cj = fs.readFileSync("src/depot/cards.js", "utf8");
    ok("T8v2(e) (re-taught mk2.43): the draft's lesson is a card now", /Seven cards dealt\. Pick five, free\./.test(cj));
  }
```

### Step 6 — gates

- `node scripts/gate.mjs depot-test` — green; state the arithmetic (checks removed vs added is not one-for-one: 09-reorg 5→3, 11-hiring-hall 3→2; the agent states the exact expected total from its Step 1 count and the ledger here, then confirms the run matches).
- `node scripts/gate.mjs depot-lint` — green.
- `node scripts/gate.mjs smoke` — green (2 checks removed, 1 added in the depot section; 1 re-taught in the start section).

### Step 7 — the deploy

Bump `src/version.js` to `mk2.43`; build after the bump; commit ("the manual retires; the doors go quiet, mk2.43"); push. The owner's live check — a fresh war with no tour, the quiet menu, phone and desktop — is the acceptance.

## Report

Read-confirmation, one line of outcome, PASS counts before/after with the check ledger (removed/added per file), each re-teach old→new, gates and verdicts, commit hash, seeds (smoke's pinned 11; eras none). Every nonconformity its own labeled bullet.
