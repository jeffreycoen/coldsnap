// COLDSNAP — TOWER DEFENSE
// Grid-and-flow-field TD on a real Coldsnap map: rolling snowfield, rock
// outcrops that channel the approach, two frozen ponds you cannot fortify,
// and a plateau objective. Multi-part infantry, per-type tower silhouettes,
// ordered-dither pixel-art post stack.
import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

// ==================================================================== math
const V = {
  set: (o, x, y, z) => { o.x = x; o.y = y; o.z = z; return o; },
  copy: (o, a) => { o.x = a.x; o.y = a.y; o.z = a.z; return o; },
  add: (o, a, b) => { o.x = a.x + b.x; o.y = a.y + b.y; o.z = a.z + b.z; return o; },
  sub: (o, a, b) => { o.x = a.x - b.x; o.y = a.y - b.y; o.z = a.z - b.z; return o; },
  scale: (o, a, s) => { o.x = a.x * s; o.y = a.y * s; o.z = a.z * s; return o; },
  addScaled: (o, a, b, s) => { o.x = a.x + b.x * s; o.y = a.y + b.y * s; o.z = a.z + b.z * s; return o; },
  dot: (a, b) => a.x * b.x + a.y * b.y + a.z * b.z,
  cross: (o, a, b) => { const x = a.y * b.z - a.z * b.y, y = a.z * b.x - a.x * b.z, z = a.x * b.y - a.y * b.x; o.x = x; o.y = y; o.z = z; return o; },
  len: (a) => Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z),
  len2: (a) => a.x * a.x + a.y * a.y + a.z * a.z,
  norm: (o, a) => { const l = V.len(a) || 1; return V.scale(o, a, 1 / l); },
};
function v3(x = 0, y = 0, z = 0) { return { x, y, z }; }
function qIdent() { return { x: 0, y: 0, z: 0, w: 1 }; }
function qNorm(q) { const l = Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w) || 1; q.x /= l; q.y /= l; q.z /= l; q.w /= l; return q; }
function qIntegrate(q, w, dt) {
  const hx = w.x * dt * 0.5, hy = w.y * dt * 0.5, hz = w.z * dt * 0.5;
  const r = { x: hx * q.w + hz * q.y - hy * q.z, y: hy * q.w + hx * q.z - hz * q.x, z: hz * q.w + hy * q.x - hx * q.y, w: -(hx * q.x + hy * q.y + hz * q.z) };
  q.x += r.x; q.y += r.y; q.z += r.z; q.w += r.w;
  return qNorm(q);
}
function qToR(q, R) {
  const x = q.x, y = q.y, z = q.z, w = q.w;
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2;
  const yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;
  R[0] = 1 - (yy + zz); R[1] = xy + wz; R[2] = xz - wy;
  R[3] = xy - wz; R[4] = 1 - (xx + zz); R[5] = yz + wx;
  R[6] = xz + wy; R[7] = yz - wx; R[8] = 1 - (xx + yy);
  return R;
}
function invInertiaWorld(R, d, o) {
  const a = d.x, b = d.y, c = d.z;
  const m00 = R[0] * a, m01 = R[3] * b, m02 = R[6] * c;
  const m10 = R[1] * a, m11 = R[4] * b, m12 = R[7] * c;
  const m20 = R[2] * a, m21 = R[5] * b, m22 = R[8] * c;
  o[0] = m00 * R[0] + m01 * R[3] + m02 * R[6]; o[1] = m00 * R[1] + m01 * R[4] + m02 * R[7]; o[2] = m00 * R[2] + m01 * R[5] + m02 * R[8];
  o[3] = o[1]; o[4] = m10 * R[1] + m11 * R[4] + m12 * R[7]; o[5] = m10 * R[2] + m11 * R[5] + m12 * R[8];
  o[6] = o[2]; o[7] = o[5]; o[8] = m20 * R[2] + m21 * R[5] + m22 * R[8];
  return o;
}
function rTMulVec(R, v, o) { const x = v.x, y = v.y, z = v.z; o.x = R[0] * x + R[1] * y + R[2] * z; o.y = R[3] * x + R[4] * y + R[5] * z; o.z = R[6] * x + R[7] * y + R[8] * z; return o; }
function iMulVec(I, v, o) { const x = v.x, y = v.y, z = v.z; o.x = I[0] * x + I[3] * y + I[6] * z; o.y = I[1] * x + I[4] * y + I[7] * z; o.z = I[2] * x + I[5] * y + I[8] * z; return o; }
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
function snapCam(pos, right, up, fwd, texel) {
  const r = V.dot(pos, right), u = V.dot(pos, up), f = V.dot(pos, fwd);
  const rs = Math.round(r / texel) * texel, us = Math.round(u / texel) * texel;
  const p = v3(right.x * rs + up.x * us + fwd.x * f, right.y * rs + up.y * us + fwd.y * f, right.z * rs + up.z * us + fwd.z * f);
  return { pos: p, errX: (r - rs) / texel, errY: (u - us) / texel };
}
function aimSolve(v, d, dy, g = 9.8, high = false) {
  const v2 = v * v;
  const disc = v2 * v2 - g * (g * d * d + 2 * dy * v2);
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  return Math.atan2(high ? v2 + s : v2 - s, g * d);
}
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ============================================================== the map
// 40x40 grid of 2m cells = an 80m square battlefield. Enemies enter from the
// south treeline and walk north to the depot on the plateau.
const GRID_CS = 2.0, GRID_W = 56, GRID_H = 56;
const GRID_OX = -(GRID_W * GRID_CS) / 2, GRID_OZ = -(GRID_H * GRID_CS) / 2;
const OBJ_POS = { x: 0, z: GRID_OZ + GRID_H * GRID_CS - 7 };
const SPAWN_POINTS = [
  { x: -34, z: GRID_OZ + 2 }, { x: 0, z: GRID_OZ + 2 }, { x: 34, z: GRID_OZ + 2 },
];
// Frozen meltwater. Walkable — slick, so they cross it FASTER — but you cannot
// sink a foundation into it, so the ponds are permanent holes in your maze.
const PONDS = [
  { x: -20, z: -6, r: 10.0, level: 0 },
  { x: 22, z: 18, r: 8.0, level: 0 },
  { x: -6, z: 34, r: 7.0, level: 0 },
];
// Granite pushing through the snow. Impassable, unbuildable, free walls.
// Granite ridges laid across the approach with deliberate passes cut through
// them. This is the map's spine: three bands, each pierced twice, so a wave
// has to bunch and you always know roughly where it will be.
function ridge(x0, z0, x1, z1, gaps, r, h) {
  const out = [], n = Math.max(2, Math.round(Math.hypot(x1 - x0, z1 - z0) / (r * 1.25)));
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
    let inGap = false;
    for (const g of gaps) if (Math.hypot(x - g[0], z - g[1]) < g[2]) inGap = true;
    if (!inGap) out.push({ x, z, r: r * (0.82 + 0.36 * ((i * 7) % 5) / 5), h });
  }
  return out;
}
const ROCKS = [
  ...ridge(-52, -30, 52, -26, [[-20, -29, 7], [22, -27, 7]], 4.6, 3.4),
  ...ridge(-52, 4, 52, 2, [[-4, 3, 7.5], [34, 2, 6.5]], 4.8, 3.8),
  ...ridge(-40, 32, 44, 30, [[-16, 31, 6.5], [18, 30, 7]], 4.4, 3.2),
  { x: -46, z: 14, r: 5.0, h: 3.6 }, { x: 46, z: 16, r: 5.0, h: 3.6 },
];
// Coldsnap masonry: 0.8m stones on a 0.83 pitch, hollow, with a doorway.
// Every one of these is welded and every one can be brought down.
const TOWN = [
  { id: "house0", x: -30, z: -14, nx: 6, nz: 5, ny: 4, door: 5 },
  { id: "house1", x: 30, z: -12, nx: 6, nz: 5, ny: 4, door: 0 },
  { id: "house2", x: -12, z: 16, nx: 5, nz: 4, ny: 4, door: 4 },
  { id: "house3", x: 12, z: 40, nx: 5, nz: 4, ny: 4, door: 0 },
  { id: "keep",   x: 0,  z: 22, nx: 7, nz: 6, ny: 5, door: 3 },
  { id: "shed",   x: -34, z: 26, nx: 4, nz: 4, ny: 3, door: 0 },
  { id: "depot",  x: 0,  z: 56, nx: 9, nz: 7, ny: 5, door: 4, depot: true },
];
const MASON = { hcs: 0.40, pitch: 0.83, mass: 100, breakF: 8.0e4 };

function makeField(n, cs) {
  const h = new Float32Array(n * n);
  const half = ((n - 1) * cs) / 2;
  const F = {
    n, cs, h, half,
    heightAt(x, z) {
      const fx = (x + half) / cs, fz = (z + half) / cs;
      let i = Math.floor(fx), j = Math.floor(fz);
      i = Math.max(0, Math.min(n - 2, i)); j = Math.max(0, Math.min(n - 2, j));
      const tx = Math.max(0, Math.min(1, fx - i)), tz = Math.max(0, Math.min(1, fz - j));
      const h00 = h[j * n + i], h10 = h[j * n + i + 1], h01 = h[(j + 1) * n + i], h11 = h[(j + 1) * n + i + 1];
      return h00 * (1 - tx) * (1 - tz) + h10 * tx * (1 - tz) + h01 * (1 - tx) * tz + h11 * tx * tz;
    },
    normalAt(x, z, o) {
      const e = cs * 0.6;
      const hx = F.heightAt(x + e, z) - F.heightAt(x - e, z);
      const hz = F.heightAt(x, z + e) - F.heightAt(x, z - e);
      V.set(o, -hx, 2 * e, -hz);
      return V.norm(o, o);
    },
    // ordnance reshapes the ground. Straight from the proving grounds.
    carve(x, z, rad, depth) {
      const i0 = Math.max(0, Math.floor((x - rad + half) / cs)), i1 = Math.min(n - 1, Math.ceil((x + rad + half) / cs));
      const j0 = Math.max(0, Math.floor((z - rad + half) / cs)), j1 = Math.min(n - 1, Math.ceil((z + rad + half) / cs));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const px = i * cs - half, pz = j * cs - half;
        const d2 = (px - x) * (px - x) + (pz - z) * (pz - z);
        if (d2 > rad * rad) continue;
        const k = Math.exp(-(d2 / (rad * rad)) * 3);
        h[j * n + i] = Math.max(-1.5, h[j * n + i] - depth * k);
      }
      F.dirty = true;
    },
    dirty: false,
  };
  return F;
}

// The ground itself. Written once at boot; the renderer bakes slope, snow,
// rock and ice straight out of these numbers, so the map you fight on and the
// map you see are the same array.
function buildTerrain(field, seed = 11) {
  const r = mulberry32(seed);
  const { n, cs, h, half } = field;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = i * cs - half, z = j * cs - half;
    // rolling snowfield, rising gently toward the depot end
    let y = 2.0
      + Math.sin(x * 0.075 + 1.3) * 0.42
      + Math.cos(z * 0.061 - 0.6) * 0.38
      + Math.sin((x + z) * 0.032) * 0.30
      + (r() - 0.5) * 0.06
      + Math.max(0, (z + 10) / 46) * 2.2;             // the long climb north
    // rock outcrops
    for (const k of ROCKS) {
      const d = Math.hypot(x - k.x, z - k.z) / k.r;
      if (d < 1.6) y += k.h * Math.exp(-d * d * 2.1);
    }
    // Frozen solid: the sheet is a flat pan at pond level, blended into a
    // shallow bank. Carving a basin under walkable ice drops them into a hole
    // and they spend the wave climbing back out of it.
    for (const p of PONDS) {
      const d = Math.hypot(x - p.x, z - p.z);
      const lip = p.r + 4.5;
      if (d < lip) {
        const t = Math.min(1, (lip - d) / 4.5);
        y = y * (1 - t) + p.level * t;
      }
    }
    h[j * n + i] = y;
  }
  // building pads: masonry conforms to whatever the ground is at build time,
  // so level it first or the walls arrive pre-sheared
  for (const t of TOWN) {
    const rad = Math.hypot(t.nx, t.nz) * MASON.pitch / 2 + 2.0;
    const ph = h[Math.round((t.z + half) / cs) * n + Math.round((t.x + half) / cs)];
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = i * cs - half, z = j * cs - half;
      const d = Math.hypot(x - t.x, z - t.z);
      if (d >= rad) continue;
      h[j * n + i] += (ph - h[j * n + i]) * Math.min(1, (rad - d) / 1.8);
    }
  }
  // depot plateau: dead level so the objective reads as a built place
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = i * cs - half, z = j * cs - half;
    const d = Math.hypot(x - OBJ_POS.x, z - OBJ_POS.z);
    if (d < 9) {
      const t = Math.min(1, (9 - d) / 4.5);
      const ph = 2.0 + Math.max(0, (OBJ_POS.z + 10) / 46) * 2.2 + 0.5;
      h[j * n + i] += (ph - h[j * n + i]) * t;
    }
  }
  // slope relaxation: a 30-degree cap everywhere so infantry never meets a
  // face they cannot stand on, and so the rock skirts read as scree not cliffs
  const maxStep = Math.tan(0.52) * cs, dStep = maxStep * Math.SQRT2;
  for (let pass = 0; pass < 3; pass++) {
    for (let j = 1; j < n - 1; j++) for (let i = 1; i < n - 1; i++) {
      const k = j * n + i;
      const lo = Math.min(h[k - 1], h[k + 1], h[k - n], h[k + n]) + maxStep;
      const lod = Math.min(h[k - n - 1], h[k - n + 1], h[k + n - 1], h[k + n + 1]) + dStep;
      const cap = Math.min(lo, lod);
      if (h[k] > cap) h[k] = cap;
    }
  }
  field.dirty = true;
}
function pondAt(x, z) {
  for (const p of PONDS) if (Math.hypot(x - p.x, z - p.z) < p.r) return p;
  return null;
}
function rockAt(x, z) {
  for (const k of ROCKS) if (Math.hypot(x - k.x, z - k.z) < k.r * 0.78) return k;
  return null;
}

// ================================================================= bodies
let BODY_ID = 1;
function boxInertiaInv(m, hx, hy, hz) {
  if (m <= 0) return v3(0, 0, 0);
  const k = 3 / m;
  return v3(k / (hy * hy + hz * hz), k / (hx * hx + hz * hz), k / (hx * hx + hy * hy));
}
function makeBody(o) {
  const m = o.mass || 0;
  const b = {
    id: BODY_ID++, kind: o.kind || "prop", team: o.team || 0, tag: o.tag || "",
    hx: o.hx, hy: o.hy, hz: o.hz, mass: m, invM: m > 0 ? 1 / m : 0,
    invIb: boxInertiaInv(m, o.hx, o.hy, o.hz),
    pos: v3(o.x || 0, o.y || 0, o.z || 0), q: qIdent(),
    v: v3(), w: v3(), R: new Float32Array(9), invIw: new Float32Array(9),
    hp: o.hp != null ? o.hp : 1e9, maxHp: o.hp != null ? o.hp : 1e9,
    alive: true, sleeping: false, sleepT: 0, grounded: false, airT: 0, seq: 0,
    hitT: -9, wph: 0,
    friction: o.friction != null ? o.friction : 0.6, restitution: o.restitution != null ? o.restitution : 0.05,
  };
  qToR(b.q, b.R);
  invInertiaWorld(b.R, b.invIb, b.invIw);
  return b;
}
function wake(b) { if (b.sleeping) b.sleeping = false; b.sleepT = 0; }

