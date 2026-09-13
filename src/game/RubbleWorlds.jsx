import React, { useEffect, useRef, useState } from "react";
import { MK } from "../version.js";
import { stepWorld, predictShip, shipConn, C30, S30 } from "./rubbleworlds/phys.js";
import { makeScenario, SCENES, SCENE_LABEL, HULL_LIST, HULL_LABEL } from "./rubbleworlds/gen.js";
import { drawFrame } from "./rubbleworlds/draw.js";

// RUBBLE WORLDS — block planets under real gravity, a proving-range demo.
// The component keeps the loop, the chips, and the log; the physics lives
// in rubbleworlds/phys.js, the scenes in gen.js, the frame in draw.js.
export default function RubbleWorlds({ onExit }) {
  const cvs = useRef(null);
  const worldRef = useRef(null);
  const [ui, setUi] = useState({ kind: "binary", welds: true, sleep: true, seed: 0, fps: 0, awake: 0, asleep: 0, eaten: 0, weldsAlive: 0, copied: false });
  const ctl = useRef({ kind: "binary", welds: true, sleep: true, hash: false, friction: false, time: 0.5, size: 1, hull: "longrange", shipOn: false, reset: 1 });
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
        const sc2 = world.shipScale || 1;
        const cap = world.shipPhase === "plan" ? Math.min(65 * sc2, world.ship.fuel) : Math.min(110 * sc2, world.ship.fuel);
        const vel = Math.min(mag * 0.28 * sc2, cap);
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
      // the ark's release: a near-miss bends toward the gate; away from the gate, toward a closed orbit
      if (panDrag && panDrag.aim && world && world.shipAim && world.shipAim.on && world.shipTrack) {
        const st = world.shipTrack, aim = world.shipAim, vel = Math.hypot(aim.vx, aim.vz);
        const test = vel > 1 ? predictShip(world, st.vx + aim.vx, st.vz + aim.vz, 2400) : null;
        if (test && !test.pts.some(p => p.hitsGate)) {
          const wantGate = world.gate && !world.gate.reached && test.minGate < 80;
          const ang0 = Math.atan2(aim.vz, aim.vx);
          let bestAng = ang0, bestDist = test.minGate, found = false;
          for (let da = -0.12; da <= 0.12; da += 0.03) {
            const ta = ang0 + da;
            const t2 = predictShip(world, st.vx + Math.cos(ta) * vel, st.vz + Math.sin(ta) * vel, 2400);
            if (!t2) break;
            if (wantGate) {
              if (t2.minGate < bestDist) { bestDist = t2.minGate; bestAng = ta; }
              if (t2.pts.some(p => p.hitsGate)) { bestAng = ta; found = true; break; }
            } else if (t2.orbit && !t2.pts.some(p => p.hit)) { bestAng = ta; found = true; break; }
          }
          if ((wantGate || found) && bestAng !== ang0) world.shipAim = { on: true, vx: Math.cos(bestAng) * vel, vz: Math.sin(bestAng) * vel };
        }
      }
      panDrag = null;
    };
    c.addEventListener("mousedown", pDown); window.addEventListener("mousemove", pMove); window.addEventListener("mouseup", pUp);
    c.addEventListener("touchstart", pDown, { passive: false }); c.addEventListener("touchmove", pMove, { passive: false });
    c.addEventListener("touchend", pUp); c.addEventListener("touchcancel", pUp);
    let world = null, seed = 0, lastReset = 0, anim, frame = 0, renderF = 0, tPrev = performance.now();
    worldRef.current = () => world && { seed, kind: ctl.current.kind, size: ctl.current.size, hull: ctl.current.hull, shipOn: ctl.current.shipOn, welds: ctl.current.welds, sleep: ctl.current.sleep, mk: MK, log: world.log };
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
        const sc3 = world.shipScale || 1;
        const cap = world.shipPhase === "plan" ? Math.min(65 * sc3, world.ship.fuel) : Math.min(110 * sc3, world.ship.fuel);
        mag = Math.min(mag, cap);
        world.shipAim = { on: true, vx: Math.cos(ang) * mag, vz: Math.sin(ang) * mag };
        return;
      }
      if (what === "cancel") { world.shipPhase = "fly"; world.shipAim = { on: false, vx: 0, vz: 0 }; return; }
      if (!aim || !aim.on) return;
      const conn = shipConn(world); // the hull that answers: cabin-connected, engine aboard — connected, not merely alive
      if (!conn || !conn.eng) return;
      const cost = Math.hypot(aim.vx, aim.vz);
      if (cost > world.ship.fuel) return;
      world.ship.fuel -= cost;
      if (what === "exec") world.ship.burns++;
      for (const b of conn.set) { b.vx += aim.vx; b.vz += aim.vz; }
      world.flame = { f0: world.frame, dur: 36, dx: -aim.vx / cost, dz: -aim.vz / cost, mag: cost }; // the engine fires against the burn
      world.shipAim = { on: false, vx: 0, vz: 0 };
      world.shipPhase = "fly";
    };

    const loop = () => {
      const W = c.width / dpr, H = c.height / dpr, k = ctl.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (k.reset !== lastReset) {
        lastReset = k.reset; seed = Math.floor(Math.random() * 100000);
        world = makeScenario(k.kind, seed, k.size, k.hull, k.shipOn);
        if (world.ship) {
          stepWorld(world, k); // one priming step: tracks and orbit lines exist before the aim freeze — the t26 intent, landed now
          const b0 = world.blocks.find(b2 => b2.ship && b2.alive);
          if (b0) { // the ark's default trajectory: toward the gate at 50, or away from the mass where no gate stands
            const dx = world.gate ? world.gate.x - b0.x : b0.x, dz = world.gate ? world.gate.z - b0.z : b0.z;
            const dd = Math.hypot(dx, dz) || 1;
            const birth = world.birthAim || 50 * (world.shipScale || 1); // the map launches at its full cap to break the great star's grip; every other scene keeps the ark's 50
            world.shipAim = { on: true, vx: dx / dd * birth, vz: dz / dd * birth };
          }
        }
        setUi(u => ({ ...u, kind: k.kind, seed, eaten: 0 }));
      }
      let weldsAlive = 0;
      // time chips: fractions step the physics once every 1/time drawn frames (×1/16 every sixteenth);
      // half speed steps every other frame — the render never changes cadence
      // the half-speed gate counts RENDERED frames — the old gate counted physics
      // steps, so the first skipped frame froze the counter and time stopped dead
      const reps = k.time >= 1 ? k.time : (renderF % Math.round(1 / k.time) === 0 ? 1 : 0); // half steps every other drawn frame, quarter every fourth
      renderF++;
      // the ship's live track (its clump row) and the ark's plan-freeze
      if (world.ship) {
        world.shipTrack = null;
        for (const tk of world.tracks || []) { for (const i2 of [0]) {} }
        for (const tk of world.tracks || []) { const b0 = world.blocks.find(b2 => b2.ship && b2.alive); if (b0 && tk.clump === b0.clump) { world.shipTrack = tk; break; } }
      }
      // the hull turns with the trajectory line: while time is frozen the
      // connected hull rotates rigidly about its own center to face the aim.
      // Positions turn; velocities do not — facing is the pilot's statement,
      // the ark's way, and costs nothing until the burn fires.
      if (world.ship && world.shipAim && world.shipAim.on && (world.shipPhase === "aim" || world.shipPhase === "plan")) {
        const tgt = Math.atan2(world.shipAim.vz, world.shipAim.vx);
        let dAng = tgt - (world.shipAng || 0);
        if (dAng > Math.PI) dAng -= 2 * Math.PI; if (dAng < -Math.PI) dAng += 2 * Math.PI;
        if (Math.abs(dAng) > 0.0005) {
          const c4 = shipConn(world);
          if (c4) {
            let mx = 0, mz = 0, M = 0;
            for (const b of c4.set) { mx += b.x * b.m; mz += b.z * b.m; M += b.m; }
            mx /= M; mz /= M;
            const co = Math.cos(dAng), si = Math.sin(dAng);
            for (const b of c4.set) {
              const rx = b.x - mx, rz = b.z - mz;
              b.x = mx + rx * co - rz * si; b.z = mz + rx * si + rz * co;
            }
            world.shipAng = tgt;
          }
        }
      }
      const planFrozen = world.ship && (world.shipPhase === "aim" || world.shipPhase === "plan" || (world.shipPaused && world.shipPhase === "fly")); // the ark holds the sky while you aim — time starts at LAUNCH
      const tPhys = performance.now();
      // FILLING IN THE FRAMES: a slow chip steps the physics once every N drawn
      // frames. Before each step every block and star remembers where it stood;
      // the drawing then places it partway from there to here by how many frames
      // have passed, so bodies glide across the gap instead of hopping. Drawing
      // only — the physics and every pinned number are untouched.
      const stepN = k.time >= 1 ? 1 : Math.round(1 / k.time);
      if (!planFrozen && reps > 0) {
        for (const b of world.blocks) { b.px = b.x; b.py = b.y; b.pz = b.z; }
        if (world.starBodies) for (const st of world.starBodies) { st.px = st.x; st.pz = st.z; }
        world.shipPrev = world.shipTrack ? { x: world.shipTrack.x, z: world.shipTrack.z } : null;
      }
      world.lerp = (planFrozen || stepN === 1) ? 1 : (((renderF - 1) % stepN) + 1) / stepN;
      for (let rep = 0; rep < (planFrozen ? 0 : reps); rep++) weldsAlive = stepWorld(world, k);
      if (reps > 0) world.stepMs = +((performance.now() - tPhys) / reps).toFixed(2);
      if (world.gate && !world.gate.reached && world.shipTrack && !planFrozen &&
          Math.hypot(world.shipTrack.x - world.gate.x, world.shipTrack.z - world.gate.z) < world.gate.r) world.gate.reached = true;
      if (world.ship && world.pickups && world.shipTrack && !planFrozen) for (const pk of world.pickups) { // a fuel cache refuels on touch, up to the tank
        if (pk.alive && Math.hypot(world.shipTrack.x - pk.x, world.shipTrack.z - pk.z) < 18) { pk.alive = false; world.ship.fuel = Math.min(world.ship.max, world.ship.fuel + pk.fuel); }
      }
      if (world.ship && !world.shipDead) {
        const cab2 = world.blocks.find(b2 => b2.ship && b2.cab);
        if (cab2 && !cab2.alive) { world.shipDead = true; world.deadAt = world.t; } // the wreck keeps drifting; only the flight ends
      }
      if (world.ship) { // the tanks hold the fuel: a tank lost or torn off spills its share on the spot
        const c3 = shipConn(world);
        let tk = 0; if (c3) for (const b3 of c3.set) if (b3.tank) tk++;
        const cap = 100 + 210 * tk;
        if (world.ship.fuel > cap) world.ship.fuel = cap;
      }

      drawFrame({ ctx, W, H, world, frame: world.frame, time: k.time });
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
        setUi(u => ({ ...u, fps, stepMs: world.stepMs || 0, awake, asleep, eaten: world.eaten, weldsAlive, fuel: world.ship ? Math.round(world.ship.fuel) : null, phase: world.shipPhase || null, aimOn: !!(world.shipAim && world.shipAim.on), engOn: !world.ship || (() => { const c2 = shipConn(world); return !!(c2 && c2.eng); })(), dead: !!world.shipDead, burns: world.ship ? world.ship.burns : 0, deadT: world.shipDead ? Math.round(world.deadAt) : null }));
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
      {ui.dead && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
        <div style={{ background: "rgba(245,244,240,.95)", borderRadius: 16, padding: "22px 28px", border: "1px solid rgba(0,0,0,.08)", textAlign: "center", pointerEvents: "auto" }}>
          <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 2, color: "rgba(160,40,30,.8)" }}>SHIP LOST</div>
          <div style={{ fontSize: 11, color: "rgba(0,0,0,.5)", marginTop: 8 }}>cabin destroyed · {ui.burns} burn{ui.burns !== 1 ? "s" : ""} · fuel {ui.fuel} · {ui.deadT}s</div>
          <div style={{ marginTop: 14, display: "flex", justifyContent: "center" }}>{chip("RESET", true, () => set(() => {}))}</div>
        </div>
      </div>}
      <div style={{ position: "absolute", bottom: 20, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "0 12px" }}>
        {!(ui.phase === "aim" || ui.phase === "plan") && <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
          {SCENES.map(sn => chip(SCENE_LABEL[sn], ui.kind === sn, () => set(k => { k.kind = sn; k.time = 0.5; })))}
          {ui.kind !== "ship" && chip(`FLY ${ctl.current.shipOn ? "ON" : "OFF"}`, ctl.current.shipOn, () => set(k => { k.shipOn = !k.shipOn; }))}
        </div>}
        {ui.phase === "aim" && <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
          {HULL_LIST.map(hn => chip(HULL_LABEL[hn], ctl.current.hull === hn, () => set(k => { k.hull = hn; })))}
        </div>}
        <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
          {!(ui.phase === "aim" || ui.phase === "plan") && [1, 2, 5].map(sz => chip("SIZE " + sz + "x", ctl.current.size === sz, () => set(k => { k.size = sz; })))}
          {[0.03125, 0.0625, 0.125, 0.25, 0.5].map(tm => chip(tm === 0.03125 ? "×1/32" : tm === 0.0625 ? "×1/16" : tm === 0.125 ? "×⅛" : tm === 0.25 ? "×¼" : "×½", ctl.current.time === tm, () => setLive(k => { k.time = tm; })))}
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
          {ui.phase === "aim" && chip("LAUNCH", ui.aimOn === true && ui.engOn === true, () => ui.aimOn && ui.engOn && fireBurn("launch"))}
          {ui.phase === "fly" && !ui.dead && chip("PLAN BURN", false, () => fireBurn("plan"))}
          {ui.phase === "plan" && chip("EXECUTE", ui.aimOn === true && ui.engOn === true, () => ui.aimOn && ui.engOn && fireBurn("exec"))}
          {ui.phase === "plan" && chip("CANCEL", false, () => fireBurn("cancel"))}
        </div>
      </div>
    </div>
  );
}
