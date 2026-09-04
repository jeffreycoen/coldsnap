# TASK 9 — THE MENU SHOWS THE WAR'S OPENING VIEW (mk2.47)

Owner's ruling, 2026-08-25: not a drawing — the actual map, rendered by the game's own renderer at the war's starting viewpoint, captured once and frozen behind the menu. The world boots with no sim, renders one settled frame at the opening camera (the tactical view on your depot), the pixels copy to the menu canvas, and the whole world and its GL context are dropped.

**Suggested model: Sonnet** — the capture module is fully specified here.

## Facts this plan is built on (verified at plan time)

- The renderer sizes an off-DOM canvas through `canvas.dataset.w/h` (`renderer.js:1237–1238`) — no DOM insertion needed.
- Reading the GL canvas synchronously in the same task as `R.render` copies live pixels; no `preserveDrawingBuffer` needed.
- Three test slicers (`05-the-front.mjs`, `08-debug-pass.mjs`, `measure-satchel.mjs`) extract `buildTown` by the exact line `\nfunction buildTown(` — so the export is a **separate statement** (`export { buildTown };`) and the function line stays byte-identical. No slicer moves.
- The opening camera is the mount's own: tactical rig, focus at the player depot, zoom 1, default yaw.

## Pre-licensed re-teaches (era 25, each old→new reported)

Tasks 7 and 8's checks pin the 2D drawer inside `StartScreen.jsx`; the drawer retires into the capture module. Three checks re-teach:

1. `T7: the menu draws the valley` → pins `data-menu-map` in StartScreen plus `makeMap(seed)` / `return MAP_SEED;` in the new `startview.js`.
2. `T8: the menu builds the war's own ground` → same pins, now against `startview.js`.
3. `T8: the snow is shaded like the renderer's` → retired; the war renderer shades for real now. Replaced by: the capture uses the war renderer and disposes it.

`T7: the burn arm previews the fresh valley`, `T7: the shell hands the menu's seed`, `T7: the war takes the menu's seed`, `T8: the trees are the war's own plan` (re-pointed to startview.js), and `T8: the column sits on its own glass` survive. The smoke stays untouched: the menu still carries exactly one DOM canvas — the GL canvas never enters the DOM.

## Required reading (read-confirmation opens the report)

