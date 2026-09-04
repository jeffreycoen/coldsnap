# The Symmetric Jeep (mk3.03)

The enemy fields whatever the player fields — symmetry is law — and the jeep shipped without its enemy side. Today `parkArmor`, the one door every enemy hull enters through, knows only apc and bison: an enemy jeep pick would field a jeep-labeled hull with the Bison's spec and no springs, and the bell's hull-a-bell ladder never buys one. This task closes the asymmetry the jeep plan opened without asking.

Suggested model: Sonnet 5 — five files, every code block verbatim, one licensed re-teach.

## Steps

### Step 1 — the failing tests

Create `scripts/tests/47-the-symmetric-jeep.mjs` with exactly:

```js
import { ok } from "./harness.mjs";
import { makeWorld } from "../../src/engine/core.js";
import { makeMap, TOWN, makeGrid } from "../../src/depot/mapgen.js";
import { parkArmor } from "../../src/depot/muster.js";
import { JEEP } from "../../src/depot/specs.js";
import fs from "node:fs";

// ==== mk3.03: the symmetric jeep ============================================
// SYMMETRY IS LAW — the enemy's jeep parks through the same door with the
// same fit. Seed rolled each run.
{
  console.log("\n[mk3.03: the symmetric jeep]");
  const SEED = (Date.now() % 1000000) + 1;
  console.log("  fixture seed base", SEED);

  // (a) parkArmor fields a REAL jeep for team 2 — spec, springs, fit and all
  {
    const map = makeMap(SEED);
    const flat = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (x, z, o) => { o.x = 0; o.y = 1; o.z = 0; return o; } };
    const w = makeWorld({ field: flat, seed: SEED });
    const grid = makeGrid(flat);
    const depotE = TOWN.find((t) => t.depot && t.team === 2);
    let seq = 0;
    parkArmor(w, grid, flat, depotE, 2, "jeep", () => ++seq, map);
    const v = w.bodies.find((b) => b.kind === "vehicle" && b.vtype === "jeep" && b.team === 2);
    ok("(a) the enemy's jeep parks through the one door", !!v, v ? "parked" : "no jeep");
    ok("(a) it wears the jeep's own spec, not the Bison's", !!v && v.hx === JEEP.hx && v.maxHp === JEEP.hp && v.bounty === JEEP.bounty, v ? `${v.hx}/${v.maxHp}/${v.bounty}` : "-");
    ok("(a) it rides the springs with the full fit", !!v && !!v.susp && v.fords === true && v.eyeR === JEEP.eye && v.gear === "2h" && v.drv === "jeep" && v.apcSeq === 1, v ? `${!!v.susp}/${v.fords}/${v.eyeR}/${v.gear}/${v.drv}/${v.apcSeq}` : "-");
  }

  // (b) pins: one fit for both teams; the bell ladder buys it; the price knows it
  const sp = fs.readFileSync("src/depot/specs.js", "utf8");
  ok("(b) pins: the fit lives with the spec, one for both teams", /export const fitJeep = \(v\) => \{/.test(sp));
  const dg = fs.readFileSync("src/depot/DepotGame.jsx", "utf8");
  ok("(b) pins: the player's spawns use the shared fit", (dg.match(/fitJeep\(v\);/g) || []).length >= 3 && !/const jeepFit = /.test(dg));
  const bl = fs.readFileSync("src/depot/bell.js", "utf8");
  ok("(b) pins: the hull-a-bell ladder buys the jeep", /!has\("jeep"\) && open\("hero_jeep"\)/.test(bl) && /k === "hero_jeep" \? JEEP\.cost/.test(bl));
}
```

In `scripts/depot-test.mjs`, after the line

```js
await import("./tests/46-the-jeep-refit.mjs");
```

insert

```js
await import("./tests/47-the-symmetric-jeep.mjs");
```

