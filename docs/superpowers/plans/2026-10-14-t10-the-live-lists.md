# T10 — The live lists (0.6.10)

One line. The quiet floor measured in T9 (11.4 ms a step in the empty sandbox, 14.5 in the quiet war) is mostly walking: every step the engine visits all 5,800 bodies in ten passes and all 9,800 joints in six passes, to skip nearly all of them. This task gives those passes short lists to walk instead — the awake bodies, the bodies a pass reads by kind, and the joints with an awake end — rebuilt once a step and again whenever a stone wakes, so each pass skips exactly what it always skipped and the game's trajectory stays identical to the bit. Then the bench of T9 is run again on the same seed, so the twin's numbers land beside the base's on the same page.

Checked on a fresh copy at plan-writing time: every file parses; `golden` ALL PASS; the keystone unchanged; `depot-lint` PASS; `depot-test` 1722 PASS / 0 FAIL (T9's 1714 plus the eight new asserts); smoke 27/27; the headless bench on T9's seed 121051 prints T9's world hashes, run hashes, draw counts, awake peaks and contact peaks to the bit in all three worlds, with the quiet step at 4.8 ms in the sandbox town (from 11.3–12.0), 4.7 on the wall-ringed town (from 11.4) and 8.2 in the hot war (from 14.2–14.8), the step after the bang at 101 ms (from 118), the after-window mean at 19.1 ms (from 24.7–25.2); the browser before the burst at 40.6 frames a second with the world at 0.88 in the sandbox (from 20.4 at 0.70) and 35.3 at 1.01 in the quiet war (from 16.0 at 0.80); the page's verdict `same world in every copy — 24 runs over 6 worlds` with the twin's runs inside T9's groups; the page check OK.

Suggested model: Sonnet 5.5 — every edit is an exact text replacement given here; the test and the run list are files given whole; the runs are commands; the report is the numbers they print.

## Required reading, in this order

1. `CLAUDE.md`
2. This file, whole, before the first edit.
3. `src/engine/core.js` lines 158–204 (bodies, `wake`, the broadphase books), 1469–1611 (`collectContacts`), 1781–1817 (`weldStressDecay`, `weldBreakPass`), 1897–2131 (`stepStatus`, `stepSleep`, `stepWorld`): the code this task changes.
4. `docs/superpowers/plans/2026-10-13-t9-the-quiet-floor.md` — the sections "The seed law" and "Gates", and Step 9 (the runs and how they are read).
5. `docs/superpowers/perf/davy/all.sh` (the run list this task replaces).

The report opens with a line confirming every file above was read.

## The design, plainly

The engine's step walks `world.bodies` and `world.welds` in these places, and nearly every visit ends in a skip once the valley is asleep:

| pass | what it skips | the list it walks after this task |
|---|---|---|
| `stepDrive` (1058) | every body that is not a living vehicle | `_vehicles` |
| `stepSuspension` (1008) | every body without springs, and sleeping ones | `_awake` |
| `stepUnits` (1099) | every body that is not a living unit | `_units` |
| the velocity loop (2090) | sleeping bodies, after writing `vy0` | `_awake` |
| the filing walk (1484) | sleeping and static bodies already on the books | `_file` |
| the terrain pass (1602) | sleeping and static bodies | `_awake` |
| the position loop (2120) | sleeping and static bodies | `_awake` |
| `stepStatus`: the burning-tree loop (1904), the vehicle loop (1911), the body loop (1947), the corpse walk (2031) | by kind; the body loop skips nothing massive | `_trees`, `_vehicles`, `_status` plus `_sleepInert`, `_units` |
| `stepSleep`'s body loop (2049) | sleeping and static bodies | `_awake` |
| `weldStressDecay` (1781), the solver's active list (2108), `weldBreakPass` twice (2116, 2127), the wake front (1934), the partner wake (2065) | broken joints, and joints between two sleeping stones | `_liveWelds` |

**The joints.** The live list holds every intact joint with an awake end, plus every ice joint, in `world.welds` order. A joint between two sleeping stones that is not ice carries exactly zero accumulated force at every break pass: the solver loads only the active joints (both-asleep joints are never active), a blast loads a stone's joints only after it has woken the stone, and each break pass zeroes what it read. So on such a joint the break pass computes a force of zero, changes nothing, breaks nothing; the wake front and the partner wake act only on joints with exactly one sleeping end; the stress decay zeroes a stress that is already zero. Ice joints stay in the list asleep because their creep clock and their grind mark tick while both plates sleep. The list is rebuilt once per step, at the solver's active-list build, and again before any joint pass that runs after a stone woke mid-step. The decay at the top of the step walks the previous step's list, which still holds every joint a break pass could have loaded since the last decay.

**The bodies.** One scan of `world.bodies` per step builds seven lists in body order. `_awake` (massive and not sleeping) serves the loops that already skip sleeping and static bodies: their work on a sleeping body is nothing, so a list that omits sleeping bodies changes nothing, and body order keeps the contact order and the event order. `_file` holds what the filing walk visits: every body not already on the books asleep. `_units`, `_vehicles`, `_trees` serve the passes that read one kind; each keeps its full predicate (alive, kind) inside the loop, so a vehicle that died this step is skipped exactly as before. The status pass's body loop is the one pass that writes to sleeping bodies every step (a sleeping stone's ground clock keeps counting; a settled stone's falling mark is cleared one step after it sleeps; a buried or drowning man dies asleep), so it is split instead of shortened: `_status` holds every massive body except the sleeping chunks and trees and runs the loop verbatim, and `_sleepInert` runs the two lines of that loop that can touch a sleeping chunk or tree (neither is ever the player's hull, a unit, a vehicle, or ice). The corpse walk runs over `_units` from the end, which is the same descending order.

