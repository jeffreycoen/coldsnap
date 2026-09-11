# T32: the ship joins the experiments (0.5.31)

Every scene can carry the flyable ship. A FLY chip joins the scene row; turned on, the scene rebuilds with the chosen hull sitting clear of the bodies, aiming from birth — burns, fuel, tanks, damage, the turning hull, the death card, all of it, exactly as the ship scene flies. The gate ring stays the ship scene's own: the other scenes are experiments, not missions, so the aim's helping bend looks for a closed orbit there, as it already does wherever no gate stands.

- The ship-building code carves out of the ship scene into one shared adder; the ship scene calls it with its own spawn point and comes out identical to the block — its pinned number does not move.
- In every other scene the hull spawns at a fixed fraction of the scene's own reach, upper left, measured clear of everything: at least 52 clear at normal size and at least 256 at the largest, worst case the star system's rings.
- Without a gate the birth aim points away from the mass at strength 50 — outward is the one direction always safe — so the trajectory line, its number, and the ghost stand on screen from the first moment there too.
- The hole scene with the ship aboard is a real mission: the hole eats what it catches, and a cabin eaten is the ship lost, card and all, through the rules already landed.

Choices made plainly in this plan: the switch starts OFF and rides the copied log; hull blocks stay one block wide at every world size, as they always have; the six ship-on scenes get their own pinned generation numbers below; every existing number stands and the acceptance proves it.

The whole change was applied to a scratch copy at plan-writing time: every anchor hit exactly once, every file parses, every acceptance line below reproduced.

## Required reading

- This plan, whole.
- `src/game/RubbleWorlds.jsx` — whole.
- `src/game/rubbleworlds/gen.js` — whole.

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

# 1. gen.js: the ship-adder, carved from the ship scene
sub1('src/game/rubbleworlds/gen.js',
  '// weld strength per planet size — measured calm loads 17/90/105, same 1.76x margin each\nfunction makeScenario(kind, seed, size = 1, hull = "longrange") {',
  '''// the flyable ship, appended to any scene: the chosen hull at (sx, sz),
// fuel in the cabin's reserve of 100 plus 210 per tank, aiming from birth.
// Hull blocks stay one block wide at every world size, as they always have.
function addShip(world, hull, sx, sz) {
  const bp = HULLS[hull] || HULLS.longrange;
  let tanks = 0;
  for (const [pt, gx, gy] of bp) {
    if (pt === "tank") tanks++;
    world.blocks.push({ x: sx + gx * BS, y: 0, z: sz + gy * BS, vx: 0, vy: 0, vz: 0, tint: 2, ship: true, eng: pt === "engine", cab: pt === "bridge", tank: pt === "tank", hp: 100, alive: true, sleeping: false, clump: -1, s: BS, cr: BS * 0.55, m: 120 });
  }
  world.ship = { fuel: 100 + 210 * tanks, max: 100 + 210 * tanks, burns: 0 };
  world.shipPhase = "aim";
}
// weld strength per planet size — measured calm loads 17/90/105, same 1.76x margin each
function makeScenario(kind, seed, size = 1, hull = "longrange", shipOn = false) {''',
  'gen-addship')

# 2. gen.js: the ship scene builds through the adder — same blocks, same order
sub1('src/game/rubbleworlds/gen.js',
  '''    const sx = -200 * size, sz = 80 * size;
    const bp = HULLS[hull] || HULLS.longrange;
    let tanks = 0;
    for (const [pt, gx, gy] of bp) {
      if (pt === "tank") tanks++;
      world.blocks.push({ x: sx + gx * BS, y: 0, z: sz + gy * BS, vx: 0, vy: 0, vz: 0, tint: 2, ship: true, eng: pt === "engine", cab: pt === "bridge", tank: pt === "tank", hp: 100, alive: true, sleeping: false, clump: -1, s: BS, cr: BS * 0.55, m: 120 });
    }
    world.ship = { fuel: 100 + 210 * tanks, max: 100 + 210 * tanks, burns: 0 };
    world.shipPhase = "aim";
    world.gate''',
  '''    addShip(world, hull, -200 * size, 80 * size);
    world.gate''',
  'gen-ship-scene-adder')

# 3. gen.js: any scene takes the ship on request, clear of the mass
sub1('src/game/rubbleworlds/gen.js',
  '  world.welds = buildWelds(world.blocks);',
  '''  if (shipOn && kind !== "ship") addShip(world, hull, -world.span * 0.77, world.span * 0.31);
  world.welds = buildWelds(world.blocks);''',
  'gen-shipon')

# 4. component: the switch, the chip, the build call, the log
sub1('src/game/RubbleWorlds.jsx',
  'const ctl = useRef({ kind: "binary", welds: true, sleep: true, hash: false, friction: false, time: 1, size: 1, hull: "longrange", reset: 1 });',
  'const ctl = useRef({ kind: "binary", welds: true, sleep: true, hash: false, friction: false, time: 1, size: 1, hull: "longrange", shipOn: false, reset: 1 });',
  'jsx-ctl')
sub1('src/game/RubbleWorlds.jsx',
  '        world = makeScenario(k.kind, seed, k.size, k.hull);',
  '        world = makeScenario(k.kind, seed, k.size, k.hull, k.shipOn);',
  'jsx-build-call')
