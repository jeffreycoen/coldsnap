// COLDSNAP suite era 25 — THE TEACHING CARDS (mk2.39-). Task 1: the
// registry. cards.js is the one home; infocards.js is a re-export shim so
// the older eras' import path stands. No seed is special; no seed is used.
import { ok } from "./harness.mjs";
import { readFileSync, existsSync } from "node:fs";
import { CARDS, cardFor, TEACH } from "../../src/depot/cards.js";
import { CARDS as CARDS_SHIM, cardFor as cardFor_shim } from "../../src/depot/infocards.js";

const src = (p) => readFileSync(new URL("../../" + p, import.meta.url), "utf8");

ok("T1: the registry holds the nineteen market cards", Object.keys(CARDS).length === 19);
ok("T1: the shim serves the identical object", CARDS === CARDS_SHIM && cardFor === cardFor_shim);
ok("T1: the shim is one re-export and nothing else",
  /^export \{ CARDS, cardFor, TEACH \} from "\.\/cards\.js";\s*$/m.test(src("src/depot/infocards.js").replace(/^\/\/.*$/gm, "").trim()));
ok("T2: the teaching table holds the twenty-eight", Object.keys(TEACH).length === 28);
ok("T2: every teaching card carries the card contract",
  Object.values(TEACH).every((c) => typeof c.label === "string" && c.label.length > 0 && typeof c.role === "string" && c.role.length > 0 && Array.isArray(c.skills)));
ok("T2: the phone-voiced cards carry both voices",
  ["possess_squad", "possess_tower", "possess_vehicle", "possess_mech"].every((k) => TEACH[k] && typeof TEACH[k].roleTouch === "string" && TEACH[k].roleTouch.length > 0));
ok("T2: no teaching key shadows a market key", Object.keys(TEACH).every((k) => !CARDS[k]));
ok("T2: the desktop-keys card is marked desktop-only", TEACH.desktop_keys && TEACH.desktop_keys.desktopOnly === true);
ok("T1: cardFor reads teaching cards after market cards", /TEACH\[key\] \|\| CARDS\[key\] \|\| null/.test(src("src/depot/cards.js")));
ok("T1: an unknown door falls to CLOSE (the teach door needs no code)",
  /data-info-close/.test(src("src/depot/InfoCard.jsx")));

