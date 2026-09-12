# T39: slower by half (0.5.38)

A ×1/32 chip joins the time row and ×1 leaves it: the row reads ×1/32, ×1/16, ×⅛, ×¼, ×½. Every scene opens at ×½ — the map as before, the small experiments now too; they run the same physics at half the pace, nothing else changed. And the other bodies' trajectory lines are fixed at two real seconds at any chip.

- **The chip.** ×1/32 steps the physics every thirty-second drawn frame, about twice a second at sixty frames. The physics cost per drawn frame halves again; drawing the cubes is nearly the whole frame at that speed.
- **The blend stays.** A gap between physics steps is one sixtieth of a simulated second of sky time however many drawn frames span it; a body moves a few units in a straight line in that time, and the drawing walks that short segment in thirty-two pieces instead of sixteen. A curved blend would draw a bend too small to see.
- **Lines in real time.** The other bodies predict as many steps as two real seconds hold at the current chip: fifteen at ×½, eight at ×¼, four at ×⅛, two at ×1/16, and two at ×1/32 — a line needs two points, so the slowest chip shows about four real seconds as a direction tick. Short lines draw every predicted point instead of every third, and any predicted contact inside the window paints the whole short line red. The ship's own ghost is not this task and keeps its full length.

Drawing and chips only: the physics, the generator, and every pinned number are untouched, and the acceptance proves it.

Choices made plainly in this plan: the two-second window; the two-point floor; ×½ as every scene's opening speed now that ×1 is gone.

The whole change was applied to a fresh copy of the live tree at plan-writing time from this exact script: every anchor hit exactly once, both files parse and build, every acceptance line below reproduced.

## Required reading

- This plan, whole.
- `src/game/RubbleWorlds.jsx` — the controls line, the draw call in the loop, the scene and time chip rows.
- `src/game/rubbleworlds/draw.js` — the frame's opening line and the projected-orbits block.

## Suggested model

Sonnet. Nine anchored substitutions, pre-verified; no design remains.

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

# 1. component: the row runs ×1/32 to ×½; ×1 leaves; every scene opens at ×½
sub1(JSX,'const ctl = useRef({ kind: "binary", welds: true, sleep: true, hash: false, friction: false, time: 1, size: 1, hull: "longrange", shipOn: false, reset: 1 });',
       'const ctl = useRef({ kind: "binary", welds: true, sleep: true, hash: false, friction: false, time: 0.5, size: 1, hull: "longrange", shipOn: false, reset: 1 });','ctl-default')
sub1(JSX,'          {SCENES.map(sn => chip(SCENE_LABEL[sn], ui.kind === sn, () => set(k => { k.kind = sn; k.time = sn === "map" ? 0.5 : 1; })))}',
       '          {SCENES.map(sn => chip(SCENE_LABEL[sn], ui.kind === sn, () => set(k => { k.kind = sn; k.time = 0.5; })))}','scene-default')
sub1(JSX,'          {[0.0625, 0.125, 0.25, 0.5, 1].map(tm => chip(tm === 0.0625 ? "×1/16" : tm === 0.125 ? "×⅛" : tm === 0.25 ? "×¼" : tm === 0.5 ? "×½" : "×" + tm, ctl.current.time === tm, () => setLive(k => { k.time = tm; })))}',
       '          {[0.03125, 0.0625, 0.125, 0.25, 0.5].map(tm => chip(tm === 0.03125 ? "×1/32" : tm === 0.0625 ? "×1/16" : tm === 0.125 ? "×⅛" : tm === 0.25 ? "×¼" : "×½", ctl.current.time === tm, () => setLive(k => { k.time = tm; })))}','time-chips')
# 2. component: the drawing learns the chip, so the lines can measure real seconds
sub1(JSX,"      drawFrame({ ctx, W, H, world, frame: world.frame });",
       "      drawFrame({ ctx, W, H, world, frame: world.frame, time: k.time });",'env-time')

# 3. draw.js: lines two real seconds long at any chip
sub1(DRAW,"  const { ctx, W, H, world, frame } = env;","  const { ctx, W, H, world, frame, time } = env;",'env-destructure')
sub1(DRAW,"        const dtP = 1 / 15, NPRED = 15; // one simulated second ahead — two real seconds at the map's half-time default; the ship's own ghost keeps its full length",
       "        const dtP = 1 / 15, NPRED = Math.max(2, Math.round(30 * (time || 0.5))); // TWO REAL SECONDS at any chip: fifteen steps at ×½ down to two at ×1/32 (a line needs two points) — a direction tick at the slowest speeds; the ship's own ghost keeps its full length",'length')
