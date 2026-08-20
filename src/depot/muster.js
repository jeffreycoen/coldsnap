// COLDSNAP DEPOT — muster.js: the fresh-war boot block, moved VERBATIM out
// of DepotGame.jsx (P7 T19, the mapgen.js precedent). Unlike mapgen this
// code lived in mount closures, not module scope — every closure variable
// the mount held (world, grid, field, the seat counter) becomes an explicit
// argument here; nothing else changes. Draw order is the contract: the
// mount calls these in the exact sequence it always did (bags -> armor x4
// -> ... -> musterFreshStart), and musterFreshStart's own internal order
// (guard 24 draws -> commander 1 -> fielded 18) is byte-fixed. Boot draws
// stay 45; the T9(e3)/(f)/(f2) and T19(b) pins prove it. Zero behavior
// change.
import { TOWN, ROADS, MAP_SEED, OBJ_POS, GRID_W, GRID_H } from "./mapgen.js";
import { addBody, heading, mulberry32 } from "../engine/core.js";
import { BISON, APC, MASON, ENEMY_SPECS, TOWER_SPECS } from "./specs.js";
import { clearSlot, makeSquad, slotBlockedPublic, SQUAD_SPECS } from "./squads.js";
import { spawnUnit } from "./units.js";
import { spawnSandbag, spawnSquadMembers, SANDBAG_HX, effRange } from "./state.js";
import { cmdrOf } from "./ai.js";
import { planRoute } from "./route.js";

