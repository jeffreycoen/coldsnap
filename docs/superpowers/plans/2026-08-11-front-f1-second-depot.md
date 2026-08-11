# FRONT F1 — The Second Depot (code-bearing plan; for Jeff's approval; no code until approved)

> **For agentic workers:** superpowers:subagent-driven-development, tasks in order, one implementer at a time. Every task: write the failing asserts FIRST, verify they fail, implement, verify pass, run the gates, commit, PUSH, FOREGROUND CI poll, report. Max 3 implement-verify cycles then BLOCKED with findings. Reports to Jeff: plain language, no jargon, every nonconformity its own labeled bullet. Verify every line-number anchor by reading before editing — drift is expected.

**Goal:** The enemy gets a depot — real masonry at their end, breachable by the same physics as yours — and the war gets its one true ending: a depot falls. Lands vision picks 2 and 5 (docs/superpowers/plans/2026-08-11-depot-front-vision.md). Waves stay (F2's job); the enemy doesn't defend its depot yet (F3's job) — in F1 its defense is distance and the army in the field.

## Global Constraints
- Frozen modes + core.js untouched (STOP on any core need). No `Math.random()` string in src/depot. Rng contracts exact: 1 draw/attack leg, 2/shot, 4/planWave — every new path below is draw-free.
- Laws: structure fire never fog-gates; unit fire always fog-gates; every fire call threads `owner`, every arcClears threads `selfId`; symmetry.
- All new numbers provisional (F5 owns them) — label each in-code `// provisional (F5)`.
- Gates per task: `node scripts/depot-test.mjs && npm run test:accuracy && npm run lint:depot && npm run build && SMOKE_ONLY=depot node scripts/smoke.mjs` (+`npm run test:td-render` when renderer touched).
- Commit trailer: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

## Verified anchors (re-verify by reading)
- genMap TOWN seed entry: DepotGame.jsx:89 `const town = [{ id: "depot", x: 0, z: 52, nx: 9, nz: 7, ny: 6, door: 4, depot: true }]`; spawns at `z: GRID_OZ + 2` (canonical −54): :55; roads :56-61; makeMap retry loop + connectivity :128-151.
- buildTown depot branches (weld ×1.5, corner posts, flag body team 1): DepotGame.jsx:385-457; flag at :448-453.
- Emitter builder (flag → EMIT.depot sign 1; SPAWN_POINTS anchors sign −1): DepotGame.jsx:654-674.
- Census: state.js censusDepotChunks :408-415 (filters `b.town === "depot"`), depotStandingFraction :423-433, checkDepotBreach :439-447, stepDepotCensus :456-464; wired at DepotGame.jsx:631, :1576.
- Endings: checkLoss state.js:551-559 (lives), checkWin :565-573 (book value), advance :814-830 (calls checkWin past table end), tryStall attrition/spent :742-767.
- Leaks: units.js checkLeaks :528-539; called DepotGame.jsx:581; leak event drain + lives at DepotGame.jsx:1272-1275; HUD ♥ chip :1763.
- squadFire (unit-only targeting): state.js:222-257. Enemy rifleman structure scan (the mirror template): units.js:286-297.
- Renderer flag draw: find the `flagPole` consumer in renderer.js (reads the body; tint currently team-agnostic) — locate before editing.

---

### Task 1: their depot stands

**Files:** `src/depot/DepotGame.jsx`, `src/render/renderer.js` (flag tint), `scripts/depot-test.mjs`.

**1a — genMap places it.** After the town seed entry (DepotGame.jsx:89), add the enemy depot on the enemy side, clear of spawns/roads:

```js
// FRONT F1: the enemy depot — same lattice as ours (symmetry), centered on
// the enemy end behind the spawn line's midpoint gap. Canonical (0, -46):
// spawns sit at v = -54, roads run from them THROUGH the passes toward
// (0, 49) — at v = -46 the two roads are still near their spawn-x origins
// (|x| >= ~3 by construction), and the depot footprint (9*0.83/2 ≈ 3.7m
// half-width) needs the road-clearance check below regardless: genMap
// retries with a new seed offset when fouled (the existing makeMap retry
// loop already re-rolls on failed connectivity — reuse it, don't add a
// second loop).
const town = [
  { id: "depot",  x: 0, z: 52,  nx: 9, nz: 7, ny: 6, door: 4, depot: true },
  { id: "depot2", x: 0, z: -46, nx: 9, nz: 7, ny: 6, door: 4, depot: true, team: 2 },
];
```

- Clearance: extend the existing per-building rejection tests (ponds :102, rocks :103, town-vs-town :104) to also reject any LATER town placement that fouls depot2, and add a depot2-vs-road check (roadDist(depot2) > footprint half-diagonal + 2) INSIDE genMap; if depot2 itself is fouled by roads/spawns for a seed, let makeMap's retry loop re-roll (it already retries ×10 on connectivity).
- Connectivity: the existing checkConnectivity(spawns → OBJ_POS) stays; add the mirror — every spawn must also reach depot2's doorway cells (the enemy must be able to defend home ground later; also guards F3).

**1b — buildTown handles team.** The `t.depot` branches (:396, :410, :425, :444) all fire for depot2 already (it carries `depot: true`). Changes: the flag body takes the town's team — `team: t.team || 1` (:449); chunk bodies stay team 0 (masonry is masonry — the census tells the depots apart by `b.town`, which is already set per-building at :406).

**1c — emitters.** In buildEmitters (DepotGame.jsx:654-674):

```js
// flags emit their OWN team's influence at homeland strength — the enemy
// depot IS the enemy anchor now.
else if (b.kind === "flag") { const c = invW(b.pos.x, b.pos.z); out.push({ x: c.u, z: c.v, w: EMIT.depot.w, r: EMIT.depot.r, sign: b.team === 2 ? -1 : 1 }); }
```

- DELETE the SPAWN_POINTS anchor push (:672). Spawn points remain as spawn locations only.

**1d — renderer flag tint (DEPOT-gated).** Find the flagPole draw; cloth color keys on the flag body's team (team 2 → the enemy scarlet family already used for enemy dress; team 1/undefined → current gold). No option passed → byte-identical (td-render green).

- [ ] **Step 1 — failing asserts** (depot-test, new F1 block): build the real map (makeMap + buildTown) on a pinned seed → a "depot2" chunk lattice exists with the same stone-count law as "depot" (same nx/nz/ny formula ± door/ruin variance); exactly two flag bodies, teams 1 and 2; after 30 simulated seconds of stepTerritory with live emitters, fogStateFor at depot2's cell reads "unheld" for team 1 and "held" for team 2 (sign mirror of yours); the spawn-edge cell that the OLD anchor kept permanently red now decays toward 0 when no enemy stands there (τ-decay observable); connectivity both directions; 20-seed sweep — depot2 never fouls roads/spawns/ponds/rocks and maps always build.
- [ ] **Step 2:** verify fail → **Step 3:** implement → **Step 4:** gates (+td-render) → **Step 5:** Commit "FRONT F1: their depot stands — real stone at the other end" → PUSH + report.

### Task 2: both depots can fall

**Files:** `src/depot/state.js`, `src/depot/DepotGame.jsx`, `scripts/depot-test.mjs`.

**2a — census per depot.** censusDepotChunks gains a town-id parameter (default keeps today's callers honest):

```js
// state.js — censusDepotChunks(bodies, townId = "depot")
export function censusDepotChunks(bodies, townId = "depot") {
  const out = [];
  for (const b of bodies) {
    if (b.kind !== "chunk" || b.town !== townId) continue;
    out.push({ id: b.id, home: { x: b.pos.x, y: b.pos.y, z: b.pos.z } });
  }
  return out;
}
```

**2b — the enemy breach track.** Mirror of checkDepotBreach, victory-signed:

```js
// state.js — the OTHER loss track's mirror: their depot below the standing
// threshold ends the war in the Bureau's favor. Same idempotence contract.
export function checkEnemyBreach(S, fraction) {
  if (S.gameOver || S.victory) return false;
  if (fraction < DEPOT_BREACH_FRAC) {   // same threshold both sides (symmetry; provisional, F5)
    S.victory = true;
    S.enemyBreach = true;
    return true;
  }
  return false;
}
```

**2c — one census gate, two readings.** stepDepotCensus's computeFraction callback returns `{ player, enemy }`; the gate stores both (`S.depotStanding`, `S.enemyStanding`) and calls both breach checks. DepotGame builds `depotCensus2 = censusDepotChunks(world.bodies, "depot2")` beside the existing census (:631) and the :1576 call site passes a combined compute. Same 1Hz accumulator — no second timer.

**2d — end card.** makeEndDispatch gains the victory-breach branch ABOVE the generic victory branches:

```js
  if (victory && enemyBreach) {
    return { wo, lines: [
      "THE OPPOSING DEPOT IS BREACHED.",
      "The position opposite is rubble. The field belongs to the Bureau.",
      `${kills} CONFIRMED. FIELD ORDER CLOSED.`,
    ] };
  }
```

- HUD0/hud plumbing: `enemyBreach: false`, `enemyStanding: 1` mirrored wherever breach/depotStanding flow today (HUD0 :832-839, the setHud block :1638-1673, __DEPOT__ hook :1291).
- [ ] **Step 1 — failing asserts:** scripted demolition of depot2 chunks (displace past DEPOT_STANDING_TOL, the census's own standing rule) below 0.58 → victory + enemyBreach + the new card lines; same for yours → loss (existing, re-pinned); whichever fires first wins, the other never overwrites (idempotence, both orders); both fractions on the state hook; census still ~1Hz (call-count guard); twin determinism.
- [ ] **Step 2:** verify fail → **Step 3:** implement → **Step 4:** gates → **Step 5:** Commit "FRONT F1: both depots can fall" → PUSH + report.

### Task 3: the only ending (vision pick 5)

**Files:** `src/depot/state.js`, `src/depot/units.js`, `src/depot/DepotGame.jsx`, `scripts/depot-test.mjs`, `scripts/smoke.mjs` (stale-assert sweep).

**3a — leaks retire.** DELETE units.js checkLeaks (:528-539) and its call (DepotGame.jsx:581); DELETE the leak-event branch in drainEvents (:1272-1275) and `S.lives` everywhere (makeRunState, HUD ♥ chip :1763, hud fields). An enemy reaching your depot now stays and fights — his structure fire (riflemen/grenadiers/tanks/sappers all already target walls/towers... and Task 4's mirror makes depot masonry targetable for BOTH sides' infantry — see 4c) chews the building; the breach census is the cost.
- Wave-results bookkeeping: ws.results.leaks and RESULTS.leak stay (dead fields read 0 — economy.js untouched this phase; F5 retires the rates).

**3b — economic endings become means.** checkLoss drops the lives clause (breach + the stubbed regiment hook remain — checkDepotBreach already sets gameOver directly). In tryStall: the attrition block (:742-745) and spent block (:760-767) stop setting `S.victory` — replace with dispatch-line-only observations (the bureau REPORTS the enemy's collapse; the war continues until the rubble says otherwise):

```js
  // FRONT F1: a broken or starved regiment no longer ENDS the war — it just
  // can't defend its depot. The bureau notes it; the guns finish it.
  if (S.reg && !S._reportedBreak && combatIneffective(S.reg)) {
    S._reportedBreak = true;   // one-time dispatch line, composed at this stall
  }
```

- checkWin (book value) is no longer called: advance() (:814-830) loses its `waveIdx >= WAVES.length` ending branch — see 3c. Function stays exported (probe reads it) with a comment: retired as an ending, F5 may delete.

**3c — waves cycle.** startWave/tryStall/advance index the table as `WAVES[Math.min(ws.waveIdx, WAVES.length - 1)]` — composition and delay CLAMP at the late-game row and the war runs until a depot falls (`// provisional (F2 replaces waves wholesale)`). makeDispatch's "FINAL WAVE CLEARED" branch and the wave counter's `n/50` display change to open-ended copy ("WAVE n CLEARED. HOLD." only; HUD chip shows `W n`).
- [ ] **Step 1 — failing asserts:** an enemy parked at your depot for 30 simulated seconds neither despawns nor costs anything, and depot masonry hp drops (his structure fire reaches it — note: TODAY riflemen target only kind tower/wall; this assert is written against Task 4's shared hostile-structure set and lands in the same push as 4c if needed — implementer sequences 3+4 commits so no broken intermediate state ships); run advances past waveIdx 50 with waves still spawning; forced combatIneffective sets NO victory but its dispatch line appears once; the only two enders are the two breaches (exhaustive: force lives-analog/ledger/attrition/spent conditions, assert no end); grep pins — no "lives", ♥, "FINAL WAVE", book-value verdict strings in HUD/cards; twin determinism.
- [ ] **Step 2:** verify fail → **Step 3:** implement → **Step 4:** gates + smoke stale-assert sweep (smoke asserts on ♥/lives/wave-50 must be updated in the same push) → **Step 5:** Commit "FRONT F1: one way to win, one way to lose" → PUSH + report.

### Task 4: your rifles learn to bite stone (the offense exists)

**Files:** `src/depot/state.js` (squadFire + the hostile-structure set), `src/depot/units.js` (enemy side joins the shared set), `scripts/depot-test.mjs`.

**Why:** player squads today target only units (state.js:243-252) — with no garrison at depot2 until F3, the player would have no way to win. The enemy's riflemen already shoot structures; symmetry demands the mirror.

**4a — one shared definition of "enemy structure":**

```js
// state.js — hostileStructure(b, team): what team's shooters may treat as
// an enemy STRUCTURE target. Team 2 (attacker): player towers/walls (as
// today) + the player depot's masonry. Team 1 (player): enemy towers/walls
// (none until F3 — the set is ready for them) + the enemy depot's masonry.
// Structure fire never fog-gates (the law) — range + arcClears only.
export function hostileStructure(b, team) {
  if (!b.alive) return false;
  if (team === 1) {
    if ((b.kind === "tower" || b.kind === "wall") && b.team === 2) return true;  // F3-ready
    return b.kind === "chunk" && b.town === "depot2";
  }
  if ((b.kind === "tower" || b.kind === "wall") && b.team === 1) return true;
  return b.kind === "chunk" && b.town === "depot";
}
```

**4b — squadFire targets stone when no man is in reach.** After the unit scan (state.js:243-252) finds nothing:

```js
    if (!best) {
      // No man in reach — bite stone. Nearest hostile structure in range,
      // LOS by the real arc (selfId), NEVER fog-gated (structure law).
      let bs = eR * eR;
      for (const s of world.bodies) {
        if (!hostileStructure(s, squad.team)) continue;
        const dx = s.pos.x - u.pos.x, dz = s.pos.z - u.pos.z, d2 = dx * dx + dz * dz;
        if (d2 >= bs) continue;
        if (!arcClears(world, muzzle, s.pos, spec, u.id)) continue;
        bs = d2; best = s; bestIsStruct = true;
      }
    }
    if (!best) continue;
    u.fireCd = spec.fireRate;
    shooterFire(world, u, muzzle, best, fspec, bestIsStruct
      ? { attacker, volleyDelay: spec.burstGap, muzzleStep: 0, owner: u.id, hitStruct: true, hitOnly: "structure" }
      : { attacker, volleyDelay: spec.burstGap, muzzleStep: 0, owner: u.id });
```

- Unit targets keep absolute priority (the structure scan runs only on an empty unit scan — men are always the urgent threat). Deterministic pick: nearest, ties by body id order (the scan order already gives this).

**4c — the enemy joins the shared set.** units.js's rifleman/grenadier/tank structure scans (:286-297, :364-372, :110-126) swap their inline `kind tower|wall` filter for `hostileStructure(s, 2)` — behavior identical today (the set adds depot masonry: enemies at your depot now chew it, which is Task 3's survival story) — plus the sapper's wall-seek (:418-422) gains depot chunks the same way.
- Expected pace measured, not tuned: rifles/mg vs 100-mass welded stone is SLOW (the point — sieges want the F6 machines); record shots-to-displace-one-stone in the report.
- [ ] **Step 1 — failing asserts:** an ordered squad in range of depot2 with no units in reach fires and depot2 stone hp drops; a live enemy unit re-entering range immediately outranks the stone; fog NEVER gates stone shots either side (law, asserted both signs); enemy infantry at your depot damages "depot" masonry through the same set; owner threaded (zero self-hit events across 200 rounds); unit-target damage parity unchanged to 4 decimals (open-ground fixture); twin determinism.
- [ ] **Step 2:** verify fail → **Step 3:** implement → **Step 4:** gates → **Step 5:** Commit "FRONT F1: the offense exists — rifles bite stone" → PUSH + report.

### Task 5: closer — probe + smoke + stale docs + Jeff plays

**Files:** `scripts/economy-probe.mjs`, `scripts/smoke.mjs`, `src/depot/state.js` (stale comment), `2026-08-09-depot-roadmap.md` (note), `scripts/depot-test.mjs`.

- Probe learns the new endings: verdicts become breach/timeout-horizon (a run that reaches wave 60 without either breach records "STALEMATE-60" — provisional horizon); sanity re-reads: none-defense still dies by breach ≤ wave ~3 (enemies now chew, not leak — re-measure the overrun pace and record it); median survives meaningfully; a scripted siege bot (3 rifle squads ordered onto depot2 under escort) can win by enemy breach on at least some seeds. Record the matrix; NO tuning (F5).
- Smoke: two-depot section — red flag visible on their end (screenshot), an enemy reaching your depot persists and masonry hp drops (state-hook poll), scripted depot2 demolition (debug hook `__DEPOTBREACH2__` mirroring __DEPOTEND__'s pattern) → victory card with the new text; rotated variant; stale ♥/lives/50-wave asserts already swept in Task 3.
- Stale docs fold-in: state.js's outdated sniper-vs-tank armor comment block (contradicts shipped armor 140 — rewrite to match units.js:43 reality); roadmap doc gets a one-line pointer to the FRONT vision.
- [ ] Gates + probe matrix recorded in report + this plan → Commit "FRONT F1 closes: two depots, one ending" → PUSH + report: matrix, ONE phone screenshot (their depot under rifle fire), and playtest framing — what should feel different (no hearts, enemies that stay, the long siege), what F2/F3 fix next (pacing, the undefended far depot).

---

## Self-review notes
- Scope: four structural changes only — no heartbeat (F2), no enemy builders (F3), no new weapons. Task 4 is the smallest honest mirror that makes the game winnable.
- Task 3/4 interlock: retiring leaks makes enemies-at-depot meaningful ONLY once depot masonry is targetable — the plan sequences them adjacently and allows a joint push if the intermediate state would ship broken.
- The old endings' machinery (economy, intel, results) survives untouched as means; only the run-ender wiring changes. F5 decides what dies for good.
- Numbers introduced: depot2 at canonical (0,−46); breach threshold reused 0.58 both sides; stalemate horizon 60. All provisional, all labeled.
- Anchors verified against the live tree 2026-08-11; implementers re-verify before editing.
