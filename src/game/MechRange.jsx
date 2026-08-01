// MECH TEST RANGE — the walker's first visible surface. Flat proving pad,
// one biped frame, drive commands. Deliberately spare: this exists so the
// gait bring-up is WATCHABLE on the page while the march gate is WIP.
// The machine stands, weight-shifts, steps — and still falls; R reissues it.
import React, { useEffect, useRef, useState } from "react";
import { makeWorld, makeField, stepWorld, addBody, fireProjectile } from "../engine/core.js";
import { buildMech, mechCommand, respawnMech, mechFallen, mechFire, mechPunt, mechPoise, mechMissiles, mechAimDir } from "../engine/mech.js";
import { makeRenderer } from "../render/renderer.js";
import { detectTouch } from "./runner/trials.js";
import { BUILDERS } from "./scenario.js";
import { COLORS, FONT } from "../ui/theme.js";

export default function MechRange({ onExit }) {
  const canvasRef = useRef(null);
  const knobRef = useRef(null);
  const rngThumbRef = useRef(null);
  const rngLabelRef = useRef(null);
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
    // HOSTILE TANKS: real vehicles on the engine's tread physics + goal AI
    // (stepDrive runs anything with .squad). The range feeds goals (standoff
    // orbit around the mech) and gunnery; their shells carry mass and shove.
    const tanks = [];
    for (const [tx, tz] of [[-24, -10], [22, 32]]) {
      const t = addBody(world, { kind: "vehicle", team: 2, group: "tankPlat", mass: 3400, hx: 1.5, hy: 0.8, hz: 2.4, x: tx, y: 1.8, z: tz, hp: 170, friction: 0.85 });
      t.squad = "tankPlat";
      t.driverSpec = { throttleHabit: 0.5 };
      tanks.push(t);
    }
    const R = makeRenderer(canvasRef.current, world, { town: false });

    const S = { acc: 0, last: performance.now(), keys: {}, yawT: 0, aimYaw: null, aimRange: 26, aiT: 0, orbit: 0, tankFire: [2.5, 5.2], raf: 0, hudT: 0, dead: false, joyId: null, jx: 0, jy: 0, rngId: null, turnHeld: 0, fireHeld: false };
    window.__MECHRANGE__ = {
      world, mech,
      reissue: () => { respawnMech(world, mech, 0, 0, 0); S.yawT = 0; S.aimYaw = null; mech.aimYaw = null; S.turnHeld = 0; mechCommand(mech, { travel: 0, lateral: 0, heading: 0 }); },
      turn: (dir) => { S.turnHeld = dir; },
      fireHeld: (v) => { S.fireHeld = v; },
      fire: () => mechFire(world, mech),
      punt: () => mechPunt(world, mech),
      poise: () => mechPoise(world, mech, "L"),
      missiles: () => mechMissiles(world, mech),
    };
    const joyBase = () => ({ x: 86, y: window.innerHeight - 130 });
    const onPD = (e) => {
      if (e.target.closest && e.target.closest("button")) return;
      if (e.pointerType === "mouse") { S.fireHeld = true; return; } // desktop: click = fire
      const c = joyBase();
      if (S.joyId == null && Math.hypot(e.clientX - c.x, e.clientY - c.y) < 110) S.joyId = e.pointerId;
    };
    const sliderY = (clientY) => {
      // vertical slider along the right edge: bottom = 6m, top = 80m
      const hgt = 170, top = window.innerHeight - 336; // above the PUNT/FIRE stack
      const t = Math.max(0, Math.min(1, (top + hgt - clientY) / hgt));
      S.aimRange = 6 + t * 74;
      if (rngThumbRef.current) rngThumbRef.current.style.top = top + hgt - t * hgt - 12 + "px";
      if (rngLabelRef.current) rngLabelRef.current.textContent = Math.round(S.aimRange) + "m";
    };
    window.__MECHRANGE__.sliderY = sliderY;
    window.__MECHRANGE__.grabRange = (id, y) => { S.rngId = id; sliderY(y); };
    const onPM = (e) => {
      if (e.pointerType === "mouse") {
        // camera yaw is fixed in the range: screen offset from centre maps
        // straight to a world aim heading, and DISTANCE from centre maps to
        // shot range (near the mech = close shots, screen edge = far)
        const dx = e.clientX - window.innerWidth / 2, dy = e.clientY - window.innerHeight / 2;
        const m = Math.hypot(dx, dy);
        if (m > 30) {
          S.aimYaw = Math.atan2(dx, -dy);
          const span = Math.min(window.innerWidth, window.innerHeight) / 2;
          S.aimRange = 6 + Math.min(1, m / span) * 74;
        }
        return;
      }
      if (e.pointerId === S.joyId) {
        const c = joyBase();
        S.jx = Math.max(-1, Math.min(1, (e.clientX - c.x) / 44));
        S.jy = Math.max(-1, Math.min(1, (e.clientY - c.y) / 44));
        if (knobRef.current) { knobRef.current.style.left = c.x - 20 + S.jx * 34 + "px"; knobRef.current.style.top = c.y - 20 + S.jy * 34 + "px"; }
      } else if (e.pointerId === S.rngId) {
        sliderY(e.clientY);
      }
    };
    const onPU = (e) => {
      if (e.pointerType === "mouse") { S.fireHeld = false; return; }
      if (e.pointerId === S.joyId) {
        S.joyId = null; S.jx = 0; S.jy = 0;
        const c = joyBase();
        if (knobRef.current) { knobRef.current.style.left = c.x - 20 + "px"; knobRef.current.style.top = c.y - 20 + "px"; }
      } else if (e.pointerId === S.rngId) {
        S.rngId = null; // range HOLDS where you left it
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
      if (e.code === "KeyX") { mechPoise(world, mech, "L"); }
      if (e.code === "KeyV") { mechMissiles(world, mech); }
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
      let tf = S.keys.KeyW ? 0.42 : S.keys.KeyS ? -0.18 : 0;
      let tl = S.keys.KeyQ ? 0.22 : S.keys.KeyE ? -0.22 : 0;
      if (S.joyId != null) {
        if (Math.abs(S.jy) > 0.12) tf = S.jy < 0 ? 0.42 * -S.jy : -0.18 * S.jy;
        if (Math.abs(S.jx) > 0.12) tl = -0.22 * S.jx;
      }
      if (S.keys.KeyA) S.yawT += 0.7 * dt;
      if (S.keys.KeyD) S.yawT -= 0.7 * dt;
      if (S.turnHeld) S.yawT += S.turnHeld * 0.7 * dt;
      // steering lock: the heading COMMAND may lead the actual body by at
      // most 0.5 rad. Unbounded lead (chassis-follow wound to 3.7 rad for a
      // 1.6 rad aim) forced max-rate turning long after the stick released.
      {
        const yawNow = Math.atan2(mech.hull.R[6], mech.hull.R[8]);
        let lead = S.yawT - yawNow;
        while (lead > Math.PI) lead -= 2 * Math.PI;
        while (lead < -Math.PI) lead += 2 * Math.PI;
        S.yawT = yawNow + Math.max(-0.5, Math.min(0.5, lead));
      }
      // touch: NO aim stick (design 2026-08-01) — the BODY aims. Turn with
      // the arrows, set distance on the slider, fire. Torso follows the
      // frame (aimYaw null). Desktop keeps mouse aim.
      mech.aimYaw = S.aimYaw;
      mech.aimRange = S.aimRange;
      // chassis-follow ONLY while moving: turning works well inside the
      // gait, but auto-dragging a PARKED mech through a sustained in-place
      // turn is its weakest maneuver — invisible to the player until it
      // fell. Stationary aim holds at the waist stop; turn with A/D or by
      // walking. Rate = actual machine capability, not 5x it.
      if (mech.waist && Math.abs(mech.waist.target) > 0.6 * 0.87 && Math.hypot(tf, tl) > 0.05)
        S.yawT += Math.sign(mech.waist.target) * 0.12 * dt;
      mechCommand(mech, { travel: tf, lateral: tl, heading: S.yawT });
      if (S.keys.Space || S.keys.KeyF || S.fireHeld) mechFire(world, mech); // rate-limited inside
      // tank platoon AI: standoff orbit + gunnery
      const mh = mech.hull;
      S.aiT += dt;
      if (S.aiT > 0.3) {
        S.aiT = 0;
        S.orbit += 0.045;
        for (let ti = 0; ti < tanks.length; ti++) {
          const t = tanks[ti];
          if (!t.alive) continue;
          const dx = t.pos.x - mh.pos.x, dz = t.pos.z - mh.pos.z;
          const d = Math.max(1, Math.hypot(dx, dz));
          const ang = Math.atan2(dx, dz) + S.orbit * 0 + 0; // ring point on the tank's current bearing
          const ring = 26;
          const oa = ang + Math.sin(S.orbit + ti * 2.1) * 0.5; // weave along the ring
          t.goal = { x: mh.pos.x + Math.sin(oa) * ring, z: mh.pos.z + Math.cos(oa) * ring };
        }
      }
      for (let ti = 0; ti < tanks.length; ti++) {
        const t = tanks[ti];
        if (!t.alive) continue;
        S.tankFire[ti] -= dt;
        const dx = mh.pos.x - t.pos.x, dz = mh.pos.z - t.pos.z;
        const d = Math.hypot(dx, dz);
        if (S.tankFire[ti] <= 0 && d > 14 && d < 55 && t.R[4] > 0.7) {
          S.tankFire[ti] = 4.6 + ti * 1.3;
          const tf = d / 95; // flight time
          const aim = { x: mh.pos.x + mh.v.x * tf - t.pos.x, y: mh.pos.y - (t.pos.y + 1.3) + 0.5 * 9.81 * tf * tf, z: mh.pos.z + mh.v.z * tf - t.pos.z };
          const n = Math.hypot(aim.x, aim.y, aim.z);
          const dir = { x: aim.x / n, y: aim.y / n, z: aim.z / n };
          const muzzle = { x: t.pos.x + dir.x * 2.8, y: t.pos.y + 1.3, z: t.pos.z + dir.z * 2.8 };
          fireProjectile(world, muzzle, dir, 95, { kind: "shell", pmass: 30, r: 2.0, kv: 14, dmg: 55, crater: 0.35, attacker: "world", owner: t.id });
          t.v.x -= dir.x * (30 * 95) / t.mass; t.v.z -= dir.z * (30 * 95) / t.mass;
        }
      }
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
        const { muzzle, dir } = mechAimDir(world, mech);
        const pts = [];
        let px = muzzle.x, py = muzzle.y, pz = muzzle.z;
        let vx = dir.x * 120, vy = dir.y * 120, vz = dir.z * 120;
        let hitIdx = -1;
        const st2 = ((mech.aimRange || 26) / 120) / 14; // ~14 samples to the commanded range at any distance
        for (let k2 = 0; k2 < 22; k2++) {
          pts.push({ x: px, y: py, z: pz });
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
    <div style={{ position: "fixed", inset: 0, background: "#000", touchAction: "none", userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none" }}>
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
      <div data-mech-hud style={{ position: "absolute", top: 10, left: 12, color: "#c7d0dc", pointerEvents: "none" }}>
        <p style={{ ...line, color: COLORS.gold, fontSize: 14, letterSpacing: 2 }}>MECH TEST RANGE</p>
        <p style={line}>BIPED FRAME MK1 — GAIT ACCEPTANCE PENDING</p>
        <p style={line}>{isTouch ? "left stick moves · ◀ ▶ turn · slider sets range · FIRE" : "W/S walk · A/D turn · MOUSE aims · CLICK fire · V missiles · C punt · X one-leg · R reissue"}</p>
        <p data-mech-status style={line}>
          {hud.mode === "FALLEN" ? "FRAME DOWN — R TO REISSUE" : hud.mode} · steps {hud.steps} · falls {hud.falls} · kills {hud.kills} · shots {hud.shots}
        </p>
      </div>
      {isTouch && (
        <>
          <div style={{ position: "absolute", left: 86 - 55, bottom: 130 - 55, width: 110, height: 110, borderRadius: 60, border: "1px solid #5f6e80", opacity: 0.55 }} />
          <div ref={knobRef} style={{ position: "absolute", left: 86 - 20, top: "calc(100% - 150px)", width: 40, height: 40, borderRadius: 22, background: "#5f6e80", opacity: 0.8 }} />
          <div data-mech-rangeslider
            onPointerDown={(e) => { e.stopPropagation(); const m = window.__MECHRANGE__; if (m) m.grabRange(e.pointerId, e.clientY); }}
            style={{ position: "absolute", right: 12, bottom: 166, width: 44, height: 170, borderRadius: 8, background: "rgba(28,33,41,0.75)", border: "1px solid #7a6a4e", touchAction: "none" }}>
            <div style={{ position: "absolute", left: 20, top: 6, bottom: 6, width: 3, background: "#5f6e80" }} />
          </div>
          <div ref={rngThumbRef} style={{ position: "absolute", right: 8, top: "calc(100% - 224px)", width: 52, height: 24, borderRadius: 6, background: "#b89a5e", pointerEvents: "none" }} />
          <div ref={rngLabelRef} style={{ position: "absolute", right: 8, bottom: 340, width: 52, textAlign: "center", color: "#e8d9b8", fontFamily: FONT, fontSize: 13, textShadow: "0 1px 2px #000" }}>26m</div>
          <button data-mech-turnl
            onPointerDown={(e) => { e.stopPropagation(); const m = window.__MECHRANGE__; if (m) m.turn(1); }}
            onPointerUp={(e) => { e.stopPropagation(); const m = window.__MECHRANGE__; if (m) m.turn(0); }}
            onPointerLeave={() => { const m = window.__MECHRANGE__; if (m) m.turn(0); }}
            onPointerCancel={() => { const m = window.__MECHRANGE__; if (m) m.turn(0); }}
            style={{ position: "absolute", left: "calc(50% - 100px)", bottom: 16, width: 72, height: 62, fontFamily: FONT, fontSize: 22, color: "#c7d0dc", background: "rgba(26,33,43,0.85)", border: "1px solid #444c58", touchAction: "none" }}>
            {"\u25C0\uFE0E"}
          </button>
          <button data-mech-turnr
            onPointerDown={(e) => { e.stopPropagation(); const m = window.__MECHRANGE__; if (m) m.turn(-1); }}
            onPointerUp={(e) => { e.stopPropagation(); const m = window.__MECHRANGE__; if (m) m.turn(0); }}
            onPointerLeave={() => { const m = window.__MECHRANGE__; if (m) m.turn(0); }}
            onPointerCancel={() => { const m = window.__MECHRANGE__; if (m) m.turn(0); }}
            style={{ position: "absolute", left: "calc(50% + 4px)", bottom: 16, width: 72, height: 62, fontFamily: FONT, fontSize: 22, color: "#c7d0dc", background: "rgba(26,33,43,0.85)", border: "1px solid #444c58", touchAction: "none" }}>
            {"\u25B6\uFE0E"}
          </button>
          <button data-mech-fire
            onPointerDown={(e) => { e.stopPropagation(); const m = window.__MECHRANGE__; if (m) m.fireHeld(true); }}
            onPointerUp={(e) => { e.stopPropagation(); const m = window.__MECHRANGE__; if (m) m.fireHeld(false); }}
            onPointerCancel={(e) => { e.stopPropagation(); const m = window.__MECHRANGE__; if (m) m.fireHeld(false); }}
            style={{ position: "absolute", right: 12, bottom: 16, width: 96, height: 70, fontFamily: FONT, fontSize: 15, letterSpacing: 1, color: "#e8d9b8", background: "rgba(42,29,21,0.9)", border: "1px solid #7a6a4e", touchAction: "none" }}>
            {"\u25B2\uFE0E"} FIRE
          </button>
          <button data-mech-msl onPointerDown={(e) => { e.stopPropagation(); const m = window.__MECHRANGE__; if (m) m.missiles(); }}
            style={{ position: "absolute", right: 116, bottom: 164, width: 92, height: 56, fontFamily: FONT, fontSize: 13, letterSpacing: 1, color: "#e8c9b8", background: "rgba(46,29,21,0.9)", border: "1px solid #7a5e4e", touchAction: "none" }}>
            ▲▲ MSL
          </button>
          <button data-mech-poise onPointerDown={(e) => { e.stopPropagation(); const m = window.__MECHRANGE__; if (m) m.poise(); }}
            style={{ position: "absolute", right: 116, bottom: 94, width: 92, height: 62, fontFamily: FONT, fontSize: 13, letterSpacing: 1, color: "#c7d0dc", background: "rgba(29,37,49,0.9)", border: "1px solid #5f6e80", touchAction: "none" }}>
            ONE LEG
          </button>
          <button data-mech-punt onPointerDown={(e) => { e.stopPropagation(); const m = window.__MECHRANGE__; if (m) m.punt(); }}
            style={{ position: "absolute", right: 12, bottom: 94, width: 96, height: 62, fontFamily: FONT, fontSize: 14, letterSpacing: 1, color: "#c7d0dc", background: "rgba(29,37,49,0.9)", border: "1px solid #5f6e80", touchAction: "none" }}>
            PUNT
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
