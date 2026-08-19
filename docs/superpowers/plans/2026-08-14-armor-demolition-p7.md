# ARMOR & DEMOLITION — phase plan (P7)

*2026-08-14. Governs the mk1.3x series. Every ruling in the decision record's "Armor & Demolition (P7)" section binds this plan; nothing there is open. Interface work ships phone AND desktop, every task. Sounds audition on the soundboard.*

**STATUS (2026-08-15): this document is the skeleton and index — each task's full plan is its own file (owner's ruling, 2026-08-15), written at standing-orders detail and served ALONE for review. The reading debt was paid in full 2026-08-14 (core.js whole; all of src/depot/; the sandbox drive; the renderer vehicle regions; the depot-test harness).**

**The task files:**
- Task 1 — `p7-task-1-motor-pool.md` — SHIPPED mk1.30 (e32a3e1)
- Task 2 — `p7-task-2-bison.md` — SHIPPED mk1.31 (604a601)
- Task 3 — `p7-task-3-seat-of-the-war.md` — SHIPPED mk1.32 (d5cc184)
- Task 4 — `p7-task-4-apc.md` — SHIPPED mk1.33 (5949967), Amendment 1 included
- Task 5 — `p7-task-5-precast-depot.md` — SHIPPED mk1.34 (17ee617)
- Task 6 — `p7-task-6-defensive-opening.md` — SHIPPED mk1.35 (ba1fa28)
- Task 7 — `p7-task-7-runners-breakers.md` — SHIPPED mk1.36 (1bcbf5a)
- Hotfix — `p7-hotfix-mk137-fault-names-itself.md` — SHIPPED mk1.37 (981429d)
- Task 8 — `p7-task-8-enemy-drive.md` — SHIPPED mk1.38 (65c7cbc)
- Task 9 — `p7-task-9-hero-tier.md` — SHIPPED mk1.39 (e039027)
- Task 10 — `p7-task-10-mines.md` — SHIPPED mk1.40 (34907ef)
- Task 11 — `p7-task-11-manual-audit.md` — SHIPPED mk1.41 (304644c)

