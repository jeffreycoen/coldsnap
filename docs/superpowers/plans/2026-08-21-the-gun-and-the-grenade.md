# THE GUN AND THE GRENADE — task plan (proposed mark mk2.03)

**Goal.** Actual z-axis elevation — barrels rise and fall, the mortar root returns to the mortars; the reticle stands on every vertical face; the grenade becomes a thrown body with a 2.0 s fuse; grenadier squads become pairs; the polish queue document is written.

**Suggested model:** Sonnet 5 — every code block is complete; the work is placement and gate runs.

**Symmetry.** Elevation lives in `shooterFire`'s auto branch — one line of code, every shooter, both sides. The grenade is one throw function both sides' grenadiers call. The wave tank gains a barrel mesh so the enemy's elevation SHOWS like the player's.

**Rulings recorded (owner, 2026-08-21):** barrels visibly rise and fall; the mortar root is the mortars' alone; face classification on ALL verticals; grenade fuse 2.0 s from release, airbursts allowed, never impact-detonated, bounces and rolls, no whistle, own blast sound per the acoustics reference; grenadier squads n 2.

**Design choices (owner tunes live, all provisional F5):** elevation cap 35°, step 3°; grenade throw speed 11 m/s, scatter sigma 0.03, restitution 0.45, blast r 2.0 / dmg 16 / kv 5 / crater 0.3; grenade ring radius 2.2 m; all three sound cues.

## Required reading (verified against the live tree)

- `src/depot/accuracy.js:303-400` — flightImpact, deflect, predictRing
- `src/depot/state.js:387-455, 560-645, 706-760` — shooterFire, squadFire's fire site, possessedVolley
- `src/depot/units.js:334-420` — stepGrenadier and its fire site
- `src/depot/specs.js:237-280` — INFANTRY_ARMS (grenadiers row)
- `src/depot/squads.js:57-60`; `src/depot/muster.js:246-249` — the grenadier rows
- `src/engine/core.js:489-495, 1955-1965` — explode, the splice-removal idiom
- `src/depot/DepotGame.jsx` — the sim step near `stepTowers` (`:588-600`) and the ring block (`:3660-3705`)
- `src/render/renderer.js:60-80, 138-150, 810-825, 1630-1640, 1660-1700` — buildBison, tower gun mesh, buildScout, the vehicle mesh pick, turret sync
- `src/platform/audio.js:255-300, 520-550` — the synth idiom (noise/tone/modal/echoes), MUZZLE/WEAPON, consume's event map
- `src/ui/SoundBoard.jsx:50-60` — the row shape
- `scripts/tests/04-vision-command-possession.mjs` — the mk2.02 block; `scripts/tests/07-armor-demolition.mjs` — T7(a2), T9(e)

## The sweep license

Re-teaches only, no removals. Anything else failing stops the task.

