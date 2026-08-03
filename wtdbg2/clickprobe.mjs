// Desktop click-fire probe: does mousedown reach onPD and fire?
import puppeteer from "puppeteer-core";
const URL = "http://localhost:4174/coldsnap/";
const browser = await puppeteer.launch({ protocolTimeout: 600000, executablePath: "/usr/bin/chromium", headless: true, args: ["--no-sandbox", "--disable-gpu", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage();
await page.setViewport({ width: 960, height: 600 });
await page.goto(URL, { waitUntil: "networkidle0" });
await page.evaluate(() => localStorage.setItem("coldsnap-screen", "menu"));
await page.reload({ waitUntil: "networkidle0" });
await page.waitForSelector('[data-menu="mech"]', { timeout: 15000 });
await page.evaluate(() => document.querySelector('[data-menu="mech"]').click());
await page.waitForSelector("[data-mech-about]", { timeout: 20000 });
await page.waitForFunction(() => window.__MECHRANGE__ && window.__MECHRANGE__.mech.hull.R[4] > 0.9, { timeout: 20000, polling: 500 });
await new Promise((r) => setTimeout(r, 1200));
await page.evaluate(() => {
  window.__PDLOG__ = [];
  window.addEventListener("pointerdown", (e) => window.__PDLOG__.push({ type: e.pointerType, tgt: e.target.tagName }), true);
});
await page.mouse.click(480, 300);
await new Promise((r) => setTimeout(r, 600));
const out = await page.evaluate(() => ({ log: window.__PDLOG__, shots: window.__MECHRANGE__.mech.telem.shots || 0, mode: window.__MECHRANGE__.mech.state.mode, spawnDone: window.__MECHRANGE__.mech.state.spawnDone }));
console.log(JSON.stringify(out));
await browser.close();
