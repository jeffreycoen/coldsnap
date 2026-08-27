// COLDSNAP suite era 23 — THE DEVELOPER SANDBOX (mk2.24-mk2.26). A dev
// switch inside the war screen: menu door, free prices, no bell, no save,
// no ending, reroll. Text pins over the component (it cannot run headless);
// the fight switch's one exported seam gets behavior pins in the mk2.26
// block appended by Task 3. No seed is special; no seed is used.
import { ok } from "./harness.mjs";
import { readFileSync } from "node:fs";

const src = (p) => readFileSync(new URL("../../" + p, import.meta.url), "utf8");
const dg = src("src/depot/DepotGame.jsx");
const app = src("src/ui/App.jsx");
const start = src("src/ui/StartScreen.jsx");
const tickSrc = src("src/depot/tick.js");

ok("sandbox: the war screen takes the dev switch", dg.includes("dev = false"));
ok("sandbox: the app routes the sandbox screen", app.includes('"devsandbox"') && app.includes("<DepotGame dev"));
ok("sandbox: a reload never resumes into it", !app.match(/RESUME_SCREENS = new Set\(\[[^\]]*devsandbox/));
ok("sandbox: the menu has the door", start.includes('data-menu="devsandbox"'));
ok("sandbox: prices are free on the bench", dg.includes("dev ? 0 :"));
ok("sandbox: the pace gate opens", dg.match(/buyPaced = \(\) => \{\s*\n\s*if \(dev\) return true;/));
ok("sandbox: the bell never rings (re-taught: !war.dev, tick.js)", tickSrc.includes("if (!war.dev && stepBell(run, world.t))"));
ok("sandbox: the save is never written", dg.match(/const saveFront = \(\) => \{\s*\n\s*if \(dev\) return;/));
ok("sandbox: the war never ends on the bench (re-taught: !war.dev, tick.js)", tickSrc.includes("if (!war.dev) stepDepotCensus"));
ok("sandbox: everything is unlocked", dg.includes("run.manifest.unlocked = PALETTE.map((p) => p.key)"));
ok("sandbox: the reroll button exists", dg.includes("data-dev-reroll"));

{ // mk2.25: the enemy rack
  const dg2 = src("src/depot/DepotGame.jsx");
  ok("rack: the foe list exists", dg2.includes("FOE_RACK"));
  ok("rack: the branch is dev-only", dg2.match(/TREE_BRANCHES[\s\S]{0,400}foes/) || dg2.includes('branch === "foes"'));
  ok("rack: a ground tap spawns", dg2.includes("devSpawnAt"));
  ok("rack: every infantry tag is racked", ["rocket", "gren", "sapper", "mortar", "sniper", "mg", "eng", "medic", "mechanic", "davy", "tank"].every((t) => dg2.match(new RegExp("FOE_RACK[\\s\\S]{0,2400}tag: \"" + t + "\""))));
}

{ // mk2.26: the fight switch — the one headless seam is stepTowers' world
  // flag; the rest are wiring pins. The switch's own reads (devDummies,
  // stepEnemies, uprightMember, the tower guard) live inside stepDepot/
  // stepTowers, moved to sim.js (war-engine-extraction task 1); only the
  // button itself stays in DepotGame.jsx.
  const { makeField, makeWorld, addBody } = await import("../../src/engine/core.js");
  const { stepTowers } = await import("../../src/depot/sim.js").catch(() => ({}));
  const dg3 = src("src/depot/DepotGame.jsx");
  const sim3 = src("src/depot/sim.js");
  ok("fight: the switch exists", dg3.includes("data-dev-fight"));
  ok("fight: dummies skip the enemy drivers", sim3.includes("if (!input.devDummies) stepEnemies"));
  ok("fight: standing dummies still upright", sim3.match(/devDummies[\s\S]{0,400}uprightMember/));
  ok("fight: enemy towers read the flag", sim3.includes("world._devDummies && b.team === 2"));
  ok("fight: the flag is stamped each tick", sim3.includes("world._devDummies = "));
}
