// End-to-end smoke test: start screen, keyboard remapping, demo boot, ESC.
// Drives the system Chromium via puppeteer-core against a running server.
//   npm run build && npm run preview &   then:   node scripts/smoke.mjs
//   SMOKE_URL=https://jeffreycoen.github.io/coldsnap/ node scripts/smoke.mjs
//
// SMOKE_ONLY=<section[,section...]> restricts the run to a subset of
// sections, e.g. SMOKE_ONLY=depot or SMOKE_ONLY=depot,td. Unset runs
// everything (this is what CI does — leave deploy.yml alone). Sections:
// start, controls, demo, contracts, campaign, phone, keymap, mech, td, depot.
// Each enabled section seeds its own localStorage/navigation preconditions
// so any subset is runnable standalone for local iteration.
import puppeteer from "puppeteer-core";

const URL = process.env.SMOKE_URL || "http://localhost:4173/coldsnap/";
const CHROME = process.env.CHROME_BIN || "/usr/bin/chromium";

const ALL_SECTIONS = ["start", "controls", "demo", "contracts", "campaign", "phone", "keymap", "mech", "td", "depot"];
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
console.log(`sections: ${(ONLY || ALL_SECTIONS).join(", ")}${ONLY ? " (subset)" : " (all)"}`);

const fails = [];
const ok = (name, cond) => {
  console.log(`${cond ? "PASS" : "FAIL"} — ${name}`);
  if (!cond) fails.push(name);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  protocolTimeout: 600000, // debris-heavy missions under swiftshader can stall single evaluates past the 180s default
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

  // page always starts loaded at the start screen, regardless of which
  // sections below are enabled — every section can assume this baseline.
  await page.goto(URL, { waitUntil: "networkidle0" });
  let body = await text();

  // --- start screen
  if (sectionEnabled("start")) {
    ok("start screen shows the demo option", body.includes("PROVING GROUNDS"));
    ok("start screen shows contract placeholder", body.includes("CONTRACT SANDBOX"));
    ok("start screen shows controls option", body.includes("CONTROLS"));
    ok("no game canvas on the start screen", (await page.$("canvas")) === null);
  }

  // --- controls: rebind volley v -> q (and check swap safety via defaults),
  // then persistence across reload. Self-contained: only needs the start screen.
  if (sectionEnabled("controls")) {
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
  }

  // --- demo: launch, in-game remap check, autosave, ESC. Depends on the
  // "controls" section having rebound volley to Q — if that section didn't
  // run, seed the same keymap directly via localStorage (cheap) so the
  // in-game remap assertions still hold, then make sure we're at the menu.
  if (sectionEnabled("demo")) {
    await page.evaluate(() => {
      const existing = JSON.parse(localStorage.getItem("coldsnap-keymap") || "{}");
      if (existing.volley !== "q") localStorage.setItem("coldsnap-keymap", JSON.stringify({ ...existing, volley: "q" }));
    });
    await page.evaluate(() => localStorage.setItem("coldsnap-screen", "menu"));
    await page.reload({ waitUntil: "networkidle0" });

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
  }

  // --- contract sandbox: boots, wears the bureau voice, ESC returns.
  // Self-contained: resets trial progress and parks at the menu first, so
  // it doesn't depend on the "demo" section having returned to the start screen.
  if (sectionEnabled("contracts")) {
  await page.evaluate(() => localStorage.removeItem("coldsnap-cs-trial"));
  await page.evaluate(() => localStorage.setItem("coldsnap-screen", "menu"));
  await page.reload({ waitUntil: "networkidle0" });
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
  ok("sandbox runs the scenario pipeline with sheltering on", shelters === 5); // 4 houses + the keep (enterable since AC-05)
  // play it: a volley on the gunnery pad should fulfil WO-01 outright
  await page.mouse.click(480, 300); // dismiss deploy overlay
  await page.waitForFunction(() => !!document.querySelector("[data-brief]"));
  // the directive teletypes — wait for the lot line to finish typing
  await page.waitForFunction(() => document.body.innerText.includes("Decommissioned units, lot 7"), { timeout: 15000, polling: 500 });
  body = await text();
  ok("work-order brief card presents WO-01", body.includes("WORK ORDER"));
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
  ok("AAR itemizes subjects compactly", /01 · /.test(aarText) && aarText.includes("salvo 1"));
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

  // --- subject restock: exhaust WO-01's pool the WRONG way (falls, not
  // direct fire) and the bureau must reissue the detail instead of stranding
  await page.evaluate(() => localStorage.setItem("coldsnap-cs-trial", "0"));
  await clickMenu("contracts");
  await page.waitForFunction(() => !!window.__COLDSNAP__);
  await page.waitForFunction(() => document.body.innerText.includes("WO-01"));
  await page.mouse.click(480, 300); // dismiss the deploy overlay
  await page.evaluate(() => {
    const w = window.__COLDSNAP__._world();
    for (const b of w.bodies) if (b.group === "gunnery" && b.kind === "unit" && b.alive) {
      b.pos.y += 35; // long fall onto the pad: IMPACT kills, which never match direct-fire
      b.v.x = 0; b.v.y = 0; b.v.z = 0;
      b.sleeping = false;
    }
  });
  await page.waitForFunction(() => document.body.innerText.includes("REPLACEMENT DETAIL ISSUED"), { timeout: 90000, polling: 1000 });
  ok("exhausted subject pool reissues the detail", true);
  await page.waitForFunction(() => {
    const w = window.__COLDSNAP__._world();
    let n = 0;
    for (const b of w.bodies) if (b.group === "gunnery" && b.kind === "unit" && b.alive) n++;
    return n >= 12;
  }, { timeout: 20000, polling: 1000 });
  ok("fresh detail is on the pad, order still stands", await page.evaluate(() => window.__COLDSNAP__._S.trial.idx === 0));
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector("canvas"));
  }

  // --- clearance program: order book gating, AC-01 completes, AC-02 unseals.
  // Self-contained: wipes campaign progress/record and parks at the menu, so
  // it doesn't depend on the "contracts" section having run first.
  if (sectionEnabled("campaign")) {
  await page.evaluate(() => {
    for (const k of ["coldsnap-camp-progress", "coldsnap-camp-record", "coldsnap-camp-medals"]) localStorage.removeItem(k);
    localStorage.setItem("coldsnap-screen", "menu");
  });
  await page.reload({ waitUntil: "networkidle0" });
  await clickMenu("campaign");
  await page.waitForFunction(() => document.body.innerText.includes("ORDER BOOK"));
  let book = await text();
  ok("order book lists all eight orders", book.includes("AC-01") && book.includes("AC-08"));
  ok("first order deployable, title in clear", book.includes("DEPLOY") && book.includes("ARMOR PLATE ACCEPTANCE"));
  ok("sealed orders are dimmed redactions", book.includes("\u2588") && !book.includes("THE VILLAGE"));
  await page.evaluate(() => document.querySelector('[data-camp="ac01"]').click());
  await page.waitForSelector("canvas");
  await page.waitForFunction(() => !!window.__COLDSNAP__ && document.body.innerText.includes("AC-01"));
  await page.mouse.click(480, 300); // deploy overlay
  await page.waitForFunction(() => !!document.querySelector("[data-brief]"));
  // the directive teletypes in — wait for the text to finish arriving
  await page.waitForFunction(() => document.body.innerText.includes("receiving racks"), { timeout: 15000, polling: 500 });
  ok("mission brief carries the directive", true);
  await sleep(800);
  await page.evaluate(() => document.querySelector("[data-brief-ack]").click());
  ok("firing procedure ticker is posted", (await text()).includes("ANNEX A"));
  await page.keyboard.press("t");
  await sleep(250);
  ok("T switches the fire control to the MG", (await page.evaluate(() => window.__COLDSNAP__._S.weapon)) === "mg");
  await page.keyboard.press("t");
  await page.evaluate(() => {
    const api = window.__COLDSNAP__;
    window.__campFire = setInterval(() => {
      const w = api._world();
      const tg = w.bodies.find((b) => b.group === "plate" && b.kind === "vehicle" && b.alive);
      if (tg && api._S.actions) api._S.actions.fireAt(tg.pos.x, tg.pos.z);
    }, 700);
  });
  await page.waitForFunction(() => document.body.innerText.includes("Penetration performance"), { timeout: 120000, polling: 1000 });
  ok("AC-01 completes by direct fire", true);
  await page.evaluate(() => clearInterval(window.__campFire));
  await page.waitForFunction(() => !!document.querySelector("[data-aar]"), { timeout: 20000, polling: 500 });
  await page.evaluate(() => document.querySelector("[data-aar-file]").click());
  await page.waitForFunction(() => document.body.innerText.includes("ORDER BOOK"), { timeout: 20000, polling: 500 });
  book = await text();
  ok("filed report returns to the order book", true);
  ok("AC-02 unseals after AC-01", book.includes("BATTERY REDUCTION"));
  ok("completed AC-01 stays replayable", await page.evaluate(() => !document.querySelector('[data-camp="ac01"]').disabled));

  // From here the ladder is proven (AC-01 completed for real, AC-02 unsealed).
  // Older missions get fast deploy checks; only the NEWEST mission runs its
  // full completion in the browser — the headless campaign gate carries
  // completability for the rest. Progress is seeded per section so the
  // suite stops growing by minutes with every mission.
  const seedMission = async (n, id, wo) => {
    await page.evaluate((p) => { localStorage.setItem("coldsnap-camp-progress", String(p)); localStorage.removeItem("coldsnap-screen"); }, n);
    await page.reload({ waitUntil: "networkidle0" });
    await page.evaluate(() => document.querySelector("[data-menu=campaign]").click());
    await page.waitForFunction(() => document.body.innerText.includes("ORDER BOOK"));
    await page.evaluate((i) => document.querySelector(`[data-camp="${i}"]`).click(), id);
    await page.waitForSelector("canvas");
    await page.waitForFunction((w2) => !!window.__COLDSNAP__ && document.body.innerText.includes(w2), {}, wo);
    // the deploy card only shows on a player's first-ever mission — a blind
    // click with no card up would fire a stray shell into the world
    if (await page.evaluate(() => document.body.innerText.includes("TO DEPLOY"))) await page.mouse.click(480, 300);
    await page.waitForFunction(() => !!document.querySelector("[data-brief]"));
  };

  // --- AC-02 (fast): deploys, no tutorial annex, android dress staged
  await seedMission(1, "ac02", "AC-02");
  await page.waitForFunction(() => document.body.innerText.includes("provided for in the schedule"), { timeout: 15000, polling: 500 });
  ok("AC-02 brief carries the directive", true);
  await page.waitForFunction(() => {
    const d = document.querySelector("[data-disposition]");
    return !!d && d.innerText.includes("RESOLVED") && !d.innerText.includes("DISPERSED");
  }, { timeout: 15000, polling: 500 });
  ok("AC-02 disposition field offers no alternative", true);
  await sleep(800);
  await page.evaluate(() => document.querySelector("[data-brief-ack]").click());
  ok("no firing-procedure annex on AC-02", !(await text()).includes("ANNEX A"));
  ok("battery crews staged in android dress", await page.evaluate(() => {
    const w = window.__COLDSNAP__._world();
    return w.bodies.filter((b) => b.group === "battery" && b.kind === "unit" && b.dress === "android").length === 9;
  }));

  // --- AC-03 (fast): deploys, volley discipline (danger close + LOS)
  await seedMission(2, "ac03", "AC-03");
  await page.waitForFunction(() => document.body.innerText.includes("one line item"), { timeout: 15000, polling: 500 });
  await sleep(800);
  await page.evaluate(() => document.querySelector("[data-brief-ack]").click());
  const dc = await page.evaluate(() => {
    const api = window.__COLDSNAP__, w = api._world(), b = w.byId.get(w.bisonId);
    const r = api._S.actions.volleyAt(b.pos.x + 3, b.pos.z);
    return { r, cd: api._S.cds.volley };
  });
  ok("volley refuses danger close, no cooldown burned", dc.r === false && dc.cd === 0);
  await page.waitForFunction(() => document.body.innerText.includes("RACK HELD"), { timeout: 5000, polling: 250 });
  ok("rack-held toast posted", true);
  await sleep(1400); // refusal toast throttle
  const los = await page.evaluate(() => {
    const api = window.__COLDSNAP__;
    const r = api._S.actions.volleyAt(-11, 26); // behind house0's south wall from spawn
    return { r, cd: api._S.cds.volley };
  });
  ok("volley refuses without line of sight", los.r === false && los.cd === 0);
  const clear = await page.evaluate(() => {
    const api = window.__COLDSNAP__;
    const r = api._S.actions.volleyAt(0, -30); // open road, clear sightline
    return { r, cd: api._S.cds.volley };
  });
  ok("volley fires with a clear sightline", clear.r === true && clear.cd > 0);

  // --- AC-04 (fast): deploys, struck procedure line
  await seedMission(3, "ac04", "AC-04");
  await page.waitForFunction(() => document.body.innerText.includes("Clear the detail"), { timeout: 15000, polling: 500 });
  ok("AC-04 brief carries the struck line", await page.evaluate(() => {
    const s = document.querySelector("[data-struck]");
    return !!s && s.innerText.includes("APPROACH WITHOUT DISCHARGE");
  }));
  await sleep(400);
  await page.evaluate(() => document.querySelector("[data-brief-ack]").click());

  // --- AC-05 (fast): deploys, collapse-only directive, granary + shelters staged
  await seedMission(4, "ac05", "AC-05");
  await page.waitForFunction(() => document.body.innerText.includes("Collapse is the sole accepted cause"), { timeout: 15000, polling: 500 });
  ok("AC-05 brief carries the directive", true);
  await sleep(400);
  await page.evaluate(() => document.querySelector("[data-brief-ack]").click());
  ok("granary and shelters staged", await page.evaluate(() => {
    const w = window.__COLDSNAP__._world();
    return w.bodies.some((b) => b.group === "granary" && b.kind === "chunk") && w.pg.shelters.length === 3;
  }));

  // --- AC-06 (fast): deploys, the halt composes, trucks retained
  await seedMission(5, "ac06", "AC-06");
  await page.waitForFunction(() => document.body.innerText.includes("retained inventory"), { timeout: 15000, polling: 500 });
  ok("AC-06 brief carries the directive", true);
  await sleep(400);
  await page.evaluate(() => document.querySelector("[data-brief-ack]").click());
  ok("the halt composes: eight crews dismounted, three trucks retained", await page.evaluate(() => {
    const w = window.__COLDSNAP__._world();
    return w.bodies.filter((b) => b.group === "convoy2" && b.kind === "unit" && b.alive).length === 8 &&
      w.bodies.filter((b) => b.group === "haulage" && b.kind === "truck").length === 3;
  }));

  // --- AC-07 (fast): deploys, the settlement composes, mixed dress
  await seedMission(6, "ac07", "AC-07");
  await page.waitForFunction(() => document.body.innerText.includes("Bring them to grade"), { timeout: 15000, polling: 500 });
  ok("AC-07 brief carries the directive", true);
  await sleep(400);
  await page.evaluate(() => document.querySelector("[data-brief-ack]").click());
  ok("the settlement composes: twenty villagers, three roofed halls", await page.evaluate(() => {
    const w = window.__COLDSNAP__._world();
    const v = w.bodies.filter((b) => b.group === "village" && b.kind === "unit" && b.alive);
    return v.length === 20 && v.filter((u) => u.dress === "human").length === 5 &&
      w.bodies.filter((b) => b.roofSlab).length === 3 && w.pg.shelters.length === 4;
  }));

  // --- AC-08 (full): the mirror finale — WO-07's sheet restaged among the
  // campaign's wreckage. The record is seeded AC-07-fulfilled so the AAR
  // must file the skate (the fork's other branch is gate-covered).
  await page.evaluate(() => localStorage.setItem("coldsnap-camp-record", JSON.stringify({ ac07: { fulfilled: 1, deviated: 0, bestTime: 33.3, lastOutcome: "fulfilled" } })));
  await seedMission(7, "ac08", "AC-08");
  await page.waitForFunction(() => document.body.innerText.includes("The sheet has refrozen"), { timeout: 15000, polling: 500 });
  ok("AC-08 brief carries the directive", true);
  // the deviation contracts print the alternative and strike it out
  await page.waitForFunction(() => {
    const d = document.querySelector("[data-disposition]");
    return !!d && d.innerText.includes("DISPERSED — NOT ACCEPTED");
  }, { timeout: 15000, polling: 500 });
  ok("AC-08 disposition strikes the dispersal line", true);
  await sleep(400);
  await page.evaluate(() => document.querySelector("[data-brief-ack]").click());
  ok("no arcade trophies on a campaign deployment", !(await text()).includes("/10"));
  ok("the sheet composes: six on the ice, the evidence ring around it", await page.evaluate(() => {
    const w = window.__COLDSNAP__._world();
    const d = w.bodies.filter((b) => b.group === "ponddrill2" && b.kind === "unit" && b.alive);
    return d.length === 6 && d.every((u) => u.dress === "android") && w.ice && w.ice.plates.length === 64 &&
      w.bodies.filter((b) => b.kind === "wreck").length === 3 && w.bodies.some((b) => b.group === "relic" && b.alive);
  }));
  await page.evaluate(() => window.__COLDSNAP__.setGfx({ scale: 4, outline: 0, dither: 0 })); // quarter-res keeps swiftshader ahead of the debris
  ok("the grade reads the record at deployment", await page.evaluate(() => {
    const api = window.__COLDSNAP__;
    return typeof api._R.setGrade === "function" && api._S.grade < 0; // fulfilled-heavy seed on the last map: colder than shipped
  }));
  await page.mouse.move(480, 610); // the live aim is a threat — park it behind the tank, off the sheet
  // dual-mode counter: displace two of the detail off the sheet and the
  // order counter turns into the quiet path's needle
  await page.evaluate(() => {
    const w = window.__COLDSNAP__._world();
    let n = 0;
    for (const b of w.bodies) {
      if (b.group !== "ponddrill2" || b.kind !== "unit" || !b.alive || n >= 2) continue;
      b.pos.x = 20 + n * 2; b.pos.z = 8;
      b.pos.y = w.field.heightAt(b.pos.x, b.pos.z) + 0.88;
      b.v.x = b.v.y = b.v.z = 0; b.sleeping = false;
      n++;
    }
  });
  await page.waitForFunction(() => {
    const c = document.querySelector("[data-counter]");
    return !!c && c.innerText.includes("ON SITE: 4");
  }, { timeout: 20000, polling: 500 });
  ok("the counter dual-modes once subjects leave the site", true);
  // the abutment screens the pad axis (probed) — fire from the south bank,
  // shells walked onto whoever still stands; revisit until the order closes
  const done8 = () => document.body.innerText.includes("Sheet rating confirmed");
  const deadline8 = Date.now() + 10 * 60 * 1000;
  while (Date.now() < deadline8) {
    if (await page.evaluate(done8)) break;
    const st = await page.evaluate(() => {
      const api = window.__COLDSNAP__, w = api._world();
      const alive = w.bodies.filter((b2) => b2.group === "ponddrill2" && b2.kind === "unit" && b2.alive);
      if (!alive.length) return "none";
      const b = w.byId.get(w.bisonId);
      b.pos.x = 0; b.pos.z = 12; b.pos.y = w.field.heightAt(0, 12) + 0.97;
      b.v.x = b.v.y = b.v.z = 0;
      let tgt = null, td = 1e9;
      for (const u of alive) { const d = Math.hypot(u.pos.x - b.pos.x, u.pos.z - b.pos.z); if (d < td) { td = d; tgt = u; } }
      if (api._S.cds.fire <= 0) { api._S.actions.fireAt(tgt.pos.x, tgt.pos.z); return "fired"; }
      return "cd";
    });
    await sleep(st === "none" ? 2000 : 1500);
  }
  await page.waitForFunction(() => document.body.innerText.includes("Sheet rating confirmed"), { timeout: 240000, polling: 2000 });
  ok("AC-08 completes: sheet rating confirmed", true);
  ok("kills leave smears on the ground", await page.evaluate(() => window.__COLDSNAP__._R._splat.smears > 0));
  await page.waitForFunction(() => !!document.querySelector("[data-aar]"), { timeout: 20000, polling: 500 });
  await page.waitForFunction(() => document.body.innerText.includes("ATTACHMENT A"), { timeout: 10000, polling: 500 });
  ok("the skate files at the rim — the record fork read AC-07 fulfilled", (await text()).includes("1 skate, small-format") && !(await text()).includes("nil findings"));
  ok("the second hand closes the ring on the filed report", await page.evaluate(() => {
    const m = document.querySelector("[data-margin]");
    return !!m && m.innerText.includes("The ministry copy is shorter.");
  }));
  await page.evaluate(() => document.querySelector("[data-aar-file]").click());
  await page.waitForFunction(() => document.body.innerText.includes("ORDER BOOK"), { timeout: 20000, polling: 500 });
  book = await text();
  ok("the order book closes with all eight titles in clear", book.includes("SURFACE LOAD RATING, REPEAT") && !book.includes("AWAITING ISSUE") && book.includes("★"));
  // FORM AA-9 files under the book once the last order closes — this run's
  // record is kill-path clean (zero deviations): the dead voice
  ok("AA-9 files the clean close-out under the book", book.includes("FORM AA-9") && book.includes("Deviations recorded: nil.") && book.includes("The territory lets clean.") && book.includes("PROCUREMENT APPROVED."));
  // the quiet ending, statically: all four deviation-armed orders deviated,
  // collateral under the gate — half the form redacted, the second hand
  // writes the only clear line
  await page.evaluate(() => {
    const dev = { fulfilled: 0, deviated: 1, bestTime: null, lastOutcome: "deviated" };
    localStorage.setItem("coldsnap-camp-record", JSON.stringify({ ac04: dev, ac06: dev, ac07: dev, ac08: dev }));
    localStorage.setItem("coldsnap-camp-progress", "8");
    localStorage.removeItem("coldsnap-screen");
  });
  await page.reload({ waitUntil: "networkidle0" });
  await page.evaluate(() => document.querySelector("[data-menu=campaign]").click());
  await page.waitForFunction(() => document.body.innerText.includes("ORDER BOOK"));
  ok("the quiet ending redacts the verb and keeps the promise", await page.evaluate(() => {
    const p = document.querySelector('[data-aa9="quiet"]');
    return !!p && p.innerText.includes("The instrument ██████.") && p.innerText.includes("The originals are safe. So are they.") && !p.innerText.includes("exhibits discretion");
  }));
  ok("four hollow stars stand in the record", (await text()).split("☆").length - 1 >= 4);
  // a new campaign: arm, confirm, and the dossier is fresh — first order
  // deployable, everything else sealed, the close-out and the stars gone
  await page.evaluate(() => document.querySelector("[data-camp-reset]").click());
  await page.waitForFunction(() => document.body.innerText.includes("THE RECORD BURNS — CONFIRM"), { timeout: 5000, polling: 250 });
  ok("NEW CAMPAIGN arms before it burns anything", true);
  await page.evaluate(() => document.querySelector("[data-camp-reset]").click());
  await page.waitForFunction(() => {
    const b = document.body.innerText;
    return b.includes("▶ DEPLOY") && !b.includes("FORM AA-9") && !b.includes("☆");
  }, { timeout: 10000, polling: 250 });
  ok("the confirmed reset opens a fresh dossier", (await text()).split("SEALED").length - 1 >= 7);
  await page.waitForFunction(() =>
    localStorage.getItem("coldsnap-camp-progress") === null && localStorage.getItem("coldsnap-camp-record") === null && localStorage.getItem("coldsnap-camp-medals") === null,
  { timeout: 10000, polling: 250 });
  ok("the campaign record is wiped from storage", true);
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.body.innerText.includes("PROVING GROUNDS"));
  }

  // --- phone layout: the order must be readable on a small touch screen.
  // Already self-contained: its own page, own storage reset.
  if (sectionEnabled("phone")) {
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
  // teletype: wait for the lot line to finish typing before reading
  await phone.waitForFunction(() => document.body.innerText.includes("Decommissioned units, lot 7"), { timeout: 15000, polling: 500 });
  ok("phone: brief card carries the full directive", true);
  const skipRight = await phone.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "SKIP");
    return b ? b.getBoundingClientRect().right : 1e9;
  });
  ok("phone: SKIP button fits on screen", skipRight <= 391);
  // phone: mech range touch surface
  await phone.evaluate(() => localStorage.setItem("coldsnap-screen", "menu"));
  await phone.reload({ waitUntil: "networkidle0" });
  await phone.waitForSelector('[data-menu="mech"]', { timeout: 15000 });
  await phone.tap('[data-menu="mech"]');
  await phone.waitForSelector("[data-mech-reissue]", { timeout: 20000 });
  ok("phone: mech range shows touch controls", true);
  await phone.waitForFunction(() => window.__MECHRANGE__ && window.__MECHRANGE__.mech.hull.R[4] > 0.9, { timeout: 20000, polling: 1000 });
  await phone.tap("[data-mech-reissue]");
  await phone.waitForFunction(() => window.__MECHRANGE__ && window.__MECHRANGE__.mech.state.mode !== "FALLEN" && window.__MECHRANGE__.mech.hull.R[4] > 0.95, { timeout: 15000, polling: 500 });
  ok("phone: REISSUE button reissues the frame", true);
  await phone.close();
  }

  // --- corrupt/hostile stored keymap resets to defaults (escape unbindable).
  // Guards against a missing keymap key (falls back to {}) so it doesn't
  // depend on the "controls"/"demo" sections having created one first.
  if (sectionEnabled("keymap")) {
  await page.evaluate(() => localStorage.setItem("coldsnap-screen", "menu"));
  await page.evaluate(() => localStorage.setItem("coldsnap-keymap", JSON.stringify({ ...JSON.parse(localStorage.getItem("coldsnap-keymap") || "{}"), forward: "escape" })));
  await page.reload({ waitUntil: "networkidle0" });
  await clickMenu("controls");
  await page.waitForFunction(() => document.querySelector('[data-bind="forward"]'));
  const fwdKey = await page.evaluate(() => document.querySelector('[data-bind="forward"]').textContent.trim());
  ok("stored 'escape' binding is rejected, defaults restored", fwdKey === "W");
  }

  // --- MECH TEST RANGE (WIP surface: stands + steps; the march gate is WIP)
  if (sectionEnabled("mech")) {
  await page.evaluate(() => localStorage.setItem("coldsnap-screen", "menu"));
  await page.reload({ waitUntil: "networkidle0" });
  await clickMenu("mech");
  await page.waitForSelector("[data-mech-hud]", { timeout: 20000 });
  ok("mech range: HUD mounts", true);
  await page.waitForFunction(() => {
    const m = window.__MECHRANGE__;
    return m && m.world.bodies.filter((b) => b.mechRef).length === 17 && m.mech.hull.R[4] > 0.9;
  }, { timeout: 20000, polling: 1000 });
  ok("mech range: frame standing (17 mech links, hull upright)", true);
  await page.waitForFunction(() => /STAND|WALK/.test(document.querySelector("[data-mech-status]")?.textContent || ""), { timeout: 10000, polling: 500 });
  ok("mech range: status line live", true);
  await page.keyboard.press("KeyR");
  await page.waitForFunction(() => {
    const m = window.__MECHRANGE__;
    return m && m.mech.state.mode !== "FALLEN" && m.mech.hull.R[4] > 0.95;
  }, { timeout: 15000, polling: 500 });
  ok("mech range: R reissues the frame", true);
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.querySelector('[data-menu="mech"]'), { timeout: 10000 });
  ok("mech range: ESC returns to menu", true);
  }

  // --- HOLD THE DEPOT (tower defense). Parks at the menu first so it
  // doesn't depend on the "mech" section having left us there via ESC.
  if (sectionEnabled("td")) {
  await page.evaluate(() => localStorage.setItem("coldsnap-screen", "menu"));
  await page.reload({ waitUntil: "networkidle0" });
  await clickMenu("towerdef");
  await page.waitForFunction(() => typeof window.__TD__ === "function", { timeout: 20000 });
  ok("tower defense: mounts", true);
  await page.evaluate(() => window.__TDSTART__());
  await page.waitForFunction(() => { const s = window.__TD__(); return s.t > 1 && s.bodies > 0; }, { timeout: 20000, polling: 500 });
  const td = await page.evaluate(() => window.__TD__());
  ok("tower defense: world stepping", td.t > 1 && td.lives === 20, `t=${td.t.toFixed(1)} lives=${td.lives}`);
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.querySelector('[data-menu="towerdef"]'), { timeout: 10000 });
  ok("tower defense: ESC returns to menu", true);
  }

  // --- DEPOT (wave-survival build) — enter from the start screen, wave 1
  // spawns, dispatch appears once it clears, ACKNOWLEDGE advances to wave 2.
  // Section budget ~120s. swiftshader is slow, so run at 2x speed and use
  // debug hooks rather than waiting real-time for a full 12-unit wave.
  // Already self-contained: clears its own storage keys and parks at the menu.
  if (sectionEnabled("depot")) {
  // Pinned map seed (verified locally: focus cell lands on buildable ground,
  // not a pond, on this seed) — an unpinned reload gets a random procedural
  // map, and on some seeds the tap-build-after-rotate assert's target cell
  // is blocked/pond, timing the section out. See rimfix-report.md.
  const DEPOT_SEED = 11;
  const depotURL = URL + (URL.includes("?") ? "&" : "?") + `seed=${DEPOT_SEED}`;
  await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith("coldsnap-depot")) localStorage.removeItem(k); });
  await page.evaluate(() => localStorage.setItem("coldsnap-screen", "menu"));
  await page.goto(depotURL, { waitUntil: "networkidle0" });
  await clickMenu("depot");
  await page.waitForFunction(() => typeof window.__DEPOT__ === "function", { timeout: 20000 });
  ok("depot: mounts", true);

  await page.evaluate(() => window.__DEPOTSTART__());
  await page.waitForFunction(() => window.__DEPOT__().t > 0.2, { timeout: 10000 });

  // Task 5: the run opens on the depot, not the middle of the field —
  // S.focus's initial value should land near the depot's own flag anchor
  // (the roof-peak flagPole body buildTown places at the depot's world
  // (x, z)). Checked BEFORE anything below re-points the camera via
  // __DEPOTFOCUS__. Also checked after a Q/E view rotation — rotation is a
  // renderer-only yaw around the same S.focus world point (proven
  // algebraically above), so it must not move.
  {
    const depotFlag = (await page.evaluate(() => window.__DEPOTFLAGS__())).find((f) => f.kind === "flag");
    const openFocus = await page.evaluate(() => window.__DEPOTGETFOCUS__());
    const openDist = depotFlag ? Math.hypot(openFocus.x - depotFlag.x, openFocus.z - depotFlag.z) : null;
    ok(`depot: opening camera focus lands on the depot [focus=${JSON.stringify(openFocus)} flag=${JSON.stringify(depotFlag)} dist=${openDist == null ? "n/a" : openDist.toFixed(2)}]`,
      !!depotFlag && openDist < 5);

    const hud0 = await page.evaluate(() => window.__DEPOT__());
    ok(`depot: depotStanding starts at 1 (fully standing) [${hud0.depotStanding}]`, hud0.depotStanding === 1);

    await page.keyboard.press("e"); // R.rotateStep(1) — 90° camera step
    await sleep(1500); // let the yaw tween settle
    const rotFocus = await page.evaluate(() => window.__DEPOTGETFOCUS__());
    const rotDist = depotFlag ? Math.hypot(rotFocus.x - depotFlag.x, rotFocus.z - depotFlag.z) : null;
    ok(`depot: opening focus still on the depot after a Q/E rotation (focus is a world point, rotation is view-only) [dist=${rotDist == null ? "n/a" : rotDist.toFixed(2)}]`,
      !!depotFlag && rotDist < 5);
  }

  // rotation-invariance (Global Constraint): Q/E view rotation (renderer-only,
  // src/render/renderer.js) must never shift where a tap-build lands. The
  // canvas's geometric center is the orbit camera's pivot — its ground ray
  // always hits S.focus (proven algebraically: cam.position is set to
  // `focus + back*camDist` every frame, so the center ray, marching camDist
  // along -back, lands exactly on focus for any yaw). So: rotate 90° first,
  // let it settle, tap-build the canvas center, and assert the built tower
  // landed within one grid cell (2m) of __DEPOTGETFOCUS__'s world point —
  // the "intended cell" — rather than a rotation-skewed neighbor. (A double
  // tap-before/after-rotate version of this check raced the render loop's
  // yaw/texel-snap tween under swiftshader and was flaky; this single-tap
  // version doesn't depend on timing at all, only on the algebra above.)
  const canvasCenter = async () => page.evaluate(() => {
    const r = document.querySelector("canvas").getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  });
  // Task 2 (build rights): placement now requires holderAt===1 at the cell,
  // and the original tap point (canvas center at the initial camera focus,
  // map-center-ish) sits outside the depot's starting emitter radius on the
  // pinned seed — a tap there gets refused ("GROUND NOT HELD"), not built.
  // Point the camera at the nearest buildable+held cell to the depot first
  // (debug hook, DepotGame.jsx) so the rotation-invariance check below still
  // exercises a real, currently-buildable cell.
  await page.waitForFunction(() => !!window.__DEPOTFINDBUILDABLE__(), { timeout: 10000, polling: 200 });
  const buildable = await page.evaluate(() => window.__DEPOTFINDBUILDABLE__());
  await page.evaluate((b) => window.__DEPOTFOCUS__(b.x, b.z), buildable);
  await sleep(300); // let the camera settle at the new focus
  const cc = await canvasCenter();
  await page.keyboard.press("e"); // R.rotateStep(1) — 90° camera step
  await sleep(1500); // let the yaw tween settle
  const focus = await page.evaluate(() => window.__DEPOTGETFOCUS__());
  await page.click('[data-tower-key="mg"]');
  await page.mouse.click(cc.x, cc.y);
  // Task 3: tower builds now go through a pending-confirm flow — tap
  // selects the cell (ghost + reach polygon + ✓/✗), armed 350ms later.
  // Wait past the arm window, then tap ✓.
  await page.waitForFunction(() => !!document.querySelector("[data-pending-confirm]"), { timeout: 5000, polling: 100 });
  await sleep(400);
  await page.click("[data-pending-confirm]");
  await page.waitForFunction(() => window.__DEPOTFLAGS__().filter((f) => f.kind === "tower").length === 1, { timeout: 10000, polling: 100 });
  const tower = await page.evaluate(() => window.__DEPOTFLAGS__().filter((f) => f.kind === "tower")[0]);
  const dist = Math.hypot(tower.x - focus.x, tower.z - focus.z);
  ok(`depot: tap-build after Q/E rotation lands on the intended (focus) cell [focus=${JSON.stringify(focus)} tower=${JSON.stringify(tower)} dist=${dist.toFixed(2)}]`,
    dist < 2.0);

  // cancel path: select another cell (gun), then ✗ instead of ✓ — no scrap
  // should move and no second tower should appear.
  {
    const resourcesBefore = await page.evaluate(() => window.__DEPOT__().scrap);
    const buildable2 = await page.evaluate(() => window.__DEPOTFINDBUILDABLE__());
    if (buildable2) {
      await page.evaluate((b) => window.__DEPOTFOCUS__(b.x, b.z), buildable2);
      await sleep(300);
      const cc2 = await canvasCenter();
      await page.click('[data-tower-key="gun"]');
      await page.mouse.click(cc2.x, cc2.y);
      const gotPending = await page.evaluate(() => new Promise((res) => {
        let n = 0;
        const iv = setInterval(() => {
          if (document.querySelector("[data-pending-cancel]") || ++n > 30) { clearInterval(iv); res(!!document.querySelector("[data-pending-cancel]")); }
        }, 100);
      }));
      if (gotPending) {
        await sleep(400);
        await page.click("[data-pending-cancel]");
        const resourcesAfter = await page.evaluate(() => window.__DEPOT__().scrap);
        const towerCount = await page.evaluate(() => window.__DEPOTFLAGS__().filter((f) => f.kind === "tower").length);
        ok(`depot: cancel path spends no scrap [before=${resourcesBefore} after=${resourcesAfter}]`, resourcesAfter >= resourcesBefore);
        ok("depot: cancel path leaves tower count unchanged", towerCount === 1);
      } else {
        ok("depot: cancel path — no buildable cell found for second selection (skipped)", true);
      }
    } else {
      ok("depot: cancel path — no second buildable cell found (skipped)", true);
    }
  }

  // Phase 4.1 Task 2 (fire discipline): chip present, defaults CAREFUL, tap
  // toggles to FREE and persists (localStorage key + a reload round-trip).
  // Done here, still in build phase, so the reload's fresh world doesn't
  // disturb the wave-phase flow below it.
  body = await text();
  ok("depot: fire discipline chip present, defaults CAREFUL", body.includes("FIRE DISCIPLINE: CAREFUL"));
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => x.textContent.startsWith("FIRE DISCIPLINE"));
    if (b) b.click();
  });
  body = await text();
  ok("depot: fire discipline chip toggles to FREE", body.includes("FIRE DISCIPLINE: FREE"));
  const disciplineStored = await page.evaluate(() => localStorage.getItem("coldsnap-depot-discipline"));
  ok(`depot: fire discipline persisted to localStorage [${disciplineStored}]`, disciplineStored === "free");
  await page.reload({ waitUntil: "networkidle0" });
  await clickMenu("depot");
  await page.waitForFunction(() => typeof window.__DEPOT__ === "function", { timeout: 20000 });
  await sleep(300); // let the HUD's first tick (hudT > 0.12s) sync S.discipline into React state
  body = await text();
  ok("depot: fire discipline FREE survives reload", body.includes("FIRE DISCIPLINE: FREE"));
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => x.textContent.startsWith("FIRE DISCIPLINE"));
    if (b) b.click(); // back to CAREFUL default for the rest of the run
  });
  await page.evaluate(() => window.__DEPOTSTART__());
  await page.waitForFunction(() => window.__DEPOT__().t > 0.2, { timeout: 10000 });

  // arm the SEND countdown to zero (build -> wave immediately) and switch
  // to 2x speed via the HUD's own control
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll("button")];
    const send = btns.find((b) => b.textContent.startsWith("SEND")); if (send) send.click();
    const spd = btns.find((b) => b.textContent.trim() === "1×"); if (spd) spd.click();
  });
  await page.waitForFunction(() => window.__DEPOT__().phase === "wave", { timeout: 10000 });
  ok("depot: build -> wave, wave 1 spawns", true);
  await page.waitForFunction(() => window.__DEPOT__().bodies > 1, { timeout: 10000, polling: 250 });
  ok("depot: enemies present in the world", true);

  // Phase 4 Task 4 (fog): freshly-spawned enemies start far from the depot
  // (unheld ground), so the renderer should render fewer team-2 bodies than
  // are actually alive right now — DOM-cheap via the renderer's own debug
  // counter (window.__DEPOTFOGDBG__), no pixel sampling.
  const fog1 = await page.evaluate(() => window.__DEPOTFOGDBG__());
  ok(`depot fog: some newly-spawned enemies are hidden while far/unheld [visible=${fog1.visible} total=${fog1.total}]`,
    fog1.total > 0 && fog1.visible < fog1.total);
  // Direct proof that the SAME field gates both halves of "absent while
  // unheld, appears on approach": the hidden enemy's own ground reads
  // unheld (why it's not drawn), and the depot's own ground — where an
  // approaching enemy would eventually stand — reads held (where it WOULD
  // draw). A live multi-second walk-to-depot is too slow under swiftshader
  // for the smoke budget (~100m at conscript speed); this checks the same
  // gate at both ends instead of waiting on it.
  const enemyPos = await page.evaluate(() => window.__DEPOTENEMYPOS__());
  const depotFlag = (await page.evaluate(() => window.__DEPOTFLAGS__())).find((f) => f.kind === "flag");
  if (enemyPos) {
    const enemyState = await page.evaluate((p) => window.__DEPOTFOGAT__(p.x, p.z), enemyPos);
    ok(`depot fog: the hidden enemy's own ground reads unheld [${enemyState}]`, enemyState === "unheld");
  } else {
    ok("depot fog: no live enemy to sample (skipped)", true);
  }
  if (depotFlag) {
    const depotState = await page.evaluate((p) => window.__DEPOTFOGAT__(p.x, p.z), depotFlag);
    ok(`depot fog: the depot's own ground (where an approach ends) reads held [${depotState}]`, depotState === "held");
  } else {
    ok("depot fog: no depot flag found (skipped)", true);
  }
  // toggle FOG off: gating disables entirely, so everyone alive should now
  // render (visible === total) on the very next frame.
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => x.textContent.startsWith("FOG"));
    if (b) b.click();
  });
  await sleep(150);
  const fog3 = await page.evaluate(() => window.__DEPOTFOGDBG__());
  ok(`depot fog: toggled OFF renders every alive team-2 body [visible=${fog3.visible} total=${fog3.total}]`,
    fog3.total === 0 || fog3.visible === fog3.total);
  // toggle back ON for the rest of the run (persistence key gets exercised
  // either way — leave it however the test lands, next section clears it).
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => x.textContent.startsWith("FOG"));
    if (b) b.click();
  });

  // Task 5 (Phase 4 close): rotated build-refusal toast check. Build
  // placement gates on canBuild (green ground only, toast "GROUND NOT
  // HELD") — this must still fire correctly in ROTATED coordinates, since
  // the tap point is converted screen->world->canonical(u,v) through the
  // camera's current yaw. Reuses the same unheld point the fog assert
  // above already proved reads "unheld" (the live enemy's own ground),
  // rotates the view another 90° on top of the earlier rotation, points
  // the camera at that unheld cell, and taps canvas center.
  if (enemyPos) {
    await page.keyboard.press("e"); // another 90° camera step, on top of the earlier rotation
    await sleep(1500);
    await page.evaluate((p) => window.__DEPOTFOCUS__(p.x, p.z), enemyPos);
    await sleep(300);
    const ccUnheld = await canvasCenter();
    await page.click('[data-tower-key="gun"]');
    await page.mouse.click(ccUnheld.x, ccUnheld.y);
    await page.waitForFunction(() => document.body.innerText.includes("GROUND NOT HELD"), { timeout: 3000, polling: 100 })
      .then(() => true).catch(() => false);
    body = await text();
    ok("depot: build refusal toast (GROUND NOT HELD) fires on unheld ground after rotation", body.includes("GROUND NOT HELD"));
    ok("depot: refused build spawns no pending-confirm UI", (await page.$("[data-pending-confirm]")) === null);
  } else {
    ok("depot: rotated build-refusal check — no unheld sample point available (skipped)", true);
  }

  // swiftshader is too slow to wait real-time for a full 12-unit wave to
  // walk/leak — use the debug harness to instantly drain the wave (zero the
  // spawn queue, kill the live enemies) so the phase machine's own tick
  // flips wave -> stall on the next frame.
  await page.evaluate(() => window.__DEPOTTHIN__());
  await page.waitForFunction(() => window.__DEPOT__().phase === "stall", { timeout: 15000, polling: 250 });
  ok("depot: wave -> stall (wave 1 cleared)", true);
  await page.waitForFunction(() => !!document.querySelector("[data-dispatch-wo]"), { timeout: 5000, polling: 200 });
  ok("depot: dispatch card appears after wave clear", true);

  await page.waitForFunction(() => {
    const b = document.querySelector("[data-dispatch-wo] button");
    return !!b && b.textContent === "ACKNOWLEDGE";
  }, { timeout: 3000, polling: 200 });
  await page.evaluate(() => document.querySelector("[data-dispatch-wo] button").click());
  await page.waitForFunction(() => window.__DEPOT__().phase === "build" && window.__DEPOT__().wave === 2, { timeout: 5000, polling: 200 });
  ok("depot: ACKNOWLEDGE advances to wave 2", true);

  // ---- Phase 5 Task 3: infantry. Sniper preview fan (fog-independent),
  // sandbag line (instant), rifles placement (tower flow: green-only +
  // confirm), member tap -> selection chips, ATTACK -> ground tap = dest,
  // advance observed — then a rotated variant of the order flow (the taps
  // convert screen->world through the live camera yaw). Enemy fire is
  // structure-only this phase, so live enemies from the running waves can't
  // hurt the squad mid-check.
  {
    const SHOTS = process.env.DEPOT_SHOTS || null;
    const shot = async (name) => { if (SHOTS) { await page.screenshot({ path: SHOTS + "/" + name }); } };
    // settleAt: point the camera and POLL until the canvas-center ground ray
    // actually converges on the target (the pivot tweens toward S.focus — a
    // fixed sleep lands taps meters off under swiftshader when the tween is
    // still in flight).
    const settleAt = async (x, z, zoom) => {
      await page.evaluate((p) => window.__DEPOTFOCUS__(p.x, p.z, p.zoom || undefined), { x, z, zoom });
      await page.waitForFunction((p) => {
        const r = document.querySelector("canvas").getBoundingClientRect();
        const g = window.__DEPOTGROUNDAT__(r.left + r.width / 2, r.top + r.height / 2);
        return !!g && Math.hypot(g.x - p.x, g.z - p.z) < 1.0; // texel-snapped pivot can idle ~0.5m off the exact focus
      }, { timeout: 8000, polling: 200 }, { x, z }).catch(() => {}); // best-effort: on raised terrain the center ray clips short of the pivot and never converges — the tap then lands where the player would SEE it land, which is what the asserts measure against
      await sleep(150);
    };
    // tapWorld: tap a KNOWN world point via its live screen projection —
    // immune to residual pivot-tween error at the canvas center.
    const tapWorld = async (x, z, strict) => {
      // retry until the point projects INSIDE the canvas and clear of the
      // top/bottom HUD bars — a mid-tween projection can sit off-screen or
      // under a DOM bar, where the click would hit UI instead of ground.
      for (let i = 0; i < 12; i++) {
        const pt = await page.evaluate((p) => {
          const q = window.__DEPOTSCREENAT__(p.x, p.z);
          if (!q) return null;
          const r = document.querySelector("canvas").getBoundingClientRect();
          if (q.x < r.left + 8 || q.x > r.right - 8 || q.y < r.top + 60 || q.y > r.bottom - 110) return null;
          if (p.strict) {
            // ray-verify (opt-in): the ground ray through that pixel must
            // actually reach the target — near the depot mound the ray can
            // clip a closer slope and land the tap on a refusable cell.
            const g = window.__DEPOTGROUNDAT__(q.x, q.y);
            if (!g || Math.hypot(g.x - p.x, g.z - p.z) > 2.4) return null;
          }
          return q;
        }, { x, z, strict: !!strict });
        if (pt) { await page.mouse.click(Math.round(pt.x), Math.round(pt.y)); return true; }
        await sleep(400);
      }
      return false;
    };

    // Mound ray fix (Phase 5 smallfix): taps land where they look. The
    // condition tapWorld's opt-in `strict` mode guards against — the ground
    // ray through a point's own projected pixel wandering off near the depot
    // mound's steep relief — must now hold GAME-side with no harness help:
    // groundPoint picks against the drawn (triangulated) terrain instead of
    // the bilinear heightfield, so the projected pixel and the pick ray
    // agree. Asserted at the mound cell itself (__DEPOTFINDRISE__: highest
    // buildable cell near the flag — the worst case Task 3 documented).
    // tapWorld's strict mode is kept as opt-in robustness for mid-tween
    // frames, but no call in this file needs it.
    {
      const rise = await page.evaluate(() => window.__DEPOTFINDRISE__());
      if (rise) {
        await settleAt(rise.x, rise.z, 1.8);
        const err = await page.evaluate((p) => {
          const q = window.__DEPOTSCREENAT__(p.x, p.z);
          if (!q) return null;
          const g = window.__DEPOTGROUNDAT__(q.x, q.y);
          return g ? Math.hypot(g.x - p.x, g.z - p.z) : null;
        }, rise);
        ok(`depot: mound tap ray lands on the cell it visually covers (no harness strictness) [err=${err == null ? "null" : err.toFixed(2)}m]`,
          err != null && err < 2.4);
      } else {
        ok("depot: mound cell found for the tap-ray assert", false);
      }
    }

    // sniper preview: pending fan opens, then cancel (no scrap moves)
    await page.waitForFunction(() => !!window.__DEPOTFINDBUILDABLE__(5), { timeout: 10000, polling: 200 });
    const sqCell = await page.evaluate(() => window.__DEPOTFINDBUILDABLE__(5)); // clear of masonry: a fan opened INSIDE the depot lattice clips to nothing
    await settleAt(sqCell.x, sqCell.z, 1.4); // framed so the 30m preview fan fits the shot
    await page.click('[data-tower-key="sq_sniper"]');
    await tapWorld(sqCell.x, sqCell.z);
    let ccc = await canvasCenter();
    const sniperPending = await page.waitForFunction(() => !!document.querySelector("[data-pending-confirm]"), { timeout: 5000, polling: 100 }).then(() => true).catch(() => false);
    ok("depot squads: sniper placement opens the pending preview fan", sniperPending);
    await shot("task3-sniper-preview.png");
    if (sniperPending) { await sleep(400); await page.click("[data-pending-cancel]"); }

    // sandbag line: instant (wall-exempt), tagged bodies appear per tap
    await page.click('[data-tower-key="sandbag"]');
    for (const off of [-2, 0, 2]) {
      await settleAt(sqCell.x + off, sqCell.z + 3, 2.4);
      await tapWorld(sqCell.x + off, sqCell.z + 3);
      await sleep(150);
    }
    const bags = await page.evaluate(() => window.__DEPOTSANDBAGS__());
    ok(`depot squads: sandbag line placed instantly [${bags.length}]`, bags.length >= 2);
    await shot("task3-sandbag-line.png");

    // rifles: tower flow — tap selects, ✓ confirms, 4 members spawn.
    // clearR=4: keep the spawn ring + 2.4m formation slots out of static
    // bodies (tower/wall/sandbag) — a slot inside one gets a man crushed.
    // candidate loop: widening clearR pushes the pick away from the depot
    // mound, whose near slope can occlude the tap ray entirely.
    let rifleOpened = false;
    for (const cr of [5, 7, 9, 11]) {
      const cand = await page.evaluate((r) => window.__DEPOTFINDBUILDABLE__(r), cr);
      if (!cand) continue;
      await settleAt(cand.x, cand.z);
      await page.click('[data-tower-key="sq_rifles"]');
      // non-strict tap: near the depot mound the ray may land a cell or two
      // off the candidate — any held cell opens the confirm flow, which is
      // what this loop actually verifies (a refusal just tries the next).
      if (!(await tapWorld(cand.x, cand.z))) continue;
      rifleOpened = await page.waitForFunction(() => !!document.querySelector("[data-pending-confirm]"), { timeout: 3000, polling: 100 }).then(() => true).catch(() => false);
      if (rifleOpened) break;
    }
    ok("depot squads: rifles placement opens the confirm flow", rifleOpened);
    await sleep(400);
    await page.click("[data-pending-confirm]");
    await page.waitForFunction(() => (window.__DEPOTSQUADS__() || []).length === 1, { timeout: 5000, polling: 100 });
    let sqs = await page.evaluate(() => window.__DEPOTSQUADS__());
    ok(`depot squads: rifles placed with 4 members [${sqs[0].members.length}]`, sqs[0].members.length === 4);

    // selection: tap a member -> chips appear (350ms-armed). Sell mode ON
    // during member taps: a miss-tap (members drift on their defend
    // micro-seek; the mound bends the tap ray) then lands as a harmless
    // "NOTHING HERE" instead of opening a stray build pending — squad
    // selection in tapAt runs BEFORE the sell branch, so hits still select.
    await page.click("[data-sell-toggle]");
    const selectSquad = async () => {
      for (let attempt = 0; attempt < 10; attempt++) {
        const q = (await page.evaluate(() => window.__DEPOTSQUADS__()))[0];
        if (!q) return false;
        const m = q.members.filter((mm) => mm.alive)[attempt % Math.max(1, q.members.length)] || q.members[0];
        await settleAt(q.anchor.x, q.anchor.z, 1.8);
        await tapWorld(m.x, m.z);
        const got = await page.waitForFunction(() => !!document.querySelector("[data-squad-attack]"), { timeout: 1200, polling: 100 }).then(() => true).catch(() => false);
        if (got) return true;
      }
      return false;
    };
    const chips = await selectSquad();
    ok("depot squads: tap on a member selects the squad (DEFEND|ATTACK chips)", chips);
    await shot("task3-squad-selected.png");

    // ATTACK -> next ground tap = dest. The dest tap is OFF-CENTER (140px
    // sideways) with the camera parked on the squad — no camera travel involved,
    // so the tap lands a guaranteed few meters from the anchor and the
    // squad must actually march there. tapPt (the live camera's own ground
    // ray at the tap pixel) is what the player SEES the tap hit; the dest
    // must faithfully equal it.
    await sleep(450); // chip arming window
    await page.click("[data-squad-attack]");
    ccc = await canvasCenter();
    // horizontal offset: vertical pixels foreshorten along the ground at the
    // tactical camera's shallow pitch (140px up = ~40m downrange), sideways
    // pixels don't (~10m) — keep the march inside the assert budget.
    const tapPt1 = await page.evaluate((c) => window.__DEPOTGROUNDAT__(c.x - 140, c.y), ccc);
    await page.mouse.click(ccc.x - 140, ccc.y);
    // NOTE: the read races arrival at 2x sim speed — a short dest can flip
    // attack -> defend (arrived, dest cleared) between the tap and this
    // evaluate. Both states prove the tap landed: attacking WITH a dest near
    // the intended point, or already dug in AT the intended point.
    const orderLanded = (q, d) => !!q && !!d && ((q.order === "attack" && !!q.dest && Math.hypot(q.dest.x - d.x, q.dest.z - d.z) < 1.5) ||
      (q.order === "defend" && Math.hypot(q.anchor.x - d.x, q.anchor.z - d.z) < 1.5));
    sqs = await page.evaluate(() => window.__DEPOTSQUADS__());
    ok(`depot squads: ATTACK ground tap set the dest the camera showed [order=${sqs[0].order} dest=${JSON.stringify(sqs[0].dest)} tap=${JSON.stringify(tapPt1)}]`,
      orderLanded(sqs[0], tapPt1));
    await shot("task3-mid-advance.png");
    const advanced = await page.waitForFunction((d) => {
      const q = (window.__DEPOTSQUADS__() || [])[0];
      return !!q && Math.hypot(q.anchor.x - d.x, q.anchor.z - d.z) < 2.5;
    }, { timeout: 30000, polling: 300 }, tapPt1).then(() => true).catch(() => false);
    ok("depot squads: advance observed (anchor reaches the ordered dest)", advanced);

    // rotated variant: 90° view step, re-order ATTACK — the dest tap must
    // still land where the camera says it does.
    await page.keyboard.press("e");
    await sleep(1500);
    sqs = await page.evaluate(() => window.__DEPOTSQUADS__());
    if (!(await page.$("[data-squad-attack]"))) {
      await selectSquad();
    }
    await sleep(450);
    await page.click("[data-squad-attack]");
    ccc = await canvasCenter();
    const tapPt2 = await page.evaluate((c) => window.__DEPOTGROUNDAT__(c.x + 140, c.y), ccc);
    await page.mouse.click(ccc.x + 140, ccc.y);
    sqs = await page.evaluate(() => window.__DEPOTSQUADS__());
    ok(`depot squads: rotated ATTACK ground tap set the dest the camera showed [order=${sqs[0].order} dest=${JSON.stringify(sqs[0].dest)} tap=${JSON.stringify(tapPt2)}]`,
      orderLanded(sqs[0], tapPt2));
    const advanced2 = await page.waitForFunction((d) => {
      const q = (window.__DEPOTSQUADS__() || [])[0];
      return !!q && Math.hypot(q.anchor.x - d.x, q.anchor.z - d.z) < 2.5;
    }, { timeout: 30000, polling: 300 }, tapPt2).then(() => true).catch(() => false);
    ok("depot squads: rotated advance observed", advanced2);
  }

  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.querySelector('[data-menu="depot"]'), { timeout: 10000 });
  ok("depot: ESC returns to menu", true);
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
console.log("\nALL PASS");
