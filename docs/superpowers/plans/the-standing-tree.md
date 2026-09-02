# The Standing Tree — troops do not knock over trees (mk2.87)

One task, standalone — no active phase document. A walking troop shoves a tree over today because the contact solver treats every awake body the same. After this task a troop's contact neither wakes a tree nor moves it; the troop is pushed off the trunk at full strength. Vehicles, mechs, wrecks, blasts, gunfire, and fire fell trees exactly as before. Both teams' troops are covered by the same rule — no asymmetry.

Suggested model: Sonnet 5 — two small guarded edits and one test file, all code carried below.

## Required reading

- This plan, whole.
- `src/engine/core.js` lines 1460–1560 (the broad-phase wake rule) and 1556–1661 (`prepContacts`, `applyImpulse`, `solveContacts`).
- `scripts/tests/harness.mjs` (all 17 lines) and the head of `scripts/depot-test.mjs` (the import list).

Report opens with confirmation these were read.

## Mechanism, in one paragraph

Trees are ordinary dynamic bodies (mass 260). Any body moving faster than a slow walk wakes a sleeping body it touches (`core.js:1536–1537`), and the impulse solver then shoves the tree like anything else until it tips. Two guarded divergences fix it: the wake rule ignores units touching trees, and the solver treats a unit↔tree contact as one-sided — the tree's terms leave the effective-mass sums and it receives no velocity writes. Both are gated on `world.depotCombat`; no demo or campaign world holds a tree body, and golden proves the frozen path unchanged.

## Steps

### Step 1 — the failing tests

Create `scripts/tests/34-the-standing-tree.mjs` with exactly:

```js
import { ok } from "./harness.mjs";
import { makeWorld, addBody, stepWorld } from "../../src/engine/core.js";

// ==== mk2.87: the standing tree =============================================
// A walking man does not fell a tree. Under depot combat a unit↔tree contact
// is one-sided — the tree ignores contact-wake from units and takes no
// impulse from them; the man is pushed off the trunk at full strength. A
// vehicle still rams a tree over. Seed 5.
{
  console.log("\n[mk2.87: the standing tree]");
  const flat = { heightAt: () => 0, dirty: false, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } };
  const plantTree = (world) => {
    const t = addBody(world, { kind: "tree", team: 0, mass: 260, hx: 0.28, hy: 1.6, hz: 0.28, x: 0, y: 1.62, z: 0, hp: 70, friction: 0.5 });
    t.sleeping = true;
    return t;
  };
  const plantMan = (world) =>
    addBody(world, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 1.0, hz: 0.28, x: -0.9, y: 1.0, z: 0, hp: 58 });

  // (a) a rifleman drives into the trunk for ten seconds — the sleeping tree
  // neither wakes nor moves, and the man is held off it
  {
    const world = makeWorld({ field: flat, seed: 5 });
    world.depotCombat = true;
    const tree = plantTree(world);
    const man = plantMan(world);
    for (let i = 0; i < 600; i++) { man.v.x = 1.6; stepWorld(world); }
    ok("(a) the shoved tree stays asleep", tree.sleeping === true);
    ok("(a) the trunk has not moved", Math.hypot(tree.pos.x, tree.pos.z) < 0.01, `moved ${Math.hypot(tree.pos.x, tree.pos.z).toFixed(3)}m`);
    ok("(a) the trunk stands upright", tree.R[4] > 0.999, `upY ${tree.R[4].toFixed(4)}`);
    ok("(a) the man is held off the trunk", man.pos.x < -0.5, `x ${man.pos.x.toFixed(2)}`);
  }

  // (b) an AWAKE tree (woken by the war around it) still refuses the shove
  {
    const world = makeWorld({ field: flat, seed: 5 });
    world.depotCombat = true;
    const tree = plantTree(world);
    const man = plantMan(world);
    for (let i = 0; i < 600; i++) { tree.sleeping = false; tree.sleepT = 0; man.v.x = 1.6; stepWorld(world); }
    ok("(b) the awake trunk has not moved", Math.hypot(tree.pos.x, tree.pos.z) < 0.02, `moved ${Math.hypot(tree.pos.x, tree.pos.z).toFixed(3)}m`);
    ok("(b) the awake trunk stands upright", tree.R[4] > 0.999, `upY ${tree.R[4].toFixed(4)}`);
  }

  // (c) control — a tank still fells the tree
  {
    const world = makeWorld({ field: flat, seed: 5 });
    world.depotCombat = true;
    const tree = plantTree(world);
    const tank = addBody(world, { kind: "vehicle", team: 1, mass: 3400, hx: 1.5, hy: 0.8, hz: 2.4, x: -6, y: 0.8, z: 0, hp: 260 });
    for (let i = 0; i < 240; i++) { tank.v.x = 6; stepWorld(world); }
    ok("(c) a tank still knocks the tree over", tree.R[4] < 0.9 || Math.hypot(tree.pos.x, tree.pos.z) > 0.5, `upY ${tree.R[4].toFixed(3)}, moved ${Math.hypot(tree.pos.x, tree.pos.z).toFixed(2)}m`);
  }
}
```

