# Graphics Engine — Phase Document

Opened 2026-08-27, on the owner's direction. This file holds the rulings,
the task index, and the status. Task plans are written one at a time,
served alone for review, and dispatched only on approval.

## What this phase is

The war game gets its own graphics engine: a full copy of today's
renderer, owned separately from the old one. `src/depot/api.js` — the war
engine's one surface — gains the graphics surface, and the war game draws
only through it. The old renderer file never changes; the old screens
keep it.

## Rulings (owner, 2026-08-27)

- The new engine is a FULL COPY of `src/render/renderer.js`,
  `src/render/troopkit.js`, and `src/render/portrait.js` as they stand at
  mk2.75 — not a front over the old file. The copies are owned separately
  from here on; a shared fix lands twice by hand, knowingly.
- The war game (`src/depot/DepotGame.jsx`), the menu's opening view
  (`src/ui/startview.js`), and the info-card portraits draw through the
  new engine. Tower defense, campaign, sandbox, and mech range keep
  `src/render/renderer.js` untouched.
- The graphics surface is declared and exported in `src/depot/api.js`.
  Every reach into renderer insides gets a named entry: the camera
  position read (`_cam`) and the smear ledger (`_splat`) become named
  methods; `_ice` is exposed today, read by nothing, and is dropped from
  the new engine.
- The frozen-law guard on `renderer.js` is NOT lifted — the fork makes
  lifting it unnecessary. The old file is byte-untouched this phase.
- Saves are never migrated: the smear ledger rows keep their exact shape
  (`{u, v, style, wx, wz}` in the ledger; `{u, v, s, x, z}` in the save)
  through the named entries.

## The new engine's home

`src/graphics/` — three files: `renderer.js`, `troopkit.js`,
`portrait.js`. Copies of the `src/render` files, per the ruling above.

## Task index

| Task | Mark | What lands | Gates | Status |
|---|---|---|---|---|
| T1 | mk2.8 | THE COPY — `src/graphics/` created; three verbatim copies; old files byte-untouched | depot-test, golden, build | LANDED — commit 9febf1e, cmp 3/3 identical, gates 2,089/0 + 7/0, build green, pushed |
| T2 | mk2.81 | THE DOOR — api.js graphics surface; named entries for camera position and smear ledger in the new engine; `_ice` dropped; DepotGame + startview repointed through api.js; manifest tracks `./api.js` (Amendment 1) | depot-test, golden, smoke, depot-lint, build | LANDED — commit 368c376, gates 2,089/0 + 7/0 + 30/0 + lint ok, build green, pushed. Amendment 1 (gate order + manifest row) approved and executed after a smoke stop on the original step order |
| Closeout | mk2.82 | README claims re-measured (bundle 1.38 MB / 441 KB wire; renderer line names both engines); phase closed | build | LANDED |

## Acceptance arithmetic (phase level)

- `git diff` over `src/render/` is empty at every commit of this phase.
- After T2: `node src/depot/api.js manifest` over `src/depot/DepotGame.jsx`
  and `src/ui/startview.js` reports zero names imported from
  `render/renderer.js`; every renderer name routes through `depot/api.js`
  or `graphics/`.
- depot-test pass count 2,089 / 0 and golden 7 / 0 at every commit.

## Watch items

- Fourteen test files under `scripts/tests/` read or import
  `src/render/renderer.js` by path to pin the WAR's look (36 references —
  largest: 04-vision 10, 01-engine-era 4, 05-the-front 4). They keep
  passing unchanged while the copies are identical. The first time the new
  engine diverges, the war-look pins must re-point to
  `src/graphics/renderer.js`; until then they silently pin the old file.
  Recorded here so the first divergence task carries the re-pin.
- Shared-machinery drift between the two renderers is accepted by ruling;
  no mechanism watches it.

## Status

Phase open. T1 landed and pushed 2026-08-27 (commit 9febf1e, mk2.8).
T2 landed and pushed 2026-08-27 (commit 368c376, mk2.81) under Amendment 1
(`2026-08-27-ge-t2-amendment-1.md`): the original plan ordered smoke
before the build and the manifest tool was blind to the relative
`./api.js` import — both repaired in the amendment, owner-approved.
The war game, menu view, and portraits now draw through api.js off
`src/graphics/`; `src/render/` byte-untouched. Closeout (mk2.82) not
yet planned; the owner's live check on phone and desktop is the look
acceptance for T2.

Phase CLOSED 2026-08-27 at mk2.82. Closeout re-measured the README's
claims against the shipped build: bundle 1,451,519 bytes (1.38 MB),
441 KB gzip over the wire — the bundle now carries BOTH renderers, and
the floppy claim holds with 22 KB of headroom (1,474,560-byte limit).
The README's renderer line now names both engines. The two watch items
above stand open: the fourteen war-look test pins re-point at first
divergence, and shared-machinery fixes land twice by ruling.
