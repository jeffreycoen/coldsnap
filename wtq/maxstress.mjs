// Q item 1: max-stress pivot-from-march sequence, repeated. Baseline failure
// rate was ~1/3 of sequences (browser frame jitter). One sequence per REISSUE.
import puppeteer from "puppeteer-core";
const N = Number(process.argv[2] || 6);
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
let falls = 0;
for (let run = 1; run <= N; run++) {
  await phone.evaluate(() => window.__MECHRANGE__.reissue());
  await sleep(2500);
  const falls0 = await phone.evaluate(() => window.__MECHRANGE__.mech.telem.falls);
  // march full forward
  await phone.touchscreen.touchStart(86, 260);
  await phone.touchscreen.touchMove(86, 224);
  await sleep(5000);
  // hard-over right stick while still marching (pivot trigger)
  await phone.touchscreen.touchStart(758, 260);
  await phone.touchscreen.touchMove(794, 260);
  await sleep(3500);
  await phone.touchscreen.touchEnd(); // release right
  await sleep(1500);
  // hard-over the other way
  await phone.touchscreen.touchStart(758, 260);
  await phone.touchscreen.touchMove(722, 260);
  await sleep(3500);
  await phone.touchscreen.touchEnd();
  await phone.touchscreen.touchEnd(); // release left stick too
  await sleep(2500);
  const st = await phone.evaluate(() => ({ mode: window.__MECHRANGE__.mech.state.mode, falls: window.__MECHRANGE__.mech.telem.falls }));
  const fell = st.falls > falls0 || st.mode === "FALLEN";
  if (fell) falls++;
  console.log("run", run + ":", fell ? "FELL" : "clean", "(" + st.mode + ")");
}
console.log("RESULT:", (N - falls) + "/" + N, "clean");
await browser.close();
