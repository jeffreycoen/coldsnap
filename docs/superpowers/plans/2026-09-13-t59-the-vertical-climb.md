# T59: the vertical climb (0.5.54)

Gravity's debris relaid: the great star at the bottom of the view with the ship below it — the only body there — and the gate straight up the screen at the top. Twelve huge planets in four triads stacked between star and gate, six small moons interspersed on their own rings. The lesser star leaves; the climb is the great star's alone. The ascii layout reviewed is this table drawn to scale. Debris module only; thrust, fuel, and all physics stand as shipped.

- **Four triads of three huge planets.** Every member 40,000 mass at the doubled density — the twelve largest bodies the map has carried. Rings 190, 300, 390, 490 on bearings down the climb; widths 60 to 95; spins mixed by the margin rule — the two outer triads turn with their rings, the two inner against.
- **Six moons.** Mass 1200 each, grey, riding their own rings between the triads as children of the star.
- **The opening swing.** The ship is born at (75, 75) below the star; the birth burn fires the tangent at 260, and the computed swing rounds the star at 106 and passes within 169 of the gate at 6.4 simulated seconds.
- **The caches** ride the climb at (-150, -200), (-287, -201), (-360, -429). The gate stands at (-455, -455), radius 36.

Design choices, stated plainly: the four-row table, the moon rings, the birth point and tangent, the gate and cache points. Seed 12345 is the fixture. The battery is structural — the sky builds, steps 5 simulated seconds, and holds no numeric breakdown; its printed counts and the map number are recorded in the report, not pinned here.

The substitution script was applied to a fresh copy of the live tree at plan-writing time: every anchor hit exactly once, the file parses.

## Required reading

- This plan, whole.
- `src/game/gravitydebris/gen.js` — the map branch, whole, and the ship line at the bottom.

## Suggested model

Sonnet. One pre-verified substitution script on one file; no design remains.

## Steps

**1. The substitutions.** From the repo root:

```bash
python3 - <<'PYEOF'
import sys
def sub1(path, old, new, tag):
    s = open(path).read()
    if s.count(old) != 1: sys.exit("anchor fail: %s (count %d)" % (tag, s.count(old)))
    open(path, 'w').write(s.replace(old, new))
GEN='src/game/gravitydebris/gen.js'

# 1. the table becomes the vertical climb: four triads of three huge planets, mixed spins by the margin rule
sub1(GEN, """    const TRIS = [
      [175, -50, 80, 40000, 20000, 7200, 18, -1], [175, -64, 26, 3200, 1200, 640, 250, -1],
      [240, -48, 38, 3200, 1200, 640, 205, -1], [240, -70, 52, 7200, 3200, 1200, 330, -1],
      [300, -55, 96, 40000, 7200, 3200, 32, -1], [300, -74, 68, 5600, 5600, 1200, 95, -1],
      [365, -48, 68, 7200, 5600, 3200, 275, -1], [365, -62, 76, 12800, 3200, 3200, 160, -1],
      [450, -52, 104, 40000, 40000, 3200, 0, 1], [450, -70, 64, 5600, 1200, 640, 220, -1],
      [550, -48, 72, 12800, 7200, 1200, 145, 1], [550, -60, 80, 20000, 5600, 3200, 300, -1],
      [650, -55, 112, 40000, 12800, 12800, 48, 1], [720, -63, 64, 5600, 3200, 3200, 190, 1],
    ];""",
     """    // THE VERTICAL CLIMB: the star at the bottom of the view, the gate straight
    // up the screen, four triads of three HUGE planets stacked between them,
    // six small moons interspersed. Only the ship sits below the star.
    const TRIS = [
      [190, -135, 60, 40000, 40000, 40000, 18, -1],
      [300, -152, 75, 40000, 40000, 40000, 205, -1],
      [390, -118, 85, 40000, 40000, 40000, 145, 1],
      [490, -137, 95, 40000, 40000, 40000, 300, 1],
    ];""", 'climb-table')

# 2. the moons: six small bodies riding their own rings between the triads
sub1(GEN, "    world.pickups = [{ x: 150, z: -300, fuel: 300, alive: true }, { x: 200, z: -350, fuel: 300, alive: true }, { x: 380, z: -430, fuel: 300, alive: true }];",
     """    // six small moons interspersed on their own rings, children of the star
    for (const [mr, ma] of [[250, -122], [250, -152], [345, -136], [445, -155], [450, -118], [555, -128]]) {
      const a2 = ma * Math.PI / 180, v2 = vCirc(MG, mr);
      const blocks = makePlanet(Math.cos(a2) * mr, Math.sin(a2) * mr, -Math.sin(a2) * v2, Math.cos(a2) * v2, 1, rand, BS * 1.6, 1200);
      const tf2 = famN++; world.fam[tf2] = 0;
      for (const b of blocks) { b.fam = tf2; b.rgb = hsl(210, 12, 58); }
      world.blocks.push(...blocks);
    }
    world.pickups = [{ x: -150, z: -200, fuel: 300, alive: true }, { x: -287, z: -201, fuel: 300, alive: true }, { x: -360, z: -429, fuel: 300, alive: true }];""", 'moons-and-caches')

# 3. the lesser star leaves: the climb is the great star's alone
sub1(GEN, "    { const r = 475, a = -58 * Math.PI / 180, v = vCirc(MG, r);\n      world.starBodies.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, vx: -Math.sin(a) * v, vz: Math.cos(a) * v, m: 36900, r: 48, fam: 1, pin: false }); world.fam[1] = 0; }",
     "    // the climb is the great star's alone — no lesser star on this map", 'lesser-leaves')

# 4. the ship below the star, the gate straight up; the birth tangent rounds the star into the climb
sub1(GEN, '  if (kind === "map") { addShip(world, hull, -72, 90, 2); world.birthAim = 130 * world.shipScale; world.birthDir = [0.781, 0.625]; world.gate = { x: 450, z: -560, r: 36, reached: false }; } // born below-left of the great star, the only body there; the tangent at 260 rounds the star at 115 and passes within 253 of the gate at 7.7 simulated seconds',
     '  if (kind === "map") { addShip(world, hull, 75, 75, 2); world.birthAim = 130 * world.shipScale; world.birthDir = [0.707, -0.707]; world.gate = { x: -455, z: -455, r: 36, reached: false }; } // born below the great star, the only body there; the tangent at 260 rounds the star at 106 and passes within 169 of the gate at 6.4 simulated seconds', 'ship-and-gate')
print("all substitutions in")
PYEOF
```

