# The Jeep Refit — Amendment 1: one bad paren, one weak invariant

Two defects, both the plan-writer's, both proven before this amendment was served.

**1. The pin regex cannot match the plan's own code.** Step 1's coax pin carries a doubled closing paren. In `scripts/tests/46-the-jeep-refit.mjs`, replace exactly:

```js
  ok("(c) pins: the possessed jeep fires its coax, not the shell", /\(pv\.vtype === "apc" \|\| pv\.vtype === "jeep"\)\) possessedArmorMg/.test(tk));
```

with:

```js
  ok("(c) pins: the possessed jeep fires its coax, not the shell", /\(pv\.vtype === "apc" \|\| pv\.vtype === "jeep"\) possessedArmorMg/.test(tk));
```

**2. T19(b3)'s rolled seed caught Amendment 3's invariant being too strong.** An engineer pick fields a real enemy squad, and squad members are not garrison-marked — so "every fielded man is garrison" fails on any deal holding engineers. The corrected invariant — every fielded man is the enemy's, and each is garrison OR a member of a mustered enemy squad — was proven across twelve rolled seeds at amendment-writing time. In `scripts/tests/09-reorg.mjs`, replace exactly:

```js
    ok("T19(b3): the muster's fielded men are the mirror's standing force, whatever the deal (re-taught mk2.98, owner: the count belonged to one seed's hand)", w.bodies.filter((b) => b.kind === "unit" && b.alive).every((b) => b.team === 2 && b.garrison === true), guard);
```

with:

```js
    ok("T19(b3): the muster's fielded men are the mirror's — standing force or its mustered squads, whatever the deal (re-taught mk2.99: an engineer pick fields a squad, not garrison men)", w.bodies.filter((b) => b.kind === "unit" && b.alive).every((b) => b.team === 2 && (b.garrison === true || (S19.foeSquads || []).some((q) => q.memberIds.includes(b.id)))), guard);
```

## Dispatch state

Steps 1–6 are applied on the tree and correct. Apply the two replacements, then Step 7's gates from the top (depot-test, depot-lint, smoke, blocking, all green — a T19 failure after this fix is a real finding, STOP) and Step 8 unchanged; the commit includes this amendment file. Both replacements are their own old→new bullets in the landing report.
