# The Settled Valley — Amendment 3: the flag-row pin learns the markers

*Written by Claude Fable 5, 2026-08-26. The resume agent stopped correctly on one red outside Amendment 2's license. A full survey over every line Task 3 changes in `DepotGame.jsx` and `economy.js` confirms this is the only pin in the suite that matches any of them.*

## The one fix

`scripts/tests/26-the-ground-pays.mjs:36-37` pins the flag-row skip's literal text; the marker seam legitimately extended that line. Asserted behavior identical, one word joins:

old:
```js
  ok("F2: ruined buildings, depots and field walls fly nothing",
    /m\.depot \|\| m\.fwall \|\| b\.ruined\) continue;/.test(dg));
```
new:
```js
  ok("F2: ruined buildings, depots, field walls and markers fly nothing (re-taught mk2.63, the markers join)",
    /m\.depot \|\| m\.fwall \|\| m\.marker \|\| b\.ruined\) continue;/.test(dg));
```

## The license

This one pin and nothing else. Any further red stops the task.

## Resume

Step 8 as the main plan states: depot-test twice, depot-lint, smoke; then Step 9's deploy, this amendment joining the staged plan documents.