| Test | Old | New |
|---|---|---|
| 04 mk2.02(c) both checks | clear line `flat.dy < 0.35`; walled line `lob.dy > 0.7` (the mortar root) | clear line unchanged; walled line label `...raises the barrel inside the 35° cap (re-taught mk2.03)`, cond `lob && lob.dy > flat.dy + 0.02 && lob.dy < Math.sin(35 * Math.PI / 180) + 0.02` |
| 04 mk2.02(i) grenade pin | `INFANTRY_ARMS.grenadiers.range === 12 && INFANTRY_ARMS.grenadiers.occl === "lofted" && ...range < INFANTRY_ARMS.mortars.range` | label `...a thrown body on a 2s fuse (re-taught mk2.03)`, cond `INFANTRY_ARMS.grenadiers.thrown === true && GRENADE.fuse === 2.0 && INFANTRY_ARMS.grenadiers.range < INFANTRY_ARMS.mortars.range` (04's specs import gains `GRENADE`) |
| 07 T7(a2) | `SQUAD_SPECS.grenadiers.n === 4 && ...cost === 40` | `...n === 2 && ...cost === 40`, label `...grenadier pair is 2 at cost 40 (re-taught mk2.03)` |
| 07 T9(e)/(e2)/(e3) fixtures | grenadiers 4 members; garrison `["rocket","rocket","gren","gren","gren","gren"]`, gren count 4, length 6, draws 18 | grenadiers 2 members; garrison `["rocket","rocket","gren","gren"]`, gren count 2, length 4, draws 12 — labels gain `(re-taught mk2.03)` |

## Steps

### Step 1 — baseline, then the failing tests

`node scripts/gate.mjs depot-test` clean; record PASS (expected 1740). Apply the sweep table. Append to 04 after the mk2.02 block (imports: line 6 gains `GRENADE`; state import gains `throwGrenade, stepGrenades`; accuracy import gains `elevSolve, speedForPitch`):

```js
// ==== THE GUN AND THE GRENADE (mk2.03) ======================================
// Actual elevation (the mortar root returns to the mortars), faces on every
// vertical, and the thrown 2.0s-fuse grenade.
{
  const flatField = { heightAt: () => 0, dirty: false, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } };
  const idUV = (x, z) => ({ u: x, v: z });
  const bareSG = () => ({ nx: 32, nz: 32, cs: 2, halfU: 32, halfV: 32,
    seen1: new Uint8Array(32 * 32).fill(1), seen2: new Uint8Array(32 * 32),
    gnd: new Float32Array(32 * 32), occ: new Float32Array(32 * 32).fill(-Infinity) });

  // (a) elevation solves: clear ground takes the low root at full speed; a
  // wall raises the pitch inside the cap at a fitted, lower speed.
  {
    const world = makeWorld({ field: flatField, seed: 91 });
    const clear = elevSolve(world, { x: 0, y: 1.5, z: 0 }, { x: 20, y: 0, z: 0 }, { projSpeed: 85 }, 0);
    ok("GUN mk2.03(a): clear ground fires the low root at full speed", clear && clear.v === 85 && clear.pitch < 0.1, JSON.stringify(clear));
    addBody(world, { kind: "wall", team: 1, mass: 0, hx: 0.9, hy: 1.8, hz: 0.2, x: 10, y: 1.8, z: 0, hp: 200 });
    const walled = elevSolve(world, { x: 0, y: 1.5, z: 0 }, { x: 20, y: 0, z: 0 }, { projSpeed: 85 }, 0);
    ok("GUN mk2.03(a): the wall raises the barrel inside the 35° cap, speed fitted under full",
      walled && walled.pitch > 0.1 && walled.pitch <= 35 * Math.PI / 180 + 1e-9 && walled.v < 85, JSON.stringify(walled));
  }
  // (b) past the cap the gun holds: a tall wall right at the target's feet.
  {
    const world = makeWorld({ field: flatField, seed: 92 });
    addBody(world, { kind: "wall", team: 1, mass: 0, hx: 0.9, hy: 9, hz: 0.2, x: 18, y: 9, z: 0, hp: 999 });
    const sol = elevSolve(world, { x: 0, y: 1.5, z: 0 }, { x: 20, y: 0, z: 0 }, { projSpeed: 85 }, 0);
    ok("GUN mk2.03(b): an arc the cap cannot clear returns null — the gun holds its fire", sol === null, JSON.stringify(sol));
    world.events.length = 0;
    const shooter = addBody(world, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 1.0, hz: 0.28, x: 0, y: 1.0, z: 5, hp: 58 });
    shooterFire(world, shooter, { x: 0, y: 1.5, z: 0 }, { pos: { x: 20, y: 0, z: 0 }, v: { x: 0, y: 0, z: 0 }, hy: 0 }, { ...BISON_FIRE.gun }, { attacker: "player", owner: shooter.id });
    ok("GUN mk2.03(b): shooterFire fires nothing when no lawful arc exists", world.events.filter((e) => e.type === "muzzle").length === 0);
  }
  // (c) the barrel pitch rides the shooter: a fired auto shot writes _aimPitch.
  {
    const world = makeWorld({ field: flatField, seed: 93 });
    const shooter = addBody(world, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 1.0, hz: 0.28, x: 0, y: 1.0, z: 5, hp: 58 });
    shooterFire(world, shooter, { x: 0, y: 1.5, z: 0 }, { pos: { x: 20, y: 0, z: 0 }, v: { x: 0, y: 0, z: 0 }, hy: 0 }, { ...BISON_FIRE.gun }, { attacker: "player", owner: shooter.id });
    ok("GUN mk2.03(c): the fired pitch is written to the shooter for the barrel mesh", typeof shooter._aimPitch === "number");
  }
  // (d) faces by entry direction: a flat round entering below the top hits
  // the FACE even in the last 0.4m; a descending round takes the roof.
  {
    const SG = bareSG();
    for (let iz = 0; iz < 32; iz++) SG.occ[iz * 32 + 21] = 3;
    const grazeTop = flightImpact(SG, { x: 0, y: 2.8, z: 0 }, { x: 1, y: 0, z: 0 }, 100, { windF: 0 }, null, idUV);
    ok("GUN mk2.03(d): a flat round entering 0.2m under the top still hits the FACE", grazeTop.wall === true, JSON.stringify(grazeTop));
    const drop = flightImpact(SG, { x: 8, y: 30, z: 0 }, { x: 0.35, y: -0.94, z: 0 }, 30, { windF: 0 }, null, idUV);
    ok("GUN mk2.03(d): a descending round crossing the top takes the ROOF, flat", drop.wall === false && Math.abs(drop.y - 3) < 0.01, JSON.stringify(drop));
  }
  // (e) THE GRENADE: thrown as a body with exactly 2 draws; the fuse is 2.0s
  // from release; it never detonates on impact; a long lob bursts in the air.
  {
    const world = makeWorld({ field: flatField, seed: 94 });
    world.depotCombat = true;
    const man = addBody(world, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 1.0, hz: 0.28, x: 0, y: 1.0, z: 0, hp: 58 });
    let draws = 0; const raw = world.rng; world.rng = () => { draws++; return raw(); };
    const g = throwGrenade(world, man, { x: 0, y: 1.5, z: 0 }, { pos: { x: 8, y: 0, z: 0 }, v: { x: 0, y: 0, z: 0 } });
    ok("GRENADE mk2.03(e): the throw draws exactly twice (applyScatter's contract)", draws === 2, draws);
    ok("GRENADE mk2.03(e): the grenade is a live body owned by physics", g && g.alive && world.byId.get(g.id) === g);
    let boomed = null;
    for (let i = 0; i < 400; i++) {
      world.events.length = 0;
      stepWorld(world); stepGrenades(world);
      const b = world.events.find((e) => e.type === "boom" && e.kind === "grenade");
      if (b) { boomed = { t: world.t, e: b }; break; }
    }
    ok("GRENADE mk2.03(e): the fuse fires at 2.0s from release, not on impact",
      boomed && Math.abs(boomed.t - (g.grenade.t0 + 2.0)) < 0.03, boomed && (boomed.t - g.grenade.t0).toFixed(3));
    ok("GRENADE mk2.03(e): the spent grenade leaves the world", world.byId.get(g.id) === undefined);
  }
  // (f) the pair and the tables.
  ok("GRENADE mk2.03(f): grenadier squads are pairs", SQUAD_SPECS.grenadiers.n === 2);
  ok("GRENADE mk2.03(f): the grenade's dials — 2.0s fuse, 12m throw ceiling", GRENADE.fuse === 2.0 && INFANTRY_ARMS.grenadiers.range === 12);
  // (g) source pins: both sides throw; the barrels pitch; the sounds exist.
  {
    const stateSrc = fs.readFileSync(new URL("../../src/depot/state.js", import.meta.url), "utf8");
    const unitsSrc = fs.readFileSync(new URL("../../src/depot/units.js", import.meta.url), "utf8");
    const gameSrc = fs.readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");
    const rendSrc = fs.readFileSync(new URL("../../src/render/renderer.js", import.meta.url), "utf8");
    const audioSrc = fs.readFileSync(new URL("../../src/platform/audio.js", import.meta.url), "utf8");
    const boardSrc = fs.readFileSync(new URL("../../src/ui/SoundBoard.jsx", import.meta.url), "utf8");
    ok("mk2.03(g) source pin: squadFire and possessedVolley throw for grenadiers",
      (stateSrc.match(/throwGrenade\(world, u, muzzle/g) || []).length === 2);
    ok("mk2.03(g) source pin: the enemy grenadier throws the same grenade",
      /throwGrenade\(world, u, muzzle, tgt\)/.test(unitsSrc));
    ok("mk2.03(g) source pin: the sim steps the fuses", /stepGrenades\(world\);/.test(gameSrc));
    ok("mk2.03(g) source pin: vehicle and tower barrels wear the live pitch",
      (rendSrc.match(/g\.userData\.gunPitch\.rotation\.x = -\(b\._aimPitch \|\| 0\);/g) || []).length === 2);
    ok("mk2.03(g) source pin: the wave tank has a barrel to raise",
      /buildWaveTank/.test(rendSrc) && /b\.vtype === "tank" \? buildWaveTank\(b\.team\)/.test(rendSrc));
    ok("mk2.03(g) source pin: toss, bounce, and the grenade's own blast are voiced",
      /grenade: \(x, z\)/.test(audioSrc) && /gbounce/.test(audioSrc) && /function gblast/.test(audioSrc));
    ok("mk2.03(g) source pin: the soundboard benches all three",
      /id: "gren-toss"/.test(boardSrc) && /id: "gren-bounce"/.test(boardSrc) && /id: "gren-blast"/.test(boardSrc));
  }
}
// ==== end THE GUN AND THE GRENADE (mk2.03) ==================================
```

Run depot-test. Expected: FAIL — the exports do not exist.

### Step 2 — elevation and faces (accuracy.js)

After `applyScatter`, before `SCATTER_CAP`, add (note `solidBlocksPoint` and `aimSolve` are already in this module's scope):

```js
// mk2.03 (owner): ACTUAL ELEVATION. For a chosen pitch the speed landing the
// shell on the target is fixed by the parabola; raising the barrel lowers
// the fitted speed toward the 45° minimum. elevSolve walks pitch from the
// low root to the 35° cap in 3° steps and returns the first arc that clears
// terrain and solids, or null — past the cap the gun holds its fire. The
// mortar root belongs to the mortars alone. Zero draws.
export const ELEV_CAP = 35 * Math.PI / 180;
export const ELEV_STEP = 3 * Math.PI / 180;
export function speedForPitch(d, dy, p, g = 9.8) {
  const den = 2 * Math.cos(p) * Math.cos(p) * (d * Math.tan(p) - dy);
  if (den <= 0) return null;
  return Math.sqrt(g * d * d / den);
}
export function arcAtPitchClears(world, muzzle, target, p, v, selfId) {
  const dx = target.x - muzzle.x, dz = target.z - muzzle.z;
  const d = Math.max(1e-3, Math.hypot(dx, dz));
  const ux = dx / d, uz = dz / d;
  const vh = Math.max(1e-3, v * Math.cos(p)), vy0 = v * Math.sin(p);
  const tof = d / vh;
  const N = Math.max(8, Math.ceil(d / 0.9));
  for (let k = 1; k < N; k++) {
    const t = (k / N) * tof;
    const hx = muzzle.x + ux * vh * t, hz = muzzle.z + uz * vh * t;
    const hy = muzzle.y + vy0 * t - 4.9 * t * t;
    // the last 3m is the landing itself — never ground-tested (a shot aimed
    // at the dirt must be allowed to descend into it); the first 2.5m keeps
    // losGraze's own muzzle-cover exemption
    if ((k / N) * d < d - 3.0 && hy <= world.field.heightAt(hx, hz) + 0.05) return false;
    if ((k / N) * d > 2.5 && solidBlocksPoint(world, hx, hy, hz, selfId)) return false;
  }
  return true;
}
export function elevSolve(world, muzzle, target, spec, selfId) {
  const d = Math.max(2, Math.hypot(target.x - muzzle.x, target.z - muzzle.z));
  const dy = target.y - muzzle.y;
  let p0 = aimSolve(spec.projSpeed, d, dy, 9.8, false);
  if (p0 == null) p0 = 0.1;
  for (let p = p0; p <= ELEV_CAP + 1e-9; p += ELEV_STEP) {
    const v = p === p0 ? spec.projSpeed : speedForPitch(d, dy, p);
    if (v == null || v > spec.projSpeed) continue;
    if (arcAtPitchClears(world, muzzle, target, p, v, selfId)) return { pitch: p, v };
  }
  return null;
}
```

In `flightImpact`, faces go by entry direction. `const p = { x: muzzle.x, y: muzzle.y, z: muzzle.z };` gains a tracker on the next line: `let py = muzzle.y;`. The line `p.x += v.x * dt; p.y += v.y * dt; p.z += v.z * dt;` becomes `py = p.y; p.x += v.x * dt; p.y += v.y * dt; p.z += v.z * dt;`. The face line `const face = p.y < SG.occ[i] - 0.4;` becomes:

```js
      // mk2.03: entry direction decides — a round that crossed the top from
      // above took the roof; one that came in under it took the FACE.
      const face = py <= SG.occ[i];
```

In `predictRing`, the auto branch (`if (!high && spec.occl === "auto") { ... }`) is REPLACED whole — no mortar root, an SG-map mirror of elevSolve, integration at the fitted speed. The `let high` / `let rawDir` / `let center` head stays; `flightImpact` calls below the branch change to pass `fireV`:

```js
  let fireV = spec.projSpeed;
  if (!high && spec.occl === "auto") {
    const shortfall = Math.hypot(aim.x - muzzle.x, aim.z - muzzle.z) - Math.hypot(center.x - muzzle.x, center.z - muzzle.z);
    if (center.wall || shortfall > 1.5) {
      // mk2.03: raise the barrel inside the cap, speed fitted — the SG-map
      // mirror of elevSolve; null keeps the low root and the ring parks on
      // the obstruction, saying "no lawful arc".
      const d = Math.max(2, Math.hypot(aim.x - muzzle.x, aim.z - muzzle.z));
      const dy = aim.y - muzzle.y;
      let found = null;
      let p0 = aimSolve(spec.projSpeed, d, dy, 9.8, false);
      if (p0 == null) p0 = 0.1;
      for (let p = p0 + ELEV_STEP; p <= ELEV_CAP + 1e-9 && !found; p += ELEV_STEP) {
        const v = speedForPitch(d, dy, p);
        if (v == null || v > spec.projSpeed) continue;
        const dxn = (aim.x - muzzle.x) / d, dzn = (aim.z - muzzle.z) / d;
        const dir = { x: dxn * Math.cos(p), y: Math.sin(p), z: dzn * Math.cos(p) };
        const hit = flightImpact(SG, muzzle, dir, v, spec, wind, toUV);
        if (!hit.wall && Math.hypot(hit.x - aim.x, hit.z - aim.z) < 2.5) found = { dir, v, hit };
      }
      if (found) { rawDir = found.dir; fireV = found.v; center = found.hit; }
    }
  }
```

and every later `flightImpact(SG, muzzle, deflect(...), spec.projSpeed, ...)` in the function becomes `flightImpact(SG, muzzle, deflect(...), fireV, ...)`.

### Step 3 — the gun fires the raised arc (state.js)

The mk2.02 auto line in `shooterFire` (`if (!high && spec.occl === "auto" && !arcClears(...)) high = true;`) is REPLACED by:

```js
  // mk2.03 (owner): ACTUAL ELEVATION — no mortar root for guns. An "auto"
  // spec raises the barrel inside the 35° cap at a fitted speed (elevSolve);
  // with no lawful arc the gun HOLDS its fire.
  let elev = null;
  if (!high && spec.occl === "auto") {
    elev = elevSolve(world, muzzle, target.pos, spec, opts.owner);
    if (!elev) return;
  }
```

After the `rawDir` line, add:

```js
  if (elev) {
    const du = Math.hypot(dx, dz) || 1;
    rawDir.x = (dx / du) * Math.cos(elev.pitch); rawDir.y = Math.sin(elev.pitch); rawDir.z = (dz / du) * Math.cos(elev.pitch);
  }
  // mk2.03: the barrel mesh wears the fired pitch (render-only field).
  shooter._aimPitch = Math.asin(Math.max(-1, Math.min(1, rawDir.y)));
```

and `fireProjectile(world, { ... }, dir, spec.projSpeed,` becomes `fireProjectile(world, { ... }, dir, elev ? elev.v : spec.projSpeed,`. The accuracy import swaps `arcClears` usage: the import line keeps `arcClears` (reachPolygon-era callers may hold it) and gains `elevSolve`.

The grenade, after `possessedTowerFire`'s close:

```js
// mk2.03 (owner): THE GRENADE — a thrown BODY on a 2.0s fuse from release.
// Physics owns the flight and the roll (bounce, settle, slide downhill);
// stepGrenades owns the clock. Airbursts happen; impact detonation never
// does. One throw, both sides. Two draws per throw (applyScatter's own),
// draw-count stable against the shot it replaces.
export function throwGrenade(world, thrower, muzzle, tgt) {
  const dx = tgt.pos.x - muzzle.x, dz = tgt.pos.z - muzzle.z;
  const d = Math.max(1, Math.hypot(dx, dz));
  const pitch = aimSolve(GRENADE.v, d, tgt.pos.y - muzzle.y, 9.8, false);
  const p = pitch == null ? 0.7 : Math.max(0.35, pitch); // a throw is always lobbed
  const raw = { x: (dx / d) * Math.cos(p), y: Math.sin(p), z: (dz / d) * Math.cos(p) };
  const dir = applyScatter(world, raw, 0.03);
  const g = addBody(world, { kind: "grenade", team: thrower.team, mass: GRENADE.mass, hx: GRENADE.hx, hy: GRENADE.hy, hz: GRENADE.hz,
    x: muzzle.x + dir.x * 0.6, y: muzzle.y + dir.y * 0.6, z: muzzle.z + dir.z * 0.6, hp: 999, friction: 0.5, restitution: 0.45 });
  g.v.x = dir.x * GRENADE.v; g.v.y = dir.y * GRENADE.v; g.v.z = dir.z * GRENADE.v;
  g.grenade = { t0: world.t, attacker: thrower.team === 2 ? "enemy" : "player", bounced: false };
  world.events.push({ type: "muzzle", x: muzzle.x, y: muzzle.y, z: muzzle.z, dx: dir.x, dy: dir.y, dz: dir.z, kind: "mg", weapon: "grenade" });
  if (!world._grenades) world._grenades = [];
  world._grenades.push(g);
  return g;
}
export function stepGrenades(world) {
  const L = world._grenades;
  if (!L || !L.length) return;
  for (let i = L.length - 1; i >= 0; i--) {
    const g = L[i];
    if (!g.alive) { L.splice(i, 1); continue; }
    if (!g.grenade.bounced && g.v.y > 0.5 && world.t - g.grenade.t0 > 0.2) {
      g.grenade.bounced = true;
      world.events.push({ type: "gbounce", x: g.pos.x, z: g.pos.z }); // audio-only, never hashed
    }
    if (world.t - g.grenade.t0 >= GRENADE.fuse) {
      explode(world, g.pos.x, g.pos.y, g.pos.z, { r: GRENADE.r, dmg: GRENADE.dmg, kv: GRENADE.kv, crater: GRENADE.crater, kind: "grenade", hitStruct: true, attacker: g.grenade.attacker });
      g.alive = false;
      const bi = world.bodies.indexOf(g);
      if (bi >= 0) world.bodies.splice(bi, 1);
      world.byId.delete(g.id);
      L.splice(i, 1);
    }
  }
}
```

(`GRENADE`, `explode`, `addBody`, `aimSolve`, `applyScatter` — the specs import gains `GRENADE`; the core import already carries the rest; add any missing name to its import line.)

squadFire's fire site — the block `const high = spec.occl === "lofted";` through the `shooterFire(world, u, muzzle, best, fspec, ...)` call — gains, ABOVE that `const high` line:

```js
    // mk2.03: grenadiers THROW — the shot dies, the body flies. Cooldown
    // spent exactly as a shot would spend it (fireCd is set just above).
    if (squad.type === "grenadiers") { throwGrenade(world, u, muzzle, best); continue; }
```

possessedVolley — above its own `shooterFire(...)` call inside the member loop (after `u.fireCd = spec.fireRate;`):

```js
    if (squad.type === "grenadiers") { throwGrenade(world, u, muzzle, tgt); fired++; continue; }
```

INFANTRY_ARMS.grenadiers (specs.js) re-signs: `occl: "lofted"` stays (corridor exemption reads it), the row gains `thrown: true`, and the comment above it gains `// mk2.03: thrown — see GRENADE; projectile fields below are dead weight kept for the pie/reach displays.` Beside INFANTRY_ARMS, add:

```js
// mk2.03 (owner): THE GRENADE — one body, both sides. Fuse 2.0s from
// release. // provisional (F5)
export const GRENADE = { v: 11, fuse: 2.0, r: 2.0, dmg: 16, kv: 5, crater: 0.3, mass: 0.4, hx: 0.09, hy: 0.09, hz: 0.09 };
```

### Step 4 — the enemy throws too; the pair (units.js, squads.js, muster.js)

`stepGrenadier`'s fire line — grenadiers throw, the mortar team keeps the tube. The line `shooterFire(world, u, muzzle, tgt, fspec, { high: true, attacker: "enemy", hitStruct: true, owner: u.id });` becomes:

```js
    if (u.tag === "gren") throwGrenade(world, u, muzzle, tgt); // mk2.03: the grenade is thrown, both sides
    else shooterFire(world, u, muzzle, tgt, fspec, { high: true, attacker: "enemy", hitStruct: true, owner: u.id });
```

(`units.js`'s state import gains `throwGrenade`.) The gren branch's range: `stepGrenadier`'s `fspec` line already reads `INFANTRY_ARMS.grenadiers` — range 12 governs acquisition unchanged.

`squads.js`: `grenadiers: { n: 4, cost: 40, ... }` → `n: 2` (comment gains `mk2.03 (owner): a pair`). `muster.js` PICK_POOL `sq_grenadiers` row `n: 4` → `n: 2`.

### Step 5 — the sim steps the fuses; the possessed pitch (DepotGame.jsx)

In the sim step, directly after the `stepTowers(...)` call (`:588-598` area), add:

```js
      stepGrenades(world); // mk2.03: the grenade fuses — 2.0s from each release
```

(state import gains `stepGrenades`.) In the ring block, after `hit9 = pr9.center.wall ? ... : null;`, add:

```js
              // mk2.03: a possessed gun's barrel wears the live pitch.
              if (pb0) pb0._aimPitch = Math.asin(Math.max(-1, Math.min(1, pr9.rawDir.y)));
```

The possessed grenadier ring: in the ring block's squad branch, `spec9 = sq9 ? INFANTRY_ARMS[sq9.type] : null;` is followed by the existing `spec9 && spec9.acc != null` gate — thrown specs keep `acc`, so the ring still draws; the landing bound overshoots a rolled grenade by design this mark (recorded in the polish queue: the grenade ring's roll-and-fuse model).

### Step 6 — barrels that rise and fall (renderer.js)

buildBison — the barrel gains a pivot. The line `const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 3.6), toon(0x33383d)); barrel.position.set(0, 0.12, 2.4); barrel.castShadow = true; tur.add(barrel);` becomes:

```js
  // mk2.03 (owner): the barrel rises and falls — a pivot at the mantlet,
  // the tube a child, pitch driven by b._aimPitch in the sync below.
  const gpiv = new THREE.Group(); gpiv.position.set(0, 0.12, 0.6); tur.add(gpiv); g.userData.gunPitch = gpiv;
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 3.6), toon(0x33383d)); barrel.position.set(0, 0, 1.8); barrel.castShadow = true; gpiv.add(barrel);
```

Tower GUN — the two lines `const bar = ...; bar.position.z = 1.2; t.add(bar);` and `const brake = ...; brake.position.z = 2.25; t.add(brake);` become:

```js
    const gp = new THREE.Group(); t.add(gp); g.userData.gunPitch = gp; // mk2.03: the tube elevates
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 2.3), iron); bar.position.z = 1.2; gp.add(bar);
    const brake = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, 0.3), iron); brake.position.z = 2.25; gp.add(brake);
```

The wave tank gets a gun to raise. After `buildBison`'s close, add:

```js
// mk2.03 (owner): the wave tank finally shows its gun — hull, turret, and a
// barrel that elevates. DEPOT-only (vtype "tank"); the demo's scouts and
// trucks render untouched.
export function buildWaveTank(team) {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.1, 4.2), toon(team === 2 ? 0x6e3a34 : 0x3f5a78)); hull.position.y = 0.15; hull.castShadow = true; g.add(hull);
  const tur = new THREE.Group(); tur.position.y = 0.95; g.add(tur); g.userData.turret = tur;
  const box = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.7, 2.0), toon(team === 2 ? 0x5a2f2a : 0x2a5082)); box.castShadow = true; tur.add(box);
  const gp = new THREE.Group(); gp.position.set(0, 0.1, 0.5); tur.add(gp); g.userData.gunPitch = gp;
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 2.8), toon(0x33383d)); bar.position.z = 1.4; bar.castShadow = true; gp.add(bar);
  return g;
}
```

The vehicle mesh pick (`:1635`): `g = b.vtype === "apc" ? buildApc(b.team) : ...` gains, before the bison clause: `b.vtype === "tank" ? buildWaveTank(b.team) :`. In `units.js` `spawnTank`, the addBody result gains `u.vtype = "tank";` beside its other fields.

The sync. After the vehicle turret line (`:1669`), add:

```js
      if (g.userData.gunPitch) g.userData.gunPitch.rotation.x = -(b._aimPitch || 0);
```

and inside the tower turret block (`:1689-1693`), after the recoil line, the same line verbatim (the pin in step 1 counts exactly two).

### Step 7 — the sounds (audio.js, SoundBoard.jsx)

WEAPON table gains:

```js
    // mk2.03: THE TOSS — no whistle anywhere in a grenade's life. A soft,
    // low, short puff of effort. // provisional, the owner's ear rules
    grenade: (x, z) => { noise(x, z, { f0: 300, f1: 120, dur: 0.08, gain: 0.10, wet: 0.3 }); },
```

In `consume()`, beside the boom handler:

```js
      if (e.type === "gbounce") modal(e.x, e.z, [{ f: 1450, q: 18, g: 1 }, { f: 2300, q: 20, g: 0.4 }], 0.05, 0.12, { wet: 0.25 }); // mk2.03: the clatter
```

The boom line `if (e.type === "boom") explosion(e.x, e.z, e.r || 2);` becomes `if (e.type === "boom") e.kind === "grenade" ? gblast(e.x, e.z) : explosion(e.x, e.z, e.r || 2);` with, near `explosion`:

```js
  // mk2.03: THE GRENADE BLAST — per the acoustics reference: the energy in
  // the 150-1200Hz band the ear reads as a real blast, short, one hard
  // crack on top, the map answering behind. // provisional, owner's ear rules
  function gblast(x, z) {
    noise(x, z, { f0: 3000, type: "highpass", dur: 0.02, gain: 0.18, wet: 0.15 });
    noise(x, z, { f0: 900, f1: 150, dur: 0.28, gain: 0.5, delay: 0.008, wet: 0.45 });
    tone(x, z, { f0: 96, f1: 44, type: "sine", dur: 0.16, gain: 0.3, atk: 0.006 });
    echoes(x, z, (ex, ez, dly, k) => noise(ex, ez, { f0: 480, f1: 90, dur: 0.22, gain: 0.24 * k, delay: dly, wet: 0.7, dark: 0.5 }));
  }
```

SoundBoard rows, after the existing blast/shell rows, matching the file's row shape exactly (NEAR as the file defines it):

```js
  { id: "gren-toss", name: "GRENADE TOSS", desc: "A short soft throw — cloth and effort, no machine in it. Blink and you miss it.", ev: () => [{ type: "muzzle", x: 0, y: 1.5, z: 6, dx: 0, dy: 0.6, dz: 0.8, kind: "mg", weapon: "grenade" }] },
  { id: "gren-bounce", name: "GRENADE BOUNCE", desc: "A hard little clink off frozen ground — one knock, bright, gone.", ev: () => [{ type: "gbounce", x: 0, z: 8 }] },
  { id: "gren-blast", name: "GRENADE BLAST", desc: "A real blast in the middle of your hearing, shorter and sharper than a shell — a crack, a thump, and the map answering.", ev: () => [{ type: "boom", x: 0, z: 10, r: 2, kind: "grenade" }] },
```

### Step 8 — the polish queue document

Write `docs/superpowers/polish-queue.md`:

```markdown
# COLDSNAP — the polish queue

Deferred by the owner's word, collected here by standing order. Nothing folds in opportunistically; each leaves by its own task.

- Auto-firing mortar units and towers choosing rooftop targets on their own (possessed fire has the surface law since mk2.01; the ballistics pass was named at the mk2.01 design).
- The per-side speed audit — the roster-mirror closing task (enemy grenadier 2.6 vs the pair's 3.2; its sapper 3.8 vs 3.2; its marksman 2.9 vs 3.2).
- The squad ring draws from the farthest living shooter; other members' cones are near-certainly, not provably, inside it. Rocket volleys' per-shot muzzle step is unmodeled.
- A LOCKED moving target brings the lead solve outside the drawn ring's bound.
- Predictor solids are 2m sight-grid cells, not exact hitboxes.
- The flat-gun footprint draws as the long strip it truly is — presentation open, owner rules after the mk2.03 elevation lands.
- The grenade ring uses a fixed-size landing bound; the roll-and-fuse drift is unmodeled (mk2.03).
- The README's check count re-verifies at phase close (said 1,707; the suite has grown since).
```

### Step 9 — gates

`node scripts/gate.mjs depot-test`, `golden`, `depot-lint`; then bump, build, and `smoke` (step 10's order). Arithmetic: 18 new checks (a2, b2, c1, d2, e4, f2, g7), 0 removed, sweep re-teaches in place — final depot-test PASS = step 1's baseline + 18 (expected 1758). A different number stops the task, reported with the re-derived ledger. Any failure outside the sweep table stops the task; a consequence failure (a fixture the grenade's draw or body change moves) is reported and HELD for the owner — not re-taught on the agent's own authority.

### Step 10 — deploy

`src/version.js` → `mk2.03`; build AFTER the bump; run `node scripts/gate.mjs smoke` against the built preview (server on :4173, killed after); commit everything as `the gun and the grenade, mk2.03`; push. The owner's live check, phone and desktop: barrels rising to clear walls and falling level, on the Bison, the enemy tank, and the gun tower; no gun ever lobbing like a mortar; the crosshair standing on rock sides; grenades tossed, bouncing, rolling, bursting on the 2-second fuse, airbursting on long throws; pairs of grenadiers; the three new sounds on the soundboard (`?sounds=1`), his ear the acceptance.

## Report requirements

- Fixture seeds named: 91, 92, 93, 94 (new); others untouched.
- Every sweep re-teach old → new; any held consequence failure its own labeled bullet.
- Both depot-test PASS counts with the ledger (baseline + 18).
- Every deviation its own labeled bullet.
