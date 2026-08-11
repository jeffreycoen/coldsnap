import puppeteer from "puppeteer-core";
import { spawn } from "child_process";

const srv = spawn("npm", ["run", "preview"], { cwd: "/home/batman/coldsnap", stdio: "ignore" });
await new Promise((r) => setTimeout(r, 2500));
const URL = "https://jeffreycoen.github.io/coldsnap/?seed=11";
const browser = await puppeteer.launch({
  protocolTimeout: 600000,
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--enable-unsafe-swiftshader", "--window-size=960,600"],
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  page.on("console", (m) => { if (m.text().startsWith("[diag]")) console.log(m.text()); });
  page.on("pageerror", (e) => console.log("PAGEERR", String(e)));
  await page.goto(URL, { waitUntil: "networkidle0" });
  await page.evaluate(() => localStorage.setItem("coldsnap-screen", "menu"));
  await page.goto(URL, { waitUntil: "networkidle0" });
  await page.evaluate(() => document.querySelector('[data-menu="depot"]').click());
  await page.waitForFunction(() => typeof window.__DEPOT__ === "function", { timeout: 20000 });
  await page.evaluate(() => window.__DEPOTSTART__());
  await page.waitForFunction(() => window.__DEPOT__().t > 0.2, { timeout: 10000 });

  // build-bar buttons
  const bar = await page.evaluate(() => [...document.querySelectorAll("button")].map((b) => b.textContent.trim()));
  console.log("buttons:", JSON.stringify(bar));

  const tapCanvas = async (sx, sy) => {
    const el = await page.evaluate((p) => {
      const e = document.elementFromPoint(p.sx, p.sy);
      return e ? e.tagName + "|" + (e.getAttribute && (e.getAttribute("data-tower-key") || e.getAttribute("data-menu") || e.className || "")) + "|z=" + getComputedStyle(e).zIndex + "|pe=" + getComputedStyle(e).pointerEvents : "NONE";
    }, { sx, sy });
    console.log("  elementFromPoint:", el);
    await page.touchscreen.tap(sx, sy);
  };

  const tryMode = async (label, expectFn) => {
    // click build-bar button by label
    const rect = await page.evaluate((L) => {
      const b = document.querySelector(`[data-tower-key="${L}"]`);
      if (!b) return null;
      const r = b.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height };
    }, label);
    if (rect) {
      const hit = await page.evaluate((p) => { const e = document.elementFromPoint(p.x, p.y); return e ? e.tagName + "|" + (e.closest("[data-tower-key]") ? e.closest("[data-tower-key]").getAttribute("data-tower-key") : "not-slot") : "NONE"; }, rect);
      console.log("  slot rect:", JSON.stringify(rect), "hit:", hit);
      await page.touchscreen.tap(rect.x, rect.y);
      await sleep(200);
      console.log("  mode now:", await page.evaluate("(()=>{const d=document.querySelector('[data-tower-key]'); return 'n/a';})()"));
    }
    const clicked = !!rect;
    if (!clicked) { console.log(`${label}: BUTTON NOT FOUND`); return; }
    await sleep(300);
    const cell = await page.evaluate(() => window.__DEPOTFINDBUILDABLE__());
    await page.evaluate((c) => window.__DEPOTFOCUS__(c.x, c.z), cell);
    await sleep(800);
    const scr = await page.evaluate((c) => window.__DEPOTSCREENAT__(c.x, c.z), cell);
    const before = await page.evaluate(expectFn);
    await tapCanvas(scr.x, scr.y);
    await sleep(600);
    const after = await page.evaluate(expectFn);
    const toast = await page.evaluate(() => document.body.innerText.match(/CAN'T|NEED|OFF THE|OCCUPIED|ICE|HELD|NOT YOURS|SCRAP/i)?.[0] || null);
    console.log(`${label}: cell=${JSON.stringify(cell)} scr=${JSON.stringify(scr)} before=${JSON.stringify(before)} after=${JSON.stringify(after)} toast=${toast}`);
  };

  // refusal path: sandbag on enemy-held far ground -> expect toast
  await page.evaluate(() => document.querySelector('[data-tower-key="sandbag"]').click());
  await sleep(200);
  // enemy side: mirror of depot side; use a far cell
  const flags = await page.evaluate("window.__DEPOTFLAGS__()");
  console.log("flags:", JSON.stringify(flags));
  const enemyFlag = flags[flags.length - 1];
  await page.evaluate((c) => window.__DEPOTFOCUS__(c.x, c.z), enemyFlag);
  await sleep(800);
  const scr = await page.evaluate((c) => window.__DEPOTSCREENAT__(c.x + 4, c.z + 4), enemyFlag);
  await page.touchscreen.tap(scr.x, scr.y);
  await sleep(400);
  const txt = await page.evaluate("document.body.innerText");
  console.log("toast-ish lines:", JSON.stringify(txt.split("\n").filter((l) => /[A-Z]{3,}/.test(l) && l.length < 40).slice(0, 20)));
  console.log("sandbags:", await page.evaluate("window.__DEPOTSANDBAGS__().length"));
  const cell2 = await page.evaluate(() => window.__DEPOTFINDBUILDABLE__());
  await page.evaluate((c) => window.__DEPOTFOCUS__(c.x, c.z), cell2);
  await sleep(800);
  const scr2 = await page.evaluate((c) => window.__DEPOTSCREENAT__(c.x, c.z), cell2);
  await page.touchscreen.tap(scr2.x, scr2.y);
  await sleep(400);
  console.log("LIVE held-ground sandbag count:", await page.evaluate("window.__DEPOTSANDBAGS__().length"));
} finally {
  await browser.close();
  srv.kill();
}
