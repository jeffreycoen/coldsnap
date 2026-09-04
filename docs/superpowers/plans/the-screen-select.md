# The Screen Select (mk2.89)

Task 2 of 2 for the screen-select feature. A green ALL button on the bottom bar sweeps every live player squad and hull the camera can see into one group; a three-wedge reticle — MOVE, DEFEND, ATTACK — opens at the group's centroid and orders them all together. Depends on task 1 (mk2.88): the ATTACK order for hulls is already live.

Suggested model: Sonnet 5 — one file plus a pin test, every code block carried below verbatim.

Rulings this plan rests on: green button; bottom bar; everyone on screen joins, vehicles included, busy or not; reticle at the group's centroid.

Design choices, stated:
- The sweep is the button's moment: what the camera sees when pressed joins; the group does not re-follow the camera afterward.
- "Player hull" means a live team-1 vehicle or mech with a driver policy (`b.drv`) — the Bison, the APC, the mech. Wrecks, trucks, and enemy armor never join. A possessed unit cannot be swept (the button's method refuses while a possession is live; the bar is hidden then anyway).
- The reticle reuses the existing DEFEND/MOVE/ATTACK teaching cards — same words, both audiences; the card registry is untouched.
- Group DEFEND is the squad pie's own defend, fanned, plus the hull's defend (order, dest, goal, route cleared). Group MOVE/ATTACK arm one ground tap that lands on every member at once, then the group is released — the squad group-order convention.
- Selecting any single unit, or tapping empty ground, releases the group — the existing deselect grammar.
- The reticle's centroid is projected fresh every frame (rotation- and pan-proof, the squad chip anchor's own recipe). If every member dies, the group clears itself.
- Symmetry: player interface only; the enemy's command layer is its own machine. No engine, sim, or save touch anywhere in this task — `groupSel` lives in view state and never rides a save.
- Phone and desktop: the button sits on the one bottom bar both platforms share; the reticle is the same RadialMenu both platforms already use.

## Required reading

- This plan, whole.
- `src/depot/DepotGame.jsx` lines 60–80 (the style table), 530–560 (view state), 925–1055 (selection and squad orders), 1250–1360 (the tap consumers), 1530–1600 (tapAt), 2915–2945 (the screen anchors), 3000–3065 (the hud radial blocks), 3740–3760 (the squad pie slots), 3865–3900 (the vehicle pie), 3925–3955 (the bottom bar).
- `scripts/tests/35-the-armor-attack.mjs` (the pin-test convention this file follows).

Report opens with confirmation these were read.

## Steps

### Step 1 — the failing pins

Create `scripts/tests/36-the-screen-select.mjs` with exactly:

```js
import { ok } from "./harness.mjs";
import fs from "node:fs";

// ==== mk2.89: the screen select =============================================
// The green ALL button sweeps every live player squad and hull on screen
// into one group; a three-wedge reticle (MOVE / DEFEND / ATTACK) at the
// group's centroid orders them together. Interface work — the suite pins the
// mechanism's lines; no sim runs here, so no fixture seeds.
{
  console.log("\n[mk2.89: the screen select]");
  const dg = fs.readFileSync("src/depot/DepotGame.jsx", "utf8");
  ok("pins: the green ALL button calls the sweep", /data-group-select/.test(dg) && /C\.view\.selectScreen\(\);/.test(dg));
  ok("pins: the sweep filters by the live camera", /const nd = R\.project\(x, y, z\);/.test(dg) && /view\.groupSel = \{ sqIds, vehIds \};/.test(dg));
  ok("pins: the sweep takes hulls with a driver policy only", /\(b\.kind !== "vehicle" && b\.kind !== "mech"\) \|\| !b\.alive \|\| b\.team !== 1 \|\| !b\.drv/.test(dg));
  ok("pins: the group tap fans to squads and hulls alike", /for \(const qid of gs\.sqIds\)/.test(dg) && /for \(const vid of gs\.vehIds\)/.test(dg));
  ok("pins: the group defend clears the hull's road", /gv\.order = "defend"; gv\.dest = null; gv\.goal = null; gv\._route = null; gv\._routeDest = null;/.test(dg));
  ok("pins: the reticle is three wedges", /key: "gdefend"/.test(dg) && /key: "gmove"/.test(dg) && /key: "gattack"/.test(dg));
  ok("pins: the reticle stands at the group's centroid", /view\.groupScreen = nd6/.test(dg));
  ok("pins: the group tap runs before the single-unit consumers", /if \(consumeGroupOrderTap\(p\)\) return;\n\s*if \(consumeVehOrderTap\(p\)\) return;/.test(dg));
}
```

