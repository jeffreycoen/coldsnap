# T4 — The slower dead and the people indoors (0.6.4)

Two numbers and one home. The dead walk at 4.8 meters a second, half again a man's pace, down from 6.4; a bitten body turns thirty seconds after the bite, not ten. The people live inside their buildings, just inside the door, instead of standing outside it. Spooked, a person leaves by the door and then runs away from the threat; thirty quiet seconds later she walks back to the door and in. The dead sense her through the walls as they sense anyone, and reach her by the door: a dead one hunting an indoor person walks to her door spot first, then in. Everything else — the bite, the sounds, the clawing, the fog, the ledger — stands. The war's headless keystone is unchanged.

Suggested model: Sonnet 5.5 — every step is verbatim code at a grepped anchor; nothing is designed.

## Required reading, in this order

1. `CLAUDE.md`
2. This file, whole, before the first edit.
3. `docs/superpowers/plans/2026-10-11-coldsnap-the-outbreak-phase.md` whole
4. `src/depot/people.js` whole
5. `src/depot/dead.js` lines 160–195
6. `src/depot/specs.js` lines 321–333
7. `src/depot/squads.js` lines 178–226 (`slotBlocked`, `clearSlot`, `slotBlockedPublic`)
8. `scripts/tests/48-the-outbreak.mjs` lines 47–66, `scripts/tests/49-the-people.mjs` whole, `scripts/depot-test.mjs`

The report opens with a line confirming every file above was read.

## Gates

Run only these, each through `node scripts/gate.mjs <name>`: `depot-lint`, `depot-test`, `smoke`. The smoke needs `npm run build` then `npm run preview &` first. `golden` does not run: neither `core.js` nor `renderer.js` changes.

The keystone: `node src/depot/api.js gate 7 20` prints `seed 7  seconds 20 (2400 steps)  worldHash 1278094788  runHash 2033212782` on the untouched tree. Step 0 confirms it; Step 11 confirms it again unchanged. Any other number stops the task.

Sweep license: the two numbers are design changes and the asserts that pin them are re-taught in Step 2, each stated old→new there. No other re-teach is licensed. Any failing test other than the new era file's own asserts before Step 9 stops the task.

## Steps

### Step 0 — the keystone, before

Run `node src/depot/api.js gate 7 20`. The output must read exactly `seed 7  seconds 20 (2400 steps)  worldHash 1278094788  runHash 2033212782`. Record it.

### Step 1 — the failing era file

Create `scripts/tests/51-the-people-indoors.mjs`:

```js
import { ok } from "./harness.mjs";
import { makeWorld, addBody } from "../../src/engine/core.js";
import { DEAD, MAN, MASON } from "../../src/depot/specs.js";
import { spawnDead, stepDead } from "../../src/depot/dead.js";
import { spawnPerson, stepPeople, peopleOf } from "../../src/depot/people.js";
import { bootWar } from "../../src/depot/boot.js";

// ==== 0.6.4: the slower dead and the people indoors ========================
// Seed rolled each run.
{
  console.log("\n[0.6.4: the slower dead and the people indoors]");
  const SEED = (Date.now() % 1000000) + 1;
  console.log("  fixture seed base", SEED);
  const flat = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (x, z, o) => { o.x = 0; o.y = 1; o.z = 0; return o; } };
  const flatMap = { clampToRim: (x, z) => ({ x, z }) };
  const integrate = (w, u, dt) => { u.pos.x += u.v.x * dt; u.pos.z += u.v.z * dt; };

  // (a) the numbers
  ok("(a) the dead walk at 4.8 meters a second and the turn is thirty seconds", DEAD.speed === 4.8 && DEAD.turnS === 30, `${DEAD.speed}/${DEAD.turnS}`);

  // (b) the home: a person spawned with a door has an inside spot and an outside spot
  {
    const w = makeWorld({ field: flat, seed: SEED }); w.depotCombat = true;
    const p = spawnPerson(w, 0, 0, 2.3, 0);
    ok("(b) she stands at the inside spot and knows the outside one", p.pIn && p.pOut && Math.hypot(p.pos.x - p.pIn.x, p.pos.z - p.pIn.z) < 0.01 && p.pOut.x === 2.3, JSON.stringify([p.pIn, p.pOut]));
    const q = spawnPerson(w, 10, 0);
    ok("(b) with no door given the two spots are one", q.pIn && q.pOut && q.pIn.x === q.pOut.x && q.pIn.z === q.pOut.z);
  }

  // (c) the boot: the people stand inside their buildings
  {
    const ob = bootWar({ seed: SEED, outbreak: true });
    const ppl = peopleOf(ob.world);
    const forms = ob.map.TOWN.filter((t) => !t.depot && !t.marker && !t.dead && !t.id.startsWith("fwall"));
    const inside = (b) => forms.some((t) => Math.abs(b.pIn.x - t.x) <= (t.nx * MASON.pitch) / 2 && Math.abs(b.pIn.z - t.z) <= (t.nz * MASON.pitch) / 2);
    const nIn = ppl.filter(inside).length;
    ok("(c) at least nineteen in twenty inside spots lie within a building's footprint", ppl.length > 0 && nIn >= Math.ceil(ppl.length * 0.95), `${nIn}/${ppl.length}`);
    const outside = (b) => !forms.some((t) => Math.abs(b.pOut.x - t.x) < (t.nx * MASON.pitch) / 2 - 0.2 && Math.abs(b.pOut.z - t.z) < (t.nz * MASON.pitch) / 2 - 0.2);
    ok("(c) every outside spot lies outside every footprint", ppl.every(outside), `${ppl.filter((b) => !outside(b)).length} inside`);
  }

  // (d) spooked indoors: out by the door first, then away; home again by the door
  {
    const w = makeWorld({ field: flat, seed: SEED }); w.depotCombat = true; w.t = 100;
    const p = spawnPerson(w, 0, 0, 2.3, 0); const d = spawnDead(w, 0, 12);
    stepPeople(w, flatMap, 1 / 120);
    ok("(d) the first leg is the door", !!p._fleeing && p.goal && Math.abs(p.goal.x - 2.3) < 0.01 && Math.abs(p.goal.z) < 0.01, p.goal ? `${p.goal.x}/${p.goal.z}` : "-");
    for (let i = 0; i < 240; i++) { stepPeople(w, flatMap, 1 / 120); integrate(w, p, 1 / 120); w.t += 1 / 120; }
    ok("(d) two seconds on she is out and running away from the dead", p.pos.x > 1.5 && p.pos.z < -3, `${p.pos.x.toFixed(1)}/${p.pos.z.toFixed(1)}`);
    d.alive = false;
    for (let i = 0; i < 120 * 40; i++) { stepPeople(w, flatMap, 1 / 120); integrate(w, p, 1 / 120); w.t += 1 / 120; }
    ok("(d) forty quiet seconds on she is home, inside", Math.hypot(p.pos.x - p.pIn.x, p.pos.z - p.pIn.z) < 1.0, Math.hypot(p.pos.x - p.pIn.x, p.pos.z - p.pIn.z).toFixed(2));
  }

  // (e) the dead reach an indoor person by the door
  {
    const w = makeWorld({ field: flat, seed: SEED }); w.depotCombat = true;
    const p = spawnPerson(w, 0, 0, 2.3, 0); const d = spawnDead(w, 10, 0);
    stepDead(w, 1 / 120, { squads: [], foeSquads: [], _sounds: [] });
    ok("(e) from outside, the goal is her door", d.tgtId === p.id && d.goal && Math.abs(d.goal.x - 2.3) < 0.01, d.goal ? `${d.goal.x}` : "-");
    d.pos.x = 2.3; d.pos.z = 0;
    stepDead(w, 1 / 120, { squads: [], foeSquads: [], _sounds: [] });
    ok("(e) at the door, the goal is her", d.goal && Math.abs(d.goal.x - p.pos.x) < 0.01 && Math.abs(d.goal.z - p.pos.z) < 0.01, d.goal ? `${d.goal.x}` : "-");
  }

  // (f) the slower hunt still closes: 12 meters and a bite inside four seconds
  {
    const w = makeWorld({ field: flat, seed: SEED }); w.depotCombat = true;
    const d = spawnDead(w, 0, 0);
    const m = addBody(w, { kind: "unit", team: 1, mass: MAN.rifle.mass, hx: MAN.rifle.hx, hy: MAN.rifle.hy, hz: MAN.rifle.hz, x: 12, z: 0, y: MAN.rifle.hy + 0.02, hp: MAN.rifle.hp, friction: 0.5 }); m.maxHp = MAN.rifle.hp;
    let bitAt = null;
    for (let i = 0; i < 480 && bitAt == null; i++) { stepDead(w, 1 / 120); w.t += 1 / 120; integrate(w, d, 1 / 120); if (m.hp < MAN.rifle.hp) bitAt = w.t; }
    ok("(f) at 4.8 the dead still close 12 meters and bite inside four seconds", bitAt != null && bitAt < 4 && bitAt > 2, bitAt == null ? "no bite" : bitAt.toFixed(2) + "s");
  }
}
```

