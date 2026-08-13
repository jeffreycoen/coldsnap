// Headless test for the depot bell cycle: the clock runs, the bell musters an
// assault under its tier cap, spent assaults withdraw. Drives
// src/depot/state.js directly, no DOM/three.js.
//   node scripts/depot-test.mjs
import {
  makeRunState, stepBell, fireBell, withdrawDue, executeWithdrawal,
  BELL_PERIOD_S, BELL_SCRAP, TIER_BELLS, ENEMY_TIERS, enemyTierState, enemyTierOf, ASSAULT_TIMEOUT,
  MANIFEST_DRAWS, FOE_DRAWS, makeManifestState, makeFoeState, manifestPool, foePool,
  drawOffers, drawFoePick, pickManifest, isUnlocked, tierOpenCount,
  regimentDestroyed, checkLoss, checkWin, makeEndDispatch, towerShot, squadFire, possessedVolley, possessedTowerFire,
  fieldReaches, effRange, validatePlacement, PENDING_ARM_S, pendingArmed,
  PENDING_EDGE_PAD, pendingButtonsVisible, canvasTapConsumesPending,
  END_CARD_DELAY_S, stampEnd, endCardReady,
  censusDepotChunks, depotStandingFraction, checkDepotBreach, checkEnemyBreach, stepDepotCensus,
  spawnSquadMembers, spawnSandbag, SANDBAG_COST, WALL_COST, pruneSquads,
  SANDBAG_FIELD_COST, WALL_FIELD_COST, WALL_LAY_PAUSE_S,
  DEPOT_STANDING_TOL, DEPOT_BREACH_FRAC, DEPOT_CENSUS_HZ,
  spawnWallCourses, stepWallSupport, wallCourseHp,
  WALL_HP, WALL_COURSES, WALL_H, WALL_HALF, WALL_THIN, wallOrientAt, WALL_COURSE_PITCH, WALL_COURSE_HY, WALL_WELD_BREAK_F, WALL_UPPER_GROUP,
} from "../src/depot/state.js";
import { troopKit, barrelBasis, RIFLE_PREROT, RIFLE_OFF, RIFLE_LEN } from "../src/render/troopkit.js";
import { INFANTRY } from "../src/engine/core.js";
import { reachPolygon, arcClears, squadReach, towerReachCached } from "../src/depot/accuracy.js";
import { friendlyFouls } from "../src/depot/state.js";
import {
  makeWorld, makeField, addBody, addWeld, fireProjectile, stepWorld, applyDamage, worldHash, CAUSE, mulberry32, aimSolve,
} from "../src/engine/core.js";
import { TOWER_SPECS, ENEMY_SPECS, ENEMY_FIRE, TANK, MASON, INFANTRY_ARMS, PLAYER_START, PLAYER_TIERS } from "../src/depot/specs.js";
import { stepUnits, spawnUnit, payBounties, SNIPER_FIRE } from "../src/depot/units.js";
import { SQUAD_SPECS, makeSquad, exposureAt, coverHop, stepSquad, drivePossessedSquad, COHESION_M } from "../src/depot/squads.js";
import {
  makeRegiment, STIPEND, RESULTS, payResults, combatIneffective, bookValue,
} from "../src/depot/economy.js";
import { planWave, MIN_WAVE_FLOOR, snapSquads } from "../src/depot/ai.js";
import { composeIntel, openingIntel } from "../src/depot/intel.js";
import { makeTerritory, stepTerritory, holderAt, fogStateAt, valueAt, canBuild, DECAY_TAU, EMIT } from "../src/depot/territory.js";
import { SIGHT, eyeOf, canSee, fillMaps, gridEye, makeSight, seenAt, stepSight } from "../src/depot/sight.js";
import { fwdUFor, fwdDirFor, invWFor, clampToRimFor } from "../src/depot/orient.js";
import { washAlpha, WASH_SEAM, WASH_MAX_A } from "../src/render/renderer.js";
import { serializeFront, parseFront, restoreBodies, restoreSquads } from "../src/depot/save.js";
import fs from "node:fs";

// identity fwdDir (DepotGame.jsx's ORIENT-aware transform, ORIENT===0 case)
// so these headless tests match the default map orientation exactly.
const identFwdDir = (dx, dz) => ({ x: dx, z: dz });
// a straight-line flow field toward +z, for tests that don't build a real grid
function straightGrid(dirX, dirZ) {
  return {
    cellAt: () => ({ dist: 1, dx: dirX, dz: dirZ, ice: false }),
    worldToGrid: () => null,
    inBounds: () => false,
    cells: [], idx: () => 0, gridToWorld: () => ({ x: 0, z: 0 }),
  };
}

const fails = [];
const ok = (name, cond, detail) => {
  console.log(`${cond ? "PASS" : "FAIL"} — ${name}${detail ? " (" + detail + ")" : ""}`);
  if (!cond) fails.push(name);
};

// A regiment fat enough to muster every bell, and a seeded stream — the bell
// cycle has no static table to drive any more, so every fixture that wants an
// assault wires a real attacker economy.
const fatReg = () => ({ heads: 400, tanks: 10, heads0: 400, tanks0: 10, scrap: 400 });

const S = makeRunState();
S.started = true;
S.reg = fatReg();
const rngS = mulberry32(4242);

// --- the clock: bellT counts down off SIM time, the bell fires at zero
ok("starts before the first bell", S.bell === 0 && S.bellT === BELL_PERIOD_S, `${S.bell}/${S.bellT}`);
ok("lastDispatch starts empty", S.lastDispatch === null);
ok("clock does not fire early", stepBell(S, BELL_PERIOD_S - 1) === false);
ok("bellT is the remaining sim seconds", Math.abs(S.bellT - 1) < 1e-9, S.bellT);
ok("clock fires at the period", stepBell(S, BELL_PERIOD_S) === true);
ok("bellT resets to a full period", S.bellT === BELL_PERIOD_S);
ok("clock does not fire twice for one period", stepBell(S, BELL_PERIOD_S + 1) === false);

// --- the bell musters an assault
fireBell(S, { reg: S.reg, snap: {}, rng: rngS, t: BELL_PERIOD_S });
ok("first bell is bell 1", S.bell === 1, S.bell);
ok("the bell arms a spawn queue", S.ws.spawnQueue > 0, S.ws.spawnQueue);
ok("the bell resets the results accumulator", S.ws.results && S.ws.results.structureDmg === 0);
ok("the bell files a re-readable dispatch", !!S.lastDispatch && S.lastDispatch.lines.length > 0);
ok("dispatch copy names the bell", S.lastDispatch.lines[0].includes("MUSTER BELL 1"), S.lastDispatch.lines[0]);

// --- the next bell comes on schedule whether or not the field is clear
const queuedBefore = S.ws.spawnQueue;
fireBell(S, { reg: S.reg, snap: {}, rng: rngS, t: 2 * BELL_PERIOD_S });
ok("a second bell fires with the first assault still walking", S.bell === 2 && queuedBefore > 0);
ok("the second bell overwrites the spawn queue", S.ws.spawnQueue > 0);

// --- income lands on the bell (the retired stall's grant, moved onto the clock)
{
  const I = makeRunState();
  I.started = true;
  I.reg = fatReg();
  const before = I.resources, regBefore = I.reg.scrap;
  fireBell(I, { reg: I.reg, snap: {}, rng: mulberry32(1), t: BELL_PERIOD_S });
  ok("bell pays the player's cycle scrap", I.resources === before + BELL_SCRAP, `${I.resources} vs ${before + BELL_SCRAP}`);
  ok("bell pays the regiment's stipend before the muster spends it",
    I.reg.scrap <= regBefore + STIPEND, `${I.reg.scrap}`);
}

// --- tier caps: what a bell's assault may contain
// mk0.41 re-pin: enemyTierState is PICK-driven now (a tag needs a pick AND its
// bell), so every read here passes an explicit pick list. `allPicked` is the
// ceiling read — "if they had picked everything, what would this bell allow?"
// — which is exactly what the old bell-only signature used to answer.
{
  const allPicked = ENEMY_TIERS.flat();
  ok("conscripts are never gated", enemyTierState(0, allPicked).tags.includes(""));
  ok("nothing but conscripts before the first tier bell", enemyTierState(TIER_BELLS[0] - 1, allPicked).tags.length === 1);
  ok("no picks, no tags: an attacker that has picked nothing marches conscripts", enemyTierState(99, []).tags.length === 1);
  for (let i = 0; i < ENEMY_TIERS.length; i++) {
    const justBefore = enemyTierState(TIER_BELLS[i] - 1, allPicked).tags;
    const atBell = enemyTierState(TIER_BELLS[i], allPicked).tags;
    ok(`tier ${i + 1} is shut before bell ${TIER_BELLS[i]}`, ENEMY_TIERS[i].every((t) => !justBefore.includes(t)));
    ok(`tier ${i + 1} opens at bell ${TIER_BELLS[i]}`, ENEMY_TIERS[i].every((t) => atBell.includes(t)));
    // the bell is a CEILING even against a corrupt pick list: a tag picked
    // ahead of its bell still cannot field.
    ok(`tier ${i + 1} stays shut before its bell even if picked early`,
      enemyTierState(TIER_BELLS[i] - 1, ENEMY_TIERS[i]).tags.length === 1);
  }
  // and planWave honours the cap: 40 seeded musters at bell 1 field nothing
  // from tiers 2 or 3, however rich the regiment.
  const gated = ENEMY_TIERS[1].concat(ENEMY_TIERS[2]);
  let leaked = 0, fieldedAny = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const reg = { heads: 400, tanks: 10, heads0: 400, tanks0: 10, scrap: 900 };
    const { buys } = planWave(reg, { mgs: 8, walls: 8, squads: 3 }, 1, mulberry32(seed * 31), enemyTierState(1, allPicked).tags);
    if (buys.some((b) => gated.includes(b.type))) leaked++;
    if (buys.reduce((n, b) => n + b.n, 0) > 0) fieldedAny++;
  }
  ok("tier cap holds through planWave (40 seeds at bell 1, no tier-2/3 tags)", leaked === 0, `${leaked} leaks`);
  ok("a capped muster still fields men", fieldedAny === 40, `${fieldedAny}/40`);
  // draw-count stability: the cap clamps what the draws buy, never how many
  // draws happen — a capped and an uncapped plan consume the same stream.
  const drawsFor = (tags) => {
    let n = 0;
    const r = mulberry32(77);
    const counted = () => { n++; return r(); };
    planWave({ heads: 400, tanks: 10, heads0: 400, tanks0: 10, scrap: 900 }, { mgs: 8 }, 1, counted, tags);
    return n;
  };
  ok("tier caps do not change planWave's draw count",
    drawsFor(enemyTierState(1, allPicked).tags) === 4 && drawsFor(null) === 4);
}

// --- the manifest (P1 Task 2): two ladders, one bell, fixed draw counts
{
  console.log("\n[the manifest]");
  const allPicked = ENEMY_TIERS.flat();

  // (a) the player starts with START and nothing else.
  {
    const M = makeManifestState();
    // re-pinned mk0.60: the ENGINEER TEAM joins the starting kit (was 3 items,
    // wall/sandbag/rifles), so every match now opens with the build order too.
    ok("manifest: a fresh run starts on wall/sandbag/rifles/engineers",
      M.unlocked.length === 4 && isUnlocked(M, "wall") && isUnlocked(M, "sandbag")
      && isUnlocked(M, "sq_rifles") && isUnlocked(M, "sq_engineers"),
      M.unlocked.join(","));
    ok("manifest: nothing is offered before the first bell", M.offers.length === 0 && M.cardUp === false);
    ok("manifest: no tier is open at bell 0", tierOpenCount(0) === 0 && manifestPool(M.unlocked, 0).length === 0);
  }

  // (b) the pool: this tier's items plus every earlier tier's leftovers.
  {
    const M = makeManifestState();
    const p1 = manifestPool(M.unlocked, 1);
    ok("manifest: bell 1 offers tier 1 only", p1.length === 3 && p1.every((k) => ["mg", "sq_mg", "frost"].includes(k)), p1.join(","));
    M.unlocked.push("mg");
    ok("manifest: a picked item leaves the pool", manifestPool(M.unlocked, 1).indexOf("mg") < 0);
    const p3 = manifestPool(M.unlocked, 3);
    ok("manifest: the passed-over item waits for another truck", p3.length === 5 && p3.includes("frost") && p3.includes("gun"), p3.join(","));
    ok("manifest: tier 3 is shut until its bell", manifestPool(M.unlocked, 4).indexOf("rocket") < 0);
    ok("manifest: tier 3 opens at its bell", manifestPool(M.unlocked, 5).indexOf("rocket") >= 0);
  }

  // (c) DRAW-COUNT LAW: fixed draws per bell whatever the pool holds.
  {
    const counted = (seed) => { let n = 0; const r = mulberry32(seed); return { rng: () => { n++; return r(); }, n: () => n }; };
    for (const pool of [[], ["a"], ["a", "b"], ["a", "b", "c", "d", "e", "f", "g", "h", "i"]]) {
      const c = counted(5);
      drawOffers(pool, c.rng);
      ok(`manifest: ${pool.length}-item pool still spends exactly ${MANIFEST_DRAWS} draws`, c.n() === MANIFEST_DRAWS, `${c.n()}`);
      const f = counted(6);
      drawFoePick(pool, f.rng);
      ok(`foe pick: ${pool.length}-item pool still spends exactly ${FOE_DRAWS} draw`, f.n() === FOE_DRAWS, `${f.n()}`);
    }
    // and the offers themselves are sane across 200 seeds: 2-3, distinct, in-pool.
    let badN = 0, dupe = 0, foreign = 0;
    const pool = ["mg", "sq_mg", "frost", "gun", "sq_sniper", "sq_mortars"];
    for (let seed = 1; seed <= 200; seed++) {
      const o = drawOffers(pool, mulberry32(seed));
      if (o.length < 2 || o.length > 3) badN++;
      if (new Set(o).size !== o.length) dupe++;
      if (o.some((k) => !pool.includes(k))) foreign++;
    }
    ok("manifest: 200 seeded offers are all 2-3 items", badN === 0, `${badN} bad`);
    ok("manifest: 200 seeded offers never repeat an item", dupe === 0, `${dupe} dupes`);
    ok("manifest: 200 seeded offers never invent an item", foreign === 0, `${foreign} foreign`);
    // a thin pool clamps rather than padding: one item left means one offer.
    ok("manifest: a one-item pool offers exactly that item", drawOffers(["frost"], mulberry32(3)).join(",") === "frost");
    ok("manifest: an empty pool offers nothing", drawOffers([], mulberry32(3)).length === 0);
    ok("foe pick: an empty pool picks nothing", drawFoePick([], mulberry32(3)) === null);
  }

  // (d) the pick: one item, only from what this bell offered.
  {
    const M = makeManifestState();
    M.offers = ["mg", "frost"]; M.cardUp = true;
    ok("manifest: an item that was never offered cannot be taken", pickManifest(M, "rocket") === false && M.unlocked.length === 4);
    ok("manifest: the pick joins the unlocked set", pickManifest(M, "frost") === true && isUnlocked(M, "frost"));
    ok("manifest: taking one crate closes the card and clears the offer", M.cardUp === false && M.offers.length === 0);
    ok("manifest: a second pick off the same bell is refused", pickManifest(M, "mg") === false && M.unlocked.length === 5);
  }

  // (e) a skipped bell is a skipped pick — no banking, but nothing is lost:
  // the unpicked items are still in the pool the next bell draws from.
  {
    const S2 = makeRunState();
    S2.started = true; S2.reg = fatReg();
    const rng = mulberry32(41);
    fireBell(S2, { reg: S2.reg, snap: {}, rng, t: BELL_PERIOD_S });
    const first = S2.manifest.offers.slice();
    ok("manifest: the bell raises an offer", first.length >= 2 && S2.manifest.cardUp === true, first.join(","));
    fireBell(S2, { reg: S2.reg, snap: {}, rng, t: 2 * BELL_PERIOD_S });
    ok("manifest: an unread offer is overwritten at the next bell, not banked",
      S2.manifest.offerBell === 2 && S2.manifest.unlocked.length === 4, `${S2.manifest.offerBell}/${S2.manifest.unlocked.length}`); // 4 re-pinned mk0.60: START gained sq_engineers
    ok("manifest: the passed-over items are still on offer", S2.manifest.offers.every((k) => manifestPool(["wall", "sandbag", "sq_rifles", "sq_engineers"], 2).includes(k)));
  }

  // (f) the enemy's mirror: one pick per bell, never ahead of its tier's bell.
  {
    const S3 = makeRunState();
    S3.started = true; S3.reg = fatReg();
    const rng = mulberry32(42);
    let early = 0, jumped = 0, prev = 0;
    for (let b = 1; b <= 12; b++) {
      S3.reg.scrap += 400; S3.reg.heads += 200;
      fireBell(S3, { reg: S3.reg, snap: {}, rng, t: b * BELL_PERIOD_S });
      if (S3.foe.unlocked.length - prev > 1) jumped++;
      prev = S3.foe.unlocked.length;
      for (const tag of S3.foe.unlocked) if (b < TIER_BELLS[enemyTierOf(tag)]) early++;
      // the live cap can never contain a tag whose bell has not come
      for (const tag of enemyTierState(S3.bell, S3.foe.unlocked).tags) {
        if (tag !== "" && S3.bell < TIER_BELLS[enemyTierOf(tag)]) early++;
      }
      // ...nor a tag the assault itself was never given
      if (S3.ws.mixBag.some((t) => !enemyTierState(S3.bell, S3.foe.unlocked).tags.includes(t))) early++;
    }
    ok("foe pick: never more than one new item per bell", jumped === 0, `${jumped}`);
    ok("foe pick: nothing fields ahead of its tier's bell across 12 bells", early === 0, `${early}`);
    ok("foe pick: the ladder actually climbs", S3.foe.unlocked.length >= 5, S3.foe.unlocked.join(","));
    ok("foe pick: the picks are all real enemy tags", S3.foe.unlocked.every((t) => allPicked.includes(t)));
    ok("foe pick: the same item is never picked twice", new Set(S3.foe.unlocked).size === S3.foe.unlocked.length);
  }

  // (g) the sequence: the cards go up, and the assault does NOT wait on them.
  {
    const S4 = makeRunState();
    S4.started = true; S4.reg = fatReg();
    ok("bell sequence: a fresh run has no cards up", S4.intelUp === false && S4.manifest.cardUp === false);
    fireBell(S4, { reg: S4.reg, snap: {}, rng: mulberry32(43), t: BELL_PERIOD_S });
    // RE-PINNED mk0.50 (was: "the bell raises the intel card", intelUp true).
    // The intel card no longer auto-raises — the report is still composed and
    // still parked on S.lastDispatch for the bell chip to re-read.
    ok("bell sequence: the bell does NOT raise the intel card (mk0.50)", S4.intelUp === false);
    ok("bell sequence: the un-raised intel report is still composed and re-readable",
      !!S4.lastDispatch && S4.lastDispatch.lines.length > 0);
    ok("bell sequence: both cards arm on the trailing-tap law",
      S4.intelArmedAt === BELL_PERIOD_S + PENDING_ARM_S && S4.manifest.armedAt === BELL_PERIOD_S + PENDING_ARM_S);
    // RE-PINNED mk0.50: "both cards" is now the manifest alone — the muster
    // still does not wait on it, which is the assert that matters.
    ok("bell sequence: the assault musters with the manifest card still up",
      S4.manifest.cardUp === true && S4.ws.spawnQueue > 0, `${S4.ws.spawnQueue}`);
    ok("bell sequence: the income landed before the muster spent it",
      S4.resources === makeRunState().resources + BELL_SCRAP, `${S4.resources}`);
    ok("bell sequence: the intel card carries the bell's dispatch",
      !!S4.lastDispatch && S4.lastDispatch.lines[0].includes("MUSTER BELL 1"));
  }
}

// --- the withdrawal clock (kept from the wave machine)
{
  const W = makeRunState();
  W.started = true;
  W.ws.spawnQueue = 0;
  W.ws.spawnDoneT = 100;
  ok("withdrawal not due before the timeout", withdrawDue(W, 100 + ASSAULT_TIMEOUT) === false);
  ok("withdrawal due after the timeout", withdrawDue(W, 101 + ASSAULT_TIMEOUT) === true);
  ok("withdrawal is raised once per assault", withdrawDue(W, 200 + ASSAULT_TIMEOUT) === false);
  ok("a still-spawning assault never withdraws",
    (() => { const X = makeRunState(); X.ws.spawnQueue = 3; X.ws.spawnDoneT = 0; return withdrawDue(X, 1e6); })() === false);
}

// ===================================================== end states (FRONT F1)
// checkLoss keeps only the stubbed regiment hook — with the stub false it
// can never fire; the depot's masonry (checkDepotBreach) is the loss track.
{
  const L = makeRunState();
  L.started = true;
  ok("regimentDestroyed stub is always false", regimentDestroyed(L) === false);
  ok("checkLoss never fires without the regiment stub (lives retired)", checkLoss(L) === false && L.gameOver === false);
  ok("checkLoss does not set victory", L.victory === false);
}

// FRONT F1: the book-value verdict is retired as an ending. Rich or poor, no
// number of bells ends the run — nothing in the cycle calls checkWin.
// checkWin itself stays exported (the probe reads it) with its old verdict.
{
  const snap = { mortars: 2, mgs: 3, guns: 2, frosts: 1, walls: 10 };
  const G = makeRunState({ startResources: 999999 });
  G.started = true;
  G.reg = { heads: 60, tanks: 1, heads0: 400, tanks0: 10, scrap: 20 };
  const rngG = mulberry32(3);
  for (let i = 0; i < 6; i++) fireBell(G, { reg: G.reg, snap, rng: rngG, t: (i + 1) * BELL_PERIOD_S });
  ok("rich player, six bells deep: NO ledger win", G.victory === false && G.gameOver === false);
  const B = makeRunState({ startResources: 0 });
  B.started = true;
  B.reg = { heads: 300, tanks: 10, heads0: 400, tanks0: 10, scrap: 500 };
  const rngB = mulberry32(4);
  for (let i = 0; i < 6; i++) fireBell(B, { reg: B.reg, snap: {}, rng: rngB, t: (i + 1) * BELL_PERIOD_S });
  ok("poor player, six bells deep: NO ledger loss", B.victory === false && B.gameOver === false && B.ledgerLoss !== true);
  // the retired function still answers when the probe calls it directly
  const Sw = makeRunState({ startResources: 999999 });
  ok("checkWin (retired, probe-only) still returns its book verdict when called directly",
    checkWin(Sw, snap) === true && Sw.victory === true);
}

// FRONT F1: a combat-ineffective regiment no longer ends the run — the
// bureau observes it once on the bell's dispatch and the war continues.
{
  const A = makeRunState({ startResources: 0 });
  A.started = true;
  A.reg = { heads: 10, tanks: 0, heads0: 400, tanks0: 10, scrap: 0 }; // < 12% heads0, 0 tanks -> ineffective
  fireBell(A, { reg: A.reg, snap: {}, rng: mulberry32(5), t: BELL_PERIOD_S });
  ok("attrition retired: the bell still files its dispatch on a broken regiment", !!A.lastDispatch);
  ok("attrition retired: run does NOT end", A.victory === false && A.gameOver === false);
}

// intact, above-threshold regiment mid-run never draws the observation.
{
  const N = makeRunState();
  N.started = true;
  N.reg = { heads: 300, tanks: 5, heads0: 400, tanks0: 10, scrap: 0 };
  fireBell(N, { reg: N.reg, snap: {}, rng: mulberry32(6), t: BELL_PERIOD_S });
  ok("intact regiment mid-run: no break observation, no ending",
    N.victory === false && !N.lastDispatch.lines.some((l) => /combat-ineffective/i.test(l)));
}

// bounty bug: killing a TANK (kind: "vehicle") must pay its bounty (25),
// same as a killed infantry unit (kind: "unit") does.
{
  const world = makeWorld({ seed: 1 });
  const tank = spawnUnit(world, { x: 0, z: 10 }, "tank");
  ok("spawned tank carries the TANK bounty", tank.bounty === TANK.bounty, tank.bounty);
  tank.alive = false;
  const before = world.events.length;
  payBounties(world);
  const evs = world.events.slice(before);
  const tdk = evs.find((e) => e.type === "tdkill");
  ok("dead tank pays a tdkill bounty event", !!tdk, JSON.stringify(evs));
  ok("tank bounty is 25 (TANK.bounty)", tdk && tdk.bounty === 25, tdk);
  const before2 = world.events.length;
  payBounties(world);
  ok("bounty is paid only once (b._paid guard)", world.events.length === before2);
}

// The starved-muster streak: 3 CONSECUTIVE bells where the attacker cannot
// afford a minimum muster (musterScrap < MIN_WAVE_FLOOR) and fields nobody
// earn a one-time "the offensive is spent" observation — not an ending.
// A starved fixture needs an EMPTY head pool as well as empty scrap: the bell
// pays the stipend before the muster, and a stipend alone buys conscripts.
const starvedReg = () => ({ heads: 0, tanks: 1, heads0: 400, tanks0: 10, scrap: 0 });
const bellsOf = (S, reg, n, scrapEach, rng, snap = {}) => {
  for (let i = 0; i < n; i++) {
    reg.scrap = scrapEach;
    fireBell(S, { reg, snap, rng, t: (S.bell + 1) * BELL_PERIOD_S });
  }
};
{
  const P = makeRunState({ startResources: 0 });
  P.started = true;
  P.reg = starvedReg();
  const rng = mulberry32(21);
  bellsOf(P, P.reg, 1, 0, rng);
  ok("starved bell 1/3: no observation yet", P.victory !== true && !P.lastDispatch.lines.some((l) => /spent/i.test(l)));
  bellsOf(P, P.reg, 1, 0, rng);
  ok("starved bell 2/3: still none", P.victory !== true && !P.lastDispatch.lines.some((l) => /spent/i.test(l)));
  bellsOf(P, P.reg, 1, 0, rng);
  ok("starved bell 3/3: no win, only a one-time spent observation",
    P.victory !== true && P.gameOver !== true && P.lastDispatch.lines.some((l) => /spent/i.test(l)), JSON.stringify(P.lastDispatch.lines));
}

// only 2 consecutive starved bells: no trigger.
{
  const P2 = makeRunState({ startResources: 0 });
  P2.started = true;
  P2.reg = starvedReg();
  bellsOf(P2, P2.reg, 2, 0, mulberry32(22));
  ok("2 starved bells: no ending, no spent observation",
    P2.victory !== true && P2.gameOver !== true && !P2.lastDispatch.lines.some((l) => /spent/i.test(l)));
}

// a solvent bell resets the consecutive counter.
{
  const P3 = makeRunState({ startResources: 0 });
  P3.started = true;
  P3.reg = starvedReg();
  const rng = mulberry32(23);
  bellsOf(P3, P3.reg, 2, 0, rng);              // starved 1, 2
  P3.reg.heads = 400;
  bellsOf(P3, P3.reg, 1, MIN_WAVE_FLOOR + 500, rng); // fields troops — resets
  P3.reg.heads = 0;
  bellsOf(P3, P3.reg, 2, 0, rng);              // starved 1, 2 again
  ok("solvent bell resets streak: no spent line after only 2 post-reset",
    !P3.lastDispatch.lines.some((l) => /spent/i.test(l)), P3.starvedStreak);
}

// ================================================== spent misfire (Jeff's repro)
// The starved check must read the attacker's MUSTER-TIME solvency, not the
// post-buy scrap planWave leaves behind. A bell that actually fielded troops
// can NEVER count as starved, no matter how broke the regiment is after
// buying it — otherwise every well-spent muster increments the streak.
{
  const rng = mulberry32(1234);
  // (a) Jeff's repro: 4 consecutive bells that field real troops. planWave
  // spends scrap down at muster, so post-buy reg.scrap is routinely under
  // MIN_WAVE_FLOOR — the streak must stay 0 and the run must continue.
  const J = makeRunState({ startResources: 0 });
  J.started = true;
  J.reg = { heads: 400, tanks: 0, heads0: 400, tanks0: 0, scrap: MIN_WAVE_FLOOR + 2 };
  for (let w = 0; w < 4; w++) {
    J.reg.scrap = MIN_WAVE_FLOOR + 2; // solvent at muster, nearly all spent by planWave
    fireBell(J, { reg: J.reg, snap: {}, rng, t: (w + 1) * BELL_PERIOD_S });
    ok(`repro bell ${w + 1} fields troops`, J.ws.spawnQueue > 0, J.ws.spawnQueue);
    ok(`repro bell ${w + 1}: post-spend scrap under floor yet streak stays 0`,
      J.starvedStreak === 0, `streak=${J.starvedStreak} scrap=${J.reg.scrap}`);
  }
  ok("repro: run continues past 4 fielded bells — no spent misfire", J.victory !== true && J.gameOver !== true);

  // (b) genuinely starved: 3 consecutive musters that cannot afford the floor
  // AND field zero units -> the one-time spent observation, no ending.
  const G = makeRunState({ startResources: 0 });
  G.started = true;
  G.reg = starvedReg();
  for (let w = 0; w < 3; w++) {
    G.reg.scrap = 0;
    fireBell(G, { reg: G.reg, snap: {}, rng, t: (w + 1) * BELL_PERIOD_S });
    ok(`starved bell ${w + 1} fields nothing`, G.ws.spawnQueue === 0, G.ws.spawnQueue);
  }
  ok("3 empty musters: no ending", G.victory !== true && G.gameOver !== true);
  ok("3 empty musters: the bureau observes the offensive spent", G.lastDispatch.lines.some((l) => /spent/i.test(l)), JSON.stringify(G.lastDispatch.lines));

  // (c) a fielded bell between two starved ones resets the counter.
  const R = makeRunState({ startResources: 0 });
  R.started = true;
  R.reg = starvedReg();
  const cycle = (scrap, heads) => {
    R.reg.scrap = scrap; R.reg.heads = heads;
    fireBell(R, { reg: R.reg, snap: {}, rng, t: (R.bell + 1) * BELL_PERIOD_S });
  };
  cycle(0, 0); // starved 1
  cycle(MIN_WAVE_FLOOR + 40, 400); // fields troops — resets
  ok("fielded bell resets starved streak", R.starvedStreak === 0, R.starvedStreak);
  cycle(0, 0); // starved 1 again
  cycle(0, 0); // starved 2
  ok("reset held: only 2 starved since the fielded bell, no spent line",
    !R.lastDispatch.lines.some((l) => /spent/i.test(l)), R.starvedStreak);
}

// FRONT F1: the only victory card is the enemy-breach card, whatever flags ride along.
{
  const d = makeEndDispatch({ victory: true, kills: 12, wave: 6, totalWaves: 50, spent: true });
  ok("victory card is always the opposing-depot breach card", d.lines[0] === "THE OPPOSING DEPOT IS BREACHED.", JSON.stringify(d.lines));
}

// ================================================== seeded determinism
// Two independently built worlds from the same seed, driven through an
// identical scripted "wave" (spawn N bodies via world.rng(), fire a
// deterministic volley, step to rest) must land on the same worldHash. This
// proves depot map/enemy generation — which all runs through world.rng(),
// per DepotGame.jsx's header comment — replays exactly from ?seed=, the
// same guarantee scenario-test.mjs/campaign-test.mjs hold engine-side.
function scriptedWaveRun(seed) {
  const world = makeWorld({ seed });
  const r = mulberry32(seed);
  for (let i = 0; i < 6; i++) {
    addBody(world, {
      kind: "unit", hx: 0.26, hy: 0.86, hz: 0.26, mass: 82, hp: 58,
      x: (r() - 0.5) * 10, y: 0.86, z: 20 + i * 2,
    });
  }
  fireProjectile(world, { x: 0, y: 1.62, z: 0 }, { x: 0, y: 0, z: 1 }, 90, { kind: "shell", r: 2, kv: 12, dmg: 55, crater: 0.5, attacker: "player" });
  for (let i = 0; i < 300; i++) stepWorld(world);
  return worldHash(world);
}
{
  const h1 = scriptedWaveRun(42);
  const h2 = scriptedWaveRun(42);
  ok("seeded determinism: double-build same seed -> identical worldHash after scripted wave", h1 === h2, `h1=${h1} h2=${h2}`);
  const h3 = scriptedWaveRun(43);
  ok("different seed diverges (hash isn't a constant)", h3 !== h1, `h1=${h1} h3=${h3}`);
}

// ============================================ rotation-invariance (Global Constraint)
// Plan's Global Constraint: the renderer's Q/E view rotation (rotateStep,
// src/render/renderer.js) must never touch sim state — a scripted wave must
// hash identically whether or not rotateStep is interleaved between steps.
// This harness is headless (no renderer instance, no canvas/GL context), so
// a literal "call rotateStep between stepWorld calls, compare worldHash" run
// isn't reachable here; instead we assert the CONTRACT it depends on at the
// grep level: rotateStep only exists in renderer.js and mutates its own
// local `yawTgt` closure var, and depot's sim tick path (state.js, plus the
// worldHash/stepWorld region of core.js) never reads "yaw" or "rotateStep"
// at all. td-render-test.mjs (a live-server browser gate, not run in CI)
// covers the literal rotate-then-render pixel check; this is the headless
// half of the same guarantee.
{
  const stateSrc = fs.readFileSync(new URL("../src/depot/state.js", import.meta.url), "utf8");
  const coreSrc = fs.readFileSync(new URL("../src/engine/core.js", import.meta.url), "utf8");
  const rendererSrc = fs.readFileSync(new URL("../src/render/renderer.js", import.meta.url), "utf8");
  // (core.js legitimately says "yaw" for body/mech facing (physics, not the
  // camera) — the sim-purity claim is specifically about view rotation, so
  // check for rotateStep/yawTgt/camYaw, not the bare substring "yaw".)
  ok("rotation-invariance: src/depot/state.js (sim tick path) never references view rotation", !/rotateStep|yawTgt|camYaw/i.test(stateSrc));
  ok("rotation-invariance: src/engine/core.js (stepWorld/worldHash) never references view rotation", !/rotateStep|yawTgt|camYaw/i.test(coreSrc));
  ok("rotation-invariance: rotateStep is defined exactly once, in the renderer", (rendererSrc.match(/function rotateStep/g) || []).length === 1);
  // sanity: worldHash's own inputs are bodies/projectiles/t only — confirms
  // there's no rotation-shaped field it could be hashing in the first place.
  const wh = coreSrc.slice(coreSrc.indexOf("export function worldHash"), coreSrc.indexOf("export function worldHash") + 800);
  ok("rotation-invariance: worldHash hashes bodies/projectiles/t (no camera/view field)", /for \(const \w+ of world\.(bodies|projectiles)\)/.test(wh));
}
{
  // Literal check where we CAN run it headlessly: scripted-wave determinism
  // (above) already proves worldHash is a pure function of (seed, sim steps).
  // Interleaving a no-op "rotate" (calling the exact same rotateStep formula
  // against a throwaway local, never touching `world`) between steps must
  // still land on the same hash as the un-interleaved run, since nothing it
  // touches is reachable from world.
  function scriptedWaveRunWithRotate(seed) {
    const world = makeWorld({ seed });
    const r = mulberry32(seed);
    for (let i = 0; i < 6; i++) {
      addBody(world, {
        kind: "unit", hx: 0.26, hy: 0.86, hz: 0.26, mass: 82, hp: 58,
        x: (r() - 0.5) * 10, y: 0.86, z: 20 + i * 2,
      });
    }
    fireProjectile(world, { x: 0, y: 1.62, z: 0 }, { x: 0, y: 0, z: 1 }, 90, { kind: "shell", r: 2, kv: 12, dmg: 55, crater: 0.5, attacker: "player" });
    let yawTgt = 0; // stands in for the renderer's local camera state
    for (let i = 0; i < 300; i++) {
      if (i % 7 === 0) yawTgt += Math.PI / 2; // simulated Q/E taps between steps
      stepWorld(world);
    }
    return worldHash(world);
  }
  const h1 = scriptedWaveRun(42);
  const hR = scriptedWaveRunWithRotate(42);
  ok("rotation-invariance: worldHash identical with rotateStep-equivalent view rotation interleaved", h1 === hR, `h1=${h1} hR=${hR}`);
}

// ================================================== guard-flag proof
// world.depotCombat is the single guard flag gating glancing/armor/tree
// combat (Tasks 2-4). A TD-style world — the default, no flag set — must
// leave every one of those hooks inert: no glancing scale-down, no armor
// gate, trees untouched by direct rounds. Full on/off coverage for these
// mechanics lives in combat-test.mjs (test:combat); this is the consolidated
// proof that depot-test.mjs's own suite also verifies the guard holds.
{
  // glancing: head-on vs. grazing hit must deal identical damage without the flag
  const runOnce = (grazing) => {
    const world = makeWorld({ seed: 1 });
    const target = addBody(world, { kind: "vehicle", hx: 1, hy: 1, hz: 1, x: 0, y: 5, z: 20, mass: 500, hp: 1000 });
    const dir = grazing
      ? { x: Math.sin(75 * Math.PI / 180), y: 0, z: Math.cos(75 * Math.PI / 180) }
      : { x: 0, y: 0, z: 1 };
    const D = 25;
    const from = { x: 0 - dir.x * D, y: 5, z: 20 - dir.z * D };
    fireProjectile(world, from, dir, 60, { kind: "shell", r: 0, kv: 12, dmg: 55, crater: 0, attacker: "player" });
    for (let i = 0; i < 240 && world.projectiles.length; i++) stepWorld(world);
    return target.hp;
  };
  const headOn = runOnce(false);
  const graze = runOnce(true);
  ok("guard: TD world (no depotCombat) — head-on and grazing deal identical damage", headOn === graze, `head-on hp=${headOn} graze hp=${graze}`);

  // armor: gate ignored without the flag
  const withoutFlagLoss = (() => {
    const world = makeWorld({ seed: 1 });
    const b = addBody(world, { kind: "vehicle", hx: 1, hy: 1, hz: 1, x: 0, y: 5, z: 20, mass: 500, hp: 1000 });
    b.armor = 40;
    applyDamage(world, b, 30, { cause: CAUSE.PROJECTILE, attacker: "player" });
    return 1000 - b.hp;
  })();
  ok("guard: TD world — armor threshold ignored (full 30 hp lost)", withoutFlagLoss === 30, `lost=${withoutFlagLoss}`);

  // trees: inert to direct mg fire without the flag
  const world = makeWorld({ seed: 1 });
  const tree = addBody(world, { kind: "tree", hx: 0.28, hy: 1.6, hz: 0.28, x: 0, y: 1.62, z: 20, mass: 260, friction: 0.5 });
  const hpBefore = tree.hp;
  fireProjectile(world, { x: 0, y: 1.62, z: 0 }, { x: 0, y: 0, z: 1 }, 90, { kind: "mg", r: 0.05, kv: 0.3, dmg: 1, crater: 0, attacker: "player" });
  for (let i = 0; i < 60 && world.projectiles.length; i++) stepWorld(world);
  // pre-existing (unguarded) blast-on-tree damage still applies on every hit
  // regardless of the flag — the guard only gates the NEW 4hp/hit direct
  // shred path, so hp loss here must stay far under a single shred hit.
  ok("guard: TD world — tree doesn't take the direct-shred 4hp/hit (only pre-existing blast splash)", (hpBefore - tree.hp) < 2, `hp=${tree.hp} was=${hpBefore}`);
  ok("guard: TD world — tree never ignites without the flag", tree.burning == null, `burning=${tree.burning}`);
}

