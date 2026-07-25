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
  ok("sandbox runs the scenario pipeline with sheltering on", shelters === 5); // 4 houses + the keep (enterable since AC-05)
  // play it: a volley on the gunnery pad should fulfil WO-01 outright
  await page.mouse.click(480, 300); // dismiss deploy overlay
  await page.waitForFunction(() => !!document.querySelector("[data-brief]"));
  body = await text();
  ok("work-order brief card presents WO-01", body.includes("WORK ORDER") && body.includes("Decommissioned units, lot 7"));
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

  // --- clearance program: order book gating, AC-01 completes, AC-02 unseals
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
  await sleep(400);
  await page.evaluate(() => document.querySelector("[data-brief-ack]").click());
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
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.body.innerText.includes("PROVING GROUNDS"));

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
  ok("phone: brief card carries the full directive", phoneBody.includes("Decommissioned units, lot 7"));
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
