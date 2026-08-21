# THE WATER, SWITCHED OFF — task plan (proposed mark mk1.94)

*Written 2026-08-21 on the owner's word. One task. Suggested model: Sonnet — every edit below is verbatim from this plan with a measured acceptance; the agent executes, never designs.*

## The rulings (owner, 2026-08-21 — this plan's design truth)

1. **THE STREAM GOES.** The water made too many impassable places. The stream stops being drawn — no channel, no carve, no blocked cells, no causeway.
2. **THE PONDS STAY.** They freeze to walkable ice; they block nothing a man walks. Untouched.
3. **SWITCH OFF, NOT EXCISION.** One flag in the generator. The whole water machinery — the carve, the grid's water cells, the slot and order refusals, the renderer's ribbons, the anchor's hold at the bank — stays in the tree, dormant, pinned by the suite. Flip the flag and the stream returns whole.
4. **THE CLEARANCES AND ROAD BENDS SWITCH OFF WITH IT.** Rocks, ponds, hills, buildings, ruins and field walls may stand in the former corridor; roads no longer bend to a crossing. Every seed redraws its map — knowingly; the save is already mark-gated (`save.js:312` refuses any save whose mark differs), so no live save meets a changed map.

**Symmetry:** the stream blocked both sides alike; switching it off keeps the field symmetric by construction. No asymmetry introduced.

## Plan verification (already run by the plan-writer)

Every code block below was applied to the live tree, the full suite was run against it, and the tree was reverted. The numbers in this plan are measured, not estimated: suite **1675 PASS / 0 FAIL**, keystone **hash 1818478037, draws 461**, both stable across two runs, `depot-lint` clean.

## Required reading (agent, before any code; anchors re-verified at dispatch)

This plan whole; `CLAUDE.md`; `src/depot/mapgen.js` — the header (:12-39), `genMap` whole (:41-268), the stream carve (:356-379), `makeGrid`'s water branch (:424-430), `streamAt` (:440-456), `planTrees` (:461-524); `src/depot/save.js` (:307-315) — the mark gate, context only; `scripts/tests/05-the-front.mjs` (:166-289 the T3 block, :479-512 the T5 sweep, :578-579 the keystone pins, :598-638 the keystone battle); `scripts/tests/06-troops-physics.mjs` (:18-92 the P6T1 header and block (a)); `scripts/tests/harness.mjs`; `README.md` (:17). The agent's report opens by confirming this list was read.

## Trap notes

- **The flag must live in the header span.** Every era file rebuilds the map module by slicing mapgen.js from `const GRID_CS` to `function genMap` — the flag sits between them (right after the `STREAM` declaration) or the sliced `genMap` cannot see it and five eras throw.
- **Touch nothing the T3(g) pins hold.** `DepotGame.jsx`'s `OPEN WATER — find the crossing` refusal, its `NO GROUND — open water` lines, its `world.streamAt` threading, `squads.js`'s slot/anchor water lines, and `renderer.js`'s `spec.streams || []` are pinned by surviving asserts. They stay byte-identical.
- **Grid cells never carry a `water` field until the stream writes one** — the new zero-water sweep counts truthy `c.water`, honest either way.
- **The keystone re-pin numbers are measured** (Plan verification above). If the agent's run prints anything but `hash=1818478037 draws=461`, stop — do not pin what the run prints.
- **`06-troops-physics.mjs` block (a) sits inside `if (M1ok) {`** — retire the block's body, keep the wrapper; (b), (c), (d) live in it.
- **The suite has no total-count pin**; the 1675 is this plan's own arithmetic acceptance, checked by hand at the gate.

---

## Step 1 — asserts first: the T3 block learns the water is off

`scripts/tests/05-the-front.mjs` (:166-170), the block header:

```js
// ==== FRONT T3: the water, switched off =====================================
// mk1.02 (The Front, Task 3) drew one stream per map; mk1.94 (owner) switches
// it off — the water made too many impassable places. The generator draws no
// stream on any seed and the grid carries no water cell. The water machinery
// (grid blocking, slot refusals, order toasts, ribbons) stays, dormant and
// pinned below, for the day it returns.
```

Same file (:206-258) — the whole `if (M3ok) { ... }` sweep block (old sub-tests (a) through (d), seven asserts) becomes (three asserts):

