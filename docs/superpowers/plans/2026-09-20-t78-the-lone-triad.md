# T78: the lone triad (0.5.73)

The standing creeper triad at 230 leaves. The triad that orbits the star at 750 stays — the last triangle on the map — with the five drifters and six moons. The map drops from 3,178 blocks to 2,167. One table row, one file.

Design choices, stated plainly: the removed row is the standing creeper; the orbiting triad, the named design, stays. Seed 12345 is the fixture.

The substitution script was applied to a fresh copy of the live tree at plan-writing time: the anchor hit exactly once, the file parses, the acceptance below reproduced.

## Required reading

- This plan, whole.
- `src/game/gravitydebris/gen.js` — the triad table in the map branch.

## Suggested model

Sonnet. One pre-verified substitution on one file; no design remains.

## Steps

**1. The substitutions.** From the repo root:

```bash
python3 - <<'PYEOF'
import sys
def subn(path, old, new, n, tag):
    s = open(path).read()
    if s.count(old) != n: sys.exit("anchor fail: %s (count %d, wanted %d)" % (tag, s.count(old), n))
    open(path, 'w').write(s.replace(old, new))
GEN='src/game/gravitydebris/gen.js'

# the standing creeper leaves; the triad that orbits the star stays alone
subn(GEN, """    const TRIADS = [
      [230, 100, 275, 1, 0, 3],
      [750, 120, 330, 1, 1, 0],
    ];""",
     """    const TRIADS = [
      [750, 120, 330, 1, 1, 0],
    ];""", 1, 'one-triad')
print("all substitutions in")
PYEOF
```

Expected output, exact: `all substitutions in`.

**2. The battery.** From the repo root, save the block below as `/tmp/battery78.mjs` and run `node /tmp/battery78.mjs /home/batman/coldsnap` once:

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

Acceptance, exact — every line:

```
map s1 f36d2b880371b41c blocks 2167
at 5s: alive 1789/2167 | eaten 537 | NaN false
STRUCTURE HELD
```

Then confirm the proving range is untouched: `git status --short src/game/rubbleworlds src/game/RubbleWorlds.jsx` prints nothing.

**3. Gate.** `node scripts/gate.mjs smoke` — 23 PASS, 0 FAIL, one run. If the tool moves it to the background past its two-minute window, wait and read the pass from the tail of `.superpowers/gates.log` — do not start a second run.

**4. Version and build.** `MK = "0.5.73"`, then `npm run build`.

**5. Land.** Commit `src/game/gravitydebris/gen.js` and `src/version.js` only (subject `the lone triad, 0.5.73`), push. The phase document's table adds row T78 — "The lone triad: the standing creeper leaves; the star-orbiting triangle stays alone" — LANDED (mark 0.5.73, debris map number 48f7043b2d4f20b7 → f36d2b880371b41c, the smoke count); commit with this plan file, push. The live check is the acceptance, phone and desktop both.

## Report

- One line of outcome, then bullets.
- Read-confirmation first.
- The battery's printed lines, verbatim; the smoke count exactly.
- The proving range untouched — the empty git status — as its own labeled bullet.
- The map's generation number as printed, old → new, its own labeled bullet.
- Fixture seed: 12345; the module rolls fresh seeds at reset.
- Both commit hashes.
- Every deviation its own labeled bullet.
