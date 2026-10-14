# T9 — The quiet floor (0.6.9)

One line. The first bench (T8) measured the bang and the ten seconds after it; its reading was that a step with nothing awake already costs 9.7 ms, and its profile never covered that quiet window. This task widens the bench, not the game: the quiet seconds before the burst are profiled and the watched functions are split by source line from the profiler's own line ticks, so the inlined loops inside stepWorld, stepDepot and stepStatus are named without a probe in the engine; the war runs with the body lists hot, as the live war runs them; a second round lands fifteen seconds after the first to test whether the bang's own passes run cold; the browser bench reads the quiet seconds before the burst and runs the real war as well as the sandbox; and the page is drawn as fixed pictures so any viewer shows it. Then the untouched game runs through it again on one drawn seed. Engine, renderer, and every game file stay untouched; the keystone is unchanged.

Checked on a fresh copy at plan-writing time: every file parses; `depot-lint` PASS; `depot-test` 1714 PASS / 0 FAIL; the keystone unchanged; smoke 27/27; the headless bench with a second burst and the allocation sampling, the browser bench in both modes, the page, and the page check each ran once on short windows to prove they run (their numbers were not read). Three faults found and fixed in the check: a fresh war's teaching cards and the convoy's window pause the war's steps, so the browser bench now silences the cards as the smoke does and presses LATER whenever the window stands; the page's heading read a field that no longer exists.

Suggested model: Sonnet 5.5 — four files replaced whole from this plan; the runs are commands; the report is the numbers they print.

## Required reading, in this order

1. `CLAUDE.md`
2. This file, whole, before the first edit.
3. `docs/superpowers/plans/2026-10-13-t8-the-davy-bench.md` — the sections "The seed law" and "Gates", and Steps 5–7 (the files this task replaces).
4. `scripts/smoke.mjs` lines 176–186 (the teaching-card sentinel the browser bench copies).

The report opens with a line confirming every file above was read.

## The seed law

Every bench run rolls its seed at startup and prints it first. No seed is written into any script. A rerun passes the drawn seed back on the command line. Every run appends one line to `.superpowers/experiments.log`. The run list draws one seed and passes it to every run; the page refuses to build if two runs of one world disagree in a non-timing field. The T8 records stay beside the new ones; they are a different world (seed 134682) and the page keeps them in their own group.

## Gates

Run only these, each through `node scripts/gate.mjs <name>`: `depot-lint`, `depot-test`, `smoke`. The smoke needs `npm run build` then `npm run preview &` first. `golden` does not run: no engine or renderer file is touched.

The keystone: `node src/depot/api.js gate 7 20` prints `seed 7  seconds 20 (2400 steps)  worldHash 1278094788  runHash 2033212782` on the untouched tree. Step 0 confirms it; Step 7 confirms it again unchanged. Any other number stops the task.

No test changes. Any failing test stops the task.

## Steps

### Step 0 — the keystone, before

Run `node src/depot/api.js gate 7 20`. The output must read exactly `seed 7  seconds 20 (2400 steps)  worldHash 1278094788  runHash 2033212782`. Record it.

### Step 1 — the headless bench, replaced whole

Replace the whole content of `scripts/diag-davy.mjs` with exactly this:

```js
// diag-davy.mjs — MEASURING TOOL, not a test (the diag- prefix; never in the
// deploy pipeline). THE DAVY BENCH (0.6.8, widened 0.6.9): boot one war on
// this machine, let it settle, fire one atomic round straight down onto a
// target, and record every step — the step's wall time, the awake bodies
// and chunks, the contacts, the live welds, the sweep tier, the bursts and
// weld breaks, the heap — with node's own sampling profiler over four
// windows: the quiet seconds before the burst, the burst, the ten seconds
// after, and (with --second) a second burst later in the same run. Each
// function's share of the time is named without a probe in the engine, and
// the watched functions are split by source line from the profiler's own
// line ticks.
//
//   node scripts/diag-davy.mjs [--seed N] [--mode sandbox|war] [--target town|walls|depot]
//        [--settle S] [--after S] [--second S] [--hot] [--label NAME] [--out DIR] [--alloc]
//
// --hot sets run._hot as the live war does once anything stands on the field,
// so the body lists are rebuilt every step and the hot scans read them.
// --second S fires a second round onto the same point S seconds after the
// first burst (S at least --after); its window is profiled on its own.
// The seed is ROLLED fresh at startup and printed first; a rerun passes it
// back with --seed. Every run appends one line to .superpowers/experiments.log.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { Session } from "node:inspector";
import { bootWar, tickWar, defaultTickInput, runHash } from "../src/depot/api.js";
import { worldHash } from "../src/engine/core.js";
import { fireDavyDown, countAwake, activeWeldCount, ringOfWalls } from "../src/depot/witness.js";
import { MK } from "../src/version.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const arg = (name, dflt) => { const i = process.argv.indexOf("--" + name); return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : dflt; };
const seed = arg("seed", null) != null ? parseInt(arg("seed"), 10) : Math.floor(Math.random() * 1000000) + 1;
const mode = arg("mode", "sandbox");
const target = arg("target", "town");
const settleS = +arg("settle", mode === "war" ? 30 : 5);
const afterS = +arg("after", 10);
const secondS = +arg("second", 0);
const label = arg("label", "base");
const outDir = arg("out", path.join(ROOT, "docs/superpowers/perf/davy"));
const alloc = process.argv.includes("--alloc");
const hot = process.argv.includes("--hot");
const STEP = 1 / 120;
if (secondS && secondS < afterS) { console.error("--second must be at least --after"); process.exit(2); }
console.log(`diag-davy ${MK} seed ${seed} mode ${mode} target ${target} settle ${settleS}s after ${afterS}s${secondS ? " second " + secondS + "s" : ""}${hot ? " hot" : ""} label ${label}${alloc ? " alloc" : ""}`);

// ---- the profiler: a window is started and stopped around a run of steps;
// self time is summed per function; the bench's own helpers and the
// inspector are left out; the watched functions are split by source line.
const session = new Session();
session.connect();
const post = (m, p) => new Promise((res, rej) => session.post(m, p || {}, (e, r) => (e ? rej(e) : res(r))));
await post("Profiler.enable");
await post("Profiler.setSamplingInterval", { interval: 100 });
const OWN = /@(diag-davy\.mjs|witness\.js|node:inspector)$/; // the bench's own helpers and the profiler's own start and stop are left out of the shares
const WATCH = /^(stepWorld|stepDepot|stepStatus|stepSleep|collectContacts|weldBreakPass|explode|tickWar|stepTown|stepEnemies|rebuildBodyLists|stepProjectiles)$/;
function summarize(profile) {
  const self = new Map();
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  let total = 0;
  for (let i = 0; i < profile.samples.length; i++) {
    const n = byId.get(profile.samples[i]);
    const dt = Math.max(0, profile.timeDeltas[i] || 0);
    const cf = n.callFrame;
    const name = (cf.functionName || "(anonymous)") + "@" + path.basename(cf.url || "");
    if (OWN.test(name)) continue;
    self.set(name, (self.get(name) || 0) + dt);
    total += dt;
  }
  const rows = [...self.entries()].sort((a, b) => b[1] - a[1]).map(([name, us]) => ({ name, ms: +(us / 1000).toFixed(2), pct: +(100 * us / Math.max(1, total)).toFixed(1) }));
  // the line ticks: for each watched function, its ticks summed by source line
  const byFn = new Map();
  for (const n of profile.nodes) {
    const fn = n.callFrame.functionName;
    if (!WATCH.test(fn) || !n.positionTicks) continue;
    let m = byFn.get(fn);
    if (!m) { m = new Map(); byFn.set(fn, m); }
    for (const pt of n.positionTicks) m.set(pt.line, (m.get(pt.line) || 0) + pt.ticks);
  }
  const lines = {};
  for (const [fn, m] of byFn) {
    const tot = [...m.values()].reduce((s, v) => s + v, 0);
    lines[fn] = [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([line, ticks]) => ({ line, ticks, pct: +(100 * ticks / Math.max(1, tot)).toFixed(1) }));
  }
  return { totalMs: +(total / 1000).toFixed(2), rows, lines };
}
const share = (p, re) => +p.rows.filter((r) => re.test(r.name)).reduce((s, r) => s + r.pct, 0).toFixed(1);
const topOf = (p, n) => p.rows.slice(0, n);
function allocTop(head) {
  const self = new Map();
  const walk = (n) => { const name = (n.callFrame.functionName || "(anonymous)") + "@" + path.basename(n.callFrame.url || ""); self.set(name, (self.get(name) || 0) + n.selfSize); for (const c of n.children || []) walk(c); };
  walk(head);
  return [...self.entries()].filter(([name]) => !OWN.test(name)).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([name, bytes]) => ({ name, mb: +(bytes / 1048576).toFixed(2) }));
}

// ---- the world
const war = bootWar({ seed, dev: mode === "sandbox" });
war.run.started = true;
if (mode === "war") war.run.bellAt = war.world.t + 1; // the first assault now, so the waves are afield by the burst
if (hot) war.run._hot = true;
const input = defaultTickInput();
const world = war.world;
let draws = 0;
const rng0 = world.rng;
world.rng = () => { draws++; return rng0(); };
let tx, tz, tname;
if (target === "depot") { tx = war.map.OBJ_POS.x; tz = war.map.OBJ_POS.z; tname = "the depot"; }
else {
  const t = war.town.reduce((best, b) => (!b.ruined && (!best || b.stones.length > best.stones.length) ? b : best), null);
  if (!t) { console.error("no town building to burst"); process.exit(1); }
  tx = t.x; tz = t.z; tname = `town building ${t.id} (${t.stones.length} stones)`;
}
const walls = target === "walls" ? ringOfWalls(world, war.field, tx, tz) : [];
const stonesNear = world.bodies.filter((b) => b.kind === "chunk" && Math.hypot(b.pos.x - tx, b.pos.z - tz) <= 25).length;
console.log(`target ${tname} at ${tx.toFixed(2)}, ${tz.toFixed(2)} — ${stonesNear} stones within 25 m, ${walls.length} wall courses laid; ${world.bodies.length} bodies, ${world.welds.length} welds at boot`);

// ---- the steps
const settleN = Math.round(settleS * 120), afterN = Math.round(afterS * 120), quietN = Math.min(240, settleN);
const rows = [];
let burstStep = -1, burst2Step = -1, fire2Step = -1;
const step = (i) => {
  const t0 = performance.now();
  const { events } = tickWar(war, STEP, input);
  const ms = performance.now() - t0;
  let boom = 0, wb = 0, lost = 0;
  for (const e of events) { if (e.type === "boom") boom++; else if (e.type === "weldbreak") wb++; else if (e.type === "structureLost") lost++; }
  const aw = countAwake(world), act = activeWeldCount(world), con = world.contacts.length;
  const load = act + con, sweeps = load > 900 ? 4 : load > 450 ? 7 : 12;
  rows.push({ i, t: +world.t.toFixed(4), ms: +ms.toFixed(3), awake: aw.awake, chunks: aw.chunks, contacts: con, welds: act, sweeps, booms: boom, breaks: wb, lost, heapMB: +(process.memoryUsage().heapUsed / 1048576).toFixed(1), bodies: world.bodies.length, rounds: world.projectiles.length });
  if (boom && burstStep < 0 && i >= settleN) burstStep = i;
  if (boom && burstStep >= 0 && burst2Step < 0 && fire2Step >= 0 && i >= fire2Step) burst2Step = i;
};
const mean = (a) => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);
const p95of = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * 0.95))] || 0; };
// the settle, with its last two seconds profiled as the quiet window
let i = 0;
for (; i < settleN - quietN; i++) step(i);
await post("Profiler.start");
for (; i < settleN; i++) step(i);
const quietProfile = summarize((await post("Profiler.stop")).profile);
const quietRows = rows.slice(settleN - quietN, settleN);
const last = rows[rows.length - 1];
console.log(`settled ${settleS}s in ${(rows.reduce((s, r) => s + r.ms, 0) / 1000).toFixed(1)}s wall — quiet step ${mean(quietRows.map((r) => r.ms)).toFixed(2)} ms over the last ${quietN} steps; awake ${last.awake}, chunks awake ${last.chunks}, bodies ${last.bodies}, rounds ${last.rounds}`);
// the burst window: fire, then step until the boom lands (ten steps at most)
const muzzleY = fireDavyDown(world, war.field, tx, tz);
await post("Profiler.start");
for (let k = 0; k < 10 && burstStep < 0; k++, i++) step(i);
const burstProfile = summarize((await post("Profiler.stop")).profile);
if (burstStep < 0) { console.error("no burst landed within ten steps"); process.exit(1); }
// the after window
if (alloc) { await post("HeapProfiler.enable"); await post("HeapProfiler.startSampling", { samplingInterval: 8192, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true }); }
await post("Profiler.start");
const afterEnd = burstStep + 1 + afterN;
for (; i < afterEnd; i++) step(i);
const afterProfile = summarize((await post("Profiler.stop")).profile);
const allocRows = alloc ? allocTop((await post("HeapProfiler.stopSampling")).profile.head) : null;
// the second burst, when asked: the same point, S seconds after the first
let second = null;
if (secondS) {
  fire2Step = burstStep + 1 + Math.round(secondS * 120);
  for (; i < fire2Step; i++) step(i);
  fireDavyDown(world, war.field, tx, tz);
  await post("Profiler.start");
  for (let k = 0; k < 120 && burst2Step < 0; k++, i++) step(i); // a second's grace: the first burst's rubble may still be in the air above the point, and the round falls past it to the ground
  const p2 = summarize((await post("Profiler.stop")).profile);
  if (burst2Step < 0) { console.error("no second burst landed within a second"); process.exit(1); }
  for (let k = 0; k < 120; k++, i++) step(i);
  const w2 = rows.slice(fire2Step, burst2Step + 1);
  second = { fireStep: fire2Step, step: burst2Step, ms: rows[burst2Step].ms, windowMs: +w2.reduce((s, r) => s + r.ms, 0).toFixed(3), nextMs: rows[burst2Step + 1].ms, breaks: rows[burst2Step].breaks, afterSecondMeanMs: +mean(rows.slice(burst2Step + 1, burst2Step + 121).map((r) => r.ms)).toFixed(3), shadow: share(p2, /^(occOf|segBoxHit)@/), explode: share(p2, /^explode@/), flow: share(p2, /^computeFlowField@/), profile: { totalMs: p2.totalMs, top: topOf(p2, 40), lines: p2.lines } };
}
session.disconnect();

// ---- the numbers
const burstRow = rows[burstStep];
const after = rows.slice(burstStep + 1, afterEnd);
const peakAwake = Math.max(...after.map((r) => r.chunks));
const quiet = after.findIndex((r) => r.chunks < Math.max(20, peakAwake * 0.1));
const heavySteps = quiet < 0 ? after.length : quiet;
const over7 = after.filter((r) => r.ms > 7).length;
const burstWindow = rows.slice(settleN, burstStep + 1);
const out = {
  tool: "diag-davy", mk: MK, node: process.version, startedAt: new Date().toISOString(),
  seed, mode, target, targetName: tname, tx: +tx.toFixed(2), tz: +tz.toFixed(2), stonesNear, wallCourses: walls.length, settleS, afterS, secondS, hot, label, muzzleY: +muzzleY.toFixed(2),
  bodies0: rows[0].bodies, welds0: world.welds.length, burstStep, fireStep: settleN,
  quiet: { steps: quietN, meanMs: +mean(quietRows.map((r) => r.ms)).toFixed(3), p95Ms: +p95of(quietRows.map((r) => r.ms)).toFixed(3), awake: Math.round(mean(quietRows.map((r) => r.awake))), rounds: Math.round(mean(quietRows.map((r) => r.rounds))), profile: { totalMs: quietProfile.totalMs, top: topOf(quietProfile, 40), lines: quietProfile.lines } },
  burst: { ms: burstRow.ms, windowMs: +burstWindow.reduce((s, r) => s + r.ms, 0).toFixed(3), nextMs: rows[burstStep + 1].ms, breaks: burstRow.breaks, lost: burstWindow.reduce((s, r) => s + r.lost, 0) + (after[0] ? after[0].lost : 0), profile: { totalMs: burstProfile.totalMs, top: topOf(burstProfile, 40), lines: burstProfile.lines } },
  after: { meanMs: +mean(after.map((r) => r.ms)).toFixed(3), p95Ms: +p95of(after.map((r) => r.ms)).toFixed(3), worstMs: +Math.max(...after.map((r) => r.ms)).toFixed(3), sumMs: +after.reduce((s, r) => s + r.ms, 0).toFixed(1), peakAwake, peakContacts: Math.max(...after.map((r) => r.contacts)), heavySteps, over7, profile: { totalMs: afterProfile.totalMs, top: topOf(afterProfile, 40), lines: afterProfile.lines } },
  second,
  shares: {
    shadow: share(burstProfile, /^(occOf|segBoxHit)@/), explode: share(burstProfile, /^explode@/), flow: share(burstProfile, /^computeFlowField@/), burstSweeper: share(burstProfile, /garbage collector/),
    solve: share(afterProfile, /^(solveContacts|relVelAt|applyImpulse|prepContacts)@/), pairs: share(afterProfile, /^(collectContacts|satBoxBox|unfileBody)@/), welds: share(afterProfile, /^(solveWelds|weldBreakPass|weldStressDecay)@/), sweeper: share(afterProfile, /garbage collector/), rest: share(afterProfile, /^(stepStatus|stepSleep|classifyImpacts|stepProjectiles|segBoxHit)@/),
  },
  identity: { worldHash: worldHash(world), runHash: runHash(war.run), draws, breaksTotal: rows.reduce((s, r) => s + r.breaks, 0), lostTotal: rows.reduce((s, r) => s + r.lost, 0), bodiesEnd: world.bodies.length, burst2Step },
  allocTop: allocRows, rows,
};
fs.mkdirSync(outDir, { recursive: true });
const file = path.join(outDir, `${label}-${mode}-${target}.json`);
fs.writeFileSync(file, JSON.stringify(out));
const S = out.shares;
const q = out.quiet;
const qTop = topOf(quietProfile, 4).map((r) => r.name.replace(/@.*$/, "") + ":" + r.pct).join(",");
const line = `${out.startedAt} diag-davy ${label} seed ${seed} mode ${mode} target ${target}${hot ? " hot" : ""} stones ${stonesNear} quietMs ${q.meanMs} quietTop ${qTop} burstMs ${burstRow.ms} nextMs ${out.burst.nextMs} shadow% ${S.shadow} explode% ${S.explode} flow% ${S.flow} lost ${out.burst.lost} afterMean ${out.after.meanMs} afterP95 ${out.after.p95Ms} afterWorst ${out.after.worstMs} peakAwake ${peakAwake} peakContacts ${out.after.peakContacts} heavySteps ${heavySteps} over7 ${over7} solve% ${S.solve} pairs% ${S.pairs} welds% ${S.welds} sweeper% ${S.sweeper}` + (second ? ` burst2Ms ${second.ms} next2Ms ${second.nextMs} shadow2% ${second.shadow} explode2% ${second.explode} flow2% ${second.flow}` : "") + ` hash ${out.identity.worldHash}/${out.identity.runHash} draws ${draws}` + (allocRows ? ` alloc ${allocRows.slice(0, 3).map((r) => r.name + ":" + r.mb + "MB").join(",")}` : "");
console.log(line);
const show = (title, p) => { console.log(title); for (const r of topOf(p, 8)) console.log(`  ${r.pct.toFixed(1).padStart(5)}%  ${r.ms.toFixed(1).padStart(8)} ms  ${r.name}`); };
show("quiet window, top eight:", quietProfile);
for (const fn of ["stepWorld", "stepDepot", "stepStatus", "collectContacts"]) if (quietProfile.lines[fn]) console.log(`  ${fn} by line: ` + quietProfile.lines[fn].slice(0, 6).map((l) => `${l.line}:${l.pct}%`).join(" "));
show("burst window, top eight:", burstProfile);
show("after window, top eight:", afterProfile);
if (second) show("second burst window, top eight:", { rows: second.profile.top });
fs.appendFileSync(path.join(ROOT, ".superpowers", "experiments.log"), line + "\n");
console.log(`wrote ${file}`);
```

