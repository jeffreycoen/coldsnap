# T63: the wide line (0.5.58)

The map swings back to left-to-right — the view's wide diagonal, where the screen gives the most room per unit. The star sits left, the gate right at (650, -650), and two huge planets stand evenly spaced on the line between them, at thirds: rings 306 and 613. The ship is born even farther from the star, at (-230, 230) on the far side — the only body there. Debris module only; the drifter law, moons, thrust, fuel, and all physics stand as shipped.

- Two 40,000-mass drifters on the line, unparented from the star, creeping sideways at three units in alternating directions, hues 18 and 205.
- The six moons take bearings around the new line at their standing rings; the three caches ride the line at (180, -140), (330, -290), (500, -420).
- The ship's birth distance grows from 226 to 325; the birth tangent rounds the star and heads down the line.

Design choices, stated plainly: the two rings at thirds, the gate and ship points, the moon bearings, the cache points. Seed 12345 is the fixture. The battery is structural — builds, steps 5 simulated seconds, no numeric breakdown; printed counts and map number go in the report, not pinned here.

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

# 1. two drifters, evenly spaced thirds of the way to the gate
sub1(GEN, """    const DRIFTERS = [
      [150, 3, 18], [300, -3, 205], [450, 3, 145], [600, -3, 300], [750, 3, 48], [900, -3, 275],
    ];""",
     """    const DRIFTERS = [
      [306, 3, 18], [613, -3, 205],
    ];""", 'two-drifters')

# 2. the line swings to left-to-right: the view's wide diagonal
sub1(GEN, "    const lineA = -135 * Math.PI / 180, lux = Math.cos(lineA), luz = Math.sin(lineA); // the star-to-gate line",
     "    const lineA = -45 * Math.PI / 180, lux = Math.cos(lineA), luz = Math.sin(lineA); // the star-to-gate line, left to right across the view's wide diagonal", 'line-bearing')

# 3. the moons ride bearings around the new line
sub1(GEN, "    for (const [mr, ma] of [[425, -122], [425, -152], [587, -136], [757, -155], [765, -118], [944, -128]]) {",
     "    for (const [mr, ma] of [[425, -32], [425, -58], [587, -37], [757, -60], [765, -30], [900, -52]]) {", 'moons')

# 4. the caches ride the new line
sub1(GEN, "    world.pickups = [{ x: -255, z: -340, fuel: 300, alive: true }, { x: -488, z: -342, fuel: 300, alive: true }, { x: -612, z: -729, fuel: 300, alive: true }];",
     "    world.pickups = [{ x: 180, z: -140, fuel: 300, alive: true }, { x: 330, z: -290, fuel: 300, alive: true }, { x: 500, z: -420, fuel: 300, alive: true }];", 'caches')

# 5. the ship even farther out behind the star; the gate right
sub1(GEN, '  if (kind === "map") { addShip(world, hull, 160, 160, 2); world.birthAim = 130 * world.shipScale; world.birthDir = [0.707, -0.707]; world.gate = { x: -775, z: -775, r: 36, reached: false }; } // born below the great star, the only body there; the birth tangent rounds the star and heads up the stretched climb',
     '  if (kind === "map") { addShip(world, hull, -230, 230, 2); world.birthAim = 130 * world.shipScale; world.birthDir = [0.707, 0.707]; world.gate = { x: 650, z: -650, r: 36, reached: false }; } // born far out on the far side of the star from the gate, the only body there; the birth tangent rounds the star and heads down the line', 'ship-and-gate')
print("all substitutions in")
PYEOF
```

Expected output, exact: `all substitutions in`.

**2. The battery.** From the repo root, save the block below as `/tmp/battery63.mjs` and run `node /tmp/battery63.mjs /home/batman/coldsnap` once:

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

Acceptance: the final line prints `STRUCTURE HELD` and the NaN field reads `false`. The printed counts and map number go in the report as printed.

Then confirm the proving range is untouched: `git status --short src/game/rubbleworlds src/game/RubbleWorlds.jsx` prints nothing.

**3. Gate.** `node scripts/gate.mjs smoke` — 23 PASS, 0 FAIL, one run. If the tool moves it to the background past its two-minute window, wait and read the pass from the tail of `.superpowers/gates.log` — do not start a second run.

**4. Version and build.** `MK = "0.5.58"`, then `npm run build`.

**5. Land.** Commit `src/game/gravitydebris/gen.js` and `src/version.js` only (subject `the wide line, 0.5.58`), push. The phase document's table adds row T63 — "The wide line: the map left to right again, two huge drifters at thirds between star and gate, the ship born farther out" — LANDED (mark 0.5.58, the map number as the battery printed it, the smoke count); commit with this plan file, push. The live check is the acceptance, phone and desktop both.

## Report

- One line of outcome, then bullets.
- Read-confirmation first.
- The battery's printed lines, verbatim; the smoke count exactly.
- The proving range untouched — the empty git status — as its own labeled bullet.
- The map's generation number as printed, old `3cad8d6acbaa479a` → new.
- Fixture seed: 12345; the module rolls fresh seeds at reset.
- Both commit hashes.
- Every deviation its own labeled bullet.
