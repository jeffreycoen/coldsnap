# War Engine Extraction — Closeout (mk2.75)

The phase closes: the README's claims re-measured against the shipped
game, the phase document's index set right, the version marked. No code
changes; no test suite runs (nothing tested changes).

**Suggested model: Sonnet 5** — four exact edits, a build, a landing.

## Measurements (taken at plan-writing, tree at commit 13a3263, mk2.74 live)

- Checks: 2,089 (the mound deletion, owner's order).
- Bundle: 1,386,458 bytes = 1.39 MB; compressed 431,899 bytes ≈ 422 KB.
  Still under the 1.44 MB floppy (1,474,560 bytes).
- Engine: `src/engine/core.js` is 2,530 lines — the "~2,500" claim holds.
- The valley screenshot: the shipped ground did not change this phase —
  no retake.

## Steps

### Step 1 — preconditions

```bash
git log --oneline -1        # 13a3263
grep -c "2,091 headless" README.md    # 1
grep -c "1.31 MB" README.md           # 1
```

### Step 2 — README, two edits, exact

1. Line 5: `one 1.31 MB bundle, about 418 KB over the wire` becomes
   `one 1.39 MB bundle, about 422 KB over the wire`. The floppy sentence
   stays — it still holds.
2. Line 40: `2,091 headless checks` becomes `2,089 headless checks`.

### Step 3 — the phase document, two edits, exact

In `docs/superpowers/plans/2026-08-27-war-engine-extraction-phase.md`:

1. The T3 row's status cell: `DISPATCHED 2026-08-27 — plan
   2026-08-27-wee-t3-state-split.md, agent running` becomes
   `LANDED — commit e8938d8, gates 2,089/0 + 7/0 + 30/0, build green`.
2. The Status section gains one closing sentence:
   `Phase closed 2026-08-27 at mk2.75: the war engine boots, ticks, and
   saves headless through src/depot/api.js; claims re-measured at
   closeout.` The Closeout index row's status cell becomes `LANDED`.

### Step 4 — version, build, landing

MK → `"mk2.75"` in `src/version.js`; `npm run build` after. Commit
everything modified plus this plan file, subject:

```
the extraction closes — the engine stands alone, mk2.75
```

Standing trailers. Push.

## Acceptance

- The three grep counts of step 1 flip to 0 / 0 after step 2's edits
  (re-grep); the new strings each appear once.
- Build green. Push green.
