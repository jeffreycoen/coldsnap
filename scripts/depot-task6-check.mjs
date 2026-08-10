// One-off browser check for Task 6: clear wave 1, screenshot the dispatch
// card mid-teletype and after, then verify ACKNOWLEDGE (500ms-armed) starts
// wave 2. Not part of the regular test suite (Task 8 will consolidate depot
// browser checks into smoke.mjs).
import puppeteer from "puppeteer-core";

const URL = process.env.SMOKE_URL || "http://localhost:4173/coldsnap/";
const CHROME = process.env.CHROME_BIN || "/usr/bin/chromium";
const OUT = "/home/batman/coldsnap/.superpowers/sdd/2026-08-09-depot-phase-0-1";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const fails = [];
const ok = (name, cond, detail) => {
  console.log(`${cond ? "PASS" : "FAIL"} — ${name}${detail ? " (" + detail + ")" : ""}`);
  if (!cond) fails.push(name);
};

const browser = await puppeteer.launch({
  protocolTimeout: 600000,
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--enable-unsafe-swiftshader", "--window-size=960,600"],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 960, height: 600 });
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));

  await page.goto(URL, { waitUntil: "networkidle0" });
  await page.evaluate(() => document.querySelector('[data-menu="depot"]').click());
  await page.waitForFunction(() => typeof window.__DEPOT__ === "function", { timeout: 20000 });
  ok("depot mounts", true);

  await page.evaluate(() => window.__DEPOTSTART__());
  await page.waitForFunction(() => window.__DEPOT__().t > 0.2, { timeout: 10000 });

  // force the SEND countdown to zero so build->wave fires immediately, and
  // run at 2x so wave 1 (12 conscripts, no walls built) clears in a
  // reasonable wall-clock time under swiftshader
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll("button")];
    const send = btns.find((b) => b.textContent.startsWith("SEND")); if (send) send.click();
    const spd = btns.find((b) => b.textContent.trim() === "1×"); if (spd) spd.click();
  });
  await page.waitForFunction(() => window.__DEPOT__().phase === "wave", { timeout: 10000 });
  ok("build -> wave", true);

  // wave 1 fully drains via leaks (no walls built) — waits for the phase
  // machine to land on "stall"
  await page.waitForFunction(() => window.__DEPOT__().phase === "stall", { timeout: 300000, polling: 1000 });
  ok("wave -> stall (wave 1 cleared)", true);

  // mid-teletype screenshot — dispatch mounts with armed=false and Typed at n=0
  await sleep(120);
  await page.waitForSelector("[data-dispatch-wo]", { timeout: 5000 });
  await page.screenshot({ path: `${OUT}/task6-dispatch-mid-teletype.png` });
  ok("mid-teletype screenshot saved", true);

  await sleep(900); // typed text finishes + 500ms arm window passes
  await page.screenshot({ path: `${OUT}/task6-dispatch-armed.png` });
  ok("post-teletype/armed screenshot saved", true);

  const buttonText = await page.evaluate(() => {
    const el = document.querySelector("[data-dispatch-wo] button");
    return el ? el.textContent : null;
  });
  ok("ACKNOWLEDGE button present", buttonText === "ACKNOWLEDGE", buttonText);

  await page.evaluate(() => { const b = document.querySelector("[data-dispatch-wo] button"); if (b) b.click(); });
  await page.waitForFunction(() => window.__DEPOT__().phase === "build" && window.__DEPOT__().wave === 2, { timeout: 5000 });
  ok("ACKNOWLEDGE advances to wave 2 build phase", true);

  const dispatchGone = await page.evaluate(() => !document.querySelector("[data-dispatch-wo]"));
  ok("dispatch card dismissed after ACKNOWLEDGE", dispatchGone);

  // wave chip re-read
  await page.evaluate(() => { const els = [...document.querySelectorAll("div")]; const chip = els.find((d) => d.textContent.trim().startsWith("W 2/")); if (chip) chip.click(); });
  await page.waitForFunction(() => !!document.querySelector("[data-dispatch-wo]"), { timeout: 3000 });
  ok("wave chip re-opens last dispatch", true);
  const rereadText = await page.evaluate(() => document.querySelector("[data-dispatch-wo] button").textContent);
  ok("re-read card shows CLOSE (non-gating)", rereadText === "CLOSE", rereadText);

  ok("no page errors", pageErrors.length === 0, pageErrors.join("; "));
} finally {
  await browser.close();
}

if (fails.length) {
  console.error(`\n${fails.length} FAILURE(S)`);
  process.exit(1);
}
console.log("\nALL PASS");
