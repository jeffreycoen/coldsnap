# The Davy Crockett, task 4 — the atomic look and the dress (mk2.10)

The blast must read atomic and it must be dramatic: the full-screen flash, the traveling ground ring, the driven stem, the mushroom cap that hangs and drifts with the wind, and maximum shake. The crew wears orange with the radiation mark. Design authority: `docs/superpowers/specs/2026-08-21-davy-crockett-design.md` (owner-approved).

Acceptance is the owner's eyes, live on the site, phone AND desktop — the checks below pin mechanics and wiring only, never the look. Every visual number in this plan is a starting dial for his ruling.

Stated plainly, ruled by the box-prop reality: at game scale the radiation trefoil renders as a yellow chest placard with a black center — three drawn lobes do not exist in the prop system. The owner's eye rules whether the placard reads; a finer mark is a polish-queue item if he wants one.

The renderer already rolls its own dice for particles (the frozen-demo idiom); the new particle code keeps that idiom. Everything else new (flash decay, ring, drift) runs off world time and the wind — no new dice outside the particle spawns. No engine change; golden is not in the brief. No `src/depot` change; depot-lint is not in the brief.

**Suggested model: Sonnet** — all code carried below.

## Required reading

- This plan.
- `src/render/troopkit.js` whole (167 lines).
- `src/render/portrait.js` lines 1–50 (the palette pick at line 46, the import at line 9).
- `src/render/renderer.js` lines 424–470 (the post shader), 930–940 (the smoke pool at 936), 1025–1070 (spawnBoom/spawnDemo, the `smoke.length >= 128` guards at 1034/1055/1066), 1076–1086 (the post uniforms at 1082), 800–810 (strikeRing — the ring idiom), 1150–1185 (shake at 1152, consume at 1153, the boom branch at 1155), 870–880 (the medic palette at 876), 1975–1985 (the man-loop palette pick at 1980), 2185–2195 (the smoke step, the `si < 128` write at 2191), 2380–2390 (the uT uniform write at 2387).
- `scripts/depot-test.mjs` whole.
- `scripts/tests/18-the-green-fog.mjs` whole (era idiom).

## Step 1 — the failing checks

Create `scripts/tests/19-the-atomic-look.mjs`:

```js
// COLDSNAP suite era 19 — THE ATOMIC LOOK AND THE DRESS (mk2.10). Mechanics
// and wiring pins only — the look itself belongs to the owner's eyes, live.
// No fixture world; troopKit is pure. No seed is special.
import { ok } from "./harness.mjs";
import fs from "node:fs";
import { troopKit, DAVY_HEX } from "../../src/render/troopkit.js";

{
  const kit = troopKit({ team: 1, utype: "davy", alive: true }, true, false);
  ok("dress: the crew wears the orange", kit.pal === "davy");
  ok("dress: no rifle — the tube is the tool", kit.rifle === 0 && !!kit.props[0]);
  const foe = troopKit({ team: 2, tag: "davy", alive: true }, true, false);
  ok("dress: its crew wears the same orange", foe.pal === "davy");
  ok("dress: the palette exists", typeof DAVY_HEX.dom === "number");
  const plain = troopKit({ team: 1, utype: "davy", alive: true }, false, false);
  ok("dress: outside the war the look is untouched", plain.pal === "con" && plain.rifle === 1);
}
{
  const r = fs.readFileSync(new URL("../../src/render/renderer.js", import.meta.url), "utf8");
  ok("look: the smoke pool rises for the cloud", r.includes("SMOKE_CAP = 384"));
  ok("look: the flash uniform exists", r.includes("uFlash"));
  ok("look: the boom branch knows the davy", r.includes('e.weapon === "davy"'));
  ok("look: the davy palette joins the man loop", r.includes("DAVY_LIVE"));
  const p = fs.readFileSync(new URL("../../src/render/portrait.js", import.meta.url), "utf8");
  ok("look: the portrait wears the orange too", p.includes("DAVY_HEX"));
}
```

Register it in `scripts/depot-test.mjs` after line 34 (`await import("./tests/18-the-green-fog.mjs");`), before `finish();`:

