// COLDSNAP — depot-test: the gate keeps its name (P7 T22). The suite lives
// in scripts/tests/, one file per era, imported IN ORDER — import order is
// execution order and matches the old file top to bottom.
//
// DEVIATION from the plan's literal Step 4 code (reported): several era
// files carry a bare `await import(...)` moved verbatim from the original
// monolithic file (rule 3/4 — block bodies untouched). Node does not block a
// STATICALLY-imported sibling module from starting before an earlier
// sibling's top-level await resolves — verified with a 3-line repro — so
// plain `import "./tests/0N-*.mjs";` lines reorder output relative to the
// original file. Each era file is imported dynamically and AWAITED in turn
// instead; this restores the exact original top-to-bottom order. harness.mjs
// owns ok(), the counters, and the exit; nothing here runs a test.
import { finish } from "./tests/harness.mjs";
await import("./tests/harness.mjs");
await import("./tests/shared.mjs");
await import("./tests/01-engine-era.mjs");
await import("./tests/02-front-f1.mjs");
await import("./tests/03-bell-polish.mjs");
await import("./tests/04-vision-command-possession.mjs");
await import("./tests/05-the-front.mjs");
await import("./tests/06-troops-physics.mjs");
await import("./tests/07-armor-demolition.mjs");
await import("./tests/08-debug-pass.mjs");
await import("./tests/09-reorg.mjs");
await import("./tests/10-command-refit.mjs");
await import("./tests/11-hiring-hall.mjs");
await import("./tests/12-the-mech.mjs");
await import("./tests/13-the-score.mjs");
await import("./tests/14-the-placement-law.mjs");
await import("./tests/15-the-open-siege.mjs");
await import("./tests/16-the-deep-floor.mjs");
await import("./tests/17-the-davy-crockett.mjs");
await import("./tests/18-the-green-fog.mjs");
await import("./tests/19-the-atomic-look.mjs");
await import("./tests/20-the-possessed-trigger.mjs");
await import("./tests/21-the-broken-ridge.mjs");
await import("./tests/22-the-tesla-coil.mjs");
finish();