Expected output, exact: `all substitutions in`.

**2. The battery.** From the repo root, save the block below as `/tmp/battery59.mjs` and run `node /tmp/battery59.mjs /home/batman/coldsnap`:

```js
// THE CLIMB BATTERY: seed 12345, one run — the sky builds, steps 5 simulated seconds, no numeric breakdown.
const dir = process.argv[2] || '.';
const {createHash} = await import('node:crypto');
const h = o => createHash('sha256').update(JSON.stringify(o)).digest('hex').slice(0,16);
const DG = await import(dir + '/src/game/gravitydebris/gen.js');
const DP = await import(dir + '/src/game/gravitydebris/phys.js');
const w = DG.makeScenario('map', 12345, 1);
console.log('map s1', h(w.blocks), 'blocks', w.blocks.length);
for (let s = 0; s < 300; s++) DP.stepWorld(w, {welds:true, sleep:true, hash:true, friction:true});
const nan = w.blocks.some(b => b.alive && !isFinite(b.x));
console.log('at 5s: alive ' + w.blocks.filter(b=>b.alive).length + '/' + w.blocks.length + ' | eaten ' + w.eaten + ' | NaN ' + nan);
console.log(nan ? 'STRUCTURE BROKE' : 'STRUCTURE HELD');
```

Acceptance: the final line prints `STRUCTURE HELD` and the NaN field reads `false`. The map number, block count, alive count, and eaten count print for the record and go in the report as printed.

Then confirm the proving range is untouched: `git status --short src/game/rubbleworlds src/game/RubbleWorlds.jsx` prints nothing.

**3. Gate.** `node scripts/gate.mjs smoke` — 23 PASS, 0 FAIL, one run. If the tool moves it to the background past its two-minute window, wait and read the pass from the tail of `.superpowers/gates.log` — do not start a second run.

**4. Version and build.** `MK = "0.5.54"`, then `npm run build`.

**5. Land.** Commit `src/game/gravitydebris/gen.js` and `src/version.js` only (subject `the vertical climb, 0.5.54`), push. The phase document's table adds row T59 — "The vertical climb: the star at the bottom and the gate at the top, twelve huge planets in four triads with six moons between, only the ship below the star" — LANDED (mark 0.5.54, the map number as the battery printed it, the smoke count); commit with this plan file, push. The live check is the acceptance, phone and desktop both.

## Report

- One line of outcome, then bullets.
- Read-confirmation first.
- The battery's printed lines, verbatim; the smoke count exactly.
- The proving range untouched — the empty git status — as its own labeled bullet.
- The map's generation number as printed, old `be765eb2bee66d6d` → new.
- Fixture seed: 12345; the module rolls fresh seeds at reset.
- Both commit hashes.
- Every deviation its own labeled bullet.
