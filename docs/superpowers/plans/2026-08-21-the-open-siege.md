# THE OPEN SIEGE AND THE HONEST ZONE — task plan (proposed mark mk1.96)

*Written 2026-08-21 on the owner's word. One task. Suggested model: Sonnet — every step is specced to the code with exact text and measured numbers; the agent executes, never designs.*

## The rulings (owner, 2026-08-21 — this plan's design truth)

1. **"LEAVE THEM A ROAD" IS EXPUNGED.** The attacker can attack walls; a sealed map is its problem, not a rule's. The connectivity refusal leaves every build path. The GENERATOR's connectivity law (a fresh map must be walkable) is a different law and stands.
2. **THE SIEGE FLOW.** Ground the objective cannot be reached from owes the assault a direction: the player's own masonry. The flow field gains a second flood over unreachable ground, seeded from every open cell beside a player claim, so the march walks to the wall's face and halts there — where the standing behaviors (riflemen halting to work, grenadier lobs, sapper satchels, tank guns) already engage. Without this, a sealed map dissolves the assault: today every unit on flowless ground is written off by the 12-second lost clock, and sealing would be a free win.
3. **THE ZONE TELLS EACH UNIT'S OWN TRUTH, LIVE** (owner: full live legality). A hull's zone drops ground too steep to park (`armorStable`) and ground its clearance cannot fit this instant; the mech likewise with its spread and its 4.5 m room; squads and towers keep the shared laws (their placers have no steepness or room refusal). The tap-time checks stay the final authority.
4. **SYMMETRY:** the siege flow serves the attacker (the only side that marches a flow field); the zone serves the defender's hand (the only side that places by hand). Each is one side's whole mechanism, both sides' capabilities unchanged. The 12-second write-off stays, both kinds, for truly flowless pockets.

## Plan verification (already run by the plan-writer)

