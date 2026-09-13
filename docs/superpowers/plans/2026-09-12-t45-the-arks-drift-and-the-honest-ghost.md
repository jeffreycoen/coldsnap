# T45: the ark's drift and the honest ghost (0.5.44)

Two faults from the owner's flight of 0.5.43 — the sky too fast, the ship falling short of its promised line — traced and closed.

- **The pace: planets drift like the ark's.** The ark's planets never orbit a star; they circle their own shared center under one percent of each other's pull, with periods near eighty seconds, and the star is a hazard off to the side. The map's planets orbited a 40000 star at full circular speed — the inner ring at 130 units a second. Now the four great-ring planets have no parent: they take the ark's velocities around their shared center and drift at 5 to 12 units a second. The great star becomes a hazard — it pulls the ship, and its own line (the lesser star and that star's two planets), and nothing else; the drifting planets and their moons never feel it. The lesser star's household keeps its orbits, a fast neighborhood inside the slow sky.
- **The honest ghost.** The predictor stepped twice as coarsely as the physics and moved its tracks by a different law than the sky — every planet at full pull on every other, the stars not in it at all. Near a strong well it under-bent, promising a pass the hull did not get: the ship was pulled into the great star and eaten 0.4 seconds after a launch the ghost showed clearing by eight. Now the ghost steps at the physics step for its whole forty seconds — 2400 points — and moves its tracks and stars by the same family law the sky uses. Measured on the same burn: live hull and ghost stay within one to four units of each other all the way to the predicted impact, and the line ends where the ship strikes. One prediction costs about 7 milliseconds.
- **The spawn off the birth line.** From the old spawn the line to the gate ran through the great star. The ship now starts at (-100, -120), beside the star but above the corridor; the birth line clears the star by 150 and meets the inner planet instead — the ark's own slalom, a planet as the first blocker, shown in red on the ghost.

Measured, sixty simulated seconds of the drifting sky on the bench machine: the four drifting planets and their three moons all survive; the lesser star's two fast planets are eaten by twenty seconds — 419 blocks, then nothing more — first weld torn at one second. Physics averages 12.6 milliseconds a step, about 6 per drawn frame at ×½, worst 126, 238 of 3600 steps over the two-frame budget.

Design choices, stated plainly: the one-percent drift is the ark's own rule copied; the hazard rule is one line in the family law — an unrelated body and the hazard star do not pull each other; the spawn point; the map's generation number changes because the spawn moves — old `e5605a8115f64c22`, new `b52d5dbaaca4c5af`; every other scene stays identical and the acceptance proves it.

The whole change was applied to a fresh copy of the live tree at plan-writing time from this exact script: every anchor hit exactly once, every file parses and builds, every acceptance line below reproduced.

## Required reading

- This plan, whole.
- `src/game/rubbleworlds/gen.js` — the map branch and the line after the scene chain that places the map's ship and gate.
- `src/game/rubbleworlds/phys.js` — the family-weight function at the top, the live-wells block, and the predictor near the end.
- `src/game/RubbleWorlds.jsx` — the release-snap block.
- `src/game/rubbleworlds/draw.js` — the ghost block.

## Suggested model

Sonnet. Fourteen anchored substitutions, pre-verified; no design remains.

## Steps

**1. The substitutions.** From the repo root:

```bash
python3 - <<'PYEOF'
import sys
def sub1(path, old, new, tag):
    s = open(path).read()
    if s.count(old) != 1: sys.exit("anchor fail: %s (count %d)" % (tag, s.count(old)))
    open(path, 'w').write(s.replace(old, new))
GEN='src/game/rubbleworlds/gen.js'; PHYS='src/game/rubbleworlds/phys.js'; JSX='src/game/RubbleWorlds.jsx'; DRAW='src/game/rubbleworlds/draw.js'

# --- gen.js ---
# 1. the great star is a hazard: it pulls the ship, not the drifting planets
sub1(GEN,"      world.fam = { 0: -1 };","      world.fam = { 0: -1 };\n      world.hazardFam = 0; // the great star pulls only its own line and the ship — the drifting planets never feel it, the ark's rule",'hazard-fam')
# 2. the great-ring planets have no parent: they drift
sub1(GEN,"        world.fam[f2] = 0;","        world.fam[f2] = -1; // no parent: these planets drift like the ark's, under one percent of each other",'ring-parentless')
# 3. after placement, the drifting planets take the ark's velocities — tangent around their shared center at one percent of the others' mass
sub1(GEN,"    for (const [f2, cx, cz, vx, vz, m] of planets) {",
'''    // THE ARK'S DRIFT: the four great-ring planets circle their own shared
    // center under one percent of each other's pull — periods near eighty
    // seconds, the ark's own pace. Their ring speeds are replaced here.
    const drift = planets.filter(p => p[0] >= 3 && p[0] <= 6);
    const dM = drift.reduce((s2, p) => s2 + p[5], 0);
    const comX = drift.reduce((s2, p) => s2 + p[1] * p[5], 0) / dM, comZ = drift.reduce((s2, p) => s2 + p[2] * p[5], 0) / dM;
    for (const p of drift) {
      const ddx = p[1] - comX, ddz = p[2] - comZ, dist = Math.hypot(ddx, ddz) || 1;
      const vD = Math.sqrt(G * 0.01 * (dM - p[5]) / Math.pow(dist, 1.3));
      p[3] = -ddz / dist * vD; p[4] = ddx / dist * vD;
    }
    for (const [f2, cx, cz, vx, vz, m] of planets) {''','ark-drift')
# 4. the spawn moves off the birth line: beside the star, above the corridor
sub1(GEN,'  if (kind === "map") { addShip(world, hull, -130, 40, 2); world.gate',
       '  if (kind === "map") { addShip(world, hull, -100, -120, 2); world.gate','spawn')

# --- phys.js ---
# 5. the hazard rule in the family law: an unrelated body feels the hazard star not at all
sub1(PHYS,"  return 0.01;\n}\nfunction accel(",
       "  if (world.hazardFam != null && (fa === world.hazardFam || fb === world.hazardFam)) return 0; // the hazard star and an unrelated body: no pull either way\n  return 0.01;\n}\nfunction accel(",'famW-hazard')
# 6. tracks carry their family, so the ghost can move them by the same law
sub1(PHYS,"        world.tracks.push({ x: mx, z: mz, vx: mvx, vz: mvz, m: M, rad, clump: root });",
       "        world.tracks.push({ x: mx, z: mz, vx: mvx, vz: mvz, m: M, rad, clump: root, fam: wb[ids[0]].fam });",'track-fam')
# 7. the honest ghost: the physics step, and the family law on its tracks and stars
sub1(PHYS,"    .map(tk => ({ x: tk.x, z: tk.z, vx: tk.vx, vz: tk.vz, m: tk.m, rad: tk.rad }));",
       "    .map(tk => ({ x: tk.x, z: tk.z, vx: tk.vx, vz: tk.vz, m: tk.m, rad: tk.rad, fam: tk.fam }));",'ghost-track-fam')
sub1(PHYS,"  if (world.hole) statics.push({ x: world.hole.x, z: world.hole.z, m: world.hole.m, rad: world.hole.killR });\n  if (world.star) statics.push({ x: world.star.x, z: world.star.z, m: world.star.m, rad: world.star.r });\n  const gate = world.gate;",
       "  if (world.hole) statics.push({ x: world.hole.x, z: world.hole.z, m: world.hole.m, rad: world.hole.killR });\n  if (world.star) statics.push({ x: world.star.x, z: world.star.z, m: world.star.m, rad: world.star.r });\n  if (world.starBodies) for (const sb of world.starBodies) statics.push({ x: sb.x, z: sb.z, m: sb.m, rad: sb.r, fam: sb.fam });\n  const gate = world.gate;",'ghost-stars')
sub1(PHYS,"      for (const q of simP) if (q !== p) others.push({ x: q.x, z: q.z, m: q.m * (world.weak ? 0.01 : 1) });\n      for (const o of statics) others.push(o);\n      [p.x, p.z, p.vx, p.vz] = ystepT(p.x, p.z, p.vx, p.vz, others, DT * 2);",
       "      for (const q of simP) if (q !== p) others.push({ x: q.x, z: q.z, m: q.m * (world.fam ? famW(world, p.fam, q.fam) : (world.weak ? 0.01 : 1)) });\n      for (const o of statics) others.push(world.fam ? { x: o.x, z: o.z, m: o.m * famW(world, p.fam, o.fam) } : o);\n      [p.x, p.z, p.vx, p.vz] = ystepT(p.x, p.z, p.vx, p.vz, others, DT); // the physics step: honest everywhere",'ghost-tracks-law')
sub1(PHYS,"    const bodies = [...simP, ...statics, ...gateGrav];\n    [x, z, vx, vz] = ystepT(x, z, vx, vz, bodies, DT * 2);",
       "    const bodies = [...simP, ...statics, ...gateGrav];\n    [x, z, vx, vz] = ystepT(x, z, vx, vz, bodies, DT); // the ship is nobody's child: every body pulls it in full, as live",'ghost-ship-step')

# --- the ghost's reach stays forty simulated seconds at the finer step ---
sub1(DRAW,"        const pr = predictShip(world, st.vx + world.shipAim.vx, st.vz + world.shipAim.vz, 1200); // three times the old reach — about forty simulated seconds of path",
       "        const pr = predictShip(world, st.vx + world.shipAim.vx, st.vz + world.shipAim.vz, 2400); // forty simulated seconds at the physics step",'ghost-n')
sub1(JSX,"        const test = vel > 1 ? predictShip(world, st.vx + aim.vx, st.vz + aim.vz, 1200) : null;",
       "        const test = vel > 1 ? predictShip(world, st.vx + aim.vx, st.vz + aim.vz, 2400) : null;",'snap-n')
sub1(JSX,"            const t2 = predictShip(world, st.vx + Math.cos(ta) * vel, st.vz + Math.sin(ta) * vel, 1200);",
       "            const t2 = predictShip(world, st.vx + Math.cos(ta) * vel, st.vz + Math.sin(ta) * vel, 2400);",'snap-search-n')
print("all substitutions in")
PYEOF
```

