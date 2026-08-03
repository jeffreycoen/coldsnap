// Q: plain full-forward march probe — where does browser speed come from?
import puppeteer from "puppeteer-core";
import { makeMT } from "./mt.mjs";
const browser = await puppeteer.launch({ protocolTimeout: 600000, executablePath: "/usr/bin/chromium", headless: true, args: ["--no-sandbox", "--disable-gpu", "--enable-unsafe-swiftshader"] });
const phone = await browser.newPage();
await phone.emulate({ viewport: { width: 844, height: 390, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, userAgent: "Mozilla/5.0 (iPhone)" });
await phone.goto("http://localhost:4179/coldsnap/", { waitUntil: "networkidle0" });
await phone.evaluate(() => localStorage.setItem("coldsnap-screen", "menu"));
await phone.reload({ waitUntil: "networkidle0" });
await phone.waitForSelector('[data-menu="mech"]', { timeout: 15000 });
await phone.tap('[data-menu="mech"]');
await phone.waitForSelector("[data-mech-reissue]", { timeout: 20000 });
await phone.waitForFunction(() => window.__MECHRANGE__ && window.__MECHRANGE__.mech.hull.R[4] > 0.9, { timeout: 20000, polling: 500 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const mt = await makeMT(phone);
await mt.start(1, 86, 260);
await mt.move(1, 86, 224);
for (let i = 0; i < 12; i++) {
  await sleep(700);
  const d = await phone.evaluate(() => {
    const m = window.__MECHRANGE__.mech;
    const x = window.__MECHRANGE__.dbg();
    x.v = +Math.hypot(m.hull.v.x, m.hull.v.z).toFixed(2);
    x.mode = m.state.mode;
    return x;
  });
  console.log(JSON.stringify(d));
}
await mt.end(1);
await browser.close();
