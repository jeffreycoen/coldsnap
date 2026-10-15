# T12 — The frame slice (0.6.12)

One line. The screen's loop runs the fixed steps a frame owes — up to six — so the world keeps real time; after an atomic burst a step costs about 18 ms for ten seconds, and 100 ms for its first moments, so six steps make a 110–400 ms frame and the picture stalls at seven frames a second while the world, capped at six steps a frame, runs at a third of speed anyway. This task gives the loop a floor of thirty frames a second: before each step after the first, the loop asks whether that step, at the cost the last step showed, still fits beside the frame's other work inside the floor, and when it does not, the frame draws with the steps it has and the world runs slow for that frame. The first owed step always runs, the cap of six stays, and the time a frame cannot afford is dropped as the loop already dropped it, never caught up. The engine, the war's tick and every saved thing are untouched: the same fixed steps, fewer a frame. Then the browser bench runs again on T9's seed beside T11's runs.

Checked on a fresh copy at plan-writing time: every file parses and the site builds; `depot-lint` PASS; `depot-test` 1738 PASS / 0 FAIL (T11's 1730 plus the eight new asserts); smoke 27/27; the keystone unchanged before and after; the four browser runs on T9's seed 121051 on the Pi's display, graphics card real: the ten seconds after the burst at 25.9–26.4 frames a second in the sandbox and 24.9–25.5 in the war (T11: 7.2–7.3 and 6.6–6.7), the frame around the burst 131–132 ms in the sandbox and 105 in the war (T11: 398–401 and 165–384), the worst frame of the window 131–132 and 116–118 (T11: 398–401 and 334–384), the mean frame 36.5–37.2 and 37.8–38.6 (T11: 136–137 and 147–149), no frame at six steps after the burst but one (T11: 71 of 73), the world at 0.21–0.22 of real time through the window (T11: 0.33–0.36); the quiet seconds before the burst at 42.6–42.7 frames a second in the sandbox and 33–34 in the war (T11: 41.1–42.6 and 36.2–38.2), the world at 0.825–0.831 of real time in the quiet sandbox (T11: 0.861–0.876) and 0.976–1.003 in the quiet war (T11: 1.005–1.007); the page's verdict `same world in every copy — 41 runs over 8 worlds` (the headless runs are untouched and only they are compared); the page check OK.

Suggested model: Sonnet 5.5 — one new file given whole, six exact text replacements, one new test given whole, four bench commands; the report is the numbers they print.

## Required reading, in this order

1. `CLAUDE.md`
2. This file, whole, before the first edit.
3. `src/depot/DepotGame.jsx` lines 300–316 (the view object), 795–832 (the fixed step and the stopwatch), 902–927 (the frame's start, its clock and the paused world), 1139–1162 (the loop this task replaces), 1323–1328 (the draw), 1621–1646 (the stopwatch's ring and the frame's end).
4. `src/depot/slice.js` does not exist yet; `scripts/tests/harness.mjs` (the suite's `ok`), `scripts/depot-test.mjs` lines 60–73 (the era list's tail).
5. `scripts/diag-davy-browser.mjs` whole (the browser bench: the stopwatch's ring read back, the fields it prints), `docs/superpowers/perf/davy/page.mjs` (the page; the browser table at its end) and `all.sh` (the preview server's start and the browser runs, lines 29–37).
6. `docs/superpowers/plans/2026-10-14-t11-the-bang.md` — the sections "The seed law" and "Gates", Step 16 and Step 17 item 7 (the browser readings and how they are read).

The report opens with a line confirming every file above was read.

## The design, plainly

**The loop today.** Each frame adds its wall time (capped at 50 ms, scaled by the speed button, zero while paused) to an accumulator and runs one fixed step of 1/120 s for every step's worth in it, up to six; an accumulator past six steps resets to zero. The stopwatch (`?perf=1`) brackets the steps and the draw into a ring the browser bench reads. In quiet play on the Pi a step costs 4.4 ms in the sandbox and 4.8 in the war, the frame runs at 36–43 frames a second, and the world keeps real time. After the burst a step costs 18 ms on average for ten seconds (30 at the 95th step, 100–140 in the first moments); the loop packs six into a frame: 110–400 ms a frame, 7 frames a second, the world at 0.35 of real time (the bench's `after:` line of every T11 browser run).

**The slice.** The loop's law moves into its own file, `src/depot/slice.js`, and gains one rule. The slice keeps the accumulator, the cost of the last step run and the cost of the last frame outside its steps (everything that is not stepping: the draw, the overlays, the top bar — measured at the end of every frame, stopwatch or not). Before each step after the first it allows the step only if the stepping done so far this frame, plus the last step's cost, plus the last frame's rest, fits in the floor, 1000/30 ms. The first owed step always runs, so the world never stands still while it owes time; the cap of six stays; the reset past six steps stays, so the debt a frame cannot pay is dropped, never caught up — catching up is what packs steps. `DepotGame.jsx` keeps the hookup: the frame's clock, the call, the step's own body unchanged inside it, and the rest's measure at the frame's end. The stopwatch's ring still records the steps run per frame (the count the call returns).

**What it does, by the measured costs.** Quiet play on the Pi: four sandbox steps fit (13.2 ms of stepping, plus 4.4, plus a rest of about 12, is under 33.3), so the frame holds real time at thirty or more frames a second as it does now. The second after the burst: one step a frame (18 plus 18 plus 12 is over the floor), so the frame costs about 30 ms, the picture holds about thirty frames a second, and the world runs at about a quarter of real time until the steps get cheap again, then returns to real time within a few frames. The first moments after the burst, at 100–140 ms a step, cost 110–150 ms a frame no matter how the loop slices: a single step over the floor can only be made cheaper, which is the settle rules' task, not this one. The fast-forward button holds the floor too: by the same arithmetic it reaches about 1.1 times real time on the Pi instead of about 1.3. A device whose quiet step is dear finds its own pace under the one rule: a frame that fits four steps keeps real time at the floor, one that fits two runs the whole game at half speed, smooth, where today it runs at real time at twenty frames a second. These are arithmetic from the Pi's measured costs, not measurements; the browser bench measures the Pi, and the live check on the phone is the owner's.

**What is identical.** Every fixed step is the same step: the engine, `tickWar`, the saves, the hashes and the draw counts of every headless run. The step's body in the loop is unchanged, line for line, inside the call. Pausing, the convoy's window, the teaching cards and the end card still zero the frame's world time. The loop's cap and its reset keep their numbers.

**What this buys, on the fresh copy.** The frame around the burst: 400 → 131 ms in the sandbox, 165–384 → 105 in the war. The ten seconds after: 7 → 26 frames a second in the sandbox, 6.6 → 25 in the war; the mean frame 136–149 → 37–39 ms; no frame carries six steps. The floor of thirty is not reached in that window: 146–163 of its 252–265 frames are over 33 ms, by a few milliseconds, because one step costs 24–26 ms there (the window is the heaviest two seconds of world time, now stretched over ten seconds of wall time) and the draw 12; a single step over the floor is the settle rules' task. The world runs at 0.21–0.22 of real time through that window instead of 0.33–0.36: the slow motion is smooth and longer. In quiet play the frame rate is unchanged and the world rate drops a little in the sandbox, 0.86–0.88 → 0.83: the quiet sandbox stalls once or twice a second in the browser (a step of 49–60 ms where the headless step costs 4.5; T11's record shows the same stalls), the old loop paid the debt with six-step frames of 40–53 ms, and the slice pays it at three or four steps a frame, so when the next stall comes first the reset drops it; those stalls are noted for the queue, not folded in. The war's quiet world rate reads 0.98–1.00 (T11 1.005–1.007) at 33–34 frames a second against 36–38, with its step 5.0–5.3 ms in this run against 4.8–4.9 in T11's.

