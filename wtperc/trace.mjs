// Perceptual trace: 20s march on phone emulation, per-frame samples of
// camera focus, hull, and traj endpoint. Outputs summary metrics JSON.
// Usage: node wtperc/trace.mjs [outLabel]
import puppeteer from "puppeteer-core";

const label = process.argv[2] || "run";
const browser = await puppeteer.launch({
  protocolTimeout: 600000,
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--enable-unsafe-swiftshader"],
});
const phone = await browser.newPage();
await phone.emulate({
  viewport: { width: 844, height: 390, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  userAgent: "Mozilla/5.0 (iPhone)",
});
await phone.goto("http://localhost:4173/coldsnap/", { waitUntil: "networkidle0" });
await phone.evaluate(() => localStorage.setItem("coldsnap-screen", "menu"));
await phone.reload({ waitUntil: "networkidle0" });
await phone.waitForSelector('[data-menu="mech"]', { timeout: 15000 });
await phone.tap('[data-menu="mech"]');
await phone.waitForSelector("[data-mech-reissue]", { timeout: 20000 });
await phone.waitForFunction(() => window.__MECHRANGE__ && window.__MECHRANGE__.mech.hull.R[4] > 0.9, { timeout: 20000, polling: 500 });
await new Promise((r) => setTimeout(r, 1500));

// start per-frame sampler (rAF-driven so it samples exactly once per rendered frame)
await phone.evaluate(() => {
  window.__SAMP__ = [];
  const t0 = performance.now();
  const tick = () => {
    const d = window.__MECHRANGE__ && window.__MECHRANGE__.dbg;
    if (d && d.hull) {
      window.__SAMP__.push([
        (performance.now() - t0) / 1000,
        d.focus.x, d.focus.y, d.focus.z,
        d.hull.x, d.hull.y, d.hull.z,
        d.trajEnd ? d.trajEnd.x : 0, d.trajEnd ? d.trajEnd.z : 0,
      ]);
    }
    if ((performance.now() - t0) < 26000) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});

// hold left stick forward for the whole window (single touch — reliable)
await phone.touchscreen.touchStart(86, 260);
await phone.touchscreen.touchMove(86, 220);
await new Promise((r) => setTimeout(r, 24000));
await phone.touchscreen.touchEnd();
const samp = await phone.evaluate(() => window.__SAMP__);
await browser.close();

// analysis: use the steady-march window (skip first 6s of launch)
const S = samp.filter((s) => s[0] > 6 && s[0] < 24);
const col = (i) => S.map((s) => s[i]);
const detrend = (a) => {
  // remove linear trend (net locomotion), leave oscillation
  const n = a.length, xs = a.map((_, i) => i);
  const mx = (n - 1) / 2, my = a.reduce((p, c) => p + c, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (a[i] - my); den += (xs[i] - mx) ** 2; }
  const b = num / den;
  return a.map((v, i) => v - (my + b * (i - mx)));
};
const rms = (a) => Math.sqrt(a.reduce((p, c) => p + c * c, 0) / a.length);
const p2p = (a) => Math.max(...a) - Math.min(...a);
// dominant-band amplitude via single-bin DFT at f (Hz), given mean dt
const dft = (a, dtm, f) => {
  let re = 0, im = 0;
  for (let i = 0; i < a.length; i++) { const ph = 2 * Math.PI * f * i * dtm; re += a[i] * Math.cos(ph); im += a[i] * Math.sin(ph); }
  return (2 / a.length) * Math.hypot(re, im);
};
const ts = col(0);
const dtm = (ts[ts.length - 1] - ts[0]) / (ts.length - 1);
const fy = detrend(col(2)), fx = detrend(col(1)), fz = detrend(col(3));
const hy = detrend(col(5)), hx = detrend(col(4));
const tx = detrend(col(7)), tz = detrend(col(8));
// frame-to-frame screen jitter proxy: delta of (hull - focus) per frame
const relx = S.map((s) => s[4] - s[1]), rely = S.map((s) => s[5] - s[2]);
const dRel = [];
for (let i = 1; i < relx.length; i++) dRel.push(Math.hypot(relx[i] - relx[i - 1], rely[i] - rely[i - 1]));
const dFoc = [];
for (let i = 1; i < S.length; i++) dFoc.push(Math.hypot(S[i][1] - S[i - 1][1], S[i][2] - S[i - 1][2], S[i][3] - S[i - 1][3]));

const out = {
  label, frames: S.length, meanDt: +(dtm * 1000).toFixed(1),
  focusY: { rms: +rms(fy).toFixed(4), p2p: +p2p(fy).toFixed(3), a05: +dft(fy, dtm, 0.55).toFixed(4), a11: +dft(fy, dtm, 1.1).toFixed(4) },
  focusX: { rms: +rms(fx).toFixed(4), p2p: +p2p(fx).toFixed(3), a05: +dft(fx, dtm, 0.55).toFixed(4) },
  hullY: { rms: +rms(hy).toFixed(4), p2p: +p2p(hy).toFixed(3) },
  hullX: { rms: +rms(hx).toFixed(4) },
  trajEnd: { rmsX: +rms(tx).toFixed(3), rmsZ: +rms(tz).toFixed(3), p2pX: +p2p(tx).toFixed(2) },
  frameJitter: { relMeanD: +(dRel.reduce((p, c) => p + c, 0) / dRel.length).toFixed(4), focMeanD: +(dFoc.reduce((p, c) => p + c, 0) / dFoc.length).toFixed(4) },
};
console.log(JSON.stringify(out, null, 1));
