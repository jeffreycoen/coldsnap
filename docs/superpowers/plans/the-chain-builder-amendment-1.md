# The Chain Builder — Amendment 1: the teaching-table count

One pre-existing pin counts the teaching table's cards and requires exactly 28. Step 9's two new cards (`queue_chain`, `clear_chain`) make it 30. The count is re-taught 28 → 30; the asserted content is otherwise identical. The plan should have pre-licensed this and did not — the plan-writer's pre-serve check verified its own pins but did not sweep for count pins over the tables the plan touches; that sweep is now part of the check.

In `scripts/tests/25-the-teaching-cards.mjs`, replace exactly (currently line 15):

```js
ok("T2: the teaching table holds the twenty-eight", Object.keys(TEACH).length === 28);
```

with:

```js
ok("T2: the teaching table holds the thirty", Object.keys(TEACH).length === 30); // mk2.91: queue_chain and clear_chain joined
```

## Dispatch state

Steps 1–10's edits are already applied on the tree and correct, including the first licensed re-teach. On dispatch the agent applies the re-teach above, then resumes Step 10's gates from the top: depot-test, depot-lint, smoke, all green, then Step 11 unchanged (bump to mk2.91, build, commit, push — the commit includes this amendment file and the re-taught 25-the-teaching-cards.mjs). Both re-teaches are reported old→new in the landing report. Nothing else in the plan changes.
