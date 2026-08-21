# P7.1 Task 2 — The radial audit (mk1.61)

*HISTORY (stamped 2026-08-20, owner's order): this document is a record of shipped work, not authority. Design truth lives in CLAUDE.md and the ACTIVE phase's plan documents; where this file disagrees with them, it is wrong.*

Every wedge on every pie, verified working. The instrument is one new era file in the test suite: a behavior matrix driving the real machinery per wedge per type, plus wiring pins proving each wedge's tap reaches its handler. Whatever fails IS the defect list — this task fixes nothing. A clean matrix lands as mk1.61; any red row stops the task and the list goes to the owner, who rules the fixes (Phase B, its own amendment).

**Rulings executed here** (decision record, 2026-08-19): existing buttons only; the shelved vocabulary stays shelved.

**Suggested model:** Sonnet — the matrix is fully written below; the agent transcribes, runs, and reports.

## The wedge inventory (what "every button" means)

- **Squad pie** — DEFEND, MOVE, ATTACK, TAKE CONTROL on all 8 types (sniper, rifles, mg, sappers, mortars, engineers, runners, breakers); PATROL on the 6 non-tool types; STRUCTURES on the 6 armed types; BAGS/WALLS on engineers; MINES/WIRES on sappers.
- **Tower pie** — CAREFUL/FREE (not frost), TAKE CONTROL (gun towers), SELL (all).
- **Vehicle pie** — DEFEND, MOVE, PATROL, ESCORT, TRACKS, TAKE CONTROL on both hulls; LOAD/UNLOAD on the APC.

Already pinned by the suite and NOT re-proven here: vehicle DEFEND/MOVE/route/TRACKS/ESCORT/guns (07 T2 a–f), boarding/unload (07 T4), bag lines (09 T20), squad patrol single-type, possession drive/volley single-type (era 04). The matrix adds the per-type BREADTH and the wiring pins.

**Correct-by-design rows** (asserted as correct, never defects): engineers/sappers volley nothing under possession; frost refuses TAKE CONTROL fire (no gun); engineers/sappers carry no PATROL/STRUCTURES wedge.

**Out of scope:** the frost tower's dead slow-aura (ruled: reworked at ARMS — its radial carries no gun wedge, so it is not a button defect). SELL's behavior is mount-closure code — wiring-pinned here, accepted by the owner's play.

## Required reading, in order

1. `docs/superpowers/plans/p7-1-task-2-radial-audit.md` — this plan, whole.
2. `src/depot/DepotGame.jsx:3676-3829` — the three pies (slot keys and acts).
3. `src/depot/DepotGame.jsx:1526-1710` — S.orderVehicle, S.toggleTracks, S.unloadVehicle, S.takeControlVehicle, S.orderSquad, S.toggleStructFirst, S.takeControl, S.takeControlTower.
4. `src/depot/DepotGame.jsx:1902-1946` — sellAt/sellById/setTowerDiscipline.
5. `src/depot/squads.js` — whole (the order machine).
6. `src/depot/state.js:500-700` — squadFire, possessedVolley, possessedTowerFire.
7. `src/depot/drivers.js` and `src/depot/transports.js` — whole.
8. `src/depot/buildlines.js` — whole.
9. `scripts/tests/harness.mjs`, `scripts/tests/shared.mjs` — whole.
10. `scripts/tests/07-armor-demolition.mjs:90-160` — the mkVeh/mkGrid/run idioms.
11. `scripts/tests/09-reorg.mjs:106-160` — the T20 build-line fixture (this plan's Step 6 mirrors it).
12. `scripts/depot-test.mjs` — the runner.

## Trap notes

- **No `src/` file is edited in this task.** The green path touches `scripts/tests/10-command-refit.mjs` (new), `scripts/depot-test.mjs` (one import line), `src/version.js` (the bump). Nothing else.
- **A red matrix row is a FINDING, not a bug to fix.** Do not fix, do not weaken the assert, do not commit. Stop, report the defect list row by row.
- Import order is execution order: the new file imports LAST, after `09-reorg.mjs`, before `finish()`.
- Do not call `makeMap` in the new file — every fixture below is a mini-grid or flat-field world; mapgen's module state stays wherever era 05/07 left it.
- `world.events` never clears headlessly — count by slicing from a recorded start index.
- Mortars reload at 6.0s — every fire fixture runs at least 8 sim-seconds.
- The suite count moves (1312 → 1312 + the new asserts). Report the exact new total; zero movement in the existing 1312 is the law.
- `depot-lint` scopes `src/depot` — the test file is free ground (but still no `Math.random`; fixtures that need dice use seeded worlds).

## Steps

**Step 1 — the file.** Create `scripts/tests/10-command-refit.mjs` opening with:

```js
// P7.1 T2 (mk1.61): THE RADIAL AUDIT — every wedge on every pie, behavior
// per type through the real machinery, wiring pinned tap-to-handler.
// Correct-by-design rows are asserted as correct (tool squads volley
// nothing; frost mans no gun). A FAIL here is an audit finding.
import { ok } from "./harness.mjs";
import { identFwdDir } from "./shared.mjs";
import { makeWorld, makeField, addBody, stepWorld } from "../../src/engine/core.js";
import { SQUAD_SPECS, makeSquad, stepSquad, drivePossessedSquad, squadSpeed } from "../../src/depot/squads.js";
import { spawnSquadMembers, squadFire, possessedVolley, possessedTowerFire, spawnSandbag } from "../../src/depot/state.js";
import { TOWER_SPECS, INFANTRY_ARMS, BISON, APC } from "../../src/depot/specs.js";
import { spawnUnit } from "../../src/depot/units.js";
import { stepDrivers } from "../../src/depot/drivers.js";
import { makeTerritory } from "../../src/depot/territory.js";
import { startBuildLine, stepBuildLine } from "../../src/depot/buildlines.js";
import fs from "node:fs";

const flatF = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (x, z, o) => { o.x = 0; o.y = 1; o.z = 0; return o; } };
const ARMED = ["sniper", "rifles", "mg", "mortars", "runners", "breakers"];
const TOOLS = ["engineers", "sappers"];
const ALL = [...ARMED, ...TOOLS];
```

**Step 2 — DEFEND and MOVE, all eight types.**

```js
// ---- AUDIT (a/b): DEFEND holds the ring; MOVE arrives and digs in — all 8
for (const type of ALL) {
  const w = makeWorld({ field: flatF, seed: 21 }); w.depotCombat = true;
  const sq = makeSquad(1, type, 1, 0, 0);
  spawnSquadMembers(w, sq);
  for (let i = 0; i < 120 * 10; i++) { stepSquad(w, sq, w.dt); stepWorld(w); }
  const far = sq.memberIds.map((id) => w.byId.get(id)).filter((u) => u && u.alive)
    .some((u) => Math.hypot(u.pos.x - sq.anchor.x, u.pos.z - sq.anchor.z) > 5);
  ok(`audit(a) DEFEND ${type}: the ring holds, nobody drifts`, !far && sq.memberIds.length === SQUAD_SPECS[type].n);
  sq.order = "move"; sq.dest = { x: 0, z: 24 };
  let arrived = false;
  for (let i = 0; i < 120 * 45 && !arrived; i++) { stepSquad(w, sq, w.dt); stepWorld(w); arrived = sq.order === "defend"; }
  ok(`audit(b) MOVE ${type}: arrives within 45s and digs in`, arrived);
}
```

**Step 3 — ATTACK fires at the halt; PATROL turns around.**

```js
// ---- AUDIT (c): ATTACK + the held halt fires — the 6 armed types
for (const type of ARMED) {
  const w = makeWorld({ field: flatF, seed: 22 }); w.depotCombat = true;
  const sq = makeSquad(1, type, 1, 0, 0);
  spawnSquadMembers(w, sq);
  spawnUnit(w, { x: 0, z: 10 }, "");
  sq.order = "attack"; sq.dest = { x: 0, z: 30 };
  const ev0 = w.events.length;
  for (let i = 0; i < 120 * 9; i++) { sq._pauseT = 0.5; stepSquad(w, sq, w.dt); squadFire(w, sq, w.dt, null); stepWorld(w); }
  const muzzles = w.events.slice(ev0).filter((e) => e.type === "muzzle").length;
  ok(`audit(c) ATTACK ${type}: the halted squad fires`, muzzles > 0, `${muzzles} muzzles`);
}
// ---- AUDIT (d): PATROL loops forever — the 6 patrol-carrying types
for (const type of ARMED) {
  const w = makeWorld({ field: flatF, seed: 23 }); w.depotCombat = true;
  const sq = makeSquad(1, type, 1, 0, 0);
  spawnSquadMembers(w, sq);
  sq._patA = { x: 0, z: 0 }; sq._patB = { x: 0, z: 14 };
  sq.order = "patrol"; sq.dest = { x: 0, z: 14 };
  let flips = 0, lastZ = 14;
  for (let i = 0; i < 120 * 60 && flips < 2; i++) {
    stepSquad(w, sq, w.dt); stepWorld(w);
    if (sq.dest && sq.dest.z !== lastZ) { flips++; lastZ = sq.dest.z; }
  }
  ok(`audit(d) PATROL ${type}: there and back — two turnarounds`, flips >= 2, `${flips} flips`);
}
```

**Step 4 — STRUCTURES reorders the scan.**

```js
// ---- AUDIT (e): STRUCTURES — prefStruct works masonry first, off works men first
for (const type of ARMED) {
  const first = (pref) => {
    const w = makeWorld({ field: flatF, seed: 24 }); w.depotCombat = true;
    const sq = makeSquad(1, type, 1, 0, 0);
    spawnSquadMembers(w, sq);
    sq.prefStruct = pref;
    const wall = addBody(w, { kind: "wall", team: 2, mass: 0, hx: 0.9, hy: 0.9, hz: 0.35, x: 8, y: 0.9, z: 0, hp: 70 });
    spawnUnit(w, { x: -8, z: 0 }, "");
    const ev0 = w.events.length;
    for (let i = 0; i < 120 * 9; i++) { squadFire(w, sq, w.dt, null); stepWorld(w); const m = w.events.slice(ev0).find((e) => e.type === "muzzle"); if (m) return m.dx; }
    return 0;
  };
  ok(`audit(e) STRUCTURES ${type}: on — masonry first`, first(true) > 0);
  ok(`audit(e2) STRUCTURES ${type}: off — the man first`, first(false) < 0);
}
```

**Step 5 — TAKE CONTROL, squads and towers.**

```js
// ---- AUDIT (f): possession — the stick drives every type; the volley arms the armed
for (const type of ALL) {
  const w = makeWorld({ field: flatF, seed: 25 }); w.depotCombat = true;
  const sq = makeSquad(1, type, 1, 0, 0);
  spawnSquadMembers(w, sq);
  for (let i = 0; i < 240; i++) { drivePossessedSquad(w, sq, 1, 0, w.dt); stepWorld(w); }
  ok(`audit(f) TAKE CONTROL ${type}: the stick moves the squad`, sq.anchor.x > squadSpeed(type), sq.anchor.x.toFixed(1));
  const fired = possessedVolley(w, sq, { x: sq.anchor.x + 6, z: 0 }, null);
  if (TOOLS.includes(type)) ok(`audit(f2) ${type}: tools volley nothing (by design)`, fired === 0);
  else ok(`audit(f2) ${type}: the volley fires`, fired > 0, `${fired}`);
}
// ---- AUDIT (g): possessed towers — every gun mans; frost refuses (no gun)
for (const tt of ["mg", "gun", "mortar", "rocket", "frost"]) {
  const w = makeWorld({ field: flatF, seed: 26 }); w.depotCombat = true;
  const spec = TOWER_SPECS[tt];
  const b = addBody(w, { kind: "tower", team: 1, mass: 0, hx: 0.8, hy: spec.hy, hz: 0.8, x: 0, y: spec.hy, z: 0, hp: spec.hp });
  b.towerType = tt;
  const shot = possessedTowerFire(w, b, { x: 0, z: 10 }, null);
  if (tt === "frost") ok("audit(g) frost: TAKE CONTROL is refused (no gun, by design)", shot === false);
  else ok(`audit(g) tower ${tt}: manual fire control fires`, shot === true && b.fireCd > 0);
}
```

**Step 6 — the four build-line kinds through the real driver.** Mirror the T20 fixture (`09-reorg.mjs:106-160`) exactly — same `flatF20`-style field, same `mkGrid20` mini-grid, same member placement along the line, same `T = makeTerritory(90, 90); T.v.fill(1)` — parameterized over kind, run once per row of this table, with the squad type the pie actually gates the kind to:

| kind | squad type | assert |
|------|-----------|--------|
| `"bags"` | engineers | ≥3 live sandbag bodies; resources charged |
| `"walls"` | engineers | ≥9 live wall bodies (3 courses per cell, ≥3 cells); resources charged |
| `"mines"` | sappers | ≥3 rows in `S.mines`, kind `"mine"`, live; resources charged |
| `"wires"` | sappers | ≥3 rows in `S.mines`, kind `"wire"`, live; resources charged |

Assert names: `audit(h) BAGS/WALLS/MINES/WIRES lay through the real driver`. The fixture's S-object carries `resources: 500, mines: [], sandbagOrient: 0, _market: null, _minePrices: null, squads: [sq]`; ctx carries the T20 no-op stamps.

**Step 7 — the APC patrols.**

```js
// ---- AUDIT (i): APC PATROL — the transport loops like the Bison does
{
  const w = makeWorld({ field: flatF, seed: 27 }); w.depotCombat = true;
  const v = addBody(w, { kind: "vehicle", team: 1, mass: APC.mass, hx: APC.hx, hy: APC.hy, hz: APC.hz, x: 0, y: APC.hy + 0.05, z: -14, hp: APC.hp, friction: 0.85 });
  v.armor = APC.armor; v.vtype = "apc"; v.drv = "apc"; v.depotDrive = "auto"; v.tracks = "careful";
  v._patA = { x: 0, z: -14 }; v._patB = { x: 0, z: 14 };
  v.order = "patrol"; v.dest = { x: 0, z: 14 };
  const grid = /* the 07-era mkGrid idiom, 30x30 cs 2, no blocks — copy it verbatim from 07-armor-demolition.mjs:90-101 as a local helper */ mkGridA();
  let flips = 0, lastZ = 14;
  for (let i = 0; i < 120 * 60 && flips < 2; i++) {
    stepDrivers(w, grid, identFwdDir, null, (x, z) => ({ u: x, v: z }), {});
    stepWorld(w);
    if (v.dest && v.dest.z !== lastZ) { flips++; lastZ = v.dest.z; }
  }
  ok("audit(i) APC PATROL: two turnarounds", flips >= 2, `${flips} flips`);
}
```

(`mkGridA` is the era-07 `mkGrid` helper copied verbatim into this file as a module-local — era files never import each other's block-scoped helpers.)

**Step 8 — the wiring pins.** Every wedge's tap reaches its handler — regex over the live source:

```js
// ---- AUDIT (j): THE WIRING — every wedge's act calls its handler
{
  const src = fs.readFileSync("src/depot/DepotGame.jsx", "utf8");
  const pin = (name, re) => ok(`audit(j) wiring: ${name}`, re.test(src));
  // squad pie
  pin("DEFEND -> orderSquad", /key: "defend", .*S\.orderSquad\("defend"\)/);
  pin("MOVE -> orderSquad", /key: "move", .*orderSquad\("move"\)/);
  pin("ATTACK -> orderSquad", /key: "attack", .*orderSquad\("attack"\)/);
  pin("PATROL -> orderSquad", /key: "patrol", .*orderSquad\("patrol"\)/);
  pin("STRUCTURES -> toggleStructFirst", /key: "structures", .*toggleStructFirst\(\)/);
  pin("BAGS -> orderSquad", /key: "build_bags", .*orderSquad\("build_bags"\)/);
  pin("WALLS -> orderSquad", /key: "build_walls", .*orderSquad\("build_walls"\)/);
  pin("MINES -> orderSquad", /key: "build_mines", .*orderSquad\("build_mines"\)/);
  pin("WIRES -> orderSquad", /key: "build_wires", .*orderSquad\("build_wires"\)/);
  pin("squad TAKE CONTROL -> takeControl", /key: "possess", .*S\.takeControl\(\)/);
  // tower pie
  pin("CAREFUL/FREE -> setTowerDiscipline", /key: "discipline",[\s\S]{0,400}?setTowerDiscipline\(tr\.id\)/);
  pin("tower TAKE CONTROL -> takeControlTower", /key: "possess",[\s\S]{0,400}?takeControlTower\(tr\.id\)/);
  pin("SELL -> sellById", /key: "sell",[\s\S]{0,400}?sellById\(tr\.id\)/);
  // vehicle pie
  pin("veh DEFEND -> orderVehicle", /key: "defend", .*orderVehicle\("defend"\)/);
  pin("veh MOVE -> orderVehicle", /key: "move", .*orderVehicle\("move"\)/);
  pin("veh PATROL -> orderVehicle", /key: "patrol", .*orderVehicle\("patrol"\)/);
  pin("veh ESCORT -> orderVehicle", /key: "escort", .*orderVehicle\("escort"\)/);
  pin("veh LOAD -> orderVehicle", /key: "load", .*orderVehicle\("load"\)/);
  pin("veh UNLOAD -> unloadVehicle", /key: "unload", .*unloadVehicle\(\)/);
  pin("TRACKS -> toggleTracks", /key: "tracks", .*toggleTracks\(\)/);
  pin("veh TAKE CONTROL -> takeControlVehicle", /key: "possess", .*takeControlVehicle\(\)/);
  // the handlers themselves exist
  pin("handlers live", /S\.orderSquad = \(kind\)/.test(src) && /S\.orderVehicle = \(kind\)/.test(src) && /S\.takeControl = \(\)/.test(src) ? /./ : /(?!)/);
}
```

(Note the two `key: "possess"` and three `key: "move"`-family collisions are disambiguated by the paired handler name in the same regex — each pin matches only its own pie's line.)

**Step 9 — register.** In `scripts/depot-test.mjs`, after the `09-reorg.mjs` import, add:

```js
await import("./tests/10-command-refit.mjs");
```

**Step 10 — run and judge.** `node scripts/depot-test.mjs`. Three outcomes:
- **All green:** proceed to Step 11.
- **Any `audit(*)` row red:** STOP. Do not fix, do not weaken, do not commit. The report's defect list carries every red row verbatim with its detail value.
- **Any PRE-EXISTING test red:** STOP — that is a plan defect, report it.

**Step 11 — land (green path only).** `src/version.js`: `mk1.60` → `mk1.61`. `npm run build`. Gates: `node scripts/depot-test.mjs` (report the new total), `node scripts/smoke.mjs` (with preview server, per the Task 1 pattern), `node scripts/depot-lint.mjs`. All green → commit `scripts/tests/10-command-refit.mjs`, `scripts/depot-test.mjs`, `src/version.js` with subject "every button answers: the radial audit (mk1.61)" and the standing trailer lines, then push.

## Report requirements

Open with the read-confirmation (twelve items). Then the verdict line: AUDIT CLEAN or AUDIT FINDINGS. Then the full wedge matrix as a table — every wedge × type row with PASS/FAIL — followed by gates and counts (old total 1312 → new total). Every red row, deviation, or pre-existing movement is its own labeled bullet.

---

# AMENDMENT 1 — Phase B: the ruled fixes (owner, 2026-08-19)

Phase A found three red rows; the owner ruled all three plus the ATTACK STRUCTURES relabel. Four steps, then the whole task lands as mk1.61. The Phase A file (`scripts/tests/10-command-refit.mjs`, uncommitted in the tree) and runner line stand as built.

**Step B1 — the sapper fix (game code, one line).** `src/depot/squads.js:569` — the charges-carried arrival hold gates on the ATTACK order, exactly as its own comment always described it:

```js
    const chargesCarried = squad.order === "attack" && squad.type === "sappers" && members.some((u) => u._fuse == null);
```

(This also cures the BUILD path: a sapper squad finishing a mine line now arrives, closes its job, and digs in.) ATTACK behavior is byte-unchanged.

**Step B2 — the drift threshold (fixture re-teach).** In `10-command-refit.mjs`, audit(a)'s drift check `> 5` becomes `> 6.5` — clear of the spotter's by-design 5m survey radius plus the slot ring. Re-teach reported old→new.

**Step B3 — the settled corridor (fixture re-teach).** In audit(e)'s `first(pref)` fixture, after `spawnSquadMembers(w, sq);` add:

```js
    const spot = sq.memberIds.map((id) => w.byId.get(id)).find((u) => u && u.role === "spotter");
    if (spot) { spot.pos.x = 0; spot.pos.z = 3; } // off the firing corridor — the pair settled, not mid-spawn
```

**Step B4 — the relabel (owner's ruling).** `src/depot/DepotGame.jsx:3734`: `label: "STRUCTURES"` → `label: "ATTACK STRUCTURES"`. Key, machinery, and every other token on the line untouched. (Grepped: no test pins the label literal.)

**Sweep license:** any pre-existing pin that asserts the sapper MOVE park or the STRUCTURES label text re-teaches with content-preserving intent, reported old→new. (Dispatch grep found none — the license is insurance, not a plan.)

**Land.** `src/version.js` mk1.60 → mk1.61; build AFTER the bump. Gates: `node scripts/depot-test.mjs` (expect 1404/0 — the three reds turn green, zero other movement), `node scripts/smoke.mjs` (preview-server pattern), `node scripts/depot-lint.mjs`. All green → commit `scripts/tests/10-command-refit.mjs`, `scripts/depot-test.mjs`, `src/depot/squads.js`, `src/depot/DepotGame.jsx`, `src/version.js` — subject "every button answers: the radial audit (mk1.61)" — and push.

**Step B5 — the slider toggle (owner, 2026-08-19, mid-review addition).** The ATTACK STRUCTURES wedge carries a small slider: black knob at the left when off; slid to the right and bright green when on — on top of the existing lit-wedge highlight, which stays. Generic mechanism: a slot may carry a `toggle` field (true/false); only the structures slot sets it. Two edits:

(1) `src/depot/DepotGame.jsx:655` — inside RadialMenu's slot group, directly after the label `<text>` line, add:

```jsx
            {/* P7.1 T2 (owner): a toggle wedge wears a slider — black at
                rest, slid over and bright green in use. Only slots that
                carry s.toggle draw it; every other wedge is untouched. */}
            {s.toggle != null && (
              <g>
                <rect x={lx - 11} y={ly + 17} width={22} height={10} rx={5}
                  fill={s.toggle ? "rgba(74,255,140,0.28)" : "#0a0d12"}
                  stroke={s.toggle ? "#4aff8c" : "#48515f"} strokeWidth="1" />
                <circle cx={s.toggle ? lx + 6 : lx - 6} cy={ly + 22} r={4}
                  fill={s.toggle ? "#4aff8c" : "#14171a"}
                  stroke={s.toggle ? "#4aff8c" : "#48515f"} strokeWidth="1" />
              </g>
            )}
```

(2) The structures slot line (`src/depot/DepotGame.jsx:3734`, the same line Step B4 relabels) also gains `toggle: sq.structFirst,` after `on: sq.structFirst,` — the finished line:

```js
          slots.push({ key: "structures", icon: "▨", label: "ATTACK STRUCTURES", color: "#c9a0ff", on: sq.structFirst, toggle: sq.structFirst, act: () => { const S = stateRef.current; if (S) { S.toggleStructFirst(); S.selSquadId = null; } } });
```

SVG renders identically on phone and desktop — both platforms carry it by construction. The look is the owner's live acceptance.

---

# AMENDMENT 2 — the tracks slider (owner, 2026-08-19, post-mk1.61)

The vehicle pie's TRACKS wedge wears the same slider the ATTACK STRUCTURES wedge got in Step B5: green and slid over while the safety is on (CAREFUL — the default, so the slider defaults ON), black at rest with the safety off (FREE). The slider mechanism already exists (RadialMenu's `toggle` field); this is one slot-line edit. Lands alone as mk1.62.

**Step 1.** `src/depot/DepotGame.jsx:3851` — the tracks slot gains `toggle: vr.tracks !== "free",` after `on: true,` — the finished line:

```js
          { key: "tracks", icon: vr.tracks === "free" ? "●" : "◐", label: vr.tracks === "free" ? "TRACKS FREE" : "TRACKS CAREFUL", color: vr.tracks === "free" ? "#ff7a7a" : "#4aff8c", on: true, toggle: vr.tracks !== "free", act: () => { const S = stateRef.current; if (S) { S.toggleTracks(); S.selVehId = null; } } },
```

**Step 2.** `src/version.js`: `mk1.61` → `mk1.62`. Build AFTER the bump.

**Gates — run ONLY these:** `node scripts/depot-test.mjs` (1404/0, zero movement — the audit's tracks wiring pin `/key: "tracks", .*toggleTracks\(\)/` still matches the finished line), `node scripts/smoke.mjs` (preview pattern), `node scripts/depot-lint.mjs`. Green → commit `src/depot/DepotGame.jsx` + `src/version.js`, subject "the tracks wear the safety slider (mk1.62)", trailer lines as standing, push. The slider's look and its default-on state are the owner's live acceptance.
