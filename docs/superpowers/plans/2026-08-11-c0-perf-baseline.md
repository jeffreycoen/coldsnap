# COLDSNAP — Pi performance baseline (WINTER FRONT, mk0.35)

*HISTORY (stamped 2026-08-20, owner's order): this document is a record of shipped work, not authority. Design truth lives in CLAUDE.md and the ACTIVE phase's plan documents; where this file disagrees with them, it is wrong.*

*Phase C0, Task 6. Measured 2026-08-11 on the Raspberry Pi, in a real Chromium window on the real graphics chip. These are numbers, not opinions. They exist so the map-widening phase can be planned against something measured.*

**Graphics path actually used:** ANGLE / Broadcom V3D 7.1.10.2 (OpenGL ES 3.1), reported by the browser as `Google Inc. (Broadcom)`. This is the Pi's real graphics hardware, not the software fallback. The drawing numbers below are therefore usable. (The automated test suite runs on the software fallback; nothing here came from that.)

**How it was measured.** A small stopwatch now lives in the WINTER FRONT frame loop and only wakes up when the page address ends in `?perf=1`. It times two things per frame — the physics block and the drawing call — and keeps the last 4096 frames. `scripts/diag-perf.mjs` drives the browser, stages each scenario through the game's existing console hooks, and reads the buffer back. Window: 960x600, map seed 11, sixty seconds per scenario except the collapse (ten seconds). Times are milliseconds per frame. "p95" means: nineteen frames out of twenty were faster than this.

---

## Scenario A — QUIET (a fresh run, nothing fighting)

Wave one was drained the moment it was due, so no enemy ever walked on. The world is live and stepping; 1179 objects on the field, of which 1154 are the masonry blocks that make up the buildings.

| Setting | frames/s (loop) | frames/s (drawn) | physics mean | physics p95 | physics worst | drawing mean | drawing p95 | drawing worst | whole frame p95 | whole frame worst |
|---|---|---|---|---|---|---|---|---|---|---|
| 60 | 60.0 | 60.0 | 4.36 | 5.10 | 15.90 | 4.59 | 5.90 | 14.80 | 11.10 | 25.70 |
| 30 | 60.0 | 30.0 | 3.54 | 4.90 | 14.00 | 4.42 | 5.30 | 15.60 | 10.00 | 21.30 |

Both settings hold their target exactly. A 60fps frame has 16.7 milliseconds to spend; the quiet game uses about 9 of them.

## Scenario B — HEAVY (a staged mass assault)

Not a hand-played battle. Six player sniper pairs were fielded around the depot, then 120 enemy troops were dropped onto a live wave in two batches of sixty through the game's own spawn hook. About 1295 objects on the field. The fight was one-sided: by roughly forty-five seconds in the enemy had reduced the depot to nine percent standing and the run ended in a breach. The window is therefore split, because the two halves are different events.

**First thirty seconds — the fight, depot still intact:**

| Setting | frames/s (loop) | frames/s (drawn) | physics mean | physics p95 | physics worst | drawing mean | drawing p95 | drawing worst | whole frame p95 |
|---|---|---|---|---|---|---|---|---|---|
| 60 | 17.6 | 17.6 | 50.67 | 69.10 | 100.80 | 5.04 | 6.80 | 8.30 | 74.50 |
| 30 | 17.6 | 8.8 | 53.14 | 78.00 | 117.10 | 4.83 | 6.70 | 8.40 | 83.30 |

**Last thirty seconds — the depot coming down under that assault:**

| Setting | frames/s (loop) | frames/s (drawn) | physics mean | physics p95 | physics worst | drawing mean | drawing p95 | whole frame p95 |
|---|---|---|---|---|---|---|---|---|
| 60 | 4.5 | 4.5 | 215.46 | 476.80 | 518.10 | 4.80 | 6.50 | 481.30 |
| 30 | 4.3 | 2.1 | 231.52 | 426.00 | 461.00 | 4.91 | 6.70 | 428.60 |

**The full sixty seconds, for the record:** at 60 — physics mean 84.58, p95 322.00, worst 523.80; drawing mean 4.99, p95 6.80; whole frame p95 326.20, worst 523.80; 11.0 loop frames a second. At 30 — physics mean 88.11, p95 342.50, worst 461.00; drawing mean 4.85, p95 6.70; whole frame p95 347.90, worst 461.20; 10.9 loop frames a second, 5.5 of them drawn.

## Scenario C — COLLAPSE SPIKE (one building brought down)

Its own fresh, quiet run so the spike is attributable. A single six-shell burst into the depot wall; the standing-fabric reading went from 1.00 to 0.01 — the masonry genuinely came down. Ten-second window starting the instant before the burst. 1179 objects.

| Setting | frames/s (loop) | frames/s (drawn) | physics mean | physics p95 | **physics worst** | drawing mean | drawing p95 | drawing worst | whole frame p95 | **whole frame worst** |
|---|---|---|---|---|---|---|---|---|---|---|
| 60 | 15.6 | 15.6 | 58.48 | 71.50 | **147.30** | 5.04 | 7.10 | 11.30 | 76.20 | **158.90** |
| 30 | 18.7 | 9.3 | 49.24 | 65.20 | **141.60** | 4.98 | 6.90 | 7.40 | 69.80 | **141.90** |

Worst single frame of the whole session, quiet game apart: **158.9 milliseconds**, of which 147.3 was physics. That is about one tenth of a second where the picture stops.

## Object counts

Identical in every scenario: 1154 masonry blocks on the field, 1154 of them drawn. The renderer's block-drawing limit never engaged once, at any load. Total objects: 1179 quiet, about 1296 with 120 enemy troops added.

---

## What was and was not measurable

The graphics path is real, so every drawing number here is trustworthy. The physics numbers are wall-clock and would be trustworthy either way. What could not be done: no battle was reached by playing normally — the heavy scenario was staged by dropping 120 enemy troops onto the field at once through the game's own debug spawn hook, which is a harsher and faster ramp than a hand-played fight, and it ran the depot to destruction inside the sixty-second window rather than settling into a steady state. The stopwatch also brackets the physics block as one lump and the drawing call as one lump, so there is no breakdown of which part of the physics is expensive, nor which of the three drawing passes costs what — that would need a second, finer probe. Everything here is one map seed (11), one window size (960x600) and one zoom level; nothing was measured on a phone-shaped screen or at other zooms. The collapse figure is one building on one seed, not an average of many.

## What this means for the 80-metre map

- **Physics headroom: there is almost none, and it is the only thing that matters.** A quiet field of 1179 objects already spends 4.4 of the 16.7 milliseconds a 60fps frame allows. Add 120 troops and the physics jumps to 51 milliseconds — three times the entire frame budget, dragging the game to 17 frames a second before a single building falls. Widening the map multiplies exactly the thing that is already expensive.
- **Drawing headroom: large and flat.** The drawing call cost between 4.4 and 5.5 milliseconds in every single scenario — quiet, 120-man firefight, building collapse, all the same. The Pi's graphics chip is not what is slowing the game down, and the block-drawing limit never engaged. A visually bigger map is affordable; a physically busier one is not.
- **Collapse worst case: 159 milliseconds for one building, and about a tenth of a second is the number to plan against.** One building coming down costs a single frame nine times longer than a quiet one, then holds the game at roughly 17 frames a second for several seconds afterwards while the rubble settles. A whole depot demolished under assault pushes it to 430-480 milliseconds a frame — two frames a second. Whatever the wider map does, more simultaneous masonry in flight is the cliff.
