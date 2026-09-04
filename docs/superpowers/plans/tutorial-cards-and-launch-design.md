# DESIGN — The teaching cards and the new front door

Ruled by the owner, 2026-08-24. Companion document: `button-map-tutorial-cards.md` (the ruled control inventory — which controls get cards). This document is the design; task plans follow separately, one file each, after approval.

## What ships

1. A **card registry**: one store of teaching cards — the 19 existing market info cards plus 25 new ones from the ruled button map. Live numbers, one copy of every fact.
2. **Three doors** into the same cards: first-encounter popup, on-demand lookup, and an optional guided tutorial.
3. A **new landing page**: a dimmed 2D map of the seed about to be played behind the menu, and most of the text gone.
4. The **field manual retired**: its 10-card slideshow and its copy fold into the registry.

## Rulings recorded (owner, 2026-08-24)

- Zero starting cards. Nothing shows before the draft; every card arrives at first encounter or in the walk.
- First-encounter cards **pause the war** while up (the convoy idiom), once per card ever.
- The tutorial walk is **in this phase**.
- The menu map is a **dimmed terrain map** in the game's own colors.
- The landing page keeps title, mark, buttons with subtitles, and the seed line; the three-law blurb and tagline go.
- Desktop keys get their own card (CARD 28).
- Proving range, campaign, and sandbox controls get no cards.

## Part 1 — the card registry

**File: `src/depot/cards.js`** (new). It absorbs `infocards.js` — the 19 market entries move in unchanged (same live reads from `specs.js`/`squads.js`, same owner-approved prose) and the 25 new entries join them. One entry per card:

- `key` — the card's name (`bell`, `possess_squad`, `sq_rifles`, ...).
- `title`, `body` — the copy. New copy is written in the task plans and served for ruling there, per card.
- live-number fields as today (`hp`, `dmg`, `range`, `price`, `skills`) where the card describes a buyable; teaching cards carry prose only.
- `desktop` / `touch` — optional body variants where the controls differ (the possession cards, the desktop-keys card). One card, two voices; never two cards.

Presentation stays `InfoCard.jsx`, which gains one door: `door: "teach"` — a CLOSE button and nothing else. The four existing doors (manifest, hire, deal, bar) are untouched.

Every control that owns a card names it where the control is declared: the radial slot arrays, the lattice tags, the top-bar buttons each carry a `card` key. Adding a button later means one key and one registry entry.

## Part 2 — the three doors

### Door 1 — first encounter

A card fires the first time its control **becomes usable**, not when it is tapped: the bell card at the first bell toll, the squad-order cards when the first squad radial opens (one card per wedge would be a barrage — the radial fires its wedges' cards one at a time, next one on next open), the possession card on first TAKE CONTROL, the market card on first BUILD open.

- While a first-encounter card is up, **the sim pauses** — the convoy's exact idiom (`sdt = 0` while up). CLOSE resumes.
- Seen-state: one storage key, `coldsnap-wf-cards`, holding `{ rev, seen: [keys] }` through the `window.storage` shim. A registry revision constant (the `MANUAL_REV` pattern) re-greets everyone when the cards change materially.
- Never in the sandbox; never on a resumed war for cards whose moment has passed (the seen set rides storage, not the save — saves are untouched, per the standing law).

### Door 2 — on demand

- **Desktop**: hover shows a ⓘ affordance on carded controls; click opens the card. The lattice tags' existing ⓘ is the pattern, extended.
- **Phone**: long-press (450 ms, no movement) on a carded control opens its card instead of activating it; release-before-threshold acts normally. Radial wedges included.
- On-demand cards do **not** pause and do not mark seen — the same card box, floating, CLOSE only.

### Door 3 — the tutorial walk

- A third button on the pre-start overlay: **SHOW ME THE FRONT**.
- It plays a taught order over the same registry, each stop opening the real surface and its card: the ground (pan/zoom/rotate) → the depot → BUILD and the crates → a squad's radial → the bell clock → the score → the fall.
- Every stop is one card plus a highlight on the real control (the pie, the crate, the chip). NEXT / SKIP on every stop; skipping ends the walk, nothing nags.
- The walk runs before the first bell, sim paused throughout (pre-start it is anyway). It marks its cards seen, so the first war is not re-interrupted by cards the walk already showed.
- Declining the walk costs nothing — every card still arrives by door 1.

## Part 3 — the landing page

### The map background

- A flat 2D canvas behind the menu column, drawn from `makeMap`'s installed module state — ground wash, rock bands and rocks, ponds, roads, the stream, town buildings, both depots marked. Game palette (`theme.js` colors plus the renderer's terrain tones), dimmed to ~35% so the buttons carry.
- **The seed law**: the menu calls `makeMap(rolled seed)` and shows the seed that actually **installed** — `makeMap` retries fouled maps by bumping the seed (`mapgen.js:278–309`), so the displayed FIELD ORDER # is `MAP_SEED` after the call, never the requested number. That exact number is handed to the game screen as a prop; `DepotGame` keeps its own unconditional `makeMap(seed)` at mount (today `DepotGame.jsx:1054`), so the game regrows the identical map. `?seed=` keeps working and wins over the roll (the smoke test's `?seed=11` path survives).
- **Resume**: the saved front's `map.seed` (`save.js:247`) draws the background, so the map shown is the war being resumed. `probeFront` already hands the parsed save to the menu; no new save reads.
- Drawing respects the two frames: rocks/ponds/roads/town/spawns arrive world-transformed, hills/stream/objective canonical — the drawer converts through `fwdU` once, matching the game's own transform.
- Redrawn only when the seed changes (resume found, or a menu-level reroll if one is ever added — none in this phase).

