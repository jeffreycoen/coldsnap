# THE ONE TARGET LAW — the enemy fights everything you field (mk2.52)

Owner's order, 2026-08-25: fix the AI across the board. The board, measured and read: enemy infantry cannot target vehicles or mechs at all (`nearestPlayerUnit` filters to `kind === "unit"`, units.js:112), their sticky-target revalidation drops any non-unit (units.js:125), and the wave tank's gun scans structures only (drivers.js:56-81). Your side's law is already whole: squads target men, hulls, and mechs alike (`squadFire`'s scan, state.js:602), and your armor scans foes first, masonry second (`armorGuns`, drivers.js:369-394). This plan gives the enemy the identical law — the soft-target set is men, hulls, and mechs, preferred at full range; masonry when no soft target stands.

**Suggested model: Sonnet** — every edit is specified verbatim here.

## Facts this plan is built on (verified at plan time)

- `nearestPlayerUnit` (units.js:108-119) is the ONLY anti-personnel scan; both consumers (stepRifleman :267, stepGrenadier :380) go through it. Its pool `world._L.friends` already carries vehicles and mechs (lists.js:31-37).
- The sticky branches split on `tgt.kind === "unit"` at units.js:231 and :346; the fire-opts split at :278-280; the grenadier's aim-top split at :395.
- `unitTargetValid` (units.js:124-131) gates the sticky soft target by `kind !== "unit"`.
- The wave tank (`tankGuns`, drivers.js:56-81) scans `hostileStructure` only. `armorScanFoes` (drivers.js:338-353) is a module-level function declaration in the same file — hoisted, callable from tankGuns above it. It draws nothing.
- Enemy armor, the enemy mech, and the atomic crew already target the full set — untouched.
- **Pinned-fixture predictions, each with its stop rule:**
  - The 07 T1 wave-tank pin (`PIN_HASH 782830233 / PIN_DRAWS 12`, 07-armor-demolition.mjs:25-44): fixture holds a tank and a WALL, zero player soft bodies — the added foes scan finds nothing and draws nothing, so hash and draws stand. If they move, STOP.
  - The T6 keystone (05-the-front.mjs:540-541, re-pinned mk2.51): fixture holds conscripts and a player squad, zero vehicles — the widened kind set changes nothing there. If it moves, STOP.
  - 01-engine-era.mjs:1137 pins exactly ONE literal `effRange(world, muzzle, fspec)` in drivers.js — the tankGuns edit adds no second occurrence (armorScanFoes' own line reads `spec`, not `fspec`).
- Behavior consequence, stated: your hulls and mechs now take rifle, rocket, grenade, mortar, and wave-tank fire. Rifle rounds chip armor lightly (the armor/blast law); rockets and mortars hurt. Possessed armor stops being invulnerable to infantry — that is the order.

## Required reading (read-confirmation opens the report)

1. This plan.
2. `src/depot/units.js` lines 100-140, 217-300, 336-410.
3. `src/depot/drivers.js` lines 35-85 and 335-395.
4. `scripts/tests/27-the-urgency-law.mjs` (all — this task appends to it).
5. `scripts/tests/07-armor-demolition.mjs` lines 20-45 (the pin that must not move).
6. `scripts/depot-test.mjs` (all).

## Steps

### Step 1 — failing asserts first: append to era 27

Add `stepDrivers` to the era file's imports:

```js
import { stepDrivers } from "../../src/depot/drivers.js";
```

Append at the end of `scripts/tests/27-the-urgency-law.mjs`:

```js
// ---- mk2.52: THE ONE TARGET LAW — the enemy's soft-target set is the
// player's own: men, hulls, and mechs, preferred at full range.
ok("U5: the soft-target set is shared law in units.js",
  /const soft = \(b\) => b\.kind === "unit" \|\| b\.kind === "vehicle" \|\| b\.kind === "mech";/.test(src("src/depot/units.js")));
ok("U5b: the wave tank runs the armor scan first",
  /armorScanFoes\(world, t, muzzle, fspec, false, T, toUV\)/.test(src("src/depot/drivers.js")));

// U6 — behavior: a held enemy rifleman engages a player HULL at 10m.
{
  const flatF = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (x, z, o) => { o.x = 0; o.y = 1; o.z = 0; return o; } };
  const w = makeWorld({ field: flatF, seed: 272 }); w.depotCombat = true;
  const g = spawnUnit(w, { x: 0, z: 0 }, "");
  g.hold = true; g.garrison = true;
  addBody(w, { kind: "vehicle", team: 1, mass: 2600, hx: 1.6, hy: 1.0, hz: 3.0, x: 0, y: 1.05, z: 10, hp: 50000 });
  for (let i = 0; i < 2400; i++) { stepUnits(w, straightGrid(0, 1), identFwdDir, null); stepWorld(w); }
  ok("U6: a rifleman engages a player hull at 10m (seed 272) — hulls were invisible to him",
    w.events.filter((ev) => ev.type === "muzzle").length > 0);
}

// U7 — behavior: the wave tank fires on a player man (structures absent).
{
  const flatF = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (x, z, o) => { o.x = 0; o.y = 1; o.z = 0; return o; } };
  const w = makeWorld({ field: flatF, seed: 273 }); w.depotCombat = true;
  spawnUnit(w, { x: 0, z: -15 }, "tank");
  addBody(w, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x: 0, y: 0.74, z: 10, hp: 50000 });
  for (let i = 0; i < 1200; i++) { stepDrivers(w, straightGrid(0, 0), identFwdDir, null); stepUnits(w, straightGrid(0, 0), identFwdDir, null); stepWorld(w); }
  ok("U7: the wave tank fires on a player man (seed 273) — its gun knew only masonry",
    w.events.filter((ev) => ev.type === "boom").length > 0);
}
```

(`straightGrid(0, 0)` parks the tank on a zero-direction flow — `tankGoal`'s stand-and-gun branch — so the fixture tests the gun, not the crush.)

Run `node scripts/gate.mjs depot-test` — the four FAIL. Record the PASS count.

### Step 2 — `src/depot/units.js`: the shared soft set

**(a)** Directly above `nearestPlayerUnit` (below the comment block ending at line 107), add:

```js
// mk2.52 (owner): THE ONE TARGET LAW — the enemy's soft-target set is the
// player's own (state.js squadFire's scan): men, hulls, and mechs alike.
const soft = (b) => b.kind === "unit" || b.kind === "vehicle" || b.kind === "mech";
```

**(b)** In `nearestPlayerUnit`, replace line 112 with:

```js
    if (!soft(s) || !s.alive || s.team !== 1) continue;
```

**(c)** In `unitTargetValid`, replace line 125 with:

```js
  if (!tgt || !tgt.alive || !soft(tgt) || tgt.team !== 1) return false;
```

**(d)** stepRifleman line 231, replace with:

```js
  if (tgt && soft(tgt)) {
```

**(e)** stepRifleman lines 278-280, replace with:

```js
      shooterFire(world, u, muzzle, tgt, fspec, soft(tgt)
        ? { attacker: "enemy", owner: u.id }
        : { attacker: "enemy", hitStruct: true, hitOnly: "structure", owner: u.id });
```

**(f)** stepGrenadier line 346, replace with:

```js
  if (tgt && soft(tgt)) {
```

**(g)** stepGrenadier line 395, replace the `aimT` line with:

```js
    const aimT = !soft(tgt) ? aimTop(world, tgt) : tgt; // mk2.06 roofs; mk2.52: a hull is a body, aimed direct with its own speed
```

Comment tidy: at lines 103-107 (`// A player soldier inside...`), replace "A player soldier" with "A player soft target (man, hull, or mech)" — comment only.

### Step 3 — `src/depot/drivers.js`: the wave tank joins the armor law

In `tankGuns`, directly after the line `const eR = effRange(world, muzzle, fspec);` (drivers.js:61), add:

```js
  // mk2.52 (owner): THE ONE TARGET LAW — the wave tank fights like the rest
  // of the armor: soft targets first (the shared armor scan, draw-free),
  // masonry only when none stands. The 07 T1 pin holds: its fixture fields
  // no player soft body, so the scan finds nothing and nothing moves.
  const live = armorScanFoes(world, t, muzzle, fspec, false, T, toUV);
  if (live) {
    t.gunT = fspec.cd + world.rng() * (fspec.cdVar || 0);
    shooterFire(world, t, barrelTip(t, live.pos, fspec, BARRELS.tank), live, fspec, { attacker: "enemy", hitStruct: true, owner: t.id });
    return;
  }
```

Nothing else in the function moves — the structure scan and its shot stand as the fallback.

### Step 4 — gates

- `node scripts/gate.mjs depot-test` — green, strictly one gate at a time; ledger: 4 new era-27 checks, 1 comment-only tidy. The 07 T1 pin and the T6 keystone must stand exactly (the plan's predictions); either moving is an UNLISTED failure — STOP.
- `node scripts/gate.mjs depot-lint` — green (the one added rng draw rides an actual tank shot, never a bare roll).
- `node scripts/gate.mjs smoke` — green; any smoke failure is unlisted — STOP.

### Step 5 — the deploy

Bump `src/version.js` to `mk2.52`. Build AFTER the bump; commit ("the one target law — the enemy fights everything you field, mk2.52"); push. The owner's live check — his possessed armor drawing rifle, rocket, mortar, and tank fire — is the acceptance.

## Report

Read-confirmation, one line of outcome, PASS counts before/after with the ledger, gates and verdicts, commit hash, shipped mark, seeds (era-27 fixtures 271/272/273, keystone 1000, smoke's 11). Every nonconformity its own labeled bullet.

## Out of scope, held

- The armor-vs-armor live-mount anomaly (headless-proven green; sandbox hold unreproduced).
- The income-following enemy muster budget — design questions to serve when the owner is ready.
