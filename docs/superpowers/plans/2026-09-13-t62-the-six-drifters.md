# T62: the six drifters (0.5.57)

The triads leave. Six huge planets stand evenly spaced on the star-to-gate line — rings 150, 300, 450, 600, 750, 900 on the gate bearing — each outside the star's family line, so the star does not pull them: no orbit, no fall. Each carries three units of sideways creep, alternating direction, and leans on its neighbors at one percent — a monument that drifts. Debris module only; moons, caches, ship, gate, and all physics stand as shipped.

- Six planets, 40,000 mass each, one hue apiece (18, 205, 145, 300, 48, 275).
- Unparented: the family law's standing rule — a body outside the star's line feels no star pull — carries the whole design; no physics change.
- Creep: 3 units crosswise to the line, alternating sign down the ladder.

Design choices, stated plainly: the six rings, the creep value and its alternation, the hues. Seed 12345 is the fixture. The battery is structural — builds, steps 5 simulated seconds, no numeric breakdown; printed counts and map number go in the report, not pinned here.

The substitution script was applied to a fresh copy of the live tree at plan-writing time: every anchor hit exactly once, the file parses.

## Required reading

- This plan, whole.
- `src/game/gravitydebris/gen.js` — the map branch, whole.

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

# 1. the table: six drifters on the line, each with a few units of sideways creep
sub1(GEN, """    const TRIS = [
      [400, -135, 60, 40000, 40000, 40000, 18, -1],
      [730, -135, 75, 40000, 40000, 40000, 205, -1],
    ];""",
     """    // THE SIX DRIFTERS: six huge planets evenly spaced on the star-to-gate
    // line, outside the star's family line, so the star does not pull them —
    // no orbit, no fall. Each carries a few units of sideways creep and leans
    // on its neighbors at one percent: a monument that drifts.
    const DRIFTERS = [
      [150, 3, 18], [300, -3, 205], [450, 3, 145], [600, -3, 300], [750, 3, 48], [900, -3, 275],
    ];""", 'drifter-table')

# 2. the loop: single planets, unparented, creeping crosswise to the line
sub1(GEN, """    let famN = 2;
    for (let ti = 0; ti < TRIS.length; ti++) {
      const [ring, angD, R2, m1, m2, m3, hue, spin] = TRIS[ti];
      const trip = [m1, m2, m3], M = m1 + m2 + m3, a = angD * Math.PI / 180;
      const bx = Math.cos(a) * ring, bz = Math.sin(a) * ring; // the weight-center rides the ring
      const vR = vCirc(MG, ring), rvx = -Math.sin(a) * vR, rvz = Math.cos(a) * vR; // every ring ride turns the same way
      const L = R2 * Math.sqrt(3);
      const om = Math.sqrt(G * M / Math.pow(L * L + SF * SF, 1.65)) * spin; // the table's spin: mixed, prograde only where the grip affords it
      // vertices on a circle about a geometric center shifted so the mass-weighted mean lands exactly on the ring point
      const raw = [0, 1, 2].map(i => { const th = i * 2 * Math.PI / 3 + ring + angD; return [Math.cos(th) * R2, Math.sin(th) * R2]; });
      let ox = 0, oz = 0; for (let i = 0; i < 3; i++) { ox += raw[i][0] * trip[i] / M; oz += raw[i][1] * trip[i] / M; }
      const tf = famN++; world.fam[tf] = 0;
      for (let i = 0; i < 3; i++) {
        const px = bx + raw[i][0] - ox, pz = bz + raw[i][1] - oz;
        const vx = rvx - (pz - bz) * om, vz = rvz + (px - bx) * om; // ring ride plus the spin about the weight-center
        const blocks = makePlanet(px, pz, vx, vz, ti % 2, rand, BS * 2.2 * Math.cbrt(trip[i] / 3200), trip[i]);
        const rgb = hsl(hue, 38 + i * 9, [62, 48, 38][i]);
        for (const b of blocks) { b.fam = tf; b.rgb = rgb; }
        world.blocks.push(...blocks);
      }
    }""",
     """    let famN = 2;
    const lineA = -135 * Math.PI / 180, lux = Math.cos(lineA), luz = Math.sin(lineA); // the star-to-gate line
    for (let ti = 0; ti < DRIFTERS.length; ti++) {
      const [ring, creep, hue] = DRIFTERS[ti];
      const px = lux * ring, pz = luz * ring;
      const vx = -luz * creep, vz = lux * creep; // sideways to the line, a few units, alternating
      const blocks = makePlanet(px, pz, vx, vz, ti % 2, rand, BS * 2.2 * Math.cbrt(40000 / 3200), 40000);
      const tf = famN++; world.fam[tf] = -1; // outside the star's family line: the star does not pull it
      const rgb = hsl(hue, 42, 50);
      for (const b of blocks) { b.fam = tf; b.rgb = rgb; }
      world.blocks.push(...blocks);
    }""", 'drifter-loop')
print("all substitutions in")
PYEOF
```

Expected output, exact: `all substitutions in`.

**2. The battery.** From the repo root, save the block below as `/tmp/battery62.mjs` and run `node /tmp/battery62.mjs /home/batman/coldsnap` once:

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

**4. Version and build.** `MK = "0.5.57"`, then `npm run build`.

**5. Land.** Commit `src/game/gravitydebris/gen.js` and `src/version.js` only (subject `the six drifters, 0.5.57`), push. The phase document's table adds row T62 — "The six drifters: six huge planets evenly spaced on the star-to-gate line, unparented from the star, creeping sideways at three units" — LANDED (mark 0.5.57, the map number as the battery printed it, the smoke count); commit with this plan file, push. The live check is the acceptance, phone and desktop both.

## Report

- One line of outcome, then bullets.
- Read-confirmation first.
- The battery's printed lines, verbatim; the smoke count exactly.
- The proving range untouched — the empty git status — as its own labeled bullet.
- The map's generation number as printed, old `65a3a809d257447e` → new.
- Fixture seed: 12345; the module rolls fresh seeds at reset.
- Both commit hashes.
- Every deviation its own labeled bullet.
