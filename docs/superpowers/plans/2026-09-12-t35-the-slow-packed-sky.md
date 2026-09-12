# T35: the slow packed sky (0.5.34)

The map slows to half time by default, gains a quarter-time chip, packs to half of today's distances, and its ship doubles its caps and fuel so the voyage takes the same real seconds. Slower time is cheaper time: at half speed the physics steps every other drawn frame, at a quarter every fourth, so the same machine carries a denser brawl — and the brawl unfolds slowly enough to read as majestic.

- **Time.** The chip row becomes ×¼, ×½, ×1, ×2, ×5. Picking a scene sets its default: the MAP chip starts at ×½, every other scene at ×1 where it was measured. Quarter speed steps once every fourth drawn frame, the same rule half speed already follows.
- **Packing.** Lesser stars at 317 and 467; great-ring planets at 117, 200, 300, 433; the map about 1000 across. Lesser-star planets stay at 70 and 125 from their star and moons at 45 from their host — those were already as tight as bodies clear.
- **Placed by construction.** At this density a random phase can drop one body inside another, and a body born inside another is a detonation, not chaos. The generator now re-rolls the phases until every body clears every other by at least 6 at birth — planets, moons, stars, and the ship's spawn point. Deterministic per seed; measured across ten rolled seeds: tightest birth gap 9, never more than two re-rolls, seed 12345 places on the first try.
- **The ship's scale.** On the map only: launch cap 220, burn cap 130, birth aim 100, every hull's fuel doubled (LONG-RANGE 1040). Each burn still costs the same share of the tank; the ship scene and the small experiments keep their measured economy untouched. The drag's reach doubles with the cap so a full pull still reaches it.

Measured cost, three rolled seeds flown ninety simulated seconds on the bench machine: physics 13 to 33 milliseconds per step during the brawl, worst single steps 91 to 167 — but at the ×½ default that is 7 to 17 milliseconds per drawn frame, and at ×¼ 3 to 8, both inside the frame budget for most of the run. First welds tear at one to two seconds; 350 to 550 blocks are eaten within ninety seconds. Nothing reaches not-a-number. The owner's phone and desktop are not this machine; the live check decides.

Design choices, stated plainly: the numbers above; the map's generation number changes because every body moves — old `acace0dbe7852764`, new `9c735648f4cb3502`; the ship scene's own hash and every other scene stay identical, and the acceptance proves it.

The whole change was applied to a fresh copy of the live tree at plan-writing time from this exact script: every anchor hit exactly once, every file parses, every acceptance line below reproduced.

## Required reading

- This plan, whole.
- `src/game/rubbleworlds/gen.js` — the ship adder and the map branch.
- `src/game/RubbleWorlds.jsx` — the drag-aim block, the aim chips block, the reset and time-step lines, the chip rows.

## Suggested model

Sonnet. Every substitution is anchored and pre-verified; no design remains.

## Steps

**1. The substitutions.** Every edit is one anchored replacement; an anchor that does not appear exactly once stops the task. From the repo root:

