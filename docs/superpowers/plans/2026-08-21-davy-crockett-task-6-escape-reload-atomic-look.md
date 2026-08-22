# The Davy Crockett, task 6 — the escape, the reload, and the atomic look (mk2.12)

One task, two rulings (owner, 2026-08-21):

1. **The escape and the reload**, replacing the mk2.08 fatal trigger: the trigger no longer kills the crew. The blast alone rules — a crew that clears the radius before the round lands lives; a crew that does not dies with everyone else inside it. A surviving crew reloads for 30 seconds, then can fire again. One-round-per-hire is gone. Both sides identical.
2. **The atomic look and the dress**, recovered from the reverted mk2.10 plan and re-anchored: the full-screen flash, the traveling ground ring, the driven stem, the mushroom cap that hangs and drifts with the wind, maximum shake, and the crew in orange with the radiation mark. Design authority: `docs/superpowers/specs/2026-08-21-davy-crockett-design.md`.

The reload clock is a world-time stamp (`_davyReadyAt`), a plain scalar riding the save through the generic serializers; `world.t` itself is saved, so the clock survives a resume. Old saves carrying the dead `_davyFired` boolean keep it as an inert field — no reader remains.

Look acceptance is the owner's eyes, live on the site, phone AND desktop — the checks pin mechanics and wiring only, never the look. Every visual number is a starting dial for his ruling. Stated plainly, ruled by the box-prop reality: at game scale the radiation trefoil renders as a yellow chest placard with a black center — box props cannot draw lobes; a finer mark is a polish-queue item if he wants one.

The renderer already rolls its own dice for particles (the frozen-demo idiom); the new particle code keeps that idiom. Everything else new (flash decay, ring, drift) runs off world time and the wind. Renderer changes are guarded additive divergences under the frozen law, so `golden.mjs` rides the gates. No engine change.

**Suggested model: Sonnet** — mechanical edits, all code carried below.

## Required reading

- This plan.
- `src/depot/state.js` lines 664–712 (stepDavyShot) and the davy branch in possessedVolley (opens at line 776).
- `src/depot/units.js` lines 448–537 (stepDavy and its call site at 536).
- `src/depot/specs.js` lines 300–305 (DAVY_FIRE).
- `src/depot/infocards.js` line 39.
- `src/render/troopkit.js` whole (167 lines).
- `src/render/portrait.js` lines 1–50 (the palette pick at line 46, the import at line 9).
- `src/render/renderer.js` lines 424–470 (the post shader), 800–810 (strikeRing), 870–880 (the medic palette at 876), 930–940 (the smoke pool at 936), 1025–1070 (spawnBoom/spawnDemo, the `smoke.length >= 128` guards at 1034/1055/1066), 1076–1086 (the post uniforms at 1082), 1150–1185 (shake at 1152, the boom branch at 1155), 1975–1985 (the man-loop palette pick at 1980), 2185–2195 (the smoke step, the `si < 128` write at 2191), 2340–2360 (the strikeRing drive), 2380–2390 (the uT write at 2387).
- `scripts/depot-test.mjs` whole.
- `scripts/tests/17-the-davy-crockett.mjs` whole.
- `scripts/tests/20-the-possessed-trigger.mjs` whole.
- `scripts/tests/18-the-green-fog.mjs` whole (era idiom).

## Step 1 — the failing checks

All three era changes land first and must FAIL before any source moves. The era-04 source pins are untouched — the surface-aim lines they count do not move.

**`scripts/tests/17-the-davy-crockett.mjs`** — the header comment's line 2 changes from `// round: the blast hurts both sides, the crew dies at the trigger, the` to `// round: the blast hurts both sides, the crew lives to run and reloads, the`. The third block (lines 31–51, "the crew fires once under attack and dies at the trigger") is replaced whole:

