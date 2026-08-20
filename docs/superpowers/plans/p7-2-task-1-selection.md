# P7.2 Task 1 — Easier Selection (mk1.80)

**Suggested model: Sonnet** (interface fan-out over existing handlers, fully specced below).
**Scope (ruled, 2026-08-19):** bigger tap targets; tap-cycling through overlapping units; SELECT ALL OF TYPE with multi-squad orders. Drag-box is CUT — nothing in this plan builds one.
**Ships phone AND desktop by one mechanism:** every change lives in the tap path and the pie, and a desktop click IS a tap (`onPointerUp` → `tapAt`). No new key or mouse binding is needed; the plan's acceptance names both platforms.

## Required reading (verified against the mk1.75 tree; re-verify at dispatch)

- `src/depot/DepotGame.jsx` — 1192–1283 (the S state object), 1509–1543 (placeSquadAt), 1609–1728 (pick helpers, selectedSquad, order handlers), 1756–1809 (possession takes/release), 1858–1969 (acceptLine/rejectLine/consumeOrderTap), 1973–2014 (consumeVehOrderTap), 2121–2196 (tapAt), 3277–3435 (the hud tick), 3475–3499 (setMode), 3873–3936 (the squad pie), 3999–4026 (the vehicle pie).
- `src/depot/state.js` — 77–80 (PENDING_ARM_S), 702–802 (squad wiring; the new exports seat here).
- `src/depot/squads.js` — 33–87 (SQUAD_SPECS, makeSquad; read-only, this file is NOT touched).
- `scripts/tests/10-command-refit.mjs` — whole (the wiring-pin idiom and the audit matrix).
- `scripts/tests/04-vision-command-possession.mjs` — 620–700 (the pinned literals this task must preserve).
- `scripts/depot-test.mjs` — whole (the runner list).

## The design, plainly

1. **Bigger targets.** The squad pick radius grows 1.6 → 2.4 m, the hull pick 3.2 → 4.0 m, and towers gain a 2.4 m proximity pick (today a tower selects only by its exact grid cell). All three radii move to named constants in `state.js`. Provisional (F5).
2. **The tap cycles.** One tap gathers every pickable thing near it — squads, hulls, towers — nearest first. Nothing selected: the nearest wins. Something selected that is in the list: the pick hands to the NEXT one around, wrapping. A lone unit re-taps exactly as today (a cycle of one). Tower candidates join only in plain command mode — a build tap is never stolen by the tower next door; the exact-cell tower tap keeps today's behavior in every mode.
3. **Select all of type.** A new SELECT ALL wedge on the squad pie selects every squad of the selected type with a live member (sealed riders excluded). The group shows as "×N" on the label. Orders fan out: DEFEND digs each squad in at its own centroid; MOVE/ATTACK send all to the tapped point; PATROL proposes one line and, on accept, all walk it; ATTACK STRUCTURES flips the whole group to the primary's new value. TAKE CONTROL acts on the primary alone and drops the group. Engineer and sapper build wedges narrow the group to the primary (a line is one squad's job). If the primary squad dies, the next group member is promoted; selection never rides the save (verified — save.js has no selection field).
4. **What is NOT touched:** `squads.js`, `renderer.js` (the reach fan and rings stay on the primary; the green threads already draw one per ordered squad, so a group order shows every route with no renderer change), the vehicle pie's order set, the enemy, the save shape. Zero rng anywhere in this task; no draw-contract change; the keystone (hash 843448507, draws 749, seed 1000) is expected UNMOVED.

Dials, all provisional (F5): TAP_SQUAD_M 2.4, TAP_HULL_M 4.0, TAP_TOWER_M 2.4.

## Sweep license