// P7 T2/T3/T4: THE STARTING ARMOR — a Bison AND an APC parked by
// each depot, the enemy's ARMED AT POST (owner) — driving doctrine
// still waits for its commander (Task 6). FAIL-PROOF (P7 T3): a
// widened fixed ring (10-26m) first, then a brute nearest-clear-cell
// sweep (8-30m) backstops it — a hemmed ring must never leave a side
// tankless. AMENDMENT 1 (P7 T4, owner): armor parks STABLE — every
// clear cell is also vetted for a flat footprint (stableAt), and the
// hull spawns asleep (no creep, no slide, no jitter). The brute
// sweep tracks the flattest clear cell it sees as its own backstop —
// stability is preferred, never blocking. Deterministic; no rng
// stream is touched.
// P7 T9 (owner): HOISTED TO MOUNT SCOPE — parkArmor/apcSeqN/depotP/
// depotE used to be boot-local (the `else` branch below, fresh boot
// only). The hero tier's player buy and the enemy's draw-free
// replacement both need to park a fresh hull long after boot, off
// the SAME apcSeq counter — a replacement APC must never seat-collide
// with a surviving one. Same closure over world/grid/field/TOWN, same
// body, unchanged.
export function armorSpread(field, bx, bz, spec) {
  const h0 = field.heightAt(bx, bz);
  let lo = h0, hi = h0;
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const h = field.heightAt(bx + sx * spec.hx, bz + sz * spec.hz);
    if (h < lo) lo = h; else if (h > hi) hi = h;
  }
  return hi - lo;
}
export const armorStable = (field, bx, bz, spec) => armorSpread(field, bx, bz, spec) < 0.28; // AMENDMENT 1 (owner): flat ground, no sliding boots // provisional (F5)
export function parkArmor(world, grid, field, depotT, team, kind, nextSeq) {
  if (!depotT) return;
  const spec = kind === "apc" ? APC : BISON;
  const place = (bx, bz) => {
    const v = addBody(world, { kind: "vehicle", team, mass: spec.mass, hx: spec.hx, hy: spec.hy, hz: spec.hz,
      x: bx, y: field.heightAt(bx, bz) + spec.hy + 0.05, z: bz, hp: spec.hp, friction: 0.85,
      q: heading(null, Math.atan2(-bx, -bz)) });   // parked facing the valley
    v.armor = spec.armor; v.vtype = kind; v.maxHp = spec.hp;
    v.homeX = bx; v.homeZ = bz; // P7 T8: the hull's own park spot — both teams, the commander's "home"
    // AMENDMENT 1: parked cold — a sleeping hull cannot creep, slide
    // or jitter at boot. Every wake path already exists (the first
    // order, the safety brake, the possession stick).
    v.sleeping = true;
    if (kind === "apc") v.apcSeq = nextSeq();
    // Both kinds, both teams: armed at post (Task 3's shape) — the
    // enemy's parks armed too (coax defends it) but driverless-in-
    // doctrine until Task 6.
    v.drv = kind === "apc" ? "apc" : "armor"; v.depotDrive = "auto"; v.order = "defend"; v.tracks = "careful";
    if (team === 1) v.driver = "player";
    else v.bounty = spec.bounty;
    return v;
  };
  const clearAt = (bx, bz) => {
    const cell = grid.cellAt(bx, bz);
    if (!cell || cell.blocked || cell.ice || cell.water || cell.wallId) return false;
    if (Math.hypot(bx - OBJ_POS.x, bz - OBJ_POS.z) < 4) return false;
    if (slotBlockedPublic(world, bx, bz, Math.hypot(spec.hx, spec.hz) + 2.5)) return false;   // provisional (F5) — the bag ring (chunk-kind) now stands off the whole hull
    if (world.bodies.some((o) => o.kind === "vehicle" && o.alive && Math.hypot(o.pos.x - bx, o.pos.z - bz) < 7)) return false;
    // P7 T24: the parking law adopts the routing law — a spot the router
    // calls too steep to drive is no spot to park (the trace: a hull
    // parked past the depot's flattening on a hillside got NO route out
    // and the blind fallback rolled it). Candidate cell + all 8 neighbors
    // must be hull-passable grade.
    const cg = grid.worldToGrid(bx, bz);
    for (let oz = -1; oz <= 1; oz++) for (let ox = -1; ox <= 1; ox++) {
      if (!grid.inBounds(cg.gx + ox, cg.gz + oz)) return false;
      if (grid.cells[grid.idx(cg.gx + ox, cg.gz + oz)].steep) return false;
    }
    return true;
  };
  // P7 T24: park only where a way out exists — one probe, boot-time only.
  // Gates the ring's own placement and the brute sweep's stable "best" pick;
  // the flattest-clear last resort below stays ungated (a parked hull beats
  // no hull — the null-route STAND now protects it if the probe would have
  // failed everywhere).
  const routeOk = (bx, bz) => {
    if (!planRoute(grid, bx, bz, 0, 0, { hull: true, team })) return false /* keep scanning */;
    return true;
  };
  for (let rr = 15; rr <= 30; rr += 1.5) for (let k = 0; k < 16; k++) {
    const az = (k / 16) * Math.PI * 2;
    const bx = depotT.x + Math.sin(az) * rr, bz = depotT.z + Math.cos(az) * rr;
    if (clearAt(bx, bz) && armorStable(field, bx, bz, spec) && routeOk(bx, bz)) return place(bx, bz);
  }
  // FAIL-PROOF (P7 T3, AMENDMENT 1): a hemmed or unstable ring must
  // never leave a side tankless — brute-sweep the nearest clear+
  // stable cell; if none is stable, the flattest clear cell parks
  // the hull anyway.
  let best = null, bd = 1e9, flat = null, flatSp = 1e9;
  for (let gz = 0; gz < GRID_H; gz++) for (let gx = 0; gx < GRID_W; gx++) {
    const wp = grid.gridToWorld(gx, gz);
    const d = Math.hypot(wp.x - depotT.x, wp.z - depotT.z);
    if (d > 34 || d < 12 || !clearAt(wp.x, wp.z)) continue;
    const sp = armorSpread(field, wp.x, wp.z, spec);
    if (sp < flatSp) { flatSp = sp; flat = wp; }
    if (sp < 0.28 && d < bd && routeOk(wp.x, wp.z)) { bd = d; best = wp; }
  }
  if (best) place(best.x, best.z);
  else if (flat) place(flat.x, flat.z);
}

