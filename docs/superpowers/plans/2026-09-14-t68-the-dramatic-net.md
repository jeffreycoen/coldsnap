# T68: the dramatic net (0.5.63)

Gravity shows itself: the net deepens, every planet prints its own well, the mesh blackens as it falls, and every body — ship, planets, moons — rides the sag, sunk by a share of the well beneath it. This is the ark's own look, carried to the debris map. Drawing only; the physics is untouched, and the debris draw file is the only file that changes.

- The sag rises from a tenth to a quarter of the full depth.
- The planets' weight in the well arithmetic rises from 0.38 to 0.7 (cap raised with it), so each drifter dents the net visibly beside the star's basin.
- The line darkening into wells rises from 0.5 to 0.8, both weave directions.
- Every block draws sunk by four tenths of the well under it — the ship surfs the same surface — and all three trajectory-line kinds hug that surface with it.

Design choices, stated plainly: the four numbers above and the four-tenths ride share. Seed 12345 is the fixture. The battery is structural — builds, steps 5 simulated seconds, no numeric breakdown; the map's generation number cannot move, drawing being the only change, and the battery proves it by printing it.

The substitution script was applied to a fresh copy of the live tree at plan-writing time: every anchor hit its exact count, the file parses.

## Required reading

- This plan, whole.
- `src/game/gravitydebris/draw.js` — the well arithmetic, the net block, the block-painting loop, the three trajectory-line blocks.

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

# 1. the net sags at a quarter instead of a tenth, and every body RIDES it — the ark's own look
subn(DRAW, """      // ONE PLANE: every body draws on the flat plane, and the net beneath sags
      // only faintly — a tenth of the depth it once had — so mass still reads in
      // the weave while no body ever hangs above a hole or sinks into one.
      const getD = (sx2, sz2) => wellDepth(sx2, sz2, world.wells, sc) * 0.1;""",
     """      // THE DRAMATIC NET: the weave sags at a quarter depth and every body
      // rides it — sunk by a share of the well under it, the ark's own look.
      const getD = (sx2, sz2) => wellDepth(sx2, sz2, world.wells, sc) * 0.25;""", 1, 'sag')

# 2. each planet prints its own well: the planet weight rises from 0.38 to 0.7
subn(DRAW, "  return Math.min(Math.sqrt(pP) * 0.38, 150) * sc + Math.min(Math.sqrt(pD) * 1.15, 560) * sc;",
     "  return Math.min(Math.sqrt(pP) * 0.7, 260) * sc + Math.min(Math.sqrt(pD) * 1.15, 560) * sc;", 1, 'planet-weight')

# 3. the mesh blackens into the wells: darkening from 0.5 to 0.8, both line directions
subn(DRAW, "        const a = fade * 0.18 + w * 0.5; if (a < 0.005) continue;",
     "        const a = fade * 0.18 + w * 0.8; if (a < 0.005) continue;", 2, 'darkening')

# 4. every block rides the net at four tenths of the well beneath it — ship and planets alike
subn(DRAW, """        const p = iso(lx(b), lz(b), ly(b)), rgb = b.ship ? tints[b.tint] : struck ? [214, 74, 52] : (b.rgb || tints[b.tint]);""",
     """        const p = iso(lx(b), lz(b), ly(b)), rgb = b.ship ? tints[b.tint] : struck ? [214, 74, 52] : (b.rgb || tints[b.tint]);
        p.y += getD(lx(b), lz(b)) * 0.4; // the body rides the net, the ark's way""", 1, 'bodies-ride')

# 5. the flight lines ride the same surface: both ghosts
subn(DRAW, """            const p0 = iso(q0.x, q0.z, 0), p1 = iso(q.x, q.z, 0);""",
     """            const p0 = iso(q0.x, q0.z, 0), p1 = iso(q.x, q.z, 0);
            p0.y += getD(q0.x, q0.z) * 0.4; p1.y += getD(q.x, q.z) * 0.4; // the line hugs the surface the ship rides""", 2, 'ghosts-ride')

# 6. and the planets' short projected lines
subn(DRAW, """          const p0 = iso(pts[i2 - stride][0], pts[i2 - stride][1], 0), p1 = iso(pts[i2][0], pts[i2][1], 0);""",
     """          const p0 = iso(pts[i2 - stride][0], pts[i2 - stride][1], 0), p1 = iso(pts[i2][0], pts[i2][1], 0);
          p0.y += getD(pts[i2 - stride][0], pts[i2 - stride][1]) * 0.4; p1.y += getD(pts[i2][0], pts[i2][1]) * 0.4;""", 1, 'pred-ride')
print("all substitutions in")
PYEOF
```

Expected output, exact: `all substitutions in`.

**2. The battery.** From the repo root, save the block below as `/tmp/battery68.mjs` and run `node /tmp/battery68.mjs /home/batman/coldsnap` once:

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

Acceptance: the final line prints `STRUCTURE HELD`, NaN reads `false`, and the map number prints `8786ec4da0bc7de8` unchanged — drawing was the only change.

Then confirm the proving range is untouched: `git status --short src/game/rubbleworlds src/game/RubbleWorlds.jsx` prints nothing.

**3. Gate.** `node scripts/gate.mjs smoke` — 23 PASS, 0 FAIL, one run. If the tool moves it to the background past its two-minute window, wait and read the pass from the tail of `.superpowers/gates.log` — do not start a second run.

**4. Version and build.** `MK = "0.5.63"`, then `npm run build`.

**5. Land.** Commit `src/game/gravitydebris/draw.js` and `src/version.js` only (subject `the dramatic net, 0.5.63`), push. The phase document's table adds row T68 — "The dramatic net: the sag at a quarter, every planet printing its own well, the mesh blackening, and every body riding the surface" — LANDED (mark 0.5.63, map number unchanged 8786ec4da0bc7de8, the smoke count); commit with this plan file, push. The live check is the acceptance, phone and desktop both.

## Report

- One line of outcome, then bullets.
- Read-confirmation first.
- The battery's printed lines, verbatim; the smoke count exactly.
- The proving range untouched — the empty git status — as its own labeled bullet.
- The map's generation number unchanged, its own labeled bullet.
- Fixture seed: 12345; the module rolls fresh seeds at reset.
- Both commit hashes.
- Every deviation its own labeled bullet.
