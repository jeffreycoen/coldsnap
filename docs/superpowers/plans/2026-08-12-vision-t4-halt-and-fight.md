# Vision Task 4 — Halt and fight (mk0.74)

*2026-08-12. The owner's playtest found troops ordered into enemy territory never shooting enemies beside them. Diagnosis: the fire rule only lets a squad shoot while "stationary" — order DEFEND, or ATTACK during a between-leg pause — and an attacking squad is almost never in a pause, so its weapons stay silent no matter what stands next to it. The rule predates Vision; Vision made deep orders possible and exposed it. The owner's ruling: **an attacking squad that sees enemies in range halts and fights until they are dead or gone, then resumes the advance. MOVE stays quiet.***

One task, one agent, four steps. No new dice anywhere — the halt rides the squad's existing pause field, which the fire rule already respects.

**Step 1 — failing tests first.** In `scripts/depot-test.mjs`, new block `==== VISION T4: halt and fight`, fixture worlds in the T1 idiom (identity transforms, flat field, territory + sight built and stepped):

- (a) a rifle squad ordered ATTACK past an enemy conscript standing 8m off its path HALTS (anchor stops advancing within a second) and FIRES (muzzle events appear) — today this fails: zero muzzles, anchor sails on.
- (b) the same squad RESUMES: kill the conscript by hand (`applyDamage`), step on, the anchor reaches the destination and the order flips to defend.
- (c) a MOVE squad in the same fixture stays silent the whole way (zero muzzles) — the ruling keeps MOVE quiet.
- (d) a SAPPER squad under ATTACK does not halt for men — it closes on masonry (sappers are the charge, not the rifle; halting them outside the wall would break every breach).
- (e) dice stability: two identical runs, one with an enemy on the path and one without, end with the same `world.rng` draw count offset as before this change (the leg-arrival draw is untouched; the halt adds zero draws).

Run: (a) must fail, (c)/(d)/(e) must pass before the change (they pin today's truths), then all green after.

**Step 2 — the engagement check, game layer.** `src/depot/DepotGame.jsx`, in `stepDepot`'s squad loop — currently (~line 592-606, read live):

```js
      // stepSquad (movement) -> squadFire (combat). squadFire threads T + invW
```

Insert, before `stepSquad` runs for each squad, the halt: a throttled scan that holds an attacking squad's existing pause open while a fightable enemy is in reach. The pause field (`squad._pauseT`) is the same one an attack leg-dwell uses, so the fire rule (`squadFire`'s stationary test) opens with no change of its own:

```js
      // VISION T4 (mk0.74, owner's ruling): an attacking squad that SEES an
      // enemy in weapon reach halts and fights — the halt is the squad's own
      // leg-pause field held open, so the fire rule and the leg machinery are
      // untouched and no rng is drawn. MOVE and BUILD stay quiet; sappers
      // never halt for men (their attack is the charge, not the rifle).
      // Throttled like every scan in this codebase; deterministic.
      const ENGAGE_CHECK_S = 0.2, ENGAGE_HOLD_S = 0.35;
      const engageCheck = (sq) => {
        if (sq.order !== "attack" || sq.type === "sappers" || sq.type === "engineers") return;
        sq._engageCd = (sq._engageCd || 0) - world.dt;
        if (sq._engageCd > 0) return;
        sq._engageCd = ENGAGE_CHECK_S;
        const arms = INFANTRY_ARMS[sq.type];
        if (!arms) return;
        const R2 = arms.range * arms.range;
        for (const e of world.bodies) {
          if ((e.kind !== "unit" && e.kind !== "vehicle") || !e.alive || e.team !== 2) continue;
          const dx = e.pos.x - sq.anchor.x, dz = e.pos.z - sq.anchor.z;
          if (dx * dx + dz * dz > R2) continue;
          const c = invW(e.pos.x, e.pos.z);
          if (!fieldReaches(T, c.u, c.v, 1)) continue;
          sq._pauseT = Math.max(sq._pauseT || 0, ENGAGE_HOLD_S);  // hold the halt open
          return;
        }
      };
```

and call `engageCheck(sq)` immediately before each `stepSquad(world, sq, world.dt)` call in that loop. `INFANTRY_ARMS` is already imported in DepotGame.jsx via specs — verify, and add the import if it is not (read the import block at the file head).

**Step 3 — one comment tells the truth.** `src/depot/state.js` `squadFire`'s fire-discipline comment (~:429-432, "members fire ONLY while stationary...") gains one sentence: "VISION T4: the game layer holds an attacking squad's pause open while a seen enemy is in reach (DepotGame's engageCheck), so halt-and-fight rides this same gate." No code change in state.js.

**Step 4 — the roadmap line.** `src/ui/Roadmap.jsx`: Polish I's entry moves to DONE with description "Playtest fixes: tuning, wall masonry, weapon voices, soundboard, engineers."; Vision's entry becomes the one IN PROGRESS with description "You can only shoot what your side can see — live, awaiting the phase playtest." (The page has shown Polish I as current since mk0.59; this deploy carries the correction.)

**Behavior stated plainly:** an attacking squad now stutter-advances through contested ground — walk, halt-and-fight while anything it sees is in reach, walk again when the reach is clear. A squad ordered THROUGH a horde will fight at every step and may never arrive, which is the correct reading of the order; MOVE remains the run-past. The halt triggers on seen-and-in-range, not on line-of-fire — a squad can halt for an enemy a wall still blocks; the members simply hold position until the shot exists or the enemy leaves reach (accepted, stated).

**Gates (run ONLY these):** parse changed files · `npm run lint:depot` · `npm run test:depot` (Step 1 green, every re-pin old→new) · build AFTER bumping `src/version.js` to "mk0.74" · `SMOKE_ONLY=depot` smoke. Single commit "(mk0.74)", push, CI green. Then STOP — the owner verifies the fix live in his own playtest.