// =========================================================== SAT (boxes)
const _t = v3(), _C = new Float32Array(9), _absC = new Float32Array(9);
function satBoxBox(a, b, out) {
  const RA = a.R, RB = b.R;
  V.sub(_t, b.pos, a.pos);
  const tA = v3(V.dot(_t, { x: RA[0], y: RA[1], z: RA[2] }), V.dot(_t, { x: RA[3], y: RA[4], z: RA[5] }), V.dot(_t, { x: RA[6], y: RA[7], z: RA[8] }));
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) _C[j * 3 + i] = RA[i * 3 + 0] * RB[j * 3 + 0] + RA[i * 3 + 1] * RB[j * 3 + 1] + RA[i * 3 + 2] * RB[j * 3 + 2];
  for (let k = 0; k < 9; k++) _absC[k] = Math.abs(_C[k]) + 1e-6;
  const ha = [a.hx, a.hy, a.hz], hb = [b.hx, b.hy, b.hz], tArr = [tA.x, tA.y, tA.z];
  let sMaxFace = -1e30, faceAxis = -1, faceOwner = 0;
  for (let i = 0; i < 3; i++) {
    const s = Math.abs(tArr[i]) - (ha[i] + hb[0] * _absC[0 * 3 + i] + hb[1] * _absC[1 * 3 + i] + hb[2] * _absC[2 * 3 + i]);
    if (s > 0) return 0;
    if (s > sMaxFace) { sMaxFace = s; faceAxis = i; faceOwner = 0; }
  }
  for (let i = 0; i < 3; i++) {
    const tb = _C[i * 3 + 0] * tA.x + _C[i * 3 + 1] * tA.y + _C[i * 3 + 2] * tA.z;
    const s = Math.abs(tb) - (hb[i] + ha[0] * _absC[i * 3 + 0] + ha[1] * _absC[i * 3 + 1] + ha[2] * _absC[i * 3 + 2]);
    if (s > 0) return 0;
    if (s > sMaxFace + 1e-4) { sMaxFace = s; faceAxis = i; faceOwner = 1; }
  }
  const n = v3();
  const refIsA = faceOwner === 0;
  const ref = refIsA ? a : b, inc = refIsA ? b : a;
  const Rref = ref.R, Rinc = inc.R;
  const href = [ref.hx, ref.hy, ref.hz], hinc = [inc.hx, inc.hy, inc.hz];
  const ax = faceAxis;
  n.x = Rref[ax * 3 + 0]; n.y = Rref[ax * 3 + 1]; n.z = Rref[ax * 3 + 2];
  const d = v3(); V.sub(d, inc.pos, ref.pos);
  if (V.dot(d, n) < 0) V.scale(n, n, -1);
  let incAx = 0, sInc = 1, bestDot = 1e30;
  const incN = [v3(Rinc[0], Rinc[1], Rinc[2]), v3(Rinc[3], Rinc[4], Rinc[5]), v3(Rinc[6], Rinc[7], Rinc[8])];
  for (let i = 0; i < 3; i++) {
    const dd = V.dot(incN[i], n);
    if (dd < bestDot) { bestDot = dd; incAx = i; sInc = 1; }
    if (-dd < bestDot) { bestDot = -dd; incAx = i; sInc = -1; }
  }
  const u = (incAx + 1) % 3, w = (incAx + 2) % 3;
  const cN = v3(), cU = v3(), cW = v3();
  V.scale(cN, incN[incAx], sInc * hinc[incAx]);
  V.set(cU, Rinc[u * 3 + 0], Rinc[u * 3 + 1], Rinc[u * 3 + 2]);
  V.set(cW, Rinc[w * 3 + 0], Rinc[w * 3 + 1], Rinc[w * 3 + 2]);
  let verts = [];
  for (let s1 = -1; s1 <= 1; s1 += 2) for (let s2 = -1; s2 <= 1; s2 += 2) {
    const p = v3(); V.copy(p, inc.pos); V.add(p, p, cN);
    V.addScaled(p, p, cU, s1 * hinc[u]); V.addScaled(p, p, cW, s2 * hinc[w]);
    verts.push({ p, id: (s1 + 1) + (s2 + 1) / 2 });
  }
  const ru = (ax + 1) % 3, rw = (ax + 2) % 3;
  const planes = [];
  for (const pr of [[ru, 1], [ru, -1], [rw, 1], [rw, -1]]) {
    const ai = pr[0], sgn = pr[1];
    const pn = v3(Rref[ai * 3 + 0] * sgn, Rref[ai * 3 + 1] * sgn, Rref[ai * 3 + 2] * sgn);
    planes.push({ pn, pd: V.dot(pn, ref.pos) + href[ai] });
  }
  for (const pl of planes) {
    const nv = [];
    for (let i = 0; i < verts.length; i++) {
      const A = verts[i], B2 = verts[(i + 1) % verts.length];
      const da = V.dot(pl.pn, A.p) - pl.pd, db = V.dot(pl.pn, B2.p) - pl.pd;
      if (da <= 0) nv.push(A);
      if (da * db < 0) {
        const t2 = da / (da - db);
        nv.push({ p: v3(A.p.x + (B2.p.x - A.p.x) * t2, A.p.y + (B2.p.y - A.p.y) * t2, A.p.z + (B2.p.z - A.p.z) * t2), id: 4 + ((A.id * 4 + B2.id) % 12) });
      }
    }
    verts = nv; if (!verts.length) break;
  }
  const faceD = V.dot(n, ref.pos) + href[ax];
  let cnt = 0;
  for (const vtx of verts) {
    const depth = faceD - V.dot(n, vtx.p);
    if (depth > 0 && cnt < 4) {
      out[cnt] = { p: vtx.p, n: refIsA ? v3(n.x, n.y, n.z) : v3(-n.x, -n.y, -n.z), depth, fid: vtx.id + (refIsA ? 0 : 16) };
      cnt++;
    }
  }
  return cnt;
}
const CORNERS = [];
for (let sx = -1; sx <= 1; sx += 2) for (let sy = -1; sy <= 1; sy += 2) for (let sz = -1; sz <= 1; sz += 2) CORNERS.push([sx, sy, sz]);
const FACEPTS = [[1, 0, 0], [-1, 0, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
function terrainContacts(field, b, push) {
  const R = b.R;
  const test = (lx, ly, lz, fid) => {
    const px = b.pos.x + R[0] * lx + R[3] * ly + R[6] * lz;
    const py = b.pos.y + R[1] * lx + R[4] * ly + R[7] * lz;
    const pz = b.pos.z + R[2] * lx + R[5] * ly + R[8] * lz;
    const h = field.heightAt(px, pz);
    if (py < h) {
      const n = v3(); field.normalAt(px, pz, n);
      push(b, null, { p: v3(px, py, pz), n: v3(-n.x, -n.y, -n.z), depth: h - py, fid: 128 + fid });
    }
  };
  let fid = 0;
  for (const c of CORNERS) test(c[0] * b.hx, c[1] * b.hy, c[2] * b.hz, fid++);
  for (const c of FACEPTS) test(c[0] * b.hx, c[1] * b.hy, c[2] * b.hz, fid++);
}

// ================================================================== world
function makeWorld(field) {
  return {
    t: 0, dt: 1 / 120, gravity: 9.8, field,
    bodies: [], byId: new Map(), projectiles: [], events: [], welds: [], weldsOf: new Map(),
    warm: new Map(), contacts: [], seq: 0,
  };
}
function addBody(world, o) { const b = makeBody(o); b.seq = world.seq++; world.bodies.push(b); world.byId.set(b.id, b); return b; }

// ======================================================== welds (masonry)
// A weld is a rigid point constraint between two stones with a break force.
// Per-body adjacency so a blast reads one stone's handful of welds instead of
// scanning the whole structure.
function addWeld(world, a, b, breakF = 8.0e4) {
  const mid = v3((a.pos.x + b.pos.x) / 2, (a.pos.y + b.pos.y) / 2, (a.pos.z + b.pos.z) / 2);
  const rA = v3(), rB = v3();
  rTMulVec(a.R, v3(mid.x - a.pos.x, mid.y - a.pos.y, mid.z - a.pos.z), rA);
  rTMulVec(b.R, v3(mid.x - b.pos.x, mid.y - b.pos.y, mid.z - b.pos.z), rB);
  const w = { a, b, rA, rB, breakF, broken: false, acc: [0, 0, 0], born: world.t };
  if (!world.weldsOf) world.weldsOf = new Map();
  for (const m of [a, b]) { const arr = world.weldsOf.get(m.id); if (arr) arr.push(w); else world.weldsOf.set(m.id, [w]); }
  world._weldPairsDirty = true;
  world.welds.push(w);
  return w;
}
function weldNeighbors(world, b, out) {
  const arr = world.weldsOf && world.weldsOf.get(b.id);
  if (!arr) return;
  for (const w of arr) { if (!w.broken) out.push(w.a === b ? w.b : w.a); }
}
function wakeIsland(world, b) {
  const stack = [b], seen = new Set([b.id]);
  while (stack.length) {
    const cur = stack.pop(); wake(cur);
    const nb = []; weldNeighbors(world, cur, nb);
    for (const x of nb) if (!seen.has(x.id)) { seen.add(x.id); stack.push(x); }
  }
}
const _swRA = v3(), _swRB = v3(), _swPA = v3(), _swPB = v3(), _swC = v3(), _swJ = v3(), _sw1 = v3(), _sw2 = v3();
const _swAx = [v3(1, 0, 0), v3(0, 1, 0), v3(0, 0, 1)];
function rMulVec2(R, v, o) { const x = v.x, y = v.y, z = v.z; o.x = R[0] * x + R[3] * y + R[6] * z; o.y = R[1] * x + R[4] * y + R[7] * z; o.z = R[2] * x + R[5] * y + R[8] * z; return o; }
function solveWelds(world, active) {
  const dt = world.dt;
  for (const w of active) {
    const a = w.a, b = w.b;
    // a sleeping member acts as a static anchor, so a live stone binds to a
    // dozing one instead of free-falling until the wake ripple arrives
    const aS = a.sleeping ? 0 : 1, bS = b.sleeping ? 0 : 1;
    const rA = rMulVec2(a.R, w.rA, _swRA), rB = rMulVec2(b.R, w.rB, _swRB);
    const pa = V.add(_swPA, a.pos, rA), pb = V.add(_swPB, b.pos, rB);
    const C = V.sub(_swC, pb, pa);
    for (let ai = 0; ai < 3; ai++) {
      const ax = _swAx[ai];
      V.cross(_sw1, a.w, rA); V.add(_sw1, _sw1, a.v);
      V.cross(_sw2, b.w, rB); V.add(_sw2, _sw2, b.v);
      V.sub(_sw2, _sw2, _sw1);
      const vRel = V.dot(_sw2, ax);
      let k = a.invM * aS + b.invM * bS;
      const t1 = _sw1, t2 = _sw2;
      if (aS) { V.cross(t1, rA, ax); iMulVec(a.invIw, t1, t2); V.cross(t1, t2, rA); k += V.dot(t1, ax); }
      if (bS) { V.cross(t1, rB, ax); iMulVec(b.invIw, t1, t2); V.cross(t1, t2, rB); k += V.dot(t1, ax); }
      // 6mm deadband — Baumgarte hunting around C=0 keeps heavy weldments in a
      // limit cycle and nothing ever sleeps
      const cAx = V.dot(C, ax);
      const cSl = Math.abs(cAx) < 0.006 ? 0 : cAx - Math.sign(cAx) * 0.006;
      const bias = Math.max(-1.5, Math.min(1.5, (0.12 / dt) * cSl));
      const P = -(vRel + bias) / Math.max(1e-9, k);
      w.acc[ai] += P;
      const J = V.scale(_swJ, ax, P);
      if (aS) { V.addScaled(a.v, a.v, J, -a.invM); V.cross(t1, rA, J); iMulVec(a.invIw, t1, t2); V.addScaled(a.w, a.w, t2, -1); }
      if (bS) { V.addScaled(b.v, b.v, J, b.invM); V.cross(t1, rB, J); iMulVec(b.invIw, t1, t2); V.addScaled(b.w, b.w, t2, 1); }
    }
    const wr = V.sub(_sw1, b.w, a.w);
    for (let i = 0; i < 3; i++) {
      const key = i === 0 ? "x" : i === 1 ? "y" : "z";
      const ka = a.invIw[i * 3 + i] * aS + b.invIw[i * 3 + i] * bS;
      if (ka < 1e-9) continue;
      const L = -wr[key] / ka;
      if (aS) a.w[key] -= L * a.invIw[i * 3 + i];
      if (bS) b.w[key] += L * b.invIw[i * 3 + i];
    }
  }
}
function weldBreakPass(world) {
  const dt = world.dt;
  for (const w of world.welds) {
    if (w.broken) continue;
    if (world.t - w.born < 0.5) { w.acc[0] = 0; w.acc[1] = 0; w.acc[2] = 0; continue; }
    const f = Math.hypot(w.acc[0], w.acc[1], w.acc[2]) / dt;
    w.acc[0] = 0; w.acc[1] = 0; w.acc[2] = 0;
    if (f > w.breakF) {
      w.broken = true; world._weldPairsDirty = true;
      world.events.push({ type: "weldbreak", x: w.a.pos.x, y: w.a.pos.y, z: w.a.pos.z });
      for (const cb of [w.a, w.b]) if (cb.kind === "chunk") { cb.fallingSince = world.t; wake(cb); }
    }
  }
}

const _scratchOut = new Array(8);
function collectContacts(world) {
  const bodies = world.bodies, contacts = world.contacts;
  contacts.length = 0;
  const cell = 4.0;
  if (!world._grid) { world._grid = new Map(); world._gridEpoch = 0; }
  const grid = world._grid, epoch = ++world._gridEpoch;
  for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i];
    if (b.sleeping && b.invM === 0) continue;
    if (b.kind === "unit" && !b.alive) continue;
    const r = Math.max(b.hx, b.hy, b.hz);
    const x0 = Math.floor((b.pos.x - r) / cell), x1 = Math.floor((b.pos.x + r) / cell);
    const z0 = Math.floor((b.pos.z - r) / cell), z1 = Math.floor((b.pos.z + r) / cell);
    for (let gx = x0; gx <= x1; gx++) for (let gz = z0; gz <= z1; gz++) {
      const key = gx * 73856093 ^ gz * 19349663;
      let arr = grid.get(key);
      if (!arr) { arr = []; arr.epoch = epoch; grid.set(key, arr); }
      else if (arr.epoch !== epoch) { arr.length = 0; arr.epoch = epoch; }
      arr.push(b);
    }
  }
  if (!world._weldPairs || world._weldPairsDirty) {
    world._weldPairs = new Set();
    for (const w of world.welds) if (!w.broken) world._weldPairs.add(w.a.id < w.b.id ? w.a.id * 100000 + w.b.id : w.b.id * 100000 + w.a.id);
    world._weldPairsDirty = false;
  }
  const seen = new Set();
  for (const arr of grid.values()) {
    if (arr.epoch !== epoch || arr.length < 2) continue;
    for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) {
      let a = arr[i], b = arr[j];
      if (a.sleeping && b.sleeping) continue;
      if (a.invM === 0 && b.invM === 0) continue;
      if (a.id > b.id) { const t2 = a; a = b; b = t2; }
      const pk = a.id * 100000 + b.id;
      if (seen.has(pk)) continue; seen.add(pk);
      if (world._weldPairs && world._weldPairs.has(pk)) continue;
      const ra = Math.sqrt(a.hx * a.hx + a.hy * a.hy + a.hz * a.hz);
      const rb = Math.sqrt(b.hx * b.hx + b.hy * b.hy + b.hz * b.hz);
      const dx = a.pos.x - b.pos.x, dy = a.pos.y - b.pos.y, dz = a.pos.z - b.pos.z;
      if (dx * dx + dy * dy + dz * dz > (ra + rb) * (ra + rb)) continue;
      const n = satBoxBox(a, b, _scratchOut);
      for (let k = 0; k < n; k++) {
        const c = _scratchOut[k];
        contacts.push({ a, b, p: c.p, n: c.n, depth: c.depth, fid: c.fid, pn: 0, pt1: 0, pt2: 0 });
      }
    }
  }
  for (const b of bodies) {
    if (b.invM === 0 || b.sleeping) continue;
    b.groundedNow = false;
    terrainContacts(world.field, b, (bb, _n, c) => {
      contacts.push({ a: bb, b: null, p: c.p, n: c.n, depth: c.depth, fid: c.fid, pn: 0, pt1: 0, pt2: 0 });
      if (c.n.y < -0.4) bb.groundedNow = true;
    });
  }
}
const _pcRaxn = v3(), _pcTmp = v3(), _pcT2 = v3();
function prepContacts(world) {
  const dt = world.dt;
  for (const c of world.contacts) {
    const a = c.a, b = c.b;
    c.rA = v3(); V.sub(c.rA, c.p, a.pos);
    if (b) { c.rB = v3(); V.sub(c.rB, c.p, b.pos); }
    const n = c.n;
    let kn = a.invM + (b ? b.invM : 0);
    const raxn = _pcRaxn; V.cross(raxn, c.rA, n);
    const tmp = _pcTmp; iMulVec(a.invIw, raxn, tmp);
    const t2v = _pcT2; V.cross(t2v, tmp, c.rA);
    kn += V.dot(t2v, n);
    if (b) {
      const rbxn = v3(); V.cross(rbxn, c.rB, n);
      iMulVec(b.invIw, rbxn, tmp);
      V.cross(t2v, tmp, c.rB);
      kn += V.dot(t2v, n);
    }
    c.invKn = 1 / Math.max(1e-9, kn);
    const t1 = v3();
    if (Math.abs(n.x) > 0.6) V.set(t1, n.y, -n.x, 0); else V.set(t1, 0, n.z, -n.y);
    V.norm(t1, t1);
    const tB = v3(); V.cross(tB, n, t1);
    c.t1 = t1; c.t2 = tB;
    const kt = (tv) => {
      let k = a.invM + (b ? b.invM : 0);
      V.cross(raxn, c.rA, tv); iMulVec(a.invIw, raxn, tmp); V.cross(t2v, tmp, c.rA); k += V.dot(t2v, tv);
      if (b) { V.cross(raxn, c.rB, tv); iMulVec(b.invIw, raxn, tmp); V.cross(t2v, tmp, c.rB); k += V.dot(t2v, tv); }
      return 1 / Math.max(1e-9, k);
    };
    c.invKt1 = kt(t1); c.invKt2 = kt(tB);
    c.mu = b ? Math.sqrt(a.friction * b.friction) : Math.sqrt(a.friction * 0.9);
    const vRel = relVelAt(c);
    const vn = V.dot(vRel, n);
    const e = b ? Math.min(a.restitution, b.restitution) : a.restitution;
    c.bounce = vn < -1.6 ? -e * vn : 0;
    c.bias = Math.min(5, (0.18 / dt) * Math.max(0, c.depth - 0.008));
    c.key = a.id * 262144 + (b ? b.id : 0) * 64 + (c.fid & 63);
    const old = world.warm.get(c.key);
    if (old) {
      c.pn = old.pn; c.pt1 = old.pt1; c.pt2 = old.pt2;
      applyImpulse(c, V.scale(v3(), n, c.pn));
      applyImpulse(c, V.scale(v3(), c.t1, c.pt1));
      applyImpulse(c, V.scale(v3(), c.t2, c.pt2));
    }
  }
}
function relVelAt(c) {
  const a = c.a, b = c.b;
  const va = v3(); V.cross(va, a.w, c.rA); V.add(va, va, a.v);
  if (!b) return V.scale(v3(), va, -1);
  const vb = v3(); V.cross(vb, b.w, c.rB); V.add(vb, vb, b.v);
  return V.sub(v3(), vb, va);
}
function applyImpulse(c, J) {
  const a = c.a, b = c.b;
  if (!a.sleeping) {
    V.addScaled(a.v, a.v, J, -a.invM);
    const L = v3(); V.cross(L, c.rA, J);
    const dw = v3(); iMulVec(a.invIw, L, dw);
    V.addScaled(a.w, a.w, dw, -1);
  }
  if (b && !b.sleeping) {
    V.addScaled(b.v, b.v, J, b.invM);
    const L = v3(); V.cross(L, c.rB, J);
    const dw = v3(); iMulVec(b.invIw, L, dw);
    V.addScaled(b.w, b.w, dw, 1);
  }
}
function solveContacts(world) {
  for (const c of world.contacts) {
    if (c.a.sleeping && (!c.b || c.b.sleeping)) continue;
    const n = c.n;
    let vRel = relVelAt(c);
    let dPn = -(V.dot(vRel, n) - c.bias - c.bounce) * c.invKn;
    const pn0 = c.pn; c.pn = Math.max(0, c.pn + dPn); dPn = c.pn - pn0;
    applyImpulse(c, V.scale(v3(), n, dPn));
    const maxF = c.mu * c.pn;
    vRel = relVelAt(c);
    let dPt = -V.dot(vRel, c.t1) * c.invKt1;
    const pt0 = c.pt1; c.pt1 = Math.max(-maxF, Math.min(maxF, c.pt1 + dPt));
    applyImpulse(c, V.scale(v3(), c.t1, c.pt1 - pt0));
    vRel = relVelAt(c);
    dPt = -V.dot(vRel, c.t2) * c.invKt2;
    const pt20 = c.pt2; c.pt2 = Math.max(-maxF, Math.min(maxF, c.pt2 + dPt));
    applyImpulse(c, V.scale(v3(), c.t2, c.pt2 - pt20));
  }
}

// ========================================================== grid + flow
function makeGrid(field) {
  const cells = new Array(GRID_W * GRID_H);
  for (let i = 0; i < cells.length; i++) cells[i] = { blocked: false, terrain: false, ice: false, dx: 0, dz: 0, dist: 1e9, wallId: null };
  const G = {
    cells, w: GRID_W, h: GRID_H, cs: GRID_CS, ox: GRID_OX, oz: GRID_OZ,
    idx: (gx, gz) => gz * GRID_W + gx,
    worldToGrid: (x, z) => ({ gx: Math.floor((x - GRID_OX) / GRID_CS), gz: Math.floor((z - GRID_OZ) / GRID_CS) }),
    gridToWorld: (gx, gz) => ({ x: GRID_OX + (gx + 0.5) * GRID_CS, z: GRID_OZ + (gz + 0.5) * GRID_CS }),
    inBounds: (gx, gz) => gx >= 0 && gx < GRID_W && gz >= 0 && gz < GRID_H,
    cellAt(x, z) {
      const g = G.worldToGrid(x, z);
      if (!G.inBounds(g.gx, g.gz)) return null;
      return cells[G.idx(g.gx, g.gz)];
    },
  };
  // stamp the map's own geography into the grid: rock is a wall you did not
  // pay for, ice is ground you may cross but never build on
  for (let gz = 0; gz < GRID_H; gz++) for (let gx = 0; gx < GRID_W; gx++) {
    const wp = G.gridToWorld(gx, gz);
    const c = cells[G.idx(gx, gz)];
    if (rockAt(wp.x, wp.z)) { c.blocked = true; c.terrain = true; }
    else if (pondAt(wp.x, wp.z)) c.ice = true;
  }
  return G;
}

function computeFlowField(grid, objGx, objGz) {
  const { cells } = grid;
  for (let i = 0; i < cells.length; i++) { cells[i].dist = 1e9; cells[i].dx = 0; cells[i].dz = 0; }
  if (!grid.inBounds(objGx, objGz)) return;
  const q = [{ gx: objGx, gz: objGz }];
  cells[grid.idx(objGx, objGz)].dist = 0;
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
  let head = 0;
  while (head < q.length) {
    const cur = q[head++];
    const cd = cells[grid.idx(cur.gx, cur.gz)].dist;
    for (const d of dirs) {
      const nx = cur.gx + d[0], nz = cur.gz + d[1];
      if (!grid.inBounds(nx, nz)) continue;
      const ni = grid.idx(nx, nz);
      if (cells[ni].blocked) continue;
      if (d[0] !== 0 && d[1] !== 0) {
        if (cells[grid.idx(cur.gx + d[0], cur.gz)].blocked || cells[grid.idx(cur.gx, cur.gz + d[1])].blocked) continue;
      }
      // ice is quicker underfoot than snow, so the field prefers it — that is
      // the whole point of leaving a pond in the middle of your maze
      const step = (d[0] !== 0 && d[1] !== 0) ? 1.414 : 1;
      const nd = cd + step * (cells[ni].ice ? 0.72 : 1);
      if (nd < cells[ni].dist - 1e-6) { cells[ni].dist = nd; q.push({ gx: nx, gz: nz }); }
    }
  }
  for (let gz = 0; gz < GRID_H; gz++) for (let gx = 0; gx < GRID_W; gx++) {
    const ci = grid.idx(gx, gz);
    if (cells[ci].blocked || cells[ci].dist >= 1e8) continue;
    let bestD = cells[ci].dist, bx = 0, bz = 0;
    for (const d of dirs) {
      const nx = gx + d[0], nz = gz + d[1];
      if (!grid.inBounds(nx, nz)) continue;
      const nd = cells[grid.idx(nx, nz)].dist;
      if (nd < bestD) { bestD = nd; bx = d[0]; bz = d[1]; }
    }
    const L = Math.hypot(bx, bz) || 1;
    cells[ci].dx = bx / L; cells[ci].dz = bz / L;
  }
}

function checkConnectivity(grid, spawns, objGx, objGz) {
  const visited = new Uint8Array(grid.w * grid.h);
  const q = [{ gx: objGx, gz: objGz }];
  visited[grid.idx(objGx, objGz)] = 1;
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  let head = 0;
  while (head < q.length) {
    const cur = q[head++];
    for (const d of dirs) {
      const nx = cur.gx + d[0], nz = cur.gz + d[1];
      if (!grid.inBounds(nx, nz)) continue;
      const ni = grid.idx(nx, nz);
      if (visited[ni] || grid.cells[ni].blocked) continue;
      visited[ni] = 1; q.push({ gx: nx, gz: nz });
    }
  }
  for (const sp of spawns) {
    const g = grid.worldToGrid(sp.x, sp.z);
    if (!grid.inBounds(g.gx, g.gz)) continue;
    if (!visited[grid.idx(g.gx, g.gz)]) return false;
  }
  return true;
}

