import puppeteer from "puppeteer-core";
import { spawn } from "child_process";
import fs from "fs";
const srv = spawn("npm", ["run", "preview"], { cwd: "/home/batman/coldsnap", stdio: "ignore" });
await new Promise((r) => setTimeout(r, 3000));
const URL = "http://localhost:4173/coldsnap/?seed=11";
const browser = await puppeteer.launch({ protocolTimeout: 600000, executablePath: "/usr/bin/chromium", headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--enable-unsafe-swiftshader", "--window-size=960,600"] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  page.on("pageerror", (e) => console.log("PAGEERR", String(e)));
  await page.goto(URL, { waitUntil: "networkidle0" });
  await page.evaluate(() => localStorage.setItem("coldsnap-screen", "menu"));
  await page.goto(URL, { waitUntil: "networkidle0" });
  await page.evaluate(() => document.querySelector('[data-menu="depot"]').click());
  await page.waitForFunction(() => typeof window.__DEPOT__ === "function", { timeout: 20000 });
  await page.evaluate(() => window.__DEPOTSTART__());
  await page.waitForFunction(() => window.__DEPOT__().t > 0.2, { timeout: 10000 });

  const chunks = await page.evaluate(() => {
    const w = window.__DEPOT__().world || null; return null;
  });
  await page.evaluate(() => document.querySelector('[data-tower-key="sandbag"]').click());
  await sleep(200);
  const cell = await page.evaluate(() => window.__DEPOTFINDBUILDABLE__(6));
  await page.evaluate((c) => window.__DEPOTFOCUS__(c.x, c.z), cell);
  await sleep(900);
  const scr = await page.evaluate((c) => window.__DEPOTSCREENAT__(c.x, c.z), cell);
  await page.screenshot({ path: "/home/batman/coldsnap/.superpowers/sb-before.png" });
  await page.touchscreen.tap(scr.x, scr.y);
  await sleep(900);
  const bags = await page.evaluate(() => window.__DEPOTSANDBAGS__());
  console.log("CELL", JSON.stringify(cell), "SCR", JSON.stringify(scr));
  console.log("BAGS", JSON.stringify(bags));
  if (bags.length) {
    const b = bags[bags.length-1];
    await page.evaluate((c) => window.__DEPOTFOCUS__(c.x, c.z), b);
    await sleep(900);
    const s2 = await page.evaluate((c) => window.__DEPOTSCREENAT__(c.x, c.z), b);
    console.log("BAG SCR", JSON.stringify(s2));
    await page.evaluate(() => { const b=[...document.querySelectorAll('button')].find(x=>/PAUSE|❚❚|\u275a/i.test(x.textContent)); if(b) b.click(); });
    await sleep(600);
    await page.screenshot({ path: "/home/batman/coldsnap/.superpowers/sb-cap1000.png" });
    await page.evaluate(() => { globalThis.__DIAGCAP__ = 4000; });
    await sleep(700);
    await page.screenshot({ path: "/home/batman/coldsnap/.superpowers/sb-cap4000.png" });
  }
  // renderer instrumentation: chunk body count vs drawn
  const dbg = await page.evaluate(() => window.__DIAGCHUNK__ || null);
  console.log("DIAGCHUNK", JSON.stringify(dbg));
} finally { await browser.close(); srv.kill("SIGTERM"); try{spawn("pkill",["-f","vite preview"]);}catch{} }
