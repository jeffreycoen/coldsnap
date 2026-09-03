import { ok } from "./harness.mjs";
import fs from "node:fs";

// ==== mk2.92: the visible chain =============================================
// The chain shows as a list of commands, each row deletable, and both pies
// hold their disc while QUEUE is lit. Source pins — no sim, no seeds.
{
  console.log("\n[mk2.92: the visible chain]");
  const dg = fs.readFileSync("src/depot/DepotGame.jsx", "utf8");
  ok("pins: both pies hold their disc while QUEUE is lit", (dg.match(/else if \(!C\.view\.queueOn\) C\.view\.pieOpen = false;/g) || []).length === 2);
  ok("pins: the queue panel stands", /data-chain-list/.test(dg) && /chainList: \(\(\) => \{/.test(dg));
  ok("pins: the panel leads with the active order", /▶ \{hud\.chainList\.active\}/.test(dg));
  ok("pins: each row deletes its own leg", /data-chain-row/.test(dg) && /C\.view\.deleteLeg\(i\)/.test(dg));
}
