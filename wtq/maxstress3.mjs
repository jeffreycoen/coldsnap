// Q: max-stress with per-phase sampling to localize the falls.
import puppeteer from "puppeteer-core";
import { makeMT } from "./mt.mjs";
const N = Number(process.argv[2] || 4);
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
const snap = async (tag) => {
  const s = await phone.evaluate(() => ({ mode: window.__MECHRANGE__.mech.state.mode, falls: window.__MECHRANGE__.mech.telem.falls, v: +Math.hypot(window.__MECHRANGE__.mech.hull.v.x, window.__MECHRANGE__.mech.hull.v.z).toFixed(2) }));
  return tag + ":" + s.mode + "/f" + s.falls + "/v" + s.v;
};
for (let run = 1; run <= N; run++) {
  await phone.evaluate(() => window.__MECHRANGE__.reissue());
  await sleep(2500);
  const parts = [await snap("spawn")];
  await mt.start(1, 86, 260);
  await mt.move(1, 86, 224);
  await sleep(5000);
  parts.push(await snap("march"));
  await mt.start(2, 758, 260);
  await mt.move(2, 794, 260);
  await sleep(3500);
  parts.push(await snap("pivR"));
  await mt.end(2);
  await sleep(1500);
  parts.push(await snap("gap"));
  await mt.start(2, 758, 260);
  await mt.move(2, 722, 260);
  await sleep(3500);
  parts.push(await snap("pivL"));
  await mt.end(2);
  await mt.end(1);
  await sleep(2500);
  parts.push(await snap("end"));
  console.log("run", run + ":", parts.join(" "));
}
await browser.close();
