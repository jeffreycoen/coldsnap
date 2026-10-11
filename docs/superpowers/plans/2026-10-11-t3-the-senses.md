# T3 — The senses (0.6.3)

The dead hear and claw. Every shot fired within 40 meters and every burst or collapse within 80 meters draws them: the nearest sound of the last tick sets a destination, they walk to it at their pace, and on arrival they stand and hunt as usual; a living body within 24 meters takes over at any point. One of the dead pressed against a wall course, a sandbag, a tower, a hull, or the mech while it has somewhere to go — a target or a sound — takes two points a second off it, armor or not. And the convoy changes for both games: buying a plan off the hand no longer arms the build bar; only a hire goes on to placement. The war's headless keystone is unchanged by all of it: the sounds and the clawing run only under the outbreak, and the convoy change is interface.

Suggested model: Sonnet 5.5 — every step is verbatim code at a grepped anchor; nothing is designed.

## Required reading, in this order

1. `CLAUDE.md`
2. This file, whole, before the first edit.
3. `docs/superpowers/plans/2026-10-11-coldsnap-the-outbreak-phase.md` whole
4. `src/depot/dead.js` whole
5. `src/depot/specs.js` lines 321–332
6. `src/depot/sim.js` lines 441–452, 529–546, 730–740
7. `src/engine/core.js` lines 440–447 and 495–498 (the muzzle and boom events)
8. `src/depot/DepotGame.jsx` lines 747–766
9. `scripts/tests/49-the-people.mjs`, `scripts/depot-test.mjs`

The report opens with a line confirming every file above was read.

## Gates

Run only these, each through `node scripts/gate.mjs <name>`: `depot-lint`, `depot-test`, `smoke`. The smoke needs `npm run build` then `npm run preview &` first. `golden` does not run: neither `core.js` nor `renderer.js` changes.

The keystone: `node src/depot/api.js gate 7 20` prints `seed 7  seconds 20 (2400 steps)  worldHash 1278094788  runHash 2033212782` on the untouched tree. Step 0 confirms it; Step 11 confirms it again unchanged. Any other number stops the task.

Sweep license: none. Any failing test other than the new era file's own asserts before Step 9 stops the task.

## Steps

### Step 0 — the keystone, before

Run `node src/depot/api.js gate 7 20`. The output must read exactly `seed 7  seconds 20 (2400 steps)  worldHash 1278094788  runHash 2033212782`. Record it.

### Step 1 — the failing era file

Create `scripts/tests/50-the-senses.mjs`:

