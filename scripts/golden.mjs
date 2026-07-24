// Golden determinism gate (the buildout plan's T6, plus demo-parity).
// 1. Re-extracts the physics core from the FROZEN demo file at test time and
//    asserts src/engine/core.js produces bit-identical worldHash trajectories —
//    so the extracted engine can never silently drift from the demo.
// 2. Cross-rebuild determinism: same seed => same hash after 10 sim-seconds.
// 3. Seed architecture: idle worlds are seed-invariant (rng is drawn only by
//    ordnance), and seeds diverge once a volley is scripted — which is why
//    every parity run here scripts ordnance.
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const fails = [];
const ok = (name, cond) => {
  console.log(`${cond ? "PASS" : "FAIL"} — ${name}`);
  if (!cond) fails.push(name);
};

// --- re-extract the engine slice from the frozen demo (lines 1-4, 7-2098)
const demoSrc = readFileSync(new URL("../src/demo/coldsnap-proving-grounds.jsx", import.meta.url), "utf8").split("\n");
const slice = [...demoSrc.slice(0, 4), ...demoSrc.slice(6, 2098)].join("\n");
const tmp = mkdtempSync(join(tmpdir(), "coldsnap-golden-"));
const demoModPath = join(tmp, "demo-engine.mjs");
writeFileSync(demoModPath, slice);

const demoEng = await import(pathToFileURL(demoModPath));
const coreEng = await import(new URL("../src/engine/core.js", import.meta.url));

const run = (eng, seed, { volley = false, steps = 1200 } = {}) => {
  const w = eng.buildProvingGrounds(seed);
  const h0 = eng.worldHash(w);
  for (let i = 0; i < steps / 2; i++) { w.events.length = 0; eng.stepWorld(w); }
  if (volley) eng.fireVolley(w, 0, -30, 6, "player");
  for (let i = 0; i < steps / 2; i++) { w.events.length = 0; eng.stepWorld(w); }
  return { h0, h1: eng.worldHash(w), kills: w.killCount };
};

// --- demo-parity: the extracted core IS the demo's engine
{
  const a = run(demoEng, 1234, { volley: true });
  const b = run(coreEng, 1234, { volley: true });
  ok("parity: identical hash at t=0 (demo slice vs core)", a.h0 === b.h0);
  ok("parity: identical hash after 10s + scripted volley", a.h1 === b.h1);
  ok("parity: identical kill count", a.kills === b.kills);
  ok("scripted volley actually kills (test isn't vacuous)", a.kills > 0);
}

// --- cross-rebuild determinism on the extracted core
{
  const a = run(coreEng, 777, { volley: true });
  const b = run(coreEng, 777, { volley: true });
  ok("same seed, fresh rebuild: identical hash (with ordnance)", a.h1 === b.h1);
}

// --- seed architecture (documented FINDING: rng drawn only by ordnance)
{
  const a = run(coreEng, 777, { volley: false, steps: 600 });
  const b = run(coreEng, 778, { volley: false, steps: 600 });
  ok("idle worlds are seed-invariant", a.h1 === b.h1);
  const c = run(coreEng, 777, { volley: true, steps: 600 });
  const d = run(coreEng, 778, { volley: true, steps: 600 });
  ok("seeds diverge once ordnance draws rng", c.h1 !== d.h1);
}

if (fails.length) {
  console.error(`\n${fails.length} FAILURE(S)`);
  process.exit(1);
}
console.log("\nGOLDEN GATE: ALL PASS");
