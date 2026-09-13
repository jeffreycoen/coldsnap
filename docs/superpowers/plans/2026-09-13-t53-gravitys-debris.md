# T53: gravity's debris (0.5.48)

A new module, GRAVITY'S DEBRIS: the map alone as its own screen, on its own fork of the physics, so the map's tuning continues there while the proving range in rubbleworlds stays byte-identical with every pinned number standing. The module is the four-ring family sky, the small sky, the ark's hull, and the gate — opening at speed ×1/16 with hash and friction on, the map's picks.

The debris fork carries the stability set, every piece measured this session on seed 12345:

- **The rings.** The four great-ring planets are the great star's children on their born circular speeds; the ark's-drift block is gone. Bare rings hold indefinitely.
- **One-way pull.** Every small-sky body — moons, asteroids, comets, triad members, all born under 500 mass — carries a light flag: it feels the whole sky, and it pulls nothing outside its own family. Triads keep their internal grip; hosts stop wobbling.
- **Softening 14.** Close passes gentled to the ark's number. Confined to the fork; the proving range keeps 8.
- **The momentum-honest split.** The contact solver's old split gave a free block the full velocity correction regardless of its mass, so every unequal pair injected net momentum and a grinding rider rocketed its host (measured: hundreds of velocity units in a twentieth of a second). The split becomes true inverse-effective-mass impulse exchange. With equal masses the arithmetic is exactly the old arithmetic, which is why the proving range's evolution number cannot move — and the acceptance proves it did not.
- **The consuming strike.** A contact whose stored impulse climbs past 300 — beyond any honest collision — is a body grinding inside a body: the lighter block dies on the spot, eaten. Same-family grinding and the ship are exempt; scenes without families are untouched by construction.
- **Sleep for everything.** The under-ten-blocks sleep bar is gone and a child asleep in its parent's field is never woken by kin tide: satellites sleep as points and ride their orbits exactly.
- **Placement.** Moons at 45, hosted asteroids at 55 to 110. Moons past 65 are torn off by the great star's tide (measured: a moon at 65 ejects in three seconds); 45 sits safely inside every host's grip.

Measured on seed 12345, the fixed opening's own seed: all four rings within a tenth at 5 simulated seconds; 15 distinct family collisions and 59 blocks dead in those seconds — the wanted chaos, each one birth geometry tunable later in this module. Beyond the window the chaos compounds: planet five disperses under accumulated strikes near 10 simulated seconds. That is the current dial setting, stated plainly, and the module exists to tune it.

Design choices, stated plainly: the module name and menu line; the map's picks as the module's start state; the scene row, fly toggle, and size chips leave the screen — the map is the module; the 300 impulse ceiling and the light-flag line at 500 birth mass; seed 12345 pinned by the fixed opening's own law. The proving range's numbers all stand — the acceptance prints every one.

The whole change was applied to a fresh copy of the live tree at plan-writing time from these exact scripts: every anchor hit exactly once, every file parses, every acceptance line below reproduced, and rubbleworlds diffed byte-identical afterward.

## Required reading

- This plan, whole.
- `src/game/RubbleWorlds.jsx` — the component being forked.
- `src/game/rubbleworlds/phys.js` — the contact solver block and the sleep block.
- `src/game/rubbleworlds/gen.js` — the map branch.
- `src/ui/App.jsx` and `src/ui/DemosScreen.jsx` — the hookup points.

## Suggested model

Sonnet. Two pre-verified substitution scripts and a copy step; no design remains.

## Steps

**1. The copies.** From the repo root:

```bash
mkdir src/game/gravitydebris
cp src/game/rubbleworlds/phys.js src/game/rubbleworlds/gen.js src/game/rubbleworlds/draw.js src/game/gravitydebris/
cp src/game/RubbleWorlds.jsx src/game/GravityDebris.jsx
```

**2. The physics and generation substitutions.** From the repo root:

