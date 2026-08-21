# P7 Task 12 — spawn ground learns vehicles (mk1.42)

*HISTORY (stamped 2026-08-20, owner's order): this document is a record of shipped work, not authority. Design truth lives in CLAUDE.md and the ACTIVE phase's plan documents; where this file disagrees with them, it is wrong.*

*2026-08-17. The fielded-start kill, root-caused and reproduced (500-seed headless repro, `.superpowers/diag-fielded-start.mjs`): `slotBlocked`/`clearSlot` (squads.js) vet static solids only — a parked hull is invisible to every spawn and slot site. The free runner and breaker squads spawn overlapping the player's parked Bison or APC; the engine's shove-apart kills the overlapped men at second zero; a squad at zero men is silently deleted. 21% of wars lose men to this at boot, ~2% lose a whole squad. The fix goes in the one shared law, so every consumer — squad spawns, home guard, garrison replacements, unload rings, formation slots, the march steer-around — inherits it.*

**Suggested model: Sonnet** — fully specced, mechanical execution, no design left open.

**Scope:** `src/depot/squads.js`, `src/depot/lists.js`, `src/depot/transports.js` (comment only), `scripts/depot-test.mjs`, `src/version.js`. Nothing else. No engine change — golden does not run.

**Non-goals (owner-scoped):** vehicles do NOT become cover (`exposureAt` untouched); `accuracy.js`'s own SOLID_KINDS (shot tracing) untouched; `parkArmor`'s 7m hull-to-hull spacing check untouched (already stronger than this law).

## Required reading, in order (verify anchors before code)

1. `src/depot/squads.js` 88–203 — SOLID_KINDS, `exposureAt`, `slotBlocked`, `clearSlot`, `memberClear`; and 338–399 (`seekGoal`'s `blockedAhead` — a consumer).
2. `src/depot/lists.js` whole (52 lines) — the pool contract; note `statics` requires `invM === 0`, so it can never carry a vehicle.
3. `src/depot/transports.js` whole (139 lines) — the STANDOFF comment (15–24) documents the blindness this task fixes; boarding rally geometry (65–99); both unload rings.
4. `src/depot/DepotGame.jsx` 1839–1885 — home guard + fielded start (the killed site); 1400–1450 (`parkArmor`, boot order: hulls park before the fielded start runs).
5. `src/depot/state.js` 702–741 — `spawnSquadMembers` (per-member `clearSlot`).
6. `scripts/depot-test.mjs` 1–50 (imports — everything Step 1 needs is already imported) and 7561–7607 (the T9(e) fixture idiom the new block follows).
7. `src/depot/specs.js` 84 and 99 — BISON (hx 2.2, hz 3.3) and APC (hx 1.6, hz 3.0).

## Trap notes

- **The invM guard eats vehicles.** `slotBlocked` skips every dynamic body (`b.invM > 0`) before the kind test. Adding `"vehicle"` to SOLID_KINDS does NOTHING. The fix is the separate hull loop in Step 3. Do not touch SOLID_KINDS.
- **The statics pool can't help.** `lists.js` files only `invM === 0` solids into `statics`. Hulls need their own pool (Step 2); fixtures that never build lists fall back to `world.bodies` (the branch in Step 3 handles both).
- **Escape must exist.** `clearSlot`'s sweep tops out at r 4.8m. Worst hull half-extent + clearance = 3.3 + 0.63 = 3.93 < 4.8, so a slot at hull center always escapes. Do not shrink the sweep.
- **Boarding must stay green.** The rally point sits at footprint radius + 2.2m (transports.js STANDOFF) — outside the blocked box. The T4 boarding fixtures must pass with ZERO retunes. If one fails, STOP and report; do not adjust STANDOFF, BOARD_R, or the fixtures.
- **Draw-count law.** The change adds zero rng draws anywhere. Boot draws stay 45. T9(e3)/(f)/(f2) must pass unmoved.
- **Expected re-pins: zero.** T9(e) is a bare world (no armor). If any pin moves anyway, re-pin honestly and report old → new as its own labeled bullet.

## Steps

**Step 1 — the failing asserts land first.** In `scripts/depot-test.mjs`, insert after line 7607 (`// ==== end P7 T9 ====`), before the T10 block:

```js
// ==== P7 T12: SPAWN GROUND LEARNS VEHICLES ===================================
// The fielded-start kill (owner, 2026-08-17): slotBlocked vetted static solids
// only — a parked hull was invisible to every spawn/slot site. The fielded-
// start squads spawned overlapping the player's parked armor; the engine's
// shove-apart killed the men at second zero and the empty squads were silently
// deleted. The law learns hulls; every consumer inherits the fix.
{
  const flatF12 = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (x, z, o) => { o.x = 0; o.y = 1; o.z = 0; return o; } };
  // (a) the law itself: a live hull blocks a slot at its box + clearance.
  {
    const w = makeWorld({ field: flatF12, seed: 11 });
    const v = addBody(w, { kind: "vehicle", team: 1, mass: BISON.mass, hx: BISON.hx, hy: BISON.hy, hz: BISON.hz, x: 0, y: BISON.hy + 0.05, z: 0, hp: BISON.hp, friction: 0.85 });
    v.vtype = "bison";
    ok("T12(a): a live hull blocks the slot at its box + clearance", slotBlockedPublic(w, 0, 0, 0.63) === true);
    const p = clearSlot(w, 0, 0, 0.63);
    ok("T12(a2): clearSlot hands back ground clear of the hull box",
      Math.abs(p.x - v.pos.x) > v.hx + 0.63 || Math.abs(p.z - v.pos.z) > v.hz + 0.63, `${p.x.toFixed(2)},${p.z.toFixed(2)}`);
    v.alive = false;
    ok("T12(a3): a dead hull stops blocking", slotBlockedPublic(w, 0, 0, 0.63) === false);
  }
  // (b) the owner's report, reproduced and closed: the fielded start beside a
  // hull parked exactly on the runners' fixed 11m azimuth — every man spawns
  // clear of the box and lives through 3 simulated seconds. Before the fix the
  // men spawn inside the box and the shove-apart kills them.
  {
    const w = makeWorld({ field: flatF12, seed: 801 });
    const depotP = { x: -40, z: -40 };
    const hx0 = depotP.x + Math.sin(0.9) * 11, hz0 = depotP.z + Math.cos(0.9) * 11;
    const v = addBody(w, { kind: "vehicle", team: 1, mass: BISON.mass, hx: BISON.hx, hy: BISON.hy, hz: BISON.hz, x: hx0, y: BISON.hy + 0.05, z: hz0, hp: BISON.hp, friction: 0.85 });
    v.vtype = "bison"; v.sleeping = true;
    const squads = [];
    let nextSquadId = 1;
    for (const type of ["runners", "breakers"]) {
      const a = type === "runners" ? 0.9 : 2.3;
      const p0 = clearSlot(w, depotP.x + Math.sin(a) * 11, depotP.z + Math.cos(a) * 11, 0.5);
      const sq = makeSquad(nextSquadId++, type, 1, p0.x, p0.z);
      spawnSquadMembers(w, sq);
      squads.push(sq);
    }
    const men = squads.flatMap((sq) => sq.memberIds.map((id) => w.byId.get(id)));
    ok("T12(b): no man spawns inside the parked hull's box",
      men.every((u) => Math.abs(u.pos.x - v.pos.x) > v.hx + u.hx || Math.abs(u.pos.z - v.pos.z) > v.hz + u.hz));
    for (let i = 0; i < 360; i++) stepWorld(w);
    ok("T12(b2): every fielded man is alive 3 seconds in", men.every((u) => u.alive), `${men.filter((u) => u.alive).length}/6 alive`);
  }
}
// ==== end P7 T12 =============================================================
```

Run `node scripts/depot-test.mjs` — T12(a), (a2), (b), (b2) must FAIL (a3 passes trivially). Report the failing output.

**Step 2 — the hull pool.** In `src/depot/lists.js`:

Line 17, `makeBodyLists` — the returned object gains one list:

```js
  return { solids: [], statics: [], friends: [], foes: [], structsFor1: [], structsFor2: [], friendly: [], vehicles: [] };
```

Line 26 area, `rebuildBodyLists` — clear it with the others:

```js
  L.friends.length = 0; L.foes.length = 0; L.vehicles.length = 0;
```

Lines 31–35, the unit/vehicle branch — file hulls as they pass:

```js
    if (k === "unit" || k === "vehicle") {
      // P7 T12: hulls get their own small pool — slotBlocked's hull test
      // (squads.js) reads it; the statics pool can never carry one (dynamic).
      if (k === "vehicle") L.vehicles.push(b);
      if (b.team === 1) L.friends.push(b);
      else if (b.team === 2) L.foes.push(b);
      continue;
    }
```

**Step 3 — the law learns hulls.** In `src/depot/squads.js`, `slotBlocked` (line 181) gains a second loop before `return false`:

```js
  // P7 T12: THE HULL IS GROUND TOO — a live vehicle blocks a slot exactly as
  // masonry does (same box + clearance test). The static pool above can never
  // carry one (a hull is dynamic, and the invM guard skips it), so hulls ride
  // their own small pool. This is the fielded-start fix: every spawn, slot,
  // and steer-around site inherits it through this one law.
  const vpool = world._L ? world._L.vehicles : world.bodies;
  for (const b of vpool) {
    if (!b.alive || b.kind !== "vehicle") continue;
    if (Math.abs(x - b.pos.x) <= b.hx + clear && Math.abs(z - b.pos.z) <= b.hz + clear) return true;
  }
  return false;
```

And the block comment above SLOT_CLEAR_PAD (lines 170–180) gains one closing line:

```js
// P7 T12: live vehicle hulls are vetted too (their own loop below — the
// static pool can't carry a dynamic body), so no spawn or slot ever lands
// a man inside parked or moving armor.
```

**Step 4 — the stale comment re-teaches.** In `src/depot/transports.js`, replace the STANDOFF comment (lines 15–23) with:

```js
// STANDOFF (found running the boarding fixture, not guessed): the march goal
// must never sit at the hull's own center — core.js's CRUSH rule reads the
// resulting collision as a tank squashing its own boarding squad. Since P7
// T12 clearSlot DOES vet hulls, but the rally point stays explicitly outside
// the footprint radius (hypot(v.hx, v.hz)) anyway: the boarding goal must be
// deterministic and reachable, not wherever the clearance sweep happens to
// shove a center point. Clears the formation ring too (rifles/mg ring at
// 1.5m, squads.js slotFor), so no member's slot can land inside the hull. // provisional (F5)
```

**Step 5 — gates.** Run exactly: `node scripts/depot-test.mjs` (all green, T12 block included), `node scripts/depot-lint.mjs`, the build, `node scripts/smoke.mjs`. Golden does NOT run — no engine file changed. Zero re-pins expected; any that move are reported old → new, each its own labeled bullet.

**Step 6 — the landing.** Bump `src/version.js` to `mk1.42`. Build AFTER the bump. Commit all five files, message: `spawn ground learns vehicles: the fielded start survives its own armor (mk1.42)`. Push. Report with the read-confirmation opening, gate results, and the deviation list.