In `scripts/depot-test.mjs`, after the line

```js
await import("./tests/33-the-settled-ground.mjs");
```

insert

```js
await import("./tests/34-the-standing-tree.mjs");
```

Run `node scripts/gate.mjs depot-test`. Required result: exactly the four (a)/(b) asserts FAIL, (c) PASSES, every pre-existing test PASSES. Any other failure stops the task.

### Step 2 — the wake exemption

`src/engine/core.js`, currently lines 1479–1480. Replace exactly this:

```js
  const wakeExempt = (s, mover) =>
    world.depotCombat && s.kind === "chunk" && mover.mass < 200 && weldedAsleep(s);
```

with this (the tree clause is added; the chunk clause is untouched):

```js
  // DIVERGENCE (guarded, mk2.87 — owner): a walking man does not wake a
  // tree either — under depotCombat a sleeping tree ignores contact-wake
  // from units, so a leaned-on treeline stays asleep and cheap.
  const wakeExempt = (s, mover) =>
    world.depotCombat && ((s.kind === "tree" && mover.kind === "unit") ||
      (s.kind === "chunk" && mover.mass < 200 && weldedAsleep(s)));
```

### Step 3 — the one-sided contact

All in `src/engine/core.js`.

**3a.** In `prepContacts`, immediately after the line (currently 1560)

```js
    const a = c.a, b = c.b;
```

insert:

```js
    // DIVERGENCE (guarded, mk2.87 — owner): A WALKING MAN DOES NOT FELL A
    // TREE. Under depotCombat a unit↔tree contact is one-sided: the tree's
    // terms leave the effective-mass sums and applyImpulse never writes its
    // velocity, so the man is pushed off the trunk at full strength and the
    // trunk takes nothing. Vehicles, mechs, wrecks, blasts, gunfire and fire
    // fell trees as before. No tree exists outside depot worlds (golden).
    c.lockA = world.depotCombat && b && a.kind === "tree" && b.kind === "unit" ? 1 : 0;
    c.lockB = world.depotCombat && b && b.kind === "tree" && a.kind === "unit" ? 1 : 0;
```

**3b.** Still in `prepContacts`, replace exactly this block (currently 1566–1576):

```js
    let kn = a.invM + (b ? b.invM : 0);
    const raxn = _pcRaxn; V.cross(raxn, c.rA, n);
    const tmp = _pcTmp; iMulVec(a.invIw, raxn, tmp);
    const t2v = _pcT2; V.cross(t2v, tmp, c.rA);
    kn += V.dot(t2v, n);
    if (b) {
      const rbxn = v3(); V.cross(rbxn, c.rB, n);
      iMulVec(b.invIw, rbxn, tmp);
      V.cross(t2v, tmp, c.rB);
      kn += V.dot(t2v, n);
    }
```

with:

```js
    let kn = (c.lockA ? 0 : a.invM) + (b && !c.lockB ? b.invM : 0);
    const raxn = _pcRaxn, tmp = _pcTmp, t2v = _pcT2;
    if (!c.lockA) {
      V.cross(raxn, c.rA, n);
      iMulVec(a.invIw, raxn, tmp);
      V.cross(t2v, tmp, c.rA);
      kn += V.dot(t2v, n);
    }
    if (b && !c.lockB) {
      const rbxn = v3(); V.cross(rbxn, c.rB, n);
      iMulVec(b.invIw, rbxn, tmp);
      V.cross(t2v, tmp, c.rB);
      kn += V.dot(t2v, n);
    }
```

