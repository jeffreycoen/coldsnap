# The Storage Door — Amendment 1 (the second comment)

Amends `2026-08-27-storage-door-task.md` after its dispatch stopped at
step 6, 2026-08-27. One defect, mine: step 4 named the line-158 comment
but not the second `window.storage` mention in `save.js` — the comment
above `burnFront()` (line 325). One reword closes it; everything else in
the original plan stands, including its steps 7–9, which resume
unchanged after this edit.

## The one edit

`src/depot/save.js`, the comment above `burnFront()`. Today:

```
// artifact runtime) AND localStorage (the Pages shim behind it).
```

with its preceding line reading `// Both stores, the campaign's own burn
discipline: window.storage (the`. The phrase `window.storage (the` in
that preceding line becomes `the storage door (the`.

## Then

Re-run the original step 6 grep — `grep -c "window\.storage"
src/depot/save.js` now expects 0 — and continue with the original
steps 7 (bump to mk2.85), 8 (gates, build, preview restart, smoke), and
9 (commit and push) exactly as written.
