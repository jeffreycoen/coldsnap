# The rocket lag — the lane pool joins arcClears, mk2.60

One task, one function edited. Today every flight sample in `arcClears` scans the whole solid pool — about 1,700 masonry boxes on a seeded town — and the rocket's slow round takes five to ten times more samples than any other, so rocket towers and rocket troops hitch on placement, on menu open, and on squad selection. The fix: `arcClears` filters the pool once per query to the solids near its own firing lane, using `lanePool`, the mk2.55 filter that `elevSolve` and `tightSolve` already use. Every sample then tests a handful of boxes instead of 1,700. Sample positions, sample count, and verdicts are unchanged — `lanePool`'s own proof (accuracy.js:332–338): a sample inside a box is within the box's lane radius, and every sample lies on the muzzle-to-target segment, for the flat arc and the lofted climb-out cone alike. Both sides fire through this one function, so the speedup is symmetric by construction.

**Suggested model:** Sonnet 5 — one function body, code given verbatim.

**Required reading (verified to exist):**
- This plan.
- `src/depot/accuracy.js` in full (the edited function and its neighbors: `solidBlocksPoint` L44, `marchArc` L110, `arcClears` L134, `lanePool` L339).
- `src/version.js` (whole file).

The agent's report opens by confirming these were read.

**Gates for this task, through `node scripts/gate.mjs <name>`:** `depot-test` (carries the SIGHTLINES keystone — the predictor must match real fired impacts on every crest fixture, both directions), `accuracy`, `depot-lint`, `smoke`. No others. The owner's live check — placing a rocket tower, opening its menu, selecting a rocket squad, on phone and desktop — is the felt acceptance.

---

### Step 1 — pin the start state. These asserts must hold before any change; a mismatch stops the task.

```bash
grep -c "lanePool" src/depot/accuracy.js
grep -n "const blocked = marchArc" src/depot/accuracy.js
grep -c 'MK = "mk2.59"' src/version.js
```

Expected: `4` (lanePool appears exactly four times today: two comment mentions, the definition, and its export-adjacent uses in elevSolve/tightSolve — none inside arcClears), the marchArc call sits inside arcClears near line 136, and the version is mk2.59. Then a green baseline so any later failure is attributable:

```bash
node scripts/gate.mjs depot-test
node scripts/gate.mjs accuracy
```

Expected: both PASS, zero FAIL. Record each gate's exact pass count — Step 3 must reproduce those numbers to the digit.

### Step 2 — the edit. In `src/depot/accuracy.js`, replace the whole `arcClears` function (lines 134–146) with this exact text. The only changes: the `lanePool` line and passing `pool` into `solidBlocksPoint`. `lanePool` is declared lower in the file; function declarations hoist, so the call is legal.

Old, verbatim:

```js
export function arcClears(world, muzzle, target, spec, selfId) {
  const tgh = world.field.heightAt(target.x, target.z);
  const blocked = marchArc(world, muzzle, target, spec, (x, y, z) => {
    if (spec.occl !== "lofted") {                      // lofted flight ignores terrain entirely
      const h = world.field.heightAt(x, z);
      if (h + ARC_EPS > y &&                           // terrain pierces the arc…
          !(y > h && y <= tgh + TARGET_BODY_H))        // …unless it's the final descent onto the target's body
        return true;
    }
    return solidBlocksPoint(world, x, y, z, selfId);   // solid at arc height
  });
  return blocked === null ? false : !blocked;          // no solution -> not clear
}
```

New, verbatim:

```js
export function arcClears(world, muzzle, target, spec, selfId) {
  const tgh = world.field.heightAt(target.x, target.z);
  // mk2.60: the lane pool (mk2.55, elevSolve's own filter) joins the base
  // predictor — one pass keeps only the solids a sample on this lane could
  // sit inside, so each flight sample tests a handful of boxes, not the
  // whole town. Verdict identical (lanePool's proof above); this is why a
  // rocket's reach fan no longer hitches the frame.
  const pool = lanePool(world, muzzle, target, selfId);
  const blocked = marchArc(world, muzzle, target, spec, (x, y, z) => {
    if (spec.occl !== "lofted") {                      // lofted flight ignores terrain entirely
      const h = world.field.heightAt(x, z);
      if (h + ARC_EPS > y &&                           // terrain pierces the arc…
          !(y > h && y <= tgh + TARGET_BODY_H))        // …unless it's the final descent onto the target's body
        return true;
    }
    return solidBlocksPoint(world, x, y, z, selfId, pool); // solid at arc height, lane pool only
  });
  return blocked === null ? false : !blocked;          // no solution -> not clear
}
```

### Step 3 — gates. Any failure stops the task and is reported with output; no test file may be edited — the sweep license does not apply, this task moves no asserted text.

```bash
node scripts/gate.mjs depot-test
node scripts/gate.mjs accuracy
node scripts/gate.mjs depot-lint
```

Expected: all PASS, zero FAIL, and depot-test and accuracy pass counts EQUAL to Step 1's recorded counts — the edit changes speed, never a verdict. A changed count is a stop, even if green.

### Step 4 — smoke against the built bundle.

```bash
npm run build
npm run preview &
node scripts/gate.mjs smoke
kill %1
```

Expected: smoke fully PASS (25 checks at mk2.59's landing), zero FAIL.

### Step 5 — bump, build, commit, push. `src/version.js` line 6, one change:

```js
export const MK = "mk2.60";
```

Then, build after the bump, never before:

```bash
npm run build
git add src/depot/accuracy.js src/version.js
git commit -m "the lane pool joins the base predictor — rocket reach no longer scans the town per sample, mk2.60"
git push
```

Expected: clean push to main; Pages deploys. The report names the fixture seeds its gate runs printed, both gates' exact pass counts (Step 1 versus Step 3, equal), and states plainly that no file outside accuracy.js and version.js changed.

---

**Rollback:** revert the commit. No save field, spec value, or test is touched by this task.
