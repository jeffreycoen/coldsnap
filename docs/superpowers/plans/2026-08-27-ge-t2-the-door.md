# Graphics Engine T2 — THE DOOR (mk2.81)

One task, one landing: `api.js` gains the graphics surface off the new
engine; the new engine's renderer gets named entries replacing its
underscore reaches; the war game and the menu's opening view import
drawing only through `api.js`. `src/render/` stays byte-untouched.

Phase document: `2026-08-27-graphics-engine-phase.md`. Interface note
(the standing law, named explicitly): no visual or interface change on
phone or desktop — the same engine draws through a new door; the owner's
live check on both is the look acceptance.

**Suggested model: Sonnet 5** — exact-anchor edits with the code given
verbatim below; no design.

## Required reading (verify each exists before starting; read in full)

1. This plan.
2. `docs/superpowers/plans/2026-08-27-graphics-engine-phase.md`
3. `src/graphics/renderer.js` — at least lines 1–10 and 2700–2716
4. `src/depot/api.js` (440 lines)
5. `src/depot/DepotGame.jsx` — lines 1–50, 655–670, 1435–1470, 1765–1785, 3680–3695
6. `src/ui/startview.js` (71 lines)

The report opens with a read-confirmation line naming all six.

## What is NOT touched

- Anything under `src/render/` — byte-untouched, `git diff` empty.
- `src/graphics/troopkit.js` and `src/graphics/portrait.js` — unchanged
  this task (portrait's `./renderer.js` import keeps working; the entries
  it uses are untouched).
- No test files. The suite reads only the OLD renderer by path; nothing
  in it pins the lines this task changes. Any test failure stops the
  task — there is no sweep license.

## Steps, in order

Step 1 — failing asserts first:

```
git status --porcelain src/render/ src/graphics/ | grep -q . && echo STOP-dirty || echo OK-clean
grep -c "R\._splat" src/depot/DepotGame.jsx        # expect 2 (the replay line and the save line)
grep -c "R\._cam" src/depot/DepotGame.jsx           # expect 1
grep -c "_ice: iceMesh" src/graphics/renderer.js    # expect 1 (the return line; bare _ice also matches the unrelated _iceC/_iceR locals)
```

Counts other than shown: stop and report.

Step 2 — `src/graphics/renderer.js`, the header re-signed. Line 1 today:

```
// render/renderer.js — the COLDSNAP renderer, extracted VERBATIM from
```

becomes:

```
// graphics/renderer.js — the WAR GAME's own renderer, forked byte-identical
// from src/render/renderer.js at mk2.75 (graphics-engine T1). Owned
// separately from the old file from mk2.8 on. Originally extracted VERBATIM from
```

(the old line 2, `// src/demo/coldsnap-proving-grounds.jsx ...`, now reads
on from "VERBATIM from" — keep it and line 3 exactly as they are).

Step 3 — `src/graphics/renderer.js`, the named entries. On the return
line (line 2715 of the unedited copy), this exact fragment:

```
dispose() { renderer.dispose(); }, _cam: cam, project, _splat: splat, _ice: iceMesh, camBasis:
```

becomes:

```
dispose() { renderer.dispose(); }, project, cameraPos: () => ({ x: cam.position.x, y: cam.position.y, z: cam.position.z }), smearLog: () => splat.log, smear: (u, v, style, wx, wz) => splat.smear(u, v, style, wx, wz), camBasis:
```

`_cam`, `_splat`, `_ice` are gone from the new engine's surface; the
smear ledger keeps its exact row shape (`{u, v, style, wx, wz}`) — saves
are never migrated.

Step 4 — `src/depot/api.js`, the graphics door. After line 13
(`export { bootWar, tickWar };`), insert:

```
// The graphics surface (graphics-engine T2, mk2.81): the war game's one
// drawing door. A game imports makeRenderer and renderPortrait from THIS
// file; src/graphics is the war's own engine (forked from src/render at
// mk2.75), and src/render belongs to the old screens alone.
import { makeRenderer } from "../graphics/renderer.js";
import { renderPortrait } from "../graphics/portrait.js";
export { makeRenderer, renderPortrait };
```

Step 5 — `src/depot/api.js`, the manifest tracks the new directory. In
`MANIFEST_TRACKED` (lines 352–356), after the `render\/renderer\.js` row,
insert:

```
  /graphics\/[A-Za-z0-9_-]+\.js$/,
```

Step 6 — `src/depot/DepotGame.jsx`, imports. Lines 15–16 today:

