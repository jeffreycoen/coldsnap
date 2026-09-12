# T37: filling in the frames (0.5.36)

At a slow chip the physics steps once every N drawn frames and the picture showed the skip: bodies held still and hopped. Now the drawing fills the gap. Before each physics step every block and star remembers where it stood; on each drawn frame the drawing places it partway from there to where it is now, by how many frames have passed since the step — 1/N, 2/N, … up to 1 — so bodies glide across the gap. The camera and the ship's aim arrow ride the same blend, so the hull, the arrow, and the view move together. Drawing only: the physics, the generator, and every pinned number are untouched, and the acceptance proves it.

And every body except the ship shows two seconds of trajectory instead of twenty: its projected line drops from 300 predicted steps to 30. The ship's own ghost keeps its full length. Fewer lines to compute every third frame, less clutter in a packed sky.

Stated plainly: the picture runs one physics step behind the truth — at ×⅛ an eighth of a second, at ×1/16 a quarter — invisible in play. The ghost, the aim snap, the compass distance, and the depth-sort keep reading true positions. Blocks whose first step has not yet come draw where they are.

Choices made plainly in this plan: the blend fraction at the step's own frame is 1/N, walking to 1 on the frame before the next step, checked for every chip in the acceptance; a lost ship track falls back to true positions; two seconds is the line length.

The whole change was applied to a fresh copy of the live tree at plan-writing time from this exact script: every anchor hit exactly once, every file parses and builds, every acceptance line below reproduced.

## Required reading

- This plan, whole.
- `src/game/RubbleWorlds.jsx` — the time-step lines in the loop.
- `src/game/rubbleworlds/draw.js` — whole.

## Suggested model

Sonnet. Seven anchored substitutions, pre-verified; no design remains.

## Steps

**1. The substitutions.** From the repo root:

```bash
python3 - <<'PYEOF'
import sys
def sub1(path, old, new, tag):
    s = open(path).read()
    if s.count(old) != 1: sys.exit("anchor fail: %s (count %d)" % (tag, s.count(old)))
    open(path, 'w').write(s.replace(old, new))
JSX='src/game/RubbleWorlds.jsx'; DRAW='src/game/rubbleworlds/draw.js'

# 1. component: remember where everything stood before each physics step, and how far between steps this drawn frame sits
sub1(JSX,"      for (let rep = 0; rep < (planFrozen ? 0 : reps); rep++) weldsAlive = stepWorld(world, k);",
'''      // FILLING IN THE FRAMES: a slow chip steps the physics once every N drawn
      // frames. Before each step every block and star remembers where it stood;
      // the drawing then places it partway from there to here by how many frames
      // have passed, so bodies glide across the gap instead of hopping. Drawing
      // only — the physics and every pinned number are untouched.
      const stepN = k.time >= 1 ? 1 : Math.round(1 / k.time);
      if (!planFrozen && reps > 0) {
        for (const b of world.blocks) { b.px = b.x; b.py = b.y; b.pz = b.z; }
        if (world.starBodies) for (const st of world.starBodies) { st.px = st.x; st.pz = st.z; }
        world.shipPrev = world.shipTrack ? { x: world.shipTrack.x, z: world.shipTrack.z } : null;
      }
      world.lerp = (planFrozen || stepN === 1) ? 1 : (((renderF - 1) % stepN) + 1) / stepN;
      for (let rep = 0; rep < (planFrozen ? 0 : reps); rep++) weldsAlive = stepWorld(world, k);''','step-memory')

# 2. draw.js: the blend helpers, right after the blocks alias
sub1(DRAW,"  const wb = world.blocks;\n",
'''  const wb = world.blocks;
  // between physics steps, draw each body partway from where it stood to where it is
  const L = world.lerp == null ? 1 : world.lerp;
  const lx = (b) => b.px == null ? b.x : b.px + (b.x - b.px) * L;
  const ly = (b) => b.py == null ? b.y : b.py + (b.y - b.py) * L;
  const lz = (b) => b.pz == null ? b.z : b.pz + (b.z - b.pz) * L;
  const shipAt = () => { const st = world.shipTrack, pv = world.shipPrev; if (!st) return null; if (!pv) return { x: st.x, z: st.z }; return { x: pv.x + (st.x - pv.x) * L, z: pv.z + (st.z - pv.z) * L }; };
''','helpers')
# 3. draw.js: the camera rides the blended ship
sub1(DRAW,"      const look = world.pan || (world.ship && world.shipTrack ? { x: world.shipTrack.x, z: world.shipTrack.z } : world._center);",
       "      const look = world.pan || (world.ship && world.shipTrack ? shipAt() : world._center);",'camera')
# 4. draw.js: the cubes draw at blended positions
sub1(DRAW,"        const p = iso(b.x, b.z, b.y), rgb = b.sleeping || b.ship ? tints[b.tint] : [214, 74, 52];",
       "        const p = iso(lx(b), lz(b), ly(b)), rgb = b.sleeping || b.ship ? tints[b.tint] : [214, 74, 52];",'cubes')
# 5. draw.js: the stars glide too
sub1(DRAW,"      if (world.starBodies) for (const st of world.starBodies) drawStar(st.x, st.z, st.r);",
       "      if (world.starBodies) for (const st of world.starBodies) drawStar(st.px == null ? st.x : st.px + (st.x - st.px) * L, st.pz == null ? st.z : st.pz + (st.z - st.pz) * L, st.r);",'stars')
# 6. draw.js: the aim arrow anchors on the blended ship
sub1(DRAW,"        const st = world.shipTrack, sp2 = iso(st.x, st.z, 0);",
       "        const st = world.shipTrack, sa = shipAt(), sp2 = iso(sa.x, sa.z, 0);",'arrow')
# 7. draw.js: every other body's trajectory line shows two seconds ahead, not twenty
sub1(DRAW,"        const dtP = 1 / 15, NPRED = 300;","        const dtP = 1 / 15, NPRED = 30; // two seconds ahead — motion cues, not spaghetti; the ship's own ghost keeps its full length",'short-lines')
print("all substitutions in")
PYEOF
```

