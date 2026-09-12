# T42: the slow sky and the fast ship (0.5.41)

Three changes, the stars left as they are.

- **Every scene opens at ×1/16.** The controls start there and every scene chip sets it; the row is unchanged.
- **The map's ship at scale four.** Launch cap 440, burn cap 260, birth aim 200, fuel doubled again — LONG-RANGE carries 2080. Each burn still costs the same share of the tank; the drag's reach and the aim snap follow the caps; the engine plume now scales to the burn cap too, so a full burn still fills the flame. The ship scene and the small experiments keep their own economy untouched.
- **The ghost predicts three times as far.** 1200 steps instead of 400 — about forty simulated seconds of path, most of the way across the map on a fast ship — in the ghost, the release snap's test, and its angle search alike. The line still ends at the first predicted contact. One prediction measured under 20 milliseconds; it is paid only while an aim is live.

The stars stay at their present size and mass. The eightfold version was built and flown on the bench: forty to sixty percent of the map eaten inside ten simulated seconds, every moon lost in the first second, on every seed — the sky burned down before the story could start. That result is on record; the stars are not touched.

Nothing in the physics or the generation of blocks moves — the ship's scale changes only its fuel and caps — so every pinned number stands, and the acceptance proves it.

Choices made plainly in this plan: scale four; 1200 steps; ×1/16 for every scene.

The whole change was applied to a fresh copy of the live tree at plan-writing time from this exact script: every anchor hit exactly once, every file parses and builds, every acceptance line below reproduced.

## Required reading

- This plan, whole.
- `src/game/rubbleworlds/gen.js` — the line after the scene chain that places the map's ship and gate.
- `src/game/RubbleWorlds.jsx` — the controls line, the release-snap block, the scene chip row.
- `src/game/rubbleworlds/draw.js` — the ghost block and the plume block.

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
GEN='src/game/rubbleworlds/gen.js'; JSX='src/game/RubbleWorlds.jsx'; DRAW='src/game/rubbleworlds/draw.js'

# 1. gen.js: the map's ship at scale four — caps 440 and 260, fuel doubled again
sub1(GEN,'  if (kind === "map") { addShip(world, hull, -world.span * 0.95, world.span * 0.3, 2); world.gate',
       '  if (kind === "map") { addShip(world, hull, -world.span * 0.95, world.span * 0.3, 4); world.gate','ship-scale')
# 2. component: every scene opens at ×1/16
sub1(JSX,'const ctl = useRef({ kind: "binary", welds: true, sleep: true, hash: false, friction: false, time: 0.5, size: 1, hull: "longrange", shipOn: false, reset: 1 });',
       'const ctl = useRef({ kind: "binary", welds: true, sleep: true, hash: false, friction: false, time: 0.0625, size: 1, hull: "longrange", shipOn: false, reset: 1 });','ctl-default')
sub1(JSX,'          {SCENES.map(sn => chip(SCENE_LABEL[sn], ui.kind === sn, () => set(k => { k.kind = sn; k.time = 0.5; })))}',
       '          {SCENES.map(sn => chip(SCENE_LABEL[sn], ui.kind === sn, () => set(k => { k.kind = sn; k.time = 0.0625; })))}','scene-default')
# 3. component + draw: the ghost predicts three times as far
sub1(JSX,"        const test = vel > 1 ? predictShip(world, st.vx + aim.vx, st.vz + aim.vz, 400) : null;",
       "        const test = vel > 1 ? predictShip(world, st.vx + aim.vx, st.vz + aim.vz, 1200) : null;",'snap-test')
sub1(JSX,"            const t2 = predictShip(world, st.vx + Math.cos(ta) * vel, st.vz + Math.sin(ta) * vel, 400);",
       "            const t2 = predictShip(world, st.vx + Math.cos(ta) * vel, st.vz + Math.sin(ta) * vel, 1200);",'snap-search')
sub1(DRAW,"        const pr = predictShip(world, st.vx + world.shipAim.vx, st.vz + world.shipAim.vz, 400);",
       "        const pr = predictShip(world, st.vx + world.shipAim.vx, st.vz + world.shipAim.vz, 1200); // three times the old reach — about forty simulated seconds of path",'ghost-length')
# 4. draw: the plume scales with the ship
sub1(DRAW,"          const th = (1 - age) * Math.min(1, fl.mag / 65);",
       "          const th = (1 - age) * Math.min(1, fl.mag / (65 * (world.shipScale || 1)));",'plume-scale')
print("all substitutions in")
PYEOF
```

Expected output, exact: `all substitutions in`.

**2. The physics gate.** Every pinned number must stand; the map's ship carries its new fuel and scale; a straight shot at the new cap threads the gate. The command, whole:

```bash
node -e "
import('node:crypto').then(async({createHash})=>{
  const h=o=>createHash('sha256').update(JSON.stringify(o)).digest('hex').slice(0,16);
  const{makeScenario}=await import('./src/game/rubbleworlds/gen.js');
  const{stepWorld,predictShip}=await import('./src/game/rubbleworlds/phys.js');
  for(const hash of[false,true]){const w=makeScenario('binary',12345,1);for(let s=0;s<600;s++)stepWorld(w,{welds:true,sleep:true,hash});console.log('evolution 10s hash='+hash,h(w.blocks.map(b=>[Math.round(b.x*1000),Math.round(b.y*1000),Math.round(b.z*1000)])));}
  for(const sc of['ship','binary','duet','moons','trio','system','hole','map'])console.log(sc+' s1',h(makeScenario(sc,12345,1).blocks));
  const w=makeScenario('map',12345,1);
  console.log('map ship: fuel',w.ship.max,'scale',w.shipScale);
  stepWorld(w,{welds:true,sleep:true,hash:true});
  const b0=w.blocks.find(b=>b.ship&&b.alive);w.shipTrack=null;for(const tk of w.tracks||[]){if(tk.clump===b0.clump){w.shipTrack=tk;break;}}
  const dx=w.gate.x-w.shipTrack.x,dz=w.gate.z-w.shipTrack.z,dd=Math.hypot(dx,dz);
  const pr=predictShip(w,dx/dd*440,dz/dd*440,1200);
  console.log('spawn to gate',Math.round(dd),'straight shot at 440 threads gate',pr.pts.some(p=>p.hitsGate),'pts',pr.pts.length);
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
map ship: fuel 2080 scale 4
spawn to gate 996 straight shot at 440 threads gate true pts 66
```

**3. Gate.** `node scripts/gate.mjs smoke` — 23 PASS, 0 FAIL, one run. If the tool moves it to the background past its two-minute window, wait and read the pass from the tail of `.superpowers/gates.log` — do not start a second run.

**4. Version and build.** `MK = "0.5.41"`, then `npm run build`.

**5. Land.** Commit `src/game/rubbleworlds/gen.js`, `src/game/RubbleWorlds.jsx`, `src/game/rubbleworlds/draw.js`, and `src/version.js` only (plain-words lowercase subject, e.g. "the slow sky and the fast ship, 0.5.41"), push. The phase document's table marks T42 LANDED (mark 0.5.41, all numbers unchanged, the smoke count); commit with this plan file, push. The owner's live check — every scene opening at ×1/16, the map's ship crossing four times as fast with a ghost most of the way to the gate — is the acceptance, phone and desktop both.

## Report

- One line of outcome, then bullets.
- Read-confirmation first.
- Every acceptance line as printed; the smoke count exactly.
- Fixture seeds: the gate pins 12345 by the plan's own law; the demo rolls its own seed at mount — none special.
- Both commit hashes.
- Every deviation its own labeled bullet.
