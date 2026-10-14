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
