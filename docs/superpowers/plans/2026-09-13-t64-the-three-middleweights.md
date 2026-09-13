# T64: the three middleweights (0.5.59)

Three medium planets join the wide line: one between the ship and the star, two between the star and the gate, spaced even-ish among the two huge drifters. Debris module only; everything else stands as shipped.

- Mass 10,000 each — a quarter of the huge drifters, well above the moons — sized by the standing density law, hues 145, 300, 48.
- Placement along the line: -163 (the ship's side of the star, between ship at -325 and the star), then 155 and 460 interleaving the huge drifters at 306 and 613 — the ladder reads 155, 306, 460, 613 out to the gate at 919.
- All three ride the drifter law as it stands: unparented from the star, three units of sideways creep, alternating direction.
- The drifter table gains a mass column; the loop reads it. No other change.

Design choices, stated plainly: the three positions, the 10,000 mass, the hues. Seed 12345 is the fixture. The battery is structural — builds, steps 5 simulated seconds, no numeric breakdown; printed counts and map number go in the report, not pinned here.

The substitution script was applied to a fresh copy of the live tree at plan-writing time: every anchor hit exactly once, the file parses.

## Required reading

- This plan, whole.
- `src/game/gravitydebris/gen.js` — the drifter table and loop in the map branch.

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

# 1. the table gains a mass column and three middleweights: one between ship and star (a negative ring runs the line backward), two interleaved between star and gate
sub1(GEN, """    const DRIFTERS = [
      [306, 3, 18], [613, -3, 205],
    ];""",
     """    const DRIFTERS = [ // [ring along the line, sideways creep, hue, mass] — a negative ring stands on the ship's side of the star
      [306, 3, 18, 40000], [613, -3, 205, 40000],
      [-163, -3, 145, 10000], [155, 3, 300, 10000], [460, -3, 48, 10000],
    ];""", 'table')

# 2. the loop reads the mass and sizes the body by it
sub1(GEN, """      const [ring, creep, hue] = DRIFTERS[ti];
      const px = lux * ring, pz = luz * ring;
      const vx = -luz * creep, vz = lux * creep; // sideways to the line, a few units, alternating
      const blocks = makePlanet(px, pz, vx, vz, ti % 2, rand, BS * 2.2 * Math.cbrt(40000 / 3200), 40000);""",
     """      const [ring, creep, hue, pm] = DRIFTERS[ti];
      const px = lux * ring, pz = luz * ring;
      const vx = -luz * creep, vz = lux * creep; // sideways to the line, a few units, alternating
      const blocks = makePlanet(px, pz, vx, vz, ti % 2, rand, BS * 2.2 * Math.cbrt(pm / 3200), pm);""", 'mass-column')
print("all substitutions in")
PYEOF
```

Expected output, exact: `all substitutions in`.

**2. The battery.** From the repo root, save the block below as `/tmp/battery64.mjs` and run `node /tmp/battery64.mjs /home/batman/coldsnap` once:

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

**4. Version and build.** `MK = "0.5.59"`, then `npm run build`.

**5. Land.** Commit `src/game/gravitydebris/gen.js` and `src/version.js` only (subject `the three middleweights, 0.5.59`), push. The phase document's table adds row T64 — "The three middleweights: one medium planet between ship and star, two interleaved between star and gate on the wide line" — LANDED (mark 0.5.59, the map number as the battery printed it, the smoke count); commit with this plan file, push. The live check is the acceptance, phone and desktop both.

## Report

- One line of outcome, then bullets.
- Read-confirmation first.
- The battery's printed lines, verbatim; the smoke count exactly.
- The proving range untouched — the empty git status — as its own labeled bullet.
- The map's generation number as printed, old `00f9bc42e6f412f1` → new.
- Fixture seed: 12345; the module rolls fresh seeds at reset.
- Both commit hashes.
- Every deviation its own labeled bullet.