```
import { makeRenderer } from "../render/renderer.js";
import { renderPortrait } from "../render/portrait.js";
```

Delete both. Line 35 today:

```
import { serializeRun } from "./api.js";
```

becomes:

```
import { serializeRun, makeRenderer, renderPortrait } from "./api.js";
```

Step 7 — `src/depot/DepotGame.jsx`, the smear replay (line 662). Today:

```
      if (RES && R._splat && R._splat.smear) for (const m of RES.smears || []) R._splat.smear(m.u, m.v, m.s, m.x, m.z);
```

becomes:

```
      if (RES && R.smear) for (const m of RES.smears || []) R.smear(m.u, m.v, m.s, m.x, m.z);
```

Step 8 — `src/depot/DepotGame.jsx`, the picking ray (lines 1442–1446).
Today:

```
        const cb = R.camBasis, cam = R._cam;
        const hw = cb.halfW(), hh = cb.halfH();
        const ox = cam.position.x + cb.right.x * nd.x * hw + cb.up.x * nd.y * hh;
        const oy = cam.position.y + cb.right.y * nd.x * hw + cb.up.y * nd.y * hh;
        const oz = cam.position.z + cb.right.z * nd.x * hw + cb.up.z * nd.y * hh;
```

becomes:

```
        const cb = R.camBasis, cp = R.cameraPos();
        const hw = cb.halfW(), hh = cb.halfH();
        const ox = cp.x + cb.right.x * nd.x * hw + cb.up.x * nd.y * hh;
        const oy = cp.y + cb.right.y * nd.x * hw + cb.up.y * nd.y * hh;
        const oz = cp.z + cb.right.z * nd.x * hw + cb.up.z * nd.y * hh;
```

Step 9 — `src/depot/DepotGame.jsx`, the save's ledger read (line 1774).
Today:

```
          const json = serializeRun(war, { smears: R._splat ? R._splat.log : [] });
```

becomes:

```
          const json = serializeRun(war, { smears: R.smearLog ? R.smearLog() : [] });
```

Step 10 — `src/ui/startview.js`, the import (line 9). Today:

```
import { makeRenderer } from "../render/renderer.js";
```

becomes:

```
import { makeRenderer } from "../depot/api.js";
```

Step 11 — the arithmetic before gates:

```
grep -c "R\._splat\|R\._cam" src/depot/DepotGame.jsx     # expect 0
grep -rc "render/renderer\|render/portrait" src/depot/DepotGame.jsx src/ui/startview.js  # expect 0 in each
node src/depot/api.js manifest src/depot/DepotGame.jsx src/ui/startview.js
```

The manifest output: no `render/renderer.js` key for either file;
`depot/api.js` lists `makeRenderer` (both files) and `renderPortrait`
(DepotGame). `git diff --stat src/render/` prints nothing.

Step 12 — the version bump. `src/version.js`:

```
export const MK = "mk2.81";
```

Step 13 — gates, through the wrapper, this list and no other:

```
node scripts/gate.mjs depot-test
node scripts/gate.mjs golden
node scripts/gate.mjs smoke
node scripts/gate.mjs depot-lint
```

Expected: 2,089/0, 7/0, 30/0, and depot-lint PASS (exit 0). Any other
number: stop, do not commit, report.

Step 14 — the build, AFTER the bump:

```
npm run build
```

Step 15 — commit and push (the landing includes the deploy):

```
git add src/graphics/renderer.js src/depot/api.js src/depot/DepotGame.jsx src/ui/startview.js src/version.js
git commit -m "the door — the war draws through api.js, named entries replace the reaches, mk2.81"
git push
```

## ARITHMETIC acceptance

- `grep -c "R\._splat\|R\._cam" src/depot/DepotGame.jsx` = 0; the same
  grep over `src/ui/startview.js` = 0.
- `grep -c "_ice: iceMesh" src/graphics/renderer.js` = 0 (the `_iceC`/`_iceR` locals inside the file remain — they are internal, not surface).
- Manifest over the two war files: zero `render/renderer.js` /
  `render/portrait.js` entries; drawing names route through
  `depot/api.js`.
- `git diff --stat src/render/` empty.
- depot-test 2,089/0; golden 7/0; smoke 30/0; depot-lint exit 0;
  build exit 0.

## Report

One line of outcome, then bullets: each grep count, the manifest result,
the four gate counts (the suite's fixture seeds ride inside its own
checks; the gate summary prints counts only), the build result, the
commit hash. Every deviation its own labeled bullet.
