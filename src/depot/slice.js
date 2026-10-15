// THE FRAME SLICE (0.6.12). The screen's loop runs the fixed steps a frame
// owes — up to six — so the world keeps real time. When a step is dear (the
// second after an atomic burst costs about 18 ms a step for ten seconds,
// and 100 ms for its first moments), six steps make a 110–400 ms frame: the
// picture stalls at seven frames a second while the world, capped at six
// steps a frame, runs at a third of speed anyway. The slice holds the frame
// to the floor instead, thirty frames a second: before each step after the
// first it asks whether that step, at the cost the last step showed, still
// fits beside the frame's other work (the last frame's cost outside its
// steps: the draw, the overlays, the top bar) inside the floor; when it does
// not, the frame draws with the steps it has and the world runs slow for
// that frame. The first owed step always runs, so the world never stands
// still while it owes time; the cap of six stays; the time a frame cannot
// afford is dropped by the loop's old law (an accumulator past six steps
// resets), never caught up — catching up is what packs steps. The engine is
// untouched: the same fixed steps, fewer a frame. Every device finds its own
// pace under the one rule: a frame that fits four steps keeps real time at
// the floor; one that fits two runs at half.

export const FLOOR_MS = 1000 / 30; // the frame the floor allows
export const STEPS_MAX = 6;        // the loop's old cap, kept

export function makeSlice() { return { acc: 0, stepMs: 0, restMs: 0, simMs: 0 }; }

// May a further step start? `n` have run this frame, `spentMs` between them.
export function sliceAllows(S, n, spentMs) {
  if (n === 0) return true;
  if (n >= STEPS_MAX) return false;
  return spentMs + S.stepMs + S.restMs <= FLOOR_MS;
}

// One frame's steps. `dtS` is the frame's world time in seconds (the caller
// caps it, scales it by the speed and zeroes it while paused), `stepS` the
// fixed step, `step()` runs one, `now()` reads a clock in milliseconds.
// Returns the steps run; S.simMs holds their cost, S.acc the time still owed.
export function sliceFrame(S, dtS, stepS, step, now) {
  S.acc += dtS;
  const t0 = now();
  let t = t0, n = 0;
  while (S.acc >= stepS && sliceAllows(S, n, t - t0)) {
    S.acc -= stepS;
    step();
    const t1 = now();
    S.stepMs = t1 - t; t = t1; n++;
  }
  S.simMs = t - t0;
  if (S.acc > stepS * STEPS_MAX) S.acc = 0;
  return n;
}

// The frame's whole cost, measured by the caller at its end: what was not
// stepping is the rest the next frame's steps must fit beside.
export function sliceRest(S, frameMs) { S.restMs = Math.max(0, frameMs - S.simMs); }
