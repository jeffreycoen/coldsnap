# The Davy Crockett, task 5 — the possessed trigger (mk2.11)

Owner's ruling (2026-08-21): the crew must fire under TAKE CONTROL like every other unit. Hold FIRE with the crew possessed: the one atomic round launches at the reticle through the same aim, sight, and scatter laws every possessed shot obeys, and the crew dies at the trigger. One round per hire, exactly as the ATTACK path already enforces; whichever path fires first spends it. The wiped crew frees the stick through the existing release rule.

Symmetry: possession is the owner's alone by construction (the enemy has no stick); no asymmetry needs a ruling.

**Suggested model: Sonnet** — one function branch, one test era, all code carried.

## Required reading

- This plan.
- `src/depot/state.js` lines 760–810 (possessedVolley, opening at 776) and lines 664–725 (stepDavyShot — the fatal-trigger shape being reused).
- `src/depot/DepotGame.jsx` lines 3605–3615 (the possessed-squad trigger block, possessedVolley call at 3611).
- `scripts/depot-test.mjs` whole.
- `scripts/tests/17-the-davy-crockett.mjs` whole (era idiom, the crew fixtures).

## Step 1 — the failing checks

Create `scripts/tests/20-the-possessed-trigger.mjs`:

```js
// COLDSNAP suite era 20 — THE POSSESSED TRIGGER (mk2.11). The atomic crew
// fires under the owner's hand like every unit: one round at the reticle,
// the crew dead at the trigger, the latch shared with the ATTACK path.
// Fixture seed: 11. No seed is special.
import { ok } from "./harness.mjs";
import { makeField, makeWorld } from "../../src/engine/core.js";
import { makeSquad } from "../../src/depot/squads.js";
import { spawnSquadMembers, possessedVolley } from "../../src/depot/state.js";

{
  const world = makeWorld({ field: makeField(41, 2.0, 11), seed: 11 });
  world.depotCombat = true; world._tdStruct = true;
  const sq = makeSquad(1, "davy", 1, 0, 0);
  spawnSquadMembers(world, sq);
  const before = world.projectiles.length;
  const fired = possessedVolley(world, sq, { x: 0, z: 15 }, null);
  ok("trigger: the possessed crew fires the one round", fired === 1 && world.projectiles.length === before + 1);
  ok("trigger: the latch is the ATTACK path's own", sq._davyFired === true);
  const crew = sq.memberIds.map((id) => world.byId.get(id));
  ok("trigger: the crew dies at the trigger", crew.every((u) => u && !u.alive));
  ok("trigger: a spent crew fires nothing", possessedVolley(world, sq, { x: 0, z: 15 }, null) === 0);
}
```

Register it in `scripts/depot-test.mjs` after the era-19 import line (if era 19 is not yet in the runner, after the era-18 line at 34), before `finish();`:

```js
await import("./tests/20-the-possessed-trigger.mjs");
```

Run `node scripts/gate.mjs depot-test` — the era must FAIL (possessedVolley returns 0 for the crew today). Confirm before any source moves.

## Step 2 — the branch (`src/depot/state.js`)

In `possessedVolley` (line 776), the opening reads:

```js
export function possessedVolley(world, squad, aim, T, toUV = (x, z) => ({ u: x, v: z })) {
  const spec = INFANTRY_ARMS[squad.type];
  if (!spec) return 0;
  const c = toUV(aim.x, aim.z);
  if (!fieldReaches(T, c.u, c.v, squad.team)) return 0;
```

becomes:

```js
export function possessedVolley(world, squad, aim, T, toUV = (x, z) => ({ u: x, v: z })) {
  // mk2.11 (owner): THE CREW FIRES UNDER THE STICK like every unit — the
  // one atomic round at the reticle, sight-gated at the aim like every
  // possessed shot, the crew dead at the trigger. The _davyFired latch is
  // shared with the ATTACK path (stepDavyShot): one round per hire,
  // whichever path fires first spends it.
  if (squad.type === "davy") {
    if (squad._davyFired) return 0;
    const cD = toUV(aim.x, aim.z);
    if (!fieldReaches(T, cD.u, cD.v, squad.team)) return 0;
    const shooter = squad.memberIds.map((id) => world.byId.get(id)).find((u) => u && u.alive);
    if (!shooter) return 0;
    squad._davyFired = true;
    const attacker = squad.team === 1 ? "player" : "enemy";
    const muzzle = { x: shooter.pos.x, y: shooter.pos.y + 0.5, z: shooter.pos.z };
    const sy = aim.y != null ? aim.y : world.field.heightAt(aim.x, aim.z);
    const tgt = { pos: { x: aim.x, y: sy, z: aim.z }, v: { x: 0, y: 0, z: 0 }, hy: sy - world.field.heightAt(aim.x, aim.z) };
    shooterFire(world, shooter, muzzle, tgt, DAVY_FIRE, { high: true, attacker, hitStruct: true, owner: shooter.id });
    for (const id of squad.memberIds) {
      const u = world.byId.get(id);
      if (u && u.alive) applyDamage(world, u, 1e9, { attacker });
    }
    return 1;
  }
  const spec = INFANTRY_ARMS[squad.type];
  if (!spec) return 0;
  const c = toUV(aim.x, aim.z);
  if (!fieldReaches(T, c.u, c.v, squad.team)) return 0;
```

`DAVY_FIRE` and `applyDamage` are already imported in state.js (mk2.08). No other file moves — the trigger block in DepotGame.jsx (line 3611) already calls possessedVolley every held tick, and the wiped-crew release rule already frees the stick.

## Step 3 — gates

- `node scripts/gate.mjs depot-test` — green, era 20 passing.
- `node scripts/gate.mjs depot-lint` — green (the shot's two scatter draws are the only dice, same as every possessed volley).

Any other failing check stops the task; no sweep license.

## Step 4 — the landing

- Bump `src/version.js`: `mk2.10` → `mk2.11`.
- `npm run build` AFTER the bump.
- Commit `the possessed trigger, mk2.11`, push. The owner's live check — hold FIRE, watch it launch — is the acceptance, phone and desktop.

## Report

One line of outcome; both gate summaries verbatim; fixture seed (11); the commit hash; every deviation its own labeled bullet; skipped steps named as skipped.
