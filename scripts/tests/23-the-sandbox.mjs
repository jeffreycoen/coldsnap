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

ok("sandbox: the war screen takes the dev switch", dg.includes("dev = false"));
ok("sandbox: the app routes the sandbox screen", app.includes('"devsandbox"') && app.includes("<DepotGame dev"));
ok("sandbox: a reload never resumes into it", !app.match(/RESUME_SCREENS = new Set\(\[[^\]]*devsandbox/));
ok("sandbox: the menu has the door", start.includes('data-menu="devsandbox"'));
ok("sandbox: prices are free on the bench", dg.includes("dev ? 0 :"));
ok("sandbox: the pace gate opens", dg.match(/buyPaced = \(\) => \{\s*\n\s*if \(dev\) return true;/));
ok("sandbox: the bell never rings", dg.includes("if (!dev && stepBell(S, world.t))"));
ok("sandbox: the save is never written", dg.match(/const saveFront = \(\) => \{\s*\n\s*if \(dev\) return;/));
ok("sandbox: the war never ends on the bench", dg.includes("if (!dev) stepDepotCensus"));
ok("sandbox: everything is unlocked", dg.includes("S.manifest.unlocked = PALETTE.map((p) => p.key)"));
ok("sandbox: the reroll button exists", dg.includes("data-dev-reroll"));