// ================================================================ towers
const TOWER_SPECS = {
  mg:     { range: 15, fireRate: 0.17, projSpeed: 95, dmg: 5,  blastR: 0.3, kv: 0.5, cost: 15, hp: 80,  crater: 0, label: "MG",     icon: "⊞", color: 0x5c7a3a, tracerCol: 0xffdd55, tracerSize: 0.55, hy: 1.0, blurb: "Fast, cheap, short reach" },
  gun:    { range: 19, fireRate: 1.05, projSpeed: 58, dmg: 25, blastR: 2.3, kv: 8,   cost: 25, hp: 130, crater: 0.55, label: "GUN",    icon: "⚑", color: 0x33619c, tracerCol: 0xff9944, tracerSize: 1.7,  hy: 1.5, blurb: "Flat-trajectory workhorse" },
  mortar: { range: 26, fireRate: 2.3,  projSpeed: 33, dmg: 38, blastR: 3.8, kv: 10,  cost: 35, hp: 95,  crater: 0.8, label: "MORTAR", icon: "◎", color: 0x8a5a1c, tracerCol: 0xff5522, tracerSize: 1.3,  hy: 0.8, blurb: "Arcs over walls, big blast" },
  rocket: { range: 23, fireRate: 4.4,  projSpeed: 30, dmg: 27, blastR: 3.4, kv: 9,   cost: 50, hp: 110, volley: 4, crater: 0.7, label: "ROCKET", icon: "▲", color: 0x8a3a3a, tracerCol: 0xff3311, tracerSize: 2.3, hy: 1.2, blurb: "Four-round salvo, slow reload" },
  frost:  { range: 12, fireRate: 0,    projSpeed: 0,  dmg: 0,  blastR: 0,   kv: 0,   cost: 20, hp: 85,  label: "FROST",  icon: "❄", color: 0x3a7a9c, tracerCol: 0x66ccff, tracerSize: 1.0, slow: 0.42, hy: 1.35, blurb: "Halves their pace in radius" },
};
const TOWER_ORDER = ["mg", "gun", "mortar", "rocket", "frost"];

function stepTowers(world) {
  const dt = world.dt;
  for (const b of world.bodies) {
    if (b.kind !== "tower") continue;
    const spec = TOWER_SPECS[b.towerType] || TOWER_SPECS.gun;
    if (spec.fireRate <= 0) continue;
    b.fireCd = (b.fireCd || 0) - dt;
    // hold a target between scans; re-acquire only when it dies or walks out
    let best = b.targetId ? world.byId.get(b.targetId) : null;
    if (best && (!best.alive || best.team !== 2)) best = null;
    if (best) {
      const dx = best.pos.x - b.pos.x, dz = best.pos.z - b.pos.z;
      if (dx * dx + dz * dz > spec.range * spec.range) best = null;
    }
    b.scanCd = (b.scanCd || 0) - dt;
    if (!best && b.scanCd <= 0) {
      b.scanCd = 0.11 + (b.id % 8) * 0.011;   // ~8Hz, staggered so scans don't align
      let bd = spec.range * spec.range;
      for (const e of world.bodies) {
        if (e.kind !== "unit" || !e.alive || e.team !== 2) continue;
        const dx = e.pos.x - b.pos.x, dz = e.pos.z - b.pos.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < bd) { bd = d2; best = e; }
      }
    }
    b.targetId = best ? best.id : null;
    if (!best || b.fireCd > 0) continue;
    b.fireCd = spec.fireRate;
    b.flashT = world.t;
    const muzzle = v3(b.pos.x, b.pos.y + b.hy + 0.45, b.pos.z);
    const high = b.towerType === "mortar";
    // lead: predicted intercept point, refined twice. Matters most for the
    // mortar's high arc (3s+ flight) but tightens the gun and rockets too.
    let ax2 = best.pos.x, az2 = best.pos.z, ay2 = best.pos.y;
    for (let li = 0; li < 2; li++) {
      const ld = Math.max(2, Math.hypot(ax2 - muzzle.x, az2 - muzzle.z));
      const lp = aimSolve(spec.projSpeed, ld, ay2 - muzzle.y, 9.8, high);
      if (lp == null) break;
      const tof = ld / Math.max(1e-3, spec.projSpeed * Math.cos(lp));
      ax2 = best.pos.x + best.v.x * tof;
      az2 = best.pos.z + best.v.z * tof;
      ay2 = world.field.heightAt(ax2, az2) + best.hy;   // they stay on the ground
    }
    const dx = ax2 - muzzle.x, dz = az2 - muzzle.z;
    const dy = ay2 - muzzle.y;
    const shots = spec.volley || 1;
    for (let si = 0; si < shots; si++) {
      const ox = shots > 1 ? (Math.random() - 0.5) * 3 : 0;
      const oz = shots > 1 ? (Math.random() - 0.5) * 3 : 0;
      const tdx = dx + ox, tdz = dz + oz;
      const td = Math.max(2, Math.hypot(tdx, tdz));
      let pitch = aimSolve(spec.projSpeed, td, dy, 9.8, high);
      if (pitch == null) pitch = high ? 1.1 : 0.45;
      const dir = v3((tdx / td) * Math.cos(pitch), Math.sin(pitch), (tdz / td) * Math.cos(pitch));
      fireProjectile(world, v3(muzzle.x, muzzle.y + si * 0.28, muzzle.z), dir, spec.projSpeed,
        { r: spec.blastR, kv: spec.kv, dmg: spec.dmg, crater: spec.crater, tracerCol: spec.tracerCol, tracerSize: spec.tracerSize });
    }
  }
}

// ================================================================== town
// Hollow keeps and houses out of welded stone. Sleeping until something
// disturbs them, exactly like the proving grounds, so ~700 stones cost nothing
// while they stand. Every stone is welded; shells shear the welds and the
// building comes down on whatever is inside it.
function buildTown(world, grid, field) {
  const { hcs, pitch, mass, breakF } = MASON;
  const out = [];
  for (const t of TOWN) {
    const grid3 = [], base = field.heightAt(t.x, t.z) + hcs + 0.02;
    for (let ix = 0; ix < t.nx; ix++) for (let iy = 0; iy <= t.ny; iy++) for (let iz = 0; iz < t.nz; iz++) {
      const perim = ix === 0 || ix === t.nx - 1 || iz === 0 || iz === t.nz - 1;
      if (iy < t.ny && !perim) continue;                                  // hollow
      if (ix === t.door && (iz === 1 || iz === 2) && iy <= 2) continue;   // the doorway
      const c = addBody(world, {
        kind: "chunk", team: 0, mass, hx: hcs, hy: hcs, hz: hcs,
        x: t.x + (ix - (t.nx - 1) / 2) * pitch,
        y: base + iy * pitch,
        z: t.z + (iz - (t.nz - 1) / 2) * pitch,
        friction: 0.65, restitution: 0.02,
      });
      c.sleeping = true;          // dormant until a shell or a breaker arrives
      c.town = t.id;
      c.gpos = [ix, iy, iz];
      grid3.push(c);
    }
    const key = (a, b, c2) => a + "," + b + "," + c2;
    const map = new Map(grid3.map((c) => [key(c.gpos[0], c.gpos[1], c.gpos[2]), c]));
    for (const c of grid3) {
      const g = c.gpos;
      for (const d of [[1, 0, 0], [0, 1, 0], [0, 0, 1]]) {
        const o = map.get(key(g[0] + d[0], g[1] + d[1], g[2] + d[2]));
        if (o) addWeld(world, c, o, breakF);
      }
    }
    // the footprint blocks the grid until the building is mostly gone
    const cells = [];
    const hx = (t.nx * pitch) / 2, hz = (t.nz * pitch) / 2;
    for (let gz = 0; gz < GRID_H; gz++) for (let gx = 0; gx < GRID_W; gx++) {
      const wp = grid.gridToWorld(gx, gz);
      // margin covers stone extent + a unit's half-width, or the flow field
      // routes marchers into the physical face and they pin there
      if (Math.abs(wp.x - t.x) < hx + 1.0 && Math.abs(wp.z - t.z) < hz + 1.0) {
        if (Math.hypot(wp.x - OBJ_POS.x, wp.z - OBJ_POS.z) < 5) continue;
        const c = grid.cells[grid.idx(gx, gz)];
        c.blocked = true; c.building = t.id;
        cells.push(grid.idx(gx, gz));
      }
    }
    out.push({ id: t.id, cells, stones: grid3, n0: grid3.length, ruined: false, x: t.x, z: t.z });
  }
  return out;
}
// A building is a ruin once a third of its stones have fallen or been culled;
// at that point its cells open up and the pather is told to re-route through it.
function stepTown(world, grid, town, onRuin) {
  for (const b of town) {
    if (b.ruined) continue;
    let standing = 0;
    for (const s of b.stones) if (world.byId.has(s.id) && s.sleeping) standing++;
    if (standing > b.n0 * 0.66) continue;
    b.ruined = true;
    for (const ci of b.cells) { const c = grid.cells[ci]; c.blocked = false; c.building = null; }
    world.events.push({ type: "collapse", x: b.x, y: world.field.heightAt(b.x, b.z) + 2, z: b.z });
    if (onRuin) onRuin(b);
  }
}

// =============================================================== masonry
// Structure LOD. A wall is ONE body while intact — it sleeps, it costs nothing,
// and the solver never has to converge a lattice under wave load. The moment it
// dies it is replaced by its welded stones, which shear, topple and settle
// exactly like the proving-ground keep. Granular physics is an event, not a
// steady state; that is the invariant the whole engine is built on.
const STONE = 0.30;
const STONE_PITCH = 0.63;
function shatterStructure(world, b, opts) {
  const NX = 3, NY = (opts && opts.ny) || 3, NZ = 3;
  const grid = [], base = b.pos.y - b.hy;
  for (let ix = 0; ix < NX; ix++) for (let iy = 0; iy < NY; iy++) for (let iz = 0; iz < NZ; iz++) {
    const c = addBody(world, {
      kind: "chunk", team: 0, mass: 88, hx: STONE, hy: STONE, hz: STONE,
      x: b.pos.x + (ix - (NX - 1) / 2) * STONE_PITCH,
      y: base + STONE + iy * STONE_PITCH,
      z: b.pos.z + (iz - (NZ - 1) / 2) * STONE_PITCH,
      friction: 0.65, restitution: 0.02,
    });
    c.v.x = b.v.x; c.v.y = b.v.y; c.v.z = b.v.z;   // inherit the killing blow
    c.gpos = [ix, iy, iz];
    c.bornT = world.t;
    grid.push(c);
  }
  const key = (a, b2, c2) => a + "," + b2 + "," + c2;
  const map = new Map(grid.map((c) => [key(c.gpos[0], c.gpos[1], c.gpos[2]), c]));
  for (const c of grid) {
    const g = c.gpos;
    for (const d of [[1, 0, 0], [0, 1, 0], [0, 0, 1]]) {
      const o = map.get(key(g[0] + d[0], g[1] + d[1], g[2] + d[2]));
      if (o) addWeld(world, c, o, 1.8e4);
    }
  }
  world.events.push({ type: "collapse", x: b.pos.x, y: b.pos.y, z: b.pos.z });
  return grid;
}

// =============================================================== enemies
const ENEMY_SPECS = {
  "":    { mass: 82,  hx: 0.26, hy: 0.86, hz: 0.26, hp: 58,  bounty: 4, speed: 3.2, gain: 14, label: "conscript" },
  fast:  { mass: 62,  hx: 0.24, hy: 0.82, hz: 0.24, hp: 36,  bounty: 5, speed: 5.1, gain: 18, label: "runner" },
  heavy: { mass: 340, hx: 0.46, hy: 1.02, hz: 0.46, hp: 290, bounty: 12, speed: 2.1, gain: 11, label: "breaker" },
  gren:  { mass: 84,  hx: 0.26, hy: 0.92, hz: 0.26, hp: 66,  bounty: 8, speed: 2.6, gain: 12, label: "grenadier" },
};

