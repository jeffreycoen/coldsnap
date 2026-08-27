# WINTER FRONT — The Settled Ground (fresh skeleton)

*ACTIVE (owner, 2026-08-26): this skeleton governs the phase; the 2026-08-25 skeleton is superseded and is not used. Written by Claude Fable 5 against mk2.60 (commit b12611b) after a full read of every affected file; rulings taken and amended by the owner through the day are recorded in place. Task plans are written one at a time on the owner's word and served alone.*

## Status

| # | Task | Mark | Plan file | State |
|---|------|------|-----------|-------|
| 1 | The stone count | mk2.61 | `2026-08-26-the-settled-ground-task-1-the-stone-count.md` | LANDED (069fb5e) |
| 2 | Born ruins | mk2.62 | `2026-08-26-the-settled-ground-task-2-born-ruins.md` | LANDED (f47b0fc) |
| 3 | The settled valley (forms + placement, amendments 1-4) | mk2.63 | `2026-08-26-the-settled-ground-task-3-the-settled-valley.md` | LANDED (5daac70) |
| 4 | The full valley (fill dials, one ledger) | mk2.64 | `2026-08-26-the-settled-ground-task-4-the-full-valley.md` | LANDED (a0cce91), owner: okay for now |
| — | Closeout: README re-measured, screenshots re-checked | — | — | on the owner's word |

Every deploy bumps `src/version.js` first, builds after. One agent in the tree at a time; stop after every task.

## The measurements this phase rests on

Taken on the mk2.54 tree. `mapgen.js`, `DepotGame.jsx`, and `renderer.js` have no commits since, so they hold today.

- Buildings a map, field walls aside: 7 to 24, average 13.9. Ruins among them: 0 to 8, average 3.0. Big forms 2 to 4. Field walls 2 to 5, at 15.4 stones a wall.
- Town stones a map: 571 to 2,018 over seeds 1 to 120, average 1,124. Over seeds 1 to 500 the densest plans 2,092 town stones, 2,268 boot bodies with the two depots' 176.
- Stones a template, whole: croft 36, watch 33, yard 32, shed 46, granary 59, house 5×4 70, long 92, house 6×5 104, hangar 115, chapel 124, warehouse 146, keep 156.
- The draw pool and the stone cap are one constant, `CHUNK_CAP` 3000 (`renderer.js:934`). The stones counter on the top bar is the alarm.
- The suite stands at 2,045 checks. Test era files run to 32; the new era file is `scripts/tests/33-the-settled-ground.mjs`.

## The rulings this skeleton takes

