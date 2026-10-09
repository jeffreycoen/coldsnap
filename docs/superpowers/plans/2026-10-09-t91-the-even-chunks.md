# T91: the even chunks (0.5.86)

T90's scan frames got heavier because its chunk budget of 17 cannot divide into the sixteen-frame window — one frame per window carried two chunks, and when both were scan slices it paid twice (32–42 ms witnessed). The budget returns to 16, exactly one chunk per frame at the default chip, and the walk and tail rest every 1,000 blocks instead of 800, keeping the step at 12 chunks with margin for a fuller sky. Physics byte-identical — the rests move, the arithmetic does not — and the battery proves both hashes and the predictor unmoved. Two files, seven substitutions, one commit.

Checked on a fresh copy at plan-writing time: every anchor hit once, both files parse and compile clean, and the T90 battery reproduced its acceptance line for line.

## Required reading

- This plan, whole.
- `src/game/gravitydebris/phys.js` — the two rest lines in the spread scan.
- `src/game/GravityDebris.jsx` — the frame-split chunk budget.

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

P = 'src/game/gravitydebris/phys.js'
J = 'src/game/GravityDebris.jsx'

subn(P, 'if (++_sc % 800 === 0) yield; // THE SPREAD SCAN',
        'if (++_sc % 1000 === 0) yield; // THE SPREAD SCAN', 1, 'walk:phys')
subn(P, '_st += ids.length; if (_st >= 800) { _st = 0; yield; } // THE SPREAD TAIL',
        '_st += ids.length; if (_st >= 1000) { _st = 0; yield; } // THE SPREAD TAIL', 1, 'tail:phys')
subn(J, 'if (world._chunks == null) world._chunks = 17;',
        'if (world._chunks == null) world._chunks = 16;', 1, 'init:jsx')
subn(J, 'if (fIn === 0 && world._chunks >= 17) {',
        'if (fIn === 0 && world._chunks >= 16) {', 1, 'window:jsx')
subn(J, '''        if (world._chunks < 17) {
          const want = Math.min(17, Math.ceil((fIn + 1) * 17 / stepN));''',
        '''        if (world._chunks < 16) {
          const want = Math.min(16, Math.ceil((fIn + 1) * 16 / stepN));''', 1, 'want:jsx')
subn(J, 'if (done) { world._chunks = 17; world._shiftPending = true;',
        'if (done) { world._chunks = 16; world._shiftPending = true;', 1, 'done:jsx')
subn(J, 'if (world._chunks < 17) world._stepAcc += performance.now() - tPhys;',
        'if (world._chunks < 16) world._stepAcc += performance.now() - tPhys;', 1, 'acc:jsx')
print("all substitutions in")
PYEOF
```

Expected output, exact: `all substitutions in`. Then `node --check src/game/gravitydebris/phys.js` prints nothing and `node_modules/.bin/esbuild --loader:.jsx=jsx src/game/GravityDebris.jsx --outfile=/dev/null --log-level=error` prints nothing.

**2. The battery.** Build `/tmp/battery91.mjs` exactly as T90's step 2 built its battery (T84's block plus T90's two probes, inserted immediately before the light-ground drawFrame line) and run it ONCE against `/home/batman/coldsnap`. Acceptance: T90's acceptance block, every line identical — hashes, predictor probe (`ad9c5d7ef5b11d5f pts 273`), and cone probe (`built 600 | done false`) all unmoved.

**3. Version and build.** `MK = "0.5.86"` in `src/version.js`, then `npm run build`.

**4. The server, then the gate.** `npm run preview >/tmp/preview91.log 2>&1 &` — prove `SERVER UP` with `curl -sf --retry 20 --retry-delay 1 --retry-all-errors http://localhost:4173/coldsnap/ -o /dev/null && echo SERVER UP` — then `node scripts/gate.mjs smoke`: banner `boot-load smoke 0.5.86`, 23 PASS, 0 FAIL, one run; past the tool window, read the tail of `.superpowers/gates.log`, never a second run. Then `pkill -f "[v]ite preview"` as its own command. A failed gate still stops the server, then stops the task.

**5. Land.** Commit `src/game/gravitydebris/phys.js`, `src/game/GravityDebris.jsx`, `src/version.js` only (subject `the even chunks, 0.5.86`), push. Phase row T91 — "The even chunks: one chunk per frame; the doubled scan frame goes" — LANDED (mark 0.5.86, hashes unchanged, the smoke count); commit with this plan file, push. The live check is the acceptance: play, export, and the scan-flagged worst frames read one chunk and roughly half their T90 weight.

## Report

- One line of outcome, then bullets.
- Read-confirmation first.
- The battery's printed lines, verbatim; the smoke count exactly.
- Both hashes and the predictor probe unchanged as their own labeled bullets.
- Fixture seed: 12345.
- Both commit hashes.
- Every deviation its own labeled bullet.
