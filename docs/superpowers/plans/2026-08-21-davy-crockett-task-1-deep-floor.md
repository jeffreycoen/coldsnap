# The Davy Crockett, task 1 — the deep floor (mk2.07)

The engine's crater carve clamps every hole at minus 1.5 meters absolute. This task makes that clamp a per-field dial: the default stays the frozen minus 1.5, byte-identical for the demo and the golden gate; the war sets its own deep floor so the coming atomic crater has room. A guarded additive divergence in the engine core, ruled by the owner in the approved design document (`docs/superpowers/specs/2026-08-21-davy-crockett-design.md`).

Symmetry: no asymmetry exists in this task — the floor is a property of the ground, read by every carve on either side.

**Suggested model: Sonnet** — three small edits and three checks, all code carried in the plan.

## Required reading

- This plan.
- `src/engine/core.js` lines 113–150 (makeField and its carve).
- `src/depot/DepotGame.jsx` lines 925–941 (the boot's makeField call).
- `scripts/depot-test.mjs` (the runner, whole file — 32 lines).
- `scripts/tests/15-the-open-siege.mjs` lines 1–13 (the era-file header idiom).

## Step 1 — the failing checks

Create `scripts/tests/16-the-deep-floor.mjs`:

```js
// COLDSNAP suite era 16 — THE DEEP FLOOR (mk2.07). The crater carve's
// minus-1.5 clamp becomes a per-field dial: default frozen, the war digs
// deeper. Fixture seed: 1. No seed is special.
import { ok } from "./harness.mjs";
import fs from "node:fs";
import { makeField } from "../../src/engine/core.js";

{
  const f = makeField(9, 2.0, 1);
  f.carve(0, 0, 4, 20);
  ok("deep floor: default carve still clamps at -1.5", Math.abs(f.heightAt(0, 0) - -1.5) < 1e-4);
  const f2 = makeField(9, 2.0, 1);
  f2.carveFloor = -12;
  f2.carve(0, 0, 4, 20);
  ok("deep floor: a dialed field carves past the old clamp", Math.abs(f2.heightAt(0, 0) - -12) < 1e-4);
  const src = fs.readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");
  ok("deep floor: the war sets its own floor at boot", src.includes("field.carveFloor = -12"));
}
```

Register it in `scripts/depot-test.mjs`: after the line `await import("./tests/15-the-open-siege.mjs");` (line 31), before `finish();`, insert:

```js
await import("./tests/16-the-deep-floor.mjs");
```

Run `node scripts/gate.mjs depot-test`. The three new checks must FAIL (the first passes today by accident of the clamp; the second and third fail). Confirm at least the second and third fail before touching the engine.

## Step 2 — the dial in the engine core

`src/engine/core.js`. In makeField (line 114), the field object opens at line 117:

```js
  const F = {
    n, cs, h, half,
```

Add the dial with its guard comment, immediately after that opening line:

```js
    // DIVERGENCE (guarded, mk2.07): the carve floor is a per-field dial.
    // Default is the frozen demo's own -1.5, so every mode that never sets
    // it — demo, sandbox, tower defense, campaign — carves byte-identically
    // (golden proves it). The war (DepotGame.jsx) dials it deeper for the
    // atomic crater.
    carveFloor: -1.5,
```

Then line 143 (inside carve):

```js
        h[j * n + i] = Math.max(-1.5, h[j * n + i] - depth * k);
```

becomes:

```js
        h[j * n + i] = Math.max(F.carveFloor, h[j * n + i] - depth * k);
```

No other line in the engine moves.

## Step 3 — the war dials it

`src/depot/DepotGame.jsx` line 929:

```js
      const field = makeField(181, 2.0, MAP_SEED);
```

Immediately after that line, insert:

```js
      // mk2.07 (owner): THE DEEP FLOOR — the atomic crater needs room. Base
      // ground sits near +2; -12 leaves the full 10m pit plus overlap slack.
      field.carveFloor = -12; // provisional (F5)
```

The saved heightfield already carries deep values (save.js rounds to the millimeter, no clamp), so resume rides for free.

## Step 4 — gates

- `node scripts/gate.mjs depot-test` — green, the three new checks passing.
- `node scripts/gate.mjs golden` — green: the dialed default must keep the extracted demo engine bit-identical.

Any other failing check stops the task; no sweep license is granted (nothing here re-signs text).

## Step 5 — the landing

- Bump `src/version.js`: `mk2.06` → `mk2.07`.
- `npm run build` AFTER the bump.
- Commit: `the deep floor, mk2.07` — then push. The owner's live check is the acceptance.

## Report

One line of outcome, then: the two gate results verbatim, the fixture seed (1), and any deviation as its own labeled bullet.
