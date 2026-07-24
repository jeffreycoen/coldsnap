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

  // --- autosave: zoom/sound changes survive a reload, which resumes the game
  await page.evaluate(() => { window.__COLDSNAP__._S.zoomBy(1.5); window.__COLDSNAP__._S.audio.setMuted(false); });
  await sleep(1600); // external autosaver polls at 1s
  // auto-resume mounts the game during page load, which delays network-idle
  // lifecycle events under software WebGL — wait on the canvas instead
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("canvas", { timeout: 30000 });
  ok("reload auto-resumes into the last game", true);
  await page.waitForFunction(
    () => window.__COLDSNAP__ && Math.abs(window.__COLDSNAP__._S.zoom - 1.5) < 0.05 && window.__COLDSNAP__._S.audio.muted === false,
    { timeout: 10000 }
  );
  ok("zoom and sound settings restore after reload", true);

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
  const shelters = await page.evaluate(() => (window.__COLDSNAP__._world().pg.shelters || []).length);
  ok("sandbox runs the scenario pipeline with sheltering on", shelters === 4);
  // play it: a volley on the gunnery pad should fulfil WO-01 outright
  await page.mouse.click(480, 300); // dismiss deploy overlay
  await page.waitForFunction(() => !!document.querySelector("[data-brief]"));
  body = await text();
  ok("work-order brief card presents WO-01", body.includes("WORK ORDER") && body.includes("Three subjects at the gunnery pad"));
  await sleep(800); // the brief ack arms after 500ms so a trailing deploy-tap click can't dismiss it
  await page.evaluate(() => document.querySelector("[data-brief-ack]").click());
  await page.waitForFunction(() => !document.querySelector("[data-brief]"));
  ok("brief acknowledges away", true);
  await page.evaluate(() => window.__COLDSNAP__.volleyAt(0, -30));
  await page.waitForFunction(() => window.__COLDSNAP__.getState().trial.idx >= 1, { timeout: 20000 });
  ok("volley on the gunnery pad fulfils WO-01 (order advances)", true);
  // the HUD flushes toasts on a game-time cadence that lags real time under
  // heavy load — poll for the toast instead of sleeping a fixed interval
  await page.waitForFunction(() => document.body.innerText.includes("COMMENDATION — WO-01"), { timeout: 10000 });
  body = await text();
  ok("completion toast reads as a commendation", body.includes("COMMENDATION — WO-01") && body.includes("Direct-fire lethality"));
  // the after-action report presents for review before the next order
  await page.waitForFunction(() => !!document.querySelector("[data-aar]"));
  const aarText = await page.evaluate(() => document.querySelector("[data-aar]").innerText);
  ok("AAR renders the bureau form header", aarText.includes("WORK ORDER WO-01") && aarText.includes("FIELD ACCEPTANCE DIVISION"));
  ok("AAR itemizes subjects with salvo + attribution", /SUBJECT 01 — /.test(aarText) && aarText.includes("salvo 1") && aarText.includes("attributed: operator"));
  ok("AAR accounts for the expended salvo", aarText.includes("EXPENDITURE: 0 SHELL · 0 MG · 1 SALVO"));
  ok("AAR closes with a remark and a stamp", aarText.includes("REMARK:") && aarText.includes("FULFILLED"));
  await page.evaluate(() => document.querySelector("[data-aar-file]").click());
  await page.waitForFunction(() => !document.querySelector("[data-aar]"));
  ok("report files away", true);
  await page.waitForFunction(() => { const b = document.querySelector("[data-brief]"); return b && b.innerText.includes("WO-02"); });
  ok("the next order's brief is presented (WO-02)", true);
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector("canvas"));
  ok("ESC returns from the sandbox", true);

  // --- kill tally survives leaving and re-entering the sandbox
  await clickMenu("contracts");
  await page.waitForFunction(() => !!window.__COLDSNAP__);
  await page.waitForFunction(() => (window.__COLDSNAP__._S.tally.BLAST || 0) >= 3, { timeout: 10000 });
  ok("kill tally restores on re-entry", true);
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector("canvas"));

  // --- the deviation: clear the drill squad off the sheet without a kill.
  // Teleport-assisted herd (the detector is what's under test, not the drive).
  await page.evaluate(() => localStorage.setItem("coldsnap-cs-trial", "6"));
  await clickMenu("contracts");
  await page.waitForFunction(() => !!window.__COLDSNAP__);
  await page.waitForFunction(() => document.body.innerText.includes("WO-07"));
  ok("final order is SURFACE LOAD RATING", (await text()).includes("SURFACE LOAD RATING"));
  await page.mouse.click(480, 300); // dismiss the deploy overlay so documents can render
  await page.evaluate(() => {
    const w = window.__COLDSNAP__._world();
    for (const b of w.bodies) if (b.group === "ponddrill") {
      b.pos.x += 40;
      b.pos.y = w.field.heightAt(b.pos.x, b.pos.z) + 0.88; // on the ground, not inside it
      b.v.x = 0; b.v.y = 0; b.v.z = 0;
      b.sleeping = false;
    }
  });
  // the 4s hold runs on game-loop dt, which lags real time badly under
  // software WebGL (~5fps on the Pi) — allow a wide margin. Poll a cheap
  // field on an interval: getState() computes worldHash over 1030 bodies,
  // and raf-polling it starves the very game loop it is waiting on.
  await page.waitForFunction(() => window.__COLDSNAP__._S.trial.idx >= 7, { timeout: 90000, polling: 1000 });
  ok("silent no-kill completion advances past the order", true);
  await page.waitForFunction(() => !!document.querySelector("[data-aar]"), { timeout: 20000, polling: 500 });
  const devAar = await page.evaluate(() => document.querySelector("[data-aar]").innerText);
  ok("deviation AAR: UNFULFILLED — DEVIATION, no commendation", devAar.includes("UNFULFILLED — DEVIATION") && !devAar.includes("COMMENDATION:"));
  ok("deviation AAR counts the dispersed", devAar.includes("0 PROCESSED · 6 DISPERSED"));
  await page.evaluate(() => document.querySelector("[data-aar-file]").click());
  await page.waitForFunction(() => document.body.innerText.includes("FREE PLAY"));
  ok("deviation stands in the record as a hollow star", (await text()).includes("☆"));
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector("canvas"));

  // --- phone layout: the order must be readable on a small touch screen
  const phone = await browser.newPage();
  phone.on("pageerror", (e) => pageErrors.push(String(e)));
  await phone.emulate({
    viewport: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
  });
  await phone.goto(URL, { waitUntil: "networkidle0" });
  // storage is shared with the desktop page, which already completed WO-01 —
  // reset order progress so this section starts at the first work order
  await phone.evaluate(() => localStorage.removeItem("coldsnap-cs-trial"));
  await phone.evaluate(() => document.querySelector("[data-menu=contracts]").click());
  await phone.waitForSelector("canvas");
  await phone.waitForFunction(() => !!window.__COLDSNAP__);
  await phone.touchscreen.tap(195, 600); // dismiss deploy overlay
  await phone.waitForFunction(() => !!document.querySelector("[data-brief]"));
  const phoneBody = await phone.evaluate(() => document.body.innerText);
  ok("phone: brief card carries the full directive", phoneBody.includes("Three subjects at the gunnery pad"));
  const skipRight = await phone.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "SKIP");
    return b ? b.getBoundingClientRect().right : 1e9;
  });
  ok("phone: SKIP button fits on screen", skipRight <= 391);
  await phone.close();

  // --- corrupt/hostile stored keymap resets to defaults (escape unbindable)
  // (also reset the resume screen: the phone section stored "sandbox" in the
  // shared profile, and this section expects to land on the menu)
  await page.evaluate(() => localStorage.setItem("coldsnap-screen", "menu"));
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
