import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
const bad = [];
function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(js|jsx)$/.test(f) && readFileSync(p, "utf8").includes("Math.random"))
      bad.push(p);
  }
}
try { walk("src/depot"); } catch { /* dir may not exist yet — pass */ }
if (bad.length) { console.error("Math.random forbidden in src/depot:", bad); process.exit(1); }
console.log("depot-lint PASS");
