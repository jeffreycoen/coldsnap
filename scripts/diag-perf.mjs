// diag-perf.mjs — MEASURING TOOL, not a test. Never in the deploy pipeline
// (the `diag-` prefix is the convention; see docs/superpowers/test-manifest.md).
//
// Reads the mk0.35 stopwatch (?perf=1) out of a REAL browser on this machine
// and prints where each WINTER FRONT frame's time goes: the fixed-step sim
// block vs the R.render call vs everything else. Headful Chromium against the
// real GPU — headless swiftshader numbers are fiction for draw cost, so this
// script refuses to pretend and labels the GPU path it actually got.
//
//   npm run build && npm run preview &
//   DISPLAY=:0 node scripts/diag-perf.mjs
//
// Env: PERF_URL (default http://localhost:4173/coldsnap/), CHROME_BIN,
//      PERF_WINDOW_S (default 60), PERF_SEED (default 11),
//      PERF_JSON (write the raw per-frame dump here).
import fs from "node:fs";
import puppeteer from "puppeteer-core";
import { MK } from "../src/version.js";

const URL_BASE = process.env.PERF_URL || "http://localhost:4173/coldsnap/";
const CHROME = process.env.CHROME_BIN || "/usr/bin/chromium";
const WINDOW_S = Number(process.env.PERF_WINDOW_S || 60);
const SEED = process.env.PERF_SEED || "11";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- statistics
function stats(xs) {
  if (!xs.length) return { n: 0, mean: 0, p95: 0, worst: 0 };
  const s = [...xs].sort((a, b) => a - b);
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  return { n: xs.length, mean, p95: s[Math.min(s.length - 1, Math.floor(s.length * 0.95))], worst: s[s.length - 1] };
}
const f2 = (x) => (Math.round(x * 100) / 100).toFixed(2);

function summarize(label, dump) {
  const fr = dump.frames;
  if (!fr.length) return { label, empty: true, ...dump };
  const elapsed = (fr[fr.length - 1].t - fr[0].t) / 1000;
  const drawn = fr.filter((f) => f.drew);
  return {
    label,
    frames: fr.length, drawnFrames: drawn.length, elapsedS: elapsed,
    rafHz: elapsed > 0 ? fr.length / elapsed : 0,
    drawHz: elapsed > 0 ? drawn.length / elapsed : 0,
    overflowed: dump.overflowed,
    bodies: dump.bodies, chunksDrawn: dump.chunksDrawn, chunksTotal: dump.chunksTotal,
    sim: stats(fr.map((f) => f.sim)),
    render: stats(drawn.map((f) => f.render)),          // drawn frames only
    frame: stats(fr.map((f) => f.frame)),
    other: stats(fr.map((f) => f.frame - f.sim - f.render)),
    worstFrame: fr.reduce((a, b) => (b.frame > a.frame ? b : a)),
  };
}

function print(s) {
  if (s.empty) { console.log(`\n### ${s.label} — NO FRAMES CAPTURED`); return; }
  console.log(`\n### ${s.label}`);
  console.log(`  window ${f2(s.elapsedS)}s · ${s.frames} rAF frames · ${s.drawnFrames} drawn` +
    `${s.overflowed ? " · RING OVERFLOWED (oldest frames lost)" : ""}`);
  console.log(`  effective: ${f2(s.rafHz)} rAF/s, ${f2(s.drawHz)} drawn/s`);
  console.log(`  bodies ${s.bodies} · chunks drawn ${s.chunksDrawn} / total ${s.chunksTotal}`);
  for (const k of ["sim", "render", "other", "frame"]) {
    console.log(`  ${k.padEnd(7)} mean ${f2(s[k].mean).padStart(7)}  p95 ${f2(s[k].p95).padStart(7)}  worst ${f2(s[k].worst).padStart(8)}  ms`);
  }
  const w = s.worstFrame;
  console.log(`  worst frame: total ${f2(w.frame)}ms = sim ${f2(w.sim)} + render ${f2(w.render)} + other ${f2(w.frame - w.sim - w.render)}`);
}

