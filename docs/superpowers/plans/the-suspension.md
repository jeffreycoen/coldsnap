# The Suspension (mk2.97)

Task 1 of 2 for the jeep. A body carrying `b.susp` rides four spring-and-damper wheels: it settles at spring height and sleeps parked, leans on slopes, pitches on steps, and drives through per-body speed and force numbers — which is what makes 2H stall on a grade 4L climbs. Guarded engine work; no vehicle uses it until task 2 (the jeep, mk2.98).

Suggested model: Sonnet 5 — one engine file plus a test, every code block carried below verbatim FROM A RUNNING REFERENCE: the whole implementation was built on an import-free copy of core.js at plan-writing time, and every behavior assert below carries numbers measured on it (settle 1.009 m, slope lean 0.9784, 2H sliding back −36 m while 4L climbs +87 m). A wheel-torque sign defect was found and fixed on the reference before it ever reached this plan.

Rulings this plan rests on: real suspension for the jeep; 2H/4L ranges; 2H 14 m/s, 4L 4 m/s (the ranges themselves land in task 2 — this task provides the per-body numbers they set).

Design choices, stated:
- Springs are world-vertical (the standard simplification): the ground's push is up, grip and thrust stay the drive's own. On a slope a parked hull therefore leans but never slides — acceptable for a game hull, stated plainly.
- The box's own terrain contacts remain untouched as the bump stop under the springs.
- `b.susp` is a flat numeric object ({kx, kz, rest, travel, rate, damp}) — it rides the save's generic bag; per-wheel compression (`b._wheelC`, for the renderer and nothing else) and `_suspGround` are transients that re-derive.
- The drive reads `b.spdF`/`b.spdR`/`b.accCap` with defaults that are the exact old constants — every body not carrying them is numerically identical, and golden proves the frozen path.
- The grade term (`acc -= gravity * fwd.y`, suspension bodies only, after the cap) is what lets a slope beat an engine — the transfer case's whole mechanism.
- The pass skips sleeping bodies, so a parked hull's sleep clock runs clean (measured: it sleeps).

## Required reading

- This plan, whole.
- `src/engine/core.js` lines 60–90 (v3/iMulVec conventions), 966–1032 (driveHull, aiDrive, stepDrive), 1925–1940 (stepStatus's grounded commit), 1995–2020 (stepSleep), 2033–2055 (stepWorld's opening).
- `scripts/tests/37-the-order-chain.mjs` (the fixture conventions).

Report opens with confirmation these were read.

## Steps

### Step 1 — the failing tests

Create `scripts/tests/44-the-suspension.mjs` with exactly:

