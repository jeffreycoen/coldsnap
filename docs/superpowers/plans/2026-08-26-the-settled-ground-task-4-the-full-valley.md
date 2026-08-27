# The Settled Ground — Task 4: The Full Valley (mk2.64)

*Written by Claude Fable 5, 2026-08-26, against mk2.63 (commit 5daac70), on the owner's order: fill the valley with buildings. Dial turns and one counting fix, all in `src/depot/mapgen.js`, plus two boot-bound re-teaches. Verified in scratch: two 30-map random sweeps — average 2,548 of the 3,000 stone cap planned (mk2.63 spent ~1,500), about 40 real buildings a map against ~11 before, cap never crossed, worst boot 2,935 of the 4,000 pool, spawn-to-objective connectivity 60 of 60, every map seats its town. Suggested model: Sonnet — fully specified.*

## What this task does

The valley fills. Towns grow from four-to-seven buildings to eight-to-twelve; hamlets go three-to-four with three-to-five buildings each; singles go two-to-four; and a FILL pass lays real houses around the drawn centers until the map carries 2,600 planned stones or the ground refuses. One counting fix rides along: the stone ledger now counts EVERYTHING — big forms and field walls included — so the cap is the whole map's truth, not just the clusters'.

## Required reading

The report opens confirming each: this plan whole; `src/depot/mapgen.js` (the settled-valley region and the big-forms and field-wall loops); `scripts/tests/05-the-front.mjs:305-315`; `scripts/tests/08-debug-pass.mjs:265-300`; `src/version.js`.

## Licensed re-teaches

Two boot bounds move because the valley legitimately carries more stone (pool 4,000 since mk2.61):

1. `scripts/tests/05-the-front.mjs:311` — old→new:
```js
  ok("T4(a): worst boot stone count stays under the 3000 pool with rubble headroom", worstStones <= 2900, `${worstStones} stones (seed ${worstSeed})`);
```
```js
  ok("T4(a): worst boot stone count stays under the 4000 pool with rubble headroom (re-taught mk2.64, the full valley)", worstStones <= 3200, `${worstStones} stones (seed ${worstSeed})`);
```
2. `scripts/tests/08-debug-pass.mjs:296-298` and the foul flag at `:272` — old→new:
```js
  ok("T15(b2): boot stone count stays under the 3000 chunk pool on every seed",
    stoneHi < 3000, `${stoneLo}-${stoneHi}`);
```
```js
  ok("T15(b2): boot stone count stays under the 4000 chunk pool on every seed (re-taught mk2.64, the full valley)",
    stoneHi < 3400, `${stoneLo}-${stoneHi}`);
```
and `:272`: `if (stones >= 3000) allInRim = false;` → `if (stones >= 3400) allInRim = false; // re-taught mk2.64 — the pool is 4000`.

Nothing else. File 33's laws hold as written (the cap law now matches the unified ledger). Any other red stops the task.

