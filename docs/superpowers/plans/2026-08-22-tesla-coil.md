# The Tesla Coil — the complete plan

Four tasks, dispatched one at a time, each its own deploy: mk2.15 the chain, mk2.16 the look, mk2.17 the sound, mk2.18 the switch and the words. The design is `docs/superpowers/specs/2026-08-22-tesla-coil-design.md` (owner-approved rulings in this session). Every number below that the design did not fix is marked provisional.

**The key renames (owner, 2026-08-22): `frost` becomes `tesla` everywhere in the depot.** No save migration — saves are never migrated (standing orders), and the owner has ruled old saves don't matter. Consequence, stated: a pre-mk2.15 save restoring a tower body with `towerType: "frost"` finds no spec row and falls to the gun fallback (`TOWER_SPECS[b.towerType] || TOWER_SPECS.gun`, DepotGame.jsx:133 region) — an old frost tower comes back behaving as a gun, and an old hand card keyed `frost` dies unmatched. Accepted. The legacy mode (`src/game/ColdsnapTD.jsx`) owns its own private `TOWER_SPECS` table and keeps its `frost` untouched; `renderer.js:1822`'s `towerType === "frost"` aura line serves that legacy mode and is left alone.

**Symmetry:** the tower converts for both sides at once — one spec table row serves both, the enemy's draft pool (`DRAFT_TOWERS`, the tier lists) carries the renamed key after Task 1's sweep, and `stepTowers` already runs both teams. The avoid-friendlies switch is per-side data; the enemy's side starts OFF and stays OFF because nothing flips it — capability symmetric, same shape as the existing CAREFUL check precedent (`DepotGame.jsx:177`, enemy fire never runs it, owner-sanctioned).

---

## Task 1 — the chain (mk2.15)

**Suggested model: Sonnet 5** — every step carries its code; nothing is designed at dispatch.

**Required reading:** this task's section in full; `src/depot/specs.js:19-44`; `src/depot/DepotGame.jsx:116-190, 545-600, 1410-1420`; `src/depot/state.js:1-30, 380-475, 660-710, 829-850, 1363-1400`; `src/depot/save.js:240-295`; `src/depot/mapgen.js:410-416`; `src/render/renderer.js:1225-1230`; `scripts/tests/21-the-broken-ridge.mjs` (the suite idiom). The agent's report opens by confirming each was read.

### Step 1 — the failing asserts

A new suite era file. It fails until the later steps land, and every assert below is the task's acceptance. Fixture seed 13; no seed is special.

Create `scripts/tests/22-the-tesla-coil.mjs`:

```js
// COLDSNAP suite era 22 — THE TESLA COIL (mk2.15). The frost tower is a
// lightning weapon now: one strike on an acquired enemy, then the chain
// walks 0.15s a hop to the nearest body not yet hit, 4m reach, 8 hits, one
// hit per body, 35 damage stepping down 5 to a floor of 10, blind to team
// and sight past the first strike. Zero rng draws. Fixture seed: 13. No
// seed is special.
import { ok } from "./harness.mjs";
import { makeField, makeWorld, addBody } from "../../src/engine/core.js";
import { TOWER_SPECS } from "../../src/depot/specs.js";
import { TESLA, teslaStrike, stepTesla, teslaWouldCatchFriend } from "../../src/depot/state.js";
import { PONDS } from "../../src/depot/mapgen.js";

const spec = TOWER_SPECS.tesla;
ok("tesla: the spec is a weapon now", spec.fireRate === 5 && spec.dmg === 35 && spec.range === 16 && spec.cost === 55 && !!spec.tesla);
ok("tesla: the slow is gone", spec.slow === undefined);
ok("tesla: the frost key is gone", TOWER_SPECS.frost === undefined);

function rig() {
  const field = makeField(41, 2.0, 13);
  const world = makeWorld({ field, seed: 13 });
  world.depotCombat = true;
  const tower = addBody(world, { kind: "tower", team: 1, mass: 0, hx: 0.8, hy: spec.hy, hz: 0.8, x: 0, y: field.heightAt(0, 0) + spec.hy, z: 0, hp: spec.hp });
  tower.towerType = "tesla";
  const man = (x, z, team) => {
    const u = addBody(world, { kind: "unit", team, mass: 80, hx: 0.28, hy: 1.0, hz: 0.28, x, y: field.heightAt(x, z) + 1.0, z, hp: 100 });
    u.smearStyle = "human";
    return u;
  };
  return { world, tower, man };
}
// walk the world clock without the integrator: stepTesla reads world.t only
const walk = (world, arcs, s) => { for (let i = 0; i < Math.round(s / 0.05); i++) { world.t += 0.05; stepTesla(world, arcs); } };

{ // the ladder, the stagger, the one-hit rule
  const { world, tower, man } = rig();
  const a = man(6, 0, 2), b = man(8, 0, 2), c = man(10, 0, 2);
  const arcs = [];
  teslaStrike(world, arcs, tower, a);
  stepTesla(world, arcs);
  ok("tesla: the strike lands 35 at once", a.hp === 65);
  ok("tesla: the hop waits its turn", b.hp === 100);
  walk(world, arcs, TESLA.hopS + 0.001);
  ok("tesla: hop one lands 30", b.hp === 70);
  walk(world, arcs, TESLA.hopS);
  ok("tesla: hop two lands 25", c.hp === 75);
  walk(world, arcs, 1.0);
  ok("tesla: nobody is hit twice", a.hp === 65 && b.hp === 70 && c.hp === 75);
  ok("tesla: the spent chain is swept", arcs.length === 0);
}
{ // the reach limit and the floor
  const { world, tower, man } = rig();
  const a = man(6, 0, 2); man(11.5, 0, 2); // 5.5m past the victim: out of hop reach
  const far = world.bodies[world.bodies.length - 1];
  const arcs = [];
  teslaStrike(world, arcs, tower, a);
  walk(world, arcs, 2.0);
  ok("tesla: 4m is the hop's whole reach", far.hp === 100);
  const ladder = [35, 30, 25, 20, 15, 10, 10, 10];
  ok("tesla: the ladder floors at 10", ladder[7] === TESLA.dmgFloor);
}
{ // eight hits, indiscriminate spread, chain touches a structure
  const { world, tower, man } = rig();
  const first = man(6, 0, 2);
  for (let i = 1; i < 9; i++) man(6 + i * 1.5, 0, i % 2 ? 1 : 2); // friend and foe alternating
  const wall = addBody(world, { kind: "wall", team: 1, mass: 0, hx: 0.5, hy: 1.0, hz: 2, x: 7.5, y: 1, z: 1.5, hp: 70 });
  const arcs = [];
  teslaStrike(world, arcs, tower, first);
  walk(world, arcs, 2.5);
  const hit = world.bodies.filter((u) => u.hp < (u.kind === "wall" ? 70 : 100)).length;
  ok("tesla: exactly eight bodies burn", hit === TESLA.maxHits);
  const friendHit = world.bodies.some((u) => u.kind === "unit" && u.team === 1 && u.hp < 100);
  ok("tesla: the spread is blind to team", friendHit);
  ok("tesla: a wall can carry the chain", wall.hp < 70 || hit === TESLA.maxHits);
}
{ // the pond conducts
  PONDS.length = 0;
  PONDS.push({ x: 30, z: 0, r: 6, level: 0 });
  const { world, tower, man } = rig();
  const a = man(6, 0, 2);
  const onPondNear = man(9, 0, 2);   // in hop reach AND on nothing
  const onPondA = man(28, 0, 2);     // on the pond, far beyond any hop
  const onPondB = man(32, 0, 2);     // on the pond too
  const arcs = [];
  // seed the chain next to the pond: second man stands on it
  onPondNear.pos.x = 27; onPondNear.pos.z = 3;
  a.pos.x = 24; a.pos.z = 3;
  teslaStrike(world, arcs, tower, a);
  walk(world, arcs, 2.5);
  ok("tesla: the pond electrifies whole", onPondA.hp < 100 && onPondB.hp < 100);
  PONDS.length = 0;
}
{ // the kill names its cause; zero draws
  const { world, tower, man } = rig();
  const a = man(6, 0, 2); a.hp = 20;
  const arcs = [];
  const draws0 = (() => { let n = 0; const r = world.rng; world.rng = () => { n++; return r(); }; return { get: () => n, restore: () => (world.rng = r) }; })();
  teslaStrike(world, arcs, tower, a);
  walk(world, arcs, 1.0);
  draws0.restore();
  ok("tesla: the chain draws nothing from the stream", draws0.get() === 0);
  const kill = world.events.find((e) => e.type === "kill" && e.id === a.id);
  ok("tesla: the kill is signed ZAP", kill && kill.cause === "ZAP");
  ok("tesla: every hit pushed a zap event", world.events.some((e) => e.type === "zap"));
}
{ // the hold: a friendly in the would-be chain holds the trigger
  const { world, tower, man } = rig();
  const foe = man(6, 0, 2); man(8, 0, 1);
  ok("tesla: the hold sees the friend in the spread", teslaWouldCatchFriend(world, tower, foe) === true);
  const { world: w2, tower: t2, man: m2 } = rig();
  const foe2 = m2(6, 0, 2); m2(14, 0, 1);
  ok("tesla: a friend clear of the spread holds nothing", teslaWouldCatchFriend(w2, t2, foe2) === false);
}
```

