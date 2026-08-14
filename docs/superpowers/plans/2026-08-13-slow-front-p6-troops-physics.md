# TROOPS & PHYSICS — phase plan (P6)

*2026-08-13. Governs the mk1.1x series. The owner's rulings shaping this phase (decision record, 2026-08-13): squads STAY the unit model (singles shelved); prices double at a half-full field; one order walks the stream crossing; ONE path system on the movement grid owns both the water detour and the mid-march stall; the masonry-contact kill is fixed in the physics rule; the site opens straight into Winter Front with all copy audited; the README leads with the showcase. The selection interface is deferred to polish. The frost tower's freeze-shot rework is deferred to the arms phase, paired with the rocket troopers.*

*Marks: Task 1 = mk1.10, then +0.01 per task. Every deploy bumps `src/version.js` and builds AFTER the bump. Task 1's commit carries the roadmap flip (The Front → DONE; a new Troops & Physics card → IN PROGRESS) per the fold-in convention.*

---

## The task list

**Task 1 — The path that walks around** — POPULATED BELOW (mk1.10).

**Task 2 — Stone doesn't murder pedestrians** — POPULATED BELOW (mk1.11).

**Task 3 — Only engineers build** — POPULATED BELOW (mk1.12).

**Task 4 — The living market** — POPULATED BELOW (mk1.13).

**Task 5 — The body lists, resurrected** — EXECUTED AND RETIRED (2026-08-13): the re-measurement failed the ship rule (idle regressed both repeats despite the cold-frame gate; the defended battle won −25% to −40%). Reverted clean; no mk1.14 shipped; the mark is NOT skipped — Task 6 takes mk1.14. Retirement recorded in the decision record.