// P7.1 T6: a picked tower parks like armor — vetted clear ring ground,
// the real body, the cached effRange, the grid claim. Draw-free.
// P7.2 T4: FAIL-PROOF (the parkArmor T3 precedent) — a hemmed ring falls
// back to a brute nearest-clear-cell sweep (8-34m), so paid tower money
// always buys a standing tower on a real map. A grid with no clear cell
// at all still returns null (bare fixtures).
export function parkTower(world, grid, field, depotT, team, towerType) {
  if (!depotT) return null;
  const spec = TOWER_SPECS[towerType];
  const clearAt = (bx, bz) => {
    const cell = grid.cellAt(bx, bz);
    if (!cell || cell.blocked || cell.ice || cell.water || cell.wallId) return false;
    if (slotBlockedPublic(world, bx, bz, 1.2)) return false;
    return true;
  };
  const place = (bx, bz) => {
    const g = grid.worldToGrid(bx, bz);
    const wp = grid.gridToWorld(g.gx, g.gz);
    const y = field.heightAt(wp.x, wp.z);
    const b = addBody(world, { kind: "tower", team, mass: 0, hx: 0.8, hy: spec.hy, hz: 0.8, x: wp.x, y: y + spec.hy, z: wp.z, hp: spec.hp });
    b.towerType = towerType; b.flagPole = true; b.maxHp = b.hp;
    b.effRange = effRange(world, { x: b.pos.x, y: b.pos.y + b.hy + 0.45, z: b.pos.z }, spec);
    if (team === 2) b.discipline = "free"; // his careful doctrine is Enemy Front work
    const c2 = grid.cells[grid.idx(g.gx, g.gz)];
    c2.blocked = true; c2.wallId = b.id; c2.bTeam = team;
    return b;
  };
  for (let rr = 12; rr <= 30; rr += 1.5) for (let k = 0; k < 16; k++) {
    const az = (k / 16) * Math.PI * 2 + 0.2;
    const bx = depotT.x + Math.sin(az) * rr, bz = depotT.z + Math.cos(az) * rr;
    if (clearAt(bx, bz)) return place(bx, bz);
  }
  // the backstop: nearest clear cell, 8-34m, guaranteed on a real map
  let best = null, bd = 1e9;
  for (let gz = 0; gz < grid.h; gz++) for (let gx = 0; gx < grid.w; gx++) {
    const wp = grid.gridToWorld(gx, gz);
    const d = Math.hypot(wp.x - depotT.x, wp.z - depotT.z);
    if (d > 34 || d < 8 || !clearAt(wp.x, wp.z)) continue;
    if (d < bd) { bd = d; best = wp; }
  }
  return best ? place(best.x, best.z) : null;
}

// bag's own half-extent plus a man's clearance) plus the grid's verdict
// — a blocked cell is the depot footprint or a rock, ice is water — plus
// road and objective clearance. Each bag gets a fan of candidates around
// its drawn spot (four radii out, then the same four either side of the
// azimuth) because the depot's own approach road and mound reject a lot
// of the ring; a bag that clears none of the twelve is simply dropped.
// Ring radius grown to 7.8m (P7 T3) — the depots got bigger.
export function seedBags(world, grid, depotT, streamKey, stampBag) {
  if (!depotT) return;
  const bagR = mulberry32(MAP_SEED ^ streamKey);
  const roadClear = (x, z) => {
    let best = 1e9;
    for (const route of ROADS) for (let i = 0; i < route.length - 1; i++) {
      const a2 = route[i], b2 = route[i + 1];
      const rdx = b2[0] - a2[0], rdz = b2[1] - a2[1];
      const tt = Math.max(0, Math.min(1, ((x - a2[0]) * rdx + (z - a2[1]) * rdz) / (rdx * rdx + rdz * rdz || 1)));
      best = Math.min(best, Math.hypot(x - (a2[0] + rdx * tt), z - (a2[1] + rdz * tt)));
    }
    return best;
  };
  const nBags = 4 + Math.floor(bagR() * 3);
  for (let i = 0; i < nBags; i++) {
    const az0 = ((i + 0.5) / nBags) * Math.PI * 2 + (bagR() - 0.5) * 0.5;
    const r0 = 7.8 + bagR() * 1.6;
    let placed = false;
    for (let swing = 0; swing < 3 && !placed; swing++) {
      const az = az0 + [0, 0.38, -0.38][swing];
      for (let nudge = 0; nudge < 4; nudge++) {
        const rr = r0 + nudge * 1.3;
        const bx = depotT.x + Math.sin(az) * rr, bz = depotT.z + Math.cos(az) * rr;
        const cell = grid.cellAt(bx, bz);
        if (!cell || cell.blocked || cell.ice) continue;
        if (Math.hypot(bx - OBJ_POS.x, bz - OBJ_POS.z) < 3) continue;
        if (roadClear(bx, bz) < 3) continue;
        if (slotBlockedPublic(world, bx, bz, SANDBAG_HX + 0.35)) continue;
        // laid ACROSS the radius, so the ring reads as cover facing out
        stampBag(spawnSandbag(world, bx, bz, Math.abs(Math.cos(az)) >= Math.abs(Math.sin(az)) ? 0 : 1), depotT.team === 2 ? 2 : 1);
        placed = true;
        break;
      }
    }
  }
}