```bash
python3 - <<'PYEOF'
import sys
def sub1(path, old, new, tag):
    s = open(path).read()
    if s.count(old) != 1: sys.exit("anchor fail: %s (count %d)" % (tag, s.count(old)))
    open(path, 'w').write(s.replace(old, new))
GEN='src/game/rubbleworlds/gen.js'; JSX='src/game/RubbleWorlds.jsx'

# 1. gen.js: the sky packs to half of today's distances — about 1000 across
sub1(GEN,"[[633, 60000, 1], [933, 60000, 2]].forEach","[[317, 60000, 1], [467, 60000, 2]].forEach",'lessers')
sub1(GEN,"[[3, 233], [4, 400], [5, 600], [6, 867]].forEach","[[3, 117], [4, 200], [5, 300], [6, 433]].forEach",'rings')
sub1(GEN,"    world.span = 1000;","    world.span = 500;",'span')
sub1(GEN,"    // PACKED to a third of the distances that held stable: the sky is a brawl",
       "    // PACKED to a sixth of the distances that held stable: the sky is a brawl",'comment')
# 2. gen.js: the ship's scale — caps and fuel doubled on the map
sub1(GEN,"function addShip(world, hull, sx, sz) {","function addShip(world, hull, sx, sz, scale = 1) {",'addship-sig')
sub1(GEN,"  world.ship = { fuel: 100 + 210 * tanks, max: 100 + 210 * tanks, burns: 0 };",
       "  world.ship = { fuel: (100 + 210 * tanks) * scale, max: (100 + 210 * tanks) * scale, burns: 0 };\n  world.shipScale = scale; // the map runs at half time, so its ship carries double caps and double fuel: same voyage in real seconds, same share of the tank per burn",'addship-fuel')
sub1(GEN,'  if (kind === "map") { addShip(world, hull, -world.span * 0.95, world.span * 0.3); world.gate',
       '  if (kind === "map") { addShip(world, hull, -world.span * 0.95, world.span * 0.3, 2); world.gate','map-scale')
# 3. gen.js: placed by construction — phases re-roll until every body clears at birth
s = open(GEN).read()
start = s.index("    const lessers = [];")
endMark = "      world.fam[famN] = hostFam; famN++;\n    }\n"
end = s.index(endMark) + len(endMark)
old = s[start:end]
body = "  " + old.replace("\n", "\n  ")
body = body.replace("    const lessers = [];", "  lessers = [];", 1)
body = body.replace("  const planets = [];", "  planets = [];").replace("  let famN = 7;", "  famN = 7;").replace("  const moonHosts = [];", "  moonHosts = [];").replace("  const moons = [];", "  moons = [];")
new = '''    // PLACED BY CONSTRUCTION: phases re-roll until every body clears every
    // other at birth by at least 6 — a body born inside another is a
    // detonation, not chaos. Deterministic per seed; the stir stays 3%.
    let lessers, planets, moons, moonHosts, famN;
    const PR = BS * 3.3 + 3, MR = BS * 1.6 + 3, SHIPR = 15;
    for (let attempt = 0; attempt < 60; attempt++) {
      world.starBodies = [{ x: 0, z: 0, vx: 0, vz: 0, m: MG, r: 40, fam: 0, pin: true }];
      world.fam = { 0: -1 };
    ''' + body + '''      const bodies = [];
      for (const p of planets) bodies.push([p[1], p[2], PR]);
      for (const mn of moons) bodies.push([mn[1], mn[2], MR]);
      for (const st of world.starBodies) bodies.push([st.x, st.z, st.r]);
      bodies.push([-world.span * 0.95, world.span * 0.3, SHIPR]);
      let minGap = 1e9;
      for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
        const gap = Math.hypot(bodies[i][0] - bodies[j][0], bodies[i][1] - bodies[j][1]) - bodies[i][2] - bodies[j][2];
        if (gap < minGap) minGap = gap;
      }
      world.placeTries = attempt + 1;
      if (minGap >= 6) break;
    }
'''
s = s[:start] + new + s[end:]
if s.count("    const MG = 120000;\n") != 1: sys.exit("anchor fail: MG")
s = s.replace("    const MG = 120000;\n", "    const MG = 120000;\n    world.span = 500;\n", 1)
if s.count("    world.moonHosts = moonHosts;\n    world.span = 500;\n") != 1: sys.exit("anchor fail: span-move")
s = s.replace("    world.moonHosts = moonHosts;\n    world.span = 500;\n", "    world.moonHosts = moonHosts;\n", 1)
if s.count("    world.starBodies = [{ x: 0, z: 0, vx: 0, vz: 0, m: MG, r: 40, fam: 0, pin: true }];\n    world.fam = { 0: -1 };\n    // PLACED") != 1: sys.exit("anchor fail: old-init")
s = s.replace("    world.starBodies = [{ x: 0, z: 0, vx: 0, vz: 0, m: MG, r: 40, fam: 0, pin: true }];\n    world.fam = { 0: -1 };\n    // PLACED", "    // PLACED", 1)
s = s.replace("      world.fam = { 0: -1 };\n        lessers = [];", "      world.fam = { 0: -1 };\n      lessers = [];", 1)
s = s.replace("      }\n        const bodies = [];", "      }\n      const bodies = [];", 1)
open(GEN, 'w').write(s)

# 4. component: caps and the birth aim read the ship's scale
sub1(JSX,'        const cap = world.shipPhase === "plan" ? Math.min(65, world.ship.fuel) : Math.min(110, world.ship.fuel);\n        const vel = Math.min(mag * 0.28, cap);',
       '        const sc2 = world.shipScale || 1;\n        const cap = world.shipPhase === "plan" ? Math.min(65 * sc2, world.ship.fuel) : Math.min(110 * sc2, world.ship.fuel);\n        const vel = Math.min(mag * 0.28 * sc2, cap);','cap-drag')
sub1(JSX,'        const cap = world.shipPhase === "plan" ? Math.min(65, world.ship.fuel) : Math.min(110, world.ship.fuel);\n        mag = Math.min(mag, cap);',
       '        const sc3 = world.shipScale || 1;\n        const cap = world.shipPhase === "plan" ? Math.min(65 * sc3, world.ship.fuel) : Math.min(110 * sc3, world.ship.fuel);\n        mag = Math.min(mag, cap);','cap-chips')
sub1(JSX,"            world.shipAim = { on: true, vx: dx / dd * 50, vz: dz / dd * 50 };",
       "            world.shipAim = { on: true, vx: dx / dd * 50 * (world.shipScale || 1), vz: dz / dd * 50 * (world.shipScale || 1) };",'birth-aim')
# 5. component: quarter speed steps every fourth drawn frame; the map starts at half
sub1(JSX,"      const reps = k.time >= 1 ? k.time : (renderF % 2 === 0 ? 1 : 0);",
       "      const reps = k.time >= 1 ? k.time : (renderF % Math.round(1 / k.time) === 0 ? 1 : 0); // half steps every other drawn frame, quarter every fourth",'reps')
sub1(JSX,'          {SCENES.map(sn => chip(SCENE_LABEL[sn], ui.kind === sn, () => set(k => { k.kind = sn; })))}',
       '          {SCENES.map(sn => chip(SCENE_LABEL[sn], ui.kind === sn, () => set(k => { k.kind = sn; k.time = sn === "map" ? 0.5 : 1; })))}','scene-default-time')
sub1(JSX,'          {[0.5, 1, 2, 5].map(tm => chip(tm === 0.5 ? "×½" : "×" + tm, ctl.current.time === tm, () => setLive(k => { k.time = tm; })))}',
       '          {[0.25, 0.5, 1, 2, 5].map(tm => chip(tm === 0.25 ? "×¼" : tm === 0.5 ? "×½" : "×" + tm, ctl.current.time === tm, () => setLive(k => { k.time = tm; })))}','time-chips')
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
  console.log('map s1',h(w.blocks),'blocks',w.blocks.length,'gate',w.gate.x+','+w.gate.z,'fuel',w.ship.max,'tries',w.placeTries,'hosts',w.moonHosts.join(','));
  stepWorld(w,{welds:true,sleep:true,hash:true});
  const b0=w.blocks.find(b=>b.ship&&b.alive);w.shipTrack=null;for(const tk of w.tracks||[]){if(tk.clump===b0.clump){w.shipTrack=tk;break;}}
  const dx=w.gate.x-w.shipTrack.x,dz=w.gate.z-w.shipTrack.z,dd=Math.hypot(dx,dz);
  const pr=predictShip(w,dx/dd*220,dz/dd*220,1200);
  console.log('spawn to gate',Math.round(dd),'straight shot at 220 threads gate',pr.pts.some(p=>p.hitsGate),'pts',pr.pts.length);
});"
```

