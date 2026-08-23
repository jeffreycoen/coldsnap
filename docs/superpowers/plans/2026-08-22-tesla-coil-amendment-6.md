# The Tesla Coil — Amendment 6 (the longer arc)

Owner's ruling (2026-08-22, after hearing it live): the chain doesn't arc far enough — double the hop reach.

## Step 1 — the number

`src/depot/state.js`, the TESLA row: `hopR: 4` → `hopR: 8`. The comment's "4m" becomes "8m" where it names the number. Nothing else in the row moves (8 hits, minus 5 a hop, floor 10, 150ms stagger).

## Step 2 — the re-taught pins (behavior change, ratified here)

`scripts/tests/22-the-tesla-coil.mjs`, three fixtures sit inside the new reach and are re-taught to sit outside it — the asserts' MEANING is unchanged (out-of-reach stays unhit; a clear friend holds nothing):

- The reach-limit block: the far man moves from `11.5` (5.5m past the victim) to `16` (10m past); the assert text "4m is the hop's whole reach" becomes "8m is the hop's whole reach".
- The hold-check block: the clear friend moves from `14, 0` (8m from the foe — now in reach) to `22, 0` (16m).
- Any other literal `TESLA.hopR`-derived distance the suite carries is checked against the new 8 and reported old→new.

## Gates and the landing

`node scripts/gate.mjs depot-test` (seed 13), `golden`, `depot-lint`, `smoke`. All green → bump `src/version.js` to `mk2.22` → build → commit "the tesla coil — the longer arc, mk2.22" → push. The owner's live feel is the acceptance. The switch-and-words task becomes mk2.23.
