# T88: the plain ledger (0.5.83)

Every log row on both screens grows to tell the whole story. Three figures join average and median: `fpsMin` and `fpsMax` — the worst and best drawn frame since the previous row — and `real`, wall-clock seconds since the world was born. `t` becomes `sim` and `clumps` becomes `bodies`, so an export reads itself. And each row carries a frame witness: `worst` and `best`, small records captured inside those very frames — `ms` the frame's full time, `draw` the time in the frame painter, `phys` the time and `chunks` the count of physics work that frame, `scan` whether that frame's step ran the every-20-frames clump scan, `ghost` whether the aim predictor ran, and `sim`/`real` for when it happened. The row cadence stands: one row per simulated second, the last 300 held. Component files only; gen, draw, and physics untouched, so no hash can move. One commit.

Checked on a fresh copy at plan-writing time: every anchor hit once per file, both components compile clean.

## Required reading

- This plan, whole.
- `src/game/GravityDebris.jsx` — the reset line, the chunked physics block, the frame painter call, the log-row writer, the frame-time line.
- `src/game/RubbleWorlds.jsx` — the same sites, with its unchunked step loop.

## Suggested model

Sonnet. Pre-verified substitutions in two files; no design remains.

## Steps

**1. The substitutions.** From the repo root:

```bash
python3 - <<'PYEOF'
import sys
def subn(path, old, new, n, tag):
    s = open(path).read()
    if s.count(old) != n: sys.exit("anchor fail: %s (count %d, wanted %d)" % (tag, s.count(old), n))
    open(path, 'w').write(s.replace(old, new))

DJ = 'src/game/GravityDebris.jsx'
RJ = 'src/game/RubbleWorlds.jsx'

ROW_OLD = '''        // the frame ledger: average and median drawn-frame rate since the last row
        let fpsAvg = 0, fpsMed = 0;
        if (ftBuf.length) { let sum = 0; for (const d of ftBuf) sum += d; const srt = [...ftBuf].sort((a, b) => a - b); fpsAvg = Math.round(1000 / Math.max(sum / ftBuf.length, 0.001)); fpsMed = Math.round(1000 / Math.max(srt[srt.length >> 1], 0.001)); ftBuf.length = 0; }
        world.log.push({ t: +world.t.toFixed(1), stepMs: world.stepMs || 0, fpsAvg, fpsMed, hash: k.hash, friction: k.friction, awake: awakeN, asleep: asleepN, welds: weldsN, eaten: world.eaten,
          clumps: world.wells.filter(w => !w.deep).map(w => [Math.round(w.x), Math.round(w.z), Math.round(w.m)]) });'''
ROW_NEW = '''        // the frame ledger: average, median, worst, and best drawn-frame rate since the last row, the worst and best frames carrying what the engine was doing inside them
        let fpsAvg = 0, fpsMed = 0, fpsMin = 0, fpsMax = 0;
        if (ftBuf.length) { let sum = 0; for (const d of ftBuf) sum += d; const srt = [...ftBuf].sort((a, b) => a - b); fpsAvg = Math.round(1000 / Math.max(sum / ftBuf.length, 0.001)); fpsMed = Math.round(1000 / Math.max(srt[srt.length >> 1], 0.001)); fpsMin = Math.round(1000 / Math.max(srt[srt.length - 1], 0.001)); fpsMax = Math.round(1000 / Math.max(srt[0], 0.001)); ftBuf.length = 0; }
        world.log.push({ sim: +world.t.toFixed(1), real: +(((performance.now() - (world._born || 0)) / 1000).toFixed(1)), stepMs: world.stepMs || 0, fpsAvg, fpsMed, fpsMin, fpsMax, worst: world._worstF || null, best: world._bestF || null, hash: k.hash, friction: k.friction, awake: awakeN, asleep: asleepN, welds: weldsN, eaten: world.eaten,
          bodies: world.wells.filter(w => !w.deep).map(w => [Math.round(w.x), Math.round(w.z), Math.round(w.m)]) });
        world._worstF = null; world._bestF = null;'''

FPS_OLD = 'const tNow = performance.now(), ftDt = tNow - tPrev; const fps = Math.round(1000 / Math.max(ftDt, 1)); tPrev = tNow; ftBuf.push(ftDt); if (ftBuf.length > 2000) ftBuf.shift(); // every drawn frame files its time; the row empties the ledger'

for F in [DJ, RJ]:
    subn(F, 'world = makeScenario(k.kind, seed, k.size, k.hull, k.shipOn);',
            'world = makeScenario(k.kind, seed, k.size, k.hull, k.shipOn); world._born = performance.now();', 1, 'born:' + F)
    subn(F, '      drawFrame({ ctx, W, H, world, frame: world.frame, time: k.time, dark: k.dark });',
            '      const _tD0 = performance.now();\n      drawFrame({ ctx, W, H, world, frame: world.frame, time: k.time, dark: k.dark });\n      _drawF = performance.now() - _tD0;', 1, 'draw:' + F)
    subn(F, ROW_OLD, ROW_NEW, 1, 'row:' + F)

subn(DJ, '      const stepN = k.time >= 1 ? 1 : Math.round(1 / k.time);',
         '      let _chF = 0, _physF = 0, _drawF = 0; const _frame0 = world.frame, _tP0 = performance.now(); // the frame witness measures this frame alone\n      const stepN = k.time >= 1 ? 1 : Math.round(1 / k.time);', 1, 'meas:debris')
subn(DJ, 'const done = stepSlice(world, k); world._chunks++;',
         'const done = stepSlice(world, k); world._chunks++; _chF++;', 1, 'chunk:debris')
subn(DJ, '      world.lerp = (planFrozen || stepN === 1) ? 1 : (((renderF - 1) % stepN) + 1) / stepN;',
         '      _physF = performance.now() - _tP0;\n      world.lerp = (planFrozen || stepN === 1) ? 1 : (((renderF - 1) % stepN) + 1) / stepN;', 1, 'measend:debris')
subn(DJ, FPS_OLD,
     FPS_OLD + '''
      { // the frame witness: the worst and best frame since the last row carry what the engine was doing inside them
        const _gh = !!((world._ghostA && world._ghostA.f0 === world.frame) || (world._ghostF && world._ghostF.f0 === world.frame));
        const snap = { ms: +ftDt.toFixed(1), draw: +_drawF.toFixed(1), phys: +_physF.toFixed(1), chunks: _chF, scan: _chF > 0 && _frame0 % 20 === 0, ghost: _gh, sim: +world.t.toFixed(1), real: +(((tNow - (world._born || 0)) / 1000).toFixed(1)) };
        if (!world._worstF || snap.ms > world._worstF.ms) world._worstF = snap;
        if (!world._bestF || snap.ms < world._bestF.ms) world._bestF = snap;
      }''', 1, 'witness:debris')

subn(RJ, '      for (let rep = 0; rep < (planFrozen ? 0 : reps); rep++) weldsAlive = stepWorld(world, k);',
         '      let _chF = 0, _physF = 0, _drawF = 0; const _frame0 = world.frame, _tP0 = performance.now(); // the frame witness measures this frame alone\n      for (let rep = 0; rep < (planFrozen ? 0 : reps); rep++) { weldsAlive = stepWorld(world, k); _chF++; }\n      _physF = performance.now() - _tP0;', 1, 'meas:rubble')
subn(RJ, FPS_OLD,
     FPS_OLD + '''
      { // the frame witness: the worst and best frame since the last row carry what the engine was doing inside them
        const _gh = !!(world.ship && world.shipTrack && ((world.shipPhase === "fly" && !world.shipDead) || (world.shipAim && world.shipAim.on)));
        const snap = { ms: +ftDt.toFixed(1), draw: +_drawF.toFixed(1), phys: +_physF.toFixed(1), chunks: _chF, scan: _chF > 0 && _frame0 % 20 === 0, ghost: _gh, sim: +world.t.toFixed(1), real: +(((tNow - (world._born || 0)) / 1000).toFixed(1)) };
        if (!world._worstF || snap.ms > world._worstF.ms) world._worstF = snap;
        if (!world._bestF || snap.ms < world._bestF.ms) world._bestF = snap;
      }''', 1, 'witness:rubble')
print("all substitutions in")
PYEOF
```