**When a list is stale.** A list carries the step it was built in (`world.t`) and the value of a counter, `WAKES`, that moves on every sleeping→awake transition (inside `wake`, and at the partner wake). Each pass asks for its list first; a list built in another step, or before a wake, is rebuilt. Sleep transitions happen only at the end of the step (`stepSleep`), additions and removals by the game only between steps, and the engine's own corpse removal marks the lists stale by hand. A quiet step therefore scans once; a collapse step rescans after each pass that woke something, which is never more than the full walks it replaces.

**What is identical.** Every body's position, velocity, pose, flags and clocks, every joint's force, stress, clock and break, every event and every random draw. `golden` proves it on the demo's world, the keystone on the war's, the bench's identity check on T9's seed over 25 seconds with a bang.

**The three stated deltas, all in fields nothing reads.** (1) A broken joint keeps its last stress reading instead of being zeroed the step after it broke; the renderer reads stress on intact ice joints only, and the engine reads it nowhere. (2) A sleeping chunk's or tree's `vy0` is no longer refreshed each step; `classifyImpacts` reads `vy0` only for a unit or vehicle meeting the ground. (3) A sleeping unit's, vehicle's or ice plate's `vy0` is refreshed in the status pass instead of the velocity loop, thirty lines later in the same step; a sleeping body meets no ground, and a body woken by contact in that same step and landing in it reads the value from the step it fell asleep, which differs from zero by less than 0.25 m/s against a threshold of 6.5 (sleeping ice in water reads one step behind; ice's `vy0` is never read).

## The seed law

Every bench run rolls its seed at startup and prints it first. No seed is written into any script. A rerun passes the drawn seed back on the command line; this task's runs pass back T9's drawn seed, 121051, so the twin's records land in the base's groups on the page and the page's identity check compares them. Every run appends one line to `.superpowers/experiments.log`.

## Gates

Run only these, each through `node scripts/gate.mjs <name>`: `depot-lint`, `golden`, `depot-test`, `smoke`. The smoke needs `npm run build` then `npm run preview &` first. `golden` runs because the engine is touched.

The keystone: `node src/depot/api.js gate 7 20` prints `seed 7  seconds 20 (2400 steps)  worldHash 1278094788  runHash 2033212782` on the untouched tree. Step 0 confirms it; Step 14 and Step 19 confirm it again unchanged. Any other number stops the task.

The new test's asserts are the only test change. Any other failing test stops the task.

## Steps

### Step 0 — the keystone, before

Run `node src/depot/api.js gate 7 20`. The output must read exactly `seed 7  seconds 20 (2400 steps)  worldHash 1278094788  runHash 2033212782`. Record it.

### Step 1 — the test, written first

Create `scripts/tests/55-the-live-lists.mjs` with exactly this:

```js
import { ok } from "./harness.mjs";
import { bootWar } from "../../src/depot/boot.js";
import { tickWar, defaultTickInput } from "../../src/depot/api.js";
import { stepWorld, __lists__, __mech__ } from "../../src/engine/core.js";
import { fireDavyDown } from "../../src/depot/witness.js";

// ==== 0.6.10: the live lists ===============================================
// Seed rolled each run. The engine's step walks short lists instead of every
// body and every weld. A rebuild must produce exactly what the full walks
// would visit, in world order; the lists must rebuild when a body wakes and
// stay put when nothing has.
{
  console.log("\n[0.6.10: the live lists]");
  const SEED = (Date.now() % 1000000) + 1;
  console.log("  fixture seed base", SEED);
  const STEP = 1 / 120;
  const war = bootWar({ seed: SEED, dev: true });
  war.run.started = true;
  const input = defaultTickInput();
  for (let i = 0; i < 120; i++) tickWar(war, STEP, input);
  const world = war.world;
  const rebuild = () => { world._blT = -1; world._lwT = -1; __lists__.bodyLists(world); __lists__.liveWelds(world); };
  const equal = (list, want) => {
    if (!list || list.length !== want.length) return false;
    for (let i = 0; i < want.length; i++) if (list[i] !== want[i]) return false;
    return true;
  };
  const massive = (b) => b.invM !== 0;
  const weldsExact = () => equal(world._liveWelds, world.welds.filter((w) => !w.broken && ((w.a.kind === "ice" || w.b.kind === "ice") || !(w.a.sleeping && w.b.sleeping))));
  const bodiesExact = () => equal(world._awake, world.bodies.filter((b) => massive(b) && !b.sleeping))
    && equal(world._file, world.bodies.filter((b) => !((b.sleeping || b.invM === 0) && b._filed)))
    && equal(world._status, world.bodies.filter((b) => massive(b) && !(b.sleeping && (b.kind === "chunk" || b.kind === "tree"))))
    && equal(world._sleepInert, world.bodies.filter((b) => massive(b) && b.sleeping && (b.kind === "chunk" || b.kind === "tree")))
    && equal(world._units, world.bodies.filter((b) => b.kind === "unit"))
    && equal(world._vehicles, world.bodies.filter((b) => b.kind === "vehicle"))
    && equal(world._trees, world.bodies.filter((b) => b.kind === "tree"));
  const n0 = world.bodies.length, w0 = world.welds.length;
  stepWorld(world); rebuild();
  ok("(a) a settled town: a rebuild's live joints are exactly the intact welds with an awake end or ice, in order", weldsExact(), `${world._liveWelds ? world._liveWelds.length : "none"} of ${w0}`);
  ok("(b) a rebuild's body lists are exactly the full walks' visits, in order (the sleeping chunks and trees on their own list)", bodiesExact(), `${world._awake ? world._awake.length : "none"} awake, ${world._status ? world._status.length : "none"} + ${world._sleepInert ? world._sleepInert.length : "none"} of ${n0}, trees ${world._trees ? world._trees.length : "none"}`);
  ok("(c) a quiet step's lists are short against the counts", world._awake && world._awake.length * 4 < n0 && world._liveWelds.length * 4 < w0, `${world._awake ? world._awake.length : "none"} awake of ${n0}, ${world._liveWelds ? world._liveWelds.length : "none"} live of ${w0}`);
  // the stamp: nothing woke, nothing rebuilds; one stone woken by hand, both lists take it in
  const awakeBefore = world._awake.length, liveBefore = world._liveWelds.length, wakesBefore = __lists__.wakes();
  __lists__.bodyLists(world); __lists__.liveWelds(world);
  ok("(d) with no wake the lists stay as they are", world._awake.length === awakeBefore && world._liveWelds.length === liveBefore && __lists__.wakes() === wakesBefore, `${awakeBefore} awake, ${liveBefore} live, counter ${wakesBefore}`);
  const stone = world.bodies.find((b) => b.kind === "chunk" && b.sleeping && (world.weldsOf.get(b.id) || []).some((w) => !w.broken));
  __mech__.wake(stone);
  __lists__.bodyLists(world); __lists__.liveWelds(world);
  const stoneWelds = world.weldsOf.get(stone.id).filter((w) => !w.broken);
  ok("(e) one stone woken by hand moves the counter and enters both lists", __lists__.wakes() === wakesBefore + 1 && world._awake.includes(stone) && !world._sleepInert.includes(stone) && world._status.includes(stone) && stoneWelds.every((w) => world._liveWelds.includes(w)) && bodiesExact() && weldsExact(), `counter ${__lists__.wakes()}, ${stoneWelds.length} joints`);
  // the burst: stones wake mid-step, joints load and break
  const t = war.town.reduce((best, b) => (!b.ruined && (!best || b.stones.length > best.stones.length) ? b : best), null);
  fireDavyDown(world, war.field, t.x, t.z);
  let boomStep = -1;
  for (let i = 0; i < 10 && boomStep < 0; i++) { const n = world.events.length; stepWorld(world); for (let k = n; k < world.events.length; k++) if (world.events[k].type === "boom") boomStep = i; }
  ok("(f) the burst lands within ten steps", boomStep >= 0, `step ${boomStep}`);
  rebuild();
  ok("(g) after the burst step a rebuild is exact with hundreds awake", world._awake.length > 100 && bodiesExact() && weldsExact(), `${world._awake.length} awake, ${world._liveWelds.length} live joints`);
  for (let i = 0; i < 10; i++) stepWorld(world);
  rebuild();
  ok("(h) ten steps on, a rebuild is exact", bodiesExact() && weldsExact(), `${world._awake.length} awake, ${world._liveWelds.length} live joints`);
}
```

In `scripts/depot-test.mjs`, after the line `await import("./tests/54-the-davy-bench.mjs");` add the line `await import("./tests/55-the-live-lists.mjs");`.

Run `node scripts/tests/55-the-live-lists.mjs`. On the unchanged tree it must fail to load: `SyntaxError: The requested module '../../src/engine/core.js' does not provide an export named '__lists__'`. Record that line.

