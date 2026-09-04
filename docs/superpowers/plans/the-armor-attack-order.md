# The Armor Attack Order (mk2.88)

Task 1 of 2 for the screen-select feature. Vehicles get an ATTACK order: the hull drives the same road as MOVE, but while a live foe stands in its guns' reach it halts and lets the guns work; quiet ground rolls it on; on arrival it digs in as defend. The order joins the vehicle pie. Task 2 (the green select-all button and the group reticle) is its own plan and depends on this one.

Suggested model: Sonnet 5 — three files, every code block carried below verbatim.

Rulings this plan rests on: vehicles need an attack order; its meaning is "stop and fight en route."

Design choices, stated:
- "In its guns' reach" means a live foe (man, hull, or mech) the gun scans can lawfully hit — the same scan the guns already run. Enemy masonry never halts the drive; the ram law on enemy walls stays MOVE's own.
- The halt clock (`_foeT`) is stamped by the existing gun scans and read only under the attack order. Its hold window is 3.5 seconds — longer than the Bison gun's 2.6-second scan cycle, so the hull does not creep between shells. Marked provisional (F5).
- The pie's ATTACK wedge reuses the existing "attack" teaching card ("Tap the ground. They fight their way there.") — the words fit, and the card registry is untouched.
- Symmetry: the driver code is team-agnostic; the order works identically for an enemy-team hull. The enemy commander's use of it is not in this task — capability is symmetric, employment is each side's own command layer.
- Saves: `order: "attack"` and `_foeT` are plain scalars on the body and ride the save's generic sweep; an old save without them reads as 0/undefined and behaves as today. No migration.

## Required reading

