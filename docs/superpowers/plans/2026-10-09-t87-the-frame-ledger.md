# T87: the frame ledger (0.5.82)

Every log row on both screens gains two fields beside stepMs: `fpsAvg` and `fpsMed` — the average and median drawn-frame rate since the last row, computed from a ledger of every frame's time and emptied at each row. The ledger caps at 2,000 frames, so a long aim freeze cannot grow it without bound. Component files only — gen, draw, and physics untouched, so no hash can move. Three substitutions per file, two files, one commit.

Checked on a fresh copy at plan-writing time: every anchor hit once per file, both components compile clean.

## Required reading

- This plan, whole.
- `src/game/GravityDebris.jsx` — the loop's frame-time line and the log-row writer.
- `src/game/RubbleWorlds.jsx` — the same two sites.

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

for F in ['src/game/GravityDebris.jsx', 'src/game/RubbleWorlds.jsx']:
    subn(F, 'let world = null, seed = 0, lastReset = 0, anim, frame = 0, renderF = 0, tPrev = performance.now();',
            'let world = null, seed = 0, lastReset = 0, anim, frame = 0, renderF = 0, tPrev = performance.now(), ftBuf = [];', 1, 'decl:' + F)
    subn(F, 'const tNow = performance.now(); const fps = Math.round(1000 / Math.max(tNow - tPrev, 1)); tPrev = tNow;',
            'const tNow = performance.now(), ftDt = tNow - tPrev; const fps = Math.round(1000 / Math.max(ftDt, 1)); tPrev = tNow; ftBuf.push(ftDt); if (ftBuf.length > 2000) ftBuf.shift(); // every drawn frame files its time; the row empties the ledger', 1, 'frame:' + F)
    subn(F, '''        for (const w of welds) if (w.alive) weldsN++;
        world.log.push({ t: +world.t.toFixed(1), stepMs: world.stepMs || 0, hash: k.hash, friction: k.friction,''',
            '''        for (const w of welds) if (w.alive) weldsN++;
        // the frame ledger: average and median drawn-frame rate since the last row
        let fpsAvg = 0, fpsMed = 0;
        if (ftBuf.length) { let sum = 0; for (const d of ftBuf) sum += d; const srt = [...ftBuf].sort((a, b) => a - b); fpsAvg = Math.round(1000 / Math.max(sum / ftBuf.length, 0.001)); fpsMed = Math.round(1000 / Math.max(srt[srt.length >> 1], 0.001)); ftBuf.length = 0; }
        world.log.push({ t: +world.t.toFixed(1), stepMs: world.stepMs || 0, fpsAvg, fpsMed, hash: k.hash, friction: k.friction,''', 1, 'row:' + F)
print("all substitutions in")
PYEOF
```

Expected output, exact: `all substitutions in`. Then `node_modules/.bin/esbuild --loader:.jsx=jsx src/game/GravityDebris.jsx --outfile=/dev/null --log-level=error` and the same for `src/game/RubbleWorlds.jsx` each print nothing.

**2. The battery.** Run T84's battery unchanged (its block saved as `/tmp/battery87.mjs`, run once against `/home/batman/coldsnap`): acceptance is T84's block, every line identical — the untouched gen, draw, and physics proven.

**3. Version and build.** `MK = "0.5.82"` in `src/version.js`, then `npm run build`.

**4. The server, then the gate.** `npm run preview >/tmp/preview87.log 2>&1 &` — prove `SERVER UP` with `curl -sf --retry 20 --retry-delay 1 --retry-all-errors http://localhost:4173/coldsnap/ -o /dev/null && echo SERVER UP` — then `node scripts/gate.mjs smoke`: banner `boot-load smoke 0.5.82`, 23 PASS, 0 FAIL, one run; past the tool window, read the tail of `.superpowers/gates.log`, never a second run. Then `pkill -f "[v]ite preview"` as its own command. A failed gate still stops the server, then stops the task.

**5. Land.** Commit `src/game/GravityDebris.jsx`, `src/game/RubbleWorlds.jsx`, `src/version.js` only (subject `the frame ledger, 0.5.82`), push. Phase row T87 — "The frame ledger: every log row carries average and median frame rate" — LANDED (mark 0.5.82, hashes unchanged, the smoke count); commit with this plan file, push. The live check is the acceptance: play, export the log, and the rows carry `fpsAvg` and `fpsMed`.

## Report

- One line of outcome, then bullets.
- Read-confirmation first.
- The battery's printed lines, verbatim; the smoke count exactly.
- Both hashes unchanged as their own labeled bullet.
- Fixture seed: 12345.
- Both commit hashes.
- Every deviation its own labeled bullet.
