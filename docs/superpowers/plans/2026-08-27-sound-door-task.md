# The Sound Door (mk2.83) — one task, standalone

The owner's ruling (2026-08-27): door only, no fork. `api.js` gains the
sound surface as a re-export of the shared engine; the war game imports
its sound through `api.js`. `src/platform/audio.js` itself does not
change by a byte — it stays the one shared engine for every screen. No
behavior change, no new bundle weight, no sound change to audition.

Interface note (the standing law, named explicitly): no change on phone
or desktop; the same sound engine reaches the war through a new door.

**Suggested model: Sonnet 5** — two exact-anchor edits with the code
given verbatim; no design.

## Required reading (verify each exists before starting)

1. This plan.
2. `src/depot/api.js` — lines 1–30 (the graphics door block it extends)
3. `src/depot/DepotGame.jsx` — lines 1–40 (the import block)
4. `src/platform/audio.js` — lines 1–40 (the header and the one export)

The report opens with a read-confirmation line naming all four.

## What is NOT touched

- `src/platform/audio.js` — byte-untouched (`git diff` over it empty).
- Tower defense, campaign, and mech range keep their direct
  `platform/audio.js` imports — the shared engine is theirs too, by the
  door-only ruling.
- `src/ui/soundboard-legacy-audio.js` — the frozen OLD snapshot, never
  touched.
- No test edits; there is no sweep license. Any test failure stops the
  task.

## Steps, in order

Step 1 — failing asserts first:

```
git status --porcelain src/ | grep -q . && echo STOP-dirty || echo OK-clean
grep -c "platform/audio" src/depot/DepotGame.jsx    # expect 1 (the line 15 import)
```

Counts other than shown: stop and report.

Step 2 — `src/depot/api.js`, the sound door. The graphics-door block
(lines 14–20) ends today with:

```
import { makeRenderer } from "../graphics/renderer.js";
import { renderPortrait } from "../graphics/portrait.js";
export { makeRenderer, renderPortrait };
```

Directly after that `export` line, insert:

```
// The sound surface (the sound door, mk2.83, owner's ruling: door only,
// no fork): the war game's audio comes through THIS file. The engine
// itself stays src/platform/audio.js, shared with every other screen.
import { makeGameAudio } from "../platform/audio.js";
export { makeGameAudio };
```

Step 3 — `src/depot/DepotGame.jsx`, the repoint. Line 15 today:

```
import { makeGameAudio } from "../platform/audio.js";
```

Delete it. Line 33 today:

```
import { serializeRun, makeRenderer, renderPortrait } from "./api.js";
```

becomes:

```
import { serializeRun, makeRenderer, renderPortrait, makeGameAudio } from "./api.js";
```

Step 4 — the arithmetic before gates:

```
grep -c "platform/audio" src/depot/DepotGame.jsx     # expect 0
node src/depot/api.js manifest src/depot/DepotGame.jsx
git diff --stat src/platform/
```

Expected: zero; the manifest's `api.js` key for DepotGame lists
`makeGameAudio` beside `makeRenderer`, `renderPortrait`, `serializeRun`;
the platform diff prints nothing.

Step 5 — the version bump. `src/version.js`:

```
export const MK = "mk2.83";
```

Step 6 — the headless gates, through the wrapper:

```
node scripts/gate.mjs depot-test
node scripts/gate.mjs golden
node scripts/gate.mjs depot-lint
```

Expected: 2,089/0, 7/0, depot-lint exit 0.

Step 7 — the build, AFTER the bump, then the preview restarted on the
fresh bundle, then smoke (the T2 Amendment 1 order — smoke reads the
served mark):

```
npm run build
fuser -k 4173/tcp 2>/dev/null; sleep 2
nohup npm run preview >/tmp/coldsnap-preview.log 2>&1 &
sleep 3; curl -sf http://localhost:4173/coldsnap/ >/dev/null && echo PREVIEW-UP || echo STOP-preview-down
node scripts/gate.mjs smoke
```

Expected: PREVIEW-UP, then smoke 30 PASS / 0 FAIL. Any other number:
stop, do not commit, report.

Step 8 — commit and push (the landing includes the deploy):

```
git add src/depot/api.js src/depot/DepotGame.jsx src/version.js
git commit -m "the sound door — the war's audio comes through api.js, mk2.83"
git push
```

## ARITHMETIC acceptance

- `grep -c "platform/audio" src/depot/DepotGame.jsx` = 0.
- Manifest: DepotGame's `api.js` key lists `makeGameAudio`.
- `git diff --stat src/platform/` empty.
- depot-test 2,089/0; golden 7/0; depot-lint exit 0; smoke 30/0;
  build exit 0.

## Report

One line of outcome, then bullets: the grep counts, the manifest key
list, the four gate counts, the build result, the commit hash. Every
deviation its own labeled bullet.

## Closeout record (mk2.84, 2026-08-27)

Landed at commit dddad2c, mk2.83. Gates at landing: depot-test 2,089/0,
golden 7/0, depot-lint clean, smoke 30/0 on the fresh bundle. README
claims re-measured at closeout: bundle 1,451,519 bytes (1.38 MB), 441 KB
gzip over the wire — unchanged by the door (a re-export adds no weight),
so the floppy line and its 22 KB headroom stand as written; the README's
sound line names no file path, so nothing there to amend. The war game
now reaches boot, tick, save, drawing, and sound through
src/depot/api.js alone; src/platform/audio.js stays the one shared
engine, byte-untouched. Closed.