```js
import { ok } from "./harness.mjs";
import { makeWorld, addBody } from "../../src/engine/core.js";
import { DEAD, DEAD_TEAM, MAN } from "../../src/depot/specs.js";
import { spawnDead, stepDead, gatherSounds } from "../../src/depot/dead.js";

// ==== 0.6.3: the senses =====================================================
// Seed rolled each run.
{
  console.log("\n[0.6.3: the senses]");
  const SEED = (Date.now() % 1000000) + 1;
  console.log("  fixture seed base", SEED);
  const flat = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (x, z, o) => { o.x = 0; o.y = 1; o.z = 0; return o; } };
  const man = (w, team, x, z) => { const u = addBody(w, { kind: "unit", team, mass: MAN.rifle.mass, hx: MAN.rifle.hx, hy: MAN.rifle.hy, hz: MAN.rifle.hz, x, z, y: MAN.rifle.hy + 0.02, hp: MAN.rifle.hp, friction: 0.5 }); u.maxHp = MAN.rifle.hp; return u; };
  const integrate = (w, u, dt) => { u.pos.x += u.v.x * dt; u.pos.z += u.v.z * dt; };

  // (a) gathering: this tick's shots carry 40, bursts and collapses 80, nothing else is a sound
  {
    const w = makeWorld({ field: flat, seed: SEED });
    w.events.push({ type: "muzzle", x: 1, y: 1, z: 2 }, { type: "boom", x: 3, y: 1, z: 4 }, { type: "collapse", x: 5, y: 2, z: 6 }, { type: "kill", x: 7, z: 8 }, { type: "zap", x: 9, z: 10 });
    const s = gatherSounds(w);
    ok("(a) three sounds from five events, with their reach", s.length === 3 && s[0].x === 1 && s[0].r === DEAD.soundGun && s[1].x === 3 && s[1].r === DEAD.soundBlast && s[2].x === 5 && s[2].r === DEAD.soundBlast, JSON.stringify(s));
  }

  // (b) hearing: a shot 30 m off draws one of the dead; a shot 60 m off does not; a burst 60 m off does
  {
    const w = makeWorld({ field: flat, seed: SEED }); w.depotCombat = true;
    const d = spawnDead(w, 0, 0);
    stepDead(w, 1 / 120, { squads: [], foeSquads: [], _sounds: [{ x: 60, z: 0, r: DEAD.soundGun }] });
    ok("(b) a shot 60 m off is not heard", !d._soundGoal && Math.hypot(d.v.x, d.v.z) < 1e-6);
    stepDead(w, 1 / 120, { squads: [], foeSquads: [], _sounds: [{ x: 30, z: 0, r: DEAD.soundGun }] });
    ok("(b) a shot 30 m off sets the destination and starts the walk", !!d._soundGoal && d._soundGoal.x === 30 && d.v.x > 0, d._soundGoal ? `${d._soundGoal.x}/${d.v.x.toFixed(1)}` : "-");
    const d2 = spawnDead(w, 0, 100);
    stepDead(w, 1 / 120, { squads: [], foeSquads: [], _sounds: [{ x: 60, z: 100, r: DEAD.soundBlast }] });
    ok("(b) a burst 60 m off is heard", !!d2._soundGoal && d2._soundGoal.x === 60);
  }

  // (c) arrival: the destination is reached and dropped; the dead stand
  {
    const w = makeWorld({ field: flat, seed: SEED }); w.depotCombat = true;
    const d = spawnDead(w, 0, 0);
    const run = { squads: [], foeSquads: [], _sounds: [{ x: 12, z: 0, r: DEAD.soundGun }] };
    stepDead(w, 1 / 120, run); run._sounds = [];
    let arrivedAt = null;
    for (let i = 0; i < 600 && arrivedAt == null; i++) { stepDead(w, 1 / 120, run); integrate(w, d, 1 / 120); w.t += 1 / 120; if (!d._soundGoal) arrivedAt = w.t; }
    ok("(c) 12 meters are walked inside three seconds and the destination is dropped", arrivedAt != null && arrivedAt < 3 && Math.abs(d.pos.x - 12) < 2.5, arrivedAt == null ? "never" : `${arrivedAt.toFixed(2)}s at x ${d.pos.x.toFixed(1)}`);
  }

  // (d) prey outranks sound
  {
    const w = makeWorld({ field: flat, seed: SEED }); w.depotCombat = true;
    const d = spawnDead(w, 0, 0); const m = man(w, 1, 10, 0);
    stepDead(w, 1 / 120, { squads: [], foeSquads: [], _sounds: [{ x: -30, z: 0, r: DEAD.soundGun }] });
    ok("(d) a man at 10 m is hunted and the sound is dropped", d.tgtId === m.id && !d._soundGoal && d.v.x > 0, `${d.tgtId}/${!!d._soundGoal}`);
  }

  // (e) clawing: pressed against a wall course with somewhere to go, two points a second; idle, nothing
  {
    const w = makeWorld({ field: flat, seed: SEED }); w.depotCombat = true;
    const d = spawnDead(w, 0, 0);
    const wall = addBody(w, { kind: "wall", team: 1, mass: 0, hx: 0.9, hy: 0.285, hz: 0.35, x: 1.2, y: 0.3, z: 0, hp: 70 }); wall.maxHp = 70;
    const run = { squads: [], foeSquads: [], _sounds: [{ x: 10, z: 0, r: DEAD.soundGun }] };
    for (let i = 0; i < 120; i++) { stepDead(w, 1 / 120, run); run._sounds = []; w.t += 1 / 120; d.pos.x = 0; d.pos.z = 0; }
    ok("(e) one second against the wall takes two points", Math.abs((70 - wall.hp) - 2) < 0.1, (70 - wall.hp).toFixed(2));
    const w2 = makeWorld({ field: flat, seed: SEED }); w2.depotCombat = true;
    const d2 = spawnDead(w2, 0, 0);
    const wall2 = addBody(w2, { kind: "wall", team: 1, mass: 0, hx: 0.9, hy: 0.285, hz: 0.35, x: 1.2, y: 0.3, z: 0, hp: 70 }); wall2.maxHp = 70;
    for (let i = 0; i < 120; i++) { stepDead(w2, 1 / 120, { squads: [], foeSquads: [], _sounds: [] }); w2.t += 1 / 120; }
    ok("(e) idle against the wall, nothing", wall2.hp === 70 && !d2._soundGoal, `${wall2.hp}`);
  }

  // (f) every clawable kind, and armor does not blunt it
  {
    const kinds = [
      ["a sandbag", (w) => { const b = addBody(w, { kind: "chunk", team: 1, mass: 0, hx: 0.9, hy: 0.45, hz: 0.35, x: 1.2, y: 0.45, z: 0, hp: 60 }); b.sandbag = true; b.maxHp = 60; return b; }],
      ["a tower", (w) => { const b = addBody(w, { kind: "tower", team: 1, mass: 0, hx: 0.8, hy: 1.0, hz: 0.8, x: 1.1, y: 1.0, z: 0, hp: 80 }); b.towerType = "mg"; b.maxHp = 80; return b; }],
      ["an armored hull", (w) => { const b = addBody(w, { kind: "vehicle", team: 2, mass: 3800, hx: 2.2, hy: 0.95, hz: 3.3, x: 2.5, y: 1.0, z: 0, hp: 420 }); b.armor = 160; b.vtype = "bison"; b.maxHp = 420; return b; }],
    ];
    for (const [name, mk] of kinds) {
      const w = makeWorld({ field: flat, seed: SEED }); w.depotCombat = true;
      const d = spawnDead(w, 0, 0); const b = mk(w); const hp0 = b.hp;
      const run = { squads: [], foeSquads: [], _sounds: [{ x: 20, z: 0, r: DEAD.soundGun }] };
      for (let i = 0; i < 120; i++) { stepDead(w, 1 / 120, run); run._sounds = []; w.t += 1 / 120; d.pos.x = 0; d.pos.z = 0; }
      ok(`(f) ${name} loses two points a second to the claw`, Math.abs((hp0 - b.hp) - 2) < 0.1, (hp0 - b.hp).toFixed(2));
    }
  }

  // (g) a body out of reach is not clawed
  {
    const w = makeWorld({ field: flat, seed: SEED }); w.depotCombat = true;
    const d = spawnDead(w, 0, 0);
    const wall = addBody(w, { kind: "wall", team: 1, mass: 0, hx: 0.9, hy: 0.285, hz: 0.35, x: 0, y: 0.3, z: 3, hp: 70 }); wall.maxHp = 70;
    const run = { squads: [], foeSquads: [], _sounds: [{ x: 20, z: 0, r: DEAD.soundGun }] };
    for (let i = 0; i < 60; i++) { stepDead(w, 1 / 120, run); run._sounds = []; w.t += 1 / 120; d.pos.x = 0; d.pos.z = 0; }
    ok("(g) a wall three meters to the side is untouched", wall.hp === 70, `${wall.hp}`);
  }
}
```

