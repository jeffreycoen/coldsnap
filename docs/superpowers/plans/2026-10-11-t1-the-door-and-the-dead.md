# T1 — The door and the dead (0.6.1)

COLDSNAP: THE OUTBREAK opens from the front menu. It is the war — both depots, both armies, the draft, the bell, the hand — with six of the dead standing at the town nearest the valley's middle. The dead are a third side: `team` 3, tag `"dead"`, 116 points, 6.4 meters a second. They hunt any living man within 24 meters, bite once a second at arm's reach for 15 points, and fire nothing. A bitten man carries the sickness ten seconds and turns; a man bitten to death turns at once; a man shot dead is a corpse. Both armies' guns, towers, hulls, and the possessed reticle treat the dead as the enemy. The dead do not count on the market; a dead kill pays and scores nobody; a bitten man cannot board a hull. The outbreak saves under its own key at every bell and resumes from the front menu. The top bar counts the dead beside the enemies. The renderer draws up to 256 plain men. The war itself does not change: the headless keystone's two hashes are identical before and after.

Suggested model: Sonnet 5.5 — every step is verbatim code at a grepped anchor; nothing is designed.

## Required reading, in this order

1. `CLAUDE.md`
2. This file, whole, before the first edit.
3. `src/depot/specs.js` lines 46–51 and 311–320
4. `src/depot/state.js` lines 14–33, 553–561, 605–625, 698–735, 743–772, 1188–1219, 1708–1720
5. `src/depot/lists.js` whole
6. `src/depot/sim.js` lines 87–167, 529–651
7. `src/depot/units.js` lines 85–135, 453–490, 527–539
8. `src/depot/drivers.js` lines 385–400
9. `src/depot/squads.js` lines 407–480, 513–535
10. `src/depot/market.js` lines 43–70
11. `src/depot/transports.js` whole
12. `src/depot/orders.js` lines 618–631
13. `src/depot/boot.js` lines 316–386
14. `src/depot/save.js` lines 37–47, 315–347
15. `src/depot/api.js` lines 404–429
16. `src/depot/hooks.js` lines 15–18
17. `src/depot/DepotGame.jsx` lines 60–70, 178–192, 674–700, 1413–1436, 2034–2046
18. `src/graphics/troopkit.js` lines 120–180
19. `src/graphics/renderer.js` lines 985–1008, 2185–2200, 2226–2240, 2286–2292
20. `src/ui/App.jsx` whole
21. `src/ui/StartScreen.jsx` whole
22. `scripts/tests/47-the-symmetric-jeep.mjs`, `scripts/depot-test.mjs`, `scripts/smoke.mjs` lines 1–40 and 160–215

The report opens with a line confirming every file above was read.

## Gates

Run only these, each through `node scripts/gate.mjs <name>`: `depot-lint`, `depot-test`, `golden`, `smoke`. The smoke needs `npm run build` then `npm run preview &` first (it reads `http://localhost:4173/coldsnap/`). Nothing else runs; the full suite rides CI.

The keystone: `node src/depot/api.js gate 7 20` prints `seed 7  seconds 20 (2400 steps)  worldHash 1278094788  runHash 2033212782` on the untouched tree. Step 0 confirms it; Step 23 confirms it again unchanged. Any other number stops the task.

Sweep license: none. Any failing test other than the new era file's own asserts before Step 21 stops the task.

## Steps

### Step 0 — the keystone, before

Run `node src/depot/api.js gate 7 20`. The output line must read exactly `seed 7  seconds 20 (2400 steps)  worldHash 1278094788  runHash 2033212782`. Record it in the report.

### Step 1 — the failing era file

Create `scripts/tests/48-the-outbreak.mjs` with this content. It fails to import until the later steps land; that is the failing assert first.

