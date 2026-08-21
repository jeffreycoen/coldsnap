# DEPOT Armor Wiring — Abbreviated Plan (Phase 5 interlude)

*HISTORY (stamped 2026-08-20, owner's order): this document is a record of shipped work, not authority. Design truth lives in CLAUDE.md and the ACTIVE phase's plan documents; where this file disagrees with them, it is wrong.*

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development, task-by-task. Commit locally; pushes happen at the Phase 5 closer.

**Goal:** Make Phase 0's glancing + armor-threshold machinery actually govern DEPOT combat. Today every DEPOT round is `noImpact` → all damage rides the blast path → armor is never consulted and glancing almost never fires. Design: small-arms rounds gain a **direct-hit component** that replaces the struck body's blast damage — glancing obliquity and `b.armor` thresholds apply to it; blast still splashes *neighbors*. Tanks get armor. Net effect vs soft targets ≈ unchanged (no rebalance); vs armor, damage becomes principled instead of accidental.

**Why "replaces" not "adds":** stacking direct + blast on the struck body would inflate all small-arms DPS and force a full re-tune. Replacing keeps soft-target arithmetic ≈ flat: sniper 65-direct ≈ old 65-blast, mg 5 ≈ 5.

## Global Constraints
- Core change is a guarded hook (`world.depotCombat` + spec field) — golden/righting/TD gates must stay green; frozen modes untouched.
- Shells/mortars/rockets stay blast-only (concussion vs armor is correct fiction — armor already exempts blast by design).
- No spec value changes beyond adding `dirDmg`/armor; soft-target DPS must measure ≈ unchanged (asserted).
- Commit trailer: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

---

### Task A1: core — direct-hit component for noImpact rounds (guarded)

**Files:** `src/engine/core.js` (stepProjectiles impact branch ≈:700 + explode), `scripts/combat-test.mjs`.

The existing glancing block (Phase 0) already computes obliquity-scaled damage for non-noImpact rounds. Extend it:

```js
// CURRENT gate (verify by reading): hitBody && hitBody.alive && !p.spec.noImpact && (kind unit|vehicle|truck)
// NEW gate: hitBody && hitBody.alive && (!p.spec.noImpact || (world.depotCombat && p.spec.dirDmg != null))
//           && (hitBody.kind === "unit" || hitBody.kind === "vehicle" || hitBody.kind === "truck")
let impactDmg = p.spec.dirDmg != null ? p.spec.dirDmg
              : p.spec.kind === "shell" ? 90 : p.spec.kind === "mg" ? 11 : 55;
// (glancing obliquity block unchanged — already guarded on world.depotCombat && hitAxis >= 0)
applyDamage(world, hitBody, impactDmg, { cause: CAUSE.PROJECTILE, ... });  // PROJECTILE cause => armor threshold applies
// then, so the struck body isn't damaged twice:
if (p.spec.dirDmg != null) p.spec._directHitId = hitBody.id;   // consumed by explode below
```

In `explode()`'s body-damage loop (the noImpact branch), skip the body whose id === `spec._directHitId` (damage only; impulse/toss still applies — being shot still shoves you).

- [ ] **A1.1 failing tests** (combat-test.mjs): (a) flagged world, spec `{kind:"mg", dirDmg:20, noImpact:true}` head-on vs soft body → hp loss ≈ 20 (direct, not blast-falloff); (b) same round vs `b.armor = 30` body → hp loss ≈ 3 (0.15 glance-off, PROJECTILE cause consults armor); (c) grazing hit (75° off-normal) vs soft body → less than head-on (glancing composes); (d) neighbor body 1m away still takes blast splash while struck body takes only direct; (e) unflagged world: dirDmg spec behaves as before (pure blast — guard proof).
- [ ] **A1.2** verify fail → **A1.3** implement → **A1.4** `npm run test:combat && npm run golden && npm run test:righting && npm run test:td && npm run lint:depot` ALL PASS → **A1.5** Commit "Core: direct-hit component for DEPOT rounds — armor finally consulted".

### Task A2: DEPOT wiring — dirDmg on small arms, armor on tanks

**Files:** `src/depot/specs.js`, `src/depot/units.js` (spawnTank), `src/depot/state.js` (squadFire/towerShot pass-through — verify spec fields flow onto fireProjectile spec), `scripts/depot-test.mjs`.

```js
// specs.js — small arms gain dirDmg equal to their current dmg (replacement, not addition):
// INFANTRY_ARMS: sniper dirDmg: 130 (Jeff: doubled), rifles dirDmg: 5, mg dirDmg: 5
// TOWER_SPECS:   mg tower dirDmg: 5      (gun/mortar/rocket: NONE — blast-only by design)
// enemy rifle spec: dirDmg: 5            (tank shell: NONE)
// units.js spawnTank: t.armor = 140      (sniper 130 < 140 => glances: 130*0.15 = 19.5/hit chip — Jeff doubled)
```

- [ ] **A2.1 failing tests** (depot-test.mjs): sniper vs tank ≈ 19-20 hp/hit (principled chip — replaces the old ~3.5 accidental assert, update it); sniper vs conscript still one-shots; rifle/mg DPS vs a soft fixture within ±10% of pre-change measurement (record before/after in the report — no soft-target rebalance); tank armor pin (140).
- [ ] **A2.2** verify fail → **A2.3** implement → **A2.4** `node scripts/depot-test.mjs && npm run test:combat && npm run test:accuracy && npm run lint:depot` → **A2.5** Commit "DEPOT: small arms hit what they hit — armor on tanks, direct rounds through it".

### Task A3: sanity + docs

**Files:** `scripts/economy-probe.mjs` (quick single-tier median re-run — 10 seeds — confirming no verdict flip from the tank-chip change), `docs/td-vision.md` (one line under Phase 3/5 decisions: armor model now live — direct component on small arms, blast stays concussion).
- [ ] **A3.1** median 10-seed run: verdict mix within historical range (8/20-ish WIN rate scaled) → if it flips hard, tank armor is the lever (120-160 band, must stay > 130) — record. **A3.2** `SMOKE_ONLY=depot node scripts/smoke.mjs` local PASS → **A3.3** Commit "Armor wiring closed: probe steady, vision updated". NO PUSH (phase batch).

---
**Self-review:** replaces-not-adds keeps soft DPS flat (asserted ±10%); shells stay concussion; impulse still applies on direct hits (being shot shoves); guard proofs on both the core gate and unflagged worlds; the sniper chip becomes 9.75/hit by arithmetic, not accident — flagged as a modest intentional buff for Jeff's sign-off here: **sniper chip 19.5/hit per Jeff (doubled); armor 140 keeps it sub-threshold.**
