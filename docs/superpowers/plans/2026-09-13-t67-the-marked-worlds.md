# T67: the marked worlds (0.5.62)

Each planet gets geography in its own pre-chosen tone, so the rotation the physics already carries reads on screen: mottled shades of the planet's hue across the surface, and one darker landmark country per planet for the eye to track through a full turn. The sun-side lighting stays as it is — correct and fixed; the pattern is what turns. Debris module only, generation only.

- Mottling: every block takes a lightness drawn between 43 and 57 around the planet's hue, fixed at birth from the map's own seeded roll.
- Landmark: one cap of blocks per planet — bearing set by the planet's own hue, so no two sit alike — in the same hue, darker and deeper (lightness 32, saturation 52).
- No renderer change, no physics change; the blocks already carry their own colors.

Design choices, stated plainly: the mottle range, the cap threshold and shade, the hue-born bearing. The mottling draws from the seeded roll, so the map's generation number changes. Seed 12345 is the fixture. The battery is structural — builds, steps 5 simulated seconds, no numeric breakdown; printed counts and map number go in the report, not pinned here.

The substitution script was applied to a fresh copy of the live tree at plan-writing time: every anchor hit exactly once, the file parses.

## Required reading

- This plan, whole.
- `src/game/gravitydebris/gen.js` — the drifter loop in the map branch.

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

# geography in the planet's own tone: mottled shades of its hue, and one darker
# landmark cap per planet so a full turn reads at a glance
sub1(GEN, """      const rgb = hsl(hue, 42, 50);
      for (const b of blocks) { b.fam = tf; b.rgb = rgb; b.vx += -(b.z - pz) * spin; b.vz += (b.x - px) * spin; b.y += lift; } // the body's own turn, and its own altitude off the flight plane""",
     """      const capA = (hue * 0.7 + ti) % (2 * Math.PI), capX = Math.cos(capA), capZ = Math.sin(capA); // the landmark's bearing, born of the planet's own hue
      for (const b of blocks) {
        b.fam = tf;
        const ox = b.x - px, oz = b.z - pz, ol = Math.hypot(ox, oz) || 1;
        const mark = (ox * capX + oz * capZ) / ol > 0.6; // the landmark cap: a darker country in the same tone
        b.rgb = mark ? hsl(hue, 52, 32) : hsl(hue, 42, 43 + Math.floor(rand() * 15)); // mottled shades of the planet's own hue
        b.vx += -(b.z - pz) * spin; b.vz += (b.x - px) * spin; b.y += lift; // the body's own turn, and its own altitude off the flight plane
      }""", 'geography')
print("all substitutions in")
PYEOF
```

Expected output, exact: `all substitutions in`.

**2. The battery.** From the repo root, save the block below as `/tmp/battery67.mjs` and run `node /tmp/battery67.mjs /home/batman/coldsnap` once:

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

**4. Version and build.** `MK = "0.5.62"`, then `npm run build`.

**5. Land.** Commit `src/game/gravitydebris/gen.js` and `src/version.js` only (subject `the marked worlds, 0.5.62`), push. The phase document's table adds row T67 — "The marked worlds: mottled shades of each planet's own hue and one darker landmark country, so the turning reads" — LANDED (mark 0.5.62, the map number as the battery printed it, the smoke count); commit with this plan file, push. The live check is the acceptance, phone and desktop both.

## Report

- One line of outcome, then bullets.
- Read-confirmation first.
- The battery's printed lines, verbatim; the smoke count exactly.
- The proving range untouched — the empty git status — as its own labeled bullet.
- The map's generation number as printed, old `a556a3a78dda5475` → new.
- Fixture seed: 12345; the module rolls fresh seeds at reset.
- Both commit hashes.
- Every deviation its own labeled bullet.
