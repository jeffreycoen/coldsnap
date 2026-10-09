// THE PAGE: reads the six logs beside it, checks that every run tells the
// same story in every non-timing field, and writes index.html — the six runs
// charted side by side, a metric picker, a crosshair readout, before and
// after per change, and the rows themselves. Exits 1 on any mismatch.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const RUNS = [
  ["base", "the shipped tree"],
  ["c1", "the weld list"],
  ["c2", "the pair gate"],
  ["c3", "the single search and the ship's welds"],
  ["c4", "the fixed weights"],
  ["c5", "the plain readout"],
];
const runs = [];
for (const [key, label] of RUNS) {
  const f = path.join(HERE, key + ".json");
  if (!fs.existsSync(f)) { console.error("missing " + f); process.exit(1); }
  runs.push({ key, label, ...JSON.parse(fs.readFileSync(f, "utf8")) });
}
const SAME = ["sim", "hash", "friction", "awake", "asleep", "welds", "eaten"];
const base = runs[0];
const mismatches = [];
for (const r of runs.slice(1)) {
  if (r.seed !== base.seed) mismatches.push(r.key + ": world seed " + r.seed + " against base " + base.seed);
  if (r.harnessSeed !== base.harnessSeed) mismatches.push(r.key + ": harness seed " + r.harnessSeed + " against base " + base.harnessSeed);
  if (r.log.length !== base.log.length) mismatches.push(r.key + ": " + r.log.length + " rows against base " + base.log.length);
  const n = Math.min(r.log.length, base.log.length);
  for (let i = 0; i < n; i++) {
    for (const f of SAME) if (r.log[i][f] !== base.log[i][f]) mismatches.push(r.key + " row " + i + " (sim " + base.log[i].sim + "): " + f + " " + r.log[i][f] + " against " + base.log[i][f]);
    if (JSON.stringify(r.log[i].bodies) !== JSON.stringify(base.log[i].bodies)) mismatches.push(r.key + " row " + i + " (sim " + base.log[i].sim + "): bodies differ");
  }
}
const ok = mismatches.length === 0;
const verdict = ok
  ? "Every run tells the same story: world seed, row count, awake, asleep, welds, eaten, and bodies are identical across all six. Only the timing differs."
  : mismatches.length + " mismatch(es). The first: " + mismatches[0];
console.log("identity: " + verdict);
const DATA = { ok, verdict, mismatches, runs: runs.map((r) => ({ key: r.key, label: r.label, seed: r.seed, harnessSeed: r.harnessSeed, mk: r.mk, raf: r.raf, viewport: r.viewport, startedAt: r.startedAt, log: r.log })) };
const json = JSON.stringify(DATA).replace(/</g, "\\u003c");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const meta = "Mark " + esc(base.mk) + " · harness seed " + esc(base.harnessSeed) + " · world seed " + esc(base.seed) + " · " + esc(base.viewport) + " · run " + esc(String(base.startedAt).slice(0, 10)) + " · frame-rate probe at the start screen: " + runs.map((r) => esc(r.key) + " " + esc(r.raf)).join(", ");

