*Part of the P7 phase plan — `2026-08-14-armor-demolition-p7.md` holds the skeleton and binding rulings.*

# Task 4 — The APC (mk1.33) — FULL PLAN

*(Renumbered 2026-08-14: the seat-of-the-war task cut ahead. Every "mk1.32" and "P7 T3" inside THIS section reads as "mk1.33" and "P7 T4" at dispatch; the version-bump step reads mk1.32 → mk1.33. Content otherwise stands as approved-for-review.)*

**AMENDMENT 1 (owner, 2026-08-15): ARMOR PARKS STABLE.** The mk1.32 playtest found the starting hulls on unstable ground. Step 6(a)'s parkArmor gains two things, both hulls, both sides:

1. **A flatness vet.** clearAt additionally requires `stableAt(bx, bz, spec)` — the hull footprint's four corners and center sampled off the heightfield, total spread under PARK_FLAT = 0.28 m (~a 5° grade across the hull). The brute-sweep backstop applies the same vet, and tracks the FLATTEST clear cell seen as it goes — if no cell passes the vet, the flattest clear cell parks the hull anyway (fail-proof stays fail-proof; stability is preferred, never blocking):
```js
          const stableAt = (bx, bz, spec) => {
            // AMENDMENT 1 (owner): armor parks on FLAT ground — no sliding boots.
            const h0 = field.heightAt(bx, bz);
            let lo = h0, hi = h0;
            for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
              const h = field.heightAt(bx + sx * spec.hx, bz + sz * spec.hz);
              if (h < lo) lo = h; else if (h > hi) hi = h;
            }
            return hi - lo < 0.28;   // provisional (F5)
          };
```
2. **Parked cold.** place() sets `v.sleeping = true;` — a sleeping hull cannot creep, slide, or jitter at boot. Every wake path already exists: driveHull wakes on throttle/steer/brake input, so the first order, the safety brake, or the possession stick wakes it; the guns policy never needed the body awake to fire.

And one fixture joins the Step 1 block: on a deliberately bumpy field (a sine-lump heightAt), the parked hull's chosen cell passes the spread bound, spawns asleep, and after 600 idle steps has moved under 0.1 m. The T2-landed parkBison is REPLACED whole by this parkArmor — the Bison inherits stability the moment this task lands.

**What it does, in one line:** the new transport hull parks beside each depot — four seats (one squad of four or two teams of two), LOAD and UNLOAD on its pie, riders sealed (no eyes, no fire, die with the vehicle), the same orders/possession/track rules and safety bulb as the Bison — and the hull shows a CLOSED and an OPEN position: the rear ramp drops when troops are loading or unloading (owner, 2026-08-14).

**Rulings embedded:** the APC's only gun is the coax machine gun (possessed FIRE and the auto guns both stream it; no main gun — it is a transport); riders are protected while sealed by construction (they ride in the hold, out of every blast's reach) and die only with the hull; a possessed squad cannot be loaded (release it first).

**Suggested model:** Sonnet 5 — every mechanism mirrors Task 2's landed patterns.