// ================================================== economy (Task 1)
// makeRegiment: seed-varied strength within bounds, exactly 2 rng draws.
{
  let minHeads = Infinity, maxHeads = -Infinity, minTanks = Infinity, maxTanks = -Infinity;
  let boundsOk = true;
  for (let seed = 1; seed <= 50; seed++) {
    const rng = mulberry32(seed);
    const reg = makeRegiment(rng);
    if (reg.heads < 300 || reg.heads > 500 || reg.tanks < 8 || reg.tanks > 14) boundsOk = false;
    minHeads = Math.min(minHeads, reg.heads); maxHeads = Math.max(maxHeads, reg.heads);
    minTanks = Math.min(minTanks, reg.tanks); maxTanks = Math.max(maxTanks, reg.tanks);
  }
  ok("makeRegiment: heads/tanks stay within bounds over 50 seeds", boundsOk, `heads ${minHeads}..${maxHeads} tanks ${minTanks}..${maxTanks}`);
  ok("makeRegiment: heads0/tanks0 mirror initial heads/tanks", (() => {
    const rng = mulberry32(7);
    const reg = makeRegiment(rng);
    return reg.heads0 === reg.heads && reg.tanks0 === reg.tanks && reg.scrap === 60;
  })());

  // exactly-2-draw contract: a counting rng lets us assert draw count directly,
  // and confirms a 3rd draw (if any leaked in) would change the next value.
  {
    const base = mulberry32(1);
    let n = 0;
    const wrapped = () => { n++; return base(); };
    makeRegiment(wrapped);
    ok("makeRegiment: draws rng exactly twice", n === 2, `draws=${n}`);
  }

  // payResults: fixture arithmetic
  {
    const reg = { scrap: 60, heads: 400, heads0: 400, tanks: 10, tanks0: 10 };
    const ev = { structureDmg: 100, towerKills: 2, wallKills: 3, buildingKills: 1, leaks: 4 };
    payResults(reg, ev);
    const expected = 60 + 100 * RESULTS.structureDmg + 2 * RESULTS.towerKill + 3 * RESULTS.wallKill + 1 * RESULTS.buildingKill + 4 * RESULTS.leak;
    ok("payResults: fixture arithmetic matches RESULTS weights", Math.abs(reg.scrap - expected) < 1e-9, `got=${reg.scrap} expected=${expected}`);
  }
  {
    // uncapped: results can push scrap arbitrarily high, no clamping
    const reg = { scrap: 0, heads: 1, heads0: 400, tanks: 0, tanks0: 10 };
    payResults(reg, { structureDmg: 0, towerKills: 1000, wallKills: 0, buildingKills: 0, leaks: 0 });
    ok("payResults: uncapped by decision — no ceiling on scrap gain", reg.scrap === 1000 * RESULTS.towerKill, reg.scrap);
  }

  // combatIneffective: 12% boundary + tanks>0 blocking
  {
    const heads0 = 400;
    const atBoundary = { heads: 0.12 * heads0, heads0, tanks: 0 };
    ok("combatIneffective: exactly at 12% boundary is NOT ineffective (strict <)", combatIneffective(atBoundary) === false);
    const justUnder = { heads: 0.12 * heads0 - 1, heads0, tanks: 0 };
    ok("combatIneffective: just under 12% with 0 tanks IS ineffective", combatIneffective(justUnder) === true);
    const underHeadsWithTank = { heads: 0.12 * heads0 - 1, heads0, tanks: 1 };
    ok("combatIneffective: tanks>0 blocks ineffective status even under head threshold", combatIneffective(underHeadsWithTank) === false);
    const fullStrength = { heads: heads0, heads0, tanks: 0 };
    ok("combatIneffective: full-strength regiment is not ineffective", combatIneffective(fullStrength) === false);
  }

  // bookValue: symmetry fixture — total is order-independent additive sum
  {
    ok("bookValue: scrap + assets sums directly", bookValue({ scrap: 60, assets: 40 }) === 100);
    ok("bookValue: symmetric under swapping scrap/assets values", bookValue({ scrap: 60, assets: 40 }) === bookValue({ scrap: 40, assets: 60 }));
    ok("bookValue: zero assets reduces to scrap alone", bookValue({ scrap: 77, assets: 0 }) === 77);
    ok("bookValue: STIPEND is a stable per-round constant", STIPEND === 14);
  }
}

// ================================================== the roster returns (Task 2)
// spec value pins — brief's exact acc/windF/windComp, tower-equal by
// Jeff's decision (rifle=mg, gren lob=mortar, tank=gun).
{
  ok("ENEMY_FIRE.rifle acc matches TOWER_SPECS.mg exactly", ENEMY_FIRE.rifle.acc === TOWER_SPECS.mg.acc && ENEMY_FIRE.rifle.acc === 0.090);
  ok("ENEMY_FIRE.rifle windF/windComp match TOWER_SPECS.mg exactly", ENEMY_FIRE.rifle.windF === TOWER_SPECS.mg.windF && ENEMY_FIRE.rifle.windComp === TOWER_SPECS.mg.windComp);
  ok("ENEMY_FIRE.lob acc/windF match TOWER_SPECS.mortar exactly", ENEMY_FIRE.lob.acc === TOWER_SPECS.mortar.acc && ENEMY_FIRE.lob.acc === 0.020 && ENEMY_FIRE.lob.windF === TOWER_SPECS.mortar.windF && ENEMY_FIRE.lob.windF === 0.04);
  ok("ENEMY_FIRE.lob windComp matches TOWER_SPECS.mortar", ENEMY_FIRE.lob.windComp === TOWER_SPECS.mortar.windComp);
  ok("ENEMY_FIRE.tank acc/windF match TOWER_SPECS.gun exactly", ENEMY_FIRE.tank.acc === TOWER_SPECS.gun.acc && ENEMY_FIRE.tank.acc === 0.070 && ENEMY_FIRE.tank.windF === TOWER_SPECS.gun.windF && ENEMY_FIRE.tank.windF === 0.9);
  ok("ENEMY_FIRE.tank windComp matches TOWER_SPECS.gun", ENEMY_FIRE.tank.windComp === TOWER_SPECS.gun.windComp);
  ok("ENEMY_SPECS carries the full roster (conscript/runner/breaker/grenadier/sapper)", ["", "fast", "heavy", "gren", "sapper"].every((k) => ENEMY_SPECS[k]));
  ok("ENEMY_SPECS bounty === TD price (spot check: heavy 12, gren 8, sapper 7, fast 5)", ENEMY_SPECS.heavy.bounty === 12 && ENEMY_SPECS.gren.bounty === 8 && ENEMY_SPECS.sapper.bounty === 7 && ENEMY_SPECS.fast.bounty === 5);
  ok("TANK bounty === TD price (25)", TANK.bounty === 25);
  // (DELETED, P1 T1 mk0.40: "later waves reach the new unit types" pinned the
  // static WAVES table's seeded mixes. The table is gone — nothing seeds a
  // roster any more. The reachability it guarded now lives in the tier-cap
  // asserts at the top of this file.)

  // folded here from the retired TASK 4C block (C0 purge, mk0.31): the enemy
  // marksman's price and armament pins belong with the rest of the mirror.
  {
    const sp = ENEMY_SPECS.sniper;
    // dress re-pinned (C0 T4, mk0.33): the marksman pair lost `dress:
    // "android"` — they are ordinary men in the enemy slate coat now, so the
    // spec must carry NO dress field at all and let troopkit palette them.
    ok("4C spec: ENEMY_SPECS.sniper fielded (speed 2.9, hp 44, bounty 45 = the pair price, no dress — ordinary men)",
      !!sp && sp.speed === 2.9 && sp.hp === 44 && sp.bounty === 45 && sp.dress === undefined, JSON.stringify(sp));
    ok("4C spec: enemy sniper fires INFANTRY_ARMS.sniper verbatim (acc/windF/windComp/dirDmg/range pin)",
      SNIPER_FIRE.acc === INFANTRY_ARMS.sniper.acc && SNIPER_FIRE.windF === INFANTRY_ARMS.sniper.windF &&
      SNIPER_FIRE.windComp === INFANTRY_ARMS.sniper.windComp && SNIPER_FIRE.dirDmg === INFANTRY_ARMS.sniper.dirDmg &&
      SNIPER_FIRE.dmg === INFANTRY_ARMS.sniper.dmg && SNIPER_FIRE.range === INFANTRY_ARMS.sniper.range, JSON.stringify(SNIPER_FIRE));
  }
}

// --- ai.js: the buy brain -------------------------------------------------
const BASE_SNAP = { mortars: 0, mgs: 0, guns: 0, frosts: 0, walls: 0, towerElev: 0 };
function totalUnits(buys) { return buys.reduce((s, b) => s + b.n, 0); }

// determinism: same reg/snap/waveIdx/rng-stream -> identical plan
{
  const reg1 = { heads: 300, tanks: 8, heads0: 300, tanks0: 8, scrap: 60 };
  const reg2 = { ...reg1 };
  const p1 = planWave(reg1, BASE_SNAP, 20, mulberry32(99));
  const p2 = planWave(reg2, BASE_SNAP, 20, mulberry32(99));
  ok("planWave determinism: identical output for identical inputs",
    JSON.stringify(p1) === JSON.stringify(p2));
  ok("planWave determinism: identical resulting regiment state",
    JSON.stringify(reg1) === JSON.stringify(reg2));
}

// depletion: empty pools never go negative, plan degrades gracefully
{
  const emptyReg = { heads: 0, tanks: 0, heads0: 300, tanks0: 8, scrap: 100 };
  const emptyPlan = planWave(emptyReg, BASE_SNAP, 10, mulberry32(5));
  ok("depletion: empty heads/tanks pool yields no buys",
    totalUnits(emptyPlan.buys) === 0, JSON.stringify(emptyPlan.buys));
  ok("depletion: regiment never goes negative",
    emptyReg.heads >= 0 && emptyReg.tanks >= 0 && emptyReg.scrap >= 0);
}

// 50-wave loop: full run against a static snapshot completes, stays solvent
{
  const reg = makeRegiment(mulberry32(11));
  const rng = mulberry32(12);
  const snap = { mortars: 3, mgs: 2, guns: 4, frosts: 1, walls: 2, towerElev: 0 };
  let totalIncome = reg.scrap;
  let negative = false;
  for (let w = 0; w < 50; w++) {
    reg.scrap += STIPEND;
    totalIncome += STIPEND;
    planWave(reg, snap, w, rng);
    if (reg.heads < 0 || reg.tanks < 0 || reg.scrap < 0) negative = true;
  }
  ok("50-wave planWave loop completes without stalling", true);
  ok("50-wave loop: regiment never negative", !negative);
  ok("50-wave loop: total spend stays within total income",
    reg.scrap >= 0 && reg.scrap <= totalIncome, `final scrap=${reg.scrap} income=${totalIncome}`);
}

// --- Task 4: economy wired into the loop ----------------------------------

// fireBell(S, {reg, snap, rng}) composes the assault from planWave —
// spawnQueue/mixBag match the plan's buys exactly.
{
  const S = makeRunState();
  S.started = true;
  const reg = makeRegiment(mulberry32(7));
  fireBell(S, { reg, snap: BASE_SNAP, rng: mulberry32(8), t: BELL_PERIOD_S });
  ok("fireBell: bell index advances to 1", S.bell === 1);
  ok("fireBell: ws.results accumulator reset", S.ws.results &&
    S.ws.results.structureDmg === 0 && S.ws.results.leaks === 0);
  ok("fireBell: spawn queue holds the muster planWave bought", S.ws.spawnQueue > 0, S.ws.spawnQueue);
  // mk0.41 re-pin: the cap is what THEIR PICKS (plus the bell) allow, not the
  // whole tier — read it off the run's own foe state.
  ok("fireBell: the muster only fields tier-open tags",
    S.ws.mixBag.every((t) => enemyTierState(1, S.foe.unlocked).tags.includes(t)), JSON.stringify([...new Set(S.ws.mixBag)]));
  // The prediction has to be taken off the SAME books the bell hands planWave
  // — i.e. after the stipend the bell pays — or the counts can't match.
  // mk0.41 re-pin: the bell now spends MANIFEST_DRAWS + FOE_DRAWS off the same
  // stream BEFORE the muster (and, at bell 1, zero intel draws — openingIntel
  // takes no rng), so the prediction burns exactly those first.
  const regP = makeRegiment(mulberry32(7));
  regP.scrap += STIPEND;
  const rngP = mulberry32(8);
  for (let i = 0; i < MANIFEST_DRAWS + FOE_DRAWS; i++) rngP();
  const predicted = planWave(regP, BASE_SNAP, 1, rngP, enemyTierState(1, S.foe.unlocked).tags);
  ok("fireBell: spawnQueue matches planWave's total buys off the post-stipend books",
    S.ws.spawnQueue === totalUnits(predicted.buys), `${S.ws.spawnQueue} vs ${totalUnits(predicted.buys)}`);
}

// payResults at the bell: the CLOSING assault's accumulated results (structure
// damage + structure kills + leaks) land on reg.scrap via the RESULTS table
// exactly, before the next muster spends anything.
{
  const S = makeRunState();
  S.started = true;
  S.reg = { heads: 0, tanks: 0, heads0: 300, tanks0: 8, scrap: 60 };
  S.ws.results = { structureDmg: 100, towerKills: 2, wallKills: 3, buildingKills: 1, leaks: 2 };
  const scrapBefore = S.reg.scrap;
  fireBell(S, { reg: S.reg, snap: {}, rng: mulberry32(9), t: BELL_PERIOD_S });
  // heads 0 -> the muster buys nothing, so the books show results + stipend.
  const expected = scrapBefore + 100 * RESULTS.structureDmg + 2 * RESULTS.towerKill
    + 3 * RESULTS.wallKill + 1 * RESULTS.buildingKill + 2 * RESULTS.leak + STIPEND;
  ok("fireBell pays the closing assault's results into reg.scrap", Math.abs(S.reg.scrap - expected) < 1e-9,
    `${S.reg.scrap} vs ${expected}`);
}

// STIPEND paid at the bell (moved off the retired stall's advance()).
{
  const S = makeRunState();
  S.started = true;
  S.reg = { heads: 0, tanks: 0, heads0: 300, tanks0: 8, scrap: 60 };
  const before = S.reg.scrap;
  fireBell(S, { reg: S.reg, snap: {}, rng: mulberry32(10), t: BELL_PERIOD_S });
  ok("the bell pays STIPEND into reg.scrap", S.reg.scrap === before + STIPEND, `${S.reg.scrap} vs ${before + STIPEND}`);
}

// Regiment depletion happens ONLY at muster (planWave's buys), never at
// death — a fielded unit's cost is spent the moment it's bought and never
// returns, dead, leaked, or otherwise. A wave's kill events must NOT
// further deplete reg.heads/reg.tanks.
{
  const reg = makeRegiment(mulberry32(9));
  const rng = mulberry32(10);
  const before = { heads: reg.heads, tanks: reg.tanks };
  planWave(reg, BASE_SNAP, 6, rng);
  const afterBuy = { heads: reg.heads, tanks: reg.tanks };
  ok("regiment depletes at muster (buy-time only)",
    afterBuy.heads <= before.heads && afterBuy.tanks <= before.tanks);
  // simulate a wave's worth of kills against this same regiment — nothing
  // in the kill-accounting path touches reg.heads/reg.tanks, so a bare
  // payResults call (the only thing DepotGame.jsx does with kill/leak
  // events on the regiment side) must leave heads/tanks untouched.
  payResults(reg, { structureDmg: 50, towerKills: 3, wallKills: 4, buildingKills: 1, leaks: 0 });
  ok("a wave's kills do not further deplete the regiment",
    reg.heads === afterBuy.heads && reg.tanks === afterBuy.tanks,
    `${reg.heads}/${reg.tanks} vs ${afterBuy.heads}/${afterBuy.tanks}`);
}


// no digits in any emitted line, across 200 seeded compositions covering
// every family (varied buys/banked/reg shapes) plus openingIntel.
{
  let digitFound = null;
  for (let seed = 1; seed <= 200; seed++) {
    const rng = mulberry32(seed);
    const n = 1 + Math.floor(rng() * 40);
    const shapes = [
      { buys: [{ type: "tank", n }], banked: false },
      { buys: [{ type: "", n }, { type: "fast", n }, { type: "sapper", n }], banked: false },
      { buys: [{ type: "sapper", n }], banked: true },
      { buys: [], banked: true },
      null,
    ];
    const prevPlan = shapes[seed % shapes.length];
    const reg = { heads: seed * 3, heads0: 300 + (seed % 200) };
    const lines = composeIntel(prevPlan, reg, rng);
    const opening = openingIntel(reg);
    for (const l of [...lines, opening]) {
      if (/\d/.test(l)) { digitFound = l; break; }
    }
    if (digitFound) break;
  }
  ok("no digits in any composeIntel/openingIntel line across 200 seeded runs", !digitFound, digitFound || "");
}

// --- territory.js: influence field, anchors, slow memory ---
{
  const halfU = 29, halfV = 57;

  // Task 3: depot emitter radius doubled 18 -> 36 (Jeff); anchor stays 14
  // (attacker's muster ground is a strip, not doubled).
  ok("EMIT.depot.r pinned at 36 (Task 3 double)", EMIT.depot.r === 36, EMIT.depot.r);
  ok("EMIT.depot.w unchanged at 2.4", EMIT.depot.w === 2.4, EMIT.depot.w);
  ok("EMIT.anchor.r unchanged at 14 (not doubled)", EMIT.anchor.r === 14, EMIT.anchor.r);

  // valueAt: raw signed field, unflipped, feeds the renderer's area wash.
  {
    const T = makeTerritory(halfU, halfV);
    T.v[0] = 0.42;
    ok("valueAt reads the raw cell value", Math.abs(valueAt(T, -halfU + 1, -halfV + 1) - 0.42) < 1e-6);
    ok("valueAt is 0 out of bounds", valueAt(T, 1e4, 1e4) === 0);
  }

  // area wash alpha ramp (renderer.js's washAlpha, Task 3): 0 at/under the
  // seam threshold, linear to WASH_MAX_A at |v|=1, symmetric on the red side.
  {
    ok("washAlpha is 0 at the seam threshold", washAlpha(WASH_SEAM) === 0);
    ok("washAlpha is 0 well inside the seam", washAlpha(0.05) === 0);
    ok("washAlpha reaches WASH_MAX_A at v=1", Math.abs(washAlpha(1) - WASH_MAX_A) < 1e-9);
    ok("washAlpha is symmetric for the red side", washAlpha(-1) === washAlpha(1));
    const mid = washAlpha(0.5);
    ok("washAlpha ramps monotonically between seam and 1", mid > 0 && mid < WASH_MAX_A, mid);
  }

  // decay halves in ~52s (tau*ln2) with no emitters
  {
    const T = makeTerritory(halfU, halfV);
    T.v.fill(1);
    let t = 0;
    const target = DECAY_TAU * Math.log(2);
    const dt = 0.05;
    while (t < target) { stepTerritory(T, [], dt); t += dt; }
    const mid = T.v[Math.floor(T.v.length / 2)];
    ok("decay halves in ~52s", Math.abs(mid - 0.5) < 0.02, `mid=${mid.toFixed(4)} target=${target.toFixed(2)}`);
  }

  // tower emitter greens its cell within seconds
  {
    const T = makeTerritory(halfU, halfV);
    const emitters = [{ x: 0, z: 0, w: EMIT.tower.w, r: EMIT.tower.r, sign: 1 }];
    for (let i = 0; i < 100; i++) stepTerritory(T, emitters, 0.05); // 5s
    ok("tower emitter greens its cell within seconds", holderAt(T, 0, 0) === 1);
  }

  // opposing emitters at range produce a seam band
  {
    const T = makeTerritory(halfU, halfV);
    const emitters = [
      { x: -10, z: 0, w: EMIT.tower.w, r: EMIT.tower.r, sign: 1 },
      { x: 10, z: 0, w: EMIT.tower.w, r: EMIT.tower.r, sign: -1 },
    ];
    for (let i = 0; i < 400; i++) stepTerritory(T, emitters, 0.05); // 20s
    let sawSeam = false;
    for (let x = -3; x <= 3; x += 2) if (fogStateAt(T, x, 0) === "seam") sawSeam = true;
    ok("opposing emitters at range produce a seam band", sawSeam);
    ok("holder green toward attacker 1's tower", holderAt(T, -10, 0) === 1);
    ok("holder red toward attacker 2's tower", holderAt(T, 10, 0) === 2);
  }

  // anchor stays red after 300s of no enemy presence
  {
    const T = makeTerritory(halfU, halfV);
    const anchor = { x: 0, z: -50, w: EMIT.anchor.w, r: EMIT.anchor.r, sign: -1 };
    let t = 0;
    while (t < 300) { stepTerritory(T, [anchor], 0.5); t += 0.5; }
    ok("anchor stays red after 300s of re-adding it every tick", holderAt(T, 0, -50) === 2);
  }

  // determinism: two identical runs produce identical Float32Array
  {
    function run() {
      const T = makeTerritory(halfU, halfV);
      const emitters = [
        { x: 5, z: 5, w: EMIT.unit.w, r: EMIT.unit.r, sign: 1 },
        { x: -8, z: 12, w: EMIT.vehicle.w, r: EMIT.vehicle.r, sign: -1 },
        { x: 0, z: -40, w: EMIT.anchor.w, r: EMIT.anchor.r, sign: -1 },
      ];
      for (let i = 0; i < 200; i++) stepTerritory(T, emitters, 0.1);
      return T.v;
    }
    const a = run(), b = run();
    let same = a.length === b.length;
    if (same) for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) { same = false; break; }
    ok("determinism: two identical runs produce identical Float32Array", same);
  }

  // holderAt/fogStateAt thresholds
  {
    const T = makeTerritory(halfU, halfV);
    const idx = 0;
    T.v[idx] = 0.16;
    let x0 = -halfU + T.cs / 2, z0 = -halfV + T.cs / 2;
    ok("holderAt threshold >0.15 = green", holderAt(T, x0, z0) === 1);
    ok("fogStateAt threshold >0.15 = held", fogStateAt(T, x0, z0) === "held");
    T.v[idx] = 0.10;
    ok("holderAt at 0.10 (within seam) = neutral", holderAt(T, x0, z0) === 0);
    ok("fogStateAt at 0.10 (within seam) = seam", fogStateAt(T, x0, z0) === "seam");
    T.v[idx] = -0.10;
    ok("holderAt at -0.10 (within seam) = neutral", holderAt(T, x0, z0) === 0);
    ok("fogStateAt at -0.10 (within seam) = seam", fogStateAt(T, x0, z0) === "seam");
    T.v[idx] = -0.16;
    ok("holderAt threshold <-0.15 = red", holderAt(T, x0, z0) === 2);
    ok("fogStateAt threshold <-0.15 = unheld", fogStateAt(T, x0, z0) === "unheld");
    // out-of-bounds = neutral
    ok("holderAt out of bounds = neutral", holderAt(T, 9999, 9999) === 0);
    ok("fogStateAt out of bounds = unheld", fogStateAt(T, 9999, 9999) === "unheld");
  }
}

// --- Phase 4 Task 2: build rights, holder-paid town, targeting boundary ---
{
  const halfU = 29, halfV = 57;

  // build refusal: red/seam ground refused, green ground allowed
  {
    const T = makeTerritory(halfU, halfV);
    const x0 = 0, z0 = 0;
    ok("canBuild refused on neutral/seam ground (fresh field)", canBuild(T, x0, z0) === false);
    const redEmitters = [{ x: x0, z: z0, w: EMIT.tower.w, r: EMIT.tower.r, sign: -1 }];
    for (let i = 0; i < 100; i++) stepTerritory(T, redEmitters, 0.05); // 5s, drives it red
    ok("canBuild refused on red ground", canBuild(T, x0, z0) === false);
    const T2 = makeTerritory(halfU, halfV);
    const greenEmitters = [{ x: x0, z: z0, w: EMIT.tower.w, r: EMIT.tower.r, sign: 1 }];
    for (let i = 0; i < 100; i++) stepTerritory(T2, greenEmitters, 0.05); // 5s, drives it green
    ok("canBuild allowed on green ground", canBuild(T2, x0, z0) === true);
  }

  // acquisition gate, VISION era (mk0.72). RE-PINNED from ground control to
  // SIGHT: a shooter may acquire a target only where his own side has eyes.
  // Territory still paints the ground and still gates building — it no longer
  // gates a single shot, so mk0.26's one-cell contested-ground bridge is gone
  // (men at contact now see each other by plain geometry instead).
  {
    const idUV = (x, z) => ({ u: x, v: z });   // DepotGame's invW at ORIENT 0
    const idW = (u, v) => ({ x: u, z: v });    // DepotGame's fwdU at ORIENT 0
    const flatF = { heightAt: () => 0, dirty: false };
    const put = (w, team, x, z) => addBody(w, { kind: "unit", team, mass: 80, hx: 0.3, hy: 0.9, hz: 0.3, x, y: 0.9, z, hp: 40 });

    // one man a side, 40m apart down the long axis of the field (well inside
    // the grid) — past SIGHT.unit (24), so neither can see where the other
    // stands.
    {
      const T = makeTerritory(halfU, halfV);
      T.sight = makeSight(T);
      const world = makeWorld({ field: flatF, seed: 1 });
      put(world, 1, 0, 0);
      put(world, 2, 0, 40);
      stepSight(world, T.sight, idUV, idW);
      ok("acquisition blocked on ground our side has no eyes on", fieldReaches(T, 0, 40, 1) === false);
      ok("our side sees the ground our own man stands on", fieldReaches(T, 0, 0, 1) === true);
      ok("the attacker sees the ground his own man stands on", fieldReaches(T, 0, 40, 2) === true);
      ok("and the attacker does not see the ground ours stands on", fieldReaches(T, 0, 0, 2) === false);
      // walk a second man up the field: the far ground lights, and the shot
      // opens with it — the whole law of the phase, in one assert.
      put(world, 1, 0, 30);
      stepSight(world, T.sight, idUV, idW);
      ok("acquisition allowed once a friendly eye can see that ground", fieldReaches(T, 0, 40, 1) === true);
    }

    // ground control no longer gates: deep enemy-held ground a friendly eye
    // stands on is shootable. Under the old gate this read "unheld" and
    // vetoed every acquisition.
    {
      const T = makeTerritory(halfU, halfV);
      for (let i = 0; i < 100; i++) stepTerritory(T, [{ x: 0, z: 0, w: EMIT.tower.w, r: EMIT.tower.r, sign: -1 }], 0.05); // 5s red
      ok("territory still paints that ground enemy-held", holderAt(T, 0, 0) === 2);
      T.sight = makeSight(T);
      const world = makeWorld({ field: flatF, seed: 2 });
      put(world, 1, 0, 0);
      stepSight(world, T.sight, idUV, idW);
      ok("enemy-held ground our own eye sees is shootable (ground control no longer gates)", fieldReaches(T, 0, 0, 1) === true);
    }
  }

  // the two escape hatches, unchanged: a world with no territory wired, and a
  // territory with no sight map on it, are both ungated — every bare fixture
  // in this file depends on it.
  {
    ok("fieldReaches with no T is always true (ungated)", fieldReaches(null, 0, 0, 1) === true);
    ok("fieldReaches with a territory carrying no sight map is ungated too", fieldReaches(makeTerritory(halfU, halfV), 0, 0, 1) === true);
  }

  // Phase 3 economics unaffected: massacre-at-the-wall still pays results —
  // rerun a slice of the existing payResults contract untouched by Task 2.
  {
    const reg = { heads: 400, tanks: 10, heads0: 400, tanks0: 10, scrap: 0 };
    payResults(reg, { structureDmg: 100, towerKills: 1, wallKills: 2, buildingKills: 0, leaks: 3 });
    const expect = 100 * RESULTS.structureDmg + 1 * RESULTS.towerKill + 2 * RESULTS.wallKill + 3 * RESULTS.leak;
    ok("Phase 3 economics unaffected: payResults still pays the same", Math.abs(reg.scrap - expect) < 1e-9, reg.scrap);
  }
}

// --- orientation invariance (regression guard for the invW coordinate-
// space bug found in Task 2 review): territory.js's own pure functions
// operate purely on CANONICAL (u, v) space and are orientation-agnostic —
// testing them alone (as above) never touches the world->canonical
// conversion at all, which is exactly what hid the original bug (it was
// invisible on ORIENT===0, where invW is the identity — the only
// orientation this file's map-dependent scenarios ever ran under). These
// asserts exercise orient.js's fwdUFor/invWFor directly, across ALL four
// orientations, plus DepotGame.jsx's real usage pattern (world position ->
// invWFor -> canonical -> territory) for a non-default orientation.
{
  const halfU = 29, halfV = 57;

  // round-trip identity: fwdU then invW recovers the original canonical
  // point, for every orientation DEPOT ships (not just the default)
  for (let ORIENT = 0; ORIENT < 4; ORIENT++) {
    for (const [u, v] of [[0, 0], [12, -30], [-25, 50], [1, -1]]) {
      const w = fwdUFor(ORIENT, u, v);
      const back = invWFor(ORIENT, w.x, w.z);
      const okRT = Math.abs(back.u - u) < 1e-9 && Math.abs(back.v - v) < 1e-9;
      ok(`orientation ${ORIENT}: invWFor(fwdUFor(u,v)) round-trips (u=${u},v=${v})`, okRT, JSON.stringify({ w, back }));
    }
  }

  // a non-default orientation (ORIENT=1: this file's map-dependent scenarios
  // above only ever exercise ORIENT=0) exercising the SAME pattern
  // DepotGame.jsx's buildEmitters/buildAt/stepTowers use: convert a world
  // position via invWFor before ever touching territory.js.
  {
    const ORIENT = 1;
    // (a) a tower emitter greens its own cell
    const T = makeTerritory(halfU, halfV);
    const worldPos = { x: 52, z: 0 }; // off-axis world point — under ORIENT=1
    // this is exactly the shape of position the live bug produced (the
    // depot flag sat at world x=52, well outside T's halfU=29 bound; only
    // the invW-converted canonical point falls inside the grid)
    const c = invWFor(ORIENT, worldPos.x, worldPos.z);
    ok("orientation 1: world position converts inside the territory grid", Math.abs(c.u) <= halfU && Math.abs(c.v) <= halfV, JSON.stringify(c));
    // regression guard: the raw (unconverted) world coordinates read as
    // out-of-bounds/neutral — this is the exact failure mode of the bug
    // (holderAt on raw world x/z instead of the invW-converted canonical
    // point), reproduced here so a future regression trips this assert
    ok("orientation 1: regression guard — WITHOUT invW conversion this world point reads out-of-bounds/neutral", holderAt(T, worldPos.x, worldPos.z) === 0);
    const emitters = [{ x: c.u, z: c.v, w: EMIT.tower.w, r: EMIT.tower.r, sign: 1 }];
    for (let i = 0; i < 100; i++) stepTerritory(T, emitters, 0.05); // 5s
    ok("orientation 1: tower emitter greens its own cell (canonical, post-invW)", holderAt(T, c.u, c.v) === 1);

    // (b) build refusal/allow
    ok("orientation 1: canBuild allowed at the greened canonical cell", canBuild(T, c.u, c.v) === true);
    const farWorld = { x: -40, z: 0 }; // invWFor(1,...) -> {u:0,v:40}: inside the grid, far from the emitter at (0,-52)
    const cFar = invWFor(ORIENT, farWorld.x, farWorld.z);
    ok("orientation 1: canBuild refused far from the emitter", canBuild(T, cFar.u, cFar.v) === false);

    // (c) targeting gate, both directions. RE-PINNED to sight (mk0.72): the
    // gate reads the sight map now, so the same world->canonical conversion
    // is exercised through stepSight's own transforms (fwdUFor/invWFor at
    // ORIENT 1, not the identity) — the regression guard this block exists
    // for is stronger under sight than it was under territory.
    const oUV = (x, z) => invWFor(ORIENT, x, z);
    const oW = (u, v) => fwdUFor(ORIENT, u, v);
    const flatF = { heightAt: () => 0, dirty: false };
    const putO = (w, team, x, z) => addBody(w, { kind: "unit", team, mass: 80, hx: 0.3, hy: 0.9, hz: 0.3, x, y: 0.9, z, hp: 40 });
    const Tsee = makeTerritory(halfU, halfV);
    Tsee.sight = makeSight(Tsee);
    const wSee = makeWorld({ field: flatF, seed: 21 });
    putO(wSee, 1, worldPos.x, worldPos.z);      // our man stands at the world point
    stepSight(wSee, Tsee.sight, oUV, oW);
    ok("orientation 1: our side sees the canonical cell our own man stands on", fieldReaches(Tsee, c.u, c.v, 1) === true);
    ok("orientation 1: the attacker has no eyes there", fieldReaches(Tsee, c.u, c.v, 2) === false);
    // the far cell, with only an attacker standing on it
    const T2 = makeTerritory(halfU, halfV);
    T2.sight = makeSight(T2);
    const wSee2 = makeWorld({ field: flatF, seed: 22 });
    putO(wSee2, 2, farWorld.x, farWorld.z);
    stepSight(wSee2, T2.sight, oUV, oW);
    ok("orientation 1: our side is blind on ground only the attacker stands on", fieldReaches(T2, cFar.u, cFar.v, 1) === false);
    ok("orientation 1: the attacker sees his own ground", fieldReaches(T2, cFar.u, cFar.v, 2) === true);
  }
}

