# The Jeep — Amendment 3: T19's fixture stops testing the deal

The design: there is an additional unit, so dealing is different now; and no test carries a written-in seed — a test rolls one each run, prints it, and its asserts hold on whatever was rolled. T19(b3) pinned the men one particular deal fielded; it is re-taught to roll its seed and assert the mechanism instead. The draw count (commander 1 + seven + seven = 15) and the books (heads 60) are deal-independent and stand.

In `scripts/tests/09-reorg.mjs`, two replacements.

**1.** Replace exactly:

```js
    const map19 = makeMap(91);
    const flatF19 = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (x, z, o) => { o.x = 0; o.y = 1; o.z = 0; return o; } };
    const w = makeWorld({ field: flatF19, seed: 91 });
```

with:

```js
    const seed19 = (Date.now() % 100000) + 1; // rolled each run, printed below — no seed is ever special
    console.log("T19 fixture seed", seed19);
    const map19 = makeMap(seed19);
    const flatF19 = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (x, z, o) => { o.x = 0; o.y = 1; o.z = 0; return o; } };
    const w = makeWorld({ field: flatF19, seed: seed19 });
```

**2.** Replace the T19(b3) line — match it as it stands on the tree (Amendment 1 re-worded its parenthetical prose); its mechanical tail is `guard === 6, guard);` — with:

```js
    ok("T19(b3): the muster's fielded men are the mirror's standing force, whatever the deal (re-taught mk2.98, owner: the count belonged to one seed's hand)", w.bodies.filter((b) => b.kind === "unit" && b.alive).every((b) => b.team === 2 && b.garrison === true), guard);
```

(The `guard` counter above the line stays — it rides as the assert's printed detail.)

If T19(b) draws or T19(b5) heads fail under rolled seeds, that is a real finding, not a re-teach — STOP and report. Any other test failing remains a stop.

## Dispatch state

Everything else is green. Apply the two replacements, then Step 12's gates from the top (depot-test, golden, depot-lint, smoke, blocking, all green) and Step 13 unchanged; the commit includes all three amendment files. Both replacements are their own old→new bullets in the landing report.
