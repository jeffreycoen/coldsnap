# Task 4 combined — Amendment 2: every frame-loop line assigned, no remainder

The second stop, same shape as the first: the plan's Move B named blocks
that move but did not walk every line between them, and the agent found
screen work interleaved with sim work (the convoy teaching line and the
pre-toll countdown, lines 3194–3206). This amendment closes the class:
it assigns EVERY line of the frame loop and its supporting closures to
"moves" or "stays", it finishes the design the gaps exposed, and it
writes the tick file's exact import list. The plan plus amendment 1 stand
except where a row below says otherwise.

## The two stopped-on blocks: they STAY

Lines 3194–3206 stay in the component whole, moved only in position: they
run right after the fixed-step loop (their reads — `run.manifest.cardUp`,
`run.bellT` — live on the war and survive the move). `cue` and
`preTollSec` are screen closures and never enter the tick file.

## Design completions forced by the walk

1. **The war carries `dev`.** `bootWar` stamps `war.dev = !!opts.dev`;
   the War typedef gains it (never saved). The tick file's two `!dev`
   gates (the bell line, the census call) read `war.dev`.
2. **TickFlags gains `withdrew`.** The withdrawal block's toast ("THEY
   BREAK CONTACT", line 3216) is screen work inside moved code: the tick
   sets `flags.withdrew = true` when a withdrawal fired; the component
   toasts on the flag. The flag list is now seven booleans:
   `territory, mines, townFlags, orderPaths, dressing, bell, withdrew` —
   `mines`/`townFlags`/`orderPaths` remain riders on `territory` as the
   plan says.
3. **`spawnOne` (lines 2459–2469) moves.** The plan's Move B forgot it —
   it is the spawn block's own helper, pure sim, and moves verbatim into
   the tick file above `tickWar`.
4. **The tick file's import list, exact** — an import beyond this list
   plus amendment 1's `computeFlowField`, or a missing one, stops the
   task:

   ```js
   import { addBody } from "../engine/core.js";
   import { mechFire, mechMissiles, mechBarrage, mechPunt, mechAboutFace } from "../engine/mech.js";
   import { possessedArmorFire, possessedArmorMg, mechSighted } from "./drivers.js";
   import { stepDepot, spawnEnemy } from "./sim.js";
   import { stepBell, nextSpawnTag, withdrawDue, executeWithdrawal, checkLoss, stampEnd, stepDepotCensus, depotStandingFraction, possessedVolley, possessedTowerFire, scoreKill } from "./state.js";
   import { ringBell as ringBellOut } from "./bell.js";
   import { stepTerritory } from "./territory.js";
   import { stepSight } from "./sight.js";
   import { groundRate } from "./economy.js";
   import { stepMines, minePrices } from "./mines.js";
   import { addFogPatch, stepFog } from "./fog.js";
   import { computePrices, marketCounts, priced } from "./market.js";
   import { makeBodyLists, rebuildBodyLists } from "./lists.js";
   import { computeFlowField } from "./mapgen.js";
   import { buildEmitters } from "./boot.js";
   import { serializeRun } from "./api.js";
   ```

   The last line is a deliberate, licensed import cycle: api.js
   re-exports `tickWar` from the tick file while the tick file imports
   `serializeRun` from api.js. Both bindings are only CALLED at run
   time, never at load time, which module loading resolves cleanly. A
   load-time failure from this cycle is a stop, not a workaround.
5. **The pool rebuild (lines 3306–3309) moves** into the tick file, run
   at the top of each `tickWar` call (`if (run._hot)` rebuild, else null
   the lists). Cadence moves from once per frame to once per step — the
   pools are proven identical to the full scan they replace, so outcomes
   are unchanged; the suites arbitrate, a failure stops.

## The full assignment — frame loop and supporting closures

Every line, by today's numbers at commit e8938d8. "Stays" means verbatim
in the component, position preserved except where a row says it runs
after the tick loop.