- This plan, whole.
- `src/depot/drivers.js` lines 109–230 (armorGoal's order machine), 360–440 (the scans and gun policies), 463–546 (the mech goal and guns).
- `src/depot/DepotGame.jsx` lines 936–950 (`orderVehicle`), 1315–1356 (`consumeVehOrderTap`), 3052–3063 (`vehRadial`), 3870–3898 (the vehicle pie).
- `scripts/tests/11-hiring-hall.mjs` lines 383–430 (the hunt fixture this task's tests copy).

Report opens with confirmation these were read.

## Steps

### Step 1 — the failing tests

Create `scripts/tests/35-the-armor-attack.mjs` with exactly:

```js
import { ok } from "./harness.mjs";
import { makeWorld, addBody, stepWorld } from "../../src/engine/core.js";
import { stepDrivers } from "../../src/depot/drivers.js";
import { BISON } from "../../src/depot/specs.js";
import { identFwdDir } from "./shared.mjs";
import fs from "node:fs";

// ==== mk2.88: the armor attack order ========================================
// ATTACK for hulls: drive the road, halt to fight any live foe the guns can
// reach, roll on when the ground is quiet, defend on arrival. The fixture is
// the hunt test's own (11-hiring-hall (f)). Seeds 110-113.
{
  console.log("\n[mk2.88: the armor attack order]");
  const flatF = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } };
  const N = 44;
  const mkGrid = () => {
    const cells = Array.from({ length: N * N }, () => ({ blocked: false, terrain: false, ice: false, water: false, wallId: null, building: null, bTeam: 0, steep: false, drop: false, bag: null, bagId: null }));
    const G = { cells, w: N, h: N, cs: 2,
      idx: (gx, gz) => gz * N + gx,
      inBounds: (gx, gz) => gx >= 0 && gx < N && gz >= 0 && gz < N,
      worldToGrid: (x, z) => ({ gx: Math.floor(x / 2) + (N >> 1), gz: Math.floor(z / 2) + (N >> 1) }),
      gridToWorld: (gx, gz) => ({ x: (gx - (N >> 1)) * 2 + 1, z: (gz - (N >> 1)) * 2 + 1 }) };
    G.cellAt = (x, z) => { const g = G.worldToGrid(x, z); return G.inBounds(g.gx, g.gz) ? cells[G.idx(g.gx, g.gz)] : null; };
    return G;
  };
  const mkHull = (w, drv, x, z) => {
    const v = addBody(w, { kind: "vehicle", team: 1, mass: BISON.mass, hx: BISON.hx, hy: BISON.hy, hz: BISON.hz, x, y: BISON.hy + 0.05, z, hp: BISON.hp, friction: 0.85 });
    v.armor = BISON.armor; v.vtype = drv === "apc" ? "apc" : "bison"; v.drv = drv; v.depotDrive = "auto"; v.order = "defend"; v.tracks = "careful";
    v.homeX = x; v.homeZ = z;
    return v;
  };
  const mkFoe = (w, x, z, hp) => addBody(w, { kind: "unit", team: 2, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x, y: 0.74, z, hp });

  // (a) a live foe in the gun's reach halts the attacking hull where it stands
  {
    const w = makeWorld({ field: flatF, seed: 110 }); w.depotCombat = true;
    const G = mkGrid();
    const v = mkHull(w, "armor", -20, 0);
    mkFoe(w, 0, 0, 50000);
    w.t = 3;
    v.order = "attack"; v.dest = { x: 20, z: 0 };
    for (let i = 0; i < 1200; i++) { w.t += w.dt; stepDrivers(w, G, identFwdDir, null); stepWorld(w); }
    ok("(a) the attacking hull halts to fight", Math.hypot(v.pos.x + 20, v.pos.z) < 5, `${v.pos.x.toFixed(1)},${v.pos.z.toFixed(1)}`);
    ok("(a) the order holds through the fight", v.order === "attack", v.order);
    ok("(a) the gun scan stamps the foe clock", w.t - (v._foeT || 0) < 4, `${(w.t - (v._foeT || 0)).toFixed(1)}s stale`);
  }

  // (b) a quiet road: ATTACK drives through and digs in, exactly MOVE's end
  {
    const w = makeWorld({ field: flatF, seed: 111 }); w.depotCombat = true;
    const G = mkGrid();
    const v = mkHull(w, "armor", -20, 0);
    w.t = 3;
    v.order = "attack"; v.dest = { x: 20, z: 0 };
    for (let i = 0; i < 3600 && v.order !== "defend"; i++) { w.t += w.dt; stepDrivers(w, G, identFwdDir, null); stepWorld(w); }
    ok("(b) a quiet attack arrives and defends", v.order === "defend" && Math.hypot(v.pos.x - 20, v.pos.z) < 6, `${v.order} at ${v.pos.x.toFixed(1)},${v.pos.z.toFixed(1)}`);
  }

  // (c) the foe falls, the ground goes quiet, the hull rolls on
  {
    const w = makeWorld({ field: flatF, seed: 112 }); w.depotCombat = true;
    const G = mkGrid();
    const v = mkHull(w, "armor", -20, 0);
    mkFoe(w, 0, 4, 40);
    w.t = 3;
    v.order = "attack"; v.dest = { x: 20, z: 0 };
    for (let i = 0; i < 3600 && v.order !== "defend"; i++) { w.t += w.dt; stepDrivers(w, G, identFwdDir, null); stepWorld(w); }
    ok("(c) the foe falls and the hull rolls on to the destination", v.order === "defend" && Math.hypot(v.pos.x - 20, v.pos.z) < 6, `${v.order} at ${v.pos.x.toFixed(1)},${v.pos.z.toFixed(1)}`);
  }

  // (d) the transport halts too — its coax is a gun; it stops short of the
  // foe (mg reach 18) and stands fighting, never arriving
  {
    const w = makeWorld({ field: flatF, seed: 113 }); w.depotCombat = true;
    const G = mkGrid();
    const v = mkHull(w, "apc", -20, 0);
    mkFoe(w, 0, 0, 50000);
    w.t = 3;
    v.order = "attack"; v.dest = { x: 20, z: 0 };
    for (let i = 0; i < 1200; i++) { w.t += w.dt; stepDrivers(w, G, identFwdDir, null); stepWorld(w); }
    ok("(d) the transport stands fighting short of the foe", v.pos.x < -10 && v.order === "attack", `${v.pos.x.toFixed(1)}, ${v.order}`);
  }

  // (e) pins: the mech's own halt and stamp (its fixture is heavy; the
  // walker shares ATTACK's exact clock and hold by these lines)
  const dsrc = fs.readFileSync("src/depot/drivers.js", "utf8");
  ok("(e) pins: the mech honors the halt", /order === "attack" && world\.t - \(b\._foeT \|\| 0\) < ATTACK_HOLD_S/.test(dsrc));
  ok("(e) pins: the mech gun stamps the clock", /if \(tgt\) b\._foeT = world\.t;/.test(dsrc));

  // (f) pins: the pie wedge and the ground tap
  const dg = fs.readFileSync("src/depot/DepotGame.jsx", "utf8");
  ok("(f) pins: the vehicle pie carries ATTACK", /key: "attack", icon: "✕", label: "ATTACK"/.test(dg));
  ok("(f) pins: the attack tap sets the order", /v\.order = "attack"; v\.dest = \{ x: d\.x, z: d\.z \};/.test(dg));
}
```

In `scripts/depot-test.mjs`, after the line

```js
await import("./tests/34-the-standing-tree.mjs");
```

insert

```js
await import("./tests/35-the-armor-attack.mjs");
```

Run `node scripts/gate.mjs depot-test`. Required result: the three (a) asserts, the (d) assert, both (e) pins, and both (f) pins FAIL — seven failures; (b) and (c) PASS (attack already rides the move machinery generically, so a quiet road works before the fix); every pre-existing test PASSES. Any other pattern stops the task and is reported — no improvisation.

### Step 2 — the order engine (`src/depot/drivers.js`)

**2a.** After the line (currently 129)

```js
const HUNT_HOLD_S = 12, HUNT_MAX_M = 45;   // provisional (F5) — P7.2 T5, the hunt
```

insert:

```js
const ATTACK_HOLD_S = 3.5;   // provisional (F5) — mk2.88: the attack halt outlasts the Bison gun's 2.6s scan cycle, so the hull stands rather than creeps between shells
```

**2b.** In `armorGoal`, immediately before the line (currently 229)

```js
  if (!v.dest) { v.order = "defend"; v.goal = null; return; }
```

insert:

```js
  // mk2.88: ATTACK — the move that stops to fight. Same road as
  // MOVE, but while a live foe stands in the guns' reach (the gun scans
  // stamp _foeT) the hull halts and lets the guns work; quiet ground rolls
  // it on. Arrival is MOVE's own: the order becomes "defend". Enemy masonry
  // on the road still rams exactly as MOVE does — structures never halt.
  if (order === "attack" && world.t - (v._foeT || 0) < ATTACK_HOLD_S) {
    v.depotDrive = "manual";
    v.ctl = { throttle: 0, steer: 0, brake: true };
    v.goal = null;
    return;
  }
```

**2c.** In `mechGoal`, immediately after the line (currently 483)

```js
  const order = b.order || "defend";
```

insert:

```js
  if (order === "attack" && world.t - (b._foeT || 0) < ATTACK_HOLD_S) { mechCommand(m, { travel: 0, lateral: 0 }); return; } // mk2.88: the halt, in the walker's form
```

**2d.** The stamps — four one-line insertions, each right after its scan:

In `armorGuns`, after the line (currently 401)

```js
    let tgt = armorScanFoes(world, v, muzzle, gun, false, T, toUV), struct = false;
```

insert:

```js
    if (tgt) v._foeT = world.t; // mk2.88: a live foe in reach — the attack halt reads this clock
```

In `armorGuns`, after the line (currently 413)

```js
    const tgt = armorScanFoes(world, v, muzzle, mg, true, T, toUV);   // the coax shoots men, not dirt
```

insert:

```js
    if (tgt) v._foeT = world.t; // mk2.88: the coax counts too
```

In `apcGuns`, after the line (currently 432)

```js
  const tgt = armorScanFoes(world, v, muzzle, mg, true, T, toUV);
```

insert:

```js
  if (tgt) v._foeT = world.t; // mk2.88: the attack halt's clock
```

In `mechGuns`, after the line (currently 522)

```js
  let tgt = armorScanFoes(world, b, muzzle, MECH_GUN, false, T, toUV);
```

insert:

```js
  if (tgt) b._foeT = world.t; // mk2.88: the attack halt's clock
```

### Step 3 — the pie and the tap (`src/depot/DepotGame.jsx`)

**3a.** In `view.orderVehicle` (currently line 945), replace:

```js
        else if (kind === "move" || kind === "patrol" || kind === "escort" || kind === "load") {
```

with:

```js
        else if (kind === "move" || kind === "attack" || kind === "patrol" || kind === "escort" || kind === "load") {
```

**3b.** In `consumeVehOrderTap`, immediately after the `move` branch's closing brace (currently line 1347, the `}` before `if (om === "patrol")`), insert:

```js
        if (om === "attack") {   // mk2.88: MOVE's own tap, the fighting order
          v.order = "attack"; v.dest = { x: d.x, z: d.z }; v._route = null; v._routeDest = null;
          view.vehOrderMode = null; view.selVehId = null;
          return true;
        }
```

**3c.** In the `vehRadial` block (currently line 3061), replace:

```js
                  aimingMove: view.vehOrderMode === "move", aimingPatrol: view.vehOrderMode === "patrol", aimingEscort: view.vehOrderMode === "escort",
```

with:

```js
                  aimingMove: view.vehOrderMode === "move", aimingAttack: view.vehOrderMode === "attack", aimingPatrol: view.vehOrderMode === "patrol", aimingEscort: view.vehOrderMode === "escort",
```

**3d.** In the vehicle pie's `slots` array (currently line 3876), immediately after the MOVE slot line

```js
          { key: "move", icon: "→", label: "MOVE", color: "#7fd7ff", on: vr.aimingMove || vr.order === "move", card: "move", act: () => stateRef.current && stateRef.current.view.orderVehicle("move") },
```

insert:

```js
          { key: "attack", icon: "✕", label: "ATTACK", color: "#ff9a7a", on: vr.aimingAttack || vr.order === "attack", card: "attack", act: () => stateRef.current && stateRef.current.view.orderVehicle("attack") },
```

**3e.** In the pie's `status` chain (currently line 3894), replace:

```js
          : vr.aimingMove ? " — TAP GROUND" : "";
```

with:

```js
          : vr.aimingAttack ? " — TAP THE TARGET GROUND"
          : vr.aimingMove ? " — TAP GROUND" : "";
```

The pie is the interface on phone and desktop both — one wedge, both platforms; no other interface surface changes in this task.

### Step 4 — gates

Run, in order:

- `node scripts/gate.mjs depot-test` — required: Step 1's seven FAILs now PASS, (b)/(c) still PASS, everything else PASSES.
- `node scripts/gate.mjs depot-lint` — required: green (no unseeded randomness entered `src/depot`).
- `node scripts/gate.mjs smoke` — required: green.

`core.js` is untouched, so the golden gate is not in this brief. The sweep license is NOT granted: any pre-existing test failure stops the task.

### Step 5 — version, build, land

- `src/version.js`: `mk2.87` → `mk2.88`.
- `npm run build` (after the bump, never before).
- Commit and push. Suggested subject: `the armor attack order — hulls stop and fight en route, mk2.88`. Include this plan file.

## Acceptance

- Arithmetic: `depot-test` exits 0 with all nine new asserts PASS; `depot-lint` exits 0; `smoke` exits 0. Fixture seeds: 110, 111, 112, 113.
- The owner's live check: select the Bison, ATTACK a point past an enemy — it drives, stops to fight what it meets, rolls on when the ground clears, digs in at the mark. The APC and the mech honor the same order. Phone and desktop both.
