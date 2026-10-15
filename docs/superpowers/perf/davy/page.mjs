// THE PAGE (0.6.8, redrawn 0.6.9): reads every bench run beside it, checks
// that the runs of one world tell the same story in every non-timing field,
// and writes index.html with every chart drawn into the file as a fixed
// picture — no script, so any viewer shows it: the step cost through the
// burst, the awake stones and the contacts, each window's function shares,
// the watched functions by source line in the quiet window, the second
// burst, the browser frames before and after the burst, and the rows.
// Exits 1 on any identity mismatch.
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
for (const r of runs) { const k = `${r.seed}/${r.mode}/${r.target}${r.hot ? "/hot" : ""}${r.loft ? "/loft" + r.loft : ""}`; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); }
const SAME = [["stones", (r) => r.stonesNear], ["burstStep", (r) => r.burstStep], ["worldHash", (r) => r.identity.worldHash], ["runHash", (r) => r.identity.runHash], ["draws", (r) => r.identity.draws], ["breaks", (r) => r.identity.breaksTotal], ["lost", (r) => r.identity.lostTotal], ["peakAwake", (r) => r.after.peakAwake], ["peakContacts", (r) => r.after.peakContacts], ["rows", (r) => r.rows.length], ["burst2Step", (r) => (r.identity.burst2Step == null ? -1 : r.identity.burst2Step)]];
const mismatches = [];
for (const [k, g] of groups) for (const r of g.slice(1)) for (const [name, get] of SAME) if (get(r) !== get(g[0])) mismatches.push(`${k}: ${r.label} ${name} ${get(r)} against ${g[0].label} ${get(g[0])}`);
const ok = mismatches.length === 0;
const verdict = ok ? `same world in every copy — ${runs.length} runs over ${groups.size} world${groups.size === 1 ? "" : "s"}` : `WORLDS DIFFER — ${mismatches.length} mismatch${mismatches.length === 1 ? "" : "es"}`;
console.log("identity: " + verdict);
for (const m of mismatches) console.log("  " + m);

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const COLORS = ["#5b8def", "#e0a052", "#4caf50", "#e05252", "#b07ce0", "#52c7e0", "#e052b0", "#9aa3ad", "#f0e060", "#60f0c0"];
const nz = (v) => (v == null ? "—" : v);
// a line chart as a fixed SVG picture
function chart(series, opts) {
  const W = 1000, H = 300, L = 54, R = 12, T = 12, B = 30;
  const xs = series.flatMap((s) => s.pts.map((p) => p[0])), ys = series.flatMap((s) => s.pts.map((p) => p[1]));
  if (!xs.length) return "";
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const log = !!opts.log;
  const yv = (v) => (log ? Math.log10(Math.max(0.01, v)) : v);
  const pos = ys.filter((v) => v > 0);
  let y0 = log ? Math.floor(yv(pos.length ? Math.min(...pos) : 1)) : 0, y1 = Math.ceil(yv(Math.max(...ys, 1)));
  if (y1 <= y0) y1 = y0 + 1;
  const sx = (x) => L + ((x - x0) / Math.max(1e-9, x1 - x0)) * (W - L - R);
  const sy = (y) => T + (1 - (yv(y) - y0) / (y1 - y0)) * (H - T - B);
  let g = "";
  const ticks = log ? Array.from({ length: y1 - y0 + 1 }, (_, i) => Math.pow(10, y0 + i)) : Array.from({ length: 6 }, (_, i) => y0 + ((y1 - y0) * i) / 5);
  for (const t of ticks) g += `<line x1="${L}" x2="${W - R}" y1="${sy(t).toFixed(1)}" y2="${sy(t).toFixed(1)}" stroke="#2a2f38"/><text x="${L - 6}" y="${(sy(t) + 4).toFixed(1)}" fill="#9aa3ad" font-size="11" text-anchor="end">${log ? t : Math.round(t)}</text>`;
  for (const xt of [x0, (x0 + x1) / 2, x1]) g += `<text x="${sx(xt).toFixed(1)}" y="${H - 8}" fill="#9aa3ad" font-size="11" text-anchor="middle">${Math.round(xt * 10) / 10}</text>`;
  if (opts.zero && x0 <= 0 && x1 >= 0) g += `<line x1="${sx(0).toFixed(1)}" x2="${sx(0).toFixed(1)}" y1="${T}" y2="${H - B}" stroke="#e05252" stroke-dasharray="4 3"/>`;
  series.forEach((s, i) => { g += `<path d="${s.pts.map((p, k) => (k ? "L" : "M") + sx(p[0]).toFixed(1) + " " + sy(p[1]).toFixed(1)).join(" ")}" fill="none" stroke="${COLORS[i % COLORS.length]}" stroke-width="${s.width || 1.4}"${s.dash ? ' stroke-dasharray="5 3"' : ""} opacity="0.9"/>`; });
  g += `<text x="${L + 6}" y="${T + 12}" fill="#9aa3ad" font-size="12">${esc(opts.title)} — ${esc(opts.unit)}</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.title)}">${g}</svg><div class="legend">${series.map((s, i) => `<span><i style="background:${COLORS[i % COLORS.length]}"></i>${esc(s.name)}</span>`).join("")}</div>`;
}
function bars(rows, title, unit) {
  if (!rows || !rows.length) return "";
  const max = Math.max(1, ...rows.map((r) => r.v));
  return `<div class="card"><b>${esc(title)}</b><div class="bars">${rows.map((r) => `<div class="bar"><span>${r.v.toFixed(1)}${unit}</span><b style="width:${(100 * r.v / max).toFixed(0)}px"></b><em title="${esc(r.name)}">${esc(r.name)}</em></div>`).join("")}</div></div>`;
}
const pctRows = (top) => (top || []).slice(0, 12).map((r) => ({ name: r.name, v: r.pct }));
function lineTable(lines, title) {
  if (!lines) return "";
  const fns = ["stepWorld", "stepDepot", "stepStatus", "collectContacts", "stepSleep", "weldBreakPass", "tickWar", "explode"].filter((f) => lines[f] && lines[f].length);
  if (!fns.length) return "";
  return `<div class="card"><b>${esc(title)}</b><div class="wrap"><table><tr><th>function</th><th colspan="6">source line : share of the function's own ticks</th></tr>${fns.map((f) => `<tr><td>${f}</td>${lines[f].slice(0, 6).map((l) => `<td>${l.line} : ${l.pct}%</td>`).join("")}</tr>`).join("")}</table></div></div>`;
}

