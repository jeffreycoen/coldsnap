// C: feel playthrough part 2 — punt, ONE LEG, 180, jets, gyro-off, reissue
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
const label = (sel) => phone.evaluate((s) => document.querySelector(s).textContent.trim(), sel);
await sleep(1200);
// PUNT: status should show PUNT PENDING then clear
await phone.tap("[data-mech-punt]");
await sleep(600);
console.log("punt status:", await status());
await sleep(4000);
console.log("punt done:", await status());
// ONE LEG: label flips to LOWER while held
await phone.tap("[data-mech-poise]");
await sleep(2500);
console.log("poise label:", await label("[data-mech-poise]"), "|", await status());
await phone.screenshot({ path: "wtc/p2-oneleg.png" });
await phone.tap("[data-mech-poise]");
await sleep(3500);
console.log("lowered:", await label("[data-mech-poise]"), "|", await status());
// 180: status shows the maneuver
await phone.tap("[data-mech-about]");
await sleep(1500);
console.log("180 status:", await status());
console.log("(waiting for 180...)");
let done180 = false;
for (let i = 0; i < 40; i++) { await sleep(1000); const s = await status(); if (!/ABOUT|PIVOT/.test(s)) { done180 = true; console.log("180 done after ~" + (i + 2) + "s wall:", s); break; } }
if (!done180) console.log("180 NOT done in 40s wall:", await status());
await phone.screenshot({ path: "wtc/p2-after180.png" });
console.log("pageerrors:", errs.length ? errs.join(" | ") : "none");
await browser.close();