### Step 2 — the wake counter and the body lists

In `src/engine/core.js` at lines 188–189, replace exactly this:

```js
function bodySpeed2(b) { return V.len2(b.v); }
function wake(b) { if (b.sleeping) { b.sleeping = false; } b.sleepT = 0; }
```

with exactly this:

```js
function bodySpeed2(b) { return V.len2(b.v); }
// T10 (mk0.6.10): THE LIVE LISTS. Every pass that walked all bodies to skip
// the sleeping ones, and every pass that walked all welds to skip the ones
// between sleeping stones, walks a short list instead — rebuilt once per step
// and again whenever a body wakes mid-step. WAKES moves on every
// sleeping→awake transition; a list whose stamp is behind it rebuilds before
// it is read. Each loop keeps its own full predicate, so it skips exactly what
// it always skipped, in the order it always ran; golden and the keystone prove
// the trajectory byte-identical.
let WAKES = 0;
function wake(b) { if (b.sleeping) { b.sleeping = false; WAKES++; } b.sleepT = 0; }
// the body lists, all in world.bodies order:
//   _awake        massive and awake — the integrators, the terrain pass, the suspension, the sleep pass
//   _file         what the broadphase's filing walk visits: every body not already on the books asleep
//   _status       the status pass: every massive body except the sleeping chunks and trees
//   _sleepInert   the sleeping chunks and trees, for the status pass's own two lines that touch them
//   _units, _vehicles, _trees   by kind, for the passes that read one kind
function bodyLists(world) {
  if (world._blT === world.t && world._blW === WAKES) return;
  world._blT = world.t; world._blW = WAKES;
  const awake = world._awake || (world._awake = []), file = world._file || (world._file = []);
  const status = world._status || (world._status = []), sleepInert = world._sleepInert || (world._sleepInert = []);
  const units = world._units || (world._units = []), vehicles = world._vehicles || (world._vehicles = []), trees = world._trees || (world._trees = []);
  awake.length = 0; file.length = 0; status.length = 0; sleepInert.length = 0; units.length = 0; vehicles.length = 0; trees.length = 0;
  for (const b of world.bodies) {
    const k = b.kind;
    if (k === "unit") units.push(b); else if (k === "vehicle") vehicles.push(b); else if (k === "tree") trees.push(b);
    if (b.invM === 0) { if (!b._filed) file.push(b); continue; }
    if (b.sleeping) { if (!b._filed) file.push(b); if (k === "chunk" || k === "tree") sleepInert.push(b); else status.push(b); }
    else { awake.push(b); file.push(b); status.push(b); }
  }
}
```

### Step 3 — the joint remembers whether it is ice

At line 415 (inside `addWeld`), replace exactly this:

```js
  const w = { a, b, rA, rB, breakF, broken: false, stress: 0, acc: [0, 0, 0], born: world.t };
```

with exactly this:

```js
  const w = { a, b, rA, rB, breakF, broken: false, stress: 0, acc: [0, 0, 0], born: world.t, ice: a.kind === "ice" || b.kind === "ice" };
```

Every joint is made here: the war's masonry, the saves' restore (`restoreWelds` in `src/depot/save.js` calls `addWeld`), the pool's ice, the mech's head. Ice is the only kind that never changes.

### Step 4 — the live joints and the decay over them

At line 1781, replace exactly this:

```js
export function weldStressDecay(world) {
  for (const w of world.welds) w.stress = 0;
}
```

with exactly this:

```js
// T10 (mk0.6.10): the live joints — every intact weld with an awake end, plus
// every ice weld (its creep clock and grind mark tick while both plates
// sleep), in world.welds order. A weld between two sleeping stones with no
// ice carries exactly zero accumulated force at every break pass: the solver
// loads only active welds, and a blast loads a stone's welds only after it
// has woken the stone. So every pass below is a no-op on it. Rebuilt once per
// step (world.t) and again after any mid-step wake (WAKES).
function liveWelds(world) {
  if (world._lwT !== world.t || world._lwW !== WAKES) {
    world._lwT = world.t; world._lwW = WAKES;
    const live = world._liveWelds || (world._liveWelds = []);
    live.length = 0;
    for (const wd of world.welds) if (!wd.broken && (wd.ice || !(wd.a.sleeping && wd.b.sleeping))) live.push(wd);
  }
  return world._liveWelds;
}
export function weldStressDecay(world) {
  // the previous step's list still holds every weld a break pass loaded since
  // the last decay; an intact weld outside it already reads zero, and a
  // broken one keeps its last reading, which nothing reads
  for (const w of world._liveWelds || world.welds) w.stress = 0;
}
```

### Step 5 — the break pass

At line 1784, replace exactly this:

```js
function weldBreakPass(world) {
  const dt = world.dt;
  for (const w of world.welds) {
    if (w.broken) continue;
```

