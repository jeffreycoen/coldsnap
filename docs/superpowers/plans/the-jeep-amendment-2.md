# The Jeep — Amendment 2: the lattice pin

The sixteenth failure is not a count: the lattice pin holds the build-bar vehicles row's key array as the literal `["hero_apc"]`, which Step 9c legitimately grew to `["hero_apc", "hero_jeep"]`. Same class as the fifteen — a literal the task moves, asserted mechanism identical — but outside Amendment 1's rule, whose stop clause rightly fired. One more re-teach is licensed, exactly this:

In `scripts/tests/24-the-quartermaster.mjs`, replace exactly (currently line 64):

```js
    dg6.match(/vehicles:[\s\S]{0,200}\["hero_apc"\]/) != null &&
```

with:

```js
    dg6.match(/vehicles:[\s\S]{0,200}\["hero_apc", "hero_jeep"\]/) != null &&
```

## Dispatch state

Amendment 1's fifteen count/HERO_MODE re-teaches proceed under its rule, this pin under this one — seventeen licensed re-teaches in all (with the CARDS count, eighteen). Anything beyond them still stops the task. Then Step 12's gates from the top and Step 13 unchanged; the commit includes this amendment file. Every re-teach reported old→new.
