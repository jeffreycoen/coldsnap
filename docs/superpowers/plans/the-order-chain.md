# The Order Chain (mk2.90)

Task 1 of 2 for the command-queue feature. Squads and hulls learn to carry a chain of queued orders: on arrival, instead of digging in, the unit takes the next queued order. MOVE and ATTACK chain; PATROL is terminal (it never arrives, so nothing after it ever runs); an empty chain ends in defend exactly as today. This task is the engine and the save ride only — no interface. Task 2 (the QUEUE wedge, numbered flags, leg deletion, CLEAR) is its own plan and builds on this.

Suggested model: Sonnet 5 — four files, every code block carried below verbatim.

Rulings this plan rests on: chains exist; a plain order wipes them (that law lands with task 2's builder — until then nothing in live play can create a chain, only tests); single selections only; build lines stay outside; patrol/defend are terminal.

Design choices, stated:
- The chain is `_queue` — a plain array on the squad or hull body. Entries: `{ kind: "move"|"attack", x, z }` or the terminal `{ kind: "patrol", ax, az, bx, bz }`. A queued defend is unnecessary (an empty chain already ends in defend) and the builder will never write one.
- The pop happens at the one arrival seam each machine already has: the squad's arrive-to-defend branch, the hull's, the mech's. A queued patrol lands exactly as acceptLine lands one: both ends set, walk to the near end first.
- The sapper's held-attack rule (charges must be spent before the flip) sits before the arrival branch and is untouched — a sapper squad's chain waits for the charges, then pops.
- Saves: the generic sweeps drop object arrays (`plainValue`), so the chain rides explicitly — one added key in the squad row and one in the body's orders bag. Restore is already generic on both paths, so old saves (no `_queue` key) resume exactly as today. No migration.
- Symmetry: the machines are team-agnostic; either team's units run a chain identically.

## Required reading

- This plan, whole.
- `src/depot/squads.js` lines 596–700 (stepSquad's leg machine and arrival branches).
- `src/depot/drivers.js` lines 148–300 (armorGoal) and 463–517 (mechGoal).
- `src/depot/save.js` lines 70–130 (plainValue, writeBody), 233–245 (squadRow), and the readBody / restoreSquads functions.
- `scripts/tests/35-the-armor-attack.mjs` (the fixture this task's tests copy).

Report opens with confirmation these were read.

## Steps

### Step 1 — the failing tests

Create `scripts/tests/37-the-order-chain.mjs` with exactly:

```js
import { ok } from "./harness.mjs";
import { makeWorld, addBody, stepWorld } from "../../src/engine/core.js";
import { stepDrivers } from "../../src/depot/drivers.js";
import { makeSquad, stepSquad } from "../../src/depot/squads.js";
import { spawnSquadMembers } from "../../src/depot/state.js";
import { BISON } from "../../src/depot/specs.js";
import { identFwdDir } from "./shared.mjs";
import fs from "node:fs";

// ==== mk2.90: the order chain ===============================================
// Queued orders pop at the arrival seam: move/attack chain, patrol is
// terminal, an empty chain digs in as today. The hull fixture is the armor
// attack test's own. Seeds 120-123.
{
  console.log("\n[mk2.90: the order chain]");
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
  const mkHull = (w, x, z) => {
    const v = addBody(w, { kind: "vehicle", team: 1, mass: BISON.mass, hx: BISON.hx, hy: BISON.hy, hz: BISON.hz, x, y: BISON.hy + 0.05, z, hp: BISON.hp, friction: 0.85 });
    v.armor = BISON.armor; v.vtype = "bison"; v.drv = "armor"; v.depotDrive = "auto"; v.order = "defend"; v.tracks = "careful";
    v.homeX = x; v.homeZ = z;
    return v;
  };

  // (a) the hull's chain: move A, then a queued patrol — it ends patrolling
  {
    const w = makeWorld({ field: flatF, seed: 120 }); w.depotCombat = true;
    const G = mkGrid();
    const v = mkHull(w, -20, 0);
    w.t = 3;
    v.order = "move"; v.dest = { x: 10, z: 0 };
    v._queue = [{ kind: "patrol", ax: 10, az: 8, bx: 10, bz: -8 }];
    for (let i = 0; i < 10800 && v.order !== "patrol"; i++) { w.t += w.dt; stepDrivers(w, G, identFwdDir, null); stepWorld(w); }
    ok("(a) the hull pops the queued patrol on arrival", v.order === "patrol" && v._patA && Math.abs(v._patA.x - 10) < 0.01 && Math.abs(v._patA.z - 8) < 0.01, `${v.order}`);
    ok("(a) the chain is consumed", !v._queue || v._queue.length === 0, v._queue && `${v._queue.length} left`);
  }

  // (b) the hull's chain of moves: A then B, defend at B when the chain runs dry
  {
    const w = makeWorld({ field: flatF, seed: 121 }); w.depotCombat = true;
    const G = mkGrid();
    const v = mkHull(w, -20, 0);
    w.t = 3;
    v.order = "move"; v.dest = { x: 0, z: 0 };
    v._queue = [{ kind: "move", x: 20, z: 10 }];
    for (let i = 0; i < 10800 && v.order !== "defend"; i++) { w.t += w.dt; stepDrivers(w, G, identFwdDir, null); stepWorld(w); }
    ok("(b) the dry chain digs in at the LAST link", v.order === "defend" && Math.hypot(v.pos.x - 20, v.pos.z - 10) < 6, `${v.order} at ${v.pos.x.toFixed(1)},${v.pos.z.toFixed(1)}`);
  }

  // (c) the squad's chain of moves: A then B, defend at B
  {
    const w = makeWorld({ field: flatF, seed: 122 }); w.depotCombat = true;
    const sq = makeSquad(1, "rifles", 1, -12, 0);
    spawnSquadMembers(w, sq);
    sq.order = "move"; sq.dest = { x: 0, z: 0 };
    sq._queue = [{ kind: "move", x: 12, z: 6 }];
    for (let i = 0; i < 9600 && sq.order !== "defend"; i++) { stepSquad(w, sq, 1 / 60); stepWorld(w); }
    ok("(c) the squad walks the chain and digs in at the last link", sq.order === "defend" && Math.hypot(sq.anchor.x - 12, sq.anchor.z - 6) < 3, `${sq.order} at ${sq.anchor.x.toFixed(1)},${sq.anchor.z.toFixed(1)}`);
    ok("(c) the squad's chain is consumed", !sq._queue || sq._queue.length === 0);
  }

  // (d) the squad's queued patrol is terminal — it patrols, both ends set
  {
    const w = makeWorld({ field: flatF, seed: 123 }); w.depotCombat = true;
    const sq = makeSquad(2, "rifles", 1, -12, 0);
    spawnSquadMembers(w, sq);
    sq.order = "move"; sq.dest = { x: 0, z: 0 };
    sq._queue = [{ kind: "patrol", ax: 0, az: 6, bx: 0, bz: -6 }];
    for (let i = 0; i < 9600 && sq.order !== "patrol"; i++) { stepSquad(w, sq, 1 / 60); stepWorld(w); }
    ok("(d) the squad pops the queued patrol", sq.order === "patrol" && sq._patA && Math.abs(sq._patA.z - 6) < 0.01 && sq._patB && Math.abs(sq._patB.z + 6) < 0.01, sq.order);
  }

  // (e) pins: the chain rides the save explicitly (plainValue drops object arrays)
  const ssrc = fs.readFileSync("src/depot/save.js", "utf8");
  ok("(e) pins: the squad row carries the chain", /o\._queue = sq\._queue\.map\(\(q\) => \(\{ \.\.\.q \}\)\)/.test(ssrc));
  ok("(e) pins: the hull's orders bag carries the chain", /x\._queue = b\._queue\.map\(\(q\) => \(\{ \.\.\.q \}\)\)/.test(ssrc));

  // (f) pins: the mech pops the same chain (its fixture is heavy; the walker
  // shares the seam by these lines)
  const dsrc = fs.readFileSync("src/depot/drivers.js", "utf8");
  ok("(f) pins: the mech honors the chain", /b\._queue && b\._queue\.length/.test(dsrc) && /const q = b\._queue\.shift\(\);/.test(dsrc));
}
```

In `scripts/depot-test.mjs`, after the line

```js
await import("./tests/36-the-screen-select.mjs");
```

insert

```js
await import("./tests/37-the-order-chain.mjs");
```

Run `node scripts/gate.mjs depot-test` as a plain blocking command. Required result: exactly these eight FAIL — both (a), the (b), both (c), the (d), both (e) pins, both (f) pins — that is (a)×2, (b)×1, (c)×2, (d)×1, (e)×2, (f)×2, nine asserts total, ALL NINE failing; every pre-existing test PASSES. Any other pattern stops the task.

### Step 2 — the squad's seam (`src/depot/squads.js`)

Immediately before the arrival-to-defend branch — insert between the patrol-turnaround branch's closing and the line (currently 654) `} else if (dToDest <= ARRIVE_TOL) {` — replace exactly:

```js
    } else if (dToDest <= ARRIVE_TOL) {
      squad.order = "defend";
```

with:

```js
    } else if (dToDest <= ARRIVE_TOL && squad._queue && squad._queue.length) {
      // mk2.90: THE CHAIN — an arrival with queued orders takes the
      // next one instead of digging in. move/attack walk on; a queued patrol
      // lands as acceptLine lands one (both ends set, near end first) and is
      // terminal. The game layer wipes the queue on any plain order, so this
      // branch only ever runs a chain the player built.
      const q = squad._queue.shift();
      squad._legTarget = null; squad._route = null; squad._pauseT = 0; squad._cohesionHoldT = 0; squad._build = null;
      if (q.kind === "patrol") {
        squad._patA = { x: q.ax, z: q.az }; squad._patB = { x: q.bx, z: q.bz };
        squad.order = "patrol"; squad.dest = { x: q.ax, z: q.az };
      } else {
        squad.order = q.kind; squad.dest = { x: q.x, z: q.z };
      }
    } else if (dToDest <= ARRIVE_TOL) {
      squad.order = "defend";
```

### Step 3 — the hull's seam (`src/depot/drivers.js`)

**3a.** In `armorGoal`'s arrival block, replace exactly (currently line 293):

```js
    else { v.order = "defend"; v.dest = null; v.goal = null; return; }
```

with:

```js
    else if (v._queue && v._queue.length) {
      // mk2.90: THE CHAIN — the hull's arrival takes the next queued order.
      const q = v._queue.shift();
      v._route = null; v._routeDest = null; v._stuckN = 0;
      if (q.kind === "patrol") { v._patA = { x: q.ax, z: q.az }; v._patB = { x: q.bx, z: q.bz }; v.order = "patrol"; v.dest = { x: q.ax, z: q.az }; }
      else { v.order = q.kind; v.dest = { x: q.x, z: q.z }; }
      return;
    }
    else { v.order = "defend"; v.dest = null; v.goal = null; return; }
```

**3b.** In `mechGoal`'s arrival block, replace exactly (currently line 522):

```js
    } else { b.order = "defend"; b.dest = null; mechCommand(m, { travel: 0, lateral: 0 }); return; }
```

with:

```js
    } else if (b._queue && b._queue.length) {
      const q = b._queue.shift(); // mk2.90: the chain, in the walker's form
      b._route = null; b._routeDest = null;
      if (q.kind === "patrol") { b._patA = { x: q.ax, z: q.az }; b._patB = { x: q.bx, z: q.bz }; b.order = "patrol"; b.dest = { x: q.ax, z: q.az }; }
      else { b.order = q.kind; b.dest = { x: q.x, z: q.z }; }
      mechCommand(m, { travel: 0, lateral: 0 }); return;
    } else { b.order = "defend"; b.dest = null; mechCommand(m, { travel: 0, lateral: 0 }); return; }
```

### Step 4 — the save ride (`src/depot/save.js`)

**4a.** In `squadRow`, replace exactly (the function's closing, currently lines 241–242):

```js
      o[key] = val;
    }
    return o;
  };
```

with:

```js
      o[key] = val;
    }
    if (sq._queue && sq._queue.length) o._queue = sq._queue.map((q) => ({ ...q })); // mk2.90: the chain rides explicitly — plainValue drops object arrays
    return o;
  };
```

**4b.** In `writeBody`, replace exactly (currently line 123):

```js
  if (any) o.x = x;
```

with:

```js
  if (b._queue && b._queue.length) { x._queue = b._queue.map((q) => ({ ...q })); any = true; } // mk2.90: the hull's chain rides explicitly
  if (any) o.x = x;
```

(readBody's generic `s.x` loop and restoreSquads' generic copy bring both back; no restore edit.)

### Step 5 — gates

Run as plain blocking commands, in order:

- `node scripts/gate.mjs depot-test` — required: Step 1's nine FAILs now PASS, everything else PASSES.
- `node scripts/gate.mjs depot-lint` — required: green.
- `node scripts/gate.mjs smoke` — required: green.

No engine file touched — no golden gate. The sweep license is NOT granted: any pre-existing failure stops the task.

### Step 6 — version, build, land

- `src/version.js`: `mk2.89` → `mk2.90`.
- `npm run build` (after the bump, never before).
- Commit and push. Suggested subject: `the order chain — queued orders pop at the arrival seam, mk2.90`. Include this plan file.

## Acceptance

- Arithmetic: `depot-test` exits 0 with all nine new asserts PASS; `depot-lint` exits 0; `smoke` exits 0. Fixture seeds: 120, 121, 122, 123.
- The owner's live check waits for task 2 — nothing in live play can build a chain yet; this landing is engine-only and invisible on the site beyond the version mark.