```js
{
  // the crew fires under attack, lives at the trigger, reloads 30s (seed 7)
  const field = makeField(41, 2.0, 7);
  const world = makeWorld({ field, seed: 7 });
  world.depotCombat = true; world._tdStruct = true;
  const sq = makeSquad(1, "davy", 1, 0, 0);
  spawnSquadMembers(world, sq);
  sq.order = "attack"; sq.dest = { x: 0, z: 18 };
  const tgt = addBody(world, { kind: "unit", team: 2, mass: 80, hx: 0.28, hy: 1.0, hz: 0.28, x: 0, y: 1.1, z: 15, hp: 58 });
  void tgt;
  const before = world.projectiles.length;
  for (let i = 0; i < 300 && world.projectiles.length === before; i++) { stepDavyShot(world, sq, 1 / 120, null); world.t += 1 / 120; }
  ok("davy: one round leaves the tube", world.projectiles.length === before + 1);
  const crew = sq.memberIds.map((id) => world.byId.get(id));
  ok("davy: the crew lives at the trigger", crew.every((u) => u && u.alive));
  ok("davy: the reload clock is stamped", sq._davyReadyAt > world.t + 25);
  const mid = world.projectiles.length;
  for (let i = 0; i < 240; i++) { stepDavyShot(world, sq, 1 / 120, null); world.t += 1 / 120; }
  ok("davy: no second round during the reload", world.projectiles.length === mid);
  world.t = sq._davyReadyAt + 0.01;
  for (let i = 0; i < 300 && world.projectiles.length === mid; i++) { stepDavyShot(world, sq, 1 / 120, null); world.t += 1 / 120; }
  ok("davy: the reloaded crew fires again", world.projectiles.length === mid + 1);
  // the crew's death pays and scores nobody (friendly fire under the kill law)
  const S = makeRunState();
  const paid = scoreKill(S, { type: "kill", attacker: "player", team: 1, kind: "unit", utype: "davy" }, null);
  ok("davy: the crew's death pays nobody", paid === null && S.score.p.kills === 0);
}
```

