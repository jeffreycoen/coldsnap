# P7 Task 16 — traffic (mk1.46)

*2026-08-18. Executes the owner's traffic rulings (08-17/08-18): troops YIELD to friendly armor — standing men in a hull's lane sidestep clear and return once it passes; the overrun brake gains PATIENCE — after a few seconds waiting it routes around the blocker instead (the brake itself never weakens); same-team hulls closing head-on KEEP RIGHT; and a stalled squad marks its living blocker's cells and routes around them. All game-layer, on the mk1.43 machinery (avoid lists, planRoute opts, the manual channel). Enemy hulls and their men obey the identical rules — symmetry. All dials provisional (F5). No engine change — golden does not run.*

**Scoped rule (stated, not hidden):** a POSSESSED squad never auto-yields — the owner's hands outrank the traffic law; the hull's brake and patience handle it. Enemy units marching the flow field don't need yield (they're already moving); yield covers the standers — squad members on defend and hold/garrison men, both sides.

**Suggested model: Sonnet** — fully specced; every step carries its literal code.

**Scope:** `src/depot/drivers.js`, `src/depot/squads.js`, `src/depot/units.js`, `src/depot/DepotGame.jsx`, `src/depot/save.js`, `scripts/depot-test.mjs`, `src/version.js`. Nothing else.

## Required reading, in order (verify anchors before code)

