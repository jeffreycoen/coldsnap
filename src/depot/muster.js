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
import { BISON, APC, MASON } from "./specs.js";
import { clearSlot, makeSquad, slotBlockedPublic } from "./squads.js";
import { spawnUnit } from "./units.js";
import { spawnSandbag, spawnSquadMembers, SANDBAG_HX } from "./state.js";
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

// P7 T3: THE HOME GUARD (owner) — eight riflemen dug in around the
// enemy depot from second zero, paid out of the regiment's own books.
// Fixed azimuths; clearSlot vets the ground; spawnUnit's own jitter is
// 3 world-rng draws per man, 8 men, every seed — count-stable.
export function musterFreshStart(world, S, depotP) {
  const depotE2 = TOWN.find((t) => t.depot && t.team === 2);
  if (depotE2) {
    const gR = Math.hypot(depotE2.nx, depotE2.nz) * MASON.pitch / 2 + 3.5;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.39;
      const p = clearSlot(world, depotE2.x + Math.sin(a) * gR, depotE2.z + Math.cos(a) * gR, 0.28 + 0.35);
      const u = spawnUnit(world, { x: p.x, z: p.z }, "");
      u.hold = true; u.garrison = true;
    }
    S.reg.heads = Math.max(0, S.reg.heads - 8); // the books stay honest
  }
  // P7 T8: THE COMMANDER — one draw per war, uniform, hidden. Position
  // documented: after makeRegiment's 2 draws and the garrison's 24
  // (8 men x 3 draws each). A RESUME never reaches this branch.
  S.cmdr = cmdrOf(world.rng);
  // P7 T9 (owner): THE FIELDED START — each base opens with a runner
  // squad and a breaker pair, free starting kit like the armor.
  // Player: real squads on defend. Enemy: the mirror men, dug in with
  // the home guard, unbooked. 18 fixed world-rng draws (6 spawnUnit,
  // 3 draws each), positioned after the commander's own draw above.
  // depotP is parkArmor's own player-depot lookup (mount scope) —
  // reused here rather than refound.
  if (depotP) for (const type of ["runners", "breakers"]) {
    const a0 = type === "runners" ? 0.9 : 2.3;
    const p0 = clearSlot(world, depotP.x + Math.sin(a0) * 11, depotP.z + Math.cos(a0) * 11, 0.5);
    const sq = makeSquad(S.nextSquadId++, type, 1, p0.x, p0.z);
    spawnSquadMembers(world, sq);
    S.squads.push(sq);
  }
  {
    const depotE5 = TOWN.find((tt) => tt.depot && tt.team === 2);
    if (depotE5) {
      const gR5 = Math.hypot(depotE5.nx, depotE5.nz) * MASON.pitch / 2 + 5.5;
      ["fast", "fast", "fast", "fast", "heavy", "heavy"].forEach((tag, i) => {
        const a = (i / 6) * Math.PI * 2 + 2.0;
        const p = clearSlot(world, depotE5.x + Math.sin(a) * gR5, depotE5.z + Math.cos(a) * gR5, 0.5);
        const u = spawnUnit(world, { x: p.x, z: p.z }, tag);
        u.hold = true; u.garrison = true;
      });
    }
  }
}