```js
await import("./tests/19-the-atomic-look.mjs");
```

Run `node scripts/gate.mjs depot-test` — era 19 must FAIL (no DAVY_HEX export) before any source moves.

## Step 2 — the dress (`src/render/troopkit.js`)

After the mechanic's TOOLBOX prop (line 86) and beside MEDIC_HEX (line 90), add:

```js
// mk2.10 (owner): THE ATOMIC CREW'S DRESS — orange jumpsuits, the radiation
// mark. The mark is a yellow chest placard with a black center (box props
// cannot draw lobes; the owner's eye rules the placard live). The tube is
// the mortar's carried-prop idiom, fatter. // provisional (F5), every hex
export const DAVY_HEX = { dom: 0xe8791e, sec: 0xb45510, acc: 0xf5d020, gun: 0x141414 };
const DAVY_TUBE = { off: [0.26, 0.28, 0.06], s: [2.2, 12, 2.2], tilt: [0, 0.42] };
const DAVY_PLATE = { off: [0, 0.28, 0.17], s: [1.8, 1.8, 0.5], role: "acc" };
const DAVY_MARK = { off: [0, 0.28, 0.21], s: [0.9, 0.9, 0.3], role: "gun" };
```

After KIT_MECHANIC (line 114):

```js
const KIT_DAVY = { rifle: 0, props: P(DAVY_TUBE, DAVY_PLATE, DAVY_MARK) };
```

The palette pick (line 139) — the suit outranks the coat, both sides, the medic's own rule. The line:

```js
  const pal = (b.utype === "medics" || b.tag === "medic") ? "medic" : gren || b.team === 2 ? "gren" : "con"; // P7.2 T6 (owner): the cross outranks the coat — both sides' medics wear the white
```

becomes:

```js
  const pal = (b.utype === "medics" || b.tag === "medic") ? "medic"
    : (b.utype === "davy" || b.tag === "davy") ? "davy" // mk2.10: the orange outranks the coat — both sides' atomic crews
    : gren || b.team === 2 ? "gren" : "con"; // P7.2 T6 (owner): the cross outranks the coat — both sides' medics wear the white
```

The kit dispatch — in the player branch (lines 151–157), add before the fallback:

```js
      : b.utype === "davy" ? KIT_DAVY
```

(after the `mechanics` line). In the enemy branch (lines 160–164), add beside the mechanic line:

```js
      : b.tag === "davy" ? KIT_DAVY
```

## Step 3 — the renderer's palettes (`src/render/renderer.js`)

Beside MED_LIVE/MED_DEAD (line 876–877), add:

```js
  // mk2.10: the atomic crew's orange — DAVY_HEX over the con palette, and a
  // scorched grey-orange for the dead.
  const DAVY_LIVE = mkPal({ ...INFANTRY.pal.con, ...DAVY_HEX });
  const DAVY_DEAD = mkPal({ ...INFANTRY.dead.con, dom: 0x7a4a20, sec: 0x5c3816, acc: 0x8a7430, gun: 0x101214 });
```

`DAVY_HEX` joins the troopkit import (line 6: `import { troopKit, RIFLE_PREROT, MEDIC_HEX } from "./troopkit.js";` gains `DAVY_HEX`).

The man-loop palette pick (line 1980): the expression

```js
            const pal = b.dress === "android" ? (b.alive ? AND_LIVE : AND_DEAD) : kitPal === "medic" ? (b.alive ? MED_LIVE : MED_DEAD) : (b.alive ? INF_LIVE : INF_DEAD)[kitPal];
```

becomes:

```js
            const pal = b.dress === "android" ? (b.alive ? AND_LIVE : AND_DEAD) : kitPal === "medic" ? (b.alive ? MED_LIVE : MED_DEAD) : kitPal === "davy" ? (b.alive ? DAVY_LIVE : DAVY_DEAD) : (b.alive ? INF_LIVE : INF_DEAD)[kitPal];
```

The spotter-rifle color line (line 1941 region) also indexes `(b.alive ? INF_LIVE : INF_DEAD)[kitPal]` — the davy crew has no spotter role, so it never runs for them; leave it.

