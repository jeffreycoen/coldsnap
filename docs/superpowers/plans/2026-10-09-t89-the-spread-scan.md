# T89: the spread scan (0.5.84)

The clump scan stops landing whole inside one frame. On its every-20th step the scan's block walk now rests every 800 living blocks — two pauses on today's map — so its 18–31 milliseconds spread across frames instead of dropping one to 21–29 fps. The rest is byte-identical physics: the walk's ledger is local and the sky stands still between pauses, and the battery proves both evolution hashes unmoved. The step's chunk budget in the component rises from 11 to 14 to hold the extra pauses — scheduling only. Debris screen only; the rubble twin's physics stays pinned and untouched. When the HASH chip is off the scan runs its old unsliced walk — a known remaining spike on that arm, stated here. One commit.

Checked on a fresh copy at plan-writing time: every anchor hit once, both files parse and compile clean, and the battery reproduced T84's acceptance line for line — the spread scan's physics is the same physics.

## Required reading

- This plan, whole.
- `src/game/gravitydebris/phys.js` — the clump scan's hash arm and the step's chunk generator.
- `src/game/GravityDebris.jsx` — the frame-split block that drives the chunks.

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

subn(P, '''        if (k.hash) {
          for (let i = 0; i < wb.length; i++) { if (!wb[i].alive) continue;
            neighborsOf(world, wb[i], _nb);''',
        '''        if (k.hash) {
          let _sc = 0;
          for (let i = 0; i < wb.length; i++) { if (!wb[i].alive) continue;
            if (++_sc % 800 === 0) yield; // THE SPREAD SCAN: the walk rests between frames — par is local, the sky stands still, the answers are byte-identical
            neighborsOf(world, wb[i], _nb);''', 1, 'scan:phys')

subn(J, 'if (world._chunks == null) world._chunks = 11;',
        'if (world._chunks == null) world._chunks = 14;', 1, 'init:jsx')
subn(J, 'if (fIn === 0 && world._chunks >= 11) {',
        'if (fIn === 0 && world._chunks >= 14) {', 1, 'window:jsx')
subn(J, '''        if (world._chunks < 11) {
          const want = Math.min(11, Math.ceil((fIn + 1) * 11 / stepN));''',
        '''        if (world._chunks < 14) {
          const want = Math.min(14, Math.ceil((fIn + 1) * 14 / stepN));''', 1, 'want:jsx')
subn(J, 'if (done) { world._chunks = 11; world._shiftPending = true;',
        'if (done) { world._chunks = 14; world._shiftPending = true;', 1, 'done:jsx')
subn(J, 'if (world._chunks < 11) world._stepAcc += performance.now() - tPhys;',
        'if (world._chunks < 14) world._stepAcc += performance.now() - tPhys;', 1, 'acc:jsx')
print("all substitutions in")
PYEOF
```

Expected output, exact: `all substitutions in`. Then `node --check src/game/gravitydebris/phys.js` prints nothing and `node_modules/.bin/esbuild --loader:.jsx=jsx src/game/GravityDebris.jsx --outfile=/dev/null --log-level=error` prints nothing.

**2. The battery.** Run T84's battery unchanged (its block saved as `/tmp/battery89.mjs`, run once against `/home/batman/coldsnap`): acceptance is T84's block, every line identical — both hashes unmoved, the spread scan proven byte-identical.

**3. Version and build.** `MK = "0.5.84"` in `src/version.js`, then `npm run build`.

**4. The server, then the gate.** `npm run preview >/tmp/preview89.log 2>&1 &` — prove `SERVER UP` with `curl -sf --retry 20 --retry-delay 1 --retry-all-errors http://localhost:4173/coldsnap/ -o /dev/null && echo SERVER UP` — then `node scripts/gate.mjs smoke`: banner `boot-load smoke 0.5.84`, 23 PASS, 0 FAIL, one run; past the tool window, read the tail of `.superpowers/gates.log`, never a second run. Then `pkill -f "[v]ite preview"` as its own command. A failed gate still stops the server, then stops the task.

**5. Land.** Commit `src/game/gravitydebris/phys.js`, `src/game/GravityDebris.jsx`, `src/version.js` only (subject `the spread scan, 0.5.84`), push. Phase row T89 — "The spread scan: the clump scan rests between frames; the scan-frame stutter goes" — LANDED (mark 0.5.84, hashes unchanged, the smoke count); commit with this plan file, push. The live check is the acceptance: play, export, and the worst frames stop reading `scan:true` with 18–31 ms of physics in one frame.

## Report

- One line of outcome, then bullets.
- Read-confirmation first.
- The battery's printed lines, verbatim; the smoke count exactly.
- Both hashes unchanged as their own labeled bullet.
- Fixture seed: 12345.
- Both commit hashes.
- Every deviation its own labeled bullet.
