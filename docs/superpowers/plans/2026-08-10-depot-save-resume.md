# DEPOT Save/Resume — Full-Fidelity Stall Snapshot (plan for Jeff's review)

*HISTORY (stamped 2026-08-20, owner's order): this document is a record of shipped work, not authority. Design truth lives in CLAUDE.md and the ACTIVE phase's plan documents; where this file disagrees with them, it is wrong.*

> **For agentic workers:** superpowers:subagent-driven-development, tasks in order, one implementer at a time (S1-S2 share state/DepotGame). Push per task. Iteration budget 3 cycles/task.

**Goal (Jeff, locked):** close the browser mid-run, come back, continue — with the battlefield's scars intact. No clean-ground compromise: masonry damage, displaced rubble, terrain craters, burned/felled trees, and scorch decals all survive the round trip.

**Architecture — delta-vs-seed, captured at the stall.** A stall is the only save point: zero live enemies (Task 6 guarantees it), no projectiles, debris settled/sleeping. We never serialize the whole world — we rebuild from `makeMap(seed)` (deterministic, ids stable by creation order) and apply a recorded DELTA: run state (economy/wave/regiment/record/settings), built things (towers/walls/sandbags/squads + hp/orders), and world scars (dead/displaced chunks, broken welds, tree states, heightfield delta, splat canvas image). Storage: `coldsnap-depot-run` via the platform storage shim; cleared on run end or NEW RUN.

## Size budget (validate in S1, numbers in report)
- Run state + built + squads: ~10-40KB JSON.
- Scars: dead-chunk id list + displaced `{id, pos, q}` (Float32 packed, base64) — worst case few thousand chunks ≈ 100-200KB.
- Heightfield: delta vs fresh `makeMap(seed)` field — sparse (craters only), `{idx, h}` pairs ≈ tens of KB.
- Splat canvas: `canvas.toDataURL("image/png")` of the 1024² splat — mostly-flat imagery compresses well; expect 100-400KB. HARD CHECK: if total > 3MB, downscale splat capture to 512 (visual-only, acceptable); log actual sizes.

## Global Constraints
- Save fires automatically at EVERY stall (after payResults/intel compose — the complete stall state), plus on run end (which clears instead). No mid-wave saves ever.
- Restore = fresh world from seed → apply delta → enter the SAME stall (dispatch card re-shown, ACKNOWLEDGE advances as normal). The wave you were amid when closing is NOT preserved — you resume at its preceding stall (mid-wave state was never saved; this is the design, stated in UI copy: "Position restored to the last field report.").
- Multiplayer explicitly out of scope v1 (local convenience only); the snapshot format gets a `v` version field for forward migration.
- Squad members/bodies restored with hp/orders; territory field NOT serialized — it re-warms from restored emitters in seconds (τ=75s decay is generous; the field at stall ≈ steady-state of standing emitters; assert approximate convergence, not equality).
- Frozen modes untouched; renderer gains only export/import helpers (splat + none else), DEPOT-gated.
- Commit trailer: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

---

### S1: the snapshot writer

**Files:** `src/depot/save.js` (NEW), `src/depot/state.js` (stall hook), `src/render/renderer.js` (splat export), `src/depot/DepotGame.jsx` (collection glue), depot-test.

```js
// src/depot/save.js — collect/apply the run delta. Pure collect(world, S, extras) -> snapshot;
// storage I/O stays in DepotGame (async shim pattern).
export const SAVE_V = 1;
export function collectSnapshot(world, S, { splatDataUrl, heightDelta }) {
  return {
    v: SAVE_V, seed: S.seed, wave: S.ws.waveIdx,
    eco: { scrap: S.resources, lives: S.lives, discipline: S.discipline, fog: S.fogOn },
    reg: { ...S.reg },                       // heads/tanks/scrap/streaks/heads0/tanks0
    record: S.record ?? null, intel: S.ws.lastDispatch ?? null,
    built: world.bodies.filter(isBuiltThing).map(packBuilt),      // towers/walls/sandbags: kind, type, gx/gz or pos, hp
    squads: S.squads.map(sq => ({ ...packSquad(sq),               // type/order/dest/anchor
      members: sq.memberIds.map(id => packMember(world.byId.get(id))) })),  // pos/hp
    scars: {
      deadChunks: world.bodies.filter(c => c.kind === "chunk" && !c.alive).map(c => c.id),
      displaced: packDisplaced(world),       // alive chunks >0.4m from gpos home: {id,pos,q} packed f32/base64
      weldsBroken: packBrokenWelds(world),   // read how welds store state; record broken pairs
      trees: world.bodies.filter(t => t.kind === "tree").map(t => ({ id: t.id, hp: t.hp, burning: t.burning ?? null, alive: t.alive })),
      heightDelta,                            // [{i,h}] vs fresh field — DepotGame computes (it owns both fields)
      splat: splatDataUrl,                    // renderer export
    },
  };
}
```
- Renderer: `exportSplat()` → dataURL; DEPOT-gated, no behavior change.
- Stall hook: after results/intel, DepotGame collects + writes `coldsnap-depot-run` (async, non-blocking; failure logs + toast "FIELD RECORD NOT FILED" once, never crashes the run).
- [ ] Asserts: snapshot round-trips JSON; size logged under budget on a scarred fixture; id determinism (two fresh builds from one seed → identical body id sequence — the load-bearing assumption, PIN IT).

### S2: the restorer + RESUME UI

**Files:** `src/depot/save.js` (applySnapshot), `src/depot/DepotGame.jsx` (boot path), `src/ui/StartScreen.jsx` (RESUME RUN on the DEPOT entry when a save exists), depot-test + smoke.

```js
export function applySnapshot(world, S, snap) {
  // 1. built things: re-place via the same spawn paths (spawnTower/wall/sandbag/squadMembers)
  //    then set hp/orders — NEVER hand-build bodies (one creation path).
  // 2. scars: kill deadChunks by id (silent — no events/smears/bounty: reuse the withdrawal-
  //    style silent exit for the kill, or set alive=false + remove per the corpse path — READ
  //    how dead chunks normally leave and match end-state exactly); displace recorded chunks
  //    (pos/q, wake then let them resettle one tick, then sleep); break recorded welds;
  //    apply tree states; heightDelta onto the field (+ renderer terrain refresh — the rim/
  //    geometry pass must rebuild: find the terrain-rebuild entry point).
  // 3. splat: renderer.importSplat(dataURL) (draws image onto the splat canvas).
  // 4. S: eco/reg/record/wave; enter stall phase with the saved dispatch re-shown.
}
```
- Boot: DEPOT entry with a save → RESUME RUN | NEW RUN choice (NEW clears the key after an armed confirm — the campaign reset pattern).
- [ ] Asserts: full round-trip fixture — build a scarred world (shell a house, crater ground, burn a tree, displace rubble, place towers/squads with damage), save, fresh-rebuild, apply, then COMPARE: body census by kind/alive, hp sums, displaced positions within 0.05m, heightfield exact, wave/eco/reg exact; squads re-order-able post-restore; territory converges within 10 simulated seconds (holderAt matches at 20 sampled build-relevant cells).

### S3: smoke + prod

- Smoke section: play to stall 2 with damage dealt → capture state fingerprint (hash of the S2 comparison set via a debug hook) → reload page → RESUME → fingerprint matches → ACKNOWLEDGE advances into wave 3 normally. Rotated variant for the UI. Screenshots: scarred field before/after reload side-by-side.
- [ ] Full scoped verify + push + foreground CI + prod SMOKE_ONLY=depot ALL PASS.

---
## Self-review notes
- Delta-vs-seed keeps saves small and restores through the ONE creation path per thing — no parallel body-construction code to drift.
- The id-determinism assert (S1) is the keystone; if it ever breaks, restore corrupts silently — hence pinned before any restore code exists.
- Splat/heightfield are the "scars intact" answer to Jeff's no-compromise requirement; debris micro-positions of ALIVE displaced rubble are captured, velocities are not (asleep at stall — zero by definition).
- Deliberate non-goals v1: mid-wave saves, multiplayer snapshot exchange, cross-version migration beyond the v field.