### Step 2 — the browser bench, replaced whole

Replace the whole content of `scripts/diag-davy-browser.mjs` with exactly this:

```js
// diag-davy-browser.mjs — MEASURING TOOL, not a test. THE DAVY BENCH in the
// real browser on this machine's own display (0.6.8, widened 0.6.9): the
// sandbox or the real war at a given seed with the stopwatch on, the camera
// on the target, the quiet seconds before the burst read from the stopwatch's
// ring, then one atomic round through the __DEPOTDAVY__ hook and the ring
// read back again — frame, sim, render, steps run, awake bodies, awake
// chunks, contacts, bursts, heap — plus the browser's own trace for the
// memory sweeper.
//
//   npm run build && npm run preview &
//   DISPLAY=:0 node scripts/diag-davy-browser.mjs --seed N [--mode sandbox|war] [--tx X --tz Z]
//        [--settle S] [--before S] [--after S] [--label NAME] [--out DIR]
//
// In war mode the first bell is rung at once, so the first assault is afield
// through the burst, as the headless bench does. The seed is rolled and
// printed first when none is given; --tx/--tz name the target (the headless
// bench prints them); without them the largest town building by its cell
// count is the target. --before S is the quiet window read before the burst
// (the last S seconds of the settle).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import { MK } from "../src/version.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const arg = (name, dflt) => { const i = process.argv.indexOf("--" + name); return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : dflt; };
const seed = arg("seed", null) != null ? parseInt(arg("seed"), 10) : Math.floor(Math.random() * 1000000) + 1;
const mode = arg("mode", "sandbox");
const settleS = +arg("settle", mode === "war" ? 30 : 5), afterS = +arg("after", 10);
const beforeS = Math.min(settleS, +arg("before", 5));
const label = arg("label", "base");
const outDir = arg("out", path.join(ROOT, "docs/superpowers/perf/davy"));
const URL_BASE = process.env.PERF_URL || "http://localhost:4173/coldsnap/";
const CHROME = process.env.CHROME_BIN || "/usr/bin/chromium";
const STEP = 1 / 120;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
console.log(`diag-davy-browser ${MK} seed ${seed} mode ${mode} settle ${settleS}s before ${beforeS}s after ${afterS}s label ${label} display ${process.env.DISPLAY || "(unset)"}`);

const stats = (xs) => { if (!xs.length) return { n: 0, mean: 0, p95: 0, worst: 0 }; const s = [...xs].sort((a, b) => a - b); return { n: xs.length, mean: +(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2), p95: +s[Math.min(s.length - 1, Math.floor(s.length * 0.95))].toFixed(2), worst: +s[s.length - 1].toFixed(2) }; };
// one window's summary from the ring's frames
function summarize(fr) {
  if (!fr.length) return null;
  const elapsed = Math.max(0.001, (fr[fr.length - 1].t - fr[0].t) / 1000);
  const drawn = fr.filter((f) => f.drew);
  const booms = fr.reduce((s, f) => s + f.booms, 0);
  const burstIdx = fr.findIndex((f) => f.booms > 0);
  const simSeconds = fr.reduce((s, f) => s + f.steps * STEP, 0);
  const stepsSorted = fr.map((f) => f.steps).sort((a, b) => a - b);
  return {
    frames: fr.length, drawn: drawn.length, elapsedS: +elapsed.toFixed(2), rafHz: +(fr.length / elapsed).toFixed(1), drawHz: +(drawn.length / elapsed).toFixed(1),
    worldRate: +(simSeconds / elapsed).toFixed(3), stepsP50: stepsSorted[Math.floor(stepsSorted.length / 2)], stepsMax: stepsSorted[stepsSorted.length - 1], framesAtSix: fr.filter((f) => f.steps >= 6).length,
    frame: stats(fr.map((f) => f.frame)), sim: stats(fr.map((f) => f.sim)), render: stats(drawn.map((f) => f.render)),
    simPerStep: +(fr.reduce((s, f) => s + f.sim, 0) / Math.max(1, fr.reduce((s, f) => s + f.steps, 0))).toFixed(2),
    burstFrameMs: burstIdx >= 0 ? +fr[burstIdx].frame.toFixed(2) : null, burstRenderMs: burstIdx >= 0 ? +fr[burstIdx].render.toFixed(2) : null,
    over33: fr.filter((f) => f.frame > 33.4).length, peakAwakeChunks: Math.max(...fr.map((f) => f.chunks)), meanAwake: Math.round(fr.reduce((s, f) => s + f.awake, 0) / fr.length), peakContacts: Math.max(...fr.map((f) => f.contacts)),
    heapPeakMB: +(Math.max(...fr.map((f) => f.heap)) / 1048576).toFixed(1), booms,
  };
}

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: false, protocolTimeout: 600000,
  defaultViewport: { width: 960, height: 600 },
  args: ["--no-sandbox", "--window-size=960,600", "--window-position=0,0"],
  env: { ...process.env, DISPLAY: process.env.DISPLAY || ":0" },
});
let code = 0;
try {
  const page = await browser.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  await page.goto("about:blank");
  const gpu = await page.evaluate(() => {
    const gl = document.createElement("canvas").getContext("webgl2") || document.createElement("canvas").getContext("webgl");
    if (!gl) return "NO WEBGL";
    const d = gl.getExtension("WEBGL_debug_renderer_info");
    return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  });
  console.log(`GPU PATH: ${gpu}`);
  // the screen at the seed, stopwatch on
  await page.goto(`${URL_BASE}?seed=${seed}&perf=1`, { waitUntil: "networkidle0" });
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) if (k.startsWith("coldsnap-depot")) localStorage.removeItem(k);
    localStorage.removeItem("coldsnap-front-save");
    localStorage.setItem("coldsnap-wf-cards", JSON.stringify({ rev: 1, seen: ["*"] })); // the teaching cards stay down: a card up freezes the war's steps, as scripts/smoke.mjs silences them
    localStorage.setItem("coldsnap-screen", "menu");
  });
  await page.reload({ waitUntil: "networkidle0" });
  const button = mode === "war" ? '[data-menu="depot"]' : '[data-menu="devsandbox"]';
  await page.waitForSelector(button, { timeout: 20000 });
  await page.evaluate((b) => document.querySelector(b).click(), button);
  await page.waitForFunction(() => typeof window.__DEPOTPERF__ === "function" && typeof window.__DEPOTDAVY__ === "function", { timeout: 30000 });
  const mapSeed = await page.evaluate(() => window.__DEPOT__().bodies > 0 ? new URLSearchParams(location.search).get("seed") : null);
  if (String(mapSeed) !== String(seed)) throw new Error(`page seed ${mapSeed} against ${seed}`);
  if (mode === "war") await page.evaluate(() => { window.__DEPOTSTART__(); window.__DEPOTBELL__(); });
  // the bell deals the convoy's hand and its window pauses the war until LATER is pressed: the bench presses it whenever it stands
  const wait = async (ms) => { const end = Date.now() + ms; while (Date.now() < end) { await sleep(Math.min(500, end - Date.now())); if (mode === "war") await page.evaluate(() => { const b = document.querySelector("[data-manifest-later]"); if (b) b.click(); }); } };
  let tx = arg("tx", null), tz = arg("tz", null);
  if (tx == null || tz == null) {
    const t = await page.evaluate(() => window.__DEPOTTOWN__().reduce((b, x) => (!b || x.nx * x.nz * x.ny > b.nx * b.nz * b.ny ? x : b), null));
    tx = t.x; tz = t.z;
  }
  tx = +tx; tz = +tz;
  console.log(`target ${tx.toFixed(2)}, ${tz.toFixed(2)}`);
  await page.evaluate((x, z) => window.__DEPOTFOCUS__(x, z), tx, tz);
  await wait((settleS - beforeS) * 1000);
  // the quiet window: the last seconds of the settle, read from the ring
  await page.evaluate(() => window.__DEPOTPERF__.reset());
  await wait(beforeS * 1000);
  const beforeDump = await page.evaluate(() => window.__DEPOTPERF__());
  const before = summarize(beforeDump.frames);
  const state = await page.evaluate(() => window.__DEPOT__());
  // the burst window
  await page.tracing.start({ categories: ["disabled-by-default-v8.gc", "v8", "devtools.timeline"] });
  await page.evaluate(() => window.__DEPOTPERF__.reset());
  const tFire = await page.evaluate((x, z) => { window.__DEPOTDAVY__(x, z); return performance.now(); }, tx, tz);
  await wait(afterS * 1000);
  const dump = await page.evaluate(() => window.__DEPOTPERF__());
  const trace = JSON.parse(Buffer.from(await page.tracing.stop()).toString("utf8"));
  const events = Array.isArray(trace) ? trace : trace.traceEvents || [];
  const gcEv = events.filter((e) => e.ph === "X" && typeof e.dur === "number" && (e.name === "MinorGC" || e.name === "MajorGC")); // the main thread's own pauses; the V8.GC_* rows beneath them would count the same time twice
  const gc = { n: gcEv.length, ms: +(gcEv.reduce((s, e) => s + e.dur, 0) / 1000).toFixed(1), maxMs: +(gcEv.reduce((m, e) => Math.max(m, e.dur), 0) / 1000).toFixed(1) };
  if (errs.length) throw new Error("page error: " + errs[0]);
  const fr = dump.frames;
  if (!fr.length) throw new Error("no frames captured");
  const summary = { ...summarize(fr), gc, bodies: dump.bodies, chunksDrawn: dump.chunksDrawn, chunksTotal: dump.chunksTotal };
  if (!summary.booms) throw new Error("NO BURST landed in the window");
  const out = { tool: "diag-davy-browser", mk: MK, startedAt: new Date().toISOString(), seed, mode, label, tx, tz, gpu, settleS, beforeS, afterS, tFire, state: { bell: state.bell, bodies: state.bodies, t: +state.t.toFixed(2) }, before, summary, frames: fr, beforeFrames: beforeDump.frames };
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `browser-${label}-${mode}.json`);
  fs.writeFileSync(file, JSON.stringify(out));
  const s = summary, b = before;
  const line = `${out.startedAt} diag-davy-browser ${label} seed ${seed} mode ${mode} gpu ${/swiftshader|software|llvmpipe/i.test(gpu) ? "SOFTWARE" : "real"} before: rafHz ${b.rafHz} worldRate ${b.worldRate} stepsP50 ${b.stepsP50} framesAtSix ${b.framesAtSix}/${b.frames} simPerStep ${b.simPerStep} renderMean ${b.render.mean} awake ${b.meanAwake} | after: rafHz ${s.rafHz} drawHz ${s.drawHz} worldRate ${s.worldRate} stepsP50 ${s.stepsP50} framesAtSix ${s.framesAtSix}/${s.frames} frameMean ${s.frame.mean} frameP95 ${s.frame.p95} frameWorst ${s.frame.worst} over33 ${s.over33} simMean ${s.sim.mean} simPerStep ${s.simPerStep} renderMean ${s.render.mean} burstFrameMs ${s.burstFrameMs} burstRenderMs ${s.burstRenderMs} peakAwakeChunks ${s.peakAwakeChunks} peakContacts ${s.peakContacts} heapPeakMB ${s.heapPeakMB} gcN ${gc.n} gcMs ${gc.ms} gcMaxMs ${gc.maxMs} chunks ${s.chunksDrawn}/${s.chunksTotal} bodies ${state.bodies} bell ${state.bell}`;
  console.log(line);
  fs.appendFileSync(path.join(ROOT, ".superpowers", "experiments.log"), line + "\n");
  console.log(`wrote ${file}`);
} catch (e) {
  console.error("RUN FAILED " + label + ": " + ((e && e.message) || e));
  code = 1;
} finally {
  await browser.close();
}
process.exit(code);
```

