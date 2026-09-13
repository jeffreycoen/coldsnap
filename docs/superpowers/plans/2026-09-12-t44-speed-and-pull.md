# T44: speed and pull (0.5.43)

Gap analysis task one. The map comes toward the ark in the two things that decide flight feel: the clock and the pull.

- **The clock.** Every scene opens at ×½ — the ark's pace halved, the closest the packed brawl affords. The map's ship drops to scale two (caps 220 and 130, fuel 1040 on LONG-RANGE) so the crossing takes the ark's real seconds. The slow chips stay for watching.
- **The pull.** The great star at 40000 and one lesser star at 15000 — the ark's star range — and every planet at mass 5000 in the same 147-block bodies, so a pass curves around a planet as it does in the ark instead of bending only toward the stars. The second lesser star and its two planets leave: eleven bodies remain, 944 blocks.
- **The corridor re-laid.** The fixed opening keeps its shape for the smaller family — the phase table shrinks to ten entries; checked by hand: placed on the first try, tightest birth gap 11, identical on every seed. Under the lighter pull a straight shot from spawn at the launch cap misses the gate by 80, and the aim's own bend finds a threading angle at every launch speed, so the gate stays reachable from the first drag.

Measured, sixty simulated seconds of the fixed opening under the new pulls on the bench machine: first weld torn at one second, first body eaten at 1.1 seconds, 135 blocks eaten by ten seconds and 267 by twenty — then the sky settles and nothing more is eaten through sixty. Physics averages 23 milliseconds a step — about 11.5 per drawn frame at ×½ — with 525 of 3600 steps over the two-frame budget, worst 192; the brawl hitches in its first twenty seconds and runs clean after. Against the eightfold sky that burned half of itself, this one loses a quarter and keeps the rest.

Design choices, stated plainly: ×½ as every scene's opening speed; scale two; 40000, 15000, 5000; the phase table below; the map's generation number changes because the family changes — old `61396c4fe573ab49`, new `e5605a8115f64c22`; every other scene stays identical and the acceptance proves it.

The whole change was applied to a fresh copy of the live tree at plan-writing time from this exact script: every anchor hit exactly once, every file parses and builds, every acceptance line below reproduced.

## Required reading

- This plan, whole.
- `src/game/rubbleworlds/gen.js` — the map branch and the line after the scene chain that places the map's ship and gate.
- `src/game/RubbleWorlds.jsx` — the controls line and the scene chip row.

## Suggested model

Sonnet. Eight anchored substitutions, pre-verified; no design remains.

## Steps

**1. The substitutions.** From the repo root:

```bash
python3 - <<'PYEOF'
import sys
def sub1(path, old, new, tag):
    s = open(path).read()
    if s.count(old) != 1: sys.exit("anchor fail: %s (count %d)" % (tag, s.count(old)))
    open(path, 'w').write(s.replace(old, new))
GEN='src/game/rubbleworlds/gen.js'; JSX='src/game/RubbleWorlds.jsx'

# 1. gen.js: the ark's ratios — great star 40000, one lesser star at 15000, planets near 5000
sub1(GEN,"    const MG = 120000;","    const MG = 40000; // the ark's star range: planets pull the ship as the ark's do",'great-mass')
sub1(GEN,"      [[317, 60000, 1], [467, 60000, 2]].forEach(([r0, m, fam]) => {","      [[317, 15000, 1]].forEach(([r0, m, fam]) => { // one lesser star; the second and its two planets leave",'one-lesser')
sub1(GEN,"        planets.push([f2, Math.cos(a) * r, Math.sin(a) * r, -Math.sin(a) * v, Math.cos(a) * v, 2400]);",
       "        planets.push([f2, Math.cos(a) * r, Math.sin(a) * r, -Math.sin(a) * v, Math.cos(a) * v, 5000]);",'ring-mass')
sub1(GEN,"        planets.push([famN, st.x + Math.cos(a) * r, st.z + Math.sin(a) * r, st.vx - Math.sin(a) * v, st.vz + Math.cos(a) * v, 3000]);",
       "        planets.push([famN, st.x + Math.cos(a) * r, st.z + Math.sin(a) * r, st.vx - Math.sin(a) * v, st.vz + Math.cos(a) * v, 5000]);",'lesser-planet-mass')
# 2. gen.js: the phase table for the smaller family — lesser star, four rings, two lesser planets, three moons
sub1(GEN,"    const PHASES = [20, -35, -45, 5, -30, 12, 0, 180, 0, 180, 60, 200, -20];",
       "    const PHASES = [20, -45, 5, -30, 12, 0, 180, 60, 200, -20];",'phases')
# 3. gen.js: the ship at scale two
sub1(GEN,'  if (kind === "map") { addShip(world, hull, -130, 40, 4); world.gate',
       '  if (kind === "map") { addShip(world, hull, -130, 40, 2); world.gate','ship-scale')
# 4. component: every scene opens at ×½
sub1(JSX,'const ctl = useRef({ kind: "binary", welds: true, sleep: true, hash: false, friction: false, time: 0.0625, size: 1, hull: "longrange", shipOn: false, reset: 1 });',
       'const ctl = useRef({ kind: "binary", welds: true, sleep: true, hash: false, friction: false, time: 0.5, size: 1, hull: "longrange", shipOn: false, reset: 1 });','ctl-default')
sub1(JSX,'          {SCENES.map(sn => chip(SCENE_LABEL[sn], ui.kind === sn, () => set(k => { k.kind = sn; k.time = 0.0625; })))}',
       '          {SCENES.map(sn => chip(SCENE_LABEL[sn], ui.kind === sn, () => set(k => { k.kind = sn; k.time = 0.5; })))}','scene-default')
print("all substitutions in")
PYEOF
```

