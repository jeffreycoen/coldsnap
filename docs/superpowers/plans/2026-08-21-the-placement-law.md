# THE PLACEMENT LAW AND THE HERO MARKET — task plan (proposed mark mk1.95)

*Written 2026-08-21 on the owner's word. One task. Suggested model: Sonnet — every step is specced to the code with exact text; the agent executes, never designs.*

## The rulings (owner, 2026-08-21 — this plan's design truth)

1. **THE ONE PLACEMENT LAW.** The hero hulls (Bison, APC, mech) stop being a two-tap slot arm. The slot arms a placement mode like every other build; the ground tap sets a ghost; the ✓ fields the hull at that spot at that moment's live price; the ✗ cancels free. The two-tap arm and its silent 3-second expiry die.
2. **THE ZONE SHOWS.** While any confirm placement is armed — towers, squads, hires, heroes, the pre-start deal — the ground it may take is visible: held ground for the war-time flows, the homeland ring for the deal. Walls, sandbags and engineer lines keep their instant flows: named exclusion.
3. **THE GHOSTS ARE TRUE.** Hire, deal and hero ghosts carry the unit's real footprint — a hull its hull, the mech its vetted spread, a tower its post, a squad the stand its men take.
4. **HERO PRICES BEHAVE LIKE EVERY OTHER PRICE, SYMMETRICALLY** (owner's words). The three hero families leave K 1 and take K 3 — the tank family's machine precedent, provisional (F5). Everything else stands: one shared table, both sides' iron counted, type wall × field wall. The old ruling "a second hero while yours lives is absurd" is superseded knowingly, here.

**Symmetry note (named for review):** the capability — field a bought hero on your own held ground — is both sides'. The enemy's chooser (`bell.js`'s replacement walk) keeps parking its heroes at its own depot, which is its held ground; that is doctrine, not capability, and no law changes. The shared price table stays symmetric by construction (K4 pins it).

## Dials (provisional, F5)

| Dial | Value |
|---|---|
| Hero family K (all three) | 3 |
| Zone fill colors | homeland ring `0x4aff8c`, held ground `0x7dffa8`, opacity 0.10 — the owner's eye rules live |
| Zone refresh | ~4Hz, wall time |
| Squad-hire ghost footprint | 2.2 × 2.2 × 1.05 m |

At K 3: one standing hull prices ×1.2 (Bison 240), doubles at three, tops out ×6 (1200) at five-plus. The 50× clamp is now reachable only through the field wall.

## Required reading (agent, before any code; anchors re-verified at dispatch)

This plan whole; `CLAUDE.md`; `src/depot/DepotGame.jsx` — the import lines (:21, :41), PALETTE and its hero comment (:735-765), the two-tap arm block (:1455-1490), `canBuildAt`/`startPending`/`confirmPending` (:1545-1606), `SQUAD_MODE`/`canPlaceInfantryAt`/`placeSquadAt`/`placePick` (:1607-1694), `tapAt` (:2255-2368), `pickManifest` (:2600-2617), `armHire`/`placeHire` (:2618-2691), the frame-loop overlay block (:3580-3660), `setMode` (:3916-3945), the bar markup (:4550-4584), `terrAcc` (:1104), R's declaration (:909, :1196); `src/depot/state.js` — the export the plan adds rides after `validatePlacement` (grep it); `src/render/renderer.js` — the overlay (:1308-1430); `src/depot/market.js` (:17-40, :77-104); `src/depot/territory.js` `canBuild` (:108); `src/depot/muster.js` `PICK_POOL` (:245-261), `MECH_SPREAD` (:164); `scripts/tests/07-armor-demolition.mjs` (:1136-1157), `scripts/tests/08-debug-pass.mjs` (:475-485), `scripts/tests/11-hiring-hall.mjs` (:125-180, :440-450), `scripts/tests/12-the-mech.mjs` (:308-320); `scripts/depot-test.mjs`; `scripts/tests/harness.mjs`. The agent's report opens by confirming this list was read.

## Trap notes

- **The hire and deal pending literals are text-pinned** (`11-hiring-hall.mjs` T3(c), T3(c3): the pins match the literal's OPENING). Append `fp: ghostFp(...)` at the END of each object literal, before the closing brace — never reorder, never touch the opening.
- **K6 sweeps the whole game-layer source** for `buyHero|heroArm|HERO_ARM_S` — every named comment re-teach in Step 6g is mandatory or K6 fails on a stale comment.
- **`renderer.js` is a frozen-law file** — additive divergences only; `golden.mjs` must stay 7/7. `setZone` is a new overlay member; `setPending` gains one trailing optional parameter no demo caller passes.
- **`confirmPending` calls `placeHero` defined ~1100 lines later** — same-scope `const`, executed after mount: the exact precedent `confirmPending` → `placeHire` already sets. Not a defect; do not reorder.
- **The zone masks the movement GRID (2 m cells), not the territory field.** ORIENT is quarter-turns only, so every cell's world square stays axis-aligned; flat quads at cell-center height with a 0.14 lift.
- **The zone tick runs on WALL dt, outside the sdt gate** — the deal phase runs with the sim frozen, and a sim-clocked tick would never fire there.
- **`zoneAcc` starts at 0.25** so the first frame after mount refreshes at once; arming appears within ≤250 ms.
- **Three old asserts pin the superseded behavior** (07 T9(c3), 12 M26, 08 T17(b)) — re-taught in Step 7, count-neutral, before the gate run. Any other suite failure stops the task.
- **This era draws no rng and no fixture seed** — the mask test rides a hand-built stub grid; the market tests are pure arithmetic.

---

## Step 1 — the pure mask (state.js)

`src/depot/state.js`, appended directly after `validatePlacement`'s closing brace (grep `export function validatePlacement`):

```js
// mk1.95: THE PLACEMENT ZONE's mask — pure. One byte per grid cell: 1 where
// a confirm placement may land — the caller's own held test, minus every
// cell the ground itself refuses. The game layer hands it to the renderer.
export function placeZoneMask(grid, heldAt) {
  const m = new Uint8Array(grid.w * grid.h);
  for (let gz = 0; gz < grid.h; gz++) for (let gx = 0; gx < grid.w; gx++) {
    const c = grid.cells[grid.idx(gx, gz)];
    if (c.blocked || c.wallId || c.ice || c.water) continue;
    const wp = grid.gridToWorld(gx, gz);
    if (heldAt(wp.x, wp.z)) m[grid.idx(gx, gz)] = 1;
  }
  return m;
}
```

## Step 2 — asserts first: era 14

New file `scripts/tests/14-the-placement-law.mjs`, registered in `scripts/depot-test.mjs` after era 13 (`await import("./tests/14-the-placement-law.mjs");` before `finish()`):

```js
// COLDSNAP suite era 14 — THE PLACEMENT LAW AND THE HERO MARKET (mk1.95).
// The hero hulls leave the two-tap arm and field by the one placement law
// (mode -> ghost -> confirm); every confirm placement shows its zone while
// armed; hero prices leave K 1 and ride the ordinary curve, one shared
// table, both sides. This era draws no rng and names no fixture seed.
import { ok } from "./harness.mjs";
import fs from "node:fs";
import { computePrices, MARKET_K } from "../../src/depot/market.js";
import { placeZoneMask } from "../../src/depot/state.js";

{
  console.log("\n[era 14: the placement law and the hero market]");
  const dgSrc = fs.readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");
  const rSrc = fs.readFileSync(new URL("../../src/render/renderer.js", import.meta.url), "utf8");

  // (a) the hero market rides the ordinary curve
  ok("K1: the three hero families carry K 3 (the machine precedent)",
    MARKET_K.heroBison === 3 && MARKET_K.heroApc === 3 && MARKET_K.heroMech === 3,
    JSON.stringify({ b: MARKET_K.heroBison, a: MARKET_K.heroApc, m: MARKET_K.heroMech }));
  ok("K2: one standing bison prices 240, no longer double",
    computePrices({ heroBison: 1 }).player.hero_bison === 240, computePrices({ heroBison: 1 }).player.hero_bison);
  ok("K2b: two standing bisons price 300",
    computePrices({ heroBison: 2 }).player.hero_bison === 300, computePrices({ heroBison: 2 }).player.hero_bison);
  ok("K2c: the type wall tops out at 6x past the pole (1200)",
    computePrices({ heroBison: 6 }).player.hero_bison === 1200, computePrices({ heroBison: 6 }).player.hero_bison);
  ok("K3: one standing mech prices 480",
    computePrices({ heroMech: 1 }).player.hero_mech === 480, computePrices({ heroMech: 1 }).player.hero_mech);
  const pSym = computePrices({ heroBison: 1, heroApc: 2, heroMech: 1 });
  ok("K4: the foe table carries the same hero prices — one shared market, symmetric",
    pSym.foe.hero_bison === pSym.player.hero_bison && pSym.foe.hero_apc === pSym.player.hero_apc && pSym.foe.hero_mech === pSym.player.hero_mech);

  // (b) the zone mask, functional — a hand-built stub grid, no rng, no seed
  {
    const cells = [];
    for (let i = 0; i < 16; i++) cells.push({ blocked: false, wallId: null, ice: false, water: false });
    cells[5].blocked = true; cells[6].ice = true;
    const grid = { w: 4, h: 4, cs: 2, cells, idx: (gx, gz) => gz * 4 + gx, gridToWorld: (gx, gz) => ({ x: gx * 2, z: gz * 2 }) };
    const m1 = placeZoneMask(grid, (x, z) => z >= 4);
    let held1 = 0; for (let i = 0; i < 16; i++) held1 += m1[i];
    ok("K5: the mask holds exactly the held half-plane", held1 === 8 && m1[grid.idx(0, 2)] === 1 && m1[grid.idx(0, 1)] === 0, `${held1} cells`);
    grid.cells[grid.idx(1, 2)].wallId = 7;
    const m2 = placeZoneMask(grid, (x, z) => z >= 4);
    let held2 = 0; for (let i = 0; i < 16; i++) held2 += m2[i];
    ok("K5b: blocked, iced and walled cells leave the mask", held2 === 7 && m2[grid.idx(1, 2)] === 0, `${held2} cells`);
  }

  // (c) the game layer: the two-tap arm is dead, the one placement law holds
  ok("K6: buyHero, heroArm and HERO_ARM_S are gone from the game layer",
    !/buyHero|heroArm|HERO_ARM_S/.test(dgSrc));
  ok("K7: the hero mode map exists beside the squad map",
    /const HERO_MODE = \{ hero_bison: "bison", hero_apc: "apc", hero_mech: "mech" \};/.test(dgSrc));
  ok("K8: setMode carries no hero special-case",
    !/m === "hero_bison" \|\| m === "hero_apc" \|\| m === "hero_mech"/.test(dgSrc));
  ok("K9: a hero-mode ground tap sets a pending ghost with its footprint",
    /S\.pending = \{ hero: S\.mode,[^\n]*fp: ghostFp\(S\.mode\)/.test(dgSrc));
  ok("K10: the ✓ runs placeHero; a refusal leaves the ghost standing",
    /if \(p\.hero\) \{ if \(placeHero\(p\.hero, p\.wp\)\) S\.pending = null; return; \}/.test(dgSrc));
  ok("K11: placeHero checks the price first and the ground's own laws (the mk1.86 precedent)",
    /const placeHero = \(key, p\) => \{[\s\S]{0,700}toast\("NO SCRAP"\); return false;[\s\S]{0,700}toast\("GROUND NOT HELD"\); return false;/.test(dgSrc));
  ok("K12: the hire and deal ghosts carry their footprints",
    /S\.pending = \{ hire: S\.hirePlace\.key[^\n]*fp: ghostFp\(S\.hirePlace\.key\)/.test(dgSrc) &&
    /S\.pending = \{ deal: S\._placeQueue\[0\][^\n]*fp: ghostFp\(S\._placeQueue\[0\]\)/.test(dgSrc));
  ok("K13: the zone refreshes on its own wall-time tick (the deal phase has no sim clock)",
    /zoneAcc \+= dt;[\s\S]{0,120}refreshZone\(\);/.test(dgSrc));
  ok("K14: the zone opens for the deal, the hires, the squads, the towers and the heroes",
    /const dealPhase = !S\.started && S\._placeQueue && S\._placeQueue\.length;/.test(dgSrc) &&
    /TOWER_SPECS\[S\.mode\] \|\| SQUAD_MODE\[S\.mode\] \|\| HERO_MODE\[S\.mode\]/.test(dgSrc));
  ok("K15: the bought plan arms the bar for EVERY key — heroes included",
    !/startsWith\("hero_"\)\) setMode/.test(dgSrc));

  // (d) the renderer: additive divergences only (golden stays green)
  ok("K16: the zone overlay exists with the passed-mask signature",
    /setZone\(on, grid, mask, heightAt, color\)/.test(rSrc));
  ok("K17: the pending ghost scales to the passed footprint",
    /setPending\(on, x, y, z, pts, ringR, color, fp\)/.test(rSrc) &&
    /pendingPad\.scale\.set\(fp\.x, fp\.h \/ 1\.8, fp\.z\)/.test(rSrc));
}
```

## Step 3 — run the suite, expect exactly this

`node scripts/depot-test.mjs` — era 14 shows **17 FAIL, 3 PASS** (K4 passes: the tables are already symmetric; K5/K5b pass: Step 1's pure helper). Every other era stays green. Any deviation from that exact set stops the task.

## Step 4 — the market (market.js)

(:28-30) the three hero K entries and their ruling comment:

```js
  // P7 T9 set the hero tier at K 1 — one hull doubled, two hit the clamp.
  // SUPERSEDED KNOWINGLY (owner, 2026-08-21, mk1.95): hero prices behave
  // like every other price, symmetrically — K 3, the tank family's machine
  // precedent. One shared table, both sides' iron, unchanged below.
  heroBison: 3, heroApc: 3,
  heroMech: 3, // provisional (F5)
```

The old lines (`heroBison: 1, heroApc: 1,` with their two comment lines, and `heroMech: 1,` with its trailing comment) leave. `marketCounts`, `priced`, `computePrices`: untouched.

## Step 5 — the renderer (renderer.js, additive only)

**5a.** (:1313) `let pendingPad = null, ...` line — no change. (:1318) after `let retRing = null;` add:

```js
  let zoneMesh = null; // mk1.95: THE PLACEMENT ZONE — lazy like everything here
```

**5b.** `setPending` (:1375) — signature gains a trailing `fp`; the pad places by it:

(:1375) `setPending(on, x, y, z, pts, ringR, color) {` → `setPending(on, x, y, z, pts, ringR, color, fp) {`

(:1396) `pendingPad.position.set(x, y + 0.9, z);` →

```js
      if (fp) { pendingPad.scale.set(fp.x, fp.h / 1.8, fp.z); pendingPad.position.set(x, y + fp.h / 2, z); }
      else { pendingPad.scale.set(1, 1, 1); pendingPad.position.set(x, y + 0.9, z); }
```

**5c.** After `setPending`'s closing `},` (:1419), before the `setReach` comment (:1420), insert:

```js
    // mk1.95: THE PLACEMENT ZONE — the ground a confirm placement may take,
    // shown while one is armed. Merged translucent quads over the game
    // layer's passed grid mask; rebuilt only at its ~4Hz zone tick. The
    // grid's cells are 2m and ORIENT is quarter-turns, so flat axis-aligned
    // quads at cell-center height are exact.
    setZone(on, grid, mask, heightAt, color) {
      if (!zoneMesh) {
        zoneMesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: 0x7dffa8, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide }));
        zoneMesh.layers.set(1); scene.add(zoneMesh);
      }
      zoneMesh.visible = !!on;
      if (!on) return;
      const pos = [], idx = [];
      const h = grid.cs * 0.5;
      for (let gz = 0; gz < grid.h; gz++) for (let gx = 0; gx < grid.w; gx++) {
        if (!mask[gz * grid.w + gx]) continue;
        const wp = grid.gridToWorld(gx, gz);
        const y = heightAt(wp.x, wp.z) + 0.14;
        const b = pos.length / 3;
        pos.push(wp.x - h, y, wp.z - h, wp.x + h, y, wp.z - h, wp.x + h, y, wp.z + h, wp.x - h, y, wp.z + h);
        idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
      }
      zoneMesh.geometry.dispose();
      zoneMesh.geometry = new THREE.BufferGeometry();
      zoneMesh.geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
      zoneMesh.geometry.setIndex(idx);
      zoneMesh.material.color.setHex(color || 0x7dffa8);
    },
```

## Step 6 — the game layer (DepotGame.jsx)

**6a — imports.** (:21) append `placeZoneMask` to the state.js import list. (:41) remove `parkArmor, parkMech` from the muster.js import (their only callers die in 6b; `armorSpread, armorStable, MECH_SPREAD, musterFreshStart, PICK_POOL` stay).

**6b — the two-tap arm dies.** Delete (:1464-1490) whole — from the `// P7 T9: THE HERO TIER, player-side — a two-tap arm...` comment through `S.buyHero = (key) => { ... };`'s closing. Nothing replaces it here (the hero flow lives in 6e/6f).

**6c — the maps.** After the `SQUAD_MODE` line (:1610) insert:

```js
      // mk1.95 (owner): hero keys are placement modes — the one law.
      const HERO_MODE = { hero_bison: "bison", hero_apc: "apc", hero_mech: "mech" };
      // The ghost's true footprint, by key — a hull its hull, the mech its
      // vetted spread, a tower its post, a squad the stand its men take.
      const ghostFp = (key) => {
        const pk = PICK_POOL.find((x) => x.key === key);
        if (!pk) return null;
        if (pk.kind === "hull") { const s = pk.vtype === "apc" ? APC : BISON; return { x: s.hx * 2, z: s.hz * 2, h: s.hy * 2 }; }
        if (pk.kind === "mech") return { x: MECH_SPREAD.hx * 2, z: MECH_SPREAD.hz * 2, h: 4.2 };
        if (pk.kind === "tower") { const s = TOWER_SPECS[pk.key]; return { x: 1.7, z: 1.7, h: s.hy * 2 }; }
        return { x: 2.2, z: 2.2, h: 1.05 };
      };
```

**6d — the ground tap.** In `tapAt`, after the squad-mode branch's closing (:2362) and before the tower branch (:2363), insert:

```js
        if (HERO_MODE[S.mode]) {
          const price = priceNow(S.mode, PALETTE_BY_KEY[S.mode].cost);
          const v = canPlaceInfantryAt(g.gx, g.gz, price);
          if (!v.ok) { toast(v.msg); return; }
          S.pending = { hero: S.mode, wp: v.wp, y: field.heightAt(v.wp.x, v.wp.z), poly: null, ringR: 0, color: 0x9fdcff, cost: price, armedAt: world.t + PENDING_ARM_S, fp: ghostFp(S.mode) };
          return;
        }
```

**6e — the confirm.** In `confirmPending` (:1602), after the `if (p.hire) ...` line, insert:

```js
        if (p.hero) { if (placeHero(p.hero, p.wp)) S.pending = null; return; }
```

**6f — the placer.** After `placeHire`'s closing `};` (:2689, before `const spawnOne`), insert (mirrors `placeHire`'s hull/mech branches verbatim — the mk1.86 laws hold: price checked first, the ghost STANDS on any refusal, pay only on field):

```js
      // mk1.95 (owner): THE HERO FIELDS BY THE ONE PLACEMENT LAW — the bar
      // arms a mode, the ground tap sets the ghost, the ✓ runs this. The
      // enemy's own heroes keep bell.js's replacement walk at its depot.
      const placeHero = (key, p) => {
        const pk = PICK_POOL.find((x) => x.key === key);
        if (!pk) return true;
        const price = priceNow(key, PALETTE_BY_KEY[key].cost);
        if (S.resources < price) { toast("NO SCRAP"); return false; }
        if (!buyPaced()) return false;
        const g = grid.worldToGrid(p.x, p.z);
        if (!grid.inBounds(g.gx, g.gz)) { toast("OFF THE FIELD"); return false; }
        const cell = grid.cells[grid.idx(g.gx, g.gz)];
        const wp = grid.gridToWorld(g.gx, g.gz);
        const c0 = invW(wp.x, wp.z);
        if (!canBuild(T, c0.u, c0.v)) { toast("GROUND NOT HELD"); return false; }
        if (cell.water || cell.ice || cell.blocked || cell.wallId) { toast("NO GROUND"); return false; }
        if (pk.kind === "mech") {
          if (!(armorSpread(field, wp.x, wp.z, MECH_SPREAD) < 0.28)) { toast("TOO STEEP TO PARK"); return false; }
          if (slotBlockedPublic(world, wp.x, wp.z, 4.5)) { toast("NO ROOM"); return false; }
          const m = buildMech(world, { x: wp.x, z: wp.z, yaw: Math.atan2(-wp.x, -wp.z), team: 1, hp: MECH.hp });
          m.thrustersOn = true; m.thrustAssist = true;
          m.hull.drv = "mech"; m.hull.order = "defend"; m.hull.tracks = "careful";
          m.hull.maxHp = MECH.hp; m.hull.homeX = wp.x; m.hull.homeZ = wp.z;
        } else {
          const spec = pk.vtype === "apc" ? APC : BISON;
          if (!armorStable(field, wp.x, wp.z, spec)) { toast("TOO STEEP TO PARK"); return false; }
          if (slotBlockedPublic(world, wp.x, wp.z, Math.hypot(spec.hx, spec.hz) + 1.0)) { toast("NO ROOM"); return false; }
          const v = addBody(world, { kind: "vehicle", team: 1, mass: spec.mass, hx: spec.hx, hy: spec.hy, hz: spec.hz,
            x: wp.x, y: field.heightAt(wp.x, wp.z) + spec.hy + 0.05, z: wp.z, hp: spec.hp, friction: 0.85,
            q: heading(null, Math.atan2(-wp.x, -wp.z)) });
          v.armor = spec.armor; v.vtype = pk.vtype; v.maxHp = spec.hp;
          v.homeX = wp.x; v.homeZ = wp.z; v.sleeping = true;
          if (pk.vtype === "apc") v.apcSeq = nextApcSeq();
          v.drv = pk.vtype === "apc" ? "apc" : "armor"; v.depotDrive = "auto"; v.order = "defend"; v.tracks = "careful"; v.driver = "player";
        }
        S.resources -= price;
        S._buyAt = world.t;
        cue("uitick");
        toast("THE CONVOY DELIVERS — ◆" + price);
        return true;
      };
      // mk1.95: THE PLACEMENT ZONE — while a confirm placement is armed, the
      // ground it may take is shown: held ground for towers, squads, hires
      // and heroes; the homeland ring for the pre-start deal. ~4Hz, wall time.
      const refreshZone = () => {
        if (!R) return;
        const dealPhase = !S.started && S._placeQueue && S._placeQueue.length;
        const armed = dealPhase || S.hirePlace || (S.mode && (TOWER_SPECS[S.mode] || SQUAD_MODE[S.mode] || HERO_MODE[S.mode]));
        if (!armed || S.gameOver || S.victory) { R.overlay.setZone(false); return; }
        const heldAt = dealPhase
          ? (x, z) => Math.hypot(x - depotP.x, z - depotP.z) <= HOMELAND_R
          : (x, z) => { const c = invW(x, z); return canBuild(T, c.u, c.v); };
        R.overlay.setZone(true, grid, placeZoneMask(grid, heldAt), (x, z) => field.heightAt(x, z), dealPhase ? 0x4aff8c : 0x7dffa8);
      };
```

**6g — the small edits, each exact:**

| Anchor | Old | New |
|---|---|---|
| :1104, after `let terrAcc = 0;` | — | new line `let zoneAcc = 0.25; // mk1.95: the zone's own wall-time accumulator — starts due` |
| :2262 deal pending literal | `... armedAtWall: performance.now() / 1000 + PENDING_ARM_S };` | append before ` };`: `, fp: ghostFp(S._placeQueue[0])` |
| :2270 hire pending literal | `... armedAt: world.t + PENDING_ARM_S };` | append before ` };`: `, fp: ghostFp(S.hirePlace.key)` |
| :2615-2616 pickManifest | `// P7 T17 (owner): THE PICK ARMS THE BAR — hero keys stay two-tap buys.` + `if (!key.startsWith("hero_")) setMode(key);` | `// mk1.95 (owner): THE PICK ARMS THE BAR — every key; hero keys are placement modes under the one law now.` + `setMode(key);` |
| :3587, before `if (S.pending) {` | — | insert:<br>`// mk1.95: THE PLACEMENT ZONE — its own ~4Hz WALL-time tick (the deal`<br>`// phase runs with the sim frozen, so sdt can never drive it).`<br>`zoneAcc += dt;`<br>`if (zoneAcc >= 0.25) { zoneAcc = 0; refreshZone(); }` |
| :3589 pending render call | `R.overlay.setPending(true, P0.wp.x, P0.y, P0.wp.z, P0.poly, P0.ringR, P0.color);` | `R.overlay.setPending(true, P0.wp.x, P0.y, P0.wp.z, P0.poly, P0.ringR, P0.color, P0.fp);` |
| :3919-3922 setMode | the three comment lines (`// P7 T9: hero keys are a two-tap ARM/BUY...` through `// is ever touched.`) + `if (m === "hero_bison" \|\| m === "hero_apc" \|\| m === "hero_mech") { if (S.buyHero) S.buyHero(m); return; }` | one comment line: `// mk1.95: hero keys are ordinary placement modes — no special case.` |
| :757-759 PALETTE comment | `// P7 T9: THE HERO TIER — bell 10, both ladders. Bar-visible only once`<br>`// unlocked like everything else; the buy is a two-tap arm (S.buyHero),`<br>`// never a build mode.` | `// P7 T9: THE HERO TIER — bar-visible only once unlocked like everything`<br>`// else. mk1.95: hero keys are placement modes under the one law.` |
| :992 hoist comment | `// P7 T9 (owner): HOISTED TO MOUNT SCOPE — parkArmor/apcSeqN/depotP/` | `// P7 T9 (owner): HOISTED TO MOUNT SCOPE — apcSeqN/depotP/` |
| :1190-1191 comment | `// free starting armor die here. seedBags/parkArmor stay exported`<br>`// (parkArmor still parks the hero tier's buys and the enemy's` | `// free starting armor die here. seedBags/parkArmor stay exported`<br>`// (parkArmor still parks the enemy's` |
| :1468 comment | dies inside 6b's deleted block | — |

After 6g, `grep -n "buyHero\|heroArm\|HERO_ARM_S\|parkArmor\|parkMech" src/depot/DepotGame.jsx` must return nothing (K6 enforces the first three; the last two confirm 6a).

## Step 7 — the re-teach ledger (behavior re-teaches ruled above, each reported old → new)

| Site | Old | New |
|---|---|---|
| `scripts/tests/07-armor-demolition.mjs:1144` | `ok("T9(c3): one standing bison at least doubles the price (either team, one shared market)", p1.player.hero_bison >= 2 * 200, p1.player.hero_bison);` | `ok("T9(c3) (re-taught mk1.95): one standing bison prices 240 — the ordinary curve at K 3 (owner supersedes the K-1 wall)", p1.player.hero_bison === 240, p1.player.hero_bison);` |
| `scripts/tests/12-the-mech.mjs` M26 (:315-317) | label `...one standing machine doubles it`; cond `p1.player.hero_mech === MECH.cost * 2` (:316) | label `...one standing machine prices 480 (K 3, mk1.95)`; cond `p1.player.hero_mech === Math.round(MECH.cost * 1.2)` |
| `scripts/tests/08-debug-pass.mjs:481` | `ok("T17(b): the pick arms the bar, heroes stay two-tap", /if \(!key\.startsWith\("hero_"\)\) setMode\(key\);/.test(dgSrc17));` | `ok("T17(b) (re-taught mk1.95): the pick arms the bar for every key — heroes are placement modes", !/startsWith\("hero_"\)\) setMode/.test(dgSrc17) && /PLANS BOUGHT ◆" \+ price\);[\s\S]{0,240}setMode\(key\);/.test(dgSrc17));` |

T9(c), T9(c5), K4's law (both sides' iron in one table) stand unchanged — only the K value moved. Every other suite failure stops the task.

## Step 8 — the gates (run ONLY these)

- `node scripts/depot-test.mjs` — **exactly 1695 PASS, 0 FAIL** (1675 + era 14's 20; the three re-teaches count-neutral).
- `node scripts/golden.mjs` — 7/7 (the renderer divergence is additive; the demo cannot move).
- `node scripts/depot-lint.mjs` — clean (the task draws no rng).
- The standing smoke run — `npm run build && npm run preview`, then `node scripts/smoke.mjs` — green; kill the preview after.

Any failure outside this plan's named expectations stops the task.

## Step 9 — the landing

`src/version.js` → `mk1.95`; build AFTER the bump; commit; push. The report names the era's seedlessness (stub grid, pure arithmetic — no fixture seed drawn), every re-teach old → new, and every deviation as its own labeled bullet.

**The owner's live check** (look and feel are his alone, phone AND desktop): arming any tower, squad, hire, or hero shows the held-ground zone; the pre-start deal shows the homeland ring; hire, deal and hero ghosts are footprint-true; the hero flow is slot → ground tap → ghost → ✓; a Bison beside the enemy's standing Bison prices ◆240-ish, not ◆429; the zone's color and weight are his call at the live check.

## Named exclusions

- Walls, sandbags, and engineer lines keep their instant flows — no zone, no ghost change (ruling 2).
- The desktop hover ghost in hero mode keeps the plain cell pad — the footprint ghost appears at the pending, same as squads.
- The enemy's hero placement doctrine (depot park via `bell.js`) — capability symmetric, doctrine untouched, named in the symmetry note.
- The zone's rendering cost rides a ~4Hz rebuild; if his live check finds hitching on phone, the fix is its own polish-queue item, not folded in.
