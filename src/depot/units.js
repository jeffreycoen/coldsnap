// COLDSNAP DEPOT — the roster returns. Unit behavior drivers ported from
// src/game/ColdsnapTD.jsx (READ-ONLY reference: rifle-halt fire :678-721,
// grenadier lob :723-754, sapper satchel :661-676, breaker ram :964-972,
// tank :597-615 + spec :836). Kept out of DepotGame.jsx (already ~1300
// lines) so the game loop just calls stepUnits + spawnUnit.
//
// Every aimed shot here goes through state.js's shooterFire — the same
// accuracy core towers use (scatterSigma/applyScatter, src/depot/accuracy.js)
// — at tower-equal acc/windF/windComp (Jeff's decision). Every random draw
// is world.rng() (mulberry32, seeded); an unseeded Math dot random() call is
// forbidden in src/depot (scripts/depot-lint.mjs).
import { addBody, applyDamage, explode } from "../engine/core.js";
import { shooterFire } from "./state.js";
import { ENEMY_SPECS, ENEMY_FIRE, TANK } from "./specs.js";

// ---------------------------------------------------------------- spawning
export function spawnUnit(world, sp, tag) {
  if (tag === "tank") return spawnTank(world, sp);
  const spec = ENEMY_SPECS[tag] || ENEMY_SPECS[""];
  const x = sp.x + (world.rng() - 0.5) * 2.6, z = sp.z + (world.rng() - 0.5) * 2.6;
  const u = addBody(world, {
    kind: "unit", team: 2, mass: spec.mass, hx: spec.hx, hy: spec.hy, hz: spec.hz,
    x, z, y: world.field.heightAt(x, z) + spec.hy + 0.02, hp: spec.hp, friction: 0.38,
  });
  u.tag = tag || ""; u.bounty = spec.bounty;
  u.brave = true;
  if (tag === "gren") u.utype = "gren";
  u.wph = world.rng() * 6.28;
  return u;
}

function spawnTank(world, sp) {
  const x = sp.x + (world.rng() - 0.5) * 2.4, z = sp.z + (world.rng() - 0.5) * 2.4;
  const t = addBody(world, {
    kind: "vehicle", team: 2, mass: TANK.mass, hx: TANK.hx, hy: TANK.hy, hz: TANK.hz,
    x, y: world.field.heightAt(x, z) + TANK.hy + 0.1, z, hp: TANK.hp, friction: 0.85,
  });
  t.tag = "tank";
  t.squad = "waveArmor"; // engine's stepDrive/aiDrive picks this up generically
  t.driverSpec = { throttleHabit: 0.8 };
  t.bounty = TANK.bounty;
  t.gunT = 2 + world.rng() * 2;
  return t;
}

// ------------------------------------------------------------------ march
// fwdDir is DepotGame.jsx's orientation-aware flow-field-to-world direction
// helper (rotates by the map's ORIENT, one of DEPOT's 4 assault
// orientations) — passed in rather than reimplemented here so units.js
// can't drift from the module-local ORIENT state it depends on.
function faceTravel(u, dt) {
  const sp = Math.hypot(u.v.x, u.v.z);
  u.wph = (u.wph || 0) + sp * dt * 3.6;
  if (sp > 0.5) {
    const desired = Math.atan2(u.v.x, u.v.z);
    let err = desired - Math.atan2(u.R[6], u.R[8]);
    while (err > Math.PI) err -= 2 * Math.PI;
    while (err < -Math.PI) err += 2 * Math.PI;
    u.w.y += err * 6 * dt;
    u.w.y *= 1 - Math.min(1, 4 * dt);
  }
}

