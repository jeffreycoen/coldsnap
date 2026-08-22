# The Davy Crockett, task 8 — the broken ridge (mk2.14)

Owner's ruling (2026-08-21, from the floating-rocks report): rocks in the blast are partially destroyed and the remaining parts tumble; everything follows physics; rock health drops if needed.

What the tree already holds: a rock that dies breaches — its terrain hump drains away, its ground unblocks, and nine real physics chunks spawn and tumble (`breachRock`, DepotGame.jsx:2793). That IS the ruling's tumbling remnant. Two defects kept it from firing:

1. **Rocks were unkillable by the blast.** Rock health is 380 + radius × 90 (roughly 740–830); the davy's blast delivers at most ~190 to a close rock. Health drops to 90 + radius × 20 (roughly 155–185) so one atomic blast breaks the rocks near the burst; farther rocks survive on distance falloff. The number is a design choice, provisional, the owner's dial — it also makes rocks softer to every other gun (a tank shell chips one in seven hits instead of thirty).
2. **Survivors floated.** The crater re-seat loop in the engine admits walls and towers, never rocks (core.js:712) — a surviving rock body hangs at its old height, and the rock's drawn dressing does too. The loop admits rocks (a guarded additive divergence — no demo or campaign world holds a rock body; golden rides the gates), rocks carry their true seat depth, and a davy burst re-lays the rock dressing so the drawn boulders sink to the carved ground.

Symmetry: the blast, the health, and the breach are one table and one path for both sides — nothing here knows a team.

Out of scope, stated: `src/game/ColdsnapTD.jsx` carries the same rock-health formula, but no davy exists in that mode; it is untouched.

**Suggested model: Sonnet** — four small edits and one test era, all code carried.

## Required reading

- This plan.
- `src/engine/core.js` lines 694–718 (the carve and the re-seat loop at 710–714).
- `src/depot/DepotGame.jsx` lines 1165–1175 (rock creation at 1169), 2793–2835 (breachRock, drainEvents at 2823).
- `scripts/tests/17-the-davy-crockett.mjs` whole (era idiom, the blast fixture).
- `scripts/depot-test.mjs` lines 30–40.

## Step 1 — the failing checks

Create `scripts/tests/21-the-broken-ridge.mjs`:

```js
// COLDSNAP suite era 21 — THE BROKEN RIDGE (mk2.14). The atomic blast breaks
// the rocks near it (the game layer's breach spawns the tumbling chunks);
// farther rocks survive and re-seat onto the carved ground instead of
// floating. Fixture seed: 13. No seed is special.
import { ok } from "./harness.mjs";
import fs from "node:fs";
import { makeField, makeWorld, addBody, explode } from "../../src/engine/core.js";
import { DAVY_FIRE } from "../../src/depot/specs.js";

{
  const field = makeField(41, 2.0, 13);
  field.carveFloor = -12;
  const world = makeWorld({ field, seed: 13 });
  world.depotCombat = true; world._tdStruct = true;
  const near = addBody(world, { kind: "rock", team: 0, mass: 0, hx: 2, hy: 2.5, hz: 2, x: 3, y: field.heightAt(3, 0) - 0.6, z: 0, hp: 90 + 3.4 * 20 });
  near.seatY = near.pos.y - field.heightAt(3, 0);
  const far = addBody(world, { kind: "rock", team: 0, mass: 0, hx: 2, hy: 2.5, hz: 2, x: 20, y: field.heightAt(20, 0) - 0.6, z: 0, hp: 90 + 3.4 * 20 });
  far.seatY = far.pos.y - field.heightAt(20, 0);
  const h0 = field.heightAt(0, 0);
  explode(world, 0, h0 + 0.5, 0, { ...DAVY_FIRE, r: DAVY_FIRE.blastR, attacker: "player" });
  ok("ridge: the ground carved", field.heightAt(0, 0) < h0);
  ok("ridge: the near rock breaks", !near.alive);
  ok("ridge: the far rock survives on falloff", far.alive);
  ok("ridge: the far rock re-seats onto the carved ground", Math.abs(far.pos.y - (field.heightAt(20, 0) + far.seatY)) < 1e-6);
}
{
  const g = fs.readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");
  ok("ridge: rock health is the soft table", g.includes("hp: 90 + k.r * 20"));
  ok("ridge: rocks carry their seat depth", g.includes("b.seatY = b.pos.y - field.heightAt(k.x, k.z)"));
  ok("ridge: a davy burst re-lays the rock dressing", g.includes('e.weapon === "davy"') && g.includes("setDressing({ rocks: rocksLive"));
}
```

