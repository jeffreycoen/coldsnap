# TASK 2 — THE TOWN FLAGS (mk2.50)

Owner's rulings, 2026-08-25: standing buildings fly their holder's flag — yours gold, the enemy's scarlet; neutral or contested ground flies none; a ruined building flies none. Flags are render-only — never bodies, never eyes, never territory emitters (a `kind:"flag"` body is both, so no body is ever made).

One written choice for the owner to ratify at review: **depots and field walls fly no building flag.** The depots already fly their real (load-bearing) flag bodies; a freestanding field-wall screen reading as a flagged "building" would be noise. Old ruins that still stand DO fly one — they pay, so they show their holder.

**Suggested model: Sonnet** — every edit is specified verbatim here.

## Facts this plan is built on (verified at plan time)

- The renderer draws pole+cloth at every body with `flagPole === true`, capped at 24 instances (`renderer.js:1007-1009` pools, `:2487` guard), inside a `world.wind` gate — no-wind modes (TD/campaign/demo/golden) draw zero flags (`renderer.js:2480-2508`). Cloth tint: `_flagEnemyMult` for team 2, `_flagWhite` otherwise (`:2502`).
- `renderer.js` changes are guarded additive divergences; `golden` must stay green — it renders no-wind modes, where this task's additions draw nothing.
- The setter idiom is `setMines` (`renderer.js:1459`), exported in the return object (`:2632`).
- `DepotGame.jsx` already imports `holderAt` (line 34) and `MASON` (line 18); `town` rows carry `{id, x, z, ruined}` (buildTown, line 381); `TOWN` entries carry `ny`/`depot`; field walls are ids starting `fwall` (`mapgen.js:265`), old ruins `oldruin` (`:244`).
- Derived per-tick overlay refreshes hang off `if (terrGuard > 0)` (`DepotGame.jsx:3824-3857`) — the flags list joins them at the same 4Hz cadence.
- Instance budget: town entries are ~10-25 per map minus depots/field walls, plus every tower and both depot flags in the body loop sharing the same `fi` counter — cap 24 → **96** covers both with headroom.
- Nothing is saved: the list re-derives from `town` + the territory field within 0.25s of any boot or resume.

## Required reading (read-confirmation opens the report)

1. This plan.
2. `src/render/renderer.js` lines 995-1025 (the flag pools) and 2475-2510 (the draw block), 1450-1470 (the setMines idiom), 2630-2633 (the return object).
3. `src/depot/DepotGame.jsx` lines 1220-1230 (townUV — where the id map lands) and 3824-3860 (the terrGuard-cadence refreshes).
4. `scripts/tests/26-the-ground-pays.mjs` (all — Task 1 wrote it; this task appends).

## Steps

### Step 1 — failing asserts first: append to era 26

At the end of `scripts/tests/26-the-ground-pays.mjs`, append:

```js
// ---- Task 2 (mk2.50): THE TOWN FLAGS — render-only holder markers.
{
  const dg = src("src/depot/DepotGame.jsx");
  const rr = src("src/render/renderer.js");
  ok("F1: the renderer takes render-only town flags (setter + draw loop)",
    /function setTownFlags\(list\)/.test(rr) && /for \(const f of townFlags\)/.test(rr) && /setTownFlags,/.test(rr));
  ok("F2: the game layer hands holder rows on the territory clock",
    /R\.setTownFlags\(rows\)/.test(dg) && /if \(h !== 1 && h !== 2\) continue;/.test(dg));
  ok("F2: ruined buildings, depots and field walls fly nothing",
    /m\.depot \|\| m\.fwall \|\| b\.ruined\) continue;/.test(dg));
}
```

Run `node scripts/gate.mjs depot-test` — the three FAIL. Record the PASS count.

### Step 2 — `src/render/renderer.js`: the pool grows, the setter and the draw join (additive)

**(a)** Lines 1007 and 1009 — the two flag pools' cap, 24 → 96:

```js
  const flagPoleMesh = pool(new THREE.BoxGeometry(0.1, 2.6, 0.1), toon(0x4a4038), 96, true);
```

```js
  const flagClothMesh = pool(flagClothGeo, toon(0xffc95c), 96, false);
```

**(b)** Line 2487 — the body loop's guard, `fi >= 24` → `fi >= 96`.

**(c)** Directly after the `setMines` function (below line ~1470), add:

