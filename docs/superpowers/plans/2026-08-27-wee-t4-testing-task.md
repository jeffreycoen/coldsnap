# Task 4 combined — Testing task: classify the 42 failures, no edits

A diagnosis task. The stopped run left the task-4 code whole in the tree
and one consumed depot-test run showing 42 failures. This task names
every one of the 42 as either PREDICTED (a pin or slice reading component
text that now lives in boot.js or tick.js — the plan's step-7 class) or
UNPREDICTED (anything else), and for each unpredicted one states the
mechanism from reading the code. It changes NOTHING: no file is edited,
no version bumps, nothing commits, and the full depot-test gate is not
run — the suite files run one at a time, which tests exactly what
changed.

**Suggested model: Sonnet 5** — running listed files and reading listed
checks; no design, no edits.

## Required reading

1. This plan, whole.
2. The task-4 plan's step 7 (the predicted re-point list) —
   `2026-08-27-wee-t4-engine-leaves-the-screen.md` — and amendment 2's
   closing note.
3. Nothing else up front; each failing check's own code is read as it
   fails, and only that.

## Steps

### Step 1 — preconditions (failing asserts first)

```bash
git log --oneline -1                          # e8938d8 — nothing committed
node src/depot/api.js gate >/dev/null; echo exit=$?    # exit=0 — the task-4 code stands
git status --short -- src | sort              # exactly: M api.js, M DepotGame.jsx, ?? boot.js, ?? tick.js
```

Any other source change stops the task.

### Step 2 — run the suite files one at a time

Run each of these in the foreground, one at a time, capturing PASS/FAIL
counts and every FAIL line verbatim (these are the plan's step-7 files
plus the two income files the stopped agent flagged):

```bash
for f in 01 02 04 05 06 07 08 09 11 16 18 21 22 23 25 26 28 33; do
  node scripts/tests/$f-*.mjs 2>&1 | grep -E "^(PASS|FAIL)" | tail -0
  node scripts/tests/$f-*.mjs 2>&1 | grep -c "^PASS"
  node scripts/tests/$f-*.mjs 2>&1 | grep "^FAIL"
done
```

(One invocation per file is fine if the counts and FAIL lines are both
captured from it; the form above is the intent, not a literal loop to
paste.) Files that were green in the stopped run and are not in the list
are not run.

### Step 3 — classify every failure

For each FAIL line, one row: file, check name, verdict, mechanism.

- PREDICTED: the check reads DepotGame.jsx source text (a pin's pattern
  test or an executed slice) that Move A or Move B relocated. Verdict
  requires showing the text now present in boot.js or tick.js — one
  grep per row proves it:
  `grep -c "<the pinned text's distinctive fragment>" src/depot/boot.js src/depot/tick.js`.
- UNPREDICTED: anything else — a check that fails with the pinned text
  still in place, a behavioral assertion on live arithmetic, a crash.
  For each: read the check's code and the code it drives, and state the
  mechanism in two or three sentences. NO fixing, NO re-teaching, no
  matter how obvious.

The two named suspects go first: 26-the-ground-pays G2 rows (lines
21–23) and 28-the-earned-muster E4 row (line 53). At plan-writing their
patterns were read: all four test `dg` — the DepotGame source — for
income lines Move B relocated to tick.js, which reads as PREDICTED; the
classification must confirm or refute that from the runs.

### Step 4 — the count reconciles, or the gap is named

The rows must sum to the stopped run's 42. A failure the stopped run saw
that no single-file run reproduces, or a new failure it did not see, is
its own labeled bullet with the run output — un-reproduced is a finding,
never smoothed over.

## Acceptance (arithmetic)

- Every suite file in step 2 run exactly once; counts recorded.
- Exactly one verdict row per failure; rows sum to 42 or the difference
  is itself reported.
- Tree byte-identical at the end: `git status --short -- src scripts`
  unchanged from step 1's snapshot.

## Report

One line: how many PREDICTED, how many UNPREDICTED. Then: the
classification table; the two suspects' verdicts first with their
mechanism sentences; per-file pass/fail counts with runtimes and each
suite's own printed seeds; any reconciliation gap as its own bullet;
every deviation labeled. No recommendations — the findings feed the
owner's next ruling.
