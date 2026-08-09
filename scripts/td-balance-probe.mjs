import puppeteer from "puppeteer-core";
const browser = await puppeteer.launch({ protocolTimeout: 600000, executablePath: "/usr/bin/chromium", headless: true, args: ["--no-sandbox", "--disable-gpu", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage();
await page.goto("http://localhost:4173/coldsnap/", { waitUntil: "networkidle0" });
await page.evaluate(() => document.querySelector('[data-menu="towerdef"]').click());
await page.waitForFunction(() => typeof window.__TDSIM__ === "function", { timeout: 20000 });
const r = await page.evaluate(() => {
  window.__TDSTART__();
  const G = (x, z) => ({ gx: Math.floor((x + 56) / 2), gz: Math.floor((z + 56) / 2) });
  for (const [px, pz] of [[-4, 3], [34, 2]]) {
    const g = G(px, pz);
    for (let dx = -2; dx <= 2; dx++) { if (dx !== 0) window.__TDBUILD__(g.gx + dx, g.gz, "wall"); }
    window.__TDBUILD__(g.gx - 1, g.gz - 2, "gun");
    window.__TDBUILD__(g.gx + 1, g.gz - 2, "mg");
  }
  const out = [];
  const WAVES = [{ n: 14, mix: [""] }, { n: 20, mix: [""] }, { n: 22, mix: ["", "", "fast"] }];
  for (let w = 0; w < WAVES.length; w++) {
    const spec = WAVES[w];
    for (let i = 0; i < spec.n; i++) { window.__TDSPAWN__(1, spec.mix[i % spec.mix.length]); window.__TDSIM__(0.8); }
    window.__TDSIM__(70);
    const t = window.__TD__();
    out.push({ wave: w + 1, lives: t.lives, kills: t.kills, scrap: Math.round(t.scrap), leftAlive: window.__TDUNITS__().length });
  }
  return out;
});
console.log(JSON.stringify(r));
await browser.close();
