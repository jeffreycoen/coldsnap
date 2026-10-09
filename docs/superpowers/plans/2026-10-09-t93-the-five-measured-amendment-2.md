# T93 amendment 2: the strike's dead ends

The rerun agreed on everything but one count: c1's birth row held 341 more live welds than base. When the consuming strike kills a block inside a solver sweep, the shipped sweep kills that block's welds on the next sweep, whatever their kind; the weld list skips rigid-internal and both-sleeping welds, so those died one step later. The motion never differed — those welds do no solver work either way — but the step's weld count did, and the plan's law is every number. This amendment gives c1 a flag the strike raises; the next sweep then walks the whole weld list for dead ends, as the shipped sweep does. Then c1 is rebuilt, its battery run, its one run made with 52805 passed back, the page and its check rebuilt, and the plan's steps 7 and 8 land it. The other five logs stand; they passed.

Checked at plan-writing: the three anchors hit once each in copy c1's `phys.js`, the amended file parses, and on a fresh copy the weld count after the priming step at seed 52805 reads 10034 in base and 10034 in the amended c1 (it read 10375 before).

## Required reading

- This amendment, whole.
- Amendment 1, `docs/superpowers/plans/2026-10-09-t93-the-five-measured-amendment-1.md`, whole.
- The plan `docs/superpowers/plans/2026-10-09-t93-the-five-measured.md`, steps 3, 7 and 8 and the Report section.
- `/home/batman/coldsnap-t93/c1/src/game/gravitydebris/phys.js`, lines 478–500 and 520–530 (the list, the sweep, the strike).

## Steps

**B1. The strike's flag, copy c1 only.** From anywhere:

```bash
python3 - <<'PYEOF'
import sys
def subn(path, old, new, n, tag):
    s = open(path).read()
    if s.count(old) != n: sys.exit("anchor fail: %s (count %d, wanted %d)" % (tag, s.count(old), n))
    open(path, 'w').write(s.replace(old, new))
P = '/home/batman/coldsnap-t93/c1/src/game/gravitydebris/phys.js'
subn(P, '      const liveWelds = [];',
        '      const liveWelds = []; let _diedF = false; // a block killed inside a sweep dead-ends its welds; the next sweep kills them all, as the shipped walk does', 1, 'flag')
subn(P, '        if (it > 0) yield; // every sweep its own chunk',
        '''        if (it > 0) yield; // every sweep its own chunk
        if (_diedF) { _diedF = false; if (k.welds) for (const w of welds) if (w.alive && (!wb[w.a].alive || !wb[w.b].alive)) w.alive = false; }''', 1, 'sweep')
subn(P, '            loser.alive = false; world.eaten++; world.warm.delete(cnt.key);',
        '            loser.alive = false; world.eaten++; world.warm.delete(cnt.key); _diedF = true;', 1, 'strike')
print("all substitutions in")
PYEOF
```

Expected output, exact: `all substitutions in`. Then `node --check /home/batman/coldsnap-t93/c1/src/game/gravitydebris/phys.js` prints nothing.

**B2. The battery on c1.** `node /tmp/battery93.mjs /home/batman/coldsnap-t93/c1` — if `/tmp/battery93.mjs` is gone, save it again from the plan's step 3 block first. Acceptance: T92's block exactly, as the plan's step 3 prints it.

**B3. The build of c1.** `(cd /home/batman/coldsnap-t93/c1 && npm run build >/tmp/t93-build-c1.log 2>&1 && test -f dist/index.html && echo "built c1")`. Expected: `built c1`.

**B4. The one run, then the page.** Save the block below as `/tmp/t93-one.sh`, then start `bash /tmp/t93-one.sh >/tmp/t93-one.log 2>&1` with the Bash tool's background mode and wait for its completion notice (about six minutes; the Pi's desktop shows one browser window; leave it alone). Status checks read `tail -5 /tmp/t93-one.log`. Never start it twice.

```bash
#!/bin/bash
# THE ONE RUN: copy c1 alone, the drawn seed passed back, then the page and its check.
OUT=/home/batman/coldsnap/docs/superpowers/perf/t93
pkill -f "[v]ite preview"; sleep 1
( cd /home/batman/coldsnap-t93/c1 && npm run preview -- --strictPort --port 4173 >/tmp/t93-preview-c1.log 2>&1 & )
if ! curl -sf --retry 30 --retry-delay 1 --retry-all-errors http://localhost:4173/coldsnap/ -o /dev/null; then echo "SERVER DOWN c1"; pkill -f "[v]ite preview"; exit 1; fi
echo "server up c1"
if ! node "$OUT/run.mjs" c1 52805; then echo "RUN FAILED c1"; pkill -f "[v]ite preview"; exit 1; fi
pkill -f "[v]ite preview"; sleep 1
node "$OUT/page.mjs" || { echo "PAGE FAILED (identity or build)"; exit 1; }
node "$OUT/check.mjs" || { echo "PAGE CHECK FAILED"; exit 1; }
echo "ONE DONE seed 52805"
```

Expected in the log: `server up c1`, `run c1 seed 52805 mk 0.5.87`, `raf … visibility visible`, `launched`, the `rows …` lines to `rows 11 sim 10`, the experiments line with `world-seed 52805`, `RUN DONE c1`, then `identity: Every run tells the same story …`, `wrote index.html`, the check's three lines ending `PAGE CHECK OK`, and last `ONE DONE seed 52805`. Any `SERVER DOWN`, `RUN FAILED`, `PAGE FAILED`, or `PAGE CHECK FAILED` stops the task; report the log tail verbatim, no retry.

**B5. Steps 7 and 8 of the plan, unchanged** — the copies removed, `docs/superpowers/perf/t93/` committed whole (subject `the five measured`), the phase row and the three plan files (the plan, amendment 1, this amendment) committed together (subject `t93 lands in the phase document — the five measured, no deploy`), both pushed. Commits end with the attribution lines the agent's own harness gives it.

## Report

As the plan's report, plus: the battery's twelve lines for c1 verbatim, c1's experiments line verbatim, the identity line verbatim, and the check's three lines verbatim.