// ============================================================ Task 3: placement preview + confirm
{
  const flatWorld = () => ({ field: { heightAt: () => 0 }, bodies: [] });
  const spec = { range: 20, hy: 1.0, projSpeed: 60, occl: "arc" };

  // --- effRange pins
  ok("effRange: flat ground = 1.0x", effRange(flatWorld(), { x: 0, y: 0, z: 0 }, spec) === spec.range);
  ok("effRange: +6m elevation = 1.12x", Math.abs(effRange(flatWorld(), { x: 0, y: 6, z: 0 }, spec) - spec.range * 1.12) < 1e-9,
    effRange(flatWorld(), { x: 0, y: 6, z: 0 }, spec));
  ok("effRange: caps at 1.2x (well beyond +10m)", effRange(flatWorld(), { x: 0, y: 40, z: 0 }, spec) === spec.range * 1.2);
  ok("effRange: no downhill penalty (muzzle below surround clamps to 0 elev)", effRange(flatWorld(), { x: 0, y: -20, z: 0 }, spec) === spec.range);

  // --- enemy symmetric consumption: units.js's stepRifleman/stepGrenadier/
  // stepTank all import effRange from state.js (grep-verified below rather
  // than re-simulating a full unit tick here — the sim behavior is
  // exercised by the rest of this file's unit tests; this asserts the
  // wiring itself so a future edit that reverts to spec.range trips it).
  {
    const unitsSrc = fs.readFileSync(new URL("../src/depot/units.js", import.meta.url), "utf8");
    ok("units.js imports effRange from state.js", /import\s*\{[^}]*effRange[^}]*\}\s*from\s*"\.\/state\.js"/.test(unitsSrc));
    ok("units.js's tank/rifle/grenadier scans consume effRange (not raw spec.range) for their threshold", (unitsSrc.match(/effRange\(world,\s*muzzle,\s*fspec\)/g) || []).length === 3);
  }

  // --- reachPolygon
  {
    const muzzle = { x: 0, y: 1.5, z: 0 };
    const flatPoly = reachPolygon(flatWorld(), null, muzzle, spec, 1);
    ok("reachPolygon: 64 points", flatPoly.length === 64);
    ok("reachPolygon: open flat ground reaches ~full effRange", Math.hypot(flatPoly[0].x - muzzle.x, flatPoly[0].z - muzzle.z) > spec.range - 1.5,
      Math.hypot(flatPoly[0].x, flatPoly[0].z));

    // wall fixture due east (+x) at x=10 — the ray toward +x (index 0) must
    // stop well short of spec.range; a ray away from it (index 32, -x) is
    // unaffected. Tall (hy 2.5, spans y 0..5) so the gun's real arc — which
    // can climb well above a short wall's 1.8m by mid-lane — still can't
    // clear over it; a short wall is a legitimate arc-over case now that
    // reachPolygon tests the true flight path instead of a straight line.
    const wallWorld = { field: { heightAt: () => 0 }, bodies: [
      { alive: true, invM: 0, kind: "wall", pos: { x: 10, y: 2.5, z: 0 }, hx: 0.9, hy: 2.5, hz: 0.9 },
    ] };
    const wallPoly = reachPolygon(wallWorld, null, muzzle, spec, 1);
    const eastDist = Math.hypot(wallPoly[0].x - muzzle.x, wallPoly[0].z - muzzle.z);
    const westDist = Math.hypot(wallPoly[32].x - muzzle.x, wallPoly[32].z - muzzle.z);
    ok("reachPolygon: ray toward a wall fixture stops short of it", eastDist < 10.5 && eastDist > 0, eastDist);
    ok("reachPolygon: ray away from the wall reaches full range, unaffected", westDist > spec.range - 1.5, westDist);

    // sight boundary clip. RE-PINNED (mk0.72): the boundary reachPolygon
    // clips at is the edge of what our side can SEE, not the edge of the
    // ground it holds — territory emitters no longer clip anything. The
    // sight map is stamped by hand here (lit only west of x=8) because this
    // is a reachPolygon test, not a sight test: it needs a boundary at a
    // known place, and stepSight's own answers are pinned in VISION T1.
    const halfU = 29, halfV = 57;
    const T = makeTerritory(halfU, halfV);
    T.sight = makeSight(T);
    for (let iz = 0; iz < T.sight.nz; iz++) for (let ix = 0; ix < T.sight.nx; ix++) {
      const u = -T.sight.halfU + (ix + 0.5) * T.sight.cs;
      if (u < 8) T.sight.seen1[iz * T.sight.nx + ix] = 1;
    }
    const foggedPoly = reachPolygon(flatWorld(), T, muzzle, spec, 1);
    const foggedDist = Math.hypot(foggedPoly[0].x - muzzle.x, foggedPoly[0].z - muzzle.z);
    const westSeen = Math.hypot(foggedPoly[32].x - muzzle.x, foggedPoly[32].z - muzzle.z);
    ok("reachPolygon: the sight boundary clips rays well short of open-flat full range", foggedDist < spec.range - 3, foggedDist);
    ok("reachPolygon: a ray into ground we do see reaches full range", westSeen > spec.range - 1.5, westSeen);
  }

  // --- arcClears (Phase 4.1 Task 1): the round's true flight path, not a
  // straight-line sightline.
  {
    // "arc" spec: a flat-ish trajectory that still bulges above the straight
    // muzzle-target line (gravity), enough to clear a low crest the old
    // straight-line test would have rejected.
    {
      const world = { field: { heightAt: (x) => (Math.abs(x - 10) < 1 ? 3.5 : 0) }, bodies: [] };
      const muzzle = { x: 0, y: 2, z: 0 }, target = { x: 20, y: 2, z: 0 };
      const spec = { projSpeed: 16, occl: "arc" };
      // old straight-line test (groundY + TARGET_H(1.2) > line(2)) would reject: 3.5+1.2 > 2
      ok("arcClears: gun's true arc clears a low crest the straight line would reject", arcClears(world, muzzle, target, spec));
    }
    // "arc" spec: a wall sitting directly in the flat lane still blocks.
    {
      const world = { field: { heightAt: () => 0 }, bodies: [
        { alive: true, invM: 0, kind: "wall", pos: { x: 8, y: 1.5, z: 0 }, hx: 0.9, hy: 1.5, hz: 0.9 },
      ] };
      const muzzle = { x: 0, y: 1.95, z: 0 }, target = { x: 16, y: 1.2, z: 0 };
      const spec = { projSpeed: 58, occl: "arc" };
      ok("arcClears: gun is still blocked by a wall directly in the flat lane", !arcClears(world, muzzle, target, spec));
    }
    // "lofted" spec: ignores terrain and a wall well beyond its own
    // muzzle climb-out cone (first 15% of flight)...
    {
      const muzzle = { x: 0, y: 1.0, z: 0 }, target = { x: 30, y: 0, z: 0 };
      const wallWorld = { field: { heightAt: () => 1e3 }, bodies: [
        { alive: true, invM: 0, kind: "wall", pos: { x: 20, y: 5, z: 0 }, hx: 1, hy: 5, hz: 1 },
      ] };
      const spec = { projSpeed: 33, occl: "lofted" };
      ok("arcClears: mortar (lofted) ignores terrain and a wall beyond its own climb-out cone", arcClears(wallWorld, muzzle, target, spec));
      // ...but NOT a wall sitting in its own climb-out cone (can't mortar
      // out from under your own wall's overhang).
      const ownWallWorld = { field: { heightAt: () => 1e3 }, bodies: [
        { alive: true, invM: 0, kind: "wall", pos: { x: 2, y: 1.7, z: 0 }, hx: 0.5, hy: 1.7, hz: 0.5 },
      ] };
      ok("arcClears: mortar (lofted) is blocked firing out from under its own wall's climb-out cone", !arcClears(ownWallWorld, muzzle, target, spec));
    }
    // Playtest item 1: a gun tower on a rise, firing DOWNSLOPE at a target
    // in plain sight, must not self-block. The tower's own AABB IS a "tower"
    // kind solid (SOLID_KINDS), and its muzzle sits only 0.45m above the top
    // of that box. A steeply DEPRESSED downslope arc (target both close and
    // well below the tower) drops fast enough that its very first sample
    // (s=0.9m from the muzzle, diagonal so both the x and z offsets stay
    // under the tower's own hx/hz=0.8 footprint) lands back inside the
    // tower's own y-range too — solidBlocksPoint without a selfId exclusion
    // reports the tower's OWN box as the obstruction. Terrain is flat here
    // (heightAt always 0, far below every sampled arc point) specifically so
    // the block can ONLY be attributed to the self-box, not a terrain
    // clearance false-positive. Fails (arcClears false) without selfId
    // threaded through; passes with it (the fix).
    {
      const hy = 1.6, hx = 0.8, hz = 0.8, centerY = 9;
      const towerBody = { id: 501, alive: true, invM: 0, kind: "tower", pos: { x: 0, y: centerY, z: 0 }, hx, hy, hz };
      const world = { field: { heightAt: () => 0 }, bodies: [towerBody] };
      const muzzle = { x: 0, y: centerY + hy + 0.45, z: 0 };
      const target = { x: 6, y: 0, z: 6 }; // steep, close-in, downhill and diagonal
      const spec = { projSpeed: 45, occl: "arc" };
      ok("arcClears: downslope tower shot self-blocks WITHOUT selfId (repro of the bug)", !arcClears(world, muzzle, target, spec));
      ok("arcClears: downslope tower shot clears WITH selfId excluding its own body (the fix)", arcClears(world, muzzle, target, spec, towerBody.id));
    }
    // reachPolygon: a lofted spec on open ground is ~a full circle (range/fog
    // limited only) — min radial reach > 0.9x effRange across all azimuths.
    {
      const spec = { range: 26, projSpeed: 33, occl: "lofted", hy: 0.8 };
      const muzzle = { x: 0, y: 2.0, z: 0 };
      const poly = reachPolygon({ field: { heightAt: () => 0 }, bodies: [] }, null, muzzle, spec, 1);
      let minR = Infinity;
      for (const p of poly) minR = Math.min(minR, Math.hypot(p.x - muzzle.x, p.z - muzzle.z));
      ok("reachPolygon: mortar (lofted) on open ground is ~a full circle", minR > 0.9 * spec.range, minR);
    }
  }

  // --- confirm state machine, headless
  {
    ok("PENDING_ARM_S is 0.35 (brief: armed 350ms)", PENDING_ARM_S === 0.35);
    const cost = 15;
    const v1 = validatePlacement({ blocked: false, ice: false, held: true, resources: 100, cost });
    ok("validatePlacement: ok when unblocked/unfrozen/held/affordable", v1.ok === true);
    ok("validatePlacement: OCCUPIED", validatePlacement({ blocked: true, ice: false, held: true, resources: 100, cost }).msg === "OCCUPIED");
    ok("validatePlacement: ice", validatePlacement({ blocked: false, ice: true, held: true, resources: 100, cost }).msg.includes("frozen"));
    ok("validatePlacement: GROUND NOT HELD", validatePlacement({ blocked: false, ice: false, held: false, resources: 100, cost }).msg === "GROUND NOT HELD");
    ok("validatePlacement: NO SCRAP", validatePlacement({ blocked: false, ice: false, held: true, resources: 4, cost }).msg === "NO SCRAP");

    // full headless drive: select -> pending (no scrap spent) -> before-armed
    // confirm no-ops -> after-armed confirm places+deducts; separately,
    // cancel leaves everything untouched.
    const world = makeWorld({ field: { heightAt: () => 0, dirty: false }, seed: 5 });
    world.t = 10;
    let resources = 100;
    const pending = { gx: 3, gz: 4, mode: "mg", cost, armedAt: world.t + PENDING_ARM_S };
    ok("select -> pending: no scrap spent yet", resources === 100);
    ok("confirm before armed: no-op (trailing-tap guard)", pendingArmed(pending, world.t) === false);
    world.t += 0.2; // still short of 0.35
    ok("confirm still not armed at +0.2s", pendingArmed(pending, world.t) === false);
    world.t += 0.2; // now past 0.35 total
    ok("confirm armed at +0.4s total", pendingArmed(pending, world.t) === true);
    // confirm: deducts + places (mirrors DepotGame.jsx's confirmPending -> buildAt)
    if (pendingArmed(pending, world.t)) {
      resources -= pending.cost;
      addBody(world, { kind: "tower", team: 1, mass: 0, hx: 0.8, hy: 1, hz: 0.8, x: pending.gx, y: 1, z: pending.gz, hp: 80 });
    }
    ok("confirm: scrap deducted", resources === 100 - cost, resources);
    ok("confirm: tower placed", world.bodies.some((b) => b.kind === "tower"));

    // cancel path: fresh pending, never confirmed, dropped
    let resources2 = 100;
    const world2 = makeWorld({ field: { heightAt: () => 0, dirty: false }, seed: 5 });
    let pending2 = { gx: 1, gz: 1, mode: "mg", cost, armedAt: world2.t + PENDING_ARM_S };
    world2.t += 1; // well past armed
    pending2 = null; // ✗ cancel
    ok("cancel: no scrap deducted", resources2 === 100);
    ok("cancel: no body placed", world2.bodies.filter((b) => b.kind === "tower").length === 0);
  }
}

// --- friendlyFouls / fire discipline (Phase 4.1 Task 2)
{
  // "arc" spec (gun): a friendly (team-1) wall sitting mid-lane between
  // muzzle and target fouls the shot.
  {
    const world = { field: { heightAt: () => 0 }, bodies: [
      { alive: true, invM: 0, kind: "wall", team: 1, pos: { x: 8, y: 1.5, z: 0 }, hx: 0.9, hy: 1.5, hz: 0.9 },
    ] };
    const muzzle = { x: 0, y: 1.95, z: 0 }, target = { x: 16, y: 1.2, z: 0 };
    const spec = { projSpeed: 58, occl: "arc" };
    ok("friendlyFouls: gun's arc through a friendly wall mid-lane fouls", friendlyFouls(world, muzzle, target, spec));
  }
  // clear lane (no friendly body) — no foul.
  {
    const world = { field: { heightAt: () => 0 }, bodies: [] };
    const muzzle = { x: 0, y: 1.95, z: 0 }, target = { x: 16, y: 1.2, z: 0 };
    const spec = { projSpeed: 58, occl: "arc" };
    ok("friendlyFouls: clear lane does not foul", !friendlyFouls(world, muzzle, target, spec));
  }
  // enemy (team-2) or town chunk bodies aren't "friendly" unless team 0/1 —
  // a team-2 unit sitting in the lane must NOT count as a foul.
  {
    const world = { field: { heightAt: () => 0 }, bodies: [
      { alive: true, invM: 0, kind: "unit", team: 2, pos: { x: 8, y: 1.5, z: 0 }, hx: 0.9, hy: 1.5, hz: 0.9 },
    ] };
    const muzzle = { x: 0, y: 1.95, z: 0 }, target = { x: 16, y: 1.2, z: 0 };
    const spec = { projSpeed: 58, occl: "arc" };
    ok("friendlyFouls: an enemy body in the lane does not foul", !friendlyFouls(world, muzzle, target, spec));
  }
  // "lofted" spec (mortar): the SAME friendly wall, well outside the
  // muzzle climb-out cone, does not foul — the arc clears over it.
  {
    const world = { field: { heightAt: () => 1e3 }, bodies: [
      { alive: true, invM: 0, kind: "wall", team: 1, pos: { x: 8, y: 1.5, z: 0 }, hx: 0.9, hy: 1.5, hz: 0.9 },
    ] };
    const muzzle = { x: 0, y: 1.0, z: 0 }, target = { x: 30, y: 0, z: 0 };
    const spec = { projSpeed: 33, occl: "lofted" };
    ok("friendlyFouls: mortar (lofted) fires over a friendly wall outside its climb-out cone", !friendlyFouls(world, muzzle, target, spec));
  }
  // "lofted" spec: a friendly wall sitting IN the muzzle climb-out cone
  // still fouls (can't mortar out from under your own wall's overhang).
  {
    const world = { field: { heightAt: () => 1e3 }, bodies: [
      { alive: true, invM: 0, kind: "wall", team: 1, pos: { x: 2, y: 1.7, z: 0 }, hx: 0.5, hy: 1.7, hz: 0.5 },
    ] };
    const muzzle = { x: 0, y: 1.0, z: 0 }, target = { x: 30, y: 0, z: 0 };
    const spec = { projSpeed: 33, occl: "lofted" };
    ok("friendlyFouls: mortar (lofted) still fouls on its own wall's climb-out cone", friendlyFouls(world, muzzle, target, spec));
  }
  // a town/depot chunk (team 0) counts as friendly too.
  {
    const world = { field: { heightAt: () => 0 }, bodies: [
      { alive: true, invM: 0, kind: "chunk", team: 0, pos: { x: 8, y: 1.5, z: 0 }, hx: 0.9, hy: 1.5, hz: 0.9 },
    ] };
    const muzzle = { x: 0, y: 1.95, z: 0 }, target = { x: 16, y: 1.2, z: 0 };
    const spec = { projSpeed: 58, occl: "arc" };
    ok("friendlyFouls: a town/depot chunk (team 0) in the lane fouls", friendlyFouls(world, muzzle, target, spec));
  }

  // --- CAREFUL / FREE discipline fixture: tower, friendly wall mid-lane,
  // enemy beyond it. Mirrors stepTowers's own gate (DepotGame.jsx) —
  // CAREFUL holds the trigger pull when friendlyFouls is true (ordnance
  // count stays static across several cadence windows); FREE fires
  // regardless. A lofted mortar spec fires even under CAREFUL because its
  // arc clears the wall.
  {
    const gunSpec = { kind: "gun", projSpeed: 58, occl: "arc", volley: 1, acc: 0.02, blastR: 0, kv: 1, dmg: 1, fireRate: 0.2 };
    const makeFixture = () => {
      const world = makeWorld({ field: { heightAt: () => 0, dirty: false }, seed: 1 });
      const tower = addBody(world, { kind: "tower", team: 1, mass: 0, hx: 0.8, hy: 1, hz: 0.8, x: 0, y: 1, z: 0, hp: 80 });
      addBody(world, { kind: "wall", team: 1, mass: 0, hx: 0.9, hy: 0.9, hz: 0.9, x: 8, y: 0.9, z: 0, hp: 70 });
      const target = addBody(world, { kind: "unit", team: 2, mass: 90, hx: 0.4, hy: 0.9, hz: 0.4, x: 16, y: 0.9, z: 0, hp: 30 });
      target.v = { x: 0, y: 0, z: 0 };
      return { world, tower, target };
    };
    const runCadence = (discipline, spec, pulls = 5) => {
      const { world, tower, target } = makeFixture();
      const muzzle = { x: tower.pos.x, y: tower.pos.y + tower.hy + 0.45, z: tower.pos.z };
      for (let i = 0; i < pulls; i++) {
        if (discipline === "free" || !friendlyFouls(world, muzzle, target.pos, spec)) {
          towerShot(world, tower, target, spec);
        }
      }
      return world.projectiles.length;
    };
    ok("fire discipline: CAREFUL holds the shot over a friendly wall (no ordnance fired)", runCadence("careful", gunSpec) === 0);
    ok("fire discipline: FREE fires regardless of the friendly wall", runCadence("free", gunSpec) > 0);
    const mortarSpec = { kind: "mortar", projSpeed: 33, occl: "lofted", volley: 1, acc: 0.02, blastR: 0, kv: 1, dmg: 1, fireRate: 0.2 };
    ok("fire discipline: a lofted mortar fires over the same wall even under CAREFUL", runCadence("careful", mortarSpec) > 0);
  }

  // folded here from the retired F1 VERIFICATION FIXES block (C0 purge,
  // mk0.31): friendlyFouls holds for OUR depot masonry, fires through THEIRS.
  {
    const world = makeWorld({ field: { heightAt: () => 0, dirty: false, carve: () => {} }, seed: 12 });
    const spec = { projSpeed: 95, occl: "arc" };
    const muzzle = { x: 0, y: 1.5, z: 0 }, tgt = { x: 0, y: 1.2, z: 16 };
    const c = addBody(world, { kind: "chunk", team: 0, mass: 100, hx: .4, hy: .4, hz: .4, x: 0, y: 1.2, z: 8, hp: 50 });
    c.town = "depot";
    ok("F1-fix B: CAREFUL holds for own depot stone", friendlyFouls(world, muzzle, tgt, spec) === true);
    c.town = "depot2";
    ok("F1-fix B: CAREFUL fires through enemy depot stone", friendlyFouls(world, muzzle, tgt, spec) === false);
  }
}

// --- structural loss (Task 5): the depot's chunk lattice IS its health bar.
// censusDepotChunks/depotStandingFraction/checkDepotBreach are pure, so this
// drives them against a hand-built lattice (same gpos-chunk shape buildTown
// produces, tagged .town === "depot") rather than the full DepotGame.jsx
// boot (JSX, not importable headlessly).
{
  const { hcs, pitch, mass } = MASON;
  const buildDepotLattice = (nx = 5, ny = 2, nz = 5) => {
    const world = makeWorld({ field: { heightAt: () => 0, dirty: false, carve: () => {} }, seed: 1 });
    const chunks = [];
    for (let ix = 0; ix < nx; ix++) for (let iy = 0; iy <= ny; iy++) for (let iz = 0; iz < nz; iz++) {
      const c = addBody(world, {
        kind: "chunk", team: 0, mass, hx: hcs, hy: hcs, hz: hcs,
        x: (ix - (nx - 1) / 2) * pitch, y: hcs + 0.02 + iy * pitch, z: (iz - (nz - 1) / 2) * pitch,
        friction: 0.65, restitution: 0.02,
      });
      c.sleeping = true; c.town = "depot"; c.gpos = [ix, iy, iz];
      chunks.push(c);
    }
    return { world, chunks };
  };

  // census at spawn: full lattice, nothing moved or killed yet -> 1.0.
  const spawnFixture = buildDepotLattice();
  const spawnCensus = censusDepotChunks(spawnFixture.world.bodies);
  ok("depot census picks up every depot chunk at build", spawnCensus.length === spawnFixture.chunks.length, `n=${spawnCensus.length}`);
  ok("depot census fraction is 1.0 at spawn (nothing moved or killed)",
    depotStandingFraction(spawnCensus, spawnFixture.world.byId) === 1);

  // scripted demolition: kill ~1/4 outright, displace another ~1/4 well past
  // the standing tolerance (a launched stone, still "alive" but not home) —
  // together crossing the 0.58 breach line without either tactic alone
  // needing to carry the whole fraction.
  const demoFixture = buildDepotLattice();
  const demoCensus = censusDepotChunks(demoFixture.world.bodies);
  const half = demoFixture.chunks.length / 2;
  for (let i = 0; i < demoFixture.chunks.length; i++) {
    const c = demoFixture.chunks[i];
    if (i < half / 2) c.alive = false; // outright destroyed
    else if (i < half) c.pos = { x: c.pos.x + 20, y: c.pos.y, z: c.pos.z }; // launched well past 1.2m
  }
  const demoFraction = depotStandingFraction(demoCensus, demoFixture.world.byId);
  ok(`half the depot demolished (kill+displace) crosses the ${DEPOT_BREACH_FRAC} breach line`,
    demoFraction < DEPOT_BREACH_FRAC, `fraction=${demoFraction}`);
  ok("a displaced-but-alive stone does not count as standing (demolition semantics)",
    demoFraction <= 0.5 + 1e-9, `fraction=${demoFraction}`);

  const Sb = makeRunState();
  Sb.started = true;
  const breached = checkDepotBreach(Sb, demoFraction);
  ok("checkDepotBreach fires when standing fraction crosses the line", breached === true);
  ok("checkDepotBreach sets gameOver", Sb.gameOver === true);
  ok("checkDepotBreach flags breach (distinct from lives-loss/ledger-loss)", Sb.breach === true);
  ok("checkDepotBreach does not set victory", Sb.victory === false);
  ok("checkDepotBreach is idempotent (no-op once gameOver)", checkDepotBreach(Sb, 0) === false);

  const breachCard = makeEndDispatch({ victory: false, kills: 4, wave: 3, totalWaves: 50, breach: true });
  ok("breach end card leads with the depot-is-breached line", breachCard.lines[0] === "THE DEPOT IS BREACHED.");
  ok("breach end card carries the withdrawal-under-fire line", breachCard.lines.includes("The position is lost. Withdrawal under fire."));
  ok("breach end card is digit-free (bureau voice, no wave/kill counters)", !breachCard.lines.some((l) => /\d/.test(l)));

  // FRONT F1: the lives track is gone — checkLoss (regiment stub only)
  // never fires, and a fully-standing depot never trips the breach.
  const Sl = makeRunState();
  Sl.started = true;
  ok("checkLoss without the regiment stub never fires (lives retired)", checkLoss(Sl) === false && Sl.gameOver === false && !Sl.breach);
  ok("a fully-standing depot (1.0) never trips checkDepotBreach", checkDepotBreach({ gameOver: false, victory: false }, 1) === false);

  // census cadence: stepDepotCensus must gate computeFraction to ~1Hz
  // (DEPOT_CENSUS_HZ), not call it every frame regardless of how many small
  // ticks it's fed. 10 ticks of 0.25s = 2.5s of sim time -> exactly
  // floor(2.5 * DEPOT_CENSUS_HZ) = 2 calls.
  {
    let calls = 0;
    const Sc = { depotCensusAcc: 0, gameOver: false, victory: false };
    for (let i = 0; i < 10; i++) stepDepotCensus(Sc, 0.25, () => { calls++; return 1; });
    ok(`census cost sanity: runs at ~${DEPOT_CENSUS_HZ}Hz, not per frame (10x 0.25s ticks -> ${calls} calls)`, calls === 2);
    // and a single huge-dt tick (a paused/backgrounded tab catching up)
    // still only fires once per crossed 1/Hz boundary it actually reports —
    // no runaway loop, no crash.
    let calls2 = 0;
    const Sc2 = { depotCensusAcc: 0, gameOver: false, victory: false };
    stepDepotCensus(Sc2, 0.01, () => { calls2++; return 1; });
    ok("census does not fire on a sub-threshold tick", calls2 === 0);
  }
}

// --- FRONT F1 Task 2: both depots can fall. The enemy depot ("depot2") gets
// its own census reading and a victory-signed breach mirror; one 1Hz gate
// carries both fractions ({player, enemy}) and both breach checks.
{
  const { hcs, pitch, mass } = MASON;
  const buildLattice = (townId, nx = 5, ny = 2, nz = 5) => {
    const world = makeWorld({ field: { heightAt: () => 0, dirty: false, carve: () => {} }, seed: 1 });
    const chunks = [];
    for (let ix = 0; ix < nx; ix++) for (let iy = 0; iy <= ny; iy++) for (let iz = 0; iz < nz; iz++) {
      const c = addBody(world, {
        kind: "chunk", team: 0, mass, hx: hcs, hy: hcs, hz: hcs,
        x: (ix - (nx - 1) / 2) * pitch, y: hcs + 0.02 + iy * pitch, z: (iz - (nz - 1) / 2) * pitch,
        friction: 0.65, restitution: 0.02,
      });
      c.sleeping = true; c.town = townId; c.gpos = [ix, iy, iz];
      chunks.push(c);
    }
    return { world, chunks };
  };
  // one world holding BOTH lattices — the townId filter must separate them.
  const both = makeWorld({ field: { heightAt: () => 0, dirty: false, carve: () => {} }, seed: 1 });
  const mk = (townId, x0) => {
    const out = [];
    for (let ix = 0; ix < 3; ix++) for (let iy = 0; iy <= 1; iy++) for (let iz = 0; iz < 3; iz++) {
      const c = addBody(both, {
        kind: "chunk", team: 0, mass, hx: hcs, hy: hcs, hz: hcs,
        x: x0 + ix * pitch, y: hcs + 0.02 + iy * pitch, z: iz * pitch,
        friction: 0.65, restitution: 0.02,
      });
      c.sleeping = true; c.town = townId; out.push(c);
    }
    return out;
  };
  const pChunks = mk("depot", -20), eChunks = mk("depot2", 20);
  const pCensus = censusDepotChunks(both.bodies);
  const pCensusExplicit = censusDepotChunks(both.bodies, "depot");
  const eCensus = censusDepotChunks(both.bodies, "depot2");
  ok("censusDepotChunks default townId stays 'depot' (today's callers honest)", pCensus.length === pChunks.length && pCensus.length === pCensusExplicit.length);
  ok("censusDepotChunks('depot2') picks only the enemy lattice", eCensus.length === eChunks.length);
  ok("the two censuses share no ids", !pCensus.some((c) => eCensus.some((d) => d.id === c.id)));

  // scripted demolition of depot2: displace past DEPOT_STANDING_TOL (the
  // census's own standing rule) until the fraction crosses the line.
  const demolish = (chunks, n) => { for (let i = 0; i < n; i++) chunks[i].pos = { x: chunks[i].pos.x, y: chunks[i].pos.y + DEPOT_STANDING_TOL + 5, z: chunks[i].pos.z }; };
  demolish(eChunks, Math.ceil(eChunks.length * (1 - DEPOT_BREACH_FRAC)) + 1);
  const eFrac = depotStandingFraction(eCensus, both.byId);
  ok(`depot2 demolition drives its fraction below ${DEPOT_BREACH_FRAC}`, eFrac < DEPOT_BREACH_FRAC, `frac=${eFrac}`);
  ok("player census unmoved by depot2 demolition", depotStandingFraction(pCensus, both.byId) === 1);

  // checkEnemyBreach: victory-signed mirror.
  const Sv = makeRunState();
  Sv.started = true;
  const won = checkEnemyBreach(Sv, eFrac);
  ok("checkEnemyBreach fires below the shared threshold", won === true);
  ok("checkEnemyBreach sets victory (not gameOver)", Sv.victory === true && !Sv.gameOver);
  ok("checkEnemyBreach flags enemyBreach", Sv.enemyBreach === true);
  ok("checkEnemyBreach is idempotent once victory is set", checkEnemyBreach(Sv, 0) === false);
  ok("a fully-standing enemy depot never trips checkEnemyBreach", checkEnemyBreach({ gameOver: false, victory: false }, 1) === false);

  // whichever breach fires first wins — the other never overwrites (both orders).
  const Sa = makeRunState(); Sa.started = true;
  checkDepotBreach(Sa, 0.1); checkEnemyBreach(Sa, 0.1);
  ok("player breach first: enemy breach never overwrites (loss stands)", Sa.gameOver === true && Sa.breach === true && !Sa.victory && !Sa.enemyBreach);
  const Sz = makeRunState(); Sz.started = true;
  checkEnemyBreach(Sz, 0.1); checkDepotBreach(Sz, 0.1);
  ok("enemy breach first: player breach never overwrites (victory stands)", Sz.victory === true && Sz.enemyBreach === true && !Sz.gameOver && !Sz.breach);

  // one gate, two readings: stepDepotCensus's compute returns {player, enemy};
  // the gate stores both and calls both breach checks — still ~1Hz.
  {
    let calls = 0;
    const Sc = { depotCensusAcc: 0, gameOver: false, victory: false };
    for (let i = 0; i < 10; i++) stepDepotCensus(Sc, 0.25, () => { calls++; return { player: 0.9, enemy: 0.8 }; });
    ok("combined census still gated to ~1Hz (10x 0.25s -> 2 calls)", calls === 2, `calls=${calls}`);
    ok("gate stores both fractions (S.depotStanding + S.enemyStanding)", Sc.depotStanding === 0.9 && Sc.enemyStanding === 0.8);
    const Sw = { depotCensusAcc: 0, gameOver: false, victory: false };
    stepDepotCensus(Sw, 1.01, () => ({ player: 0.9, enemy: 0.2 }));
    ok("gate routes the enemy fraction into checkEnemyBreach (victory)", Sw.victory === true && Sw.enemyBreach === true && !Sw.gameOver);
    const Sl2 = { depotCensusAcc: 0, gameOver: false, victory: false };
    stepDepotCensus(Sl2, 1.01, () => ({ player: 0.2, enemy: 0.9 }));
    ok("gate routes the player fraction into checkDepotBreach (loss)", Sl2.gameOver === true && Sl2.breach === true && !Sl2.victory);
  }

  // twin determinism: two identical scripted demolition runs through the
  // gate produce identical fraction/flag traces (pure path, zero rng draws).
  {
    const runOnce = () => {
      const f = buildLattice("depot2");
      const c = censusDepotChunks(f.world.bodies, "depot2");
      const S = { depotCensusAcc: 0, gameOver: false, victory: false };
      const trace = [];
      for (let step = 0; step < 30; step++) {
        if (step % 3 === 0 && Math.floor(step / 3) < f.chunks.length) {
          const ch = f.chunks[Math.floor(step / 3)];
          ch.pos = { x: ch.pos.x + 10, y: ch.pos.y, z: ch.pos.z };
        }
        stepDepotCensus(S, 0.5, () => ({ player: 1, enemy: depotStandingFraction(c, f.world.byId) }));
        trace.push(`${S.depotStanding},${S.enemyStanding},${!!S.victory},${!!S.enemyBreach}`);
      }
      return trace.join("|");
    };
    ok("twin determinism: identical demolition scripts -> identical census traces", runOnce() === runOnce());
  }
}

// --- squads.js (Phase 5 Task 1): squad brains — exposure, cover-hop, and
// the defend/attack order machine. Pure functions over world + squad state.
{
  // exposureAt: a man behind a wall (relative to the threat bearing) should
  // read low exposure; open field reads 1; a wall BEHIND him (away from the
  // threat) doesn't help at all — still 1.
  {
    const world = makeWorld({ field: { heightAt: () => 0, dirty: false }, seed: 1 });
    // man at origin; threat bears due +z (bearing 0, atan2(dx,dz) convention).
    // wall sits between him and the threat, 1.5m out along +z.
    addBody(world, { kind: "wall", team: 1, mass: 0, hx: 0.9, hy: 0.9, hz: 0.3, x: 0, y: 0.9, z: 1.5, hp: 70 });
    const covered = exposureAt(world, 0, 0, 0);
    ok(`exposureAt: wall between man and threat reads low (0.1-0.3)`, covered >= 0.1 && covered <= 0.3, `exposure=${covered}`);

    const worldOpen = makeWorld({ field: { heightAt: () => 0, dirty: false }, seed: 1 });
    const openExposure = exposureAt(worldOpen, 0, 0, 0);
    ok("exposureAt: open field (no solids nearby) reads 1", openExposure === 1, `exposure=${openExposure}`);

    const worldBehind = makeWorld({ field: { heightAt: () => 0, dirty: false }, seed: 1 });
    // wall is BEHIND the man relative to the threat bearing (threat at
    // bearing 0 / +z; wall sits at -z, i.e. behind him) — should not cover.
    addBody(worldBehind, { kind: "wall", team: 1, mass: 0, hx: 0.9, hy: 0.9, hz: 0.3, x: 0, y: 0.9, z: -1.5, hp: 70 });
    const behindExposure = exposureAt(worldBehind, 0, 0, 0);
    ok("exposureAt: wall behind the man (away from threat) does not cover, reads 1", behindExposure === 1, `exposure=${behindExposure}`);
  }

  // coverHop: given a boulder near one candidate advance cell and open
  // ground elsewhere, both cells reducing distance-to-dest, coverHop must
  // pick the boulder-adjacent one.
  {
    const world = makeWorld({ field: { heightAt: () => 0, dirty: false }, seed: 1 });
    // dest straight ahead at +z=40. A rock sits 1.5m past the (0,6) ring
    // candidate, directly along the threat bearing (0 == +z) — that
    // candidate reads well-covered; every other ring candidate is open
    // ground. coverHop must pick the covered one.
    addBody(world, { kind: "rock", team: 0, mass: 0, hx: 1.2, hy: 1.2, hz: 1.2, x: 0, y: 1.2, z: 7.5, hp: 1e9 });
    const from = { x: 0, z: 0 }, dest = { x: 0, z: 40 };
    const hop = coverHop(world, from, dest, 0);
    const distFromRock = Math.hypot(hop.x - 0, hop.z - 7.5);
    ok("coverHop prefers a boulder-adjacent advance cell over open ground",
      distFromRock < 2.2, `hop=(${hop.x.toFixed(2)},${hop.z.toFixed(2)}) distFromRock=${distFromRock.toFixed(2)}`);
    ok("coverHop's pick strictly reduces distance-to-dest",
      Math.hypot(dest.x - hop.x, dest.z - hop.z) < Math.hypot(dest.x - from.x, dest.z - from.z));
  }

}

// ============================================================ 2026-08-10 playtest batch
// Four fixes: tower view height, empty waves, fog-repel = effRange/2,
// preview declipped from fog. See .superpowers/sdd/2026-08-10-depot-phase-5/.
{

  // --- Fix 2: empty waves — repro fixture (the playtest's massacre loop:
  // player kills everything, attacker income is STIPEND only). Pre-fix,
  // 4/5 of these seeds fielded NOBODY on waves 3-4 while solvent.
  {
    const conscriptC = ENEMY_SPECS[""].bounty;
    let emptySolvent = 0, everBought = 0;
    for (const seed of [11, 12345, 777, 999999, 42]) {
      const rng = mulberry32(seed);
      const reg = makeRegiment(rng);
      for (let w = 0; w < 10; w++) {
        const solvent = reg.scrap >= conscriptC && reg.heads > 0;
        const { buys } = planWave(reg, {}, w, rng);
        const n = buys.reduce((s, b) => s + b.n, 0);
        if (solvent && n === 0) emptySolvent++;
        if (n > 0) everBought++;
        payResults(reg, { structureDmg: 0, towerKills: 0, wallKills: 0, buildingKills: 0, leaks: 0 });
        reg.scrap += STIPEND;
      }
    }
    ok("empty waves: massacre fixture (5 seeds x 10 waves) — every solvent wave musters", emptySolvent === 0, `${emptySolvent} empty solvent waves`);
    ok("empty waves: fixture actually bought units", everBought === 50, `${everBought}/50`);
  }

  // --- Fix 2 invariant: planWave NEVER returns empty buys while the
  // regiment can afford the cheapest unit and has heads. 50 seeds x 10
  // waves, varied snapshots.
  {
    const conscriptC = ENEMY_SPECS[""].bounty;
    let violations = 0, checked = 0;
    for (let seed = 1; seed <= 50; seed++) {
      const rng = mulberry32(seed * 7919);
      const reg = makeRegiment(rng);
      const snap = { mortars: seed % 7, mgs: seed % 9, guns: seed % 5, frosts: seed % 6, walls: seed % 9, towerElev: 0 };
      for (let w = 0; w < 10; w++) {
        const solvent = reg.scrap >= conscriptC && reg.heads > 0;
        const { buys } = planWave(reg, snap, w, rng);
        if (solvent) { checked++; if (buys.reduce((s, b) => s + b.n, 0) === 0) violations++; }
        payResults(reg, { structureDmg: 0, towerKills: 0, wallKills: 0, buildingKills: 0, leaks: 0 });
        reg.scrap += STIPEND;
      }
    }
    ok("empty waves INVARIANT: no empty buys while solvent (50 seeds x 10 waves)", violations === 0, `${violations}/${checked}`);
  }

}

