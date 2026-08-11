import puppeteer from "puppeteer-core";
import { spawn } from "child_process";

const srv = spawn("npm", ["run", "preview"], { cwd: "/home/batman/coldsnap", stdio: "ignore" });
await new Promise((r) => setTimeout(r, 2500));
const seed = process.env.SEED || "7";
const URL = `http://localhost:4173/coldsnap/?seed=${seed}`;
const browser = await puppeteer.launch({
  protocolTimeout: 600000,
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--enable-unsafe-swiftshader", "--window-size=960,600"],
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 960, height: 600 });
  page.on("console", (m) => { if (m.text().startsWith("[diag]")) console.log(m.text()); });
  page.on("pageerror", (e) => console.log("PAGEERR", String(e)));
  await page.goto(URL, { waitUntil: "networkidle0" });
  await page.evaluate(() => localStorage.setItem("coldsnap-screen", "menu"));
  await page.goto(URL, { waitUntil: "networkidle0" });
  await page.evaluate(() => document.querySelector('[data-menu="depot"]').click());
  await page.waitForFunction(() => typeof window.__DEPOT__ === "function", { timeout: 20000 });
  await page.evaluate(() => window.__DEPOTSTART__());
  await page.waitForFunction(() => window.__DEPOT__().t > 0.2, { timeout: 10000 });

  const clickSlot = (k) => page.evaluate((K) => { const b = document.querySelector(`[data-tower-key="${K}"]`); if (b) b.click(); return !!b; }, k);
  const tapWorld = async (x, z) => {
    await page.evaluate((p) => window.__DEPOTFOCUS__(p.x, p.z), { x, z });
    await sleep(700);
    const scr = await page.evaluate((p) => window.__DEPOTSCREENAT__(p.x, p.z), { x, z });
    await page.touchscreen.tap(scr.x, scr.y);
    await sleep(300);
  };
  const sb = () => page.evaluate("window.__DEPOTSANDBAGS__().length");
  const cell = await page.evaluate(() => window.__DEPOTFINDBUILDABLE__());
  const near = (dx, dz) => ({ x: cell.x + dx, z: cell.z + dz });
  console.log("base cell", JSON.stringify(cell));

  // realistic messy session
  console.log("-- place sniper (pending + confirm)");
  await clickSlot("sq_sniper");
  await tapWorld(cell.x, cell.z);
  await sleep(600);
  await page.evaluate("(document.querySelector('[data-pending-confirm]')||{click(){}}).click()");
  await sleep(400);
  console.log("squads:", await page.evaluate("window.__DEPOTSQUADS__().length"));

  console.log("-- select the sniper by tapping him, order ATTACK, tap dest");
  const sq0 = await page.evaluate("window.__DEPOTSQUADS__()[0] || null");
  if (!sq0) { console.log('NO SQUAD - skip select'); }
  const m0 = sq0 ? sq0.members[0] : null;
  if (m0) await tapWorld(m0.x, m0.z);
  await sleep(600);
  await page.evaluate("(document.querySelector('[data-squad-attack]')||{click(){}}).click()");
  await sleep(200);
  await tapWorld(cell.x - 8, cell.z);

  console.log("-- sell toggle on/off, inspect a wall, pause/unpause");
  await page.evaluate("document.querySelector('[data-sell-toggle]').click()");
  await sleep(150);
  await page.evaluate("document.querySelector('[data-sell-toggle]').click()");
  await page.keyboard.press("e"); await sleep(1500);

  console.log("-- SEND wave, then mid-wave: select SANDBAG and tap 6 spots");
  await page.evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.includes('SEND'))?.click()");
  await sleep(3000);
  await clickSlot("sandbag");
  for (const [dx, dz] of [[1,0],[1,1],[1,2],[2,0],[0,2],[-2,1]]) {
    const p = near(dx, dz);
    await tapWorld(p.x, p.z);
    console.log("  sandbags now:", await sb());
  }
  console.log("-- re-tap SANDBAG (orientation cycle) then tap again");
  await clickSlot("sandbag");
  await tapWorld(cell.x - 1, cell.z - 2);
  console.log("  sandbags now:", await sb());
  console.log("final:", JSON.stringify(await page.evaluate("window.__DEPOT__()")));
} finally {
  await browser.close();
  srv.kill();
}
