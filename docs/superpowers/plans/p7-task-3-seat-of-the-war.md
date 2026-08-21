*Part of the P7 phase plan — `2026-08-14-armor-demolition-p7.md` holds the skeleton and binding rulings.*

*HISTORY (stamped 2026-08-20, owner's order): this document is a record of shipped work, not authority. Design truth lives in CLAUDE.md and the ACTIVE phase's plan documents; where this file disagrees with them, it is wrong.*

# Task 3 — The seat of the war (mk1.32) — FULL PLAN

**What it does, in one line:** the depots grow to 12×9×7 and move to opposite corners of the valley; their welds go normal but the breach bar drops to 40% standing — a depot must be really knocked down; and the enemy's home fights back from second zero — an eight-man dug-in home guard off its own regiment books, its own seeded sandbag ring, its Bison armed at post — with the armor parking scan made fail-proof both sides.

**Rulings embedded (all owner, 2026-08-14, in the decision record):** opposite corners, point-symmetric; ~8-man garrison; enemy Bison armed while parked; this task cuts ahead of the APC. Map growth deferred.

**Suggested model:** Sonnet 5 — constants, one generator change, boot wiring; every mechanism exists.

**Required reading (re-verified at dispatch):**
- This section whole; the decision record's SEAT OF THE WAR ruling.
- `src/depot/DepotGame.jsx` — genMap whole (the depot draw, dFoul, benches, T()), makeMap's predicate, buildDepotTerrain's town pads, buildTown (the depot lattice, townBreakF, buttresses, flag), the boot block (parkBison, the seeded-bag ring, S creation and S.reg), stepDepot's stepEnemies call.
- `src/depot/state.js` — DEPOT_STANDING_TOL/DEPOT_BREACH_FRAC/censusDepotChunks/depotStandingFraction/checkDepotBreach/checkEnemyBreach, executeWithdrawal (as Task 2 landed it).
- `src/depot/units.js` — spawnUnit (draw counts), stepRifleman's `u.hold` branch, stepUnits' lost-march fallback.
- `src/depot/drivers.js` — armorGoal's defend branch, armorGuns (attacker by team).
- `src/depot/squads.js` :169-191 (clearSlot export). `src/depot/specs.js` MASON.
- `scripts/depot-test.mjs` — harness, the FRONT T1/T2 blocks (:5332-5468 — the sliced-genMap machinery this task's map asserts ride), any assert touching DEPOT_BREACH_FRAC or depot dims/depth (grep first), the P7 blocks at the tail.
- `src/depot/save.js` :264-271 (mark refusal — mk1.31 saves die, so no migration anywhere).

**Trap notes (binding):**
1. genMap's rng is its own free stream (documented in the file) — the depot draw may change shape and draw count per seed. But WORLD-stream boot draws must stay count-stable: the garrison spawns through spawnUnit (3 world-rng draws per man — jitter x, jitter z, walk phase), exactly 8 men, every seed, unconditionally. The seeded bag rings stay on their own derived streams (mulberry32(MAP_SEED ^ key)), never world.rng.
2. The garrison must not withdraw with a spent assault: `u.garrison` joins executeWithdrawal's exemption line. It must also never lost-march-die: `u.hold` already returns true out of stepRifleman before the lost fallback — verify, don't assume; the fixture proves it.
3. Depot dims flow from the TOWN entry (nx/nz/ny) into townFootprint/buildTown/dFoul/terrain pads automatically — change the ENTRY, chase nothing. The door index moves 4 → 5 (must stay < nx).
4. The FRONT T2 sliced-map asserts likely pin the old depth range (40-50) and depot dims — expected re-pins, named old→new. Grep for any 0.58 literal near DEPOT_BREACH_FRAC asserts — re-pin to 0.40 where found.
5. The parking scan must be FAIL-PROOF: ring first, then a brute nearest-clear-cell sweep within 30m — a Bison and (come Task 4) an APC park on BOTH sides on EVERY seed. The mk1.31 silent `return` on a hemmed ring is the suspected live defect: state in the report whether the widened scan changes any pinned seed's parking.
6. Both depots' seeded-bag rings start OUTSIDE the new, bigger footprint (half-diagonal ~6.2m — the old 6.4m inner radius now grazes the walls; move to ~7.8m+).
7. NO core.js, NO save.js, NO renderer edits. golden not run.
8. Chunk budget: the two grown depots add roughly +250 boot stones. The pool is 3000; the report states the measured boot stone count from the smoke run (the __DEPOT__ stones readout) — if it crowds 3000, stop and report, don't raise the cap.

## Step 1 — Asserts first (failing)

Append the P7 T3 block (`THE SEAT OF THE WAR`) before the fails check. Map asserts ride the same sliced-genMap machinery the FRONT T2 block uses — reuse its extraction helpers verbatim (read that block first; match its call shape exactly).

```js
// ==== P7 T3: THE SEAT OF THE WAR ============================================
{
  // (a) the corners: across 30 seeds — player depot pressed to a corner
  // (|u| >= 34, v >= 44), the enemy's point-symmetric opposite (u2 ~ -u1,
  // same depth band), spacing enormous by construction.
  //   [sliced genMap per the FRONT T2 machinery]
  //   for each seed: m = genMap(seed)
  ok("T3(a): player depot in a corner", Math.abs(m.depotU1) >= 34 && m.depotDepth >= 44);
  ok("T3(a2): enemy depot point-symmetric opposite", Math.abs(m.depotU2 + m.depotU1) <= 8);
  ok("T3(a3): the diagonal front", Math.hypot(m.depotU1 - m.depotU2, 2 * m.depotDepth) >= 100);
  // (b) the grown lattice: both depot town entries 12x9x7, door inside
  ok("T3(b): depots are 12x9x7", both depot entries nx === 12 && nz === 9 && ny === 7 && door < 12);
  // (c) the breach bar: 0.40 — 55% knocked down is not a loss, 65% is
  {
    const S4 = { gameOver: false, victory: false };
    ok("T3(c): 45% standing is not yet a breach", checkDepotBreach(S4, 0.45) === false && !S4.gameOver);
    ok("T3(c2): 35% standing is the fall", checkDepotBreach(S4, 0.35) === true && S4.gameOver && S4.breach);
    const S5 = { gameOver: false, victory: false };
    ok("T3(c3): the enemy falls at the same bar", checkEnemyBreach(S5, 0.35) === true && S5.victory);
  }
  // (d) normal welds: the reinforcement multiplier is gone from the source
  {
    const dgSrc = fs.readFileSync(new URL("../src/depot/DepotGame.jsx", import.meta.url), "utf8");
    ok("T3(d): no depot weld reinforcement survives", !/breakF \* 1\.5/.test(dgSrc));
  }
  // (e) the home guard: a held rifleman stands his ground and fires
  {
    const flatF = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (x, z, o) => { o.x = 0; o.y = 1; o.z = 0; return o; } };
    const w = makeWorld({ field: flatF, seed: 41 }); w.depotCombat = true;
    const g = spawnUnit(w, { x: 0, z: 0 }, "");
    g.hold = true; g.garrison = true;
    const x0 = g.pos.x, z0 = g.pos.z;
    addBody(w, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x: x0, y: 0.74, z: z0 + 9, hp: 500 });
    for (let i = 0; i < 2400; i++) { stepUnits(w, straightGrid(0, 1), identFwdDir, null); stepWorld(w); }
    ok("T3(e): the garrison man holds his post", g.alive && Math.hypot(g.pos.x - x0, g.pos.z - z0) < 2, `${g.pos.x.toFixed(1)},${g.pos.z.toFixed(1)}`);
    ok("T3(e2): and works his rifle", w.events.filter((ev) => ev.type === "muzzle").length > 0);
  }
  // (f) the garrison never breaks contact
  {
    const flatF = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (x, z, o) => { o.x = 0; o.y = 1; o.z = 0; return o; } };
    const w = makeWorld({ field: flatF, seed: 42 }); w.depotCombat = true;
    const g = spawnUnit(w, { x: 0, z: 0 }, ""); g.hold = true; g.garrison = true;
    const marcher = spawnUnit(w, { x: 5, z: 0 }, "");
    const S6 = makeRunState(); S6.reg = fatReg();
    executeWithdrawal(S6, w);
    ok("T3(f): withdrawal sweeps the marcher, spares the garrison", w.byId.has(g.id) && !w.byId.has(marcher.id));
  }
  // (g) the enemy Bison fights from its post: team-2 armor, defend order,
  // fires at a player man in reach, attacker "enemy" (a tdkill never pays
  // the player for his own dead)
  {
    const flatF = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (x, z, o) => { o.x = 0; o.y = 1; o.z = 0; return o; } };
    const w = makeWorld({ field: flatF, seed: 43 }); w.depotCombat = true;
    const v = addBody(w, { kind: "vehicle", team: 2, mass: BISON.mass, hx: BISON.hx, hy: BISON.hy, hz: BISON.hz, x: 0, y: BISON.hy + 0.05, z: 0, hp: BISON.hp, friction: 0.85 });
    v.armor = BISON.armor; v.vtype = "bison"; v.drv = "armor"; v.depotDrive = "auto"; v.tracks = "careful"; v.order = "defend";
    addBody(w, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x: 0, y: 0.74, z: 14, hp: 800 });
    for (let i = 0; i < 900; i++) { stepDrivers(w, undefined, identFwdDir, null, (x, z) => ({ u: x, v: z }), {}); stepWorld(w); }
    ok("T3(g): the parked enemy Bison fires", w.events.filter((ev) => ev.type === "boom" || ev.type === "muzzle").length > 0);
    ok("T3(g2): and holds its post", Math.hypot(v.pos.x, v.pos.z) < 2, v.pos.z.toFixed(1));
  }
}
// ==== end P7 T3 ==============================================================
```
(The (a)/(b) asserts are written against whatever shape the FRONT T2 slicing actually exposes — adapt the access, keep the assertions.)

## Step 2 — genMap: the corners and the grown lattice

The depot draw (genMap's head) becomes:
```js
  // THE SEAT OF THE WAR (P7 T3, owner): the depots press into OPPOSITE
  // CORNERS, point-symmetric — the longest front the square holds. Depth
  // hugs the rim; the u side is drawn once and mirrored with a hair of
  // jitter. genMap's rng is its own free stream — draw shape is ours.
  const depotDepth = 44 + r() * 8;                       // provisional (F5)
  const cornerSide = r() < 0.5 ? 1 : -1;
  const depotU1 = cornerSide * (34 + r() * 14);          // the player's corner
  const depotU2 = -depotU1 + (r() - 0.5) * 8;            // the far corner
```
The two depot town entries grow (both lines):
```js
    { id: "depot", x: depotU1, z: depotDepth, nx: 12, nz: 9, ny: 7, door: 5, depot: true },
    { id: "depot2", x: depotU2, z: -depotDepth, nx: 12, nz: 9, ny: 7, door: 5, depot: true, team: 2 },
```
Nothing else in genMap changes — dFoul, benches, footprints, terrain pads, and the objective all derive from these.

## Step 3 — buildTown: normal welds

The townBreakF line:
```js
    const townBreakF = breakF; // P7 T3 (owner): normal welds — the depot is big, not magic; the breach bar is what makes it a siege
```

## Step 4 — state.js: the bar and the garrison exemption

```js
export const DEPOT_BREACH_FRAC = 0.40; // P7 T3 (owner): really knocked down — was 0.58 // provisional (F5)
```
executeWithdrawal's exemption line widens:
```js
    if (b.vtype === "bison" || b.vtype === "apc" || b.garrison) continue; // starting armor and the home guard are not wave stock
```
(If Task 2's landed line lacks the apc clause because Task 4 hasn't shipped, write it with all three anyway — it is inert until each exists.)

## Step 5 — DepotGame boot: fail-proof parking, the armed post, the guard, both bag rings

**(a) parkBison goes fail-proof and arms the enemy's.** The ring widens (10 → 26) and a brute sweep backstops it; the team-2 branch seats the armor policy at DEFEND:
```js
        const parkBison = (team, depotT) => {
          if (!depotT) return;
          const place = (bx, bz) => {
            const v = addBody(world, { kind: "vehicle", team, mass: BISON.mass, hx: BISON.hx, hy: BISON.hy, hz: BISON.hz,
              x: bx, y: field.heightAt(bx, bz) + BISON.hy + 0.05, z: bz, hp: BISON.hp, friction: 0.85,
              q: heading(null, Math.atan2(-bx, -bz)) });
            v.armor = BISON.armor; v.vtype = "bison"; v.maxHp = BISON.hp;
            v.drv = "armor"; v.depotDrive = "auto"; v.order = "defend"; v.tracks = "careful";
            if (team === 1) v.driver = "player";
            else v.bounty = BISON.bounty; // armed at post (owner) — its commander arrives in Task 6
            return v;
          };
          const clearAt = (bx, bz) => {
            const cell = grid.cellAt(bx, bz);
            if (!cell || cell.blocked || cell.ice || cell.water || cell.wallId) return false;
            if (Math.hypot(bx - OBJ_POS.x, bz - OBJ_POS.z) < 4) return false;
            if (slotBlockedPublic(world, bx, bz, Math.hypot(BISON.hx, BISON.hz) + 0.5)) return false;
            if (world.bodies.some((o) => o.kind === "vehicle" && o.alive && Math.hypot(o.pos.x - bx, o.pos.z - bz) < 7)) return false;
            return true;
          };
          for (let rr = 10; rr <= 26; rr += 1.5) for (let k = 0; k < 16; k++) {
            const az = (k / 16) * Math.PI * 2;
            const bx = depotT.x + Math.sin(az) * rr, bz = depotT.z + Math.cos(az) * rr;
            if (clearAt(bx, bz)) return place(bx, bz);
          }
          // FAIL-PROOF (P7 T3): a hemmed ring must never leave a side tankless
          // (the mk1.31 silent give-up) — brute-sweep the nearest clear cell.
          let best = null, bd = 1e9;
          for (let gz = 0; gz < GRID_H; gz++) for (let gx = 0; gx < GRID_W; gx++) {
            const wp = grid.gridToWorld(gx, gz);
            const d = Math.hypot(wp.x - depotT.x, wp.z - depotT.z);
            if (d > 30 || d < 8) continue;
            if (d < bd && clearAt(wp.x, wp.z)) { bd = d; best = wp; }
          }
          if (best) place(best.x, best.z);
        };
```
(Task 2's enemy branch had no drv — this REPLACES that: the enemy's parked Bison is armed. Task 4's parkArmor generalization builds on this shape at its own dispatch.)

**(b) Both bag rings.** The seeded-bag block generalizes: wrap today's body in `const seedBags = (depotT, streamKey) => { ... }` with `const bagR = mulberry32(MAP_SEED ^ streamKey);` inside, the ring radius grown for the bigger footprint — `const r0 = 7.8 + bagR() * 1.6;` — and call:
```js
        seedBags(TOWN.find((t) => t.depot && t.team !== 2), 0x5ba6);
        seedBags(TOWN.find((t) => t.depot && t.team === 2), 0x5ba7); // P7 T3: their depot was never dressed — symmetry now
```
(roadClear and every other vet stays; the enemy's ring simply runs the same rules on its own ground and its own derived stream.)

**(c) The home guard.** AFTER S is created (S.reg must exist), still fresh-boot-only:
```js
      // P7 T3: THE HOME GUARD (owner) — eight riflemen dug in around the
      // enemy depot from second zero, paid out of the regiment's own books.
      // Fixed azimuths; clearSlot vets the ground; spawnUnit's own jitter is
      // 3 world-rng draws per man, 8 men, every seed — count-stable.
      if (!RES) {
        const depotE2 = TOWN.find((t) => t.depot && t.team === 2);
        if (depotE2) {
          const gR = Math.hypot(depotE2.nx, depotE2.nz) * MASON.pitch / 2 + 3.5;
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2 + 0.39;
            const p = clearSlot(world, depotE2.x + Math.sin(a) * gR, depotE2.z + Math.cos(a) * gR, 0.28 + 0.35);
            const u = spawnUnit(world, { x: p.x, z: p.z }, "");
            u.hold = true; u.garrison = true;
          }
          S.reg.heads = Math.max(0, S.reg.heads - 8); // the books stay honest
        }
      }
```
(`clearSlot` joins the squads.js import; `MASON` is already imported.)

## Step 6 — Version, gates, ship

- `src/version.js`: `"mk1.31"` → `"mk1.32"`.
- Gates, ONLY these: `node scripts/depot-test.mjs`, `node scripts/depot-lint.mjs`, `npm run build` (after the bump), `node scripts/smoke.mjs`. golden NOT run.
- Report the measured boot stone count (the smoke run's __DEPOT__ stones readout) against the 3000 pool — if it crowds the cap, STOP and report.
- Commit the task's files only (DepotGame.jsx, state.js, scripts/depot-test.mjs, src/version.js — plus units.js/drivers.js ONLY if a fixture forces a touch, named), push. Message: `the seat of the war: corner depots, real sieges, a home that fights back (mk1.32)` with the standard trailers.
- The owner checks live: the two depots in opposite corners, visibly bigger; the drive to their corner is a real drive; the welcome is eight dug-in rifles, sandbags, and a live parked Bison; his own Bison's shells now visibly chew their masonry, and the war only ends when a depot is truly leveled (~60% down).

**Report format:** read-confirmation first; one line of outcome; every re-pin old→new named (the FRONT T2 depth/dims pins and any 0.58 literal are expected); every deviation its own bullet; smoke result and the boot stone count stated plainly.
