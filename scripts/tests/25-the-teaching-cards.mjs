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
ok("T1: the teaching table stands, empty until Task 2", TEACH && typeof TEACH === "object" && Object.keys(TEACH).length === 0);
ok("T1: cardFor reads teaching cards after market cards", /TEACH\[key\] \|\| CARDS\[key\] \|\| null/.test(src("src/depot/cards.js")));
ok("T1: an unknown door falls to CLOSE (the teach door needs no code)",
  /data-info-close/.test(src("src/depot/InfoCard.jsx")));