Expected output, exact: `all substitutions in`.

**2. The physics gate.** Every other scene byte-identical; the map's new number; the drift pace; the honest ghost against the live hull on the same burn. The command, whole:

```bash
node -e "
import('node:crypto').then(async({createHash})=>{
  const h=o=>createHash('sha256').update(JSON.stringify(o)).digest('hex').slice(0,16);
  const{makeScenario}=await import('./src/game/rubbleworlds/gen.js');
  const{stepWorld,predictShip,shipConn}=await import('./src/game/rubbleworlds/phys.js');
  for(const hash of[false,true]){const w=makeScenario('binary',12345,1);for(let s=0;s<600;s++)stepWorld(w,{welds:true,sleep:true,hash});console.log('evolution 10s hash='+hash,h(w.blocks.map(b=>[Math.round(b.x*1000),Math.round(b.y*1000),Math.round(b.z*1000)])));}
  for(const sc of['ship','binary','duet','moons','trio','system','hole'])console.log(sc+' s1',h(makeScenario(sc,12345,1).blocks));
  const w=makeScenario('map',12345,1);
  console.log('map s1',h(w.blocks),'blocks',w.blocks.length,'tries',w.placeTries,'hazard fam',w.hazardFam);
  stepWorld(w,{welds:true,sleep:true,hash:true});
  console.log('drift planet speeds',w.tracks.filter(t=>t.fam>=3&&t.fam<=6).map(t=>t.fam+':'+Math.round(Math.hypot(t.vx,t.vz))).join(' '));
  const b0=w.blocks.find(b=>b.ship&&b.alive);w.shipTrack=null;for(const tk of w.tracks||[]){if(tk.clump===b0.clump){w.shipTrack=tk;break;}}
  const st=w.shipTrack;const dx=w.gate.x-st.x,dz=w.gate.z-st.z,dd=Math.hypot(dx,dz);const vx=dx/dd*200,vz=dz/dd*200;
  const pr=predictShip(w,st.vx+vx,st.vz+vz,2400);const lp=pr.pts[pr.pts.length-1];
  console.log('spawn',Math.round(st.x)+','+Math.round(st.z),'to gate',Math.round(dd),'| birth-line ghost ends at',Math.round(lp.x)+','+Math.round(lp.z),'after',pr.pts.length,'steps, by hit',pr.pts.some(p=>p.hit));
  const conn=shipConn(w);for(const b of conn.set){b.vx+=vx;b.vz+=vz;}
  let s=0;const gaps=[];for(const S of [30,44]){while(s<S){stepWorld(w,{welds:true,sleep:true,hash:true});s++;}const al=w.blocks.filter(b=>b.ship&&b.alive);const cx=al.reduce((a,b)=>a+b.x,0)/al.length,cz=al.reduce((a,b)=>a+b.z,0)/al.length;const p=pr.pts[Math.min(pr.pts.length-1,S-1)];gaps.push('step '+S+' gap '+Math.round(Math.hypot(cx-p.x,cz-p.z))+' alive '+al.length);}
  console.log('live versus ghost on the same burn:',gaps.join(' | '));
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
map s1 b52d5dbaaca4c5af blocks 944 tries 1 hazard fam 0
drift planet speeds 3:6 4:12 5:8 6:5
spawn -100,-120 to gate 576 | birth-line ghost ends at 63,-96 after 44 steps, by hit true
live versus ghost on the same burn: step 30 gap 1 alive 5 | step 44 gap 4 alive 5
```

**3. Gate.** `node scripts/gate.mjs smoke` — 23 PASS, 0 FAIL, one run. If the tool moves it to the background past its two-minute window, wait and read the pass from the tail of `.superpowers/gates.log` — do not start a second run.

**4. Version and build.** `MK = "0.5.44"`, then `npm run build`.

**5. Land.** Commit `src/game/rubbleworlds/gen.js`, `src/game/rubbleworlds/phys.js`, `src/game/RubbleWorlds.jsx`, `src/game/rubbleworlds/draw.js`, and `src/version.js` only (plain-words lowercase subject, e.g. "the ark's drift and the honest ghost, 0.5.44"), push. The phase document's table marks T45 LANDED (mark 0.5.44, existing numbers unchanged, map number old→new, the smoke count); commit with this plan file, push. The owner's live flight — planets drifting at the ark's pace, a ghost the ship follows to the unit, the birth line clear of the star — is the acceptance, phone and desktop both.

## Report

- One line of outcome, then bullets.
- Read-confirmation first.
- Every acceptance line as printed; the smoke count exactly.
- The map's changed generation number as its own labeled bullet, old→new.
- Fixture seeds: the gate pins 12345 by the plan's own law; the demo rolls its own seed at mount — none special.
- Both commit hashes.
- Every deviation its own labeled bullet.
