# T73: the two tables (0.5.68)

The step's two hottest costs move into memory. First, the family table: who is kin to whom never changes after birth, so the ancestor walk that ran per pair, millions of times a step, now answers once per family pair and the answer lives in a table — exact, no arithmetic changes. Second, the power table: distance to the 1.65 is pre-computed across the map's whole range and read back with interpolation — two lookups and a blend in place of the step's single most expensive call; distances beyond the table fall back to the real arithmetic. The live step alone reads the table; the ghost predictor keeps the exact arithmetic it had. Physics file only.

The power table is an approximation near one part in a hundred thousand, so the map's evolution shifts by that rounding: the battery's alive and eaten counts may differ from the last task's, and the birth number cannot move — generation does not touch the table.

Design choices, stated plainly: the table's 8192 entries and its range; the family memo keyed per pair. Seed 12345 is the fixture. The battery is structural — builds, steps 5 simulated seconds, no numeric breakdown; the map number must print `f75a59862872fd01` unchanged, the counts go in the report as printed.

The substitution script was applied to a fresh copy of the live tree at plan-writing time: every anchor hit its exact count, the file parses.

## Required reading

- This plan, whole.
- `src/game/gravitydebris/phys.js` — the family-weight function and the pull arithmetic.

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
PHYS='src/game/gravitydebris/phys.js'

# 1. THE POWER TABLE: distance^1.65 pre-computed over the map's whole range and
#    read back with interpolation — the step's single most expensive arithmetic
#    becomes two lookups and a blend. Distances beyond the table fall back to
#    the real arithmetic. Placed before famW; used by the live step only.
subn(PHYS, "function famW(world, fa, fb) {",
     """const POW_N = 8192, POW_L0 = Math.log2(SF * SF), POW_L1 = 24, POW_S = (POW_L1 - POW_L0) / POW_N;
const POW_T = new Float64Array(POW_N + 2);
for (let i = 0; i <= POW_N + 1; i++) POW_T[i] = Math.pow(2, (POW_L0 + i * POW_S) * 1.65);
const pow165 = (r2) => { // distance^1.65 from the table; beyond its range, the real arithmetic
  const l = Math.log2(r2); if (l >= POW_L1) return Math.pow(r2, 1.65);
  const f = (l - POW_L0) / POW_S, i = f | 0, t = f - i;
  return POW_T[i] * (1 - t) + POW_T[i + 1] * t;
};
// THE FAMILY TABLE: who is kin to whom never changes after birth, so the
// ancestor walk answers once per pair and the answer lives in memory.
function famW(world, fa, fb) {
  if (fa == null || fb == null) return 1;
  if (fa === fb) return 1;
  const memo = world._famW || (world._famW = new Map());
  const key = (fa + 2) * 4096 + (fb + 2);
  const hit = memo.get(key); if (hit !== undefined) return hit;
  const w = famWalk(world, fa, fb);
  memo.set(key, w); return w;
}
function famWalk(world, fa, fb) {""", 1, 'tables-in')

# 2. the live step reads the table: the shared pull sums and the star loop
subn(PHYS, "const r2 = dx * dx + dy * dy + dz * dz + SF * SF, rn = Math.pow(r2, 1.65);",
     "const r2 = dx * dx + dy * dy + dz * dz + SF * SF, rn = pow165(r2);", 3, 'pull-sites')
subn(PHYS, "        const dx = o.x - st.x, dz = o.z - st.z, r2 = dx * dx + dz * dz + SF * SF, rn = Math.pow(r2, 1.65);",
     "        const dx = o.x - st.x, dz = o.z - st.z, r2 = dx * dx + dz * dz + SF * SF, rn = pow165(r2);", 1, 'star-site')
print("all substitutions in")
PYEOF
```

Expected output, exact: `all substitutions in`.

**2. The battery.** From the repo root, save the block below as `/tmp/battery73.mjs` and run `node /tmp/battery73.mjs /home/batman/coldsnap` once:

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

Acceptance: the final line prints `STRUCTURE HELD`, NaN reads `false`, and the map number prints `f75a59862872fd01` unchanged. The alive and eaten counts go in the report as printed.

Then confirm the proving range is untouched: `git status --short src/game/rubbleworlds src/game/RubbleWorlds.jsx` prints nothing.

**3. Gate.** `node scripts/gate.mjs smoke` — 23 PASS, 0 FAIL, one run. If the tool moves it to the background past its two-minute window, wait and read the pass from the tail of `.superpowers/gates.log` — do not start a second run.

**4. Version and build.** `MK = "0.5.68"`, then `npm run build`.

**5. Land.** Commit `src/game/gravitydebris/phys.js` and `src/version.js` only (subject `the two tables, 0.5.68`), push. The phase document's table adds row T73 — "The two tables: the family walk memorized exactly; the power law read from an interpolated table in the live step" — LANDED (mark 0.5.68, map birth number unchanged f75a59862872fd01, the smoke count); commit with this plan file, push. The live check is the acceptance, phone and desktop both — the step readout tells the gain.

## Report

- One line of outcome, then bullets.
- Read-confirmation first.
- The battery's printed lines, verbatim; the smoke count exactly.
- The proving range untouched — the empty git status — as its own labeled bullet.
- The map's birth number unchanged, its own labeled bullet; changed evolution counts stated as expected by the plan.
- Fixture seed: 12345; the module rolls fresh seeds at reset.
- Both commit hashes.
- Every deviation its own labeled bullet.
