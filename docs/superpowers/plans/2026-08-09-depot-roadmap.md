# COLDSNAP DEPOT — Master Roadmap

*HISTORY (stamped 2026-08-20, owner's order): this document is a record of shipped work, not authority. Design truth lives in CLAUDE.md and the ACTIVE phase's plan documents; where this file disagrees with them, it is wrong.*

Spec: `docs/td-vision.md` (approved 2026-08-09). Each phase gets its own code-level plan in this directory, written just-in-time and **reviewed by Jeff before any coding starts**. Every phase ships playable; HOLD THE DEPOT's gates stay green throughout; verification is inline (gates + smoke + screenshots — no review fan-outs).

| Phase | Name | Ships | Gate |
|---|---|---|---|
| 0 | Substrate | Glancing+armor damage model (guarded core hooks), tree fire + MG shredding, seeded-rng discipline for DEPOT code | golden + TD gates green, new `test:combat` |
| 1 | DEPOT scaffold | `src/depot/` module, defend side, start-screen entry, wave stalls + dispatch shell, 50-wave structure | `test:depot`, smoke section |
| 2 | Accuracy + wind | Condition-driven scatter (elevation/LOS/range), wind vector, flags + tree sway, symmetric | probe-measured accuracy curves, `test:accuracy` |
| 3 | Attacker economy | Priced roster, stipend + results income, doctrine AI counters, intel-line mapping (bureau prose) | `test:economy`, AI completes runs headless |
| 4 | Territory | Influence grid, green/red render, build rights, income follows color | `test:territory` |
| 5 | Infantry | Sniper → riflemen/MG/AT; DEFEND/ATTACK orders; cover | `test:infantry` |
| 6 | Doctrine drafts | 12-lever mirrored table + shared + THE FRAME; draft UI at stalls | `test:doctrine` |
| 7 | Bison | All-in purchase, drive-or-build exclusivity, camera handoff | smoke drive section |
| 8 | Attack mode | Player attacks vs builder AI; regiment attrition; mech | `test:attack` |
| 9 | Multiplayer | Determinism audit, decision packets, CF worker signaling, boundary sync | twin-sim divergence test |

Phase plans: `2026-08-09-depot-phase-0-1.md` (written). Later phases: TBD-on-approach, planned after the preceding phase's engine truths are known.
