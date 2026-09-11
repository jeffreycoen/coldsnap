import React, { useEffect, useRef, useState } from "react";
import { MK } from "../version.js";
import { stepWorld, C30, S30 } from "./rubbleworlds/phys.js";
import { makeScenario, SCENES, SCENE_LABEL } from "./rubbleworlds/gen.js";
import { drawFrame } from "./rubbleworlds/draw.js";

// RUBBLE WORLDS — block planets under real gravity, a proving-range demo.
// The component keeps the loop, the chips, and the log; the physics lives
// in rubbleworlds/phys.js, the scenes in gen.js, the frame in draw.js.
export default function RubbleWorlds({ onExit }) {
  const cvs = useRef(null);
  const worldRef = useRef(null);
  const [ui, setUi] = useState({ kind: "binary", welds: true, sleep: true, seed: 0, fps: 0, awake: 0, asleep: 0, eaten: 0, weldsAlive: 0, copied: false });
  const ctl = useRef({ kind: "binary", welds: true, sleep: true, hash: false, friction: false, time: 1, size: 1, reset: 1 });
  const copyLog = () => {
    const data = worldRef.current && worldRef.current();
    if (!data) return;
    const text = JSON.stringify(data);
    const done = () => { setUi(u => ({ ...u, copied: true })); setTimeout(() => setUi(u => ({ ...u, copied: false })), 2000); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done).catch(() => {});
    else { const ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); done(); }
  };

  useEffect(() => {
    const c = cvs.current, ctx = c.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const resize = () => { c.width = window.innerWidth * dpr; c.height = window.innerHeight * dpr; c.style.width = window.innerWidth + "px"; c.style.height = window.innerHeight + "px"; };
    resize(); window.addEventListener("resize", resize);
    // drag pans the large playfield; a quick second tap recenters on the mass
    let panDrag = null, lastTap = 0;
    const pDown = (e) => {
      const p = e.touches ? e.touches[0] : e;
      const now = performance.now();
      if (now - lastTap < 300) { if (world) world.pan = null; lastTap = 0; panDrag = null; return; }
      lastTap = now;
      // in the ship scene, a drag AIMS while aiming or planning — the ark's gesture owns the touch
      if (world && world.ship && (world.shipPhase === "aim" || world.shipPhase === "plan")) {
        panDrag = { x: p.clientX, y: p.clientY, aim: true };
        return;
      }
      panDrag = { x: p.clientX, y: p.clientY };
    };
    const pMove = (e) => {
      if (!panDrag || !world) return;
      const p = e.touches ? e.touches[0] : e;
      if (panDrag.aim) {
        const dx = p.clientX - panDrag.x, dy = p.clientY - panDrag.y;
        const sc = world._sc || 1;
        const sdx = 0.5 * (dx / (0.866 * sc) + dy / (0.5 * sc)), sdz = 0.5 * (dy / (0.5 * sc) - dx / (0.866 * sc));
        const mag = Math.hypot(sdx, sdz) || 1;
        const cap = world.shipPhase === "plan" ? Math.min(65, world.ship.fuel) : Math.min(110, world.ship.fuel);
        const vel = Math.min(mag * 0.28, cap);
        world.shipAim = { on: vel > 1, vx: sdx / mag * vel, vz: sdz / mag * vel };
        e.preventDefault(); return;
      }
      const dx = p.clientX - panDrag.x, dy = p.clientY - panDrag.y;
      panDrag = { x: p.clientX, y: p.clientY, moved: (panDrag.moved || 0) + Math.abs(dx) + Math.abs(dy) };
      const sc = world._sc || 1;
      const sx = dx / (2 * C30 * sc), sy = dy / (2 * S30 * sc);
      const cur = world.pan || world._center || { x: 0, z: 0 };
      world.pan = { x: cur.x - (sx + sy), z: cur.z - (sy - sx) };
      e.preventDefault();
    };
    const pUp = () => {
      if (panDrag && world && world.ship && world.shipPhase === "fly" && (panDrag.moved || 0) < 10) world.shipPaused = !world.shipPaused;
      panDrag = null;
    };
    c.addEventListener("mousedown", pDown); window.addEventListener("mousemove", pMove); window.addEventListener("mouseup", pUp);
    c.addEventListener("touchstart", pDown, { passive: false }); c.addEventListener("touchmove", pMove, { passive: false });
    c.addEventListener("touchend", pUp); c.addEventListener("touchcancel", pUp);
    let world = null, seed = 0, lastReset = 0, anim, frame = 0, renderF = 0, tPrev = performance.now();
    worldRef.current = () => world && { seed, kind: ctl.current.kind, size: ctl.current.size, welds: ctl.current.welds, sleep: ctl.current.sleep, mk: MK, log: world.log };
    // the ark's two-mode burns, landing on the rigid hull as uniform delta-v
    burnRef.current = (what) => {
      if (!world || !world.ship) return;
      const aim = world.shipAim;
      if (what === "plan") { world.shipPhase = "plan"; world.shipPaused = false; world.shipAim = { on: false, vx: 0, vz: 0 }; return; }
      if (what === "turnL" || what === "turnR" || what === "less" || what === "more") {
        if (!aim || !aim.on) return;
        let ang = Math.atan2(aim.vz, aim.vx), mag = Math.hypot(aim.vx, aim.vz);
        if (what === "turnL") ang -= 0.03; if (what === "turnR") ang += 0.03;
        if (what === "less") mag = Math.max(2, mag - 3); if (what === "more") mag += 3;
        const cap = world.shipPhase === "plan" ? Math.min(65, world.ship.fuel) : Math.min(110, world.ship.fuel);
        mag = Math.min(mag, cap);
        world.shipAim = { on: true, vx: Math.cos(ang) * mag, vz: Math.sin(ang) * mag };
        return;
      }
      if (what === "cancel") { world.shipPhase = "fly"; world.shipAim = { on: false, vx: 0, vz: 0 }; return; }
      if (!aim || !aim.on) return;
      const cost = Math.hypot(aim.vx, aim.vz);
      if (cost > world.ship.fuel) return;
      world.ship.fuel -= cost;
      if (what === "exec") world.ship.burns++;
      for (const b of world.blocks) if (b.ship && b.alive) { b.vx += aim.vx; b.vz += aim.vz; }
      world.shipAim = { on: false, vx: 0, vz: 0 };
      world.shipPhase = "fly";
    };

    const loop = () => {
      const W = c.width / dpr, H = c.height / dpr, k = ctl.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (k.reset !== lastReset) {
        lastReset = k.reset; seed = Math.floor(Math.random() * 100000);
        world = makeScenario(k.kind, seed, k.size);
        setUi(u => ({ ...u, kind: k.kind, seed, eaten: 0 }));
      }
      let weldsAlive = 0;
      // time chips: 2x and 5x run the physics that many steps per rendered frame;
      // half speed steps every other frame — the render never changes cadence
      // the half-speed gate counts RENDERED frames — the old gate counted physics
      // steps, so the first skipped frame froze the counter and time stopped dead
      const reps = k.time >= 1 ? k.time : (renderF % 2 === 0 ? 1 : 0);
      renderF++;
      // the ship's live track (its clump row) and the ark's plan-freeze
      if (world.ship) {
        world.shipTrack = null;
        for (const tk of world.tracks || []) { for (const i2 of [0]) {} }
        for (const tk of world.tracks || []) { const b0 = world.blocks.find(b2 => b2.ship && b2.alive); if (b0 && tk.clump === b0.clump) { world.shipTrack = tk; break; } }
      }
      const planFrozen = world.ship && (world.shipPhase === "aim" || world.shipPhase === "plan" || (world.shipPaused && world.shipPhase === "fly")); // the ark holds the sky while you aim — time starts at LAUNCH
      const tPhys = performance.now();
      for (let rep = 0; rep < (planFrozen ? 0 : reps); rep++) weldsAlive = stepWorld(world, k);
      if (reps > 0) world.stepMs = +((performance.now() - tPhys) / reps).toFixed(2);

      drawFrame({ ctx, W, H, world, frame: world.frame });
      const wb = world.blocks, welds = world.welds;
      if (world.frame - (world._logF || 0) >= 60 || world._logF == null) { world._logF = world.frame;
        let awakeN = 0, asleepN = 0, weldsN = 0;
        for (const b of wb) { if (!b.alive) continue; if (b.sleeping) asleepN++; else awakeN++; }
        for (const w of welds) if (w.alive) weldsN++;
        world.log.push({ t: +world.t.toFixed(1), stepMs: world.stepMs || 0, hash: k.hash, friction: k.friction, awake: awakeN, asleep: asleepN, welds: weldsN, eaten: world.eaten,
          clumps: world.wells.filter(w => !w.deep).map(w => [Math.round(w.x), Math.round(w.z), Math.round(w.m)]) });
        if (world.log.length > 300) world.log.shift();
      }
      const tNow = performance.now(); const fps = Math.round(1000 / Math.max(tNow - tPrev, 1)); tPrev = tNow;
      if (renderF % 15 === 0) {
        let awake = 0, asleep = 0;
        for (const b of wb) { if (!b.alive) continue; if (b.sleeping) asleep++; else awake++; }
        setUi(u => ({ ...u, fps, stepMs: world.stepMs || 0, awake, asleep, eaten: world.eaten, weldsAlive, fuel: world.ship ? Math.round(world.ship.fuel) : null, phase: world.shipPhase || null }));
      }
      anim = requestAnimationFrame(loop);
    };
    anim = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(anim); window.removeEventListener("resize", resize); };
  }, []);

  const chip = (label, on, click) => (
    <div key={label} onClick={click} style={{ padding: "10px 14px", borderRadius: 12, background: on ? "rgba(60,90,160,.16)" : "rgba(245,244,240,.85)", border: `1.5px solid ${on ? "rgba(60,90,160,.4)" : "rgba(0,0,0,.08)"}`, cursor: "pointer", userSelect: "none", WebkitUserSelect: "none", touchAction: "none", fontSize: 11, fontWeight: 700, letterSpacing: 1.2, color: on ? "rgba(40,60,120,.85)" : "rgba(0,0,0,.45)" }}>{label}</div>
  );
  const set = (fn) => { fn(ctl.current); ctl.current.reset++; setUi(u => ({ ...u })); };
  const burnRef = useRef(null);
  const fireBurn = (what) => { if (burnRef.current) burnRef.current(what); };
  const setLive = (fn) => { fn(ctl.current); setUi(u => ({ ...u })); };

  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden", background: "#f5f4f0", fontFamily: "-apple-system,'SF Pro Display',sans-serif", userSelect: "none", WebkitUserSelect: "none" }}>
      <canvas ref={cvs} style={{ display: "block", touchAction: "none" }} />
      <div style={{ position: "absolute", top: 14, left: 14, background: "rgba(245,244,240,.85)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderRadius: 14, padding: "10px 16px", border: "1px solid rgba(0,0,0,.06)" }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.8, color: "rgba(0,0,0,.5)" }}>RUBBLE WORLDS</div>
        <div style={{ fontSize: 11, fontWeight: 500, color: "rgba(0,0,0,.45)", marginTop: 4 }}>seed {ui.seed} · {ui.fps}fps · {ui.stepMs || 0}ms/step{ui.fuel != null ? ` · fuel ${ui.fuel}` : ""}</div>
        <div style={{ fontSize: 11, fontWeight: 500, color: "rgba(0,0,0,.45)", marginTop: 2 }}>{ui.awake} awake · {ui.asleep} asleep · welds {ui.weldsAlive}{ui.kind === "hole" ? ` · eaten ${ui.eaten}` : ""}</div>
      </div>
      {onExit && <div onClick={onExit} style={{ position: "absolute", top: 14, right: 14, background: "rgba(245,244,240,.85)", borderRadius: 10, padding: "8px 12px", border: "1px solid rgba(0,0,0,.06)", cursor: "pointer", userSelect: "none", touchAction: "none", fontSize: 10, fontWeight: 600, letterSpacing: 1, color: "rgba(0,0,0,.45)" }}>⏏ MENU</div>}
      <div style={{ position: "absolute", bottom: 20, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "0 12px" }}>
        {!(ui.phase === "aim" || ui.phase === "plan") && <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
          {SCENES.map(sn => chip(SCENE_LABEL[sn], ui.kind === sn, () => set(k => { k.kind = sn; })))}
        </div>}
        <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
          {!(ui.phase === "aim" || ui.phase === "plan") && [1, 2, 5].map(sz => chip("SIZE " + sz + "x", ctl.current.size === sz, () => set(k => { k.size = sz; })))}
          {[0.5, 1, 2, 5].map(tm => chip(tm === 0.5 ? "×½" : "×" + tm, ctl.current.time === tm, () => setLive(k => { k.time = tm; })))}
          {chip(`WELDS ${ctl.current.welds ? "ON" : "OFF"}`, ctl.current.welds, () => setLive(k => { k.welds = !k.welds; }))}
          {chip(`SLEEP ${ctl.current.sleep ? "ON" : "OFF"}`, ctl.current.sleep, () => setLive(k => { k.sleep = !k.sleep; }))}
          {chip(`HASH ${ctl.current.hash ? "ON" : "OFF"}`, ctl.current.hash, () => setLive(k => { k.hash = !k.hash; }))}
          {chip(`FRICTION ${ctl.current.friction ? "ON" : "OFF"}`, ctl.current.friction, () => setLive(k => { k.friction = !k.friction; }))}
          {chip(ui.copied ? "COPIED" : "⊕ LOG", ui.copied, copyLog)}
          {chip("RESET", false, () => set(() => {}))}
          {(ui.phase === "aim" || ui.phase === "plan") && chip("\u25c0", false, () => fireBurn("turnL"))}
          {(ui.phase === "aim" || ui.phase === "plan") && chip("\u2212", false, () => fireBurn("less"))}
          {(ui.phase === "aim" || ui.phase === "plan") && chip("+", false, () => fireBurn("more"))}
          {(ui.phase === "aim" || ui.phase === "plan") && chip("\u25b6", false, () => fireBurn("turnR"))}
          {ui.phase === "aim" && chip("LAUNCH", true, () => fireBurn("launch"))}
          {ui.phase === "fly" && chip("PLAN BURN", false, () => fireBurn("plan"))}
          {ui.phase === "plan" && chip("EXECUTE", true, () => fireBurn("exec"))}
          {ui.phase === "plan" && chip("CANCEL", false, () => fireBurn("cancel"))}
        </div>
      </div>
    </div>
  );
}
