// Q: probe why the hard-over pivot never engages under march.
import puppeteer from "puppeteer-core";
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
await phone.touchscreen.touchStart(86, 260);
await phone.touchscreen.touchMove(86, 224);
await sleep(5000);
await phone.touchscreen.touchStart(758, 260);
await phone.touchscreen.touchMove(794, 260);
for (let i = 0; i < 10; i++) {
  await sleep(400);
  console.log(JSON.stringify(await phone.evaluate(() => window.__MECHRANGE__.dbg())));
}
await phone.touchscreen.touchEnd();
await browser.close();