This task rewrites the tap-selection block of `tapAt` and appends to lines that clear selection. Grep at plan-writing found every pin over this ground: the audit(j) wiring pins (10-command-refit.mjs:202–226), COMMAND T2(a/b) source pins (04:639–651), POSSESSION T3(d) pins (04:1371–1373). The steps below are written to keep every one of those literals matching (appends after, never edits inside). If the agent finds any OTHER literal-text pin broken by exactly these edits, the license covers its re-teach — content identical, old → new in the report. A pin failing for any other reason stops the task.

## The steps

**Step 1 — the failing asserts.** Create `scripts/tests/11-hiring-hall.mjs`:

```js
// COLDSNAP suite — era 11: THE HIRING HALL (P7.2). T1 (mk1.80): easier
// selection — the tap radii, the cycle rule, select-all-of-type, the wiring.
import { ok } from "./harness.mjs";
import { makeWorld } from "../../src/engine/core.js";
import { makeSquad } from "../../src/depot/squads.js";
import { spawnSquadMembers, TAP_SQUAD_M, TAP_HULL_M, TAP_TOWER_M, nextPick, squadIdsOfType } from "../../src/depot/state.js";
import fs from "node:fs";

const flatF = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (x, z, o) => { o.x = 0; o.y = 1; o.z = 0; return o; } };

// ---- P7.2 T1 (a): the radii live in one home and grew // provisional (F5)
ok("T1(a): the tap radii — squad 2.4, hull 4.0, tower 2.4", TAP_SQUAD_M === 2.4 && TAP_HULL_M === 4.0 && TAP_TOWER_M === 2.4);

// ---- P7.2 T1 (b): the cycle rule — nearest first, next on re-tap, wraps
{
  const cands = [{ key: "sq:2", d: 1.2 }, { key: "sq:1", d: 0.4 }, { key: "veh:9", d: 2.0 }];
  ok("T1(b): no current pick — the nearest wins", nextPick(cands, null).key === "sq:1");
  ok("T1(b): a re-tap hands the pick around", nextPick(cands, "sq:1").key === "sq:2" && nextPick(cands, "sq:2").key === "veh:9");
  ok("T1(b): the cycle wraps", nextPick(cands, "veh:9").key === "sq:1");
  ok("T1(b): empty ground picks nothing", nextPick([], null) === null);
}

// ---- P7.2 T1 (c): select-all-of-type — same type, live members, never sealed
{
  const w = makeWorld({ field: flatF, seed: 80 });
  const a = makeSquad(1, "rifles", 1, 0, 0); spawnSquadMembers(w, a);
  const b = makeSquad(2, "rifles", 1, 10, 0); spawnSquadMembers(w, b);
  const c = makeSquad(3, "mg", 1, 20, 0); spawnSquadMembers(w, c);
  const d = makeSquad(4, "rifles", 1, 30, 0); spawnSquadMembers(w, d); d.ridingIn = 1;
  ok("T1(c): all rifles, never the mg team, never the sealed squad",
    JSON.stringify(squadIdsOfType(w, [a, b, c, d], "rifles")) === "[1,2]");
}

// ---- P7.2 T1 (d): the wiring (the audit(j) idiom — tap-to-handler)
{
  const src = fs.readFileSync("src/depot/DepotGame.jsx", "utf8");
  ok("T1(d): squad picking reads the shared radius", /< TAP_SQUAD_M\) return sq;/.test(src));
  ok("T1(d): hull picking rides the cycle scan on its own radius", /d <= TAP_HULL_M\) cands\.push/.test(src) && !/vehicleAtPoint/.test(src));
  ok("T1(d): the tap builds candidates and cycles them", /nextPick\(cands, curSel\)/.test(src));
  ok("T1(d): towers join the pick only in plain command", /b\.kind === "tower" && !S\.mode && !S\.sellMode/.test(src));
  ok("T1(d): the pie carries SELECT ALL wired to its handler", /key: "select_all", .*selectAllType\(\)/.test(src));
  ok("T1(d): group orders fan out through one door", /for \(const gsq of selectedGroup\(\)\)/.test(src));
  ok("T1(d): accepting a line clears the group", /S\.selSquadId = null; S\.orderMode = null; S\.buildPt0 = null; S\.selSquadIds = null;/.test(src));
}
```

