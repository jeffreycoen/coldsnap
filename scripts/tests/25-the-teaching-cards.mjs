// COLDSNAP suite era 25 — THE TEACHING CARDS (mk2.39-). Task 1: the
// registry. cards.js is the one home; infocards.js is a re-export shim so
// the older eras' import path stands. No seed is special; no seed is used.
import { ok } from "./harness.mjs";
import { readFileSync } from "node:fs";
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
  ok("T3: cards.js stamps the revision", /export const TEACH_REV = 1;/.test(src("src/depot/cards.js")));
  ok("T3: the seen store has its own key", /const CARDS_KEY = "coldsnap-wf-cards";/.test(dg));
  ok("T3: a card up freezes the sim (the convoy idiom)", /const teachUp = S\._teachQ\.length > 0;/.test(dg) && /cardUp \|\| convoyUp \|\| teachUp \? 0 :/.test(dg));
  ok("T3: firing is sandbox-silent, seen-gated, and honors the silence sentinel",
    /S\.teachFire = \(key\) => \{\n\s+if \(dev\) return;/.test(dg) && /S\._teachSeen\.has\("\*"\)/.test(dg));
  ok("T3: closing marks seen and persists the set", /S\._teachSeen\.add\(k\);[\s\S]{0,220}window\.storage\.set\(CARDS_KEY/.test(dg));
  ok("T3: the phone voice serves on touch", /isTouch && tc\.roleTouch \? tc\.roleTouch : tc\.role/.test(dg));
  ok("T3: the pie teaches one card per open", /S\.teachPie = \(kind, thing\) => \{/.test(dg) && /PIE_CARDS/.test(dg));
  ok("T3: the smoke silences the door with the sentinel", /coldsnap-wf-cards/.test(src("scripts/smoke.mjs")));
}
