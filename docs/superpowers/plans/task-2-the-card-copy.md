# TASK 2 — THE CARD COPY (mk2.40)

Design: `tutorial-cards-and-launch-design.md`. This task fills the `TEACH` table in `src/depot/cards.js` with the twenty-eight teaching cards. Data only — no card is served anywhere yet (Tasks 3, 4, and 7 open the doors). The player sees nothing change.

**Suggested model: Sonnet** — the copy below is final once you rule; the agent moves it verbatim into the table and re-teaches one pinned check.

## A correction, stated plainly

The button map's tally line said 25 new cards. The numbered rows are 28 distinct cards — the "covered by" rows reuse numbers and were never separate. The tally line in the map is corrected; no ruling changed. This plan carries all 28.

## THE COPY — every card verbatim, for your ruling

Titles and bodies below are exactly what ships. Cards with a phone variant carry both voices; the serving tasks pick by platform. Card 28 serves on desktop only.

| # | key | title | body |
|---|---|---|---|
| 1 | `the_hand` | THE HAND YOU'RE DEALT | Every war opens with seven dealt cards — units and plans together. Pick five, free. Units place by your hand near the depot; plans open your build bar. The enemy drafts five of its own. |
| 2 | `placing` | PLACING YOUR MEN | Tap ground near your depot to set a ghost. ✓ fields it, ✗ puts it back. The green wash is where you may place. Each pick shows its card first. |
| 3 | `scrap` | SCRAP | Scrap is the till. One scrap a second, both sides, always. Kills pay more. Everything the convoy sells is paid in scrap. |
| 4 | `bell` | THE BELL | Every 90 seconds the bell rings and the convoy shows its hand — plans you buy once and build from after, hires that walk on at once. The war is saved at every bell. |
| 5 | `kill_price` | THE SCORE | Every death is priced at its live market value the moment it falls. Yours in green, the enemy's in red — kills, then value destroyed. |
| 6 | `convoy` | THE CONVOY | The war pauses while the window is up. Plans cost half and open your build bar; hires field at once by your tap. LATER parks the offer on the top bar until the next bell rewrites it. |
| 7 | `fog` | SIGHT AND FOG | Men are your eyes — what your side can't see, you can't shoot. This switch only paints the fog; the guns obey sight either way. |
| 8 | `wind` | WIND | One wind over the whole field. Every shot drifts with it, yours and theirs alike. OFF is dead calm for both sides. |
| 9 | `spare_ours` | SPARE OURS | With this on, the tesla coil and the atomic crew hold fire while one of your own stands in the blast. Off, they fire regardless. |
| 10 | `market` | THE MARKET | One market, both armies. What the field is full of costs more. Prices move by the second, and the market paces you — one purchase a second. Buy out what they need before they can. |
| 11 | `sell` | SELLING | Sell returns 60 percent. Tap SELL, then the tower or wall. A tower's own ring offers SELL too. |
| 12 | `defend` | DEFEND | Dig in where they stand. They hold the ground, fight what comes, and shuffle to the best nearby stand. |
| 13 | `move` | MOVE | Tap the ground; they walk there without picking fights on the way. Open water takes no orders — find the crossing. |
| 14 | `attack` | ATTACK | Tap the ground; they fight their way there, halting to engage whatever they see in reach. |
| 15 | `possess_squad` | TAKE CONTROL — SQUADS | *(desktop)* WASD walks the squad; the mouse carries the aim; hold the left button to fire. The reticle lives inside their own sight. RELEASE hands them back — they dig in where you leave them. *(phone)* The left stick walks; the right stick steers the aim; hold FIRE to volley. Tap ground to jump the reticle. RELEASE hands them back — they dig in where you leave them. |
| 16 | `select_all` | SELECT ALL | Every squad of this type joins the order. One-squad results collapse back to the one. |
| 17 | `patrol` | PATROL | Two taps set the route — start, then far end. ✓ and they walk it forever, fighting what they see. |
| 18 | `structures` | ATTACK STRUCTURES | A toggle. On, this squad prefers walls and towers over men. |
| 19 | `engineer_lines` | THE ENGINEER LINES | BAGS or WALLS, then two taps — start and far end. The ghost line shows every piece and the price. ✓ and they walk the line, laying as scrap allows. |
| 20 | `sapper_lines` | MINES AND WIRES | The engineer's two taps, buried. Yours are invisible to them; theirs to you — always. A tripwire's flare lights the fog. A mine just waits. |
| 21 | `discipline` | CAREFUL AND FREE | CAREFUL holds a tower's trigger when the shot would foul your own wall, tower, or depot stone. FREE fires regardless. |
| 22 | `possess_tower` | TAKE CONTROL — TOWERS | *(desktop)* The mouse carries the aim; hold the left button to fire. No walking — a tower stands. Your trigger, your responsibility: CAREFUL does not hold it for you. *(phone)* The right stick steers the aim; hold FIRE. No walking — a tower stands. Your trigger, your responsibility. |
| 23 | `escort` | ESCORT | Tap a squad; the hull shadows it wherever it goes. |
| 24 | `tracks` | TRACKS | CAREFUL brakes for your own men. FREE takes the safety off — the tracks are a weapon then, both ways. |
| 25 | `possess_vehicle` | TAKE CONTROL — ARMOR | *(desktop)* WASD drives; the mouse aims the turret; the left button fires the main gun, the right button streams the coax. The APC carries one gun — FIRE alone. *(phone)* The left stick drives; the right stick aims; FIRE for the main gun, MG for the coax. The APC carries one gun — FIRE alone. |
| 26 | `possess_mech` | TAKE CONTROL — THE MECH | *(desktop)* WASD walks it; A and D turn — hold for the hard pivot. The mouse sets aim and range. Hold the left button to fire; V missiles, B barrage, C punt, T about-face. *(phone)* The left stick walks; the right stick turns — hard over pivots. The slider sets range, ◀ ▶ trim the aim. FIRE, MSL, BRG, PUNT. |
| 27 | `load` | LOAD AND UNLOAD | LOAD: tap a squad; they walk to the ramp and board. Four sealed seats — riders see nothing, fire nothing, and die with the hull. UNLOAD drops the ramp. |
| 28 | `desktop_keys` | THE KEYS | WASD pans. Q and E rotate — tap snaps a quarter turn, hold swings. The wheel zooms. M mutes. ESC leaves for the menu. Possessed, WASD drives and the mouse aims and fires. *(desktop only)* |

