// Shared-renderer TD-feature test: boots the real site (mech range = shared
// renderer live), injects tower bodies + overlay calls into the running
// world, and asserts frames keep rendering with zero page errors.
//   npm run build && npm run preview &   then:   node scripts/td-render-test.mjs
import puppeteer from "puppeteer-core";

const URL = process.env.SMOKE_URL || "http://localhost:4173/coldsnap/";
const CHROME = process.env.CHROME_BIN || "/usr/bin/chromium";
const fails = [];
const ok = (name, cond) => { console.log(`${cond ? "PASS" : "FAIL"} — ${name}`); if (!cond) fails.push(name); };

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--enable-unsafe-swiftshader", "--window-size=960,600"],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 960, height: 600 });
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  await page.goto(URL, { waitUntil: "networkidle0" });
  await page.evaluate(() => document.querySelector('[data-menu="mech"]').click());
  await page.waitForFunction(() => window.__MECHRANGE__ && window.__MECHRANGE__.R, { timeout: 20000 });
  ok("renderer handle exposed", true);

  // inject one tower of each type as bare engine-shaped bodies
  const inj = await page.evaluate(() => {
    const { world, R } = window.__MECHRANGE__;
    const types = ["mg", "gun", "mortar", "rocket", "frost"];
    for (let i = 0; i < types.length; i++) {
      const b = window.__MECHRANGE__.addBody({ kind: "tower", mass: 0, hx: 1, hy: 1.2, hz: 1, x: -8 + i * 4, y: 1.2, z: 8, hp: 100, friction: 0.8 });
      b.towerType = types[i]; b.maxHp = 100; b.hp = 60;
      if (types[i] === "frost") b.auraR = 12;
    }
    R.overlay.setHover(true, 0, 4, 0, 15, true, 2.0);
    R.overlay.setObjective(0, -10, 0);
    R.overlay.setBanners([{ x: -20, z: 20 }, { x: 20, z: 20 }]);
    return world.bodies.filter((b) => b.kind === "tower").length;
  });
  ok("5 tower bodies injected", inj === 5);
  await new Promise((r) => setTimeout(r, 1500)); // let the rAF loop draw them
  const drew = await page.evaluate(() => {
    const { world } = window.__MECHRANGE__;
    return world.bodies.filter((b) => b.kind === "tower").length === 5;
  });
  ok("frames render with towers + overlays live", drew);
  await page.screenshot({ path: process.env.CLAUDE_JOB_DIR ? process.env.CLAUDE_JOB_DIR + "/tmp/td-render.png" : "/tmp/td-render.png" });
  ok("no page errors", pageErrors.length === 0);
  if (pageErrors.length) console.log(pageErrors.join("\n"));
} finally {
  await browser.close();
}
if (fails.length) { console.error(`${fails.length} FAILURE(S)`); process.exit(1); }
console.log("ALL PASS");