// ------------------------------------------------------------------ browser
console.log(`diag-perf ${MK} — headful Chromium, DISPLAY=${process.env.DISPLAY || "(unset)"}`);
const browser = await puppeteer.launch({
  protocolTimeout: 600000,
  executablePath: CHROME,
  headless: false,
  args: ["--no-sandbox", "--window-size=1000,660"],
});
const results = [];
const raw = {};
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 960, height: 600 });
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));

  // What GPU did we actually get? swiftshader would make every draw number a
  // fiction — say so loudly rather than publishing it.
  await page.goto("about:blank");
  const gpu = await page.evaluate(() => {
    const gl = document.createElement("canvas").getContext("webgl2") || document.createElement("canvas").getContext("webgl");
    if (!gl) return { renderer: "NO WEBGL" };
    const d = gl.getExtension("WEBGL_debug_renderer_info");
    return {
      renderer: d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      vendor: d ? gl.getParameter(d.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
      version: gl.getParameter(gl.VERSION),
    };
  });
  const soft = /swiftshader|software|llvmpipe/i.test(gpu.renderer || "");
  console.log(`GPU PATH: ${gpu.vendor} — ${gpu.renderer} [${gpu.version}]`);
  if (soft) console.log("*** SOFTWARE RASTERIZER — render/draw numbers below are UNUSABLE. Sim numbers stay valid. ***");

  const enterDepot = async () => {
    // navigate first — localStorage is unreadable on about:blank
    await page.goto(`${URL_BASE}?seed=${SEED}&perf=1`, { waitUntil: "networkidle0" });
    await page.evaluate(() => {
      for (const k of Object.keys(localStorage)) if (k.startsWith("coldsnap-depot")) localStorage.removeItem(k);
      localStorage.setItem("coldsnap-screen", "menu");
    });
    await page.reload({ waitUntil: "networkidle0" });
    await page.waitForSelector('[data-menu="depot"]', { timeout: 20000 });
    await page.evaluate(() => document.querySelector('[data-menu="depot"]').click());
    await page.waitForFunction(() => typeof window.__DEPOTPERF__ === "function", { timeout: 30000 });
  };

  // mk0.53: the 30fps draw toggle was removed off this script's own evidence
  // (physics-bound; halved draws bought stutter, not headroom). setFps is a
  // no-op kept so older invocations don't crash.
  const setFps = async () => true;

  // Measure a window: clear the ring, wait, read it back.
  const measure = async (label, seconds) => {
    await page.evaluate(() => window.__DEPOTPERF__.reset());
    await sleep(seconds * 1000);
    const dump = await page.evaluate(() => window.__DEPOTPERF__());
    raw[label] = dump;
    const s = summarize(label, dump);
    results.push(s); print(s);
    return s;
  };

  for (const want30 of [false, true]) {
    const rate = want30 ? "30fps" : "60fps";
    await enterDepot();
    const okFps = await setFps(want30);
    if (!okFps) console.log(`!! could not reach ${rate} — the numbers below are at the other rate`);
    await page.evaluate(() => window.__DEPOTSTART__());

    // (a) QUIET — the run is live but nothing is fighting. The first bell is
    // rung early and its assault drained at once, so the world keeps stepping
    // with an empty field for the rest of the period.
    await page.evaluate(() => window.__DEPOTBELL__());
    await page.waitForFunction(() => window.__DEPOT__().bell >= 1, { timeout: 30000, polling: 100 }).catch(() => {});
    await page.evaluate(() => window.__DEPOTTHIN__());
    const quietState = await page.evaluate(() => window.__DEPOT__());
    console.log(`\n[${rate}] QUIET staged — bell ${quietState.bell}, bodies ${quietState.bodies}, kills ${quietState.kills}`);
    await measure(`${rate} / QUIET`, WINDOW_S);

    // (b) HEAVY — a real two-sided fight, staged through the hooks the game
    // already exposes: player sniper pairs around the depot flag, then the
    // wave resumed and reinforced with mass enemy spawns.
    const flag = await page.evaluate(() => {
      const fs2 = window.__DEPOTFLAGS__();
      return fs2.length ? fs2[0] : null;
    });
    if (flag) {
      await page.evaluate((f) => {
        for (const [dx, dz] of [[6, 6], [-6, 6], [6, -6], [-6, -6], [10, 0], [0, 10]]) {
          try { window.__DEPOTPAIR__(f.x + dx, f.z + dz); } catch (e) {}
        }
      }, flag);
    }
    await sleep(500);
    await page.evaluate(() => { window.__DEPOTSPAWN__(60); });
    await sleep(4000);
    await page.evaluate(() => { window.__DEPOTSPAWN__(60); });
    await sleep(6000);
    const heavyState = await page.evaluate(() => window.__DEPOT__());
    console.log(`\n[${rate}] HEAVY staged — bell ${heavyState.bell}, bodies ${heavyState.bodies}, depotStanding ${f2(heavyState.depotStanding)}`);
    await measure(`${rate} / HEAVY`, WINDOW_S);
    const heavyAfter = await page.evaluate(() => window.__DEPOT__());
    console.log(`[${rate}] HEAVY ended — bodies ${heavyAfter.bodies}, kills ${heavyAfter.kills}, ` +
      `depotStanding ${f2(heavyAfter.depotStanding)}, run ended ${heavyAfter.endedAt != null ? "YES (breach " + !!heavyAfter.breach + ")" : "no"}`);

    // (c) COLLAPSE SPIKE — its own FRESH run, so the spike is attributable to
    // the falling masonry and not to the leftover heavy fight. One six-shell
    // burst into the depot's own wall brings part of it down; the ring is
    // cleared the instant before the burst, so the window is the collapse.
    await enterDepot();
    if (!(await setFps(want30))) console.log(`!! could not reach ${rate} for the collapse window`);
    await page.evaluate(() => window.__DEPOTSTART__());
    await sleep(1000);
    const depot = await page.evaluate(() => window.__DEPOTGETFOCUS__()); // opening camera sits on the depot
    const before = await page.evaluate(() => window.__DEPOT__());
    await page.evaluate(() => window.__DEPOTPERF__.reset());
    await page.evaluate((d) => {
      for (const y of [2.0, 4.0]) for (const dx of [-2, 0, 2]) window.__DEPOTSHELL__(d.x + dx, y, d.z + 2);
    }, depot);
    await sleep(10000);
    const dump = await page.evaluate(() => window.__DEPOTPERF__());
    raw[`${rate} / COLLAPSE`] = dump;
    const s = summarize(`${rate} / COLLAPSE`, dump);
    results.push(s); print(s);
    const after = await page.evaluate(() => window.__DEPOT__());
    console.log(`  depot standing ${f2(before.depotStanding)} -> ${f2(after.depotStanding)}` +
      ` (${before.depotStanding - after.depotStanding > 0.001 ? "masonry came down" : "NO measurable collapse — spike above is NOT a collapse"})`);
  }

  if (pageErrors.length) console.log(`\n!! page errors during the run:\n  ${pageErrors.join("\n  ")}`);
  else console.log("\nno page errors during the run");

  if (process.env.PERF_JSON) {
    fs.writeFileSync(process.env.PERF_JSON, JSON.stringify({ mk: MK, gpu, results, raw }, null, 1));
    console.log(`raw dump written to ${process.env.PERF_JSON}`);
  }

  console.log("\n=== SUMMARY (ms/frame) ===");
  console.log("scenario                 rAF/s  drawn/s  sim mean  sim p95  ren mean  ren p95  frame p95  worst  bodies  chunks");
  for (const s of results) {
    if (s.empty) { console.log(`${s.label.padEnd(24)} — no frames`); continue; }
    console.log(
      `${s.label.padEnd(24)}${f2(s.rafHz).padStart(6)}${f2(s.drawHz).padStart(9)}` +
      `${f2(s.sim.mean).padStart(10)}${f2(s.sim.p95).padStart(9)}${f2(s.render.mean).padStart(10)}${f2(s.render.p95).padStart(9)}` +
      `${f2(s.frame.p95).padStart(11)}${f2(s.frame.worst).padStart(8)}${String(s.bodies).padStart(8)}${String(s.chunksTotal).padStart(8)}`);
  }
} finally {
  await browser.close();
}