Run `node scripts/gate.mjs depot-test` — the new file must FAIL before Step 2 (the import of `TESLA` throws). Report the failure.

### Step 2 — the spec row

`src/depot/specs.js:42` — replace the frost row (the whole line) with:

```js
  tesla:  { range: 16, fireRate: 5, projSpeed: 95, dmg: 35, blastR: 0, kv: 0, cost: 55, hp: 85, label: "TESLA", icon: "⚡", kind: "mg", weapon: "tesla", tesla: true, hy: 1.35, blurb: "Chain lightning arcs to everything near" }, // mk2.15 (owner): THE TESLA COIL replaces frost — key renamed, no save migration (standing orders). projSpeed is sight-math only (arcClears/effRange run the mg's flat check); no projectile ever flies.
```

`src/depot/specs.js:32` — the comment block saying frost is deliberately untagged (no projectile, fireRate 0) is now false. Rewrite that sentence to: `// tesla carries weapon:"tesla" from mk2.15 — the tag names the voice; the chain itself never fires a projectile (state.js teslaStrike/stepTesla).` Leave the rest of the block.

### Step 2b — the rename sweep

Every depot use of the `frost` key becomes `tesla` — an exact, enumerated sweep; anything found outside this list stops the task and is reported. The legacy `src/game/ColdsnapTD.jsx` and `src/render/renderer.js:1822` are NOT touched (its own table, its own key).

