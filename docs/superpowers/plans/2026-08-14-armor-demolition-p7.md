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