**Task 6 — The weld scan sleeps too** — CUT (owner's ruling, 2026-08-13): the whole weld walk costs at or under the instrument's noise floor and the cache it needs is the phase's riskiest shape; its intent folds into the capacity ramp. Recorded in the decision record.

**Task 7 — The front door** — POPULATED BELOW (mk1.14).

**Task 8 — The field manual** — POPULATED BELOW (mk1.15).

**Task 9 — The README** — POPULATED BELOW (mk1.16).

**Task 10 — The body lists, third landing** — POPULATED BELOW (mk1.19; ordered by the ramp's no-headroom verdict).

**Close — the load ramp** — POPULATED BELOW (mk1.18). RUN (2026-08-14, two repeats, Amendment 1 normalization): NO HEADROOM — rung 1 (56 men fighting, 1,299 sleeping stones, 0 awake) measures 11.58/11.93 ms normalized against the 11.0 line. Task 10 answers it; the ramp re-runs after Task 10 for the real ceiling, then the market is sized and the owner's playtest closes the phase.

---

# TASK 10 — The body lists, third landing (mk1.19)

**What it does.** Re-lands the typed body pools — once per frame, the body array filters into seven pools and every hot combat scan reads its pool instead of walking the whole world, full predicates kept, behavior identical by construction. Ordered by the load ramp's verdict: a 56-man defended firefight already sits at the frame budget, and the pools' measured win lives exactly there (−25% to −40% on the defended window, on file from the second landing). The second landing was reverted on an idle regression measured by the OLD raw-per-frame instrument — the same instrument the ramp just proved reads ~3x high and distorts under the software renderer. This landing is judged by the NORMALIZED protocol.

**The governing texts, in order of authority:**
1. THIS section's delta list.
2. The mk1.14 Task 5 section below (its DELTA LIST 1-10 and Amendment 1's Step A1-1 idle gate — all folded in from the start).
3. The ARCHIVED SPEC in `docs/superpowers/plans/2026-08-13-slow-front-p5-the-front.md` ("ARCHIVED SPEC — Body lists", line ~1769) — the module code, the test block, the eighteen consumer edits, including its own Amendment (once-per-frame rebuild).

**THE DELTA LIST (third landing, supersedes where it disagrees):**
1. NAMES AND MARK: test block `P6 T10: body lists` (mk1.19); assert prefixes `T10(`; version bump `"mk1.19"`; commit subject `body lists: the hot scans stop walking the world (mk1.19)`.
2. THE IDLE GATE lands from the start (Task 5 Amendment Step A1-1 verbatim: `S._hot` from the hud census walk, cold frames null `world._L`). With no squads fielded at a fresh war's boot, a cold frame does zero pool work.
3. MEASUREMENT (supersedes Task 5 delta 6 and Amendment A1-2/A1-3): the instrument is `.superpowers/p6-lists-perf.mjs` (Step 0 below) — the load ramp's staging and its Amendment-1 NORMALIZATION. Two windows, each 12 sim-seconds, normalized frame cost = (Σ sim ms ÷ steps) × 2: WINDOW A idle (fresh war, nothing fielded), WINDOW B the ramp's rung-1 defended firefight (8 rifle squads, 24 rim enemies, 8 town shells). BEFORE = two repeats on the mk1.18 build, captured before any code lands; AFTER = two repeats on the post-bump mk1.19 build. SHIP RULE: after-norm ≤ before-norm in BOTH windows, both repeats; medians alongside; tails reported never gating.
4. ON FAILURE: revert every code edit clean and report — the owner decides what happens next. (There is NO auto-retire clause; the mk1.14-era "retires for good" wording was disclaimed by the owner and is void.)
5. ANCHOR LAW unchanged (Task 5 delta 4): function names are the anchors; the eighteen consumer sites are listed there; a site whose shape has drifted from the archived snippet is a STOP. Since mk1.13, the depot layer gained: `stepSquadRouting` (mk1.10, before the archive's second landing — already reflected), the `__DEPOTLOAD__` hook (mk1.18, hook region only), and UI-side tasks that never touch the consumer files. Expect clean matches.
6. GATES (ONLY these): parse changed files · `npm run lint:depot` · `npm run test:depot` (the T10 block red-first — module missing — then fully green, zero re-pins; any old assert moving is a STOP) · `npm run build` AFTER the bump · `SMOKE_ONLY=depot node scripts/smoke.mjs` · the Step 0 BEFORE and Step 9 AFTER captures under delta 3's ship rule. No golden — core.js untouched, game layer only.
7. AFTER THE SHIP: Step 10 re-runs the load ramp (`.superpowers/p6-load-ramp.mjs`, unchanged, two repeats) for the REAL ceiling. Its table and ceiling line go in the report; market sizing stays with the owner.

**Suggested model:** Sonnet — the spec is archived in full; the work is careful re-anchoring, the gate, and the measurement.

**Required reading (re-verify at dispatch):** this section; the Task 5 section below IN FULL; the whole ARCHIVED SPEC section in the P5 plan; `src/depot/accuracy.js` whole; `src/depot/squads.js` whole; `src/depot/state.js` — `squadFire` through `friendlyFouls`; `src/depot/units.js` whole; `src/depot/DepotGame.jsx` — imports, `stepTowers`, `engageCheck`, the frame-loop sim bracket (the `?perf=1` stopwatch region), the hud census walk (for `S._hot`); `scripts/depot-test.mjs` 1-70 + tail; `.superpowers/p6-load-ramp.mjs` whole (the staging and normalization Step 0 copies); `src/version.js`.

**Allowed files:** `src/depot/lists.js` (new), `src/depot/accuracy.js`, `src/depot/squads.js`, `src/depot/state.js`, `src/depot/units.js`, `src/depot/DepotGame.jsx`, `scripts/depot-test.mjs`, `src/version.js`, `.superpowers/p6-lists-perf.mjs` (untracked instrument).

**Step 0 — the instrument and the BEFORE.** Write `.superpowers/p6-lists-perf.mjs` exactly as follows and run it TWICE against a preview of the CURRENT (mk1.18) build; the two printed pairs are the BEFORE numbers. Foreground, fresh page per run.

```js
// p6-lists-perf.mjs — body-lists before/after instrument (P6 T10).
// Two normalized windows per run: A = idle fresh war, B = the load ramp's
// rung-1 defended firefight. Serve the build first: npm run preview.
import puppeteer from "puppeteer-core";

const BASE = process.env.SHOT_URL || "http://localhost:4173/coldsnap/";
const CHROME = process.env.CHROME_BIN || "/usr/bin/chromium";
const MEASURE_S = 12;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  protocolTimeout: 600000,
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--enable-unsafe-swiftshader", "--window-size=960,600"],
});
const page = await browser.newPage();
await page.setViewport({ width: 960, height: 600 });
await page.goto(BASE + "?seed=2307&perf=1", { waitUntil: "networkidle0" });
await page.evaluate(() => {
  localStorage.removeItem("coldsnap-front-save");
  localStorage.setItem("coldsnap-wf-manual", "off");
  localStorage.setItem("coldsnap-screen", "menu");
});
await page.reload({ waitUntil: "networkidle0" });
await page.waitForSelector('[data-menu="depot"]');
await page.click('[data-menu="depot"]');
await page.waitForFunction(() => typeof window.__DEPOT__ === "function", { timeout: 30000 });
await page.evaluate(() => window.__DEPOTSTART__());
await page.waitForFunction(() => window.__DEPOT__().t > 0.5, { timeout: 30000 });

const simT = () => page.evaluate(() => window.__DEPOT__().t);
const waitSim = async (s) => {
  const t0 = await simT();
  await page.waitForFunction((tt) => window.__DEPOT__().t >= tt, { timeout: 300000, polling: 500 }, t0 + s);
};
const measure = async (label) => {
  await page.evaluate(() => window.__DEPOTPERF__.reset());
  const tA = await simT();
  await waitSim(MEASURE_S);
  const d = await page.evaluate((tA) => {
    const p = window.__DEPOTPERF__();
    const tB = window.__DEPOT__().t;
    const sims = p.frames.map((f) => f.sim).sort((a, b) => a - b);
    const total = sims.reduce((s, v) => s + v, 0);
    const steps = Math.max(1, Math.round((tB - tA) * 120));
    const load = window.__DEPOTLOAD__();
    return {
      norm: (total / steps) * 2,
      mean: total / sims.length,
      med: sims[Math.floor(sims.length / 2)],
      p95: sims[Math.floor(sims.length * 0.95)],
      frames: sims.length, ...load,
    };
  }, tA);
  console.log(`${label} | norm ${d.norm.toFixed(2)} | raw mean ${d.mean.toFixed(2)} | med ${d.med.toFixed(2)} | p95 ${d.p95.toFixed(2)} | men ${d.men} awake ${d.awake} asleep ${d.asleep} (${d.frames}f)`);
  return d;
};

// WINDOW A — idle: a fresh war, nothing fielded, 4 settle seconds first.
await waitSim(4);
await measure("A idle");

// WINDOW B — the ramp's rung-1 defended firefight.
await page.evaluate(() => {
  const flags = window.__DEPOTFLAGS__();
  const home = flags[0];
  const toward = home.z > 0 ? -1 : 1;
  for (let i = 0; i < 8; i++) {
    window.__DEPOTSQUAD__("rifles", home.x - 14 + i * 4, home.z + toward * 10);
  }
  for (let i = 0; i < 4; i++) window.__DEPOTSPAWN__(6);
  const town = window.__DEPOTTOWN__();
  for (let k = 0; k < 8; k++) {
    const t = town[(k * 3 + 1) % town.length] || town[0];
    window.__DEPOTSHELL__(t.x, 2.0, t.z);
  }
});
await waitSim(8);
await measure("B defended");
await browser.close();
```

**Steps 1-8 — the landing.** Execute the ARCHIVED SPEC's Steps 1-8 (test block red-first, `lists.js`, the import, the eighteen consumer edits) under the Task 5 delta list (names per delta 1 here, rebuild site per its delta 2 — the frame loop, gated `if (S.acc >= STEP)` — with the idle gate from delta 2 here folded in) . Function-name anchors; STOP on drift.

**Step 9 — the verdict.** Bump `src/version.js` → `"mk1.19"`; build; run gates (delta 6); AFTER capture (instrument unchanged, two repeats, post-bump preview). Ship rule per delta 3. PASS → commit and push. FAIL → revert clean, report, stop.

**Step 10 — the new ceiling.** On a PASS only: run `.superpowers/p6-load-ramp.mjs` twice against the shipped build; report both rung tables and the ceiling line.

---

# P6 CLOSE — The load ramp (mk1.18)

**What it does.** The phase-close measurement, per the capacity-anchor ruling: escalating waves on the dense seed until the frame budget breaks, the ceiling reported in men and awake stones. That number then sizes the market's dials and settles soft cap versus hard cap — those decisions come to the owner WITH the number, they are not in this task. Two parts: one tiny read-only debug hook ships (the load gauge, mk1.18 — the only deploy), then an untracked instrument runs the ramp on this Pi and reports.

**The break line, stated once:** 60 fps gives 16.7 ms a frame; drawing measures ~5 ms flat on this Pi (mk0.50 evidence run). So the simulation's budget line is **11.0 ms mean**. The instrument gates on simulation milliseconds only — valid under the software renderer because simulation is pure CPU; render and whole-frame times under the software renderer mean nothing and never gate.

**The ramp shape:** a firing line of eight rifle squads stands before the player depot (debug-spawned, cost-free — real combat load without touching scrap). Each rung adds 24 enemy men at the rim and fires 8 shells into the town to keep masonry awake; 8 sim-seconds to settle, 12 sim-seconds measured. If the standing count plateaus (the line kills as fast as the rim spawns), the rung's spawn count doubles. The ramp ends when the sim mean crosses 11.0 ms — the ceiling is the LAST rung under it — or when a depot breaches first (reported as such). Two full repeats, fresh war each.

**Suggested model:** Sonnet — one anchored hook plus a fully specified instrument.

**Required reading (re-verify at dispatch):**
- This section, whole.
- `src/depot/DepotGame.jsx` — ONLY the debug-hook region, lines 2750-3080: `__DEPOTSPAWN__` (2763), `__DEPOTFLAGS__` (2766), `__DEPOTTOWN__` (2767), `__DEPOTSHELL__` (2789), `__DEPOTSQUAD__` (2873), `__DEPOTSANDBAGS__` (3040 — the Step 1 anchor), and the `?perf=1` stopwatch (3053-3077: `__DEPOTPERF__` exists ONLY with the flag; returns oldest-first frames of `{t, sim, render, frame}` in ms plus `.reset()`).
- `scripts/smoke.mjs` — lines 1-56 (launch block the instrument mirrors).
- `src/version.js` — whole.

**Trap notes:**
- `?perf=1` must be in the URL or `__DEPOTPERF__` never exists.
- Gate on `sim` ms only. Never on `render`, `frame`, or wall-clock fps — the software renderer poisons all three.
- The stopwatch ring holds 4096 frames — a 12-second window always fits.
- Watch `__DEPOT__().breach` and `.enemyBreach` every rung; a breach ends the run with an honest "war ended before the budget broke" line.
- The field manual flag is set off before entry; the save key is cleared.
- No game logic changes — the hook is read-only. Any test movement at all is a STOP.
- The instrument stays untracked in `.superpowers/`.

**Step 1 — the load gauge.** In `DepotGame.jsx`, immediately after the `__DEPOTSANDBAGS__` line (3040), add:

```js
      window.__DEPOTLOAD__ = () => {
        // the load ramp's gauge (P6 close): live men and the awake/asleep
        // stone split, counted fresh on each call — read-only, no cadence.
        let men = 0, awake = 0, asleep = 0;
        for (const b of world.bodies) {
          if (!b.alive) continue;
          if (b.kind === "unit") men++;
          else if (b.kind === "chunk") { if (b.sleeping) asleep++; else awake++; }
        }
        return { men, awake, asleep };
      };
```

**Step 2 — ship the gauge.** `src/version.js` MK → `"mk1.18"`; build AFTER the bump; commit `the load gauge: one read-only counter for the ramp (mk1.18)` (with the standard trailer); push. Gates for this step: `node scripts/depot-lint.mjs` · `npm run build` · `SMOKE_ONLY=depot node scripts/smoke.mjs`.

**Step 3 — the instrument `.superpowers/p6-load-ramp.mjs` (untracked), exactly this, then run it twice** against `npm run preview` serving the post-bump build; both runs' tables go in the report:

```js
// p6-load-ramp.mjs — P6 phase-close capacity ramp. Serve the built bundle
// first (npm run preview). Gates on SIM ms only; see the plan's break line.
import puppeteer from "puppeteer-core";

const BASE = process.env.SHOT_URL || "http://localhost:4173/coldsnap/";
const CHROME = process.env.CHROME_BIN || "/usr/bin/chromium";
const BREAK_MS = 11.0, SETTLE_S = 8, MEASURE_S = 12, MAX_RUNGS = 20;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  protocolTimeout: 600000,
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--enable-unsafe-swiftshader", "--window-size=960,600"],
});
const page = await browser.newPage();
await page.setViewport({ width: 960, height: 600 });
await page.goto(BASE + "?seed=2307&perf=1", { waitUntil: "networkidle0" });
await page.evaluate(() => {
  localStorage.removeItem("coldsnap-front-save");
  localStorage.setItem("coldsnap-wf-manual", "off");
  localStorage.setItem("coldsnap-screen", "menu");
});
await page.reload({ waitUntil: "networkidle0" });
await page.waitForSelector('[data-menu="depot"]');
await page.click('[data-menu="depot"]');
await page.waitForFunction(() => typeof window.__DEPOT__ === "function", { timeout: 30000 });
await page.evaluate(() => window.__DEPOTSTART__());
await page.waitForFunction(() => window.__DEPOT__().t > 0.5, { timeout: 30000 });

// The firing line: eight rifle squads across the depot's front.
await page.evaluate(() => {
  const flags = window.__DEPOTFLAGS__();
  const home = flags[0];
  const toward = home.z > 0 ? -1 : 1; // face mid-field
  for (let i = 0; i < 8; i++) {
    window.__DEPOTSQUAD__("rifles", home.x - 14 + i * 4, home.z + toward * 10);
  }
});

const simT = () => page.evaluate(() => window.__DEPOT__().t);
const waitSim = async (s) => {
  const t0 = await simT();
  await page.waitForFunction((tt) => window.__DEPOT__().t >= tt, { timeout: 300000, polling: 500 }, t0 + s);
};

let prevMen = 0, spawnCalls = 4, ceiling = null, broke = null;
console.log("rung | spawned+ | men | awake | asleep | sim mean | median | p95");
for (let r = 1; r <= MAX_RUNGS; r++) {
  await page.evaluate(({ n, rung }) => {
    for (let i = 0; i < n; i++) window.__DEPOTSPAWN__(6);
    const town = window.__DEPOTTOWN__();
    for (let k = 0; k < 8; k++) {
      const t = town[(k * 3 + rung) % town.length] || town[0];
      window.__DEPOTSHELL__(t.x, 2.0, t.z);
    }
  }, { n: spawnCalls, rung: r });
  await waitSim(SETTLE_S);
  await page.evaluate(() => window.__DEPOTPERF__.reset());
  await waitSim(MEASURE_S);
  const d = await page.evaluate(() => {
    const p = window.__DEPOTPERF__();
    const sims = p.frames.map((f) => f.sim).sort((a, b) => a - b);
    const mean = sims.reduce((s, v) => s + v, 0) / sims.length;
    const med = sims[Math.floor(sims.length / 2)];
    const p95 = sims[Math.floor(sims.length * 0.95)];
    const load = window.__DEPOTLOAD__();
    const st = window.__DEPOT__();
    return { mean, med, p95, ...load, breach: st.breach, ebreach: st.enemyBreach, frames: sims.length };
  });
  console.log(`${r} | +${spawnCalls * 6} | ${d.men} | ${d.awake} | ${d.asleep} | ${d.mean.toFixed(2)} | ${d.med.toFixed(2)} | ${d.p95.toFixed(2)} (${d.frames}f)`);
  if (d.breach || d.ebreach) { console.log(`RUN ENDS: a depot breached at rung ${r} before the budget broke`); break; }
  if (d.mean > BREAK_MS) { broke = { r, ...d }; console.log(`BUDGET BROKE at rung ${r}: sim mean ${d.mean.toFixed(2)} ms > ${BREAK_MS}`); break; }
  ceiling = { r, men: d.men, awake: d.awake, mean: d.mean };
  if (d.men < prevMen * 1.1) spawnCalls = Math.min(spawnCalls * 2, 32); // plateau: the line kills as fast as the rim spawns
  prevMen = d.men;
}
console.log("CEILING (last rung under budget):", JSON.stringify(ceiling));
await browser.close();
```

**Step 4 — the report.** Both repeats' full rung tables; the ceiling stated in one plain line — men standing and stones awake at the last rung under 11.0 ms — means and medians shown, tails shown never gating. No dial changes, no cap decision: those are served to the owner as questions with the number in hand.

---

**AMENDMENT 1 (2026-08-14, owner-approved after the first run):** the raw per-frame sim mean is NOT comparable to the 11.0 ms line under the software renderer — a ~20 fps page catches up ~6 physics steps per frame where a real 60 fps frame does 2, so the same per-step cost reads ~3x. (First run's finding preserved: 56 men fighting + 1,299 sleeping stones measured 35-36 ms raw ≈ 11.8 ms normalized — a defended firefight already sits AT the budget line.) The instrument normalizes and gates on the TRUE 60 fps frame cost:

- Bracket the measure window in sim time: capture `tA = __DEPOT__().t` right after `__DEPOTPERF__.reset()`, and `tB` inside the read. Steps executed = `(tB − tA) × 120`.
- Normalized frame cost = `(sum of all sim ms in the window ÷ steps) × 2`.
- The gate, the break print, and the ceiling record use the NORMALIZED number; the table gains a `norm` column ahead of the raw mean (raw mean/median/p95 still shown, never gating).
- Everything else — rungs, spawns, shells, plateau doubling, breach guard, two repeats — unchanged. Re-run both repeats in full.

---

# TASK 9 — The README (mk1.16)

**What it does.** The README stops describing the proving grounds and starts selling the war. Showcase first: the floppy-disk hook, four screenshots from the running game, the bold true claims — every one fact-checked against the live code and the measured bundle this session. The technical section beneath, for engineers who keep reading. The owner's rulings: the floppy leads; the screenshot row is collapse-led; the demo history gets one sentence.

**The numbers behind the claims (measured 2026-08-14, this tree):** built bundle 1.25 MB total (one JS file + index.html — under a 1.44 MB floppy), ~395 KB gzipped; core.js 2,407 dependency-free lines; fixed 1/120s timestep; two-tier broadphase Pi measurements idle 5.0→3.1 ms, assault+collapse 10.8→7.3 ms; instanced caps 3,000 stones / 360 trees; audio fully procedural, zero asset files. Screenshots live in `docs/media/` which is NOT in `dist/` — the floppy claim is unaffected by them.

**Suggested model:** Sonnet — staging and prose are fully specified.

**Required reading (re-verify at dispatch):**
- This task section, whole.
- `README.md` — whole (73 lines; replaced by the text below, credits kept verbatim).
- `src/depot/DepotGame.jsx` — ONLY the debug-hook region, lines 2750-3080 (every `window.__DEPOT*__` the capture script calls: `__DEPOT__`, `__DEPOTSTART__`, `__DEPOTEND__`, `__DEPOTSPAWN__`, `__DEPOTBELL__`, `__DEPOTMANIFEST__`, `__DEPOTSQUADS__`, `__DEPOTSCREENAT__`, `__DEPOTFLAGS__`, `__DEPOTENEMYPOS__`) — confirm each hook's exact return shape before writing the waits that read them.
- `scripts/smoke.mjs` — lines 1-56 (the launch block the capture script mirrors) and 209-250 (the depot entry pattern).
- `src/version.js` — whole.

**Trap notes:**
- The field manual (mk1.15) now greets a fresh war — the capture boot sets `coldsnap-wf-manual` to `"off"` BEFORE entering so no card covers a shot.
- `__DEPOTSQUADS__`/`__DEPOTENEMYPOS__` return shapes are asserted at dispatch, not assumed — if a shape differs from what the script expects, fix the READ side only.
- Any stage that cannot be landed as specified (a pie that will not open to a DOM click, a reticle that will not show) is a STOP: screenshot the failed stage, report, do not improvise a different picture.
- Swiftshader runs the world at roughly a third of wall time — waits are generous and condition-based, never bare sleeps where a condition exists.
- The four PNGs are chosen by the agent ONLY for stage-correctness (the staged thing is on screen); the owner judges the look in the rendered README on GitHub — no screenshot-approval loop.
- README claims are locked as written below — not one number or claim is edited without a STOP.
- `docs/media/` is new; create it. Do not touch `dist/`.

**Step 1 — the capture script `.superpowers/t9-readme-shots.mjs` (untracked), exactly this, then run it** against a local preview (`npm run build && npm run preview` first — build of the CURRENT tree, mk1.15):

```js
// .superpowers/t9-readme-shots.mjs — stages the README's four screenshots.
// Serve the built bundle first: npm run build && npm run preview
// Candidates land in .superpowers/; Step 2 copies the keepers to docs/media/.
import puppeteer from "puppeteer-core";

const BASE = process.env.SHOT_URL || "http://localhost:4173/coldsnap/";
const CHROME = process.env.CHROME_BIN || "/usr/bin/chromium";
const W = 1440, H = 810;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  protocolTimeout: 600000,
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--enable-unsafe-swiftshader", `--window-size=${W},${H}`],
});

// One fresh war per shot. Seed 2307 — the dense proving seed (hills, town,
// stream). The manual flag is set off BEFORE entry so no card covers a shot.
async function boot() {
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H });
  await page.goto(BASE + "?seed=2307", { waitUntil: "networkidle0" });
  await page.evaluate(() => {
    localStorage.removeItem("coldsnap-front-save");
    localStorage.setItem("coldsnap-wf-manual", "off");
    localStorage.setItem("coldsnap-screen", "menu");
  });
  await page.reload({ waitUntil: "networkidle0" });
  await page.waitForSelector('[data-menu="depot"]');
  await page.click('[data-menu="depot"]');
  await page.waitForFunction(() => typeof window.__DEPOT__ === "function", { timeout: 30000 });
  await page.evaluate(() => window.__DEPOTSTART__());
  await page.waitForFunction(() => window.__DEPOT__().t > 0.5, { timeout: 30000 });
  return page;
}

// SHOT 1 — wf-collapse.png. The depot's masonry mid-fall: the loss collapse
// fires at the camera's home focus and the end card is delayed by design,
// so the frame is clean stone in motion.
{
  const page = await boot();
  await sleep(1500);
  await page.evaluate(() => window.__DEPOTEND__(false));
  await sleep(1400);
  await page.screenshot({ path: ".superpowers/wf-collapse.png" });
  console.log("shot 1 landed:", await page.evaluate(() => ({ t: window.__DEPOT__().t, breach: window.__DEPOT__().breach })));
  await page.close();
}

// SHOT 2 — wf-front.png. The opening front under assault: enemies spawned
// and marched into the defenders' sight, fog holding beyond it.
{
  const page = await boot();
  await page.evaluate(() => { window.__DEPOTSPAWN__(6); window.__DEPOTSPAWN__(6); });
  await page.waitForFunction(() => {
    const flags = window.__DEPOTFLAGS__();
    const home = flags.find((f) => f.kind === "depot") || flags[0];
    if (!home) return false;
    return window.__DEPOTENEMYPOS__().some((e) => {
      const dx = e.x - home.x, dz = e.z - home.z;
      return dx * dx + dz * dz < 26 * 26;
    });
  }, { timeout: 240000, polling: 1000 });
  await sleep(800);
  await page.screenshot({ path: ".superpowers/wf-front.png" });
  console.log("shot 2 landed: enemies in sight range");
  await page.close();
}

// SHOT 3 — wf-takecontrol.png. Possession: tap the starting rifle squad's
// anchor, take TAKE CONTROL off its pie, let the red reticle show.
{
  const page = await boot();
  const at = await page.evaluate(() => {
    const sq = window.__DEPOTSQUADS__()[0];
    // anchor field names verified at dispatch against the hook body
    const p = window.__DEPOTSCREENAT__(sq.x ?? sq.ax, sq.z ?? sq.az);
    return { x: p.x, y: p.y };
  });
  await page.mouse.click(at.x, at.y);
  await page.waitForFunction(
    () => [...document.querySelectorAll("button")].some((b) => /TAKE CONTROL/.test(b.textContent)),
    { timeout: 10000 },
  );
  await page.evaluate(() => {
    [...document.querySelectorAll("button")].find((b) => /TAKE CONTROL/.test(b.textContent)).click();
  });
  await sleep(600);
  await page.mouse.move(W / 2 + 180, H / 2 - 90); // steer the reticle out where it reads
  await sleep(900);
  await page.screenshot({ path: ".superpowers/wf-takecontrol.png" });
  console.log("shot 3 landed:", await page.evaluate(() => ({ possessed: !!document.body.innerText.match(/RELEASE|POSSESS/i) })));
  await page.close();
}

// SHOT 4 — wf-bell.png. The muster bell's convoy: force the bell, capture
// with the manifest card up.
{
  const page = await boot();
  await page.evaluate(() => window.__DEPOTBELL__(0));
  await page.waitForFunction(() => {
    const m = window.__DEPOTMANIFEST__();
    return m && m.offers && m.offers.length > 0;
  }, { timeout: 60000, polling: 500 });
  await sleep(600);
  await page.screenshot({ path: ".superpowers/wf-bell.png" });
  console.log("shot 4 landed:", await page.evaluate(() => window.__DEPOTMANIFEST__()));
  await page.close();
}

await browser.close();
console.log("four candidates in .superpowers/ — copy keepers to docs/media/");
```

**Step 2 — place the keepers.** `mkdir -p docs/media`, copy the four PNGs to `docs/media/wf-collapse.png`, `wf-front.png`, `wf-takecontrol.png`, `wf-bell.png`. Keeper rule: the staged thing is on screen (stones mid-fall; enemies visible with fog beyond; the red reticle up; the manifest card up). A shot failing that rule after two staging attempts is a STOP.

**Step 3 — `README.md`, replaced whole with exactly this:**

````markdown
# COLDSNAP — WINTER FRONT

**A full physics war game that fits on a floppy disk.** 💾

The whole thing — the war, the engine, five tech demos, every sound — is one 1.25 MB bundle, about 395 KB over the wire.

**PLAY:** https://jeffreycoen.github.io/coldsnap/

| | |
|---|---|
| ![A building collapsing under shellfire](docs/media/wf-collapse.png) | ![A walled front under assault, fog beyond](docs/media/wf-front.png) |
| ![Driving a possessed squad, the red reticle up](docs/media/wf-takecontrol.png) | ![The muster bell's convoy manifest](docs/media/wf-bell.png) |

Destruction here is structural, not scripted. Every building is individual stones held together by welds with real break forces — a collapse is the physics finding out, not an animation playing.

- **The physics engine is written from scratch in plain JavaScript.** No game engine, no physics library, no WebAssembly. Three.js pushes the triangles; React draws the menus.
- **Deterministic to the bit.** No hidden randomness anywhere. Same seed, same valley; same actions, same war — provable by hash, and tested that way on every push.
- **Every valley is drawn fresh.** Hills, a stream with one crossing, villages, forests — no two wars share ground. `?seed=` replays a specific one.
- **The enemy lives under your rules.** Same physics, same shared market, same prices, same purchase pacing. Symmetry is law.
- **Sight is honest.** Walls block sight and never grant it. An enemy no one sees is not drawn at all.
- **Every sound is synthesized.** Zero audio files: gunfire, the bell, the wind — all procedural, tuned against published acoustics. Distant fire arrives late — sound travels at 343 m/s in-game — and echoes off rock and masonry while the snowfield stays dead.
- **A whole war saves as one JSON string.** The map is not saved — it regrows from its seed, and the war's scars are laid back over it. Lose your depot and the save burns. No rewinds.
- **60 fps on a Raspberry Pi.** The game was built, measured, and played on the machine it targets.

The war itself: every 90 seconds the muster bell rings and the convoy offers new mercenaries — pick one. Both armies buy from one living market where every price is a census of what already stands on the field. Only engineers build. Any squad or tower can be taken over and driven directly while the front fights on. Dead men stain the snow for the whole war.

## Under the hood

- **Engine** (`src/engine/core.js`, ~2,400 dependency-free lines): sequential-impulse rigid-body solver — boxes, quaternions, friction, stacking — with welds that carry break forces, sleeping bodies, and a fixed 120 Hz timestep.
- **Two-tier collision books**: sleeping and immovable stones file into the broadphase once and stay filed — a cell of settled masonry does no pair work. Measured on the Pi: idle simulation 5.0 → 3.1 ms, assault plus collapse 10.8 → 7.3 ms, physics bit-identical before and after.
- **Determinism culture**: every random draw is seeded and draw-count-stable (a lint gate forbids `Math.random` in game logic); the original demo is byte-frozen and `scripts/golden.mjs` re-extracts the engine from it on every push, asserting bit-identical world-state hashes; behavior changes are pinned by keystone hashes.
- **Renderer** (`src/render/renderer.js`): one Three.js scene, instanced pools with fixed caps sized by measurement — 3,000 stones, 360 trees — and a fog pass that draws only what a living eye can see.
- **The save**: bodies, welds mid-break, craters, squad rosters, the dice — serialized at each bell into a single JSON string in browser storage.
- Winter Front was built on five playable tech demos — driving, contracts, a campaign, a tower defense, and a walking biped mech — all still on the site behind THE PROVING RANGE.

## Development

```
npm install
npm run dev      # local dev server
npm run build    # static build in dist/
```

Pushes to `main` deploy to GitHub Pages automatically.

**Credits:** Direction & design — Jeff Coen. Code — Claude (Anthropic's
Fable 5), written across many sessions under Jeff's direction. MIT licensed;
copyright held by Jeff Coen.
````

**Step 4 — ship.** `src/version.js` MK → `"mk1.16"`; build AFTER the bump; stage `README.md`, `docs/media/*.png`, `src/version.js`; commit; push (CI deploys). Commit message: `the README: the war on a floppy disk (mk1.16)`.

**Gates (run ONLY these):** `npm run build` · `SMOKE_ONLY=start node scripts/smoke.mjs` · `ls -la docs/media/` showing the four PNGs the README references. No engine, depot, or test-pin change is in play — any test movement at all is a STOP.

---

# TASK 8 — The field manual (mk1.15)

**What it does.** First time a player opens a new war, six linked cards teach what makes this game itself: real stone, orders, possession, the bell, the market, the fall. NEXT/BACK walk the chain, SKIP leaves at any card, and a don't-show-again toggle is honored forever once ticked. The tour returns on every fresh war until the player ticks it off; a resumed war never auto-opens it. It reopens on demand as FIELD MANUAL from the pre-battle overlay. This task also carries the owner's TAKE COMMAND ruling: "DIG IN" dies at both sites.

**The cards (owner-approved copy, verbatim, in this order):**

1. `REAL STONE` — The whole battlefield is real physics. Collapse a wall on the men behind it. Drop a roof on a squad. Rubble is a weapon.
2. `YOUR MEN` — Tap a squad, give it orders. Men are your eyes — what they can't see, you can't see. Only engineers build.
3. `TAKE CONTROL` — Any squad or tower can be yours. Drive it, aim it, fire it. The front fights on without you.
4. `THE BELL` — Scrap flows every second. Every 90 seconds the bell rings and the convoy offers new mercenaries — pick one. Then they attack.
5. `THE MARKET` — One market, both armies. What the field is full of costs more. Buy out what they need before they can.
6. `THE FALL` — Lose your depot and the save burns. No rewinds. But every valley is drawn fresh — a new front is always waiting.

**Shape (the look ships; the owner's eyes accept it live):** a scrim over the pre-battle overlay, one centered card — `FIELD MANUAL · n/6` and `SKIP ✕` on top, gold title, body copy, a tickable `☐ DON'T SHOW THIS AGAIN` row, then `← BACK` / `NEXT →` (last card: green `CLOSE`). The storage flag `coldsnap-wf-manual = "off"` is written only when the toggle is ticked at close — a plain SKIP or CLOSE writes nothing.

**Suggested model:** Sonnet — component work and copy, all specified.

**Required reading (re-verify anchors at dispatch):**
- `src/ui/StartScreen.jsx` — whole (111 lines; the rename at line 84).
- `src/ui/theme.js` — whole (COLORS/FONT exports FieldManual uses).
- `src/platform/storage.js` — whole (22 lines; the async get/set shapes).
- `src/depot/DepotGame.jsx` — regions only: imports 9-29; state hooks 1194-1220; the `P` styles 1082-1103; `startGame` 3584-3589; the pre-battle overlay 4041-4055. Do not read the rest.
- `scripts/smoke.mjs` — lines 55-90 (start section) and 209-250 (depot section).
- `src/version.js` — whole.

**Trap notes:**
- The tour must never gate the debug start path: smoke starts wars through `__DEPOTSTART__()`, not the button. The manual renders only while `!hud.started && manualOpen` — starting the war unmounts it. Keep all manual state in React state, never in `stateRef`.
- Write the storage flag ONLY when the toggle is ticked. The tour returning each fresh war is the design, not a bug.
- The tower-defense demo has its own DIG IN button (`src/game/ColdsnapTD.jsx:1745`) — out of scope, do not touch.
- StartScreen's comment law holds: never spread a style that can leave `background: undefined` over a button.
- The overlay's `P.ovl` is zIndex 8 — the manual sits at 9.
- `data-menu="manual"` is a new attribute; smoke's `clickMenu` helper keys on `data-menu` values — the ones it uses (`demos`, `depot`, …) are untouched.

**Step 1 — new file `src/ui/FieldManual.jsx` (whole file, exactly this):** the six cards and the card walker. Pure presentation; opening, closing, and the flag belong to the caller.

```jsx
import React, { useState } from "react";
import { FONT } from "./theme.js";

// THE FIELD MANUAL (P6 T8, mk1.15). Six linked cards, the first-entry tour.
// Owner-approved copy — do not edit a word without a ruling.
const CARDS = [
  { title: "REAL STONE", body: "The whole battlefield is real physics. Collapse a wall on the men behind it. Drop a roof on a squad. Rubble is a weapon." },
  { title: "YOUR MEN", body: "Tap a squad, give it orders. Men are your eyes — what they can't see, you can't see. Only engineers build." },
  { title: "TAKE CONTROL", body: "Any squad or tower can be yours. Drive it, aim it, fire it. The front fights on without you." },
  { title: "THE BELL", body: "Scrap flows every second. Every 90 seconds the bell rings and the convoy offers new mercenaries — pick one. Then they attack." },
  { title: "THE MARKET", body: "One market, both armies. What the field is full of costs more. Buy out what they need before they can." },
  { title: "THE FALL", body: "Lose your depot and the save burns. No rewinds. But every valley is drawn fresh — a new front is always waiting." },
];

export default function FieldManual({ onClose }) {
  const [i, setI] = useState(0);
  const [never, setNever] = useState(false);
  const card = CARDS[i];
  const last = i === CARDS.length - 1;
  const B = { background: "#1a212b", border: "1px solid #48515f", color: "#e6ebf1", borderRadius: 8, padding: "10px 18px", fontFamily: "inherit", fontSize: 13, letterSpacing: 1, minHeight: 44, minWidth: 44, cursor: "pointer" };
  return (
    <div data-manual style={{ position: "absolute", inset: 0, zIndex: 9, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(10,13,18,0.82)", fontFamily: FONT, color: "#e6ebf1", padding: 20 }}>
      <div style={{ width: "min(400px, 92vw)", background: "rgba(14,18,24,0.96)", border: "1px solid #48515f", borderRadius: 10, padding: "18px 20px", textAlign: "left" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={{ fontSize: 11, letterSpacing: 3, opacity: 0.6 }}>FIELD MANUAL · {i + 1}/{CARDS.length}</div>
          <button data-manual-skip style={{ ...B, minHeight: 0, minWidth: 0, padding: "4px 10px", fontSize: 11, opacity: 0.8 }} onClick={() => onClose(never)}>SKIP ✕</button>
        </div>
        <div data-manual-card style={{ fontSize: 17, letterSpacing: 3, color: "#ffd27a", marginTop: 12 }}>{card.title}</div>
        <div style={{ fontSize: 13, lineHeight: 1.7, opacity: 0.9, marginTop: 10, minHeight: 88 }}>{card.body}</div>
        <div data-manual-never onClick={() => setNever(!never)} style={{ fontSize: 11, opacity: 0.7, marginTop: 12, cursor: "pointer" }}>
          {never ? "☑" : "☐"} DON'T SHOW THIS AGAIN
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, gap: 10 }}>
          <button data-manual-back style={{ ...B, visibility: i === 0 ? "hidden" : "visible" }} onClick={() => setI(i - 1)}>← BACK</button>
          {last
            ? <button data-manual-close style={{ ...B, borderColor: "#4aff8c", color: "#4aff8c" }} onClick={() => onClose(never)}>CLOSE</button>
            : <button data-manual-next style={{ ...B, borderColor: "#9fd4e4", color: "#9fd4e4" }} onClick={() => setI(i + 1)}>NEXT →</button>}
        </div>
      </div>
    </div>
  );
}
```

**Step 2 — `DepotGame.jsx`: import and key.** After the Dispatch import (line 29 `import Dispatch from "./Dispatch.jsx";`) add:

```jsx
import FieldManual from "../ui/FieldManual.jsx";

// THE FIELD MANUAL's don't-show-again flag (P6 T8). "off" means never
// auto-open again; anything else (including absent) means the tour greets
// every fresh war. A resumed war never auto-opens it either way.
const MANUAL_KEY = "coldsnap-wf-manual";
```

**Step 3 — `DepotGame.jsx`: state and probe.** After line 1199 (`const [rereadDispatch, setRereadDispatch] = useState(false);`) add:

```jsx
  // P6 T8: the field manual. React state only — the sim never sees it.
  const [manualOpen, setManualOpen] = useState(false);
  useEffect(() => {
    if (resumeRef.current) return; // a resumed war is not a first entry
    let live = true;
    (async () => {
      try { const r = await window.storage.get(MANUAL_KEY); if (live && !(r && r.value === "off")) setManualOpen(true); }
      catch (e) { if (live) setManualOpen(true); }
    })();
    return () => { live = false; };
  }, []);
  const closeManual = (never) => {
    setManualOpen(false);
    if (never) { try { window.storage.set(MANUAL_KEY, "off"); } catch (e) {} }
  };
```

**Step 4 — `DepotGame.jsx`: the overlay.** In the pre-battle overlay (lines 4041-4055): the start button's text `DIG IN` becomes `TAKE COMMAND` (owner's ruling — the burn/arm flow lives on the menu screen and is untouched), and between the start button and the seed line a FIELD MANUAL button is added:

```jsx
          <button style={{ ...P.btn, fontSize: 15, padding: "10px 26px", borderColor: "#4aff8c", color: "#4aff8c" }} onClick={startGame}>
            TAKE COMMAND
          </button>
          <button data-menu="manual" style={{ ...P.btn, marginTop: 14, opacity: 0.75, fontSize: 11, letterSpacing: 1 }} onClick={() => setManualOpen(true)}>
            FIELD MANUAL
          </button>
          <div style={{ fontSize: 10, opacity: 0.55, marginTop: 12, letterSpacing: 2 }}>FIELD ORDER #{hud.seed || "—"} · ?seed= replays a map</div>
```

**Step 5 — `DepotGame.jsx`: render the manual.** Immediately after the pre-battle overlay's closing `)}` (line 4055) add — the `!hud.started` guard is the trap note made law:

```jsx
      {!hud.started && !fatal && manualOpen && <FieldManual onClose={closeManual} />}
```

**Step 6 — `StartScreen.jsx` line 84:** `"▶ DIG IN — NEW FRONT"` becomes `"▶ NEW FRONT — TAKE COMMAND"`. Nothing else on the menu changes.

**Step 7 — `scripts/smoke.mjs`, three edits.**
(a) The start-section pin (lines 79-82): the comment's `DIG IN` wording and the check become:

```js
    ok("start screen offers NEW FRONT — TAKE COMMAND", body.includes("TAKE COMMAND"));
```

(b) The depot section's storage-clearing line (218) also clears the manual flag so the tour deterministically appears:

```js
    await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith("coldsnap-depot")) localStorage.removeItem(k); localStorage.removeItem("coldsnap-front-save"); localStorage.removeItem("coldsnap-wf-manual"); });
```

(c) After `ok("depot: mounts", true);` (line 223), before `__DEPOTSTART__`, the manual's two load checks:

```js
    await page.waitForSelector("[data-manual]", { timeout: 10000 });
    ok("depot: the field manual greets a fresh war", true);
    await page.click("[data-manual-skip]");
    await page.waitForFunction(() => !document.querySelector("[data-manual]"), { timeout: 5000 });
    ok("depot: SKIP closes the manual", true);
```

The depot section's second entry (the end-card leg) opens the manual again — by design (SKIP without the toggle writes nothing) — and `__DEPOTSTART__` unmounts it; no edit needed there.

**Step 8 — ship.** `src/version.js` MK → `"mk1.15"`; build AFTER the bump; commit; push (CI deploys).

**Gates (run ONLY these):** `node scripts/depot-lint.mjs` · `npm run build` · `SMOKE_ONLY=start,depot node scripts/smoke.mjs`. No engine change — golden and the keystone are not in play. Expected test deltas: exactly one smoke pin re-taught (7a) and two smoke checks added (7c) — any other breakage is a STOP.

---

# TASK 7 — The front door (mk1.14)

**What it does.** The site stops opening on a seven-button range menu and opens on WINTER FRONT — one identity, one action, three true laws. The owner's directive: the front door must unambiguously draw the player in and prime them. The old menu's five demo surfaces move whole to a second page behind one quiet link. Every line of door copy is audited against what the game is NOW — "WINTER RANGE COMMAND" and "the southern treeline" die.

**The door (the look ships; the owner's eyes accept it live — no screenshot loops):**
- Title block: `COLDSNAP` / `WINTER FRONT` / the mark. The subtitle "WINTER RANGE COMMAND" is deleted.
- One tagline under the title: `A winter war in real stone.`
- THE PRIMER — three laws, small and unmissable, between title and button:
  - `The muster bell rings every 90 seconds. Everything that reaches this war comes off that truck.`
  - `Every wall is real masonry. What you break stays broken — what falls, falls for real.`
  - `When a depot falls, its war is over. The save burns. No rewinds.`
- ONE dominant action: `▶ RESUME FRONT` (gold, today's card and copy) when a save exists; beneath it (or alone on a fresh slate) `▶ DIG IN — NEW FRONT` with today's two-tap burn-arm flow and copy, except the fresh-slate blurb becomes: `Two depots, one frozen valley, a river with one crossing. Break theirs before they break yours.`
- The stale-save notice line stays as is.
- The foot: one quiet link `THE PROVING RANGE — tech demos this war was built on →` and the device-appropriate control hint line (today's), and nothing else.

**The second page (`DemosScreen`):** header `THE PROVING RANGE`, then today's five demo cards VERBATIM — Hold the Depot, Clearance Campaign, Contract Sandbox (medal row), Proving Grounds (medal row), Mech Test Range — plus the CONTROLS card (remap only ever applied to the demo surfaces, so it lives here), and `← BACK` to the front door.

**Copy audit rulings (the "now" truths):** the in-game start overlay's `They come out of the southern treeline for the depot.` becomes `They are coming for your depot across the valley — wall your ground, gun the choke points.` (spawns wander now; the wall line already tells the engineer truth from mk1.12). The ponds line (`frozen ponds carry them faster — and you cannot build on ice`) stays — still true. The rest of the overlay (control hints, DIG IN, seed line) stays.

**Suggested model:** Sonnet — component work and copy, all specified.

**Required reading (re-verify at dispatch):**
- `src/ui/StartScreen.jsx` — whole (156 lines; becomes the front door; the five demo cards move out).
- `src/ui/App.jsx` — whole (141 lines; gains the `demos` screen; `RESUME_SCREENS` untouched).
- `src/ui/theme.js` — whole (the shared styles the new page reuses).
- `src/depot/DepotGame.jsx` — the start overlay (search `southern treeline`).
- `scripts/smoke.mjs` — whole navigation layer: every surface's entry clicks a `data-menu` button on the OLD single menu; each such navigation must be updated to go front door → `data-menu="demos"` → the surface's card. Grep `data-menu` for the full list. The depot surface's entry stays one tap (it is the front door now).
- `scripts/depot-test.mjs` — grep `data-menu`/`StartScreen` for pins (none known; any found is reported before touching).
- `src/version.js`.

**Trap notes:**
- App.jsx routing: `menu` renders the front door; new screen key `demos` renders DemosScreen; all existing screen keys and the ESC map are untouched. The screen-persist logic (`RESUME_SCREENS`) is untouched — `demos` is not a resume screen.
- The save probe/burn flow (probeFront, burnFront, the two-tap arm, `data-menu="depot"` / `data-menu="depot-resume"` attributes) moves INTO the front door UNCHANGED — the smoke and any tests key on those attributes.
- The five demo cards move byte-similar (same `data-menu` attributes, same copy, same medal rows) — only their home changes.
- SMOKE is the risk surface: every non-depot navigation gains one hop. Update each site minimally (`click [data-menu="demos"]` then the existing selector); the depot entries lose nothing. Run the FULL smoke — every surface's mount path changed.
- EXPECTED RE-PINS: none in depot-test. Smoke edits are navigation, not assertions.
- No engine, no depot logic beyond one overlay string — no golden, no keystone concerns.

## Steps, in execution order

**Step 1 — failing asserts first.** Insert the P6-T7 block before the tail summary; red against today's code. Record the reds.
```js
// ==== P6 T7: the front door =================================================
// mk1.14 (Troops & Physics, Task 7). The site opens on WINTER FRONT — one
// identity, one action, three laws — and the demos live behind one link.
{
  console.log("\n[p6 t7: the front door]");
  const ss = fs.readFileSync(new URL("../src/ui/StartScreen.jsx", import.meta.url), "utf8");
  const app = fs.readFileSync(new URL("../src/ui/App.jsx", import.meta.url), "utf8");
  ok("T7: the range subtitle is dead", !/WINTER RANGE COMMAND/.test(ss));
  ok("T7: the door carries the three laws", /muster bell rings every 90 seconds/.test(ss) && /real masonry/.test(ss) && /The save burns/.test(ss));
  ok("T7: the demos left the door", !/PROVING GROUNDS/.test(ss) && !/MECH TEST RANGE/.test(ss) && !/HOLD THE DEPOT/.test(ss));
  ok("T7: one quiet link leads to the range", /data-menu="demos"/.test(ss));
  ok("T7: the demos page routes from the app shell", /DemosScreen/.test(app) && /data-menu="demos"/.test(ss));
  const dg = fs.readFileSync(new URL("../src/depot/DepotGame.jsx", import.meta.url), "utf8");
  ok("T7: the southern treeline is gone", !/southern treeline/.test(dg));
  let dm = "";
  try { dm = fs.readFileSync(new URL("../src/ui/DemosScreen.jsx", import.meta.url), "utf8"); } catch (e) {}
  ok("T7: the five cards and controls live on the range page",
    /HOLD THE DEPOT/.test(dm) && /CLEARANCE CAMPAIGN/.test(dm) && /CONTRACT SANDBOX/.test(dm) && /PROVING GROUNDS/.test(dm) && /MECH TEST RANGE/.test(dm) && /CONTROLS/.test(dm));
}
// ==== end P6 T7 ==============================================================
```
**Step 2 — DemosScreen.** New `src/ui/DemosScreen.jsx`: the five demo cards and the CONTROLS card cut byte-similar from StartScreen (same `data-menu` attributes, same handlers passed as props: onPlay/onSandbox/onCampaign/onControls/onMech/onTowerDef), medal loading (`coldsnap-medals`, `coldsnap-cs-medals`) and `starRow` MOVE here with them, header `THE PROVING RANGE`, `← BACK` button (`data-menu="back"`) calling `onBack`. Styles via the same `theme.js` imports.

**Step 3 — the front door.** `src/ui/StartScreen.jsx` rewritten per the door spec above: keeps probeFront/burnFront/two-tap arm/RESUME/NEW flows and their `data-menu` attributes verbatim; gains the tagline, the three-law primer, and the `data-menu="demos"` foot link (`onDemos` prop); loses the five cards, the controls card, the medal machinery, and the range subtitle.

**Step 4 — the route.** `src/ui/App.jsx`: `demos` screen key renders `<DemosScreen ...handlers onBack={() => setScreen("menu")} />`; StartScreen gains `onDemos={() => setScreen("demos")}`; nothing else moves.

**Step 5 — the overlay line.** `src/depot/DepotGame.jsx`: the start-overlay sentence per the copy audit ruling above.

**Step 6 — the smoke walks the new door.** `scripts/smoke.mjs`: every navigation that clicked a demo card on the old menu now clicks `[data-menu="demos"]` first; depot navigations unchanged; the BACK path is not exercised (keep it that way — minimal edits).

**Step 7 — green, bump, build, smoke.** `npm run lint:depot` · `npm run test:depot` fully green (zero re-pins) · `src/version.js` → `"mk1.14"` · `npm run build` AFTER the bump · `npm run smoke` (FULL — every surface's mount path changed).

**Gates (ONLY these):** parse changed files · `npm run lint:depot` · `npm run test:depot` (Step 1 red-first, then green; zero re-pins) · `npm run build` after the bump · `npm run smoke` (full). Allowed files: `src/ui/StartScreen.jsx`, `src/ui/DemosScreen.jsx` (new), `src/ui/App.jsx`, `src/depot/DepotGame.jsx`, `scripts/smoke.mjs`, `scripts/depot-test.mjs`, `src/version.js`. Commit `"the front door: one war, one button, three laws (mk1.14)"`, push, CI green, STOP. The owner opens the deployed site cold and judges: does it draw you in, does it prime you, is the range one quiet link away.

---

# TASK 5 — The body lists, resurrected (mk1.14)

**What it does.** Re-lands the typed body pools: once per frame, the world's body array is filtered into seven pools (solids, statics, friends, foes, each side's structure targets, the careful-fire set), and every hot combat and movement scan iterates its pool instead of walking the whole world — with its full original predicate kept, so behavior is identical by construction. This shipped once at mk0.99 to green gates, measured a reproducible −15–17% mean physics cost, and was reverted because the tail metric on the old probe was noise. THE FRONT's Task 6 built the honest measurement since (means and medians, two repeats, tails reported never gating) — that protocol is the judge this time.

**The governing text is the ARCHIVED SPEC** — `docs/superpowers/plans/2026-08-13-slow-front-p5-the-front.md`, section "ARCHIVED SPEC — Body lists (implemented and reverted 2026-08-13; resurrect at TROOPS & PHYSICS, P6)", INCLUDING its Amendment 1 (the rebuild runs ONCE PER FRAME, never per sub-step — that amendment's finding is settled law now, folded in from the start). The agent executes that spec with the DELTA LIST below; where the two disagree, the delta list wins.

**THE DELTA LIST (re-landing in the mk1.13 world):**
1. NAMES: the test block is `P6 T5: body lists` (mk1.14); every assert prefix `T1(` becomes `T5(`; the module comment in `lists.js` says "ONE pass per frame (DepotGame's frame loop, before the sim catch-up loop)" from the start — the archived Amendment's A3 wording, not the original.
2. THE REBUILD SITE: skip the archived Step 3's stepDepot placement entirely — the rebuild lands per the archived Amendment's Step A2, in the frame loop between the sim stopwatch open and the catch-up loop (live anchor: `const pSim0 = perf ? performance.now() : 0;` followed by `let guard = 0;`), guarded by `if (S.acc >= STEP)`. The lists.js import from Step 3 still lands.
3. `slotBlocked` (squads.js): the pool line goes AFTER the T3 water line (`if (world.streamAt && ...) return true;` stays the first line) — the archived snippet predates the stream.
4. ANCHORS: every archived line number has drifted (four map tasks and four P6 tasks landed since mk0.99). The FUNCTION NAMES are the anchors now — the eighteen consumer sites are: accuracy.js `solidBlocksPoint`/`losGraze`/`bracedAt`; squads.js `exposureAt`/`slotBlocked`/`squadThreatened`/`stepSapperCharges`; state.js `squadFire`'s two scans/`snapTargetNear`/`friendlyBlocksPoint`; units.js `stepTank`/`nearestPlayerUnit`/`stepRifleman`/`stepGrenadier`/`stepSapper`; DepotGame.jsx `stepTowers`' acquisition scan and `engageCheck`'s scan. Verify each still matches the archived snippet's SHAPE at dispatch; a site whose shape has drifted is a STOP, not an improvisation.
5. OUT OF SCOPE, unchanged from the archive plus two new cold callers: `marketCounts` (1 Hz) and `planTrees` (boot-only) keep walking `world.bodies` — cold paths never convert.
6. MEASUREMENT (supersedes the archived Step 0/Step 10 and the Amendment's ship rule): Step 0 BEFORE capture on the mk1.13 build with the EXISTING `.superpowers/diag-t6-perf.mjs` (seed 2307, window A 20s idle, window B 40-man assault + hangar collapse, two repeats); after everything is green and bumped, the AFTER capture, same script, two repeats. SHIP RULE: after-mean sim at or below before-mean in BOTH windows, both repeats; medians alongside; tails reported, never gating. A regression is a STOP — no third strategy without the owner.
7. The archived Step 9's roadmap flip is DEAD (it happened at mk1.10); only the version bump remains: `src/version.js` → `"mk1.14"`, build AFTER the bump.
8. COMMIT SUBJECT: `"body lists: the hot scans stop walking the world (mk1.14)"`.
9. EXPECTED RE-PINS: none. The keystone battles (FRONT T6, P6 T2's fixtures) drive `stepWorld` directly — the lists never install there, the pools' keystone is this task's own zoo twin (archived T1(c), now T5(c)). Any old assert moving is a STOP.
10. GATES (ONLY these): parse changed files · `npm run lint:depot` (lists.js is rng-free) · `npm run test:depot` (archived Step 1's block red-first as written — module missing — then fully green, zero re-pins) · `npm run build` after the bump · `SMOKE_ONLY=depot npm run smoke` · the Step 0/AFTER Pi captures with delta 6's ship rule. No golden (core.js untouched — game layer only).

## AMENDMENT 1 (owner's ruling, 2026-08-13) — the pools sleep at peace, and the fight gets a defense

*Found in execution: the ship rule failed both windows — idle regressed 12–20% (the per-frame rebuild walks ~2,500 bodies while nothing reads a pool) and the battle window measured flat (the capture's assault marches on an UNDEFENDED depot, so the target-hunting scans the pools accelerate barely run; the collapse cost it measures is the collision books' territory, already won). Rulings: the design gains an idle gate, the instrument gains a defense, ONE re-measurement decides under the unchanged rule — and a second failure retires the body lists for good.*

**Step A1-1 — the idle gate.** The frame-loop rebuild becomes:
```js
          // AMENDMENT (mk1.14): the pools exist only while the war is hot —
          // squads, towers, or enemies afield. Cold frames null the lists and
          // every consumer full-scans exactly as before the pools existed
          // (pools-vs-full-scan is proven identical, so the gate can be
          // cheap and even frame-paced without touching determinism of
          // outcomes). _hot is stashed by the hud census pass below.
          if (S.acc >= STEP) {
            if (S._hot) rebuildBodyLists(world, world._L || makeBodyLists());
            else world._L = null;
          }
```
And the hud tick's existing body walk (the en/nw/nt counters) stashes the flag beside its counts: `S._hot = en > 0 || nt > 0 || S.squads.length > 0;` (initialized `S._hot = false;` at boot beside the market fields).

**Step A1-2 — the instrument fields a defense.** `.superpowers/diag-t6-perf.mjs` (untracked) gains a defended battle window: before window B's assault, drive the debug hooks — `__DEPOTFINDBUILDABLE__` + `__DEPOTBUILD__` to raise 4 gun towers and 2 mg towers, `__DEPOTSQUAD__` to field 2 rifle squads and 1 mg team near the depot, grant scrap as needed via the harness's own state (or build pre-market-pace via the hook, which is unpaced by design) — THEN `__DEPOTSPAWN__(40)` plus the hangar shells, run 20s. Window A (idle) unchanged. Both BEFORE and AFTER captures re-run with this amended script (the old BEFORE numbers measured a different scenario and are void).

**Step A1-3 — the verdict.** Same ship rule, one re-measurement: after-mean sim at or below before-mean, both windows, both repeats. PASS ships mk1.14; FAIL reverts every code edit (the test block's module assert included) and the body lists are RETIRED — recorded as such, never a third attempt.

**Required reading (re-verify at dispatch):** the WHOLE archived spec section including its Amendment; `src/depot/accuracy.js` whole; `src/depot/squads.js` whole; `src/depot/state.js` — `squadFire` through `friendlyFouls` (the four consumer sites); `src/depot/units.js` whole; `src/depot/DepotGame.jsx` — imports, `stepTowers`, `engageCheck`, the frame-loop sim bracket; `scripts/depot-test.mjs` 1–70 + tail; `.superpowers/diag-t6-perf.mjs` (run-only); `src/version.js`.

**Allowed files:** `src/depot/lists.js` (new), `src/depot/accuracy.js`, `src/depot/squads.js`, `src/depot/state.js`, `src/depot/units.js`, `src/depot/DepotGame.jsx`, `scripts/depot-test.mjs`, `src/version.js`.

**Feel changes:** none — identical behavior by construction (the zoo twin proves it); the Pi numbers are the deliverable.

**Suggested model:** Sonnet — the spec is archived in full; the work is careful re-anchoring plus the measurement.

---

# TASK 4 — The living market (mk1.13)

**What it does.** The economy starts breathing. Every purchasable thing belongs to a TYPE FAMILY, and each family's price is its base cost multiplied by how much of that family already STANDS on the field — both armies' stock counted together, one shared market, both sides paying the same multiplier. Prices recalculate every second from the live counts; the build bar and the manifest always show the price of this moment. Each side may buy at most once per second. Income flattens to 1 scrap per second for both sides — the old player trickle and the flat bell payout die; the ground-holding town payout at each bell remains the only bonus. All of it is counting and arithmetic: zero dice, deterministic to the bit.

**The owner's rulings carried (decision record, 2026-08-13):** per-type prices; shared stock across both armies; per-second repricing; one purchase per second per side; 1 scrap/second income replacing trickle and bell payout; town payout stays. Curve anchors below are provisional dials (F5).

**Four interpretation lines, stated for the owner's review (each is my reading of a ruling's edge, reversible at review):**
1. KILL BOUNTIES STAND, both sides — "1 scrap/second replacing the old income" is read as replacing the PASSIVE streams only; earnings for kills, structure damage, and the town payout are performance income, untouched this task. Say the word if bounties should die too.
2. The enemy's passive income RISES with symmetry: its old stipend was 14 per bell; the symmetric 1 scrap/second pays 90 per bell (credited at the bell, where the regiment spends — arithmetically identical to a per-second drip it never reads between bells). The player's passive falls from ~210 per bell (trickle + payout) to 90. Both sides now at exactly 90. This is the ruling's honest arithmetic; flagged because the enemy side sextuples.
3. The one-buy-per-second limit binds the PURCHASE taps (towers, squads) — an engineer line's pieces are one accepted order's execution, already paced by walking (about one piece every 0.6 seconds at march pace), and are exempt. The enemy's muster is one composed purchase per bell, far inside the limit by construction.
4. The enemy's minimum-muster floor stays priced at BASE cost (it is a paralysis detector, not a purchase).

**The family table and the curve (all dials provisional, F5).** Price = `max(1, round(base × min(4, 1 + count / K)))` — base price on an empty field, double when K of the family stand, capped at 4x. Counts are STANDING stock: live men for infantry families (a rifles squad is its living members, a conscript is one man), live towers/walls (stacks)/sandbags/tanks for the rest. The mirror pairs share a family across the two armies:

| Family | Player key | Enemy tag | Counts | K (doubles at) |
|---|---|---|---|---|
| rifles | sq_rifles | "" (conscript) | men | 16 |
| marksman | sq_sniper | sniper | men | 4 |
| sapper | sq_sappers | sapper | men | 4 |
| mortar crew | sq_mortars | gren | men | 6 |
| mg team | sq_mg | — | men | 6 |
| engineer | sq_engineers | — | men | 6 |
| runner | — | fast | men | 12 |
| breaker | — | heavy | men | 6 |
| tank | — | tank | vehicles | 3 |
| mg tower | mg | — | towers | 4 |
| gun tower | gun | — | towers | 4 |
| mortar tower | mortar | — | towers | 3 |
| rocket tower | rocket | — | towers | 3 |
| frost tower | frost | — | towers | 4 |
| wall | wall (field lines) | — | stacks | 30 |
| sandbag | sandbag (field lines) | — | bags | 40 |

**Feel changes that ship for the owner's eyes:** prices on the bar move as the war fills; their conscript wave makes YOUR rifles dearer; a cheap under-fielded slot invites the experiment; the bell stops paying a lump and money arrives like a clock; buying too fast gets a pacing toast.

**Suggested model:** Sonnet — the module and every edit are specified; the wiring is wide but mechanical.

**Required reading (re-verify anchors at dispatch):**
- `src/depot/economy.js` — whole (61 lines; STIPEND at 31).
- `src/depot/ai.js` — whole (254 lines; `cost()` at 13, planWave at 174 — the priceOf threading).
- `src/depot/state.js` — 1110–1130 (BELL_SCRAP at 1124), 1355–1380 (fireBell's income step at 1361–1362), 1050–1108 (manifest, read-only).
- `src/depot/DepotGame.jsx` — the PALETTE block (base costs), `buildAt`/`canBuildAt`/`confirmPending`/`placeSquadAt` (the purchase commits), `layPieceAt` (field costs — exempt from the limit, priced live), `ringBell` (the toast), the frame loop's trickle (`S.resources += 2.2 * sdt;` at 3220) and the hud tick (prices out to the bar/manifest).
- `src/depot/units.js` — 23–40 (spawnUnit: enemy bodies carry `u.tag` — verified at plan time), read-only.
- `src/depot/squads.js` — SQUAD_SPECS head (base costs), read-only.
- `scripts/depot-test.mjs` — 1–70, 95–110 (the bell-pay pins), 275–285, 670–820 (the economy/STIPEND blocks), the tail.
- `src/version.js`.

**Trap notes:**
- ZERO rng anywhere in the market. Counting, division, rounding. `depot-lint` gates it.
- The 4-draw planWave contract is UNTOUCHED — priceOf changes what draws BUY, never how many draws happen. The suite's draw-parity asserts must hold.
- ai.js stays PURE: `planWave` gains an optional `priceOf` parameter defaulting to today's base-cost function — every existing fixture and test calls it without the argument and must pass UNCHANGED.
- EXPECTED RE-PINS, exactly FOUR: (1) "bell pays the player's cycle scrap" (~103) — becomes "the bell pays nothing; income is the clock" (asserts resources unchanged across fireBell); (2) the resume-path bell-pay pin (~281) — same shape; (3) `STIPEND === 14` (~677) → `=== 90` with the 1-scrap-per-second wording; (4) the ~815 "bell pays STIPEND" pin's arithmetic follows the constant automatically — verify it does, re-pin its literal only if it carries one. Every OTHER economy assert references the constants symbolically and must pass untouched — any other movement is a STOP.
- `BELL_SCRAP` the constant DIES with its payout line (grep for stragglers); the ringBell toast becomes town-pay-only, shown only when the ground actually paid.
- The purchase-limit stamp (`S._buyAt`) and the market cache (`S._market`) are transient run state — NEVER serialized; a resumed run rebuilds both within a second. No save.js edits.
- Prices apply at COMMIT time (the live price the second you confirm), and the bar re-renders prices on the hud tick — a pending ✓ shows the cost it will actually charge because both read the same cache.
- The market cache recomputes on the same accumulator pattern as the census (1 Hz, sdt-gated — paused games freeze prices).
- Headless fixtures without a market cache fall back to base costs everywhere (`S._market ? ... : base`) — dozens of tests construct S by hand.
- `marketCounts` walks `world.bodies` once per second plus the squads array — cheap; do NOT fold it into the census callback (different consumers, keep it its own accumulator).

## Steps, in execution order

**Step 1 — failing asserts first.** Insert the P6-T4 block before the tail summary and apply the four named re-pins; `npm run test:depot` shows the block red (module missing) and the re-pinned lines red against today's code. Record the exact reds.

```js
// ==== P6 T4: the living market ==============================================
// mk1.13 (Troops & Physics, Task 4). Per-family prices off live standing
// stock, both armies counted together; repriced every second; one buy per
// second per side; income flat 1 scrap/second both sides. Zero rng.
{
  console.log("\n[p6 t4: the living market]");
  let mkt = null;
  try { mkt = await import("../src/depot/market.js"); } catch (e) {}
  ok("T4: src/depot/market.js exists with the three exports",
    !!mkt && typeof mkt.marketCounts === "function" && typeof mkt.computePrices === "function" && mkt.MARKET_CAP === 4);

  if (mkt) {
    // (a) the curve: base at zero, double at K, capped at 4x, integer prices
    const P0 = mkt.computePrices({});
    ok("T4(a): an empty field pays base prices", P0.player.sq_rifles === SQUAD_SPECS.rifles.cost && P0.player.gun === TOWER_SPECS.gun.cost,
      `rifles ${P0.player.sq_rifles}, gun ${P0.player.gun}`);
    const Pk = mkt.computePrices({ rifles: 16 });
    ok("T4(a): K of a family doubles its price", Pk.player.sq_rifles === SQUAD_SPECS.rifles.cost * 2, `${Pk.player.sq_rifles}`);
    const Pcap = mkt.computePrices({ rifles: 999 });
    ok("T4(a): the cap holds at 4x", Pcap.player.sq_rifles === SQUAD_SPECS.rifles.cost * 4, `${Pcap.player.sq_rifles}`);

    // (b) shared stock: enemy conscripts and player riflemen are ONE family
    {
      const flatM = { heightAt: () => 0, dirty: false, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } };
      const world = makeWorld({ field: flatM, seed: 3 });
      for (let i = 0; i < 6; i++) spawnUnit(world, { x: i * 2, z: 0 }, "");     // 6 conscripts
      const sq = makeSquad(1, "rifles", 1, 20, 20);
      spawnSquadMembers(world, sq);                                             // 4 riflemen
      const counts = mkt.marketCounts(world, [sq]);
      ok("T4(b): the rifles family counts both armies' men", counts.rifles === 10, `${counts.rifles}`);
      const Pm = mkt.computePrices(counts);
      ok("T4(b): both sides pay the same multiplied table",
        Pm.player.sq_rifles === Math.max(1, Math.round(SQUAD_SPECS.rifles.cost * (1 + 10 / 16))) &&
        Pm.foe[""] === Math.max(1, Math.round(ENEMY_SPECS[""].bounty * (1 + 10 / 16))),
        `player ${Pm.player.sq_rifles}, foe ${Pm.foe[""]}`);
    }

    // (c) determinism: same counts, same prices, twice
    ok("T4(c): twin determinism", JSON.stringify(mkt.computePrices({ rifles: 7, guntower: 2 })) === JSON.stringify(mkt.computePrices({ rifles: 7, guntower: 2 })));

    // (d) planWave pays market prices — and its 4-draw contract holds
    {
      const reg = { heads: 400, tanks: 10, heads0: 400, tanks0: 10, scrap: 400 };
      const reg2 = { heads: 400, tanks: 10, heads0: 400, tanks0: 10, scrap: 400 };
      let draws = 0;
      const rngW = () => { draws++; return mulberry32(77)(); };
      const rngA = mulberry32(77), rngB = mulberry32(77);
      const flat = planWave(reg, {}, 6, rngA);
      const priceOf = (t) => Math.round((t === "tank" ? TANK.bounty : ENEMY_SPECS[t].bounty) * 2);
      const priced = planWave(reg2, {}, 6, rngB, null, priceOf);
      const nOf = (r) => r.buys.reduce((s, b) => s + b.n, 0);
      ok("T4(d): doubled prices field a smaller assault on the same budget", nOf(priced) < nOf(flat), `${nOf(priced)} vs ${nOf(flat)}`);
      planWave({ heads: 9, tanks: 0, heads0: 9, tanks0: 0, scrap: 9 }, {}, 1, rngW, null, priceOf);
      ok("T4(d): the 4-draw contract holds under market prices", draws === 4, `${draws}`);
    }
  }

  // (e) income + limit + wiring: source pins
  const srcT4 = fs.readFileSync(new URL("../src/depot/DepotGame.jsx", import.meta.url), "utf8");
  const stT4 = fs.readFileSync(new URL("../src/depot/state.js", import.meta.url), "utf8");
  ok("T4(e): the player's income is the clock — 1 scrap/second", /S\.resources \+= 1 \* sdt;/.test(srcT4) && !/S\.resources \+= 2\.2 \* sdt;/.test(srcT4));
  ok("T4(e): the bell pays no lump", !/S\.resources \+= BELL_SCRAP;/.test(stT4));
  ok("T4(e): one purchase per second, toasted", /THE MARKET PACES YOU/.test(srcT4) && /S\._buyAt = world\.t;/.test(srcT4));
  ok("T4(e): purchases charge the live price", /const priceNow = /.test(srcT4));
  ok("T4(e): the enemy stipend is the same clock", /export const STIPEND = 90;/.test(fs.readFileSync(new URL("../src/depot/economy.js", import.meta.url), "utf8")));
}
// ==== end P6 T4 ==============================================================
```
## AMENDMENT 1 (owner's ruling, 2026-08-13) — spent means no men too

*Found in execution: the 90-per-bell stipend makes scrap-paralysis unreachable, which killed the "offensive spent" intel observation and its three fixtures (they empty the regiment's MEN, and relied on the old stipend sitting under the muster floor). And the mk1.12-re-pinned WALL_COST test pins the exact cost line Step 4d rewrites. Rulings:*

**Step A1-1.** `src/depot/state.js`, the starved detector (~1416): the condition gains the manpower path —
```js
  const starved = ws.fielded === 0 && (ws.musterScrap < MIN_WAVE_FLOOR || (S.reg && S.reg.heads <= 0 && S.reg.tanks <= 0));
```
(match the live variable names at the site; the shape is: fielded nobody AND (scrap under the floor OR no men and no tanks left). The comment beside it says: "spent is spent — a regiment with no men is as done as one with no money; the scrap path stays for form though the clock stipend keeps it funded.")

**Step A1-2.** The three fixtures (~395, ~457, ~2626) re-pin to the manpower path: their setups already zero the heads — they now also zero the tanks where they don't, and their assert texts gain "(re-pinned mk1.13 — spent by manpower)". Their assertions' SHAPE (one observation, once, digit-free) is unchanged.

**Step A1-3.** The mk0.50/3 WALL_COST pin (~2941) regex becomes `/spec \? priceNow\(mode, spec\.cost\) : WALL_COST/`, text noting the mk1.13 re-aim (the live price rides the spec path; the harness fallback still pays WALL_COST).

*The expected re-pin count for this task is now EIGHT (the four named plus these four: three fixtures and the WALL_COST pin).*

**Step 2 — the module.** Create `src/depot/market.js`:
```js
// COLDSNAP DEPOT — market.js: the living market (mk1.13, owner's rulings).
// Every purchasable belongs to a TYPE FAMILY; a family's price is its base
// cost times min(4, 1 + standing/K) — both armies' standing stock counted
// together, one shared table both sides pay. Pure counting and arithmetic:
// no rng, no world mutation, recomputed each second by the game layer.
import { TOWER_SPECS, ENEMY_SPECS, TANK } from "./specs.js";
import { SQUAD_SPECS } from "./squads.js";

export const MARKET_CAP = 4;
// K: the standing count at which a family's price doubles. // provisional (F5)
export const MARKET_K = {
  rifles: 16, marksman: 4, sapper: 4, mortarcrew: 6, mgteam: 6, engineer: 6,
  runner: 12, breaker: 6, tank: 3,
  mgtower: 4, guntower: 4, mortartower: 3, rockettower: 3, frosttower: 4,
  wall: 30, sandbag: 40,
};
const FAMILY_OF_SQUAD = { rifles: "rifles", sniper: "marksman", sappers: "sapper", mortars: "mortarcrew", mg: "mgteam", engineers: "engineer" };
const FAMILY_OF_TAG = { "": "rifles", sniper: "marksman", sapper: "sapper", gren: "mortarcrew", fast: "runner", heavy: "breaker" };
const FAMILY_OF_TOWER = { mg: "mgtower", gun: "guntower", mortar: "mortartower", rocket: "rockettower", frost: "frosttower" };

// marketCounts(world, squads) -> { family: standing count }. Men for
// infantry families (live bodies), things for the rest. One pass over
// world.bodies plus the squads array; deterministic.
export function marketCounts(world, squads) {
  const c = {};
  const add = (fam, n) => { if (fam) c[fam] = (c[fam] || 0) + n; };
  for (const sq of squads || []) {
    let live = 0;
    for (const id of sq.memberIds) { const u = world.byId.get(id); if (u && u.alive) live++; }
    add(FAMILY_OF_SQUAD[sq.type], live);
  }
  for (const b of world.bodies) {
    if (!b.alive) continue;
    if (b.kind === "unit" && b.team === 2) add(FAMILY_OF_TAG[b.tag || ""], 1);
    else if (b.kind === "vehicle" && b.team === 2) add("tank", 1);
    else if (b.kind === "tower" && b.team === 1) add(FAMILY_OF_TOWER[b.towerType], 1);
    else if (b.kind === "wall" && b.team === 1 && !b.course) add("wall", 1);
    else if (b.kind === "chunk" && b.sandbag) add("sandbag", 1);
  }
  return c;
}

const priced = (base, fam, counts) =>
  Math.max(1, Math.round(base * Math.min(MARKET_CAP, 1 + (counts[fam] || 0) / MARKET_K[fam])));

// computePrices(counts) -> { player: {barKey: price}, foe: {tag: price} } —
// the one shared table, read by the bar, the manifest, every purchase
// commit, the engineer field costs, and the enemy's planWave.
export function computePrices(counts) {
  const player = {};
  for (const k in FAMILY_OF_TOWER) player[k] = priced(TOWER_SPECS[k].cost, FAMILY_OF_TOWER[k], counts);
  for (const t in FAMILY_OF_SQUAD) player["sq_" + t] = priced(SQUAD_SPECS[t].cost, FAMILY_OF_SQUAD[t], counts);
  const foe = {};
  for (const t in FAMILY_OF_TAG) foe[t] = priced(ENEMY_SPECS[t].bounty, FAMILY_OF_TAG[t], counts);
  foe.tank = priced(TANK.bounty, "tank", counts);
  return { player, foe, counts };
}

// field-piece prices for the engineer lines (wall stacks / bags), same curve.
export function fieldPrices(counts, wallBase, bagBase) {
  return { wall: priced(wallBase, "wall", counts), bag: priced(bagBase, "sandbag", counts) };
}
```

**Step 3 — income becomes the clock.**
(3a) `src/depot/state.js` fireBell (~1361): DELETE `S.resources += BELL_SCRAP;` (the stipend line beneath it stays, re-valued by 3c). Delete the `BELL_SCRAP` const (~1124) and its export; fix the two import sites (state's own export list and depot-test's import — the test import drops it as part of the re-pins). The income comment above the deleted line now says: "the player's income is the clock (1 scrap/second, the frame loop); the bell pays only what the held ground earns (payTown, applied by the caller)."
(3b) `src/depot/DepotGame.jsx` 3220: `S.resources += 2.2 * sdt;` → `S.resources += 1 * sdt; // mk1.13 (owner): income is the clock — 1 scrap/second, both sides`. The ringBell toast pair: delete the "CYCLE PAY" toast; in its place `if (paid.player > 0) toast("◆ +" + Math.round(paid.player) + " — GROUND HELD");`.
(3c) `src/depot/economy.js` 31: `export const STIPEND = 90; // mk1.13 (owner): 1 scrap/second × the 90-second bell — the identical clock the player lives on, credited where the regiment spends`.

**Step 4 — the game layer prices and paces.** `src/depot/DepotGame.jsx`:
(4a) Import `marketCounts, computePrices, fieldPrices` from `./market.js`. In the boot, beside the census state: `S._market = null; S._marketAcc = 0; S._buyAt = -9;`
(4b) In the frame loop beside the census call (sdt-gated): 
```js
          S._marketAcc += sdt;
          if (S._marketAcc >= 1) { S._marketAcc -= 1; S._market = computePrices(marketCounts(world, S.squads)); }
```
(4c) One helper beside the toast helper:
```js
      const priceNow = (key, base) => (S._market && S._market.player[key] != null ? S._market.player[key] : base);
      const buyPaced = () => {
        if (world.t - S._buyAt < 1) { toast("THE MARKET PACES YOU — one purchase a second"); return false; }
        return true;
      };
```
(4d) `buildAt` (towers): the cost line becomes `const cost = spec ? priceNow(mode, spec.cost) : WALL_COST;`; at the top of the SPEND path (after the connectivity check, before `S.resources -= cost`): `if (!buyPaced()) { cell.blocked = false; return; }` then `S._buyAt = world.t;` beside the spend. The harness's wall branch (no spec) pays WALL_COST unpaced, as today — staging is not a market participant.
(4e) `placeSquadAt`: cost becomes `priceNow(mode key, SQUAD_SPECS[type].cost)` (thread the bar key), guard with `buyPaced()` before spawning, stamp `S._buyAt` beside the spend. `canPlaceInfantryAt`/`canBuildAt` validate affordability against the SAME priceNow so the ✓ never lies.
(4f) `layPieceAt` (engineer pieces): the cost line reads `const fp = S._market ? fieldPrices(S._market.counts, WALL_FIELD_COST, SANDBAG_FIELD_COST) : { wall: WALL_FIELD_COST, bag: SANDBAG_FIELD_COST }; const cost = job.kind === "walls" ? fp.wall : fp.bag;` — priced live, NOT paced (interpretation line 3). `refreshLinePreview`'s "up to" cost uses the same fieldPrices.
(4g) The hud tick exports prices: `prices: S._market ? { ...S._market.player } : null` — and the bar render maps `p.cost` through `hud.prices?.[p.key] ?? p.cost`; the manifest card offers show the same lookup.
(4h) `ringBell`'s fireBell call gains the enemy's table: pass `priceOf: (t) => (S._market ? S._market.foe[t === "tank" ? "tank" : t] : undefined)` through to planWave (state.js's fireBell signature gains the passthrough; planWave's default covers undefined).

**Step 5 — the enemy pays the same table.** `src/depot/ai.js`: `planWave(reg, snap, bell, rng, tags = null, priceOf = null)` — one line at the top: `const price = priceOf || cost;` and every `cost(` call site inside planWave/buyInfantryMix/buySnipers/buyTanks reads `price(` instead (thread `price` down as a parameter to the three buy helpers). `MIN_WAVE_FLOOR` stays on base `cost` (interpretation line 4). All existing callers (tests, fixtures, state.js) pass no priceOf and behave byte-identically.

**Step 6 — green, bump, build, smoke.** `npm run lint:depot` · `npm run test:depot` fully green (the four named re-pins, nothing else) · `src/version.js` → `"mk1.13"` · `npm run build` AFTER the bump · `SMOKE_ONLY=depot npm run smoke`.

**Gates (ONLY these):** parse changed files · `npm run lint:depot` · `npm run test:depot` (Step 1 red-first, then green; four named re-pins reported old→new) · `npm run build` after the bump · `SMOKE_ONLY=depot` smoke. Allowed files: `src/depot/market.js` (new), `src/depot/DepotGame.jsx`, `src/depot/state.js`, `src/depot/economy.js`, `src/depot/ai.js`, `scripts/depot-test.mjs`, `src/version.js`. Commit `"the living market: every price is a census (mk1.13)"`, push, CI green, STOP. The owner checks the deployed site: bar prices moving as the field fills, the pacing toast on a fast double-buy, income ticking at 1/second, the bell paying only held ground.

---

# TASK 3 — Only engineers build (mk1.12)

**What it does.** The god hand loses its trowel. Walls and sandbags leave the build bar and the starting unlock list — masonry is laid ONLY by engineer squads walking their two-point lines, at the field costs they already pay. Towers keep direct placement exactly as today. The seeded depot sandbags (map dressing) stay. The build bar therefore opens a match showing RIFLE SQUAD and ENGINEER TEAM; no build mode is selected by default — a ground tap selects and inspects only, until the player picks a bar slot. The start-screen line that promises "wall their road" starts telling the truth.

**What deliberately does NOT change:** `spawnWallCourses`/`spawnSandbag` and every engineer-line mechanism (they are the only door now); the wall inspect/sell flow (walls still exist, engineers built them); `buildAt`'s wall branch (it becomes debug-harness-only — `__DEPOTBUILD__` defaults to it and the staging scripts lean on it); `WALL_COST` (still the buildAt fallback price the harness pays); the enemy (it never built).

**Feel changes that ship for the owner's eyes:** a two-slot opening bar; fortification is engineer work from the first minute — you place the team and draw lines; towers still drop from the bar as before.

**Suggested model:** Sonnet — removals and three named re-pins, all specified.

**Required reading (re-verify anchors at dispatch):**
- `src/depot/DepotGame.jsx` — the PALETTE block (search `key: "wall"`), the run-state init (`mode: "wall"`), `setMode` (the sandbag re-tap orient cycle), `tapAt` (the wall/sandbag mode branches), `buildAt` + `canBuildAt` (read-only context), `placeSandbagAt` (dies), the hover-ghost sandbag branch (search `S.mode === "sandbag"`), the start overlay copy (search `Wall their road`).
- `src/depot/specs.js` — whole (PLAYER_START at ~136 and its ladder comment).
- `src/depot/state.js` — 1050–1075 (makeManifestState/ladderPool, read-only — the unlock machinery needs no edit).
- `scripts/depot-test.mjs` — 1–70, 160–220 (the manifest start-kit pins), 3230–3240 (the mk0.60/2 pin), the tail.
- `scripts/smoke.mjs` — the depot section (verify only: it never builds from the bar — confirmed at plan time).
- `src/version.js`.

**Trap notes:**
- EXPECTED RE-PINS, exactly THREE (report each old→new): (1) the manifest start-kit pin (~line 164): four items incl. wall/sandbag → TWO items, `sq_rifles` + `sq_engineers`; (2) the `M.unlocked.length === 4` in the never-offered pick test (~line 217) → `=== 2`; (3) the mk0.60/2 PLAYER_START pin (~line 3235) → length 2, engineers + rifles, wall/sandbag ABSENT. Any OTHER moved assert is a defect — STOP.
- `PALETTE_BY_KEY`/`PALETTE_LABEL` feed the manifest card — wall and sandbag were never manifest offers (they were start items), so nothing else reads their entries. Verify, do not chase.
- `S.sandbagOrient` state and its save field become vestigial but harmless — leave them (the save format is not this task's business; the mark bump burns saves anyway).
- The engineer line's own internal kind strings ("walls"/"bags") are NOT the palette keys — do not touch the line machinery.
- Old saves carry a four-item unlocked list — irrelevant: the mark bump refuses them.
- The default-mode change (`null`) means `tapAt`'s fall-through must never call `canBuildAt(null)` — the guard is in the specified code.
- FULL smoke is NOT needed — no engine change; `SMOKE_ONLY=depot` as usual.

## Steps, in execution order

**Step 1 — failing asserts first.** Three re-pins plus the new block, then `npm run test:depot`: the three re-pinned lines and the new P6-T3 source pins are red against today's code; everything else green. Record the exact reds.

(1a) Re-pin the manifest start-kit test (~line 164):
```js
    ok("manifest: the starting kit is rifles + engineers (re-pinned mk1.12 — only engineers build)",
      M.unlocked.length === 2 && isUnlocked(M, "sq_rifles") && isUnlocked(M, "sq_engineers")
      && !isUnlocked(M, "wall") && !isUnlocked(M, "sandbag"),
      M.unlocked.join(","));
```
(1b) Re-pin the never-offered pick test's length (~line 217): `M.unlocked.length === 2`.
(1c) Re-pin mk0.60/2 (~line 3235):
```js
  ok("mk0.60/2 (re-pinned mk1.12): PLAYER_START is rifles + engineers — masonry is engineer work",
    PLAYER_START.length === 2 && PLAYER_START.includes("sq_engineers") && PLAYER_START.includes("sq_rifles")
    && !PLAYER_START.includes("wall") && !PLAYER_START.includes("sandbag"),
    PLAYER_START.join(","));
```
(1d) Insert the P6-T3 block before the tail summary:
```js
// ==== P6 T3: only engineers build ===========================================
// mk1.12 (Troops & Physics, Task 3). Walls and sandbags leave the bar and
// the starting kit — engineer lines are the only door to masonry. Towers
// keep direct placement; the seeded depot bags stay; the harness's buildAt
// door stays for staging.
{
  console.log("\n[p6 t3: only engineers build]");
  const src = fs.readFileSync(new URL("../src/depot/DepotGame.jsx", import.meta.url), "utf8");
  ok("T3: the bar has no wall slot", !/key: "wall", label: "WALL"/.test(src));
  ok("T3: the bar has no sandbag slot", !/key: "sandbag", label: "SANDBAG"/.test(src));
  ok("T3: no build mode is selected by default", /mode: null, sellMode: false/.test(src));
  ok("T3: the ground tap guards the tower path on a live mode", /if \(S\.mode && TOWER_SPECS\[S\.mode\]\)/.test(src));
  ok("T3: the engineer line machinery is untouched (both spawners live)",
    /spawnWallCourses\(world, row\.x/.test(src) && /spawnSandbag\(world, row\.x, row\.z, orient\);/.test(src));
  ok("T3: the seeded depot bags are untouched", /spawnSandbag\(world, bx, bz,/.test(src));
  ok("T3: the harness door stays (buildAt via __DEPOTBUILD__)", /__DEPOTBUILD__ = \(gx, gz, mode\) => buildAt\(gx, gz, mode \|\| "wall"\)/.test(src));
  ok("T3: the start screen stopped promising the trowel", !/Wall their road/.test(src));
}
// ==== end P6 T3 ==============================================================
```

## AMENDMENT 1 (owner's ruling, 2026-08-13) — the re-pin list grows to seven

*Found in execution: the plan's deletions cast four more test-side shadows than its three named re-pins. All ruled, all test-only; the implementation stands as landed:*

**A1-4.** The same-bell second-pick test (depot-test ~218): its hardcoded `M.unlocked.length === 5` (old 4-item start plus one pick) becomes `=== 3`.

**A1-5.** The unread-offer test (~231–233): its `unlocked.length === 4` becomes `=== 2`, and its literal start-kit array `["wall", "sandbag", "sq_rifles", "sq_engineers"]` becomes `["sq_rifles", "sq_engineers"]`.

**A1-6.** The sandbag-orientation UI sub-block (~1967–1994) is PRUNED whole — it pins the bar re-tap toggle, the bar icon cycle, and the hover-ghost orientation read, all of which this task deletes. Orientation itself survives inside the engineer lines (sandbagOrientAt and its tests elsewhere are untouched).

**A1-7.** Two pins re-aim at what still exists: the mk0.50/3 WALL_COST pin (~2964) now asserts buildAt's fallback (`/spec \? spec\.cost : WALL_COST/`) instead of the deleted bar row; the POSSESSION T5(b) ring pin (~4892) — which passed by a character-distance accident the hover-branch collapse disturbed — now asserts the ACTUAL guard: `/if \(!S\.possess && S\.hover\)/` (the possessed frame never paints the build hover).

**Step 2 — the starting kit.** `src/depot/specs.js` (~line 136), with the ladder comment corrected in place (the START row of the two-ladders table loses wall · sandbag too):
```js
export const PLAYER_START = ["sq_rifles", "sq_engineers"]; // mk1.12 (owner): masonry is engineer work — walls and sandbags come only off their lines
```

**Step 3 — the bar and the modes.** `src/depot/DepotGame.jsx`:

(3a) PALETTE: delete the `{ key: "wall", ... }` entry and the `{ key: "sandbag", ... }` entry (the tower spread and every squad entry stay).
(3b) The run-state init: `mode: "wall"` → `mode: null`.
(3c) `setMode`: delete the sandbag re-tap orient-cycle block (the `if (m === "sandbag" && S.mode === "sandbag" ...)` early return).
(3d) `tapAt`: delete the `if (S.mode === "wall") { buildAt(...); return; }` line and the `if (S.mode === "sandbag") { placeSandbagAt(...); return; }` line; the trailing tower path gains its guard:
```js
        if (S.mode && TOWER_SPECS[S.mode]) {
          const v = canBuildAt(g.gx, g.gz, S.mode);
          if (!v.ok) { toast(v.msg); return; }
          startPending(g.gx, g.gz, S.mode, v);
        }
```
(3e) Delete `placeSandbagAt` (its only caller died). `spawnSandbag` itself stays — engineers and the seeded ring use it.
(3f) The hover-ghost sandbag branch (the `S.mode === "sandbag"` oriented-footprint pad) simplifies to the plain `GRID_CS` pad — the branch dies.
(3g) The palette bar's sandbag icon-cycling map line (`p.key === "sandbag" ? { ...p, icon: ... }` in the render) dies with the entry.
(3h) The start overlay copy: `Wall their road, gun the choke points.` → `Gun the choke points; your engineers dig the lines.` (one sentence, nothing else in the overlay moves — the full site audit is Task 7's).

**Step 4 — green, bump, build, smoke.** `npm run lint:depot` · `npm run test:depot` fully green (the three named re-pins, nothing else) · `src/version.js` → `"mk1.12"` · `npm run build` AFTER the bump · `SMOKE_ONLY=depot npm run smoke`.

**Gates (ONLY these):** parse changed files · `npm run lint:depot` · `npm run test:depot` (Step 1 red-first, then green; three named re-pins reported old→new) · `npm run build` after the bump · `SMOKE_ONLY=depot` smoke. Allowed files: `src/depot/DepotGame.jsx`, `src/depot/specs.js`, `scripts/depot-test.mjs`, `src/version.js`. Commit `"only engineers build: the god hand loses its trowel (mk1.12)"`, push, CI green, STOP. The owner checks the deployed site: a two-slot opening bar, fortification only through engineer lines, towers dropping from the bar as always.

---

# TASK 2 — Stone doesn't murder pedestrians (mk1.11)

**What it does.** Ends the wall kill. Today the engine ejects a body that ends up overlapping stone, and the impact classifier reads a hard ejection as a lethal slam — a man squeezed against a standing building by his own formation dies to a wall that never moved (the owner lost one this way). The new rule, in one sentence: A SLEEPING STONE IS NOT A WEAPON. Under depot combat, a chunk that is asleep — a standing wall face, settled rubble — can neither deal the lethal ejection slam to a living man nor count as burying him. Everything that actually moves keeps killing exactly as today: falling and flying masonry (the falling-stone clock is reset the moment a chunk sleeps, so those paths never see a sleeping stone anyway), and genuine burial (the classifier itself keeps any stone truly bearing on a man AWAKE — that line already exists — so a pinning pile is never asleep and never exempt).

**Why the guard is "sleeping" and not "standing welded":** sleeping is the physically honest test — an asleep body has zero velocity by definition, so any contact force against it is pure position correction, not a blow. It also covers settled loose rubble a man walks across, which could eject-kill exactly like a wall. The owner's intent — walking into stone must not kill — is the rule; sleeping is its exact mechanical form.

**Frozen-law note:** engine change in `core.js`'s impact classifier, GUARDED on `world.depotCombat` like every depot divergence — the demo, tower defense, campaign, and sandbox are byte-identical, and golden stays green by construction. The ONE world that legitimately changes is the depot — so the T6 keystone's pinned hash and draw count MAY move: that re-pin is EXPECTED, NAMED, and reported old→new. It is this task's delta made visible. Any OTHER assert moving is a defect — STOP.

**Feel changes:** men stop dying at walls. Nothing else.

**Suggested model:** Sonnet — the edit is three lines plus a comment, specified verbatim; the tests are the work.

**Required reading (re-verify anchors at dispatch):**
- `src/engine/core.js` — 1641–1707 (classifyImpacts, the whole function — the edit site), 1708–1760 (stepStatus head: the burial clock and the `other.sleepT = 0` line's consumer, read-only), 1857–1889 (stepSleep, read-only — why sleeping means motionless).
- `scripts/golden.mjs` — whole (run-only; its worlds never set depotCombat — verify that, it is what keeps golden green).
- `scripts/depot-test.mjs` — 1–70, the FRONT T6 block (the keystone whose pins may move), the P6 T1 block + tail (the new block lands before the tail).
- `src/version.js`.

**Trap notes:**
- The guard is `world.depotCombat && other.kind === "chunk" && other.sleeping && victim.kind === "unit"` — vehicles ramming walls, the demo, and every ungated world keep today's behavior byte-for-byte.
- The COLLAPSE branch needs NO edit: it requires a live falling clock (`fallingSince > 0`), and the "chunks settle" line already clears that the moment a chunk sleeps.
- The burial exemption removes the `other.sleepT = 0` reset for sleeping stones — harmless: they are already asleep, and stones genuinely bearing on a man were never asleep in the first place.
- EXPECTED RE-PINS: exactly one PAIR may move — the T6 keystone's `T6_HASH`/`T6_DRAWS` (a man surviving a wall in that battle changes everything downstream of him, deterministically). If they move, re-pin old→new and REPORT both values. If they do NOT move, that is also fine (the fixture may contain no such death) — report that. Any other assert moving is a STOP.
- Red-first discipline for the (a) fixture: if the embedded man SURVIVES before the fix (the fixture too weak to trigger the old kill), that is a STOP-and-report, not a fixture tweak.
- FULL `npm run smoke` — engine change, every surface rides it.

## Steps, in execution order

**Step 1 — failing asserts first.** Insert the P6-T2 block before the tail summary; `npm run test:depot` shows (a) red (the embedded man dies under today's rule) and the (d) source pin red; (b) green already (falling stone kills both before and after — record it as green-first, that is its job). Record the exact reds.

```js
// ==== P6 T2: stone doesn't murder pedestrians ===============================
// mk1.11 (Troops & Physics, Task 2). A sleeping stone is not a weapon: under
// depot combat the ejection out of a standing wall (or settled rubble) can
// no longer slam a living man dead, and a sleeping stone never counts as
// burying him. Falling stone kills exactly as before — (b) proves it.
{
  console.log("\n[p6 t2: stone doesn't murder pedestrians]");
  const flatT2 = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } };

  // one welded, sleeping two-stone stack — a standing wall face
  const buildStack = (world, x, z) => {
    const lo = addBody(world, { kind: "chunk", team: 0, mass: 100, hx: 0.4, hy: 0.4, hz: 0.4, x, y: 0.42, z, friction: 0.65, restitution: 0.02 });
    const hi = addBody(world, { kind: "chunk", team: 0, mass: 100, hx: 0.4, hy: 0.4, hz: 0.4, x, y: 1.25, z, friction: 0.65, restitution: 0.02 });
    addWeld(world, lo, hi, 8.0e4);
    lo.sleeping = true; hi.sleeping = true;
    return { lo, hi };
  };

  // (a) THE WALL KILL DIES: a man pressed into a sleeping wall by his own
  // side's shoving (deterministic pushes, the cohesion squeeze in miniature)
  // is ejected but NOT killed. RED before the fix — he dies today.
  {
    const world = makeWorld({ field: flatT2, seed: 9 });
    world.depotCombat = true;
    buildStack(world, 0, 5);
    const man = addBody(world, { kind: "unit", team: 1, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x: 0, y: 0.86, z: 4.5, hp: 58, friction: 0.55 });
    for (let i = 0; i < 360; i++) {
      if (i < 180 && i % 24 === 0 && man.alive) { man.v.z = 3.0; } // the squeeze, re-applied
      stepWorld(world);
    }
    ok("T2(a): the man pressed into a sleeping wall SURVIVES", man.alive === true, `alive=${man.alive} hp=${man.alive ? man.hp.toFixed(0) : "dead"}`);
  }

  // (a2) settled loose rubble is exempt the same way (no weld, still asleep)
  {
    const world = makeWorld({ field: flatT2, seed: 9 });
    world.depotCombat = true;
    const r1 = addBody(world, { kind: "chunk", team: 0, mass: 100, hx: 0.4, hy: 0.4, hz: 0.4, x: 0, y: 0.42, z: 5, friction: 0.65, restitution: 0.02 });
    r1.sleeping = true;
    const man = addBody(world, { kind: "unit", team: 1, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x: 0, y: 0.86, z: 4.5, hp: 58, friction: 0.55 });
    for (let i = 0; i < 360; i++) {
      if (i < 180 && i % 24 === 0 && man.alive) { man.v.z = 3.0; }
      stepWorld(world);
    }
    ok("T2(a2): the man pressed into sleeping rubble SURVIVES", man.alive === true, `alive=${man.alive}`);
  }

  // (b) FALLING STONE STILL KILLS (green before AND after — the guard's
  // honesty check): a freed chunk dropped on a man's head stays lethal.
  {
    const world = makeWorld({ field: flatT2, seed: 9 });
    world.depotCombat = true;
    const man = addBody(world, { kind: "unit", team: 1, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x: 0, y: 0.86, z: 5, hp: 58, friction: 0.55 });
    const rock = addBody(world, { kind: "chunk", team: 0, mass: 100, hx: 0.4, hy: 0.4, hz: 0.4, x: 0, y: 7, z: 5, friction: 0.65, restitution: 0.02 });
    rock.fallingSince = world.t; // severed mid-collapse, exactly as weldBreakPass stamps it
    for (let i = 0; i < 600 && man.alive; i++) stepWorld(world);
    ok("T2(b): falling stone still kills (green first, green after)", man.alive === false, `alive=${man.alive}`);
  }

  // (c) the demo path is untouched: same squeeze, depotCombat OFF — the man
  // dies today and keeps dying (byte-identical ungated worlds; golden's law).
  {
    const world = makeWorld({ field: flatT2, seed: 9 });
    buildStack(world, 0, 5);
    const man = addBody(world, { kind: "unit", team: 1, mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x: 0, y: 0.86, z: 4.5, hp: 58, friction: 0.55 });
    for (let i = 0; i < 360; i++) {
      if (i < 180 && i % 24 === 0 && man.alive) { man.v.z = 3.0; }
      stepWorld(world);
    }
    ok("T2(c): the ungated world keeps today's behavior (he still dies there)", man.alive === false, `alive=${man.alive}`);
  }

  // (d) source pin: the guard exists, gated, in the classifier
  const csrcT2 = fs.readFileSync(new URL("../src/engine/core.js", import.meta.url), "utf8");
  ok("T2(d): the sleeping-stone guard exists in classifyImpacts",
    /SLEEPING STONE IS\s*\n?\s*\/\/ NOT A WEAPON|SLEEPING STONE IS NOT A WEAPON/.test(csrcT2) && /inertStone/.test(csrcT2));
}
// ==== end P6 T2 ==============================================================
```
Note on (c): if the ungated man SURVIVES today (the fixture squeeze too weak even for the old rule), (a) will not be red either — that is the red-first STOP; report it rather than strengthening the squeeze on your own authority.

## AMENDMENT 1 (owner's ruling, 2026-08-13) — the wall grows a head

*Found in execution, exactly where the red-first discipline looks: the two-stone fixture wall cannot kill under today's rule — the ejection out of a shallow overlap never reaches the lethal threshold. The TRUE field killer is the BURIAL CLOCK: a real building face is three courses, its head-height stone overlaps a pressed man's head zone, `pn > 5` reads it as "bearing down", and the clock kills him in 1.1 seconds as a collapse casualty. The engine edit is UNCHANGED — `inertStone` already guards the burial line. Only the fixtures grow to match the truth.*

**Step A1-1.** `buildStack` becomes a THREE-course face (the third stone is the head-height one):
```js
  const buildStack = (world, x, z) => {
    const lo = addBody(world, { kind: "chunk", team: 0, mass: 100, hx: 0.4, hy: 0.4, hz: 0.4, x, y: 0.42, z, friction: 0.65, restitution: 0.02 });
    const mid = addBody(world, { kind: "chunk", team: 0, mass: 100, hx: 0.4, hy: 0.4, hz: 0.4, x, y: 1.25, z, friction: 0.65, restitution: 0.02 });
    const hi = addBody(world, { kind: "chunk", team: 0, mass: 100, hx: 0.4, hy: 0.4, hz: 0.4, x, y: 2.08, z, friction: 0.65, restitution: 0.02 });
    addWeld(world, lo, mid, 8.0e4); addWeld(world, mid, hi, 8.0e4);
    lo.sleeping = true; mid.sleeping = true; hi.sleeping = true;
    return { lo, mid, hi };
  };
```

**Step A1-2.** The (a2) rubble fixture becomes the SAME three stones WITHOUT welds (a settled pile a man is pressed against), all sleeping — its assert text and expectation unchanged (he survives after the fix).

**Step A1-3.** Expectations, restated: red-first shows (a) RED (the burial clock kills him today), (a2) RED (same clock, unwelded pile), (b) GREEN (falling stone kills), (c) GREEN (the ungated man dies today — and KEEPS dying after the fix, since the guard is gated), (d) RED (no guard yet). After Step 2: all five green.

## AMENDMENT 2 (owner's ruling, 2026-08-13) — golden carries the parity proof

*Found in execution: fixture (c)'s premise was FALSE. The mk0.98 wake exemption ("infantry can't wake welded sleeping masonry") also keys off `world.depotCombat` — with the flag OFF, the squeeze WAKES the ungated wall, the stones shift, and the burial clock never gets its sustained bearing. The ungated man survives today for reasons that predate this task, and the fixture can never honestly pass. Rulings:*

**Step A2-1.** Fixture (c) is DELETED. Ungated parity is the GOLDEN gate's job — it runs demo-versus-engine on scripted battles in this task's own gate list and proves byte-identity outright.

**Step A2-2.** Fixture (a2) is restated as a GREEN-BOTH-WAYS sanity, assert text updated to say so: unwelded sleeping rubble WAKES when brushed (the wake exemption requires a live weld), so it never killed the pressed man and must keep not killing him after the fix.

**Step A2-3.** Expectations, final form: red-first shows (a) RED and (d) RED; (a2) and (b) GREEN. After Step 2: all four green. The keystone pair: unmoved at this task's landing (measured — `hash=2061472628 draws=551`), no re-pin.

**Step 2 — the engine edit.** `src/engine/core.js`, classifyImpacts. Directly after `const dv = pn * victim.invM;` (line 1659):
```js
    // DIVERGENCE (guarded, mk1.11 — the owner's ruling): A SLEEPING STONE IS
    // NOT A WEAPON. Under depotCombat, a chunk that is ASLEEP — a standing
    // wall face, settled rubble — can neither slam a living man dead (the
    // depenetration ejection read as lethal IMPACT below) nor count as
    // burying him. It has no motion to kill with. Everything that moves is
    // untouched: falling stone's clock (fallingSince) is cleared the moment
    // a chunk sleeps, and a stone genuinely BEARING on a man is kept awake
    // by the burial line itself — a pinning pile is never asleep.
    const inertStone = world.depotCombat && other && other.kind === "chunk" && other.sleeping && victim.kind === "unit";
```
The burial line (1670–1673) gains the guard in its condition:
```js
    if (victim.kind === "unit" && other && other.kind === "chunk" && pn > 5 && !inertStone &&
```
And the final lethal-IMPACT branch (1692) gains it:
```js
    } else if (dv > (other && other.kind === "ice" ? 24 : 8) && !inertStone) {
```
Nothing else in the function moves.

**Step 3 — the proof gates.** `npm run test:depot`: the T2 block fully green; the T6 keystone MAY go red on its two pins — if so, rerun to confirm the new printed values are stable, re-pin `T6_HASH`/`T6_DRAWS` to them, and REPORT old→new for both (the one named, expected re-pin). Everything else green, zero other re-pins. Then `npm run golden` — green (the guard is gated; golden's worlds never set depotCombat — verified in reading). Then `npm run lint:depot`.

**Step 4 — bump, build, full smoke.** `src/version.js` → `"mk1.11"` · `npm run build` AFTER the bump · `npm run smoke` (FULL — engine change).

**Gates (ONLY these):** parse changed files · `npm run lint:depot` · `npm run test:depot` (Step 1 red-first, then green; the keystone pair is the only allowed re-pin, reported old→new) · `npm run golden` · `npm run build` after the bump · `npm run smoke` (full). Allowed files: `src/engine/core.js`, `scripts/depot-test.mjs`, `src/version.js`. Commit `"stone doesn't murder pedestrians (mk1.11)"`, push, CI green, STOP. The owner plays normally — the test is that nobody mysteriously dies at a wall again.

---

# TASK 1 — The path that walks around (mk1.10)

**What it does.** Squad marches get a real route. When an order's destination appears (or changes, or progress stalls), the game layer computes a path on the movement grid — the same grid the enemy already navigates by — around buildings, field walls, rocks, and open water, through the causeway. The leg machine in squads.js walks that route waypoint by waypoint instead of marching a straight line into whatever stands in the way. One order now crosses the stream: the squad detours through the causeway on its own, and the T3 bank-hold becomes a never-fired backstop. A destination tapped ON a building (or otherwise unreachable) is honestly clamped to the nearest reachable ground beside it. The mid-march stall near masonry dies with the same stroke — squads no longer wedge their men against lattices their anchor walked through, and a route that stops making progress is recomputed.

**Division of labor (module laws hold):** route computation and staleness live in the GAME layer (two new module-level functions in DepotGame.jsx — they need the grid); squads.js only CONSUMES `squad._route`, popping waypoints as the anchor reaches them — movement-pure, zero new rng. The enemy's march is untouched. The possessed stick is untouched.

**Draw-count note, stated:** the one-draw-per-leg contract is UNCHANGED — but a routed march can have more legs than the old straight march on the same order (the detour is longer), so total draws per march legally differ from mk1.05. The contract was always per-leg, never per-march; twin determinism holds (same code, same seed, same route).

**Feel changes that ship for the owner's eyes:** order a squad across the stream and they walk the crossing themselves; order them behind a building and they go around it, not into it; the patrol that loops through town flows around masonry; squads stop freezing mid-march near buildings.

**Suggested model:** Sonnet — all code specified below.

**Required reading (re-verify anchors at dispatch):**
- `src/depot/squads.js` — WHOLE FILE (726 lines; the leg machine at 500–632 is the edit site; the header laws and the one-draw contract at 13–15 bind every line).
- `src/depot/DepotGame.jsx` — 398–466 (makeGrid/computeFlowField/streamAt), 570–592 (checkConnectivity — the new functions land after it), 863–960 (stepDepot; the squad loop, `engageCheck(sq);` at 927 — one call lands beside it), the consumeOrderTap region (find `OPEN WATER — find the crossing`), read-only context.
- `src/depot/save.js` — 300–345 (the squad serializer/restorer — verify how `_route` rides or self-heals; no edits).
- `src/ui/Roadmap.jsx` — 14–28 (the flip + the new card).
- `scripts/depot-test.mjs` — 1–70 (harness), the FRONT T3 block (its (e)/(f) fixtures are the pattern), the tail (the new block lands before it).
- `src/version.js`.

**Trap notes:**
- ZERO new rng anywhere. Route computation, staleness, waypoint popping — all deterministic. The leg-arrival draw stays exactly where it is and fires exactly once per leg.
- The T3 bank-hold line in squads.js (`the anchor never fords`) STAYS — it is the backstop for a stale route crossing fresh water. The T3(f) test fixture has no route (nothing calls the routing there), so it must pass UNCHANGED — EXPECTED RE-PINS: none. Any old assert moving is a defect: STOP and report.
- `stepSquadRouting` runs in stepDepot BEFORE `stepSquad`, so a fresh order routes the same tick it first steps.
- Waypoint pop tolerance (1.2m) is deliberately larger than ARRIVE_TOL (1.0) and smaller than a grid cell (2.0) — a popped waypoint never re-triggers, and the final waypoint IS the (possibly clamped) destination so arrival stays squads.js's own dToDest branch, untouched.
- The destination CLAMP mutates `sq.dest` (and a patrol's matching endpoint) once, at route time, in the game layer — squads.js never mutates dest except its own arrival/patrol flips, as today.
- Save/resume: verify the squad serializer at dispatch — if `_route` rides the generic field copy it must round-trip as plain {x,z} objects (it does — it is plain data); if the serializer whitelists fields and drops it, the route self-heals on the first resumed tick (stepSquadRouting sees dest without route). Either way: NO save.js edits.
- A squad whose destination cell and anchor cell are the same routes to a single-waypoint route (the dest) — the machine degenerates to today's behavior on short orders.
- planRoute's BFS uses the SAME corner-cut rule as computeFlowField (no diagonal squeeze between two blocked cells) — copy the rule, don't invent one.
- `__DEPOTORDER__` and the build line need no edits: both set `sq.dest` and the routing reacts to the change next tick.

## Steps, in execution order

**Step 1 — failing asserts first.** Insert the P6-T1 block before the tail summary; `npm run test:depot` shows it red (planRoute/stepSquadRouting missing from the extraction; squads.js waypoint pins absent). Everything else stays green. Record the exact reds.

```js
// ==== P6 T1: the path that walks around =====================================
// mk1.10 (Troops & Physics, Task 1). Squad marches follow a computed route
// on the movement grid: around masonry, through the causeway. The leg
// machine consumes waypoints; routes are drawn/redrawn by the game layer.
// Zero new rng; the one-draw-per-leg contract is untouched.
{
  console.log("\n[p6 t1: the path that walks around]");
  const src = fs.readFileSync(new URL("../src/depot/DepotGame.jsx", import.meta.url), "utf8");
  let M1ok = true, mk1 = null;
  try {
    const sliceFnP = (name) => {
      const start = src.indexOf(`\nfunction ${name}(`);
      if (start < 0) throw new Error("P6T1 extract: missing function " + name);
      const rest = src.slice(start + 1);
      const m = rest.slice(9).search(/\n(?:function |export |const [A-Z])/);
      return rest.slice(0, m < 0 ? rest.length : m + 9);
    };
    const headerP = src.slice(src.indexOf("const GRID_CS"), src.indexOf("function genMap"));
    const mapSrcP = [
      headerP,
      sliceFnP("genMap"), sliceFnP("makeMap"), sliceFnP("streamAt"), sliceFnP("planTrees"),
      sliceFnP("pondAt"), sliceFnP("rockAt"),
      sliceFnP("makeGrid"), sliceFnP("checkConnectivity"), sliceFnP("planRoute"), sliceFnP("stepSquadRouting"),
      sliceFnP("townFootprint"), sliceFnP("buildTown"),
      `return { makeMap, makeGrid, planRoute, stepSquadRouting, streamAt, invW, fwdU,
        state: () => ({ ORIENT, TOWN, STREAM, MAP_SEED }) };`,
    ].join("\n");
    mk1 = () => new Function(
      "mulberry32", "MASON", "fwdUFor", "fwdDirFor", "invWFor", "addBody", "addWeld", mapSrcP,
    )(mulberry32, MASON, fwdUFor, fwdDirFor, invWFor, addBody, addWeld);
  } catch (e) { M1ok = false; }
  ok("P6T1: the map module extracts with planRoute and stepSquadRouting", M1ok);

  if (M1ok) {
    // (a) the causeway: on 10 seeds, a route across the stream passes within
    // the causeway's exemption (|u - bridgeU| < 3) as it crosses the water line.
    let crossed = 0;
    for (let s = 1; s <= 10; s++) {
      const Mi = mk1(); Mi.makeMap(s * 613);
      const st = Mi.state();
      const g = Mi.makeGrid(null);
      const a = Mi.fwdU(0, st.STREAM.v + 20), d = Mi.fwdU(0, st.STREAM.v - 20);
      const route = Mi.planRoute(g, a.x, a.z, d.x, d.z);
      if (!route) continue;
      let okX = false;
      for (const p of route.pts) {
        const c = Mi.invW(p.x, p.z);
        if (Math.abs(c.v - st.STREAM.v) < 5 && Math.abs(c.u - st.STREAM.bridgeU) < 3.5) okX = true;
      }
      if (okX) crossed++;
    }
    ok("P6T1(a): routes cross the stream at the causeway (10 seeds)", crossed === 10, `${crossed}/10`);

    // (b) around, not through: a route past the biggest building never enters
    // a blocked cell, and ends within a cell of its destination.
    {
      const Mi = mk1(); Mi.makeMap(4242);
      const st = Mi.state();
      const g = Mi.makeGrid(null);
      Mi.buildTown(makeWorld({ field: { heightAt: () => 0 }, seed: 5 }), g, { heightAt: () => 0 }); // claims footprints
      const big = st.TOWN.filter((t) => !t.depot).sort((x, y) => y.nx * y.nz - x.nx * x.nz)[0];
      const route = Mi.planRoute(g, big.x - 14, big.z, big.x + 14, big.z);
      ok("P6T1(b): a route exists past the biggest building", !!route && route.pts.length >= 2, route && `${route.pts.length} pts`);
      if (route) {
        const foul = route.pts.filter((p) => { const c = g.cellAt(p.x, p.z); return c && c.blocked; }).length;
        ok("P6T1(b): no route point stands on a blocked cell", foul === 0, `${foul} fouls`);
        const end = route.pts[route.pts.length - 1];
        ok("P6T1(b): the route ends beside the asked ground", Math.hypot(end.x - (big.x + 14), end.z - big.z) < 2.9, Math.hypot(end.x - (big.x + 14), end.z - big.z).toFixed(2));
      }
    }

    // (c) the honest clamp: a destination ON the building routes to the
    // nearest reachable ground beside it, and stepSquadRouting rewrites
    // sq.dest to that point.
    {
      const Mi = mk1(); Mi.makeMap(4242);
      const st = Mi.state();
      const g = Mi.makeGrid(null);
      Mi.buildTown(makeWorld({ field: { heightAt: () => 0 }, seed: 5 }), g, { heightAt: () => 0 });
      const big = st.TOWN.filter((t) => !t.depot).sort((x, y) => y.nx * y.nz - x.nx * x.nz)[0];
      const sq = { order: "move", dest: { x: big.x, z: big.z }, anchor: { x: big.x - 14, z: big.z }, _route: null };
      Mi.stepSquadRouting(g, sq);
      ok("P6T1(c): an unreachable destination is clamped to reachable ground",
        !!sq._route && Math.hypot(sq.dest.x - big.x, sq.dest.z - big.z) > 1.5 && Math.hypot(sq.dest.x - big.x, sq.dest.z - big.z) < 12,
        `moved ${Math.hypot(sq.dest.x - big.x, sq.dest.z - big.z).toFixed(2)}m`);
      const endC = sq._route && g.cellAt(sq.dest.x, sq.dest.z);
      ok("P6T1(c): the clamped ground is not blocked", !!endC && !endC.blocked);
    }

    // (d) determinism twin: identical routes from identical seeds.
    {
      const A = mk1(); A.makeMap(7717); const gA = A.makeGrid(null);
      const B = mk1(); B.makeMap(7717); const gB = B.makeGrid(null);
      const wa = A.fwdU(-30, -30), wd = A.fwdU(30, 30);
      ok("P6T1(d): twin determinism — identical routes",
        JSON.stringify(A.planRoute(gA, wa.x, wa.z, wd.x, wd.z)) === JSON.stringify(B.planRoute(gB, wa.x, wa.z, wd.x, wd.z)));
    }
  }

  // (e) the leg machine walks a route: stubbed water band with a gap at
  // x=20; a squad with a route through the gap crosses and digs in; the
  // T3(f) routeless squad still holds at the bank (that block re-proves it).
  {
    const flatFP = { heightAt: () => 0, dirty: false, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } };
    const world = makeWorld({ field: flatFP, seed: 5 });
    world.streamAt = (x, z) => z > 10 && z < 14 && !(x > 18 && x < 22);
    const sq = makeSquad(1, "rifles", 1, 0, 0);
    spawnSquadMembers(world, sq);
    sq.order = "move"; sq.dest = { x: 0, z: 30 };
    sq._route = [{ x: 20, z: 6 }, { x: 20, z: 18 }, { x: 0, z: 30 }];
    for (let i = 0; i < 4800; i++) { stepSquad(world, sq, 1 / 60); stepWorld(world); }
    ok("P6T1(e): the routed squad crosses at the gap and digs in", sq.order === "defend" && Math.hypot(sq.anchor.x - 0, sq.anchor.z - 30) < 1.5, `${sq.order} at (${sq.anchor.x.toFixed(1)}, ${sq.anchor.z.toFixed(1)})`);
    ok("P6T1(e): the route is consumed", !sq._route || sq._route.length === 0, sq._route && `${sq._route.length} left`);
  }

  // (f) source pins
  const sqsrcP = fs.readFileSync(new URL("../src/depot/squads.js", import.meta.url), "utf8");
  ok("P6T1(f): the leg machine pops waypoints", /squad\._route\.shift\(\);/.test(sqsrcP));
  ok("P6T1(f): legs aim at the waypoint, arrival still reads the true dest", /const wp = squad\._route && squad\._route\.length \? squad\._route\[0\] : squad\.dest;/.test(sqsrcP));
  ok("P6T1(f): stepDepot routes every ordered squad", /stepSquadRouting\(grid, sq\);/.test(src));
}
// ==== end P6 T1 ==============================================================
```

## AMENDMENT 1 (owner's ruling, 2026-08-13) — two test-side corrections

*Found in execution: (1) the Step 1 extraction pulls `buildTown`'s source but omits it from the return list — every other extraction block in the suite lists it; fixtures (b)/(c) crashed. (2) The causeway assert looked for a waypoint near the crossing, but routes keep only TURNING points — a straight run through the causeway leaves no waypoint there (measured 6/10; the routing itself cannot cross anywhere else, water is blocked ground). Both are defects in the plan's own test code; Steps 2–5 stand as landed.*

**Step A1-1.** The extraction's return line gains `buildTown`:
```js
      `return { makeMap, makeGrid, buildTown, planRoute, stepSquadRouting, streamAt, invW, fwdU,
        state: () => ({ ORIENT, TOWN, STREAM, MAP_SEED }) };`,
```

**Step A1-2.** The (a) fixture's per-route check is REPLACED — sample along the route's SEGMENTS (from the anchor through every waypoint) at half-meter steps; a sample inside the stream's v-band within the causeway's u-band is the crossing:
```js
      let okX = false;
      let px = a.x, pz = a.z;
      for (const p of route.pts) {
        const segL = Math.hypot(p.x - px, p.z - pz);
        for (let sd = 0; sd <= segL; sd += 0.5) {
          const c = Mi.invW(px + (p.x - px) * (sd / (segL || 1)), pz + (p.z - pz) * (sd / (segL || 1)));
          if (Math.abs(c.v - st.STREAM.v) < 3 && Math.abs(c.u - st.STREAM.bridgeU) < 3.5) { okX = true; break; }
        }
        if (okX) break;
        px = p.x; pz = p.z;
      }
```
(the surrounding loop and the `crossed === 10` assert stand unchanged).

**Step 2 — planRoute and stepSquadRouting.** `src/depot/DepotGame.jsx`, both module-level, inserted directly after `checkConnectivity` (after line 592):
```js
// P6 T1: THE ROUTE. Squads march the same grid the enemy trusts. planRoute
// is a breadth-first search from the anchor's cell (8-way, with
// computeFlowField's own corner rule) that reaches for the destination cell
// and settles for the CLOSEST reachable cell when the asked ground is
// blocked or walled off. The cell path is thinned to its turning points and
// returned as world waypoints, destination last. Deterministic, zero rng.
function planRoute(grid, ax, az, dx, dz) {
  const s = grid.worldToGrid(ax, az);
  if (!grid.inBounds(s.gx, s.gz)) return null;
  const t = { gx: Math.max(0, Math.min(grid.w - 1, grid.worldToGrid(dx, dz).gx)),
              gz: Math.max(0, Math.min(grid.h - 1, grid.worldToGrid(dx, dz).gz)) };
  const { cells } = grid;
  const prev = new Int32Array(grid.w * grid.h).fill(-2);
  const si = grid.idx(s.gx, s.gz);
  prev[si] = -1;
  const q = [si];
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
  let head = 0, best = si, bestD = Infinity;
  while (head < q.length) {
    const ci = q[head++];
    const cgx = ci % grid.w, cgz = (ci / grid.w) | 0;
    const dd = Math.hypot(cgx - t.gx, cgz - t.gz);
    if (dd < bestD) { bestD = dd; best = ci; if (dd === 0) break; }
    for (const d of dirs) {
      const nx = cgx + d[0], nz = cgz + d[1];
      if (!grid.inBounds(nx, nz)) continue;
      const ni = grid.idx(nx, nz);
      if (prev[ni] !== -2 || cells[ni].blocked) continue;
      if (d[0] !== 0 && d[1] !== 0) {
        if (cells[grid.idx(cgx + d[0], cgz)].blocked || cells[grid.idx(cgx, cgz + d[1])].blocked) continue;
      }
      prev[ni] = ci;
      q.push(ni);
    }
  }
  if (best === si) return null; // nowhere to go (or already there)
  const cellsPath = [];
  for (let ci = best; ci !== -1; ci = prev[ci]) cellsPath.push(ci);
  cellsPath.reverse();
  const pts = [];
  for (let i = 1; i < cellsPath.length; i++) {
    const p0 = cellsPath[i - 1], p1 = cellsPath[i], p2 = cellsPath[i + 1];
    const turn = p2 == null ||
      (p1 % grid.w) - (p0 % grid.w) !== (p2 % grid.w) - (p1 % grid.w) ||
      ((p1 / grid.w) | 0) - ((p0 / grid.w) | 0) !== ((p2 / grid.w) | 0) - ((p1 / grid.w) | 0);
    if (turn) pts.push(grid.gridToWorld(p1 % grid.w, (p1 / grid.w) | 0));
  }
  return { pts, reached: bestD === 0 };
}

// P6 T1: route bookkeeping, one squad, once per sim tick (stepDepot calls
// it before stepSquad). Draws a route when the destination is new, rewrites
// an unreachable destination to the route's honest end (and a patrol's
// matching endpoint with it), and redraws the route when progress stalls
// (under half a meter of approach in three seconds — the mid-march stall's
// tombstone). Deterministic, zero rng, no draws.
function stepSquadRouting(grid, sq) {
  if (!sq.dest || (sq.order !== "move" && sq.order !== "attack" && sq.order !== "build" && sq.order !== "patrol")) {
    sq._route = null; sq._routeDest = null; return;
  }
  const destChanged = !sq._routeDest || Math.hypot(sq._routeDest.x - sq.dest.x, sq._routeDest.z - sq.dest.z) > 0.5;
  const wp = sq._route && sq._route.length ? sq._route[0] : sq.dest;
  const dWp = Math.hypot(wp.x - sq.anchor.x, wp.z - sq.anchor.z);
  if (!destChanged) {
    // the stall watch: approach distance must shrink, or the route is stale
    if (sq._routeD == null || dWp < sq._routeD - 0.5) { sq._routeD = dWp; sq._routeT = 0; }
    else { sq._routeT = (sq._routeT || 0) + 1 / 120; }
    if (sq._routeT < 3) return;
  }
  sq._routeD = null; sq._routeT = 0;
  const route = planRoute(grid, sq.anchor.x, sq.anchor.z, sq.dest.x, sq.dest.z);
  if (!route || !route.pts.length) { sq._route = null; sq._routeDest = { x: sq.dest.x, z: sq.dest.z }; return; }
  if (!route.reached) {
    // the honest clamp: they go as close as ground allows, and the order
    // (and a patrol's turnaround point) now SAYS so.
    const end = route.pts[route.pts.length - 1];
    if (sq.order === "patrol") {
      if (sq._patA && Math.hypot(sq.dest.x - sq._patA.x, sq.dest.z - sq._patA.z) < 0.5) sq._patA = { x: end.x, z: end.z };
      else if (sq._patB && Math.hypot(sq.dest.x - sq._patB.x, sq.dest.z - sq._patB.z) < 0.5) sq._patB = { x: end.x, z: end.z };
    }
    sq.dest = { x: end.x, z: end.z };
  }
  sq._route = route.pts;
  sq._routeDest = { x: sq.dest.x, z: sq.dest.z };
}
```

**Step 3 — stepDepot routes every ordered squad.** In the squad loop (line 927's neighborhood), directly BEFORE `engageCheck(sq);`:
```js
      stepSquadRouting(grid, sq);
      engageCheck(sq);
```

**Step 4 — the leg machine walks the route.** `src/depot/squads.js`, inside the order branch (line 520's block). Directly after `const cx = squad.anchor.x, cz = squad.anchor.z;` (line 521):
```js
    // P6 T1: the route — waypoints drawn by the game layer, consumed here.
    // Reaching a waypoint pops it (no draw: a waypoint is not a leg arrival);
    // legs aim at the live waypoint; ARRIVAL stays the true-dest branch below.
    while (squad._route && squad._route.length && Math.hypot(squad._route[0].x - cx, squad._route[0].z - cz) < 1.2) squad._route.shift();
    const wp = squad._route && squad._route.length ? squad._route[0] : squad.dest;
```
Then the two leg-target sites aim at `wp` instead of `squad.dest` — the threatened line (570):
```js
          squad._legTarget = coverHop(world, { x: cx, z: cz }, wp, bearing);
```
and the double-time block (575–579):
```js
          const dToWp = Math.hypot(wp.x - cx, wp.z - cz) || 1e-6;
          const step = Math.min(HOP_R * 1.5, dToWp);
          squad._legTarget = {
            x: cx + ((wp.x - cx) / dToWp) * step,
            z: cz + ((wp.z - cz) / dToWp) * step,
          };
```
Everything else — the arrival branch (dToDest against the TRUE dest), the patrol turnaround, the sapper hold, the cohesion band, the bank-hold line, the one leg-arrival draw — stays byte-identical. The patrol turnaround and the arrival flip both null `_legTarget` already; add `squad._route = null;` beside `squad._legTarget = null;` in BOTH branches (turnaround re-routes next tick via the game layer; an arrived squad carries no stale route).

**Step 5 — the roadmap flip (fold-in convention).** `src/ui/Roadmap.jsx` lines 21–22:
```js
  { name: "The Front", status: "DONE", desc: "A square map twice the ground, wilder seeds, hills, forests, a stream to cross." },
  { name: "Troops & Physics", status: "IN PROGRESS", desc: "Squads that walk around things, an economy that breathes, a lighter engine." },
```
(the Engineers & Arms card and everything after it shift down one line, untouched).

**Step 6 — green, bump, build, smoke.** `npm run lint:depot` · `npm run test:depot` fully green (zero re-pins; the T3 bank-hold block must pass unchanged) · `src/version.js` → `"mk1.10"` · `npm run build` AFTER the bump · `SMOKE_ONLY=depot npm run smoke`.

**Gates (ONLY these):** parse changed files · `npm run lint:depot` · `npm run test:depot` (Step 1 red-first, then green; zero re-pins) · `npm run build` after the bump · `SMOKE_ONLY=depot` smoke. Allowed files: `src/depot/DepotGame.jsx`, `src/depot/squads.js`, `src/ui/Roadmap.jsx`, `scripts/depot-test.mjs`, `src/version.js`. Commit `"the path that walks around: squads route the grid (mk1.10)"`, push, CI green, STOP. The owner checks the deployed site: one order across the stream walks the causeway; an order behind a building goes around; patrols flow through town; no more mid-march freezes at masonry.