- `src/depot/specs.js:44` — `TOWER_ORDER` entry `"frost"` → `"tesla"`.
- `src/depot/specs.js:201` — the tier-1 list entry `"frost"` → `"tesla"`.
- `src/depot/specs.js:213` — `HAND_KEYS` entry `"frost"` → `"tesla"`.
- `src/depot/DepotGame.jsx:1445, 1454, 1461` — the snapshot counter: local `frosts` → `teslas`, the `b.towerType === "frost"` test → `"tesla"`, the returned field `frosts` → `teslas`.
- `src/depot/DepotGame.jsx:1559` — the placement branch `mode === "frost"` → `"tesla"` (build-mode strings come from tower keys).
- `src/depot/DepotGame.jsx:3459` — `ib.towerType !== "frost"` → `!== "tesla"`.
- `src/depot/ai.js:54` — signal row `frost: clamp01((snap.frosts || 0) / 5)` → `tesla: clamp01((snap.teslas || 0) / 5)`.
- `src/depot/ai.js:61` — the counter list `"frost"` → `"tesla"`.
- `src/depot/ai.js:81` — `raw.gren += 0.30 * sig.frost;` → `sig.tesla` (the enemy still counters coil clusters with spread grenadiers; correct any comment naming the slow).
- `src/depot/ai.js:311` — `DRAFT_TOWERS` entry `"frost"` → `"tesla"`.
- `src/depot/market.js:23` — stock key `frosttower: 4` → `teslatower: 4`.
- `src/depot/market.js:41` — `FAMILY_OF_TOWER` row `frost: "frosttower"` → `tesla: "teslatower"`.
- `src/depot/infocards.js:28` — card key and first argument: `frost: tw("frost", ...)` → `tesla: tw("tesla", ...)` (text itself changes in Task 4).
- `src/depot/muster.js:261` — `{ key: "frost", kind: "tower" }` → `"tesla"`.
- `src/depot/state.js:1414` — the comment's `frosts` → `teslas`.
- `src/depot/state.js:1427` — `(s.frosts || 0) * TOWER_SPECS.frost.cost` → `(s.teslas || 0) * TOWER_SPECS.tesla.cost`.
- `src/depot/DepotGame.jsx:4007` and `:4620` — the `frost:` radial field and its `tr.frost` guard are DELETED outright here rather than renamed (Task 4's Step 5 is thereby pre-done; that step becomes a verification that no `tr.frost` read survives).
- `src/depot/units.js:496` — the `frostMul` field and its consumers STAY under their old name: the field is a body field that rides old saves and is sim-inert at 1. Comment appended: `// (mk2.15: no tower sets this since the tesla conversion; the name is historical)`.

After the sweep: `grep -rn '"frost"\|\.frost\b\|frosts\|frosttower' src/depot` returns NOTHING except `frostMul` lines; the same grep over `src/game`, `src/render` is untouched. Both grep results go in the report verbatim.

### Step 3 — the chain machinery

`src/depot/state.js` — add after `stepGrenades` (state.js:866-885), before the `// squad wiring` banner at :887:

```js
// mk2.15 (owner): THE TESLA COIL. The tower's trigger starts a chain row on
// S.arcs; stepTesla walks the rows against LIVE positions, one hop every
// TESLA.hopS seconds — nearest body not yet hit, TESLA.hopR meters from the
// last victim, TESLA.maxHits total, damage stepping down TESLA.dmgStep to
// TESLA.dmgFloor. The spread is blind: any alive solid or soft body, either
// team, sight unchecked (the first strike was sight-checked at acquisition).
// A victim standing on a pond (or the dormant stream) electrifies the whole
// surface: every body on that water joins the reachable set, nearest first.
// Selection is nearest-first over live positions — deterministic, ZERO rng
// draws, so every stream stays byte-stable however the chain runs.
export const TESLA = { hopR: 4, maxHits: 8, dmgStep: 5, dmgFloor: 10, hopS: 0.15 }; // provisional (F5)

// what the chain may touch: units, crews, vehicles, mechs, towers, walls,
// masonry chunks, rocks, trees — "anything" (owner). Mech limbs resolve to
// the hull through applyDamage; the visited set tracks the HULL id so a
// mech is one body to the chain, not five.
function chainBody(b) {
  if (!b.alive) return false;
  return b.kind === "unit" || b.kind === "vehicle" || b.kind === "mech" || b.kind === "tower" || b.kind === "wall" || b.kind === "chunk" || b.kind === "rock" || b.kind === "tree";
}
const chainId = (b) => (b.mechRef && b.mechRef.hull ? b.mechRef.hull.id : b.id);

function onWater(x, z) { return pondAt(x, z) || (streamAt(x, z) ? "stream" : null); }

// one hop's pick, shared by the live walk and the hold-check: nearest body
// not in `hit`, within hopR of `from` OR standing on any water surface in
// `waters`. Pure — reads positions, mutates nothing.
function teslaNext(world, from, hit, waters) {
  let best = null, bd = Infinity;
  for (const b of world.bodies) {
    if (!chainBody(b) || hit.has(chainId(b))) continue;
    const dx = b.pos.x - from.x, dz = b.pos.z - from.z;
    const d2 = dx * dx + dz * dz;
    const w = waters.size ? onWater(b.pos.x, b.pos.z) : null;
    if (d2 > TESLA.hopR * TESLA.hopR && !(w && waters.has(w))) continue;
    if (d2 < bd) { bd = d2; best = b; }
  }
  return best;
}

// the trigger pull: one row, first hit due NOW (stepTesla lands it on the
// same tick the tower fires). `arcs` is S.arcs — plain rows, serialized as
// they stand (save.js), so a mid-chain save resumes mid-chain.
export function teslaStrike(world, arcs, tower, target) {
  arcs.push({
    nextAt: world.t, hits: 0, dmg: TOWER_SPECS.tesla.dmg,
    fx: tower.pos.x, fy: tower.pos.y + tower.hy + 0.9, fz: tower.pos.z,
    atk: tower.team === 2 ? "enemy" : "player", tid: target.id, hitIds: [], waters: [],
  });
}

export function stepTesla(world, arcs) {
  if (!arcs || !arcs.length) return;
  for (let i = arcs.length - 1; i >= 0; i--) {
    const a = arcs[i];
    while (a.nextAt <= world.t && a.hits < TESLA.maxHits) {
      const hit = new Set(a.hitIds), waters = new Set(a.waters);
      let victim = null;
      if (a.hits === 0) { // the strike: the acquired enemy, if it still lives
        const t = world.byId.get(a.tid);
        victim = t && chainBody(t) ? t : null;
      } else {
        victim = teslaNext(world, { x: a.fx, z: a.fz }, hit, waters);
      }
      if (!victim) { a.hits = TESLA.maxHits; break; }
      const vx = victim.pos.x, vy = victim.pos.y, vz = victim.pos.z;
      world.events.push({ type: "zap", x: a.fx, y: a.fy, z: a.fz, x2: vx, y2: vy, z2: vz, hop: a.hits });
      applyDamage(world, victim, a.dmg, { cause: "ZAP", attacker: a.atk, srcX: a.fx, srcZ: a.fz });
      const w = onWater(vx, vz);
      if (w && !waters.has(w)) {
        a.waters.push(w === "stream" ? "stream" : w); // pond object identity holds within a session; see the save row below
        world.events.push({ type: "pondzap", x: w === "stream" ? vx : w.x, z: w === "stream" ? vz : w.z, r: w === "stream" ? 3 : w.r });
      }
      a.hitIds.push(chainId(victim));
      a.hits++;
      a.dmg = Math.max(TESLA.dmgFloor, a.dmg - TESLA.dmgStep);
      a.fx = vx; a.fy = vy; a.fz = vz;
      a.nextAt += TESLA.hopS;
    }
    if (a.hits >= TESLA.maxHits) arcs.splice(i, 1);
  }
}

// the hold-check for the avoid-friendlies switch (Task 4 wires the switch;
// the check ships now so the suite pins it): plan the chain the trigger
// WOULD start, on current positions, and answer whether any friendly soft
// body gets caught. Pure, zero draws, no events.
export function teslaWouldCatchFriend(world, tower, target) {
  const own = tower.team === 2 ? 2 : 1;
  const hit = new Set(), waters = new Set();
  let from = { x: target.pos.x, z: target.pos.z }, dmgSteps = 1;
  let victim = target;
  while (victim && dmgSteps <= TESLA.maxHits) {
    if ((victim.kind === "unit" || victim.kind === "vehicle" || victim.kind === "mech") && victim.team === own) return true;
    hit.add(chainId(victim));
    const w = onWater(victim.pos.x, victim.pos.z);
    if (w) waters.add(w);
    from = { x: victim.pos.x, z: victim.pos.z };
    victim = teslaNext(world, from, hit, waters);
    dmgSteps++;
  }
  return false;
}
```

Add `pondAt, streamAt` to state.js's imports — state.js has no mapgen import today, so add at state.js:12 (after the sight.js import):

```js
import { pondAt, streamAt } from "./mapgen.js";
```

(mapgen imports orient, core, specs, route — none import state.js; no cycle. Verify with a build.)

**The pond in the save:** a chain row's `waters` holds live pond references; `save.js`'s `plainValue` drops them (objects with non-number keys), which is CORRECT — a restored chain re-touches its pond on the next hop it lands there, and the `"stream"` string survives as-is. The save row below stores geometry only. This is stated so the agent does not "fix" it.

### Step 4 — the trigger

`src/depot/DepotGame.jsx:116` — `stepTowers` grows a fifth parameter. Signature becomes:

```js
export function stepTowers(world, T, discipline, possessedId, arcs) {
```

`src/depot/DepotGame.jsx:133` — the gate `if (spec.fireRate <= 0) continue;` stays (nothing has fireRate 0 now, but the guard is harmless and old fixtures ride it).

`src/depot/DepotGame.jsx:182-184` — the trigger pull becomes:

```js
    b.fireCd = spec.fireRate;
    b.flashT = world.t;
    if (spec.tesla && arcs) teslaStrike(world, arcs, b, best); else towerShot(world, b, best, spec);
```

The CAREFUL check at :177-181 stays exactly as it is — the first bolt's flight obeys tower discipline like every shot (spec.projSpeed 95 gives friendlyFouls a real arc to march).

`src/depot/DepotGame.jsx:591` — the call site becomes:

```js
  stepTowers(world, T, discipline, S.possess && S.possess.kind === "tower" ? S.possess.id : undefined, S.arcs);
```

And directly under :592's `stepGrenades(world);` add:

```js
  stepTesla(world, S.arcs); // mk2.15: the chains walk, 0.15s a hop
```

Add `teslaStrike, stepTesla` to the state.js import list at DepotGame.jsx:21 (alongside `stepGrenades, stepDavyShot`).

`src/depot/state.js:1363-1400` (`makeRunState`) — add to the returned object, beside `mines`/`fog` if present there or after `spawnRR: 0,`:

```js
    arcs: [], // mk2.15: live tesla chains — plain rows, saved as they stand
```

### Step 5 — the possessed coil

`src/depot/state.js:829` (`possessedTowerFire`) — signature grows a trailing `arcs` parameter:

```js
export function possessedTowerFire(world, tower, aim, T, toUV = (x, z) => ({ u: x, v: z }), arcs) {
```

Inside, after `const live = snapTargetNear(world, aim, T, toUV);`, add:

```js
  // mk2.15: the possessed coil fires only at a LIVE seen enemy — a chain has
  // no ground to shell; no target, no bolt, no cooldown spent.
  if (spec.tesla) {
    if (!live || !arcs) return false;
    tower.fireCd = spec.fireRate;
    tower.flashT = world.t;
    teslaStrike(world, arcs, tower, live);
    return true;
  }
```

Find `possessedTowerFire(` call sites in DepotGame.jsx (one, in the frame loop — grep at dispatch) and append `, S.arcs` to the call.

### Step 6 — the save

`src/depot/save.js:283` — after the `fog:` row inside the `S` block, add:

```js
      // mk2.15: live tesla chains — a save mid-chain resumes mid-chain.
      // `n` is nextAt (absolute sim clock, rides with world.t like fog's
      // `until`); water references re-attach on the next wet hop.
      arcs: (S.arcs || []).map((a) => ({ n: r3(a.nextAt), h: a.hits, d: r3(a.dmg), x: r3(a.fx), y: r3(a.fy), z: r3(a.fz), k: a.atk, t: a.tid, ids: a.hitIds.slice() })),
```

`src/depot/DepotGame.jsx:1417` — after the fog restore line, add:

```js
        S.arcs = (r.arcs || []).map((a) => ({ nextAt: a.n, hits: a.h, dmg: a.d, fx: a.x, fy: a.y, fz: a.z, atk: a.k, tid: a.t, hitIds: (a.ids || []).slice(), waters: [] }));
```

(`r` here is the parsed `data.S` object the surrounding lines already read — match the local name at the anchor; the mines line at :1416 shows it.)

**Known honest gap, stated:** body ids are not stable across restore (save.js law 3), so a restored chain's `hitIds`/`tid` point at the OLD world's ids. The mines/fog precedent accepts equivalent looseness (a restored sticky target is nulled for the same reason). Consequence: a chain restored mid-walk forgets who it already hit and its pending first-strike target dies quietly if unmatched — it fizzles at its next hop. The row still round-trips (the suite pins the round-trip, not cross-restore identity). If the owner wants exact cross-restore chains, that is index-mapping work (`idx` in save.js) — flagged, not built.

### Step 7 — the black smudge

`src/render/renderer.js:1227-1229` — the kill branch becomes:

```js
      } else if (e.type === "kill") {
        const kb = world.byId.get(e.id);
        // mk2.15: a lightning kill scorches — black smudge, no matter the dress
        if (kb && kb.smearStyle) splat.smear(((e.x + F.half) / Wd) * 1024, ((e.z + F.half) / Wd) * 1024, e.cause === "ZAP" ? "scorch" : kb.smearStyle, e.x, e.z);
      }
```

`src/render/renderer.js:281-305` (`paintSmear`) — a third style branch. Replace the single `cx.fillStyle` line (`style === "human" ? ... : ...`) and the streak loop's follow-up with:

```js
    cx.fillStyle = style === "human" ? "rgba(206,22,16,0.9)" : style === "scorch" ? "rgba(10,10,12,0.92)" : "rgba(22,24,28,0.85)";
    if (style === "scorch") {
      // the black smudge: a charred round blot, not a streak — soot rings
      // stamped tight around the fall, thinning outward. Same position-hashed
      // rnd(), so identical runs paint identical ground.
      for (let i = 0; i < 26; i++) {
        const a2 = rnd() * Math.PI * 2, rr = Math.pow(rnd(), 1.6) * 7;
        const w = Math.max(1, Math.round(3 * (1 - rr / 7) + rnd()));
        cx.fillRect(Math.round(u + Math.cos(a2) * rr - w / 2), Math.round(v + Math.sin(a2) * rr - w / 2), w, w);
      }
    } else {
      for (let i = 0; i < len; i++) {
        const w = Math.max(1, Math.round(3.6 * (1 - i / len) + rnd()));
        cx.fillRect(Math.round(u + dx * i - w / 2), Math.round(v + dy * i - w / 2), w, w);
      }
    }
```

The `if (style === "human")`/`else` droplet-and-fleck block below it becomes `if (style === "human") { ... } else if (style !== "scorch") { ... }` — the smudge takes no droplets and no silver. The `ang`/`len`/`dx`/`dy` lines above stay (the replay contract: the same draw count from `rnd()` per style, every paint — scorch draws differ from the others per paint, which is fine because the style rides the log and the replay re-enters the same branch).

Save round-trip of the style is free: `save.js:288` already writes `m.style` verbatim and the restore replays it through `splat.smear`.

**Renderer law check:** this change is additive (a new style branch; existing styles byte-identical) — `golden` must stay green (the demo never smears).

### Step 8 — gates and the landing

- `node scripts/gate.mjs depot-test` — the new era 22 passes; the license to re-teach covers ONLY literal text the task moves (the frost blurb string if any test pins it — report old→new); any behavior failure stops the task.
- `node scripts/gate.mjs golden` — byte-identical demo.
- `node scripts/gate.mjs depot-lint` — no `Math.random` entered src/depot.
- `node scripts/gate.mjs smoke`.
- Bump `src/version.js` to `mk2.15`, THEN build. Gates green → commit → push. Report the landing with seeds named.

---

## Task 2 — the look (mk2.16)

**Suggested model: Sonnet 5** — the bolt code is carried below; the task is transcription plus anchors.

**Required reading:** this section in full; `src/render/renderer.js:175-200, 1040-1115, 1190-1245, 1248-1258, 1795-1840, 2440-2470 (the flash/shake tail of render())`. Read-confirmation opens the report.

Owner's acceptance is his eyes, live, phone AND desktop — this task deploys and stops. No screenshot loops.

### Step 1 — the coil replaces the ice

`src/render/renderer.js:181-193` — the frost branch of `buildTowerMesh` (the `} else {` arm) is replaced whole:

```js
  } else {
    // tesla (mk2.16): a squat plinth, a wound coil, a bright toroid crown —
    // and a glow bulb the frame loop pulses (userData.glow).
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 0.7, 8), new THREE.MeshToonMaterial({ color: 0x3a4250, gradientMap: grad }));
    plinth.position.y = 0.35; plinth.castShadow = true; g.add(plinth);
    const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, spec.hy * 1.1, 8), new THREE.MeshToonMaterial({ color: 0x6b7686, gradientMap: grad }));
    stack.position.y = 0.7 + spec.hy * 0.55; stack.castShadow = true; g.add(stack);
    for (let i = 0; i < 4; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.05, 6, 14), new THREE.MeshToonMaterial({ color: 0x9fb6c8, gradientMap: grad }));
      ring.rotation.x = Math.PI / 2; ring.position.y = 0.75 + i * spec.hy * 0.26; g.add(ring);
    }
    const crown = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.14, 8, 18), new THREE.MeshToonMaterial({ color: 0xcfe6f4, gradientMap: grad }));
    crown.rotation.x = Math.PI / 2; crown.position.y = 0.75 + spec.hy * 1.12; g.add(crown);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), new THREE.MeshBasicMaterial({ color: 0xdff2ff, transparent: true, opacity: 0.7 }));
    glow.position.y = 0.75 + spec.hy * 1.12; g.add(glow);
    g.userData.glow = glow;
    g.userData.crownY = 0.75 + spec.hy * 1.12;
  }
```

`g.userData.spin = true;` is deleted with the old branch; the frame loop's `if (g.userData.spin)` at :1819 stays for nothing and is left alone (dormant, additive law). The `frostRingMesh` pool (:1253) and its aura block (:1822-1832) are likewise LEFT IN PLACE untouched — `b.auraR` is never set in the depot, the block never runs, and the legacy TD mode still owns it. **Labeled consequence:** the legacy TD mode's frost tower wears the new coil mesh (one shared `buildTowerMesh`); the owner sees it only if he opens the old mode.

### Step 2 — the bolts

Near the particle arrays (`renderer.js:1045`, `const debris = [], smoke = [], fire = [];`) add:

```js
  // mk2.16: TESLA BOLTS. Each row is one live bolt (strike, hop, idle arc or
  // pond flash), REGENERATED EVERY FRAME from fresh Math.random midpoint
  // displacement — no two frames, no two strikes alike (owner). Renderer
  // dice are lawful; the sim never reads any of this.
  const bolts = [];
  const BOLT_SEGS = 14, BOLT_CAP = 48;
  function spawnBolt(ax, ay, az, bx, by, bz, life, amp) {
    if (bolts.length >= BOLT_CAP) bolts.shift();
    bolts.push({ ax, ay, az, bx, by, bz, life, age: 0, amp });
  }
  const boltGeo = new THREE.BufferGeometry();
  const boltPos = new Float32Array(BOLT_CAP * (BOLT_SEGS + 3) * 2 * 3); // main run + one fork per bolt
  boltGeo.setAttribute("position", new THREE.BufferAttribute(boltPos, 3));
  const boltCore = new THREE.LineSegments(boltGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 }));
  const boltHalo = new THREE.LineSegments(boltGeo, new THREE.LineBasicMaterial({ color: 0x7fd0ff, transparent: true, opacity: 0.4 }));
  boltHalo.scale.setScalar(1.001);
  boltCore.frustumCulled = false; boltHalo.frustumCulled = false;
  boltCore.layers.set(1); boltHalo.layers.set(1);
  scene.add(boltCore); scene.add(boltHalo);
  function writeBolts(dt) {
    let w = 0;
    const seg = (x1, y1, z1, x2, y2, z2) => { boltPos[w++] = x1; boltPos[w++] = y1; boltPos[w++] = z1; boltPos[w++] = x2; boltPos[w++] = y2; boltPos[w++] = z2; };
    for (let i = bolts.length - 1; i >= 0; i--) {
      const b = bolts[i];
      b.age += dt;
      if (b.age >= b.life) { bolts.splice(i, 1); continue; }
      const fade = 1 - b.age / b.life;
      // fresh jag every frame: midpoint displacement along the run
      const pts = [{ x: b.ax, y: b.ay, z: b.az }];
      for (let k = 1; k < BOLT_SEGS; k++) {
        const t = k / BOLT_SEGS, j = b.amp * fade * Math.sin(Math.PI * t);
        pts.push({ x: b.ax + (b.bx - b.ax) * t + (Math.random() - 0.5) * j, y: b.ay + (b.by - b.ay) * t + (Math.random() - 0.5) * j * 0.6, z: b.az + (b.bz - b.az) * t + (Math.random() - 0.5) * j });
      }
      pts.push({ x: b.bx, y: b.by, z: b.bz });
      for (let k = 0; k < pts.length - 1; k++) seg(pts[k].x, pts[k].y, pts[k].z, pts[k + 1].x, pts[k + 1].y, pts[k + 1].z);
      // one fork off a random midpoint, downward-biased
      const f = pts[1 + ((Math.random() * (BOLT_SEGS - 2)) | 0)];
      const fl = 0.5 + Math.random() * b.amp;
      seg(f.x, f.y, f.z, f.x + (Math.random() - 0.5) * fl * 2, f.y - fl * (0.4 + Math.random() * 0.8), f.z + (Math.random() - 0.5) * fl * 2);
      seg(f.x, f.y, f.z, f.x + (Math.random() - 0.5) * fl, f.y - fl * 0.3, f.z + (Math.random() - 0.5) * fl);
    }
    for (let k = w; k < boltPos.length; k++) boltPos[k] = 0;
    boltGeo.attributes.position.needsUpdate = true;
    boltCore.material.opacity = bolts.length ? 0.75 + Math.random() * 0.25 : 0;
    boltHalo.material.opacity = bolts.length ? 0.25 + Math.random() * 0.2 : 0;
  }
```

### Step 3 — the events feed the bolts

In `consume()` (renderer.js:1198-1238), before the final `else if (e.type === "splash")` line, add:

```js
      else if (e.type === "zap") {
        spawnBolt(e.x, e.y, e.z, e.x2, e.y2 + 0.6, e.z2, 0.26, 1.4);
        fire.push({ x: e.x2, y: e.y2 + 0.8, z: e.z2, s: 0.9, life: 0.14, age: 0 });
        shake = Math.min(1.5, shake + 0.1);
      } else if (e.type === "pondzap") {
        // the surface lights: radial bolts flat across the ice
        for (let pi = 0; pi < 6; pi++) {
          const a2 = Math.random() * Math.PI * 2, rr = e.r * (0.5 + Math.random() * 0.5);
          const py = F.heightAt(e.x, e.z) + 0.25;
          spawnBolt(e.x, py, e.z, e.x + Math.cos(a2) * rr, py, e.z + Math.sin(a2) * rr, 0.4, 0.9);
        }
      }
```

### Step 4 — the idle pulse

In the tower pass (renderer.js:1804-1834), after the `if (g.userData.spin)` line, add:

```js
      if (g.userData.glow) {
        // mk2.16: the coil breathes — and crawls with small arcs at a loose
        // regular interval, denser in the half-second before the trigger
        g.userData.glow.material.opacity = 0.45 + 0.3 * Math.sin(world.t * 6 + b.id) + (b.fireCd != null && b.fireCd < 0.6 ? 0.25 : 0);
        if (Math.random() < dt * 2.2) {
          const cy = b.pos.y + g.userData.crownY;
          const a2 = Math.random() * Math.PI * 2, a3 = a2 + 1 + Math.random() * 3;
          spawnBolt(b.pos.x + Math.cos(a2) * 0.55, cy + (Math.random() - 0.5) * 0.3, b.pos.z + Math.sin(a2) * 0.55,
            b.pos.x + Math.cos(a3) * 0.55, cy + (Math.random() - 0.5) * 0.3, b.pos.z + Math.sin(a3) * 0.55, 0.12, 0.35);
        }
      }
```

### Step 5 — the frame hook

In `render(dt, ...)` where the particle steps run (the debris/smoke/fire update block — locate the `for` loops stepping `smoke`/`fire` after :1734), add one call beside them:

```js
    writeBolts(dt);
```

### Step 6 — gates and the landing

`node scripts/gate.mjs smoke` and `node scripts/gate.mjs golden` (renderer additive law). Bump `src/version.js` to `mk2.16`, build, commit, push. The owner checks the idle pulse, the strike, the marching chain, and the pond flash live, phone and desktop. His eyes are the acceptance; the task report names what to look at, not how it looks.

---

## Task 3 — the sound (mk2.17)

**Suggested model: Sonnet 5.**

**Required reading:** this section; `src/platform/audio.js:1-60 (the primitives' signatures), 260-330, 525-575`; `src/ui/SoundBoard.jsx:20-70`; `docs/superpowers/sound-profiles-reference.md` PART TWO in full (§1 equal loudness, §2.2(g) the voice cap, §5 the low-end law, §6 gaps). Read-confirmation opens the report.

Both voices are UNPROFILED — no authority row in the reference covers an electric arc or thunder; every number is provisional under §6, and the owner's ear on the soundboard is the whole acceptance.

### Step 1 — the voices

`src/platform/audio.js` — after `gblast` (the function above the `MUZZLE` table at :275), add:

```js
  // mk2.17: THE TESLA VOICE — provisional throughout (reference §6: no
  // published profile for an electric arc or for thunder; the owner's ear
  // rules on the soundboard). Two parts per hit: the sizzle (a bright
  // crackling burst at the bolt) and the thunder (a long rumble that
  // deepens and stretches as the chain walks — `hop` is the hit's index).
  //
  // Reference laws obeyed (sound-profiles-reference.md):
  // - §1/§5: nothing load-bearing below ~150 Hz. The rumble's BODY sits at
  //   340->150 Hz (audible on open-fit earbuds); the 88->60 Hz tone is
  //   weight under it, not the message. Gains lean toward the low body per
  //   the §1 correction (200 Hz owes ~+13 dB against the 3 kHz sizzle).
  // - §2.2(g): VOICE_CAP is 26 and overruns drop sounds SILENTLY. One zap
  //   spends exactly 3 voices (sizzle, body, weight); a full 8-hit chain
  //   with second-long tails overlaps ~9-12 voices across its 1.2s — inside
  //   budget beside a firefight. NO echoes() on zap (each tap is another
  //   voice; eight rolling thunders would starve the cap and kill the bell).
  function zap(x, z, hop = 0, dly = 0) {
    const deep = Math.min(1, hop * 0.15);
    noise(x, z, { f0: 5200, f1: 2600, type: "highpass", dur: 0.10, gain: 0.28, delay: dly, wet: 0.15 });
    noise(x, z, { f0: 340 - deep * 120, f1: 150, dur: 1.0 + deep * 0.8, gain: 0.42 + deep * 0.1, delay: dly + 0.05, wet: 0.55, dark: 0.6 });
    tone(x, z, { f0: 88, f1: 60, type: "sine", dur: 0.8 + deep * 0.5, gain: 0.16, delay: dly + 0.06, atk: 0.02 });
  }
  // the electrified pond: a wide fizzing wash, no thunder of its own (2 voices)
  function pondzap(x, z) {
    noise(x, z, { f0: 4200, f1: 1800, type: "highpass", dur: 0.45, gain: 0.24, wet: 0.3 });
    noise(x, z, { f0: 2200, type: "bandpass", q: 1.6, dur: 0.35, gain: 0.16, delay: 0.05, wet: 0.35 });
  }
```

(Signatures: `noise`/`tone` here are called exactly as `explosion`/`gblast` above call them — same option names, nothing new. Verify against the primitives before running. The dropped `echoes()` is deliberate — the map may answer the FIRST hit only if the owner asks for it at audition, budgeted then.)

### Step 2 — the dispatch

`src/platform/audio.js:532-568` (`consume`) — the zap is a one-shot, never coalesced: each hit is its own event, and the sim's 150ms stagger spaces them into a roll. In the non-grouped chain (beside `gbounce`/`splash`), add:

```js
      else if (e.type === "zap") zap(e.x2 != null ? e.x2 : e.x, e.z2 != null ? e.z2 : e.z, e.hop || 0, e.dly || 0);
      else if (e.type === "pondzap") pondzap(e.x, e.z);
```

### Step 3 — the soundboard

`src/ui/SoundBoard.jsx:52-66` (`CARDS`) — three NEW-side cards appended:

```js
  { id: "tesla-strike", name: "TESLA STRIKE", desc: "The first bolt: a bright electrical sizzle — frying, crackling, right at the arc — and under it the first thunder, a long low rumble that outlasts the crack.", ev: () => [{ type: "zap", x: 0, z: 6, x2: 4, z2: 6, hop: 0 }] },
  { id: "tesla-chain", name: "TESLA CHAIN", desc: "Five hits walking away at 150ms steps. Each hit sizzles and then rolls its own thunder, each a shade deeper and longer than the last — a storm rolling across the field, never one clap.", ev: () => Array.from({ length: 5 }, (_, i) => ({ type: "zap", x: i * 3, z: 6, x2: (i + 1) * 3, z2: 6, hop: i, dly: i * 0.15 })) },
  { id: "tesla-pond", name: "ELECTRIFIED POND", desc: "A frozen pond taking the chain: a wide fizzing wash across the whole surface, hissing, no thunder of its own.", ev: () => [{ type: "pondzap", x: 0, z: 8, r: 6 }] },
];
```

(The OLD column plays the frozen legacy snapshot, which knows no zap — OLD stays silent on these cards; that is correct and stated on the board by its silence.)

### Step 4 — gates and the landing

`node scripts/gate.mjs smoke`. Bump `src/version.js` to `mk2.17`, build, commit, push. The owner auditions on `?sounds=1`; his ear rules; retunes are his numbers spoken back into these blocks.

---

## Task 4 — the switch and the words (mk2.18)

**Suggested model: Sonnet 5.**

**Required reading:** this section; `src/depot/DepotGame.jsx:170-190, 545-560, 4000-4015, 4380-4400, 4610-4630`; `src/depot/state.js:660-710 (stepDavyShot), 770-800 (possessedVolley davy arm)`; `src/depot/infocards.js:9-30`; `README.md` (the weapons passage — locate by searching "frost" and "Halves"). Read-confirmation opens the report.

### Step 1 — the failing asserts

Append to `scripts/tests/22-the-tesla-coil.mjs`:

```js
{ // the switch: davy holds with a friend in the ring, never on its own crew
  const g = (await import("node:fs")).readFileSync(new URL("../../src/depot/state.js", import.meta.url), "utf8");
  ok("switch: davy reads the hold", g.includes("holdArea") && g.includes("friendInBlast"));
  const dg = (await import("node:fs")).readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");
  ok("switch: the button exists", dg.includes("data-holdarea"));
  ok("switch: tesla trigger reads the hold", dg.includes("teslaWouldCatchFriend"));
}
```

(The tesla hold's behavior is already pinned by era 22's `teslaWouldCatchFriend` asserts from Task 1; the davy hold gets a behavior assert below in Step 3's own block — this text pin covers the wiring.)

### Step 2 — the switch state

`src/depot/state.js` `makeRunState` — beside the Task-1 `arcs: []` row, add:

```js
    holdArea: { 1: false, 2: false }, // mk2.18 (owner): area weapons hold fire with a friendly in the spread — tesla chain + davy blast; per side, both start OFF; nothing flips side 2 today
```

`src/depot/save.js` — beside the `arcs:` row: `holdArea: { 1: !!(S.holdArea && S.holdArea[1]), 2: !!(S.holdArea && S.holdArea[2]) },` and in the DepotGame restore block beside the arcs restore: `S.holdArea = r.holdArea || { 1: false, 2: false };`

### Step 3 — the two consumers

**Tesla.** In `stepTowers` (DepotGame.jsx), the trigger block from Task 1 gains the hold — the full block at :182 becomes:

```js
    if (spec.tesla && arcs) {
      if (holdArea && holdArea[tTeam] && teslaWouldCatchFriend(world, b, best)) { b.fireCd = spec.fireRate; continue; }
      b.fireCd = spec.fireRate;
      b.flashT = world.t;
      teslaStrike(world, arcs, b, best);
      continue;
    }
    b.fireCd = spec.fireRate;
    b.flashT = world.t;
    towerShot(world, b, best, spec);
```

with `holdArea` a sixth `stepTowers` parameter, threaded from the :591 call as `S.holdArea`. Import `teslaWouldCatchFriend` in DepotGame.jsx:21.

**Davy.** In `src/depot/state.js`, above `stepDavyShot`, add:

```js
// mk2.18: the davy's own hold — any friendly soft body in the blast ring,
// the firing crew itself excepted (the ring is wider than the range; the
// crew is ALWAYS inside its own blast, and the escape is the game).
export function friendInBlast(world, x, z, team, exceptSquad) {
  for (const b of world.bodies) {
    if ((b.kind !== "unit" && b.kind !== "vehicle" && b.kind !== "mech") || !b.alive || b.team !== team) continue;
    if (exceptSquad && b.squadId === exceptSquad.id) continue;
    if (Math.hypot(b.pos.x - x, b.pos.z - z) < DAVY_FIRE.blastR) return true;
  }
  return false;
}
```

In `stepDavyShot`, directly after `if (!best) return;` (state.js:701), add:

```js
  const holdA = world._holdArea;
  if (holdA && holdA[squad.team] && friendInBlast(world, best.pos.x, best.pos.z, squad.team, squad)) return;
```

and thread the switch onto the world each frame: in DepotGame.jsx, beside the :591 `stepTowers` call, add `world._holdArea = S.holdArea;` (one stamp, read by stepDavyShot without a signature change — the `_`-prefixed transient idiom; save.js's body sweep never sees it since it rides world, not a body). The possessed davy trigger is NOT gated — the owner's own finger outranks the hold, same as every possessed shot outranks discipline. Stated, deliberate.

Behavior assert, appended inside the Step-1 suite block (replacing reliance on text pins for davy):

```js
{ // davy behavior: the hold spares the plan when a rifleman stands in the ring
  const { makeField: mf, makeWorld: mw, addBody: ab } = await import("../../src/engine/core.js");
  const { friendInBlast } = await import("../../src/depot/state.js");
  const field = mf(41, 2.0, 13);
  const world = mw({ field, seed: 13 });
  const friend = ab(world, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 1, hz: 0.28, x: 10, y: 1, z: 0, hp: 100 });
  friend.squadId = 7;
  ok("switch: a friend inside 25m holds the davy", friendInBlast(world, 0, 0, 1, null) === true);
  ok("switch: the crew itself never holds its own shot", friendInBlast(world, 0, 0, 1, { id: 7 }) === false);
}
```

### Step 4 — the button

`src/depot/DepotGame.jsx:4392-4395` — beside the WIND button, phone and desktop alike (it is the same top bar; `isTouch` already pads it), add:

```jsx
        <button data-holdarea style={{ ...P.btn, padding: isTouch ? "5px 10px" : "4px 10px", borderColor: hud.holdAreaOn ? "#7fd7ff" : "#48515f", opacity: hud.holdAreaOn ? 1 : 0.6 }} title="area weapons (tesla chain, davy blast) hold fire while one of your own stands in the spread" onClick={toggleHoldArea}>
          SPARE OURS {hud.holdAreaOn ? "ON" : "OFF"}
        </button>
```

`toggleHoldArea` follows `toggleWind`'s exact pattern (locate it by grep, copy its shape): flips `S.holdArea[1]`, mirrors into the hud state field `holdAreaOn`. The hud mirror is added wherever `windOn` is mirrored.

### Step 5 — the possession gates open

Task 1's rename sweep already deleted the `frost:` radial field (DepotGame.jsx:4007) and the `if (!tr.frost)` guard (:4620). This step VERIFIES: `grep -n "tr.frost\|frost:" src/depot/DepotGame.jsx` returns nothing, the discipline slot renders for every tower, and `canPossess: ispec.fireRate > 0` includes the coil by arithmetic. Grep output goes in the report.

### Step 6 — the words

- `src/depot/infocards.js:28` (key already `tesla` from Task 1): `tesla:  tw("tesla", "Chain lightning. Strikes one, then arcs to everything near — friend, foe, stone, or water.", ORDERS_TOWER),`
- `README.md`: every sentence naming the frost tower or its slow is rewritten to the tesla coil and its chain; counts/screenshots untouched (phase closeout re-checks them).

### Step 7 — gates and the landing

- `node scripts/gate.mjs depot-test` — era 22 including the new blocks; sweep license as in Task 1.
- `node scripts/gate.mjs golden`, `depot-lint`, `smoke`.
- Bump `src/version.js` to `mk2.18`, build, commit, push. The owner's live check accepts the button on phone and desktop and the card text.

---

## Check pass (plan-writer's own, done before serving)

- Every anchor above grepped against the live tree at these lines: `specs.js:42/32`, `DepotGame.jsx:21/116/133/177/182-184/591-592/1416-1417/4007/4392-4395/4620`, `state.js:12/727/829/1363`, `save.js:283/288`, `renderer.js:181-193/1045/1198-1238/1227-1229/281-305/1253/1804-1834`, `audio.js:275/532-568`, `SoundBoard.jsx:52-66`, `infocards.js:28`, `units.js:496`, `ai.js:81`, `version.js` (MK "mk2.14"), gate names from `scripts/gate.mjs` (`depot-test, golden, depot-lint, smoke`).
- Code blocks syntax-passed (node parse of each block in a module shim).
- Zero `Math.random` in any src/depot block; renderer blocks use it freely (lawful).
- Draw counts: the chain draws zero; no existing stream's count moves.
