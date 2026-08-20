// COLDSNAP suite — era 11: THE HIRING HALL (P7.2). T1 (mk1.80): easier
// selection — the tap radii, the cycle rule, select-all-of-type, the wiring.
import { ok } from "./harness.mjs";
import { makeWorld, mulberry32, addBody, stepWorld, applyDamage, explode } from "../../src/engine/core.js";
import { makeSquad, stepSquad, reactShift } from "../../src/depot/squads.js";
import { spawnSquadMembers, TAP_SQUAD_M, TAP_HULL_M, TAP_TOWER_M, nextPick, squadIdsOfType, dealConvoyHand, takeHandCard, HAND_DRAWS, makeManifestState, makeRunState, fireBell, BELL_PERIOD_S, pendingArmed, shooterFire, hitOrigin } from "../../src/depot/state.js";
import { HAND_KEYS, PLAYER_START, HAND_TAGS, INFANTRY_ARMS, BISON } from "../../src/depot/specs.js";
import { PICK_POOL, mirrorFieldKey } from "../../src/depot/muster.js";
import { makeMap, TOWN } from "../../src/depot/mapgen.js";
import { stepUnits, spawnUnit } from "../../src/depot/units.js";
import { stepDrivers, HUNT_HOLD_S } from "../../src/depot/drivers.js";
import { fatReg, identFwdDir, straightGrid } from "./shared.mjs";
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
    ok("T2(d2): bell one spends exactly fourteen draws (hand 5 + his hand 5 + the muster 4; opening intel draws none)", draws === 14, draws);
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