**Step 2 — register the era.** `scripts/depot-test.mjs`, after the line `await import("./tests/10-command-refit.mjs");`, insert:

```js
await import("./tests/11-hiring-hall.mjs");
```

Run `node scripts/depot-test.mjs` — the new file fails on its missing imports. That failure is the step's proof; nothing else in the suite may move.

**Step 3 — the pure machinery.** `src/depot/state.js`, insert after `memberNearRow`'s closing brace (line 787), before the `sandbagOrientAt` comment block:

```js
// P7.2 T1 (owner): EASIER SELECTION — the field tap radii, one home.
// Squad was a hard-coded 1.6 in squadAtPoint, hull 3.2 in vehicleAtPoint;
// towers had no proximity pick at all (exact cell only). // provisional (F5)
export const TAP_SQUAD_M = 2.4;
export const TAP_HULL_M = 4.0;
export const TAP_TOWER_M = 2.4;

// nextPick: the tap-cycle rule, pure. cands = [{ key, d }] — key unique per
// pickable thing, d its distance from the tap. Nearest first, ties broken by
// key order; when the current pick is in the list the NEXT one around wins,
// wrapping. Deterministic, no rng.
export function nextPick(cands, curKey) {
  if (!cands || cands.length === 0) return null;
  const sorted = cands.slice().sort((a, b) => (a.d - b.d) || (a.key < b.key ? -1 : 1));
  if (curKey == null) return sorted[0];
  const i = sorted.findIndex((c) => c.key === curKey);
  return sorted[(i + 1) % sorted.length]; // absent current (-1) lands on the nearest
}

// SELECT ALL OF TYPE (owner): every squad of the type still holding a live
// member. Sealed riders (P7 T4) are not tappable and not selectable here.
export function squadIdsOfType(world, squads, type) {
  const out = [];
  for (const sq of squads) {
    if (sq.type !== type || sq.ridingIn != null) continue;
    if (sq.memberIds.some((id) => { const u = world.byId.get(id); return u && u.alive; })) out.push(sq.id);
  }
  return out;
}
```

**Step 4 — the imports.** `DepotGame.jsx` line 21, append to the `./state.js` import list: `TAP_SQUAD_M, TAP_HULL_M, TAP_TOWER_M, nextPick, squadIdsOfType`.

**Step 5 — the state field.** `DepotGame.jsx` line 1238, the S object's squad row gains the group beside the primary:

```js
squads: [], foeSquads: [], nextSquadId: 1, selSquadId: null, selSquadIds: null, selArmedAt: 0, orderMode: null, buildPt0: null, pieOpen: false,
```

**Step 6 — the radii; the dead helper dies.** `DepotGame.jsx`:
- Line 1616, in `squadAtPoint`: `< 1.6) return sq;` → `< TAP_SQUAD_M) return sq;` (the function stays — ESCORT and LOAD taps use it).
- Lines 1622–1630: DELETE `vehicleAtPoint` and its comment (the cycle scan in Step 11 replaces its one caller).

**Step 7 — the group reader and the select-all handler.** After `selectedSquad` (line 1621) insert:

```js
      // P7.2 T1: the order fan-out — the SELECT ALL group when one is up,
      // else the one selected squad. Primary first; dead ids drop out.
      const selectedGroup = () => {
        if (S.selSquadIds && S.selSquadIds.length) return S.selSquadIds.map((id) => S.squads.find((q) => q.id === id)).filter(Boolean);
        const sq = selectedSquad();
        return sq ? [sq] : [];
      };
```