Expected output, exact: `all substitutions in`.

**2. The physics gate.** The command, whole:

```bash
node -e "
import('node:crypto').then(async({createHash})=>{
  const h=o=>createHash('sha256').update(JSON.stringify(o)).digest('hex').slice(0,16);
  const{makeScenario}=await import('./src/game/rubbleworlds/gen.js');
  const{stepWorld,predictShip}=await import('./src/game/rubbleworlds/phys.js');
  for(const hash of[false,true]){const w=makeScenario('binary',12345,1);for(let s=0;s<600;s++)stepWorld(w,{welds:true,sleep:true,hash});console.log('evolution 10s hash='+hash,h(w.blocks.map(b=>[Math.round(b.x*1000),Math.round(b.y*1000),Math.round(b.z*1000)])));}
  for(const sc of['ship','binary','duet','moons','trio','system','hole'])console.log(sc+' s1',h(makeScenario(sc,12345,1).blocks));
  const w=makeScenario('map',12345,1);
  console.log('map s1',h(w.blocks),'blocks',w.blocks.length,'tries',w.placeTries,'stars',w.starBodies.map(s=>s.m).join('/'),'fuel',w.ship.max,'scale',w.shipScale);
  const fams=new Map();
  for(const b of w.blocks){const k=b.ship?'ship':b.fam;let g=fams.get(k);if(!g){g={x:0,z:0,n:0,r:0,pts:[]};fams.set(k,g);}g.x+=b.x;g.z+=b.z;g.n++;g.pts.push(b);}
  for(const g of fams.values()){g.x/=g.n;g.z/=g.n;for(const b of g.pts)g.r=Math.max(g.r,Math.hypot(b.x-g.x,b.z-g.z)+3);}
  console.log('bodies:',[...fams.entries()].map(([k,g])=>k+'@'+Math.round(g.x)+','+Math.round(g.z)).join(' '));
  console.log('stars:',w.starBodies.map(st=>st.fam+'@'+Math.round(st.x)+','+Math.round(st.z)).join(' '),'gate',w.gate.x+','+w.gate.z);
  let minGap=1e9;const arr=[...fams.entries()];
  for(let i=0;i<arr.length;i++)for(let j=i+1;j<arr.length;j++){const a=arr[i][1],b=arr[j][1];minGap=Math.min(minGap,Math.hypot(a.x-b.x,a.z-b.z)-a.r-b.r);}
  for(const [k,g] of arr)for(const st of w.starBodies)minGap=Math.min(minGap,Math.hypot(g.x-st.x,g.z-st.z)-g.r-st.r);
  console.log('birth min gap',Math.round(minGap));
  stepWorld(w,{welds:true,sleep:true,hash:true});
  const b0=w.blocks.find(b=>b.ship&&b.alive);w.shipTrack=null;for(const tk of w.tracks||[]){if(tk.clump===b0.clump){w.shipTrack=tk;break;}}
  const st=w.shipTrack;const dx=w.gate.x-st.x,dz=w.gate.z-st.z,dd=Math.hypot(dx,dz);const ang0=Math.atan2(dz,dx);
  const pr0=predictShip(w,Math.cos(ang0)*220,Math.sin(ang0)*220,1200);
  let best=null;for(let da=-0.12;da<=0.121;da+=0.03){const ta=ang0+da;const pr=predictShip(w,Math.cos(ta)*220,Math.sin(ta)*220,1200);if(pr.pts.some(p=>p.hitsGate)&&best==null)best=da;}
  console.log('spawn to gate',Math.round(dd),'| straight shot at 220 misses by',Math.round(pr0.minGate),'| the aim bend threads the gate at offset',best==null?'none':best.toFixed(2));
});"
```

Acceptance, exact — every line. The first nine are unchanged; the map line carries its new number:

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
map s1 e5605a8115f64c22 blocks 944 tries 1 stars 40000/15000 fuel 1040 scale 2
bodies: 3@83,-83 4@199,17 5@260,-150 6@424,90 7@368,108 8@173,108 9@222,56 10@217,-165 11@466,75 ship@-130,40
stars: 0@0,0 1@298,108 gate 475,-150
birth min gap 11
spawn to gate 634 | straight shot at 220 misses by 80 | the aim bend threads the gate at offset -0.12
```

**3. Gate.** `node scripts/gate.mjs smoke` — 23 PASS, 0 FAIL, one run. If the tool moves it to the background past its two-minute window, wait and read the pass from the tail of `.superpowers/gates.log` — do not start a second run.

**4. Version and build.** `MK = "0.5.43"`, then `npm run build`.

**5. Land.** Commit `src/game/rubbleworlds/gen.js`, `src/game/RubbleWorlds.jsx`, and `src/version.js` only (plain-words lowercase subject, e.g. "speed and pull, 0.5.43"), push. The phase document's table marks T44 LANDED (mark 0.5.43, existing numbers unchanged, map number old→new, the smoke count); commit with this plan file, push. The owner's live check — the map at ×½ feeling like the ark's flight, passes bending around planets, the brawl in its first twenty seconds and calm after — is the acceptance, phone and desktop both.

## Report

- One line of outcome, then bullets.
- Read-confirmation first.
- Every acceptance line as printed; the smoke count exactly.
- The map's changed generation number as its own labeled bullet, old→new.
- Fixture seeds: the gate pins 12345 by the plan's own law; the demo rolls its own seed at mount — none special.
- Both commit hashes.
- Every deviation its own labeled bullet.
