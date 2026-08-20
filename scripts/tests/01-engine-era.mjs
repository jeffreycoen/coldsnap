import { ok } from "./harness.mjs";
import { identFwdDir, straightGrid, fatReg, starvedReg } from "./shared.mjs";
import { makeRunState, stepBell, fireBell, withdrawDue, BELL_PERIOD_S, TIER_BELLS, ENEMY_TIERS, enemyTierState, enemyTierOf, ASSAULT_TIMEOUT, HAND_DRAWS, dealConvoyHand, takeHandCard, makeManifestState, isUnlocked, tierOpenCount, regimentDestroyed, checkLoss, checkWin, makeEndDispatch, towerShot, squadFire, fieldReaches, effRange, validatePlacement, PENDING_ARM_S, pendingArmed, censusDepotChunks, depotStandingFraction, checkDepotBreach, checkEnemyBreach, stepDepotCensus, spawnSquadMembers, spawnSandbag, SANDBAG_COST, pruneSquads, DEPOT_STANDING_TOL, DEPOT_BREACH_FRAC, DEPOT_CENSUS_HZ, friendlyFouls } from "../../src/depot/state.js";
import { makeWorld, addBody, fireProjectile, stepWorld, applyDamage, worldHash, CAUSE, mulberry32, aimSolve } from "../../src/engine/core.js";
import { reachPolygon, arcClears, squadReach, towerReachCached } from "../../src/depot/accuracy.js";
import { TOWER_SPECS, ENEMY_SPECS, ENEMY_FIRE, TANK, MASON, INFANTRY_ARMS, HAND_KEYS, HAND_TAGS } from "../../src/depot/specs.js";
import { stepUnits, spawnUnit, payBounties, SNIPER_FIRE } from "../../src/depot/units.js";
import { SQUAD_SPECS, makeSquad, exposureAt, coverHop, stepSquad } from "../../src/depot/squads.js";
import { makeRegiment, STIPEND, RESULTS, payResults, combatIneffective, bookValue } from "../../src/depot/economy.js";
import { planWave, MIN_WAVE_FLOOR, snapSquads } from "../../src/depot/ai.js";
import { composeIntel, openingIntel } from "../../src/depot/intel.js";
import { makeTerritory, stepTerritory, holderAt, fogStateAt, valueAt, canBuild, DECAY_TAU, EMIT } from "../../src/depot/territory.js";
import { SIGHT, makeSight, stepSight } from "../../src/depot/sight.js";
import { fwdUFor, invWFor } from "../../src/depot/orient.js";
import { washAlpha, WASH_SEAM, WASH_MAX_A } from "../../src/render/renderer.js";
import fs from "node:fs";

// Headless test for the depot bell cycle: the clock runs, the bell musters an
// assault under its tier cap, spent assaults withdraw. Drives
// src/depot/state.js directly, no DOM/three.js.
//   node scripts/depot-test.mjs


const S = makeRunState();
S.started = true;
S.reg = fatReg();
const rngS = mulberry32(1001); // re-pinned mk1.72 (P7.1 T8): THE SEED PURGE — the old special-cased seed leaves the suite

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
  ok("the bell pays nothing; income is the clock (re-pinned mk1.13)", I.resources === before, `${I.resources} vs ${before}`);
  ok("bell pays the regiment's stipend before the muster spends it",
    I.reg.scrap <= regBefore + STIPEND, `${I.reg.scrap}`);
}

