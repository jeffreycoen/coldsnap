# The Credit Trail (mk2.95)

Task 1 of 2 for the roster feature. Every kill of an enemy man, vehicle, or mech credits the killer's squad or hull with one. The shooter's identity already rides the depot damage paths (`srcId` on blasts and direct hits, `killerId` on crushes); this task carries it onto the kill event and counts it. No interface — task 2 (the roster panel, mk2.96) shows the numbers.

Suggested model: Sonnet 5 — three files plus a test, every code block carried below verbatim.

Rulings this plan rests on: a kill is an enemy man, vehicle, or mech, one each; structures and bags stay out; the count shows in the roster only.

Design choices, stated:
- Mine, wire, and tower kills credit nobody on the roster — no squad or hull fired them. Trucks are convoy logistics, not a combat kill, and are not counted as victims. Falling-masonry kills credit nobody (the killer id is a stone).
- Friendly fire credits nobody, on either side.
- Team-agnostic: enemy squads and hulls accrue kills through the same function, shown or not.
- The counter (`kills`) is a plain number on the squad and on the hull body: the squad's rides the save's generic squad sweep, the hull's rides the body's generic orders bag — no save edit at all. Old saves resume at zero; the war before the feature is uncounted.
- The credit function lives in `state.js` beside `scoreKill` and is exported, so the suite tests it directly with synthetic events; the tick calls it at the one kill-law site.
- `core.js` is touched (one guarded additive line in the depot-only kill-event block), so the golden gate joins this brief.

## Required reading

