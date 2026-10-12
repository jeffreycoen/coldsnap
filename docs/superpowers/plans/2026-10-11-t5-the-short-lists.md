# T5 — The short lists (0.6.5)

The outbreak's own searches stop walking the whole world. The dead's prey search, the dead's claw search, the hold bite, and the people's search read the short lists the game already builds every frame — every living unit, the standing walls and bags, the hulls — and fall back to the whole world only when the lists are not built. The people stop searching every tick while shots fire: a shot is remembered on the world for three tenths of a second, and every person hears it on her normal search, five times a second. A person may start running up to a quarter second later than today. Nothing else about the game changes: the picks are the same picks in the same order, and the war's headless keystone is unchanged. The headless gate sets the hot flag on an outbreak run so it runs the same path the live game runs.

Checked on a fresh copy at plan-writing time: every anchor hit exactly once, every changed file parses, `depot-lint` PASS, `depot-test` 1696 PASS / 0 FAIL (the era's fixture seed 607936), the keystone unchanged, the outbreak gate's world number unchanged, smoke 27/27.

Suggested model: Sonnet 5.5 — every step is verbatim code at a grepped anchor; nothing is designed.

## Required reading, in this order

1. `CLAUDE.md`
2. This file, whole, before the first edit.
3. `docs/superpowers/plans/2026-10-11-coldsnap-the-outbreak-phase.md` whole
4. `src/depot/lists.js` whole
5. `src/depot/dead.js` lines 92–156
6. `src/depot/people.js` lines 91–121
7. `src/depot/tick.js` lines 244–257
8. `src/depot/api.js` lines 411–432
9. `scripts/tests/49-the-people.mjs` lines 58–68, `scripts/tests/06-troops-physics.mjs` lines 304–327, `scripts/depot-test.mjs`

The report opens with a line confirming every file above was read.

## Gates

Run only these, each through `node scripts/gate.mjs <name>`: `depot-lint`, `depot-test`, `smoke`. The smoke needs `npm run build` then `npm run preview &` first. `golden` does not run: neither `core.js` nor `renderer.js` changes.

The keystone: `node src/depot/api.js gate 7 20` prints `seed 7  seconds 20 (2400 steps)  worldHash 1278094788  runHash 2033212782` on the untouched tree. Step 0 confirms it; Step 10 confirms it again unchanged. Any other number stops the task.

Sweep license: one assert in `scripts/tests/49-the-people.mjs` pins the every-tick shot search that this task removes; it is re-taught in Step 6, stated old→new there. No other re-teach is licensed. Any failing test other than the new era file's own asserts before Step 7 stops the task.

## Steps

### Step 0 — the keystone, before

Run `node src/depot/api.js gate 7 20`. The output must read exactly `seed 7  seconds 20 (2400 steps)  worldHash 1278094788  runHash 2033212782`. Record it.

Run `node src/depot/api.js gate 7 20 outbreak`. The output must read exactly `seed 7  seconds 20 (2400 steps)  worldHash 3833236347  runHash 1192809944  dead 13`. Record it.

### Step 1 — the failing era file

Create `scripts/tests/52-the-short-lists.mjs`:

```js
import { ok } from "./harness.mjs";
import { makeWorld, addBody, worldHash } from "../../src/engine/core.js";
import { MAN, DEAD_TEAM, PERSON } from "../../src/depot/specs.js";
import { spawnDead, stepDead } from "../../src/depot/dead.js";
import { spawnPerson, stepPeople } from "../../src/depot/people.js";
import { makeBodyLists, rebuildBodyLists } from "../../src/depot/lists.js";
import { bootWar } from "../../src/depot/boot.js";
import { tickWar } from "../../src/depot/tick.js";
import { defaultTickInput } from "../../src/depot/api.js";

// ==== 0.6.5: the short lists ================================================
// Seed rolled each run.
{
  console.log("\n[0.6.5: the short lists]");
  const SEED = (Date.now() % 1000000) + 1;
  console.log("  fixture seed base", SEED);
  const flat = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (x, z, o) => { o.x = 0; o.y = 1; o.z = 0; return o; } };
  const flatMap = { clampToRim: (x, z) => ({ x, z }) };
  const man = (w, team, x, z) => { const u = addBody(w, { kind: "unit", team, mass: MAN.rifle.mass, hx: MAN.rifle.hx, hy: MAN.rifle.hy, hz: MAN.rifle.hz, x, z, y: MAN.rifle.hy + 0.02, hp: MAN.rifle.hp, friction: 0.5 }); u.maxHp = MAN.rifle.hp; return u; };
  const stone = (w, x, z) => addBody(w, { kind: "wall", team: 1, mass: 0, hx: 0.9, hy: 0.9, hz: 0.9, x, z, y: 0.9, hp: 70 });

  // (a) the list: every living unit, in world order
  {
    const w = makeWorld({ field: flat, seed: SEED }); w.depotCombat = true;
    man(w, 1, 0, 0); stone(w, 5, 5); man(w, 2, 3, 0); const d = spawnDead(w, 6, 0); spawnPerson(w, 9, 0); const gone = man(w, 1, 12, 0); gone.alive = false;
    const L = makeBodyLists();
    ok("(a) makeBodyLists carries a units list", Array.isArray(L.units));
    rebuildBodyLists(w, L);
    const ref = w.bodies.filter((b) => b.alive && b.kind === "unit");
    ok("(a) units is every living unit, in world order", L.units.length === ref.length && L.units.every((b, i) => b === ref[i]) && L.units.includes(d), `${L.units.length}/${ref.length}`);
  }

  // (b) the prey pick: the same man, lists or no lists
  {
    const w = makeWorld({ field: flat, seed: SEED }); w.depotCombat = true;
    man(w, 1, 8, 0); man(w, 2, -8, 0.5); spawnPerson(w, 0, 8); const d = spawnDead(w, 0, 0);
    rebuildBodyLists(w, makeBodyLists());
    stepDead(w, 1 / 120); const withL = d.tgtId;
    d.tgtId = null; d.scanCd = 0; w._L = null;
    stepDead(w, 1 / 120); const without = d.tgtId;
    ok("(b) the prey pick is the same man with the lists and without", withL != null && withL === without, `${withL}/${without}`);
  }

  // (c) the claw pick: the same stone, lists or no lists
  {
    const w = makeWorld({ field: flat, seed: SEED }); w.depotCombat = true;
    const d = spawnDead(w, 0, 0); const s = stone(w, d.pos.x + 0.9 + d.hx + 0.1, d.pos.z);
    const run = { _sounds: [{ x: 30, z: 0, r: 40 }] };
    rebuildBodyLists(w, makeBodyLists());
    stepDead(w, 1 / 120, run); const withL = d._clawId;
    d._clawId = null; d._clawCd = 0; w._L = null;
    stepDead(w, 1 / 120, run); const without = d._clawId;
    ok("(c) the claw pick is the same stone with the lists and without", withL === s.id && without === s.id, `${withL}/${without}/${s.id}`);
  }

  // (d) the remembered shot: heard on her next search, not every tick; forgotten after three tenths
  {
    const w = makeWorld({ field: flat, seed: SEED }); w.depotCombat = true; w.t = 10;
    const p = spawnPerson(w, 0, 0);
    stepPeople(w, flatMap, 1 / 120); w.t += 1 / 120;                       // her first search, silence
    w.events.push({ type: "muzzle", x: 20, y: 1, z: 0 });
    stepPeople(w, flatMap, 1 / 120); w.t += 1 / 120; w.events.length = 0;  // the shot lands between searches
    ok("(d) a shot between searches is not heard that tick", !p._fleeing);
    for (let i = 0; i < 30; i++) { stepPeople(w, flatMap, 1 / 120); w.t += 1 / 120; }
    ok("(d) her next search, inside a quarter second, hears it and she runs away from it", !!p._fleeing && p.goal && p.goal.x < 0, p.goal ? p.goal.x.toFixed(1) : "-");
    for (let i = 0; i < 40; i++) { stepPeople(w, flatMap, 1 / 120); w.t += 1 / 120; }
    ok("(d) three tenths on, the shot is forgotten", Array.isArray(w._shots) && w._shots.length === 0, String(w._shots && w._shots.length));
  }

  // (e) the whole outbreak: two seconds with the lists and two without land on one number
  {
    const a = bootWar({ seed: SEED, outbreak: true }), b = bootWar({ seed: SEED, outbreak: true });
    a.run.started = true; b.run.started = true; a.run._hot = true;
    const input = defaultTickInput();
    for (let i = 0; i < 240; i++) { tickWar(a, 1 / 120, input); tickWar(b, 1 / 120, input); }
    ok("(e) the lists change nothing: the outbreak's number is the same with them and without", !!a.world._L && !b.world._L && worldHash(a.world) === worldHash(b.world), `${worldHash(a.world)}/${worldHash(b.world)}`);
  }
}
```

In `scripts/depot-test.mjs`, after the line `await import("./tests/51-the-people-indoors.mjs");` add the line `await import("./tests/52-the-short-lists.mjs");`.

Run `node scripts/gate.mjs depot-test`. The new era's (a), (b), (c), (d), and (e) asserts fail; every other assert passes. Record the fail count.

### Step 2 — the units list

In `src/depot/lists.js`:

Replace `  return { solids: [], statics: [], friends: [], foes: [], structsFor1: [], structsFor2: [], friendly: [], vehicles: [], people: [] };` with `  return { solids: [], statics: [], friends: [], foes: [], structsFor1: [], structsFor2: [], friendly: [], vehicles: [], people: [], units: [] };`.

Replace `  L.structsFor1.length = 0; L.structsFor2.length = 0; L.friendly.length = 0; L.people.length = 0;` with `  L.structsFor1.length = 0; L.structsFor2.length = 0; L.friendly.length = 0; L.people.length = 0; L.units.length = 0;`.

Replace

```js
      if (k === "vehicle" || k === "mech") L.vehicles.push(b);
```

with

```js
      if (k === "vehicle" || k === "mech") L.vehicles.push(b);
      if (k === "unit") L.units.push(b); // 0.6.5: every living unit, world order — the dead's searches and the people's read this
```

### Step 3 — the dead read the lists

In `src/depot/dead.js`:

The claw. Replace

```js
    const pool = world.bodies;
    for (const c of pool) { if (clawable(c) && pressedAgainst(u, c)) { b = c; break; } }
```

with

```js
    // 0.6.5: the short lists — courses, bags, and towers sit in statics, the
    // hulls in vehicles; the first hit of each, the earlier-born wins, so the
    // pick is the whole walk's pick. No lists: the whole walk.
    if (world._L) {
      let s = null, h = null;
      for (const c of world._L.statics) { if (clawable(c) && pressedAgainst(u, c)) { s = c; break; } }
      for (const c of world._L.vehicles) { if (clawable(c) && pressedAgainst(u, c)) { h = c; break; } }
      b = s && h ? (s.seq < h.seq ? s : h) : (s || h);
    } else for (const c of world.bodies) { if (clawable(c) && pressedAgainst(u, c)) { b = c; break; } }
```

The hold bite. Replace `      for (const b of world.bodies) if (b.kind === "unit" && b.alive && b.team !== DEAD_TEAM && b.riding && b.rideApc === u.rideApc) biteBody(world, u, b);` with `      for (const b of (world._L ? world._L.units : world.bodies)) if (b.kind === "unit" && b.alive && b.team !== DEAD_TEAM && b.riding && b.rideApc === u.rideApc) biteBody(world, u, b); // 0.6.5: the short list`.

The prey search. Replace

```js
      let bd = R2;
      for (const b of world.bodies) {
        if (!prey(b)) continue;
```

with

```js
      let bd = R2;
      for (const b of (world._L ? world._L.units : world.bodies)) { // 0.6.5: the short list, world order, the same predicate
        if (!prey(b)) continue;
```

### Step 4 — the people read the list and remember the shots

In `src/depot/people.js`:

Replace `const IN_1 = 1.1, IN_2 = 2.0, OUT = 1.3;` with

```js
const IN_1 = 1.1, IN_2 = 2.0, OUT = 1.3;
const SHOT_KEEP_S = 0.3; // 0.6.5: a shot stays on the books this long — past every person's search cadence (0.2 to 0.284 s)
```

Replace

```js
  let shots = null;
  for (const e of world.events) if (e.type === "muzzle") (shots || (shots = [])).push(e);
```

with

```js
  // 0.6.5: THE REMEMBERED SHOTS — this tick's shots join a list on the world
  // and stay SHOT_KEEP_S, so every person's next search hears them; the
  // every-tick search under fire is gone. Never saved; zero draws.
  const shots = world._shots || (world._shots = []);
  for (const e of world.events) if (e.type === "muzzle") shots.push({ x: e.x, z: e.z, t: world.t });
  while (shots.length && world.t - shots[0].t > SHOT_KEEP_S) shots.shift();
```

Replace

```js
    if (u.scanCd <= 0 || shots) {
      if (u.scanCd <= 0) u.scanCd = 0.2 + (u.seq % 8) * 0.012;
      let tx = null, tz = null, bd = F2;
      for (const b of world.bodies) {
```

with

```js
    if (u.scanCd <= 0) {
      u.scanCd = 0.2 + (u.seq % 8) * 0.012;
      let tx = null, tz = null, bd = F2;
      for (const b of (world._L ? world._L.units : world.bodies)) { // 0.6.5: the short list, world order, the same predicate
```

Replace `      if (tx == null && shots) {` with `      if (tx == null && shots.length) {`.

### Step 5 — the gate runs the game's path

In `src/depot/api.js`, replace

```js
    const input = defaultTickInput();
    for (let i = 0; i < steps; i++) tickWar(war, STEP, input);
```

with

```js
    const input = defaultTickInput();
    if (war.run.outbreak) war.run._hot = true; // 0.6.5: the dead stand from the first tick, so the live game builds its lists throughout; the gate runs that same path
    for (let i = 0; i < steps; i++) tickWar(war, STEP, input);
```

### Step 6 — the re-teach

In `scripts/tests/49-the-people.mjs`, replace

```js
    w.events.length = 0; w.events.push({ type: "muzzle", x: 20, y: 1, z: 0 });
    stepPeople(w, flatMap, 1 / 120);
```

with

```js
    w.events.length = 0; w.events.push({ type: "muzzle", x: 20, y: 1, z: 0 });
    for (let i = 0; i < 30; i++) { stepPeople(w, flatMap, 1 / 120); w.t += 1 / 120; w.events.length = 0; } // 0.6.5: the shot is remembered; her next search, inside a quarter second, hears it
```

Old → new: one tick after the shot → thirty ticks after the shot. The asserted content — a shot 20 m off sends her running, away from it; a shot 50 m off is not heard — is unchanged.

### Step 7 — the mark

In `src/version.js`, replace `export const MK = "0.6.4";` with `export const MK = "0.6.5";`.

### Step 8 — the gates

Run, in this order, and record each result line:

1. `node scripts/gate.mjs depot-lint` — `depot-lint PASS`.
2. `node scripts/gate.mjs depot-test` — ends `depot-test PASS`; the new era's 8 asserts all PASS; the total is 1688 + 8 = 1696 PASS / 0 FAIL; the report states the numbers and the era's fixture seed.
3. `npm run build`, then `npm run preview &`, then `node scripts/gate.mjs smoke` — `BOOT-LOAD SMOKE: ALL PASS`, 27 PASS lines. Stop the preview server after.

### Step 9 — the outbreak's own headless run

Run `node src/depot/api.js gate 7 20 outbreak`. It must print `seed 7  seconds 20 (2400 steps)  worldHash 3833236347  runHash 3692418097  dead 13`. The world number is Step 0's own (no shot is fired in that run, so no person's flight moves); the run number moves from Step 0's 1192809944 because the gate's hot flag now sits on the run. Both lines go in the report.