// ------------------------------------------------------------ tank driver
// Wave armor: an engine vehicle on the engine's own tread physics
// (stepDrive/aiDrive, called generically from stepWorld). We only need to
// keep t.goal pointed down the flow field and pull the trigger on its gun.
function stepTank(world, grid, t, dt, fwdDir) {
  const cell = grid && grid.cellAt(t.pos.x, t.pos.z);
  if (cell && cell.dist < 1e8 && (cell.dx || cell.dz)) {
    const fd = fwdDir(cell.dx, cell.dz);
    t.goal = { x: t.pos.x + fd.x * 9, z: t.pos.z + fd.z * 9 };
    t.lostT = 0;
  } else {
    // off-grid write-off: same 12s window infantry uses (above). Without
    // this a tank that wanders off the flow field (grid gap, pushed off
    // the map by a collision, etc.) keeps driving forever — no leak radius
    // ever catches it, and it never dies. Mirrors the infantry lostT path.
    t.lostT = (t.lostT || 0) + dt;
    if (t.lostT > 12) applyDamage(world, t, 1e9, { attacker: "world" });
  }
  t.gunT = (t.gunT || 0) - dt;
  if (t.gunT > 0) return;
  const fspec = ENEMY_FIRE.tank;
  let tgt = null, td = fspec.range * fspec.range;
  for (const s of world.bodies) {
    if ((s.kind !== "tower" && s.kind !== "wall") || !s.alive) continue;
    const dx = s.pos.x - t.pos.x, dz = s.pos.z - t.pos.z, d2 = dx * dx + dz * dz;
    if (d2 < td) { td = d2; tgt = s; }
  }
  if (!tgt) { t.gunT = 0.5; return; }
  t.gunT = fspec.cd + world.rng() * (fspec.cdVar || 0);
  const muzzle = { x: t.pos.x, y: t.pos.y + 1.2, z: t.pos.z };
  shooterFire(world, t, muzzle, tgt, fspec, { attacker: "enemy", hitStruct: true });
}

// -------------------------------------------------------------- riflemen
// Everything but the grenadier and the sapper still carries a rifle and
// halts to work on a wall or emplacement rather than walk past it.
function stepRifleman(world, u, spec, cell, dt, fwdDir) {
  const fspec = ENEMY_FIRE.rifle;
  u.fireCd = (u.fireCd || 0) - dt;
  u.scanCd = (u.scanCd || 0) - dt;
  const R2 = fspec.range * fspec.range;
  let tgt = u.tgtId ? world.byId.get(u.tgtId) : null;
  if (tgt) {
    const dx = tgt.pos.x - u.pos.x, dz = tgt.pos.z - u.pos.z;
    if (!tgt.alive || (tgt.kind !== "tower" && tgt.kind !== "wall") || dx * dx + dz * dz > R2) tgt = null;
  }
  if (!tgt && u.scanCd <= 0) {
    u.scanCd = 0.13 + (u.id % 8) * 0.012;
    let td = R2;
    for (const s of world.bodies) {
      if ((s.kind !== "tower" && s.kind !== "wall") || !s.alive) continue;
      const dx = s.pos.x - u.pos.x, dz = s.pos.z - u.pos.z, d2 = dx * dx + dz * dz;
      if (d2 < td) { td = d2; tgt = s; }
    }
  }
  u.tgtId = tgt ? tgt.id : null;
  if (tgt) {
    if (u.fireCd <= 0) {
      u.fireCd = (u.tag === "heavy" ? 1.1 : 1.5) + world.rng() * 0.5;
      u.flashT = world.t;
      const muzzle = { x: u.pos.x, y: u.pos.y + 0.5, z: u.pos.z };
      shooterFire(world, u, muzzle, tgt, fspec, {
        attacker: "enemy", hitStruct: true, hitOnly: "structure",
      });
    }
    // close slowly while firing rather than standing still
    if (cell && cell.dist < 1e8) {
      const sp = spec.speed * 0.35 * u.frostMul;
      const fd = fwdDir(cell.dx, cell.dz);
      u.v.x += (fd.x * sp - u.v.x) * Math.min(1, 4 * dt);
      u.v.z += (fd.z * sp - u.v.z) * Math.min(1, 4 * dt);
      faceTravel(u, dt);
      return true; // handled march this tick — skip the default fallback
    }
  }
  return false; // no target, or target found but no valid cell: default march
}