### The text

- StartScreen keeps: COLDSNAP / WINTER FRONT, the mark, RESUME FRONT (with its bell line), NEW FRONT (with its subtitle and the two-tap burn), the three quiet links, the one-line control hint, and FIELD ORDER #seed. Cut: the three-law blurb (lines 63–67), the tagline.
- The pre-start overlay keeps: TAKE COMMAND, SHOW ME THE FRONT, the seed line. Cut: the ~90-word orientation paragraph, the draft teaser, the FIELD MANUAL button.
- `FieldManual.jsx` is deleted; `MANUAL_KEY`/`MANUAL_REV` and their gate in `DepotGame.jsx` go with it. The stale `coldsnap-wf-manual` storage key is simply ignored, never migrated.

## Phone and desktop

Named explicitly, per standing orders:

- Phone: long-press for on-demand; cards sized to the info card's existing `min(300px, 62vw)`; the walk's highlights and NEXT button at 44px touch targets; card position clear of the thumb (top-anchored, the info card's spot).
- Desktop: hover-ⓘ for on-demand; the desktop-keys card (CARD 28) serves on desktop only; possession cards speak mouse on desktop, sticks on phone via the `desktop`/`touch` body variants.

## What this does not touch

- No save shape change. No sim change. No gameplay change — cards are presentation; the pause reuses the convoy's existing freeze.
- No symmetry question: everything here is player-interface only; the enemy plays by sim, not by cards.
- `src/demo/coldsnap-proving-grounds.jsx` untouched (frozen). `core.js`/`renderer.js` untouched — the 2D map is its own canvas, not the renderer.
- No `Math.random` anywhere in `src/depot`; the menu's seed roll lives in the menu (`src/ui`), outside the depot-lint fence, using the same `Date.now() % 1000000` form the mount uses today.

## Known test breakage (the sweep license, per task)

| Test | Pins | Fate |
|---|---|---|
| `scripts/smoke.mjs:82–84, 219–228` | three-law literals; manual skip flow | re-taught to the new menu and the no-manual flow |
| `scripts/smoke.mjs:213–215` | `?seed=11` | survives — the URL override stays |
| `scripts/tests/06-troops-physics.mjs:305–316` | start-screen literals | re-taught |
| `scripts/tests/09-reorg.mjs:643–653` | manual text, 10-card chain, `MANUAL_REV` | retired with the manual; replaced by registry pins |
| `scripts/tests/11-hiring-hall.mjs:142–143, 737–739` | `MANUAL_REV`, manual card text | same |
| `scripts/tests/08-debug-pass.mjs:211` | `makeField(181, 2.0, MAP_SEED)` source pin | re-taught if the mount line moves |
| `scripts/tests/23-the-sandbox.mjs` | mount-seam regexes | re-run; re-taught only if a pinned seam moved |

Every re-teach is reported old→new in its task's landing report.

## Task skeleton (marks assigned sequentially at dispatch, per the versioning law)

1. **The registry** — `cards.js` absorbs `infocards.js`, the `teach` door, card keys on every carded control. No copy yet beyond the moved 19.
2. **The new card copy** — the 25 bodies, served for ruling inside the task plan before dispatch.
3. **First-encounter door** — the seen store, the pause, the firing points.
4. **On-demand door** — long-press and hover-ⓘ, both platforms.
5. **The menu map** — the 2D drawer, seed-at-menu plumbing, resume preview.
6. **The text cuts and the manual's retirement** — StartScreen, pre-start overlay, FieldManual deleted, tests re-taught.
7. **The tutorial walk** — SHOW ME THE FRONT, the taught order, highlights.

Each task: its own plan file, reading list, gates, suggested model, served alone.
