// BOOT-LOAD SMOKE — the only browser gate. It proves every surface LOADS:
// the start screen renders, each mode enters and mounts, the deployment mark
// is on screen where it is shown, every mode can be left again, and nothing
// throws in the page console. It asserts NOTHING about how the game plays —
// scripted play-throughs were retired in the C0 purge (mk0.31); see
// docs/superpowers/test-manifest.md for what was cut and why.
//
// Drives the system Chromium via puppeteer-core against a running server.
//   npm run build && npm run preview &   then:   node scripts/smoke.mjs
//   SMOKE_URL=https://jeffreycoen.github.io/coldsnap/ node scripts/smoke.mjs
//
// SMOKE_ONLY=<section[,section...]> restricts the run to a subset of
// sections, e.g. SMOKE_ONLY=depot or SMOKE_ONLY=depot,td. Unset runs
// everything. Sections:
// start, demo, contracts, campaign, phone, keymap, mech, td, depot.
// Each enabled section seeds its own localStorage/navigation preconditions
// so any subset is runnable standalone for local iteration.
import puppeteer from "puppeteer-core";
import { MK } from "../src/version.js";

const URL = process.env.SMOKE_URL || "http://localhost:4173/coldsnap/";
const CHROME = process.env.CHROME_BIN || "/usr/bin/chromium";

const ALL_SECTIONS = ["start", "demo", "contracts", "campaign", "phone", "keymap", "mech", "td", "depot"];
const ONLY = process.env.SMOKE_ONLY
  ? process.env.SMOKE_ONLY.split(",").map((s) => s.trim()).filter(Boolean)
  : null;
if (ONLY) {
  const unknown = ONLY.filter((s) => !ALL_SECTIONS.includes(s));
  if (unknown.length) {
    console.error(`Unknown SMOKE_ONLY section(s): ${unknown.join(", ")} — known: ${ALL_SECTIONS.join(", ")}`);
    process.exit(1);
  }
}
const sectionEnabled = (name) => !ONLY || ONLY.includes(name);
console.log(`boot-load smoke ${MK} — sections: ${(ONLY || ALL_SECTIONS).join(", ")}${ONLY ? " (subset)" : " (all)"}`);

