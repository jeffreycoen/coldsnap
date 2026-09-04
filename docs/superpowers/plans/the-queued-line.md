# The Queued Line (mk2.94)

Task 2 of 2: engineer and sapper build lines join the chain, mid-chain — walk there, lay the line, walk on. On short scrap the squad stands at its arrival point until the whole line's price is covered, then lays (the owner's ruling, 2026-09-03). Hulls have no lines; their side is untouched.

Suggested model: Sonnet 5 — three files plus a test, every code block carried below verbatim.

Design choices, stated:
- The entry is `{ kind: "line", line: "bags"|"walls"|"mines"|"wires", ax, az, bx, bz }` — flat, rides mk2.90's save keys untouched. `line` uses the short names `startBuildLine` already takes.
- The squad module is barred from economy and placement, so its seam never pops a line entry — it digs the squad in, and a game-layer hook (installed beside the existing build driver, called by the sim at tick cadence for determinism) sees the line at the chain's head, prices it with the same `linePieces` arithmetic the pending-line preview uses, waits while scrap is short, then shifts the entry and starts the line. Laying itself is the existing machinery, including its own mid-line dry stop.
- The append happens where a line becomes real today — the accept of the proposed line — under the QUEUE light with a moving head. The plain accept path gains the chain wipe it was missing (a mk2.91 gap: a plain build line did not wipe a standing chain).
- Line legs flag at their start point (▤); the panel words them BAGS / WALLS / MINES / WIRE.
- The QUEUE light stays lit after a queued line — lines are mid-chain, not terminal.

## Required reading

- This plan, whole.
- `src/depot/squads.js` lines 645–675 (the seam).
- `src/depot/sim.js` lines 600–630 (the per-squad tick).
- `src/depot/DepotGame.jsx` lines 570–580 (the input hooks), 1250–1340 (the line preview, acceptLine, the driver install), 3105–3120 (the flag map), 3218–3228 (the panel words), 4020–4030 (the flag JSX).
- `src/depot/buildlines.js` lines 72–135 (startBuildLine, linePieces).

Report opens with confirmation these were read.

## Steps

### Step 1 — the failing tests

Create `scripts/tests/41-the-queued-line.mjs` with exactly:

```js
import { ok } from "./harness.mjs";
import { makeWorld, stepWorld } from "../../src/engine/core.js";
import { makeSquad, stepSquad } from "../../src/depot/squads.js";
import { spawnSquadMembers } from "../../src/depot/state.js";
import fs from "node:fs";

// ==== mk2.94: the queued line ===============================================
// A line entry never pops in the squad module — the squad digs in on arrival
// and the entry waits for the game layer's hook. Seed 140. The hook itself
// is interface-side; the pins carry it.
{
  console.log("\n[mk2.94: the queued line]");
  const flatF = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } };

  // (a) the seam leaves a line entry alone: arrive, dig in, entry kept
  {
    const w = makeWorld({ field: flatF, seed: 140 }); w.depotCombat = true;
    const sq = makeSquad(1, "engineers", 1, -12, 0);
    spawnSquadMembers(w, sq);
    sq.order = "move"; sq.dest = { x: 0, z: 0 };
    sq._queue = [{ kind: "line", line: "bags", ax: 2, az: 0, bx: 8, bz: 0 }];
    for (let i = 0; i < 9600 && sq.order !== "defend"; i++) { stepSquad(w, sq, 1 / 60); stepWorld(w); }
    ok("(a) the squad digs in at the line's doorstep", sq.order === "defend" && Math.hypot(sq.anchor.x, sq.anchor.z) < 3, `${sq.order} at ${sq.anchor.x.toFixed(1)},${sq.anchor.z.toFixed(1)}`);
    ok("(a) the line entry waits for the game layer", sq._queue && sq._queue.length === 1 && sq._queue[0].kind === "line", sq._queue ? `${sq._queue.length} left` : "gone");
  }

  // (b) pins: the game-layer hook, its wiring, and the interface
  const dg = fs.readFileSync("src/depot/DepotGame.jsx", "utf8");
  ok("(b) pins: the hook prices the line and waits", /input\.stepChainBuild = \(sq\) => \{/.test(dg) && /if \(run\.resources < price\) return; \/\/ stand and wait/.test(dg));
  ok("(b) pins: the hook starts the line it shifts", /sq\._queue\.shift\(\); if \(!sq\._queue\.length\) sq\._queue = null;\n\s*startBuildLine\(grid, sq, q\.line, a, b, toast\);/.test(dg));
  ok("(b) pins: the accept appends under the light", /push\(\{ kind: "line", line: lp\.kind, ax: lp\.a\.x, az: lp\.a\.z, bx: lp\.b\.x, bz: lp\.b\.z \}\);/.test(dg));
  ok("(b) pins: the plain line wipes the chain", /startBuildLine\(grid, sq, lp\.kind, lp\.a, lp\.b, toast\); sq\._queue = null;/.test(dg));
  ok("(b) pins: the flags mark the line's start", /line: q\.kind === "line" \? 1 : 0/.test(dg) && /f\.line \? "▤"/.test(dg));
  const ss = fs.readFileSync("src/depot/sim.js", "utf8");
  ok("(b) pins: the sim calls the hook at tick cadence", /if \(!sq\._build && input\.stepChainBuild\) input\.stepChainBuild\(sq\);/.test(ss));
  const sqs = fs.readFileSync("src/depot/squads.js", "utf8");
  ok("(b) pins: the seam refuses line entries", /squad\._queue\.length && squad\._queue\[0\]\.kind !== "line"\) \{/.test(sqs));
}
```

