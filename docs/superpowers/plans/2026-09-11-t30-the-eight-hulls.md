# T30: the eight hulls (0.5.29)

The ship scene learns the deadweight hangar's eight ship shapes, copied cell for cell from `docs/superpowers/reference/deadweight-hangar.html`, and the tanks start holding the fuel.

- **The hulls.** STARTER, COURIER, LONG-RANGE, HAULER, WING TURNER, GUNBOAT, CATAMARAN, GRAPPLER — each a chip shown while aiming; picking one rebuilds the scene with that ship. The bridge cell is the cabin, engine cells are engines, tank cells are tanks. Every other part — pods, struts, steering quads, the gun, the rack, the shield, the grapple — rides as a plain hull block: weight that can be wounded and torn off, its working parts left for later. Today's five-block cross is the LONG-RANGE shape, unchanged block for block.
- **The fuel lives in the tanks.** Capacity is 100 in the cabin plus 210 per tank still welded to the cabin. LONG-RANGE keeps its 520; GRAPPLER carries 310; the other six fly on the cabin's 100 alone. A tank that dies or is torn off spills its share the moment it goes — the fuel number drops to what the remaining tanks can hold.
- **Every engine fires.** Ships with two engines exist now (COURIER, CATAMARAN, GRAPPLER); the burn plume lights on every living engine, and burns work while any engine is welded to the cabin — the rule from the last task, unchanged.

Choices made plainly in this plan:

- Fuel numbers 100 and 210 are picked so the current ship keeps exactly its 520; both are flight-tunable.
- A torn-off engine that is still in its 36-frame burn moment shows its plume wherever it flies; harmless and brief.
- Diagonal neighbors weld (they always did, by the existing weld distance); the bigger hulls are therefore braced, not chains.
- The generation number for the default ship changes because the tank mark enters its blocks — old `c2538ff163ef1494`, new `3f0c91218aef32ab` — and each of the eight hulls gets its own pinned number below. Every other pinned number is unchanged and the acceptance proves it.

The whole change was applied to a scratch copy at plan-writing time: every anchor hit exactly once, every file parses, every acceptance line below reproduced.

## Required reading

- This plan, whole.
- `src/game/RubbleWorlds.jsx` — whole.
- `src/game/rubbleworlds/gen.js` — whole.
- `src/game/rubbleworlds/draw.js` — the engine plume block.
- `docs/superpowers/reference/deadweight-hangar.html` — the BLUEPRINTS table only (search "BLUEPRINTS"), to confirm the copied cells.

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

# 1. gen.js: the eight deadweight hulls, cell for cell, above the scene list
sub1('src/game/rubbleworlds/gen.js',
  'const SCENES = ["ship", "binary", "duet", "moons", "trio", "system", "hole"];',
  """// THE HULLS: the deadweight hangar's eight blueprints, cell for cell from
// docs/superpowers/reference/deadweight-hangar.html. The bridge is the cabin,
// engines and tanks work; every other part rides as a plain hull block —
// weight that can be wounded and torn, its machinery left to later phases.
const HULLS = {
  starter: [["bridge", 0, 0], ["engine", -1, 0], ["pod", 1, 0]],
  courier: [["bridge", 0, 0], ["pod", 1, 0], ["engine", 0, -1], ["engine", 0, 1]],
  longrange: [["bridge", 0, 0], ["engine", -1, 0], ["pod", 1, 0], ["tank", 0, 1], ["tank", 0, -1]],
  hauler: [["bridge", 0, 0], ["engine", -1, 0], ["pod", 1, 0], ["pod", 2, 0], ["pod", 1, -1], ["pod", 1, 1], ["rcs", 2, 1]],
  wingturner: [["bridge", 0, 0], ["engine", -1, 0], ["pod", 1, 0], ["strut", 1, 1], ["strut", 1, 2], ["rcs", 1, 3]],
  gunboat: [["bridge", 0, 0], ["engine", -1, 0], ["pod", 1, 0], ["pod", 1, 1], ["pod", 1, -1], ["mount", 2, 0], ["rack", 2, 1], ["shield", 2, -1]],
  catamaran: [["bridge", 0, 0], ["strut", 0, -1], ["pod", 0, -2], ["engine", -1, -2], ["pod", 1, -2], ["rcs", 2, -2], ["strut", 0, 1], ["pod", 0, 2], ["engine", -1, 2], ["pod", 1, 2], ["rcs", 2, 2]],
  grappler: [["bridge", 0, 0], ["engine", 0, -1], ["engine", 0, 1], ["tank", -1, 0], ["pod", 1, 0], ["pod", 2, 0], ["grapple", 3, 0], ["rcs", 1, 1], ["rcs", 1, -1]],
};
const HULL_LIST = ["starter", "courier", "longrange", "hauler", "wingturner", "gunboat", "catamaran", "grappler"];
const HULL_LABEL = { starter: "STARTER", courier: "COURIER", longrange: "LONG-RANGE", hauler: "HAULER", wingturner: "WING TURNER", gunboat: "GUNBOAT", catamaran: "CATAMARAN", grappler: "GRAPPLER" };
const SCENES = ["ship", "binary", "duet", "moons", "trio", "system", "hole"];""",
  'gen-hulls-table')

