# THE BUTTON MAP — every control, card or bare

Drawn from a full read of every interface file (mk2.38). Each row: the control, where it lives, what it does, and a lean — **CARD** (gets a teaching card) or **BARE** (its label already says everything). The leans are for your line-by-line ruling; nothing here is decided.

The rule behind the leans: a control that **spends, commits, or changes mode** gets a card; pure navigation and self-labeled toggles stay bare. The 19 market info cards that already exist (`src/depot/infocards.js`) are counted as done — they are the base the rest joins.

---

## 1. Start screen — `src/ui/StartScreen.jsx`

| Control | Line | Does | Lean |
|---|---|---|---|
| RESUME FRONT | 70 | Reopens the saved war at its bell | BARE |
| NEW FRONT — TAKE COMMAND (two-tap burn) | 82 | Starts fresh; second tap burns a saved front | BARE — the confirm text teaches itself |
| THE PROVING RANGE | 101 | Opens the demos menu | BARE |
| CONTROLS | 105 | Key remapping screen | BARE |
| SANDBOX | 109 | Developer sandbox | BARE |

The three-law blurb (lines 63–67) is the text marked for removal; its content becomes starting cards.

## 2. Proving range menu — `src/ui/DemosScreen.jsx`

HOLD THE DEPOT, CLEARANCE CAMPAIGN, CONTRACT SANDBOX, PROVING GROUNDS, MECH TEST RANGE, CONTROLS, BACK (lines 59–93). All **BARE** — each button carries its own one-line description already. Lean: the whole demos side sits outside the tutorial system.

## 3. Campaign order book — `src/ui/CampaignScreen.jsx`

Order rows (DEPLOY / REPLAY / SEALED, line 37), ⏏ MENU (103), ⟲ NEW CAMPAIGN two-tap (107). All **BARE**, same out-of-scope lean.

## 4. Controls screen — `src/ui/Controls.jsx`

14 rebind chips (line 66), ← BACK, RESET DEFAULTS (73–74). **BARE**. These bindings drive the proving-grounds demo only — the war's keys (WASD pan/drive, Q/E rotate — tap snaps, hold swings — wheel zoom, M mute, ESC menu, mech V/B/C/T, mouse triggers) are fixed in `DepotGame.jsx` and remap does not touch them. **CARD 28 — desktop keys** (ruled, owner 2026-08-24): one card naming the war's real keys, served on desktop only.

## 5. Pre-start overlay — `DepotGame.jsx:5035`

| Control | Line | Does | Lean |
|---|---|---|---|
| TAKE COMMAND | 5047 | Opens the draft (first war) or starts the sim | BARE |
| FIELD MANUAL | 5050 | Opens the 10-card manual | Replaced by the new system |
| Orientation paragraph + seed line | 5039–5053 | ~90 words | Cut candidate — becomes the 3 starting cards |

**Proposed tutorial entry point**: a third choice on this overlay ("SHOW ME THE FRONT"), the optional walk between start and first bell.

## 6. The draft — `DraftScreen`, `DepotGame.jsx:826`

| Control | Does | Lean |
|---|---|---|
| Seven dealt tags (tap toggles pick) | Pick 5 of 7, free | **CARD 1** — "the hand you're dealt", shown once above the first draft |
| FIELD THESE FIVE | Confirms the five | BARE |

## 7. Placement (pre-bell) — `DepotGame.jsx:2403`, banner `:5063`

Ground tap sets a ghost, ✓/✗ confirms, the deal-door info card fronts each unit (exists today). **CARD 2** — "placing your men": tap, ghost, confirm, the homeland ring. One card covers the whole flow; the ✓/✗ pair itself stays bare.

## 8. Top bar (in war) — `DepotGame.jsx:4613`

