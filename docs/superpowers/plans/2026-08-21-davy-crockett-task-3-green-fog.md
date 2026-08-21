# The Davy Crockett, task 3 — the green fog (mk2.09)

The atomic blast leaves poisoned ground: a patch on the crater, radius 6, 4 damage a second to any living man inside, both sides, fading out after 25 seconds. A fresh blast on old ground restarts the patch. The patches ride the save like mines, tick on the territory clock, and draw as green ground haze. Design authority: `docs/superpowers/specs/2026-08-21-davy-crockett-design.md` (owner-approved).

One small guarded engine divergence: the boom event learns to name WHICH GUN burst (`weapon` on the boom, when the spec carries the tag) — the exact mk0.56 muzzle-event precedent, one event over. Events are never hashed; untagged specs (demo, tower defense, campaign) push the old shape byte-identically; golden proves it.

Rulings recorded here, at ruling time:

- **Poison pays nobody:** patch damage attributes to "world" — the kill law already scores and pays nothing for it, both sides equally. No asymmetry exists in this task.
- **Living men only:** the fog poisons `unit` bodies. Machines and masonry stand in it unharmed — poison is for the living.
- **Restart, never stack:** a new patch absorbs any patch whose center it covers.

**Suggested model: Sonnet** — all code carried below.

## Required reading