// ===================================================== Phase 5 Task 3:
// wiring — spawn, sandbags, roster prune, stall persistence, and the
// SWEEP ASSERT (risk 1: the scaffold-filter family). Team-1 infantry is a
// NEW body class; every consumer of unit bodies is exercised against a real
// team-1 member here so a `kind === "unit"` assumption can't silently
// mishandle them the way the Phase-4 tower-scan/bounty/leak/off-grid
// quartet did.
{
  const flatField = { heightAt: () => 0, dirty: false, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } };

  // --- spawnSquadMembers: spec.n team-1 unit bodies ringed on the anchor,
  // dress "human", squadId/utype stamped, roster filled.
  {
    const world = makeWorld({ field: flatField, seed: 3 });
    const sq = makeSquad(1, "rifles", 1, 4, -6);
    spawnSquadMembers(world, sq);
    ok("spawnSquadMembers: roster has spec.n ids", sq.memberIds.length === SQUAD_SPECS.rifles.n, `${sq.memberIds.length}`);
    let allGood = true, dressGood = true, ringGood = true;
    for (const id of sq.memberIds) {
      const u = world.byId.get(id);
      if (!u || u.kind !== "unit" || u.team !== 1 || !u.alive || u.squadId !== sq.id || u.utype !== "rifles") allGood = false;
      if (u.dress !== "human") dressGood = false;
      if (Math.hypot(u.pos.x - 4, u.pos.z - (-6)) > 2.5) ringGood = false;
    }
    ok("spawnSquadMembers: members are live team-1 unit bodies with squadId/utype", allGood);
    ok("spawnSquadMembers: members dressed human (player side reads human)", dressGood);
    ok("spawnSquadMembers: members ring the anchor (within 2.5m)", ringGood);
    const sn = makeSquad(2, "sniper", 1, 0, 0);
    spawnSquadMembers(world, sn);
    const roles = sn.memberIds.map((id) => world.byId.get(id).role);
    ok("spawnSquadMembers: sniper squad fields the PAIR (sniper + spotter, 6.5 Task 6)",
      sn.memberIds.length === 2 && roles.includes("sniper") && roles.includes("spotter"), JSON.stringify(roles));
  }

  // --- spawnSandbag: single static sleeping chunk, tagged b.sandbag, hp 60.
  // Dims REVERTED mk0.54 (Jeff rejected the mk0.52 cube on sight): the bag is
  // the original 1.8 x 0.9 x 0.7 slab again — the bag IS the game's brick.
  {
    const world = makeWorld({ field: flatField, seed: 3 });
    const b = spawnSandbag(world, 2, 5);
    ok("spawnSandbag: chunk body tagged b.sandbag", b.kind === "chunk" && b.sandbag === true);
    ok("spawnSandbag: the original slab + hp 60 (reverted from the mk0.52 cube)",
      b.hx === 0.9 && b.hy === 0.45 && b.hz === 0.35 && b.hp === 60,
      `hx=${b.hx} hy=${b.hy} hz=${b.hz} hp=${b.hp}`);
    ok("spawnSandbag: static + sleeping", b.invM === 0 && b.sleeping === true);
    ok("spawnSandbag: costs 5 scrap (SANDBAG_COST — re-pinned from 3, mk0.50)", SANDBAG_COST === 5);
    // cover integration: a man behind the sandbag line reads less exposed
    // than one on open ground, against a threat beyond the bags.
    const behind = exposureAt(world, 2, 3.8, 0); // threatBearing 0 = +z, bag interposed
    const open = exposureAt(world, 20, 3.8, 0);
    ok("spawnSandbag: exposureAt reads the bag as cover", behind < open, `behind=${behind.toFixed(2)} open=${open.toFixed(2)}`);
  }

  // --- pruneSquads: dead/swept members leave the roster; empty squads die.
  {
    const world = makeWorld({ field: flatField, seed: 3 });
    const sq = makeSquad(1, "rifles", 1, 0, 0);
    spawnSquadMembers(world, sq);
    const deadId = sq.memberIds[0];
    applyDamage(world, world.byId.get(deadId), 1e9, { attacker: "enemy" });
    let squads = pruneSquads(world, [sq]);
    ok("pruneSquads: dead member leaves the roster", squads.length === 1 && !squads[0].memberIds.includes(deadId),
      `roster=${squads[0] ? squads[0].memberIds.length : "gone"}`);
    // corpse sweep consistency: DepotGame's cleanup later deletes the body
    // entirely (byId + bodies) — roster must stay consistent then too.
    for (const id of [...sq.memberIds]) {
      const u = world.byId.get(id);
      applyDamage(world, u, 1e9, { attacker: "enemy" });
      world.byId.delete(id);
      world.bodies.splice(world.bodies.indexOf(u), 1);
    }
    squads = pruneSquads(world, squads);
    ok("pruneSquads: fully dead squad is deleted", squads.length === 0);
  }

  // --- persistence: a squad survives a full bell cycle (the bell touches no
  // unit bodies; nothing in the muster path culls team-1 members).
  {
    const world = makeWorld({ field: flatField, seed: 5 });
    const sq = makeSquad(1, "mg", 1, 0, 10);
    spawnSquadMembers(world, sq);
    const S3 = makeRunState();
    S3.started = true;
    S3.reg = { heads: 400, tanks: 4, heads0: 400, tanks0: 4, scrap: 200 };
    const rng3 = mulberry32(55);
    fireBell(S3, { reg: S3.reg, snap: {}, rng: rng3, t: BELL_PERIOD_S });
    for (let i = 0; i < 120; i++) { stepSquad(world, sq, 1 / 60); squadFire(world, sq, 1 / 60); stepWorld(world); }
    fireBell(S3, { reg: S3.reg, snap: {}, rng: rng3, t: 2 * BELL_PERIOD_S });
    const alive = sq.memberIds.filter((id) => { const u = world.byId.get(id); return u && u.alive; }).length;
    ok("persistence: full squad roster alive across two bells", alive === SQUAD_SPECS.mg.n, `alive=${alive}`);
  }

  // ------------------------------------------------ SWEEP ASSERT (risk 1)
  // One team-1 member exercised against EVERY unit-body consumer.
  {
    const world = makeWorld({ field: flatField, seed: 7 });
    const sq = makeSquad(1, "rifles", 1, 0, 40);
    spawnSquadMembers(world, sq);
    const member = world.byId.get(sq.memberIds[0]);

    // (a) bounty: even with a bounty maliciously stamped on, a dead team-1
    // member pays the attacker NOTHING (payBounties team gate does the work).
    member.bounty = 4;
    applyDamage(world, member, 1e9, { attacker: "enemy" });
    world.events.length = 0;
    payBounties(world);
    ok("sweep/bounty: no tdkill event for a dead team-1 member", !world.events.some((e) => e.type === "tdkill"));

    // (b) FRONT F1: leaks retired — a live member at the depot objective is
    // simply a body on the field; nothing removes him.
    const m2 = world.byId.get(sq.memberIds[1]);
    m2.pos.x = 0; m2.pos.z = 40;
    world.events.length = 0;
    ok("sweep: member at the depot persists (leak machinery gone)", world.byId.has(m2.id));

    // (c) stepUnits (enemy march driver) never drives a team-1 member.
    const vx0 = m2.v.x, vz0 = m2.v.z, px0 = m2.pos.x, pz0 = m2.pos.z;
    stepUnits(world, straightGrid(0, 1), identFwdDir);
    ok("sweep/march: stepUnits leaves team-1 members untouched",
      m2.v.x === vx0 && m2.v.z === vz0 && m2.pos.x === px0 && m2.pos.z === pz0);

    // (d) corpse cleanup: DepotGame's sweep (kind unit, any team, deadT+2.5s)
    // is INTENDED to clear team-1 corpses too — pruneSquads (tested above)
    // keeps the roster consistent when it does. Source-assert the sweep is
    // team-agnostic by design, not accidentally team-2-only.
    const depotSrc3 = fs.readFileSync(new URL("../src/depot/DepotGame.jsx", import.meta.url), "utf8");
    ok("sweep/corpse: DepotGame corpse sweep is kind-gated, team-agnostic",
      depotSrc3.includes('b.kind === "unit" && !b.alive && world.t - (b.deadT || 0) > 2.5'));

    // (e) emitters: team-1 members must emit GREEN influence (EMIT.unit,
    // sign +1) and sandbags must emit under EMIT.wall — buildEmitters is a
    // DepotGame closure, so source-assert the branches exist, and
    // functionally prove a green unit-weight emitter holds ground.
    ok("sweep/emitters: buildEmitters includes team-1 units at EMIT.unit sign +1",
      depotSrc3.includes('b.kind === "unit" && b.team === 1 && b.alive') &&
      /team === 1[\s\S]{0,220}EMIT\.unit\.w, r: EMIT\.unit\.r, sign: 1/.test(depotSrc3));
    ok("sweep/emitters: buildEmitters includes sandbags under EMIT.wall",
      depotSrc3.includes("b.sandbag") &&
      /sandbag[\s\S]{0,220}EMIT\.wall\.w, r: EMIT\.wall\.r, sign: 1/.test(depotSrc3));
    {
      const T3 = makeTerritory(29, 57);
      for (let i = 0; i < 40; i++) stepTerritory(T3, [{ x: 0, z: 0, w: EMIT.unit.w, r: EMIT.unit.r, sign: 1 }], 0.25);
      ok("sweep/emitters: a green unit emitter holds its ground (holderAt 1)", holderAt(T3, 0, 0) === 1);
    }

    // (f) tower scan: stepTowers acquires team 2 ONLY — a team-1 member in
    // range is invisible to friendly guns (source assert; stepTowers lives
    // in DepotGame.jsx which node can't import as JSX).
    ok("sweep/towerscan: stepTowers scan filters to team 2",
      depotSrc3.includes('(e.kind !== "unit" && e.kind !== "vehicle") || !e.alive || e.team !== 2'));

    // (g) __DEPOTTHIN__ (the wave-drain harness) kills team 2 only.
    ok("sweep/thin: __DEPOTTHIN__ kills only team-2 units",
      /__DEPOTTHIN__[\s\S]{0,400}b\.kind === "unit" && b\.team === 2 && b\.alive/.test(depotSrc3));

    // (h) fog-render ownership: the renderer's fog gate hides team-2 bodies
    // only — team-1 members always render for their owner.
    const rendSrc = fs.readFileSync(new URL("../src/render/renderer.js", import.meta.url), "utf8");
    const fogGates = rendSrc.match(/opts\.territory && b\.team === 2 && b\.alive/g) || [];
    ok("sweep/fog: renderer fog gates check team === 2 (team-1 always renders)", fogGates.length >= 2, `gates=${fogGates.length}`);

    // (i) restock: no restock machinery exists anywhere in src/depot — the
    // campaign's restock (scenario.js) is keyed off campaign spawn pools and
    // never reaches depot bodies.
    let restockHits = 0;
    for (const f of fs.readdirSync(new URL("../src/depot", import.meta.url))) {
      const src = fs.readFileSync(new URL("../src/depot/" + f, import.meta.url), "utf8");
      if (/restock/i.test(src)) restockHits++;
    }
    ok("sweep/restock: no restock path exists in src/depot", restockHits === 0, `hits=${restockHits}`);

    // (j) squadFire acquisition: a member never targets its own team — park
    // a second friendly squad in range with no enemies present; nothing fires.
    {
      const world4 = makeWorld({ field: flatField, seed: 9 });
      const a = makeSquad(1, "rifles", 1, 0, 0); spawnSquadMembers(world4, a);
      const b4 = makeSquad(2, "mg", 1, 0, 8); spawnSquadMembers(world4, b4);
      squadFire(world4, a, 0);
      ok("sweep/squadFire: no friendly acquisition (no rounds in the air)", world4.projectiles.length === 0);
    }
  }

  // --- placement validation reuse: squad placement rides validatePlacement
  // exactly like towers (green-only + afford) — sandbag placement too.
  {
    const v1 = validatePlacement({ blocked: false, ice: false, held: false, resources: 100, cost: SQUAD_SPECS.rifles.cost });
    ok("squad placement: unheld ground refused", !v1.ok && v1.msg === "GROUND NOT HELD");
    const v2 = validatePlacement({ blocked: false, ice: false, held: true, resources: 2, cost: SANDBAG_COST });
    ok("sandbag placement: unaffordable refused", !v2.ok && v2.msg === "NO SCRAP");
    const v3 = validatePlacement({ blocked: false, ice: false, held: true, resources: 100, cost: SQUAD_SPECS.sniper.cost }); // re-pinned mk0.50: 100 >= the pair's 68 (was 50 >= 45)
    ok("squad placement: held + funded passes", v3.ok === true);
  }

  // --- sniper placement preview: reachPolygon with INFANTRY_ARMS.sniper,
  // fog-INDEPENDENT (null territory, per the Phase-5 preview rule) — the
  // fan must reach full range even across enemy-held ground.
  {
    const spec = INFANTRY_ARMS.sniper;
    const flatWorld = { field: { heightAt: () => 0 }, bodies: [] };
    const muzzle = { x: 0, y: 1.24, z: 0 };
    const T4 = makeTerritory(29, 57);
    for (let i = 0; i < 200; i++) stepTerritory(T4, [{ x: 15, z: 0, w: EMIT.tower.w, r: 3, sign: -1 }], 0.05);
    const poly = reachPolygon(flatWorld, null, muzzle, spec, 1);
    const reach = Math.hypot(poly[0].x - muzzle.x, poly[0].z - muzzle.z);
    ok("sniper preview: fog-independent fan reaches full sniper range", reach > spec.range - 1.5, reach.toFixed(1));
    const depotSrc4 = fs.readFileSync(new URL("../src/depot/DepotGame.jsx", import.meta.url), "utf8");
    ok("sniper preview: DepotGame builds the squad preview with null territory + INFANTRY_ARMS",
      /INFANTRY_ARMS\[[^\]]*\][\s\S]{0,300}reachPolygon\(world, null, muzzle/.test(depotSrc4) ||
      /reachPolygon\(world, null, muzzle, arms/.test(depotSrc4));
  }
}

// ==== SANDBAG-ROT ============================================================
// 90-degree placement orientation + line auto-continue (placement-state only).
{
  console.log("\n[sandbag-rot]");
  const flatF = { heightAt: () => 0, dirty: false, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } };
  const { sandbagOrientAt } = await import("../src/depot/state.js");

  // (a) orientation — REVERTED mk0.54 with the bag's true dims: the hx/hz
  // swap is dimensional again, exactly as it was before mk0.52.
  {
    const world = makeWorld({ field: flatF, seed: 7 });
    const b0 = spawnSandbag(world, 0, 0, 0);
    ok("sandbag-rot: orient 0 lays the slab along x (reverted, mk0.54)",
      b0.hx === 0.9 && b0.hz === 0.35 && b0.orient === 0, `hx=${b0.hx} hz=${b0.hz} orient=${b0.orient}`);
    const b1 = spawnSandbag(world, 10, 0, 1);
    ok("sandbag-rot: orient 1 lays the slab along z (reverted, mk0.54)",
      b1.hx === 0.35 && b1.hz === 0.9 && b1.orient === 1, `hx=${b1.hx} hz=${b1.hz} orient=${b1.orient}`);
    const bd = spawnSandbag(world, 20, 0);
    ok("sandbag-rot: orient defaults to 0", bd.orient === 0 && bd.hx === 0.9 && bd.hz === 0.35);
  }

  // (b) auto-continue: placing within ~2.2m of an existing bag orients
  // along the line to that bag, overriding the toggle for that placement.
  {
    const world = makeWorld({ field: flatF, seed: 8 });
    spawnSandbag(world, 0, 0, 0);
    ok("sandbag-rot: adjacent along x continues the x line (orient 0)", sandbagOrientAt(world, 1.8, 0, 1) === 0);
    ok("sandbag-rot: adjacent along z continues the z line (orient 1)", sandbagOrientAt(world, 0, 1.8, 0) === 1);
    ok("sandbag-rot: isolated placement uses the toggle", sandbagOrientAt(world, 30, 30, 1) === 1 && sandbagOrientAt(world, 30, 30, 0) === 0);
    const dead = spawnSandbag(world, 40, 40, 0); dead.alive = false;
    ok("sandbag-rot: dead bags don't steer auto-continue", sandbagOrientAt(world, 41.8, 40, 1) === 1);
    ok("sandbag-rot: beyond 2.2m is a line start (toggle wins)", sandbagOrientAt(world, 3.0, 0, 1) === 1);
  }

  // (c) UI toggle: tapping SANDBAG while already in sandbag mode cycles the
  // pending orientation (two states) and the bar icon reflects it — source
  // asserts (DepotGame closures), same pattern as sweep/emitters above.
  {
    const src = fs.readFileSync(new URL("../src/depot/DepotGame.jsx", import.meta.url), "utf8");
    ok("sandbag-rot: sandbag button re-tap cycles orientation", /sandbagOrient[\s\S]{0,80}\+ 1\) % 2/.test(src));
    ok("sandbag-rot: bar icon reflects orientation (▬ vs ▮)", src.includes("▮") && /sandbagOrient[^\n]{0,120}▮|▮[^\n]{0,120}sandbagOrient/.test(src));
    ok("sandbag-rot: placement routes through sandbagOrientAt", src.includes("sandbagOrientAt("));
  }

  // (d) toggle applies IMMEDIATELY (regression: the 8Hz frame setHud rebuilt
  // the whole hud object WITHOUT sandbagOrient, clobbering the toggle's icon
  // flip back to ▬ within 120ms). The frame-loop hud snapshot must carry
  // sandbagOrient, HUD0 must seed it, and the hover ghost must read the LIVE
  // toggle (via sandbagOrientAt at the hover cell) every frame, not a cached
  // copy.
  {
    const src = fs.readFileSync(new URL("../src/depot/DepotGame.jsx", import.meta.url), "utf8");
    // the frame snapshot is the setHud({...}) that also carries mode/sellMode
    const snap = src.match(/setHud\(\{[\s\S]{0,7500}?\}\);\n\s+\}\n/); // window widened (mk0.29 added endCard; mk0.41 added the manifest mirror; mk0.80 added the tower radial; mk0.82 added showPie to both; mk0.84 added linePending, re-pinned 5000->6000; mk0.86 added structOk/structFirst, re-pinned 6000->7000; mk0.92 added canPossess + the tower branch of hud.possessed, re-pinned 7000->7500)
    ok("sandbag-rot: frame hud snapshot carries sandbagOrient (no clobber)",
      !!snap && snap[0].includes("mode: S.mode") && snap[0].includes("sandbagOrient: S.sandbagOrient"));
    const { HUD0 } = await import("../src/depot/state.js");
    ok("sandbag-rot: HUD0 seeds sandbagOrient", HUD0.sandbagOrient === 0);
    // hover ghost: per-frame oriented footprint from live toggle state
    ok("sandbag-rot: hover ghost reads live orientation via sandbagOrientAt",
      /setHover[\s\S]{0,400}sandbagOrientAt\(world, S\.hover\.x, S\.hover\.z, S\.sandbagOrient/.test(src) ||
      /sandbagOrientAt\(world, S\.hover\.x, S\.hover\.z, S\.sandbagOrient[\s\S]{0,400}setHover/.test(src));
  }
}

// ==== SNAP-SQUADS ============================================================
// buildSnapshot must report live player squad count (ai.js snapSquads gate —
// without it the brain never fields its sniper in live play).
{
  console.log("\n[snap-squads]");
  const flatF = { heightAt: () => 0, dirty: false, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } };
  const { snapSquads } = await import("../src/depot/ai.js");
  const { SQUAD_SPECS: SQ, makeSquad: mkSq } = await import("../src/depot/squads.js");
  const world = makeWorld({ field: flatF, seed: 11 });
  const squads = [mkSq(1, "rifles", 1, 0, 0), mkSq(2, "rifles", 1, 10, 0)];
  for (const sq of squads) spawnSquadMembers(world, sq);
  // same predicate buildSnapshot uses: squads holding at least one live member
  const liveCount = (list) => list.filter((sq) => sq.memberIds.some((id) => { const u = world.byId.get(id); return u && u.alive; })).length;
  ok("snap-squads: 2 live squads -> snapshot squads=2", snapSquads({ squads: liveCount(squads) }) === 2);
  for (const id of squads[1].memberIds) { const u = world.byId.get(id); if (u) u.alive = false; }
  ok("snap-squads: wiped squad drops from the count", snapSquads({ squads: liveCount(squads) }) === 1);
  const src = fs.readFileSync(new URL("../src/depot/DepotGame.jsx", import.meta.url), "utf8");
  ok("snap-squads: buildSnapshot wires the squads field",
    /buildSnapshot[\s\S]{0,1600}squads, towerElev/.test(src));
  void SQ;
}
// ==== end SNAP-SQUADS ========================================================
// ==== end SANDBAG-ROT ========================================================

// ==== TASK 4D: the brain buys it, the bureau warns you
{
  {
    // rng stream parity: exactly 4 draws per planWave, sniper branch active
    let draws = 0;
    const base = mulberry32(78);
    const rng = () => { draws++; return base(); };
    const reg = { heads: 400, tanks: 0, heads0: 400, tanks0: 0, scrap: 65 };
    const plan = planWave(reg, { squads: 3 }, 6, rng);
    ok("4D AI: planWave still consumes exactly 4 rng draws with the sniper buy live",
      draws === 4 && plan.buys.some((b) => b.type === "sniper"), `draws=${draws} buys=${JSON.stringify(plan.buys)}`);
  }
}

// ==== SNIPER-REACH (selection fan fix): the selected-squad range display
// must be computed from the member's HEAD (pos.y + 0.5, the squadFire muzzle)
// — not the anchor's ground height with the flat spec.range ring it showed
// before (Jeff's report: "view distance calculated from base instead of head").
{
  const mkField = (heightAt) => ({ heightAt, dirty: false, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } });
  const flat = mkField(() => 0);


  // (c) no live members -> null (dead squad selected mid-prune).
  {
    const w = makeWorld({ field: flat, seed: 33 });
    const sq = makeSquad(1, "sniper", 1, 0, 0);
    ok("SNIPER-REACH empty: squad with no live members returns null", squadReach(w, sq) === null);
  }

  // folded here from the retired F1 VERIFICATION FIXES block (C0 purge,
  // mk0.31): unarmed squads get no fan; armed squads get the 64-point one.
  {
    const w = makeWorld({ field: flat, seed: 13 });
    const u = addBody(w, { kind: "unit", team: 1, mass: 80, hx: .28, hy: .72, hz: .28, x: 0, y: 1, z: 0, hp: 58 });
    const sap = makeSquad(1, "sappers", 1, 0, 0); sap.memberIds.push(u.id);
    ok("F1-fix C: sapper squadReach null", squadReach(w, sap) === null);
    const rif = makeSquad(2, "rifles", 1, 0, 0); rif.memberIds.push(u.id);
    const pts = squadReach(w, rif);
    ok("F1-fix C: armed squadReach 64-point fan", Array.isArray(pts) && pts.length === 64);
  }

}

// ==== SEL-REACH (Task 2b): universal selection LOS — every selected shooter
// shows its true fan. Inspected gun towers get a reachPolygon fan from their
// real muzzle (pos.y + hy + 0.45, towerShot's own formula), computed ONCE at
// select (static body — towerReachCached); selected rifles/mg squads join the
// sniper on the squadReach fan. Render-only: zero sim impact, zero rng draws.
{
  const mkField = (heightAt) => ({ heightAt, dirty: false, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } });
  const flat = mkField(() => 0);
  const mkTower = (w, type, x, z) => {
    const spec = TOWER_SPECS[type];
    return addBody(w, { kind: "tower", team: 1, mass: 0, hx: spec.hx, hy: spec.hy, hz: spec.hz, x, y: spec.hy, z, hp: spec.hp || 100, towerType: type });
  };

  // (a) flat-ground tower fan: max radius ~ the muzzle's effRange (the fan
  // derives from the real muzzle + spec, not a decorative ring).
  {
    const w = makeWorld({ field: flat, seed: 41 });
    const tw = mkTower(w, "mg", 0, 0);
    const spec = TOWER_SPECS.mg;
    const muzzle = { x: 0, y: tw.pos.y + tw.hy + 0.45, z: 0 };
    const expect = effRange(w, muzzle, spec);
    const cache = {};
    const pts = towerReachCached(cache, w, tw, spec);
    const maxR = Math.max(...pts.map((p) => Math.hypot(p.x, p.z)));
    ok("SEL-REACH tower: flat-ground fan max radius ~ muzzle effRange", Math.abs(maxR - expect) < 1.5, `maxR=${maxR.toFixed(2)} effR=${expect.toFixed(2)}`);
    ok("SEL-REACH tower: fan is a 64-ray polygon", pts.length === 64);
  }

  // (b) computed ONCE per selection: the cache keys on tower id — repeated
  // per-frame calls never recompute; a different tower does.
  {
    const w = makeWorld({ field: flat, seed: 42 });
    const t1 = mkTower(w, "mg", 0, 0), t2 = mkTower(w, "gun", 20, 0);
    let calls = 0;
    const counting = (...args) => { calls++; return reachPolygon(...args); };
    const cache = {};
    towerReachCached(cache, w, t1, TOWER_SPECS.mg, undefined, counting);
    towerReachCached(cache, w, t1, TOWER_SPECS.mg, undefined, counting);
    towerReachCached(cache, w, t1, TOWER_SPECS.mg, undefined, counting);
    ok("SEL-REACH cache: three frames of the same selection compute once", calls === 1, `calls=${calls}`);
    towerReachCached(cache, w, t2, TOWER_SPECS.gun, undefined, counting);
    ok("SEL-REACH cache: selecting a different tower recomputes", calls === 2, `calls=${calls}`);
  }

  // (c) the tower's own body must not self-block its fan (selfId threaded
  // through reachPolygon -> arcClears, the friendlyFouls fix's shape).
  {
    const w = makeWorld({ field: flat, seed: 43 });
    const tw = mkTower(w, "gun", 0, 0);
    const pts = towerReachCached({}, w, tw, TOWER_SPECS.gun);
    const minR = Math.min(...pts.map((p) => Math.hypot(p.x, p.z)));
    ok("SEL-REACH selfId: tower's own box never clips its own fan", minR > TOWER_SPECS.gun.range * 0.8, `minR=${minR.toFixed(2)}`);
  }

  // (d) squad fan present for ALL THREE squad types (rifles/mg lose the flat
  // ring, join the sniper on squadReach).
  for (const type of ["sniper", "rifles", "mg"]) {
    const w = makeWorld({ field: flat, seed: 44 });
    const sq = makeSquad(1, type, 1, 0, 0);
    spawnSquadMembers(w, sq);
    const pts = squadReach(w, sq);
    const maxR = pts ? Math.max(...pts.map((p) => Math.hypot(p.x, p.z))) : 0;
    ok(`SEL-REACH squads: ${type} squad fan present and reaches`, !!pts && pts.length === 64 && maxR > INFANTRY_ARMS[type].range * 0.9, `maxR=${maxR.toFixed(2)}`);
  }

  // (e) render-only: twin firefights, one with selections interleaved
  // (squadReach + towerReachCached every second), hash identical.
  {
    const run = (withSel) => {
      const w = makeWorld({ field: flat, seed: 45 });
      const tw = mkTower(w, "mg", -6, 0);
      const sq = makeSquad(1, "rifles", 1, 0, 0);
      spawnSquadMembers(w, sq);
      addBody(w, { kind: "unit", team: 2, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x: 0, y: 0.86, z: 12, hp: 500 });
      const dt = 1 / 30, cache = {};
      for (let i = 0; i < 10 / dt; i++) {
        squadFire(w, sq, dt);
        stepWorld(w);
        if (withSel && i % 30 === 0) { squadReach(w, sq); towerReachCached(cache, w, tw, TOWER_SPECS.mg); }
      }
      return worldHash(w);
    };
    ok("SEL-REACH render-only: twin determinism with selections interleaved", run(false) === run(true));
  }

  // (f) wiring: DepotGame's inspect path draws towers via towerReachCached;
  // the rifles/mg flat-ring fallback is gone (every selected squad fans).
  {
    const src = fs.readFileSync(new URL("../src/depot/DepotGame.jsx", import.meta.url), "utf8");
    ok("SEL-REACH wiring: DepotGame inspect uses towerReachCached", /towerReachCached\(/.test(src));
    ok("SEL-REACH wiring: rifles/mg flat selection ring removed", !/range: INFANTRY_ARMS\[selSq\.type\]\.range/.test(src));
  }
}

// ==== SIGHTLINES (marksmanship batch Task 2): physics-true arcClears =========
// The fixed +0.35m terrain pad vetoed 94% of downslope shots that physically
// clear (diag-downslope*.mjs, 2026-08-10: 249/266 pad-only vetoes, median real
// clearance 0.217m). Replaced by engine-cadence sampling + a derived epsilon
// (see accuracy.js's ARC_EPS derivation). The keystone below fires REAL
// projectiles and requires arcClears' verdict to match observed impacts in
// both directions — the predictor is pinned to the simulator, not to a pad.
{
  // rounded (cosine) crest, same family as diag-downslope-crest.mjs
  const mkCrestWorld = (H, rampLen, seed = 1) => {
    const world = makeWorld({ seed });
    const f = world.field;
    for (let j = 0; j < f.n; j++) for (let i = 0; i < f.n; i++) {
      const x = i * f.cs - f.half;
      f.h[f.idx(i, j)] = x <= 0 ? H : x >= rampLen ? 0 : H * 0.5 * (1 + Math.cos(Math.PI * x / rampLen));
    }
    return world;
  };
  const sniperArm = INFANTRY_ARMS.sniper;
  const CREST_SHAPES = [[3, 6], [4, 8], [6, 8], [6, 12], [8, 10]];
  const mkShooter = (world, sx) => addBody(world, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x: sx, y: world.field.heightAt(sx, 0) + 0.74, z: 0, hp: 58 });

  // Fire one real, unscattered round straight along the aimSolve direction and
  // watch where it lands. "Lands" = the flight's closest approach to the aim
  // point is <= 1m (the round arrived on the target); otherwise it ate terrain
  // en route (the crest). Deterministic: no rng draws anywhere in this path.
  const simulate = (world, muzzle, target, spec, ownerId) => {
    const dx = target.x - muzzle.x, dz = target.z - muzzle.z;
    const d = Math.hypot(dx, dz);
    const pitch = aimSolve(spec.projSpeed, d, target.y - muzzle.y, 9.8, false);
    if (pitch == null) return { lands: false };
    const ch = Math.cos(pitch), az = Math.atan2(dz, dx);
    const dir = { x: ch * Math.cos(az), y: Math.sin(pitch), z: ch * Math.sin(az) };
    const p = fireProjectile(world, muzzle, dir, spec.projSpeed, { kind: "mg", r: 0.35, kv: 0, dmg: 0, crater: 0, owner: ownerId, attacker: "test" });
    let minD = 1e9;
    for (let s = 0; s < 5000 && world.projectiles.includes(p); s++) {
      stepWorld(world);
      const dd = Math.hypot(p.pos.x - target.x, p.pos.y - target.y, p.pos.z - target.z);
      if (dd < minD) minD = dd;
    }
    return { lands: minD <= 1.0 };
  };

  // keystone: predictor == simulator across the whole crest matrix
  {
    let total = 0, simLands = 0, simBlocks = 0, falseClear = 0, falseBlock = 0;
    const bad = [];
    for (const setback of [0, 1, 2, 3, 4]) for (const [H, ramp] of CREST_SHAPES) {
      for (let tx = 2; tx <= 26; tx += 2) {
        const world = mkCrestWorld(H, ramp);
        const sh = mkShooter(world, -setback);
        const muzzle = { x: -setback, y: sh.pos.y + 0.5, z: 0 };
        const tgt = { x: tx, y: world.field.heightAt(tx, 0) + 0.74, z: 0 };
        const sim = simulate(world, muzzle, tgt, sniperArm, sh.id);
        const w2 = mkCrestWorld(H, ramp);
        const pr = arcClears(w2, muzzle, tgt, sniperArm, sh.id);
        total++; sim.lands ? simLands++ : simBlocks++;
        if (pr !== sim.lands) {
          pr ? falseClear++ : falseBlock++;
          if (bad.length < 6) bad.push(`sb${setback} H${H}r${ramp} tx${tx} predicted=${pr}`);
        }
      }
    }
    ok("SIGHTLINES keystone: arcClears matches real-projectile impacts on every crest fixture (both directions)",
      falseClear === 0 && falseBlock === 0,
      `total=${total} simLands=${simLands} falseClear=${falseClear} falseBlock=${falseBlock}${bad.length ? " | " + bad.join(" | ") : ""}`);
    ok("SIGHTLINES keystone: true crest pierces exist and stay blocked (no false clears)",
      simBlocks > 0 && falseClear === 0, `simBlocks=${simBlocks}`);
  }


  // reachPolygon: the downslope fan widens (pre-fix the +x ray stopped at
  // the pad wall; physically the sniper sees the whole slope). Fixtures
  // chosen where the slope is NOT true dead ground — on the steepest crests
  // at deep setback the short fan is real (the ray stops at the first block
  // by design, and the lip genuinely shadows the near slope there).
  for (const [sb, H, r, pre] of [[2, 3, 6, 4.50], [1, 6, 8, 3.60]]) {
    const world = mkCrestWorld(H, r);
    const muzzle = { x: -sb, y: world.field.heightAt(-sb, 0) + 0.74 + 0.5, z: 0 };
    const pts = reachPolygon(world, null, muzzle, sniperArm, 1);
    const down = Math.hypot(pts[0].x - muzzle.x, pts[0].z - muzzle.z);
    ok(`SIGHTLINES: reachPolygon downslope ray widens on sb${sb} H${H}/r${r} (pre-change pin: ${pre}m)`,
      down > 12, `downslope reach=${down.toFixed(2)}m`);
  }


}
// ==== end SIGHTLINES =========================================================


// ==== SIGHTLINES 6.5 Task 2: one flight model — friendlyFouls runs the tracer
// Audit #1: friendlyFouls carried a private 0.9m-step ANALYTIC parabola
// (y = -4.9t^2) while arcClears marches the engine's own cadence (t = k/120,
// semi-implicit Euler height). Fix: extract the march as marchArc in
// accuracy.js; arcClears and friendlyFouls both call it — one flight model,
// two questions.
{
  console.log("\n[sightlines-6.5 task 2: one flight model]");

  // (a) refactor-safety pin: arcClears verdicts across the crest matrix,
  // byte-identical to the PRE-refactor snapshot (captured 2026-08-10 against
  // the un-extracted loop; 325 fixtures = 5 setbacks x 5 shapes x 13 ranges).
  {
    const mkCrestWorld = (H, rampLen, seed = 1) => {
      const world = makeWorld({ seed });
      const f = world.field;
      for (let j = 0; j < f.n; j++) for (let i = 0; i < f.n; i++) {
        const x = i * f.cs - f.half;
        f.h[f.idx(i, j)] = x <= 0 ? H : x >= rampLen ? 0 : H * 0.5 * (1 + Math.cos(Math.PI * x / rampLen));
      }
      return world;
    };
    const PRE_SNAPSHOT =
      "1111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111110111111111111100111111111100011111111111111111111111011111111111000011111111110000111111110000001111111001111111111100011111111110000001111111100000111111100000000111110001111111111000011111111100000001111111000000011111000000000001";
    let bits = "";
    for (const setback of [0, 1, 2, 3, 4]) for (const [H, ramp] of [[3, 6], [4, 8], [6, 8], [6, 12], [8, 10]]) {
      for (let tx = 2; tx <= 26; tx += 2) {
        const world = mkCrestWorld(H, ramp);
        const sh = addBody(world, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x: -setback, y: world.field.heightAt(-setback, 0) + 0.74, z: 0, hp: 58 });
        const muzzle = { x: -setback, y: sh.pos.y + 0.5, z: 0 };
        const tgt = { x: tx, y: world.field.heightAt(tx, 0) + 0.74, z: 0 };
        bits += arcClears(world, muzzle, tgt, INFANTRY_ARMS.sniper, sh.id) ? "1" : "0";
      }
    }
    ok("task2(a): arcClears verdicts byte-identical to the pre-refactor crest snapshot",
      bits === PRE_SNAPSHOT, `${bits.length} verdicts, first diff at ${[...bits].findIndex((b, i) => b !== PRE_SNAPSHOT[i])}`);
  }

  // shared: flat world + a real unscattered gun round fired along the exact
  // friendlyFouls trajectory (aimSolve dir), hitStruct so walls are physical
  const flatWorld = () => { const w = makeWorld({ seed: 2 }); w.field.h.fill(0); return w; };
  const gun = TOWER_SPECS.gun;
  const fireReal = (world, muzzle, tgt, ownerId) => {
    const d = Math.hypot(tgt.x - muzzle.x, tgt.z - muzzle.z);
    const pitch = aimSolve(gun.projSpeed, d, tgt.y - muzzle.y, 9.8, false);
    const ch = Math.cos(pitch), az = Math.atan2(tgt.z - muzzle.z, tgt.x - muzzle.x);
    const dir = { x: ch * Math.cos(az), y: Math.sin(pitch), z: ch * Math.sin(az) };
    const p = fireProjectile(world, muzzle, dir, gun.projSpeed, { kind: "shell", r: 0.3, kv: 0, dmg: 1, crater: 0, hitStruct: true, owner: ownerId, attacker: "test" });
    let minD = 1e9;
    for (let s = 0; s < 3000 && world.projectiles.includes(p); s++) {
      stepWorld(world);
      const dd = Math.hypot(p.pos.x - tgt.x, p.pos.y - tgt.y, p.pos.z - tgt.z);
      if (dd < minD) minD = dd;
    }
    return minD; // closest approach to the aim point; <=1m means it arrived
  };
  const muzzle = { x: 0, y: 1.5, z: 0 }, tgt = { x: 12, y: 0.86, z: 0 };

  // (b) keystone, direction 1: a friendly wall square in the lane — the
  // verdict says FOUL and the real round physically strikes that wall.
  {
    const world = flatWorld();
    const sh = addBody(world, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x: 0, y: 0.74, z: 0, hp: 58 });
    const wall = addBody(world, { kind: "wall", team: 1, mass: 0, hx: 0.6, hy: 2, hz: 2, x: 6, y: 2, z: 0, hp: 999 });
    const fouls = friendlyFouls(world, muzzle, tgt, gun, sh.id);
    const minD = fireReal(world, muzzle, tgt, sh.id);
    ok("task2(b): friendly wall in lane — verdict FOULS and the real round strikes the wall",
      fouls === true && wall.hitT > 0 && minD > 1, `fouls=${fouls} wallHit=${wall.hitT > 0} minD=${minD.toFixed(2)}`);
  }

  // (c) keystone, direction 2: same wall shifted off the lane — the verdict
  // says CLEAR and the real round arrives on the aim point untouched.
  {
    const world = flatWorld();
    const sh = addBody(world, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x: 0, y: 0.74, z: 0, hp: 58 });
    const wall = addBody(world, { kind: "wall", team: 1, mass: 0, hx: 0.6, hy: 2, hz: 2, x: 6, y: 2, z: 6, hp: 999 });
    const fouls = friendlyFouls(world, muzzle, tgt, gun, sh.id);
    const minD = fireReal(world, muzzle, tgt, sh.id);
    ok("task2(c): friendly wall off the lane — verdict CLEAR and the real round arrives",
      fouls === false && !(wall.hitT > 0) && minD <= 1, `fouls=${fouls} wallHit=${wall.hitT > 0} minD=${minD.toFixed(2)}`);
  }

  // (d) the margins case (audit #1's teeth): a thin friendly wall at x=4.95 —
  // exactly between the old parabola's fixed 0.9m sample points, so the
  // analytic sampler never sees it, but the engine-cadence march does and a
  // REAL round physically strikes it. The verdict must be the integrator's:
  // FOUL. Pre-refactor: friendlyFouls says clear while the round hits — the
  // safety check guessing.
  {
    const world = flatWorld();
    const sh = addBody(world, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x: 0, y: 0.74, z: 0, hp: 58 });
    const wall = addBody(world, { kind: "wall", team: 1, mass: 0, hx: 0.01, hy: 3, hz: 2, x: 4.95, y: 3, z: 0, hp: 999 });
    const fouls = friendlyFouls(world, muzzle, tgt, gun, sh.id);
    const minD = fireReal(world, muzzle, tgt, sh.id);
    ok("task2(d): analytic-vs-integrator margin case resolves to the integrator's answer (FOUL)",
      wall.hitT > 0 && fouls === true, `realHitsWall=${wall.hitT > 0} fouls=${fouls} minD=${minD.toFixed(2)}`);
  }
}
// ==== end SIGHTLINES 6.5 Task 2 ==============================================


// ==== 6.5 TASK 6: THE PAIR — sniper + spotter ================================
// Spec: 2026-08-10-depot-phase-6-5-sightlines-and-pair.md Task 6 (supersedes
// marksmanship-batch Task 3, carried verbatim there). Failing-first asserts.
{
  const flatF = () => ({ heightAt: () => 0, cs: 2, half: 20, dirty: false, carve: () => {}, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } });

  // (a) pair spawns 2 both sides at 45
  {
    // RE-PINNED mk0.50: the pair costs 68, not 45 (the +~50% interim raise).
    ok("pair(a): SQUAD_SPECS.sniper fields two men at 68 scrap (re-pinned from 45, mk0.50)",
      SQUAD_SPECS.sniper && SQUAD_SPECS.sniper.n === 2 && SQUAD_SPECS.sniper.cost === 68, JSON.stringify(SQUAD_SPECS.sniper));
    const world = makeWorld({ field: flatF(), seed: 61 });
    const sq = makeSquad(1, "sniper", 1, 0, 0);
    spawnSquadMembers(world, sq);
    const members = sq.memberIds.map((id) => world.byId.get(id));
    ok("pair(a): player pair spawns sniper + spotter roles",
      members.length === 2 && members.some((u) => u.role === "sniper") && members.some((u) => u.role === "spotter"),
      JSON.stringify(members.map((u) => u.role)));
    // RE-PINNED mk0.50 (value unchanged, claim changed): the bounty stays 45
    // while the player's pair went to 68 — the interim cost asymmetry, on the
    // record at SQUAD_SPECS. This assert now pins the enemy price ALONE.
    ok("pair(a): ENEMY_SPECS.sniper still priced at 45 (mirror deliberately broken, mk0.50)", ENEMY_SPECS.sniper.bounty === 45, ENEMY_SPECS.sniper.bounty);
    ok("pair(a): the interim asymmetry is exactly that — player pair dearer than the enemy's",
      SQUAD_SPECS.sniper.cost > ENEMY_SPECS.sniper.bounty, `${SQUAD_SPECS.sniper.cost} vs ${ENEMY_SPECS.sniper.bounty}`);
    const w2 = makeWorld({ field: flatF(), seed: 62 });
    const sn = spawnUnit(w2, { x: 0, z: 10 }, "sniper");
    const pairBodies = w2.bodies.filter((b) => b.kind === "unit" && b.team === 2);
    const spotter = pairBodies.find((b) => b.role === "spotter");
    ok("pair(a): enemy marksman arrives as two men (sniper + spotter)",
      pairBodies.length === 2 && !!spotter && sn.role === "sniper", `bodies=${pairBodies.length}`);
    ok("pair(a): enemy pair kill payout sums to the 45 price",
      pairBodies.reduce((s, b) => s + (b.bounty || 0), 0) === 45,
      JSON.stringify(pairBodies.map((b) => b.bounty)));
  }

  // (i) rng stream identity on a pairless run: fielding the pair adds ZERO
  // draws to spawn (spotter placement is draw-free), and a pairless spawn
  // stream is untouched
  {
    const countDraws = (tag) => {
      const world = makeWorld({ field: flatF(), seed: 71 });
      let n = 0;
      const rng0 = world.rng;
      world.rng = () => { n++; return rng0(); };
      spawnUnit(world, { x: 0, z: 10 }, tag);
      return n;
    };
    ok("pair(i): conscript spawn draw count unchanged (3)", countDraws("") === 3, countDraws(""));
    ok("pair(i): sniper PAIR spawn draws exactly what a lone spawn drew (spotter adds zero draws)",
      countDraws("sniper") === 3, countDraws("sniper"));
  }
}
// ==== end 6.5 TASK 6 =========================================================