In `scripts/depot-test.mjs`, after `await import("./tests/49-the-people.mjs");` add:

```js
await import("./tests/50-the-senses.mjs");
```

Run `node scripts/gate.mjs depot-test`. It must fail at the new file's import (`gatherSounds` is not yet exported). Record the failure line.

### Step 2 — the senses' numbers

In `src/depot/specs.js` line 326, replace

```js
export const DEAD = { ...MAN.rifle, tag: "dead", hp: 116, speed: 6.4, sense: 24, bite: 15, biteCd: 1, turnS: 10, reachPad: 0.35 };
```

with

```js
export const DEAD = { ...MAN.rifle, tag: "dead", hp: 116, speed: 6.4, sense: 24, bite: 15, biteCd: 1, turnS: 10, reachPad: 0.35,
  soundGun: 40, soundBlast: 80, arriveM: 1.5, claw: 2, clawPad: 0.3 }; // 0.6.3: the senses — a shot carries 40 m, a burst or a collapse 80; the claw takes two points a second
```

### Step 3 — the dead hear and claw

In `src/depot/dead.js`, after the `prey` line

```js
const prey = (b) => b.kind === "unit" && b.alive && b.team !== DEAD_TEAM && !b.riding && !b.pinned;
```

add:

```js

// 0.6.3: THE SOUNDS — this tick's shots, bursts, and collapses as points
// with a reach. stepDepot gathers them at the end of its tick into
// run._sounds; the dead read them on the next. Never saved (a one-tick
// echo); zero draws.
export function gatherSounds(world) {
  const out = [];
  for (const e of world.events) {
    if (e.type === "muzzle") out.push({ x: e.x, z: e.z, r: DEAD.soundGun });
    else if (e.type === "boom" || e.type === "collapse") out.push({ x: e.x, z: e.z, r: DEAD.soundBlast });
  }
  return out;
}

// clawable: what the dead wear down when it stands in their way — wall
// courses, sandbags, towers, hulls, the mech's hull.
const clawable = (b) => b.alive && (b.kind === "wall" || b.kind === "tower" || b.kind === "vehicle" || b.kind === "mech" || (b.kind === "chunk" && b.sandbag));

// pressedAgainst: the body's box, grown by the dead's own half-width and
// the pad, holds the dead's feet.
function pressedAgainst(u, b) {
  return Math.abs(u.pos.x - b.pos.x) <= b.hx + u.hx + DEAD.clawPad && Math.abs(u.pos.z - b.pos.z) <= b.hz + u.hx + DEAD.clawPad;
}

// THE CLAW: with somewhere to go, every tick pressed against a clawable
// body takes DEAD.claw points a second off it. Cause BLAST so the hull's
// armor law does not blunt it (two points a second, armor or not);
// attacker "dead" pays and scores nobody. The pressed body is re-found on
// a quarter-second cadence and re-checked every tick.
function stepClaw(world, u, dt) {
  u._clawCd = (u._clawCd || 0) - dt;
  let b = u._clawId ? world.byId.get(u._clawId) : null;
  if (b && (!clawable(b) || !pressedAgainst(u, b))) b = null;
  if (!b && u._clawCd <= 0) {
    u._clawCd = 0.25;
    const pool = world.bodies;
    for (const c of pool) { if (clawable(c) && pressedAgainst(u, c)) { b = c; break; } }
  }
  u._clawId = b ? b.id : null;
  if (b) applyDamage(world, b, DEAD.claw * dt, { cause: "BLAST", attacker: "dead", srcId: u.id, srcX: u.pos.x, srcZ: u.pos.z });
}
```