In `scripts/depot-test.mjs`, after the line

```js
await import("./tests/40-the-escort-link.mjs");
```

insert

```js
await import("./tests/41-the-queued-line.mjs");
```

Run `node scripts/gate.mjs depot-test` blocking. Required result: exactly NINE new asserts FAIL — both (a) and all seven (b) pins — and every pre-existing test PASSES. (Pre-fix, the seam pops the line entry generically: the order becomes the dead string "line" and the squad never reaches defend, so both (a) asserts fail.) Any other pattern stops the task.

### Step 2 — the seam refuses line entries (`src/depot/squads.js`)

Replace exactly (currently line 654):

```js
    } else if (dToDest <= ARRIVE_TOL && squad._queue && squad._queue.length) {
```

with:

```js
    } else if (dToDest <= ARRIVE_TOL && squad._queue && squad._queue.length && squad._queue[0].kind !== "line") {
      // mk2.94: a line entry is the game layer's to start (economy and
      // placement are barred here) — the squad digs in and the hook takes it.
```

### Step 3 — the sim calls the hook (`src/depot/sim.js`)

Replace exactly (currently line 619):

```js
      if (sq._build && input.stepBuildLine) input.stepBuildLine(sq);
```

with:

```js
      if (sq._build && input.stepBuildLine) input.stepBuildLine(sq);
      // mk2.94: the chain's queued line starts game-side — priced, waited
      // on, and started by the hook DepotGame installs beside the driver.
      if (!sq._build && input.stepChainBuild) input.stepChainBuild(sq);
```

### Step 4 — the hook and the input slot (`src/depot/DepotGame.jsx`)

**4a.** Replace exactly (currently line 574):

```js
        releasePossession: null, stepBuildLine: null, stepFoeBuildLine: null,
```

with:

```js
        releasePossession: null, stepBuildLine: null, stepFoeBuildLine: null, stepChainBuild: null,
```

**4b.** Replace exactly (currently line 1332):

```js
      input.stepBuildLine = (sq) => stepBuildLine(world, grid, field, T, run, sq, layCtx, toast, map);
```

with:

```js
      input.stepBuildLine = (sq) => stepBuildLine(world, grid, field, T, run, sq, layCtx, toast, map);
      // mk2.94: THE QUEUED LINE — when the chain's next leg is a
      // line, the squad stands at its arrival point until the scrap covers
      // the WHOLE line (the pending-preview's own arithmetic), then the
      // entry shifts and the line starts. Mid-line dryness keeps its own
      // law ("THE LINE STOPS HERE") — this gate is the start, not the laying.
      input.stepChainBuild = (sq) => {
        if (sq._build || sq.order !== "defend" || !sq._queue || !sq._queue.length || sq._queue[0].kind !== "line") return;
        const q = sq._queue[0];
        const a = { x: q.ax, z: q.az }, b = { x: q.bx, z: q.bz };
        const pieces = linePieces(grid, field, T, q.line, a, b, map);
        const fp = run._market ? fieldPrices(run._market.counts, WALL_FIELD_COST, SANDBAG_FIELD_COST) : { wall: WALL_FIELD_COST, bag: SANDBAG_FIELD_COST };
        const mp = run._minePrices || { mine: MINE_COST, wire: WIRE_COST };
        const price = q.line === "walls" ? pieces.length * fp.wall
                    : q.line === "bags" ? pieces.length * fp.bag
                    : q.line === "mines" ? pieces.length * mp.mine
                    : pieces.length * mp.wire;
        if (run.resources < price) return; // stand and wait — The design: 
        sq._queue.shift(); if (!sq._queue.length) sq._queue = null;
        startBuildLine(grid, sq, q.line, a, b, toast);
      };
```

