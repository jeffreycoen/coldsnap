# The Chain Builder (mk2.91)

Task 2 of 2 for the command-queue feature. The interface for mk2.90's chains: a QUEUE wedge on the squad and vehicle pies; with it lit, aimed orders append to the unit's chain instead of replacing; a patrol closes the chain. Queued legs show as numbered flags on the ground — tap one to delete that leg; a CLEAR wedge drops the whole chain. Any plain order wipes the chain. Single selections only; the group reticle is untouched.

Suggested model: Sonnet 5 — two files plus a pin test, every code block carried below verbatim.

Rulings this plan rests on: plain orders wipe; single selections only; build lines outside; delete-a-leg plus CLEAR.

Design choices, stated:
- With QUEUE lit and no active travel order, the first aimed tap becomes the active order (a chain needs a moving head); taps after it append. Appending onto a standing patrol is refused with a toast — patrol is terminal.
- While appending, the selection and the aim stay up, so repeated taps lay legs 1, 2, 3 without re-selecting.
- A queued patrol closes the chain: the QUEUE light goes out when one is accepted.
- Queued legs are numbered flags (⚑ for move/attack, ⇄ at a patrol's near end); tapping a flag deletes that queued leg only — the active order's own red flag stays as it is and is not tappable. CLEAR drops queued legs and leaves the active order running.
- Wipe sites — every plain order path sets the chain to null: the squad tap fan, squad DEFEND, squad patrol accept, the vehicle tap (move/attack/escort), vehicle patrol accept, vehicle DEFEND, both group fans, and both TAKE CONTROLs.
- Two teaching cards join the on-demand registry (`queue_chain`, `clear_chain`); the WALK list is untouched.
- Phone and desktop: wedges and tappable flags are the same DOM on both.
- No engine, sim, or save touch — `_queue` was taught to ride the save in mk2.90; `queueOn` is view state and never rides.

## Required reading

- This plan, whole.
- `src/depot/DepotGame.jsx` lines 530–560, 925–1120, 1250–1420, 1560–1620, 2920–3005 (the mk2.89 group-anchor block and its neighbors), 3060–3160, 3855–3900 (squad pie), 3980–4030 (vehicle pie), 4030–4060 (the flag JSX).
- `src/depot/cards.js` lines 60–80 (the teaching table's shape).
- `docs/superpowers/plans/the-order-chain.md` (the entry shapes the builder writes).

Report opens with confirmation these were read.

## Steps

### Step 1 — the failing pins

Create `scripts/tests/38-the-chain-builder.mjs` with exactly:

```js
import { ok } from "./harness.mjs";
import fs from "node:fs";

// ==== mk2.91: the chain builder =============================================
// The QUEUE wedge, the append-not-replace tap, the numbered flags, leg
// delete, CLEAR, and the plain-order wipe. Interface work — source pins,
// no sim runs, no fixture seeds.
{
  console.log("\n[mk2.91: the chain builder]");
  const dg = fs.readFileSync("src/depot/DepotGame.jsx", "utf8");
  ok("pins: the QUEUE wedge stands on both pies", (dg.match(/key: "queue", icon: "⛓", label: "QUEUE"/g) || []).length === 2);
  ok("pins: the CLEAR wedge stands on both pies", (dg.match(/key: "clearchain", icon: "✂"/g) || []).length === 2);
  ok("pins: the toggle refuses a group", /ONE SQUAD AT A TIME/.test(dg) && /view\.queueOn = !view\.queueOn;/.test(dg));
  ok("pins: the squad tap appends to the chain", /\(qsq\._queue \|\| \(qsq\._queue = \[\]\)\)\.push\(\{ kind: om, x: d\.x, z: d\.z \}\);/.test(dg));
  ok("pins: the vehicle tap appends to the chain", /\(v\._queue \|\| \(v\._queue = \[\]\)\)\.push\(\{ kind: om, x: d\.x, z: d\.z \}\);/.test(dg));
  ok("pins: a standing patrol refuses the append", (dg.match(/THE CHAIN ENDS AT A PATROL/g) || []).length >= 2);
  ok("pins: the plain squad fan wipes the chain", /gsq\._build = null; gsq\._queue = null; \}/.test(dg));
  ok("pins: the plain vehicle orders wipe the chain", (dg.match(/v\._queue = null;/g) || []).length >= 4);
  ok("pins: a queued patrol closes the chain", /push\(\{ kind: "patrol", ax: lp\.a\.x, az: lp\.a\.z, bx: lp\.b\.x, bz: lp\.b\.z \}\);/.test(dg));
  ok("pins: the legs project as numbered flags", /view\.chainScreens = chainOwner\._queue\.map/.test(dg) && /data-chain-flag/.test(dg));
  ok("pins: a tapped flag deletes its leg", /o\._queue\.splice\(i, 1\);/.test(dg));
  const cs = fs.readFileSync("src/depot/cards.js", "utf8");
  ok("pins: the two teaching cards exist", /queue_chain: \{ label: "QUEUE"/.test(cs) && /clear_chain: \{ label: "CLEAR"/.test(cs));
}
```

In `scripts/depot-test.mjs`, after the line

```js
await import("./tests/37-the-order-chain.mjs");
```

insert

```js
await import("./tests/38-the-chain-builder.mjs");
```

Run `node scripts/gate.mjs depot-test` blocking. Required result: exactly the twelve new pins FAIL; every pre-existing test PASSES. Any other pattern stops the task.

### Step 2 — view state and the controls (`src/depot/DepotGame.jsx`)

**2a.** Replace exactly:

```js
        groupSel: null, groupOrderMode: null, // mk2.89: the screen select — { sqIds, vehIds } and its own MOVE/ATTACK aim
```

with:

```js
        groupSel: null, groupOrderMode: null, // mk2.89: the screen select — { sqIds, vehIds } and its own MOVE/ATTACK aim
        queueOn: false, chainScreens: null, // mk2.91: the chain builder — the QUEUE light and the legs' projected flags
```

**2b.** Immediately after `view.orderGroup`'s closing (the four lines below are its tail — anchor on all four), replace exactly:

```js
        } else if (kind === "move" || kind === "attack") {
          view.groupOrderMode = view.groupOrderMode === kind ? null : kind;
        }
      };
```

with:

```js
        } else if (kind === "move" || kind === "attack") {
          view.groupOrderMode = view.groupOrderMode === kind ? null : kind;
        }
      };
      // mk2.91: THE CHAIN BUILDER's controls. QUEUE is a light on the
      // pie: lit, aimed orders append; a chain is one unit's, never a group's.
      view.toggleQueue = () => {
        if (view.selSquadIds && view.selSquadIds.length) { toast("ONE SQUAD AT A TIME — A CHAIN IS ONE UNIT'S"); return; }
        view.queueOn = !view.queueOn;
      };
      view.clearChain = () => {
        const o = view.selVehId != null ? world.byId.get(view.selVehId) : selectedSquad();
        if (o) o._queue = null;
      };
      view.deleteLeg = (i) => {
        const o = view.selVehId != null ? world.byId.get(view.selVehId) : selectedSquad();
        if (o && o._queue && i >= 0 && i < o._queue.length) { o._queue.splice(i, 1); if (!o._queue.length) o._queue = null; }
      };
```

### Step 3 — the squad paths

**3a.** In `consumeOrderTap`, replace exactly:

```js
        if (om === "attack" || om === "move") {
          for (const gsq of selectedGroup()) { gsq.order = om; gsq.dest = { x: d.x, z: d.z }; gsq._legTarget = null; gsq._pauseT = 0; gsq._build = null; }
          view.orderMode = null;
          // COMMAND 1b (mk0.82): the order's final ground tap landed — the
          // squad is released (deselected), same as an instant order.
          view.selSquadId = null; view.selSquadIds = null;
          return true;
        }
```

with:

```js
        if (om === "attack" || om === "move") {
          // mk2.91: THE CHAIN BUILDER — with QUEUE lit the tap
          // APPENDS to the selected squad's chain; the selection and the aim
          // stay up so taps keep laying legs. A moving head is required: the
          // first tap on an idle squad becomes the active order. A standing
          // patrol is terminal — nothing chains after it.
          if (view.queueOn) {
            const qsq = selectedSquad();
            if (qsq) {
              if (qsq.order === "patrol") { toast("THE CHAIN ENDS AT A PATROL"); return true; }
              if ((qsq.order === "move" || qsq.order === "attack" || qsq.order === "build") && qsq.dest) {
                (qsq._queue || (qsq._queue = [])).push({ kind: om, x: d.x, z: d.z });
                return true;
              }
              qsq.order = om; qsq.dest = { x: d.x, z: d.z }; qsq._legTarget = null; qsq._pauseT = 0; qsq._build = null;
              return true;
            }
          }
          for (const gsq of selectedGroup()) { gsq.order = om; gsq.dest = { x: d.x, z: d.z }; gsq._legTarget = null; gsq._pauseT = 0; gsq._build = null; gsq._queue = null; }
          view.orderMode = null;
          // COMMAND 1b (mk0.82): the order's final ground tap landed — the
          // squad is released (deselected), same as an instant order.
          view.selSquadId = null; view.selSquadIds = null;
          return true;
        }
```

**3b.** In `view.orderSquad`'s defend branch — anchored on its `selectedGroup()` loop header, which `orderGroup`'s twin copy does not share — replace exactly:

```js
          for (const gsq of selectedGroup()) {
            let cx = 0, cz = 0, n = 0;
            for (const id of gsq.memberIds) { const u = world.byId.get(id); if (u && u.alive) { cx += u.pos.x; cz += u.pos.z; n++; } }
            if (n) gsq.anchor = { x: cx / n, z: cz / n };
            gsq.order = "defend"; gsq.dest = null; gsq._legTarget = null; gsq._pauseT = 0; gsq._threatSig = undefined;
            gsq._surveyPending = true;
            gsq._build = null;
```

with:

```js
          for (const gsq of selectedGroup()) {
            let cx = 0, cz = 0, n = 0;
            for (const id of gsq.memberIds) { const u = world.byId.get(id); if (u && u.alive) { cx += u.pos.x; cz += u.pos.z; n++; } }
            if (n) gsq.anchor = { x: cx / n, z: cz / n };
            gsq.order = "defend"; gsq.dest = null; gsq._legTarget = null; gsq._pauseT = 0; gsq._threatSig = undefined;
            gsq._surveyPending = true;
            gsq._build = null;
            gsq._queue = null; // mk2.91: a plain order wipes the chain
```

**3c.** In `acceptLine`'s squad patrol branch, replace exactly:

```js
            const group = (lp.sqs && lp.sqs.length ? lp.sqs : [lp.sq]).map((id) => run.squads.find((q) => q.id === id)).filter(Boolean);
            for (const gsq of group) {
              gsq._patA = { x: lp.a.x, z: lp.a.z };
              gsq._patB = { x: lp.b.x, z: lp.b.z };
              gsq.order = "patrol";
              gsq.dest = { x: lp.a.x, z: lp.a.z };   // walk to the near end first
              gsq._legTarget = null; gsq._pauseT = 0; gsq._cohesionHoldT = 0; gsq._build = null;
            }
```

with:

```js
            const group = (lp.sqs && lp.sqs.length ? lp.sqs : [lp.sq]).map((id) => run.squads.find((q) => q.id === id)).filter(Boolean);
            // mk2.91: with QUEUE lit and a moving head, the accepted patrol
            // APPENDS as the chain's terminal leg and puts the light out.
            const qsq0 = group.length === 1 ? group[0] : null;
            if (view.queueOn && qsq0 && (qsq0.order === "move" || qsq0.order === "attack" || qsq0.order === "build") && qsq0.dest) {
              (qsq0._queue || (qsq0._queue = [])).push({ kind: "patrol", ax: lp.a.x, az: lp.a.z, bx: lp.b.x, bz: lp.b.z });
              view.queueOn = false;
            } else for (const gsq of group) {
              gsq._patA = { x: lp.a.x, z: lp.a.z };
              gsq._patB = { x: lp.b.x, z: lp.b.z };
              gsq.order = "patrol";
              gsq.dest = { x: lp.a.x, z: lp.a.z };   // walk to the near end first
              gsq._legTarget = null; gsq._pauseT = 0; gsq._cohesionHoldT = 0; gsq._build = null;
              gsq._queue = null; // mk2.91: a plain order wipes the chain
            }
```

**3d.** In `view.takeControl`, replace exactly:

```js
        sq.order = "defend"; sq.dest = null; sq._legTarget = null; sq._pauseT = 0; sq._build = null; sq._threatSig = undefined;
```

with:

```js
        sq.order = "defend"; sq.dest = null; sq._legTarget = null; sq._pauseT = 0; sq._build = null; sq._threatSig = undefined; sq._queue = null; // mk2.91
```

### Step 4 — the vehicle paths

**4a.** In `consumeVehOrderTap`, replace exactly:

```js
        if (om === "move") {
          v.order = "move"; v.dest = { x: d.x, z: d.z }; v._route = null; v._routeDest = null;
          view.vehOrderMode = null; view.selVehId = null;
          return true;
        }
```

with:

```js
        if (om === "move" || om === "attack") {
          // mk2.91: the chain builder — QUEUE lit appends; see the squad tap.
          if (view.queueOn) {
            if (v.order === "patrol") { toast("THE CHAIN ENDS AT A PATROL"); return true; }
            if ((v.order === "move" || v.order === "attack") && v.dest) {
              (v._queue || (v._queue = [])).push({ kind: om, x: d.x, z: d.z });
              return true;
            }
            v.order = om; v.dest = { x: d.x, z: d.z }; v._route = null; v._routeDest = null;
            return true;
          }
          v.order = om; v.dest = { x: d.x, z: d.z }; v._route = null; v._routeDest = null; v._queue = null;
          view.vehOrderMode = null; view.selVehId = null;
          return true;
        }
```

**4b.** Delete the now-dead separate attack branch — remove exactly (mk2.88's tap, absorbed by 4a):

```js
        if (om === "attack") {   // mk2.88: MOVE's own tap, the fighting order
          v.order = "attack"; v.dest = { x: d.x, z: d.z }; v._route = null; v._routeDest = null;
          view.vehOrderMode = null; view.selVehId = null;
          return true;
        }
```

(Its removal moves the mk2.88 pin's asserted line into 4a's plain path — the pin `v\.order = "attack"; v\.dest = \{ x: d\.x, z: d\.z \};` no longer matches. The re-teach license below covers it.)

**4c.** In `consumeVehOrderTap`'s escort branch, replace exactly:

```js
          v.order = "escort"; v.escortId = sq.id; v.dest = null; v.goal = null; v._route = null; v._routeDest = null;
```

with:

```js
          v.order = "escort"; v.escortId = sq.id; v.dest = null; v.goal = null; v._route = null; v._routeDest = null; v._queue = null; // mk2.91
```

**4d.** In `view.orderVehicle`'s defend branch, replace exactly:

```js
        if (kind === "defend") { v.order = "defend"; v.dest = null; v.goal = null; v._route = null; v._routeDest = null; view.vehOrderMode = null; view.buildPt0 = null; }
```

with:

```js
        if (kind === "defend") { v.order = "defend"; v.dest = null; v.goal = null; v._route = null; v._routeDest = null; v._queue = null; view.vehOrderMode = null; view.buildPt0 = null; }
```

**4e.** In `acceptLine`'s vehicle branch, replace exactly:

```js
          if (v && v.alive) {
            v._patA = { x: lp.a.x, z: lp.a.z }; v._patB = { x: lp.b.x, z: lp.b.z };
            v.order = "patrol"; v.dest = { x: lp.a.x, z: lp.a.z }; v._route = null; v._routeDest = null;
          }
```

with:

```js
          if (v && v.alive) {
            // mk2.91: QUEUE lit with a moving head — the patrol appends as
            // the terminal leg and the light goes out.
            if (view.queueOn && (v.order === "move" || v.order === "attack") && v.dest) {
              (v._queue || (v._queue = [])).push({ kind: "patrol", ax: lp.a.x, az: lp.a.z, bx: lp.b.x, bz: lp.b.z });
              view.queueOn = false;
            } else {
              v._patA = { x: lp.a.x, z: lp.a.z }; v._patB = { x: lp.b.x, z: lp.b.z };
              v.order = "patrol"; v.dest = { x: lp.a.x, z: lp.a.z }; v._route = null; v._routeDest = null;
              v._queue = null; // mk2.91: a plain order wipes the chain
            }
          }
```

**4f.** In `view.takeControlVehicle`, replace exactly:

```js
        v.order = "defend"; v.dest = null; v.goal = null; v._route = null; v._routeDest = null;
        input.fireHeld = false; input.mgHeld = false;
```

with:

```js
        v.order = "defend"; v.dest = null; v.goal = null; v._route = null; v._routeDest = null; v._queue = null; // mk2.91
        input.fireHeld = false; input.mgHeld = false;
```

### Step 5 — the group fans wipe

**5a.** In `consumeGroupOrderTap`, replace exactly:

```js
          if (gsq) { gsq.order = om; gsq.dest = { x: d.x, z: d.z }; gsq._legTarget = null; gsq._pauseT = 0; gsq._build = null; }
```

with:

```js
          if (gsq) { gsq.order = om; gsq.dest = { x: d.x, z: d.z }; gsq._legTarget = null; gsq._pauseT = 0; gsq._build = null; gsq._queue = null; }
```

**5b.** In `consumeGroupOrderTap`, replace exactly:

```js
          if (gv && gv.alive) { gv.order = om; gv.dest = { x: d.x, z: d.z }; gv._route = null; gv._routeDest = null; }
```

with:

```js
          if (gv && gv.alive) { gv.order = om; gv.dest = { x: d.x, z: d.z }; gv._route = null; gv._routeDest = null; gv._queue = null; }
```

**5c.** In `view.orderGroup`'s defend branch, replace exactly:

```js
            gv.order = "defend"; gv.dest = null; gv.goal = null; gv._route = null; gv._routeDest = null;
```

with:

```js
            gv.order = "defend"; gv.dest = null; gv.goal = null; gv._route = null; gv._routeDest = null; gv._queue = null;
```

(The squad side of orderGroup's defend already gets `gsq._queue = null` — its body is orderSquad's defend fan, whose lines 3b re-signs; orderGroup carries its own copy of those lines, so apply 3b's same three-line replacement there too — the `gsq._build = null;` line inside `view.orderGroup` gains the same `gsq._queue = null;` line after it.)

**5d.** In `view.orderGroup`'s defend branch, replace exactly:

```js
            gsq.order = "defend"; gsq.dest = null; gsq._legTarget = null; gsq._pauseT = 0; gsq._threatSig = undefined;
            gsq._surveyPending = true;
            gsq._build = null;
          }
          for (const vid of gs.vehIds) {
```

with:

```js
            gsq.order = "defend"; gsq.dest = null; gsq._legTarget = null; gsq._pauseT = 0; gsq._threatSig = undefined;
            gsq._surveyPending = true;
            gsq._build = null;
            gsq._queue = null; // mk2.91
          }
          for (const vid of gs.vehIds) {
```

(Note: 3b's block and 5d's block share their first three lines; apply 3b FIRST and match 5d by its trailing `for (const vid of gs.vehIds) {` line, which only orderGroup has.)

### Step 6 — the light goes out on deselect

**6a.** In the tap pick branch, replace exactly:

```js
          view.groupSel = null; view.groupOrderMode = null; // mk2.89: a single pick releases the group
```

with:

```js
          view.groupSel = null; view.groupOrderMode = null; // mk2.89: a single pick releases the group
          view.queueOn = false; // mk2.91: a fresh selection starts unlit
```

**6b.** In the empty-tap deselect pair, replace exactly:

```js
        if (view.selSquadId != null) { view.selSquadId = null; view.selSquadIds = null; view.orderMode = null; view.buildPt0 = null; view.pieOpen = false; return; }
        if (view.selVehId != null) { view.selVehId = null; view.vehOrderMode = null; view.buildPt0 = null; view.pieOpen = false; return; }
```

with:

```js
        if (view.selSquadId != null) { view.selSquadId = null; view.selSquadIds = null; view.orderMode = null; view.buildPt0 = null; view.pieOpen = false; view.queueOn = false; return; }
        if (view.selVehId != null) { view.selVehId = null; view.vehOrderMode = null; view.buildPt0 = null; view.pieOpen = false; view.queueOn = false; return; }
```

**6c.** In `view.selectScreen`'s clear list, replace exactly:

```js
        view.selVehId = null; view.vehOrderMode = null; view.inspectId = null;
```

with:

```js
        view.selVehId = null; view.vehOrderMode = null; view.inspectId = null; view.queueOn = false;
```

### Step 7 — the flags on the ground

**7a.** Immediately after the mk2.89 group-anchor block's final line, replace exactly:

```js
            } else view.groupScreen = null;
```

with:

```js
            } else view.groupScreen = null;
            // mk2.91: the chain's numbered flags — the selected unit's queued
            // legs, projected fresh every frame (a patrol leg flags its near
            // end). Same recipe as every screen anchor above.
            const chainOwner = view.groupSel == null ? (view.selVehId != null ? world.byId.get(view.selVehId) : selSq) : null;
            if (chainOwner && chainOwner._queue && chainOwner._queue.length && R.project) {
              const rect7 = canvas.getBoundingClientRect();
              view.chainScreens = chainOwner._queue.map((q, i) => {
                const qx = q.kind === "patrol" ? q.ax : q.x, qz = q.kind === "patrol" ? q.az : q.z;
                const nd7 = R.project(qx, field.heightAt(qx, qz) + 1.6, qz);
                return nd7 ? { x: rect7.left + (nd7.x * 0.5 + 0.5) * rect7.width, y: rect7.top + (-nd7.y * 0.5 + 0.5) * rect7.height, i, pat: q.kind === "patrol" ? 1 : 0 } : null;
              }).filter(Boolean);
            } else view.chainScreens = null;
```

**7b.** In the hud object, replace exactly:

```js
              squadFlag: view.flagScreen ? { x: view.flagScreen.x, y: view.flagScreen.y } : null,
```

with:

```js
              squadFlag: view.flagScreen ? { x: view.flagScreen.x, y: view.flagScreen.y } : null,
              chainFlags: view.chainScreens, // mk2.91: the queued legs' numbered flags
```

**7c.** In the squadRadial hud entry, replace exactly:

```js
                return { id: sq.id, label: SQUAD_SPECS[sq.type].label, order: sq.order, count: view.selSquadIds ? view.selSquadIds.length : 1, x: view.squadScreen.x, y: view.squadScreen.y, armed: world.t >= view.selArmedAt, aiming: view.orderMode === "attack", aimingMove: view.orderMode === "move",
```

with:

```js
                return { id: sq.id, label: SQUAD_SPECS[sq.type].label, order: sq.order, count: view.selSquadIds ? view.selSquadIds.length : 1, x: view.squadScreen.x, y: view.squadScreen.y, armed: world.t >= view.selArmedAt, aiming: view.orderMode === "attack", aimingMove: view.orderMode === "move",
                  queueOn: view.queueOn, chained: (sq._queue && sq._queue.length) || 0, // mk2.91
```

**7d.** In the vehRadial hud entry, replace exactly:

```js
                  aimingMove: view.vehOrderMode === "move", aimingAttack: view.vehOrderMode === "attack", aimingPatrol: view.vehOrderMode === "patrol", aimingEscort: view.vehOrderMode === "escort",
```

with:

```js
                  aimingMove: view.vehOrderMode === "move", aimingAttack: view.vehOrderMode === "attack", aimingPatrol: view.vehOrderMode === "patrol", aimingEscort: view.vehOrderMode === "escort",
                  queueOn: view.queueOn, chained: (v._queue && v._queue.length) || 0, // mk2.91
```

### Step 8 — the wedges and the flags' JSX

**8a.** In the squad pie's slots, immediately after the line

```js
          { key: "move", icon: "→", label: "MOVE", color: "#7fd7ff", on: sq.aimingMove || sq.order === "move", card: "move", act: () => stateRef.current && stateRef.current.view.orderSquad("move") },
```

insert:

```js
          { key: "queue", icon: "⛓", label: "QUEUE", color: "#ffd27a", on: sq.queueOn, card: "queue_chain", act: () => { const C = stateRef.current; if (C) { C.view.toggleQueue(); C.view._keepPie = true; } } },
          ...(sq.chained ? [{ key: "clearchain", icon: "✂", label: "CLEAR (" + sq.chained + ")", color: "#ff9a7a", on: false, card: "clear_chain", act: () => { const C = stateRef.current; if (C) { C.view.clearChain(); C.view._keepPie = true; } } }] : []),
```

**8b.** In the vehicle pie's slots, immediately after the line

```js
          { key: "attack", icon: "✕", label: "ATTACK", color: "#ff9a7a", on: vr.aimingAttack || vr.order === "attack", card: "attack", act: () => stateRef.current && stateRef.current.view.orderVehicle("attack") },
```

insert:

```js
          { key: "queue", icon: "⛓", label: "QUEUE", color: "#ffd27a", on: vr.queueOn, card: "queue_chain", act: () => { const C = stateRef.current; if (C) { C.view.toggleQueue(); C.view._keepPie = true; } } },
          ...(vr.chained ? [{ key: "clearchain", icon: "✂", label: "CLEAR (" + vr.chained + ")", color: "#ff9a7a", on: false, card: "clear_chain", act: () => { const C = stateRef.current; if (C) { C.view.clearChain(); C.view._keepPie = true; } } }] : []),
```

**8c.** Immediately after the squad-flag JSX block, replace exactly:

```js
      {hud.squadFlag && (
        <div data-squad-flag style={{ position: "absolute", left: hud.squadFlag.x, top: hud.squadFlag.y, transform: "translate(-50%, -100%)", zIndex: 6, pointerEvents: "none", color: "#ff6b5e", fontSize: 18 }}>⚑</div>
      )}
```

with:

```js
      {hud.squadFlag && (
        <div data-squad-flag style={{ position: "absolute", left: hud.squadFlag.x, top: hud.squadFlag.y, transform: "translate(-50%, -100%)", zIndex: 6, pointerEvents: "none", color: "#ff6b5e", fontSize: 18 }}>⚑</div>
      )}
      {hud.chainFlags && hud.chainFlags.map((f) => (
        <div key={f.i} data-chain-flag={f.i} style={{ position: "absolute", left: f.x, top: f.y, transform: "translate(-50%, -100%)", zIndex: 6, pointerEvents: "auto", cursor: "pointer", color: "#ffd27a", fontSize: 14, textAlign: "center", textShadow: "0 1px 2px #000" }}
          onClick={() => { const C = stateRef.current; if (C) C.view.deleteLeg(f.i); }}>
          {f.pat ? "⇄" : "⚑"}<div style={{ fontSize: 10, lineHeight: "10px" }}>{f.i + 1}</div>
        </div>
      ))}
```

### Step 9 — the teaching cards (`src/depot/cards.js`)

Immediately after the line

```js
  select_all: { label: "SELECT ALL", role: "Every squad of this type joins the order.", hint: "The same ring.", skills: [] },
```

insert:

```js
  queue_chain: { label: "QUEUE", role: "Light it, then aim orders — each lands at the end of the chain. A patrol closes it.", hint: "The chain ends at a patrol.", skills: [] },
  clear_chain: { label: "CLEAR", role: "Drops every queued leg. The current order keeps running.", hint: "The chain only.", skills: [] },
```

### Step 10 — gates, with one licensed re-teach

Run blocking, in order:

- `node scripts/gate.mjs depot-test` — required: the twelve Step-1 pins PASS, and ONE licensed re-teach: Step 4b moves the vehicle-attack tap into the shared branch, so `35-the-armor-attack.mjs`'s pin `(f) pins: the attack tap sets the order` no longer matches its old literal. Re-teach that pin's regex from

```js
  ok("(f) pins: the attack tap sets the order", /v\.order = "attack"; v\.dest = \{ x: d\.x, z: d\.z \};/.test(dg));
```

to

```js
  ok("(f) pins: the attack tap sets the order", /v\.order = om; v\.dest = \{ x: d\.x, z: d\.z \}; v\._route = null; v\._routeDest = null; v\._queue = null;/.test(dg));
```

  — asserted mechanism identical (the tap sets the order and the destination), reported old→new. Every other pre-existing test must PASS with no further re-teach; any other failure stops the task.
- `node scripts/gate.mjs depot-lint` — required: green.
- `node scripts/gate.mjs smoke` — required: green.

No engine file touched — no golden gate.

### Step 11 — version, build, land

- `src/version.js`: `mk2.90` → `mk2.91`.
- `npm run build` (after the bump, never before).
- Commit and push. Suggested subject: `the chain builder — the QUEUE wedge, the numbered flags, and the wipe, mk2.91`. Include this plan file.

## Acceptance

- Arithmetic: `depot-test` exits 0 with all twelve new pins PASS and the one licensed re-teach in place; `depot-lint` exits 0; `smoke` exits 0. No fixture seeds — source pins only.
- The owner's live check: select a squad, light QUEUE, tap three points — numbered flags stand; accept a patrol — the light goes out and the chain ends in a loop; tap a flag — that leg vanishes; CLEAR drops the rest; a plain order wipes everything. Same on the Bison. Phone and desktop both.
