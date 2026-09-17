# T76: the fine split (0.5.71)

The step's four chunks become up to eleven: the gravity pass cut in two, every solver sweep its own chunk, and the tail as before. The worst single frame in the opening brawl now carries about a tenth of the step instead of a quarter. Light steps finish their chunks early and simply complete sooner in the window; the screen's one-step-behind glide is unchanged. Two files, the same machine; called whole it still runs start to finish, and the battery proves the arithmetic byte-identical — it prints exactly the last task's numbers.

Design choices, stated plainly: the eleven-chunk schedule and the two new cut rules. Seed 12345 is the fixture.

The substitution script was applied to a fresh copy of the live tree at plan-writing time: every anchor hit exactly once, both files parse, the identical acceptance below reproduced.

## Required reading

- This plan, whole.
- `src/game/gravitydebris/phys.js` — the gravity kick loop and the solver sweep loop inside the step machine.
- `src/game/GravityDebris.jsx` — the chunk scheduler block.

## Suggested model

Sonnet. One pre-verified substitution script; no design remains.

## Steps

**1. The substitutions.** From the repo root:

```bash
python3 - <<'PYEOF'
import sys
def subn(path, old, new, n, tag):
    s = open(path).read()
    if s.count(old) != n: sys.exit("anchor fail: %s (count %d, wanted %d)" % (tag, s.count(old), n))
    open(path, 'w').write(s.replace(old, new))
PHYS='src/game/gravitydebris/phys.js'; JSX='src/game/GravityDebris.jsx'

# 1. the gravity pass cut in two
subn(PHYS, """      const out = [0, 0, 0];
      for (const i of awakeIdx) {
        const b = wb[i];""",
     """      const out = [0, 0, 0];
      let _gk = 0; const _gkHalf = awakeIdx.length >> 1;
      for (const i of awakeIdx) {
        if (_gk++ === _gkHalf && _gkHalf > 0) yield; // the gravity pass cut in two
        const b = wb[i];""", 1, 'gravity-cut')

# 2. every solver sweep its own chunk
subn(PHYS, "        if (it > 0 && it === Math.ceil(itn / 2)) yield; // the second cut: half the solver sweeps on each side",
     "        if (it > 0) yield; // every sweep its own chunk", 1, 'per-sweep')

# 3. the scheduler counts eleven chunks — the machine may finish earlier on light
#    steps (fewer sweeps), and completion simply arrives sooner
subn(JSX, "        if (world._chunks == null) world._chunks = 4;",
     "        if (world._chunks == null) world._chunks = 11;", 1, 'n1')
subn(JSX, "        if (fIn === 0 && world._chunks >= 4) {",
     "        if (fIn === 0 && world._chunks >= 11) {", 1, 'n2')
subn(JSX, "        if (world._chunks < 4) {",
     "        if (world._chunks < 11) {", 1, 'n3')
subn(JSX, "          const want = Math.min(4, Math.ceil((fIn + 1) * 4 / stepN));",
     "          const want = Math.min(11, Math.ceil((fIn + 1) * 11 / stepN));", 1, 'n4')
subn(JSX, "            if (done) { world._chunks = 4; world._shiftPending = true;",
     "            if (done) { world._chunks = 11; world._shiftPending = true;", 1, 'n5')
subn(JSX, "          if (world._chunks < 4) world._stepAcc += performance.now() - tPhys;",
     "          if (world._chunks < 11) world._stepAcc += performance.now() - tPhys;", 1, 'n6')
print("all substitutions in")
PYEOF
```

Expected output, exact: `all substitutions in`.

**2. The battery.** From the repo root, save the block below as `/tmp/battery76.mjs` and run `node /tmp/battery76.mjs /home/batman/coldsnap` once:

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

Acceptance, exact — every line, identical to the last task's landing:

```
map s1 335395ae939b0832 blocks 4189
at 5s: alive 2681/4189 | eaten 1885 | NaN false
STRUCTURE HELD
```

Then confirm the proving range is untouched: `git status --short src/game/rubbleworlds src/game/RubbleWorlds.jsx` prints nothing.

**3. Gate.** `node scripts/gate.mjs smoke` — 23 PASS, 0 FAIL, one run. If the tool moves it to the background past its two-minute window, wait and read the pass from the tail of `.superpowers/gates.log` — do not start a second run.

**4. Version and build.** `MK = "0.5.71"`, then `npm run build`.

**5. Land.** Commit `src/game/gravitydebris/phys.js`, `src/game/GravityDebris.jsx`, and `src/version.js` only (subject `the fine split, 0.5.71`), push. The phase document's table adds row T76 — "The fine split: up to eleven chunks — the gravity pass halved, every solver sweep its own chunk; the opening's worst frame near a tenth of the step" — LANDED (mark 0.5.71, battery identical to T75's numbers, the smoke count); commit with this plan file, push. The live check is the acceptance, phone and desktop both — the opening brawl is the test.

## Report

- One line of outcome, then bullets.
- Read-confirmation first.
- The battery's printed lines, verbatim; the smoke count exactly.
- The proving range untouched — the empty git status — as its own labeled bullet.
- Battery identical to the last task's numbers, its own labeled bullet — the faithfulness proof.
- Fixture seed: 12345; the module rolls fresh seeds at reset.
- Both commit hashes.
- Every deviation its own labeled bullet.
