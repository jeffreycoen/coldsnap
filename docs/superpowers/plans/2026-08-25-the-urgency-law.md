# THE URGENCY LAW — enemy infantry prefer men at full range (mk2.51)

Owner's defect report, 2026-08-25: enemy troops don't fire on his units, and it has been that way. The probe (`.superpowers/probe-enemy-fire.mjs`, seed 11, 120s of seeded war) measured the gates: of every in-range encounter between an enemy shooter and a player man, **62% were refused by the 60% urgency radius** (`URGENCY = 0.6`, units.js:136); sight vetoed 13%, the flight path ~1%. The enemy sees the man, has the shot, and chooses stone instead — by one constant.

The fix is symmetry: the player's own squads prefer a MAN anywhere in weapon range (squadFire's unit scan runs first; structures only on an empty scan — state.js:634-641), and the enemy's snipers already run at full radius. One law, both sides: the enemy's urgency rises to the full effective range.

**Suggested model: Sonnet** — one constant, one comment, one new test era, all specified verbatim.

## Facts this plan is built on (verified at plan time)

- `URGENCY = 0.6` at `units.js:136`; consumed at `units.js:267` (riflemen — snipers already pass 1) and `units.js:380` (grenadiers/mortar teams).
- `nearestPlayerUnit` (units.js:108-119) takes the radius as a parameter; no other caller exists.
- No test pins the 0.6 by value or by source regex — the only reference is a stale COMMENT in `scripts/tests/07-armor-demolition.mjs:262-264`, whose fixture stands a man at 6m (inside either radius) and stays green.
- The player-side law this mirrors: `squadFire` scans units first at full range, structures only when no man is found.
- Known behavior consequence, stated for the owner's eyes: enemy riflemen/grenadiers will now halt and fight your men at full weapon range instead of walking to your walls first — the assault reads more dangerous to infantry, less single-minded about masonry. This is the requested change.

## Required reading (read-confirmation opens the report)

1. This plan.
2. `src/depot/units.js` lines 100-140 and 260-285 and 370-385.
3. `scripts/tests/07-armor-demolition.mjs` lines 245-270 (the fixture that must stay green).
4. `scripts/depot-test.mjs` (all — 31 lines).

## Steps

### Step 1 — failing asserts first: new era file `scripts/tests/27-the-urgency-law.mjs`

```js
// COLDSNAP suite era 27 — THE URGENCY LAW (mk2.51). A man in weapon range
// outranks masonry at FULL range, both sides — the enemy's 60% radius is
// dead (probe-measured: it refused 62% of in-range shots at player men).
// No seed is special; fixture seeds are named below.
import { ok } from "./harness.mjs";
import { readFileSync } from "node:fs";
import { makeWorld, stepWorld, addBody } from "../../src/engine/core.js";
import { spawnUnit, stepUnits } from "../../src/depot/units.js";
import { identFwdDir, straightGrid } from "./shared.mjs";

const src = (p) => readFileSync(new URL("../../" + p, import.meta.url), "utf8");

ok("U1: the urgency radius is the whole effective range",
  /const URGENCY = 1;/.test(src("src/depot/units.js")) && !/const URGENCY = 0\.6;/.test(src("src/depot/units.js")));

// U2 — behavior: a held enemy rifleman engages a player man at 11m — inside
// his 13m rifle range, OUTSIDE the old 7.8m radius that silenced him.
// (07-armor-demolition's own T3(e) fixture shape, the man moved out to 11m.)
{
  const flatF = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (x, z, o) => { o.x = 0; o.y = 1; o.z = 0; return o; } };
  const w = makeWorld({ field: flatF, seed: 271 }); w.depotCombat = true;
  const g = spawnUnit(w, { x: 0, z: 0 }, "");
  g.hold = true; g.garrison = true;
  addBody(w, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x: g.pos.x, y: 0.74, z: g.pos.z + 11, hp: 5000 });
  for (let i = 0; i < 2400; i++) { stepUnits(w, straightGrid(0, 1), identFwdDir, null); stepWorld(w); }
  ok("U2: a rifleman works his rifle at 11m (seed 271) — the old radius left him silent",
    w.events.filter((ev) => ev.type === "muzzle").length > 0);
}
```

Register it in `scripts/depot-test.mjs`: after the era-26 import, before `finish();`, add:

```js
await import("./tests/27-the-urgency-law.mjs");
```

Run `node scripts/gate.mjs depot-test` — both new checks FAIL. Record the PASS count (current baseline 1966 + task-2 era additions as logged).

### Step 2 — `src/depot/units.js`: the one constant

Replace lines 133-136 (the comment and the constant) with:

```js
// mk2.51 (owner): THE URGENCY LAW — a man in weapon range outranks any
// structure at FULL effective range, the player's own squadFire law
// mirrored (units first, structures on an empty scan). The old 0.6 radius
// refused 62% of the enemy's real in-range shots at player men (the
// probe's measurement); snipers always ran at 1, and now everyone does.
const URGENCY = 1;
```

No other edit: `units.js:267` (`sniper ? 1 : URGENCY`) and `units.js:380` now resolve identically to the sniper's own full radius, and `nearestPlayerUnit`'s signature stands.

Also update the stale comment at `scripts/tests/07-armor-demolition.mjs:262-264` — replace the three comment lines with:

```js
    // re-pinned mk2.51: the urgency radius is the whole effective range
    // now (THE URGENCY LAW); 6m keeps the fixture well inside it either way.
```

### Step 3 — gates

- `node scripts/gate.mjs depot-test` — green; ledger: 2 new era-27 checks, 0 re-teaches (the 07 edit is comment-only).
- `node scripts/gate.mjs depot-lint` — green (no rng touched).
- `node scripts/gate.mjs smoke` — green (no UI moved; the smoke's scripted war tolerates combat pacing — any smoke failure is UNLISTED and stops the task).

### Step 4 — the deploy

Bump `src/version.js` to `mk2.51`. Build AFTER the bump; commit ("the urgency law — a man in range outranks masonry, both sides, mk2.51"); push. The owner's live check — enemy infantry actually shooting his men at rifle range — is the acceptance.

## Report

Read-confirmation, one line of outcome, PASS counts before/after, gates and verdicts, commit hash, shipped mark, seeds (era-27 fixture seed 271; smoke's pinned 11). Every nonconformity its own labeled bullet.

## Out of scope, held for design

- The armor-vs-armor sandbox hold (headless gates all pass; live-mount anomaly unreproduced — its own diagnosis).
- The enemy's income-following muster budget (`bellBudget` still the fixed curve) — design questions to serve when the owner is ready.
