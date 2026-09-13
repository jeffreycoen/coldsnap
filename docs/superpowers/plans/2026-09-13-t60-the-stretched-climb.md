# T60: the stretched climb (0.5.55)

The climb stretches by 1.7. The view draws the screen's up-down diagonal at half scale against 0.87 sideways, so the vertical corridor rendered 58 percent as roomy as the same spacing would read across the screen — that is the crowding on the live build. Every ring, moon, cache, and the gate multiplies its distance from the star by 1.7; bearings, widths, masses, spins, the ship, and all physics stand as shipped. Debris module only.

- Rings 325, 510, 665, 835 (from 190, 300, 390, 490). Moons and caches stretched by the same factor. The gate at (-775, -775). The span at 1100 to carry the taller sky.
- The birth tangent is unchanged; it rounds the star and heads up the stretched climb.

Design choices, stated plainly: the 1.7 factor and every stretched coordinate above. Seed 12345 is the fixture. The battery is structural — the sky builds, steps 5 simulated seconds, no numeric breakdown; its printed counts and map number go in the report, not pinned here.

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

# 1. the climb stretches by 1.7: the screen draws the up-down diagonal at half
#    scale against 0.87 sideways, so the rings buy back what the view takes
sub1(GEN, """    const TRIS = [
      [190, -135, 60, 40000, 40000, 40000, 18, -1],
      [300, -152, 75, 40000, 40000, 40000, 205, -1],
      [390, -118, 85, 40000, 40000, 40000, 145, 1],
      [490, -137, 95, 40000, 40000, 40000, 300, 1],
    ];""",
     """    const TRIS = [
      [325, -135, 60, 40000, 40000, 40000, 18, -1],
      [510, -152, 75, 40000, 40000, 40000, 205, -1],
      [665, -118, 85, 40000, 40000, 40000, 145, 1],
      [835, -137, 95, 40000, 40000, 40000, 300, 1],
    ];""", 'stretched-rings')

# 2. the moons stretch with the climb
sub1(GEN, "    for (const [mr, ma] of [[250, -122], [250, -152], [345, -136], [445, -155], [450, -118], [555, -128]]) {",
     "    for (const [mr, ma] of [[425, -122], [425, -152], [587, -136], [757, -155], [765, -118], [944, -128]]) {", 'stretched-moons')

# 3. the caches stretch with the climb
sub1(GEN, "    world.pickups = [{ x: -150, z: -200, fuel: 300, alive: true }, { x: -287, z: -201, fuel: 300, alive: true }, { x: -360, z: -429, fuel: 300, alive: true }];",
     "    world.pickups = [{ x: -255, z: -340, fuel: 300, alive: true }, { x: -488, z: -342, fuel: 300, alive: true }, { x: -612, z: -729, fuel: 300, alive: true }];", 'stretched-caches')

# 4. the span carries the taller sky
sub1(GEN, "    world.span = 750; // the map's length and width stay the former size, like the ship; only the bodies are doubled",
     "    world.span = 1100; // the climb stretched by 1.7 against the view's vertical squeeze", 'span')

# 5. the gate rides out to the stretched top
sub1(GEN, '  if (kind === "map") { addShip(world, hull, 75, 75, 2); world.birthAim = 130 * world.shipScale; world.birthDir = [0.707, -0.707]; world.gate = { x: -455, z: -455, r: 36, reached: false }; } // born below the great star, the only body there; the tangent at 260 rounds the star at 106 and passes within 169 of the gate at 6.4 simulated seconds',
     '  if (kind === "map") { addShip(world, hull, 75, 75, 2); world.birthAim = 130 * world.shipScale; world.birthDir = [0.707, -0.707]; world.gate = { x: -775, z: -775, r: 36, reached: false }; } // born below the great star, the only body there; the birth tangent rounds the star and heads up the stretched climb', 'gate')
print("all substitutions in")
PYEOF
```

Expected output, exact: `all substitutions in`.

**2. The battery.** From the repo root, save the block below as `/tmp/battery60.mjs` and run `node /tmp/battery60.mjs /home/batman/coldsnap` once:

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

**4. Version and build.** `MK = "0.5.55"`, then `npm run build`.

**5. Land.** Commit `src/game/gravitydebris/gen.js` and `src/version.js` only (subject `the stretched climb, 0.5.55`), push. The phase document's table adds row T60 — "The stretched climb: every distance up the corridor times 1.7 against the view's vertical squeeze" — LANDED (mark 0.5.55, the map number as the battery printed it, the smoke count); commit with this plan file, push. The live check is the acceptance, phone and desktop both.

## Report

- One line of outcome, then bullets.
- Read-confirmation first.
- The battery's printed lines, verbatim; the smoke count exactly.
- The proving range untouched — the empty git status — as its own labeled bullet.
- The map's generation number as printed, old `0042bbc97d9feedd` → new.
- Fixture seed: 12345; the module rolls fresh seeds at reset.
- Both commit hashes.
- Every deviation its own labeled bullet.
