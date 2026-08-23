# The Tesla Coil — Amendment 4 (the aimed strike, the whole reticle, and the counters)

## Diagnosis carried in

- **Partial reticle — proven.** `DepotGame.jsx:3717` gates the possession landing-bound preview on `spec9.acc != null`; the tesla spec row carries no `acc`, so only the bare crosshair draws. Plan-writer's omission in the mk2.15 spec row.
- **No damage on FIRE — sim exonerated.** The exact possessed ground-strike path was run headless through the real engine: fires, chains, damages an own-team unit for 35. Every gate ahead of the tesla branch (cooldown, aim sight, arcs array) is shared with working mg possession and reads correct in the tree. The live killer is not identifiable by reading; this amendment instruments it with mechanics counters instead of guessing.
- **Owner's ruling (2026-08-22):** a possessed coil aimed at his own units strikes them directly.

## Step 1 — the spec learns accuracy

`src/depot/specs.js`, the tesla row: add `acc: 0.02, windF: 0, windComp: 0,` after `kind: "mg", weapon: "tesla",`. A bolt flies true (tiny acc, no wind hand); the field's only mechanical reader for a possessed tesla is the reticle preview and `scatterSigma` (which the tesla branch never calls for the shot itself — the chain has no scatter). This restores the full reticle: bound polygon, crosshair, live barrel pitch.

## Step 2 — the possessed snap takes any body

`src/depot/state.js`, in `possessedTowerFire`, inside the `if (spec.tesla) {` branch, replace:

```js
    if (live) { teslaStrike(world, arcs, tower, live); return true; }
```

with:

```js
    // Amendment 4 (owner): the possessed coil strikes ANY living body under
    // the crosshair — his own men included. snapTargetNear only locks
    // enemies, so scan both sides here; sight is already ruled at the aim.
    let mark = live;
    if (!mark) {
      let bd = POSSESS_SNAP_R * POSSESS_SNAP_R;
      for (const b of world.bodies) {
        if ((b.kind !== "unit" && b.kind !== "vehicle" && b.kind !== "mech") || !b.alive) continue;
        const dx = b.pos.x - aim.x, dz = b.pos.z - aim.z, d2 = dx * dx + dz * dz;
        if (d2 < bd) { bd = d2; mark = b; }
      }
    }
    if (mark) { teslaStrike(world, arcs, tower, mark); return true; }
```

## Step 3 — the counters

`src/depot/DepotGame.jsx`, beside `window.__DEPOTSPAWN__` (the debug-hook block), add:

```js
      window.__DEPOTTESLA__ = () => { const S = stateRef.current; return { arcs: S && S.arcs ? S.arcs.length : -1, fired: S ? S._teslaFired || 0 : -1, zaps: S ? S._teslaZaps || 0 : -1, held: !!(S && S.fireHeld), pk: S && S.possess ? S.possess.kind : null }; };
```

In the possessed-tower fire block (`DepotGame.jsx:3627-3631`), the call line becomes:

```js
              if (ptw && possessedTowerFire(world, ptw, S.reticle, T, invW, S.arcs)) S._teslaFired = (S._teslaFired || 0) + 1;
```

And in the frame's event drain (directly after `const evs = drainEvents();` at ~:3666), add:

```js
          for (const e of evs) if (e.type === "zap") S._teslaZaps = (S._teslaZaps || 0) + 1;
```

These are plain counters on the run-state ref — render-free, save-inert (`_`-prefixed fields are swept by `plainValue` only if numeric; they carry no meaning across runs and harm nothing if saved). The owner types `__DEPOTTESLA__()` in the browser console after one FIRE press — or reports what the game shows — and the numbers say where the discharge died: `fired` 0 means the trigger gates refused; `fired` >0 with `zaps` 0 means the chain stepper never emitted; `zaps` >0 means the sim worked and the failure is purely the drawing.

## Step 4 — the pins

Append to `scripts/tests/22-the-tesla-coil.mjs`:

```js
{ // Amendment 4: the possessed snap takes any body — own men included
  const { makeField: mf4, makeWorld: mw4, addBody: ab4 } = await import("../../src/engine/core.js");
  const { possessedTowerFire: ptf4, stepTesla: st4 } = await import("../../src/depot/state.js");
  const { TOWER_SPECS: TS4 } = await import("../../src/depot/specs.js");
  ok("a4: the spec carries acc", TS4.tesla.acc != null);
  const field = mf4(41, 2.0, 13);
  const world = mw4({ field, seed: 13 });
  world.depotCombat = true;
  const tower = ab4(world, { kind: "tower", team: 1, mass: 0, hx: 0.8, hy: TS4.tesla.hy, hz: 0.8, x: 0, y: field.heightAt(0, 0) + TS4.tesla.hy, z: 0, hp: 85 });
  tower.towerType = "tesla";
  const own = ab4(world, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 1, hz: 0.28, x: 8, y: field.heightAt(8, 0) + 1, z: 0, hp: 100 });
  own.smearStyle = "human";
  const arcs = [];
  ok("a4: FIRE on an own man fires", ptf4(world, tower, { x: 8, z: 0 }, null, undefined, arcs) === true);
  for (let i = 0; i < 4; i++) { world.t += 0.05; st4(world, arcs); }
  ok("a4: the own man takes the strike", own.hp === 65);
}
```

## Gates and the landing

`node scripts/gate.mjs depot-test` (seed 13, no seed special), `golden`, `depot-lint`, `smoke`. All green → bump `src/version.js` to `mk2.19` → build → commit "the tesla coil — the aimed strike, mk2.19" → push. The owner's next possess-and-FIRE is the acceptance; if the bolt still fails to draw, `__DEPOTTESLA__()` names the guilty layer with numbers, no pictures. Sound becomes mk2.20; the switch and words mk2.21.
