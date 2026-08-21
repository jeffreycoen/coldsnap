# SLOW FRONT — Phase 3: Command (mk0.80-0.82)

*HISTORY (stamped 2026-08-20, owner's order): this document is a record of shipped work, not authority. Design truth lives in CLAUDE.md and the ACTIVE phase's plan documents; where this file disagrees with them, it is wrong.*

*2026-08-12. One plan, one audience. Scope ratified by the owner today (decision record, "Orders and command"): a radial order menu for squads AND towers replaces the chip row and the order half of the inspect panel; new orders are PATROL and ATTACK STRUCTURES; engineers' build lines migrate into their radial; per-tower fire discipline replaces the global toggle; hold-fire is cut. Three tasks, sequential, one Sonnet 5 agent each, a stop after every landing: mk0.80-0.83 the radial and the pie (shipped), mk0.84 the proposed line, mk0.85 patrol, mk0.86 attack-structures. The next phase (Possession) adds a TAKE CONTROL button to every radial — the layout leaves room.*

**Laws binding every task:** no new dice anywhere (the one leg-arrival draw in the squad machine is the only rng and it is untouched); engine/demo/renderer files untouched (the radial is game-layer interface — plain buttons, existing screen-anchor machinery); `__DEPOTORDER__` keeps driving the real order path; run ONLY the gates listed; every deviation its own labeled bullet; stop after landing.

---

## Task 1 — The radial (mk0.80)

Tap a squad, or place one, or tap a tower: a ring of buttons opens around it. Same orders as today (the new ones come in the next two tasks), new furniture — and towers get their first orders: their own fire discipline, and sell.

**Step 1.1 — failing tests first.** `scripts/depot-test.mjs`, new block `==== COMMAND T1: per-tower discipline`:
- (a) a tower body carrying `discipline: "free"` fires through a friendly-foul situation where a `"careful"` tower holds (fixture: tower, friendly wall on the flight path, enemy behind it — the friendlyFouls fixtures around the existing discipline asserts show the shape; build on them, don't duplicate).
- (b) a tower with NO discipline field behaves exactly as the fallback argument says (the compatibility contract — old saves and old fixtures never break).
- (c) a save/resume round-trip carries a tower's `discipline` field (it is a plain string on the body — the body writer's generic sweep takes it; assert, don't assume).
Run: (a) fails (the field is ignored today), (b)/(c) pass after 1.2. Also grep `data-squad-|data-pending|FIRE DISCIPLINE` across `scripts/smoke.mjs` and `scripts/depot-test.mjs` BEFORE coding — every selector or source pin that touches the chip row or the global toggle gets re-pinned old→new in the report.

**Step 1.2 — per-tower discipline in the shooting loop.** `src/depot/DepotGame.jsx` `stepTowers` (:365): the parameter becomes the fallback; each tower reads its own field.

```js
export function stepTowers(world, T, discipline) {
  const dt = world.dt;
  for (const b of world.bodies) {
    if (b.kind !== "tower" || !b.alive) continue;
    // COMMAND T1 (mk0.80): fire discipline is per tower now — the radial
    // sets b.discipline; the old argument is the fallback for bodies that
    // predate the field (old saves, bare fixtures).
    const disc = b.discipline || discipline || "careful";
```

and the hold site (:414) reads `if (disc !== "free" && friendlyFouls(...))`. The global top-bar button (:2765-2767) and `toggleDiscipline` (:2712-2716) are DELETED; the `S.discipline`/localStorage plumbing stays only as the fallback value (existing saves and the signature keep working; the button is gone).

**Step 1.3 — the radial component.** In `DepotGame.jsx`, above the component (near the `P` style table, :683): one shared menu for both kinds. Slots fan across the upper arc around the anchor point; every button keeps the 44px touch floor and the arming opacity the chips had.

```jsx
// COMMAND (mk0.80): THE RADIAL. One ring of orders around the selected
// thing — squads and towers speak the same language. Slots fan across the
// arc over the anchor; the next phase docks TAKE CONTROL into the same
// ring, which is why the geometry is data, not layout.
function RadialMenu({ cx, cy, label, slots, armed }) {
  const N = slots.length, RAD = 78;
  const span = Math.min(2.4, 0.7 * Math.max(1, N - 1));
  const a0 = -Math.PI / 2 - span / 2;
  return (
    <div style={{ position: "absolute", left: 0, top: 0, zIndex: 7, pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: cx, top: cy + 26, transform: "translate(-50%,0)", fontSize: 10, letterSpacing: 1, color: "#7dffa8", background: "rgba(14,18,24,0.85)", padding: "1px 6px", borderRadius: 4 }}>{label}</div>
      {slots.map((s, i) => {
        const a = N === 1 ? -Math.PI / 2 : a0 + (span * i) / (N - 1);
        const x = cx + Math.cos(a) * RAD, y = cy + Math.sin(a) * RAD;
        return (
          <button key={s.key} data-radial={s.key}
            style={{ ...P.btnBig, position: "absolute", left: x, top: y, transform: "translate(-50%,-50%)", pointerEvents: "auto", padding: "8px 12px", fontSize: 12, borderColor: s.on ? s.color : "#48515f", color: s.color, opacity: armed ? 1 : 0.5 }}
            onClick={s.act}>{s.label}</button>
        );
      })}
    </div>
  );
}
```

**Step 1.4 — squads ride it.** The chip-row JSX (:2871-2904) is REPLACED by one `RadialMenu` call fed from `hud.squadSel` — same anchor (`S.squadScreen`), same armed flag, same `S.orderSquad` actions, same order-state colors the chips used. Slot list: DEFEND, MOVE, ATTACK — engineers additionally BAGS and WALLS (their chips today, same `build_bags`/`build_walls` actions and highlight-when-arming). The "TAP GROUND"/"TAP THE LINE START" status line the chips carried moves into the radial's center label. Old `data-squad-*` attributes die; the new ones are `data-radial="defend|move|attack|build_bags|build_walls"` (report the smoke re-pins).

**Step 1.5 — placement opens the ring.** `placeSquadAt` (:1345-1352) gains two lines after `S.squads.push(sq)`: `S.selSquadId = sq.id; S.selArmedAt = world.t + PENDING_ARM_S;` — a placed squad comes up already selected with its radial open, defend-here already its standing order (it spawns defending: the intrinsic default, no tap needed).

**Step 1.6 — towers ride it.** The inspect flow keeps `S.inspectId`, the reach fan, and the info panel (:2909-2921) minus its SELL button — hp and the one-line description stay, orders leave. The hud tick (:2600-2627 region) computes a tower anchor the same way `S.squadScreen` is computed (project the tower's top: `pos.y + hy + 1.2`) into `hud.towerRadial = { x, y, discipline, refund, frost }` for the inspected tower. JSX: a second `RadialMenu` when `hud.towerRadial` exists — slots: `CAREFUL`/`FREE` toggle (label shows the CURRENT state, tap flips `b.discipline` via a new `S.setTowerDiscipline(id)`, color green when careful, red when free; frost towers — no gun — skip this slot) and `SELL ◆n` (calls the existing `S.sellById`). Walls keep today's inspect behavior untouched.

```js
      S.setTowerDiscipline = (id) => {
        const b = world.byId.get(id);
        if (!b || b.kind !== "tower") return;
        b.discipline = (b.discipline || discipline || "careful") === "careful" ? "free" : "careful";
      };
```

**Step 1.7 — the roadmap tells the truth.** `src/ui/Roadmap.jsx` PHASES: Vision → DONE ("You only shoot what your side sees — shipped, playtested."); Command → IN PROGRESS ("The radial order menu: one ring of orders around every squad and tower.").

**Behavior stated plainly:** nothing a squad could be ordered to do changes in this task — the same five actions wear a ring instead of a row. Towers gain their first two orders. The global FIRE DISCIPLINE button is gone; each tower is set by hand and remembers through a save.

**Gates (ONLY these):** parse changed files · `npm run lint:depot` · `npm run test:depot` (1.1 green; re-pins old→new) · build AFTER bumping `src/version.js` to "mk0.80" · `SMOKE_ONLY=depot` smoke (selector re-pins reported). Commit "(mk0.80)", push, CI green, STOP.

---

## Task 1b — The pie (mk0.82)

*Amendment, 2026-08-12, after the owner's live check of mk0.80/0.81: "the options should be pie shaped. also, after selecting what to do it should go away so i can select parts of the screen." The floating rectangles are replaced by a true pie — one disc of wedges around the selected thing — and choosing any action closes it.*

**Step 1b.1 — the shape.** `RadialMenu` in `DepotGame.jsx` is rewritten as an SVG pie: a disc centered on the anchor, divided into N equal wedges, first wedge centered at twelve o'clock. Inner radius 36 (a hole — the unit stays visible through it), outer radius 104. Each wedge is one SVG path (a filled sector with the panel background and border colors the game already uses); its icon and short label sit horizontally at the wedge's middle angle, radius ~72. A wedge that is a lit toggle (a tower on FREE, structures on) fills with its accent color at low opacity. Only the wedge paths take pointer events — the hole and the space between menus never eat a tap.

```jsx
// COMMAND 1b (mk0.82): THE PIE. One disc of wedges around the selected
// thing. Equal sectors, twelve o'clock first, hole in the middle so the
// unit stays visible. Choosing ANY wedge closes the pie (the owner's rule:
// the screen must be free for the follow-up taps an order needs).
function RadialMenu({ cx, cy, label, slots, armed }) {
  const N = slots.length, R0 = 36, R1 = 104;
  const wedge = (i) => {
    const a0 = -Math.PI / 2 + (i - 0.5) * (2 * Math.PI / N);
    const a1 = a0 + 2 * Math.PI / N;
    const p = (r, a) => `${cx + Math.cos(a) * r},${cy + Math.sin(a) * r}`;
    const large = (2 * Math.PI / N) > Math.PI ? 1 : 0;
    return `M ${p(R0, a0)} A ${R0} ${R0} 0 ${large} 1 ${p(R0, a1)} L ${p(R1, a1)} A ${R1} ${R1} 0 ${large} 0 ${p(R1, a0)} Z`;
  };
  return (
    <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 7, pointerEvents: "none", overflow: "visible" }}>
      {slots.map((s, i) => {
        const mid = -Math.PI / 2 + i * (2 * Math.PI / N);
        const lx = cx + Math.cos(mid) * 72, ly = cy + Math.sin(mid) * 72;
        return (
          <g key={s.key} data-radial={s.key} style={{ pointerEvents: "auto", cursor: "pointer" }} onClick={s.act} opacity={armed ? 1 : 0.5}>
            <path d={wedge(i)} fill={s.on ? s.color : "rgba(14,18,24,0.88)"} fillOpacity={s.on ? 0.28 : 0.88} stroke={s.on ? s.color : "#48515f"} strokeWidth="1.5" />
            <text x={lx} y={ly - 4} textAnchor="middle" fontSize="15" fill={s.color} style={{ userSelect: "none" }}>{s.icon || ""}</text>
            <text x={lx} y={ly + 12} textAnchor="middle" fontSize="10" letterSpacing="1" fill={s.color} fontFamily="inherit" style={{ userSelect: "none" }}>{s.label}</text>
          </g>
        );
      })}
      <foreignObject x={cx - 60} y={cy + R1 + 6} width="120" height="40" style={{ pointerEvents: "none", overflow: "visible" }}>
        <div style={{ textAlign: "center", fontSize: 10, letterSpacing: 1, color: "#7dffa8" }}>{label}</div>
      </foreignObject>
    </svg>
  );
}
```

(Slot shape gains `icon` — reuse the palette icons where one exists: ▦ walls, ▬ bags, ⚑ attack, ∴ defend; plain text where none does. The agent picks sensible glyphs from the palette table and reports them.)

**Step 1b.2 — choosing closes the pie.** New interface rule, one mechanism: every slot's `act` runs the order and then closes the menu. Instant actions (DEFEND, SELL, CAREFUL/FREE, later STRUCTURES) also deselect completely — `S.selSquadId = null` / `S.inspectId = null`. Aiming actions (MOVE, ATTACK, BAGS, WALLS, later PATROL) close the pie but KEEP the selection and its armed `S.orderMode` — the small center label chip stays following the squad ("TAP GROUND", "TAP THE LINE START"), the ground is fully tappable, and `consumeOrderTap` finishes the order exactly as today. After the order's final ground tap lands, the squad deselects (one line at the end of `consumeOrderTap`'s each completing branch: `S.selSquadId = null;`). Implementation: the pie renders only while `hud.squadSel.showPie` / `hud.towerRadial.showPie` — a new `S.pieOpen` flag set true on selection/placement, false on any slot tap; re-tapping the selected squad re-opens it.

**Step 1b.3 — re-pins.** The mk0.80 test pins that anchor on the radial's source (the engineer-guard regex re-pinned at mk0.80) are re-verified against the rewrite and re-pinned honestly old→new if the surrounding text moved. Smoke has no radial selectors (verified at mk0.80).

**Behavior stated plainly:** tap a squad — a pie opens around it; tap a wedge — the pie vanishes; if the order needs ground taps, the little status chip stays on the squad and the whole screen is tappable; when the order is complete the squad deselects. Tap the squad again any time to reopen the pie.

**Gates (ONLY these):** parse changed files · `npm run lint:depot` · `npm run test:depot` (re-pins old→new) · build AFTER bumping `src/version.js` to "mk0.82" · `SMOKE_ONLY=depot` smoke. Commit "(mk0.82)", push, CI green, STOP.

---

## Task 2 — The proposed line (mk0.84) — suggested model: Sonnet (every step carries its code)

*Amendment, 2026-08-12 (owner): two-point orders no longer fire on the second tap. The proposed line renders first — endpoint discs, a dashed path, one ghost footprint per piece with honest gaps on unbuildable cells — with armed accept/reject buttons at the end point. Tap an endpoint disc to pick it up and re-place it. Nothing walks until accept. This task builds the machinery on the engineers' build lines; patrol rides it in Task 3.*

**Required reading (agent, before any code; anchors re-verified at dispatch):** this plan whole; `CLAUDE.md`; `src/depot/DepotGame.jsx` — the build-line machinery (`startBuildLine`/`lineCells`/`pieceHalf`/`layPieceAt`, ~:1490-1599), `consumeOrderTap` (~:1603+), `tapAt` (~:1725+, the pending-resolution block), the projection block (beside `S.pendingScreen`), the hud tick, the pie render sites, `__DEPOTORDER__`; `src/render/renderer.js` :1161-1300 (the overlay object — the pattern `setLinePreview` joins); `scripts/depot-test.mjs` — grep `startBuildLine|linePending|data-line|setLinePreview` plus the mk0.60 build-line pins, every hit read.

**Step 2.1 — failing pins first.** `scripts/depot-test.mjs`, new block `==== COMMAND T2: the proposed line` (source pins + a lockstep mirror, the file's convention for closures it cannot import): (a) pin — `consumeOrderTap`'s build branch creates `S.linePending` and does NOT call `startBuildLine` (regex: the branch body contains `S.linePending = {` and not `startBuildLine(`); (b) pin — an `acceptLine` function exists that calls `startBuildLine` and nulls `S.selSquadId`; (c) pin — `__DEPOTORDER__` auto-accepts (`S.acceptLine()` inside it) so staging keeps working; (d) pin — `renderer.js` overlay carries `setLinePreview`; (e) mirror — the piece filter (blocked/iced/unheld cells make gaps) reproduced over a hand grid, updated in lockstep and labeled as a mirror. Run: all five fail, then green.

**Step 2.2 — the renderer learns one preview.** `src/render/renderer.js`, overlay object (:1168, beside `setReach`) — this file is editable here: the overlay section is game furniture (it already grew `setReach` for a depot phase); nothing hashed or demo-frozen is touched. Declare `let lineGroup = null;` with the other lazy nulls (:1165-1167) and add:

```js
    // COMMAND T2 (mk0.84): the proposed line — endpoint discs, a dashed
    // path, one ghost box per piece the order would lay. Rebuilt only on
    // endpoint taps, never per frame.
    setLinePreview(on, spec) {
      if (lineGroup) {
        scene.remove(lineGroup);
        lineGroup.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
        lineGroup = null;
      }
      if (!on || !spec) return;
      lineGroup = new THREE.Group();
      const disc = (pt, color) => {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.18, 24),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false }));
        m.position.set(pt.x, pt.y + 0.1, pt.z);
        lineGroup.add(m);
      };
      disc(spec.a, 0x4aff8c);                               // start: green
      disc(spec.b, 0xffd27a);                               // end: amber — where the buttons live
      const lg = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(spec.a.x, spec.a.y + 0.25, spec.a.z),
        new THREE.Vector3(spec.b.x, spec.b.y + 0.25, spec.b.z)]);
      const line = new THREE.Line(lg, new THREE.LineDashedMaterial({ color: spec.color || 0xffd27a, dashSize: 0.8, gapSize: 0.5, transparent: true, opacity: 0.9 }));
      line.computeLineDistances();
      lineGroup.add(line);
      for (const g of spec.pieces || []) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(g.hx * 2, g.hy * 2, g.hz * 2),
          new THREE.MeshBasicMaterial({ color: spec.color || 0xffd27a, transparent: true, opacity: 0.3, depthWrite: false }));
        m.position.set(g.x, g.y, g.z);
        lineGroup.add(m);
      }
      lineGroup.traverse((o) => o.layers && o.layers.set(1));
      scene.add(lineGroup);
    },
```

**Step 2.3 — the pending line.** `src/depot/DepotGame.jsx`, beside the build-line machinery (after `startBuildLine`, ~:1511): the pending state, the honest piece list, and accept/reject. The ghost list skips every cell the layer would skip — blocked, iced, unheld — so a gap in the preview is a gap in the wall, known before a scrap is spent.

```js
      // COMMAND T2 (mk0.84): THE PROPOSED LINE. The second tap of a
      // two-point order proposes; nothing walks until the owner of the tap
      // accepts. Ghost pieces skip exactly the cells laying would skip
      // (scrap aside — that is walk-time), so the preview never lies.
      const LINE_END_R = 2.5;   // m — a tap this close to an endpoint disc picks it up
      const linePieces = (kind, a, b) => {
        if (kind === "patrol") return [];
        const orient = Math.abs(b.x - a.x) >= Math.abs(b.z - a.z) ? 0 : 1;
        const ph = pieceHalf(kind, orient);
        const hy = kind === "walls" ? 0.9 : SANDBAG_HY;
        const out = [];
        for (const c of lineCells(a, b)) {
          if (!grid.inBounds(c.gx, c.gz)) continue;
          const cell = grid.cells[grid.idx(c.gx, c.gz)];
          const wp = grid.gridToWorld(c.gx, c.gz), c0 = invW(wp.x, wp.z);
          if (cell.blocked || cell.wallId || cell.ice || !canBuild(T, c0.u, c0.v)) continue; // an honest gap
          out.push({ x: wp.x, z: wp.z, y: field.heightAt(wp.x, wp.z) + hy, hx: ph.hx, hy, hz: ph.hz });
        }
        return out;
      };
      const refreshLinePreview = () => {
        const lp = S.linePending;
        if (!lp) { R.overlay.setLinePreview(false); return; }
        const pieces = linePieces(lp.kind, lp.a, lp.b);
        lp.count = pieces.length;
        lp.cost = lp.kind === "walls" ? pieces.length * WALL_FIELD_COST
                : lp.kind === "bags" ? pieces.length * SANDBAG_FIELD_COST : 0;
        R.overlay.setLinePreview(true, {
          a: { x: lp.a.x, z: lp.a.z, y: field.heightAt(lp.a.x, lp.a.z) },
          b: { x: lp.b.x, z: lp.b.z, y: field.heightAt(lp.b.x, lp.b.z) },
          pieces,
          color: lp.kind === "walls" ? 0x9fdcff : lp.kind === "patrol" ? 0x7fd7ff : 0xffd27a,
        });
      };
      const acceptLine = () => {
        const lp = S.linePending;
        if (!lp) return;
        if (!pendingArmed(lp, world.t)) { toast("HOLD — ARMING"); return; }
        const sq = S.squads.find((q) => q.id === lp.sq);
        S.linePending = null;
        R.overlay.setLinePreview(false);
        if (sq) {
          if (lp.kind === "patrol") { /* Task 3 fills this arm */ }
          else startBuildLine(sq, lp.kind, lp.a, lp.b);
        }
        S.selSquadId = null; S.orderMode = null; S.buildPt0 = null;
      };
      const rejectLine = () => {
        S.linePending = null;
        R.overlay.setLinePreview(false);
        S.selSquadId = null; S.orderMode = null; S.buildPt0 = null;
      };
      S.acceptLine = acceptLine; S.rejectLine = rejectLine;
```

**Step 2.4 — the second tap proposes.** `consumeOrderTap`'s build branch: the second tap creates the pending instead of starting the line (the first-tap arm and the engineer guard stay as they are; the guard's bail-out keeps its mk0.82 deselect):

```js
          if (!S.buildPt0) { S.buildPt0 = { x: d.x, z: d.z }; toast("LINE START — TAP THE FAR END"); return true; }
          S.linePending = { kind: om === "build_walls" ? "walls" : "bags", sq: osq.id,
            a: { x: S.buildPt0.x, z: S.buildPt0.z }, b: { x: d.x, z: d.z },
            moving: null, armedAt: world.t + PENDING_ARM_S };
          S.buildPt0 = null; S.orderMode = null;
          refreshLinePreview();
          return true;
```

**Step 2.5 — taps belong to the line while it is up.** `tapAt`, immediately after the placement-pending block (:1734-1735) and BEFORE `consumeOrderTap`:

```js
        // COMMAND T2: while a proposed line is up, ground taps belong to it —
        // tap an endpoint disc to pick it up, tap ground to re-place a
        // picked-up endpoint. Accept/reject (the buttons) are the only exits;
        // a stray tap can never fire the order or steal the selection.
        if (S.linePending) {
          const lp = S.linePending;
          if (lp.moving) {
            const m = clampToRim(p.x, p.z);
            lp[lp.moving] = { x: m.x, z: m.z };
            lp.moving = null;
            lp.armedAt = world.t + PENDING_ARM_S;
            refreshLinePreview();
          } else if (Math.hypot(p.x - lp.a.x, p.z - lp.a.z) < LINE_END_R) { lp.moving = "a"; toast("TAP THE NEW START"); }
          else if (Math.hypot(p.x - lp.b.x, p.z - lp.b.z) < LINE_END_R) { lp.moving = "b"; toast("TAP THE NEW END"); }
          return;
        }
```

**Step 2.6 — the buttons.** In the frame's projection block (beside `S.pendingScreen`): project the END point into `S.lineScreen` (`R.project(lp.b.x, heightAt+1.2, lp.b.z)`, same recipe); when the projection is off-screen the buttons hide but the pending SURVIVES (unlike placement — the line is big, panning around it is normal work). Hud tick carries `linePending: S.linePending && S.lineScreen ? { x, y, cost, count, armed: pendingArmed(S.linePending, world.t), kind } : null`. JSX, beside the placement ✓/✗ pair, same styles:

```jsx
      {hud.linePending && (
        <div style={{ position: "absolute", left: hud.linePending.x, top: hud.linePending.y, transform: "translate(-50%, -50%)", zIndex: 7, display: "flex", gap: 6, pointerEvents: "auto" }}>
          <button data-line-accept
            style={{ ...P.btnBig, borderColor: "#4aff8c", color: "#4aff8c", opacity: hud.linePending.armed ? 1 : 0.5, fontWeight: "bold" }}
            onClick={() => stateRef.current && stateRef.current.acceptLine()}>
            {hud.linePending.kind === "patrol" ? "✓ PATROL" : `✓ UP TO ◆${hud.linePending.cost}`}
          </button>
          <button data-line-reject
            style={{ ...P.btnBig, borderColor: "#ff6b5e", color: "#ff6b5e", fontWeight: "bold" }}
            onClick={() => stateRef.current && stateRef.current.rejectLine()}>
            ✗
          </button>
        </div>
      )}
```

The selected squad's center chip reads " — ACCEPT OR ADJUST THE LINE" while a pending exists (one more branch in the `hud.squadSel` label logic).

**Step 2.7 — staging keeps working.** `__DEPOTORDER__`: after the `pts` loop, one line — `if (S.linePending) S.acceptLine();` with a comment saying the debug path auto-accepts what a human confirms. Existing mk0.60 build-line staging then behaves exactly as before.

**Behavior stated plainly:** the second tap now shows the work instead of starting it — green disc at the start, amber at the end, ghost pieces with honest gaps, a cost that says "up to" because skipped cells never charge. Tap a disc, tap new ground, and the line follows. Accept and the squad marches; reject and everything clears. The engineers cannot be mis-tapped into a march anymore.

**Gates (ONLY these):** parse changed files · `npm run lint:depot` · `npm run test:depot` (2.1 green; re-pins old→new) · build AFTER bumping `src/version.js` to "mk0.84" · `SMOKE_ONLY=depot` smoke. Allowed files: `DepotGame.jsx`, `renderer.js` (overlay object only), `version.js`, `depot-test.mjs`. Commit "(mk0.84)", push, CI green, STOP.

---

## Task 3 — Patrol (mk0.85) — suggested model: Sonnet (order-machine code fully written here)

Two taps propose the route (Task 2's machinery, kind "patrol"); accept and the squad walks the line, turns around, walks it back, forever — fighting whatever it sees, by the halt-and-fight rule.

**Required reading (agent, before any code; anchors re-verified at dispatch):** this plan whole; `CLAUDE.md`; `src/depot/squads.js` — module laws header, `stepSquad` whole (:487-651, the leg machine and its one-draw law), `squadThreatened`; `src/depot/state.js` — `squadFire` (:497-565, both gates); `src/depot/DepotGame.jsx` — `engageCheck`, `S.orderSquad`, `consumeOrderTap`, `acceptLine` (Task 2's, with the empty patrol arm), the pie slot lists; `src/depot/save.js` :199-219 (the generic squad serializer — why `_patA`/`_patB` ride); `scripts/depot-test.mjs` — the VISION T4 halt-and-fight block (the fixture idiom 3.1 mirrors) and grep `order.*patrol|_patA`.

**Step 3.1 — failing tests first.** `scripts/depot-test.mjs`, new block `==== COMMAND T3: patrol` (fixture idiom of the VISION blocks; the order fields are set directly on the squad — the interface path is Task 2's, already pinned): (a) a squad with `order:"patrol"`, `_patA`/`_patB` set and `dest` at A reaches A, then is later observed nearer B, then later nearer A again (three sampled epochs — the loop is real and endless); (b) an enemy placed beside the patrol line gets fired on (muzzle events appear) and the anchor holds while he lives — halt-and-fight applies to patrol; (c) MOVE and BUILD squads still never fire (pin unchanged behavior); (d) dice law: a patrol running N legs draws exactly N leg-arrival draws and nothing else (twin-run count); (e) save/resume: a patrolling squad comes back patrolling — order, both endpoints, current destination all ride (plain scalars through the generic squad serializer; assert the round-trip); (f) pin — `acceptLine`'s patrol arm sets `_patA`/`_patB`/`order`/`dest` (source regex).

**Step 3.2 — the order machine learns the loop.** `src/depot/squads.js` `stepSquad` (:504): `"patrol"` joins the dest-driven orders:

```js
  if ((squad.order === "attack" || squad.order === "move" || squad.order === "build" || squad.order === "patrol") && squad.dest) {
```

and the ARRIVAL branch (:524 region) gains the turnaround BEFORE the defend-flip (which then no longer sees patrol arrivals):

```js
    } else if (dToDest <= ARRIVE_TOL && squad.order === "patrol") {
      // COMMAND T3 (mk0.85): a patrol never arrives — it turns around. The
      // far end becomes the destination and the legs carry on; the leg
      // machinery (and its one arrival draw per leg) is untouched.
      const goingToB = Math.hypot(squad.dest.x - squad._patB.x, squad.dest.z - squad._patB.z) < 0.5;
      squad.dest = goingToB ? { x: squad._patA.x, z: squad._patA.z } : { x: squad._patB.x, z: squad._patB.z };
      squad._legTarget = null;
      squad._cohesionHoldT = 0;
```

The threat read at the leg boundary (:543) already treats everything that is not move/build as real — patrol inherits attack's cover-hop legs and dwell with zero changes there. Verify, don't edit.

**Step 3.3 — patrol fires.** `src/depot/state.js` `squadFire`: the quiet-order gate (:500-501) does NOT gain patrol; the stationary gate (:506) admits it:

```js
  const stationary = squad.order === "defend" ||
    ((squad.order === "attack" || squad.order === "patrol") && squad._pauseT > 0);
```

`src/depot/DepotGame.jsx` `engageCheck`: `if ((sq.order !== "attack" && sq.order !== "patrol") || ...` — a patrol that sees an enemy in reach halts and fights exactly as an attack does.

**Step 3.4 — the radial and the accept arm.** `S.orderSquad` gains `"patrol"` arming the same two-tap flow the build orders use (first tap → `S.buildPt0` + toast "PATROL START — TAP THE FAR END"); `consumeOrderTap` gains the patrol branch creating `S.linePending` with kind `"patrol"` (same shape as 2.4, no engineer guard — every squad type except engineers and sappers offers the wedge). `acceptLine`'s patrol arm (Task 2 left it empty):

```js
          if (lp.kind === "patrol") {
            sq._patA = { x: lp.a.x, z: lp.a.z };
            sq._patB = { x: lp.b.x, z: lp.b.z };
            sq.order = "patrol";
            sq.dest = { x: lp.a.x, z: lp.a.z };   // walk to the near end first
            sq._legTarget = null; sq._pauseT = 0; sq._cohesionHoldT = 0; sq._build = null;
          }
```

Pie slot PATROL (`data-radial="patrol"`, icon ⇄, color the MOVE blue) on every squad type except engineers and sappers; center chip statuses "TAP THE PATROL START"/"TAP THE FAR END" ride the same fields the build statuses use. `_patA`/`_patB` are inert unless the order is "patrol" — state, not behavior (comment says so).

**Gates (ONLY these):** parse · lint:depot · test:depot (3.1 green, re-pins old→new) · build AFTER bump to "mk0.85" · SMOKE_ONLY=depot smoke. Commit "(mk0.85)", push, CI green, STOP.

---

## Task 4 — Attack structures (mk0.86) — suggested model: Sonnet (a priority flip with the code written here)

A toggle on the pie: this squad prefers walls and towers over men — the wall-breaker escort order.

**Required reading (agent, before any code; anchors re-verified at dispatch):** this plan whole; `CLAUDE.md`; `src/depot/state.js` — `squadFire` whole (:497-565: the two scans being split, the INTERFACE GAP and SPEC CONTRADICTION notes around them — they must survive the move verbatim); `src/depot/specs.js` `INFANTRY_ARMS` (the type gate); `src/depot/DepotGame.jsx` — the pie slot lists and instant-action closures (DEFEND's deselect is the model), `selectedSquad`/`S.selArmedAt`; `src/depot/save.js` squad serializer (why `prefStruct` rides); `scripts/depot-test.mjs` — grep `squadFire|hostileStructure` fixtures, every hit read.

**Step 4.1 — failing tests first.** `==== COMMAND T4: attack structures`: (a) a defending squad with the flag set, an enemy man AND an enemy-side wall both in sight and reach — the wall's hp drops first (structure preferred); (b) same fixture, flag off — the man dies first (today's priority, pinned); (c) the flag survives a save/resume (plain boolean on the squad — assert); (d) with the flag set and NO structure in reach, the squad still fights men (the fallback is automatic, nobody stands idle).

**Step 4.2 — the priority flip.** `src/depot/state.js` `squadFire` (:524-549): the two scans become explicit and the order between them reads the flag. The code inside each scan is today's, moved, not rewritten:

```js
    const scanUnits = () => { /* today's unit loop (:525-534), verbatim */ };
    const scanStructs = () => { /* today's structure fallback loop (:541-548), verbatim */ };
    let best = null, bestIsStruct = false;
    if (squad.prefStruct) {
      best = scanStructs(); bestIsStruct = !!best;
      if (!best) { best = scanUnits(); }
    } else {
      best = scanUnits();
      if (!best) { best = scanStructs(); bestIsStruct = !!best; }
    }
```

(The scans close over `u`, `muzzle`, `eR` exactly as the inline code does; keep the `bd`/`bs` bookkeeping inside each. Sight gating on both paths is already in place since mk0.72 — no gate changes.)

**Step 4.3 — the pie toggle.** Slot STRUCTURES on every armed squad's pie (types with an `INFANTRY_ARMS` row — not engineers, not sappers), `data-radial="structures"`, lit when on, instant action (closes the pie AND deselects, like DEFEND):

```js
      S.toggleStructFirst = () => {
        const sq = selectedSquad();
        if (!sq || world.t < S.selArmedAt) return;
        if (!INFANTRY_ARMS[sq.type]) return;
        sq.prefStruct = !sq.prefStruct;
      };
```

hud.squadSel carries `structFirst: !!sq.prefStruct`; the wedge's lit state reads it.

**Step 4.4 — the record.** the design log (since removed): append one dated line — Command phase shipped mk0.80-0.86, the pie live for squads and towers, proposed-line confirm on every two-point order, patrol and attack-structures in the vocabulary, phase awaiting the owner's playtest.

**Gates (ONLY these):** parse · lint:depot · test:depot (4.1 green) · build AFTER bump to "mk0.86" · SMOKE_ONLY=depot smoke. Commit "(mk0.86)", push, CI green, STOP.

---

## Close

Phase closes on the owner's playtest: the pie on every squad and tower, placement opening it, proposed lines accepted or adjusted before anyone walks, patrol routes held under fire, a wall-breaker squad ignoring men, per-tower discipline. Deferred by scope (on the shelf, decision record): take cover, fall back, escort, suppress/barrage, directed demolition, focus-fire, the rest of the tower doctrine.