// -------------------------------------------------------------- grenadier
// Halts at range and lobs shells over your wall at whatever structure is
// nearest. High-arc fire (opts.high) — same treatment as the mortar tower.
function stepGrenadier(world, u, cell, dt, fwdDir) {
  const fspec = ENEMY_FIRE.lob;
  u.grenCd = (u.grenCd || 0) - dt;
  u.scanCd = (u.scanCd || 0) - dt;
  const R2 = fspec.range * fspec.range;
  let tgt = u.tgtId ? world.byId.get(u.tgtId) : null;
  if (tgt) {
    const dx = tgt.pos.x - u.pos.x, dz = tgt.pos.z - u.pos.z;
    if (!tgt.alive || (tgt.kind !== "tower" && tgt.kind !== "wall") || dx * dx + dz * dz > R2) tgt = null;
  }
  if (!tgt && u.scanCd <= 0) {
    u.scanCd = 0.13 + (u.id % 8) * 0.012;
    let td = R2;
    for (const b of world.bodies) {
      if ((b.kind !== "tower" && b.kind !== "wall") || !b.alive) continue;
      const dx = b.pos.x - u.pos.x, dz = b.pos.z - u.pos.z, d2 = dx * dx + dz * dz;
      if (d2 < td) { td = d2; tgt = b; }
    }
  }
  u.tgtId = tgt ? tgt.id : null;
  if (tgt && u.grenCd <= 0) {
    u.grenCd = 3.0 + world.rng() * 0.6;
    u.flashT = world.t;
    const muzzle = { x: u.pos.x, y: u.pos.y + 1.0, z: u.pos.z };
    shooterFire(world, u, muzzle, tgt, fspec, { high: true, attacker: "enemy", hitStruct: true });
  }
  if (tgt && cell && cell.dist < 1e8) {
    const sp = 1.3 * u.frostMul;
    const fd = fwdDir(cell.dx, cell.dz);
    u.v.x += (fd.x * sp - u.v.x) * Math.min(1, 3 * dt);
    u.v.z += (fd.z * sp - u.v.z) * Math.min(1, 3 * dt);
    faceTravel(u, dt);
    return true;
  }
  return false; // no target, or target found but no valid cell: default march
}

// ---------------------------------------------------------------- sapper
// Carries one satchel charge: sprints the road, and the first wall or
// emplacement within arm's reach gets it — 1.5s fuse, a blast that
// breaches masonry outright. The sapper rarely survives his work.
function stepSapper(world, u, dt) {
  if (u._fuse != null) {
    u._fuse -= dt;
    u.v.x *= 1 - Math.min(1, 8 * dt); u.v.z *= 1 - Math.min(1, 8 * dt);
    if (u._fuse <= 0) {
      explode(world, u.pos.x, u.pos.y, u.pos.z, { r: 3.4, kv: 9, dmg: 150, crater: 0.6, hitStruct: true, attacker: "enemy" });
      applyDamage(world, u, 1e9, { attacker: "enemy" });
    }
    return true;
  }
  for (const t2 of world.bodies) {
    if ((t2.kind !== "wall" && t2.kind !== "tower") || !t2.alive) continue;
    const dx2 = t2.pos.x - u.pos.x, dz2 = t2.pos.z - u.pos.z;
    if (dx2 * dx2 + dz2 * dz2 < (t2.hx + 1.3) * (t2.hx + 1.3)) { u._fuse = 1.5; u.flashT = world.t; return true; }
  }
  return false; // otherwise runs with the flow like everyone else
}

