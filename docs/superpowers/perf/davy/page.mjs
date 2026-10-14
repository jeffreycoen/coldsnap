// THE PAGE (0.6.8): reads every bench run beside it, checks that the runs
// of one world tell the same story in every non-timing field, and writes
// index.html — the step cost through the burst, the awake stones and the
// contacts, each window's function shares, the browser frames, and the
// rows. Exits 1 on any identity mismatch.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const files = fs.readdirSync(HERE).filter((f) => f.endsWith(".json")).sort();
const runs = [], browser = [];
for (const f of files) {
  const j = JSON.parse(fs.readFileSync(path.join(HERE, f), "utf8"));
  if (j.tool === "diag-davy") runs.push({ file: f, ...j }); else if (j.tool === "diag-davy-browser") browser.push({ file: f, ...j });
}
if (!runs.length) { console.error("no bench runs beside the page"); process.exit(1); }
const groups = new Map();
for (const r of runs) { const k = `${r.seed}/${r.mode}/${r.target}`; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); }
const SAME = [["stones", (r) => r.stonesNear], ["burstStep", (r) => r.burstStep], ["worldHash", (r) => r.identity.worldHash], ["runHash", (r) => r.identity.runHash], ["draws", (r) => r.identity.draws], ["breaks", (r) => r.identity.breaksTotal], ["lost", (r) => r.identity.lostTotal], ["peakAwake", (r) => r.after.peakAwake], ["peakContacts", (r) => r.after.peakContacts], ["rows", (r) => r.rows.length]];
const mismatches = [];
for (const [k, g] of groups) for (const r of g.slice(1)) for (const [name, get] of SAME) if (get(r) !== get(g[0])) mismatches.push(`${k}: ${r.label} ${name} ${get(r)} against ${g[0].label} ${get(g[0])}`);
const ok = mismatches.length === 0;
const verdict = ok ? `same world in every copy — ${runs.length} runs over ${groups.size} world${groups.size === 1 ? "" : "s"}` : `WORLDS DIFFER — ${mismatches.length} mismatch${mismatches.length === 1 ? "" : "es"}`;
console.log("identity: " + verdict);
for (const m of mismatches) console.log("  " + m);
const slim = runs.map((r) => ({
  label: r.label, mode: r.mode, target: r.target, seed: r.seed, stones: r.stonesNear, walls: r.wallCourses, burstStep: r.burstStep, mk: r.mk,
  burst: { ms: r.burst.ms, windowMs: r.burst.windowMs, lost: r.burst.lost, top: r.burst.profile.top.slice(0, 12) },
  after: { meanMs: r.after.meanMs, p95Ms: r.after.p95Ms, worstMs: r.after.worstMs, sumMs: r.after.sumMs, peakAwake: r.after.peakAwake, peakContacts: r.after.peakContacts, heavySteps: r.after.heavySteps, over7: r.after.over7, top: r.after.profile.top.slice(0, 12) },
  shares: r.shares, identity: r.identity, alloc: r.allocTop ? r.allocTop.slice(0, 10) : null,
  rows: r.rows.slice(Math.max(0, r.burstStep - 60)).map((x) => [x.i - r.burstStep, x.ms, x.chunks, x.contacts, x.welds, x.sweeps, x.heapMB]),
}));
const slimB = browser.map((b) => ({ label: b.label, seed: b.seed, gpu: b.gpu, summary: b.summary, frames: b.frames.map((f) => [+(f.t - b.frames[0].t).toFixed(1), +f.frame.toFixed(2), +f.sim.toFixed(2), +f.render.toFixed(2), f.steps, f.chunks, f.contacts, f.booms, +(f.heap / 1048576).toFixed(1)]) }));
const DATA = { ok, verdict, mismatches, runs: slim, browser: slimB, builtAt: new Date().toISOString() };
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>The davy bench</title>
<style>
:root{--bg:#0f1115;--fg:#e6e6e6;--mute:#9aa3ad;--line:#2a2f38;--ok:#4caf50;--bad:#e05252}
body{margin:0;padding:12px 16px 40px;background:var(--bg);color:var(--fg);font:14px/1.45 system-ui,sans-serif;max-width:1100px}
h1{font-size:20px;margin:6px 0 2px}h2{font-size:15px;margin:22px 0 6px;color:var(--mute);text-transform:uppercase;letter-spacing:1px}
.pill{display:inline-block;padding:3px 10px;border-radius:12px;font-weight:600;margin:6px 0}.ok{background:#1d3b22;color:#9be29f}.bad{background:#4a1d1d;color:#ffb3b3}
svg{width:100%;height:auto;display:block;background:#141822;border:1px solid var(--line);border-radius:6px;margin:6px 0}
.wrap{overflow:auto}table{border-collapse:collapse;font-size:12px;white-space:nowrap}td,th{border-bottom:1px solid var(--line);padding:3px 8px;text-align:right}th{color:var(--mute);font-weight:600}td:first-child,th:first-child{text-align:left}
.legend span{display:inline-block;margin:0 10px 4px 0;font-size:12px;color:var(--mute)}.legend i{display:inline-block;width:14px;height:3px;vertical-align:middle;margin-right:5px}
.bars{display:grid;grid-template-columns:1fr;gap:3px;font-size:12px}.bar{display:flex;align-items:center;gap:8px}.bar b{display:inline-block;height:10px;background:#5b8def;border-radius:2px}.bar span{color:var(--mute);min-width:52px}.bar em{font-style:normal;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px}.card{border:1px solid var(--line);border-radius:6px;padding:8px 10px;background:#121620}
p.note{color:var(--mute);font-size:12px;margin:4px 0}
</style></head><body>
<h1>The davy bench</h1>
<p class="note">one atomic round onto a town building; every step after it, measured on the Pi · built ${esc(DATA.builtAt)}</p>
<span class="pill ${ok ? "ok" : "bad"}" data-verdict>${ok ? "✓" : "✗"} ${esc(verdict)}</span>
${mismatches.length ? `<ul>${mismatches.map((m) => `<li>${esc(m)}</li>`).join("")}</ul>` : ""}
<div id="root"></div>
<script>
const DATA = ${JSON.stringify(DATA)};
const COLORS = ["#5b8def","#e0a052","#4caf50","#e05252","#b07ce0","#52c7e0","#e052b0","#9aa3ad","#f0e060","#60f0c0"];
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
function chart(series, opts) {
  const W = 1000, H = 300, L = 54, R = 12, T = 12, B = 30;
  const xs = series.flatMap((s) => s.pts.map((p) => p[0])), ys = series.flatMap((s) => s.pts.map((p) => p[1]));
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const log = !!opts.log;
  const yv = (v) => (log ? Math.log10(Math.max(0.01, v)) : v);
  let y0 = log ? Math.floor(yv(Math.min(...ys.filter((v) => v > 0)))) : 0, y1 = Math.ceil(yv(Math.max(...ys, 1)));
  if (y1 <= y0) y1 = y0 + 1;
  const sx = (x) => L + ((x - x0) / Math.max(1e-9, x1 - x0)) * (W - L - R);
  const sy = (y) => T + (1 - (yv(y) - y0) / (y1 - y0)) * (H - T - B);
  let g = "";
  const ticks = log ? Array.from({ length: y1 - y0 + 1 }, (_, i) => Math.pow(10, y0 + i)) : Array.from({ length: 6 }, (_, i) => y0 + ((y1 - y0) * i) / 5);
  for (const t of ticks) g += \`<line x1="\${L}" x2="\${W - R}" y1="\${sy(t)}" y2="\${sy(t)}" stroke="#2a2f38"/><text x="\${L - 6}" y="\${sy(t) + 4}" fill="#9aa3ad" font-size="11" text-anchor="end">\${log ? t : Math.round(t)}</text>\`;
  for (const xt of [x0, (x0 + x1) / 2, x1]) g += \`<text x="\${sx(xt)}" y="\${H - 8}" fill="#9aa3ad" font-size="11" text-anchor="middle">\${Math.round(xt)}</text>\`;
  if (opts.zero) g += \`<line x1="\${sx(0)}" x2="\${sx(0)}" y1="\${T}" y2="\${H - B}" stroke="#e05252" stroke-dasharray="4 3"/>\`;
  series.forEach((s, i) => { g += \`<path d="\${s.pts.map((p, k) => (k ? "L" : "M") + sx(p[0]).toFixed(1) + " " + sy(p[1]).toFixed(1)).join(" ")}" fill="none" stroke="\${COLORS[i % COLORS.length]}" stroke-width="\${s.width || 1.4}" \${s.dash ? 'stroke-dasharray="5 3"' : ""} opacity="0.9"/>\`; });
  g += \`<text x="\${L + 6}" y="\${T + 12}" fill="#9aa3ad" font-size="12">\${esc(opts.title)} — \${esc(opts.unit)}</text>\`;
  return \`<svg viewBox="0 0 \${W} \${H}" role="img" aria-label="\${esc(opts.title)}">\${g}</svg><div class="legend">\${series.map((s, i) => \`<span><i style="background:\${COLORS[i % COLORS.length]}"></i>\${esc(s.name)}</span>\`).join("")}</div>\`;
}
function bars(rows, title) {
  const max = Math.max(1, ...rows.map((r) => r.pct));
  return \`<div class="card"><b>\${esc(title)}</b><div class="bars">\${rows.map((r) => \`<div class="bar"><span>\${r.pct.toFixed(1)}%</span><b style="width:\${(100 * r.pct / max).toFixed(0)}px"></b><em title="\${esc(r.name)}">\${esc(r.name)}</em></div>\`).join("")}</div></div>\`;
}
let out = "";
const groups = new Map();
for (const r of DATA.runs) { const k = r.mode + " / " + r.target + " / seed " + r.seed; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); }
for (const [k, g] of groups) {
  out += \`<h2>\${esc(k)} — \${g[0].stones} stones within 25 m\${g[0].walls ? ", " + g[0].walls + " wall courses" : ""}</h2>\`;
  out += chart(g.map((r) => ({ name: r.label, pts: r.rows.map((x) => [x[0], x[1]]) })), { title: "one step's cost, from sixty steps before the burst (step 0)", unit: "milliseconds, log scale", log: true, zero: true });
  out += chart(g.flatMap((r) => [{ name: r.label + " awake chunks", pts: r.rows.map((x) => [x[0], x[2]]) }, { name: r.label + " contacts", pts: r.rows.map((x) => [x[0], x[3]]), dash: true }]), { title: "awake chunks (solid) and contacts (dashed)", unit: "count", zero: true });
  out += \`<div class="wrap"><table><tr><th>run</th><th>burst ms</th><th>burst window ms</th><th>walls lost</th><th>shadow %</th><th>explode %</th><th>road map %</th><th>after mean ms</th><th>after p95</th><th>after worst</th><th>after sum</th><th>peak awake</th><th>peak contacts</th><th>heavy steps</th><th>steps over 7 ms</th><th>solve %</th><th>pairs %</th><th>welds %</th><th>sweeper %</th><th>hash</th><th>draws</th></tr>\`;
  for (const r of g) out += \`<tr><td>\${esc(r.label)}</td><td>\${r.burst.ms}</td><td>\${r.burst.windowMs}</td><td>\${r.burst.lost}</td><td>\${r.shares.shadow}</td><td>\${r.shares.explode}</td><td>\${r.shares.flow}</td><td>\${r.after.meanMs}</td><td>\${r.after.p95Ms}</td><td>\${r.after.worstMs}</td><td>\${r.after.sumMs}</td><td>\${r.after.peakAwake}</td><td>\${r.after.peakContacts}</td><td>\${r.after.heavySteps}</td><td>\${r.after.over7}</td><td>\${r.shares.solve}</td><td>\${r.shares.pairs}</td><td>\${r.shares.welds}</td><td>\${r.shares.sweeper}</td><td>\${r.identity.worldHash}/\${r.identity.runHash}</td><td>\${r.identity.draws}</td></tr>\`;
  out += "</table></div>";
  const first = g[0];
  out += \`<div class="grid">\${bars(first.burst.top, first.label + " — the burst window, by function")}\${bars(first.after.top, first.label + " — the after window, by function")}\${first.alloc ? bars(first.alloc.map((a) => ({ name: a.name, pct: a.mb })), first.label + " — bytes allocated in the after window, MB by function") : ""}</div>\`;
}
if (DATA.browser.length) {
  out += \`<h2>the browser on the Pi's display — \${esc(DATA.browser[0].gpu)}</h2>\`;
  out += chart(DATA.browser.map((b) => ({ name: b.label, pts: b.frames.map((f) => [f[0] / 1000, f[1]]) })), { title: "one frame's cost through the burst", unit: "milliseconds, log scale, seconds along", log: true });
  out += chart(DATA.browser.flatMap((b) => [{ name: b.label + " steps per frame", pts: b.frames.map((f) => [f[0] / 1000, f[4]]) }, { name: b.label + " awake chunks ÷ 100", pts: b.frames.map((f) => [f[0] / 1000, f[5] / 100]), dash: true }]), { title: "steps run per frame (solid) and awake chunks in hundreds (dashed)", unit: "count, seconds along" });
  out += \`<div class="wrap"><table><tr><th>run</th><th>frames/s</th><th>drawn/s</th><th>world rate</th><th>steps p50</th><th>frames at six</th><th>frame mean</th><th>frame p95</th><th>frame worst</th><th>over 33 ms</th><th>sim mean</th><th>render mean</th><th>burst frame</th><th>burst render</th><th>peak awake</th><th>peak contacts</th><th>heap peak MB</th><th>sweeper n</th><th>sweeper ms</th><th>sweeper max</th><th>chunks</th></tr>\`;
  for (const b of DATA.browser) { const s = b.summary; out += \`<tr><td>\${esc(b.label)}</td><td>\${s.rafHz}</td><td>\${s.drawHz}</td><td>\${s.worldRate}</td><td>\${s.stepsP50}</td><td>\${s.framesAtSix}/\${s.frames}</td><td>\${s.frame.mean}</td><td>\${s.frame.p95}</td><td>\${s.frame.worst}</td><td>\${s.over33}</td><td>\${s.sim.mean}</td><td>\${s.render.mean}</td><td>\${s.burstFrameMs}</td><td>\${s.burstRenderMs}</td><td>\${s.peakAwakeChunks}</td><td>\${s.peakContacts}</td><td>\${s.heapPeakMB}</td><td>\${s.gc.n}</td><td>\${s.gc.ms}</td><td>\${s.gc.maxMs}</td><td>\${s.chunksDrawn}/\${s.chunksTotal}</td></tr>\`; }
  out += "</table></div>";
}
document.getElementById("root").innerHTML = out;
</script></body></html>
`;
fs.writeFileSync(path.join(HERE, "index.html"), html);
console.log(`wrote index.html — ${runs.length} bench runs, ${browser.length} browser runs`);
process.exit(ok ? 0 : 1);