```js
import { ok } from "./harness.mjs";
import { makeWorld, addBody } from "../../src/engine/core.js";
import { DEAD, DEAD_TEAM, MAN } from "../../src/depot/specs.js";
import { spawnDead, biteBody, turnDead, stepDead, stepSick, outbreakCenter } from "../../src/depot/dead.js";
import { hostileUnit, pruneSquads } from "../../src/depot/state.js";
import { marketCounts } from "../../src/depot/market.js";
import { squadCanBoard } from "../../src/depot/transports.js";
import { bootWar } from "../../src/depot/boot.js";
import { tickWar } from "../../src/depot/tick.js";
import { serializeRun, defaultTickInput } from "../../src/depot/api.js";
import { parseFront } from "../../src/depot/save.js";
import { stepTowers } from "../../src/depot/sim.js";
import { makeMap } from "../../src/depot/mapgen.js";

// ==== 0.6.1: the outbreak — the door and the dead ===========================
// The third side: hostile to both armies, hunted by both, firing nothing.
// Seed rolled each run.
{
  console.log("\n[0.6.1: the outbreak — the door and the dead]");
  const SEED = (Date.now() % 1000000) + 1;
  console.log("  fixture seed base", SEED);
  const flat = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (x, z, o) => { o.x = 0; o.y = 1; o.z = 0; return o; } };
  const man = (w, team, x, z) => { const u = addBody(w, { kind: "unit", team, mass: MAN.rifle.mass, hx: MAN.rifle.hx, hy: MAN.rifle.hy, hz: MAN.rifle.hz, x, z, y: MAN.rifle.hy + 0.02, hp: MAN.rifle.hp, friction: 0.5 }); u.maxHp = MAN.rifle.hp; return u; };

  // (a) hostileUnit: the other army and the dead, both signs
  ok("(a) team 1 is hostile to the enemy and the dead, not to itself or scenery", hostileUnit({ team: 2 }, 1) && hostileUnit({ team: DEAD_TEAM }, 1) && !hostileUnit({ team: 1 }, 1) && !hostileUnit({ team: 0 }, 1));
  ok("(a) team 2 is hostile to the player and the dead, not to itself", hostileUnit({ team: 1 }, 2) && hostileUnit({ team: DEAD_TEAM }, 2) && !hostileUnit({ team: 2 }, 2));

  // (b) the body
  {
    const w = makeWorld({ field: flat, seed: SEED }); w.depotCombat = true;
    const d = spawnDead(w, 0, 0);
    ok("(b) one of the dead: a unit on the third team, the tag, 116 points", d.kind === "unit" && d.team === DEAD_TEAM && d.tag === DEAD.tag && d.hp === 116 && d.maxHp === 116, `${d.team}/${d.tag}/${d.hp}`);
  }

  // (c) the bite: 15 points and the stamp; the fourth bite turns a 58-point man at once
  {
    const w = makeWorld({ field: flat, seed: SEED }); w.depotCombat = true; w.t = 5;
    const d = spawnDead(w, 0, 0); const m = man(w, 1, 1, 0);
    biteBody(w, d, m);
    ok("(c) a bite takes 15 and stamps the clock", m.hp === MAN.rifle.hp - 15 && m.sickAt === 5 && m.team === 1, `${m.hp}/${m.sickAt}`);
    biteBody(w, d, m); biteBody(w, d, m);
    ok("(c) three bites leave him living and stamped", m.alive && m.team === 1 && m.hp === MAN.rifle.hp - 45, `${m.hp}`);
    biteBody(w, d, m);
    ok("(c) the fourth bite turns him at once — no corpse, 116 points, the third team", m.alive && m.team === DEAD_TEAM && m.tag === DEAD.tag && m.hp === 116 && m.sickAt == null && w.events.filter((e) => e.type === "kill").length === 0, `${m.team}/${m.hp}`);
  }

  // (d) the turn: ten seconds after the stamp, not before
  {
    const w = makeWorld({ field: flat, seed: SEED }); w.depotCombat = true;
    const m = man(w, 2, 0, 0); m.sickAt = 100;
    w.t = 109.9; stepSick(w);
    ok("(d) at 9.9 seconds he still stands as a man", m.team === 2);
    w.t = 110; stepSick(w);
    ok("(d) at ten seconds he turns", m.team === DEAD_TEAM && m.tag === DEAD.tag && m.hp === 116);
  }

  // (e) the hunt: 12 meters closed and a bite landed inside four seconds; 30 meters is not sensed
  {
    const w = makeWorld({ field: flat, seed: SEED }); w.depotCombat = true;
    const d = spawnDead(w, 0, 0); const m = man(w, 1, 12, 0);
    const hp0 = m.hp; let bitAt = null;
    for (let i = 0; i < 480 && bitAt == null; i++) { stepDead(w, 1 / 120); w.t += 1 / 120; d.pos.x += d.v.x / 120; d.pos.z += d.v.z / 120; if (m.hp < hp0) bitAt = w.t; }
    ok("(e) the dead close 12 meters and bite inside four seconds", bitAt != null && bitAt < 4, bitAt == null ? "no bite" : bitAt.toFixed(2) + "s");
    const w2 = makeWorld({ field: flat, seed: SEED }); const d2 = spawnDead(w2, 0, 0); man(w2, 1, 30, 0);
    for (let i = 0; i < 60; i++) stepDead(w2, 1 / 120);
    ok("(e) a man 30 meters off is not sensed — the dead stand", Math.hypot(d2.v.x, d2.v.z) < 1e-6 && d2.tgtId == null);
  }

  // (f) the roster: a turned member leaves his squad on the prune
  {
    const w = makeWorld({ field: flat, seed: SEED }); const m = man(w, 1, 0, 0);
    const sq = { id: 1, type: "rifles", team: 1, order: "defend", dest: null, memberIds: [m.id], anchor: { x: 0, z: 0 } };
    let out = pruneSquads(w, [sq]);
    ok("(f) a living man stays on the roster", out.length === 1 && out[0].memberIds.length === 1);
    turnDead(w, m); out = pruneSquads(w, [sq]);
    ok("(f) a turned man leaves it and the empty squad is dropped", out.length === 0);
  }

  // (g) the market: the dead are not men on the market
  {
    const w = makeWorld({ field: flat, seed: SEED }); man(w, 1, 0, 0); man(w, 2, 2, 0); spawnDead(w, 4, 0); spawnDead(w, 6, 0);
    const c = marketCounts(w, [], []);
    ok("(g) two men count, two dead do not", c._men === 2, `${c._men}`);
  }

  // (h) the ramp: a squad with a bitten man cannot board
  {
    const w = makeWorld({ field: flat, seed: SEED }); const a = man(w, 1, 0, 0), b = man(w, 1, 1, 0);
    const sq = { memberIds: [a.id, b.id] };
    ok("(h) a clean squad may board", squadCanBoard(w, sq));
    b.sickAt = 1;
    ok("(h) a bitten man keeps his squad off the ramp", !squadCanBoard(w, sq));
  }

  // (i) the tower shoots the dead: a player tower acquires one of the dead in reach
  {
    const w = makeWorld({ field: flat, seed: SEED }); w.depotCombat = true;
    const t = addBody(w, { kind: "tower", team: 1, mass: 0, hx: 0.8, hy: 1.0, hz: 0.8, x: 0, y: 1.0, z: 0, hp: 80 }); t.towerType = "mg"; t.maxHp = 80;
    spawnDead(w, 6, 0);
    const map = makeMap(SEED);
    for (let i = 0; i < 30; i++) { stepTowers(w, null, "free", undefined, [], null, map); w.t += 1 / 120; }
    ok("(i) the player's tower takes one of the dead as its target", t.targetId != null && w.byId.get(t.targetId).team === DEAD_TEAM, String(t.targetId));
  }

  // (j) the boot: the outbreak fields exactly six dead at the middle town; the war fields none; the boot draws are untouched
  {
    const warW = bootWar({ seed: SEED }), ob = bootWar({ seed: SEED, outbreak: true });
    const deadOf = (w) => w.world.bodies.filter((b) => b.kind === "unit" && b.team === DEAD_TEAM && b.alive);
    ok("(j) the war fields no dead", deadOf(warW).length === 0);
    const dd = deadOf(ob);
    ok("(j) the outbreak fields six", dd.length === 6, `${dd.length}`);
    const c = outbreakCenter(ob.map);
    ok("(j) they stand at the middle town", dd.every((b) => Math.hypot(b.pos.x - c.x, b.pos.z - c.z) < 14), dd.map((b) => Math.hypot(b.pos.x - c.x, b.pos.z - c.z).toFixed(1)).join(","));
    ok("(j) the war's run carries no outbreak key; the outbreak's does", warW.run.outbreak === undefined && ob.run.outbreak === true);
    ok("(j) the outbreak spends no draw the war does not — the next draw is the same number", warW.world.rng() === ob.world.rng());
  }

  // (k) the save: an outbreak serializes through the war's own save and resumes with its dead and its sickness
  {
    const ob = bootWar({ seed: SEED, outbreak: true }); ob.run.started = true;
    const input = defaultTickInput();
    for (let i = 0; i < 240; i++) tickWar(ob, 1 / 120, input);
    const m = ob.world.bodies.find((b) => b.kind === "unit" && b.team === 2 && b.alive); if (m) m.sickAt = ob.world.t;
    const n0 = ob.world.bodies.filter((b) => b.kind === "unit" && b.team === DEAD_TEAM && b.alive).length;
    const p = parseFront(serializeRun(ob));
    ok("(k) the outbreak serializes through the war's own save", p.ok);
    const back = bootWar({ seed: p.data.map.seed, resume: p.data, outbreak: true });
    const n1 = back.world.bodies.filter((b) => b.kind === "unit" && b.team === DEAD_TEAM && b.alive).length;
    ok("(k) the dead come back, every one", n1 === n0 && n0 > 0, `${n0}->${n1}`);
    const sick = back.world.bodies.filter((b) => b.sickAt != null).length;
    ok("(k) the sickness stamp rides the save", !m || sick === 1, `${sick}`);
    ok("(k) the resumed run is an outbreak", back.run.outbreak === true);
  }
}
```

