// COLDSNAP suite — era 11: THE HIRING HALL (P7.2). T1 (mk1.80): easier
// selection — the tap radii, the cycle rule, select-all-of-type, the wiring.
import { ok } from "./harness.mjs";
import { makeWorld, mulberry32 } from "../../src/engine/core.js";
import { makeSquad } from "../../src/depot/squads.js";
import { spawnSquadMembers, TAP_SQUAD_M, TAP_HULL_M, TAP_TOWER_M, nextPick, squadIdsOfType, dealConvoyHand, takeHandCard, HAND_DRAWS, FOE_DRAWS, makeManifestState, makeRunState, fireBell, BELL_PERIOD_S, pendingArmed } from "../../src/depot/state.js";
import { HAND_KEYS, PLAYER_START } from "../../src/depot/specs.js";
import { PICK_POOL } from "../../src/depot/muster.js";
import { fatReg } from "./shared.mjs";
import fs from "node:fs";

const flatF = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (x, z, o) => { o.x = 0; o.y = 1; o.z = 0; return o; } };

// ---- P7.2 T1 (a): the radii live in one home and grew // provisional (F5)
ok("T1(a): the tap radii — squad 2.4, hull 4.0, tower 2.4", TAP_SQUAD_M === 2.4 && TAP_HULL_M === 4.0 && TAP_TOWER_M === 2.4);

// ---- P7.2 T1 (b): the cycle rule — nearest first, next on re-tap, wraps
{
  const cands = [{ key: "sq:2", d: 1.2 }, { key: "sq:1", d: 0.4 }, { key: "veh:9", d: 2.0 }];
  ok("T1(b): no current pick — the nearest wins", nextPick(cands, null).key === "sq:1");
  ok("T1(b): a re-tap hands the pick around", nextPick(cands, "sq:1").key === "sq:2" && nextPick(cands, "sq:2").key === "veh:9");
  ok("T1(b): the cycle wraps", nextPick(cands, "veh:9").key === "sq:1");
  ok("T1(b): empty ground picks nothing", nextPick([], null) === null);
}

// ---- P7.2 T1 (c): select-all-of-type — same type, live members, never sealed
{
  const w = makeWorld({ field: flatF, seed: 80 });
  const a = makeSquad(1, "rifles", 1, 0, 0); spawnSquadMembers(w, a);
  const b = makeSquad(2, "rifles", 1, 10, 0); spawnSquadMembers(w, b);
  const c = makeSquad(3, "mg", 1, 20, 0); spawnSquadMembers(w, c);
  const d = makeSquad(4, "rifles", 1, 30, 0); spawnSquadMembers(w, d); d.ridingIn = 1;
  ok("T1(c): all rifles, never the mg team, never the sealed squad",
    JSON.stringify(squadIdsOfType(w, [a, b, c, d], "rifles")) === "[1,2]");
}

// ---- P7.2 T1 (d): the wiring (the audit(j) idiom — tap-to-handler)
{
  const src = fs.readFileSync("src/depot/DepotGame.jsx", "utf8");
  ok("T1(d): squad picking reads the shared radius", /< TAP_SQUAD_M\) return sq;/.test(src));
  ok("T1(d): hull picking rides the cycle scan on its own radius", /d2 <= TAP_HULL_M\) cands\.push/.test(src) && !/vehicleAtPoint/.test(src));
  ok("T1(d): the tap builds candidates and cycles them", /nextPick\(cands, curSel\)/.test(src));
  ok("T1(d): towers join the pick only in plain command", /b\.kind === "tower" && !S\.mode && !S\.sellMode/.test(src));
  ok("T1(d): the pie carries SELECT ALL wired to its handler", /key: "select_all", .*selectAllType\(\)/.test(src));
  ok("T1(d): group orders fan out through one door", /for \(const gsq of selectedGroup\(\)\)/.test(src));
  ok("T1(d): accepting a line clears the group", /S\.selSquadId = null; S\.orderMode = null; S\.buildPt0 = null; S\.selSquadIds = null;/.test(src));
}

