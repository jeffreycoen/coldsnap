// Q: trace the double-pivot-under-march death — CORRECT multi-touch.
import puppeteer from "puppeteer-core";
import { makeMT } from "./mt.mjs";
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
await phone.evaluate(() => {
  const m = window.__MECHRANGE__.mech;
  window.__TRACE__ = [];
  const t0 = performance.now();
  window.__TRACEIV__ = setInterval(() => {
    const st = m.state;
    const d = window.__MECHRANGE__.dbg();
    window.__TRACE__.push({
      t: +((performance.now() - t0) / 1000).toFixed(1),
      mode: st.mode, af: st.aboutFace || 0, live: !!st.afLive,
      r4: +m.hull.R[4].toFixed(3), v: +Math.hypot(m.hull.v.x, m.hull.v.z).toFixed(2),
      rec: +(st.recoverT || 0).toFixed(1), cmdF: +st.cmdT.f.toFixed(2),
      rx: +d.rx.toFixed(2), cad: +(st.cadence || 1).toFixed(2),
    });
    if (st.mode === "FALLEN") clearInterval(window.__TRACEIV__);
  }, 200);
});
const mt = await makeMT(phone);
await mt.start(1, 86, 260);
await mt.move(1, 86, 224);
await sleep(5000);
await mt.start(2, 758, 260);
await mt.move(2, 794, 260);
await sleep(3500);
await mt.end(2);
await sleep(1500);
await mt.start(2, 758, 260);
await mt.move(2, 722, 260);
await sleep(3500);
await mt.end(2);
await mt.end(1);
await sleep(2500);
const tr = await phone.evaluate(() => { clearInterval(window.__TRACEIV__); return window.__TRACE__; });
const fellIx = tr.findIndex((s) => s.mode === "FALLEN");
const from = fellIx < 0 ? Math.max(0, tr.length - 12) : Math.max(0, fellIx - 22);
for (const s of tr.slice(from, fellIx < 0 ? tr.length : fellIx + 1)) console.log(JSON.stringify(s));
await browser.close();