## The entry shape

`InfoCard.jsx` renders `card.label`, `card.role`, and maps `card.skills` — a missing `skills` array crashes it. So every TEACH entry is `{ label, role, skills: [] }`; cards with a phone voice add `roleTouch`. The serving tasks substitute `roleTouch` for `role` on touch. No entry carries hp/dmg/range/price — those rows null-skip in the card already.

## Sweep license (pre-licensed re-teach, one check)

Era 25's Task-1 check `"T1: the teaching table stands, empty until Task 2"` pins `Object.keys(TEACH).length === 0` — this task's whole point breaks it. Re-taught to pin 28. Old→new reported. No other check moves.

## Required reading (read-confirmation opens the report)

1. This plan.
2. `src/depot/cards.js` (all of it, post-Task-1).
3. `src/depot/InfoCard.jsx` (all 53 lines — the entry-shape contract).
4. `scripts/tests/25-the-teaching-cards.mjs` (all of it).

## Steps

### Step 1 — the failing asserts first: extend `scripts/tests/25-the-teaching-cards.mjs`

Replace the line

```js
ok("T1: the teaching table stands, empty until Task 2", TEACH && typeof TEACH === "object" && Object.keys(TEACH).length === 0);
```

with

```js
ok("T2: the teaching table holds the twenty-eight", Object.keys(TEACH).length === 28);
ok("T2: every teaching card carries the card contract",
  Object.values(TEACH).every((c) => typeof c.label === "string" && c.label.length > 0 && typeof c.role === "string" && c.role.length > 0 && Array.isArray(c.skills)));
ok("T2: the phone-voiced cards carry both voices",
  ["possess_squad", "possess_tower", "possess_vehicle", "possess_mech"].every((k) => TEACH[k] && typeof TEACH[k].roleTouch === "string" && TEACH[k].roleTouch.length > 0));
ok("T2: no teaching key shadows a market key", Object.keys(TEACH).every((k) => !CARDS[k]));
ok("T2: the desktop-keys card is marked desktop-only", TEACH.desktop_keys && TEACH.desktop_keys.desktopOnly === true);
```

