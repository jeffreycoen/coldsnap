# T74: the frame split (0.5.69)

The physics step no longer lands on one frame. It becomes a four-chunk machine — the sky's forces, the first half of the solver sweeps, the second half, and the tail of welds, wounds, drift, and the eaters — and the chunks spread across the frames of the step's window. The screen glides between the last two COMPLETED steps, one step behind the arithmetic (a third of a second at game speed), and never shows half-computed work: the display pair shifts only when a new window opens, so each glide finishes to its exact end before the next begins. The worst single frame now carries one chunk instead of the whole step.

- The step function becomes a generator with three cut points; a chunk runs to the next cut and pauses with all its working state held in place. Called whole — as the gates and the battery call it — it still runs start to finish in one call, and the battery below proves the arithmetic is byte-identical: it prints exactly the last task's numbers.
- The component schedules the chunks across the window: at a sixteenth speed, four chunks over sixteen frames; at faster speeds the schedule compresses, down to all four on one frame at half speed's two-frame window.
- Pausing or aiming freezes the machine mid-step and it resumes where it stood; a speed chip flipped mid-step applies from the next step.
- The drawing reads a display pair — previous completed position toward last completed position — for blocks, stars, and the ship's camera anchor alike.

Design choices, stated plainly: four chunks and their three cut points; the one-step display lag; the shift-at-window-open rule. Seed 12345 is the fixture. Acceptance pins the battery to the LAST TASK'S EXACT numbers — that identity is the whole proof of faithfulness.

The substitution script was applied to a fresh copy of the live tree at plan-writing time: every anchor hit its exact count, all three files parse, and the battery reproduced the identical numbers below.

## Required reading

- This plan, whole.
- `src/game/gravitydebris/phys.js` — the step function, whole.
- `src/game/GravityDebris.jsx` — the loop's step-execution block.
- `src/game/gravitydebris/draw.js` — the glide functions at the top of the frame.

## Suggested model

Sonnet. One pre-verified substitution script; no design remains.

## Steps

**1. The substitutions.** From the repo root:

