import { ok } from "./harness.mjs";
import { makeSlice, sliceFrame, sliceAllows, sliceRest, FLOOR_MS, STEPS_MAX } from "../../src/depot/slice.js";

// ==== 0.6.12: the frame slice =============================================
// The screen's loop as a law on its own (src/depot/slice.js): a frame runs
// the steps it owes, as many as fit beside the frame's other work inside the
// floor, never more than six, the first always; what it cannot afford is
// dropped. Driven here with a clock of its own, a cost per step and a cost
// for the rest of the frame, frame after frame, as the screen drives it.
{
  console.log("\n[0.6.12: the frame slice]");
  const STEP = 1 / 120, REFRESH = 1000 / 60;
  // frames in a row: each step costs stepMs(i), the rest of the frame
  // restMs(i); a frame's wall time is the last frame's work, never under the
  // display's refresh, or interval(i) when given (a stall); the speed scales
  // the world time as the fast-forward button does
  const run = (frames, stepMs, restMs, o = {}) => {
    const S = makeSlice();
    let clock = 0, start = 0, work = 0;
    const now = () => clock;
    const out = [];
    for (let i = 0; i < frames; i++) {
      const interval = o.interval ? o.interval(i) : Math.max(REFRESH, work);
      start += interval; clock = start;
      const dt = Math.min(0.05, interval / 1000) * (o.speed || 1);
      const n = sliceFrame(S, dt, STEP, () => { clock += stepMs(i); }, now);
      const rest = restMs(i); clock += rest;
      work = clock - start;
      sliceRest(S, work);
      out.push({ n, sim: S.simMs, work, acc: S.acc, t: clock });
    }
    return out;
  };
  // the world's rate over the frames from `from`: world seconds per wall second
  const rate = (fr, from = 0) => { const a = fr.slice(from); const steps = a.reduce((s, f) => s + f.n, 0); const wall = (a[a.length - 1].t - (from ? fr[from - 1].t : 0)) / 1000; return steps * STEP / wall; };
  const maxWork = (fr) => Math.max(...fr.map((f) => f.work));
  const maxN = (fr) => Math.max(...fr.map((f) => f.n));
  const minN = (fr) => Math.min(...fr.map((f) => f.n));

  const a = run(600, () => 4, () => 8);
  ok("(a) cheap steps keep real time at the display's refresh: two steps a frame, every frame under the floor", a.every((f) => f.n === 2) && Math.abs(rate(a) - 1) < 0.01 && maxWork(a) <= FLOOR_MS, `rate ${rate(a).toFixed(3)}, steps ${minN(a)}–${maxN(a)}, worst frame ${maxWork(a).toFixed(1)} ms`);

  const b = run(600, () => 4.4, () => 12);
  ok("(b) the Pi's quiet sandbox (4.4 ms a step, 12 ms of rest) keeps real time under the floor", Math.abs(rate(b) - 1) < 0.01 && maxWork(b) <= FLOOR_MS && minN(b) >= 2 && maxN(b) <= 4, `rate ${rate(b).toFixed(3)}, steps ${minN(b)}–${maxN(b)}, worst frame ${maxWork(b).toFixed(1)} ms`);

  const c = run(300, () => 18, () => 12);
  const dropped = c.some((f, i) => i > 0 && f.acc === 0 && c[i - 1].acc > 0.03);
  ok("(c) dear steps (18 ms) run one a frame under the floor, the world slow, the debt capped at six steps and dropped", c.every((f) => f.n === 1) && maxWork(c) <= FLOOR_MS && rate(c) > 0.25 && rate(c) < 0.3 && c.every((f) => f.acc <= STEP * STEPS_MAX + 1e-9) && dropped, `rate ${rate(c).toFixed(3)}, worst frame ${maxWork(c).toFixed(1)} ms, debt dropped ${dropped}`);

  const d = run(60, () => 100, () => 12);
  ok("(d) a step over the floor (100 ms) still runs, one a frame: the world never stands still while it owes time", d.every((f) => f.n === 1 && Math.abs(f.work - 112) < 1e-6), `steps ${minN(d)}–${maxN(d)}, frame ${d[0].work.toFixed(1)} ms`);

  const e = run(10, () => 1, () => 2, { interval: () => 100 });
  ok("(e) a stall (100 ms frames) owes six steps and the cap of six holds, cheap as the steps are", e.every((f) => f.n === STEPS_MAX), `steps ${minN(e)}–${maxN(e)}`);

  const f = run(600, (i) => (i < 150 ? 18 : 4.4), () => 12);
  ok("(f) when the steps get cheap again the world returns to real time without a catch-up burst past what the floor allows", Math.abs(rate(f, 300) - 1) < 0.01 && maxN(f.slice(150)) <= 4 && rate(f, 150) > 0.97, `rate after ${rate(f, 300).toFixed(3)}, steps at the turn ${f[150].n}, at most ${maxN(f.slice(150))} after it`);

  const S = makeSlice(); S.stepMs = 4.5; S.restMs = 12;
  const fits = [0, 1, 2, 3, 4].map((n) => sliceAllows(S, n, n * 4.5));
  const T = makeSlice(); T.stepMs = 18; T.restMs = 12;
  ok("(g) the rule's arithmetic: on the Pi's sandbox numbers four steps fit and a fifth does not; at 18 ms a step only the first; the seventh never", fits.join() === "true,true,true,true,false" && sliceAllows(T, 0, 0) && !sliceAllows(T, 1, 18) && !sliceAllows(S, STEPS_MAX, 0), `fits ${fits.join(" ")}`);

  const R = makeSlice(); R.simMs = 18; sliceRest(R, 30); const r1 = R.restMs; sliceRest(R, 10); const r2 = R.restMs;
  ok("(h) the rest is the frame's cost outside its steps, never below zero", r1 === 12 && r2 === 0, `${r1} ${r2}`);
}
