# T85: the deep fade (0.5.80)

The disk fade deepens to read: the rim wash doubles to .06 and each of the three stacked steps rises to .25, so the ground reads in four plain steps — .06 at the rim, then .30, .47, and .60 on the deepest ground. Same rings, same radii, same full-green strength 400; only the two alphas move, in both screens' draw files. Drawing only; the battery proves both evolution hashes unchanged against T84's pinned numbers. Two substitutions per file, two files, one commit. The .60 is built as spoken; the .25 step is the stacking arithmetic that lands it.

The substitutions were applied to a fresh copy of the live tree at plan-writing time: every anchor hit once per file, both files parse, and the T84 battery reproduced its acceptance line for line.

## Required reading

- This plan, whole.
- `src/game/rubbleworlds/draw.js` — the slingshot-zones ring calls.
- `src/game/gravitydebris/draw.js` — the same two calls.

## Suggested model

Sonnet. Two pre-verified substitutions per file; no design remains.

## Steps

**1. The substitutions.** From the repo root:

```bash
python3 - <<'PYEOF'
import sys
def subn(path, old, new, n, tag):
    s = open(path).read()
    if s.count(old) != n: sys.exit("anchor fail: %s (count %d, wanted %d)" % (tag, s.count(old), n))
    open(path, 'w').write(s.replace(old, new))
for F in ['src/game/rubbleworlds/draw.js', 'src/game/gravitydebris/draw.js']:
    subn(F, "ring(zr, 0.03);", "ring(zr, 0.06);", 1, 'rim:' + F)
    subn(F, "ring(Math.min(Math.sqrt(rk2), zr), 0.06);", "ring(Math.min(Math.sqrt(rk2), zr), 0.25);", 1, 'step:' + F)
print("all substitutions in")
PYEOF
```

Expected output, exact: `all substitutions in`. Then `node --check` on both files prints nothing.

**2. The battery.** Run T84's battery unchanged: save the battery block from `docs/superpowers/plans/2026-10-05-t84-the-shield-walls.md` step 3 as `/tmp/battery85.mjs` and run `node /tmp/battery85.mjs /home/batman/coldsnap` once. Acceptance: T84's acceptance block, every line identical — both hashes unmoved.

**3. Version and build.** `MK = "0.5.80"` in `src/version.js`, then `npm run build`.

**4. The server, then the gate.** `npm run preview >/tmp/preview85.log 2>&1 &` — then prove `SERVER UP` with `curl -sf --retry 20 --retry-delay 1 --retry-all-errors http://localhost:4173/coldsnap/ -o /dev/null && echo SERVER UP` — then `node scripts/gate.mjs smoke`: banner `boot-load smoke 0.5.80`, 23 PASS, 0 FAIL, one run; past the tool window, read the tail of `.superpowers/gates.log`, never a second run. Then `pkill -f "[v]ite preview"` as its own command. A failed gate still stops the server, then stops the task.

**5. Land.** Commit `src/game/rubbleworlds/draw.js`, `src/game/gravitydebris/draw.js`, `src/version.js` only (subject `the deep fade, 0.5.80`), push. Phase row T85 — "The deep fade: the disk steps rise to read .06/.30/.47/.60" — LANDED (mark 0.5.80, hashes unchanged, the smoke count); commit with this plan file, push. The live check is the acceptance, phone and desktop, light and dark.

## Report

- One line of outcome, then bullets.
- Read-confirmation first.
- The battery's printed lines, verbatim; the smoke count exactly.
- Both hashes unchanged as their own labeled bullet.
- Fixture seed: 12345.
- Both commit hashes.
- Every deviation its own labeled bullet.
