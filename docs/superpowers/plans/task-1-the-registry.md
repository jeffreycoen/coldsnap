# TASK 1 — THE REGISTRY (mk2.39)

Design: `tutorial-cards-and-launch-design.md`. This task gives the cards one home: `src/depot/cards.js`. The 19 market cards move in verbatim; a teaching-card table opens beside them, empty until Task 2 writes the copy. Nothing the player sees changes.

**Suggested model: Sonnet** — a verbatim move, a shim, and one small test file; no design judgment.

## One deviation from the design skeleton, for your ruling at approval

The design's task 1 line included "card keys on every carded control." This plan moves that wiring into Tasks 3 and 4 (the doors), where the keys are consumed — inert `card:` fields added now would sit untested until then and double this task's edit surface. If you want the keys landed now anyway, say so and this plan gets an amendment.

## Two facts found at plan time

- `scripts/tests/10-command-refit.mjs:17` and `11-hiring-hall.mjs:15` import `CARDS`/`cardFor` from `src/depot/infocards.js` by path. So `infocards.js` stays as a one-line re-export shim — no test edits, no sweep license spent.
- `InfoCard.jsx:47-49` already renders a plain CLOSE button for any unknown door. The design's `teach` door therefore needs **no InfoCard edit** — `door="teach"` falls to CLOSE today. Pinned by the new test instead of coded.

## Required reading (the agent confirms this list read, first line of its report)

1. This plan.
2. `src/depot/infocards.js` (all 47 lines — the moving body).
3. `src/depot/InfoCard.jsx` (all 53 lines — the door fallback).
4. `scripts/tests/harness.mjs` and `scripts/tests/24-the-quartermaster.mjs` lines 1–20 (the era-file pattern).
5. `scripts/depot-test.mjs` (the import roster).

## VERBATIM-MOVE INVENTORY

What moves: `src/depot/infocards.js` lines 5–47 — the two imports, `ORDERS_ARMED`, `ORDERS_TOWER`, `ORDERS_HULL`, `dmgOf`, `sq`, `tw`, `CARDS`, `cardFor` — into `src/depot/cards.js`, byte-identical.

SUBSTITUTION TABLE (the only tokens allowed to differ):

| Old | New |
|---|---|
| header comment lines 1–4 of infocards.js | the new header block shown in Step 2 |

An unlisted difference stops the agent.

ARITHMETIC ACCEPTANCE: `Object.keys(CARDS).length === 19` through the shim; shim and home export the identical object (`===`); `node scripts/gate.mjs depot-test` exits 0 with exactly 6 more PASS lines than the pre-change run (the agent records both counts).

## Steps

### Step 1 — the failing asserts first: `scripts/tests/25-the-teaching-cards.mjs` (new file)

```js
// COLDSNAP suite era 25 — THE TEACHING CARDS (mk2.39-). Task 1: the
// registry. cards.js is the one home; infocards.js is a re-export shim so
// the older eras' import path stands. No seed is special; no seed is used.
import { ok } from "./harness.mjs";
import { readFileSync } from "node:fs";
import { CARDS, cardFor, TEACH } from "../../src/depot/cards.js";
import { CARDS as CARDS_SHIM, cardFor as cardFor_shim } from "../../src/depot/infocards.js";

const src = (p) => readFileSync(new URL("../../" + p, import.meta.url), "utf8");

ok("T1: the registry holds the nineteen market cards", Object.keys(CARDS).length === 19);
ok("T1: the shim serves the identical object", CARDS === CARDS_SHIM && cardFor === cardFor_shim);
ok("T1: the shim is one re-export and nothing else",
  /^export \{ CARDS, cardFor, TEACH \} from "\.\/cards\.js";\s*$/m.test(src("src/depot/infocards.js").replace(/^\/\/.*$/gm, "").trim()));
ok("T1: the teaching table stands, empty until Task 2", TEACH && typeof TEACH === "object" && Object.keys(TEACH).length === 0);
ok("T1: cardFor reads teaching cards after market cards", /TEACH\[key\] \|\| CARDS\[key\] \|\| null/.test(src("src/depot/cards.js")));
ok("T1: an unknown door falls to CLOSE (the teach door needs no code)",
  /data-info-close/.test(src("src/depot/InfoCard.jsx")));
```

Register it: in `scripts/depot-test.mjs`, after the line `await import("./tests/24-the-quartermaster.mjs");`, add:

```js
await import("./tests/25-the-teaching-cards.mjs");
```

Run `node scripts/gate.mjs depot-test` — the six new checks FAIL (no cards.js). Record the total PASS count of this run.

### Step 2 — `src/depot/cards.js` (new file): the moved body under the new header

The file is the header below, then infocards.js lines 5–47 byte-identical, then the two additions below the moved block.

```js
// COLDSNAP DEPOT — cards.js: THE CARD REGISTRY (Task 1, mk2.39). One home
// for every card the game shows. CARDS is the market's nineteen (moved
// verbatim from infocards.js, which now re-exports from here); TEACH is the
// teaching table — empty until Task 2 writes the owner-ruled copy. Numbers
// are READ from the live spec tables at load — a card can never drift from
// the gun it describes. Pure data.
```

Additions after the moved `CARDS` block, replacing the old `cardFor` line:

```js
// TEACH — the teaching cards (Task 2 fills this; Tasks 3/4/7 serve it).
export const TEACH = {};
export const cardFor = (key) => TEACH[key] || CARDS[key] || null;
```

Note: the moved block's own `export const cardFor` line (old infocards.js:47) is superseded by the line above — it is the one line of the moved body that does not survive, and it is listed here so the inventory stays honest: the move is lines 5–46 byte-identical, line 47 replaced by the two-line addition.

### Step 3 — `src/depot/infocards.js` becomes the shim (whole file replaced)

```js
// COLDSNAP DEPOT — infocards.js: a re-export shim (Task 1, mk2.39). The
// registry lives in cards.js; this path stands so the older test eras'
// imports keep resolving. Add nothing here.
export { CARDS, cardFor, TEACH } from "./cards.js";
```

`DepotGame.jsx:19` (`import { cardFor } from "./infocards.js";`) is left untouched — it resolves through the shim.

### Step 4 — gates

- `node scripts/gate.mjs depot-test` — all green, PASS count = Step 1's count + 6.
- `node scripts/gate.mjs depot-lint` — green (cards.js joins `src/depot`; it holds no `Math.random`).

No other gates: no runtime behavior, no rendering, no seed, no save shape touched.

### Step 5 — the deploy

- Bump `src/version.js` to `mk2.39`.
- Build after the bump, commit, push. The owner's live check is the acceptance.

## Report

One line of outcome, then: the two PASS counts (before/after), the fixture seeds (none — no seed is used, stated per the standing order), any nonconformity as its own labeled bullet.
