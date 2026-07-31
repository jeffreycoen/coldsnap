// MECH TEST RANGE — the walker's first visible surface. Flat proving pad,
// one biped frame, drive commands. Deliberately spare: this exists so the
// gait bring-up is WATCHABLE on the page while the march gate is WIP.
// The machine stands, weight-shifts, steps — and still falls; R reissues it.
import React, { useEffect, useRef, useState } from "react";
import { makeWorld, makeField, stepWorld } from "../engine/core.js";
import { buildMech, mechCommand, respawnMech, mechFallen } from "../engine/mech.js";
import { makeRenderer } from "../render/renderer.js";
import { COLORS, FONT } from "../ui/theme.js";

export default function MechRange({ onExit }) {
  const canvasRef = useRef(null);
  const [hud, setHud] = useState({ mode: "STAND", steps: 0, falls: 0 });
  useEffect(() => {
    const field = makeField(64, 1.7, 5);
    field.h.fill(0);
    const world = makeWorld({ field, seed: 5 });
    const mech = buildMech(world, { x: 0, z: 0 });
    const R = makeRenderer(canvasRef.current, world, { town: false });
    window.__MECHRANGE__ = { world, mech };
    const S = { acc: 0, last: performance.now(), keys: {}, yawT: 0, raf: 0, hudT: 0, dead: false };
    const focus = { x: 0, y: 3, z: 0 };
    const down = (e) => {
      if (e.repeat) return;
      S.keys[e.code] = true;
      if (e.code === "KeyR") {
        respawnMech(world, mech, 0, 0, 0);
        S.yawT = 0;
        mechCommand(mech, { travel: 0, lateral: 0, heading: 0 });
      }
    };
    const up = (e) => { S.keys[e.code] = false; };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    const loop = () => {
      if (S.dead) return;
      const now = performance.now();
      let dt = Math.min(0.05, (now - S.last) / 1000);
      S.last = now;
      const travel = S.keys.KeyW ? 0.3 : S.keys.KeyS ? -0.18 : 0;
      if (S.keys.KeyA) S.yawT += 0.7 * dt;
      if (S.keys.KeyD) S.yawT -= 0.7 * dt;
      mechCommand(mech, { travel, heading: S.yawT });
      S.acc += dt;
      let guard = 0;
      while (S.acc >= world.dt && guard++ < 6) { world.events.length = 0; stepWorld(world); S.acc -= world.dt; }
      const h = mech.hull;
      focus.x += (h.pos.x - focus.x) * Math.min(1, 4 * dt);
      focus.y += (h.pos.y - 1.2 - focus.y) * Math.min(1, 4 * dt);
      focus.z += (h.pos.z - focus.z) * Math.min(1, 4 * dt);
      try { R.render(dt, focus, { x: h.pos.x, z: h.pos.z }, 0); } catch (e) {}
      S.hudT += dt;
      if (S.hudT > 0.25) {
        S.hudT = 0;
        setHud({ mode: mech.state.mode, steps: mech.telem.steps, falls: mech.telem.falls });
      }
      S.raf = requestAnimationFrame(loop);
    };
    S.raf = requestAnimationFrame(loop);
    return () => {
      S.dead = true;
      cancelAnimationFrame(S.raf);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      delete window.__MECHRANGE__;
      R.dispose();
    };
  }, []);
  const line = { margin: 0, fontFamily: FONT, fontSize: 12, letterSpacing: 1 };
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000" }}>
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
      <div data-mech-hud style={{ position: "absolute", top: 10, left: 12, color: "#c7d0dc", pointerEvents: "none" }}>
        <p style={{ ...line, color: COLORS.gold, fontSize: 14, letterSpacing: 2 }}>MECH TEST RANGE</p>
        <p style={line}>BIPED FRAME MK1 — GAIT ACCEPTANCE PENDING</p>
        <p style={line}>W/S walk · A/D turn · R reissue frame · ESC menu</p>
        <p data-mech-status style={line}>
          {hud.mode === "FALLEN" ? "FRAME DOWN — R TO REISSUE" : hud.mode} · steps {hud.steps} · falls {hud.falls}
        </p>
      </div>
    </div>
  );
}
