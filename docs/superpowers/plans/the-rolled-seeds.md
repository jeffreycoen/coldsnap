# The Rolled Seeds (mk3.02)

The owner's orders (2026-09-04): no test carries a written-in seed, and the plan-writer's own files owe the fix. Six test files from the mk2.88–mk2.98 line carry seventeen hardcoded seeds; each file learns to roll one base seed per run, print it, and derive its scenes from it. One fixture hardens so its asserts hold on any roll. The conversions were built and validated at plan-writing time: all six files ran green on THREE independent rolled rounds — eighteen runs, zero failures.

Suggested model: Sonnet 5 — six files, three mechanical edits, the tables below are exhaustive.

## INVENTORY — what moves

Every `seed: <number>` literal in exactly these files, and nothing else:
`scripts/tests/35-the-armor-attack.mjs` (4: 110–113), `37-the-order-chain.mjs` (4: 120–123), `40-the-escort-link.mjs` (2: 130–131), `41-the-queued-line.mjs` (1: 140), `44-the-suspension.mjs` (5: 150–154), `45-the-jeep.mjs` (1: 160). No other file is touched; the pre-existing suite's seeds are not this task's.

## SUBSTITUTION TABLE — every token allowed to differ

1. In each of the six files, immediately after the file's opening `console.log("\n[mk…]");` line, these two lines are inserted:

```js
  const SEED = (Date.now() % 1000000) + 1; // rolled each run — no seed is ever special
  console.log("  fixture seed base", SEED);
```

2. Each file's `seed: <number>` literals become `seed: SEED + <k>`, k counting 0, 1, 2… in source order within that file (35: +0…+3; 37: +0…+3; 40: +0,+1; 41: +0; 44: +0…+4; 45: +0).

3. In `35-the-armor-attack.mjs` ONLY, the foe factory line

```js
  const mkFoe = (w, x, z, hp) => addBody(w, { kind: "unit", team: 2, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x, y: 0.74, z, hp });
```

becomes

```js
  const mkFoe = (w, x, z, hp) => { const u = addBody(w, { kind: "unit", team: 2, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x, y: 0.74, z, hp }); u.pinned = true; return u; }; // pinned: the target stands whatever the dice, so the halt geometry is seed-free
```

(Without it, seed-varied blast shoves could drift the target out of gun reach mid-test; a pinned body still takes damage and still dies — scene (c) proves it.)

An unlisted difference stops the agent. Comments in the plan-writing seeds' old text (`Seeds 110-113` style header comments) may be updated to say the seeds are rolled — prose only, same license as the inserted comment.

## ARITHMETIC — acceptance

`node scripts/gate.mjs depot-test` green with the suite's exact pass count unchanged: **2,201 PASS / 0 FAIL** (no assert added or removed — only how seeds are chosen). Run it TWICE, back to back, so two different rolls prove the law; both runs must show 2,201 / 0. Then `node scripts/gate.mjs smoke` green. Then `src/version.js` `mk3.01` → `mk3.02`, `npm run build` after the bump, commit (the six test files, version.js, this plan file, .superpowers/gates.log) and push. Commit subject: `the rolled seeds — no test carries a written-in seed, mk3.02`.

The two depot-test runs are the one sanctioned exception to the never-re-run rule: two rolls are the point.

## Acceptance

Both depot-test runs 2,201 / 0; smoke green. The owner's check: any test log now opens with the seed it rolled.
