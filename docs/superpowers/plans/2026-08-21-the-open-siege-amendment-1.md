# THE OPEN SIEGE — Amendment 1 (mk1.96)

*2026-08-21. One defect, found by the implementation agent at the Step 7 gate and correctly stopped on: the plan contradicts itself. Step 6a's replacement comment for `buildAt` quotes the expunged phrase verbatim — and era 15's O1 pins that the string `Leave them a road` appears nowhere in the game layer's source. The plan-writer self-tested O8/O9 against the replacement code but never ran O1 against the replacement COMMENT. Suite as left by the agent: 1706 PASS, 1 FAIL (O1 alone).*

## The fix (the phrase stays expunged; the comment stops quoting it)

O1 stands unchanged — the expungement means the words are gone, comments included. Step 6a's `buildAt` replacement comment changes from:

```
// mk1.96 (owner): "Leave them a road" EXPUNGED — a sealed map is the
// attacker's problem; the siege flow marches it onto the wall.
```

to:

```
// mk1.96 (owner): the road rule EXPUNGED — a sealed map is the
// attacker's problem; the siege flow marches it onto the wall.
```

One comment line's wording; no code, no assert, no gate changes. Everything else in the plan stands as approved. Expected gates after the edit: exactly as the plan names them — depot-test **1707 PASS, 0 FAIL**, lint clean, smoke green.

## Verification (run by the plan-writer, against the agent's held tree)

The reworded comment clears O1's regex (`!/Leave them a road/`), and no other era-15 assert reads comment text. Checked by testing the regex against the new line directly.