## The seed law

The browser bench rolls its seed at startup and prints it first; this task's runs pass back T9's drawn seed, 121051, so the twin's records land beside T11's on the page and are read against them. No seed is written into any script. Every run appends one line to `.superpowers/experiments.log`.

## Gates

Run only these, each through `node scripts/gate.mjs <name>`: `depot-lint`, `depot-test`, `smoke`. The smoke needs `npm run build` then `npm run preview &` first. `golden` does not run: the engine is untouched.

The keystone: `node src/depot/api.js gate 7 20` prints `seed 7  seconds 20 (2400 steps)  worldHash 1278094788  runHash 2033212782` on the untouched tree. Step 0 confirms it; Step 11 confirms it again unchanged. Any other number stops the task.

The new test's asserts are the only test change. Any other failing test stops the task, with one named exception: test 48 (the outbreak), assert `(k) the sickness stamp rides the save`, fails with `(0->0)` on seeds where no living man of the second side stands at two seconds (the untouched engine fails such seeds the same way); on exactly that line, run `node scripts/gate.mjs depot-test` once more on its new rolled seed and report both runs. Any other line, or a second failure, stops the task.

## Steps

Line numbers are the untouched tree's, for orientation; the text shown is the anchor, and it must match exactly once.

### Step 0 — the keystone, before