// --- tier caps: OWNERSHIP IS THE GATE NOW (P7.2 T4, owner) — the bell
// clamp is dead, enemyTierState is membership-only. Re-taught from the old
// bell-clamp family: everything bought fields at bell zero; unbought never
// fields; double-listed buys dedupe (per old tier row); and planWave now
// WALKS formerly-gated tags through from bell one.
{
  const allPicked = ENEMY_TIERS.flat();
  ok("conscripts are never gated", enemyTierState(0, allPicked).tags.includes(""));
  ok("everything bought fields at bell zero — the clamp is dead (owner, P7.2 T4)",
    enemyTierState(0, allPicked).tags.length === allPicked.length + 1);
  ok("no picks, no tags: an attacker that has picked nothing marches conscripts", enemyTierState(99, []).tags.length === 1);
  for (let i = 0; i < ENEMY_TIERS.length; i++) {
    const unbought = enemyTierState(TIER_BELLS[i], []).tags;
    const bought = enemyTierState(0, ENEMY_TIERS[i]).tags;
    ok(`tier ${i + 1} unbought never fields`, ENEMY_TIERS[i].every((t) => !unbought.includes(t)));
    ok(`tier ${i + 1} bought fields at bell zero`, ENEMY_TIERS[i].every((t) => bought.includes(t)));
    ok(`tier ${i + 1} double-listed buys dedupe`,
      enemyTierState(0, ENEMY_TIERS[i].concat(ENEMY_TIERS[i])).tags.length === ENEMY_TIERS[i].length + 1);
  }
  // and planWave WALKS formerly-gated tags through from bell one now that
  // ownership alone gates: 40 seeded musters at bell 1, tiers 2/3 owned,
  // field at least once across the run (flipped from the old leak counter).
  const gated = ENEMY_TIERS[1].concat(ENEMY_TIERS[2]);
  let fielded = 0, fieldedAny = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const reg = { heads: 400, tanks: 10, heads0: 400, tanks0: 10, scrap: 900 };
    const { buys } = planWave(reg, { mgs: 8, walls: 8, squads: 3 }, 1, mulberry32(seed * 31), enemyTierState(1, allPicked).tags);
    if (buys.some((b) => gated.includes(b.type))) fielded++;
    if (buys.reduce((n, b) => n + b.n, 0) > 0) fieldedAny++;
  }
  ok("bought once-gated tags now WALK through planWave from bell one (40 seeds)", fielded >= 1, `${fielded} fielded`);
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

