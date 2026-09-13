# T66: the tilted line (0.5.61)

The five planets keep their spacing along the line and each takes its own altitude off the flight plane — lifted or sunk, no two alike. Debris module only; nothing else changes.

- The drifter table gains a height column: 50 and -40 on the heavyweights; 80, -60, and 30 on the middleweights.
- The loop lifts every block of a body by its height at birth. The physics already carries the third axis — pulls, contacts, and the drawing all read it — and nothing pulls a body back to the plane, so the altitudes stand.
- The ship flies the plane as before; a body above or below it passes over or under the flight line by the full three-way distance.

Design choices, stated plainly: the five heights. Seed 12345 is the fixture. The battery is structural — builds, steps 5 simulated seconds, no numeric breakdown; printed counts and map number go in the report, not pinned here.

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

# 1. the table gains a height column: same spacing along the line, each planet at its own altitude
sub1(GEN, """    const DRIFTERS = [ // [ring along the line, sideways creep, hue, mass, spin] — a negative ring stands on the ship's side of the star; spin turns the body about its own center, each at its own rate
      [306, 3, 18, 40000, 0.15], [613, -3, 205, 40000, -0.2],
      [-163, -3, 145, 10000, 0.35], [155, 3, 300, 10000, -0.25], [460, -3, 48, 10000, 0.1],
    ];""",
     """    const DRIFTERS = [ // [ring along the line, sideways creep, hue, mass, spin, height] — a negative ring stands on the ship's side of the star; spin turns the body about its own center; height lifts or sinks the whole body off the flight plane, spacing along the line unchanged
      [306, 3, 18, 40000, 0.15, 50], [613, -3, 205, 40000, -0.2, -40],
      [-163, -3, 145, 10000, 0.35, 80], [155, 3, 300, 10000, -0.25, -60], [460, -3, 48, 10000, 0.1, 30],
    ];""", 'height-column')

# 2. the loop lifts each body to its altitude
sub1(GEN, """      const [ring, creep, hue, pm, spin] = DRIFTERS[ti];""",
     """      const [ring, creep, hue, pm, spin, lift] = DRIFTERS[ti];""", 'height-read')
sub1(GEN, """      for (const b of blocks) { b.fam = tf; b.rgb = rgb; b.vx += -(b.z - pz) * spin; b.vz += (b.x - px) * spin; } // the body's own turn: every block carries its share, the welds hold the ball""",
     """      for (const b of blocks) { b.fam = tf; b.rgb = rgb; b.vx += -(b.z - pz) * spin; b.vz += (b.x - px) * spin; b.y += lift; } // the body's own turn, and its own altitude off the flight plane""", 'height-lift')
print("all substitutions in")
PYEOF
```

Expected output, exact: `all substitutions in`.

**2. The battery.** From the repo root, save the block below as `/tmp/battery66.mjs` and run `node /tmp/battery66.mjs /home/batman/coldsnap` once:

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

**4. Version and build.** `MK = "0.5.61"`, then `npm run build`.

**5. Land.** Commit `src/game/gravitydebris/gen.js` and `src/version.js` only (subject `the tilted line, 0.5.61`), push. The phase document's table adds row T66 — "The tilted line: each planet at its own altitude off the flight plane, spacing along the line unchanged" — LANDED (mark 0.5.61, the map number as the battery printed it, the smoke count); commit with this plan file, push. The live check is the acceptance, phone and desktop both.

## Report

- One line of outcome, then bullets.
- Read-confirmation first.
- The battery's printed lines, verbatim; the smoke count exactly.
- The proving range untouched — the empty git status — as its own labeled bullet.
- The map's generation number as printed, old `df36ab3abc2baf63` → new.
- Fixture seed: 12345; the module rolls fresh seeds at reset.
- Both commit hashes.
- Every deviation its own labeled bullet.