**3c.** Still in `prepContacts`, replace exactly this block (currently 1584–1589):

```js
    const kt = (tv) => {
      let k = a.invM + (b ? b.invM : 0);
      V.cross(raxn, c.rA, tv); iMulVec(a.invIw, raxn, tmp); V.cross(t2v, tmp, c.rA); k += V.dot(t2v, tv);
      if (b) { V.cross(raxn, c.rB, tv); iMulVec(b.invIw, raxn, tmp); V.cross(t2v, tmp, c.rB); k += V.dot(t2v, tv); }
      return 1 / Math.max(1e-9, k);
    };
```

with:

```js
    const kt = (tv) => {
      let k = (c.lockA ? 0 : a.invM) + (b && !c.lockB ? b.invM : 0);
      if (!c.lockA) { V.cross(raxn, c.rA, tv); iMulVec(a.invIw, raxn, tmp); V.cross(t2v, tmp, c.rA); k += V.dot(t2v, tv); }
      if (b && !c.lockB) { V.cross(raxn, c.rB, tv); iMulVec(b.invIw, raxn, tmp); V.cross(t2v, tmp, c.rB); k += V.dot(t2v, tv); }
      return 1 / Math.max(1e-9, k);
    };
```

**3d.** Replace the whole `applyImpulse` function (currently 1619–1633):

```js
function applyImpulse(c, J) {
  const a = c.a, b = c.b;
  if (!a.sleeping) {
    V.addScaled(a.v, a.v, J, -a.invM);
    const L = v3(); V.cross(L, c.rA, J);
    const dw = v3(); iMulVec(a.invIw, L, dw);
    V.addScaled(a.w, a.w, dw, -1);
  }
  if (b && !b.sleeping) {
    const L = v3(), dw = v3();
    V.addScaled(b.v, b.v, J, b.invM);
    V.cross(L, c.rB, J); iMulVec(b.invIw, L, dw);
    V.addScaled(b.w, b.w, dw, 1);
  }
}
```

with (only the two lock guards are added):

```js
function applyImpulse(c, J) {
  const a = c.a, b = c.b;
  if (!a.sleeping && !c.lockA) {
    V.addScaled(a.v, a.v, J, -a.invM);
    const L = v3(); V.cross(L, c.rA, J);
    const dw = v3(); iMulVec(a.invIw, L, dw);
    V.addScaled(a.w, a.w, dw, -1);
  }
  if (b && !b.sleeping && !c.lockB) {
    const L = v3(), dw = v3();
    V.addScaled(b.v, b.v, J, b.invM);
    V.cross(L, c.rB, J); iMulVec(b.invIw, L, dw);
    V.addScaled(b.w, b.w, dw, 1);
  }
}
```

Note inside this step: `applyImpulse` is called only from `prepContacts` (warm start) and `solveContacts`, both after 3a has set the lock fields on the contact. Terrain contacts (`b` null) also pass through `prepContacts`, where 3a's `&& b` term sets both locks to 0. No contact reaches `applyImpulse` without the fields set.

### Step 4 — gates

Run, in order:

- `node scripts/gate.mjs depot-test` — required: the four Step-1 FAILs now PASS, (c) still PASSES, everything else PASSES.
- `node scripts/gate.mjs golden` — required: green (proves the frozen demo path byte-identical).
- `node scripts/gate.mjs smoke` — required: green.

The sweep license is NOT granted: any pre-existing test that fails stops the task.

### Step 5 — version, build, land

- `src/version.js`: `mk2.86` → `mk2.87`.
- `npm run build` (after the bump, never before).
- Commit and push. Suggested subject: `the standing tree — troops no longer knock over trees, mk2.87`.

## Acceptance

- Arithmetic: `depot-test` exits 0 with the seven new asserts (4 in (a), 2 in (b), 1 in (c)) all PASS; `golden` exits 0; `smoke` exits 0.
- The owner's live check: walk a squad through a copse — trees stand; drive armor through — trees fall. Phone and desktop both, same build, no interface change in this task.
