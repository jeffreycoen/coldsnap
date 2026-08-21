# The Davy Crockett, task 2 — the crew and the shot (mk2.08)

The troop itself, both sides: the two-man crew, its price and market family, its one atomic shot, its death at the trigger, and the blast — damage, kill law, and the deep crater. The look (flash, cloud, dress) is task 4; the green fog is task 3. Design authority: `docs/superpowers/specs/2026-08-21-davy-crockett-design.md` (owner-approved).

Rulings recorded here, at ruling time:

- **The crater's shape (owner, 2026-08-21):** 10 deep, rising at a shallow grade to the edge of the blast radius. The engine's standard carve does exactly this — crater 10 carves a bowl 10 deep whose rim sits at radius 24, against the blast radius 25, steepest flank ~30 degrees. Men walk it (under the cliff-lip rule, 1.0m over a 1.2m stride); hulls can drive it. The ground masks are NOT re-stamped (owner: "it doesn't have to be that steep" — the shape obeys instead).
- **Firing rule:** the crew fires under the ATTACK order only — the sapper's rule, named in the design document. A defending or moving crew holds its round.
- **Symmetry:** one fire table, both sides. The enemy's crew arrives through its hire hand exactly as the heroes do (its wave-composer never buys it — the hero-tier precedent, symmetric because the player's waves do not exist). No asymmetry needs a ruling.
- **Known limit, deferred to the polish queue:** TAKE CONTROL of this crew gives movement but no possessed trigger (the possessed-volley path reads the infantry arms table, which this crew is deliberately not in). The auto ATTACK path is the weapon.

Numbers not in the design document, set here as design choices, all provisional (F5): shove strength kv 40; shell speed 28; aim spread 0.005 (the mortar's); enemy-side base price 450 (equal to the player's, one market); market doubling point K 2.

**Suggested model: Sonnet** — every line of code is carried below; no design.

## Required reading