### Step 5 — the accept appends, the plain accept wipes (`src/depot/DepotGame.jsx`)

Replace exactly (currently line 1319):

```js
          else startBuildLine(grid, sq, lp.kind, lp.a, lp.b, toast);
```

with:

```js
          else if (view.queueOn && (sq.order === "move" || sq.order === "attack" || sq.order === "build") && sq.dest) {
            // mk2.94: the queued line — the chain carries it to the ground;
            // the light STAYS lit (a line is mid-chain, not terminal).
            (sq._queue || (sq._queue = [])).push({ kind: "line", line: lp.kind, ax: lp.a.x, az: lp.a.z, bx: lp.b.x, bz: lp.b.z });
          }
          else { startBuildLine(grid, sq, lp.kind, lp.a, lp.b, toast); sq._queue = null; } // mk2.94: a plain line wipes the chain
```

### Step 6 — the flags and the panel (`src/depot/DepotGame.jsx`)

**6a.** Replace exactly (currently lines 3113 and 3115, quoted with their neighbor):

```js
                const qx = q.kind === "patrol" ? q.ax : q.x, qz = q.kind === "patrol" ? q.az : q.z;
                const nd7 = R.project(qx, field.heightAt(qx, qz) + 1.6, qz);
                return nd7 ? { x: rect7.left + (nd7.x * 0.5 + 0.5) * rect7.width, y: rect7.top + (-nd7.y * 0.5 + 0.5) * rect7.height, i, pat: q.kind === "patrol" ? 1 : 0 } : null;
```

with:

```js
                const qx = q.kind === "patrol" || q.kind === "line" ? q.ax : q.x, qz = q.kind === "patrol" || q.kind === "line" ? q.az : q.z;
                const nd7 = R.project(qx, field.heightAt(qx, qz) + 1.6, qz);
                return nd7 ? { x: rect7.left + (nd7.x * 0.5 + 0.5) * rect7.width, y: rect7.top + (-nd7.y * 0.5 + 0.5) * rect7.height, i, pat: q.kind === "patrol" ? 1 : 0, line: q.kind === "line" ? 1 : 0 } : null;
```

**6b.** Replace exactly (currently line 3224):

```js
                return { active: w(o.order || "defend"), legs: (o._queue || []).map((q) => w(q.kind)) };
```

with:

```js
                return { active: w(o.order || "defend"), legs: (o._queue || []).map((q) => q.kind === "line" ? (q.line === "walls" ? "WALLS" : q.line === "bags" ? "BAGS" : q.line === "mines" ? "MINES" : "WIRE") : w(q.kind)) };
```

**6c.** Replace exactly (currently line 4026):

```js
          {f.pat ? "⇄" : "⚑"}<div style={{ fontSize: 10, lineHeight: "10px" }}>{f.i + 1}</div>
```

with:

```js
          {f.line ? "▤" : f.pat ? "⇄" : "⚑"}<div style={{ fontSize: 10, lineHeight: "10px" }}>{f.i + 1}</div>
```

### Step 7 — gates

Run blocking, in order: `node scripts/gate.mjs depot-test` (the nine Step-1 asserts PASS, everything else PASSES), `node scripts/gate.mjs depot-lint`, `node scripts/gate.mjs smoke` — all green. No golden gate. The sweep license is NOT granted. Count-pin sweep at plan-writing time: no count pin covers the seam, the hook, the accept, the flags, or the panel.

### Step 8 — version, build, land

- `src/version.js`: `mk2.93` → `mk2.94`.
- `npm run build` (after the bump, never before).
- Commit and push. Suggested subject: `the queued line — build lines ride the chain, priced at the doorstep, mk2.94`. Include this plan file.

## Acceptance

- Arithmetic: `depot-test` exits 0 with all nine new asserts PASS; `depot-lint` exits 0; `smoke` exits 0. Fixture seed: 140.
- The owner's live check: engineers, QUEUE lit — a move leg, then a bag line's two taps and accept, then another move; the panel reads MOVE · BAGS · MOVE, the ▤ flag stands at the line's start; the squad walks, lays, walks on. Drain the scrap first and the squad stands at the line's doorstep until the price is covered. Phone and desktop both.
