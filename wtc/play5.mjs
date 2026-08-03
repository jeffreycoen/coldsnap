// C: final pass — jets burst + heat tint, gyro-off save, reissue; desktop keys
import puppeteer from "puppeteer-core";
const browser = await puppeteer.launch({ protocolTimeout: 600000, executablePath: "/usr/bin/chromium", headless: true, args: ["--no-sandbox", "--disable-gpu", "--enable-unsafe-swiftshader"] });
const phone = await browser.newPage();
await phone.emulate({ viewport: { width: 844, height: 390, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, userAgent: "Mozilla/5.0 (iPhone)" });
await phone.goto("http://localhost:4179/coldsnap/", { waitUntil: "networkidle0" });
await phone.evaluate(() => localStorage.setItem("coldsnap-screen", "menu"));
await phone.reload({ waitUntil: "networkidle0" });
await phone.waitForSelector('[data-menu="mech"]', { timeout: 15000 });
await phone.tap('[data-menu="mech"]');
await phone.waitForSelector("[data-mech-jets]", { timeout: 20000 });
await phone.waitForFunction(() => window.__MECHRANGE__ && window.__MECHRANGE__.mech.hull.R[4] > 0.9, { timeout: 20000, polling: 500 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(1200);
// jets burst: toggle, burn 3s via API-injected stick (single-touch is fine here)
await phone.tap("[data-mech-jets]");
await sleep(300);
await phone.touchscreen.touchStart(758, 260);
await phone.touchscreen.touchMove(758, 226);
await sleep(3000);
const heat = await phone.evaluate(() => (window.__MECHRANGE__.mech.jetHeat || 0).toFixed(2));
await phone.screenshot({ path: "wtc/p5-jets.png" });
await phone.touchscreen.touchEnd();
console.log("jets burn heat:", heat, "mode:", await phone.evaluate(() => window.__MECHRANGE__.mech.state.mode));
await phone.tap("[data-mech-jets]");
await sleep(2500);
// gyro-off + shove save
await phone.tap("[data-mech-gyro]");
await sleep(300);
await phone.evaluate(() => { const m = window.__MECHRANGE__.mech; m.hull.v.x += 30000 / m.hull.mass; });
await sleep(4000);
console.log("gyro-off 30k shove:", await phone.evaluate(() => window.__MECHRANGE__.mech.state.mode + " R4 " + window.__MECHRANGE__.mech.hull.R[4].toFixed(3)));
await phone.tap("[data-mech-gyro]");
// reissue
await phone.tap("[data-mech-reissue]");
await sleep(2500);
console.log("reissue:", await phone.evaluate(() => window.__MECHRANGE__.mech.state.mode + " @z " + window.__MECHRANGE__.mech.hull.pos.z.toFixed(0)));
await browser.close();
// desktop keys
const b2 = await puppeteer.launch({ protocolTimeout: 600000, executablePath: "/usr/bin/chromium", headless: true, args: ["--no-sandbox", "--disable-gpu", "--enable-unsafe-swiftshader"] });
const page = await b2.newPage();
await page.setViewport({ width: 960, height: 600 });
await page.goto("http://localhost:4179/coldsnap/", { waitUntil: "networkidle0" });
await page.evaluate(() => localStorage.setItem("coldsnap-screen", "menu"));
await page.reload({ waitUntil: "networkidle0" });
await page.waitForSelector('[data-menu="mech"]', { timeout: 15000 });
await page.evaluate(() => document.querySelector('[data-menu="mech"]').click());
await page.waitForSelector("[data-mech-about]", { timeout: 20000 });
await page.waitForFunction(() => window.__MECHRANGE__ && window.__MECHRANGE__.mech.hull.R[4] > 0.9, { timeout: 20000, polling: 500 });
await sleep(1000);
const keys = [["KeyG", () => window.__MECHRANGE__.mech.gyroOn === false], ["KeyH", () => !window.__MECHRANGE__.mech.thrustersOn], ["KeyJ", () => true], ["KeyC", () => window.__MECHRANGE__.mech.state.puntReq > 0 || window.__MECHRANGE__.mech.state.kick != null]];
for (const [code, chk] of keys) {
  await page.keyboard.press(code === "KeyG" ? "g" : code === "KeyH" ? "h" : code === "KeyJ" ? "j" : "c");
  await sleep(400);
  console.log("key", code + ":", await page.evaluate(chk) ? "EFFECT" : "no effect");
}
await b2.close();
