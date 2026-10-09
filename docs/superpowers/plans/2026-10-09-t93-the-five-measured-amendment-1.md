# T93 amendment 1: the pinned draw

The first six runs built six different worlds: the pin fed every `Math.random` from one seeded stream, and the number of draws made before the debris screen draws its world seed varies from run to run, so each run drew a different seed. This amendment pins the draw itself. While the pin is up, `Math.random` answers the pinned seed; the pin goes up at the click into the debris screen and comes down once the LAUNCH chip stands, so the sky's own seed is the pin in every run and every other draw is the page's own. The driver checks the exported seed against the pin on the first capture and stops at once if they differ. The six copies and their builds stand from the first dispatch; the rerun is the six runs again with the drawn seed passed back, then the plan's steps 7 and 8 unchanged.

Checked at plan-writing: the three anchors hit once each in the saved `run.mjs`, and the amended file parses.

## Required reading

- This amendment, whole.
- The plan `docs/superpowers/plans/2026-10-09-t93-the-five-measured.md`, steps 5 through 8.
- `docs/superpowers/perf/t93/run.mjs` as saved.

## Steps

**A1. The copies stand.** `for N in base c1 c2 c3 c4 c5; do test -f /home/batman/coldsnap-t93/$N/dist/index.html && echo "dist $N"; done; for N in c1 c2 c3 c4 c5; do git -C /home/batman/coldsnap-t93/$N diff --quiet || echo "changed $N"; done`. Expected: `dist base` through `dist c5`, then `changed c1` through `changed c5`. Anything else stops the task.

**A2. The pinned draw.** From the repo root:

```bash
python3 - <<'PYEOF'
import sys
def subn(path, old, new, n, tag):
    s = open(path).read()
    if s.count(old) != n: sys.exit("anchor fail: %s (count %d, wanted %d)" % (tag, s.count(old), n))
    open(path, 'w').write(s.replace(old, new))
R = 'docs/superpowers/perf/t93/run.mjs'
subn(R, '''    // the pinned dice: every Math.random in the page draws from one seeded stream, so the sky's own seed is the same in every run
    let a = s >>> 0;
    Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };''',
'''    // the pinned draw: while the pin is up, Math.random answers the pinned seed itself; the pin goes up at the click into the debris screen and comes down once the LAUNCH chip stands, so the sky's own seed is the pin in every run and every other draw is the page's own
    const orig = Math.random.bind(Math);
    window.__pin = false;
    Math.random = () => (window.__pin ? (s + 0.5) / 100000 : orig());''', 1, 'pin')
subn(R, '''  await page.evaluate(() => document.querySelector('[data-menu="debris"]').click());''',
'''  await page.evaluate(() => { window.__pin = true; document.querySelector('[data-menu="debris"]').click(); });''', 1, 'up')
subn(R, '''  let flying = false;
  for (let i = 0; i < 200 && !flying; i++) { await chip("LAUNCH"); await sleep(250); flying = await has("PLAN BURN"); }''',
'''  await page.evaluate(() => { window.__pin = false; });
  let flying = false;
  for (let i = 0; i < 200 && !flying; i++) { await chip("LAUNCH"); await sleep(250); flying = await has("PLAN BURN"); }''', 1, 'down')
subn(R, '''    data = JSON.parse(txt);
    const last = data.log[data.log.length - 1];''',
'''    data = JSON.parse(txt);
    if (data.seed !== seed) throw new Error("world seed " + data.seed + " against the pin " + seed);
    const last = data.log[data.log.length - 1];''', 1, 'check')
print("all substitutions in")
PYEOF
```

Expected output, exact: `all substitutions in`. Then `node --check docs/superpowers/perf/t93/run.mjs` prints nothing.

**A3. The rerun.** From `docs/superpowers/perf/t93`: start `bash all.sh 52805 >/tmp/t93-all.log 2>&1` with the Bash tool's background mode and wait for its completion notice, exactly as the plan's step 6 says. The first log line is `seed 52805`. Every experiments line reads `world-seed 52805`; a run whose first capture shows another seed fails itself at once with `world seed <X> against the pin 52805`, and that stops the task. The last line must be `ALL DONE seed 52805`, after `identity: Every run tells the same story …`, `wrote index.html`, the page check's three lines, and `PAGE CHECK OK`. The six logs and the page are overwritten by the rerun; the first six experiments lines stay as the record they are.

**A4. Steps 7 and 8 of the plan, unchanged** — the copies removed, `docs/superpowers/perf/t93/` committed whole (subject `the five measured`), the phase row and both plan files (the plan and this amendment) committed together (subject `t93 lands in the phase document — the five measured, no deploy`), both pushed. Commits end with the attribution lines the agent's own harness gives it.

## Report

As the plan's report, plus: the seed line as printed, the six `world-seed 52805` lines verbatim, and the identity line verbatim.
