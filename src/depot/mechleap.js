// mechleap.js — the war's leap aiming: the lobe, the dragged mark, confirm.
// The screen hands in the renderer, the ground raycast, the rooftop
// surface, and the engine's leap functions; this module owns the aim
// state and feeds the drawn surfaces each frame. The engine's solve is
// the one judge of reachability — slopes and rooftops included.
export function makeMechLeap({ R, groundPoint, surfaceY, eng }) {
  const S = { active: false, mark: null, ptr: null };
  const clamp = (world, mech, px, pz) => {
    const dx = px - mech.hull.pos.x, dz = pz - mech.hull.pos.z;
    const a = Math.atan2(dx, dz);
    let d = Math.max(4, Math.hypot(dx, dz));
    // walk the wished distance inward until the solve accepts it
    for (let i = 0; i < 24; i++) {
      const x = mech.hull.pos.x + Math.sin(a) * d, z = mech.hull.pos.z + Math.cos(a) * d;
      const y = surfaceY(x, z);
      if (eng.mechLeapSolve(world, mech, x, z, y).ok) return { x, z, y };
      d *= 0.92;
      if (d < 4) break;
    }
    return S.mark; // keep the last lawful mark
  };
  const M = {
    get active() { return S.active; },
    cancel() { S.active = false; S.ptr = null; R.setLeapRing(null); },
    press(world, mech) {
      if (!S.active) {
        S.active = true;
        const h = mech.state.heading;
        const r = Math.max(5, eng.mechLeapRange(mech) * 0.5);
        S.mark = clamp(world, mech, mech.hull.pos.x + Math.sin(h) * r, mech.hull.pos.z + Math.cos(h) * r);
        return;
      }
      if (S.mark && eng.mechLeap(world, mech, S.mark.x, S.mark.z, S.mark.y)) M.cancel();
    },
    grab(id) { if (S.active && S.ptr == null) { S.ptr = id; return true; } return false; },
    owns(id) { return S.ptr === id; },
    drag(world, mech, cx, cy) {
      const g = groundPoint(cx, cy);
      if (g) S.mark = clamp(world, mech, g.x, g.z);
    },
    release(id) { if (S.ptr === id) S.ptr = null; },
    feed(world, mech) {
      if (!S.active || !S.mark) return;
      S.mark = clamp(world, mech, S.mark.x, S.mark.z) || S.mark;
      const sv = eng.mechLeapSolve(world, mech, S.mark.x, S.mark.z, S.mark.y);
      if (sv.ok) {
        // the arc, from the same solve the engine will fly
        const dx = S.mark.x - mech.hull.pos.x, dz = S.mark.z - mech.hull.pos.z;
        const yaw = Math.atan2(dx, dz);
        const TH = 0.96;
        const vy = sv.v0 * Math.sin(TH), vh = sv.v0 * Math.cos(TH);
        const y0 = mech.hull.pos.y;
        const T = (vy + Math.sqrt(Math.max(0, vy * vy + 2 * 9.81 * 3))) / 9.81;
        const pts = [];
        for (let k = 0; k <= 20; k++) {
          const t = (k / 20) * T;
          pts.push({ x: mech.hull.pos.x + Math.sin(yaw) * vh * t, y: y0 + vy * t - 4.905 * t * t, z: mech.hull.pos.z + Math.cos(yaw) * vh * t });
        }
        R.setTraj(pts, null);
      }
      // the lobe: the flat-priced boundary per bearing; the mark's clamp is
      // the true judge on slopes and rooftops
      const lobe = [];
      for (let k = 0; k < 48; k++) {
        const a = (k / 48) * Math.PI * 2;
        const r = eng.mechLeapRange(mech) * eng.mechLeapRho(mech, a);
        lobe.push({ x: mech.hull.pos.x + Math.sin(a) * r, z: mech.hull.pos.z + Math.cos(a) * r });
      }
      R.setLeapRing(lobe, S.mark);
    },
  };
  return M;
}