| Control | Line | Does | Lean |
|---|---|---|---|
| ◆ scrap readout | 4614 | Till; 1 scrap/second income | **CARD 3** — scrap and the income clock |
| BELL chip (tap re-reads dispatch) | 4616 | Countdown to next bell; tap reopens intel | **CARD 4** — the bell: 90 s, convoy, save written each toll |
| ☠ enemies readout | 4622 | Live enemy count | BARE |
| ⚔ score readout | 4623 | Kills and value, yours then theirs | **CARD 5** — the kill price (deaths priced at live market value) |
| ⛊ MANIFEST chip | 4631 | Reopens the dismissed convoy offer | Covered by CARD 6 (convoy) |
| ❚❚ / ▶ pause | 4639 | Freezes the sim | BARE |
| 1× / 2× speed | 4643 | Sim speed | BARE |
| ⟳ rotate | 4659 | View yaw (Q/E) | BARE — CARD 28 names it |
| FOG ON/OFF | 4661 | Visual fog only; targeting unchanged | **CARD 7** — sight vs fog: what your men see is what you can shoot, the toggle only paints |
| HEALTH ON/OFF | 4664 | Health bars | BARE |
| WIND ON/OFF | 4667 | Drift on every shot, both sides | **CARD 8** — wind: one wind, both armies |
| SPARE OURS ON/OFF | 4670 | Tesla/davy hold fire with a friendly in the spread | **CARD 9** — area-weapon safety |
| 🔊 mute | 4673 | Sound | BARE |
| ⏏ MENU (two-tap) | 4677 | Leaves the field | BARE |
| fps · stones · mark | 4683 | Diagnostics | BARE |
| NEW VALLEY / THEY FIGHT (sandbox only) | 4650, 4655 | Dev tools | BARE |

## 9. The convoy manifest — `DepotGame.jsx:4720`

| Control | Does | Lean |
|---|---|---|
| Hand rows (tap opens info card) | Plan (half price, opens bar) or hire (full price, fields at once) | **CARD 6** — the convoy: plans build, hires march, the war pauses while the window is up, one visit per bell |
| LATER | Dismisses to the top-bar chip | BARE |
| Intel dispatch card / ACKNOWLEDGE | Bell's report, floating | Covered by CARD 4 (bell) |

## 10. Info card doors — `src/depot/InfoCard.jsx`

CONFIRM PICK / CONFIRM HIRE / PLACE IT / CLOSE / ✗. All **BARE** — the info card is itself the teaching surface. The 19 market cards ride as they are; they gain the popup/first-encounter triggers.

## 11. Build bar — the quartermaster's crates, `DepotGame.jsx:4989`

| Control | Line | Does | Lean |
|---|---|---|---|
| BUILD/CLOSE crate | 4999 | Opens the tree | **CARD 10** — the market: one shared price table, prices climb with what stands, one buy a second |
| Branch crates TROOPS / BUILDINGS / VEHICLES | 5011 | Pick a category | BARE — purpose lines exist (first war), CARD 10 covers the rest |
| 19 lattice tags (5 towers, 11 squads, 3 hulls) | 4435 | Arm a placement mode; ⓘ opens the info card | **DONE** — the existing market cards; add first-encounter trigger |
| SELL tag | 5022 | Sell mode, 60 % refund | **CARD 11** — selling (also covers the tower radial's SELL and the wall panel's SELL) |
| THE ENEMY branch + 20 rack tags (sandbox) | 5011, 798 | Bench spawner | BARE — dev |

## 12. Squad radial (the pie) — `DepotGame.jsx:4819`

