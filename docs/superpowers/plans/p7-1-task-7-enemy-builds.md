# P7.1 Task 7 — His shovels dig (mk1.71)

The enemy's engineers build (owner, 2026-08-19: "he can do anything I can do — that includes building defenses"). His engineer pick becomes a real team-2 squad; each bell, on two seeded draws, an idle engineer squad of his gets a sandbag or wall line on his held ground and lays it through the SAME two-point machinery the player's engineers use — the machinery learns its side. His walls emit red, join the shared market, fall to the same support rule, and his squads ride the save. Tower placement stays at Enemy Front.

**One task by the owner's word** (2026-08-19). Suggested model: **Sonnet** — every parameterization is written below; the agent runs an internal suite checkpoint after the machinery steps before wiring the brain.

*Revised 2026-08-19, before approval, off the orchestrator's full read: the assault-timeout sweep would have deleted his squads (Step 2 gains the fix); his squad men now carry `tag: "eng"` so the market prices them into the engineer family (Step 5); the license's "T21 64-draw pin" was a phantom — the live pin is a floor and never moves; seed 4242's mirror draws are pre-computed (the engineer pick IS among them — one garrison pin re-teaches 4 → 2); every line anchor re-verified against the live tree.*

## The draw arithmetic

- Boot: unchanged, 7 draws.
- Per bell: +2 UNCONDITIONAL draws (the line roll, the place roll — the T8 ferry / T10 mine pattern), drawn every bell whether or not he builds. NO live pin counts per-bell draws to the digit: the T21 two-bell fixture asserts a FLOOR (`draws - d0 >= 16`) and stands unmoved at +2/bell — the new pair is pinned by source shape instead (Step 12, the T10(d11) precedent). The keystone must NOT move (its fixture rings no bells) — keystone movement is a defect, STOP.
- Seed 4242 pre-computed (the boot fixtures' seed): the four mirror draws are sq_mortars, rocket, sq_engineers, mg — all distinct, commander "bold", 5 boot draws. The engineer pick IS among them, so Step 5 turns its two garrison men into squad members: 09-reorg T19(b3) re-teaches `guard === 4` → `guard === 2` (the mortar pair alone garrisons; licensed below). T19(b)/(b2)/(b4)/(b5) and every 10-command-refit T6v2 pin stand unmoved (a squad muster is draw-free).
- The line roll doubles as the kind pick (a derived fraction, no third draw): `(lineRoll * 10) % 1 < 0.35` → walls, else bags. All dials provisional (F5).

## Stated lines

- Scope: his engineers lay BAGS and WALLS only (mines/wires stay sapper work; his sappers already seed mines by their own T10 brain).
- His squad pays the SAME field prices off the shared market table, from `reg.scrap`, per piece at lay time; a broke regiment's line goes dry exactly as the player's does. The bell gate refuses to start a line he cannot roughly afford (~6 pieces).
- His line's shape: 12m, laid ACROSS the advance axis (constant canonical v), centered on a drawn spot on HIS held ground (territory `v < -0.15`) within 50m of his depot; the PASSES on his half are the fallback pool. Deterministic pick by the place roll.
- One line at a time per squad (`_build` busy-flag); the squad walks there on the real routing and digs in at the far end like any engineer.
- His engineer squad members are squad-driven: `stepUnits` learns to skip squad-owned team-2 men (`u.squadId`), and the foe-squad loop uprights them (the player-squad precedent).
- HIS SQUADS ARE NOT WAVE STOCK: the assault-timeout sweep (`executeWithdrawal`, state.js) deletes every live team-2 man without a garrison/armor/rider flag — it learns to skip squad-roster men (`b.squadId`), or his engineers die ~75 seconds after every spent assault. The garrison flag is deliberately NOT used for this: ringBell's home-guard block counts `b.garrison` toward HOME_GUARD_CAP, and squad members would wrongly fill the cap.
- His squad men carry `tag: "eng"`, stamped at muster: marketCounts prices team-2 men by tag, and untagged squad members would count into the RIFLES family instead of engineer — the one-shared-table law to the letter.
- The player can select and order NOTHING of his: `squadAtPoint` scans `S.squads` only; his roster is `S.foeSquads`.
- His walls: red territory emitters (one per wall, bottom course), both-team market counting, the standing support rule, breakable/rammable/sappable through `hostileStructure(b, 1)` which has been F3-ready since FRONT F1. His bags: `bagSide 2`, red emitters by side, rammable by the player under the standing ruling.
- Save: `foeSquads` rides beside `squads` with the same serializer; a half-laid line resets on resume (the player precedent, ratified at mk0.60).
- No engine (`core.js`) or renderer edits anywhere in this task.

## Required reading, in order

1. This plan, whole.
2. `src/depot/buildlines.js` — whole (the machinery learning its side).
3. `src/depot/state.js:56-131` (validatePlacement, costs), `:226-256` (spawnWallCourses), `:709-741` (spawnSquadMembers), `:763-775` (spawnSandbag), `:1503-1523` (executeWithdrawal — the sweep that learns to skip his squads).
4. `src/depot/territory.js` — whole (canBuildFor lands here).
5. `src/depot/bell.js` — whole (the brain lands after the mine seeding).
6. `src/depot/ai.js:264-327` (the T8 pure-decider precedent, homeShare through flankDrop; the new deciders land at the END of this file, after the T8 block — the mine deciders live in mines.js, not here).
7. `src/depot/muster.js` — the mirror's eng branch (becomes a squad).
8. `src/depot/units.js:458-465` (the team-2 loop head — the squadId skip goes directly after `:461`).
9. `src/depot/DepotGame.jsx:456-547` (stepDepot's squad block — the foe loop lands after its closing brace, before the possession-tower check at `:549`), `:1018-1048` (buildEmitters), `:1881-1883` (layCtx/S.stepBuildLine), `:1279-1307` (the RES restore block), `:1177-1268` (the S literal).
10. `src/depot/market.js:34-70` (FAMILY_OF_TAG + marketCounts — why his men need the tag; the wall count widens), `src/depot/save.js:226-236, 356-366` (the squad serializer and restoreSquads).
11. `scripts/tests/09-reorg.mjs:66-83` (the T19 boot fixture — the garrison pin that re-teaches 4 → 2), `:181-215` (the T21 two-bell fixture — the `>= 16` draw FLOOR, which never moves), `:107-162` (the T20 build fixture — the enemy end-to-end mirrors it).
12. `scripts/tests/10-command-refit.mjs` — tail.

## The sweep license

- ONE licensed movement, pre-computed to the digit: 09-reorg T19(b3) `guard === 4` → `guard === 2` (seed 4242's engineer pick musters a squad; its two men leave the garrison count). Reported old → new.
- NO draw-count pin moves: the T21 two-bell fixture is a floor (`>= 16`) and stands at +2/bell; the T10(d11)-family pins are source shapes the task never touches. A draw-count pin actually failing is NOT licensed — stop and report.
- The KEYSTONE is NOT licensed — if it moves, stop and report.
- Anything else failing: STOP.

## Steps

**Step 1 — territory.js: ground rights learn the asker.** Below `canBuild`:

```js
// P7.1 T7: the same rights, either side — his engineers build on HIS ground.
export function canBuildFor(T, x, z, team) { return holderAt(T, x, z) === team; }
```

**Step 2 — state.js: the spawners learn their side.**

- `spawnWallCourses(world, x, groundY, z, orient = 0, team = 1)` — the addBody's `team: 1` becomes `team`. Every existing caller is unchanged by the default.
- `spawnSandbag(world, x, z, orient = 0, team = 1)` — same, one token.
- `spawnSquadMembers`: the addBody's `team: 1` becomes `team: squad.team || 1`. (Dress, smear, maxHp, roles unchanged — troopkit already coats by team.)
- `executeWithdrawal`: directly after the starting-armor/garrison skip (`if (b.vtype === "bison" || b.vtype === "apc" || b.garrison) continue;`) add:

```js
    if (b.squadId != null) continue; // P7.1 T7: squad-roster men are not wave stock — the timeout sweep must never delete his engineer squads
```

  Zero behavior change today — no team-2 body carries `squadId` until Step 5 — so the keystone cannot move on it.

**Step 3 — buildlines.js: the job carries its side.**

- `startBuildLine(grid, sq, kind, a, b, toast, team = 1)` — the job literal gains `team,`.
- `layPieceAt`: at its top add `const team = job.team || 1;`; the import line swaps `canBuild` for `canBuildFor`; the two `validatePlacement` calls' `held:` become `canBuildFor(T, c0.u, c0.v, team)`; the walls branch's `cell.bTeam = 1` becomes `= team` and `spawnWallCourses(world, row.x, ..., orient)[0]` gains `, team`; the bags branch becomes `ctx.stampBag(spawnSandbag(world, row.x, row.z, orient, team), team);`.
- `linePieces` (the preview) keeps `canBuild` — the proposed-line ghost is player-side interface; his lines never preview. Import both.

**Step 4 — ai.js: the pure deciders** (the T8/T10 pattern; they land at the END of ai.js, after the T8 block — ai.js has no mine block, the mine deciders live in mines.js):

```js
// ==== P7.1 T7: HIS SHOVELS ===================================================
// Two unconditional draws per bell (the ferry/mine law). The gate is pure;
// the kind is a derived fraction of the same roll — no third draw.
export function engBuildDecide(roll, hasIdleEng, scrap, estCost) {
  return roll < 0.6 && hasIdleEng && scrap >= estCost; // provisional (F5)
}
export function engBuildKind(roll) {
  return (roll * 10) % 1 < 0.35 ? "walls" : "bags"; // provisional (F5)
}
export function engSeedPlace(cands, roll) {
  if (!cands || !cands.length) return null;
  return cands[Math.min(cands.length - 1, Math.floor(roll * cands.length))];
}
```

**Step 5 — muster.js: his engineer pick musters a squad.** In the mirror spawn loop, before the man loop, add an eng branch (and `makeSquad` is already imported; `spawnSquadMembers` imports from state.js):

```js
    if (pick.tag === "eng") {
      // P7.1 T7: his engineers are a real squad — the build driver runs them.
      const a0 = (mi / 16) * Math.PI * 2 + 2.0;
      const p0 = clearSlot(world, depotE.x + Math.sin(a0) * gR, depotE.z + Math.cos(a0) * gR, 0.5);
      const sq = makeSquad(9000 + mi, "engineers", 2, p0.x, p0.z);
      spawnSquadMembers(world, sq);
      for (const id of sq.memberIds) world.byId.get(id).tag = "eng"; // the market's family key (marketCounts prices team-2 men by tag)
      (S.foeSquads || (S.foeSquads = [])).push(sq);
      mi += 2;
      continue;
    }
```

(The Task 6 loose-eng stand branch in units.js stays — harmless, and loose engineers may exist in old fixtures.)

**Step 6 — units.js: squad-owned men are squad-driven.** In stepUnits' team-2 loop, directly after the `if (u.kind !== "unit" || !u.alive || u.team !== 2) continue;` line:

```js
    if (u.squadId) continue; // P7.1 T7: his squad men take squad goals, not the flow
```

**Step 7 — DepotGame: the foe roster.**

- The S literal gains `foeSquads: [],` beside `squads: [],`.
- The RES restore block (after `S.squads = restoreSquads(RES, resBodies);`) gains:

```js
        S.foeSquads = RES.foeSquads ? restoreSquads({ squads: RES.foeSquads }, resBodies) : [];
```

- After the player-squad block in stepDepot (after its closing brace, before the possession-tower check), add:

```js
  // P7.1 T7: HIS SQUADS — the enemy's engineer roster, squad-driven like the
  // player's (routing, legs, the build driver), never tappable (squadAtPoint
  // scans S.squads alone). Engineers fire nothing; no squadFire call.
  if (S.foeSquads && S.foeSquads.length) {
    S.foeSquads = pruneSquads(world, S.foeSquads);
    for (const sq of S.foeSquads) {
      stepSquadRouting(grid, sq, world);
      stepSquad(world, sq, world.dt);
      if (sq._build && S.stepFoeBuildLine) S.stepFoeBuildLine(sq);
      for (const id of sq.memberIds) {
        const u = world.byId.get(id);
        if (u && u.alive) uprightMember(u, world.dt);
      }
    }
  }
```

- Beside `S.stepBuildLine` (line ~1883), the foe driver — the payer façade maps his books:

```js
      // P7.1 T7: the enemy's build driver — same machinery, his books. The
      // façade carries reg.scrap through S-shaped fields and settles after.
      S.stepFoeBuildLine = (sq) => {
        const SE = { resources: S.reg.scrap, mines: S.mines, sandbagOrient: 0, _market: S._market, _minePrices: S._minePrices };
        stepBuildLine(world, grid, field, T, SE, sq, { stampBag, recomputeFlow, objG, setMines: (m) => R.setMines(m) }, () => {});
        S.reg.scrap = SE.resources;
      };
```

- buildEmitters: the wall clause gains an enemy twin and the bag clause reads its side:

```js
          else if (b.kind === "wall" && b.team === 2 && b.alive && !b.course) { const c = invW(b.pos.x, b.pos.z); out.push({ x: c.u, z: c.v, w: EMIT.wall.w, r: EMIT.wall.r, sign: -1 }); }
```

  and the sandbag clause's `sign: 1` becomes `sign: b.bagSide === 2 ? -1 : 1`.

**Step 8 — bell.js: the brain.** Imports gain `engBuildDecide, engBuildKind, engSeedPlace` (ai.js), `startBuildLine` (buildlines.js), `fieldPrices` (market.js), `WALL_FIELD_COST, SANDBAG_FIELD_COST` (state.js). Directly AFTER the mine-seeding block's closing brace:

```js
  // P7.1 T7: HIS SHOVELS — two draws every bell (the law); a committed roll
  // sends an idle engineer squad to lay a line on his held ground, paid off
  // the same market table at lay time.
  {
    const lineRoll = world.rng(), placeRoll = world.rng();
    const eng = (S.foeSquads || []).find((q) => q.type === "engineers" && !q._build &&
      q.memberIds.some((id) => { const u = world.byId.get(id); return u && u.alive; }));
    const fp2 = S._market ? fieldPrices(S._market.counts, WALL_FIELD_COST, SANDBAG_FIELD_COST) : { wall: WALL_FIELD_COST, bag: SANDBAG_FIELD_COST };
    const kind2 = engBuildKind(lineRoll);
    const est = 6 * (kind2 === "walls" ? fp2.wall : fp2.bag);
    if (engBuildDecide(lineRoll, !!eng, S.reg.scrap, est)) {
      const depotE6 = TOWN.find((tt) => tt.depot && tt.team === 2);
      const cands = [];
      for (let iz3 = 0; iz3 < T.nz; iz3 += 4) for (let ix3 = 0; ix3 < T.nx; ix3 += 4) {
        if (T.v[iz3 * T.nx + ix3] >= -0.15) continue; // his ground only
        const w3 = fwdU(-T.halfU + (ix3 + 0.5) * T.cs, -T.halfV + (iz3 + 0.5) * T.cs);
        if (depotE6 && Math.hypot(w3.x - depotE6.x, w3.z - depotE6.z) > 50) continue;
        cands.push({ x: w3.x, z: w3.z });
      }
      if (!cands.length) for (const band of PASSES) for (const g of band) { const c = invW(g.x, g.z); if (c.v < 0) cands.push({ x: g.x, z: g.z }); }
      const spot = engSeedPlace(cands, placeRoll);
      if (spot && eng) {
        const cs2 = invW(spot.x, spot.z);
        const a2 = fwdU(cs2.u - 6, cs2.v), b3 = fwdU(cs2.u + 6, cs2.v);
        startBuildLine(grid, eng, kind2, { x: a2.x, z: a2.z }, { x: b3.x, z: b3.z }, () => {}, 2);
      }
    }
  }
```

**Step 9 — market.js: his walls join the market.** The wall clause drops its team check: `else if (b.kind === "wall" && !b.course) add("wall", 1);` — one family, both armies' standing stock (the mk1.13 law, finally whole).

**Step 10 — save.js: the roster rides.** Factor the squad row-mapper into `const squadRow = (sq) => { ... };` (the existing map body verbatim) used by `squads: S.squads.map(squadRow),` and add `foeSquads: (S.foeSquads || []).map(squadRow),` to the data literal.

**Step 11 — the internal checkpoint + the one licensed re-teach.** Run `node scripts/depot-test.mjs` NOW, before Step 12. Expected: exactly ONE movement — 09-reorg T19(b3) `guard === 4` fails, because seed 4242's engineer pick now musters a squad and its two men leave the garrison count (pre-computed above). Re-teach it to `guard === 2`, label it `re-taught P7.1 T7`, report old → new. Everything else must hold the existing 1427 green — no draw-count pin moves (the T21 floor stands). Any other movement: STOP.

**Step 12 — the asserts** (appended to `10-command-refit.mjs`; imports gain `canBuildFor` (territory.js), `engBuildDecide, engBuildKind, engSeedPlace` (ai.js), `executeWithdrawal, spawnWallCourses, hostileStructure` (join the state.js import line), `marketCounts` (market.js); `startBuildLine, stepBuildLine, makeSquad, spawnSquadMembers, addBody, fs` are already imported):

```js
// ---- P7.1 T7: HIS SHOVELS DIG
{
  const T7 = makeTerritory(90, 90); T7.v.fill(-1); // all his ground
  ok("T7: ground rights know the asker", canBuildFor(T7, 0, 0, 2) === true && canBuildFor(T7, 0, 0, 1) === false);
  const w = makeWorld({ field: flatF, seed: 71 }); w.depotCombat = true;
  const G7 = mkGridA();
  const sq = makeSquad(9001, "engineers", 2, -5, 1);
  spawnSquadMembers(w, sq);
  ok("T7: his engineer squad's men are team 2", sq.memberIds.every((id) => w.byId.get(id).team === 2));
  const SE = { resources: 300, mines: [], sandbagOrient: 0, _market: null, _minePrices: null };
  const ctx7 = { stampBag: (b, s) => { b.bagSide = s; }, recomputeFlow: () => {}, objG: { gx: 10, gz: 19 }, setMines: () => {} };
  startBuildLine(G7, sq, "bags", { x: -5, z: 1 }, { x: 5, z: 1 }, () => {}, 2);
  sq.order = "defend"; sq.dest = null;
  stepBuildLine(w, G7, flatF, T7, SE, sq, ctx7, () => {});
  const m7 = sq.memberIds.map((id) => w.byId.get(id));
  m7[0].pos.x = -2.5; m7[0].pos.z = 2; m7[1].pos.x = 2.5; m7[1].pos.z = 2;
  sq.anchor = { x: 5, z: 1 }; sq.order = "defend";
  for (let i = 0; i < 80; i++) { sq._pauseT = 0; stepBuildLine(w, G7, flatF, T7, SE, sq, ctx7, () => {}); if (!sq._build) break; }
  const bags7 = w.bodies.filter((b) => b.sandbag && b.alive);
  ok("T7: his line laid real bags on his own ground", bags7.length >= 3 && bags7.every((b) => b.bagSide === 2), bags7.length);
  ok("T7: his books were charged", SE.resources < 300, SE.resources);
  ok("T7: his ground refused the player the same tap", canBuildFor(T7, 1, 1, 1) === false);
}
{
  const w = makeWorld({ field: flatF, seed: 72 });
  const courses = spawnWallCourses(w, 0, 0, 0, 0, 2);
  ok("T7: his wall stands as team 2 and is the player's lawful target", courses.length === 3 && courses.every((c) => c.team === 2) && hostileStructure(courses[0], 1));
  ok("T7: the deciders hold the line", engBuildDecide(0.5, true, 100, 30) === true && engBuildDecide(0.7, true, 100, 30) === false && engBuildDecide(0.5, false, 100, 30) === false && ["bags", "walls"].includes(engBuildKind(0.5)) && engSeedPlace([{ x: 1 }, { x: 2 }], 0.9).x === 2);
}
{
  // the withdrawal law: the timeout sweep spares his squads, takes wave stock
  const w = makeWorld({ field: flatF, seed: 73 });
  const sq = makeSquad(9002, "engineers", 2, 0, 0);
  spawnSquadMembers(w, sq);
  for (const id of sq.memberIds) w.byId.get(id).tag = "eng";
  const loose = addBody(w, { kind: "unit", team: 2, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x: 5, y: 0.88, z: 5, hp: 58 });
  const S7b = { reg: { heads: 0, tanks: 0 }, ws: {} };
  executeWithdrawal(S7b, w);
  ok("T7: the timeout sweep spares his squad and takes the wave man",
    sq.memberIds.every((id) => { const u = w.byId.get(id); return u && u.alive; }) && !w.byId.get(loose.id) && S7b.reg.heads === 1);
  ok("T7: his tagged men price into the engineer family, never rifles",
    (() => { const c = marketCounts(w, [], []); return c.engineer === 2 && !c.rifles; })());
}
{
  // the two new draws + the muster branch, pinned by source shape (the T10(d11) precedent)
  const be7 = fs.readFileSync("src/depot/bell.js", "utf8");
  ok("T7: TWO unconditional draws every bell (lineRoll, placeRoll — the law)",
    /const lineRoll = world\.rng\(\), placeRoll = world\.rng\(\);/.test(be7));
  ok("T7: his shovels ring after the sapper brain", be7.indexOf("THE ENEMY SAPPER BRAIN") < be7.indexOf("HIS SHOVELS"));
  const mu7 = fs.readFileSync("src/depot/muster.js", "utf8");
  ok("T7: the engineer pick musters a tagged squad", /if \(pick\.tag === "eng"\) \{/.test(mu7) && /\.tag = "eng";/.test(mu7));
}
```

**Step 13 — version.** `src/version.js`: `mk1.70` → `mk1.71`. Build AFTER the bump.

## Gates — run ONLY these

1. `node scripts/depot-test.mjs` — 0 failed; 12 new asserts, expected total 1439/0, reported exact. Licensed movement ONLY: T19(b3) guard 4 → 2 (pre-computed). No draw-count pin may move; the keystone moving is a DEFECT: stop.
2. `node scripts/smoke.mjs` — preview pattern, all green, mark mk1.71.
3. `node scripts/depot-lint.mjs` — clean (both new draws are world.rng, unconditional).

Green → commit `src/depot/territory.js`, `src/depot/state.js`, `src/depot/buildlines.js`, `src/depot/ai.js`, `src/depot/muster.js`, `src/depot/units.js`, `src/depot/DepotGame.jsx`, `src/depot/bell.js`, `src/depot/market.js`, `src/depot/save.js`, the re-taught test files, `scripts/tests/10-command-refit.mjs`, `src/version.js` — subject "his shovels dig: the enemy builds (mk1.71)" — standing trailers, push.

## Report requirements

Read-confirmation (twelve items), one outcome line, then bullets: each step; every re-teach old→new; each gate with exact counts; the internal checkpoint's result; commit hash. Every deviation its own labeled bullet. The owner's live acceptance: a war where his engineer draw comes up should, within a few bells, show red-held ground growing bag or wall lines — and your breakers, sappers, and STRUCTURES-toggled squads can tear them down.
