# T2 — The people and the carriers (0.6.2)

The valley's towns get their people, and the sickness gets its three loose ends. People are `team` 0 unit bodies tagged `"person"`: two at the door of every standing form that has a door, three at a hangar or warehouse; brown coat, bare head, nothing in hand, a man's 58 points. They stand at their door, run at a man's pace from any of the dead within 24 meters and from any shot fired within 40 meters, and walk home after thirty seconds with nothing in range. They are hit by fire and mines like anyone; a tower under CAREFUL holds its shot for a person in the flight path. A person killed by an army adds one kill to the other army's count and pays nobody; the dead's kills carry no ledger. People hide in the fog as the enemy and the dead do and are not eyes. The top bar counts them with ☺. A bitten body's coat shifts toward the dead's grey-green over its ten seconds. A medic kneeling on a bitten man clears the sickness. A bitten rider turns inside a sealed hold, bites every rider with it at the turn and once a second after, and comes out with the rest when the hull unloads; the hull drives on meanwhile. The dead and the people do not count on the market. The war itself does not change: the headless keystone's two hashes are identical before and after.

Suggested model: Sonnet 5.5 — every step is verbatim code at a grepped anchor; nothing is designed.

## Required reading, in this order

1. `CLAUDE.md`
2. This file, whole, before the first edit.
3. `docs/superpowers/plans/2026-10-11-coldsnap-the-outbreak-phase.md` whole
4. `src/depot/dead.js` whole
5. `src/depot/specs.js` lines 46–51 and 321–327
6. `src/depot/state.js` lines 34–41, 1240–1266, 1708–1745
7. `src/depot/lists.js` whole
8. `src/depot/sim.js` lines 20–24, 529–546, 670–676
9. `src/depot/squads.js` lines 862–898
10. `src/depot/market.js` lines 43–70
11. `src/depot/transports.js` whole
12. `src/depot/boot.js` lines 384–394
13. `src/depot/hooks.js` lines 1–18
14. `src/depot/DepotGame.jsx` lines 1414–1436, 2040–2046
15. `src/graphics/troopkit.js` lines 88–100 and 140–175
16. `src/graphics/renderer.js` lines 1004–1012, 2196–2205, 2230–2260, 2288–2300
17. `src/depot/mapgen.js` lines 163–196 and 465–474 (the form book and the door index; `t.door` is a column index along the building's own x, `0` or `nx - 1`, or `-1` for no door)
18. `scripts/tests/48-the-outbreak.mjs`, `scripts/depot-test.mjs`, `scripts/smoke.mjs` lines 215–230

The report opens with a line confirming every file above was read.

## Gates

Run only these, each through `node scripts/gate.mjs <name>`: `depot-lint`, `depot-test`, `golden`, `smoke`. The smoke needs `npm run build` then `npm run preview &` first. Nothing else runs.

The keystone: `node src/depot/api.js gate 7 20` prints `seed 7  seconds 20 (2400 steps)  worldHash 1278094788  runHash 2033212782` on the untouched tree. Step 0 confirms it; Step 20 confirms it again unchanged. Any other number stops the task.

Sweep license: none. Any failing test other than the new era file's own asserts before Step 18 stops the task.

## Steps

### Step 0 — the keystone, before

Run `node src/depot/api.js gate 7 20`. The output must read exactly `seed 7  seconds 20 (2400 steps)  worldHash 1278094788  runHash 2033212782`. Record it.

### Step 1 — the failing era file

Create `scripts/tests/49-the-people.mjs`:

```js
import { ok } from "./harness.mjs";
import { makeWorld, addBody } from "../../src/engine/core.js";
import { DEAD, DEAD_TEAM, MAN, PERSON, INFANTRY_ARMS } from "../../src/depot/specs.js";
import { spawnDead, stepDead, stepSick } from "../../src/depot/dead.js";
import { spawnPerson, spawnPeople, stepPeople, peopleOf } from "../../src/depot/people.js";
import { scoreKill, creditKill, friendlyFouls } from "../../src/depot/state.js";
import { marketCounts } from "../../src/depot/market.js";
import { stepMedicTend } from "../../src/depot/squads.js";
import { unloadApc } from "../../src/depot/transports.js";
import { bootWar } from "../../src/depot/boot.js";
import { tickWar } from "../../src/depot/tick.js";
import { serializeRun, defaultTickInput } from "../../src/depot/api.js";
import { parseFront } from "../../src/depot/save.js";

// ==== 0.6.2: the people and the carriers ====================================
// Seed rolled each run.
{
  console.log("\n[0.6.2: the people and the carriers]");
  const SEED = (Date.now() % 1000000) + 1;
  console.log("  fixture seed base", SEED);
  const flat = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (x, z, o) => { o.x = 0; o.y = 1; o.z = 0; return o; } };
  const flatMap = { clampToRim: (x, z) => ({ x, z }) };
  const man = (w, team, x, z) => { const u = addBody(w, { kind: "unit", team, mass: MAN.rifle.mass, hx: MAN.rifle.hx, hy: MAN.rifle.hy, hz: MAN.rifle.hz, x, z, y: MAN.rifle.hy + 0.02, hp: MAN.rifle.hp, friction: 0.5 }); u.maxHp = MAN.rifle.hp; return u; };
  const integrate = (w, u, dt) => { u.pos.x += u.v.x * dt; u.pos.z += u.v.z * dt; };

  // (a) the person's body
  {
    const w = makeWorld({ field: flat, seed: SEED }); w.depotCombat = true;
    const p = spawnPerson(w, 3, 4);
    ok("(a) a person: a unit on team 0, the tag, a man's points, a door to stand at", p.kind === "unit" && p.team === 0 && p.tag === PERSON.tag && p.hp === MAN.rifle.hp && p.maxHp === MAN.rifle.hp && p.pdoor && Math.abs(p.pdoor.x - 3) < 5 && Math.abs(p.pdoor.z - 4) < 5, `${p.team}/${p.tag}/${p.hp}`);
  }

  // (b) the boot: people by the rule, none in the war, the boot draws untouched
  {
    const warW = bootWar({ seed: SEED }), ob = bootWar({ seed: SEED, outbreak: true });
    ok("(b) the war fields no people", peopleOf(warW.world).length === 0);
    let want = 0;
    for (const t of ob.map.TOWN) {
      if (t.depot || t.marker || t.dead || t.id.startsWith("fwall")) continue;
      if (/^hangar/.test(t.id)) { want += 3; continue; }
      if (t.door == null || t.door < 0) continue;
      want += /^warehouse/.test(t.id) ? 3 : 2;
    }
    const got = peopleOf(ob.world).length;
    ok("(b) the outbreak fields two per doored form and three per hangar or warehouse", got === want && want > 0, `${got}/${want}`);
    ok("(b) the outbreak spends no draw the war does not — the next draw is the same number", warW.world.rng() === ob.world.rng());
  }

  // (c) fear of the dead: a person 10 m from one of the dead runs away and stamps the clock
  {
    const w = makeWorld({ field: flat, seed: SEED }); w.depotCombat = true; w.t = 50;
    const p = spawnPerson(w, 0, 0); spawnDead(w, 10, 0);
    for (let i = 0; i < 120; i++) { stepPeople(w, flatMap, 1 / 120); integrate(w, p, 1 / 120); w.t += 1 / 120; }
    ok("(c) she runs away from the dead", p.pos.x < -2, p.pos.x.toFixed(2));
    ok("(c) the fear stamps the clock", p.fleeT != null && p.fleeT >= 50, String(p.fleeT));
  }

  // (d) fear of gunfire: a shot 20 m off this tick sends her running; one 50 m off does not
  {
    const w = makeWorld({ field: flat, seed: SEED }); w.depotCombat = true; w.t = 10;
    const p = spawnPerson(w, 0, 0);
    w.events.push({ type: "muzzle", x: 50, y: 1, z: 0 });
    stepPeople(w, flatMap, 1 / 120);
    ok("(d) a shot 50 m off is not heard", !p._fleeing);
    w.events.length = 0; w.events.push({ type: "muzzle", x: 20, y: 1, z: 0 });
    stepPeople(w, flatMap, 1 / 120);
    ok("(d) a shot 20 m off sends her running, away from it", !!p._fleeing && p.goal && p.goal.x < 0, p.goal ? p.goal.x.toFixed(1) : "-");
  }

  // (e) home: thirty quiet seconds and she walks back to her door
  {
    const w = makeWorld({ field: flat, seed: SEED }); w.depotCombat = true; w.t = 100;
    const p = spawnPerson(w, 0, 0); const d = spawnDead(w, 10, 0);
    for (let i = 0; i < 120; i++) { stepPeople(w, flatMap, 1 / 120); integrate(w, p, 1 / 120); w.t += 1 / 120; }
    d.alive = false;
    const far = Math.hypot(p.pos.x - p.pdoor.x, p.pos.z - p.pdoor.z);
    for (let i = 0; i < 120 * 29; i++) { stepPeople(w, flatMap, 1 / 120); integrate(w, p, 1 / 120); w.t += 1 / 120; }
    const still = Math.hypot(p.pos.x - p.pdoor.x, p.pos.z - p.pdoor.z);
    ok("(e) inside thirty seconds she stays where she stopped", far > 2 && Math.abs(still - far) < 1.0, `${far.toFixed(1)}/${still.toFixed(1)}`);
    for (let i = 0; i < 120 * 8; i++) { stepPeople(w, flatMap, 1 / 120); integrate(w, p, 1 / 120); w.t += 1 / 120; }
    ok("(e) after thirty quiet seconds she is home", Math.hypot(p.pos.x - p.pdoor.x, p.pos.z - p.pdoor.z) < 1.0, Math.hypot(p.pos.x - p.pdoor.x, p.pos.z - p.pdoor.z).toFixed(2));
  }

  // (f) the ledger: a person killed by an army scores one for the other army and pays nobody; the dead's kill scores nothing
  {
    const S = { resources: 100, score: { p: { kills: 0, value: 0 }, e: { kills: 0, value: 0 } }, reg: { scrap: 100 } };
    const r1 = scoreKill(S, { type: "kill", kind: "unit", tag: PERSON.tag, team: 0, attacker: "player" }, null);
    ok("(f) your fire on a person scores one for the enemy", r1 && S.score.e.kills === 1 && S.score.p.kills === 0 && S.score.e.value === 0, `${S.score.e.kills}/${S.score.p.kills}`);
    ok("(f) and pays nobody", S.resources === 100 && S.reg.scrap === 100);
    scoreKill(S, { type: "kill", kind: "unit", tag: PERSON.tag, team: 0, attacker: "enemy" }, null);
    ok("(f) its fire on a person scores one for you", S.score.p.kills === 1);
    const r3 = scoreKill(S, { type: "kill", kind: "unit", tag: PERSON.tag, team: 0, attacker: "dead" }, null);
    ok("(f) the dead's kill carries no ledger", r3 === null && S.score.p.kills === 1 && S.score.e.kills === 1);
  }

  // (g) the credit trail: a person's death credits no squad
  {
    const w = makeWorld({ field: flat, seed: SEED }); const s = man(w, 1, 0, 0);
    const sq = { id: 1, memberIds: [s.id], kills: 0 };
    creditKill(w, [sq], [], { type: "kill", kind: "unit", tag: PERSON.tag, team: 0, srcId: s.id });
    ok("(g) no credit for a person", !sq.kills);
  }

  // (h) the market: people are not men on the market
  {
    const w = makeWorld({ field: flat, seed: SEED }); man(w, 1, 0, 0); man(w, 2, 2, 0); spawnPerson(w, 4, 0); spawnPerson(w, 6, 0);
    ok("(h) two men count, two people do not", marketCounts(w, [], [])._men === 2, `${marketCounts(w, [], [])._men}`);
  }

  // (i) the medic's cure: kneeling on a bitten comrade clears the stamp
  {
    const w = makeWorld({ field: flat, seed: SEED }); w.depotCombat = true; w.t = 20;
    const medic = man(w, 1, 0, 0); const pat = man(w, 1, 0.8, 0); pat.hp -= 15; pat.sickAt = 20;
    stepMedicTend(w, medic, 0, 0, 1 / 120);
    ok("(i) the kneel clears the sickness", pat.sickAt == null && medic.kneel === true, `${pat.sickAt}/${medic.kneel}`);
  }

  // (j) CAREFUL holds for a person in the flight path
  {
    const w = makeWorld({ field: flat, seed: SEED }); w.depotCombat = true;
    const muzzle = { x: 0, y: 1.5, z: 0 }, tgt = { x: 10, y: 1.0, z: 0 };
    ok("(j) an empty lane does not foul", !friendlyFouls(w, muzzle, tgt, INFANTRY_ARMS.rifles, null));
    spawnPerson(w, 5, 0);
    ok("(j) a person in the lane fouls the shot", friendlyFouls(w, muzzle, tgt, INFANTRY_ARMS.rifles, null));
  }

  // (k) the hold: a bitten rider turns inside, bites the rider with him, and comes out at the unload
  {
    const w = makeWorld({ field: flat, seed: SEED }); w.depotCombat = true; w.t = 30;
    const v = addBody(w, { kind: "vehicle", team: 1, mass: 2600, hx: 1.6, hy: 1.0, hz: 3.0, x: 0, y: 1.05, z: 0, hp: 300 }); v.vtype = "apc"; v.apcSeq = 1;
    const a = man(w, 1, 0, 0), b = man(w, 1, 0, 0);
    for (const u of [a, b]) { u.riding = true; u.pinned = true; u.pos.y = -60; }
    const run = { squads: [{ id: 1, type: "rifles", team: 1, order: "ride", dest: null, memberIds: [a.id, b.id], anchor: { x: 0, z: 0 }, ridingIn: 1 }], foeSquads: [] };
    a.sickAt = 20;
    stepSick(w, run);
    ok("(k) the bitten rider turns inside the hold and keeps his seat", a.team === DEAD_TEAM && a.rideApc === 1 && a.riding === true, `${a.team}/${a.rideApc}/${a.riding}`);
    stepDead(w, 1 / 120, run);
    ok("(k) he bites the rider with him at the turn", b.hp === MAN.rifle.hp - 15 && b.sickAt === 30, `${b.hp}/${b.sickAt}`);
    for (let i = 0; i < 60; i++) { w.t += 1 / 120; stepDead(w, 1 / 120, run); }
    ok("(k) inside a second he has not bitten again", b.hp === MAN.rifle.hp - 15, `${b.hp}`);
    for (let i = 0; i < 70; i++) { w.t += 1 / 120; stepDead(w, 1 / 120, run); }
    ok("(k) a second on, he bites again", b.hp === MAN.rifle.hp - 30, `${b.hp}`);
    unloadApc(w, run.squads, v);
    ok("(k) the unload puts the dead out with the living", a.rideApc == null && a.riding === false && b.riding === false && a.pos.y > -1, `${a.rideApc}/${a.riding}/${b.riding}/${a.pos.y.toFixed(1)}`);
  }

  // (l) the save: people ride the outbreak's save and come back
  {
    const ob = bootWar({ seed: SEED, outbreak: true }); ob.run.started = true;
    const input = defaultTickInput();
    for (let i = 0; i < 120; i++) tickWar(ob, 1 / 120, input);
    const n0 = peopleOf(ob.world).length;
    const p = parseFront(serializeRun(ob));
    const back = bootWar({ seed: p.data.map.seed, resume: p.data, outbreak: true });
    const n1 = peopleOf(back.world).length;
    ok("(l) the people come back, every one, with their doors", n1 === n0 && n0 > 0 && peopleOf(back.world).every((b) => b.pdoor && Number.isFinite(b.pdoor.x)), `${n0}->${n1}`);
  }
}
```

In `scripts/depot-test.mjs`, after `await import("./tests/48-the-outbreak.mjs");` add:

```js
await import("./tests/49-the-people.mjs");
```

Run `node scripts/gate.mjs depot-test`. It must fail at the new file's import (no `people.js`). Record the failure line.

### Step 2 — the people's row in the specs

In `src/depot/specs.js`, after the `DEAD` line (the file's last line, `export const DEAD = ...`), append:

```js

// THE PEOPLE (0.6.2): the valley's own, team 0, nobody's soldiers. A man's
// body and points; a man's pace when they run; fear of the dead at 24 m and
// of gunfire at 40 m; thirty quiet seconds before they walk home.
export const PERSON = { ...MAN.rifle, tag: "person", speed: 3.2, fear: 24, gunFear: 40, homeS: 30, fleeStep: 8 };
```

### Step 3 — the ledger, the credit trail, and CAREFUL in `state.js`

In `src/depot/state.js` line 11, add `PERSON` to the specs import:

```js
import { TOWER_SPECS, ENEMY_SPECS, TANK, INFANTRY_ARMS, MASON, PLAYER_START, PLAYER_TIERS, HAND_KEYS, HAND_TAGS, MAN, GRENADE, DAVY_FIRE, DEAD_TEAM, PERSON } from "./specs.js";
```

In `friendlyBlocksPoint`, replace the closing

```js
    if (Math.abs(x - b.pos.x) <= b.hx + FRIENDLY_MARGIN &&
        Math.abs(y - b.pos.y) <= b.hy + FRIENDLY_MARGIN &&
        Math.abs(z - b.pos.z) <= b.hz + FRIENDLY_MARGIN) return true;
  }
  return false;
}
```

with

```js
    if (Math.abs(x - b.pos.x) <= b.hx + FRIENDLY_MARGIN &&
        Math.abs(y - b.pos.y) <= b.hy + FRIENDLY_MARGIN &&
        Math.abs(z - b.pos.z) <= b.hz + FRIENDLY_MARGIN) return true;
  }
  // 0.6.2: CAREFUL holds for a living person in the flight path — the
  // people's own pool (lists.js), the same box and margin.
  const ppool = world._L ? world._L.people : world.bodies;
  for (const b of ppool) {
    if (!b.alive || b.kind !== "unit" || b.tag !== PERSON.tag) continue;
    if (Math.abs(x - b.pos.x) <= b.hx + FRIENDLY_MARGIN &&
        Math.abs(y - b.pos.y) <= b.hy + FRIENDLY_MARGIN &&
        Math.abs(z - b.pos.z) <= b.hz + FRIENDLY_MARGIN) return true;
  }
  return false;
}
```

In `creditKill` (line 1718), replace

```js
  if (ev.team === DEAD_TEAM) return; // 0.6.1: a dead kill credits nobody
```

with

```js
  if (ev.team === DEAD_TEAM || ev.tag === PERSON.tag) return; // 0.6.1: a dead kill credits nobody; 0.6.2: nor does a person's death
```

In `scoreKill`, after the line `if (!att) return null;` add:

```js
  // 0.6.2: a person killed by an army scores ONE for the other army and
  // pays nobody — the kill integer only, no value, no cut. The dead's kills
  // never reach here (attacker "dead" is not a side).
  if (ev.kind === "unit" && ev.tag === PERSON.tag) {
    (att === 1 ? S.score.e : S.score.p).kills++;
    return { side: att, price: 0, pay: 0, counted: true, person: true };
  }
```

### Step 4 — the people's pool

In `src/depot/lists.js` line 14, replace

```js
import { DEAD_TEAM } from "./specs.js";
```

with

```js
import { DEAD_TEAM, PERSON } from "./specs.js";
```

Line 18, replace

```js
  return { solids: [], statics: [], friends: [], foes: [], structsFor1: [], structsFor2: [], friendly: [], vehicles: [] };
```

with

```js
  return { solids: [], statics: [], friends: [], foes: [], structsFor1: [], structsFor2: [], friendly: [], vehicles: [], people: [] };
```

Line 28, replace

```js
  L.structsFor1.length = 0; L.structsFor2.length = 0; L.friendly.length = 0;
```

with

```js
  L.structsFor1.length = 0; L.structsFor2.length = 0; L.friendly.length = 0; L.people.length = 0;
```

After line 39 (`if (b.team === 2 || b.team === DEAD_TEAM) L.foes.push(b);`) add:

```js
      if (b.tag === PERSON.tag) L.people.push(b); // 0.6.2: CAREFUL's people check reads this
```

### Step 5 — the market ignores the people

In `src/depot/market.js` line 60, replace

```js
    if (b.kind === "unit" && b.team !== DEAD_TEAM) c._men = (c._men || 0) + 1; // both armies — squad men are unit bodies too; the dead are not men on the market (0.6.1)
```

with

```js
    if (b.kind === "unit" && b.team !== DEAD_TEAM && b.team !== 0) c._men = (c._men || 0) + 1; // both armies — squad men are unit bodies too; the dead (0.6.1) and the people (0.6.2) are not men on the market
```

### Step 6 — the medic's cure

In `src/depot/squads.js` line 896, replace

```js
  best.hp = Math.min(best.maxHp, best.hp + MEDIC_RATE * dt);
```

with

```js
  best.hp = Math.min(best.maxHp, best.hp + MEDIC_RATE * dt);
  if (best.sickAt != null) best.sickAt = null; // 0.6.2: the medic's cure — the kneel clears the sickness, both armies' medics alike
```

### Step 7 — the hold carries the dead

In `src/depot/transports.js` line 10, replace

```js
import { APC, JEEP } from "./specs.js";
```

with

```js
import { APC, JEEP, DEAD_TEAM } from "./specs.js";
```

Line 50, replace

```js
    if (b.kind !== "unit" || b.team !== 2 || b.rideApc == null || !b.alive) continue;
```

with

```js
    if (b.kind !== "unit" || (b.team !== 2 && b.team !== DEAD_TEAM) || b.rideApc == null || !b.alive) continue; // 0.6.2: a rider who turned keeps his seat the ferry way
```

In `unloadApc`, replace its closing lines

```js
      u.v.x = 0; u.v.y = 0; u.v.z = 0;
    }
  }
  v._unloadT = world.t;
}
```

(unique: `unloadEnemyRiders` below writes `b.v.x`, not `u.v.x`) with

```js
      u.v.x = 0; u.v.y = 0; u.v.z = 0;
    }
  }
  unloadEnemyRiders(world, v); // 0.6.2: the dead sealed in the hold come out with the living — the ferry's own ring
  v._unloadT = world.t;
}
```

`unloadEnemyRiders` is defined below in the same file; it rings out every body seated by `rideApc` on this hull, whatever its team, and its own `v._unloadT` stamp is the same value.

### Step 8 — the dead learn the hold

In `src/depot/dead.js`, replace `biteBody` whole:

```js
export function biteBody(world, u, v) {
  if (!v.alive) return;
  if (v.hp <= DEAD.bite) { turnDead(world, v); return; }
  applyDamage(world, v, DEAD.bite, { cause: "BITE", attacker: "dead", srcId: u.id, srcX: u.pos.x, srcZ: u.pos.z });
  if (v.sickAt == null) v.sickAt = world.t;
}
```

with

```js
export function biteBody(world, u, v) {
  if (!v.alive) return;
  if (v.hp <= DEAD.bite) {
    if (v.riding && v.rideApc == null && u.rideApc != null) v.rideApc = u.rideApc; // 0.6.2: bitten to death in a hold — he keeps the seat
    turnDead(world, v);
    return;
  }
  applyDamage(world, v, DEAD.bite, { cause: "BITE", attacker: "dead", srcId: u.id, srcX: u.pos.x, srcZ: u.pos.z });
  if (v.sickAt == null) v.sickAt = world.t;
}
```

Replace the `stepDead` signature and the top of its loop

```js
export function stepDead(world, dt) {
  const R2 = DEAD.sense * DEAD.sense, keep2 = R2 * 1.5625;
  for (const u of world.bodies) {
    if (u.kind !== "unit" || u.team !== DEAD_TEAM || !u.alive) continue;
    u._biteCd = (u._biteCd || 0) - dt;
```

with

```js
export function stepDead(world, dt, run = null) {
  const R2 = DEAD.sense * DEAD.sense, keep2 = R2 * 1.5625;
  for (const u of world.bodies) {
    if (u.kind !== "unit" || u.team !== DEAD_TEAM || !u.alive) continue;
    u._biteCd = (u._biteCd || 0) - dt;
    // 0.6.2: THE HOLD — one of the dead sealed in a hull bites every rider
    // with it on the bite cadence: the ferry's loose riders by their seat,
    // a squad's riders by its roster. It never walks; the hull drives on.
    if (u.rideApc != null) {
      if (u._biteCd > 0) continue;
      u._biteCd = DEAD.biteCd;
      for (const b of world.bodies) if (b.kind === "unit" && b.alive && b.team !== DEAD_TEAM && b.riding && b.rideApc === u.rideApc) biteBody(world, u, b);
      if (run) for (const sq of [...(run.squads || []), ...(run.foeSquads || [])]) {
        if (sq.ridingIn !== u.rideApc) continue;
        for (const id of sq.memberIds) { const b = world.byId.get(id); if (b && b.alive && b.team !== DEAD_TEAM && b.riding) biteBody(world, u, b); }
      }
      continue;
    }
```

Replace `stepSick` whole:

```js
export function stepSick(world) {
  for (const b of world.bodies) {
    if (b.kind !== "unit" || !b.alive || b.team === DEAD_TEAM || b.sickAt == null) continue;
    if (world.t - b.sickAt >= DEAD.turnS) turnDead(world, b);
  }
}
```

with

```js
export function stepSick(world, run = null) {
  for (const b of world.bodies) {
    if (b.kind !== "unit" || !b.alive || b.team === DEAD_TEAM || b.sickAt == null) continue;
    if (world.t - b.sickAt < DEAD.turnS) continue;
    // 0.6.2: a rider turns INSIDE the hold — his squad's seat number becomes
    // his own (the ferry's rideApc), so the hold keeps him and the unload
    // puts him out. The loose-rider loop in transports.js pins him there.
    if (b.riding && b.rideApc == null && run) {
      for (const sq of [...(run.squads || []), ...(run.foeSquads || [])]) if (sq.ridingIn != null && sq.memberIds.includes(b.id)) { b.rideApc = sq.ridingIn; break; }
    }
    turnDead(world, b);
  }
}
```

### Step 9 — the people, their own file

Create `src/depot/people.js`:

```js
// COLDSNAP DEPOT — people.js: THE PEOPLE (0.6.2). Team 0 unit bodies
// tagged PERSON.tag, two at the door of every standing form with a door,
// three at a hangar or warehouse. They stand at their door; any of the dead
// within PERSON.fear meters, or a shot fired within PERSON.gunFear meters
// this tick, sends them running away from it at a man's pace through
// squads.js's steer-around; PERSON.homeS quiet seconds later they walk
// home. They fire nothing, see nothing, hold nothing. No rng anywhere:
// door spots are fixed geometry through clearSlot, scans are seq-staggered.
import { addBody } from "../engine/core.js";
import { MASON, PERSON, DEAD_TEAM } from "./specs.js";
import { clearSlot, seekGoal } from "./squads.js";
import { faceTravel } from "./units.js";

export function peopleOf(world) {
  const out = [];
  for (const b of world.bodies) if (b.kind === "unit" && b.tag === PERSON.tag && b.alive) out.push(b);
  return out;
}

export function spawnPerson(world, x, z) {
  const p = clearSlot(world, x, z, PERSON.hx + 0.35);
  const u = addBody(world, { kind: "unit", team: 0, tag: PERSON.tag, mass: PERSON.mass, hx: PERSON.hx, hy: PERSON.hy, hz: PERSON.hz,
    x: p.x, z: p.z, y: world.field.heightAt(p.x, p.z) + PERSON.hy + 0.02, hp: PERSON.hp, friction: 0.5 });
  u.maxHp = PERSON.hp; u.smearStyle = "human"; u.brave = true; u.bounty = 0;
  u.pdoor = { x: p.x, z: p.z }; // where she stands, and walks back to
  u.fleeT = -1000;              // the last fright, on the sim clock
  u.wph = (u.seq * 1.7) % 6.28;
  u.sleeping = true;
  return u;
}

// The door spot: just outside the doorway. buildTown carves the door in
// the column ix = t.door (0 or nx - 1) at rows iz 1..2, so the opening is
// on an x face and the outside is one step past that face. The hangar has
// no door but a drive-through on its long axis; its people stand at one
// end of it.
function doorSpot(t) {
  const p = MASON.pitch;
  if (/^hangar/.test(t.id)) {
    const driveZ = t.nz >= t.nx;
    return driveZ ? { x: t.x, z: t.z + ((t.nz - 1) / 2) * p + 1.3, along: "x" } : { x: t.x + ((t.nx - 1) / 2) * p + 1.3, z: t.z, along: "z" };
  }
  const side = t.door === 0 ? -1 : 1;
  return { x: t.x + side * (((t.nx - 1) / 2) * p + 1.3), z: t.z + (1.5 - (t.nz - 1) / 2) * p, along: "z" };
}

export function spawnPeople(world, map) {
  const out = [];
  for (const t of map.TOWN) {
    if (t.depot || t.marker || t.dead || t.id.startsWith("fwall")) continue;
    const hangar = /^hangar/.test(t.id);
    if (!hangar && (t.door == null || t.door < 0)) continue;
    const n = hangar || /^warehouse/.test(t.id) ? 3 : 2;
    const d = doorSpot(t);
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * 0.9;
      out.push(spawnPerson(world, d.along === "x" ? d.x + off : d.x, d.along === "z" ? d.z + off : d.z));
    }
  }
  return out;
}

// stepPeople: once per sim tick, after the guns have fired (this tick's
// muzzle events are on world.events). A fright sets the goal one fleeStep
// away from the threat and stamps fleeT; the run continues until a scan
// finds nothing; homeS quiet seconds later she walks back to her door.
export function stepPeople(world, map, dt) {
  let shots = null;
  for (const e of world.events) if (e.type === "muzzle") (shots || (shots = [])).push(e);
  const F2 = PERSON.fear * PERSON.fear, G2 = PERSON.gunFear * PERSON.gunFear;
  for (const u of world.bodies) {
    if (u.kind !== "unit" || u.tag !== PERSON.tag || !u.alive || u.riding) continue;
    u.scanCd = (u.scanCd || 0) - dt;
    if (u.scanCd <= 0 || shots) {
      if (u.scanCd <= 0) u.scanCd = 0.2 + (u.seq % 8) * 0.012;
      let tx = null, tz = null, bd = F2;
      for (const b of world.bodies) {
        if (b.kind !== "unit" || b.team !== DEAD_TEAM || !b.alive || b.riding) continue;
        const dx = b.pos.x - u.pos.x, dz = b.pos.z - u.pos.z, d2 = dx * dx + dz * dz;
        if (d2 < bd) { bd = d2; tx = b.pos.x; tz = b.pos.z; }
      }
      if (tx == null && shots) {
        let gd = G2;
        for (const e of shots) { const dx = e.x - u.pos.x, dz = e.z - u.pos.z, d2 = dx * dx + dz * dz; if (d2 < gd) { gd = d2; tx = e.x; tz = e.z; } }
      }
      if (tx != null) {
        u.fleeT = world.t;
        const dx = u.pos.x - tx, dz = u.pos.z - tz, d = Math.hypot(dx, dz) || 1;
        const g = map.clampToRim(u.pos.x + (dx / d) * PERSON.fleeStep, u.pos.z + (dz / d) * PERSON.fleeStep);
        u.goal = { x: g.x, z: g.z }; u._fleeing = true;
      } else if (u._fleeing && u.scanCd > 0.19) { u._fleeing = false; u.goal = null; }
    }
    if (u._fleeing && u.goal) { seekGoal(world, u, dt, PERSON.speed); faceTravel(u, dt); continue; }
    if (u.pdoor && world.t - (u.fleeT != null ? u.fleeT : -1e9) >= PERSON.homeS && Math.hypot(u.pdoor.x - u.pos.x, u.pdoor.z - u.pos.z) > 0.6) {
      u.goal = { x: u.pdoor.x, z: u.pdoor.z };
      seekGoal(world, u, dt, PERSON.speed); faceTravel(u, dt);
      continue;
    }
    u.v.x *= 1 - Math.min(1, 6 * dt); u.v.z *= 1 - Math.min(1, 6 * dt);
  }
}
```

The `_fleeing` release reads `u.scanCd > 0.19` so the flag only drops on a tick that ran a fresh scan (a gunfire-only pass with the cadence still running never ends a flight by itself).

### Step 10 — the sim steps the people

In `src/depot/sim.js` line 9, add `PERSON`:

```js
import { TOWER_SPECS, MASON, INFANTRY_ARMS, DEAD_TEAM, PERSON } from "./specs.js";
```

After line 23 (`import { stepDead, stepSick } from "./dead.js";`) add:

```js
import { stepPeople } from "./people.js";
```

Lines 542–543, replace

```js
    stepDead(world, world.dt);
    stepSick(world);
```

with

```js
    stepDead(world, world.dt, run);
    stepSick(world, run);
```

After line 674 (`stepTowers(world, T, discipline, ...);`) add:

```js
  // THE PEOPLE (0.6.2): after the guns, so this tick's muzzle events are on
  // world.events for the gunfire fear; before stepWorld like every driver.
  if (run && run.outbreak) {
    stepPeople(world, map, world.dt);
    for (const b of world.bodies) if (b.kind === "unit" && b.tag === PERSON.tag && b.alive) uprightMember(b, world.dt);
  }
```

### Step 11 — the boot fields the people

In `src/depot/boot.js`, after line 16 (`import { spawnOutbreak } from "./dead.js";`) add:

```js
import { spawnPeople } from "./people.js";
```

Line 393, replace

```js
  if (!RES && opts.outbreak) spawnOutbreak(world, map);
```

with

```js
  if (!RES && opts.outbreak) { spawnOutbreak(world, map); spawnPeople(world, map); } // 0.6.2: the people at their doors, draw-free
```

### Step 12 — the debug hook and the top bar

In `src/depot/hooks.js` line 3, replace

```js
import { MECH, DEAD_TEAM } from "./specs.js";
```

with

```js
import { MECH, DEAD_TEAM, PERSON } from "./specs.js";
```

In the `window.__DEPOT__` line, replace its ending

```js
dead: world.bodies.reduce((n, b) => n + (b.kind === "unit" && b.team === DEAD_TEAM && b.alive ? 1 : 0), 0) });
```

with

```js
dead: world.bodies.reduce((n, b) => n + (b.kind === "unit" && b.team === DEAD_TEAM && b.alive ? 1 : 0), 0), people: world.bodies.reduce((n, b) => n + (b.kind === "unit" && b.tag === PERSON.tag && b.alive ? 1 : 0), 0) });
```

In `src/depot/DepotGame.jsx` line 1417, replace

```js
            let en = 0, nw = 0, nt = 0, dd = 0;
```

with

```js
            let en = 0, nw = 0, nt = 0, dd = 0, pp = 0;
```

Line 1420, after

```js
              else if (b.kind === "unit" && b.alive && b.team === 3) dd++; // 0.6.1: the dead, counted apart
```

add:

```js
              else if (b.kind === "unit" && b.alive && b.tag === "person") pp++; // 0.6.2: the living people
```

Line 1434, replace

```js
              fps: view.fps, bell: run.bell + 1, bellT: run.bellT, enemies: en, dead: dd,
```

with

```js
              fps: view.fps, bell: run.bell + 1, bellT: run.bellT, enemies: en, dead: dd, people: pp,
```

Line 2043, after

```js
        {outbreak && <div data-dead style={P.stat} title="the dead standing">☣ {hud.dead || 0}</div>}
```

add:

```js
        {outbreak && <div data-people style={P.stat} title="the living people">☺ {hud.people || 0}</div>}
```

Phone and desktop: the chip sits in the same top bar row as ☠ and ☣ on both; no layout change.

### Step 13 — the look: the brown coat, the bare head, the sick tint

In `src/graphics/troopkit.js`, after the `DEAD_HEX` line (line 94) add:

```js
// 0.6.2: THE PEOPLE's dress — an ochre-brown coat, bare head, nothing in
// hand. Hexes are a starting choice; the owner's eye rules them live.
export const PERSON_HEX = { dom: 0x7a5a3a, sec: 0x3a2e24, acc: 0x9a7a52, skin: 0xd9c6a0, gun: 0x14171a };
```

Line 151, replace

```js
  const pal = b.team === 3 ? "dead" // 0.6.1: the third side's coat outranks every other
```

with

```js
  const pal = b.team === 3 ? "dead" // 0.6.1: the third side's coat outranks every other
    : b.tag === "person" ? "person" // 0.6.2: the people's coat
```

After line 161 (`if (b.team === 3) return { pal, bw, bh, rifle: 0, props: KIT_NONE.props }; // 0.6.1: the dead carry nothing`) add:

```js
  if (b.tag === "person") return { pal, bw, bh, rifle: 0, props: KIT_NONE.props, cap: 0 }; // 0.6.2: the people carry nothing and go bareheaded
```

In `src/graphics/renderer.js` line 8, replace

```js
import { troopKit, RIFLE_PREROT, MEDIC_HEX, DAVY_HEX, DEAD_HEX } from "./troopkit.js";
```

with

```js
import { troopKit, RIFLE_PREROT, MEDIC_HEX, DAVY_HEX, DEAD_HEX, PERSON_HEX } from "./troopkit.js";
```

After line 1010 (`const DEAD_DEAD = mkPal(...)`) add:

```js
  // 0.6.2: the people's palette — living coat, and the winter-kill grey of it
  const PERSON_LIVE = mkPal({ ...INFANTRY.pal.con, ...PERSON_HEX });
  const PERSON_DEAD = mkPal({ ...INFANTRY.dead.con, dom: 0x4a3c2e, sec: 0x241e18, acc: 0x5a4a34, gun: 0x101214 });
```

Line 2201, the units loop's fog gate, replace

```js
      if (opts.territory && (b.team === 2 || b.team === 3) && b.alive) { // 0.6.1: the dead hide in the fog as the enemy does
```

with

```js
      if (opts.territory && (b.team === 2 || b.team === 3 || b.tag === "person") && b.alive) { // 0.6.1: the dead hide in the fog as the enemy does; 0.6.2: so do the people
```

After line 2235 (`const stoop = ...`) add:

```js
      const sickK = world.depotCombat && b.alive && b.team !== 3 && b.sickAt != null ? Math.min(1, (world.t - b.sickAt) / 10) : 0; // 0.6.2: the sick tint — the coat drifts to the dead's over the ten seconds
```

Line 2252, replace

```js
        } else if (p.key === "rifle") { ksx = ksy = ksz = KIT.rifle; }
```

with

```js
        } else if (p.key === "rifle") { ksx = ksy = ksz = KIT.rifle; }
        else if (p.key === "cap" && KIT.cap === 0) { ksx = ksy = ksz = 0; } // 0.6.2: a bare head is a cap at zero scale
```

Lines 2294–2296, replace

```js
            const pal = b.dress === "android" ? (b.alive ? AND_LIVE : AND_DEAD) : kitPal === "dead" ? (b.alive ? DEAD_LIVE : DEAD_DEAD) : kitPal === "medic" ? (b.alive ? MED_LIVE : MED_DEAD) : kitPal === "davy" ? (b.alive ? DAVY_LIVE : DAVY_DEAD) : (b.alive ? INF_LIVE : INF_DEAD)[kitPal];
            if (hurtK > 0) { _hitC.copy(pal[propRole || p.role]).lerp(HIT_C, 0.7 * hurtK); pools[pi].setColorAt(idx, _hitC); }
            else pools[pi].setColorAt(idx, pal[propRole || p.role]);
```

with

```js
            const pal = b.dress === "android" ? (b.alive ? AND_LIVE : AND_DEAD) : kitPal === "dead" ? (b.alive ? DEAD_LIVE : DEAD_DEAD) : kitPal === "person" ? (b.alive ? PERSON_LIVE : PERSON_DEAD) : kitPal === "medic" ? (b.alive ? MED_LIVE : MED_DEAD) : kitPal === "davy" ? (b.alive ? DAVY_LIVE : DAVY_DEAD) : (b.alive ? INF_LIVE : INF_DEAD)[kitPal];
            const role9 = propRole || p.role;
            if (hurtK > 0 || (sickK > 0 && role9 === "dom")) {
              _hitC.copy(pal[role9]);
              if (sickK > 0 && role9 === "dom") _hitC.lerp(DEAD_LIVE.dom, sickK); // 0.6.2: the sick tint on the coat
              if (hurtK > 0) _hitC.lerp(HIT_C, 0.7 * hurtK);
              pools[pi].setColorAt(idx, _hitC);
            }
            else pools[pi].setColorAt(idx, pal[role9]);
```

Every change is gated on `tag === "person"`, `kitPal === "person"`, `KIT.cap === 0`, or a `sickAt` stamp, none of which the war produces; the war's color path is the same two branches it was.

### Step 14 — the smoke counts the people

In `scripts/smoke.mjs`, after line 225 (`ok(\`outbreak: six dead stand at the opening [${dead}]\`, dead === 6);`) add:

```js
    const people = await page.evaluate(() => window.__DEPOT__().people);
    ok(`outbreak: the people stand at their doors [${people}]`, people > 0);
```

The smoke's count rises from 26 to 27.

### Step 15 — the mark

In `src/version.js`, replace `export const MK = "0.6.1";` with `export const MK = "0.6.2";`.

### Step 16 — the gates

Run, in this order, and record each result line:

1. `node scripts/gate.mjs depot-lint` — `depot-lint PASS`.
2. `node scripts/gate.mjs depot-test` — ends `depot-test PASS`; the new era's 25 asserts all PASS; the total is 1640 + 25 = 1665 PASS / 0 FAIL; the report states the numbers and the era's fixture seed.
3. `node scripts/gate.mjs golden` — green.
4. `npm run build`, then `npm run preview &`, then `node scripts/gate.mjs smoke` — `BOOT-LOAD SMOKE: ALL PASS`, 27 PASS lines. Stop the preview server after.

### Step 17 — the outbreak's own headless run

Run `node src/depot/api.js gate 7 20 outbreak`. It must print a line ending in `  dead N` and must not throw. Record the line.

### Step 18 — the keystone, after

Run `node src/depot/api.js gate 7 20`. The output must read exactly `seed 7  seconds 20 (2400 steps)  worldHash 1278094788  runHash 2033212782`. Any other number stops the task before the commit; report it.

### Step 19 — the landing

Commit exactly these files in one commit: `src/depot/specs.js`, `state.js`, `lists.js`, `market.js`, `squads.js`, `transports.js`, `dead.js`, `people.js`, `sim.js`, `boot.js`, `hooks.js`, `DepotGame.jsx`; `src/graphics/troopkit.js`, `renderer.js`; `src/version.js`; `scripts/depot-test.mjs`, `scripts/smoke.mjs`, `scripts/tests/49-the-people.mjs`; and this plan file. Subject: `the people and the carriers, 0.6.2`. Push to `main`. Then change T2's status cell in `docs/superpowers/plans/2026-10-11-coldsnap-the-outbreak-phase.md` to `LANDED — mark 0.6.2, keystone unchanged (seed 7, 20 s: 1278094788 / 2033212782), depot-test 1665, smoke 27/27` and commit that file alone with the subject `t2 lands in the phase document — 0.6.2, the people and the carriers, 27/27`. Push.

### Step 20 — the keystone, confirmed on the pushed tree

Run `node src/depot/api.js gate 7 20` once more after the push and record the line; it must still match Step 0.

## Acceptance

- Step 0, Step 18, and Step 20 print the identical line.
- `depot-test` 1665 PASS / 0 FAIL on a rolled seed; `golden` green; `depot-lint` PASS; smoke 27/27.
- The outbreak gate runs to the end.
- The live site: people in brown coats, bareheaded, standing at the doors of the towns and hamlets, ☺ on the top bar beside ☣; they scatter from the dead and from gunfire and drift home when it is quiet; a bitten man's coat goes grey-green before he turns; a medic kneeling on him clears it. The owner's eyes are the acceptance.

## Report

One line of outcome, then: every gate's result line; the three keystone lines; the depot-test totals; the era's fixture seed; the outbreak gate's line; the commit hashes; every deviation, nonconformity, and re-pin as its own labeled bullet.
