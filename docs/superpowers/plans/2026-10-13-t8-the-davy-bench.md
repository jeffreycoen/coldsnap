# T8 — The davy bench (0.6.8)

One line. This task measures; it changes no physics. It builds the witness — a headless bench that boots a war on this machine, fires one atomic round onto a town building, and records every step after it with node's own profiler naming where the time went; the same burst from a browser hook on the Pi's own display with the stopwatch's new columns; a page that charts the runs — and then runs the untouched game through it: five copies of one world on the town, five on a wall-ringed town, three in the real war with waves afield, three in the browser. It ends with the measured anatomy of a big blast and the noise floor, from which the twins (the candidate changes, each run against this baseline on the same world) are cut in the next plan. Nothing in the engine or the renderer is touched, so the golden gate does not run and the keystone is unchanged.

Checked on a fresh copy at plan-writing time: every anchor hit exactly once; every new and changed file parses; `depot-lint` PASS; `depot-test` 1714 PASS / 0 FAIL (1708 + the six below); the keystone unchanged; smoke 27/27; the headless bench, the browser bench, the page, and the page check each ran once on short windows to prove they run (their numbers were not read).

Suggested model: Sonnet 5.5 — every line of code is in this plan; the runs are commands; the report is the numbers they print.

## Required reading, in this order

1. `CLAUDE.md`
2. This file, whole, before the first edit.
3. `src/depot/hooks.js` lines 1–20 and 53–71
4. `src/depot/DepotGame.jsx` lines 185–194, 796–830, 1136–1160, 1618–1633
5. `src/depot/api.js` lines 338–347 and 411–434
6. `scripts/diag-perf.mjs` lines 1–25 and 100–130
7. `docs/superpowers/perf/t93/all.sh` and `docs/superpowers/perf/t93/check.mjs`
8. `scripts/tests/53-the-fast-dead-and-the-sick-clock.mjs` lines 1–20

The report opens with a line confirming every file above was read.

## The seed law

Every bench run rolls its seed at startup and prints it first. No seed is written into any script. A rerun passes the drawn seed back on the command line. Every run appends one line to `.superpowers/experiments.log`. The run list below draws one seed and passes it to every run, so every copy builds the same world; the page refuses to build if any two runs of one world disagree in a non-timing field.

## Gates

Run only these, each through `node scripts/gate.mjs <name>`: `depot-lint`, `depot-test`, `smoke`. The smoke needs `npm run build` then `npm run preview &` first. `golden` does not run: `src/engine/core.js` and `src/graphics/renderer.js` are not touched.

The keystone: `node src/depot/api.js gate 7 20` prints `seed 7  seconds 20 (2400 steps)  worldHash 1278094788  runHash 2033212782` on the untouched tree. Step 0 confirms it; Step 9 confirms it again unchanged. Any other number stops the task.

No re-teach is licensed. Any failing test other than the six new asserts before Step 2 stops the task.

## Steps

### Step 0 — the keystone, before

Run `node src/depot/api.js gate 7 20`. The output must read exactly `seed 7  seconds 20 (2400 steps)  worldHash 1278094788  runHash 2033212782`. Record it.

### Step 1 — the failing asserts

Create `scripts/tests/54-the-davy-bench.mjs` with exactly this content:

```js
import { ok } from "./harness.mjs";
import { bootWar } from "../../src/depot/boot.js";
import { tickWar, defaultTickInput, runHash } from "../../src/depot/api.js";
import { worldHash } from "../../src/engine/core.js";
import { fireDavyDown, countAwake, activeWeldCount, ringOfWalls } from "../../src/depot/witness.js";

// ==== 0.6.8: the davy bench ================================================
// Seed rolled each run.
{
  console.log("\n[0.6.8: the davy bench]");
  const SEED = (Date.now() % 1000000) + 1;
  console.log("  fixture seed base", SEED);
  const STEP = 1 / 120;
  const bench = (walls) => {
    const war = bootWar({ seed: SEED, dev: true });
    war.run.started = true;
    const input = defaultTickInput();
    for (let i = 0; i < 120; i++) tickWar(war, STEP, input);
    const t = war.town.reduce((best, b) => (!b.ruined && (!best || b.stones.length > best.stones.length) ? b : best), null);
    const courses = walls ? ringOfWalls(war.world, war.field, t.x, t.z) : [];
    const before = countAwake(war.world);
    const y = fireDavyDown(war.world, war.field, t.x, t.z);
    let boomStep = -1, booms = 0, lost = 0;
    for (let i = 0; i < 120; i++) {
      const { events } = tickWar(war, STEP, input);
      for (const e of events) {
        if (e.type === "boom" && e.weapon === "davy") { booms++; if (boomStep < 0) boomStep = i; }
        if (e.type === "structureLost") lost++;
      }
    }
    return { war, t, y, courses, before, boomStep, booms, lost, after: countAwake(war.world), welds: activeWeldCount(war.world), wh: worldHash(war.world), rh: runHash(war.run) };
  };
  const a = bench(false), b = bench(false), c = bench(true);
  ok("(a) the sandbox boots with a town to burst", a.t != null && a.t.stones.length > 0, a.t ? String(a.t.stones.length) : "no town");
  ok("(b) the round is fired from above the roof", a.y > a.war.field.heightAt(a.t.x, a.t.z) + 1, a.y.toFixed(2));
  ok("(c) one davy burst lands within ten steps", a.booms === 1 && a.boomStep >= 0 && a.boomStep < 10, `${a.booms} at step ${a.boomStep}`);
  ok("(d) the burst wakes stones", a.after.chunks > a.before.chunks && a.after.awake >= a.after.chunks, `${a.before.chunks} -> ${a.after.chunks}`);
  ok("(e) two benches on one seed agree to the bit", a.wh === b.wh && a.rh === b.rh && a.boomStep === b.boomStep && a.after.chunks === b.after.chunks, `${a.wh}/${a.rh} vs ${b.wh}/${b.rh}`);
  ok("(f) the ring of walls stands and falls", c.courses.length === 48 && c.lost > 0, `${c.courses.length} courses, ${c.lost} lost`);
}
```

In `scripts/depot-test.mjs`, replace `await import("./tests/53-the-fast-dead-and-the-sick-clock.mjs");` with `await import("./tests/53-the-fast-dead-and-the-sick-clock.mjs");\nawait import("./tests/54-the-davy-bench.mjs");` (two lines; the second new).

Run `node scripts/gate.mjs depot-test`. The new era fails on its import (`witness.js` does not exist yet) — the runner stops at that import; record the output. Any failure in eras 1–53 before the stop stops the task.

### Step 2 — the witness module

Create `src/depot/witness.js` with exactly this content:

```js
// COLDSNAP DEPOT — witness.js: the davy bench (0.6.8). Four measuring
// helpers the stopwatch, the debug hooks, the test, and the headless bench
// share. None of them draws from the rng; the burst itself runs the real
// path (fireProjectile -> stepProjectiles -> explode) and draws exactly what
// the enemy's own atomic round draws.
import { fireProjectile } from "../engine/core.js";
import { DAVY_FIRE } from "./specs.js";
import { spawnWallCourses } from "./state.js";

// fireDavyDown(world, field, x, z): one atomic round, fired straight down
// from one meter above the highest living body within two meters of the
// point (or above the ground when nothing stands there), with the spec
// shooterFire builds for the enemy's atomic crew. Returns the muzzle height.
export function fireDavyDown(world, field, x, z) {
  let top = field.heightAt(x, z);
  for (const b of world.bodies) {
    if (!b.alive) continue;
    const dx = b.pos.x - x, dz = b.pos.z - z;
    if (dx * dx + dz * dz > 4) continue;
    const t = b.pos.y + b.hy; // the top face of a stone or slab at rest; a wide slab's long side would put the muzzle meters too high
    if (t > top) top = t;
  }
  const y = top + 1;
  fireProjectile(world, { x, y, z }, { x: 0, y: -1, z: 0 }, DAVY_FIRE.projSpeed, {
    kind: DAVY_FIRE.kind, r: DAVY_FIRE.blastR, kv: DAVY_FIRE.kv, dmg: DAVY_FIRE.dmg, crater: DAVY_FIRE.crater,
    weapon: DAVY_FIRE.weapon, noImpact: true, attacker: "enemy", windF: DAVY_FIRE.windF, hitStruct: true,
  });
  return y;
}

// countAwake(world): the bodies a step pays for — every body with mass that
// is not asleep — and the chunks among them.
export function countAwake(world) {
  let awake = 0, chunks = 0;
  for (const b of world.bodies) {
    if (b.invM === 0 || b.sleeping) continue;
    awake++;
    if (b.kind === "chunk") chunks++;
  }
  return { awake, chunks };
}

// activeWeldCount(world): the welds the solver sweeps — unbroken, not both
// ends asleep — read after the step.
export function activeWeldCount(world) {
  let n = 0;
  for (const w of world.welds) if (!w.broken && !(w.a.sleeping && w.b.sleeping)) n++;
  return n;
}

// ringOfWalls(world, field, x, z): sixteen player wall stacks (three courses
// each) on a ten-meter ring around the point, orientation alternating — the
// walls the atomic round kills in one tick, so the bench pays the road-map
// recompute the war pays when walls die. Returns the 48 courses.
export function ringOfWalls(world, field, x, z) {
  const out = [];
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    const wx = x + Math.cos(a) * 10, wz = z + Math.sin(a) * 10;
    out.push(...spawnWallCourses(world, wx, field.heightAt(wx, wz), wz, k % 2, 1));
  }
  return out;
}
```

### Step 3 — the browser hook

In `src/depot/hooks.js`, replace `import { endCardReady, pendingArmed, spawnSquadMembers, ASSAULT_TIMEOUT } from "./state.js";` with `import { endCardReady, pendingArmed, spawnSquadMembers, ASSAULT_TIMEOUT } from "./state.js";\nimport { fireDavyDown } from "./witness.js";` (two lines; the second new).

In the same file, replace `  window.__DEPOTTHIN__ = () => {` with `  window.__DEPOTDAVY__ = (tx, tz) => fireDavyDown(world, field, tx, tz); // 0.6.8: the davy bench — one atomic round, straight down onto the point\n  window.__DEPOTTHIN__ = () => {` (two lines; the first new).

### Step 4 — the stopwatch's new columns and the seeded sandbox

In `src/depot/DepotGame.jsx`, make these five replacements, each anchor exactly once.

Replace `import { installDepotHooks } from "./hooks.js";` with `import { installDepotHooks } from "./hooks.js";\nimport { countAwake } from "./witness.js";` (two lines; the second new).

Replace `        : dev ? Math.floor(Date.now() % 1000000)` with `        : dev && !Number.isFinite(urlSeed) ? Math.floor(Date.now() % 1000000) // 0.6.8: the sandbox honours ?seed= so a measured bench can be rebuilt`.

Replace

```js
      let pT = null, pSimA = null, pRenA = null, pFrmA = null, pDrewA = null;
```

with

```js
      let pT = null, pSimA = null, pRenA = null, pFrmA = null, pDrewA = null;
      let pStepsA = null, pAwakeA = null, pChunkA = null, pContA = null, pBoomA = null, pHeapA = null; // 0.6.8: the witness — steps run, awake bodies, awake chunks, contacts, bursts, heap bytes per frame
```

Replace

```js
        pDrewA = new Uint8Array(PCAP);
```

with

```js
        pDrewA = new Uint8Array(PCAP);
        pStepsA = new Uint8Array(PCAP); pAwakeA = new Uint32Array(PCAP); pChunkA = new Uint32Array(PCAP); pContA = new Uint32Array(PCAP); pBoomA = new Uint8Array(PCAP); pHeapA = new Float64Array(PCAP);
```

Replace

```js
            out.push({ t: pT[j], sim: pSimA[j], render: pRenA[j], frame: pFrmA[j], drew: !!pDrewA[j] });
```

with

```js
            out.push({ t: pT[j], sim: pSimA[j], render: pRenA[j], frame: pFrmA[j], drew: !!pDrewA[j], steps: pStepsA[j], awake: pAwakeA[j], chunks: pChunkA[j], contacts: pContA[j], booms: pBoomA[j], heap: pHeapA[j] });
```

Replace

```js
            pFrmA[pI] = pNow - pFrame0; pDrewA[pI] = pDrew;
```

with

```js
            pFrmA[pI] = pNow - pFrame0; pDrewA[pI] = pDrew;
            { const aw = countAwake(world); let booms = 0; for (const e of frameEvents) if (e.type === "boom") booms++; pStepsA[pI] = Math.min(guard, 6); pAwakeA[pI] = aw.awake; pChunkA[pI] = aw.chunks; pContA[pI] = world.contacts.length; pBoomA[pI] = booms; pHeapA[pI] = performance.memory ? performance.memory.usedJSHeapSize : 0; } // 0.6.8: the witness
```

`guard` and `frameEvents` are the frame loop's own (lines 1144 and 1146), in scope at the ring write; `guard` counts the steps run this frame, capped at six.

Run `node scripts/gate.mjs depot-test`. Exactly none fail: `depot-test PASS`, 1714 PASS / 0 FAIL. Record the result and the era's fixture seed.

### Step 5 — the headless bench

Create `scripts/diag-davy.mjs` with exactly this content:

```js
// diag-davy.mjs — MEASURING TOOL, not a test (the diag- prefix; never in the
// deploy pipeline). THE DAVY BENCH (0.6.8): boot one war on this machine,
// let it settle, fire one atomic round straight down onto a target, and
// record every step after it — the step's wall time, the awake bodies and
// chunks, the contacts, the live welds, the sweep tier, the bursts and weld
// breaks, the heap — with node's own sampling profiler over the burst window
// and the after window, so each function's share of the time is named
// without a probe in the engine.
//
//   node scripts/diag-davy.mjs [--seed N] [--mode sandbox|war] [--target town|walls|depot]
//        [--settle S] [--after S] [--label NAME] [--out DIR] [--alloc]
//
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
const label = arg("label", "base");
const outDir = arg("out", path.join(ROOT, "docs/superpowers/perf/davy"));
const alloc = process.argv.includes("--alloc");
const STEP = 1 / 120;
console.log(`diag-davy ${MK} seed ${seed} mode ${mode} target ${target} settle ${settleS}s after ${afterS}s label ${label}${alloc ? " alloc" : ""}`);

// ---- the profiler: a window is started and stopped around a run of steps;
// self time is summed per function; the bench's own helpers are left out.
const session = new Session();
session.connect();
const post = (m, p) => new Promise((res, rej) => session.post(m, p || {}, (e, r) => (e ? rej(e) : res(r))));
await post("Profiler.enable");
await post("Profiler.setSamplingInterval", { interval: 100 });
const OWN = /@(diag-davy\.mjs|witness\.js|node:inspector)$/; // the bench's own helpers and the profiler's own start and stop are left out of the shares
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
  return { totalMs: +(total / 1000).toFixed(2), rows };
}
const share = (p, re) => +p.rows.filter((r) => re.test(r.name)).reduce((s, r) => s + r.pct, 0).toFixed(1);
function allocTop(head) {
  const self = new Map();
  const walk = (n) => { const name = (n.callFrame.functionName || "(anonymous)") + "@" + path.basename(n.callFrame.url || ""); self.set(name, (self.get(name) || 0) + n.selfSize); for (const c of n.children || []) walk(c); };
  walk(head);
  return [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([name, bytes]) => ({ name, mb: +(bytes / 1048576).toFixed(2) }));
}

// ---- the world
const war = bootWar({ seed, dev: mode === "sandbox" });
war.run.started = true;
if (mode === "war") war.run.bellAt = war.world.t + 1; // the first assault now, so the waves are afield by the burst
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
const settleN = Math.round(settleS * 120), afterN = Math.round(afterS * 120);
const rows = [];
let burstStep = -1;
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
};
for (let i = 0; i < settleN; i++) step(i);
const last = rows[rows.length - 1];
console.log(`settled ${settleS}s in ${(rows.reduce((s, r) => s + r.ms, 0) / 1000).toFixed(1)}s wall — awake ${last.awake}, chunks awake ${last.chunks}, bodies ${last.bodies}, rounds ${last.rounds}`);
// the burst window: fire, then step until the boom lands (ten steps at most)
const muzzleY = fireDavyDown(world, war.field, tx, tz);
await post("Profiler.start");
let i = settleN;
for (let k = 0; k < 10 && burstStep < 0; k++, i++) step(i);
const burstProfile = summarize((await post("Profiler.stop")).profile);
if (burstStep < 0) { console.error("no burst landed within ten steps"); process.exit(1); }
// the after window
if (alloc) { await post("HeapProfiler.enable"); await post("HeapProfiler.startSampling", { samplingInterval: 8192 }); }
await post("Profiler.start");
const afterEnd = burstStep + 1 + afterN;
for (; i < afterEnd; i++) step(i);
const afterProfile = summarize((await post("Profiler.stop")).profile);
const allocRows = alloc ? allocTop((await post("HeapProfiler.stopSampling")).profile.head) : null;
session.disconnect();

// ---- the numbers
const burstRow = rows[burstStep];
const after = rows.slice(burstStep + 1, afterEnd);
const mean = (a) => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);
const sorted = after.map((r) => r.ms).sort((a, b) => a - b);
const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] || 0;
const peakAwake = Math.max(...after.map((r) => r.chunks));
const quiet = after.findIndex((r) => r.chunks < Math.max(20, peakAwake * 0.1));
const heavySteps = quiet < 0 ? after.length : quiet;
const over7 = after.filter((r) => r.ms > 7).length;
const burstWindow = rows.slice(settleN, burstStep + 1);
const out = {
  tool: "diag-davy", mk: MK, node: process.version, startedAt: new Date().toISOString(),
  seed, mode, target, targetName: tname, tx: +tx.toFixed(2), tz: +tz.toFixed(2), stonesNear, wallCourses: walls.length, settleS, afterS, label, muzzleY: +muzzleY.toFixed(2),
  bodies0: rows[0].bodies, welds0: world.welds.length, burstStep, fireStep: settleN,
  burst: { ms: burstRow.ms, windowMs: +burstWindow.reduce((s, r) => s + r.ms, 0).toFixed(3), breaks: burstRow.breaks, lost: burstWindow.reduce((s, r) => s + r.lost, 0) + (after[0] ? after[0].lost : 0), profile: { totalMs: burstProfile.totalMs, top: burstProfile.rows.slice(0, 40) } },
  after: { meanMs: +mean(after.map((r) => r.ms)).toFixed(3), p95Ms: +p95.toFixed(3), worstMs: +Math.max(...after.map((r) => r.ms)).toFixed(3), sumMs: +after.reduce((s, r) => s + r.ms, 0).toFixed(1), peakAwake, peakContacts: Math.max(...after.map((r) => r.contacts)), heavySteps, over7, profile: { totalMs: afterProfile.totalMs, top: afterProfile.rows.slice(0, 40) } },
  shares: {
    shadow: share(burstProfile, /^(occOf|segBoxHit)@/), explode: share(burstProfile, /^explode@/), flow: share(burstProfile, /^computeFlowField@/), burstSweeper: share(burstProfile, /garbage collector/),
    solve: share(afterProfile, /^(solveContacts|relVelAt|applyImpulse|prepContacts)@/), pairs: share(afterProfile, /^(collectContacts|satBoxBox|unfileBody)@/), welds: share(afterProfile, /^(solveWelds|weldBreakPass|weldStressDecay)@/), sweeper: share(afterProfile, /garbage collector/), rest: share(afterProfile, /^(stepStatus|stepSleep|classifyImpacts|stepProjectiles|segBoxHit)@/),
  },
  identity: { worldHash: worldHash(world), runHash: runHash(war.run), draws, breaksTotal: rows.reduce((s, r) => s + r.breaks, 0), lostTotal: rows.reduce((s, r) => s + r.lost, 0), bodiesEnd: world.bodies.length },
  allocTop: allocRows, rows,
};
fs.mkdirSync(outDir, { recursive: true });
const file = path.join(outDir, `${label}-${mode}-${target}.json`);
fs.writeFileSync(file, JSON.stringify(out));
const S = out.shares;
const line = `${out.startedAt} diag-davy ${label} seed ${seed} mode ${mode} target ${target} stones ${stonesNear} burstMs ${burstRow.ms} shadow% ${S.shadow} explode% ${S.explode} flow% ${S.flow} lost ${out.burst.lost} afterMean ${out.after.meanMs} afterP95 ${out.after.p95Ms} afterWorst ${out.after.worstMs} peakAwake ${peakAwake} peakContacts ${out.after.peakContacts} heavySteps ${heavySteps} over7 ${over7} solve% ${S.solve} pairs% ${S.pairs} welds% ${S.welds} sweeper% ${S.sweeper} hash ${out.identity.worldHash}/${out.identity.runHash} draws ${draws}` + (allocRows ? ` alloc ${allocRows.slice(0, 3).map((r) => r.name + ":" + r.mb + "MB").join(",")}` : "");
console.log(line);
console.log("burst window, top eight:"); for (const r of burstProfile.rows.slice(0, 8)) console.log(`  ${r.pct.toFixed(1).padStart(5)}%  ${r.ms.toFixed(1).padStart(8)} ms  ${r.name}`);
console.log("after window, top eight:"); for (const r of afterProfile.rows.slice(0, 8)) console.log(`  ${r.pct.toFixed(1).padStart(5)}%  ${r.ms.toFixed(1).padStart(8)} ms  ${r.name}`);
fs.appendFileSync(path.join(ROOT, ".superpowers", "experiments.log"), line + "\n");
console.log(`wrote ${file}`);
```