## Step 4 — the portrait (`src/render/portrait.js`)

The import (line 9) gains `DAVY_HEX`:

```js
import { troopKit, MEDIC_HEX, DAVY_HEX } from "./troopkit.js";
```

The palette pick (line 46):

```js
  const pal = KIT.pal === "medic" ? { ...INFANTRY.pal.con, ...MEDIC_HEX } : INFANTRY.pal[KIT.pal];
```

becomes:

```js
  const pal = KIT.pal === "medic" ? { ...INFANTRY.pal.con, ...MEDIC_HEX } : KIT.pal === "davy" ? { ...INFANTRY.pal.con, ...DAVY_HEX } : INFANTRY.pal[KIT.pal];
```

## Step 5 — the smoke pool rises

`src/render/renderer.js`. Above the smoke pool (line 935), add the constant and re-point the five literals:

```js
  // mk2.10: SMOKE_CAP — 128 carried every battle until the mushroom cloud
  // needed a sky's worth. One constant, every guard reads it.
  const SMOKE_CAP = 384;
```

- Line 936: `pool(new THREE.PlaneGeometry(1, 1), smokeMat, 128, false)` → `pool(new THREE.PlaneGeometry(1, 1), smokeMat, SMOKE_CAP, false)`.
- Lines 1034, 1055, 1066: `if (smoke.length >= 128) break;` → `if (smoke.length >= SMOKE_CAP) break;` (three sites).
- Line 2191: `if (si < 128) smokeMesh.setMatrixAt(si++, dummy.matrix);` → `if (si < SMOKE_CAP) smokeMesh.setMatrixAt(si++, dummy.matrix);`.

## Step 6 — the flash

The post shader (line 427): the uniform line gains `uniform float uFlash;`:

```js
uniform vec2 uRes; uniform vec2 uShift; uniform float uOutline; uniform float uDither; uniform float uPalette; uniform float uLevels; uniform float uFlash;
```

In `main()`, immediately after the grade block closes (after the `}` of the `else if (uGrade > 0.0)` branch, before the `float bay =` line), add:

```js
  // mk2.10: THE ATOMIC FLASH — the whole frame washes white and decays.
  c = mix(c, vec3(1.0), uFlash);
```

The uniforms literal (line 1082): `uGrade: { value: 0 }, uT: { value: 0 },` gains `uFlash: { value: 0 },`.

State, beside `let shake = 0;` (line 1152):

```js
  let flashV = 0, davyFx = null;
```

The uniform write, beside line 2387 (`postMat.uniforms.uT.value = world.t;`), add after it:

```js
    // mk2.10: the flash holds a beat, then dies in about half a second.
    flashV = Math.max(0, flashV - dt * 2.2);
    postMat.uniforms.uFlash.value = Math.min(1, flashV);
```

## Step 7 — the burst, the stem, the cap, the ring

After `spawnDemo` closes (line 1063), add:

```js
  // mk2.10 (owner): THE ATOMIC BLAST — the demolition column's idiom driven
  // to the sky. A stem climbs hard from the crater; the cap spawns high,
  // spreads wide, hangs (long life), and the smoke step below drifts every
  // `drift` particle with the wind until it thins to nothing. Fire floods
  // the base. Dials are the owner's, live. // provisional (F5)
  function spawnNuke(x, y, z) {
    spawnDemo(x, y, z, 8);
    for (let i = 0; i < 90; i++) {                     // the stem
      if (smoke.length >= SMOKE_CAP) break;
      const t = i / 90;
      smoke.push({ x: x + (Math.random() - 0.5) * (2 + t * 3), y: y + 0.5 + t * 20, z: z + (Math.random() - 0.5) * (2 + t * 3),
        vy: 4.5 + Math.random() * 2.5, s: 2.2 + Math.random() * 2 + t * 2, life: 6 + Math.random() * 3, age: 0, drift: true });
    }
    for (let i = 0; i < 140; i++) {                    // the cap
      if (smoke.length >= SMOKE_CAP) break;
      const a = Math.random() * Math.PI * 2, rr = Math.pow(Math.random(), 0.5) * 11;
      smoke.push({ x: x + Math.cos(a) * rr, y: y + 20 + Math.random() * 5 - rr * 0.18, z: z + Math.sin(a) * rr,
        vy: 0.35 + Math.random() * 0.3, s: 3.5 + Math.random() * 3, life: 13 + Math.random() * 5, age: 0, drift: true });
    }
    for (let i = 0; i < 24; i++) {                     // the base fire
      if (fire.length >= 96) break;
      fire.push({ x: x + (Math.random() - 0.5) * 6, y: y + 0.4 + Math.random() * 3, z: z + (Math.random() - 0.5) * 6,
        s: 2 + Math.random() * 3, life: 0.8, age: 0 });
    }
  }
```