### Step 10 — the keystone, after

Run `node src/depot/api.js gate 7 20`. The output must read exactly `seed 7  seconds 20 (2400 steps)  worldHash 1278094788  runHash 2033212782`. Any other number stops the task before the commit; report it.

### Step 11 — the landing

Commit exactly these files in one commit: `src/depot/lists.js`, `src/depot/dead.js`, `src/depot/people.js`, `src/depot/api.js`, `src/version.js`, `scripts/depot-test.mjs`, `scripts/tests/49-the-people.mjs`, `scripts/tests/52-the-short-lists.mjs`, and this plan file. Subject: `the short lists, 0.6.5`. Push to `main`.

Then in `docs/superpowers/plans/2026-10-11-coldsnap-the-outbreak-phase.md`, after the T4 row add the row `| T5 | 0.6.5 | The short lists: the dead's and the people's searches read the frame's unit, wall, and hull lists instead of the whole world; shots are remembered three tenths of a second and heard on the normal search; the headless outbreak gate runs the lists | LANDED — mark 0.6.5, keystone unchanged (seed 7, 20 s: 1278094788 / 2033212782), depot-test 1696, smoke 27/27 |`. Commit that file alone with the subject `t5 lands in the phase document — 0.6.5, the short lists, 27/27`. Push.

### Step 12 — the keystone, confirmed on the pushed tree

Run `node src/depot/api.js gate 7 20` once more and record the line; it must still match Step 0.

## Acceptance

- Step 0, Step 10, and Step 12 print the identical keystone line.
- `depot-test` 1696 PASS / 0 FAIL on a rolled seed; `depot-lint` PASS; smoke 27/27.
- The outbreak gate runs to the end, before and after.
- The live site, phone and desktop: the outbreak plays as it did — the dead hunt, bite, and claw; the people run from the dead and from gunfire and walk home — and the frame rate during a firefight in the towns is higher than before. The owner's eyes are the acceptance.

## Report

One line of outcome, then: every gate's result line; the three keystone lines; the two outbreak lines; the depot-test totals; the era's fixture seed; the re-teach old→new; the commit hashes; every deviation, nonconformity, and re-pin as its own labeled bullet.
