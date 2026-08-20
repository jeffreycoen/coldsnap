# P7.2 Task 7 — The Mechanic (mk1.88)

**Suggested model: Sonnet** (Task 6's exact shape plus the repair-payment path, fully specced).
**Scope (ruled 2026-08-19, both passes):** a new squad type, BOTH SIDES — the mechanic repairs MACHINES AND MASONRY: hulls, towers, walls, sandbags. Repair is SLOW, PAUSES UNDER FIRE, and PAYS SCRAP PER POINT off each side's own books — dear-to-replace keeps its teeth. Tier-3 row, ~55 scrap. He joins the hand's pool with his card and portrait. The pool grows SIXTEEN → SEVENTEEN — the Task 6 count sweep runs again over the same (now pre-known) sites. The enemy's mirror: mechanics arrive through its hand and the boot's dealt picks and repair its own iron off its own regiment books; they never march in waves (planWave untouched — the mg/engineer/medic precedent). Depot stones are structurally excluded (no hp ledger — the census is the depot's health, untouched). Zero rng anywhere; healing writes hp directly; the PAYMENT is the game layer's (a books callback stamped on the world at mount — squads.js's no-economy law holds, the module only asks).

**AMENDMENT 1 (2026-08-20, after the agent's honest stop at 1597/1598 — the plan-writer's defect, caught by the plan's own fixture):** the Step 3 payment code charged the books only when the fractional debt first crossed one whole scrap — every tick before that mended freely, so an empty till still bought ~6.6 hp of repair before the first refusal (measured 46.63 against the fixture's ≤41.01). The accounting flips to PRE-PAID WORK: the wrench buys credit ONE scrap at a time BEFORE it mends, so the very first point of work requires the books to answer and an empty till mends nothing from tick one. Same long-run rate, same charge cadence, the (b2) tolerance unchanged. The `_repairDebt` field becomes `_repairCredit`.

## Required reading (verified against the mk1.87 tree; re-verify at dispatch)

- `src/depot/squads.js` — 33–90 (SQUAD_SPECS with the medics row), 205–217, 786–860 (the shipped medic tend block and its A1 wrapper — the template this task mirrors), the DEFEND branch's `_tending` skip (shipped, generic — NO edit needed there).
- `src/depot/units.js` — the shipped medic branch in stepUnits and its neighbors (the mechanic branch lands directly after it).
- `src/depot/specs.js` — 164–190 (the tables with the sixteenth key in), ENEMY_SPECS with the medic row.
- `src/depot/muster.js` — PICK_POOL with the sq_medics row.
- `src/depot/market.js` — whole.
- `src/render/troopkit.js` — whole (the shipped MEDIC props/kit and the kneel line at ~146 — the mechanic extends the kneel condition and adds a kit; NO palette change, side coats stay).
- `src/depot/infocards.js` — whole.
- `src/depot/DepotGame.jsx` — the PALETTE block, SQUAD_MODE, the squad loop with the shipped medic call, and the mount's world-stamp neighborhood (`world.inRim = ` and its siblings — the books stamp lands beside them).
- Tests: `11-hiring-hall.mjs` whole (the T6 medic block's own count pins move this task); `01-engine-era.mjs` 109–241; `07-armor-demolition.mjs` line 873; `09-reorg.mjs` 62–84; `10-command-refit.mjs` line 276.

## The design, plainly

1. **The seventeenth key.** `sq_mechanics` joins every table exactly as the medic did: SQUAD_SPECS (`mechanics`, 2 men, 55 scrap), PALETTE (icon ⚙), SQUAD_MODE, HAND_KEYS, HAND_TAGS (`"mechanic"`), PICK_POOL, PLAYER_TIERS row 3 (the ruled tier-3 seat), ENEMY_SPECS (`mechanic`, bounty 8), the market (family `mechanic`, K 6, both sides counted together). Everything downstream inherits by construction.
2. **The repair loop — the tend template, three deltas.** `stepMechanicTend(world, u, ax, az, dt)` mirrors the medic's shipped helper with: (1) TARGETS — own-side vehicles, towers, walls (per course), and sandbags with an hp ledger below full (`maxHp != null` excludes depot stones by construction); work range is the target's own half-extent plus a pad, so a man can kneel at a hull's flank; (2) UNDER FIRE IT PAUSES — a fresh `dmgT` (the mk0.99 hit stamp) inside REPAIR_UNDERFIRE_S stands the mechanic down entirely (Task 5's reaction then covers him like any man); (3) EVERY POINT IS PAID — a fractional debt accumulator charges ONE scrap at a time through `world._mech.take(team, 1)` (the game layer's books callback); an empty till leaves him kneeling with a still wrench — unfunded repair does nothing, honestly. It shares `_tending`/`kneel`/`_kneltOnce` with the medic — the shipped defend-branch skip and the A1 wrapper shape carry over verbatim.
3. **The books wire.** One stamp at mount, beside the world's other game-layer stamps: team 1 pays `S.resources`, team 2 pays `S.reg.scrap`, one scrap per call, refuse when short. Bare fixtures without the stamp repair nothing — named, honest, and what the tests exploit.
4. **The look.** Side coats stay (no medic-style dress ruling — the white is the cross's alone): `KIT_MECHANIC` is no rifle plus a black TOOLBOX at the hip (the T6 prop-role machinery, role `"gun"`); the kneel line gains the mechanic; the portrait inherits. Golden required (troopkit is render-path). The owner's eye accepts or re-dials live.
5. **The card** (owner-approved copy, verbatim): *"Two mechanics with a toolbox. They kneel at broken machines and masonry — hulls, towers, walls, bags — and every point of repair is paid in scrap."* Skills: DEFEND, MOVE, PATROL, REPAIR — PAID IN SCRAP, TAKE CONTROL.
6. **Interaction checklist:** draw counts never move (movement = stop); the keystone never touches these paths — expected unmoved (843448507/749); `_repairDebt`/`_post`/`kneel`/`_tending` never ride the save (re-derive; the standing precedent); the hero dear-to-replace wall keeps its teeth by the cost dial (a full Bison repair ≈ 63 scrap of slow, interruptible work against a 200+ market-walled replacement — the ruled balance, provisional); the hotfix's affordability gate covers mechanic hires free.

Dials, all provisional (F5): MECH_SEEK_M 12, MECH_WORK_PAD 1.6, REPAIR_RATE 4 hp/s, REPAIR_COST_PER_HP 0.15, REPAIR_UNDERFIRE_S 4, squad 2 men at 55, family K 6, bounty 8.

## Sweep license (the seventeenth-key sweep — the Task 6 sites again, pre-named; count-neutral; anything beyond = honest stop)

- 11's T2(a) 16 → 17 (both terms, labels); T2(b5) `slice(0, 14)` → `slice(0, 15)`; T3(a3) 16 → 17; T4(a) 11 → 12 ("nine squads" → "ten squads"); **T6(a) — the medic task's own block** — `HAND_KEYS.length === 16` and `PICK_POOL.length === 16` → 17/17.
- 01 line 122 (16 → 17), 129 (16 → 17 + label), 131 (15 → 16), 135 (label only), 162 `slice(0, 15)` → `slice(0, 16)`.
- 07 line 873 (16 → 17 + label). 10 line 276 (16 → 17 both terms + label).
- Value-shift license (the standing precedent): fixed-seed deal/boot outcomes shift with the seventeenth key; 09's T19(b3) seed-91 guard (now 4) re-measures and re-bases old → new if moved; sibling property pins and every draw-count pin must hold. A draw-count movement is a stop.

## The steps

**Step 1 — the failing asserts.** Append to `scripts/tests/11-hiring-hall.mjs`. Import additions: `stepMechanicTend, stepMechanicTendSquad, REPAIR_RATE, REPAIR_COST_PER_HP` join the squads import (SQUAD_SPECS already there); `spawnWallCourses, spawnSandbag` join the state import; nothing else new (troopKit, CARDS, market, ENEMY_SPECS, HAND_TAGS all imported by prior blocks).

```js
// ---- P7.2 T7 (mk1.88): THE MECHANIC — the seventeenth key; the paid wrench
{
  // (a) the seventeenth key, every table
  ok("T7v2(a): the pool is seventeen and sq_mechanics is in every seat",
    HAND_KEYS.length === 17 && HAND_KEYS.includes("sq_mechanics") && PICK_POOL.length === 17 &&
    PICK_POOL.some((p) => p.key === "sq_mechanics" && p.kind === "squad" && p.type === "mechanics" && p.tag === "mechanic" && p.n === 2));
  ok("T7v2(a2): the tag map and the squad row — two men at 55, tag mechanic",
    HAND_TAGS.sq_mechanics === "mechanic" && SQUAD_SPECS.mechanics.n === 2 && SQUAD_SPECS.mechanics.cost === 55);
  ok("T7v2(a3): its side fields the same man — ENEMY_SPECS.mechanic, bounty 8", !!ENEMY_SPECS.mechanic && ENEMY_SPECS.mechanic.bounty === 8);
  // (b) the paid repair, player side — walk, kneel, mend a hull, the books charged
  {
    const w = makeWorld({ field: flatF, seed: 120 });
    let charged = 0;
    w._mech = { take: (team, n) => { if (team !== 1) return false; charged += n; return true; } };
    const sq = makeSquad(70, "mechanics", 1, 0, 0);
    spawnSquadMembers(w, sq);
    const hull = addBody(w, { kind: "vehicle", team: 1, mass: 3800, hx: 2.2, hy: 0.95, hz: 3.3, x: 7, y: 1.0, z: 0, hp: 200, friction: 0.85 });
    hull.maxHp = 420; hull.sleeping = true;
    for (let i = 0; i < 3600 && hull.hp < 320; i++) { stepSquad(w, sq, w.dt); stepMechanicTendSquad(w, sq, w.dt); stepWorld(w); }
    ok("T7v2(b): the mechanics walk out, kneel, and the hull mends", hull.hp > 300, hull.hp.toFixed(1));
    const healed = hull.hp - 200;
    ok("T7v2(b2): every point was paid — the books charged at the dial (±2 scrap of healed × cost)",
      Math.abs(charged - healed * REPAIR_COST_PER_HP) <= 2, `charged=${charged} healed=${healed.toFixed(1)}`);
    ok("T7v2(b3): they knelt to do it", sq.memberIds.some((id) => w.byId.get(id)._kneltOnce === true));
  }
  // (c) an empty till leaves the wrench still — kneeling, mending nothing
  {
    const w = makeWorld({ field: flatF, seed: 121 });
    w._mech = { take: () => false };
    const m = addBody(w, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x: 3, y: 0.74, z: 0, hp: 58 });
    m.maxHp = 58; m.utype = "mechanics";
    const tw = addBody(w, { kind: "tower", team: 1, mass: 0, hx: 0.8, hy: 1.0, hz: 0.8, x: 0, y: 1.0, z: 0, hp: 40 });
    tw.maxHp = 80;
    for (let i = 0; i < 1200; i++) { stepMechanicTend(w, m, 0, 0, w.dt); stepWorld(w); }
    ok("T7v2(c): unfunded repair does nothing — hp within a whole point of where it started, the man kneeling",
      tw.hp < 41.01 && m.kneel === true, tw.hp.toFixed(2));
  }
  // (d) under fire the work pauses entirely
  {
    const w = makeWorld({ field: flatF, seed: 122 }); w.depotCombat = true;
    w._mech = { take: () => true };
    const m = addBody(w, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x: 1.5, y: 0.74, z: 0, hp: 58 });
    m.maxHp = 58; m.utype = "mechanics";
    const tw = addBody(w, { kind: "tower", team: 1, mass: 0, hx: 0.8, hy: 1.0, hz: 0.8, x: 0, y: 1.0, z: 0, hp: 40 });
    tw.maxHp = 80;
    w.t = 10; m.dmgT = w.t; // just hit
    ok("T7v2(d): a fresh hit stands the mechanic down — no repair inside the under-fire window",
      stepMechanicTend(w, m, 0, 0, w.dt) === false && tw.hp === 40);
  }
  // (e) masonry mends; the enemy's iron and the depot's stones never
  {
    const w = makeWorld({ field: flatF, seed: 123 });
    w._mech = { take: () => true };
    const m = addBody(w, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x: 0, y: 0.74, z: 3, hp: 58 });
    m.maxHp = 58; m.utype = "mechanics";
    const wallC = spawnWallCourses(w, 0, 0, 0)[0]; wallC.hp = 30;
    const bag = spawnSandbag(w, 2, 0); bag.hp = 20;
    const eTower = addBody(w, { kind: "tower", team: 2, mass: 0, hx: 0.8, hy: 1.0, hz: 0.8, x: 4, y: 1.0, z: 4, hp: 40 });
    eTower.maxHp = 80;
    const stone = addBody(w, { kind: "chunk", team: 0, mass: 100, hx: 0.4, hy: 0.4, hz: 0.4, x: -3, y: 0.4, z: 0, hp: 50 });
    for (let i = 0; i < 7200 && (wallC.hp < 69 || bag.hp < 59); i++) { stepMechanicTend(w, m, 0, 0, w.dt); stepWorld(w); }
    ok("T7v2(e): the wall course and the bag both mend to full", wallC.hp > 69 && bag.hp > 59, `${wallC.hp.toFixed(1)}/${bag.hp.toFixed(1)}`);
    ok("T7v2(e2): the enemy's tower and the unledgered stone are never touched", eTower.hp === 40 && stone.hp === 50);
  }
  // (f) its side: the garrison mechanic mends its own tower off its own books, draw-free
  {
    const w = makeWorld({ field: flatF, seed: 124 }); w.depotCombat = true;
    let regCharged = 0;
    w._mech = { take: (team, n) => { if (team !== 2) return false; regCharged += n; return true; } };
    const gm = spawnUnit(w, { x: 0, z: 0 }, "mechanic"); gm.hold = true; gm.garrison = true;
    const eTw = addBody(w, { kind: "tower", team: 2, mass: 0, hx: 0.8, hy: 1.0, hz: 0.8, x: 4, y: 1.0, z: 0, hp: 30 });
    eTw.maxHp = 80; eTw.towerType = "gun"; eTw.discipline = "free";
    let draws = 0; const raw = w.rng; w.rng = () => { draws++; return raw(); };
    for (let i = 0; i < 3600 && eTw.hp < 79; i++) { stepUnits(w, straightGrid(0, 1), identFwdDir, null); stepWorld(w); }
    ok("T7v2(f): its mechanic walks, kneels, and mends the tower", eTw.hp > 75, eTw.hp.toFixed(1));
    ok("T7v2(f2): its own books paid", regCharged > 0, regCharged);
    ok("T7v2(f3): the wrench draws nothing — zero rng", draws === 0, draws);
  }
  // (g) the market: one family, both sides
  {
    const w = makeWorld({ field: flatF, seed: 125 });
    const sqM = makeSquad(71, "mechanics", 1, 0, 0);
    spawnSquadMembers(w, sqM);
    spawnUnit(w, { x: 10, z: 10 }, "mechanic");
    ok("T7v2(g): the mechanic family counts both armies' men", marketCounts(w, [sqM]).mechanic === 3);
    ok("T7v2(g2): sq_mechanics prices at its 55 base", computePrices({}).player.sq_mechanics === 55);
  }
  // (h) the look: side coats, the black toolbox, the kneel
  {
    const k1 = troopKit({ team: 1, utype: "mechanics", alive: true }, true);
    const k2 = troopKit({ team: 2, tag: "mechanic", alive: true }, true);
    ok("T7v2(h): no rifle, the toolbox in black, side coats kept (no white — the cross is the medic's alone)",
      k1.rifle === 0 && k1.props[0] && k1.props[0].role === "gun" && k1.pal === "con" && k2.pal === "gren");
    ok("T7v2(h2): the kneel drops him low",
      troopKit({ team: 1, utype: "mechanics", kneel: true, alive: true }, true).bh < troopKit({ team: 1, utype: "mechanics", alive: true }, true).bh);
  }
  // (i) the card and the wiring
  {
    ok("T7v2(i): the card carries the owner's copy and the paid-repair skill",
      !!CARDS.sq_mechanics && /paid in scrap/.test(CARDS.sq_mechanics.role) && CARDS.sq_mechanics.skills.includes("REPAIR — PAID IN SCRAP"));
    const src = fs.readFileSync("src/depot/DepotGame.jsx", "utf8");
    ok("T7v2(i2): the bar, the mode map, the loop call, and the books stamp are wired",
      /key: "sq_mechanics", label: "MECHANICS", icon: "⚙"/.test(src) && /sq_mechanics: "mechanics"/.test(src) &&
      /if \(sq\.type === "mechanics"\) stepMechanicTendSquad\(world, sq, world\.dt\);/.test(src) &&
      /world\._mech = \{ take: \(team, n\) => \{/.test(src));
  }
}
```

Nineteen checks — (a) 3, (b) 3, (c) 1, (d) 1, (e) 2, (f) 3, (g) 2, (h) 2, (i) 2. Expected suite after all steps: **1598/0** (1579 + 19, the sweep count-neutral). Run the suite now: RED confined to this block — the failing-first proof.

**Step 2 — the tables.** The Task 6 pattern verbatim, one key over: SQUAD_SPECS gains `mechanics: { n: 2, cost: 55, label: "MECHANIC TEAM" }` (with the tools-not-shooters comment); HAND_KEYS gains `"sq_mechanics"` after `"sq_medics"`; HAND_TAGS gains `sq_mechanics: "mechanic"`; PLAYER_TIERS row 3 gains `"sq_mechanics"` (the ruled tier-3 seat, comment per T6's); ENEMY_SPECS gains the `mechanic` row (the medic row's shape, label "mechanic", bounty 8); PICK_POOL gains `{ key: "sq_mechanics", kind: "squad", type: "mechanics", tag: "mechanic", n: 2 },` after the sq_medics row; market.js gains `mechanics: "mechanic"` (FAMILY_OF_SQUAD), `mechanic: "mechanic"` (FAMILY_OF_TAG), `mechanic: 6,` (MARKET_K, F5 comment).

**Step 3 — the repair loop.** `src/depot/squads.js`, appended after the medic block:

```js
// ------------------------------------------------------ the mechanic (P7.2 T7)
// The medic's tend template with three deltas (owner's rulings): TARGETS are
// own-side machines and masonry with an hp ledger (hulls, towers, wall
// courses, bags — depot stones carry no ledger and are excluded by
// construction); UNDER FIRE THE WORK PAUSES (a fresh dmgT stands him down
// for REPAIR_UNDERFIRE_S — the reaction covers him like any man); and EVERY
// POINT IS PAID — a fractional debt charges ONE scrap at a time through
// world._mech.take(team, 1), the game layer's books (stamped at mount; this
// module only asks — its no-economy law holds). An empty till leaves him
// kneeling with a still wrench. Shares kneel/_tending with the medic — the
// defend-branch skip and the wrapper shape carry over. Zero rng.
// All dials provisional (F5).
export const MECH_SEEK_M = 12;          // provisional (F5)
export const MECH_WORK_PAD = 1.6;       // provisional (F5)
export const REPAIR_RATE = 4;           // provisional (F5) — hp per second
export const REPAIR_COST_PER_HP = 0.15; // provisional (F5) — scrap per point
export const REPAIR_UNDERFIRE_S = 4;    // provisional (F5)
export function stepMechanicTend(world, u, ax, az, dt) {
  if (world.t - (u.dmgT != null ? u.dmgT : -1e9) < REPAIR_UNDERFIRE_S) { u.kneel = false; u._tending = false; return false; }
  let best = null, bd = Infinity, br = 0;
  for (const b of world.bodies) {
    if (!b.alive || b.team !== u.team) continue;
    const machine = b.kind === "vehicle" || b.kind === "tower" || b.kind === "wall" || (b.kind === "chunk" && b.sandbag);
    if (!machine || b.maxHp == null || b.hp >= b.maxHp - 0.5) continue;
    if (Math.hypot(b.pos.x - ax, b.pos.z - az) > MECH_SEEK_M) continue;
    const d = Math.hypot(b.pos.x - u.pos.x, b.pos.z - u.pos.z);
    if (d < bd) { bd = d; best = b; br = Math.max(b.hx, b.hz) + MECH_WORK_PAD; }
  }
  if (!best) { u.kneel = false; u._tending = false; return false; }
  if (bd > br) {
    u.kneel = false; u._tending = true;
    const g = clearSlot(world, best.pos.x, best.pos.z, memberClear(u));
    u.goal = { x: g.x, z: g.z };
    u.settled = false;
    seekGoal(world, u, dt);
    return true;
  }
  u.kneel = true; u._kneltOnce = true; u._tending = true;
  u.settled = true;
  u.v.x *= 1 - Math.min(1, 8 * dt); u.v.z *= 1 - Math.min(1, 8 * dt);
  const heal = Math.min(REPAIR_RATE * dt, best.maxHp - best.hp);
  const cost = heal * REPAIR_COST_PER_HP;
  // PRE-PAID WORK (A1): the wrench buys credit ONE scrap at a time BEFORE
  // it mends — the first point of work requires the books to answer, and
  // an empty till mends nothing from the first tick (the original
  // deferred-charge shape leaked ~6.6 free hp; the task's own fixture
  // caught it).
  if ((u._repairCredit || 0) < cost) {
    if (world._mech && world._mech.take(u.team, 1)) u._repairCredit = (u._repairCredit || 0) + 1;
    else return true; // unfunded: kneel, but no work
  }
  u._repairCredit -= cost;
  best.hp += heal;
  return true;
}
// The squad wrapper — the medic's A1 shape, one type over.
export function stepMechanicTendSquad(world, squad, dt) {
  if (squad.type !== "mechanics") return;
  if (squad.order !== "defend") {
    for (const id of squad.memberIds) { const u = world.byId.get(id); if (u) { u.kneel = false; u._tending = false; } }
    return;
  }
  for (const id of squad.memberIds) {
    const u = world.byId.get(id);
    if (u && u.alive) stepMechanicTend(world, u, squad.anchor.x, squad.anchor.z, dt);
  }
}
```

**Step 4 — its side.** `src/depot/units.js`: the squads import gains `stepMechanicTend`; directly after the shipped medic branch:

```js
    // P7.2 T7: ITS MECHANIC — the medic branch's shape, the wrench instead
    // of the bag; its own books pay through world._mech. No weapon, no draws.
    if (u.tag === "mechanic") {
      if (!u._post) u._post = { x: u.pos.x, z: u.pos.z };
      if (stepMechanicTend(world, u, u._post.x, u._post.z, dt)) { faceTravel(u, dt); continue; }
      u.settled = true;
      u.v.x *= 1 - Math.min(1, 6 * dt); u.v.z *= 1 - Math.min(1, 6 * dt);
      continue;
    }
```

**Step 5 — the wiring.** `src/depot/DepotGame.jsx`: the squads import gains `stepMechanicTendSquad`; PALETTE gains `{ key: "sq_mechanics", label: "MECHANICS", icon: "⚙", cost: SQUAD_SPECS.mechanics.cost },` after the sq_medics row; SQUAD_MODE gains `sq_mechanics: "mechanics"`; the squad loop gains, directly after the medic call, `if (sq.type === "mechanics") stepMechanicTendSquad(world, sq, world.dt);`; and the mount's world-stamp neighborhood (beside `world.inRim = `) gains:

```js
      // P7.2 T7: THE REPAIR BOOKS — the mechanic's wrench asks here; each
      // side pays its own till, one scrap at a time. Game-layer money, so
      // squads.js's no-economy law holds (the module only invokes this).
      world._mech = { take: (team, n) => {
        if (team === 1) { if (S.resources < n) return false; S.resources -= n; return true; }
        if (!S.reg || S.reg.scrap < n) return false; S.reg.scrap -= n; return true;
      } };
```

**Step 6 — the look.** `src/render/troopkit.js`: after MEDIC's props, `const TOOLBOX = { off: [0.17, 0.0, 0.05], s: [1.6, 1.2, 1.0], role: "gun" }; // P7.2 T7: the mechanic's black box — side coats stay, the tool is the identity`; after KIT_MEDIC, `const KIT_MECHANIC = { rifle: 0, props: P(TOOLBOX) };`; the kneel line's condition becomes `(b.utype === "medics" || b.tag === "medic" || b.utype === "mechanics" || b.tag === "mechanic")`; the utype chain gains `: b.utype === "mechanics" ? KIT_MECHANIC` and the tag chain `: b.tag === "mechanic" ? KIT_MECHANIC`, each before its KIT_PLAIN fallback. No palette or renderer/portrait edits — the T6 prop-role machinery carries the color.

**Step 7 — the card.** `src/depot/infocards.js`, after the sq_medics row:

```js
  sq_mechanics: sq("mechanics", "Two mechanics with a toolbox. They kneel at broken machines and masonry — hulls, towers, walls, bags — and every point of repair is paid in scrap.", ["DEFEND", "MOVE", "PATROL", "REPAIR — PAID IN SCRAP", "TAKE CONTROL"], null),
```

**Step 8 — the sweep** (the license's ledger above, each old → new in the report; seed 91 re-measured, re-based only if moved).

**Step 9 — the gates and the deploy.** In order: `node scripts/depot-test.mjs` — expected **1598/0**; `node scripts/golden.mjs` — 7/7 REQUIRED (troopkit); `node scripts/depot-lint.mjs` clean; keystone 843448507/749 unmoved; bump `src/version.js` to `mk1.88` BEFORE `npm run build`; smoke (stale 4173 stays; preview 4174 + SMOKE_URL; kill only yours) green at mk1.88. Gates green → `git add` → commit subject exactly `the mechanic (mk1.88)` → push.

## Trap notes

- The DEFEND branch's `_tending` skip is ALREADY GENERIC (Task 6 A1) — no squads.js edit beyond the appended block. Do not add a second skip.
- The units.js mechanic branch must CONTINUE unconditionally (the medic-branch law).
- The credit accounting (A1) is PRE-PAID: the take() ask happens BEFORE any mend, and an unfunded ask returns with zero work done. Do not revert to deferred debt.
- `_repairCredit` never rides the save (re-derives; at most one scrap of pre-paid work is forgotten on resume — named, accepted).
- `world._mech` absent (bare fixtures) means the wrench waits — tests that want repair stamp their own stub, as Step 1's do.
- Wall repair works per COURSE (each carries its own hp) — no stack logic, no support-rule interaction.
- No edits to planWave/ai.js/bell.js/state.js/core.js/renderer.js/portrait.js/save.js.
- The medic's own T6(a) count pins move this task — they are IN the ledger; movement there is licensed, not a stop.

## The owner's live check

- Buy the plan or hire the team: the toolbox pair walks to a chipped hull or wall, kneels, and the bar climbs while scrap ticks down — and stops the moment the till runs dry or fire lands on them.
- The enemy's mechanic doing the same over its own iron.
- The look — side coat, black toolbox, the kneel — your eye accepts or re-dials.

## Report requirements

Fixture seeds named (120–125 new; 91 re-measured, old → new if moved). Golden 7/7 with the run's own output. Every sweep re-teach old → new, each its own labeled bullet. Deviations labeled; none stated as none. The suite count to the digit.