// ==== FRONT F1 Task 1: their depot stands ====================================
// DepotGame.jsx is JSX (not importable headlessly) — extract the REAL map
// machinery (module header + genMap/makeMap/makeGrid/pondAt/rockAt/
// checkConnectivity/buildTown) from the source text and evaluate it with its
// imported deps injected. This runs the actual shipped code, not a copy.
{
  const depotSrcF1 = fs.readFileSync(new URL("../src/depot/DepotGame.jsx", import.meta.url), "utf8");
  const sliceFn = (name) => {
    const start = depotSrcF1.indexOf(`\nfunction ${name}(`);
    if (start < 0) throw new Error("F1 extract: missing function " + name);
    const rest = depotSrcF1.slice(start + 1);
    const m = rest.slice(9).search(/\n(?:function |export |const [A-Z])/);
    return rest.slice(0, m < 0 ? rest.length : m + 9);
  };
  const headerStart = depotSrcF1.indexOf("const GRID_CS");
  const headerEnd = depotSrcF1.indexOf("function genMap");
  const header = depotSrcF1.slice(headerStart, headerEnd);
  const mapSrc = [
    header,
    sliceFn("genMap"), sliceFn("makeMap"), sliceFn("pondAt"), sliceFn("rockAt"),
    // townFootprint (P1 T3): buildTown's grid-footprint loop, lifted out so
    // the save's restore path can recompute the same cells without re-laying
    // stone. buildTown calls it, so the extraction must carry it.
    sliceFn("makeGrid"), sliceFn("checkConnectivity"), sliceFn("townFootprint"), sliceFn("buildTown"),
    `return { genMap, makeMap, makeGrid, checkConnectivity, buildTown, invW,
      state: () => ({ ORIENT, OBJ_POS, SPAWN_POINTS, PONDS, ROCKS, TOWN, ROADS, MAP_SEED }) };`,
  ].join("\n");
  const makeMapModule = () => new Function(
    "mulberry32", "MASON", "fwdUFor", "fwdDirFor", "invWFor", "addBody", "addWeld", mapSrc,
  )(mulberry32, MASON, fwdUFor, fwdDirFor, invWFor, addBody, addWeld);

  const M = makeMapModule();
  M.makeMap(5);
  const st = M.state();
  const depot2 = st.TOWN.find((t) => t.id === "depot2");
  ok("F1/1a: genMap places depot2 (team 2) in the town list", !!depot2 && depot2.team === 2, JSON.stringify(depot2));
  {
    const c = depot2 ? invWFor(st.ORIENT, depot2.x, depot2.z) : { u: 9e9, v: 9e9 };
    ok("F1/1a: depot2 sits at canonical (0, -46)", Math.abs(c.u - 0) < 0.01 && Math.abs(c.v - -46) < 0.01, `u=${c.u} v=${c.v}`);
    ok("F1/1a: depot2 shares the depot lattice template (9x7x6, door 4, depot flag)",
      !!depot2 && depot2.depot === true &&
      Math.max(depot2.nx, depot2.nz) === 9 && Math.min(depot2.nx, depot2.nz) === 7 && depot2.ny === 6,
      depot2 && `${depot2.nx}x${depot2.nz}x${depot2.ny}`);
  }

  // real buildTown on the real map: same stone-count law both depots, two flags
  {
    const world = makeWorld({ field: { heightAt: () => 0 }, seed: 5 });
    const grid = M.makeGrid(null);
    M.buildTown(world, grid, { heightAt: () => 0 });
    const stones1 = world.bodies.filter((b) => b.kind === "chunk" && b.town === "depot").length;
    const stones2 = world.bodies.filter((b) => b.kind === "chunk" && b.town === "depot2").length;
    ok("F1/1b: depot2 chunk lattice exists with the same stone count as depot", stones2 > 0 && stones2 === stones1, `depot=${stones1} depot2=${stones2}`);
    const flags = world.bodies.filter((b) => b.kind === "flag");
    ok("F1/1b: exactly two flag bodies, teams 1 and 2",
      flags.length === 2 && flags.map((f) => f.team).sort().join(",") === "1,2",
      `n=${flags.length} teams=${flags.map((f) => f.team)}`);

  }

  // source pins: the emitter rule and the deleted anchor push
  ok("F1/1c: buildEmitters flags emit by team sign", /b\.kind === "flag"[^\n]*sign: b\.team === 2 \? -1 : 1/.test(depotSrcF1));
  ok("F1/1c: the SPAWN_POINTS anchor push is deleted", !/for \(const sp of SPAWN_POINTS\)[^\n]*EMIT\.anchor/.test(depotSrcF1));

  // renderer: cloth tint keys on the flag body's team (DEPOT-gated by the
  // existing world.wind gate — TD/no-option renders never reach this block)
  {
    const rSrc = fs.readFileSync(new URL("../src/render/renderer.js", import.meta.url), "utf8");
    ok("F1/1d: flag cloth tint keys on the flag body's team", /flagClothMesh\.setColorAt\(fi, b\.team === 2 \?/.test(rSrc));
  }

  // connectivity both directions + 20-seed placement sweep: depot2 never
  // fouls roads/spawns/ponds/rocks and every map builds
  {
    const halfDiag = Math.hypot(9, 7) * MASON.pitch / 2;
    for (let s = 1; s <= 20; s++) {
      const Mi = makeMapModule();
      Mi.makeMap(s * 101);
      const sti = Mi.state();
      const d2 = sti.TOWN.find((t) => t.id === "depot2");
      if (!d2) { ok(`F1/sweep seed ${s * 101}: depot2 present`, false); continue; }
      // clearance in world space against the built map
      const roadDistW = (x, z) => {
        let best = 1e9;
        for (const route of sti.ROADS) for (let i = 0; i < route.length - 1; i++) {
          const a = route[i], b2 = route[i + 1];
          const dx = b2[0] - a[0], dz = b2[1] - a[1];
          const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
          best = Math.min(best, Math.hypot(x - (a[0] + dx * t), z - (a[1] + dz * t)));
        }
        return best;
      };
      const rd = roadDistW(d2.x, d2.z);
      const pondFoul = sti.PONDS.some((q) => Math.hypot(d2.x - q.x, d2.z - q.z) < q.r + halfDiag);
      const rockFoul = sti.ROCKS.some((q) => Math.hypot(d2.x - q.x, d2.z - q.z) < q.r + halfDiag);
      const spawnFoul = sti.SPAWN_POINTS.some((sp) => Math.hypot(d2.x - sp.x, d2.z - sp.z) < halfDiag + 2);
      ok(`F1/sweep seed ${s * 101}: depot2 clear of roads/ponds/rocks/spawns`,
        rd > halfDiag + 2 && !pondFoul && !rockFoul && !spawnFoul,
        `roadDist=${rd.toFixed(2)} pond=${pondFoul} rock=${rockFoul} spawn=${spawnFoul}`);
      // connectivity both directions on the accepted map
      const g = Mi.makeGrid(null);
      for (const t of sti.TOWN) {
        const hx = (t.nx * MASON.pitch) / 2, hz = (t.nz * MASON.pitch) / 2;
        for (let gz = 0; gz < g.h; gz++) for (let gx = 0; gx < g.w; gx++) {
          const wp = g.gridToWorld(gx, gz);
          if (Math.abs(wp.x - t.x) < hx + 1.0 && Math.abs(wp.z - t.z) < hz + 1.0) {
            if (Math.hypot(wp.x - sti.OBJ_POS.x, wp.z - sti.OBJ_POS.z) < 5) continue;
            g.cells[g.idx(gx, gz)].blocked = true;
          }
        }
      }
      const og = g.worldToGrid(sti.OBJ_POS.x, sti.OBJ_POS.z);
      const doorW = fwdUFor(sti.ORIENT, 0, -51); // just outside depot2's door face
      const dg = g.worldToGrid(doorW.x, doorW.z);
      ok(`F1/sweep seed ${s * 101}: spawns reach the objective AND depot2's doorway`,
        Mi.checkConnectivity(g, sti.SPAWN_POINTS, og.gx, og.gz) &&
        Mi.checkConnectivity(g, sti.SPAWN_POINTS, dg.gx, dg.gz));
    }
  }

  // twin determinism: two extractions, same seed -> identical map state
  {
    const A = makeMapModule(); A.makeMap(77);
    const B = makeMapModule(); B.makeMap(77);
    ok("F1: twin determinism — same seed, identical town layout",
      JSON.stringify(A.state().TOWN) === JSON.stringify(B.state().TOWN));
  }
}
// ==== end FRONT F1 Task 1 ====================================================

// ==== FRONT F1 Task 3: the only ending =======================================
// The two breaches are the ONLY run-enders. Leaks/lives retire; the bell
// cycles forever; attrition/spent become one-time dispatch observations.
{

  // (a) leaks retired at the source: units.js exports no checkLeaks, the
  // world removal path is gone, DepotGame neither imports nor calls it, and
  // no leak event branch/lives field survives in HUD or run state.
  {
    const unitsSrc = fs.readFileSync(new URL("../src/depot/units.js", import.meta.url), "utf8");
    const depotSrc = fs.readFileSync(new URL("../src/depot/DepotGame.jsx", import.meta.url), "utf8");
    const stateSrc = fs.readFileSync(new URL("../src/depot/state.js", import.meta.url), "utf8");
    ok("F1/3a: units.js no longer defines checkLeaks", !unitsSrc.includes("function checkLeaks"));
    ok("F1/3a: DepotGame neither imports nor calls checkLeaks", !depotSrc.includes("checkLeaks"));
    ok("F1/3a grep pin: no lives field in DepotGame (HUD, hooks, run state)", !/\blives\b/.test(depotSrc.replace(/\/\/[^\n]*/g, "")));
    ok("F1/3a grep pin: no heart chip in DepotGame", !depotSrc.includes("♥"));
    ok("F1/3a grep pin: no FINAL WAVE copy in state.js cards", !stateSrc.includes("FINAL WAVE"));
    ok("F1/3a grep pin: no n-of-50 wave display in DepotGame", !depotSrc.includes("totalWaves"));
    ok("F1/3a: makeRunState carries no lives", !("lives" in makeRunState()));
    const S0 = makeRunState();
    S0.reg = { heads: 0, tanks: 0, heads0: 400, tanks0: 10, scrap: 0 };
    fireBell(S0, { reg: S0.reg, snap: {}, rng: mulberry32(1), t: BELL_PERIOD_S });
    ok("F1/3a: ws.results.leaks still initialized (dead field reads 0)", S0.ws.results.leaks === 0);
  }

  // (a2) an enemy parked at your depot for 30 simulated seconds neither
  // despawns nor costs anything — he stays, fights, and his structure fire
  // chews depot masonry (the shared hostile-structure set makes "depot"
  // chunks targetable by team 2 — the Task 3/4 interlock).
  {
    const { hcs, pitch, mass } = MASON;
    const flatF = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } };
    const world = makeWorld({ field: flatF, seed: 31 });
    const chunks = [];
    for (let ix = 0; ix < 3; ix++) for (let iy = 0; iy <= 2; iy++) for (let iz = 0; iz < 1; iz++) {
      const c = addBody(world, {
        kind: "chunk", team: 0, mass, hx: hcs, hy: hcs, hz: hcs,
        x: (ix - 1) * pitch, y: hcs + 0.02 + iy * pitch, z: 20 + iz * pitch,
        friction: 0.65, restitution: 0.02,
      });
      c.sleeping = true; c.town = "depot"; chunks.push(c);
    }
    const home = chunks.map((c) => ({ id: c.id, x: c.pos.x, y: c.pos.y, z: c.pos.z }));
    const u = spawnUnit(world, { x: 0, z: 8 }, "");
    u.pos.x = 0; u.pos.z = 8; // parked well inside rifle range of the lattice
    world.dt = 1 / 60;
    for (let i = 0; i < 30 * 60; i++) {
      stepUnits(world, straightGrid(0, 1), identFwdDir);
      stepWorld(world);
    }
    ok("F1/3a2: parked enemy persists 30s (no despawn, no leak events)",
      world.byId.has(u.id) && u.alive && !world.events.some((e) => e.type === "leak"),
      `alive=${u.alive}`);
    // Masonry falls by DISPLACEMENT, not hit points (core.js: chunks take
    // blast impulse; hp damage covers units/vehicles, and the structure hp
    // loop covers wall/tower/rock). The observable for "his fire chews the
    // building" is physical: he acquires a depot chunk and his rounds shove
    // stones off their homes (weld-free fixture so single stones can move).
    ok("F1/3a2: he acquires depot masonry as a target", u.tgtId != null && chunks.some((c) => c.id === u.tgtId), `tgt=${u.tgtId}`);
    const moved = home.filter((h) => {
      const b = world.byId.get(h.id);
      if (!b) return true;
      return Math.hypot(b.pos.x - h.x, b.pos.y - h.y, b.pos.z - h.z) > 0.05;
    }).length;
    ok("F1/3a2: his structure fire physically works the masonry (stones shoved off home)", moved > 0, `moved=${moved}/${chunks.length}`);
  }

  // (b) the bell cycles forever: 60 bells deep the muster still fields men
  // and nothing has ended the run.
  {
    const S = makeRunState();
    S.started = true;
    S.reg = { heads: 4000, tanks: 40, heads0: 4000, tanks0: 40, scrap: 200 };
    const rng = mulberry32(303);
    for (let w = 0; w < 60; w++) {
      S.reg.scrap += 60; // a steady income so the deep run keeps mustering
      fireBell(S, { reg: S.reg, snap: {}, rng, t: (w + 1) * BELL_PERIOD_S });
    }
    ok("F1/3c: bell 60 still musters, run alive",
      S.bell === 60 && S.ws.spawnQueue > 0 && !S.victory && !S.gameOver,
      `bell=${S.bell} queue=${S.ws.spawnQueue}`);
    ok("F1/3c: no FINAL WAVE copy on any bell card", !S.lastDispatch.lines.some((l) => l.includes("FINAL WAVE")));
  }

  // (c) forced combatIneffective sets NO victory; its dispatch line appears
  // exactly once (the bureau reports; the guns finish it).
  {
    const S = makeRunState();
    S.started = true;
    S.reg = { heads: 10, tanks: 0, heads0: 400, tanks0: 10, scrap: 0 }; // ineffective
    const rng = mulberry32(404);
    fireBell(S, { reg: S.reg, snap: {}, rng, t: BELL_PERIOD_S });
    ok("F1/3b: combat-ineffective regiment sets NO victory", S.victory === false && S.gameOver === false);
    const line1 = S.lastDispatch.lines.find((l) => /combat-ineffective/i.test(l));
    ok("F1/3b: the observation line appears at the bell", !!line1, JSON.stringify(S.lastDispatch.lines));
    ok("F1/3b: observation is digit-free bureau voice", line1 && !/\d/.test(line1), line1);
    fireBell(S, { reg: S.reg, snap: {}, rng, t: 2 * BELL_PERIOD_S });
    ok("F1/3b: the observation appears only once (second bell silent)",
      !S.lastDispatch.lines.some((l) => /combat-ineffective/i.test(l)), JSON.stringify(S.lastDispatch.lines));
  }

  // (c2) three starved musters: NO victory; a one-time spent observation.
  {
    const S = makeRunState();
    S.started = true;
    S.reg = starvedReg();
    const rng = mulberry32(505);
    for (let i = 0; i < 3; i++) { S.reg.scrap = 0; fireBell(S, { reg: S.reg, snap: {}, rng, t: (i + 1) * BELL_PERIOD_S }); }
    ok("F1/3b: three starved musters set NO victory (spent retired as an ending)",
      S.victory === false && S.gameOver === false, `victory=${S.victory} spent=${S.spent}`);
    ok("F1/3b: spent observation line appears once, digit-free",
      S.lastDispatch.lines.some((l) => /spent/i.test(l) && !/\d/.test(l)), JSON.stringify(S.lastDispatch.lines));
    S.reg.scrap = 0;
    fireBell(S, { reg: S.reg, snap: {}, rng, t: 4 * BELL_PERIOD_S });
    ok("F1/3b: spent observation not repeated", !S.lastDispatch.lines.some((l) => /spent/i.test(l)), JSON.stringify(S.lastDispatch.lines));
  }

  // (d) exhaustive: the only two enders are the two breaches. Force every
  // retired condition — regiment stub, ledger/book-value, attrition, spent —
  // and assert no end; then the two breaches still end it.
  {
    const S = makeRunState();
    S.started = true;
    S.reg = { heads: 5, tanks: 0, heads0: 400, tanks0: 10, scrap: 0 }; // ineffective AND broke
    ok("F1/3b: checkLoss without breach never fires (regiment stub only)", checkLoss(S) === false && !S.gameOver);
    const rng = mulberry32(606);
    for (let i = 0; i < 4; i++) { S.reg.scrap = 0; fireBell(S, { reg: S.reg, snap: {}, rng, t: (i + 1) * BELL_PERIOD_S }); }
    ok("F1/3d: no retired condition ends the run",
      !S.victory && !S.gameOver && !S.breach && !S.enemyBreach, `v=${S.victory} go=${S.gameOver}`);
    checkEnemyBreach(S, 0.1);
    ok("F1/3d: enemy breach still ends it (victory)", S.victory === true && S.enemyBreach === true);
    const S2 = makeRunState();
    checkDepotBreach(S2, 0.1);
    ok("F1/3d: player breach still ends it (loss)", S2.gameOver === true && S2.breach === true);
  }

  // (e) twin determinism: two identical drives through the bell cycle produce
  // identical dispatch/flag traces from the same seeded stream.
  {
    const drive = () => {
      const S = makeRunState();
      S.started = true;
      S.reg = { heads: 400, tanks: 8, heads0: 400, tanks0: 8, scrap: 120 };
      const rng = mulberry32(909);
      const trace = [];
      for (let w = 0; w < 8; w++) {
        fireBell(S, { reg: S.reg, snap: {}, rng, t: (w + 1) * BELL_PERIOD_S });
        trace.push(JSON.stringify([S.bell, S.ws.spawnQueue, S.lastDispatch.lines, S.victory, S.gameOver]));
      }
      return trace.join("|");
    };
    ok("F1/3e: twin determinism through the bell cycle", drive() === drive());
  }
}
// ==== end FRONT F1 Task 3 ====================================================







// ==== mk0.23 TROOP IDENTITY (render kit) =====================================
// The look is a PURE function of team/utype/tag/role — pin every unit type on
// both sides, and pin that nothing outside DEPOT changes at all.
{
  const mk = (o) => ({ team: 2, alive: true, ...o });
  const nProps = (k) => k.props.filter(Boolean).length;

  // --- non-DEPOT parity: the frozen demo / sandbox / TD / campaign look
  for (const b of [mk({ team: 1, utype: "rifles" }), mk({ tag: "heavy" }), mk({ tag: "fast" }),
                   mk({ utype: "gren" }), mk({ team: 1, utype: "mg", role: "gunner" })]) {
    const k = troopKit(b, false);
    ok(`kit: non-DEPOT ${b.utype || b.tag || "conscript"} is untouched (base palette, no bulk, rifle 1, zero props)`,
      k.pal === (b.utype === "gren" ? "gren" : "con") && k.bw === 1 && k.bh === 1 && k.rifle === 1 && nProps(k) === 0);
  }

  // --- coat = side (DEPOT only)
  ok("kit: player infantry wear the warm rust coat", troopKit(mk({ team: 1, utype: "rifles" }), true).pal === "con");
  ok("kit: enemy infantry wear the cold slate coat", troopKit(mk({ tag: "" }), true).pal === "gren");
  ok("kit: the enemy grenadier is unchanged (already slate)", troopKit(mk({ utype: "gren" }), true).pal === "gren");

  // --- bulk
  {
    const h = troopKit(mk({ tag: "heavy" }), true), f = troopKit(mk({ tag: "fast" }), true), c = troopKit(mk({ tag: "" }), true);
    ok("kit: the breaker is 1.35x wide / 1.15x tall", h.bw === 1.35 && h.bh === 1.15);
    ok("kit: the runner is 0.9x slim", f.bw === 0.9 && f.bh === 1);
    ok("kit: the conscript keeps his own frame", c.bw === 1 && c.bh === 1);
  }

  // --- weapon slot per role, both sides
  const cases = [
    ["player rifleman", mk({ team: 1, utype: "rifles" }), 1, 0],
    ["enemy conscript", mk({ tag: "" }), 1, 0],
    ["enemy runner", mk({ tag: "fast" }), 1, 0],
    ["player sniper", mk({ team: 1, utype: "sniper", role: "sniper" }), 1, 2],
    ["enemy marksman", mk({ tag: "sniper", role: "sniper", dress: "android" }), 1, 2],
    ["player sapper", mk({ team: 1, utype: "sappers" }), 0, 1],
    ["enemy sapper", mk({ tag: "sapper" }), 0, 1],
    ["mortar man", mk({ team: 1, utype: "mortars" }), 0, 1],
    ["MG gunner", mk({ team: 1, utype: "mg", role: "gunner" }), 0.8, 3],
    ["MG loader", mk({ team: 1, utype: "mg", role: "loader" }), 0, 0],
    ["enemy breaker", mk({ tag: "heavy" }), 0, 0],
  ];
  for (const [name, b, rifle, np] of cases) {
    const k = troopKit(b, true);
    ok(`kit: ${name} carries rifle=${rifle} props=${np}`, k.rifle === rifle && nProps(k) === np, `got rifle=${k.rifle} props=${nProps(k)}`);
  }
  // the spotter is owned by the pair look, not the kit
  for (const b of [mk({ team: 1, utype: "sniper", role: "spotter" }), mk({ tag: "sniper", role: "spotter", dress: "android" })]) {
    const k = troopKit(b, true);
    ok("kit: the spotter is untouched by the kit (the pair look owns him)", k.rifle === 1 && nProps(k) === 0);
  }

  // --- the sniper's scope really is ON the barrel, and the long barrel butts
  // onto the muzzle: both derived from the rifle's baked preRot, not eyeballed
  {
    const { fwd, up } = barrelBasis(RIFLE_PREROT);
    const len = (v) => Math.hypot(v[0], v[1], v[2]);
    ok("kit: barrelBasis is orthonormal", Math.abs(len(fwd) - 1) < 1e-9 && Math.abs(len(up) - 1) < 1e-9 &&
      Math.abs(fwd[0] * up[0] + fwd[1] * up[1] + fwd[2] * up[2]) < 1e-9);
    const [scope, longb] = troopKit(mk({ team: 1, utype: "sniper", role: "sniper" }), true).props;
    const rel = (p) => [p[0] - RIFLE_OFF[0], p[1] - RIFLE_OFF[1], p[2] - RIFLE_OFF[2]];
    const along = (p) => { const r = rel(p); return r[0] * fwd[0] + r[1] * fwd[1] + r[2] * fwd[2]; };
    const off = (p) => { const r = rel(p); return r[0] * up[0] + r[1] * up[1] + r[2] * up[2]; };
    const side = (p) => { const r = rel(p), a = along(p), o = off(p);
      return Math.hypot(r[0] - a * fwd[0] - o * up[0], r[1] - a * fwd[1] - o * up[1], r[2] - a * fwd[2] - o * up[2]); };
    ok("kit: the scope sits ON the barrel axis (no lateral drift), clear of it by its own radius",
      side(scope.off) < 1e-9 && Math.abs(off(scope.off) - 0.055) < 1e-9 && Math.abs(along(scope.off)) < RIFLE_LEN / 2,
      `side=${side(scope.off)} off=${off(scope.off)} along=${along(scope.off)}`);
    ok("kit: the scope is aimed down the barrel, not tilted by hand", scope.aim === "barrel" && !scope.tilt);
    ok("kit: the long barrel butts onto the muzzle end and extends the reach",
      side(longb.off) < 1e-9 && longb.aim === "barrel" && along(longb.off) < -RIFLE_LEN / 2, `along=${along(longb.off)}`);
    ok("kit: the scoped rifle itself is never sheared (uniform scale only)",
      troopKit(mk({ team: 1, utype: "sniper", role: "sniper" }), true).rifle === 1);
  }

  // --- the MG bipod is TWO legs, splayed, not a flat slab
  {
    const [rec, legL, legR] = troopKit(mk({ team: 1, utype: "mg", role: "gunner" }), true).props;
    ok("kit: the MG receiver rides the barrel", rec.aim === "barrel");
    ok("kit: the bipod is two separate legs, mirrored about the gun centreline",
      !!legL && !!legR && legL.tilt[0] === 2 && legR.tilt[0] === 2 && legL.tilt[1] === -legR.tilt[1] && legL.tilt[1] !== 0);
    ok("kit: the two legs splay to opposite sides and hang below the muzzle",
      Math.sign(legL.off[0] - legR.off[0]) === -1 && legL.off[1] === legR.off[1] && legL.off[1] < 0.45);
    ok("kit: each leg is a slender upright, not a slab", legL.s[1] > 5 * legL.s[0] && legL.s[0] === legL.s[2]);
    ok("kit: the MG gun is short (uniform scale, no shear)", troopKit(mk({ team: 1, utype: "mg", role: "gunner" }), true).rifle < 1);
  }

  // --- fog: bulk survives the seam by design, everything else does not
  {
    const h = troopKit(mk({ tag: "heavy" }), true, true), s = troopKit(mk({ team: 1, utype: "sniper", role: "sniper" }), true, true);
    ok("kit: STATED DECISION — the breaker's bulk shows through the fog seam", h.bw === 1.35 && h.bh === 1.15);
    ok("kit: the fog seam takes every prop and weapon back to the generic man-shape",
      nProps(h) === 0 && nProps(s) === 0 && h.rifle === 1 && s.rifle === 1);
  }

  // --- determinism: same body in, same look out; no hidden state
  {
    const b = mk({ team: 1, utype: "mg", role: "gunner" });
    const a1 = JSON.stringify(troopKit(b, true)), a2 = JSON.stringify(troopKit(b, true));
    ok("kit: troopKit is pure (identical output for identical body)", a1 === a2);
  }

  // --- the part table's spare slots are real and inert
  ok("kit: INFANTRY.con carries three spare prop slots",
    ["prop", "prop2", "prop3"].every((k) => INFANTRY.con.some((p) => p.key === k)));
  ok("kit: the grenadier table gained nothing", !INFANTRY.gren.some((p) => /^prop/.test(p.key)));
  ok("kit: the MG team spawns as gunner + loader", (() => {
    const world = makeWorld(11);
    world.field = { heightAt: () => 0 };
    const sq = makeSquad(9, "mg", 1, 0, 0);
    spawnSquadMembers(world, sq);
    const roles = sq.memberIds.map((id) => world.byId.get(id).role);
    return roles[0] === "gunner" && roles[1] === "loader";
  })());
}
// ==== end mk0.23 TROOP IDENTITY ==============================================



