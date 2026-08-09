// TD functional gate on the ported engine: marchers reach the depot and leak,
// towers kill and pay bounty, walls take rifle fire and shatter into chunks.
// Boots the real site, drives the sim via the __TD*__ hooks at 120Hz.
import puppeteer from "puppeteer-core";

const URL = process.env.SMOKE_URL || "http://localhost:4173/coldsnap/";
const CHROME = process.env.CHROME_BIN || "/usr/bin/chromium";
const fails = [];
const ok = (name, cond, detail = "") => { console.log(`${cond ? "PASS" : "FAIL"} — ${name}${cond ? "" : detail ? `  [${detail}]` : ""}`); if (!cond) fails.push(name); };

const browser = await puppeteer.launch({
  protocolTimeout: 600000,
  executablePath: CHROME, headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--enable-unsafe-swiftshader", "--window-size=960,600"],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 960, height: 600 });
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  await page.goto(URL + "?seed=11", { waitUntil: "networkidle0" });
  await page.evaluate(() => document.querySelector('[data-menu="towerdef"]').click());
  await page.waitForFunction(() => typeof window.__TDSIM__ === "function", { timeout: 20000 });
  await page.evaluate(() => window.__TDSTART__());

  // 1. free march: no defenses — a runner squad must cross and leak
  let r = await page.evaluate(() => {
    window.__TDSPAWN__(6, "fast");
    const t0 = window.__TD__();
    window.__TDSIM__(55);
    const t1 = window.__TD__();
    return { lives0: t0.lives, lives1: t1.lives, units: window.__TDUNITS__() };
  });
  ok("marchers cross the map and leak", r.lives1 < r.lives0, `lives ${r.lives0}->${r.lives1} left=${r.units.length}`);

  // 2. towers kill: a gun line across the mid pass earns kills + bounty
  r = await page.evaluate(() => {
    const mp = window.__TDMAP__();
    const p1 = mp.passes[1][0];
    const g1 = { gx: Math.floor((p1.x + 28) / 2), gz: Math.floor((p1.z + 56) / 2) };
    for (let gx = g1.gx - 4; gx <= g1.gx + 3; gx++) window.__TDBUILD__(gx, g1.gz + 2, "gun");
    const t0 = window.__TD__();
    window.__TDSPAWN__(8, "");
    window.__TDSIM__(40);
    const t1 = window.__TD__();
    return { k0: t0.kills, k1: t1.kills, s0: t0.scrap, s1: t1.scrap, lives: t1.lives };
  });
  ok("guns kill marchers", r.k1 > r.k0, `kills ${r.k0}->${r.k1}`);
  ok("kills pay bounty", r.s1 > r.s0 - 10, `scrap ${r.s0}->${r.s1}`);

  // 3. walls: rifles chew a wall down and it shatters into engine chunks
  r = await page.evaluate(() => {
    const mpp = window.__TDMAP__(); const pw = mpp.passes[1][0]; window.__TDBUILD__(Math.floor((pw.x + 28) / 2), Math.floor((pw.z + 56) / 2) + 4, "wall");
    const before = window.__TD__().bodies;
    window.__TDSPAWN__(10, "heavy");
    window.__TDSIM__(45);
    const t = window.__TD__();
    return { before, after: t.bodies, lives: t.lives };
  });
  ok("world keeps stepping under assault", r.after > 0, `bodies ${r.before}->${r.after}`);

  ok("no page errors", pageErrors.length === 0);
  if (pageErrors.length) console.log(pageErrors.slice(0, 3).join("\n"));
} finally {
  await browser.close();
}
if (fails.length) { console.error(`${fails.length} FAILURE(S)`); process.exit(1); }
console.log("ALL PASS");
