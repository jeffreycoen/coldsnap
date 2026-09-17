# T71: the three giants (0.5.66)

Three giant triads join the wide line — rotating triangles of three 40,000-mass planets each, the triad mechanism returned. Two stand on the line among the drifters and creep sideways like them; the third rides a ring around the star as its child, sweeping the line once an orbit. They sit at 230, 530, and 750 along the line, widths 100 to 120, spins mixed. Chaos is the design: the placements interleave the standing drifters and nothing is smoothed. Debris module only.

- The triangle law as before: equal members, the pull sum points every member at the center with one shared turn rate, exact under the softened law.
- The two standing triads are unparented like the drifters; the orbiting one is the star's child at full pull, ring speed at 750.
- Geography rides along: each member mottled in the triad's hue with its own darker landmark country.
- Nine new giant planets; the sky roughly triples its planet mass.

Design choices, stated plainly: the three distances, widths, hues, spin signs, and which triad orbits. Seed 12345 is the fixture. The battery is structural — builds, steps 5 simulated seconds, no numeric breakdown; printed counts and map number go in the report, not pinned here.

The substitution script was applied to a fresh copy of the live tree at plan-writing time: the anchor hit exactly once, the file parses.

## Required reading

- This plan, whole.
- `src/game/gravitydebris/gen.js` — the map branch, whole.

## Suggested model

Sonnet. One pre-verified substitution on one file; no design remains.

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

# three giant triads on the line: two standing and creeping like the drifters,
# one riding a ring around the star — maximum chaos by design
sub1(GEN, "    // six small moons interspersed on their own rings, children of the star",
     """    // THREE GIANT TRIADS on the line: rotating triangles of three 40,000-mass
    // planets each. With equal members the pull sum points every member at the
    // triangle's center with one shared turn rate — exact under the softened
    // law. Two triads stand on the line and creep like the drifters; the third
    // rides a ring around the star as its child. Chaos is the design.
    // [distance along the line, vertex radius, hue, spin sign, orbits the star, sideways creep]
    const TRIADS = [
      [230, 100, 275, 1, 0, 3],
      [530, 110, 95, -1, 0, -3],
      [750, 120, 330, 1, 1, 0],
    ];
    for (let qi = 0; qi < TRIADS.length; qi++) {
      const [dist, R2, hue, sgn, orbits, creep] = TRIADS[qi];
      const cxT = lux * dist, czT = luz * dist, MT = 120000, L = R2 * Math.sqrt(3);
      const om = Math.sqrt(G * MT / Math.pow(L * L + SF * SF, 1.65)) * sgn;
      let bvx, bvz;
      if (orbits) { const v = vCirc(MG, dist); bvx = -luz * v; bvz = lux * v; } // the child rides its ring
      else { bvx = -luz * creep; bvz = lux * creep; }                          // the standing pair creeps like the drifters
      const tf = famN++; world.fam[tf] = orbits ? 0 : -1;
      for (let i = 0; i < 3; i++) {
        const th = i * 2 * Math.PI / 3 + dist;
        const px = cxT + Math.cos(th) * R2, pz = czT + Math.sin(th) * R2;
        const vx = bvx - (pz - czT) * om, vz = bvz + (px - cxT) * om;
        const blocks = makePlanet(px, pz, vx, vz, (qi + i) % 2, rand, BS * 2.2 * Math.cbrt(40000 / 3200), 40000);
        const capA = (hue * 0.7 + i) % (2 * Math.PI), capX = Math.cos(capA), capZ = Math.sin(capA);
        for (const b of blocks) {
          b.fam = tf;
          const ox = b.x - px, oz = b.z - pz, ol = Math.hypot(ox, oz) || 1;
          b.rgb = (ox * capX + oz * capZ) / ol > 0.6 ? hsl(hue, 52, 32) : hsl(hue, 42, 43 + Math.floor(rand() * 15));
        }
        world.blocks.push(...blocks);
      }
    }
    // six small moons interspersed on their own rings, children of the star""", 'triads')
print("all substitutions in")
PYEOF
```

Expected output, exact: `all substitutions in`.

**2. The battery.** From the repo root, save the block below as `/tmp/battery71.mjs` and run `node /tmp/battery71.mjs /home/batman/coldsnap` once:

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

**4. Version and build.** `MK = "0.5.66"`, then `npm run build`.

**5. Land.** Commit `src/game/gravitydebris/gen.js` and `src/version.js` only (subject `the three giants, 0.5.66`), push. The phase document's table adds row T71 — "The three giants: three giant triads on the line, two standing and creeping, one orbiting the star; chaos is the design" — LANDED (mark 0.5.66, the map number as the battery printed it, the smoke count); commit with this plan file, push. The live check is the acceptance, phone and desktop both.

## Report

- One line of outcome, then bullets.
- Read-confirmation first.
- The battery's printed lines, verbatim; the smoke count exactly.
- The proving range untouched — the empty git status — as its own labeled bullet.
- The map's generation number as printed, old `8786ec4da0bc7de8` → new.
- Fixture seed: 12345; the module rolls fresh seeds at reset.
- Both commit hashes.
- Every deviation its own labeled bullet.