1. This plan.
2. `src/ui/StartScreen.jsx` (all).
3. `src/depot/DepotGame.jsx` lines 200–390 (`townFootprint`/`buildTown` — exported, never edited) and 1040–1075 (the boot's field/grid/world lines being mirrored).
4. `src/render/renderer.js` lines 505–560 and 1236–1244 (read only).
5. `scripts/tests/25-the-teaching-cards.mjs` (all).

## Steps

### Step 1 — failing asserts first: era 25 edits

Replace the three named checks and append:

Replace `ok("T7: the menu draws the valley", ...)` with:

```js
  ok("T7/T9: the menu shows the captured opening view", /data-menu-map/.test(ss) && /captureStartView/.test(ss) && /makeMap\(seed\)/.test(src("src/ui/startview.js")) && /return MAP_SEED;/.test(src("src/ui/startview.js")));
```

Replace `ok("T8: the menu builds the war's own ground", ...)` with:

```js
  ok("T8/T9: the capture boots the war's own ground", /makeField\(181, 2\.0, MAP_SEED\)/.test(src("src/ui/startview.js")) && /buildDepotTerrain\(field, MAP_SEED\)/.test(src("src/ui/startview.js")));
```

Replace `ok("T8: the snow is shaded like the renderer's", ...)` with:

```js
  ok("T8/T9: the war renderer draws the frame and is dropped", /makeRenderer\(cv, world/.test(src("src/ui/startview.js")) && /R\.dispose\(\)/.test(src("src/ui/startview.js")));
```

Re-point `ok("T8: the trees are the war's own plan", /planTrees\(\)/.test(ss));` to:

```js
  ok("T8/T9: the trees are the war's own plan", /planTrees\(\)/.test(src("src/ui/startview.js")));
```

Append:

```js
// ---- Task 9 (mk2.47): THE OPENING VIEW
{
  const dg = src("src/depot/DepotGame.jsx");
  ok("T9: the town builder is shared by statement, its pinned line untouched",
    /\nexport \{ buildTown \};/.test(dg) && /\nfunction buildTown\(world, grid, field\) \{/.test(dg));
  ok("T9: the capture sizes off-DOM through the renderer's own door", /cv\.dataset\.w = String\(w\)/.test(src("src/ui/startview.js")));
}
```

Run `node scripts/gate.mjs depot-test` — the six FAIL. Record the PASS count.

### Step 2 — `DepotGame.jsx`: the town builder is shared

Directly after `buildTown`'s closing brace (before `function stepTown`), one new line:

```js
export { buildTown }; // Task 9 (mk2.47): the menu's opening-view capture boots the same town — a named export ONLY; the function line above is pinned by three test slicers and never changes
```

### Step 3 — `src/ui/startview.js` (new file)

```js
// COLDSNAP — startview.js (Task 9, mk2.47): THE OPENING VIEW, captured.
// The menu shows the war's own first frame: the real world boots with no
// sim, the war renderer draws one settled frame at the opening camera
// (tactical, focused on the player depot), the pixels copy to the menu
// canvas, and the world and its GL context are dropped. makeMap bumps a
// fouled seed; the installed MAP_SEED is returned — the number shown and
// handed on is always the map drawn.
import { makeField, makeWorld, addBody } from "../engine/core.js";
import { makeRenderer } from "../render/renderer.js";
import { makeMap, MAP_SEED, TOWN, ROCKS, PONDS, STREAM, RIM_HALF_U, RIM_HALF_V, fwdU, invW, buildDepotTerrain, makeGrid, planTrees } from "../depot/mapgen.js";
import { buildTown } from "../depot/DepotGame.jsx";

export function captureStartView(target, seed) {
  makeMap(seed);
  const field = makeField(181, 2.0, MAP_SEED);
  field.carveFloor = -12;
  buildDepotTerrain(field, MAP_SEED);
  const grid = makeGrid(field);
  const world = makeWorld({ field, seed: MAP_SEED });
  world._tdStruct = true;
  buildTown(world, grid, field);
  // rocks and trees exactly as the fresh boot lays them — bodies, so the
  // renderer gives them their real silhouettes and shadows
  for (const k of ROCKS) {
    const b = addBody(world, { kind: "rock", team: 0, mass: 0, hx: k.r * 0.55, hy: k.h * 0.8, hz: k.r * 0.55, x: k.x, y: field.heightAt(k.x, k.z) - k.h * 0.2, z: k.z, hp: 90 + k.r * 20 });
    b.maxHp = b.hp; b.rockRef = k;
  }
  for (const p of planTrees()) {
    const u = addBody(world, { kind: "tree", team: 0, mass: 260, hx: 0.28, hy: 1.6, hz: 0.28, x: p.x, y: field.heightAt(p.x, p.z) + 1.62, z: p.z, hp: 70, friction: 0.5 });
    u.sleeping = true;
  }
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(1, Math.round(target.clientWidth * dpr)), h = Math.max(1, Math.round(target.clientHeight * dpr));
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  cv.dataset.w = String(w); cv.dataset.h = String(h); // renderer.resize() reads these off-DOM
  let R = null;
  try {
    R = makeRenderer(cv, world, {
      town: false, camera: "tactical",
      rim: { halfU: RIM_HALF_U, halfV: RIM_HALF_V, toCanonical: invW, toWorld: fwdU },
    });
    // the stream's visible water — the mount's own sampling
    const streamRibs = [];
    if (STREAM) {
      let run = [];
      const flush = () => { if (run.length >= 2) streamRibs.push({ pts: run, w: STREAM.w + 1 }); run = []; };
      for (let u = -90; u <= 90; u += 2) {
        if (Math.abs(u - STREAM.bridgeU) < 3) { flush(); continue; }
        const i2 = Math.max(0, Math.min(STREAM.pts.length - 2, Math.floor((u + 90) / 15)));
        const a = STREAM.pts[i2], b = STREAM.pts[i2 + 1];
        const t = Math.max(0, Math.min(1, (u - a.u) / (b.u - a.u || 1)));
        const wp = fwdU(u, a.v + (b.v - a.v) * t);
        run.push({ x: wp.x, y: 0.78, z: wp.z });
      }
      flush();
    }
    R.setDressing({ rocks: ROCKS, ponds: PONDS, streams: streamRibs });
    // the opening camera: the mount's own focus — the player depot
    const depotT = TOWN.find((t) => t.depot && t.team !== 2) || { x: 0, z: 52 };
    const focus = { x: depotT.x, y: field.heightAt(depotT.x, depotT.z), z: depotT.z };
    R.render(1 / 60, focus, { x: 0, z: -500 }, 0);
    R.render(1 / 60, focus, { x: 0, z: -500 }, 0); // second frame — tweens settled, shadows warm
    target.width = w; target.height = h;
    target.getContext("2d").drawImage(cv, 0, 0); // synchronous with the GL render — the buffer is live
  } finally {
    if (R) R.dispose();
  }
  return MAP_SEED;
}
```

### Step 4 — `StartScreen.jsx`: the drawer retires into the capture

- The Task-7/8 import lines (`mapgen`, `specs`, `engine/core`) are removed; one import replaces them: `import { captureStartView } from "./startview.js";`
- The whole `drawMap` function is deleted.
- `paint` becomes:

```js
  const paint = (s) => {
    const cv = mapCvRef.current;
    if (cv == null || s == null) return null;
    const inst = captureStartView(cv, s);
    setOrd(inst);
    return inst;
  };
```

- Everything else — the refs, the three effects, `onDepot(newSeedRef.current)`, the `data-menu-map` canvas, the glass column, the FIELD ORDER line — stays exactly as it stands.

### Step 5 — gates

- `node scripts/gate.mjs depot-test` — green; the ledger: 3 re-taught, 1 re-pointed, 2 new (the agent states the arithmetic from its Step 1 count).
- `node scripts/gate.mjs depot-lint` — green (startview.js lives in `src/ui`; it calls no rng — every call here is deterministic of the seed).
- `node scripts/gate.mjs smoke` — green (one DOM canvas as before; the GL canvas never enters the DOM; menu flows unchanged).

### Step 6 — the deploy

Bump `src/version.js` to `mk2.47`. Build after the bump; commit ("the menu shows the war's opening view, mk2.47"); push. The owner's live check — the menu on phone and desktop, a moment's capture hitch accepted — is the acceptance.

## Report

Read-confirmation, one line of outcome, PASS counts before/after with the re-teach ledger old→new, gates and verdicts, commit hash, the shipped mark, seeds (smoke's pinned 11; eras none). Every nonconformity its own labeled bullet.
