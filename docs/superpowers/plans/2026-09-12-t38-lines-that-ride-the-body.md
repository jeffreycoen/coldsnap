# T38: lines that ride the body (0.5.37)

Two faults in the other bodies' trajectory lines, one cause: the lines followed the sky's clock while the bodies followed the drawing's.

- **Jitter.** The lines were rebuilt only every third physics step and rooted at each body's true position at that step. Since T37 the body itself draws at a blended position between steps, so the line's root sat where the body was, the body glided ahead, and the root jumped to catch up. Now the lines rebuild every drawn frame and root where the body is drawn — the same blend the cubes use, found from one living block of the body's own clump — and the moving stars in the projection sit where they are drawn too. The line rides the body.
- **Length.** Thirty steps of a fifteenth of a second was two simulated seconds, which at the map's ×½ default is four real seconds. Now fifteen steps: one simulated second, two real seconds at ×½. At slower chips the line stretches in real time as the sky does — four real seconds at ×¼, eight at ×⅛, sixteen at ×1/16. The red warning window shortens to match: the last fifteen steps before a predicted contact.
- Rebuilding every frame is affordable because the lines are short: fourteen bodies by fifteen steps, a few hundred small sums per frame, where twenty-second lines every frame would have cost real time.

Drawing only: the physics, the generator, and every pinned number are untouched, and the acceptance proves it. The ship's own ghost is not this task and keeps its full length.

Choices made plainly in this plan: the length is fixed in simulated time, one second, so real length follows the chosen chip; the root blend comes from the first living block of the body's clump, exact for a rigid body and within a block for a tumbling one; a clump with no living block roots at its true position.

The whole change was applied to a fresh copy of the live tree at plan-writing time from this exact script: every anchor hit exactly once, the file parses and builds, every acceptance line below reproduced.

## Required reading

- This plan, whole.
- `src/game/rubbleworlds/draw.js` — the blend helpers at the top and the projected-orbits block.

## Suggested model

Sonnet. Four anchored substitutions, pre-verified; no design remains.

## Steps

**1. The substitutions.** From the repo root:

```bash
python3 - <<'PYEOF'
import sys
def sub1(path, old, new, tag):
    s = open(path).read()
    if s.count(old) != 1: sys.exit("anchor fail: %s (count %d)" % (tag, s.count(old)))
    open(path, 'w').write(s.replace(old, new))
DRAW='src/game/rubbleworlds/draw.js'

# 1. the lines rebuild every drawn frame, rooted where each body is DRAWN — the blended position, not the last physics step
sub1(DRAW,'''      // A 20-second look: minutes would be honest for the stable orbits, but
      // chaos (the trio, anything post-collision) owns everything longer.
      if (frame % 3 === 0 || !world.pred) {
        const bodies = (world.tracks || []).filter(tk => tk.m >= 500).slice(0, 14)
          .map(tk => ({ x: tk.x, z: tk.z, vx: tk.vx, vz: tk.vz, m: tk.m, rad: tk.rad, clump: tk.clump, pts: [], hit: -1 }));''',
'''      // A one-second look, rebuilt EVERY drawn frame and rooted where the body
      // is drawn — its blended position between physics steps — so the line
      // rides the body instead of hanging at its last true spot and jumping.
      // Short lines make the every-frame rebuild cheap: fourteen bodies by
      // fifteen steps.
      {
        const rootOff = (tk) => { const gi = world.groups && world.groups.get(tk.clump); if (!gi) return [0, 0]; const i0 = gi.find(i => wb[i].alive); if (i0 == null) return [0, 0]; const b0 = wb[i0]; return [lx(b0) - b0.x, lz(b0) - b0.z]; };
        const bodies = (world.tracks || []).filter(tk => tk.m >= 500).slice(0, 14)
          .map(tk => { const [ox, oz] = rootOff(tk); return { x: tk.x + ox, z: tk.z + oz, vx: tk.vx, vz: tk.vz, m: tk.m, rad: tk.rad, clump: tk.clump, pts: [], hit: -1 }; });''','rebuild-every-frame')
# 2. the stars in the projection sit where they are drawn
sub1(DRAW,"        if (world.starBodies) for (const st of world.starBodies) statics.push({ x: st.x, z: st.z, m: st.m, rad: st.r });\n        const dtP",
       "        if (world.starBodies) for (const st of world.starBodies) statics.push({ x: st.px == null ? st.x : st.px + (st.x - st.px) * L, z: st.pz == null ? st.z : st.pz + (st.z - st.pz) * L, m: st.m, rad: st.r });\n        const dtP",'pred-stars-blended')
# 3. one simulated second ahead — two real seconds at the map's half-time default
sub1(DRAW,"        const dtP = 1 / 15, NPRED = 30; // two seconds ahead — motion cues, not spaghetti; the ship's own ghost keeps its full length",
       "        const dtP = 1 / 15, NPRED = 15; // one simulated second ahead — two real seconds at the map's half-time default; the ship's own ghost keeps its full length",'length')
sub1(DRAW,"        const redFrom = b.hit >= 0 ? Math.max(0, b.hit - 30) : pts.length + 1;",
       "        const redFrom = b.hit >= 0 ? Math.max(0, b.hit - 15) : pts.length + 1;",'red-window')
print("all substitutions in")
PYEOF
```

