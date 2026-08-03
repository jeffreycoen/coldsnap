// Q: ONE LEG isolated — proper timing, at the game's pi heading.
import puppeteer from "puppeteer-core";
const browser = await puppeteer.launch({ protocolTimeout: 600000, executablePath: "/usr/bin/chromium", headless: true, args: ["--no-sandbox", "--disable-gpu", "--enable-unsafe-swiftshader"] });
const phone = await browser.newPage();
await phone.emulate({ viewport: { width: 844, height: 390, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, userAgent: "Mozilla/5.0 (iPhone)" });
await phone.goto("http://localhost:4179/coldsnap/", { waitUntil: "networkidle0" });
await phone.evaluate(() => localStorage.setItem("coldsnap-screen", "menu"));
await phone.reload({ waitUntil: "networkidle0" });
await phone.waitForSelector('[data-menu="mech"]', { timeout: 15000 });
await phone.tap('[data-menu="mech"]');
await phone.waitForSelector("[data-mech-poise]", { timeout: 20000 });
await phone.waitForFunction(() => window.__MECHRANGE__ && window.__MECHRANGE__.mech.hull.R[4] > 0.9, { timeout: 20000, polling: 500 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(4000); // full settle
await phone.tap("[data-mech-poise]");
let held = 0, fell = false;
for (let i = 0; i < 60; i++) {
  await sleep(1000);
  const s = await phone.evaluate(() => {
    const m = window.__MECHRANGE__.mech;
    const p = m.state.poise;
    return { ph: p ? p.phase : null, mode: m.state.mode, r4: +m.hull.R[4].toFixed(3) };
  });
  if (i % 5 === 0) console.log(i + "s", JSON.stringify(s));
  if (s.ph === "hold") held++;
  if (s.mode === "FALLEN") { fell = true; break; }
  if (held > 0 && !s.ph) break; // completed + lowered
}
console.log(fell ? "FELL" : held > 0 ? "HELD " + held + "s (wall) then lowered" : "never reached hold");
await browser.close();
