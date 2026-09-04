import { ok } from "./harness.mjs";
import fs from "node:fs";

// ==== mk2.89: the screen select =============================================
// The green ALL button sweeps every live player squad and hull on screen
// into one group; a three-wedge reticle (MOVE / DEFEND / ATTACK) at the
// group's centroid orders them together. Interface work — the suite pins the
// mechanism's lines; no sim runs here, so no fixture seeds.
{
  console.log("\n[mk2.89: the screen select]");
  const dg = fs.readFileSync("src/depot/DepotGame.jsx", "utf8");
  ok("pins: the green ALL button calls the sweep", /data-group-select/.test(dg) && /C\.view\.selectScreen\(\);/.test(dg));
  ok("pins: the sweep filters by the live camera", /const nd = R\.project\(x, y, z\);/.test(dg) && /view\.groupSel = \{ sqIds, vehIds \};/.test(dg));
  ok("pins: the sweep takes hulls with a driver policy only", /\(b\.kind !== "vehicle" && b\.kind !== "mech"\) \|\| !b\.alive \|\| b\.team !== 1 \|\| !b\.drv/.test(dg));
  ok("pins: the group tap fans to squads and hulls alike", /for \(const qid of gs\.sqIds\)/.test(dg) && /for \(const vid of gs\.vehIds\)/.test(dg));
  ok("pins: the group defend clears the hull's road", /gv\.order = "defend"; gv\.dest = null; gv\.goal = null; gv\._route = null; gv\._routeDest = null;/.test(dg));
  ok("pins: the reticle stands at the group's centroid", /view\.groupScreen = nd6/.test(dg));
  ok("pins: the group tap runs before the single-unit consumers", /if \(consumeGroupOrderTap\(p\)\) return;\n\s*if \(consumeVehOrderTap\(p\)\) return;/.test(dg));
}
