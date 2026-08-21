# P7 Task 20 — the build lines move out (mk1.50)

*HISTORY (stamped 2026-08-20, owner's order): this document is a record of shipped work, not authority. Design truth lives in CLAUDE.md and the ACTIVE phase's plan documents; where this file disagrees with them, it is wrong.*

*2026-08-18. Reorganization 3 of 5: the two-point lay machinery — constants, the staircase cell walk, piece footprints, line start, ghost pieces, the piece layer, the line driver — moves from DepotGame's mount into `src/depot/buildlines.js` as VERBATIM BODIES WITH EXPLICIT PARAMETERS (the muster.js pattern; every substitution named below). The interface glue — preview drawing, accept/reject, tap flow — STAYS in DepotGame and calls the imports. Zero behavior change: no rng lives anywhere in the moved code; the keystone, the boot pins, and the T10/T17 behavioral fixtures prove the move.*

**Suggested model: Sonnet** — mechanical extraction with a named substitution table.

**Scope:** new `src/depot/buildlines.js`; `src/depot/DepotGame.jsx`; `scripts/depot-test.mjs`; `src/version.js`. Nothing else.

## The moving inventory (DepotGame.jsx, live anchors — verified this session)

- The LAY comment block + constants (1723–1747): `LAY_AHEAD`, `LINE_MAX_CELLS`, `LAY_MAN_PAD`, `LAY_REACH`, `MINE_LAY_PAUSE_S`. (`LINE_END_R` at 1801 is tap-flow — STAYS.)
- `lineCells` (1748–1764) → `lineCells(grid, a, b)`.
- `pieceHalf` (1765–1774) → moves verbatim (already pure over state.js constants).
- `startBuildLine` (1775–1796) → `startBuildLine(grid, sq, kind, a, b, toast)`.
- `linePieces` (1802–1822) → `linePieces(grid, field, T, kind, a, b)`.
- `layPieceAt` (1881–1945, with its doc comment 1881–1884) → `layPieceAt(world, grid, field, T, S, job, row, ctx)`.
- The `S.stepBuildLine` body (1946–1995) → `stepBuildLine(world, grid, field, T, S, sq, ctx, toast)`.

**What stays in the mount:** `LINE_END_R`; `refreshLinePreview` (1823–1840 — renderer + market reads; now calls the imported `linePieces`); `acceptLine`/`rejectLine` (1841–1880 — now call the imported `startBuildLine`); `consumeOrderTap` and everything after; `stampBag`; `recomputeFlow`; `objG`. The mount wires:

```js
      const layCtx = { stampBag, recomputeFlow, objG, setMines: (m) => R.setMines(m) };
      S.stepBuildLine = (sq) => stepBuildLine(world, grid, field, T, S, sq, layCtx, toast);
```

## The substitution table (the ONLY changes inside moved bodies)

| In | Old token | New token |
|---|---|---|
| lineCells | *(signature)* `(a, b)` | `(grid, a, b)` |
| startBuildLine | *(signature)* `(sq, kind, a, b)` | `(grid, sq, kind, a, b, toast)` |
| linePieces | *(signature)* `(kind, a, b)` | `(grid, field, T, kind, a, b)` |
| linePieces / startBuildLine | `lineCells(a, b)` | `lineCells(grid, a, b)` |
| layPieceAt | *(signature)* `(job, row)` | `(world, grid, field, T, S, job, row, ctx)` |
| layPieceAt | `R.setMines(S.mines)` | `ctx.setMines(S.mines)` |
| layPieceAt | `stampBag(` / `recomputeFlow()` / `objG` | `ctx.stampBag(` / `ctx.recomputeFlow()` / `ctx.objG` |
| stepBuildLine | *(signature — replaces the `S.stepBuildLine = (sq) =>` header)* | `export function stepBuildLine(world, grid, field, T, S, sq, ctx, toast)` |
| stepBuildLine | `layPieceAt(job, row)` | `layPieceAt(world, grid, field, T, S, job, row, ctx)` |

Everything else — comments, dials, the reach gate, the connectivity refusal, the man-overlap skip, draw-free determinism — is byte-identical. buildlines.js imports: mapgen.js (`invW`, `ORIENT`, `SPAWN_POINTS`, `checkConnectivity`), state.js (`validatePlacement`, `spawnWallCourses`, `spawnSandbag`, `wallOrientAt`, `sandbagOrientAt`, `memberNearRow`, `WALL_HALF`, `WALL_THIN`, `SANDBAG_HX`, `SANDBAG_HY`, `SANDBAG_HZ`, `WALL_FIELD_COST`, `SANDBAG_FIELD_COST`, `WALL_LAY_PAUSE_S`), market.js (`fieldPrices`), mines.js (`MINE_COST`, `WIRE_COST`), territory.js (`canBuild`). Never DepotGame, never renderer (the renderer arrives through `ctx.setMines`).

## Required reading, in order (verify anchors before code)

1. `src/depot/DepotGame.jsx` 1723–1995 whole (the full inventory and the stay-behind glue — confirm every boundary above) plus every call site of the moved names outside that range (grep `linePieces(`, `startBuildLine(`, `stepBuildLine(`, `pieceHalf(`, `lineCells(` — the tap-flow and pie code reference some).
2. `src/depot/muster.js` header — the pattern this task copies.
3. `scripts/depot-test.mjs` — the T19 block end (insertion point); T17(a4) and T17(f2); the P6 T3 engineer-line pin (re-pinned at mk1.47 to `/spawnSandbag\(world, row\.x, row\.z, orient\)/`); every other source pin over the moved text (full grep sweep — see the license below).

## Trap notes

- **The moved code holds zero rng and zero renderer/game-state writes beyond what S/ctx carry** — if a body you're moving references a mount name not in the substitution table or the import list, STOP: the inventory missed a reference, and the plan must be amended rather than patched silently.
- **THE SWEEP LICENSE (learned at Task 19):** any suite pin whose pinned LITERAL TEXT this task's steps move or re-sign retargets (source-read → buildlines.js) or re-teaches (literal → the new call shape) with its asserted content unchanged — each listed old → new in the report, no owner stop needed. Known movers: T17(a4) (the reach-gate regex → buildlines source), T17(f2) (the stampBag regex — dgSrc loses its last matching site; retarget to muster.js source, where the seeded-ring stamp lives), the P6 T3 `spawnSandbag(world, row.x, ...)` pin (→ buildlines source), any literal pin on `LAY_AHEAD`/`MINE_LAY_PAUSE_S`/`LAY_REACH` text. A failure asserting DIFFERENT content, or failing for any reason other than the text having moved, remains a STOP.
- **The keystone (3465970090/695), the T9 boot pins, the T10 mine fixtures, and T17(a–a3) must pass untouched** — they are the behavior proof.
- **`S.stepBuildLine` keeps its name and call shape for consumers** — the mount wrapper above preserves both; the per-tick call site does not change.

## Steps

**Step 1 — the failing asserts land first.** After the T19 block:

```js
// ==== P7 T20: THE BUILD LINES MOVE OUT =======================================
// Reorganization 3 of 5 (owner): the two-point lay machinery lives in
// buildlines.js, verbatim bodies with explicit parameters; the interface
// glue stays behind and calls in.
{
  ok("T20(a): buildlines.js owns the machinery",
    /export function stepBuildLine\(world, grid, field, T, S, sq, ctx, toast\)/.test(blSrc20) &&
    /export function layPieceAt\(world, grid, field, T, S, job, row, ctx\)/.test(blSrc20) &&
    /export function startBuildLine\(grid, sq, kind, a, b, toast\)/.test(blSrc20) &&
    /export function linePieces\(grid, field, T, kind, a, b\)/.test(blSrc20) &&
    /export function lineCells\(grid, a, b\)/.test(blSrc20) && /export function pieceHalf\(kind, orient\)/.test(blSrc20));
  ok("T20(a2): DepotGame no longer defines what it now imports",
    !/const layPieceAt = /.test(dgSrc20) && !/const lineCells = /.test(dgSrc20) &&
    !/const startBuildLine = /.test(dgSrc20) && /from "\.\/buildlines\.js"/.test(dgSrc20));
  ok("T20(a3): the mount wires the driver through the context",
    /const layCtx = \{ stampBag, recomputeFlow, objG, setMines: \(m\) => R\.setMines\(m\) \};/.test(dgSrc20) &&
    /S\.stepBuildLine = \(sq\) => stepBuildLine\(world, grid, field, T, S, sq, layCtx, toast\);/.test(dgSrc20));
  // (b) the machinery, called for real — a wall line on a synthetic world
  // lays through the imported driver end to end.
  {
    const flatF20 = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (x, z, o) => { o.x = 0; o.y = 1; o.z = 0; return o; } };
    const w = makeWorld({ field: flatF20, seed: 41 });
    const G = mkGrid16(20); // any of the suite's mini-grid helpers with cellAt
    const sq = makeSquad(1, "engineers", 1, -5, 1);
    spawnSquadMembers(w, sq);
    const S20 = { resources: 500, mines: [], sandbagOrient: 0, _market: null, _minePrices: null, squads: [sq] };
    const ctx20 = { stampBag: () => {}, recomputeFlow: () => {}, objG: { gx: 10, gz: 19 }, setMines: () => {} };
    const T20 = null; // canBuild(T,...) — pass a permissive territory stub if the real canBuild requires one; match its true signature, state what was needed
    startBuildLine(G, sq, "bags", { x: -5, z: 1 }, { x: 5, z: 1 }, () => {});
    ok("T20(b): the order arms — rows planned, phase toStart", !!sq._build && sq._build.rows.length >= 5 && sq._build.phase === "toStart");
    sq.order = "defend"; sq.dest = null;                        // simulate the arrival handoff
    stepBuildLine(w, G, flatF20, T20, S20, sq, ctx20, () => {}); // flips to laying
    sq.anchor = { x: 5, z: 1 };                                  // anchor at the far end
    for (const id of sq.memberIds) { const u = w.byId.get(id); u.pos.x = 5; u.pos.z = 1; } // hands present
    sq.order = "defend";                                         // arrived
    for (let i = 0; i < 80; i++) { sq._pauseT = 0; stepBuildLine(w, G, flatF20, T20, S20, sq, ctx20, () => {}); if (!sq._build) break; }
    let bags = 0;
    for (const b of w.bodies) if (b.sandbag && b.alive) bags++;
    ok("T20(b2): the line laid real bags through the real driver", bags >= 3, bags);
    ok("T20(b3): the job closed and the books were charged", sq._build === null && S20.resources < 500, S20.resources);
  }
}
// ==== end P7 T20 =============================================================
```

`blSrc20`/`dgSrc20` via the source-read idiom (T18's not-yet-existing fallback). The (b) fixture's territory stub: `canBuild(T, u, v)` — read its real signature in territory.js first and pass the smallest object (or null-check) that answers "held" for every cell; if `canBuild` cannot be stubbed without touching territory.js, build a real `makeTerritory` instead — state which was needed. Adjust the arrival simulation to the real phase flow if the literal sequence above misses a step (the plan's intent: arm → handoff → hands at rows → all rows lay → job closes) — any such fit is a named deviation. Run — T20 fails. Report the failing output.

**Step 2 — buildlines.js is born.** Header in the muster.js style (the pattern, the parameter rule, the zero-rng note), the import list from the substitution section, then the seven items: bodies verbatim from the inventory lines, substitutions ONLY per the table.

**Step 3 — the mount rewires.** Delete the moved definitions from DepotGame.jsx; add the import line (`lineCells, pieceHalf, startBuildLine, linePieces, layPieceAt, stepBuildLine` from `./buildlines.js`); install the `layCtx` + `S.stepBuildLine` wrapper exactly as printed above, at the spot where `S.stepBuildLine` is defined today; rewire `refreshLinePreview`'s `linePieces(lp.kind, lp.a, lp.b)` → `linePieces(grid, field, T, lp.kind, lp.a, lp.b)` and `acceptLine`'s `startBuildLine(sq, lp.kind, lp.a, lp.b)` → `startBuildLine(grid, sq, lp.kind, lp.a, lp.b, toast)`; grep for any other caller of the moved names and rewire identically (each named in the report). One build run as the reference-closure check.

**Step 4 — the suite follows, under the sweep license.** Full grep sweep of every source pin over moved text; retarget/re-teach per the license, each old → new. The three known movers are named in the trap notes; expect few others.

**Step 5 — gates.** `node scripts/depot-test.mjs` (all green — T20 included; keystone 3465970090/695 stated; T9 boot pins stated; T10/T17 behavioral fixtures green), `node scripts/depot-lint.mjs`, the build, `node scripts/smoke.mjs`. Nothing else. Golden does NOT run.

**Step 6 — the landing.** Bump `src/version.js` to `mk1.50`. Build AFTER the bump. Commit: `the build lines move out: buildlines.js, verbatim bodies (mk1.50)`. Push. Report: read-confirmation opening, gate results with pin values stated, the sweep list old → new, every deviation labeled.