| lines | what | verdict |
|---|---|---|
| 2173–2177 | cue queue, `cue`, `preTollSec` | stay |
| 2179–2205 | `saveFront`, `burnSave` | stay (plan) |
| 2210–2211 | `bellCtx`, `ringBell` closure | stay as `input.bellCtx` source (plan); the `ringBell` wrapper line is DELETED — the tick calls `ringBellOut` itself |
| 2459–2469 | `spawnOne` | MOVES (this amendment) |
| 2471–2500 | `breachRock` | MOVES minus its renderer line and toast (plan) |
| 2501–2549 | `drainEvents` | MOVES minus the teach line (plan) |
| 2551–2873 | the debug-harness hooks | stay; hooks whose bodies call moved closures (`__DEPOTSPAWN__` calls `spawnEnemy` directly — unchanged; none calls spawnOne/drainEvents/breachRock) are untouched |
| 2875–2964 | loop scaffolding, stopwatch, `feedMechCommands` | stay |
| 2965–2978 | frame head, fps | stay |
| 2979 | `stampEnd` | MOVES |
| 2980–2996 | burn, `cardUp`, `convoyUp`, `teachUp`, `sdt`, pan math head | stay |
| 2997–3187 | rotation keys, pan, possession focus/drive, reticle, hover, inspect, selection ring | stay |
| 3188 | `const ws = run.ws;` | MOVES (the spawn block reads it; inside the tick it reads `war.run.ws`) |
| 3189–3192 | the started/over guard and the clock comment | MOVES (the guard wraps only the moved bell/spawn/income lines inside the tick; the component's stayed blocks 3194–3206 keep their own copy of the same guard — one added line, listed in the substitution table below) |
| 3193 | `stepBell` + ring | MOVES minus the two view calls (plan); `!dev` reads `war.dev` |
| 3194–3206 | convoy teach + pre-toll | STAY, run after the tick loop under their own `if (run.started && !run.gameOver && !run.victory)` guard |
| 3207–3217 | spawn timer / withdrawal | MOVES; toast → `flags.withdrew` |
| 3220–3221 | income | MOVES |
| 3223 | `view.acc += sdt` | stays |
| 3224 | `terrAcc += sdt` | MOVES (`war.clock.terrAcc`, fed the tick's own `sdt`) |
| 3225–3243 | territory loop, sight, ground rates | MOVES; sets `flags.territory` |
| 3244–3247 | `R.updateTerritory` | stays, keyed on `flags.territory` |
| 3248–3251 | `stepMines` + `R.setMines` | `stepMines` MOVES; the renderer line stays on the flag |
| 3252–3267 | town-flag rows + `R.setTownFlags` | stay, keyed on the flag |
| 3268–3269 | `stepFog` | MOVES |
| 3270–3276 | dead-bag release | MOVES |
| 3277–3292 | order-path overlay | stays, keyed on the flag |
| 3293 | events wipe | MOVES (top of `tickWar`) |
| 3294 | stopwatch open | stays |
| 3295–3309 | pool-rebuild comment + gate | MOVES (design completion 5) |
| 3310–3312 | the accumulator `while` head | stays — its body becomes the `tickWar` call (plan step 5's code) |
| 3313–3319 | mech feed | MOVES as `input.feedMech` call inside the tick (plan) |
| 3320 | `stepDepot` call | MOVES (plan + amendment 1) |
| 3321–3367 | the four possessed-trigger blocks | MOVE |
| 3368–3370 | loop close, stopwatch, acc clamp | stay |
| 3371–3379 | selection pruning | stays |
| 3380 | `drainEvents()` call | MOVES (inside `tickWar`, its events returned) |
| 3381–3384 | zap counter, cue merge | stay, reading the returned events |
| 3385–3393 | census call | MOVES; `!dev` reads `war.dev` |
| 3394–3403 | market accumulator | MOVES |
| 3404–3407 | `R.consume`/`A.*` | stay, fed the frame's collected events |
| 3408–3756 | reticle ring, overlays, render, projections, interface refresh, stopwatch | stay |

## Substitution table — added rows

| moved text | becomes | where |
|---|---|---|
| `!dev` (the two moved gates) | `!war.dev` | tick.js |
| `toast("THEY BREAK CONTACT")` line | deleted; `flags.withdrew = true` | tick.js |
| `terrAcc` | `war.clock.terrAcc` (amendment of the plan's same row — unchanged) | tick.js |
| `ws` (bare, line 3188's alias) | `war.run.ws` via the same one-line alias inside `tickWar` | tick.js |
| the component's re-guard over 3194–3206 | one added line: `if (run.started && !run.gameOver && !run.victory) { ... }` around the two stayed blocks | DepotGame.jsx |

## What does not change

Move A, boot.js's import list, amendment 1, the gates, the acceptance
arithmetic, the mark, the commit subject, the step-7 test list — except
that 23-the-sandbox's two tick pins and 11-hiring-hall's bell pin now
re-point per THIS amendment's rows (same re-point rule, no new pin-text
changes beyond the two the plan already names).
