// One-off screenshot: the sniper/spotter pair holding a knoll, lens glint
// visible. Phone viewport. Saves to .superpowers/pair-knoll.png. Not a gate.
import puppeteer from "puppeteer-core";

const URL = process.env.SMOKE_URL || "http://localhost:4173/coldsnap/";
const CHROME = process.env.CHROME_BIN || "/usr/bin/chromium";
const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--enable-unsafe-swiftshader", "--window-size=390,844"],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await page.goto(URL + "?seed=11", { waitUntil: "networkidle0" });
  await page.evaluate(() => document.querySelector('[data-menu="depot"]').click());
  await page.waitForFunction(() => typeof window.__DEPOT__ === "function", { timeout: 20000 });
  await page.evaluate(() => window.__DEPOTSTART__());
  await page.waitForFunction(() => window.__DEPOT__().t > 0.2, { timeout: 10000 });
  // place the pair via the debug hook at a surveyed-high area; the hook's own
  // survey walks the spotter to the local max wherever we drop the anchor.
  const id = await page.evaluate(() => window.__DEPOTPAIR__(0, 20));
  await page.waitForFunction((sid) => {
    const st = window.__DEPOTPAIRSTATE__(sid);
    return st && st.members.every((m) => m && m.alive) && st.members.some((m) => m.role === "spotter" && m.settled);
  }, { timeout: 30000, polling: 250 }, id);
  const st = await page.evaluate((sid) => window.__DEPOTPAIRSTATE__(sid), id);
  const sp = st.members.find((m) => m.role === "spotter");
  await page.evaluate((x, z) => window.__DEPOTFOCUS__(x, z, 2.6), sp.x, sp.z);
  // wait for the glint window (world.t-driven: t*0.45 + x*0.13 + z*0.29 mod 1 < 0.16)
  await page.waitForFunction((x, z) => {
    const t = window.__DEPOT__().t;
    const f = (t * 0.45 + x * 0.13 + z * 0.29) % 1;
    return f > 0.05 && f < 0.09;
  }, { timeout: 15000, polling: 30 }, sp.x, sp.z);
  await page.screenshot({ path: "/home/batman/coldsnap/.superpowers/pair-knoll.png" });
  console.log("saved pair-knoll.png", JSON.stringify(st));
} finally {
  await browser.close();
}