**PHASE CLOSED (owner's playtest verdict, 2026-08-19, at mk1.55).** Tasks 12–24 (the debugging pass, the reorganization, the documentation push, the close-out fixes) each carry their own plan file, p7-task-N-*.md. The original close items resolved: the capacity gate passed and accepted 2026-08-19; the playtest closed the phase. Historical close note: the capacity check (two hulls a side + minefields under the ramp's ceiling) and the owner's playtest. The owner is running a DEBUGGING pass first (2026-08-17). Open: the ENGINE FAULT root cause (mk1.37's overlay now names the site — a new screenshot pinpoints it); the setTargetAtTime audio gap; the siege-hardness caveat; the plow-stutter FEEL confirmation (the precast depot was the measured fix — awaiting the owner's hands).

**Architecture notes from the 2026-08-14 reading (for the plan writer):** the engine's `stepDrive`/`aiDrive`/`driveHull` (core.js ~916-971) already drive ANY vehicle carrying `b.squad` (goal-seek) or the possessed `world.bisonId` (via `world.control`) — the driver framework is a depot-side ORDER layer that sets goals and triggers, plus one guarded divergence so the depot can command team-1 hulls and possessed vehicles without the demo-global `bisonId` path. The enemy tank driver to re-seat is `units.js` `stepTank` (~117-163). `bisonFire`/`bisonMg`/`recoverBison` exist (core.js 2418/2440/1319). Vehicles are already sight eyes (sight.js SIGHT.vehicle 36) and territory emitters (territory.js EMIT.vehicle). The renderer has `buildBison`/`buildScout`/`buildTruck` and vehicle fog rules (renderer.js ~620-1410); the APC needs one new mesh. Mines are designed as game-layer watched points, NOT physics bodies — no engine cost, invisible by construction; save/resume must carry them.

*The skeleton as served:*

**Task 1 — The motor pool (mk1.30)**
- One driver layer for every vehicle in the war: a goal, steering on the movement grid, a trigger policy. The enemy tank re-seats onto it with behavior pinned identical.
- The one guarded engine line that lets the war command its own hulls (the engine's tread physics and goal-seek already drive any vehicle — the depot just couldn't own one until now).

**Task 2 — The Bison musters (mk1.31)**
- One Bison parked at each depot at war start.
- Yours is a full citizen: radial orders (defend, move, patrol, escort a squad) and TAKE CONTROL — twin-stick drive, the main gun, the hull machine gun.
- Tracks brake for your own men; an order takes the safety off. Enemy infantry are crushable — driving through a line is a weapon.

**Task 3 — The seat of the war (mk1.32)** *(added by the owner's 2026-08-14 rulings off the mk1.31 playtest — cuts ahead of the APC)*
- Depots grow to 12×9×7 and move to opposite corners, point-symmetric; normal welds, but the breach bar drops — a depot must be really knocked down.
- The enemy home fights back from second zero: an eight-man dug-in home guard off its own books, its seeded sandbag ring, its Bison armed at post. Armor parking goes fail-proof.

**Task 4 — The APC (mk1.33)**
- The new hull, one at each depot. Four seats: one squad of four or two teams of two.
- LOAD and UNLOAD on the radial. Riders are sealed — no eyes, no fire — and die with the vehicle.
- Same orders, same possession, same track rules as the Bison. The rear ramp shows closed and open (open when troops load/unload).

**Task 5 — The precast depot and the honest resume (mk1.34)** *(owner's 2026-08-15 rulings — the stutter fix and the ghost fix, combined)*
- Both depots rebuild as column-and-panel precast — a quarter the bodies, the measured boom cost at the wall drops 3.3×; demolition goes structural (panels fall whole, columns drop the roof).
- The resume ghost dies: the save stops carrying the broadphase bookkeeping that left every resumed sleeping stone untouchable.

**Task 6 — The defensive opening (mk1.35)** *(owner's 2026-08-15 rulings)*
- Half of each early muster digs in at home (taper to zero by ~bell 8, standing garrison capped at 12); the precast census gets teeth — upright slid pieces still stand, mass weights the fraction.

**Task 7 — Runners and breakers for both sides (mk1.36)** *(owner's 2026-08-14 ruling — see the decision record)*
- The runner and breaker join the player's production list at tier 1, mirroring the enemy's tier 1.
- Runner squads of 4 with a per-type march speed (they actually run); breaker squads of 2 with the symmetric ram — they grind enemy masonry by contact, the same rule the enemy's use.

**Task 8 — The enemy learns to drive (mk1.37)**
- The commander profile, drawn once per war from the seed: cautious guards and commits late, bold rides out early, stubborn never leaves home.
- The enemy APC ferries assault squads and sometimes flanks where the roads allow.
- The intel desk may whisper which commander you drew.

**Task 9 — The hero tier (mk1.38)**
- A new top of the manifest opens at a late bell: lost armor can return off the convoy — ruinous, market-walled prices, both sides paying the same table.

**Task 10 — Mines and tripwires (mk1.39)**
- The sapper team lays both on a two-point line. Mines: one blast, never harms its own side, invisible to the other side always.
- Tripwires: a flare that lights the fog over the spot, plus a small charge.
- Mines are not physics bodies — points the game watches, so a minefield costs the engine nothing and hides by construction.
- The enemy sapper brain seeds its approaches and the contested ground. Mine prices ride the market.

**Task 11 — The manual learns armor (mk1.40)**
- The field manual gains the armor card — your tank, your transport, yours to lose.
- One save/resume audit across everything new: vehicles, riders, mines, the commander profile.

**Close** — a capacity check (two hulls a side plus minefields, measured under the ramp's ceiling), then the owner's playtest closes the phase.
