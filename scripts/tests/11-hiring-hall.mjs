// COLDSNAP suite — era 11: THE HIRING HALL (P7.2). T1 (mk1.80): easier
// selection — the tap radii, the cycle rule, select-all-of-type, the wiring.
import { ok } from "./harness.mjs";
import { makeWorld } from "../../src/engine/core.js";
import { makeSquad } from "../../src/depot/squads.js";
import { spawnSquadMembers, TAP_SQUAD_M, TAP_HULL_M, TAP_TOWER_M, nextPick, squadIdsOfType } from "../../src/depot/state.js";
import fs from "node:fs";

const flatF = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (x, z, o) => { o.x = 0; o.y = 1; o.z = 0; return o; } };

// ---- P7.2 T1 (a): the radii live in one home and grew // provisional (F5)
ok("T1(a): the tap radii — squad 2.4, hull 4.0, tower 2.4", TAP_SQUAD_M === 2.4 && TAP_HULL_M === 4.0 && TAP_TOWER_M === 2.4);

// ---- P7.2 T1 (b): the cycle rule — nearest first, next on re-tap, wraps
{
  const cands = [{ key: "sq:2", d: 1.2 }, { key: "sq:1", d: 0.4 }, { key: "veh:9", d: 2.0 }];
  ok("T1(b): no current pick — the nearest wins", nextPick(cands, null).key === "sq:1");
  ok("T1(b): a re-tap hands the pick around", nextPick(cands, "sq:1").key === "sq:2" && nextPick(cands, "sq:2").key === "veh:9");
  ok("T1(b): the cycle wraps", nextPick(cands, "veh:9").key === "sq:1");
  ok("T1(b): empty ground picks nothing", nextPick([], null) === null);
}

// ---- P7.2 T1 (c): select-all-of-type — same type, live members, never sealed
{
  const w = makeWorld({ field: flatF, seed: 80 });
  const a = makeSquad(1, "rifles", 1, 0, 0); spawnSquadMembers(w, a);
  const b = makeSquad(2, "rifles", 1, 10, 0); spawnSquadMembers(w, b);
  const c = makeSquad(3, "mg", 1, 20, 0); spawnSquadMembers(w, c);
  const d = makeSquad(4, "rifles", 1, 30, 0); spawnSquadMembers(w, d); d.ridingIn = 1;
  ok("T1(c): all rifles, never the mg team, never the sealed squad",
    JSON.stringify(squadIdsOfType(w, [a, b, c, d], "rifles")) === "[1,2]");
}

// ---- P7.2 T1 (d): the wiring (the audit(j) idiom — tap-to-handler)
{
  const src = fs.readFileSync("src/depot/DepotGame.jsx", "utf8");
  ok("T1(d): squad picking reads the shared radius", /< TAP_SQUAD_M\) return sq;/.test(src));
  ok("T1(d): hull picking rides the cycle scan on its own radius", /d2 <= TAP_HULL_M\) cands\.push/.test(src) && !/vehicleAtPoint/.test(src));
  ok("T1(d): the tap builds candidates and cycles them", /nextPick\(cands, curSel\)/.test(src));
  ok("T1(d): towers join the pick only in plain command", /b\.kind === "tower" && !S\.mode && !S\.sellMode/.test(src));
  ok("T1(d): the pie carries SELECT ALL wired to its handler", /key: "select_all", .*selectAllType\(\)/.test(src));
  ok("T1(d): group orders fan out through one door", /for \(const gsq of selectedGroup\(\)\)/.test(src));
  ok("T1(d): accepting a line clears the group", /S\.selSquadId = null; S\.orderMode = null; S\.buildPt0 = null; S\.selSquadIds = null;/.test(src));
}
