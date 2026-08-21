*Part of the P7 phase plan — `2026-08-14-armor-demolition-p7.md` holds the skeleton and binding rulings.*

*HISTORY (stamped 2026-08-20, owner's order): this document is a record of shipped work, not authority. Design truth lives in CLAUDE.md and the ACTIVE phase's plan documents; where this file disagrees with them, it is wrong.*

# Task 7 — Runners and breakers for both sides (mk1.36) — FULL PLAN

**What it does, in one line:** the runner and the breaker join YOUR production list at tier 1, mirroring the enemy's — runner squads of four who actually run (~5 m/s on a new per-type squad speed), breaker pairs of two heavies whose sustained shoulder-grind works enemy masonry's welds apart (one breaker can't crack a joint; the PAIR can — that is why they come in twos), with the ram rule gone symmetric for the hp-bearing structures the enemy will one day build.

**Rulings embedded (owner, 2026-08-14, in the decision record):** squads of 4/2; per-type speed; symmetric ram; tier 1 mirror. The enemy side is untouched — it already fields and buys both.

**Suggested model:** Sonnet 5.

**Required reading (re-verified at dispatch — Task 6 is landing in these files as this is written; anchors are named by content, not line):**
- This file whole; the decision record's RUNNERS & BREAKERS ruling.
- `src/depot/squads.js` whole (SQUAD_SPECS, MOVE_SPEED and every site that consumes it: seekGoal, the anchor advance, drivePossessedSquad; spawnSquadMembers is in state.js but its member stats matter here).
- `src/depot/state.js` — spawnSquadMembers, squadFire, possessedVolley, INFANTRY_ARMS consumption.
- `src/depot/specs.js` — INFANTRY_ARMS, ENEMY_SPECS (fast/heavy — the mirror stats), PLAYER_TIERS, MASON.
- `src/depot/units.js` — stepBreakerRam whole (the rule going symmetric), spawnUnit's heavy stats.
- `src/depot/market.js` — FAMILY_OF_SQUAD/FAMILY_OF_TAG (runner/breaker families exist; the player types join them).
- `src/depot/DepotGame.jsx` — PALETTE, SQUAD_MODE, placeSquadAt, the pie's patrolOk/structOk gates.
- `src/engine/core.js` — addWeld/weldBreakPass (:404-416, :1659-1691, READ ONLY) — the weld `acc` fatigue channel the grind feeds, exactly as explode() feeds it.
- `scripts/depot-test.mjs` — harness, the squad-speed-sensitive fixtures (anything pinning MOVE_SPEED or march timings), the P7 blocks.

**Trap notes (binding):**
1. Per-type speed replaces the flat MOVE_SPEED at every consumer: seekGoal reads the member's own `u.utype` (`SQUAD_SPECS[u.utype]?.speed || 3.2`), the anchor advance and drivePossessedSquad read the squad's type. Existing types carry NO speed field and must resolve to exactly 3.2 — every existing march fixture is the proof; if one moves, the fallback is wrong.
2. Member stats go per-type: SQUAD_SPECS rows may carry `member: { mass, hx, hy, hz, hp }`; spawnSquadMembers reads them with today's literals as defaults. Runners mirror ENEMY_SPECS.fast (62 kg, hp 36, 0.24/0.82); breakers mirror ENEMY_SPECS.heavy (340 kg, hp 290, 0.46/1.02). Existing types spawn byte-identically.
3. THE GRIND: game-layer weld fatigue through the engine's own `acc` channel (the explode() pattern — written post-step, consumed by the next weldBreakPass; core.js is NOT edited). A grinding breaker in contact with hostile sleeping masonry at real shove speed adds BREAKER_GRIND force-equivalent per step to that chunk's welds. BREAKER_GRIND = 55,000 — deliberately UNDER the 80,000 masonry weld: one breaker never cracks a joint, two grinding the same stone exceed it. // provisional (F5)
4. The ram rule goes team-agnostic for hp-bearing structures: stepBreakerRam matches breaker-type units of EITHER team (enemy `tag === "heavy"`, player `utype === "breakers"`) against the OTHER side's walls/towers. Inert for the player until the enemy builds them (F3) — asserted, not dead code.
5. Breakers with 340 kg members clear the mk0.98 infantry-can't-wake-masonry exemption (mass < 200) by design — they batter, that is their identity.
6. Tier 1 becomes a 5-item pool (mg, sq_mg, frost, sq_runners, sq_breakers) — manifest draw counts are FIXED (4) and unaffected; the pool-size fixtures re-pin, named.
7. Market: the player types join the EXISTING runner/breaker families (one shared market with enemy fast/heavy) — no new K rows.
8. Renderer: new utypes draw through the con table like every unclassed man; a breaker draws man-sized over a 0.46 hitbox — the enemy heavy has always done the same, accepted precedent, stated in the report.
9. Interface: nothing new — placement, pie, patrol, structures, possession all flow from SQUAD_SPECS + INFANTRY_ARMS membership. Verify each gate picks the new types up (patrolOk, structOk, reach fan, possessed volley) — fixtures, not assumptions.
10. No new rng draws anywhere; depot-lint gates.

## Step 1 — Asserts first (failing)

Append the P7 T7 block before the fails check.

```js
// ==== P7 T7: RUNNERS AND BREAKERS ===========================================
{
  const flatF = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (x, z, o) => { o.x = 0; o.y = 1; o.z = 0; return o; } };
  // (a) the mirror stats
  ok("T7(a): runner squad is 4 who run", SQUAD_SPECS.runners.n === 4 && SQUAD_SPECS.runners.speed === 5.0);
  ok("T7(a2): breaker pair is 2 heavies", SQUAD_SPECS.breakers.n === 2 && SQUAD_SPECS.breakers.member.mass === 340 && SQUAD_SPECS.breakers.member.hp === 290);
  ok("T7(a3): both carry the rifle table", INFANTRY_ARMS.runners.weapon === "rifle" && INFANTRY_ARMS.breakers.weapon === "rifle");
  // (b) they actually run: same order, same distance — the runner squad's
  // anchor arrives in well under 2/3 the rifle squad's time
  {
    const time = (type) => {
      const w = makeWorld({ field: flatF, seed: 51 }); w.depotCombat = true;
      const sq = makeSquad(1, type, 1, 0, 0);
      spawnSquadMembers(w, sq);
      sq.order = "move"; sq.dest = { x: 0, z: 30 };
      let steps = 0;
      while (sq.order === "move" && steps < 4800) { stepSquad(w, sq, w.dt); stepWorld(w); steps++; }
      return steps;
    };
    const tR = time("rifles"), tRun = time("runners");
    ok("T7(b): runners cross in under 2/3 the rifles' time", tRun < tR * 0.67, `${tRun} vs ${tR}`);
  }
  // (c) existing types are byte-identical: a rifles march fixture at the old
  // pace (the fallback proof — reuse an existing pinned timing if one exists,
  // else assert time("rifles") within the band the T7(b) run measured before
  // the change, captured pre-move per the pin protocol)
  // (d) THE PAIR'S GRIND: a welded stone wall; ONE breaker grinding never
  // breaks a weld in 20s; TWO grinding the same stones break welds
  {
    const wallUp = (w) => { /* 6x3 welded sleeping chunk wall at z 4, town "depot2", MASON.breakF — the T2 diag shape */ };
    const grindRun = (nBreakers) => {
      const w = makeWorld({ field: flatF, seed: 52 }); w.depotCombat = true;
      wallUp(w);
      const sq = makeSquad(1, "breakers", 1, 0, -3);
      spawnSquadMembers(w, sq);
      if (nBreakers === 1) { const u = w.byId.get(sq.memberIds[1]); if (u) applyDamage(w, u, 1e9, { attacker: "world" }); }
      sq.order = "attack"; sq.dest = { x: 0, z: 8 };
      for (let i = 0; i < 2400; i++) { stepSquad(w, sq, w.dt); stepBreakerRam(w); stepWorld(w); }
      return w.welds.filter((wd) => wd.broken).length;
    };
    ok("T7(d): one breaker cannot crack a joint", grindRun(1) === 0);
    ok("T7(d2): the pair works welds apart", grindRun(2) > 0);
  }
  // (e) the symmetric ram: a player breaker vs a team-2 WALL body (F3-shape
  // fixture) grinds its hp down, exactly as the enemy heavy does to yours
  // (f) tier 1 is a 5-item pool now
  {
    const M = makeManifestState();
    const p1 = manifestPool(M.unlocked, 1);
    ok("T7(f): bell 1 offers five", p1.length === 5 && p1.includes("sq_runners") && p1.includes("sq_breakers"), p1.join(","));
  }
  // (g) one market: a live player runner and an enemy runner price the same
  // family (marketCounts merges them)
  // (h) the pie gates: runners/breakers get PATROL and STRUCTURES (armed,
  // not engineers/sappers), the reach fan resolves, possessedVolley fires
}
// ==== end P7 T7 ==============================================================
```
((c)'s pin is captured pre-change per the Task 1 protocol; (d)'s wall helper, (e), (g), (h) are written against the harness's existing shapes.)

## Step 2 — specs.js and squads.js: the types

INFANTRY_ARMS gains the two rows (the rifle table — one gun, four hands; breakers at the enemy heavy's own 1.1 s working cadence):
```js
  runners:  { projSpeed: 90, kind: "mg", weapon: "rifle", dmg: 5, dirDmg: 15, fireRate: 1.3, range: 15,
              acc: 0.090, occl: "arc", windF: 0.06, windComp: 0.6 },
  breakers: { projSpeed: 90, kind: "mg", weapon: "rifle", dmg: 5, dirDmg: 15, fireRate: 1.1, range: 15,
              acc: 0.090, occl: "arc", windF: 0.06, windComp: 0.6 },
```
PLAYER_TIERS tier 1 becomes `["mg", "sq_mg", "frost", "sq_runners", "sq_breakers"]` (the two-ladder comment table updates with it).

SQUAD_SPECS gains (squads.js):
```js
  // P7 T7 (owner): the enemy's tier-1 types join YOUR list — mirrors of
  // ENEMY_SPECS.fast/heavy, squads of 4 and 2, at tier 1 both sides.
  runners:  { n: 4, cost: 34, label: "RUNNER SQUAD", speed: 5.0,             // provisional (F5)
              member: { mass: 62, hx: 0.24, hy: 0.82, hz: 0.24, hp: 36 } },
  breakers: { n: 2, cost: 40, label: "BREAKER PAIR", speed: 2.1,             // provisional (F5)
              member: { mass: 340, hx: 0.46, hy: 1.02, hz: 0.46, hp: 290 } },
```
THE PER-TYPE SPEED — one helper, three consumers, fallback exactly 3.2:
```js
export const squadSpeed = (type) => (SQUAD_SPECS[type] && SQUAD_SPECS[type].speed) || MOVE_SPEED;
```
- seekGoal's `const sp = MOVE_SPEED;` becomes `const sp = squadSpeed(u.utype);` (members carry utype).
- stepSquad's anchor advance `MOVE_SPEED * dt` becomes `squadSpeed(squad.type) * dt` (both the leg step and the double-time step derivation stay proportional).
- drivePossessedSquad's `MOVE_SPEED * dt` likewise.
- The wake-kick in seekGoal uses its local `sp` already — verify, don't duplicate.

spawnSquadMembers (state.js) reads the member override:
```js
    const M = spec.member || { mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, hp: 58 }; // today's literals, byte-identical for every existing type
    const u = addBody(world, { kind: "unit", team: 1, mass: M.mass, hx: M.hx, hy: M.hy, hz: M.hz,
      x: p.x, y: world.field.heightAt(p.x, p.z) + M.hy + 0.02, z: p.z, hp: M.hp, friction: 0.5 });
```
(the y seat follows the member's own hy; the ring clearance already reads u.hx.)

## Step 3 — units.js: the ram goes symmetric, the grind lands

stepBreakerRam rewritten team-agnostic, same contact walk:
```js
// P7 T7 (owner): the ram is SYMMETRIC. A breaker-type unit of either side
// (enemy tag "heavy", player utype "breakers") works the OTHER side's
// structures on contact: hp-bearing walls/towers take the ram damage the
// enemy rule always dealt; sleeping welded masonry takes GRIND — fatigue
// fed straight into the welds' own acc channel (the explode() pattern; the
// engine consumes it next weldBreakPass, core untouched). BREAKER_GRIND
// sits UNDER one weld's break force on purpose: one breaker leans forever,
// the PAIR working the same stone exceeds it — that is why they come in twos.
export const BREAKER_GRIND = 55000; // provisional (F5)
export function stepBreakerRam(world) {
  for (const c of world.contacts) {
    if (c.pn <= 0 || !c.b) continue;
    const a = c.a, b = c.b;
    const isBreaker = (u) => u.kind === "unit" && u.alive && (u.tag === "heavy" || u.utype === "breakers");
    const unit = isBreaker(a) ? a : isBreaker(b) ? b : null;
    if (!unit) continue;
    const str = unit === a ? b : a;
    const foe = (unit.team === 2 && str.team === 1) || (unit.team === 1 && str.team === 2);
    if ((str.kind === "wall" || str.kind === "tower") && str.alive && foe) {
      if (str.kind === "wall" && str.course > 0) continue; // work the BASE (P1.5 T2's rule)
      const sp = Math.hypot(unit.v.x, unit.v.z);
      if (sp > 0.8) { applyDamage(world, str, sp * world.dt * 16, { attacker: unit.team === 2 ? "enemy" : "player" }); str.hitT = world.t; }
    } else if (str.kind === "chunk" && str.alive && hostileStructure(str, unit.team)) {
      const sp = Math.hypot(unit.v.x, unit.v.z);
      if (sp < 0.8) continue;      // a lean is not a grind — he has to work it
      const wl = world.weldsOf && world.weldsOf.get(str.id);
      if (!wl) continue;
      const dxg = str.pos.x - unit.pos.x, dzg = str.pos.z - unit.pos.z;
      const dg = Math.hypot(dxg, dzg) || 1;
      const j = BREAKER_GRIND * world.dt;
      for (const wd of wl) { if (!wd.broken) { wd.acc[0] += (dxg / dg) * j; wd.acc[2] += (dzg / dg) * j; } }
    }
  }
}
```
(`hostileStructure` joins units.js's state.js import — verify it is already there.)

## Step 4 — The plumbing: palette, tiers, market, modes

- DepotGame PALETTE gains, after sq_engineers:
```js
  { key: "sq_runners", label: "RUNNERS", icon: "⇶", cost: SQUAD_SPECS.runners.cost },
  { key: "sq_breakers", label: "BREAKERS", icon: "⨳", cost: SQUAD_SPECS.breakers.cost },
```
- SQUAD_MODE gains `sq_runners: "runners", sq_breakers: "breakers"`.
- market.js FAMILY_OF_SQUAD gains `runners: "runner", breakers: "breaker"` — the shared families; no new K rows.
- The pie/reach/possession gates need NO edits (membership-driven) — the (h) fixtures prove it; if one fails, the gate hardcodes a type list somewhere: fix THAT site to membership, named.

## Step 5 — Version, gates, ship

- `src/version.js`: `"mk1.35"` → `"mk1.36"`.
- Gates, ONLY these: `node scripts/depot-test.mjs`, `node scripts/depot-lint.mjs`, `npm run build` (after the bump), `node scripts/smoke.mjs`. golden NOT run.
- Expected re-pins: the tier-1 pool-size asserts (3 → 5 items — the manifest block's "bell 1 offers tier 1 only" and its pool joins); any MOVE_SPEED-timing pin. Name each old→new.
- Commit the task's files only (src/depot/specs.js, src/depot/squads.js, src/depot/state.js, src/depot/units.js, src/depot/market.js, src/depot/DepotGame.jsx, scripts/depot-test.mjs, src/version.js), push. Message: `runners and breakers: the tier-1 mirror closes (mk1.36)` with the standard trailers.
- The owner checks live, phone and desktop: RUNNERS and BREAKERS on the bell-1 convoy; a runner squad visibly sprints past a rifle squad on the same order; a breaker pair shoulders into enemy masonry and the welds start cracking — one alone leans harmlessly; both types take every pie order, patrol, possess, and volley like any squad; prices ride the same families the enemy's runners and breakers already move.

**Report format:** read-confirmation first; one line of outcome; every re-pin old→new named; every deviation its own bullet; smoke stated plainly.