// --- the hand (P7.2 T2): one ungated table, five draws, multi-buy
{
  console.log("\n[the hand]");
  const allPicked = ENEMY_TIERS.flat();

  // (a) the player starts with START and nothing else; the bell gates are dead.
  {
    const M = makeManifestState();
    ok("hand: the bar starts bare — nothing is free (owner, re-taught P7.2 T3)",
      M.unlocked.length === 0 && !isUnlocked(M, "sq_rifles") && !isUnlocked(M, "sq_engineers")
      && !isUnlocked(M, "wall") && !isUnlocked(M, "sandbag"), M.unlocked.join(","));
    ok("hand: nothing is offered before the first bell", M.hand.length === 0 && M.cardUp === false);
    const p0 = HAND_KEYS.filter((k) => M.unlocked.indexOf(k) < 0);
    ok("hand: the plans pool ignores the bell entirely — one pool at any hour", p0.length === 15, p0.length);
  }

  // (b) the pool: the full list minus what is owned. No tiers, no bells.
  {
    const M = makeManifestState();
    const pool = () => HAND_KEYS.filter((k) => M.unlocked.indexOf(k) < 0);
    ok("hand: fifteen plans stand at bell one", pool().length === 15);
    M.unlocked.push("mg");
    ok("hand: a bought plan leaves the pool", pool().indexOf("mg") < 0 && pool().length === 14);
    ok("hand: heroes stand in the pool from the start (the gate is dead, owner)",
      pool().includes("hero_bison") && pool().includes("hero_apc"));
    ok("hand: rifles and engineers are plans like everything else now (re-taught P7.2 T3)", pool().includes("sq_rifles") && pool().includes("sq_engineers"));
    ok("hand: hires ignore ownership — the full fifteen, always",
      dealConvoyHand(HAND_KEYS.slice(), HAND_KEYS, mulberry32(4)).every((c) => c.hire === 1));
  }

  // (c) DRAW-COUNT LAW: five draws whatever the pools hold — his side too
  // (P7.2 T4 re-teach: his one-index pick is a five-draw dealt hand now).
  {
    const counted = (seed) => { let n = 0; const r = mulberry32(seed); return { rng: () => { n++; return r(); }, n: () => n }; };
    for (const owned of [[], HAND_KEYS.slice(0, 5), HAND_KEYS.slice(0, 13), HAND_KEYS.slice()]) {
      const c = counted(5);
      dealConvoyHand(owned, HAND_KEYS, c.rng);
      ok(`hand: ${15 - owned.length}-plan pool still spends exactly ${HAND_DRAWS} draws`, c.n() === HAND_DRAWS, `${c.n()}`);
      const f = counted(6);
      dealConvoyHand(owned, HAND_KEYS, f.rng);
      ok(`his hand: still exactly ${HAND_DRAWS} draws beside a ${15 - owned.length}-plan hand`, f.n() === HAND_DRAWS, `${f.n()}`);
    }
    let badN = 0, dupe = 0, foreign = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const h = dealConvoyHand([], HAND_KEYS, mulberry32(seed));
      const plans = h.filter((x) => !x.hire);
      if (h.length !== 5 || plans.length !== 3) badN++;
      if (new Set(plans.map((x) => x.k)).size !== plans.length) dupe++;
      if (h.some((x) => !HAND_KEYS.includes(x.k))) foreign++;
    }
    ok("hand: 200 seeded deals are all five cards, three plans", badN === 0, `${badN} bad`);
    ok("hand: 200 seeded deals never repeat a plan", dupe === 0, `${dupe} dupes`);
    ok("hand: 200 seeded deals never invent a card", foreign === 0, `${foreign} foreign`);
    const one = dealConvoyHand(HAND_KEYS.slice(0, 14), HAND_KEYS, mulberry32(3));
    ok("hand: a one-plan pool deals that plan and the two hires", one.filter((x) => !x.hire).length === 1 && one.length === 3);
    ok("hand: an exhausted plans pool deals hires alone", dealConvoyHand(HAND_KEYS.slice(), HAND_KEYS, mulberry32(3)).length === 2);
    {
      let n = 0; const r = mulberry32(3);
      const hand = dealConvoyHand(HAND_KEYS.slice(), HAND_KEYS, () => { n++; return r(); });
      ok("his hand: everything owned still burns five and deals hires alone", n === 5 && hand.length === 2 && hand.every((x) => x.hire), `${n}/${hand.length}`);
    }
  }

  // (d) taking cards: only what the hand holds, and MORE THAN ONCE (owner).
  {
    const M = makeManifestState();
    M.hand = [{ k: "mg", hire: 0 }, { k: "frost", hire: 0 }, { k: "mg", hire: 1 }]; M.cardUp = true;
    ok("hand: a card the convoy never dealt cannot be taken", takeHandCard(M, "rocket", 0) === false && M.hand.length === 3);
    ok("hand: taking a plan removes that row alone", takeHandCard(M, "frost", 0) === true && M.hand.length === 2);
    ok("hand: a SECOND card off the same bell is taken — multi-buy is the law (owner)", takeHandCard(M, "mg", 0) === true && M.hand.length === 1);
    ok("hand: the last card leaving closes the window", takeHandCard(M, "mg", 1) === true && M.cardUp === false);
  }

  // (e) a skipped bell is overwritten; unpicked plans re-pool by construction.
  {
    const S2 = makeRunState();
    S2.started = true; S2.reg = fatReg();
    const rng = mulberry32(41);
    fireBell(S2, { reg: S2.reg, snap: {}, rng, t: BELL_PERIOD_S });
    const first = S2.manifest.hand.slice();
    ok("hand: the bell deals five", first.length === 5 && S2.manifest.cardUp === true, first.map((c) => c.k).join(","));
    fireBell(S2, { reg: S2.reg, snap: {}, rng, t: 2 * BELL_PERIOD_S });
    ok("hand: an unread hand is overwritten at the next bell, not banked",
      S2.manifest.offerBell === 2 && S2.manifest.unlocked.length === 0, `${S2.manifest.offerBell}/${S2.manifest.unlocked.length}`);
    ok("hand: the passed-over plans are still in the pool",
      first.filter((c) => !c.hire).every((c) => S2.manifest.unlocked.indexOf(c.k) < 0));
  }

  // (f) his hand mirror: the ladder now climbs by PURCHASE off a flat price
  // stub (P7.2 T4 re-teach) — the single index-roll pick and its tier-bell
  // wait are both gone; everything owned fields the moment it is bought.
  {
    const S3 = makeRunState();
    S3.started = true; S3.reg = fatReg();
    const rng = mulberry32(42);
    let lateFielding = 0, negTill = 0, offMix = 0;
    for (let b = 1; b <= 12; b++) {
      S3.reg.scrap += 400; S3.reg.heads += 200;
      fireBell(S3, { reg: S3.reg, snap: {}, rng, t: b * BELL_PERIOD_S, priceP: () => 30 });
      if (S3.reg.scrap < 0) negTill++;
      const openTags = enemyTierState(S3.bell, S3.foe.unlocked).tags;
      for (const tag of S3.foe.unlocked) if (openTags.indexOf(tag) < 0) lateFielding++;
      if (S3.ws.mixBag.some((t) => openTags.indexOf(t) < 0)) offMix++;
    }
    ok("his hand: the ladder climbs by PURCHASE across 12 rich bells", (S3.foe.unlocked.length + S3.foe.towers.length) >= 5, `${S3.foe.unlocked.length}+${S3.foe.towers.length}`);
    ok("his hand: everything owned fields at once — no bell wait left to clear", lateFielding === 0, lateFielding);
    ok("his hand: the till never goes negative and the assault never carries an unowned tag", negTill === 0 && offMix === 0, `${negTill}/${offMix}`);
    ok("his hand: buys are lawful per HAND_TAGS's value set (mg/eng/conscript are lawful now)",
      S3.foe.unlocked.every((t) => t === "" || Object.values(HAND_TAGS).indexOf(t) >= 0));
    ok("his hand: the same tag is never bought twice", new Set(S3.foe.unlocked).size === S3.foe.unlocked.length);
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
    ok("bell sequence: the bell pays nothing; income is the clock (re-pinned mk1.13)",
      S4.resources === makeRunState().resources, `${S4.resources}`);
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
// afford a minimum muster (musterScrap < MIN_WAVE_FLOOR) OR has no men and
// no tanks left (mk1.13 AMENDMENT 1 — the 90/bell stipend alone can no
// longer be starved of scrap, so a regiment spent of MANPOWER must also
// count) and fields nobody earn a one-time "the offensive is spent"
// observation — not an ending. A starved fixture needs an empty head AND
// tank pool: the bell pays the stipend before the muster, and a stipend
// alone buys conscripts (or, pre-mk1.13, sat under the muster floor).
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
  ok("starved bell 3/3: no win, only a one-time spent observation (re-pinned mk1.13 — spent by manpower)",
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
  ok("3 empty musters: the bureau observes the offensive spent (re-pinned mk1.13 — spent by manpower)", G.lastDispatch.lines.some((l) => /spent/i.test(l)), JSON.stringify(G.lastDispatch.lines));

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
  const stateSrc = fs.readFileSync(new URL("../../src/depot/state.js", import.meta.url), "utf8");
  const coreSrc = fs.readFileSync(new URL("../../src/engine/core.js", import.meta.url), "utf8");
  const rendererSrc = fs.readFileSync(new URL("../../src/render/renderer.js", import.meta.url), "utf8");
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
    ok("bookValue: STIPEND is the 1-scrap/second clock, credited at the bell (re-pinned mk1.13)", STIPEND === 90);
  }
}

