// game/runner/audio.js — the campaign runner's synth SFX. Moved verbatim
// from CampaignRunner.jsx in the module split; behavior-identical.
export function makeAudio() {
  let ctx = null, muted = true;
  const ensure = () => {
    try {
      if (!ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) ctx = new AC(); }
      if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
    } catch (e) {}
  };
  const blip = (f0, f1, dur, type, gain) => {
    if (muted || !ctx) return;
    try {
      const t = ctx.currentTime;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
      g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + dur);
    } catch (e) {}
  };
  const thud = (dur, gain, fc) => {
    if (muted || !ctx) return;
    try {
      const t = ctx.currentTime, n = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      const src = ctx.createBufferSource(); src.buffer = buf;
      const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = fc;
      const g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f).connect(g).connect(ctx.destination); src.start(t);
    } catch (e) {}
  };
  return {
    ensure,
    setMuted(m) { muted = m; }, get muted() { return muted; },
    fire() { blip(150, 55, 0.12, "square", 0.22); thud(0.09, 0.18, 900); },
    boom() { thud(0.32, 0.42, 320); blip(85, 28, 0.28, "sine", 0.32); },
    splash() { thud(0.22, 0.26, 1500); blip(560, 190, 0.16, "sine", 0.12); },
    kill() { blip(760, 1180, 0.06, "square", 0.09); },
    crack() { blip(1500, 300, 0.05, "square", 0.1); thud(0.05, 0.12, 2500); },
    trial() { blip(523, 784, 0.14, "square", 0.16); setTimeout(() => blip(784, 1046, 0.2, "square", 0.16), 130); },
    hook() { blip(200, 900, 0.4, "sawtooth", 0.14); },
  };
}