// ==== mk0.27: NO TAP GOES SILENTLY MISSING ===================================
{
  console.log("\n[mk0.27: confirm-tap thefts]");
  const rect = { left: 0, top: 0, width: 800, height: 600 };
  const pending = { gx: 1, gz: 1, mode: "mg", cost: 20, armedAt: 5 };

  // (a) the unarmed ✓ tap: inert, but the pending survives untouched, so the
  // next tap still resolves normally (it is not a swallowed tap).
  ok("mk0.27/a: an unarmed pending is not confirmable", pendingArmed(pending, 4.9) === false);
  ok("mk0.27/a: the pending still resolves on the next canvas tap (buttons on screen)",
    canvasTapConsumesPending(pending, { x: 400, y: 300 }, rect) === true);

  // (b) the pan theft: buttons off the viewport -> a canvas tap is NOT eaten.
  ok("mk0.27/b: buttons panned off the right edge are not visible",
    pendingButtonsVisible({ x: 799, y: 300 }, rect) === false);
  ok("mk0.27/b: buttons panned above the top edge are not visible",
    pendingButtonsVisible({ x: 400, y: 2 }, rect) === false);
  ok("mk0.27/b: an unprojectable anchor (behind the camera) is not visible",
    pendingButtonsVisible(null, rect) === false);
  ok("mk0.27/b: a canvas tap is NOT consumed while the buttons are off-screen",
    canvasTapConsumesPending(pending, { x: 900, y: 300 }, rect) === false);
  ok("mk0.27/b: no pending at all consumes nothing",
    canvasTapConsumesPending(null, { x: 400, y: 300 }, rect) === false);
  ok("mk0.27/b: the edge pad is a real margin", PENDING_EDGE_PAD > 0
    && pendingButtonsVisible({ x: PENDING_EDGE_PAD - 1, y: 300 }, rect) === false
    && pendingButtonsVisible({ x: PENDING_EDGE_PAD, y: 300 }, rect) === true);

  // (c) the wiring: DepotGame uses both, says something on the inert tap, and
  // auto-cancels the pending when its anchor leaves the viewport.
  {
    const src = fs.readFileSync(new URL("../src/depot/DepotGame.jsx", import.meta.url), "utf8");
    ok("mk0.27/c: the canvas-tap pending-clear goes through canvasTapConsumesPending",
      /canvasTapConsumesPending\(S\.pending, S\.pendingScreen/.test(src));
    ok("mk0.27/c: the unarmed ✓ tap toasts instead of vanishing",
      /if \(!pendingArmed\(p, world\.t\)\) \{[^}]*toast\(/.test(src.replace(/\n/g, " ")));
    ok("mk0.27/c: a pending whose anchor leaves the viewport auto-cancels with a toast",
      /pendingButtonsVisible\(/.test(src) && /PLACEMENT CANCELLED/.test(src));
  }
}
// ==== end mk0.27 =============================================================


// ==== mk0.29: THE ENDING'S DIGNITY + SAFE EXITS ==============================
// Three repairs: the end card's RETURN TO BASE button actually leaves; the
// card waits ~6s after the breach so the collapse can play out; and the
// in-game MENU button arms before it drops you out of a live battle.
{
  console.log("\n[mk0.29: the ending's dignity]");

  // (a) the stamp + the gate.
  ok("mk0.29/a: the end card waits about six seconds", END_CARD_DELAY_S >= 4 && END_CARD_DELAY_S <= 10, `delay=${END_CARD_DELAY_S}`);
  {
    const S = { gameOver: false, victory: false };
    stampEnd(S, 100);
    ok("mk0.29/a: no verdict, no stamp", S.endedAt == null);
    S.gameOver = true;
    stampEnd(S, 100);
    ok("mk0.29/a: the verdict stamps the world clock once", S.endedAt === 100);
    stampEnd(S, 140);
    ok("mk0.29/a: later ticks never re-stamp", S.endedAt === 100);
    ok("mk0.29/a: the card is held back while the collapse plays",
      endCardReady(S, 100) === false && endCardReady(S, 100 + END_CARD_DELAY_S - 0.01) === false);
    ok("mk0.29/a: the card arrives once the delay is served",
      endCardReady(S, 100 + END_CARD_DELAY_S) === true);
    ok("mk0.29/a: no verdict, no card", endCardReady({ endedAt: 5 }, 1e9) === false);
  }

  // (b) both verdicts stamp, from either breach.
  {
    const loss = { gameOver: false, victory: false };
    checkDepotBreach(loss, 0.1); stampEnd(loss, 12.5);
    ok("mk0.29/b: our depot falling stamps the ending", loss.gameOver === true && loss.endedAt === 12.5);
    const win = { gameOver: false, victory: false };
    checkEnemyBreach(win, 0.1); stampEnd(win, 30);
    ok("mk0.29/b: their depot falling stamps it too", win.victory === true && win.endedAt === 30);
    ok("mk0.29/b: neither card shows immediately",
      endCardReady(loss, 12.5) === false && endCardReady(win, 30) === false);
  }

  // (c) the wiring: the world keeps simming through the delay, orders and
  // building lock at the verdict, and the end dispatch is a STABLE object —
  // that last one is the dead-button bug: a fresh dispatch object every HUD
  // tick re-ran Dispatch's arming effect, so RETURN TO BASE never armed.
  {
    const src = fs.readFileSync(new URL("../src/depot/DepotGame.jsx", import.meta.url), "utf8");
    ok("mk0.29/c: the end dispatch is memoized (the arming effect stops resetting)",
      /useMemo\([^)]*\n?[^;]*makeEndDispatch/.test(src) || /const endDispatch = useMemo/.test(src));
    ok("mk0.29/c: the card mount waits on the delay gate", /hud\.endCard/.test(src));
    ok("mk0.29/c: the sim keeps running until the card is up",
      /const cardUp = /.test(src) && /S\.paused \|\| !S\.started \|\| cardUp/.test(src));
    ok("mk0.29/c: orders lock at the verdict", /orderSquad = \(kind\) => \{[^}]*gameOver/.test(src.replace(/\n/g, " ")));
    ok("mk0.29/c: building locks at the verdict", /setMode = \(m\) => \{[^}]*gameOver/.test(src.replace(/\n/g, " ")));
    ok("mk0.29/c: the MENU button arms before it leaves the field",
      /data-menu-exit/.test(src) && /LEAVE THE FIELD\?/.test(src) && /menuArmed/.test(src));
  }
}
// ==== end mk0.29 =============================================================

// ==== P1.5 TASK 1 — the tuning batch (mk0.50) ================================
// Seven changes, all Jeff-ratified numbers. The asserts below are the pins for
// the six that are product changes (the seventh was a measurement run).
{
  console.log("\n[mk0.50: the tuning batch]");

  // (1) the bell tightens. Everything downstream is expressed in BELL_PERIOD_S
  // already (the asserts above all do their bell math off the constant), so
  // this is the one place the literal is pinned.
  ok("mk0.50/1: BELL_PERIOD_S is 90 (re-pinned from 120)", BELL_PERIOD_S === 90, BELL_PERIOD_S);

  // (2) the formation tightens. Behavioural, not a source grep: a 4-man squad
  // under orders puts every man's goal on a 1.5m ring around the anchor. Flat
  // empty world, so clearSlot passes each slot through untouched.
  {
    const world = makeWorld({ field: { heightAt: () => 0, dirty: false, cs: 2, half: 40, carve: () => {}, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } }, seed: 77 });
    const sq = makeSquad(1, "rifles", 1, 0, 0);
    spawnSquadMembers(world, sq);
    sq.order = "move"; sq.dest = { x: 0, z: 30 };
    stepSquad(world, sq, 1 / 60);
    const radii = sq.memberIds.map((id) => {
      const u = world.byId.get(id);
      return Math.hypot(u.goal.x - sq.anchor.x, u.goal.z - sq.anchor.z);
    });
    const tight = radii.every((r) => Math.abs(r - 1.5) < 1e-6);
    ok("mk0.50/2: formation slots sit on a 1.5m ring (re-pinned from 2.4)", tight, radii.map((r) => r.toFixed(3)).join(","));
  }

  // (3) the interim price raise, +~50% on every PLAYER price, integers.
  {
    ok("mk0.50/3: squad prices raised (sniper 68, rifles 30, mg 38, sappers 38, mortars 45)",
      SQUAD_SPECS.sniper.cost === 68 && SQUAD_SPECS.rifles.cost === 30 && SQUAD_SPECS.mg.cost === 38
      && SQUAD_SPECS.sappers.cost === 38 && SQUAD_SPECS.mortars.cost === 45,
      JSON.stringify(Object.fromEntries(Object.entries(SQUAD_SPECS).map(([k, v]) => [k, v.cost]))));
    ok("mk0.50/3: tower prices raised (mg 23, gun 38, mortar 53, rocket 75, frost 30)",
      TOWER_SPECS.mg.cost === 23 && TOWER_SPECS.gun.cost === 38 && TOWER_SPECS.mortar.cost === 53
      && TOWER_SPECS.rocket.cost === 75 && TOWER_SPECS.frost.cost === 30,
      JSON.stringify(Object.fromEntries(Object.entries(TOWER_SPECS).map(([k, v]) => [k, v.cost]))));
    ok("mk0.50/3: WALL_COST 8 and SANDBAG_COST 5", WALL_COST === 8 && SANDBAG_COST === 5, `${WALL_COST}/${SANDBAG_COST}`);
    ok("mk0.50/3: every raised price is an integer",
      [...Object.values(SQUAD_SPECS).map((s) => s.cost), ...Object.values(TOWER_SPECS).map((s) => s.cost), WALL_COST, SANDBAG_COST]
        .every((c) => Number.isInteger(c)));
    // The wall price exists ONCE now — DepotGame's palette row and buildAt
    // fallback both read state.js's constant instead of a bare 5.
    const wsrc = fs.readFileSync(new URL("../src/depot/DepotGame.jsx", import.meta.url), "utf8");
    ok("mk0.50/3: DepotGame reads WALL_COST instead of carrying its own literal",
      /icon: "▦", cost: WALL_COST/.test(wsrc) && /spec \? spec\.cost : WALL_COST/.test(wsrc));
    // The knowing asymmetry is documented where the raise is, not just in the
    // plan — a reader who finds a rich enemy finds the reason.
    const sqsrc = fs.readFileSync(new URL("../src/depot/squads.js", import.meta.url), "utf8");
    ok("mk0.50/3: the interim cost asymmetry is written down beside the raised prices",
      /ASYMMETRY/.test(sqsrc) && /mercenary market/.test(sqsrc));
    ok("mk0.50/3: enemy bounties were NOT raised with them",
      ENEMY_SPECS.heavy.bounty === 12 && ENEMY_SPECS.gren.bounty === 8 && ENEMY_SPECS.sapper.bounty === 7
      && ENEMY_SPECS.fast.bounty === 5 && ENEMY_SPECS[""].bounty === 4 && TANK.bounty === 25);
  }

  // (4) the intel card stops auto-raising — pinned at the fireBell asserts
  // above; here we only confirm the report itself survives every bell, which
  // is what the bell chip re-reads.
  {
    const S = makeRunState();
    S.started = true; S.reg = fatReg();
    let composed = 0;
    for (let b = 1; b <= 3; b++) {
      S.reg.scrap += 200;
      fireBell(S, { reg: S.reg, snap: {}, rng: mulberry32(50 + b), t: b * BELL_PERIOD_S });
      if (S.lastDispatch && S.lastDispatch.lines.length > 0) composed++;
      if (S.intelUp !== false) composed = -99;
    }
    ok("mk0.50/4: the report is composed every bell and the card never raises itself", composed === 3, composed);
  }

  // (5) the first-manifest teaching line: bell 1 only, deterministic on the
  // bell index, nothing stored.
  {
    const src = fs.readFileSync(new URL("../src/depot/DepotGame.jsx", import.meta.url), "utf8");
    ok("mk0.50/5: the teaching line renders on bell 1 only",
      /hud\.manifest\.bell === 1 &&/.test(src) && /Pick one reinforcement — the convoy returns each bell\./.test(src));
    ok("mk0.50/5: it is bell-index deterministic — no flag, no storage",
      !/taughtManifest|seenManifest|firstManifestShown/.test(src));
  }

  // (6) the off-map clamp. The rim is axis-aligned in CANONICAL space only, so
  // the clamp is proved at all four orientations — a world-space clamp would
  // pass at ORIENT 0 and cut corners at the other three.
  {
    const HU = 29, HV = 57;
    const inRim = (ORIENT, p) => { const c = invWFor(ORIENT, p.x, p.z); return Math.abs(c.u) <= HU + 1e-9 && Math.abs(c.v) <= HV + 1e-9; };
    let allIn = true, untouched = true, cornerOK = true;
    for (let ORIENT = 0; ORIENT < 4; ORIENT++) {
      for (const far of [{ x: 0, z: 400 }, { x: -400, z: 0 }, { x: 250, z: -250 }, { x: 0, z: -400 }, { x: 400, z: 400 }]) {
        if (!inRim(ORIENT, clampToRimFor(ORIENT, far.x, far.z, HU, HV))) allIn = false;
      }
      // a point already on the field comes back bit-identical
      const on = fwdUFor(ORIENT, 10, -20);
      const back = clampToRimFor(ORIENT, on.x, on.z, HU, HV);
      if (back.x !== on.x || back.z !== on.z) untouched = false;
      // corner honesty: only the axis that was out of bounds moves
      const one = fwdUFor(ORIENT, 200, 13); // u far out, v legal
      const clamped = clampToRimFor(ORIENT, one.x, one.z, HU, HV);
      const cl = invWFor(ORIENT, clamped.x, clamped.z);
      if (Math.abs(cl.u - HU) > 1e-9 || Math.abs(cl.v - 13) > 1e-9) cornerOK = false;
    }
    ok("mk0.50/6: an off-map tap clamps inside the rim at every orientation", allIn);
    ok("mk0.50/6: a destination already on the field is returned untouched", untouched);
    ok("mk0.50/6: only the out-of-bounds axis moves (canonical clamp, not a world-space box)", cornerOK);
    const src = fs.readFileSync(new URL("../src/depot/DepotGame.jsx", import.meta.url), "utf8");
    ok("mk0.50/6: the order flow clamps at the ONE site where a tap becomes a dest",
      /const d = clampToRim\(p\.x, p\.z\);/.test(src) && /osq\.dest = \{ x: d\.x, z: d\.z \}/.test(src));
    ok("mk0.50/6: the rim half-extents exist once (inRim and the clamp share them)",
      /const RIM_HALF_U = 29, RIM_HALF_V = 57;/.test(src) && !/halfU: 29, halfV: 57/.test(src));
  }
}
// ==== end mk0.50 =============================================================

// ==== P1.5 TASK 2 — the masonry look (mk0.52) ================================
// A built wall stands as three welded courses that break one at a time, and a
// course with nothing under it falls. Nothing about the wall's footprint,
// height, price or cover moved — only how it comes apart.
{
  console.log("\n[mk0.52: the masonry look]");
  const flatF = { heightAt: () => 0, dirty: false, cs: 2, half: 40, carve: () => {}, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } };
  const wallsOf = (w) => w.bodies.filter((b) => b.kind === "wall");
  const chunksOf = (w) => w.bodies.filter((b) => b.kind === "chunk");

  // (a) THE STACK. Three bodies where there was one, same silhouette.
  {
    const world = makeWorld({ field: flatF, seed: 5 });
    const cs = spawnWallCourses(world, 0, 0, 0);
    ok("mk0.52/a: a wall is THREE kind-\"wall\" bodies (was one)",
      cs.length === WALL_COURSES && WALL_COURSES === 3 && wallsOf(world).length === 3);
    ok("mk0.52/a: courses are numbered bottom-up", cs.map((b) => b.course).join(",") === "0,1,2");
    ok("mk0.55/a: a course is a thin face — long axis 0.9, one block deep (Jeff: 3x3x1)",
      cs.every((b) => Math.max(b.hx, b.hz) === WALL_HALF && Math.min(b.hx, b.hz) === WALL_THIN));
    ok("mk0.55/a: orient 1 swaps the face to run along z",
      (() => { const w2 = makeWorld({ field: flatF, seed: 5 });
        const c2 = spawnWallCourses(w2, 0, 0, 0, 1);
        return c2.every((b) => b.hz === WALL_HALF && b.hx === WALL_THIN); })());
    ok("mk0.55/a: wallOrientAt continues a neighbouring wall's line",
      (() => { const w3 = makeWorld({ field: flatF, seed: 6 });
        spawnWallCourses(w3, 0, 0, 0, 0);
        return wallOrientAt(w3, 2, 0, 1) === 0 && wallOrientAt(w3, 30, 30, 1) === 1; })());
    // total silhouette: bottom face of course 0 to top face of course 2
    const lo = cs[0].pos.y - cs[0].hy, hi = cs[2].pos.y + cs[2].hy;
    ok("mk0.52/a: the wall still stands 1.8m, within one masonry joint",
      Math.abs(lo) < 0.02 && Math.abs(hi - WALL_H) < 0.02, `lo=${lo.toFixed(3)} hi=${hi.toFixed(3)}`);
    ok("mk0.52/a: courses sit on a 0.6m pitch with a real joint between them",
      Math.abs(cs[1].pos.y - cs[0].pos.y - WALL_COURSE_PITCH) < 1e-9
      && Math.abs((cs[1].pos.y - cs[1].hy) - (cs[0].pos.y + cs[0].hy) - 0.03) < 1e-9,
      `hy=${WALL_COURSE_HY}`);
    // NOT a split (the brief's word): with the support rule, everything aims
    // at the base course and the base's death drops the wall, so a split wall
    // is a third as durable. Measured 6 -> 2 grenadier rounds and 48 -> 17
    // rifle rounds; whole-hp courses measure 6 -> 6 and 48 -> 48, i.e. exactly
    // today's wall. The look changed, the fight did not.
    ok("mk0.52/a: every course carries the WHOLE 70hp wall, so the wall is as hard to drop as it ever was",
      cs.every((b) => b.hp === WALL_HP) && WALL_HP === 70 && wallCourseHp(0) === 70 && wallCourseHp(2) === 70,
      cs.map((b) => b.hp).join("/"));
    ok("mk0.52/a: every course carries its own maxHp", cs.every((b) => b.maxHp === b.hp));
    // sleeping discipline (the brief's trap): three static bodies where there
    // was one, all asleep at birth like spawnSandbag's cover.
    ok("mk0.52/a: courses spawn STATIC and ASLEEP", cs.every((b) => b.invM === 0 && b.sleeping === true));
    ok("mk0.52/a: two vertical welds at MASON strength",
      world.welds.length === 2 && world.welds.every((w) => w.breakF === WALL_WELD_BREAK_F && w.breakF === MASON.breakF),
      `${world.welds.length} welds @ ${world.welds[0] && world.welds[0].breakF}`);
    ok("mk0.52/a: the upper courses are grouped so ONE wall pays ONE wallKill",
      cs[0].group === "" && cs[1].group === WALL_UPPER_GROUP && cs[2].group === WALL_UPPER_GROUP);
    ok("mk0.52/a: the snow cap rides the TOP course", cs[2].capTop === true && cs[0].capTop === false && cs[1].capTop === false);
  }

  // (b) THE SUPPORT RULE. Shoot the base out and the wall comes down — this
  // is the ONLY collapse mechanism (static-static welds are solver-inert).
  {
    const world = makeWorld({ field: flatF, seed: 5 });
    const cs = spawnWallCourses(world, 0, 0, 0);
    ok("mk0.52/b: an intact wall drops nothing", stepWallSupport(world) === 0 && wallsOf(world).length === 3);
    // the live path kills a course and the death pass removes it before the
    // support pass runs; reproduce exactly that.
    applyDamage(world, cs[0], 1e9, { attacker: "enemy" });
    world.byId.delete(cs[0].id); world.bodies.splice(world.bodies.indexOf(cs[0]), 1);
    const fell = stepWallSupport(world);
    ok("mk0.52/b: base shot out -> BOTH courses above come down", fell === 2 && wallsOf(world).length === 0, `fell=${fell}`);
    const rubble = chunksOf(world);
    ok("mk0.52/b: they come down as DYNAMIC mass-100 chunks, awake",
      rubble.length === 2 && rubble.every((c) => c.mass === 100 && c.invM > 0 && c.sleeping === false), `${rubble.length} chunks`);
    ok("mk0.52/b: rubble is stamped for the 14-second sweep (bornT)", rubble.every((c) => c.bornT === world.t));
    ok("mk0.52/b: the fallen courses keep the hp they had left", rubble.every((c) => c.hp === WALL_HP));
    ok("mk0.52/b: nothing is left welded to a body that has gone", world.welds.every((w) => w.broken));
    // and they really fall: no support, gravity, they end up lower than they stood.
    const y0 = rubble.map((c) => c.pos.y);
    for (let i = 0; i < 240; i++) stepWorld(world);
    ok("mk0.52/b: and they FALL — both end up below where they stood",
      rubble.every((c, i) => c.pos.y < y0[i] - 0.3), rubble.map((c) => c.pos.y.toFixed(2)).join(","));
  }

  // (c) A MIDDLE course dies: the top falls, the bottom keeps standing and
  // takes the cap over.
  {
    const world = makeWorld({ field: flatF, seed: 5 });
    const cs = spawnWallCourses(world, 0, 0, 0);
    applyDamage(world, cs[1], 1e9, { attacker: "enemy" });
    world.byId.delete(cs[1].id); world.bodies.splice(world.bodies.indexOf(cs[1]), 1);
    const fell = stepWallSupport(world);
    const left = wallsOf(world);
    ok("mk0.52/c: middle course out -> only the top falls", fell === 1 && left.length === 1 && left[0].course === 0, `fell=${fell} left=${left.length}`);
    ok("mk0.52/c: the surviving bottom course takes the snow cap", left[0].capTop === true);
    ok("mk0.52/c: the ground keeps its wall — the cell's course is still alive", left[0].alive === true && left[0].hp === WALL_HP);
  }

  // (d) A TOP course dies and the wall just stands shorter — no cascade.
  {
    const world = makeWorld({ field: flatF, seed: 5 });
    const cs = spawnWallCourses(world, 0, 0, 0);
    applyDamage(world, cs[2], 1e9, { attacker: "enemy" });
    world.byId.delete(cs[2].id); world.bodies.splice(world.bodies.indexOf(cs[2]), 1);
    ok("mk0.52/d: losing the top course drops nothing else", stepWallSupport(world) === 0 && wallsOf(world).length === 2);
    ok("mk0.52/d: the cap moves down to the new top course",
      wallsOf(world).find((b) => b.course === 1).capTop === true && wallsOf(world).find((b) => b.course === 0).capTop === false);
  }

  // (e) Two walls on two footprints don't confuse each other's courses —
  // stacks are keyed by FOOTPRINT (ids do not survive a save).
  {
    const world = makeWorld({ field: flatF, seed: 5 });
    const a = spawnWallCourses(world, 0, 0, 0);
    spawnWallCourses(world, 6, 0, 0);
    world.byId.delete(a[0].id); world.bodies.splice(world.bodies.indexOf(a[0]), 1);
    const fell = stepWallSupport(world);
    ok("mk0.52/e: one wall collapsing leaves its neighbour standing",
      fell === 2 && wallsOf(world).filter((b) => b.pos.x === 6).length === 3, `fell=${fell}`);
  }

  // (f) The consumers of kind "wall". Every one of them was read and either
  // left alone (it works per body and wants to) or taught the difference.
  {
    const wsrc = fs.readFileSync(new URL("../src/depot/DepotGame.jsx", import.meta.url), "utf8");
    const usrc = fs.readFileSync(new URL("../src/depot/units.js", import.meta.url), "utf8");
    ok("mk0.55/f: buildAt lays oriented courses (auto-continue, broadside default)", /spawnWallCourses\(world, wp\.x, y, wp\.z, wallOrientAt\(world, wp\.x, wp\.z, ORIENT % 2\)\)\[0\]/.test(wsrc));
    ok("mk0.52/f: the support pass runs in stepDepot, after the dead are cleared",
      /structureLost[\s\S]{0,700}stepWallSupport\(world\)/.test(wsrc));
    ok("mk0.52/f: selling takes the whole stack, matched by footprint not id",
      /const stack = b\.kind === "wall"/.test(wsrc) && /wg\.gx === gx && wg\.gz === gz/.test(wsrc));
    ok("mk0.52/f: resume re-claims the cell with the BOTTOM course", /if \(b\.course > 0\) continue;/.test(wsrc));
    ok("mk0.52/f: one territory emitter per wall, not per course", /b\.kind === "wall" && b\.team === 1 && b\.alive && !b\.course/.test(wsrc));
    ok("mk0.52/f: the counters count walls, not courses",
      /if \(b\.kind === "wall"\) \{ if \(!b\.course\) walls\+\+; continue; \}/.test(wsrc) && /if \(b\.kind === "wall"\) \{ if \(!b\.course\) nw\+\+; \}/.test(wsrc));
    ok("mk0.52/f: one wall pays one wallKill", /e\.kind === "wall" && e\.group !== WALL_UPPER_GROUP/.test(wsrc));
    ok("mk0.52/f: a course leaves a THIRD of the rubble (27 stones per wall, as before)",
      /ny: b\.kind === "tower" \? 4 : \(b\.course != null \? 1 : 3\)/.test(wsrc));
    ok("mk0.52/f: the breaker's ram works the BASE course only", /str\.kind === "wall" && str\.course > 0/.test(usrc));
  }

  // (h) The crater re-seat. core.js drops static structures onto the ground
  // when a shell craters beside them so nothing floats over its own hole; it
  // assumed every structure rides exactly its own half-height. Courses do not,
  // and without the seatY generalisation the first crater beside a wall
  // imploded all three courses into one block at ground level (found in
  // staging, not in theory).
  {
    let carvedBy = 0;
    const craterF = { heightAt: () => -carvedBy, dirty: false, cs: 2, half: 40, carve: () => { carvedBy = 0.55; }, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } };
    const world = makeWorld({ field: craterF, seed: 5 });
    const cs = spawnWallCourses(world, 0, 0, 0);
    ok("mk0.52/h: a course records how high it rides above its ground",
      cs.map((b) => b.seatY).join("/") === "0.3/0.8999999999999999/1.5" || cs.every((b, i) => Math.abs(b.seatY - (i + 0.5) * WALL_COURSE_PITCH) < 1e-9),
      cs.map((b) => b.seatY).join("/"));
    // a real shell, cratering right beside the wall
    fireProjectile(world, { x: 1.6, y: 3, z: 0 }, { x: 0, y: -1, z: 0 }, 40,
      { kind: "shell", r: 2.3, kv: 8, dmg: 5, crater: 0.55, noImpact: true, attacker: "enemy" });
    for (let i = 0; i < 200 && world.projectiles.length; i++) stepWorld(world);
    const ys = cs.map((b) => b.pos.y);
    ok("mk0.52/h: after the crater the courses are still STACKED, not collapsed into one block",
      Math.abs(ys[1] - ys[0] - WALL_COURSE_PITCH) < 1e-6 && Math.abs(ys[2] - ys[1] - WALL_COURSE_PITCH) < 1e-6,
      ys.map((y) => y.toFixed(3)).join(","));
    ok("mk0.52/h: and they followed the ground down into the crater",
      Math.abs(ys[0] - (-0.55 + WALL_COURSE_PITCH / 2)) < 1e-6, ys[0].toFixed(3));
    const csrc = fs.readFileSync(new URL("../src/engine/core.js", import.meta.url), "utf8");
    ok("mk0.52/h: the core re-seat is a guarded ADDITIVE divergence — no seatY, no change",
      /s\.seatY != null \? s\.seatY : s\.hy/.test(csrc));
  }

  // (g) The seams are a RENDER inset — the bodies keep their true size, so
  // nothing about cover, sightlines or occupancy moved with the look.
  {
    const rsrc = fs.readFileSync(new URL("../src/render/renderer.js", import.meta.url), "utf8");
    ok("mk0.52/g: walls and sandbags draw inset so the outline finds the joints",
      /const SEAM_XZ = 0\.05, SEAM_Y = 0\.045, SEAM_BAG = 0\.04;/.test(rsrc)
      && /b\.hx - SEAM_XZ/.test(rsrc) && /b\.sandbag \? SEAM_BAG : 0/.test(rsrc));
    ok("mk0.54/g: the block pool holds 27 instances per wall (3x3 per course, ~85 walls fully drawn)",
      /const WALL_INST = 2304;/.test(rsrc) && /wi >= WALL_INST/.test(rsrc) && /WALL_BLOCKS = 3/.test(rsrc));
    ok("mk0.52/g: one snow cap per wall, on the top living course",
      /b\.capTop !== false && wci < 256/.test(rsrc));
  }
}
// ==== end mk0.52 =============================================================