Run `node --check scripts/diag-davy.mjs`. It must print nothing.

### Step 6 — the browser bench

Create `scripts/diag-davy-browser.mjs` with exactly this content:

```js
// diag-davy-browser.mjs — MEASURING TOOL, not a test. THE DAVY BENCH in the
// real browser on this machine's own display (0.6.8): the sandbox at a
// given seed with the stopwatch on, the camera on the target, one atomic
// round through the __DEPOTDAVY__ hook, and the stopwatch's ring read back
// — frame, sim, render, steps run, awake bodies, awake chunks, contacts,
// bursts, heap — plus the browser's own trace for the memory sweeper.
//
//   npm run build && npm run preview &
//   DISPLAY=:0 node scripts/diag-davy-browser.mjs --seed N [--tx X --tz Z] [--settle S] [--after S] [--label NAME] [--out DIR]
//
// The seed is rolled and printed first when none is given; --tx/--tz name
// the target (the headless bench prints them); without them the largest
// town building by its cell count is the target.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import { MK } from "../src/version.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const arg = (name, dflt) => { const i = process.argv.indexOf("--" + name); return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : dflt; };
const seed = arg("seed", null) != null ? parseInt(arg("seed"), 10) : Math.floor(Math.random() * 1000000) + 1;
const settleS = +arg("settle", 5), afterS = +arg("after", 10);
const label = arg("label", "base");
const outDir = arg("out", path.join(ROOT, "docs/superpowers/perf/davy"));
const URL_BASE = process.env.PERF_URL || "http://localhost:4173/coldsnap/";
const CHROME = process.env.CHROME_BIN || "/usr/bin/chromium";
const STEP = 1 / 120;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
console.log(`diag-davy-browser ${MK} seed ${seed} settle ${settleS}s after ${afterS}s label ${label} display ${process.env.DISPLAY || "(unset)"}`);

const stats = (xs) => { if (!xs.length) return { n: 0, mean: 0, p95: 0, worst: 0 }; const s = [...xs].sort((a, b) => a - b); return { n: xs.length, mean: +(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2), p95: +s[Math.min(s.length - 1, Math.floor(s.length * 0.95))].toFixed(2), worst: +s[s.length - 1].toFixed(2) }; };

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
  // the sandbox at the seed, stopwatch on
  await page.goto(`${URL_BASE}?seed=${seed}&perf=1`, { waitUntil: "networkidle0" });
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) if (k.startsWith("coldsnap-depot")) localStorage.removeItem(k);
    localStorage.setItem("coldsnap-screen", "menu");
  });
  await page.reload({ waitUntil: "networkidle0" });
  await page.waitForSelector('[data-menu="devsandbox"]', { timeout: 20000 });
  await page.evaluate(() => document.querySelector('[data-menu="devsandbox"]').click());
  await page.waitForFunction(() => typeof window.__DEPOTPERF__ === "function" && typeof window.__DEPOTDAVY__ === "function", { timeout: 30000 });
  const mapSeed = await page.evaluate(() => window.__DEPOT__().bodies > 0 ? new URLSearchParams(location.search).get("seed") : null);
  if (String(mapSeed) !== String(seed)) throw new Error(`page seed ${mapSeed} against ${seed}`);
  let tx = arg("tx", null), tz = arg("tz", null);
  if (tx == null || tz == null) {
    const t = await page.evaluate(() => window.__DEPOTTOWN__().reduce((b, x) => (!b || x.nx * x.nz * x.ny > b.nx * b.nz * b.ny ? x : b), null));
    tx = t.x; tz = t.z;
  }
  tx = +tx; tz = +tz;
  console.log(`target ${tx.toFixed(2)}, ${tz.toFixed(2)}`);
  await page.evaluate((x, z) => window.__DEPOTFOCUS__(x, z), tx, tz);
  await sleep(settleS * 1000);
  await page.tracing.start({ categories: ["disabled-by-default-v8.gc", "v8", "devtools.timeline"] });
  await page.evaluate(() => window.__DEPOTPERF__.reset());
  const tFire = await page.evaluate((x, z) => { window.__DEPOTDAVY__(x, z); return performance.now(); }, tx, tz);
  await sleep(afterS * 1000);
  const dump = await page.evaluate(() => window.__DEPOTPERF__());
  const trace = JSON.parse(Buffer.from(await page.tracing.stop()).toString("utf8"));
  const events = Array.isArray(trace) ? trace : trace.traceEvents || [];
  const gcEv = events.filter((e) => e.ph === "X" && typeof e.dur === "number" && (e.name === "MinorGC" || e.name === "MajorGC")); // the main thread's own pauses; the V8.GC_* rows beneath them would count the same time twice
  const gc = { n: gcEv.length, ms: +(gcEv.reduce((s, e) => s + e.dur, 0) / 1000).toFixed(1), maxMs: +(gcEv.reduce((m, e) => Math.max(m, e.dur), 0) / 1000).toFixed(1) };
  if (errs.length) throw new Error("page error: " + errs[0]);
  const fr = dump.frames;
  if (!fr.length) throw new Error("no frames captured");
  const elapsed = (fr[fr.length - 1].t - fr[0].t) / 1000;
  const drawn = fr.filter((f) => f.drew);
  const booms = fr.reduce((s, f) => s + f.booms, 0);
  const burstIdx = fr.findIndex((f) => f.booms > 0);
  const simSeconds = fr.reduce((s, f) => s + f.steps * STEP, 0);
  const stepsSorted = fr.map((f) => f.steps).sort((a, b) => a - b);
  const summary = {
    frames: fr.length, drawn: drawn.length, elapsedS: +elapsed.toFixed(2), rafHz: +(fr.length / elapsed).toFixed(1), drawHz: +(drawn.length / elapsed).toFixed(1),
    worldRate: +(simSeconds / elapsed).toFixed(3), stepsP50: stepsSorted[Math.floor(stepsSorted.length / 2)], stepsMax: stepsSorted[stepsSorted.length - 1], framesAtSix: fr.filter((f) => f.steps >= 6).length,
    frame: stats(fr.map((f) => f.frame)), sim: stats(fr.map((f) => f.sim)), render: stats(drawn.map((f) => f.render)),
    burstFrameMs: burstIdx >= 0 ? +fr[burstIdx].frame.toFixed(2) : null, burstRenderMs: burstIdx >= 0 ? +fr[burstIdx].render.toFixed(2) : null,
    over33: fr.filter((f) => f.frame > 33.4).length, peakAwakeChunks: Math.max(...fr.map((f) => f.chunks)), peakContacts: Math.max(...fr.map((f) => f.contacts)),
    heapPeakMB: +(Math.max(...fr.map((f) => f.heap)) / 1048576).toFixed(1), booms, gc, bodies: dump.bodies, chunksDrawn: dump.chunksDrawn, chunksTotal: dump.chunksTotal,
  };
  if (!booms) throw new Error("NO BURST landed in the window");
  const out = { tool: "diag-davy-browser", mk: MK, startedAt: new Date().toISOString(), seed, label, tx, tz, gpu, settleS, afterS, tFire, summary, frames: fr };
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `browser-${label}.json`);
  fs.writeFileSync(file, JSON.stringify(out));
  const s = summary;
  const line = `${out.startedAt} diag-davy-browser ${label} seed ${seed} gpu ${/swiftshader|software|llvmpipe/i.test(gpu) ? "SOFTWARE" : "real"} rafHz ${s.rafHz} drawHz ${s.drawHz} worldRate ${s.worldRate} stepsP50 ${s.stepsP50} framesAtSix ${s.framesAtSix}/${s.frames} frameMean ${s.frame.mean} frameP95 ${s.frame.p95} frameWorst ${s.frame.worst} over33 ${s.over33} simMean ${s.sim.mean} renderMean ${s.render.mean} burstFrameMs ${s.burstFrameMs} burstRenderMs ${s.burstRenderMs} peakAwakeChunks ${s.peakAwakeChunks} peakContacts ${s.peakContacts} heapPeakMB ${s.heapPeakMB} gcN ${gc.n} gcMs ${gc.ms} gcMaxMs ${gc.maxMs} chunks ${s.chunksDrawn}/${s.chunksTotal}`;
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

Run `node --check scripts/diag-davy-browser.mjs`. It must print nothing.

### Step 7 — the page, its check, and the run list

Create `docs/superpowers/perf/davy/page.mjs` with exactly this content:

```js
// THE PAGE (0.6.8): reads every bench run beside it, checks that the runs
// of one world tell the same story in every non-timing field, and writes
// index.html — the step cost through the burst, the awake stones and the
// contacts, each window's function shares, the browser frames, and the
// rows. Exits 1 on any identity mismatch.
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
for (const r of runs) { const k = `${r.seed}/${r.mode}/${r.target}`; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); }
const SAME = [["stones", (r) => r.stonesNear], ["burstStep", (r) => r.burstStep], ["worldHash", (r) => r.identity.worldHash], ["runHash", (r) => r.identity.runHash], ["draws", (r) => r.identity.draws], ["breaks", (r) => r.identity.breaksTotal], ["lost", (r) => r.identity.lostTotal], ["peakAwake", (r) => r.after.peakAwake], ["peakContacts", (r) => r.after.peakContacts], ["rows", (r) => r.rows.length]];
const mismatches = [];
for (const [k, g] of groups) for (const r of g.slice(1)) for (const [name, get] of SAME) if (get(r) !== get(g[0])) mismatches.push(`${k}: ${r.label} ${name} ${get(r)} against ${g[0].label} ${get(g[0])}`);
const ok = mismatches.length === 0;
const verdict = ok ? `same world in every copy — ${runs.length} runs over ${groups.size} world${groups.size === 1 ? "" : "s"}` : `WORLDS DIFFER — ${mismatches.length} mismatch${mismatches.length === 1 ? "" : "es"}`;
console.log("identity: " + verdict);
for (const m of mismatches) console.log("  " + m);
const slim = runs.map((r) => ({
  label: r.label, mode: r.mode, target: r.target, seed: r.seed, stones: r.stonesNear, walls: r.wallCourses, burstStep: r.burstStep, mk: r.mk,
  burst: { ms: r.burst.ms, windowMs: r.burst.windowMs, lost: r.burst.lost, top: r.burst.profile.top.slice(0, 12) },
  after: { meanMs: r.after.meanMs, p95Ms: r.after.p95Ms, worstMs: r.after.worstMs, sumMs: r.after.sumMs, peakAwake: r.after.peakAwake, peakContacts: r.after.peakContacts, heavySteps: r.after.heavySteps, over7: r.after.over7, top: r.after.profile.top.slice(0, 12) },
  shares: r.shares, identity: r.identity, alloc: r.allocTop ? r.allocTop.slice(0, 10) : null,
  rows: r.rows.slice(Math.max(0, r.burstStep - 60)).map((x) => [x.i - r.burstStep, x.ms, x.chunks, x.contacts, x.welds, x.sweeps, x.heapMB]),
}));
const slimB = browser.map((b) => ({ label: b.label, seed: b.seed, gpu: b.gpu, summary: b.summary, frames: b.frames.map((f) => [+(f.t - b.frames[0].t).toFixed(1), +f.frame.toFixed(2), +f.sim.toFixed(2), +f.render.toFixed(2), f.steps, f.chunks, f.contacts, f.booms, +(f.heap / 1048576).toFixed(1)]) }));
const DATA = { ok, verdict, mismatches, runs: slim, browser: slimB, builtAt: new Date().toISOString() };
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>The davy bench</title>
<style>
:root{--bg:#0f1115;--fg:#e6e6e6;--mute:#9aa3ad;--line:#2a2f38;--ok:#4caf50;--bad:#e05252}
body{margin:0;padding:12px 16px 40px;background:var(--bg);color:var(--fg);font:14px/1.45 system-ui,sans-serif;max-width:1100px}
h1{font-size:20px;margin:6px 0 2px}h2{font-size:15px;margin:22px 0 6px;color:var(--mute);text-transform:uppercase;letter-spacing:1px}
.pill{display:inline-block;padding:3px 10px;border-radius:12px;font-weight:600;margin:6px 0}.ok{background:#1d3b22;color:#9be29f}.bad{background:#4a1d1d;color:#ffb3b3}
svg{width:100%;height:auto;display:block;background:#141822;border:1px solid var(--line);border-radius:6px;margin:6px 0}
.wrap{overflow:auto}table{border-collapse:collapse;font-size:12px;white-space:nowrap}td,th{border-bottom:1px solid var(--line);padding:3px 8px;text-align:right}th{color:var(--mute);font-weight:600}td:first-child,th:first-child{text-align:left}
.legend span{display:inline-block;margin:0 10px 4px 0;font-size:12px;color:var(--mute)}.legend i{display:inline-block;width:14px;height:3px;vertical-align:middle;margin-right:5px}
.bars{display:grid;grid-template-columns:1fr;gap:3px;font-size:12px}.bar{display:flex;align-items:center;gap:8px}.bar b{display:inline-block;height:10px;background:#5b8def;border-radius:2px}.bar span{color:var(--mute);min-width:52px}.bar em{font-style:normal;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px}.card{border:1px solid var(--line);border-radius:6px;padding:8px 10px;background:#121620}
p.note{color:var(--mute);font-size:12px;margin:4px 0}
</style></head><body>
<h1>The davy bench</h1>
<p class="note">one atomic round onto a town building; every step after it, measured on the Pi · built ${esc(DATA.builtAt)}</p>
<span class="pill ${ok ? "ok" : "bad"}" data-verdict>${ok ? "✓" : "✗"} ${esc(verdict)}</span>
${mismatches.length ? `<ul>${mismatches.map((m) => `<li>${esc(m)}</li>`).join("")}</ul>` : ""}
<div id="root"></div>
<script>
const DATA = ${JSON.stringify(DATA)};
const COLORS = ["#5b8def","#e0a052","#4caf50","#e05252","#b07ce0","#52c7e0","#e052b0","#9aa3ad","#f0e060","#60f0c0"];
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
function chart(series, opts) {
  const W = 1000, H = 300, L = 54, R = 12, T = 12, B = 30;
  const xs = series.flatMap((s) => s.pts.map((p) => p[0])), ys = series.flatMap((s) => s.pts.map((p) => p[1]));
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const log = !!opts.log;
  const yv = (v) => (log ? Math.log10(Math.max(0.01, v)) : v);
  let y0 = log ? Math.floor(yv(Math.min(...ys.filter((v) => v > 0)))) : 0, y1 = Math.ceil(yv(Math.max(...ys, 1)));
  if (y1 <= y0) y1 = y0 + 1;
  const sx = (x) => L + ((x - x0) / Math.max(1e-9, x1 - x0)) * (W - L - R);
  const sy = (y) => T + (1 - (yv(y) - y0) / (y1 - y0)) * (H - T - B);
  let g = "";
  const ticks = log ? Array.from({ length: y1 - y0 + 1 }, (_, i) => Math.pow(10, y0 + i)) : Array.from({ length: 6 }, (_, i) => y0 + ((y1 - y0) * i) / 5);
  for (const t of ticks) g += \`<line x1="\${L}" x2="\${W - R}" y1="\${sy(t)}" y2="\${sy(t)}" stroke="#2a2f38"/><text x="\${L - 6}" y="\${sy(t) + 4}" fill="#9aa3ad" font-size="11" text-anchor="end">\${log ? t : Math.round(t)}</text>\`;
  for (const xt of [x0, (x0 + x1) / 2, x1]) g += \`<text x="\${sx(xt)}" y="\${H - 8}" fill="#9aa3ad" font-size="11" text-anchor="middle">\${Math.round(xt)}</text>\`;
  if (opts.zero) g += \`<line x1="\${sx(0)}" x2="\${sx(0)}" y1="\${T}" y2="\${H - B}" stroke="#e05252" stroke-dasharray="4 3"/>\`;
  series.forEach((s, i) => { g += \`<path d="\${s.pts.map((p, k) => (k ? "L" : "M") + sx(p[0]).toFixed(1) + " " + sy(p[1]).toFixed(1)).join(" ")}" fill="none" stroke="\${COLORS[i % COLORS.length]}" stroke-width="\${s.width || 1.4}" \${s.dash ? 'stroke-dasharray="5 3"' : ""} opacity="0.9"/>\`; });
  g += \`<text x="\${L + 6}" y="\${T + 12}" fill="#9aa3ad" font-size="12">\${esc(opts.title)} — \${esc(opts.unit)}</text>\`;
  return \`<svg viewBox="0 0 \${W} \${H}" role="img" aria-label="\${esc(opts.title)}">\${g}</svg><div class="legend">\${series.map((s, i) => \`<span><i style="background:\${COLORS[i % COLORS.length]}"></i>\${esc(s.name)}</span>\`).join("")}</div>\`;
}
function bars(rows, title) {
  const max = Math.max(1, ...rows.map((r) => r.pct));
  return \`<div class="card"><b>\${esc(title)}</b><div class="bars">\${rows.map((r) => \`<div class="bar"><span>\${r.pct.toFixed(1)}%</span><b style="width:\${(100 * r.pct / max).toFixed(0)}px"></b><em title="\${esc(r.name)}">\${esc(r.name)}</em></div>\`).join("")}</div></div>\`;
}
let out = "";
const groups = new Map();
for (const r of DATA.runs) { const k = r.mode + " / " + r.target + " / seed " + r.seed; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); }
for (const [k, g] of groups) {
  out += \`<h2>\${esc(k)} — \${g[0].stones} stones within 25 m\${g[0].walls ? ", " + g[0].walls + " wall courses" : ""}</h2>\`;
  out += chart(g.map((r) => ({ name: r.label, pts: r.rows.map((x) => [x[0], x[1]]) })), { title: "one step's cost, from sixty steps before the burst (step 0)", unit: "milliseconds, log scale", log: true, zero: true });
  out += chart(g.flatMap((r) => [{ name: r.label + " awake chunks", pts: r.rows.map((x) => [x[0], x[2]]) }, { name: r.label + " contacts", pts: r.rows.map((x) => [x[0], x[3]]), dash: true }]), { title: "awake chunks (solid) and contacts (dashed)", unit: "count", zero: true });
  out += \`<div class="wrap"><table><tr><th>run</th><th>burst ms</th><th>burst window ms</th><th>walls lost</th><th>shadow %</th><th>explode %</th><th>road map %</th><th>after mean ms</th><th>after p95</th><th>after worst</th><th>after sum</th><th>peak awake</th><th>peak contacts</th><th>heavy steps</th><th>steps over 7 ms</th><th>solve %</th><th>pairs %</th><th>welds %</th><th>sweeper %</th><th>hash</th><th>draws</th></tr>\`;
  for (const r of g) out += \`<tr><td>\${esc(r.label)}</td><td>\${r.burst.ms}</td><td>\${r.burst.windowMs}</td><td>\${r.burst.lost}</td><td>\${r.shares.shadow}</td><td>\${r.shares.explode}</td><td>\${r.shares.flow}</td><td>\${r.after.meanMs}</td><td>\${r.after.p95Ms}</td><td>\${r.after.worstMs}</td><td>\${r.after.sumMs}</td><td>\${r.after.peakAwake}</td><td>\${r.after.peakContacts}</td><td>\${r.after.heavySteps}</td><td>\${r.after.over7}</td><td>\${r.shares.solve}</td><td>\${r.shares.pairs}</td><td>\${r.shares.welds}</td><td>\${r.shares.sweeper}</td><td>\${r.identity.worldHash}/\${r.identity.runHash}</td><td>\${r.identity.draws}</td></tr>\`;
  out += "</table></div>";
  const first = g[0];
  out += \`<div class="grid">\${bars(first.burst.top, first.label + " — the burst window, by function")}\${bars(first.after.top, first.label + " — the after window, by function")}\${first.alloc ? bars(first.alloc.map((a) => ({ name: a.name, pct: a.mb })), first.label + " — bytes allocated in the after window, MB by function") : ""}</div>\`;
}
if (DATA.browser.length) {
  out += \`<h2>the browser on the Pi's display — \${esc(DATA.browser[0].gpu)}</h2>\`;
  out += chart(DATA.browser.map((b) => ({ name: b.label, pts: b.frames.map((f) => [f[0] / 1000, f[1]]) })), { title: "one frame's cost through the burst", unit: "milliseconds, log scale, seconds along", log: true });
  out += chart(DATA.browser.flatMap((b) => [{ name: b.label + " steps per frame", pts: b.frames.map((f) => [f[0] / 1000, f[4]]) }, { name: b.label + " awake chunks ÷ 100", pts: b.frames.map((f) => [f[0] / 1000, f[5] / 100]), dash: true }]), { title: "steps run per frame (solid) and awake chunks in hundreds (dashed)", unit: "count, seconds along" });
  out += \`<div class="wrap"><table><tr><th>run</th><th>frames/s</th><th>drawn/s</th><th>world rate</th><th>steps p50</th><th>frames at six</th><th>frame mean</th><th>frame p95</th><th>frame worst</th><th>over 33 ms</th><th>sim mean</th><th>render mean</th><th>burst frame</th><th>burst render</th><th>peak awake</th><th>peak contacts</th><th>heap peak MB</th><th>sweeper n</th><th>sweeper ms</th><th>sweeper max</th><th>chunks</th></tr>\`;
  for (const b of DATA.browser) { const s = b.summary; out += \`<tr><td>\${esc(b.label)}</td><td>\${s.rafHz}</td><td>\${s.drawHz}</td><td>\${s.worldRate}</td><td>\${s.stepsP50}</td><td>\${s.framesAtSix}/\${s.frames}</td><td>\${s.frame.mean}</td><td>\${s.frame.p95}</td><td>\${s.frame.worst}</td><td>\${s.over33}</td><td>\${s.sim.mean}</td><td>\${s.render.mean}</td><td>\${s.burstFrameMs}</td><td>\${s.burstRenderMs}</td><td>\${s.peakAwakeChunks}</td><td>\${s.peakContacts}</td><td>\${s.heapPeakMB}</td><td>\${s.gc.n}</td><td>\${s.gc.ms}</td><td>\${s.gc.maxMs}</td><td>\${s.chunksDrawn}/\${s.chunksTotal}</td></tr>\`; }
  out += "</table></div>";
}
document.getElementById("root").innerHTML = out;
</script></body></html>
`;
fs.writeFileSync(path.join(HERE, "index.html"), html);
console.log(`wrote index.html — ${runs.length} bench runs, ${browser.length} browser runs`);
process.exit(ok ? 0 : 1);
```

Create `docs/superpowers/perf/davy/check.mjs` with exactly this content:

```js
// THE PAGE CHECK: the built page opens headless, inside the skeleton the
// viewer wraps it in, without a page error; the charts draw; at phone width
// the page does not scroll sideways.
import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const body = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
const doc = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body style="margin:0">' + body + "</body></html>";
const browser = await puppeteer.launch({ executablePath: "/usr/bin/chromium", headless: true, args: ["--no-sandbox", "--disable-gpu", "--window-size=960,600"] });
let code = 0;
try {
  const page = await browser.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  await page.setViewport({ width: 960, height: 600 });
  await page.setContent(doc, { waitUntil: "load" });
  await new Promise((r) => setTimeout(r, 500));
  const svgs = await page.evaluate(() => document.querySelectorAll("svg").length);
  const paths = await page.evaluate(() => document.querySelectorAll("svg path").length);
  const verdict = await page.evaluate(() => { const e = document.querySelector("[data-verdict]"); return e ? e.textContent.trim() : ""; });
  console.log(`desktop: svgs ${svgs} | paths ${paths} | verdict ${verdict.slice(0, 80)} | page errors ${errs.length}`);
  if (errs.length) { console.log(errs.join("\n")); code = 1; }
  if (svgs < 2 || paths < 2) code = 1;
  await page.setViewport({ width: 390, height: 844 });
  await new Promise((r) => setTimeout(r, 400));
  const wide = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  console.log(`phone: sideways scroll ${wide}`);
  if (wide) code = 1;
  console.log(code ? "PAGE CHECK FAILED" : "PAGE CHECK OK");
} finally {
  await browser.close();
}
process.exit(code);
```

Create `docs/superpowers/perf/davy/all.sh` with exactly this content:

```bash
#!/bin/bash
# THE BENCH RUNS (0.6.8): one drawn seed, printed first. Five sandbox runs on
# the town, five on the wall-ringed town, one allocation run, three runs in
# the real war with its first assault afield; then three browser runs on the
# town, on the Pi's own display; then the page and its check. A rerun passes
# the drawn seed back: bash all.sh <seed>.
set -e
ROOT=/home/batman/coldsnap
OUT=$ROOT/docs/superpowers/perf/davy
SEED=${1:-$(node -e 'console.log(Math.floor(Math.random()*1000000)+1)')}
echo "seed $SEED"
cd "$ROOT"
for K in 1 2 3 4 5; do
  node scripts/diag-davy.mjs --seed "$SEED" --mode sandbox --target town --label base$K
  node scripts/diag-davy.mjs --seed "$SEED" --mode sandbox --target walls --label base$K
done
node scripts/diag-davy.mjs --seed "$SEED" --mode sandbox --target town --label alloc --alloc
for K in 1 2 3; do node scripts/diag-davy.mjs --seed "$SEED" --mode war --target town --label war$K; done
TX=$(node -e "console.log(require('$OUT/base1-sandbox-town.json').tx)")
TZ=$(node -e "console.log(require('$OUT/base1-sandbox-town.json').tz)")
npm run build
pkill -f "[v]ite preview" || true; sleep 1
( npm run preview -- --strictPort --port 4173 >/tmp/davy-preview.log 2>&1 & )
curl -sf --retry 30 --retry-delay 1 --retry-all-errors http://localhost:4173/coldsnap/ -o /dev/null
for K in 1 2 3; do DISPLAY=:0 node scripts/diag-davy-browser.mjs --seed "$SEED" --tx "$TX" --tz "$TZ" --label base$K; done
pkill -f "[v]ite preview" || true
node "$OUT/page.mjs"
node "$OUT/check.mjs"
echo "ALL DONE seed $SEED"
```

Run `node --check docs/superpowers/perf/davy/page.mjs`, `node --check docs/superpowers/perf/davy/check.mjs`, and `bash -n docs/superpowers/perf/davy/all.sh`. Each must print nothing.

### Step 8 — the mark

In `src/version.js`, replace `export const MK = "0.6.7";` with `export const MK = "0.6.8";`.

### Step 9 — the gates and the keystone

Run, in this order, and record each result line:

1. `node scripts/gate.mjs depot-lint` — `depot-lint PASS`.
2. `node scripts/gate.mjs depot-test` — ends `depot-test PASS`; 1708 + 6 = 1714 PASS / 0 FAIL; the report states the numbers and the era's fixture seed.
3. `npm run build`, then `npm run preview &`, then `node scripts/gate.mjs smoke` — `BOOT-LOAD SMOKE: ALL PASS`, 27 PASS lines. Stop the preview server after.
4. `node src/depot/api.js gate 7 20` — exactly `seed 7  seconds 20 (2400 steps)  worldHash 1278094788  runHash 2033212782`. Any other number stops the task before the commit; report it.

### Step 10 — the landing of the witness

Commit exactly these files in one commit: `src/depot/witness.js`, `src/depot/hooks.js`, `src/depot/DepotGame.jsx`, `src/version.js`, `scripts/tests/54-the-davy-bench.mjs`, `scripts/depot-test.mjs`, `scripts/diag-davy.mjs`, `scripts/diag-davy-browser.mjs`, `docs/superpowers/perf/davy/page.mjs`, `docs/superpowers/perf/davy/check.mjs`, `docs/superpowers/perf/davy/all.sh`, and this plan file. Subject: `the davy bench, 0.6.8`. Push to `main`.

### Step 11 — the runs

Run `bash docs/superpowers/perf/davy/all.sh` from the repository root with the display attached (`DISPLAY=:0` is set inside for the browser runs). It prints the drawn seed first; record it. It runs, in order: five sandbox runs on the town, five on the wall-ringed town, one allocation run, three war runs, the build, three browser runs, the page, the page check. Expect about one hour on this machine. It stops on the first failure; a failure is reported with its output and the task stops there.

If a browser run reports `gpu SOFTWARE`, the browser numbers are not usable; report it and run the three browser runs again once with `DISPLAY=:0` confirmed (`xdpyinfo -display :0 | head -3` must print a screen).

Then read, from the twenty lines the runs appended to `.superpowers/experiments.log` and from the page's verdict, the following, and put them in the report as plain numbers:

1. The identity verdict: `same world in every copy`, or every mismatch line.
2. The noise floor: across `base1`–`base5` on the town, the lowest and highest `burstMs`, `afterMean`, and `afterWorst`.
3. The burst's shares on the town and on the walls: `shadow%`, `explode%`, `flow%`, `lost`.
4. The after-window's shares: `solve%`, `pairs%`, `welds%`, `sweeper%`; and `peakAwake`, `peakContacts`, `heavySteps`, `over7`.
5. The war runs against the sandbox runs: the same fields side by side.
6. The browser: `rafHz`, `worldRate`, `framesAtSix`, `frameWorst`, `over33`, `burstFrameMs`, `burstRenderMs`, `gcMs`, `gpu`.
7. The allocation run's top three.

### Step 12 — the landing of the numbers

Commit exactly these files in one commit: every `docs/superpowers/perf/davy/*.json` the runs wrote, and `docs/superpowers/perf/davy/index.html`. Subject: `the davy bench measures, 0.6.8`. Push.

Then in `docs/superpowers/plans/2026-10-11-coldsnap-the-outbreak-phase.md`, after the T7 row add the row `| T8 | 0.6.8 | The davy bench: a headless bench with node's profiler and a browser bench on the Pi's display measure one atomic burst on the untouched game — the witness module, the davy hook, the stopwatch's new columns, the seeded sandbox, the page | LANDED — mark 0.6.8, keystone unchanged (seed 7, 20 s: 1278094788 / 2033212782), depot-test 1714, smoke 27/27, the runs at docs/superpowers/perf/davy/index.html |`. Commit that file alone with the subject `t8 lands in the phase document — 0.6.8, the davy bench, 27/27`. Push.

### Step 13 — the keystone, confirmed on the pushed tree

Run `node src/depot/api.js gate 7 20` once more and record the line; it must still match Step 0.

## Acceptance

- Step 0, Step 9, and Step 13 print the identical keystone line.
- `depot-test` 1714 PASS / 0 FAIL on a rolled seed; `depot-lint` PASS; smoke 27/27.
- The page's verdict reads `same world in every copy`; the page check prints `PAGE CHECK OK`.
- Twenty lines in `.superpowers/experiments.log` from this task's runs, one per run, each carrying the drawn seed.
- The live site, phone and desktop: nothing visible changes; the sandbox still boots from its menu button. The owner's eyes are the acceptance.

## Report

One line of outcome, then: the read-confirmation; every gate's result line; the three keystone lines; the depot-test totals and the era's fixture seed; the drawn bench seed; the seven numbered readings of Step 11 as plain numbers; the commit hashes; every deviation, nonconformity, and re-pin as its own labeled bullet. The page file `docs/superpowers/perf/davy/index.html` is named as the thing to open.
