// MECH TEST RANGE — the walker's first visible surface. Flat proving pad,
// one biped frame, drive commands. Deliberately spare: this exists so the
// gait bring-up is WATCHABLE on the page while the march gate is WIP.
// The machine stands, weight-shifts, steps — and still falls; R reissues it.
import React, { useEffect, useRef, useState } from "react";
import { makeWorld, makeField, stepWorld, addBody, fireProjectile } from "../engine/core.js";
import { buildMech, mechCommand, respawnMech, mechFallen, mechFire, mechPunt, mechPoise, mechMissiles, mechAboutFace, mechAimDir } from "../engine/mech.js";
import { makeRenderer } from "../render/renderer.js";
import { detectTouch } from "./runner/trials.js";
import { BUILDERS } from "./scenario.js";
import { COLORS, FONT } from "../ui/theme.js";

export default function MechRange({ onExit }) {
  const canvasRef = useRef(null);
  const knobRef = useRef(null);
  const rsKnobRef = useRef(null);
  const rngThumbRef = useRef(null);
  const rngLabelRef = useRef(null);
  const isTouch = detectTouch();
  const [hud, setHud] = useState({ mode: "STAND", steps: 0, falls: 0, kills: 0, shots: 0 });
  // portrait phones have no room for a 3-wide action row between the stick
  // rings — stack it on the left edge instead; re-render on rotation
  const [winW, setWinW] = useState(window.innerWidth);
  useEffect(() => {
    const onRs = () => setWinW(window.innerWidth);
    window.addEventListener("resize", onRs);
    return () => window.removeEventListener("resize", onRs);
  }, []);
  const narrow = winW < 560;
  useEffect(() => {
    const field = makeField(64, 1.7, 5);
    field.h.fill(0);
    const world = makeWorld({ field, seed: 5 });
    // OUTPOST scenario (design 2026-08-01): the mech starts FAR from a
    // garrison that does not know it exists. Walk in, open fire, or blunder
    // inside their picket line — any of those wakes them up.
    const OUTPOST = { x: 0, z: 40 };
    const mech = buildMech(world, { x: 0, z: -42 });
    const pg = { covers: [], shelters: [], wallIndex: 0 };
    BUILDERS.house(world, field, pg, { x: -10, z: 38, nx: 5, nz: 4, doorIx: 0, group: "rangeA" });
    BUILDERS.house(world, field, pg, { x: 9, z: 34, nx: 4, nz: 5, doorIx: 1, group: "rangeB" });
    BUILDERS.house(world, field, pg, { x: -1, z: 47, nx: 6, nz: 4, doorIx: 0, group: "rangeC" });
    BUILDERS.hangar(world, field, pg, { x: 16, z: 44, group: "rangeH" });
    for (const b of world.bodies) if (b.kind === "chunk") { b.sleeping = true; b.sleepT = 1; }
    // the garrison: a rifle squad on the street, scouts + truck parked —
    // mass, hp, and the full damage pipeline (shell, blast, CRUSH attribute)
    const hostiles = [];
    for (let i = 0; i < 5; i++) hostiles.push(addBody(world, { kind: "unit", team: 2, group: "tgtSquad", mass: 82, hx: 0.26, hy: 0.9, hz: 0.26, x: -5 + i * 2.1, y: 1.9, z: 41 + (i % 2) * 2, hp: 30, friction: 0.55 }));
    hostiles.push(addBody(world, { kind: "vehicle", team: 2, group: "tgtScout", mass: 950, hx: 1.25, hy: 0.7, hz: 1.85, x: 5, y: 1.7, z: 39, hp: 55, friction: 0.7 }));
    hostiles.push(addBody(world, { kind: "vehicle", team: 2, group: "tgtScout", mass: 950, hx: 1.25, hy: 0.7, hz: 1.85, x: -8, y: 1.7, z: 43, hp: 55, friction: 0.7 }));
    hostiles.push(addBody(world, { kind: "truck", team: 2, group: "tgtTruck", vtype: "truck", mass: 1400, hx: 1.15, hy: 1.05, hz: 2.6, x: 4, y: 2.05, z: 50, hp: 120, friction: 0.6 }));
    // GARRISON TANKS: parked at the outpost until the alarm — then the
    // engine's own tread physics + goal AI (stepDrive) hunts the mech.
    const tanks = [];
    for (const [tx, tz] of [[-14, 36], [13, 52]]) {
      const t = addBody(world, { kind: "vehicle", team: 2, group: "tankPlat", mass: 3400, hx: 1.5, hy: 0.8, hz: 2.4, x: tx, y: 1.8, z: tz, hp: 170, friction: 0.85 });
      t.squad = "tankPlat";
      t.driverSpec = { throttleHabit: 0.5 };
      tanks.push(t); hostiles.push(t);
    }
    for (const h of hostiles) h._hp0 = h.hp;
    const R = makeRenderer(canvasRef.current, world, { town: false });

    const S = { acc: 0, last: performance.now(), keys: {}, yawT: 0, aimYaw: null, aimRange: 26, aimOff: 0, aiT: 0, orbit: 0, tankFire: [2.5, 5.2], raf: 0, hudT: 0, dead: false, joyId: null, jx: 0, jy: 0, rsId: null, rx: 0, rngId: null, aimHeld: 0, fireHeld: false };
    window.__MECHRANGE__ = {
      world, mech,
      reissue: () => { respawnMech(world, mech, 0, -42, 0); S.yawT = 0; S.aimYaw = null; mech.aimYaw = null; S.aimOff = 0; S.aimHeld = 0; S.rx = 0; mechCommand(mech, { travel: 0, lateral: 0, heading: 0 }); },
      aim: (dir) => { S.aimHeld = dir; },
      fireHeld: (v) => { S.fireHeld = v; },
      fire: () => mechFire(world, mech),
      punt: () => mechPunt(world, mech),
      poise: () => mechPoise(world, mech, "L"),
      missiles: () => mechMissiles(world, mech),
      about: () => mechAboutFace(world, mech),
    };
    const joyBase = () => ({ x: 86, y: window.innerHeight - 130 });
    const rsBase = () => ({ x: window.innerWidth - 86, y: window.innerHeight - 130 });
    const onPD = (e) => {
      if (e.target.closest && e.target.closest("button")) return;
      if (e.pointerType === "mouse") { S.fireHeld = true; return; } // desktop: click = fire
      const c = joyBase(), a = rsBase();
      if (S.joyId == null && Math.hypot(e.clientX - c.x, e.clientY - c.y) < 110) S.joyId = e.pointerId;
      else if (S.rsId == null && Math.hypot(e.clientX - a.x, e.clientY - a.y) < 110) S.rsId = e.pointerId;
    };
    const sliderY = (clientY) => {
      // vertical slider along the right edge: bottom = 6m, top = 80m
      const hgt = 150, top = window.innerHeight - 350; // above the right (turn) stick
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
      } else if (e.pointerId === S.rsId) {
        const a = rsBase();
        S.rx = Math.max(-1, Math.min(1, (e.clientX - a.x) / 44));
        if (rsKnobRef.current) { rsKnobRef.current.style.left = a.x - 20 + S.rx * 34 + "px"; rsKnobRef.current.style.top = a.y - 20 + "px"; }
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
      } else if (e.pointerId === S.rsId) {
        S.rsId = null; S.rx = 0;
        const a = rsBase();
        if (rsKnobRef.current) { rsKnobRef.current.style.left = a.x - 20 + "px"; rsKnobRef.current.style.top = a.y - 20 + "px"; }
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
      if (e.code === "KeyT") { mechAboutFace(world, mech); }
      if (e.code === "KeyR") {
        respawnMech(world, mech, 0, -42, 0);
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
      // §0b (rev 2026-08-01): LEFT stick = travel vector (strafe, never
      // rotates); RIGHT stick = body TURN rate; cannon has its OWN controls
      // (◀ ▶ turret slew + range slider). Keyboard follows the HOUSE
      // convention (every mode steers on A/D); Q/E strafe; mouse aims.
      let tf = S.keys.KeyW ? 0.42 : S.keys.KeyS ? -0.18 : 0;
      let tl = S.keys.KeyQ ? 0.22 : S.keys.KeyE ? -0.22 : 0;
      if (S.joyId != null) {
        if (Math.abs(S.jy) > 0.12) tf = S.jy < 0 ? 0.42 * -S.jy : -0.18 * S.jy;
        if (Math.abs(S.jx) > 0.12) tl = -0.22 * S.jx;
      }
      if (S.keys.KeyA) S.yawT += 0.7 * dt;
      if (S.keys.KeyD) S.yawT -= 0.7 * dt;
      // RIGHT stick = TURN (design 2026-08-01: cannon controls independent
      // of turning). Horizontal deflection is a turn-RATE command feeding
      // the same steering-locked heading target as A/D — the stick cannot
      // wind up a lead the machine can't follow.
      if (Math.abs(S.rx) > 0.15) S.yawT -= S.rx * 0.9 * dt;
      // steering lock: the heading COMMAND may lead the actual body by at
      // most 0.5 rad. Unbounded lead (chassis-follow wound to 3.7 rad for a
      // 1.6 rad aim) forced max-rate turning long after the stick released.
      const yawNow = Math.atan2(mech.hull.R[6], mech.hull.R[8]);
      {
        let lead = S.yawT - yawNow;
        while (lead > Math.PI) lead -= 2 * Math.PI;
        while (lead < -Math.PI) lead += 2 * Math.PI;
        S.yawT = yawNow + Math.max(-0.5, Math.min(0.5, lead));
      }
      // touch cannon = TURRET: ◀ ▶ slew a body-relative aim offset (clamped
      // inside the waist's reach so the reticle never promises a bearing the
      // torso can't hold), slider sets range. Turning the body sweeps the
      // reticle with it; the arrows trim on top. Desktop keeps mouse aim.
      if (isTouch) {
        if (S.aimHeld) S.aimOff = Math.max(-0.85, Math.min(0.85, S.aimOff + S.aimHeld * 0.9 * dt));
        mech.aimYaw = yawNow + S.aimOff;
      } else mech.aimYaw = S.aimYaw;
      mech.aimRange = S.aimRange;
      // chassis-follow ONLY while moving: turning works well inside the
      // gait, but auto-dragging a PARKED mech through a sustained in-place
      // turn is its weakest maneuver — invisible to the player until it
      // fell. Stationary aim holds at the waist stop; turn with A/D or by
      // walking. Rate = actual machine capability, not 5x it.
      if (mech.waist && Math.abs(mech.waist.target) > 0.6 * 0.87 && Math.hypot(tf, tl) > 0.05)
        S.yawT += Math.sign(mech.waist.target) * 0.12 * dt;
      // about-face owns the heading while it runs — writing S.yawT every
      // frame would overwrite the 180 target the maneuver is executing
      mechCommand(mech, { travel: tf, lateral: tl, heading: mech.state.aboutFace ? null : S.yawT });
      if (S.keys.Space || S.keys.KeyF || S.fireHeld) mechFire(world, mech); // rate-limited inside
      // awareness: the garrison wakes on proximity (inside the picket),
      // on ANY weapon discharge within earshot, or on taking damage
      const mh = mech.hull;
      S.aiT += dt;
      if (S.aiT > 0.3) {
        S.aiT = 0;
        if (!S.alert) {
          const dOut = Math.hypot(mh.pos.x - OUTPOST.x, mh.pos.z - OUTPOST.z);
          const fired = (mech.telem.shots || 0) + (mech.telem.salvos || 0) > 0;
          const hurt = hostiles.some((h) => !h.alive || h.hp < h._hp0);
          if (dOut < 42 || (fired && dOut < 90) || hurt) S.alert = true;
        }
      }
      // tank platoon AI: standoff orbit + gunnery — only once ALERTED
      S.aiT2 = (S.aiT2 || 0) + dt;
      if (S.aiT2 > 0.3 && S.alert) {
        S.aiT2 = 0;
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
      for (let ti = 0; ti < tanks.length && S.alert; ti++) {
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
        setHud({ mode: mech.state.mode, steps: mech.telem.steps, falls: mech.telem.falls, kills: world.killCount, shots: mech.telem.shots || 0, alert: S.alert });
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
        <p style={line}>{isTouch ? "L stick moves · R stick turns · ◀ ▶ aim cannon · slider range" : "W/S walk · A/D turn · MOUSE aims · CLICK fire · V missiles · C punt · X one-leg · T 180 · R reissue"}</p>
        <p data-mech-status style={line}>
          {hud.mode === "FALLEN" ? "FRAME DOWN — R TO REISSUE" : hud.mode} · steps {hud.steps} · falls {hud.falls} · kills {hud.kills} · shots {hud.shots} · garrison {hud.alert ? "ALERTED" : "unaware"}
        </p>
      </div>
      <>
        {/* action buttons + REISSUE/MENU: every device — desktop had no
            on-screen buttons at all and the 180/PUNT surface was invisible */}
          <button data-mech-msl onPointerDown={(e) => { e.stopPropagation(); const m = window.__MECHRANGE__; if (m) m.missiles(); }}
            style={{ position: "absolute", ...(narrow ? { left: 12, bottom: 200 } : { left: "calc(50% + 5px)", bottom: 90 }), width: 88, height: 48, fontFamily: FONT, fontSize: 13, letterSpacing: 1, color: "#e8c9b8", background: "rgba(46,29,21,0.9)", border: "1px solid #7a5e4e", touchAction: "none" }}>
            ▲▲ MSL
          </button>
          <button data-mech-poise onPointerDown={(e) => { e.stopPropagation(); const m = window.__MECHRANGE__; if (m) m.poise(); }}
            style={{ position: "absolute", ...(narrow ? { left: 12, bottom: 252 } : { left: "calc(50% - 93px)", bottom: 90 }), width: 88, height: 48, fontFamily: FONT, fontSize: 13, letterSpacing: 1, color: "#c7d0dc", background: "rgba(29,37,49,0.9)", border: "1px solid #5f6e80", touchAction: "none" }}>
            ONE LEG
          </button>
          <button data-mech-about onPointerDown={(e) => { e.stopPropagation(); const m = window.__MECHRANGE__; if (m) m.about(); }}
            style={{ position: "absolute", ...(narrow ? { left: 12, bottom: 356 } : { left: "calc(50% + 103px)", bottom: 90 }), width: 88, height: 48, fontFamily: FONT, fontSize: 13, letterSpacing: 1, color: "#c7d0dc", background: "rgba(29,37,49,0.9)", border: "1px solid #5f6e80", touchAction: "none" }}>
            180
          </button>
          <button data-mech-punt onPointerDown={(e) => { e.stopPropagation(); const m = window.__MECHRANGE__; if (m) m.punt(); }}
            style={{ position: "absolute", ...(narrow ? { left: 12, bottom: 304 } : { left: "calc(50% - 191px)", bottom: 90 }), width: 88, height: 48, fontFamily: FONT, fontSize: 13, letterSpacing: 1, color: "#c7d0dc", background: "rgba(29,37,49,0.9)", border: "1px solid #5f6e80", touchAction: "none" }}>
            PUNT
          </button>
          <button data-mech-reissue onClick={() => window.__MECHRANGE__ && window.__MECHRANGE__.reissue()}
            style={{ position: "absolute", right: 70, top: 90, padding: "12px 16px", fontFamily: FONT, fontSize: 13, letterSpacing: 1, color: "#c7d0dc", background: "#1a212b", border: "1px solid #5f6e80" }}>
            ⟲ REISSUE
          </button>
          <button data-mech-exit onClick={onExit}
            style={{ position: "absolute", right: 70, top: 144, padding: "12px 16px", fontFamily: FONT, fontSize: 13, letterSpacing: 1, color: "#c7d0dc", background: "#1a212b", border: "1px solid #444c58" }}>
            ⏏ MENU
          </button>
      </>
      {isTouch && (
        <>
          {/* LEFT stick: travel */}
          <div style={{ position: "absolute", left: 86 - 55, bottom: 130 - 55, width: 110, height: 110, borderRadius: 60, border: "1px solid #5f6e80", opacity: 0.55 }} />
          <div ref={knobRef} style={{ position: "absolute", left: 86 - 20, top: "calc(100% - 150px)", width: 40, height: 40, borderRadius: 22, background: "#5f6e80", opacity: 0.8 }} />
          {/* RIGHT stick: body turn (horizontal axis) */}
          <div style={{ position: "absolute", right: 86 - 55, bottom: 130 - 55, width: 110, height: 110, borderRadius: 60, border: "1px solid #5f6e80", opacity: 0.55 }} />
          <div style={{ position: "absolute", right: 86 - 26, bottom: 130 + 62, width: 52, textAlign: "center", color: "#8fa0b4", fontFamily: FONT, fontSize: 11, letterSpacing: 1, pointerEvents: "none" }}>TURN</div>
          <div ref={rsKnobRef} style={{ position: "absolute", left: "calc(100% - 106px)", top: "calc(100% - 150px)", width: 40, height: 40, borderRadius: 22, background: "#5f6e80", opacity: 0.8 }} />
          {/* cannon range slider, right edge above the turn stick */}
          <div data-mech-rangeslider
            onPointerDown={(e) => { e.stopPropagation(); const m = window.__MECHRANGE__; if (m) m.grabRange(e.pointerId, e.clientY); }}
            style={{ position: "absolute", right: 12, bottom: 200, width: 44, height: 150, borderRadius: 8, background: "rgba(28,33,41,0.75)", border: "1px solid #7a6a4e", touchAction: "none" }}>
            <div style={{ position: "absolute", left: 20, top: 6, bottom: 6, width: 3, background: "#5f6e80" }} />
          </div>
          <div ref={rngThumbRef} style={{ position: "absolute", right: 8, top: "calc(100% - 253px)", width: 52, height: 24, borderRadius: 6, background: "#b89a5e", pointerEvents: "none" }} />
          <div ref={rngLabelRef} style={{ position: "absolute", right: 8, bottom: 354, width: 52, textAlign: "center", color: "#e8d9b8", fontFamily: FONT, fontSize: 13, textShadow: "0 1px 2px #000" }}>26m</div>
          {/* CANNON cluster, bottom centre: turret slew arrows with FIRE between */}
          <button data-mech-aiml
            onPointerDown={(e) => { e.stopPropagation(); const m = window.__MECHRANGE__; if (m) m.aim(1); }}
            onPointerUp={(e) => { e.stopPropagation(); const m = window.__MECHRANGE__; if (m) m.aim(0); }}
            onPointerLeave={() => { const m = window.__MECHRANGE__; if (m) m.aim(0); }}
            onPointerCancel={() => { const m = window.__MECHRANGE__; if (m) m.aim(0); }}
            style={{ position: "absolute", left: "calc(50% - 158px)", bottom: 16, width: 72, height: 62, fontFamily: FONT, fontSize: 22, color: "#e8d9b8", background: "rgba(42,29,21,0.9)", border: "1px solid #7a6a4e", touchAction: "none" }}>
            {"\u25C0\uFE0E"}
          </button>
          <button data-mech-aimr
            onPointerDown={(e) => { e.stopPropagation(); const m = window.__MECHRANGE__; if (m) m.aim(-1); }}
            onPointerUp={(e) => { e.stopPropagation(); const m = window.__MECHRANGE__; if (m) m.aim(0); }}
            onPointerLeave={() => { const m = window.__MECHRANGE__; if (m) m.aim(0); }}
            onPointerCancel={() => { const m = window.__MECHRANGE__; if (m) m.aim(0); }}
            style={{ position: "absolute", left: "calc(50% + 86px)", bottom: 16, width: 72, height: 62, fontFamily: FONT, fontSize: 22, color: "#e8d9b8", background: "rgba(42,29,21,0.9)", border: "1px solid #7a6a4e", touchAction: "none" }}>
            {"\u25B6\uFE0E"}
          </button>
          <button data-mech-fire
            onPointerDown={(e) => { e.stopPropagation(); const m = window.__MECHRANGE__; if (m) m.fireHeld(true); }}
            onPointerUp={(e) => { e.stopPropagation(); const m = window.__MECHRANGE__; if (m) m.fireHeld(false); }}
            onPointerCancel={(e) => { e.stopPropagation(); const m = window.__MECHRANGE__; if (m) m.fireHeld(false); }}
            style={{ position: "absolute", left: "calc(50% - 48px)", bottom: 16, width: 96, height: 70, fontFamily: FONT, fontSize: 15, letterSpacing: 1, color: "#e8d9b8", background: "rgba(42,29,21,0.9)", border: "1px solid #7a6a4e", touchAction: "none" }}>
            {"\u25B2\uFE0E"} FIRE
          </button>
        </>
      )}

    </div>
  );
}
