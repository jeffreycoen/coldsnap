*Part of the P7 phase plan — the last task before the phase close.*

# Task 11 — The manual learns armor, and the audit (mk1.41) — FULL PLAN

**What it does, in one line:** the field manual gains the armor card — your tank, your transport, yours to lose — and one save/resume audit fixture proves everything P7 added survives the bell round-trip (vehicles and their whole order state, sealed riders both kinds, mines, the commander, the garrison, the hero unlocks), fixing and naming any carriage defect it catches.

**Suggested model:** Sonnet 5.

**Required reading (re-verified at dispatch; locate by content):**
- This file; the phase skeleton's Task 11 entry.
- `src/ui/FieldManual.jsx` — whole (the card array's shape, the don't-show-again flow).
- `src/depot/save.js` — whole. `src/depot/transports.js` — the seat/rider fields. `src/depot/DepotGame.jsx` — the RES restore section whole (every S.* restore line P7 added), parkArmor's body fields.
- `src/depot/mines.js` — the device shape. `scripts/depot-test.mjs` — harness, the existing save round-trip block, every P7 tail block's field names.
- `scripts/smoke.mjs` — ONLY the manual-card assertions, if any exist (grep "manual"): a new card may re-pin a card count. Named if so.

**THE CARD (owner's eyes accept the copy live; slot it after TAKE CONTROL, before the bell):**
- Title: `YOUR ARMOR`
- Body: `A Bison and a transport stand at your depot. Order them like squads — or take the controls yourself. The tracks brake for your own men until you say otherwise. Theirs to kill, and dear to replace: lost armor returns only off a late convoy, at a price.`
(Match the existing cards' exact object shape and tone; no digits; both platforms get it free — the manual is plain DOM.)

**Trap notes (binding):**
1. The card is an ARRAY ENTRY in FieldManual.jsx — no flow changes, no re-show machinery (that is Polish II's queued item, untouched here).
2. THE AUDIT is one comprehensive fixture (P7 T11 block): build a live war state carrying EVERYTHING the phase added — a player Bison mid-PATROL (dest + _patA/_patB + tracks "free"), a player APC with a squad SEALED aboard (ridingIn + pinned/riding members), an enemy Bison committed-forward, an enemy APC mid-FERRY with rideApc riders, live and spent mines both teams, S.cmdr "bold", garrison men (hold/garrison), hero tags in both unlocked lists — then serializeFront → parseFront → restore the world and S, and assert EVERY named field survives (vtype, drv, depotDrive, order, dest, tracks, apcSeq, homeX/homeZ, committed, ferry, bounty, armor, ridingIn, riding, pinned, rideApc, mines rows + live flags, cmdr, hold, garrison, unlocked contents). Field-by-field, named oks.
3. Anything the audit catches gets the SMALLEST honest carriage fix (save.js writer/reader or a DepotGame restore line), each its own named bullet. A structural problem (a field that CANNOT ride the existing channels) is a STOP-and-report, not an improvisation.
4. Known sharp edges to check deliberately: `_patA/_patB` (flat objects — should ride the sweep; verify), `_route` (correctly dropped — assert it re-derives, not that it survives), the ferry string, restored riders' pin at y −60, a restored possessed state (S.possess is never saved — assert a mid-possession save resumes to command view with the hull on defend), R.setMines on restore, the flare eye (a _dieT flag body — decide from the code whether it saves cleanly or should be EXCLUDED from the write like a cache; state the finding and the choice).
5. NO core.js edits. FieldManual + save-side files + fixtures only.

## Steps
1. The audit fixture lands FIRST and fails or passes honestly — every carriage defect it exposes is fixed with the smallest save-side change, named old→new in the report.
2. The armor card lands in FieldManual.jsx with the copy above, verbatim.
3. Any smoke manual-card pin re-taught, named.
4. version mk1.40 → mk1.41; gates: depot-test, depot-lint, build (after bump), smoke. NOT golden.
5. Commit exactly (src/ui/FieldManual.jsx, scripts/depot-test.mjs, src/version.js, plus src/depot/save.js and/or src/depot/DepotGame.jsx and/or src/depot/mines.js ONLY where the audit forced a carriage fix — each named; smoke.mjs only per step 3), push. Message: `the manual learns armor; the resume audit closes the phase's books (mk1.41)`.
- Owner's live check: the tour's new YOUR ARMOR card reads right on phone and desktop; save a war mid-everything (possessed hull, sealed riders, laid mines, patrols running) at a bell, resume it, and the war comes back whole.

**Report format:** read-confirmation; one line of outcome; every audit finding + its fix, old→new, each its own bullet; every re-pin named; smoke stated plainly.
