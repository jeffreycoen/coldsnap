// gravitydebris/shields.js — the ship's shield walls: translucent third-block
// cells projected one cell outside the hull's own silhouette on all four ship
// faces, standard on every hull. Cells are real blocks: they ride the ship's
// rigid island through born welds, take strikes under the module-health law,
// and die into real holes a small rock can slip through. This module owns what
// the physics does not: the slot lattice, the preset that moves walls, and the
// regrowth law — a dead cell returns 2 wall-clock seconds after it first
// touches an undamaged powered neighbor, so holes close from the rim inward,
// and walls meet at the corners, so even a stripped face reseeds from its
// neighbors. Wounded cells heal at the same pace but cannot seed. Shields
// heal; the hull and its welds keep damage-stays-damage.
import { BS } from "./phys.js";

const CS = BS / 3;            // cell edge — 9 cells wall a 3-block face
const CELL_HP = 50;           // half a hull block
const CELL_M = 2;             // field mass: light enough to leave the hull's momentum alone
const HEAL_MS = 2000;         // 2 wall-clock seconds, whatever the time chip says
const ADJ_R = 2.9;            // slot adjacency reach — wall neighbors, layers, and the corner diagonal
const PRESETS = ["SPREAD", "FORE", "AFT", "LEFT", "RIGHT"];
// each preset's powered walls in canonical order; state moves slot k to slot k
// across the ordered lists, so the opposite wall stacks onto a doubled face
const WALLS = {
  SPREAD: ["fore-in", "aft-in", "left-in", "right-in"],
  FORE: ["fore-in", "fore-out", "left-in", "right-in"],
  AFT: ["aft-in", "aft-out", "left-in", "right-in"],
  LEFT: ["left-in", "left-out", "fore-in", "aft-in"],
  RIGHT: ["right-in", "right-out", "fore-in", "aft-in"],
};

// the ship's current turn, fitted from the cabin and any other living hull
// block against their born local coordinates — the hull may have spun in
// flight, and the slots must follow the hull as it stands, not as it was born
function frameFit(world) {
  const wb = world.blocks;
  const cab = wb.find((b) => b.ship && b.cab && b.alive);
  if (!cab) return null;
  let th = world.shipAng || 0;
  for (const b of wb) {
    if (!b.ship || b.shieldCell || b.cab || !b.alive || b.slx == null) continue;
    th = Math.atan2(b.z - cab.z, b.x - cab.x) - Math.atan2(b.slz, b.slx);
    break;
  }
  return { cab, co: Math.cos(th), si: Math.sin(th) };
}

// a dead cell returns at its slot — unless a foreign block stands on the spot,
// in which case it waits; materializing inside a rock is a detonation, not care
function reviveAt(world, c, fit) {
  const wx = fit.cab.x + c.slx * fit.co - c.slz * fit.si;
  const wz = fit.cab.z + c.slx * fit.si + c.slz * fit.co;
  for (const o of world.blocks) {
    if (!o.alive || o.ship) continue;
    const cd = c.cr + o.cr + 0.5;
    if ((o.x - wx) * (o.x - wx) + (o.z - wz) * (o.z - wz) < cd * cd && Math.abs(o.y) < cd) return false;
  }
  c.x = wx; c.z = wz; c.y = 0;
  c.vx = fit.cab.vx; c.vy = fit.cab.vy; c.vz = fit.cab.vz;
  c.alive = true; c.hp = CELL_HP; c.sleeping = false; c.dmgF = 0; c.dmgCd = 0;
  c._seedAt = null; c._healT = null;
  const wl = world._cellWelds && world._cellWelds.get(c);
  if (wl) for (const w of wl) { const a = world.blocks[w.a], b = world.blocks[w.b]; if (a.alive && b.alive) w.alive = true; } // the shield exception: a regrown cell rejoins the island; hull welds never reform
  return true;
}

function cellWeldLists(world) {
  if (world._cellWelds) return;
  world._cellWelds = new Map();
  for (const c of world.shieldCells) world._cellWelds.set(c, []);
  for (const w of world.welds) {
    const a = world.blocks[w.a], b = world.blocks[w.b];
    if (a.shieldCell) world._cellWelds.get(a).push(w);
    if (b.shieldCell) world._cellWelds.get(b).push(w);
  }
}

