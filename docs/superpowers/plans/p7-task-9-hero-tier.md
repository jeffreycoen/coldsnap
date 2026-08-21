*Part of the P7 phase plan — the decision record's TASK 9 RULINGS entry binds every dial.*

*HISTORY (stamped 2026-08-20, owner's order): this document is a record of shipped work, not authority. Design truth lives in CLAUDE.md and the ACTIVE phase's plan documents; where this file disagrees with them, it is wrong.*

# Task 9 — The hero tier and the fielded start (mk1.39) — FULL PLAN

**What it does, in one line:** a fourth tier opens on both ladders at bell 10 — the Bison and the APC as convoy items at ruinous, market-walled prices (a standing hero walls the second to absurdity; in practice you buy back what you lost), delivered parked at the buyer's depot, the enemy replacing draw-free off the same table — and both bases now open with a runner squad and a breaker pair fielded free beside the depot.

**Suggested model:** Sonnet 5.

**Required reading (re-verified at dispatch; locate by content):**
- This file; the record's TASK 9 RULINGS.
- `src/depot/state.js` — TIER_BELLS/ENEMY_TIERS/tierOpenCount/ladderPool/manifestPool/foePool, fireBell's pick step.
- `src/depot/specs.js` — PLAYER_TIERS + the two-ladder table, BISON/APC.
- `src/depot/market.js` — MARKET_K, FAMILY_OF_*, computePrices (the hero rows join here).
- `src/depot/DepotGame.jsx` — PALETTE + the bar's unlocked filter, buyPaced/priceNow, parkArmor (the delivery reuses it), the boot blocks (garrison + armor — the fielded-start additions slot beside them), ringBell (the enemy replacement check slots after the ferry block).
- `src/depot/transports.js` apcSeq handling (a replacement APC needs a FRESH unique seat number — read how apcSeqN is scoped and extend safely across deliveries).
- `src/depot/ai.js` — nothing edited; confirm planWave never sees hero tags.
- `scripts/depot-test.mjs` — harness, the manifest pool fixtures (tier counts re-pin), P7 tail blocks.

**Trap notes (binding):**
1. TIER_BELLS gains a 4th entry `[1, 3, 5, 10]`; ENEMY_TIERS gains `["hero_bison", "hero_apc"]`; PLAYER_TIERS gains `["hero_bison", "hero_apc"]`. Hero tags must NEVER leak into planWave's infantry shopping — INF_TYPES is a fixed list (verify, assert), and the foe pick landing a hero tag is an UNLOCK, not a muster item (nextSpawnTag never sees them: they are not spawn tags; the enemy replacement path below is the only consumer).
2. Market: two new families `heroBison: K 1`, `heroApc: K 1` (pole 2 — ONE standing hull doubles the price and the curve goes vertical approaching two; with the field wall on top, a second hero while yours lives is absurd — the ruling). marketCounts counts vtype bison/apc hulls BOTH teams into the families (one shared market). computePrices prices `hero_bison`/`hero_apc` off BISON/APC base costs: add `BISON.cost = 200; APC.cost = 140;` fields in specs (provisional F5) or a local table in market.js — put the costs ON the specs rows (one source).
3. Player buy: PALETTE gains the two hero rows (icons ⛨/⬒, bar-visible only once unlocked, exactly like everything else); the buy is buyPaced + priced; delivery = parkArmor(1, playerDepot, kind) — NOT tap placement (the confirm flow is skipped: the bar tap buys directly with a toast, mirroring no existing pattern — so ADD a minimal confirm: reuse the pending flow with the depot's own cell? NO — keep it simplest and stated: the bar tap arms a two-tap nothing; instead the hero slot's onClick buys immediately if affordable, with the ARMING toast pattern (a first tap arms for 3s, a second tap within it buys — the menu-exit two-tap pattern, no ground tap involved). Deterministic, no rng.
4. parkArmor must be callable POST-BOOT: it currently lives in the `if (!RES)` boot closure — hoist it to the mount scope (same closure over world/grid/field/TOWN, unchanged body) so both the boot and the delivery call it. A replacement APC takes a fresh apcSeq: apcSeqN becomes a mount-scope counter seeded past any restored seat numbers on RESUME (`apcSeqN = max(existing apcSeq) + 1` at boot — state why: seat collisions would cross-seat riders).
5. Enemy replacement, draw-free, in ringBell after the ferry block: if the enemy's Bison (or APC) is dead/absent, its tier open AND picked (S.foe.unlocked has the tag), and `S.reg.scrap >= priceOf(hero tag)` — deduct and parkArmor(2, enemyDepot, kind). At most one hull per bell (Bison first). Its commander doctrine picks the new hull up automatically (it scans live bodies).
6. THE FIELDED START: in the boot, beside the armor parking — player side: two free squads via makeSquad/spawnSquadMembers ("runners" then "breakers") at clearSlot ring points by the depot, order defend (they join S.squads; no scrap moves). Enemy side: 4 "fast" + 2 "heavy" spawnUnit calls at its depot ring, `u.hold = true; u.garrison = true` (free, NOT booked — starting kit like the armor; 18 world-rng draws, fixed, position after the Task 8 profile draw, documented). The Task 6 reinforcement cap (12) counts them — the enemy home simply doesn't reinforce until attrition; state it.
7. Save: hero unlocks ride the existing manifest/foe serialization untouched; delivered hulls are ordinary bodies. RESUME apcSeq reseed per trap 4.
8. Draw arithmetic changes at BOOT only (+18, fixed); per-bell unchanged. Fixed-seed fixtures that boot the full map recapture — expected re-pins, named.
9. NO core.js edits.

## Step 1 — Asserts first (failing)

P7 T9 block, each ok() written against harness shapes:
```js
//  (a) tiers: TIER_BELLS [1,3,5,10]; hero tags in both ladders' 4th row;
//      manifestPool(unlocked, 9) has no hero; (…,10) offers them
//  (b) planWave never shops heroes: 40 seeded musters at bell 12 with heroes
//      picked — no hero tag in any buys, and nextSpawnTag never yields one
//  (c) the wall: computePrices with zero hulls prices hero_bison at 200;
//      with ONE standing bison (either team) the price at least doubles;
//      with men on the field the field wall multiplies on top
//  (d) enemy replacement: dead enemy Bison + tier open + picked + rich reg
//      -> next bell parks a fresh team-2 bison at its depot, scrap deducted;
//      poor reg -> nothing; APC replacement takes a FRESH apcSeq
//  (e) the fielded start: fresh boot state carries a player runners squad +
//      breakers pair on defend near the depot, and 4 fast + 2 heavy
//      garrison-held at the enemy's (sliced-boot or browser-side __DEPOT__
//      counts — match how T3's garrison fixtures asserted it)
//  (f) draw stability: the boot's draw count is fixed across two same-seed
//      boots (hash equality of the twin worlds)
```

## Step 2 — Tiers and specs

- state.js: `TIER_BELLS = [1, 3, 5, 10]`; ENEMY_TIERS gains `["hero_bison", "hero_apc"]` with the comment `// tier 4 — THE HERO TIER (owner): lost armor returns off the convoy, dear`.
- specs.js: PLAYER_TIERS gains `["hero_bison", "hero_apc"]`; BISON gains `cost: 200`, APC gains `cost: 140` (both `// provisional (F5)`); the two-ladder comment table gains the tier-4 row.

## Step 3 — The market

market.js: `MARKET_K` gains `heroBison: 1, heroApc: 1`; marketCounts counts `b.kind === "vehicle" && b.alive && b.vtype === "bison"` (both teams) into `heroBison`, vtype "apc" into `heroApc`; computePrices prices `player.hero_bison = priced(BISON.cost, "heroBison", counts)` and `foe.hero_bison` identically (one table), same for apc.

## Step 4 — The player buy and the delivery

- DepotGame: hoist parkArmor (+ apcSeqN, reseeded `max(existing)+1`) to mount scope per trap 4.
- PALETTE gains:
```js
  { key: "hero_bison", label: "BISON", icon: "⛨", cost: BISON.cost },
  { key: "hero_apc", label: "APC", icon: "⬒", cost: APC.cost },
```
- The bar's onClick for hero keys runs the two-tap arm (3s, the menu-exit pattern): first tap toasts `BISON — ◆price — TAP AGAIN TO ORDER`; second tap within 3s: afford check, buyPaced, `S.resources -= price`, `parkArmor(1, playerDepot, "bison")`, toast `THE CONVOY DELIVERS`. No ground tap, no pending ghost. (setMode must NOT treat hero keys as build modes — branch before it.)

## Step 5 — The enemy replacement

ringBell, after the ferry block:
```js
        // P7 T9: THE HERO TIER, their side — draw-free replacement off the
        // same table, one hull a bell, Bison first. The commander's doctrine
        // finds the new hull on its own.
        {
          const heroPrice = (k) => (S._market ? S._market.foe[k] : (k === "hero_bison" ? BISON.cost : APC.cost));
          const has = (vt) => world.bodies.some((b) => b.kind === "vehicle" && b.team === 2 && b.vtype === vt && b.alive);
          const open = (tag) => S.foe.unlocked.indexOf(tag) >= 0 && S.bell >= TIER_BELLS[3];
          const depotE4 = TOWN.find((tt) => tt.depot && tt.team === 2);
          if (depotE4 && !has("bison") && open("hero_bison") && S.reg.scrap >= heroPrice("hero_bison")) {
            S.reg.scrap -= heroPrice("hero_bison"); parkArmor(2, depotE4, "bison");
          } else if (depotE4 && !has("apc") && open("hero_apc") && S.reg.scrap >= heroPrice("hero_apc")) {
            S.reg.scrap -= heroPrice("hero_apc"); parkArmor(2, depotE4, "apc");
          }
        }
```
(TIER_BELLS joins the state.js import if absent.)

## Step 6 — The fielded start

Boot, after the Task 8 profile draw (fresh war only):
```js
        // P7 T9 (owner): THE FIELDED START — each base opens with a runner
        // squad and a breaker pair, free starting kit like the armor.
        // Player: real squads on defend. Enemy: the mirror men, dug in with
        // the home guard, unbooked. 18 fixed world-rng draws (6 spawnUnit).
        if (depotP) for (const type of ["runners", "breakers"]) {
          const a0 = type === "runners" ? 0.9 : 2.3;
          const p0 = clearSlot(world, depotP.x + Math.sin(a0) * 11, depotP.z + Math.cos(a0) * 11, 0.5);
          const sq = makeSquad(S.nextSquadId++, type, 1, p0.x, p0.z);
          spawnSquadMembers(world, sq);
          S.squads.push(sq);
        }
        {
          const depotE5 = TOWN.find((tt) => tt.depot && tt.team === 2);
          if (depotE5) {
            const gR5 = Math.hypot(depotE5.nx, depotE5.nz) * MASON.pitch / 2 + 5.5;
            ["fast", "fast", "fast", "fast", "heavy", "heavy"].forEach((tag, i) => {
              const a = (i / 6) * Math.PI * 2 + 2.0;
              const p = clearSlot(world, depotE5.x + Math.sin(a) * gR5, depotE5.z + Math.cos(a) * gR5, 0.5);
              const u = spawnUnit(world, { x: p.x, z: p.z }, tag);
              u.hold = true; u.garrison = true;
            });
          }
        }
```
(`depotP` is the player-depot lookup already in scope from parkArmor's call site; reuse, don't refind if present.)

## Step 7 — Version, gates, ship

- version mk1.38 → mk1.39. Gates: depot-test, depot-lint, build (after bump), smoke. NOT golden.
- Expected re-pins: manifest tier-pool fixtures (a 4th tier row changes late-bell pool counts); full-boot fixed-seed recaptures (+18 boot draws); named old→new.
- Commit exactly (src/depot/state.js, src/depot/specs.js, src/depot/market.js, src/depot/DepotGame.jsx, src/depot/transports.js if the apcSeq reseed touches it, scripts/depot-test.mjs, src/version.js), push. Message: `the hero tier and the fielded start (mk1.39)`.
- Owner's live check: bell 10's convoy offers the hulls; buying a replacement Bison two-taps and it parks at your depot; the price while yours still lives is absurd; their side buys its own armor back a bell or two after you kill it; and every fresh war opens with runners and breakers already standing at both bases.

**Report format:** read-confirmation; one line of outcome; boot/bell draw arithmetic; every re-pin old→new; every deviation its own bullet; smoke stated plainly.
