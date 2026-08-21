# THE LASER FOOTPRINT AND THE TRUE MUZZLE — task plan (proposed mark mk2.05)

**Goal.** The footprint draws as projected light — 48 bound rays, nothing hidden, sharp breaks where the light really jumps. And the light and the shells leave the barrel TIP: the Bison's and the wave tank's shots originate where the drawn tube ends, pitch included, not at a phantom point over the hull's center.

**Suggested model:** Sonnet 5 — small edits, every block complete.

**Rulings recorded (owner, 2026-08-21):** project like a laser projector, never gate or hide the footprint; the barrel is modeled at its correct height.

**Design choices (owner tunes live, provisional F5):** 48 rays; barrel tables matched to the meshes — Bison pivot 1.47 over hull center, 0.6 forward, tube 3.6; wave tank 1.05 / 0.5 / 2.8. The Bison coax keeps its hull offset (a stub, not a tube) — recorded knowing.

## Required reading (verified against the live tree)

- `src/depot/accuracy.js` — predictRing's bound loop (`for (let s = 0; s < 16; s++)`, `:454`)
- `src/depot/drivers.js:40-70, 350-400, 530-565` — the wave tank's fire, the Bison's auto fire, the possessed gun/mg
- `src/depot/DepotGame.jsx:3685-3700` — the ring block's muzzle9/aim9 lines
- `src/depot/specs.js:95-110` — BISON/BISON_FIRE's neighborhood (BARRELS lands there)
- `src/render/renderer.js:60-66` — the Bison barrel pivot the numbers mirror
- `scripts/tests/04-vision-command-possession.mjs` — mk2.02(a) and the mk2.03 block's end

## The sweep license

One re-teach, in place. Anything else failing stops the task; a consequence failure is reported and HELD.

| Test | Old | New |
|---|---|---|
| 04 mk2.02(a) first check | label `...returns the 16-point footprint`, cond `pr.pts.length === 16` | label `...returns the 48-point laser footprint (re-taught mk2.05)`, cond `pr.pts.length === 48` |

## Steps

### Step 1 — baseline, then the failing tests