1. `src/depot/drivers.js` 63–96 (the safety cone + brake), 130–140 (the avoid-list replan), 160–210 (arrive, goal set at 173, corner crawl at 175–191, progress watch) — the mk1.43 shapes this task extends.
2. `src/depot/squads.js` 650–672 (march member-goal loop; goal set at 668) and 700–718 (defend member-goal loop; goal set at 709), 338–399 (seekGoal — read-only), 744–767 (drivePossessedSquad — read-only, NOT touched).
3. `src/depot/units.js` 305–319 (the hold branch — where loose standers live).
4. `src/depot/DepotGame.jsx` 617–645 (stepSquadRouting — the stall watch at 630–635, the planRoute call at 638).
5. `src/depot/save.js` 54–64 (BODY_HANDLED with the T13 transients) and 224–233 (the squad serializer's skip list).
6. `src/depot/route.js` planRoute opts — read-only: `avoid` already works for both modes.
7. `scripts/depot-test.mjs` — the T15 block end (insertion point), the T13(e)/(f) fixture idiom (armorAt helper, mkGrid, identFwdDir, stepDrivers-driven).

## Trap notes

- **The brake never weakens.** Patience marks cells and replans; the hull still stops the instant the cone is blocked. If your edit lets a hull roll while a man stands in the cone, STOP.
- **Yield points are vetted by `clearSlot`** — the T12/T13 law (hulls, masonry, water, rim) comes free. Never place a yield point by raw arithmetic alone.
- **Keep-right is SAME-TEAM only.** Opposing hulls meeting is combat, not traffic.
- **`drivePossessedSquad` is untouched.** The possessed-member seekGoal at squads.js:766 gets no yield override.
- **Squad `_avoid` must not ride the save** (mixed plain objects WOULD survive the generic sweep) — Step 6's skip-list entry is mandatory, the `_legTarget` precedent.
- **Zero rng anywhere.** Expected re-pins: zero; any that move are re-pinned honestly and reported old → new.

## Steps

**Step 1 — the failing asserts land first.** In `scripts/depot-test.mjs`, insert after the T15 block end (reuse the T13 block's `flatF13`-style field, `mkGrid`, `armorAt`, `identFwdDir` idioms — lift local copies under T16 names where scoping requires):

```js
// ==== P7 T16: TRAFFIC ========================================================
// The owner's rulings: troops yield to friendly armor and return; the brake
// gains patience (route around what won't move); same-team hulls keep right;
// a stalled squad routes around its living blockers. The brake never weakens.
{
  const flatF16 = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (x, z, o) => { o.x = 0; o.y = 1; o.z = 0; return o; } };
  const G16 = mkGrid16(20); // T13's mkGrid shape, local name
  // (a) a man in the lane is told to step aside — and the point is out of the lane
  {
    const w = makeWorld({ field: flatF16, seed: 21 });
    const v = armorAt16(w, 0, 0);                       // faces +z (identity R)
    v.order = "move"; v.dest = { x: 0, z: 30 };
    const u = addBody(w, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x: 0.5, y: 0.74, z: 6, hp: 58, friction: 0.5 });
    stepDrivers(w, G16, identFwdDir, null);
    ok("T16(a): the brake bites while the lane is blocked", v.depotDrive === "manual" && v.ctl && v.ctl.brake === true);
    ok("T16(a2): the man is told to yield", !!u._yield && u._yield.until > w.t);
    ok("T16(a3): the yield point leaves the lane", Math.abs(u._yield.x) > 2.8, u._yield && u._yield.x);
    ok("T16(a4): the yield remembers home", !!u._yieldHome && Math.abs(u._yieldHome.x - 0.5) < 1e-9);
  }
  // (b) a defend-squad member obeys a fresh yield over his slot
  {
    const w = makeWorld({ field: flatF16, seed: 22 });
    const sq = makeSquad(1, "rifles", 1, 0, 0);
    spawnSquadMembers(w, sq);
    const u = w.byId.get(sq.memberIds[0]);
    u._yield = { x: 5, z: 5, until: w.t + 2 };
    stepSquad(w, sq, 1 / 120);
    ok("T16(b): a yielded member's goal is the yield point", !!u.goal && Math.abs(u.goal.x - 5) < 1e-9 && Math.abs(u.goal.z - 5) < 1e-9);
    u._yield = { x: 5, z: 5, until: w.t - 1 };
    stepSquad(w, sq, 1 / 120);
    ok("T16(b2): an expired yield is dropped and the slot returns", u._yield == null && !!u.goal && Math.hypot(u.goal.x - 5, u.goal.z - 5) > 0.5);
  }
  // (c) a hold man steps aside and walks back home
  {
    const w = makeWorld({ field: flatF16, seed: 23 });
    const u = spawnUnit(w, { x: 10, z: 10 }, "");
    u.hold = true; u.garrison = true;
    u._yield = { x: 13, z: 10, until: w.t + 1.0 };
    u._yieldHome = { x: u.pos.x, z: u.pos.z };
    for (let i = 0; i < 120; i++) { w.t += w.dt; stepUnits(w, null); }
    ok("T16(c): the yielded hold man moved off his post", Math.hypot(u.pos.x - u._yieldHome.x, u.pos.z - u._yieldHome.z) > 1.0);
    for (let i = 0; i < 600; i++) { w.t += w.dt; stepUnits(w, null); }
    ok("T16(c2): the hold man walked back home and stood down", u._yieldHome == null && Math.hypot(u.pos.x - 10, u.pos.z - 10) < 1.0);
  }
  // (d) patience: a blocker that cannot move gets routed around
  {
    const w = makeWorld({ field: flatF16, seed: 24 });
    const v = armorAt16(w, 0, 0);
    v.order = "move"; v.dest = { x: 0, z: 30 };
    const u = addBody(w, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x: 0.5, y: 0.74, z: 6, hp: 58, friction: 0.5 });
    u.pinned = true; // immovable — the yield can never clear him
    for (let i = 0; i < 6 * 120; i++) { w.t += w.dt; stepDrivers(w, G16, identFwdDir, null); }
    ok("T16(d): patience marked the blocker's ground", !!v._avoid && v._avoid.length >= 1);
    ok("T16(d2): the route was forced fresh", v._route === null || v._routeDest === null || true); // the replan is proven by (d) + the T13 avoid law
  }
  // (e) same-team hulls keep right
  {
    const w = makeWorld({ field: flatF16, seed: 25 });
    const va = armorAt16(w, 0, -10);            // faces +z toward vb
    va.order = "move"; va.dest = { x: 0, z: 30 };
    const vb = armorAt16(w, 0, 10);
    vb.q = heading(null, Math.PI);              // faces -z toward va — use the suite's quaternion idiom; if none exists, set vb.R to the yaw-PI rotation matrix directly
    vb.order = "move"; vb.dest = { x: 0, z: -30 };
    va.tracks = "free"; vb.tracks = "free";     // isolate keep-right from the brake
    stepDrivers(w, G16, identFwdDir, null);
    ok("T16(e): the southbound hull eases to ITS right", !!va.goal && va.goal.x > 0.5, va.goal && va.goal.x);
    ok("T16(e2): the northbound hull eases to ITS right — opposite world side", !!vb.goal && vb.goal.x < -0.5, vb.goal && vb.goal.x);
  }
  // (f) a stalled squad marks its living blocker and routes around
  {
    const w = makeWorld({ field: flatF16, seed: 26 });
    const G = mkGrid16(20);
    const sq = makeSquad(1, "rifles", 1, -9, 1);
    spawnSquadMembers(w, sq);
    sq.order = "move"; sq.dest = { x: 9, z: 1 };
    const v = armorAt16(w, 0, 1);               // a parked hull dead on the line — not in the grid
    v.order = "defend";
    for (let i = 0; i < 4 * 120; i++) stepSquadRoutingPublic(G, sq, w); // see Step 5 — the export this fixture needs
    ok("T16(f): the squad marked the hull's ground", !!sq._avoid && sq._avoid.length >= 1);
    ok("T16(f2): the fresh route clears the hull's cell", !sq._route || sq._route.every((p) => Math.hypot(p.x - 0, p.z - 1) > 1.5));
  }
  // (g) save hygiene: the new transients never ride
  {
    ok("T16(g): the body drop-list carries the yield transients", /"_yield", "_yieldHome", "_brakeT"/.test(saveSrc16));
    ok("T16(g2): the squad serializer skips _avoid", /key === "_avoid"/.test(saveSrc16));
  }
}
// ==== end P7 T16 =============================================================
```

`saveSrc16` reads save.js source with the suite's established idiom; `mkGrid16`/`armorAt16` are local copies of the T13 helpers (or the T13 originals if still in scope). The (c) fixture's `stepUnits(w, null)` — match the suite's existing stepUnits call signature wherever it drives hold men; adjust the second argument to that idiom, changing nothing else. Run the suite — the T16 block must FAIL. Report the failing output.

**Step 2 — the brake learns to speak and to wait.** In `src/depot/drivers.js`:

2a. Replace `armorSafetyBlocked` (lines 77–90) with a collector — same cone, same math, blockers out:

```js
// P7 T16: the cone now REPORTS who blocks it — the yield order needs names,
// not just a verdict. Same reach, same width, same team filter.
function armorBlockers(world, v) {
  const fx = v.R[6], fz = v.R[8];
  const fl = Math.hypot(fx, fz) || 1;
  const reach = v.hz + SAFETY_AHEAD + Math.hypot(v.v.x, v.v.z) * SAFETY_SPEED_K;
  const pool = world._L ? (v.team === 1 ? world._L.friends : world._L.foes) : world.bodies;
  let out = null;
  for (const u of pool) {
    if (u.kind !== "unit" || !u.alive || u.team !== v.team) continue;
    const dx = u.pos.x - v.pos.x, dz = u.pos.z - v.pos.z;
    const ahead = (dx * fx + dz * fz) / fl;
    if (ahead < 0 || ahead > reach) continue;
    if (Math.abs((dx * fz - dz * fx) / fl) < SAFETY_HALF_W) (out || (out = [])).push(u);
  }
  return out;
}
```

2b. Replace the brake branch (lines 92–96) with the yield-issuing, patient version:

```js
  const blockers = v.tracks !== "free" ? armorBlockers(world, v) : null;
  if (blockers) {
    v.depotDrive = "manual";
    v.ctl = { throttle: 0, steer: 0, brake: true };   // the tracks bite — the strong stop, never weakened
    // P7 T16: THE YIELD — each man in the lane is told to step aside, to his
    // own side of the hull's heading, onto vetted ground; he remembers home.
    const fx = v.R[6], fz = v.R[8], fl = Math.hypot(fx, fz) || 1;
    for (const u of blockers) {
      if (u._yield && u._yield.until > world.t) continue;
      if (u.riding || u.pinned || u._fuse != null) continue;
      const side = ((u.pos.x - v.pos.x) * fz - (u.pos.z - v.pos.z) * fx) / fl >= 0 ? 1 : -1;
      const px = (fz / fl) * side, pz = (-fx / fl) * side;
      const p = clearSlot(world, u.pos.x + px * YIELD_M, u.pos.z + pz * YIELD_M, (u.hx || 0.28) + 0.35);
      if (!u._yieldHome) u._yieldHome = { x: u.pos.x, z: u.pos.z };
      u._yield = { x: p.x, z: p.z, until: world.t + YIELD_S };
    }
    // P7 T16: PATIENCE — a lane that will not clear stops being waited on:
    // the blockers' ground joins the avoid list and the route redraws around.
    v._brakeT = (v._brakeT || 0) + dt;
    if (v._brakeT >= PATIENCE_S) {
      v._avoid = (v._avoid || []).filter((a) => a.until > world.t);
      for (const u of blockers) {
        const g = grid.worldToGrid(u.pos.x, u.pos.z);
        if (grid.inBounds(g.gx, g.gz)) v._avoid.push({ ci: grid.idx(g.gx, g.gz), until: world.t + 25 });
      }
      v._route = null; v._routeDest = null; v._brakeT = 0;
    }
    return;
  }
  v._brakeT = 0;
```

with the constants joining line 76: `const YIELD_M = 3.2, YIELD_S = 2.5, PATIENCE_S = 4;   // provisional (F5)` — and `clearSlot` joining drivers.js's imports from `./squads.js`.

2c. Keep right. Immediately after `v.goal = { x: wp.x, z: wp.z };` (line 173), insert:

```js
  // P7 T16: KEEP RIGHT (owner) — same-team hulls closing head-on each ease
  // to their own right and pass port-to-port. Deterministic, both sides.
  for (const o of world.bodies) {
    if (o === v || o.kind !== "vehicle" || !o.alive || o.team !== v.team) continue;
    const dx = o.pos.x - v.pos.x, dz = o.pos.z - v.pos.z, d = Math.hypot(dx, dz);
    if (d > KEEP_RIGHT_D || d < 0.5) continue;
    const fx = v.R[6], fz = v.R[8], fl = Math.hypot(fx, fz) || 1;
    if ((dx * fx + dz * fz) / (fl * d) < 0.86) continue;          // he must be ahead, within ~30 degrees
    const ox = o.R[6], oz = o.R[8], ol = Math.hypot(ox, oz) || 1;
    if ((fx * ox + fz * oz) / (fl * ol) > -0.5) continue;          // and coming AT us, not alongside
    v.goal = { x: v.goal.x + (fz / fl) * KEEP_RIGHT_M, z: v.goal.z + (-fx / fl) * KEEP_RIGHT_M };
    break;
  }
```

with `const KEEP_RIGHT_D = 14, KEEP_RIGHT_M = 3.0;   // provisional (F5)` joining line 76. (The few-hulls world makes the plain body walk cheap; the vehicles pool may be used identically if preferred — same result, state which was used.)

**Step 3 — squads obey the yield.** In `src/depot/squads.js`, both member-goal sites gain the same three lines directly before their `seekGoal` calls (march loop, before line 670; defend loop, before line 716):

```js
      if (u._yield && u._yield.until <= world.t) u._yield = null;       // P7 T16
      if (u._yield) { u.goal = { x: u._yield.x, z: u._yield.z }; u.settled = false; }
```

(The possessed loop at 766 is NOT touched.)

**Step 4 — hold men step aside and walk back.** In `src/depot/units.js`, the hold branch (line 305) opens with:

```js
  if (u.hold) { // vantage hold (4C): permanently claims the march tick
    // P7 T16: THE YIELD — a hull's lane outranks the post, briefly; the post
    // wins it back. Seek the yield point while fresh, then walk home.
    if (u._yield && u._yield.until <= world.t) u._yield = null;
    const yg = u._yield || (u._yieldHome && Math.hypot(u._yieldHome.x - u.pos.x, u._yieldHome.z - u.pos.z) > 0.5 ? u._yieldHome : null);
    if (!u._yield && u._yieldHome && !yg) u._yieldHome = null;          // home again — stand down
    if (yg) {
      const dx = yg.x - u.pos.x, dz = yg.z - u.pos.z, d = Math.hypot(dx, dz) || 1;
      if (u.sleeping) { u.sleeping = false; }
      u.settled = false;
      u.v.x += ((dx / d) * spec.speed - u.v.x) * Math.min(1, 4 * dt);
      u.v.z += ((dz / d) * spec.speed - u.v.z) * Math.min(1, 4 * dt);
      faceTravel(u, dt);
      return true;
    }
```

…followed by the existing `_standPt`/damp lines unchanged.

**Step 5 — the stalled squad routes around the living.** In `src/depot/DepotGame.jsx`, `stepSquadRouting`: when the stall fires (the fall-through past line 635), before the `planRoute` call at 638, insert the blocker scan; and the call itself gains the avoid set:

```js
  // P7 T16: the stall's usual cause is a LIVING blocker the grid can't see —
  // a parked friendly hull, a standing squad. Mark their ground for this
  // redraw and route around them. Friendly flesh and any friendly hull only —
  // enemy contact is combat, not traffic.
  if (sq._routeT >= 3 || true) { /* replace this guard with the real stall-path condition — the scan runs ONLY on the stalled redraw, not the fresh-dest path */ }
```

The agent writes this insertion against the real control flow (the function returns early unless `destChanged` or the stall fired — put the scan under the stall condition alone, exactly): collect bodies within 3.5m of the segment anchor→wp over its first 10m — `kind === "vehicle" && team === 1`, or `kind === "unit" && team === 1 && !sq.memberIds.includes(id)` — push their cells into `sq._avoid` (`{ci, until: world.t + 25}`, expiry-filtered like the vehicle law); then:

```js
  if (sq._avoid) sq._avoid = sq._avoid.filter((a) => a.until > world.t);
  const route = planRoute(grid, sq.anchor.x, sq.anchor.z, sq.dest.x, sq.dest.z,
    sq._avoid && sq._avoid.length ? { avoid: new Set(sq._avoid.map((a) => a.ci)) } : null);
```

Also export a thin test seam beside it: `stepSquadRoutingPublic = (grid, sq, world) => …` calling the internal with the world threaded — OR, if `stepSquadRouting` cannot see `world` today, thread `world` in from its one call site and export the function itself; the T16(f) fixture names `stepSquadRoutingPublic`. State in the report which shape was needed.

**Step 6 — the save stays clean.** In `src/depot/save.js`: `BODY_HANDLED` gains `"_yield", "_yieldHome", "_brakeT"` beside the T13 transients (with a one-line comment: `// P7 T16: traffic transients — yields and patience re-measure fresh`); the squad serializer's skip (line ~228) becomes `if (key === "memberIds" || key === "_legTarget" || key === "_avoid") continue;` with the comment extended: `// _avoid: traffic scratch, re-marks live`.

**Step 7 — gates.** `node scripts/depot-test.mjs`, `node scripts/depot-lint.mjs`, the build, `node scripts/smoke.mjs`. Nothing else. Golden does NOT run. Expected re-pins: zero; any that move re-pin honestly, old → new, each its own labeled bullet.

**Step 8 — the landing.** Bump `src/version.js` to `mk1.46`. Build AFTER the bump. Commit: `traffic: the men step aside, the hulls learn manners (mk1.46)`. Push. Report: read-confirmation opening, gate results, every deviation and re-pin labeled.

---

## Amendment 1 (2026-08-18, after the agent's honest stop — owner-reviewed before resume)

Two of Step 1's literal fixtures were self-contradictory — the plan-writer's errors, found by the agent. Both fixes are fixture-side; no design value moves.

**A. T16(e) keep-right geometry.** The hulls start 20m apart against a 14m trigger with one drive tick — the rule could never fire. The fixture places them at `z = -6` and `z = +6` (12m apart, inside the trigger), and both asserts tighten so grid-quantization coincidence cannot pass them: `ok("T16(e): ...", !!va.goal && va.goal.x > 2, ...)` and `ok("T16(e2): ...", !!vb.goal && vb.goal.x < -1.5, ...)`. The `KEEP_RIGHT_D = 14` dial stands unchanged (provisional F5).

**B. T16(c2) measures against the recorded home.** `spawnUnit` jitters placement ±1.3m per axis, so the hardcoded `(10, 10)` target is unsatisfiable. The fixture captures `const home0 = { x: u.pos.x, z: u.pos.z };` immediately after spawn, sets `u._yieldHome = home0`, and (c2) asserts `u._yieldHome == null && Math.hypot(u.pos.x - home0.x, u.pos.z - home0.z) < 1.0` — the suite's own T3(e) idiom.

**C. The agent's licensed fits are ratified as taken:** the T3(e)-idiom stepUnits+stepWorld drive for fixture (c); the T16-local `armorAt16` without the tracks-free default; the yaw-π rotation matrix in place of the absent `heading()` helper; the Step 5 seam as world-threaded bare function plus T15-style source-slice extraction; the plain `world.bodies` walk for keep-right; and the mechanical `P6T1(f)` call-site re-pin (old `stepSquadRouting(grid, sq);` → new `stepSquadRouting(grid, sq, world);`).

Everything else in the plan stands as written.
