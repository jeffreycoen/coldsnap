// Browser turn ensemble: N repetitions of stand -> hard turn -> release -> settle.
// Samples af/mode/R4 at 5Hz; dumps the last 4s on any fall.
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
await phone.evaluate(() => {
  const m = window.__MECHRANGE__.mech;
  window.__RING__ = [];
  window.__FROZE__ = false;
  setInterval(() => {
    if (window.__FROZE__) return;
    window.__RING__.push({ t: +(performance.now() / 1000).toFixed(1), mode: m.state.mode, af: String(m.state.aboutFace || "-"), r4: +m.hull.R[4].toFixed(3), rec: +(m.state.recoverT || 0).toFixed(1), hdgT: +m.state.headingT.toFixed(2), hdg: +m.state.heading.toFixed(2), yaw: +Math.atan2(m.hull.R[6], m.hull.R[8]).toFixed(2) });
    if (m.state.mode === "FALLEN") window.__FROZE__ = true; // freeze the ring AT the fall
    if (window.__RING__.length > 24) window.__RING__.shift();
  }, 200);
});
let falls = 0;
for (let rep = 0; rep < 6; rep++) {
  const dir = rep % 2 === 0 ? -36 : 36;
  await phone.touchscreen.touchStart(758, 260);
  await phone.touchscreen.touchMove(758 + dir, 260);
  await new Promise((r) => setTimeout(r, 3500));
  await phone.touchscreen.touchEnd();
  await new Promise((r) => setTimeout(r, 8000));
  const s = await phone.evaluate(() => ({ mode: window.__MECHRANGE__.mech.state.mode, ring: window.__RING__.slice() }));
  if (s.mode === "FALLEN") {
    falls++;
    console.log("rep", rep, "FELL; last 4s:");
    for (const r of s.ring) console.log(" ", JSON.stringify(r));
    await phone.evaluate(() => { window.__FROZE__ = false; window.__RING__.length = 0; });
    await phone.tap("[data-mech-reissue]");
    await new Promise((r) => setTimeout(r, 2500));
  } else console.log("rep", rep, "ok (" + s.mode + ")");
}
console.log("browser turn ensemble:", (6 - falls) + "/6 clean");
await browser.close();
