// C: feel playthrough, phone landscape — part 1: approach, alert, missiles, cannon
import puppeteer from "puppeteer-core";
import { makeMT } from "../wtq/mt.mjs";
const browser = await puppeteer.launch({ protocolTimeout: 600000, executablePath: "/usr/bin/chromium", headless: true, args: ["--no-sandbox", "--disable-gpu", "--enable-unsafe-swiftshader"] });
const phone = await browser.newPage();
const errs = [];
phone.on("pageerror", (e) => errs.push(String(e).slice(0, 120)));
await phone.emulate({ viewport: { width: 844, height: 390, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, userAgent: "Mozilla/5.0 (iPhone)" });
await phone.goto("http://localhost:4179/coldsnap/", { waitUntil: "networkidle0" });
await phone.evaluate(() => localStorage.setItem("coldsnap-screen", "menu"));
await phone.reload({ waitUntil: "networkidle0" });
await phone.waitForSelector('[data-menu="mech"]', { timeout: 15000 });
await phone.tap('[data-menu="mech"]');
await phone.waitForSelector("[data-mech-reissue]", { timeout: 20000 });
await phone.waitForFunction(() => window.__MECHRANGE__ && window.__MECHRANGE__.mech.hull.R[4] > 0.9, { timeout: 20000, polling: 500 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const status = () => phone.evaluate(() => document.querySelector("[data-mech-status]").textContent);
await sleep(1200);
await phone.screenshot({ path: "wtc/p1-spawn.png" });
console.log("spawn:", await status());
// approach: hold forward 10s
const mt = await makeMT(phone);
await mt.start(1, 86, 260);
await mt.move(1, 86, 220);
await sleep(10000);
await mt.end(1);
await sleep(1500);
console.log("after approach:", await status());
await phone.screenshot({ path: "wtc/p1-approach.png" });
// missiles at 40m
await phone.evaluate(() => { window.__MECHRANGE__.mech.aimRange = 40; });
await phone.tap("[data-mech-msl]");
await sleep(2500);
console.log("after MSL:", await status());
await phone.screenshot({ path: "wtc/p1-msl.png" });
// cannon burst
await phone.evaluate(() => { const m = window.__MECHRANGE__; m.fireHeld(true); });
await sleep(2200);
await phone.evaluate(() => { const m = window.__MECHRANGE__; m.fireHeld(false); });
await sleep(800);
console.log("after cannon:", await status());
await phone.screenshot({ path: "wtc/p1-cannon.png" });
console.log("pageerrors:", errs.length ? errs.join(" | ") : "none");
await browser.close();