### Step 3 — the page, replaced whole

Replace the whole content of `docs/superpowers/perf/davy/page.mjs` with exactly this:

```js
// THE PAGE (0.6.8, redrawn 0.6.9): reads every bench run beside it, checks
// that the runs of one world tell the same story in every non-timing field,
// and writes index.html with every chart drawn into the file as a fixed
// picture — no script, so any viewer shows it: the step cost through the
// burst, the awake stones and the contacts, each window's function shares,
// the watched functions by source line in the quiet window, the second
// burst, the browser frames before and after the burst, and the rows.
// Exits 1 on any identity mismatch.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const files = fs.readdirSync(HERE).filter((f) => f.endsWith(".json")).sort();
const runs = [], browser = [];
for (const f of files) {
  const j = JSON.parse(fs.readFileSync(path.join(HERE, f), "utf8"));
  if (j.tool === "diag-davy") runs.push({ file: f, ...j }); else if (j.tool === "diag-davy-browser") browser.push({ file: f, ...j });
}
if (!runs.length) { console.error("no bench runs beside the page"); process.exit(1); }
const groups = new Map();
for (const r of runs) { const k = `${r.seed}/${r.mode}/${r.target}${r.hot ? "/hot" : ""}`; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); }
const SAME = [["stones", (r) => r.stonesNear], ["burstStep", (r) => r.burstStep], ["worldHash", (r) => r.identity.worldHash], ["runHash", (r) => r.identity.runHash], ["draws", (r) => r.identity.draws], ["breaks", (r) => r.identity.breaksTotal], ["lost", (r) => r.identity.lostTotal], ["peakAwake", (r) => r.after.peakAwake], ["peakContacts", (r) => r.after.peakContacts], ["rows", (r) => r.rows.length], ["burst2Step", (r) => (r.identity.burst2Step == null ? -1 : r.identity.burst2Step)]];
const mismatches = [];
for (const [k, g] of groups) for (const r of g.slice(1)) for (const [name, get] of SAME) if (get(r) !== get(g[0])) mismatches.push(`${k}: ${r.label} ${name} ${get(r)} against ${g[0].label} ${get(g[0])}`);
const ok = mismatches.length === 0;
const verdict = ok ? `same world in every copy — ${runs.length} runs over ${groups.size} world${groups.size === 1 ? "" : "s"}` : `WORLDS DIFFER — ${mismatches.length} mismatch${mismatches.length === 1 ? "" : "es"}`;
console.log("identity: " + verdict);
for (const m of mismatches) console.log("  " + m);

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const COLORS = ["#5b8def", "#e0a052", "#4caf50", "#e05252", "#b07ce0", "#52c7e0", "#e052b0", "#9aa3ad", "#f0e060", "#60f0c0"];
const nz = (v) => (v == null ? "—" : v);
// a line chart as a fixed SVG picture
function chart(series, opts) {
  const W = 1000, H = 300, L = 54, R = 12, T = 12, B = 30;
  const xs = series.flatMap((s) => s.pts.map((p) => p[0])), ys = series.flatMap((s) => s.pts.map((p) => p[1]));
  if (!xs.length) return "";
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const log = !!opts.log;
  const yv = (v) => (log ? Math.log10(Math.max(0.01, v)) : v);
  const pos = ys.filter((v) => v > 0);
  let y0 = log ? Math.floor(yv(pos.length ? Math.min(...pos) : 1)) : 0, y1 = Math.ceil(yv(Math.max(...ys, 1)));
  if (y1 <= y0) y1 = y0 + 1;
  const sx = (x) => L + ((x - x0) / Math.max(1e-9, x1 - x0)) * (W - L - R);
  const sy = (y) => T + (1 - (yv(y) - y0) / (y1 - y0)) * (H - T - B);
  let g = "";
  const ticks = log ? Array.from({ length: y1 - y0 + 1 }, (_, i) => Math.pow(10, y0 + i)) : Array.from({ length: 6 }, (_, i) => y0 + ((y1 - y0) * i) / 5);
  for (const t of ticks) g += `<line x1="${L}" x2="${W - R}" y1="${sy(t).toFixed(1)}" y2="${sy(t).toFixed(1)}" stroke="#2a2f38"/><text x="${L - 6}" y="${(sy(t) + 4).toFixed(1)}" fill="#9aa3ad" font-size="11" text-anchor="end">${log ? t : Math.round(t)}</text>`;
  for (const xt of [x0, (x0 + x1) / 2, x1]) g += `<text x="${sx(xt).toFixed(1)}" y="${H - 8}" fill="#9aa3ad" font-size="11" text-anchor="middle">${Math.round(xt * 10) / 10}</text>`;
  if (opts.zero && x0 <= 0 && x1 >= 0) g += `<line x1="${sx(0).toFixed(1)}" x2="${sx(0).toFixed(1)}" y1="${T}" y2="${H - B}" stroke="#e05252" stroke-dasharray="4 3"/>`;
  series.forEach((s, i) => { g += `<path d="${s.pts.map((p, k) => (k ? "L" : "M") + sx(p[0]).toFixed(1) + " " + sy(p[1]).toFixed(1)).join(" ")}" fill="none" stroke="${COLORS[i % COLORS.length]}" stroke-width="${s.width || 1.4}"${s.dash ? ' stroke-dasharray="5 3"' : ""} opacity="0.9"/>`; });
  g += `<text x="${L + 6}" y="${T + 12}" fill="#9aa3ad" font-size="12">${esc(opts.title)} — ${esc(opts.unit)}</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.title)}">${g}</svg><div class="legend">${series.map((s, i) => `<span><i style="background:${COLORS[i % COLORS.length]}"></i>${esc(s.name)}</span>`).join("")}</div>`;
}
function bars(rows, title, unit) {
  if (!rows || !rows.length) return "";
  const max = Math.max(1, ...rows.map((r) => r.v));
  return `<div class="card"><b>${esc(title)}</b><div class="bars">${rows.map((r) => `<div class="bar"><span>${r.v.toFixed(1)}${unit}</span><b style="width:${(100 * r.v / max).toFixed(0)}px"></b><em title="${esc(r.name)}">${esc(r.name)}</em></div>`).join("")}</div></div>`;
}
const pctRows = (top) => (top || []).slice(0, 12).map((r) => ({ name: r.name, v: r.pct }));
function lineTable(lines, title) {
  if (!lines) return "";
  const fns = ["stepWorld", "stepDepot", "stepStatus", "collectContacts", "stepSleep", "weldBreakPass", "tickWar", "explode"].filter((f) => lines[f] && lines[f].length);
  if (!fns.length) return "";
  return `<div class="card"><b>${esc(title)}</b><div class="wrap"><table><tr><th>function</th><th colspan="6">source line : share of the function's own ticks</th></tr>${fns.map((f) => `<tr><td>${f}</td>${lines[f].slice(0, 6).map((l) => `<td>${l.line} : ${l.pct}%</td>`).join("")}</tr>`).join("")}</table></div></div>`;
}

