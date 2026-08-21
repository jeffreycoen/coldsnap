// mech-probe.mjs — THE MECH's first gate (Phase A, mk1.92). The p7-cap-fine.mjs
// idiom verbatim: same launch, same seed 2307, same ?perf=1 + normalized
// arithmetic. Stages the standing war, fields both sides' mechs 60m apart and
// orders them onto each other, measures a settle-then-12s window, then fires
// six real shells at one mech to force a knockdown and measures a second
// 12s window covering the down-and-stand. Two repeats within 3%.
import puppeteer from "puppeteer-core";

const BASE = process.env.SHOT_URL || "http://localhost:4173/coldsnap/";
const CHROME = process.env.CHROME_BIN || "/usr/bin/chromium";
const BREAK_MS = 11.0, SETTLE_S = 8, MEASURE_S = 12;

async function measureWindow(page, label) {
  await page.waitForFunction((s) => window.__DEPOT__().t >= s, { timeout: 300000, polling: 500 },
    (await page.evaluate(() => window.__DEPOT__().t)) + SETTLE_S);
  await page.evaluate(() => window.__DEPOTPERF__.reset());
  const tA = await page.evaluate(() => window.__DEPOT__().t);
  await page.waitForFunction((tt) => window.__DEPOT__().t >= tt, { timeout: 300000, polling: 500 }, tA + MEASURE_S);
  const d = await page.evaluate((tA) => {
    const p = window.__DEPOTPERF__();
    const sims = p.frames.map((f) => f.sim).sort((a, b) => a - b);
    const mean = sims.reduce((s, v) => s + v, 0) / sims.length;
    const med = sims[Math.floor(sims.length / 2)];
    const p95 = sims[Math.floor(sims.length * 0.95)];
    const tB = window.__DEPOT__().t;
    const total = sims.reduce((s, v) => s + v, 0);
    const steps = Math.max(1, Math.round((tB - tA) * 120));
    const norm = (total / steps) * 2;
    return { mean, med, p95, norm, frames: sims.length };
  }, tA);
  console.log(`${label}: norm=${d.norm.toFixed(2)}ms mean=${d.mean.toFixed(2)} med=${d.med.toFixed(2)} p95=${d.p95.toFixed(2)} (${d.frames}f)`);
  return d.norm;
}

async function oneRun(rep) {
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

  // the standing war: eight rifle squads at the depot front, then eight
  // waves of six — the worst-case field the probe judges against.
  await page.evaluate(() => {
    const flags = window.__DEPOTFLAGS__();
    const home = flags[0];
    const toward = home.z > 0 ? -1 : 1;
    for (let i = 0; i < 8; i++) window.__DEPOTSQUAD__("rifles", home.x - 14 + i * 4, home.z + toward * 10);
    for (let w = 0; w < 8; w++) window.__DEPOTSPAWN__(6);
  });

  // both sides' mechs, 60m apart, ordered onto each other.
  const mechIds = await page.evaluate(() => {
    const flags = window.__DEPOTFLAGS__();
    const home = flags[0];
    const toward = home.z > 0 ? -1 : 1;
    const a = window.__DEPOTMECH__(1, home.x, home.z + toward * 20, 0);
    const b = window.__DEPOTMECH__(2, home.x, home.z + toward * 20 + toward * 60, Math.PI);
    window.__DEPOTMECHORDER__(a, "move", home.x, home.z + toward * 20 + toward * 55);
    window.__DEPOTMECHORDER__(b, "move", home.x, home.z + toward * 20 + toward * 5);
    return { a, b, home };
  });

  const win1 = await measureWindow(page, `rep${rep} window1 (duel)`);

  // six real shells at one mech — force a knockdown.
  await page.evaluate((ids) => {
    const m = window.__DEPOTMECHS__().find((mm) => mm.id === ids.a);
    for (let i = 0; i < 6; i++) window.__DEPOTSHELL__(m.x, 2.0, m.z);
  }, mechIds);

  const win2 = await measureWindow(page, `rep${rep} window2 (down-and-stand)`);

  await browser.close();
  return { win1, win2 };
}

const PORT_NOTE = BASE;
console.log(`mech-probe.mjs — target ${PORT_NOTE}`);
const results = [];
for (let rep = 1; rep <= 2; rep++) {
  results.push(await oneRun(rep));
}
console.log("\nRESULTS:");
for (let i = 0; i < results.length; i++) console.log(`  rep${i + 1}: window1=${results[i].win1.toFixed(2)}ms window2=${results[i].win2.toFixed(2)}ms`);

const w1 = results.map((r) => r.win1), w2 = results.map((r) => r.win2);
const w1delta = Math.abs(w1[0] - w1[1]) / Math.max(w1[0], w1[1]) * 100;
const w2delta = Math.abs(w2[0] - w2[1]) / Math.max(w2[0], w2[1]) * 100;
console.log(`  window1 repeat delta: ${w1delta.toFixed(1)}%`);
console.log(`  window2 repeat delta: ${w2delta.toFixed(1)}%`);

const worst = Math.max(...w1, ...w2);
if (worst > BREAK_MS) {
  console.log(`\nOVER THE LINE: worst window ${worst.toFixed(2)}ms > ${BREAK_MS}ms`);
  process.exit(1);
} else {
  console.log(`\nUNDER THE LINE: worst window ${worst.toFixed(2)}ms <= ${BREAK_MS}ms`);
}