- This plan, whole.
- `src/engine/core.js` lines 858–896 (applyDamage's tail, resolveCause, killBody).
- `src/depot/state.js` lines 1700–1730 (scoreKill's opening).
- `src/depot/tick.js` lines 105–130 (the kill-law site) and its state.js import line (line 9).
- `scripts/tests/38-the-chain-builder.mjs` (the pin convention).

Report opens with confirmation these were read.

## Steps

### Step 1 — the failing tests

Create `scripts/tests/42-the-credit-trail.mjs` with exactly:

```js
import { ok } from "./harness.mjs";
import * as ST from "../../src/depot/state.js";
import fs from "node:fs";

// ==== mk2.95: the credit trail ==============================================
// creditKill, tested directly with synthetic kill events — no sim runs, no
// fixture seeds. The pins carry the engine emission and the tick's call.
{
  console.log("\n[mk2.95: the credit trail]");
  const CK = ST.creditKill;
  const mkW = (bodies) => { const m = new Map(); for (const b of bodies || []) m.set(b.id, b); return { byId: m }; };
  const kill = (over) => ({ type: "kill", kind: "unit", team: 2, srcId: undefined, killerId: 0, ...over });

  // (a) a member's shot credits his squad
  {
    const sq = { id: 1, memberIds: [10, 11], kills: 0 };
    const w = mkW([{ id: 10, team: 1, kind: "unit" }]);
    if (CK) CK(w, [sq], null, kill({ srcId: 10 }));
    ok("(a) a member's shot credits his squad", !!CK && sq.kills === 1, CK ? String(sq.kills) : "no creditKill");
  }
  // (b) a hull's shot credits the hull
  {
    const v = { id: 20, team: 1, kind: "vehicle", kills: 0 };
    const w = mkW([v]);
    if (CK) CK(w, [], null, kill({ srcId: 20, kind: "mech" }));
    ok("(b) a hull's shot credits the hull", !!CK && v.kills === 1, CK ? String(v.kills) : "no creditKill");
  }
  // (c) a crush credits through killerId when no shot named a shooter
  {
    const v = { id: 21, team: 1, kind: "vehicle", kills: 0 };
    const w = mkW([v]);
    if (CK) CK(w, [], null, kill({ killerId: 21 }));
    ok("(c) a crush credits through killerId", !!CK && v.kills === 1, CK ? String(v.kills) : "no creditKill");
  }
  // (d) friendly fire credits nobody
  {
    const v = { id: 22, team: 2, kind: "vehicle", kills: 0 };
    const sq = { id: 2, memberIds: [12], kills: 0 };
    const w = mkW([v, { id: 12, team: 1, kind: "unit" }]);
    if (CK) { CK(w, [sq], null, kill({ srcId: 22 })); CK(w, [sq], null, kill({ srcId: 12, team: 1 })); }
    ok("(d) friendly fire credits nobody", !!CK && v.kills === 0 && sq.kills === 0, `${v.kills}/${sq.kills}`);
  }
  // (e) a wall is not a kill
  {
    const sq = { id: 3, memberIds: [13], kills: 0 };
    const w = mkW([{ id: 13, team: 1, kind: "unit" }]);
    if (CK) CK(w, [sq], null, kill({ srcId: 13, kind: "wall" }));
    ok("(e) a wall is not a kill", !!CK && sq.kills === 0, String(sq.kills));
  }
  // (f) the enemy's squads accrue through the same trail
  {
    const fsq = { id: 4, memberIds: [14], kills: 0 };
    const w = mkW([{ id: 14, team: 2, kind: "unit" }]);
    if (CK) CK(w, [], [fsq], kill({ srcId: 14, team: 1 }));
    ok("(f) the enemy's squads accrue too", !!CK && fsq.kills === 1, String(fsq.kills));
  }
  // (g) pins: the engine names the shooter on the kill event, depot-gated
  const cs = fs.readFileSync("src/engine/core.js", "utf8");
  ok("(g) pins: the kill event carries srcId under depotCombat", /if \(info\.srcId != null\) ev\.srcId = info\.srcId;/.test(cs));
  // (h) pins: the tick credits at the kill-law site
  const ts = fs.readFileSync("src/depot/tick.js", "utf8");
  ok("(h) pins: the tick credits beside the score", /creditKill\(world, run\.squads, run\.foeSquads, e\);/.test(ts));
}
```

In `scripts/depot-test.mjs`, after the line

```js
await import("./tests/41-the-queued-line.mjs");
```

insert

```js
await import("./tests/42-the-credit-trail.mjs");
```

Run `node scripts/gate.mjs depot-test` blocking. Required result: exactly EIGHT new asserts FAIL — (a) through (f) and both pins — and every pre-existing test PASSES. (Pre-fix, `ST.creditKill` is undefined; every behavior assert's `!!CK` term fails cleanly, and both pins miss.) Any other pattern stops the task.

### Step 2 — the engine names the shooter (`src/engine/core.js`)

In `killBody`'s depot-gated block, replace exactly (currently lines 887–891):

```js
  if (world.depotCombat) {
    ev.team = b.team; ev.tag = b.tag; ev.utype = b.utype;
    ev.vtype = b.vtype; ev.towerType = b.towerType;
    if (b.sandbag) { ev.sandbag = 1; ev.bagSide = b.bagSide || 1; }
  }
```

with:

```js
  if (world.depotCombat) {
    ev.team = b.team; ev.tag = b.tag; ev.utype = b.utype;
    ev.vtype = b.vtype; ev.towerType = b.towerType;
    if (b.sandbag) { ev.sandbag = 1; ev.bagSide = b.bagSide || 1; }
    // mk2.95: the kill names its shooter (the srcId the damage paths carry)
    // so the game layer can credit the killer's squad or hull.
    if (info.srcId != null) ev.srcId = info.srcId;
  }
```

### Step 3 — the credit function (`src/depot/state.js`)

Immediately before the line (currently 1703)

```js
export function scoreKill(S, ev, counts) {
```

insert:

```js
// mk2.95: THE CREDIT TRAIL — a kill of an enemy man, vehicle, or
// mech credits the killer's squad or hull with one. Structures, bags, and
// trucks are not kills; mines, wires, towers, and falling stone credit
// nobody on the roster; friendly fire credits nobody. Team-agnostic — the
// enemy's squads (foeSquads) accrue through the same trail.
export function creditKill(world, squads, foeSquads, ev) {
  if (ev.type !== "kill") return;
  if (ev.kind !== "unit" && ev.kind !== "vehicle" && ev.kind !== "mech") return;
  const kid = ev.srcId != null ? ev.srcId : ev.killerId;
  if (!kid) return;
  const kb = world.byId.get(kid);
  if (kb && (kb.kind === "vehicle" || kb.kind === "mech")) {
    if (kb.team !== ev.team) kb.kills = (kb.kills || 0) + 1;
    return;
  }
  if (ev.team !== 1 && squads) for (const sq of squads) if (sq.memberIds.includes(kid)) { sq.kills = (sq.kills || 0) + 1; return; }
  if (ev.team !== 2 && foeSquads) for (const sq of foeSquads) if (sq.memberIds.includes(kid)) { sq.kills = (sq.kills || 0) + 1; return; }
}
```

### Step 4 — the tick credits (`src/depot/tick.js`)

**4a.** Replace exactly (currently line 9):

```js
import { stepBell, nextSpawnTag, withdrawDue, executeWithdrawal, checkLoss, stampEnd, stepDepotCensus, depotStandingFraction, possessedVolley, possessedTowerFire, scoreKill } from "./state.js";
```

with:

```js
import { stepBell, nextSpawnTag, withdrawDue, executeWithdrawal, checkLoss, stampEnd, stepDepotCensus, depotStandingFraction, possessedVolley, possessedTowerFire, scoreKill, creditKill } from "./state.js";
```

**4b.** Replace exactly (currently line 120):

```js
    scoreKill(run, e, run._market ? run._market.counts : null);
```

with:

```js
    scoreKill(run, e, run._market ? run._market.counts : null);
    creditKill(world, run.squads, run.foeSquads, e); // mk2.95: the killer's squad or hull takes its one
```

### Step 5 — gates

Run blocking, in order:

- `node scripts/gate.mjs depot-test` — required: the eight Step-1 asserts PASS, everything else PASSES.
- `node scripts/gate.mjs golden` — required: green (`core.js` touched; the new line is gated on `depotCombat` and no demo world sets it).
- `node scripts/gate.mjs depot-lint` — required: green.
- `node scripts/gate.mjs smoke` — required: green.

The sweep license is NOT granted. Plan-writing sweeps ran clean: no count pin and no literal pin in the suite covers the killBody block, the scoreKill site, or the tick import line.

### Step 6 — version, build, land

- `src/version.js`: `mk2.94` → `mk2.95`.
- `npm run build` (after the bump, never before).
- Commit and push. Suggested subject: `the credit trail — every kill names its shooter and his unit takes one, mk2.95`. Include this plan file.

## Acceptance

- Arithmetic: `depot-test` exits 0 with all eight new asserts PASS; `golden` exits 0; `depot-lint` exits 0; `smoke` exits 0. No fixture seeds — synthetic events, no sim runs.
- The owner's live check waits for task 2 — nothing shows the numbers yet; this landing is invisible on the site beyond the version mark.
