# T92: the plain roots (0.5.87)

The three table-and-root improvements land together. In the debris physics, every `Math.hypot` — twenty-two sites — becomes a plain square root through one small helper; these distances never overflow, and the overflow-safe form was paying for protection nothing needed. The predictor's two remaining raw power calls take the physics' own `pow165` table. And both screens' well-depth — the net's dent, paid per vertex — takes a twin table at the well shape's own 0.65, with exact arithmetic beyond or beneath the table's range. The rubble twin's physics stays untouched and pinned; its draw file gains only the table.

Measured at plan-writing on fresh copies, same drawn seed both ways (the harness rolled 3184 and the rerun passed it back): the step fell 91.53 to 87.12 ms — a modest five percent, saying the step's weight lives in the solver, not these calls — and the rubble screen's drawn frame fell 6.28 to 4.92 ms, a fifth off the draw. Honest sizes, stated as measured.

The debris evolution hash moves — the plain root rounds its last bit differently — and re-pins below; the sky tells the same story (same living counts, same eaten, same shield exercise). The predictor probe re-pins the same way at the same 273 points. The rubble hash proves its twin never moved.

Checked on a fresh copy: every anchor hit its exact count, all three files parse, and the battery below reproduced.

## Required reading

- This plan, whole.
- `src/game/gravitydebris/phys.js` — the hypot sites, gaT, the statics advance, pow165.
- `src/game/gravitydebris/draw.js` — wellDepth and the import line.
- `src/game/rubbleworlds/draw.js` — the same two sites, its own import line.

## Suggested model

Sonnet. Pre-verified substitutions in three files; no design remains.

## Steps

**1. The substitutions.** From the repo root:

```bash
python3 - <<'PYEOF'
import sys
def subn(path, old, new, n, tag):
    s = open(path).read()
    if s.count(old) != n: sys.exit("anchor fail: %s (count %d, wanted %d)" % (tag, s.count(old), n))
    open(path, 'w').write(s.replace(old, new))

P = 'src/game/gravitydebris/phys.js'
DD = 'src/game/gravitydebris/draw.js'
RD = 'src/game/rubbleworlds/draw.js'

subn(P, 'const cellKey = (gx, gz) => gx * 73856093 ^ gz * 19349663;',
        '''// the overflow-safe square root costs more than these distances ever need — the plain root, two or three parts
const hyp = (a, b, c) => c === undefined ? Math.sqrt(a * a + b * b) : Math.sqrt(a * a + b * b + c * c);

const cellKey = (gx, gz) => gx * 73856093 ^ gz * 19349663;''', 1, 'helper:phys')
subn(P, 'Math.hypot(', 'hyp(', 22, 'hypot:phys')
subn(P, 'const dx = b.x - x, dz = b.z - z, r2 = dx * dx + dz * dz + SF * SF, rn = Math.pow(r2, 1.65);',
        'const dx = b.x - x, dz = b.z - z, r2 = dx * dx + dz * dz + SF * SF, rn = pow165(r2);', 1, 'gaT:phys')
subn(P, 'const dx = o.x - sa.x, dz = o.z - sa.z, r2 = dx * dx + dz * dz + SF * SF, rn = Math.pow(r2, 1.65);',
        'const dx = o.x - sa.x, dz = o.z - sa.z, r2 = dx * dx + dz * dz + SF * SF, rn = pow165(r2);', 1, 'statics:phys')

TABLE = '''

// the well shape's own power from a table, the physics table's twin at 0.65 —
// beyond its range or beneath it, the real arithmetic
const _P65N = 4096, _P65L0 = Math.log2(64), _P65L1 = 24, _P65S = (_P65L1 - _P65L0) / _P65N;
const _P65 = new Float64Array(_P65N + 2);
for (let i = 0; i <= _P65N + 1; i++) _P65[i] = Math.pow(2, (_P65L0 + i * _P65S) * 0.65);
const pow65 = (r2) => { const l = Math.log2(r2); if (l >= _P65L1 || l < _P65L0) return Math.pow(r2, 0.65); const f = (l - _P65L0) / _P65S, i = f | 0, t = f - i; return _P65[i] * (1 - t) + _P65[i + 1] * t; };'''

subn(DD, 'import { SF, G, BS, C30, S30, predictShip, predictShipStart, predictShipStep } from "./phys.js";',
         'import { SF, G, BS, C30, S30, predictShip, predictShipStart, predictShipStep } from "./phys.js";' + TABLE, 1, 'table:ddraw')
subn(RD, 'import { SF, G, BS, C30, S30, predictShip } from "./phys.js";',
         'import { SF, G, BS, C30, S30, predictShip } from "./phys.js";' + TABLE, 1, 'table:rdraw')
for F in [DD, RD]:
    subn(F, 'const p = G * w.m / (1.3 * Math.pow(r2, 0.65));',
            'const p = G * w.m / (1.3 * pow65(r2));', 1, 'well:' + F)
print("all substitutions in")
PYEOF
```

