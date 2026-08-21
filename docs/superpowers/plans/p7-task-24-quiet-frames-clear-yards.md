# P7 Task 24 — quiet frames, clear yards (mk1.55)

*HISTORY (stamped 2026-08-20, owner's order): this document is a record of shipped work, not authority. Design truth lives in CLAUDE.md and the ACTIVE phase's plan documents; where this file disagrees with them, it is wrong.*

*2026-08-19. The diagnosed close-out defects, one task (owner's packaging, re-ruled after the full tick trace): (1) THE STUTTER — the mk1.44 green-threads overlay disposes and rebuilds every path's geometry four times a second; the churn drives 1.8–2s collector pauses on the Pi and the rebuild costs 20–29 ms per 4Hz frame (measured; the plan-writer's error, on record). Fix: ONE persistent pool, zero per-tick allocation. (2) THE ROLL — the trace exonerated bags for the owner's APC death: the parking law's flatness test is coarser than the routing law's steepness mask (4/300 spawns get NO route), a null route falls back to BLIND full-speed driving at the destination, and the hard steer when a route appears mid-drive ROLLS the hull (both measured deaths, cause FLIP). Three fixes: the parking law adopts the router's own mask plus a route-out probe; a null route means STAND and re-ask, never blind-drive; a hard turn demanded at speed brakes first. (3) THE YARD, prevention (owner's rulings, re-affirmed with clean evidence): hulls PARK WIDER of depot and bags, and BAG CELLS INFLATE one ring for hull lanes (kept on re-rule — unproven for the death, cheap, and honest to the turning arc). All dials provisional (F5). No engine change — golden does not run.*

**Suggested model: Sonnet** — fully specced; every step carries its literal code.

**Scope:** `src/render/renderer.js` (setOrderPaths only), `src/depot/muster.js` (parkArmor's vetting), `src/depot/route.js` (tight()), `scripts/tests/09-reorg.mjs`, `src/version.js`. Nothing else.

## Required reading, in order (verify anchors before code)

1. `src/render/renderer.js` — `setOrderPaths` (~1454–1483, the mk1.44/mk1.44-amended block: the dispose+rebuild loop this task replaces), `pathGroup`'s declaration beside `lineGroup` (~1282), and one existing preallocated-pool example (`pool()` at ~739 or the reticle) for the buffer idiom the file already uses.
2. `src/depot/muster.js` — `parkArmor` whole (37–97): the ring loop, `clearAt`, the brute-sweep fallback bounds.
3. `src/depot/route.js` — `shut()` and `tight()` inside planRoute (~61–75).
4. `src/depot/drivers.js` — the ram sampler line (READ-ONLY: confirm it stays untouched; enemy bags remain rammable when they alone close a path).
5. `scripts/tests/09-reorg.mjs` — the T23 block end (insertion point); AND the T17(d) fixture (it lives in `scripts/tests/08-debug-pass.mjs` — grep for "one-cell doorway"/bag-line asserts): T17(d)'s one-cell bag gap becomes ILLEGAL for hulls under the inflation ruling — its re-teach is this task's ONE expected re-pin, named below.
6. `.superpowers/diag-audio-hitch.mjs` — the measurement instrument Step 6 reruns (read its ON/OFF protocol; do not edit it).

## Trap notes

- **Zero allocation in the hot path is the whole point of Step 2** — no `new` of geometry, attributes, arrays, vectors, or materials inside `setOrderPaths` after init. If the implementation needs a temporary, preallocate it beside the pool.
- **The dash look must survive** — the owner accepted the mk1.44 look (dark underlay, bright dash). The pool computes cumulative line distances into the preallocated attribute per path so dashes render identically; segment breaks between paths must not bleed dashes across paths (reset the running distance per path).
- **KNOWN RE-PIN (behavioral, this task's own design change, named in advance):** T17(d) asserted a hull route threads a ONE-cell gap in a bag line; under the inflation ruling that gap is no lane — the fixture re-teaches to a THREE-cell gap (hull threads it) plus a one-cell-gap refusal assert. Old → new in the report. Anything else failing is a STOP.
- **The ram sampler and foot routing are untouched** — inflation lives in `tight()` (hull lane preference) only.
- **Dials all provisional (F5):** the park ring start, the bag standoff, the pool capacity.
- **Step 6 is a MEASURED gate:** the stutter fix is accepted by numbers (the same instrument, same protocol), not by claim.

## Steps

**Step 1 — the failing asserts land first.** In `scripts/tests/09-reorg.mjs`, after the T23 block:

```js
// ==== P7 T24: QUIET FRAMES, CLEAR YARDS ======================================
// The stutter's churn dies (one persistent pool, zero per-tick allocation);
// the yards open (wider parking, bag clearance for hull lanes).
{
  const rSrc24 = /* source-read: ../../src/render/renderer.js */;
  const muSrc24 = /* ../../src/depot/muster.js */;
  ok("T24(a): setOrderPaths allocates nothing per call",
    /setOrderPaths\(paths\)/.test(rSrc24) &&
    !/setOrderPaths\(paths\) \{[\s\S]{0,2400}?new THREE\.(BufferGeometry|Line|Group)/.test(rSrc24) &&
    /setDrawRange\(/.test(rSrc24));
  ok("T24(a2): the pool is born once, beside the overlay's other lazies",
    /PATH_VERT_CAP/.test(rSrc24) && /lineDistance/.test(rSrc24));
  // (b) the inflation: a one-cell bag gap is no lane; a three-cell gap drives
  {
    const G1 = mkGrid17(20);
    for (let gz = 0; gz < 20; gz++) if (gz !== 10) { const c = G1.cells[G1.idx(10, gz)]; c.bag = 1; c.bagId = 900 + gz; }
    const r1 = planRoute(G1, -9, 1, 9, 1, { hull: true, team: 1 });
    ok("T24(b): a one-cell bag doorway is no lane for a hull", !r1 || !r1.reached);
    const G3 = mkGrid17(20);
    for (let gz = 0; gz < 20; gz++) if (gz < 9 || gz > 11) { const c = G3.cells[G3.idx(10, gz)]; c.bag = 1; c.bagId = 900 + gz; }
    const r3 = planRoute(G3, -9, 1, 9, 1, { hull: true, team: 1 });
    ok("T24(b2): a three-cell gap drives", !!r3 && r3.reached === true);
    const rF = planRoute(G1, -9, 1, 9, 1);
    ok("T24(b3): men still walk the one-cell gap", !!rF && rF.reached === true);
  }
  // (c) the parking: wider ring, bag standoff in the vetting
  ok("T24(c): the ring starts wider", /for \(let rr = 15; rr <= 30; rr \+= 1\.5\)/.test(muSrc24));
  ok("T24(c2): the vetting stands off further", /slotBlockedPublic\(bx, bz, Math\.hypot\(spec\.hx, spec\.hz\) \+ 2\.5\)/.test(muSrc24));
  // (d) the yard, proven: across 40 real maps, every parked hull's nearest
  // bag gap clears 1.5m and a MOVE order's first route is never null
  {
    let worstGap = 1e9, nullRoutes = 0;
    for (let s = 0; s < 40; s++) {
      /* the diag-park-death.mjs harness idiom, compressed: makeMap(7000 + s),
         build the world + terrain + grid + bags + parkArmor for team 1 (the
         real mount order — reuse the fixture shape the diagnosis script
         proved), then: for each team-1 hull, measure the nearest live bag's
         box-to-box gap (track the minimum into worstGap) and call
         planRoute(grid, hull.x, hull.z, OBJ_POS.x, OBJ_POS.z, { hull: true,
         team: 1 }), counting null returns. Follow the diagnosis script's real
         staging code — it is the proven reference for this boot. */
    }
    ok("T24(d): no parked hull touches the bag ring (worst gap >= 1.5m)", worstGap >= 1.5, worstGap.toFixed(2));
    ok("T24(d2): every yard has a first route out", nullRoutes === 0, nullRoutes);
  }
}
// ==== end P7 T24 =============================================================
```

Two more assert families join the block (same idioms):

```js
  // (e) no route means STAND: a hull whose plan comes back null holds its
  // ground alive — the blind fallback is dead
  {
    const w = makeWorld({ field: flatF17, seed: 61 });
    const G = mkGrid17(20);
    for (let gz = 0; gz < 20; gz++) for (let gx = 0; gx < 20; gx++)
      if (Math.abs(gx - 10) > 1 || Math.abs(gz - 10) > 1) G.cells[G.idx(gx, gz)].steep = true; // an island
    const v = armorAt17(w, 1, 1);
    v.order = "move"; v.dest = { x: -15, z: -15 };
    const x0 = v.pos.x, z0 = v.pos.z;
    for (let i = 0; i < 10 * 120; i++) { w.t += w.dt; stepDrivers(w, G, identFwdDir, null); stepWorld(w); }
    ok("T24(e): the road-less hull stands, alive", v.alive === true && Math.hypot(v.pos.x - x0, v.pos.z - z0) < 2, `${v.pos.x},${v.pos.z}`);
    ok("T24(e2): it never took the blind goal", v.goal == null || Math.hypot(v.goal.x - -15, v.goal.z - -15) > 1);
  }
  // (f) the turn-around brakes: full speed with the goal behind — the hull
  // slows before it steers, and never rolls
  {
    const w = makeWorld({ field: flatF17, seed: 62 });
    const G = mkGrid17(20);
    const v = armorAt17(w, 0, -10);
    v.order = "move"; v.dest = { x: 0, z: 30 };
    for (let i = 0; i < 3 * 120; i++) { w.t += w.dt; stepDrivers(w, G, identFwdDir, null); stepWorld(w); } // build speed north
    v.dest = { x: 0, z: -30 }; v._route = null; v._routeDest = null;  // the U-turn order
    let minUp = 1;
    for (let i = 0; i < 6 * 120; i++) { w.t += w.dt; stepDrivers(w, G, identFwdDir, null); stepWorld(w); if (v.R[4] < minUp) minUp = v.R[4]; }
    ok("T24(f): the U-turn never rolls the hull", v.alive === true && minUp > 0.7, minUp.toFixed(2));
  }
```

The (d) staging follows `.superpowers/diag-park-death.mjs`'s proven harness — the agent lifts its boot sequence, not reinvents it; any adaptation is a named deviation. Run — T24 fails. Report the failing output.

**Step 2 — the pool.** In `src/render/renderer.js`, replace `setOrderPaths` whole (and extend `pathGroup`'s declaration site) with:

```js
    // P7 T24: THE GREEN THREADS, POOLED — the mk1.44 dispose-and-rebuild
    // churned enough garbage to stall the Pi's collector for whole seconds
    // (measured; the stutter's root). ONE geometry, born once, written in
    // place: segment pairs with per-path dash distances, drawRange sized to
    // the tick's real content. Zero allocation after birth.
    setOrderPaths(paths) {
      if (!pathPool) {
        const pos = new Float32Array(PATH_VERT_CAP * 3);
        const dist = new Float32Array(PATH_VERT_CAP);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
        geo.setAttribute("lineDistance", new THREE.BufferAttribute(dist, 1).setUsage(THREE.DynamicDrawUsage));
        const under = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x0c2416, transparent: true, opacity: 0.85, depthWrite: false }));
        const over = new THREE.LineSegments(geo, new THREE.LineDashedMaterial({ color: 0x4aff8c, dashSize: 1.4, gapSize: 0.6, transparent: true, opacity: 0.95, depthWrite: false }));
        under.frustumCulled = false; over.frustumCulled = false;
        under.layers.set(1); over.layers.set(1);
        scene.add(under); scene.add(over);
        pathPool = { geo, pos, dist, under, over };
      }
      const P = pathPool;
      let v = 0; // vertex cursor (segment pairs)
      for (const p of paths || []) {
        let run = 0, px = 0, py = 0, pz = 0, has = false;
        for (let i = 0; i + 1 < p.pts.length; i++) {
          const a = p.pts[i], b = p.pts[i + 1];
          const d = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(d / 2));
          for (let k = 0; k <= n; k++) {
            const x = a.x + ((b.x - a.x) * k) / n, z = a.z + ((b.z - a.z) * k) / n;
            const y = F.heightAt(x, z) + 0.34;
            if (has) {
              if (v + 2 > PATH_VERT_CAP) break;
              P.pos[v * 3] = px; P.pos[v * 3 + 1] = py; P.pos[v * 3 + 2] = pz; P.dist[v] = run;
              run += Math.hypot(x - px, z - pz);
              P.pos[v * 3 + 3] = x; P.pos[v * 3 + 4] = y; P.pos[v * 3 + 5] = z; P.dist[v + 1] = run;
              v += 2;
            }
            px = x; py = y; pz = z; has = true;
          }
          if (v + 2 > PATH_VERT_CAP) break;
        }
      }
      P.geo.setDrawRange(0, v);
      P.geo.attributes.position.needsUpdate = true;
      P.geo.attributes.lineDistance.needsUpdate = true;
      P.under.visible = v > 0; P.over.visible = v > 0;
    },
```

with, at the declaration site (beside `lineGroup`): `let pathPool = null;` replacing `let pathGroup = null;`, and `const PATH_VERT_CAP = 4096;   // segment vertices — ~30 ordered units at full route length // provisional (F5)` beside it. Delete the old dispose+rebuild body entirely (the old `pathGroup` disposal logic goes with it). LineSegments + per-vertex `lineDistance` reproduce the dash exactly; the per-path `run` reset keeps dashes from bleeding across paths.

**Step 3 — the yard opens and the two laws agree.** In `src/depot/muster.js`, `parkArmor`:
- The ring loop `for (let rr = 10; rr <= 26; rr += 1.5)` → `for (let rr = 15; rr <= 30; rr += 1.5)`   // provisional (F5)
- `clearAt`'s slot test `slotBlockedPublic(bx, bz, Math.hypot(spec.hx, spec.hz) + 0.5)` → `slotBlockedPublic(bx, bz, Math.hypot(spec.hx, spec.hz) + 2.5)`   // provisional (F5) — the bag ring (chunk-kind) now stands off the whole hull
- `clearAt` gains the ROUTER'S OWN steepness read, directly after the existing cell test:

```js
        // P7 T24: the parking law adopts the routing law — a spot the router
        // calls too steep to drive is no spot to park (the trace: a hull
        // parked past the depot's flattening on a hillside got NO route out
        // and the blind fallback rolled it). Candidate cell + all 8 neighbors
        // must be hull-passable grade.
        const cg = grid.worldToGrid(bx, bz);
        for (let oz = -1; oz <= 1; oz++) for (let ox = -1; ox <= 1; ox++) {
          if (!grid.inBounds(cg.gx + ox, cg.gz + oz)) return false;
          if (grid.cells[grid.idx(cg.gx + ox, cg.gz + oz)].steep) return false;
        }
```

- The `place(...)` acceptance (both the ring hit and the brute-sweep winners) gains the ultimate vet — ONE route-out probe on the accepted spot, before parking:

```js
        // P7 T24: park only where a way out exists — one probe, boot-time only.
        if (!planRoute(grid, bx, bz, 0, 0, { hull: true, team })) return false /* keep scanning */;
```

(`planRoute` joins muster.js's imports from `./route.js`; the probe targets the map's center — any non-null answer proves the yard connects. The agent wires the "keep scanning" shape to the real control flow: the ring loop `continue`s, the brute sweep skips the candidate; a named fit if the literal form differs.)
- The brute-sweep fallback's distance window `d > 30 || d < 8` → `d > 34 || d < 12` (the fail-proof net widens with the ring; the flattest-clear last resort keeps parking a hull even if every probe fails — a parked hull beats no hull, and the null-route STAND below now protects it).

**Step 4 — the lanes honor the arc.** In `src/depot/route.js`, `tight()`'s test gains the bag term:

```js
      if (n.building != null || n.wallId != null || n.terrain || n.bag != null) return true;
```

(One token added. `shut()`'s own `c.bag != null` stays; the ram sampler in drivers.js is untouched — verified at reading.)

**Step 4b — no route means STAND.** In `src/depot/drivers.js`, `armorGoal`'s replan block: where `planRoute`'s result lands (`v._route = r && r.pts.length ? r.pts : null;`), a NULL result now marks the hull road-less, and the waypoint fallback stops handing the raw destination to a hull that has no road at all:

```js
    v._route = r && r.pts.length ? r.pts : null;
    v._noRoute = !r;   // P7 T24: null = NOWHERE to go — never blind-drive at the dest
    v._routeDest = { x: v.dest.x, z: v.dest.z };
```

and, at the waypoint pick (`const wp = v._route && v._route.length ? v._route[0] : v.dest;`):

```js
  if (v._noRoute) {
    // P7 T24: THE STAND — a hull with no route holds its ground and asks
    // again every three seconds (the stall clock already re-plans); the
    // mk1.31 blind fallback rolled the owner's APC and is dead. The
    // progress watch is skipped while standing — patience is not stuck.
    v.goal = null;
    v._routeT = (v._routeT || 0) + dt;
    return;
  }
  const wp = v._route && v._route.length ? v._route[0] : v.dest;
```

(The `_routeT` accrual reuses the existing 3s stale-replan clock so the stand re-probes; `_noRoute` joins save.js's BODY_HANDLED transients ONLY IF the agent finds it would otherwise ride — check, and name the outcome. The ram fallback is untouched: it runs on `!reached`, never on null.)

**Step 4c — a hard turn at speed brakes first.** In `armorGoal`, directly after the goal is set (before the corner-crawl block):

```js
  // P7 T24: BRAKE BEFORE THE TURN-AROUND — a route appearing or reversing
  // mid-drive can demand a near-U-turn while the hull carries speed; steering
  // hard at speed ROLLS it (both measured deaths). Slow first, then turn.
  {
    const spd = Math.hypot(v.v.x, v.v.z);
    let err = Math.atan2(v.goal.x - v.pos.x, v.goal.z - v.pos.z) - Math.atan2(v.R[6], v.R[8]);
    while (err > Math.PI) err -= 2 * Math.PI;
    while (err < -Math.PI) err += 2 * Math.PI;
    if (Math.abs(err) > 1.2 && spd > 3) {          // provisional (F5)
      v.depotDrive = "manual";
      v.ctl = { throttle: 0, steer: 0, brake: true };
      return;
    }
  }
```

(The brake holds only while BOTH conditions stand — speed decays past 3 within a few ticks and normal driving resumes with the turn made slowly. The progress watch keeps running — braking frames count toward it, which is correct: a hull that can only ever brake is genuinely stuck.)

**Step 5 — the known re-pin.** T17(d) (in `scripts/tests/08-debug-pass.mjs`) re-teaches: the one-cell bag doorway now asserts REFUSED for hulls, and a three-cell-gap assert takes over the threads-it duty (mirror T24(b)/(b2)'s shapes). Old → new in the report. Full grep for any other pin on bag-gap routing; anything else failing is a STOP.

**Step 6 — the measured gate.** Rerun `.superpowers/diag-audio-hitch.mjs`'s protocol (build + preview + the staged 12-squad ordered war): report HEAVY-vs-NORMAL medians ON and OFF, before/after style against the recorded baseline (heavy-frame ON median 67.8–72.8ms, threads term +20–29ms, the 1.8–2s stalls). Acceptance: the threads term collapses to noise (< 5ms) and no multi-second stall appears in the capture windows. If the numbers do not move, STOP — do not land a perf fix that does not perform.

**Step 7 — gates.** `node scripts/depot-test.mjs`, `node scripts/depot-lint.mjs`, the build, `node scripts/smoke.mjs`. Nothing else. Golden does NOT run.

**Step 8 — the landing.** Bump `src/version.js` to `mk1.55`. Build AFTER the bump. Commit: `quiet frames, clear yards: the threads stop churning, the hulls park wide (mk1.55)`. Push. Report: read-confirmation opening, gate results, the Step 6 numbers against baseline, the one re-pin old → new, every deviation labeled.

---

## Amendment 1 (2026-08-19, after the agent's honest stop — owner-reviewed before resume)

Three plan defects, the plan-writer's, each fixed here; the agent's Steps 1–4c work stands.

**A. T24(a) rewritten — the assert must exempt the pool's one-time birth** (the printed regex forbade the very `new THREE.*` calls Step 2's init requires). New form — slice the HOT PATH (everything after `const P = pathPool;` within the method) and assert it allocates nothing:

```js
  const hot24 = (rSrc24.split("const P = pathPool;")[1] || "new ").split("},")[0];
  ok("T24(a): the hot path allocates nothing", !/\bnew\b/.test(hot24) && /setDrawRange\(/.test(rSrc24));
  ok("T24(a1b): the pool is born once, lazily", /if \(!pathPool\) \{/.test(rSrc24));
```

(the slice boundary `"},"` = the method's close; the agent fits the exact boundary to the real text and names the fit if it differs.)

**B. T24(c2) corrected — the live call carries `world`:** the assert and Step 3's old→new both become `slotBlockedPublic(world, bx, bz, Math.hypot(spec.hx, spec.hz) + 2.5)`.

**C. Step 4b's STAND moves BELOW the arrival branch** — arrival outranks the stand (a zero-length leg means you are there; the three-strike clamp's `dest = pos` must still settle to defend, which the agent's repro proved my printed order broke). The `const wp = …` pick and the ARMOR_ARRIVE `if` stay exactly as they are; the STAND block inserts directly after the arrival branch, before the keep-right/goal-set line. T13(f3) must pass again with this order — it is part of Step 5's verification, not a re-pin.

**D. The agent's two fits are ratified as taken:** the fixture/import lift into 09-reorg.mjs (from the T17 fixtures and the diagnosis harness), and the `routeOk()` gate shape in muster.js (ring placement and brute-sweep `best` gated; the flattest-clear last resort ungated, exactly as the contract text demands).

Everything else stands as written. Resume from Step 4b's re-placement, then Steps 5–8.
