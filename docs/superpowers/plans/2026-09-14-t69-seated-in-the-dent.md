# T69: seated in the dent (0.5.64)

The floating fixed: the net sags by the full well depth but bodies were sunk only four tenths of it — the share carried from the ark, where dips were too shallow to show the gap. Every body and every trajectory line now rides at the full depth, so a planet rests in the bottom of its own dent and the ship sits on the mesh it surfs. One file, drawing only, three substitutions.

Design choices, stated plainly: the ride share becomes the full depth everywhere it was four tenths. Seed 12345 is the fixture. The battery is structural; the map number cannot move — drawing is the only change — and the battery proves it by printing `8786ec4da0bc7de8` unchanged.

The substitution script was applied to a fresh copy of the live tree at plan-writing time: every anchor hit its exact count, the file parses.

## Required reading

- This plan, whole.
- `src/game/gravitydebris/draw.js` — the block-painting loop and the three trajectory-line blocks.

## Suggested model

Sonnet. One pre-verified substitution script on one file; no design remains.

## Steps

**1. The substitutions.** From the repo root:

```bash
python3 - <<'PYEOF'
import sys
def subn(path, old, new, n, tag):
    s = open(path).read()
    if s.count(old) != n: sys.exit("anchor fail: %s (count %d, wanted %d)" % (tag, s.count(old), n))
    open(path, 'w').write(s.replace(old, new))
DRAW='src/game/gravitydebris/draw.js'

# every body and line rides at the FULL net depth: the net sags by the whole
# well, so a four-tenths ride left everything hanging above the mesh — worst
# exactly under a planet, where its own well is deepest
subn(DRAW, "        p.y += getD(lx(b), lz(b)) * 0.4; // the body rides the net, the ark's way",
     "        p.y += getD(lx(b), lz(b)); // the body sits ON the net: the full depth, a planet resting in the bottom of its own dent", 1, 'bodies')
subn(DRAW, "            p0.y += getD(q0.x, q0.z) * 0.4; p1.y += getD(q.x, q.z) * 0.4; // the line hugs the surface the ship rides",
     "            p0.y += getD(q0.x, q0.z); p1.y += getD(q.x, q.z); // the line hugs the surface the ship rides", 2, 'ghosts')
subn(DRAW, "          p0.y += getD(pts[i2 - stride][0], pts[i2 - stride][1]) * 0.4; p1.y += getD(pts[i2][0], pts[i2][1]) * 0.4;",
     "          p0.y += getD(pts[i2 - stride][0], pts[i2 - stride][1]); p1.y += getD(pts[i2][0], pts[i2][1]);", 1, 'pred')
print("all substitutions in")
PYEOF
```

Expected output, exact: `all substitutions in`.

**2. The battery.** From the repo root, save the block below as `/tmp/battery69.mjs` and run `node /tmp/battery69.mjs /home/batman/coldsnap` once:

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

Acceptance: the final line prints `STRUCTURE HELD`, NaN reads `false`, and the map number prints `8786ec4da0bc7de8` unchanged.

Then confirm the proving range is untouched: `git status --short src/game/rubbleworlds src/game/RubbleWorlds.jsx` prints nothing.

**3. Gate.** `node scripts/gate.mjs smoke` — 23 PASS, 0 FAIL, one run. If the tool moves it to the background past its two-minute window, wait and read the pass from the tail of `.superpowers/gates.log` — do not start a second run.

**4. Version and build.** `MK = "0.5.64"`, then `npm run build`.

**5. Land.** Commit `src/game/gravitydebris/draw.js` and `src/version.js` only (subject `seated in the dent, 0.5.64`), push. The phase document's table adds row T69 — "Seated in the dent: bodies and lines ride the net at full depth; the floating gap closes" — LANDED (mark 0.5.64, map number unchanged 8786ec4da0bc7de8, the smoke count); commit with this plan file, push. The live check is the acceptance, phone and desktop both.

## Report

- One line of outcome, then bullets.
- Read-confirmation first.
- The battery's printed lines, verbatim; the smoke count exactly.
- The proving range untouched — the empty git status — as its own labeled bullet.
- The map's generation number unchanged, its own labeled bullet.
- Fixture seed: 12345; the module rolls fresh seeds at reset.
- Both commit hashes.
- Every deviation its own labeled bullet.