```js
  // mk2.50: TOWN FLAGS — render-only holder markers on standing buildings.
  // The game layer hands {x, y, z, team} rows at the territory cadence
  // (DepotGame). Rows only: nothing here is a body, an eye, or a territory
  // emitter — a kind:"flag" BODY is both, which is exactly why none is made.
  let townFlags = [];
  function setTownFlags(list) { townFlags = list || []; }
```

**(d)** In the flag draw block, directly after the `for (const b of world.bodies)` loop's closing brace (line 2504) and before the `instanceColor.needsUpdate` line, add:

```js
        // mk2.50: the town's holder flags — same pole, same cloth, same
        // wind; f.y is the building's roof height (game-layer supplied).
        for (const f of townFlags) {
          if (fi >= 96) break;
          dummy.position.set(f.x, f.y + 1.3, f.z);
          dummy.quaternion.identity();
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          flagPoleMesh.setMatrixAt(fi, dummy.matrix);
          const phase = f.x * 2.3 + f.z * 1.9;
          const flutter = Math.sin(world.t * stiff + phase) * amp;
          _flagQ1.setFromAxisAngle(_flagUp, heading);
          _flagQ2.setFromAxisAngle(_flagUp, flutter);
          dummy.quaternion.copy(_flagQ1).multiply(_flagQ2);
          dummy.position.set(f.x, f.y + 2.2, f.z);
          dummy.scale.set(1, 1, 1 + Math.abs(flutter) * 0.3);
          dummy.updateMatrix();
          flagClothMesh.setMatrixAt(fi, dummy.matrix);
          flagClothMesh.setColorAt(fi, f.team === 2 ? _flagEnemyMult : _flagWhite);
          fi++;
        }
```

(The block sits inside `if (wind)` — no-wind modes stay byte-identical, which is what keeps golden green.)

**(e)** Add `setTownFlags,` to the return object (line 2632), beside `setMines`.

### Step 3 — `src/depot/DepotGame.jsx`: the holder rows, on the territory clock

**(a)** Directly after the `townUV` line (1224), add:

```js
      // mk2.50: TOWN FLAGS — per-building lookup for the holder-flag rows:
      // roof height and the two exclusions (depots fly their real flag
      // bodies; field walls are screens, not buildings).
      const townFlagMeta = new Map(TOWN.map((t) => [t.id, { ny: t.ny, depot: !!t.depot, fwall: t.id.startsWith("fwall") }]));
```

**(b)** In the terrGuard-cadence refreshes, directly after the mines refresh line `if (terrGuard > 0) { stepMines(world, S.mines); R.setMines(S.mines); }` (line 3832), add:

```js
          // mk2.50: TOWN FLAGS — holder-colored, render-only; neutral and
          // contested ground fly nothing, ruined buildings fly nothing
          // (they already pay nothing — economy.js payTown). Territory
          // cadence; derived, never saved.
          if (terrGuard > 0 && R.setTownFlags) {
            const rows = [];
            for (const b of town) {
              const m = townFlagMeta.get(b.id);
              if (!m || m.depot || m.fwall || b.ruined) continue;
              const c = invW(b.x, b.z);
              const h = holderAt(T, c.u, c.v);
              if (h !== 1 && h !== 2) continue;
              rows.push({ x: b.x, y: field.heightAt(b.x, b.z) + m.ny * MASON.pitch, z: b.z, team: h });
            }
            R.setTownFlags(rows);
          }
```

### Step 4 — gates

- `node scripts/gate.mjs depot-test` — green; 3 new checks over Step 1's count.
- `node scripts/gate.mjs golden` — green (the renderer additions draw only under `world.wind`; golden's modes carry none).
- `node scripts/gate.mjs smoke` — green (no DOM, no tap flow, no sim change).

### Step 5 — the deploy

Bump `src/version.js` to `mk2.50`. Build AFTER the bump; commit ("the town flags — standing buildings show their holder, mk2.50"); push. The owner's live check — flags rising gold over his held village, scarlet over the enemy's, none on contested or ruined stone, phone and desktop — is the acceptance.

## Report

Read-confirmation, one line of outcome, PASS counts before/after, gates and verdicts (golden named explicitly — the renderer guard), commit hash, the shipped mark, seeds (none used; smoke's pinned 11). Every nonconformity its own labeled bullet.