*Amended at dispatch (owner's publish order, 2026-08-26): the mound-walk clock doubles, 60 → 120 sim-seconds, arrival distance unchanged — the denser valley makes the honest way around longer. A third licensed re-teach, in the phase's own test file.*

## Steps

### Step 1 — the mark

`src/version.js:6`: `mk2.63` → `mk2.64`.

### Step 2 — the dials, `src/depot/mapgen.js`

Six small edits inside the settled-valley region, each old→new verbatim:

**2a.** Town size, both call sites (the middle-bench call and the fallback-bench call): `4, 7,` → `8, 12,` on the `cluster("town", ...)` lines.

**2b.** The member ring tightens and tries harder:
- `const a = r() * 6.28, d = 9 + r() * 8;` → `const a = r() * 6.28, d = 7 + r() * 9;`
- `for (let m = 0; m < want * 6 && got < want; m++) {` → `for (let m = 0; m < want * 9 && got < want; m++) {`

**2c.** Hamlets: `const nHam = 2 + Math.floor(r() * 2);` → `const nHam = 3 + Math.floor(r() * 2);` and the hamlet `cluster(...)` call's `2, 4,` → `3, 5,`.

**2d.** Singles: `const nSingle = 1 + Math.floor(r() * 3);` → `const nSingle = 2 + Math.floor(r() * 3);`.

### Step 3 — the one ledger

**3a.** Move the ledger's declaration up beside `bid`, old→new:
```js
  let bid = 0;
  const nBig = 2 + Math.floor(r() * 3);
```
```js
  let bid = 0;
  let plannedStones = 0; // mk2.64: the one stone ledger — big forms, clusters, fill, walls, all of it
  const nBig = 2 + Math.floor(r() * 3);
```
and delete the old `let plannedStones = 0;` line inside the settled-valley region (the `const CL = [];` line above it stays).

**3b.** The big forms join the ledger, old→new:
```js
    town.push({ id: tpl.t + bid++, x, z, nx, nz, ny: tpl.ny,
      door: tpl.drive ? -1 : (r() < 0.5 ? 0 : nx - 1),
      slab: tpl.slab, drive: tpl.drive, cols: tpl.cols });
    placed++;
```
```js
    const eBig = { id: tpl.t + bid++, x, z, nx, nz, ny: tpl.ny,
      door: tpl.drive ? -1 : (r() < 0.5 ? 0 : nx - 1),
      slab: tpl.slab, drive: tpl.drive, cols: tpl.cols };
    town.push(eBig);
    plannedStones += stoneCount(eBig); // mk2.64: EVERYTHING counts against the cap
    placed++;
```

**3c.** The field walls join it too, old→new:
```js
    town.push({ id: "fwall" + placed, x, z, nx, nz, ny: H, door: -1, roof: false });
    placed++;
```
```js
    const eWall = { id: "fwall" + placed, x, z, nx, nz, ny: H, door: -1, roof: false };
    if (plannedStones + stoneCount(eWall) > TOWN_STONE_CAP) break; // mk2.64: the walls obey the ledger too
    plannedStones += stoneCount(eWall);
    town.push(eWall);
    placed++;
```

### Step 4 — the fill

Insert directly above the `// T4: FIELD WALLS` comment:

```js
  // THE FILL (mk2.64, owner: fill the valley with buildings) — after the
  // clusters, real houses join around the drawn centers until the valley
  // carries its mass. Markers and ruins are done; this pass lays LIVE forms
  // only, and stops at the fill line or when the ground refuses.
  const FILL_TARGET = 2600; // provisional (F5)
  const FILL_POOL = ["croft", "shed", "house5", "house6", "long", "row"];
  for (let k = 0; k < 900 && plannedStones < FILL_TARGET && CL.length; k++) {
    const c = CL[Math.floor(r() * CL.length)];
    if (c.kind === "dead") continue;
    const a = r() * 6.28, d = 6 + r() * 26;
    const e = put(FILL_POOL[Math.floor(r() * FILL_POOL.length)], c.x + Math.sin(a) * d, c.z + Math.cos(a) * d, { face: c });
    if (e) c.n++;
  }
```

### Step 5 — the two re-teaches

As licensed above, verbatim.

### Step 6 — gates

`node scripts/gate.mjs depot-test` TWICE (both green, different random draws), `node scripts/gate.mjs depot-lint`, `node scripts/gate.mjs smoke`. Suite count stays 2,091. Quote both runs' seed lines.

### Step 7 — the deploy

Build after the bump. Gates green → commit → push, this plan staged with the commit. Commit subject: `the full valley — the ground carries its mass, mk2.64`.

## The owner's live check

Boot valleys: the map should read FULL — a town you can lose a squad in, hamlets everywhere between, the stones counter around 2,600-2,900 of 4000. Phone and desktop. The fill line (2,600) and every count are dials for your tuning.