**Required reading (re-verified at dispatch):**
- This section whole; the decision record's P7 section (the APC ruling).
- `src/depot/drivers.js` whole (as Task 2 landed it — the armor policy, the possessed triggers, stepDrivers' skip).
- `src/depot/DepotGame.jsx` — parkBison + boot spawn region, stepDepot's squads loop and stepEnemies, buildEmitters, consumeVehOrderTap/tapAt, the vehicle pie JSX + vehRadial hud block, possession trigger block, possession buttons JSX, squadAtPoint.
- `src/depot/specs.js` (BISON/BISON_FIRE as landed). `src/depot/state.js` executeWithdrawal (the bison exemption line). `src/depot/market.js` (the tag guard line).
- `src/depot/squads.js` :169-191 (clearSlot/slotBlockedPublic), makeSquad/stepSquad's order list.
- `src/depot/sight.js` whole (the eye loop). `src/depot/save.js` :54-118 (what rides the sweep).
- `src/render/renderer.js` — buildBison/buildApc region, the vehicle sync loop (bulb line, turret line), the infantry sync loop.
- `scripts/depot-test.mjs` — harness, the P7 T1/T2 blocks at the tail.
- `src/engine/core.js` :160-198 (makeBody fields — `pinned`), :1963-1997 (the integrator's pinned/sleeping skips), :1374-1379 (collectContacts' pinned skip). READ ONLY — core.js is not edited.

**Trap notes (binding):**
1. NO core.js edits, NO save.js edits. The sealed hold rides existing engine facts: a `pinned` body is skipped by the broadphase and zeroed by the integrator, and riders are stashed at y = −60 under the hull — outside every blast radius, every projectile path, every contact. `pinned`/`riding`/`ridingIn`/`_boarding`/`apcSeq` are plain scalars — the save's generic sweep carries all of them.
2. Squad→APC binding is by `apcSeq` (a small integer stamped at spawn), NEVER by body id — ids do not survive a save.
3. The riding skip in stepDepot's squads loop must come BEFORE routing/engage/stepSquad/buildline/squadFire/upright — a sealed squad runs none of them. Boarding squads (order "move") still run all of them.
4. Riders must not be eyes (sight.js eye-loop skip), not emit territory (buildEmitters skip), not draw (renderer infantry-loop skip), not be tappable (squadAtPoint skip). Miss one and the hold leaks.
5. The transports logic lives in a NEW module `src/depot/transports.js` (pure over world + squads) so it is headless-testable — DepotGame only wires it. Economy/placement stay out of squads.js per that module's law; transports.js is the same shape as drivers.js.
6. Withdrawal/market guards: Task 2's `vtype === "bison"` lines widen to bison OR apc.
7. Ramp state is render-only: the game layer stamps `v._hatch` (0/1); the renderer eases the hinge. No sim reads it.
8. drivers.js refactor: armorGuns' two nested scans lift to module-level helpers so the APC's coax-only guns policy shares them — behavior identical for the Bison (same order, same gates; the T2 fixtures prove it stays green).
9. Both platforms: the APC pie (LOAD/UNLOAD slots) is tap-driven — phone and desktop identical; possessed FIRE fires the coax on both (LMB desktop, FIRE button phone); the MG button/right-hold is Bison-only and must not appear/fire for the APC.
10. No new rng draws anywhere.

## Step 1 — Asserts first (failing)

Append the P7 T3 block before the fails check. Imports gain `APC` (specs), `stepTransports, unloadApc, apcSeated` (transports.js), and reuse T2's helpers (flat field WITH the carve stub — T2's lesson).

