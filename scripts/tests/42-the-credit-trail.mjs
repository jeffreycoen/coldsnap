import { ok } from "./harness.mjs";
import * as ST from "../../src/depot/state.js";
import fs from "node:fs";

// ==== mk2.95: the credit trail ==============================================
// creditKill, tested directly with synthetic kill events — no sim runs, no
// fixture seeds. The pins carry the engine emission and the tick's call.
{
  console.log("\n[mk2.95: the credit trail]");
  const CK = ST.creditKill;
  const mkW = (bodies) => { const m = new Map(); for (const b of bodies || []) m.set(b.id, b); return { byId: m }; };
  const kill = (over) => ({ type: "kill", kind: "unit", team: 2, srcId: undefined, killerId: 0, ...over });

  // (a) a member's shot credits his squad
  {
    const sq = { id: 1, memberIds: [10, 11], kills: 0 };
    const w = mkW([{ id: 10, team: 1, kind: "unit" }]);
    if (CK) CK(w, [sq], null, kill({ srcId: 10 }));
    ok("(a) a member's shot credits his squad", !!CK && sq.kills === 1, CK ? String(sq.kills) : "no creditKill");
  }
  // (b) a hull's shot credits the hull
  {
    const v = { id: 20, team: 1, kind: "vehicle", kills: 0 };
    const w = mkW([v]);
    if (CK) CK(w, [], null, kill({ srcId: 20, kind: "mech" }));
    ok("(b) a hull's shot credits the hull", !!CK && v.kills === 1, CK ? String(v.kills) : "no creditKill");
  }
  // (c) a crush credits through killerId when no shot named a shooter
  {
    const v = { id: 21, team: 1, kind: "vehicle", kills: 0 };
    const w = mkW([v]);
    if (CK) CK(w, [], null, kill({ killerId: 21 }));
    ok("(c) a crush credits through killerId", !!CK && v.kills === 1, CK ? String(v.kills) : "no creditKill");
  }
  // (d) friendly fire credits nobody
  {
    const v = { id: 22, team: 2, kind: "vehicle", kills: 0 };
    const sq = { id: 2, memberIds: [12], kills: 0 };
    const w = mkW([v, { id: 12, team: 1, kind: "unit" }]);
    if (CK) { CK(w, [sq], null, kill({ srcId: 22 })); CK(w, [sq], null, kill({ srcId: 12, team: 1 })); }
    ok("(d) friendly fire credits nobody", !!CK && v.kills === 0 && sq.kills === 0, `${v.kills}/${sq.kills}`);
  }
  // (e) a wall is not a kill
  {
    const sq = { id: 3, memberIds: [13], kills: 0 };
    const w = mkW([{ id: 13, team: 1, kind: "unit" }]);
    if (CK) CK(w, [sq], null, kill({ srcId: 13, kind: "wall" }));
    ok("(e) a wall is not a kill", !!CK && sq.kills === 0, String(sq.kills));
  }
  // (f) the enemy's squads accrue through the same trail
  {
    const fsq = { id: 4, memberIds: [14], kills: 0 };
    const w = mkW([{ id: 14, team: 2, kind: "unit" }]);
    if (CK) CK(w, [], [fsq], kill({ srcId: 14, team: 1 }));
    ok("(f) the enemy's squads accrue too", !!CK && fsq.kills === 1, String(fsq.kills));
  }
  // (g) pins: the engine names the shooter on the kill event, depot-gated
  const cs = fs.readFileSync("src/engine/core.js", "utf8");
  ok("(g) pins: the kill event carries srcId under depotCombat", /if \(info\.srcId != null\) ev\.srcId = info\.srcId;/.test(cs));
  // (h) pins: the tick credits at the kill-law site
  const ts = fs.readFileSync("src/depot/tick.js", "utf8");
  ok("(h) pins: the tick credits beside the score", /creditKill\(world, run\.squads, run\.foeSquads, e\);/.test(ts));
}
