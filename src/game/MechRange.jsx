// MECH TEST RANGE — the walker's first visible surface. Flat proving pad,
// one biped frame, drive commands. Deliberately spare: this exists so the
// gait bring-up is WATCHABLE on the page while the march gate is WIP.
// The machine stands, weight-shifts, steps — and still falls; R reissues it.
import React, { useEffect, useRef, useState } from "react";
import { makeWorld, makeField, stepWorld, addBody } from "../engine/core.js";
import { buildMech, mechCommand, respawnMech, mechFallen, mechFire, mechPunt } from "../engine/mech.js";
import { makeRenderer } from "../render/renderer.js";
import { detectTouch } from "./runner/trials.js";
import { BUILDERS } from "./scenario.js";
import { COLORS, FONT } from "../ui/theme.js";

export default function MechRange({ onExit }) {
  const canvasRef = useRef(null);
  const knobRef = useRef(null);
  const aimKnobRef = useRef(null);
  const isTouch = detectTouch();
  const [hud, setHud] = useState({ mode: "STAND", steps: 0, falls: 0, kills: 0, shots: 0 });
  useEffect(() => {
    const field = makeField(64, 1.7, 5);
    field.h.fill(0);
    const world = makeWorld({ field, seed: 5 });
    const mech = buildMech(world, { x: 0, z: 0 });
    // sandbox buildings on the pad — something to walk toward (and, once the
    // march lands, through)
    const pg = { covers: [], shelters: [], wallIndex: 0 };
    BUILDERS.house(world, field, pg, { x: -14, z: 18, nx: 5, nz: 4, doorIx: 0, group: "rangeA" });
    BUILDERS.house(world, field, pg, { x: 13, z: 24, nx: 4, nz: 5, doorIx: 1, group: "rangeB" });
    BUILDERS.house(world, field, pg, { x: -2, z: 34, nx: 6, nz: 4, doorIx: 0, group: "rangeC" });
    BUILDERS.hangar(world, field, pg, { x: 18, z: -14, group: "rangeH" });
    for (const b of world.bodies) if (b.kind === "chunk") { b.sleeping = true; b.sleepT = 1; }
    // live targets: a rifle squad, two scouts, a truck — mass, hp, and the
    // full damage pipeline (shell, blast, CRUSH underfoot all attribute)
    for (let i = 0; i < 5; i++) addBody(world, { kind: "unit", team: 2, group: "tgtSquad", mass: 82, hx: 0.26, hy: 0.9, hz: 0.26, x: -6 + i * 2.1, y: 1.9, z: 9 + (i % 2) * 2, hp: 30, friction: 0.55 });
    addBody(world, { kind: "vehicle", team: 2, group: "tgtScout", mass: 950, hx: 1.25, hy: 0.7, hz: 1.85, x: 7, y: 1.7, z: 14, hp: 55, friction: 0.7 });
    addBody(world, { kind: "vehicle", team: 2, group: "tgtScout", mass: 950, hx: 1.25, hy: 0.7, hz: 1.85, x: -9, y: 1.7, z: 5, hp: 55, friction: 0.7 });
    addBody(world, { kind: "truck", team: 2, group: "tgtTruck", vtype: "truck", mass: 1400, hx: 1.15, hy: 1.05, hz: 2.6, x: 5, y: 2.05, z: -7, hp: 120, friction: 0.6 });
    const R = makeRenderer(canvasRef.current, world, { town: false });

    const S = { acc: 0, last: performance.now(), keys: {}, yawT: 0, aimYaw: null, raf: 0, hudT: 0, dead: false, joyId: null, jx: 0, jy: 0, aimId: null, ax: 0, ay: 0, fireHeld: false };
    window.__MECHRANGE__ = {
      world, mech,
      reissue: () => { respawnMech(world, mech, 0, 0, 0); S.yawT = 0; S.aimYaw = null; mech.aimYaw = null; mechCommand(mech, { travel: 0, lateral: 0, heading: 0 }); },
      turn: (dir) => { S.yawT += dir * 0.14; },
      fireHeld: (v) => { S.fireHeld = v; },
      fire: () => mechFire(world, mech),
      punt: () => mechPunt(world, mech),
    };
    const joyBase = () => ({ x: 86, y: window.innerHeight - 130 });
    const aimBase = () => ({ x: window.innerWidth - 86, y: window.innerHeight - 130 });
    const onPD = (e) => {
      if (e.target.closest && e.target.closest("button")) return;
      if (e.pointerType === "mouse") { S.fireHeld = true; return; } // desktop: click = fire
      const c = joyBase(), a = aimBase();
      if (S.joyId == null && Math.hypot(e.clientX - c.x, e.clientY - c.y) < 110) S.joyId = e.pointerId;
      else if (S.aimId == null && Math.hypot(e.clientX - a.x, e.clientY - a.y) < 110) S.aimId = e.pointerId;
    };
    const onPM = (e) => {
      if (e.pointerType === "mouse") {
        // camera yaw is fixed in the range: screen offset from centre maps
        // straight to a world aim heading
        const dx = e.clientX - window.innerWidth / 2, dy = e.clientY - window.innerHeight / 2;
        if (Math.hypot(dx, dy) > 30) S.aimYaw = Math.atan2(dx, -dy);
        return;
      }
      if (e.pointerId === S.joyId) {
        const c = joyBase();
        S.jx = Math.max(-1, Math.min(1, (e.clientX - c.x) / 44));
        S.jy = Math.max(-1, Math.min(1, (e.clientY - c.y) / 44));
        if (knobRef.current) { knobRef.current.style.left = c.x - 20 + S.jx * 34 + "px"; knobRef.current.style.top = c.y - 20 + S.jy * 34 + "px"; }
      } else if (e.pointerId === S.aimId) {
        const a = aimBase();
        S.ax = Math.max(-1, Math.min(1, (e.clientX - a.x) / 44));
        S.ay = Math.max(-1, Math.min(1, (e.clientY - a.y) / 44));
        if (aimKnobRef.current) { aimKnobRef.current.style.left = a.x - 20 + S.ax * 34 + "px"; aimKnobRef.current.style.top = a.y - 20 + S.ay * 34 + "px"; }
      }
    };
    const onPU = (e) => {
      if (e.pointerType === "mouse") { S.fireHeld = false; return; }
      if (e.pointerId === S.joyId) {
        S.joyId = null; S.jx = 0; S.jy = 0;
        const c = joyBase();
        if (knobRef.current) { knobRef.current.style.left = c.x - 20 + "px"; knobRef.current.style.top = c.y - 20 + "px"; }
      } else if (e.pointerId === S.aimId) {
        // release => aim HOLDS (a gunner keeps aim) — spec §0b
        S.aimId = null; S.ax = 0; S.ay = 0;
        const a = aimBase();
        if (aimKnobRef.current) { aimKnobRef.current.style.left = a.x - 20 + "px"; aimKnobRef.current.style.top = a.y - 20 + "px"; }
      }
    };
    window.addEventListener("pointerdown", onPD);
    window.addEventListener("pointermove", onPM);
    window.addEventListener("pointerup", onPU);
    window.addEventListener("pointercancel", onPU);
    const focus = { x: 0, y: 3, z: 0 };
    const down = (e) => {
      if (e.repeat) return;
      S.keys[e.code] = true;
      if (e.code === "KeyC") { mechPunt(world, mech); }
      if (e.code === "KeyR") {
        respawnMech(world, mech, 0, 0, 0);
        S.yawT = 0; S.aimYaw = null; mech.aimYaw = null;
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
      // §0b: LEFT = travel vector (strafe, never rotates); turn is a RATE
      // command (Q/E, on-screen arrows); RIGHT stick = torso aim heading,
      // held on release, chassis follows past 60% waist travel
      // keyboard follows the HOUSE convention (every mode steers on A/D);
      // Q/E strafe. Touch sticks keep the spec §0b layout.
      let tf = S.keys.KeyW ? 0.3 : S.keys.KeyS ? -0.18 : 0;
      let tl = S.keys.KeyQ ? 0.22 : S.keys.KeyE ? -0.22 : 0;
      if (S.joyId != null) {
        if (Math.abs(S.jy) > 0.12) tf = S.jy < 0 ? 0.3 * -S.jy : -0.18 * S.jy;
        if (Math.abs(S.jx) > 0.12) tl = -0.22 * S.jx;
      }
      if (S.keys.KeyA) S.yawT += 0.7 * dt;
      if (S.keys.KeyD) S.yawT -= 0.7 * dt;
      if (S.aimId != null && Math.hypot(S.ax, S.ay) > 0.18) S.aimYaw = Math.atan2(-S.ax, -S.ay);
      mech.aimYaw = S.aimYaw;
      if (mech.waist && Math.abs(mech.waist.target) > 0.6 * 0.87) S.yawT += Math.sign(mech.waist.target) * 0.5 * dt;
      mechCommand(mech, { travel: tf, lateral: tl, heading: S.yawT });
      if (S.keys.Space || S.keys.KeyF || S.fireHeld) mechFire(world, mech); // rate-limited inside
      S.acc += dt;
      let guard = 0;
      // accumulate events across substeps — clearing per-substep starved the
      // renderer: muzzle flashes and explosions never drew in this mode
      const evs = [];
      while (S.acc >= world.dt && guard++ < 6) {
        world.events.length = 0;
        stepWorld(world);
        for (const e of world.events) evs.push(e);
        S.acc -= world.dt;
      }
      R.consume(evs);
      const h = mech.hull;
      focus.x += (h.pos.x - focus.x) * Math.min(1, 4 * dt);
      focus.y += (h.pos.y - 1.2 - focus.y) * Math.min(1, 4 * dt);
      focus.z += (h.pos.z - focus.z) * Math.min(1, 4 * dt);
      // targeting: the shell's actual ballistic arc from the muzzle, drawn
      // with the same setTraj machinery the bison uses
      try {
        const torso = mech.waist ? mech.waist.b : mech.hull;
        const ty2 = Math.atan2(torso.R[6], torso.R[8]);
        const gY2 = world.field.heightAt(torso.pos.x, torso.pos.z);
        let dy2 = -Math.max(0.03, (torso.pos.y - gY2) * 0.038);
        const n2 = Math.hypot(1, dy2);
        const pts = [];
        let px = torso.pos.x + Math.sin(ty2) * 2.6, py = torso.pos.y + 0.35, pz = torso.pos.z + Math.cos(ty2) * 2.6;
        let vx = Math.sin(ty2) / n2 * 120, vy = dy2 / n2 * 120, vz = Math.cos(ty2) / n2 * 120;
        let hitIdx = -1;
        for (let k2 = 0; k2 < 16; k2++) {
          pts.push({ x: px, y: py, z: pz });
          const st2 = 0.024;
          vy -= 9.81 * st2;
          px += vx * st2; py += vy * st2; pz += vz * st2;
          if (py <= world.field.heightAt(px, pz)) { pts.push({ x: px, y: world.field.heightAt(px, pz), z: pz }); hitIdx = pts.length - 1; break; }
        }
        R.setTraj(pts, hitIdx);
      } catch (e) {}
      try { R.render(dt, focus, { x: h.pos.x, z: h.pos.z }, 0); } catch (e) {}
      S.hudT += dt;
      if (S.hudT > 0.25) {
        S.hudT = 0;
        setHud({ mode: mech.state.mode, steps: mech.telem.steps, falls: mech.telem.falls, kills: world.killCount, shots: mech.telem.shots || 0 });
      }
      S.raf = requestAnimationFrame(loop);
    };
    S.raf = requestAnimationFrame(loop);
    return () => {
      S.dead = true;
      cancelAnimationFrame(S.raf);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("pointerdown", onPD);
      window.removeEventListener("pointermove", onPM);
      window.removeEventListener("pointerup", onPU);
      window.removeEventListener("pointercancel", onPU);
      delete window.__MECHRANGE__;
      R.dispose();
    };
  }, []);
  const line = { margin: 0, fontFamily: FONT, fontSize: 12, letterSpacing: 1 };
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000", touchAction: "none" }}>
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
      <div data-mech-hud style={{ position: "absolute", top: 10, left: 12, color: "#c7d0dc", pointerEvents: "none" }}>
        <p style={{ ...line, color: COLORS.gold, fontSize: 14, letterSpacing: 2 }}>MECH TEST RANGE</p>
        <p style={line}>BIPED FRAME MK1 — GAIT ACCEPTANCE PENDING</p>
        <p style={line}>{isTouch ? "left moves · right aims · ◀ ▶ turn · FIRE fires" : "W/S walk · A/D turn · Q/E strafe · MOUSE aims · CLICK/SPACE fires · C punt · R reissue"}</p>
        <p data-mech-status style={line}>
          {hud.mode === "FALLEN" ? "FRAME DOWN — R TO REISSUE" : hud.mode} · steps {hud.steps} · falls {hud.falls} · kills {hud.kills} · shots {hud.shots}
        </p>
      </div>
      {isTouch && (
        <>
          <div style={{ position: "absolute", left: 86 - 55, bottom: 130 - 55, width: 110, height: 110, borderRadius: 60, border: "1px solid #5f6e80", opacity: 0.55 }} />
          <div ref={knobRef} style={{ position: "absolute", left: 86 - 20, top: "calc(100% - 150px)", width: 40, height: 40, borderRadius: 22, background: "#5f6e80", opacity: 0.8 }} />
          <div style={{ position: "absolute", right: 86 - 55, bottom: 130 - 55, width: 110, height: 110, borderRadius: 60, border: "1px solid #7a6a4e", opacity: 0.5 }} />
          <div ref={aimKnobRef} style={{ position: "absolute", right: 86 - 20, top: "calc(100% - 150px)", width: 40, height: 40, borderRadius: 22, background: "#7a6a4e", opacity: 0.8 }} />
          <button data-mech-turnl onPointerDown={(e) => { e.stopPropagation(); const m = window.__MECHRANGE__; if (m) m.turn(1); }}
            style={{ position: "absolute", left: "calc(50% - 64px)", bottom: 40, padding: "10px 16px", fontFamily: FONT, fontSize: 14, color: "#c7d0dc", background: "#1a212b", border: "1px solid #444c58" }}>
            ◀
          </button>
          <button data-mech-turnr onPointerDown={(e) => { e.stopPropagation(); const m = window.__MECHRANGE__; if (m) m.turn(-1); }}
            style={{ position: "absolute", left: "calc(50% + 16px)", bottom: 40, padding: "10px 16px", fontFamily: FONT, fontSize: 14, color: "#c7d0dc", background: "#1a212b", border: "1px solid #444c58" }}>
            ▶
          </button>
          <button data-mech-punt onPointerDown={(e) => { e.stopPropagation(); const m = window.__MECHRANGE__; if (m) m.punt(); }}
            style={{ position: "absolute", right: 110, bottom: 210, padding: "16px 18px", fontFamily: FONT, fontSize: 14, letterSpacing: 1, color: "#c7d0dc", background: "#1d2531", border: "1px solid #5f6e80" }}>
            🦵 PUNT
          </button>
          <button data-mech-fire
            onPointerDown={(e) => { e.stopPropagation(); const m = window.__MECHRANGE__; if (m) m.fireHeld(true); }}
            onPointerUp={(e) => { e.stopPropagation(); const m = window.__MECHRANGE__; if (m) m.fireHeld(false); }}
            onPointerCancel={(e) => { e.stopPropagation(); const m = window.__MECHRANGE__; if (m) m.fireHeld(false); }}
            style={{ position: "absolute", right: 14, bottom: 210, padding: "16px 20px", fontFamily: FONT, fontSize: 14, letterSpacing: 1, color: "#e8d9b8", background: "#2a1d15", border: "1px solid #7a6a4e" }}>
            ▲ FIRE
          </button>
          <button data-mech-reissue onClick={() => window.__MECHRANGE__ && window.__MECHRANGE__.reissue()}
            style={{ position: "absolute", right: 14, top: 90, padding: "12px 16px", fontFamily: FONT, fontSize: 13, letterSpacing: 1, color: "#c7d0dc", background: "#1a212b", border: "1px solid #5f6e80" }}>
            ⟲ REISSUE
          </button>
          <button data-mech-exit onClick={onExit}
            style={{ position: "absolute", right: 14, top: 144, padding: "12px 16px", fontFamily: FONT, fontSize: 13, letterSpacing: 1, color: "#c7d0dc", background: "#1a212b", border: "1px solid #444c58" }}>
            ⏏ MENU
          </button>
        </>
      )}
    </div>
  );
}
