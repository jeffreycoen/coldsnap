# P7.1 Task 4b — Mortal sandbags (mk1.66)

*HISTORY (stamped 2026-08-20, owner's order): this document is a record of shipped work, not authority. Design truth lives in CLAUDE.md and the ACTIVE phase's plan documents; where this file disagrees with them, it is wrong.*

The invincibility found at mk1.64 dies. Today a sandbag carries 60 hp that nothing can touch: direct hits pay only men, vehicles, and trucks; blasts add walls, towers, and rocks; a loose chunk body never takes damage. The fix: sandbags join the blast-damage family exactly as walls did — every round that bursts on or near a bag chips it (rifle fire ~5 a round, a shell most of it, a satchel outright), and a killed bag leaves the world and releases its ground. Both sides' bags, symmetric by construction.

**Ruling executed here** (owner, 2026-08-19): the sandbag fix is its own task, next after the info cards.

**Suggested model:** Sonnet — one guarded engine line-pair, one game-layer sweep clause, three asserts.

## The shape (stated, not open)

- Bags die to BLAST damage only — the walls-and-towers precedent under the depot's noImpact fire (every depot round explodes on impact, so a round stopping on a bag pays its blast damage at near-full falloff). No separate direct-hit branch; no targeting change — nobody starts AIMING at bags, they die to the fire that lands on them.
- The engine edit is a guarded additive divergence: the new clause keys on `world.depotCombat && b.sandbag` — no demo, sandbox, tower-defense, campaign, or mech body ever carries `b.sandbag` (grep-verified at plan time), and golden proves the frozen path byte-identical.
- A dead bag is removed by the game layer's existing removal sweep (the corpse/rubble loop) — otherwise it would keep colliding and drawing. The 4Hz cell-release loop, territory emitters, market counts, and the body lists are all already alive-gated and follow for free.
- The breaker ram stays untouched — bags are unwelded, and the ram's grind is a masonry mechanism. Out of scope.
- The T3 health bar already covers bags (spawnSandbag sets maxHp) — a chipped bag now shows its bar, which is the first visible proof of the fix.
- Zero rng anywhere. Draws CANNOT move; the keystone hash MAY (see traps).

## Required reading, in order

1. This plan, whole.
2. `src/engine/core.js:489-683` — explode(), especially the struct-damage loop at 642-651.
3. `src/engine/core.js:816-848` — applyDamage/killBody (what a dying chunk does).
4. `src/depot/DepotGame.jsx:563-594` — stepDepot's removal sweeps (the new clause's home).
5. `src/depot/state.js:743-775` — spawnSandbag (hp 60, maxHp, sleeping, b.sandbag).
6. `scripts/tests/05-the-front.mjs:549-600` — the T6 keystone (hash 3465970090, draws 695) this task may legitimately move.
7. `scripts/tests/10-command-refit.mjs` — tail (the asserts append here).

## Trap notes

- **The keystone law for this task:** the fixed-seed battle may now genuinely kill a seeded bag, which flips an alive bit the hash covers. If `05-the-front.mjs`'s keystone HASH assert alone moves: re-pin old→new and report it — the T3/T5/T15 precedent, behavior genuinely changed by a ruled fix. The DRAW count must stay exactly 695 — this task draws nothing, and a draw movement is a defect: STOP.
- Any OTHER test movement stops the task — no sweep license here beyond the keystone hash.
- golden.mjs must stay green — the frozen demo's fireVolley uses hitStruct, but no demo body carries `b.sandbag`, so the new clause is unreachable there.
- killBody on a chunk pushes a kill event (type "kill", kind "chunk") — the renderer's kill handler only smears bodies with smearStyle (bags have none) and audio's bodyFall keys on kind "unit". Both ignore it by construction; do not add handling.
- The removal clause joins the EXISTING reverse loop in stepDepot — do not write a second loop.

## Steps

**Step 1 — core.js: bags join the blast-damage family.** In explode()'s struct-damage loop (line 642-651), the kind filter line

```js
      if (!b.alive || (b.kind !== "wall" && b.kind !== "tower" && b.kind !== "rock")) continue;
```

becomes:

```js
      if (!b.alive) continue;
      // DIVERGENCE (guarded, mk1.66 — the owner's ruling): SANDBAGS ARE
      // MORTAL. A bag takes blast damage like the walls beside it — its 60hp
      // was unreachable by any path since the first bag. b.sandbag exists
      // only on depot bodies; every other mode is byte-identical (golden).
      const isBag = world.depotCombat && b.sandbag;
      if (b.kind !== "wall" && b.kind !== "tower" && b.kind !== "rock" && !isBag) continue;
```

(The damage line and `b.hitT = world.t;` below it are untouched.)

**Step 2 — DepotGame.jsx: the dead bag leaves the field.** In stepDepot's reverse removal loop (lines 581-591), after the sleeping-rubble clause, add:

```js
    else if (b.kind === "chunk" && b.sandbag && !b.alive) {
      // P7.1 T4b: a killed bag is gone — it must not keep colliding or
      // drawing. Its grid cell releases on the existing 4Hz bag sweep.
      forgetWelds(world, b);
      world.byId.delete(b.id); world.bodies.splice(i, 1);
    }
```

**Step 3 — the asserts.** Append to `scripts/tests/10-command-refit.mjs` (imports gain `explode` on the core.js line):

```js
// ---- P7.1 T4b: SANDBAGS ARE MORTAL
{
  const w = makeWorld({ field: flatF, seed: 41 }); w.depotCombat = true;
  const bag = spawnSandbag(w, 0, 0, 0);
  ok("T4b: a bag opens at full health", bag.hp === 60 && bag.maxHp === 60);
  explode(w, 0.5, 0.6, 0, { r: 2.3, kv: 8, dmg: 25, attacker: "enemy", hitStruct: true });
  ok("T4b: a shell blast chips the bag", bag.hp < 60 && bag.alive, bag.hp.toFixed(1));
  explode(w, 0.5, 0.6, 0, { r: 5, kv: 90, dmg: 300, attacker: "enemy", hitStruct: true });
  ok("T4b: a satchel kills the bag outright", bag.alive === false);
}
```

**Step 4 — version.** `src/version.js`: `mk1.65` → `mk1.66`. Build AFTER the bump.

## Gates — run ONLY these

1. `node scripts/depot-test.mjs` — 1416 passed / 0 failed (three T4b asserts). The ONE licensed movement: the T6 keystone hash at `05-the-front.mjs:571` may re-pin (report old 3465970090 → new); draws must stay 695 to the digit or the task stops.
2. `node scripts/golden.mjs` — green (the frozen path never reaches the new clause).
3. `node scripts/smoke.mjs` — preview pattern, all green, mark mk1.66.
4. `node scripts/depot-lint.mjs` — clean.

Green → commit `src/engine/core.js`, `src/depot/DepotGame.jsx`, `scripts/tests/10-command-refit.mjs`, `src/version.js` (plus `scripts/tests/05-the-front.mjs` ONLY if the keystone re-pinned) — subject "sandbags are mortal (mk1.66)" — standing trailers, push.

## Report requirements

Read-confirmation (seven items), one outcome line, bullets per step and gate with exact counts, the keystone's fate (unmoved, or old→new hash with draws confirmed 695), commit hash. Every deviation its own labeled bullet. The live proof for the owner: shell a bag line — bars appear, bags die, the ground opens.
