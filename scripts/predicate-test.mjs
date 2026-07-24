// Predicate parity gate — the buildout plan's T3: the declarative predicates
// must agree with the FROZEN demo's live match() closures across the full
// cause × attacker × group × volley grid, zero mismatches. The demo slice
// (engine + TRIALS) is re-extracted at test time, so drift is impossible.
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { matchKill, CONTRACT_PREDICATES } from "../src/game/predicate.js";

const fails = [];
const ok = (name, cond) => {
  console.log(`${cond ? "PASS" : "FAIL"} — ${name}`);
  if (!cond) fails.push(name);
};

// extract engine + TRIALS from the frozen demo (plan Appendix B recipe)
const src = readFileSync(new URL("../src/demo/coldsnap-proving-grounds.jsx", import.meta.url), "utf8").split("\n");
const slice = [...src.slice(0, 4), ...src.slice(6, 2098), ...src.slice(2814, 2832), "export { TRIALS };"].join("\n");
const tmp = mkdtempSync(join(tmpdir(), "coldsnap-pred-"));
const modPath = join(tmp, "demo-trials.mjs");
writeFileSync(modPath, slice);
const demo = await import(pathToFileURL(modPath));

ok("demo slice exports the seven trials", demo.TRIALS.length === 7);

const CAUSES = ["PROJECTILE", "BLAST", "CRUSH", "FLIP", "DROWN", "TOSS", "COLLAPSE", "IMPACT"];
const ATTACKERS = ["player", "world", "gren"];
const GROUPS = ["gunnery", "roadlane", "ponddrill", "pit", "garrison", "poolside", "convoy", "scout", ""];
const VOLLEYS = [0, 3];
const KINDS = ["unit", "vehicle"];

let checked = 0, mismatches = [];
for (const t of demo.TRIALS) {
  if (!t.match) continue; // saturation is volleyMode — handled by the runner
  const pred = CONTRACT_PREDICATES[t.id];
  for (const cause of CAUSES) for (const attacker of ATTACKERS) for (const group of GROUPS) for (const volley of VOLLEYS) for (const kind of KINDS) {
    const e = { type: "kill", cause, attacker, group, volley, kind, buildingId: "", t: 10 };
    const a = !!t.match(e), b = matchKill(pred, e);
    checked++;
    if (a !== b) mismatches.push(`${t.id}: ${cause}/${attacker}/${group}/${volley}/${kind} closure=${a} pred=${b}`);
  }
}
console.log(`grid: ${checked} combinations across ${demo.TRIALS.filter((t) => t.match).length} contracts`);
ok("zero mismatches between closures and predicates", mismatches.length === 0);
if (mismatches.length) console.log(mismatches.slice(0, 10).join("\n"));
ok("saturation carries volleyMode for the runner", CONTRACT_PREDICATES.saturation.volleyMode === true && CONTRACT_PREDICATES.saturation.need === 3);

if (fails.length) {
  console.error(`\n${fails.length} FAILURE(S)`);
  process.exit(1);
}
console.log("\nPREDICATE GATE: ALL PASS");
