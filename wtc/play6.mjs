// C: jets burn — API path vs touch path
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
// API: force jetCmd directly
await phone.evaluate(() => { window.__MECHRANGE__.jets(); });
await sleep(200);
await phone.evaluate(() => { window.__MECHRANGE__.mech.jetCmd = { x: 0, z: 0.8 }; });
await sleep(1500);
const a = await phone.evaluate(() => { const m = window.__MECHRANGE__.mech; return { burn: Math.max(...m.thrusters.map(t => t.cur)).toFixed(2), heat: (m.jetHeat || 0).toFixed(2) }; });
console.log("API jetCmd:", JSON.stringify(a));
await phone.evaluate(() => { window.__MECHRANGE__.mech.jetCmd = null; });
await sleep(1500);
// touch: tap toggle is already ON; grab the right stick
const grabbed = await phone.evaluate(() => null);
await phone.touchscreen.touchStart(758, 260);
await sleep(200);
const g1 = await phone.evaluate(() => window.__MECHRANGE__.dbg ? window.__MECHRANGE__.dbg() : "no-dbg");
await phone.touchscreen.touchMove(758, 226);
await sleep(1200);
const t = await phone.evaluate(() => { const m = window.__MECHRANGE__.mech; return { jc: m.jetCmd ? m.jetCmd.x.toFixed(2) + "," + m.jetCmd.z.toFixed(2) : null, burn: Math.max(...m.thrusters.map(x => x.cur)).toFixed(2) }; });
await phone.touchscreen.touchEnd();
console.log("touch grab state:", JSON.stringify(g1).slice(0, 200));
console.log("touch jetCmd:", JSON.stringify(t));
await browser.close();