function stepUnits(world, grid) {
  const dt = world.dt;
  const frosts = [];
  for (const b of world.bodies) {
    if (b.kind === "tower" && b.towerType === "frost") {
      const s = TOWER_SPECS.frost;
      frosts.push({ x: b.pos.x, z: b.pos.z, r2: s.range * s.range, slow: s.slow });
    }
  }
  for (const u of world.bodies) {
    if (u.kind !== "unit" || !u.alive) continue;
    u.frosted = false; u.frostMul = 1;
    for (const f of frosts) {
      const dx = u.pos.x - f.x, dz = u.pos.z - f.z;
      if (dx * dx + dz * dz < f.r2) { u.frosted = true; u.frostMul = f.slow; break; }
    }
    // "grounded" only comes from terrain contacts — a unit standing on rubble
    // or another body never earns it and would freeze. Resting means not
    // falling: near-zero vertical speed counts as support.
    const supported = u.grounded || Math.abs(u.v.y) < 0.6;
    if (supported && u.R[4] > -0.5) {   // even flat on their back they struggle upright
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

    // riflemen: everything that is not a grenadier still carries a rifle and
    // will stop to work on a wall or an emplacement rather than walk past it
    if (u.tag !== "gren") {
      u.fireCd = (u.fireCd || 0) - dt;
      u.scanCd = (u.scanCd || 0) - dt;
      const RIFLE_R2 = 13 * 13;
      let tgt = u.tgtId ? world.byId.get(u.tgtId) : null;
      if (tgt) {
        const dx = tgt.pos.x - u.pos.x, dz = tgt.pos.z - u.pos.z;
        if ((tgt.kind !== "tower" && tgt.kind !== "wall") || dx * dx + dz * dz > RIFLE_R2) tgt = null;
      }
      if (!tgt && u.scanCd <= 0) {
        u.scanCd = 0.13 + (u.id % 8) * 0.012;
        let td = RIFLE_R2;
        for (const s of world.bodies) {
          if (s.kind !== "tower" && s.kind !== "wall") continue;
          const dx = s.pos.x - u.pos.x, dz = s.pos.z - u.pos.z, d2 = dx * dx + dz * dz;
          if (d2 < td) { td = d2; tgt = s; }
        }
      }
      u.tgtId = tgt ? tgt.id : null;
      if (tgt) {
        if (u.fireCd <= 0) {
          u.fireCd = (u.tag === "heavy" ? 1.1 : 1.5) + Math.random() * 0.5;
          u.flashT = world.t;
          const muzzle = v3(u.pos.x, u.pos.y + 0.5, u.pos.z);
          const dx = tgt.pos.x - muzzle.x, dz = tgt.pos.z - muzzle.z;
          const d = Math.max(1.5, Math.hypot(dx, dz));
          const dy = tgt.pos.y - muzzle.y;
          let pitch = aimSolve(70, d, dy);
          if (pitch == null) pitch = Math.atan2(dy, d);
          fireProjectile(world, muzzle, v3((dx / d) * Math.cos(pitch), Math.sin(pitch), (dz / d) * Math.cos(pitch)), 70,
            { r: 0.6, kv: 1.0, dmg: u.tag === "heavy" ? 9 : 5, hitWalls: true, hitOnly: "structure", tracerCol: 0xffd27a, tracerSize: 0.5 });
        }
        // they close slowly while firing rather than standing still
        if (cell && cell.dist < 1e8) {
          const sp = spec.speed * 0.35 * u.frostMul;
          u.v.x += (cell.dx * sp - u.v.x) * Math.min(1, 4 * dt);
          u.v.z += (cell.dz * sp - u.v.z) * Math.min(1, 4 * dt);
          faceTravel(u, dt);
          continue;
        }
      }
    }
    // grenadiers halt at range and shell your emplacements
    if (u.tag === "gren") {
      u.grenCd = (u.grenCd || 0) - dt;
      u.scanCd = (u.scanCd || 0) - dt;
      const GREN_R2 = 21 * 21;
      let tgt = u.tgtId ? world.byId.get(u.tgtId) : null;
      if (tgt) {
        const dx = tgt.pos.x - u.pos.x, dz = tgt.pos.z - u.pos.z;
        if ((tgt.kind !== "tower" && tgt.kind !== "wall") || dx * dx + dz * dz > GREN_R2) tgt = null;
      }
      if (!tgt && u.scanCd <= 0) {
        u.scanCd = 0.13 + (u.id % 8) * 0.012;
        let tgtD = GREN_R2;
        for (const b of world.bodies) {
          if (b.kind !== "tower" && b.kind !== "wall") continue;
          const dx = b.pos.x - u.pos.x, dz = b.pos.z - u.pos.z, d2 = dx * dx + dz * dz;
          if (d2 < tgtD) { tgtD = d2; tgt = b; }
        }
      }
      u.tgtId = tgt ? tgt.id : null;
      if (tgt && u.grenCd <= 0) {
        u.grenCd = 3.0 + Math.random() * 0.6;
        u.flashT = world.t;
        const muzzle = v3(u.pos.x, u.pos.y + 1.0, u.pos.z);
        const dx = tgt.pos.x + (Math.random() - 0.5) * 2.2 - muzzle.x;
        const dz = tgt.pos.z + (Math.random() - 0.5) * 2.2 - muzzle.z;
        const d = Math.max(2, Math.hypot(dx, dz));
        let pitch = aimSolve(28, d, tgt.pos.y - muzzle.y);
        if (pitch == null) pitch = 1.0;
        fireProjectile(world, muzzle, v3((dx / d) * Math.cos(pitch), Math.sin(pitch), (dz / d) * Math.cos(pitch)), 28,
          { r: 2.6, kv: 6, dmg: 20, crater: 0.45, hitWalls: true, tracerCol: 0xffaa44, tracerSize: 1.0 });
      }
      if (tgt && cell && cell.dist < 1e8) {
        const sp = 1.3 * u.frostMul;
        u.v.x += (cell.dx * sp - u.v.x) * Math.min(1, 3 * dt);
        u.v.z += (cell.dz * sp - u.v.z) * Math.min(1, 3 * dt);
        faceTravel(u, dt);
        continue;
      }
    }
    if (!cell || cell.dist >= 1e8) {
      // off the board (spawn crowding can shove one clear of it) or standing on
      // a blocked/unreached cell: head for the best neighbouring cell the flow
      // field DOES cover, so a unit pressed into a building corner walks out of
      // it instead of pinning against the map-centre pull forever
      let ex = -u.pos.x, ez = -u.pos.z;
      const g = grid ? grid.worldToGrid(u.pos.x, u.pos.z) : null;
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
      // safety net: a unit that stays off the field for 12s (wedged inside a
      // hollow shell through its doorway, say) is written off for its bounty so
      // a wave can never hang on one lost soldier
      u.lostT = (u.lostT || 0) + dt;
      if (u.lostT > 12) applyDamage(world, u, 1e9);
      continue;
    }
    u.lostT = 0;
    // ice underfoot: quicker, but the grip is gone so they steer lazily
    const onIce = cell.ice;
    const speed = spec.speed * u.frostMul * (onIce ? 1.3 : 1);
    const gain = Math.min(1, spec.gain * (onIce ? 0.4 : 1) * dt);
    u.v.x += (cell.dx * speed - u.v.x) * gain;
    u.v.z += (cell.dz * speed - u.v.z) * gain;
    faceTravel(u, dt);
  }
}
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

// ================================================================= waves
const WAVES = [
  { units: 14, delay: 0.9 },
  { units: 20, delay: 0.8 },
  { units: 22, delay: 0.7, mix: [["", 14], ["fast", 8]] },
  { units: 26, delay: 0.7, mix: [["", 18], ["heavy", 4], ["gren", 4]] },
  { units: 32, delay: 0.6 },
  { units: 28, delay: 0.45, mix: [["fast", 18], ["heavy", 10]] },
  { units: 38, delay: 0.5, mix: [["", 22], ["heavy", 8], ["gren", 8]] },
  { units: 34, delay: 0.4, mix: [["fast", 16], ["gren", 8], ["heavy", 10]] },
  { units: 46, delay: 0.42, mix: [["", 22], ["heavy", 12], ["gren", 6], ["fast", 6]] },
  { units: 54, delay: 0.38, mix: [["", 18], ["heavy", 16], ["gren", 10], ["fast", 10]] },
  { units: 44, delay: 0.3, mix: [["heavy", 30], ["gren", 14]] },
  { units: 66, delay: 0.26, mix: [["", 22], ["fast", 16], ["heavy", 16], ["gren", 12]] },
];
function makeWaveState() { return { waveIdx: 0, spawnQueue: 0, spawnTimer: 0, spawnDelay: 1, active: false, betweenWaves: true, countdown: 8, mixBag: [] }; }
function spawnEnemy(world, sp, tag) {
  const spec = ENEMY_SPECS[tag] || ENEMY_SPECS[""];
  const x = sp.x + (Math.random() - 0.5) * 3.4, z = sp.z + (Math.random() - 0.5) * 1.5;
  const u = addBody(world, { kind: "unit", team: 2, mass: spec.mass, hx: spec.hx, hy: spec.hy, hz: spec.hz, x, z, y: world.field.heightAt(x, z) + spec.hy + 0.02, hp: spec.hp, friction: 0.38 });
  u.tag = tag || ""; u.bounty = spec.bounty;
  u.wph = Math.random() * 6.28;
  return u;
}

// =========================================================== projectiles
function fireProjectile(world, from, dir, speed, spec) {
  const p = { pos: v3(from.x, from.y, from.z), v: v3(dir.x * speed, dir.y * speed, dir.z * speed), life: 0, spec };
  world.projectiles.push(p);
  world.events.push({ type: "muzzle", x: from.x, y: from.y, z: from.z });
  return p;
}
function stepProjectiles(world) {
  const dt = world.dt, F = world.field;
  for (let i = world.projectiles.length - 1; i >= 0; i--) {
    const p = world.projectiles[i];
    p.life += dt;
    if (p.life > 5) { world.projectiles.splice(i, 1); continue; }
    const px = p.pos.x, py = p.pos.y, pz = p.pos.z;
    p.v.y -= world.gravity * dt;
    V.addScaled(p.pos, p.pos, p.v, dt);
    if (p.pos.y < F.heightAt(p.pos.x, p.pos.z)) {
      const h = F.heightAt(p.pos.x, p.pos.z);
      explode(world, p.pos.x, h, p.pos.z, p.spec);
      world.projectiles.splice(i, 1); continue;
    }
    // swept sphere-vs-body, AABB-rejected first
    const sx = p.pos.x - px, sy = p.pos.y - py, sz = p.pos.z - pz;
    const L = Math.sqrt(sx * sx + sy * sy + sz * sz) || 1;
    const nx = sx / L, ny = sy / L, nz = sz / L;
    const bx0 = Math.min(px, p.pos.x), bx1 = Math.max(px, p.pos.x);
    const by0 = Math.min(py, p.pos.y), by1 = Math.max(py, p.pos.y);
    const bz0 = Math.min(pz, p.pos.z), bz1 = Math.max(pz, p.pos.z);
    let hitBody = null, bestT = 1;
    const wantStruct = p.spec.hitOnly === "structure";
    for (const b of world.bodies) {
      if (wantStruct) { if (b.kind !== "tower" && b.kind !== "wall" && b.kind !== "chunk") continue; }
      else if (b.kind !== "unit" || !b.alive || b.team !== 2) continue;
      const hr = Math.max(b.hx, b.hy, b.hz) + 0.25;
      if (b.pos.x + hr < bx0 || b.pos.x - hr > bx1) continue;
      if (b.pos.y + hr < by0 || b.pos.y - hr > by1) continue;
      if (b.pos.z + hr < bz0 || b.pos.z - hr > bz1) continue;
      const ox = px - b.pos.x, oy = py - b.pos.y, oz = pz - b.pos.z;
      const tca = -(ox * nx + oy * ny + oz * nz);
      const d2 = ox * ox + oy * oy + oz * oz - tca * tca;
      if (d2 < hr * hr && tca > -hr && tca < L + hr) {
        const t = Math.max(0, tca) / L;
        if (t < bestT) { bestT = t; hitBody = b; }
      }
    }
    if (hitBody) {
      explode(world, px + sx * bestT, py + sy * bestT, pz + sz * bestT, p.spec);
      world.projectiles.splice(i, 1);
    }
  }
}
function explode(world, x, y, z, spec) {
  world.events.push({ type: "boom", x, y, z, r: spec.r });
  // ordnance reshapes the ground and burns the snow off it
  const groundH = world.field.heightAt(x, z);
  if (y - groundH < 1.6 && spec.crater) {
    world.field.carve(x, z, spec.crater * 2.4, spec.crater);
    world.events.push({ type: "splat", x, z, r: spec.crater * 3.4 });
    // static structures do not follow the heightfield down — re-seat any
    // in or near the carve so nothing floats over its own crater
    const seatR = spec.crater * 2.4 + 1.5;
    for (const s of world.bodies) {
      if (s.kind !== "wall" && s.kind !== "tower") continue;
      if (Math.hypot(s.pos.x - x, s.pos.z - z) > seatR) continue;
      s.pos.y = world.field.heightAt(s.pos.x, s.pos.z) + s.hy;
    }
  }
  const c = v3(x, y, z);
  for (const b of world.bodies) {
    if (!b.alive && b.kind === "unit") continue;
    const d = v3(); V.sub(d, b.pos, c);
    const dist = Math.max(0.4, V.len(d));
    const reach = spec.r + Math.max(b.hx, b.hy, b.hz);
    if (dist > reach) continue;
    const f = Math.max(0, 1 - dist / reach);
    if (b.invM > 0) {
      if (b.kind === "chunk") wake(b); else wakeIsland(world, b);
      const dir = v3(d.x / dist, d.y / dist + 0.45, d.z / dist);
      V.norm(dir, dir);
      const temper = Math.min(1, Math.sqrt(220 / Math.max(80, b.mass)));
      const dv = spec.kv * f * temper;
      V.addScaled(b.v, b.v, dir, dv);
      // tumble
      const arm = v3((Math.random() - 0.5) * b.hx, b.hy * 0.5, (Math.random() - 0.5) * b.hz);
      const L2 = v3(); V.cross(L2, arm, V.scale(v3(), dir, dv * b.mass));
      const dw = v3(); iMulVec(b.invIw, L2, dw);
      V.addScaled(b.w, b.w, dw, 0.6);
      // shock severs masonry NOW: a stone the solver is still holding eats its
      // own blast velocity, so freed stones must be freed in the same step
      if (b.kind === "chunk") {
        const jmag = b.mass * dv * 0.7;
        const my = world.weldsOf && world.weldsOf.get(b.id);
        if (my) for (const wd of my) {
          if (wd.broken) continue;
          wd.acc[0] += dir.x * jmag; wd.acc[1] += dir.y * jmag; wd.acc[2] += dir.z * jmag;
          if (Math.hypot(wd.acc[0], wd.acc[1], wd.acc[2]) / world.dt > wd.breakF) {
            wd.broken = true; world._weldPairsDirty = true;
            world.events.push({ type: "weldbreak", x: b.pos.x, y: b.pos.y, z: b.pos.z });
            for (const cb of [wd.a, wd.b]) { cb.fallingSince = world.t; wake(cb); }
          }
        }
      }
    }
    if (b.alive && b.kind === "unit") applyDamage(world, b, spec.dmg * f * (dist < 1.2 ? 1.5 : 1));
    if (spec.hitWalls && (b.kind === "wall" || b.kind === "tower")) {
      b.hp -= spec.dmg * f;
      b.hitT = world.t;
    }
  }
}
function applyDamage(world, b, dmg) {
  if (!b.alive) return;
  b.hp -= dmg;
  b.hitT = world.t;
  if (b.hp <= 0) {
    b.alive = false; b.deadT = world.t;
    world.events.push({ type: "kill", x: b.pos.x, y: b.pos.y, z: b.pos.z, tag: b.tag, bounty: b.bounty || 3 });
  }
}

// ================================================================== step
function stepWorld(world, grid, onStructureLost, town, onRuin) {
  const dt = world.dt;
  world.t += dt;
  stepUnits(world, grid);
  for (const b of world.bodies) {
    if (b.invM === 0 || b.sleeping) continue;
    qToR(b.q, b.R);
    invInertiaWorld(b.R, b.invIb, b.invIw);
    b.v.y -= world.gravity * dt;
    b.v.x *= 1 - 0.02 * dt; b.v.y *= 1 - 0.02 * dt; b.v.z *= 1 - 0.02 * dt;
    b.w.x *= 1 - 0.08 * dt; b.w.y *= 1 - 0.08 * dt; b.w.z *= 1 - 0.08 * dt;
  }
  collectContacts(world);
  prepContacts(world);
  const activeWelds = [];
  for (const wd of world.welds) if (!wd.broken && !(wd.a.sleeping && wd.b.sleeping)) activeWelds.push(wd);
  const itn = activeWelds.length + world.contacts.length > 700 ? 6 : 10;
  for (let it = 0; it < itn; it++) { solveWelds(world, activeWelds); solveContacts(world); }
  weldBreakPass(world);
  world.warm.clear();
  for (const c of world.contacts) world.warm.set(c.key, { pn: c.pn, pt1: c.pt1, pt2: c.pt2 });
  for (const b of world.bodies) {
    if (b.invM === 0 || b.sleeping) continue;
    V.addScaled(b.pos, b.pos, b.v, dt);
    qIntegrate(b.q, b.w, dt);
    if (b.groundedNow) { b.airT = 0; b.grounded = true; } else { b.airT += dt; b.grounded = false; }
  }
  for (const b of world.bodies) {
    if (b.invM === 0 || b.sleeping) continue;
    if (b.kind === "unit" && b.alive) { b.sleepT = 0; continue; }
    if (V.len2(b.v) < 0.06 && V.len2(b.w) < 0.09) {
      b.sleepT += dt;
      if (b.sleepT > 0.55) { b.sleeping = true; V.set(b.v, 0, 0, 0); V.set(b.w, 0, 0, 0); }
    } else b.sleepT = 0;
  }
  stepTowers(world);
  stepProjectiles(world);
  weldBreakPass(world);
  // breakers shoulder into your masonry
  for (const c of world.contacts) {
    if (c.pn <= 0 || !c.b) continue;
    const a = c.a, b = c.b;
    const unit = a.tag === "heavy" ? a : b.tag === "heavy" ? b : null;
    const str = unit === a ? b : a;
    if (unit && unit.alive && (str.kind === "wall" || str.kind === "tower")) {
      const sp = Math.hypot(unit.v.x, unit.v.z);
      if (sp > 0.8) { str.hp -= sp * dt * 16; str.hitT = world.t; }
    }
  }
  // structures that lost the argument
  for (let i = world.bodies.length - 1; i >= 0; i--) {
    const b = world.bodies[i];
    if ((b.kind === "wall" || b.kind === "tower") && b.hp <= 0) {
      // structure LOD flips here: the shell becomes its welded stones
      shatterStructure(world, b, { ny: b.kind === "tower" ? 4 : 3 });
      world.events.push({ type: "structureLost", id: b.id, kind: b.kind });
      world.byId.delete(b.id); world.bodies.splice(i, 1);
      if (onStructureLost) onStructureLost(b);
    }
  }
  for (let i = world.bodies.length - 1; i >= 0; i--) {
    const b = world.bodies[i];
    if (b.kind === "unit" && !b.alive && world.t - (b.deadT || 0) > 2.5) { world.byId.delete(b.id); world.bodies.splice(i, 1); }
    else if (b.kind === "chunk" && !b.town && b.sleeping && world.t - (b.bornT || 0) > 14) {
      // settled rubble is culled: four collapses at 27 stones each would
      // otherwise own the chunk pool permanently
      const wl = world.weldsOf.get(b.id);
      if (wl) for (const wd of wl) wd.broken = true;
      world.weldsOf.delete(b.id);
      world._weldPairsDirty = true;
      world.byId.delete(b.id); world.bodies.splice(i, 1);
    }
  }
  if (town) stepTown(world, grid, town, onRuin);
  // leaks. NOTE: events are cleared by the CALLER before each substep and
  // drained after — clearing them in here (as an earlier cut did) silently ate
  // every kill, boom and muzzle raised by the same step, which reads in-game
  // as no explosions and no bounty income.
  for (let i = world.bodies.length - 1; i >= 0; i--) {
    const b = world.bodies[i];
    if (b.kind !== "unit" || !b.alive || b.team !== 2) continue;
    if (Math.hypot(b.pos.x - OBJ_POS.x, b.pos.z - OBJ_POS.z) < 3.0) {
      world.events.push({ type: "leak", dmg: b.tag === "heavy" ? 2 : 1, x: b.pos.x, y: b.pos.y, z: b.pos.z });
      world.byId.delete(b.id); world.bodies.splice(i, 1);
    }
  }
}

// =============================================================== renderer
// The proving-ground dress tables, verbatim. 60-30-10: field cloth dominant,
// dark kit secondary, brass accent worn high where a 34-degree camera looks.
// swing: the part hinges about local X at the walk phase; ty pre-translates the
// geometry so the origin sits at the joint.
const INFANTRY = {
  con: [
    { key: "coat", cyl: [0.185, 0.3, 1.02, 4], rotY: Math.PI / 4, off: [0, -0.23, 0], role: "dom" },
    { key: "boot", box: [0.38, 0.14, 0.26], off: [0, -0.79, 0.02], role: "sec" },
    { key: "belt", box: [0.44, 0.07, 0.32], off: [0, 0.06, 0], role: "sec" },
    { key: "scarf", box: [0.4, 0.13, 0.32], off: [0, 0.35, 0], role: "acc" },
    { key: "head", box: [0.26, 0.26, 0.26], off: [0, 0.54, 0], role: "skin" },
    { key: "cap", box: [0.34, 0.17, 0.34], off: [0, 0.705, 0], role: "dom" },
    { key: "flapL", box: [0.07, 0.2, 0.22], off: [-0.185, 0.56, 0], role: "sec" },
    { key: "flapR", box: [0.07, 0.2, 0.22], off: [0.185, 0.56, 0], role: "sec" },
    { key: "armL", box: [0.12, 0.44, 0.16], ty: -0.22, off: [-0.3, 0.28, 0], role: "dom", swing: 1, swingK: 0.9 },
    { key: "armR", box: [0.12, 0.44, 0.16], ty: -0.22, off: [0.3, 0.28, 0], role: "dom", swing: -1, swingK: 0.9 },
    { key: "rifle", box: [0.05, 0.05, 0.9], preRot: [0.9, 0.2, 0.25], off: [-0.1, 0.19, -0.26], role: "gun" },
  ],
  gren: [
    { key: "legL", box: [0.17, 0.56, 0.22], ty: -0.28, off: [-0.13, -0.12, 0], role: "dom", swing: 1, swingK: 1 },
    { key: "legR", box: [0.17, 0.56, 0.22], ty: -0.28, off: [0.13, -0.12, 0], role: "dom", swing: -1, swingK: 1 },
    { key: "bootL", box: [0.18, 0.16, 0.24], ty: -0.64, off: [-0.13, -0.12, 0.01], role: "sec", swing: 1, swingK: 1 },
    { key: "bootR", box: [0.18, 0.16, 0.24], ty: -0.64, off: [0.13, -0.12, 0.01], role: "sec", swing: -1, swingK: 1 },
    { key: "belt", box: [0.42, 0.16, 0.28], off: [0, -0.1, 0], role: "sec" },
    { key: "chest", box: [0.5, 0.44, 0.3], off: [0, 0.2, 0], role: "dom" },
    { key: "armL", box: [0.13, 0.48, 0.17], ty: -0.24, off: [-0.315, 0.4, 0], role: "dom", swing: -1, swingK: 1 },
    { key: "armR", box: [0.13, 0.48, 0.17], ty: -0.24, off: [0.315, 0.4, 0], role: "dom", swing: 1, swingK: 1 },
    { key: "head", box: [0.26, 0.26, 0.26], off: [0, 0.55, 0], role: "skin" },
    { key: "helmet", box: [0.35, 0.16, 0.35], off: [0, 0.715, 0], role: "acc" },
    { key: "pack", box: [0.3, 0.34, 0.13], off: [0, 0.18, -0.24], role: "sec" },
    { key: "tube", box: [0.16, 1.1, 0.16], off: [0, 0.2, -0.36], role: "gun" },
  ],
};
// heavies wear the grenadier's frame at scale; runners and conscripts the coat
const DRESS_OF = { "": "con", fast: "con", gren: "gren", heavy: "gren" };
const INF_PAL = {
  "":     { dom: 0xa63c3c, sec: 0x2c3339, acc: 0xc9a04e, skin: 0xd9c6a0, gun: 0x14171a },
  fast:   { dom: 0x3f6fbf, sec: 0x22303f, acc: 0x9fe0ff, skin: 0xd9c6a0, gun: 0x14171a },
  heavy:  { dom: 0x6b4a7a, sec: 0x241c2c, acc: 0xd7b45a, skin: 0xc9b697, gun: 0x14171a },
  gren:   { dom: 0x2f3a46, sec: 0x1b2126, acc: 0xc9a04e, skin: 0xd9c6a0, gun: 0x14171a },
};
const INF_DEAD = { dom: 0x4a3a32, sec: 0x241f1c, acc: 0x5c4a2e, skin: 0x8a7a62, gun: 0x101314 };
const MAX_UNITS = 140;

const POST_VERT = "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }";
const POST_FRAG = `
uniform sampler2D tCol; uniform sampler2D tNor; uniform sampler2D tDep; uniform sampler2D tBayer;
uniform vec2 uRes; uniform vec2 uShift; uniform float uOutline; uniform float uDither; uniform float uPalette; uniform float uLevels; uniform float uVig; uniform float uSrgb;
varying vec2 vUv;
// Colour pipeline differs by three version and a raw ShaderMaterial gets none
// of the automatic handling either way. Modern three (colorspace era) renders
// LINEAR into the target and expects us to encode on output, or the whole game
// displays ~20% too dark. r128 does no conversion anywhere, and encoding there
// blows 40% of the frame to white. So the renderer feature-detects and tells
// the shader which world it is in.
vec3 lin2srgb(vec3 c){
  return mix(c * 12.92, 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}
void main(){
  vec2 px = 1.0 / uRes;
  vec2 uv = vUv + uShift * px;
  vec3 c = texture2D(tCol, uv).rgb;
  if (uSrgb > 0.5) c = lin2srgb(c);
  vec3 n0 = texture2D(tNor, uv).xyz;
  float d0 = texture2D(tDep, uv).x;
  vec3 nx = texture2D(tNor, uv + vec2(px.x, 0.0)).xyz;
  vec3 ny = texture2D(tNor, uv + vec2(0.0, px.y)).xyz;
  float dx = texture2D(tDep, uv + vec2(px.x, 0.0)).x;
  float dy = texture2D(tDep, uv + vec2(0.0, px.y)).x;
  float en = step(0.42, distance(n0, nx) + distance(n0, ny));
  float ed = step(0.0022, abs(d0 - dx) + abs(d0 - dy));
  float edge = max(en, ed) * uOutline;
  float bay = texture2D(tBayer, fract(uv * uRes / 4.0)).r - 0.5;
  // dither only where there is gradient to break up — a flat sky quantised
  // with full-amplitude noise turns into a visible dot screen
  vec3 q = floor(c * uLevels + bay * uDither + 0.5) / uLevels;
  c = mix(c, q, step(0.5, uPalette));
  c = mix(c, c * vec3(0.93, 0.97, 1.06), 0.35 * step(0.5, uPalette));
  c = mix(c, c * 0.2, edge);
  float r = distance(vUv, vec2(0.5));
  c *= 1.0 - uVig * smoothstep(0.42, 0.92, r);
  gl_FragColor = vec4(c, 1.0);
}`;

function makeRenderer(canvas, world0, grid0) {
  let world = world0, grid = grid0;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.BasicShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xc4d2e0);
  scene.fog = new THREE.Fog(0xc4d2e0, 95, 230);
  const NORM_BG = new THREE.Color(0x8080ff);
  const grad = (() => {
    const d = new Uint8Array([70, 70, 70, 255, 128, 128, 128, 255, 190, 190, 190, 255, 255, 255, 255, 255]);
    const t = new THREE.DataTexture(d, 4, 1, THREE.RGBAFormat);
    t.minFilter = THREE.NearestFilter; t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true;
    return t;
  })();
  const toon = (color) => new THREE.MeshToonMaterial({ color, gradientMap: grad });

  const cam = new THREE.OrthographicCamera(-40, 40, 25, -25, 2, 400);
  const yawA = (194 * Math.PI) / 180, pitchA = (34 * Math.PI) / 180, camDist = 150;
  const back = { x: Math.sin(yawA) * Math.cos(pitchA), y: Math.sin(pitchA), z: Math.cos(yawA) * Math.cos(pitchA) };
  cam.position.set(back.x * camDist, back.y * camDist, back.z * camDist);
  cam.lookAt(0, 0, 0); cam.updateMatrixWorld();
  const camQ = cam.quaternion.clone();
  const camFwd = { x: -back.x, y: -back.y, z: -back.z };
  const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camQ);
  const camUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camQ);
  const R3 = (v) => ({ x: v.x, y: v.y, z: v.z });

  scene.add(new THREE.HemisphereLight(0xe2ecf7, 0x7e8fa3, 0.62));
  const sun = new THREE.DirectionalLight(0xfff0da, 0.92);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -42; sun.shadow.camera.right = 42;
  sun.shadow.camera.top = 42; sun.shadow.camera.bottom = -42;
  sun.shadow.camera.near = 5; sun.shadow.camera.far = 210; sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.06;
  scene.add(sun); scene.add(sun.target);

  // ---- terrain
  const F = world.field;
  const Wd = (F.n - 1) * F.cs;   // 120 cells now: the edge sits well outside the fog
  const terraGeo = new THREE.PlaneGeometry(Wd, Wd, F.n - 1, F.n - 1);
  terraGeo.rotateX(-Math.PI / 2);
  let scorchDecal = null;
  const terraTex = (() => {
    const cv = document.createElement("canvas"); cv.width = 1024; cv.height = 1024;
    const cx = cv.getContext("2d");
    const W2U = 1024 / Wd, U0 = Wd / 2;
    const uu = (x2) => (x2 + U0) * W2U, vv = (z2) => (z2 + U0) * W2U;
    cx.fillStyle = "#f2f6fa"; cx.fillRect(0, 0, 1024, 1024);
    cx.fillStyle = "#e2eaf3";
    for (let i = 0; i < 2600; i++) cx.fillRect((i * 137) % 1024, (i * 89 + ((i * i) % 7) * 31) % 1024, 3, 3);
    cx.fillStyle = "#cdd9e6";
    for (let i = 0; i < 900; i++) cx.fillRect((i * 251) % 1024, (i * 173 + ((i * i) % 11) * 17) % 1024, 2, 2);
    // tactical grid: 4m minors, 20m majors, draped over the heightfield by the
    // terrain UVs so relief reads at a glance — the lines bend over the rocks
    for (let gm = -Math.floor(U0 / 4) * 4; gm <= U0; gm += 4) {
      const gp = Math.round(uu(gm));
      cx.fillStyle = gm % 20 === 0 ? "rgba(96,110,128,0.42)" : "rgba(139,152,168,0.26)";
      cx.fillRect(gp, 0, 2, 1024); cx.fillRect(0, gp, 1024, 2);
    }
    // the buildable square, called out a shade heavier
    cx.fillStyle = "rgba(84,98,118,0.50)";
    for (const gp of [uu(GRID_OX), uu(GRID_OX + GRID_W * GRID_CS)]) cx.fillRect(Math.round(gp), Math.round(vv(GRID_OZ)), 3, Math.round(GRID_H * GRID_CS * W2U));
    for (const gp of [vv(GRID_OZ), vv(GRID_OZ + GRID_H * GRID_CS)]) cx.fillRect(Math.round(uu(GRID_OX)), Math.round(gp), Math.round(GRID_W * GRID_CS * W2U), 3);
    if (!cx.beginPath || !cx.stroke || !cx.arc) { const t0 = new THREE.CanvasTexture(cv); t0.minFilter = THREE.NearestFilter; t0.magFilter = THREE.NearestFilter; t0.generateMipmaps = false; return t0; }
    // the roads they march up: churned earth showing through the snow
    const lane = (x0, z0, x1, z1, wm, col) => {
      cx.strokeStyle = col || "rgba(101,92,80,0.55)"; cx.lineCap = "round";
      cx.lineWidth = wm * W2U;
      cx.beginPath(); cx.moveTo(uu(x0), vv(z0)); cx.lineTo(uu(x1), vv(z1)); cx.stroke();
    };
    for (const sp of SPAWN_POINTS) {
      lane(sp.x, sp.z - 6, sp.x, sp.z + 12, 6);
      lane(sp.x, sp.z + 12, OBJ_POS.x, OBJ_POS.z - 8, 5);
      for (const o of [-1.3, 1.3]) lane(sp.x + o, sp.z - 6, sp.x + o, sp.z + 12, 0.6, "rgba(66,58,48,0.35)");
    }
    // depot yard
    cx.fillStyle = "rgba(150,143,132,0.45)";
    cx.beginPath(); cx.arc(uu(OBJ_POS.x), vv(OBJ_POS.z), 8 * W2U, 0, Math.PI * 2); cx.fill();
    // pond shores
    cx.strokeStyle = "rgba(140,128,110,0.40)"; cx.lineWidth = 5;
    for (const p of PONDS) { cx.beginPath(); cx.arc(uu(p.x), vv(p.z), p.r * W2U, 0, Math.PI * 2); cx.stroke(); }
    const t = new THREE.CanvasTexture(cv);
    t.minFilter = THREE.NearestFilter; t.magFilter = THREE.NearestFilter; t.generateMipmaps = false;
    scorchDecal = (x2, z2, rM) => {
      if (!cx.createRadialGradient) return;
      const u = uu(x2), v = vv(z2), rp = rM * W2U;
      const gg = cx.createRadialGradient(u, v, 1, u, v, rp);
      gg.addColorStop(0, "rgba(24,20,18,0.85)");
      gg.addColorStop(0.55, "rgba(38,32,28,0.5)");
      gg.addColorStop(1, "rgba(38,32,28,0)");
      cx.fillStyle = gg;
      cx.beginPath(); cx.arc(u, v, rp, 0, Math.PI * 2); cx.fill();
      t.needsUpdate = true;
    };
    return t;
  })();
  const terraMat = toon(0xffffff); terraMat.map = terraTex;
  const terra = new THREE.Mesh(terraGeo, terraMat); terra.receiveShadow = true; scene.add(terra);
  function syncTerrain() {
    const pa = terraGeo.attributes.position;
    for (let j = 0; j < F.n; j++) for (let i = 0; i < F.n; i++) pa.setY(j * F.n + i, F.h[j * F.n + i]);
    pa.needsUpdate = true; terraGeo.computeVertexNormals();
    let ca = terraGeo.attributes.color;
    if (!ca) { terraGeo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(F.n * F.n * 3), 3)); ca = terraGeo.attributes.color; terraMat.vertexColors = true; terraMat.needsUpdate = true; }
    for (let j = 0; j < F.n; j++) for (let i = 0; i < F.n; i++) {
      const k = j * F.n + i;
      const x = i * F.cs - F.half, z = j * F.cs - F.half;
      const iw = i > 0 ? k - 1 : k, ie = i < F.n - 1 ? k + 1 : k;
      const jn = j > 0 ? k - F.n : k, js = j < F.n - 1 ? k + F.n : k;
      const g = Math.hypot(F.h[ie] - F.h[iw], F.h[js] - F.h[jn]) / (2 * F.cs);
      // relief shading, straight from the proving grounds: the toon band
      // collapses every gentle slope into the same white, so slope is baked
      // into vertex colour and the ice gets the cool tint the pond bowl had
      const shade = 1 - Math.min(0.3, g * 0.62);
      const wet = !!pondAt(x, z);
      const cr = shade * (wet ? 0.84 : 1), cg = shade * (wet ? 0.9 : 1), cb = shade * (wet ? 0.98 : 1);
      ca.setXYZ(k, cr, cg, cb);
    }
    ca.needsUpdate = true; F.dirty = false;
  }
  syncTerrain();

  // ---- ice sheets
  const iceMat = new THREE.MeshBasicMaterial({ color: 0xbfe3f5, transparent: true, opacity: 0.5, depthWrite: false });
  for (const p of PONDS) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(p.r, 30), iceMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(p.x, p.level + 0.06, p.z);
    scene.add(m);
    const rim2 = new THREE.Mesh(new THREE.RingGeometry(p.r - 0.35, p.r + 0.15, 34), new THREE.MeshBasicMaterial({ color: 0xe8f6ff, transparent: true, opacity: 0.55, depthWrite: false }));
    rim2.rotation.x = -Math.PI / 2; rim2.position.set(p.x, p.level + 0.08, p.z); scene.add(rim2);
  }
  // ---- rock outcrops: a few chunky prisms per cluster
  {
    const rr = mulberry32(99);
    const rockMat = toon(0xa6b2c0);
    for (const k of ROCKS) {
      for (let i = 0; i < 4; i++) {
        const a = rr() * 6.283, d = rr() * k.r * 0.62;
        const x = k.x + Math.cos(a) * d, z = k.z + Math.sin(a) * d;
        const s = 1.5 + rr() * 1.6;
        const m = new THREE.Mesh(new THREE.BoxGeometry(s * 1.5, s * 1.9, s * 1.4), rockMat);
        m.position.set(x, F.heightAt(x, z) + s * 0.55, z);
        m.rotation.set((rr() - 0.5) * 0.3, rr() * 3.14, (rr() - 0.5) * 0.3);
        m.castShadow = true; m.receiveShadow = true;
        scene.add(m);
        const cap = new THREE.Mesh(new THREE.BoxGeometry(s * 1.56, s * 0.3, s * 1.46), toon(0xeef4fb));
        cap.position.set(x, m.position.y + s * 0.95, z);
        cap.rotation.copy(m.rotation); cap.castShadow = true;
        scene.add(cap);
      }
    }
  }

  // ---- treeline
  {
    const tr = mulberry32(4242);
    const trunkM = toon(0x40372f), needleM = toon(0x2b4438), snowM2 = toon(0xf4f9ff);
    const trunkG = new THREE.CylinderGeometry(0.16, 0.24, 1.5, 5);
    const coneG = new THREE.ConeGeometry(1, 1, 7);
    const trunks = new THREE.InstancedMesh(trunkG, trunkM, 260);
    const tiers = new THREE.InstancedMesh(coneG, needleM, 780);
    const caps = new THREE.InstancedMesh(coneG, snowM2, 780);
    trunks.castShadow = tiers.castShadow = true;
    const d2 = new THREE.Object3D();
    let ti = 0, ci = 0;
    const place = (x, z) => {
      if (ti >= 260) return;
      const gx = (x - GRID_OX) / GRID_CS, gz = (z - GRID_OZ) / GRID_CS;
      const insideGrid = gx > -1.5 && gx < GRID_W + 1.5 && gz > -1.5 && gz < GRID_H + 1.5;
      if (insideGrid) return;                       // never on the battlefield
      if (pondAt(x, z) || rockAt(x, z)) return;
      const y = F.heightAt(x, z), s = 1.5 + tr() * 1.5;
      d2.position.set(x, y + 0.75 * s, z); d2.rotation.set(0, tr() * 6.28, 0); d2.scale.set(s, s, s);
      d2.updateMatrix(); trunks.setMatrixAt(ti++, d2.matrix);
      for (let k = 0; k < 3; k++) {
        if (ci >= 780) break;
        const w2 = (1.9 - k * 0.45) * s, h2 = (2.0 - k * 0.35) * s;
        d2.position.set(x, y + (1.1 + k * 1.25) * s, z);
        d2.rotation.set(0, tr() * 6.28, 0); d2.scale.set(w2, h2, w2);
        d2.updateMatrix(); tiers.setMatrixAt(ci, d2.matrix);
        d2.scale.set(w2 * 0.84, h2 * 0.42, w2 * 0.84);
        d2.position.y += h2 * 0.30; d2.updateMatrix();
        caps.setMatrixAt(ci, d2.matrix);
        ci++;
      }
    };
    // a ragged belt just outside the playable square
    for (let i = 0; i < 900 && ti < 260; i++) {
      const a = tr() * 6.283, r = 46 + tr() * 46;
      place(Math.cos(a) * r, Math.sin(a) * r * 0.92);
    }
    trunks.count = ti; tiers.count = ci; caps.count = ci;
    scene.add(trunks); scene.add(tiers); scene.add(caps);
  }

  // Coldsnap masonry as a single mesh: courses of 0.8m stones with the 3cm
  // joint the engine uses, merged so a wall is one instance and not eight.
  function mergeBoxes(specs) {
    const parts = specs.map((s) => {
      const g = new THREE.BoxGeometry(s[3], s[4], s[5]);
      g.translate(s[0], s[1], s[2]);
      return g;
    });
    let vc = 0, ic = 0;
    for (const g of parts) { vc += g.attributes.position.count; ic += g.index ? g.index.count : 0; }
    const pos = new Float32Array(vc * 3), nor = new Float32Array(vc * 3), uv = new Float32Array(vc * 2);
    const idx = new Uint16Array(ic);
    let vo = 0, io = 0;
    for (const g of parts) {
      pos.set(g.attributes.position.array, vo * 3);
      nor.set(g.attributes.normal.array, vo * 3);
      uv.set(g.attributes.uv.array, vo * 2);
      const gi = g.index.array;
      for (let k = 0; k < gi.length; k++) idx[io + k] = gi[k] + vo;
      vo += g.attributes.position.count; io += gi.length;
      g.dispose();
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    out.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
    out.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    out.setIndex(new THREE.BufferAttribute(idx, 1));
    return out;
  }
  // a 1.8m block of nine stones, three courses of three, with joints
  const MASONRY_BLOCK = (() => {
    const s = 0.545, p = 0.60, specs = [];
    for (let ix = 0; ix < 3; ix++) for (let iy = 0; iy < 3; iy++)
      specs.push([(ix - 1) * p, (iy - 1) * p, 0, s, s, 1.78]);
    return mergeBoxes(specs);
  })();
  const masonryPlinth = (w, h, d) => {
    const nx = Math.max(2, Math.round(w / 0.62)), ny = Math.max(1, Math.round(h / 0.62));
    const px = w / nx, py = h / ny, specs = [];
    for (let ix = 0; ix < nx; ix++) for (let iy = 0; iy < ny; iy++) {
      const jog = (iy % 2) * px * 0.5;   // running bond
      specs.push([(ix - (nx - 1) / 2) * px + jog * 0.3, (iy - (ny - 1) / 2) * py, 0, px * 0.9, py * 0.9, d]);
    }
    return mergeBoxes(specs);
  };

  const dummy = new THREE.Object3D();
  function pool(geo, mat, n, shadow) {
    const m = new THREE.InstancedMesh(geo, mat, n);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3).fill(1), 3);
    m.instanceColor.setUsage(THREE.DynamicDrawUsage);
    m.count = 0; if (shadow) m.castShadow = true; scene.add(m); return m;
  }
  function writeInst(mesh, i, x, y, z, q, sx, sy, sz) {
    dummy.position.set(x, y, z);
    if (q) dummy.quaternion.set(q.x, q.y, q.z, q.w); else dummy.quaternion.identity();
    dummy.scale.set(sx, sy, sz); dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }

  // a soft contact patch under every structure — without it towers hover
  const padMesh = pool(new THREE.CircleGeometry(1.35, 16), new THREE.MeshBasicMaterial({ color: 0x2c3646, transparent: true, opacity: 0.30, depthWrite: false }), 260, false);
  padMesh.layers.set(1);
  // ---- walls: stone block + a cap of snow
  const PALISADE = (() => {
    const specs = [];
    for (let i = 0; i < 5; i++) {
      const x = (i - 2) * 0.36;
      specs.push([x, -0.1 + ((i * 3) % 4) * 0.06, 0, 0.3, 1.62, 0.62]);   // stakes
    }
    specs.push([0, -0.62, 0, 1.86, 0.34, 0.8]);                            // sill
    specs.push([0, 0.42, 0, 1.9, 0.24, 0.74]);                             // rail
    return mergeBoxes(specs);
  })();
  const wallMesh = pool(PALISADE, toon(0x3b3029), 400, true); wallMesh.receiveShadow = true;
  const wallCapMesh = pool(new THREE.BoxGeometry(1.9, 0.22, 0.8), toon(0xf6fafe), 400, false);

  // ---- town shells
  // Structure LOD for the eye as well as the solver: while a building stands
  // it is drawn as a building — dark timber, snow-laden roof, lit windows —
  // and its 700-odd stones are not drawn at all. The moment it is ruined the
  // shell is hidden and the stones take over. Cube soup was the whole problem.
  const TIMBER = 0x3b3029, TIMBER_D = 0x2a221d, IRON = 0x22262b, ROOF_SNOW = 0xf2f7fc, WARM = 0xffb45e;
  const townShells = new Map();
  function buildShell(t) {
    const g = new THREE.Group();
    const W = t.nx * MASON.pitch, D = t.nz * MASON.pitch, H = t.ny * MASON.pitch;
    const wallM = toon(TIMBER), trimM = toon(TIMBER_D), snowM = toon(ROOF_SNOW);
    const body = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), wallM);
    body.position.y = H / 2; body.castShadow = true; body.receiveShadow = true; g.add(body);
    // corner posts and a sill band give it timber grammar at 20px
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.34, H + 0.2, 0.34), trimM);
      post.position.set(sx * (W / 2 - 0.1), H / 2, sz * (D / 2 - 0.1)); post.castShadow = true; g.add(post);
    }
    const sill = new THREE.Mesh(new THREE.BoxGeometry(W + 0.16, 0.26, D + 0.16), trimM);
    sill.position.y = H * 0.62; g.add(sill);
    // pitched roof, two slabs, thick with snow
    const rise = Math.max(1.1, H * 0.42), slabW = Math.hypot(D / 2, rise) + 0.3;
    for (const s of [-1, 1]) {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(W + 0.7, 0.3, slabW), toon(TIMBER_D));
      slab.position.set(0, H + rise / 2 - 0.05, s * (D / 4));
      slab.rotation.x = s * -Math.atan2(rise, D / 2);
      slab.castShadow = true; g.add(slab);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(W + 0.8, 0.26, slabW), snowM);
      cap.position.copy(slab.position); cap.position.y += 0.26;
      cap.rotation.x = slab.rotation.x; cap.castShadow = true; g.add(cap);
    }
    const ridgeCap = new THREE.Mesh(new THREE.BoxGeometry(W + 0.9, 0.3, 0.5), snowM);
    ridgeCap.position.y = H + rise + 0.12; g.add(ridgeCap);
    // doorway on the recorded face, and windows that are lit
    const dsx = (t.door - (t.nx - 1) / 2) * MASON.pitch;
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.0, 0.22), toon(IRON));
    door.position.set(dsx, 1.0, -D / 2 - 0.02); g.add(door);
    const winM = new THREE.MeshBasicMaterial({ color: WARM });
    for (const s of [-1, 1]) for (let i = 0; i < Math.max(1, Math.floor(t.nx / 3)); i++) {
      const wx = (i - (Math.max(1, Math.floor(t.nx / 3)) - 1) / 2) * 2.1;
      const win = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.8), winM);
      win.position.set(wx, H * 0.44, s * (D / 2 + 0.03));
      if (s < 0) win.rotation.y = Math.PI;
      g.add(win);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.86, 1.0, 0.12), trimM);
      frame.position.set(wx, H * 0.44, s * (D / 2 - 0.02)); g.add(frame);
    }
    return g;
  }
  // ---- rubble from collapsed structures
  const rubbleMesh = pool(new THREE.BoxGeometry(1, 1, 1), toon(0x6b6157), 1100, true);
  rubbleMesh.receiveShadow = true;
  // ---- infantry: one instanced pool per dress part
  const buildInfPools = (spec, n) => spec.map((p) => {
    let g;
    if (p.cyl) { g = new THREE.CylinderGeometry(p.cyl[0], p.cyl[1], p.cyl[2], p.cyl[3], 1); if (p.rotY) g.rotateY(p.rotY); }
    else g = new THREE.BoxGeometry(p.box[0], p.box[1], p.box[2]);
    if (p.ty) g.translate(0, p.ty, 0);
    if (p.preRot) { g.rotateX(p.preRot[0]); g.rotateY(p.preRot[1]); g.rotateZ(p.preRot[2]); }
    // material stays WHITE: instanceColor MULTIPLIES it, and painting both
    // squares the palette (rust^2 = brick — the pencil-sketch soldier bug)
    const m = pool(g, toon(0xffffff), n, true);
    if (p.key === "coat" || p.key === "chest") m.receiveShadow = true;
    return m;
  });
  const conPools = buildInfPools(INFANTRY.con, MAX_UNITS);
  const grenPools = buildInfPools(INFANTRY.gren, 64);
  const _swq = new THREE.Quaternion(), _bq = new THREE.Quaternion(), _AXX = new THREE.Vector3(1, 0, 0);
  const _col = new THREE.Color();
  const PAL_CACHE = {};
  for (const k in INF_PAL) { PAL_CACHE[k] = {}; for (const r in INF_PAL[k]) PAL_CACHE[k][r] = new THREE.Color(INF_PAL[k][r]); }
  const DEAD_CACHE = {}; for (const r in INF_DEAD) DEAD_CACHE[r] = new THREE.Color(INF_DEAD[r]);
  const FROST_C = new THREE.Color(0x9fdcff);

  // ---- health pips over damaged enemies
  const PIP_MAX = MAX_UNITS + 200;
  const pipBgMesh = pool(new THREE.PlaneGeometry(1.1, 0.16), new THREE.MeshBasicMaterial({ color: 0x101418, transparent: true, opacity: 0.75, depthWrite: false, depthTest: false }), PIP_MAX, false);
  const pipFgMesh = pool(new THREE.PlaneGeometry(1.0, 0.10), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, depthTest: false }), PIP_MAX, false);
  pipBgMesh.layers.set(1); pipFgMesh.layers.set(1);
  pipBgMesh.renderOrder = 900; pipFgMesh.renderOrder = 901;

  // ---- towers: one Group per body, distinct silhouette per type
  const towerGroups = new Map();
  function buildTowerMesh(type) {
    const spec = TOWER_SPECS[type] || TOWER_SPECS.gun;
    const g = new THREE.Group();
    const steel = toon(spec.color), dark = toon(new THREE.Color(spec.color).multiplyScalar(0.55).getHex());
    const iron = toon(0x2a2f36), snowM = toon(0xeef4fa);
    // stone emplacement: four masonry faces, the same courses as the keep
    // a revetment of sandbags on a timber frame: reads at 20px, and it is not
    // another pile of grey cubes
    const bagM = toon(0x6f6a58), bagM2 = toon(0x5d594a);
    for (let iy = 0; iy < 3; iy++) {
      const r2 = 1.02 - iy * 0.05, n2 = 10;
      for (let i = 0; i < n2; i++) {
        const a = (i / n2) * Math.PI * 2 + iy * 0.31;
        const bag = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.3, 0.34), i % 2 ? bagM : bagM2);
        bag.position.set(Math.cos(a) * r2, -spec.hy + 0.2 + iy * 0.31, Math.sin(a) * r2);
        bag.rotation.y = -a; bag.castShadow = true; g.add(bag);
      }
    }
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.5, spec.hy * 1.25, 1.5), toon(0x3b3029));
    frame.position.y = -spec.hy * 0.05; frame.castShadow = true; g.add(frame);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, spec.hy * 1.5, 0.2), toon(0x2a221d));
      post.position.set(sx * 0.72, -spec.hy * 0.02, sz * 0.72); post.castShadow = true; g.add(post);
    }
    const capStone = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.22, 1.9), toon(0xeef4fa));
    capStone.position.y = spec.hy * 0.62; g.add(capStone);
    if (type === "mg") {
      
      const slit = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.26, 1.2), steel); slit.position.y = spec.hy * 0.38; g.add(slit);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.16, 1.8), snowM); cap.position.y = spec.hy * 0.82; g.add(cap);
      const t = new THREE.Group(); t.position.y = spec.hy * 0.42; g.add(t); g.userData.turret = t;
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.11, 1.5), iron); bar.position.z = 0.75; t.add(bar);
    } else if (type === "gun") {
      
      const deck = new THREE.Mesh(new THREE.BoxGeometry(2.16, 0.3, 2.16), dark); deck.position.y = spec.hy * 0.72; deck.castShadow = true; g.add(deck);
      const t = new THREE.Group(); t.position.y = spec.hy * 1.05; g.add(t); g.userData.turret = t;
      const mant = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.62, 1.15), dark); mant.castShadow = true; t.add(mant);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 2.3), iron); bar.position.z = 1.2; t.add(bar);
      const brake = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, 0.3), iron); brake.position.z = 2.25; t.add(brake);
    } else if (type === "mortar") {
      
      const lip = new THREE.Mesh(new THREE.CylinderGeometry(1.24, 1.24, 0.2, 8), snowM); lip.position.y = spec.hy * 0.72; g.add(lip);
      const t = new THREE.Group(); t.position.y = spec.hy * 0.5; g.add(t); g.userData.turret = t;
      const tube = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.9, 0.3), iron);
      tube.position.set(0, 0.55, 0.2); tube.rotation.x = -0.62; tube.castShadow = true; t.add(tube);
      const bipod = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.1, 0.1), iron); bipod.position.set(0, 0.2, 0.6); t.add(bipod);
    } else if (type === "rocket") {
      
      const t = new THREE.Group(); t.position.y = spec.hy * 0.6; g.add(t); g.userData.turret = t;
      const rack = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.9, 1.0), dark); rack.castShadow = true; t.add(rack);
      for (let i = 0; i < 4; i++) {
        const tube = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 1.5), iron);
        tube.position.set((i % 2 ? 0.32 : -0.32), (i < 2 ? 0.26 : -0.16), 0.7);
        t.add(tube);
      }
      t.rotation.x = -0.22;
    } else {
      // frost: a growth of ice on a stone plinth
      const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.95, 0), new THREE.MeshToonMaterial({ color: 0x9fe0ff, gradientMap: grad, transparent: true, opacity: 0.9 }));
      core.position.y = spec.hy * 0.25; core.castShadow = true; g.add(core);
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.5, 5), new THREE.MeshToonMaterial({ color: 0xd6f2ff, gradientMap: grad, transparent: true, opacity: 0.92 }));
      spike.position.y = spec.hy * 0.95; g.add(spike);
      for (let i = 0; i < 3; i++) {
        const s = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.8, 4), new THREE.MeshToonMaterial({ color: 0xbfe8ff, gradientMap: grad, transparent: true, opacity: 0.85 }));
        const a = i * 2.09;
        s.position.set(Math.cos(a) * 0.65, -spec.hy * 0.1, Math.sin(a) * 0.65);
        s.rotation.z = Math.cos(a) * -0.45; s.rotation.x = Math.sin(a) * 0.45;
        g.add(s);
      }
      g.userData.spin = true;
    }
    return g;
  }

  // ---- objective depot
  // The depot itself is a welded Coldsnap keep built by buildTown — all that
  // belongs here is the mast, so the objective reads from across the map.
  const depot = new THREE.Group();
  {
    const mast = new THREE.Mesh(new THREE.BoxGeometry(0.16, 6.0, 0.16), toon(0x2a2f36));
    mast.position.y = 3.0; mast.castShadow = true; depot.add(mast);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.95), new THREE.MeshBasicMaterial({ color: 0x4aff8c, side: THREE.DoubleSide }));
    flag.position.set(0.85, 5.3, 0); depot.add(flag);
    depot.userData.flag = flag;
  }
  scene.add(depot);
  const objRing = new THREE.Mesh(new THREE.RingGeometry(2.7, 3.4, 30), new THREE.MeshBasicMaterial({ color: 0x4aff8c, transparent: true, opacity: 0.5, depthWrite: false }));
  objRing.rotation.x = -Math.PI / 2; objRing.layers.set(1); scene.add(objRing);

  // ---- spawn banners
  for (const sp of SPAWN_POINTS) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.14, 3.2, 0.14), toon(0x2a2f36)); pole.position.y = 1.6; g.add(pole);
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.9), new THREE.MeshBasicMaterial({ color: 0xd8433a, side: THREE.DoubleSide })); cloth.position.set(0.72, 2.6, 0); g.add(cloth);
    g.position.set(sp.x, F.heightAt(sp.x, sp.z), sp.z);
    scene.add(g);
  }

  // ---- build hover: ghost footprint + range preview
  const hoverPad = new THREE.Mesh(new THREE.BoxGeometry(GRID_CS - 0.08, 0.12, GRID_CS - 0.08), new THREE.MeshBasicMaterial({ color: 0x4aff8c, transparent: true, opacity: 0.45, depthWrite: false }));
  hoverPad.layers.set(1); scene.add(hoverPad);
  const hoverRing = new THREE.Mesh(new THREE.RingGeometry(0.97, 1.0, 44), new THREE.MeshBasicMaterial({ color: 0x9fdcff, transparent: true, opacity: 0.55, depthWrite: false }));
  hoverRing.rotation.x = -Math.PI / 2; hoverRing.layers.set(1); scene.add(hoverRing);
  const hoverFill = new THREE.Mesh(new THREE.CircleGeometry(1, 44), new THREE.MeshBasicMaterial({ color: 0x6fb6dd, transparent: true, opacity: 0.09, depthWrite: false }));
  hoverFill.rotation.x = -Math.PI / 2; hoverFill.layers.set(1); scene.add(hoverFill);

  // ---- frost auras
  const frostRingMesh = pool(new THREE.RingGeometry(0.72, 1.0, 40), new THREE.MeshBasicMaterial({ color: 0x8fd8ff, transparent: true, opacity: 0.14, depthWrite: false }), 16, false);
  frostRingMesh.layers.set(1);

  // ---- tracers, glow, particles
  const tracerMesh = pool(new THREE.BoxGeometry(0.13, 0.13, 1.7), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }), 80, false); tracerMesh.layers.set(1);
  const glowMesh = pool(new THREE.BoxGeometry(0.42, 0.42, 2.3), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false }), 80, false); glowMesh.layers.set(1);
  const debrisMesh = pool(new THREE.BoxGeometry(0.2, 0.2, 0.2), toon(0x6a6f76), 180, false);
  const smokeMesh = pool(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x232a30, transparent: true, opacity: 0.5, depthWrite: false }), 120, false); smokeMesh.layers.set(1);
  const fireMesh = pool(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }), 96, false); fireMesh.layers.set(1);
  const coreMesh = pool(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }), 64, false); coreMesh.layers.set(1);
  const ringMesh = pool(new THREE.RingGeometry(0.7, 1.0, 22), new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }), 24, false); ringMesh.layers.set(1);
  const debris = [], smoke = [], fire = [], core = [], shock = [];
  function spawnBoom(x, y, z, r) {
    shock.push({ x, y: y + 0.15, z, s: r * 0.5, life: 0.32, age: 0, r });
    for (let i = 0; i < 9; i++) { if (debris.length >= 180) break; const a = Math.random() * 6.283; debris.push({ x, y: y + 0.3, z, vx: Math.cos(a) * (2 + Math.random() * 5), vy: 3 + Math.random() * 6, vz: Math.sin(a) * (2 + Math.random() * 5), rot: Math.random() * 6, spin: (Math.random() - 0.5) * 10, life: 1.1 + Math.random() * 0.5 }); }
    for (let i = 0; i < 7; i++) { if (smoke.length >= 118) break; smoke.push({ x: x + (Math.random() - 0.5) * r * 0.5, y: y + 0.4, z: z + (Math.random() - 0.5) * r * 0.5, vy: 1.6 + Math.random() * 1.2, s: 0.8 + Math.random() * r * 0.3, life: 1.3 + Math.random() * 0.6, age: 0 }); }
    for (let i = 0; i < 6; i++) { if (fire.length >= 94) break; fire.push({ x: x + (Math.random() - 0.5) * r * 0.4, y: y + 0.3 + Math.random() * 0.6, z: z + (Math.random() - 0.5) * r * 0.4, s: 0.8 + Math.random() * r * 0.35, life: 0.32, age: 0 }); }
    for (let i = 0; i < 4; i++) { if (core.length >= 62) break; core.push({ x: x + (Math.random() - 0.5) * r * 0.2, y: y + 0.4 + Math.random() * 0.3, z: z + (Math.random() - 0.5) * r * 0.2, s: 0.5 + Math.random() * r * 0.2, life: 0.18, age: 0 }); }
  }
  // snowfall
  const flakeMesh = pool(new THREE.PlaneGeometry(0.13, 0.13), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false }), 190, false); flakeMesh.layers.set(1);
  const flakes = [];
  for (let i = 0; i < 190; i++) flakes.push({ x: (Math.random() - 0.5) * 70, y: Math.random() * 36, z: (Math.random() - 0.5) * 70, vy: 1.3 + Math.random() * 1.6, ph: Math.random() * 6.28 });

  // ---- post
  const bayerTex = new THREE.DataTexture(new Uint8Array(BAYER4.flatMap((v) => [v * 17, v * 17, v * 17, 255])), 4, 4, THREE.RGBAFormat);
  bayerTex.minFilter = THREE.NearestFilter; bayerTex.magFilter = THREE.NearestFilter;
  bayerTex.wrapS = THREE.RepeatWrapping; bayerTex.wrapT = THREE.RepeatWrapping; bayerTex.needsUpdate = true;
  const postScene = new THREE.Scene();
  const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const postMat = new THREE.ShaderMaterial({
    vertexShader: POST_VERT, fragmentShader: POST_FRAG,
    uniforms: { tCol: { value: null }, tNor: { value: null }, tDep: { value: null }, tBayer: { value: bayerTex }, uRes: { value: new THREE.Vector2(320, 200) }, uShift: { value: new THREE.Vector2(0, 0) }, uOutline: { value: 1 }, uDither: { value: 1 }, uPalette: { value: 1 }, uLevels: { value: 7 }, uVig: { value: 0.0 }, uSrgb: { value: 0 } },
    depthTest: false, depthWrite: false,
  });
  // r152+ exposes outputColorSpace and renders linear into targets; r128 has
  // neither and passes colour through untouched.
  postMat.uniforms.uSrgb.value = ("outputColorSpace" in renderer) ? 1 : 0;
  postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMat));
  const normMat = new THREE.MeshNormalMaterial();
  let rtColor = null, rtNormal = null, rtW = 320, rtH = 200;
  let cssW = 0, cssH = 0, halfH = 22, halfW = 36, zoom = 1, pixScale = 2;
  function applyFrustum() {
    const a = cssW / Math.max(1, cssH);
    if (a >= 1) { halfH = 26 / zoom; halfW = halfH * a; } else { halfW = 19 / zoom; halfH = Math.min(halfW / a, halfW * 2.6); }
    cam.left = -halfW; cam.right = halfW; cam.top = halfH; cam.bottom = -halfH;
    cam.updateProjectionMatrix();
  }
  function rebuildRTs() {
    const w = Math.max(64, Math.floor(cssW / pixScale)), h = Math.max(64, Math.floor(cssH / pixScale));
    rtW = w; rtH = h;
    if (rtColor) { rtColor.dispose(); rtNormal.dispose(); }
    const depthTexture = new THREE.DepthTexture(w, h);
    rtColor = new THREE.WebGLRenderTarget(w, h, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true, depthTexture });
    rtNormal = new THREE.WebGLRenderTarget(w, h, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true });
    postMat.uniforms.tCol.value = rtColor.texture;
    postMat.uniforms.tDep.value = rtColor.depthTexture;
    postMat.uniforms.tNor.value = rtNormal.texture;
    postMat.uniforms.uRes.value.set(w, h);
  }
  function resize() {
    const w = canvas.clientWidth || 960, h = canvas.clientHeight || 600;
    if (w === cssW && h === cssH) return;
    cssW = w; cssH = h; renderer.setSize(w, h, false);
    applyFrustum(); rebuildRTs();
  }
  function setZoom(z) { zoom = Math.max(0.5, Math.min(2.6, z)); applyFrustum(); }
  function setGfx(p) {
    if (p.outline != null) postMat.uniforms.uOutline.value = p.outline;
    if (p.dither != null) postMat.uniforms.uDither.value = p.dither;
    if (p.palette != null) postMat.uniforms.uPalette.value = p.palette;
    if (p.scale != null && p.scale !== pixScale) { pixScale = p.scale; if (cssW) rebuildRTs(); }
  }

  function render(dt, focus, hover) {
    resize();
    const T = world.t;
    // craters mutate the heightfield; re-uploading 14k verts per burst is
    // wasteful, so coalesce to ~6 rebuilds a second
    if (F.dirty && T - (world._lastSync || -9) > 0.16) { world._lastSync = T; syncTerrain(); }
    // depot + ring
    const oy = F.heightAt(OBJ_POS.x, OBJ_POS.z);
    depot.position.set(OBJ_POS.x, oy, OBJ_POS.z);
    depot.userData.flag.rotation.y = Math.sin(T * 2.2) * 0.22;
    objRing.position.set(OBJ_POS.x, oy + 0.09, OBJ_POS.z);
    const pulse = 0.86 + 0.14 * Math.sin(T * 3);
    objRing.scale.set(pulse, pulse, 1);
    // hover
    if (hover) {
      hoverPad.visible = true;
      hoverPad.position.set(hover.x, F.heightAt(hover.x, hover.z) + 0.07, hover.z);
      hoverPad.material.color.setHex(hover.valid ? 0x4aff8c : 0xff5555);
      if (hover.valid && hover.range) {
        hoverRing.visible = hoverFill.visible = true;
        hoverRing.position.set(hover.x, F.heightAt(hover.x, hover.z) + 0.05, hover.z);
        hoverFill.position.copy(hoverRing.position);
        hoverRing.scale.set(hover.range, hover.range, 1);
        hoverFill.scale.set(hover.range, hover.range, 1);
      } else { hoverRing.visible = hoverFill.visible = false; }
    } else { hoverPad.visible = false; hoverRing.visible = hoverFill.visible = false; }

    // town shells: one mesh per standing building, stones hidden behind it
    const ruined = world.__ruined || (world.__ruined = new Set());
    if (world.town) for (const t of world.town) {
      let sh = townShells.get(t.id);
      if (!sh) {
        const spec = TOWN.find((x) => x.id === t.id);
        sh = buildShell(spec);
        sh.position.set(spec.x, F.heightAt(spec.x, spec.z), spec.z);
        townShells.set(t.id, sh); scene.add(sh);
      }
      if (t.ruined && sh.visible) { sh.visible = false; ruined.add(t.id); }
    }
    // rubble — only from things that have actually come down
    let rbi = 0;
    for (const b of world.bodies) {
      if (b.kind !== "chunk" || rbi >= 1100) continue;
      if (b.town && !ruined.has(b.town) && b.sleeping) continue;   // still a building
      writeInst(rubbleMesh, rbi, b.pos.x, b.pos.y, b.pos.z, b.q, b.hx * 2, b.hy * 2, b.hz * 2);
      rbi++;
    }
    rubbleMesh.count = rbi; rubbleMesh.instanceMatrix.needsUpdate = true;
    // contact patches
    let pdi = 0;
    for (const b of world.bodies) {
      if ((b.kind !== "wall" && b.kind !== "tower") || pdi >= 260) continue;
      writeInst(padMesh, pdi++, b.pos.x, F.heightAt(b.pos.x, b.pos.z) + 0.045, b.pos.z, { x: -0.7071, y: 0, z: 0, w: 0.7071 }, 1, 1, 1);
    }
    padMesh.count = pdi; padMesh.instanceMatrix.needsUpdate = true;
    // walls
    let ki = 0;
    for (const b of world.bodies) {
      if (b.kind !== "wall" || ki >= 400) continue;
      const hurt = b.hp / b.maxHp;
      writeInst(wallMesh, ki, b.pos.x, b.pos.y, b.pos.z, b.q, b.hx / 0.9, b.hy / 0.9, b.hz / 0.9);
      const flash = T - (b.hitT || -9) < 0.12 ? 1 : 0;
      _col.setRGB(1, 0.62 + 0.38 * hurt, 0.58 + 0.42 * hurt);
      if (flash) _col.setRGB(1.8, 1.3, 1.0);
      wallMesh.setColorAt(ki, _col);
      writeInst(wallCapMesh, ki, b.pos.x, b.pos.y + b.hy * 0.62, b.pos.z, b.q, 1, 1, 1);
      ki++;
    }
    wallMesh.count = ki; wallMesh.instanceMatrix.needsUpdate = true;
    if (wallMesh.instanceColor) wallMesh.instanceColor.needsUpdate = true;
    wallCapMesh.count = ki; wallCapMesh.instanceMatrix.needsUpdate = true;

    // infantry
    let ui = 0, gi = 0, pipN = 0;
    for (const b of world.bodies) {
      if (b.kind !== "unit") continue;
      if (!b.alive && T - (b.deadT || 0) > 1.6) continue;
      const dress = DRESS_OF[b.tag] || "con";
      const isG = dress === "gren";
      if (isG ? gi >= 64 : ui >= MAX_UNITS) continue;
      const spec = isG ? INFANTRY.gren : INFANTRY.con;
      const pools = isG ? grenPools : conPools;
      const idx = isG ? gi : ui;
      const R = b.R;
      const pal = b.alive ? (PAL_CACHE[b.tag] || PAL_CACHE[""]) : DEAD_CACHE;
      const sp = b.alive ? Math.hypot(b.v.x, b.v.z) : 0;
      const sw = Math.sin(b.wph || 0) * Math.min(0.55, sp * 0.22);
      const bulk = b.tag === "heavy" ? 1.42 : b.tag === "fast" ? 0.92 : 1;
      const tall = b.tag === "heavy" ? 1.14 : 1;
      const hit = T - (b.hitT || -9) < 0.1;
      for (let pi = 0; pi < spec.length; pi++) {
        const p = spec[pi], o = p.off;
        const ox = o[0] * bulk, oy2 = o[1] * tall, oz = o[2] * bulk;
        const px = b.pos.x + R[0] * ox + R[3] * oy2 + R[6] * oz;
        const py = b.pos.y + R[1] * ox + R[4] * oy2 + R[7] * oz;
        const pz = b.pos.z + R[2] * ox + R[5] * oy2 + R[8] * oz;
        let q = b.q;
        if (p.swing) {
          _bq.set(b.q.x, b.q.y, b.q.z, b.q.w);
          _swq.setFromAxisAngle(_AXX, sw * p.swing * (p.swingK || 1));
          _bq.multiply(_swq); q = _bq;
        }
        writeInst(pools[pi], idx, px, py, pz, q, bulk, tall, bulk);
        _col.copy(pal[p.role]);
        if (b.alive && b.frosted) _col.lerp(FROST_C, 0.45);
        if (hit) _col.multiplyScalar(2.1);
        pools[pi].setColorAt(idx, _col);
      }
      // health pip
      if (b.alive && b.hp < b.maxHp && pipN < PIP_MAX) {
        const f = Math.max(0, b.hp / b.maxHp);
        const hy2 = b.pos.y + b.hy * tall + 0.62;
        writeInst(pipBgMesh, pipN, b.pos.x, hy2, b.pos.z, camQ, bulk, 1, 1);
        dummy.position.set(b.pos.x, hy2, b.pos.z);
        dummy.quaternion.copy(camQ);
        dummy.scale.set(bulk * f, 1, 1);
        dummy.updateMatrix();
        // shift the bar so it drains from the right, not from both ends
        const shiftX = -(1 - f) * 0.5 * bulk;
        dummy.matrix.elements[12] += camRight.x * shiftX;
        dummy.matrix.elements[13] += camRight.y * shiftX;
        dummy.matrix.elements[14] += camRight.z * shiftX;
        pipFgMesh.setMatrixAt(pipN, dummy.matrix);
        _col.setRGB(f > 0.5 ? 0.35 : 1, f > 0.25 ? 0.95 : 0.4, 0.45);
        pipFgMesh.setColorAt(pipN, _col);
        pipN++;
      }
      if (isG) gi++; else ui++;
    }
    for (const m of conPools) { m.count = ui; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    for (const m of grenPools) { m.count = gi; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    // emplacements and walls carry the same bar, and only once they are hurt
    for (const b of world.bodies) {
      if (b.kind !== "tower" && b.kind !== "wall") continue;
      if (b.hp >= b.maxHp || pipN >= PIP_MAX) continue;
      const f = Math.max(0, b.hp / b.maxHp);
      const hy2 = b.pos.y + b.hy + 1.05;
      writeInst(pipBgMesh, pipN, b.pos.x, hy2, b.pos.z, camQ, 1.5, 1, 1);
      dummy.position.set(b.pos.x, hy2, b.pos.z);
      dummy.quaternion.copy(camQ);
      dummy.scale.set(1.5 * f, 1, 1);
      dummy.updateMatrix();
      const shiftX = -(1 - f) * 0.5 * 1.5;
      dummy.matrix.elements[12] += camRight.x * shiftX;
      dummy.matrix.elements[13] += camRight.y * shiftX;
      dummy.matrix.elements[14] += camRight.z * shiftX;
      pipFgMesh.setMatrixAt(pipN, dummy.matrix);
      _col.setRGB(f > 0.5 ? 0.4 : 1, f > 0.25 ? 0.9 : 0.35, 0.5);
      pipFgMesh.setColorAt(pipN, _col);
      pipN++;
    }
    pipBgMesh.count = pipN; pipBgMesh.instanceMatrix.needsUpdate = true;
    pipFgMesh.count = pipN; pipFgMesh.instanceMatrix.needsUpdate = true;
    if (pipFgMesh.instanceColor) pipFgMesh.instanceColor.needsUpdate = true;

    // towers
    const live = new Set();
    let fri = 0;
    for (const b of world.bodies) {
      if (b.kind !== "tower") continue;
      live.add(b.id);
      let g = towerGroups.get(b.id);
      if (!g) { g = buildTowerMesh(b.towerType); towerGroups.set(b.id, g); scene.add(g); }
      g.position.set(b.pos.x, b.pos.y, b.pos.z);
      const hurt = b.hp / b.maxHp;
      const flash = T - (b.hitT || -9) < 0.12;
      if (g.userData.turret) {
        const tgt = b.targetId ? world.byId.get(b.targetId) : null;
        if (tgt && tgt.alive) {
          const yaw = Math.atan2(tgt.pos.x - b.pos.x, tgt.pos.z - b.pos.z);
          g.userData.turret.rotation.y = yaw;
        }
        // recoil kick
        const since = T - (b.flashT || -9);
        const kick = since < 0.14 ? (1 - since / 0.14) * 0.3 : 0;
        g.userData.turret.position.z = -kick;
      }
      if (g.userData.spin) g.rotation.y = T * 0.5;
      g.scale.setScalar(hurt < 0.999 ? 0.94 + 0.06 * hurt : 1);
      if (flash) g.scale.multiplyScalar(1.06);
      if (b.towerType === "frost" && fri < 16) {
        const s = TOWER_SPECS.frost.range * (0.98 + 0.02 * Math.sin(T * 2 + b.id));
        writeInst(frostRingMesh, fri, b.pos.x, F.heightAt(b.pos.x, b.pos.z) + 0.05, b.pos.z, { x: -0.7071, y: 0, z: 0, w: 0.7071 }, s, s, 1);
        fri++;
      }
    }
    frostRingMesh.count = fri; frostRingMesh.instanceMatrix.needsUpdate = true;
    for (const [id, g] of towerGroups) if (!live.has(id)) { scene.remove(g); towerGroups.delete(id); }

    // tracers
    let tri = 0;
    for (const p of world.projectiles) {
      if (tri >= 80) break;
      const L = Math.hypot(p.v.x, p.v.y, p.v.z) || 1;
      const sz = p.spec.tracerSize || 1;
      dummy.position.set(p.pos.x, p.pos.y, p.pos.z);
      dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(p.v.x / L, p.v.y / L, p.v.z / L));
      dummy.scale.set(sz, sz, sz); dummy.updateMatrix();
      tracerMesh.setMatrixAt(tri, dummy.matrix);
      dummy.scale.set(sz * 2.4, sz * 2.4, sz * 1.35); dummy.updateMatrix();
      glowMesh.setMatrixAt(tri, dummy.matrix);
      _col.setHex(p.spec.tracerCol || 0xff8833);
      tracerMesh.setColorAt(tri, _col); glowMesh.setColorAt(tri, _col);
      tri++;
      if (sz > 1.2 && p.life > 0.05 && smoke.length < 110) smoke.push({ x: p.pos.x + (Math.random() - 0.5) * 0.3, y: p.pos.y, z: p.pos.z + (Math.random() - 0.5) * 0.3, vy: 0.4, s: 0.28 + sz * 0.14, life: 0.45, age: 0 });
    }
    tracerMesh.count = tri; tracerMesh.instanceMatrix.needsUpdate = true;
    if (tracerMesh.instanceColor) tracerMesh.instanceColor.needsUpdate = true;
    glowMesh.count = tri; glowMesh.instanceMatrix.needsUpdate = true;
    if (glowMesh.instanceColor) glowMesh.instanceColor.needsUpdate = true;

    // particles
    let di = 0;
    for (let i = debris.length - 1; i >= 0; i--) {
      const p = debris[i]; p.life -= dt; p.vy -= 9.8 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.rot += p.spin * dt;
      const h2 = F.heightAt(p.x, p.z);
      if (p.y < h2 + 0.09) { p.y = h2 + 0.09; p.vy *= -0.3; p.vx *= 0.6; p.vz *= 0.6; }
      if (p.life <= 0) { debris.splice(i, 1); continue; }
      const s = Math.min(1, p.life * 2);
      dummy.position.set(p.x, p.y, p.z); dummy.quaternion.setFromEuler(new THREE.Euler(p.rot, p.rot * 0.7, 0));
      dummy.scale.set(s, s, s); dummy.updateMatrix();
      if (di < 180) debrisMesh.setMatrixAt(di++, dummy.matrix);
    }
    debrisMesh.count = di; debrisMesh.instanceMatrix.needsUpdate = true;
    let si = 0;
    for (let i = smoke.length - 1; i >= 0; i--) {
      const p = smoke[i]; p.age += dt; p.y += p.vy * dt;
      if (p.age >= p.life) { smoke.splice(i, 1); continue; }
      const t2 = p.age / p.life, s = p.s * (0.6 + t2 * 1.9);
      dummy.position.set(p.x, p.y, p.z); dummy.quaternion.copy(camQ);
      dummy.scale.set(s, s, 1); dummy.updateMatrix();
      if (si < 120) smokeMesh.setMatrixAt(si++, dummy.matrix);
    }
    smokeMesh.count = si; smokeMesh.instanceMatrix.needsUpdate = true;
    let fi = 0;
    for (let i = fire.length - 1; i >= 0; i--) {
      const p = fire[i]; p.age += dt;
      if (p.age >= p.life) { fire.splice(i, 1); continue; }
      const t2 = 1 - p.age / p.life, s = p.s * (0.7 + t2);
      dummy.position.set(p.x, p.y, p.z); dummy.quaternion.copy(camQ);
      dummy.scale.set(s, s, 1); dummy.updateMatrix();
      if (fi < 96) fireMesh.setMatrixAt(fi++, dummy.matrix);
    }
    fireMesh.count = fi; fireMesh.instanceMatrix.needsUpdate = true;
    let cri = 0;
    for (let i = core.length - 1; i >= 0; i--) {
      const p = core[i]; p.age += dt;
      if (p.age >= p.life) { core.splice(i, 1); continue; }
      const t2 = 1 - p.age / p.life, s = p.s * (0.5 + t2 * 0.9);
      dummy.position.set(p.x, p.y, p.z); dummy.quaternion.copy(camQ);
      dummy.scale.set(s, s, 1); dummy.updateMatrix();
      if (cri < 64) coreMesh.setMatrixAt(cri++, dummy.matrix);
    }
    coreMesh.count = cri; coreMesh.instanceMatrix.needsUpdate = true;
    let shi = 0;
    for (let i = shock.length - 1; i >= 0; i--) {
      const p = shock[i]; p.age += dt;
      if (p.age >= p.life) { shock.splice(i, 1); continue; }
      const t2 = p.age / p.life, s = p.r * (0.4 + t2 * 1.5);
      dummy.position.set(p.x, F.heightAt(p.x, p.z) + 0.12, p.z);
      dummy.quaternion.set(-0.7071, 0, 0, 0.7071);
      dummy.scale.set(s, s, 1); dummy.updateMatrix();
      if (shi < 24) ringMesh.setMatrixAt(shi++, dummy.matrix);
    }
    ringMesh.count = shi; ringMesh.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < flakes.length; i++) {
      const fk = flakes[i];
      fk.y -= fk.vy * dt; fk.x += Math.sin(fk.ph + fk.y * 0.4) * 0.35 * dt;
      if (fk.y < 0) { fk.y += 36; fk.x = (Math.random() - 0.5) * 70; fk.z = (Math.random() - 0.5) * 70; }
      writeInst(flakeMesh, i, focus.x + fk.x, focus.y + fk.y - 4, focus.z + fk.z, camQ, 1, 1, 1);
    }
    flakeMesh.count = flakes.length; flakeMesh.instanceMatrix.needsUpdate = true;

    // camera
    const texel = (2 * halfW) / rtW;
    const desired = { x: focus.x + back.x * camDist, y: focus.y + back.y * camDist, z: focus.z + back.z * camDist };
    const sr = snapCam(desired, R3(camRight), R3(camUp), camFwd, texel);
    cam.position.set(sr.pos.x, sr.pos.y, sr.pos.z); cam.quaternion.copy(camQ);
    postMat.uniforms.uShift.value.set(-sr.errX, -sr.errY);
    sun.position.set(focus.x + 36, focus.y + 54, focus.z + 24);
    sun.target.position.set(focus.x, focus.y, focus.z);
    cam.layers.enable(1);
    renderer.setRenderTarget(rtColor); renderer.render(scene, cam);
    cam.layers.set(0); scene.overrideMaterial = normMat;
    const bg = scene.background; scene.background = NORM_BG;
    renderer.setRenderTarget(rtNormal); renderer.render(scene, cam);
    scene.overrideMaterial = null; scene.background = bg; cam.layers.enable(1);
    renderer.setRenderTarget(null); renderer.render(postScene, postCam);
  }
  function consume(events) {
    for (const e of events) {
      if (e.type === "boom") spawnBoom(e.x, e.y, e.z, e.r);
      else if (e.type === "splat") { if (scorchDecal) scorchDecal(e.x, e.z, e.r); }
      else if (e.type === "weldbreak") { for (let i = 0; i < 3; i++) debris.push({ x: e.x, y: e.y, z: e.z, vx: (Math.random() - 0.5) * 3, vy: 1 + Math.random() * 3, vz: (Math.random() - 0.5) * 3, rot: 0, spin: (Math.random() - 0.5) * 8, life: 0.8 }); }
      else if (e.type === "collapse") { spawnBoom(e.x, e.y, e.z, 2.6); for (let i = 0; i < 10; i++) smoke.push({ x: e.x + (Math.random() - 0.5) * 3, y: e.y, z: e.z + (Math.random() - 0.5) * 3, vy: 1.4, s: 1.4, life: 1.6, age: 0 }); }
      else if (e.type === "muzzle") {
        fire.push({ x: e.x, y: e.y, z: e.z, s: 1.0, life: 0.1, age: 0 });
        core.push({ x: e.x, y: e.y + 0.08, z: e.z, s: 0.55, life: 0.07, age: 0 });
      } else if (e.type === "leak") {
        for (let i = 0; i < 5; i++) smoke.push({ x: e.x + (Math.random() - 0.5) * 2, y: e.y + 1, z: e.z + (Math.random() - 0.5) * 2, vy: 2.2, s: 1.2, life: 0.9, age: 0 });
      }
    }
  }
  resize(); rebuildRTs();
  return {
    render, consume, setZoom, setGfx,
    dispose() { renderer.dispose(); },
    _cam: cam, camBasis: { right: camRight, up: camUp, fwd: camFwd, halfW: () => halfW, halfH: () => halfH },
  };
}