Run `node src/depot/api.js gate 7 20`. The output must read exactly `seed 7  seconds 20 (2400 steps)  worldHash 1278094788  runHash 2033212782`. Record it.

### Step 1 — the test, written first

Create `scripts/tests/57-the-frame-slice.mjs` with exactly this:

```js
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
```

In `scripts/depot-test.mjs`, at line 72, replace exactly this:

```js
await import("./tests/56-the-bang.mjs");
```

with exactly this:

```js
await import("./tests/56-the-bang.mjs");
await import("./tests/57-the-frame-slice.mjs");
```

Run `node scripts/tests/57-the-frame-slice.mjs`. It fails before its first assert with `Error [ERR_MODULE_NOT_FOUND]: Cannot find module` naming `src/depot/slice.js`. Record that line.

### Step 2 — the slice

Create `src/depot/slice.js` with exactly this:

```js
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
```

### Step 3 — the hookup

In `src/depot/DepotGame.jsx`, at line 51, replace exactly this:

```js
import { countAwake } from "./witness.js";
```

with exactly this:

```js
import { countAwake } from "./witness.js";
import { makeSlice, sliceFrame, sliceRest } from "./slice.js"; // 0.6.12: the frame slice — the loop's law, in its own file
```

At line 308, in the view object, replace exactly this:

```js
        acc: 0, t: 0, fps: 60, fpsAcc: 0, fpsN: 0,
```

with exactly this:

```js
        slice: makeSlice(), t: 0, fps: 60, fpsAcc: 0, fpsN: 0, // 0.6.12: the slice holds the step accumulator
```

At line 799, replace exactly this:

```js
      const STEP = 1 / 120;
```

with exactly this:

```js
      const STEP = 1 / 120;
      const sliceNow = () => performance.now(); // 0.6.12: the frame slice's clock
```

At line 907, replace exactly this:

```js
        const pFrame0 = perf ? performance.now() : 0;
```

with exactly this:

```js
        const sliceF0 = performance.now(); // 0.6.12: the frame slice measures every frame, stopwatch or not
        const pFrame0 = perf ? sliceF0 : 0;
```

At line 1139, replace exactly this:

```js
          view.acc += sdt;
          // The bell, spawn/withdrawal, income,
          // territory/sight, mines, fog, dead-bag release, the pool rebuild,
          // stepDepot, the possessed triggers, the event drain, the census
          // and the market all moved into tickWar — one call per fixed
          // sub-step below. TickFlags tells the component which renderer
          // twins to refresh.
          let terrFlagged = false, dressFlagged = false;
          const frameEvents = [];
          const pSim0 = perf ? performance.now() : 0; // stopwatch: sim bracket opens
          let guard = 0;
          while (view.acc >= STEP && guard++ < 6) {
            view.acc -= STEP;
            const { events, flags } = tickWar(war, STEP, input);
            frameEvents.push(...events);
            if (flags.bell) { view.teachFire("bell"); run.manifest.armedAtWall = performance.now() / 1000 + PENDING_ARM_S; }
            if (flags.territory) terrFlagged = true;
            if (flags.dressing) dressFlagged = true;
            if (flags.withdrew) toast("THEY BREAK CONTACT");
            if (flags.teslaFired) view._teslaFired = (view._teslaFired || 0) + 1;
            for (const e of events) if (e.type === "kill") view.teachFire("kill_price");
          }
          if (perf) pSim = performance.now() - pSim0; // ...and closes
          if (view.acc > STEP * 6) view.acc = 0;
```

with exactly this:

```js
          // The bell, spawn/withdrawal, income,
          // territory/sight, mines, fog, dead-bag release, the pool rebuild,
          // stepDepot, the possessed triggers, the event drain, the census
          // and the market all moved into tickWar — one call per fixed
          // sub-step below. TickFlags tells the component which renderer
          // twins to refresh.
          let terrFlagged = false, dressFlagged = false;
          const frameEvents = [];
          const pSim0 = perf ? performance.now() : 0; // stopwatch: sim bracket opens
          // THE FRAME SLICE (0.6.12): the steps owed this frame run through
          // slice.js — as many as fit beside the frame's other work inside the
          // floor of thirty frames a second, never more than six, the first
          // always; the time the frame cannot afford is dropped, never caught
          // up. The step's own body is unchanged inside the call.
          const guard = sliceFrame(view.slice, sdt, STEP, () => {
            const { events, flags } = tickWar(war, STEP, input);
            frameEvents.push(...events);
            if (flags.bell) { view.teachFire("bell"); run.manifest.armedAtWall = performance.now() / 1000 + PENDING_ARM_S; }
            if (flags.territory) terrFlagged = true;
            if (flags.dressing) dressFlagged = true;
            if (flags.withdrew) toast("THEY BREAK CONTACT");
            if (flags.teslaFired) view._teslaFired = (view._teslaFired || 0) + 1;
            for (const e of events) if (e.type === "kill") view.teachFire("kill_price");
          }, sliceNow);
          if (perf) pSim = performance.now() - pSim0; // ...and closes
```

At line 1636, at the frame's end, replace exactly this:

```js
            pI = (pI + 1) % PCAP; pN++;
          }
        } catch (err) {
```

with exactly this:

```js
            pI = (pI + 1) % PCAP; pN++;
          }
          sliceRest(view.slice, performance.now() - sliceF0); // 0.6.12: the frame's cost outside its steps, for the next frame's slice
        } catch (err) {
```

### Step 4 — the parse check and the test

Run `node --check src/depot/slice.js`; it prints nothing. Run `npx vite build --logLevel error`; it prints nothing (the screen's file is JSX; the build is its parse check, and Step 6 builds again after the mark). Then `grep -c "view\.acc\b" src/depot/DepotGame.jsx` prints `0`, `grep -c "sliceFrame\|sliceRest\|makeSlice" src/depot/DepotGame.jsx` prints `4`, `grep -c "sliceNow\|sliceF0" src/depot/DepotGame.jsx` prints `5`. Run `node scripts/tests/57-the-frame-slice.mjs`: eight PASS, no FAIL. Record the eight lines with their numbers.

### Step 5 — the mark

In `src/version.js` change `export const MK = "0.6.11";` to `export const MK = "0.6.12";`.

### Step 6 — the gates and the keystone

Run, in this order, `node scripts/gate.mjs depot-lint`, `node scripts/gate.mjs depot-test`, then `npm run build`, `npm run preview &`, `node scripts/gate.mjs smoke`. Record each gate's last line and the depot-test totals (1738 PASS / 0 FAIL on the fresh copy: T11's 1730 plus the eight new asserts). Run `node src/depot/api.js gate 7 20`; it must print the Step 0 line exactly.

### Step 7 — the landing of the slice

Commit exactly these files in one commit: `src/depot/slice.js`, `src/depot/DepotGame.jsx`, `src/version.js`, `scripts/tests/57-the-frame-slice.mjs`, `scripts/depot-test.mjs`, and this file (`docs/superpowers/plans/2026-10-15-t12-the-frame-slice.md`). Subject: `the frame slice, 0.6.12`. Push.

### Step 8 — the browser runs

From the repository root, with the display attached (`xdpyinfo -display :0 | head -3` must print a screen), run in this order:

```
pkill -f "[v]ite preview" || true; sleep 1
( npm run preview -- --strictPort --port 4173 >/tmp/davy-preview.log 2>&1 & )
curl -sf --retry 30 --retry-delay 1 --retry-all-errors http://localhost:4173/coldsnap/ -o /dev/null
TX=$(node -e "console.log(require('/home/batman/coldsnap/docs/superpowers/perf/davy/u1-sandbox-town.json').tx)")
TZ=$(node -e "console.log(require('/home/batman/coldsnap/docs/superpowers/perf/davy/u1-sandbox-town.json').tz)")
for K in 1 2; do DISPLAY=:0 node scripts/diag-davy-browser.mjs --seed 121051 --mode sandbox --tx "$TX" --tz "$TZ" --label v$K; done
for K in 1 2; do DISPLAY=:0 node scripts/diag-davy-browser.mjs --seed 121051 --mode war --tx "$TX" --tz "$TZ" --label v$K; done
pkill -f "[v]ite preview" || true
node docs/superpowers/perf/davy/page.mjs
node docs/superpowers/perf/davy/check.mjs
```

The build served is Step 6's, of the committed tree. The target is T11's (`u1-sandbox-town.json` holds it: the same seed, the same world). The four runs write `browser-v1-sandbox.json`, `browser-v2-sandbox.json`, `browser-v1-war.json`, `browser-v2-war.json` beside the page and append four lines to `.superpowers/experiments.log`; the page is rebuilt with them and its check runs.

