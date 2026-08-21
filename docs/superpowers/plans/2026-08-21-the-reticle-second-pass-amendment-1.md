# THE RETICLE, SECOND PASS — Amendment 1 (owner-ruled: shorten the comment)

The mk2.00(e) pin allows 240 characters between the BUILD toggle's close line and the possession guard; the original step-4 comment makes the real gap 249. The owner's ruling: the comment shrinks, the regex stands.

## The one change

Step 4's BUILD toggle insertion — originally the 3-line comment plus the guard — becomes this 2-line insertion, same place (between `const S = stateRef.current;` and `const b = S && S.mode ? branchOf(S.mode) : null;`):

```js
              // mk2.00 (owner): no build tree over a live possession.
              if (S && S.possess) return;
```

Measured gap from the end of `if (buildOpen) { closeBuild(); return; }` to the start of `if (S && S.possess) return;` with this comment: 128 characters — inside the pin's 240.

Everything else in the plan stands unchanged, including the mk2.00(e) regex exactly as written in step 1.

## Execution from the halted tree

The tree already carries all edits; only the toggle comment changes. Then the task resumes at step 5: the four gates in order, then step 6's deploy, both exactly as the plan wrote them.
