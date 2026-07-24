// End-to-end smoke test: start screen, keyboard remapping, demo boot, ESC.
// Drives the system Chromium via puppeteer-core against a running server.
//   npm run build && npm run preview &   then:   node scripts/smoke.mjs
//   SMOKE_URL=https://jeffreycoen.github.io/coldsnap/ node scripts/smoke.mjs
import puppeteer from "puppeteer-core";

const URL = process.env.SMOKE_URL || "http://localhost:4173/coldsnap/";
const CHROME = process.env.CHROME_BIN || "/usr/bin/chromium";

const fails = [];
const ok = (name, cond) => {
  console.log(`${cond ? "PASS" : "FAIL"} — ${name}`);
  if (!cond) fails.push(name);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--enable-unsafe-swiftshader", "--window-size=960,600"],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 960, height: 600 });
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));

  const clickMenu = (sel) => page.evaluate((s) => document.querySelector(`[data-menu="${s}"]`).click(), sel);
  const text = () => page.evaluate(() => document.body.innerText);

  // --- start screen
  await page.goto(URL, { waitUntil: "networkidle0" });
  let body = await text();
  ok("start screen shows the demo option", body.includes("PROVING GROUNDS"));
  ok("start screen shows contract placeholder", body.includes("CONTRACT SANDBOX"));
  ok("start screen shows controls option", body.includes("CONTROLS"));
  ok("no game canvas on the start screen", (await page.$("canvas")) === null);

  // --- controls: rebind volley v -> q (and check swap safety via defaults)
  await clickMenu("controls");
  await page.waitForFunction(() => document.body.innerText.includes("ROCKET VOLLEY"));
  await page.evaluate(() => document.querySelector('[data-bind="volley"]').click());
  // a bare modifier must not bind — the capture waits for the real key
  await page.keyboard.press("Shift");
  await sleep(120);
  const stillListening = await page.evaluate(() => document.querySelector('[data-bind="volley"]').textContent.includes("PRESS"));
  ok("modifier alone doesn't bind, capture keeps listening", stillListening);
  await page.keyboard.press("q");
  await page.waitForFunction(() => document.querySelector('[data-bind="volley"]').textContent.trim() === "Q");
  ok("volley rebinds to Q", true);
  const stored = await page.evaluate(() => localStorage.getItem("coldsnap-keymap"));
  ok("keymap persisted to storage", !!stored && JSON.parse(stored).volley === "q");

  // swap: bind MG to q as well — volley should take MG's old key g
  await page.evaluate(() => document.querySelector('[data-bind="mg"]').click());
  await page.keyboard.press("q");
  await page.waitForFunction(() => document.querySelector('[data-bind="mg"]').textContent.trim() === "Q");
  const volleyNow = await page.evaluate(() => document.querySelector('[data-bind="volley"]').textContent.trim());
  ok("conflicting key swaps instead of double-binding", volleyNow === "G");
  // put it back: volley=q, mg=g
  await page.evaluate(() => document.querySelector('[data-bind="volley"]').click());
  await page.keyboard.press("q");
  await page.waitForFunction(() => document.querySelector('[data-bind="volley"]').textContent.trim() === "Q");

  // --- persistence across reload
  await page.reload({ waitUntil: "networkidle0" });
  await clickMenu("controls");
  await page.waitForFunction(() => document.querySelector('[data-bind="volley"]'));
  const volleyAfterReload = await page.evaluate(() => document.querySelector('[data-bind="volley"]').textContent.trim());
  ok("rebind survives a reload", volleyAfterReload === "Q");
  await clickMenu("back");

  // --- launch the demo
  await clickMenu("demo");
  await page.waitForSelector("canvas");
  await page.waitForFunction(() => !!window.__COLDSNAP__);
  ok("demo boots from the menu", true);
  await page.mouse.click(480, 300); // dismiss the deploy overlay
  await sleep(400);

  // --- remap behavior in-game: old key dead, new key fires
  await page.keyboard.press("v");
  await sleep(150);
  let cds = await page.evaluate(() => window.__COLDSNAP__._S.cds.volley);
  ok("old volley key V is suppressed", cds === 0);
  await page.keyboard.press("q");
  await sleep(150);
  cds = await page.evaluate(() => window.__COLDSNAP__._S.cds.volley);
  ok("remapped Q fires the volley", cds > 0);

  // default (identity) binding still works: W drives
  await page.keyboard.down("w");
  await sleep(350);
  const throttle = await page.evaluate(() => window.__COLDSNAP__._world().control.throttle);
  ok("default W still drives forward", throttle > 0);

  // focus loss releases held keys (no runaway tank after alt-tab/OS menus)
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await sleep(250);
  const throttleAfterBlur = await page.evaluate(() => window.__COLDSNAP__._world().control.throttle);
  ok("window blur releases the held drive key", throttleAfterBlur === 0);
  await page.keyboard.up("w");

  // --- ESC returns to the menu, demo unmounts
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector("canvas"));
  body = await text();
  ok("ESC returns to the start screen", body.includes("PROVING GROUNDS"));

  // --- contract sandbox: boots, wears the bureau voice, ESC returns
  await clickMenu("contracts");
  await page.waitForSelector("canvas");
  await page.waitForFunction(() => !!window.__COLDSNAP__);
  await page.waitForFunction(() => document.body.innerText.includes("WO-01"));
  body = await text();
  ok("sandbox boots with work-order titles (WO-01)", body.includes("WO-01 · DIRECT-FIRE ACCEPTANCE"));
  ok("sandbox trial bar reads ORDER", body.includes("ORDER 1/7"));
  ok("sandbox deploy overlay wears the bureau voice", body.includes("CONTRACT DIVISION") && body.includes("The bureau is watching the clock"));
  const csState = await page.evaluate(() => window.__COLDSNAP__.getState());
  ok("sandbox world builds fully (1030 bodies)", csState.bodies === 1030);
  // play it: a volley on the gunnery pad should fulfil WO-01 outright
  await page.mouse.click(480, 300); // dismiss deploy overlay
  await page.evaluate(() => window.__COLDSNAP__.volleyAt(0, -30));
  await page.waitForFunction(() => window.__COLDSNAP__.getState().trial.idx >= 1, { timeout: 20000 });
  ok("volley on the gunnery pad fulfils WO-01 (order advances)", true);
  // the HUD flushes toasts on a game-time cadence that lags real time under
  // heavy load — poll for the toast instead of sleeping a fixed interval
  await page.waitForFunction(() => document.body.innerText.includes("COMMENDATION — WO-01"), { timeout: 10000 });
  body = await text();
  ok("completion toast reads as a commendation", body.includes("COMMENDATION — WO-01") && body.includes("Direct-fire lethality"));
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector("canvas"));
  ok("ESC returns from the sandbox", true);

  // --- corrupt/hostile stored keymap resets to defaults (escape unbindable)
  await page.evaluate(() => localStorage.setItem("coldsnap-keymap", JSON.stringify({ ...JSON.parse(localStorage.getItem("coldsnap-keymap")), forward: "escape" })));
  await page.reload({ waitUntil: "networkidle0" });
  await clickMenu("controls");
  await page.waitForFunction(() => document.querySelector('[data-bind="forward"]'));
  const fwdKey = await page.evaluate(() => document.querySelector('[data-bind="forward"]').textContent.trim());
  ok("stored 'escape' binding is rejected, defaults restored", fwdKey === "W");

  ok("no page errors during the run", pageErrors.length === 0);
  if (pageErrors.length) console.log("page errors:", pageErrors);
} finally {
  await browser.close();
}

if (fails.length) {
  console.error(`\n${fails.length} FAILURE(S)`);
  process.exit(1);
}
console.log("\nALL PASS");
