*Part of the P7 phase plan — the decision record's MINES AND TRIPWIRES ruling binds every dial.*

*HISTORY (stamped 2026-08-20, owner's order): this document is a record of shipped work, not authority. Design truth lives in CLAUDE.md and the ACTIVE phase's plan documents; where this file disagrees with them, it is wrong.*

# Task 10 — Mines and tripwires (mk1.40) — FULL PLAN

**What it does, in one line:** the sapper team lays mines and tripwires on the two-point line — watched points, never physics bodies, invisible to the other side ALWAYS — troops never TRIP their own side's devices, but a tripped blast is a blast: anyone in the area is affected, both sides (owner's 2026-08-17 revision); tripwires fire a flare that lights the fog for the owner plus a small charge, prices ride the market as climbing families, and the enemy sapper brain seeds its approaches and contested ground on count-stable draws.

**Suggested model:** Sonnet 5.

**Required reading (re-verified at dispatch; locate by content):**
- This file; the record's MINES AND TRIPWIRES ruling.
- `src/depot/DepotGame.jsx` — the build-line machinery whole (startBuildLine, linePieces, layPieceAt, S.stepBuildLine, consumeOrderTap's build branches, the squad pie slots), ringBell (the enemy-seeding block slots after the hero-replacement block), stepDepot (the trigger step call site), the RES run-restore.
- `src/depot/squads.js` — the sapper squad's order gates. `src/depot/state.js` — squadFire's sapper skip, fireBell.
- `src/depot/sight.js` — eyeOf/SIGHT.flag (the flare is a temporary invisible flag-kind eye).
- `src/depot/market.js` — fieldPrices (the pattern the mine prices extend).
- `src/render/renderer.js` — setDressing (the pattern R.setMines mirrors), an instanced pool example.
- `src/depot/save.js` — the run block. `src/engine/core.js` explode + applyDamage exports (READ ONLY).
- `scripts/depot-test.mjs` — harness, P7 tail blocks.

**Trap notes (binding):**
1. Mines are GAME-LAYER WATCHED POINTS — no bodies, no grid claims, no connectivity checks, zero engine cost. `S.mines = [{ x, z, team, kind: "mine"|"wire", live }]`, saved via an explicit run field (save.js writer + reader + DepotGame RES line, named), restored verbatim.
2. THE TRIGGER IS THE PROTECTION (owner, 2026-08-17): a device only ever fires on an OTHER-team crosser — but once tripped, the detonation is the engine's own `explode` with REAL damage: anyone in the area is affected, both sides, occlusion and all. No wound filter exists anywhere.
3. INVISIBLE ALWAYS: the renderer draws ONLY team-1 devices (`R.setMines(list)` — a setDressing-style setter; two tiny instanced pools, dark disc for mines, peg pair for wires; called on every lay/trigger/restore). The enemy's are never in the list. Minefields are learned by loss, both directions.
4. THE FLARE: a temporary eye — an invisible `kind: "flag"` body (mass 0, team = the wire's owner, NO flagPole flag so nothing draws) at the spot; the game layer removes it after FLARE_S (6 s, via a `_dieT` field checked in the trigger step). Sight lights the area for the owner on the next sight tick for free. Plus a `{ type: "flare", x, z }` event (renderer/audio ignore unknown types today — the look is a later polish item, note it).
5. TRIGGERS run in a 4 Hz game-layer step (`stepMines(world, S.mines, TERR-cadence)` beside the territory accumulator — NOT per tick): a live device fires when an OTHER-team live unit/vehicle stands within MINE_TRIG 1.4 m / WIRE_TRIG 1.0 m. One blast, then `live = false` (spent devices leave the render list). Deterministic scan order, zero draws.
6. LAYING: the sapper pie gains MINES and WIRES wedges (sappers only — the type check mirrors the engineer build gate), riding the EXACT two-point propose/confirm machinery with new job kinds. layPieceAt's mine branch: no cell claim, no validatePlacement — the men walk the line, one device per cell center, cost deducted at the live market price, skip only water/blocked-terrain cells. A short per-piece pause (0.6 s) rides `_pauseT`.
7. MARKET: families `mine: K 12, wire: K 16` (provisional F5), both sides' LIVE devices counted together; `minePrices(counts)` mirrors fieldPrices off `MINE_COST 6 / WIRE_COST 4` bases (provisional F5). The enemy pays the same table from reg.scrap.
8. ENEMY SEEDING, count-stable: TWO unconditional draws every bell (mineRoll, minePlaceRoll), positioned after Task 9's hero-replacement block. When mineRoll < 0.5 AND this muster's bag holds a sapper AND reg.scrap covers it: lay 3 mines (deduct 3 × price) at deterministic points — candidates = pass points on ITS half (canonical v < 0) plus the territory seam's cell centers (|v| ≤ 0.15 band, sampled every 4th cell); minePlaceRoll indexes the start, the 3 take every Nth candidate (N = floor(len/3) max 1). Draws never vary with eligibility.
9. Draw arithmetic: per-bell unconditional draws go 2 → 4 (ferry pair + mine pair). Boot unchanged. Fixed-seed bell-crossing fixtures recapture if any exist (Task 8 found none — verify again, name any).
10. Sappers under MOVE/ATTACK orders are untouched; the satchel machinery is untouched. NO core.js edits.

## Step 1 — Asserts first (failing)

P7 T10 block, every ok() written against harness shapes:
```js
//  (a) the trigger: a player rifleman standing ON a player mine never trips
//      it (long run, untouched); an enemy conscript walking on DOES — and a
//      player rifleman inside the blast radius at that moment is hurt too
//      (both-sides blast, owner's revision); the mine spends
//  (b) the wire: an enemy crossing fires the flare — a team-1 flag-kind eye
//      appears at the spot, sight lights the cell for team 1 on the next
//      recompute, the crosser takes the small blast, the eye dies at 6 s
//  (c) budgets climb: minePrices with 0 devices = base; with 12 live mines
//      (either side) the mine price doubles
//  (d) enemy seeding: a synthetic bell context with a sapper in the bag and
//      a rich reg lays exactly 3 enemy mines on its half/seam and pays 3x
//      the table; a 0.6 roll lays none; the two draws are consumed either way
//  (e) the save round trip carries S.mines verbatim, live flags included
//  (f) laying: the line kinds produce one device per clear cell, no grid
//      claim (cells stay unblocked), scrap deducted at the live price
//  (g) invisibility: the R.setMines list never contains a team-2 device
//      (pure list-builder assert)
```

## Step 2 — mines.js, the module

New `src/depot/mines.js` — pure over (world, mines):
```js
// COLDSNAP DEPOT — mines.js (P7 T10): watched points, never bodies. The
// TRIGGER is the protection (owner, 2026-08-17): a device fires only on an
// other-team crosser — but a tripped blast is a blast, anyone in the area,
// both sides, through the engine's own explode.
import { explode, addBody } from "../engine/core.js";
export const MINE_TRIG = 1.4, WIRE_TRIG = 1.0, FLARE_S = 6;          // provisional (F5)
export const MINE_BLAST = { r: 3.4, kv: 20, dmg: 90, crater: 0.4 };  // a real blast — anyone in the area (owner) // provisional (F5)
export const WIRE_BLAST = { r: 2.2, kv: 3, dmg: 25, crater: 0 };     // the small charge // provisional (F5)
export const MINE_COST = 6, WIRE_COST = 4;                            // provisional (F5)
export function stepMines(world, mines) {
  // 4 Hz caller cadence. Deterministic order; zero draws.
  for (const m of mines) {
    if (!m.live) continue;
    const trig = m.kind === "wire" ? WIRE_TRIG : MINE_TRIG;
    let hit = null;
    for (const b of world.bodies) {
      if ((b.kind !== "unit" && b.kind !== "vehicle") || !b.alive || b.team === m.team || b.riding) continue;
      if (Math.hypot(b.pos.x - m.x, b.pos.z - m.z) < trig) { hit = b; break; }
    }
    if (!hit) continue;
    m.live = false;
    const gy = world.field.heightAt(m.x, m.z);
    const attacker = m.team === 1 ? "player" : "enemy";
    if (m.kind === "mine") {
      // the trigger was the protection; the blast is a blast (owner, 2026-08-17)
      explode(world, m.x, gy + 0.2, m.z, { ...MINE_BLAST, attacker });
    } else {
      world.events.push({ type: "flare", x: m.x, z: m.z });
      const eye = addBody(world, { kind: "flag", team: m.team, mass: 0, hx: 0.05, hy: 0.05, hz: 0.05, x: m.x, y: gy + 2.5, z: m.z });
      eye.sleeping = true; eye._dieT = world.t + FLARE_S;   // an eye, not a banner: no flagPole, nothing draws
      explode(world, m.x, gy + 0.2, m.z, { ...WIRE_BLAST, attacker });
    }
  }
  // spent flares burn out
  for (let i = world.bodies.length - 1; i >= 0; i--) {
    const b = world.bodies[i];
    if (b.kind === "flag" && b._dieT != null && world.t >= b._dieT) { world.byId.delete(b.id); world.bodies.splice(i, 1); }
  }
}
export function minePrices(counts, priced) { return { mine: priced(MINE_COST, "mine", counts), wire: priced(WIRE_COST, "wire", counts) }; }
```
(The flare eye is a body — the territory flag emitter check in buildEmitters keys `b.kind === "flag"`: EXCLUDE `_dieT` carriers there — a flare must light SIGHT, not push permanent territory. One-line guard, named.)

## Step 3 — market

market.js: MARKET_K gains `mine: 12, wire: 16`; marketCounts counts live devices — it cannot see S.mines (module purity): marketCounts gains an optional third arg `mines` and DepotGame's 1 Hz call passes `S.mines`; counts live per kind, both teams together. Export `priced` (it is module-local — export it) so mines.js's minePrices can ride it; DepotGame computes `S._minePrices` beside `S._market`.

## Step 4 — laying

- The sapper pie (DepotGame squad-radial JSX): `if (sq.sapper)` slots MINES (`icon "◆", kind "mines"`) and WIRES (`icon "⌁", kind "wires"`) — `sapper: sq.type === "sappers"` joins the hud squadSel block; S.orderSquad accepts both kinds with the engineer-build two-tap shape (type-gated to sappers).
- consumeOrderTap's build branch accepts the two kinds (sapper guard); linePieces ghosts them as small flat discs (hx 0.3, hy 0.06) with an amber color; refreshLinePreview's cost reads `S._minePrices`.
- layPieceAt's device branch: no cell claim, no validatePlacement — skip water/blocked-terrain cells only; `S.mines.push({ x: row.x, z: row.z, team: 1, kind, live: true }); S.resources -= price; R.setMines(S.mines);` pause 0.6 s per piece via the existing `_pauseT` hook (constant beside WALL_LAY_PAUSE_S, provisional F5).
- squads.js: the sapper's order gate must ACCEPT the build order kind (verify stepSquad's order list treats "build" generically — it does; the pie gate was the only sapper block; name what you find).

## Step 5 — enemy seeding at the bell

ringBell, after the hero-replacement block — two unconditional draws:
```js
        // P7 T10: THE ENEMY SAPPER BRAIN — two draws every bell (the law);
        // a committed roll seeds three mines on its approaches or the
        // contested seam, paid off the same table.
        {
          const mineRoll = world.rng(), minePlaceRoll = world.rng();
          const price3 = S._minePrices ? S._minePrices.mine * 3 : MINE_COST * 3;
          const hasSapper = S.ws.mixBag.indexOf("sapper") >= 0;
          if (mineRoll < 0.5 && hasSapper && S.reg.scrap >= price3) {   // provisional (F5)
            const cands = [];
            for (const band of PASSES) for (const g of band) { const c = invW(g.x, g.z); if (c.v < 0) cands.push({ x: g.x, z: g.z }); }
            for (let iz2 = 0; iz2 < T.nz; iz2 += 4) for (let ix2 = 0; ix2 < T.nx; ix2 += 4) {
              const vv = T.v[iz2 * T.nx + ix2];
              if (vv > -0.15 && vv < 0.15) { const w2 = fwdU(-T.halfU + (ix2 + 0.5) * T.cs, -T.halfV + (iz2 + 0.5) * T.cs); cands.push({ x: w2.x, z: w2.z }); }
            }
            if (cands.length >= 3) {
              S.reg.scrap -= price3;
              const stride = Math.max(1, Math.floor(cands.length / 3));
              const start = Math.min(cands.length - 1, Math.floor(minePlaceRoll * cands.length));
              for (let k = 0; k < 3; k++) {
                const c3 = cands[(start + k * stride) % cands.length];
                S.mines.push({ x: c3.x, z: c3.z, team: 2, kind: "mine", live: true });
              }
            }
          }
        }
```

## Step 6 — the trigger step, the renderer, the save

- stepDepot (beside the territory accumulator's 4 Hz block): `if (terrGuard > 0) stepMines(world, S.mines);`
- renderer: `R.setMines(list)` — filters `team === 1 && live`, writes two small instanced pools (disc `0x2a2f36`, wire pegs `0x8a7a52`), capacity 96 each, count-clamped. Called at boot/restore, after every lay, and each trigger tick (cheap).
- save.js run writer gains `mines: S.mines.map((m) => ({ x: r3(m.x), z: r3(m.z), t: m.team, k: m.kind, l: m.live ? 1 : 0 }))`; the reader restores the same shape; DepotGame RES gains `S.mines = (r.mines || []).map(...)` + an `R.setMines` call. S's initializer declares `mines: []`.
- buildEmitters' flag clause gains `&& b._dieT == null` (trap: flares light sight, never territory).

## Step 7 — Version, gates, ship

- version mk1.39 → mk1.40. Gates: depot-test, depot-lint, build (after bump), smoke. NOT golden.
- Draw arithmetic in the report: per-bell unconditional 2 → 4; verify no fixed-seed bell fixture pins break (Task 8 found none; check again, name any).
- Commit exactly (src/depot/mines.js new, src/depot/market.js, src/depot/DepotGame.jsx, src/depot/save.js, src/render/renderer.js, src/depot/squads.js only if the order gate needed a touch — named, scripts/depot-test.mjs, src/version.js), push. Message: `mines and tripwires: the ground learns to bite (mk1.40)`.
- Owner's live check, phone and desktop: the sapper pie carries MINES and WIRES; a laid line shows YOUR devices as small discs/pegs; an enemy column walking your field starts dying to ground it cannot see; your men cross your own field untouched; a tripwire crossing lights the fog over the spot for six seconds and wounds the crosser; walking THEIR half, your men start dying to nothing — learned by loss; prices climb as fields grow.

**Report format:** read-confirmation; one line of outcome; the draw arithmetic; every re-pin old→new; every deviation its own bullet; smoke stated plainly.
