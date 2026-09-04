# The Escort Link (mk2.93)

Task 1 of 2: ESCORT joins the chain as a terminal link on hulls — queue moves and attacks, close the chain with an escort, and the hull falls in behind its squad when it gets there. Task 2 (build lines in chains, mk2.94) is its own plan.

Suggested model: Sonnet 5 — two files plus a test, every code block carried below verbatim.

Design choices, stated:
- The entry is `{ kind: "escort", escortId }` — flat, so it rides mk2.90's save keys untouched.
- Terminal like patrol: accepting it puts the QUEUE light out; nothing chains after it. Appending onto a standing patrol stays refused.
- A dead escort target needs no new code: the pop lands the escort order, and the existing escort branch's next tick finds no squad and digs in — the chain was already empty.
- An escort leg has no ground point, so the flags skip it; the panel row carries it (it already words "ESCORT").
- Squads have no escort order; their seam is untouched. The mech shares the hull's pop.

## Required reading

- This plan, whole.
- `src/depot/drivers.js` lines 285–305 (the hull's pop) and 525–540 (the mech's pop).
- `src/depot/DepotGame.jsx` lines 1440–1460 (the escort tap) and 3095–3110 (the flag projection).
- `scripts/tests/37-the-order-chain.mjs` (the fixture this task's tests copy).

Report opens with confirmation these were read.

## Steps

### Step 1 — the failing tests

Create `scripts/tests/40-the-escort-link.mjs` with exactly:

```js
import { ok } from "./harness.mjs";
import { makeWorld, addBody, stepWorld } from "../../src/engine/core.js";
import { stepDrivers } from "../../src/depot/drivers.js";
import { BISON } from "../../src/depot/specs.js";
import { identFwdDir } from "./shared.mjs";
import fs from "node:fs";

// ==== mk2.93: the escort link ===============================================
// ESCORT closes a hull's chain: the arrival pop hands the hull its squad and
// the escort machinery takes over. The fixture is the order chain's own.
// Seeds 130-131.
{
  console.log("\n[mk2.93: the escort link]");
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
  const toUV = (x, z) => ({ u: x, v: z });

  // (a) move A, queued escort — the hull arrives and falls in behind its squad
  {
    const w = makeWorld({ field: flatF, seed: 130 }); w.depotCombat = true;
    const G = mkGrid();
    const v = mkHull(w, -20, 0);
    const esq = { id: 7, anchor: { x: 30, z: 0 } };
    w.t = 3;
    v.order = "move"; v.dest = { x: 0, z: 0 };
    v._queue = [{ kind: "escort", escortId: 7 }];
    for (let i = 0; i < 10800 && v.order !== "escort"; i++) { w.t += w.dt; stepDrivers(w, G, identFwdDir, null, toUV, { squads: [esq] }); stepWorld(w); }
    ok("(a) the arrival pops the queued escort", v.order === "escort" && v.escortId === 7, `${v.order} / ${v.escortId}`);
    ok("(a) the chain is consumed", !v._queue || v._queue.length === 0);
  }

  // (b) a dead escort target: the pop lands, the escort machinery finds no
  // squad, and the hull digs in — no new code, the existing branch's own end
  {
    const w = makeWorld({ field: flatF, seed: 131 }); w.depotCombat = true;
    const G = mkGrid();
    const v = mkHull(w, -20, 0);
    w.t = 3;
    v.order = "move"; v.dest = { x: 0, z: 0 };
    v._queue = [{ kind: "escort", escortId: 99 }];
    for (let i = 0; i < 10800 && !(v.order === "defend" && (!v._queue || !v._queue.length)); i++) { w.t += w.dt; stepDrivers(w, G, identFwdDir, null, toUV, { squads: [] }); stepWorld(w); }
    ok("(b) a dead target ends the chain in defend", v.order === "defend" && (!v._queue || v._queue.length === 0), v.order);
  }

  // (c) pins: the mech shares the pop; the tap appends terminally; the flags skip it
  const dsrc = fs.readFileSync("src/depot/drivers.js", "utf8");
  ok("(c) pins: the mech pops escort too", /q\.kind === "escort"\) \{ b\.order = "escort"; b\.escortId = q\.escortId;/.test(dsrc));
  const dg = fs.readFileSync("src/depot/DepotGame.jsx", "utf8");
  ok("(c) pins: the escort tap appends and puts the light out", /push\(\{ kind: "escort", escortId: sq\.id \}\);/.test(dg));
  ok("(c) pins: the flags skip the escort leg", /if \(q\.kind === "escort"\) return null;/.test(dg));
}
```

In `scripts/depot-test.mjs`, after the line

```js
await import("./tests/39-the-visible-chain.mjs");
```

insert

```js
await import("./tests/40-the-escort-link.mjs");
```

Run `node scripts/gate.mjs depot-test` blocking. Required result: exactly SIX new asserts FAIL — both (a), the (b), and all three (c) pins — and every pre-existing test PASSES. Any other pattern stops the task.

### Step 2 — the hull's pop (`src/depot/drivers.js`)

Replace exactly (currently lines 297–298):

```js
      if (q.kind === "patrol") { v._patA = { x: q.ax, z: q.az }; v._patB = { x: q.bx, z: q.bz }; v.order = "patrol"; v.dest = { x: q.ax, z: q.az }; }
      else { v.order = q.kind; v.dest = { x: q.x, z: q.z }; }
```

with:

```js
      if (q.kind === "patrol") { v._patA = { x: q.ax, z: q.az }; v._patB = { x: q.bx, z: q.bz }; v.order = "patrol"; v.dest = { x: q.ax, z: q.az }; }
      else if (q.kind === "escort") { v.order = "escort"; v.escortId = q.escortId; v.dest = null; v.goal = null; } // mk2.93: the terminal escort link
      else { v.order = q.kind; v.dest = { x: q.x, z: q.z }; }
```

### Step 3 — the mech's pop (`src/depot/drivers.js`)

Replace exactly (currently lines 533–534):

```js
      if (q.kind === "patrol") { b._patA = { x: q.ax, z: q.az }; b._patB = { x: q.bx, z: q.bz }; b.order = "patrol"; b.dest = { x: q.ax, z: q.az }; }
      else { b.order = q.kind; b.dest = { x: q.x, z: q.z }; }
```

with:

```js
      if (q.kind === "patrol") { b._patA = { x: q.ax, z: q.az }; b._patB = { x: q.bx, z: q.bz }; b.order = "patrol"; b.dest = { x: q.ax, z: q.az }; }
      else if (q.kind === "escort") { b.order = "escort"; b.escortId = q.escortId; b.dest = null; } // mk2.93
      else { b.order = q.kind; b.dest = { x: q.x, z: q.z }; }
```

### Step 4 — the tap (`src/depot/DepotGame.jsx`)

Replace exactly (currently lines 1446–1452):

```js
        if (om === "escort") {
          const sq = squadAtPoint(p);
          if (!sq) { toast("TAP A SQUAD TO ESCORT"); return true; }
          v.order = "escort"; v.escortId = sq.id; v.dest = null; v.goal = null; v._route = null; v._routeDest = null; v._queue = null; // mk2.91
          view.vehOrderMode = null; view.selVehId = null;
          return true;
        }
```

with:

```js
        if (om === "escort") {
          const sq = squadAtPoint(p);
          if (!sq) { toast("TAP A SQUAD TO ESCORT"); return true; }
          // mk2.93: with QUEUE lit and a moving head, ESCORT appends as the
          // chain's terminal link and the light goes out — patrol's own law.
          if (view.queueOn) {
            if (v.order === "patrol") { toast("THE CHAIN ENDS AT A PATROL"); return true; }
            if ((v.order === "move" || v.order === "attack") && v.dest) {
              (v._queue || (v._queue = [])).push({ kind: "escort", escortId: sq.id });
              view.queueOn = false;
              view.vehOrderMode = null;
              return true;
            }
          }
          v.order = "escort"; v.escortId = sq.id; v.dest = null; v.goal = null; v._route = null; v._routeDest = null; v._queue = null; // mk2.91
          view.vehOrderMode = null; view.selVehId = null;
          return true;
        }
```

### Step 5 — the flags skip the escort leg (`src/depot/DepotGame.jsx`)

Replace exactly (currently lines 3100–3101):

```js
              view.chainScreens = chainOwner._queue.map((q, i) => {
                const qx = q.kind === "patrol" ? q.ax : q.x, qz = q.kind === "patrol" ? q.az : q.z;
```

with:

```js
              view.chainScreens = chainOwner._queue.map((q, i) => {
                if (q.kind === "escort") return null; // mk2.93: no ground point — the panel carries it
                const qx = q.kind === "patrol" ? q.ax : q.x, qz = q.kind === "patrol" ? q.az : q.z;
```

(The map's index stays the true queue index, so a later flag's ✗ still deletes the right leg.)

### Step 6 — gates

Run blocking, in order: `node scripts/gate.mjs depot-test` (the six Step-1 asserts PASS, everything else PASSES), `node scripts/gate.mjs depot-lint`, `node scripts/gate.mjs smoke` — all green. No golden gate. The sweep license is NOT granted. Count-pin sweep at plan-writing time: no count pin covers the pop branches, the escort tap, or the flag map.

### Step 7 — version, build, land

- `src/version.js`: `mk2.92` → `mk2.93`.
- `npm run build` (after the bump, never before).
- Commit and push. Suggested subject: `the escort link — the chain ends falling in behind a squad, mk2.93`. Include this plan file.

## Acceptance

- Arithmetic: `depot-test` exits 0 with all six new asserts PASS; `depot-lint` exits 0; `smoke` exits 0. Fixture seeds: 130, 131.
- The owner's live check: select the Bison, light QUEUE, lay a move, tap ESCORT and a squad — the panel reads MOVE then ESCORT, the light goes out; the hull drives the leg and falls in behind the squad. Phone and desktop both.
