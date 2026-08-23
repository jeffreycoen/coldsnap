# The Tesla Coil — Amendment 3 (the owner's bolt: always fires, way bigger, fractal, one full second)

## Why FIRE showed nothing

Two mk2.15 rules compounded: possession suspends the tower's auto-fire (`stepTowers` skips a possessed tower), and the possessed coil refuses to fire unless the reticle snaps to a live, seen enemy. Reticle on open snow → FIRE does nothing, silently. The owner's kill counter read zero: no zap event was ever pushed that session, so the bolts' visibility was never even exercised.

## The orders (owner, 2026-08-22)

1. FIRE on a possessed coil always discharges: a crackling lightning bolt lasting one full second — at the snapped enemy when one is near the reticle, otherwise into the ground at the reticle point. The chain walks from wherever the bolt lands, if anything stands near.
2. The bolt gets way bigger: thicker, broader, growing like a fractal — recursive forks, not one jagged run.

Cooldown still rules the trigger (one bolt per 5 seconds); symmetry is untouched (both sides' towers run the same spec; possession is and was player-only by the possession law).

## Part A — sim: the ground strike (src/depot/state.js)

### Step A1

In `possessedTowerFire`, replace the mk2.15 tesla branch:

```js
  if (spec.tesla) {
    if (!live || !arcs) return false;
    tower.fireCd = spec.fireRate;
    tower.flashT = world.t;
    teslaStrike(world, arcs, tower, live);
    return true;
  }
```

with:

```js
  // Amendment 3 (owner): the possessed coil ALWAYS discharges — at the
  // snapped enemy when one is near the reticle, into the ground at the
  // reticle otherwise. The chain walks from wherever the bolt lands.
  if (spec.tesla) {
    if (!arcs) return false;
    tower.fireCd = spec.fireRate;
    tower.flashT = world.t;
    if (live) { teslaStrike(world, arcs, tower, live); return true; }
    const gy = world.field.heightAt(aim.x, aim.z);
    arcs.push({
      nextAt: world.t, hits: 0, dmg: TOWER_SPECS.tesla.dmg,
      fx: tower.pos.x, fy: tower.pos.y + tower.hy + 0.9, fz: tower.pos.z,
      atk: tower.team === 2 ? "enemy" : "player", tid: 0, gx: aim.x, gy, gz: aim.z, hitIds: [], waters: [],
    });
    return true;
  }
```

### Step A2

In `stepTesla`, replace the first-hit selection:

```js
      if (a.hits === 0) { // the strike: the acquired enemy, if it still lives
        const t = world.byId.get(a.tid);
        victim = t && chainBody(t) ? t : null;
      } else {
```

with:

```js
      if (a.hits === 0 && !a.tid && a.gx != null) {
        // Amendment 3: a GROUND strike — the bolt lands on snow, damages
        // nothing itself, and the chain (damage ladder intact) walks from
        // the strike point if anything stands in hop range. Water at the
        // strike point conducts exactly as a body hit would.
        world.events.push({ type: "zap", x: a.fx, y: a.fy, z: a.fz, x2: a.gx, y2: a.gy + 0.2, z2: a.gz, hop: 0 });
        const w0 = onWater(a.gx, a.gz);
        if (w0) {
          a.waters.push(w0 === "stream" ? "stream" : w0);
          world.events.push({ type: "pondzap", x: w0 === "stream" ? a.gx : w0.x, z: w0 === "stream" ? a.gz : w0.z, r: w0 === "stream" ? 3 : w0.r });
        }
        a.fx = a.gx; a.fy = a.gy + 0.2; a.fz = a.gz;
        a.hits = 1;
        a.nextAt += TESLA.hopS;
        continue;
      }
      if (a.hits === 0) { // the strike: the acquired enemy, if it still lives
        const t = world.byId.get(a.tid);
        victim = t && chainBody(t) ? t : null;
      } else {
```

**Placement note:** the `continue` continues the `while (a.nextAt <= world.t ...)` loop — the walk resumes on the next due hop, same as a body hit. The ground strike spends one of the 8 hits and does not step the damage ladder (the first body struck still takes 35 falling to 30 after it — the ladder decrement happens only on body hits, which this branch never reaches). Zero rng draws, as before.

### Step A3 — the save row

`save.js`'s `arcs:` writer and the DepotGame restore both gain the three ground fields: writer adds `gx: a.gx != null ? r3(a.gx) : undefined, gy: a.gy != null ? r3(a.gy) : undefined, gz: a.gz != null ? r3(a.gz) : undefined` to the mapped row (JSON drops undefined); restore adds `gx: a.gx, gy: a.gy, gz: a.gz` to the rebuilt row.

### Step A4 — the pins

Append to `scripts/tests/22-the-tesla-coil.mjs`:

```js
{ // Amendment 3: the ground strike — always a bolt, chain from the snow
  const field = makeField(41, 2.0, 13);
  const world = makeWorld({ field, seed: 13 });
  world.depotCombat = true;
  const near = addBody(world, { kind: "unit", team: 2, mass: 80, hx: 0.28, hy: 1.0, hz: 0.28, x: 3, y: field.heightAt(3, 0) + 1, z: 0, hp: 100 });
  near.smearStyle = "human";
  const arcs = [{ nextAt: 0, hits: 0, dmg: 35, fx: 0, fy: 3, fz: 0, atk: "player", tid: 0, gx: 1, gy: field.heightAt(1, 0), gz: 0, hitIds: [], waters: [] }];
  world.t = 0.01; stepTesla(world, arcs);
  ok("ground strike: the bolt lands with no victim", world.events.some((e) => e.type === "zap" && e.hop === 0));
  ok("ground strike: the snow takes no damage call", near.hp === 100);
  for (let i = 0; i < 10; i++) { world.t += 0.05; stepTesla(world, arcs); }
  ok("ground strike: the chain walks from the snow at full 35", near.hp === 65);
}
```

## Part B — renderer: the fractal bolt (src/render/renderer.js)

### Step B1 — lifetimes

In `consume()`, the zap branch's spawn becomes hop-aware — replace:

```js
        spawnBolt(e.x, e.y, e.z, e.x2, e.y2 + 0.6, e.z2, 0.26, 1.4);
```

with:

```js
        // Amendment 3 (owner): the strike bolt lives ONE FULL SECOND and
        // crackles (re-jagged every frame); hops ride shorter so the march
        // still reads. Amplitude scales with span — long bolts fork wide.
        const span = Math.hypot(e.x2 - e.x, e.z2 - e.z);
        spawnBolt(e.x, e.y, e.z, e.x2, e.y2 + 0.6, e.z2, e.hop ? 0.6 : 1.0, Math.max(1.8, span * 0.3));
```

### Step B2 — the fractal writer

In `writeBolts`, replace the per-bolt geometry build — everything from `const th = 0.11 * sMin * ...` through the two fork `put(...)` calls at the end of the loop body — with:

```js
      const th = 0.34 * sMin * (0.55 + 0.45 * fade) * (0.8 + Math.random() * 0.4);
      // Amendment 3 (owner): FRACTAL GROWTH. Recursive midpoint splitting:
      // each level displaces the midpoint and may throw a fork that splits
      // again, thinner each generation. Fresh dice every frame — the bolt
      // crawls and crackles for its whole life.
      const grow = (x1, y1, z1, x2, y2, z2, amp, depth, w2) => {
        if (depth <= 0 || amp < 0.12) { put(x1, y1, z1, x2, y2, z2, w2); return; }
        const mx = (x1 + x2) / 2 + (Math.random() - 0.5) * amp;
        const my = (y1 + y2) / 2 + (Math.random() - 0.5) * amp * 0.6;
        const mz = (z1 + z2) / 2 + (Math.random() - 0.5) * amp;
        grow(x1, y1, z1, mx, my, mz, amp * 0.55, depth - 1, w2);
        grow(mx, my, mz, x2, y2, z2, amp * 0.55, depth - 1, w2);
        if (Math.random() < 0.45) {
          const fl = amp * (0.8 + Math.random());
          grow(mx, my, mz, mx + (Math.random() - 0.5) * fl * 2, my - fl * (0.2 + Math.random() * 0.9), mz + (Math.random() - 0.5) * fl * 2, amp * 0.5, depth - 2, w2 * 0.55);
        }
      };
      grow(b.ax, b.ay, b.az, b.bx, b.by, b.bz, b.amp * fade, 4, th);
```

(`put` is unchanged from Amendment 2. `BOLT_SEGS` no longer drives the main run; it stays declared for the cap arithmetic.)

### Step B3 — the budget

Depth-4 growth with forks emits up to ~40 segments per bolt. Raise the cap line:

```js
  const BOLT_SEG_CAP = BOLT_CAP * (BOLT_SEGS + 2);
```

to:

```js
  const BOLT_SEG_CAP = 2048; // Amendment 3: fractal bolts run ~40 segments each
```

### Step B4 — the idle arcs grow too

In the tower pass idle block, the small-arc spawn becomes: rate `dt * 2.2` → `dt * 3.5`, life `0.12` → `0.3`, and the two crown points spread wider — radius `0.55` → `0.8`. (Three literal number edits inside the existing `if (g.userData.glow)` block; nothing else in it moves.)

## Gates and the landing

- `node scripts/gate.mjs depot-test` (era 22 with the Part A pins — seed 13, no seed special), `golden`, `depot-lint`, `smoke`.
- All green → bump `src/version.js` to `mk2.18` → `npm run build` → commit "the tesla coil — the owner's bolt, mk2.18" → push.
- The owner's acceptance: possess the coil, press FIRE anywhere — a fat fractal bolt crackles for a full second, every press, phone and desktop. The sound task becomes mk2.19; the switch-and-words task mk2.20.
