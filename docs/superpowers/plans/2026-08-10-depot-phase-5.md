# DEPOT Phase 5 Implementation Plan — Infantry (REVISED after Task 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Revision note (2026-08-10, post-Task-1):** Task 1 shipped (`fb91e9e`) and falsified one plan assumption: units.js has NO reusable walk-to-point machinery (its march is flow-field + team-2 only). squads.js therefore owns its own `seekGoal` velocity steer, squads advance as a block (anchor cover-hops, members hold formation slots, ONE rng draw per attack leg), and sandbags need no new body kind (`chunk` masonry is already what exposure scoring sees). Tasks below are rewritten against the shipped module. Also folded in per Jeff: **wave timeout** — waves advance on annihilation OR a time trigger (stuck units must never wedge the run).

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

### Task 3: wiring — spawn, loop, orders UI, sandbags, persistence

**Files:** Modify `src/depot/DepotGame.jsx` (build-bar entries SNIPER ◆30 / RIFLES ◆20 / MG ◆25 / SANDBAG ◆3; member spawning; NEW loop section driving squads; selection + order UI), `src/depot/state.js` (squad roster in run state; persistence), extend depot-test + smoke.

- **Spawning:** placement uses the tower flow (green-only, ghost, confirm ✓/✗; sniper's preview = his 30m reach fan via reachPolygon with INFANTRY_ARMS.sniper). On confirm: `makeSquad` + `addBody` per member (kind "unit", team 1, hp 58, dress: player palette — check how team dress selects and pick the player-side look; positions on the formation ring). memberIds recorded.
- **Loop (new section, after enemy stepping, before towers):** for each live squad — prune dead memberIds; if empty, delete squad; else `stepSquad(world, squad, dt)` then `squadFire(world, squad, dt)`. Squad bodies are territory emitters automatically (EMIT.unit via the existing emitter list builder — VERIFY it includes team-1 units; Phase 4 built it from live bodies by kind+team, read it).
- **Sandbag:** build-bar item, cost 3, instant placement (wall-exempt rule — no confirm): a single `chunk`-kind body (hx 0.9, hy 0.45, hz 0.35, mass high, sleeping) — masonry the exposure scan and blast physics already understand. No weld lattice. Counts for territory via EMIT.wall (verify the emitter builder's kind mapping picks it up as wall-ish; if keyed on kind "wall" exactly, either map chunk-with-flag or tag it `b.sandbag = true` and add to the builder).
- **Selection + orders:** tap a member/squad marker → squad selected (ring overlay under members via renderer overlay API); floating chips DEFEND | ATTACK (screen-space, 350ms arming); ATTACK → next ground tap = dest (flag marker until arrival — reuse the survey-stake/flag machinery); tap elsewhere deselects. Persist selection through rotation.
- **Persistence:** squads + surviving members cross stalls untouched (assert: no restock/reissue path touches team-1 units — read runner restock guards). Casualties permanent; annihilated squad's roster entry pruned.
- [ ] **Step 1: failing asserts** — placement deducts + green-only + confirm; loop drives an ATTACK order end-to-end headless (reuse Task 1's fixtures but through the real state tick); sandbag raises cover (exposureAt drop) and appears in the emitter list; 2-casualty rifle squad persists a stall with 2 members; selection state machine headless.
- [ ] **Step 2:** verify fail → **Step 3:** implement → **Step 4:** `node scripts/depot-test.mjs && npm run lint:depot && npm run build && SMOKE_ONLY=depot node scripts/smoke.mjs` (smoke: place rifles → ATTACK order → squad advances; sandbag place; rotated variant); screenshots: selected squad + chips, sniper fan, sandbag line, mid-advance — task3-*.png → **Step 5:** Commit "DEPOT infantry: placed, ordered, dug in, and kept".

### Task 4: the enemy mirror — narrowed to what their movement model supports

**Files:** Modify `src/depot/units.js` (halt-point cover), `src/depot/ai.js` (sniper buy + vantage placement), `src/depot/intel.js` (marksman lines), extend depot-test.

- **Halt-point cover (NOT cover-to-cover marching — their movement is the flow field):** when riflemen/grenadiers select their halt distance to fire (existing halt logic in units.js), they now evaluate ~5 candidate halt points (current + 4 lateral offsets ≤3m) and take the lowest `exposureAt` (threat bearing = toward their target). Re-evaluate when they take a hit (u.lastHit change), max once per 2s. Deterministic, no rng.
- **Enemy sniper:** joins ENEMY_SPECS as a buyable (price 30, INFANTRY_ARMS.sniper values, dress android). Behavior: walks the flow field until it reaches the first cell where `exposureAt` is low AND elevation ≥ mean forward ground (a vantage heuristic — implementer designs it small, documents it), then HOLDS there permanently and fires via the same squadFire-style gate stack (single member, no squad object needed — a `u.holdFire`-style stationary shooter flag in units.js).
- **ai.js:** sniper enters the buy blend when `snap.squads ≥ 2` (buildSnapshot gains `squads` count — wire in DepotGame's snapshot builder); weight modest (they're expensive per head).
- **intel.js:** marksman family (wired to sniper purchases, one-wave delay, gaps as usual): "Marksman activity reported forward of the line." / "Single-shot reports at long interval. Pattern deliberate." / "A scope flash logged at the ridge. Range disputed." — no digits.
- [ ] **Step 1: failing asserts** — halted rifleman relocates to lower exposure after a hit; enemy sniper stops at a vantage (exposure < 0.5, holds ≥ 30s) and kills an exposed conscript-class target; AI buys a sniper when snap.squads=3 (share > 0 baseline); marksman line emitted digit-free; twin determinism.
- [ ] **Step 2:** verify fail → **Step 3:** implement → **Step 4:** `node scripts/depot-test.mjs && npm run lint:depot` → **Step 5:** Commit "DEPOT mirror: they take cover too, and one of them has a scope".

### Task 5: buildable-edge line — screen-constant stroke (deferred from 4.1)

**Files:** Modify `src/render/renderer.js`.
- The contour renders ~1.5px at dpr 1 regardless of zoom: overlay-pass screen-space stroke from the threshold contour, or zoom-inverse ground width — implementer's call, document. Crisp at all zooms + rotations.
- [ ] **Step 1:** implement → **Step 2:** `npm run test:td-render && npm run build && SMOKE_ONLY=depot node scripts/smoke.mjs`; screenshots at 3 zooms + rotated → **Step 3:** Commit "DEPOT: the buildable edge is a line, not a band".

### Task 6: wave timeout — annihilation OR the clock (Jeff, 2026-08-10)

**Files:** Modify `src/depot/state.js` (tryStall condition + withdrawal), `src/depot/economy.js` (returns), extend depot-test.

- Today `tryStall` requires zero live enemies — a stuck unit wedges the run forever. New rule: the wave also ends `WAVE_TIMEOUT = 75`s after its spawning completed (timer on wave state; tunable, Task 7 probes it).
- On timeout: surviving attackers **withdraw** — despawned (no death event, no bounty, no smear), and their heads/tanks RETURN to the regiment (`reg.heads += survivors`, they didn't die — muster semantics stay honest). Dispatch line on the stall card when a withdrawal happened: "Contact broken off. The remainder withdrew in order." (digit-free).
- Off-grid write-off (12s) stays as-is for truly lost units mid-wave; the timeout is the backstop for stuck-but-on-grid.
- [ ] **Step 1: failing asserts** — a wave with one immortal-fixture straggler stalls at 75s; survivor heads return to reg (count exact); no bounty paid on withdrawal; annihilation before 75s stalls immediately (existing behavior untouched); withdrawal line appears (no-gap fixture) and never lies (no line when annihilated).
- [ ] **Step 2:** verify fail → **Step 3:** implement → **Step 4:** `node scripts/depot-test.mjs && npm run lint:depot` → **Step 5:** Commit "DEPOT: waves end by annihilation or the clock — nobody wedges the war".

### Task 7: probe + prod closer

**Files:** `scripts/economy-probe.mjs` (median tier gains a sniper+rifles purchase; enemy sniper in their sim; WAVE_TIMEOUT active — verify no tier's results are dominated by withdrawals, which would signal a pathing/aggression bug, not balance), plan doc numbers.
- [ ] **Step 1:** re-run matrix; all four sanity rules hold + new rule (e): withdrawals < 20% of waves in every tier (else investigate stuck-unit causes before tuning anything).
- [ ] **Step 2:** full scoped verify + 3 consecutive smokes → **Step 3:** commit ("DEPOT Phase 5 closes: infantry in the line, probe green"), PUSH the batch, foreground CI poll, prod SMOKE_ONLY=depot ALL PASS → **Step 4:** report + phone-check screenshots (squad orders, sniper overwatch, sandbags under fire, enemy cover use, thin edge line, a timeout withdrawal if stageable).

---

## Self-review notes
- Revision incorporates every Task 1 finding: seekGoal architecture (T3 loop section), block advance (T3 asserts), sandbag-as-chunk (T3), lint-grep gotcha (constraints), state.js-owns-fire (T2), mirror narrowed to halt-points + vantage sniper (T4).
- Wave timeout returns survivors to the regiment — keeps muster-only depletion honest and makes withdrawal economically meaningful (they come back next wave).
- Sniper-vs-armor left to the existing threshold system with an assert that documents actual behavior — no special cases.
- Probe rule (e) treats heavy withdrawals as a bug signal, not a balance dial.