// ---- P7.2 T4 (mk1.84): HIS HAND — the full mirror, towers included
{
  // (a) the tag map: squads and heroes map to wave tags; a tower key maps to
  // nothing because it ROUTES to his plans ledger instead — never an exclusion
  ok("T4(a): HAND_TAGS covers the eight squads and both heroes; tower keys route to the ledger",
    Object.keys(HAND_TAGS).length === 10 && ["mg", "gun", "mortar", "rocket", "frost"].every((k) => HAND_TAGS[k] === undefined));
  // (b) his deal: five draws; owned plans of BOTH spaces never re-deal
  {
    let n = 0; const raw = mulberry32(84); const rng = () => { n++; return raw(); };
    const foe = { unlocked: ["fast"], towers: ["gun"] };
    const owned = HAND_KEYS.filter((k) => (HAND_TAGS[k] === undefined ? foe.towers.indexOf(k) >= 0 : (HAND_TAGS[k] === "" || foe.unlocked.indexOf(HAND_TAGS[k]) >= 0)));
    const hand = dealConvoyHand(owned, HAND_KEYS, rng);
    ok("T4(b): his deal burns five draws like the player's", n === 5, n);
    ok("T4(b2): an owned tag and an owned tower plan never re-deal; unowned towers CAN deal (symmetry)",
      hand.filter((c) => !c.hire).every((c) => c.k !== "gun" && (HAND_TAGS[c.k] === undefined || HAND_TAGS[c.k] !== "fast")));
    ok("T4(b3): the conscript key is born-owned — his rifles plan never deals (his conscripts march from bell zero; a rifles plan is dead money)",
      hand.filter((c) => !c.hire).every((c) => c.k !== "sq_rifles"));
  }
  // (c) the walk: deterministic buys off the one table, the floor kept
  {
    const S = makeRunState();
    S.started = true; S.reg = fatReg(); S.reg.scrap = 5000;
    let draws = 0; const raw = mulberry32(85); const rng = () => { draws++; return raw(); };
    fireBell(S, { reg: S.reg, snap: {}, rng, t: BELL_PERIOD_S, priceP: () => 40 });
    ok("T4(c): a rich bell buys plans AND queues hires", (S.foe.unlocked.length + S.foe.towers.length) >= 1 && (S.foe.hired || []).length >= 1, `${S.foe.unlocked.length}+${S.foe.towers.length}/${(S.foe.hired || []).length}`);
    ok("T4(c2): the books were charged", S.reg.scrap < 5000, S.reg.scrap);
    ok("T4(c3): bell draws stay fourteen with the walk buying — zero draws in the walk", draws === 14, draws);
    const S2 = makeRunState();
    S2.started = true; S2.reg = fatReg(); S2.reg.scrap = 0;
    fireBell(S2, { reg: S2.reg, snap: {}, rng: mulberry32(85), t: BELL_PERIOD_S, priceP: () => 200 });
    ok("T4(c4): prices past the till buy nothing — the muster floor holds (the stipend alone cannot fund a 100-scrap plan)",
      S2.foe.unlocked.length === 0 && S2.foe.towers.length === 0 && (S2.foe.hired || []).length === 0);
    const S3 = makeRunState();
    S3.started = true; S3.reg = fatReg();
    fireBell(S3, { reg: S3.reg, snap: {}, rng: mulberry32(85), t: BELL_PERIOD_S });
    ok("T4(c5): no price table (an old fixture) — his walk is a no-op", S3.foe.unlocked.length === 0 && S3.foe.towers.length === 0);
    // (c6) the tower plan-and-build loop: seed a ledger, ring, and the bell
    // queues ONE full-price build of the first owned type in table order
    const S6 = makeRunState();
    S6.started = true; S6.reg = fatReg(); S6.reg.scrap = 5000;
    S6.foe.towers = ["mortar", "mg"];
    fireBell(S6, { reg: S6.reg, snap: {}, rng: mulberry32(86), t: BELL_PERIOD_S, priceP: () => 40 });
    ok("T4(c6): he BUILDS what he owns — one tower build a bell, first owned in table order",
      (S6.foe.hired || []).filter((k) => k === "mg" || k === "mortar").length >= 1 && (S6.foe.hired || []).indexOf("mg") >= 0);
    // (c7) the stall is dead: a ruinous first-owned type is SKIPPED and the
    // next affordable owned type builds instead
    const S7 = makeRunState();
    S7.started = true; S7.reg = fatReg(); S7.reg.scrap = 5000;
    S7.foe.towers = ["mortar", "mg"];
    fireBell(S7, { reg: S7.reg, snap: {}, rng: mulberry32(87), t: BELL_PERIOD_S, priceP: (k) => (k === "mg" ? 99999 : 40) });
    ok("T4(c7): an unaffordable first-owned type is skipped — the first AFFORDABLE owned type builds (no stall)",
      (S7.foe.hired || []).indexOf("mortar") >= 0 && (S7.foe.hired || []).indexOf("mg") < 0);
  }
  // (d) his hires field through the mirror machinery, draw-free
  {
    makeMap(93);
    const flatF4 = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (x, z, o) => { o.x = 0; o.y = 1; o.z = 0; return o; } };
    const w = makeWorld({ field: flatF4, seed: 93 });
    const S4 = { foeSquads: [] };
    const depotE4 = TOWN.find((t) => t.depot && t.team === 2);
    mirrorFieldKey(w, S4, depotE4, {}, flatF4, "sq_rifles", () => 1);
    const men = w.bodies.filter((b) => b.kind === "unit" && b.team === 2 && b.garrison && b.alive);
    ok("T4(d): a hired rifle squad fields four garrison men at his depot", men.length === 4, men.length);
    mirrorFieldKey(w, S4, depotE4, {}, flatF4, "sq_engineers", () => 1);
    ok("T4(d2): a hired engineer squad joins his build roster", S4.foeSquads.length === 1 && S4.foeSquads[0].memberIds.length === 2);
    mirrorFieldKey(w, S4, depotE4, {}, flatF4, "sq_engineers", () => 1);
    ok("T4(d2b): a second hired squad's id never collides — derived from the live roster, save-proof",
      S4.foeSquads.length === 2 && S4.foeSquads[0].id !== S4.foeSquads[1].id && S4.foeSquads.every((q) => q.id >= 9501));
    // a REAL mini-grid for the tower branch (the era-10 mkGrid idiom, local)
    const N = 44, cells = Array.from({ length: N * N }, () => ({ blocked: false, ice: false, water: false, wallId: null }));
    const G = { cells, w: N, h: N, cs: 2,
      idx: (gx, gz) => gz * N + gx,
      inBounds: (gx, gz) => gx >= 0 && gx < N && gz >= 0 && gz < N,
      worldToGrid: (x, z) => ({ gx: Math.floor(x / 2) + (N >> 1), gz: Math.floor(z / 2) + (N >> 1) }),
      gridToWorld: (gx, gz) => ({ x: (gx - (N >> 1)) * 2 + 1, z: (gz - (N >> 1)) * 2 + 1 }) };
    G.cellAt = (x, z) => { const g = G.worldToGrid(x, z); return G.inBounds(g.gx, g.gz) ? cells[G.idx(g.gx, g.gz)] : null; };
    const w2 = makeWorld({ field: flatF4, seed: 94 });
    mirrorFieldKey(w2, { foeSquads: [] }, { x: 0, z: 0, nx: 12, nz: 9, team: 2, depot: true }, G, flatF4, "gun", () => 1);
    const tw = w2.bodies.find((b) => b.kind === "tower" && b.team === 2 && b.alive);
    ok("T4(d3): a hired or built tower stands and fights at his depot", !!tw && tw.towerType === "gun" && tw.discipline === "free");
    ok("T4(d4): a bare fixture (no grid) skips fielding without a throw",
      (() => { mirrorFieldKey(w2, {}, { x: 0, z: 0 }, null, null, "hero_bison", null); return true; })());
    // (d5) the hemmed ring: every cell blocked but one pocket past the ring
    // scan's reach (~33m out — the ring samples only 12-30m) — the fail-proof
    // backstop still parks the paid tower
    const cellsH = Array.from({ length: N * N }, () => ({ blocked: true, ice: false, water: false, wallId: null }));
    const GH = { ...G, cells: cellsH };
    GH.cellAt = (x, z) => { const g = GH.worldToGrid(x, z); return GH.inBounds(g.gx, g.gz) ? cellsH[GH.idx(g.gx, g.gz)] : null; };
    cellsH[GH.idx(38, 22)].blocked = false; // world (33, 1) — ~33m from the depot, inside the 8-34m sweep
    const w4 = makeWorld({ field: flatF4, seed: 95 });
    mirrorFieldKey(w4, { foeSquads: [] }, { x: 0, z: 0, nx: 12, nz: 9, team: 2, depot: true }, GH, flatF4, "gun", () => 1);
    ok("T4(d5): a hemmed ring still parks the paid tower — the fail-proof backstop (the parkArmor precedent)",
      !!w4.bodies.find((b) => b.kind === "tower" && b.alive));
  }
  // (e) the wiring
  {
    const be = fs.readFileSync("src/depot/bell.js", "utf8");
    ok("T4(e): the ring fields his hires draw-free and clears the queue",
      /for \(const k of S\.foe\.hired\) mirrorFieldKey\(world, S, depotH, grid, field, k, ctx\.nextApcSeq\);/.test(be) && /S\.foe\.hired = \[\];/.test(be));
    ok("T4(e2): his hand pays the PLAYER'S price table — one table (owner)",
      /priceP: \(k\) => \(S\._market && S\._market\.player\[k\] != null \? S\._market\.player\[k\] : null\)/.test(be));
    const st = fs.readFileSync("src/depot/state.js", "utf8");
    ok("T4(e3): plans pay half and the floor guards every buy — plan, hire, and the tower build",
      /Math\.max\(1, Math\.ceil\(base \/ 2\)\)/.test(st) && (st.match(/< MIN_WAVE_FLOOR\) continue;/g) || []).length === 3 && /reg\.scrap - priceP\(x\) >= MIN_WAVE_FLOOR/.test(st));
    ok("T4(e4): the old pick machinery is gone", !/drawFoePick/.test(st) && !/foePool/.test(st) && !/FOE_DRAWS/.test(st));
    ok("T4(e5): one tower build a bell, first AFFORDABLE owned in table order, full price",
      /HAND_KEYS\.find\(\(x\) => S\.foe\.towers\.indexOf\(x\) >= 0 && priceP\(x\) != null && reg\.scrap - priceP\(x\) >= MIN_WAVE_FLOOR\)/.test(st));
    ok("T4(e6): the born-owned clause is in the filter — dead money closed at the source",
      /HAND_TAGS\[k\] === "" \|\| S\.foe\.unlocked\.indexOf\(HAND_TAGS\[k\]\) >= 0/.test(st));
  }
}

