// One-off: build a sandbag line in both orientations, screenshot -> sandbag-rot.png
import puppeteer from "puppeteer-core";
const CHROME = process.env.CHROME_BIN || "/usr/bin/chromium";
const URL = "http://localhost:4173/coldsnap/?seed=11";
const OUT = process.argv[2];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox", "--disable-gpu", "--enable-unsafe-swiftshader", "--window-size=960,600"] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 960, height: 600 });
  await page.goto(URL, { waitUntil: "networkidle0" });
  await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith("coldsnap-depot")) localStorage.removeItem(k); });
  await page.evaluate(() => document.querySelector('[data-menu="depot"]').click());
  await page.waitForFunction(() => typeof window.__DEPOT__ === "function", { timeout: 20000 });
  await page.evaluate(() => window.__DEPOTSTART__());
  await page.waitForFunction(() => window.__DEPOT__().t > 0.2, { timeout: 10000 });
  const cell = await page.evaluate(() => window.__DEPOTFINDBUILDABLE__(5));
  const settleAt = async (x, z, zoom) => {
    await page.evaluate((p) => window.__DEPOTFOCUS__(p.x, p.z, p.zoom || undefined), { x, z, zoom });
    await page.waitForFunction((p) => {
      const r = document.querySelector("canvas").getBoundingClientRect();
      const g = window.__DEPOTGROUNDAT__(r.left + r.width / 2, r.top + r.height / 2);
      return !!g && Math.hypot(g.x - p.x, g.z - p.z) < 1.0;
    }, { timeout: 8000, polling: 200 }, { x, z }).catch(() => {});
    await sleep(150);
  };
  const tapWorld = async (x, z) => {
    for (let i = 0; i < 20; i++) {
      const pt = await page.evaluate((p) => {
        const q = window.__DEPOTSCREENAT__(p.x, p.z);
        if (!q) return null;
        const r = document.querySelector("canvas").getBoundingClientRect();
        if (q.x < r.left + 8 || q.x > r.right - 8 || q.y < r.top + 60 || q.y > r.bottom - 110) return null;
        const g = window.__DEPOTGROUNDAT__(q.x, q.y);
        if (!g || Math.hypot(g.x - p.x, g.z - p.z) > 1.0) return null; // strict: ray must land on the target cell
        return q;
      }, { x, z });
      if (pt) { await page.mouse.click(Math.round(pt.x), Math.round(pt.y)); return true; }
      await sleep(400);
    }
    return false;
  };
  await settleAt(cell.x + 2, cell.z + 5, 2.0);
  await page.click('[data-tower-key="sandbag"]');
  // line A: along x (toggle default orient 0, auto-continue keeps it)
  for (const off of [-2, 0, 2]) { await tapWorld(cell.x + off, cell.z + 3); await sleep(200); }
  // toggle to vertical for line B's start
  await page.click('[data-tower-key="sandbag"]');
  // line B: along z, offset so it doesn't auto-continue off line A
  for (const off of [0, 2, 4]) { await tapWorld(cell.x + 6, cell.z + 3 + off); await sleep(200); }
  const bags = await page.evaluate(() => window.__DEPOTSANDBAGS__());
  console.log("bags:", JSON.stringify(bags));
  if (bags.length < 5) throw new Error("expected 5 bags, got " + bags.length);
  const flat = bags.filter((b) => b.hx > b.hz).length, tall = bags.filter((b) => b.hz > b.hx).length;
  console.log(`orientations: flat(x)=${flat} tall(z)=${tall}`);
  if (!flat || !tall) throw new Error("expected both orientations present");
  await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => x.textContent.startsWith("FOG")); if (b) b.click(); });
  await page.evaluate((p) => window.__DEPOTFOCUS__(p.x, p.z, 2.6), { x: cell.x + 3, z: cell.z + 6 });
  await sleep(2500);
  await page.screenshot({ path: OUT });
  console.log("shot ->", OUT);
} finally { await browser.close(); }
