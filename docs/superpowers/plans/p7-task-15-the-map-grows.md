# P7 Task 15 — the map grows (mk1.45)

*2026-08-18. Executes the owner's ruling: the square grows 120×120 → 180×180 (50% linear, 2.25× area) with today's feature COUNTS HELD — the same bands, buildings, hills, forests, one stream, road draw, spread across the bigger ground. Position ranges scale ×1.5; feature sizes, clearances, and counts do not move. The T3 perf gate is satisfied by the 2026-08-18 Pi probe (recorded in the decision record): steady overlay cost +~15 ms per second of play; the one caveat is +1.2 ms on the four sight frames each second at the 80-man ceiling. The owner's playtest judges pacing (marches +50% against the same 90s bell; sight ranges now relatively shorter) — no dial moves in this task.*

**Suggested model: Sonnet** — a literal-for-literal edit table; zero design freedom.

**Scope:** `src/depot/DepotGame.jsx`, `scripts/depot-test.mjs`, `src/version.js`. Nothing else — territory, sight, renderer, orient, and save are all parametric over the rim halves and the field and follow automatically; mine seeding is data-driven off passes and territory.

**Old saves:** the version-mark bump burns stale saves at the door (save.js probeFront/burnFront, verified 2026-08-18) — a 120-map war can never resume onto a 180 world. No code needed; verify the burn fires in smoke's resume section if it exercises one.

## The scaling law (binds every edit below)

- **Position ranges ×1.5, exactly.** A drawn coordinate `-A + r()*2A` becomes `-1.5A + r()*3A`.
- **Feature sizes, clearances, and counts NEVER scale** — rock radii, stream width, pond radii, hill radii/height, building templates, spacing minimums to other features, retry caps, count draws all stay byte-identical.
- **Walks scale range AND step together.** The rocks walk advances by drawn steps across a range; both scale ×1.5 so the same rng sequence terminates after the SAME number of iterations — the walk is the same walk, stretched. Never scale one side of a walk.
- **Draw-count stability:** genMap and planTrees run their own free streams (never world.rng); every LIVE draw contract (boot draws 45, fixed draws per bell) is untouched by this task. ~~The T6 keystone's total draw count must come out unchanged~~ — STRUCK BY AMENDMENT 1 (see the end of this document): the keystone's count includes the simulated battle's draws over the reshaped world and legitimately moves; hash AND draws re-pin together, the T3/T5 precedent.

## Required reading, in order (verify anchors before code)

1. `src/depot/DepotGame.jsx` 49–50 and 62 (the constants), 72–299 (genMap whole), 300–331 (makeMap + the acceptance predicate), 333–435 (buildDepotTerrain — read-only, fully parametric: verify no size literal beyond the RIM_HALF falloff read at 351), 488–554 (planTrees), 1347 (makeField call).
2. `src/engine/core.js` makeField (line ~114) — READ ONLY: `half = (n-1)*cs/2`, so n 121 → half 120 today (60m apron past the rim); n 181 → half 180 (90m apron, same proportion).
3. `scripts/depot-test.mjs` — the T6 keystone block (PIN_HASH/PIN_DRAWS pins and how the fixed-seed world boots), the FRONT F1 sweep blocks (causeway/depot sweeps over fixed seeds), the T3 boot-stone census if present, and the T12/T13 block end (insertion point).

## Trap notes