let out = "";
for (const [k, g] of groups) {
  const f = g[0];
  out += `<h2>${esc(k)} — ${f.stonesNear} stones within 25 m${f.wallCourses ? ", " + f.wallCourses + " wall courses" : ""}${f.secondS ? ", a second burst " + f.secondS + " s later" : ""}${f.loft ? ", the round lofted " + f.loft + " s" : ""}</h2>`;
  out += chart(g.map((r) => ({ name: r.label, pts: r.rows.slice(Math.max(0, r.burstStep - 60)).map((x) => [x.i - r.burstStep, x.ms]) })), { title: "one step's cost, from sixty steps before the burst (step 0)", unit: "milliseconds, log scale", log: true, zero: true });
  out += chart(g.flatMap((r) => [{ name: r.label + " awake chunks", pts: r.rows.slice(Math.max(0, r.burstStep - 60)).map((x) => [x.i - r.burstStep, x.chunks]) }, { name: r.label + " contacts", pts: r.rows.slice(Math.max(0, r.burstStep - 60)).map((x) => [x.i - r.burstStep, x.contacts]), dash: true }]), { title: "awake chunks (solid) and contacts (dashed)", unit: "count", zero: true });
  const hasQ = g.some((r) => r.quiet), has2 = g.some((r) => r.second), hasF = g.some((r) => r.flight);
  out += `<div class="wrap"><table><tr><th>run</th>${hasQ ? "<th>quiet step ms</th>" : ""}${hasF ? "<th>flight steps</th><th>flight mean ms</th><th>flight p95</th><th>flight worst</th>" : ""}<th>burst ms</th><th>next step ms</th><th>walls lost</th><th>shadow %</th><th>explode %</th><th>road map %</th><th>after mean ms</th><th>after p95</th><th>after worst</th><th>peak awake</th><th>peak contacts</th><th>heavy steps</th><th>over 7 ms</th><th>solve %</th><th>pairs %</th><th>welds %</th><th>sweeper %</th>${has2 ? "<th>2nd burst ms</th><th>2nd next ms</th><th>2nd shadow %</th><th>2nd explode %</th><th>2nd road map %</th>" : ""}<th>hash</th><th>draws</th></tr>`;
  for (const r of g) out += `<tr><td>${esc(r.label)}</td>${hasQ ? `<td>${r.quiet ? r.quiet.meanMs : "—"}</td>` : ""}${hasF ? (r.flight ? `<td>${r.flight.steps}</td><td>${r.flight.meanMs}</td><td>${r.flight.p95Ms}</td><td>${r.flight.worstMs}</td>` : "<td>—</td><td>—</td><td>—</td><td>—</td>") : ""}<td>${r.burst.ms}</td><td>${nz(r.burst.nextMs)}</td><td>${r.burst.lost}</td><td>${r.shares.shadow}</td><td>${r.shares.explode}</td><td>${r.shares.flow}</td><td>${r.after.meanMs}</td><td>${r.after.p95Ms}</td><td>${r.after.worstMs}</td><td>${r.after.peakAwake}</td><td>${r.after.peakContacts}</td><td>${r.after.heavySteps}</td><td>${r.after.over7}</td><td>${r.shares.solve}</td><td>${r.shares.pairs}</td><td>${r.shares.welds}</td><td>${r.shares.sweeper}</td>${has2 ? (r.second ? `<td>${r.second.ms}</td><td>${r.second.nextMs}</td><td>${r.second.shadow}</td><td>${r.second.explode}</td><td>${r.second.flow}</td>` : "<td>—</td><td>—</td><td>—</td><td>—</td><td>—</td>") : ""}<td>${r.identity.worldHash}/${r.identity.runHash}</td><td>${r.identity.draws}</td></tr>`;
  out += "</table></div>";
  out += `<div class="grid">${f.quiet ? bars(pctRows(f.quiet.profile.top), f.label + " — the quiet window, by function", "%") : ""}${bars(pctRows(f.burst.profile.top), f.label + " — the burst window, by function", "%")}${bars(pctRows(f.after.profile.top), f.label + " — the after window, by function", "%")}${f.second ? bars(pctRows(f.second.profile.top), f.label + " — the second burst, by function", "%") : ""}${f.allocTop ? bars(f.allocTop.slice(0, 10).map((a) => ({ name: a.name, v: a.mb })), f.label + " — bytes allocated in the after window, by function", " MB") : ""}</div>`;
  if (f.quiet) out += lineTable(f.quiet.profile.lines, f.label + " — the quiet window, the watched functions by source line");
  if (f.after && f.after.profile.lines) out += lineTable(f.after.profile.lines, f.label + " — the after window, the watched functions by source line");
}
if (browser.length) {
  out += `<h2>the browser on the Pi's display — ${esc(browser[0].gpu)}</h2>`;
  out += chart(browser.map((b) => ({ name: b.label + " " + (b.mode || "sandbox"), pts: b.frames.map((f) => [+((f.t - b.frames[0].t) / 1000).toFixed(2), f.frame]) })), { title: "one frame's cost through the burst", unit: "milliseconds, log scale, seconds along", log: true });
  out += chart(browser.flatMap((b) => [{ name: b.label + " " + (b.mode || "sandbox") + " steps per frame", pts: b.frames.map((f) => [+((f.t - b.frames[0].t) / 1000).toFixed(2), f.steps]) }, { name: b.label + " awake chunks ÷ 100", pts: b.frames.map((f) => [+((f.t - b.frames[0].t) / 1000).toFixed(2), f.chunks / 100]), dash: true }]), { title: "steps run per frame (solid) and awake chunks in hundreds (dashed)", unit: "count, seconds along" });
  const hasB = browser.some((b) => b.before);
  out += `<div class="wrap"><table><tr><th>run</th><th>mode</th>${hasB ? "<th>before: frames/s</th><th>world rate</th><th>steps p50</th><th>frames at six</th><th>sim per step</th><th>render mean</th><th>awake</th>" : ""}<th>after: frames/s</th><th>drawn/s</th><th>world rate</th><th>steps p50</th><th>frames at six</th><th>frame mean</th><th>frame p95</th><th>frame worst</th><th>over 33 ms</th><th>sim mean</th><th>render mean</th><th>burst frame</th><th>burst render</th><th>peak awake</th><th>peak contacts</th><th>heap peak MB</th><th>sweeper n</th><th>sweeper ms</th><th>sweeper max</th><th>chunks</th></tr>`;
  for (const b of browser) { const s = b.summary, q = b.before; out += `<tr><td>${esc(b.label)}</td><td>${esc(b.mode || "sandbox")}</td>${hasB ? (q ? `<td>${q.rafHz}</td><td>${q.worldRate}</td><td>${q.stepsP50}</td><td>${q.framesAtSix}/${q.frames}</td><td>${nz(q.simPerStep)}</td><td>${q.render.mean}</td><td>${nz(q.meanAwake)}</td>` : "<td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td>") : ""}<td>${s.rafHz}</td><td>${s.drawHz}</td><td>${s.worldRate}</td><td>${s.stepsP50}</td><td>${s.framesAtSix}/${s.frames}</td><td>${s.frame.mean}</td><td>${s.frame.p95}</td><td>${s.frame.worst}</td><td>${s.over33}</td><td>${s.sim.mean}</td><td>${s.render.mean}</td><td>${nz(s.burstFrameMs)}</td><td>${nz(s.burstRenderMs)}</td><td>${s.peakAwakeChunks}</td><td>${s.peakContacts}</td><td>${s.heapPeakMB}</td><td>${s.gc.n}</td><td>${s.gc.ms}</td><td>${s.gc.maxMs}</td><td>${s.chunksDrawn}/${s.chunksTotal}</td></tr>`; }
  out += "</table></div>";
}
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>The davy bench</title>
<style>
:root{--bg:#0f1115;--fg:#e6e6e6;--mute:#9aa3ad;--line:#2a2f38}
body{margin:0;padding:12px 16px 40px;background:var(--bg);color:var(--fg);font:14px/1.45 system-ui,sans-serif;max-width:1100px}
h1{font-size:20px;margin:6px 0 2px}h2{font-size:15px;margin:22px 0 6px;color:var(--mute);text-transform:uppercase;letter-spacing:1px}
.pill{display:inline-block;padding:3px 10px;border-radius:12px;font-weight:600;margin:6px 0}.ok{background:#1d3b22;color:#9be29f}.bad{background:#4a1d1d;color:#ffb3b3}
svg{width:100%;height:auto;display:block;background:#141822;border:1px solid var(--line);border-radius:6px;margin:6px 0}
.wrap{overflow:auto;max-width:100%}table{border-collapse:collapse;font-size:12px;white-space:nowrap}td,th{border-bottom:1px solid var(--line);padding:3px 8px;text-align:right}th{color:var(--mute);font-weight:600}td:first-child,th:first-child{text-align:left}
.legend span{display:inline-block;margin:0 10px 4px 0;font-size:12px;color:var(--mute)}.legend i{display:inline-block;width:14px;height:3px;vertical-align:middle;margin-right:5px}
.bars{display:grid;grid-template-columns:1fr;gap:3px;font-size:12px}.bar{display:flex;align-items:center;gap:8px;min-width:0}.bar b{display:inline-block;height:10px;background:#5b8def;border-radius:2px;flex:none}.bar span{color:var(--mute);min-width:56px;flex:none}.bar em{font-style:normal;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px}.card{border:1px solid var(--line);border-radius:6px;padding:8px 10px;background:#121620;min-width:0;margin:8px 0}
p.note{color:var(--mute);font-size:12px;margin:4px 0}
</style></head><body>
<h1>The davy bench</h1>
<p class="note">one atomic round onto a town building; the quiet seconds before it, the burst, and every step after it, measured on the Pi · built ${esc(new Date().toISOString())}</p>
<span class="pill ${ok ? "ok" : "bad"}" data-verdict>${ok ? "✓" : "✗"} ${esc(verdict)}</span>
${mismatches.length ? `<ul>${mismatches.map((m) => `<li>${esc(m)}</li>`).join("")}</ul>` : ""}
${out}
</body></html>
`;
fs.writeFileSync(path.join(HERE, "index.html"), html);
console.log(`wrote index.html — ${runs.length} bench runs, ${browser.length} browser runs, drawn as fixed pictures`);
process.exit(ok ? 0 : 1);