In `scripts/depot-test.mjs`, after the line

```js
await import("./tests/35-the-armor-attack.mjs");
```

insert

```js
await import("./tests/36-the-screen-select.mjs");
```

Run `node scripts/gate.mjs depot-test`. Required result: exactly the eight new pins FAIL; every pre-existing test PASSES. Any other pattern stops the task.

### Step 2 — view state (`src/depot/DepotGame.jsx`)

Replace exactly (currently line 548):

```js
        selVehId: null, vehOrderMode: null,
```

with:

```js
        selVehId: null, vehOrderMode: null,
        groupSel: null, groupOrderMode: null, // mk2.89: the screen select — { sqIds, vehIds } and its own MOVE/ATTACK aim
```

### Step 3 — the sweep and the group orders

Immediately after `view.selectAllType`'s closing brace (currently line 1054, the `};` after `view.selSquadIds = ids.length > 1 ? ids : null;`), insert:

```js
      // mk2.89: THE SCREEN SELECT — every live player squad and hull
      // the camera sees at the button's moment joins one group; the group
      // reticle (three wedges) orders them together. The group does not
      // re-follow the camera afterward.
      view.selectScreen = () => {
        if (run.gameOver || run.victory || input.possess) return;
        const onScreen = (x, y, z) => {
          const nd = R.project(x, y, z);
          return !!nd && Math.abs(nd.x) <= 1 && Math.abs(nd.y) <= 1;
        };
        const sqIds = [];
        for (const sq of run.squads) {
          for (const id of sq.memberIds) {
            const u = world.byId.get(id);
            if (u && u.alive && onScreen(u.pos.x, u.pos.y, u.pos.z)) { sqIds.push(sq.id); break; }
          }
        }
        const vehIds = [];
        for (const b of world.bodies) {
          if ((b.kind !== "vehicle" && b.kind !== "mech") || !b.alive || b.team !== 1 || !b.drv) continue;
          if (onScreen(b.pos.x, b.pos.y, b.pos.z)) vehIds.push(b.id);
        }
        if (!sqIds.length && !vehIds.length) { toast("NO ONE ON SCREEN"); return; }
        view.selSquadId = null; view.selSquadIds = null; view.orderMode = null; view.buildPt0 = null; view.linePending = null;
        view.selVehId = null; view.vehOrderMode = null; view.inspectId = null;
        view.groupSel = { sqIds, vehIds }; view.groupOrderMode = null;
        view.selArmedAt = world.t + PENDING_ARM_S; view.pieOpen = true;
        R.overlay.setLinePreview(false);
      };
      // The group orders: DEFEND lands at once (the squad pie's defend,
      // fanned, plus the hull's); MOVE and ATTACK arm the one ground tap
      // that consumeGroupOrderTap finishes.
      view.orderGroup = (kind) => {
        if (run.gameOver || run.victory) return;
        const gs = view.groupSel;
        if (!gs || world.t < view.selArmedAt) return;
        if (kind === "defend") {
          for (const qid of gs.sqIds) {
            const gsq = run.squads.find((q) => q.id === qid);
            if (!gsq) continue;
            let cx = 0, cz = 0, n = 0;
            for (const id of gsq.memberIds) { const u = world.byId.get(id); if (u && u.alive) { cx += u.pos.x; cz += u.pos.z; n++; } }
            if (n) gsq.anchor = { x: cx / n, z: cz / n };
            gsq.order = "defend"; gsq.dest = null; gsq._legTarget = null; gsq._pauseT = 0; gsq._threatSig = undefined;
            gsq._surveyPending = true;
            gsq._build = null;
          }
          for (const vid of gs.vehIds) {
            const gv = world.byId.get(vid);
            if (!gv || !gv.alive) continue;
            gv.order = "defend"; gv.dest = null; gv.goal = null; gv._route = null; gv._routeDest = null;
          }
          view.groupSel = null; view.groupOrderMode = null; view.pieOpen = false;
        } else if (kind === "move" || kind === "attack") {
          view.groupOrderMode = view.groupOrderMode === kind ? null : kind;
        }
      };
```

### Step 4 — the group's ground tap

Immediately before the line (currently 1253)

```js
      const consumeOrderTap = (p) => {
```