```js
import { ok } from "./harness.mjs";
import { makeWorld, addBody, stepWorld } from "../../src/engine/core.js";
import fs from "node:fs";

// ==== mk2.97: the suspension ================================================
// Four spring-and-damper wheels under a flagged body: it settles at spring
// height and sleeps, leans on a slope, pitches on a step, takes per-body
// drive numbers, and a graded climb can beat an under-geared engine.
// All numbers were measured on the reference implementation. Seeds 150-154.
{
  console.log("\n[mk2.97: the suspension]");
  const flat = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (x, z, o) => { o.x = 0; o.y = 1; o.z = 0; } };
  const mkJ = (w, x, z, y) => {
    const v = addBody(w, { kind: "vehicle", team: 1, mass: 1100, hx: 0.75, hy: 0.5, hz: 1.1, x, y, z, hp: 90, friction: 0.8 });
    v.susp = { kx: 0.6, kz: 0.9, rest: 0.55, travel: 0.4, rate: 66000, damp: 6000 };
    return v;
  };

  // (a) dropped, it settles level at spring height and falls asleep
  {
    const w = makeWorld({ field: flat, seed: 150 }); w.depotCombat = true;
    const v = mkJ(w, 0, 0, 1.4);
    for (let i = 0; i < 900; i++) stepWorld(w);
    ok("(a) the hull settles level at spring height", v.pos.y > 0.96 && v.pos.y < 1.06 && v.R[4] > 0.999, `y ${v.pos.y.toFixed(3)} upY ${v.R[4].toFixed(4)}`);
    ok("(a) the parked hull sleeps", v.sleeping === true);
  }

  // (b) a slope leans it on its springs — held high, not resting on the box
  {
    const slope = { heightAt: (x) => x * 0.2, dirty: false, carve: () => {}, normalAt: (x, z, o) => { const l = Math.hypot(0.2, 1); o.x = -0.2 / l; o.y = 1 / l; o.z = 0; } };
    const w = makeWorld({ field: slope, seed: 151 }); w.depotCombat = true;
    const v = mkJ(w, 0, 0, 1.4);
    for (let i = 0; i < 900; i++) stepWorld(w);
    ok("(b) the slope leans the hull on its springs", v.R[4] > 0.96 && v.R[4] < 0.99 && v.pos.y > 0.9 && Math.abs(v.pos.x) < 0.2 && v.sleeping === true, `upY ${v.R[4].toFixed(4)} y ${v.pos.y.toFixed(2)} x ${v.pos.x.toFixed(2)}`);
  }

  // (c) a step under the front axle pitches it — again held high
  {
    const stepF = { heightAt: (x, z) => z > 0 ? 0.15 : 0, dirty: false, carve: () => {}, normalAt: (x, z, o) => { o.x = 0; o.y = 1; o.z = 0; } };
    const w = makeWorld({ field: stepF, seed: 152 }); w.depotCombat = true;
    const v = mkJ(w, 0, 0, 1.4);
    for (let i = 0; i < 900; i++) stepWorld(w);
    ok("(c) the step pitches the hull, one axle high", v.R[4] > 0.99 && v.R[4] < 0.999 && v.pos.y > 0.9, `upY ${v.R[4].toFixed(4)} y ${v.pos.y.toFixed(2)}`);
  }

  // (d) per-body drive numbers: spdF 14 runs where the default holds 9.5
  {
    const speeds = [];
    for (const spd of [14, null]) {
      const w = makeWorld({ field: flat, seed: 153 }); w.depotCombat = true;
      const v = mkJ(w, -30, 0, 1.4);
      if (spd) v.spdF = spd;
      v.depotDrive = "manual"; v.ctl = { throttle: 1, steer: 0, brake: false };
      for (let i = 0; i < 600; i++) stepWorld(w);
      speeds.push(Math.hypot(v.v.x, v.v.z));
    }
    ok("(d) spdF 14 runs past the tread constant", speeds[0] > 12, speeds[0].toFixed(2));
    ok("(d) an unmarked body keeps the old 9.5", speeds[1] < 9.7, speeds[1].toFixed(2));
  }

  // (e) the grade beats the under-geared engine: 26.6 degrees, accCap 3.5
  // stalls and slides back; accCap 7 climbs it
  {
    const prog = [];
    for (const cap of [3.5, 7]) {
      const slope = { heightAt: (x, z) => z * 0.5, dirty: false, carve: () => {}, normalAt: (x, z, o) => { const l = Math.hypot(0.5, 1); o.x = 0; o.y = 1 / l; o.z = -0.5 / l; } };
      const w = makeWorld({ field: slope, seed: 154 }); w.depotCombat = true;
      const v = mkJ(w, 0, -10, slope.heightAt(0, -10) + 1.4);
      v.accCap = cap; v.spdF = 14;
      v.depotDrive = "manual"; v.ctl = { throttle: 1, steer: 0, brake: false };
      for (let i = 0; i < 1440; i++) stepWorld(w);
      prog.push(v.pos.z + 10);
    }
    ok("(e) 2H's gearing stalls on the grade and slides back", prog[0] < 0, prog[0].toFixed(1));
    ok("(e) 4L's gearing climbs the same grade", prog[1] > 40, prog[1].toFixed(1));
  }

  // (f) pins: the pass, its call, the grade line, the grounded commit
  const cs = fs.readFileSync("src/engine/core.js", "utf8");
  ok("(f) pins: the suspension pass exists", /function stepSuspension\(world\) \{/.test(cs) && /b\._suspGround = touching;/.test(cs));
  ok("(f) pins: the world steps it after the drive", /stepDrive\(world\);\n\s*stepSuspension\(world\);/.test(cs));
  ok("(f) pins: the grade steals after the cap", /if \(b\.susp && traction > 0\) acc -= world\.gravity \* fwd\.y;/.test(cs));
  ok("(f) pins: wheels ground the hull", /b\.groundedNow \|\| b\.bodyGroundedNow \|\| b\._suspGround/.test(cs));
}
```

In `scripts/depot-test.mjs`, after the line

```js
await import("./tests/43-the-roster.mjs");
```

insert

```js
await import("./tests/44-the-suspension.mjs");
```

Run `node scripts/gate.mjs depot-test` blocking. Required result, measured by a live pre-fix run at plan-writing time: exactly NINE asserts FAIL — (a) settle, (b), (c), (d) spdF, (e) 2H-stall, and all four (f) pins — while "(a) the parked hull sleeps", "(d) an unmarked body keeps the old 9.5", and "(e) 4L climbs" PASS pre-fix (the rigid box sleeps, keeps its constant, and climbs everything today). Every pre-existing test PASSES. Any other pattern stops the task.

### Step 2 — the drive learns per-body numbers and the grade (`src/engine/core.js`)

In `driveHull`, replace exactly (currently lines 977–979):

```js
  const target = c.throttle >= 0 ? c.throttle * 9.5 : c.throttle * 4.5;
  let acc = (target - vA) * 2.6;
  acc = Math.max(-9, Math.min(9, acc));
```

with:

```js
  // mk2.97: per-body drive numbers — the defaults ARE the old constants, so
  // every body not carrying them is numerically identical (golden). The
  // grade term applies to suspension bodies only, AFTER the cap: a slope can
  // beat an engine, which is the transfer case's whole mechanism.
  const target = c.throttle >= 0 ? c.throttle * (b.spdF || 9.5) : c.throttle * (b.spdR || 4.5);
  let acc = (target - vA) * 2.6;
  const cap = b.accCap || 9;
  acc = Math.max(-cap, Math.min(cap, acc));
  if (b.susp && traction > 0) acc -= world.gravity * fwd.y;
```

### Step 3 — the suspension pass

Immediately before the line (currently 991)

```js
function aiDrive(world, b) {
```

insert:

```js
// DIVERGENCE (guarded, mk2.97 — owner): THE SUSPENSION. A body carrying
// b.susp rides four spring-and-damper wheels instead of slamming its box
// onto terrain contacts: each wheel samples the ground under itself and
// answers with a vertical force at its point, so the hull pitches, rolls,
// and rocks one wheel at a time. The box's own terrain contacts remain as
// the bump stop beneath the springs. No demo, TD, or campaign body carries
// the field — golden proves the frozen path. b.susp = { kx, kz, rest,
// travel, rate, damp } (flat numbers — it rides the save's generic bag);
// per-wheel compression lands in b._wheelC for the renderer; _suspGround
// feeds the grounded commit so the drive has traction on its wheels.
const _suspWheels = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
function stepSuspension(world) {
  const dt = world.dt;
  for (const b of world.bodies) {
    const s = b.susp;
    if (!s || !b.alive || b.sleeping || b.invM === 0) continue;
    const R = b.R;
    if (!b._wheelC) b._wheelC = [0, 0, 0, 0];
    let touching = false;
    for (let i = 0; i < 4; i++) {
      const lx = _suspWheels[i][0] * s.kx, ly = -b.hy, lz = _suspWheels[i][1] * s.kz;
      const rx = R[0] * lx + R[3] * ly + R[6] * lz;
      const ry = R[1] * lx + R[4] * ly + R[7] * lz;
      const rz = R[2] * lx + R[5] * ly + R[8] * lz;
      const px = b.pos.x + rx, py = b.pos.y + ry, pz = b.pos.z + rz;
      const h = world.field.heightAt(px, pz);
      let comp = (h + s.rest) - py;
      if (comp <= 0) { b._wheelC[i] = 0; continue; }
      if (comp > s.travel) comp = s.travel;
      b._wheelC[i] = comp;
      touching = true;
      const vpy = b.v.y + (b.w.z * rx - b.w.x * rz);
      let F = s.rate * comp - s.damp * vpy;
      if (F < 0) F = 0;
      b.v.y += F * dt * b.invM;
      const L = v3(-rz * F * dt, 0, rx * F * dt);
      const dw = v3(); iMulVec(b.invIw, L, dw);
      b.w.x += dw.x; b.w.y += dw.y; b.w.z += dw.z;
    }
    b._suspGround = touching;
  }
}

```

(The torque line's signs are the verified ones — `L = (-rz·J, 0, rx·J)`, the cross product `r × (0,J,0)`. The reference implementation's first draft had them flipped and the hull somersaulted; the measured numbers in Step 1 come from the corrected line.)

### Step 4 — the world steps it

Replace exactly (currently lines 2038–2039):

```js
  stepDrive(world);
  stepUnits(world);
```

with:

```js
  stepDrive(world);
  stepSuspension(world);
  stepUnits(world);
```

### Step 5 — wheels ground the hull

Replace exactly (currently line 1933):

```js
    if (b.groundedNow || b.bodyGroundedNow) { b.airT = 0; b.grounded = true; } else { b.airT += dt; b.grounded = false; }
```

with:

```js
    if (b.groundedNow || b.bodyGroundedNow || b._suspGround) { b.airT = 0; b.grounded = true; } else { b.airT += dt; b.grounded = false; }
```

### Step 6 — gates

Run blocking, in order:

- `node scripts/gate.mjs depot-test` — required: the twelve Step-1 asserts PASS, everything else PASSES.
- `node scripts/gate.mjs golden` — required: green (all four edits default to the frozen constants; no demo body carries susp/spdF/accCap).
- `node scripts/gate.mjs smoke` — required: green.

The sweep license is NOT granted. Plan-writing sweeps ran clean: no count or literal pin in the suite covers driveHull's constants, stepWorld's opening, or the grounded commit line.

### Step 7 — version, build, land

- `src/version.js`: `mk2.96` → `mk2.97`.
- `npm run build` (after the bump, never before).
- Commit and push. Suggested subject: `the suspension — four springs under a flagged hull, the grade beats the gear, mk2.97`. Include this plan file.

## Acceptance

- Arithmetic: `depot-test` exits 0 with all twelve new asserts PASS; `golden` exits 0; `smoke` exits 0. Fixture seeds: 150–154.
- The owner's live check waits for task 2 — no live body carries `b.susp` yet; this landing is invisible on the site beyond the version mark. The jeep (mk2.98) is where the springs meet your hands.
