// One-off visual check: place a sniper squad, select it, screenshot the
// head-height reach fan (uncommitted selection-fan fix). Not part of smoke.
import puppeteer from "puppeteer-core";
const URL = "http://localhost:4173/coldsnap/?seed=11";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({
  protocolTimeout: 600000, executablePath: "/usr/bin/chromium", headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--enable-unsafe-swiftshader", "--window-size=960,600"],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 960, height: 600 });
  await page.goto("http://localhost:4173/coldsnap/", { waitUntil: "networkidle0" });
  await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith("coldsnap-depot")) localStorage.removeItem(k); localStorage.setItem("coldsnap-screen", "menu"); });
  await page.goto(URL, { waitUntil: "networkidle0" });
  await page.evaluate(() => document.querySelector('[data-menu="depot"]').click());
  await page.waitForFunction(() => typeof window.__DEPOT__ === "function", { timeout: 20000 });
  await page.evaluate(() => window.__DEPOTSTART__());
  await page.waitForFunction(() => window.__DEPOT__().t > 0.2, { timeout: 10000 });
  await page.waitForFunction(() => !!window.__DEPOTFINDBUILDABLE__(5), { timeout: 10000, polling: 200 });
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
    for (let i = 0; i < 12; i++) {
      const pt = await page.evaluate((p) => {
        const q = window.__DEPOTSCREENAT__(p.x, p.z);
        if (!q) return null;
        const r = document.querySelector("canvas").getBoundingClientRect();
        if (q.x < r.left + 8 || q.x > r.right - 8 || q.y < r.top + 60 || q.y > r.bottom - 110) return null;
        return q;
      }, { x, z });
      if (pt) { await page.mouse.click(Math.round(pt.x), Math.round(pt.y)); return true; }
      await sleep(400);
    }
    return false;
  };
  await settleAt(cell.x, cell.z, 1.4);
  await page.click('[data-tower-key="sq_sniper"]');
  await tapWorld(cell.x, cell.z);
  await page.waitForFunction(() => !!document.querySelector("[data-pending-confirm]"), { timeout: 5000, polling: 100 }); await sleep(600); await page.screenshot({ path: "/home/batman/.claude/jobs/d23b1b0a/tmp/pending-fan.png" });
  await sleep(450);
  await page.click("[data-pending-confirm]");
  await page.waitForFunction(() => (window.__DEPOTSQUADS__() || []).length === 1, { timeout: 5000, polling: 100 });
  // select the sniper member
  let selected = false;
  for (let a = 0; a < 10 && !selected; a++) {
    const q = (await page.evaluate(() => window.__DEPOTSQUADS__()))[0];
    const m = q.members.find((mm) => mm.alive) || q.members[0];
    await settleAt(q.anchor.x, q.anchor.z, 0.7);
    await tapWorld(m.x, m.z);
    selected = await page.waitForFunction(() => !!document.querySelector("[data-squad-attack]"), { timeout: 1200, polling: 100 }).then(() => true).catch(() => false);
  }
  console.log("selected:", selected);
  await sleep(1500); // 1Hz fan refresh + a render
  console.log("selReach:", JSON.stringify(await page.evaluate(() => window.__DEPOTSELREACH__ && window.__DEPOTSELREACH__()))); console.log("reachdbg:", JSON.stringify(await page.evaluate(() => window.__REACHDBG__ || null))); await page.screenshot({ path: process.env.SHOT || "/tmp/sniper-fan.png" });
  console.log("shot written");
} finally { await browser.close(); }
