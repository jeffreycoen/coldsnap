// C: ONE LEG label lifecycle with a patient window
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
const label = () => phone.evaluate(() => document.querySelector("[data-mech-poise]").textContent.trim());
await sleep(1200);
await phone.tap("[data-mech-poise]");
await sleep(4000);
console.log("held:", await label(), await phone.evaluate(() => window.__MECHRANGE__.mech.state.poise ? window.__MECHRANGE__.mech.state.poise.phase : "-"));
await phone.tap("[data-mech-poise]");
for (let i = 0; i < 20; i++) {
  await sleep(1000);
  const l = await label();
  const ph = await phone.evaluate(() => window.__MECHRANGE__.mech.state.poise ? window.__MECHRANGE__.mech.state.poise.phase : "-");
  if (l === "ONE LEG") { console.log("label reset after ~" + (i + 1) + "s wall (phase " + ph + ")"); break; }
  if (i === 19) console.log("label STUCK at", l, "phase", ph);
}
await browser.close();