// ---- Task 3 (mk2.41): THE FIRST-ENCOUNTER DOOR
{
  const dg = src("src/depot/DepotGame.jsx");
  ok("T3: cards.js stamps the revision (re-taught T4: rev 2, the brief copy)", /export const TEACH_REV = 2;/.test(src("src/depot/cards.js")));
  ok("T3: the seen store has its own key", /const CARDS_KEY = "coldsnap-wf-cards";/.test(dg));
  ok("T3: a card up freezes the sim (the convoy idiom)", /const teachUp = S\._teachQ\.length > 0;/.test(dg) && /cardUp \|\| convoyUp \|\| teachUp \? 0 :/.test(dg));
  ok("T3: firing is sandbox-silent, seen-gated, and honors the silence sentinel",
    /S\.teachFire = \(key\) => \{\n\s+if \(dev\) return;/.test(dg) && /S\._teachSeen\.has\("\*"\)/.test(dg));
  ok("T3: closing marks seen and persists the set", /S\._teachSeen\.add\(k\);[\s\S]{0,220}window\.storage\.set\(CARDS_KEY/.test(dg));
  ok("T3: the phone voice serves on touch", /isTouch && tc\.roleTouch \? tc\.roleTouch : tc\.role/.test(dg));
  ok("T3/T4: the pie enqueues its whole series", /for \(const k of PIE_CARDS\[kind\]\(thing\)\) S\.teachFire\(k\);/.test(dg));
  ok("T3: the smoke silences the door with the sentinel", /coldsnap-wf-cards/.test(src("scripts/smoke.mjs")));
}

// ---- Task 4 (mk2.42): THE PAGED SERIES AND THE BRIEF COPY
{
  const dg = src("src/depot/DepotGame.jsx");
  const ic = src("src/depot/InfoCard.jsx");
  ok("T4: the card carries the teach door's paging chrome",
    /door === "teach"/.test(ic) && /data-teach-next/.test(ic) && /data-teach-back/.test(ic) && /data-teach-skip/.test(ic));
  ok("T4: the queue pages by index", /_teachIdx/.test(dg) && /S\.teachBack = /.test(dg) && /S\.teachSkip = /.test(dg));
  ok("T4: the sentinel survives any revision", /d\.rev === TEACH_REV \|\| d\.seen\.includes\("\*"\)/.test(dg));
  ok("T4: every body is brief", Object.values(TEACH).every((c) => c.role.length <= 180 && (!c.roleTouch || c.roleTouch.length <= 180)));
}

// ---- Task 5 (mk2.43): THE MANUAL RETIRES; THE DOORS GO QUIET
{
  const dg = src("src/depot/DepotGame.jsx");
  const ss = src("src/ui/StartScreen.jsx");
  ok("T5: the manual is gone from the tree", !existsSync(new URL("../../src/ui/FieldManual.jsx", import.meta.url)));
  ok("T5: the game forgot the manual", !/FieldManual/.test(dg) && !/MANUAL_KEY/.test(dg) && !/manualOpen/.test(dg));
  ok("T5: the front door is quiet", !/muster bell rings/.test(ss) && !/A winter war in real stone/.test(ss) && !/The save burns/.test(ss));
  ok("T5: the overlay is buttons and the seed line", !/They are coming for your depot/.test(dg) && !/The convoy deals seven cards/.test(dg) && /FIELD ORDER #/.test(dg));
}

// ---- Task 6 (mk2.44): THE ON-DEMAND DOOR
{
  const dg = src("src/depot/DepotGame.jsx");
  ok("T6: the long-press helper exists and swallows the trailing click",
    /const teachPress = \(k\) => \(\{/.test(dg) && /onClickCapture/.test(dg) && /450/.test(dg));
  ok("T6: the top bar and build bar carry their cards",
    ["scrap", "bell", "kill_price", "fog", "wind", "spare_ours", "market", "sell"].every((k) => dg.includes('teachPress("' + k + '")')));
  ok("T6: the wedges carry their cards",
    /card: "possess_squad"/.test(dg) && /card: "engineer_lines"/.test(dg) && /card: "sapper_lines"/.test(dg) && /card: "discipline"/.test(dg) && /card: "escort"/.test(dg) && /card: "load"/.test(dg) && /vr\.kind === "mech" \? "possess_mech" : "possess_vehicle"/.test(dg));
  ok("T6: the wedge opens its card by press or ⓘ", /data-wedge-info/.test(dg) && /press\(s\.card\)/.test(dg));
  ok("T6: the lookup serves the phone voice and skips the portrait on teaching cards",
    /c\.roleTouch \? \{ \.\.\.c, role: c\.roleTouch \}/.test(dg) && /TEACH\[hud\.info\.key\] \? undefined :/.test(dg));
}

// ---- Task 7 (mk2.45): THE MENU MAP
{
  const ss = src("src/ui/StartScreen.jsx");
  const app = src("src/ui/App.jsx");
  const dg = src("src/depot/DepotGame.jsx");
  ok("T7: the menu draws the valley", /data-menu-map/.test(ss) && /makeMap\(seed\)/.test(ss) && /return MAP_SEED;/.test(ss));
  ok("T7: the burn arm previews the fresh valley", /if \(burnArmed\) paint\(newSeedRef\.current\);/.test(ss));
  ok("T7: the shell hands the menu's seed to the war", /setDepotSeed/.test(app) && /seed=\{depotSeed\}/.test(app));
  ok("T7: the war takes the menu's seed, URL still winning", /menuSeedRef\.current != null \? menuSeedRef\.current/.test(dg) && /Number\.isFinite\(urlSeed\) \? urlSeed/.test(dg));
  ok("T7: the smoke pins the one menu canvas", /data-menu-map/.test(src("scripts/smoke.mjs")));
}

// ---- Task 8 (mk2.46): THE MENU MAP WEARS THE REAL LOOK
{
  const ss = src("src/ui/StartScreen.jsx");
  ok("T8: the menu builds the war's own ground", /makeField\(181, 2\.0, MAP_SEED\)/.test(ss) && /buildDepotTerrain\(field, MAP_SEED\)/.test(ss));
  ok("T8: the trees are the war's own plan", /planTrees\(\)/.test(ss));
  ok("T8: the snow is shaded like the renderer's", /1 - Math\.min\(0\.45, g2 \* 0\.9\)/.test(ss));
  ok("T8: the column sits on its own glass", /rgba\(10,13,18,0\.78\)/.test(ss));
}