- This plan.
- `src/depot/mines.js` whole (56 lines — the watched-point shape being mirrored).
- `src/engine/core.js` lines 489–500 (explode's opening, the boom push at line 496).
- `src/depot/DepotGame.jsx` lines 1325–1340 (the run-state literal, `mines: []` at 1333), 1405–1415 (the mine restore at 1411), 2818–2850 (drainEvents), 3540–3550 (the 4Hz block, stepMines at 3545), 3675–3685 (the setGrenades call site).
- `src/depot/save.js` lines 275–282 (the mines row at 280).
- `src/render/renderer.js` lines 1324–1343 (the grenade pool block — the pool idiom), line 2389 (the return object).
- `scripts/depot-test.mjs` whole.
- `scripts/tests/17-the-davy-crockett.mjs` whole (era idiom).

## Step 1 — the failing checks

Create `scripts/tests/18-the-green-fog.mjs`:

```js
// COLDSNAP suite era 18 — THE GREEN FOG (mk2.09). The atomic blast's poison
// ground: radius 6, 4 a second, both sides, 25 seconds, restart never stack.
// Fixture seed: 5. No seed is special.
import { ok } from "./harness.mjs";
import fs from "node:fs";
import { makeField, makeWorld, addBody, explode } from "../../src/engine/core.js";
import { addFogPatch, stepFog, FOG_S } from "../../src/depot/fog.js";
import { DAVY_FIRE } from "../../src/depot/specs.js";

{
  const world = makeWorld({ field: makeField(9, 2.0, 5), seed: 5 });
  world.depotCombat = true;
  const fog = [];
  addFogPatch(fog, 0, 0, world.t);
  ok("fog: a patch stands 25 seconds", fog.length === 1 && Math.abs(fog[0].until - FOG_S) < 1e-9);
  const mine = addBody(world, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 1.0, hz: 0.28, x: 2, y: 1.1, z: 0, hp: 58 });
  const theirs = addBody(world, { kind: "unit", team: 2, mass: 80, hx: 0.28, hy: 1.0, hz: 0.28, x: -2, y: 1.1, z: 0, hp: 58 });
  const outside = addBody(world, { kind: "unit", team: 2, mass: 80, hx: 0.28, hy: 1.0, hz: 0.28, x: 20, y: 1.1, z: 0, hp: 58 });
  stepFog(world, fog, 0.25);
  ok("fog: poisons our man", Math.abs(mine.hp - 57) < 1e-6);
  ok("fog: poisons its man the same", Math.abs(theirs.hp - 57) < 1e-6);
  ok("fog: spares the man outside", outside.hp === 58);
  addFogPatch(fog, 1, 0, world.t);
  ok("fog: a fresh blast on old ground restarts, never stacks", fog.length === 1);
  world.t = FOG_S + 1;
  stepFog(world, fog, 0.25);
  ok("fog: the patch expires", fog.length === 0);
}
{
  // the boom names its gun — the guarded divergence the game layer hooks
  const world = makeWorld({ field: makeField(9, 2.0, 5), seed: 5 });
  explode(world, 0, 1, 0, { ...DAVY_FIRE, r: 2, attacker: "player" });
  const boom = world.events.find((e) => e.type === "boom");
  ok("fog: the davy boom carries its weapon tag", !!boom && boom.weapon === "davy");
  const plain = makeWorld({ field: makeField(9, 2.0, 5), seed: 5 });
  explode(plain, 0, 1, 0, { r: 2, dmg: 5, kv: 1, kind: "shell" });
  const b2 = plain.events.find((e) => e.type === "boom");
  ok("fog: an untagged boom keeps the old shape", !!b2 && !("weapon" in b2));
  // the wiring pins: the boom hook, the territory-clock tick, the save row
  const dg = fs.readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");
  ok("fog: the game layer hooks the davy boom", dg.includes("addFogPatch(S.fog, e.x, e.z"));
  ok("fog: the patches tick on the territory clock", dg.includes("stepFog(world, S.fog"));
  const sv = fs.readFileSync(new URL("../../src/depot/save.js", import.meta.url), "utf8");
  ok("fog: the patches ride the save", sv.includes("fog: (S.fog || [])"));
}
```

Register it in `scripts/depot-test.mjs` after line 33 (`await import("./tests/17-the-davy-crockett.mjs");`), before `finish();`:

```js
await import("./tests/18-the-green-fog.mjs");
```

Run `node scripts/gate.mjs depot-test` — era 18 must FAIL (the fog module does not exist). Confirm before any source moves.

## Step 2 — the fog module

Create `src/depot/fog.js`:

```js
// COLDSNAP DEPOT — fog.js (mk2.09): THE GREEN FOG. The atomic blast leaves
// a poison patch on the crater: radius 6, 4 damage a second to any living
// man inside, both sides, fading out after 25 seconds. Watched points, the
// mines' shape — never bodies, never drawn here. Poison pays and scores
// nobody (attacker "world", the kill law's own rule). Deterministic; zero
// rng draws anywhere in this module.
import { applyDamage } from "../engine/core.js";

export const FOG_R = 6, FOG_DPS = 4, FOG_S = 25; // provisional (F5)

// addFogPatch: a fresh blast on old ground RESTARTS the patch (owner) — any
// patch whose center lies inside the new one is absorbed, never stacked.
export function addFogPatch(list, x, z, t) {
  for (let i = list.length - 1; i >= 0; i--) {
    if (Math.hypot(list[i].x - x, list[i].z - z) < FOG_R) list.splice(i, 1);
  }
  list.push({ x, z, r: FOG_R, until: t + FOG_S });
}

// stepFog: the territory clock's cadence — dt is the caller's step (0.25s).
export function stepFog(world, list, dt) {
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    if (world.t >= p.until) { list.splice(i, 1); continue; }
    for (const b of world.bodies) {
      if (b.kind !== "unit" || !b.alive || b.riding) continue;
      if (Math.hypot(b.pos.x - p.x, b.pos.z - p.z) < p.r) applyDamage(world, b, FOG_DPS * dt, { attacker: "world" });
    }
  }
}
```

`applyDamage` is a live core export (units.js line 12 already imports it).

## Step 3 — the boom names its gun (`src/engine/core.js`)

Line 496:

```js
  world.events.push({ type: "boom", x, y, z, r: spec.r, kind: spec.kind || "shell" });
```

becomes:

```js
  const bev = { type: "boom", x, y, z, r: spec.r, kind: spec.kind || "shell" };
  // DIVERGENCE (guarded, additive, mk2.09): the boom names WHICH GUN burst
  // when the spec says so — the muzzle event's mk0.56 weapon-tag precedent,
  // one event over. Events are never hashed; specs without the tag (the
  // demo, tower defense, campaign) push the exact old shape.
  if (spec.weapon) bev.weapon = spec.weapon;
  world.events.push(bev);
```

Nothing else in the engine moves.

## Step 4 — the game layer (`src/depot/DepotGame.jsx`)

Import (line 23 region, beside the mines import): add to the mines import line or its own line after it:

```js
import { addFogPatch, stepFog } from "./fog.js";
```

The run state, after line 1333 (`mines: [],`):

```js
        // mk2.09: THE GREEN FOG — the atomic blast's poison patches.
        // Watched points, saved like mines. { x, z, r, until (sim clock) }.
        fog: [],
```

The restore, after line 1411 (the mines restore):

```js
        S.fog = (r.fog || []).map((p) => ({ x: p.x, z: p.z, r: p.r, until: p.u }));
```

drainEvents — inside the `for (const e of evs)` loop at line 2843, ABOVE the existing `if (e.type !== "kill") continue;` line, insert:

```js
          // mk2.09: the davy's boom seeds the poison ground where it burst.
          if (e.type === "boom" && e.weapon === "davy") addFogPatch(S.fog, e.x, e.z, world.t);
```

The 4Hz tick — after line 3545 (`if (terrGuard > 0) { stepMines(world, S.mines); R.setMines(S.mines); }`):

```js
          // mk2.09: THE GREEN FOG ticks on the same clock the mines do.
          if (terrGuard > 0 && S.fog.length) stepFog(world, S.fog, TERR_STEP);
```

The draw — beside the setGrenades call (line ~3681, `R.setGrenades(world._grenades, world.t);`), add after it:

```js
          R.setGreenFog(S.fog, world.t); // mk2.09: the poison ground, seen
```

## Step 5 — the save (`src/depot/save.js`)

After line 280 (the mines row in serializeFront):

```js
      // mk2.09: THE GREEN FOG — poison patches, watched points like mines.
      // `until` is an absolute sim-clock stamp; world.t rides the save too.
      fog: (S.fog || []).map((p) => ({ x: r3(p.x), z: r3(p.z), r: r3(p.r), u: r3(p.until) })),
```

## Step 6 — the haze (`src/render/renderer.js`)

After the grenade block (line 1342, the end of `setGrenades`), add:

```js
  // mk2.09: THE GREEN FOG — poison ground haze. Camera-facing instanced
  // planes over each patch; every offset and bob phase derives from the
  // patch's own position and world time (no rng — house rule). The last
  // five seconds thin to nothing. Phone and desktop draw the same pool.
  const FOGP_CAP = 96, FOGP_PER = 12;
  const fogpMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, depthWrite: false });
  const fogpMesh = pool(new THREE.PlaneGeometry(2.6, 1.6), fogpMat, FOGP_CAP, false); fogpMesh.layers.set(1);
  const _fogG1 = new THREE.Color(0x39e05a), _fogG2 = new THREE.Color(0x1d7a33);
  function setGreenFog(list, t) {
    let fi = 0;
    if (list) for (const p of list) {
      const left = p.until - t;
      if (left <= 0) continue;
      const a = Math.min(1, left / 5);
      for (let k = 0; k < FOGP_PER && fi < FOGP_CAP; k++) {
        const ph = p.x * 3.7 + p.z * 1.9 + k * 2.399;
        const rr = (0.25 + 0.65 * ((k * 37 % 16) / 16)) * p.r;
        const az = ph + t * 0.13;
        const bx = p.x + Math.cos(az) * rr, bz = p.z + Math.sin(az) * rr;
        const by = F.heightAt(bx, bz) + 0.5 + 0.45 * Math.sin(t * 0.7 + ph);
        dummy.position.set(bx, by, bz); dummy.quaternion.copy(camQ);
        const s = (0.8 + 0.5 * Math.sin(t * 0.5 + ph * 1.7)) * a;
        dummy.scale.set(s * 2.2, s, 1); dummy.updateMatrix();
        fogpMesh.setMatrixAt(fi, dummy.matrix);
        if (fogpMesh.setColorAt) fogpMesh.setColorAt(fi, k % 3 ? _fogG1 : _fogG2);
        fi++;
      }
    }
    fogpMesh.count = fi; fogpMesh.instanceMatrix.needsUpdate = true;
    if (fogpMesh.instanceColor) fogpMesh.instanceColor.needsUpdate = true;
  }
```

The return object at line 2389: add `setGreenFog,` after `setGrenades,`.

## Step 7 — gates

- `node scripts/gate.mjs depot-test` — green, era 18 passing.
- `node scripts/gate.mjs depot-lint` — green (zero draws added).
- `node scripts/gate.mjs golden` — green: the boom-event divergence must leave the extracted demo engine bit-identical.

Any other failing check stops the task; no sweep license (nothing here moves a pinned literal).

## Step 8 — the landing

- Bump `src/version.js`: `mk2.08` → `mk2.09`.
- `npm run build` AFTER the bump.
- Commit `the green fog, mk2.09`, push. The owner's live check is the acceptance — the haze is looked at on the site, phone and desktop.

## Report

One line of outcome; the three gate summaries verbatim; fixture seed (5); the commit hash; every deviation its own labeled bullet; skipped steps named as skipped.