sub1('src/game/RubbleWorlds.jsx',
  'worldRef.current = () => world && { seed, kind: ctl.current.kind, size: ctl.current.size, hull: ctl.current.hull, welds: ctl.current.welds, sleep: ctl.current.sleep, mk: MK, log: world.log };',
  'worldRef.current = () => world && { seed, kind: ctl.current.kind, size: ctl.current.size, hull: ctl.current.hull, shipOn: ctl.current.shipOn, welds: ctl.current.welds, sleep: ctl.current.sleep, mk: MK, log: world.log };',
  'jsx-log')
sub1('src/game/RubbleWorlds.jsx',
  '          {SCENES.map(sn => chip(SCENE_LABEL[sn], ui.kind === sn, () => set(k => { k.kind = sn; })))}',
  '''          {SCENES.map(sn => chip(SCENE_LABEL[sn], ui.kind === sn, () => set(k => { k.kind = sn; })))}
          {ui.kind !== "ship" && chip(`FLY ${ctl.current.shipOn ? "ON" : "OFF"}`, ctl.current.shipOn, () => set(k => { k.shipOn = !k.shipOn; }))}''',
  'jsx-fly-chip')

# 5. component: the birth aim without a gate points away from the mass
sub1('src/game/RubbleWorlds.jsx',
  '''          const b0 = world.blocks.find(b2 => b2.ship && b2.alive);
          if (b0 && world.gate) { // the ark's default trajectory: toward the gate at 50
            const dx = world.gate.x - b0.x, dz = world.gate.z - b0.z, dd = Math.hypot(dx, dz) || 1;
            world.shipAim = { on: true, vx: dx / dd * 50, vz: dz / dd * 50 };
          }''',
  '''          const b0 = world.blocks.find(b2 => b2.ship && b2.alive);
          if (b0) { // the ark's default trajectory: toward the gate at 50, or away from the mass where no gate stands
            const dx = world.gate ? world.gate.x - b0.x : b0.x, dz = world.gate ? world.gate.z - b0.z : b0.z;
            const dd = Math.hypot(dx, dz) || 1;
            world.shipAim = { on: true, vx: dx / dd * 50, vz: dz / dd * 50 };
          }''',
  'jsx-default-aim')
print("all substitutions in")
PYEOF
```

Expected output, exact: `all substitutions in`.

**2. The physics gate.** The command, whole:

```bash
node -e "
import('node:crypto').then(async({createHash})=>{
  const h=o=>createHash('sha256').update(JSON.stringify(o)).digest('hex').slice(0,16);
  const{makeScenario,SCENES}=await import('./src/game/rubbleworlds/gen.js');
  const{stepWorld}=await import('./src/game/rubbleworlds/phys.js');
  for(const hash of[false,true]){
    const w=makeScenario('binary',12345,1);
    for(let s=0;s<600;s++)stepWorld(w,{welds:true,sleep:true,hash});
    console.log('evolution 10s hash='+hash,h(w.blocks.map(b=>[Math.round(b.x*1000),Math.round(b.y*1000),Math.round(b.z*1000)])));
  }
  for(const sc of SCENES)console.log(sc+' s1',h(makeScenario(sc,12345,1).blocks));
  for(const sc of SCENES){ if(sc==='ship')continue;
    const w=makeScenario(sc,12345,1,'longrange',true);
    const cab=w.blocks.find(b=>b.ship&&b.cab);
    let minD=1e9;
    for(const b of w.blocks)if(!b.ship&&b.alive)minD=Math.min(minD,Math.hypot(b.x-cab.x,b.z-cab.z));
    if(w.hole)minD=Math.min(minD,Math.hypot(w.hole.x-cab.x,w.hole.z-cab.z)-w.hole.killR);
    if(w.star)minD=Math.min(minD,Math.hypot(w.star.x-cab.x,w.star.z-cab.z)-w.star.r);
    console.log(sc+' ship-on s1 '+h(w.blocks)+' clear '+Math.round(minD));
  }
});"
```

Acceptance, exact — every line. The first nine lines are unchanged from T31 — the ship scene through the adder is identical; the six ship-on lines are newly pinned, each showing the spawn clear of everything:

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
binary ship-on s1 b08ee285055dfcef clear 65
duet ship-on s1 7f5f21baa3a151db clear 164
moons ship-on s1 9aa0e9e699ec99c5 clear 151
trio ship-on s1 23d653245a5a6ed8 clear 143
system ship-on s1 b99153fd37941d4c clear 52
hole ship-on s1 6b4ae943af3aefc6 clear 223
```

**3. Gate.** `node scripts/gate.mjs smoke` — 23 PASS, 0 FAIL, one run. If the tool moves it to the background past its two-minute window, wait and read the pass from the tail of `.superpowers/gates.log` — do not start a second run.

**4. Version and build.** `MK = "0.5.31"`, then `npm run build`.

**5. Land.** Commit `src/game/RubbleWorlds.jsx`, `src/game/rubbleworlds/gen.js`, and `src/version.js` only (plain-words lowercase subject, e.g. "the ship joins the experiments, 0.5.31"), push. The phase document's table gains the T32 row (mark 0.5.31, status LANDED, existing numbers unchanged, the six ship-on numbers noted as newly pinned, the smoke count); commit, push. The owner's live flight — the FLY chip on any scene, the hull aiming outward from birth, the hole scene as a real mission — is the acceptance, phone and desktop both.

## Report

- One line of outcome, then bullets.
- Read-confirmation first.
- Every acceptance line as printed; the smoke count exactly.
- The six new pinned numbers listed once.
- Fixture seeds: the gates pin 12345 by the plan's own law; the demo rolls its own seed at mount — none special.
- Both commit hashes.
- Every deviation its own labeled bullet.
