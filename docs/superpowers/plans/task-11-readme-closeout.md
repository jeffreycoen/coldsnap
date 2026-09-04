# TASK 11 — README CLOSEOUT (mk2.48, no bump)

Phase closeout per standing orders: the README's claims re-checked against the shipped game. Measured at plan time from the mk2.48 build: raw bundle 1.39 MB (claim holds), gzip 441 KB (claim says 439), depot-test 1,953 checks (claim says 1,909). The two screenshots picture the war and the valley — untouched by this phase, they stand. The phase's shipped features join the claims. Documentation only — no version bump (the standing rule bumps deploys of the game; this commit touches README alone and CI redeploys the same mk2.48 build).

**Suggested model: Sonnet** — three exact edits.

## Required reading

1. This plan.
2. `README.md` (all 53 lines).

## Steps

### Step 1 — the numbers

Line 5: `about 439 KB over the wire` → `about 441 KB over the wire`.

Line 36: `1,909 headless checks run green behind seven CI gates on every push.` → `1,953 headless checks run green behind seven CI gates on every push.`

### Step 2 — the phase's claims: two new bullets

After the sandbox bullet (line 28), append:

```markdown
- **The game teaches itself in play.** No manual: twenty-eight one-card lessons fire once each at their first real moment — the first bell, the first radial, the first take-over — pageable and skippable, and holding any control (or its ⓘ) reopens its card. An optional walk tours the essentials before the first war.
- **The front door is the war itself.** The menu's background is the real opening view — the valley about to be played, rendered by the game's own renderer from the seed shown as FIELD ORDER #. Resuming shows the saved war's own valley.
```

### Step 3 — verify and land

- `grep -c "1,953" README.md` returns 1; `grep -c "441 KB" README.md` returns 1; no other line changed (`git diff --stat` shows README.md only).
- No gates — no game code moves; the suite pins nothing in README.
- Commit ("README: the teaching cards and the opening view join; counts and sizes re-measured (1,953 checks, 1.39 MB / 441 KB)"); push. No version bump.

## Report

Read-confirmation, one line of outcome, the three edits confirmed, the diff-stat line, commit hash. Every nonconformity its own labeled bullet.
