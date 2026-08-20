# P7.2 Task 5 — The Reaction (mk1.85)

**Suggested model: Sonnet** (unit-behavior work on existing machinery, fully specced; one small guarded engine stamp).
**Scope (ruled, 2026-08-20):** the enemy answers being attacked — and so does your side, identically. Three rulings: (1) BOTH, BY ROLE — garrison and hold men under fire from beyond their reach dive to nearby cover and keep their post; defending armor advances toward the fire's origin until its own eyes find the attacker. (2) UNITS ONLY — no commander escalation, no assault turning home; that doctrine stays with Enemy Front. (3) IDENTICAL BOTH SIDES — one rule, one code path per class, both teams; explicit orders always override. Fire stays sight-gated throughout — the reaction is MOVEMENT, never blind fire. The missing piece under everything is that a hit never says where it came from: the engine's damage stamp gains guarded origin fields (the dmgT precedent), and every reaction reads them through one pure helper.

## Required reading (verified against the mk1.84 tree at ca81efe; re-verify at dispatch)

- `src/depot/units.js` — whole (615): coverHaltUpdate/seekStandPoint (152–198), the hold branch (312–340), stepUnits (458–566).
- `src/depot/squads.js` — whole (772): exposureAt (114–137), slotBlocked/clearSlot/memberClear (183–217), the defend branch (677–722).
- `src/depot/drivers.js` — whole (408): armorGoal (97–280), the defend early-return (140), stepDrivers (368–378).
- `src/engine/core.js` — 598–660 (explode's damage sites), 755–800 (the projectile direct-hit site), 823–835 (applyDamage; the dmgT guarded-stamp precedent).
- `src/depot/state.js` — 1–60 (imports, fieldReaches, effRange — hitOrigin lands after effRange).
- `src/depot/save.js` — line 58 alone (the scalar sweep list: `lastHit` rides the save; `_huntPt`/`_huntT`/`_huntHit` are absent and re-derive, the T11 `_route` precedent).
- Tests: `scripts/tests/11-hiring-hall.mjs` whole; `07-armor-demolition.mjs` 255–293 (T3 garrison/enemy-Bison fixtures — the nearest neighbors to this change; neither takes origin-stamped fire, both must stay green untouched).

## The design, plainly

1. **The hit learns its origin (engine, guarded).** core.js's two damage sites that can hurt a man or a hull gain depot-only fields on the info object, the dmgT precedent's exact shape: the blast site stamps `srcId` (the firing body, `spec.owner`) and the blast point (`srcX`/`srcZ`); the direct-hit site stamps `srcId`. Guarded on `world.depotCombat` — every other mode's info objects are byte-identical, and the fields are numbers on a short-lived object nothing else reads. Golden and the keystone are the gates. Crush, drown, burial, and mine blasts without an owner carry no origin — no origin, no reaction, honest by construction.
2. **One origin read.** `hitOrigin(world, info)` in state.js: the shooter's live ground when `srcId` resolves to a living body, else the blast point, else null.
3. **The cover dive (men, both sides).** `reactShift(world, u)` in squads.js — coverHaltUpdate's own 5-point evaluation (current spot + 4 lateral offsets perpendicular to the origin bearing), candidates vetted clear (slotBlocked), lowest exposure wins, null when the held ground is already best. One evaluation per fresh hit, at most every 2 seconds, on the same `_coverHit`/`_coverT` fields coverHaltUpdate owns — one cadence, whichever mechanism consumes the hit first. Roled men (sniper/spotter) never shift — the pair holds its chosen ground, both sides. Consumers: the enemy's hold/garrison men (units.js hold branch — the shift becomes `_standPt`, the existing seek drives it, `settled` follows); the player's DEFEND-squad members (squads.js defend branch — the shift becomes `_slotGoal` until the next threat re-scan reclaims it). Every other order is untouched: MOVE/ATTACK/PATROL/BUILD squads keep their machinery (threat pace already reads lastHit), marching wave men keep marching (they are an assault under orders, not a garrison), workers keep working.
4. **The hunt (armor, both sides).** A DEFENDING gun hull (`drv === "armor"`) whose hit resolves an origin within HUNT_MAX_M drives at it through its own MOVE machinery (route, overrun safety, turn brake — all inherited); its guns answer the moment the shooter crosses its own sight, because the scan already runs every tick. Quiet ground for HUNT_HOLD_S sends it back to its park (`homeX`/`homeZ` — the commander-return shape). The transport never hunts (a transport defends itself, it does not duel — apcGuns' own law); the wave tank never defends; explicit orders, possession, and the commander's word all change the order off "defend" and outrank the hunt. The player's hunting hull draws its route in green like any ordered unit — the reaction is legible for free.
5. **Interaction checklist:** zero rng draws anywhere — every draw-count pin stands; no signature changes — stepUnits/stepSquad/stepDrivers callers untouched, DepotGame.jsx untouched; the save — `lastHit` rides the existing sweep with its new fields (plain numbers; old saves lack them → no reaction until the next fresh hit, clean), hunt state re-derives on resume (the `_route` precedent); the keystone — its fixture never runs the game drivers, expected unmoved (843448507/749); golden — REQUIRED green, core.js is touched; existing suite — no fixture puts origin-stamped fire on a hold man or defend hull (grep-verified at plan time), so the reaction is a no-op everywhere the suite already looks.

Dials, all provisional (F5): REACT_OFFSETS ±1.5/±3 m, REACT_CD_S 2, HUNT_HOLD_S 12, HUNT_MAX_M 45.

## Sweep license

No draw-count movement exists to license (the reaction draws nothing). Value-shift: none expected — any suite movement at all is an honest stop, not a re-pin.

## The steps

**Step 1 — the failing asserts.** Append to `scripts/tests/11-hiring-hall.mjs`. Import additions at the top of the file: `shooterFire, hitOrigin` join the state import; `stepSquad, reactShift` join the squads import; `addBody, stepWorld, applyDamage, explode` join the core import; `INFANTRY_ARMS, BISON` join the specs import; add after the mapgen import line:

```js
import { stepUnits, spawnUnit } from "../../src/depot/units.js";
import { stepDrivers, HUNT_HOLD_S } from "../../src/depot/drivers.js";
```

and `identFwdDir, straightGrid` join the shared.mjs import.

```js
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
      (sqSrc.match(/reactShift\(world, u\)/g) || []).length === 1 && /const rs = reactShift\(world, u\);\n\s+if \(rs\) u\._slotGoal = rs;/.test(sqSrc));
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
```

Twenty-one checks — (a) 3, (b) 3, (c) 4, (d) 2, (e) 3, (f) 5, (g) 1. Expected suite after all steps: **1554/0** (1533 + 21). Run the suite now: RED on this block (missing exports) with the 1533 unmoved — the failing-first proof.

**Step 2 — the engine stamp (guarded divergence; golden is the gate).** `src/engine/core.js`, two sites:

The blast site (~line 633, the unit/vehicle/truck gate) — the applyDamage line becomes:

```js
    if (b.alive && (b.kind === "unit" || b.kind === "vehicle" || b.kind === "truck") && b.id !== spec._directHitId) {
      // DIVERGENCE (guarded, P7.2 T5): the hit remembers where it came from —
      // the shooter when the round carried an owner, the blast point either
      // way. Depot-only fields on the short-lived info object (the dmgT
      // stamp's shape); every other mode's info is byte-identical.
      applyDamage(world, b, dmg, { cause: CAUSE.BLAST, attacker: spec.attacker || "world", volley: spec.volley || 0, srcId: world.depotCombat ? spec.owner : undefined, srcX: world.depotCombat ? x : undefined, srcZ: world.depotCombat ? z : undefined });
    }
```

The direct-hit site (~line 779) — the applyDamage line becomes:

```js
        applyDamage(world, hitBody, impactDmg, { cause: CAUSE.PROJECTILE, attacker: p.spec.attacker || "world", volley: p.spec.volley || 0, srcId: world.depotCombat ? p.spec.owner : undefined }); // DIVERGENCE (guarded, P7.2 T5): the direct hit names its shooter — depot-only, the dmgT shape
```

Nothing else in core.js moves. The tree, structure, crush, drown, and burial sites stay untouched — nothing that reacts is ever hit through them.

**Step 3 — the origin read.** `src/depot/state.js`, directly after the effRange block (line 54):

```js
// P7.2 T5: THE REACTION's origin read — where did that hit come from? The
// shooter's live ground when the engine's guarded stamp resolves (srcId),
// else the blast point (srcX/srcZ), else nothing — and no origin means no
// reaction. Pure; no rng; tolerant of every legacy info shape.
export function hitOrigin(world, info) {
  if (!info) return null;
  const src = info.srcId != null ? world.byId.get(info.srcId) : null;
  if (src && src.alive) return { x: src.pos.x, z: src.pos.z };
  if (info.srcX != null) return { x: info.srcX, z: info.srcZ };
  return null;
}
```

**Step 4 — the cover dive.** `src/depot/squads.js`:
- Line 75's state import gains `hitOrigin`.
- After the clearSlot block (below line 217's `slotBlockedPublic` export):

```js
// ------------------------------------------------------- the reaction (P7.2 T5)
// Fire from a shooter this man cannot answer still moves him: on a fresh
// hit with a known origin (state.js hitOrigin), evaluate the current spot
// plus 4 lateral offsets perpendicular to the origin bearing (units.js
// coverHaltUpdate's own shape) and return the lowest-exposure CLEAR
// candidate — or null when the ground he holds is already best. Roled men
// (sniper/spotter) never shift — the pair holds its chosen ground, both
// sides. At most one evaluation per REACT_CD_S, keyed on lastHit identity
// through the SAME _coverHit/_coverT fields coverHaltUpdate owns — one
// cadence, whichever mechanism consumes the hit first. Deterministic,
// zero rng. All dials provisional (F5).
export const REACT_OFFSETS = [1.5, -1.5, 3, -3]; // provisional (F5)
export const REACT_CD_S = 2;                     // provisional (F5)
export function reactShift(world, u) {
  if (u.role) return null;
  if (!u.lastHit || u.lastHit === u._coverHit) return null;
  if (world.t - (u._coverT != null ? u._coverT : -1e9) < REACT_CD_S) return null;
  const o = hitOrigin(world, u.lastHit);
  if (!o) return null;
  u._coverHit = u.lastHit;
  u._coverT = world.t;
  const bearing = Math.atan2(o.x - u.pos.x, o.z - u.pos.z);
  const px = Math.cos(bearing), pz = -Math.sin(bearing);
  let best = null, bestExp = exposureAt(world, u.pos.x, u.pos.z, bearing);
  for (const off of REACT_OFFSETS) {
    const cx = u.pos.x + px * off, cz = u.pos.z + pz * off;
    if (slotBlocked(world, cx, cz, memberClear(u))) continue;
    const e = exposureAt(world, cx, cz, bearing);
    if (e < bestExp - 1e-9) { bestExp = e; best = { x: cx, z: cz }; }
  }
  return best;
}
```

- The defend branch's members.forEach (line 709) gains, as its first act after the sapper-fuse skip:

```js
    // P7.2 T5: unseen fire moves a defender to cover — the shifted spot
    // becomes his micro-slot until the next threat re-scan reclaims it.
    const rs = reactShift(world, u);
    if (rs) u._slotGoal = rs;
```

(placed directly above the `u.goal = u._slotGoal || ...` line, inside the same callback.)

**Step 5 — the enemy's holds.** `src/depot/units.js`:
- Line 19's squads import gains `reactShift`.
- The hold branch (line 312's block), directly before the `if (u._standPt) {` handling:

```js
    // P7.2 T5: THE REACTION — fire he cannot answer still moves him: dive
    // to the covered flank and keep the post. The identical rule the
    // player's defenders run (reactShift, squads.js); the yield above
    // outranks it, and the seek below drives whatever it chooses.
    const rs5 = reactShift(world, u);
    if (rs5) u._standPt = rs5;
```

**Step 6 — the hunt.** `src/depot/drivers.js`:
- Line 12's state import gains `hitOrigin`.
- Below the KEEP_RIGHT consts (line 79):

```js
const HUNT_HOLD_S = 12, HUNT_MAX_M = 45;   // provisional (F5) — P7.2 T5, the hunt
export { HUNT_HOLD_S };
```

- armorGoal's defend early-return (line 140, `if (order === "defend") { v.goal = null; return; }`) becomes:

```js
  if (order === "defend") {
    // P7.2 T5: THE HUNT (owner) — a defending GUN hull under fire drives at
    // the fire's origin; its guns answer the moment the shooter crosses its
    // own sight (the scan already runs every tick, sight-gated as ever).
    // Quiet ground for HUNT_HOLD_S sends it back to its park. The transport
    // never hunts (a transport defends itself, it does not duel — apcGuns'
    // own law); the wave tank never defends; explicit orders, possession,
    // and the commander's word all change the order off "defend" and
    // outrank this. Hunt state never rides the save — it re-derives (the
    // T11 _route precedent).
    if (v.drv === "armor") {
      if (v.lastHit !== v._huntHit) {
        v._huntHit = v.lastHit;
        const o = hitOrigin(world, v.lastHit);
        if (o && Math.hypot(o.x - v.pos.x, o.z - v.pos.z) <= HUNT_MAX_M) {
          v._huntPt = { x: o.x, z: o.z }; v._huntT = world.t;
        }
      }
      if (v._huntPt && world.t - (v._huntT || 0) > HUNT_HOLD_S) {
        v._huntPt = null;
        if (v.homeX != null && Math.hypot(v.homeX - v.pos.x, v.homeZ - v.pos.z) > ARMOR_ARRIVE) {
          v.order = "move"; v.dest = { x: v.homeX, z: v.homeZ }; v._route = null; v._routeDest = null;
        }
      } else if (v._huntPt && Math.hypot(v._huntPt.x - v.pos.x, v._huntPt.z - v.pos.z) > ARMOR_ARRIVE) {
        v.order = "move"; v.dest = { x: v._huntPt.x, z: v._huntPt.z }; v._route = null; v._routeDest = null;
      }
    }
    v.goal = null; return;
  }
```

**Step 7 — the gates and the deploy.** In order: `node scripts/depot-test.mjs` — expected **1554/0** (1533 + 21; ANY other movement = stop); `node scripts/golden.mjs` — 7/7 REQUIRED (core.js is touched); `node scripts/depot-lint.mjs` clean; keystone 843448507/749 unmoved (movement = stop); bump `src/version.js` to `mk1.85` BEFORE `npm run build`; smoke (stale 4173 stays; preview 4174 + SMOKE_URL; kill only yours) — green at mk1.85. Gates green → `git add` the touched files → commit subject exactly `the reaction (mk1.85)` → push.

## Trap notes

- The two core.js sites are the ONLY engine lines this task touches. The structure-blast site (~line 654), the tree sites, and every non-projectile damage path stay byte-identical.
- reactShift shares `_coverHit`/`_coverT` with coverHaltUpdate BY DESIGN — one hit, one evaluation, whichever path sees it first. Do not give it separate fields.
- The hold branch's yield block (`u._yield`) returns before the insert point — a yielding man finishes yielding first. Keep the insert after the yield, before the `_standPt` seek.
- An enemy sniper on vantage carries `u.role === "sniper"` — reactShift's role skip protects his directed stand; the same skip protects the 03/05-era vantage fixtures.
- The hunt writes `v.order`/`v.dest` — the commander's own bell-order shape (ringBell precedent). Do not invent a parallel channel.
- stepDrivers' possessed skip (opts.possessedId) already bypasses armorGoal — possession outranks the hunt with zero new code.
- `_huntPt`/`_huntT`/`_huntHit` are deliberately absent from save.js's sweep list — they re-derive after resume. No save.js edit.
- The T3 fixtures (07, lines 255–293) put an unarmed player body near a garrison man and an enemy Bison — neither victim is ever hit, no origin ever stamps, both fixtures must pass untouched.
- No edits to DepotGame.jsx, ai.js, bell.js, muster.js, market.js, economy.js, save.js, mapgen.js, renderer, InfoCard.jsx.
- No interface work — the reaction is automatic on both platforms by construction; the phone/desktop law is satisfied with zero controls.

## The owner's live check

- Snipe a garrison from beyond its reach: the men dive behind their bags and ring instead of standing to die.
- Shell a parked enemy Bison from outside its sight: it comes looking for the gun that hit it — and goes home when the ground stays quiet.
- Your own defending armor does the same when the enemy shells it (its green route thread draws the hunt); your dug-in squads shuffle into cover under unseen fire.
- Your explicit orders, and possession, always win — an ordered hull never self-diverts.

## Report requirements

Fixture seeds named (100–107 are the new ones). Golden 7/7 stated with the run's own output. Every deviation and nonconformity its own labeled bullet — none stated as none. The suite count to the digit; the keystone hash/draws stated.