// ============================================================== component
function detectTouch() {
  return (typeof window !== "undefined") && ("ontouchstart" in window || (navigator.maxTouchPoints || 0) > 0);
}
const P = {
  root: { position: "fixed", inset: 0, background: "#0e1218", overflow: "hidden", fontFamily: "ui-monospace, Menlo, Consolas, monospace", color: "#e6ebf1", userSelect: "none", WebkitUserSelect: "none", touchAction: "none" },
  cv: { position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" },
  top: { position: "absolute", top: 0, left: 0, right: 0, display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "linear-gradient(rgba(10,13,18,0.88), rgba(10,13,18,0))", zIndex: 4, fontSize: 12, flexWrap: "wrap" },
  panel: { position: "absolute", background: "rgba(14,18,24,0.88)", border: "1px solid #48515f", borderRadius: 8, padding: 10, fontSize: 12, zIndex: 5 },
  btn: { background: "#1a212b", border: "1px solid #48515f", color: "#e6ebf1", borderRadius: 6, padding: "4px 10px", fontFamily: "inherit", fontSize: 12, cursor: "pointer" },
  stat: { display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", background: "rgba(20,26,34,0.75)", border: "1px solid #303a48", borderRadius: 6 },
  bar: { position: "absolute", left: 0, right: 0, bottom: 0, display: "flex", gap: 6, padding: "8px 8px calc(8px + env(safe-area-inset-bottom, 0px))", justifyContent: "center", background: "linear-gradient(rgba(10,13,18,0), rgba(10,13,18,0.9))", zIndex: 4, flexWrap: "wrap" },
  slot: { display: "flex", flexDirection: "column", alignItems: "center", gap: 2, minWidth: 52, padding: "6px 6px", background: "#1a212b", border: "1px solid #48515f", borderRadius: 8, fontSize: 11, cursor: "pointer" },
  ovl: { position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(10,13,18,0.72)", zIndex: 8, textAlign: "center", padding: 20 },
  toastWrap: { position: "absolute", top: 54, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, zIndex: 6, pointerEvents: "none" },
  toast: { background: "rgba(14,18,24,0.92)", border: "1px solid #ffb45e", color: "#ffd9a0", borderRadius: 6, padding: "4px 12px", fontSize: 12 },
};

export default function ColdsnapTD() {
  const canvasRef = useRef(null);
  const stateRef = useRef(null);
  const [isTouch] = useState(detectTouch);
  const HUD0 = { fps: 0, wave: 1, lives: 20, enemies: 0, resources: 120, walls: 0, towers: 0, kills: 0, totalWaves: WAVES.length, between: true, countdown: 8, started: false, gameOver: false, victory: false, mode: "wall", sellMode: false, paused: false, speed: 1, inspect: null, toasts: [] };
  const [hud, setHud] = useState(HUD0);
  const [fatal, setFatal] = useState(null);
  const [runId, setRunId] = useState(0);
  const restart = () => { setFatal(null); setHud({ ...HUD0 }); setRunId((r) => r + 1); };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let raf = 0, disposed = false;
    let R = null;
    try {
      // ---- world
      const field = makeField(121, 2.0);
      buildTerrain(field);
      const grid = makeGrid(field);
      const world = makeWorld(field);
      const town = buildTown(world, grid, field);
      world.town = town;
      const objG = grid.worldToGrid(OBJ_POS.x, OBJ_POS.z);
      computeFlowField(grid, objG.gx, objG.gz);
      R = makeRenderer(canvas, world, grid);

      // ---- mutable game state: everything the loop touches lives here, not
      // in React state, so the closure can never go stale
      const S = {
        resources: 120, lives: 20, kills: 0,
        ws: makeWaveState(), spawnRR: 0,
        mode: "wall", sellMode: false, inspectId: null,
        started: false, gameOver: false, victory: false,
        paused: false, speed: 1,
        focus: { x: 0, y: field.heightAt(0, 6), z: 6 },
        zoom: 1, acc: 0, t: 0, fps: 60, fpsAcc: 0, fpsN: 0,
        hover: null, pointer: null, toasts: [],
        hudT: 0, keys: {}, sellById: null,
      };
      stateRef.current = S;

      const toast = (txt) => { S.toasts.push({ txt, t: performance.now() / 1000 }); if (S.toasts.length > 4) S.toasts.shift(); };

      // ---- build / sell
      const recomputeFlow = () => computeFlowField(grid, objG.gx, objG.gz);
      const buildAt = (gx, gz, mode) => {
        if (!grid.inBounds(gx, gz)) return;
        const cell = grid.cells[grid.idx(gx, gz)];
        if (cell.blocked || cell.wallId) { toast("OCCUPIED"); return; }
        if (cell.ice) { toast("NO GROUND — frozen water"); return; }
        const spec = mode === "wall" ? null : TOWER_SPECS[mode];
        const cost = spec ? spec.cost : 5;
        if (S.resources < cost) { toast("NO SCRAP"); return; }
        cell.blocked = true;
        if (!checkConnectivity(grid, SPAWN_POINTS, objG.gx, objG.gz)) {
          cell.blocked = false;
          toast("Leave them a road");
          return;
        }
        const wp = grid.gridToWorld(gx, gz);
        const y = field.heightAt(wp.x, wp.z);
        let b;
        if (spec) {
          b = addBody(world, { kind: "tower", team: 1, mass: 0, hx: 0.8, hy: spec.hy, hz: 0.8, x: wp.x, y: y + spec.hy, z: wp.z, hp: spec.hp });
          b.towerType = mode;
        } else {
          b = addBody(world, { kind: "wall", team: 1, mass: 0, hx: 0.9, hy: 0.9, hz: 0.9, x: wp.x, y: y + 0.9, z: wp.z, hp: 70 });
        }
        cell.wallId = b.id;
        S.resources -= cost;
        recomputeFlow();
      };
      const sellAt = (gx, gz) => {
        if (!grid.inBounds(gx, gz)) return;
        const cell = grid.cells[grid.idx(gx, gz)];
        const id = cell.wallId;
        if (!id || !world.byId.has(id)) { toast("NOTHING HERE"); return; }
        const b = world.byId.get(id);
        const refund = b.kind === "tower" ? Math.floor(TOWER_SPECS[b.towerType].cost * 0.6) : 3;
        world.byId.delete(id);
        const bi = world.bodies.indexOf(b);
        if (bi >= 0) world.bodies.splice(bi, 1);
        cell.wallId = null; cell.blocked = false;
        S.resources += refund;
        recomputeFlow();
        toast("+" + refund + " scrap");
      };
      const sellById = (id) => {
        const b = world.byId.get(id);
        if (!b) return;
        const g = grid.worldToGrid(b.pos.x, b.pos.z);
        sellAt(g.gx, g.gz);
        S.inspectId = null;
      };
      S.sellById = sellById;
      const onStructureLost = (b) => {
        for (const c of grid.cells) if (c.wallId === b.id) { c.wallId = null; c.blocked = false; }
        recomputeFlow();
      };
      const onRuin = () => recomputeFlow();

      // ---- picking: NDC -> ortho ray -> march the heightfield
      const toNdc = (cx, cy) => {
        const r = canvas.getBoundingClientRect();
        return { x: ((cx - r.left) / Math.max(1, r.width)) * 2 - 1, y: -(((cy - r.top) / Math.max(1, r.height)) * 2 - 1) };
      };
      const groundPoint = (cx, cy) => {
        const nd = toNdc(cx, cy);
        const cb = R.camBasis, cam = R._cam;
        const hw = cb.halfW(), hh = cb.halfH();
        const ox = cam.position.x + cb.right.x * nd.x * hw + cb.up.x * nd.y * hh;
        const oy = cam.position.y + cb.right.y * nd.x * hw + cb.up.y * nd.y * hh;
        const oz = cam.position.z + cb.right.z * nd.x * hw + cb.up.z * nd.y * hh;
        const f = cb.fwd;
        let lo = 0, hi = 400, py = 0;
        // coarse march then bisect the crossing
        let prev = 0, found = -1;
        for (let t = 0; t <= 400; t += 1.5) {
          const x = ox + f.x * t, y2 = oy + f.y * t, z = oz + f.z * t;
          if (y2 <= field.heightAt(x, z)) { found = t; lo = prev; hi = t; break; }
          prev = t;
        }
        if (found < 0) return null;
        for (let i = 0; i < 12; i++) {
          const mid = (lo + hi) / 2;
          const x = ox + f.x * mid, y2 = oy + f.y * mid, z = oz + f.z * mid;
          if (y2 <= field.heightAt(x, z)) hi = mid; else lo = mid;
        }
        const t = (lo + hi) / 2;
        return { x: ox + f.x * t, z: oz + f.z * t };
      };
      const tapAt = (cx, cy) => {
        if (!S.started || S.gameOver || S.victory) return;
        const p = groundPoint(cx, cy);
        if (!p) { S.inspectId = null; return; }
        const g = grid.worldToGrid(p.x, p.z);
        if (!grid.inBounds(g.gx, g.gz)) { S.inspectId = null; return; }
        const cell2 = grid.cells[grid.idx(g.gx, g.gz)];
        if (S.sellMode) { S.inspectId = null; sellAt(g.gx, g.gz); }
        else if (cell2.wallId && world.byId.has(cell2.wallId)) S.inspectId = cell2.wallId;
        else { S.inspectId = null; buildAt(g.gx, g.gz, S.mode); }
      };

      // ---- input: pointer events cover mouse and touch alike
      const pointers = new Map();
      let pinchD0 = 0, pinchZ0 = 1, dragTotal = 0, downPt = null;
      const onPointerDown = (e) => {
        canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.size === 1) { dragTotal = 0; downPt = { x: e.clientX, y: e.clientY }; }
        else if (pointers.size === 2) {
          const ps = [...pointers.values()];
          pinchD0 = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y);
          pinchZ0 = S.zoom;
          downPt = null;
        }
      };
      const onPointerMove = (e) => {
        S.pointer = { x: e.clientX, y: e.clientY };
        const pt = pointers.get(e.pointerId);
        if (!pt) return;
        const dx = e.clientX - pt.x, dy = e.clientY - pt.y;
        pt.x = e.clientX; pt.y = e.clientY;
        if (pointers.size === 1) {
          dragTotal += Math.hypot(dx, dy);
          if (dragTotal > 12) {
            // pan: screen pixels -> world via the ortho frustum extents
            const cb = R.camBasis;
            const r = canvas.getBoundingClientRect();
            const kx = (2 * cb.halfW()) / Math.max(1, r.width);
            const ky = (2 * cb.halfH()) / Math.max(1, r.height);
            S.focus.x -= cb.right.x * dx * kx - cb.up.x * dy * ky;
            S.focus.z -= cb.right.z * dx * kx - cb.up.z * dy * ky;
            S.focus.x = Math.max(-75, Math.min(75, S.focus.x));
            S.focus.z = Math.max(-75, Math.min(75, S.focus.z));
          }
        } else if (pointers.size === 2 && pinchD0 > 0) {
          const ps = [...pointers.values()];
          const d = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y);
          S.zoom = Math.max(0.5, Math.min(2.6, pinchZ0 * (d / pinchD0)));
          R.setZoom(S.zoom);
        }
      };
      const onPointerUp = (e) => {
        pointers.delete(e.pointerId);
        if (downPt && dragTotal <= 12 && pointers.size === 0) tapAt(e.clientX, e.clientY);
        if (pointers.size < 2) pinchD0 = 0;
        if (pointers.size === 0) downPt = null;
      };
      const onWheel = (e) => {
        e.preventDefault();
        S.zoom = Math.max(0.5, Math.min(2.6, S.zoom * (e.deltaY > 0 ? 0.9 : 1.11)));
        R.setZoom(S.zoom);
      };
      const onKey = (e, down) => { S.keys[e.key.toLowerCase()] = down; };
      const kd = (e) => onKey(e, true), ku = (e) => onKey(e, false);
      const blockTouch = (e) => e.preventDefault();
      canvas.addEventListener("pointerdown", onPointerDown);
      canvas.addEventListener("pointermove", onPointerMove);
      canvas.addEventListener("pointerup", onPointerUp);
      canvas.addEventListener("pointercancel", onPointerUp);
      canvas.addEventListener("wheel", onWheel, { passive: false });
      canvas.addEventListener("touchstart", blockTouch, { passive: false });
      window.addEventListener("keydown", kd);
      window.addEventListener("keyup", ku);

      // ---- wave machine
      const startWave = () => {
        const ws = S.ws;
        const w = WAVES[ws.waveIdx];
        ws.spawnQueue = w.units; ws.spawnDelay = w.delay; ws.spawnTimer = 0;
        ws.betweenWaves = false; ws.active = true;
        ws.mixBag = [];
        if (w.mix) {
          for (const m of w.mix) for (let i = 0; i < m[1]; i++) ws.mixBag.push(m[0]);
          // stride shuffle so types interleave rather than clump
          const bag = ws.mixBag, out = [];
          let i = 0;
          while (bag.length) { i = (i + 7) % bag.length; out.push(bag.splice(i, 1)[0]); }
          ws.mixBag = out;
        }
        toast("WAVE " + (ws.waveIdx + 1));
      };
      const spawnOne = () => {
        const ws = S.ws;
        const tag = ws.mixBag.length ? ws.mixBag.pop() : "";
        const sp = SPAWN_POINTS[S.spawnRR++ % SPAWN_POINTS.length];
        spawnEnemy(world, sp, tag);
        ws.spawnQueue--;
      };
      const sendNow = () => { const ws = S.ws; if (S.started && ws.betweenWaves && !S.gameOver && !S.victory) { ws.countdown = 0; } };
      S.sendNow = sendNow;

      // ---- debug harness
      window.__TD__ = () => ({ t: world.t, scrap: S.resources, lives: S.lives, kills: S.kills, wave: S.ws.waveIdx + 1, bodies: world.bodies.length, fps: S.fps, paused: S.paused, speed: S.speed });
      window.__TDBUILD__ = (gx, gz, mode) => buildAt(gx, gz, mode || "wall");
      window.__TDSPAWN__ = (n, tag) => { for (let i = 0; i < (n || 1); i++) spawnEnemy(world, SPAWN_POINTS[S.spawnRR++ % SPAWN_POINTS.length], tag || ""); };
      window.__TDSIM__ = (sec) => { const n = Math.round((sec || 1) * 120); world.events.length = 0; for (let i = 0; i < n; i++) stepWorld(world, grid, onStructureLost, town, onRuin); const evs = world.events.slice(); world.events.length = 0; for (const e of evs) { if (e.type === "kill") { S.resources += e.bounty; S.kills++; } else if (e.type === "leak") { S.lives -= e.dmg; if (S.lives <= 0) { S.lives = 0; S.gameOver = true; } } } };
      window.__TDUNITS__ = () => world.bodies.filter((b) => b.kind === "unit" && b.alive).map((b) => ({ x: +b.pos.x.toFixed(1), z: +b.pos.z.toFixed(1), up: +b.R[4].toFixed(2), tag: b.tag, v: +Math.hypot(b.v.x, b.v.z).toFixed(2) }));
      window.__TDGFX__ = (p) => R.setGfx(p);
      window.__TDWRECK__ = (x, z, big) => explode(world, x, field.heightAt(x, z) + 0.5, z, { r: big ? 4.2 : 3.0, kv: big ? 11 : 8, dmg: big ? 45 : 30, crater: big ? 0.9 : 0.6, hitWalls: true });
      window.__TDPROJ__ = () => world.projectiles.map((p) => ({ x: p.pos.x, y: p.pos.y, z: p.pos.z, vx: p.v.x, vy: p.v.y, vz: p.v.z, gy: field.heightAt(p.pos.x, p.pos.z) }));
      window.__TDSTART__ = () => { S.started = true; };

      // ---- main loop
      let last = performance.now();
      const STEP = 1 / 120;
      const frame = (now) => {
        if (disposed) return;
        raf = requestAnimationFrame(frame);
        let dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        try {
          // fps
          S.fpsAcc += dt; S.fpsN++;
          if (S.fpsAcc > 0.5) { S.fps = Math.round(S.fpsN / S.fpsAcc); S.fpsAcc = 0; S.fpsN = 0; }
          // sim time: zero while paused / on the title / after the end
          const sdt = S.paused || !S.started || S.gameOver || S.victory ? 0 : dt * S.speed;
          // keyboard pan (desktop nicety; touch pans by drag)
          const pan = 34 * dt / Math.max(0.5, S.zoom);
          if (S.keys.w || S.keys.arrowup) S.focus.z += pan;
          if (S.keys.s || S.keys.arrowdown) S.focus.z -= pan;
          if (S.keys.a || S.keys.arrowleft) S.focus.x -= pan * 0.8;
          if (S.keys.d || S.keys.arrowright) S.focus.x += pan * 0.8;
          S.focus.x = Math.max(-75, Math.min(75, S.focus.x));
          S.focus.z = Math.max(-75, Math.min(75, S.focus.z));
          S.focus.y = field.heightAt(S.focus.x, S.focus.z);
          // hover preview (mouse only — a finger is not hovering)
          if (!isTouch && S.pointer && S.started && !S.gameOver && !S.victory) {
            const p = groundPoint(S.pointer.x, S.pointer.y);
            if (p) {
              const g = grid.worldToGrid(p.x, p.z);
              if (grid.inBounds(g.gx, g.gz)) {
                const cell = grid.cells[grid.idx(g.gx, g.gz)];
                const wp = grid.gridToWorld(g.gx, g.gz);
                const spec = S.mode === "wall" ? null : TOWER_SPECS[S.mode];
                S.hover = { x: wp.x, z: wp.z, valid: !cell.blocked && !cell.wallId && !cell.ice, range: spec ? spec.range : 0 };
              } else S.hover = null;
            } else S.hover = null;
          } else S.hover = null;
          // inspect overrides hover: park the ghost ring on the inspected structure
          if (S.inspectId) {
            const ib = world.byId.get(S.inspectId);
            if (!ib) S.inspectId = null;
            else {
              const ispec = ib.kind === "tower" ? TOWER_SPECS[ib.towerType] : null;
              S.hover = { x: ib.pos.x, z: ib.pos.z, valid: true, range: ispec ? ispec.range : 0 };
            }
          }
          // wave machine
          const ws = S.ws;
          if (S.started && !S.gameOver && !S.victory) {
            if (ws.betweenWaves) {
              ws.countdown -= sdt;
              if (ws.countdown <= 0 && ws.waveIdx < WAVES.length) startWave();
            } else {
              if (ws.spawnQueue > 0) {
                ws.spawnTimer -= sdt;
                if (ws.spawnTimer <= 0) { ws.spawnTimer = ws.spawnDelay; spawnOne(); }
              } else {
                let live = 0;
                for (const b of world.bodies) if (b.kind === "unit" && b.alive && b.team === 2) live++;
                if (live === 0) {
                  ws.waveIdx++;
                  if (ws.waveIdx >= WAVES.length) { S.victory = true; toast("THE DEPOT HOLDS"); }
                  else { ws.betweenWaves = true; ws.countdown = 8; S.resources += 12; toast("WAVE CLEAR +12"); }
                }
              }
            }
            if (S.started && !S.gameOver && !S.victory) S.resources += 2.2 * sdt;
          }
          // physics: fixed substeps; events accumulate across them and are
          // drained once per frame — never cleared mid-step
          S.acc += sdt;
          world.events.length = 0;
          let guard = 0;
          while (S.acc >= STEP && guard++ < 6) {
            S.acc -= STEP;
            stepWorld(world, grid, onStructureLost, town, onRuin);
          }
          if (S.acc > STEP * 6) S.acc = 0;   // clamp, don't spiral
          const evs = world.events.slice();
          world.events.length = 0;
          for (const e of evs) {
            if (e.type === "kill") { S.resources += e.bounty; S.kills++; }
            else if (e.type === "leak") {
              S.lives -= e.dmg;
              toast("LEAK — " + (e.dmg > 1 ? "-" + e.dmg + " lives" : "-1 life"));
              if (S.lives <= 0) { S.lives = 0; S.gameOver = true; }
            }
          }
          R.consume(evs);
          R.render(dt, S.focus, S.hover);
          // throttled HUD sync
          S.hudT += dt;
          if (S.hudT > 0.12) {
            S.hudT = 0;
            let en = 0, nw = 0, nt = 0;
            for (const b of world.bodies) {
              if (b.kind === "unit" && b.alive && b.team === 2) en++;
              else if (b.kind === "wall") nw++;
              else if (b.kind === "tower") nt++;
            }
            const nowS = performance.now() / 1000;
            S.toasts = S.toasts.filter((t) => nowS - t.t < 2.2);
            setHud({
              fps: S.fps, wave: Math.min(WAVES.length, S.ws.waveIdx + 1), lives: S.lives, enemies: en,
              resources: Math.floor(S.resources), walls: nw, towers: nt, kills: S.kills,
              totalWaves: WAVES.length, between: S.ws.betweenWaves, countdown: Math.max(0, Math.ceil(S.ws.countdown)),
              started: S.started, gameOver: S.gameOver, victory: S.victory,
              mode: S.mode, sellMode: S.sellMode,
              paused: S.paused, speed: S.speed,
              toasts: S.toasts.map((t) => t.txt),
              inspect: (() => {
                if (!S.inspectId) return null;
                const b = world.byId.get(S.inspectId);
                if (!b) return null;
                const ispec = b.kind === "tower" ? TOWER_SPECS[b.towerType] : null;
                return {
                  id: b.id,
                  label: ispec ? ispec.label : "WALL",
                  hp: Math.max(0, Math.ceil(b.hp)), maxHp: b.maxHp,
                  refund: b.kind === "tower" ? Math.floor(ispec.cost * 0.6) : 3,
                  blurb: ispec ? ispec.blurb : "Bends their road.",
                };
              })(),
            });
          }
        } catch (err) {
          console.error("COLDSNAP TD frame failed", err);
          setFatal(String(err && err.message ? err.message : err));
          disposed = true;
        }
      };
      raf = requestAnimationFrame(frame);

      return () => {
        disposed = true;
        cancelAnimationFrame(raf);
        canvas.removeEventListener("pointerdown", onPointerDown);
        canvas.removeEventListener("pointermove", onPointerMove);
        canvas.removeEventListener("pointerup", onPointerUp);
        canvas.removeEventListener("pointercancel", onPointerUp);
        canvas.removeEventListener("wheel", onWheel);
        canvas.removeEventListener("touchstart", blockTouch);
        window.removeEventListener("keydown", kd);
        window.removeEventListener("keyup", ku);
        for (const k of ["__TD__", "__TDBUILD__", "__TDSPAWN__", "__TDSIM__", "__TDGFX__", "__TDWRECK__", "__TDPROJ__", "__TDUNITS__", "__TDSTART__"]) delete window[k];
        if (R) R.dispose();
        stateRef.current = null;
      };
    } catch (err) {
      console.error("COLDSNAP TD boot failed", err);
      setFatal(String(err && err.message ? err.message : err));
      if (R) R.dispose();
    }
  }, [isTouch, runId]);

  const setMode = (m) => {
    const S = stateRef.current; if (!S) return;
    S.mode = m; S.sellMode = false; S.inspectId = null;
    setHud((h) => ({ ...h, mode: m, sellMode: false }));
  };
  const toggleSell = () => {
    const S = stateRef.current; if (!S) return;
    S.sellMode = !S.sellMode; S.inspectId = null;
    setHud((h) => ({ ...h, sellMode: S.sellMode }));
  };
  const startGame = () => {
    const S = stateRef.current; if (!S) return;
    S.started = true;
    setHud((h) => ({ ...h, started: true }));
  };
  const sellInspected = () => { const S = stateRef.current; if (S && S.inspectId && S.sellById) S.sellById(S.inspectId); };

  const palette = [
    { key: "wall", label: "WALL", icon: "▦", cost: 5 },
    ...TOWER_ORDER.map((k) => ({ key: k, label: TOWER_SPECS[k].label, icon: TOWER_SPECS[k].icon, cost: TOWER_SPECS[k].cost })),
  ];

  return (
    <div style={P.root}>
      <canvas key={runId} ref={canvasRef} style={P.cv} />
      <div style={P.top}>
        <div style={P.stat}><span style={{ color: "#ffd27a" }}>◆</span>{hud.resources}</div>
        <div style={P.stat}><span style={{ color: "#ff7a7a" }}>♥</span>{hud.lives}</div>
        <div style={P.stat}>W {hud.wave}/{hud.totalWaves}</div>
        <div style={P.stat}>☠ {hud.enemies}</div>
        {hud.started && hud.between && !hud.gameOver && !hud.victory && (
          <button style={{ ...P.btn, borderColor: "#4aff8c", color: "#4aff8c", padding: isTouch ? "5px 10px" : "4px 10px" }} onClick={() => { const S = stateRef.current; if (S && S.sendNow) S.sendNow(); }}>
            SEND {hud.countdown}s
          </button>
        )}
        {hud.started && !hud.victory && !hud.gameOver && (
          <>
            <button style={{ ...P.btn, padding: isTouch ? "5px 10px" : "4px 10px", borderColor: hud.paused ? "#ffd27a" : "#48515f", color: hud.paused ? "#ffd27a" : "#e6ebf1" }}
              onClick={() => { const S = stateRef.current; if (S) { S.paused = !S.paused; setHud((h) => ({ ...h, paused: S.paused })); } }}>
              {hud.paused ? "▶" : "❚❚"}
            </button>
            <button style={{ ...P.btn, padding: isTouch ? "5px 10px" : "4px 10px", borderColor: hud.speed > 1 ? "#7fd7ff" : "#48515f" }}
              onClick={() => { const S = stateRef.current; if (S) { S.speed = S.speed > 1 ? 1 : 2; setHud((h) => ({ ...h, speed: S.speed })); } }}>
              {hud.speed > 1 ? "2×" : "1×"}
            </button>
          </>
        )}
        <div style={{ ...P.stat, marginLeft: "auto", opacity: 0.65 }}>{hud.fps} fps</div>
      </div>

      {hud.toasts && hud.toasts.length > 0 && (
        <div style={P.toastWrap}>
          {hud.toasts.map((t, i) => <div key={i} style={P.toast}>{t}</div>)}
        </div>
      )}

      {hud.inspect && (
        <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", bottom: isTouch ? 96 : 104, zIndex: 5 }}>
          <div style={{ ...P.panel, position: "static", borderColor: "#7fd7ff", display: "flex", alignItems: "center", gap: 10, padding: "6px 10px" }}>
            <div>
              <div style={{ color: "#7fd7ff", letterSpacing: 1 }}>{hud.inspect.label}</div>
              <div style={{ fontSize: 10, opacity: 0.8 }}>HP {hud.inspect.hp}/{hud.inspect.maxHp} · {hud.inspect.blurb}</div>
            </div>
            <button style={{ ...P.btn, borderColor: "#ffb45e", color: "#ffb45e" }} onClick={sellInspected}>
              SELL ◆{hud.inspect.refund}
            </button>
          </div>
        </div>
      )}

      {hud.started && !hud.gameOver && !hud.victory && (
        <div style={P.bar}>
          {palette.map((p) => {
            const sel = !hud.sellMode && hud.mode === p.key;
            const afford = hud.resources >= p.cost;
            return (
              <div key={p.key}
                style={{ ...P.slot, borderColor: sel ? "#4aff8c" : "#48515f", opacity: afford ? 1 : 0.45, minWidth: isTouch ? 56 : 52 }}
                onClick={() => setMode(p.key)}>
                <div style={{ fontSize: 16 }}>{p.icon}</div>
                <div>{p.label}</div>
                <div style={{ color: "#ffd27a" }}>◆{p.cost}</div>
              </div>
            );
          })}
          <div style={{ ...P.slot, borderColor: hud.sellMode ? "#ffb45e" : "#48515f", color: hud.sellMode ? "#ffb45e" : "#e6ebf1", minWidth: isTouch ? 56 : 52 }}
            onClick={toggleSell}>
            <div style={{ fontSize: 16 }}>✕</div>
            <div>SELL</div>
            <div style={{ opacity: 0.7 }}>60%</div>
          </div>
        </div>
      )}

      {!hud.started && !fatal && (
        <div style={P.ovl}>
          <div style={{ fontSize: 26, letterSpacing: 4, color: "#9fdcff" }}>COLDSNAP</div>
          <div style={{ fontSize: 13, letterSpacing: 8, color: "#ffd27a", marginBottom: 14 }}>TOWER DEFENSE</div>
          <div style={{ fontSize: 12, opacity: 0.85, maxWidth: 420, lineHeight: 1.6, marginBottom: 18 }}>
            They come out of the southern treeline for the depot. Wall their road, gun the choke points.
            Rock is free cover. The frozen ponds carry them faster — and you cannot build on ice.
            {isTouch ? " Drag to pan, pinch to zoom, tap to build. Tap a tower to inspect it." : " WASD pans, wheel zooms, click builds. Click a tower to inspect it."}
          </div>
          <button style={{ ...P.btn, fontSize: 15, padding: "10px 26px", borderColor: "#4aff8c", color: "#4aff8c" }} onClick={startGame}>
            DIG IN
          </button>
        </div>
      )}

      {(hud.gameOver || hud.victory) && !fatal && (
        <div style={P.ovl}>
          <div style={{ fontSize: 24, letterSpacing: 3, color: hud.victory ? "#4aff8c" : "#ff7a7a", marginBottom: 8 }}>
            {hud.victory ? "THE DEPOT HOLDS" : "THE DEPOT FALLS"}
          </div>
          <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 16 }}>
            {hud.kills} kills · wave {hud.wave}/{hud.totalWaves}
          </div>
          <button style={{ ...P.btn, fontSize: 14, padding: "9px 22px", borderColor: "#9fdcff", color: "#9fdcff" }} onClick={restart}>
            RUN IT AGAIN
          </button>
        </div>
      )}

      {fatal && (
        <div style={P.ovl}>
          <div style={{ fontSize: 18, color: "#ff7a7a", marginBottom: 10 }}>ENGINE FAULT</div>
          <div style={{ fontSize: 11, opacity: 0.8, maxWidth: 480, marginBottom: 16, wordBreak: "break-word" }}>{fatal}</div>
          <button style={{ ...P.btn, borderColor: "#9fdcff", color: "#9fdcff" }} onClick={restart}>RESTART</button>
        </div>
      )}
    </div>
  );
}