Expected output, exact: `all substitutions in`. Then `node --check` on all three files prints nothing.

**2. The battery.** Build `/tmp/battery92.mjs` exactly as T90's step 2 built its battery (T84's block plus T90's two probes before the light-ground drawFrame line) and run it ONCE against `/home/batman/coldsnap`. Acceptance, exact — the rubble line is the untouched twin's own number; the debris hash and predictor probe are the re-pinned numbers, reproduced on the fresh copy at plan-writing:

```
rubble system at 5s 582386c0cb544735 alive 171/171
shields at birth: cells 72 | powered 36 | up 36 | preset SPREAD
launched: hull and walls together 41
debris map at 5s 5ad744a97cb81787 alive 1829/2239 | eaten 533
holes punched: 3
after 2.6s on the wall clock: holes 1
after 5.4s: holes 0
preset FORE: fore 18 | aft 0 | left 9 | right 9 | up 36
predictor probe 49640eb505b36d53 pts 273 | orbit false
cone probe: built 600 | done false
debris frames drawn light+dark | NaN false
STRUCTURE HELD
```

**3. The harness.** Save the block below as `/tmp/harness92.mjs` and run `node /tmp/harness92.mjs /home/batman/coldsnap` once. It rolls a fresh seed and prints it first; no seed is chosen. Report the printed ms/step beside the plan's measured pair (91.53 before, 87.12 after, seed 3184, plan-writing machine); the line it appends to `.superpowers/experiments.log` is its record.

```js
// THE STEP HARNESS: rolls its seed fresh at startup and prints it first; a
// rerun passes the drawn seed back on the command line. Builds the map,
// launches, steps 600 (ten simulated seconds), prints ms/step; every run
// appends one line to .superpowers/experiments.log beside the tree it ran.
const dir = process.argv[2] || '.';
const seedArg = process.argv[3];
const seed = seedArg ? +seedArg : Math.floor(Math.random() * 100000);
console.log('seed', seed);
const fs = await import('node:fs');
const DG = await import(dir + '/src/game/gravitydebris/gen.js');
const DP = await import(dir + '/src/game/gravitydebris/phys.js');
const w = DG.makeScenario('map', seed, 1);
DP.stepWorld(w, {welds:true, sleep:true, hash:true, friction:true});
const conn = DP.shipConn(w);
for (const b of conn.set) { b.vx += w.birthDir[0] * w.birthAim; b.vz += w.birthDir[1] * w.birthAim; }
const t0 = performance.now();
for (let s = 0; s < 600; s++) DP.stepWorld(w, {welds:true, sleep:true, hash:true, friction:true});
const ms = (performance.now() - t0) / 600;
let mk = '?'; try { mk = (await import(dir + '/src/version.js')).MK; } catch {}
const line = new Date().toISOString() + ' step-harness seed ' + seed + ' mk ' + mk + ' ms/step ' + ms.toFixed(2);
console.log(line);
try { fs.appendFileSync(dir + '/.superpowers/experiments.log', line + '\n'); } catch {}
```

**4. Version and build.** `MK = "0.5.87"` in `src/version.js`, then `npm run build`.

**5. The server, then the gate.** `npm run preview >/tmp/preview92.log 2>&1 &` — prove `SERVER UP` with `curl -sf --retry 20 --retry-delay 1 --retry-all-errors http://localhost:4173/coldsnap/ -o /dev/null && echo SERVER UP` — then `node scripts/gate.mjs smoke`: banner `boot-load smoke 0.5.87`, 23 PASS, 0 FAIL, one run; past the tool window, read the tail of `.superpowers/gates.log`, never a second run. Then `pkill -f "[v]ite preview"` as its own command. A failed gate still stops the server, then stops the task.

**6. Land.** Commit `src/game/gravitydebris/phys.js`, `src/game/gravitydebris/draw.js`, `src/game/rubbleworlds/draw.js`, `src/version.js` only (subject `the plain roots, 0.5.87`), push. Phase row T92 — "The plain roots: plain square roots and the power tables; the debris hash re-pins to 5ad744a97cb81787" — LANDED (mark 0.5.87, rubble hash unchanged, the smoke count); commit with this plan file, push. The live check is the acceptance: the exported log's stepMs and frame figures against the T91 runs, phone and desktop, and nothing about the sky or the lines looking different.

## Report

- One line of outcome, then bullets.
- Read-confirmation first.
- The battery's printed lines, verbatim; the smoke count exactly.
- The rubble hash unchanged, the debris and predictor re-pins, each its own labeled bullet.
- The harness's seed and ms/step as printed.
- Fixture seed: 12345 for the battery; the harness rolls its own and prints it first.
- Both commit hashes.
- Every deviation its own labeled bullet.