Then replace the whole of `stepDead` (from `export function stepDead(world, dt, run = null) {` through its closing `}` and the blank line before `// stepSick`) with:

```js
export function stepDead(world, dt, run = null) {
  const R2 = DEAD.sense * DEAD.sense, keep2 = R2 * 1.5625;
  const sounds = run && run._sounds ? run._sounds : null;
  for (const u of world.bodies) {
    if (u.kind !== "unit" || u.team !== DEAD_TEAM || !u.alive) continue;
    u._biteCd = (u._biteCd || 0) - dt;
    // 0.6.2: THE HOLD — one of the dead sealed in a hull bites every rider
    // with it on the bite cadence: the ferry's loose riders by their seat,
    // a squad's riders by its roster. It never walks; the hull drives on.
    if (u.rideApc != null) {
      if (u._biteCd > 0) continue;
      u._biteCd = DEAD.biteCd;
      for (const b of world.bodies) if (b.kind === "unit" && b.alive && b.team !== DEAD_TEAM && b.riding && b.rideApc === u.rideApc) biteBody(world, u, b);
      if (run) for (const sq of [...(run.squads || []), ...(run.foeSquads || [])]) {
        if (sq.ridingIn !== u.rideApc) continue;
        for (const id of sq.memberIds) { const b = world.byId.get(id); if (b && b.alive && b.team !== DEAD_TEAM && b.riding) biteBody(world, u, b); }
      }
      continue;
    }
    u.scanCd = (u.scanCd || 0) - dt;
    let tgt = u.tgtId ? world.byId.get(u.tgtId) : null;
    if (tgt) { const dx = tgt.pos.x - u.pos.x, dz = tgt.pos.z - u.pos.z; if (!prey(tgt) || dx * dx + dz * dz > keep2) tgt = null; }
    if (!tgt && u.scanCd <= 0) {
      u.scanCd = 0.2 + (u.seq % 8) * 0.012;
      let bd = R2;
      for (const b of world.bodies) {
        if (!prey(b)) continue;
        const dx = b.pos.x - u.pos.x, dz = b.pos.z - u.pos.z, d2 = dx * dx + dz * dz;
        if (d2 < bd) { bd = d2; tgt = b; }
      }
    }
    u.tgtId = tgt ? tgt.id : null;
    // 0.6.3: THE SOUNDS — with nothing living in reach, the nearest sound of
    // the last tick inside its own reach becomes the destination; a nearer
    // one later replaces it; arrival drops it. Prey always outranks it.
    if (tgt) u._soundGoal = null;
    else if (sounds && sounds.length) {
      let best = null, bd = Infinity;
      for (const s of sounds) {
        const dx = s.x - u.pos.x, dz = s.z - u.pos.z, d2 = dx * dx + dz * dz;
        if (d2 <= s.r * s.r && d2 < bd) { bd = d2; best = s; }
      }
      if (best && (!u._soundGoal || bd < (u._soundGoal.x - u.pos.x) ** 2 + (u._soundGoal.z - u.pos.z) ** 2)) u._soundGoal = { x: best.x, z: best.z };
    }
    if (!tgt && u._soundGoal && Math.hypot(u._soundGoal.x - u.pos.x, u._soundGoal.z - u.pos.z) <= DEAD.arriveM) u._soundGoal = null;
    if (!tgt && !u._soundGoal) { u._clawId = null; u.v.x *= 1 - Math.min(1, 6 * dt); u.v.z *= 1 - Math.min(1, 6 * dt); continue; }
    // somewhere to go: the claw works on whatever the body is pressed against
    stepClaw(world, u, dt);
    if (!tgt) {
      u.goal = { x: u._soundGoal.x, z: u._soundGoal.z };
      seekGoal(world, u, dt, DEAD.speed);
      faceTravel(u, dt);
      continue;
    }
    const dx = tgt.pos.x - u.pos.x, dz = tgt.pos.z - u.pos.z, d = Math.hypot(dx, dz);
    const reach = u.hx + tgt.hx + DEAD.reachPad;
    if (d <= reach) {
      u.v.x *= 1 - Math.min(1, 8 * dt); u.v.z *= 1 - Math.min(1, 8 * dt);
      if (u._biteCd <= 0) { u._biteCd = DEAD.biteCd; biteBody(world, u, tgt); }
      continue;
    }
    u.goal = { x: tgt.pos.x, z: tgt.pos.z };
    seekGoal(world, u, dt, DEAD.speed);
    faceTravel(u, dt);
  }
}

```