sub1(DRAW,"        const pts = b.pts; if (pts.length < 4) continue;",
       "        const pts = b.pts; if (pts.length < 2) continue;\n        const stride = pts.length >= 9 ? 3 : 1; // short lines draw every point",'min-points')
sub1(DRAW,"        const redFrom = b.hit >= 0 ? Math.max(0, b.hit - 15) : pts.length + 1;",
       "        const redFrom = b.hit >= 0 ? 0 : pts.length + 1; // any predicted contact inside two real seconds paints the whole short line red",'red')
sub1(DRAW,"        for (let i2 = 3; i2 < pts.length; i2 += 3) {\n          const p0 = iso(pts[i2 - 3][0], pts[i2 - 3][1], 0), p1 = iso(pts[i2][0], pts[i2][1], 0);",
       "        for (let i2 = stride; i2 < pts.length; i2 += stride) {\n          const p0 = iso(pts[i2 - stride][0], pts[i2 - stride][1], 0), p1 = iso(pts[i2][0], pts[i2][1], 0);",'stride')
print("all substitutions in")
PYEOF
```

Expected output, exact: `all substitutions in`.

**2. The physics gate.** Nothing in the physics or the generator moves; every number must stand, and the step rates and line lengths are arithmetic. The command, whole:

```bash
node -e "
import('node:crypto').then(async({createHash})=>{
  const h=o=>createHash('sha256').update(JSON.stringify(o)).digest('hex').slice(0,16);
  const{makeScenario}=await import('./src/game/rubbleworlds/gen.js');
  const{stepWorld}=await import('./src/game/rubbleworlds/phys.js');
  for(const hash of[false,true]){const w=makeScenario('binary',12345,1);for(let s=0;s<600;s++)stepWorld(w,{welds:true,sleep:true,hash});console.log('evolution 10s hash='+hash,h(w.blocks.map(b=>[Math.round(b.x*1000),Math.round(b.y*1000),Math.round(b.z*1000)])));}
  for(const sc of['ship','binary','duet','moons','trio','system','hole','map'])console.log(sc+' s1',h(makeScenario(sc,12345,1).blocks));
  for(const t of [0.5,0.25,0.125,0.0625,0.03125]){const N=Math.round(1/t);let n=0;for(let f=0;f<960;f++)n+=(f%N===0)?1:0;const np=Math.max(2,Math.round(30*t));console.log('time',t,'steps in 960 frames',n,'| line steps',np,'= real seconds',(np/15/t).toFixed(1));}
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
time 0.5 steps in 960 frames 480 | line steps 15 = real seconds 2.0
time 0.25 steps in 960 frames 240 | line steps 8 = real seconds 2.1
time 0.125 steps in 960 frames 120 | line steps 4 = real seconds 2.1
time 0.0625 steps in 960 frames 60 | line steps 2 = real seconds 2.1
time 0.03125 steps in 960 frames 30 | line steps 2 = real seconds 4.3
```

**3. Gate.** `node scripts/gate.mjs smoke` — 23 PASS, 0 FAIL, one run. If the tool moves it to the background past its two-minute window, wait and read the pass from the tail of `.superpowers/gates.log` — do not start a second run.

**4. Version and build.** `MK = "0.5.38"`, then `npm run build`.

**5. Land.** Commit `src/game/RubbleWorlds.jsx`, `src/game/rubbleworlds/draw.js`, and `src/version.js` only (plain-words lowercase subject, e.g. "slower by half, 0.5.38"), push. The phase document's table marks T39 LANDED (mark 0.5.38, all numbers unchanged, the smoke count); commit with this plan file, push. The owner's live check — the new row, the sky at ×1/32, every scene opening at ×½, two-second lines at every speed — is the acceptance, phone and desktop both.

## Report

- One line of outcome, then bullets.
- Read-confirmation first.
- Every acceptance line as printed; the smoke count exactly.
- Fixture seeds: the gate pins 12345 by the plan's own law; the demo rolls its own seed at mount — none special.
- Both commit hashes.
- Every deviation its own labeled bullet.