let out = "";
for (const [k, g] of groups) {
  const f = g[0];
  out += `<h2>${esc(k)} — ${f.stonesNear} stones within 25 m${f.wallCourses ? ", " + f.wallCourses + " wall courses" : ""}${f.secondS ? ", a second burst " + f.secondS + " s later" : ""}</h2>`;
  out += chart(g.map((r) => ({ name: r.label, pts: r.rows.slice(Math.max(0, r.burstStep - 60)).map((x) => [x.i - r.burstStep, x.ms]) })), { title: "one step's cost, from sixty steps before the burst (step 0)", unit: "milliseconds, log scale", log: true, zero: true });
  out += chart(g.flatMap((r) => [{ name: r.label + " awake chunks", pts: r.rows.slice(Math.max(0, r.burstStep - 60)).map((x) => [x.i - r.burstStep, x.chunks]) }, { name: r.label + " contacts", pts: r.rows.slice(Math.max(0, r.burstStep - 60)).map((x) => [x.i - r.burstStep, x.contacts]), dash: true }]), { title: "awake chunks (solid) and contacts (dashed)", unit: "count", zero: true });
  const hasQ = g.some((r) => r.quiet), has2 = g.some((r) => r.second);
  out += `<div class="wrap"><table><tr><th>run</th>${hasQ ? "<th>quiet step ms</th>" : ""}<th>burst ms</th><th>next step ms</th><th>walls lost</th><th>shadow %</th><th>explode %</th><th>road map %</th><th>after mean ms</th><th>after p95</th><th>after worst</th><th>peak awake</th><th>peak contacts</th><th>heavy steps</th><th>over 7 ms</th><th>solve %</th><th>pairs %</th><th>welds %</th><th>sweeper %</th>${has2 ? "<th>2nd burst ms</th><th>2nd next ms</th><th>2nd shadow %</th><th>2nd explode %</th><th>2nd road map %</th>" : ""}<th>hash</th><th>draws</th></tr>`;
  for (const r of g) out += `<tr><td>${esc(r.label)}</td>${hasQ ? `<td>${r.quiet ? r.quiet.meanMs : "—"}</td>` : ""}<td>${r.burst.ms}</td><td>${nz(r.burst.nextMs)}</td><td>${r.burst.lost}</td><td>${r.shares.shadow}</td><td>${r.shares.explode}</td><td>${r.shares.flow}</td><td>${r.after.meanMs}</td><td>${r.after.p95Ms}</td><td>${r.after.worstMs}</td><td>${r.after.peakAwake}</td><td>${r.after.peakContacts}</td><td>${r.after.heavySteps}</td><td>${r.after.over7}</td><td>${r.shares.solve}</td><td>${r.shares.pairs}</td><td>${r.shares.welds}</td><td>${r.shares.sweeper}</td>${has2 ? (r.second ? `<td>${r.second.ms}</td><td>${r.second.nextMs}</td><td>${r.second.shadow}</td><td>${r.second.explode}</td><td>${r.second.flow}</td>` : "<td>—</td><td>—</td><td>—</td><td>—</td><td>—</td>") : ""}<td>${r.identity.worldHash}/${r.identity.runHash}</td><td>${r.identity.draws}</td></tr>`;
  out += "</table></div>";
  out += `<div class="grid">${f.quiet ? bars(pctRows(f.quiet.profile.top), f.label + " — the quiet window, by function", "%") : ""}${bars(pctRows(f.burst.profile.top), f.label + " — the burst window, by function", "%")}${bars(pctRows(f.after.profile.top), f.label + " — the after window, by function", "%")}${f.second ? bars(pctRows(f.second.profile.top), f.label + " — the second burst, by function", "%") : ""}${f.allocTop ? bars(f.allocTop.slice(0, 10).map((a) => ({ name: a.name, v: a.mb })), f.label + " — bytes allocated in the after window, by function", " MB") : ""}</div>`;
  if (f.quiet) out += lineTable(f.quiet.profile.lines, f.label + " — the quiet window, the watched functions by source line");
  if (f.after && f.after.profile.lines) out += lineTable(f.after.profile.lines, f.label + " — the after window, the watched functions by source line");
}
if (browser.length) {
  out += `<h2>the browser on the Pi's display — ${esc(browser[0].gpu)}</h2>`;
  out += chart(browser.map((b) => ({ name: b.label + " " + (b.mode || "sandbox"), pts: b.frames.map((f) => [+((f.t - b.frames[0].t) / 1000).toFixed(2), f.frame]) })), { title: "one frame's cost through the burst", unit: "milliseconds, log scale, seconds along", log: true });
  out += chart(browser.flatMap((b) => [{ name: b.label + " " + (b.mode || "sandbox") + " steps per frame", pts: b.frames.map((f) => [+((f.t - b.frames[0].t) / 1000).toFixed(2), f.steps]) }, { name: b.label + " awake chunks ÷ 100", pts: b.frames.map((f) => [+((f.t - b.frames[0].t) / 1000).toFixed(2), f.chunks / 100]), dash: true }]), { title: "steps run per frame (solid) and awake chunks in hundreds (dashed)", unit: "count, seconds along" });
  const hasB = browser.some((b) => b.before);
  out += `<div class="wrap"><table><tr><th>run</th><th>mode</th>${hasB ? "<th>before: frames/s</th><th>world rate</th><th>steps p50</th><th>frames at six</th><th>sim per step</th><th>render mean</th><th>awake</th>" : ""}<th>after: frames/s</th><th>drawn/s</th><th>world rate</th><th>steps p50</th><th>frames at six</th><th>frame mean</th><th>frame p95</th><th>frame worst</th><th>over 33 ms</th><th>sim mean</th><th>render mean</th><th>burst frame</th><th>burst render</th><th>peak awake</th><th>peak contacts</th><th>heap peak MB</th><th>sweeper n</th><th>sweeper ms</th><th>sweeper max</th><th>chunks</th></tr>`;
  for (const b of browser) { const s = b.summary, q = b.before; out += `<tr><td>${esc(b.label)}</td><td>${esc(b.mode || "sandbox")}</td>${hasB ? (q ? `<td>${q.rafHz}</td><td>${q.worldRate}</td><td>${q.stepsP50}</td><td>${q.framesAtSix}/${q.frames}</td><td>${nz(q.simPerStep)}</td><td>${q.render.mean}</td><td>${nz(q.meanAwake)}</td>` : "<td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td>") : ""}<td>${s.rafHz}</td><td>${s.drawHz}</td><td>${s.worldRate}</td><td>${s.stepsP50}</td><td>${s.framesAtSix}/${s.frames}</td><td>${s.frame.mean}</td><td>${s.frame.p95}</td><td>${s.frame.worst}</td><td>${s.over33}</td><td>${s.sim.mean}</td><td>${s.render.mean}</td><td>${nz(s.burstFrameMs)}</td><td>${nz(s.burstRenderMs)}</td><td>${s.peakAwakeChunks}</td><td>${s.peakContacts}</td><td>${s.heapPeakMB}</td><td>${s.gc.n}</td><td>${s.gc.ms}</td><td>${s.gc.maxMs}</td><td>${s.chunksDrawn}/${s.chunksTotal}</td></tr>`; }
  out += "</table></div>";
}
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>The davy bench</title>
<style>
:root{--bg:#0f1115;--fg:#e6e6e6;--mute:#9aa3ad;--line:#2a2f38}
body{margin:0;padding:12px 16px 40px;background:var(--bg);color:var(--fg);font:14px/1.45 system-ui,sans-serif;max-width:1100px}
h1{font-size:20px;margin:6px 0 2px}h2{font-size:15px;margin:22px 0 6px;color:var(--mute);text-transform:uppercase;letter-spacing:1px}
.pill{display:inline-block;padding:3px 10px;border-radius:12px;font-weight:600;margin:6px 0}.ok{background:#1d3b22;color:#9be29f}.bad{background:#4a1d1d;color:#ffb3b3}
svg{width:100%;height:auto;display:block;background:#141822;border:1px solid var(--line);border-radius:6px;margin:6px 0}
.wrap{overflow:auto;max-width:100%}table{border-collapse:collapse;font-size:12px;white-space:nowrap}td,th{border-bottom:1px solid var(--line);padding:3px 8px;text-align:right}th{color:var(--mute);font-weight:600}td:first-child,th:first-child{text-align:left}
.legend span{display:inline-block;margin:0 10px 4px 0;font-size:12px;color:var(--mute)}.legend i{display:inline-block;width:14px;height:3px;vertical-align:middle;margin-right:5px}
.bars{display:grid;grid-template-columns:1fr;gap:3px;font-size:12px}.bar{display:flex;align-items:center;gap:8px;min-width:0}.bar b{display:inline-block;height:10px;background:#5b8def;border-radius:2px;flex:none}.bar span{color:var(--mute);min-width:56px;flex:none}.bar em{font-style:normal;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px}.card{border:1px solid var(--line);border-radius:6px;padding:8px 10px;background:#121620;min-width:0;margin:8px 0}
p.note{color:var(--mute);font-size:12px;margin:4px 0}
</style></head><body>
<h1>The davy bench</h1>
<p class="note">one atomic round onto a town building; the quiet seconds before it, the burst, and every step after it, measured on the Pi · built ${esc(new Date().toISOString())}</p>
<span class="pill ${ok ? "ok" : "bad"}" data-verdict>${ok ? "✓" : "✗"} ${esc(verdict)}</span>
${mismatches.length ? `<ul>${mismatches.map((m) => `<li>${esc(m)}</li>`).join("")}</ul>` : ""}
${out}
</body></html>
`;
fs.writeFileSync(path.join(HERE, "index.html"), html);
console.log(`wrote index.html — ${runs.length} bench runs, ${browser.length} browser runs, drawn as fixed pictures`);
process.exit(ok ? 0 : 1);
```

### Step 4 — the run list, replaced whole

Replace the whole content of `docs/superpowers/perf/davy/all.sh` with exactly this:

```bash
#!/bin/bash
# THE BENCH RUNS, SECOND SET (0.6.9): one drawn seed, printed first. Three
# sandbox runs on the town with a second burst fifteen seconds after the
# first, one on the wall-ringed town, three in the real war with the lists
# hot and its first assault afield; then two browser runs in the sandbox and
# two in the real war on the Pi's own display, each reading the quiet seconds
# before the burst; then the page and its check. A rerun passes the drawn
# seed back: bash all.sh <seed>.
set -e
ROOT=/home/batman/coldsnap
OUT=$ROOT/docs/superpowers/perf/davy
SEED=${1:-$(node -e 'console.log(Math.floor(Math.random()*1000000)+1)')}
echo "seed $SEED"
cd "$ROOT"
for K in 1 2 3; do node scripts/diag-davy.mjs --seed "$SEED" --mode sandbox --target town --second 15 --label q$K; done
node scripts/diag-davy.mjs --seed "$SEED" --mode sandbox --target walls --second 15 --label q1
for K in 1 2 3; do node scripts/diag-davy.mjs --seed "$SEED" --mode war --target town --hot --second 15 --label w$K; done
TX=$(node -e "console.log(require('$OUT/q1-sandbox-town.json').tx)")
TZ=$(node -e "console.log(require('$OUT/q1-sandbox-town.json').tz)")
npm run build
pkill -f "[v]ite preview" || true; sleep 1
( npm run preview -- --strictPort --port 4173 >/tmp/davy-preview.log 2>&1 & )
curl -sf --retry 30 --retry-delay 1 --retry-all-errors http://localhost:4173/coldsnap/ -o /dev/null
for K in 1 2; do DISPLAY=:0 node scripts/diag-davy-browser.mjs --seed "$SEED" --mode sandbox --tx "$TX" --tz "$TZ" --label q$K; done
for K in 1 2; do DISPLAY=:0 node scripts/diag-davy-browser.mjs --seed "$SEED" --mode war --tx "$TX" --tz "$TZ" --label w$K; done
pkill -f "[v]ite preview" || true
node "$OUT/page.mjs"
node "$OUT/check.mjs"
echo "ALL DONE seed $SEED"
```

### Step 5 — the parse checks

Run `node --check scripts/diag-davy.mjs`, `node --check scripts/diag-davy-browser.mjs`, `node --check docs/superpowers/perf/davy/page.mjs`, and `bash -n docs/superpowers/perf/davy/all.sh`. Each must print nothing.

### Step 6 — the mark

In `src/version.js`, replace `export const MK = "0.6.8";` with `export const MK = "0.6.9";`.

### Step 7 — the gates and the keystone

Run, in this order, and record each result line:

1. `node scripts/gate.mjs depot-lint` — `depot-lint PASS`.
2. `node scripts/gate.mjs depot-test` — ends `depot-test PASS`; 1714 PASS / 0 FAIL; the report states the numbers and the era's fixture seed.
3. `npm run build`, then `npm run preview &`, then `node scripts/gate.mjs smoke` — `BOOT-LOAD SMOKE: ALL PASS`, 27 PASS lines. Stop the preview server after.
4. `node src/depot/api.js gate 7 20` — exactly `seed 7  seconds 20 (2400 steps)  worldHash 1278094788  runHash 2033212782`. Any other number stops the task before the commit; report it.

### Step 8 — the landing of the bench

Commit exactly these files in one commit: `scripts/diag-davy.mjs`, `scripts/diag-davy-browser.mjs`, `docs/superpowers/perf/davy/page.mjs`, `docs/superpowers/perf/davy/all.sh`, `src/version.js`, and this plan file. Subject: `the quiet floor's bench, 0.6.9`. Push to `main`.

### Step 9 — the runs

Run `bash docs/superpowers/perf/davy/all.sh` from the repository root with the display attached (`DISPLAY=:0` is set inside for the browser runs). It prints the drawn seed first; record it. It runs, in order: three sandbox runs on the town with a second burst, one on the wall-ringed town with a second burst, three war runs with the lists hot and a second burst, the build, two browser runs in the sandbox, two in the real war, the page, the page check. Expect about twenty minutes on this machine. It stops on the first failure; a failure is reported with its output and the task stops there.

If a browser run reports `gpu SOFTWARE`, the browser numbers are not usable; report it and run the four browser runs again once with `DISPLAY=:0` confirmed (`xdpyinfo -display :0 | head -3` must print a screen).

Then read, from the eleven lines the runs appended to `.superpowers/experiments.log`, from the page, and from the records, the following, and put them in the report as plain numbers:

1. The identity verdict: `same world in every copy`, or every mismatch line.
2. The quiet step: `quietMs` for q1–q3 (sandbox) and w1–w3 (war, lists hot), and each run's `quietTop` four functions. From `q1-sandbox-town.json` and `w1-war-town.json`, the quiet window's top eight functions with their shares, and for stepWorld, stepDepot, stepStatus, collectContacts, weldBreakPass and tickWar the four hottest source lines with their shares (`quiet.profile.lines`).
3. The bang against the second bang, every run: `burstMs` against `burst2Ms`, `nextMs` against `next2Ms`, `shadow%` against `shadow2%`, `explode%` against `explode2%`, `flow%` against `flow2%`.
4. The after window as before: `afterMean`, `afterP95`, `afterWorst`, `peakAwake`, `heavySteps`, `solve%`, `pairs%`, `welds%`, `sweeper%`.
5. The war runs with the lists hot against T8's war runs (seed 134682 in the log, lines `war1`–`war3`): `quietMs` (T8 has none; say so), `burstMs`, `afterMean`.
6. The browser, each of the four runs: the `before:` fields (`rafHz`, `worldRate`, `stepsP50`, `framesAtSix`, `simPerStep`, `renderMean`, `awake`) and the `after:` fields (`rafHz`, `worldRate`, `framesAtSix`, `frameWorst`, `over33`, `burstFrameMs`, `burstRenderMs`, `gcMs`), and `gpu`.
7. The page check's line.

### Step 10 — the landing of the numbers

Commit exactly these files in one commit: every new `docs/superpowers/perf/davy/*.json` the runs wrote (the T8 records are already committed), and `docs/superpowers/perf/davy/index.html`. Subject: `the quiet floor measures, 0.6.9`. Push.

Then in `docs/superpowers/plans/2026-10-11-coldsnap-the-outbreak-phase.md`, after the T8 row add the row `| T9 | 0.6.9 | The quiet floor: the bench widened — the quiet window profiled by source line, the war with its lists hot, a second burst, the browser before the burst and in the real war, the page as fixed pictures — and the untouched game run through it again | LANDED — mark 0.6.9, keystone unchanged (seed 7, 20 s: 1278094788 / 2033212782), depot-test 1714, smoke 27/27, the runs at docs/superpowers/perf/davy/index.html |`. Commit that file alone with the subject `t9 lands in the phase document — 0.6.9, the quiet floor, 27/27`. Push.

### Step 11 — the keystone, confirmed on the pushed tree

Run `node src/depot/api.js gate 7 20` once more and record the line; it must still match Step 0.

## Acceptance

- Step 0, Step 7, and Step 11 print the identical keystone line.
- `depot-test` 1714 PASS / 0 FAIL on a rolled seed; `depot-lint` PASS; smoke 27/27.
- The page's verdict reads `same world in every copy`; the page check prints `PAGE CHECK OK`; `index.html` holds no `<script` tag.
- Eleven lines in `.superpowers/experiments.log` from this task's runs, one per run, each carrying the drawn seed.
- The live site, phone and desktop: nothing visible changes. The owner's eyes are the acceptance.

## Report

One line of outcome, then: the read-confirmation; every gate's result line; the three keystone lines; the depot-test totals and the era's fixture seed; the drawn bench seed; the seven numbered readings of Step 9 as plain numbers; the commit hashes; every deviation, nonconformity, and re-pin as its own labeled bullet. The page file `docs/superpowers/perf/davy/index.html` is named as the thing to open.
