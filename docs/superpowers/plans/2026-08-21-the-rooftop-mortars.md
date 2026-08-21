# THE ROOFTOP MORTARS — task plan (proposed mark mk2.06)

**Goal.** Lofted auto fire at structures aims at the TOP — the roof — instead of a center the fire solve flattens to the base. Player mortar squads and enemy mortar teams alike; one wrapper, symmetric. (Towers target men, never structures — no tower change.)

**Suggested model:** Sonnet 5 — one helper, four line edits, one behavior test.

**Ruling recorded (owner, 2026-08-21):** unpossessed mortars gain rooftop targeting, for attacking the depot. The flat-gun strip is accepted and leaves the polish queue (step 4).

## Required reading (verified against the live tree)

- `src/depot/state.js:534-545, 594-650` — hostileStructure, squadFire's scans and fire site
- `src/depot/units.js:350-400` — stepGrenadier's structure revalidation, scan, and fire
- `src/depot/accuracy.js:110-150` — marchArc/arcClears (the 0.9 m endpoint exclusion the roof descent rides)
- `docs/superpowers/polish-queue.md`
- `scripts/tests/04-vision-command-possession.mjs` — the mk2.03 block's end

## Steps

### Step 1 — baseline, then the failing tests

`node scripts/gate.mjs depot-test` clean; record PASS (expected 1767) BEFORE any edit. Append inside the mk2.03 block before its closing brace (04's state import gains `aimTop, makeSquad`-adjacent names it lacks — `aimTop` is the only new one):

```js
  // (k) mk2.06: THE ROOFTOP AIM — lofted auto fire at a structure aims at
  // its top, so a mortar can finally shell a stacked building.
  {
    const flatF6 = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } };
    const world = makeWorld({ field: flatF6, seed: 101 });
    world.depotCombat = true;
    // a 3-course enemy stack 14m out — the roof is the only honest aim
    for (let iy = 0; iy < 3; iy++) {
      const c = addBody(world, { kind: "chunk", team: 0, mass: 100, hx: 0.4, hy: 0.4, hz: 0.4, x: 14, y: 0.42 + iy * 0.83, z: 0, friction: 0.65, restitution: 0.02 });
      c.sleeping = true; c.town = "depot2";
    }
    const top = world.bodies[world.bodies.length - 1];
    const at = aimTop(world, top);
    ok("ROOFTOP mk2.06(k): aimTop carries the roof over the ground through hy",
      Math.abs(at.pos.y - (top.pos.y + top.hy)) < 1e-9 && Math.abs(at.hy - at.pos.y) < 1e-9, JSON.stringify(at));
    const sq = makeSquad(1, "mortars", 1, 0, 0);
    spawnSquadMembers(world, sq);
    sq.order = "defend"; sq.prefStruct = true;
    let fired = 0;
    for (let i = 0; i < 700; i++) {
      world.events.length = 0;
      squadFire(world, sq, world.dt, null);
      fired += world.events.filter((e) => e.type === "muzzle").length;
      stepWorld(world);
      if (fired) break;
    }
    ok("ROOFTOP mk2.06(k): the mortar squad opens fire on the stack", fired > 0, fired);
  }
  // (l) source pins: both sides' lofted structure fire aims at the top.
  {
    const stateSrc = fs.readFileSync(new URL("../../src/depot/state.js", import.meta.url), "utf8");
    const unitsSrc = fs.readFileSync(new URL("../../src/depot/units.js", import.meta.url), "utf8");
    ok("ROOFTOP mk2.06(l) source pin: squadFire's structure shot rides aimTop",
      /bestIsStruct && spec\.occl === "lofted" \? aimTop\(world, best\) : best/.test(stateSrc));
    ok("ROOFTOP mk2.06(l) source pin: the enemy mortar team's shot rides aimTop",
      /const aimT = tgt\.kind !== "unit" \? aimTop\(world, tgt\) : tgt;/.test(unitsSrc));
  }
```

Run depot-test. Expected: FAIL — `aimTop` does not exist. If the (k) behavior check fails AFTER step 2-3 land, HOLD and report the measured geometry — do not tune the fixture.

### Step 2 — the wrapper and the squad path (state.js)

After `hostileStructure`'s close, add:

```js
// mk2.06 (owner): THE ROOFTOP AIM. A lofted shot at a structure aims at its
// TOP — the roof — not a center the lead refresh flattens to the base. hy
// carries roof-over-ground so shooterFire's ay2 refresh lands on the roof
// (the mk2.02 surface-aim convention). Zero draws.
export function aimTop(world, b) {
  const top = b.pos.y + b.hy;
  return { pos: { x: b.pos.x, y: top, z: b.pos.z }, v: b.v || { x: 0, y: 0, z: 0 }, hy: top - world.field.heightAt(b.pos.x, b.pos.z) };
}
```

In squadFire's structure scan, the line `if (!arcClears(world, muzzle, s.pos, spec, u.id)) continue;` (`:620`) becomes:

```js
        if (!arcClears(world, muzzle, spec.occl === "lofted" ? { x: s.pos.x, y: s.pos.y + s.hy, z: s.pos.z } : s.pos, spec, u.id)) continue;
```

At the fire site, `shooterFire(world, u, muzzle, best, fspec, bestIsStruct` gains the wrapped target — the `best` argument becomes:

```js
    shooterFire(world, u, muzzle, bestIsStruct && spec.occl === "lofted" ? aimTop(world, best) : best, fspec, bestIsStruct
```

(the rest of the call unchanged).

### Step 3 — the enemy's tubes (units.js)

`units.js`'s state import gains `aimTop`. In `stepGrenadier`: the structure revalidation (`:357`) and the scan (`:377`) `arcClears(world, muzzle, tgt.pos, ...)` / `arcClears(world, muzzle, b.pos, ...)` become top-aimed the same way:

```js
        !arcClears(world, muzzle, { x: tgt.pos.x, y: tgt.pos.y + tgt.hy, z: tgt.pos.z }, fspec, u.id)) tgt = null;
```

```js
      if (d2 < td && arcClears(world, muzzle, { x: b.pos.x, y: b.pos.y + b.hy, z: b.pos.z }, fspec, u.id)) { td = d2; tgt = b; }
```

At its fire site, directly above the `if (u.tag === "gren") throwGrenade(...)` line, add:

```js
    const aimT = tgt.kind !== "unit" ? aimTop(world, tgt) : tgt; // mk2.06: structures take the shell on the roof
```

and both branches fire at `aimT` (`throwGrenade(world, u, muzzle, aimT)` / `shooterFire(world, u, muzzle, aimT, ...)`).

### Step 4 — the queue

`docs/superpowers/polish-queue.md`: the auto-rooftop line is REMOVED (this task closes it); the flat-gun strip line becomes `- ~~The flat-gun footprint strip~~ — accepted by the owner, 2026-08-21 (mk2.05 live check). Closed.`

### Step 5 — gates and deploy

`node scripts/gate.mjs depot-test` (acceptance: baseline + 4 = 1771; a keystone hash moved by the genuinely different shell flight is a HELD consequence, reported with old and new values, never re-pinned on the agent's authority), `golden`, `depot-lint`; then `src/version.js` → `mk2.06`, build AFTER the bump, `node scripts/gate.mjs smoke` (server on :4173, ~3s bind, killed after), commit everything as `the rooftop mortars, mk2.06`, push. The owner's live check, phone and desktop: your mortar teams shelling the enemy depot's roofline on their own; its teams doing the same back.

## Report requirements

- Fixture seed named: 101 (new); others untouched.
- Both depot-test PASS counts (baseline + 4 = 1771); any held keystone its own labeled bullet with old → new.
- Every deviation its own labeled bullet.