`_soundGoal` is a flat object of numbers and rides the save through the generic sweep; `_clawId` is a body id and is not stable across a save, but it re-finds itself on the next quarter-second.

### Step 4 — the sim gathers the sounds

In `src/depot/sim.js` line 23, replace

```js
import { stepDead, stepSick } from "./dead.js";
```

with

```js
import { stepDead, stepSick, gatherSounds } from "./dead.js";
```

Line 737, replace

```js
  if (town) stepTown(world, grid, town, onRuin);
```

with

```js
  if (town) stepTown(world, grid, town, onRuin);
  // 0.6.3: THE SOUNDS — this tick's shots, bursts, and collapses, gathered
  // after everything that makes them (the guns above, the blasts in
  // stepWorld, the collapses just now); the dead read them next tick.
  if (run && run.outbreak) run._sounds = gatherSounds(world);
```

### Step 5 — the convoy: a plan no longer arms the bar

In `src/depot/DepotGame.jsx` lines 763–764, replace

```js
        // THE PICK ARMS THE BAR — every key; hero keys are placement modes under the one law now.
        setMode(key);
```

with

```js
        // 0.6.3: a bought plan opens the bar and nothing more — the hand
        // stays up for the next card; a HIRE is what goes on to placement.
```

Phone and desktop: no layout change; the hand's window stays where it was after a plan is bought.

