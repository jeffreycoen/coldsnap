// BUTTON TRUTH AUDIT: every control, end-to-end, phone + desktop.
import puppeteer from "puppeteer-core";
const URL = "http://localhost:4174/coldsnap/";
const browser = await puppeteer.launch({ protocolTimeout: 600000, executablePath: "/usr/bin/chromium", headless: true, args: ["--no-sandbox", "--disable-gpu", "--enable-unsafe-swiftshader"] });
const results = [];
const ok = (name, cond, note = "") => { results.push((cond ? "PASS " : "FAIL ") + name + (note ? " [" + note + "]" : "")); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- PHONE ----------
const phone = await browser.newPage();
await phone.emulate({ viewport: { width: 844, height: 390, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, userAgent: "Mozilla/5.0 (iPhone)" });
await phone.goto(URL, { waitUntil: "networkidle0" });
await phone.evaluate(() => localStorage.setItem("coldsnap-screen", "menu"));
await phone.reload({ waitUntil: "networkidle0" });
await phone.waitForSelector('[data-menu="mech"]', { timeout: 15000 });
await phone.tap('[data-menu="mech"]');
await phone.waitForSelector("[data-mech-about]", { timeout: 20000 });
await phone.waitForFunction(() => window.__MECHRANGE__ && window.__MECHRANGE__.mech.hull.R[4] > 0.9, { timeout: 20000, polling: 500 });
await sleep(1500);
const M = () => phone.evaluate(() => { const m = window.__MECHRANGE__.mech; return { z: m.hull.pos.z, x: m.hull.pos.x, yaw: Math.atan2(m.hull.R[6], m.hull.R[8]), shots: m.telem.shots || 0, salvos: m.telem.salvos || 0, mode: m.state.mode, poise: !!m.state.poise, punt: (m.state.puntReq || 0) > 0 || !!m.state.kick, af: !!m.state.aboutFace, gyro: m.gyroOn !== false, rcs: !!m.thrustersOn, aimOff: (() => { const t = m.waist ? m.waist.b : m.hull; let d = (m.aimYaw ?? 0) - Math.atan2(m.hull.R[6], m.hull.R[8]); while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; })(), range: m.aimRange, burn: Math.max(...m.thrusters.map(t2 => t2.cur)) }; });

// left stick forward: walks toward camera (z decreases, spawn 41 facing pi)
{
  const a = await M();
  await phone.touchscreen.touchStart(86, 260); await phone.touchscreen.touchMove(86, 224);
  await sleep(4500); await phone.touchscreen.touchEnd(); await sleep(500);
  const b = await M();
  ok("phone left stick: walks forward", a.z - b.z > 0.3, (a.z - b.z).toFixed(2) + "m");
}
// right stick TURN: yaw changes
{
  const a = await M();
  await phone.touchscreen.touchStart(758, 260); await phone.touchscreen.touchMove(722, 260);
  await sleep(3500); await phone.touchscreen.touchEnd(); await sleep(2500);
  const b = await M();
  let d = b.yaw - a.yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
  ok("phone right stick: turns the body", Math.abs(d) > 0.05, (d * 180 / Math.PI).toFixed(0) + " deg");
}
// settle between actions — the machine is a physical system, not a menu
await sleep(2500);
// aim arrows: aimOff moves; direction per shipped swap
{
  const a = await M();
  const box = await phone.evaluate(() => { const b2 = document.querySelector("[data-mech-aiml]").getBoundingClientRect(); return { x: b2.x + b2.width / 2, y: b2.y + b2.height / 2 }; });
  await phone.touchscreen.touchStart(box.x, box.y); await sleep(700); await phone.touchscreen.touchEnd(); await sleep(300);
  const b = await M();
  ok("phone aim arrow: slews the cannon", Math.abs(b.aimOff - a.aimOff) > 0.2, (b.aimOff - a.aimOff).toFixed(2) + " rad");
}
// slider: range changes
{
  const sl = await phone.evaluate(() => { const b2 = document.querySelector("[data-mech-rangeslider]").getBoundingClientRect(); return { x: b2.x + b2.width / 2, top: b2.y + 8, bot: b2.y + b2.height - 8 }; });
  await phone.touchscreen.touchStart(sl.x, sl.bot); await phone.touchscreen.touchMove(sl.x, sl.top); await phone.touchscreen.touchEnd(); await sleep(200);
  const b = await M();
  ok("phone slider: sets range", b.range > 60, b.range.toFixed(0) + "m");
}
await sleep(2000);
// FIRE
{
  const a = await M();
  const fb = await phone.evaluate(() => { const b2 = document.querySelector("[data-mech-fire]").getBoundingClientRect(); return { x: b2.x + b2.width / 2, y: b2.y + b2.height / 2 }; });
  await phone.touchscreen.touchStart(fb.x, fb.y); await sleep(300); await phone.touchscreen.touchEnd(); await sleep(300);
  const b = await M();
  ok("phone FIRE: cannon fires", b.shots > a.shots, "shots " + a.shots + "->" + b.shots);
}
// MSL + cooldown label
{
  const a = await M();
  await phone.tap("[data-mech-msl]"); await sleep(400);
  const b = await M();
  const label = await phone.evaluate(() => document.querySelector("[data-mech-msl]").textContent);
  ok("phone MSL: salvo fires", b.salvos > a.salvos, "salvos " + a.salvos + "->" + b.salvos);
  ok("phone MSL: cooldown shown", /\ds/.test(label), label.trim());
}
await sleep(2000);
// PUNT: pending/kick state
{
  await phone.tap("[data-mech-punt]"); await sleep(300);
  const b = await M();
  const status = await phone.evaluate(() => document.querySelector("[data-mech-status]").textContent);
  ok("phone PUNT: request registers", b.punt, "");
  ok("phone PUNT: status surfaces it", /PUNT/.test(status), status.slice(0, 40));
  await sleep(6000); // let the punt fully resolve
}
await sleep(2500);
// ONE LEG: poise + label flip
{
  await phone.tap("[data-mech-poise]"); await sleep(600);
  const b = await M();
  const label = await phone.evaluate(() => document.querySelector("[data-mech-poise]").textContent.trim());
  ok("phone ONE LEG: poise engages", b.poise, "");
  ok("phone ONE LEG: label flips to LOWER", label === "LOWER", label);
  await phone.tap("[data-mech-poise]"); await sleep(3000); // lower it
}
await sleep(3000);
// 180: aboutFace + status
{
  await phone.tap("[data-mech-about]"); await sleep(600);
  const b = await M();
  const status = await phone.evaluate(() => document.querySelector("[data-mech-status]").textContent);
  ok("phone 180: about-face engages", b.af, "");
  ok("phone 180: status surfaces it", /ABOUT-FACE|PIVOT/.test(status), status.slice(0, 44));
  // wait for completion (up to 40s wall)
  let done = false;
  for (let i = 0; i < 40; i++) { await sleep(1000); const c = await M(); if (!c.af) { done = true; break; } }
  ok("phone 180: completes", done, "");
  await sleep(2000);
}
// GYRO toggle
{
  await phone.tap("[data-mech-gyro]"); await sleep(300);
  const b = await M();
  const label = await phone.evaluate(() => document.querySelector("[data-mech-gyro]").textContent);
  ok("phone GYRO: toggles off", !b.gyro && /OFF/.test(label), label.trim());
  await phone.tap("[data-mech-gyro]"); await sleep(300);
  const c = await M();
  ok("phone GYRO: toggles back on", c.gyro, "");
}
// ROCKETS toggle
{
  await phone.tap("[data-mech-rcs]"); await sleep(300);
  const b = await M();
  ok("phone ROCKETS: toggles off", !b.rcs, "");
  await phone.tap("[data-mech-rcs]"); await sleep(300);
  const c = await M();
  ok("phone ROCKETS: toggles back on", c.rcs, "");
}
// JETS mode: toggle + a burn happens on stick hold
{
  await phone.tap("[data-mech-jets]"); await sleep(300);
  const lbl = await phone.evaluate(() => document.querySelector("[data-mech-jets]").textContent);
  ok("phone R-STICK: JETS label", /JETS/.test(lbl), lbl.trim());
  await phone.touchscreen.touchStart(758, 260); await phone.touchscreen.touchMove(758, 232);
  let sawBurn = 0;
  for (let i = 0; i < 20; i++) { await sleep(150); const c = await M(); if (c.burn > sawBurn) sawBurn = c.burn; }
  await phone.touchscreen.touchEnd();
  ok("phone JETS: stick vectors a burn", sawBurn > 0.2, "peak " + sawBurn.toFixed(2));
  await phone.tap("[data-mech-jets]"); await sleep(200);
}
// REISSUE
{
  await phone.tap("[data-mech-reissue]"); await sleep(1500);
  const b = await M();
  ok("phone REISSUE: respawns at post", Math.abs(b.z - 41) < 2 && b.mode !== "FALLEN", "z " + b.z.toFixed(1));
}
await phone.screenshot({ path: "wtdbg2/audit-phone.png" });
// MENU exits (last)
{
  await phone.tap("[data-mech-exit]"); await sleep(1200);
  const gone = await phone.evaluate(() => !document.querySelector("[data-mech-status]"));
  ok("phone MENU: exits to menu", gone, "");
}
await phone.close();

// ---------- DESKTOP ----------
const page = await browser.newPage();
await page.setViewport({ width: 960, height: 600 });
await page.goto(URL, { waitUntil: "networkidle0" });
await page.evaluate(() => localStorage.setItem("coldsnap-screen", "menu"));
await page.reload({ waitUntil: "networkidle0" });
await page.waitForSelector('[data-menu="mech"]', { timeout: 15000 });
await page.evaluate(() => document.querySelector('[data-menu="mech"]').click());
await page.waitForSelector("[data-mech-about]", { timeout: 20000 });
await page.waitForFunction(() => window.__MECHRANGE__ && window.__MECHRANGE__.mech.hull.R[4] > 0.9, { timeout: 20000, polling: 500 });
await sleep(1200);
const D = () => page.evaluate(() => { const m = window.__MECHRANGE__.mech; return { z: m.hull.pos.z, yaw: Math.atan2(m.hull.R[6], m.hull.R[8]), shots: m.telem.shots || 0, salvos: m.telem.salvos || 0, poise: !!m.state.poise, punt: (m.state.puntReq || 0) > 0 || !!m.state.kick, af: !!m.state.aboutFace, gyro: m.gyroOn !== false, rcs: !!m.thrustersOn, aimYaw: m.aimYaw }; });
// W walks
{
  const a = await D();
  await page.keyboard.down("KeyW"); await sleep(4000); await page.keyboard.up("KeyW"); await sleep(500);
  const b = await D();
  ok("desktop W: walks", a.z - b.z > 0.3, (a.z - b.z).toFixed(2) + "m");
}
// A turns
{
  const a = await D();
  await page.keyboard.down("KeyA"); await sleep(2500); await page.keyboard.up("KeyA"); await sleep(2000);
  const b = await D();
  let d = b.yaw - a.yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
  ok("desktop A: turns", Math.abs(d) > 0.04, (d * 180 / Math.PI).toFixed(0) + " deg");
}
// mouse aim
{
  await page.mouse.move(700, 200); await sleep(300);
  const b = await D();
  ok("desktop MOUSE: aims", b.aimYaw != null, "aimYaw " + (b.aimYaw || 0).toFixed(2));
}
// click fire
{
  const a = await D();
  await page.mouse.click(480, 300); await sleep(400);
  const b = await D();
  ok("desktop CLICK: fires", b.shots > a.shots, "");
}
// keys V C X T G H R (J covered by phone jets logic)
{
  const a = await D();
  await page.keyboard.press("KeyV"); await sleep(400);
  const b = await D();
  ok("desktop V: missiles", b.salvos > a.salvos, "");
  await page.keyboard.press("KeyC"); await sleep(300);
  ok("desktop C: punt", (await D()).punt, "");
  await sleep(9000); // punt + recovery fully done (swiftshader halves sim rate)
  await page.keyboard.press("KeyX"); await sleep(1500);
  ok("desktop X: one-leg", (await D()).poise, "");
  await page.keyboard.press("KeyX"); await sleep(6000);
  await page.keyboard.press("KeyT"); await sleep(800);
  ok("desktop T: 180", (await D()).af, "");
  await sleep(1000);
  await page.keyboard.press("KeyG"); await sleep(200);
  ok("desktop G: gyro", !(await D()).gyro, "");
  await page.keyboard.press("KeyG"); await sleep(200);
  await page.keyboard.press("KeyH"); await sleep(200);
  ok("desktop H: rockets", !(await D()).rcs, "");
  await page.keyboard.press("KeyH"); await sleep(200);
  const z0 = (await D()).z;
  await page.keyboard.press("KeyR"); await sleep(1500);
  ok("desktop R: reissue", Math.abs((await D()).z - 41) < 2, "");
}
await page.screenshot({ path: "wtdbg2/audit-desktop.png" });
await browser.close();
for (const r of results) console.log(r);
console.log("AUDIT:", results.filter(r => r.startsWith("FAIL")).length + " fails /", results.length);