| Wedge | Who gets it | Does | Lean |
|---|---|---|---|
| DEFEND | all | Dig in where they stand | **CARD 12** |
| MOVE | all | Tap-ground destination, no fighting en route | **CARD 13** |
| ATTACK | all | Tap-ground, fight the way there | **CARD 14** |
| TAKE CONTROL | all | Possession | **CARD 15** (squad possession — sticks/reticle/FIRE/RELEASE, both platforms) |
| SELECT ALL | all | Every squad of the type joins the order | **CARD 16** |
| PATROL | not engineers/sappers | Two taps, confirm, walk forever | **CARD 17** |
| ATTACK STRUCTURES (toggle) | armed types | Prefer walls and towers | **CARD 18** |
| BAGS / WALLS | engineers | Two-tap line, ghost preview, ✓ UP TO ◆n | **CARD 19** — the engineer lines (both wedges, one card) |
| MINES / WIRES | sappers | Same two-tap shape; invisible to the enemy | **CARD 20** — the sapper lines (both wedges, one card) |

Follow-up controls of these flows — ground taps, the line ✓/✗, endpoint pickup (tap a disc, tap new ground), the status chip — are taught inside their order's card, not carded separately.

## 13. Tower radial — `DepotGame.jsx:4897`; wall panel `:4880`

| Wedge | Does | Lean |
|---|---|---|
| CAREFUL / FREE | Holds the trigger when a friendly structure fouls the flight path | **CARD 21** — fire discipline |
| TAKE CONTROL (gun towers) | Possession | **CARD 22** (tower possession — no stick, reticle + FIRE) |
| SELL ◆n | Refund | Covered by CARD 11 |
| Wall inspect SELL | Same | Covered by CARD 11 |

## 14. Vehicle / mech radial — `DepotGame.jsx:4938`

| Wedge | Who | Does | Lean |
|---|---|---|---|
| DEFEND / MOVE / PATROL | all hulls | Squad orders at hull scale | Covered by CARDS 12/13/17 (same words, one line naming hulls) |
| ESCORT | all hulls | Tap a squad; the hull shadows it | **CARD 23** |
| TRACKS CAREFUL / FREE (toggle) | all hulls | Brakes for your own men, or not | **CARD 24** |
| TAKE CONTROL | all hulls | Possession | **CARD 25** (vehicle: FIRE + coax MG, right-click coax on desktop, APC's one gun) / **CARD 26** (mech: PUNT/MSL/BRG, range slider, aim trim, V/B/C/T keys, no reticle) |
| LOAD (n) / UNLOAD (n) | APC | Riders in, riders out; sealed hold | **CARD 27** |

## 15. Possession interface — `DepotGame.jsx:4483–4611`

Left stick, right stick (reticle), FIRE, MG, RELEASE, tap-to-aim, mech buttons, desktop mouse/keys. All taught inside the four possession cards (15, 22, 25, 26); no separate cards per button.

## 16. Everything else

Pending ✓/✗ pair, line ✓/✗ pair, hire ticker ✗, placement banner, toasts, possessed chip, squad flag, end card RETURN TO BASE, ENGINE FAULT RESTART, field-manual buttons (system retired). All **BARE**.

---

## The tally

- **Existing, kept**: 19 market info cards (live numbers, owner-approved copy).
- **Proposed new cards**: **28 new teaching cards** — the numbered rows 1–28 are all distinct; the "covered by" rows reuse numbers and were never separate cards. (An earlier tally line here said 25 — a counting defect, corrected 2026-08-24; no ruling changed.)
- **Retired**: the 10-card field manual as a slideshow; its copy feeds the new cards.
- **Starting cards (shown before the first draft, max 3 per your ruling)**: candidates are the bell (4), real stone / what breaks stays broken, and the fall (depot dies → save burns). Your pick.

## The three doors (unchanged from the discussed shape)

Every card serves through: (a) first-encounter popup, once, one storage key, revision-gated; (b) on-demand — long-press on phone, hover/ⓘ on desktop; (c) the optional tutorial walk ("SHOW ME THE FRONT" on the pre-start overlay), which plays the same cards in a taught order pointing at the real controls. Phone and desktop both, named per card at plan time.

## Out of scope by lean, awaiting your word

- Proving range, campaign book, contract sandbox, mech range, tower-defense demo — no cards.
- Sandbox-only controls (enemy rack, fight switch, new valley) — no cards.
