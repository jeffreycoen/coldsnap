import { ok } from "./harness.mjs";
import { identFwdDir } from "./shared.mjs";
import { fireBell, makeManifestState, makeFoeState, makeAssaultState, pickManifest, validatePlacement, spawnSquadMembers, memberNearRow } from "../../src/depot/state.js";
import { makeWorld, makeField, addBody, stepWorld } from "../../src/engine/core.js";
import { PLAYER_START, BISON, APC, MASON } from "../../src/depot/specs.js";
import { makeSquad } from "../../src/depot/squads.js";
import { makeRegiment } from "../../src/depot/economy.js";
import { planWave, ferryDecide, flankDrop } from "../../src/depot/ai.js";
import { makeTerritory, holderAt, canBuild } from "../../src/depot/territory.js";
import { makeSight, seenAt, stepSight } from "../../src/depot/sight.js";
import { minesToDraw } from "../../src/render/renderer.js";
import { serializeFront, parseFront, restoreBodies, restoreWelds, restoreSquads } from "../../src/depot/save.js";
import { stepMines, minePrices, mineSeedRoll, mineSeedPlace, FLARE_S, MINE_COST, WIRE_COST } from "../../src/depot/mines.js";
import { makeMap, TOWN, OBJ_POS, buildDepotTerrain, makeGrid, MAP_SEED, RIM_HALF_U, RIM_HALF_V, fwdDir, invW, streamAt, pondAt } from "../../src/depot/mapgen.js";
import { musterFreshStart, parkArmor, seedBags } from "../../src/depot/muster.js";
import { startBuildLine, stepBuildLine } from "../../src/depot/buildlines.js";
import { ringBell } from "../../src/depot/bell.js";
import { computePrices, marketCounts } from "../../src/depot/market.js";
import { stepDrivers } from "../../src/depot/drivers.js";
import { planRoute } from "../../src/depot/route.js";
import fs from "node:fs";