In `scripts/depot-test.mjs`, after the line `await import("./tests/47-the-symmetric-jeep.mjs");` add:

```js
await import("./tests/48-the-outbreak.mjs");
```

Run `node scripts/gate.mjs depot-test`. It must fail at the new file's import (no `dead.js`). Record the failure line.

### Step 2 — the dead's row in the specs

In `src/depot/specs.js`, after the `DAVY_FIRE` line (the file's last line, `export const DAVY_FIRE = ...`), append:

```js

// THE DEAD (0.6.1): the third side. One row, read by the dead's driver, the
// bite, the turn, and every scan that asks who is hostile. The man's body,
// twice his points, twice his pace.
export const DEAD_TEAM = 3;
export const DEAD = { ...MAN.rifle, tag: "dead", hp: 116, speed: 6.4, sense: 24, bite: 15, biteCd: 1, turnS: 10, reachPad: 0.35 };
```

### Step 3 — `hostileUnit`, the roster, the credit trail, the four scans in `state.js`

In `src/depot/state.js` line 11, the specs import, add `DEAD_TEAM` to the list:

```js
import { TOWER_SPECS, ENEMY_SPECS, TANK, INFANTRY_ARMS, MASON, PLAYER_START, PLAYER_TIERS, HAND_KEYS, HAND_TAGS, MAN, GRENADE, DAVY_FIRE, DEAD_TEAM } from "./specs.js";
```

After `fieldReaches` (after line 33, the closing `}`), add:

```js

// THE THIRD SIDE (0.6.1): a body is hostile to `team` when it belongs to the
// other army or to the dead. Every scan that picks a man, hull, or mech to
// shoot asks this; the dead ask nothing — they fire nothing.
export function hostileUnit(b, team) {
  return b.team === DEAD_TEAM || b.team === (team === 1 ? 2 : 1);
}
```

The next two edits change the same text at two places (lines 615 and 712, eight spaces of indent at the first, four at the second); both change the same way. In `squadFire`'s `scanUnits` (line 615), replace

```js
        if ((e.kind !== "unit" && e.kind !== "vehicle" && e.kind !== "mech") || !e.alive || e.team !== enemyTeam) continue;
```

with

```js
        if ((e.kind !== "unit" && e.kind !== "vehicle" && e.kind !== "mech") || !e.alive || !hostileUnit(e, squad.team)) continue;
```

In `stepDavyShot` (line 712), replace

```js
    if ((e.kind !== "unit" && e.kind !== "vehicle" && e.kind !== "mech") || !e.alive || e.team !== enemyTeam) continue;
```

with

```js
    if ((e.kind !== "unit" && e.kind !== "vehicle" && e.kind !== "mech") || !e.alive || !hostileUnit(e, squad.team)) continue;
```

In `snapTargetNear` (line 749), replace

```js
    if ((b.kind !== "unit" && b.kind !== "vehicle" && b.kind !== "mech") || !b.alive || b.team !== 2) continue;
```

with

```js
    if ((b.kind !== "unit" && b.kind !== "vehicle" && b.kind !== "mech") || !b.alive || !hostileUnit(b, 1)) continue;
```

In `stickyLock` (line 766), replace

```js
    if (b && b.alive && (b.kind === "unit" || b.kind === "vehicle" || b.kind === "mech") && b.team === 2) {
```

with

```js
    if (b && b.alive && (b.kind === "unit" || b.kind === "vehicle" || b.kind === "mech") && hostileUnit(b, 1)) {
```

In `pruneSquads` (line 1199), replace

```js
      return !!u && u.alive;
```

with

```js
      return !!u && u.alive && u.team === (sq.team || 1); // 0.6.1: a turned man leaves the roster
```

In `creditKill`, after line 1710 (`if (ev.kind !== "unit" && ev.kind !== "vehicle" && ev.kind !== "mech") return;`), add:

```js
  if (ev.team === DEAD_TEAM) return; // 0.6.1: a dead kill credits nobody
```

### Step 4 — the pools learn the third side

In `src/depot/lists.js`, add at the top, after the comment block and before `const SOLID_KINDS`:

```js
import { DEAD_TEAM } from "./specs.js";
```

Replace lines 33–34

```js
      if (b.team === 1) L.friends.push(b);
      else if (b.team === 2) L.foes.push(b);
```

with

```js
      // 0.6.1: the dead ride BOTH side pools — each army's scans find them
      // in the pool it already reads; the consumers' own predicates decide.
      if (b.team === 1 || b.team === DEAD_TEAM) L.friends.push(b);
      if (b.team === 2 || b.team === DEAD_TEAM) L.foes.push(b);
```

### Step 5 — towers, the engage check, and the dead's step in `sim.js`

In `src/depot/sim.js` line 9, add `DEAD_TEAM`:

```js
import { TOWER_SPECS, MASON, INFANTRY_ARMS, DEAD_TEAM } from "./specs.js";
```

In the `state.js` import (lines 10–14), add `hostileUnit` to the list:

```js
import {
  makeAssaultState, towerShot, fieldReaches, friendlyFouls, teslaStrike,
  teslaWouldCatchFriend, stepGrenades, stepTesla, stepDavyShot, squadFire,
  pruneSquads, stepWallSupport, forgetWelds, hostileUnit,
} from "./state.js";
```

After line 22 (`import { layDressing } from "./mapgen.js";`) add:

```js
import { stepDead, stepSick } from "./dead.js";
```

In `stepTowers` line 116, replace

```js
    if (best && (!best.alive || best.team !== foeTeam || (best.kind !== "unit" && best.kind !== "vehicle" && best.kind !== "mech"))) best = null;
```

with

```js
    if (best && (!best.alive || !hostileUnit(best, tTeam) || (best.kind !== "unit" && best.kind !== "vehicle" && best.kind !== "mech"))) best = null;
```

Line 138, replace

```js
        if ((e.kind !== "unit" && e.kind !== "vehicle" && e.kind !== "mech") || !e.alive || e.team !== foeTeam) continue;
```

with

```js
        if ((e.kind !== "unit" && e.kind !== "vehicle" && e.kind !== "mech") || !e.alive || !hostileUnit(e, tTeam)) continue;
```

In `engageCheck` (line 575), replace

```js
        if ((e.kind !== "unit" && e.kind !== "vehicle") || !e.alive || e.team !== 2) continue;
```

with

```js
        if ((e.kind !== "unit" && e.kind !== "vehicle") || !e.alive || !hostileUnit(e, 1)) continue;
```

In `stepDepot`, after line 536 (`else for (const b of world.bodies) if (b.kind === "unit" && b.team === 2 && b.alive) uprightMember(b, world.dt);`), add:

```js
  // THE DEAD (0.6.1): the third side walks after the armies and before the
  // squads, so a turned man is off his roster by this tick's prune. Only an
  // outbreak carries run.outbreak; the war never enters here.
  if (run && run.outbreak) {
    stepDead(world, world.dt);
    stepSick(world);
    for (const b of world.bodies) if (b.kind === "unit" && b.team === DEAD_TEAM && b.alive) uprightMember(b, world.dt);
  }
```

### Step 6 — the enemy's riflemen, grenadiers, crew, and spotter in `units.js`

In `src/depot/units.js` line 13, add `hostileUnit`:

```js
import { shooterFire, fieldReaches, effRange, hostileStructure, standingStructure, throwGrenade, aimTop, hostileUnit } from "./state.js";
```

Line 90, export `faceTravel` (the dead's driver reads it):

```js
export function faceTravel(u, dt) {
```

Line 115 (`nearestPlayerUnit`), replace

```js
    if (!soft(s) || !s.alive || s.team !== 1) continue;
```

with

```js
    if (!soft(s) || !s.alive || !hostileUnit(s, 2)) continue;
```

Line 128 (`unitTargetValid`), replace

```js
  if (!tgt || !tgt.alive || !soft(tgt) || tgt.team !== 1) return false;
```

with

```js
  if (!tgt || !tgt.alive || !soft(tgt) || !hostileUnit(tgt, 2)) return false;
```

Line 468 (`stepDavy`), replace

```js
    if ((e.kind !== "unit" && e.kind !== "vehicle" && e.kind !== "mech") || !e.alive || e.team !== 1) continue;
```

with

```js
    if ((e.kind !== "unit" && e.kind !== "vehicle" && e.kind !== "mech") || !e.alive || !hostileUnit(e, 2)) continue;
```

Line 529 (the spotter's check on his sniper), replace

```js
      if (!sn2 || !sn2.alive) {
```

with

```js
      if (!sn2 || !sn2.alive || sn2.team !== 2) { // 0.6.1: a turned sniper is no sniper of his
```

### Step 7 — the armor's scan in `drivers.js`

In `src/depot/drivers.js` line 12, add `hostileUnit`:

```js
import { shooterFire, fieldReaches, effRange, hostileStructure, snapTargetNear, POSSESS_ACC, hitOrigin, hostileUnit } from "./state.js";
```

Line 391 (`armorScanFoes`), replace

```js
    if ((e.kind !== "unit" && (unitsOnly || (e.kind !== "vehicle" && e.kind !== "mech"))) || !e.alive || e.team !== enemyTeam) continue;
```

with

```js
    if ((e.kind !== "unit" && (unitsOnly || (e.kind !== "vehicle" && e.kind !== "mech"))) || !e.alive || !hostileUnit(e, v.team)) continue;
```

### Step 8 — the squads' threat read and the shared seek in `squads.js`

In `src/depot/squads.js` line 83, add `hostileUnit`:

```js
import { effRange, hostileStructure, standingStructure, hitOrigin, hostileUnit } from "./state.js";
```

Line 419, export `seekGoal` and give it an optional speed; the dead walk at their own pace through the same steer-around. Replace

```js
function seekGoal(world, u, dt) {
```

with

```js
export function seekGoal(world, u, dt, sp0) {
```

and line 470, replace

```js
  const sp = squadSpeed(u.utype);
```

with

```js
  const sp = sp0 != null ? sp0 : squadSpeed(u.utype); // 0.6.1: a caller may name the pace (the dead)
```

Every existing caller passes three arguments and is unchanged.

Line 530 (`squadThreatened`), replace

```js
    if (!b.alive || b.team !== 2) continue;
```

with

```js
    if (!b.alive || !hostileUnit(b, squad.team || 1)) continue; // 0.6.1: the dead threaten a squad as the enemy does
```

### Step 9 — the market ignores the dead

In `src/depot/market.js` line 6, add `DEAD_TEAM`:

```js
import { TOWER_SPECS, ENEMY_SPECS, TANK, BISON, APC, JEEP, MECH, DEAD_TEAM } from "./specs.js";
```

In `marketCounts`, replace

```js
    if (b.kind === "unit") c._men = (c._men || 0) + 1; // both armies — squad men are unit bodies too
```

with

```js
    if (b.kind === "unit" && b.team !== DEAD_TEAM) c._men = (c._men || 0) + 1; // both armies — squad men are unit bodies too; the dead are not men on the market (0.6.1)
```

### Step 10 — the ramp refuses a bitten man

In `src/depot/transports.js`, after the line `export { seatsOf };` add:

```js

// 0.6.1: a bitten man cannot board — the hold is sealed and he would turn in
// it. One rule, read by the LOAD tap and by the boarding step.
export function squadCanBoard(world, sq) {
  for (const id of sq.memberIds) { const u = world.byId.get(id); if (u && u.alive && u.sickAt != null) return false; }
  return true;
}
```

In `stepTransports`, inside `if (sq._boarding != null) {`, after the line

```js
      if (!v) { sq._boarding = null; sq.order = "defend"; sq.dest = null; continue; }
```

add:

```js
      if (!squadCanBoard(world, sq)) { sq._boarding = null; sq.order = "defend"; sq.dest = null; continue; } // 0.6.1: a man bitten on the walk to the ramp stands the squad down
```

In `src/depot/orders.js` line 4, add `squadCanBoard`:

```js
import { unloadApc, apcSeated, seatsOf, squadCanBoard } from "./transports.js";
```

In the LOAD branch, after the line `if (!sq) { toast("TAP A SQUAD TO LOAD"); return true; }` add:

```js
          if (!squadCanBoard(world, sq)) { toast("A BITTEN MAN CANNOT BOARD"); return true; }
```

### Step 11 — the dead, their own file

Create `src/depot/dead.js`:

```js
// COLDSNAP DEPOT — dead.js: THE DEAD (0.6.1), the third side. Bodies of
// kind "unit" on DEAD_TEAM with tag DEAD.tag. They hunt any living man
// within DEAD.sense meters, bite once a second at arm's reach, and fire
// nothing. A bite wounds and stamps the sickness (sickAt, the sim clock);
// DEAD.turnS later the body turns; a body bitten to death turns at once.
// No rng anywhere in this module: scans are nearest-first in world order,
// cadences are seq-staggered, the outbreak ring is fixed geometry through
// clearSlot. Zero draws, so the war's stream is untouched.
import { addBody, applyDamage } from "../engine/core.js";
import { DEAD, DEAD_TEAM } from "./specs.js";
import { clearSlot, seekGoal } from "./squads.js";
import { faceTravel } from "./units.js";

export function spawnDead(world, x, z) {
  const p = clearSlot(world, x, z, DEAD.hx + 0.35);
  const u = addBody(world, { kind: "unit", team: DEAD_TEAM, tag: DEAD.tag, mass: DEAD.mass, hx: DEAD.hx, hy: DEAD.hy, hz: DEAD.hz,
    x: p.x, z: p.z, y: world.field.heightAt(p.x, p.z) + DEAD.hy + 0.02, hp: DEAD.hp, friction: 0.38 });
  u.maxHp = DEAD.hp; u.smearStyle = "human"; u.brave = true; u.bounty = 0;
  u.wph = (u.seq * 1.7) % 6.28; // derived, not drawn
  return u;
}

// outbreakCenter: the town nearest the valley's middle — the town cluster
// first, a hamlet when the map drew no town, the nearest standing building
// last. Cluster rows are world coordinates (mapgen transforms them).
export function outbreakCenter(map) {
  const pick = (rows) => { let best = null, bd = Infinity; for (const r of rows) { const d = Math.hypot(r.x, r.z); if (d < bd) { bd = d; best = r; } } return best; };
  const town = pick(map.CLUSTERS.filter((c) => c.kind === "town"));
  if (town) return { x: town.x, z: town.z };
  const ham = pick(map.CLUSTERS.filter((c) => c.kind === "hamlet"));
  if (ham) return { x: ham.x, z: ham.z };
  const t = pick(map.TOWN.filter((b) => !b.depot && !b.marker && !b.dead));
  return t ? { x: t.x, z: t.z } : { x: 0, z: 0 };
}

// THE OUTBREAK: six at the middle town, a ring of seven meters, each
// pushed to clear ground by clearSlot.
export const OUTBREAK_N = 6, OUTBREAK_R = 7;
export function spawnOutbreak(world, map) {
  const c = outbreakCenter(map);
  const out = [];
  for (let i = 0; i < OUTBREAK_N; i++) {
    const a = (i / OUTBREAK_N) * Math.PI * 2;
    out.push(spawnDead(world, c.x + Math.sin(a) * OUTBREAK_R, c.z + Math.cos(a) * OUTBREAK_R));
  }
  return out;
}

// THE TURN: the same body, the third side. The gun goes (no utype, no
// role, no tag of an arm), the roster forgets him on its next prune
// (pruneSquads reads team), his pair is unpaired, and he stands with the
// dead's points.
export function turnDead(world, b) {
  if (b.pairId != null) { const p = world.byId.get(b.pairId); if (p) p.pairId = null; b.pairId = null; }
  b.team = DEAD_TEAM; b.tag = DEAD.tag;
  b.utype = undefined; b.role = undefined; b.squadId = undefined; b.dress = undefined;
  b.hold = false; b.garrison = false; b.settled = false; b.kneel = false; b._tending = false;
  b._fuse = null; b._standPt = null; b._slotGoal = null; b.goal = null; b.tgtId = null; b.targetId = null;
  b.bounty = 0; b.brave = true; b.sickAt = null; b._biteCd = 0;
  b.hp = DEAD.hp; b.maxHp = DEAD.hp; b.sleeping = false;
}

// THE BITE: 15 points and the stamp. A man with 15 or fewer left is bitten
// to death and turns at once — no kill event, no corpse, no stain.
export function biteBody(world, u, v) {
  if (!v.alive) return;
  if (v.hp <= DEAD.bite) { turnDead(world, v); return; }
  applyDamage(world, v, DEAD.bite, { cause: "BITE", attacker: "dead", srcId: u.id, srcX: u.pos.x, srcZ: u.pos.z });
  if (v.sickAt == null) v.sickAt = world.t;
}

// prey: a living man of any other side, not sealed in a hold.
const prey = (b) => b.kind === "unit" && b.alive && b.team !== DEAD_TEAM && !b.riding && !b.pinned;

// stepDead: once per sim tick, every one of the dead. A held target is kept
// to 1.25x the sense; a fresh scan runs on a seq-staggered cadence. At arm's
// reach (both half-widths plus the pad) the body stops and bites on its
// cooldown; otherwise it seeks the target through squads.js's steer-around
// at DEAD.speed. Nothing in reach: it damps to a stand.
export function stepDead(world, dt) {
  const R2 = DEAD.sense * DEAD.sense, keep2 = R2 * 1.5625;
  for (const u of world.bodies) {
    if (u.kind !== "unit" || u.team !== DEAD_TEAM || !u.alive) continue;
    u._biteCd = (u._biteCd || 0) - dt;
    u.scanCd = (u.scanCd || 0) - dt;
    let tgt = u.tgtId ? world.byId.get(u.tgtId) : null;
    if (tgt) { const dx = tgt.pos.x - u.pos.x, dz = tgt.pos.z - u.pos.z; if (!prey(tgt) || dx * dx + dz * dz > keep2) tgt = null; }
    if (!tgt && u.scanCd <= 0) {
      u.scanCd = 0.2 + (u.seq % 8) * 0.012;
      let bd = R2;
      for (const b of world.bodies) {
        if (!prey(b)) continue;
        const dx = b.pos.x - u.pos.x, dz = b.pos.z - u.pos.z, d2 = dx * dx + dz * dz;
        if (d2 < bd) { bd = d2; tgt = b; }
      }
    }
    u.tgtId = tgt ? tgt.id : null;
    if (!tgt) { u.v.x *= 1 - Math.min(1, 6 * dt); u.v.z *= 1 - Math.min(1, 6 * dt); continue; }
    const dx = tgt.pos.x - u.pos.x, dz = tgt.pos.z - u.pos.z, d = Math.hypot(dx, dz);
    const reach = u.hx + tgt.hx + DEAD.reachPad;
    if (d <= reach) {
      u.v.x *= 1 - Math.min(1, 8 * dt); u.v.z *= 1 - Math.min(1, 8 * dt);
      if (u._biteCd <= 0) { u._biteCd = DEAD.biteCd; biteBody(world, u, tgt); }
      continue;
    }
    u.goal = { x: tgt.pos.x, z: tgt.pos.z };
    seekGoal(world, u, dt, DEAD.speed);
    faceTravel(u, dt);
  }
}

// stepSick: every stamped living man whose ten seconds are up turns.
export function stepSick(world) {
  for (const b of world.bodies) {
    if (b.kind !== "unit" || !b.alive || b.team === DEAD_TEAM || b.sickAt == null) continue;
    if (world.t - b.sickAt >= DEAD.turnS) turnDead(world, b);
  }
}
```

### Step 12 — the boot fields the outbreak

In `src/depot/boot.js`, after line 15 (`import { musterFreshStart } from "./muster.js";`) add:

```js
import { spawnOutbreak } from "./dead.js";
```

After the block at lines 384–386

```js
  if (!RES && !opts.dev) {
    musterFreshStart(world, run, depotP, grid, field, nextApcSeq, map);
  }
```

add:

```js
  // THE OUTBREAK (0.6.1): the mode flag rides the run only when set — the
  // war's run carries no key at all, so its hash is untouched. Six dead at
  // the middle town on a fresh boot, draw-free; a resume brings them back
  // as bodies off the file.
  if (opts.outbreak) run.outbreak = true;
  if (!RES && opts.outbreak) spawnOutbreak(world, map);
```

### Step 13 — the save's second key

In `src/depot/save.js`, after line 41 (`export const SAVE_KEY = "coldsnap-front-save";`) add:

```js
export const OUTBREAK_SAVE_KEY = "coldsnap-outbreak-save"; // 0.6.1: the outbreak's own slot, the same file shape
```

Replace `burnFront` and `probeFront` (lines 329–347) with the same bodies taking a key:

```js
export async function burnFront(key = SAVE_KEY) {
  try { await storage.delete(key); } catch (e) {}
  try { window.localStorage.removeItem(key); } catch (e) {}
}

// probeFront(): the start screen's async existence check. A stale-mark save is
// burned here and reported as gone, so the menu never offers a resume it
// cannot honour. Never throws. key (0.6.1): the war's slot by default, the
// outbreak's when asked.
export async function probeFront(key = SAVE_KEY) {
  let raw = null;
  try { const r = await storage.get(key); raw = r && r.value; } catch (e) {}
  if (!raw) return { has: false };
  const p = parseFront(raw);
  if (!p.ok) {
    await burnFront(key);
    return { has: false, stale: p.reason === "mark" || p.reason === "corrupt" };
  }
  return { has: true, data: p.data, bell: p.data.run.bell };
}
```

### Step 14 — the headless gate learns the outbreak

In `src/depot/api.js` line 9, after the `worldHash` import, add:

```js
import { DEAD_TEAM } from "./specs.js";
```

In `usage()`, replace

```js
    "usage: node src/depot/api.js gate [seed=1] [seconds=90]\n" +
```

with

```js
    "usage: node src/depot/api.js gate [seed=1] [seconds=90] [outbreak]\n" +
```

In `main()`'s gate branch, replace

```js
      war = bootWar({ seed });
```

with

```js
      war = bootWar({ seed, outbreak: rest[2] === "outbreak" });
```

and replace the `console.log` block

```js
    console.log(
      "seed " + seed + "  seconds " + seconds + " (" + steps + " steps)" +
      "  worldHash " + worldHash(war.world) + "  runHash " + runHash(war.run));
```

with

```js
    let dead = 0;
    for (const b of war.world.bodies) if (b.kind === "unit" && b.team === DEAD_TEAM && b.alive) dead++;
    console.log(
      "seed " + seed + "  seconds " + seconds + " (" + steps + " steps)" +
      "  worldHash " + worldHash(war.world) + "  runHash " + runHash(war.run) +
      (war.run.outbreak ? "  dead " + dead : ""));
```

The war's line is byte-identical: the suffix prints only on an outbreak.

### Step 15 — the debug hook counts the dead

In `src/depot/hooks.js` line 3, after `import { MECH } from "./specs.js";` — replace that line with:

```js
import { MECH, DEAD_TEAM } from "./specs.js";
```

In the `window.__DEPOT__` line (line 18), replace `endCard: endCardReady(run, world.t) });` at its end with:

```js
endCard: endCardReady(run, world.t), dead: world.bodies.reduce((n, b) => n + (b.kind === "unit" && b.team === DEAD_TEAM && b.alive ? 1 : 0), 0) });
```

### Step 16 — the screen: the mode, the key, the count

In `src/depot/DepotGame.jsx` line 29, add `OUTBREAK_SAVE_KEY`:

```js
import { SAVE_KEY, OUTBREAK_SAVE_KEY, burnFront, restoreBodies, restoreWelds, restoreCensus, restoreSquads } from "./save.js";
```

Line 70, the signature, add the prop:

```js
export default function DepotGame({ onExit, resume = null, dev = false, seed: menuSeed = null, outbreak = false }) {
```

Line 190, replace

```js
      const war = bootWar({ seed, resume: RES, dev });
```

with

```js
      const war = bootWar({ seed, resume: RES, dev, outbreak });
      const saveKey = outbreak ? OUTBREAK_SAVE_KEY : SAVE_KEY; // 0.6.1: the outbreak's own slot
```

Line 685, replace

```js
          Promise.resolve(storage.set(SAVE_KEY, json)).catch(() => {});
```

with

```js
          Promise.resolve(storage.set(saveKey, json)).catch(() => {});
```

Line 699, replace

```js
      burnFront();
```

with

```js
      burnFront(saveKey);
```

Lines 1416–1421, the hud census, replace

```js
            let en = 0, nw = 0, nt = 0;
            for (const b of world.bodies) {
              if (b.kind === "unit" && b.alive && b.team === 2) en++;
              else if (b.kind === "wall") { if (!b.course) nw++; } // the HUD counts WALLS, not courses
              else if (b.kind === "tower") nt++;
            }
```

with

```js
            let en = 0, nw = 0, nt = 0, dd = 0;
            for (const b of world.bodies) {
              if (b.kind === "unit" && b.alive && b.team === 2) en++;
              else if (b.kind === "unit" && b.alive && b.team === 3) dd++; // 0.6.1: the dead, counted apart
              else if (b.kind === "wall") { if (!b.course) nw++; } // the HUD counts WALLS, not courses
              else if (b.kind === "tower") nt++;
            }
```

Line 1426, replace

```js
            run._hot = en > 0 || nt > 0 || run.squads.length > 0;
```

with

```js
            run._hot = en > 0 || nt > 0 || dd > 0 || run.squads.length > 0;
```

Line 1432, replace

```js
              fps: view.fps, bell: run.bell + 1, bellT: run.bellT, enemies: en,
```

with

```js
              fps: view.fps, bell: run.bell + 1, bellT: run.bellT, enemies: en, dead: dd,
```

Line 2040, after

```js
        <div style={P.stat}>☠ {hud.enemies}</div>
```

add:

```js
        {outbreak && <div data-dead style={P.stat} title="the dead standing">☣ {hud.dead || 0}</div>}
```

Phone and desktop: the chip sits in the same top bar row as ☠ on both; no layout changes.

### Step 17 — the dead's coat and empty hands

In `src/graphics/troopkit.js`, after the `DAVY_HEX` line (`export const DAVY_HEX = ...`), add:

```js
// 0.6.1: THE DEAD's dress — a grey-green coat, the same man shape, nothing
// in hand. The hexes are a starting choice; the owner's eye rules them live.
export const DEAD_HEX = { dom: 0x5f6b55, sec: 0x3a4236, acc: 0x7c8a6e, skin: 0xb9c2a6, gun: 0x14171a };
```

In `troopKit`, replace

```js
  const pal = (b.utype === "medics" || b.tag === "medic") ? "medic"
```

with

```js
  const pal = b.team === 3 ? "dead" // 0.6.1: the third side's coat outranks every other
    : (b.utype === "medics" || b.tag === "medic") ? "medic"
```

and after the line

```js
  if (sil) return { pal, bw, bh, rifle: 1, props: KIT_PLAIN.props }; // fog: bulk only
```

add:

```js
  if (b.team === 3) return { pal, bw, bh, rifle: 0, props: KIT_NONE.props }; // 0.6.1: the dead carry nothing
```

In `src/graphics/renderer.js` line 8, add `DEAD_HEX`:

```js
import { troopKit, RIFLE_PREROT, MEDIC_HEX, DAVY_HEX, DEAD_HEX } from "./troopkit.js";
```

Line 988, the man cap, replace

```js
  const conPools = buildInfPools(INFANTRY.con, 96, INFANTRY.pal.con);
```

with

```js
  const conPools = buildInfPools(INFANTRY.con, 256, INFANTRY.pal.con); // 0.6.1: 96 -> 256 — the dead and the people join the soldiers
```

After line 1007 (`const DAVY_DEAD = mkPal(...)`) add:

```js
  // 0.6.1: the dead's palette — living coat, and the winter-kill grey of it
  const DEAD_LIVE = mkPal({ ...INFANTRY.pal.con, ...DEAD_HEX });
  const DEAD_DEAD = mkPal({ ...INFANTRY.dead.con, dom: 0x3c4438, sec: 0x262c24, acc: 0x4a5444, gun: 0x101214 });
```

Line 2190, replace

```js
      if (isG ? gi >= 24 : ci >= 96) continue;
```

with

```js
      if (isG ? gi >= 24 : ci >= 256) continue;
```

Line 2198, the fog gate, replace

```js
      if (opts.territory && b.team === 2 && b.alive) {
```

with

```js
      if (opts.territory && (b.team === 2 || b.team === 3) && b.alive) { // 0.6.1: the dead hide in the fog as the enemy does
```

This is the units loop's gate only (the line directly under the comment `// unheld ground is not rendered at all`); the vehicle and tower loops' identical lines are not touched.

After line 2232 (`const hurtK = hurtAge < 0.18 ? 1 - hurtAge / 0.18 : 0;`) add:

```js
      const stoop = world.depotCombat && b.team === 3 && b.alive ? 0.10 : 0; // 0.6.1: the dead walk stooped — the hurt dip, held
```

Line 2252, replace

```js
        const oy = o[1] * (propI !== undefined ? 1 : bh) * crouch - (crouch < 1 ? 0.06 : 0) - 0.10 * hurtK;
```

with

```js
        const oy = o[1] * (propI !== undefined ? 1 : bh) * crouch - (crouch < 1 ? 0.06 : 0) - 0.10 * hurtK - stoop;
```

Line 2290, the palette pick, replace

```js
            const pal = b.dress === "android" ? (b.alive ? AND_LIVE : AND_DEAD) : kitPal === "medic" ? (b.alive ? MED_LIVE : MED_DEAD) : kitPal === "davy" ? (b.alive ? DAVY_LIVE : DAVY_DEAD) : (b.alive ? INF_LIVE : INF_DEAD)[kitPal];
```

with

```js
            const pal = b.dress === "android" ? (b.alive ? AND_LIVE : AND_DEAD) : kitPal === "dead" ? (b.alive ? DEAD_LIVE : DEAD_DEAD) : kitPal === "medic" ? (b.alive ? MED_LIVE : MED_DEAD) : kitPal === "davy" ? (b.alive ? DAVY_LIVE : DAVY_DEAD) : (b.alive ? INF_LIVE : INF_DEAD)[kitPal];
```

Every change here is gated on `b.team === 3` or `kitPal === "dead"`, which no other mode produces; the cap raise draws nothing extra when fewer men stand.

### Step 18 — the screens: the door and the resume

In `src/ui/App.jsx`:

After line 27 (`const [depotSeed, setDepotSeed] = useState(null);`) add:

```js
  const [outbreakResume, setOutbreakResume] = useState(null); // 0.6.1: THE OUTBREAK's parsed save, or null
```

Line 73, add the outbreak to the ESC list; replace

```js
    if (!GAME_SCREENS.has(screen) && screen !== "mechrange" && screen !== "towerdef" && screen !== "depot" && screen !== "devsandbox") return; // the mech range exits on ESC too (range stays out of GAME_SCREENS: it reads raw key codes, no remap)
```

with

```js
    if (!GAME_SCREENS.has(screen) && screen !== "mechrange" && screen !== "towerdef" && screen !== "depot" && screen !== "outbreak" && screen !== "devsandbox") return; // the mech range exits on ESC too (range stays out of GAME_SCREENS: it reads raw key codes, no remap)
```

After the `if (screen === "depot") { ... }` block (lines 96–98) add:

```js
  if (screen === "outbreak") {
    // 0.6.1: THE OUTBREAK — the war screen under its mode flag.
    return <DepotGame outbreak resume={outbreakResume} seed={depotSeed} onExit={() => { setOutbreakResume(null); setScreen("menu"); }} />;
  }
```

In the `<StartScreen` element at the end, after the `onDepotResume=` line add:

```jsx
    onOutbreak={(s) => { setOutbreakResume(null); setDepotSeed(s != null ? s : null); setScreen("outbreak"); }}
    onOutbreakResume={(data) => { setOutbreakResume(data); setScreen("outbreak"); }}
```

In `src/ui/StartScreen.jsx`:

Line 4, replace

```js
import { probeFront, burnFront } from "../depot/save.js";
```

with

```js
import { probeFront, burnFront, OUTBREAK_SAVE_KEY } from "../depot/save.js";
```

Line 16, the signature, replace

```js
export default function StartScreen({ onDepot, onDepotResume, onDemos, onDevSandbox, onControls }) {
```

with

```js
export default function StartScreen({ onDepot, onDepotResume, onOutbreak, onOutbreakResume, onDemos, onDevSandbox, onControls }) {
```

After the `useEffect` that ends `}, [burnArmed]);` (the two-tap disarm, lines 26–30), add:

```js
  // THE OUTBREAK's saved run (0.6.1): its own key, its own probe, its own
  // two-tap burn — the front's shape, one key over. The menu map is the
  // front's; the outbreak paints nothing of its own.
  const [ob, setOb] = useState(null);
  const [obArmed, setObArmed] = useState(false);
  useEffect(() => {
    if (!obArmed) return;
    const t = setTimeout(() => setObArmed(false), 5000);
    return () => clearTimeout(t);
  }, [obArmed]);
  useEffect(() => {
    let live = true;
    (async () => { const f = await probeFront(OUTBREAK_SAVE_KEY); if (live) setOb(f); })();
    return () => { live = false; };
  }, []);
```

After the `startNewFront` function (ends `onDepot(newSeedRef.current); };`), add:

```js
  const hasOb = !!(ob && ob.has);
  const startNewOutbreak = () => {
    if (!hasOb) { onOutbreak(newSeedRef.current); return; }
    if (!obArmed) { setObArmed(true); return; }
    setObArmed(false);
    burnFront(OUTBREAK_SAVE_KEY);
    setOb({ has: false });
    onOutbreak(newSeedRef.current);
  };
```

In the returned markup, after the NEW FRONT `<button data-menu="depot" ...>...</button>` and before `{front && front.stale && (`, add:

```jsx
        {hasOb && (
          <button data-menu="outbreak-resume" style={option({ borderColor: "#c9a04e", background: "rgba(201,160,78,0.10)" })}
            onClick={() => onOutbreakResume && onOutbreakResume(ob.data)}>
            <div style={{ color: COLORS.gold, fontSize: 15, letterSpacing: 2 }}>▶ RESUME THE OUTBREAK</div>
            <div style={{ fontSize: 12, opacity: 0.92, marginTop: 4 }}>
              The outbreak as you left it, at bell {ob.bell}.
            </div>
          </button>
        )}

        <button data-menu="outbreak" style={option({ borderColor: obArmed ? "#a63c3c" : "#7a9a6a", background: obArmed ? "rgba(92,33,27,0.85)" : COLORS.btnBg })} onClick={startNewOutbreak}>
          <div style={{ color: obArmed ? "#ff6b5e" : "#b9d49f", fontSize: 15, letterSpacing: 2 }}>
            {obArmed ? "THE OUTBREAK BURNS — CONFIRM" : "▶ THE OUTBREAK — TAKE COMMAND"}
          </div>
          <div style={{ fontSize: 12, opacity: 0.92, marginTop: 4 }}>
            {obArmed ? "Tap again and the saved outbreak is gone for good." : "Both armies, one valley, and the dead loose in the towns."}
          </div>
        </button>
```

Phone and desktop: the button takes the same `option()` style as NEW FRONT, full width of the 420px card, so it lays out on both as the existing buttons do.

### Step 19 — the smoke learns the door

In `scripts/smoke.mjs` line 26, replace

```js
const ALL_SECTIONS = ["start", "demo", "phone", "keymap", "mech", "td", "depot"];
```

with

```js
const ALL_SECTIONS = ["start", "demo", "phone", "keymap", "mech", "td", "depot", "outbreak"];
```

Also update the comment two lines above it (`// start, demo, phone, keymap, mech, td, depot.`) to end `td, depot, outbreak.`

After the depot section's closing `}` (the line before `ok("no page errors during the run", ...)`), add:

```js
  // --- THE OUTBREAK (0.6.1): it mounts from its own door, six dead stand at
  // the opening, ESC returns.
  if (sectionEnabled("outbreak")) {
    const obURL = URL + (URL.includes("?") ? "&" : "?") + "seed=11";
    await page.evaluate(() => { localStorage.removeItem("coldsnap-outbreak-save"); localStorage.setItem("coldsnap-wf-cards", JSON.stringify({ rev: 1, seen: ["*"] })); localStorage.setItem("coldsnap-screen", "menu"); });
    await page.goto(obURL, { waitUntil: "networkidle0" });
    body = await text();
    ok("outbreak: the front door offers THE OUTBREAK", body.includes("THE OUTBREAK — TAKE COMMAND"));
    await clickMenu("outbreak");
    await page.waitForFunction(() => typeof window.__DEPOT__ === "function", { timeout: 20000 });
    const dead = await page.evaluate(() => window.__DEPOT__().dead);
    ok(`outbreak: six dead stand at the opening [${dead}]`, dead === 6);
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => document.querySelector('[data-menu="outbreak"]'), { timeout: 10000 });
    ok("outbreak: ESC returns to menu", true);
  }
```

The smoke's count rises from 23 to 26.

### Step 20 — the mark

In `src/version.js`, replace `export const MK = "0.5.87";` with `export const MK = "0.6.1";`.

### Step 21 — the gates

Run, in this order, and record each result line:

1. `node scripts/gate.mjs depot-lint` — `depot-lint PASS`.
2. `node scripts/gate.mjs depot-test` — ends `depot-test PASS`; the new era's 25 asserts all PASS; the total pass count is the old count plus 25, and the report states both numbers and the fixture seed the era printed.
3. `node scripts/gate.mjs golden` — green.
4. `npm run build`, then `npm run preview &`, then `node scripts/gate.mjs smoke` — `BOOT-LOAD SMOKE: ALL PASS`, 26 PASS lines. Stop the preview server after.

### Step 22 — the outbreak's own headless run

Run `node src/depot/api.js gate 7 20 outbreak`. It must print a line ending in `  dead N` with N between 1 and 6 and must not throw. Record the line.

### Step 23 — the keystone, after

Run `node src/depot/api.js gate 7 20`. The output must read exactly `seed 7  seconds 20 (2400 steps)  worldHash 1278094788  runHash 2033212782`. Any other number stops the task before the commit; report it.

### Step 24 — the landing

Commit everything in one commit with the subject `the door and the dead, 0.6.1` and the attribution lines the session carries. Push to `main`. Then, in `docs/superpowers/plans/2026-10-11-coldsnap-the-outbreak-phase.md`, change T1's status cell to `LANDED — mark 0.6.1, keystone unchanged (seed 7, 20 s: 1278094788 / 2033212782), depot-test +25, smoke 26/26` and commit that alone with the subject `t1 lands in the phase document — 0.6.1, the door and the dead, 26/26`. Push.

## Acceptance

- Step 0 and Step 23 print the identical line.
- `depot-test` passes with the new era's 25 asserts green, on a seed it rolled and printed.
- `golden` green. `depot-lint` PASS. Smoke 26/26.
- `node src/depot/api.js gate 7 20 outbreak` runs to the end and reports the dead.
- The live site, after deploy: the front menu shows ▶ THE OUTBREAK — TAKE COMMAND under NEW FRONT; entering it and taking command shows ☣ 6 on the top bar; the dead stand in grey-green at the middle town with nothing in hand; a bell writes a save and the menu offers ▶ RESUME THE OUTBREAK; the war's own NEW FRONT and RESUME FRONT are unchanged. The owner's eyes are the acceptance.

## Report

One line of outcome, then: every gate's result line; the two keystone lines; the depot-test totals before and after; the era's fixture seed; the outbreak gate's line; the commit hashes; every deviation, nonconformity, and re-pin as its own labeled bullet.