Expected output, exact: `all substitutions in`. Then `node_modules/.bin/esbuild --loader:.jsx=jsx src/game/GravityDebris.jsx --outfile=/dev/null --log-level=error` and the same for `src/game/RubbleWorlds.jsx` each print nothing.

**2. The battery.** Run T84's battery unchanged (its block saved as `/tmp/battery88.mjs`, run once against `/home/batman/coldsnap`): acceptance is T84's block, every line identical — the untouched gen, draw, and physics proven.

**3. Version and build.** `MK = "0.5.83"` in `src/version.js`, then `npm run build`.

**4. The server, then the gate.** `npm run preview >/tmp/preview88.log 2>&1 &` — prove `SERVER UP` with `curl -sf --retry 20 --retry-delay 1 --retry-all-errors http://localhost:4173/coldsnap/ -o /dev/null && echo SERVER UP` — then `node scripts/gate.mjs smoke`: banner `boot-load smoke 0.5.83`, 23 PASS, 0 FAIL, one run; past the tool window, read the tail of `.superpowers/gates.log`, never a second run. Then `pkill -f "[v]ite preview"` as its own command. A failed gate still stops the server, then stops the task.

**5. Land.** Commit `src/game/GravityDebris.jsx`, `src/game/RubbleWorlds.jsx`, `src/version.js` only (subject `the plain ledger, 0.5.83`), push. Phase row T88 — "The plain ledger: rows carry worst and best frame with their witnesses, wall-clock time, and plain names" — LANDED (mark 0.5.83, hashes unchanged, the smoke count); commit with this plan file, push. The live check is the acceptance: play, export, and rows read `sim`, `real`, the four frame figures, `worst` and `best` with their records, and `bodies`.

## Report

- One line of outcome, then bullets.
- Read-confirmation first.
- The battery's printed lines, verbatim; the smoke count exactly.
- Both hashes unchanged as their own labeled bullet.
- Fixture seed: 12345.
- Both commit hashes.
- Every deviation its own labeled bullet.