insert:

```js
      // mk2.89: the group's ground tap — MOVE or ATTACK lands on every squad
      // and hull in the sweep at once, then the group is released.
      const consumeGroupOrderTap = (p) => {
        const om = view.groupOrderMode;
        if (!om || !view.groupSel) return false;
        const d = map.clampToRim(p.x, p.z);
        if (map.streamAt(d.x, d.z)) { toast("OPEN WATER — find the crossing"); return true; }
        const gs = view.groupSel;
        for (const qid of gs.sqIds) {
          const gsq = run.squads.find((q) => q.id === qid);
          if (gsq) { gsq.order = om; gsq.dest = { x: d.x, z: d.z }; gsq._legTarget = null; gsq._pauseT = 0; gsq._build = null; }
        }
        for (const vid of gs.vehIds) {
          const gv = world.byId.get(vid);
          if (gv && gv.alive) { gv.order = om; gv.dest = { x: d.x, z: d.z }; gv._route = null; gv._routeDest = null; }
        }
        view.groupSel = null; view.groupOrderMode = null; view.pieOpen = false;
        return true;
      };
```

Then wire it into the tap chain: replace exactly (currently line 1540, inside `tapAt`)

```js
        if (consumeVehOrderTap(p)) return;
```

with:

```js
        if (consumeGroupOrderTap(p)) return;
        if (consumeVehOrderTap(p)) return;
```

### Step 5 — the deselect grammar

**5a.** Picking a single unit releases the group. Replace exactly (currently lines 1577–1578):

```js
          view.selSquadId = null; view.selSquadIds = null; view.selVehId = null; view.inspectId = null;
          view.orderMode = null; view.vehOrderMode = null; view.buildPt0 = null;
```

with:

```js
          view.selSquadId = null; view.selSquadIds = null; view.selVehId = null; view.inspectId = null;
          view.orderMode = null; view.vehOrderMode = null; view.buildPt0 = null;
          view.groupSel = null; view.groupOrderMode = null; // mk2.89: a single pick releases the group
```

**5b.** An empty tap releases the group. Immediately before the line (currently 1588)

```js
        if (view.selSquadId != null) { view.selSquadId = null; view.selSquadIds = null; view.orderMode = null; view.buildPt0 = null; view.pieOpen = false; return; }
```

insert:

```js
        if (view.groupSel) { view.groupSel = null; view.groupOrderMode = null; view.pieOpen = false; return; } // mk2.89
```

### Step 6 — the centroid anchor

Immediately after the vehicle-anchor block's final two lines (currently 2939–2940 — the pair together is unique; the single line alone is not)

```js
              } else view.vehScreen = null;
            } else view.vehScreen = null;
```

insert:

```js
            // mk2.89: the group reticle's anchor — the sweep's centroid of
            // living members, projected fresh every frame (rotation/pan-proof,
            // the squad chip anchor's own recipe). All dead = group clears.
            if (view.groupSel && R.project) {
              const gsA = view.groupSel;
              let gx = 0, gz = 0, gn = 0;
              for (const qid of gsA.sqIds) {
                const gsq = run.squads.find((q) => q.id === qid);
                if (!gsq) continue;
                for (const id of gsq.memberIds) { const u = world.byId.get(id); if (u && u.alive) { gx += u.pos.x; gz += u.pos.z; gn++; } }
              }
              for (const vid of gsA.vehIds) { const gv = world.byId.get(vid); if (gv && gv.alive) { gx += gv.pos.x; gz += gv.pos.z; gn++; } }
              if (gn) {
                const rect6 = canvas.getBoundingClientRect();
                const nd6 = R.project(gx / gn, field.heightAt(gx / gn, gz / gn) + 2.2, gz / gn);
                view.groupScreen = nd6 ? { x: rect6.left + (nd6.x * 0.5 + 0.5) * rect6.width, y: rect6.top + (-nd6.y * 0.5 + 0.5) * rect6.height } : null;
              } else { view.groupSel = null; view.groupOrderMode = null; view.groupScreen = null; }
            } else view.groupScreen = null;
```

### Step 7 — the hud entry

Immediately after the `vehRadial` block's two closing lines (currently 3062–3063)

```js
                  patrolStart: !!view.buildPt0, armed: world.t >= view.selArmedAt, showPie: !!view.pieOpen, linePending: !!view.linePending };
              })(),
```

insert:

```js
              // mk2.89: the group reticle — three wedges at the sweep's centroid.
              groupRadial: view.groupSel && view.groupScreen ? {
                x: view.groupScreen.x, y: view.groupScreen.y,
                count: view.groupSel.sqIds.length + view.groupSel.vehIds.length,
                aimingMove: view.groupOrderMode === "move", aimingAttack: view.groupOrderMode === "attack",
                armed: world.t >= view.selArmedAt, showPie: !!view.pieOpen,
              } : null,
```

### Step 8 — the reticle

Immediately after the vehicle pie's closing line (currently 3898)

```js
      })()}
```

(the one directly following the `vehRadial` RadialMenu return — verify it is the block that begins `{hud.vehRadial && (() => {`), insert:

```js
      {hud.groupRadial && (() => {
        const gr = hud.groupRadial;
        const slots = [
          { key: "gdefend", icon: "∴", label: "DEFEND", color: "#7dffa8", on: false, card: "defend", act: () => { const C = stateRef.current; if (C) C.view.orderGroup("defend"); } },
          { key: "gmove", icon: "→", label: "MOVE", color: "#7fd7ff", on: gr.aimingMove, card: "move", act: () => { const C = stateRef.current; if (C) C.view.orderGroup("move"); } },
          { key: "gattack", icon: "✕", label: "ATTACK", color: "#ff9a7a", on: gr.aimingAttack, card: "attack", act: () => { const C = stateRef.current; if (C) C.view.orderGroup("attack"); } },
        ];
        const status = gr.aimingAttack ? " — TAP THE TARGET GROUND" : gr.aimingMove ? " — TAP GROUND" : "";
        return gr.showPie
          ? <RadialMenu cx={gr.x} cy={gr.y} label={"GROUP (" + gr.count + ")" + status} slots={slots} armed={gr.armed} onChoose={() => { const C = stateRef.current; if (C) C.view.pieOpen = false; }} press={teachPress} showInfo={!isTouch} onCard={(k) => { const C = stateRef.current; if (C && C.view.openInfo) C.view.openInfo(k, "bar"); }} />
          : <div style={{ position: "absolute", left: gr.x, top: gr.y + 26, transform: "translate(-50%,0)", fontSize: 10, letterSpacing: 1, color: "#7dffa8", background: "rgba(14,18,24,0.85)", padding: "1px 6px", borderRadius: 4, zIndex: 7, pointerEvents: "none" }}>{"GROUP (" + gr.count + ")" + status}</div>;
      })()}
```

(After a wedge closes the pie, the label line stays up at the centroid carrying the "TAP GROUND" status until the tap lands — the vehicle pie's own aiming convention.)

### Step 9 — the green button

In the bottom bar, immediately after the `<style>` block's closing pair (currently 3937–3938 — anchor on both lines; `}</style>` alone appears elsewhere in the file)

```js
@keyframes cs-packtrunk { to { transform: scaleY(0); } }
`}</style>
```

insert:

```js
          <button data-group-select
            style={{ ...P.slot, minHeight: 44, justifyContent: "center", borderColor: "#2f8f4f", background: "#12331f", color: "#7dffa8", fontWeight: "bold", letterSpacing: 1 }}
            onClick={() => { const C = stateRef.current; if (C) C.view.selectScreen(); }}>
            ∷ ALL
          </button>
```

### Step 10 — gates

Run in the foreground, in order:

- `node scripts/gate.mjs depot-test` — required: the eight Step-1 pins now PASS, everything else PASSES.
- `node scripts/gate.mjs depot-lint` — required: green.
- `node scripts/gate.mjs smoke` — required: green.

No engine file is touched, so the golden gate is not in this brief. The sweep license is NOT granted: any pre-existing test failure stops the task.

### Step 11 — version, build, land

- `src/version.js`: `mk2.88` → `mk2.89`.
- `npm run build` (after the bump, never before).
- Commit and push. Suggested subject: `the screen select — the green ALL button and the group reticle, mk2.89`. Include this plan file.

## Acceptance

- Arithmetic: `depot-test` exits 0 with all eight new pins PASS; `depot-lint` exits 0; `smoke` exits 0. No fixture seeds — the new tests are source pins; no sim runs.
- The owner's live check: press the green ∷ ALL button — everything on screen joins, the three-wedge reticle stands at the group's middle; DEFEND digs everyone in; MOVE and ATTACK take one ground tap and squads and hulls go together, hulls stopping to fight under ATTACK. Phone and desktop both.