Expected output, exact: `all substitutions in`.

**2. The physics gate.** Nothing in the physics or the generator moves; every number must stand, and the blend fraction must walk 1/N to 1 for every chip. The command, whole:

```bash
node -e "
import('node:crypto').then(async({createHash})=>{
  const h=o=>createHash('sha256').update(JSON.stringify(o)).digest('hex').slice(0,16);
  const{makeScenario}=await import('./src/game/rubbleworlds/gen.js');
  const{stepWorld}=await import('./src/game/rubbleworlds/phys.js');
  for(const hash of[false,true]){const w=makeScenario('binary',12345,1);for(let s=0;s<600;s++)stepWorld(w,{welds:true,sleep:true,hash});console.log('evolution 10s hash='+hash,h(w.blocks.map(b=>[Math.round(b.x*1000),Math.round(b.y*1000),Math.round(b.z*1000)])));}
  for(const sc of['ship','binary','duet','moons','trio','system','hole','map'])console.log(sc+' s1',h(makeScenario(sc,12345,1).blocks));
  for(const t of [0.0625,0.125,0.25,0.5,1]){const N=t>=1?1:Math.round(1/t);const fr=[];for(let renderF=1;renderF<=N;renderF++)fr.push((((renderF-1)%N)+1)/N);console.log('time',t,'blend across gap',fr.map(v=>v.toFixed(3)).join(' '));}
});"
```

Acceptance, exact — every line:

```
evolution 10s hash=false 42ae90b308d1e6f6
evolution 10s hash=true 42ae90b308d1e6f6
ship s1 3f0c91218aef32ab
binary s1 1ab5dec0a100e39f
duet s1 815c1643021c10c9
moons s1 55e26401d110fa2c
trio s1 7cbf8f6bbd428266
system s1 1bbb5a4a3205c09c
hole s1 cae5ebf64cc05676
map s1 9c735648f4cb3502
time 0.0625 blend across gap 0.063 0.125 0.188 0.250 0.313 0.375 0.438 0.500 0.563 0.625 0.688 0.750 0.813 0.875 0.938 1.000
time 0.125 blend across gap 0.125 0.250 0.375 0.500 0.625 0.750 0.875 1.000
time 0.25 blend across gap 0.250 0.500 0.750 1.000
time 0.5 blend across gap 0.500 1.000
time 1 blend across gap 1.000
```

**3. Gate.** `node scripts/gate.mjs smoke` — 23 PASS, 0 FAIL, one run. If the tool moves it to the background past its two-minute window, wait and read the pass from the tail of `.superpowers/gates.log` — do not start a second run.

**4. Version and build.** `MK = "0.5.36"`, then `npm run build`.

**5. Land.** Commit `src/game/RubbleWorlds.jsx`, `src/game/rubbleworlds/draw.js`, and `src/version.js` only (plain-words lowercase subject, e.g. "filling in the frames, 0.5.36"), push. The phase document's table marks T37 LANDED (mark 0.5.36, all numbers unchanged, the smoke count); commit with this plan file, push. The owner's live check — the sky gliding at ×⅛ and ×1/16 with the camera and arrow riding smooth, short lines on every body but the ship — is the acceptance, phone and desktop both.

## Report

- One line of outcome, then bullets.
- Read-confirmation first.
- Every acceptance line as printed; the smoke count exactly.
- Fixture seeds: the gate pins 12345 by the plan's own law; the demo rolls its own seed at mount — none special.
- Both commit hashes.
- Every deviation its own labeled bullet.
