// platform/audio.js — the shared COLDSNAP sound engine. Procedural WebAudio,
// no asset files (artifact/Pages builds stay self-contained).
//
// Two layers, both driven by what the ENGINE says happened — never by which
// module is running:
//   consume(events)  — one-shots from the world's event stream (boom, muzzle,
//                      weldbreak, splash, kill...).
//   tick(world, dt)  — continuous state: vehicle engines rumble with speed
//                      and throttle, awake masonry grinds and knocks as it
//                      moves, mech footfalls and thruster roar, a wind bed.
//
// Spatial model (the anti-drum-machine pass): distance drives gain, an AIR
// lowpass (highs die first), the dry/wet split into a shared snowfield
// reverb, and true arrival delay (343 m/s). Loud events also cast up to
// three ECHO taps off registered reflectors (rock ridges, building faces):
// delay = path difference / 343, darker and quieter than the direct sound.
// Snow is acoustically dead, so the open field stays dry and short while
// masonry and granite clap back — that contrast is the map's acoustic
// signature. Every instance is humanized: ±12% pitch/length/gain and a few
// ms of onset jitter, with 3-8ms attack ramps so nothing clicks like a pad.
export function makeGameAudio() {
  let ctx = null, muted = false, master = null, comp = null, verb = null, verbGain = null;
  let noiseBuf = null;
  const listener = { x: 0, z: 0, range: 60 };
  let reflectors = [];                    // [{x, z, r}] — big acoustic faces
  let voices = 0;
  const VOICE_CAP = 26;
  const C_SND = 343;                      // m/s

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
        // snowfield impulse response: SHORT (fresh snow eats reflections),
        // dark, with a sparse early-reflection cluster so the tail has grain
        const irN = Math.floor(ctx.sampleRate * 0.9);
        const ir = ctx.createBuffer(2, irN, ctx.sampleRate);
        for (let chn = 0; chn < 2; chn++) {
          const cd = ir.getChannelData(chn);
          let lp = 0;
          for (let i = 0; i < irN; i++) {
            const t = i / irN;
            let v = (Math.random() * 2 - 1) * Math.exp(-t * 6.5);
            if (i < ctx.sampleRate * 0.09 && Math.random() < 0.004) v += (Math.random() * 2 - 1) * 0.5 * (1 - t * 4); // early slap grain
            lp += (v - lp) * 0.12; // darken the tail
            cd[i] = lp * 0.9;
          }
        }
        verb = ctx.createConvolver(); verb.buffer = ir;
        verbGain = ctx.createGain(); verbGain.gain.value = 0.9;
        verb.connect(verbGain).connect(master);
      }
      if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
    } catch (e) {}
  };

  // ---- spatial plumbing ------------------------------------------------
  const dist = (x, z) => Math.hypot(x - listener.x, z - listener.z);
  const att = (d) => 1 / (1 + (d / listener.range) * 2.2);
  const panOf = (x) => Math.max(-0.8, Math.min(0.8, (x - listener.x) / listener.range));
  const vary = (v, pct = 0.12) => v * (1 + (Math.random() * 2 - 1) * pct);
  // one output chain per one-shot: air lowpass -> dry gain -> pan -> master,
  // with a wet split into the shared reverb. Returns the node to connect to
  // and the resolved start time (arrival delay + humanize jitter).
  const chain = (x, z, baseGain, { wet = 0.35, delay = 0, dark = 1 } = {}) => {
    const d = dist(x, z);
    const t0 = ctx.currentTime + delay + d / C_SND + Math.random() * 0.02;
    const near = Math.min(1, d / (listener.range * 1.6));
    const air = ctx.createBiquadFilter(); air.type = "lowpass";
    air.frequency.value = Math.max(300, 9500 * Math.pow(1 - near, 1.6) * dark + 250);
    const dry = ctx.createGain(); dry.gain.value = baseGain * att(d) * (1 - wet * near * 0.8);
    let tail = dry;
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = panOf(x); dry.connect(p); tail = p; }
    tail.connect(master);
    const wetG = ctx.createGain(); wetG.gain.value = baseGain * att(d) * wet * (0.4 + near * 0.9);
    air.connect(dry); air.connect(wetG); wetG.connect(verb);
    return { node: air, t0, d };
  };

  // ---- one-shot builders ----------------------------------------------
  const done = (src, t1) => { voices++; src.onended = () => { voices--; }; src.stop(t1); };
  const ATK = 0.005; // attack ramp: pads click, munitions don't
  const noise = (x, z, { f0 = 800, f1 = null, type = "lowpass", q = 1, dur = 0.1, gain = 0.2, rate = 1, delay = 0, wet = 0.35, dark = 1 }) => {
    if (muted || !ctx || voices >= VOICE_CAP) return;
    try {
      dur = vary(dur); gain = vary(gain); f0 = vary(f0);
      const { node, t0 } = chain(x, z, gain, { wet, delay, dark });
      const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.playbackRate.value = vary(rate);
      src.loop = true; src.loopStart = Math.random() * 1.2;
      const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(f0, t0); f.Q.value = q;
      if (f1 != null) f.frequency.exponentialRampToValueAtTime(Math.max(20, vary(f1)), t0 + dur);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, t0);
      env.gain.linearRampToValueAtTime(1, t0 + ATK + Math.random() * 0.004);
      env.gain.setTargetAtTime(0.0001, t0 + ATK, dur / 3); // convex settle, not a gate
      src.connect(f).connect(env).connect(node);
      src.start(t0);
      done(src, t0 + dur + 0.15);
    } catch (e) {}
  };
  const tone = (x, z, { f0 = 200, f1 = null, type = "sine", dur = 0.15, gain = 0.2, delay = 0, wet = 0.3, atk = ATK }) => {
    if (muted || !ctx || voices >= VOICE_CAP) return;
    try {
      dur = vary(dur); gain = vary(gain);
      const { node, t0 } = chain(x, z, gain, { wet, delay });
      const o = ctx.createOscillator(); o.type = type;
      o.frequency.setValueAtTime(vary(f0, 0.06), t0);
      if (f1 != null) o.frequency.exponentialRampToValueAtTime(Math.max(15, f1), t0 + dur);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, t0);
      env.gain.linearRampToValueAtTime(1, t0 + atk);
      env.gain.setTargetAtTime(0.0001, t0 + atk, dur / 3);
      o.connect(env).connect(node);
      o.start(t0);
      done(o, t0 + dur + 0.15);
    } catch (e) {}
  };
  // modal ring: 2-3 sharp resonant modes — this is what says "granite",
  // "stone on stone" instead of "snare"
  const modal = (x, z, modes, dur, gain, { delay = 0, wet = 0.4 } = {}) => {
    if (muted || !ctx || voices >= VOICE_CAP) return;
    try {
      const { node, t0 } = chain(x, z, vary(gain), { wet, delay });
      const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.playbackRate.value = 1;
      src.loop = true; src.loopStart = Math.random() * 1.2;
      const sum = ctx.createGain(); sum.gain.value = 1;
      for (const m of modes) {
        const f = ctx.createBiquadFilter(); f.type = "bandpass";
        f.frequency.value = vary(m.f, 0.08); f.Q.value = m.q || 22;
        const g = ctx.createGain(); g.gain.value = m.g || 1;
        src.connect(f).connect(g).connect(sum);
      }
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, t0);
      env.gain.linearRampToValueAtTime(1, t0 + 0.003);
      env.gain.setTargetAtTime(0.0001, t0 + 0.003, dur / 3.2);
      sum.connect(env).connect(node);
      src.start(t0);
      done(src, t0 + dur + 0.1);
    } catch (e) {}
  };
  // echo taps: loud events bounce off up to 3 registered reflectors — a
  // darker, quieter copy delayed by the path difference. Skips tight taps
  // (<45ms) that would just phase against the direct sound.
  const echoes = (x, z, fire) => {
    if (!reflectors.length) return;
    const dDirect = dist(x, z);
    const taps = [];
    for (const r of reflectors) {
      const ds = Math.hypot(x - r.x, z - r.z), dl = Math.hypot(listener.x - r.x, listener.z - r.z);
      if (ds > 85 || ds < 3) continue;
      const delay = (ds + dl - dDirect) / C_SND;
      if (delay < 0.045 || delay > 0.7) continue;
      taps.push({ delay, k: (r.r || 4) / (8 + ds + dl), x: r.x, z: r.z });
    }
    taps.sort((a, b2) => b2.k - a.k);
    for (const tp of taps.slice(0, 3)) fire(tp.x, tp.z, tp.delay, Math.min(0.5, tp.k * 3));
  };

  // ---- the vocabulary --------------------------------------------------
  const explosion = (x, z, r = 2, echo = true) => {
    const big = Math.min(1, r / 4.5);
    // crack, then body, then tail — staggered onsets, not one stacked hit
    noise(x, z, { f0: 3400, type: "highpass", dur: 0.05, gain: 0.15 + big * 0.1, wet: 0.25 });
    tone(x, z, { f0: 90 + big * 30, f1: 26, type: "sine", dur: 0.4 + big * 0.3, gain: 0.5 + big * 0.35, delay: 0.02, atk: 0.012 });
    noise(x, z, { f0: 1300 - big * 400, f1: 110, dur: 0.35 + big * 0.4, gain: 0.4 + big * 0.3, delay: 0.03, wet: 0.5 });
    if (big > 0.4) noise(x, z, { f0: 210, f1: 55, dur: 1.0 + big * 0.4, gain: 0.24 * big, delay: 0.13, wet: 0.6, dark: 0.6 });
    if (echo) echoes(x, z, (ex, ez, dly, k) => noise(ex, ez, { f0: 500, f1: 90, dur: 0.3 + big * 0.2, gain: (0.3 + big * 0.25) * k, delay: dly, wet: 0.7, dark: 0.5 }));
  };
  const MUZZLE = {
    mg:     (x, z, mass = 1) => { noise(x, z, { f0: 1900, type: "highpass", dur: 0.03 + mass * 0.012, gain: 0.13 + mass * 0.05, wet: 0.2 }); if (mass > 1.5) noise(x, z, { f0: 900, type: "bandpass", q: 1.2, dur: 0.05 + mass * 0.02, gain: 0.08 * mass, delay: 0.012, wet: 0.3 }); },
    shell:  (x, z, mass = 1) => {
      tone(x, z, { f0: 74, f1: 33, type: "sine", dur: 0.18, gain: 0.4 * mass, atk: 0.008 });
      modal(x, z, [{ f: 620, q: 9, g: 1 }, { f: 1080, q: 12, g: 0.5 }], 0.1, 0.26 * mass, { wet: 0.35 });
      echoes(x, z, (ex, ez, dly, k) => noise(ex, ez, { f0: 420, f1: 100, dur: 0.22, gain: 0.26 * k, delay: dly, wet: 0.7, dark: 0.5 }));
    },
    rocket: (x, z, mass = 1) => { noise(x, z, { f0: 380, f1: 1600, type: "bandpass", q: 1.4, dur: 0.4, gain: 0.22 * mass, wet: 0.35 }); },
    mortar: (x, z, mass = 1) => { tone(x, z, { f0: 128, f1: 52, type: "sine", dur: 0.2, gain: 0.3 * mass, atk: 0.01 }); noise(x, z, { f0: 520, dur: 0.14, gain: 0.15 * mass, delay: 0.015, wet: 0.4 }); },
  };
  // granite/masonry: three inharmonic modes, pitch scattered per stone
  const STONE_MODES = [{ f: 840, q: 20, g: 1 }, { f: 1310, q: 26, g: 0.6 }, { f: 2140, q: 30, g: 0.35 }];
  const stoneKnock = (x, z, s = 1) => {
    modal(x, z, STONE_MODES, 0.06 + 0.05 * Math.min(1, s), Math.min(0.3, 0.09 + 0.12 * s), { wet: 0.45 });
    if (s > 0.7) tone(x, z, { f0: 68, f1: 40, dur: 0.09, gain: 0.12 * s, atk: 0.006 });
  };
  const bodyFall = (x, z) => noise(x, z, { f0: 290, f1: 110, dur: 0.13, gain: 0.09, wet: 0.4 });
  const siren = (x, z) => {
    for (let i = 0; i < 3; i++) {
      tone(x, z, { f0: 660, type: "square", dur: 0.14, gain: 0.05, delay: i * 0.3, atk: 0.02 });
      tone(x, z, { f0: 520, type: "square", dur: 0.14, gain: 0.05, delay: i * 0.3 + 0.15, atk: 0.02 });
    }
  };
  // THE MUSTER BELL — struck bronze, not a chime. A real bell's partials are
  // inharmonic and named: hum an octave under, prime, tierce a minor third
  // above prime (that's why bells sound minor), quint, nominal. Same modal
  // voice as granite but with far higher Q and a decay measured in seconds
  // instead of milliseconds — that difference IS the difference between a
  // stone knock and a bell. Two strikes (the second softer, a beat behind, as
  // a rope-swung bell answers itself) over a dark low tail.
  const BELL_MODES = [
    { f: 188, q: 58, g: 0.9 },    // hum
    { f: 376, q: 72, g: 1 },      // prime
    { f: 452, q: 76, g: 0.55 },   // tierce
    { f: 564, q: 68, g: 0.32 },   // quint
    { f: 752, q: 60, g: 0.2 },    // nominal
  ];
  // Non-positional: it is the garrison's own bell hanging over the listener,
  // not a thing out on the field, so it rings at the listener's coordinates
  // (the jingles' convention) and never pans or attenuates.
  const bellToll = () => {
    const x = listener.x, z = listener.z;
    modal(x, z, BELL_MODES, 3.4, 0.34, { wet: 0.5 });
    modal(x, z, BELL_MODES, 2.7, 0.22, { delay: 0.62, wet: 0.55 });
    tone(x, z, { f0: 94, f1: 60, dur: 2.0, gain: 0.11, delay: 0.01, wet: 0.5, atk: 0.02 });
  };
  // A pre-toll: the last seconds before the bell, counted out. The same
  // partials at a whisper with a millisecond decay — the rope taking up its
  // slack, not a strike.
  const preToll = () => modal(listener.x, listener.z, BELL_MODES, 0.26, 0.05, { wet: 0.3 });
  // THE CONVOY — the manifest truck arriving. A diesel idle swelling up out
  // of nothing (slow attack: this one thing does NOT want the anti-click ramp,
  // it wants to be heard approaching), grit over it, then the tailgate: thin
  // sheet steel dropped on its chains, which is a modal ring with a low Q —
  // loose metal, not granite.
  const convoy = () => {
    const x = listener.x, z = listener.z;
    tone(x, z, { f0: 44, f1: 34, dur: 1.0, gain: 0.18, wet: 0.35, atk: 0.18 });
    noise(x, z, { f0: 92, f1: 180, dur: 0.7, gain: 0.2, rate: 0.4, wet: 0.4, dark: 0.75 });
    noise(x, z, { f0: 165, f1: 70, dur: 0.5, gain: 0.13, rate: 0.5, delay: 0.26, wet: 0.45, dark: 0.7 });
    modal(x, z, [{ f: 205, q: 11, g: 1 }, { f: 640, q: 15, g: 0.5 }, { f: 1480, q: 18, g: 0.25 }], 0.22, 0.19, { delay: 0.7, wet: 0.45 });
  };
  // The interface tick: one short, soft, dry blip for a choice taken or a
  // record written. Deliberately the quietest thing in the vocabulary.
  const uiTick = () => tone(listener.x, listener.z, { f0: 1180, f1: 860, type: "triangle", dur: 0.045, gain: 0.05, wet: 0.12, atk: 0.004 });

  // ---- event layer -----------------------------------------------------
  // coalescing: N same-kind muzzles in one drain merge into ONE denser shot
  // (mass = sqrt(N)) at their centroid — massed fire is a crackle, not a
  // drum roll of identical ticks
  const consume = (events) => {
    if (muted || !ctx) return;
    const groups = new Map();
    for (const e of events) {
      if (e.type === "muzzle" || e.type === "gmuzzle" || e.type === "weldbreak") {
        const key = e.type + (e.kind || "") + (e.ice || "");
        let g = groups.get(key);
        if (!g) { g = { n: 0, x: 0, z: 0, e }; groups.set(key, g); }
        g.n++; g.x += e.x; g.z += e.z;
        continue;
      }
      if (e.type === "boom") explosion(e.x, e.z, e.r || 2);
      else if (e.type === "splash") { noise(e.x, e.z, { f0: 1300, f1: 300, dur: 0.3, gain: 0.2, wet: 0.4 }); tone(e.x, e.z, { f0: 420, f1: 130, dur: 0.22, gain: 0.08, delay: 0.03 }); }
      else if (e.type === "kill" && e.kind === "unit") bodyFall(e.x, e.z);
      else if (e.type === "collapse") { noise(e.x, e.z, { f0: 480, f1: 75, dur: 1.2, gain: 0.4, wet: 0.55, dark: 0.7 }); tone(e.x, e.z, { f0: 58, f1: 30, dur: 0.9, gain: 0.3, delay: 0.05 }); echoes(e.x, e.z, (ex, ez, dly, k) => noise(ex, ez, { f0: 350, f1: 80, dur: 0.5, gain: 0.3 * k, delay: dly, wet: 0.7, dark: 0.5 })); }
      else if (e.type === "strike") siren(e.x, e.z);
      // The garrison's own cues (DEPOT's bell cycle). No coordinates: these
      // three carry nothing but a type — they play at the listener.
      else if (e.type === "bell") bellToll();
      else if (e.type === "pretoll") preToll();
      else if (e.type === "manifest") convoy();
      else if (e.type === "uitick") uiTick();
    }
    for (const [, g] of groups) {
      const x = g.x / g.n, z = g.z / g.n, mass = Math.sqrt(g.n);
      if (g.e.type === "muzzle") (MUZZLE[g.e.kind] || MUZZLE.shell)(x, z, mass);
      else if (g.e.type === "gmuzzle") MUZZLE.mortar(x, z, mass);
      else {
        stoneKnock(x, z, (g.e.ice ? 1.2 : 0.9) * mass);
        // a MASS of breaking welds reads as grinding failure, add grit
        if (g.n > 3) noise(x, z, { f0: 900, f1: 250, type: "bandpass", q: 2, dur: 0.25, gain: Math.min(0.3, 0.06 * g.n), wet: 0.5 });
      }
    }
  };

  // ---- continuous layer ------------------------------------------------
  const loops = new Map();
  const getLoop = (id, f0, type = "lowpass", q = 1) => {
    let L = loops.get(id);
    if (!L && ctx && !muted) {
      try {
        const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
        src.loopStart = Math.random() * 1.5;
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
  const knockCd = new Map();
  let knockBudget = 0, windPh = 0;
  // incoming whistles: one per falling ballistic round (mortar shells,
  // strike rockets). Keyed on the projectile OBJECT — it lives until impact.
  const whistles = new Map();
  const stepWhistles = (world, dt) => {
    const live = new Set();
    if (world.projectiles) for (const p of world.projectiles) {
      if (!p.spec || (p.spec.kind !== "shell" && p.spec.kind !== "rocket")) continue;
      if (p.v.y > -6 || p.life < 0.35) continue; // only committed, falling arcs
      live.add(p);
      let w = whistles.get(p);
      if (!w && whistles.size < 8 && !muted) {
        try {
          const o = ctx.createOscillator(); o.type = "sine";
          const g = ctx.createGain(); g.gain.value = 0.0001;
          let tail = g;
          if (ctx.createStereoPanner) { const pan = ctx.createStereoPanner(); g.connect(pan); tail = pan; w = { o, g, pan }; }
          else w = { o, g };
          tail.connect(master);
          o.connect(g);
          o.start();
          whistles.set(p, w);
        } catch (e) { continue; }
      }
      if (!w) continue;
      // pitch climbs as it falls faster (the classic incoming shriek),
      // vibrato gives it air; loudness swells as it nears the ground
      const fall = Math.min(1, -p.v.y / 42);
      w.o.frequency.value = (620 + fall * 900) * (1 + Math.sin(p.life * 31) * 0.025);
      const h = p.pos.y - (world.field ? world.field.heightAt(p.pos.x, p.pos.z) : 0);
      const near = Math.max(0, 1 - h / 45);
      w.g.gain.value = 0.05 * (0.25 + 0.75 * near * near) * att(dist(p.pos.x, p.pos.z));
      if (w.pan) w.pan.pan.value = panOf(p.pos.x);
    }
    for (const [p, w] of whistles) {
      if (live.has(p)) continue;
      try { w.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.02); w.o.stop(ctx.currentTime + 0.1); } catch (e) {}
      whistles.delete(p);
    }
  };

  const tick = (world, dt) => {
    if (!ctx || muted) return;
    stepWhistles(world, dt);
    const seen = new Set();
    // wind bed: a quiet, slowly breathing bandpass — the glue between shots
    windPh += dt * (0.13 + Math.sin(windPh * 0.37) * 0.02);
    seen.add("wind");
    const W = getLoop("wind", 300, "bandpass", 0.35);
    setLoop(W, 0.011 + 0.008 * (0.5 + 0.5 * Math.sin(windPh)), 240 + 140 * (0.5 + 0.5 * Math.sin(windPh * 0.61 + 1.7)), dt);
    // vehicle engines
    for (const b of world.bodies) {
      if (b.kind !== "vehicle" || !b.alive) continue;
      const sp = Math.hypot(b.v.x, b.v.z);
      const thr = b.ctl ? Math.abs(b.ctl.throttle || 0) : 0;
      const a = att(dist(b.pos.x, b.pos.z));
      if (a < 0.06 && thr === 0 && sp < 0.5) continue;
      seen.add("veh" + b.id);
      const L = getLoop("veh" + b.id, 90);
      setLoop(L, (0.05 + thr * 0.2 + Math.min(0.12, sp * 0.02)) * a, 70 + sp * 22 + thr * 60, dt);
    }
    // masonry: awake stones grind (bed) + knock on hard contacts (modal)
    let ke = 0;
    for (const b of world.bodies) {
      if (b.kind !== "chunk" || b.sleeping) continue;
      const v2 = b.v.x * b.v.x + b.v.y * b.v.y + b.v.z * b.v.z;
      if (v2 < 0.04) continue;
      ke += Math.min(6, v2) * att(dist(b.pos.x, b.pos.z));
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
        tone(hx, hz, { f0: 55, f1: 32, dur: 0.17, gain: 0.4, atk: 0.008 });
        modal(hx, hz, [{ f: 320, q: 8, g: 1 }, { f: 940, q: 14, g: 0.3 }], 0.08, 0.16, { wet: 0.35 });
      }
      const burn = mech.thrusters && mech.thrustersOn ? Math.max(0, ...mech.thrusters.map((th) => th.cur || 0)) : 0;
      const id = "jet" + (mech.hull.id || 0);
      if (burn > 0.08 || loops.has(id)) {
        seen.add(id);
        const L = getLoop(id, 900, "bandpass", 0.7);
        setLoop(L, Math.min(0.35, burn * 0.4) * att(dist(hx, hz)), 700 + burn * 900, dt);
      }
    }
    for (const [id, L] of loops) {
      if (seen.has(id)) continue;
      L.gain.gain.value *= 1 - Math.min(1, dt * 10);
      if (L.gain.gain.value < 0.002) { try { L.src.stop(); } catch (e) {} loops.delete(id); }
    }
  };

  const stopAll = () => {
    for (const [, L] of loops) { try { L.src.stop(); } catch (e) {} } loops.clear();
    for (const [, w] of whistles) { try { w.o.stop(); } catch (e) {} } whistles.clear();
  };

  return {
    ensure, consume, tick,
    setListener(x, z, range) { listener.x = x; listener.z = z; if (range) listener.range = range; },
    // big acoustic faces for echo taps: [{x, z, r}] — rocks, buildings
    setReflectors(list) { reflectors = list || []; },
    setMuted(m) { muted = m; if (m) stopAll(); },
    get muted() { return muted; },
    dispose() { stopAll(); try { if (ctx) ctx.close(); } catch (e) {} ctx = null; },
    // UI jingles (campaign): kept so score/feedback cues stay distinct from sim audio
    jingleTrial() { tone(listener.x, listener.z, { f0: 523, f1: 784, type: "square", dur: 0.14, gain: 0.14, atk: 0.02 }); tone(listener.x, listener.z, { f0: 784, f1: 1046, type: "square", dur: 0.2, gain: 0.14, delay: 0.13, atk: 0.02 }); },
    jingleHook() { tone(listener.x, listener.z, { f0: 200, f1: 900, type: "sawtooth", dur: 0.4, gain: 0.12, atk: 0.02 }); },
    jingleKill() { tone(listener.x, listener.z, { f0: 760, f1: 1180, type: "square", dur: 0.06, gain: 0.07, atk: 0.01 }); },
  };
}
