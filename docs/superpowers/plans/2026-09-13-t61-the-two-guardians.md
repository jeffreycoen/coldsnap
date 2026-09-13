# T61: the two guardians (0.5.56)

Two triads instead of four, both riding directly on the line from the star to the gate, and the ship born farther back from the star. Debris module only; everything else stands as shipped.

- The two triads: rings 400 and 730 on bearing -135 — the exact star-to-gate line, gate at (-775, -775). Three 40,000-mass planets each, widths 60 and 75, hues and spins from the first two rows as they were.
- The ship moves back from (75, 75) to (160, 160) — twice as far below the star. The birth tangent is unchanged.
- The six moons and three caches stand where the stretch put them.

Design choices, stated plainly: the two rings, the shared bearing, the ship point. Seed 12345 is the fixture. The battery is structural — builds, steps 5 simulated seconds, no numeric breakdown; printed counts and map number go in the report, not pinned here.

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

# 1. two triads, both directly on the star-to-gate line
sub1(GEN, """    const TRIS = [
      [325, -135, 60, 40000, 40000, 40000, 18, -1],
      [510, -152, 75, 40000, 40000, 40000, 205, -1],
      [665, -118, 85, 40000, 40000, 40000, 145, 1],
      [835, -137, 95, 40000, 40000, 40000, 300, 1],
    ];""",
     """    const TRIS = [
      [400, -135, 60, 40000, 40000, 40000, 18, -1],
      [730, -135, 75, 40000, 40000, 40000, 205, -1],
    ];""", 'two-triads')

# 2. the ship farther back from the star
sub1(GEN, '  if (kind === "map") { addShip(world, hull, 75, 75, 2);',
     '  if (kind === "map") { addShip(world, hull, 160, 160, 2);', 'ship-back')
print("all substitutions in")
PYEOF
```

Expected output, exact: `all substitutions in`.

**2. The battery.** From the repo root, save the block below as `/tmp/battery61.mjs` and run `node /tmp/battery61.mjs /home/batman/coldsnap` once:

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

**4. Version and build.** `MK = "0.5.56"`, then `npm run build`.

**5. Land.** Commit `src/game/gravitydebris/gen.js` and `src/version.js` only (subject `the two guardians, 0.5.56`), push. The phase document's table adds row T61 — "The two guardians: two triads directly on the star-to-gate line, the ship born farther back" — LANDED (mark 0.5.56, the map number as the battery printed it, the smoke count); commit with this plan file, push. The live check is the acceptance, phone and desktop both.

## Report

- One line of outcome, then bullets.
- Read-confirmation first.
- The battery's printed lines, verbatim; the smoke count exactly.
- The proving range untouched — the empty git status — as its own labeled bullet.
- The map's generation number as printed, old `c79e3f86d3eaea2b` → new.
- Fixture seed: 12345; the module rolls fresh seeds at reset.
- Both commit hashes.
- Every deviation its own labeled bullet.