(The world is never stepped, so the round never lands — this tests the trigger, not the blast; the blast's both-sides law keeps its own block, untouched.)

**`scripts/tests/20-the-possessed-trigger.mjs`** — replaced whole:

```js
// COLDSNAP suite era 20 — THE POSSESSED TRIGGER (mk2.11, re-taught mk2.12).
// The atomic crew fires under the owner's hand like every unit: the round at
// the reticle, the crew alive at the trigger, the 30-second reload shared
// with the ATTACK path. Fixture seed: 11. No seed is special.
import { ok } from "./harness.mjs";
import { makeField, makeWorld } from "../../src/engine/core.js";
import { makeSquad } from "../../src/depot/squads.js";
import { spawnSquadMembers, possessedVolley } from "../../src/depot/state.js";

{
  const world = makeWorld({ field: makeField(41, 2.0, 11), seed: 11 });
  world.depotCombat = true; world._tdStruct = true;
  const sq = makeSquad(1, "davy", 1, 0, 0);
  spawnSquadMembers(world, sq);
  const before = world.projectiles.length;
  const fired = possessedVolley(world, sq, { x: 0, z: 15 }, null);
  ok("trigger: the possessed crew fires the round", fired === 1 && world.projectiles.length === before + 1);
  ok("trigger: the reload clock is the ATTACK path's own", sq._davyReadyAt > world.t + 25);
  const crew = sq.memberIds.map((id) => world.byId.get(id));
  ok("trigger: the crew lives at the trigger", crew.every((u) => u && u.alive));
  ok("trigger: no second round during the reload", possessedVolley(world, sq, { x: 0, z: 15 }, null) === 0);
  world.t = sq._davyReadyAt + 0.01;
  ok("trigger: the reloaded crew fires again", possessedVolley(world, sq, { x: 0, z: 15 }, null) === 1);
}
```

**Create `scripts/tests/19-the-atomic-look.mjs`** (the era number fills the 18→20 gap):

```js
// COLDSNAP suite era 19 — THE ATOMIC LOOK AND THE DRESS (mk2.12). Mechanics
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

Register it in `scripts/depot-test.mjs` after line 34 (`await import("./tests/18-the-green-fog.mjs");`), before line 35 (`await import("./tests/20-the-possessed-trigger.mjs");`) — the eras run in number order:

```js
await import("./tests/19-the-atomic-look.mjs");
```

Run `node scripts/gate.mjs depot-test` — the re-taught checks and era 19 must FAIL. Confirm before any source moves.

## Step 2 — the reload joins the table (`src/depot/specs.js`)

Line 305:

```js
export const DAVY_FIRE = { projSpeed: 28, kind: "shell", weapon: "davy", dmg: 200, blastR: 25, kv: 40, crater: 10, range: 20, acc: 0.005, occl: "lofted", windF: 0.04, windComp: 0.6 };
```

becomes:

```js
export const DAVY_FIRE = { projSpeed: 28, kind: "shell", weapon: "davy", dmg: 200, blastR: 25, kv: 40, crater: 10, range: 20, acc: 0.005, occl: "lofted", windF: 0.04, windComp: 0.6, reloadS: 30 };
```

In the comment block above it (lines 300–304), the sentence `// The crew dies at the trigger (state.js stepDavyShot / units.js stepDavy),` and the line after it change to `// mk2.12 (owner): the trigger no longer kills — the blast alone rules, and` / `// a surviving crew reloads reloadS seconds, both sides. // provisional (F5)`.

## Step 3 — the ATTACK path (`src/depot/state.js`)

The header comment (lines 665–671) is replaced:

```js
// mk2.08 (owner): THE DAVY CROCKETT'S SHOT. Under the ATTACK order only
// (the sapper's rule), the crew's lead man fires the atomic round at the
// nearest target its side SEES — man, machine, or hostile structure — inside
// the elevation-scaled range. mk2.12 (owner): THE ESCAPE AND THE RELOAD —
// the trigger no longer kills; the blast alone rules, and the crew reloads
// DAVY_FIRE.reloadS seconds (_davyReadyAt, a world-time stamp riding the
// generic squad serializer). Draws: exactly the round's own 2 (applyScatter).
```

Line 673, the gate:

```js
  if (squad.type !== "davy" || squad._davyFired) return;
```

becomes:

```js
  if (squad.type !== "davy" || (squad._davyReadyAt || 0) > world.t) return;
```

The firing tail (lines 701–711), from `squad._davyFired = true;` through the closing `}` of the kill loop, is replaced:

```js
  squad._davyReadyAt = world.t + spec.reloadS;
  const attacker = squad.team === 1 ? "player" : "enemy";
  shooterFire(world, shooter, muzzle, best.kind !== "unit" && best.kind !== "vehicle" && best.kind !== "mech" ? aimTop(world, best) : best, spec, { high: true, attacker, hitStruct: true, owner: shooter.id });
  // mk2.12 (owner): THE ESCAPE — no fatal trigger. Outrun the blast or die
  // inside it with everyone else.
```

## Step 4 — the possessed trigger (`src/depot/state.js`)

In the davy branch of possessedVolley: the comment's last two lines (`// shared with the ATTACK path (stepDavyShot): one round per hire,` / `// whichever path fires first spends it.`) become `// shared with the ATTACK path (stepDavyShot): one reload clock,` / `// whichever path fires starts it. mk2.12: the trigger no longer kills.`. Then three edits:

- `if (squad._davyFired) return 0;` → `if ((squad._davyReadyAt || 0) > world.t) return 0;`
- `squad._davyFired = true;` → `squad._davyReadyAt = world.t + DAVY_FIRE.reloadS;`
- The kill loop (`for (const id of squad.memberIds) { ... applyDamage(world, u, 1e9, { attacker }); }` — the three lines before `return 1;`) is deleted.

The `sy`/`tgt` lines are byte-untouched — the era-04 pins count them.

## Step 5 — the enemy crew (`src/depot/units.js`)

The header comment (lines 448–451): the last two sentences change from `One shot when a seen player target or structure is inside range, then the crew dies at the trigger. u._davyFired latches per man; the pair fires as one (the first man to acquire fires for both — his partner dies with him).` to `Fires when a seen player target or structure is inside range. mk2.12 (owner): no fatal trigger — the blast alone rules; the pair reloads as one, DAVY_FIRE.reloadS seconds (_davyReadyAt per man, the generic body sweep).`

Line 453:

```js
  if (u._davyFired) return true;
```

becomes:

```js
  if ((u._davyReadyAt || 0) > world.t) return false;
```

(`false`, so a reloading crew keeps marching and fighting for position like any man.)

The pair loop (lines 478–484):

```js
  for (const o of world.bodies) {
    if (o.kind !== "unit" || !o.alive || o.team !== 2 || o.tag !== "davy") continue;
    if (o !== u && Math.hypot(o.pos.x - u.pos.x, o.pos.z - u.pos.z) > 6) continue;
    o._davyFired = true;
    applyDamage(world, o, 1e9, { attacker: "enemy" });
  }
```

becomes:

```js
  for (const o of world.bodies) {
    if (o.kind !== "unit" || !o.alive || o.team !== 2 || o.tag !== "davy") continue;
    if (o !== u && Math.hypot(o.pos.x - u.pos.x, o.pos.z - u.pos.z) > 6) continue;
    o._davyReadyAt = world.t + DAVY_FIRE.reloadS;
  }
```

## Step 6 — the card tells the truth (`src/depot/infocards.js`)

Line 39:

```js
  sq_davy: sq("davy", "Two men in orange and the smallest atomic weapon ever fielded. One shot per hire; the crew dies with it. The blast spares nobody.", ["DEFEND", "MOVE", "ATTACK (THE ONE SHOT)", "TAKE CONTROL"], 200),
```

becomes:

```js
  sq_davy: sq("davy", "Two men in orange and the smallest atomic weapon ever fielded. The blast spares nobody — outrun it or die with it. Thirty seconds to reload.", ["DEFEND", "MOVE", "ATTACK", "TAKE CONTROL"], 200),
```

## Step 7 — the dress (`src/render/troopkit.js`)

After the mechanic's TOOLBOX prop (line 86) and beside MEDIC_HEX (line 90), add:

```js
// mk2.12 (owner): THE ATOMIC CREW'S DRESS — orange jumpsuits, the radiation
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

The palette pick (line 149) — the suit outranks the coat, both sides, the medic's own rule. The line:

```js
  const pal = (b.utype === "medics" || b.tag === "medic") ? "medic" : gren || b.team === 2 ? "gren" : "con"; // P7.2 T6 (owner): the cross outranks the coat — both sides' medics wear the white
```

becomes:

```js
  const pal = (b.utype === "medics" || b.tag === "medic") ? "medic"
    : (b.utype === "davy" || b.tag === "davy") ? "davy" // mk2.12: the orange outranks the coat — both sides' atomic crews
    : gren || b.team === 2 ? "gren" : "con"; // P7.2 T6 (owner): the cross outranks the coat — both sides' medics wear the white
```

The kit dispatch — in the player branch, after the `mechanics` line (line 156), add:

```js
      : b.utype === "davy" ? KIT_DAVY
```

In the enemy branch, after the `mechanic` line (line 163), add:

```js
      : b.tag === "davy" ? KIT_DAVY
```

## Step 8 — the renderer's palettes (`src/render/renderer.js`)

Beside MED_LIVE/MED_DEAD (lines 876–877), add:

```js
  // mk2.12: the atomic crew's orange — DAVY_HEX over the con palette, and a
  // scorched grey-orange for the dead.
  const DAVY_LIVE = mkPal({ ...INFANTRY.pal.con, ...DAVY_HEX });
  const DAVY_DEAD = mkPal({ ...INFANTRY.dead.con, dom: 0x7a4a20, sec: 0x5c3816, acc: 0x8a7430, gun: 0x101214 });
```

The import (line 6) gains `DAVY_HEX`:

```js
import { troopKit, RIFLE_PREROT, MEDIC_HEX, DAVY_HEX } from "./troopkit.js";
```

The man-loop palette pick (line 1980): the expression

```js
            const pal = b.dress === "android" ? (b.alive ? AND_LIVE : AND_DEAD) : kitPal === "medic" ? (b.alive ? MED_LIVE : MED_DEAD) : (b.alive ? INF_LIVE : INF_DEAD)[kitPal];
```

becomes:

```js
            const pal = b.dress === "android" ? (b.alive ? AND_LIVE : AND_DEAD) : kitPal === "medic" ? (b.alive ? MED_LIVE : MED_DEAD) : kitPal === "davy" ? (b.alive ? DAVY_LIVE : DAVY_DEAD) : (b.alive ? INF_LIVE : INF_DEAD)[kitPal];
```

The spotter-rifle color line (line 1941 region) also indexes `(b.alive ? INF_LIVE : INF_DEAD)[kitPal]` — the davy crew has no spotter role, so it never runs for them; leave it.

## Step 9 — the portrait (`src/render/portrait.js`)

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

## Step 10 — the smoke pool rises (`src/render/renderer.js`)

Above the smoke pool (line 936), add the constant and re-point the five literals:

```js
  // mk2.12: SMOKE_CAP — 128 carried every battle until the mushroom cloud
  // needed a sky's worth. One constant, every guard reads it.
  const SMOKE_CAP = 384;
```

- Line 936: `pool(new THREE.PlaneGeometry(1, 1), smokeMat, 128, false)` → `pool(new THREE.PlaneGeometry(1, 1), smokeMat, SMOKE_CAP, false)`.
- Lines 1034, 1055, 1066: `if (smoke.length >= 128) break;` → `if (smoke.length >= SMOKE_CAP) break;` (three sites).
- Line 2191: `if (si < 128) smokeMesh.setMatrixAt(si++, dummy.matrix);` → `if (si < SMOKE_CAP) smokeMesh.setMatrixAt(si++, dummy.matrix);`.

## Step 11 — the flash (`src/render/renderer.js`)

The post shader (line 427): the uniform line gains `uniform float uFlash;`:

```js
uniform vec2 uRes; uniform vec2 uShift; uniform float uOutline; uniform float uDither; uniform float uPalette; uniform float uLevels; uniform float uFlash;
```

In `main()`, immediately after the grade block closes (after the `}` of the `else if (uGrade > 0.0)` branch, before the `float bay =` line), add:

```js
  // mk2.12: THE ATOMIC FLASH — the whole frame washes white and decays.
  c = mix(c, vec3(1.0), uFlash);
