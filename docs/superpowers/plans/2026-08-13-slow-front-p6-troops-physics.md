# TROOPS & PHYSICS — phase plan (P6)

*2026-08-13. Governs the mk1.1x series. The owner's rulings shaping this phase (decision record, 2026-08-13): squads STAY the unit model (singles shelved); prices double at a half-full field; one order walks the stream crossing; ONE path system on the movement grid owns both the water detour and the mid-march stall; the masonry-contact kill is fixed in the physics rule; the site opens straight into Winter Front with all copy audited; the README leads with the showcase. The selection interface is deferred to polish. The frost tower's freeze-shot rework is deferred to the arms phase, paired with the rocket troopers.*

*Marks: Task 1 = mk1.10, then +0.01 per task. Every deploy bumps `src/version.js` and builds AFTER the bump. Task 1's commit carries the roadmap flip (The Front → DONE; a new Troops & Physics card → IN PROGRESS) per the fold-in convention.*

---

## The task list

**Task 1 — The path that walks around** — POPULATED BELOW (mk1.10).

**Task 2 — Stone doesn't murder pedestrians** — POPULATED BELOW (mk1.11).

**Task 3 — Only engineers build** *(skeleton; owner's ruling, 2026-08-13)*
- Walls and sandbags leave the build bar — laid only by engineer squads walking their two-point lines.
- Towers keep direct placement; the seeded depot sandbags stay.
- Every tutorial/copy line that says "tap to build a wall" follows the truth.

**Task 4 — The bell market** *(skeleton)*
- Prices re-set at every bell from what stands on the field, men plus masonry, against the physics budget.
- Flat when empty, double at half-full, capped near 4x. Both sides pay the same table.
- The build bar and manifest show the live prices.

**Task 5 — The body lists, resurrected** *(skeleton)*
- The archived typed-pools spec (THE FRONT plan, bottom), re-landed as written.
- Measured with THE FRONT Task 6's protocol: means and medians, two repeats, tails reported never gating.

**Task 6 — The weld scan sleeps too** *(skeleton)*
- The per-tick walk over every weld skips what sleeps — the collision books' cousin.
- Same engine gates; before/after measured alongside Task 5's numbers.

**Task 7 — The front door** *(skeleton)*
- The site opens straight into Winter Front's start screen; one small tech-demos link to a second page.
- Every line of site copy audited against what the game is now — stale wording dies.

**Task 8 — The README** *(skeleton)*
- Showcase first: screenshots from the deployed game, the bold true claims.
- The technical section beneath, for engineers who keep reading.

**Close** — the owner's playtest closes the phase.

---

# TASK 2 — Stone doesn't murder pedestrians (mk1.11)

**What it does.** Ends the wall kill. Today the engine ejects a body that ends up overlapping stone, and the impact classifier reads a hard ejection as a lethal slam — a man squeezed against a standing building by his own formation dies to a wall that never moved (the owner lost one this way). The new rule, in one sentence: A SLEEPING STONE IS NOT A WEAPON. Under depot combat, a chunk that is asleep — a standing wall face, settled rubble — can neither deal the lethal ejection slam to a living man nor count as burying him. Everything that actually moves keeps killing exactly as today: falling and flying masonry (the falling-stone clock is reset the moment a chunk sleeps, so those paths never see a sleeping stone anyway), and genuine burial (the classifier itself keeps any stone truly bearing on a man AWAKE — that line already exists — so a pinning pile is never asleep and never exempt).

**Why the guard is "sleeping" and not "standing welded":** sleeping is the physically honest test — an asleep body has zero velocity by definition, so any contact force against it is pure position correction, not a blow. It also covers settled loose rubble a man walks across, which could eject-kill exactly like a wall. The owner's intent — walking into stone must not kill — is the rule; sleeping is its exact mechanical form.

**Frozen-law note:** engine change in `core.js`'s impact classifier, GUARDED on `world.depotCombat` like every depot divergence — the demo, tower defense, campaign, and sandbox are byte-identical, and golden stays green by construction. The ONE world that legitimately changes is the depot — so the T6 keystone's pinned hash and draw count MAY move: that re-pin is EXPECTED, NAMED, and reported old→new. It is this task's delta made visible. Any OTHER assert moving is a defect — STOP.

**Feel changes:** men stop dying at walls. Nothing else.

**Suggested model:** Sonnet — the edit is three lines plus a comment, specified verbatim; the tests are the work.

**Required reading (re-verify anchors at dispatch):**
- `src/engine/core.js` — 1641–1707 (classifyImpacts, the whole function — the edit site), 1708–1760 (stepStatus head: the burial clock and the `other.sleepT = 0` line's consumer, read-only), 1857–1889 (stepSleep, read-only — why sleeping means motionless).
- `scripts/golden.mjs` — whole (run-only; its worlds never set depotCombat — verify that, it is what keeps golden green).
- `scripts/depot-test.mjs` — 1–70, the FRONT T6 block (the keystone whose pins may move), the P6 T1 block + tail (the new block lands before the tail).
- `src/version.js`.

**Trap notes:**
- The guard is `world.depotCombat && other.kind === "chunk" && other.sleeping && victim.kind === "unit"` — vehicles ramming walls, the demo, and every ungated world keep today's behavior byte-for-byte.
- The COLLAPSE branch needs NO edit: it requires a live falling clock (`fallingSince > 0`), and the "chunks settle" line already clears that the moment a chunk sleeps.
- The burial exemption removes the `other.sleepT = 0` reset for sleeping stones — harmless: they are already asleep, and stones genuinely bearing on a man were never asleep in the first place.
- EXPECTED RE-PINS: exactly one PAIR may move — the T6 keystone's `T6_HASH`/`T6_DRAWS` (a man surviving a wall in that battle changes everything downstream of him, deterministically). If they move, re-pin old→new and REPORT both values. If they do NOT move, that is also fine (the fixture may contain no such death) — report that. Any other assert moving is a STOP.
- Red-first discipline for the (a) fixture: if the embedded man SURVIVES before the fix (the fixture too weak to trigger the old kill), that is a STOP-and-report, not a fixture tweak.
- FULL `npm run smoke` — engine change, every surface rides it.

## Steps, in execution order

**Step 1 — failing asserts first.** Insert the P6-T2 block before the tail summary; `npm run test:depot` shows (a) red (the embedded man dies under today's rule) and the (d) source pin red; (b) green already (falling stone kills both before and after — record it as green-first, that is its job). Record the exact reds.

```js
// ==== P6 T2: stone doesn't murder pedestrians ===============================
// mk1.11 (Troops & Physics, Task 2). A sleeping stone is not a weapon: under
// depot combat the ejection out of a standing wall (or settled rubble) can
// no longer slam a living man dead, and a sleeping stone never counts as
// burying him. Falling stone kills exactly as before — (b) proves it.
{
  console.log("\n[p6 t2: stone doesn't murder pedestrians]");
  const flatT2 = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } };

  // one welded, sleeping two-stone stack — a standing wall face
  const buildStack = (world, x, z) => {
    const lo = addBody(world, { kind: "chunk", team: 0, mass: 100, hx: 0.4, hy: 0.4, hz: 0.4, x, y: 0.42, z, friction: 0.65, restitution: 0.02 });
    const hi = addBody(world, { kind: "chunk", team: 0, mass: 100, hx: 0.4, hy: 0.4, hz: 0.4, x, y: 1.25, z, friction: 0.65, restitution: 0.02 });
    addWeld(world, lo, hi, 8.0e4);
    lo.sleeping = true; hi.sleeping = true;
    return { lo, hi };
  };

  // (a) THE WALL KILL DIES: a man pressed into a sleeping wall by his own
  // side's shoving (deterministic pushes, the cohesion squeeze in miniature)
  // is ejected but NOT killed. RED before the fix — he dies today.
  {
    const world = makeWorld({ field: flatT2, seed: 9 });
    world.depotCombat = true;
    buildStack(world, 0, 5);
    const man = addBody(world, { kind: "unit", team: 1, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x: 0, y: 0.86, z: 4.5, hp: 58, friction: 0.55 });
    for (let i = 0; i < 360; i++) {
      if (i < 180 && i % 24 === 0 && man.alive) { man.v.z = 3.0; } // the squeeze, re-applied
      stepWorld(world);
    }
    ok("T2(a): the man pressed into a sleeping wall SURVIVES", man.alive === true, `alive=${man.alive} hp=${man.alive ? man.hp.toFixed(0) : "dead"}`);
  }

  // (a2) settled loose rubble is exempt the same way (no weld, still asleep)
  {
    const world = makeWorld({ field: flatT2, seed: 9 });
    world.depotCombat = true;
    const r1 = addBody(world, { kind: "chunk", team: 0, mass: 100, hx: 0.4, hy: 0.4, hz: 0.4, x: 0, y: 0.42, z: 5, friction: 0.65, restitution: 0.02 });
    r1.sleeping = true;
    const man = addBody(world, { kind: "unit", team: 1, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x: 0, y: 0.86, z: 4.5, hp: 58, friction: 0.55 });
    for (let i = 0; i < 360; i++) {
      if (i < 180 && i % 24 === 0 && man.alive) { man.v.z = 3.0; }
      stepWorld(world);
    }
    ok("T2(a2): the man pressed into sleeping rubble SURVIVES", man.alive === true, `alive=${man.alive}`);
  }

  // (b) FALLING STONE STILL KILLS (green before AND after — the guard's
  // honesty check): a freed chunk dropped on a man's head stays lethal.
  {
    const world = makeWorld({ field: flatT2, seed: 9 });
    world.depotCombat = true;
    const man = addBody(world, { kind: "unit", team: 1, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x: 0, y: 0.86, z: 5, hp: 58, friction: 0.55 });
    const rock = addBody(world, { kind: "chunk", team: 0, mass: 100, hx: 0.4, hy: 0.4, hz: 0.4, x: 0, y: 7, z: 5, friction: 0.65, restitution: 0.02 });
    rock.fallingSince = world.t; // severed mid-collapse, exactly as weldBreakPass stamps it
    for (let i = 0; i < 600 && man.alive; i++) stepWorld(world);
    ok("T2(b): falling stone still kills (green first, green after)", man.alive === false, `alive=${man.alive}`);
  }

  // (c) the demo path is untouched: same squeeze, depotCombat OFF — the man
  // dies today and keeps dying (byte-identical ungated worlds; golden's law).
  {
    const world = makeWorld({ field: flatT2, seed: 9 });
    buildStack(world, 0, 5);
    const man = addBody(world, { kind: "unit", team: 1, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x: 0, y: 0.86, z: 4.5, hp: 58, friction: 0.55 });
    for (let i = 0; i < 360; i++) {
      if (i < 180 && i % 24 === 0 && man.alive) { man.v.z = 3.0; }
      stepWorld(world);
    }
    ok("T2(c): the ungated world keeps today's behavior (he still dies there)", man.alive === false, `alive=${man.alive}`);
  }

  // (d) source pin: the guard exists, gated, in the classifier
  const csrcT2 = fs.readFileSync(new URL("../src/engine/core.js", import.meta.url), "utf8");
  ok("T2(d): the sleeping-stone guard exists in classifyImpacts",
    /SLEEPING STONE IS\s*\n?\s*\/\/ NOT A WEAPON|SLEEPING STONE IS NOT A WEAPON/.test(csrcT2) && /inertStone/.test(csrcT2));
}
// ==== end P6 T2 ==============================================================
```
Note on (c): if the ungated man SURVIVES today (the fixture squeeze too weak even for the old rule), (a) will not be red either — that is the red-first STOP; report it rather than strengthening the squeeze on your own authority.

**Step 2 — the engine edit.** `src/engine/core.js`, classifyImpacts. Directly after `const dv = pn * victim.invM;` (line 1659):
```js
    // DIVERGENCE (guarded, mk1.11 — the owner's ruling): A SLEEPING STONE IS
    // NOT A WEAPON. Under depotCombat, a chunk that is ASLEEP — a standing
    // wall face, settled rubble — can neither slam a living man dead (the
    // depenetration ejection read as lethal IMPACT below) nor count as
    // burying him. It has no motion to kill with. Everything that moves is
    // untouched: falling stone's clock (fallingSince) is cleared the moment
    // a chunk sleeps, and a stone genuinely BEARING on a man is kept awake
    // by the burial line itself — a pinning pile is never asleep.
    const inertStone = world.depotCombat && other && other.kind === "chunk" && other.sleeping && victim.kind === "unit";
```
The burial line (1670–1673) gains the guard in its condition:
```js
    if (victim.kind === "unit" && other && other.kind === "chunk" && pn > 5 && !inertStone &&
```
And the final lethal-IMPACT branch (1692) gains it:
```js
    } else if (dv > (other && other.kind === "ice" ? 24 : 8) && !inertStone) {
```
Nothing else in the function moves.

**Step 3 — the proof gates.** `npm run test:depot`: the T2 block fully green; the T6 keystone MAY go red on its two pins — if so, rerun to confirm the new printed values are stable, re-pin `T6_HASH`/`T6_DRAWS` to them, and REPORT old→new for both (the one named, expected re-pin). Everything else green, zero other re-pins. Then `npm run golden` — green (the guard is gated; golden's worlds never set depotCombat — verified in reading). Then `npm run lint:depot`.

**Step 4 — bump, build, full smoke.** `src/version.js` → `"mk1.11"` · `npm run build` AFTER the bump · `npm run smoke` (FULL — engine change).

**Gates (ONLY these):** parse changed files · `npm run lint:depot` · `npm run test:depot` (Step 1 red-first, then green; the keystone pair is the only allowed re-pin, reported old→new) · `npm run golden` · `npm run build` after the bump · `npm run smoke` (full). Allowed files: `src/engine/core.js`, `scripts/depot-test.mjs`, `src/version.js`. Commit `"stone doesn't murder pedestrians (mk1.11)"`, push, CI green, STOP. The owner plays normally — the test is that nobody mysteriously dies at a wall again.

---

# TASK 1 — The path that walks around (mk1.10)

**What it does.** Squad marches get a real route. When an order's destination appears (or changes, or progress stalls), the game layer computes a path on the movement grid — the same grid the enemy already navigates by — around buildings, field walls, rocks, and open water, through the causeway. The leg machine in squads.js walks that route waypoint by waypoint instead of marching a straight line into whatever stands in the way. One order now crosses the stream: the squad detours through the causeway on its own, and the T3 bank-hold becomes a never-fired backstop. A destination tapped ON a building (or otherwise unreachable) is honestly clamped to the nearest reachable ground beside it. The mid-march stall near masonry dies with the same stroke — squads no longer wedge their men against lattices their anchor walked through, and a route that stops making progress is recomputed.

**Division of labor (module laws hold):** route computation and staleness live in the GAME layer (two new module-level functions in DepotGame.jsx — they need the grid); squads.js only CONSUMES `squad._route`, popping waypoints as the anchor reaches them — movement-pure, zero new rng. The enemy's march is untouched. The possessed stick is untouched.

**Draw-count note, stated:** the one-draw-per-leg contract is UNCHANGED — but a routed march can have more legs than the old straight march on the same order (the detour is longer), so total draws per march legally differ from mk1.05. The contract was always per-leg, never per-march; twin determinism holds (same code, same seed, same route).

**Feel changes that ship for the owner's eyes:** order a squad across the stream and they walk the crossing themselves; order them behind a building and they go around it, not into it; the patrol that loops through town flows around masonry; squads stop freezing mid-march near buildings.

**Suggested model:** Sonnet — all code specified below.

**Required reading (re-verify anchors at dispatch):**
- `src/depot/squads.js` — WHOLE FILE (726 lines; the leg machine at 500–632 is the edit site; the header laws and the one-draw contract at 13–15 bind every line).
- `src/depot/DepotGame.jsx` — 398–466 (makeGrid/computeFlowField/streamAt), 570–592 (checkConnectivity — the new functions land after it), 863–960 (stepDepot; the squad loop, `engageCheck(sq);` at 927 — one call lands beside it), the consumeOrderTap region (find `OPEN WATER — find the crossing`), read-only context.
- `src/depot/save.js` — 300–345 (the squad serializer/restorer — verify how `_route` rides or self-heals; no edits).
- `src/ui/Roadmap.jsx` — 14–28 (the flip + the new card).
- `scripts/depot-test.mjs` — 1–70 (harness), the FRONT T3 block (its (e)/(f) fixtures are the pattern), the tail (the new block lands before it).
- `src/version.js`.

**Trap notes:**
- ZERO new rng anywhere. Route computation, staleness, waypoint popping — all deterministic. The leg-arrival draw stays exactly where it is and fires exactly once per leg.
- The T3 bank-hold line in squads.js (`the anchor never fords`) STAYS — it is the backstop for a stale route crossing fresh water. The T3(f) test fixture has no route (nothing calls the routing there), so it must pass UNCHANGED — EXPECTED RE-PINS: none. Any old assert moving is a defect: STOP and report.
- `stepSquadRouting` runs in stepDepot BEFORE `stepSquad`, so a fresh order routes the same tick it first steps.
- Waypoint pop tolerance (1.2m) is deliberately larger than ARRIVE_TOL (1.0) and smaller than a grid cell (2.0) — a popped waypoint never re-triggers, and the final waypoint IS the (possibly clamped) destination so arrival stays squads.js's own dToDest branch, untouched.
- The destination CLAMP mutates `sq.dest` (and a patrol's matching endpoint) once, at route time, in the game layer — squads.js never mutates dest except its own arrival/patrol flips, as today.
- Save/resume: verify the squad serializer at dispatch — if `_route` rides the generic field copy it must round-trip as plain {x,z} objects (it does — it is plain data); if the serializer whitelists fields and drops it, the route self-heals on the first resumed tick (stepSquadRouting sees dest without route). Either way: NO save.js edits.
- A squad whose destination cell and anchor cell are the same routes to a single-waypoint route (the dest) — the machine degenerates to today's behavior on short orders.
- planRoute's BFS uses the SAME corner-cut rule as computeFlowField (no diagonal squeeze between two blocked cells) — copy the rule, don't invent one.
- `__DEPOTORDER__` and the build line need no edits: both set `sq.dest` and the routing reacts to the change next tick.

## Steps, in execution order

**Step 1 — failing asserts first.** Insert the P6-T1 block before the tail summary; `npm run test:depot` shows it red (planRoute/stepSquadRouting missing from the extraction; squads.js waypoint pins absent). Everything else stays green. Record the exact reds.

```js
// ==== P6 T1: the path that walks around =====================================
// mk1.10 (Troops & Physics, Task 1). Squad marches follow a computed route
// on the movement grid: around masonry, through the causeway. The leg
// machine consumes waypoints; routes are drawn/redrawn by the game layer.
// Zero new rng; the one-draw-per-leg contract is untouched.
{
  console.log("\n[p6 t1: the path that walks around]");
  const src = fs.readFileSync(new URL("../src/depot/DepotGame.jsx", import.meta.url), "utf8");
  let M1ok = true, mk1 = null;
  try {
    const sliceFnP = (name) => {
      const start = src.indexOf(`\nfunction ${name}(`);
      if (start < 0) throw new Error("P6T1 extract: missing function " + name);
      const rest = src.slice(start + 1);
      const m = rest.slice(9).search(/\n(?:function |export |const [A-Z])/);
      return rest.slice(0, m < 0 ? rest.length : m + 9);
    };
    const headerP = src.slice(src.indexOf("const GRID_CS"), src.indexOf("function genMap"));
    const mapSrcP = [
      headerP,
      sliceFnP("genMap"), sliceFnP("makeMap"), sliceFnP("streamAt"), sliceFnP("planTrees"),
      sliceFnP("pondAt"), sliceFnP("rockAt"),
      sliceFnP("makeGrid"), sliceFnP("checkConnectivity"), sliceFnP("planRoute"), sliceFnP("stepSquadRouting"),
      sliceFnP("townFootprint"), sliceFnP("buildTown"),
      `return { makeMap, makeGrid, planRoute, stepSquadRouting, streamAt, invW, fwdU,
        state: () => ({ ORIENT, TOWN, STREAM, MAP_SEED }) };`,
    ].join("\n");
    mk1 = () => new Function(
      "mulberry32", "MASON", "fwdUFor", "fwdDirFor", "invWFor", "addBody", "addWeld", mapSrcP,
    )(mulberry32, MASON, fwdUFor, fwdDirFor, invWFor, addBody, addWeld);
  } catch (e) { M1ok = false; }
  ok("P6T1: the map module extracts with planRoute and stepSquadRouting", M1ok);

  if (M1ok) {
    // (a) the causeway: on 10 seeds, a route across the stream passes within
    // the causeway's exemption (|u - bridgeU| < 3) as it crosses the water line.
    let crossed = 0;
    for (let s = 1; s <= 10; s++) {
      const Mi = mk1(); Mi.makeMap(s * 613);
      const st = Mi.state();
      const g = Mi.makeGrid(null);
      const a = Mi.fwdU(0, st.STREAM.v + 20), d = Mi.fwdU(0, st.STREAM.v - 20);
      const route = Mi.planRoute(g, a.x, a.z, d.x, d.z);
      if (!route) continue;
      let okX = false;
      for (const p of route.pts) {
        const c = Mi.invW(p.x, p.z);
        if (Math.abs(c.v - st.STREAM.v) < 5 && Math.abs(c.u - st.STREAM.bridgeU) < 3.5) okX = true;
      }
      if (okX) crossed++;
    }
    ok("P6T1(a): routes cross the stream at the causeway (10 seeds)", crossed === 10, `${crossed}/10`);

    // (b) around, not through: a route past the biggest building never enters
    // a blocked cell, and ends within a cell of its destination.
    {
      const Mi = mk1(); Mi.makeMap(4242);
      const st = Mi.state();
      const g = Mi.makeGrid(null);
      Mi.buildTown(makeWorld({ field: { heightAt: () => 0 }, seed: 5 }), g, { heightAt: () => 0 }); // claims footprints
      const big = st.TOWN.filter((t) => !t.depot).sort((x, y) => y.nx * y.nz - x.nx * x.nz)[0];
      const route = Mi.planRoute(g, big.x - 14, big.z, big.x + 14, big.z);
      ok("P6T1(b): a route exists past the biggest building", !!route && route.pts.length >= 2, route && `${route.pts.length} pts`);
      if (route) {
        const foul = route.pts.filter((p) => { const c = g.cellAt(p.x, p.z); return c && c.blocked; }).length;
        ok("P6T1(b): no route point stands on a blocked cell", foul === 0, `${foul} fouls`);
        const end = route.pts[route.pts.length - 1];
        ok("P6T1(b): the route ends beside the asked ground", Math.hypot(end.x - (big.x + 14), end.z - big.z) < 2.9, Math.hypot(end.x - (big.x + 14), end.z - big.z).toFixed(2));
      }
    }

    // (c) the honest clamp: a destination ON the building routes to the
    // nearest reachable ground beside it, and stepSquadRouting rewrites
    // sq.dest to that point.
    {
      const Mi = mk1(); Mi.makeMap(4242);
      const st = Mi.state();
      const g = Mi.makeGrid(null);
      Mi.buildTown(makeWorld({ field: { heightAt: () => 0 }, seed: 5 }), g, { heightAt: () => 0 });
      const big = st.TOWN.filter((t) => !t.depot).sort((x, y) => y.nx * y.nz - x.nx * x.nz)[0];
      const sq = { order: "move", dest: { x: big.x, z: big.z }, anchor: { x: big.x - 14, z: big.z }, _route: null };
      Mi.stepSquadRouting(g, sq);
      ok("P6T1(c): an unreachable destination is clamped to reachable ground",
        !!sq._route && Math.hypot(sq.dest.x - big.x, sq.dest.z - big.z) > 1.5 && Math.hypot(sq.dest.x - big.x, sq.dest.z - big.z) < 12,
        `moved ${Math.hypot(sq.dest.x - big.x, sq.dest.z - big.z).toFixed(2)}m`);
      const endC = sq._route && g.cellAt(sq.dest.x, sq.dest.z);
      ok("P6T1(c): the clamped ground is not blocked", !!endC && !endC.blocked);
    }

    // (d) determinism twin: identical routes from identical seeds.
    {
      const A = mk1(); A.makeMap(7717); const gA = A.makeGrid(null);
      const B = mk1(); B.makeMap(7717); const gB = B.makeGrid(null);
      const wa = A.fwdU(-30, -30), wd = A.fwdU(30, 30);
      ok("P6T1(d): twin determinism — identical routes",
        JSON.stringify(A.planRoute(gA, wa.x, wa.z, wd.x, wd.z)) === JSON.stringify(B.planRoute(gB, wa.x, wa.z, wd.x, wd.z)));
    }
  }

  // (e) the leg machine walks a route: stubbed water band with a gap at
  // x=20; a squad with a route through the gap crosses and digs in; the
  // T3(f) routeless squad still holds at the bank (that block re-proves it).
  {
    const flatFP = { heightAt: () => 0, dirty: false, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } };
    const world = makeWorld({ field: flatFP, seed: 5 });
    world.streamAt = (x, z) => z > 10 && z < 14 && !(x > 18 && x < 22);
    const sq = makeSquad(1, "rifles", 1, 0, 0);
    spawnSquadMembers(world, sq);
    sq.order = "move"; sq.dest = { x: 0, z: 30 };
    sq._route = [{ x: 20, z: 6 }, { x: 20, z: 18 }, { x: 0, z: 30 }];
    for (let i = 0; i < 4800; i++) { stepSquad(world, sq, 1 / 60); stepWorld(world); }
    ok("P6T1(e): the routed squad crosses at the gap and digs in", sq.order === "defend" && Math.hypot(sq.anchor.x - 0, sq.anchor.z - 30) < 1.5, `${sq.order} at (${sq.anchor.x.toFixed(1)}, ${sq.anchor.z.toFixed(1)})`);
    ok("P6T1(e): the route is consumed", !sq._route || sq._route.length === 0, sq._route && `${sq._route.length} left`);
  }

  // (f) source pins
  const sqsrcP = fs.readFileSync(new URL("../src/depot/squads.js", import.meta.url), "utf8");
  ok("P6T1(f): the leg machine pops waypoints", /squad\._route\.shift\(\);/.test(sqsrcP));
  ok("P6T1(f): legs aim at the waypoint, arrival still reads the true dest", /const wp = squad\._route && squad\._route\.length \? squad\._route\[0\] : squad\.dest;/.test(sqsrcP));
  ok("P6T1(f): stepDepot routes every ordered squad", /stepSquadRouting\(grid, sq\);/.test(src));
}
// ==== end P6 T1 ==============================================================
```

## AMENDMENT 1 (owner's ruling, 2026-08-13) — two test-side corrections

*Found in execution: (1) the Step 1 extraction pulls `buildTown`'s source but omits it from the return list — every other extraction block in the suite lists it; fixtures (b)/(c) crashed. (2) The causeway assert looked for a waypoint near the crossing, but routes keep only TURNING points — a straight run through the causeway leaves no waypoint there (measured 6/10; the routing itself cannot cross anywhere else, water is blocked ground). Both are defects in the plan's own test code; Steps 2–5 stand as landed.*

**Step A1-1.** The extraction's return line gains `buildTown`:
```js
      `return { makeMap, makeGrid, buildTown, planRoute, stepSquadRouting, streamAt, invW, fwdU,
        state: () => ({ ORIENT, TOWN, STREAM, MAP_SEED }) };`,
```

**Step A1-2.** The (a) fixture's per-route check is REPLACED — sample along the route's SEGMENTS (from the anchor through every waypoint) at half-meter steps; a sample inside the stream's v-band within the causeway's u-band is the crossing:
```js
      let okX = false;
      let px = a.x, pz = a.z;
      for (const p of route.pts) {
        const segL = Math.hypot(p.x - px, p.z - pz);
        for (let sd = 0; sd <= segL; sd += 0.5) {
          const c = Mi.invW(px + (p.x - px) * (sd / (segL || 1)), pz + (p.z - pz) * (sd / (segL || 1)));
          if (Math.abs(c.v - st.STREAM.v) < 3 && Math.abs(c.u - st.STREAM.bridgeU) < 3.5) { okX = true; break; }
        }
        if (okX) break;
        px = p.x; pz = p.z;
      }
```
(the surrounding loop and the `crossed === 10` assert stand unchanged).

**Step 2 — planRoute and stepSquadRouting.** `src/depot/DepotGame.jsx`, both module-level, inserted directly after `checkConnectivity` (after line 592):
```js
// P6 T1: THE ROUTE. Squads march the same grid the enemy trusts. planRoute
// is a breadth-first search from the anchor's cell (8-way, with
// computeFlowField's own corner rule) that reaches for the destination cell
// and settles for the CLOSEST reachable cell when the asked ground is
// blocked or walled off. The cell path is thinned to its turning points and
// returned as world waypoints, destination last. Deterministic, zero rng.
function planRoute(grid, ax, az, dx, dz) {
  const s = grid.worldToGrid(ax, az);
  if (!grid.inBounds(s.gx, s.gz)) return null;
  const t = { gx: Math.max(0, Math.min(grid.w - 1, grid.worldToGrid(dx, dz).gx)),
              gz: Math.max(0, Math.min(grid.h - 1, grid.worldToGrid(dx, dz).gz)) };
  const { cells } = grid;
  const prev = new Int32Array(grid.w * grid.h).fill(-2);
  const si = grid.idx(s.gx, s.gz);
  prev[si] = -1;
  const q = [si];
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
  let head = 0, best = si, bestD = Infinity;
  while (head < q.length) {
    const ci = q[head++];
    const cgx = ci % grid.w, cgz = (ci / grid.w) | 0;
    const dd = Math.hypot(cgx - t.gx, cgz - t.gz);
    if (dd < bestD) { bestD = dd; best = ci; if (dd === 0) break; }
    for (const d of dirs) {
      const nx = cgx + d[0], nz = cgz + d[1];
      if (!grid.inBounds(nx, nz)) continue;
      const ni = grid.idx(nx, nz);
      if (prev[ni] !== -2 || cells[ni].blocked) continue;
      if (d[0] !== 0 && d[1] !== 0) {
        if (cells[grid.idx(cgx + d[0], cgz)].blocked || cells[grid.idx(cgx, cgz + d[1])].blocked) continue;
      }
      prev[ni] = ci;
      q.push(ni);
    }
  }
  if (best === si) return null; // nowhere to go (or already there)
  const cellsPath = [];
  for (let ci = best; ci !== -1; ci = prev[ci]) cellsPath.push(ci);
  cellsPath.reverse();
  const pts = [];
  for (let i = 1; i < cellsPath.length; i++) {
    const p0 = cellsPath[i - 1], p1 = cellsPath[i], p2 = cellsPath[i + 1];
    const turn = p2 == null ||
      (p1 % grid.w) - (p0 % grid.w) !== (p2 % grid.w) - (p1 % grid.w) ||
      ((p1 / grid.w) | 0) - ((p0 / grid.w) | 0) !== ((p2 / grid.w) | 0) - ((p1 / grid.w) | 0);
    if (turn) pts.push(grid.gridToWorld(p1 % grid.w, (p1 / grid.w) | 0));
  }
  return { pts, reached: bestD === 0 };
}

// P6 T1: route bookkeeping, one squad, once per sim tick (stepDepot calls
// it before stepSquad). Draws a route when the destination is new, rewrites
// an unreachable destination to the route's honest end (and a patrol's
// matching endpoint with it), and redraws the route when progress stalls
// (under half a meter of approach in three seconds — the mid-march stall's
// tombstone). Deterministic, zero rng, no draws.
function stepSquadRouting(grid, sq) {
  if (!sq.dest || (sq.order !== "move" && sq.order !== "attack" && sq.order !== "build" && sq.order !== "patrol")) {
    sq._route = null; sq._routeDest = null; return;
  }
  const destChanged = !sq._routeDest || Math.hypot(sq._routeDest.x - sq.dest.x, sq._routeDest.z - sq.dest.z) > 0.5;
  const wp = sq._route && sq._route.length ? sq._route[0] : sq.dest;
  const dWp = Math.hypot(wp.x - sq.anchor.x, wp.z - sq.anchor.z);
  if (!destChanged) {
    // the stall watch: approach distance must shrink, or the route is stale
    if (sq._routeD == null || dWp < sq._routeD - 0.5) { sq._routeD = dWp; sq._routeT = 0; }
    else { sq._routeT = (sq._routeT || 0) + 1 / 120; }
    if (sq._routeT < 3) return;
  }
  sq._routeD = null; sq._routeT = 0;
  const route = planRoute(grid, sq.anchor.x, sq.anchor.z, sq.dest.x, sq.dest.z);
  if (!route || !route.pts.length) { sq._route = null; sq._routeDest = { x: sq.dest.x, z: sq.dest.z }; return; }
  if (!route.reached) {
    // the honest clamp: they go as close as ground allows, and the order
    // (and a patrol's turnaround point) now SAYS so.
    const end = route.pts[route.pts.length - 1];
    if (sq.order === "patrol") {
      if (sq._patA && Math.hypot(sq.dest.x - sq._patA.x, sq.dest.z - sq._patA.z) < 0.5) sq._patA = { x: end.x, z: end.z };
      else if (sq._patB && Math.hypot(sq.dest.x - sq._patB.x, sq.dest.z - sq._patB.z) < 0.5) sq._patB = { x: end.x, z: end.z };
    }
    sq.dest = { x: end.x, z: end.z };
  }
  sq._route = route.pts;
  sq._routeDest = { x: sq.dest.x, z: sq.dest.z };
}
```

**Step 3 — stepDepot routes every ordered squad.** In the squad loop (line 927's neighborhood), directly BEFORE `engageCheck(sq);`:
```js
      stepSquadRouting(grid, sq);
      engageCheck(sq);
```

**Step 4 — the leg machine walks the route.** `src/depot/squads.js`, inside the order branch (line 520's block). Directly after `const cx = squad.anchor.x, cz = squad.anchor.z;` (line 521):
```js
    // P6 T1: the route — waypoints drawn by the game layer, consumed here.
    // Reaching a waypoint pops it (no draw: a waypoint is not a leg arrival);
    // legs aim at the live waypoint; ARRIVAL stays the true-dest branch below.
    while (squad._route && squad._route.length && Math.hypot(squad._route[0].x - cx, squad._route[0].z - cz) < 1.2) squad._route.shift();
    const wp = squad._route && squad._route.length ? squad._route[0] : squad.dest;
```
Then the two leg-target sites aim at `wp` instead of `squad.dest` — the threatened line (570):
```js
          squad._legTarget = coverHop(world, { x: cx, z: cz }, wp, bearing);
```
and the double-time block (575–579):
```js
          const dToWp = Math.hypot(wp.x - cx, wp.z - cz) || 1e-6;
          const step = Math.min(HOP_R * 1.5, dToWp);
          squad._legTarget = {
            x: cx + ((wp.x - cx) / dToWp) * step,
            z: cz + ((wp.z - cz) / dToWp) * step,
          };
```
Everything else — the arrival branch (dToDest against the TRUE dest), the patrol turnaround, the sapper hold, the cohesion band, the bank-hold line, the one leg-arrival draw — stays byte-identical. The patrol turnaround and the arrival flip both null `_legTarget` already; add `squad._route = null;` beside `squad._legTarget = null;` in BOTH branches (turnaround re-routes next tick via the game layer; an arrived squad carries no stale route).

**Step 5 — the roadmap flip (fold-in convention).** `src/ui/Roadmap.jsx` lines 21–22:
```js
  { name: "The Front", status: "DONE", desc: "A square map twice the ground, wilder seeds, hills, forests, a stream to cross." },
  { name: "Troops & Physics", status: "IN PROGRESS", desc: "Squads that walk around things, an economy that breathes, a lighter engine." },
```
(the Engineers & Arms card and everything after it shift down one line, untouched).

**Step 6 — green, bump, build, smoke.** `npm run lint:depot` · `npm run test:depot` fully green (zero re-pins; the T3 bank-hold block must pass unchanged) · `src/version.js` → `"mk1.10"` · `npm run build` AFTER the bump · `SMOKE_ONLY=depot npm run smoke`.

**Gates (ONLY these):** parse changed files · `npm run lint:depot` · `npm run test:depot` (Step 1 red-first, then green; zero re-pins) · `npm run build` after the bump · `SMOKE_ONLY=depot` smoke. Allowed files: `src/depot/DepotGame.jsx`, `src/depot/squads.js`, `src/ui/Roadmap.jsx`, `scripts/depot-test.mjs`, `src/version.js`. Commit `"the path that walks around: squads route the grid (mk1.10)"`, push, CI green, STOP. The owner checks the deployed site: one order across the stream walks the causeway; an order behind a building goes around; patrols flow through town; no more mid-march freezes at masonry.
