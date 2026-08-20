# WINTER FRONT — Phase 7.1: The Command Refit — CLOSED (owner, 2026-08-19, at mk1.75)

*The skeleton. Scope and design rulings live in each task's own plan file. Six tasks, ruled order, marks mk1.60–mk1.69 (mk1.62/mk1.64 = amendments; mk1.66 = the sandbag fix; mk1.69/mk1.70 = the place-mode hotfixes; mk1.71 = enemy engineers build). Each task's full plan is its own file, written one at a time and served alone for review. Resource harvesting is NOT here — it is Phase 7.2. ARMS follows 7.2.*

## Status

| # | Task | Mark | Plan file | State |
|---|------|------|-----------|-------|
| 1 | Camera rotation | mk1.60 | `p7-1-task-1-camera-rotation.md` | SHIPPED (ef8776a) |
| 2 | The radial audit | mk1.61 | `p7-1-task-2-radial-audit.md` | SHIPPED (9fada4c) |
| 3 | Visible health | mk1.63 | `p7-1-task-3-visible-health.md` | SHIPPED (ee77bde) |
| 4 | Market info cards | mk1.65 | `p7-1-task-4-info-cards.md` | SHIPPED (43ebd73) |
| 4b | Mortal sandbags | mk1.66 | `p7-1-task-4b-mortal-sandbags.md` | SHIPPED (1d191b4) |
| 5 | The build tree | mk1.67 | `p7-1-task-5-build-tree.md` | SHIPPED (4bac756) |
| 6 | The starting pick | mk1.68 | `p7-1-task-6-starting-pick.md` | SHIPPED (f090a53) |
| 7 | His shovels dig | mk1.71 | `p7-1-task-7-enemy-builds.md` | SHIPPED (5057b93) |
| 8 | The seed purge + the dealt hand | mk1.72 | `p7-1-task-8-dealt-hand.md` | SHIPPED (156bd4d; A1 mk1.73 5a76809) |
| 9 | The gentle arc and the tight tube | mk1.74 | `p7-1-task-9-artillery.md` | SHIPPED (4c399f4) |
| 10 | Live portraits | mk1.75 | `p7-1-task-10-portraits.md` | SHIPPED (72da690) |

Every deploy bumps `src/version.js` first, builds after. One agent in the tree at a time; stop after every task.

## The tasks

**Task 1 — Camera rotation (mk1.60).** Two-finger rotation on touch; hold Q/E rotates continuously on desktop. The view stays at any angle it is left at. A quick Q/E tap keeps the 90° snap; the ⟳ button stays. Render and input work only — the sim never reads the camera. Both platforms, by law. Suggested model: Sonnet (bounded render/input change, fully specced).

**Task 2 — The radial audit (mk1.61).** Every wedge on every pie — squad, tower, vehicle — verified working live: the order executes, completes, and survives a save. Existing buttons only; the shelved vocabulary stays shelved. Output is a defect list served to the owner, then the fixes; a button that cannot be fixed inside the task is removed rather than left lying. Suggested model: Sonnet for the fixes; the verification sweep's shape is set in the task plan.

**Task 3 — Visible health (mk1.63).** A health bar shown only while hurt, on everything with hp — men, hulls, towers, walls. The red hit-flash stays. The depot stays census-only (the building is the readout). Renderer work over fields that already exist (`hp`/`maxHp`); the owner checks the look live. Suggested model: Sonnet (render-layer, specced look).

**Task 4 — Market info cards (mk1.65).** A per-type card: what it does, health, damage, skills. Reachable from the bell's manifest offer — confirm or cancel before the pick — and from the build bar for owned types. One card component, both doors. Needs the type data table written (task 2's audited vocabulary is its source). Phone and desktop both. Suggested model: Sonnet (interface + a data table, fully specced).

**Task 4b — Mortal sandbags (mk1.66).** The invincibility found at mk1.64 dies: damage reaches sandbag bodies, their 60 hp becomes real, and a killed bag releases its ground. Ruled next by the owner (2026-08-19); plan pending.

**Task 5 — The build tree (mk1.67).** The flat build bar collapses into one BUILD entry opening TROOPS / BUILDINGS / VEHICLES; SELL lives inside the tree. A branch stays open for repeat placement; tapping the active button still clears to command. The manifest pick still arms the bar through the tree. Phone and desktop both. Suggested model: Sonnet (interface reshape, no sim change).

**Task 6 — The starting pick (mk1.68).** Before the war starts, the player picks up to four squads from the full troop list — free kit, no scrap. The picks replace the auto-gifted runner squad and breaker pair. The enemy mirrors with four count-stable seeded draws fielded beside its garrison. Touches the fresh-boot draw contract (45 pinned draws) and the save; reuses task 4's card and task 5's grouping to present the choices. Suggested model: Sonnet, with the boot-draw arithmetic pre-computed in the plan.

## Standing constraints

- All dials provisional (F5).
- Draw-count law binds task 6: every rng change is draw-then-clamp, counts pinned old→new in the plan.
- Engine (`core.js`) and renderer changes are guarded additive divergences, golden green. Tasks 1 and 3 touch the renderer only.
- Test only what changed; the sweep license covers moved or re-signed literal text; every re-pin reported old→new.
- Interface tasks (1, 4, 5, 6) ship phone AND desktop, every time.
- The owner's live check is the acceptance for every look (bars, cards, tree, pick screen, rotation feel).

## Deferred out of this phase

- Resource harvesting — Phase 7.2 (rocks, trees, scrap salvage; the trees question still open).
- The shelved order vocabulary (take cover, fall back, squad escort, suppress) — a later phase.
- The setTargetAtTime audio gap (6 sites) and the siege caveat — standing oddments, unchanged.

**Task 7 — His shovels dig (mk1.71).** The enemy's engineers lay sandbag and wall lines on his held ground on the bell's cadence, seeded draws, through the same two-point machinery the player's use, parameterized by side (owner, 2026-08-19: he can do anything the player can, including building defenses). Tower placement stays with the full build-brain at Enemy Front. SHIPPED (5057b93).

**Task 8 — The dealt hand (mk1.72).** The starting pick dies: every war opens with four randomly assigned units off the fifteen-type pool, four distinct BOTH sides (supersedes the enemy's 2-4 dedupe). The cards deal one at a time — deal, read, place that unit, next — then TAKE COMMAND. Rulings on the record (2026-08-19); plan written on the owner's word. Suggested model: Sonnet (interface + draw-contract arithmetic, fully specced at planning).