In `scripts/depot-test.mjs`, after `await import("./tests/50-the-senses.mjs");` add:

```js
await import("./tests/51-the-people-indoors.mjs");
```

Run `node scripts/gate.mjs depot-test`. It must fail — the new file's (a) fails on the old numbers and (b) on the missing `pIn`. Record the failure lines.

### Step 2 — the two numbers, and the asserts that pinned them

In `src/depot/specs.js` lines 326–327, replace

```js
export const DEAD = { ...MAN.rifle, tag: "dead", hp: 116, speed: 6.4, sense: 24, bite: 15, biteCd: 1, turnS: 10, reachPad: 0.35,
```

with

```js
export const DEAD = { ...MAN.rifle, tag: "dead", hp: 116, speed: 4.8, sense: 24, bite: 15, biteCd: 1, turnS: 30, reachPad: 0.35, // 0.6.4: half again a man's pace; thirty seconds to the turn
```

Re-teach, licensed (the turn is thirty seconds): in `scripts/tests/48-the-outbreak.mjs` lines 52–55, replace

```js
    w.t = 109.9; stepSick(w);
    ok("(d) at 9.9 seconds he still stands as a man", m.team === 2);
    w.t = 110; stepSick(w);
    ok("(d) at ten seconds he turns", m.team === DEAD_TEAM && m.tag === DEAD.tag && m.hp === 116);
```

with

```js
    w.t = 129.9; stepSick(w);
    ok("(d) at 29.9 seconds he still stands as a man", m.team === 2);
    w.t = 130; stepSick(w);
    ok("(d) at thirty seconds he turns", m.team === DEAD_TEAM && m.tag === DEAD.tag && m.hp === 116);
```

Old → new: `109.9` → `129.9`, `110` → `130`, "at 9.9 seconds" → "at 29.9 seconds", "at ten seconds" → "at thirty seconds". The asserted content, that he turns at the turn time and not before, is unchanged. No other test pins the pace: era 48 (e) and era 50 (c) allow the slower walk inside their windows.

### Step 3 — the people indoors

Replace `src/depot/people.js` whole with:

```js
// COLDSNAP DEPOT — people.js: THE PEOPLE (0.6.2; 0.6.4 indoors). Team 0
// unit bodies tagged PERSON.tag, two in every standing form with a door,
// three in a hangar or warehouse. They live INSIDE, just inside the door
// (pIn), and know the spot just outside it (pOut). Spooked — any of the
// dead within PERSON.fear meters, or a shot fired within PERSON.gunFear
// meters this tick — a person leaves by the door and runs away from the
// threat at a man's pace through squads.js's steer-around; PERSON.homeS
// quiet seconds later she walks back to the door and in. They fire
// nothing, see nothing, hold nothing. No rng anywhere: the spots are fixed
// geometry vetted by clearSlot, scans are seq-staggered.
import { addBody } from "../engine/core.js";
import { MASON, PERSON, DEAD_TEAM } from "./specs.js";
import { clearSlot, seekGoal, slotBlockedPublic } from "./squads.js";
import { faceTravel } from "./units.js";

export function peopleOf(world) {
  const out = [];
  for (const b of world.bodies) if (b.kind === "unit" && b.tag === PERSON.tag && b.alive) out.push(b);
  return out;
}

// spawnPerson(world, xIn, zIn, xOut, zOut): the body stands at the inside
// spot (vetted by clearSlot); the outside spot defaults to the inside one
// (a bare fixture with no door).
export function spawnPerson(world, xIn, zIn, xOut, zOut) {
  const p = clearSlot(world, xIn, zIn, PERSON.hx + 0.35);
  const u = addBody(world, { kind: "unit", team: 0, tag: PERSON.tag, mass: PERSON.mass, hx: PERSON.hx, hy: PERSON.hy, hz: PERSON.hz,
    x: p.x, z: p.z, y: world.field.heightAt(p.x, p.z) + PERSON.hy + 0.02, hp: PERSON.hp, friction: 0.5 });
  u.maxHp = PERSON.hp; u.smearStyle = "human"; u.brave = true; u.bounty = 0;
  u.pIn = { x: p.x, z: p.z };                                            // home: just inside the door
  u.pOut = xOut != null ? { x: xOut, z: zOut } : { x: p.x, z: p.z };    // the step outside it
  u.fleeT = -1000;                                                       // the last fright, on the sim clock
  u.wph = (u.seq * 1.7) % 6.28;
  u.sleeping = true;
  return u;
}

// The door: buildTown carves it in the column ix = t.door (0 or nx - 1) at
// rows iz 1..2, so the opening is on an x face. Outside is 1.3 m past the
// wall plane; inside is 1.1 m within it (the first clear spot, else 2.0 m).
// The hangar has no door but a drive-through on its long axis; its people
// live just inside one end of it.
const IN_1 = 1.1, IN_2 = 2.0, OUT = 1.3;
function doorSpots(world, t) {
  const p = MASON.pitch;
  let wall, axis, side, cross;
  if (/^hangar/.test(t.id)) {
    const driveZ = t.nz >= t.nx;
    axis = driveZ ? "z" : "x"; side = 1;
    wall = axis === "z" ? t.z + ((t.nz - 1) / 2) * p : t.x + ((t.nx - 1) / 2) * p;
    cross = axis === "z" ? t.x : t.z;
  } else {
    axis = "x"; side = t.door === 0 ? -1 : 1;
    wall = t.x + side * ((t.nx - 1) / 2) * p;
    cross = t.z + (1.5 - (t.nz - 1) / 2) * p;
  }
  const at = (along) => (axis === "x" ? { x: along, z: cross } : { x: cross, z: along });
  const out = at(wall + side * OUT);
  let inn = at(wall - side * IN_1);
  if (slotBlockedPublic(world, inn.x, inn.z, PERSON.hx + 0.35)) inn = at(wall - side * IN_2);
  return { inn, out, axis };
}

export function spawnPeople(world, map) {
  const out = [];
  for (const t of map.TOWN) {
    if (t.depot || t.marker || t.dead || t.id.startsWith("fwall")) continue;
    const hangar = /^hangar/.test(t.id);
    if (!hangar && (t.door == null || t.door < 0)) continue;
    const n = hangar || /^warehouse/.test(t.id) ? 3 : 2;
    const d = doorSpots(world, t);
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * 0.6;
      // the spread runs across the door's axis — along the wall, inside
      const ix = d.axis === "x" ? d.inn.x : d.inn.x + off, iz = d.axis === "x" ? d.inn.z + off : d.inn.z;
      out.push(spawnPerson(world, ix, iz, d.out.x, d.out.z));
    }
  }
  return out;
}

// indoorsOf: is she in the house? Nearer her inside spot than the door is
// long, and not standing on the outside spot.
const doorLen = (u) => Math.hypot(u.pOut.x - u.pIn.x, u.pOut.z - u.pIn.z) + 0.3;
export function indoorsOf(u) {
  if (!u.pIn || !u.pOut) return false;
  const inD = Math.hypot(u.pIn.x - u.pos.x, u.pIn.z - u.pos.z), outD = Math.hypot(u.pOut.x - u.pos.x, u.pOut.z - u.pos.z);
  return inD < doorLen(u) && outD > 0.6;
}

// stepPeople: once per sim tick, after the guns have fired (this tick's
// muzzle events are on world.events). A fright stamps fleeT and sets the
// flight goal one fleeStep away from the threat; indoors, the first leg is
// the door. The run continues until a scan finds nothing; homeS quiet
// seconds later she walks to the door and in.
export function stepPeople(world, map, dt) {
  let shots = null;
  for (const e of world.events) if (e.type === "muzzle") (shots || (shots = [])).push(e);
  const F2 = PERSON.fear * PERSON.fear, G2 = PERSON.gunFear * PERSON.gunFear;
  for (const u of world.bodies) {
    if (u.kind !== "unit" || u.tag !== PERSON.tag || !u.alive || u.riding) continue;
    u.scanCd = (u.scanCd || 0) - dt;
    if (u.scanCd <= 0 || shots) {
      if (u.scanCd <= 0) u.scanCd = 0.2 + (u.seq % 8) * 0.012;
      let tx = null, tz = null, bd = F2;
      for (const b of world.bodies) {
        if (b.kind !== "unit" || b.team !== DEAD_TEAM || !b.alive || b.riding) continue;
        const dx = b.pos.x - u.pos.x, dz = b.pos.z - u.pos.z, d2 = dx * dx + dz * dz;
        if (d2 < bd) { bd = d2; tx = b.pos.x; tz = b.pos.z; }
      }
      if (tx == null && shots) {
        let gd = G2;
        for (const e of shots) { const dx = e.x - u.pos.x, dz = e.z - u.pos.z, d2 = dx * dx + dz * dz; if (d2 < gd) { gd = d2; tx = e.x; tz = e.z; } }
      }
      if (tx != null) {
        u.fleeT = world.t;
        const dx = u.pos.x - tx, dz = u.pos.z - tz, d = Math.hypot(dx, dz) || 1;
        const g = map.clampToRim(u.pos.x + (dx / d) * PERSON.fleeStep, u.pos.z + (dz / d) * PERSON.fleeStep);
        u._fleeGoal = { x: g.x, z: g.z }; u._fleeing = true;
      } else if (u._fleeing && u.scanCd > 0.19) { u._fleeing = false; u._fleeGoal = null; u.goal = null; }
    }
    if (u._fleeing && u._fleeGoal) {
      // 0.6.4: out by the door first, then away
      u.goal = indoorsOf(u) ? { x: u.pOut.x, z: u.pOut.z } : { x: u._fleeGoal.x, z: u._fleeGoal.z };
      seekGoal(world, u, dt, PERSON.speed); faceTravel(u, dt);
      continue;
    }
    if (u.pIn && world.t - (u.fleeT != null ? u.fleeT : -1e9) >= PERSON.homeS && Math.hypot(u.pIn.x - u.pos.x, u.pIn.z - u.pos.z) > 0.6) {
      // 0.6.4: home is by the door, then in
      const outD = Math.hypot(u.pOut.x - u.pos.x, u.pOut.z - u.pos.z);
      u.goal = (!indoorsOf(u) && outD > 0.6) ? { x: u.pOut.x, z: u.pOut.z } : { x: u.pIn.x, z: u.pIn.z };
      seekGoal(world, u, dt, PERSON.speed); faceTravel(u, dt);
      continue;
    }
    u.v.x *= 1 - Math.min(1, 6 * dt); u.v.z *= 1 - Math.min(1, 6 * dt);
  }
}
```

