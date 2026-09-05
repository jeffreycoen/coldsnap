// COLDSNAP suite era 15 — THE OPEN SIEGE AND THE HONEST ZONE (mk1.96).
// "Leave them a road" is expunged; unreachable ground floods a pseudo-flow
// onto the player's masonry so a sealed map is besieged, not evaporated;
// the placement zone tells each unit's own truth, live. Fixture seeds: 23
// (the sealed map), 41 (the room-equivalence world), 44 (the tank
// write-off world). No seed is special.
import { ok } from "./harness.mjs";
import { identFwdDir } from "./shared.mjs";
import { makeMap, makeGrid, computeFlowField, OBJ_POS, SPAWN_POINTS, GRID_W, GRID_H } from "../../src/depot/mapgen.js";
import { makeWorld, addBody } from "../../src/engine/core.js";
import { slotBlockedPublic, roomMaskPublic } from "../../src/depot/squads.js";
import { placeZoneMask } from "../../src/depot/state.js";
import { DRIVERS } from "../../src/depot/drivers.js";

{
  console.log("\n[era 15: the open siege and the honest zone]");

  // (b) the sealed map, functional — seed 23, a full player wall row
  {
    makeMap(23);
    const g = makeGrid(null);
    const og = g.worldToGrid(OBJ_POS.x, OBJ_POS.z);
    const sg = g.worldToGrid(SPAWN_POINTS[0].x, SPAWN_POINTS[0].z);
    const sealGz = Math.round((og.gz + sg.gz) / 2);
    for (let gx = 0; gx < GRID_W; gx++) {
      const c = g.cells[g.idx(gx, sealGz)];
      c.blocked = true; c.wallId = 90000 + gx; c.bTeam = 1;
    }
    computeFlowField(g, og.gx, og.gz);
    let pseudo = 0, unreachable = 0, faceSeeds = 0, faceZeroDesc = 0, descentBad = 0;
    for (let gz = 0; gz < GRID_H; gz++) for (let gx = 0; gx < GRID_W; gx++) {
      const c = g.cells[g.idx(gx, gz)];
      if (c.blocked) continue;
      if (c.dist >= 1e8) { unreachable++; continue; }
      if (c.dist >= 1e6) {
        pseudo++;
        if (c.dist === 1e6) { faceSeeds++; if (!c.dx && !c.dz) faceZeroDesc++; }
        else {
          const nc = g.cells[g.idx(gx + Math.round(c.dx), gz + Math.round(c.dz))];
          if (!(nc && nc.dist < c.dist)) descentBad++;
        }
      }
    }
    let spawnsOn = 0;
    for (const sp of SPAWN_POINTS) {
      const s = g.worldToGrid(sp.x, sp.z);
      const c = g.cells[g.idx(s.gx, s.gz)];
      if (c && c.dist >= 1e6 && c.dist < 1e8) spawnsOn++;
    }
    ok("O3: a sealed map floods pseudo-flow onto the wall's face", pseudo > 500 && faceSeeds > 0, `${pseudo} cells, ${faceSeeds} seeds`);
    ok("O3b: the pseudo descent runs strictly downhill and rests at the face",
      pseudo > 0 && descentBad === 0 && faceZeroDesc === faceSeeds, `${descentBad} bad, ${faceZeroDesc}/${faceSeeds} resting`);
    ok("O3c: every spawn stands on marching ground; no open cell is left lost",
      spawnsOn === SPAWN_POINTS.length && unreachable === 0, `${spawnsOn}/${SPAWN_POINTS.length} spawns, ${unreachable} lost`);
    // one breach: a single cell of the seal falls — the real march returns
    const bc = g.cells[g.idx(45, sealGz)];
    bc.blocked = false; bc.wallId = null; bc.bTeam = 0;
    computeFlowField(g, og.gx, og.gz);
    let spawnsReal = 0;
    for (const sp of SPAWN_POINTS) {
      const s = g.worldToGrid(sp.x, sp.z);
      const c = g.cells[g.idx(s.gx, s.gz)];
      if (c && c.dist < 1e6) spawnsReal++;
    }
    ok("O4: one breach re-floods the real march to every spawn", spawnsReal === SPAWN_POINTS.length, `${spawnsReal}/${SPAWN_POINTS.length}`);
  }

  // (c) the tank at the face — stands and guns, never lost
  {
    const gridStand = { cellAt: () => ({ dist: 1e6, dx: 0, dz: 0 }) };
    const t = { pos: { x: 7, z: -4 }, lostT: 5 };
    DRIVERS.waveArmor.goal({}, gridStand, t, 1 / 60, identFwdDir);
    ok("O5: a tank on resting flow stands its ground and sheds the lost clock",
      !!t.goal && t.goal.x === 7 && t.goal.z === -4 && t.lostT === 0, JSON.stringify(t.goal));
    const gridLost = { cellAt: () => ({ dist: 1e9, dx: 0, dz: 0 }) };
    const w2 = makeWorld({ field: { heightAt: () => 0 }, seed: 44 });
    const t3 = addBody(w2, { kind: "vehicle", team: 2, mass: 2600, hx: 1.6, hy: 1, hz: 3, x: 0, y: 1, z: 0, hp: 60 });
    for (let i = 0; i < 800; i++) DRIVERS.waveArmor.goal(w2, gridLost, t3, 1 / 60, identFwdDir);
    ok("O5b: truly flowless ground still writes the tank off at 12s", !t3.alive || t3.hp <= 0, `hp=${t3.hp} alive=${t3.alive}`);
  }

  // (d) the room mask — one law with slotBlocked, at raster speed
  {
    makeMap(23);
    const g6 = makeGrid(null);
    const w6 = makeWorld({ field: { heightAt: () => 0 }, seed: 41 });
    const chunk = addBody(w6, { kind: "chunk", team: 1, mass: 0, hx: 1.1, hy: 0.5, hz: 0.7, x: 12, y: 0.5, z: -8, hp: 40 });
    const veh = addBody(w6, { kind: "vehicle", team: 1, mass: 2600, hx: 1.6, hy: 1, hz: 3, x: -20, y: 1, z: 14, hp: 300 });
    const clear = 2.1;
    const rm = roomMaskPublic(w6, g6, clear);
    let mismatches = 0;
    for (let gz = 0; gz < g6.h; gz++) for (let gx = 0; gx < g6.w; gx++) {
      const wp = g6.gridToWorld(gx, gz);
      if (!!rm[g6.idx(gx, gz)] !== slotBlockedPublic(w6, wp.x, wp.z, clear)) mismatches++;
    }
    ok("O6: the room mask agrees with slotBlocked on every cell (bare world)", mismatches === 0 && !!chunk && !!veh, `${mismatches} mismatches`);
  }

  // (e) the mask honors the per-unit vet and the room knockout
  {
    const cells7 = []; for (let i = 0; i < 16; i++) cells7.push({ blocked: false, wallId: null, ice: false, water: false });
    const g7 = { w: 4, h: 4, cs: 2, cells: cells7, idx: (gx, gz) => gz * 4 + gx, gridToWorld: (gx, gz) => ({ x: gx * 2, z: gz * 2 }) };
    const room7 = new Uint8Array(16); room7[g7.idx(2, 2)] = 1;
    const m7 = placeZoneMask(g7, () => true, (x, z) => x < 6, room7);
    let n7 = 0; for (let i = 0; i < 16; i++) n7 += m7[i];
    ok("O7: the mask honors the per-unit vet and the room knockout", n7 === 11 && m7[g7.idx(3, 1)] === 0 && m7[g7.idx(2, 2)] === 0, `${n7} cells`);
  }

}
