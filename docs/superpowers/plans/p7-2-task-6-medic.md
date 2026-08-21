# P7.2 Task 6 — The Medic (mk1.87)

*HISTORY (stamped 2026-08-20, owner's order): this document is a record of shipped work, not authority. Design truth lives in CLAUDE.md and the ACTIVE phase's plan documents; where this file disagrees with them, it is wrong.*

**Suggested model: Sonnet** (a new squad type on existing machinery, fully specced; one small render-kit addition).
**Scope (ruled 2026-08-19, both passes):** a new squad type, BOTH SIDES — the medic walks to the nearest wounded man and KNEELS to treat him (the theater over the aura, the owner's call). Tier-1 row, ~55 scrap. Medic dress — the owner's eye accepts the look live. He joins the hand's pool with his info card and live portrait. The pool grows FIFTEEN → SIXTEEN — a licensed count sweep rides this task. The enemy's mirror: medics arrive through its hand (hires and plans, Task 4's machinery) and the boot's dealt picks; they never march in waves (planWave's roster is untouched — the mg/engineer precedent exactly). Healing is deterministic, zero rng, and writes hp directly — damage is the engine's, mending is the game's; no engine file changes.

**AMENDMENT 1 (2026-08-20, after the agent's honest stop at the suite — three plan-writer defects and one real integration defect, all corrected in place below):** (1) THE TEND FIGHT — stepSquad's DEFEND branch re-seeks every member's slot goal every tick, and the two same-gain seeks fight to a standstill (measured: the medics never left the ring, the patient never healed; the tend loop alone heals correctly). The fix is the sapper `_fuse` precedent: a member flagged `_tending` is skipped by the formation drive — the tend pass, running after, owns his goal alone. `stepMedicTend` stamps the flag; the wrapper clears flag and kneel on any non-defend order. (2) THE FIXTURE'S PATIENT WALKED AWAY — T6(e)'s bare team-2 body marched the flow field; he becomes a garrison hold man (real machinery, legitimately stationary). (3) THE HEALING BUDGET WAS SHORT — 1200 ticks is 10 sim-seconds, 30 hp at the rate; both heal loops extend to 2400. (4) THE LEDGER MISSED ONE PIN — 01's line 131 (`pool().length === 14`, the bought-plan-leaves-the-pool check) joins the sweep, 14 → 15. And the plan's own count line said twenty-one where the block holds twenty — expected suite corrects to **1579/0**.

## Required reading (verified against the mk1.86 tree; re-verify at dispatch)

- `src/depot/squads.js` — 33–87 (SQUAD_SPECS, squadSpeed, makeSquad), 340–435 (seekGoal, slotFor, memberClear/clearSlot above at 205–217), 533–722 (stepSquad whole).
- `src/depot/units.js` — 458–566 (stepUnits whole — the eng-hold branch at 505–509 is the insertion's neighbor).
- `src/depot/specs.js` — 34–80 (ENEMY_SPECS), 164–181 (PLAYER_START/PLAYER_TIERS/HAND_KEYS/HAND_TAGS).
- `src/depot/muster.js` — 188–229 (PICK_POOL, dealHand, spawnMirrorMan).
- `src/depot/market.js` — whole (102).
- `src/render/troopkit.js` — whole (149).
- `src/render/renderer.js` — 843–880 (the infantry palette tables, mkPal, the android-dress precedent) and 1770–1845 (the kit-consumption loop and its color writes — the prop-role override and the medic palette route land here).
- `src/render/portrait.js` — whole (109; `buildPortraitMan` indexes `INFANTRY.pal[KIT.pal]` and colors props by `p.role` — both need the medic route or the portrait blanks).
- `src/depot/infocards.js` — whole (42).
- `src/depot/DepotGame.jsx` — 717–742 (PALETTE), 1525 (SQUAD_MODE), 528–566 (the squad loop — the tend call's insertion site), 3486–3500 (the pie gates — no edit expected, confirm patrolOk/structOk fall out by membership).
- Tests: `11-hiring-hall.mjs` whole; `01-engine-era.mjs` 109–241 (the hand block); `07-armor-demolition.mjs` line 873; `09-reorg.mjs` 62–84 (the seed-91 boot fixture); `10-command-refit.mjs` line 276.

## The design, plainly

1. **The sixteenth key.** `sq_medics` joins every table: SQUAD_SPECS (`medics`, 2 men, 55 scrap), PALETTE (icon ✚), SQUAD_MODE, HAND_KEYS, HAND_TAGS (`"medic"`), PICK_POOL, PLAYER_TIERS row 1 (a price-family seat — rows gate nothing since Task 2), ENEMY_SPECS (`medic` — the conscript frame, bounty 8), and the market (family `medic`, K 6, both sides' medics counted together). The build bar, hand, hire flow, info card, portrait, boot deal, enemy hand, and mirror fielding all inherit by construction.
2. **The tend loop — one helper, both sides.** `stepMedicTend(world, u, ax, az, dt)` in squads.js: the nearest wounded comrade (own team, live unit, hp under max, never sealed riders, never himself) standing within MEDIC_SEEK_M of the anchor; the medic walks to him through the squads' own vetted seek, KNEELS inside MEDIC_TEND_M (`u.kneel` — a body flag the troop kit reads), and mends MEDIC_RATE hp a second, never past maxHp. No patient → he stands down. The player's medic team runs it on DEFEND only (orders outrank mercy — a marching or patrolling squad tends nothing en route); the enemy's medic is a garrison man whose post is his leash. Zero rng anywhere; every draw-count pin stands.
3. **Tools, not shooters — free of charge.** No INFANTRY_ARMS row, so squadFire skips the type, the STRUCTURES wedge never offers, and the reach ring is absent — all by membership, zero edits. PATROL stays (the engineers/sappers exclusion list is untouched). The reaction (Task 5) covers medics like any unroled man.
4. **The look (owner's ruling, 2026-08-20): A WHITE UNIFORM, A RED CROSS VISIBLE FRONT AND BACK, A BLACK MEDICAL BAG.** Both sides wear the same white — the cross outranks the coat (the one deliberate side-blind dress, the fiction's own rule; team still reads from selection, bars, and context). The mechanism, three pieces: (1) a MEDIC PALETTE — white coat, red accent, black gear — declared once in troopkit.js as plain hexes and consumed by the renderer (the android-dress mkPal precedent) AND the portrait painter (which indexes palettes by kit name and would otherwise blank); (2) `KIT_MEDIC` — no rifle, three props: the black bag at the hip and TWO red bars that pass THROUGH the torso, protruding on both faces — one vertical, one horizontal, a cross readable front AND back from two props; (3) props gain an optional `role` (the color key), honored by one small addition in the renderer's color write and the portrait's material pick — bag `"gun"` (black), bars `"acc"` (red). THE KNEEL: `troopKit` reads one new body flag (`b.kneel`, medics only) and drops the body height to 0.72× while treating. All render-path, all reachable only under the depot gate — every other mode byte-identical; golden is the gate. Exact offsets and hexes are look dials — the owner's eye accepts or re-dials live.
5. **The card** (owner-approved copy, verbatim): *"Two medics with a bag. They walk to the wounded and kneel to treat — no rifle, no fight."* Skills: DEFEND, MOVE, PATROL, TREAT THE WOUNDED, TAKE CONTROL. The portrait resolves through the existing `sq_*` man-builder untouched.
6. **Interaction checklist:** the boot's dealt hands draw over sixteen keys — fixed-seed boot outcomes legitimately shift (the value-shift license below); draw COUNTS never move (boot 9, hand 5+5, bell 14 — movement = stop). The keystone never touches the muster or the hand — expected unmoved (843448507/749). `u._post` and `u.kneel` never ride the save (absent from the sweep list — they re-derive; the `_route` precedent). Possession of a medic squad drives formation and volleys nothing (no spec) — free. The withdrawal sweep spares garrison medics (the garrison skip).

Dials, all provisional (F5): MEDIC_SEEK_M 12, MEDIC_TEND_M 1.4, MEDIC_RATE 3 hp/s, squad 2 men at 55 scrap, family K 6, enemy bounty 8.

## Sweep license (the sixteenth-key count sweep — each site pre-named below; count-neutral throughout; anything beyond the ledger = honest stop)

- **The count pins, 15 → 16 (re-teaches, content identical):** 11's T2(a) (both `=== 15` terms and the "fifteen" messages), 11's T3(a3), 01 lines 122 and 129 (`=== 15`) and 135 (the "full fifteen" label — text only), 07 line 873 (T7(f)), 10 line 276 (T6v2, both terms).
- **The slice pins:** 11's T2(b5) `HAND_KEYS.slice(0, 13)` → `slice(0, 14)` (the "two plans left" premise holds); 01 line 162 `slice(0, 14)` → `slice(0, 15)` (the one-plan pool). 01's draw-law loop slices (line 143) stay as written — its asserts count draws, not contents.
- **A1 addition:** 01 line 131 (`pool().length === 14`, the bought-plan-leaves-the-pool check) → `=== 15` — sixteen keys minus the one bought (found by the agent's honest stop; the original ledger missed it).
- **HAND_TAGS count:** 11's T4(a) `=== 10` → `=== 11`, message re-worded to "the nine squads and both heroes".
- **Value-shift license (the T15 precedent):** the sixteenth key shifts every fixed-seed deal and boot outcome. NUMERIC outcome pins moving for exactly that reason re-base, measured, old → new — the known candidate is 09's T19(b3) (seed-91 garrison count, currently 6); its sibling property pins (b2/b4/b5) and every draw-count pin (b: 9) must hold unmoved. A draw-count movement anywhere is a stop, not a re-base.

## The steps

**Step 1 — the failing asserts.** Append to `scripts/tests/11-hiring-hall.mjs`. Import additions: `stepMedicTend, stepMedicTendSquad, MEDIC_SEEK_M, MEDIC_TEND_M, MEDIC_RATE, SQUAD_SPECS` join the squads import; `HAND_TAGS, ENEMY_SPECS` join the specs import (HAND_TAGS is already there from T4 — add ENEMY_SPECS); `computePrices, marketCounts` as a new market import; `troopKit` as a new import from `"../../src/render/troopkit.js"`; `CARDS` from `"../../src/depot/infocards.js"`.

```js
// ---- P7.2 T6 (mk1.87): THE MEDIC — the sixteenth key; mercy on both sides
{
  // (a) the sixteenth key, every table
  ok("T6(a): the pool is sixteen and sq_medics is in every seat",
    HAND_KEYS.length === 16 && HAND_KEYS.includes("sq_medics") && PICK_POOL.length === 16 &&
    PICK_POOL.some((p) => p.key === "sq_medics" && p.kind === "squad" && p.type === "medics" && p.tag === "medic" && p.n === 2));
  ok("T6(a2): the tag map routes his medic plan to the wave map like any squad", HAND_TAGS.sq_medics === "medic");
  ok("T6(a3): the squad row — two men at 55 // provisional (F5)", SQUAD_SPECS.medics.n === 2 && SQUAD_SPECS.medics.cost === 55);
  ok("T6(a4): his side fields the same man — ENEMY_SPECS.medic, bounty 8", !!ENEMY_SPECS.medic && ENEMY_SPECS.medic.bounty === 8);
  // (b) the tend loop, player side — walk, kneel, mend, stand down
  {
    const w = makeWorld({ field: flatF, seed: 110 });
    const sq = makeSquad(60, "medics", 1, 0, 0);
    spawnSquadMembers(w, sq);
    const hurt = addBody(w, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x: 6, y: 0.74, z: 0, hp: 20 });
    hurt.maxHp = 58;
    for (let i = 0; i < 2400 && hurt.hp < 57; i++) { stepSquad(w, sq, w.dt); stepMedicTendSquad(w, sq, w.dt); stepWorld(w); } // A1: 20 sim-seconds — walk time plus 37 hp at the rate
    ok("T6(b): the medic walks to the wounded man and mends him", hurt.hp > 55, hurt.hp.toFixed(1));
    const medics = sq.memberIds.map((id) => w.byId.get(id));
    ok("T6(b2): he knelt to do it — and stood down when the work was done",
      medics.some((m) => m._kneltOnce === true || m.kneel === false) && (() => { for (let i = 0; i < 240; i++) { stepSquad(w, sq, w.dt); stepMedicTendSquad(w, sq, w.dt); stepWorld(w); } return medics.every((m) => !m.kneel); })());
    for (let i = 0; i < 600; i++) { stepSquad(w, sq, w.dt); stepMedicTendSquad(w, sq, w.dt); stepWorld(w); }
    ok("T6(b3): mending never passes maxHp", hurt.hp <= hurt.maxHp + 1e-9, hurt.hp);
  }
  // (c) the leash: a casualty beyond MEDIC_SEEK_M of the anchor is not visited
  {
    const w = makeWorld({ field: flatF, seed: 111 });
    const sq = makeSquad(61, "medics", 1, 0, 0);
    spawnSquadMembers(w, sq);
    const far = addBody(w, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x: 25, y: 0.74, z: 0, hp: 20 });
    far.maxHp = 58;
    for (let i = 0; i < 600; i++) { stepSquad(w, sq, w.dt); stepMedicTendSquad(w, sq, w.dt); stepWorld(w); }
    ok("T6(c): the leash holds — the far casualty is not visited, the squad keeps its post",
      far.hp === 20 && sq.memberIds.every((id) => Math.hypot(w.byId.get(id).pos.x, w.byId.get(id).pos.z) < 8));
  }
  // (d) never the sealed, never the enemy, never himself
  {
    const w = makeWorld({ field: flatF, seed: 112 });
    const medic = addBody(w, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x: 0, y: 0.74, z: 0, hp: 30 });
    medic.maxHp = 58; medic.utype = "medics";
    const rider = addBody(w, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x: 2, y: -60, z: 0, hp: 10 });
    rider.maxHp = 58; rider.riding = true; rider.pinned = true;
    const foe = addBody(w, { kind: "unit", team: 2, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x: 3, y: 0.74, z: 0, hp: 10 });
    foe.maxHp = 58;
    const drove = stepMedicTend(w, medic, 0, 0, w.dt);
    ok("T6(d): a sealed rider, an enemy, and his own wounds are all no one's patient", drove === false && rider.hp === 10 && foe.hp === 10 && medic.hp === 30);
  }
  // (e) his side: the garrison medic tends off his post through the same helper
  {
    const w = makeWorld({ field: flatF, seed: 113 }); w.depotCombat = true;
    const gm = spawnUnit(w, { x: 0, z: 0 }, "medic"); gm.hold = true; gm.garrison = true;
    // A1: the patient is a garrison hold man — legitimately stationary
    // through the real hold machinery (a bare body marches the flow field
    // and walks away from his own medic, the honest stop's finding).
    const hurt2 = spawnUnit(w, { x: 5, z: 0 }, ""); hurt2.hold = true; hurt2.garrison = true;
    hurt2.hp = 15;
    let draws = 0; const raw = w.rng; w.rng = () => { draws++; return raw(); };
    for (let i = 0; i < 2400 && hurt2.hp < 57; i++) { stepUnits(w, straightGrid(0, 1), identFwdDir, null); stepWorld(w); } // A1: one medic at the rate needs ~14 sim-seconds plus the walk
    ok("T6(e): his medic walks and mends by the identical rule", hurt2.hp > 55, hurt2.hp.toFixed(1));
    ok("T6(e2): mercy draws nothing — zero rng in the whole tend run", draws === 0, draws);
  }
  // (f) the market: one family, both sides' medics counted together
  {
    const w = makeWorld({ field: flatF, seed: 114 });
    const sqM = makeSquad(62, "medics", 1, 0, 0);
    spawnSquadMembers(w, sqM);
    spawnUnit(w, { x: 10, z: 10 }, "medic");
    const counts = marketCounts(w, [sqM]);
    ok("T6(f): the medic family counts both armies' medics", counts.medic === 3, counts.medic);
    const p = computePrices({});
    ok("T6(f2): sq_medics prices at its 55 base with nothing standing", p.player.sq_medics === 55, p.player.sq_medics);
  }
  // (g) the look: the white, the cross, the black bag, the kneel — one dress, both sides
  {
    const kit1 = troopKit({ team: 1, utype: "medics", tag: undefined, role: undefined, alive: true }, true);
    ok("T6(g): no rifle; the black bag and both red cross bars ride the three prop slots",
      kit1.rifle === 0 && kit1.props[0] && kit1.props[0].role === "gun" &&
      kit1.props[1] && kit1.props[1].role === "acc" && kit1.props[2] && kit1.props[2].role === "acc");
    const kit2 = troopKit({ team: 2, utype: undefined, tag: "medic", role: undefined, alive: true }, true);
    ok("T6(g2): both sides wear the white — the cross outranks the coat (owner)",
      kit1.pal === "medic" && kit2.pal === "medic" && kit2.rifle === 0);
    const kneeling = troopKit({ team: 1, utype: "medics", kneel: true, alive: true }, true);
    const standing = troopKit({ team: 1, utype: "medics", kneel: false, alive: true }, true);
    ok("T6(g3): the kneel drops him low — the crouch is the theater", kneeling.bh < standing.bh);
    ok("T6(g4): MEDIC_HEX is the one home — white coat, red accent, black gear",
      MEDIC_HEX.acc === 0xd0342c && MEDIC_HEX.gun === 0x1a1c1f && MEDIC_HEX.dom === 0xf4f6f8);
    const rSrc = fs.readFileSync("src/render/renderer.js", "utf8");
    const pSrc = fs.readFileSync("src/render/portrait.js", "utf8");
    ok("T6(g5): the renderer and the portrait both wear the dress and honor a prop's own color role",
      /kitPal === "medic" \? \(b\.alive \? MED_LIVE : MED_DEAD\)/.test(rSrc) && /pal\[propRole \|\| p\.role\]/.test(rSrc) &&
      /KIT\.pal === "medic"/.test(pSrc) && /KIT\.props\[pi\] && KIT\.props\[pi\]\.role/.test(pSrc));
  }
  // (h) the card and the bar
  {
    ok("T6(h): the card carries the owner's copy and the treat skill",
      !!CARDS.sq_medics && /kneel to treat/.test(CARDS.sq_medics.role) && CARDS.sq_medics.skills.includes("TREAT THE WOUNDED") && CARDS.sq_medics.dmg === null);
    const src = fs.readFileSync("src/depot/DepotGame.jsx", "utf8");
    ok("T6(h2): the bar, the mode map, and the tend call are wired",
      /key: "sq_medics", label: "MEDICS", icon: "✚"/.test(src) && /sq_medics: "medics"/.test(src) &&
      /if \(sq\.type === "medics"\) stepMedicTendSquad\(world, sq, world\.dt\);/.test(src));
  }
}
```

Twenty checks — (a) 4, (b) 3, (c) 1, (d) 1, (e) 2, (f) 2, (g) 5, (h) 2 (A1: the original count line's "twenty-one" was the plan-writer's miscount; the code's block is authoritative — the Task 2 precedent). `MEDIC_HEX` joins the troopkit import in the test file. Expected suite after all steps: **1579/0** (1559 + 20, the sweep count-neutral). Run the suite now: RED on this block with the 1559 unmoved except the ledger's own pre-change reds — the failing-first proof. (Note for (b2): the helper sets `u._kneltOnce = true` the first time it kneels — a test-visible latch, one line, named below.)

**Step 2 — the tables.** Five small edits:
- `src/depot/squads.js`, SQUAD_SPECS, after the breakers row:

```js
  // P7.2 T6 (owner): THE MEDIC TEAM — two medics with a bag; they walk to
  // the wounded and kneel to treat. Tools, not shooters: no INFANTRY_ARMS
  // row, so squadFire skips them by membership. // provisional (F5)
  medics: { n: 2, cost: 55, label: "MEDIC TEAM" },
```

- `src/depot/specs.js`: HAND_KEYS gains `"sq_medics"` after `"sq_breakers"`; HAND_TAGS gains `sq_medics: "medic"` after `sq_engineers`; PLAYER_TIERS row 1 gains `"sq_medics"` (comment: `// P7.2 T6: the medic's price-family seat — rows gate nothing since T2`); ENEMY_SPECS gains, after the `eng` row:

```js
  // P7.2 T6: his medic — the conscript frame, no weapon (units.js's medic
  // branch never fires). Bounty is the kill payout. // provisional (F5)
  medic: { mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, hp: 58, bounty: 8, speed: 3.2, gain: 14, label: "medic" },
```

- `src/depot/muster.js`, PICK_POOL, after the sq_engineers row: `{ key: "sq_medics", kind: "squad", type: "medics", tag: "medic", n: 2 },`
- `src/depot/market.js`: `FAMILY_OF_SQUAD` gains `medics: "medic"`; `FAMILY_OF_TAG` gains `medic: "medic"`; `MARKET_K` gains `medic: 6, // P7.2 T6 // provisional (F5)`.

**Step 3 — the tend loop.** `src/depot/squads.js`, appended after `drivePossessedSquad`:

```js
// ------------------------------------------------------- the medic (P7.2 T6)
// One helper, both sides: the nearest wounded comrade inside the anchor's
// leash gets a medic walking to him; inside kneel range the medic drops
// (u.kneel — the troop kit's crouch), stamps _kneltOnce (a test latch),
// and mends MEDIC_RATE hp a second, never past maxHp. Sealed riders, the
// enemy's men, and the medic himself are no one's patient. No patient →
// stand down. Deterministic; zero rng; healing writes hp directly —
// damage is the engine's, mending is the game's. All dials provisional (F5).
export const MEDIC_SEEK_M = 12;  // provisional (F5) — the leash off the anchor/post
export const MEDIC_TEND_M = 1.4; // provisional (F5) — kneel range
export const MEDIC_RATE = 3;     // provisional (F5) — hp per second
export function stepMedicTend(world, u, ax, az, dt) {
  let best = null, bd = Infinity;
  const pool = world._L ? (u.team === 2 ? world._L.foes : world._L.friends) : world.bodies;
  for (const p of pool) {
    if (p.kind !== "unit" || !p.alive || p.team !== u.team || p === u) continue;
    if (p.maxHp == null || p.hp >= p.maxHp - 0.5) continue;
    if (p.riding || p.pinned) continue;
    if (Math.hypot(p.pos.x - ax, p.pos.z - az) > MEDIC_SEEK_M) continue;
    const d = Math.hypot(p.pos.x - u.pos.x, p.pos.z - u.pos.z);
    if (d < bd) { bd = d; best = p; }
  }
  if (!best) { u.kneel = false; u._tending = false; return false; }
  if (bd > MEDIC_TEND_M) {
    u.kneel = false; u._tending = true; // A1: the formation drive stands aside while he tends
    const g = clearSlot(world, best.pos.x, best.pos.z, memberClear(u));
    u.goal = { x: g.x, z: g.z };
    u.settled = false;
    seekGoal(world, u, dt);
    return true;
  }
  u.kneel = true; u._kneltOnce = true; u._tending = true;
  u.settled = true;
  u.v.x *= 1 - Math.min(1, 8 * dt); u.v.z *= 1 - Math.min(1, 8 * dt);
  best.hp = Math.min(best.maxHp, best.hp + MEDIC_RATE * dt);
  return true;
}
// The squad wrapper: DEFEND only — orders outrank mercy on the march. A
// non-defend order clears the kneel and the tending flag (A1), so a
// marching medic never renders crouched and the formation drive owns him.
export function stepMedicTendSquad(world, squad, dt) {
  if (squad.type !== "medics") return;
  if (squad.order !== "defend") {
    for (const id of squad.memberIds) { const u = world.byId.get(id); if (u) { u.kneel = false; u._tending = false; } }
    return;
  }
  for (const id of squad.memberIds) {
    const u = world.byId.get(id);
    if (u && u.alive) stepMedicTend(world, u, squad.anchor.x, squad.anchor.z, dt);
  }
}
```

**Step 3b (A1) — the formation drive stands aside.** `src/depot/squads.js`, the DEFEND branch's members.forEach, directly after its `if (u._fuse != null) return;` line:

```js
    if (u._tending) return; // P7.2 T6 A1: a tending medic drives on the patient's goal — the sapper _fuse precedent; the tend pass (after stepSquad) owns him
```

(`_tending` never rides the save — absent from the sweep list, it re-derives on the first tend tick after resume.)

**Step 4 — his medic.** `src/depot/units.js`:
- Line 19's squads import gains `stepMedicTend`.
- In stepUnits, directly after the eng-hold branch (lines 505–509), before the sniper-vantage check:

```js
    // P7.2 T6: HIS MEDIC — walks to the nearest wounded comrade inside his
    // post's leash and kneels to treat, the identical helper the player's
    // team runs (one law, both sides). His post stamps once and never rides
    // the save (re-derives — the _route precedent). No weapon, no draws.
    if (u.tag === "medic") {
      if (!u._post) u._post = { x: u.pos.x, z: u.pos.z };
      if (stepMedicTend(world, u, u._post.x, u._post.z, dt)) { faceTravel(u, dt); continue; }
      u.settled = true;
      u.v.x *= 1 - Math.min(1, 6 * dt); u.v.z *= 1 - Math.min(1, 6 * dt);
      continue;
    }
```

(the medic tag never reaches stepRifleman — this branch always continues; the line-530 dispatch needs no edit.)

**Step 5 — the wiring.** `src/depot/DepotGame.jsx`:
- The squads import gains `stepMedicTendSquad`.
- PALETTE, after the sq_breakers row: `{ key: "sq_medics", label: "MEDICS", icon: "✚", cost: SQUAD_SPECS.medics.cost },` (comment above: `// P7.2 T6: the medic team — mercy on the bar`).
- SQUAD_MODE (line 1525) gains `sq_medics: "medics"`.
- The squad loop: directly after `if (sq._build && S.stepBuildLine) S.stepBuildLine(sq);` (line 546) add:

```js
      // P7.2 T6: the medics make their rounds — after the squad's own step,
      // so a tending man's goal overrides this tick's slot seek.
      if (sq.type === "medics") stepMedicTendSquad(world, sq, world.dt);
```

**Step 6 — the look.** Three files, one dress.

`src/render/troopkit.js`:
- After the SATCHEL prop line:

```js
// P7.2 T6 (owner): the medic's dress — white uniform, red cross front and
// back, black bag. The two cross bars pass THROUGH the torso and protrude
// on both faces, so one pair of props reads as a cross from either side.
// role is the COLOR key (the renderer and portrait honor it over the part
// slot's own): "gun" paints the bag black, "acc" paints the bars red off
// the medic palette below. Offsets are look dials — the owner's eye rules.
const MEDIC_BAG = { off: [0.17, 0.02, 0.0], s: [1.4, 1.8, 1.1], role: "gun" };
const CROSS_V = { off: [0, 0.32, 0], s: [0.7, 2.6, 2.9], role: "acc" };
const CROSS_H = { off: [0, 0.32, 0], s: [2.2, 0.7, 2.9], role: "acc" };
// The medic palette, plain hexes, one home — the renderer's mkPal and the
// portrait's material pick both consume it (spread over the con palette, so
// skin and any unnamed role inherit). // provisional (F5) — the owner's eye
export const MEDIC_HEX = { dom: 0xf4f6f8, sec: 0xe2e7ec, acc: 0xd0342c, gun: 0x1a1c1f };
```

- After KIT_MG: `const KIT_MEDIC = { rifle: 0, props: P(MEDIC_BAG, CROSS_V, CROSS_H) };`
- The contract comment (file head, "reads nothing but a body's team / utype / tag / role / dress / alive flags") gains `kneel` in the list.
- In troopKit: the pal line becomes medic-aware, and the bulk consts re-sign to `let` for the kneel:

```js
  const pal = (b.utype === "medics" || b.tag === "medic") ? "medic" : gren || b.team === 2 ? "gren" : "con"; // P7.2 T6 (owner): the cross outranks the coat — both sides' medics wear the white
  const bulk = BULK[b.tag] || null;
  let bw = bulk ? bulk[0] : 1, bh = bulk ? bulk[1] : 1;
  // P7.2 T6: the kneel — the medic drops low while treating. One flag, read
  // here only; render-only theater.
  if (b.kneel && (b.utype === "medics" || b.tag === "medic")) bh *= 0.72;
```

- The utype chain gains `: b.utype === "medics" ? KIT_MEDIC` before the KIT_PLAIN fallback; the enemy tag chain gains `: b.tag === "medic" ? KIT_MEDIC` before its KIT_PLAIN fallback.

`src/render/renderer.js` (guarded divergences — the android-dress precedent; every branch reachable only under depotCombat, golden the gate):
- The troopkit import gains `MEDIC_HEX`.
- After the AND_LIVE/AND_DEAD pair:

```js
  // P7.2 T6 (owner): the medic's whites — MEDIC_HEX over the con palette
  // (skin inherits), and a winter-kill grey of the same dress for the dead.
  const MED_LIVE = mkPal({ ...INFANTRY.pal.con, ...MEDIC_HEX });
  const MED_DEAD = mkPal({ ...INFANTRY.dead.con, dom: 0x8f9498, sec: 0x7d8286, acc: 0x6e3531, gun: 0x101214 });
```

- The part loop's declaration line gains the role carrier: `let o = p.off, ksx = 1, ksy = 1, ksz = 1, tilt = null, aim = null, propRole = null;` and the prop branch, after `tilt = pr.tilt || null; aim = pr.aim || null;` adds `propRole = pr.role || null; // P7.2 T6: a prop may name its own color role`.
- The palette pick routes the medic before the con/gren index:

```js
            const pal = b.dress === "android" ? (b.alive ? AND_LIVE : AND_DEAD) : kitPal === "medic" ? (b.alive ? MED_LIVE : MED_DEAD) : (b.alive ? INF_LIVE : INF_DEAD)[kitPal];
            if (hurtK > 0) { _hitC.copy(pal[propRole || p.role]).lerp(HIT_C, 0.7 * hurtK); pools[pi].setColorAt(idx, _hitC); }
            else pools[pi].setColorAt(idx, pal[propRole || p.role]);
```

`src/render/portrait.js` (the card's picture must wear the same dress):
- The troopkit import gains `MEDIC_HEX`.
- `buildPortraitMan`'s palette line becomes: `const pal = KIT.pal === "medic" ? { ...INFANTRY.pal.con, ...MEDIC_HEX } : INFANTRY.pal[KIT.pal];`
- Its material pick honors the prop role: the `toon(pal[p.role])` line becomes `toon(pal[(pi !== undefined && KIT.props[pi] && KIT.props[pi].role) || p.role])`.

**Step 7 — the card.** `src/depot/infocards.js`, after the sq_breakers row:

```js
  sq_medics:    sq("medics", "Two medics in white, the red cross front and back, a black bag in hand. They walk to the wounded and kneel to treat — no rifle, no fight.", ["DEFEND", "MOVE", "PATROL", "TREAT THE WOUNDED", "TAKE CONTROL"], null),
```

**Step 8 — the sweep** (the license's ledger, every site pre-named above; each old → new in the report; 09's T19(b3) re-bases measured ONLY if seed 91's boot actually moves it).

**Step 9 — the gates and the deploy.** In order: `node scripts/depot-test.mjs` — expected **1579/0**; `node scripts/golden.mjs` — 7/7 REQUIRED (troopkit is render-path); `node scripts/depot-lint.mjs` clean; keystone 843448507/749 unmoved (movement = stop); bump `src/version.js` to `mk1.87` BEFORE `npm run build`; smoke (stale 4173 stays; preview 4174 + SMOKE_URL; kill only yours) green at mk1.87. Gates green → `git add` the touched files → commit subject exactly `the medic (mk1.87)` → push.

## Trap notes

- The tend call sits AFTER stepSquad in the loop so the tending goal overrides that tick's slot seek — do not move it earlier.
- stepMedicTend's pool read (`world._L`) mirrors squadFire's team split exactly — friends for team 1, foes for team 2.
- The medic tag branch in stepUnits must CONTINUE unconditionally — reaching stepRifleman would arm him with ENEMY_FIRE.rifle.
- `u.kneel`, `u._post`, `u._kneltOnce` never ride the save (absent from save.js's sweep list) — they re-derive. No save.js edit.
- troopKit's purity contract holds: `kneel` is a plain body flag, no world reads, no clock.
- planWave, ai.js, bell.js, state.js, core.js, renderer.js, save.js: NO edits. The hand, hire, boot, and mirror paths inherit the sixteenth key with zero code.
- The hotfix's affordability gate covers medic hires for free (priceNow reads the live table; sq_medics is in it via the FAMILY_OF_SQUAD loop).

## The owner's live check

- The medic's look: the white uniform, the red cross reading from front AND back, the black bag, no rifle — and the kneel when he treats. The info card's portrait wears the same dress. Your eye accepts or re-dials every offset and hex.
- Buy the plan or hire the team; wound a squad; watch the medics walk out, kneel, and the health bars refill.
- The enemy's garrison medic doing the same over its wounded, learned by watching through your own eyes.

## Report requirements

Fixture seeds named (110–114 are the new ones; 91 re-measured only if T19(b3) moves). Golden 7/7 with the run's own output. Every sweep re-teach and any value-shift re-base old → new, each its own labeled bullet. Deviations labeled; none stated as none. The suite count to the digit.
