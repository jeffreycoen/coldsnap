// Throwaway visual reference: every unit type in one labeled row.
// Requires the TEMPORARY __LINEUP__/__LINEUPPAUSE__ hooks in DepotGame.jsx.
import puppeteer from "puppeteer-core";
const URL = "http://localhost:4173/coldsnap/?seed=11";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ZOOM = Number(process.env.ZOOM || 0.5);
const SP = Number(process.env.SP || 3.2);
const browser = await puppeteer.launch({
  protocolTimeout: 600000, executablePath: "/usr/bin/chromium", headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--enable-unsafe-swiftshader", "--window-size=1600,1000"],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: Number(process.env.VW||1600), height: Number(process.env.VH||1000), deviceScaleFactor: Number(process.env.DSF||2) });
  await page.goto("http://localhost:4173/coldsnap/", { waitUntil: "networkidle0" });
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) if (k.startsWith("coldsnap-depot")) localStorage.removeItem(k);
    localStorage.setItem("coldsnap-depot-fog", "0");
    localStorage.setItem("coldsnap-screen", "menu");
  });
  await page.goto(URL, { waitUntil: "networkidle0" });
  await page.evaluate(() => document.querySelector('[data-menu="depot"]').click());
  await page.waitForFunction(() => typeof window.__LINEUP__ === "function", { timeout: 20000 });
  await page.evaluate(() => window.__DEPOTSTART__());
  await page.waitForFunction(() => window.__DEPOT__().t > 0.2, { timeout: 10000 });

  const flat = await page.evaluate(() => window.__LINEUPFLAT__(0, -14, 14, 1));
  const Z = flat.z;
  const players = ["sniper+spotter", "rifleman", "mg gunner", "sapper", "mortar man"];
  const rows = [
    { team: 1, type: "sniper", label: "PLR sniper+spotter" },
    { team: 1, type: "rifles", label: "PLR rifleman" },
    { team: 1, type: "mg", label: "PLR mg gunner+loader" },
    { team: 1, type: "sappers", label: "PLR sapper" },
    { team: 1, type: "mortars", label: "PLR mortar man" },
    { team: 2, tag: "", label: "ENY conscript" },
    { team: 2, tag: "fast", label: "ENY runner" },
    { team: 2, tag: "heavy", label: "ENY breaker" },
    { team: 2, tag: "gren", label: "ENY grenadier" },
    { team: 2, tag: "sapper", label: "ENY sapper" },
    { team: 2, tag: "sniper", label: "ENY marksman+spotter" },
    { team: 2, tag: "tank", label: "ENY tank" },
  ];
  // two ranks: player rank in front, enemy rank behind
  const plr = rows.filter((r) => r.team === 1), eny = rows.filter((r) => r.team === 2);
  const place = [];
  plr.forEach((r, i) => place.push({ ...r, x: (i - (plr.length - 1) / 2) * SP, z: Z + 3 }));
  eny.forEach((r, i) => place.push({ ...r, x: (i - (eny.length - 1) / 2) * SP + (r.tag === "tank" ? 2.2 : 0), z: Z - 3 }));
  const out = await page.evaluate((p) => window.__LINEUP__(p), place);
  await sleep(300);
  await page.evaluate((p) => window.__DEPOTFOCUS__(0, p.z, p.zm), { z: Z, zm: ZOOM });
  await page.waitForFunction((z) => {
    const r = document.querySelector("canvas").getBoundingClientRect();
    const g = window.__DEPOTGROUNDAT__(r.left + r.width / 2, r.top + r.height / 2);
    return !!g && Math.hypot(g.x, g.z - z) < 0.8;
  }, { timeout: 15000, polling: 150 }, Z).catch(() => {});
  await sleep(900);
  await page.evaluate(() => window.__LINEUPPAUSE__());
  await sleep(600);
  // label overlay
  await page.evaluate((items) => {
    document.getElementById("lineup-lbl")?.remove();
    const d = document.createElement("div");
    d.id = "lineup-lbl";
    d.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:99999;font:600 13px monospace";
    let i = -1;
    for (const it of items) {
      i++;
      const q = window.__DEPOTSCREENAT__(it.x, it.z);
      if (!q) continue;
      const s = document.createElement("div");
      const enemy = it.label.startsWith("ENY");
      s.textContent = it.label.slice(4);
      s.style.cssText = `position:absolute;left:${q.x}px;top:${q.y + (enemy ? -78 - (i % 2) * 22 : 26 + (i % 2) * 22)}px;transform:translate(-50%,0);color:${enemy ? "#ff9a9a" : "#9adcff"};background:rgba(0,0,0,.72);padding:2px 5px;border-radius:3px;white-space:nowrap`;
      d.appendChild(s);
    }
    document.body.appendChild(d);
  }, out);
  await sleep(200);
  await page.screenshot({ path: process.env.SHOT || "/home/batman/coldsnap/.superpowers/unit-lineup.png" });
  console.log("ok", JSON.stringify({ flat, Z, out }));
} finally { await browser.close(); }
