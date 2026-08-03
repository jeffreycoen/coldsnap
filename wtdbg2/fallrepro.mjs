// Reproduce the audit fall: hard stick turn then immediate aim-arrow hold.
import puppeteer from "puppeteer-core";
const URL = "http://localhost:4174/coldsnap/";
const browser = await puppeteer.launch({ protocolTimeout: 600000, executablePath: "/usr/bin/chromium", headless: true, args: ["--no-sandbox", "--disable-gpu", "--enable-unsafe-swiftshader"] });
const phone = await browser.newPage();
await phone.emulate({ viewport: { width: 844, height: 390, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, userAgent: "Mozilla/5.0 (iPhone)" });
await phone.goto(URL, { waitUntil: "networkidle0" });
await phone.evaluate(() => localStorage.setItem("coldsnap-screen", "menu"));
await phone.reload({ waitUntil: "networkidle0" });
await phone.waitForSelector('[data-menu="mech"]', { timeout: 15000 });
await phone.tap('[data-menu="mech"]');
await phone.waitForSelector("[data-mech-about]", { timeout: 20000 });
await phone.waitForFunction(() => window.__MECHRANGE__ && window.__MECHRANGE__.mech.hull.R[4] > 0.9, { timeout: 20000, polling: 500 });
await new Promise((r) => setTimeout(r, 1500));
const S = () => phone.evaluate(() => { const m = window.__MECHRANGE__.mech; return { mode: m.state.mode, af: String(m.state.aboutFace || "-"), r4: +m.hull.R[4].toFixed(3), yaw: +Math.atan2(m.hull.R[6], m.hull.R[8]).toFixed(2) }; });
// hard right-stick turn 3.5s
await phone.touchscreen.touchStart(758, 260); await phone.touchscreen.touchMove(722, 260);
await new Promise((r) => setTimeout(r, 3500));
await phone.touchscreen.touchEnd();
console.log("after turn:", JSON.stringify(await S()));
// immediate aim-arrow hold 0.7s
const box = await phone.evaluate(() => { const b2 = document.querySelector("[data-mech-aiml]").getBoundingClientRect(); return { x: b2.x + b2.width / 2, y: b2.y + b2.height / 2 }; });
await phone.touchscreen.touchStart(box.x, box.y);
await new Promise((r) => setTimeout(r, 700));
await phone.touchscreen.touchEnd();
console.log("after aim:", JSON.stringify(await S()));
for (let i = 0; i < 10; i++) {
  await new Promise((r) => setTimeout(r, 600));
  const s = await S();
  console.log((i * 0.6 + 0.6).toFixed(1) + "s:", JSON.stringify(s));
  if (s.mode === "FALLEN") break;
}
await browser.close();
