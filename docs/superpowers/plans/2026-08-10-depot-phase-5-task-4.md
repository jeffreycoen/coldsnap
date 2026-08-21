# DEPOT Phase 5 Task 4 — The Enemy Mirror (exploded plan, code-bearing)

*HISTORY (stamped 2026-08-20, owner's order): this document is a record of shipped work, not authority. Design truth lives in CLAUDE.md and the ACTIVE phase's plan documents; where this file disagrees with them, it is wrong.*

> **For agentic workers:** superpowers:subagent-driven-development. One implementer at a time (all subtasks share units.js). Commit per subtask, PUSH per subtask (Jeff live-tests). Iteration budget: 3 implement-verify cycles per subtask, then BLOCKED with findings.

**Goal:** Enemy infantry becomes real opposition for player squads: anti-personnel fire (fog-gated, parity-tuned), cover-aware halt points, an AI-bought sniper holding vantage ground, and intel that warns about all of it.

## Global Constraints
- Files: `src/depot/units.js`, `src/depot/specs.js`, `src/depot/ai.js`, `src/depot/intel.js`, `scripts/depot-test.mjs`, smoke. Nothing else; core.js/renderer untouched.
- The two targeting laws (canonical, asserted both directions): STRUCTURE fire never gates on territory; UNIT-vs-unit fire ALWAYS fog-gates (`fieldReaches`, attacker sign).
- The self-hit law: every fire call threads `owner`; every arcClears threads selfId. NOTE FOR 4A: stepRifleman's current structure-fire call passes NO `owner` (units.js ~:179) while stepTank passes `owner: t.id` — VERIFY whether shooterFire defaults owner from its shooter param; if not, riflemen work today only because structure hits resolve before the muzzle re-entry; add owner explicitly everywhere regardless (cheap, uniform).
- Flagged-DPS parity law: any dirDmg path gaining a NEW target class gets before/after measurement and rescale into ±10%.
- No Math.random in src/depot (text-grep lint); rng draws documented.
- Commit trailer: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

---

### Subtask 4A: anti-personnel fire — riflemen + grenadiers

**The shape (stepRifleman, units.js ~:140 — insert a unit-target pass ABOVE structure targeting):**

```js
// Anti-personnel: a player soldier inside 60% of effective range is a more
// urgent target than any wall — IF our field reaches him (unit-vs-unit law:
// fog gates men, never masonry).
function nearestPlayerUnit(world, u, muzzle, fspec, R2, T, toUV) {
  let best = null, bd = R2 * 0.36;               // (0.6R)^2 — the urgency radius
  for (const s of world.bodies) {
    if (s.kind !== "unit" || !s.alive || s.team !== 1) continue;
    const c = toUV(s.pos.x, s.pos.z);
    if (!fieldReaches(T, c.u, c.v, 2)) continue;  // attacker-sign fog gate
    const dx = s.pos.x - u.pos.x, dz = s.pos.z - u.pos.z, d2 = dx * dx + dz * dz;
    if (d2 < bd && arcClears(world, muzzle, s.pos, fspec, u.id)) { bd = d2; best = s; }
  }
  return best;
}
// In stepRifleman's scan block: const man = nearestPlayerUnit(...); if (man) tgt = man;
// (sticky check must accept unit-kind targets too — extend the validity test:
//  units revalidate WITH the fog gate each tick; structures without, as today.)
```

- Firing at a unit: `shooterFire(world, u, muzzle, tgt, fspec, { attacker: "enemy", owner: u.id })` — NO `hitOnly` (the round may hit whatever it physically hits: law of the world). Structure shots keep `hitOnly: "structure"` AND gain `owner: u.id`.
- Grenadier (stepGrenadier, ENEMY_FIRE.lob): same unit-target pass at the same 60% urgency radius, fog-gated; lob keeps `hitStruct` and no hitOnly for unit shots (blast is blast).
- **Parity (the wake-up):** ENEMY_FIRE.rifle.dirDmg = 5 now hits units — measure flagged DPS vs a soft unit fixture before/after; expected rescale ~4.1 (mirror INFANTRY_ARMS.rifles); lob has no dirDmg (blast-only) — verify and document.
- [ ] Failing asserts: rifleman kills an exposed squad member within its field (10-trial majority); does NOT acquire a member beyond the field (fog law); prefers a 8m member over a 6m wall... no — prefers the MEMBER when both in urgency radius, prefers the WALL when the member is outside 0.6R (pin the priority boundary both sides); structure fire still field-free (law assert); owner threaded (no self-hit event in 50 shots); parity numbers recorded; twin determinism.
- [ ] fail → implement → `node scripts/depot-test.mjs && npm run lint:depot` → Commit "DEPOT mirror 4A: their rifles find men now" → PUSH + foreground CI poll + prod SMOKE_ONLY=depot.

### Subtask 4B: cover-aware halt points

```js
// stepRifleman/stepGrenadier halt selection — when engaging (tgt set) and not
// mid-march, evaluate 5 candidate stand points: current + 4 lateral offsets
// (±1.5m, ±3m perpendicular to the threat bearing); take lowest exposureAt
// (threat bearing = toward tgt). Re-evaluate ONLY when u.lastHit changes
// identity, at most once per 2s (u._coverT). Deterministic, zero rng.
// Movement to the chosen point: reuse the existing "close slowly while
// firing" velocity nudge, aimed at the stand point instead of the flow cell.
```
- exposureAt imports from squads.js into units.js (pure, no cycle — verify import direction stays acyclic).
- [ ] Failing asserts: a rifleman taking fire beside a boulder relocates to its lee (exposure strictly drops); re-evaluation rate-limited (call counter under simulated time); no relocation without being hit. → implement → scoped gates → Commit "DEPOT mirror 4B: they duck too" → PUSH sequence.

### Subtask 4C: their sniper

```js
// specs.js ENEMY_SPECS gains: sniper: { speed: 2.9, hp: 44, bounty: 30, dress: "android" }
// (fire spec = INFANTRY_ARMS.sniper verbatim — one table, both sides.)
// units.js: a "sniper"-tagged unit marches the flow field until VANTAGE:
//   exposureAt(world, x, z, bearing-to-depot) < 0.35 AND
//   ground height >= mean of 6 forward samples at 8m (small documented heuristic)
// then holds permanently (u.hold = true; skip march), fires via the rifleman
// code path with INFANTRY_ARMS.sniper (fog-gated vs units per the law; vs
// structures it may also fire — dirDmg 130 vs walls is fine, blast law) —
// EXCEPT no 60% urgency radius: full effRange, prefer units always.
```
- [ ] Failing asserts: sniper reaches a vantage (exposure < 0.35, holds ≥30s); one-shots an exposed member in field reach; respects fog (no acquisition beyond field); tower-equal windage (spec pin). → implement → scoped gates → Commit "DEPOT mirror 4C: one of them has a scope" → PUSH sequence.

### Subtask 4D: the brain buys it, the bureau warns you

```js
// ai.js: buildSnapshot gains squads (count of live player squads — wire the
//   snapshot builder in DepotGame). planWave counter-weight: sniper share
//   rises when snap.squads >= 2 (modest: they're 30 scrap of regiment head).
// intel.js marksman family (sniper purchases, 1-wave delay, 25% gaps):
//   "Marksman activity reported forward of the line."
//   "Single-shot reports at long interval. Pattern deliberate."
//   "A scope flash logged at the ridge. Range disputed."
```
- [ ] Failing asserts: AI buys ≥1 sniper by wave ~8 when snap.squads=3 (seeded fixture); no sniper buys at squads=0 baseline; marksman line emitted digit-free on the delayed wave; existing intel asserts green. → implement → `node scripts/depot-test.mjs && npm run lint:depot && npm run build && SMOKE_ONLY=depot node scripts/smoke.mjs` (smoke: full wave with enemy rifles engaging a placed squad — at least one member takes fire; marksman dispatch text) → Commit "DEPOT mirror 4D: bought, fielded, and reported" → PUSH sequence + screenshots (firefight over sandbags, sniper on vantage) to the phase dir.

---
## Self-review notes
- Laws asserted in both directions in 4A; owner threading made uniform (and the stepRifleman owner gap gets verified, not assumed).
- The 60% urgency radius is the one new tunable — pinned by asserts on both sides of the boundary so Task 7's probe can move it consciously.
- Sniper reuses the rifleman fire path — no new fire machinery, no new rng patterns.
- Each subtask pushes independently: Jeff feels the mirror arrive in stages (4A alone makes squads mortal).