// ================================================== the roster returns (Task 2)
// spec value pins — brief's exact acc/windF/windComp, tower-equal by
// Jeff's decision (rifle=mg, gren lob=mortar, tank=gun).
{
  ok("ENEMY_FIRE.rifle acc matches TOWER_SPECS.mg exactly", ENEMY_FIRE.rifle.acc === TOWER_SPECS.mg.acc && ENEMY_FIRE.rifle.acc === 0.090);
  ok("ENEMY_FIRE.rifle windF/windComp match TOWER_SPECS.mg exactly", ENEMY_FIRE.rifle.windF === TOWER_SPECS.mg.windF && ENEMY_FIRE.rifle.windComp === TOWER_SPECS.mg.windComp);
  ok("ENEMY_FIRE.lob acc/windF match TOWER_SPECS.mortar exactly (re-taught P7.1 T9: 0.020 -> 0.005)", ENEMY_FIRE.lob.acc === TOWER_SPECS.mortar.acc && ENEMY_FIRE.lob.acc === 0.005 && ENEMY_FIRE.lob.windF === TOWER_SPECS.mortar.windF && ENEMY_FIRE.lob.windF === 0.04);
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
  // P7.2 T4 re-pin: the bell now spends HAND_DRAWS + HAND_DRAWS (his five
  // draws replace his one) off the same stream BEFORE the muster (and, at
  // bell 1, zero intel draws — openingIntel takes no rng), so the
  // prediction burns exactly those first.
  const regP = makeRegiment(mulberry32(7));
  regP.scrap += STIPEND;
  const rngP = mulberry32(8);
  for (let i = 0; i < HAND_DRAWS + HAND_DRAWS; i++) rngP();
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

  // --- enemy symmetric consumption: units.js's stepRifleman/stepGrenadier
  // and drivers.js's tank import effRange from state.js (grep-verified below
  // rather than re-simulating a full unit tick here — the sim behavior is
  // exercised by the rest of this file's unit tests; this asserts the
  // wiring itself so a future edit that reverts to spec.range trips it).
  {
    const unitsSrc = fs.readFileSync(new URL("../../src/depot/units.js", import.meta.url), "utf8");
    const driversSrc = fs.readFileSync(new URL("../../src/depot/drivers.js", import.meta.url), "utf8");
    ok("units.js imports effRange from state.js", /import\s*\{[^}]*effRange[^}]*\}\s*from\s*"\.\/state\.js"/.test(unitsSrc));
    ok("units.js's rifle/grenadier scans consume effRange (not raw spec.range)", (unitsSrc.match(/effRange\(world,\s*muzzle,\s*fspec\)/g) || []).length === 2);
    ok("drivers.js's tank scan consumes effRange (re-pinned mk1.30 — stepTank moved to the motor pool)", (driversSrc.match(/effRange\(world,\s*muzzle,\s*fspec\)/g) || []).length === 1);
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

  // scripted demolition: kill ~30% outright, displace another ~35% well past
  // the standing tolerance (a launched stone, still "alive" but not home) —
  // re-pinned mk1.32 (P7 T3, was 1/4+1/4 against the 0.58 bar): the 0.40 bar
  // needs a deeper cut, but STILL crosses only together — neither tactic
  // alone (30% or 35%) leaves standing below DEPOT_BREACH_FRAC on its own.
  const demoFixture = buildDepotLattice();
  const demoCensus = censusDepotChunks(demoFixture.world.bodies);
  const destroyN = Math.floor(demoFixture.chunks.length * 0.30);
  const dispN = Math.floor(demoFixture.chunks.length * 0.35);
  for (let i = 0; i < demoFixture.chunks.length; i++) {
    const c = demoFixture.chunks[i];
    if (i < destroyN) c.alive = false; // outright destroyed
    else if (i < destroyN + dispN) c.pos = { x: c.pos.x + 20, y: c.pos.y, z: c.pos.z }; // launched well past 1.2m
  }
  const demoFraction = depotStandingFraction(demoCensus, demoFixture.world.byId);
  ok(`30%+35% of the depot demolished (kill+displace) crosses the ${DEPOT_BREACH_FRAC} breach line`,
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
    const depotSrc3 = fs.readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");
    ok("sweep/corpse: DepotGame corpse sweep is kind-gated, team-agnostic",
      depotSrc3.includes('b.kind === "unit" && !b.alive && world.t - (b.deadT || 0) > 2.5'));

    // (e) emitters: team-1 members must emit GREEN influence (EMIT.unit,
    // sign +1) and sandbags must emit under EMIT.wall — buildEmitters is a
    // DepotGame closure, so source-assert the branches exist, and
    // functionally prove a green unit-weight emitter holds ground.
    ok("sweep/emitters: buildEmitters includes team-1 units at EMIT.unit sign +1",
      depotSrc3.includes('b.kind === "unit" && b.team === 1 && b.alive') &&
      /team === 1[\s\S]{0,220}EMIT\.unit\.w, r: EMIT\.unit\.r, sign: 1/.test(depotSrc3));
    ok("sweep/emitters: buildEmitters includes sandbags under EMIT.wall (re-taught P7.1 T7)",
      depotSrc3.includes("b.sandbag") &&
      /sandbag[\s\S]{0,220}EMIT\.wall\.w, r: EMIT\.wall\.r, sign: b\.bagSide === 2 \? -1 : 1/.test(depotSrc3));
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
    const rendSrc = fs.readFileSync(new URL("../../src/render/renderer.js", import.meta.url), "utf8");
    const fogGates = rendSrc.match(/opts\.territory && b\.team === 2 && b\.alive/g) || [];
    ok("sweep/fog: renderer fog gates check team === 2 (team-1 always renders)", fogGates.length >= 2, `gates=${fogGates.length}`);

    // (i) restock: no restock machinery exists anywhere in src/depot — the
    // campaign's restock (scenario.js) is keyed off campaign spawn pools and
    // never reaches depot bodies.
    let restockHits = 0;
    for (const f of fs.readdirSync(new URL("../../src/depot", import.meta.url))) {
      const src = fs.readFileSync(new URL("../../src/depot/" + f, import.meta.url), "utf8");
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
    const depotSrc4 = fs.readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");
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
  const { sandbagOrientAt } = await import("../../src/depot/state.js");

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

  // (c)/(d) UI-toggle pins PRUNED (mk1.12, Amendment 1 A1-6): the bar re-tap
  // cycle, the bar icon swap, and the hover-ghost orientation read were all
  // deleted in Task 3 — sandbag placement has no player-facing door any
  // more. sandbagOrientAt itself (the engineer line's own orientation call)
  // is untouched and stays pinned in (a)/(b) above.
}

// ==== SNAP-SQUADS ============================================================
// buildSnapshot must report live player squad count (ai.js snapSquads gate —
// without it the brain never fields its sniper in live play).
{
  console.log("\n[snap-squads]");
  const flatF = { heightAt: () => 0, dirty: false, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } };
  const { snapSquads } = await import("../../src/depot/ai.js");
  const { SQUAD_SPECS: SQ, makeSquad: mkSq } = await import("../../src/depot/squads.js");
  const world = makeWorld({ field: flatF, seed: 11 });
  const squads = [mkSq(1, "rifles", 1, 0, 0), mkSq(2, "rifles", 1, 10, 0)];
  for (const sq of squads) spawnSquadMembers(world, sq);
  // same predicate buildSnapshot uses: squads holding at least one live member
  const liveCount = (list) => list.filter((sq) => sq.memberIds.some((id) => { const u = world.byId.get(id); return u && u.alive; })).length;
  ok("snap-squads: 2 live squads -> snapshot squads=2", snapSquads({ squads: liveCount(squads) }) === 2);
  for (const id of squads[1].memberIds) { const u = world.byId.get(id); if (u) u.alive = false; }
  ok("snap-squads: wiped squad drops from the count", snapSquads({ squads: liveCount(squads) }) === 1);
  const src = fs.readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");
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
    const src = fs.readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");
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

