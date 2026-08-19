# P7 Task 21 — the bell moves out (mk1.51)

*2026-08-18. Reorganization 4 of 5: the bell's ring — town pay, the fireBell sequence, the defensive-opening split, the commander's bell orders, the ferry, the enemy hero replacement, the enemy mine seeding, the cues and the save — moves from DepotGame's mount into `src/depot/bell.js` as ONE verbatim body with explicit parameters (the muster/buildlines pattern). The bell's cards (intel/manifest presentation, the pick) STAY in the mount — presentation, not the ring. Zero behavior change: the exact draw order inside the ring (planWave's 4, the ferry's 2, the sapper's 2, intel's variable draws through fireBell) is byte-fixed; keystone, boot pins, and the T8/T9/T10 fixtures prove it.*

**Suggested model: Sonnet** — one-function extraction with a named substitution table.

**Scope:** new `src/depot/bell.js`; `src/depot/DepotGame.jsx`; `scripts/depot-test.mjs`; `src/version.js`. Nothing else.

## The moving inventory (DepotGame.jsx, live anchors — verified this session)

- `ringBell` whole (2223–2363, `const ringBell = () => {` through its closing `};`) → `export function ringBell(world, grid, field, T, S, ctx)`.

**What stays in the mount:** the call site (`if (stepBell(S, world.t)) ringBell();` at 3011 — via the wrapper below), the bell's cards (`S.ackIntel`/`S.openManifest`/`S.dismissManifest`/`S.pickManifest`, 2369–2387), `spawnOne`, `townUV` (960), `buildSnapshot` (1273), `saveFront` (2190), `nextApcSeq`. The mount wires:

```js
      const bellCtx = { cue, toast, townUV, buildSnapshot, nextApcSeq, saveFront: () => saveFront() };
      const ringBell = () => ringBellOut(world, grid, field, T, S, bellCtx);
```

(the import is aliased `ringBell as ringBellOut` so the mount keeps its local name and the 3011 call site does not change.)

## The substitution table (the ONLY changes inside the moved body)

| Old token | New token |
|---|---|
| *(header)* `const ringBell = () => {` | `export function ringBell(world, grid, field, T, S, ctx) {` |
| `cue(` (2 sites) | `ctx.cue(` |
| `toast(` (3 sites) | `ctx.toast(` |
| `payTown(townUV, T)` | `payTown(ctx.townUV, T)` |
| `buildSnapshot()` | `ctx.buildSnapshot()` |
| `nextApcSeq` (2 sites, the parkArmor calls) | `ctx.nextApcSeq` |
| `saveFront();` | `ctx.saveFront();` |

Everything else — comments, the draw pairs, the gates, the dials — byte-identical. bell.js imports: mapgen.js (`TOWN, PASSES, OBJ_POS, invW, fwdU`), economy.js (`payTown`), state.js (`fireBell, TIER_BELLS`), ai.js (`homeShare, pickHomeDetail, HOME_GUARD_CAP, cmdrBellOrders, ferryDecide, flankDrop`), squads.js (`clearSlot`), units.js (`spawnUnit`), muster.js (`parkArmor`), mines.js (`mineSeedRoll, mineSeedPlace, MINE_COST`), specs.js (`MASON, BISON, APC`). Never DepotGame, never the renderer.

## Required reading, in order (verify anchors before code)

1. `src/depot/DepotGame.jsx` 2223–2400 (ringBell whole + the cards that stay), 955–965 (townUV), 1270–1280 (buildSnapshot's opening), 2185–2222 (saveFront's opening + what sits between it and ringBell), 3005–3015 (the call site), and the import block.
2. `src/depot/muster.js` and `src/depot/buildlines.js` headers — the pattern.
3. `scripts/depot-test.mjs` — the two ringBell body-extraction regexes (`const ringBell = \(\) => \{` at ~4513 and ~7633) and every assert run against their extractions (the possession-era pins at 4513–4517; T9(d)–(d11) at 7633+; any T8/T10 pins on the same base); the T20 block end (insertion point).

## Trap notes

- **The draw order is the ring.** planWave's 4 (inside fireBell), the ferry's unconditional 2, the sapper's unconditional 2, intel's variable draws — their order and count per bell must come out byte-identical. The T8(g) draw-law fixtures and the T9/T10 pins are the proof.
- **A moved-body reference outside the table or the import list = STOP** — the inventory missed something; amend, never patch.
- **THE SWEEP LICENSE (the Task 20 shape, in force):** any suite pin or extraction whose literal text this task moves or re-signs retargets/re-teaches with asserted content unchanged — each old → new in the report, no stop needed. Known movers: BOTH ringBell extraction regexes become `export function ringBell\(world, grid, field, T, S, ctx\) \{[\s\S]*?\n\}` (or the equivalent that captures the full body in bell.js source — verify the close-brace form against the real file) reading bell.js source; every pin running against those extractions follows the base (the `saveFront();` pin re-teaches to `ctx.saveFront();`, the parkArmor literals to the `ctx.nextApcSeq` form, per the table). A failure asserting DIFFERENT content is a STOP.
- **The cards stay.** If S.pickManifest or its neighbors end up in bell.js, STOP — presentation is not the ring.

