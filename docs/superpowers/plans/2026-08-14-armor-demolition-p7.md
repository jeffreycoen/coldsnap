# ARMOR & DEMOLITION — phase plan (P7)

*2026-08-14. Governs the mk1.3x series. Every ruling in the decision record's "Armor & Demolition (P7)" section binds this plan; nothing there is open. Interface work ships phone AND desktop, every task. Sounds audition on the soundboard.*

**STATUS (2026-08-14, second session): the reading debt is PAID — the orchestrator read the full list fresh this session (core.js whole; all 17 files of src/depot/ whole; the sandbox twin-stick drive; the renderer vehicle regions; the depot-test harness and nearby blocks). Task 1 is WRITTEN below at full detail, served to the owner, NOT yet approved. No agent may dispatch until the owner approves it. Tasks 2-7 remain skeleton.**

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

**Task 4 — Runners and breakers for both sides (mk1.33)** *(added by the owner's 2026-08-14 ruling — see the decision record)*
- The runner and breaker join the player's production list at tier 1, mirroring the enemy's tier 1.
- Runner squads of 4 with a per-type march speed (they actually run); breaker squads of 2 with the symmetric ram — they grind enemy masonry by contact, the same rule the enemy's use.

**Task 5 — The enemy learns to drive (mk1.34)**
- The commander profile, drawn once per war from the seed: cautious guards and commits late, bold rides out early, stubborn never leaves home.
- The enemy APC ferries assault squads and sometimes flanks where the roads allow.
- The intel desk may whisper which commander you drew.

**Task 6 — The hero tier (mk1.35)**
- A new top of the manifest opens at a late bell: lost armor can return off the convoy — ruinous, market-walled prices, both sides paying the same table.

**Task 7 — Mines and tripwires (mk1.36)**
- The sapper team lays both on a two-point line. Mines: one blast, never harms its own side, invisible to the other side always.
- Tripwires: a flare that lights the fog over the spot, plus a small charge.
- Mines are not physics bodies — points the game watches, so a minefield costs the engine nothing and hides by construction.
- The enemy sapper brain seeds its approaches and the contested ground. Mine prices ride the market.

**Task 8 — The manual learns armor (mk1.37)**
- The field manual gains the armor card — your tank, your transport, yours to lose.
- One save/resume audit across everything new: vehicles, riders, mines, the commander profile.

**Close** — a capacity check (two hulls a side plus minefields, measured under the ramp's ceiling), then the owner's playtest closes the phase.

---

# Task 1 — The motor pool (mk1.30) — FULL PLAN

**What it does, in one line:** a new depot module (`src/depot/drivers.js`) becomes the one driver layer for every vehicle in the war — a goal policy and a guns policy per driver — the enemy tank re-seats onto it with behavior pinned byte-identical, and one guarded engine branch lets the war command its own hulls.

**What it does NOT do:** no player vehicle fields (Task 2), no orders on the radial, no possession wiring. Task 1 lands the machinery and proves it.

**Suggested model:** Sonnet 5 — a verbatim code move plus one small guarded branch, every line written here.

**Required reading (re-verified at dispatch):**
- `src/depot/units.js` whole (621 lines)
- `src/engine/core.js` 389-402 (makeWorld's control field), 916-971 (driveHull / aiDrive / stepDrive)
- `src/depot/DepotGame.jsx` 9-31 (imports), 916-923 (stepEnemies), 958-1085 (stepDepot)
- `src/depot/state.js` 13-53 (fieldReaches / effRange), 331-419 (shooterFire), 489-497 (hostileStructure)
- `src/depot/accuracy.js` 110-146 (marchArc / arcClears)
- `src/depot/lists.js` whole
- `src/depot/save.js` 54-118 (plainValue / the generic body sweep), 264-271 (parseFront's mark refusal)
- `src/depot/specs.js` 72-104 (TANK, ENEMY_FIRE)
- `scripts/depot-test.mjs` 1-70 (harness), 1147-1175 (the effRange grep pin), 6340-6358 (tail)
- `src/ui/Roadmap.jsx` 14-29 (PHASES)
- `src/version.js` whole

**Trap notes:**
- depot-test.mjs ~1169 pins EXACTLY 3 `effRange(world, muzzle, fspec)` sites in units.js. Moving the tank makes it 2 + 1 in drivers.js. Re-pin honestly (Step 8); never leave dead code to satisfy a grep.
- Draw ORDER is a contract: at mk1.21 tanks drew from world.rng BEFORE infantry (the tank loop ran first inside stepUnits). stepDrivers must therefore run BEFORE stepUnits. The pin fixture proves it.
- `b.drv`, `b.depotDrive`, `b.goal` ride the save's generic scalar sweep for free (save.js plainValue). `b.ctl` is dropped by plainValue (mixed types) — correct, it is a per-tick cache. No save.js edits. Old saves need no migration: parseFront refuses any save not stamped mk1.30.
- drivers.js imports state.js/accuracy.js — the same documented-safe deferred cycle units.js already lives in. No top-level cross calls.
- core.js is under the guarded-divergence law: the new branch is depotCombat-gated, carries the DIVERGENCE comment, and golden.mjs must stay green.
- Touch nothing in stepStatus, nothing bisonId-flavored. The demo-global bisonId path is not this task's business.

## Step 1 — The pin, captured before anything moves

Append the P7 T1 block to `scripts/depot-test.mjs` immediately before the final `if (fails.length)` check (line ~6353). It runs the wave tank's whole life on the CURRENT path and pins the world hash and rng draw count. Run `node scripts/depot-test.mjs` once with the two `PIN_*` literals as `console.log` captures, then lock the printed values in as literals. The report states both numbers.

```js
// ==== P7 T1: THE MOTOR POOL ==================================================
// The pin: the wave tank's whole life — flow march, lost-clock, gun scan,
// shell fire — byte-identical after the re-seat. Hash and draws captured on
// the mk1.21 stepUnits path; the motor pool must not move either number.
{
  const field = makeField(80, 1.7, 5);
  const world = makeWorld({ field, seed: 91 });
  world.depotCombat = true; world._tdStruct = true;
  let draws = 0;
  const baseRng = world.rng;
  world.rng = () => { draws++; return baseRng(); };
  const grid = straightGrid(0, 1);
  spawnUnit(world, { x: 0, z: -30 }, "tank");
  spawnWallCourses(world, 0, field.heightAt(0, 6), 6, 0);
  for (let i = 0; i < 1200; i++) {
    stepUnits(world, grid, identFwdDir, null);   // Step 7 flips this line to the motor pool
    stepWorld(world);
  }
  ok("T1 pin: tank fixture hash unmoved", worldHash(world) === PIN_HASH, worldHash(world));
  ok("T1 pin: tank fixture draw count unmoved", draws === PIN_DRAWS, draws);
  ok("T1 pin: the gun actually fired (fixture is live, not vacuous)",
    world.events.filter((e) => e.type === "boom").length > 0);
}
// ==== end P7 T1 ==============================================================
```

## Step 2 — The engine asserts, written failing first

In the same block, after the pin fixture, the guarded branch's contract — these FAIL until Step 3 lands:

```js
// The guarded line: the war commands its own hulls. depotCombat + b.depotDrive
// only — the demo, tower defense, and every parked hull are byte-identical.
{
  const field = makeField(80, 1.7, 5);
  const mk = (depot) => {
    const w = makeWorld({ field, seed: 7 });
    if (depot) w.depotCombat = true;
    const v = addBody(w, { kind: "vehicle", team: 1, mass: 3800, hx: 2.2, hy: 0.95, hz: 3.3, x: 0, z: 0, y: field.heightAt(0, 0) + 0.97, hp: 1e9, friction: 0.85 });
    return { w, v };
  };
  { // "auto": the game layer writes a goal, the engine steers and drives to it
    const { w, v } = mk(true);
    v.depotDrive = "auto"; v.goal = { x: 0, z: 20 };
    for (let i = 0; i < 1200; i++) stepWorld(w);
    ok("T1 engine: an auto hull drives to its goal", Math.hypot(v.pos.x, v.pos.z - 20) < 3, v.pos.z.toFixed(1));
  }
  { // "manual": the game layer wrote b.ctl itself — the treads answer it
    const { w, v } = mk(true);
    v.depotDrive = "manual"; v.ctl = { throttle: 1, steer: 0, brake: false };
    for (let i = 0; i < 600; i++) stepWorld(w);
    ok("T1 engine: a manual hull answers the stick", v.pos.z > 8, v.pos.z.toFixed(1));
  }
  { // the guard: without depotCombat the same fields are inert
    const { w, v } = mk(false);
    v.depotDrive = "auto"; v.goal = { x: 0, z: 20 };
    for (let i = 0; i < 600; i++) stepWorld(w);
    ok("T1 engine: without depotCombat the branch never runs", Math.abs(v.pos.z) < 0.5, v.pos.z.toFixed(1));
  }
  { // the old contract, re-asserted: a hull with no driver stays parked
    const { w, v } = mk(true);
    for (let i = 0; i < 600; i++) stepWorld(w);
    ok("T1 engine: a driverless hull stays parked", Math.abs(v.pos.z) < 0.5, v.pos.z.toFixed(1));
  }
}
```

## Step 3 — The one guarded engine branch

`src/engine/core.js` stepDrive (:958-971). Insert the new branch between the `b.squad` branch and `else continue`:

```js
    } else if (b.squad) {
      if (!b.ctl) b.ctl = { throttle: 0, steer: 0, brake: false };
      aiDrive(world, b);
    } else if (world.depotCombat && b.depotDrive) {
      // DIVERGENCE (guarded, mk1.30 P7 T1): THE WAR COMMANDS ITS OWN HULLS.
      // A depot vehicle carrying b.depotDrive is driven here: "auto" — the
      // game layer wrote b.goal (an order) and aiDrive steers to it;
      // "manual" — the game layer wrote b.ctl itself this tick (possession
      // sticks, Task 2). Guarded on world.depotCombat and a field no demo/
      // TD/campaign body ever carries, so every other mode is byte-identical
      // (golden proves it).
      if (!b.ctl) b.ctl = { throttle: 0, steer: 0, brake: false };
      if (b.depotDrive === "auto") aiDrive(world, b);
    } else continue; // parked hulls (scouts, depot) stay untouched
```

Run gates: `node scripts/golden.mjs` green; the Step 2 asserts pass; the Step 1 pin still passes (nothing moved yet).

## Step 4 — drivers.js, the motor pool

New file `src/depot/drivers.js`. The tank policy is stepTank's body moved VERBATIM (units.js :117-163), split at its natural seam into goal and guns; the original comments travel with their lines.

```js
// COLDSNAP DEPOT — drivers.js: THE MOTOR POOL (P7 T1, mk1.30). The one
// driver layer for every vehicle in the war. A driver is a GOAL policy
// (where the hull wants to be — written to b.goal; the engine's aiDrive
// steers and driveHull drives) and a GUNS policy (what its weapon does
// about what it sees). The engine keeps all tread physics; this module only
// sets goals and pulls triggers. A body names its driver with b.drv (a
// plain string — rides the save's generic scalar sweep); bodies without one
// are not the pool's business. Every draw is world.rng(); iteration is
// world.bodies order — deterministic. Future vehicles (the depot Bison,
// the APC, heroes) add a DRIVERS row, never a second loop.
import { applyDamage } from "../engine/core.js";
import { shooterFire, fieldReaches, effRange, hostileStructure } from "./state.js";
import { arcClears } from "./accuracy.js";
import { ENEMY_FIRE } from "./specs.js";

// ---- the wave tank — re-seated from units.js stepTank (mk1.30), verbatim.
function tankGoal(world, grid, t, dt, fwdDir) {
  const cell = grid && grid.cellAt(t.pos.x, t.pos.z);
  if (cell && cell.dist < 1e8 && (cell.dx || cell.dz)) {
    const fd = fwdDir(cell.dx, cell.dz);
    t.goal = { x: t.pos.x + fd.x * 9, z: t.pos.z + fd.z * 9 };
    t.lostT = 0;
  } else {
    // off-grid write-off: same 12s window infantry uses. Without this a
    // tank that wanders off the flow field keeps driving forever — no leak
    // radius ever catches it, and it never dies. Mirrors the infantry lostT.
    t.lostT = (t.lostT || 0) + dt;
    if (t.lostT > 12) applyDamage(world, t, 1e9, { attacker: "world" });
  }
}
function tankGuns(world, t, dt, T, toUV) {
  t.gunT = (t.gunT || 0) - dt;
  if (t.gunT > 0) return;
  const fspec = ENEMY_FIRE.tank;
  const muzzle = { x: t.pos.x, y: t.pos.y + 1.2, z: t.pos.z };
  const eR = effRange(world, muzzle, fspec);
  let tgt = null, td = eR * eR;
  const pool = world._L ? world._L.structsFor2 : world.bodies; // T10
  for (const s of pool) {
    // FRONT F1 (4c): the shared hostile-structure set — towers, walls,
    // depot masonry. VISION (mk0.72): structures obey the one law too —
    // you shoot what your side sees.
    if (!hostileStructure(s, 2)) continue;
    const c = toUV(s.pos.x, s.pos.z);
    if (!fieldReaches(T, c.u, c.v, 2)) continue;
    const dx = s.pos.x - t.pos.x, dz = s.pos.z - t.pos.z, d2 = dx * dx + dz * dz;
    if (d2 < td && arcClears(world, muzzle, s.pos, fspec, t.id)) { td = d2; tgt = s; }
  }
  if (!tgt) { t.gunT = 0.5; return; }
  t.gunT = fspec.cd + world.rng() * (fspec.cdVar || 0);
  // owner: t.id — the muzzle sits inside the tank's own hitbox and
  // hitStruct is required to hit the target at all; without owner immunity
  // the round detonates on its own hull on the first tick, every time
  // (found by the tank-vs-tower fixture; full note in the mk1.21 units.js).
  shooterFire(world, t, muzzle, tgt, fspec, { attacker: "enemy", hitStruct: true, owner: t.id });
}

export const DRIVERS = {
  waveArmor: { goal: tankGoal, guns: tankGuns },
};

// stepDrivers: once per sim tick, BEFORE stepUnits — tanks drew from
// world.rng before infantry at mk1.21 and the draw-order contract holds.
export function stepDrivers(world, grid, fwdDir, T, toUV = (x, z) => ({ u: x, v: z })) {
  const dt = world.dt;
  for (const b of world.bodies) {
    if (b.kind !== "vehicle" || !b.alive) continue;
    const d = DRIVERS[b.drv];
    if (!d) continue;
    d.goal(world, grid, b, dt, fwdDir);
    d.guns(world, b, dt, T, toUV);
  }
}
```

## Step 5 — units.js hands the tank over

Three edits, nothing else in the file moves:
- `spawnTank` (:64-77): after the `t.squad = "waveArmor";` line add:
```js
  t.drv = "waveArmor"; // P7 T1: the motor pool's policy key (drivers.js)
```
- Delete `stepTank` whole, including its section comment (:113-163).
- Delete the tank loop at the top of `stepUnits` (:490-494, the `// wave armor` comment and the `for` loop). No import changes — everything stepTank used is still used by the rifleman/grenadier/sapper code.

## Step 6 — DepotGame wires the pool in

`src/depot/DepotGame.jsx`:
- Imports (:23): `import { stepUnits, spawnUnit, stepBreakerRam, payBounties } from "./units.js";` gains a sibling line:
```js
import { stepDrivers } from "./drivers.js";
```
- `stepEnemies` (:916-923) becomes:
```js
// March + combat drivers. Vehicles first (drivers.js — the motor pool,
// mk1.30), then infantry (units.js) — the mk1.21 order, tanks before men,
// which is also the rng draw-order contract. DepotGame supplies the flow
// field and the orientation-aware fwdDir/invW.
function stepEnemies(world, grid, T) {
  stepDrivers(world, grid, fwdDir, T, invW);
  stepUnits(world, grid, fwdDir, T, invW);
}
```

## Step 7 — The pin flips to the new path

In the Step 1 fixture, the driver line becomes:

```js
    stepDrivers(world, grid, identFwdDir, null);
    stepUnits(world, grid, identFwdDir, null);
```

(depot-test's import list gains `stepDrivers` from `../src/depot/drivers.js`.) `PIN_HASH` and `PIN_DRAWS` DO NOT CHANGE — that is the whole pin. If either moves, the re-seat is wrong; fix the code, never the literals.

## Step 8 — The effRange grep pin re-taught (named re-pin)

`scripts/depot-test.mjs` :1164-1170. Old: units.js has exactly 3 `effRange(world, muzzle, fspec)` sites. New: 2 in units.js (rifle, grenadier) + 1 in drivers.js (the tank). Replace the block's two `ok(...)` lines with:

```js
    const unitsSrc = fs.readFileSync(new URL("../src/depot/units.js", import.meta.url), "utf8");
    const driversSrc = fs.readFileSync(new URL("../src/depot/drivers.js", import.meta.url), "utf8");
    ok("units.js imports effRange from state.js", /import\s*\{[^}]*effRange[^}]*\}\s*from\s*"\.\/state\.js"/.test(unitsSrc));
    ok("units.js's rifle/grenadier scans consume effRange (not raw spec.range)", (unitsSrc.match(/effRange\(world,\s*muzzle,\s*fspec\)/g) || []).length === 2);
    ok("drivers.js's tank scan consumes effRange (re-pinned mk1.30 — stepTank moved to the motor pool)", (driversSrc.match(/effRange\(world,\s*muzzle,\s*fspec\)/g) || []).length === 1);
```

Also `src/depot/territory.js` :75, comment only — `stepTank` no longer lives in units.js:
```js
// shooters (units.js's stepRifleman/stepGrenadier, drivers.js's tank) call — a target
```

## Step 9 — Version and the roadmap flip

- `src/version.js`: `MK = "mk1.21"` → `"mk1.30"`.
- `src/ui/Roadmap.jsx` PHASES (:22-23): flip Troops & Physics to DONE and insert the new phase card after it (the fold-in convention — P7's Task 1 commit carries the flip):
```js
  { name: "Troops & Physics", status: "DONE", desc: "Squads that walk around things, an economy that breathes, a lighter engine." },
  { name: "Armor & Demolition", status: "IN PROGRESS", desc: "A tank and a transport for each side, one driver seat for every hull, mines under the snow." },
```

## Step 10 — Gates, build, deploy

Run ONLY these: `node scripts/depot-test.mjs` (all green, pin literals unmoved), `node scripts/golden.mjs`, `node scripts/depot-lint.mjs`. Then build (AFTER the bump), deploy, commit. No scripted playtesting. The owner checks the roadmap flip live (`?roadmap=1`) — the one visible change this task ships.

**Report format:** one line of outcome; the pin values (hash, draws) stated; every re-pin old→new named (the effRange grep 3 → 2+1 is expected); any nonconformity its own bullet.

*(Task 1 SHIPPED 2026-08-14, commit e32a3e1 — see the decision record.)*

---

# Task 2 — The Bison musters (mk1.31) — FULL PLAN

**What it does, in one line:** one Bison parks at each depot at war start; yours is a full citizen — radial orders (DEFEND, MOVE, PATROL, ESCORT), a TRACKS safety toggle with an indicator bulb, and TAKE CONTROL with twin-stick drive, main gun, and hull machine gun, phone and desktop both; the enemy's sits parked and killable until its commander arrives (Task 5).

**Rulings embedded (all owner, 2026-08-14):** desktop coax = hold right mouse button (left click stays the main gun); overrun safety is OFF under possession (the possessed-tower precedent — your stick, your responsibility); the hull carries an indicator bulb — GREEN with the safety on (tracks CAREFUL), RED with it off (FREE).

**Suggested model:** Sonnet 5 — large but fully specced; every mechanism mirrors an existing pattern (tank driver, squad orders, possession machinery).

**Required reading (re-verified at dispatch):**
- This Task 2 section, whole; the decision record's P7 section.
- `src/depot/drivers.js` whole (as landed by Task 1).
- `src/depot/DepotGame.jsx` — the boot block (~:1259-1560), planRoute/stepSquadRouting (~:602-686), stepDepot (~:958-1086), buildEmitters (~:1413-1439), tapAt/consumeOrderTap (~:2284-2498), pointer handlers (~:2500-2560), the possession machinery (~:1968-2038, frame loop ~:3130-3200, trigger ~:3335-3350), the radial JSX (~:3966-4082), possession buttons JSX (~:3746-3810).
- `src/depot/state.js` — executeWithdrawal (:1471-1483), possessedVolley/possessedTowerFire (:651-700), snapTargetNear (:611-623).
- `src/depot/market.js` whole. `src/depot/specs.js` :72-104. `src/depot/squads.js` :69-75 (makeSquad shape), :169-191 (slotBlocked/clearSlot exports).
- `src/depot/sight.js` :19-35 (SIGHT/eyeOf), :159-183 (reticle rules).
- `src/render/renderer.js` :620-686 (buildBison/buildTruck/buildScout), :1396-1436 (vehicle sync).
- `src/game/ContractSandbox.jsx` :505-529 (the twin-stick hull math — the exact steering formula to port).
- `scripts/depot-test.mjs` :1-70 (harness), :5901-6028 (P6 T1 routing block), the P7 T1 block (tail).
- `src/depot/save.js` :54-118. `src/version.js`.

**Trap notes (binding):**
1. planRoute moves OUT of DepotGame.jsx into a new `src/depot/route.js` (drivers.js must not import a React component module). Verbatim move; DepotGame imports it back. Check depot-test for any existing planRoute access first (none is expected — it was never exported).
2. The enemy Bison spawns in this task but has NO driver (no `drv`) — it parks until Task 5 seats its commander. It must NOT: withdraw with a spent assault (executeWithdrawal exemption, Step 5), price the tank market family (marketCounts guard, Step 5), or drive.
3. Order of tap consumption in tapAt is load-bearing: linePending → squad order taps → VEHICLE order taps (escort must catch its squad tap BEFORE squad selection would steal it) → squad select → vehicle select → deselect.
4. All vehicle order state lives ON the body as plain scalars/flat objects (`order`, `dest`, `_patA`, `_patB`, `escortId`, `tracks`, `vtype`, `drv`, `depotDrive`) — rides the save's generic sweep; NO save.js edits. `_route` is an array of objects — plainValue drops it; correct, it re-derives.
5. The safety brake works through Task 1's own mechanism: blocked → `depotDrive = "manual"` + `ctl {0,0,brake:true}`; clear → back to `"auto"`. No engine edits anywhere in this task; golden is not run (core.js untouched — if you find yourself editing core.js, stop and report).
6. No new rng draws: the Bison's gun has no cdVar (deterministic cadence); scatter's 2 draws per shot ride shooterFire as everywhere.
7. Possession: stepDrivers must SKIP a possessed hull (decay its cooldowns, drive nothing, fire nothing) — the stepTowers precedent.
8. The demo path must stay byte-identical: buildBison(team) defaults to today's palette when team is undefined; the turret-yaw change falls back to the demo's `turretYaw` when `b._aimYaw` is absent; golden does not cover the renderer, so parity here is by construction, stated in the report.
9. Renderer turret yaw: local turret rotation = world aim azimuth MINUS hull yaw (`Math.atan2(b.R[6], b.R[8])`) — the group already carries the hull quaternion.

## Step 1 — Asserts first (failing)

Append the P7 T2 block to `scripts/depot-test.mjs` before the final fails check. Imports gain: `BISON, BISON_FIRE` from specs.js; `stepDrivers` already imported (T1); `possessedArmorFire, possessedArmorMg` from drivers.js; `planRoute` from route.js; `marketCounts` alias via the existing `mkt` import pattern used by T11 (check how T11 imports market.js and match it).

```js
// ==== P7 T2: THE BISON MUSTERS ==============================================
{
  const flatF = { heightAt: () => 0, dirty: false, normalAt: (x, z, o) => { o.x = 0; o.y = 1; o.z = 0; return o; } };
  // a real little grid: 30x30 cells of 2m centered on the origin, cellAt/
  // worldToGrid/gridToWorld in DepotGame's own shape, with a block list.
  const mkGrid = (blocked = []) => {
    const W = 30, H = 30, CS = 2, OX = -30, OZ = -30;
    const cells = Array.from({ length: W * H }, () => ({ blocked: false, ice: false, water: false, wallId: null, dist: 1, dx: 0, dz: 1 }));
    for (const [gx, gz] of blocked) cells[gz * W + gx].blocked = true;
    return { cells, w: W, h: H, cs: CS, ox: OX, oz: OZ,
      idx: (gx, gz) => gz * W + gx,
      inBounds: (gx, gz) => gx >= 0 && gx < W && gz >= 0 && gz < H,
      worldToGrid: (x, z) => ({ gx: Math.floor((x - OX) / CS), gz: Math.floor((z - OZ) / CS) }),
      gridToWorld: (gx, gz) => ({ x: OX + (gx + 0.5) * CS, z: OZ + (gz + 0.5) * CS }),
      cellAt(x, z) { const g = this.worldToGrid(x, z); return this.inBounds(g.gx, g.gz) ? cells[this.idx(g.gx, g.gz)] : null; } };
  };
  const mkVeh = (w, team, x, z) => {
    const v = addBody(w, { kind: "vehicle", team, mass: BISON.mass, hx: BISON.hx, hy: BISON.hy, hz: BISON.hz, x, y: BISON.hy + 0.05, z, hp: BISON.hp, friction: 0.85 });
    v.armor = BISON.armor; v.vtype = "bison"; v.drv = "armor"; v.depotDrive = "auto"; v.tracks = "careful"; v.order = "defend";
    return v;
  };
  const idUV = (x, z) => ({ u: x, v: z });
  const run = (w, grid, n, opts) => { for (let i = 0; i < n; i++) { stepDrivers(w, grid, identFwdDir, null, idUV, opts || {}); stepWorld(w); } };

  { // (a) DEFEND holds; (b) MOVE routes and arrives, order flips to defend
    const w = makeWorld({ field: flatF, seed: 11 }); w.depotCombat = true;
    const v = mkVeh(w, 1, 0, -20);
    run(w, mkGrid(), 300);
    ok("T2(a): a defending Bison holds its ground", Math.hypot(v.pos.x, v.pos.z + 20) < 1, v.pos.z.toFixed(1));
    v.order = "move"; v.dest = { x: 0, z: 20 };
    run(w, mkGrid(), 2400);
    ok("T2(b): MOVE arrives and digs in", Math.hypot(v.pos.x, v.pos.z - 20) < 4 && v.order === "defend", `${v.pos.z.toFixed(1)}/${v.order}`);
  }
  { // (c) the route detours: a wall of blocked cells across the straight line
    const blocked = []; for (let gx = 9; gx <= 20; gx++) blocked.push([gx, 15]);
    const w = makeWorld({ field: flatF, seed: 12 }); w.depotCombat = true;
    const v = mkVeh(w, 1, 0, -20);
    v.order = "move"; v.dest = { x: 0, z: 20 };
    run(w, mkGrid(blocked), 3600);
    ok("T2(c): the route walks around the blocked band", Math.hypot(v.pos.x, v.pos.z - 20) < 4, `${v.pos.x.toFixed(1)},${v.pos.z.toFixed(1)}`);
  }
  { // (d) THE OVERRUN SAFETY: a friendly in the lane stops the hull; FREE rolls on
    const trial = (tracks) => {
      const w = makeWorld({ field: flatF, seed: 13 }); w.depotCombat = true;
      const v = mkVeh(w, 1, 0, -20); v.tracks = tracks;
      const man = addBody(w, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x: 0, y: 0.74, z: -8, hp: 58, friction: 0.5 });
      v.order = "move"; v.dest = { x: 0, z: 20 };
      run(w, mkGrid(), 1500);
      return { v, man };
    };
    const careful = trial("careful");
    ok("T2(d): CAREFUL tracks brake for their own man", careful.man.alive && careful.v.pos.z < -10, `z=${careful.v.pos.z.toFixed(1)} alive=${careful.man.alive}`);
    const free = trial("free");
    ok("T2(d2): FREE tracks roll through", free.v.pos.z > -6, free.v.pos.z.toFixed(1));
  }
  { // (e) the guns: main gun works a conscript, the coax streams — both fire
    const w = makeWorld({ field: flatF, seed: 14 }); w.depotCombat = true;
    const v = mkVeh(w, 1, 0, 0);
    spawnUnit(w, { x: 0, z: 14 }, "");
    run(w, mkGrid(), 600);
    const booms = w.events.filter((e) => e.type === "boom").length;
    ok("T2(e): the Bison's guns fire on a seen enemy", booms > 0, `${booms} booms`);
  }
  { // (f) ESCORT trails the squad, offset back — never parked inside the ring
    const w = makeWorld({ field: flatF, seed: 15 }); w.depotCombat = true;
    const v = mkVeh(w, 1, 0, -15);
    const sq = makeSquad(1, "rifles", 1, 10, 5);
    v.order = "escort"; v.escortId = 1;
    run(w, mkGrid(), 1200, { squads: [sq] });
    const d = Math.hypot(v.pos.x - 10, v.pos.z - 5);
    ok("T2(f): the escort closes to a trailing offset", d > 2 && d < 9, d.toFixed(1));
  }
  { // (g) the parked enemy Bison is not wave stock
    const w = makeWorld({ field: flatF, seed: 16 }); w.depotCombat = true;
    const eb = mkVeh(w, 2, 0, 30); delete eb.drv; eb.bounty = BISON.bounty;
    const tank = spawnUnit(w, { x: 5, z: 30 }, "tank");
    const S2 = makeRunState(); S2.reg = fatReg();
    executeWithdrawal(S2, w);
    ok("T2(g): withdrawal sweeps the wave tank, spares the Bison", !w.byId.has(tank.id) && w.byId.has(eb.id));
    const counts = (await import("../src/depot/market.js")).marketCounts(w, []);
    ok("T2(g2): the Bison prices no tank family", !counts.tank, JSON.stringify(counts.tank));
  }
  { // (h) the possessed triggers: cooldown-gated, one shell per cd
    const w = makeWorld({ field: flatF, seed: 17 }); w.depotCombat = true;
    const v = mkVeh(w, 1, 0, 0);
    const f1 = possessedArmorFire(w, v, { x: 0, z: 15 }, null, idUV);
    const f2 = possessedArmorFire(w, v, { x: 0, z: 15 }, null, idUV);
    ok("T2(h): main gun fires once then waits out its cd", f1 === true && f2 === false && v.gunT > 0);
    const m1 = possessedArmorMg(w, v, { x: 0, z: 12 }, null, idUV);
    ok("T2(h2): the coax is its own trigger and cd", m1 === true && v.mgT > 0);
  }
  { // (i) twin determinism: same seed, same field, identical hash
    const twin = () => {
      const w = makeWorld({ field: flatF, seed: 18 }); w.depotCombat = true;
      const v = mkVeh(w, 1, 0, -10); v.order = "move"; v.dest = { x: 4, z: 16 };
      spawnUnit(w, { x: 0, z: 20 }, "");
      run(w, mkGrid(), 900);
      return worldHash(w);
    };
    ok("T2(i): twin runs agree", twin() === twin());
  }
}
// ==== end P7 T2 ==============================================================
```

(Note: if top-level `await import` fights the harness, import marketCounts at the file head instead — match the file's existing import style.)

## Step 2 — specs.js: the Bison's table

After `TANK` (:75):

```js
// P7 T2 (mk1.31): THE BISON — the starting hero tank, one parked at each
// depot at war start. ONE row, both sides — symmetry is law; the enemy's is
// this same machine (its commander arrives in Task 5). Killable and dear:
// replacement is the hero tier's business. All dials provisional (F5).
export const BISON = { mass: 3800, hx: 2.2, hy: 0.95, hz: 3.3, hp: 420, armor: 160, bounty: 60 };
// The Bison's guns — every aimed shot through shooterFire like the rest of
// DEPOT. The main gun is the wave tank's round on a hero cadence; the coax
// is the mg family's stream. weapon tags are voice only.
export const BISON_FIRE = {
  gun: { projSpeed: 85, dmg: TANK.dmg, kind: "shell", weapon: "tank", blastR: TANK.blastR, kv: 8, crater: 0.5, acc: 0.070, windF: 0.9, windComp: 0.6, cd: 2.6, range: 30, occl: "arc" },  // provisional (F5)
  mg:  { projSpeed: 100, dmg: 5, dirDmg: 8, kind: "mg", weapon: "mg", blastR: 0.3, kv: 0.5, crater: 0, acc: 0.080, burst: 6, burstGap: 0.17, cd: 1.6, range: 18, occl: "arc", windF: 0.06, windComp: 0 },  // provisional (F5)
};
```

## Step 3 — route.js: planRoute moves out

New file `src/depot/route.js`: the header comment below, then `planRoute` moved VERBATIM from DepotGame.jsx (:608-650), exported. DepotGame deletes its local copy and adds `import { planRoute } from "./route.js";`. No behavior change.

```js
// src/depot/route.js — planRoute, moved verbatim out of DepotGame.jsx (P7
// T2): the motor pool routes hulls on the same movement grid squads march,
// and drivers.js must not import a React component module. P6 T1's design
// note rides with it: breadth-first from the start cell, 8-way with the
// flow field's corner rule, honest clamp to the closest reachable cell,
// thinned to turning points. Deterministic, zero rng.
```

## Step 4 — drivers.js: the armor policy and the possessed triggers

Imports gain: `planRoute` from route.js; `BISON_FIRE` from specs.js; `snapTargetNear, POSSESS_ACC` from state.js.

```js
// ---- the depot's own armor (P7 T2, mk1.31): the full-citizen driver.
// Orders live ON the body (order/dest/_patA/_patB/escortId/tracks — plain
// scalars and flat objects, they ride the save's generic sweep): DEFEND
// holds, MOVE and PATROL run planRoute legs on the movement grid with the
// squads' own stall watch, ESCORT trails a squad at a respectful offset.
// THE OVERRUN SAFETY (owner): under tracks "careful" (the default) the hull
// brakes rather than roll over its OWN side's men — it flips depotDrive to
// "manual" with the brake on while blocked, back to "auto" when the lane
// clears (Task 1's own mechanism, no engine edit). "free" takes the safety
// off; enemy infantry are crushable either way — that is the weapon.
// Team-agnostic throughout: the enemy's Bison rides this exact policy when
// Task 5 seats its commander.
const ARMOR_WP_R = 2.5, ARMOR_ARRIVE = 3.0, ARMOR_ESCORT_BACK = 4;   // provisional (F5)
const SAFETY_AHEAD = 4, SAFETY_SPEED_K = 0.5, SAFETY_HALF_W = 2.8;   // provisional (F5)
function armorSafetyBlocked(world, v) {
  const fx = v.R[6], fz = v.R[8];
  const fl = Math.hypot(fx, fz) || 1;
  const reach = v.hz + SAFETY_AHEAD + Math.hypot(v.v.x, v.v.z) * SAFETY_SPEED_K;
  const pool = world._L ? (v.team === 1 ? world._L.friends : world._L.foes) : world.bodies;
  for (const u of pool) {
    if (u.kind !== "unit" || !u.alive || u.team !== v.team) continue;
    const dx = u.pos.x - v.pos.x, dz = u.pos.z - v.pos.z;
    const ahead = (dx * fx + dz * fz) / fl;
    if (ahead < 0 || ahead > reach) continue;
    if (Math.abs((dx * fz - dz * fx) / fl) < SAFETY_HALF_W) return true;
  }
  return false;
}
function armorGoal(world, grid, v, dt, fwdDir, opts) {
  if (v.tracks !== "free" && armorSafetyBlocked(world, v)) {
    v.depotDrive = "manual";
    v.ctl = { throttle: 0, steer: 0, brake: true };   // the tracks bite — the strong stop
    return;
  }
  v.depotDrive = "auto";
  const order = v.order || "defend";
  if (order === "defend") { v.goal = null; return; }
  if (order === "escort") {
    const sq = opts && opts.squads ? opts.squads.find((q) => q.id === v.escortId) : null;
    if (!sq) { v.order = "defend"; v.goal = null; return; }
    const dx = sq.anchor.x - v.pos.x, dz = sq.anchor.z - v.pos.z, d = Math.hypot(dx, dz) || 1;
    // trail the formation, never park inside it: goal sits ESCORT_BACK short
    // of the anchor on the approach line; inside that band the hull rests.
    v.goal = d > ARMOR_ESCORT_BACK + 2.2
      ? { x: sq.anchor.x - (dx / d) * ARMOR_ESCORT_BACK, z: sq.anchor.z - (dz / d) * ARMOR_ESCORT_BACK }
      : null;
    return;
  }
  if (!v.dest) { v.order = "defend"; v.goal = null; return; }
  // MOVE/PATROL: route legs — stepSquadRouting's shape, carried on the body.
  const destChanged = !v._routeDest || Math.hypot(v._routeDest.x - v.dest.x, v._routeDest.z - v.dest.z) > 0.5;
  const wp0 = v._route && v._route.length ? v._route[0] : v.dest;
  const dWp = Math.hypot(wp0.x - v.pos.x, wp0.z - v.pos.z);
  let stale = false;
  if (!destChanged) {
    if (v._routeD == null || dWp < v._routeD - 0.5) { v._routeD = dWp; v._routeT = 0; }
    else v._routeT = (v._routeT || 0) + dt;
    stale = v._routeT >= 3;
  }
  if (destChanged || stale || !v._route) {
    v._routeD = null; v._routeT = 0;
    const r = planRoute(grid, v.pos.x, v.pos.z, v.dest.x, v.dest.z);
    if (r && !r.reached && r.pts.length) {
      const end = r.pts[r.pts.length - 1];
      if (v.order === "patrol") {   // the honest clamp fixes the loop's endpoint too
        if (v._patA && Math.hypot(v.dest.x - v._patA.x, v.dest.z - v._patA.z) < 0.5) v._patA = { x: end.x, z: end.z };
        else if (v._patB && Math.hypot(v.dest.x - v._patB.x, v.dest.z - v._patB.z) < 0.5) v._patB = { x: end.x, z: end.z };
      }
      v.dest = { x: end.x, z: end.z };
    }
    v._route = r && r.pts.length ? r.pts : null;
    v._routeDest = { x: v.dest.x, z: v.dest.z };
  }
  while (v._route && v._route.length && Math.hypot(v._route[0].x - v.pos.x, v._route[0].z - v.pos.z) < ARMOR_WP_R) v._route.shift();
  const wp = v._route && v._route.length ? v._route[0] : v.dest;
  if (Math.hypot(v.dest.x - v.pos.x, v.dest.z - v.pos.z) <= ARMOR_ARRIVE) {
    if (v.order === "patrol" && v._patA && v._patB) {
      const goingToB = Math.hypot(v.dest.x - v._patB.x, v.dest.z - v._patB.z) < 0.5;
      v.dest = goingToB ? { x: v._patA.x, z: v._patA.z } : { x: v._patB.x, z: v._patB.z };
      v._route = null; v._routeDest = null;
    } else { v.order = "defend"; v.dest = null; v.goal = null; return; }
  }
  v.goal = { x: wp.x, z: wp.z };
}
function armorGuns(world, v, dt, T, toUV) {
  const enemyTeam = v.team === 1 ? 2 : 1;
  const attacker = v.team === 1 ? "player" : "enemy";
  v.gunT = (v.gunT || 0) - dt; v.mgT = (v.mgT || 0) - dt;
  const muzzle = { x: v.pos.x, y: v.pos.y + 1.4, z: v.pos.z };
  const scanFoes = (spec, unitsOnly) => {
    const eR = effRange(world, muzzle, spec);
    const pool = world._L ? (enemyTeam === 2 ? world._L.foes : world._L.friends) : world.bodies;
    let best = null, bd = eR * eR;
    for (const e of pool) {
      if ((e.kind !== "unit" && (unitsOnly || e.kind !== "vehicle")) || !e.alive || e.team !== enemyTeam) continue;
      const dx = e.pos.x - v.pos.x, dz = e.pos.z - v.pos.z, d2 = dx * dx + dz * dz;
      if (d2 >= bd) continue;
      const c = toUV(e.pos.x, e.pos.z);
      if (!fieldReaches(T, c.u, c.v, v.team)) continue;
      if (!arcClears(world, muzzle, e.pos, spec, v.id)) continue;
      bd = d2; best = e;
    }
    return best;
  };
  const scanStructs = (spec) => {
    const eR = effRange(world, muzzle, spec);
    const pool = world._L ? (v.team === 1 ? world._L.structsFor1 : world._L.structsFor2) : world.bodies;
    let best = null, bs = eR * eR;
    for (const s of pool) {
      if (!hostileStructure(s, v.team)) continue;
      const cs = toUV(s.pos.x, s.pos.z);
      if (!fieldReaches(T, cs.u, cs.v, v.team)) continue;
      const dx = s.pos.x - v.pos.x, dz = s.pos.z - v.pos.z, d2 = dx * dx + dz * dz;
      if (d2 >= bs) continue;
      if (!arcClears(world, muzzle, s.pos, spec, v.id)) continue;
      bs = d2; best = s;
    }
    return best;
  };
  if (v.gunT <= 0) {
    const gun = BISON_FIRE.gun;
    let tgt = scanFoes(gun, false), struct = false;
    if (!tgt) { tgt = scanStructs(gun); struct = !!tgt; }
    if (tgt) {
      v.gunT = gun.cd;
      v._aimYaw = Math.atan2(tgt.pos.x - v.pos.x, tgt.pos.z - v.pos.z);
      shooterFire(world, v, muzzle, tgt, gun, struct
        ? { attacker, hitStruct: true, hitOnly: "structure", owner: v.id }
        : { attacker, hitStruct: true, owner: v.id });
    } else v.gunT = 0.5;
  }
  if (v.mgT <= 0) {
    const mg = BISON_FIRE.mg;
    const tgt = scanFoes(mg, true);   // the coax shoots men, not dirt
    if (tgt) {
      v.mgT = mg.cd;
      v._aimYaw = Math.atan2(tgt.pos.x - v.pos.x, tgt.pos.z - v.pos.z);
      shooterFire(world, v, muzzle, tgt, { ...mg, volley: mg.burst }, { attacker, owner: v.id, volleyDelay: mg.burstGap, muzzleStep: 0 });
    } else v.mgT = 0.4;
  }
}
DRIVERS.armor = { goal: armorGoal, guns: armorGuns };
```

`stepDrivers` gains an opts argument and the possessed skip (the stepTowers precedent):

```js
export function stepDrivers(world, grid, fwdDir, T, toUV = (x, z) => ({ u: x, v: z }), opts = {}) {
  const dt = world.dt;
  for (const b of world.bodies) {
    if (b.kind !== "vehicle" || !b.alive) continue;
    const d = DRIVERS[b.drv];
    if (!d) continue;
    if (opts.possessedId === b.id) { b.gunT = (b.gunT || 0) - dt; b.mgT = (b.mgT || 0) - dt; continue; }
    d.goal(world, grid, b, dt, fwdDir, opts);
    d.guns(world, b, dt, T, toUV);
  }
}
```

(tankGoal's signature tolerates the extra opts argument untouched.) The possessed triggers, exported:

```js
// POSSESSION (P7 T2): the owner's two triggers. Same laws as every
// possessed shot — sight-gated at the aim, POSSESS_ACC sharpening, snap to
// a live seen enemy, real cooldowns shared with the auto guns.
export function possessedArmorFire(world, v, aim, T, toUV = (x, z) => ({ u: x, v: z })) {
  const gun = BISON_FIRE.gun;
  v.gunT = v.gunT || 0;
  if (v.gunT > 0) return false;
  const c = toUV(aim.x, aim.z);
  if (!fieldReaches(T, c.u, c.v, v.team)) return false;
  const live = snapTargetNear(world, aim, T, toUV);
  const tgt = live || { pos: { x: aim.x, y: world.field.heightAt(aim.x, aim.z) + 0.9, z: aim.z }, v: { x: 0, y: 0, z: 0 }, hy: 0.9 };
  v.gunT = gun.cd;
  v._aimYaw = Math.atan2(aim.x - v.pos.x, aim.z - v.pos.z);
  shooterFire(world, v, { x: v.pos.x, y: v.pos.y + 1.4, z: v.pos.z }, tgt, { ...gun, acc: gun.acc * POSSESS_ACC }, { attacker: "player", hitStruct: true, owner: v.id });
  return true;
}
export function possessedArmorMg(world, v, aim, T, toUV = (x, z) => ({ u: x, v: z })) {
  const mg = BISON_FIRE.mg;
  v.mgT = v.mgT || 0;
  if (v.mgT > 0) return false;
  const c = toUV(aim.x, aim.z);
  if (!fieldReaches(T, c.u, c.v, v.team)) return false;
  const live = snapTargetNear(world, aim, T, toUV);
  const tgt = live || { pos: { x: aim.x, y: world.field.heightAt(aim.x, aim.z) + 0.9, z: aim.z }, v: { x: 0, y: 0, z: 0 }, hy: 0.9 };
  v.mgT = mg.cd;
  v._aimYaw = Math.atan2(aim.x - v.pos.x, aim.z - v.pos.z);
  shooterFire(world, v, { x: v.pos.x, y: v.pos.y + 1.4, z: v.pos.z }, tgt, { ...mg, acc: mg.acc * POSSESS_ACC, volley: mg.burst }, { attacker: "player", owner: v.id, volleyDelay: mg.burstGap, muzzleStep: 0 });
  return true;
}
```

## Step 5 — Two guards: withdrawal and the market

`state.js` executeWithdrawal (:1474), after the team filter line:
```js
    if (b.vtype === "bison") continue; // P7 T2: starting armor is not wave stock — it neither withdraws nor refunds a tank
```
`market.js` marketCounts (:45):
```js
    else if (b.kind === "vehicle" && b.team === 2 && b.tag === "tank") add("tank", 1); // P7 T2: only wave armor prices the tank family
```

## Step 6 — DepotGame: spawn, wiring, orders, possession, both platforms

**(a) Boot spawn** — in the `if (!RES)` block, after the seeded-sandbag ring. Draw-free (fixed ring scan). Enemy's parks driverless.
```js
        // P7 T2: THE STARTING ARMOR — one Bison parked by each depot.
        // Draw-free: fixed radii out, sixteen azimuths around, first clear
        // cell wins. Deterministic; no rng stream is touched.
        const parkBison = (team, depotT) => {
          if (!depotT) return;
          for (let rr = 9; rr <= 15; rr += 1.5) for (let k = 0; k < 16; k++) {
            const az = (k / 16) * Math.PI * 2;
            const bx = depotT.x + Math.sin(az) * rr, bz = depotT.z + Math.cos(az) * rr;
            const cell = grid.cellAt(bx, bz);
            if (!cell || cell.blocked || cell.ice || cell.water || cell.wallId) continue;
            if (Math.hypot(bx - OBJ_POS.x, bz - OBJ_POS.z) < 4) continue;
            if (slotBlockedPublic(world, bx, bz, Math.hypot(BISON.hx, BISON.hz) + 0.5)) continue;
            const v = addBody(world, { kind: "vehicle", team, mass: BISON.mass, hx: BISON.hx, hy: BISON.hy, hz: BISON.hz,
              x: bx, y: field.heightAt(bx, bz) + BISON.hy + 0.05, z: bz, hp: BISON.hp, friction: 0.85,
              q: heading(null, Math.atan2(-bx, -bz)) });   // parked facing the valley
            v.armor = BISON.armor; v.vtype = "bison"; v.maxHp = BISON.hp;
            if (team === 1) { v.drv = "armor"; v.depotDrive = "auto"; v.order = "defend"; v.tracks = "careful"; v.driver = "player"; }
            else v.bounty = BISON.bounty;   // parked and killable; its commander is Task 5's
            return;
          }
        };
        parkBison(1, TOWN.find((t) => t.depot && t.team !== 2));
        parkBison(2, TOWN.find((t) => t.depot && t.team === 2));
```
(`heading` joins the core.js import list; `BISON` the specs import; `stepDrivers, possessedArmorFire, possessedArmorMg` the drivers import.)

**(b) Emitters** — buildEmitters gains, beside the team-2 vehicle line:
```js
          else if (b.kind === "vehicle" && b.team === 1 && b.alive) { const c = invW(b.pos.x, b.pos.z); out.push({ x: c.u, z: c.v, w: EMIT.vehicle.w, r: EMIT.vehicle.r, sign: 1 }); }
```

**(c) stepDepot threading** — stepEnemies gains S and threads the pool:
```js
function stepEnemies(world, grid, T, S) {
  stepDrivers(world, grid, fwdDir, T, invW, {
    possessedId: S.possess && S.possess.kind === "vehicle" ? S.possess.id : 0,
    squads: S.squads,
  });
  stepUnits(world, grid, fwdDir, T, invW);
}
```
Call site in stepDepot: `stepEnemies(world, grid, T, S)`. Beside the tower-possession death check, the vehicle's:
```js
  if (S.possess && S.possess.kind === "vehicle") {
    const pv = world.byId.get(S.possess.id);
    if (!pv || !pv.alive) S.releasePossession();
  }
```

**(d) Selection + orders.** New state on S: `selVehId: null, vehOrderMode: null, mgHeld: false`. Helpers beside squadAtPoint:
```js
      const vehicleAtPoint = (p) => {
        for (const b of world.bodies) {
          if (b.kind !== "vehicle" || !b.alive || b.team !== 1) continue;
          if (Math.hypot(b.pos.x - p.x, b.pos.z - p.z) < 3.2) return b;
        }
        return null;
      };
      const selectedVehicle = () => (S.selVehId != null ? world.byId.get(S.selVehId) || null : null);
      S.orderVehicle = (kind) => {
        if (S.gameOver || S.victory) return;
        const v = selectedVehicle();
        if (!v || world.t < S.selArmedAt) return;
        if (kind === "defend") { v.order = "defend"; v.dest = null; v.goal = null; v._route = null; v._routeDest = null; S.vehOrderMode = null; S.buildPt0 = null; }
        else if (kind === "move" || kind === "patrol" || kind === "escort") {
          if (S.vehOrderMode === kind) { S.vehOrderMode = null; S.buildPt0 = null; return; }
          S.vehOrderMode = kind; S.buildPt0 = null;
        }
      };
      S.toggleTracks = () => {
        const v = selectedVehicle();
        if (!v || world.t < S.selArmedAt) return;
        v.tracks = (v.tracks || "careful") === "careful" ? "free" : "careful";
      };
      S.takeControlVehicle = () => {
        const v = selectedVehicle();
        if (!v || world.t < S.selArmedAt) return;
        v.order = "defend"; v.dest = null; v.goal = null; v._route = null; v._routeDest = null;
        S.possess = { kind: "vehicle", id: v.id };
        S.fireHeld = false; S.mgHeld = false;
        const pc2 = possessCenter();
        S.reticleOff = pc2 ? reclampReticle(T.sight, 1, pc2, possessSightR(), { dx: 0, dz: 6 }, invW) : null;
        S.reticle = pc2 && S.reticleOff ? { x: pc2.x + S.reticleOff.dx, z: pc2.z + S.reticleOff.dz } : null;
        S.selVehId = null; S.vehOrderMode = null; S.selSquadId = null; S.orderMode = null; S.buildPt0 = null; S.linePending = null; S.pieOpen = false;
        R.overlay.setLinePreview(false);
      };
```
possessCenter gains the vehicle branch (`P.kind === "vehicle"` → body pos, same as tower); possessSightR likewise (`eyeOf(b).r` — 36). releasePossession gains:
```js
        if (S.possess.kind === "vehicle") {
          const pv = world.byId.get(S.possess.id);
          if (pv && pv.alive) { pv.depotDrive = "auto"; pv.order = "defend"; pv.dest = null; pv.goal = null; }
        }
```
(placed before the possess fields are nulled) and the final clears gain `S.mgHeld = false`.

**(e) The vehicle's ground taps.** consumeVehOrderTap beside consumeOrderTap:
```js
      const consumeVehOrderTap = (p) => {
        const om = S.vehOrderMode;
        if (!om) return false;
        const v = selectedVehicle();
        if (!v) { S.vehOrderMode = null; S.selVehId = null; S.buildPt0 = null; return true; }
        if (om === "escort") {
          const sq = squadAtPoint(p);
          if (!sq) { toast("TAP A SQUAD TO ESCORT"); return true; }
          v.order = "escort"; v.escortId = sq.id; v.dest = null; v.goal = null; v._route = null; v._routeDest = null;
          S.vehOrderMode = null; S.selVehId = null;
          return true;
        }
        const d = clampToRim(p.x, p.z);
        if (streamAt(d.x, d.z)) { toast("OPEN WATER — find the crossing"); return true; }
        if (om === "move") {
          v.order = "move"; v.dest = { x: d.x, z: d.z }; v._route = null; v._routeDest = null;
          S.vehOrderMode = null; S.selVehId = null;
          return true;
        }
        if (om === "patrol") {   // the two-point confirm law, verbatim from squads
          if (!S.buildPt0) { S.buildPt0 = { x: d.x, z: d.z }; toast("PATROL START — TAP THE FAR END"); return true; }
          S.linePending = { kind: "patrol", veh: v.id, a: { x: S.buildPt0.x, z: S.buildPt0.z }, b: { x: d.x, z: d.z }, moving: null, armedAt: world.t + PENDING_ARM_S };
          S.buildPt0 = null; S.vehOrderMode = null;
          refreshLinePreview();
          return true;
        }
        return false;
      };
```
tapAt, after `if (consumeOrderTap(p)) return;`:
```js
        if (consumeVehOrderTap(p)) return;
```
then after the squad select/deselect pair:
```js
        const tappedVeh = vehicleAtPoint(p);
        if (tappedVeh) { S.selVehId = tappedVeh.id; S.selArmedAt = world.t + PENDING_ARM_S; S.selSquadId = null; S.orderMode = null; S.vehOrderMode = null; S.buildPt0 = null; S.inspectId = null; S.pieOpen = true; return; }
        if (S.selVehId != null) { S.selVehId = null; S.vehOrderMode = null; S.buildPt0 = null; S.pieOpen = false; return; }
```
acceptLine gains the vehicle branch at its head (before the squad lookup):
```js
        if (lp.veh != null) {
          const v = world.byId.get(lp.veh);
          S.linePending = null;
          R.overlay.setLinePreview(false);
          if (v && v.alive) {
            v._patA = { x: lp.a.x, z: lp.a.z }; v._patB = { x: lp.b.x, z: lp.b.z };
            v.order = "patrol"; v.dest = { x: lp.a.x, z: lp.a.z }; v._route = null; v._routeDest = null;
          }
          S.selVehId = null; S.vehOrderMode = null; S.buildPt0 = null;
          return;
        }
```
rejectLine's clears gain `S.selVehId = null; S.vehOrderMode = null;`.

**(f) Possession drive + triggers.** Frame loop, beside the tower camera branch — the sandbox's hull math (ContractSandbox :507-529) verbatim in shape:
```js
          } else if (S.possess && S.possess.kind === "vehicle") {
            const pv = world.byId.get(S.possess.id);
            if (pv) {
              S.focus.x = pv.pos.x; S.focus.z = pv.pos.z; S.focus.y = field.heightAt(S.focus.x, S.focus.z);
              const cbv = R.camBasis;
              const flv = Math.hypot(cbv.up.x, cbv.up.z) || 1, rlv = Math.hypot(cbv.right.x, cbv.right.z) || 1;
              let st = 0, ss = 0;
              if (S.joy && S.joy.active) { st = S.joy.t; ss = S.joy.s; }
              else {
                st = (S.keys.w || S.keys.arrowup ? 1 : 0) + (S.keys.s || S.keys.arrowdown ? -1 : 0);
                ss = (S.keys.d || S.keys.arrowright ? 1 : 0) + (S.keys.a || S.keys.arrowleft ? -1 : 0);
              }
              const wxv = (cbv.right.x / rlv) * ss + (cbv.up.x / flv) * st;
              const wzv = (cbv.right.z / rlv) * ss + (cbv.up.z / flv) * st;
              const magv = Math.min(1, Math.hypot(ss, st));
              pv.depotDrive = "manual";
              if (!pv.ctl) pv.ctl = { throttle: 0, steer: 0, brake: false };
              if (magv > 0.03) {
                const desired = Math.atan2(wxv, wzv);
                let errY = desired - Math.atan2(pv.R[6], pv.R[8]);
                while (errY > Math.PI) errY -= 2 * Math.PI;
                while (errY < -Math.PI) errY += 2 * Math.PI;
                pv.ctl.steer = Math.max(-1, Math.min(1, errY * 1.8));
                pv.ctl.throttle = magv * Math.max(0, Math.cos(errY));
                pv.ctl.brake = false;
              } else { pv.ctl.throttle = 0; pv.ctl.steer = 0; pv.ctl.brake = false; }
            }
          }
```
In the reticle block's tail, keep the turret honest while possessed:
```js
            if (S.possess.kind === "vehicle" && S.reticle) {
              const pv2 = world.byId.get(S.possess.id);
              if (pv2) pv2._aimYaw = Math.atan2(S.reticle.x - pv2.pos.x, S.reticle.z - pv2.pos.z);
            }
```
Sim-bracket triggers, beside the squad/tower pair:
```js
            if (S.possess && S.possess.kind === "vehicle" && S.reticle) {
              const pv = world.byId.get(S.possess.id);
              if (pv) {
                if (S.fireHeld) possessedArmorFire(world, pv, S.reticle, T, invW);
                if (S.mgHeld) possessedArmorMg(world, pv, S.reticle, T, invW);
              }
            }
```
Pointer handlers: onPointerDown gains, BEFORE the existing left-button possessed branch:
```js
        if (S.possess && S.possess.kind === "vehicle" && e.pointerType === "mouse" && e.button === 2) {
          canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
          S.mgHeld = true;
          return;
        }
```
onPointerUp's first line becomes button-aware:
```js
        if (e.pointerType === "mouse" && e.button === 2 && S.mgHeld) { S.mgHeld = false; pointers.delete(e.pointerId); return; }
        if (S.fireHeld && e.pointerType === "mouse") { S.fireHeld = false; pointers.delete(e.pointerId); return; }
```
The canvas blocks the context menu (add beside the other listeners, and to the cleanup list):
```js
      const onCtxMenu = (e) => e.preventDefault();
      canvas.addEventListener("contextmenu", onCtxMenu);
```

**(g) HUD + JSX, phone AND desktop.** hud tick gains `vehRadial` (projected off the hull top, the towerScreen recipe) and the possessed label branch:
```js
              possessed: !S.possess ? null
                : S.possess.kind === "squad" ? (() => { const psq = S.squads.find((q) => q.id === S.possess.id); return psq ? { kind: "squad", label: SQUAD_SPECS[psq.type].label } : null; })()
                : S.possess.kind === "vehicle" ? (() => { const pv = world.byId.get(S.possess.id); return pv && pv.alive ? { kind: "vehicle", label: "BISON" } : null; })()
                : (() => { const ptw = world.byId.get(S.possess.id); return ptw && ptw.kind === "tower" ? { kind: "tower", label: TOWER_SPECS[ptw.towerType].label } : null; })(),
              vehRadial: (() => {
                if (S.selVehId == null || !S.vehScreen) return null;
                const v = world.byId.get(S.selVehId);
                if (!v || !v.alive) return null;
                return { id: v.id, x: S.vehScreen.x, y: S.vehScreen.y, order: v.order || "defend", tracks: v.tracks || "careful",
                  aimingMove: S.vehOrderMode === "move", aimingPatrol: S.vehOrderMode === "patrol", aimingEscort: S.vehOrderMode === "escort",
                  patrolStart: !!S.buildPt0, armed: world.t >= S.selArmedAt, showPie: !!S.pieOpen, linePending: !!S.linePending };
              })(),
```
(`S.vehScreen` is projected in the render bracket beside squadScreen: `R.project(v.pos.x, v.pos.y + v.hy + 1.4, v.pos.z)`, null when unselected.) The vehicle pie renders beside the squad pie, same RadialMenu:
```js
      {hud.vehRadial && (() => {
        const vr = hud.vehRadial;
        const slots = [
          { key: "defend", icon: "∴", label: "DEFEND", color: "#7dffa8", on: vr.order === "defend", act: () => { const S = stateRef.current; if (S) { S.orderVehicle("defend"); S.selVehId = null; } } },
          { key: "move", icon: "→", label: "MOVE", color: "#7fd7ff", on: vr.aimingMove || vr.order === "move", act: () => stateRef.current && stateRef.current.orderVehicle("move") },
          { key: "patrol", icon: "⇄", label: "PATROL", color: "#7fd7ff", on: vr.aimingPatrol || vr.order === "patrol", act: () => stateRef.current && stateRef.current.orderVehicle("patrol") },
          { key: "escort", icon: "⛨", label: "ESCORT", color: "#c9a0ff", on: vr.aimingEscort || vr.order === "escort", act: () => stateRef.current && stateRef.current.orderVehicle("escort") },
          { key: "tracks", icon: vr.tracks === "free" ? "●" : "◐", label: vr.tracks === "free" ? "TRACKS FREE" : "TRACKS CAREFUL", color: vr.tracks === "free" ? "#ff7a7a" : "#4aff8c", on: true, act: () => { const S = stateRef.current; if (S) { S.toggleTracks(); S.selVehId = null; } } },
          { key: "possess", icon: "✥", label: "TAKE CONTROL", color: "#7dffa8", on: false, act: () => stateRef.current && stateRef.current.takeControlVehicle() },
        ];
        const status = vr.linePending ? " — ACCEPT OR ADJUST THE LINE"
          : vr.aimingPatrol ? (vr.patrolStart ? " — TAP THE FAR END" : " — TAP THE PATROL START")
          : vr.aimingEscort ? " — TAP A SQUAD"
          : vr.aimingMove ? " — TAP GROUND" : "";
        return vr.showPie
          ? <RadialMenu cx={vr.x} cy={vr.y} label={"BISON" + status} slots={slots} armed={vr.armed} onChoose={() => { const S = stateRef.current; if (S) S.pieOpen = false; }} />
          : <div style={{ position: "absolute", left: vr.x, top: vr.y + 26, transform: "translate(-50%,0)", fontSize: 10, letterSpacing: 1, color: "#7dffa8", background: "rgba(14,18,24,0.85)", padding: "1px 6px", borderRadius: 4, zIndex: 7, pointerEvents: "none" }}>{"BISON" + status}</div>;
      })()}
```
Phone MG button beside FIRE (vehicle possession only; `setMgHeld` mirrors setFireHeld with its own ref):
```js
      {isTouch && hud.possessed && hud.possessed.kind === "vehicle" && (
        <button data-possess-mg ref={mgBtnRef}
          style={{ ...P.btnBig, position: "absolute", right: 208, bottom: 16, zIndex: 7, width: 64, height: 64, borderRadius: "50%", borderColor: "#ffd27a", color: "#ffd27a", fontWeight: "bold", background: "#2a2214", touchAction: "none" }}
          onPointerDown={(e) => { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); setMgHeld(true); }}
          onPointerUp={(e) => { e.stopPropagation(); setMgHeld(false); }}
          onPointerCancel={(e) => { e.stopPropagation(); setMgHeld(false); }}>
          MG
        </button>
      )}
```
The left stick and FIRE button already show for any non-tower possession — unchanged. Desktop carries WASD drive + mouse reticle + LMB main gun + RMB coax; phone carries both sticks + FIRE + MG. Both platforms named, both ship.

## Step 7 — Renderer: the mesh, the tint, the turret, the bulb

- `buildBison(team)` (:633): parameterize the two dress colors — hull `team === 2 ? 0x6e3a34 : PAL.bisonBlue`, turret box `team === 2 ? 0x5a2f2a : 0x2a5082`, fenders `team === 2 ? 0x3a2320 : 0x1e3a56`. Undefined team (the demo) = today's colors exactly.
- THE BULB (owner, 2026-08-14): a small lamp on the turret rear — `new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), new THREE.MeshBasicMaterial({ color: 0x35ff6a }))` at `(0, 0.62, -1.2)` on the turret group, `g.userData.bulb = that mesh`. In the vehicle sync loop: `if (g.userData.bulb) g.userData.bulb.material.color.setHex(b.tracks === "free" ? 0xff4433 : 0x35ff6a);` — GREEN safe, RED safety off. Bodies with no tracks field (demo, enemy Task 2) read green.
- Mesh pick (:1405): `g = b.vtype === "bison" || b.id === world.bisonId ? buildBison(b.team) : (b.vtype === "truck" ? buildTruck() : buildScout());`
- Turret aim (:1434): `if (g.userData.turret) g.userData.turret.rotation.y = b._aimYaw != null ? b._aimYaw - Math.atan2(b.R[6], b.R[8]) : turretYaw;` — demo parity when `_aimYaw` is absent.

## Step 8 — Version, gates, ship

- `src/version.js`: `"mk1.30"` → `"mk1.31"`.
- Gates, ONLY these: `node scripts/depot-test.mjs` (new block green, everything else untouched), `node scripts/depot-lint.mjs`, `npm run build` (after the bump), `node scripts/smoke.mjs` (boot + UI flows — report any pin it flags, re-teach nothing without naming it). golden is NOT run — core.js is untouched by this task.
- Commit (the task's files only), push. Message: `the Bison musters: your armor takes the field (mk1.31)` with the standard trailers.
- The owner checks live, phone and desktop: the Bison parked by his depot with the green bulb; tap → the pie; MOVE/PATROL/ESCORT walk; TRACKS toggle flips the bulb red; TAKE CONTROL — sticks/WASD drive, reticle steers, FIRE/LMB shells, MG/RMB streams; the enemy's Bison parked dark across the valley.

**Report format:** read-confirmation first; one line of outcome; every re-pin old→new named; every deviation its own bullet; smoke result stated plainly.