Expected output, exact: `all substitutions in`.

**2. The physics gate.** Nothing in the physics or the generator moves; every number must stand, and the line's real length per chip is arithmetic. The command, whole:

```bash
node -e "
import('node:crypto').then(async({createHash})=>{
  const h=o=>createHash('sha256').update(JSON.stringify(o)).digest('hex').slice(0,16);
  const{makeScenario}=await import('./src/game/rubbleworlds/gen.js');
  const{stepWorld}=await import('./src/game/rubbleworlds/phys.js');
  for(const hash of[false,true]){const w=makeScenario('binary',12345,1);for(let s=0;s<600;s++)stepWorld(w,{welds:true,sleep:true,hash});console.log('evolution 10s hash='+hash,h(w.blocks.map(b=>[Math.round(b.x*1000),Math.round(b.y*1000),Math.round(b.z*1000)])));}
  for(const sc of['ship','binary','duet','moons','trio','system','hole','map'])console.log(sc+' s1',h(makeScenario(sc,12345,1).blocks));
  for(const t of [0.5,0.25,0.125,0.0625])console.log('time',t,'line covers',(15/15/t).toFixed(0),'real seconds');
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
time 0.5 line covers 2 real seconds
time 0.25 line covers 4 real seconds
time 0.125 line covers 8 real seconds
time 0.0625 line covers 16 real seconds
```

**3. Gate.** `node scripts/gate.mjs smoke` — 23 PASS, 0 FAIL, one run. If the tool moves it to the background past its two-minute window, wait and read the pass from the tail of `.superpowers/gates.log` — do not start a second run.

**4. Version and build.** `MK = "0.5.37"`, then `npm run build`.

**5. Land.** Commit `src/game/rubbleworlds/draw.js` and `src/version.js` only (plain-words lowercase subject, e.g. "lines that ride the body, 0.5.37"), push. The phase document's table marks T38 LANDED (mark 0.5.37, all numbers unchanged, the smoke count); commit with this plan file, push. The owner's live check — lines rooted on gliding bodies at ×⅛ and ×1/16, two real seconds long at the default — is the acceptance, phone and desktop both.

## Report

- One line of outcome, then bullets.
- Read-confirmation first.
- Every acceptance line as printed; the smoke count exactly.
- Fixture seeds: the gate pins 12345 by the plan's own law; the demo rolls its own seed at mount — none special.
- Both commit hashes.
- Every deviation its own labeled bullet.