The consume boom branch (line 1155):

```js
      if (e.type === "boom") {
        spawnBoom(e.x, e.y, e.z, e.r);
        shake = Math.min(1.5, shake + 0.28 + e.r * 0.1);
      } else if (e.type === "demo") {
```

becomes:

```js
      if (e.type === "boom") {
        // mk2.10: the davy's burst is its own event — flash, ring, cloud,
        // and the shake pinned at its ceiling.
        if (e.weapon === "davy") {
          spawnNuke(e.x, e.y, e.z);
          flashV = 1.25;                    // a beat of pure white before the decay shows
          shake = 1.5;
          davyFx = { x: e.x, z: e.z, t0: world.t };
        } else {
          spawnBoom(e.x, e.y, e.z, e.r);
          shake = Math.min(1.5, shake + 0.28 + e.r * 0.1);
        }
      } else if (e.type === "demo") {
```

The ring — beside strikeRing (line 805 region), after the strikeRing lines, add:

```js
  // mk2.10: the shockwave ring — born at the davy's burst, out past the
  // blast radius in under a second, gone.
  const davyRing = new THREE.Mesh(new THREE.RingGeometry(0.92, 1.0, 64), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
  davyRing.rotation.x = -Math.PI / 2; davyRing.layers.set(1); davyRing.visible = false;
  scene.add(davyRing);
```

The ring's drive — in `render`, beside the strikeRing block (line 2348 region, `const sk = world.strikeAt;`), add after that block:

```js
    // mk2.10: the davy ring travels
    if (davyFx) {
      const age = world.t - davyFx.t0;
      if (age > 1.0) { davyFx = null; davyRing.visible = false; }
      else {
        const rr = 2 + 28 * age;
        davyRing.visible = true;
        davyRing.position.set(davyFx.x, F.heightAt(davyFx.x, davyFx.z) + 0.25, davyFx.z);
        davyRing.scale.set(rr, rr, 1);
        davyRing.material.opacity = 0.9 * (1 - age);
      }
    }
```

The drift — in the smoke step (line 2185 region), the loop body:

```js
      const p = smoke[i];
      p.age += dt; p.y += p.vy * dt;
```

becomes:

```js
      const p = smoke[i];
      p.age += dt; p.y += p.vy * dt;
      // mk2.10: cloud particles ride the wind and thin downwind.
      if (p.drift && world.wind) { p.x += world.wind.x * 0.35 * dt; p.z += world.wind.z * 0.35 * dt; }
```

## Step 8 — gates

- `node scripts/gate.mjs depot-test` — green, era 19 passing.

Nothing in `src/depot` or the engine moves; depot-lint and golden are not in the brief. Any other failing check stops the task; no sweep license.

## Step 9 — the landing

- Bump `src/version.js`: `mk2.09` → `mk2.10`.
- `npm run build` AFTER the bump.
- Commit `the atomic look and the dress, mk2.10`, push.

The acceptance is the owner's, live on the site, phone AND desktop: the flash, the ring, the stem, the hanging cap drifting downwind, the orange crew with the placard, the info-card portrait in orange.

## Report

One line of outcome; the depot-test gate summary verbatim; no fixture seed (era 19 builds no world — say so plainly); the commit hash; every deviation its own labeled bullet; skipped steps named as skipped.
