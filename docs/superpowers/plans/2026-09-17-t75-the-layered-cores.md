# T75: the layered cores (0.5.70)

Every planet on the map hollows into three layers: one big core block — four block-widths wide on the giants, capped there by the standing choice — a middle of double-width blocks, and the same single-block skin as before on the outside. Each block carries the mass of the volume it replaces, so the sphere, the total mass, and everything visible or strikeable are unchanged; the savings are all interior, where the solver and the gravity loop were paying for blocks nothing could ever see. Debris generation only, one file; moons stay as they were.

Measured on the plan check: a huge planet 587 blocks → 337; a middleweight 147 → 121; the map 7,017 → 4,189 — forty percent off, landing exactly where the awake thousands live. The block builder draws from the seeded roll differently, so the map's generation number changes and the battery counts shift with the new anatomy.

Design choices, stated plainly: the four-wide core cap, the double-width middle, the one-block skin, mass by replaced volume. Seed 12345 is the fixture. The battery is structural — builds, steps 5 simulated seconds, no numeric breakdown.

The substitution script was applied to a fresh copy of the live tree at plan-writing time: every anchor hit exactly once, the file parses, the acceptance below reproduced.

## Required reading

- This plan, whole.
- `src/game/gravitydebris/gen.js` — the map branch: the drifter table, the drifter loop, the triad loop.

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
GEN='src/game/gravitydebris/gen.js'

# 1. the layered builder, defined in the map branch beside the drifter table
subn(GEN, "    let famN = 2;\n    const lineA = -45 * Math.PI / 180,",
     """    const makeLayered = (cx, cz, vx, vz, tint, R, mass) => {
      // THE LAYERED CORE: one big core block, a middle of double-width blocks,
      // and a skin of single blocks — the same sphere and the same mass at
      // roughly half the blocks. Everything visible or strikeable is the same
      // single-block skin as before; the savings are all interior.
      const blocks = [];
      const put = (px, py, pz, pitch) => blocks.push({ x: cx + px + (rand() - 0.5), y: py + (rand() - 0.5), z: cz + pz + (rand() - 0.5), vx, vy: 0, vz, tint, alive: true, sleeping: false, clump: -1, s: pitch, cr: pitch * 0.55 });
      let half = BS * Math.floor((R - BS * 1.2) / (Math.sqrt(3) * BS)); if (half < BS) half = 0; // the largest whole-block cube whose corners stay inside the skin
      if (half > BS * 2) half = BS * 2; // capped at the ruled four-wide core
      if (half > 0) put(0, 0, 0, half * 2);
      const n2 = Math.ceil(R / (BS * 2));
      for (let ix = -n2; ix <= n2; ix++) for (let iy = -n2; iy <= n2; iy++) for (let iz = -n2; iz <= n2; iz++) {
        const px = ix * BS * 2, py = iy * BS * 2, pz = iz * BS * 2;
        if (Math.max(Math.abs(px), Math.abs(py), Math.abs(pz)) < half + BS) continue; // the core's ground
        if (Math.sqrt(px * px + py * py + pz * pz) > R - BS * 1.2) continue; // the skin's zone stays single
        put(px, py, pz, BS * 2);
      }
      const n1 = Math.ceil(R / BS);
      for (let ix = -n1; ix <= n1; ix++) for (let iy = -n1; iy <= n1; iy++) for (let iz = -n1; iz <= n1; iz++) {
        const px = ix * BS, py = iy * BS, pz = iz * BS;
        const r = Math.sqrt(px * px + py * py + pz * pz);
        if (r > R || r <= R - BS * 1.2) continue;
        put(px, py, pz, BS);
      }
      let cells = 0; for (const b of blocks) cells += (b.s / BS) ** 3;
      for (const b of blocks) b.m = mass * ((b.s / BS) ** 3) / cells; // mass by the volume each block replaces
      return blocks;
    };
    let famN = 2;
    const lineA = -45 * Math.PI / 180,""", 1, 'builder')

# 2. the drifters build layered
subn(GEN, "      const blocks = makePlanet(px, pz, vx, vz, ti % 2, rand, BS * 2.2 * Math.cbrt(pm / 3200), pm);",
     "      const blocks = makeLayered(px, pz, vx, vz, ti % 2, BS * 2.2 * Math.cbrt(pm / 3200), pm);", 1, 'drifters')

# 3. the triad members build layered
subn(GEN, "        const blocks = makePlanet(px, pz, vx, vz, (qi + i) % 2, rand, BS * 2.2 * Math.cbrt(40000 / 3200), 40000);",
     "        const blocks = makeLayered(px, pz, vx, vz, (qi + i) % 2, BS * 2.2 * Math.cbrt(40000 / 3200), 40000);", 1, 'triads')
print("all substitutions in")
PYEOF
```

Expected output, exact: `all substitutions in`.

**2. The battery.** From the repo root, save the block below as `/tmp/battery75.mjs` and run `node /tmp/battery75.mjs /home/batman/coldsnap` once:

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
map s1 335395ae939b0832 blocks 4189
at 5s: alive 2681/4189 | eaten 1885 | NaN false
STRUCTURE HELD
```

Then confirm the proving range is untouched: `git status --short src/game/rubbleworlds src/game/RubbleWorlds.jsx` prints nothing.

**3. Gate.** `node scripts/gate.mjs smoke` — 23 PASS, 0 FAIL, one run. If the tool moves it to the background past its two-minute window, wait and read the pass from the tail of `.superpowers/gates.log` — do not start a second run.

**4. Version and build.** `MK = "0.5.70"`, then `npm run build`.

**5. Land.** Commit `src/game/gravitydebris/gen.js` and `src/version.js` only (subject `the layered cores, 0.5.70`), push. The phase document's table adds row T75 — "The layered cores: every planet hollows to core, middle, and skin — same sphere and mass at forty percent fewer blocks" — LANDED (mark 0.5.70, debris map number f75a59862872fd01 → 335395ae939b0832, the smoke count); commit with this plan file, push. The live check is the acceptance, phone and desktop both — the step readout and the feel tell what the hollowing bought.

## Report

- One line of outcome, then bullets.
- Read-confirmation first.
- The battery's printed lines, verbatim; the smoke count exactly.
- The proving range untouched — the empty git status — as its own labeled bullet.
- The map's generation number as printed, old → new, its own labeled bullet.
- Fixture seed: 12345; the module rolls fresh seeds at reset.
- Both commit hashes.
- Every deviation its own labeled bullet.