### Step 6 — the mark

In `src/version.js`, replace `export const MK = "0.6.2";` with `export const MK = "0.6.3";`.

### Step 7 — the gates

Run, in this order, and record each result line:

1. `node scripts/gate.mjs depot-lint` — `depot-lint PASS`.
2. `node scripts/gate.mjs depot-test` — ends `depot-test PASS`; the new era's 12 asserts all PASS; the total is 1665 + 12 = 1677 PASS / 0 FAIL; the report states the numbers and the era's fixture seed.
3. `npm run build`, then `npm run preview &`, then `node scripts/gate.mjs smoke` — `BOOT-LOAD SMOKE: ALL PASS`, 27 PASS lines. Stop the preview server after.

### Step 8 — the outbreak's own headless run

Run `node src/depot/api.js gate 7 20 outbreak`. It must print a line ending in `  dead N` and must not throw. Record the line.

### Step 9 — the keystone, after

Run `node src/depot/api.js gate 7 20`. The output must read exactly `seed 7  seconds 20 (2400 steps)  worldHash 1278094788  runHash 2033212782`. Any other number stops the task before the commit; report it.

### Step 10 — the landing

Commit exactly these files in one commit: `src/depot/specs.js`, `src/depot/dead.js`, `src/depot/sim.js`, `src/depot/DepotGame.jsx`, `src/version.js`, `scripts/depot-test.mjs`, `scripts/tests/50-the-senses.mjs`, and this plan file. Subject: `the senses, 0.6.3`. Push to `main`.

Then in `docs/superpowers/plans/2026-10-11-coldsnap-the-outbreak-phase.md`: in the design paragraph, replace the sentence `One of the dead pressed against a wall course, a sandbag, a hull, or the mech takes two points a second off it.` with `One of the dead pressed against a wall course, a sandbag, a tower, a hull, or the mech while it has somewhere to go takes two points a second off it, armor or not. A heard sound becomes a destination: the dead walk to it and stand there. Buying a plan off the convoy's hand no longer arms the build bar; a hire goes on to placement.` and replace the T3 row

```
| T3 | 0.6.3 | The senses: gunfire and blasts draw the dead; the clawing at wall courses, sandbags, hulls, and the mech | PLANNED |
```

with

```
| T3 | 0.6.3 | The senses: shots at 40 m and bursts and collapses at 80 m draw the dead to the spot; the clawing at wall courses, sandbags, towers, hulls, and the mech, armor or not; a bought plan no longer arms the bar | LANDED — mark 0.6.3, keystone unchanged (seed 7, 20 s: 1278094788 / 2033212782), depot-test 1677, smoke 27/27 |
```

Commit that file alone with the subject `t3 lands in the phase document — 0.6.3, the senses, 27/27`. Push.

### Step 11 — the keystone, confirmed on the pushed tree

Run `node src/depot/api.js gate 7 20` once more and record the line; it must still match Step 0.

## Acceptance

- Step 0, Step 9, and Step 11 print the identical line.
- `depot-test` 1677 PASS / 0 FAIL on a rolled seed; `depot-lint` PASS; smoke 27/27.
- The outbreak gate runs to the end.
- The live site: a volley from your men pulls the dead within 40 meters toward the shooters and a shell burst pulls them from 80; the dead crowd a wall or a parked hull on the way to someone and wear it down; buying a plan from the hand leaves the hand up and arms nothing; a hire still goes to the ground tap. The owner's eyes are the acceptance.

## Report

One line of outcome, then: every gate's result line; the three keystone lines; the depot-test totals; the era's fixture seed; the outbreak gate's line; the commit hashes; every deviation, nonconformity, and re-pin as its own labeled bullet.
