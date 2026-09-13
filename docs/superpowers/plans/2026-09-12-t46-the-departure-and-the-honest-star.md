# T46: the departure and the honest star (0.5.45)

The corridor widens, the first burn departs clean at the full cap, and the ghost stops lying about two last things: it moves the stars, and it steps exactly as the sky steps.

- **The honest star.** The predictor held the lesser star still where it stood at launch; live, it orbits the great star at 69 units a second and swept into the spot the ghost called empty, eating the ship four seconds after a launch the ghost showed clear. Now the predictor advances every moving star by the same family law the sky uses, the pinned one still.
- **The honest step.** The predictor used the ark's higher-order step; the sky steps its bodies by a plain kick-then-drift. The two part at a close pass of a strong well — measured, hundreds of units by four seconds around the great star. Now the ghost steps the ship and its tracks exactly as the sky does. Measured on the birth burn: live hull and ghost within 2 units at one second, 3 at two, 11 at four, 68 at ten — the slow residue is the three light moons the ghost leaves out.
- **The corridor at one and a half times.** Great rings at 175, 300, 450, 650; the lesser star's ring at 475; the map 1500 across; the gate at (712, -225). The two inner planets take phases above the birth line, so the first burn departs clean: the birth burn flies its full forty seconds without touching a body. It misses the gate by about 400 and no snap angle threads it from the spawn — the crossing is the pilot's burns, as the ark's is.
- **The birth burn at the cap.** On the map the birth aim is the full launch cap, 220 at scale two, enough to leave the great star's grip from 156 out; every other scene keeps the ark's 50.

Measured, sixty simulated seconds of the wider sky on the bench machine: 5 blocks eaten by ten seconds, 231 by twenty, 351 by sixty — the lesser star's fast inner planet is the loss; every drifting planet, its moons, and the lesser star's outer planet survive. Physics averages 14.6 milliseconds a step, about 7 per drawn frame at ×½, worst 109, 113 of 3600 steps over the two-frame budget. Birth clearance 11 at the tightest, placed on the first try.

Design choices, stated plainly: the ring distances; the phase table; the birth aim at the cap on the map only; the map's generation number changes because every body moves — old `b52d5dbaaca4c5af`, new `04ed592988ec8c41`; every other scene stays identical and the acceptance proves it.

The whole change was applied to a fresh copy of the live tree at plan-writing time from this exact script: every anchor hit exactly once, every file parses and builds, every acceptance line below reproduced.

## Required reading

- This plan, whole.
- `src/game/rubbleworlds/gen.js` — the map branch and the line after the scene chain that places the map's ship and gate.
- `src/game/rubbleworlds/phys.js` — the predictor near the end.
- `src/game/RubbleWorlds.jsx` — the birth-aim lines in the reset block.

## Suggested model

Sonnet. Ten anchored substitutions, pre-verified; no design remains.

## Steps

**1. The substitutions.** From the repo root:

