# ARMOR & DEMOLITION — phase plan (P7)

*2026-08-14. Governs the mk1.3x series. Every ruling in the decision record's "Armor & Demolition (P7)" section binds this plan; nothing there is open. Interface work ships phone AND desktop, every task. Sounds audition on the soundboard.*

**STATUS (2026-08-14): SKELETON ONLY — served to the owner, NOT yet approved. No task is populated; no agent may dispatch off this document. Next steps, in order: (1) the owner rules on the skeleton; (2) the orchestrator completes the FULL reading pass it still owes — core.js whole, DepotGame.jsx whole, squads.js, state.js, specs.js, intel.js, economy.js (units.js, ai.js, sight.js, territory.js, save.js, market.js were read in full 2026-08-14; core/ContractSandbox/renderer only in regions) — before Task 1 is populated; (3) Task 1 is written at full standing-orders detail and served for approval.**

**Architecture notes from the 2026-08-14 reading (for the plan writer):** the engine's `stepDrive`/`aiDrive`/`driveHull` (core.js ~916-971) already drive ANY vehicle carrying `b.squad` (goal-seek) or the possessed `world.bisonId` (via `world.control`) — the driver framework is a depot-side ORDER layer that sets goals and triggers, plus one guarded divergence so the depot can command team-1 hulls and possessed vehicles without the demo-global `bisonId` path. The enemy tank driver to re-seat is `units.js` `stepTank` (~117-163). `bisonFire`/`bisonMg`/`recoverBison` exist (core.js 2418/2440/1319). Vehicles are already sight eyes (sight.js SIGHT.vehicle 36) and territory emitters (territory.js EMIT.vehicle). The renderer has `buildBison`/`buildScout`/`buildTruck` and vehicle fog rules (renderer.js ~620-1410); the APC needs one new mesh. Mines are designed as game-layer watched points, NOT physics bodies — no engine cost, invisible by construction; save/resume must carry them.

*The skeleton as served:*

**Task 1 — The motor pool (mk1.30)**
- One driver layer for every vehicle in the war: a goal, steering on the movement grid, a trigger policy. The enemy tank re-seats onto it with behavior pinned identical.
- The one guarded engine line that lets the war command its own hulls (the engine's tread physics and goal-seek already drive any vehicle — the depot just couldn't own one until now).

**Task 2 — The Bison musters (mk1.31)**
- One Bison parked at each depot at war start.
- Yours is a full citizen: radial orders (defend, move, patrol, escort a squad) and TAKE CONTROL — twin-stick drive, the main gun, the hull machine gun.
- Tracks brake for your own men; an order takes the safety off. Enemy infantry are crushable — driving through a line is a weapon.

**Task 3 — The APC (mk1.32)**
- The new hull, one at each depot. Four seats: one squad of four or two teams of two.
- LOAD and UNLOAD on the radial. Riders are sealed — no eyes, no fire — and die with the vehicle.
- Same orders, same possession, same track rules as the Bison.

**Task 4 — The enemy learns to drive (mk1.33)**
- The commander profile, drawn once per war from the seed: cautious guards and commits late, bold rides out early, stubborn never leaves home.
- The enemy APC ferries assault squads and sometimes flanks where the roads allow.
- The intel desk may whisper which commander you drew.

**Task 5 — The hero tier (mk1.34)**
- A new top of the manifest opens at a late bell: lost armor can return off the convoy — ruinous, market-walled prices, both sides paying the same table.

**Task 6 — Mines and tripwires (mk1.35)**
- The sapper team lays both on a two-point line. Mines: one blast, never harms its own side, invisible to the other side always.
- Tripwires: a flare that lights the fog over the spot, plus a small charge.
- Mines are not physics bodies — points the game watches, so a minefield costs the engine nothing and hides by construction.
- The enemy sapper brain seeds its approaches and the contested ground. Mine prices ride the market.

**Task 7 — The manual learns armor (mk1.36)**
- The field manual gains the armor card — your tank, your transport, yours to lose.
- One save/resume audit across everything new: vehicles, riders, mines, the commander profile.

**Close** — a capacity check (two hulls a side plus minefields, measured under the ramp's ceiling), then the owner's playtest closes the phase.