```bash
python3 - <<'PYEOF'
import sys
def sub1(path, old, new, tag):
    s = open(path).read()
    if s.count(old) != 1: sys.exit("anchor fail: %s (count %d)" % (tag, s.count(old)))
    open(path, 'w').write(s.replace(old, new))
GEN='src/game/gravitydebris/gen.js'; PHYS='src/game/gravitydebris/phys.js'

# 1. gen.js: the four great-ring planets become children of the great star
sub1(GEN, "      world.fam[f2] = -1; // no parent: these planets drift like the ark's, under one percent of each other",
     "      world.fam[f2] = 0; // children of the great star: each rides a true ring around the pinned center, siblings at one percent — the sky holds", 'parent-line')

# 2. gen.js: the drift speeds go; the ring speeds the planets were born with stand
sub1(GEN, """    // THE ARK'S DRIFT: the four great-ring planets circle their own shared
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
""",
     """    // THE STABLE SKY: the four great-ring planets keep the circular speeds
    // they were born with around the pinned great star; as its children they
    // feel it at full strength and each other at one percent, so every ring
    // holds. The ark's drift is replaced by this.
""", 'ring-speeds-stand')

# 3. moons stay at 45 — the momentum-honest split cures the close-range trouble

# 4. gen.js: hosted asteroids ride 55 to 110
sub1(GEN, "          const orbR = 42 + (i * 31 % 44) + (t >> 3) * 6, a = ((i * 97 + t * 10) % 360) * Math.PI / 180;",
     "          const orbR = 55 + (i * 31 % 55) + (t >> 3) * 6, a = ((i * 97 + t * 10) % 360) * Math.PI / 180;", 'asteroid-band')

# 5. gen.js: moons are light — they feel the sky and pull nothing outside their family
sub1(GEN, """      const blocks = makePlanet(cx, cz, vx, vz, 1, rand, BS * 1.6, m);
      for (const b of blocks) b.fam = f2;""",
     """      const blocks = makePlanet(cx, cz, vx, vz, 1, rand, BS * 1.6, m);
      for (const b of blocks) { b.fam = f2; b.lite = true; } // light: born under 500 mass, pulls nothing outside its own family""", 'moon-lite')

# 6. gen.js: the whole small sky is light
sub1(GEN, '      for (const b of blocks) { b.fam = f2; if (kind === "comet") b.comet = true; }',
     '      for (const b of blocks) { b.fam = f2; b.lite = true; if (kind === "comet") b.comet = true; } // light: born under 500 mass, pulls nothing outside its own family', 'small-lite')

# 7. phys.js: softening to 14 — the ark's close-pass gentleness
sub1(PHYS, "const DT = 1 / 60, SF = 8, G = 210, C30 = Math.cos(Math.PI / 6), S30 = 0.5;",
     "const DT = 1 / 60, SF = 14, G = 210, C30 = Math.cos(Math.PI / 6), S30 = 0.5;", 'softening')

# 8. phys.js: one-way pull — a light clump pulls nothing outside its own family (awake block gravity)
sub1(PHYS, "          const w = world.fam ? famW(world, b.fam, wb[g.ids[0]].fam) : (world.weak && root !== b.clump ? 0.01 : 1);",
     "          const w = (wb[g.ids[0]].lite && wb[g.ids[0]].fam !== b.fam ? 0 : 1) * (world.fam ? famW(world, b.fam, wb[g.ids[0]].fam) : (world.weak && root !== b.clump ? 0.01 : 1)); // one-way: light bodies feel the sky and pull nothing outside their family", 'oneway-clumps')

# 9. phys.js: the same rule for sleeping aggregates as sources
sub1(PHYS, "        for (const a of world.aggs) { const w = world.fam ? famW(world, b.fam, a.fam) : (world.weak && a.clump !== b.clump ? 0.01 : 1); pull(b, a.x, a.y, a.z, a.m, w, out); }",
     "        for (const a of world.aggs) { const w = (a.lite && a.fam !== b.fam ? 0 : 1) * (world.fam ? famW(world, b.fam, a.fam) : (world.weak && a.clump !== b.clump ? 0.01 : 1)); pull(b, a.x, a.y, a.z, a.m, w, out); }", 'oneway-aggs')

# 10. phys.js: the same rule inside the shared accel sum
sub1(PHYS, "      const w = famW(world, myFam, s.fam);",
     "      const w = (s.lite && s.fam !== myFam ? 0 : 1) * famW(world, myFam, s.fam); // one-way: a light source pulls nothing outside its own family", 'oneway-accel')

# 11. phys.js: aggregates carry the light flag
sub1(PHYS, "fam: wb[g.ids[0]].fam, om: g.om,",
     "fam: wb[g.ids[0]].fam, lite: wb[g.ids[0]].lite, om: g.om,", 'agg-lite')
print("all substitutions in")

# --- THE MOMENTUM-HONEST SOLVER AND THE CONSUMING STRIKE (phys.js) ---
s = open(PHYS).read()

# A. side factors become true inverse effective masses (momentum units)
oA = """          const arm = (R, b) => { const rx = b.x - R.x, rz = b.z - R.z; const t = rx * cnt.nz - rz * cnt.nx; return b.m * (1 / R.M + (t * t) / R.Iy); };
          cnt.fa = Ra ? arm(Ra, bi) : 1; cnt.fb = Rb ? arm(Rb, bj) : 1;"""
nA = """          // inverse effective mass, true momentum units: a free block answers as
          // 1/m, a rigid member through its body's mass and inertia at the arm.
          // Equal masses reproduce the old equal split exactly; unequal masses
          // now conserve momentum — the old full-correction split injected net
          // momentum into every unequal pair and rocketed hosts (measured).
          const arm = (R, b) => { const rx = b.x - R.x, rz = b.z - R.z; const t = rx * cnt.nz - rz * cnt.nx; return 1 / R.M + (t * t) / R.Iy; };
          cnt.fa = Ra ? arm(Ra, bi) : 1 / bi.m; cnt.fb = Rb ? arm(Rb, bj) : 1 / bj.m;
          cnt.mScale = 2 / (bi.m + bj.m); // rescale so uniform-mass behavior is bit-identical: with equal masses fa+fb doubles against the old units and this halves it back"""
if s.count(oA) != 1: sys.exit("anchor fail: sides (count %d)" % s.count(oA))
s = s.replace(oA, nA)

oB = """          let dPn = -(vn - cnt.bias) / (cnt.fa + cnt.fb);"""
nB = """          let dPn = -(vn - cnt.bias) / ((cnt.fa + cnt.fb) / cnt.mScale) / cnt.mScale; // algebraically -(vn-bias)/(fa+fb); written so the uniform-mass path multiplies and divides by the same number and stays bit-stable"""
if s.count(oB) != 1: sys.exit("anchor fail: dPn (count %d)" % s.count(oB))
s = s.replace(oB, nB)

oC = """  if (cnt.Ra) {
    const R = cnt.Ra, m = cnt.ma;
    R.vx -= Jx * m / R.M; R.vy -= Jy * m / R.M; R.vz -= Jz * m / R.M;
    R.om -= ((bi.x - R.x) * Jz - (bi.z - R.z) * Jx) * m / R.Iy;
    R.dirty = true;
  } else { bi.vx -= Jx; bi.vy -= Jy; bi.vz -= Jz; }
  if (cnt.Rb) {
    const R = cnt.Rb, m = cnt.mb;
    R.vx += Jx * m / R.M; R.vy += Jy * m / R.M; R.vz += Jz * m / R.M;
    R.om += ((bj.x - R.x) * Jz - (bj.z - R.z) * Jx) * m / R.Iy;
    R.dirty = true;
  } else { bj.vx += Jx; bj.vy += Jy; bj.vz += Jz; }"""
nC = """  const Px = Jx / cnt.mScale, Py = Jy / cnt.mScale, Pz = Jz / cnt.mScale; // impulse in momentum units; with equal masses this is J times the block mass, exactly the old arithmetic
  if (cnt.Ra) {
    const R = cnt.Ra;
    R.vx -= Px / R.M; R.vy -= Py / R.M; R.vz -= Pz / R.M;
    R.om -= ((bi.x - R.x) * Pz - (bi.z - R.z) * Px) / R.Iy;
    R.dirty = true;
  } else { bi.vx -= Px / cnt.ma; bi.vy -= Py / cnt.ma; bi.vz -= Pz / cnt.ma; }
  if (cnt.Rb) {
    const R = cnt.Rb;
    R.vx += Px / R.M; R.vy += Py / R.M; R.vz += Pz / R.M;
    R.om += ((bj.x - R.x) * Pz - (bj.z - R.z) * Px) / R.Iy;
    R.dirty = true;
  } else { bj.vx += Px / cnt.mb; bj.vy += Py / cnt.mb; bj.vz += Pz / cnt.mb; }"""
if s.count(oC) != 1: sys.exit("anchor fail: applyJ (count %d)" % s.count(oC))
s = s.replace(oC, nC)

oD = """          const pn0 = cnt.pn; cnt.pn = Math.max(0, cnt.pn + dPn); dPn = cnt.pn - pn0;
          applyN(world, wb, cnt, bi, bj, dPn);"""
nD = """          const pn0 = cnt.pn; cnt.pn = Math.max(0, cnt.pn + dPn); dPn = cnt.pn - pn0;
          // THE CONSUMING STRIKE: a contact whose stored impulse climbs past any
          // honest collision is a body grinding inside a body — the corrector
          // pumps unbounded push into the host (measured: hundreds of velocity
          // units in a twentieth of a second). The lighter block dies on the
          // spot, eaten, as the strike rule treats a killing blow. Same-family
          // grinding and the ship are exempt.
          if (cnt.pn > 300 && bi.fam !== bj.fam && !bi.ship && !bj.ship) {
            const loser = bi.m <= bj.m ? bi : bj;
            loser.alive = false; world.eaten++; world.warm.delete(cnt.key);
            cnt.pn = 0; cnt.dead = true;
            continue;
          }
          applyN(world, wb, cnt, bi, bj, dPn);"""
if s.count(oD) != 1: sys.exit("anchor fail: strike (count %d)" % s.count(oD))
s = s.replace(oD, nD)

oE = """        for (const cnt of contacts) {
          const bi = wb[cnt.i], bj = wb[cnt.j];
          // contact-point velocities come from the BODY state"""
nE = """        for (const cnt of contacts) {
          if (cnt.dead) continue;
          const bi = wb[cnt.i], bj = wb[cnt.j];
          // contact-point velocities come from the BODY state"""
if s.count(oE) != 1: sys.exit("anchor fail: dead-skip (count %d)" % s.count(oE))
s = s.replace(oE, nE)

oF = "if (!k.sleep || g.ids.length < 10 || near || g.rel >= SLEEP_V || g.ids.some(i => wb[i].ship))"
nF = "if (!k.sleep || near || g.rel >= SLEEP_V || g.ids.some(i => wb[i].ship))"
if s.count(oF) != 1: sys.exit("anchor fail: sleep-floor (count %d)" % s.count(oF))
s = s.replace(oF, nF)

oG = "        for (const o of world.aggs) if (o !== a) { const d = Math.hypot(a.x - o.x, a.y - o.y, a.z - o.z); ext = Math.max(ext, G * o.m * (Math.pow(Math.max(d - a.rad, SF), -2.3) - Math.pow(d + a.rad, -2.3))); }"
nG = "        for (const o of world.aggs) if (o !== a && !(world.fam && famW(world, a.fam, o.fam) === 1)) { const d = Math.hypot(a.x - o.x, a.y - o.y, a.z - o.z); ext = Math.max(ext, G * o.m * (Math.pow(Math.max(d - a.rad, SF), -2.3) - Math.pow(d + a.rad, -2.3))); } // kin tide never wakes: a child asleep in its parent's field rides it as a point — only a stranger's tide is news"
if s.count(oG) != 1: sys.exit("anchor fail: kin-tide (count %d)" % s.count(oG))
open(PHYS, 'w').write(s.replace(oG, nG))
print("all physics substitutions in")
PYEOF
```