with exactly this:

```js
function weldBreakPass(world) {
  const dt = world.dt;
  for (const w of liveWelds(world)) {
    if (w.broken) continue;
```

### Step 6 — the drive, the suspension, the units

At line 1058, replace exactly this:

```js
function stepDrive(world) {
  for (const b of world.bodies) {
    if (b.kind !== "vehicle" || !b.alive) continue;
```

with exactly this:

```js
function stepDrive(world) {
  bodyLists(world);
  for (const b of world._vehicles) {
    if (b.kind !== "vehicle" || !b.alive) continue;
```

At line 1008, replace exactly this:

```js
function stepSuspension(world) {
  const dt = world.dt;
  for (const b of world.bodies) {
    const s = b.susp;
```

with exactly this:

```js
function stepSuspension(world) {
  const dt = world.dt;
  bodyLists(world);
  for (const b of world._awake) {
    const s = b.susp;
```

At line 1102, replace exactly this:

```js
  const sc = world.scare, th = world.threat;
  for (const u of world.bodies) {
    if (u.kind !== "unit" || !u.alive) continue;
```

with exactly this:

```js
  const sc = world.scare, th = world.threat;
  bodyLists(world);
  for (const u of world._units) {
    if (u.kind !== "unit" || !u.alive) continue;
```

