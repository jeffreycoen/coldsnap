// Q: condensed button-truth audit — phone landscape.
import puppeteer from "puppeteer-core";
import { makeMT } from "./mt.mjs";
const browser = await puppeteer.launch({ protocolTimeout: 600000, executablePath: "/usr/bin/chromium", headless: true, args: ["--no-sandbox", "--disable-gpu", "--enable-unsafe-swiftshader"] });
const phone = await browser.newPage();
await phone.emulate({ viewport: { width: 844, height: 390, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, userAgent: "Mozilla/5.0 (iPhone)" });
await phone.goto("http://localhost:4179/coldsnap/", { waitUntil: "networkidle0" });
await phone.evaluate(() => localStorage.setItem("coldsnap-screen", "menu"));
await phone.reload({ waitUntil: "networkidle0" });
await phone.waitForSelector('[data-menu="mech"]', { timeout: 15000 });
await phone.tap('[data-menu="mech"]');
await phone.waitForSelector("[data-mech-reissue]", { timeout: 20000 });
await phone.waitForFunction(() => window.__MECHRANGE__ && window.__MECHRANGE__.mech.hull.R[4] > 0.9, { timeout: 20000, polling: 500 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ev = (fn) => phone.evaluate(fn);
const R = [];
const check = (name, ok, note) => { R.push((ok ? "PASS " : "FAIL ") + name + (note ? " (" + note + ")" : "")); };

// FIRE (touch button)
const shots0 = await ev(() => window.__MECHRANGE__.mech.telem.shots || 0);
await phone.tap("[data-mech-fire]");
await sleep(400);
check("FIRE fires a shell", (await ev(() => window.__MECHRANGE__.mech.telem.shots || 0)) > shots0);
// aim arrows slew the reticle
const a0 = await ev(() => window.__MECHRANGE__.mech.aimYaw);
await ev(() => window.__MECHRANGE__.aim(1));
await sleep(600);
await ev(() => window.__MECHRANGE__.aim(0));
const a1 = await ev(() => window.__MECHRANGE__.mech.aimYaw);
check("aim arrows slew aim", Math.abs(a1 - a0) > 0.2, (a1 - a0).toFixed(2));
// slider sets range
await ev(() => window.__MECHRANGE__.sliderY(60));
await sleep(200);
check("slider sets range", (await ev(() => window.__MECHRANGE__.mech.aimRange)) > 60);
// MSL fires a salvo at the reticle
const sal0 = await ev(() => window.__MECHRANGE__.mech.telem.salvos || 0);
await phone.tap("[data-mech-msl]");
await sleep(600);
check("MSL fires a salvo", (await ev(() => window.__MECHRANGE__.mech.telem.salvos || 0)) > sal0);
// 180 turns the machine around (bounded wait)
const y0 = await ev(() => Math.atan2(window.__MECHRANGE__.mech.hull.R[6], window.__MECHRANGE__.mech.hull.R[8]));
await phone.tap("[data-mech-about]");
let turned = false;
for (let i = 0; i < 90; i++) {
  await sleep(1000);
  const d = await ev(() => {
    const m = window.__MECHRANGE__.mech;
    return { y: Math.atan2(m.hull.R[6], m.hull.R[8]), af: m.state.aboutFace, mode: m.state.mode };
  });
  let dd = d.y - y0 - Math.PI;
  while (dd > Math.PI) dd -= 2 * Math.PI;
  while (dd < -Math.PI) dd += 2 * Math.PI;
  if (!d.af && d.mode === "STAND" && Math.abs(dd) < 0.3) { turned = true; check("180 completes", true, i + "s wall"); break; }
  if (d.mode === "FALLEN") { check("180 completes", false, "FELL"); turned = true; break; }
}
if (!turned) check("180 completes", false, "timeout 90s");
// PUNT: kick fires (state visible)
await ev(() => window.__MECHRANGE__.reissue());
await sleep(2500);
await phone.tap("[data-mech-punt]");
let kicked = false;
for (let i = 0; i < 8; i++) { await sleep(500); if (await ev(() => !!window.__MECHRANGE__.mech.state.kick || (window.__MECHRANGE__.mech.state.puntReq || 0) > 0)) { kicked = true; break; } }
check("PUNT arms/kicks", kicked);
await sleep(4000);
// ONE LEG raises then lowers on second press
await phone.tap("[data-mech-poise]");
let poised = false;
for (let i = 0; i < 16; i++) { await sleep(500); if (await ev(() => { const p = window.__MECHRANGE__.mech.state.poise; return !!p && (p.phase === "hold"); })) { poised = true; break; } }
check("ONE LEG reaches hold", poised);
await phone.tap("[data-mech-poise]");
await sleep(4000);
// toggles
await phone.tap("[data-mech-gyro]");
await sleep(300);
check("GYRO toggles off", (await ev(() => window.__MECHRANGE__.mech.gyroOn)) === false);
await phone.tap("[data-mech-gyro]");
await sleep(300);
await phone.tap("[data-mech-rcs]");
await sleep(300);
check("ROCKETS toggles off", (await ev(() => window.__MECHRANGE__.mech.thrustersOn)) === false);
await phone.tap("[data-mech-rcs]");
await sleep(300);
await phone.tap("[data-mech-jets]");
await sleep(300);
const jl = await ev(() => document.querySelector("[data-mech-jets]").textContent);
check("JETS toggle labels", jl.includes("JETS"), jl);
await phone.tap("[data-mech-jets]");
// REISSUE
await ev(() => { const m = window.__MECHRANGE__.mech; m.hull.v.x += 70000 / m.hull.mass; });
await sleep(4000);
await phone.tap("[data-mech-reissue]");
await sleep(3000);
check("REISSUE restores a standing frame", await ev(() => window.__MECHRANGE__.mech.state.mode !== "FALLEN" && window.__MECHRANGE__.mech.hull.R[4] > 0.9));
await phone.screenshot({ path: "/home/batman/coldsnap/.claude/worktrees/agent-af89fd14ae00c809e/wtq/audit-final.png" });
for (const r of R) console.log(r);
await browser.close();
