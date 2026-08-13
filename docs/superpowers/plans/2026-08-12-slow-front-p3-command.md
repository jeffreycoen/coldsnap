# SLOW FRONT — Phase 3: Command (mk0.80-0.82)

*2026-08-12. One plan, one audience. Scope ratified by the owner today (decision record, "Orders and command"): a radial order menu for squads AND towers replaces the chip row and the order half of the inspect panel; new orders are PATROL and ATTACK STRUCTURES; engineers' build lines migrate into their radial; per-tower fire discipline replaces the global toggle; hold-fire is cut. Three tasks, sequential, one Sonnet 5 agent each, a stop after every landing: mk0.80/0.81 the radial (shipped; 0.81 = the spacing fix), mk0.82 the pie rework, mk0.83 patrol, mk0.84 attack-structures. The next phase (Possession) adds a TAKE CONTROL button to every radial — the layout leaves room.*

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

## Task 2 — Patrol (mk0.83)

Two taps: the squad walks the line, turns around, walks it back, forever — fighting whatever it sees on the way, by the halt-and-fight rule.

**Step 2.1 — failing tests first.** `scripts/depot-test.mjs`, new block `==== COMMAND T2: patrol` (fixture idiom of the VISION blocks): (a) a squad ordered PATROL between A and B reaches A, then is later observed nearer B, then later nearer A again (three sampled epochs — the loop is real and endless); (b) an enemy placed beside the patrol line gets fired on (muzzle events appear) and the anchor holds while he lives — halt-and-fight applies to patrol; (c) MOVE and BUILD squads still never fire (pin unchanged behavior); (d) dice law: a patrol running N legs draws exactly N leg-arrival draws and nothing else (twin-run count); (e) save/resume: a patrolling squad comes back patrolling — order, both endpoints, current destination all ride (they are plain scalars; assert the round-trip through serialize/restore the way the T4 build-line test did).

**Step 2.2 — the order machine learns the loop.** `src/depot/squads.js` `stepSquad` (:504): `"patrol"` joins the dest-driven orders:

```js
  if ((squad.order === "attack" || squad.order === "move" || squad.order === "build" || squad.order === "patrol") && squad.dest) {
```

and the ARRIVAL branch (:524, the `dToDest <= ARRIVE_TOL` else-if) splits: patrol swaps ends instead of digging in. Insert BEFORE the existing defend-flip, which then no longer sees patrol arrivals:

```js
    } else if (dToDest <= ARRIVE_TOL && squad.order === "patrol") {
      // COMMAND T2 (mk0.81): a patrol never arrives — it turns around. The
      // far end becomes the destination and the legs carry on; the leg
      // machinery (and its one arrival draw per leg) is untouched.
      const goingToB = Math.hypot(squad.dest.x - squad._patB.x, squad.dest.z - squad._patB.z) < 0.5;
      squad.dest = goingToB ? { x: squad._patA.x, z: squad._patA.z } : { x: squad._patB.x, z: squad._patB.z };
      squad._legTarget = null;
      squad._cohesionHoldT = 0;
```

The threat read at the leg boundary (:543) already treats everything that is not move/build as real — patrol inherits attack's cover-hop legs and dwell behavior with zero changes there. Verify, don't edit.

**Step 2.3 — patrol fires.** `src/depot/state.js` `squadFire`: the quiet-order gate (:500-501) does NOT gain patrol (it stays a fighting order), and the stationary gate (:506) admits it:

```js
  const stationary = squad.order === "defend" ||
    ((squad.order === "attack" || squad.order === "patrol") && squad._pauseT > 0);
```

`src/depot/DepotGame.jsx` `engageCheck` (:609): `if ((sq.order !== "attack" && sq.order !== "patrol") || ...` — a patrol that sees an enemy in reach halts and fights exactly as an attack does.

**Step 2.4 — the radial arms it.** `S.orderSquad` (:1397): `"patrol"` arms a two-tap flow exactly as the build orders do (reuse `S.buildPt0` as the first-point holder — rename it `S.pt0` ONLY if every touch point is renamed in the same commit; otherwise leave the name). `consumeOrderTap` (:1617 region) gains:

```js
        if (om === "patrol") {
          if (!osq) { S.orderMode = null; S.buildPt0 = null; return true; }
          if (!S.buildPt0) { S.buildPt0 = { x: d.x, z: d.z }; toast("PATROL START — TAP THE FAR END"); return true; }
          osq._patA = { x: S.buildPt0.x, z: S.buildPt0.z };
          osq._patB = { x: d.x, z: d.z };
          osq.order = "patrol";
          osq.dest = { x: osq._patA.x, z: osq._patA.z };   // walk to the near end first
          osq._legTarget = null; osq._pauseT = 0; osq._cohesionHoldT = 0; osq._build = null;
          S.buildPt0 = null; S.orderMode = null;
          return true;
        }
```

(Both taps already rim-clamp through `d`.) The radial gains slot PATROL (`data-radial="patrol"`, all squad types except engineers and sappers — engineers build, sappers charge; center label reads "TAP THE PATROL START"/"FAR END" via the same `building`-style hud fields). A new order of any kind clears `_patA/_patB` is NOT needed — they are inert unless order is "patrol" (state, not behavior; say so in a comment).

**Gates (ONLY these):** parse · lint:depot · test:depot (2.1 green, re-pins old→new) · build AFTER bump to "mk0.83" · SMOKE_ONLY=depot smoke. Commit "(mk0.83)", push, CI green, STOP.

---

## Task 3 — Attack structures (mk0.84)

A toggle on the radial: this squad prefers walls and towers over men — the wall-breaker escort order.

**Step 3.1 — failing tests first.** `==== COMMAND T3: attack structures`: (a) a defending squad with the flag set, an enemy man AND an enemy-side wall both in sight and reach — the wall's hp drops first (structure preferred); (b) same fixture, flag off — the man dies first (today's priority, pinned); (c) the flag survives a save/resume (plain boolean on the squad — assert); (d) with the flag set and NO structure in reach, the squad still fights men (the fallback is automatic, nobody stands idle).

**Step 3.2 — the priority flip.** `src/depot/state.js` `squadFire` (:524-549): the two scans become explicit and the order between them reads the flag. The code inside each scan is today's, moved, not rewritten:

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

**Step 3.3 — the radial toggle.** Slot STRUCTURES on every armed squad's radial (types with an `INFANTRY_ARMS` row — not engineers, not sappers), `data-radial="structures"`, lit when on:

```js
      S.toggleStructFirst = () => {
        const sq = selectedSquad();
        if (!sq || world.t < S.selArmedAt) return;
        if (!INFANTRY_ARMS[sq.type]) return;
        sq.prefStruct = !sq.prefStruct;
      };
```

hud.squadSel carries `structFirst: !!sq.prefStruct` and `armed: ...` as today; the slot's `on`/color read it.

**Step 3.4 — the record.** `docs/superpowers/decision-record.md`, "Orders and command": append one dated line — Command phase shipped mk0.80-0.82, radial live for squads and towers, patrol and attack-structures in the vocabulary, phase awaiting the owner's playtest.

**Gates (ONLY these):** parse · lint:depot · test:depot (3.1 green) · build AFTER bump to "mk0.84" · SMOKE_ONLY=depot smoke. Commit "(mk0.84)", push, CI green, STOP.

---

## Close

Phase closes on the owner's playtest: the ring on every squad and tower, placement opening it, patrol routes held under fire, a wall-breaker squad ignoring men, per-tower discipline. Deferred by scope (on the shelf, decision record): take cover, fall back, escort, suppress/barrage, directed demolition, focus-fire, the rest of the tower doctrine.