```

The uniforms literal (line 1082): `uGrade: { value: 0 }, uT: { value: 0 },` gains `uFlash: { value: 0 },`.

State, beside `let shake = 0;` (line 1152):

```js
  let flashV = 0, davyFx = null;
```

The uniform write, beside line 2387 (`postMat.uniforms.uT.value = world.t;`), add after it:

```js
    // mk2.12: the flash holds a beat, then dies in about half a second.
    flashV = Math.max(0, flashV - dt * 2.2);
    postMat.uniforms.uFlash.value = Math.min(1, flashV);
```

## Step 12 — the burst, the stem, the cap, the ring (`src/render/renderer.js`)

After `spawnDemo` closes (line 1063), add:

```js
  // mk2.12 (owner): THE ATOMIC BLAST — the demolition column's idiom driven
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
        // mk2.12: the davy's burst is its own event — flash, ring, cloud,
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

The ring — after the strikeRing lines (805–807), add:

```js
  // mk2.12: the shockwave ring — born at the davy's burst, out past the
  // blast radius in under a second, gone.
  const davyRing = new THREE.Mesh(new THREE.RingGeometry(0.92, 1.0, 64), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
  davyRing.rotation.x = -Math.PI / 2; davyRing.layers.set(1); davyRing.visible = false;
  scene.add(davyRing);
```

