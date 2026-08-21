# P7 Task 17 — hands and habits (mk1.47)

*HISTORY (stamped 2026-08-20, owner's order): this document is a record of shipped work, not authority. Design truth lives in CLAUDE.md and the ACTIVE phase's plan documents; where this file disagrees with them, it is wrong.*

*2026-08-18. Executes four pinned rulings: ENGINEERS BUILD WITH THEIR HANDS (a build-line row lays only while a live member stands within reach — the gate is on the piece, never the anchor; mines and wires inherit); THE PICK ARMS THE BAR (taking a type off the manifest switches the build bar to it — the next ground tap places it); BUILD BUTTONS TOGGLE (tapping the active button clears back to plain command); HULLS RESPECT FRIENDLY SANDBAGS (bag cells join the grid for hull routing only — own-side bags routed around, enemy bags rammable under the standing ruling, men and the enemy flow never affected). Interface work ships phone AND desktop — all three interface changes are the same tap targets and handlers on both. All dials provisional (F5). No engine change — golden does not run.*

**Suggested model: Sonnet** — fully specced; every step carries its literal code.

**Scope:** `src/depot/DepotGame.jsx`, `src/depot/state.js`, `src/depot/route.js`, `src/depot/drivers.js`, `scripts/depot-test.mjs`, `src/version.js`. Nothing else.

## Required reading, in order (verify anchors before code)

1. `src/depot/DepotGame.jsx`: 2429–2440 (the LAY constants), the lay loop inside `stepBuildLine` (search `row.t > t + LAY_AHEAD`, ~2600–2650 — note the `arrived` clause lays all remaining rows on arrival), 2620–2626 (LAY_MAN_PAD occupancy skip — unchanged), 1680–1695 (seedBags' `spawnSandbag` call at ~1689 — `depotT` is in scope), the engineer-lay `spawnSandbag` (~2637), the resume `restoreBodies` region (~1450–1470), the 4Hz derived block (mines + green threads, ~3945), the wall-death cell sweep (~2842 — the clear idiom to mirror), `makeGrid`'s cell literal (~442), `S.pickManifest` (3273–3280), `setMode` (4335–4348), PALETTE keys (1241–1266 — pick keys ARE mode keys; `hero_*` are two-tap buys, never modes).
2. `src/depot/state.js`: `spawnSandbag` (763–776 — hardcodes `team: 1` for ALL bags including the enemy ring's; that is why the SIDE rides a new `bagSide` field stamped by the caller, never `b.team`), the exported-helper idiom (any of the T8/T10 pure exports).
3. `src/depot/route.js`: `shut()` inside planRoute — the hull clause this task extends.
4. `src/depot/drivers.js`: the ram sampler inside armorGoal (~150–160, the `hard`/`struct` line).
5. `scripts/depot-test.mjs`: the T16 block end (insertion point), the mkGrid/armorAt/identFwdDir fixture idiom, the source-read idiom.

## Trap notes

- **The anchor never waits for the gate** (owner's ruling) — the reach gate breaks the LAY loop, nothing else. Rows the squad never gets hands near simply stay unlaid and die with the job on arrival (the order forgets them; skips never charge — existing law).
- **`c.bag` never blocks foot routing, the enemy flow, or `checkConnectivity`** — hull routing only. If your edit touches `c.blocked`, STOP.
- **No clearance inflation for bags** — `tight()` is not extended; a bag line is one cell thin and sub-hull height.
- **Side comes from the STAMP SITE, never `b.team`** (all bags are team-1 bodies — a known wrinkle, not this task's to fix). `bagSide` must NOT join BODY_HANDLED — it has to ride the save.
- **`setMode` is a component-level const; `S.pickManifest` is built inside the mount effect** — calling `setMode(key)` from the handler is legal (the handler runs long after mount) but verify the reference resolves; if the bundler idiom in this file forbids it, mirror setMode's body inline instead and NAME the deviation.
- **Zero rng. Expected re-pins: zero;** any that move re-pin honestly, old → new, own labeled bullet.

## Steps

**Step 1 — the failing asserts land first.** In `scripts/depot-test.mjs`, after the T16 block end:

```js
// ==== P7 T17: HANDS AND HABITS ===============================================
// Engineers build with their hands; the pick arms the bar; buttons toggle;
// hulls respect friendly sandbags.
{
  const flatF17 = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (x, z, o) => { o.x = 0; o.y = 1; o.z = 0; return o; } };
  // (a) the reach test, behaviorally — live member in reach, dead men don't count
  {
    const w = makeWorld({ field: flatF17, seed: 31 });
    const sq = makeSquad(1, "engineers", 1, 0, 0);
    spawnSquadMembers(w, sq);
    const row = { x: 2.5, z: 0 };
    ok("T17(a): a live member within reach executes the build", memberNearRow(w, sq, row, 3) === true);
    ok("T17(a2): reach is reach", memberNearRow(w, sq, { x: 9, z: 0 }, 3) === false);
    for (const id of sq.memberIds) { const u = w.byId.get(id); u.alive = false; }
    ok("T17(a3): dead hands build nothing", memberNearRow(w, sq, row, 3) === false);
  }
  // (b)-(c) the bar's habits (source shape; the look and feel are the owner's
  // live acceptance, smoke's zero-page-errors covers the boot)
  {
    ok("T17(b): the pick arms the bar, heroes stay two-tap", /if \(!key\.startsWith\("hero_"\)\) setMode\(key\);/.test(dgSrc17));
    ok("T17(c): the active build button toggles off", /if \(S\.mode === m\) \{/.test(dgSrc17));
    ok("T17(a4): the lay loop is reach-gated", /if \(!memberNearRow\(world, sq, row, LAY_REACH\)\) break;/.test(dgSrc17));
  }
  // (d) friendly bags turn a hull route; men walk it untouched
  {
    const G = mkGrid17(20);
    for (let gz = 0; gz < 20; gz++) if (gz !== 10) { const c = G.cells[G.idx(10, gz)]; c.bag = 1; c.bagId = 999; }
    const rH = planRoute(G, -9, 1, 9, 1, { hull: true, team: 1 });
    ok("T17(d): a hull route refuses the friendly bag line save its gap",
      !!rH && rH.reached === true && rH.pts.every((p) => { const c = G.cellAt(p.x, p.z); return !c || c.bag == null; }));
    const rF = planRoute(G, -9, 1, 9, 1);
    ok("T17(d2): men never notice bags in the grid", !!rF && rF.reached === true);
  }
  // (e) the ramming ruling covers bags — enemy bags driven through on order,
  // friendly bags clamp
  {
    const wE = makeWorld({ field: flatF17, seed: 32 });
    const GE = mkGrid17(20);
    for (let gz = 0; gz < 20; gz++) { const c = GE.cells[GE.idx(10, gz)]; c.bag = 2; c.bagId = 998; }
    const vE = armorAt17(wE, -9, 1);
    vE.order = "move"; vE.dest = { x: 9, z: 1 };
    stepDrivers(wE, GE, identFwdDir, null);
    ok("T17(e): an order through ENEMY bags keeps its destination", Math.hypot(vE.dest.x - 9, vE.dest.z - 1) < 0.6, `${vE.dest.x},${vE.dest.z}`);
    const wF = makeWorld({ field: flatF17, seed: 32 });
    const GF = mkGrid17(20);
    for (let gz = 0; gz < 20; gz++) { const c = GF.cells[GF.idx(10, gz)]; c.bag = 1; c.bagId = 997; }
    const vF = armorAt17(wF, -9, 1);
    vF.order = "move"; vF.dest = { x: 9, z: 1 };
    stepDrivers(wF, GF, identFwdDir, null);
    ok("T17(e2): FRIENDLY bags clamp the order short", Math.hypot(vF.dest.x - 9, vF.dest.z - 1) > 0.6, `${vF.dest.x},${vF.dest.z}`);
  }
  // (f) the bag lifecycle is wired (source shape) and the side rides the save
  {
    ok("T17(f): the stamp helper exists and stamps side + cell", /const stampBag = \(b, side\) => \{/.test(dgSrc17));
    ok("T17(f2): the seeded rings stamp their depot's side", /stampBag\(spawnSandbag\(/.test(dgSrc17));
    ok("T17(f3): a resumed bag re-stamps its cell", /if \(b\.sandbag && b\.alive\) stampBag\(b, b\.bagSide \|\| 1\);/.test(dgSrc17));
    ok("T17(f4): dead bags release their ground at the derived cadence", /c\.bagId == null/.test(dgSrc17));
    ok("T17(f5): bagSide RIDES the save (never in the drop list)", !/BODY_HANDLED[\s\S]{0,600}bagSide/.test(saveSrc17));
  }
}
// ==== end P7 T17 =============================================================
```

`dgSrc17`/`saveSrc17` via the suite's source-read idiom; `mkGrid17` is the T13/T16 mini-grid with `bag: null, bagId: null` added to its cell literal; `armorAt17` the T16 armor helper; `memberNearRow` joins the state.js import line. Run the suite — the T17 block must FAIL. Report the failing output.

**Step 2 — the reach.** In `src/depot/state.js`, beside the other pure exports:

```js
// P7 T17 (owner): ENGINEERS BUILD WITH THEIR HANDS — the reach test, pure
// and exported for the suite (the T8/T10 factoring precedent). A live squad
// member within reach meters of the row's spot.
export function memberNearRow(world, sq, row, reach) {
  for (const id of sq.memberIds) {
    const u = world.byId.get(id);
    if (u && u.alive && Math.hypot(u.pos.x - row.x, u.pos.z - row.z) <= reach) return true;
  }
  return false;
}
```

In `src/depot/DepotGame.jsx`: `memberNearRow` joins the state.js import; the LAY constants (~2436) gain `const LAY_REACH = 3;   // m — no hands within reach, no piece // provisional (F5)`; and the lay loop gains its gate directly above `const r = layPieceAt(job, row);`:

```js
            // P7 T17 (owner): ENGINEERS BUILD WITH THEIR HANDS — a row lays
            // only while a live member stands within reach; no one near, this
            // row and every row behind it wait for the men. The anchor keeps
            // walking (its escape stands) — rows it outruns lay late, when
            // hands pass them, or die unlaid with the job. Skips never charge.
            if (!memberNearRow(world, sq, row, LAY_REACH)) break;
```

**Step 3 — the pick arms the bar.** In `S.pickManifest` (~3279), after the toast line:

```js
        // P7 T17 (owner): THE PICK ARMS THE BAR — the next ground tap places
        // what the convoy just delivered. Hero keys stay two-tap buys.
        if (!key.startsWith("hero_")) setMode(key);
```

**Step 4 — the active button toggles off.** In `setMode` (4335), directly after the hero branch (4341):

```js
    // P7 T17 (owner): TAP AGAIN TO PUT IT AWAY — the active build button is
    // a toggle; the second tap clears back to plain command.
    if (S.mode === m) {
      if (S.linePending && S.rejectLine) S.rejectLine();
      S.mode = null; S.pending = null; S.buildPt0 = null;
      setHud((h) => ({ ...h, mode: null }));
      return;
    }
```

**Step 5 — bags claim their ground, for hulls only.** In `src/depot/DepotGame.jsx`:

5a. `makeGrid`'s cell literal (~442) gains `bag: null, bagId: null`.

5b. Mount scope, after the grid exists (beside seedBags):

```js
      // P7 T17 (owner): HULLS RESPECT FRIENDLY SANDBAGS — a bag claims its
      // cell for HULL routing only (men still fight over bags; foot routing,
      // the enemy flow, and connectivity never read c.bag). The side rides
      // the body (bagSide) so a resumed war re-stamps honestly — b.team is 1
      // on every bag by spawnSandbag's old shape and must not be trusted.
      const stampBag = (b, side) => {
        b.bagSide = side;
        const cell = grid.cellAt(b.pos.x, b.pos.z);
        if (cell) { cell.bag = side; cell.bagId = b.id; }
      };
```

5c. seedBags' lay line (~1689) wraps: `stampBag(spawnSandbag(world, bx, bz, ...), depotT.team === 2 ? 2 : 1);` — the orient argument unchanged.

5d. The engineer lay (~2637) wraps: `stampBag(spawnSandbag(world, row.x, row.z, orient), 1);`

5e. The resume path, after `restoreWelds(world, RES, resBodies);`:

```js
        // P7 T17: resumed bags re-claim their ground for hull routing.
        for (const b of resBodies) if (b.sandbag && b.alive) stampBag(b, b.bagSide || 1);
```

5f. The 4Hz derived block (beside the mines/threads steps) gains the release sweep:

```js
          // P7 T17: dead bags release their ground — same cadence as the
          // other derived overlays; bagId cells are few.
          if (terrGuard > 0) for (const c of grid.cells) {
            if (c.bagId == null) continue;
            const b = world.byId.get(c.bagId);
            if (!b || !b.alive) { c.bag = null; c.bagId = null; }
          }
```

**Step 6 — routing and the ramming ruling read bags.** In `src/depot/route.js`, `shut()`'s hull clause becomes:

```js
    if (hull) return c.blocked || c.steep || c.bag != null || tight(ci);
```

In `src/depot/drivers.js`, the ram sampler's hard test gains the friendly-bag term — the line becomes:

```js
        if (cell.steep || cell.terrain || cell.water || (struct && cell.bTeam !== foe) || (cell.bag != null && cell.bag !== foe) || (cell.blocked && !struct)) ram = false;
```

(An enemy-side bag cell is rammable exactly as enemy masonry is — no other change.)

**Step 7 — gates.** `node scripts/depot-test.mjs`, `node scripts/depot-lint.mjs`, the build, `node scripts/smoke.mjs`. Nothing else. Golden does NOT run. Expected re-pins: zero; any that move re-pin honestly, old → new, each its own labeled bullet.

**Step 8 — the landing.** Bump `src/version.js` to `mk1.47`. Build AFTER the bump. Commit: `hands and habits: reach, the armed pick, the toggle, the respected bags (mk1.47)`. Push. Report: read-confirmation opening, gate results, every deviation and re-pin labeled.
