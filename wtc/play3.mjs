// C: 180 truth check by yaw + ONE LEG label reset
import puppeteer from "puppeteer-core";
const browser = await puppeteer.launch({ protocolTimeout: 600000, executablePath: "/usr/bin/chromium", headless: true, args: ["--no-sandbox", "--disable-gpu", "--enable-unsafe-swiftshader"] });
const phone = await browser.newPage();
await phone.emulate({ viewport: { width: 844, height: 390, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, userAgent: "Mozilla/5.0 (iPhone)" });
await phone.goto("http://localhost:4179/coldsnap/", { waitUntil: "networkidle0" });
await phone.evaluate(() => localStorage.setItem("coldsnap-screen", "menu"));
await phone.reload({ waitUntil: "networkidle0" });
await phone.waitForSelector('[data-menu="mech"]', { timeout: 15000 });
await phone.tap('[data-menu="mech"]');
await phone.waitForSelector("[data-mech-about]", { timeout: 20000 });
await phone.waitForFunction(() => window.__MECHRANGE__ && window.__MECHRANGE__.mech.hull.R[4] > 0.9, { timeout: 20000, polling: 500 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const yaw = () => phone.evaluate(() => Math.atan2(window.__MECHRANGE__.mech.hull.R[6], window.__MECHRANGE__.mech.hull.R[8]));
await sleep(1200);
const y0 = await yaw();
const st0 = await phone.evaluate(() => { const s = window.__MECHRANGE__.mech.state; return { af: s.aboutFace || null }; });
await phone.tap("[data-mech-about]");
await sleep(500);
const st1 = await phone.evaluate(() => { const s = window.__MECHRANGE__.mech.state; return { af: s.aboutFace || null, headingT: s.headingT.toFixed(2), heading: s.heading.toFixed(2) }; });
console.log("pre-tap af:", st0.af, "| post-tap:", JSON.stringify(st1), "| y0", y0.toFixed(2));
for (let i = 0; i < 12; i++) {
  await sleep(5000);
  const y = await yaw();
  let d = y - y0 - Math.PI;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  const s = await phone.evaluate(() => { const st = window.__MECHRANGE__.mech.state; return (st.aboutFace || "-") + " " + st.mode; });
  console.log(((i + 1) * 5) + "s wall: err " + Math.abs(d).toFixed(2) + " (" + s + ")");
  if (Math.abs(d) < 0.2) { console.log("180 COMPLETE"); break; }
}
await browser.close();
