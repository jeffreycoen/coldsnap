# Graphics Engine T1 — THE COPY (mk2.8)

One task, one landing: the directory `src/graphics/` is created holding
byte-identical copies of the three render files. Nothing imports the new
files yet — that is T2. The old files do not change by a single byte.

Phase document: `2026-08-27-graphics-engine-phase.md`.

**Suggested model: Sonnet 5** — a mechanical copy with hash acceptance;
no design.

## Required reading (verify each exists before starting; read in full)

1. This plan.
2. `docs/superpowers/plans/2026-08-27-graphics-engine-phase.md`
3. `src/render/renderer.js` (2,716 lines)
4. `src/render/troopkit.js` (180 lines)
5. `src/render/portrait.js` (134 lines)

The report opens with a read-confirmation line naming all five.

## INVENTORY — what moves (copies; originals stay)

| Source | Destination | Lines |
|---|---|---|
| `src/render/renderer.js` | `src/graphics/renderer.js` | 2,716 |
| `src/render/troopkit.js` | `src/graphics/troopkit.js` | 180 |
| `src/render/portrait.js` | `src/graphics/portrait.js` | 134 |

Import paths inside the copies resolve unchanged: `src/graphics/` sits at
the same depth as `src/render/`, so `../engine/core.js`, `./troopkit.js`,
and `./renderer.js` all point correctly from the new directory.

## SUBSTITUTION TABLE

Empty. The copies are byte-identical. Any difference of any kind stops
the task. (The `renderer.js` header comment still says
`render/renderer.js` inside the copy — accepted and known; T2 edits that
file anyway and re-signs the header there.)

## Steps, in order

Step 1 — failing asserts first. Before any write, confirm the
preconditions; a failure stops the task:

```
test ! -e src/graphics && echo OK-no-dir || echo STOP-dir-exists
git status --porcelain src/render/ | grep -q . && echo STOP-render-dirty || echo OK-render-clean
```

Step 2 — the copies. Create the directory and copy the three files:

```
mkdir src/graphics
cp src/render/renderer.js src/graphics/renderer.js
cp src/render/troopkit.js src/graphics/troopkit.js
cp src/render/portrait.js src/graphics/portrait.js
```

Step 3 — the arithmetic (see ACCEPTANCE below). All three `cmp` checks
pass, `git diff` over `src/render/` is empty.

Step 4 — the version bump. In `src/version.js` the one constant changes:

```
export const MK = "mk2.8";
```

Step 5 — gates, through the wrapper:

```
node scripts/gate.mjs depot-test
node scripts/gate.mjs golden
```

Expected: depot-test 2,089 PASS / 0 FAIL; golden 7 PASS / 0 FAIL. The new
files are imported by nothing, so any other number is a finding — stop.

Step 6 — the build, AFTER the bump, never before:

```
npm run build
```

A clean exit is the gate.

Step 7 — commit and push (the landing includes the deploy):

```
git add src/graphics src/version.js
git commit -m "the graphics engine forked — three byte-identical copies, mk2.8"
git push
```

## ARITHMETIC acceptance

- `cmp -s src/render/renderer.js src/graphics/renderer.js` exits 0.
- `cmp -s src/render/troopkit.js src/graphics/troopkit.js` exits 0.
- `cmp -s src/render/portrait.js src/graphics/portrait.js` exits 0.
- `git diff --stat src/render/` prints nothing.
- depot-test 2,089 / 0; golden 7 / 0; build exit 0.

## Sweep license

None. No test pins move in this task; any test failure stops the task.

## Report

One line of outcome, then bullets: the three cmp results, the two gate
counts with the fixture seeds the suite ran, the build result, the commit
hash. Every deviation its own labeled bullet.
