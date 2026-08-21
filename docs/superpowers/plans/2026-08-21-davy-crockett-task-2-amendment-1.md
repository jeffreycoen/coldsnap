# The Davy Crockett, task 2 — Amendment 1: the roster-count re-teach license (mk2.08)

The original plan grew the roster by one key (`sq_davy` into the hand, the pick pool, and the hero-tier row) and did not license the suite checks that pin the roster's SIZE as a literal. Fourteen count pins plus one source pin failed, and the agent stopped correctly with the tree edited and uncommitted. This amendment grants the sweep license for exactly those pins and nothing else. No source file changes beyond the original plan; the original plan's steps stand as executed.

**Suggested model: Sonnet** — re-pin fifteen enumerated literals, run the gates, land.

## The license

Re-teaching is licensed for the fifteen checks below and no others. In every one, only the pinned COUNT (and the prose naming it) moves — seventeen becomes eighteen, eighteen becomes nineteen, six becomes eight. Asserted mechanism and all other asserted content stay identical. Every re-teach is reported old → new in the landing report. Any sixteenth failing check stops the task.

1. `hand: the plans pool ignores the bell entirely — one pool at any hour`
2. `hand: eighteen plans stand at bell one`
3. `hand: a bought plan leaves the pool`
4. `hand: a one-plan pool deals that plan and the two hires`
5. `VISION T2(e): six of the seven enemy acquisition paths gate on sight in units.js` — the count pin `=== 6` becomes `=== 8`: the atomic crew's two sight-gated scans (its man scan and its structure scan in the new stepDavy) joined units.js. The check's comment gains one line saying so, mk2.08 signed.
6. `T7(f) (re-taught mk2.02): the ungated plans pool at bell one is eighteen — rockets and grenadiers included`
7. `T6v2: the pool is eighteen, unique keys`
8. `T2(a): HAND_KEYS is the eighteen, exactly the pick pool's keys`
9. `T2(b5): a thin pool still burns five draws and deals what it has`
10. `T3(a3): the plans pool is the full eighteen`
11. `T4(a): HAND_TAGS covers the ten squads and all three heroes; tower keys route to the ledger` — the squad count in the pin and its prose moves ten → eleven.
12. `T6(a): the pool is seventeen and sq_medics is in every seat`
13. `T7v2(a): the pool is seventeen and sq_mechanics is in every seat`
14. `M22: the pool and hand are eighteen with hero_mech in every seat`
15. The one remaining count failure from the gate's own listing not named above, if its failure is solely the same one-key roster growth — re-pinned by the same rule, reported by its full name. If its failure is anything else, STOP.

Where a check name above carries a number in its NAME string (for example "eighteen plans stand at bell one"), the name is re-signed to the new number and the re-sign is part of the reported re-teach.

## Steps

1. Confirm the working tree still holds the original plan's Steps 1–7 edits uncommitted (git status shows the nine modified files plus the new era file). If the tree differs, stop and report.
2. Run `node scripts/gate.mjs depot-test`. Confirm the failing set is exactly the fifteen licensed checks. Any other failure stops the task.
3. Re-pin each licensed check: the count literal, the name string's number word where present, and one added comment line on the VISION T2(e) pin. Nothing else in any test file moves.
4. `node scripts/gate.mjs depot-test` — green. `node scripts/gate.mjs depot-lint` — green.
5. The landing, from the original plan's Step 9: bump `src/version.js` mk2.07 → mk2.08, `npm run build` AFTER the bump, commit `the crew and the shot, mk2.08 (Amendment 1)`, push.

## Report

One line of outcome; both gate summaries verbatim; fixture seeds (7, 9 for era 17; the re-pinned eras name their own); the commit hash; EVERY re-teach as its own bullet, old → new; any deviation labeled; skipped steps named.
