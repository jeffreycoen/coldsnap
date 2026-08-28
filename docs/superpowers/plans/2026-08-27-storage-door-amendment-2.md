# The Storage Door — Amendment 2 (the one test pin)

Amends `2026-08-27-storage-door-task.md` after the depot-test gate
failed 2,088/1 on the amended run, 2026-08-27. One defect, mine: the
plan declared no sweep license, but one suite check pins the literal
`window.storage.set(CARDS_KEY` in DepotGame's source — exactly the text
the repoint re-spelled. It is the only such pin in the suite (measured).
The behavior the check guards — closing a teaching card marks it seen
and persists the set — is unchanged.

## Sweep license (this amendment grants it, scoped to one pin)

`scripts/tests/25-the-teaching-cards.mjs` line 34 — the T3 check — may
be re-taught old→new spelling only. Asserted content stays identical:
the same seen-add followed by the same persistence call on the same key.
No other test edit is licensed; any other failure stops the task.

## The one edit

Line 34 today:

```
  ok("T3: closing marks seen and persists the set", /view\._teachSeen\.add\(k\);[\s\S]{0,220}window\.storage\.set\(CARDS_KEY/.test(dg));
```

becomes:

```
  ok("T3: closing marks seen and persists the set", /view\._teachSeen\.add\(k\);[\s\S]{0,220}storage\.set\(CARDS_KEY/.test(dg));
```

(the `window\.` prefix drops from the regex; nothing else changes. The
new pattern matches the live source's `storage.set(CARDS_KEY`.)

## Then

Re-run the original plan's step 8 tail from the top — depot-test now
expects 2,089/0 again — then golden (7/0), depot-lint (exit 0),
`npm run build`, the preview restart with liveness check, smoke (30/0),
and the original step 9 commit and push, with the test file added to the
staged set:

```
git add src/platform/storage.js src/depot/api.js src/depot/save.js src/depot/DepotGame.jsx src/version.js scripts/tests/25-the-teaching-cards.mjs
git commit -m "the storage door — the war's persistence comes through api.js, mk2.85"
git push
```

## Report addition

The re-teach is its own labeled bullet: the pin's old and new text, and
the statement that no other test was touched.
