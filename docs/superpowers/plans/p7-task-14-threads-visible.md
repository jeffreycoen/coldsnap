# P7 Task 14 — the threads become visible (mk1.44)

*HISTORY (stamped 2026-08-20, owner's order): this document is a record of shipped work, not authority. Design truth lives in CLAUDE.md and the ACTIVE phase's plan documents; where this file disagrees with them, it is wrong.*

*2026-08-18. The owner cannot see the mk1.43 green threads. Wiring verified correct (renderer method, camera layer 1, collector all live); the lines are simply too faint — 0.55 opacity, 1px, dashed — for the dot-matrix downsample, and green-on-green on held ground compounds it. Also fixes a deviation found in review: the collector runs per frame instead of at the 4Hz cadence the plan specified. The look is the owner's live acceptance.*

**Suggested model: Sonnet.** **Scope:** `src/render/renderer.js`, `src/depot/DepotGame.jsx`, `scripts/depot-test.mjs` (one assert re-pin), `src/version.js`.

## Required reading

1. `src/render/renderer.js` — `setOrderPaths` (the mk1.43 block after `setLinePreview`, ~1451–1480).
2. `src/depot/DepotGame.jsx` ~3926–3941 — the collector block and the `if (terrGuard > 0)` gates above it.
3. `scripts/depot-test.mjs` — the T13(j)/(j2) asserts.

## Steps

**Step 1 — the line reads.** In `setOrderPaths`, replace the single-line build inside the `for (const p of paths)` loop (from `if (v.length < 2) continue;` through `pathGroup.add(line);`) with a two-pass draw — a dark underlay so the green reads on snow and on held-green wash alike, then the bright thread:

```js
        if (v.length < 2) continue;
        const geo = new THREE.BufferGeometry().setFromPoints(v);
        const under = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x0c2416, transparent: true, opacity: 0.85, depthWrite: false }));
        pathGroup.add(under);
        const line = new THREE.Line(geo.clone(), new THREE.LineDashedMaterial({ color: 0x4aff8c, dashSize: 1.4, gapSize: 0.6, transparent: true, opacity: 0.95, depthWrite: false }));   // provisional (F5)
        line.computeLineDistances();
        pathGroup.add(line);
```

And the sample lift rises off the ground clutter: in the vertex loop, `+ 0.22` becomes `+ 0.34`.

**Step 2 — the cadence honors the plan.** In `DepotGame.jsx`, wrap the collector block in the same gate its neighbors carry: the line `{` opening the THE GREEN THREADS block becomes `if (terrGuard > 0) {` — geometry rebuilds at 4Hz, not per frame. (mk1.43 deviation, found in review, corrected here.)

**Step 3 — the assert follows.** T13(j) currently pins `/setOrderPaths\(paths\)/` and `/0x4aff8c/` — both still hold; add the underlay to the pin: `ok("T13(j): ...", /setOrderPaths\(paths\)/.test(rSrc) && /0x4aff8c/.test(rSrc) && /0x0c2416/.test(rSrc));`. T13(j2) gains the gate: `/if \(terrGuard > 0\) \{[\s\S]{0,200}?THE GREEN THREADS/.test(dgSrc)` or an equivalent single regex proving the block sits behind the gate — keep it simple and literal.

**Step 4 — gates.** `node scripts/depot-test.mjs`, `node scripts/depot-lint.mjs`, build, `node scripts/smoke.mjs`. Nothing else. Zero re-pins expected beyond the Step 3 assert edit (which is the named re-pin of this task: T13(j)/(j2), old → new stated in the report).

**Step 5 — the landing.** Bump `src/version.js` to `mk1.44`. Build AFTER the bump. Commit: `the threads become visible: dark under bright, 4Hz honored (mk1.44)`. Push. Report: read-confirmation, outcome line, gates, deviations each labeled.