`stepUnits` is exported; its only caller in the tree is `stepWorld` (the war's own `stepUnits` is a different function in `src/depot/units.js`).

### Step 7 — the broadphase's filing walk and terrain pass

At line 1473 (inside `collectContacts`), replace exactly this:

```js
  const bodies = world.bodies, contacts = world.contacts;
  contacts.length = 0;
```

with exactly this:

```js
  const contacts = world.contacts;
  contacts.length = 0;
```

At line 1483, replace exactly this:

```js
  const grid = world._bp, epoch = ++world._bpEpoch;
  for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i];
    if (b.pinned) continue;
```

with exactly this:

```js
  const grid = world._bp, epoch = ++world._bpEpoch;
  bodyLists(world);
  const walk = world._file;
  for (let i = 0; i < walk.length; i++) {
    const b = walk[i];
    if (b.pinned) continue;
```

At line 1601, replace exactly this:

```js
  // terrain
  for (const b of bodies) {
    if (b.invM === 0 || b.sleeping) continue;
```

with exactly this:

```js
  // terrain
  bodyLists(world);
  for (const b of world._awake) {
    if (b.invM === 0 || b.sleeping) continue;
```

The second `bodyLists` call is not redundant: the pair walk between them wakes stones by contact, and a stone woken there takes terrain contacts in the same step.

### Step 8 — the status pass

At line 1903 (inside `stepStatus`), replace exactly this:

```js
  if (world.depotCombat) {
    for (const b of world.bodies) {
      if (b.kind !== "tree" || !b.alive || b.burning == null) continue;
```

with exactly this:

```js
  bodyLists(world);
  if (world.depotCombat) {
    for (const b of world._trees) {
      if (b.kind !== "tree" || !b.alive || b.burning == null) continue;
```

At line 1911, replace exactly this:

```js
  for (const b of world.bodies) if (b.kind === "vehicle") b.onBody = false;
```

with exactly this:

```js
  for (const b of world._vehicles) if (b.kind === "vehicle") b.onBody = false;
```

At line 1933, replace exactly this:

```js
  // and a severed sleeper wakes before a falling partner could hang on it.
  for (const wd of world.welds) {
    if (wd.broken) continue;
    const asl = wd.a.sleeping, bsl = wd.b.sleeping;
```

with exactly this:

```js
  // and a severed sleeper wakes before a falling partner could hang on it.
  for (const wd of liveWelds(world)) {
    if (wd.broken) continue;
    const asl = wd.a.sleeping, bsl = wd.b.sleeping;
```

At line 1945, replace exactly this:

```js
    if (live.kind === "chunk" && (live.v.x * live.v.x + live.v.y * live.v.y + live.v.z * live.v.z) > 0.09) wake(dead);
  }
  for (const b of world.bodies) {
    if (b.invM === 0) continue;
```

with exactly this:

```js
    if (live.kind === "chunk" && (live.v.x * live.v.x + live.v.y * live.v.y + live.v.z * live.v.z) > 0.09) wake(dead);
  }
  bodyLists(world);
  for (const b of world._status) {
    if (b.invM === 0) continue;
```

At line 2027, replace exactly this:

```js
    // chunks settle
    if (b.kind === "chunk" && b.fallingSince > 0 && b.sleeping) b.fallingSince = -1;
  }
  // remove stale corpses
  for (let i = world.bodies.length - 1; i >= 0; i--) {
    const b = world.bodies[i];
    if (b.kind === "unit" && !b.alive && world.t - (b.deadT || 0) > 4) {
```

with exactly this:

```js
    // chunks settle
    if (b.kind === "chunk" && b.fallingSince > 0 && b.sleeping) b.fallingSince = -1;
    if (b.sleeping) b.vy0 = b.v.y; // the velocity loop refreshes vy0 on the awake only; a sleeper's is refreshed here (classifyImpacts reads it for a body meeting the ground, never a sleeper)
  }
  // the sleeping chunks' and trees' share of the pass above: of its branches
  // only the ground clock and the settle line touch them (neither is ever the
  // player's hull, a unit, a vehicle, or ice; their vy0 is never read)
  for (const b of world._sleepInert) {
    if (b.groundedNow || b.bodyGroundedNow || b._suspGround) { b.airT = 0; b.grounded = true; } else { b.airT += dt; b.grounded = false; }
    b.bodyGroundedLast = b.bodyGroundedNow;
    b.bodyGroundedNow = false;
    if (b.kind === "chunk" && b.fallingSince > 0 && b.sleeping) b.fallingSince = -1;
  }
  // remove stale corpses
  const units = world._units;
  for (let k = units.length - 1; k >= 0; k--) {
    const b = units[k];
    if (b.kind === "unit" && !b.alive && world.t - (b.deadT || 0) > 4) {
```

At line 2042, replace exactly this:

```js
      unfileBody(world, b); // T6: the engine's own removals leave the books clean
      world.byId.delete(b.id); world.bodies.splice(i, 1);
    }
  }
}
```

with exactly this:

```js
      unfileBody(world, b); // T6: the engine's own removals leave the books clean
      world.byId.delete(b.id); world.bodies.splice(world.bodies.indexOf(b), 1);
      world._blT = -1; // a body left the array: the lists rebuild before their next read
    }
  }
}
```

### Step 9 — the sleep pass

At line 2047, replace exactly this:

```js
function stepSleep(world) {
  const dt = world.dt;
  for (const b of world.bodies) {
    if (b.invM === 0 || b.sleeping) continue;
```

with exactly this:

```js
function stepSleep(world) {
  const dt = world.dt;
  bodyLists(world);
  for (const b of world._awake) {
    if (b.invM === 0 || b.sleeping) continue;
```

At line 2065, replace exactly this:

```js
  for (const wd of world.welds) {
    if (wd.broken) continue;
    if (wd.a.sleeping !== wd.b.sleeping) {
```

with exactly this:

```js
  for (const wd of liveWelds(world)) {
    if (wd.broken) continue;
    if (wd.a.sleeping !== wd.b.sleeping) {
```

At line 2074, replace exactly this:

```js
        const s = wd.a.sleeping ? wd.a : wd.b;
        s.sleeping = false; s.sleepT = 0;
```

with exactly this:

```js
        const s = wd.a.sleeping ? wd.a : wd.b;
        s.sleeping = false; s.sleepT = 0; WAKES++;
```

### Step 10 — the step

At line 2090, replace exactly this:

```js
  // integrate velocities + refresh frames
  for (const b of world.bodies) {
    if (b.invM === 0) continue;
    b.vy0 = b.v.y;
```

with exactly this:

```js
  // integrate velocities + refresh frames
  bodyLists(world);
  for (const b of world._awake) {
    if (b.invM === 0) continue;
    b.vy0 = b.v.y;
```

At line 2107, replace exactly this:

```js
  const activeWelds = [];
  for (const wd of world.welds) if (!wd.broken && !(wd.a.sleeping && wd.b.sleeping)) activeWelds.push(wd);
```

with exactly this:

```js
  const activeWelds = [];
  for (const wd of liveWelds(world)) if (!wd.broken && !(wd.a.sleeping && wd.b.sleeping)) activeWelds.push(wd);
```

At line 2120, replace exactly this:

```js
  // integrate positions
  for (const b of world.bodies) {
    if (b.invM === 0 || b.sleeping) continue;
    V.addScaled(b.pos, b.pos, b.v, dt);
```

with exactly this:

```js
  // integrate positions
  bodyLists(world);
  for (const b of world._awake) {
    if (b.invM === 0 || b.sleeping) continue;
    V.addScaled(b.pos, b.pos, b.v, dt);
```

### Step 11 — the lists reachable by the suite

At line 2598, replace exactly this:

```js
export const __mech__ = { V, v3, qIdent, qNorm, qFromAxis, qMul, qToR, rMulVec, rTMulVec, invInertiaWorld, iMulVec, wake };
```

with exactly this:

```js
export const __mech__ = { V, v3, qIdent, qNorm, qFromAxis, qMul, qToR, rMulVec, rTMulVec, invInertiaWorld, iMulVec, wake };
// T10 (mk0.6.10): the live lists, for the suite's own checks of them
export const __lists__ = { bodyLists, liveWelds, wakes: () => WAKES };
```

### Step 12 — the parse check and the test

Run `node --check src/engine/core.js`; it prints nothing. Then `grep -c "world.bodies" src/engine/core.js` prints `20` and `grep -c "of world.welds" src/engine/core.js` prints `2` (the two that remain are the pair set's build in `collectContacts` and the live list's own build). Run `node scripts/tests/55-the-live-lists.mjs`: eight PASS, no FAIL. Record the eight lines with their numbers.

### Step 13 — the mark

In `src/version.js` change `export const MK = "0.6.9";` to `export const MK = "0.6.10";`.

### Step 14 — the gates and the keystone

Run, in this order, `node scripts/gate.mjs depot-lint`, `node scripts/gate.mjs golden`, `node scripts/gate.mjs depot-test`, then `npm run build`, `npm run preview &`, `node scripts/gate.mjs smoke`. Record each gate's last line and the depot-test totals (1722 PASS / 0 FAIL on the fresh copy: T9's 1714 plus the eight new asserts). Run `node src/depot/api.js gate 7 20`; it must print the Step 0 line exactly.

