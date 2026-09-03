# The Visible Chain (mk2.92)

The owner's correction to mk2.91 (2026-09-03): the chain must show as a visible queue of COMMANDS — a list panel, each row deletable — and the round selector must stay standing while QUEUE is lit, so wedge tap plus ground tap lays leg after leg without re-opening anything. The numbered ground flags stay as the spatial half. This also fixes a mk2.91 defect found in the reading: the vehicle pie's chooser ignores `_keepPie`, so its QUEUE wedge closed the disc it was supposed to hold open.

Suggested model: Sonnet 5 — one file plus a pin test, every code block carried below verbatim.

Design choices, stated:
- The panel stands while a single squad or hull is selected and either QUEUE is lit or a chain exists. It reads the active order first (marked ▶, not deletable), then the queued legs 1..n, each with a ✗ that deletes that leg — the same `deleteLeg` the flags use.
- It sits at the screen's left edge, mid-height, clear of the pie, the bottom bar, and the possession controls. Same DOM on phone and desktop.
- While QUEUE is lit, choosing any wedge keeps the pie open on both pies. With the light out, wedges close the pie exactly as today. Tower and group pies untouched.
- No engine, sim, or save touch.

## Required reading

- This plan, whole.
- `src/depot/DepotGame.jsx` lines 3195–3215 (the hud chain entries), 3975–3995 (the squad pie's return), 4080–4095 (the vehicle pie's return), 4120–4160 (the chain-flag JSX and its neighbors).
- `scripts/tests/38-the-chain-builder.mjs` (the pin convention).

Report opens with confirmation these were read.

## Steps

### Step 1 — the failing pins

Create `scripts/tests/39-the-visible-chain.mjs` with exactly:

```js
import { ok } from "./harness.mjs";
import fs from "node:fs";

// ==== mk2.92: the visible chain =============================================
// The chain shows as a list of commands, each row deletable, and both pies
// hold their disc while QUEUE is lit. Source pins — no sim, no seeds.
{
  console.log("\n[mk2.92: the visible chain]");
  const dg = fs.readFileSync("src/depot/DepotGame.jsx", "utf8");
  ok("pins: both pies hold their disc while QUEUE is lit", (dg.match(/else if \(!C\.view\.queueOn\) C\.view\.pieOpen = false;/g) || []).length === 2);
  ok("pins: the queue panel stands", /data-chain-list/.test(dg) && /chainList: \(\(\) => \{/.test(dg));
  ok("pins: the panel leads with the active order", /▶/.test(dg));
  ok("pins: each row deletes its own leg", /data-chain-row/.test(dg) && /C\.view\.deleteLeg\(i\)/.test(dg));
}
```

In `scripts/depot-test.mjs`, after the line

```js
await import("./tests/38-the-chain-builder.mjs");
```

insert

```js
await import("./tests/39-the-visible-chain.mjs");
```

Run `node scripts/gate.mjs depot-test` blocking. Required result: exactly the four new pins FAIL; every pre-existing test PASSES. Any other pattern stops the task.

### Step 2 — the pies hold their disc (`src/depot/DepotGame.jsx`)

**2a.** The squad pie (currently line 3985). Replace exactly:

```js
          ? <RadialMenu cx={sq.x} cy={sq.y} label={lbl + status} slots={slots} armed={sq.armed} onChoose={() => { const C = stateRef.current; if (C) { if (C.view._keepPie) C.view._keepPie = false; else C.view.pieOpen = false; } }} press={teachPress} showInfo={!isTouch} onCard={(k) => { const C = stateRef.current; if (C && C.view.openInfo) C.view.openInfo(k, "bar"); }} />
```

with:

```js
          ? <RadialMenu cx={sq.x} cy={sq.y} label={lbl + status} slots={slots} armed={sq.armed} onChoose={() => { const C = stateRef.current; if (C) { if (C.view._keepPie) C.view._keepPie = false; else if (!C.view.queueOn) C.view.pieOpen = false; } }} press={teachPress} showInfo={!isTouch} onCard={(k) => { const C = stateRef.current; if (C && C.view.openInfo) C.view.openInfo(k, "bar"); }} />
```

**2b.** The vehicle pie (currently line 4088 — the line carrying `label={vLabel + status}`; the tower and group pies share the bare chooser text and are NOT touched, so the whole line is the anchor). Replace exactly:

```js
          ? <RadialMenu cx={vr.x} cy={vr.y} label={vLabel + status} slots={slots} armed={vr.armed} onChoose={() => { const C = stateRef.current; if (C) C.view.pieOpen = false; }} press={teachPress} showInfo={!isTouch} onCard={(k) => { const C = stateRef.current; if (C && C.view.openInfo) C.view.openInfo(k, "bar"); }} />
```

with:

```js
          ? <RadialMenu cx={vr.x} cy={vr.y} label={vLabel + status} slots={slots} armed={vr.armed} onChoose={() => { const C = stateRef.current; if (C) { if (C.view._keepPie) C.view._keepPie = false; else if (!C.view.queueOn) C.view.pieOpen = false; } }} press={teachPress} showInfo={!isTouch} onCard={(k) => { const C = stateRef.current; if (C && C.view.openInfo) C.view.openInfo(k, "bar"); }} />
```

(This is also the mk2.91 defect fix: the vehicle chooser now honors `_keepPie`, so the QUEUE and CLEAR wedges hold the disc as intended.)

### Step 3 — the hud entry

Replace exactly (currently line 3207):

```js
              chainFlags: view.chainScreens, // mk2.91: the queued legs' numbered flags
```

with:

```js
              chainFlags: view.chainScreens, // mk2.91: the queued legs' numbered flags
              chainList: (() => { // mk2.92: the visible queue of commands
                const o = view.groupSel == null ? (view.selVehId != null ? world.byId.get(view.selVehId) : (view.selSquadId != null ? run.squads.find((q) => q.id === view.selSquadId) : null)) : null;
                if (!o || (!view.queueOn && !(o._queue && o._queue.length))) return null;
                const w = (k) => k === "move" ? "MOVE" : k === "attack" ? "ATTACK" : k === "patrol" ? "PATROL" : k === "build" ? "BUILD" : k === "escort" ? "ESCORT" : "DEFEND";
                return { active: w(o.order || "defend"), legs: (o._queue || []).map((q) => w(q.kind)) };
              })(),
```

### Step 4 — the panel

Replace exactly (the chain-flag JSX block mk2.91 added):

```js
      {hud.chainFlags && hud.chainFlags.map((f) => (
```

with:

```js
      {hud.chainList && (
        <div data-chain-list style={{ position: "absolute", left: 8, top: "32%", zIndex: 6, display: "flex", flexDirection: "column", gap: 4, background: "rgba(14,18,24,0.88)", border: "1px solid #48515f", borderRadius: 8, padding: "6px 10px", pointerEvents: "auto", fontSize: 11, letterSpacing: 1, minWidth: 96 }}>
          <div style={{ color: "#ffd27a", fontSize: 10 }}>THE CHAIN</div>
          <div style={{ color: "#9fb2c8" }}>▶ {hud.chainList.active}</div>
          {hud.chainList.legs.map((l, i) => (
            <div key={i} data-chain-row={i} style={{ display: "flex", alignItems: "center", gap: 6, color: "#e6ebf1" }}>
              <span style={{ color: "#ffd27a" }}>{i + 1}</span>
              <span style={{ flex: 1 }}>{l}</span>
              <span style={{ color: "#ff6b5e", cursor: "pointer", padding: "0 4px" }}
                onClick={() => { const C = stateRef.current; if (C) C.view.deleteLeg(i); }}>✗</span>
            </div>
          ))}
        </div>
      )}
      {hud.chainFlags && hud.chainFlags.map((f) => (
```

### Step 5 — gates

Run blocking, in order: `node scripts/gate.mjs depot-test` (the four pins PASS, everything else PASSES), `node scripts/gate.mjs depot-lint`, `node scripts/gate.mjs smoke` — all green. No golden gate. The sweep license is NOT granted; the count-pin sweep was run at plan-writing time — no count pin in the suite covers the pie choosers, the hud keys, or the panel.

### Step 6 — version, build, land

- `src/version.js`: `mk2.91` → `mk2.92`.
- `npm run build` (after the bump, never before).
- Commit and push. Suggested subject: `the visible chain — the command list, and the disc that stays, mk2.92`. Include this plan file.

## Acceptance

- Arithmetic: `depot-test` exits 0 with all four new pins PASS; `depot-lint` exits 0; `smoke` exits 0. No fixture seeds — source pins only.
- The owner's live check: select a unit, light QUEUE — the disc stays up through every wedge and tap; THE CHAIN panel stands at the left edge listing the active order and every queued leg; ✗ a row and it vanishes everywhere; the light out, wedges close the disc as before. Phone and desktop both.