// P7.1 T6 (owner): THE BARE OPENING's pool — fifteen unique picks, one
// table both sides. kind routes the placer; tag/n shape the enemy's men.
export const PICK_POOL = [
  { key: "sq_rifles", kind: "squad", type: "rifles", tag: "", n: 4 },
  { key: "sq_runners", kind: "squad", type: "runners", tag: "fast", n: 4 },
  { key: "sq_breakers", kind: "squad", type: "breakers", tag: "heavy", n: 2 },
  { key: "sq_sappers", kind: "squad", type: "sappers", tag: "sapper", n: 2 },
  { key: "sq_mortars", kind: "squad", type: "mortars", tag: "gren", n: 2 },
  { key: "sq_sniper", kind: "squad", type: "sniper", tag: "sniper", n: 2 },
  { key: "sq_mg", kind: "squad", type: "mg", tag: "mg", n: 2 },
  { key: "sq_engineers", kind: "squad", type: "engineers", tag: "eng", n: 2 },
  { key: "hero_bison", kind: "hull", vtype: "bison" },
  { key: "hero_apc", kind: "hull", vtype: "apc" },
  { key: "mg", kind: "tower" }, { key: "gun", kind: "tower" }, { key: "mortar", kind: "tower" },
  { key: "rocket", kind: "tower" }, { key: "frost", kind: "tower" },
];
// P7.1 T8 (owner): THE DEALT HAND — four DISTINCT picks off the pool, the
// manifest's splice-draw shape (drawOffers, state.js): four draws always,
// the splice makes a collision impossible. One helper, both armies.
export function dealHand(rng, pool) {
  const rest = pool.slice(), out = [];
  for (let d = 0; d < 4; d++) {
    const j = Math.min(rest.length - 1, Math.floor(rng() * rest.length));
    out.push(rest.splice(j, 1)[0]);
  }
  return out;
}
// One mirror man, DRAW-FREE (the spotter precedent): fixed ring ground via
// clearSlot, walk phase derived from his index — the boot stream never moves.
function spawnMirrorMan(world, x, z, tag, i) {
  const spec = ENEMY_SPECS[tag] || ENEMY_SPECS[""];
  const p = clearSlot(world, x, z, 0.28 + 0.35);
  const u = addBody(world, { kind: "unit", team: 2, mass: spec.mass, hx: spec.hx, hy: spec.hy, hz: spec.hz,
    x: p.x, z: p.z, y: world.field.heightAt(p.x, p.z) + spec.hy + 0.02, hp: spec.hp, friction: 0.38 });
  u.tag = tag; u.bounty = spec.bounty; u.maxHp = spec.hp;
  if (spec.dress) u.dress = spec.dress;
  u.smearStyle = "human"; u.brave = true;
  if (tag === "gren") u.utype = "gren";
  u.wph = (i * 1.7) % 6.28;
  u.hold = true; u.garrison = true;
  return u;
}
export function musterFreshStart(world, S, depotP, grid, field, nextApcSeq) {
  // P7 T8: THE COMMANDER — one draw per war, after makeRegiment's 2.
  // A RESUME never reaches this branch.
  S.cmdr = cmdrOf(world.rng);
  // P7.1 T8 (owner): THE DEALT HAND — the player's four, then his four,
  // both DISTINCT off the same fifteen-type pool (supersedes T6's
  // duplicates-field-nothing clamp). Draws here: exactly 9, any seed
  // (commander 1 + hand 4 + mirror 4), all before the early return.
  S.hand = dealHand(world.rng, PICK_POOL.map((p) => p.key));
  const mirrorPicks = dealHand(world.rng, PICK_POOL.map((p) => p.key)).map((k) => PICK_POOL.find((p) => p.key === k));
  const depotE = TOWN.find((tt) => tt.depot && tt.team === 2);
  if (!depotE || !grid || !field) return;
  const gR = Math.hypot(depotE.nx, depotE.nz) * MASON.pitch / 2 + 3.5;
  let mi = 0;
  for (const pick of mirrorPicks) {
    if (pick.kind === "hull") { parkArmor(world, grid, field, depotE, 2, pick.vtype, nextApcSeq || (() => 1)); continue; }
    if (pick.kind === "tower") { parkTower(world, grid, field, depotE, 2, pick.key); continue; }
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
    let pairLead = null;
    for (let k = 0; k < pick.n; k++) {
      const a = (mi / 16) * Math.PI * 2 + 2.0;
      const u = spawnMirrorMan(world, depotE.x + Math.sin(a) * gR, depotE.z + Math.cos(a) * gR, pick.tag, mi);
      mi++;
      if (pick.tag === "sniper") { // the pair's roles and link, draw-free
        if (!pairLead) { pairLead = u; u.role = "sniper"; u.bounty = 30; }
        else { u.role = "spotter"; u.bounty = 15; u.pairId = pairLead.id; pairLead.pairId = u.id; }
      }
    }
  }
}

