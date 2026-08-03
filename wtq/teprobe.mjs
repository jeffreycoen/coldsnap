// Q: do native touch events fire under CDP Input.dispatchTouchEvent?
import puppeteer from "puppeteer-core";
import { makeMT } from "./mt.mjs";
const browser = await puppeteer.launch({ protocolTimeout: 600000, executablePath: "/usr/bin/chromium", headless: true, args: ["--no-sandbox", "--disable-gpu", "--enable-unsafe-swiftshader"] });
const phone = await browser.newPage();
await phone.emulate({ viewport: { width: 844, height: 390, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, userAgent: "Mozilla/5.0 (iPhone)" });
await phone.goto("http://localhost:4179/coldsnap/", { waitUntil: "networkidle0" });
await phone.evaluate(() => {
  window.__EV = { ts: 0, te: 0, pu: [], pd: [] };
  window.addEventListener("touchstart", () => window.__EV.ts++);
  window.addEventListener("touchend", (e) => { window.__EV.te++; window.__EV.teLen = e.touches.length; });
  window.addEventListener("pointerdown", (e) => window.__EV.pd.push(e.pointerId));
  window.addEventListener("pointerup", (e) => window.__EV.pu.push(e.pointerId));
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const mt = await makeMT(phone);
await mt.start(1, 100, 200);
await sleep(150);
await mt.start(2, 700, 200);
await sleep(150);
await mt.end(2);
await sleep(150);
await mt.end(1);
await sleep(300);
console.log(JSON.stringify(await phone.evaluate(() => window.__EV)));
await browser.close();
