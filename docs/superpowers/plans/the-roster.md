# The Roster (mk2.96)

Task 2 of 2 for the roster feature (owner, 2026-09-03). A ⚏ ROSTER button beside ∷ ALL opens a panel listing the living force — every player squad and hull, its strength, and the kills mk2.95 counts. Tapping a row jumps the camera to the unit, selects it, and opens its pie; the panel closes. Dead units drop off with their record; the count shows here and nowhere else.

Suggested model: Sonnet 5 — one file plus a pin test, every code block carried below verbatim.

Design choices, stated:
- Rows: squads first in hire order (label, ×live, kills), then hulls in body order (BISON/APC/MECH, HP, kills). An empty force reads "NO ONE TO COMMAND."
- The panel stands at the right edge, mid-height, scrolls past half the screen, and hides during possession. It closes on the button's re-tap or a row tap; it is a menu, not a selection, so ground taps leave it alone.
- The jump reuses the focus-set the debug helper already uses, then the pick branch's own selection hygiene: everything else deselects, the pie arms and opens, the QUEUE light goes out.
- No engine, sim, or save touch; `rosterOpen` is view state and never rides.
- Phone and desktop: the same button and panel DOM.

## Required reading

- This plan, whole.
- `src/depot/DepotGame.jsx` lines 555–565 (the view-state line), 1145–1175 (`deleteLeg`'s tail, where the jump lands), 2395–2405 (the focus-set recipe), 3230–3245 (the chainList hud entry's tail), 4030–4040 (the chain-list JSX opening), 4185–4200 (the ∷ ALL button).
- `scripts/tests/42-the-credit-trail.mjs` (the pin convention).

Report opens with confirmation these were read.

## Steps

### Step 1 — the failing pins

Create `scripts/tests/43-the-roster.mjs` with exactly:

```js
import { ok } from "./harness.mjs";
import fs from "node:fs";

// ==== mk2.96: the roster ====================================================
// The button, the living force's rows with their kills, and the tap-to-jump.
// Source pins — no sim runs, no fixture seeds.
{
  console.log("\n[mk2.96: the roster]");
  const dg = fs.readFileSync("src/depot/DepotGame.jsx", "utf8");
  ok("pins: the button stands beside ALL", /data-roster-toggle/.test(dg) && /⚏ ROSTER/.test(dg));
  ok("pins: the panel lists the living force", /data-roster/.test(dg) && /NO ONE TO COMMAND/.test(dg) && /data-roster-row/.test(dg));
  ok("pins: the rows carry the kills", /✜ \{r\.kills\}/.test(dg));
  ok("pins: the hud builds the rows from squads and hulls", /roster: view\.rosterOpen \? \(\(\) => \{/.test(dg));
  ok("pins: a tapped row jumps, selects, and closes the panel", /view\.rosterJump = \(kindR, idR\) => \{/.test(dg) && /view\.rosterOpen = false;/.test(dg));
  ok("pins: the panel hides under possession", /\{hud\.roster && !hud\.possessed && \(/.test(dg));
}
```

In `scripts/depot-test.mjs`, after the line

```js
await import("./tests/42-the-credit-trail.mjs");
```

insert

```js
await import("./tests/43-the-roster.mjs");
```

Run `node scripts/gate.mjs depot-test` blocking. Required result: exactly the six new pins FAIL; every pre-existing test PASSES. Any other pattern stops the task.

### Step 2 — view state (`src/depot/DepotGame.jsx`)

Replace exactly:

```js
        queueOn: false, chainScreens: null, // mk2.91: the chain builder — the QUEUE light and the legs' projected flags
```

with:

```js
        queueOn: false, chainScreens: null, // mk2.91: the chain builder — the QUEUE light and the legs' projected flags
        rosterOpen: false, // mk2.96: the roster panel
```

### Step 3 — the jump

Immediately after `view.deleteLeg`'s closing (the three lines below are its whole body — anchor on all of it), replace exactly:

```js
      view.deleteLeg = (i) => {
        const o = view.selVehId != null ? world.byId.get(view.selVehId) : selectedSquad();
        if (o && o._queue && i >= 0 && i < o._queue.length) { o._queue.splice(i, 1); if (!o._queue.length) o._queue = null; }
      };
```

with:

```js
      view.deleteLeg = (i) => {
        const o = view.selVehId != null ? world.byId.get(view.selVehId) : selectedSquad();
        if (o && o._queue && i >= 0 && i < o._queue.length) { o._queue.splice(i, 1); if (!o._queue.length) o._queue = null; }
      };
      // mk2.96 (owner): THE ROSTER's jump — a tapped row centers the camera
      // on the unit, selects it with the pick branch's own hygiene, and
      // opens its pie; the panel closes.
      view.rosterJump = (kindR, idR) => {
        let x = null, z = null;
        if (kindR === "sq") {
          const sq = run.squads.find((q) => q.id === idR);
          if (!sq) return;
          x = sq.anchor.x; z = sq.anchor.z;
          view.selSquadId = idR; view.selVehId = null;
        } else {
          const vb = world.byId.get(idR);
          if (!vb || !vb.alive) return;
          x = vb.pos.x; z = vb.pos.z;
          view.selVehId = idR; view.selSquadId = null;
        }
        view.selSquadIds = null; view.inspectId = null; view.orderMode = null; view.vehOrderMode = null;
        view.buildPt0 = null; view.linePending = null; view.groupSel = null; view.groupOrderMode = null; view.queueOn = false;
        view.selArmedAt = world.t + PENDING_ARM_S; view.pieOpen = true;
        run.focus.x = x; run.focus.z = z; run.focus.y = field.heightAt(x, z);
        view.rosterOpen = false;
        R.overlay.setLinePreview(false);
      };
```

