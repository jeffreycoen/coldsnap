# THE GUN AND THE GRENADE — Amendment 1 (two step-1 fixture defects)

Both held failures are defects in the plan's own test fixtures; the shipped step 2-7 code stands untouched. Both corrections verified live before serving.

## 1. The roof-drop fixture (GUN mk2.03(d), second check)

The plan's drop (`{x:8,y:30}` at dir `{x:0.35,y:-0.94}`, speed 30) drifts past the column before descending to its top, and a near-vertical drop can never satisfy the predictor's own 2.5 m muzzle-cover exemption from inside the column. The corrected drop starts outside the column and descends onto it — 5 m of horizontal travel, crossing the top at x≈10.7. The line

```js
    const drop = flightImpact(SG, { x: 8, y: 30, z: 0 }, { x: 0.35, y: -0.94, z: 0 }, 30, { windF: 0 }, null, idUV);
```

becomes

```js
    const drop = flightImpact(SG, { x: 6, y: 26, z: 0 }, { x: 0.232, y: -0.97, z: 0 }, 25, { windF: 0 }, null, idUV);
```

The assertion is unchanged. Measured result: `{x:10.74, y:3, wall:false}` — the roof, flat.

## 2. The grenade fixture's missing carve (GRENADE mk2.03(e))

`explode()` carves the field when the spec craters; the mk2.03 block's `flatField` stub has no `carve`, so the fuse detonation crashes the run. The fix is the fixture, not the engine — 07's own `flatF` stub carries the same no-op. The block's fixture line

```js
  const flatField = { heightAt: () => 0, dirty: false, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } };
```

becomes

```js
  const flatField = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } };
```

## Execution from the held tree

The tree already carries steps 1-7; only these two fixture lines change. Then the task resumes at step 9's gates and step 10's deploy, exactly as the plan wrote them.