// ==== mk0.60: ENGINEERS, THE TWO-POINT BUILD =================================
// P1.5 Task 4. The order machine's half lives here (squads.js/state.js are
// headless); the LINE ITSELF — rasterisation, costs, placement — lives in the
// game layer, so what can be asserted offline is the module contract plus the
// source shape of the game-layer rules that must not silently drift.
{
  console.log("\n[mk0.60: engineers, the two-point build]");
  const flat = { heightAt: () => 0, dirty: false, cs: 2, half: 40, carve: () => {}, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } };

  // (1) the team itself: two men, 30 scrap, and no weapon anywhere in the stack.
  ok("mk0.60/1: SQUAD_SPECS.engineers is a two-man team at 30 scrap",
    SQUAD_SPECS.engineers && SQUAD_SPECS.engineers.n === 2 && SQUAD_SPECS.engineers.cost === 30
    && SQUAD_SPECS.engineers.label === "ENGINEER TEAM", JSON.stringify(SQUAD_SPECS.engineers));
  ok("mk0.60/1: engineers carry no arms entry at all (like sappers)",
    !INFANTRY_ARMS.engineers && !INFANTRY_ARMS.sappers);

  // (2) the starting kit grew by one — and only by one.
  ok("mk0.60/2: PLAYER_START now fields engineers from bell 0 (re-pinned from 3 items)",
    PLAYER_START.length === 4 && PLAYER_START.includes("sq_engineers")
    && PLAYER_START.includes("wall") && PLAYER_START.includes("sandbag") && PLAYER_START.includes("sq_rifles"),
    PLAYER_START.join(","));
  ok("mk0.60/2: the engineer team is NOT on the convoy's ladder (it is never offered twice)",
    PLAYER_TIERS.every((tier) => tier.indexOf("sq_engineers") < 0));

  // (3) the field discount, and the pause.
  ok("mk0.60/3: field bags 3 (menu 5), field walls 5 (menu 8)",
    SANDBAG_FIELD_COST === 3 && WALL_FIELD_COST === 5 && SANDBAG_COST === 5 && WALL_COST === 8,
    `${SANDBAG_FIELD_COST}/${SANDBAG_COST} ${WALL_FIELD_COST}/${WALL_COST}`);
  ok("mk0.60/3: the field always undercuts the menu", SANDBAG_FIELD_COST < SANDBAG_COST && WALL_FIELD_COST < WALL_COST);
  ok("mk0.60/3: a wall costs the squad ~1.5s standing still", WALL_LAY_PAUSE_S === 1.5, WALL_LAY_PAUSE_S);

  // (4) squadFire: an engineer never pulls a trigger, and a BUILDING squad of
  // any type keeps quiet — neither path draws.
  {
    const world = makeWorld({ field: flat, seed: 91 });
    const eng = makeSquad(1, "engineers", 1, 0, 0);
    spawnSquadMembers(world, eng);
    // a live enemy right on top of them, so silence cannot be an empty scan
    addBody(world, { kind: "unit", team: 2, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x: 2, y: 0.88, z: 0, hp: 58 });
    const before = world.bodies.length;
    eng.order = "defend";
    for (let i = 0; i < 60; i++) squadFire(world, eng, 1 / 60);
    ok("mk0.60/4: an engineer team never fires (no round ever leaves it)", world.bodies.length === before, `${world.bodies.length} vs ${before}`);
    const rif = makeSquad(2, "rifles", 1, 0, 0);
    spawnSquadMembers(world, rif);
    rif.order = "build"; rif.dest = { x: 0, z: 20 };
    const before2 = world.bodies.length;
    for (let i = 0; i < 60; i++) squadFire(world, rif, 1 / 60);
    ok("mk0.60/4: order 'build' is a quiet order, exactly as 'move' is", world.bodies.length === before2, `${world.bodies.length} vs ${before2}`);
  }

  // (5) stepSquad rides MOVE's machine for BUILD — it does not fork it. Same
  // travel, same arrival-into-defend (which is the dig-in), threat read forced
  // false, and the one-draw-per-leg contract untouched.
  {
    const mk = (order) => {
      const world = makeWorld({ field: flat, seed: 93 });
      const sq = makeSquad(1, "engineers", 1, 0, 0);
      spawnSquadMembers(world, sq);
      sq.order = order; sq.dest = { x: 0, z: 26 };
      let draws = 0;
      const raw = world.rng;
      world.rng = () => { draws++; return raw(); };
      let arrivedAt = -1;
      for (let i = 0; i < 3000; i++) {
        stepSquad(world, sq, 1 / 60);
        stepWorld(world);
        if (sq.order === "defend" && arrivedAt < 0) { arrivedAt = i; break; }
      }
      return { draws, arrivedAt, anchor: { x: sq.anchor.x, z: sq.anchor.z } };
    };
    const mv = mk("move"), bd = mk("build");
    ok("mk0.60/5: a BUILD squad travels and arrives exactly as a MOVE squad does",
      bd.arrivedAt > 0 && bd.arrivedAt === mv.arrivedAt, `build=${bd.arrivedAt} move=${mv.arrivedAt}`);
    ok("mk0.60/5: arrival flips the order to defend — the men dig in at the far end",
      Math.abs(bd.anchor.z - 26) < 1.01, bd.anchor.z.toFixed(2));
    ok("mk0.60/5: BUILD spends the identical number of rng draws MOVE does (no new draws)",
      bd.draws === mv.draws, `build=${bd.draws} move=${mv.draws}`);
    // ...and the threat read really is forced false: a squad surrounded by
    // enemies still double-times, so its leg count (and draw count) is unmoved.
    const world = makeWorld({ field: flat, seed: 93 });
    const sq = makeSquad(1, "engineers", 1, 0, 0);
    spawnSquadMembers(world, sq);
    for (let k = 0; k < 6; k++) addBody(world, { kind: "unit", team: 2, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x: -4 + k, y: 0.88, z: 3, hp: 58 });
    sq.order = "build"; sq.dest = { x: 0, z: 26 };
    stepSquad(world, sq, 1 / 60);
    ok("mk0.60/5: under fire a BUILD leg still reads unthreatened (MOVE's rule)", sq._threatened === false, String(sq._threatened));
  }

  // (6) the game layer's rules, by source shape — the line machinery needs a
  // live world/grid/territory to run, so what is pinned here is that the rules
  // the brief fixed are actually written where they are claimed to be.
  {
    const dsrc = fs.readFileSync(new URL("../src/depot/DepotGame.jsx", import.meta.url), "utf8");
    ok("mk0.60/6: the build chips are engineer-only, at the order site and in the radial",
      /if \(sq\.type !== "engineers"\) return;/.test(dsrc) && /engineer: sq\.type === "engineers"/.test(dsrc)
      // COMMAND T1 (mk0.80) re-pin: the chip row's `hud.squadSel.engineer && (`
      // JSX guard became the radial's `if (sq.engineer) {` slot push.
      && /if \(sq\.engineer\) \{/.test(dsrc));
    ok("mk0.60/6: the two taps are start-then-end, and a re-tap of the armed chip cancels",
      /if \(!S\.buildPt0\) \{ S\.buildPt0 = \{ x: d\.x, z: d\.z \}/.test(dsrc)
      && /if \(S\.orderMode === kind\) \{ S\.orderMode = null; S\.buildPt0 = null; return; \}/.test(dsrc));
    // re-pinned COMMAND T2 (mk0.84): a second clamp site joined the first —
    // re-placing a picked-up endpoint of a proposed line clamps the same way
    // (tapAt's S.linePending block). Both taps of the ORIGINAL two-point
    // order still go through the one `const d = ...` site; the count moved
    // from 1 to 2 honestly, not loosened.
    // re-pinned POSSESSION T2 (mk0.91): a THIRD site joined the same call
    // shape — the possessed-squad aim tap (tapAt's `if (S.possess) {
    // S.possessAim = clampToRim(p.x, p.z); ... }`, ahead of the line/order
    // flow). Count moved 2 -> 3, honestly, same rim-clamp, one more caller.
    ok("mk0.60/6: build points AND the possession aim clamp to the rim through the same clamp shape",
      /const d = clampToRim\(p\.x, p\.z\);/.test(dsrc) && (dsrc.match(/clampToRim\(p\.x, p\.z\)/g) || []).length === 3);
    ok("mk0.60/6: the cell walk steps ONE axis at a time (consecutive cells share an EDGE)",
      /const stepX = z === g1\.gz \? true : x === g1\.gx \? false : 2 \* err > -dz;/.test(dsrc));
    // Jeff, 2026-08-12: ONE rotation for the whole line — the dominant axis of
    // start->end, decided once at order time. NOT per-step; and the
    // auto-continue conventions must never override it.
    ok("mk0.60/6: one rotation per line, taken from the order's dominant axis",
      /const orient = len > 1e-6 \? \(Math\.abs\(dxw\) >= Math\.abs\(dzw\) \? 0 : 1\) : null;/.test(dsrc)
      && /const orient = job\.orient != null \? job\.orient/.test(dsrc));
    ok("mk0.60/6: no per-cell rotation survives anywhere in the line machinery",
      !/row\.orient/.test(dsrc));
    ok("mk0.60/6: placement runs the real spawners and the real gate",
      /spawnWallCourses\(world, row\.x, field\.heightAt\(row\.x, row\.z\), row\.z, orient\)/.test(dsrc)
      && /spawnSandbag\(world, row\.x, row\.z, orient\)/.test(dsrc)
      && /const v = validatePlacement\(\{\n\s+blocked: !!\(cell\.blocked \|\| cell\.wallId\), ice: !!cell\.ice,\n\s+held: canBuild\(T, c0\.u, c0\.v\), resources: S\.resources, cost,/.test(dsrc));
    ok("mk0.60/6: an occupied cell is SKIPPED, scrap running dry stops the line",
      /return v\.msg === "NO SCRAP" \? "dry" : "skip";/.test(dsrc) && /job\.dry = true;/.test(dsrc));
    ok("mk0.60/6: a wall lay holds the squad on squad._pauseT, the existing dwell field",
      /sq\._pauseT = WALL_LAY_PAUSE_S;/.test(dsrc));
    ok("mk0.60/6: the seeded depot bags draw off a MAP-seed stream, never world.rng",
      /mulberry32\(MAP_SEED \^ 0x5ba6\)/.test(dsrc) && /const nBags = 4 \+ Math\.floor\(bagR\(\) \* 3\);/.test(dsrc));
    ok("mk0.60/6: the engineer team is on the build bar",
      /key: "sq_engineers", label: "ENGINEERS"/.test(dsrc) && /sq_engineers: "engineers"/.test(dsrc));
    // the geometry the line is built on, written down where a reader will look
    ok("mk0.60/6: the piece-vs-pitch geometry and the one-rotation rule are documented",
      /GEOMETRY, stated once/.test(dsrc) && /ONE ROTATION FOR THE WHOLE LINE/.test(dsrc));
    const ssrc = fs.readFileSync(new URL("../src/depot/save.js", import.meta.url), "utf8");
    ok("mk0.60/6: the half-laid line is reset-on-resume, and says so",
      /THE BUILD LINE IS DELIBERATELY NOT SAVED/.test(ssrc));
  }

  // (7) the piece-vs-pitch arithmetic itself: both pieces are 1.8m along their
  // long axis on a 2.0m grid, so a straight run is end-to-end bar a 0.2m joint.
  {
    const world = makeWorld({ field: flat, seed: 95 });
    const bag = spawnSandbag(world, 0, 0, 0);
    const wall = spawnWallCourses(world, 6, 0, 0, 0)[0];
    ok("mk0.60/7: bag and wall course share one long axis — 1.8m — on a 2.0m pitch",
      bag.hx * 2 === 1.8 && wall.hx * 2 === 1.8, `${bag.hx * 2}/${wall.hx * 2}`);
    ok("mk0.60/7: consecutive cells therefore leave a 0.2m joint, nothing wider",
      Math.abs(2.0 - bag.hx * 2 - 0.2) < 1e-9);
  }
}
// ==== end mk0.60 =============================================================

// ==== VISION T1: sight =======================================================
// The eye itself (mk0.70), re-pinned to cell resolution at mk0.71. sight.js is
// pure geometry and inert — nothing in the game imports it yet, so every
// assert below runs against hand-built fixture worlds. ORIENT 0 here, so the
// world<->canonical transforms DepotGame hands stepSight (invW/fwdU) are the
// identity.
//
// mk0.71 re-pin: canSee no longer walks the world in meters asking bodies —
// it marches the swept cell maps. Every canSee assert therefore builds the
// maps first (fillMaps) and names the target as the CELL a spot falls in.
// The meanings are unchanged; the fixture coordinates are unchanged too (each
// already sits on a cell center, and each blocker already owns its own cell).
{
  const idUV = (x, z) => ({ u: x, v: z });   // DepotGame's invW at ORIENT 0
  const idW = (u, v) => ({ x: u, z: v });    // DepotGame's fwdU at ORIENT 0
  const flatField = { heightAt: () => 0, dirty: false };
  // sees(world, eye, tx, tz): the mk0.70 canSee question, asked the mk0.71 way.
  const sees = (world, eye, tx, tz) => {
    const SG = makeSight(makeTerritory(29, 57));
    fillMaps(world, SG, idUV, idW);
    return canSee(SG, gridEye(SG, eye, idUV),
      Math.floor((tx + SG.halfU) / SG.cs), Math.floor((tz + SG.halfV) / SG.cs));
  };

  // (a) range — an eye sees clear ground inside its reach and nothing past it.
  {
    const flat = { field: { heightAt: () => 0 }, bodies: [] };
    const eye = eyeOf({ kind: "unit", pos: { x: 0, y: 0, z: 0 } });
    ok("VISION T1(a): a plain infantryman's eye carries SIGHT.unit and sits 0.5m up",
      eye.r === SIGHT.unit && eye.y === 0.5);
    ok("VISION T1(a): clear open ground 20m off is seen", sees(flat, eye, 0, 20) === true);
    ok("VISION T1(a): the same open ground 30m off is past the eye's reach", sees(flat, eye, 0, 30) === false);
    ok("VISION T1(a): a spotter's glasses reach farther than a sniper's scope, which reaches farther than a rifleman",
      SIGHT.spotter > SIGHT.sniper && SIGHT.sniper > SIGHT.unit);
    ok("VISION T1(a): a spotter body gets the spotter's reach",
      eyeOf({ kind: "unit", role: "spotter", pos: { x: 0, y: 0, z: 0 } }).r === SIGHT.spotter);
    ok("VISION T1(a): a sniper body gets the sniper's reach",
      eyeOf({ kind: "unit", role: "sniper", pos: { x: 0, y: 0, z: 0 } }).r === SIGHT.sniper &&
      eyeOf({ kind: "unit", tag: "sniper", pos: { x: 0, y: 0, z: 0 } }).r === SIGHT.sniper);
    ok("VISION T1(a): a tower's eye sits at the top of the tower, not at its feet",
      eyeOf({ kind: "tower", hy: 1.6, pos: { x: 0, y: 9, z: 0 } }).y === 9 + 1.6 + 0.45);
  }

  // (b) a ridge between the eye and the spot blocks it.
  {
    const ridge = { field: { heightAt: (x, z) => (Math.abs(z - 10) < 1.5 ? 6 : 0) }, bodies: [] };
    const eye = eyeOf({ kind: "unit", pos: { x: 0, y: 0, z: 0 } });
    ok("VISION T1(b): a ridge standing between eye and spot blocks the view", sees(ridge, eye, 0, 20) === false);
    ok("VISION T1(b): the same distance the other way, with no ridge, stays clear", sees(ridge, eye, 0, -20) === true);
  }

  // (c) a three-course wall blocks a man on the ground; a raised eye sees over.
  {
    const world = makeWorld({ field: flatField, seed: 1 });
    spawnWallCourses(world, 0, 0, 8, 0);   // broad across x, thin across z, at z=8
    const low = { x: 0, y: 0.5, z: 0, r: SIGHT.unit };            // a man on the ground
    const high = { x: 0, y: 3.5, z: 0, r: SIGHT.unit };           // the same man 3m higher
    ok("VISION T1(c): a wall blocks a man standing on the ground behind it", sees(world, low, 0, 16) === false);
    ok("VISION T1(c): an eye raised 3m looks straight over the same wall", sees(world, high, 0, 16) === true);
  }

  // (d) a spot on a hill is seen from below when nothing stands in the way.
  {
    const hill = { field: { heightAt: (x, z) => Math.max(0, Math.min(4, (z - 14) * 2)) }, bodies: [] };
    const eye = eyeOf({ kind: "unit", pos: { x: 0, y: 0, z: 0 } });
    ok("VISION T1(d): a spot on the hillside is seen from the flat below it", sees(hill, eye, 0, 18) === true);
  }

  // (e) the team map: only team-2 eyes stand in the far corner, so the corner
  // is lit for team 2 and dark for team 1.
  {
    const T = makeTerritory(29, 57);
    const SG = makeSight(T);
    ok("VISION T1(e): the sight map shares the territory grid's own frame",
      SG.nx === T.nx && SG.nz === T.nz && SG.cs === T.cs && SG.halfU === T.halfU && SG.halfV === T.halfV);
    const world = makeWorld({ field: flatField, seed: 1 });
    addBody(world, { kind: "unit", team: 2, mass: 80, hx: 0.3, hy: 0.9, hz: 0.3, x: 20, y: 0.9, z: 40, hp: 40 });
    addBody(world, { kind: "unit", team: 1, mass: 80, hx: 0.3, hy: 0.9, hz: 0.3, x: -20, y: 0.9, z: -40, hp: 40 });
    stepSight(world, SG, idUV, idW);
    ok("VISION T1(e): the enemy corner is lit for the side standing in it", seenAt(SG, 20, 40, 2) === true);
    ok("VISION T1(e): the same corner is dark for the side with no eyes there", seenAt(SG, 20, 40, 1) === false);
    ok("VISION T1(e): each side sees the ground its own man stands on", seenAt(SG, -20, -40, 1) === true);
    ok("VISION T1(e): and not the ground the other man stands on", seenAt(SG, -20, -40, 2) === false);
    ok("VISION T1(e): a spot off the grid is never seen", seenAt(SG, 900, 900, 1) === false && seenAt(SG, -900, -900, 2) === false);

    // (g) the dice never move: building the map draws nothing from world.rng.
    let draws = 0;
    const rng0 = world.rng;
    world.rng = () => { draws++; return rng0(); };
    stepSight(world, SG, idUV, idW);
    world.rng = rng0;
    ok("VISION T1(g): building the sight map draws nothing from the world's dice", draws === 0, `${draws} draws`);
  }

  // (f) two identical worlds produce identical maps, byte for byte.
  {
    const build = () => {
      const world = makeWorld({ field: flatField, seed: 7 });
      addBody(world, { kind: "unit", team: 1, mass: 80, hx: 0.3, hy: 0.9, hz: 0.3, x: -6, y: 0.9, z: -12, hp: 40 });
      addBody(world, { kind: "unit", team: 1, mass: 80, hx: 0.3, hy: 0.9, hz: 0.3, x: 4, y: 0.9, z: -8, hp: 40 });
      addBody(world, { kind: "unit", team: 2, mass: 80, hx: 0.3, hy: 0.9, hz: 0.3, x: 2, y: 0.9, z: 14, hp: 40 });
      spawnWallCourses(world, 0, 0, 2, 0);
      const T = makeTerritory(29, 57);
      const SG = makeSight(T);
      stepSight(world, SG, idUV, idW);
      return SG;
    };
    const A = build(), B = build();
    let same = A.seen1.length === B.seen1.length && A.seen2.length === B.seen2.length;
    for (let i = 0; same && i < A.seen1.length; i++) same = A.seen1[i] === B.seen1[i] && A.seen2[i] === B.seen2[i];
    ok("VISION T1(f): two identical worlds give identical sight maps", same);
    let lit1 = 0, lit2 = 0;
    for (let i = 0; i < A.seen1.length; i++) { lit1 += A.seen1[i]; lit2 += A.seen2[i]; }
    ok("VISION T1(f): and the map is not trivially empty", lit1 > 0 && lit2 > 0, `${lit1}/${lit2}`);
  }

  // (h) walls and sandbags are never eyes (owner's rule, 2026-08-12) — they
  // block sight, they never grant it.
  {
    const world = makeWorld({ field: flatField, seed: 3 });
    for (let i = -3; i <= 3; i++) spawnWallCourses(world, i * 2, 0, 0, 0);
    for (let i = -3; i <= 3; i++) spawnSandbag(world, i * 2, 6, 0);
    const T = makeTerritory(29, 57);
    const SG = makeSight(T);
    stepSight(world, SG, idUV, idW);
    let lit = 0;
    for (let i = 0; i < SG.seen1.length; i++) lit += SG.seen1[i] + SG.seen2[i];
    ok("VISION T1(h): a field of walls and sandbags and nothing else is all dark, both sides", lit === 0, `${lit} lit cells`);
  }

  // (i) THE CLOCK (mk0.71). mk0.70's exact-box ray asked every body in the
  // world at every step of every line and cost 2,284ms per recompute at the
  // mid-fight census — 570x its budget. This rebuilds that same census
  // headless (the real 121x121 @2m field carrying buildDepotTerrain's base
  // relief, ~1,190 bodies, 120 troops, both flags, six towers) and fails if
  // one recompute ever again costs more than three times the 4ms budget.
  {
    const field = makeField(121, 2.0, 11);
    {
      const r = mulberry32(11);
      const { n, cs, h, half } = field;
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const x = i * cs - half, z = j * cs - half;
        const stepUp = (v0, w, h2) => { const t = Math.min(1, Math.max(0, (z - v0) / w + 0.5)); return h2 * t * t * (3 - 2 * t); };
        let y = 2.0
          + Math.sin(x * 0.075 + 1.3) * 0.42
          + Math.cos(z * 0.061 - 0.6) * 0.38
          + Math.sin((x + z) * 0.032) * 0.30
          + (r() - 0.5) * 0.06
          + stepUp(-18, 10, 1.8) + stepUp(6, 10, 2.0) + stepUp(30, 10, 2.2);
        const over = Math.max(0, Math.abs(x) - 29, Math.abs(z) - 57);
        if (over > 0) y = Math.max(-6, y - over * over * 0.55);
        h[j * n + i] = y;
      }
    }
    const gy = (x, z) => field.heightAt(x, z);
    const world = makeWorld({ field, seed: 11 });
    const r = mulberry32(99);
    // town masonry — ten hollow lattices, the bulk of the census
    const towns = [
      { x: 0, z: 49, nx: 9, nz: 8, ny: 5 }, { x: 0, z: -51, nx: 9, nz: 8, ny: 5 },
      { x: -14, z: 20, nx: 6, nz: 5, ny: 4 }, { x: 12, z: 24, nx: 5, nz: 4, ny: 4 },
      { x: -8, z: -6, nx: 8, nz: 4, ny: 3 }, { x: 16, z: -2, nx: 4, nz: 4, ny: 3 },
      { x: -18, z: 36, nx: 5, nz: 6, ny: 5 }, { x: 10, z: 40, nx: 7, nz: 6, ny: 5 },
      { x: -12, z: -28, nx: 6, nz: 5, ny: 4 }, { x: 14, z: -34, nx: 5, nz: 4, ny: 4 },
    ];
    let chunks = 0;
    outer:
    for (const t of towns) {
      const base = gy(t.x, t.z);
      for (let ky = 0; ky < t.ny; ky++) for (let kz = 0; kz < t.nz; kz++) for (let kx = 0; kx < t.nx; kx++) {
        if (ky > 0 && kx > 0 && kx < t.nx - 1 && kz > 0 && kz < t.nz - 1) continue; // hollow: walls only
        if (chunks >= 1120) break outer;
        const b = addBody(world, {
          kind: "chunk", team: 0, mass: MASON.mass, hx: MASON.hcs, hy: MASON.hcs, hz: MASON.hcs,
          x: t.x + (kx - (t.nx - 1) / 2) * MASON.pitch,
          y: base + MASON.hcs + ky * MASON.pitch,
          z: t.z + (kz - (t.nz - 1) / 2) * MASON.pitch, hp: 40,
        });
        b.sleeping = true; chunks++;
      }
    }
    let rocks = 0;
    for (const bz of [-17, 7, 31]) for (let x = -25; x <= 25; x += 5.5) {
      if (rocks >= 40) break;
      const z = bz + (r() - 0.5) * 2.5, rad = 3.4 + r() * 1.2, hh = 3.0 + r() * 0.9;
      addBody(world, { kind: "rock", team: 0, mass: 0, hx: rad * 0.55, hy: hh * 0.8, hz: rad * 0.55, x, y: gy(x, z) - hh * 0.2, z, hp: 400 });
      rocks++;
    }
    for (let i = 0; i < 15; i++) {
      const x = -26 + r() * 52, z = -50 + r() * 100;
      addBody(world, { kind: "tree", team: 0, mass: 260, hx: 0.28, hy: 1.6, hz: 0.28, x, y: gy(x, z) + 1.62, z, hp: 70 }).sleeping = true;
    }
    addBody(world, { kind: "flag", team: 1, mass: 0, hx: 0.1, hy: 0.1, hz: 0.1, x: 0, y: gy(0, 49) + 6, z: 49, hp: 10 });
    addBody(world, { kind: "flag", team: 2, mass: 0, hx: 0.1, hy: 0.1, hz: 0.1, x: 0, y: gy(0, -51) + 6, z: -51, hp: 10 });
    for (let i = 0; i < 6; i++) {
      const x = -10 + i * 4, z = 40 + (i % 2) * 3;
      addBody(world, { kind: "tower", team: 1, mass: 0, hx: 0.8, hy: 1.2, hz: 0.8, x, y: gy(x, z) + 1.2, z, hp: 120 });
    }
    const put = (team, x, z) => addBody(world, { kind: "unit", team, mass: 80, hx: 0.3, hy: 0.9, hz: 0.3, x, y: gy(x, z) + 0.9, z, hp: 40 });
    for (let c = 0; c < 3; c++) for (let i = 0; i < 34 && c * 34 + i < 100; i++) {
      put(2, -18 + c * 16 + (r() - 0.5) * 5, -24 + (i % 12) * 1.4 + (r() - 0.5) * 3);
    }
    for (let i = 0; i < 20; i++) put(1, -14 + (r() - 0.5) * 24, 34 + (r() - 0.5) * 8);

    const SG = makeSight(makeTerritory(29, 57));
    stepSight(world, SG, idUV, idW);          // warm
    let best = Infinity;
    for (let rep = 0; rep < 5; rep++) {
      const t0 = process.hrtime.bigint();
      stepSight(world, SG, idUV, idW);
      const ms = Number(process.hrtime.bigint() - t0) / 1e6;
      if (ms < best) best = ms;               // fastest of five: noise-proof, still catches any real regression
    }
    const troops = world.bodies.filter((b) => b.kind === "unit").length;
    let lit1 = 0, lit2 = 0;
    for (let i = 0; i < SG.seen1.length; i++) { lit1 += SG.seen1[i]; lit2 += SG.seen2[i]; }
    ok("VISION T1(i): one recompute at the mid-fight census stays inside three times its 4ms budget",
      best < 12, `${best.toFixed(2)} ms — ${world.bodies.length} bodies, ${troops} troops`);
    ok("VISION T1(i): and that recompute really lit the map for both sides", lit1 > 0 && lit2 > 0, `${lit1}/${lit2}`);
  }
}
// ==== end VISION T1 ==========================================================

// ==== VISION T2: one law — you shoot what you see ============================
// mk0.72. fieldReaches (state.js) is the one gate every shot passes through,
// and it now reads the sight map instead of the ground-control field. These
// asserts drive the two ends of that law: a tower that must wait for eyes,
// and enemy fire that may no longer bombard masonry nobody on its side sees.
// ORIENT 0 throughout, so the world<->canonical transforms are the identity.
{
  const idUV = (x, z) => ({ u: x, v: z });
  const idW = (u, v) => ({ x: u, z: v });

  // (a) THE TOWER WAITS FOR EYES. A ridge stands between a mortar tower and
  // an attacker beyond it. The tower's shell arcs over the ridge happily
  // (lofted fire ignores terrain), so nothing but sight can stop the
  // acquisition — and nothing on our side can see that ground until a man
  // walks over the crest.
  {
    // the ridge: 6m tall, one cell deep, running across the map at z=10
    const ridgeF = { heightAt: (x, z) => (Math.abs(z - 10) < 1.5 ? 6 : 0), dirty: false };
    const spec = { kind: "mortar", projSpeed: 33, occl: "lofted", range: 30, fireRate: 1 };
    const world = makeWorld({ field: ridgeF, seed: 71 });
    const tower = addBody(world, { kind: "tower", team: 1, mass: 0, hx: 0.8, hy: 1.2, hz: 0.8, x: 0, y: 1.2, z: 0, hp: 120 });
    const foe = addBody(world, { kind: "unit", team: 2, mass: 80, hx: 0.3, hy: 0.9, hz: 0.3, x: 0, y: 0.9, z: 20, hp: 40 });
    const T = makeTerritory(29, 57);
    T.sight = makeSight(T);
    // stepTowers' own scan loop, mirrored (it lives in DepotGame.jsx, which
    // this headless file cannot import — the same mirroring the fire
    // discipline fixture above uses).
    const acquires = () => {
      const muzzle = { x: tower.pos.x, y: tower.pos.y + tower.hy + 0.45, z: tower.pos.z };
      const eR = effRange(world, muzzle, spec);
      let best = null, bd = eR * eR;
      for (const e of world.bodies) {
        if ((e.kind !== "unit" && e.kind !== "vehicle") || !e.alive || e.team !== 2) continue;
        const c = idUV(e.pos.x, e.pos.z);
        if (!fieldReaches(T, c.u, c.v, 1)) continue;
        const dx = e.pos.x - tower.pos.x, dz = e.pos.z - tower.pos.z, d2 = dx * dx + dz * dz;
        if (d2 < bd && arcClears(world, muzzle, e.pos, spec, tower.id)) { bd = d2; best = e; }
      }
      return best;
    };
    stepSight(world, T.sight, idUV, idW);
    ok("VISION T2(a): the tower's own eye cannot see over the ridge", fieldReaches(T, 0, 20, 1) === false);
    ok("VISION T2(a): so it does not acquire the man standing behind it", acquires() === null);
    // a rifleman walks over the crest — now our side has eyes on that ground
    addBody(world, { kind: "unit", team: 1, mass: 80, hx: 0.3, hy: 0.9, hz: 0.3, x: 0, y: 0.9, z: 12, hp: 40 });
    stepSight(world, T.sight, idUV, idW);
    ok("VISION T2(a): a man over the crest lights that ground for the whole side", fieldReaches(T, 0, 20, 1) === true);
    ok("VISION T2(a): and the next scan acquires", acquires() === foe);
  }

  // (b) NO BOMBARDING WHAT NOBODY SEES. An enemy grenadier lobs over a ridge
  // at a player wall. Lofted fire ignores terrain entirely, so before this
  // phase he shelled masonry his side had never laid eyes on; now he holds
  // until one of his own can see it.
  // DEVIATION from the plan's wording ("an enemy rifleman"): a rifleman
  // cannot show this law. His gun reaches 13m and his eyes reach 24m, and
  // his shot already needs a clear flight path — so anything he can shoot he
  // can already see, and the gate is a no-op on him. The grenadier's lobbed
  // fire is where the law actually bites, and it is the same gate, in the
  // same shape, in the same file.
  {
    // ridge as above but finite across x, so a flanking eye can see past it
    const ridgeF = { heightAt: (x, z) => (Math.abs(z - 10) < 1.5 && Math.abs(x) < 6 ? 6 : 0), dirty: false };
    const world = makeWorld({ field: ridgeF, seed: 72 });
    const gren = addBody(world, { kind: "unit", team: 2, mass: 80, hx: 0.3, hy: 0.9, hz: 0.3, x: 0, y: 0.9, z: 0, hp: 40 });
    gren.tag = "gren"; gren.utype = "gren"; gren.wph = 0;
    const wall = addBody(world, { kind: "wall", team: 1, mass: 0, hx: 0.9, hy: 0.9, hz: 0.9, x: 0, y: 0.9, z: 18, hp: 70 });
    const T = makeTerritory(29, 57);
    T.sight = makeSight(T);
    stepSight(world, T.sight, idUV, idW);
    ok("VISION T2(b): the attacker's side cannot see the wall behind the ridge", fieldReaches(T, 0, 18, 2) === false);
    for (let i = 0; i < 30; i++) stepUnits(world, straightGrid(0, 1), identFwdDir, T, idUV);
    ok("VISION T2(b): so the grenadier takes no target", gren.tgtId == null);
    ok("VISION T2(b): and nothing is fired at it", world.projectiles.length === 0);
    // one of theirs comes round the flank, far enough off that his own rifle
    // never reaches the wall — he brings eyes, nothing else
    addBody(world, { kind: "unit", team: 2, mass: 80, hx: 0.3, hy: 0.9, hz: 0.3, x: 20, y: 0.9, z: 8, hp: 40 });
    stepSight(world, T.sight, idUV, idW);
    ok("VISION T2(b): the flanker sees the wall for his whole side", fieldReaches(T, 0, 18, 2) === true);
    for (let i = 0; i < 30; i++) stepUnits(world, straightGrid(0, 1), identFwdDir, T, idUV);
    ok("VISION T2(b): the grenadier takes the wall the moment his side can see it", gren.tgtId === wall.id);
    ok("VISION T2(b): and the shell is away", world.projectiles.length > 0);
  }

  // (c) the contested-boundary and orientation fixtures are re-pinned in
  // place, up in the Phase 4 Task 2 block — one law, one set of asserts.

  // (d) THE SAVE CARRIES NOTHING NEW. Sight is derived state: the file never
  // holds it, and a resumed run rebuilds it on the first territory tick
  // because the map is made where the territory is made.
  {
    const saveSrc = fs.readFileSync(new URL("../src/depot/save.js", import.meta.url), "utf8");
    ok("VISION T2(d): save.js stores no sight at all (derived, rebuilt on resume)", !/\bsight\b/i.test(saveSrc));
    const gameSrc = fs.readFileSync(new URL("../src/depot/DepotGame.jsx", import.meta.url), "utf8");
    ok("VISION T2(d): the sight map is made where the territory is made", /T\.sight\s*=\s*makeSight\(T\)/.test(gameSrc));
    ok("VISION T2(d): and it recomputes on the territory clock", /stepSight\(world,\s*T\.sight/.test(gameSrc));
  }

  // (e) THE GATE ITSELF, AND THE CARVE-OUTS THAT DIED. Structure fire used to
  // skip the gate entirely because a wall's own territory emission made it
  // permanently untargetable — a pathology sight does not have.
  {
    const stateSrc = fs.readFileSync(new URL("../src/depot/state.js", import.meta.url), "utf8");
    ok("VISION T2(e): fieldReaches reads the sight map", /seenAt\(T\.sight,\s*x,\s*z,\s*team\)/.test(stateSrc));
    ok("VISION T2(e): and no longer imports the ground-control bridge", !/fogStateForContested/.test(stateSrc));
    const terrSrc = fs.readFileSync(new URL("../src/depot/territory.js", import.meta.url), "utf8");
    ok("VISION T2(e): the contested-ground bridge is deleted", !/export function fogStateForContested/.test(terrSrc));
    ok("VISION T2(e): ownership, build rights and the wash are untouched",
      /export function fogStateFor\(/.test(terrSrc) && /export function valueAt\(/.test(terrSrc) &&
      /export function holderAt\(/.test(terrSrc) && /export function canBuild\(/.test(terrSrc));
    const unitsSrc = fs.readFileSync(new URL("../src/depot/units.js", import.meta.url), "utf8");
    ok("VISION T2(e): no enemy shooter claims an ungated structure scan any more", !/NO fieldReaches/.test(unitsSrc));
    ok("VISION T2(e): all seven enemy acquisition paths gate on sight",
      (unitsSrc.match(/fieldReaches\(T,/g) || []).length === 7, (unitsSrc.match(/fieldReaches\(T,/g) || []).length);
    ok("VISION T2(e): the sapper's contact plant stays ungated (he IS the eye, at arm's length)",
      /stepSapper/.test(unitsSrc) && !/fieldReaches[\s\S]{0,200}SAPPER_PLANT_PAD/.test(unitsSrc));
  }
}
// ==== end VISION T2 ==========================================================

// ==== VISION T4: halt and fight ==============================================
// mk0.74. The owner's playtest ruling: an attacking squad that SEES an enemy
// in weapon reach halts and fights until it's dead or gone, then resumes.
// MOVE stays quiet; sappers never halt for men. The halt lives in
// DepotGame.jsx's stepDepot (engageCheck, called just before stepSquad each
// tick) — game-layer code this headless file cannot import, so it is
// mirrored here verbatim, the same convention VISION T1/T2's tower- and
// stepDepot-scan mirrors already use. ORIENT 0, so world<->canonical is the
// identity; territory + sight are built and stepped every tick, same as
// VISION T2's fixtures.
{
  const idUV = (x, z) => ({ u: x, v: z });
  const idW = (u, v) => ({ x: u, z: v });
  const flat = { heightAt: () => 0, dirty: false, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } };

  // mirrors DepotGame.jsx's stepDepot engageCheck, byte-for-byte in logic.
  const ENGAGE_CHECK_S = 0.2, ENGAGE_HOLD_S = 0.35;
  const makeEngageCheck = (world, T, invW) => (sq) => {
    if (sq.order !== "attack" || sq.type === "sappers" || sq.type === "engineers") return;
    sq._engageCd = (sq._engageCd || 0) - world.dt;
    if (sq._engageCd > 0) return;
    sq._engageCd = ENGAGE_CHECK_S;
    const arms = INFANTRY_ARMS[sq.type];
    if (!arms) return;
    const R2 = arms.range * arms.range;
    for (const e of world.bodies) {
      if ((e.kind !== "unit" && e.kind !== "vehicle") || !e.alive || e.team !== 2) continue;
      const dx = e.pos.x - sq.anchor.x, dz = e.pos.z - sq.anchor.z;
      if (dx * dx + dz * dz > R2) continue;
      const c = invW(e.pos.x, e.pos.z);
      if (!fieldReaches(T, c.u, c.v, 1)) continue;
      sq._pauseT = Math.max(sq._pauseT || 0, ENGAGE_HOLD_S);
      return;
    }
  };

  // fixture: a rifle squad at the origin ordered ATTACK to (0,30), an enemy
  // conscript 8m off the path at (8,12) — inside the rifle's 15m reach and
  // its 24m sight the moment territory+sight are stepped.
  const mkFixture = (order, seed = 12) => {
    const world = makeWorld({ field: flat, seed });
    world.dt = 1 / 60;
    const sq = makeSquad(1, "rifles", 1, 0, 0);
    spawnSquadMembers(world, sq);
    sq.order = order; sq.dest = { x: 0, z: 30 };
    const foe = addBody(world, { kind: "unit", team: 2, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x: 8, y: 0.86, z: 12, hp: 58 });
    const T = makeTerritory(29, 57);
    T.sight = makeSight(T);
    return { world, sq, foe, T };
  };

  // (a) ATTACK past the conscript halts within a second and fires. Pinned
  // to fail before the change (zero muzzles, anchor sails past 3m in the
  // first second) and pass after.
  {
    const { world, sq, T } = mkFixture("attack");
    const engageCheck = makeEngageCheck(world, T, idUV);
    let muzzles = 0, anchorAt1s = null;
    for (let i = 0; i < 60; i++) {
      stepSight(world, T.sight, idUV, idW);
      engageCheck(sq);
      const before = world.projectiles.length;
      stepSquad(world, sq, world.dt);
      squadFire(world, sq, world.dt, T, idUV);
      if (world.projectiles.length > before) muzzles += world.projectiles.length - before;
      stepWorld(world);
      if (i === 59) anchorAt1s = sq.anchor.z;
    }
    ok("VISION T4(a): the squad halts within a second (anchor well short of the 3.2m unhalted march)",
      anchorAt1s < 1.0, `anchor.z=${anchorAt1s.toFixed(2)}`);
    ok("VISION T4(a): and it fires on the seen conscript (muzzle events)", muzzles > 0, `muzzles=${muzzles}`);
  }

  // (b) the conscript dies, the squad resumes, arrives, and digs in.
  {
    const { world, sq, foe, T } = mkFixture("attack");
    const engageCheck = makeEngageCheck(world, T, idUV);
    let killedAt = -1, arrivedAt = -1;
    for (let i = 0; i < 3000; i++) {
      stepSight(world, T.sight, idUV, idW);
      engageCheck(sq);
      stepSquad(world, sq, world.dt);
      squadFire(world, sq, world.dt, T, idUV);
      stepWorld(world);
      if (killedAt < 0 && i === 120) { applyDamage(world, foe, 1e9, { attacker: "player" }); killedAt = i; }
      if (arrivedAt < 0 && sq.order === "defend") { arrivedAt = i; break; }
    }
    ok("VISION T4(b): killing the conscript by hand lets the squad resume and arrive",
      arrivedAt > killedAt && Math.abs(sq.anchor.z - 30) < 1.01, `arrived=${arrivedAt} anchor.z=${sq.anchor.z.toFixed(2)}`);
    ok("VISION T4(b): arrival flips the order to defend", sq.order === "defend");
  }

  // (c) MOVE stays silent the whole way — stop short of arrival (order
  // flips to defend on arrival and a defending squad rightly opens fire;
  // that's untouched, unrelated behavior, not what this ruling governs).
  {
    const { world, sq, T } = mkFixture("move");
    const engageCheck = makeEngageCheck(world, T, idUV);
    let muzzles = 0;
    for (let i = 0; i < 690; i++) {
      stepSight(world, T.sight, idUV, idW);
      engageCheck(sq);
      const before = world.projectiles.length;
      stepSquad(world, sq, world.dt);
      squadFire(world, sq, world.dt, T, idUV);
      if (world.projectiles.length > before) muzzles += world.projectiles.length - before;
      stepWorld(world);
    }
    ok("VISION T4(c): a MOVE squad stays silent the whole way", muzzles === 0, `muzzles=${muzzles}`);
    ok("VISION T4(c): (still travelling, not yet dug in — the silence is the road, not the halt)", sq.order === "move");
  }

  // (d) a SAPPER squad under ATTACK never halts for men.
  {
    const { world, foe, T } = mkFixture("attack");
    const sap = makeSquad(2, "sappers", 1, 0, 0);
    spawnSquadMembers(world, sap);
    sap.order = "attack"; sap.dest = { x: 0, z: 30 };
    const engageCheck = makeEngageCheck(world, T, idUV);
    stepSight(world, T.sight, idUV, idW);
    for (let i = 0; i < 30; i++) engageCheck(sap);
    ok("VISION T4(d): engageCheck never touches a sapper squad's pause, enemy in reach or not",
      !sap._pauseT, `_pauseT=${sap._pauseT}`);
  }

  // (e) dice stability: the halt draws nothing. Isolated from squadFire
  // (whose own scatter draws legitimately scale with how much a squad
  // fires, unrelated to this law) — stepSquad + engageCheck only, so the
  // ONLY rng site in play is stepSquad's one-per-leg dwell draw. With
  // enemy and without, old (no engageCheck) and new (with engageCheck)
  // draw identically: the halt adds zero draws, and the pre-existing
  // with/without-enemy offset (today's truth: threatened cover-hop legs
  // are shorter than double-time legs, so leg counts already differ) is
  // unchanged by adding it.
  {
    const drawsFor = (withEnemy, withHalt) => {
      const world = makeWorld({ field: flat, seed: 12 });
      world.dt = 1 / 60;
      const sq = makeSquad(1, "rifles", 1, 0, 0);
      spawnSquadMembers(world, sq);
      sq.order = "attack"; sq.dest = { x: 0, z: 30 };
      let foe = null;
      if (withEnemy) foe = addBody(world, { kind: "unit", team: 2, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x: 8, y: 0.86, z: 12, hp: 1e9 });
      const T = makeTerritory(29, 57);
      T.sight = makeSight(T);
      const engageCheck = makeEngageCheck(world, T, idUV);
      let draws = 0;
      const raw = world.rng;
      world.rng = () => { draws++; return raw(); };
      for (let i = 0; i < 6000; i++) {
        stepSight(world, T.sight, idUV, idW);
        if (withHalt) engageCheck(sq);
        stepSquad(world, sq, world.dt);
        stepWorld(world);
        if (i === 120 && foe) foe.alive = false; // release the engagement so movement resumes either way
        if (sq.order === "defend") break;
      }
      return draws;
    };
    const eOldNo = drawsFor(true, false), eOldYes = drawsFor(true, true);
    const noEOldNo = drawsFor(false, false), noEOldYes = drawsFor(false, true);
    ok("VISION T4(e): with an enemy on the path, the halt draws exactly what the leg machine already drew",
      eOldNo === eOldYes, `no-halt=${eOldNo} with-halt=${eOldYes}`);
    ok("VISION T4(e): with no enemy at all, the halt (a no-op scan) still draws nothing extra",
      noEOldNo === noEOldYes, `no-halt=${noEOldNo} with-halt=${noEOldYes}`);
  }
}
// ==== end VISION T4 ==========================================================

// ==== COMMAND T1: per-tower discipline =======================================
// mk0.80. stepTowers (DepotGame.jsx :365) starts reading b.discipline first,
// falling back to its own argument only when the field is absent (old saves,
// bare fixtures). stepTowers lives in DepotGame.jsx — JSX, not importable
// headlessly — so its gate is mirrored here, the same convention the fire
// discipline fixture above (and the VISION T4/scan mirrors) already use. The
// mirror below is written to match stepTowers's gate LINE FOR LINE; it is
// intentionally updated in lockstep with :414 in the same task (1.2), which
// is why (a) fails before 1.2 and passes after — see the report.
{
  const gunSpec = { kind: "gun", projSpeed: 58, occl: "arc", volley: 1, acc: 0.02, blastR: 0, kv: 1, dmg: 1, fireRate: 0.2 };
  const makeFixture = () => {
    const world = makeWorld({ field: { heightAt: () => 0, dirty: false }, seed: 1 });
    const tower = addBody(world, { kind: "tower", team: 1, mass: 0, hx: 0.8, hy: 1, hz: 0.8, x: 0, y: 1, z: 0, hp: 80 });
    addBody(world, { kind: "wall", team: 1, mass: 0, hx: 0.9, hy: 0.9, hz: 0.9, x: 8, y: 0.9, z: 0, hp: 70 });
    const target = addBody(world, { kind: "unit", team: 2, mass: 90, hx: 0.4, hy: 0.9, hz: 0.4, x: 16, y: 0.9, z: 0, hp: 30 });
    target.v = { x: 0, y: 0, z: 0 };
    return { world, tower, target };
  };
  // mirrors stepTowers's gate (DepotGame.jsx :414) — post-1.2:
  //   const disc = b.discipline || discipline || "careful";
  //   if (disc !== "free" && friendlyFouls(...)) hold; else fire.
  const runCadence = (towerDiscipline, fallbackDiscipline, spec, pulls = 5) => {
    const { world, tower, target } = makeFixture();
    if (towerDiscipline != null) tower.discipline = towerDiscipline;
    const muzzle = { x: tower.pos.x, y: tower.pos.y + tower.hy + 0.45, z: tower.pos.z };
    for (let i = 0; i < pulls; i++) {
      // mirrors stepTowers's gate (DepotGame.jsx :414) post-1.2 — the
      // fail-first probe (pre-1.2: `fallbackDiscipline || "careful"`, which
      // ignores b.discipline) is recorded in the task report.
      const disc = tower.discipline || fallbackDiscipline || "careful";
      if (disc === "free" || !friendlyFouls(world, muzzle, target.pos, spec)) {
        towerShot(world, tower, target, spec);
      }
    }
    return world.projectiles.length;
  };

  // (a) per-tower field wins: a "free" tower fires through the friendly wall
  // while a "careful" tower in the identical situation holds — proves the
  // field is read PER TOWER, not off one shared argument.
  ok("COMMAND T1(a): a tower with discipline \"free\" fires through the friendly wall",
    runCadence("free", "careful", gunSpec) > 0);
  ok("COMMAND T1(a): a tower with discipline \"careful\" holds in the same situation",
    runCadence("careful", "free", gunSpec) === 0);

  // (b) compatibility contract: no discipline field on the body — the
  // fallback argument (stepTowers's old parameter) decides, exactly as
  // before this task.
  ok("COMMAND T1(b): no discipline field + fallback \"free\" fires (old-argument behavior preserved)",
    runCadence(null, "free", gunSpec) > 0);
  ok("COMMAND T1(b): no discipline field + fallback \"careful\" holds (old-argument behavior preserved)",
    runCadence(null, "careful", gunSpec) === 0);

  // (c) save/resume round-trip: discipline is a plain string on the tower
  // body — save.js's generic per-body sweep (BODY_HANDLED doesn't list it)
  // carries it through serializeFront -> parseFront -> restoreBodies with no
  // special-case code anywhere in save.js.
  {
    const field = makeField(9, 2.0, 1);
    const world = makeWorld({ field, seed: 1 });
    addBody(world, { kind: "tower", team: 1, mass: 0, hx: 0.8, hy: 1, hz: 0.8, x: 0, y: 1, z: 0, hp: 80 }).discipline = "free";
    const T = makeTerritory(5, 5);
    const S = {
      bell: 0, resources: 0, kills: 0, spawnRR: 0, started: false, mode: "wall", sandbagOrient: 0,
      nextSquadId: 1, zoom: 1, focus: { x: 0, z: 0 }, depotCensusAcc: 0, depotStanding: 1, enemyStanding: 1,
      starvedStreak: 0, _reportedBreak: false, _reportedSpent: false,
      manifest: {}, foe: {}, intelUp: false, intelArmedAt: 0, lastDispatch: null,
      pendingPlan: null, intelPlan: null, ws: {}, reg: {}, squads: [],
    };
    const json = serializeFront({ S, world, T, town: [], census: [], census2: [], rocks: [], smears: [], mapSeed: 1, rngSeed: 1 });
    const parsed = parseFront(json);
    ok("COMMAND T1(c): the save round-trip parses back", parsed.ok, parsed.reason);
    const world2 = makeWorld({ field: makeField(9, 2.0, 1), seed: 1 });
    const bodies2 = parsed.ok ? restoreBodies(world2, parsed.data, []) : [];
    const tower2 = bodies2.find((b) => b.kind === "tower");
    ok("COMMAND T1(c): tower.discipline rides the save/resume round-trip",
      !!tower2 && tower2.discipline === "free", tower2 && tower2.discipline);
  }
}
// ==== end COMMAND T1 ==========================================================

// ==== COMMAND T2: the proposed line ==========================================
// mk0.84. Two-point build orders no longer fire on the second tap — they
// propose. The order machinery (consumeOrderTap's build branch, acceptLine,
// __DEPOTORDER__'s auto-accept) lives in DepotGame.jsx — JSX, not importable
// headlessly — so its shape is pinned by source regex, the same convention
// COMMAND T1 and mk0.60/6 already use. The ghost-piece filter is mirrored
// over a hand grid, the same convention VISION T4's scan mirrors use.
{
  const dsrc = fs.readFileSync(new URL("../src/depot/DepotGame.jsx", import.meta.url), "utf8");

  // (a) the second tap PROPOSES: consumeOrderTap's build branch creates
  // S.linePending and never calls startBuildLine itself (only acceptLine
  // does, gated on accept — see (b)).
  const cotBody = (dsrc.match(/const consumeOrderTap = \(p\) => \{[\s\S]*?\n      const sellAt = \(gx, gz\) => \{/) || [""])[0];
  ok("COMMAND T2(a): consumeOrderTap's build branch creates S.linePending",
    /S\.linePending = \{ kind: om === "build_walls" \? "walls" : "bags", sq: osq\.id,/.test(cotBody));
  ok("COMMAND T2(a): consumeOrderTap itself never calls startBuildLine (only acceptLine does)",
    cotBody.length > 0 && !/startBuildLine\(/.test(cotBody));

  // (b) acceptLine: the only path that calls startBuildLine, and it nulls
  // S.selSquadId (the deselect the owner's rule requires on accept).
  const acceptBody = (dsrc.match(/const acceptLine = \(\) => \{[\s\S]*?\n      const rejectLine = \(\) => \{/) || [""])[0];
  ok("COMMAND T2(b): acceptLine exists and calls startBuildLine",
    /else startBuildLine\(sq, lp\.kind, lp\.a, lp\.b\);/.test(acceptBody));
  ok("COMMAND T2(b): acceptLine nulls S.selSquadId (full deselect on accept)",
    /S\.selSquadId = null; S\.orderMode = null; S\.buildPt0 = null;/.test(acceptBody));

  // (c) __DEPOTORDER__ auto-accepts — staging keeps driving the real order
  // path end to end without a screen to tap the confirm button on.
  const orderBody = (dsrc.match(/window\.__DEPOTORDER__ = \(id, kind, pts\) => \{[\s\S]*?\n      window\.__DEPOTFOCUS__ = \(x, z, zoom\) => \{/) || [""])[0];
  ok("COMMAND T2(c): __DEPOTORDER__ auto-accepts a proposed line (S.acceptLine())",
    /if \(S\.linePending\) \{ S\.linePending\.armedAt = world\.t; S\.acceptLine\(\); \}/.test(orderBody));
  // AUDIT FIX (mk0.85): the mk0.84 auto-accept no-opped — the pending's
  // armedAt was set THIS tick to world.t + PENDING_ARM_S, so acceptLine's
  // own pendingArmed(lp, world.t) gate always failed and silently swallowed
  // the accept. Staging has no trailing tap to guard against, so the fix
  // backdates the arm before accepting. Pinned directly, not just via (c)'s
  // re-pin above.
  ok("COMMAND T2(c) AUDIT FIX (mk0.85): __DEPOTORDER__ backdates armedAt before accepting a staged line",
    /S\.linePending\.armedAt = world\.t/.test(orderBody));

  // (d) the renderer overlay carries setLinePreview — the game-layer-only
  // furniture the brief said this file may grow (setReach's family).
  const rsrc = fs.readFileSync(new URL("../src/render/renderer.js", import.meta.url), "utf8");
  ok("COMMAND T2(d): renderer.js overlay carries setLinePreview",
    /setLinePreview\(on, spec\) \{/.test(rsrc));

  // (e) mirror — linePieces's cell filter (DepotGame.jsx, inside the COMMAND
  // T2 block) skips exactly the cells layPieceAt would skip: blocked,
  // occupied, iced, unheld — so a gap in the preview is a gap in the wall.
  // Mirrored here over a hand grid, kept in lockstep with the source line:
  //   if (cell.blocked || cell.wallId || cell.ice || !canBuild(T, c0.u, c0.v)) continue; // an honest gap
  ok("COMMAND T2(e): the source predicate matches the mirror line-for-line",
    /if \(cell\.blocked \|\| cell\.wallId \|\| cell\.ice \|\| !canBuild\(T, c0\.u, c0\.v\)\) continue; \/\/ an honest gap/.test(dsrc));
  {
    const handGrid = [
      { blocked: false, wallId: null, ice: false, held: true },   // laid
      { blocked: true, wallId: null, ice: false, held: true },    // gap: blocked
      { blocked: false, wallId: "w1", ice: false, held: true },   // gap: occupied (a wall stands there)
      { blocked: false, wallId: null, ice: true, held: true },    // gap: iced
      { blocked: false, wallId: null, ice: false, held: false },  // gap: unheld ground
      { blocked: false, wallId: null, ice: false, held: true },   // laid
    ];
    // mirror of: cell.blocked || cell.wallId || cell.ice || !canBuild(...)
    const isGap = (c) => !!(c.blocked || c.wallId || c.ice || !c.held);
    const laid = handGrid.filter((c) => !isGap(c));
    const gaps = handGrid.filter(isGap);
    ok("COMMAND T2(e) mirror: honest gaps land exactly on blocked/occupied/iced/unheld cells, nowhere else",
      laid.length === 2 && gaps.length === 4, `${laid.length} laid / ${gaps.length} gaps`);
  }
}
// ==== end COMMAND T2 ==========================================================

// ==== COMMAND T3: patrol ======================================================
// mk0.85. Two taps propose a route through Task 2's proposed-line confirm
// (kind "patrol": discs + dashed line, no ghost pieces — linePieces already
// returns [] for "patrol"). Accept and the squad walks A->B->A forever,
// fighting per the halt-and-fight rule (VISION T4, mk0.74). The order fields
// are set directly on the fixtures below — the tap interface (S.orderSquad,
// consumeOrderTap, acceptLine's patrol arm) is DepotGame.jsx game-layer code,
// already pinned by (f) and by Task 2's COMMAND T2 pins.
{
  const idUV = (x, z) => ({ u: x, v: z });
  const idW = (u, v) => ({ x: u, z: v });
  const flat = { heightAt: () => 0, dirty: false, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } };

  // (a) the loop is real: starting off the line, the squad is observed near
  // A, then later near B (it turned around), then later near A again —
  // three sampled epochs, order-independent of exact timing (watches for
  // the anchor crossing near-A/near-B thresholds in sequence, generous tick
  // budget) rather than predicting arrival ticks.
  {
    const world = makeWorld({ field: flat, seed: 5 });
    world.dt = 1 / 60;
    const sq = makeSquad(1, "rifles", 1, 0, 10);
    spawnSquadMembers(world, sq);
    sq.order = "patrol"; sq._patA = { x: 0, z: 0 }; sq._patB = { x: 0, z: 30 }; sq.dest = { x: 0, z: 0 };
    let sawA = false, sawB = false, sawA2 = false;
    for (let i = 0; i < 6000 && !sawA2; i++) {
      stepSquad(world, sq, world.dt);
      stepWorld(world);
      if (!sawA && sq.anchor.z < 2) sawA = true;
      else if (sawA && !sawB && sq.anchor.z > 25) sawB = true;
      else if (sawB && !sawA2 && sq.anchor.z < 2) sawA2 = true;
    }
    ok("COMMAND T3(a): the patrol reaches the near end (A)", sawA);
    ok("COMMAND T3(a): later it is observed near the far end (B) — it turned around", sawB);
    ok("COMMAND T3(a): later still it is back near A — the loop is real and endless", sawA2);
  }

  // (b) an enemy beside the patrol line gets fired on and the anchor holds
  // while he lives — halt-and-fight (VISION T4, mk0.74) applies to patrol.
  // Mirrors VISION T4(a)'s idiom exactly, order "patrol" in place of
  // "attack" — engageCheck (DepotGame.jsx, game-layer) is mirrored here,
  // updated for COMMAND T3's patrol gate (3.3); squadFire and stepSquad are
  // the real imports, already carrying the state.js/squads.js edits.
  const ENGAGE_CHECK_S = 0.2, ENGAGE_HOLD_S = 0.35;
  const makeEngageCheck = (world, T, invW) => (sq) => {
    if ((sq.order !== "attack" && sq.order !== "patrol") || sq.type === "sappers" || sq.type === "engineers") return;
    sq._engageCd = (sq._engageCd || 0) - world.dt;
    if (sq._engageCd > 0) return;
    sq._engageCd = ENGAGE_CHECK_S;
    const arms = INFANTRY_ARMS[sq.type];
    if (!arms) return;
    const R2 = arms.range * arms.range;
    for (const e of world.bodies) {
      if ((e.kind !== "unit" && e.kind !== "vehicle") || !e.alive || e.team !== 2) continue;
      const dx = e.pos.x - sq.anchor.x, dz = e.pos.z - sq.anchor.z;
      if (dx * dx + dz * dz > R2) continue;
      const c = invW(e.pos.x, e.pos.z);
      if (!fieldReaches(T, c.u, c.v, 1)) continue;
      sq._pauseT = Math.max(sq._pauseT || 0, ENGAGE_HOLD_S);
      return;
    }
  };
  {
    const world = makeWorld({ field: flat, seed: 12 });
    world.dt = 1 / 60;
    const sq = makeSquad(1, "rifles", 1, 0, 0);
    spawnSquadMembers(world, sq);
    sq.order = "patrol"; sq._patA = { x: 0, z: 0 }; sq._patB = { x: 0, z: 30 }; sq.dest = { x: 0, z: 30 };
    addBody(world, { kind: "unit", team: 2, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x: 8, y: 0.86, z: 12, hp: 58 });
    const T = makeTerritory(29, 57);
    T.sight = makeSight(T);
    const engageCheck = makeEngageCheck(world, T, idUV);
    let muzzles = 0, anchorAt1s = null;
    for (let i = 0; i < 60; i++) {
      stepSight(world, T.sight, idUV, idW);
      engageCheck(sq);
      const before = world.projectiles.length;
      stepSquad(world, sq, world.dt);
      squadFire(world, sq, world.dt, T, idUV);
      if (world.projectiles.length > before) muzzles += world.projectiles.length - before;
      stepWorld(world);
      if (i === 59) anchorAt1s = sq.anchor.z;
    }
    ok("COMMAND T3(b): a patrol halts within a second of seeing an enemy in reach (anchor well short of the 3.2m unhalted march)",
      anchorAt1s < 1.0, `anchor.z=${anchorAt1s.toFixed(2)}`);
    ok("COMMAND T3(b): and fires on him (muzzle events)", muzzles > 0, `muzzles=${muzzles}`);
  }

  // (c) MOVE and BUILD squads still never fire — pinned unchanged.
  {
    const mkQuiet = (order) => {
      const world = makeWorld({ field: flat, seed: 3 });
      const sq = makeSquad(1, "rifles", 1, 0, 0);
      spawnSquadMembers(world, sq);
      sq.order = order; sq.dest = { x: 0, z: 30 };
      addBody(world, { kind: "unit", team: 2, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x: 2, y: 0.86, z: 0, hp: 58 });
      const T = makeTerritory(29, 57);
      T.sight = makeSight(T);
      stepSight(world, T.sight, idUV, idW);
      squadFire(world, sq, 1 / 60, T, idUV);
      return world.projectiles.length;
    };
    ok("COMMAND T3(c): a MOVE squad still never fires", mkQuiet("move") === 0);
    ok("COMMAND T3(c): a BUILD squad still never fires", mkQuiet("build") === 0);
  }

  // (d) dice law: patrol reuses attack's leg machine verbatim (squads.js
  // :543, unedited) — the same 30m double-time crossing draws the same
  // number of times whichever order carries it. Twin run: an ATTACK squad
  // and a PATROL squad crossing the identical A->B path, no enemies (so
  // both double-time straight at MOVE_SPEED, no threatened cover-hop, no
  // dwell) — draws land exactly at each 9m leg boundary (HOP_R*1.5) and
  // nowhere else; the final partial leg settles inside ARRIVE_TOL before any
  // ld<0.3 draw site is reached, so 30m draws exactly 3 times (9/18/27m).
  {
    const drawsFor = (order) => {
      const world = makeWorld({ field: flat, seed: 9 });
      world.dt = 1 / 60;
      const sq = makeSquad(1, "rifles", 1, 0, 0);
      spawnSquadMembers(world, sq);
      sq.order = order;
      if (order === "patrol") { sq._patA = { x: 0, z: 0 }; sq._patB = { x: 0, z: 30 }; }
      sq.dest = { x: 0, z: 30 };
      let draws = 0;
      const raw = world.rng;
      world.rng = () => { draws++; return raw(); };
      for (let i = 0; i < 6000; i++) {
        stepSquad(world, sq, world.dt);
        stepWorld(world);
        if (order === "attack" && sq.order === "defend") break;         // arrived, no turnaround
        if (order === "patrol" && Math.abs(sq.dest.z - 30) > 0.5) break; // turned around: A->B leg done
      }
      return draws;
    };
    const attackDraws = drawsFor("attack"), patrolDraws = drawsFor("patrol");
    ok("COMMAND T3(d): a patrol crossing the same ground draws exactly what an attack draws (shared leg machine, no extra rng)",
      attackDraws === patrolDraws && attackDraws > 0, `attack=${attackDraws} patrol=${patrolDraws}`);
    ok("COMMAND T3(d): and that count is exactly the number of legs (3 nine-metre hops over 30m; the final partial leg settles inside ARRIVE_TOL before any draw)",
      patrolDraws === 3, `patrol=${patrolDraws}`);
  }

  // (e) save/resume: a patrolling squad comes back patrolling — order, both
  // endpoints and the current destination all ride (plain scalars through
  // save.js's generic squad serializer, same convention COMMAND T1(c) pins
  // for tower.discipline).
  {
    const field = makeField(9, 2.0, 1);
    const world = makeWorld({ field, seed: 1 });
    const sq = makeSquad(1, "rifles", 1, 0, 5);
    spawnSquadMembers(world, sq);
    sq.order = "patrol"; sq._patA = { x: 0, z: 0 }; sq._patB = { x: 0, z: 30 }; sq.dest = { x: 0, z: 30 };
    const T = makeTerritory(5, 5);
    const S = {
      bell: 0, resources: 0, kills: 0, spawnRR: 0, started: false, mode: "wall", sandbagOrient: 0,
      nextSquadId: 2, zoom: 1, focus: { x: 0, z: 0 }, depotCensusAcc: 0, depotStanding: 1, enemyStanding: 1,
      starvedStreak: 0, _reportedBreak: false, _reportedSpent: false,
      manifest: {}, foe: {}, intelUp: false, intelArmedAt: 0, lastDispatch: null,
      pendingPlan: null, intelPlan: null, ws: {}, reg: {}, squads: [sq],
    };
    const json = serializeFront({ S, world, T, town: [], census: [], census2: [], rocks: [], smears: [], mapSeed: 1, rngSeed: 1 });
    const parsed = parseFront(json);
    ok("COMMAND T3(e): the save round-trip parses back", parsed.ok, parsed.reason);
    const world2 = makeWorld({ field: makeField(9, 2.0, 1), seed: 1 });
    const bodies2 = parsed.ok ? restoreBodies(world2, parsed.data, []) : [];
    const squads2 = parsed.ok ? restoreSquads(parsed.data, bodies2) : [];
    const sq2 = squads2[0];
    ok("COMMAND T3(e): a patrolling squad comes back patrolling",
      !!sq2 && sq2.order === "patrol", sq2 && sq2.order);
    ok("COMMAND T3(e): both endpoints ride the round-trip",
      !!sq2 && sq2._patA && sq2._patA.x === 0 && sq2._patA.z === 0 && sq2._patB && sq2._patB.x === 0 && sq2._patB.z === 30,
      sq2 && JSON.stringify([sq2._patA, sq2._patB]));
    ok("COMMAND T3(e): the current destination rides the round-trip",
      !!sq2 && sq2.dest && sq2.dest.x === 0 && sq2.dest.z === 30, sq2 && JSON.stringify(sq2.dest));
  }

  // (f) pin — acceptLine's patrol arm sets _patA/_patB/order/dest. Source
  // regex, the same convention COMMAND T2(a)/(b) use for this JSX-only file.
  {
    const dsrc = fs.readFileSync(new URL("../src/depot/DepotGame.jsx", import.meta.url), "utf8");
    const acceptBody = (dsrc.match(/const acceptLine = \(\) => \{[\s\S]*?\n      const rejectLine = \(\) => \{/) || [""])[0];
    ok("COMMAND T3(f): acceptLine's patrol arm sets _patA, _patB, order and dest",
      /sq\._patA = \{ x: lp\.a\.x, z: lp\.a\.z \};/.test(acceptBody) &&
      /sq\._patB = \{ x: lp\.b\.x, z: lp\.b\.z \};/.test(acceptBody) &&
      /sq\.order = "patrol";/.test(acceptBody) &&
      /sq\.dest = \{ x: lp\.a\.x, z: lp\.a\.z \};/.test(acceptBody));
  }
}
// ==== end COMMAND T3 ==========================================================

// ==== COMMAND T4: attack structures ==========================================
// mk0.86. A pie toggle (STRUCTURES, armed types only — an INFANTRY_ARMS row,
// not engineers/sappers) sets squad.prefStruct: on, squadFire's structure
// scan runs FIRST with the man-scan as the automatic fallback when no
// structure is in reach; off, today's man-first order (structure scan still
// the automatic fallback, unchanged). The two scans are today's code, moved
// into named closures (state.js's squadFire: scanUnits/scanStructs) — sight
// gating (VISION, mk0.72) is unedited on both paths.
{
  const idUV = (x, z) => ({ u: x, v: z });
  const idW = (u, v) => ({ x: u, z: v });
  const flat = { heightAt: () => 0, dirty: false, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } };

  // fixture: a rifle squad (DEFEND, the default order) at the origin, an
  // enemy man 5m off on the +x bearing and an enemy wall 8m off on the
  // PERPENDICULAR +z bearing (no LOS overlap between the two candidate
  // targets), both well inside the rifle's 15m reach the moment sight comes
  // up.
  const mkFixture = (prefStruct, withWall = true) => {
    const world = makeWorld({ field: flat, seed: 21 });
    world.dt = 1 / 60;
    const sq = makeSquad(1, "rifles", 1, 0, 0);
    spawnSquadMembers(world, sq);
    sq.prefStruct = prefStruct;
    const man = addBody(world, { kind: "unit", team: 2, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x: 5, y: 0.86, z: 0, hp: 58 });
    let wall = null;
    if (withWall) {
      wall = addBody(world, {
        kind: "wall", team: 2, mass: 0, hx: WALL_HALF, hy: WALL_COURSE_HY, hz: WALL_THIN,
        x: 0, y: WALL_COURSE_HY, z: 8, hp: 100, friction: 0.65, restitution: 0.02,
      });
      wall.maxHp = wall.hp;
      wall.sleeping = true;
    }
    const T = makeTerritory(29, 29);
    T.sight = makeSight(T);
    return { world, sq, man, wall, T };
  };

  // (a) flag set, man AND wall both in sight/reach: the wall's hp drops
  // first (structure preferred).
  {
    const { world, sq, man, wall, T } = mkFixture(true, true);
    const manHp0 = man.hp, wallHp0 = wall.hp;
    let firstDrop = null;
    for (let i = 0; i < 600 && !firstDrop; i++) {
      stepSight(world, T.sight, idUV, idW);
      squadFire(world, sq, world.dt, T, idUV);
      stepWorld(world);
      if (wall.hp < wallHp0) firstDrop = "wall";
      else if (man.hp < manHp0) firstDrop = "man";
    }
    ok("COMMAND T4(a): STRUCTURES on — the wall's hp drops first",
      firstDrop === "wall", `first=${firstDrop} wall.hp=${wall.hp.toFixed(2)} man.hp=${man.hp}`);
    ok("COMMAND T4(a): the man is untouched while the wall is worked",
      man.hp === manHp0, `man.hp=${man.hp}`);
  }

  // (b) same fixture, flag off: the man dies first — today's priority,
  // pinned.
  {
    const { world, sq, man, wall, T } = mkFixture(false, true);
    const manHp0 = man.hp, wallHp0 = wall.hp;
    let firstDrop = null;
    for (let i = 0; i < 600 && !firstDrop; i++) {
      stepSight(world, T.sight, idUV, idW);
      squadFire(world, sq, world.dt, T, idUV);
      stepWorld(world);
      if (man.hp < manHp0) firstDrop = "man";
      else if (wall.hp < wallHp0) firstDrop = "wall";
    }
    ok("COMMAND T4(b): STRUCTURES off — the man's hp drops first (today's priority, pinned)",
      firstDrop === "man", `first=${firstDrop} wall.hp=${wall.hp} man.hp=${man.hp.toFixed(2)}`);
    ok("COMMAND T4(b): the wall is untouched while the man is worked",
      wall.hp === wallHp0, `wall.hp=${wall.hp}`);
  }

  // (c) the flag survives a save/resume — a plain boolean on the squad,
  // same convention COMMAND T1(c)/T3(e) pin for tower.discipline/patrol.
  {
    const field = makeField(9, 2.0, 1);
    const world = makeWorld({ field, seed: 1 });
    const sq = makeSquad(1, "rifles", 1, 0, 5);
    spawnSquadMembers(world, sq);
    sq.prefStruct = true;
    const T = makeTerritory(5, 5);
    const S = {
      bell: 0, resources: 0, kills: 0, spawnRR: 0, started: false, mode: "wall", sandbagOrient: 0,
      nextSquadId: 2, zoom: 1, focus: { x: 0, z: 0 }, depotCensusAcc: 0, depotStanding: 1, enemyStanding: 1,
      starvedStreak: 0, _reportedBreak: false, _reportedSpent: false,
      manifest: {}, foe: {}, intelUp: false, intelArmedAt: 0, lastDispatch: null,
      pendingPlan: null, intelPlan: null, ws: {}, reg: {}, squads: [sq],
    };
    const json = serializeFront({ S, world, T, town: [], census: [], census2: [], rocks: [], smears: [], mapSeed: 1, rngSeed: 1 });
    const parsed = parseFront(json);
    ok("COMMAND T4(c): the save round-trip parses back", parsed.ok, parsed.reason);
    const world2 = makeWorld({ field: makeField(9, 2.0, 1), seed: 1 });
    const bodies2 = parsed.ok ? restoreBodies(world2, parsed.data, []) : [];
    const squads2 = parsed.ok ? restoreSquads(parsed.data, bodies2) : [];
    const sq2 = squads2[0];
    ok("COMMAND T4(c): prefStruct rides the round-trip", !!sq2 && sq2.prefStruct === true, sq2 && sq2.prefStruct);
  }

  // (d) flag set, NO structure in reach: the squad still fights men — the
  // fallback is automatic, nobody stands idle.
  {
    const { world, sq, man, T } = mkFixture(true, false);
    const manHp0 = man.hp;
    let dropped = false;
    for (let i = 0; i < 600 && !dropped; i++) {
      stepSight(world, T.sight, idUV, idW);
      squadFire(world, sq, world.dt, T, idUV);
      stepWorld(world);
      if (man.hp < manHp0) dropped = true;
    }
    ok("COMMAND T4(d): STRUCTURES on but no structure in reach — the squad still fights the man (automatic fallback)",
      dropped, `man.hp=${man.hp}`);
  }
}
// ==== end COMMAND T4 ==========================================================

// ==== POSSESSION T1: take control — the possessed squad walks ================
// mk0.90 (Phase 4 Task 1). drivePossessedSquad (squads.js) walks a squad's
// anchor by the stick vector at MOVE_SPEED and reissues member formation
// goals every tick — no orders, no rng, no fire. The command loop
// (DepotGame.jsx stepDepot) skips a possessed squad entirely; RELEASE and
// the bell (ringBell) hand it back to standing orders. Possession itself
// never rides a save (S.possess is not read by serializeFront). DepotGame.jsx
// is JSX, not importable headlessly — its shape is pinned by source regex,
// the convention COMMAND T1-T4 already use.
{
  const flatField = { heightAt: () => 0, dirty: false, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } };
  const dsrc = fs.readFileSync(new URL("../src/depot/DepotGame.jsx", import.meta.url), "utf8");

  // (a) mirror+pin: driving a squad straight for 2 sim-seconds moves the
  // anchor ~6.4m (MOVE_SPEED 3.2 * 2s), and every live member holds within
  // the formation ring (+tolerance) of it — the ring closes on the anchor
  // as it walks, exactly as DEFEND's own micro-slots do.
  {
    const world = makeWorld({ field: flatField, seed: 5 });
    const sq = makeSquad(1, "rifles", 1, 0, 0);
    spawnSquadMembers(world, sq);
    const dt = world.dt;
    const steps = Math.round(2 / dt);
    for (let i = 0; i < steps; i++) { drivePossessedSquad(world, sq, 0, 1, dt); stepWorld(world); }
    ok("POSSESSION T1(a): the anchor moves ~6.4m (MOVE_SPEED*2s) driving straight for 2 sim-seconds",
      Math.abs(sq.anchor.z - 6.4) < 0.1, `anchor=(${sq.anchor.x.toFixed(2)},${sq.anchor.z.toFixed(2)})`);
    let maxD = 0;
    for (const id of sq.memberIds) {
      const u = world.byId.get(id);
      const d = Math.hypot(u.pos.x - sq.anchor.x, u.pos.z - sq.anchor.z);
      if (d > maxD) maxD = d;
    }
    // 4.44m measured, cohesion-clamped (see squads.js's plan-deviation
    // comment on drivePossessedSquad): the trailing member's own top speed
    // equals the anchor's, so the rubber band (COHESION_M=6) is what bounds
    // him, not the 1.5m ring alone. Tolerance set above the measured value,
    // below the COHESION_M ceiling.
    ok("POSSESSION T1(a): every live member holds within the formation ring (+tolerance) of the walking anchor",
      maxD < 5.5, `maxD=${maxD.toFixed(2)}`);
  }

  // (a2) mk0.90 drift audit item B: the rubber-band clamp, actually
  // exercised over a longer drive (2s wasn't enough to show a runaway) —
  // sampled once per sim-second across a straight 6s drive, the rear
  // member's distance from the anchor must never exceed COHESION_M + 1.5m
  // (the cap itself, plus slack for the ring radius / catch-up lag). FAILS
  // against the plan's original UNCLAMPED drivePossessedSquad (Phase 4's
  // Step 1.2 code, verbatim — no rubber band, no cap, the anchor simply
  // never waits): verified by reverting squads.js's band+cap to that literal
  // code and re-running this assertion (the trail opens past COHESION_M+1.5m
  // inside the 6s window and keeps climbing), then re-applying the shipped
  // band+cap.
  {
    const world = makeWorld({ field: flatField, seed: 11 });
    const sq = makeSquad(1, "rifles", 1, 0, 0);
    spawnSquadMembers(world, sq);
    const dt = world.dt;
    const stepsPerSec = Math.round(1 / dt);
    let worstTrail = 0;
    const samples = [];
    for (let sec = 1; sec <= 6; sec++) {
      for (let i = 0; i < stepsPerSec; i++) { drivePossessedSquad(world, sq, 0, 1, dt); stepWorld(world); }
      let maxD = 0;
      for (const id of sq.memberIds) {
        const u = world.byId.get(id);
        const d = Math.hypot(u.pos.x - sq.anchor.x, u.pos.z - sq.anchor.z);
        if (d > maxD) maxD = d;
      }
      samples.push(maxD.toFixed(2));
      if (maxD > worstTrail) worstTrail = maxD;
    }
    ok("POSSESSION T1(a2) [mk0.90 audit item B]: the rear member never trails the anchor past COHESION_M+1.5m over a straight 6s drive",
      worstTrail < COHESION_M + 1.5, `worst=${worstTrail.toFixed(2)} samples/sec=[${samples.join(",")}]`);
  }

  // (b) source pin: stepDepot's squad loop skips a possessed squad entirely
  // (no engageCheck, no stepSquad, no squadFire — the stick drives it
  // instead) as the loop's FIRST line, and a squad whose members all die
  // while possessed releases automatically right after pruneSquads.
  {
    const stepDepotBody = (dsrc.match(/function stepDepot\(world, grid, onStructureLost, town, onRuin, T, discipline, S\) \{[\s\S]*?\n\}/) || [""])[0];
    const guardIdx = stepDepotBody.indexOf('if (S.possess && S.possess.kind === "squad" && sq.id === S.possess.id) {');
    const engageIdx = stepDepotBody.indexOf("engageCheck(sq);");
    ok("POSSESSION T1(b): stepDepot's squad loop carries a possession guard",
      guardIdx >= 0, stepDepotBody.length);
    ok("POSSESSION T1(b): the guard is the loop's first line — it runs before engageCheck",
      guardIdx >= 0 && engageIdx >= 0 && guardIdx < engageIdx, `guard=${guardIdx} engage=${engageIdx}`);
    const pruneIdx = stepDepotBody.indexOf("S.squads = pruneSquads(world, S.squads);");
    const autoRelIdx = stepDepotBody.indexOf('if (S.possess && S.possess.kind === "squad" && !S.squads.some((q) => q.id === S.possess.id)) S.releasePossession();');
    ok("POSSESSION T1(b): a wiped-out possessed squad auto-releases, wired right after pruneSquads",
      pruneIdx >= 0 && autoRelIdx >= 0 && autoRelIdx > pruneIdx && autoRelIdx - pruneIdx < 200,
      `prune=${pruneIdx} autoRel=${autoRelIdx}`);
  }

  // (c) possession never serializes: S.possess is not part of serializeFront's
  // whitelisted run{} fields, and a save taken with possession live carries
  // no "possess" key anywhere in its JSON.
  {
    const field = makeField(9, 2.0, 1);
    const world = makeWorld({ field, seed: 1 });
    const T = makeTerritory(5, 5);
    const S = {
      bell: 0, resources: 0, kills: 0, spawnRR: 0, started: false, mode: "wall", sandbagOrient: 0,
      nextSquadId: 1, zoom: 1, focus: { x: 0, z: 0 }, depotCensusAcc: 0, depotStanding: 1, enemyStanding: 1,
      starvedStreak: 0, _reportedBreak: false, _reportedSpent: false,
      manifest: {}, foe: {}, intelUp: false, intelArmedAt: 0, lastDispatch: null,
      pendingPlan: null, intelPlan: null, ws: {}, reg: {}, squads: [],
      possess: { kind: "squad", id: 1 }, possessInput: { vx: 0, vz: 1 }, // live at save time
    };
    const json = serializeFront({ S, world, T, town: [], census: [], census2: [], rocks: [], smears: [], mapSeed: 1, rngSeed: 1 });
    ok("POSSESSION T1(c): serializeFront never writes a \"possess\" key anywhere in the saved JSON",
      !json.includes("possess"), json.includes("possess") ? "LEAKED" : "clean");
    const dsaveSrc = fs.readFileSync(new URL("../src/depot/save.js", import.meta.url), "utf8");
    ok("POSSESSION T1(c) source pin: save.js's run{} writer never reads S.possess",
      !/S\.possess/.test(dsaveSrc));
  }

  // (d) source pin: ringBell releases possession, and does so BEFORE
  // saveFront — the ratified rule that no save ever carries a possession.
  {
    const ringBellBody = (dsrc.match(/const ringBell = \(\) => \{[\s\S]*?\n      \};/) || [""])[0];
    ok("POSSESSION T1(d): ringBell's first line releases any live possession",
      /^const ringBell = \(\) => \{\s*\n\s*if \(S\.possess\) S\.releasePossession\(\);/.test(ringBellBody), ringBellBody.slice(0, 80));
    const relIdx = ringBellBody.indexOf("S.releasePossession();");
    const saveIdx = ringBellBody.indexOf("saveFront();");
    ok("POSSESSION T1(d): the release runs before saveFront",
      relIdx >= 0 && saveIdx >= 0 && relIdx < saveIdx, `rel=${relIdx} save=${saveIdx}`);
  }

  // (e) zero new rng draws while driving: player input is not a replayed
  // stream — the drive path itself never touches world.rng, with or without
  // an enemy standing nearby.
  {
    const dt = 1 / 120;
    const steps = Math.round(2 / dt);
    const drive = (withEnemy) => {
      const world = makeWorld({ field: flatField, seed: 7 });
      const sq = makeSquad(1, "rifles", 1, 0, 0);
      spawnSquadMembers(world, sq);
      if (withEnemy) addBody(world, { kind: "unit", team: 2, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x: 5, y: 0.88, z: 5, hp: 58 });
      let draws = 0;
      const raw = world.rng;
      world.rng = () => { draws++; return raw(); };
      for (let i = 0; i < steps; i++) drivePossessedSquad(world, sq, 0, 1, dt);
      return draws;
    };
    const drawsNoEnemy = drive(false), drawsWithEnemy = drive(true);
    ok("POSSESSION T1(e): drivePossessedSquad draws ZERO rng, with or without an enemy nearby, and the counts match",
      drawsNoEnemy === 0 && drawsWithEnemy === 0, `noEnemy=${drawsNoEnemy} withEnemy=${drawsWithEnemy}`);
  }
}
// ==== end POSSESSION T1 =======================================================

// ==== POSSESSION T2: the trigger — volley at the aim =========================
// mk0.91 (Phase 4 Task 2). possessedVolley (state.js) is one trigger pull:
// every living armed member off cooldown fires once at a synthetic ground
// target through shooterFire, exactly like squadFire's own trigger pull —
// same scatter/lead/wind, same sight law (fieldReaches at the aim cell).
// Spotters (and any type with no INFANTRY_ARMS row — engineers, sappers)
// never fire.
{
  const flatField = { heightAt: () => 0, dirty: false, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } };
  const idUV = (x, z) => ({ u: x, v: z }); // DepotGame's invW at ORIENT 0
  const muzzlesOf = (world) => world.events.filter((e) => e.type === "muzzle");

  // (a) mirror+pin: a 4-man rifle squad volleys once each at an aim 10m off.
  {
    const world = makeWorld({ field: flatField, seed: 21 });
    const sq = makeSquad(1, "rifles", 1, 0, 0);
    spawnSquadMembers(world, sq);
    world.events.length = 0;
    const fired = possessedVolley(world, sq, { x: 10, z: 0 }, null);
    const muzzles = muzzlesOf(world);
    ok("POSSESSION T2(a): possessedVolley fires one shooterFire per living armed member at the aim",
      fired === 4 && muzzles.length === 4, `fired=${fired} muzzles=${muzzles.length}`);
    ok("POSSESSION T2(a): every muzzle carries weapon:\"rifle\"",
      muzzles.every((m) => m.weapon === "rifle"), muzzles.map((m) => m.weapon).join(","));
  }

  // (b) the sight law holds: an aim in a cell team 1 does not see draws zero
  // muzzles; the identical aim in a cell it does see fires normally (the
  // control). Sight map hand-stamped (lit only west of x=8), same convention
  // reachPolygon's own sight-boundary test uses.
  {
    const world = makeWorld({ field: flatField, seed: 22 });
    const sq = makeSquad(1, "rifles", 1, 0, 0);
    spawnSquadMembers(world, sq);
    const T = makeTerritory(29, 57);
    T.sight = makeSight(T);
    for (let iz = 0; iz < T.sight.nz; iz++) for (let ix = 0; ix < T.sight.nx; ix++) {
      const u = -T.sight.halfU + (ix + 0.5) * T.sight.cs;
      if (u < 8) T.sight.seen1[iz * T.sight.nx + ix] = 1;
    }
    world.events.length = 0;
    const firedDark = possessedVolley(world, sq, { x: 20, z: 0 }, T, idUV);
    ok("POSSESSION T2(b): a dark aim cell (unseen) draws zero muzzles",
      firedDark === 0 && muzzlesOf(world).length === 0, `fired=${firedDark}`);
    world.events.length = 0;
    const firedLit = possessedVolley(world, sq, { x: 0, z: 0 }, T, idUV);
    ok("POSSESSION T2(b) control: the identical squad, aim in a SEEN cell, fires normally",
      firedLit === 4, `fired=${firedLit}`);
  }

  // (c) spotters and unarmed types never fire: a sniper pair volleys once
  // (the spotter never pulls a trigger), and an engineer squad — no
  // INFANTRY_ARMS row — refuses outright.
  {
    const world = makeWorld({ field: flatField, seed: 23 });
    const sniperSq = makeSquad(1, "sniper", 1, 0, 0);
    spawnSquadMembers(world, sniperSq);
    world.events.length = 0;
    const firedSniper = possessedVolley(world, sniperSq, { x: 10, z: 0 }, null);
    const muzzlesSniper = muzzlesOf(world);
    ok("POSSESSION T2(c): a sniper pair volleys ONCE, not twice — the spotter never fires",
      firedSniper === 1 && muzzlesSniper.length === 1, `fired=${firedSniper} muzzles=${muzzlesSniper.length}`);
    ok("POSSESSION T2(c): the one muzzle is the sniper's (weapon:\"sniper\")",
      !!muzzlesSniper[0] && muzzlesSniper[0].weapon === "sniper");

    const engSq = makeSquad(2, "engineers", 1, 0, 0);
    spawnSquadMembers(world, engSq);
    world.events.length = 0;
    const firedEng = possessedVolley(world, engSq, { x: 10, z: 0 }, null);
    ok("POSSESSION T2(c): engineers carry no INFANTRY_ARMS row — the volley refuses, zero muzzles",
      firedEng === 0 && muzzlesOf(world).length === 0, `fired=${firedEng}`);
  }

  // (d) per-member cooldowns are honored: a second pull 0.1s later (the
  // game layer's own decay, u.fireCd -= dt, mirrored here) finds every man
  // still on cooldown — zero muzzles.
  {
    const world = makeWorld({ field: flatField, seed: 24 });
    const sq = makeSquad(1, "rifles", 1, 0, 0);
    spawnSquadMembers(world, sq);
    world.events.length = 0;
    const fired1 = possessedVolley(world, sq, { x: 10, z: 0 }, null);
    for (const id of sq.memberIds) { const u = world.byId.get(id); u.fireCd -= 0.1; }
    world.events.length = 0;
    const fired2 = possessedVolley(world, sq, { x: 10, z: 0 }, null);
    ok("POSSESSION T2(d): per-member cooldowns are honored — 0.1s after a full volley (fireRate 1.3s), nobody is off cooldown yet",
      fired1 === 4 && fired2 === 0, `fired1=${fired1} fired2=${fired2}`);
  }

  // (e) source pin: possessedVolley reads INFANTRY_ARMS[squad.type] and
  // shares squadFire's own blast fallbacks verbatim (INFANTRY_BLAST_R/
  // INFANTRY_KV), not a re-derived pair of numbers.
  {
    const stateSrc = fs.readFileSync(new URL("../src/depot/state.js", import.meta.url), "utf8");
    const volleyBody = (stateSrc.match(/export function possessedVolley\([\s\S]*?\n\}/) || [""])[0];
    ok("POSSESSION T2(e) source pin: possessedVolley reads INFANTRY_ARMS[squad.type]",
      /const spec = INFANTRY_ARMS\[squad\.type\];/.test(volleyBody), volleyBody.length);
    ok("POSSESSION T2(e) source pin: possessedVolley shares squadFire's own blast fallbacks (INFANTRY_BLAST_R/INFANTRY_KV)",
      /blastR: spec\.blastR != null \? spec\.blastR : INFANTRY_BLAST_R/.test(volleyBody) &&
      /kv: spec\.kv != null \? spec\.kv : INFANTRY_KV/.test(volleyBody));
  }

  // mk0.91 audit item A (possession hygiene, drift audit): a stale aim or a
  // FIRE flag stuck by a mid-hold bell release can never carry into the next
  // possession — S.takeControl and S.releasePossession both clear the
  // trigger state (S.possessAim = null; S.fireHeld = false;).
  {
    const gameSrc = fs.readFileSync(new URL("../src/depot/DepotGame.jsx", import.meta.url), "utf8");
    const takeControlBody = (gameSrc.match(/S\.takeControl = \(\) => \{[\s\S]*?\n      \};/) || [""])[0];
    const releaseBody = (gameSrc.match(/S\.releasePossession = \(\) => \{[\s\S]*?\n      \};/) || [""])[0];
    ok("POSSESSION T2 audit item A source pin: S.takeControl clears possessAim/fireHeld",
      /S\.possessAim = null; S\.fireHeld = false;/.test(takeControlBody), takeControlBody.length);
    ok("POSSESSION T2 audit item A source pin: S.releasePossession clears possessAim/fireHeld",
      /S\.possessAim = null; S\.fireHeld = false;/.test(releaseBody), releaseBody.length);
  }
}
// ==== end POSSESSION T2 =======================================================

// ==== POSSESSION T3: manual fire control — the possessed tower =============
// mk0.92 (Phase 4 Task 3). possessedTowerFire (state.js) is one trigger pull
// on the tower's own real spec/cooldown/muzzle, at the owner's aim — through
// towerShot, exactly like the tower's own auto-fire. Sight-gated at the aim
// cell. stepTowers (DepotGame.jsx) gains a possession guard that skips
// acquisition/fire outright for the possessed body; DepotGame.jsx is JSX and
// cannot be imported headlessly, so (a)/(e) are source pins / mirrors — the
// same convention COMMAND T1 and VISION T2(a)'s tower fixtures already use.
{
  const flatField = { heightAt: () => 0, dirty: false, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } };
  const idUV = (x, z) => ({ u: x, v: z });
  const idW = (u, v) => ({ x: u, z: v });
  const muzzlesOf = (world) => world.events.filter((e) => e.type === "muzzle");
  const makeTower = (world, type = "gun") => {
    const spec = TOWER_SPECS[type];
    const b = addBody(world, { kind: "tower", team: 1, mass: 0, hx: 0.8, hy: spec.hy, hz: 0.8, x: 0, y: 1 + spec.hy, z: 0, hp: spec.hp });
    b.towerType = type;
    return b;
  };

  // (a) source pin: stepTowers takes a possessedId argument and its guard —
  // the loop's first body line after the kind/alive filter — skips straight
  // past the possessed tower, no acquisition, no fire.
  {
    const gameSrc = fs.readFileSync(new URL("../src/depot/DepotGame.jsx", import.meta.url), "utf8");
    const stepTowersBody = (gameSrc.match(/export function stepTowers\([\s\S]*?\n\}/) || [""])[0];
    ok("POSSESSION T3(a) source pin: stepTowers takes a possessedId argument",
      /export function stepTowers\(world, T, discipline, possessedId\)/.test(gameSrc));
    ok("POSSESSION T3(a) source pin: the guard skips the possessed body — no acquisition, no fire",
      /if \(possessedId === b\.id\) \{ b\.fireCd = \(b\.fireCd \|\| 0\) - dt; continue; \}/.test(stepTowersBody), stepTowersBody.length);
  }

  // (b) mirror+pin: a gun tower fires its real spec at the aim, honoring its
  // own cooldown — a second pull 0.1s later (fireRate 1.05s) finds it cold.
  {
    const world = makeWorld({ field: flatField, seed: 31 });
    const tower = makeTower(world, "gun");
    world.events.length = 0;
    const fired1 = possessedTowerFire(world, tower, { x: 10, z: 0 }, null);
    const muzzles1 = muzzlesOf(world);
    ok("POSSESSION T3(b): possessedTowerFire fires the tower's real spec at the aim",
      fired1 === true && muzzles1.length === 1, `fired=${fired1} muzzles=${muzzles1.length}`);
    ok("POSSESSION T3(b): the muzzle carries weapon:\"shell\" (TOWER_SPECS.gun)",
      !!muzzles1[0] && muzzles1[0].weapon === "shell", muzzles1[0] && muzzles1[0].weapon);
    tower.fireCd -= 0.1;
    world.events.length = 0;
    const fired2 = possessedTowerFire(world, tower, { x: 10, z: 0 }, null);
    ok("POSSESSION T3(b): a second pull 0.1s later (fireRate 1.05s) is refused — the cooldown holds",
      fired2 === false && muzzlesOf(world).length === 0, `fired2=${fired2}`);
  }

  // (c) the sight law holds at the aim cell: a dark cell refuses outright;
  // the identical aim in a seen cell fires normally (the control).
  {
    const world = makeWorld({ field: flatField, seed: 32 });
    const tower = makeTower(world, "gun");
    const T = makeTerritory(29, 57);
    T.sight = makeSight(T);
    for (let iz = 0; iz < T.sight.nz; iz++) for (let ix = 0; ix < T.sight.nx; ix++) {
      const u = -T.sight.halfU + (ix + 0.5) * T.sight.cs;
      if (u < 8) T.sight.seen1[iz * T.sight.nx + ix] = 1;
    }
    world.events.length = 0;
    const firedDark = possessedTowerFire(world, tower, { x: 20, z: 0 }, T, idUV);
    ok("POSSESSION T3(c): a dark aim cell (unseen) refuses — zero muzzles",
      firedDark === false && muzzlesOf(world).length === 0, `fired=${firedDark}`);
    world.events.length = 0;
    const firedLit = possessedTowerFire(world, tower, { x: 0, z: 0 }, T, idUV);
    ok("POSSESSION T3(c) control: the identical tower, aim in a SEEN cell, fires normally",
      firedLit === true && muzzlesOf(world).length === 1, `fired=${firedLit}`);
  }

  // (d) source pin: frost offers no possession — the tower pie's possess
  // wedge is gated on canPossess, itself gated on spec.fireRate > 0 (frost's
  // is 0 — no gun to man).
  {
    const gameSrc = fs.readFileSync(new URL("../src/depot/DepotGame.jsx", import.meta.url), "utf8");
    ok("POSSESSION T3(d) source pin: the tower radial's canPossess field gates on spec.fireRate > 0",
      /canPossess: ispec\.fireRate > 0/.test(gameSrc));
    ok("POSSESSION T3(d) source pin: the possess wedge only pushes when canPossess",
      /if \(tr\.canPossess\) \{[\s\S]{0,200}key: "possess"/.test(gameSrc));
  }

  // (e) release restores auto-fire: stepTowers' own guard + scan/acquire
  // loop, mirrored (JSX, not importable headlessly — the same convention
  // VISION T2(a)'s tower fixture uses), the guard LINE FOR LINE the one
  // pinned in (a). While possessed the guard skips acquisition outright;
  // released, the very next scan acquires the enemy in range exactly as an
  // unpossessed tower would.
  {
    const spec = TOWER_SPECS.gun;
    const world = makeWorld({ field: flatField, seed: 33 });
    const tower = makeTower(world, "gun");
    const foe = addBody(world, { kind: "unit", team: 2, mass: 80, hx: 0.3, hy: 0.9, hz: 0.3, x: 10, y: 0.9, z: 0, hp: 40 });
    const T = makeTerritory(29, 57);
    T.sight = makeSight(T);
    stepSight(world, T.sight, idUV, idW);
    const scan = (possessedId) => {
      // mirrors stepTowers' guard (DepotGame.jsx, pinned above) + scan loop
      // (:365-410) — possessedId set skips acquisition entirely, same as
      // the real function.
      if (possessedId === tower.id) return tower.targetId || null;
      const muzzle = { x: tower.pos.x, y: tower.pos.y + tower.hy + 0.45, z: tower.pos.z };
      const eR = effRange(world, muzzle, spec);
      let best = null, bd = eR * eR;
      for (const e of world.bodies) {
        if ((e.kind !== "unit" && e.kind !== "vehicle") || !e.alive || e.team !== 2) continue;
        const c = idUV(e.pos.x, e.pos.z);
        if (!fieldReaches(T, c.u, c.v, 1)) continue;
        const dx = e.pos.x - tower.pos.x, dz = e.pos.z - tower.pos.z, d2 = dx * dx + dz * dz;
        if (d2 < bd && arcClears(world, muzzle, e.pos, spec, tower.id)) { bd = d2; best = e; }
      }
      tower.targetId = best ? best.id : tower.targetId;
      return best ? best.id : null;
    };
    ok("POSSESSION T3(e): possessed, the tower does not acquire even with the enemy in range",
      scan(tower.id) == null, `target=${scan(tower.id)}`);
    ok("POSSESSION T3(e): released, the very next scan acquires the enemy",
      scan(undefined) === foe.id, `target=${scan(undefined)}`);
  }
}
// ==== end POSSESSION T3 =======================================================




if (fails.length) {
  console.error(`\n${fails.length} FAILURE(S): ${fails.join(", ")}`);
  process.exit(1);
}
console.log("\ndepot-test PASS");