# 2. gen.js: the scenario builder takes the hull
sub1('src/game/rubbleworlds/gen.js',
  'function makeScenario(kind, seed, size = 1) {',
  'function makeScenario(kind, seed, size = 1, hull = "longrange") {',
  'gen-signature')

# 3. gen.js: the ship builds from its blueprint; the tanks hold the fuel
sub1('src/game/rubbleworlds/gen.js',
  """    // THE SHIP: a five-module cross — cabin center, engine aft, a tank each
    // side, nose fore — welded, rigid at any size, and its welds NEVER reform:
    // damage stays damage. It flies the ark's way: aim a burn, spend fuel.
    world.blocks = makePlanet(0, 0, 0, 0, 0, rand);
    const mr = 105 * size, mv = Math.sqrt(G * PMASS * size ** 3 * mr / Math.pow(mr * mr + SF * SF, 1.15));
    world.blocks.push(...makePlanet(mr, 0, 0, mv, 1, rand, BS * 0.9, 80 * size ** 3));
    const sx = -200 * size, sz = 80 * size;
    for (const [ox, oz] of [[0, 0], [-BS, 0], [BS, 0], [0, -BS], [0, BS]]) {
      world.blocks.push({ x: sx + ox, y: 0, z: sz + oz, vx: 0, vy: 0, vz: 0, tint: 2, ship: true, eng: ox === -BS && oz === 0, cab: ox === 0 && oz === 0, hp: 100, alive: true, sleeping: false, clump: -1, s: BS, cr: BS * 0.55, m: 120 });
    }
    world.ship = { fuel: 520, max: 520, burns: 0 };""",
  """    // THE SHIP: a deadweight blueprint, welded, rigid at any size, and its
    // welds NEVER reform: damage stays damage. It flies the ark's way: aim a
    // burn, spend fuel. Fuel lives in the cabin's reserve of 100 plus 210 in
    // each tank — the long-range cross keeps its 520.
    world.blocks = makePlanet(0, 0, 0, 0, 0, rand);
    const mr = 105 * size, mv = Math.sqrt(G * PMASS * size ** 3 * mr / Math.pow(mr * mr + SF * SF, 1.15));
    world.blocks.push(...makePlanet(mr, 0, 0, mv, 1, rand, BS * 0.9, 80 * size ** 3));
    const sx = -200 * size, sz = 80 * size;
    const bp = HULLS[hull] || HULLS.longrange;
    let tanks = 0;
    for (const [pt, gx, gy] of bp) {
      if (pt === "tank") tanks++;
      world.blocks.push({ x: sx + gx * BS, y: 0, z: sz + gy * BS, vx: 0, vy: 0, vz: 0, tint: 2, ship: true, eng: pt === "engine", cab: pt === "bridge", tank: pt === "tank", hp: 100, alive: true, sleeping: false, clump: -1, s: BS, cr: BS * 0.55, m: 120 });
    }
    world.ship = { fuel: 100 + 210 * tanks, max: 100 + 210 * tanks, burns: 0 };""",
  'gen-blueprint-build')