Run `node scripts/gate.mjs depot-test` blocking, once. Required pattern, measured by a live pre-fix run at plan-writing time: FIVE new asserts FAIL — the second and third (a) asserts (the impostor wears the Bison's spec and no fit) and all three (b) pins — while "(a) the enemy's jeep parks through the one door" PASSES pre-fix (a jeep-labeled body does park today; it is just the wrong machine). Every pre-existing test PASSES. Any other pattern stops the task.

### Step 2 — the fit moves to the spec (`src/depot/specs.js`)

Immediately after the JEEP row, insert:

```js
// mk3.03: one fit for every spawned jeep, either team — springs, gears,
// the fording flag, the spotter's eye. "2h" standing.
export const fitJeep = (v) => {
  v.susp = { ...JEEP.susp };
  v.fords = true; v.eyeR = JEEP.eye; v.gear = "2h";
  v.spdF = JEEP.spd2h; v.spdR = 3; v.accCap = JEEP.cap2h;
};
```

### Step 3 — the one door learns the jeep (`src/depot/muster.js`)

Add `JEEP` and `fitJeep` to muster.js's specs.js import. In `parkArmor`, replace exactly:

```js
  const spec = kind === "apc" ? APC : BISON;
```

with:

```js
  const spec = kind === "apc" ? APC : kind === "jeep" ? JEEP : BISON;
```

and replace exactly:

```js
    if (kind === "apc") v.apcSeq = nextSeq();
```

with:

```js
    if (kind === "apc" || kind === "jeep") v.apcSeq = nextSeq();
```

and replace exactly:

```js
    v.drv = kind === "apc" ? "apc" : "armor"; v.depotDrive = "auto"; v.order = "defend"; v.tracks = "careful";
```

with:

```js
    v.drv = kind === "apc" ? "apc" : kind === "jeep" ? "jeep" : "armor"; v.depotDrive = "auto"; v.order = "defend"; v.tracks = "careful";
    if (kind === "jeep") fitJeep(v);
```

### Step 4 — the bell ladder buys it (`src/depot/bell.js`)

Add `JEEP` to bell.js's specs.js import. Replace exactly:

```js
    const heroPrice = (k) => (run._market ? run._market.foe[k] : (k === "hero_bison" ? BISON.cost : k === "hero_mech" ? MECH.cost : APC.cost));
```

with:

```js
    const heroPrice = (k) => (run._market ? run._market.foe[k] : (k === "hero_bison" ? BISON.cost : k === "hero_mech" ? MECH.cost : k === "hero_jeep" ? JEEP.cost : APC.cost));
```

and after the apc rung's two lines

```js
    } else if (depotE4 && !has("apc") && open("hero_apc") && run.reg.scrap >= heroPrice("hero_apc")) {
      run.reg.scrap -= heroPrice("hero_apc"); parkArmor(world, grid, field, depotE4, 2, "apc", ctx.nextApcSeq, map);
```

insert:

```js
    } else if (depotE4 && !has("jeep") && open("hero_jeep") && run.reg.scrap >= heroPrice("hero_jeep")) {
      run.reg.scrap -= heroPrice("hero_jeep"); parkArmor(world, grid, field, depotE4, 2, "jeep", ctx.nextApcSeq, map); // mk3.03: symmetry — its scouts ride too
```

### Step 5 — the player's spawns share the fit (`src/depot/DepotGame.jsx`)

Add `fitJeep` to DepotGame's specs.js import. Delete the local `jeepFit` definition (the `const jeepFit = (v) => { ... };` block inside the mk2.98 comment, comment included — `view.toggleGear` directly below it STAYS). Replace all FOUR `jeepFit(v);` call sites (three player spawn doors and the enemy's) with `fitJeep(v);`.

LICENSED RE-TEACH: `scripts/tests/45-the-jeep.mjs`'s pin `(d) pins: the fit dresses every spawned jeep` re-teaches from

```js
  ok("(d) pins: the fit dresses every spawned jeep", /const jeepFit = \(v\) => \{/.test(dg) && (dg.match(/jeepFit\(v\);/g) || []).length >= 3);
```

to

```js
  ok("(d) pins: the fit dresses every spawned jeep (re-taught mk3.03: the fit moved to the spec, one for both teams)", (dg.match(/fitJeep\(v\);/g) || []).length >= 3);
```

No other re-teach is licensed.

### Step 6 — gates and the landing

Run blocking (timeout 400000 ms each), in order: `node scripts/gate.mjs depot-test` (the six new asserts PASS, the re-teach in place, everything else PASSES), `node scripts/gate.mjs smoke` — green. Then `src/version.js` `mk3.02` → `mk3.03`, `npm run build` after the bump, commit (specs.js, muster.js, bell.js, DepotGame.jsx, the new test file, scripts/tests/45-the-jeep.mjs, depot-test.mjs, version.js, this plan file, .superpowers/gates.log) and push. Commit subject: `the symmetric jeep — the enemy fields what the player fields, mk3.03`.

## Acceptance

- Arithmetic: `depot-test` exits 0 with all six new asserts PASS plus the re-teach; `smoke` exits 0. Seeds rolled, printed, never written in.
- The owner's live check: a war where the enemy's draft or bell brings a jeep — it parks at its depot on springs, scouts with the same eye, and dies for the same 15-scrap bounty.
