// Q: max-stress pivot-from-march, CORRECT multi-touch (raw CDP, LIFO release).
import puppeteer from "puppeteer-core";
import { makeMT } from "./mt.mjs";
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
const mt = await makeMT(phone);
let falls = 0;
for (let run = 1; run <= N; run++) {
  await phone.evaluate(() => window.__MECHRANGE__.reissue());
  await sleep(2500);
  const falls0 = await phone.evaluate(() => window.__MECHRANGE__.mech.telem.falls);
  await mt.start(1, 86, 260);
  await mt.move(1, 86, 224);           // march full forward
  await sleep(5000);
  await mt.start(2, 758, 260);
  await mt.move(2, 794, 260);          // hard-over right: pivot
  await sleep(3500);
  await mt.end(2);                     // LIFO release
  await sleep(1500);
  await mt.start(2, 758, 260);
  await mt.move(2, 722, 260);          // hard-over left: pivot the other way
  await sleep(3500);
  await mt.end(2);
  await mt.end(1);
  await sleep(2500);
  const st = await phone.evaluate(() => ({ mode: window.__MECHRANGE__.mech.state.mode, falls: window.__MECHRANGE__.mech.telem.falls }));
  const fell = st.falls > falls0 || st.mode === "FALLEN";
  if (fell) falls++;
  console.log("run", run + ":", fell ? "FELL" : "clean", "(" + st.mode + ")");
}
console.log("RESULT:", (N - falls) + "/" + N, "clean");
await browser.close();
