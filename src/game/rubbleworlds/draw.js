// rubbleworlds/draw.js — the demo's whole drawn frame, carved from the
// component: the ark sky, the bent grid, the horizon, the cubes and their
// light, the projected orbits. drawFrame paints exactly what the loop
// painted; the loop keeps physics and hands over an env each frame.
import { SF, G, BS, C30, S30 } from "./phys.js";
function wellDepth(x, z, wells, sc) {
  let pP = 0, pD = 0;
  for (const w of wells) {
    const r2 = (w.x - x) ** 2 + (w.z - z) ** 2 + SF * SF;
    const p = G * w.m / (1.3 * Math.pow(r2, 0.65));
    if (w.deep) pD += p; else pP += p;
  }
  return Math.min(Math.sqrt(pP) * 0.38, 150) * sc + Math.min(Math.sqrt(pD) * 1.15, 560) * sc;
}

function drawFrame(env) {
  const { ctx, W, H, world, frame } = env;
  const wb = world.blocks;
      // --- DRAW ---
      ctx.fillStyle = "#f5f4f0"; ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 60; i++) { const sx3 = ((i * 7919 + 37) * 3.7) % W, sy3 = ((i * 4967 + 13) * 2.3) % H; ctx.fillStyle = `rgba(0,0,20,${i % 5 === 0 ? 0.06 : 0.03})`; ctx.fillRect(sx3, sy3, i % 7 === 0 ? 1.5 : 1, i % 7 === 0 ? 1.5 : 1); }
      // the camera is FIXED per scene: centered on the origin (the hole, the pair's
      // center, the planet) at a scale set by the scene's span — debris may leave
      // the frame; the world never swims and the hole never appears to move
      const span = world.span || 260;
      const sc = Math.min(W * 0.82 / (span * 2 * C30), H * 0.62 / (span * 2 * S30), 2.2);
      const cx = W / 2, cy = H / 2;
      const iso = (x, z, y) => ({ x: cx + (x - z) * C30 * sc, y: cy + (x + z) * S30 * sc - (y || 0) * 0.9 * sc });
      const lookX = 0, lookZ = 0;
      const gN = 56, gSp = 16, halfG = gN * gSp / 2;
      const gcx = Math.round(lookX / gSp) * gSp, gcz = Math.round(lookZ / gSp) * gSp;
      const getD = (sx2, sz2) => wellDepth(sx2, sz2, world.wells, sc);
      const gxa = new Float32Array((gN + 1) ** 2), gya = new Float32Array((gN + 1) ** 2);
      for (let ix = 0; ix <= gN; ix++) for (let iz = 0; iz <= gN; iz++) { const sx2 = ix * gSp - halfG + gcx, sz2 = iz * gSp - halfG + gcz, d = getD(sx2, sz2), idx = ix * (gN + 1) + iz; gxa[idx] = cx + (sx2 - sz2) * C30 * sc; gya[idx] = cy + (sx2 + sz2) * S30 * sc + d; }
      ctx.lineWidth = 0.7;
      for (let ix = 0; ix <= gN; ix++) { const sx2 = ix * gSp - halfG + gcx, fade = Math.max(0, 1 - (Math.abs(sx2 - gcx) / (halfG * 0.7)) ** 3);
        let w = 0; for (const wl of world.wells) { const pd = Math.abs(sx2 - wl.x); w = Math.max(w, Math.max(0, 1 - pd / 110) * 0.3); }
        const a = fade * 0.18 + w * 0.5; if (a < 0.005) continue;
        ctx.beginPath(); const b = ix * (gN + 1); ctx.moveTo(gxa[b], gya[b]); for (let iz = 1; iz <= gN; iz++) ctx.lineTo(gxa[b + iz], gya[b + iz]);
        ctx.strokeStyle = `rgba(45,55,75,${a})`; ctx.stroke(); }
      for (let iz = 0; iz <= gN; iz++) { const sz2 = iz * gSp - halfG + gcz, fade = Math.max(0, 1 - (Math.abs(sz2 - gcz) / (halfG * 0.7)) ** 3);
        let w = 0; for (const wl of world.wells) { const pd = Math.abs(sz2 - wl.z); w = Math.max(w, Math.max(0, 1 - pd / 110) * 0.3); }
        const a = fade * 0.18 + w * 0.5; if (a < 0.005) continue;
        ctx.beginPath(); ctx.moveTo(gxa[iz], gya[iz]); for (let ix = 1; ix <= gN; ix++) ctx.lineTo(gxa[ix * (gN + 1) + iz], gya[ix * (gN + 1) + iz]);
        ctx.strokeStyle = `rgba(45,55,75,${a})`; ctx.stroke(); }
      // --- PROJECTED ORBITS: each clump's future as a line, green while clear,
      // turning red through the last two seconds before a predicted contact and
      // ending at the impact — past first contact the future is unknowable.
      // A 20-second look: minutes would be honest for the stable orbits, but
      // chaos (the trio, anything post-collision) owns everything longer.
      if (frame % 3 === 0 || !world.pred) {
        const bodies = (world.tracks || []).filter(tk => tk.m >= 500).slice(0, 14)
          .map(tk => ({ x: tk.x, z: tk.z, vx: tk.vx, vz: tk.vz, m: tk.m, rad: tk.rad, clump: tk.clump, pts: [], hit: -1 }));
        const statics = [];
        if (world.hole) statics.push({ x: world.hole.x, z: world.hole.z, m: world.hole.m, rad: world.hole.killR });
        if (world.star) statics.push({ x: world.star.x, z: world.star.z, m: world.star.m, rad: world.star.r });
        const dtP = 1 / 15, NPRED = 300;
        for (let sIdx = 0; sIdx < NPRED; sIdx++) {
          for (const b of bodies) {
            if (b.hit >= 0) continue;
            let ax = 0, az = 0;
            for (const o of bodies) { if (o === b || o.hit >= 0) continue;
              const w = world.weak && o.clump !== b.clump ? 0.01 : 1;
              const dx = o.x - b.x, dz = o.z - b.z, r2 = dx * dx + dz * dz + SF * SF, rn = Math.pow(r2, 1.65);
              ax += w * G * o.m * dx / rn; az += w * G * o.m * dz / rn; }
            for (const o of statics) { const dx = o.x - b.x, dz = o.z - b.z, r2 = dx * dx + dz * dz + SF * SF, rn = Math.pow(r2, 1.65);
              ax += G * o.m * dx / rn; az += G * o.m * dz / rn; }
            b.vx += ax * dtP; b.vz += az * dtP;
          }
          for (const b of bodies) { if (b.hit >= 0) continue; b.x += b.vx * dtP; b.z += b.vz * dtP; b.pts.push([b.x, b.z]); }
          for (let a2 = 0; a2 < bodies.length; a2++) for (let b2 = a2 + 1; b2 < bodies.length; b2++) {
            const A = bodies[a2], B2 = bodies[b2]; if (A.hit >= 0 || B2.hit >= 0) continue;
            if (Math.hypot(A.x - B2.x, A.z - B2.z) < A.rad + B2.rad) { A.hit = A.pts.length; B2.hit = B2.pts.length; } }
          for (const b of bodies) { if (b.hit >= 0) continue;
            for (const o of statics) if (Math.hypot(b.x - o.x, b.z - o.z) < b.rad + o.rad) b.hit = b.pts.length; }
        }
        world.pred = bodies;
      }
      for (const b of world.pred || []) {
        const pts = b.pts; if (pts.length < 4) continue;
        const redFrom = b.hit >= 0 ? Math.max(0, b.hit - 30) : pts.length + 1;
        ctx.lineWidth = 2.2;
        for (let i2 = 3; i2 < pts.length; i2 += 3) {
          const p0 = iso(pts[i2 - 3][0], pts[i2 - 3][1], 0), p1 = iso(pts[i2][0], pts[i2][1], 0);
          const fade = Math.max(0.25, 1 - i2 / pts.length);
          ctx.strokeStyle = i2 >= redFrom ? `rgba(220,55,35,${fade * 0.95})` : `rgba(40,170,90,${fade * 0.85})`;
          ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
        }
      }
      if (world.star) {
        const sp = iso(world.star.x, world.star.z, 0), sR = Math.max(world.star.r * sc, 8);
        ctx.save();
        const cg = ctx.createRadialGradient(sp.x, sp.y, sR * 0.5, sp.x, sp.y, sR * 3);
        cg.addColorStop(0, "rgba(255,220,100,.25)"); cg.addColorStop(0.3, "rgba(255,180,60,.08)"); cg.addColorStop(1, "rgba(255,140,30,0)");
        ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(sp.x, sp.y, sR * 3, 0, Math.PI * 2); ctx.fill();
        ctx.shadowColor = "rgba(255,200,80,.8)"; ctx.shadowBlur = 30;
        const sg = ctx.createRadialGradient(sp.x - sR * 0.2, sp.y - sR * 0.2, sR * 0.1, sp.x, sp.y, sR);
        sg.addColorStop(0, "rgba(255,255,230,1)"); sg.addColorStop(0.4, "rgba(255,220,120,1)"); sg.addColorStop(1, "rgba(255,160,40,1)");
        ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sp.x, sp.y, sR, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      if (world.hole) {
        const hp = iso(world.hole.x, world.hole.z, 0), hr = Math.max(world.hole.killR * sc, 6);
        const g2 = ctx.createRadialGradient(hp.x, hp.y, hr * 0.6, hp.x, hp.y, hr * 2.6);
        g2.addColorStop(0, "rgba(24,18,34,.9)"); g2.addColorStop(0.42, "rgba(90,60,130,.22)"); g2.addColorStop(1, "rgba(90,60,130,0)");
        ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(hp.x, hp.y, hr * 2.6, 0, Math.PI * 2); ctx.fill();
        ctx.save(); ctx.shadowColor = "rgba(255,180,80,.7)"; ctx.shadowBlur = 14;
        ctx.beginPath(); ctx.arc(hp.x, hp.y, hr * 1.04, 0, Math.PI * 2); ctx.strokeStyle = "rgba(255,190,110,.55)"; ctx.lineWidth = 1.6; ctx.stroke(); ctx.restore();
        ctx.fillStyle = "#0c0a14"; ctx.beginPath(); ctx.arc(hp.x, hp.y, hr, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(hp.x, hp.y, hr * 1.5, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(120,80,180,.3)"; ctx.lineWidth = 1; ctx.setLineDash([4, 5]); ctx.stroke(); ctx.setLineDash([]);
      }
      // blocks as coldsnap cubes lit by their outward face — the sun sits up-left
      const tints = [[126, 148, 196], [188, 134, 92]];
      const LX = -0.55, LY = 0.72, LZ = -0.42; // unit-ish light direction, toward the sun
      const order = [];
      for (const b of wb) if (b.alive) order.push(b);
      order.sort((a, b) => (a.x + a.z) - (b.x + b.z) || a.y - b.y);
      // cubes at FULL lattice pitch — faces touch, the ball reads solid; each
      // block carries its own pitch, so big worlds draw big cubes
      const shade = (rgb, f) => `rgb(${Math.round(rgb[0] * f)},${Math.round(rgb[1] * f)},${Math.round(rgb[2] * f)})`;
      for (const b of order) {
        const hw = Math.max(b.s * sc * C30, 1.6), hh = Math.max(b.s * sc * S30, 0.9), vh = Math.max(b.s * sc * 0.9, 1.6);
        const cc = world.clumpCenter && world.clumpCenter.get(b.clump);
        let lam = 0.55;
        if (cc) { const ox = b.x - cc[0], oy = b.y - cc[1], oz = b.z - cc[2], ol = Math.hypot(ox, oy, oz) || 1;
          lam = 0.45 + 0.55 * Math.max(0, (ox / ol) * LX + (oy / ol) * LY + (oz / ol) * LZ); }
        if (b.sleeping) lam *= 0.82;
        const p = iso(b.x, b.z, b.y), rgb = tints[b.tint];
        ctx.fillStyle = shade(rgb, lam * 0.72);
        ctx.beginPath(); ctx.moveTo(p.x - hw, p.y - hh); ctx.lineTo(p.x, p.y); ctx.lineTo(p.x, p.y + vh); ctx.lineTo(p.x - hw, p.y + vh - hh); ctx.closePath(); ctx.fill();
        ctx.fillStyle = shade(rgb, lam * 0.5);
        ctx.beginPath(); ctx.moveTo(p.x + hw, p.y - hh); ctx.lineTo(p.x, p.y); ctx.lineTo(p.x, p.y + vh); ctx.lineTo(p.x + hw, p.y + vh - hh); ctx.closePath(); ctx.fill();
        ctx.fillStyle = shade(rgb, Math.min(lam * 1.25, 1.05));
        ctx.beginPath(); ctx.moveTo(p.x, p.y - hh * 2); ctx.lineTo(p.x + hw, p.y - hh); ctx.lineTo(p.x, p.y); ctx.lineTo(p.x - hw, p.y - hh); ctx.closePath(); ctx.fill();
      }
}
export { wellDepth, drawFrame };