Steps 1, 4 and 5 (the room mask, the extended zone mask, the siege flow, the tank's stand) were applied to the live tree, measured, and reverted — every number below is measured, not estimated:

- Era 15's eight functional asserts (O3-O7) were EXECUTED against the probe tree and all passed: seed 23 sealed at grid row 39 floods 3,421 pseudo-flow cells onto 90 face seeds, all resting at zero descent, 0 bad descents, 3/3 spawns on marching ground, 0 cells left lost; one breached cell re-floods the real march to 3/3 spawns; the tank stands and sheds its lost clock on resting flow and still writes off at 12 s on flowless ground; the room mask agreed with `slotBlocked` on ALL 8,100 cells; the vet/room mask arithmetic landed exactly (11 cells).
- The full suite ran green against the probe tree: **1695 PASS, 0 FAIL** (era 14 included — the optional-parameter extension moves nothing), and `depot-lint` stayed clean.
- Every source-pin regex in era 15 (O8, O9) and both era-14 K14 pins were self-tested against this plan's own replacement code — all match.

## Dials (provisional, F5)

| Dial | Value |
|---|---|
| Pseudo-flood base distance | 1e6 (under the 1e8 pathable line, over any real distance; the regions are sealed from each other so the floods cannot mix) |
| Hull room clearance | `Math.hypot(spec.hx, spec.hz) + 1.0` (the placer's own) |
| Mech room clearance | 4.5 (the placer's own) |

## Required reading (agent, before any code; anchors re-verified at dispatch)

This plan whole; `CLAUDE.md`; `src/depot/mapgen.js` — `computeFlowField` (:534-571), `checkConnectivity` (:572-585), `makeMap`'s acceptance (:295-305 region); `src/depot/DepotGame.jsx` — the mapgen import (:40), the squads import (:25), `buildAt`'s refusal (:1477-1482), `placePick`'s tower branch (:1665), `placeHire`'s tower branch (:2666), `refreshZone` (:2725-2734), `HERO_MODE`/`ghostFp` (:1584-1594); `src/depot/state.js` — `placeZoneMask` (:89-98); `src/depot/squads.js` — `slotBlocked` (:192-212), `slotBlockedPublic` (:225), `SOLID_KINDS` (:102); `src/depot/drivers.js` — `tankGoal` (:20-33); `src/depot/muster.js` — `armorStable`/`armorSpread` (:39-48); `scripts/tests/14-the-placement-law.mjs` (context: K5 and K14 pins this task must keep green); `scripts/depot-test.mjs`; `scripts/tests/harness.mjs`. The agent's report opens by confirming this list was read.

## Trap notes

- **Era 14 stays green untouched.** K5 calls `placeZoneMask(grid, heldAt)` — the two new parameters are optional and change nothing when absent. K14 pins two literal lines of `refreshZone` — Step 6's replacement KEEPS both lines verbatim (`const dealPhase = ...` and the `TOWER_SPECS[S.mode] || SQUAD_MODE[S.mode] || HERO_MODE[S.mode]` chain).
- **`roomMaskPublic` lives in squads.js beside `slotBlocked`** — it reads the same two pools and `SOLID_KINDS` (module-private; state.js must not gain a squads import). Its box test is `slotBlocked`'s verbatim, minus the rim and water lines a bare fixture skips anyway — the equivalence assert (O6) rides a bare world for exactly that reason.
- **The pseudo-flood touches ONLY cells with `dist >= 1e8`** — real-flow ground is byte-identical, which is why the whole suite stayed green in the probe.
- **`tankGoal`'s new stand branch also covers the objective cell** (descent zero at dist 0) — the old code sent a tank standing exactly there into the lost clock; the amendment closes that edge knowingly.
- **After Step 6, `checkConnectivity` has no caller left in DepotGame.jsx** — it leaves the :40 import list (O1 greps the whole source for it). The generator's own calls live inside mapgen.js and stand (O2 pins one).
- **`ColdsnapTD.jsx` keeps its own "Leave them a road"** — the frozen tower-defense reference is untouched; O1 reads only DepotGame source.
- **Era 15's O4 and O5b pass BEFORE the implementation too** — they pin standing law (breach re-flood; the lost write-off), not new behavior. The failing-first split is exact and named in Step 3.
- **Fixture seeds: 23 (the sealed map), 41 (the room-equivalence world), 44 (the tank write-off world)** — named here, named in the report; no seed is special.

---

## Step 1 — the pure pieces (squads.js, state.js)

**1a.** `src/depot/squads.js`, after the `slotBlockedPublic` line (:225):

```js
// mk1.96: THE ROOM MASK — the zone's live-room truth at O(bodies + cells),
// never bodies x cells. One pass over the same two pools slotBlocked reads,
// each solid's clearance-inflated box rasterized onto the movement grid; a
// cell is roomed out when its CENTER lies inside any inflated footprint —
// slotBlocked's own box test, verbatim, minus the rim and water lines a
// bare fixture skips anyway (the zone's caller masks those separately).
export function roomMaskPublic(world, grid, clear) {
  const m = new Uint8Array(grid.w * grid.h);
  const stamp = (b) => {
    const ex = b.hx + clear, ez = b.hz + clear;
    const a = grid.worldToGrid(b.pos.x - ex, b.pos.z - ez);
    const b2 = grid.worldToGrid(b.pos.x + ex, b.pos.z + ez);
    const gx0 = Math.max(0, Math.min(a.gx, b2.gx)), gx1 = Math.min(grid.w - 1, Math.max(a.gx, b2.gx));
    const gz0 = Math.max(0, Math.min(a.gz, b2.gz)), gz1 = Math.min(grid.h - 1, Math.max(a.gz, b2.gz));
    for (let gz = gz0; gz <= gz1; gz++) for (let gx = gx0; gx <= gx1; gx++) {
      const wp = grid.gridToWorld(gx, gz);
      if (Math.abs(wp.x - b.pos.x) <= ex && Math.abs(wp.z - b.pos.z) <= ez) m[gz * grid.w + gx] = 1;
    }
  };
  const pool = world._L ? world._L.statics : world.bodies;
  for (const b of pool) { if (b.alive && !(b.invM > 0) && SOLID_KINDS.has(b.kind)) stamp(b); }
  const vpool = world._L ? world._L.vehicles : world.bodies;
  for (const b of vpool) { if (b.alive && (b.kind === "vehicle" || b.kind === "mech")) stamp(b); }
  return m;
}
```

**1b.** `src/depot/state.js` (:89-98) — `placeZoneMask` gains two optional parameters; two-argument callers are unchanged:

```js
export function placeZoneMask(grid, heldAt, vetAt, room) {
  const m = new Uint8Array(grid.w * grid.h);
  for (let gz = 0; gz < grid.h; gz++) for (let gx = 0; gx < grid.w; gx++) {
    const ci = grid.idx(gx, gz);
    const c = grid.cells[ci];
    if (c.blocked || c.wallId || c.ice || c.water) continue;
    if (room && room[ci]) continue;
    const wp = grid.gridToWorld(gx, gz);
    if (!heldAt(wp.x, wp.z)) continue;
    if (vetAt && !vetAt(wp.x, wp.z)) continue;
    m[ci] = 1;
  }
  return m;
}
```

(The old body — the plain `if (heldAt(...)) m[...] = 1;` loop — is replaced whole.)

## Step 2 — asserts first: era 15

New file `scripts/tests/15-the-open-siege.mjs`, registered in `scripts/depot-test.mjs` after era 14 (`await import("./tests/15-the-open-siege.mjs");` before `finish()`):

```js
// COLDSNAP suite era 15 — THE OPEN SIEGE AND THE HONEST ZONE (mk1.96).
// "Leave them a road" is expunged; unreachable ground floods a pseudo-flow
// onto the player's masonry so a sealed map is besieged, not evaporated;
// the placement zone tells each unit's own truth, live. Fixture seeds: 23
// (the sealed map), 41 (the room-equivalence world), 44 (the tank
// write-off world). No seed is special.
import { ok } from "./harness.mjs";
import { identFwdDir } from "./shared.mjs";
import fs from "node:fs";
import { makeMap, makeGrid, computeFlowField, OBJ_POS, SPAWN_POINTS, GRID_W, GRID_H } from "../../src/depot/mapgen.js";
import { makeWorld, addBody } from "../../src/engine/core.js";
import { slotBlockedPublic, roomMaskPublic } from "../../src/depot/squads.js";
import { placeZoneMask } from "../../src/depot/state.js";
import { DRIVERS } from "../../src/depot/drivers.js";

{
  console.log("\n[era 15: the open siege and the honest zone]");
  const dgSrc = fs.readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");
  const mgSrc = fs.readFileSync(new URL("../../src/depot/mapgen.js", import.meta.url), "utf8");

  // (a) the rule is gone from the player's hand; the generator keeps its own
  ok("O1: the road rule is expunged — no refusal, no connectivity in the game layer",
    !/Leave them a road/.test(dgSrc) && !/checkConnectivity/.test(dgSrc));
  ok("O2: the generator's walkable-map law stands untouched",
    /checkConnectivity\(g, SPAWN_POINTS, og\.gx, og\.gz\)/.test(mgSrc));
  ok("O9: the siege flow's second flood exists (the 1e6 seed line)",
    /cells\[ci\]\.dist = 1e6/.test(mgSrc));

  // (b) the sealed map, functional — seed 23, a full player wall row
  {
    makeMap(23);
    const g = makeGrid(null);
    const og = g.worldToGrid(OBJ_POS.x, OBJ_POS.z);
    const sg = g.worldToGrid(SPAWN_POINTS[0].x, SPAWN_POINTS[0].z);
    const sealGz = Math.round((og.gz + sg.gz) / 2);
    for (let gx = 0; gx < GRID_W; gx++) {
      const c = g.cells[g.idx(gx, sealGz)];
      c.blocked = true; c.wallId = 90000 + gx; c.bTeam = 1;
    }
    computeFlowField(g, og.gx, og.gz);
    let pseudo = 0, unreachable = 0, faceSeeds = 0, faceZeroDesc = 0, descentBad = 0;
    for (let gz = 0; gz < GRID_H; gz++) for (let gx = 0; gx < GRID_W; gx++) {
      const c = g.cells[g.idx(gx, gz)];
      if (c.blocked) continue;
      if (c.dist >= 1e8) { unreachable++; continue; }
      if (c.dist >= 1e6) {
        pseudo++;
        if (c.dist === 1e6) { faceSeeds++; if (!c.dx && !c.dz) faceZeroDesc++; }
        else {
          const nc = g.cells[g.idx(gx + Math.round(c.dx), gz + Math.round(c.dz))];
          if (!(nc && nc.dist < c.dist)) descentBad++;
        }
      }
    }
    let spawnsOn = 0;
    for (const sp of SPAWN_POINTS) {
      const s = g.worldToGrid(sp.x, sp.z);
      const c = g.cells[g.idx(s.gx, s.gz)];
      if (c && c.dist >= 1e6 && c.dist < 1e8) spawnsOn++;
    }
    ok("O3: a sealed map floods pseudo-flow onto the wall's face", pseudo > 500 && faceSeeds > 0, `${pseudo} cells, ${faceSeeds} seeds`);
    ok("O3b: the pseudo descent runs strictly downhill and rests at the face",
      pseudo > 0 && descentBad === 0 && faceZeroDesc === faceSeeds, `${descentBad} bad, ${faceZeroDesc}/${faceSeeds} resting`);
    ok("O3c: every spawn stands on marching ground; no open cell is left lost",
      spawnsOn === SPAWN_POINTS.length && unreachable === 0, `${spawnsOn}/${SPAWN_POINTS.length} spawns, ${unreachable} lost`);
    // one breach: a single cell of the seal falls — the real march returns
    const bc = g.cells[g.idx(45, sealGz)];
    bc.blocked = false; bc.wallId = null; bc.bTeam = 0;
    computeFlowField(g, og.gx, og.gz);
    let spawnsReal = 0;
    for (const sp of SPAWN_POINTS) {
      const s = g.worldToGrid(sp.x, sp.z);
      const c = g.cells[g.idx(s.gx, s.gz)];
      if (c && c.dist < 1e6) spawnsReal++;
    }
    ok("O4: one breach re-floods the real march to every spawn", spawnsReal === SPAWN_POINTS.length, `${spawnsReal}/${SPAWN_POINTS.length}`);
  }

  // (c) the tank at the face — stands and guns, never lost
  {
    const gridStand = { cellAt: () => ({ dist: 1e6, dx: 0, dz: 0 }) };
    const t = { pos: { x: 7, z: -4 }, lostT: 5 };
    DRIVERS.waveArmor.goal({}, gridStand, t, 1 / 60, identFwdDir);
    ok("O5: a tank on resting flow stands its ground and sheds the lost clock",
      !!t.goal && t.goal.x === 7 && t.goal.z === -4 && t.lostT === 0, JSON.stringify(t.goal));
    const gridLost = { cellAt: () => ({ dist: 1e9, dx: 0, dz: 0 }) };
    const w2 = makeWorld({ field: { heightAt: () => 0 }, seed: 44 });
    const t3 = addBody(w2, { kind: "vehicle", team: 2, mass: 2600, hx: 1.6, hy: 1, hz: 3, x: 0, y: 1, z: 0, hp: 60 });
    for (let i = 0; i < 800; i++) DRIVERS.waveArmor.goal(w2, gridLost, t3, 1 / 60, identFwdDir);
    ok("O5b: truly flowless ground still writes the tank off at 12s", !t3.alive || t3.hp <= 0, `hp=${t3.hp} alive=${t3.alive}`);
  }

  // (d) the room mask — one law with slotBlocked, at raster speed
  {
    makeMap(23);
    const g6 = makeGrid(null);
    const w6 = makeWorld({ field: { heightAt: () => 0 }, seed: 41 });
    const chunk = addBody(w6, { kind: "chunk", team: 1, mass: 0, hx: 1.1, hy: 0.5, hz: 0.7, x: 12, y: 0.5, z: -8, hp: 40 });
    const veh = addBody(w6, { kind: "vehicle", team: 1, mass: 2600, hx: 1.6, hy: 1, hz: 3, x: -20, y: 1, z: 14, hp: 300 });
    const clear = 2.1;
    const rm = roomMaskPublic(w6, g6, clear);
    let mismatches = 0;
    for (let gz = 0; gz < g6.h; gz++) for (let gx = 0; gx < g6.w; gx++) {
      const wp = g6.gridToWorld(gx, gz);
      if (!!rm[g6.idx(gx, gz)] !== slotBlockedPublic(w6, wp.x, wp.z, clear)) mismatches++;
    }
    ok("O6: the room mask agrees with slotBlocked on every cell (bare world)", mismatches === 0 && !!chunk && !!veh, `${mismatches} mismatches`);
  }

  // (e) the mask honors the per-unit vet and the room knockout
  {
    const cells7 = []; for (let i = 0; i < 16; i++) cells7.push({ blocked: false, wallId: null, ice: false, water: false });
    const g7 = { w: 4, h: 4, cs: 2, cells: cells7, idx: (gx, gz) => gz * 4 + gx, gridToWorld: (gx, gz) => ({ x: gx * 2, z: gz * 2 }) };
    const room7 = new Uint8Array(16); room7[g7.idx(2, 2)] = 1;
    const m7 = placeZoneMask(g7, () => true, (x, z) => x < 6, room7);
    let n7 = 0; for (let i = 0; i < 16; i++) n7 += m7[i];
    ok("O7: the mask honors the per-unit vet and the room knockout", n7 === 11 && m7[g7.idx(3, 1)] === 0 && m7[g7.idx(2, 2)] === 0, `${n7} cells`);
  }

  // (f) the zone reads the armed unit — source pins
  ok("O8: hulls vet flat parking and their clearance; the mech its spread and 4.5m",
    /vetAt = \(x, z\) => armorStable\(field, x, z, spec\)/.test(dgSrc) &&
    /roomMaskPublic\(world, grid, Math\.hypot\(spec\.hx, spec\.hz\) \+ 1\.0\)/.test(dgSrc) &&
    /armorStable\(field, x, z, MECH_SPREAD\)/.test(dgSrc) &&
    /roomMaskPublic\(world, grid, 4\.5\)/.test(dgSrc));
}
```

## Step 3 — run the suite, expect exactly this

`node scripts/depot-test.mjs` — era 15 shows **7 FAIL, 5 PASS**: FAIL O1, O3, O3b, O3c, O5, O8, O9 (the new behavior); PASS O2, O4, O5b, O6, O7 (standing law and Step 1's pure pieces). Every other era green, era 14 included. Any deviation from that exact set stops the task.

## Step 4 — the siege flow (mapgen.js, the probe-proven insert)

In `computeFlowField`, the dx/dz descent pass currently opens (:558):

```js
  for (let gz = 0; gz < GRID_H; gz++) for (let gx = 0; gx < GRID_W; gx++) {
    const ci = grid.idx(gx, gz);
    if (cells[ci].blocked || cells[ci].dist >= 1e8) continue;
```

Directly ABOVE that pass, insert:

```js
  // mk1.96: THE SIEGE FLOW (owner — "Leave them a road" expunged). Ground the
  // objective cannot be reached from still owes the assault a direction: the
  // player's own masonry. Every unreachable open cell beside a player claim
  // (blocked, bTeam 1 — walls, towers, the depot's stones) seeds a second
  // flood at a 1e6 base — far under the 1e8 pathable line, far over any real
  // distance, and the two regions are sealed off from each other by
  // definition, so the floods never mix. The march walks its pseudo-flow to
  // the wall's face and halts there (a seed cell's descent rests at zero);
  // the guns, satchels and rams already know the rest. A breach re-floods
  // real distances through the gap on the standing recomputeFlow calls.
  const q2 = [];
  for (let gz = 0; gz < GRID_H; gz++) for (let gx = 0; gx < GRID_W; gx++) {
    const ci = grid.idx(gx, gz);
    if (cells[ci].blocked || cells[ci].dist < 1e8) continue;
    let seed = false;
    for (const d of dirs) {
      const nx = gx + d[0], nz = gz + d[1];
      if (!grid.inBounds(nx, nz)) continue;
      const nc = cells[grid.idx(nx, nz)];
      if (nc.blocked && nc.bTeam === 1) { seed = true; break; }
    }
    if (seed) { cells[ci].dist = 1e6; q2.push({ gx, gz }); }
  }
  head = 0;
  while (head < q2.length) {
    const cur = q2[head++];
    const cd = cells[grid.idx(cur.gx, cur.gz)].dist;
    for (const d of dirs) {
      const nx = cur.gx + d[0], nz = cur.gz + d[1];
      if (!grid.inBounds(nx, nz)) continue;
      const ni = grid.idx(nx, nz);
      if (cells[ni].blocked) continue;
      if (d[0] !== 0 && d[1] !== 0) {
        if (cells[grid.idx(cur.gx + d[0], cur.gz)].blocked || cells[grid.idx(cur.gx, cur.gz + d[1])].blocked) continue;
      }
      const step = (d[0] !== 0 && d[1] !== 0) ? 1.414 : 1;
      const nd = cd + step * (cells[ni].ice ? 0.72 : 1) * (cells[ni].drop ? 3 : 1);
      if (nd < cells[ni].dist - 1e-6) { cells[ni].dist = nd; q2.push({ gx: nx, gz: nz }); }
    }
  }
```

The descent pass below needs no edit — pseudo cells sit under 1e8 and ride it as-is.

## Step 5 — the tank stands at the face (drivers.js :20-33)

`tankGoal` whole becomes:

```js
function tankGoal(world, grid, t, dt, fwdDir) {
  const cell = grid && grid.cellAt(t.pos.x, t.pos.z);
  if (cell && cell.dist < 1e8) {
    if (cell.dx || cell.dz) {
      const fd = fwdDir(cell.dx, cell.dz);
      t.goal = { x: t.pos.x + fd.x * 9, z: t.pos.z + fd.z * 9 };
    } else {
      // mk1.96: the flow rests at zero on the wall's face (the siege flow's
      // seeds) and at the objective cell itself — stand and gun, never lost.
      t.goal = { x: t.pos.x, z: t.pos.z };
    }
    t.lostT = 0;
  } else {
    // off-grid write-off: same 12s window infantry uses. Without this a
    // tank that wanders off the flow field keeps driving forever — no leak
    // radius ever catches it, and it never dies. Mirrors the infantry lostT.
    t.lostT = (t.lostT || 0) + dt;
    if (t.lostT > 12) applyDamage(world, t, 1e9, { attacker: "world" });
  }
}
```

## Step 6 — the game layer (DepotGame.jsx)

**6a — the three refusals die:**

| Anchor | Old | New |
|---|---|---|
| `buildAt` (:1477-1482) | `cell.blocked = true;` then the five-line `if (!checkConnectivity(...)) { cell.blocked = false; toast("Leave them a road"); return; }` | `cell.blocked = true;` then the comment `// mk1.96 (owner): "Leave them a road" EXPUNGED — a sealed map is the` `// attacker's problem; the siege flow marches it onto the wall.` |
| `placePick` tower branch (:1665) | `if (!checkConnectivity(grid, SPAWN_POINTS, objG.gx, objG.gz)) { cell.blocked = false; toast("Leave them a road"); return; }` | the line is deleted |
| `placeHire` tower branch (:2666) | same line | the line is deleted |

**6b — imports.** (:40) `checkConnectivity` leaves the mapgen import list (no caller remains). (:25) `roomMaskPublic` joins the squads import list.

**6c — `refreshZone` (:2725-2734) whole becomes** (the two era-14-pinned lines survive verbatim):

```js
      const refreshZone = () => {
        if (!R) return;
        const dealPhase = !S.started && S._placeQueue && S._placeQueue.length;
        const armedKey = dealPhase ? S._placeQueue[0]
          : S.hirePlace ? S.hirePlace.key
          : S.mode && (TOWER_SPECS[S.mode] || SQUAD_MODE[S.mode] || HERO_MODE[S.mode]) ? S.mode : null;
        if (!armedKey || S.gameOver || S.victory) { R.overlay.setZone(false); return; }
        const heldAt = dealPhase
          ? (x, z) => Math.hypot(x - depotP.x, z - depotP.z) <= HOMELAND_R
          : (x, z) => { const c = invW(x, z); return canBuild(T, c.u, c.v); };
        // mk1.96 (owner): the zone tells the ARMED unit's own truth — the
        // ground's permanent laws AND the room standing bodies take right
        // now. Hulls vet their flat parking and their clearance; the mech
        // its spread and its 4.5m; squads and towers place by the shared
        // laws alone (their placers refuse on neither slope nor room).
        const pk = PICK_POOL.find((x) => x.key === armedKey);
        let vetAt = null, room = null;
        if (pk && pk.kind === "hull") {
          const spec = pk.vtype === "apc" ? APC : BISON;
          vetAt = (x, z) => armorStable(field, x, z, spec);
          room = roomMaskPublic(world, grid, Math.hypot(spec.hx, spec.hz) + 1.0);
        } else if (pk && pk.kind === "mech") {
          vetAt = (x, z) => armorStable(field, x, z, MECH_SPREAD);
          room = roomMaskPublic(world, grid, 4.5);
        }
        R.overlay.setZone(true, grid, placeZoneMask(grid, heldAt, vetAt, room), (x, z) => field.heightAt(x, z), dealPhase ? 0x4aff8c : 0x7dffa8);
      };
```

## Step 7 — the gates (run ONLY these)

- `node scripts/depot-test.mjs` — **exactly 1707 PASS, 0 FAIL** (1695 + era 15's 12; no re-teach moves a count — no existing assert pins the expunged rule or the old flow).
- `node scripts/depot-lint.mjs` — clean (the task draws no rng).
- The standing smoke run — `npm run build && npm run preview`, then `node scripts/smoke.mjs` — green; kill the preview after.

`golden.mjs` is NOT in this task's gates — core.js and renderer.js are untouched. Any failure outside this plan's named expectations stops the task.

## Step 8 — the landing

`src/version.js` → `mk1.96`; build AFTER the bump; commit; push. The report names the fixture seeds (23, 41, 44), the Step 3 split as run, and every deviation as its own labeled bullet.

**The owner's live check** (his eyes are the acceptance, phone AND desktop): arming the Bison shows only ground flat enough and roomy enough for it — the steep green spots are gone; arming the mech likewise; squads and towers unchanged; a wall line built straight across the map completes without refusal, and the assault masses on its face and works it instead of evaporating; a breach reopens the march.

## Named exclusions

- The gate-log wrapper (`scripts/gate.mjs`) — the owner's approved separate task, not folded in.
- Towers' green cells make no connectivity promise anymore — with the rule expunged there is nothing left to promise; the old honesty gap closes by removal.
- The enemy's placement doctrine and the hire/deal flows beyond the zone's new truth — untouched.
- Zone rebuild cost while a hull or mech is armed (the vet and room passes) — if the owner's phone check finds hitching, that is its own polish-queue item.
