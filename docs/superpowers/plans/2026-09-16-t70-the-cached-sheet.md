# T70: the cached sheet (0.5.65)

The net's depth sheet is stored in memory and reused. The mesh was recomputing the power-law well depth at all 3249 grid points every drawn frame; the wells creep slowly, so the sheet now recomputes only every tenth frame — or at once when the camera's grid snap moves — and the frames between reuse it. Screen positions still rebuild every frame from the cached depths, so panning stays smooth and nothing visible changes but the cost. Drawing only, one file; the physics is untouched.

Design choices, stated plainly: the ten-frame sheet age and the camera-snap refresh. Seed 12345 is the fixture. The battery is structural; the map number cannot move — drawing is the only change — and the battery proves it by printing `8786ec4da0bc7de8` unchanged. The step and frame readout on the live build is the measure of the gain.

The substitution script was applied to a fresh copy of the live tree at plan-writing time: the anchor hit exactly once, the file parses.

## Required reading

- This plan, whole.
- `src/game/gravitydebris/draw.js` — the net block.

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
DRAW='src/game/gravitydebris/draw.js'

# the depth sheet is cached in memory and reused: the wells creep slowly, so the
# expensive power-law depth at all 3249 grid points recomputes only every tenth
# frame, or when the camera's grid snap moves; the screen positions still
# rebuild every frame from the cached depths
sub1(DRAW, "      const gxa = new Float32Array((gN + 1) ** 2), gya = new Float32Array((gN + 1) ** 2);\n      for (let ix = 0; ix <= gN; ix++) for (let iz = 0; iz <= gN; iz++) { const sx2 = ix * gSp - halfG + gcx, sz2 = iz * gSp - halfG + gcz, d = getD(sx2, sz2), idx = ix * (gN + 1) + iz; gxa[idx] = cx + (sx2 - sz2) * C30 * sc; gya[idx] = cy + (sx2 + sz2) * S30 * sc + d; }",
     """      const gxa = new Float32Array((gN + 1) ** 2), gya = new Float32Array((gN + 1) ** 2);
      let nd = world._netD; // the cached depth sheet: reused while the camera grid holds and the sheet is younger than ten frames
      if (!nd || nd.gcx !== gcx || nd.gcz !== gcz || frame - nd.f0 >= 10) {
        nd = { gcx, gcz, f0: frame, d: new Float32Array((gN + 1) ** 2) };
        for (let ix = 0; ix <= gN; ix++) for (let iz = 0; iz <= gN; iz++) nd.d[ix * (gN + 1) + iz] = getD(ix * gSp - halfG + gcx, iz * gSp - halfG + gcz);
        world._netD = nd;
      }
      for (let ix = 0; ix <= gN; ix++) for (let iz = 0; iz <= gN; iz++) { const sx2 = ix * gSp - halfG + gcx, sz2 = iz * gSp - halfG + gcz, idx = ix * (gN + 1) + iz; gxa[idx] = cx + (sx2 - sz2) * C30 * sc; gya[idx] = cy + (sx2 + sz2) * S30 * sc + nd.d[idx]; }""", 'net-cache')
print("all substitutions in")
PYEOF
```

Expected output, exact: `all substitutions in`.

**2. The battery.** From the repo root, save the block below as `/tmp/battery70.mjs` and run `node /tmp/battery70.mjs /home/batman/coldsnap` once:

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

**4. Version and build.** `MK = "0.5.65"`, then `npm run build`.

**5. Land.** Commit `src/game/gravitydebris/draw.js` and `src/version.js` only (subject `the cached sheet, 0.5.65`), push. The phase document's table adds row T70 — "The cached sheet: the net's depth sheet reused between frames, recomputed every tenth or on a camera snap" — LANDED (mark 0.5.65, map number unchanged 8786ec4da0bc7de8, the smoke count); commit with this plan file, push. The live check is the acceptance, phone and desktop both — the frame readout tells the gain.

## Report

- One line of outcome, then bullets.
- Read-confirmation first.
- The battery's printed lines, verbatim; the smoke count exactly.
- The proving range untouched — the empty git status — as its own labeled bullet.
- The map's generation number unchanged, its own labeled bullet.
- Fixture seed: 12345; the module rolls fresh seeds at reset.
- Both commit hashes.
- Every deviation its own labeled bullet.