```bash
python3 - <<'PYEOF'
import sys
def sub1(path, old, new, tag):
    s = open(path).read()
    if s.count(old) != 1: sys.exit("anchor fail: %s (count %d)" % (tag, s.count(old)))
    open(path, 'w').write(s.replace(old, new))
GEN='src/game/rubbleworlds/gen.js'; PHYS='src/game/rubbleworlds/phys.js'; JSX='src/game/RubbleWorlds.jsx'

# --- gen.js: the corridor at one and a half times, the inner planets above the birth line ---
sub1(GEN,"    world.span = 500;","    world.span = 750; // one and a half times: encounters instead of a pile-up, room for the small sky between",'span')
sub1(GEN,"      [[317, 15000, 1]].forEach(([r0, m, fam]) => { // one lesser star; the second and its two planets leave",
       "      [[475, 15000, 1]].forEach(([r0, m, fam]) => { // one lesser star; the second and its two planets leave",'lesser-ring')
sub1(GEN,"      [[3, 117], [4, 200], [5, 300], [6, 433]].forEach(([f2, r0]) => {","      [[3, 175], [4, 300], [5, 450], [6, 650]].forEach(([f2, r0]) => {",'rings')
sub1(GEN,"    const PHASES = [20, -45, 5, -30, 12, 0, 180, 60, 200, -20];",
       "    const PHASES = [20, 25, 40, -30, 12, 0, 180, 60, 200, -20]; // the two inner planets sit above the birth line: the first burn departs clean; the slalom is the pilot's second thought",'phases')
# the birth burn is the full launch cap on the map
sub1(GEN,'  if (kind === "map") { addShip(world, hull, -100, -120, 2); world.gate',
       '  if (kind === "map") { addShip(world, hull, -100, -120, 2); world.birthAim = 110 * world.shipScale; world.gate','birth-aim-cap')

# --- component: the birth aim reads the map's own strength, the ark's 50 elsewhere ---
sub1(JSX,"            world.shipAim = { on: true, vx: dx / dd * 50 * (world.shipScale || 1), vz: dz / dd * 50 * (world.shipScale || 1) };",
       "            const birth = world.birthAim || 50 * (world.shipScale || 1); // the map launches at its full cap to break the great star's grip; every other scene keeps the ark's 50\n            world.shipAim = { on: true, vx: dx / dd * birth, vz: dz / dd * birth };",'birth-aim')

# --- phys.js: the ghost moves the stars by the sky's law, and steps as the sky steps ---
sub1(PHYS,"  if (world.starBodies) for (const sb of world.starBodies) statics.push({ x: sb.x, z: sb.z, m: sb.m, rad: sb.r, fam: sb.fam });",
       "  if (world.starBodies) for (const sb of world.starBodies) statics.push({ x: sb.x, z: sb.z, vx: sb.vx, vz: sb.vz, m: sb.m, rad: sb.r, fam: sb.fam, pin: sb.pin });",'ghost-star-motion-fields')
sub1(PHYS,"  for (let i = 0; i < n; i++) {\n    for (const p of simP) {",
'''  for (let i = 0; i < n; i++) {
    // the moving stars advance exactly as the sky advances them: under each other by the family law, the pinned one still
    for (const sa of statics) {
      if (sa.pin !== false) continue;
      let ax = 0, az = 0;
      for (const o of statics) { if (o === sa) continue; const dx = o.x - sa.x, dz = o.z - sa.z, r2 = dx * dx + dz * dz + SF * SF, rn = Math.pow(r2, 1.65); const wSt = famW(world, sa.fam, o.fam); ax += wSt * G * o.m * dx / rn; az += wSt * G * o.m * dz / rn; }
      sa.vx += ax * DT; sa.vz += az * DT; sa.x += sa.vx * DT; sa.z += sa.vz * DT;
    }
    for (const p of simP) {''','ghost-stars-move')
sub1(PHYS,"      [p.x, p.z, p.vx, p.vz] = ystepT(p.x, p.z, p.vx, p.vz, others, DT); // the physics step: honest everywhere",
       "      { const [ax, az] = gaT(p.x, p.z, others); p.vx += ax * DT; p.vz += az * DT; p.x += p.vx * DT; p.z += p.vz * DT; } // kick then drift, exactly as the sky steps its bodies",'ghost-tracks-euler')
sub1(PHYS,"    [x, z, vx, vz] = ystepT(x, z, vx, vz, bodies, DT); // the ship is nobody's child: every body pulls it in full, as live",
       "    { const [ax, az] = gaT(x, z, bodies); vx += ax * DT; vz += az * DT; x += vx * DT; z += vz * DT; } // the ship is nobody's child: every body pulls it in full, and it steps as the live hull steps — kick then drift",'ghost-ship-euler')
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
  const{stepWorld,predictShip,shipConn}=await import('./src/game/rubbleworlds/phys.js');
  for(const hash of[false,true]){const w=makeScenario('binary',12345,1);for(let s=0;s<600;s++)stepWorld(w,{welds:true,sleep:true,hash});console.log('evolution 10s hash='+hash,h(w.blocks.map(b=>[Math.round(b.x*1000),Math.round(b.y*1000),Math.round(b.z*1000)])));}
  for(const sc of['ship','binary','duet','moons','trio','system','hole'])console.log(sc+' s1',h(makeScenario(sc,12345,1).blocks));
  const w=makeScenario('map',12345,1);
  console.log('map s1',h(w.blocks),'blocks',w.blocks.length,'tries',w.placeTries,'span',w.span,'gate',w.gate.x+','+w.gate.z,'birth aim',w.birthAim);
  const fams=new Map();
  for(const b of w.blocks){const k=b.ship?'ship':b.fam;let g=fams.get(k);if(!g){g={x:0,z:0,n:0,r:0,pts:[]};fams.set(k,g);}g.x+=b.x;g.z+=b.z;g.n++;g.pts.push(b);}
  for(const g of fams.values()){g.x/=g.n;g.z/=g.n;for(const b of g.pts)g.r=Math.max(g.r,Math.hypot(b.x-g.x,b.z-g.z)+3);}
  console.log('bodies:',[...fams.entries()].map(([k,g])=>k+'@'+Math.round(g.x)+','+Math.round(g.z)).join(' '));
  let minGap=1e9;const arr=[...fams.entries()];
  for(let i=0;i<arr.length;i++)for(let j=i+1;j<arr.length;j++){const a=arr[i][1],b=arr[j][1];minGap=Math.min(minGap,Math.hypot(a.x-b.x,a.z-b.z)-a.r-b.r);}
  for(const [k,g] of arr)for(const st of w.starBodies)minGap=Math.min(minGap,Math.hypot(g.x-st.x,g.z-st.z)-g.r-st.r);
  console.log('birth min gap',Math.round(minGap));
  stepWorld(w,{welds:true,sleep:true,hash:true});
  const b0=w.blocks.find(b=>b.ship&&b.alive);w.shipTrack=null;for(const tk of w.tracks){if(tk.clump===b0.clump){w.shipTrack=tk;break;}}
  const st=w.shipTrack;const dx=w.gate.x-b0.x,dz=w.gate.z-b0.z,dd=Math.hypot(dx,dz);const ang0=Math.atan2(dz,dx);
  const gh=predictShip(w,Math.cos(ang0)*220,Math.sin(ang0)*220,2400);
  console.log('birth burn 220: ghost pts',gh.pts.length,'ends by hit',gh.pts.some(p=>p.hit),'threads gate',gh.pts.some(p=>p.hitsGate));
  const conn=shipConn(w);for(const b of conn.set){b.vx+=Math.cos(ang0)*220;b.vz+=Math.sin(ang0)*220;}
  const rows=[];let steps=0;
  for(let f=0;f<1200;f++){if(f%2)continue;stepWorld(w,{welds:true,sleep:true,hash:true});steps++;
    if([60,120,240,600].includes(steps)){const al=w.blocks.filter(b=>b.ship&&b.alive);const cx=al.reduce((a,b)=>a+b.x,0)/al.length,cz=al.reduce((a,b)=>a+b.z,0)/al.length;const p=gh.pts[steps-1];rows.push('step '+steps+' gap '+Math.round(Math.hypot(cx-p.x,cz-p.z)));}}
  console.log('live versus ghost:',rows.join(' | '));
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
map s1 04ed592988ec8c41 blocks 944 tries 1 span 750 gate 712.5,-225 birth aim 220
bodies: 3@159,74 4@230,193 5@390,-225 6@636,135 7@516,162 8@321,163 9@252,232 10@347,-240 11@678,120 ship@-100,-120
birth min gap 11
birth burn 220: ghost pts 2400 ends by hit false threads gate false
live versus ghost: step 60 gap 2 | step 120 gap 3 | step 240 gap 11 | step 600 gap 68
```

**3. Gate.** `node scripts/gate.mjs smoke` — 23 PASS, 0 FAIL, one run. If the tool moves it to the background past its two-minute window, wait and read the pass from the tail of `.superpowers/gates.log` — do not start a second run.

**4. Version and build.** `MK = "0.5.45"`, then `npm run build`.

**5. Land.** Commit `src/game/rubbleworlds/gen.js`, `src/game/rubbleworlds/phys.js`, `src/game/RubbleWorlds.jsx`, and `src/version.js` only (plain-words lowercase subject, e.g. "the departure and the honest star, 0.5.45"), push. The phase document's table marks T46 LANDED (mark 0.5.45, existing numbers unchanged, map number old→new, the smoke count); commit with this plan file, push. The owner's live flight — a first burn that departs clean at full power, a ghost the ship follows through a moving sky, the wider corridor — is the acceptance, phone and desktop both.

## Report

- One line of outcome, then bullets.
- Read-confirmation first.
- Every acceptance line as printed; the smoke count exactly.
- The map's changed generation number as its own labeled bullet, old→new.
- Fixture seeds: the gate pins 12345 by the plan's own law; the demo rolls its own seed at mount — none special.
- Both commit hashes.
- Every deviation its own labeled bullet.