The ring's drive — in `render`, after the strikeRing block (the `} else strikeRing.visible = false;` line at 2357), add:

```js
    // mk2.12: the davy ring travels
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
      // mk2.12: cloud particles ride the wind and thin downwind.
      if (p.drift && world.wind) { p.x += world.wind.x * 0.35 * dt; p.z += world.wind.z * 0.35 * dt; }
```

## Step 13 — gates

- `node scripts/gate.mjs depot-test` — green: eras 17 and 20 re-taught and passing, era 19 passing, era 04 untouched and passing.
- `node scripts/gate.mjs depot-lint` — green (no new dice in `src/depot`).
- `node scripts/gate.mjs golden` — green. The renderer moved; the frozen law demands it.

Any other failing check stops the task; no sweep license beyond the re-teaches carried above.

## Step 14 — the landing

- Bump `src/version.js`: `mk2.11` → `mk2.12`.
- `npm run build` AFTER the bump.
- Commit `the escape, the reload, and the atomic look, mk2.12`, push.

The acceptance is the owner's, live on the site, phone AND desktop: fire, run the crew clear, watch them live and reload; the flash, the ring, the stem, the hanging cap drifting downwind; the orange crew with the placard; the info-card portrait in orange.

## Report

One line of outcome; all three gate summaries verbatim; fixture seeds (7, 9, 11 — era 19 builds no world, said plainly); the commit hash; every re-teach old → new as its own bullet; every deviation its own labeled bullet; skipped steps named as skipped.