// ---- P7.2 T5 (mk1.85): THE REACTION — attacked ground answers, both sides
{
  // (a) hitOrigin: the shooter's live ground, else the blast point, else null
  {
    const w = makeWorld({ field: flatF, seed: 100 });
    const s = addBody(w, { kind: "unit", team: 2, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x: 12, y: 0.74, z: 5, hp: 58 });
    const o1 = hitOrigin(w, { srcId: s.id });
    ok("T5(a): a live source resolves to the shooter's ground", !!o1 && o1.x === 12 && o1.z === 5, JSON.stringify(o1));
    s.alive = false;
    const o2 = hitOrigin(w, { srcId: s.id, srcX: 3, srcZ: 4 });
    ok("T5(a2): a dead source falls back to the blast point", !!o2 && o2.x === 3 && o2.z === 4, JSON.stringify(o2));
    ok("T5(a3): no source and no point is no origin — and no reaction", hitOrigin(w, { cause: 1 }) === null && hitOrigin(w, null) === null);
  }
  // (b) the engine stamp: real rounds and real blasts carry their origin, depot only
  {
    const w = makeWorld({ field: flatF, seed: 101 }); w.depotCombat = true;
    const sh = addBody(w, { kind: "unit", team: 2, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x: 0, y: 0.74, z: 0, hp: 58 });
    const victim = addBody(w, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x: 0, y: 0.74, z: 8, hp: 500 });
    shooterFire(w, sh, { x: 0, y: 1.24, z: 0 }, victim, { ...INFANTRY_ARMS.rifles, acc: 0, blastR: 0.3, kv: 0.5 }, { attacker: "enemy", owner: sh.id });
    for (let i = 0; i < 240 && !victim.lastHit; i++) stepWorld(w);
    ok("T5(b): a landed round stamps its shooter onto the victim's hit", !!victim.lastHit && victim.lastHit.srcId === sh.id, JSON.stringify(victim.lastHit));
    explode(w, 3, 1, 8, { r: 3, kv: 2, dmg: 10, attacker: "enemy" });
    ok("T5(b2): an ownerless blast stamps its own point", victim.lastHit.srcX === 3 && victim.lastHit.srcZ === 8 && victim.lastHit.srcId === undefined, JSON.stringify(victim.lastHit));
    const w2 = makeWorld({ field: flatF, seed: 101 });
    const sh2 = addBody(w2, { kind: "unit", team: 2, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x: 0, y: 0.74, z: 0, hp: 58 });
    const v2 = addBody(w2, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x: 0, y: 0.74, z: 8, hp: 500 });
    shooterFire(w2, sh2, { x: 0, y: 1.24, z: 0 }, v2, { ...INFANTRY_ARMS.rifles, acc: 0, blastR: 0.3, kv: 0.5 }, { attacker: "enemy", owner: sh2.id });
    for (let i = 0; i < 240 && !v2.lastHit; i++) stepWorld(w2);
    ok("T5(b3): outside the depot the stamp is silent — the guard (golden's law)", !!v2.lastHit && v2.lastHit.srcId === undefined && v2.lastHit.srcX === undefined);
  }
  // (c) reactShift: the covered flank wins; cadence; the pair never shifts; good ground holds
  {
    const w = makeWorld({ field: flatF, seed: 102 });
    addBody(w, { kind: "wall", team: 2, mass: 0, hx: 0.9, hy: 0.9, hz: 0.35, x: 1.5, y: 0.9, z: 1.2, hp: 70 });
    const shooter = addBody(w, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x: 0, y: 0.74, z: 30, hp: 58 });
    const m = addBody(w, { kind: "unit", team: 2, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x: 0, y: 0.74, z: 0, hp: 58 });
    w.t = 10;
    m.lastHit = { srcId: shooter.id };
    const p1 = reactShift(w, m);
    ok("T5(c): unseen fire moves the man to the covered flank", !!p1 && Math.abs(p1.x - 1.5) < 0.01 && Math.abs(p1.z) < 0.01, JSON.stringify(p1));
    ok("T5(c2): the same hit never evaluates twice (the cadence)", reactShift(w, m) === null);
    const sp2 = addBody(w, { kind: "unit", team: 2, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x: 0, y: 0.74, z: -3, hp: 58 });
    sp2.role = "spotter"; sp2.lastHit = { srcId: shooter.id };
    ok("T5(c3): a roled man never shifts — the pair holds its chosen ground", reactShift(w, sp2) === null);
    const m4 = addBody(w, { kind: "unit", team: 2, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x: 30, y: 0.74, z: -20, hp: 58 });
    m4.lastHit = { srcId: shooter.id };
    ok("T5(c4): open ground with no better spot holds — being shot at is not, by itself, a reason to move", reactShift(w, m4) === null);
  }
  // (d) the enemy garrison dives and keeps its post (the real hold machinery)
  {
    const w = makeWorld({ field: flatF, seed: 103 }); w.depotCombat = true;
    addBody(w, { kind: "wall", team: 2, mass: 0, hx: 0.9, hy: 0.9, hz: 0.35, x: 1.5, y: 0.9, z: 1.2, hp: 70 });
    const g = spawnUnit(w, { x: 0, z: 0 }, ""); g.hold = true; g.garrison = true;
    g.pos.x = 0; g.pos.z = 0;
    const far = addBody(w, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x: 0, y: 0.74, z: 30, hp: 5000 });
    w.t = 5;
    applyDamage(w, g, 1, { attacker: "player", srcId: far.id });
    for (let i = 0; i < 600; i++) { stepUnits(w, straightGrid(0, 1), identFwdDir, null); stepWorld(w); }
    ok("T5(d): the garrison man dives to the covered flank and keeps his post", g.alive && Math.hypot(g.pos.x - 1.5, g.pos.z) < 0.6, `${g.pos.x.toFixed(2)},${g.pos.z.toFixed(2)}`);
    ok("T5(d2): and settles there", g.settled === true);
  }
  // (e) the player's defenders react by the same rule; every other order is the player's word
  {
    const w = makeWorld({ field: flatF, seed: 104 });
    addBody(w, { kind: "wall", team: 1, mass: 0, hx: 0.9, hy: 0.35, hz: 0.9, x: 1.5, y: 0.35, z: 0, hp: 70 });
    const sq = makeSquad(50, "mg", 1, 0, 0);
    spawnSquadMembers(w, sq);
    const m0 = w.byId.get(sq.memberIds[0]);
    const far = addBody(w, { kind: "unit", team: 2, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x: 30, y: 0.74, z: 1.5, hp: 5000 });
    w.t = 6;
    for (let i = 0; i < 120; i++) { stepSquad(w, sq, w.dt); stepWorld(w); } // settle the formation first
    applyDamage(w, m0, 1, { attacker: "enemy", srcId: far.id });
    for (let i = 0; i < 600; i++) { stepSquad(w, sq, w.dt); stepWorld(w); }
    ok("T5(e): the hit defender shifts to the covered flank of his slot", Math.hypot(m0.pos.x, m0.pos.z) < 3.6 && Math.abs(m0.pos.z) < 1.2, `${m0.pos.x.toFixed(2)},${m0.pos.z.toFixed(2)}`);
    const sqSrc = fs.readFileSync("src/depot/squads.js", "utf8");
    ok("T5(e2): the reaction lives in the defend branch alone — every other order is the player's word",
      (sqSrc.match(/const rs = reactShift\(world, u\);/g) || []).length === 1 && /const rs = reactShift\(world, u\);\n\s+if \(rs\) u\._slotGoal = rs;/.test(sqSrc));
    const unSrc = fs.readFileSync("src/depot/units.js", "utf8");
    ok("T5(e3): the enemy hold branch consumes the identical rule — one law, both sides",
      /const rs5 = reactShift\(world, u\);\n\s+if \(rs5\) u\._standPt = rs5;/.test(unSrc));
  }
  // (f) the hunt: a defending gun hull drives at the fire's origin, then home
  {
    const N = 44;
    const mkGridT5 = () => {
      const cells = Array.from({ length: N * N }, () => ({ blocked: false, terrain: false, ice: false, water: false, wallId: null, building: null, bTeam: 0, steep: false, drop: false, bag: null, bagId: null }));
      const G = { cells, w: N, h: N, cs: 2,
        idx: (gx, gz) => gz * N + gx,
        inBounds: (gx, gz) => gx >= 0 && gx < N && gz >= 0 && gz < N,
        worldToGrid: (x, z) => ({ gx: Math.floor(x / 2) + (N >> 1), gz: Math.floor(z / 2) + (N >> 1) }),
        gridToWorld: (gx, gz) => ({ x: (gx - (N >> 1)) * 2 + 1, z: (gz - (N >> 1)) * 2 + 1 }) };
      G.cellAt = (x, z) => { const g = G.worldToGrid(x, z); return G.inBounds(g.gx, g.gz) ? cells[G.idx(g.gx, g.gz)] : null; };
      return G;
    };
    const mkHull = (w, drv, x, z) => {
      const v = addBody(w, { kind: "vehicle", team: 1, mass: BISON.mass, hx: BISON.hx, hy: BISON.hy, hz: BISON.hz, x, y: BISON.hy + 0.05, z, hp: BISON.hp, friction: 0.85 });
      v.armor = BISON.armor; v.vtype = drv === "apc" ? "apc" : "bison"; v.drv = drv; v.depotDrive = "auto"; v.order = "defend"; v.tracks = "careful";
      v.homeX = x; v.homeZ = z;
      return v;
    };
    const w = makeWorld({ field: flatF, seed: 105 }); w.depotCombat = true;
    const G = mkGridT5();
    const v = mkHull(w, "armor", -20, 0);
    const sniper = addBody(w, { kind: "unit", team: 2, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x: 20, y: 0.74, z: 0, hp: 50000 });
    w.t = 3;
    applyDamage(w, v, 1, { attacker: "enemy", srcId: sniper.id });
    stepDrivers(w, G, identFwdDir, null);
    ok("T5(f): the hit flips a defending hull to the hunt", v.order === "move" && v.dest && Math.abs(v.dest.x - 20) < 0.01 && Math.abs(v.dest.z) < 0.01, JSON.stringify(v.dest));
    for (let i = 0; i < 3600 && v.order !== "defend"; i++) { w.t += w.dt; stepDrivers(w, G, identFwdDir, null); stepWorld(w); }
    ok("T5(f2): it drives to the origin and stands", v.order === "defend" && Math.hypot(v.pos.x - 20, v.pos.z) < 6, `${v.pos.x.toFixed(1)},${v.pos.z.toFixed(1)}`);
    v._huntT = w.t - (HUNT_HOLD_S + 1); // the quiet clock, expired
    stepDrivers(w, G, identFwdDir, null);
    ok("T5(f3): quiet ground sends it back to its park", v.order === "move" && v.dest && Math.abs(v.dest.x - (-20)) < 0.01, JSON.stringify(v.dest));
    const wA = makeWorld({ field: flatF, seed: 106 }); wA.depotCombat = true;
    const apc = mkHull(wA, "apc", -20, 0);
    const sA = addBody(wA, { kind: "unit", team: 2, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x: 20, y: 0.74, z: 0, hp: 50000 });
    wA.t = 3;
    applyDamage(wA, apc, 1, { attacker: "enemy", srcId: sA.id });
    for (let i = 0; i < 600; i++) { wA.t += wA.dt; stepDrivers(wA, mkGridT5(), identFwdDir, null); stepWorld(wA); }
    ok("T5(f4): the transport never hunts — it defends itself, it does not duel", apc.order === "defend" && Math.hypot(apc.pos.x + 20, apc.pos.z) < 1.5, `${apc.pos.x.toFixed(1)}`);
    const wB = makeWorld({ field: flatF, seed: 107 }); wB.depotCombat = true;
    const vB = mkHull(wB, "armor", 0, 0);
    const farB = addBody(wB, { kind: "unit", team: 2, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x: 60, y: 0.74, z: 0, hp: 5000 });
    wB.t = 3;
    applyDamage(wB, vB, 1, { attacker: "enemy", srcId: farB.id });
    stepDrivers(wB, mkGridT5(), identFwdDir, null);
    ok("T5(f5): an origin beyond HUNT_MAX_M is ignored — no cross-map wild chase", vB.order === "defend" && !vB._huntPt);
  }
  // (g) the engine stamp is guarded — the divergence law's letter
  {
    const core = fs.readFileSync("src/engine/core.js", "utf8");
    ok("T5(g): both damage sites stamp depot-only, the dmgT precedent",
      /srcId: world\.depotCombat \? p\.spec\.owner : undefined/.test(core) &&
      /srcId: world\.depotCombat \? spec\.owner : undefined, srcX: world\.depotCombat \? x : undefined, srcZ: world\.depotCombat \? z : undefined/.test(core));
  }
}

