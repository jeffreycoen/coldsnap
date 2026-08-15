*Part of the P7 phase plan — `2026-08-14-armor-demolition-p7.md` holds the skeleton and binding rulings.*

# Task 6 — The defensive opening (mk1.35) — FULL PLAN

**What it does, in one line:** the enemy fights its opening defensively — half of each early muster digs in at home instead of marching, tapering to nothing by ~bell 8, with the standing garrison capped at 12 — and the precast census gets its teeth back: an upright slid piece still counts as standing, and the fraction is mass-weighted, so leveling a depot takes real demolition again.

**Rulings embedded (owner, 2026-08-15):** half-early/gone-by-8 home share; garrison cap 12 (boot 8 + reinforcement, dead defenders replaced by later bells); census toughening folded in. The live ENGINE FAULT is NOT this task — it stays open pending the owner's screenshot; if the text arrives before dispatch, it amends in here, otherwise it hotfixes separately.

**Suggested model:** Sonnet 5.

**Required reading (re-verified at dispatch):**
- This file whole; the decision record's P7 section (the home-guard and precast entries) and the 2026-08-15 rulings entry this task lands.
- `src/depot/ai.js` whole (planWave's 4-draw contract — untouched by this task; the new pure helpers live beside it).
- `src/depot/state.js` :880-989 (census family — the code this task rewrites) and fireBell (the muster steps).
- `src/depot/DepotGame.jsx` — ringBell whole, the Task 3 garrison boot block (the ring-spawn shape to reuse), spawnOne/nextSpawnTag call sites, TOWN access.
- `src/depot/units.js` — spawnUnit (draw counts), stepRifleman's hold branch, stepGrenadier (NO hold branch — why the home detail is rifle-family only).
- `src/depot/squads.js` :169-191 (clearSlot).
- `.superpowers/diag-precast-knockdown.mjs` — the 6-blast leveling repro this task's census fixture must defeat.
- `scripts/depot-test.mjs` — harness, the P7 T3 home-guard fixtures, the P7 T5 block (its (d) census fixture re-pins here), any assert touching depotStandingFraction/censusDepotChunks.

**Trap notes (binding):**
1. planWave's 4-draw contract is SACRED — the split happens AFTER the muster, game-side, on the composed mix bag. No new draws in ai.js.
2. The home detail is rifle-family tags ONLY ("", fast, heavy, sniper) — grenadiers and sappers have no hold branch and would march off their post. The picker filters; if the bag lacks enough rifle-family tags, the detail is smaller — never substitute.
3. The garrison cap counts LIVE garrison (b.garrison && alive && team 2) at the bell — boot survivors included. Reinforcements past the cap stay in the assault bag.
4. Home spawns draw world-rng through spawnUnit exactly like assault spawns (3 draws/man) — the count is deterministic from the bag + the live census, so streams stay seed-stable. State the draw arithmetic in the report.
5. Census back-compat: rows gain `m` (mass at census time); the fraction weights by `c.m || 1`, so every synthetic fixture census without masses keeps its old arithmetic. The pure-fraction fixtures (T3(c) 0.45/0.35) pass fractions directly and never re-pin.
6. Both depots, one law — the player's census is weighted and upright-tested identically (symmetry).
7. NO engine edits, NO save edits (b.garrison/hold already ride; census rows are rebuilt at boot and restored via save.js's existing cens path — the new `m` field rides its rows: verify save.js's cens() writer carries it or add it to the row shape THERE ONLY if it doesn't; name what you found).
8. Expected re-pins: P7 T5(d)'s displacement fixture (teleported pieces must still read gone under the new upright clause — teleport far AND topple in the fixture); any fixture asserting the old unweighted fraction on real censuses.

## Step 1 — Asserts first (failing)

Append the P7 T6 block before the fails check.

```js
// ==== P7 T6: THE DEFENSIVE OPENING ==========================================
{
  // (a) the share curve, pinned
  ok("T6(a): bell 1 holds half home", Math.abs(homeShare(1) - 0.5) < 1e-9);
  ok("T6(a2): the share tapers 7 points a bell", Math.abs(homeShare(4) - 0.29) < 1e-9);
  ok("T6(a3): gone by bell 8", homeShare(8) === 0 && homeShare(20) === 0);
  // (b) the picker: rifle-family only, front of the bag, deterministic
  {
    const bag = ["gren", "", "fast", "sapper", "", "heavy", "sniper", ""];
    const picked = pickHomeDetail(bag, 3);
    ok("T6(b): picks the first three rifle-family tags", picked.join(",") === ",fast,", JSON.stringify(picked));
    ok("T6(b2): the bag keeps its grenadiers and sappers", bag.includes("gren") && bag.includes("sapper") && bag.length === 5);
    ok("T6(b3): a bag with no riflemen yields an empty detail", pickHomeDetail(["gren", "sapper"], 2).length === 0);
  }
  // (c) the weighted, upright-tolerant census
  {
    const rows = [
      { id: 1, home: { x: 0, y: 0, z: 0 }, m: 750 },   // the panel
      { id: 2, home: { x: 5, y: 0, z: 5 }, m: 100 },   // the crown stone
    ];
    const mk = (bodies) => ({ get: (id) => bodies[id] });
    const up = { alive: true, pos: { x: 2.5, y: 0.2, z: 0 }, R: [1,0,0, 0,1,0, 0,0,1] };       // slid 2.5m, upright
    const flat = { alive: true, pos: { x: 2.5, y: 0.2, z: 0 }, R: [1,0,0, 0,0,1, 0,-1,0] };    // slid and TOPPLED
    const home = { alive: true, pos: { x: 5, y: 0, z: 5 }, R: [1,0,0, 0,1,0, 0,0,1] };
    ok("T6(c): an upright slid panel still stands", depotStandingFraction(rows, mk({ 1: up, 2: home })) === 1);
    const f2 = depotStandingFraction(rows, mk({ 1: flat, 2: home }));
    ok("T6(c2): a toppled panel is gone, and mass rules the fraction", Math.abs(f2 - 100 / 850) < 1e-9, f2);
    ok("T6(c3): massless rows keep the old arithmetic", depotStandingFraction([{ id: 1, home: { x: 0, y: 0, z: 0 } }], mk({ 1: home })) === 0);
  }
  // (d) the siege bar restored: the T5 repro's exact 6-blast batter no longer
  // levels the precast depot (reuse the T5 build + batter shape; assert the
  // weighted fraction stays above 0.40 after those 6 blasts, and that
  // sustained battering — 20+ blasts — still gets it below 0.40 eventually:
  // hard, not impossible).
  // (e) the split at the bell: a synthetic ws with a 12-man bag at bell 1 and
  // 8 live garrison -> the detail is min(round(12*0.5), 12-8) = 4; at bell 1
  // with 12 live garrison -> 0; at bell 9 -> 0.
}
// ==== end P7 T6 ==============================================================
```
((d) reuses the T5 knockdown machinery; (e) drives the exported splitter with a fake live-count, not a browser boot.)

## Step 2 — ai.js: the pure pieces

At the file's tail:

```js
// P7 T6 (mk1.35, owner): THE DEFENSIVE OPENING. Half of an early muster
// stays home and digs in; the share fades to nothing by ~bell 8 and the
// war matures into full assaults. Pure math here — the game layer applies
// it AFTER planWave, so the 4-draw contract above is untouched.
export function homeShare(bell) {
  return Math.max(0, 0.5 - (Math.max(1, bell) - 1) * 0.07); // provisional (F5)
}
// The home detail: rifle-family tags only — grenadiers and sappers carry no
// hold discipline (units.js) and would march off the post. Splices from the
// FRONT of the mix bag (nextSpawnTag pops the back), deterministic.
const HOLD_TAGS = ["", "fast", "heavy", "sniper"];
export function pickHomeDetail(mixBag, n) {
  const out = [];
  for (let i = 0; i < mixBag.length && out.length < n; ) {
    if (HOLD_TAGS.indexOf(mixBag[i]) >= 0) out.push(mixBag.splice(i, 1)[0]);
    else i++;
  }
  return out;
}
export const HOME_GUARD_CAP = 12; // provisional (F5)
```

## Step 3 — state.js: the census gets teeth

censusDepotChunks stamps mass:
```js
    out.push({ id: b.id, home, m: b.mass }); // P7 T6: the fraction weighs mass — a panel outranks a crown stone
```
depotStandingFraction becomes weighted and upright-tolerant (same shape kept, both depots, symmetric):
```js
export const STAND_SLIDE_M = 4;    // P7 T6: an UPRIGHT piece slid this far still stands // provisional (F5)
export const STAND_UPRIGHT = 0.7;  // R[4] above this reads as upright // provisional (F5)
export function depotStandingFraction(census, byId) {
  if (!census || census.length === 0) return 1;
  let stand = 0, total = 0;
  for (const c of census) {
    const w = c.m || 1;
    total += w;
    const b = byId && byId.get ? byId.get(c.id) : null;
    if (!b || b.alive === false) continue;
    const dx = b.pos.x - c.home.x, dy = b.pos.y - c.home.y, dz = b.pos.z - c.home.z;
    const near = Math.sqrt(dx * dx + dy * dy + dz * dz) <= DEPOT_STANDING_TOL;
    // P7 T6 (owner): an upright piece merely SLID is still the building —
    // topple it or bury it to erase it. Horizontal band, small drop, upright.
    const slidUpright = !near && b.R && b.R[4] > STAND_UPRIGHT &&
      Math.hypot(dx, dz) <= STAND_SLIDE_M && Math.abs(dy) < 1.0;
    if (near || slidUpright) stand += w;
  }
  return stand / total;
}
```
(standingStructure — the sappers' plant filter — keeps its tight 1.2 m rule: rubble is a corpse for TARGETING even when the census still counts it; state why in a one-line comment there.)

## Step 4 — DepotGame: the split at the bell

In ringBell, immediately after `fireBell(...)` returns (the ws is full, nothing has walked):
```js
        // P7 T6 (owner): THE DEFENSIVE OPENING — part of an early muster
        // digs in at home instead of marching. Pure post-muster split: no
        // planWave draw moves. Rifle-family only; capped at HOME_GUARD_CAP
        // live defenders; spawn draws (3/man) are deterministic from the
        // bag and the live count.
        {
          const share = homeShare(S.bell);
          if (share > 0 && S.ws.mixBag.length) {
            let liveG = 0;
            for (const b of world.bodies) if (b.garrison && b.alive && b.team === 2) liveG++;
            const want = Math.min(Math.round(S.ws.spawnQueue * share), Math.max(0, HOME_GUARD_CAP - liveG));
            const detail = want > 0 ? pickHomeDetail(S.ws.mixBag, want) : [];
            S.ws.spawnQueue -= detail.length;
            const depotE3 = TOWN.find((tt) => tt.depot && tt.team === 2);
            if (depotE3) {
              const gR3 = Math.hypot(depotE3.nx, depotE3.nz) * MASON.pitch / 2 + 3.5;
              detail.forEach((tag, i) => {
                const a = ((i + liveG) / HOME_GUARD_CAP) * Math.PI * 2 + 1.1;
                const p = clearSlot(world, depotE3.x + Math.sin(a) * gR3, depotE3.z + Math.cos(a) * gR3, 0.28 + 0.35);
                const u = spawnUnit(world, { x: p.x, z: p.z }, tag);
                u.hold = true; u.garrison = true;
              });
            }
          }
        }
```
(`homeShare, pickHomeDetail, HOME_GUARD_CAP` join the ai.js import — DepotGame currently imports nothing from ai.js; add the import line.)

## Step 5 — Version, gates, ship

- `src/version.js`: `"mk1.34"` → `"mk1.35"`.
- Gates, ONLY these: `node scripts/depot-test.mjs`, `node scripts/depot-lint.mjs`, `npm run build` (after the bump), `node scripts/smoke.mjs`. golden NOT run.
- Expected re-pins: P7 T5(d) (the displacement fixture teleports must also topple to read gone); name any other fraction pin old→new.
- Commit the task's files only (src/depot/ai.js, src/depot/state.js, src/depot/DepotGame.jsx, scripts/depot-test.mjs, src/version.js; src/depot/save.js ONLY if trap 7 found the census row's `m` needs carrying — named), push. Message: `the defensive opening: they dig in before they march (mk1.35)` with the standard trailers.
- The owner checks live: rush their corner at bell 1-3 — the muster largely digs in and the welcome is thick; by mid-war the assaults are full-size again; and leveling the precast depot takes a real siege — slid pieces that still stand upright still count, only toppled/buried/scattered ones read as gone.

**Report format:** read-confirmation first; one line of outcome; the draw arithmetic stated; every re-pin old→new named; every deviation its own bullet; smoke stated plainly.