```js
// ==== P7 T3: THE APC =========================================================
{
  const flatF = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (x, z, o) => { o.x = 0; o.y = 1; o.z = 0; return o; } };
  const mkW = (seed) => { const w = makeWorld({ field: flatF, seed }); w.depotCombat = true; return w; };
  const mkApc = (w, team, x, z, seq) => {
    const v = addBody(w, { kind: "vehicle", team, mass: APC.mass, hx: APC.hx, hy: APC.hy, hz: APC.hz, x, y: APC.hy + 0.05, z, hp: APC.hp, friction: 0.85 });
    v.armor = APC.armor; v.vtype = "apc"; v.apcSeq = seq; v.drv = "apc"; v.depotDrive = "auto"; v.tracks = "careful"; v.order = "defend";
    return v;
  };
  const liveIds = (w, sq) => sq.memberIds.map((id) => w.byId.get(id)).filter((u) => u && u.alive);
  { // (a) boarding: the squad walks in, mounts, seals; a second squad finds no room
    const w = mkW(31); const v = mkApc(w, 1, 0, 0, 1);
    const sq = makeSquad(1, "rifles", 1, 0, -12); spawnSquadMembers(w, sq);
    const sq2 = makeSquad(2, "mg", 1, 8, -12); spawnSquadMembers(w, sq2);
    const squads = [sq, sq2];
    sq._boarding = 1;
    for (let i = 0; i < 1800 && sq.ridingIn == null; i++) { stepTransports(w, squads); stepSquad(w, sq, w.dt); stepWorld(w); }
    ok("T3(a): the squad mounts and seals", sq.ridingIn === 1 && sq.order === "ride", `${sq.ridingIn}/${sq.order}`);
    ok("T3(a2): riders are pinned in the hold, under the hull", liveIds(w, sq).every((u) => u.pinned && u.riding && u.pos.y < -30));
    ok("T3(a3): the seats are counted full", apcSeated(w, squads, 1) === 4, apcSeated(w, squads, 1));
    sq2._boarding = 1;
    stepTransports(w, squads);
    ok("T3(a4): no room — the second squad's boarding is refused", sq2._boarding == null && sq2.ridingIn == null);
  }
  { // (b) sealed: a riding man is not an eye
    const w = mkW(32);
    const T3s = makeTerritory(29, 57); T3s.sight = makeSight(T3s);
    const u = addBody(w, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x: 0, y: -60, z: 0, hp: 58 });
    u.riding = true; u.pinned = true;
    stepSight(w, T3s.sight, (x, z) => ({ u: x, v: z }), (uu, vv) => ({ x: uu, z: vv }));
    ok("T3(b): a rider lights nothing", seenAt(T3s.sight, 0, 0, 1) === false);
  }
  { // (c) carried and (d) sealed both ways: the hold dies with the hull
    const w = mkW(33); const v = mkApc(w, 1, 0, 0, 1);
    const sq = makeSquad(1, "rifles", 1, 0, -6); spawnSquadMembers(w, sq);
    const squads = [sq];
    sq._boarding = 1;
    for (let i = 0; i < 1800 && sq.ridingIn == null; i++) { stepTransports(w, squads); stepSquad(w, sq, w.dt); stepWorld(w); }
    v.order = "move"; v.dest = { x: 0, z: 20 };
    const grid = /* T2's mkGrid helper — reuse it (hoist mkGrid above the T2 block or duplicate the literal here, match the file's style) */ null;
    for (let i = 0; i < 600; i++) { stepTransports(w, squads); stepDrivers(w, gridT3 || undefined, identFwdDir, null, (x, z) => ({ u: x, v: z }), {}); stepWorld(w); }
    ok("T3(c): the hold rides with the hull", liveIds(w, sq).every((u) => Math.hypot(u.pos.x - v.pos.x, u.pos.z - v.pos.z) < 1), "");
    applyDamage(w, v, 1e9, { attacker: "enemy" });
    stepTransports(w, squads);
    ok("T3(d): passengers die with the vehicle", liveIds(w, sq).length === 0);
  }
  { // (e) unload: back on the snow, clear of the hull, dug in; seats freed; hatch stamped
    const w = mkW(34); const v = mkApc(w, 1, 0, 0, 1);
    const sq = makeSquad(1, "rifles", 1, 0, -6); spawnSquadMembers(w, sq);
    const squads = [sq];
    sq._boarding = 1;
    for (let i = 0; i < 1800 && sq.ridingIn == null; i++) { stepTransports(w, squads); stepSquad(w, sq, w.dt); stepWorld(w); }
    unloadApc(w, squads, v);
    ok("T3(e): the squad unloads dug in beside the hull", sq.ridingIn == null && sq.order === "defend" &&
      liveIds(w, sq).every((u) => !u.pinned && !u.riding && u.pos.y > 0 && Math.hypot(u.pos.x - v.pos.x, u.pos.z - v.pos.z) < 8));
    ok("T3(e2): the seats free up", apcSeated(w, squads, 1) === 0);
    ok("T3(e3): the ramp is stamped open", v._unloadT === w.t);
  }
  { // (f) the hatch opens for men coming in
    const w = mkW(35); const v = mkApc(w, 1, 0, 0, 1);
    const sq = makeSquad(1, "rifles", 1, 0, -10); spawnSquadMembers(w, sq);
    sq._boarding = 1;
    stepTransports(w, [sq]);
    ok("T3(f): the ramp drops for the boarding squad", v._hatch === 1);
  }
  { // (g) the guards widen to the APC
    const w = mkW(36);
    const eApc = mkApc(w, 2, 0, 30, 2); delete eApc.drv; eApc.bounty = APC.bounty;
    const tank = spawnUnit(w, { x: 5, z: 30 }, "tank");
    const S3 = makeRunState(); S3.reg = fatReg();
    executeWithdrawal(S3, w);
    ok("T3(g): withdrawal spares the APC, sweeps the wave tank", w.byId.has(eApc.id) && !w.byId.has(tank.id));
    ok("T3(g2): the APC prices no tank family", !(marketCounts(w, []).tank));
  }
  { // (h) the coax is the whole armory: possessed FIRE streams mg rounds, no shells
    const w = mkW(37); const v = mkApc(w, 1, 0, 0, 1);
    const fired = possessedArmorMg(w, v, { x: 0, z: 12 }, null, (x, z) => ({ u: x, v: z }));
    ok("T3(h): the coax fires and cools", fired === true && v.mgT > 0);
    ok("T3(h2): every round in the air is mg-kind", w.projectiles.every((p) => p.spec.kind === "mg"), w.projectiles.length);
  }
  { // (i) twin determinism with a mounted hold in motion
    const twin = () => {
      const w = mkW(38); const v = mkApc(w, 1, 0, 0, 1);
      const sq = makeSquad(1, "rifles", 1, 0, -8); spawnSquadMembers(w, sq);
      sq._boarding = 1;
      for (let i = 0; i < 900; i++) { stepTransports(w, [sq]); if (sq.ridingIn == null) stepSquad(w, sq, w.dt); stepWorld(w); }
      return worldHash(w);
    };
    ok("T3(i): twin runs agree", twin() === twin());
  }
}
// ==== end P7 T3 ==============================================================
```
(T3(c)'s grid: reuse Task 2's `mkGrid` — hoist it to a shared helper above both blocks, or duplicate the literal; match the file's style and say which in the report.)

## Step 2 — specs.js: the APC's table

After BISON_FIRE:
```js
// P7 T3 (mk1.32): THE APC — the starting transport, one parked at each
// depot beside the Bison. Four seats: one squad of four or two teams of
// two. Riders are SEALED — no eyes, no fire — and die with the vehicle;
// loading is a real decision (owner). Its only gun is the coax
// (BISON_FIRE.mg — one mg table, every hull). All dials provisional (F5).
export const APC = { mass: 2600, hx: 1.6, hy: 1.0, hz: 3.0, hp: 300, armor: 120, bounty: 45, seats: 4 };
```

## Step 3 — transports.js: the hold

New file `src/depot/transports.js` — pure over (world, squads); DepotGame only wires it.

```js
// COLDSNAP DEPOT — transports.js: THE HOLD (P7 T3, mk1.32). Boarding,
// riding, unloading, and the sealed-both-ways law: riders have no eyes and
// no rifles (every consumer skips b.riding), cannot be hurt (they ride
// pinned at y = -60, under every blast, past every round), and DIE WITH the
// vehicle. Squad->APC binding is by apcSeq — a small integer stamped at
// spawn — never a body id (ids do not survive a save). Pure functions,
// zero rng; DepotGame wires them.
import { applyDamage } from "../engine/core.js";
import { clearSlot } from "./squads.js";
import { APC } from "./specs.js";

const RIDE_Y = -60;
const BOARD_R = 4.5;        // m — a man at the ramp // provisional (F5)
const HATCH_R = 14;         // m — the ramp drops when the boarders close to this // provisional (F5)

export function apcBySeq(world, seq) {
  for (const b of world.bodies) if (b.kind === "vehicle" && b.vtype === "apc" && b.apcSeq === seq && b.alive) return b;
  return null;
}
export function apcSeated(world, squads, seq) {
  let n = 0;
  for (const sq of squads) if (sq.ridingIn === seq)
    for (const id of sq.memberIds) { const u = world.byId.get(id); if (u && u.alive) n++; }
  return n;
}
export function stepTransports(world, squads) {
  for (const b of world.bodies) if (b.vtype === "apc") b._hatch = (world.t - (b._unloadT || -9) < 1.5) ? 1 : 0;
  for (const sq of squads) {
    if (sq.ridingIn != null) {
      const v = apcBySeq(world, sq.ridingIn);
      if (!v) {
        // the hull is gone: the hold goes with it — sealed both ways.
        for (const id of sq.memberIds) {
          const u = world.byId.get(id);
          if (u && u.alive) { u.pinned = false; u.riding = false; applyDamage(world, u, 1e6, { cause: "CRUSH", attacker: "world" }); }
        }
        sq.ridingIn = null;
        continue;
      }
      for (const id of sq.memberIds) {
        const u = world.byId.get(id);
        if (u && u.alive) { u.riding = true; u.pinned = true; u.pos.x = v.pos.x; u.pos.y = RIDE_Y; u.pos.z = v.pos.z; }
      }
      continue;
    }
    if (sq._boarding != null) {
      const v = apcBySeq(world, sq._boarding);
      if (!v) { sq._boarding = null; sq.order = "defend"; sq.dest = null; continue; }
      sq.order = "move"; sq.dest = { x: v.pos.x, z: v.pos.z };   // the door tracks the hull
      let live = 0, near = 0, nearest = 1e9;
      for (const id of sq.memberIds) {
        const u = world.byId.get(id);
        if (!u || !u.alive) continue;
        live++;
        const d = Math.hypot(u.pos.x - v.pos.x, u.pos.z - v.pos.z);
        if (d < nearest) nearest = d;
        if (d < BOARD_R) near++;
      }
      if (nearest < HATCH_R) v._hatch = 1;
      const free = APC.seats - apcSeated(world, squads, v.apcSeq);
      if (live === 0 || live > free) { sq._boarding = null; sq.order = "defend"; sq.dest = null; continue; }
      if (near === live) {
        sq.ridingIn = v.apcSeq; sq._boarding = null;
        sq.order = "ride"; sq.dest = null; sq._legTarget = null; sq._route = null; sq._routeDest = null; sq._build = null; sq._pauseT = 0;
        for (const id of sq.memberIds) {
          const u = world.byId.get(id);
          if (u && u.alive) { u.riding = true; u.pinned = true; u.settled = false; u.goal = null; u.v.x = 0; u.v.y = 0; u.v.z = 0; }
        }
      }
    }
  }
}
export function unloadApc(world, squads, v) {
  if (!v || v.vtype !== "apc") return;
  for (const sq of squads) {
    if (sq.ridingIn !== v.apcSeq) continue;
    sq.ridingIn = null;
    sq.order = "defend"; sq.dest = null; sq._legTarget = null;
    sq.anchor = { x: v.pos.x, z: v.pos.z };
    sq._surveyPending = true; sq._threatSig = undefined;
    let i = 0;
    for (const id of sq.memberIds) {
      const u = world.byId.get(id);
      if (!u || !u.alive) continue;
      const a = (i++ / APC.seats) * Math.PI * 2;
      const p = clearSlot(world, v.pos.x + Math.sin(a) * 3.4, v.pos.z + Math.cos(a) * 3.4, (u.hx || 0.28) + 0.35);
      u.riding = false; u.pinned = false; u.sleeping = false;
      u.pos.x = p.x; u.pos.z = p.z; u.pos.y = world.field.heightAt(p.x, p.z) + 0.74;
      u.v.x = 0; u.v.y = 0; u.v.z = 0;
    }
  }
  v._unloadT = world.t;
}
```

## Step 4 — drivers.js: the APC policy, scans lifted

Lift armorGuns' nested `scanFoes`/`scanStructs` to module-level `armorScanFoes(world, v, muzzle, spec, unitsOnly, T, toUV)` and `armorScanStructs(world, v, muzzle, spec, T, toUV)` — bodies identical, parameters explicit; armorGuns calls them (Bison behavior unchanged — the T2 fixtures prove it). Then:

```js
// ---- the APC (P7 T3): same legs, one gun. The goal policy IS armorGoal —
// orders, routes, escort, the overrun safety, all shared. The guns policy
// is the coax alone: a transport defends itself, it does not duel.
function apcGuns(world, v, dt, T, toUV) {
  const attacker = v.team === 1 ? "player" : "enemy";
  v.mgT = (v.mgT || 0) - dt;
  if (v.mgT > 0) return;
  const mg = BISON_FIRE.mg;
  const muzzle = { x: v.pos.x, y: v.pos.y + 1.3, z: v.pos.z };
  const tgt = armorScanFoes(world, v, muzzle, mg, true, T, toUV);
  if (tgt) {
    v.mgT = mg.cd;
    v._aimYaw = Math.atan2(tgt.pos.x - v.pos.x, tgt.pos.z - v.pos.z);
    shooterFire(world, v, muzzle, tgt, { ...mg, volley: mg.burst }, { attacker, owner: v.id, volleyDelay: mg.burstGap, muzzleStep: 0 });
  } else v.mgT = 0.4;
}
DRIVERS.apc = { goal: armorGoal, guns: apcGuns };
```
(stepDrivers' possessed skip already decays mgT — no change.)

## Step 5 — The guards widen

`state.js` executeWithdrawal: the T2 line becomes
```js
    if (b.vtype === "bison" || b.vtype === "apc") continue; // P7 T2/T3: starting armor is not wave stock
```
`market.js`: the T2 tag guard already keys `b.tag === "tank"` — verify the APC (no tag) falls out of it; no edit expected. If T2 landed it differently, widen the same way and name it in the report.

## Step 6 — DepotGame: spawn, wiring, LOAD/UNLOAD, possession

**(a) Spawn.** parkBison generalizes to parkArmor(team, depotT, kind); a module-scope-of-effect counter seats apcSeq 1 and 2. The ring scan gains a parked-vehicle clearance (vehicles are not static solids — slotBlockedPublic cannot see them):
```js
        let apcSeqN = 0;
        const parkArmor = (team, depotT, kind) => {
          if (!depotT) return;
          const spec = kind === "apc" ? APC : BISON;
          for (let rr = 9; rr <= 18; rr += 1.5) for (let k = 0; k < 16; k++) {
            const az = (k / 16) * Math.PI * 2;
            const bx = depotT.x + Math.sin(az) * rr, bz = depotT.z + Math.cos(az) * rr;
            const cell = grid.cellAt(bx, bz);
            if (!cell || cell.blocked || cell.ice || cell.water || cell.wallId) continue;
            if (Math.hypot(bx - OBJ_POS.x, bz - OBJ_POS.z) < 4) continue;
            if (slotBlockedPublic(world, bx, bz, Math.hypot(spec.hx, spec.hz) + 0.5)) continue;
            if (world.bodies.some((o) => o.kind === "vehicle" && o.alive && Math.hypot(o.pos.x - bx, o.pos.z - bz) < 7)) continue;
            const v = addBody(world, { kind: "vehicle", team, mass: spec.mass, hx: spec.hx, hy: spec.hy, hz: spec.hz,
              x: bx, y: field.heightAt(bx, bz) + spec.hy + 0.05, z: bz, hp: spec.hp, friction: 0.85,
              q: heading(null, Math.atan2(-bx, -bz)) });
            v.armor = spec.armor; v.vtype = kind; v.maxHp = spec.hp;
            if (kind === "apc") v.apcSeq = ++apcSeqN;
            if (team === 1) { v.drv = kind === "apc" ? "apc" : "armor"; v.depotDrive = "auto"; v.order = "defend"; v.tracks = "careful"; v.driver = "player"; }
            else v.bounty = spec.bounty;
            return;
          }
        };
        const depotP = TOWN.find((t) => t.depot && t.team !== 2), depotE = TOWN.find((t) => t.depot && t.team === 2);
        parkArmor(1, depotP, "bison"); parkArmor(1, depotP, "apc");
        parkArmor(2, depotE, "bison"); parkArmor(2, depotE, "apc");
```
(RESUME needs apcSeqN untouched — bodies carry apcSeq off the save; the counter only lives in the fresh path.)

**(b) The hold steps.** In stepDepot, right after `S.squads = pruneSquads(...)`:
```js
    stepTransports(world, S.squads);   // P7 T3: boarding, riding, the sealed hold
```
and at the top of the per-squad loop:
```js
      if (sq.ridingIn != null || sq.order === "ride") continue; // P7 T3: the hold is sealed — no legs, no eyes, no rifles
```
Imports: `stepTransports, unloadApc, apcSeated` from "./transports.js"; `APC` joins the specs import.

**(c) Leak-proofing the hold.** buildEmitters: both unit lines gain `&& !b.riding`. squadAtPoint's loop gains `if (sq.ridingIn != null) continue;` as its first line.

**(d) LOAD/UNLOAD.** S.orderVehicle's arming list gains "load" (APC only — the pie only offers it there). consumeVehOrderTap gains, before the clampToRim line:
```js
        if (om === "load") {
          if (v.vtype !== "apc") { S.vehOrderMode = null; return true; }
          const sq = squadAtPoint(p);
          if (!sq) { toast("TAP A SQUAD TO LOAD"); return true; }
          if (S.possess && S.possess.kind === "squad" && S.possess.id === sq.id) { toast("RELEASE THEM FIRST"); return true; }
          let live = 0;
          for (const id of sq.memberIds) { const u = world.byId.get(id); if (u && u.alive) live++; }
          const free = APC.seats - apcSeated(world, S.squads, v.apcSeq);
          if (live > free) { toast("NO ROOM — " + free + (free === 1 ? " SEAT" : " SEATS")); return true; }
          sq._boarding = v.apcSeq; sq._build = null;
          S.vehOrderMode = null; S.selVehId = null;
          return true;
        }
```
S.unloadVehicle:
```js
      S.unloadVehicle = () => {
        const v = selectedVehicle();
        if (!v || world.t < S.selArmedAt) return;
        unloadApc(world, S.squads, v);
      };
```

**(e) The pie.** vehRadial gains `vtype: v.vtype, seatsFree: v.vtype === "apc" ? APC.seats - apcSeated(world, S.squads, v.apcSeq) : 0, riders: v.vtype === "apc" ? apcSeated(world, S.squads, v.apcSeq) : 0, aimingLoad: S.vehOrderMode === "load"`. The JSX: label becomes `vr.vtype === "apc" ? "APC" : "BISON"` (both places); after the ESCORT slot, APC-only:
```js
        if (vr.vtype === "apc" && vr.seatsFree > 0) {
          slots.push({ key: "load", icon: "⬒", label: "LOAD (" + vr.seatsFree + ")", color: "#ffd27a", on: vr.aimingLoad, act: () => stateRef.current && stateRef.current.orderVehicle("load") });
        }
        if (vr.vtype === "apc" && vr.riders > 0) {
          slots.push({ key: "unload", icon: "⬓", label: "UNLOAD (" + vr.riders + ")", color: "#ffd27a", on: false, act: () => { const S = stateRef.current; if (S) { S.unloadVehicle(); S.selVehId = null; } } });
        }
```
Status line gains `: vr.aimingLoad ? " — TAP A SQUAD" `.

**(f) Possession.** The possessed label branch returns `{ kind: "vehicle", vtype: pv.vtype, label: pv.vtype === "apc" ? "APC" : "BISON" }`. The trigger block branches by vtype:
```js
            if (S.possess && S.possess.kind === "vehicle" && S.reticle) {
              const pv = world.byId.get(S.possess.id);
              if (pv) {
                if (S.fireHeld) { if (pv.vtype === "apc") possessedArmorMg(world, pv, S.reticle, T, invW); else possessedArmorFire(world, pv, S.reticle, T, invW); }
                if (S.mgHeld && pv.vtype !== "apc") possessedArmorMg(world, pv, S.reticle, T, invW);
              }
            }
```
The phone MG button's condition gains `&& hud.possessed.vtype !== "apc"`; the desktop right-button grab in onPointerDown gains the same vtype check (an APC right-click does nothing).

## Step 7 — sight.js and the renderer

**sight.js** — the eye loop (stepSight) gains one line after the isEye check:
```js
    if (b.riding) continue; // P7 T3: the hold is sealed — a rider is not an eye; the APC is
```
**renderer.js:**
- The infantry sync loop gains `if (b.riding) continue;` at its top (riders draw nowhere).
- `buildApc(team)`:
```js
  function buildApc(team) {
    const g = new THREE.Group();
    const hullC = team === 2 ? 0x6e3a34 : 0x3f5a78, topC = team === 2 ? 0x5a2f2a : 0x2f4a66, fenderC = team === 2 ? 0x3a2320 : 0x1e3a56;
    const hull = new THREE.Mesh(new THREE.BoxGeometry(3.1, 1.5, 5.6), toon(hullC));
    hull.position.y = 0.25; hull.castShadow = true; hull.receiveShadow = true; g.add(hull);
    const glacis = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.9, 1.4), toon(topC));
    glacis.position.set(0, 0.95, 2.0); glacis.rotation.x = 0.35; glacis.castShadow = true; g.add(glacis);
    const cupola = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.5, 1.1), toon(topC));
    cupola.position.set(-0.6, 1.25, 0.4); cupola.castShadow = true; g.add(cupola);
    const coax = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.2, 6), toon(0x33383d));
    coax.rotation.x = Math.PI / 2; coax.position.set(-0.6, 1.35, 1.2); g.add(coax);
    for (const sx of [-1, 1]) {
      const tread = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 6.0), toon(0x1b1e22));
      tread.position.set(sx * 1.6, -0.45, 0); tread.castShadow = true; g.add(tread);
      const fender = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.14, 6.2), toon(fenderC));
      fender.position.set(sx * 1.6, 0.22, 0); g.add(fender);
    }
    // THE RAMP (owner, 2026-08-14): CLOSED on the march, OPEN when troops
    // are loading or unloading — hinged at the tail's foot, swinging down
    // to the snow. The game layer stamps b._hatch; the sync loop eases it.
    const hinge = new THREE.Group(); hinge.position.set(0, -0.5, -2.8); g.add(hinge);
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.35, 0.16), toon(topC));
    ramp.position.y = 0.68; ramp.castShadow = true; hinge.add(ramp);
    g.userData.ramp = hinge;
    // the safety bulb — the Bison's law: green safe, red off
    const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), new THREE.MeshBasicMaterial({ color: 0x35ff6a }));
    bulb.position.set(-0.6, 1.62, 0.4); g.add(bulb);
    g.userData.bulb = bulb;
    return g;
  }
```
- Mesh pick: `g = b.vtype === "apc" ? buildApc(b.team) : (b.vtype === "bison" || b.id === world.bisonId) ? buildBison(b.team) : (b.vtype === "truck" ? buildTruck() : buildScout());`
- The sync loop, beside the bulb line:
```js
      if (g.userData.ramp) g.userData.ramp.rotation.x += ((b._hatch ? -1.9 : 0) - g.userData.ramp.rotation.x) * 0.12;
```
(The existing bulb line covers the APC for free — tracks absent reads green.)

## Step 8 — Version, gates, ship

- `src/version.js`: `"mk1.31"` → `"mk1.32"`.
- Gates, ONLY these: `node scripts/depot-test.mjs`, `node scripts/depot-lint.mjs`, `npm run build` (after the bump), `node scripts/smoke.mjs`. golden NOT run (core untouched).
- Commit the task's files only (transports.js new, drivers.js, specs.js, state.js, market.js if touched, DepotGame.jsx, sight.js, renderer.js, scripts/depot-test.mjs, src/version.js), push. Message: `the APC: four seats and a sealed hold (mk1.32)` with the standard trailers.
- The owner checks live, phone and desktop: both hulls parked at his depot (Bison + APC, bulbs green); the APC pie carries LOAD; LOAD → tap a rifle squad → the ramp drops as they close, they vanish into the hold; the APC drives with them (MOVE/PATROL/ESCORT); UNLOAD drops the ramp and they dig in beside it; TAKE CONTROL streams the coax on FIRE/left-click (no MG button, right-click dead); killing the enemy's parked APC pays; a war saved mid-ride resumes with the hold sealed.

**Report format:** read-confirmation first; one line of outcome; every re-pin old→new named; every deviation its own bullet; smoke result stated plainly.
