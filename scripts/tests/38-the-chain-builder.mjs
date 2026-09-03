import { ok } from "./harness.mjs";
import fs from "node:fs";

// ==== mk2.91: the chain builder =============================================
// The QUEUE wedge, the append-not-replace tap, the numbered flags, leg
// delete, CLEAR, and the plain-order wipe. Interface work — source pins,
// no sim runs, no fixture seeds.
{
  console.log("\n[mk2.91: the chain builder]");
  const dg = fs.readFileSync("src/depot/DepotGame.jsx", "utf8");
  ok("pins: the QUEUE wedge stands on both pies", (dg.match(/key: "queue", icon: "⛓", label: "QUEUE"/g) || []).length === 2);
  ok("pins: the CLEAR wedge stands on both pies", (dg.match(/key: "clearchain", icon: "✂"/g) || []).length === 2);
  ok("pins: the toggle refuses a group", /ONE SQUAD AT A TIME/.test(dg) && /view\.queueOn = !view\.queueOn;/.test(dg));
  ok("pins: the squad tap appends to the chain", /\(qsq\._queue \|\| \(qsq\._queue = \[\]\)\)\.push\(\{ kind: om, x: d\.x, z: d\.z \}\);/.test(dg));
  ok("pins: the vehicle tap appends to the chain", /\(v\._queue \|\| \(v\._queue = \[\]\)\)\.push\(\{ kind: om, x: d\.x, z: d\.z \}\);/.test(dg));
  ok("pins: a standing patrol refuses the append", (dg.match(/THE CHAIN ENDS AT A PATROL/g) || []).length >= 2);
  ok("pins: the plain squad fan wipes the chain", /gsq\._build = null; gsq\._queue = null; \}/.test(dg));
  ok("pins: the plain vehicle orders wipe the chain", (dg.match(/v\._queue = null;/g) || []).length >= 4);
  ok("pins: a queued patrol closes the chain", /push\(\{ kind: "patrol", ax: lp\.a\.x, az: lp\.a\.z, bx: lp\.b\.x, bz: lp\.b\.z \}\);/.test(dg));
  ok("pins: the legs project as numbered flags", /view\.chainScreens = chainOwner\._queue\.map/.test(dg) && /data-chain-flag/.test(dg));
  ok("pins: a tapped flag deletes its leg", /o\._queue\.splice\(i, 1\);/.test(dg));
  const cs = fs.readFileSync("src/depot/cards.js", "utf8");
  ok("pins: the two teaching cards exist", /queue_chain: \{ label: "QUEUE"/.test(cs) && /clear_chain: \{ label: "CLEAR"/.test(cs));
}