## Steps

**Step 1 — the failing asserts land first.** After the T20 block:

```js
// ==== P7 T21: THE BELL MOVES OUT =============================================
// Reorganization 4 of 5 (owner): the ring lives in bell.js, one verbatim
// body with explicit parameters; the cards stay presentation. And the ring
// gets its first real fixture — two bells rung through the actual code.
{
  ok("T21(a): bell.js owns the ring",
    /export function ringBell\(world, grid, field, T, S, ctx\)/.test(beSrc21) &&
    /ctx\.saveFront\(\);/.test(beSrc21) && /payTown\(ctx\.townUV, T\)/.test(beSrc21));
  ok("T21(a2): DepotGame keeps only the wrapper and the cards",
    !/const ringBell = \(\) => \{/.test(dgSrc21) &&
    /const ringBell = \(\) => ringBellOut\(world, grid, field, T, S, bellCtx\);/.test(dgSrc21) &&
    /S\.pickManifest = /.test(dgSrc21));
  // (b) two bells rung through the real ring — structure, not feel
  {
    makeMap(4242);
    const flatF21 = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (x, z, o) => { o.x = 0; o.y = 1; o.z = 0; return o; } };
    const w = makeWorld({ field: flatF21, seed: 51 });
    let draws = 0; const raw = w.rng; w.rng = () => { draws++; return raw(); };
    const T21 = makeTerritory(90, 90);
    const S21 = /* assemble the smallest real S the ring reads: bell counter, reg (makeRegiment), ws (makeAssaultState), manifest (makeManifestState), foe (makeFoeState), mines: [], resources, _market: null, _minePrices: null, squads: [] — follow the state factories' real signatures and the mount's own assembly order; any field the ring throws on joins the stub, each named */;
    let saves = 0;
    const ctx21 = { cue: () => {}, toast: () => {}, townUV: [], buildSnapshot: () => ({ }), nextApcSeq: () => 99, saveFront: () => { saves++; } };
    const d0 = draws;
    ringBell(w, null, flatF21, T21, S21, ctx21);
    ringBell(w, null, flatF21, T21, S21, ctx21);
    ok("T21(b): two rings, two saves, no throw", saves === 2);
    ok("T21(b2): the unconditional pairs drew — at least 16 draws across two bells (4 planWave + 2 ferry + 2 sapper each, intel on top)", draws - d0 >= 16, draws - d0);
    ok("T21(b3): the muster filled the queue", S21.ws.spawnQueue > 0 || S21.ws.mixBag.length > 0);
  }
}
// ==== end P7 T21 =============================================================
```

`beSrc21`/`dgSrc21` via the source-read idiom (missing-file fallback). The S21 assembly is the one licensed fit: build it from the real state factories in the mount's own order; every field added because the ring read it gets named in the report. If `buildSnapshot`'s stub shape makes fireBell throw, mirror the smallest real snapshot the intel path needs — named. Run — T21 fails. Report the failing output.

**Step 2 — bell.js is born.** Header in the house style (the pattern, the draw-order contract), the import list above, then ringBell's body verbatim from 2223–2363, substitutions ONLY per the table.

**Step 3 — the mount rewires.** Delete the moved definition; add `import { ringBell as ringBellOut } from "./bell.js";`; install `bellCtx` and the one-line wrapper exactly as printed, where ringBell was defined; the 3011 call site stays untouched. One build run as the reference-closure check.

**Step 4 — the suite follows, under the sweep license.** Both extraction regexes retarget to bell.js source with the new function shape; every dependent pin follows its base (the `saveFront();` and parkArmor-literal re-teaches per the table). Full grep sweep for anything else riding the moved text. Each old → new.

**Step 5 — gates.** `node scripts/depot-test.mjs` (all green — T21 included; keystone 3465970090/695 stated; T8 draw-law, T9 boot/hero, T10 seeding fixtures green), `node scripts/depot-lint.mjs`, the build, `node scripts/smoke.mjs`. Nothing else. Golden does NOT run.

**Step 6 — the landing.** Bump `src/version.js` to `mk1.51`. Build AFTER the bump. Commit: `the bell moves out: bell.js, one verbatim ring (mk1.51)`. Push. Report: read-confirmation opening, gate results with pin values stated, the sweep list old → new, every deviation labeled (the S21 assembly fields included).