### Step 15 — the landing of the engine

Commit exactly these files in one commit: `src/engine/core.js`, `src/version.js`, `scripts/tests/55-the-live-lists.mjs`, `scripts/depot-test.mjs`. Subject: `the live lists, 0.6.10`. Push.

### Step 16 — the run list, replaced whole

Replace the whole content of `docs/superpowers/perf/davy/all.sh` with exactly this:

```bash
#!/bin/bash
# THE BENCH RUNS, THIRD SET (0.6.10): one drawn seed, printed first, and a
# label prefix. Three sandbox runs on the town with a second burst fifteen
# seconds after the first, one on the wall-ringed town, three in the real war
# with the lists hot and its first assault afield; then two browser runs in
# the sandbox and two in the real war on the Pi's own display, each reading
# the quiet seconds before the burst; then the page and its check. A rerun
# passes the drawn seed back: bash all.sh <seed> [prefix]. Without a prefix
# the sandbox runs are labelled q and the war runs w, as the second set was;
# a twin run on the second set's seed passes its own prefix, so its records
# land beside the base's in the page's groups and the page compares them.
set -e
ROOT=/home/batman/coldsnap
OUT=$ROOT/docs/superpowers/perf/davy
SEED=${1:-$(node -e 'console.log(Math.floor(Math.random()*1000000)+1)')}
P=${2:-}
QL=${P:-q}; WL=${P:-w}
echo "seed $SEED labels $QL $WL"
cd "$ROOT"
for K in 1 2 3; do node scripts/diag-davy.mjs --seed "$SEED" --mode sandbox --target town --second 15 --label $QL$K; done
node scripts/diag-davy.mjs --seed "$SEED" --mode sandbox --target walls --second 15 --label ${QL}1
for K in 1 2 3; do node scripts/diag-davy.mjs --seed "$SEED" --mode war --target town --hot --second 15 --label $WL$K; done
TX=$(node -e "console.log(require('$OUT/${QL}1-sandbox-town.json').tx)")
TZ=$(node -e "console.log(require('$OUT/${QL}1-sandbox-town.json').tz)")
npm run build
pkill -f "[v]ite preview" || true; sleep 1
( npm run preview -- --strictPort --port 4173 >/tmp/davy-preview.log 2>&1 & )
curl -sf --retry 30 --retry-delay 1 --retry-all-errors http://localhost:4173/coldsnap/ -o /dev/null
for K in 1 2; do DISPLAY=:0 node scripts/diag-davy-browser.mjs --seed "$SEED" --mode sandbox --tx "$TX" --tz "$TZ" --label $QL$K; done
for K in 1 2; do DISPLAY=:0 node scripts/diag-davy-browser.mjs --seed "$SEED" --mode war --tx "$TX" --tz "$TZ" --label $WL$K; done
pkill -f "[v]ite preview" || true
node "$OUT/page.mjs"
node "$OUT/check.mjs"
echo "ALL DONE seed $SEED"
```

Run `bash -n docs/superpowers/perf/davy/all.sh`; it prints nothing.

### Step 17 — the runs

Run `bash docs/superpowers/perf/davy/all.sh 121051 t` from the repository root with the display attached. It passes back T9's drawn seed, so every run lands in a group the page already holds, and labels the twin's records `t1`–`t3` (`t1-sandbox-town.json`, `t1-sandbox-walls.json`, `t1-war-town.json`, `browser-t1-sandbox.json`, `browser-t1-war.json`, and so on). It runs the same eleven runs T9 ran, then the page and its check.

If a browser run reports `gpu SOFTWARE`, the browser numbers are not usable; report it and run the four browser runs again once with `DISPLAY=:0` confirmed (`xdpyinfo -display :0 | head -3` must print a screen).

Then read, from the eleven lines the runs appended to `.superpowers/experiments.log`, from the page, and from the records, the following, and put them in the report as plain numbers:

1. The identity verdict: `same world in every copy`, or every mismatch line. The twin's runs must print, to the bit, T9's numbers for the same world: sandbox town `hash 2385812855/3038849132 draws 2124 peakAwake 478`; sandbox walls `hash 4138269916/1226044849 draws 2259 peakAwake 910 lost 48`; war hot `hash 2947606336/3400855333 draws 2229 peakAwake 478`.
2. The quiet step, twin against base: `quietMs` for t1–t3 (sandbox) against q1–q3, and for t1–t3 (war) against w1–w3, with each twin run's `quietTop`. From `t1-sandbox-town.json` and `t1-war-town.json`, the quiet window's top eight functions with their shares, and for stepWorld, stepDepot, stepStatus and tickWar the four hottest source lines with their shares (`quiet.profile.lines`). State plainly whether weldBreakPass, stepSleep and stepStatus still appear in the top eight.
3. The bang, twin against base: `burstMs`, `nextMs`, `shadow%`, `explode%`, `flow%` for each twin run against the base run of the same label number.
4. The after window, twin against base: `afterMean`, `afterP95`, `afterWorst`, `heavySteps`, `over7`, `solve%`, `pairs%`, `welds%`, `sweeper%`.
5. The second bang, twin against base: `burst2Ms`, `next2Ms`.
6. The browser, each of the four twin runs against T9's run of the same number (`q1`, `q2`, `w1`, `w2`): the `before:` fields (`rafHz`, `worldRate`, `stepsP50`, `framesAtSix`, `simPerStep`, `renderMean`, `awake`) and the `after:` fields (`rafHz`, `worldRate`, `framesAtSix`, `frameWorst`, `over33`, `burstFrameMs`, `burstRenderMs`, `gcMs`), and `gpu`.
7. The page check's line.

### Step 18 — the landing of the numbers

Commit exactly these files in one commit: every new `docs/superpowers/perf/davy/t*.json` and `docs/superpowers/perf/davy/browser-t*.json` the runs wrote, `docs/superpowers/perf/davy/all.sh`, and `docs/superpowers/perf/davy/index.html`. Subject: `the live lists measure, 0.6.10`. Push.

Then in `docs/superpowers/plans/2026-10-11-coldsnap-the-outbreak-phase.md`, after the T9 row add the row `| T10 | 0.6.10 | The live lists: the engine's step walks short lists of the awake bodies, the bodies each pass reads by kind, and the joints with an awake end, rebuilt once a step and on every wake, instead of every body and every joint — the trajectory identical to the bit; the bench run again on T9's seed beside the base | LANDED — mark 0.6.10, keystone unchanged (seed 7, 20 s: 1278094788 / 2033212782), depot-test 1722, smoke 27/27, the runs at docs/superpowers/perf/davy/index.html |`. Commit that file alone with the subject `t10 lands in the phase document — 0.6.10, the live lists, 27/27`. Push.

### Step 19 — the keystone, confirmed on the pushed tree

Run `node src/depot/api.js gate 7 20` once more and record the line; it must still match Step 0.

## Acceptance

- Step 0, Step 14, and Step 19 print the identical keystone line.
- `golden` ALL PASS; `depot-test` 1722 PASS / 0 FAIL on a rolled seed; `depot-lint` PASS; smoke 27/27; the new test's eight asserts PASS.
- The page's verdict reads `same world in every copy` with the twin's runs inside T9's groups, and the identity numbers of Step 17 item 1 printed to the bit.
- The quiet step: every sandbox twin run's `quietMs` under 6.5 (the fresh copy printed 4.7–4.8; base 11.3–12.0); every war twin run's under 10.0 (the fresh copy printed 8.2; base 14.2–14.8). The twin's quiet top four no longer names `weldBreakPass` or `stepSleep`.
- The browser before the burst: the sandbox runs at `rafHz` 32 or more with `worldRate` 0.80 or more (the fresh copy printed 40.6 at 0.88; base 20.4 at 0.70); the war runs at `rafHz` 28 or more with `worldRate` 0.90 or more (the fresh copy printed 35.3 at 1.01; base 16.0 at 0.80).
- The page check prints `PAGE CHECK OK`; `index.html` holds no `<script` tag.
- Eleven lines in `.superpowers/experiments.log` from this task's runs, one per run, each carrying seed 121051.
- The live site, phone and desktop: nothing visible changes; the quiet war runs faster. The owner's eyes are the acceptance.

## Report

One line of outcome, then: the read-confirmation; the Step 1 failure line; the eight test lines; every gate's result line; the three keystone lines; the depot-test totals and the era's fixture seed; the seven numbered readings of Step 17 as plain numbers, twin beside base; the commit hashes; every deviation, nonconformity, and re-pin as its own labeled bullet. The page file `docs/superpowers/perf/davy/index.html` is named as the thing to open.