# 4. gen.js: the hulls walk out the door
sub1('src/game/rubbleworlds/gen.js',
  'export { makeRand, makePlanet, buildWelds, makeScenario, SCENES, SCENE_LABEL };',
  'export { makeRand, makePlanet, buildWelds, makeScenario, SCENES, SCENE_LABEL, HULLS, HULL_LIST, HULL_LABEL };',
  'gen-exports')

# 5. component: the hull rides the controls, the import, the build call, the log
sub1('src/game/RubbleWorlds.jsx',
  'import { makeScenario, SCENES, SCENE_LABEL } from "./rubbleworlds/gen.js";',
  'import { makeScenario, SCENES, SCENE_LABEL, HULL_LIST, HULL_LABEL } from "./rubbleworlds/gen.js";',
  'jsx-import')
sub1('src/game/RubbleWorlds.jsx',
  'const ctl = useRef({ kind: "binary", welds: true, sleep: true, hash: false, friction: false, time: 1, size: 1, reset: 1 });',
  'const ctl = useRef({ kind: "binary", welds: true, sleep: true, hash: false, friction: false, time: 1, size: 1, hull: "longrange", reset: 1 });',
  'jsx-ctl')
sub1('src/game/RubbleWorlds.jsx',
  '        world = makeScenario(k.kind, seed, k.size);',
  '        world = makeScenario(k.kind, seed, k.size, k.hull);',
  'jsx-build-call')
sub1('src/game/RubbleWorlds.jsx',
  'worldRef.current = () => world && { seed, kind: ctl.current.kind, size: ctl.current.size, welds: ctl.current.welds, sleep: ctl.current.sleep, mk: MK, log: world.log };',
  'worldRef.current = () => world && { seed, kind: ctl.current.kind, size: ctl.current.size, hull: ctl.current.hull, welds: ctl.current.welds, sleep: ctl.current.sleep, mk: MK, log: world.log };',
  'jsx-log-hull')

# 6. component: a tank lost or torn off spills its share
sub1('src/game/RubbleWorlds.jsx',
  """      if (world.ship && !world.shipDead) {
        const cab2 = world.blocks.find(b2 => b2.ship && b2.cab);
        if (cab2 && !cab2.alive) { world.shipDead = true; world.deadAt = world.t; } // the wreck keeps drifting; only the flight ends
      }""",
  """      if (world.ship && !world.shipDead) {
        const cab2 = world.blocks.find(b2 => b2.ship && b2.cab);
        if (cab2 && !cab2.alive) { world.shipDead = true; world.deadAt = world.t; } // the wreck keeps drifting; only the flight ends
      }
      if (world.ship) { // the tanks hold the fuel: a tank lost or torn off spills its share on the spot
        const c3 = shipConn(world);
        let tk = 0; if (c3) for (const b3 of c3.set) if (b3.tank) tk++;
        const cap = 100 + 210 * tk;
        if (world.ship.fuel > cap) world.ship.fuel = cap;
      }""",
  'jsx-tank-spill')

# 7. component: the hull chips, shown while aiming
sub1('src/game/RubbleWorlds.jsx',
  """        {!(ui.phase === "aim" || ui.phase === "plan") && <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
          {SCENES.map(sn => chip(SCENE_LABEL[sn], ui.kind === sn, () => set(k => { k.kind = sn; })))}
        </div>}""",
  """        {!(ui.phase === "aim" || ui.phase === "plan") && <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
          {SCENES.map(sn => chip(SCENE_LABEL[sn], ui.kind === sn, () => set(k => { k.kind = sn; })))}
        </div>}
        {ui.phase === "aim" && <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
          {HULL_LIST.map(hn => chip(HULL_LABEL[hn], ctl.current.hull === hn, () => set(k => { k.hull = hn; })))}
        </div>}""",
  'jsx-hull-chips')