```bash
python3 - <<'PYEOF'
import sys
def subn(path, old, new, n, tag):
    s = open(path).read()
    if s.count(old) != n: sys.exit("anchor fail: %s (count %d, wanted %d)" % (tag, s.count(old), n))
    open(path, 'w').write(s.replace(old, new))
PHYS='src/game/gravitydebris/phys.js'; JSX='src/game/GravityDebris.jsx'; DRAW='src/game/gravitydebris/draw.js'

# --- THE FRAME SPLIT, physics side: the step becomes a four-chunk machine.
# The whole body of stepWorld becomes a generator with three cut points; a
# chunk runs to the next cut and pauses, all its working state held in place.
# stepWorld itself still runs a whole step in one call — the gates' and the
# battery's road — so headless behavior is byte-identical.
subn(PHYS, """function stepWorld(world, k) {
  const wb = world.blocks, welds = world.welds;""",
     """function stepWorld(world, k) { while (!stepSlice(world, k)) ; return world._weldsAlive; } // one call still runs the whole step
function stepSlice(world, k) { // one chunk of the step; true when the step completed
  if (!world._it) world._it = stepStages(world, k);
  const r = world._it.next();
  if (r.done) { world._it = null; return true; }
  return false;
}
function* stepStages(world, k) {
  const wb = world.blocks, welds = world.welds;""", 1, 'machine')

subn(PHYS, "      world.aggs = world.aggs.filter(a => !a.dead);",
     "      world.aggs = world.aggs.filter(a => !a.dead);\n      yield; // the first cut: the sky's forces are in; the contacts come next chunk", 1, 'cut-one')

subn(PHYS, "      for (let it = 0; it < itn; it++) {",
     "      for (let it = 0; it < itn; it++) {\n        if (it > 0 && it === Math.ceil(itn / 2)) yield; // the second cut: half the solver sweeps on each side", 1, 'cut-two')

subn(PHYS, "      // COLD WELDING: contact that holds still becomes structure",
     "      yield; // the third cut: the tail — welds, wounds, drift, the eaters\n      // COLD WELDING: contact that holds still becomes structure", 1, 'cut-three')

subn(PHYS, """      world.t += DT; world.frame++;
  return weldsAlive;
}""",
     """      world.t += DT; world.frame++;
  world._weldsAlive = weldsAlive;
}""", 1, 'finish')

subn(PHYS, "stepWorld, predictShip, shipConn };",
     "stepWorld, stepSlice, predictShip, shipConn };", 1, 'export')

# --- component side: the chunks spread across the window's frames, and the
# screen glides between the last two COMPLETED steps — one step behind the
# arithmetic, never showing half-computed work. The display pair shifts only
# when a new window opens, so the old glide finishes to its exact end first.
subn(JSX, 'import { stepWorld, predictShip, shipConn, C30, S30 } from "./gravitydebris/phys.js";',
     'import { stepWorld, stepSlice, predictShip, shipConn, C30, S30 } from "./gravitydebris/phys.js";', 1, 'import')

subn(JSX, """      const stepN = k.time >= 1 ? 1 : Math.round(1 / k.time);
      if (!planFrozen && reps > 0) {
        for (const b of world.blocks) { b.px = b.x; b.py = b.y; b.pz = b.z; }
        if (world.starBodies) for (const st of world.starBodies) { st.px = st.x; st.pz = st.z; }
        world.shipPrev = world.shipTrack ? { x: world.shipTrack.x, z: world.shipTrack.z } : null;
      }
      world.lerp = (planFrozen || stepN === 1) ? 1 : (((renderF - 1) % stepN) + 1) / stepN;
      for (let rep = 0; rep < (planFrozen ? 0 : reps); rep++) weldsAlive = stepWorld(world, k);
      if (reps > 0) world.stepMs = +((performance.now() - tPhys) / reps).toFixed(2);""",
     """      const stepN = k.time >= 1 ? 1 : Math.round(1 / k.time);
      // THE FRAME SPLIT: the step runs in four chunks spread across the window's
      // frames. The screen glides between the last two COMPLETED steps, one step
      // behind the arithmetic; the display pair shifts only when a new window
      // opens, so each glide finishes to its exact end before the next begins.
      if (!planFrozen) {
        if (world._chunks == null) world._chunks = 4;
        const fIn = (renderF - 1) % stepN;
        if (fIn === 0 && world._chunks >= 4) {
          if (world._shiftPending) {
            for (const b of world.blocks) { b.px = b.qx; b.py = b.qy; b.pz = b.qz; b.qx = b.x; b.qy = b.y; b.qz = b.z; }
            if (world.starBodies) for (const st of world.starBodies) { st.px = st.qx; st.pz = st.qz; st.qx = st.x; st.qz = st.z; }
            const sb0 = world.blocks.find(b2 => b2.ship && b2.alive);
            world.shipPrev = world.shipQ; world.shipQ = sb0 ? { x: sb0.x, z: sb0.z } : null;
            world._shiftPending = false;
          }
          world._chunks = 0; world._stepAcc = 0;
        }
        if (world._chunks < 4) {
          const want = Math.min(4, Math.ceil((fIn + 1) * 4 / stepN));
          while (world._chunks < want) {
            const done = stepSlice(world, k); world._chunks++;
            if (done) { world._chunks = 4; world._shiftPending = true; weldsAlive = world._weldsAlive || 0; world.stepMs = +((world._stepAcc + performance.now() - tPhys)).toFixed(2); }
          }
          if (world._chunks < 4) world._stepAcc += performance.now() - tPhys;
        }
      }
      world.lerp = (planFrozen || stepN === 1) ? 1 : (((renderF - 1) % stepN) + 1) / stepN;""", 1, 'scheduler')

# --- draw side: the glide reads the display pair (px toward qx), never live x
subn(DRAW, """  const lx = (b) => b.px == null ? b.x : b.px + (b.x - b.px) * L;
  const ly = (b) => b.py == null ? b.y : b.py + (b.y - b.py) * L;
  const lz = (b) => b.pz == null ? b.z : b.pz + (b.z - b.pz) * L;
  const shipAt = () => { const st = world.shipTrack, pv = world.shipPrev; if (!st) return null; if (!pv) return { x: st.x, z: st.z }; return { x: pv.x + (st.x - pv.x) * L, z: pv.z + (st.z - pv.z) * L }; };""",
     """  const lx = (b) => b.px == null ? b.x : b.px + ((b.qx == null ? b.x : b.qx) - b.px) * L; // the glide runs between the last two completed steps, never toward live half-computed positions
  const ly = (b) => b.py == null ? b.y : b.py + ((b.qy == null ? b.y : b.qy) - b.py) * L;
  const lz = (b) => b.pz == null ? b.z : b.pz + ((b.qz == null ? b.z : b.qz) - b.pz) * L;
  const shipAt = () => { const st = world.shipTrack, pv = world.shipPrev, q = world.shipQ; if (!st) return null; if (!pv || !q) return { x: st.x, z: st.z }; return { x: pv.x + (q.x - pv.x) * L, z: pv.z + (q.z - pv.z) * L }; };""", 1, 'draw-pair')

subn(DRAW, "st.px == null ? st.x : st.px + (st.x - st.px) * L",
     "st.px == null ? st.x : st.px + ((st.qx == null ? st.x : st.qx) - st.px) * L", 2, 'star-x')
subn(DRAW, "st.pz == null ? st.z : st.pz + (st.z - st.pz) * L",
     "st.pz == null ? st.z : st.pz + ((st.qz == null ? st.z : st.qz) - st.pz) * L", 2, 'star-z')
print("all substitutions in")
PYEOF
```

