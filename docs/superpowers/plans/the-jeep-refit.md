# The Jeep Refit (mk2.99)

The owner's playtest (2026-09-04) found four defects in mk2.98. One task fixes all four: wheels roll about their axles; loading works (the boarding lookup learns the jeep); the body grows to Willys proportions; and possession offers the coax alone — the APC's own one-gun convention — instead of handing the jeep the Bison's shell.

Suggested model: Sonnet 5 — five files, every code block carried below verbatim.

Design choices, stated: the new dimensions (1.7 × 3.2 m footprint) and the mesh dials are provisional against the owner's eye; the possessed FIRE button firing the coax mirrors the APC exactly (one gun, FIRE alone, no MG button).

## Required reading

- This plan, whole.
- `src/depot/transports.js` lines 25–45. `src/depot/tick.js` lines 285–295. `src/depot/specs.js` (the JEEP row). `src/graphics/renderer.js` (buildJeep and the wheel-sync block mk2.98 added). `src/depot/DepotGame.jsx` lines 3745–3760 (the MG button's gate).

Report opens with confirmation these were read.

## Steps

### Step 1 — the failing tests

Create `scripts/tests/46-the-jeep-refit.mjs` with exactly:

```js
import { ok } from "./harness.mjs";
import { apcBySeq } from "../../src/depot/transports.js";
import { JEEP } from "../../src/depot/specs.js";
import fs from "node:fs";

// ==== mk2.99: the jeep refit ================================================
// The four playtest defects: rolling wheels, boarding, size, one gun.
// No seeds — a synthetic world and source pins.
{
  console.log("\n[mk2.99: the jeep refit]");

  // (a) the boarding lookup finds a jeep by its seat number
  {
    const jeep = { kind: "vehicle", vtype: "jeep", apcSeq: 7, alive: true };
    const w = { bodies: [{ kind: "vehicle", vtype: "bison", apcSeq: 7, alive: true }, jeep] };
    ok("(a) the boarding lookup finds the jeep", apcBySeq(w, 7) === jeep, apcBySeq(w, 7) ? apcBySeq(w, 7).vtype : "null");
  }

  // (b) the body stands at Willys proportions
  ok("(b) the spec grew to the real footprint", JEEP.hx === 0.85 && JEEP.hz === 1.6 && JEEP.hy === 0.55, `${JEEP.hx}/${JEEP.hy}/${JEEP.hz}`);

  // (c) pins: the axle roll, the hatch, the one-gun possession
  const rr = fs.readFileSync("src/graphics/renderer.js", "utf8");
  ok("(c) pins: the wheels roll about their own axle", /wh\.rotateY\(spd \* 0\.04\);/.test(rr) && !/wh\.rotation\.y \+= spd/.test(rr));
  const tr = fs.readFileSync("src/depot/transports.js", "utf8");
  ok("(c) pins: the hatch knows the jeep", /if \(b\.vtype === "apc" \|\| b\.vtype === "jeep"\) b\._hatch/.test(tr));
  const tk = fs.readFileSync("src/depot/tick.js", "utf8");
  ok("(c) pins: the possessed jeep fires its coax, not the shell", /\(pv\.vtype === "apc" \|\| pv\.vtype === "jeep"\)\) possessedArmorMg/.test(tk));
  const dg = fs.readFileSync("src/depot/DepotGame.jsx", "utf8");
  ok("(c) pins: one gun, FIRE alone — no MG button on the jeep", /hud\.possessed\.vtype !== "apc" && hud\.possessed\.vtype !== "jeep" && \(/.test(dg));
}
```

In `scripts/depot-test.mjs`, after the line

```js
await import("./tests/45-the-jeep.mjs");
```

insert

```js
await import("./tests/46-the-jeep-refit.mjs");
```

Run `node scripts/gate.mjs depot-test` blocking, once. Required result, verified by a live pre-fix run at plan-writing time: exactly SIX asserts FAIL — (a), (b), and all four (c) pins — and every pre-existing test PASSES. Any other pattern stops the task.

### Step 2 — boarding and the hatch (`src/depot/transports.js`)

Replace exactly:

```js
  for (const b of world.bodies) if (b.kind === "vehicle" && b.vtype === "apc" && b.apcSeq === seq && b.alive) return b;
```

with:

```js
  for (const b of world.bodies) if (b.kind === "vehicle" && (b.vtype === "apc" || b.vtype === "jeep") && b.apcSeq === seq && b.alive) return b; // mk2.99: the jeep boards too
```

And replace exactly:

```js
  for (const b of world.bodies) if (b.vtype === "apc") b._hatch = (world.t - (b._unloadT || -9) < 1.5) ? 1 : 0;
```

with:

```js
  for (const b of world.bodies) if (b.vtype === "apc" || b.vtype === "jeep") b._hatch = (world.t - (b._unloadT || -9) < 1.5) ? 1 : 0;
```

### Step 3 — one gun under possession (`src/depot/tick.js`)

Replace exactly:

```js
      if (input.fireHeld) { if (pv.vtype === "apc") possessedArmorMg(world, pv, input.reticle, T, map.invW); else possessedArmorFire(world, pv, input.reticle, T, map.invW); }
```

with:

```js
      if (input.fireHeld) { if (pv.vtype === "apc" || pv.vtype === "jeep") possessedArmorMg(world, pv, input.reticle, T, map.invW); else possessedArmorFire(world, pv, input.reticle, T, map.invW); } // mk2.99: coax-only hulls fire the coax — the APC's one-gun law
```

### Step 4 — no MG button beside a coax FIRE (`src/depot/DepotGame.jsx`)

Replace exactly:

```js
      {isTouch && hud.possessed && hud.possessed.kind === "vehicle" && hud.possessed.vtype !== "apc" && (
```

with:

```js
      {isTouch && hud.possessed && hud.possessed.kind === "vehicle" && hud.possessed.vtype !== "apc" && hud.possessed.vtype !== "jeep" && (
```

### Step 5 — the body grows (`src/depot/specs.js`)

In the JEEP row, replace exactly:

```js
export const JEEP = { mass: 1100, hx: 0.75, hy: 0.5, hz: 1.1, hp: 90, bounty: 15, seats: 2, cost: 60, eye: 46,
  spd2h: 14, cap2h: 3.5, spd4l: 4, cap4l: 7,
  susp: { kx: 0.6, kz: 0.9, rest: 0.55, travel: 0.4, rate: 66000, damp: 6000 } };
```

with:

```js
export const JEEP = { mass: 1100, hx: 0.85, hy: 0.55, hz: 1.6, hp: 90, bounty: 15, seats: 2, cost: 60, eye: 46,
  spd2h: 14, cap2h: 3.5, spd4l: 4, cap4l: 7,
  susp: { kx: 0.7, kz: 1.3, rest: 0.6, travel: 0.4, rate: 66000, damp: 6000 } }; // mk2.99: grown to the Willys' real footprint
```

### Step 6 — the mesh rebuilt (`src/graphics/renderer.js`)

Replace the whole `buildJeep` body — from `export function buildJeep(team) {` through its closing `}` before the APC's comment — with:

```js
export function buildJeep(team) {
  const g = new THREE.Group();
  const hullC = team === 2 ? 0x6e3a34 : 0x4a5d3a;
  const hull = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, 3.2), toon(hullC));
  hull.position.y = 0.15; hull.castShadow = true; g.add(hull);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.25, 1.0), toon(hullC));
  hood.position.set(0, 0.55, 1.0); g.add(hood);
  const screen = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.55, 0.08), toon(0x28303a));
  screen.position.set(0, 0.85, 0.5); screen.rotation.x = -0.15; g.add(screen);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.4, 1.1), toon(0x2a2f27));
  seat.position.set(0, 0.5, -0.5); g.add(seat);
  const pintle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 6), toon(0x33383d));
  pintle.position.set(0, 0.95, -0.9); g.add(pintle);
  const mg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.7, 6), toon(0x14171a));
  mg.rotation.x = Math.PI / 2; mg.position.set(0, 1.2, -0.6); g.add(mg);
  g.userData.wheels = [];
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.3, 10), toon(0x1b1e22));
    wh.rotation.z = Math.PI / 2; wh.position.set(sx * 0.88, -0.3, sz * 1.3);
    wh.castShadow = true; g.add(wh);
    g.userData.wheels.push(wh);
  }
  return g;
}
```

And in the wheel-sync block, replace exactly:

```js
          wh.position.y = -0.55 + Math.min(0.4, b._wheelC[wi]);
          wh.rotation.y += spd * 0.05;
```

with:

```js
          wh.position.y = -0.7 + Math.min(0.4, b._wheelC[wi]);
          wh.rotateY(spd * 0.04); // mk2.99: local space — the wheel rolls about its own axle, not a top's spin
```

### Step 7 — gates

Run blocking, in order: `node scripts/gate.mjs depot-test` (the six Step-1 asserts PASS, everything else PASSES), `node scripts/gate.mjs depot-lint`, `node scripts/gate.mjs smoke` — all green. No engine file touched — no golden. The sweep license is NOT granted; the plan-writing sweep found no pin over any moved literal (test 45's spec pin holds cost/seats/eye/speeds, none of the grown fields).

### Step 8 — version, build, land

- `src/version.js`: `mk2.98` → `mk2.99`.
- `npm run build` (after the bump, never before).
- Commit and push. Suggested subject: `the jeep refit — rolling wheels, working seats, real size, one gun, mk2.99`. Include this plan file.

## Acceptance

- Arithmetic: `depot-test` exits 0 with all six new asserts PASS; `depot-lint` and `smoke` exit 0. No seeds — synthetic world and pins.
- The owner's live check: the wheels roll with the ground; LOAD a sniper pair and it boards; the hull stands beside a man at real size; possessed, FIRE works the coax and no second button appears. Phone and desktop both.
