import puppeteer from "puppeteer-core";
import { spawn } from "child_process";
const srv = spawn("npm", ["run", "preview"], { cwd: "/home/batman/coldsnap", stdio: "ignore" });
await new Promise((r) => setTimeout(r, 2500));
const browser = await puppeteer.launch({ protocolTimeout: 600000, executablePath: "/usr/bin/chromium", headless: true, args: ["--no-sandbox", "--disable-gpu", "--enable-unsafe-swiftshader", "--window-size=960,600"] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 960, height: 600 });
  page.on("console", (m) => { if (m.text().startsWith("[diag]")) console.log(m.text()); });
  page.on("pageerror", (e) => console.log("PAGEERR", String(e)));
  await page.goto("http://localhost:4173/coldsnap/?seed=11", { waitUntil: "networkidle0" });
  await page.evaluate(() => localStorage.setItem("coldsnap-screen", "menu"));
  await page.goto("http://localhost:4173/coldsnap/?seed=11", { waitUntil: "networkidle0" });
  await page.evaluate(() => document.querySelector('[data-menu="depot"]').click());
  await page.waitForFunction(() => typeof window.__DEPOT__ === "function", { timeout: 20000 });
  await page.evaluate(() => window.__DEPOTSTART__());
  await page.waitForFunction(() => window.__DEPOT__().t > 0.2, { timeout: 10000 });
  const cell = await page.evaluate(() => window.__DEPOTFINDBUILDABLE__());
  await page.evaluate(() => document.querySelector('[data-tower-key="sq_sniper"]').click());
  await page.evaluate((c) => window.__DEPOTFOCUS__(c.x, c.z), cell);
  await sleep(800);
  const scr = await page.evaluate((c) => window.__DEPOTSCREENAT__(c.x, c.z), cell);
  await page.touchscreen.tap(scr.x, scr.y);
  await sleep(2000); // well past 350ms arming
  const armState = await page.evaluate(() => {
    const b = document.querySelector("[data-pending-confirm]");
    return b ? { present: true, opacity: getComputedStyle(b).opacity, t: window.__DEPOT__().t } : { present: false };
  });
  console.log("confirm button:", JSON.stringify(armState));
  await page.evaluate("document.querySelector('[data-pending-confirm]').click()");
  await sleep(500);
  console.log("squads after confirm:", await page.evaluate("window.__DEPOTSQUADS__().length"));
  console.log("confirm still present:", await page.evaluate("!!document.querySelector('[data-pending-confirm]')"));
} finally { await browser.close(); srv.kill(); }