Rulings 1, 3, and 5 were taken by the owner, 2026-08-26 (this draft's question round). The rest are re-ratifications of the prior skeleton's leans.

1. `TOWN_STONE_CAP` is 3,000 town stones and `CHUNK_CAP` rises 3,000 → 4,000 (owner, 2026-08-26). Physics is indifferent — every town stone boots asleep and the integrator skips sleepers; the pool is a draw limit, and 4,000 covers 3,000 town + the depots' 176 + ~820 of transient rubble headroom. The pool raise is a one-constant renderer divergence, golden green, landing in Task 1 with the cap. PROVISIONAL until the Pi collapse capture judges the draw cost at the new ceiling — the capture runs before Task 4 ships, and a failed capture lowers both numbers together.
2. A born ruin flies no flag, blocks no cell, and pays no side. Men path through it. Its low courses and its rubble are cover. It is `ruined: true` from its first frame, so every existing skip — the flag rows, the pay loop, the collapse watch, the open cells — takes it without new law.
3. **The marker rule (owner, 2026-08-26, amended same day).** Forms under 10 stones are markers — no flag, no pay, the field walls' standing — covering the wayside cross and the chimney. **The well is the named exception: it flies a holder flag and pays like any building** — a hamlet's center is worth holding. The rule is an explicit flag on the form (`marker: true`), not a stone-count threshold, so the well's exception costs no second mechanism.
4. One town on a road, two or three hamlets, one or two dead hamlets, one to three singles, the big forms and the field walls as now.
5. **The form roster (owner, 2026-08-26).** The row houses, the inn, the smithy, the well, the mill, the bell tower, the wayside cross; the spur shed is cut. Added: the **walled graveyard** (chapel's child — a roofless yard with one-stone columns as headstones; low cover with gaps), the **gate arch** (two columns and a lintel on a road at the town's edge), the **springhouse** (2×2×2 beside a pond). Ruin forms as designed: the shell, the stump, the rubble mound, the chimney.
6. Symmetry: the ground is neutral. Both sides fight in the same town. No asymmetry is opened by this phase.

## The tasks

**Task 1 — The stone count (mk2.61).** `mapgen.js` gains `stoneCount(t)` — the count of what `buildTown` lays for a town entry by the builder's own lay rules (the non-depot branch, `DepotGame.jsx:317-367`: perimeter, roof, corners, door carve, drive carve, decay hash, columns, slab) — and `TOWN_STONE_CAP` 3000. `CHUNK_CAP` rises to 4,000 in the same task (ruling 1): one renderer constant, golden green, the stones counter reading n/4000 from this mark on. The new era file `33-the-settled-ground.mjs` pins the count against a headless `buildTown` on every building over 200 seeds, pins the twelve template costs, and asserts no seed plans past the cap over 500 seeds — the cap over the whole sweep, no seed named or pinned. Nothing on screen changes. Gates: depot-test, depot-lint. Suggested model: Sonnet — one pure function, fully specified.

**Task 2 — Born ruins (mk2.62).** A town entry may be born dead: `dead: true`. `buildTown` lays it by one of four ruin forms instead of the decay hash — the shell (two courses whole, the third ragged at forty percent, no roof), the stump (one corner to full height, the rest one course, no roof), the rubble mound (loose stones on the footprint, a quarter of the whole form, sleeping, unwelded), the chimney (a one-stone column, five high, welded). Seams, verified in the read:

- `ruined: true` in `buildTown`'s output row (`DepotGame.jsx:381`) and the footprint claim skipped (`:369-370`) — the restore path already leaves ruined cells open (`:1161`); boot follows the same rule.
- `stepTown` already skips ruined (`:388`); the flag rows already skip ruined (`:3860`); town pay already skips ruined (`economy.js:16`) — a born ruin pays neither side, knowingly.
- Mound stones carry `b.town` — the sweep at `DepotGame.jsx:655` deletes sleeping town-less chunks after 14 seconds, and a mound must not evaporate.
- The old-ruin entries (`oldruin`, `mapgen.js:244`) become born shells.
- Rubble and low courses are sight cover for free: chunks are in the sight solids set (`sight.js:63`).
- The save carries `ruined` as it does today (`save.js:290`); nothing new in `save.js`; a save from another mark is refused as always.

`stoneCount` learns the four forms and the equality pin holds. A headless scenario marches a rifle squad across a rubble mound and asserts arrival within a bound — the per-stone steer-around fan (`squads.js:424-465`) is the machinery under test; if the bound fails the task stops, the movement rules untouched. Gates: depot-test, depot-lint, smoke. The owner's live check: a shell, a stump, a mound, and a chimney on one fixture seed; no flag over any of them; a squad walks through; phone and desktop. Suggested model: Fable — four body-laying rules and the crossing bound need judgment at plan time.

**Task 3 — The settled valley (mk2.63, owner's order: the forms and the placement together, no separate test task).** The new forms AND the cluster placement in one task; the tests this task breaks are re-taught to the random ground rule in the same stroke. Plan: `2026-08-26-the-settled-ground-task-3-the-settled-valley.md`. The old Task 3 (test-only) and the separate forms/placement split are withdrawn. The prose below describing the old Task 4 and Task 5 stands as design reference only.

**(Reference — formerly Task 4) The new forms.** The `TPL` table gains the roster ruling 5 fixes. Three rules join `buildTown` and `stoneCount` together: partition walls (`parts`), a child entry placed against its parent (the yard, the chimney, the tower, the headstone field), and columns of one stone. The marker rule of ruling 3 lands here: sub-threshold forms join the flag-row and pay-loop exclusions beside `fwall` (`DepotGame.jsx:1228`, `economy.js:16` reads `ruined` so markers carry a flag of their own or ride the same meta exclusion — the plan fixes the mechanism). One named seam: `A.setReflectors` (`DepotGame.jsx:1349-1352`) registers every town entry as an audio reflector at footprint size — the plan sizes or excludes the one-stone forms so a cross does not echo like a keep; the owner's ear judges the result. Placement stays the bench scatter; the forms join the draw, so every seed redraws and the keystones re-pin, old to new, draw counts included. Gates: depot-test, depot-lint, smoke. The owner's live check: each form on a fixture seed, phone and desktop. Suggested model: Sonnet — data and three shape rules, fully specified once Task 2's forms stand. (Renumbered mk2.64 when the random ground joined as Task 3.)

**(Reference — formerly Task 5) The placement rule.** The bench scatter retires. `mapgen.js` places clusters: one town on a road on the middle bench (a map with no road sets its town on the middle bench without one), doors to the road, the chapel or the inn at the center, the gate arch at the road's edge; two or three hamlets of two to four crofts and sheds around a yard or a well, off the roads; one or two dead hamlets of two or three born ruins with a mound and a chimney, by the stream or against a hill; one to three singles; the big forms and the field walls as now. Constraints, verified in the read:

- The generation draw order is a contract (depots → big forms → benches → old ruins → field walls, `mapgen.js:167-276`); clusters replace the bench and old-ruin loops in place, and every keystone re-pins old to new.
- Every existing foul check stays (passes, spawns, ponds, rocks, roads, the stream, each other); the plan may hoist the seven checks into one shared vet.
- `makeMap`'s retry predicate holds: town minimum, depot spacing, and both connectivity floods (`mapgen.js:304-307`) — a cluster must never seal a spawn from the objective or depot2's door.
- Placement stops when planned stones reach `TOWN_STONE_CAP`; the terrain pad flattening (`mapgen.js:345-354`) takes clusters as-is.
- Each cluster carries a center and a radius on a new `CLUSTERS` export, so later work can name the ground.
- The sweep pins of era 05 (big forms 2 to 4, field walls 2 to 5, both big kinds across 40 seeds, worst boot under 2,900) re-teach only where this task moves them, each old to new; the plan carries the inventory.
- Cluster counts are an income dial as well as a look dial: dead hamlets pay nobody, so a seed's held-ground pay shifts with its cluster draw. Symmetric; named so later tuning is not a surprise.

Gates: depot-test, depot-lint, smoke, golden unmoved. The owner's live check: a town, a hamlet, and a dead hamlet on one seed read as places, phone and desktop; the stones counter reads within the pool on whatever seed he boots. Suggested model: Fable — reshapes every seed; cluster geometry against seven foul checks; the re-pin inventory.

**Closeout.** The README's valley screenshots and its counts re-checked against the shipped game by standing order; the check count re-measured; the polish queue takes what this phase deferred.

## Standing constraints

- All dials provisional: the cap, the cluster counts, the marker threshold, the rubble quarter, the ragged forty percent.
- No `Math.random` in `src/depot`; every draw seeded; draw counts pinned old to new where a task moves them (Tasks 3 and 4). Tasks 1 and 2 move no draw.
- Engine (`core.js`) untouched by every task. Renderer untouched except Task 1's one-constant `CHUNK_CAP` raise (ruling 1); golden green throughout.
- Saves never migrated: `ruined` already rides the save; a save from another mark is refused as always.
- Test only what changed; run only the gates the brief lists; every report names its fixture seeds.
- **The random ground rule (owner, 2026-08-26): no specific seeds in tests.** Sweeps draw their maps at random each run, and checks assert laws that hold on any map — never exact totals, never a named seed. Randomness is the point: it is how the interesting maps get found. Each run logs the seeds it happened to draw, so a red is still traceable.
- Phone and desktop, every visual task.
- The stones counter stays the alarm, reading against the 4,000 pool. The 3,000/4,000 pair is provisional on the Pi collapse capture, which runs before Task 4 ships; a failed capture lowers both together. Nothing on screen changes at Task 1 — no planned count today reaches the cap, so the raised pool draws exactly what the old one did until Task 4's clusters use the room.

## Deferred out of this phase

- The remaining form menu: the byre, the bakehouse, the manor, the kiln, the tower house, the roadside shrine — one data row each once Task 3's rules stand.
- The spur shed and drive-through barns: join by the same rules when the owner wants them.
- Named copses: mapgen emits tree positions, not copse centers; centers are kept at generation when the owner wants them.
- Any tuning of the sight law over one or two courses of a shell.
- Any change to the movement rules; Task 2 measures the crossing and stops if the bound fails.


## Closing state (2026-08-27, session end)

Landed and live: mk2.61-mk2.68 plus the README closeout and the retaken valley screenshot (commits through 7562e40). Tasks 6-8 (the carpenter, the road painted, the ridge set right) have their own plan files dated 2026-08-27.

Open on the book, owner-acknowledged "fine for now":
- **THE PI MEASUREMENT (2026-08-27): the war runs at 20 fps on the Pi 5** at the crowded valley's density (~5,400 stones) — measured on real V3D hardware with a healthy 61 Hz browser loop. The phone runs 60. Every raised cap (6,000 stones / 7,000 pool / 800 trees) is provisional against this. Diagnosis path: the ?perf=1 stopwatch splits sim cost from draw cost per frame.
- The armor-lane latent (since mk2.64): some maps offer hulls no drivable lane across the valley; foot always connects; enemy armor rams; player hulls stand.
- The README screenshot shows the settled valley but was captured under software rendering; a 60-fps capture waits on the Pi finding.
- Polish queue candidates named in the plans: gate-arch lintel pairing, mound look, cluster counts as income dials, turning mill sails.