If a run reports `gpu SOFTWARE`, the browser numbers are not usable; report it and run the four runs again once with `DISPLAY=:0` confirmed.

### Step 9 — the readings

From the four lines the runs appended to `.superpowers/experiments.log` and from the page, read the following and put them in the report as plain numbers, each twin run (`v1`, `v2` sandbox; `v1`, `v2` war) beside T11's run of the same number (`u1`, `u2` sandbox; `u1`, `u2` war):

1. The page's identity verdict (`same world in every copy — 41 runs over 8 worlds`: the headless runs are untouched and the page compares only them) and the page check's line.
2. Before the burst: `rafHz`, `worldRate`, `stepsP50`, `framesAtSix`, `simPerStep`.
3. After the burst: `rafHz`, `worldRate`, `stepsP50`, `framesAtSix`, `frameMean`, `frameP95`, `frameWorst`, `over33`, `burstFrameMs`, `burstRenderMs`.
4. `gpu` of every run.

### Step 10 — the landing of the numbers

Commit exactly these files in one commit: the four `docs/superpowers/perf/davy/browser-v*.json` records and `docs/superpowers/perf/davy/index.html`. Subject: `the frame slice measures, 0.6.12`. Push.

Then in `docs/superpowers/plans/2026-10-11-coldsnap-the-outbreak-phase.md`, after the T11 row add the row `| T12 | 0.6.12 | The frame slice: the screen's loop holds a floor of thirty frames a second — a frame runs the steps that fit beside its other work inside the floor, never more than six, the first always, and the world runs slow for the frames that cannot afford more; the engine and every step untouched; the browser bench run again on T9's seed beside T11's | LANDED — mark 0.6.12, keystone unchanged (seed 7, 20 s: 1278094788 / 2033212782), depot-test 1738, smoke 27/27, the runs at docs/superpowers/perf/davy/index.html |`. Commit that file alone with the subject `t12 lands in the phase document — 0.6.12, the frame slice, 27/27`. Push.

### Step 11 — the keystone, confirmed on the pushed tree

Run `node src/depot/api.js gate 7 20` once more and record the line; it must still match Step 0.

## Acceptance

- Step 0, Step 6 and Step 11 print the identical keystone line.
- `depot-test` 1738 PASS / 0 FAIL on a rolled seed; `depot-lint` PASS; smoke 27/27; the new test's eight asserts PASS.
- The page's verdict reads `same world in every copy`; the page check prints `PAGE CHECK OK`; `index.html` holds no `<script` tag.
- After the burst, every twin run: `rafHz` at or above 22 (the fresh copy printed 24.9–26.4; T11 6.6–7.3); `framesAtSix` at most 3 of its frames (fresh copy 0–1; T11 66–71 of 68–73); `frameMean` under 45 (fresh copy 36.5–38.6; T11 136–149); `frameWorst` under 170 (fresh copy 116–132; T11 334–401); `burstFrameMs` under 170 (fresh copy 105–132; T11 165–401); `stepsP50` 1.
- Before the burst, every twin run: `rafHz` at or above 30 (fresh copy 33–42.7); `worldRate` at or above 0.78 in the sandbox (fresh copy 0.825–0.831; T11 0.861–0.876) and at or above 0.95 in the war (fresh copy 0.976–1.003; T11 1.005–1.007).
- Reported, not gated: the after window's `worldRate` (fresh copy 0.21–0.22; T11 0.33–0.36 — slower by design) and `over33` (fresh copy 146–163 of 252–265; T11 67–72 of 68–73).
- `gpu` real on all four runs.
- Four lines in `.superpowers/experiments.log` from this task's runs, one per run, each carrying seed 121051.
- The live site, phone and desktop: nothing visible changes but the frame rate through the bang — the picture keeps moving where it stalled, and the stones settle in slow motion for longer. The owner's eyes are the acceptance.

## Report

One line of outcome, then: the read-confirmation; the Step 1 failure line; the eight test lines; every gate's result line; the three keystone lines; the depot-test totals and the era's fixture seed; the four numbered readings of Step 9 as plain numbers, twin beside T11; the commit hashes; every deviation, nonconformity, and re-pin as its own labeled bullet. The page file `docs/superpowers/perf/davy/index.html` is named as the thing to open; the live site on phone and desktop is the owner's check: nothing visible changes but the frame rate through the bang.
