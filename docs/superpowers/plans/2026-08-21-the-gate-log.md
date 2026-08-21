# THE GATE LOG — task plan (proposed mark mk1.98)

*Written 2026-08-21 on the owner's word. One small task. Suggested model: Sonnet — one proven file, one standing-orders line, no design.*

## The ruling (owner, 2026-08-21)

Gate runs leave a record. A wrapper, `scripts/gate.mjs <name>`, runs the named gate unchanged, mirrors its output, and appends one line per run to `.superpowers/gates.log` — time, gate, verdict, pass/fail counts, the gate's own last line, duration. A status check on a running task reads that log's tail and states which gates have run and what they returned, instead of "unknowable from the tree." The four gate scripts stay byte-untouched; the log is never committed; CI keeps calling the gates directly.

## Plan verification (already run by the plan-writer)

The Step 1 file was executed verbatim from scratch against three real gates — the log lines it wrote:

```
2026-08-21T13:01:27.126Z depot-lint ok 0 PASS / 0 FAIL — depot-lint PASS (0.0s)
2026-08-21T13:01:48.199Z golden ok 7 PASS / 0 FAIL — GOLDEN GATE: ALL PASS (21.0s)
2026-08-21T13:03:01.685Z depot-test ok 1707 PASS / 0 FAIL — depot-test PASS (63.9s)
```

Exit codes propagate (0 through; unknown gate exits 2 and writes nothing). A gate whose output carries no PASS-prefixed lines (depot-lint) logs 0/0 with the verdict in its tail line — honest, not a defect.

## Required reading (agent; anchors re-verified at dispatch)

This plan whole; `CLAUDE.md` whole (the Dispatch section gains a line); `scripts/depot-test.mjs`, `scripts/golden.mjs`, `scripts/depot-lint.mjs`, `scripts/smoke.mjs` — headers only, to confirm the wrapper's name table matches reality; `package.json` scripts block.

## Trap notes

- **The wrapper is tooling, not game logic** — `Date.now()` is legal here (the `src/depot` rng laws do not reach `scripts/`), and no suite era pins it. No test files change; the expected suite count stays 1707.
- **The smoke gate still needs the preview server** — the wrapper runs the script, it does not manage servers; briefs keep starting and killing the preview around `gate.mjs smoke`.
- **`.superpowers/gates.log` is untracked by convention** — never staged, like every diagnostic there.
- **spawnSync buffers, then mirrors** — gate output prints after the child exits, not live. Accepted: agents read output after completion anyway.

## Step 1 — the wrapper (new file `scripts/gate.mjs`, verbatim — this exact text ran in the probe)

```js
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
```

## Step 2 — the standing order (CLAUDE.md, Dispatch section)

After the "Deep status" bullet, add:

```
- Gates in dispatch briefs run through `node scripts/gate.mjs <name>`; every run appends one line to `.superpowers/gates.log`, and a status check on a running task reads that tail. CI calls the gates directly and never writes the log.
```

## Step 3 — the gates (run ONLY these, THROUGH the wrapper — the run is its own proof)

- `node scripts/gate.mjs depot-lint` — exits 0; one line appended.
- `node scripts/gate.mjs depot-test` — exits 0; the line reads `depot-test ok 1707 PASS / 0 FAIL — depot-test PASS`.
- `node scripts/gate.mjs nonsense` — exits 2, prints the name table, appends nothing.
- `cat .superpowers/gates.log` — exactly the two lines from the runs above, in order.

## Step 4 — the landing

`src/version.js` → `mk1.98`; build AFTER the bump; commit (`the gate log, mk1.98` — `scripts/gate.mjs`, `CLAUDE.md`, `src/version.js`; the log file itself is never staged); push. Report: the wrapper's own log lines as run, no fixture seeds drawn (no test changes), deviations as labeled bullets.

## Named exclusions

- The smoke wrapper path is available but unproven under a live preview — the first dispatched task that runs `gate.mjs smoke` proves it in the field; a failure there is a stop-and-report like any gate.
- No log rotation — the file grows by one line per gate run; if it ever matters, that is polish.
