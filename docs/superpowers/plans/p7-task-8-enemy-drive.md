*Part of the P7 phase plan — `2026-08-14-armor-demolition-p7.md` holds the skeleton; the decision record's COMMANDER PROFILE + TASK 8 RULINGS entries bind every dial here.*

*HISTORY (stamped 2026-08-20, owner's order): this document is a record of shipped work, not authority. Design truth lives in CLAUDE.md and the ACTIVE phase's plan documents; where this file disagrees with them, it is wrong.*

# Task 8 — The enemy learns to drive (mk1.38) — FULL PLAN

**What it does, in one line:** the enemy draws a hidden commander once per war (CAUTIOUS / BOLD / STUBBORN) whose doctrine writes orders into its Bison through the same motor pool your armor rides — bold rides out with assaults, cautious commits at ~55% held ground or bell 8, stubborn never leaves, and committed armor drives home between bells — while its APC ferries assault infantry to a drawn flank on your half on a seeded ~40% roll per eligible bell, and the intel desk may whisper which commander you drew.

**Suggested model:** Sonnet 5.

**Required reading (re-verified at dispatch; locate by content):**
- This file; the decision record's COMMANDER PROFILE and TASK 8 RULINGS entries.
- `src/depot/DepotGame.jsx` — ringBell whole (the bell sequence INCLUDING Task 6's home-guard split — the new blocks slot after it), parkArmor, the boot's profile-draw insertion point (after the garrison block, before `stateRef.current = S`), the RES run-restore section, stepDepot's stepTransports call.
- `src/depot/transports.js` whole (the team-2 rider pass extends it).
- `src/depot/drivers.js` — armorGoal (READ ONLY this task: orders are written game-side; the policy is untouched).
- `src/depot/state.js` — fireBell (composeIntel call site), executeWithdrawal (riders exemption check).
- `src/depot/intel.js` whole. `src/depot/territory.js` (T.v, the sign convention). `src/depot/save.js` — the run block writer + reader.
- `src/depot/units.js` — spawnUnit (draw counts), stepUnits (what unloaded riders do: nothing new — they march the flow field).
- `scripts/depot-test.mjs` — harness, the P7 T6 block (bell-sequence fixtures), intel's no-digits sweep.

**Trap notes (binding):**
1. DRAW DISCIPLINE. New world-rng draws, all unconditional at fixed stream positions: ONE at boot (the profile — drawn fresh-war only, right after the Task 6 garrison spawns; a RESUME restores `S.cmdr` and draws nothing, exactly makeRegiment's pattern), and TWO per bell (ferryRoll, dropRoll — drawn EVERY bell whatever eligibility, draw-then-clamp). Ferry spawns add 3/man only when the roll commits — deterministic from the roll. State the full per-bell arithmetic in the report.
2. composeIntel is the codebase's one variable-draw site (recorded open item) — the commander family joins it LAST in draw order, same tryFamily shape, no digits ever.
3. Orders are written GAME-SIDE (ringBell); drivers.js is not edited. The doctrine writes `v.order/v.dest`; armorGoal already routes, arrives, flips to defend.
4. All new state rides existing channels: `S.cmdr` via explicit save run fields (save.js writer + reader + DepotGame RES line — three edits, named); body fields (`homeX/homeZ`, `committed`, `ferry`, `rideApc`) via the generic sweep.
5. Team-2 riders are LOOSE UNITS, not squads: transports.js gains a world-pass keyed on `u.rideApc` (seat number) — same stash (y −60), same pin, same die-with; unload places them clearSlot-ringed and they simply resume the flow-field march. executeWithdrawal must NOT sweep seated riders mid-ferry: exempt `u.rideApc != null` (they withdraw when unloaded and spent like anyone).
6. The drop point never lands within 18m of the player depot; candidates are PASSES flat + road mouths with canonical v > 0, preferring |u − depotU1| > 15 when any qualify. Deterministic filter, the dropRoll picks the index.
7. Doctrine cadence is THE BELL only — no per-tick scans. "Home" is the hull's own park spot, stamped `v.homeX/homeZ` in parkArmor (both teams — harmless for yours).
8. The cautious read: enemyCells/(enemyCells+playerCells) ≥ 0.55 over T.v (thresholds ±0.15), neutral ignored; OR S.bell ≥ 8. Once true, `v.committed = 1` forever (bold-equivalent thereafter).
9. NO core.js edits; the sim is untouched beyond orders and spawns.

## Step 1 — Asserts first (failing)

P7 T8 block:
```js
// ==== P7 T8: THE ENEMY LEARNS TO DRIVE ======================================
//  (a) profile: cmdrOf(rng) is one draw, uniform over the three, stable per seed
//  (b) doctrine table: cmdrBellOrders(profile, ctx) — pure — returns the
//      Bison's order for this bell:
//        stubborn: always home;  bold: forward when the muster fielded;
//        cautious: home until heldRatio >= 0.55 || bell >= 8, then forward;
//        forward-then-home: ctx.atFront && !ctx.fielded -> home
//  (c) the ferry gate: ferryDecide(roll, eligible) — a 0.39 roll ferries when
//      eligible, 0.41 never; ineligible never, roll consumed regardless
//  (d) the drop draw: flankDrop(cands, roll, depotU) prefers the wide set,
//      never lands nearer the depot than 18m, picks by index deterministically
//  (e) team-2 riders: seat 4 loose units on an APC via transports' new pass —
//      stashed at y -60, carried, die with the hull; unload rings them out
//      clear and they resume marching (goal: cell.dist read non-null)
//  (f) withdrawal spares seated riders mid-ferry
//  (g) intel: the commander family whispers with no digits, joins LAST
//      (200-seed sweep extended), and a run without a cmdr arg is byte-stable
// ==== end P7 T8 ==============================================================
```
(Each written concretely against the harness's existing shapes; every ok() named as sketched.)

## Step 2 — The profile

- ai.js (beside homeShare):
```js
// P7 T8: THE COMMANDER — one draw per war, uniform, hidden. // provisional (F5)
export const CMDRS = ["cautious", "bold", "stubborn"];
export function cmdrOf(rng) { return CMDRS[Math.min(2, Math.floor(rng() * 3))]; }
```
- DepotGame boot, immediately after the Task 6 garrison block (fresh war only): `if (!RES) S.cmdr = cmdrOf(world.rng); // ONE draw, position documented: after makeRegiment's 2 and the garrison's 24`. S's initializer declares `cmdr: null`; the RES section gains `S.cmdr = r.cmdr || "cautious";`.
- save.js run writer gains `cmdr: S.cmdr,`; parseFront untouched.

## Step 3 — The doctrine at the bell

ai.js, pure:
```js
// P7 T8: the commander's bell decision for the Bison. ctx: { bell, fielded,
// heldRatio, atFront, committed }. Returns "forward" | "home".
export function cmdrBellOrders(profile, ctx) {
  if (profile === "stubborn") return "home";
  const go = profile === "bold" ? true
    : (ctx.committed || ctx.heldRatio >= 0.55 || ctx.bell >= 8);   // provisional (F5)
  if (!go) return "home";
  return ctx.fielded ? "forward" : "home";                          // rides with assaults; home between them
}
```
DepotGame ringBell, after the Task 6 split block:
```js
        // P7 T8: THE COMMANDER DRIVES. Bell-cadence only; orders go through
        // the same motor pool the player's armor rides. Held-ratio read off
        // the territory field, neutral ignored.
        {
          const eb = world.bodies.find((b) => b.kind === "vehicle" && b.team === 2 && b.vtype === "bison" && b.alive);
          if (eb && S.cmdr) {
            let pc = 0, ec = 0;
            for (let i2 = 0; i2 < T.v.length; i2++) { if (T.v[i2] > 0.15) pc++; else if (T.v[i2] < -0.15) ec++; }
            const heldRatio = ec + pc > 0 ? ec / (ec + pc) : 0;
            const atFront = Math.hypot(eb.pos.x - (eb.homeX || eb.pos.x), eb.pos.z - (eb.homeZ || eb.pos.z)) > 20;
            const order = cmdrBellOrders(S.cmdr, { bell: S.bell, fielded: S.ws.fielded > 0, heldRatio, atFront, committed: !!eb.committed });
            if (order === "forward") {
              eb.committed = 1;
              eb.order = "move"; eb.dest = { x: OBJ_POS.x, z: OBJ_POS.z }; eb._route = null; eb._routeDest = null;
            } else if (atFront || eb.order !== "defend") {
              eb.order = "move"; eb.dest = { x: eb.homeX != null ? eb.homeX : eb.pos.x, z: eb.homeZ != null ? eb.homeZ : eb.pos.z }; eb._route = null; eb._routeDest = null;
            }
          }
        }
```
parkArmor's place() gains `v.homeX = bx; v.homeZ = bz;`.

## Step 4 — The ferry

transports.js gains the team-2 loose-rider pass inside stepTransports (before the squads loop) and an enemy unload:
```js
  // P7 T8: THE FERRY'S HOLD — enemy riders are loose units, seated by
  // u.rideApc (the seat number). Same stash, same seal, same grave.
  for (const b of world.bodies) {
    if (b.kind !== "unit" || b.team !== 2 || b.rideApc == null || !b.alive) continue;
    const v = apcBySeq(world, b.rideApc);
    if (!v) { b.pinned = false; b.riding = false; b.rideApc = null; applyDamage(world, b, 1e6, { cause: "CRUSH", attacker: "world" }); continue; }
    b.riding = true; b.pinned = true; b.pos.x = v.pos.x; b.pos.y = RIDE_Y; b.pos.z = v.pos.z;
  }
export function unloadEnemyRiders(world, v) {
  let i = 0, n = 0;
  for (const b of world.bodies) if (b.kind === "unit" && b.rideApc === v.apcSeq && b.alive) n++;
  for (const b of world.bodies) {
    if (b.kind !== "unit" || b.rideApc !== v.apcSeq || !b.alive) continue;
    const a = (i++ / Math.max(1, n)) * Math.PI * 2;
    const p = clearSlot(world, v.pos.x + Math.sin(a) * 3.4, v.pos.z + Math.cos(a) * 3.4, (b.hx || 0.26) + 0.35);
    b.riding = false; b.pinned = false; b.rideApc = null; b.sleeping = false;
    b.pos.x = p.x; b.pos.z = p.z; b.pos.y = world.field.heightAt(p.x, p.z) + (b.hy || 0.86) + 0.02;
    b.v.x = 0; b.v.y = 0; b.v.z = 0;
  }
  v._unloadT = world.t;
}
```
state.js executeWithdrawal's exemption gains `|| b.rideApc != null`.

DepotGame ringBell, after the doctrine block — the two unconditional draws, then the decision:
```js
        // P7 T8: THE FERRY. Two draws EVERY bell (draw-then-clamp law);
        // eligibility only gates what they buy. Drop = a drawn flank on the
        // player's half, wide of the direct line, never at the depot's feet.
        {
          const ferryRoll = world.rng(), dropRoll = world.rng();
          const ea = world.bodies.find((b) => b.kind === "vehicle" && b.team === 2 && b.vtype === "apc" && b.alive);
          const seated = ea ? world.bodies.filter((b) => b.kind === "unit" && b.rideApc === ea.apcSeq && b.alive).length : 0;
          if (ea && !ea.ferry && seated === 0 && S.ws.mixBag.length >= 4 && ferryRoll < 0.4) {   // provisional (F5)
            const cands = [];
            for (const band of PASSES) for (const g of band) { const c = invW(g.x, g.z); if (c.v > 0 && c.v < 40) cands.push({ x: g.x, z: g.z, u: c.u }); }
            const depotP2 = TOWN.find((tt) => tt.depot && tt.team !== 2);
            const far = cands.filter((c2) => depotP2 && Math.hypot(c2.x - depotP2.x, c2.z - depotP2.z) > 18);
            const wide = far.filter((c2) => Math.abs(c2.u - (depotP2 ? invW(depotP2.x, depotP2.z).u : 0)) > 15);
            const pool = wide.length ? wide : far.length ? far : cands;
            if (pool.length) {
              const drop = pool[Math.min(pool.length - 1, Math.floor(dropRoll * pool.length))];
              const four = [];
              for (let k = 0; k < S.ws.mixBag.length && four.length < 4; ) {
                if (S.ws.mixBag[k] !== "tank") four.push(S.ws.mixBag.splice(k, 1)[0]); else k++;
              }
              S.ws.spawnQueue -= four.length;
              for (const tag of four) {
                const u = spawnUnit(world, { x: ea.pos.x, z: ea.pos.z }, tag);
                u.rideApc = ea.apcSeq;
              }
              ea.ferry = "out"; ea.order = "move"; ea.dest = { x: drop.x, z: drop.z }; ea._route = null; ea._routeDest = null;
            }
          }
        }
```
And the arrival watch in stepDepot (one cheap check beside the transports call):
```js
    // P7 T8: the ferry's turnaround — arrived out: drop the ramp and turn
    // for home; arrived back: the post resumes.
    for (const b of world.bodies) {
      if (b.kind !== "vehicle" || b.team !== 2 || b.vtype !== "apc" || !b.ferry || !b.alive) continue;
      if (b.order === "defend") {   // armorGoal's arrival flip
        if (b.ferry === "out") { unloadEnemyRiders(world, b); b.ferry = "back"; b.order = "move"; b.dest = { x: b.homeX != null ? b.homeX : b.pos.x, z: b.homeZ != null ? b.homeZ : b.pos.z }; b._route = null; b._routeDest = null; }
        else b.ferry = null;
      }
    }
```
(`unloadEnemyRiders` joins the transports import; `spawnUnit` is already imported; `cmdrOf, cmdrBellOrders` join the ai import.)

## Step 5 — The whisper

intel.js: a COMMANDER pool (3 variants per profile, digit-free) + the family appended LAST; composeIntel gains an optional 4th arg `cmdr`:
```js
const COMMANDER = {
  cautious: ["Their armor idles under nets. The commander counts his ground.",
             "Engine warm-ups logged, no movement. A patient hand opposite.",
             "Armor holds the yard. Doctrine reads deliberate."],
  bold:     ["Track noise forward with the infantry. Their armor rides the assault.",
             "The commander opposite leads with steel. Expect armor early.",
             "Armor seen at the muster line, engines hot."],
  stubborn: ["Their armor has not moved in days. Dug in at the yard.",
             "The commander opposite will not risk his steel. It guards the gate.",
             "Armor static under guard. It is not coming."],
};
```
`tryFamily(!!(cmdr && COMMANDER[cmdr]), COMMANDER[cmdr] || [], null)` — appended after MARKSMAN. fireBell passes `S.cmdr` through (state.js: composeIntel(S.intelPlan, reg, rng, S.cmdr) — signature extended, old callers unaffected).

## Step 6 — Version, gates, ship

- version mk1.37 → mk1.38. Gates: depot-test, depot-lint, build (after bump), smoke. NOT golden.
- Expected re-pins: any bell-sequence draw-count pin (the two new per-bell draws move every downstream fixed-seed fixture that crosses a bell — the T6-keystone-class recaptures, named old→new); the intel 200-seed sweep extends to the new family.
- Commit exactly (src/depot/ai.js, src/depot/intel.js, src/depot/state.js, src/depot/transports.js, src/depot/DepotGame.jsx, src/depot/save.js, scripts/depot-test.mjs, src/version.js), push. Message: `the enemy learns to drive: a commander takes the field (mk1.38)`.
- Owner's live check: over a few wars the enemy armor plays differently — sometimes it rides out early with the assault, sometimes it sits until the war turns, sometimes it never moves; the APC occasionally runs men to a flank on your half and drives home; the intel card sometimes whispers which; a committed Bison heads home between bells.

**Report format:** read-confirmation; one line of outcome; the full per-bell draw arithmetic; every re-pin old→new; every deviation its own bullet; smoke stated plainly.
