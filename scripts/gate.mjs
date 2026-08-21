#!/usr/bin/env node
// COLDSNAP — gate.mjs: the gate-log wrapper (mk1.98, owner). Runs one named
// gate unchanged, mirrors its output, and appends one line per run to
// .superpowers/gates.log so a status check can read which gates ran and what
// they returned without the agent's scrollback. CI calls the gates directly
// and never writes this log.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const GATES = {
  "depot-test": ["scripts/depot-test.mjs"],
  "golden": ["scripts/golden.mjs"],
  "depot-lint": ["scripts/depot-lint.mjs"],
  "smoke": ["scripts/smoke.mjs"],
  "predicate": ["scripts/predicate-test.mjs"],
  "scenario": ["scripts/scenario-test.mjs"],
  "combat": ["scripts/combat-test.mjs"],
  "accuracy": ["scripts/accuracy-test.mjs"],
};
const name = process.argv[2];
if (!GATES[name]) {
  console.error(`gate.mjs: unknown gate "${name}" — one of: ${Object.keys(GATES).join(", ")}`);
  process.exit(2);
}
const t0 = Date.now();
const r = spawnSync(process.execPath, GATES[name], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, env: process.env });
process.stdout.write(r.stdout || "");
process.stderr.write(r.stderr || "");
const secs = ((Date.now() - t0) / 1000).toFixed(1);
const lines = ((r.stdout || "") + (r.stderr || "")).split("\n").filter((l) => l.trim().length);
const pass = lines.filter((l) => l.startsWith("PASS")).length;
const fail = lines.filter((l) => l.startsWith("FAIL")).length;
const tail = (lines[lines.length - 1] || "").slice(0, 120);
const verdict = r.status === 0 ? "ok" : "FAIL(" + r.status + ")";
fs.mkdirSync(".superpowers", { recursive: true });
fs.appendFileSync(path.join(".superpowers", "gates.log"),
  `${new Date().toISOString()} ${name} ${verdict} ${pass} PASS / ${fail} FAIL — ${tail} (${secs}s)\n`);
process.exit(r.status == null ? 1 : r.status);
