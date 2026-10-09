// THE RUN: one headed browser on the Pi's own display, the map at default
// chips, LAUNCH, then the game's own log rows until the eleventh (the birth
// row plus ten flown seconds), captured exactly as the ⊕ LOG chip copies
// them. Usage: node run.mjs <name> <seed> — the seed is the harness's drawn
// seed, pinned into the page's dice so every run builds the same sky.
import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../../..");
const [name, seedArg] = process.argv.slice(2);
if (!name || !seedArg) { console.error("usage: node run.mjs <name> <seed>"); process.exit(2); }
const seed = +seedArg;
const ROWS = 11;
const PAGE_URL = "http://localhost:4173/coldsnap/";
const { MK } = await import(ROOT + "/src/version.js");
console.log(`run ${name} seed ${seed} mk ${MK}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({
  executablePath: "/usr/bin/chromium",
  headless: false,
  defaultViewport: { width: 960, height: 600 },
  args: ["--no-sandbox", "--window-size=960,600", "--window-position=0,0"],
  env: { ...process.env, DISPLAY: ":0" },
  protocolTimeout: 600000,
});
let code = 0;
try {
  const page = await browser.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  await page.evaluateOnNewDocument((s) => {
    // the pinned draw: while the pin is up, Math.random answers the pinned seed itself; the pin goes up at the click into the debris screen and comes down once the LAUNCH chip stands, so the sky's own seed is the pin in every run and every other draw is the page's own
    const orig = Math.random.bind(Math);
    window.__pin = false;
    Math.random = () => (window.__pin ? (s + 0.5) / 100000 : orig());
    // the ⊕ LOG chip copies to the clipboard; here the clipboard is a shelf the driver reads
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: (t) => { window.__log = t; return Promise.resolve(); } } });
  }, seed);
  await page.goto(PAGE_URL, { waitUntil: "networkidle0" });
  await page.bringToFront();
  const raf = await page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const tick = () => { if (++n < 120) requestAnimationFrame(tick); else res(1000 * n / (performance.now() - t0)); }; requestAnimationFrame(tick); }));
  const vis = await page.evaluate(() => document.visibilityState);
  console.log(`raf ${raf.toFixed(1)} visibility ${vis}`);
  if (vis !== "visible") throw new Error("the page is not visible on the display");
  await page.waitForSelector('[data-menu="demos"]');
  await page.evaluate(() => document.querySelector('[data-menu="demos"]').click());
  await page.waitForSelector('[data-menu="debris"]');
  await page.evaluate(() => { window.__pin = true; document.querySelector('[data-menu="debris"]').click(); });
  await page.waitForFunction(() => document.body.innerText.includes("GRAVITY'S DEBRIS"), { timeout: 60000 });
  const chip = (label) => page.evaluate((l) => { const d = [...document.querySelectorAll("div")].find((x) => x.childElementCount === 0 && x.textContent === l); if (!d) return false; d.click(); return true; }, label);
  const has = (label) => page.evaluate((l) => [...document.querySelectorAll("div")].some((x) => x.childElementCount === 0 && x.textContent === l), label);
  await page.waitForFunction(() => [...document.querySelectorAll("div")].some((x) => x.childElementCount === 0 && x.textContent === "LAUNCH"), { timeout: 120000, polling: 250 });
  await page.evaluate(() => { window.__pin = false; });
  let flying = false;
  for (let i = 0; i < 200 && !flying; i++) { await chip("LAUNCH"); await sleep(250); flying = await has("PLAN BURN"); }
  if (!flying) throw new Error("LAUNCH never took");
  const tLaunch = Date.now();
  console.log("launched");
  let data = null;
  for (;;) {
    await sleep(10000);
    if (await page.evaluate(() => document.hidden)) throw new Error("the page went hidden mid-run");
    if (errs.length) throw new Error("page error: " + errs[0]);
    if (!(await chip("⊕ LOG"))) { console.log("LOG chip busy"); continue; }
    await sleep(300);
    const txt = await page.evaluate(() => window.__log || null);
    if (!txt) { console.log("no capture yet"); continue; }
    data = JSON.parse(txt);
    if (data.seed !== seed) throw new Error("world seed " + data.seed + " against the pin " + seed);
    const last = data.log[data.log.length - 1];
    console.log(`rows ${data.log.length} sim ${last.sim} real ${last.real} fpsAvg ${last.fpsAvg} stepMs ${last.stepMs} (${((Date.now() - tLaunch) / 1000).toFixed(0)}s since launch)`);
    if (data.log.length >= ROWS) break;
    if (Date.now() - tLaunch > 40 * 60 * 1000) throw new Error("forty minutes passed before row " + ROWS);
  }
  data.log = data.log.slice(0, ROWS);
  const out = { run: name, harnessSeed: seed, mk: MK, raf: +raf.toFixed(1), viewport: "960x600 desktop, headed chromium on the Pi display", startedAt: new Date().toISOString(), ...data };
  fs.writeFileSync(path.join(HERE, name + ".json"), JSON.stringify(out));
  const flown = out.log.filter((r) => r.sim >= 2);
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const line = `${new Date().toISOString()} t93-perf ${name} harness-seed ${seed} world-seed ${out.seed} rows ${out.log.length} raf ${raf.toFixed(1)} stepMs ${mean(flown.map((r) => r.stepMs)).toFixed(2)} fpsAvg ${mean(flown.map((r) => r.fpsAvg)).toFixed(1)} worstMs ${Math.max(...flown.map((r) => (r.worst ? r.worst.ms : 0))).toFixed(1)}`;
  console.log(line);
  fs.appendFileSync(path.join(ROOT, ".superpowers", "experiments.log"), line + "\n");
  console.log("RUN DONE " + name);
} catch (e) {
  console.error("RUN FAILED " + name + ": " + ((e && e.message) || e));
  code = 1;
} finally {
  await browser.close();
}
process.exit(code);
