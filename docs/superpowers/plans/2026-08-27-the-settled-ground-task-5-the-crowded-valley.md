# The Settled Ground — Task 5: The Crowded Valley (mk2.65)

*Written by Claude Fable 5, 2026-08-27, against mk2.64 (commit a0cce91), on the owner's order: twice the buildings, four times the trees. Verified in scratch on 50 random maps: planned stones average 5,282 against mk2.64's 2,550 (2.07x), about 81 real buildings a map against 39, trees drawn at four times today's counts and planting at 299-516 a map (average 389 against 115 — the ground refuses some near roads, walls, and towns). Cap never crossed, every map towned and connected. Suggested model: Sonnet — fully specified.*

**The stated risk:** boot bodies roughly double (worst measured boot 5,553 stones plus ~500 trees). Physics sleeps them; the draw cost is real and untested on the Pi — the never-run Pi collapse capture now matters twice as much. The stones counter is the alarm; the owner's live check is the judge.

## Licensed re-teaches

Two boot bounds move with the doubled mass; nothing else:

1. `scripts/tests/05-the-front.mjs:311` — `worstStones <= 3200` → `worstStones <= 6200`, label re-worded to name the 7000 pool and mk2.65.
2. `scripts/tests/08-debug-pass.mjs` — the `stoneHi < 3400` check → `stoneHi < 6500` (label names the 7000 pool, mk2.65) and the `:272` foul flag `>= 3400` → `>= 6500`.

File 33's laws hold as written. Any other red stops the task.

## Steps

### Step 1 — the mark

`src/version.js:6`: `mk2.64` → `mk2.65`.

### Step 2 — the caps

- `src/depot/mapgen.js`: `export const TOWN_STONE_CAP = 3000;` → `export const TOWN_STONE_CAP = 6000;` (comment kept, still provisional on the Pi capture).
- `src/render/renderer.js:934` region: `const CHUNK_CAP = 4000;` → `const CHUNK_CAP = 7000;` with one comment line added: `// mk2.65 (owner): the crowded valley — 6000 town + depots + rubble headroom.`
- `src/render/renderer.js:1385`: `const TREE_CAP = 360;` → `const TREE_CAP = 800;` with one comment line: `// mk2.65 (owner): four times the trees.`

### Step 3 — the buildings double, `src/depot/mapgen.js`

**3a.** `const FILL_TARGET = 2600; // provisional (F5)` → `const FILL_TARGET = 5200; // provisional (F5)`

**3b.** The first fill tries harder: `for (let k = 0; k < 900 && plannedStones < FILL_TARGET` → `for (let k = 0; k < 2400 && plannedStones < FILL_TARGET`

**3c.** The second fill — insert directly above the `// T4: FIELD WALLS` comment:

```js
  // THE SECOND FILL (mk2.65): the clusters' rings run out of legal ground
  // long before the doubled line — the rest of the mass spreads across the
  // open valley, anywhere the vet allows.
  for (let k = 0; k < 3000 && plannedStones < FILL_TARGET; k++) {
    const x = -76 + r() * 152, z = -66 + r() * 126;
    put(FILL_POOL[Math.floor(r() * FILL_POOL.length)], x, z, null);
  }
```

### Step 4 — the trees quadruple, `src/depot/mapgen.js` (planTrees)

Four dial edits, old→new verbatim:

- `for (let tu = -86; tu <= 86; tu += 3.2) {` → `for (let tu = -86; tu <= 86; tu += 1.6) {`
- `    const n = 6 + Math.floor(rT() * 4);` → `    const n = 24 + Math.floor(rT() * 16);`
- `  const nCop = 2 + Math.floor(rT() * 4);` → `  const nCop = 12 + Math.floor(rT() * 12);`
- `    const n = 5 + Math.floor(rT() * 5);` → `    const n = 10 + Math.floor(rT() * 10);`
- `  const nFor = Math.floor(rT() * 3);` → `  const nFor = 2 + Math.floor(rT() * 3);`

### Step 5 — the two re-teaches

As licensed above, verbatim old→new.

### Step 6 — gates

`node scripts/gate.mjs depot-test` TWICE (both green, different random draws; suite stays 2,091), `node scripts/gate.mjs depot-lint`, then `npm run build`, then `node scripts/gate.mjs smoke` — the build comes BEFORE smoke so the bundle carries the new mark (the mk2.64 lesson, now the standing order of this plan). Quote both seed lines.

### Step 7 — the deploy

Gates green → commit → push, this plan staged. Commit subject: `the crowded valley — twice the town, four times the wood, mk2.65`.

## The owner's live check

Boot valleys: roughly double the buildings and four times the trees of what you just tested; the stones counter around 5,300-5,800 of 7000; how it runs on your hardware is the real check — the frame rate readout is beside the counter.
