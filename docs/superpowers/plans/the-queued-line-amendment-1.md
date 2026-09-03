# The Queued Line — Amendment 1: the acceptLine pin

One pre-existing pin holds the literal `else startBuildLine(...)` line that Step 5 rewrote into its braced form. The asserted mechanism — acceptLine calls startBuildLine with the same arguments — is unchanged; only the literal moved. Re-taught old→new. The plan should have pre-licensed it; the plan-writer's sweep now also greps the test suite for every literal a plan's old-blocks replace.

In `scripts/tests/04-vision-command-possession.mjs`, replace exactly (currently lines 657–658):

```js
  ok("COMMAND T2(b): acceptLine exists and calls startBuildLine (re-taught mk1.50, P7 T20: startBuildLine's new-arity call)",
    /else startBuildLine\(grid, sq, lp\.kind, lp\.a, lp\.b, toast\);/.test(acceptBody));
```

with:

```js
  ok("COMMAND T2(b): acceptLine exists and calls startBuildLine (re-taught mk1.50, P7 T20: startBuildLine's new-arity call; re-taught mk2.94: the braced form, the chain wipe beside it)",
    /else \{ startBuildLine\(grid, sq, lp\.kind, lp\.a, lp\.b, toast\); sq\._queue = null; \}/.test(acceptBody));
```

## Dispatch state

Steps 1–6 are applied on the tree and correct. On dispatch the agent applies the re-teach above, then resumes Step 7's gates from the top: depot-test, depot-lint, smoke, all green, no further re-teach licensed. Then Step 8 unchanged (bump to mk2.94, build, commit, push — the commit includes this amendment file and the re-taught 04-vision-command-possession.mjs). The re-teach is reported old→new in the landing report. Nothing else in the plan changes.
