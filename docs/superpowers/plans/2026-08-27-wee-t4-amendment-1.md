# Task 4 combined — Amendment 1: the two callbacks and the routing recompute

The agent stopped at required reading, correctly: the plan moves the
`stepDepot` call into `tickWar`, but two of its arguments —
`onStructureLost` (DepotGame.jsx line 1818) and `onRuin` (line 1822) —
are component closures the plan never accounted for. Both wrap one thing:
`recomputeFlow`, the routing-field recompute, itself one line over the
grid. This amendment resolves it. Everything else in the plan stands.

## The change

1. **tick.js builds the two callbacks itself.** At the top of `tickWar`'s
   module (once per war, cached on `war.clock._cbs`), verbatim from the
   component with reads off `war.`:

   ```js
   function warCallbacks(war) {
     if (war.clock._cbs) return war.clock._cbs;
     const { grid, map } = war;
     const objG = grid.worldToGrid(map.OBJ_POS.x, map.OBJ_POS.z);
     const recomputeFlow = () => computeFlowField(grid, objG.gx, objG.gz);
     const onStructureLost = (b) => {
       for (const c of grid.cells) if (c.wallId === b.id) { c.wallId = null; c.blocked = false; c.bTeam = 0; }
       recomputeFlow();
     };
     const onRuin = () => recomputeFlow();
     war.clock._cbs = { recomputeFlow, onStructureLost, onRuin };
     return war.clock._cbs;
   }
   ```

   `computeFlowField` joins tick.js's import list from `./mapgen.js`.
   The moved `stepDepot` call reads them:
   `const cbs = warCallbacks(war);` then
   `stepDepot(world, grid, cbs.onStructureLost, town, cbs.onRuin, T, input.discipline, run, input, map);`
   Also `breachRock`'s moved body calls `cbs.recomputeFlow()` where the
   component's `recomputeFlow()` stood.

2. **The component keeps its own copies unchanged.** Its `recomputeFlow`,
   `onStructureLost`, and `onRuin` (lines 1086, 1818, 1822) stay exactly
   as they are — its placer and sell paths still call them. The two
   copies are the same one-line arithmetic over the same grid; nothing
   diverges. The component's `onStructureLost`/`onRuin` simply lose their
   one caller in the moved code; if the build then reports them unused,
   they are NOT deleted — the plan's step-1 tree check expects no such
   cleanup, and they remain called by nothing only until the sell path
   check: verify with `grep -n "onStructureLost\|onRuin(" src/depot/DepotGame.jsx`
   at execution — the sell and ruin paths outside the moved region keep
   them live. If that grep shows them truly orphaned, that is a finding:
   report it, delete nothing, continue.

3. **The substitution table gains one row.**

   | moved text | becomes | where |
   |---|---|---|
   | `onStructureLost` / `onRuin` / `recomputeFlow` (reads inside moved code) | `cbs.onStructureLost` / `cbs.onRuin` / `cbs.recomputeFlow` | tick.js |

## What does not change

The inventory ranges, the import list of boot.js, the step order, the
gates, the acceptance arithmetic, the mark (mk2.74), the commit subject.

## Acceptance

Unchanged from the plan. The headless proof exercises both callbacks
(structures fall and towns ruin inside 90 seconds only if the seed says
so — the 2,089 suite is the real arbiter of the callback plumbing).
