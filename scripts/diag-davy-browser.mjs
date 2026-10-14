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