- This plan.
- `src/depot/specs.js` lines 55–90 (ENEMY_SPECS), 192–215 (tiers, hand keys, hand tags), 254–295 (INFANTRY_ARMS, GRENADE — pattern reference only).
- `src/depot/squads.js` lines 33–71 (SQUAD_SPECS, squadSpeed).
- `src/depot/state.js` lines 539–560 (hostileStructure, aimTop, the squadFire opening), 387–458 (shooterFire).
- `src/depot/units.js` lines 412–446 (stepSapper — the shape being mirrored), 496–545 (the tag dispatch in stepUnits).
- `src/depot/muster.js` lines 245–261 (PICK_POOL).
- `src/depot/market.js` lines 20–40 (MARKET_K, the family maps), 120–135 (killPrice's unit branch).
- `src/depot/infocards.js` whole (46 lines).
- `src/depot/DepotGame.jsx` lines 735–763 (PALETTE), 1580–1585 (SQUAD_MODE), 545–558 (the per-squad step loop).
- `scripts/depot-test.mjs` whole (33 lines).
- `scripts/tests/16-the-deep-floor.mjs` whole (era-file idiom).

## Step 1 — the failing checks

Create `scripts/tests/17-the-davy-crockett.mjs`:

```js
// COLDSNAP suite era 17 — THE DAVY CROCKETT (mk2.08). Two men, one atomic
// round: the blast hurts both sides, the crew dies at the trigger, the
// crater reaches the deep floor, the kill law pays nobody for the crew.
// Fixture seeds: 7 (the firing world), 9 (the blast world). No seed is special.
import { ok } from "./harness.mjs";
import { makeField, makeWorld, addBody, stepWorld, explode } from "../../src/engine/core.js";
import { DAVY_FIRE, ENEMY_SPECS } from "../../src/depot/specs.js";
import { SQUAD_SPECS, makeSquad, squadSpeed } from "../../src/depot/squads.js";
import { spawnSquadMembers, stepDavyShot, scoreKill, makeRunState } from "../../src/depot/state.js";

{
  // one table, both sides — the spec rows agree
  ok("davy: squad row exists at 450, two men", SQUAD_SPECS.davy && SQUAD_SPECS.davy.n === 2 && SQUAD_SPECS.davy.cost === 450);
  ok("davy: the slowest crew on the map", squadSpeed("davy") === 2.0);
  ok("davy: enemy row mirrors price and speed", ENEMY_SPECS.davy.bounty === 450 && ENEMY_SPECS.davy.speed === 2.0);
  ok("davy: the fire table", DAVY_FIRE.dmg === 200 && DAVY_FIRE.blastR === 25 && DAVY_FIRE.crater === 10 && DAVY_FIRE.range === 20);
}
{
  // the blast hurts both sides; the crater reaches the deep floor (seed 9)
  const field = makeField(41, 2.0, 9);
  field.carveFloor = -12;
  const world = makeWorld({ field, seed: 9 });
  world.depotCombat = true; world._tdStruct = true;
  const mine = addBody(world, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 1.0, hz: 0.28, x: 10, y: 1.1, z: 0, hp: 58 });
  const theirs = addBody(world, { kind: "unit", team: 2, mass: 80, hx: 0.28, hy: 1.0, hz: 0.28, x: -10, y: 1.1, z: 0, hp: 58 });
  explode(world, 0, 0.5, 0, { ...DAVY_FIRE, r: DAVY_FIRE.blastR, attacker: "player" });
  ok("davy: the blast hurts the enemy", theirs.hp < 58);
  ok("davy: the blast hurts our own the same", mine.hp < 58);
  ok("davy: the crater floor is deep", field.heightAt(0, 0) < -6);
}
{
  // the crew fires once under attack and dies at the trigger (seed 7)
  const field = makeField(41, 2.0, 7);
  const world = makeWorld({ field, seed: 7 });
  world.depotCombat = true; world._tdStruct = true;
  const sq = makeSquad(1, "davy", 1, 0, 0);
  spawnSquadMembers(world, sq);
  sq.order = "attack"; sq.dest = { x: 0, z: 18 };
  const tgt = addBody(world, { kind: "unit", team: 2, mass: 80, hx: 0.28, hy: 1.0, hz: 0.28, x: 0, y: 1.1, z: 15, hp: 58 });
  void tgt;
  const before = world.projectiles.length;
  for (let i = 0; i < 300 && !sq._davyFired; i++) stepDavyShot(world, sq, 1 / 120, null);
  ok("davy: one round leaves the tube", sq._davyFired === true && world.projectiles.length === before + 1);
  const crew = sq.memberIds.map((id) => world.byId.get(id));
  ok("davy: the crew dies with the shot", crew.every((u) => u && !u.alive));
  // the crew's death pays and scores nobody (friendly fire under the kill law)
  const S = makeRunState();
  const paid = scoreKill(S, { type: "kill", attacker: "player", team: 1, kind: "unit", utype: "davy" }, null);
  ok("davy: the crew's death pays nobody", paid === null && S.score.p.kills === 0);
}
```

Register it in `scripts/depot-test.mjs` after line 32 (`await import("./tests/16-the-deep-floor.mjs");`), before `finish();`:

```js
await import("./tests/17-the-davy-crockett.mjs");
```

Run `node scripts/gate.mjs depot-test` — the new era must FAIL on the missing exports (`DAVY_FIRE`, `stepDavyShot`) before any source moves. Also drop the unused `makeField`/`MAN` names if the final file does not use them — no unused imports land.

## Step 2 — the spec rows (`src/depot/specs.js`)

After line 89 (`mortar: { ...MAN.rifle, bounty: 8, ...`), inside ENEMY_SPECS, add:

```js
  // mk2.08 (owner): THE DAVY CROCKETT — the atomic crew, both sides, one
  // price. bounty equals the player's 450 so the shared market prices the
  // two sides identically. The slowest men on the map. // provisional (F5)
  davy: { ...MAN.rifle, bounty: 450, speed: 2.0, gain: 14, label: "atomic crew" },
```

Line 200 — the tier-3 row is untouched; instead the hero-tier row at line 203 (`["hero_bison", "hero_apc"]`) becomes:

```js
  ["hero_bison", "hero_apc", "sq_davy"],
```

Line 209, HAND_KEYS: insert `"sq_davy"` before `"hero_bison"`:

```js
export const HAND_KEYS = ["mg", "gun", "mortar", "rocket", "frost", "sq_sniper", "sq_rifles", "sq_mg", "sq_sappers", "sq_mortars", "sq_engineers", "sq_rockets", "sq_grenadiers", "sq_medics", "sq_mechanics", "sq_davy", "hero_bison", "hero_apc", "hero_mech"];
```

Line 214, HAND_TAGS: add `sq_davy: "davy",` before `hero_bison`.

After the GRENADE table (line 294), add the fire table:

```js
// mk2.08 (owner): THE DAVY CROCKETT'S ROUND — one table, both sides. The
// biggest blast in the game; crater 10 carves the ruled bowl (10 deep,
// shallow rise to the blast's edge — the engine's standard carve shape).
// The crew dies at the trigger (state.js stepDavyShot / units.js stepDavy),
// never by this table. // provisional (F5)
export const DAVY_FIRE = { projSpeed: 28, kind: "shell", weapon: "davy", dmg: 200, blastR: 25, kv: 40, crater: 10, range: 20, acc: 0.005, occl: "lofted", windF: 0.04, windComp: 0.6 };
```

## Step 3 — the squad row (`src/depot/squads.js`)

After line 64 (`mechanics: { n: 2, cost: 55, label: "MECHANIC TEAM" },`), add:

```js
  // mk2.08 (owner): THE DAVY CROCKETT — two men and the atomic tube. Tools,
  // not shooters: no INFANTRY_ARMS row, so squadFire skips them; the one
  // shot lives in state.js's stepDavyShot. The slowest crew on the map.
  davy: { n: 2, cost: 450, speed: 2.0, label: "DAVY CROCKETT" }, // provisional (F5)
```

`squadSpeed` (line 71) already reads the `speed` field — no edit.

## Step 4 — the shot, player side (`src/depot/state.js`)

After `squadFire` closes (the function ending at line 663), add:

```js
// mk2.08 (owner): THE DAVY CROCKETT'S ONE SHOT. Under the ATTACK order only
// (the sapper's rule), the crew's lead man fires the atomic round at the
// nearest target its side SEES — man, machine, or hostile structure — inside
// the elevation-scaled range, then the whole crew dies at the trigger.
// One round per hire; _davyFired latches on the squad and rides the save
// (a plain boolean, the generic squad serializer). Draws: exactly the
// round's own 2 (applyScatter), nothing else.
export function stepDavyShot(world, squad, dt, T, toUV = (x, z) => ({ u: x, v: z })) {
  if (squad.type !== "davy" || squad._davyFired) return;
  if (squad.order !== "attack") return;
  squad._davyScanCd = (squad._davyScanCd || 0) - dt;
  if (squad._davyScanCd > 0) return;
  squad._davyScanCd = 0.25;
  const shooter = squad.memberIds.map((id) => world.byId.get(id)).find((u) => u && u.alive);
  if (!shooter) return;
  const muzzle = { x: shooter.pos.x, y: shooter.pos.y + 0.5, z: shooter.pos.z };
  const spec = DAVY_FIRE;
  const eR = effRange(world, muzzle, spec);
  const enemyTeam = squad.team === 1 ? 2 : 1;
  let best = null, bd = eR * eR;
  for (const e of world.bodies) {
    if ((e.kind !== "unit" && e.kind !== "vehicle" && e.kind !== "mech") || !e.alive || e.team !== enemyTeam) continue;
    const dx = e.pos.x - shooter.pos.x, dz = e.pos.z - shooter.pos.z, d2 = dx * dx + dz * dz;
    if (d2 >= bd) continue;
    const c = toUV(e.pos.x, e.pos.z);
    if (!fieldReaches(T, c.u, c.v, squad.team)) continue;
    bd = d2; best = e;
  }
  if (!best) for (const s of world.bodies) {
    if (!hostileStructure(s, squad.team)) continue;
    const dx = s.pos.x - shooter.pos.x, dz = s.pos.z - shooter.pos.z, d2 = dx * dx + dz * dz;
    if (d2 >= bd) continue;
    const cs = toUV(s.pos.x, s.pos.z);
    if (!fieldReaches(T, cs.u, cs.v, squad.team)) continue;
    bd = d2; best = s;
  }
  if (!best) return;
  squad._davyFired = true;
  const attacker = squad.team === 1 ? "player" : "enemy";
  shooterFire(world, shooter, muzzle, best.kind !== "unit" && best.kind !== "vehicle" && best.kind !== "mech" ? aimTop(world, best) : best, spec, { high: true, attacker, hitStruct: true, owner: shooter.id });
  // THE TRIGGER IS FATAL (owner): the crew dies with the shot, explicitly —
  // the blast's falloff must never be trusted to do it.
  for (const id of squad.memberIds) {
    const u = world.byId.get(id);
    if (u && u.alive) applyDamage(world, u, 1e9, { attacker });
  }
}
```

`DAVY_FIRE` joins the specs.js import at line 11 (add `DAVY_FIRE` to the existing list). `applyDamage` joins the core import at line 4 (add it to `aimSolve, fireProjectile, addBody, addWeld, explode`).

## Step 5 — the shot, enemy side (`src/depot/units.js`)

After `stepSapper` (function closing at line 446), add the mirror:

```js
// mk2.08 (owner): ITS ATOMIC CREW — the sapper's shape, the davy's round.
// One shot when a seen player target or structure is inside range, then the
// crew dies at the trigger. u._davyFired latches per man; the pair fires as
// one (the first man to acquire fires for both — his partner dies with him).
function stepDavy(world, u, dt, T, toUV) {
  if (u._davyFired) return true;
  u.scanCd = (u.scanCd || 0) - dt;
  if (u.scanCd > 0) return false;
  u.scanCd = 0.25;
  const muzzle = { x: u.pos.x, y: u.pos.y + 0.5, z: u.pos.z };
  const spec = DAVY_FIRE;
  const eR = effRange(world, muzzle, spec);
  let best = null, bd = eR * eR;
  for (const e of world.bodies) {
    if ((e.kind !== "unit" && e.kind !== "vehicle" && e.kind !== "mech") || !e.alive || e.team !== 1) continue;
    const c = toUV(e.pos.x, e.pos.z);
    if (!fieldReaches(T, c.u, c.v, 2)) continue;
    const dx = e.pos.x - u.pos.x, dz = e.pos.z - u.pos.z, d2 = dx * dx + dz * dz;
    if (d2 < bd) { bd = d2; best = e; }
  }
  if (!best) for (const s of world.bodies) {
    if (!hostileStructure(s, 2)) continue;
    const cs = toUV(s.pos.x, s.pos.z);
    if (!fieldReaches(T, cs.u, cs.v, 2)) continue;
    const dx = s.pos.x - u.pos.x, dz = s.pos.z - u.pos.z, d2 = dx * dx + dz * dz;
    if (d2 < bd) { bd = d2; best = s; }
  }
  if (!best) return false;
  const aimT = best.kind !== "unit" && best.kind !== "vehicle" && best.kind !== "mech" ? aimTop(world, best) : best;
  shooterFire(world, u, muzzle, aimT, spec, { high: true, attacker: "enemy", hitStruct: true, owner: u.id });
  for (const o of world.bodies) {
    if (o.kind !== "unit" || !o.alive || o.team !== 2 || o.tag !== "davy") continue;
    if (o !== u && Math.hypot(o.pos.x - u.pos.x, o.pos.z - u.pos.z) > 6) continue;
    o._davyFired = true;
    applyDamage(world, o, 1e9, { attacker: "enemy" });
  }
  return true;
}
```

`DAVY_FIRE` joins the specs.js import at line 20; `aimTop` is already imported (line 13); `hostileStructure`, `effRange`, `fieldReaches` are already imported (line 13).

In `stepUnits`, before the rifleman dispatch at line 544, add the branch (beside the sapper's at line 496):

```js
    if (u.tag === "davy" && stepDavy(world, u, dt, T, toUV)) continue;
```

and the rifleman exclusion at line 544 gains the tag:

```js
    if (u.tag !== "gren" && u.tag !== "mortar" && u.tag !== "sapper" && u.tag !== "eng" && u.tag !== "davy" && stepRifleman(world, u, spec, cell, dt, fwdDir, T, toUV)) continue;
```

## Step 6 — wiring the player call (`src/depot/DepotGame.jsx`)

`stepDavyShot` joins the state.js import at line 21 (the long list — add it after `stepGrenades`). In the per-squad loop, after the mechanics line at 552 (`if (sq.type === "mechanics") stepMechanicTendSquad(...)`), before `squadFire` at 553, insert:

```js
      // mk2.08: the atomic crew's one shot — its own path (no arms row).
      if (sq.type === "davy") stepDavyShot(world, sq, world.dt, T, invW);
```

PALETTE (after line 756, the mechanics entry):

```js
  { key: "sq_davy", label: "DAVY CROCKETT", icon: "☢", cost: SQUAD_SPECS.davy.cost },
```

SQUAD_MODE (line 1582): add `sq_davy: "davy"` before the closing brace.

## Step 7 — pick pool, market, kill price, info card

`src/depot/muster.js` after line 255 (the mechanics pick):

```js
  { key: "sq_davy", kind: "squad", type: "davy", tag: "davy", n: 2 },
```

`src/depot/market.js`:

- MARKET_K (after line 36, `mechanic: 6,`): add `davy: 2, // mk2.08 — nukes double fast // provisional (F5)`.
- FAMILY_OF_SQUAD (line 38): add `davy: "davy"`.
- FAMILY_OF_TAG (line 39): add `davy: "davy"`.
- killPrice line 128: `const per = tag === "sniper" ? 2 : 1;` becomes `const per = tag === "sniper" || tag === "davy" ? 2 : 1; // one buy fields two men — sniper pair, atomic crew`.

`src/depot/infocards.js` after line 38 (the mechanics card):

```js
  sq_davy: sq("davy", "Two men in orange and the smallest atomic weapon ever fielded. One shot per hire; the crew dies with it. The blast spares nobody.", ["DEFEND", "MOVE", "ATTACK (THE ONE SHOT)", "TAKE CONTROL"], 200),
```

(`sq()` tolerates the missing arms row: range reads null, damage is passed.)

## Step 8 — gates

- `node scripts/gate.mjs depot-test` — green, era 17 passing.
- `node scripts/gate.mjs depot-lint` — green (no unseeded dice were added; the shot draws only applyScatter's two).

The engine core is untouched this task; golden is not in the brief. Any other failing check stops the task; no sweep license.

## Step 9 — the landing

- Bump `src/version.js`: `mk2.07` → `mk2.08`.
- `npm run build` AFTER the bump.
- Commit `the crew and the shot, mk2.08`, push. The owner's live check is the acceptance.

## Report

One line of outcome; gate results verbatim; fixture seeds (7, 9); the commit hash; every deviation its own labeled bullet; skipped steps named as skipped.
