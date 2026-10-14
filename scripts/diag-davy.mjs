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