`pIn`, `pOut`, and `_fleeGoal` are flat objects of numbers and ride the save through the generic sweep; `pdoor` is gone (the mark moves, so no 0.6.3 save is ever read).

### Step 4 — the dead reach an indoor person by the door

In `src/depot/dead.js`, in `stepDead`, replace the last three lines of the loop body

```js
    u.goal = { x: tgt.pos.x, z: tgt.pos.z };
    seekGoal(world, u, dt, DEAD.speed);
    faceTravel(u, dt);
  }
}
```

(the ones directly after the bite branch's `continue;`) with

```js
    // 0.6.4: a person indoors is reached by the door — her outside spot
    // first, while the dead is itself outside and not yet there; then in.
    let gx = tgt.pos.x, gz = tgt.pos.z;
    if (tgt.pIn && tgt.pOut) {
      const doorLen = Math.hypot(tgt.pOut.x - tgt.pIn.x, tgt.pOut.z - tgt.pIn.z) + 0.3;
      const herIn = Math.hypot(tgt.pIn.x - tgt.pos.x, tgt.pIn.z - tgt.pos.z) < doorLen;
      const meOut = Math.hypot(tgt.pIn.x - u.pos.x, tgt.pIn.z - u.pos.z) >= doorLen;
      const atDoor = Math.hypot(tgt.pOut.x - u.pos.x, tgt.pOut.z - u.pos.z) <= 1.2;
      if (herIn && meOut && !atDoor) { gx = tgt.pOut.x; gz = tgt.pOut.z; }
    }
    u.goal = { x: gx, z: gz };
    seekGoal(world, u, dt, DEAD.speed);
    faceTravel(u, dt);
  }
}
```

### Step 5 — the people's era learns the new names

In `scripts/tests/49-the-people.mjs`, replace every `pdoor` with `pIn` (six occurrences on five lines: 30, 76, 78, 81 twice, 156). Asserted content is unchanged; only the field's name moved. Old → new: `p.pdoor` → `p.pIn` (lines 30, 76, 78, 81), `b.pdoor` → `b.pIn` (line 156). Line 30's assert reads `p.pIn && Math.abs(p.pIn.x - 3) < 5 && Math.abs(p.pIn.z - 4) < 5` after the change.

### Step 6 — the mark

In `src/version.js`, replace `export const MK = "0.6.3";` with `export const MK = "0.6.4";`.

### Step 7 — the gates

Run, in this order, and record each result line:

1. `node scripts/gate.mjs depot-lint` — `depot-lint PASS`.
2. `node scripts/gate.mjs depot-test` — ends `depot-test PASS`; the new era's 10 asserts all PASS; the total is 1677 + 10 = 1687 PASS / 0 FAIL; the report states the numbers and the era's fixture seed.
3. `npm run build`, then `npm run preview &`, then `node scripts/gate.mjs smoke` — `BOOT-LOAD SMOKE: ALL PASS`, 27 PASS lines. Stop the preview server after.

### Step 8 — the outbreak's own headless run

Run `node src/depot/api.js gate 7 20 outbreak`. It must print a line ending in `  dead N` and must not throw. Record the line.

### Step 9 — the keystone, after

Run `node src/depot/api.js gate 7 20`. The output must read exactly `seed 7  seconds 20 (2400 steps)  worldHash 1278094788  runHash 2033212782`. Any other number stops the task before the commit; report it.

### Step 10 — the landing

Commit exactly these files in one commit: `src/depot/specs.js`, `src/depot/people.js`, `src/depot/dead.js`, `src/version.js`, `scripts/depot-test.mjs`, `scripts/tests/48-the-outbreak.mjs`, `scripts/tests/49-the-people.mjs`, `scripts/tests/51-the-people-indoors.mjs`, and this plan file. Subject: `the slower dead and the people indoors, 0.6.4`. Push to `main`.

Then in `docs/superpowers/plans/2026-10-11-coldsnap-the-outbreak-phase.md`, replace the T4 row's status cell `PLANNED — decided before planning: how the dead find a person indoors (sense only what they could see, claw the house, or walk the wall to the door)` with `LANDED — mark 0.6.4, keystone unchanged (seed 7, 20 s: 1278094788 / 2033212782), depot-test 1687, smoke 27/27`, and in the design paragraph append to the sentence ending `walk back to the door and in.` the sentence ` The dead sense a person through the walls as they sense anyone and reach her by the door.` Commit that file alone with the subject `t4 lands in the phase document — 0.6.4, the slower dead and the people indoors, 27/27`. Push.

### Step 11 — the keystone, confirmed on the pushed tree

Run `node src/depot/api.js gate 7 20` once more and record the line; it must still match Step 0.

## Acceptance

- Step 0, Step 9, and Step 11 print the identical line.
- `depot-test` 1687 PASS / 0 FAIL on a rolled seed; `depot-lint` PASS; smoke 27/27.
- The outbreak gate runs to the end.
- The live site: the towns' streets are empty and the people are inside; a dead one coming to a house goes to its door; a spooked household comes out the door and scatters; a bitten man lasts thirty seconds, his coat going grey-green the whole way; the dead walk at a brisk pace, not a sprint. The owner's eyes are the acceptance.

## Report

One line of outcome, then: every gate's result line; the three keystone lines; the depot-test totals; the era's fixture seed; the re-teaches old→new; the outbreak gate's line; the commit hashes; every deviation, nonconformity, and re-pin as its own labeled bullet.