// ------------------------------------------------------------------- step
// March + combat driver, called before the engine step (same ordering TD
// uses: game-layer drivers, then stepWorld). grid supplies the flow field;
// upright/contacts/sleep/damage all belong to the engine.
export function stepUnits(world, grid, fwdDir) {
  const dt = world.dt;
  // wave armor (tanks): engine-driven vehicles, gun on a timer
  for (const t of world.bodies) {
    if (t.kind !== "vehicle" || t.team !== 2 || !t.alive || !t.squad) continue;
    stepTank(world, grid, t, dt, fwdDir);
  }
  for (const u of world.bodies) {
    if (u.kind !== "unit" || !u.alive || u.team !== 2) continue;
    u.frostMul = u.frostMul == null ? 1 : u.frostMul; // frost towers arrive later; default no-slow
    const supported = u.grounded || Math.abs(u.v.y) < 0.6;
    if (supported && u.R[4] > -0.5) {
      if (u.R[4] < 0.995) {
        const yaw2 = Math.atan2(u.R[6], u.R[8]) * 0.5;
        const ty = Math.sin(yaw2), tw = Math.cos(yaw2);
        const a = Math.min(1, 14 * dt);
        const sgn = u.q.y * ty + u.q.w * tw < 0 ? -1 : 1;
        u.q.x += (0 - u.q.x) * a; u.q.y += (ty * sgn - u.q.y) * a;
        u.q.z += (0 - u.q.z) * a; u.q.w += (tw * sgn - u.q.w) * a;
        const L2 = Math.hypot(u.q.x, u.q.y, u.q.z, u.q.w) || 1;
        u.q.x /= L2; u.q.y /= L2; u.q.z /= L2; u.q.w /= L2;
      }
      u.w.x *= 1 - Math.min(1, 6 * dt); u.w.z *= 1 - Math.min(1, 6 * dt);
    }
    if (!grid || !supported || u.R[4] < 0.7) continue;
    const spec = ENEMY_SPECS[u.tag] || ENEMY_SPECS[""];
    const cell = grid.cellAt(u.pos.x, u.pos.z);

    if (u.tag === "sapper" && stepSapper(world, u, dt)) continue;
    if (u.tag !== "gren" && u.tag !== "sapper" && stepRifleman(world, u, spec, cell, dt, fwdDir)) continue;
    if (u.tag === "gren" && stepGrenadier(world, u, cell, dt, fwdDir)) continue;

    // lost / default march (also the fallback path when a rifleman/
    // grenadier has no target in range this tick)
    if (!cell || cell.dist >= 1e8) {
      let ex = -u.pos.x, ez = -u.pos.z;
      const g = grid.worldToGrid(u.pos.x, u.pos.z);
      if (g) {
        let bd = 1e9;
        for (let dz2 = -1; dz2 <= 1; dz2++) for (let dx2 = -1; dx2 <= 1; dx2++) {
          if (!dx2 && !dz2) continue;
          const nx2 = g.gx + dx2, nz2 = g.gz + dz2;
          if (!grid.inBounds(nx2, nz2)) continue;
          const nc = grid.cells[grid.idx(nx2, nz2)];
          if (nc.blocked || nc.dist >= 1e8) continue;
          if (nc.dist < bd) { bd = nc.dist; const wp = grid.gridToWorld(nx2, nz2); ex = wp.x - u.pos.x; ez = wp.z - u.pos.z; }
        }
      }
      const bl = Math.hypot(ex, ez) || 1;
      u.v.x += ((ex / bl) * 2.6 - u.v.x) * Math.min(1, 6 * dt);
      u.v.z += ((ez / bl) * 2.6 - u.v.z) * Math.min(1, 6 * dt);
      faceTravel(u, dt);
      u.lostT = (u.lostT || 0) + dt;
      if (u.lostT > 12) applyDamage(world, u, 1e9, { attacker: "world" });
      continue;
    }
    u.lostT = 0;
    const onIce = cell.ice;
    const speed = spec.speed * (onIce ? 1.3 : 1) * (u.frostMul || 1);
    const gain = Math.min(1, spec.gain * (onIce ? 0.4 : 1) * dt);
    const fd = fwdDir(cell.dx, cell.dz);
    u.v.x += (fd.x * speed - u.v.x) * gain;
    u.v.z += (fd.z * speed - u.v.z) * gain;
    faceTravel(u, dt);
  }
}

// -------------------------------------------------------- breaker ramming
// TD applies this against wave-armor contacts after the engine step; DEPOT
// mirrors it identically (heavy tag = breaker). Called from DepotGame.jsx's
// stepDepot, once per tick, after stepWorld's contact list is fresh.
export function stepBreakerRam(world) {
  for (const c of world.contacts) {
    if (c.pn <= 0 || !c.b) continue;
    const a = c.a, b = c.b;
    const unit = a.tag === "heavy" ? a : b.tag === "heavy" ? b : null;
    const str = unit === a ? b : a;
    if (unit && unit.alive && (str.kind === "wall" || str.kind === "tower") && str.alive) {
      const sp = Math.hypot(unit.v.x, unit.v.z);
      if (sp > 0.8) { applyDamage(world, str, sp * world.dt * 16, { attacker: "enemy" }); str.hitT = world.t; }
    }
  }
}

// ------------------------------------------------------------------- leaks
// Any live enemy that reaches the depot leaks: lives damage, unit removed.
// Infantry (kind "unit") leak within 3.0m for 1 life (2 if tagged "heavy").
// Vehicles (tanks, kind "vehicle") leak within 5.0m for 4 lives — TD's
// vehicle leak semantics (ColdsnapTD.jsx :1017-1023: vehicle radius
// 5.0/dmg 4 vs infantry radius 3.0/dmg 1-2). Without this, a tank that
// survives to the depot marches off-map and persists forever (found during
// Task 7 balance probing — a wave with a surviving tank never clears).
export function checkLeaks(world, objPos) {
  for (let i = world.bodies.length - 1; i >= 0; i--) {
    const b = world.bodies[i];
    if ((b.kind !== "unit" && b.kind !== "vehicle") || !b.alive || b.team !== 2) continue;
    const radius = b.kind === "vehicle" ? 5.0 : 3.0;
    if (Math.hypot(b.pos.x - objPos.x, b.pos.z - objPos.z) < radius) {
      const dmg = b.kind === "vehicle" ? 4 : b.tag === "heavy" ? 2 : 1;
      world.events.push({ type: "leak", dmg, x: b.pos.x, y: b.pos.y, z: b.pos.z });
      world.byId.delete(b.id); world.bodies.splice(i, 1);
    }
  }
}
