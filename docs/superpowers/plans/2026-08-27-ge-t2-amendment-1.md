# Graphics Engine T2 — Amendment 1 (the gate order and the manifest row)

Amends `2026-08-27-ge-t2-the-door.md` after its dispatch stopped at the
smoke gate, 2026-08-27. Two defects in the original plan, both mine, and
their repairs. Steps 1–12 of the original plan are LANDED in the working
tree, uncommitted, and are not re-run. This amendment replaces the
original's steps 13–15.

## The two defects

1. **Gate order.** Smoke drives a live preview server on port 4173 and
   compares the served page's deployment mark to `src/version.js`
   (`scripts/smoke.mjs` lines 9, 87, 160, 232). The original plan ran
   smoke before the build, so the fresh mk2.81 constant was checked
   against a stale mk2.8 bundle — 27/30 passed, the three mark checks
   failed. The build-after-bump law is satisfied either way (the bump is
   step 12); smoke must simply come after the build and a preview
   restart.
2. **The manifest's blind spot.** `MANIFEST_TRACKED` in `api.js` matches
   the specifier `depot/api.js` but not the relative form `./api.js`
   that DepotGame uses, so the manifest showed no api.js entry for
   DepotGame. One tracked row is added so the war game's own door is
   visible to the phase's acceptance instrument.

## Steps (replacing original steps 13–15)

Step A1 — failing asserts first:

```
git status --porcelain src/ | sort
```

Expected exactly five modified rows: `src/depot/DepotGame.jsx`,
`src/depot/api.js`, `src/graphics/renderer.js`, `src/ui/startview.js`,
`src/version.js` — and nothing under `src/render/`. Also:

```
grep -n 'MK = "mk2.81"' src/version.js    # expect one hit
```

Anything else: stop and report.

Step A2 — `src/depot/api.js`, the manifest learns the relative door.
`MANIFEST_TRACKED` after the original plan's step 5 reads:

```
const MANIFEST_TRACKED = [
  /engine\/[A-Za-z0-9_-]+\.js$/,
  /render\/renderer\.js$/,
  /graphics\/[A-Za-z0-9_-]+\.js$/,
  /depot\/api\.js$/,
];
```

After the `depot\/api\.js` row, insert:

```
  /^\.\/api\.js$/,
];
```

(that is: the new row goes last, before the closing bracket).

Step A3 — the manifest acceptance, re-run:

```
node src/depot/api.js manifest src/depot/DepotGame.jsx src/ui/startview.js
```

Expected: DepotGame carries an `api.js` key listing `makeRenderer`,
`renderPortrait`, and `serializeRun`; startview carries a
`depot/api.js` key listing `makeRenderer`; neither file carries a
`render/renderer.js` or `render/portrait.js` key.

Step A4 — the build (the bump already stands at mk2.81):

```
npm run build
```

Step A5 — the preview restarted on the fresh build. Kill whatever serves
port 4173, then start the preview and wait until it answers:

```
fuser -k 4173/tcp 2>/dev/null; sleep 2
nohup npm run preview >/tmp/coldsnap-preview.log 2>&1 &
sleep 3; curl -sf http://localhost:4173/coldsnap/ >/dev/null && echo PREVIEW-UP || echo STOP-preview-down
```

`STOP-preview-down`: stop and report with the log tail.

Step A6 — the remaining gates, through the wrapper:

```
node scripts/gate.mjs smoke
node scripts/gate.mjs depot-lint
```

Expected: smoke 30 PASS / 0 FAIL; depot-lint exit 0. Any other number:
stop, do not commit, report.

Step A7 — commit and push (the same five files, the original message):

```
git add src/graphics/renderer.js src/depot/api.js src/depot/DepotGame.jsx src/ui/startview.js src/version.js
git commit -m "the door — the war draws through api.js, named entries replace the reaches, mk2.81"
git push
```

## ARITHMETIC acceptance (amended tail)

- Manifest per step A3's expected shape.
- smoke 30/0; depot-lint exit 0; build exit 0.
- `git diff --stat src/render/` empty at commit time.
- The original plan's step-11 grep zeros still hold (they were measured
  at the stop and nothing here touches those lines).

## Report

One line of outcome, then bullets: the A1 file list, the manifest
output's keys per file, the smoke and depot-lint counts, the build
result, the commit hash. Every deviation its own labeled bullet.
