# P7 Task 19 — the muster moves out (mk1.49)

*HISTORY (stamped 2026-08-20, owner's order): this document is a record of shipped work, not authority. Design truth lives in CLAUDE.md and the ACTIVE phase's plan documents; where this file disagrees with them, it is wrong.*

*2026-08-18. Reorganization 2 of 5: the fresh-war boot block — armor parking with its flatness vetting, the seeded bag rings, the home guard, the commander draw, the fielded start — moves out of DepotGame's mount into `src/depot/muster.js`. Unlike mapgen this code lives in mount closures, so the move is VERBATIM BODIES WITH EXPLICIT PARAMETERS: each closure variable becomes an argument, nothing else changes, and every token substitution is named below. This block is where both of this pass's boot bugs hid — because fixtures could only REIMPLEMENT it; extracted, the suite calls the real thing, and this plan adds the first true boot-block fixture. Zero behavior change: boot draw order and count (45) unchanged, all existing pins green untouched.*

**Suggested model: Sonnet** — a mechanical extraction with a named substitution table.

**Scope:** new `src/depot/muster.js`; `src/depot/DepotGame.jsx`; `scripts/depot-test.mjs`; `src/version.js`. Nothing else.

## The moving inventory (DepotGame.jsx, live anchors)

- `spreadAt` (862–870) and `stableAt` (871) → exported as `armorSpread(field, bx, bz, spec)` / `armorStable(field, bx, bz, spec)`.
- `parkArmor` (873–~923, through the fail-proof brute sweep) → `parkArmor(world, grid, field, depotT, team, kind, nextSeq)`.
- `seedBags` (1102–~1140) → `seedBags(world, grid, depotT, streamKey, stampBag)`.
- The `!RES` fresh-start block: home guard + commander draw + fielded start + enemy fielded (1314–~1360, from the THE HOME GUARD comment through the enemy fast/heavy loop's close) → `musterFreshStart(world, S, depotP)`.

**What stays in the mount:** `let apcSeqN = 0;` and the resume reseed loop (the T9(d11)-pinned literal — untouched); `stampBag` (821 — the engineer lay and the resume path still use it); `depotP`/`depotE` lookups; every call site, rewired.

## The substitution table (the ONLY changes inside moved bodies)

| In | Old token | New token |
|---|---|---|
| parkArmor | `spreadAt(bx, bz, spec)` / `stableAt(...)` | `armorSpread(field, bx, bz, spec)` / `armorStable(field, ...)` |
| parkArmor | `++apcSeqN` | `nextSeq()` |
| parkArmor | *(signature)* `(team, depotT, kind)` | `(world, grid, field, depotT, team, kind, nextSeq)` |
| seedBags | *(signature)* `(depotT, streamKey)` | `(world, grid, depotT, streamKey, stampBag)` |
| musterFreshStart | *(signature — new wrapper around the verbatim block)* | `(world, S, depotP)` |

Everything else in every body — comments, dials, draw order, TOWN/ROADS/MAP_SEED/OBJ_POS/GRID_W/GRID_H reads (now module imports from mapgen.js, same live bindings), spec reads, the exact rng call sequence — is byte-identical.

## Required reading, in order (verify anchors before code)

1. `src/depot/DepotGame.jsx` 850–930 (the hoist comment, spreadAt/stableAt/apcSeqN/parkArmor — confirm parkArmor's close), 1095–1145 (seedBags and its two call sites just below), 1310–1365 (the `!RES` fresh-start block — confirm its exact close at the enemy fielded loop), 821–830 (stampBag), and every `parkArmor(` call site (grep: boot ×4, the hero buy, the enemy replacement).
2. `src/depot/mapgen.js` — the export list (TOWN, ROADS, MAP_SEED, OBJ_POS, GRID_W, GRID_H are importable live bindings; makeMap for the new fixture).
3. `src/engine/core.js` — confirm `heading` is exported (parkArmor's parked-facing quaternion); if it is not, STOP and report — do not re-derive it.
4. `scripts/depot-test.mjs` — T9(d10)/(d11) (the seat-reseed pins — mount literal stays), T9(e) (the fielded-start reimplementation fixture — stays as-is this task), T17(f2) (the stampBag regex — verify whether the engineer-lay site still satisfies it on dgSrc; retarget to muster.js only if not), the T18 block end (insertion point).

## Trap notes

- **Draw order is the contract.** The mount must call the extracted functions in the exact current sequence (bags → armor ×4 → … → musterFreshStart), and musterFreshStart's internal order (guard 24 draws → commander 1 → fielded 18) is byte-fixed. Boot draws stay 45; the T9(e3)/(f)/(f2) pins prove it.
- **`apcSeqN` stays a mount let.** The resume-reseed literal is pinned by T9(d11) — the mount defines `const nextApcSeq = () => ++apcSeqN;` and passes it. Do not box the counter.
- **muster.js imports:** mapgen.js (TOWN, ROADS, MAP_SEED, OBJ_POS, GRID_W, GRID_H), core.js (addBody, heading, mulberry32), specs.js (BISON, APC, MASON), squads.js (clearSlot, makeSquad, slotBlockedPublic), units.js (spawnUnit), state.js (spawnSandbag, spawnSquadMembers, SANDBAG_HX), ai.js (cmdrOf). Never DepotGame.
- **stampBag is passed in, not moved** — it serves two other masters (the engineer lay, the resume re-stamp) that stay behind until their own tasks.
- **Zero re-pins expected.** Suite edits, if any, are retargets (T17(f2) at most). Anything else moving is a defect signal — STOP.

## Steps

**Step 1 — the failing asserts land first.** After the T18 block:

```js
// ==== P7 T19: THE MUSTER MOVES OUT ===========================================
// Reorganization 2 of 5 (owner): the fresh-war boot block lives in muster.js,
// verbatim bodies with explicit parameters. Boot draws stay 45 by pin; and
// the boot block gets its FIRST real fixture — the suite calls the actual
// code instead of reimplementing it (how both boot bugs hid).
{
  ok("T19(a): muster.js owns the boot block",
    /export function parkArmor\(world, grid, field, depotT, team, kind, nextSeq\)/.test(muSrc19) &&
    /export function seedBags\(world, grid, depotT, streamKey, stampBag\)/.test(muSrc19) &&
    /export function musterFreshStart\(world, S, depotP\)/.test(muSrc19) &&
    /export function armorSpread\(field, bx, bz, spec\)/.test(muSrc19));
  ok("T19(a2): DepotGame no longer defines what it now imports",
    !/const parkArmor = /.test(dgSrc19) && !/const seedBags = /.test(dgSrc19) &&
    !/THE HOME GUARD \(owner\)/.test(dgSrc19) && /from "\.\/muster\.js"/.test(dgSrc19));
  ok("T19(a3): the seat counter stays a mount let with its pinned reseed",
    /let apcSeqN = 0;/.test(dgSrc19) && /const nextApcSeq = \(\) => \+\+apcSeqN;/.test(dgSrc19));
  // (b) the boot block, called for real — the first true muster fixture.
  {
    makeMap(4242);
    const flatF19 = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (x, z, o) => { o.x = 0; o.y = 1; o.z = 0; return o; } };
    const w = makeWorld({ field: flatF19, seed: 4242 });
    let draws = 0; const raw = w.rng;
    w.rng = () => { draws++; return raw(); };
    const S19 = { reg: { heads: 60 }, squads: [], nextSquadId: 1, cmdr: null };
    musterFreshStart(w, S19, TOWN.find((t) => t.depot && t.team !== 2));
    ok("T19(b): the fresh start draws exactly 43 (guard 24 + commander 1 + fielded 18)", draws === 43, draws);
    ok("T19(b2): two player squads muster — runners of 4, breakers of 2",
      S19.squads.length === 2 &&
      S19.squads.find((q) => q.type === "runners").memberIds.length === 4 &&
      S19.squads.find((q) => q.type === "breakers").memberIds.length === 2);
    let guard = 0;
    for (const b of w.bodies) if (b.kind === "unit" && b.team === 2 && b.garrison && b.alive) guard++;
    ok("T19(b3): fourteen enemy standers hold their ground (8 guard + 6 fielded)", guard === 14, guard);
    ok("T19(b4): the commander was drawn", S19.cmdr === "cautious" || S19.cmdr === "bold" || S19.cmdr === "stubborn", S19.cmdr);
    ok("T19(b5): the books stayed honest", S19.reg.heads === 52, S19.reg.heads);
  }
}
// ==== end P7 T19 =============================================================
```

`muSrc19`/`dgSrc19` via the suite's source-read idiom (muster.js may not exist yet — the T18 fallback pattern); `makeMap`/`TOWN`/`musterFreshStart` join the suite's imports (mapgen.js and muster.js). If `makeMap(4242)` perturbs later fixtures that read mapgen's live state, run this block LAST inside its own scope or re-run makeMap with whatever seed the neighboring blocks expect — verify against the suite's existing mapgen-state usage and state what was needed. Run — T19 fails. Report the failing output.

**Step 2 — muster.js is born.** Create it with a header in the mapgen.js style (name the precedent, the parameter rule, the draw-order contract), the import list from the trap notes, then the four functions: bodies verbatim from the inventory lines, substitutions ONLY per the table.

**Step 3 — the mount rewires.** In DepotGame.jsx:
- Delete the moved definitions (862–~923 and the seedBags definition); keep `let apcSeqN = 0;` and add beside it: `const nextApcSeq = () => ++apcSeqN;`
- Every `parkArmor(team, depotT, kind)` call becomes `parkArmor(world, grid, field, depotT, team, kind, nextApcSeq)` — boot ×4, the hero buy, the enemy replacement (grep for all; the argument order pivots team behind depotT per the new signature).
- The two `seedBags(depotT, key)` calls become `seedBags(world, grid, TOWN.find(...), key, stampBag)` — same lookups as today, threaded.
- The `!RES` fresh-start block's body is replaced by `musterFreshStart(world, S, depotP);` (the `if (!RES)` gate and its neighbors stay).
- The import block gains: `import { armorSpread, armorStable, parkArmor, seedBags, musterFreshStart } from "./muster.js";` — then one build run as the reference-closure check; unresolved names join imports, never local re-declarations.

**Step 4 — the suite follows.** Sweep every dgSrc regex/slice over the moved text: T17(f2) retargets to muster.js ONLY if the engineer-lay site no longer satisfies it on dgSrc (verify first); T9(d10)/(d11) stay (mount); T9(e)/T12(b) fixtures stay (primitive reimplementations, converted at mk1.52 if at all). List every retarget.

**Step 5 — gates.** `node scripts/depot-test.mjs` (all green — T19 included; T9(e3)/(f)/(f2) unmoved; the T6 keystone untouched at 3465970090/695), `node scripts/depot-lint.mjs`, the build, `node scripts/smoke.mjs`. Nothing else. Golden does NOT run. Zero re-pins expected — any that move: STOP and report before touching them.

**Step 6 — the landing.** Bump `src/version.js` to `mk1.49`. Build AFTER the bump. Commit: `the muster moves out: muster.js, verbatim bodies, explicit hands (mk1.49)`. Push. Report: read-confirmation opening, gate results with keystone and boot-draw pins stated, the retarget list, every deviation labeled.

---

## Amendment 2 (2026-08-18, after the agent's honest stop — owner-reviewed before resume)

**A. Five pre-existing literal-text pins join the Step 4 sweep** — the plan-writer's sweep named only T17(f2); these five pin the exact call shapes the plan's own Step 3 ordered changed. Each is a retarget or re-teach of this task's change, old → new reported:
- `mk0.60/6`: the `/mulberry32\(MAP_SEED \^ streamKey\)/` regex retargets to muster.js source; the old-arity `seedBags(TOWN.find(...), 0x5ba6);` call literal re-teaches to the new-arity call shape on DepotGame source.
- `T3 "the seeded depot bags are untouched"`: the `/spawnSandbag\(world, bx, bz,/` regex retargets to muster.js source (the call lives inside the moved seedBags).
- `T9(d6)`/`(d7)`: the ringBellBody extraction's literal `parkArmor(2, depotE4, "bison")` / apc pins re-teach to the new signature literals (`parkArmor(world, grid, field, depotE4, 2, "bison", nextApcSeq)` and the apc twin).
- `T9(d8)`: the same two literals' ordering check follows them.
The asserted CONTENT of all five is unchanged — same stream seed, same bag call, same replacement order.

**B. Two forced deviations ratified as taken:** `armorSpread` as a function declaration (the plan's own Step 1 regex requires the form); the THE HOME GUARD comment block moving with its block into muster.js (the plan's own Step 1 assert requires its absence from DepotGame).

Everything else stands as written. Resume from Step 4's completion: apply A, then Step 5's gates and Step 6's landing.