- **Only DepotGame.jsx carries map-size literals.** If you find yourself editing territory.js, sight.js, renderer.js, or orient.js, STOP — they take the rim halves as data.
- **`benches`, spawn z (`GRID_OZ + 2`), objective (`depotDepth - 3`), doorway (`-depotDepth - 5`), and `dHalfDiag` all DERIVE** — no edit.
- **The stream keeps its width and its 13 path points** (−90..90 step 15 replaces −60..60 step 10 — same count, same draws).
- **The treeline keeps its 3.2m spacing** (the map's frame keeps its look; its tree count grows ~1.5× linear — the pool assert below watches it). Its own stream — no draw-count concern.
- **Expected re-pins, all BY DESIGN and each reported old → new:** the T6 keystone HASH (draw count must NOT move); the FRONT F1 causeway/depot sweep seeds re-base (keep every existing minimum, e.g. 9-of-10); any boot-stone census numbers re-measure. Anything else that moves is a defect signal — STOP and report before re-pinning it.

## Steps

**Step 1 — the failing asserts land first.** In `scripts/depot-test.mjs`, insert after the T13 block end:

```js
// ==== P7 T15: THE MAP GROWS ==================================================
// The owner's ruling: 180x180, feature counts held, position ranges x1.5.
// These pin the new frame; the T6 keystone re-pins its hash (world reshapes)
// with its DRAW COUNT unchanged (the scaling law's proof).
{
  const dgSrc15 = /* the suite's DepotGame source read idiom */;
  ok("T15(a): the rim halves grew to 90", /const RIM_HALF_U = 90, RIM_HALF_V = 90;/.test(dgSrc15));
  ok("T15(a2): the grid grew to 90x90 at the same 2m cell", /const GRID_CS = 2\.0, GRID_W = 90, GRID_H = 90;/.test(dgSrc15));
  ok("T15(a3): the heightfield grew with its apron", /makeField\(181, 2\.0, MAP_SEED\)/.test(dgSrc15));
  ok("T15(a4): the depot-separation floor scaled", /2 \* m\.depotDepth\) >= 105/.test(dgSrc15));
}
// ==== end P7 T15 =============================================================
```

Then adjust the T6 keystone block: capture nothing yet — run the suite, confirm T15(a)–(a4) FAIL and everything else still passes. Report the failing output.

**Step 2 — the constants.** `DepotGame.jsx`:
- Line 49: `const GRID_CS = 2.0, GRID_W = 60, GRID_H = 60;` → `const GRID_CS = 2.0, GRID_W = 90, GRID_H = 90;`
- Line 62: `const RIM_HALF_U = 60, RIM_HALF_V = 60;` → `const RIM_HALF_U = 90, RIM_HALF_V = 90;`
- Line 1347: `makeField(121, 2.0, MAP_SEED)` → `makeField(181, 2.0, MAP_SEED)`

**Step 3 — genMap's position ranges, the exact table.** Each line keeps its shape; only the numbers shown change:

| Line | Old | New |
|---|---|---|
| 78 | `44 + r() * 8` | `66 + r() * 12` |
| 80 | `34 + r() * 14` | `51 + r() * 21` |
| 81 | `(r() - 0.5) * 8` | `(r() - 0.5) * 12` |
| 87 | `-28 + (i + 0.5) * (58 / nBands) + (r() - 0.5) * 10` | `-42 + (i + 0.5) * (87 / nBands) + (r() - 0.5) * 15` |
| 92 | `-50 + r() * 100` | `-75 + r() * 150` |
| 103 | `-22 + r() * 44` | `-33 + r() * 66` |
| 107 | `(r() - 0.5) * 90` | `(r() - 0.5) * 135` |
| 109 | `for (let u = -60; u <= 60; u += 10)` | `for (let u = -90; u <= 90; u += 15)` |
| 114 | `for (let x = -55; x <= 55; x += 5.5 + r() * 3)` | `for (let x = -82.5; x <= 82.5; x += 8.25 + r() * 4.5)` |
| 127 | `-45 + (i + 0.5) * (90 / nSpawn) + (r() - 0.5) * 10` | `-67.5 + (i + 0.5) * (135 / nSpawn) + (r() - 0.5) * 15` |
| 158 | `x = -50 + r() * 100, z = -12 + r() * 48` | `x = -75 + r() * 150, z = -18 + r() * 72` |
| 173 | `hu = -48 + r() * 96, hv = -46 + r() * 88` | `hu = -72 + r() * 144, hv = -69 + r() * 132` |
| 222–223 | `x = -48 + r() * 96` / `z = -44 + r() * 84` | `x = -72 + r() * 144` / `z = -66 + r() * 126` |
| 247 | `x = -52 + r() * 104` | `x = -78 + r() * 156` |
| 262 | `x = -50 + r() * 100, z = -depotDepth + r() * 20` | `x = -75 + r() * 150, z = -depotDepth + r() * 30` |
| 277–278 | `x = -50 + r() * 100` / `z = -44 + r() * 84` | `x = -75 + r() * 150` / `z = -66 + r() * 126` |
| 327 | `>= 70` | `>= 105` |

Everything not in this table stays byte-identical — including every clearance (`< 8`, `< 9`, `< 12`, `< 16`, radii, retry caps) and every count draw.

**Step 4 — planTrees' position ranges:**

| Line | Old | New |
|---|---|---|
| 510 | `Math.abs(c.u) > 58 \|\| Math.abs(c.v) > 58` | `Math.abs(c.u) > 88 \|\| Math.abs(c.v) > 88` |
| 518 | `for (let tu = -56; tu <= 56; tu += 3.2)` | `for (let tu = -86; tu <= 86; tu += 3.2)` |
| 519 | `-54.5 + rT() * 3.2` | `-84.5 + rT() * 3.2` |
| 535 | `cu = -52 + rT() * 104, cv = -52 + rT() * 104` | `cu = -78 + rT() * 156, cv = -78 + rT() * 156` |
| 546 | `fu = -48 + rT() * 96, fv = -48 + rT() * 96` | `fu = -72 + rT() * 144, fv = -72 + rT() * 144` |

(The treeline step stays 3.2 — the frame keeps its density; copse/forest tree counts unchanged.)

**Step 5 — the censuses prove the pools hold.** Extend the T15 block with the frame's health checks, run over 25 seeds the way the mk1.32 census did (reuse its harness idiom):

```js
  // (b) 25-seed census: every map accepts, stays connected, and fits its pools
  // — counts held means the pools MUST hold; this is the proof, not a hope.
  // Reuse the FRONT F1 / T3 boot harness idiom to regrow maps headless.
  // Assert per seed: makeMap accepts within its 24 attempts; boot stone count
  // < 3000 (the chunk pool); planTrees().length < 360 (the tree pool);
  // both depots inside the 90 rim; every spawn reachable (the existing
  // connectivity predicate returned true by construction — assert it anyway).
```

Write the asserts in that harness's real shape (the plan cannot quote it verbatim — it is the one piece read at execution; follow the existing census code exactly, changing only the new bounds). Report the measured ranges: boot stones min–max, trees min–max, accept-attempt max.

**Step 6 — the keystone re-pins.** Run the suite; the T6 keystone fails on hash (expected, the world reshaped). Re-capture hash; assert the DRAW COUNT came out unchanged — if it moved, a walk was scaled wrong: STOP, find it, do not re-pin draws. Re-base the FRONT F1 sweep seeds per their own re-base procedure, keeping every existing minimum. Each re-pin reported old → new.

**Step 7 — gates.** `node scripts/depot-test.mjs`, `node scripts/depot-lint.mjs`, the build, `node scripts/smoke.mjs`. Golden does NOT run — no engine change.

**Step 8 — the landing.** Bump `src/version.js` to `mk1.45`. Build AFTER the bump. Commit: `the map grows: the same war, half again the ground (mk1.45)`. Push. Report: read-confirmation opening, gate results, the census ranges, every re-pin old → new, every deviation labeled.

---

## Amendment 1 (2026-08-18, after the agent's honest stop — owner-reviewed before resume)

**A. The keystone law is corrected.** The plan's claim "the T6 keystone draw count must come out unchanged" was WRONG — the plan-writer's error, found by the agent: the fixture's count includes the 1200-step battle simulated over the world, and the reshaped world sorts a different biggest building, so battle draws legitimately move (measured: 755 → 710, world verified sane by direct diagnostic). The T3 (mk1.32) and T5 (mk1.34) precedents re-pinned hash AND draws together for exactly this cause. Step 6 now reads: **re-pin the keystone's hash and draw count together, old → new both reported.** The live game's draw contracts (boot 45, fixed per bell) remain untouched and are not in question.

**B. Test-side stale literals join the scope** — the plan's reading list missed them; each is a legitimate re-teach of this task's own change, each reported old → new:
- `mk0.50/6` and `FRONT T1` (×2): source-regex pins on `RIM_HALF_U = 60` / `GRID_W = 60` → 90.
- `F1/1a` and `T2`: depot depth range pins 44–52 → 66–78 (Step 3 row 78's own arithmetic).
- `T3(a)`: stream extent pins ±60 → ±90; `|streamV| <= 22.01` → `<= 33.01`.
- `T3(c)` and the T6 keystone block's own local `makeField(121, 2.0, ...)` calls → `makeField(181, 2.0, ...)`.
- `T5(a)`: the test's own clear-boundary `Math.abs(c.u) > 58.01` → `> 88.01` (mirrors Step 4 row 510).

**C. Two DepotGame literals the plan's table missed join Step 3:**
- Line ~1707: the camera pan extent `EXT = { x: 65, z: 65 }` ("square rim 60 + 5m margin") → `{ x: 95, z: 95 }`, comment updated to say rim 90 + 5m.
- Lines ~1715–1728: the stream water-ribbon loop — `-60..60` bounds → `-90..90`, and its point indexing `(u + 60) / 10` → `(u + 90) / 15` (the stream still carries 13 points; the spacing grew with Step 3 row 109).

Everything else in the plan stands as written.