### Step 4 — the hud rows

Immediately after the chainList entry's closing pair (the two lines below — the return line is unique), replace exactly:

```js
                return { active: w(o.order || "defend"), legs: (o._queue || []).map((q) => q.kind === "line" ? (q.line === "walls" ? "WALLS" : q.line === "bags" ? "BAGS" : q.line === "mines" ? "MINES" : "WIRE") : w(q.kind)) };
              })(),
```

with:

```js
                return { active: w(o.order || "defend"), legs: (o._queue || []).map((q) => q.kind === "line" ? (q.line === "walls" ? "WALLS" : q.line === "bags" ? "BAGS" : q.line === "mines" ? "MINES" : "WIRE") : w(q.kind)) };
              })(),
              // mk2.96: the roster — the living force and its kills, built
              // only while the panel is open.
              roster: view.rosterOpen ? (() => {
                const rows = [];
                for (const sqR of run.squads) {
                  let live = 0;
                  for (const id of sqR.memberIds) { const u = world.byId.get(id); if (u && u.alive) live++; }
                  if (live) rows.push({ kind: "sq", id: sqR.id, label: SQUAD_SPECS[sqR.type].label, n: live, kills: sqR.kills || 0 });
                }
                for (const vb of world.bodies) {
                  if ((vb.kind !== "vehicle" && vb.kind !== "mech") || !vb.alive || vb.team !== 1 || !vb.drv) continue;
                  rows.push({ kind: "veh", id: vb.id, label: vb.kind === "mech" ? "MECH" : vb.vtype === "apc" ? "APC" : "BISON", n: Math.max(1, Math.round(vb.hp)), kills: vb.kills || 0 });
                }
                return rows;
              })() : null,
```

### Step 5 — the panel

Immediately before the line (currently 4034)

```js
      {hud.chainList && (
```

insert:

```js
      {hud.roster && !hud.possessed && (
        <div data-roster style={{ position: "absolute", right: 8, top: "20%", zIndex: 6, display: "flex", flexDirection: "column", gap: 4, background: "rgba(14,18,24,0.92)", border: "1px solid #48515f", borderRadius: 8, padding: "6px 10px", pointerEvents: "auto", fontSize: 11, letterSpacing: 1, minWidth: 150, maxHeight: "55vh", overflowY: "auto" }}>
          <div style={{ color: "#9fdcff", fontSize: 10 }}>THE ROSTER</div>
          {hud.roster.length === 0 && <div style={{ opacity: 0.7 }}>NO ONE TO COMMAND</div>}
          {hud.roster.map((r) => (
            <div key={r.kind + r.id} data-roster-row={r.kind + ":" + r.id} style={{ display: "flex", alignItems: "center", gap: 8, color: "#e6ebf1", cursor: "pointer", padding: "2px 0" }}
              onClick={() => { const C = stateRef.current; if (C) C.view.rosterJump(r.kind, r.id); }}>
              <span style={{ flex: 1 }}>{r.label}</span>
              <span style={{ opacity: 0.7 }}>{r.kind === "sq" ? "×" + r.n : "HP " + r.n}</span>
              <span style={{ color: "#ffd27a", minWidth: 28, textAlign: "right" }}>✜ {r.kills}</span>
            </div>
          ))}
        </div>
      )}
```

### Step 6 — the button

Immediately after the ∷ ALL button's closing (the four lines below are the whole block from mk2.89 — anchor on all of it), replace exactly:

```js
          <button data-group-select
            style={{ ...P.slot, minHeight: 44, justifyContent: "center", borderColor: "#2f8f4f", background: "#12331f", color: "#7dffa8", fontWeight: "bold", letterSpacing: 1 }}
            onClick={() => { const C = stateRef.current; if (C) C.view.selectScreen(); }}>
            ∷ ALL
          </button>
```

with:

```js
          <button data-group-select
            style={{ ...P.slot, minHeight: 44, justifyContent: "center", borderColor: "#2f8f4f", background: "#12331f", color: "#7dffa8", fontWeight: "bold", letterSpacing: 1 }}
            onClick={() => { const C = stateRef.current; if (C) C.view.selectScreen(); }}>
            ∷ ALL
          </button>
          <button data-roster-toggle
            style={{ ...P.slot, minHeight: 44, justifyContent: "center", borderColor: "#3a6f8f", background: "#122433", color: "#9fdcff", fontWeight: "bold", letterSpacing: 1 }}
            onClick={() => { const C = stateRef.current; if (C) C.view.rosterOpen = !C.view.rosterOpen; }}>
            ⚏ ROSTER
          </button>
```

### Step 7 — gates

Run blocking, in order: `node scripts/gate.mjs depot-test` (the six pins PASS, everything else PASSES), `node scripts/gate.mjs depot-lint`, `node scripts/gate.mjs smoke` — all green. No golden gate. The sweep license is NOT granted. Plan-writing sweeps ran clean: no count or literal pin covers these sites, and neither ⚏ nor ✜ appears anywhere in the file today.

### Step 8 — version, build, land

- `src/version.js`: `mk2.95` → `mk2.96`.
- `npm run build` (after the bump, never before).
- Commit and push. Suggested subject: `the roster — the living force, its kills, and the jump, mk2.96`. Include this plan file.

## Acceptance

- Arithmetic: `depot-test` exits 0 with all six new pins PASS; `depot-lint` exits 0; `smoke` exits 0. No fixture seeds — source pins only.
- The owner's live check: tap ⚏ ROSTER — the force lists with kills accruing as the war runs; tap a row — the camera lands on the unit with its pie open and the panel gone; lose a squad — its row is gone next open. Phone and desktop both.