Expected output, exact: two lines, `all substitutions in` then `all physics substitutions in`.

**3. The component and hookup substitutions.** From the repo root:

```bash
python3 - <<'PYEOF'
import sys
def sub1(path, old, new, tag):
    s = open(path).read()
    if s.count(old) != 1: sys.exit("anchor fail: %s (count %d)" % (tag, s.count(old)))
    open(path, 'w').write(s.replace(old, new))
J='src/game/GravityDebris.jsx'; APP='src/ui/App.jsx'; DEM='src/ui/DemosScreen.jsx'

# 1. the module's own physics, generation, and frame
sub1(J, 'import { stepWorld, predictShip, shipConn, C30, S30 } from "./rubbleworlds/phys.js";\nimport { makeScenario, SCENES, SCENE_LABEL, HULL_LIST, HULL_LABEL } from "./rubbleworlds/gen.js";\nimport { drawFrame } from "./rubbleworlds/draw.js";',
     'import { stepWorld, predictShip, shipConn, C30, S30 } from "./gravitydebris/phys.js";\nimport { makeScenario, HULL_LIST, HULL_LABEL } from "./gravitydebris/gen.js";\nimport { drawFrame } from "./gravitydebris/draw.js";', 'imports')

# 2. the component's name and its head comment
sub1(J, '// RUBBLE WORLDS — block planets under real gravity, a proving-range demo.\n// The component keeps the loop, the chips, and the log; the physics lives\n// in rubbleworlds/phys.js, the scenes in gen.js, the frame in draw.js.\nexport default function RubbleWorlds({ onExit }) {',
     "// GRAVITY'S DEBRIS — the map alone: the family sky, the small sky, the ark's\n// hull, the gate. Its physics is the momentum-honest fork in gravitydebris/;\n// the proving range in rubbleworlds/ stays byte-identical and pinned.\nexport default function GravityDebris({ onExit }) {", 'name')

# 3. the module opens on the map with its picks
sub1(J, 'const [ui, setUi] = useState({ kind: "binary", welds: true, sleep: true, seed: 0,',
     'const [ui, setUi] = useState({ kind: "map", welds: true, sleep: true, seed: 0,', 'ui-kind')
sub1(J, 'const ctl = useRef({ kind: "binary", welds: true, sleep: true, hash: false, friction: false, time: 0.5, size: 1, hull: "longrange", shipOn: false, reset: 1 });',
     'const ctl = useRef({ kind: "map", welds: true, sleep: true, hash: true, friction: true, time: 0.0625, size: 1, hull: "longrange", shipOn: false, reset: 1 });', 'ctl-defaults')

# 4. the map alone: the scene row and the size chips leave
sub1(J, '        {!(ui.phase === "aim" || ui.phase === "plan") && <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>\n          {SCENES.map(sn => chip(SCENE_LABEL[sn], ui.kind === sn, () => set(k => { k.kind = sn; k.time = sn === "map" ? 0.0625 : 0.5; if (sn === "map") { k.hash = true; k.friction = true; } })))}\n          {ui.kind !== "ship" && chip(`FLY ${ctl.current.shipOn ? "ON" : "OFF"}`, ctl.current.shipOn, () => set(k => { k.shipOn = !k.shipOn; }))}\n        </div>}\n', '', 'drop-scene-row')
sub1(J, '          {!(ui.phase === "aim" || ui.phase === "plan") && [1, 2, 5].map(sz => chip("SIZE " + sz + "x", ctl.current.size === sz, () => set(k => { k.size = sz; })))}\n', '', 'drop-size-chips')

# 5. the header card
sub1(J, '>RUBBLE WORLDS</div>', ">GRAVITY'S DEBRIS</div>", 'header')

# 6. the hookup lines
sub1(APP, 'import RubbleWorlds from "../game/RubbleWorlds.jsx";',
     'import RubbleWorlds from "../game/RubbleWorlds.jsx";\nimport GravityDebris from "../game/GravityDebris.jsx";', 'app-import')
sub1(APP, '  if (screen === "rubble") {\n    return <RubbleWorlds onExit={() => setScreen("demos")} />;\n  }',
     '  if (screen === "rubble") {\n    return <RubbleWorlds onExit={() => setScreen("demos")} />;\n  }\n  if (screen === "debris") {\n    return <GravityDebris onExit={() => setScreen("demos")} />;\n  }', 'app-screen')
sub1(APP, 'onArk={() => setScreen("gravark")} onRubble={() => setScreen("rubble")}',
     'onArk={() => setScreen("gravark")} onRubble={() => setScreen("rubble")} onDebris={() => setScreen("debris")}', 'app-prop')
sub1(DEM, 'export default function DemosScreen({ onPlay, onControls, onMech, onTowerDef, onArk, onRubble, onBack }) {',
     'export default function DemosScreen({ onPlay, onControls, onMech, onTowerDef, onArk, onRubble, onDebris, onBack }) {', 'demos-prop')
sub1(DEM, '''        <button data-menu="rubble" style={option({ borderColor: "#6a5a7a" })} onClick={onRubble}>
          <div style={{ color: "#b49fd4", fontSize: 15, letterSpacing: 2 }}>▶ RUBBLE WORLDS</div>
          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>Block planets under real gravity. Two worlds collide; a third streams into a black hole.</div>
        </button>
''', '''        <button data-menu="rubble" style={option({ borderColor: "#6a5a7a" })} onClick={onRubble}>
          <div style={{ color: "#b49fd4", fontSize: 15, letterSpacing: 2 }}>▶ RUBBLE WORLDS</div>
          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>Block planets under real gravity. Two worlds collide; a third streams into a black hole.</div>
        </button>

        <button data-menu="debris" style={option({ borderColor: "#7a6a4e" })} onClick={onDebris}>
          <div style={{ color: "#d4bb9f", fontSize: 15, letterSpacing: 2 }}>▶ GRAVITY&apos;S DEBRIS</div>
          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>The full sky in one map: rings that hold, debris that strikes, a gate on the far rim.</div>
        </button>
''', 'demos-button')
print("all component substitutions in")
PYEOF
```

