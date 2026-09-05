// COLDSNAP suite era 25 — THE TEACHING CARDS (mk2.39-). Task 1: the
// registry. cards.js is the one home; infocards.js is a re-export shim so
// the older eras' import path stands. No seed is special; no seed is used.
import { ok } from "./harness.mjs";
import { existsSync } from "node:fs";
import { CARDS, cardFor, TEACH } from "../../src/depot/cards.js";
import { CARDS as CARDS_SHIM, cardFor as cardFor_shim } from "../../src/depot/infocards.js";

ok("T1: the registry holds the twenty market cards", Object.keys(CARDS).length === 20);
ok("T1: the shim serves the identical object", CARDS === CARDS_SHIM && cardFor === cardFor_shim);
ok("T2: the teaching table holds the thirty", Object.keys(TEACH).length === 30); // mk2.91: queue_chain and clear_chain joined
ok("T2: every teaching card carries the card contract",
  Object.values(TEACH).every((c) => typeof c.label === "string" && c.label.length > 0 && typeof c.role === "string" && c.role.length > 0 && Array.isArray(c.skills)));
ok("T2: the phone-voiced cards carry both voices",
  ["possess_squad", "possess_tower", "possess_vehicle", "possess_mech"].every((k) => TEACH[k] && typeof TEACH[k].roleTouch === "string" && TEACH[k].roleTouch.length > 0));
ok("T2: no teaching key shadows a market key", Object.keys(TEACH).every((k) => !CARDS[k]));
ok("T2: the desktop-keys card is marked desktop-only", TEACH.desktop_keys && TEACH.desktop_keys.desktopOnly === true);

// ---- Task 4 (mk2.42): THE PAGED SERIES AND THE BRIEF COPY
{
  ok("T4: every body is brief", Object.values(TEACH).every((c) => c.role.length <= 180 && (!c.roleTouch || c.roleTouch.length <= 180)));
}

// ---- Task 5 (mk2.43): THE MANUAL RETIRES; THE DOORS GO QUIET
{
  ok("T5: the manual is gone from the tree", !existsSync(new URL("../../src/ui/FieldManual.jsx", import.meta.url)));
}

// ---- Task 10 (mk2.48): THE WALK
{
  const WALK_KEYS = ["desktop_keys", "the_hand", "placing", "scrap", "bell", "convoy", "market", "sell", "defend", "move", "attack", "patrol", "engineer_lines", "structures", "select_all", "fog"];
  ok("T10w: every walked card carries its hint", WALK_KEYS.every((k) => typeof TEACH[k].hint === "string" && TEACH[k].hint.length > 0));
}