// ---- P7.2 T2 (mk1.81): THE HAND — five cards, three plans + two hires
{
  // (a) one table: the hand's fifteen are the pick pool's fifteen
  ok("T2(a): HAND_KEYS is the fifteen, exactly the pick pool's keys",
    HAND_KEYS.length === 15 && new Set(HAND_KEYS).size === 15 && PICK_POOL.every((p) => HAND_KEYS.includes(p.key)));

  // (b) the deal's contract — five draws, always, draw-then-clamp
  const count = () => { let n = 0; const r = mulberry32(7); return { rng: () => { n++; return r(); }, n: () => n }; };
  {
    const c = count();
    const hand = dealConvoyHand(["mg", "gun"], HAND_KEYS, c.rng);
    ok("T2(b): a full pool spends exactly HAND_DRAWS (5)", c.n() === HAND_DRAWS && HAND_DRAWS === 5, c.n());
    const plans = hand.filter((x) => !x.hire), hires = hand.filter((x) => x.hire);
    ok("T2(b2): three plans and two hires, the fixed split", plans.length === 3 && hires.length === 2);
    ok("T2(b3): plans are distinct and never an owned key",
      new Set(plans.map((x) => x.k)).size === 3 && plans.every((x) => x.k !== "mg" && x.k !== "gun"));
    ok("T2(b4): hires draw from the FULL list — owning the plan never blocks the hire",
      hires.every((x) => HAND_KEYS.includes(x.k)));
  }
  {
    const c = count();
    const owned = HAND_KEYS.slice(0, 13); // two plans left in the pool
    const hand = dealConvoyHand(owned, HAND_KEYS, c.rng);
    ok("T2(b5): a thin pool still burns five draws and deals what it has",
      c.n() === 5 && hand.filter((x) => !x.hire).length === 2 && hand.filter((x) => x.hire).length === 2);
    const c2 = count();
    const hand2 = dealConvoyHand(HAND_KEYS.slice(), HAND_KEYS, c2.rng);
    ok("T2(b6): an exhausted plans pool still burns five and deals hires only",
      c2.n() === 5 && hand2.length === 2 && hand2.every((x) => x.hire));
  }
  {
    let heroHands = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const hand = dealConvoyHand(["mg", "gun"], HAND_KEYS, mulberry32(seed));
      if (hand.some((x) => x.k === "hero_bison" || x.k === "hero_apc")) heroHands++;
    }
    ok("T2(b7): heroes appear from bell one — the tier gates are dead (owner)", heroHands > 0, heroHands);
  }

  // (c) taking cards — multi-buy is the law
  {
    const M = makeManifestState();
    M.hand = [{ k: "gun", hire: 0 }, { k: "gun", hire: 1 }, { k: "sq_mg", hire: 0 }];
    M.cardUp = true;
    ok("T2(c): a key not in the hand is refused", takeHandCard(M, "rocket", 0) === false && M.hand.length === 3);
    ok("T2(c2): taking removes exactly the one row — the hire flag tells twins apart",
      takeHandCard(M, "gun", 0) === true && M.hand.length === 2 && M.hand.some((x) => x.k === "gun" && x.hire === 1));
    ok("T2(c3): a SECOND card can be taken — multi-buy (owner, supersedes one-pick-per-bell)",
      takeHandCard(M, "sq_mg", 0) === true && M.hand.length === 1);
    takeHandCard(M, "gun", 1);
    ok("T2(c4): the last card leaving closes the window", M.hand.length === 0 && M.cardUp === false);
  }

  // (d) the bell deals the hand
  {
    const S = makeRunState();
    S.started = true; S.reg = fatReg();
    let draws = 0; const raw = mulberry32(81); const rng = () => { draws++; return raw(); };
    fireBell(S, { reg: S.reg, snap: {}, rng, t: BELL_PERIOD_S });
    ok("T2(d): the ring deals five and stamps the bell", S.manifest.hand.length === 5 && S.manifest.offerBell === 1 && S.manifest.cardUp === true);
    ok("T2(d2): bell one spends exactly ten draws (hand 5 + his pick 1 + the muster 4; opening intel draws none)", draws === 10, draws);
    const kept = S.manifest.hand.filter((x) => !x.hire).map((x) => x.k);
    fireBell(S, { reg: S.reg, snap: {}, rng, t: 2 * BELL_PERIOD_S });
    ok("T2(d3): a skipped bell is overwritten, and unpicked plans stay in the pool",
      S.manifest.offerBell === 2 && S.manifest.unlocked.length === 0 &&
      kept.every((k) => HAND_KEYS.indexOf(k) >= 0 && S.manifest.unlocked.indexOf(k) < 0));
  }

  // (e) the wiring (tap-to-handler, the audit idiom)
  {
    const src = fs.readFileSync("src/depot/DepotGame.jsx", "utf8");
    ok("T2(e): the plan buy pays half the live price", /Math\.max\(1, Math\.ceil\(priceNow\(key, it \? it\.cost : 10\) \/ 2\)\)/.test(src));
    const pmBody = (src.match(/S\.pickManifest = \(key\) => \{[\s\S]*?\n      \};/) || [""])[0];
    ok("T2(e2): the convoy window is exempt from the pacing law", pmBody.length > 0 && !/buyPaced\(/.test(pmBody) && !/_buyAt/.test(pmBody));
    ok("T2(e3): the hire arms a placement tap", /S\.armHire = \(key\) => \{/.test(src) && /S\.hirePlace = \{ key \};/.test(src));
    ok("T2(e4): the hire's tap owns the ground before the order flow",
      src.indexOf("if (S.hirePlace) {") > 0 && src.indexOf("if (S.hirePlace) {") < src.indexOf("if (consumeOrderTap(p)) return;"));
    ok("T2(e5): placement charges on success only — the card leaves when the unit fields",
      /takeHandCard\(S\.manifest, key, 1\);\n\s+S\.resources -= price;/.test(src) && /S\.cancelHire = /.test(src) && /data-hire-cancel/.test(src));
    ok("T2(e6): the hand's rows carry their kind and price", /data-hand-kind=\{c\.hire \? "hire" : "plan"\}/.test(src));
    const ic = fs.readFileSync("src/depot/InfoCard.jsx", "utf8");
    ok("T2(e7): the card carries the hire door", /door === "hire"/.test(ic) && /CONFIRM HIRE/.test(ic));
  }

  // (f) the manual tells the hand's truth
  {
    const fm = fs.readFileSync("src/ui/FieldManual.jsx", "utf8");
    ok("T2(f): the tour returns for the hand (MANUAL_REV 4)", /export const MANUAL_REV = 4;/.test(fm));
    ok("T2(f2): THE BELL card teaches plans and hires, and the header count is honest",
      /plans you buy once/.test(fm) && /hires that walk on at once/.test(fm) && /Nine linked cards/.test(fm));
  }
}

// ---- P7.2 T3 (mk1.82): THE CALM WINDOW
{
  // (a) the bare bar
  ok("T3(a): PLAYER_START is empty — the bar starts bare (owner)", PLAYER_START.length === 0);
  ok("T3(a2): the fresh manifest owns nothing", makeManifestState().unlocked.length === 0);
  ok("T3(a3): the plans pool is the full fifteen",
    dealConvoyHand([], HAND_KEYS, mulberry32(9)).filter((c) => !c.hire).length === 3 &&
    HAND_KEYS.filter((k) => makeManifestState().unlocked.indexOf(k) < 0).length === 15);
  // (b) the pause — one gate, source-pinned (the loop is unimportable)
  {
    const src = fs.readFileSync("src/depot/DepotGame.jsx", "utf8");
    ok("T3(b): the convoy freezes the whole sim through the one gate",
      /const convoyUp = !!\(S\.manifest && S\.manifest\.cardUp\);/.test(src) &&
      /S\.paused \|\| !S\.started \|\| cardUp \|\| convoyUp \? 0 : dt \* S\.speed/.test(src));
  }
  // (c) the confirm ghost
  {
    const src = fs.readFileSync("src/depot/DepotGame.jsx", "utf8");
    ok("T3(c): a pre-start tap sets the ghost, never fields", /S\.pending = \{ deal: S\._placeQueue\[0\]/.test(src));
    ok("T3(c2): the deal ghost arms on the wall clock (the sim is frozen pre-start)",
      /wallArm: true, armedAtWall: performance\.now\(\) \/ 1000 \+ PENDING_ARM_S/.test(src));
    ok("T3(c3): a hire tap sets the ghost, never fields", /S\.pending = \{ hire: S\.hirePlace\.key/.test(src));
    ok("T3(c4): the ✓ fields through the real placers, and refusal keeps the ghost",
      /const n0 = S\._placeQueue\.length; placePick\(p\.wp\); if \(S\._placeQueue\.length !== n0\) S\.pending = null;/.test(src) &&
      /placeHire\(p\.wp\); if \(!S\.hirePlace\) S\.pending = null;/.test(src));
    ok("T3(c5): the ✗ returns a hire's card to the hand",
      /if \(S\.pending && S\.pending\.hire\) \{ S\.hirePlace = null; if \(S\.openManifest\) S\.openManifest\(\); \}/.test(src));
  }
  // (d) the wall-armed pending law, tested for real
  ok("T3(d): a wall-armed pending arms on real seconds, sim pendings on sim time",
    pendingArmed({ wallArm: true, armedAtWall: 0 }, -1) === true && pendingArmed({ armedAt: 5 }, 4) === false);
  // ---- AMENDMENT 2 (mk1.83): the convoy arms on the wall clock
  {
    const src = fs.readFileSync("src/depot/DepotGame.jsx", "utf8");
    ok("T3-A2: the ring stamps the wall arm", /ringBell\(\); S\.manifest\.armedAtWall = performance\.now\(\) \/ 1000 \+ PENDING_ARM_S;/.test(src));
    ok("T3-A2b: both buy gates read the wall clock", (src.match(/performance\.now\(\) \/ 1000 < \(M\.armedAtWall \?\? 0\)/g) || []).length === 2);
    ok("T3-A2c: the info card arms on the wall for every door", /const armed = performance\.now\(\) \/ 1000 >= S\.infoArmedWall;/.test(src));
    ok("T3-A2d: a resumed hand re-arms instantly (dead-session stamps never block)", /S\.manifest\.armedAtWall = 0;/.test(src));
  }
}
