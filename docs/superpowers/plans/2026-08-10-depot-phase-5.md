# DEPOT Phase 5 Implementation Plan — Infantry (REVISED after Task 1)

*HISTORY (stamped 2026-08-20, owner's order): this document is a record of shipped work, not authority. Design truth lives in CLAUDE.md and the ACTIVE phase's plan documents; where this file disagrees with them, it is wrong.*

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Revision notes:** (post-Task-1, 2026-08-10): Task 1 shipped (`fb91e9e`) and falsified one plan assumption: units.js has NO reusable walk-to-point machinery (its march is flow-field + team-2 only). squads.js therefore owns its own `seekGoal` velocity steer, squads advance as a block (anchor cover-hops, members hold formation slots, ONE rng draw per attack leg), and sandbags need no new body kind (`chunk` masonry is already what exposure scoring sees). Tasks below are rewritten against the shipped module. Also folded in per Jeff: **wave timeout** — waves advance on annihilation OR a time trigger (stuck units must never wedge the run).

**Goal:** Commandable infantry squads both sides — sniper (1), rifles (4), MG team (2) — placed like towers, per-squad DEFEND/ATTACK-to-point orders, cover-to-cover advance, real-geometry cover + sandbags, persistence without healing. Enemy mirror: cover-aware halt points + an AI-placed sniper. Plus: screen-constant buildable-edge line, and the wave-timeout guard.

## Global Constraints

- Frozen modes + core.js untouched (STOP on any core need). No `Math.random()` in src/depot — NOTE the lint is a text grep: never write the string in comments either.
- All new combat through `shooterFire`/accuracy.js. Squad movement rng: exactly one draw per attack leg (shipped contract); squad combat draws only via applyScatter's two per shot.
- squads.js stays movement-pure (no combat, no imports from state.js). Member FIRE lives in state.js (`squadFire`) which already owns shooterFire/effRange/fieldReaches — no import cycles.
- Members are ordinary team-1 unit bodies: engine integrates their velocity; territory/fog/combat see them for free. Nothing in any restock/respawn path may touch them.
- Jeff's locked decisions govern (vision "Phase 5 decisions"). Scoped verification; SMOKE_ONLY=depot; FOREGROUND CI polls; commit locally per task, batch push at the closer.
- Commit trailer: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

---

### Task 1: squads.js — DONE (`fb91e9e`)

Shipped interfaces (from the real module, authoritative): `SQUAD_SPECS {sniper 1/30, rifles 4/20, mg 2/25}` · `makeSquad(id, type, team, x, z)` → `{id, type, team, order, dest, memberIds, anchor, _legTarget, _pauseT, _threatSig}` · `exposureAt(world, x, z, threatBearing)` → 0..1 (best single cover wins; ±60° arc, 2.2m radius, weight `arcW * (0.7 + 0.3*distW)`) · `coverHop(world, from, dest, threatBearing)` → 12-point ring sample at 6m, lowest exposure among distance-reducing candidates · `stepSquad(world, squad, dt)` — defend: formation ring 2.4m, per-member low-exposure slot within 3m recomputed on 45°-sector threat change; attack: block advance by coverHop legs, 1.5-3s pause per leg (1 draw), flip to defend at dest (<1m). Writes `u.goal`/`u.v` only.

### Task 2: infantry combat — specs + squadFire

**Files:** Modify `src/depot/specs.js` (INFANTRY_ARMS table), `src/depot/state.js` (squadFire), extend `scripts/depot-test.mjs`.

**specs.js addition (verbatim):**

```js
// Infantry arms — both teams use identical values (symmetry). All fire flows
// through shooterFire + the accuracy model; occl/windF/windComp like any shooter.
export const INFANTRY_ARMS = {
  sniper: { projSpeed: 120, kind: "mg", dmg: 65, fireRate: 4.5, range: 30,
            acc: 0.006, occl: "arc", windF: 0.10, windComp: 0.8 },
  rifles: { projSpeed: 90, kind: "mg", dmg: 5, fireRate: 1.3, range: 15,
            acc: 0.090, occl: "arc", windF: 0.06, windComp: 0.6 },
  mg:     { projSpeed: 100, kind: "mg", dmg: 5, burst: 6, burstGap: 0.17, fireRate: 2.2,
            range: 17, acc: 0.070, occl: "arc", windF: 0.06, windComp: 0.6 },
};
```

**state.js `squadFire(world, squad, dt)`:** members fire only while stationary (order "defend", or attack-paused `_pauseT > 0`). Per member: cooldown timer on the body (`u.fireCd`); target = nearest enemy unit/vehicle within `effRange(world, u, arm)` passing `fieldReaches` (own team sign) AND `arcClears` (selfId excluded) — the exact gate stack towers use; fire via `shooterFire`. MG burst: on trigger, queue `burst` rounds spaced `burstGap` (the existing delay param on fireProjectile — verify towerShot's volley handling and mirror). Sniper vs armor: NO special case — `b.armor` thresholds already reduce a 65-dmg hit to scratch on tanks (verify by assert, tanks carry armor ≥ 66... READ the armor values; if tank armor < 65 the sniper would penetrate — set the assert to document actual behavior and flag if it contradicts "chip-only").

- [ ] **Step 1: failing asserts** — sniper kills a conscript at 26m from +4 elevation (majority of 10 seeded trials); sniper vs tank chips (< 10 hp/shot); rifles/MG cadence + burst draw-count accounting (2 draws per round via applyScatter, none elsewhere); no fire while a squad is mid-hop (moving); twin determinism of a 20s firefight fixture.
- [ ] **Step 2:** verify fail → **Step 3:** implement → **Step 4:** `node scripts/depot-test.mjs && npm run test:accuracy && npm run lint:depot` → **Step 5:** Commit "DEPOT infantry arms: the scoped rifle, the burst gun, the line".

**Second revision (2026-08-10, post-armor-interlude + bug-family day):** Tasks 3-7 below incorporate the armor wiring (dirDmg/tank armor 140), the four playtest fixes, and today's bug-family lessons. Task 2 amendments already shipped in practice: sniper dirDmg 130, rifles 4.1, mg 3.6 (flagged-DPS parity — the table above is superseded by src/depot/specs.js as shipped).

## Risk register — what we expect to bite (learned today)

1. **The scaffold-filter family** (4 bugs: tower scan, bounty, leak, off-grid — all `kind === "unit"` assumptions). Team-1 infantry is a NEW body class; every consumer of unit bodies may mishandle it. Task 3 carries a sweep assert. Highest-probability victims: corpse cleanup (DepotGame.jsx:534 prunes dead `kind unit` — must not touch team-1 corpses differently than intended), kill-feed/bounty (must NOT pay the attacker bounties for squad kills... or SHOULD it? — results-pay decision says towers pay; squad kills paying is consistent: CHECK economy RESULTS — killing your infantry currently pays them nothing; leave as-is this phase, note for balance), restock guards, fog rendering (team-1 members must render in your own fog everywhere).
2. **The self-hit family** (4 bugs: infantry muzzle, tank shell, grenadier lob, arcClears self-block). Law: every fire call threads `owner`; every LOS/foul check threads `selfId`. New fire paths in Task 4 (enemy anti-personnel) must do both — assert draw/owner on every new path.
3. **The targeting laws** (established by today's fixes, now canonical): STRUCTURE fire never gates on territory (range + arcClears only); UNIT-vs-unit fire always fog-gates. Task 4's shooters implement both; asserts enforce both directions.
4. **Enemy rifles are structure-only** (`hitOnly: "structure"`, specs.js:45-49): they literally cannot hit player squads. Task 4 MUST add anti-personnel targeting or player infantry is invulnerable to their infantry. When their rounds start hitting units, their `dirDmg: 5` WAKES UP (documented inert vs structures) — flagged-DPS parity must be re-measured vs units (expect a rescale to ~4.1 like ours).
5. **Balance is attacker-shifted post-fixes** (honest muster + counter-battery + wall-chewing infantry). Jeff failed at wave 5 pre-misfire-fix. Task 7 is a REBALANCE: early waveBudget ramp is the primary lever; target median-reaches-low-20s.
6. **Pending in-flight**: the spent-misfire fix (state.js) must land before Task 3 dispatches (same file).

### Task 3: wiring — spawn, loop, orders UI, sandbags, persistence

**Files:** Modify `src/depot/DepotGame.jsx`, `src/depot/state.js`, extend depot-test + smoke.

**Spawn (code — adapt to spawnUnit's real shape, units.js:18, but team-1):**
```js
// DepotGame or state.js — spawn a squad's members as team-1 unit bodies.
function spawnSquadMembers(world, squad) {
  const spec = SQUAD_SPECS[squad.type];
  for (let i = 0; i < spec.n; i++) {
    const a = (i / spec.n) * Math.PI * 2, r = 1.2;
    const x = squad.anchor.x + Math.cos(a) * r, z = squad.anchor.z + Math.sin(a) * r;
    const u = addBody(world, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28,
      x, y: world.field.heightAt(x, z) + 0.74, z, hp: 58, friction: 0.5 });
    u.utype = squad.type; u.squadId = squad.id; u.dress = "human";  // player side reads human
    squad.memberIds.push(u.id);
  }
}
```
- Build bar: SNIPER ◆30 / RIFLES ◆20 / MG ◆25 / SANDBAG ◆3. Squad placement = tower flow (green-only + confirm; sniper preview = reachPolygon with INFANTRY_ARMS.sniper, fog-independent per the new preview rule). Sandbag: instant (wall-exempt), single sleeping chunk body (hx .9, hy .45, hz .35, hp 60) tagged `b.sandbag = true`; add to territory emitter builder under EMIT.wall.
- Loop section (after enemies, before towers): prune dead members → delete empty squads → stepSquad → squadFire.
- Selection/orders UI: tap member/marker → ring overlay + DEFEND|ATTACK chips (screen-space, 350ms arming); ATTACK → next ground tap = dest with flag marker; tap-elsewhere deselects.
- Persistence: squads survive stalls; **SWEEP ASSERT (risk 1):** a team-1 member exercised against every unit-body consumer — corpse cleanup leaves squad roster consistent; no bounty paid to attacker on member death; no leak triggered by a member near the depot; emitter list includes members (green side); restock never touches them; fog never hides them from their owner.
- [ ] Failing asserts (incl. sweep) → implement → `node scripts/depot-test.mjs && npm run lint:depot && npm run build && SMOKE_ONLY=depot node scripts/smoke.mjs` (smoke: place → ATTACK → advance; rotated variant) + screenshots → Commit "DEPOT infantry: placed, ordered, dug in, and kept".

### Task 4: the enemy mirror — cover, their sniper, AND anti-personnel fire (risk 4)

**Files:** `src/depot/units.js`, `src/depot/specs.js`, `src/depot/ai.js`, `src/depot/intel.js`, extend depot-test.

- **Anti-personnel (NEW, mandatory):** riflemen/grenadiers gain unit-vs-unit targeting: if a player unit (team-1 kind unit) is within range AND their field reaches it (unit-vs-unit law: fog-gated) AND arcClears — prefer it over structure fire at ≤ 60% range (close infantry is the urgent threat), else structures. Rounds at units need `hitOnly` relaxed — audit the fire spec: drop hitOnly for the anti-personnel shot only; thread owner (self-hit law). Re-measure their flagged DPS vs units; rescale their dirDmg into parity (~4.1 expected).
- **Halt-point cover:** existing halt logic evaluates 5 candidates (current + 4 lateral ≤3m), lowest exposureAt vs target bearing; re-eval on lastHit change, ≤ once/2s.
- **Their sniper:** ENEMY_SPECS entry (price 30, INFANTRY_ARMS.sniper values, dress android); walks flow field until first low-exposure + elevated vantage (small documented heuristic), holds, fires through the same gates (fog-gated vs units — the unit law).
- **ai.js:** sniper joins buys when snap.squads ≥ 2 (snapshot gains squads count). **intel.js:** marksman family, 3 variants, digit-free.
- [ ] Failing asserts: rifleman kills an exposed squad member (fog reached); rifleman does NOT acquire a member beyond their field (fog law); structure fire still territory-free (structure law); DPS parity numbers recorded; sniper vantage hold + kill; AI buy trigger; intel line. → implement → scoped gates → Commit "DEPOT mirror: they shoot back at men now, and one of them has a scope".

### Task 5: buildable-edge line — screen-constant stroke (unchanged from prior revision)
- ~1.5px at dpr 1 at all zooms/rotations; overlay-pass or zoom-inverse width, document. → td-render + smoke + 3-zoom screenshots → Commit "DEPOT: the buildable edge is a line, not a band".

### Task 6: wave timeout (unchanged semantics; now also covers squads era)
- WAVE_TIMEOUT 75s after spawning completes → survivors withdraw (despawn, no bounty/death, heads RETURN to regiment), stall proceeds; dispatch line "Contact broken off. The remainder withdrew in order."; annihilation path untouched; off-grid write-off stays. NOTE (learned): the spent-offensive counter must treat a withdrawn wave as FIELDED (it mustered) — assert the interaction explicitly.
- [ ] Failing asserts (immortal straggler → 75s stall; heads returned exactly; no bounty; withdrawal line truthful; spent-counter unaffected by withdrawal) → implement → scoped gates → Commit "DEPOT: waves end by annihilation or the clock — nobody wedges the war".

### Task 7: closer — REBALANCE + probe + batch push
- The probe is a rebalance this time (risk 5): median must reach low-20s avg again post-fixes. PRIMARY lever: early waveBudget ramp (waves 1-8 flatten); secondary: player start scrap/stipend; NEVER: CAREFUL default, Phase 3 results rates first. Rules: all four sanity + (e) withdrawals < 20% of waves + (f) no empty solvent waves (the new invariant, probe-level).
- Full scoped verify + 3 smokes → commit → PUSH batch → foreground CI poll → prod SMOKE_ONLY=depot ALL PASS → report + phone-check screenshots (squads in action, enemy shooting at them, sniper duel if stageable, thin edge line, withdrawal dispatch).

---
## Self-review notes (second revision)
- Every risk-register item maps to a concrete task change: filters (T3 sweep), self-hit (T4 threading asserts), laws (T4 both directions), structure-only rifles (T4 anti-personnel + parity re-measure), balance (T7 rebalance), in-flight collision (T3 waits for spent-misfire fix).
- Code included where writable today (spawn, sandbag, spec deltas); UI flows remain prose + asserts (they wire into DepotGame's real tap machinery, read at implement time).
- Anti-personnel preference at ≤60% range is a first guess — probe/playtest tunable.