`node scripts/gate.mjs depot-test` clean; record PASS (expected 1762) BEFORE any edit. Apply the sweep re-teach. Append inside the mk2.03 block before its closing brace (04's accuracy import gains `RING_RAYS`; its drivers import — add one if none exists, `import { barrelTip } from "../../src/depot/drivers.js";` — gains `barrelTip`; the specs import gains `BARRELS`):

```js
  // (i) mk2.05: THE LASER FOOTPRINT — 48 rays, one exported constant.
  ok("LASER mk2.05(i): the bound walks RING_RAYS = 48 rays", RING_RAYS === 48);
  // (j) mk2.05: THE TRUE MUZZLE — the tip sits at the end of the drawn tube,
  // forward of the hull and above the pivot, and the fire paths use it.
  {
    const v = { pos: { x: 0, y: 0.95, z: 0 } };
    const m = barrelTip(v, { x: 20, y: 0, z: 0 }, { projSpeed: 85 }, BARRELS.bison);
    ok("MUZZLE mk2.05(j): the Bison's tip sits ~4.2m forward of the hull center", m.x > 3.5 && m.x < 4.6 && Math.abs(m.z) < 0.3, JSON.stringify(m));
    ok("MUZZLE mk2.05(j): the tip rides at the tube's height, not the hull's", m.y > 2.2, m.y);
    const driversSrc = fs.readFileSync(new URL("../../src/depot/drivers.js", import.meta.url), "utf8");
    const gameSrc = fs.readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");
    ok("MUZZLE mk2.05(j) source pin: possessed and auto tank guns fire from the tip",
      (driversSrc.match(/barrelTip\(/g) || []).length >= 4);
    ok("MUZZLE mk2.05(j) source pin: the projector's light leaves the tip too",
      /muzzle9 = pb0 && P9\.kind === "vehicle" \? barrelTip\(pb0, aim9, spec9, pb0\.vtype === "tank" \? BARRELS\.tank : BARRELS\.bison\)/.test(gameSrc));
  }
```

Run depot-test. Expected: FAIL.

### Step 2 — the rays (accuracy.js)

Above `predictRing`:

```js
// mk2.05 (owner): THE LASER FOOTPRINT — the bound draws as projected light,
// so it walks enough rays to hug the surfaces it lands on. // provisional (F5)
export const RING_RAYS = 48;
```

The bound loop `for (let s = 0; s < 16; s++) {` → `for (let s = 0; s < RING_RAYS; s++) {`; its azimuth `(s / 16) * Math.PI * 2` → `(s / RING_RAYS) * Math.PI * 2`.

### Step 3 — the barrel tables (specs.js)

After `BISON_FIRE`:

```js
// mk2.05 (owner): THE TRUE MUZZLE — the shot and the laser leave the barrel
// TIP. Numbers mirror the drawn meshes (renderer buildBison/buildWaveTank):
// pivot height over hull center, pivot forward offset, tube length. The
// Bison coax keeps its hull offset — a stub, not a tube. // provisional (F5)
export const BARRELS = {
  bison: { up: 1.47, fwd: 0.6, len: 3.6 },
  tank:  { up: 1.05, fwd: 0.5, len: 2.8 },
};
```

### Step 4 — the tip (drivers.js)

drivers.js imports gain `BARRELS` (specs), `aimSolve` (core — add to its core import), and `ELEV_CAP` (accuracy — add an accuracy import if none exists). After the module's imports, add:

```js
// mk2.05 (owner): barrelTip — where the drawn tube ends, yaw toward the
// aim, pitch estimated from the low root capped at the elevation cap. The
// muzzle the sim fires from and the muzzle the laser projects from are the
// same point. Zero draws.
export function barrelTip(v, aim, spec, B) {
  const yaw = Math.atan2(aim.x - v.pos.x, aim.z - v.pos.z);
  const px = v.pos.x + Math.sin(yaw) * B.fwd, py = v.pos.y + B.up, pz = v.pos.z + Math.cos(yaw) * B.fwd;
  const d = Math.max(2, Math.hypot(aim.x - px, aim.z - pz));
  const ay = aim.y != null ? aim.y : py;
  let p = aimSolve(spec.projSpeed, d, ay - py, 9.8, false);
  if (p == null) p = 0;
  p = Math.min(Math.max(p, 0), ELEV_CAP);
  const c = Math.cos(p);
  return { x: px + Math.sin(yaw) * B.len * c, y: py + B.len * Math.sin(p), z: pz + Math.cos(yaw) * B.len * c };
}
```

Four fire sites:
- The wave tank (`:65` area): `shooterFire(world, t, muzzle, tgt, fspec, { attacker: "enemy", hitStruct: true, owner: t.id });` → `shooterFire(world, t, barrelTip(t, tgt.pos, fspec, BARRELS.tank), tgt, fspec, { attacker: "enemy", hitStruct: true, owner: t.id });` (the scan `muzzle` line above it stays — range scanning keeps its cheap center point).
- The Bison's auto GUN fire (the `shooterFire` call in the auto-drive block near `:360-395` that fires `BISON_FIRE.gun`): its muzzle argument becomes `barrelTip(v, tgt.pos, gun, BARRELS.bison)`; the auto MG call keeps its `+ 1.4` muzzle.
- `possessedArmorFire` (`:537`): `{ x: v.pos.x, y: v.pos.y + 1.4, z: v.pos.z }` → `barrelTip(v, tgt.pos, gun, BARRELS.bison)`.
- `possessedArmorMg` (`:561`): unchanged (the coax knowing).

### Step 5 — the projector (DepotGame.jsx)

In the ring block, aim9 must exist before the muzzle. The two lines

```js
              const muzzle9 = pb0 ? { x: pb0.pos.x, y: pb0.pos.y + (P9.kind === "tower" ? pb0.hy + 0.45 : P9.kind === "vehicle" ? 1.4 : 0.5), z: pb0.pos.z }
                                  : { x: rc9.x, y: field.heightAt(rc9.x, rc9.z) + 0.5, z: rc9.z };
```

and the `const aim9 = ...` line below them REORDER and become:

```js
              const aim9 = { x: S.reticle.x, y: S.reticle.y != null ? S.reticle.y : field.heightAt(S.reticle.x, S.reticle.z), z: S.reticle.z }; // mk2.02: the surface itself — no phantom
              const muzzle9 = pb0 && P9.kind === "vehicle" ? barrelTip(pb0, aim9, spec9, pb0.vtype === "tank" ? BARRELS.tank : BARRELS.bison)
                                  : pb0 ? { x: pb0.pos.x, y: pb0.pos.y + (P9.kind === "tower" ? pb0.hy + 0.45 : 0.5), z: pb0.pos.z }
                                  : { x: rc9.x, y: field.heightAt(rc9.x, rc9.z) + 0.5, z: rc9.z };
```

(the sig9 and pr9 lines below stay byte-identical — their pins hold). Imports: line 28's drivers import gains `barrelTip`; line 18's specs import gains `BARRELS`.

### Step 6 — gates and deploy

`node scripts/gate.mjs depot-test` (acceptance: baseline + 5 = 1767; a different number stops the task, reported with the ledger), `golden`, `depot-lint`; then `src/version.js` → `mk2.05`, build AFTER the bump, `node scripts/gate.mjs smoke` (server on :4173, ~3s to bind first — the mk2.04 flake was a startup race; killed after), commit everything as `the laser footprint and the true muzzle, mk2.05`, push. The owner's live check, phone and desktop: the footprint hugging buildings like projected light, and the light rising from the barrel's actual tip as the tube elevates.

## Report requirements

- No new fixture seed; all seeds untouched.
- The one re-teach old → new; both depot-test PASS counts (baseline + 5 = 1767).
- Every deviation its own labeled bullet.