Register it in `scripts/depot-test.mjs` after line 36 (`await import("./tests/20-the-possessed-trigger.mjs");`), before `finish();`:

```js
await import("./tests/21-the-broken-ridge.mjs");
```

Run `node scripts/gate.mjs depot-test` — era 21 must FAIL (the near rock survives today, the far rock floats). Confirm before any source moves.

## Step 2 — the engine re-seats rocks (`src/engine/core.js`)

Line 712, in the crater re-seat loop:

```js
      if (s.kind !== "wall" && s.kind !== "tower") continue;
```

becomes:

```js
      // DIVERGENCE (guarded, additive, mk2.14): rocks re-seat too — same
      // terrain-grade masonry, same loop. No demo or campaign world holds a
      // "rock" body, so those modes are byte-identical.
      if (s.kind !== "wall" && s.kind !== "tower" && s.kind !== "rock") continue;
```

The seat itself already honors `seatY` (line 714); rocks supply it in Step 3.

## Step 3 — rocks soften and carry their seat (`src/depot/DepotGame.jsx`)

Lines 1169–1170:

```js
          const b = addBody(world, { kind: "rock", team: 0, mass: 0, hx: k.r * 0.55, hy: k.h * 0.8, hz: k.r * 0.55, x: k.x, y: field.heightAt(k.x, k.z) - k.h * 0.2, z: k.z, hp: 380 + k.r * 90 });
          b.maxHp = b.hp; b.rockRef = k;
```

become:

```js
          const b = addBody(world, { kind: "rock", team: 0, mass: 0, hx: k.r * 0.55, hy: k.h * 0.8, hz: k.r * 0.55, x: k.x, y: field.heightAt(k.x, k.z) - k.h * 0.2, z: k.z, hp: 90 + k.r * 20 }); // mk2.14 (owner): one atomic blast breaks a near rock // provisional (F5)
          b.maxHp = b.hp; b.rockRef = k;
          b.seatY = b.pos.y - field.heightAt(k.x, k.z); // mk2.14: the crater re-seat drops a surviving rock to the carved ground, not half-height up
```

`seatY` is a plain scalar; it rides the save through the generic body sweep.

## Step 4 — the dressing sinks with the ground (`src/depot/DepotGame.jsx`)

In `drainEvents` (line 2823), after the dead-rock removal loop closes (line 2833, the `}` after `world.bodies.splice(i, 1);`'s block), add:

```js
        // mk2.14 (owner): a davy burst carved the ground — re-lay the rock
        // dressing so surviving boulders sink to the new surface instead of
        // floating over the crater. Bodies re-seat in the engine; this is
        // their drawn twin.
        if (evs.some((e) => e.type === "boom" && e.weapon === "davy")) {
          R.setDressing({ rocks: rocksLive, ponds: PONDS, streams: streamRibs });
        }
```

## Step 5 — gates

- `node scripts/gate.mjs depot-test` — green, era 21 passing, era 17 untouched and passing.
- `node scripts/gate.mjs golden` — green. The engine moved inside a guarded divergence; the frozen law demands it.
- `node scripts/gate.mjs depot-lint` — green (no new dice).

Any other failing check stops the task; no sweep license.

## Step 6 — the landing

- Bump `src/version.js`: `mk2.13` → `mk2.14`.
- `npm run build` AFTER the bump.
- Commit `the broken ridge, mk2.14`, push.

The acceptance is the owner's, live on the site, phone AND desktop: fire the davy at a ridge — near rocks break into tumbling masonry, far rocks settle into the crater's slope, nothing floats.

## Report

One line of outcome; all three gate summaries verbatim; fixture seed (13); the commit hash; every deviation its own labeled bullet; skipped steps named as skipped.