Run `node scripts/gate.mjs depot-test` — the five new checks FAIL (empty table). Record the PASS count.

### Step 2 — fill `TEACH` in `src/depot/cards.js`

Replace `export const TEACH = {};` with the block below — the table above rendered as data, verbatim. The `roleTouch` text is the *(phone)* voice; `role` the *(desktop)* voice where both exist.

```js
// TEACH — the teaching cards (Task 2, owner-ruled copy — do not edit a word
// without a ruling). label/role/skills is InfoCard's own contract; roleTouch
// is the phone voice where the controls differ; desktopOnly marks the one
// card phones never see. Tasks 3/4/7 serve these; nothing reads them yet.
export const TEACH = {
  the_hand: { label: "THE HAND YOU'RE DEALT", role: "Every war opens with seven dealt cards — units and plans together. Pick five, free. Units place by your hand near the depot; plans open your build bar. The enemy drafts five of its own.", skills: [] },
  placing: { label: "PLACING YOUR MEN", role: "Tap ground near your depot to set a ghost. ✓ fields it, ✗ puts it back. The green wash is where you may place. Each pick shows its card first.", skills: [] },
  scrap: { label: "SCRAP", role: "Scrap is the till. One scrap a second, both sides, always. Kills pay more. Everything the convoy sells is paid in scrap.", skills: [] },
  bell: { label: "THE BELL", role: "Every 90 seconds the bell rings and the convoy shows its hand — plans you buy once and build from after, hires that walk on at once. The war is saved at every bell.", skills: [] },
  kill_price: { label: "THE SCORE", role: "Every death is priced at its live market value the moment it falls. Yours in green, the enemy's in red — kills, then value destroyed.", skills: [] },
  convoy: { label: "THE CONVOY", role: "The war pauses while the window is up. Plans cost half and open your build bar; hires field at once by your tap. LATER parks the offer on the top bar until the next bell rewrites it.", skills: [] },
  fog: { label: "SIGHT AND FOG", role: "Men are your eyes — what your side can't see, you can't shoot. This switch only paints the fog; the guns obey sight either way.", skills: [] },
  wind: { label: "WIND", role: "One wind over the whole field. Every shot drifts with it, yours and theirs alike. OFF is dead calm for both sides.", skills: [] },
  spare_ours: { label: "SPARE OURS", role: "With this on, the tesla coil and the atomic crew hold fire while one of your own stands in the blast. Off, they fire regardless.", skills: [] },
  market: { label: "THE MARKET", role: "One market, both armies. What the field is full of costs more. Prices move by the second, and the market paces you — one purchase a second. Buy out what they need before they can.", skills: [] },
  sell: { label: "SELLING", role: "Sell returns 60 percent. Tap SELL, then the tower or wall. A tower's own ring offers SELL too.", skills: [] },
  defend: { label: "DEFEND", role: "Dig in where they stand. They hold the ground, fight what comes, and shuffle to the best nearby stand.", skills: [] },
  move: { label: "MOVE", role: "Tap the ground; they walk there without picking fights on the way. Open water takes no orders — find the crossing.", skills: [] },
  attack: { label: "ATTACK", role: "Tap the ground; they fight their way there, halting to engage whatever they see in reach.", skills: [] },
  possess_squad: { label: "TAKE CONTROL — SQUADS", role: "WASD walks the squad; the mouse carries the aim; hold the left button to fire. The reticle lives inside their own sight. RELEASE hands them back — they dig in where you leave them.", roleTouch: "The left stick walks; the right stick steers the aim; hold FIRE to volley. Tap ground to jump the reticle. RELEASE hands them back — they dig in where you leave them.", skills: [] },
  select_all: { label: "SELECT ALL", role: "Every squad of this type joins the order. One-squad results collapse back to the one.", skills: [] },
  patrol: { label: "PATROL", role: "Two taps set the route — start, then far end. ✓ and they walk it forever, fighting what they see.", skills: [] },
  structures: { label: "ATTACK STRUCTURES", role: "A toggle. On, this squad prefers walls and towers over men.", skills: [] },
  engineer_lines: { label: "THE ENGINEER LINES", role: "BAGS or WALLS, then two taps — start and far end. The ghost line shows every piece and the price. ✓ and they walk the line, laying as scrap allows.", skills: [] },
  sapper_lines: { label: "MINES AND WIRES", role: "The engineer's two taps, buried. Yours are invisible to them; theirs to you — always. A tripwire's flare lights the fog. A mine just waits.", skills: [] },
  discipline: { label: "CAREFUL AND FREE", role: "CAREFUL holds a tower's trigger when the shot would foul your own wall, tower, or depot stone. FREE fires regardless.", skills: [] },
  possess_tower: { label: "TAKE CONTROL — TOWERS", role: "The mouse carries the aim; hold the left button to fire. No walking — a tower stands. Your trigger, your responsibility: CAREFUL does not hold it for you.", roleTouch: "The right stick steers the aim; hold FIRE. No walking — a tower stands. Your trigger, your responsibility.", skills: [] },
  escort: { label: "ESCORT", role: "Tap a squad; the hull shadows it wherever it goes.", skills: [] },
  tracks: { label: "TRACKS", role: "CAREFUL brakes for your own men. FREE takes the safety off — the tracks are a weapon then, both ways.", skills: [] },
  possess_vehicle: { label: "TAKE CONTROL — ARMOR", role: "WASD drives; the mouse aims the turret; the left button fires the main gun, the right button streams the coax. The APC carries one gun — FIRE alone.", roleTouch: "The left stick drives; the right stick aims; FIRE for the main gun, MG for the coax. The APC carries one gun — FIRE alone.", skills: [] },
  possess_mech: { label: "TAKE CONTROL — THE MECH", role: "WASD walks it; A and D turn — hold for the hard pivot. The mouse sets aim and range. Hold the left button to fire; V missiles, B barrage, C punt, T about-face.", roleTouch: "The left stick walks; the right stick turns — hard over pivots. The slider sets range, ◀ ▶ trim the aim. FIRE, MSL, BRG, PUNT.", skills: [] },
  load: { label: "LOAD AND UNLOAD", role: "LOAD: tap a squad; they walk to the ramp and board. Four sealed seats — riders see nothing, fire nothing, and die with the hull. UNLOAD drops the ramp.", skills: [] },
  desktop_keys: { label: "THE KEYS", role: "WASD pans. Q and E rotate — tap snaps a quarter turn, hold swings. The wheel zooms. M mutes. ESC leaves for the menu. Possessed, WASD drives and the mouse aims and fires.", desktopOnly: true, skills: [] },
};
```

### Step 3 — gates

- `node scripts/gate.mjs depot-test` — green, PASS count = Step 1's + 5 (four new checks pass plus the re-taught one; the removed empty-table check leaves the ledger — the agent states the exact arithmetic from its two runs).
- `node scripts/gate.mjs depot-lint` — green.

No other gates: data only, nothing served, no runtime path changes.

### Step 4 — the deploy

Bump `src/version.js` to `mk2.40`; build after the bump; commit ("the teaching cards — the copy, mk2.40"); push.

## Report

Read-confirmation, one line of outcome, PASS counts before/after with the re-teach named old→new, gates and verdicts, commit hash, seeds (none used).