After `S.toggleStructFirst` (line ~1728, post Step 8's edit) insert:

```js
      // P7.2 T1 (owner): SELECT ALL OF TYPE — every squad of the selected
      // type joins; one-squad results collapse back to plain selection.
      S.selectAllType = () => {
        const sq = selectedSquad();
        if (!sq || world.t < S.selArmedAt) return;
        const ids = squadIdsOfType(world, S.squads, sq.type);
        S.selSquadIds = ids.length > 1 ? ids : null;
      };
```

**Step 8 — orders fan out.** `DepotGame.jsx`, `S.orderSquad` (1679–1716) and `S.toggleStructFirst` (1723–1728):
- The DEFEND branch body becomes a loop — each squad digs in at its own live centroid:

```js
        if (kind === "defend") {
          for (const gsq of selectedGroup()) {
            let cx = 0, cz = 0, n = 0;
            for (const id of gsq.memberIds) { const u = world.byId.get(id); if (u && u.alive) { cx += u.pos.x; cz += u.pos.z; n++; } }
            if (n) gsq.anchor = { x: cx / n, z: cz / n };
            gsq.order = "defend"; gsq.dest = null; gsq._legTarget = null; gsq._pauseT = 0; gsq._threatSig = undefined;
            gsq._surveyPending = true;
            gsq._build = null;
          }
          S.orderMode = null; S.buildPt0 = null;
        } else if (kind === "attack" || kind === "move") {
```
(the attack/move/patrol arming branches are UNCHANGED — arming is group-agnostic; the ground tap fans out in Step 9.)
- Both build-arm branches (`build_bags`/`build_walls` and `build_mines`/`build_wires`) gain, as their first line after the type guard: `S.selSquadIds = null; // a line is one squad's job — the group narrows to the primary`
- `S.toggleStructFirst` flips the group to the primary's new value:

```js
      S.toggleStructFirst = () => {
        const sq = selectedSquad();
        if (!sq || world.t < S.selArmedAt) return;
        if (!INFANTRY_ARMS[sq.type]) return;
        const v = !sq.prefStruct;
        for (const gsq of selectedGroup()) gsq.prefStruct = v;
      };
```

**Step 9 — the ground tap fans out.** `consumeOrderTap` (1911–1969):
- The attack/move branch loops the group (the deselect gains the group clear):

```js
        if (om === "attack" || om === "move") {
          for (const gsq of selectedGroup()) { gsq.order = om; gsq.dest = { x: d.x, z: d.z }; gsq._legTarget = null; gsq._pauseT = 0; gsq._build = null; }
          S.orderMode = null;
          // COMMAND 1b (mk0.82): the order's final ground tap landed — the
          // squad is released (deselected), same as an instant order.
          S.selSquadId = null; S.selSquadIds = null;
          return true;
        }
```
- The patrol branch's `S.linePending` gains the group's ids, keeping `sq: osq.id` exactly as written: `S.linePending = { kind: "patrol", sq: osq.id, sqs: selectedGroup().map((q) => q.id),` (rest of the literal unchanged).
- The three guard clears at 1931, 1946, 1959 each gain `S.selSquadIds = null;` appended immediately after their `S.selSquadId = null;`.

**Step 10 — accept and reject learn the group.** `acceptLine`/`rejectLine` (1858–1896):
- The patrol branch inside `if (sq) {` walks every group id, falling back to the one squad; the pinned `else startBuildLine(grid, sq, lp.kind, lp.a, lp.b, toast);` line is NOT touched:

```js
          if (lp.kind === "patrol") {
            // COMMAND T3 (mk0.85): accept arms the loop — P7.2 T1: for the
            // whole SELECT ALL group when one proposed the line.
            const group = (lp.sqs && lp.sqs.length ? lp.sqs : [lp.sq]).map((id) => S.squads.find((q) => q.id === id)).filter(Boolean);
            for (const gsq of group) {
              gsq._patA = { x: lp.a.x, z: lp.a.z };
              gsq._patB = { x: lp.b.x, z: lp.b.z };
              gsq.order = "patrol";
              gsq.dest = { x: lp.a.x, z: lp.a.z };   // walk to the near end first
              gsq._legTarget = null; gsq._pauseT = 0; gsq._cohesionHoldT = 0; gsq._build = null;
            }
          }
          else startBuildLine(grid, sq, lp.kind, lp.a, lp.b, toast);
```
- acceptLine's closing clear (1889) and rejectLine's (1894) each APPEND `S.selSquadIds = null;` after the existing `S.selSquadId = null; S.orderMode = null; S.buildPt0 = null;` — the 04 pin stays matching, the new T1(d) pin starts matching.

**Step 11 — the tap cycles.** `tapAt`, replace lines 2167–2178 (from the `// Tap on a squad member selects his squad` comment through the `if (S.selVehId != null)` deselect) with:

```js
        // P7.2 T1: THE TAP CYCLES. Every pickable thing near the tap —
        // squads, hulls, towers (towers only in plain command, so a build
        // tap is never stolen by the tower next door; the exact-cell tower
        // tap below keeps today's behavior in every mode) — nearest first;
        // tapping again hands the pick to the next one around.
        const cands = [];
        for (const sq of S.squads) {
          if (sq.ridingIn != null) continue; // P7 T4: a sealed squad is not tappable
          let dBest = Infinity;
          for (const id of sq.memberIds) {
            const u = world.byId.get(id);
            if (u && u.alive) { const d2 = Math.hypot(u.pos.x - p.x, u.pos.z - p.z); if (d2 < dBest) dBest = d2; }
          }
          if (dBest <= TAP_SQUAD_M) cands.push({ key: "sq:" + sq.id, d: dBest });
        }
        for (const b of world.bodies) {
          if (!b.alive || b.team !== 1) continue;
          if (b.kind === "vehicle") {
            const d2 = Math.hypot(b.pos.x - p.x, b.pos.z - p.z);
            if (d2 <= TAP_HULL_M) cands.push({ key: "veh:" + b.id, d: d2 });
          } else if (b.kind === "tower" && !S.mode && !S.sellMode) {
            const d2 = Math.hypot(b.pos.x - p.x, b.pos.z - p.z);
            if (d2 <= TAP_TOWER_M) cands.push({ key: "twr:" + b.id, d: d2 });
          }
        }
        const curSel = S.selSquadId != null ? "sq:" + S.selSquadId
          : S.selVehId != null ? "veh:" + S.selVehId
          : S.inspectId != null && cands.some((c) => c.key === "twr:" + S.inspectId) ? "twr:" + S.inspectId : null;
        const pick = nextPick(cands, curSel);
        if (pick) {
          const id = +pick.key.slice(pick.key.indexOf(":") + 1);
          S.selSquadId = null; S.selSquadIds = null; S.selVehId = null; S.inspectId = null;
          S.orderMode = null; S.vehOrderMode = null; S.buildPt0 = null;
          S.selArmedAt = world.t + PENDING_ARM_S; S.pieOpen = true;
          if (pick.key.startsWith("sq:")) S.selSquadId = id;
          else if (pick.key.startsWith("veh:")) S.selVehId = id;
          else S.inspectId = id;
          return;
        }
        if (S.selSquadId != null) { S.selSquadId = null; S.selSquadIds = null; S.orderMode = null; S.buildPt0 = null; S.pieOpen = false; return; }
        if (S.selVehId != null) { S.selVehId = null; S.vehOrderMode = null; S.buildPt0 = null; S.pieOpen = false; return; }
```
The wall/tower exact-cell branch below (2183) stays byte-identical.

**Step 12 — the pie and the label.** `DepotGame.jsx`:
- The hud tick's `squadSel` object (3326) gains `count: S.selSquadIds ? S.selSquadIds.length : 1,` after `order: sq.order,`.
- The base slots array (3884–3891) gains, after the "possess" slot, one line:

```js
          { key: "select_all", icon: "∷", label: "SELECT ALL", color: "#9fdcff", on: sq.count > 1, act: () => { const S = stateRef.current; if (S) { S.selectAllType(); S._keepPie = true; } } },
```
- The squad pie's `onChoose` (3934) becomes: `onChoose={() => { const S = stateRef.current; if (S) { if (S._keepPie) S._keepPie = false; else S.pieOpen = false; } }}` — the SELECT ALL wedge keeps the pie up for the order that follows; every other wedge closes it exactly as today.
- Both label sites (3934 pie label, 3935 chip) read a counted label: in the squadSel IIFE, before the return, add `const lbl = sq.count > 1 ? sq.label + " ×" + sq.count : sq.label;` and replace `sq.label + status` with `lbl + status` at both sites.
- The DEFEND act (3884) and STRUCTURES act (3903) each APPEND `S.selSquadIds = null;` after their `S.selSquadId = null;` — the audit(j) pins keep matching (same line, appended after the handler call).

**Step 13 — the remaining group clears.** Append `S.selSquadIds = null;` immediately after `S.selSquadId = null;` at: 1672 (takeControlVehicle), 1771 (takeControl), 3494 (setMode). placeSquadAt (1540) gains it after `S.selSquadId = sq.id;`. The stepDepot prune (478) becomes:

```js
    if (S.selSquadIds) { S.selSquadIds = S.selSquadIds.filter((id) => S.squads.some((q) => q.id === id)); if (S.selSquadIds.length < 2) S.selSquadIds = null; }
    if (S.selSquadId != null && !S.squads.some((q) => q.id === S.selSquadId)) {
      const nextId = S.selSquadIds ? S.selSquadIds.find((id) => id !== S.selSquadId) : null; // the group promotes its next squad
      if (nextId != null) S.selSquadId = nextId;
      else { S.selSquadId = null; S.orderMode = null; S.buildPt0 = null; S.selSquadIds = null; }
    }
```

**Step 14 — the gates and the deploy.** Bump `src/version.js` to `mk1.80`. Then, in order: `node scripts/depot-test.mjs` (baseline 1459/0 → expected 1472/0, thirteen new checks — the printed count is the acceptance to the digit), `node scripts/depot-lint.mjs` clean, `npm run build` AFTER the bump, smoke green at mk1.80. Keystone expected UNMOVED (hash 843448507, draws 749, seed 1000) — this task adds no draw and touches no sim path. Gates green → commit → push.

## Trap notes

- The tap chain's order is load-bearing: placement → pending → possession → proposed line → order taps → the cycle scan → the exact-cell branch → build modes. Do not reorder anything around the Step 11 replacement.
- `RadialMenu`'s onChoose closes the pie for every wedge — the `_keepPie` flag at the squad pie's call site is the only exception, and only the SELECT ALL act sets it.
- The 04 COMMAND T2(b) pin and the audit(j) pins match substrings of single lines — every edit near them APPENDS after the pinned text, never edits inside it.
- ESCORT and LOAD taps go through `squadAtPoint`, so their grab radius grows with it — intended, same law, no code change.
- Enemy squads live in `S.foeSquads` and enemy towers are team 2 — the candidate scan's team-1 filters keep both unpickable.
- No edits to `squads.js`, `renderer.js`, `save.js`, or any spec table.

## The owner's live check (phone AND desktop)

- Tap near (not on) a man — the squad selects at the wider reach; same with the mouse.
- Stack a squad on a hull, tap twice — the pick cycles between them; a third tap wraps.
- SELECT ALL on a rifle squad with three fielded — the label reads ×3, one MOVE tap marches all three, three green threads draw.
- A tower selects from a step away in plain command; a build tap beside it still builds.

## Report requirements

Fixture seeds named (80 is the one new seed). Every re-pin old → new (expected: none). Deviations and license uses each their own bullet.