const fails = [];
const ok = (name, cond) => {
  console.log(`${cond ? "PASS" : "FAIL"} — ${name}`);
  if (!cond) fails.push(name);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  protocolTimeout: 600000, // debris-heavy worlds under swiftshader can stall single evaluates past the 180s default
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
  // P6 T7 (mk1.14): the five demo surfaces + controls moved off the front
  // door behind one quiet link. Every non-depot navigation now hops through
  // it first: click the door's THE PROVING RANGE link, wait for the target
  // card to mount on the range page, then the existing click follows.
  const toDemos = async (target) => {
    await page.waitForSelector('[data-menu="demos"]');
    await clickMenu("demos");
    await page.waitForSelector(`[data-menu="${target}"]`);
  };
  const text = () => page.evaluate(() => document.body.innerText);
  const toMenu = async () => {
    await page.evaluate(() => localStorage.setItem("coldsnap-screen", "menu"));
    await page.reload({ waitUntil: "networkidle0" });
  };

  // page always starts loaded at the start screen, regardless of which
  // sections below are enabled — every section can assume this baseline.
  await page.goto(URL, { waitUntil: "networkidle0" });
  let body = await text();

  // --- start screen (the front door, P6 T7 mk1.14): it renders, it carries
  // the three laws, it offers DIG IN and the one quiet link to the demos.
  if (sectionEnabled("start")) {
    ok("start screen carries the three laws", body.includes("The muster bell rings every 90 seconds") && body.includes("real masonry") && body.includes("The save burns"));
    ok("start screen offers DIG IN — NEW FRONT", body.includes("DIG IN"));
    ok("start screen links to the demos page", body.includes("THE PROVING RANGE"));
    ok("no game canvas on the start screen", (await page.$("canvas")) === null);
    const mk = await page.evaluate(() => { const e = document.querySelector("[data-mk]"); return e ? e.textContent.trim() : null; });
    ok(`start screen shows the deployment mark [${mk}]`, mk === MK);
  }

  // --- demo: it boots from the menu and ESC gives the menu back
  if (sectionEnabled("demo")) {
    await toMenu();
    await toDemos("demo");
    await clickMenu("demo");
    await page.waitForSelector("canvas");
    await page.waitForFunction(() => !!window.__COLDSNAP__);
    ok("demo boots from the menu", true);
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector("canvas"));
    await toDemos("demo");
    ok("ESC returns to the start screen", true);
  }

  // --- contract sandbox: it boots, it builds its whole world, ESC returns.
  // Self-contained: resets trial progress and parks at the menu first.
  if (sectionEnabled("contracts")) {
    await page.evaluate(() => localStorage.removeItem("coldsnap-cs-trial"));
    await toMenu();
    await toDemos("contracts");
    await clickMenu("contracts");
    await page.waitForSelector("canvas");
    await page.waitForFunction(() => !!window.__COLDSNAP__);
    await page.waitForFunction(() => document.body.innerText.includes("WO-01"));
    body = await text();
    ok("sandbox boots with work-order titles (WO-01)", body.includes("WO-01 · DIRECT-FIRE ACCEPTANCE"));
    const csState = await page.evaluate(() => window.__COLDSNAP__.getState());
    ok("sandbox world builds fully (1030 bodies)", csState.bodies === 1030);
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector("canvas"));
    ok("ESC returns from the sandbox", true);
  }

  // --- campaign: the order book opens and the first mission deploys.
  // Self-contained: wipes campaign progress/record and parks at the menu.
  if (sectionEnabled("campaign")) {
    await page.evaluate(() => {
      for (const k of ["coldsnap-camp-progress", "coldsnap-camp-record", "coldsnap-camp-medals"]) localStorage.removeItem(k);
      localStorage.setItem("coldsnap-screen", "menu");
    });
    await page.reload({ waitUntil: "networkidle0" });
    await toDemos("campaign");
    await clickMenu("campaign");
    await page.waitForFunction(() => document.body.innerText.includes("ORDER BOOK"));
    const book = await text();
    ok("order book lists all eight orders", book.includes("AC-01") && book.includes("AC-08"));
    ok("first order deployable, title in clear", book.includes("DEPLOY") && book.includes("ARMOR PLATE ACCEPTANCE"));
    await page.evaluate(() => document.querySelector('[data-camp="ac01"]').click());
    await page.waitForSelector("canvas");
    await page.waitForFunction(() => !!window.__COLDSNAP__ && document.body.innerText.includes("AC-01"));
    ok("the first mission deploys", true);
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector("canvas"), { timeout: 20000 });
    ok("ESC leaves the mission", true);
  }

  // --- phone viewport: the page comes up on a small touch screen and a mode
  // mounts there too. Its own page, its own storage reset.
  if (sectionEnabled("phone")) {
    const phone = await browser.newPage();
    phone.on("pageerror", (e) => pageErrors.push(String(e)));
    await phone.emulate({
      viewport: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
    });
    await phone.evaluateOnNewDocument(() => { try { localStorage.setItem("coldsnap-screen", "menu"); } catch (e) {} });
    await phone.goto(URL, { waitUntil: "networkidle0" });
    const phoneBody = await phone.evaluate(() => document.body.innerText);
    ok("phone: the start screen renders", phoneBody.includes("THE PROVING RANGE"));
    const phoneMk = await phone.evaluate(() => { const e = document.querySelector("[data-mk]"); return e ? e.textContent.trim() : null; });
    ok(`phone: the start screen wears the mark [${phoneMk}]`, phoneMk === MK);
    await phone.waitForSelector('[data-menu="depot"]', { timeout: 15000 });
    await phone.tap('[data-menu="depot"]');
    await phone.waitForFunction(() => typeof window.__DEPOT__ === "function", { timeout: 30000 });
    ok("phone: WINTER FRONT mounts on a phone viewport", true);
    await phone.close();
  }

  // --- corrupt/hostile stored keymap resets to defaults (escape unbindable).
  // A load check: bad saved data must not stop the page coming up.
  if (sectionEnabled("keymap")) {
    await page.evaluate(() => localStorage.setItem("coldsnap-screen", "menu"));
    await page.evaluate(() => localStorage.setItem("coldsnap-keymap", JSON.stringify({ ...JSON.parse(localStorage.getItem("coldsnap-keymap") || "{}"), forward: "escape" })));
    await page.reload({ waitUntil: "networkidle0" });
    await toDemos("controls");
    await clickMenu("controls");
    await page.waitForFunction(() => document.querySelector('[data-bind="forward"]'));
    const fwdKey = await page.evaluate(() => document.querySelector('[data-bind="forward"]').textContent.trim());
    ok("stored 'escape' binding is rejected, defaults restored", fwdKey === "W");
    await clickMenu("back");
  }

  // --- MECH TEST RANGE: it mounts, ESC returns
  if (sectionEnabled("mech")) {
    await toMenu();
    await toDemos("mech");
    await clickMenu("mech");
    await page.waitForSelector("[data-mech-hud]", { timeout: 20000 });
    ok("mech range: HUD mounts", true);
    await page.keyboard.press("Escape");
    await toDemos("mech");
    ok("mech range: ESC returns to menu", true);
  }

  // --- HOLD THE DEPOT (tower defense): it mounts, it steps, ESC returns
  if (sectionEnabled("td")) {
    await toMenu();
    await toDemos("towerdef");
    await clickMenu("towerdef");
    await page.waitForFunction(() => typeof window.__TD__ === "function", { timeout: 20000 });
    ok("tower defense: mounts", true);
    await page.evaluate(() => window.__TDSTART__());
    await page.waitForFunction(() => { const s = window.__TD__(); return s.t > 1 && s.bodies > 0; }, { timeout: 20000, polling: 500 });
    const td = await page.evaluate(() => window.__TD__());
    ok("tower defense: world stepping", td.t > 1 && td.lives === 20);
    await page.keyboard.press("Escape");
    await toDemos("towerdef");
    ok("tower defense: ESC returns to menu", true);
  }

  // --- WINTER FRONT (the depot): it mounts, it wears the mark, and both ways
  // out work — ESC mid-run, and RETURN TO BASE off the end card.
  if (sectionEnabled("depot")) {
    // Pinned map seed: an unpinned reload gets a random procedural map, and a
    // pinned one keeps this check reading the same ground every run.
    const depotURL = URL + (URL.includes("?") ? "&" : "?") + "seed=11";
    // ...and the saved front (P1 T3): its key is not coldsnap-depot-prefixed,
    // and a leftover save would turn the menu's one-tap WINTER FRONT into the
    // two-tap NEW FRONT burn confirm.
    await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith("coldsnap-depot")) localStorage.removeItem(k); localStorage.removeItem("coldsnap-front-save"); });
    await page.evaluate(() => localStorage.setItem("coldsnap-screen", "menu"));
    await page.goto(depotURL, { waitUntil: "networkidle0" });
    await clickMenu("depot");
    await page.waitForFunction(() => typeof window.__DEPOT__ === "function", { timeout: 20000 });
    ok("depot: mounts", true);
    await page.evaluate(() => window.__DEPOTSTART__());
    await page.waitForFunction(() => window.__DEPOT__().t > 0.2, { timeout: 20000 });
    body = await text();
    ok(`depot: the HUD wears the deployment mark [${MK}]`, body.includes(MK));
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => document.querySelector('[data-menu="depot"]'), { timeout: 10000 });
    ok("depot: ESC returns to menu", true);

    // the end card's way out: a verdict, then RETURN TO BASE actually returns.
    await clickMenu("depot");
    await page.waitForFunction(() => typeof window.__DEPOT__ === "function", { timeout: 20000 });
    await page.evaluate(() => window.__DEPOTSTART__());
    await page.waitForFunction(() => window.__DEPOT__().t > 0.2, { timeout: 20000 });
    await page.evaluate(() => window.__DEPOTEND__(false));
    // the card is held back for a few WORLD seconds while the collapse plays,
    // and the world clock runs at roughly a third of wall time under
    // swiftshader — generous timeout, not a race.
    const cardUp = await page.waitForFunction(() => !!document.querySelector("[data-dispatch-wo]"), { timeout: 90000, polling: 200 }).then(() => true).catch(() => false);
    ok("depot: the end card arrives", cardUp);
    if (cardUp) {
      await sleep(700); // the card's own 500ms arming window
      await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => /RETURN TO BASE/.test(x.textContent)); if (b) b.click(); });
      const left = await page.waitForFunction(() => !!document.querySelector('[data-menu="depot"]'), { timeout: 15000, polling: 200 }).then(() => true).catch(() => false);
      ok("depot: RETURN TO BASE returns to base", left);
    }
  }

  ok("no page errors during the run", pageErrors.length === 0);
  if (pageErrors.length) console.log("page errors:", pageErrors);
} finally {
  await browser.close();
}

if (fails.length) {
  console.error(`\n${fails.length} FAILURE(S)`);
  process.exit(1);
}
console.log("\nBOOT-LOAD SMOKE: ALL PASS");