```js
  if (M3ok) {
    // (a) STREAM OFF (mk1.94, owner): no seed draws a stream; no grid cell
    // carries water. Same 20 seeds the old stream sweep rode.
    let drawn = 0, waterCells = 0;
    for (let s = 1; s <= 20; s++) {
      const Mi = mkMapT3(); Mi.makeMap(s * 331);
      const st = Mi.state();
      if (st.STREAM) drawn++;
      const g = Mi.makeGrid(null);
      for (const c of g.cells) if (c.water) waterCells++;
    }
    ok("T3(a): the stream is off — no seed draws one", drawn === 0, `${drawn}/20 drawn`);
    ok("T3(a): no grid cell carries water on any seed", waterCells === 0, `${waterCells} water cells`);
    ok("T3(a): the off-switch exists and is off", /export const STREAM_ON = false;/.test(mgSrcT3));
  }
```

The extraction assert (:204) and sub-tests (e), (f), (g) — the dormant machinery's pins — stay untouched.

## Step 2 — asserts: the T5 sweep drops the stream clearance

`scripts/tests/05-the-front.mjs`, three edits:

(:479) `let hillLo = 99, hillHi = 0, hillShape = 0, hillStream = 0, nHillsTotal = 0;` → `let hillLo = 99, hillHi = 0, hillShape = 0, nHillsTotal = 0;`

(:488) delete the line `if (Math.abs(hb.v - st.STREAM.v) >= hb.r + 9.9) hillStream++;` (its loop keeps the shape count above it).

(:509) the assert `ok("T5(a): every hill keeps its flank off the stream", ...)` → the comment `// (the hill-off-the-stream clearance retired with the stream, mk1.94)`

## Step 3 — asserts: the causeway route test retires

`scripts/tests/06-troops-physics.mjs` (:63-92) — block (a)'s body, from its comment through its `ok(...)`, becomes:

```js
    // (a) RETIRED (mk1.94, owner): the stream is switched off — there is no
    // causeway to cross. (b) below still proves routing around masonry.
```

The `if (M1ok) {` wrapper and blocks (b), (c), (d) stay. The era header comment (:20) `// on the movement grid: around masonry, through the causeway. The leg` → `// on the movement grid: around masonry. The leg` (comment only; the one edit here not in the probe run — no gate reads era comments).

## Step 4 — run the suite, expect exactly three failures

`node scripts/depot-test.mjs` — expected FAIL on exactly: `T3(a): the stream is off — no seed draws one` (20/20 drawn), `T3(a): no grid cell carries water on any seed`, `T3(a): the off-switch exists and is off`. Everything else PASS. Any other failure stops the task.

## Step 5 — the switch

`src/depot/mapgen.js`, after the `STREAM` declaration (:38):

```js
// STREAM OFF (mk1.94, owner): the water made too many impassable places. One
// switch guards the draw, the road bend and every clearance in genMap; the
// downstream machinery (the carve, grid water, slot and order refusals, the
// ribbons) already keys off STREAM staying null and waits dormant. Flip to
// true and the stream returns whole.
export const STREAM_ON = false;
```

Same file, the stream draw (:70-79) — the ten lines from `let streamV = ...` through `const stream = { ... };` become:

```js
  let stream = null, streamV = 0, bridgeU = 0;
  if (STREAM_ON) {
    streamV = (bands[0] + bands[1]) / 2;   // fallback: between the first two bands
    for (let i = 0; i < 20; i++) {
      const v = -33 + r() * 66;
      if (bands.every((b) => Math.abs(v - b) >= 8)) { streamV = v; break; }
    }
    const streamW = 2.2 + r() * 1.8;         // half-width: a 4.4-8m channel // provisional (F5)
    bridgeU = (r() - 0.5) * 135;
    const streamPts = [];
    for (let u = -90; u <= 90; u += 15) streamPts.push({ u, v: streamV + (r() - 0.5) * 6 });
    stream = { pts: streamPts, w: streamW, v: streamV, bridgeU };
  }
```

The T3 comment block above it (:64-69) stays as history. `return { ... stream ... }` (:267) is untouched — it now carries null.

## Step 6 — the nine guards

`src/depot/mapgen.js`, each line gains the `STREAM_ON && ` prefix inside its condition — nothing else on the line changes:

| Anchor | Line |
|---|---|
| rocks | (:89) `if (STREAM_ON && Math.abs(z - streamV) < 9) continue; // T3: rocks stay clear of the stream` |
| road bend | (:107) `if (STREAM_ON && !bridged && g.z > streamV) { pts.push([bridgeU, streamV]); bridged = true; }` |
| road bend | (:110) `if (STREAM_ON && !bridged) pts.push([bridgeU, streamV]);` |
| ponds | (:133) `if (STREAM_ON && Math.abs(z - streamV) < rad + 10) continue; // T3: ponds stay clear of the stream` |
| hills | (:144) `if (STREAM_ON && Math.abs(hv - streamV) < hr + 10) continue;` |
| big forms | (:200) `if (STREAM_ON && Math.abs(z - streamV) < rad + 9) continue;` |
| benches | (:223) `if (STREAM_ON && Math.abs(z - streamV) < rad + 9) continue; // T3: bench buildings stay clear of the stream` |
| old ruins | (:234) `if (STREAM_ON && Math.abs(z - streamV) < 9) continue; // T3: old ruins stay clear of the stream` |
| field walls | (:255) `if (STREAM_ON && Math.abs(z - streamV) < rad + 9) continue;` |

Nothing else in mapgen.js changes: the carve (:359 `if (STREAM)`), the grid branch (:428), `streamAt` (:444 `if (!STREAM) return false;`) and `planTrees` already go quiet on their own. `DepotGame.jsx`, `squads.js`, `renderer.js`: untouched.

## Step 7 — the keystone re-pins (measured, the map legitimately moved)

`scripts/tests/05-the-front.mjs` (:578-579; these sit ~38 lines earlier once Step 1 shrinks the T3 block — match the text, not the number):

```js
  const T6_HASH = 1818478037;   // was 843448507 (the stream switched off, mk1.94)
  const T6_DRAWS = 461;  // was 749 (the stream switched off, mk1.94)
```

## Step 8 — the gates (run ONLY these)

- `node scripts/depot-test.mjs` — PASS, **exactly 1675 PASS / 0 FAIL** (count the PASS lines); the keystone line prints `hash=1818478037 draws=461`.
- `node scripts/depot-lint.mjs` — PASS (the task draws no rng; the flag is a const).
- The standing smoke run — `npm run build && npm run preview`, then `node scripts/smoke.mjs` — green. (Build here is the gate's; the deploy build in Step 10 follows the version bump.)

Any failure outside this plan's named expectations stops the task.

## Step 9 — the README keeps its word

`README.md` (:17): `A 180-meter square of hills, forests, a stream with one crossing, villages` → `A 180-meter square of hills, forests, villages`. (The screenshot and its caption stay — the image is what it is.)

## Step 10 — the landing

`src/version.js` → `mk1.94`; build AFTER the bump; commit; push. The report names the fixture seeds its tests rode (s×331 ×20, s×907 ×40, keystone 1000, plus the suite's standing seeds), every re-teach old → new, and every deviation as its own labeled bullet.

**The owner's live check** (his eyes are the acceptance): a fresh front — no water, no channel, no causeway, ground open where the stream ran; ponds still there and walkable; phone and desktop both (the change is world-geometry, one interface serves both).

## The re-teach ledger (behavior re-teaches ruled by the rulings above)

| Site | Old | New |
|---|---|---|
| `05-the-front.mjs` T3(a-d) | seven asserts: every seed draws a full-width stream, mid-channel blocks, causeway opens, bed/crown carve at seed 1001, twin determinism at 7717 | three asserts: no seed draws a stream, no grid cell carries water, the off-switch pinned `false` |
| `05-the-front.mjs` T5(a) | every hill's flank clears the stream | retired with the stream |
| `06-troops-physics.mjs` P6T1(a) | routes cross at the causeway on 10 seeds (s×613) | retired — no causeway to cross |
| `05-the-front.mjs` keystone | hash 843448507, draws 749 | hash 1818478037, draws 461 (measured) |

## Named exclusions

- The ponds and their ice — ruling 2, untouched.
- The dormant water machinery — kept deliberately (ruling 3), pinned by T3(e)(f)(g); not polish-queue debt.
- The water's return — a future task flips `STREAM_ON`, re-pins the keystone, and re-teaches the T3 block back; named here so the polish queue knows where the door is.
- `docs/media/wf-valley-180.png` shows a stream — a historical screenshot; phase closeout owns README imagery.