const html = `<title>The Five Measured</title>
<style>
/* layout: one column, 920px wide at most, 16px gutters; the charts fill the column and redraw on resize; the tables scroll sideways in their own boxes */
:root { --bg: #f9f9f7; --surface: #fcfcfb; --ink: #0b0b0b; --ink2: #52514e; --muted: #898781; --grid: #e1e0d9; --axis: #c3c2b7; --ring: rgba(11,11,11,.10); --goodText: #006300; --badText: #d03b3b; --s-base: #2a78d6; --s-c1: #eb6834; --s-c2: #1baf7a; --s-c3: #eda100; --s-c4: #e87ba4; --s-c5: #008300; --font: system-ui, -apple-system, "Segoe UI", sans-serif; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #0d0d0d; --surface: #1a1a19; --ink: #ffffff; --ink2: #c3c2b7; --muted: #898781; --grid: #2c2c2a; --axis: #383835; --ring: rgba(255,255,255,.10); --goodText: #0ca30c; --badText: #d03b3b; --s-base: #3987e5; --s-c1: #d95926; --s-c2: #199e70; --s-c3: #c98500; --s-c4: #d55181; --s-c5: #008300; color-scheme: dark; } }
:root[data-theme="dark"] { --bg: #0d0d0d; --surface: #1a1a19; --ink: #ffffff; --ink2: #c3c2b7; --muted: #898781; --grid: #2c2c2a; --axis: #383835; --ring: rgba(255,255,255,.10); --goodText: #0ca30c; --badText: #d03b3b; --s-base: #3987e5; --s-c1: #d95926; --s-c2: #199e70; --s-c3: #c98500; --s-c4: #d55181; --s-c5: #008300; color-scheme: dark; }
body { margin: 0; background: var(--bg); color: var(--ink); font-family: var(--font); font-size: 14px; line-height: 1.4; padding-inline: 16px; padding-block: 28px 56px; }
.wrap { max-width: 920px; margin: 0 auto; display: grid; gap: 28px; min-width: 0; }
.wrap > * { min-width: 0; } /* a grid item holds its scrolling table instead of growing to it */
h1 { font-size: 28px; font-weight: 600; margin: 0 0 8px; letter-spacing: -0.01em; text-wrap: balance; }
h2 { font-size: 16px; font-weight: 600; margin: 0 0 10px; }
.lede { max-width: 65ch; color: var(--ink2); margin: 0 0 8px; line-height: 1.45; }
.meta { color: var(--muted); font-size: 12px; margin: 0; max-width: 80ch; }
.pill { display: inline-flex; align-items: flex-start; gap: 8px; padding: 8px 14px; border-radius: 12px; border: 1px solid var(--ring); background: var(--surface); font-size: 13px; max-width: 100%; }
.pill .mark { font-weight: 700; flex: none; }
.pill.ok .mark { color: var(--goodText); }
.pill.bad .mark { color: var(--badText); }
.controls { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 14px; }
.controls label { font-size: 12px; color: var(--muted); letter-spacing: 0.04em; text-transform: uppercase; }
select { font: inherit; padding: 6px 8px; border-radius: 6px; border: 1px solid var(--axis); background: var(--surface); color: var(--ink); max-width: 100%; }
.keys { display: flex; flex-wrap: wrap; gap: 6px; }
.key-btn { font: inherit; font-size: 12px; display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px; border: 1px solid var(--ring); background: var(--surface); color: var(--ink); cursor: pointer; }
.key-btn[aria-pressed="false"] { opacity: .45; }
.swatch { width: 10px; height: 10px; border-radius: 2px; display: inline-block; flex: none; }
.scroll { overflow-x: auto; max-width: 100%; }
table { border-collapse: collapse; font-size: 13px; min-width: 100%; }
th, td { text-align: left; padding: 6px 10px; border-bottom: 1px solid var(--grid); white-space: nowrap; vertical-align: middle; }
th { color: var(--muted); font-weight: 500; font-size: 12px; }
td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
td .swatch { margin-right: 6px; vertical-align: middle; }
.good { color: var(--goodText); }
.bad { color: var(--badText); }
.chart-box { position: relative; min-width: 0; }
.chart { background: var(--surface); border: 1px solid var(--ring); border-radius: 8px; padding: 8px; min-width: 0; }
.chart svg { display: block; width: 100%; height: auto; }
svg text { font-family: var(--font); }
.tip { position: absolute; pointer-events: none; background: var(--surface); border: 1px solid var(--ring); border-radius: 6px; padding: 8px 10px; font-size: 12px; box-shadow: 0 2px 8px rgba(0,0,0,.12); max-width: 280px; z-index: 2; }
.tip-h { color: var(--muted); margin-bottom: 4px; }
.tip-r { display: flex; align-items: center; gap: 6px; white-space: nowrap; }
.tip-r .key { width: 12px; height: 2px; display: inline-block; flex: none; }
.tip-l { color: var(--ink2); }
.note { color: var(--ink2); font-size: 12px; max-width: 65ch; margin: 10px 0 0; }
details summary { cursor: pointer; font-weight: 600; margin-bottom: 10px; }
button:focus-visible, select:focus-visible, summary:focus-visible { outline: 2px solid var(--s-base); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
</style>
<main class="wrap">
  <header>
    <h1>The Five Measured</h1>
    <p class="lede">Six runs of the map on the Raspberry Pi: the shipped tree and the tree with one of five changes in it, one drawn seed, ten flown seconds each, captured as the game's own ⊕ LOG rows.</p>
    <p class="meta">${meta}</p>
  </header>
  <section>
    <span class="pill ${ok ? "ok" : "bad"}" data-verdict><span class="mark">${ok ? "✓" : "✗"}</span><span>${esc(verdict)}</span></span>
  </section>
  <section class="controls">
    <label for="metric">Metric</label>
    <select id="metric"></select>
    <div class="keys" id="keys"></div>
  </section>
  <section>
    <h2>The runs, summarized over seconds 2 to 10</h2>
    <div class="scroll"><table class="sum" id="sum"></table></div>
    <p class="note">Δ is against base. Green reads better, red worse. The row at 1s carries the aim and the launch, so the summary starts at 2s.</p>
  </section>
  <section>
    <h2>Second by second</h2>
    <div class="chart-box"><div id="lines" class="chart"></div><div id="tip" class="tip" hidden></div></div>
  </section>
  <section>
    <h2>Before and after, per change</h2>
    <div id="dumb" class="chart"></div>
  </section>
  <details>
    <summary>The rows themselves</summary>
    <div class="scroll"><table class="rows" id="rows"></table></div>
  </details>
  <footer><p class="meta">Each run: a fresh copy of the tree, a fresh browser, the map at default chips, LAUNCH, the ⊕ LOG chip pressed every ten seconds until the eleventh row. The five changes keep every number; the check above holds them to it.</p></footer>
</main>
<script>const DATA = ${json};</script>
<script>
(function () {
  var RUNS = DATA.runs;
  var COLORS = { base: "var(--s-base)", c1: "var(--s-c1)", c2: "var(--s-c2)", c3: "var(--s-c3)", c4: "var(--s-c4)", c5: "var(--s-c5)" };
  var METRICS = [
    { key: "stepMs", label: "step time, ms", unit: "ms", d: 2, get: function (r) { return r.stepMs; }, agg: "mean", better: "lower" },
    { key: "fpsAvg", label: "frame rate, average", unit: "fps", d: 1, get: function (r) { return r.fpsAvg; }, agg: "mean", better: "higher" },
    { key: "fpsMed", label: "frame rate, median", unit: "fps", d: 1, get: function (r) { return r.fpsMed; }, agg: "mean", better: "higher" },
    { key: "fpsMin", label: "frame rate, worst frame", unit: "fps", d: 0, get: function (r) { return r.fpsMin; }, agg: "min", better: "higher" },
    { key: "fpsMax", label: "frame rate, best frame", unit: "fps", d: 0, get: function (r) { return r.fpsMax; }, agg: "max", better: "higher" },
    { key: "worstMs", label: "worst frame, ms", unit: "ms", d: 1, get: function (r) { return r.worst ? r.worst.ms : null; }, agg: "max", better: "lower" },
    { key: "worstPhys", label: "worst frame, physics ms", unit: "ms", d: 1, get: function (r) { return r.worst ? r.worst.phys : null; }, agg: "max", better: "lower" },
    { key: "worstDraw", label: "worst frame, draw ms", unit: "ms", d: 1, get: function (r) { return r.worst ? r.worst.draw : null; }, agg: "max", better: "lower" },
    { key: "bestMs", label: "best frame, ms", unit: "ms", d: 1, get: function (r) { return r.best ? r.best.ms : null; }, agg: "mean", better: "lower" }
  ];
  var shown = {};
  RUNS.forEach(function (r) { shown[r.key] = true; });
  var metric = METRICS[0];
  function color(key) { return COLORS[key]; }
  function flown(r) { return r.log.filter(function (row) { return row.sim >= 2; }); }
  function vals(r, m) { return flown(r).map(m.get).filter(function (v) { return v != null; }); }
  function agg(a, how) {
    if (!a.length) return null;
    if (how === "min") return Math.min.apply(null, a);
    if (how === "max") return Math.max.apply(null, a);
    var s = 0; a.forEach(function (v) { s += v; }); return s / a.length;
  }
  function fmt(v, d) { if (v == null || isNaN(v)) return "—"; return v.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function pct(a, b) { return a == null || b == null || b === 0 ? null : (a - b) / b * 100; }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function svgEl(tag, attrs, style) { var e = document.createElementNS("http://www.w3.org/2000/svg", tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (style) for (var s in style) e.style[s] = style[s]; return e; }
  function nice(max) { if (!(max > 0)) return 1; var p = Math.pow(10, Math.floor(Math.log10(max))); var f = max / p; var n = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10; return n * p; }
  function delta(p, better, isBase) {
    var td = el("td", "num");
    if (isBase || p == null) { td.textContent = "—"; return td; }
    var good = better === "lower" ? p < 0 : p > 0;
    td.textContent = (p > 0 ? "+" : "") + fmt(p, 1) + "%";
    if (Math.abs(p) >= 0.05) td.className = "num " + (good ? "good" : "bad");
    return td;
  }
  function renderControls() {
    var sel = document.getElementById("metric"); sel.textContent = "";
    METRICS.forEach(function (m) { var o = el("option", null, m.label); o.value = m.key; sel.appendChild(o); });
    sel.value = metric.key;
    sel.addEventListener("change", function () { metric = METRICS.filter(function (m) { return m.key === sel.value; })[0]; renderCharts(); });
    var keys = document.getElementById("keys"); keys.textContent = "";
    RUNS.forEach(function (r) {
      var b = el("button", "key-btn"); b.type = "button"; b.setAttribute("aria-pressed", "true");
      var sw = el("span", "swatch"); sw.style.background = color(r.key); b.appendChild(sw);
      b.appendChild(document.createTextNode(r.key + " · " + r.label));
      b.addEventListener("click", function () { shown[r.key] = !shown[r.key]; b.setAttribute("aria-pressed", shown[r.key] ? "true" : "false"); renderLines(); });
      keys.appendChild(b);
    });
  }
  function renderSummary() {
    var t = document.getElementById("sum"); t.textContent = "";
    var head = ["run", "step ms", "Δ", "fps avg", "Δ", "fps median", "fps worst frame", "worst frame ms", "worst physics ms", "worst draw ms"];
    var tr = el("tr"); head.forEach(function (h, i) { tr.appendChild(el("th", i ? "num" : null, h)); }); t.appendChild(tr);
    var b = RUNS[0];
    var bStep = agg(vals(b, METRICS[0]), "mean"), bFps = agg(vals(b, METRICS[1]), "mean");
    RUNS.forEach(function (r) {
      var row = el("tr");
      var name = el("td"); var sw = el("span", "swatch"); sw.style.background = color(r.key); name.appendChild(sw); name.appendChild(document.createTextNode(r.key + " · " + r.label)); row.appendChild(name);
      var step = agg(vals(r, METRICS[0]), "mean"), fps = agg(vals(r, METRICS[1]), "mean");
      row.appendChild(el("td", "num", fmt(step, 2)));
      row.appendChild(delta(pct(step, bStep), "lower", r.key === "base"));
      row.appendChild(el("td", "num", fmt(fps, 1)));
      row.appendChild(delta(pct(fps, bFps), "higher", r.key === "base"));
      row.appendChild(el("td", "num", fmt(agg(vals(r, METRICS[2]), "mean"), 1)));
      row.appendChild(el("td", "num", fmt(agg(vals(r, METRICS[3]), "min"), 0)));
      row.appendChild(el("td", "num", fmt(agg(vals(r, METRICS[5]), "max"), 1)));
      row.appendChild(el("td", "num", fmt(agg(vals(r, METRICS[6]), "max"), 1)));
      row.appendChild(el("td", "num", fmt(agg(vals(r, METRICS[7]), "max"), 1)));
      t.appendChild(row);
    });
  }
  function renderLines() {
    var wrap = document.getElementById("lines"); wrap.textContent = "";
    var W = Math.max(300, wrap.clientWidth - 16), H = 320, L = 52, R = 16, T = 16, B = 40;
    var xs = RUNS[0].log.filter(function (row) { return row.sim >= 1; }).map(function (row) { return row.sim; });
    if (xs.length < 2) { wrap.appendChild(el("p", "note", "Not enough rows to chart.")); return; }
    var series = RUNS.filter(function (r) { return shown[r.key]; }).map(function (r) {
      return { key: r.key, label: r.label, pts: r.log.filter(function (row) { return row.sim >= 1; }).map(function (row) { return { x: row.sim, y: metric.get(row) }; }) };
    });
    var maxY = 0; series.forEach(function (s) { s.pts.forEach(function (p) { if (p.y != null && p.y > maxY) maxY = p.y; }); });
    var top = nice(maxY * 1.05);
    var x = function (v) { return L + (v - xs[0]) / (xs[xs.length - 1] - xs[0]) * (W - L - R); };
    var y = function (v) { return T + (1 - v / top) * (H - T - B); };
    var svg = svgEl("svg", { viewBox: "0 0 " + W + " " + H, width: W, height: H, role: "img", "aria-label": metric.label + " by flown second, one line per run" });
    for (var i = 0; i <= 5; i++) {
      var v = top * i / 5;
      svg.appendChild(svgEl("line", { x1: L, x2: W - R, y1: y(v), y2: y(v), "stroke-width": 1 }, { stroke: "var(--grid)" }));
      var tl = svgEl("text", { x: L - 8, y: y(v) + 4, "text-anchor": "end", "font-size": 11 }, { fill: "var(--muted)" }); tl.textContent = fmt(v, top >= 10 ? 0 : 1); svg.appendChild(tl);
    }
    svg.appendChild(svgEl("line", { x1: L, x2: W - R, y1: y(0), y2: y(0), "stroke-width": 1 }, { stroke: "var(--axis)" }));
    xs.forEach(function (v) { var tl = svgEl("text", { x: x(v), y: H - B + 18, "text-anchor": "middle", "font-size": 11 }, { fill: "var(--muted)" }); tl.textContent = v + "s"; svg.appendChild(tl); });
    var xl = svgEl("text", { x: (L + W - R) / 2, y: H - 6, "text-anchor": "middle", "font-size": 11 }, { fill: "var(--muted)" }); xl.textContent = "flown second · " + metric.label + (metric.unit ? " (" + metric.unit + ")" : ""); svg.appendChild(xl);
    series.forEach(function (s) {
      var d = "", started = false;
      s.pts.forEach(function (p) { if (p.y == null) { started = false; return; } d += (started ? " L " : " M ") + x(p.x).toFixed(1) + " " + y(p.y).toFixed(1); started = true; });
      if (d) svg.appendChild(svgEl("path", { d: d.trim(), fill: "none", "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }, { stroke: color(s.key) }));
      s.pts.forEach(function (p) { if (p.y == null) return; svg.appendChild(svgEl("circle", { cx: x(p.x), cy: y(p.y), r: 4, "stroke-width": 2 }, { fill: color(s.key), stroke: "var(--surface)" })); });
    });
    var cross = svgEl("line", { x1: 0, x2: 0, y1: T, y2: H - B, "stroke-width": 1, visibility: "hidden" }, { stroke: "var(--axis)" }); svg.appendChild(cross);
    wrap.appendChild(svg);
    var tip = document.getElementById("tip");
    function show(ev) {
      var rect = svg.getBoundingClientRect(); var px = (ev.clientX - rect.left) * W / rect.width;
      var best = 0, bd = Infinity; xs.forEach(function (v, i) { var dd = Math.abs(x(v) - px); if (dd < bd) { bd = dd; best = i; } });
      var xv = xs[best]; cross.setAttribute("x1", x(xv)); cross.setAttribute("x2", x(xv)); cross.setAttribute("visibility", "visible");
      tip.textContent = ""; tip.appendChild(el("div", "tip-h", "at " + xv + "s · " + metric.label));
      series.forEach(function (s) {
        var p = s.pts[best]; var row = el("div", "tip-r");
        var k = el("span", "key"); k.style.background = color(s.key); row.appendChild(k);
        row.appendChild(el("strong", null, fmt(p ? p.y : null, metric.d) + " " + metric.unit));
        row.appendChild(el("span", "tip-l", s.key + " · " + s.label));
        tip.appendChild(row);
      });
      tip.hidden = false;
      var box = wrap.getBoundingClientRect();
      var tx = ev.clientX - box.left + 14, ty = ev.clientY - box.top - 10;
      if (tx + tip.offsetWidth > box.width) tx = Math.max(0, ev.clientX - box.left - tip.offsetWidth - 14);
      tip.style.left = tx + "px"; tip.style.top = ty + "px";
    }
    svg.addEventListener("pointermove", show);
    svg.addEventListener("pointerdown", show);
    svg.addEventListener("pointerleave", function () { tip.hidden = true; cross.setAttribute("visibility", "hidden"); });
  }
  function renderDumb() {
    var wrap = document.getElementById("dumb"); wrap.textContent = "";
    var b = RUNS[0], bv = agg(vals(b, metric), metric.agg);
    var items = RUNS.slice(1).map(function (r) { return { key: r.key, label: r.label, v: agg(vals(r, metric), metric.agg) }; });
    var W = Math.max(300, wrap.clientWidth - 16), rowH = 46, L = 16, R = 132, T = 30, H = T + rowH * items.length + 12;
    var all = items.map(function (i) { return i.v; }).concat([bv]).filter(function (v) { return v != null; });
    if (!all.length) { wrap.appendChild(el("p", "note", "No values for this metric.")); return; }
    var lo = Math.min.apply(null, all), hi = Math.max.apply(null, all);
    var pad = (hi - lo) * 0.25 || Math.abs(hi) * 0.1 || 1; lo -= pad; hi += pad;
    var x = function (v) { return L + (v - lo) / (hi - lo) * (W - L - R); };
    var svg = svgEl("svg", { viewBox: "0 0 " + W + " " + H, width: W, height: H, role: "img", "aria-label": "before and after per change, " + metric.label });
    var cap = svgEl("text", { x: L, y: 14, "font-size": 11 }, { fill: "var(--muted)" });
    cap.textContent = "base " + fmt(bv, metric.d) + " " + metric.unit + " (" + metric.agg + " over seconds 2 to 10) → each change"; svg.appendChild(cap);
    if (bv != null) svg.appendChild(svgEl("line", { x1: x(bv), x2: x(bv), y1: T - 8, y2: H - 8, "stroke-width": 1 }, { stroke: "var(--axis)" }));
    items.forEach(function (it, i) {
      var cy = T + rowH * i + rowH / 2;
      var lab = svgEl("text", { x: L, y: cy - 10, "font-size": 12 }, { fill: "var(--ink2)" }); lab.textContent = it.key + " · " + it.label; svg.appendChild(lab);
      if (it.v == null || bv == null) return;
      svg.appendChild(svgEl("line", { x1: x(bv), x2: x(it.v), y1: cy + 6, y2: cy + 6, "stroke-width": 2, "stroke-linecap": "round" }, { stroke: "var(--axis)" }));
      svg.appendChild(svgEl("circle", { cx: x(bv), cy: cy + 6, r: 5, "stroke-width": 2 }, { fill: color("base"), stroke: "var(--surface)" }));
      svg.appendChild(svgEl("circle", { cx: x(it.v), cy: cy + 6, r: 5, "stroke-width": 2 }, { fill: color(it.key), stroke: "var(--surface)" }));
      var p = pct(it.v, bv); var good = p == null ? null : (metric.better === "lower" ? p < 0 : p > 0);
      var tone = p == null || Math.abs(p) < 0.05 ? "var(--ink2)" : good ? "var(--goodText)" : "var(--badText)";
      var dl = svgEl("text", { x: W - R + 10, y: cy + 10, "font-size": 12, "font-weight": 600 }, { fill: tone });
      dl.textContent = fmt(it.v, metric.d) + " " + metric.unit + " (" + (p > 0 ? "+" : "") + fmt(p, 1) + "%)"; svg.appendChild(dl);
    });
    wrap.appendChild(svg);
  }
  function renderRows() {
    var t = document.getElementById("rows"); t.textContent = "";
    var cols = [
      ["run", function (r, row) { return r.key; }],
      ["sim s", function (r, row) { return row.sim; }],
      ["real s", function (r, row) { return row.real; }],
      ["step ms", function (r, row) { return row.stepMs; }],
      ["fps avg", function (r, row) { return row.fpsAvg; }],
      ["fps med", function (r, row) { return row.fpsMed; }],
      ["fps min", function (r, row) { return row.fpsMin; }],
      ["fps max", function (r, row) { return row.fpsMax; }],
      ["worst ms", function (r, row) { return row.worst ? row.worst.ms : null; }],
      ["worst draw", function (r, row) { return row.worst ? row.worst.draw : null; }],
      ["worst phys", function (r, row) { return row.worst ? row.worst.phys : null; }],
      ["chunks", function (r, row) { return row.worst ? row.worst.chunks : null; }],
      ["scan", function (r, row) { return row.worst ? String(row.worst.scan) : null; }],
      ["ghost", function (r, row) { return row.worst ? String(row.worst.ghost) : null; }],
      ["best ms", function (r, row) { return row.best ? row.best.ms : null; }],
      ["awake", function (r, row) { return row.awake; }],
      ["asleep", function (r, row) { return row.asleep; }],
      ["welds", function (r, row) { return row.welds; }],
      ["eaten", function (r, row) { return row.eaten; }]
    ];
    var tr = el("tr"); cols.forEach(function (c, i) { tr.appendChild(el("th", i ? "num" : null, c[0])); }); t.appendChild(tr);
    RUNS.forEach(function (r) { r.log.forEach(function (row) { var tr2 = el("tr"); cols.forEach(function (c, i) { var v = c[1](r, row); tr2.appendChild(el("td", i ? "num" : null, v == null ? "—" : String(v))); }); t.appendChild(tr2); }); });
  }
  function renderCharts() { renderLines(); renderDumb(); }
  renderControls(); renderSummary(); renderCharts(); renderRows();
  var rt; window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(renderCharts, 120); });
})();
</script>
`;
fs.writeFileSync(path.join(HERE, "index.html"), html);
console.log("wrote index.html");
process.exit(ok ? 0 : 1);