// ---- P7.2 HOTFIX mk1.86: THE HIRE ANSWERS ITS PRICE — refused up front, never a dead flow
{
  const src = fs.readFileSync("src/depot/DepotGame.jsx", "utf8");
  ok("HF(a): armHire refuses an unaffordable hire up front — the card stays, the hand stays open",
    /S\.armHire = \(key\) => \{[\s\S]{0,900}if \(S\.resources < price\) \{ toast\("NO SCRAP — ◆" \+ price \+ " TO HIRE"\); return; \}[\s\S]{0,120}S\.hirePlace = \{ key \};/.test(src));
  ok("HF(b): a ✓ refusal keeps the armed hire and the ghost — the GROUND NOT HELD precedent",
    !/toast\("NO SCRAP"\); S\.hirePlace = null;/.test(src));
  ok("HF(c): a fielded hire reopens the hand while cards remain — multi-buy stays one visit",
    /S\.hirePlace = null;\n\s+if \(S\.manifest && S\.manifest\.hand\.length && S\.openManifest\) S\.openManifest\(\);/.test(src));
  ok("HF(d): the card door passes the till's own verdict", /afford=\{hud\.info\.door === "hire" \? /.test(src));
  const ic = fs.readFileSync("src/depot/InfoCard.jsx", "utf8");
  ok("HF(e): CONFIRM HIRE greys and names the shortfall when the till can't cover it",
    /afford === false \? "NO SCRAP — ◆" \+ price : "CONFIRM HIRE"/.test(ic) && /disabled=\{afford === false\}/.test(ic));
}