// the slot lattice from the hull's silhouette: inner walls hug it one cell out,
// outer walls one cell further; fore is the hull's own +x, left its -z
function initShields(world) {
  if (!world.ship) return;
  const wb = world.blocks;
  const hull = wb.filter((b) => b.ship && !b.shieldCell);
  const cab = hull.find((b) => b.cab);
  if (!cab) return;
  let minx = 1e9, maxx = -1e9, minz = 1e9, maxz = -1e9;
  for (const b of hull) {
    minx = Math.min(minx, b.slx - BS / 2); maxx = Math.max(maxx, b.slx + BS / 2);
    minz = Math.min(minz, b.slz - BS / 2); maxz = Math.max(maxz, b.slz + BS / 2);
  }
  const span = (a, b) => { const out = []; for (let v = a + CS / 2; v < b; v += CS) out.push(v); return out; };
  const slots = [];
  for (const z of span(minz, maxz)) {
    slots.push({ wall: "fore-in", slx: maxx + CS / 2, slz: z });
    slots.push({ wall: "fore-out", slx: maxx + CS * 1.5, slz: z });
    slots.push({ wall: "aft-in", slx: minx - CS / 2, slz: z });
    slots.push({ wall: "aft-out", slx: minx - CS * 1.5, slz: z });
  }
  for (const x of span(minx, maxx)) {
    slots.push({ wall: "right-in", slx: x, slz: maxz + CS / 2 });
    slots.push({ wall: "right-out", slx: x, slz: maxz + CS * 1.5 });
    slots.push({ wall: "left-in", slx: x, slz: minz - CS / 2 });
    slots.push({ wall: "left-out", slx: x, slz: minz - CS * 1.5 });
  }
  world.shieldPreset = "SPREAD";
  const powered = new Set(WALLS.SPREAD);
  world.shieldCells = [];
  for (const s of slots) {
    const on = powered.has(s.wall);
    const c = { x: cab.x + s.slx, y: 0, z: cab.z + s.slz, vx: 0, vy: 0, vz: 0, tint: 2, ship: true, shieldCell: true, wall: s.wall, slx: s.slx, slz: s.slz, powered: on, hp: CELL_HP, alive: on, sleeping: false, clump: -1, s: CS, cr: CS * 0.55, m: CELL_M };
    wb.push(c); world.shieldCells.push(c);
  }
  world.shieldAdj = world.shieldCells.map((c) => {
    const out = [];
    for (let j = 0; j < world.shieldCells.length; j++) {
      const o = world.shieldCells[j];
      if (o === c) continue;
      const dx = o.slx - c.slx, dz = o.slz - c.slz;
      if (dx * dx + dz * dz <= ADJ_R * ADJ_R) out.push(j);
    }
    return out;
  });
}

// the wall-clock heal, called once per drawn frame while time runs: wounded
// powered cells regain at the generator's pace, dead powered cells with an
// undamaged powered neighbor come back after their 2 seconds. A long gap in
// the calls is a pause, not elapsed care — every timer shifts past it.
function stepShields(world, now) {
  const cells = world.shieldCells;
  if (!cells) return;
  cellWeldLists(world);
  const gap = now - (world._shieldLast == null ? now : world._shieldLast);
  world._shieldLast = now;
  if (gap > 500) for (const c of cells) { if (c._seedAt != null) c._seedAt += gap; if (c._healT != null) c._healT += gap; }
  let fit = null;
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    if (!c.powered) continue;
    if (c.alive) {
      if (c.hp < CELL_HP) {
        if (c._healT == null) c._healT = now;
        c.hp = Math.min(CELL_HP, c.hp + (CELL_HP * (now - c._healT)) / HEAL_MS);
        c._healT = now;
      } else c._healT = null;
      c._seedAt = null;
      continue;
    }
    let seed = false;
    for (const j of world.shieldAdj[i]) { const n = cells[j]; if (n.powered && n.alive && n.hp >= CELL_HP) { seed = true; break; } }
    if (!seed) { c._seedAt = null; continue; }
    if (c._seedAt == null) { c._seedAt = now; continue; }
    if (now - c._seedAt >= HEAL_MS) {
      if (!fit) fit = frameFit(world);
      if (fit) reviveAt(world, c, fit);
    }
  }
}

// the preset chip's turn: capture the powered slots' states in canonical wall
// order, repower the next preset's slots, and carry state k to slot k — live
// cells re-stand at their new slots, holes travel as holes
function cycleShieldPreset(world) {
  const cells = world.shieldCells;
  if (!cells) return null;
  cellWeldLists(world);
  const old = world.shieldPreset || "SPREAD";
  const next = PRESETS[(PRESETS.indexOf(old) + 1) % PRESETS.length];
  const list = (p) => { const out = []; for (const wname of WALLS[p]) for (let i = 0; i < cells.length; i++) if (cells[i].wall === wname) out.push(i); return out; };
  const ol = list(old), nl = list(next);
  const states = ol.map((i) => ({ alive: cells[i].alive, hp: cells[i].hp }));
  for (const i of ol) { const c = cells[i]; c.powered = false; c.alive = false; c._seedAt = null; c._healT = null; }
  const fit = frameFit(world);
  for (let k = 0; k < nl.length; k++) {
    const c = cells[nl[k]], st = states[k] || { alive: false, hp: 0 };
    c.powered = true; c.alive = false; c._seedAt = null; c._healT = null;
    if (st.alive && fit) reviveAt(world, c, fit); // a live cell blocked from its new slot waits as a hole instead
    c.hp = st.hp; // the cell's health travels with its state, wounded or whole
  }
  world.shieldPreset = next;
  return next;
}

export { initShields, stepShields, cycleShieldPreset, CELL_HP, PRESETS };