# 8. draw.js: every living engine fires the plume
sub1('src/game/rubbleworlds/draw.js',
  """        const eng = wb.find(b2 => b2.ship && b2.eng && b2.alive);
        if (eng) {""",
  """        for (const eng of wb) {
          if (!(eng.ship && eng.eng && eng.alive)) continue;""",
  'draw-all-engines')
print("all substitutions in")
PYEOF
```

Expected output, exact: `all substitutions in`.

**2. The physics gate.** The command, whole:

```bash
node -e "
import('node:crypto').then(async({createHash})=>{
  const h=o=>createHash('sha256').update(JSON.stringify(o)).digest('hex').slice(0,16);
  const{makeScenario,SCENES,HULL_LIST}=await import('./src/game/rubbleworlds/gen.js');
  const{stepWorld,shipConn}=await import('./src/game/rubbleworlds/phys.js');
  for(const hash of[false,true]){
    const w=makeScenario('binary',12345,1);
    for(let s=0;s<600;s++)stepWorld(w,{welds:true,sleep:true,hash});
    console.log('evolution 10s hash='+hash,h(w.blocks.map(b=>[Math.round(b.x*1000),Math.round(b.y*1000),Math.round(b.z*1000)])));
  }
  for(const sc of SCENES)console.log(sc+' s1',h(makeScenario(sc,12345,1).blocks));
  for(const hu of HULL_LIST){
    const w=makeScenario('ship',12345,1,hu);
    const ships=w.blocks.filter(b=>b.ship);
    stepWorld(w,{welds:true,sleep:true,hash:false});
    const conn=shipConn(w);
    console.log('hull '+hu,h(makeScenario('ship',12345,1,hu).blocks),'blocks',ships.length,'fuel',w.ship.max,'conn',conn?conn.set.length:'null','eng',conn?conn.eng:'-');
  }
});"
```

Acceptance, exact — every line. The ship line carries its new pinned number (old `c2538ff163ef1494`); every other world's number is unchanged from T29. Each hull line proves the shape builds whole: block count, fuel, every block welded to the cabin, engine aboard:

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
hull starter 374fecf6f586cccf blocks 3 fuel 100 conn 3 eng true
hull courier 5c4da345a9a7e13a blocks 4 fuel 100 conn 4 eng true
hull longrange 3f0c91218aef32ab blocks 5 fuel 520 conn 5 eng true
hull hauler 6b2227e0347049a7 blocks 7 fuel 100 conn 7 eng true
hull wingturner a6c0bbe05e44afab blocks 6 fuel 100 conn 6 eng true
hull gunboat 2eea91f5ce0187bb blocks 8 fuel 100 conn 8 eng true
hull catamaran 1b923aac0b754363 blocks 11 fuel 100 conn 11 eng true
hull grappler f734aeff3852b564 blocks 9 fuel 310 conn 9 eng true
```

**3. Gate.** `node scripts/gate.mjs smoke` — 23 PASS, 0 FAIL, one run. Start it and wait for it; if the tool moves it to the background past its two-minute window, wait and read the pass from the tail of `.superpowers/gates.log` — do not start a second run.

**4. Version and build.** `MK = "0.5.29"`, then `npm run build`.

**5. Land.** Commit `src/game/RubbleWorlds.jsx`, `src/game/rubbleworlds/gen.js`, `src/game/rubbleworlds/draw.js`, and `src/version.js` only (plain-words lowercase subject, e.g. "the eight hulls, 0.5.29"), push. The phase document's table gains the T30 row (mark 0.5.29, status LANDED, the ship number old→new, the eight hull numbers noted as newly pinned, the smoke count); commit, push. The owner's live flight — eight chips while aiming, each ship flying with its own fuel and engines, a torn tank spilling on the spot — is the acceptance, phone and desktop both.

## Report

- One line of outcome, then bullets.
- Read-confirmation first.
- Every acceptance line as printed; the smoke count exactly.
- The ship's changed generation number as its own labeled bullet, old→new; the eight new hull numbers listed once.
- Fixture seeds: the gates pin 12345 by the plan's own law; the demo rolls its own seed at mount — none special.
- Both commit hashes.
- Every deviation its own labeled bullet.
