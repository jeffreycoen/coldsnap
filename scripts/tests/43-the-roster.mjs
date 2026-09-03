import { ok } from "./harness.mjs";
import fs from "node:fs";

// ==== mk2.96: the roster ====================================================
// The button, the living force's rows with their kills, and the tap-to-jump.
// Source pins — no sim runs, no fixture seeds.
{
  console.log("\n[mk2.96: the roster]");
  const dg = fs.readFileSync("src/depot/DepotGame.jsx", "utf8");
  ok("pins: the button stands beside ALL", /data-roster-toggle/.test(dg) && /⚏ ROSTER/.test(dg));
  ok("pins: the panel lists the living force", /data-roster/.test(dg) && /NO ONE TO COMMAND/.test(dg) && /data-roster-row/.test(dg));
  ok("pins: the rows carry the kills", /✜ \{r\.kills\}/.test(dg));
  ok("pins: the hud builds the rows from squads and hulls", /roster: view\.rosterOpen \? \(\(\) => \{/.test(dg));
  ok("pins: a tapped row jumps, selects, and closes the panel", /view\.rosterJump = \(kindR, idR\) => \{/.test(dg) && /view\.rosterOpen = false;/.test(dg));
  ok("pins: the panel hides under possession", /\{hud\.roster && !hud\.possessed && \(/.test(dg));
}
