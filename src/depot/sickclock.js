// COLDSNAP DEPOT — sickclock.js: THE SICK CLOCK (0.6.6). Red seconds over
// every living man who carries the sickness stamp: the time left until he
// turns, counted down from DEAD.turnS. A flat drawing layer over the game
// canvas, redrawn every frame from the renderer's own projection; nothing
// here touches the world. A man hidden in the fog shows no number.
import { DEAD, DEAD_TEAM } from "./specs.js";

// sickSeconds: the whole seconds left, or null when there is no clock to show.
export function sickSeconds(world, b) {
  if (b.kind !== "unit" || !b.alive || b.team === DEAD_TEAM || b.sickAt == null) return null;
  return Math.max(0, Math.ceil(DEAD.turnS - (world.t - b.sickAt)));
}

// makeSickClock(canvas): the layer. draw(world, project, shows) paints this
// frame; project is the renderer's world-to-screen (normalized, null behind
// the eye); shows(b) says whether the fog lets the man be seen.
export function makeSickClock(canvas) {
  const cx = canvas.getContext("2d");
  let w = 0, h = 0;
  const fit = () => {
    const r = canvas.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    const nw = Math.max(1, Math.round(r.width * dpr)), nh = Math.max(1, Math.round(r.height * dpr));
    if (nw !== w || nh !== h) { w = nw; h = nh; canvas.width = w; canvas.height = h; }
    return dpr;
  };
  return {
    clear() { if (w || h) cx.clearRect(0, 0, w, h); },
    draw(world, project, shows) {
      const dpr = fit();
      cx.clearRect(0, 0, w, h);
      if (!project) return;
      const pool = world._L ? world._L.units : world.bodies;
      cx.font = "bold " + Math.round(15 * dpr) + "px monospace";
      cx.textAlign = "center"; cx.textBaseline = "bottom";
      cx.lineWidth = 3 * dpr; cx.strokeStyle = "rgba(0,0,0,0.75)"; cx.fillStyle = "#ff3b30";
      for (const b of pool) {
        const s = sickSeconds(world, b);
        if (s == null || !shows(b)) continue;
        const nd = project(b.pos.x, b.pos.y + b.hy + 0.9, b.pos.z);
        if (!nd) continue;
        const x = (nd.x * 0.5 + 0.5) * w, y = (-nd.y * 0.5 + 0.5) * h;
        if (x < -20 || x > w + 20 || y < -20 || y > h + 20) continue;
        cx.strokeText(String(s), x, y); cx.fillText(String(s), x, y);
      }
    },
  };
}
