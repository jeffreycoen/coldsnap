# T93 amendment 3: the phone width

The measurement is done and clean: six runs at world seed 52805, every non-timing field identical across all six, the page built, the desktop check passed. The phone check failed: sideways scroll at 390 pixels. The summary table scrolls inside its own box, but that box's parent section is a grid item without `min-width: 0`, so the table's unwrapped width pushes the section, then the page, wider. This amendment adds the one line, rebuilds the page from the six logs that stand, runs the check, and lands by the plan's steps 7 and 8. No game run.

Checked at plan-writing: the anchor hits once in the saved `page.mjs`, the amended file parses, and the built page passes `check.mjs` on a copy — desktop svgs 2, paths 6, no page errors; phone sideways scroll false.

## Required reading

- This amendment, whole.
- The plan `docs/superpowers/plans/2026-10-09-t93-the-five-measured.md`, steps 7 and 8 and the Report section.
- `docs/superpowers/perf/t93/page.mjs`, the `<style>` block (lines 47 to 90).

## Steps

**C1. The one line.** From the repo root:

```bash
python3 - <<'PYEOF'
import sys
def subn(path, old, new, n, tag):
    s = open(path).read()
    if s.count(old) != n: sys.exit("anchor fail: %s (count %d, wanted %d)" % (tag, s.count(old), n))
    open(path, 'w').write(s.replace(old, new))
P = 'docs/superpowers/perf/t93/page.mjs'
subn(P, '.wrap { max-width: 920px; margin: 0 auto; display: grid; gap: 28px; min-width: 0; }',
        '.wrap { max-width: 920px; margin: 0 auto; display: grid; gap: 28px; min-width: 0; }\n.wrap > * { min-width: 0; } /* a grid item holds its scrolling table instead of growing to it */', 1, 'width')
print("all substitutions in")
PYEOF
```

Expected output, exact: `all substitutions in`. Then `node --check docs/superpowers/perf/t93/page.mjs` prints nothing.

**C2. The page and its check.** From `docs/superpowers/perf/t93`: `node page.mjs && node check.mjs`. Expected, in order: `identity: Every run tells the same story: world seed, row count, awake, asleep, welds, eaten, and bodies are identical across all six. Only the timing differs.`, `wrote index.html`, the desktop line with `svgs 2 | paths 6` and `page errors 0`, `phone: sideways scroll false`, `PAGE CHECK OK`. Anything else stops the task.

**C3. Steps 7 and 8 of the plan, unchanged** — the six copies removed and their parent folder gone, `git -C /home/batman/coldsnap status --short -- src` printing nothing; `docs/superpowers/perf/t93/` committed whole by explicit path (subject `the five measured`), pushed; the T93 row added after the T92 row in `docs/superpowers/plans/2026-09-11-the-family-sky-phase.md`, worded as the plan's step 8 gives it, committed by explicit path together with the four plan files — the plan and amendments 1, 2, and 3 — (subject `t93 lands in the phase document — the five measured, no deploy`), pushed. Other untracked files under docs are left alone. Commits end with the attribution lines the agent's own harness gives it.

## Report

As the plan's report: the identity line and the check's three lines verbatim, the seeds (12345 for the battery, 52805 for the runs), both commit hashes, every deviation its own labeled bullet.