Expected output, exact: `all substitutions in`.

**2. The battery.** From the repo root, save the block below as `/tmp/battery74.mjs` and run `node /tmp/battery74.mjs /home/batman/coldsnap` once:

```js
// THE CLIMB BATTERY: seed 12345, one run — the sky builds, steps 5 simulated seconds, no numeric breakdown.
const dir = process.argv[2] || '.';
const {createHash} = await import('node:crypto');
const h = o => createHash('sha256').update(JSON.stringify(o)).digest('hex').slice(0,16);
const DG = await import(dir + '/src/game/gravitydebris/gen.js');
const DP = await import(dir + '/src/game/gravitydebris/phys.js');
const w = DG.makeScenario('map', 12345, 1);
console.log('map s1', h(w.blocks), 'blocks', w.blocks.length);
for (let s = 0; s < 300; s++) DP.stepWorld(w, {welds:true, sleep:true, hash:true, friction:true});
const nan = w.blocks.some(b => b.alive && !isFinite(b.x));
console.log('at 5s: alive ' + w.blocks.filter(b=>b.alive).length + '/' + w.blocks.length + ' | eaten ' + w.eaten + ' | NaN ' + nan);
console.log(nan ? 'STRUCTURE BROKE' : 'STRUCTURE HELD');
```

Acceptance, exact — every line, identical to the last task's landing:

```
map s1 f75a59862872fd01 blocks 7017
at 5s: alive 4555/7017 | eaten 3453 | NaN false
STRUCTURE HELD
```

Then confirm the proving range is untouched: `git status --short src/game/rubbleworlds src/game/RubbleWorlds.jsx` prints nothing.

**3. Gate.** `node scripts/gate.mjs smoke` — 23 PASS, 0 FAIL, one run. If the tool moves it to the background past its two-minute window, wait and read the pass from the tail of `.superpowers/gates.log` — do not start a second run.

**4. Version and build.** `MK = "0.5.69"`, then `npm run build`.

**5. Land.** Commit `src/game/gravitydebris/phys.js`, `src/game/GravityDebris.jsx`, `src/game/gravitydebris/draw.js`, and `src/version.js` only (subject `the frame split, 0.5.69`), push. The phase document's table adds row T74 — "The frame split: the step runs in four chunks across the window's frames; the screen glides one completed step behind and the spike evens out" — LANDED (mark 0.5.69, battery identical to T73's numbers, the smoke count); commit with this plan file, push. The live check is the acceptance, phone and desktop both — the stutter's presence or absence is the verdict, and the step readout now prints the whole step's summed cost.

## Report

- One line of outcome, then bullets.
- Read-confirmation first.
- The battery's printed lines, verbatim; the smoke count exactly.
- The proving range untouched — the empty git status — as its own labeled bullet.
- Battery identical to the last task's numbers, its own labeled bullet — the faithfulness proof.
- Fixture seed: 12345; the module rolls fresh seeds at reset.
- Both commit hashes.
- Every deviation its own labeled bullet.