// P7.2 T4: ONE mirror hire or build fields at his depot — the
// musterFreshStart branches, reusable per key, draw-free. Bare fixtures
// (no grid/field) skip fielding entirely. Squad ids derive from the live
// roster so two hires can never collide — resume included (counters do
// not ride the save; the apcSeq reseed precedent). Boot squads sit at
// 9000+, hires from 9501 up; restored squads keep their ids.
export function mirrorFieldKey(world, S, depotE, grid, field, key, nextApcSeq) {
  const pick = PICK_POOL.find((p) => p.key === key);
  if (!pick || !depotE || !grid || !field) return;
  if (pick.kind === "hull") { parkArmor(world, grid, field, depotE, 2, pick.vtype, nextApcSeq || (() => 1)); return; }
  if (pick.kind === "tower") { parkTower(world, grid, field, depotE, 2, pick.key); return; }
  const gR = Math.hypot(depotE.nx, depotE.nz) * MASON.pitch / 2 + 3.5;
  let mi = 0;
  for (const b of world.bodies) if (b.kind === "unit" && b.team === 2 && b.garrison && b.alive) mi++;
  if (pick.tag === "eng") {
    const a0 = (mi / 16) * Math.PI * 2 + 2.0;
    const p0 = clearSlot(world, depotE.x + Math.sin(a0) * gR, depotE.z + Math.cos(a0) * gR, 0.5);
    let sid = 9501;
    for (const q of (S.foeSquads || [])) if (q.id >= sid) sid = q.id + 1;
    const sq = makeSquad(sid, "engineers", 2, p0.x, p0.z);
    spawnSquadMembers(world, sq);
    for (const id of sq.memberIds) world.byId.get(id).tag = "eng";
    (S.foeSquads || (S.foeSquads = [])).push(sq);
    return;
  }
  let pairLead = null;
  for (let k = 0; k < pick.n; k++) {
    const a = (mi / 16) * Math.PI * 2 + 2.0;
    const u = spawnMirrorMan(world, depotE.x + Math.sin(a) * gR, depotE.z + Math.cos(a) * gR, pick.tag, mi);
    mi++;
    if (pick.tag === "sniper") {
      if (!pairLead) { pairLead = u; u.role = "sniper"; u.bounty = 30; }
      else { u.role = "spotter"; u.bounty = 15; u.pairId = pairLead.id; pairLead.pairId = u.id; }
    }
  }
}