// ==== P7 T18: THE MAP MOVES OUT ==============================================
// Reorganization 1 of 5 (owner): the map frame lives in mapgen.js, verbatim.
// Zero behavior change — the keystone above is the proof.
{
  let mgSrc18 = "";
  try { mgSrc18 = fs.readFileSync(new URL("../../src/depot/mapgen.js", import.meta.url), "utf8"); } catch (e) {}
  const dgSrc18 = fs.readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");
  ok("T18(a): mapgen.js exists and owns the generator",
    /export function genMap\(seed\)/.test(mgSrc18) && /export function makeMap\(seed\)/.test(mgSrc18) &&
    /export function buildDepotTerrain\(/.test(mgSrc18) && /export function makeGrid\(field\)/.test(mgSrc18) &&
    /export function planTrees\(\)/.test(mgSrc18) && /export function computeFlowField\(/.test(mgSrc18));
  ok("T18(a2): the frame state moved with it",
    /export let ORIENT = 0;/.test(mgSrc18) && /export const RIM_HALF_U = 90, RIM_HALF_V = 90;/.test(mgSrc18) &&
    /export let STREAM = null;/.test(mgSrc18));
  ok("T18(b): DepotGame no longer defines what it now imports",
    !/function genMap\(/.test(dgSrc18) && !/function makeGrid\(/.test(dgSrc18) &&
    !/function computeFlowField\(/.test(dgSrc18) && /from "\.\/mapgen\.js"/.test(dgSrc18));
}
// ==== end P7 T18 =============================================================

// ==== P7 T19: THE MUSTER MOVES OUT ===========================================
// Reorganization 2 of 5 (owner): the fresh-war boot block lives in muster.js,
// verbatim bodies with explicit parameters. Boot draws stay 45 by pin; and
// the boot block gets its FIRST real fixture — the suite calls the actual
// code instead of reimplementing it (how both boot bugs hid).
{
  let muSrc19 = "";
  try { muSrc19 = fs.readFileSync(new URL("../../src/depot/muster.js", import.meta.url), "utf8"); } catch (e) {}
  const dgSrc19 = fs.readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");
  ok("T19(a): muster.js owns the boot block",
    /export function parkArmor\(world, grid, field, depotT, team, kind, nextSeq\)/.test(muSrc19) &&
    /export function seedBags\(world, grid, depotT, streamKey, stampBag\)/.test(muSrc19) &&
    /export function musterFreshStart\(world, S, depotP\)/.test(muSrc19) &&
    /export function armorSpread\(field, bx, bz, spec\)/.test(muSrc19));
  ok("T19(a2): DepotGame no longer defines what it now imports",
    !/const parkArmor = /.test(dgSrc19) && !/const seedBags = /.test(dgSrc19) &&
    !/THE HOME GUARD \(owner\)/.test(dgSrc19) && /from "\.\/muster\.js"/.test(dgSrc19));
  ok("T19(a3): the seat counter stays a mount let with its pinned reseed",
    /let apcSeqN = 0;/.test(dgSrc19) && /const nextApcSeq = \(\) => \+\+apcSeqN;/.test(dgSrc19));
  // (b) the boot block, called for real — the first true muster fixture.
  {
    makeMap(4242);
    const flatF19 = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (x, z, o) => { o.x = 0; o.y = 1; o.z = 0; return o; } };
    const w = makeWorld({ field: flatF19, seed: 4242 });
    let draws = 0; const raw = w.rng;
    w.rng = () => { draws++; return raw(); };
    const S19 = { reg: { heads: 60 }, squads: [], nextSquadId: 1, cmdr: null };
    musterFreshStart(w, S19, TOWN.find((t) => t.depot && t.team !== 2));
    ok("T19(b): the fresh start draws exactly 43 (guard 24 + commander 1 + fielded 18)", draws === 43, draws);
    ok("T19(b2): two player squads muster — runners of 4, breakers of 2",
      S19.squads.length === 2 &&
      S19.squads.find((q) => q.type === "runners").memberIds.length === 4 &&
      S19.squads.find((q) => q.type === "breakers").memberIds.length === 2);
    let guard = 0;
    for (const b of w.bodies) if (b.kind === "unit" && b.team === 2 && b.garrison && b.alive) guard++;
    ok("T19(b3): fourteen enemy standers hold their ground (8 guard + 6 fielded)", guard === 14, guard);
    ok("T19(b4): the commander was drawn", S19.cmdr === "cautious" || S19.cmdr === "bold" || S19.cmdr === "stubborn", S19.cmdr);
    ok("T19(b5): the books stayed honest", S19.reg.heads === 52, S19.reg.heads);
  }
}
// ==== end P7 T19 =============================================================

// ==== P7 T20: THE BUILD LINES MOVE OUT =======================================
// Reorganization 3 of 5 (owner): the two-point lay machinery lives in
// buildlines.js, verbatim bodies with explicit parameters; the interface
// glue stays behind and calls in.
{
  let blSrc20 = "";
  try { blSrc20 = fs.readFileSync(new URL("../../src/depot/buildlines.js", import.meta.url), "utf8"); } catch (e) {}
  const dgSrc20 = fs.readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");
  ok("T20(a): buildlines.js owns the machinery",
    /export function stepBuildLine\(world, grid, field, T, S, sq, ctx, toast\)/.test(blSrc20) &&
    /export function layPieceAt\(world, grid, field, T, S, job, row, ctx\)/.test(blSrc20) &&
    /export function startBuildLine\(grid, sq, kind, a, b, toast\)/.test(blSrc20) &&
    /export function linePieces\(grid, field, T, kind, a, b\)/.test(blSrc20) &&
    /export function lineCells\(grid, a, b\)/.test(blSrc20) && /export function pieceHalf\(kind, orient\)/.test(blSrc20));
  ok("T20(a2): DepotGame no longer defines what it now imports",
    !/const layPieceAt = /.test(dgSrc20) && !/const lineCells = /.test(dgSrc20) &&
    !/const startBuildLine = /.test(dgSrc20) && /from "\.\/buildlines\.js"/.test(dgSrc20));
  ok("T20(a3): the mount wires the driver through the context",
    /const layCtx = \{ stampBag, recomputeFlow, objG, setMines: \(m\) => R\.setMines\(m\) \};/.test(dgSrc20) &&
    /S\.stepBuildLine = \(sq\) => stepBuildLine\(world, grid, field, T, S, sq, layCtx, toast\);/.test(dgSrc20));
  // (b) the machinery, called for real — a wall line on a synthetic world
  // lays through the imported driver end to end.
  {
    const flatF20 = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (x, z, o) => { o.x = 0; o.y = 1; o.z = 0; return o; } };
    const w = makeWorld({ field: flatF20, seed: 41 });
    // identity-mapped mini grid, cs 2 — the T16/T17 mkGrid shape, local name
    // (those helpers are block-scoped to their own tasks, so this task gets
    // its own copy of the same idiom rather than reaching across blocks).
    const mkGrid20 = (n) => {
      const cells = new Array(n * n);
      for (let i = 0; i < cells.length; i++) cells[i] = { blocked: false, terrain: false, ice: false, wallId: null, building: null, bTeam: 0, steep: false, drop: false };
      const G = { cells, w: n, h: n, cs: 2,
        idx: (gx, gz) => gz * n + gx,
        inBounds: (gx, gz) => gx >= 0 && gx < n && gz >= 0 && gz < n,
        worldToGrid: (x, z) => ({ gx: Math.floor(x / 2) + (n >> 1), gz: Math.floor(z / 2) + (n >> 1) }),
        gridToWorld: (gx, gz) => ({ x: (gx - (n >> 1)) * 2 + 1, z: (gz - (n >> 1)) * 2 + 1 }) };
      G.cellAt = (x, z) => { const g = G.worldToGrid(x, z); return G.inBounds(g.gx, g.gz) ? cells[G.idx(g.gx, g.gz)] : null; };
      return G;
    };
    const G = mkGrid20(20); // any of the suite's mini-grid helpers with cellAt
    const sq = makeSquad(1, "engineers", 1, -5, 1);
    spawnSquadMembers(w, sq);
    const S20 = { resources: 500, mines: [], sandbagOrient: 0, _market: null, _minePrices: null, squads: [sq] };
    const ctx20 = { stampBag: () => {}, recomputeFlow: () => {}, objG: { gx: 10, gz: 19 }, setMines: () => {} };
    // T20 deviation (Step 1, licensed fit 1): canBuild(T, u, v) reads
    // T.halfU/halfV/cs/nx/nz/v (territory.js's cellOf/holderAt) — not
    // stubbable as a bare object without reimplementing those reads, so
    // this is the real makeTerritory(90, 90) (matches RIM_HALF_U/V), filled
    // green (v.fill(1)) so every cell answers "held" — permissive by
    // construction, no territory.js edit.
    const T20 = makeTerritory(90, 90); T20.v.fill(1);
    startBuildLine(G, sq, "bags", { x: -5, z: 1 }, { x: 5, z: 1 }, () => {});
    ok("T20(b): the order arms — rows planned, phase toStart", !!sq._build && sq._build.rows.length >= 5 && sq._build.phase === "toStart");
    sq.order = "defend"; sq.dest = null;                        // simulate the arrival handoff
    stepBuildLine(w, G, flatF20, T20, S20, sq, ctx20, () => {}); // flips to laying
    // T20 deviation (Step 1, licensed fit 2 — arrival flow): the literal
    // "hands present at the far end" step deadlocks the real driver — once
    // arrived, layPieceAt's while loop drains job.rows in ONE call, in
    // row order starting at the line's near end, breaking the instant
    // memberNearRow fails; hands only at the far end never reach the near
    // rows. Real intent (arm -> handoff -> hands at rows -> all rows lay ->
    // job closes): both engineers are placed 1m off the line's z-axis
    // (clear of the piece-overlap skip, ph.hz + u.hz + LAY_MAN_PAD = 0.78m)
    // and spread along x so every row sits within LAY_REACH(3) of one of
    // them — the whole line lays in the single arrived call.
    const mem20 = sq.memberIds.map((id) => w.byId.get(id));
    mem20[0].pos.x = -2.5; mem20[0].pos.z = 2;
    mem20[1].pos.x = 2.5; mem20[1].pos.z = 2;
    sq.anchor = { x: 5, z: 1 };                                  // anchor at the far end
    sq.order = "defend";                                         // arrived
    for (let i = 0; i < 80; i++) { sq._pauseT = 0; stepBuildLine(w, G, flatF20, T20, S20, sq, ctx20, () => {}); if (!sq._build) break; }
    let bags = 0;
    for (const b of w.bodies) if (b.sandbag && b.alive) bags++;
    ok("T20(b2): the line laid real bags through the real driver", bags >= 3, bags);
    ok("T20(b3): the job closed and the books were charged", sq._build === null && S20.resources < 500, S20.resources);
  }
}
// ==== end P7 T20 =============================================================

// ==== P7 T21: THE BELL MOVES OUT =============================================
// Reorganization 4 of 5 (owner): the ring lives in bell.js, one verbatim
// body with explicit parameters; the cards stay presentation. And the ring
// gets its first real fixture — two bells rung through the actual code.
{
  const beSrc21 = (() => { try { return fs.readFileSync(new URL("../../src/depot/bell.js", import.meta.url), "utf8"); } catch (e) { return ""; } })();
  const dgSrc21 = fs.readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");
  ok("T21(a): bell.js owns the ring",
    /export function ringBell\(world, grid, field, T, S, ctx\)/.test(beSrc21) &&
    /ctx\.saveFront\(\);/.test(beSrc21) && /payTown\(ctx\.townUV, T\)/.test(beSrc21));
  ok("T21(a2): DepotGame keeps only the wrapper and the cards",
    !/const ringBell = \(\) => \{/.test(dgSrc21) &&
    /const ringBell = \(\) => ringBellOut\(world, grid, field, T, S, bellCtx\);/.test(dgSrc21) &&
    /S\.pickManifest = /.test(dgSrc21));
  // (b) two bells rung through the real ring — structure, not feel
  {
    makeMap(4242);
    const flatF21 = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (x, z, o) => { o.x = 0; o.y = 1; o.z = 0; return o; } };
    const w = makeWorld({ field: flatF21, seed: 51 });
    let draws = 0; const raw = w.rng; w.rng = () => { draws++; return raw(); };
    const T21 = makeTerritory(90, 90);
    // The licensed S21 fit: every field named because the ring reads it.
    // bell/resources/mines follow the mount's own fresh-boot literal;
    // reg/ws/manifest/foe are the real state factories, called in the
    // mount's own order (reg last, off the same rng stream). _minePrices
    // stubs to null (the mount's own fresh value) — the sapper block's own
    // ternary falls back to MINE_COST cleanly. _market CANNOT stub to null:
    // fireBell's priceOf closure passes it straight to ai.js's planWave as
    // `price = priceOf || cost` — priceOf is a live (non-null) function
    // reference either way, so a null S._market makes every price() call
    // return undefined, not fall through to the static table; the buy math
    // (scrap / price) silently goes NaN instead of throwing. Named field:
    // _market is the real computePrices(marketCounts(...)) read off the
    // synthetic (bodyless) world — exactly what the mount computes at 1Hz
    // before any bell can ring.
    const S21 = {
      bell: 0, resources: 120, mines: [], squads: [],
      ws: makeAssaultState(), manifest: makeManifestState(), foe: makeFoeState(),
      _market: computePrices(marketCounts(w, [], [])), _minePrices: null,
      reg: makeRegiment(w.rng),
    };
    let saves = 0;
    const ctx21 = { cue: () => {}, toast: () => {}, townUV: [], buildSnapshot: () => ({ }), nextApcSeq: () => 99, saveFront: () => { saves++; } };
    const d0 = draws;
    ringBell(w, null, flatF21, T21, S21, ctx21);
    ringBell(w, null, flatF21, T21, S21, ctx21);
    ok("T21(b): two rings, two saves, no throw", saves === 2);
    ok("T21(b2): the unconditional pairs drew — at least 16 draws across two bells (4 planWave + 2 ferry + 2 sapper each, intel on top)", draws - d0 >= 16, draws - d0);
    ok("T21(b3): the muster filled the queue", S21.ws.spawnQueue > 0 || S21.ws.mixBag.length > 0);
  }
}
// ==== end P7 T21 =============================================================

// ==== P7 T10: MINES AND TRIPWIRES ============================================
//  (a) the trigger: a player rifleman standing ON a player mine never trips
//      it (long run, untouched); an enemy conscript walking on DOES — and a
//      player rifleman inside the blast radius at that moment is hurt too
//      (both-sides blast, owner's revision); the mine spends
//  (b) the wire: an enemy crossing fires the flare — a team-1 flag-kind eye
//      appears at the spot, sight lights the cell for team 1 on the next
//      recompute, the crosser takes the small blast, the eye dies at 6 s
//  (c) budgets climb: minePrices with 0 devices = base; with 12 live mines
//      (either side) the mine price doubles
//  (d) enemy seeding: mineSeedRoll/mineSeedPlace (mines.js) — factored out of
//      ringBell for direct testability (named deviation, mirrors the P7 T8
//      ferryDecide/flankDrop precedent) — plus source-pins proving ringBell
//      draws both rolls unconditionally every bell and wires them straight
//      through, after the hero-tier block
//  (e) the save round trip carries S.mines verbatim, live flags included
//  (f) laying: the line kinds produce one device per clear cell, no grid
//      claim (cells stay unblocked), scrap deducted at the live price —
//      pinned by source shape (layPieceAt/linePieces are DepotGame.jsx
//      closures with no live grid/world to run headless, same convention
//      the mk0.60 two-point build block above uses)
//  (g) invisibility: the R.setMines list never contains a team-2 device
//      (pure list-builder assert)
{
  console.log("\n[p7 t10: mines and tripwires]");
  const flatF10 = { heightAt: () => 0, dirty: false, carve: () => {} };

  // (a) the trigger + both-sides blast + the spend
  {
    const w = makeWorld({ field: flatF10, seed: 401 });
    const mines = [{ x: 0, z: 0, team: 1, kind: "mine", live: true }];
    addBody(w, { kind: "unit", team: 1, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x: 0.2, y: 0.88, z: 0, hp: 58 });
    for (let i = 0; i < 30; i++) stepMines(w, mines);
    ok("T10(a): a player rifleman standing on a player mine never trips it (long run)", mines[0].live === true, JSON.stringify(mines[0]));
  }
  {
    const w = makeWorld({ field: flatF10, seed: 402 });
    const mines = [{ x: 0, z: 0, team: 1, kind: "mine", live: true }];
    const enemyU = addBody(w, { kind: "unit", team: 2, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x: 0.5, y: 0.88, z: 0, hp: 58 });
    const friendlyU = addBody(w, { kind: "unit", team: 1, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x: -1.0, y: 0.88, z: 0, hp: 58 });
    const eHp0 = enemyU.hp, fHp0 = friendlyU.hp;
    stepMines(w, mines);
    ok("T10(a2): an enemy crosser trips the mine — it spends", mines[0].live === false);
    ok("T10(a3): the enemy crosser takes real damage", enemyU.hp < eHp0, `${eHp0} -> ${enemyU.hp}`);
    ok("T10(a4): a player rifleman inside the blast radius at that moment is hurt too (both-sides blast, owner's 2026-08-17 revision)",
      friendlyU.hp < fHp0, `${fHp0} -> ${friendlyU.hp}`);
  }

  // (b) the wire: flare eye, sight, the small blast, the 6s reap
  {
    const w = makeWorld({ field: flatF10, seed: 403 });
    const mines = [{ x: 5, z: 5, team: 1, kind: "wire", live: true }];
    const crosser = addBody(w, { kind: "unit", team: 2, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x: 5.3, y: 0.88, z: 5, hp: 58 });
    const hp0 = crosser.hp;
    stepMines(w, mines);
    ok("T10(b): the wire fires and spends", mines[0].live === false);
    const eye = w.bodies.find((b) => b.kind === "flag" && b._dieT != null);
    ok("T10(b2): a team-1 flag-kind eye appears at the spot", !!eye && eye.team === 1 && Math.abs(eye.pos.x - 5) < 1e-6 && Math.abs(eye.pos.z - 5) < 1e-6,
      JSON.stringify(eye && eye.pos));
    ok("T10(b3): the eye carries no flagPole — nothing draws it", eye && !eye.flagPole);
    ok("T10(b4): a \"flare\" event was pushed", w.events.some((e) => e.type === "flare" && e.x === 5 && e.z === 5));
    ok("T10(b5): the crosser takes the small blast", crosser.hp < hp0, `${hp0} -> ${crosser.hp}`);
    // sight lights the cell for team 1 on the next recompute
    const T10b = makeTerritory(30, 30);
    const SG10b = makeSight(T10b);
    const ident10b = (x, z) => ({ u: x, v: z });
    stepSight(w, SG10b, ident10b, ident10b);
    ok("T10(b6): sight lights the cell for team 1 on the next recompute", seenAt(SG10b, 5, 5, 1));
    // the eye dies at 6s — _dieT reaped by stepMines' own cleanup pass
    w.t += FLARE_S + 0.01;
    stepMines(w, mines);
    ok("T10(b7): the eye dies at 6s", !w.byId.get(eye.id));
  }

  // (c) budgets climb
  {
    const mkt10 = await import("../../src/depot/market.js");
    const p0 = minePrices({}, mkt10.priced);
    ok("T10(c): minePrices with 0 devices = base", p0.mine === MINE_COST && p0.wire === WIRE_COST, JSON.stringify(p0));
    const p1 = minePrices({ mine: 12 }, mkt10.priced);
    ok("T10(c2): 12 live mines (either side) doubles the mine price", p1.mine === 2 * MINE_COST, p1.mine);
    ok("T10(c3): MARKET_K carries the mine/wire families at K 12/16", mkt10.MARKET_K.mine === 12 && mkt10.MARKET_K.wire === 16, JSON.stringify({ mine: mkt10.MARKET_K.mine, wire: mkt10.MARKET_K.wire }));
    // marketCounts: mines is an optional third arg, both sides' live devices
    // together — module purity (market.js never imports mines.js).
    const flatF10c = { heightAt: () => 0 };
    const w10c = makeWorld({ field: flatF10c, seed: 404 });
    const mines10c = [
      { x: 0, z: 0, team: 1, kind: "mine", live: true }, { x: 1, z: 1, team: 2, kind: "mine", live: true },
      { x: 2, z: 2, team: 1, kind: "mine", live: false }, { x: 3, z: 3, team: 1, kind: "wire", live: true },
    ];
    const counts10c = mkt10.marketCounts(w10c, [], mines10c);
    ok("T10(c4): marketCounts counts live mine/wire devices, both teams together, dead ones excluded",
      counts10c.mine === 2 && counts10c.wire === 1, JSON.stringify(counts10c));
    ok("T10(c5): marketCounts's third arg is optional — omitting it never throws and adds no mine/wire family",
      (() => { const c = mkt10.marketCounts(w10c, []); return c.mine === undefined && c.wire === undefined; })());
  }

  // (d) enemy seeding — the pure gate/pick functions, plus source-pins of
  // ringBell's own wiring (the same convention T9(d) used for its own
  // ringBell-embedded logic).
  {
    ok("T10(d): mineSeedRoll fires under 0.5 with a sapper in the bag and afford", mineSeedRoll(0.3, true, 100, 18) === true);
    ok("T10(d2): mineSeedRoll never fires at/above 0.5", mineSeedRoll(0.5, true, 100, 18) === false);
    ok("T10(d3): mineSeedRoll never fires without a sapper in the bag", mineSeedRoll(0.1, false, 100, 18) === false);
    ok("T10(d4): mineSeedRoll never fires when the regiment can't afford 3x the table", mineSeedRoll(0.1, true, 10, 18) === false);
    const cands10d = []; for (let i = 0; i < 9; i++) cands10d.push({ x: i, z: 0 });
    const picks0 = mineSeedPlace(cands10d, 0);
    ok("T10(d5): mineSeedPlace lays exactly 3, striding the candidate list", picks0.length === 3, JSON.stringify(picks0));
    ok("T10(d6): mineSeedPlace's picks stride deterministically", picks0[0] === cands10d[0] && picks0[1] === cands10d[3] && picks0[2] === cands10d[6]);
    const picks1 = mineSeedPlace(cands10d, 0.99);
    ok("T10(d7): a different roll picks a different start, still exactly 3", picks1.length === 3 && picks1[0] !== picks0[0]);
    ok("T10(d8): fewer than 3 candidates lays none", mineSeedPlace([{ x: 0, z: 0 }], 0.2).length === 0);
    ok("T10(d9): a 0.6 roll never lays, regardless of afford/bag", mineSeedRoll(0.6, true, 1e9, 1) === false);

    // retargeted mk1.51, P7 T21: ringBell moved to bell.js.
    const dsrc10 = fs.readFileSync(new URL("../../src/depot/bell.js", import.meta.url), "utf8");
    const ringBellBody10 = (dsrc10.match(/export function ringBell\(world, grid, field, T, S, ctx\) \{[\s\S]*?\n\}/) || [""])[0];
    ok("T10(d10): ringBell extracts (source pin base)", ringBellBody10.length > 0);
    ok("T10(d11): TWO unconditional draws every bell (mineRoll, minePlaceRoll — the law)",
      /const mineRoll = world\.rng\(\), minePlaceRoll = world\.rng\(\);/.test(ringBellBody10));
    ok("T10(d12): price3 reads the live market, falling back to the table base",
      /const price3 = S\._minePrices \? S\._minePrices\.mine \* 3 : MINE_COST \* 3;/.test(ringBellBody10));
    ok("T10(d13): the bag gate reads the enemy's own current muster (S.ws.mixBag)",
      /const hasSapper = S\.ws\.mixBag\.indexOf\("sapper"\) >= 0;/.test(ringBellBody10));
    ok("T10(d14): the roll is gated through mineSeedRoll, unconditionally drawn either way",
      /if \(mineSeedRoll\(mineRoll, hasSapper, S\.reg\.scrap, price3\)\)/.test(ringBellBody10));
    ok("T10(d15): the pick is gated through mineSeedPlace",
      /const picks = mineSeedPlace\(cands, minePlaceRoll\);/.test(ringBellBody10));
    ok("T10(d16): scrap is deducted once for the three, before they land",
      /S\.reg\.scrap -= price3;\s*\n\s*for \(const c3 of picks\) S\.mines\.push/.test(ringBellBody10));
    ok("T10(d17): enemy mines land team 2, kind mine, live",
      /S\.mines\.push\(\{ x: c3\.x, z: c3\.z, team: 2, kind: "mine", live: true \}\);/.test(ringBellBody10));
    ok("T10(d18): candidates draw from PASSES on the enemy's own half (c.v < 0) plus the territory seam band",
      /if \(c\.v < 0\) cands\.push/.test(ringBellBody10) && /vv > -0\.15 && vv < 0\.15/.test(ringBellBody10));
    ok("T10(d19): sits after the hero-tier block (P7 T9)",
      ringBellBody10.indexOf("THE HERO TIER, their side") < ringBellBody10.indexOf("THE ENEMY SAPPER BRAIN"));
  }

  // (e) the save round trip
  {
    const T10e = makeTerritory(5, 5);
    const world10e = makeWorld({ field: makeField(9, 2.0, 1), seed: 405 });
    const S10e = {
      bell: 0, resources: 0, kills: 0, spawnRR: 0, started: false, mode: "wall", sandbagOrient: 0,
      nextSquadId: 1, zoom: 1, focus: { x: 0, z: 0 }, depotCensusAcc: 0, depotStanding: 1, enemyStanding: 1,
      starvedStreak: 0, _reportedBreak: false, _reportedSpent: false,
      manifest: {}, foe: {}, intelUp: false, intelArmedAt: 0, lastDispatch: null,
      pendingPlan: null, intelPlan: null, ws: {}, reg: {}, squads: [],
      mines: [{ x: 1.2345, z: -3.4, team: 1, kind: "mine", live: true }, { x: 5, z: 5, team: 2, kind: "wire", live: false }],
    };
    const json10e = serializeFront({ S: S10e, world: world10e, T: T10e, town: [], census: [], census2: [], rocks: [], smears: [], mapSeed: 1, rngSeed: 1 });
    const parsed10e = parseFront(json10e);
    ok("T10(e): the save round trip parses back", parsed10e.ok, parsed10e.reason);
    const rm = parsed10e.ok ? parsed10e.data.run.mines : null;
    ok("T10(e2): S.mines carries verbatim, live flags included",
      !!rm && rm.length === 2 &&
      Math.abs(rm[0].x - 1.2345) < 0.001 && Math.abs(rm[0].z - (-3.4)) < 0.001 && rm[0].t === 1 && rm[0].k === "mine" && rm[0].l === 1 &&
      Math.abs(rm[1].x - 5) < 0.001 && rm[1].t === 2 && rm[1].k === "wire" && rm[1].l === 0,
      JSON.stringify(rm));
  }

  // (f) laying — source-pinned (layPieceAt/linePieces need a live grid/world
  // the headless suite doesn't build; same convention mk0.60/6 above uses).
  {
    const dsrc10f = fs.readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");
    // P7 T20: layPieceAt/linePieces moved to buildlines.js — (f)-(f4) below
    // retarget to that literal text (sweep license); (f3) also re-teaches
    // R.setMines -> ctx.setMines per the task's own substitution table.
    const blSrc10f = fs.readFileSync(new URL("../../src/depot/buildlines.js", import.meta.url), "utf8");
    ok("T10(f): layPieceAt gains a device branch for mines/wires (retargeted mk1.50, P7 T20: layPieceAt moved to buildlines.js)",
      /if \(job\.kind === "mines" \|\| job\.kind === "wires"\) \{/.test(blSrc10f));
    ok("T10(f2): no cell claim, no validatePlacement — only water\\/blocked-terrain cells refuse (retargeted mk1.50, P7 T20: layPieceAt moved to buildlines.js)",
      /if \(cell\.blocked \|\| cell\.ice\) return "skip";/.test(blSrc10f) && !/if \(job\.kind === "mines" \|\| job\.kind === "wires"\) \{[\s\S]{0,400}validatePlacement/.test(blSrc10f));
    ok("T10(f3): a device is a watched point, one per clear cell, at the live price (retargeted mk1.50, P7 T20: layPieceAt moved to buildlines.js; re-taught R.setMines -> ctx.setMines)",
      /S\.mines\.push\(\{ x: row\.x, z: row\.z, team: 1, kind: job\.kind === "mines" \? "mine" : "wire", live: true \}\);/.test(blSrc10f) &&
      /S\.resources -= cost;\s*\n\s*ctx\.setMines\(S\.mines\);/.test(blSrc10f));
    ok("T10(f4): linePieces' ghost mirrors layPieceAt's exact skip rule for devices (water\\/blocked-terrain only, no ground-held gate) (retargeted mk1.50, P7 T20: linePieces moved to buildlines.js)",
      /if \(isDevice\) \{ if \(cell\.blocked \|\| cell\.ice\) continue; \}/.test(blSrc10f));
    ok("T10(f5): the sapper pie gains MINES and WIRES wedges",
      /key: "build_mines", icon: "◆", label: "MINES"/.test(dsrc10f) && /key: "build_wires", icon: "⌁", label: "WIRES"/.test(dsrc10f));
    ok("T10(f6): the wedges are gated to sappers, mirroring the engineer gate",
      /if \(sq\.sapper\) \{/.test(dsrc10f) && /sapper: sq\.type === "sappers",/.test(dsrc10f));
    ok("T10(f7): S.orderSquad's build gate is sappers-only for the device kinds",
      /kind === "build_mines" \|\| kind === "build_wires"/.test(dsrc10f) && /if \(sq\.type !== "sappers"\) return;/.test(dsrc10f));
    ok("T10(f8): consumeOrderTap accepts the two device kinds under the same sapper guard",
      /if \(om === "build_mines" \|\| om === "build_wires"\) \{/.test(dsrc10f) && /if \(!osq \|\| osq\.type !== "sappers"\)/.test(dsrc10f));
  }

  // (g) invisibility — pure list-builder
  {
    const list10g = [
      { x: 0, z: 0, team: 1, kind: "mine", live: true },
      { x: 1, z: 1, team: 2, kind: "mine", live: true },
      { x: 2, z: 2, team: 1, kind: "mine", live: false },
      { x: 3, z: 3, team: 2, kind: "wire", live: true },
    ];
    const drawn = minesToDraw(list10g);
    ok("T10(g): R.setMines's list-builder never contains a team-2 device", drawn.every((m) => m.team === 1));
    ok("T10(g2): only LIVE team-1 devices draw", drawn.length === 1 && drawn[0].x === 0);
  }
}
// ==== end P7 T10 ==============================================================

// ==== P7 T11: THE MANUAL LEARNS ARMOR, AND THE AUDIT ========================
// mk1.41. One comprehensive fixture: a war state carrying everything P7
// added — a player Bison mid-PATROL, a player APC with a squad sealed
// aboard, an enemy Bison committed forward, an enemy APC mid-FERRY with
// loose riders, live and spent mines both teams, the drawn commander, a
// garrisoned man, and hero tags in both unlocked lists — round-tripped
// through serializeFront -> parseFront -> restoreBodies/restoreSquads,
// every named field checked by name. Also: _route re-derives (never
// survives), a mid-possession save resumes to command view, and the flare
// eye's _dieT.
{
  console.log("\n[p7 t11: the manual learns armor, and the audit]");
  const field11 = makeField(9, 2.0, 1101);
  const world11 = makeWorld({ field: field11, seed: 1101 });
  world11.t = 100; // an arbitrary mid-run clock — the flare eye's _dieT is checked against this

  // player Bison, mid-PATROL
  const pBison = addBody(world11, { kind: "vehicle", team: 1, mass: BISON.mass, hx: BISON.hx, hy: BISON.hy, hz: BISON.hz,
    x: 0, y: BISON.hy + 0.05, z: -10, hp: BISON.hp, friction: 0.85 });
  pBison.vtype = "bison"; pBison.drv = "armor"; pBison.depotDrive = "auto"; pBison.order = "patrol";
  pBison.dest = { x: 12, z: -30 }; pBison.tracks = "free"; pBison.homeX = 0; pBison.homeZ = -10; pBison.armor = BISON.armor;
  pBison._patA = { x: 5, z: -5 }; pBison._patB = { x: 12, z: -30 };
  pBison._route = [{ x: 1, z: 1 }, { x: 2, z: 2 }]; // a live route — must NOT survive

  // player APC, a squad sealed aboard
  const pApc = addBody(world11, { kind: "vehicle", team: 1, mass: APC.mass, hx: APC.hx, hy: APC.hy, hz: APC.hz,
    x: 20, y: APC.hy + 0.05, z: -10, hp: APC.hp, friction: 0.85 });
  pApc.vtype = "apc"; pApc.apcSeq = 1; pApc.drv = "apc"; pApc.depotDrive = "auto"; pApc.order = "defend"; pApc.tracks = "careful";
  pApc.homeX = 20; pApc.homeZ = -10; pApc.armor = APC.armor;
  const r1 = addBody(world11, { kind: "unit", team: 1, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x: 20, y: -60, z: -10, hp: 58 });
  const r2 = addBody(world11, { kind: "unit", team: 1, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x: 20, y: -60, z: -10, hp: 58 });
  r1.riding = true; r1.pinned = true; r2.riding = true; r2.pinned = true;
  const sq1 = makeSquad(1, "rifles", 1, 20, -10);
  sq1.ridingIn = 1; sq1.memberIds = [r1.id, r2.id];

  // enemy Bison, committed forward
  const eBison = addBody(world11, { kind: "vehicle", team: 2, mass: BISON.mass, hx: BISON.hx, hy: BISON.hy, hz: BISON.hz,
    x: 0, y: BISON.hy + 0.05, z: 40, hp: BISON.hp, friction: 0.85 });
  eBison.vtype = "bison"; eBison.drv = "armor"; eBison.depotDrive = "auto"; eBison.order = "move";
  eBison.dest = { x: 0, z: 0 }; eBison.tracks = "careful"; eBison.homeX = 0; eBison.homeZ = 40;
  eBison.committed = 1; eBison.bounty = BISON.bounty; eBison.armor = BISON.armor;

  // enemy APC, mid-FERRY, loose riders
  const eApc = addBody(world11, { kind: "vehicle", team: 2, mass: APC.mass, hx: APC.hx, hy: APC.hy, hz: APC.hz,
    x: 20, y: APC.hy + 0.05, z: 40, hp: APC.hp, friction: 0.85 });
  eApc.vtype = "apc"; eApc.apcSeq = 2; eApc.drv = "apc"; eApc.depotDrive = "auto"; eApc.order = "move";
  eApc.dest = { x: 15, z: 10 }; eApc.tracks = "careful"; eApc.homeX = 20; eApc.homeZ = 40; eApc.ferry = "out";
  const er1 = addBody(world11, { kind: "unit", team: 2, mass: 70, hx: 0.24, hy: 0.8, hz: 0.24, x: 20, y: -60, z: 40, hp: 44 });
  const er2 = addBody(world11, { kind: "unit", team: 2, mass: 70, hx: 0.24, hy: 0.8, hz: 0.24, x: 20, y: -60, z: 40, hp: 44 });
  er1.riding = true; er1.pinned = true; er1.rideApc = 2;
  er2.riding = true; er2.pinned = true; er2.rideApc = 2;

  // a garrisoned man
  const gMan = addBody(world11, { kind: "unit", team: 2, mass: 70, hx: 0.24, hy: 0.8, hz: 0.24, x: 30, y: 0.88, z: 60, hp: 44 });
  gMan.hold = true; gMan.garrison = true;

  // the flare eye — a _dieT flag body, live at save time
  const eye = addBody(world11, { kind: "flag", team: 1, mass: 0, hx: 0.05, hy: 0.05, hz: 0.05, x: 5, y: 2.5, z: 5 });
  eye.sleeping = true; eye._dieT = world11.t + FLARE_S;

  const T11 = makeTerritory(5, 5);
  const S11 = {
    bell: 7, resources: 300, kills: 12, spawnRR: 2, started: true, mode: null, sandbagOrient: 0,
    nextSquadId: 2, zoom: 1, focus: { x: 0, z: 0 }, depotCensusAcc: 0, depotStanding: 1, enemyStanding: 1,
    starvedStreak: 0, _reportedBreak: false, _reportedSpent: false,
    cmdr: "bold", // P7 T8's doctrine
    manifest: { unlocked: PLAYER_START.slice().concat(["hero_bison", "hero_apc"]), offers: [], offerBell: 0, cardUp: false, armedAt: 0 },
    foe: { unlocked: ["hero_bison", "hero_apc"] },
    intelUp: false, intelArmedAt: 0, lastDispatch: null, pendingPlan: null, intelPlan: null,
    ws: {}, reg: {},
    squads: [sq1],
    mines: [
      { x: 1.2345, z: -3.4, team: 1, kind: "mine", live: true },
      { x: 5, z: 5, team: 2, kind: "mine", live: false },
      { x: -2, z: 8, team: 1, kind: "wire", live: false },
      { x: 9, z: -1, team: 2, kind: "wire", live: true },
    ],
    // a mid-possession save — the pinned law: this must never ride
    possess: { kind: "vehicle", id: pBison.id },
  };

  const json11 = serializeFront({ S: S11, world: world11, T: T11, town: [], census: [], census2: [], rocks: [], smears: [], mapSeed: 1, rngSeed: 1 });
  const parsed11 = parseFront(json11);
  ok("T11(0): the P7-comprehensive save round trip parses back", parsed11.ok, parsed11.reason);
  ok("T11(0b): a mid-possession save never writes \"possess\" anywhere in the file (S.possess is not read by serializeFront)",
    !json11.includes("possess"));

  const world11b = makeWorld({ field: makeField(9, 2.0, 1101), seed: 1101 });
  world11b.t = parsed11.ok ? parsed11.data.world.t : 0; // the boot order (DepotGame.jsx): world.t set BEFORE restoreBodies
  const bodies11 = parsed11.ok ? restoreBodies(world11b, parsed11.data, []) : [];
  if (parsed11.ok) restoreWelds(world11b, parsed11.data, bodies11);
  const squads11 = parsed11.ok ? restoreSquads(parsed11.data, bodies11) : [];

  const rBison = bodies11.find((b) => b.kind === "vehicle" && b.team === 1 && b.vtype === "bison");
  const rApc = bodies11.find((b) => b.kind === "vehicle" && b.team === 1 && b.vtype === "apc");
  const rEBison = bodies11.find((b) => b.kind === "vehicle" && b.team === 2 && b.vtype === "bison");
  const rEApc = bodies11.find((b) => b.kind === "vehicle" && b.team === 2 && b.vtype === "apc");
  const rRiders1 = bodies11.filter((b) => b.kind === "unit" && b.team === 1 && b.riding);
  const rRiders2 = bodies11.filter((b) => b.kind === "unit" && b.team === 2 && b.rideApc != null);
  const rGarrison = bodies11.find((b) => b.kind === "unit" && b.team === 2 && b.garrison);
  const rEye = bodies11.find((b) => b.kind === "flag" && b._dieT != null);
  const rSq = squads11.find((s) => s.ridingIn === 1);

  // (1) player Bison, mid-PATROL
  ok("T11(1a): vtype rides", !!rBison && rBison.vtype === "bison");
  ok("T11(1b): drv rides", !!rBison && rBison.drv === "armor");
  ok("T11(1c): depotDrive rides", !!rBison && rBison.depotDrive === "auto");
  ok("T11(1d): order rides", !!rBison && rBison.order === "patrol");
  ok("T11(1e): dest rides", !!rBison && rBison.dest && Math.abs(rBison.dest.x - 12) < 0.001 && Math.abs(rBison.dest.z - (-30)) < 0.001);
  ok("T11(1f): tracks rides", !!rBison && rBison.tracks === "free");
  ok("T11(1g): homeX/homeZ ride", !!rBison && rBison.homeX === 0 && rBison.homeZ === -10);
  ok("T11(1h): armor rides", !!rBison && rBison.armor === BISON.armor);
  ok("T11(1i): _patA/_patB ride (flat objects)",
    !!rBison && rBison._patA && Math.abs(rBison._patA.x - 5) < 0.001 && rBison._patB && Math.abs(rBison._patB.z - (-30)) < 0.001);
  ok("T11(1j): _route does NOT survive — it re-derives, not carries", !!rBison && rBison._route === undefined);

  // (2)/(3) player APC + sealed squad
  ok("T11(2a): vtype rides", !!rApc && rApc.vtype === "apc");
  ok("T11(2b): apcSeq rides", !!rApc && rApc.apcSeq === 1);
  ok("T11(2c): drv/depotDrive/tracks ride", !!rApc && rApc.drv === "apc" && rApc.depotDrive === "auto" && rApc.tracks === "careful");
  ok("T11(2d): homeX/homeZ ride", !!rApc && rApc.homeX === 20 && rApc.homeZ === -10);
  ok("T11(3a): squad.ridingIn rides", !!rSq);
  ok("T11(3b): sealed riders restore riding/pinned", rRiders1.length === 2 && rRiders1.every((u) => u.riding === true && u.pinned === true));
  ok("T11(3c): sealed riders restore pinned at RIDE_Y (-60)", rRiders1.every((u) => Math.abs(u.pos.y - (-60)) < 0.001));
  ok("T11(3d): the squad's memberIds re-link to the restored riders",
    !!rSq && rSq.memberIds.length === 2 && rRiders1.every((u) => rSq.memberIds.indexOf(u.id) >= 0));

  // (4) enemy Bison, committed forward
  ok("T11(4a): committed rides", !!rEBison && rEBison.committed === 1);
  ok("T11(4b): order/dest ride", !!rEBison && rEBison.order === "move" && rEBison.dest && rEBison.dest.x === 0 && rEBison.dest.z === 0);
  ok("T11(4c): bounty rides", !!rEBison && rEBison.bounty === BISON.bounty);
  ok("T11(4d): armor/homeX/homeZ ride", !!rEBison && rEBison.armor === BISON.armor && rEBison.homeX === 0 && rEBison.homeZ === 40);

  // (5) enemy APC, mid-FERRY + loose riders
  ok("T11(5a): the ferry string rides", !!rEApc && rEApc.ferry === "out");
  ok("T11(5b): apcSeq/order/dest ride", !!rEApc && rEApc.apcSeq === 2 && rEApc.order === "move" && rEApc.dest && Math.abs(rEApc.dest.x - 15) < 0.001);
  ok("T11(5c): loose riders restore riding/pinned/rideApc",
    rRiders2.length === 2 && rRiders2.every((u) => u.riding === true && u.pinned === true && u.rideApc === 2));
  ok("T11(5d): loose riders restore pinned at RIDE_Y (-60)", rRiders2.every((u) => Math.abs(u.pos.y - (-60)) < 0.001));

  // (6) mines: live and spent, both teams, both kinds
  const rmRows = parsed11.ok ? parsed11.data.run.mines.map((m) => ({ x: m.x, z: m.z, team: m.t, kind: m.k, live: !!m.l })) : [];
  ok("T11(6a): all four mine rows ride", rmRows.length === 4, rmRows.length);
  ok("T11(6b): a live player mine rides with its coordinates and live flag",
    rmRows.some((m) => m.team === 1 && m.kind === "mine" && m.live === true && Math.abs(m.x - 1.2345) < 0.001 && Math.abs(m.z - (-3.4)) < 0.001));
  ok("T11(6c): a spent enemy mine rides live:false", rmRows.some((m) => m.team === 2 && m.kind === "mine" && m.live === false));
  ok("T11(6d): a spent player wire rides live:false", rmRows.some((m) => m.team === 1 && m.kind === "wire" && m.live === false));
  ok("T11(6e): a live enemy wire rides live:true", rmRows.some((m) => m.team === 2 && m.kind === "wire" && m.live === true));

  // (7) the commander's doctrine
  ok("T11(7): S.cmdr rides its explicit channel", parsed11.ok && parsed11.data.run.cmdr === "bold");

  // (8) hold/garrison
  ok("T11(8a): hold rides", !!rGarrison && rGarrison.hold === true);
  ok("T11(8b): garrison rides", !!rGarrison && rGarrison.garrison === true);

  // (9) hero tags in both unlocked lists
  ok("T11(9a): a hero tag rides in S.manifest.unlocked", parsed11.ok && parsed11.data.run.manifest.unlocked.indexOf("hero_bison") >= 0);
  ok("T11(9b): a hero tag rides in S.foe.unlocked", parsed11.ok && parsed11.data.run.foe.unlocked.indexOf("hero_apc") >= 0);

  // (10) the flare eye — a _dieT flag body: decide whether it saves cleanly.
  // FINDING: _dieT is a plain finite number (not an id-bearing cache), and
  // world.t is restored verbatim (RES.world.t, law 2 in save.js) — so a
  // restored eye's _dieT stays a valid absolute sim-clock stamp against the
  // restored world.t. CHOICE: no exclusion. It rides the generic body sweep
  // like any other scalar and the burn-out math (stepMines' own
  // `world.t >= b._dieT`) still holds after resume.
  ok("T11(10a): the flare eye's _dieT rides (a plain finite number, not a cache)",
    !!rEye && Math.abs(rEye._dieT - 106) < 0.001);
  ok("T11(10b): world.t is restored verbatim, so the eye's burn-out math still holds after resume",
    parsed11.ok && Math.abs(world11b.t - 100) < 0.001 && !!rEye && rEye._dieT > world11b.t);
  {
    // prove the burn-out fires correctly post-restore: advance world11b.t
    // past _dieT and run stepMines' own reap pass — the eye must die.
    world11b.t = rEye._dieT + 0.01;
    stepMines(world11b, []);
    ok("T11(10c): the restored eye still burns out correctly at its _dieT", !world11b.byId.get(rEye.id));
  }

  // (11) mid-possession resumes to command view: the RES restore block
  // (DepotGame.jsx) never assigns S.possess from the file — the base S
  // object's possess:null is the only initializer, unconditional.
  const dsrc11 = fs.readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");
  const start11 = dsrc11.indexOf("const r = RES.run;");
  const end11 = dsrc11.indexOf("stateRef.current = S;");
  const resBlock11 = start11 >= 0 && end11 > start11 ? dsrc11.slice(start11, end11) : "";
  ok("T11(11a): the RES restore block source-extracts", resBlock11.length > 0);
  ok("T11(11b): the RES restore block never assigns S.possess (a mid-possession save resumes to command view)",
    !/S\.possess\s*=/.test(resBlock11));
  ok("T11(11c): the base S object initializes possess: null unconditionally (not gated on RES)",
    /possess: null, possessInput: null, joy: null,/.test(dsrc11));
}
// ==== end P7 T11 ==============================================================

// HOTFIX mk1.37 pin: every audio.js `.value = ` assignment is either fin()-wrapped
// or a bare numeric literal (regex /\.value = -?\d[\d.]*;/) — no raw computed
// expression reaches a WebAudio param unguarded.
{
  const audSrc = fs.readFileSync(new URL("../../src/platform/audio.js", import.meta.url), "utf8");
  const total = (audSrc.match(/\.value = /g) || []).length;
  const literal = (audSrc.match(/\.value = -?\d[\d.]*;/g) || []).length;
  const wrapped = (audSrc.match(/\.value = fin\(/g) || []).length;
  ok("HOTFIX mk1.37: audio.js .value = assignments are all fin()-wrapped or bare numeric literals",
    literal + wrapped === total, `total=${total} literal=${literal} fin=${wrapped}`);
}

// ==== P7 T22: THE SUITE SPLITS ===============================================
// Reorganization 5 of 5 (owner): per-era files behind a runner that keeps
// the gate command. The proof is the baseline: same pass count, same
// keystone, zero content changes.
{
  const rnSrc22 = fs.readFileSync(new URL("../depot-test.mjs", import.meta.url), "utf8");
  ok("T22(a): the runner is thin and keeps the name",
    /import\("\.\/tests\/01-engine-era\.mjs"\)/.test(rnSrc22) && !/PIN_HASH/.test(rnSrc22));
}

// ==== P7 T23: THE MANUAL LEARNS THE GROUND; THE TOUR RETURNS =================
{
  const fmSrc23 = fs.readFileSync(new URL("../../src/ui/FieldManual.jsx", import.meta.url), "utf8");
  const dgSrc23 = fs.readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");
  ok("T23(a): the mines card exists, verbatim, at its ruled seat",
    /\{ title: "THE GROUND BITES", body: "Sappers lay mines and tripwires along a tapped line\. Yours are invisible to them; theirs to you — always\. A tripwire's flare lights the fog\. A mine just waits\. Minefields are learned by loss, both ways\." \},/.test(fmSrc23));
  ok("T23(a2): the chain is eight cards in the ruled order",
    /YOUR ARMOR[\s\S]*?THE GROUND BITES[\s\S]*?THE BELL[\s\S]*?THE MARKET[\s\S]*?THE FALL/.test(fmSrc23) &&
    (fmSrc23.match(/\{ title: "/g) || []).length === 8);
  ok("T23(b): the manual carries its revision stamp", /export const MANUAL_REV = 2;/.test(fmSrc23));
  ok("T23(b2): the gate compares revisions and honors the legacy tick once",
    /r\.value === "off" \? 1 : parseInt\(r\.value, 10\)/.test(dgSrc23) && /seen >= MANUAL_REV/.test(dgSrc23));
  ok("T23(b3): the tick stores the revision it was ticked at", /window\.storage\.set\(MANUAL_KEY, String\(MANUAL_REV\)\)/.test(dgSrc23));
}
// ==== end P7 T23 =============================================================
// ==== end P7 T22 =============================================================

// ==== P7 T24: QUIET FRAMES, CLEAR YARDS ======================================
// The stutter's churn dies (one persistent pool, zero per-tick allocation);
// the yards open (wider parking, bag clearance for hull lanes).
{
  const rSrc24 = fs.readFileSync(new URL("../../src/render/renderer.js", import.meta.url), "utf8");
  const muSrc24 = fs.readFileSync(new URL("../../src/depot/muster.js", import.meta.url), "utf8");
  ok("T24(a): the pool is born lazily, once, beside the overlay's other lazies",
    /if \(!pathPool\) \{/.test(rSrc24) && /PATH_VERT_CAP/.test(rSrc24) && /lineDistance/.test(rSrc24));
  // T24(a2), amended (owner): the birth block (`if (!pathPool) { ... }`)
  // necessarily allocates — the assert now slices the HOT PATH after the
  // cursor grabs the born pool (`const P = pathPool;`) through the method's
  // own close, and requires zero `new` in that slice alone.
  {
    const cutStart = rSrc24.indexOf("const P = pathPool;");
    const cutEnd = cutStart >= 0 ? rSrc24.indexOf("\n    },\n", cutStart) : -1;   // named fit: the method's real close brace, verified live
    const hotSlice = cutStart >= 0 && cutEnd > cutStart ? rSrc24.slice(cutStart, cutEnd) : "";
    ok("T24(a2): setOrderPaths allocates nothing per call, after the pool is born",
      cutStart >= 0 && cutEnd > cutStart && !/\bnew\b/.test(hotSlice) && /setDrawRange\(/.test(hotSlice));
  }
  // T24 test scaffolding: local grid/hull fixtures, the same idiom T17(d)
  // uses in scripts/tests/08-debug-pass.mjs — lifted verbatim (this file
  // has no prior copy).
  const flatF24 = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (x, z, o) => { o.x = 0; o.y = 1; o.z = 0; return o; } };
  const mkGrid17 = (n) => {
    const cells = new Array(n * n);
    for (let i = 0; i < cells.length; i++) cells[i] = { blocked: false, terrain: false, ice: false, wallId: null, building: null, bTeam: 0, steep: false, drop: false, bag: null, bagId: null };
    const G = { cells, w: n, h: n, cs: 2,
      idx: (gx, gz) => gz * n + gx,
      inBounds: (gx, gz) => gx >= 0 && gx < n && gz >= 0 && gz < n,
      worldToGrid: (x, z) => ({ gx: Math.floor(x / 2) + (n >> 1), gz: Math.floor(z / 2) + (n >> 1) }),
      gridToWorld: (gx, gz) => ({ x: (gx - (n >> 1)) * 2 + 1, z: (gz - (n >> 1)) * 2 + 1 }) };
    G.cellAt = (x, z) => { const g = G.worldToGrid(x, z); return G.inBounds(g.gx, g.gz) ? cells[G.idx(g.gx, g.gz)] : null; };
    return G;
  };
  const armorAt17 = (w, x, z) => {
    const v = addBody(w, { kind: "vehicle", team: 1, mass: BISON.mass, hx: BISON.hx, hy: BISON.hy, hz: BISON.hz, x, y: BISON.hy + 0.05, z, hp: BISON.hp, friction: 0.85 });
    v.vtype = "bison"; v.drv = "armor"; v.depotDrive = "auto";
    return v;
  };
  // (b) the inflation: a one-cell bag gap is no lane; a three-cell gap drives
  {
    const G1 = mkGrid17(20);
    for (let gz = 0; gz < 20; gz++) if (gz !== 10) { const c = G1.cells[G1.idx(10, gz)]; c.bag = 1; c.bagId = 900 + gz; }
    const r1 = planRoute(G1, -9, 1, 9, 1, { hull: true, team: 1 });
    ok("T24(b): a one-cell bag doorway is no lane for a hull", !r1 || !r1.reached);
    const G3 = mkGrid17(20);
    for (let gz = 0; gz < 20; gz++) if (gz < 9 || gz > 11) { const c = G3.cells[G3.idx(10, gz)]; c.bag = 1; c.bagId = 900 + gz; }
    const r3 = planRoute(G3, -9, 1, 9, 1, { hull: true, team: 1 });
    ok("T24(b2): a three-cell gap drives", !!r3 && r3.reached === true);
    const rF = planRoute(G1, -9, 1, 9, 1);
    ok("T24(b3): men still walk the one-cell gap", !!rF && rF.reached === true);
  }
  // (c) the parking: wider ring, bag standoff in the vetting
  ok("T24(c): the ring starts wider", /for \(let rr = 15; rr <= 30; rr \+= 1\.5\)/.test(muSrc24));
  ok("T24(c2): the vetting stands off further", /slotBlockedPublic\(world, bx, bz, Math\.hypot\(spec\.hx, spec\.hz\) \+ 2\.5\)/.test(muSrc24));
  // (d) the yard, proven: across 40 real maps, every parked hull's nearest
  // bag gap clears 1.5m and a MOVE order's first route is never null
  {
    let worstGap = 1e9, nullRoutes = 0;
    for (let s = 0; s < 40; s++) {
      const seed = 7000 + s;
      makeMap(seed);
      const field = makeField(181, 2.0, MAP_SEED);
      buildDepotTerrain(field, MAP_SEED);
      const grid = makeGrid(field);
      const world = makeWorld({ field, seed: MAP_SEED });
      world._tdStruct = true;
      world.depotCombat = true;
      world.pondAt = (x, z) => !!pondAt(x, z);
      world.inRim = (x, z) => { const c = invW(x, z); return Math.abs(c.u) <= RIM_HALF_U && Math.abs(c.v) <= RIM_HALF_V; };
      world.streamAt = (x, z) => streamAt(x, z);
      const stampBag = (b, side) => {
        b.bagSide = side;
        const cell = grid.cellAt(b.pos.x, b.pos.z);
        if (cell) { cell.bag = side; cell.bagId = b.id; }
      };
      for (const t of TOWN) {
        const hx = (t.nx * MASON.pitch) / 2, hz = (t.nz * MASON.pitch) / 2;
        for (let gz = 0; gz < grid.h; gz++) for (let gx = 0; gx < grid.w; gx++) {
          const wp = grid.gridToWorld(gx, gz);
          if (Math.abs(wp.x - t.x) < hx + 1.0 && Math.abs(wp.z - t.z) < hz + 1.0) {
            if (Math.hypot(wp.x - OBJ_POS.x, wp.z - OBJ_POS.z) < 5) continue;
            const c = grid.cells[grid.idx(gx, gz)];
            c.blocked = true; c.building = t.id; c.bTeam = t.team === 2 ? 2 : (t.depot ? 1 : 0);
          }
        }
      }
      const depotP = TOWN.find((t) => t.depot && t.team !== 2), depotE = TOWN.find((t) => t.depot && t.team === 2);
      seedBags(world, grid, depotP, 0x5ba6, stampBag);
      seedBags(world, grid, depotE, 0x5ba7, stampBag);
      let apcSeqN = 0;
      const nextApcSeq = () => ++apcSeqN;
      parkArmor(world, grid, field, depotP, 1, "bison", nextApcSeq);
      parkArmor(world, grid, field, depotP, 1, "apc", nextApcSeq);
      parkArmor(world, grid, field, depotE, 2, "bison", nextApcSeq);
      parkArmor(world, grid, field, depotE, 2, "apc", nextApcSeq);
      const bags = world.bodies.filter((b) => b.kind === "chunk" && b.sandbag && b.alive);
      for (const hull of world.bodies) {
        if (hull.kind !== "vehicle" || hull.team !== 1 || !hull.alive) continue;
        for (const b of bags) {
          const d = Math.hypot(hull.pos.x - b.pos.x, hull.pos.z - b.pos.z);
          const gap = d - Math.hypot(hull.hx, hull.hz) - Math.hypot(b.hx, b.hz);
          if (gap < worstGap) worstGap = gap;
        }
        const r = planRoute(grid, hull.pos.x, hull.pos.z, OBJ_POS.x, OBJ_POS.z, { hull: true, team: 1 });
        if (!r) nullRoutes++;
      }
    }
    ok("T24(d): no parked hull touches the bag ring (worst gap >= 1.5m)", worstGap >= 1.5, worstGap.toFixed(2));
    ok("T24(d2): every yard has a first route out", nullRoutes === 0, nullRoutes);
  }
  // (e) no route means STAND: a hull whose plan comes back null holds its
  // ground alive — the blind fallback is dead
  {
    const w = makeWorld({ field: flatF24, seed: 61 });
    const G = mkGrid17(20);
    for (let gz = 0; gz < 20; gz++) for (let gx = 0; gx < 20; gx++)
      if (Math.abs(gx - 10) > 1 || Math.abs(gz - 10) > 1) G.cells[G.idx(gx, gz)].steep = true; // an island
    const v = armorAt17(w, 1, 1);
    v.order = "move"; v.dest = { x: -15, z: -15 };
    const x0 = v.pos.x, z0 = v.pos.z;
    for (let i = 0; i < 10 * 120; i++) { w.t += w.dt; stepDrivers(w, G, identFwdDir, null); stepWorld(w); }
    ok("T24(e): the road-less hull stands, alive", v.alive === true && Math.hypot(v.pos.x - x0, v.pos.z - z0) < 2, `${v.pos.x},${v.pos.z}`);
    ok("T24(e2): it never took the blind goal", v.goal == null || Math.hypot(v.goal.x - -15, v.goal.z - -15) > 1);
  }
  // (f) the turn-around brakes: full speed with the goal behind — the hull
  // slows before it steers, and never rolls
  {
    const w = makeWorld({ field: flatF24, seed: 62 });
    const G = mkGrid17(20);
    const v = armorAt17(w, 0, -10);
    v.order = "move"; v.dest = { x: 0, z: 30 };
    for (let i = 0; i < 3 * 120; i++) { w.t += w.dt; stepDrivers(w, G, identFwdDir, null); stepWorld(w); } // build speed north
    v.dest = { x: 0, z: -30 }; v._route = null; v._routeDest = null;  // the U-turn order
    let minUp = 1;
    for (let i = 0; i < 6 * 120; i++) { w.t += w.dt; stepDrivers(w, G, identFwdDir, null); stepWorld(w); if (v.R[4] < minUp) minUp = v.R[4]; }
    ok("T24(f): the U-turn never rolls the hull", v.alive === true && minUp > 0.7, minUp.toFixed(2));
  }
}
// ==== end P7 T24 =============================================================
