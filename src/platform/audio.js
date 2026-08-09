// platform/audio.js — the shared COLDSNAP sound engine. Procedural WebAudio,
// no asset files (artifact/Pages builds stay self-contained).
//
// Two layers, both driven by what the ENGINE says happened — never by which
// module is running:
//   consume(events)  — one-shots from the world's event stream (boom, muzzle,
//                      weldbreak, splash, kill...), spatialized against the
//                      listener (camera focus): distance attenuation + pan.
//   tick(world, dt)  — continuous state: vehicle engines rumble with speed
//                      and throttle, awake masonry grinds and knocks as it
//                      moves (kinetic energy near the listener + per-contact
//                      transients), mech footfalls and thruster roar.
//
// Autoplay policy: the context unlocks on the first user gesture (call
// ensure() from any pointer/key handler). Muted flag persists at the caller.
export function makeGameAudio() {
  let ctx = null, muted = false, master = null, comp = null;
  let noiseBuf = null;
  const listener = { x: 0, z: 0, range: 60 }; // range = distance at which sounds fade to ~1/3
  let voices = 0;                              // live one-shots; cap keeps a barrage from mush
  const VOICE_CAP = 26;

  const ensure = () => {
    try {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
        comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -18; comp.ratio.value = 6; comp.knee.value = 12;
        master = ctx.createGain(); master.gain.value = 0.8;
        master.connect(comp).connect(ctx.destination);
        const n = Math.floor(ctx.sampleRate * 2);
        noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
        const d = noiseBuf.getChannelData(0);
        let b = 0; // pinkish: integrated white reads as rubble, not static
        for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; b = (b + 0.04 * w) / 1.04; d[i] = (b * 3 + w * 0.35) * 0.8; }
      }
      if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
    } catch (e) {}
  };

  // ---- spatial helpers ------------------------------------------------
  const att = (x, z) => {
    const d = Math.hypot(x - listener.x, z - listener.z);
    return 1 / (1 + (d / listener.range) * 2.2);
  };
  const panOf = (x) => Math.max(-0.8, Math.min(0.8, (x - listener.x) / listener.range));
  const out = (x, gainV) => {
    // per-sound gain -> pan -> master; returns the node one-shots connect to
    const g = ctx.createGain(); g.gain.value = gainV;
    let tail = g;
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = panOf(x); g.connect(p); tail = p; }
    tail.connect(master);
    return g;
  };

  // ---- one-shot builders ----------------------------------------------
  const done = (src, t1) => { voices++; src.onended = () => { voices--; }; src.stop(t1); };
  const noise = (x, z, { f0 = 800, f1 = null, type = "lowpass", q = 1, dur = 0.1, gain = 0.2, rate = 1, delay = 0 }) => {
    if (muted || !ctx || voices >= VOICE_CAP) return;
    try {
      const t = ctx.currentTime + delay;
      const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.playbackRate.value = rate;
      src.loop = true; src.loopStart = Math.random() * 1.2;
      const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(f0, t); f.Q.value = q;
      if (f1 != null) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
      const g = out(x, 0.0001);
      g.gain.setValueAtTime(gain * att(x, z), t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f).connect(g);
      src.start(t);
      done(src, t + dur + 0.02);
    } catch (e) {}
  };
  const tone = (x, z, { f0 = 200, f1 = null, type = "sine", dur = 0.15, gain = 0.2, delay = 0 }) => {
    if (muted || !ctx || voices >= VOICE_CAP) return;
    try {
      const t = ctx.currentTime + delay;
      const o = ctx.createOscillator(); o.type = type;
      o.frequency.setValueAtTime(f0, t);
      if (f1 != null) o.frequency.exponentialRampToValueAtTime(Math.max(15, f1), t + dur);
      const g = out(x, 0.0001);
      g.gain.setValueAtTime(gain * att(x, z), t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g);
      o.start(t);
      done(o, t + dur + 0.02);
    } catch (e) {}
  };

  // ---- the vocabulary --------------------------------------------------
  const explosion = (x, z, r = 2) => {
    const big = Math.min(1, r / 4.5);
    // sub drop + body + bright attack + rumble tail: layered by blast radius
    tone(x, z, { f0: 90 + big * 30, f1: 26, type: "sine", dur: 0.35 + big * 0.3, gain: 0.5 + big * 0.35 });
    noise(x, z, { f0: 1400 - big * 400, f1: 120, dur: 0.3 + big * 0.35, gain: 0.4 + big * 0.3 });
    noise(x, z, { f0: 3200, type: "highpass", dur: 0.06, gain: 0.18 + big * 0.1 });
    if (big > 0.45) noise(x, z, { f0: 220, f1: 60, dur: 0.9, gain: 0.22 * big, delay: 0.12 });
  };
  const MUZZLE = {
    mg:     (x, z) => { noise(x, z, { f0: 1800, type: "highpass", dur: 0.035, gain: 0.16 }); tone(x, z, { f0: 220, f1: 90, type: "square", dur: 0.03, gain: 0.05 }); },
    shell:  (x, z) => { tone(x, z, { f0: 75, f1: 34, type: "sine", dur: 0.16, gain: 0.4 }); noise(x, z, { f0: 750, type: "bandpass", q: 0.8, dur: 0.09, gain: 0.3 }); },
    rocket: (x, z) => { noise(x, z, { f0: 400, f1: 1500, type: "bandpass", q: 1.6, dur: 0.35, gain: 0.24 }); },
    mortar: (x, z) => { tone(x, z, { f0: 130, f1: 55, type: "sine", dur: 0.18, gain: 0.3 }); noise(x, z, { f0: 500, dur: 0.12, gain: 0.16 }); },
  };
  const stoneKnock = (x, z, s = 1) => {
    noise(x, z, { f0: 700 + Math.random() * 900, type: "bandpass", q: 3.5, dur: 0.05 + 0.03 * s, gain: Math.min(0.3, 0.1 + 0.12 * s), rate: 0.8 + Math.random() * 0.5 });
    if (s > 0.7) tone(x, z, { f0: 70, f1: 40, dur: 0.08, gain: 0.12 * s });
  };
  const bodyFall = (x, z) => noise(x, z, { f0: 300, f1: 110, dur: 0.12, gain: 0.1 });
  const siren = (x, z) => { // incoming-strike two-tone
    for (let i = 0; i < 3; i++) {
      tone(x, z, { f0: 660, type: "square", dur: 0.14, gain: 0.06, delay: i * 0.3 });
      tone(x, z, { f0: 520, type: "square", dur: 0.14, gain: 0.06, delay: i * 0.3 + 0.15 });
    }
  };

  // ---- event layer -----------------------------------------------------
  const consume = (events) => {
    if (muted || !ctx) return;
    for (const e of events) {
      if (e.type === "boom") explosion(e.x, e.z, e.r || 2);
      else if (e.type === "muzzle") (MUZZLE[e.kind] || MUZZLE.shell)(e.x, e.z);
      else if (e.type === "gmuzzle") MUZZLE.mortar(e.x, e.z);
      else if (e.type === "weldbreak") stoneKnock(e.x, e.z, e.ice ? 1.2 : 0.9);
      else if (e.type === "splash") { noise(e.x, e.z, { f0: 1300, f1: 300, dur: 0.28, gain: 0.2 }); tone(e.x, e.z, { f0: 420, f1: 130, dur: 0.2, gain: 0.08 }); }
      else if (e.type === "kill" && e.kind === "unit") bodyFall(e.x, e.z);
      else if (e.type === "collapse") { noise(e.x, e.z, { f0: 500, f1: 80, dur: 1.1, gain: 0.4 }); tone(e.x, e.z, { f0: 60, f1: 30, dur: 0.8, gain: 0.3 }); }
      else if (e.type === "strike") siren(e.x, e.z);
    }
  };

  // ---- continuous layer ------------------------------------------------
  // loops: id -> { src, filt, gain } — engines per vehicle, one shared
  // masonry-rumble bed, one mech-thruster bed
  const loops = new Map();
  const getLoop = (id, f0, type = "lowpass", q = 1) => {
    let L = loops.get(id);
    if (!L && ctx && !muted) {
      try {
        const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
        const filt = ctx.createBiquadFilter(); filt.type = type; filt.frequency.value = f0; filt.Q.value = q;
        const gain = ctx.createGain(); gain.gain.value = 0.0001;
        src.connect(filt).connect(gain).connect(master);
        src.start();
        L = { src, filt, gain };
        loops.set(id, L);
      } catch (e) { return null; }
    }
    return L;
  };
  const setLoop = (L, gv, fv, dt) => {
    if (!L) return;
    const k = Math.min(1, dt * 8);
    L.gain.gain.value += (gv - L.gain.gain.value) * k;
    if (fv != null) L.filt.frequency.value += (fv - L.filt.frequency.value) * k;
  };
  const knockCd = new Map(); // per-body rate limit for contact transients
  let knockBudget = 0;

  const tick = (world, dt) => {
    if (!ctx || muted) return;
    // vehicle engines: idle rumble that climbs with throttle and speed
    const seen = new Set();
    for (const b of world.bodies) {
      if (b.kind !== "vehicle" || !b.alive) continue;
      const sp = Math.hypot(b.v.x, b.v.z);
      const thr = b.ctl ? Math.abs(b.ctl.throttle || 0) : 0;
      const a = att(b.pos.x, b.pos.z);
      if (a < 0.06 && thr === 0 && sp < 0.5) continue;
      seen.add("veh" + b.id);
      const L = getLoop("veh" + b.id, 90);
      setLoop(L, (0.05 + thr * 0.2 + Math.min(0.12, sp * 0.02)) * a, 70 + sp * 22 + thr * 60, dt);
    }
    // masonry: awake stones near the listener grind (kinetic energy -> bed
    // gain) and knock on hard contacts (impulse -> transient)
    let ke = 0;
    for (const b of world.bodies) {
      if (b.kind !== "chunk" || b.sleeping) continue;
      const v2 = b.v.x * b.v.x + b.v.y * b.v.y + b.v.z * b.v.z;
      if (v2 < 0.04) continue;
      ke += Math.min(6, v2) * att(b.pos.x, b.pos.z);
    }
    if (ke > 0.2 || loops.has("masonry")) {
      seen.add("masonry");
      const L = getLoop("masonry", 160);
      setLoop(L, Math.min(0.4, ke * 0.02), 120 + Math.min(300, ke * 8), dt);
    }
    knockBudget = Math.min(10, knockBudget + dt * 14);
    if (world.contacts) {
      const tNow = world.t;
      for (const c of world.contacts) {
        if (knockBudget < 1) break;
        if (!c.b || c.pn <= 0) continue;
        const ch = c.a.kind === "chunk" ? c.a : c.b.kind === "chunk" ? c.b : null;
        if (!ch) continue;
        const imp = c.pn / Math.max(1, ch.mass);
        if (imp < 0.9) continue;
        const last = knockCd.get(ch.id) || -9;
        if (tNow - last < 0.24) continue;
        knockCd.set(ch.id, tNow);
        knockBudget -= 1;
        stoneKnock(ch.pos.x, ch.pos.z, Math.min(1.6, imp * 0.35));
      }
    }
    // mechs: footfalls off the step counter, thruster roar while burning
    if (world.mechs) for (const mech of world.mechs) {
      if (!mech.hull) continue;
      const hx = mech.hull.pos.x, hz = mech.hull.pos.z;
      if (mech.telem && mech.telem.steps !== (mech._sndSteps || 0)) {
        mech._sndSteps = mech.telem.steps;
        tone(hx, hz, { f0: 55, f1: 32, dur: 0.16, gain: 0.4 });
        noise(hx, hz, { f0: 350, type: "bandpass", q: 2, dur: 0.07, gain: 0.16 });
      }
      const burn = mech.thrusters && mech.thrustersOn ? Math.max(0, ...mech.thrusters.map((th) => th.cur || 0)) : 0;
      const id = "jet" + (mech.hull.id || 0);
      if (burn > 0.08 || loops.has(id)) {
        seen.add(id);
        const L = getLoop(id, 900, "bandpass", 0.7);
        setLoop(L, Math.min(0.35, burn * 0.4) * att(hx, hz), 700 + burn * 900, dt);
      }
    }
    // retire loops whose source vanished
    for (const [id, L] of loops) {
      if (seen.has(id)) continue;
      L.gain.gain.value *= 1 - Math.min(1, dt * 10);
      if (L.gain.gain.value < 0.002) { try { L.src.stop(); } catch (e) {} loops.delete(id); }
    }
  };

  const stopAll = () => { for (const [, L] of loops) { try { L.src.stop(); } catch (e) {} } loops.clear(); };

  return {
    ensure, consume, tick,
    setListener(x, z, range) { listener.x = x; listener.z = z; if (range) listener.range = range; },
    setMuted(m) { muted = m; if (m) stopAll(); },
    get muted() { return muted; },
    dispose() { stopAll(); try { if (ctx) ctx.close(); } catch (e) {} ctx = null; },
    // UI jingles (campaign): kept so score/feedback cues stay distinct from sim audio
    jingleTrial() { tone(listener.x, listener.z, { f0: 523, f1: 784, type: "square", dur: 0.14, gain: 0.14 }); tone(listener.x, listener.z, { f0: 784, f1: 1046, type: "square", dur: 0.2, gain: 0.14, delay: 0.13 }); },
    jingleHook() { tone(listener.x, listener.z, { f0: 200, f1: 900, type: "sawtooth", dur: 0.4, gain: 0.12 }); },
    jingleKill() { tone(listener.x, listener.z, { f0: 760, f1: 1180, type: "square", dur: 0.06, gain: 0.07 }); },
  };
}