Acceptance, exact — every line. The first nine are unchanged from T34; the map line carries its new number:

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
map s1 9c735648f4cb3502 blocks 1238 gate 475,-150 fuel 1040 tries 1 hosts 5,6,4
spawn to gate 996 straight shot at 220 threads gate true pts 130
```

**3. Gate.** `node scripts/gate.mjs smoke` — 23 PASS, 0 FAIL, one run. If the tool moves it to the background past its two-minute window, wait and read the pass from the tail of `.superpowers/gates.log` — do not start a second run.

**4. Version and build.** `MK = "0.5.34"`, then `npm run build`.

**5. Land.** Commit `src/game/rubbleworlds/gen.js`, `src/game/RubbleWorlds.jsx`, and `src/version.js` only (plain-words lowercase subject, e.g. "the slow packed sky, 0.5.34"), push. The phase document's table marks T35 LANDED (mark 0.5.34, existing numbers unchanged, map number old→new, the smoke count); commit with this plan file, push. The owner's live flight — the MAP chip opening at half time, the ×¼ chip, the sky twice as dense and brawling in slow majesty, the ship crossing it in the same real seconds — is the acceptance, phone and desktop both.

## Report

- One line of outcome, then bullets.
- Read-confirmation first.
- Every acceptance line as printed; the smoke count exactly.
- The map's changed generation number as its own labeled bullet, old→new.
- Fixture seeds: the gate pins 12345 by the plan's own law; the demo rolls its own seed at mount — none special.
- Both commit hashes.
- Every deviation its own labeled bullet.