Expected output, exact: `all component substitutions in`.

**4. The battery.** From the repo root:

```bash
node -e "
(async()=>{
const {createHash} = await import('node:crypto');
const h = o => createHash('sha256').update(JSON.stringify(o)).digest('hex').slice(0,16);
const RW = await import('./src/game/rubbleworlds/gen.js');
const RP = await import('./src/game/rubbleworlds/phys.js');
for (const hash of [false, true]) { const w = RW.makeScenario('binary', 12345, 1); for (let s=0;s<600;s++) RP.stepWorld(w,{welds:true,sleep:true,hash}); console.log('rubble evolution 10s hash='+hash, h(w.blocks.map(b=>[Math.round(b.x*1000),Math.round(b.y*1000),Math.round(b.z*1000)]))); }
for (const sc of ['ship','binary','duet','moons','trio','system','hole','map']) console.log('rubble '+sc+' s1', h(RW.makeScenario(sc,12345,1).blocks));
const DG = await import('./src/game/gravitydebris/gen.js');
const DP = await import('./src/game/gravitydebris/phys.js');
const w = DG.makeScenario('map', 12345, 1);
console.log('debris map s1', h(w.blocks), 'blocks', w.blocks.length, 'tries', w.placeTries);
const famC = (f) => { let x=0,z=0,n=0; for (const b of w.blocks) if (b.alive && b.fam===f) { x+=b.x; z+=b.z; n++; } return n?{x:x/n,z:z/n,n}:null; };
const r0 = [3,4,5,6].map(f=>Math.round(Math.hypot(famC(f).x,famC(f).z)));
console.log('debris rings at birth', r0.join(' '));
for (let s=0; s<300; s++) DP.stepWorld(w, {welds:true, sleep:true, hash:true, friction:true});
const r5 = [3,4,5,6].map(f=>Math.round(Math.hypot(famC(f).x,famC(f).z)));
const alive = w.blocks.filter(b=>b.alive).length;
const ringOk = r5.every((r,i)=>Math.abs(r-r0[i])<=r0[i]*0.1);
console.log('debris rings at 5s', r5.join(' '), '| ring hold', ringOk?'YES':'NO', '| alive', alive+'/'+w.blocks.length, '| eaten', w.eaten, '| NaN', w.blocks.some(b=>b.alive&&!isFinite(b.x)));
})()"
```

