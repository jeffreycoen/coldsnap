// rubbleworlds/draw.js — the demo's whole drawn frame, carved from the
// component: the ark sky, the bent grid, the horizon, the cubes and their
// light, the projected orbits. drawFrame paints exactly what the loop
// painted; the loop keeps physics and hands over an env each frame.
import { SF, G, BS, C30, S30, predictShip } from "./phys.js";
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
  const { ctx, W, H, world, frame, time } = env;
  const wb = world.blocks;
  // between physics steps, draw each body partway from where it stood to where it is
  const L = world.lerp == null ? 1 : world.lerp;
  const lx = (b) => b.px == null ? b.x : b.px + (b.x - b.px) * L;
  const ly = (b) => b.py == null ? b.y : b.py + (b.y - b.py) * L;
  const lz = (b) => b.pz == null ? b.z : b.pz + (b.z - b.pz) * L;
  const shipAt = () => { const st = world.shipTrack, pv = world.shipPrev; if (!st) return null; if (!pv) return { x: st.x, z: st.z }; return { x: pv.x + (st.x - pv.x) * L, z: pv.z + (st.z - pv.z) * L }; };
      // --- DRAW ---
      ctx.fillStyle = "#f5f4f0"; ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 60; i++) { const sx3 = ((i * 7919 + 37) * 3.7) % W, sy3 = ((i * 4967 + 13) * 2.3) % H; ctx.fillStyle = `rgba(0,0,20,${i % 5 === 0 ? 0.06 : 0.03})`; ctx.fillRect(sx3, sy3, i % 7 === 0 ? 1.5 : 1, i % 7 === 0 ? 1.5 : 1); }
      // THE LARGE PLAYFIELD: one absolute world scale for every scene and every
      // size — a 1x planet reads small, a 5x world overflows the frame. The view
      // rests on the scene's mass center and a drag owns it (world.pan); a
      // double-tap hands it back. Debris may leave the frame; nothing refits.
      const sc = Math.min(W * 0.82 / (500 * C30), H * 0.62 / (500 * S30), 2.2);
      world._sc = sc;
      let ctrX = 0, ctrZ = 0, ctrM = 0;
      for (const tk of world.tracks || []) { ctrX += tk.x * tk.m; ctrZ += tk.z * tk.m; ctrM += tk.m; }
      if (world.hole) { ctrX += world.hole.x * world.hole.m; ctrZ += world.hole.z * world.hole.m; ctrM += world.hole.m; }
      if (world.starBodies) for (const st of world.starBodies) { ctrX += st.x * st.m; ctrZ += st.z * st.m; ctrM += st.m; }
      if (world.star) { ctrX += world.star.x * world.star.m; ctrZ += world.star.z * world.star.m; ctrM += world.star.m; }
      world._center = ctrM ? { x: ctrX / ctrM, z: ctrZ / ctrM } : { x: 0, z: 0 };
      const look = world.pan || (world.ship && world.shipTrack ? shipAt() : world._center); // the ark's follow: the camera rides the ship; a drag takes the wheel, double-tap hands it back
      const cx = W / 2 - (look.x - look.z) * C30 * sc, cy = H / 2 - (look.x + look.z) * S30 * sc;
      // ONE PLANE: every body draws on the flat plane, and the net beneath sags
      // only faintly — a tenth of the depth it once had — so mass still reads in
      // the weave while no body ever hangs above a hole or sinks into one.
      const getD = (sx2, sz2) => wellDepth(sx2, sz2, world.wells, sc) * 0.1;
      const iso = (x, z, y) => ({ x: cx + (x - z) * C30 * sc, y: cy + (x + z) * S30 * sc - (y || 0) * 0.9 * sc });
      const lookX = look.x, lookZ = look.z;
      const gN = 56, gSp = 16, halfG = gN * gSp / 2; // fixed weave: the net follows the camera like the ark's, and the weave itself is the absolute ruler
      const gcx = Math.round(lookX / gSp) * gSp, gcz = Math.round(lookZ / gSp) * gSp;
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
      // A one-second look, rebuilt EVERY drawn frame and rooted where the body
      // is drawn — its blended position between physics steps — so the line
      // rides the body instead of hanging at its last true spot and jumping.
      // Short lines make the every-frame rebuild cheap: fourteen bodies by
      // fifteen steps.
      {
        const rootOff = (tk) => { const gi = world.groups && world.groups.get(tk.clump); if (!gi) return [0, 0]; const i0 = gi.find(i => wb[i].alive); if (i0 == null) return [0, 0]; const b0 = wb[i0]; return [lx(b0) - b0.x, lz(b0) - b0.z]; };
        const bodies = (world.tracks || []).filter(tk => tk.m >= 500).slice(0, 14)
          .map(tk => { const [ox, oz] = rootOff(tk); return { x: tk.x + ox, z: tk.z + oz, vx: tk.vx, vz: tk.vz, m: tk.m, rad: tk.rad, clump: tk.clump, pts: [], hit: -1 }; });
        const statics = [];
        if (world.hole) statics.push({ x: world.hole.x, z: world.hole.z, m: world.hole.m, rad: world.hole.killR });
        if (world.star) statics.push({ x: world.star.x, z: world.star.z, m: world.star.m, rad: world.star.r });
        if (world.starBodies) for (const st of world.starBodies) statics.push({ x: st.px == null ? st.x : st.px + (st.x - st.px) * L, z: st.pz == null ? st.z : st.pz + (st.z - st.pz) * L, m: st.m, rad: st.r });
        const dtP = 1 / 15, NPRED = Math.max(2, Math.round(30 * (time || 0.5))); // TWO REAL SECONDS at any chip: fifteen steps at ×½ down to two at ×1/32 (a line needs two points) — a direction tick at the slowest speeds; the ship's own ghost keeps its full length
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
        const pts = b.pts; if (pts.length < 2) continue;
        const stride = pts.length >= 9 ? 3 : 1; // short lines draw every point
        const redFrom = b.hit >= 0 ? 0 : pts.length + 1; // any predicted contact inside two real seconds paints the whole short line red
        ctx.lineWidth = 2.2;
        for (let i2 = stride; i2 < pts.length; i2 += stride) {
          const p0 = iso(pts[i2 - stride][0], pts[i2 - stride][1], 0), p1 = iso(pts[i2][0], pts[i2][1], 0);
          const fade = Math.max(0.25, 1 - i2 / pts.length);
          ctx.strokeStyle = i2 >= redFrom ? `rgba(220,55,35,${fade * 0.95})` : `rgba(40,170,90,${fade * 0.85})`;
          ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
        }
      }
      // the gate ring — teal pulse until reached, then green, the ark's ring
      if (world.gate) {
        const g = world.gate;
        ctx.beginPath();
        for (let a = 0; a <= 32; a++) { const th = a / 32 * Math.PI * 2; const p = iso(g.x + Math.cos(th) * g.r, g.z + Math.sin(th) * g.r, 0); if (a === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }
        const pulse = 0.45 + 0.25 * Math.sin(frame * 0.08);
        ctx.strokeStyle = g.reached ? "rgba(40,170,90,.8)" : `rgba(40,150,170,${pulse})`;
        ctx.lineWidth = 2.5; ctx.stroke();
      }
      // THE COMPASS: when the gate ring is off screen, an arrow at the screen's
      // edge on the line to it, the distance from the ship printed beside it;
      // it folds away the moment the ring itself is in view
      if (world.gate && !world.gate.reached && world.shipTrack) {
        const gp = iso(world.gate.x, world.gate.z, 0), pad = 24;
        if (gp.x < -pad || gp.x > W + pad || gp.y < -pad || gp.y > H + pad) {
          const cx2 = W / 2, cy2 = H / 2, dx = gp.x - cx2, dy = gp.y - cy2;
          const inset = 44, hw = W / 2 - inset, hh = H / 2 - inset;
          const t = Math.min(hw / Math.max(Math.abs(dx), 1e-6), hh / Math.max(Math.abs(dy), 1e-6));
          const ax = cx2 + dx * t, ay = cy2 + dy * t, ang = Math.atan2(dy, dx);
          const dist = Math.round(Math.hypot(world.gate.x - world.shipTrack.x, world.gate.z - world.shipTrack.z));
          ctx.save(); ctx.translate(ax, ay); ctx.rotate(ang);
          ctx.fillStyle = "rgba(40,150,170,.9)";
          ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -9); ctx.lineTo(-4, 0); ctx.lineTo(-8, 9); ctx.closePath(); ctx.fill();
          ctx.restore();
          ctx.font = "700 11px -apple-system,sans-serif"; ctx.fillStyle = "rgba(40,150,170,.9)"; ctx.textAlign = "center";
          ctx.fillText("GATE " + dist, ax - Math.cos(ang) * 30, ay - Math.sin(ang) * 30 + 4); ctx.textAlign = "left";
        }
      }
      // the aimed burn's TRUTHFUL ghost: the ark's own predictor, blue while
      // clear, red through danger, a green dot where it threads the gate
      if (world.ship && world.shipAim && world.shipAim.on && world.shipTrack) {
        const st = world.shipTrack;
        const pr = predictShip(world, st.vx + world.shipAim.vx, st.vz + world.shipAim.vz, 2400); // forty simulated seconds at the physics step
        if (pr && pr.pts.length > 3) {
          ctx.lineWidth = 2.2;
          for (let i2 = 3; i2 < pr.pts.length; i2 += 3) {
            const q = pr.pts[i2], q0 = pr.pts[i2 - 3];
            const p0 = iso(q0.x, q0.z, 0), p1 = iso(q.x, q.z, 0);
            const fade = Math.max(0.25, 1 - i2 / pr.pts.length);
            ctx.strokeStyle = q.danger > 0.3 ? `rgba(220,55,35,${fade})` : `rgba(60,130,220,${fade * 0.9})`;
            ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
          }
          const last = pr.pts[pr.pts.length - 1];
          if (last.hitsGate) { const p = iso(last.x, last.z, 0); ctx.fillStyle = "rgba(40,170,90,.9)"; ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, Math.PI * 2); ctx.fill(); }
        }
      }
      if (world.ship && world.shipPhase === "plan") {
        ctx.font = "600 11px -apple-system,sans-serif"; ctx.fillStyle = "rgba(60,130,220,.55)"; ctx.textAlign = "center";
        ctx.fillText("TIME FROZEN \u2014 DRAG TO AIM BURN", W / 2, 24); ctx.textAlign = "left";
      }
      if (world.ship && world.shipPaused && world.shipPhase === "fly") {
        ctx.fillStyle = "rgba(245,244,240,.45)"; ctx.fillRect(0, 0, W, H);
        ctx.font = "200 22px -apple-system,sans-serif"; ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.textAlign = "center";
        ctx.fillText("PAUSED", W / 2, H / 2);
        ctx.font = "400 10px -apple-system,sans-serif"; ctx.fillStyle = "rgba(0,0,0,.2)";
        ctx.fillText("tap to resume", W / 2, H / 2 + 20); ctx.textAlign = "left";
      }
      // the engine fires: the deadweight hangar's plume — radial glow, gradient
      // cone, shock diamonds, white-hot core — anchored on the aft module,
      // pointed against the burn, thrust-scaled, decaying over the burn's moment
      if (world.flame && world.frame - world.flame.f0 < world.flame.dur) {
        for (const eng of wb) {
          if (!(eng.ship && eng.eng && eng.alive)) continue;
          const fl = world.flame, age = (world.frame - fl.f0) / fl.dur;
          const th = (1 - age) * Math.min(1, fl.mag / (65 * (world.shipScale || 1)));
          const f = (0.85 + 0.15 * Math.sin(world.frame * 0.57)) * Math.max(th, 0.001);
          const ep = iso(eng.x + fl.dx * BS * 0.6, eng.z + fl.dz * BS * 0.6, eng.y);
          const tp = iso(eng.x + fl.dx * (BS * 0.6 + 26 * f), eng.z + fl.dz * (BS * 0.6 + 26 * f), eng.y);
          const dx2 = tp.x - ep.x, dy2 = tp.y - ep.y, L = Math.hypot(dx2, dy2) || 1;
          let pg = ctx.createRadialGradient(ep.x, ep.y, 0, ep.x + dx2 * 0.4, ep.y + dy2 * 0.4, 22 * f + 1);
          pg.addColorStop(0, "rgba(90,140,235,.5)"); pg.addColorStop(1, "rgba(58,98,196,0)");
          ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(ep.x + dx2 * 0.3, ep.y + dy2 * 0.3, 20 * f + 1, 0, Math.PI * 2); ctx.fill();
          ctx.save(); ctx.translate(ep.x, ep.y); ctx.rotate(Math.atan2(dy2, dx2));
          let cg = ctx.createLinearGradient(0, 0, L, 0);
          cg.addColorStop(0, "rgba(220,236,255,.95)"); cg.addColorStop(0.35, "rgba(120,166,240,.7)"); cg.addColorStop(1, "rgba(58,98,196,0)");
          ctx.fillStyle = cg; ctx.beginPath(); ctx.moveTo(0, -3.4 * f); ctx.lineTo(L * 0.75, -1.1 * f); ctx.lineTo(L, 0); ctx.lineTo(L * 0.75, 1.1 * f); ctx.lineTo(0, 3.4 * f); ctx.closePath(); ctx.fill();
          ctx.fillStyle = "rgba(235,245,255,.85)";
          for (const q of [0.22, 0.45, 0.68]) { ctx.beginPath(); ctx.ellipse(L * q, 0, 2.6 * f * (1 - q * 0.7), 1.3 * f * (1 - q * 0.7), 0, 0, Math.PI * 2); ctx.fill(); }
          ctx.restore();
          ctx.save(); ctx.shadowColor = "rgba(200,225,255,.95)"; ctx.shadowBlur = 14;
          ctx.fillStyle = "#f2f8ff"; ctx.beginPath(); ctx.arc(ep.x, ep.y, 2.6 * f + 0.6, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        }
      }
      // the ship's aim arrow, the ark's own gesture
      if (world.shipAim && world.shipAim.on && world.shipTrack) {
        const st = world.shipTrack, sa = shipAt(), sp2 = iso(sa.x, sa.z, 0);
        const adx = (world.shipAim.vx - world.shipAim.vz) * C30 * sc * 1.2, ady = (world.shipAim.vx + world.shipAim.vz) * S30 * sc * 1.2;
        ctx.save(); ctx.strokeStyle = "rgba(240,165,30,.8)"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(sp2.x, sp2.y); ctx.lineTo(sp2.x + adx, sp2.y + ady); ctx.stroke();
        ctx.fillStyle = "rgba(240,165,30,.8)"; ctx.beginPath(); ctx.arc(sp2.x + adx, sp2.y + ady, 5, 0, Math.PI * 2); ctx.fill();
        ctx.font = "700 12px -apple-system,sans-serif";
        ctx.fillText("\u0394v " + Math.round(Math.hypot(world.shipAim.vx, world.shipAim.vz)), sp2.x + adx + 10, sp2.y + ady - 8);
        ctx.restore();
      }
      const drawStar = (wx, wz, wr) => {
        const sp = iso(wx, wz, 0), sR = Math.max(wr * sc, 8);
        ctx.save();
        const cg = ctx.createRadialGradient(sp.x, sp.y, sR * 0.5, sp.x, sp.y, sR * 3);
        cg.addColorStop(0, "rgba(255,220,100,.25)"); cg.addColorStop(0.3, "rgba(255,180,60,.08)"); cg.addColorStop(1, "rgba(255,140,30,0)");
        ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(sp.x, sp.y, sR * 3, 0, Math.PI * 2); ctx.fill();
        ctx.shadowColor = "rgba(255,200,80,.8)"; ctx.shadowBlur = 30;
        const sg = ctx.createRadialGradient(sp.x - sR * 0.2, sp.y - sR * 0.2, sR * 0.1, sp.x, sp.y, sR);
        sg.addColorStop(0, "rgba(255,255,230,1)"); sg.addColorStop(0.4, "rgba(255,220,120,1)"); sg.addColorStop(1, "rgba(255,160,40,1)");
        ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sp.x, sp.y, sR, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      };
      if (world.star) drawStar(world.star.x, world.star.z, world.star.r);
      if (world.starBodies) for (const st of world.starBodies) drawStar(st.px == null ? st.x : st.px + (st.x - st.px) * L, st.pz == null ? st.z : st.pz + (st.z - st.pz) * L, st.r);
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
      const tints = [[126, 148, 196], [188, 134, 92], [232, 196, 110]]; // the third is the ship — gold, and never painted red
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
        // an awake block burns red — the owner's own gauge of what sleep is doing
        const p = iso(lx(b), lz(b), ly(b)), rgb = b.sleeping || b.ship ? tints[b.tint] : [214, 74, 52];
        ctx.fillStyle = shade(rgb, lam * 0.72);
        ctx.beginPath(); ctx.moveTo(p.x - hw, p.y - hh); ctx.lineTo(p.x, p.y); ctx.lineTo(p.x, p.y + vh); ctx.lineTo(p.x - hw, p.y + vh - hh); ctx.closePath(); ctx.fill();
        ctx.fillStyle = shade(rgb, lam * 0.5);
        ctx.beginPath(); ctx.moveTo(p.x + hw, p.y - hh); ctx.lineTo(p.x, p.y); ctx.lineTo(p.x, p.y + vh); ctx.lineTo(p.x + hw, p.y + vh - hh); ctx.closePath(); ctx.fill();
        ctx.fillStyle = shade(rgb, Math.min(lam * 1.25, 1.05));
        ctx.beginPath(); ctx.moveTo(p.x, p.y - hh * 2); ctx.lineTo(p.x + hw, p.y - hh); ctx.lineTo(p.x, p.y); ctx.lineTo(p.x - hw, p.y - hh); ctx.closePath(); ctx.fill();
      }
}
export { wellDepth, drawFrame };