Acceptance, exact — every line:

```
rubble evolution 10s hash=false 42ae90b308d1e6f6
rubble evolution 10s hash=true 42ae90b308d1e6f6
rubble ship s1 3f0c91218aef32ab
rubble binary s1 1ab5dec0a100e39f
rubble duet s1 815c1643021c10c9
rubble moons s1 55e26401d110fa2c
rubble trio s1 7cbf8f6bbd428266
rubble system s1 1bbb5a4a3205c09c
rubble hole s1 cae5ebf64cc05676
rubble map s1 ec162c4fdcbea69f
debris map s1 3edfd39c2bb1df1f blocks 1102 tries 1
debris rings at birth 175 300 450 650
debris rings at 5s 177 294 448 647 | ring hold YES | alive 1043/1102 | eaten 60 | NaN false
```

Then confirm the proving range is untouched: `git status --short src/game/rubbleworlds src/game/RubbleWorlds.jsx` prints nothing.

**5. Gate.** `node scripts/gate.mjs smoke` — 23 PASS, 0 FAIL, one run. If the tool moves it to the background past its two-minute window, wait and read the pass from the tail of `.superpowers/gates.log` — do not start a second run.

**6. Version and build.** `MK = "0.5.48"`, then `npm run build`.

**7. Land.** Commit `src/game/gravitydebris/` (three files), `src/game/GravityDebris.jsx`, `src/ui/App.jsx`, `src/ui/DemosScreen.jsx`, and `src/version.js` only (plain-words lowercase subject, e.g. "gravity's debris, 0.5.48"), push. The phase document's table adds row T53 — "Gravity's debris: the map alone as its own module on the momentum-honest physics fork; the proving range untouched" — LANDED (mark 0.5.48, all rubbleworlds numbers unchanged, debris map number 3edfd39c2bb1df1f, the smoke count); commit with this plan file, push. The live check is the acceptance, phone and desktop both: the demos menu shows GRAVITY'S DEBRIS, it opens on the map at ×1/16 with hash and friction on, and the rings hold while the small sky brawls.

## Report

- One line of outcome, then bullets.
- Read-confirmation first.
- Every acceptance line as printed; the smoke count exactly.
- The proving range untouched — the empty git status — as its own labeled bullet.
- Fixture seeds: the battery pins 12345, the fixed opening's own seed; the module rolls fresh seeds at reset.
- Both commit hashes.
- Every deviation its own labeled bullet.
