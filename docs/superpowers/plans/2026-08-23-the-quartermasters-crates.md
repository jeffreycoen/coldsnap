# The Quartermaster's Crates — the complete plan

Four tasks, dispatched one at a time, each its own deploy: mk2.27 the names, mk2.28 the crate desk, mk2.29 the convoy crate, mk2.30 the draft deal. Design rulings are the owner's, this session (2026-08-23), recorded here — there is no separate design file.

**The rulings (owner, 2026-08-23):**

- The build menus become the quartermaster's stores: drawn wireframe crates in the game's dot-matrix line style. A crate's lid swings open and its stock deals out in a fan; closing swallows it back.
- Every menu gets the treatment: the build bar, the convoy hand, the opening draft, the sandbox enemy rack.
- The names: towers wear proper nouns — SPITTER (mg), FIELD GUN (gun), MORTAR (mortar), SALVO RACK (rocket), TESLA COIL (tesla). Troops: GUNNERS (the mg team), ROCKET TEAM (already so in squads.js; the bar's ROCKETS follows), MARKSMEN (the sniper squad). Every other name stands.
- New-player help: one short quartermaster purpose line per crate, first war only, then quiet. Manual and draft copy untouched beyond what the crate screens themselves carry.

**The laws every task lives under:** presentation only — `S.mode`, every handler, every price read, and every draw stay untouched underneath. Internal keys never move (`mg`, `rocket`, `sq_mg`, save-resident or not — keys are wiring, labels are paint). Every screen ships phone AND desktop — one DOM, by construction, and each task names both. Symmetry: labels and looks are shared tables both sides already read; nothing here gives either side a capability.

---

## Task 1 — the names (mk2.27)

**Suggested model: Sonnet 5** — literal label edits, fully written below; nothing is designed at dispatch.

**Required reading:** this task's section in full; `src/depot/specs.js:34-95` (TOWER_SPECS and ENEMY_SPECS labels); `src/depot/squads.js:33-70` (SQUAD_SPECS labels); `src/depot/DepotGame.jsx:756-815` (PALETTE and FOE_RACK); `src/depot/infocards.js` whole (labels derive — proof no edit is needed); `scripts/tests/03-bell-polish.mjs:465-470`, `scripts/tests/11-hiring-hall.mjs:548-554, 655-661` (the three label pins that must NOT move); `scripts/tests/22-the-tesla-coil.mjs` head (the era-file idiom). The agent's report opens by confirming each was read.

### Step 1 — the failing asserts

A new suite era file. Spec labels import headless; the PALETTE and FOE_RACK labels are source pins (JSX). No seed is used; no world is built.

Create `scripts/tests/24-the-quartermaster.mjs`:

```js
// COLDSNAP suite era 24 — THE QUARTERMASTER'S CRATES (mk2.27-mk2.30).
// mk2.27: the names — towers wear proper nouns, the colliding trades
// re-sign, and no two labels on the stock list read the same. No seed is
// special; no seed is used.
import { ok } from "./harness.mjs";
import { readFileSync } from "node:fs";
import { TOWER_SPECS, ENEMY_SPECS } from "../../src/depot/specs.js";
import { SQUAD_SPECS } from "../../src/depot/squads.js";

const src = (p) => readFileSync(new URL("../../" + p, import.meta.url), "utf8");
const dg = src("src/depot/DepotGame.jsx");

ok("names: the five towers wear proper nouns",
  TOWER_SPECS.mg.label === "SPITTER" && TOWER_SPECS.gun.label === "FIELD GUN" &&
  TOWER_SPECS.mortar.label === "MORTAR" && TOWER_SPECS.rocket.label === "SALVO RACK" &&
  TOWER_SPECS.tesla.label === "TESLA COIL");
ok("names: the colliding trades re-sign", SQUAD_SPECS.mg.label === "GUNNERS" && SQUAD_SPECS.sniper.label === "MARKSMEN");
ok("names: his mg men match the trade", ENEMY_SPECS.mg.label === "gunners");
ok("names: the bar follows the trades",
  dg.includes('key: "sq_mg", label: "GUNNERS"') && dg.includes('key: "sq_sniper", label: "MARKSMEN"') &&
  dg.includes('key: "sq_rockets", label: "ROCKET TEAM"'));
ok("names: the enemy rack follows",
  dg.includes('key: "foe_t_mg", label: "SPITTER"') && dg.includes('key: "foe_t_rocket", label: "SALVO RACK"') &&
  dg.includes('key: "foe_mg", label: "GUNNERS"') && dg.includes('key: "foe_rocket", label: "ROCKET TEAM"'));
{
  const all = [...Object.values(TOWER_SPECS).map((s) => s.label), ...Object.values(SQUAD_SPECS).map((s) => s.label)];
  ok("names: no two labels on the stock list collide", new Set(all).size === all.length, all.join("|"));
}
```

Register it: in `scripts/depot-test.mjs`, after the era-23 import, add `await import("./tests/24-the-quartermaster.mjs");` (an AWAITED dynamic import — the standing law). Run `node scripts/gate.mjs depot-test` — the new file must FAIL before Step 2. Report the failure.

### Step 2 — specs.js

`src/depot/specs.js:38-42` — five label tokens only, nothing else on any line: `label: "MG"` → `label: "SPITTER"`; `label: "GUN"` → `label: "FIELD GUN"`; `label: "MORTAR"` stays; `label: "ROCKET"` → `label: "SALVO RACK"`; `label: "TESLA"` → `label: "TESLA COIL"`.

`src/depot/specs.js:77` — `label: "mg team"` → `label: "gunners"`.

### Step 3 — squads.js

`src/depot/squads.js:38` — `label: "SNIPER"` → `label: "MARKSMEN"`. `src/depot/squads.js:40` — `label: "MG TEAM"` → `label: "GUNNERS"`.

### Step 4 — DepotGame.jsx

PALETTE (:756-784): `sq_sniper` label `"SNIPER"` → `"MARKSMEN"`; `sq_mg` label `"MG TEAM"` → `"GUNNERS"`; `sq_rockets` label `"ROCKETS"` → `"ROCKET TEAM"`. The tower rows read TOWER_SPECS and follow Step 2 by construction.

FOE_RACK (:793-814): `foe_rocket` label `"ROCKETS"` → `"ROCKET TEAM"`; `foe_mg` label `"MG TEAM"` → `"GUNNERS"`; `foe_t_mg` label `"MG TOWER"` → `"SPITTER"`; `foe_t_gun` label `"GUN TOWER"` → `"FIELD GUN"`; `foe_t_mortar` label `"MORTAR TOWER"` → `"MORTAR"`; `foe_t_rocket` label `"ROCKET TOWER"` → `"SALVO RACK"`; `foe_t_tesla` label `"TESLA TOWER"` → `"TESLA COIL"`. `foe_sniper` "MARKSMAN PAIR", `foe_mortar` "MORTARS", and every other row stand.

The info cards (`src/depot/infocards.js`) read `s.label` from the live tables — no edit, verified in reading.

### Step 5 — gates and the landing

- `node scripts/gate.mjs depot-test` — era 24 green; the three standing label pins (ENGINEERS at 03:468, MEDICS at 11:551, MECHANICS at 11:658) never move; any other movement stops the task.
- `node scripts/gate.mjs depot-lint` — clean.
- `node scripts/gate.mjs smoke` — green.
- Bump `src/version.js` to `mk2.27`, THEN build. Green → commit → push. The owner's live check: the bar, the pies' possession labels, the info cards, the inspect card, and the sandbox rack all speak the new names — phone and desktop.

---

## Task 2 — the crate desk (mk2.28)

**Suggested model: Sonnet 5** — a new presentational file and a bar re-skin, every block written below.

**Required reading:** this task's section in full; `src/depot/DepotGame.jsx:672-700` (the P styles), `:756-815` (PALETTE, FOE_RACK), `:859-866` (TREE_BRANCHES, branchOf), `:900-925` (the manual-open effect and MANUAL_KEY — the storage idiom the quiet flag copies), `:4825-4900` (the whole bar block: BUILD, branches, slots, SELL, the rack), `:4374-4430` (the top bar, for the hud wiring neighborhood); `src/depot/Crate.jsx` does not exist yet; `scripts/tests/23-the-sandbox.mjs` (pins that must survive: `data-dev-reroll`, the rack pins); `scripts/tests/24-the-quartermaster.mjs` as landed by Task 1. Read-confirmation opens the report.

The bar's machinery is untouched: `buildOpen`/`branch` state, `setMode`, `closeBuild`, `toggleSell`, `devSpawn` arming, every `data-` attribute, and the can't-afford dimming all stay. What changes is the skin and the motion: branch chips become drawn crates whose lids swing, and the slots deal out of the open crate as stenciled tags. The `cs-unfurl` keyframe dies; `cs-deal` replaces it. THE DEAL uses `backwards` fill, never `both` — a `both` fill would pin the keyframe's final opacity and erase the can't-afford dimming (0.45) after the animation ends (the mk1.67 law, carried forward). All timing dials provisional (F5).

### Step 1 — the failing asserts

Append to `scripts/tests/24-the-quartermaster.mjs`:

```js
{ // mk2.28: the crate desk — wiring pins (the component cannot run headless)
  const dg2 = src("src/depot/DepotGame.jsx");
  const cr = src("src/depot/Crate.jsx");
  ok("crates: the crate file exists and draws a hinged lid", cr.includes("CrateChip") && cr.includes("transformOrigin"));
  ok("crates: the deal keyframe replaced the unfurl", dg2.includes("cs-deal") && !dg2.includes("cs-unfurl"));
  ok("crates: the deal never pins its final frame", !dg2.match(/cs-deal[^"]*both/));
  ok("crates: the branches are crates", dg2.includes("<CrateChip") && dg2.includes('import CrateChip'));
  ok("crates: the bar's doors survived", dg2.includes("data-build-toggle") && dg2.includes("data-sell-toggle") && dg2.includes("data-tower-key") && dg2.includes("data-foe-key") && dg2.includes("data-dev-reroll"));
  ok("crates: the quartermaster lines exist and go quiet", dg2.includes("QM_KEY") && dg2.includes("qmQuiet"));
}
```

Run `node scripts/gate.mjs depot-test` — the block must FAIL before Step 2.

### Step 2 — the crate component

Create `src/depot/Crate.jsx`:

```jsx
// COLDSNAP DEPOT — Crate.jsx (mk2.28): THE QUARTERMASTER'S CRATE. A drawn
// wireframe crate in the dot-matrix line voice — slat lines, a hinged lid
// that swings open in 180ms. Pure presentation: no state, no handlers of
// its own; every behavior rides the props. One DOM, phone and desktop.
import React from "react";

export default function CrateChip({ label, icon, count, open, line, active, style, ...rest }) {
  const col = active ? "#9fdcff" : "#e6ebf1";
  return (
    <div {...rest} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
      minWidth: 64, minHeight: 52, padding: "6px 10px 8px", background: "#1a212b",
      border: "1px solid " + (active ? "#9fdcff" : "#48515f"), borderRadius: 8,
      fontSize: 12, cursor: "pointer", color: col, ...style }}>
      <svg width="34" height="26" viewBox="0 0 34 26" style={{ display: "block", overflow: "visible" }}>
        <g stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round">
          <rect x="3" y="8" width="28" height="15" rx="1" />
          <line x1="3" y1="13" x2="31" y2="13" opacity="0.5" />
          <line x1="11" y1="8" x2="11" y2="23" opacity="0.35" />
          <line x1="23" y1="8" x2="23" y2="23" opacity="0.35" />
          <g style={{ transformOrigin: "3px 8px", transform: open ? "rotate(-72deg)" : "none", transition: "transform 0.18s ease-out" }}>
            <rect x="3" y="4" width="28" height="4" rx="1" />
          </g>
        </g>
        <text x="17" y="20" textAnchor="middle" fontSize="8" fill="currentColor" opacity="0.85">{icon}</text>
      </svg>
      <div style={{ letterSpacing: 1 }}>{label}</div>
      <div style={{ fontSize: 9, opacity: 0.6, minHeight: 11 }}>{line || count}</div>
    </div>
  );
}
```

### Step 3 — the quiet flag

The purpose lines speak in the first war and go quiet for good once the first bell has rung. Beside the MANUAL_KEY block (`src/depot/DepotGame.jsx:900-925`), following its exact storage idiom:

- A module-scope const beside MANUAL_KEY: `const QM_KEY = "coldsnap-qm-quiet";`
- Component state beside `manualOpen`: `const [qmQuiet, setQmQuiet] = useState(true);` — quiet by default; the probe opens it only for a first-timer.
- In the same mount effect that probes MANUAL_KEY, probe QM_KEY the same way: absent → `setQmQuiet(false)`.
- A small effect: when `hud.bell >= 1 && !qmQuiet` → `try { window.storage.set(QM_KEY, "1"); } catch (e) {}` and `setQmQuiet(true)`.

The lines themselves, a module const beside TREE_BRANCHES:

```js
// mk2.28 (owner): the quartermaster's purpose lines — first war only.
const QM_LINES = { troops: "men you order", buildings: "iron that stands", vehicles: "iron that moves", foes: "targets for the bench" };
```

### Step 4 — the desk and the deal

`src/depot/DepotGame.jsx:4833` — the keyframes tag inside the bar div becomes:

```jsx
          <style>{`@keyframes cs-deal { from { opacity: 0; transform: translate(-14px, 10px) rotate(var(--dealR, -4deg)) scale(0.88); } to { opacity: 1; transform: none; } }`}</style>
```

The BUILD button (:4835-4847, `data-build-toggle`) keeps its handler and labels; its icon line `<div style={{ fontSize: 16 }}>⚒</div>` is replaced by a closed `CrateChip`-style stack — exact form: the whole button becomes a `CrateChip` with `data-build-toggle`, `label={buildOpen ? "CLOSE" : "BUILD"}`, `icon="⚒"`, `open={buildOpen}`, `active={buildOpen}`, the same `onClick`, and `line={!buildOpen && hud.mode ? (PALETTE_LABEL[hud.mode] || "") : ""}` (the armed-type line survives as the crate's sub-line). Import: `import CrateChip from "./Crate.jsx";` beside the InfoCard import.

The branch chips (:4849-4857): each becomes a `CrateChip` — `data-branch={b.key}`, `label={b.label}`, `icon={b.icon}`, `open={branch === b.key}`, `active={branch === b.key}`, `count` = the existing count expression, `line={!qmQuiet ? QM_LINES[b.key] : null}`, same `onClick`, and the deal motion on the chip itself: `style={{ animation: "cs-deal 0.14s ease-out backwards", animationDelay: (TREE_BRANCHES.indexOf(b) * 0.04) + "s" }}` (the sandbox's foes chip uses index 3's delay).

The slots (:4872-4888) and SELL (:4889-4894) and the rack slots (:4858-4871): each keeps its whole DOM and handlers; only the animation tokens change — `"cs-unfurl 0.14s ease-out backwards"` → `"cs-deal 0.16s ease-out backwards"`, delays become `(0.10 + pi * 0.04) + "s"`, and each slot's style gains the fan's alternating tilt: `"--dealR": (pi % 2 ? "3deg" : "-4deg")` (SELL and the rack use their map index the same way; SELL's fixed delay stays `"0.09s"` with `"--dealR": "3deg"`). Slots also take the tag look: `borderRadius: 3, letterSpacing: 1` spread into their existing style objects — nothing else in them moves.

A branch switch remounts the slots under new keys (the mk1.67 construction) — the deal replays out of the newly opened crate by construction.

### Step 5 — gates and the landing

- `node scripts/gate.mjs depot-test` — era 24 grows; era 23's pins (`data-dev-reroll`, rack pins, `data-foe-key`) must not move.
- `node scripts/gate.mjs depot-lint` — clean (no rng anywhere in this task).
- `node scripts/gate.mjs smoke` — green.
- Bump `src/version.js` to `mk2.28`, THEN build. Green → commit → push. The owner's live check, phone and desktop: BUILD opens the rack, a crate's lid swings and its tags fan out, switching crates replays the deal, the purpose lines show on a fresh browser and never again after the first bell, the sandbox's THE ENEMY crate rides the same desk, and can't-afford tags still dim.

### AMENDMENT 1 (after the agent's honest stop before any edit — the defect is the plan-writer's)

Step 4 told the rack slots to swap their animation tokens, but the rack slots (`data-foe-key`, live :4859-4871) never carried an animation — mk2.25 added them bare, and only the branch chips, tower slots, and SELL carry `cs-unfurl` today. The correction, one sentence in Step 4's place: **the rack slots gain the deal FRESH, with the tower slots' exact formula** — each rack slot's style object gains `animation: "cs-deal 0.16s ease-out backwards"`, `animationDelay: (0.10 + fi * 0.04) + "s"`, and `"--dealR": (fi % 2 ? "3deg" : "-4deg")`, where `fi` is the rack map's index (rename the map parameter if it has none), plus the same tag look (`borderRadius: 3, letterSpacing: 1`). Nothing else in the rack rows moves. Everything else in Task 2 stands as written.

---

## Task 3 — the convoy crate (mk2.29)

**Suggested model: Sonnet 5.**

**Required reading:** this task's section in full; `src/depot/DepotGame.jsx:4595-4630` (the manifest card JSX and its hand rows — re-verify exact lines at dispatch; the block is found by `data-manifest-offer`); `src/depot/Crate.jsx` as landed; `scripts/tests/11-hiring-hall.mjs` T2(e6) (`data-hand-kind` pin — must survive); `scripts/tests/24-the-quartermaster.mjs` as landed. Read-confirmation opens the report.

The bell's hand becomes the quartermaster's opened crate: the card's head carries a small open `CrateChip` (icon ⚒, label THE CONVOY, `open` always true), and the five hand rows deal out of it with the `cs-deal` fan — `animationDelay` `(ci * 0.05) + "s"`, alternating `--dealR` by `ci % 2`. Every `data-manifest-offer` button keeps its whole DOM, handler, and `data-hand-kind`; only the animation style tokens and the header visual are added. The card's copy is untouched (owner-approved words stay words). The keyframes tag from Task 2 lives in the bar div — the manifest card is a different subtree, so the same one-line `<style>` keyframes tag is added inside the manifest card's root div (a duplicate @keyframes definition of the same name is legal CSS; stated so the agent does not hoist).

**Step 1 — the failing asserts.** Append to era 24:

```js
{ // mk2.29: the convoy crate
  const dg3 = src("src/depot/DepotGame.jsx");
  ok("convoy: the hand deals out of a crate", dg3.match(/data-manifest-offer[\s\S]{0,600}cs-deal/) != null);
  ok("convoy: the hand rows kept their kinds", dg3.includes('data-hand-kind={c.hire ? "hire" : "plan"}'));
}
```

Run the gate; the block must FAIL before the edit. Then the edit as stated above, then:

**Step 2 — gates and the landing.** `node scripts/gate.mjs depot-test`, `depot-lint`, `smoke`. Bump `src/version.js` to `mk2.29`, THEN build. Green → commit → push. The owner's live check, phone and desktop: the bell rings, the crate stands open at the card's head, five tags fan out; buying and hiring behave exactly as before.

---

## Task 4 — the draft deal (mk2.30)

**Suggested model: Sonnet 5.**

**Required reading:** this task's section in full; `src/depot/DepotGame.jsx:817-857` (DraftScreen whole); `src/depot/Crate.jsx` as landed; `scripts/tests/11-hiring-hall.mjs:715-720` (the draft pins — `data-draft-card`, `data-draft-confirm`, `picked.length === 5` must survive); `scripts/tests/24-the-quartermaster.mjs` as landed. Read-confirmation opens the report.

The opening draft becomes the same deal: an open `CrateChip` under the title (icon ⚒, label THE OPENING DRAFT's existing title stays — the crate sits below it, `open` always true), the seven cards fan out of it with `cs-deal` (`animationDelay` `(idx * 0.06) + "s"`, alternating `--dealR`), and a picked card's stencil goes green exactly as today (border and background logic untouched). The keyframes tag is added inside DraftScreen's root div, same one-liner. All `data-draft-*` attributes, the toggle, the five-max rule, and FIELD THESE FIVE stand byte-identical.

**Step 1 — the failing asserts.** Append to era 24:

```js
{ // mk2.30: the draft deal
  const dg4 = src("src/depot/DepotGame.jsx");
  ok("draft: the cards deal out of the crate", dg4.match(/data-draft-card[\s\S]{0,400}cs-deal/) != null || dg4.match(/cs-deal[\s\S]{0,400}data-draft-card/) != null);
  ok("draft: the pick machinery stands", dg4.includes("data-draft-confirm") && dg4.includes("picked.length === 5"));
}
```

Run the gate; the block must FAIL before the edit. Then the edit, then:

**Step 2 — gates and the landing.** `node scripts/gate.mjs depot-test`, `depot-lint`, `smoke`. Bump `src/version.js` to `mk2.30`, THEN build. Green → commit → push. The owner's live check, phone and desktop: a fresh war's seven cards fan from the crate, picking five works exactly as before.

---

## Task 2b — the desk drawn properly (mk2.30)

**The finding (owner, 2026-08-23, live check of mk2.28/mk2.29): the crate look is rejected — "looks like the old one." The defect is the plan-writer's: Tasks 2 and 3 kept the old `P.slot` box chrome and pasted a small crate glyph above the label, so the menu reads as the old boxes with stickers. This task replaces the box language on the build bar. The convoy and draft re-skins (Tasks 3b, 4) follow only after the owner's eye accepts this desk.**

**Suggested model: Sonnet 5** — the two files' new code is written below in full; nothing is designed at dispatch.

**The look, ruled here:** no panel boxes anywhere on the bar. A crate IS the button — drawn large (72×44 wireframe, dot-matrix line voice), its stencil label painted ON the crate face, lid hinged and swinging. Stock is paper: each buyable a manila stock tag — parchment fill, clipped corner, punched hole, dark stencil text — dealt from the crate in a loose hand-of-cards fan (each tag rests at a small alternating tilt, not squared to a grid). Enemy tags carry a red ENEMY stamp; the sell tag rides the same paper. Can't-afford tags dim exactly as today. Every `data-` attribute, handler, and piece of machinery is untouched.

**Required reading:** this task's section in full; `src/depot/Crate.jsx` whole (replaced here); `src/depot/DepotGame.jsx:4860-4924` (the whole bar block — replaced here; re-verify the span by its `data-build-toggle`/`data-sell-toggle` bounds at dispatch); `src/depot/DepotGame.jsx:672-700` (P — unedited, the bar keeps `P.bar` alone); `scripts/tests/23-the-sandbox.mjs` and `scripts/tests/24-the-quartermaster.mjs` (every existing pin must survive). Read-confirmation opens the report.

**The tilt-vs-animation law (stated so the agent does not fight it):** a CSS animation ending at `transform: none` erases a tag's resting tilt. The keyframe's final frame therefore ends at `var(--restT, none)`, and every tilted tag sets BOTH its own `transform` and `--restT` to the same rotate. Fill stays `backwards`, never `both` (the standing dimming law).

### Step 1 — the failing asserts

Append to `scripts/tests/24-the-quartermaster.mjs`:

```js
{ // mk2.30: the desk drawn properly — the box chrome dies on the bar
  const dg5 = src("src/depot/DepotGame.jsx");
  const cr5 = src("src/depot/Crate.jsx");
  ok("desk: the stock tag exists on paper", cr5.includes("StockTag") && cr5.includes("clipPath"));
  ok("desk: the crate paints its own label", cr5.match(/<text[\s\S]{0,200}\{label\}/) != null);
  ok("desk: the bar's slots left the box chrome", !dg5.match(/data-tower-key[\s\S]{0,200}P\.slot/) && !dg5.match(/data-sell-toggle[\s\S]{0,200}P\.slot/) && !dg5.match(/data-foe-key[\s\S]{0,200}P\.slot/));
  ok("desk: the tags rest tilted, the deal respects it", dg5.includes("--restT") && dg5.match(/cs-deal[^"]*both/) == null);
  ok("desk: every door survived", dg5.includes("data-build-toggle") && dg5.includes("data-branch") && dg5.includes("data-tower-key") && dg5.includes("data-info=") && dg5.includes("data-sell-toggle") && dg5.includes("data-foe-key"));
}
```

Run `node scripts/gate.mjs depot-test` — the block must FAIL before Step 2.

### Step 2 — Crate.jsx, replaced whole

The file's entire content becomes:

```jsx
// COLDSNAP DEPOT — Crate.jsx (mk2.28, redrawn mk2.30): THE QUARTERMASTER'S
// STORES. The crate IS the button — a large wireframe crate in the
// dot-matrix line voice, stencil label painted on its face, hinged lid.
// StockTag is the paper: a manila tag, clipped corner, punched hole, dark
// stencil text, resting at its own small tilt. Pure presentation — no
// state, no handlers of its own. One DOM, phone and desktop.
import React from "react";

export default function CrateChip({ label, icon, count, open, line, active, style, ...rest }) {
  const col = active ? "#9fdcff" : "#aeb6c2";
  return (
    <div {...rest} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0,
      padding: "2px 2px 0", background: "none", border: "none", fontSize: 11,
      cursor: "pointer", color: col, ...style }}>
      <svg width="76" height="50" viewBox="0 0 76 50" style={{ display: "block", overflow: "visible" }}>
        <g stroke="currentColor" strokeWidth="1.6" fill="rgba(14,18,24,0.85)" strokeLinecap="round">
          <rect x="4" y="14" width="68" height="34" rx="1.5" />
          <line x1="4" y1="24" x2="72" y2="24" opacity="0.4" />
          <line x1="24" y1="14" x2="24" y2="48" opacity="0.25" />
          <line x1="52" y1="14" x2="52" y2="48" opacity="0.25" />
          <g style={{ transformOrigin: "4px 14px", transform: open ? "rotate(-78deg)" : "none", transition: "transform 0.2s ease-out" }}>
            <rect x="4" y="7" width="68" height="7" rx="1.5" fill="rgba(14,18,24,0.95)" />
          </g>
        </g>
        <text x="38" y="32" textAnchor="middle" fontSize="10" letterSpacing="2" fill="currentColor" fontFamily="inherit">{label}</text>
        <text x="38" y="43" textAnchor="middle" fontSize="7.5" fill="currentColor" opacity="0.7" fontFamily="inherit">{icon}{count != null ? "  " + count : ""}</text>
      </svg>
      <div style={{ fontSize: 9, opacity: 0.65, minHeight: 11, letterSpacing: 1 }}>{line || ""}</div>
    </div>
  );
}

// The paper. tilt is the tag's resting angle (degrees); the deal keyframe
// ends at var(--restT), so the tilt survives the animation (fill stays
// backwards — the dimming law). Children paint the tag's face.
export function StockTag({ tilt = 0, delay = "0s", style, children, ...rest }) {
  return (
    <div {...rest} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1,
      minWidth: 56, minHeight: 52, padding: "10px 8px 6px", position: "relative",
      background: "#cfc6a5", color: "#1a2016", border: "1px solid #8f8768",
      clipPath: "polygon(0 9px, 9px 0, 100% 0, 100% 100%, 0 100%)",
      fontSize: 11, letterSpacing: 1, cursor: "pointer",
      transform: "rotate(" + tilt + "deg)", "--restT": "rotate(" + tilt + "deg)",
      animation: "cs-deal 0.16s ease-out backwards", animationDelay: delay,
      ...style }}>
      <span style={{ position: "absolute", top: 3, left: 11, width: 6, height: 6, borderRadius: "50%", border: "1.2px solid #8f8768", background: "rgba(14,18,24,0.45)" }} />
      {children}
    </div>
  );
}
```

### Step 3 — the bar block, replaced whole

`src/depot/DepotGame.jsx` — the import line 40 gains the tag: `import CrateChip, { StockTag } from "./Crate.jsx";`. Then the whole bar block (`:4860-4924`, from `{hud.started && ... <div style={P.bar}>` through that div's close — bounds re-verified at dispatch) is replaced by the following. Every handler body, gate, and data attribute inside it is today's verbatim; only the presentation wrapping changed:

```jsx
      {hud.started && !hud.gameOver && !hud.victory && !hud.possessed && (
        <div style={P.bar}>
          <style>{`@keyframes cs-deal { from { opacity: 0; transform: translate(-16px, 12px) rotate(-8deg) scale(0.85); } to { opacity: 1; transform: var(--restT, none); } }`}</style>
          <CrateChip data-build-toggle
            label={buildOpen ? "CLOSE" : "BUILD"} icon="⚒" open={buildOpen} active={buildOpen}
            line={!buildOpen && hud.mode ? (PALETTE_LABEL[hud.mode] || "") : ""}
            onClick={() => {
              if (buildOpen) { closeBuild(); return; }
              const S = stateRef.current;
              // mk2.00 (owner): no build tree over a live possession.
              if (S && S.possess) return;
              const b = S && S.mode ? branchOf(S.mode) : null;
              if (b) setBranch(b);
              setBuildOpen(true);
            }} />
          {buildOpen && (dev ? [...TREE_BRANCHES, { key: "foes", label: "THE ENEMY", icon: "☠", match: () => false }] : TREE_BRANCHES).map((b) => (dev && b.key === "foes") || palette.some((p) => b.match(p.key)) ? (
            <CrateChip key={b.key} data-branch={b.key}
              label={b.label} icon={b.icon} open={branch === b.key} active={branch === b.key}
              count={b.key === "foes" ? FOE_RACK.length : palette.filter((p) => b.match(p.key)).length}
              line={!qmQuiet ? QM_LINES[b.key] : null}
              style={{ animation: "cs-deal 0.14s ease-out backwards", animationDelay: (TREE_BRANCHES.indexOf(b) * 0.04) + "s" }}
              onClick={() => setBranch(b.key)} />
          ) : null)}
          {buildOpen && dev && branch === "foes" && FOE_RACK.map((f, fi) => (
            <StockTag key={f.key} data-foe-key={f.key}
              tilt={fi % 2 ? 1.5 : -2} delay={(0.10 + fi * 0.04) + "s"}
              style={{ minWidth: isTouch ? 56 : 52, borderColor: hud.devSpawn === f.key ? "#ff6b5e" : "#8f8768", background: hud.devSpawn === f.key ? "#d8c9a5" : "#cfc6a5" }}
              onClick={() => {
                const S = stateRef.current; if (!S) return;
                S.devSpawn = S.devSpawn === f.key ? null : f.key;
                S.mode = null; S.pending = null; S.sellMode = false;
                setHud((h) => ({ ...h, devSpawn: S.devSpawn, mode: null, sellMode: false }));
              }}>
              <div style={{ fontSize: 15 }}>{f.icon}</div>
              <div>{f.label}</div>
              <div style={{ color: "#8a2f2f", fontSize: 10, fontWeight: 600 }}>ENEMY</div>
            </StockTag>
          ))}
          {buildOpen && palette.filter((p) => { const b = TREE_BRANCHES.find((x) => x.key === branch); return b && b.match(p.key); }).map((p, pi) => {
            const sel = !hud.sellMode && hud.mode === p.key;
            const priceP = hud.prices?.[p.key] ?? p.cost;
            const afford = hud.resources >= priceP;
            return (
              <StockTag key={branch + ":" + p.key} data-tower-key={p.key}
                tilt={pi % 2 ? 1.5 : -2} delay={(0.10 + pi * 0.04) + "s"}
                style={{ minWidth: isTouch ? 56 : 52, opacity: afford ? 1 : 0.45, borderColor: sel ? "#2f7a44" : "#8f8768", background: sel ? "#d3d6a8" : "#cfc6a5" }}
                onClick={() => setMode(p.key)}>
                <div data-info={p.key} onClick={(e) => { e.stopPropagation(); const S = stateRef.current; if (S && S.openInfo) S.openInfo(p.key, "bar"); }}
                  style={{ position: "absolute", top: 1, right: 3, fontSize: 12, opacity: 0.6, padding: "2px 4px", cursor: "pointer" }}>ⓘ</div>
                <div style={{ fontSize: 15 }}>{p.icon}</div>
                <div>{p.label}</div>
                <div style={{ color: "#7a5a1e" }}>◆{priceP}</div>
              </StockTag>
            );
          })}
          {buildOpen && (
            <StockTag data-sell-toggle tilt={1.5} delay="0.09s"
              style={{ minWidth: isTouch ? 56 : 52, borderColor: hud.sellMode ? "#a85c1e" : "#8f8768", background: hud.sellMode ? "#dcc9a0" : "#cfc6a5" }}
              onClick={toggleSell}>
              <div style={{ fontSize: 15 }}>✕</div>
              <div>SELL</div>
              <div style={{ opacity: 0.7 }}>60%</div>
            </StockTag>
          )}
        </div>
      )}
```

(The tower-slot `position: "relative"` moved into StockTag itself; the ⓘ badge keeps its absolute seat. The convoy card's own `cs-deal` keyframes tag at :4616 still ends at `transform: none` — its rows carry no resting tilt, `var(--restT, none)` and `none` agree, and that tag is Task 3b's ground; it is NOT touched here.)

### Step 4 — gates and the landing

- `node scripts/gate.mjs depot-test` — era 24 grows by 5; every existing pin (era 23's rack pins, era 24's mk2.28 pins — `<CrateChip`, `transformOrigin`, cs-deal-not-both, the doors) must hold. Any other movement: STOP.
- `node scripts/gate.mjs depot-lint` — clean.
- `node scripts/gate.mjs smoke` — run AFTER the bump and build, at the new mark (the mk2.29 deviation is not repeated): bump `src/version.js` to `mk2.30`, `npm run build`, then smoke against the preview.
- Green → commit → push. The owner's live check, phone and desktop: BUILD is a drawn crate with its name on the face; open crates swing their lids; the stock is paper tags in a loose fan, tilts surviving the deal; the enemy tags stamped red; sell on paper; can't-afford tags dim; nothing behind the tags but the battlefield.

**Renumbering:** superseded below — Task 2c takes mk2.31; the convoy on paper and the draft deal move to mk2.32/mk2.33, re-specced after the lattice is accepted.

---

## Task 2c — the lattice (mk2.31)

**The rulings (owner, 2026-08-24, from the accepted v5 mockup — `quartermaster-lattice-v5-mockup.md`):** BUILD deals the three category crates (plus THE ENEMY on the bench); tapping a category unfurls ONLY that category's lattice — a drawn trunk with tier rungs, cheap at the bottom, dear at the top, tags cheap→dear left to right. Rungs are cut by BASE price (tags show the live price but never jump rungs). Picking a tag arms the mode at once and the whole assembly folds back into the lone BUILD crate wearing the armed name. One lattice stands at a time; switching folds the old and unfurls the new. Names ruled: SNIPERS (not MARKSMEN); the APC is not hero iron — VEHICLES rung II. DAVY CROCKETT is the hero-tier troop.

**Suggested model: Sonnet 5** — every block is written below; the fold machinery is fully specced.

**Required reading:** this task's section in full; the v5 mockup file (owner-accepted look); `src/depot/Crate.jsx` whole; `src/depot/DepotGame.jsx:4860-4923` (the bar block as landed at mk2.30 — replaced whole here; re-verify bounds at dispatch), `:859-873` (TREE_BRANCHES, branchOf, QM_LINES), `:756-815` (PALETTE, FOE_RACK), `:672-700` (P — `P.bar` reused, unedited); the setMode/closeBuild/toggleSell neighborhood (search `const closeBuild`); `scripts/tests/24-the-quartermaster.mjs` whole (two mk2.27 pins re-teach here, licensed below); `scripts/tests/23-the-sandbox.mjs` (rack pins must survive). Read-confirmation opens the report.

**The fill-law exception, stated knowingly:** entrance animations keep `backwards` fill (the dimming law). The PACK (exit) animations use `forwards` — a packed element must hold its vanished frame until the unmount that follows; this is the exit's whole purpose, not a violation of the entrance law.

### The sweep license (owner ratifies with this plan)

- Era 24's mk2.27 pins re-teach, old→new reported: `"names: the colliding trades re-sign"` MARKSMEN → SNIPERS; `"names: the bar follows the trades"` `sq_sniper` MARKSMEN → SNIPERS. The FOE_RACK pin gains SNIPER PAIR if its regex touches it (plan-time grep: it does not — it pins foe_t/foe_mg/foe_rocket only).
- Anything else moving: STOP.

### Step 1 — the failing asserts

Append to `scripts/tests/24-the-quartermaster.mjs` (and re-teach the two licensed pins above in place):

```js
{ // mk2.31: the lattice — rungs by price, the fold, the sniper's true name
  const dg6 = src("src/depot/DepotGame.jsx");
  ok("lattice: snipers are snipers", (() => { const s = src("src/depot/squads.js"); return /sniper: \{ n: 2, cost: 68, label: "SNIPERS" \}/.test(s); })());
  ok("lattice: the enemy pair follows", dg6.includes('label: "SNIPER PAIR"') && src("src/depot/specs.js").includes('label: "sniper"'));
  ok("lattice: the rungs stand as ruled", dg6.includes("const LATTICE = {") &&
    dg6.match(/troops:[\s\S]{0,400}\["sq_rifles", "sq_engineers", "sq_mg", "sq_sappers"\]/) != null &&
    dg6.match(/troops:[\s\S]{0,600}\["sq_davy"\]/) != null &&
    dg6.match(/vehicles:[\s\S]{0,200}\["hero_apc"\]/) != null &&
    dg6.match(/vehicles:[\s\S]{0,300}\["hero_bison", "hero_mech"\]/) != null);
  ok("lattice: the trunk climbs and the pack folds", dg6.includes("cs-climb") && dg6.includes("cs-pack") && dg6.includes("data-lattice"));
  ok("lattice: packing is inert and finishes on the trunk", dg6.match(/pointerEvents: packing/) != null && dg6.match(/onAnimationEnd=\{packing \? finishPack/) != null);
  ok("lattice: every door survived", dg6.includes("data-build-toggle") && dg6.includes("data-branch") && dg6.includes("data-tower-key") && dg6.includes("data-info=") && dg6.includes("data-sell-toggle") && dg6.includes("data-foe-key"));
}
```

Run `node scripts/gate.mjs depot-test` — the block must FAIL before Step 2 (the two re-taught mk2.27 pins go red with it until Step 2 lands; that red is licensed and expected — report it).

### Step 2 — the sniper's name

- `src/depot/squads.js:38` — `label: "MARKSMEN"` → `label: "SNIPERS"`.
- `src/depot/specs.js:74` — `label: "marksman"` → `label: "sniper"`.
- `src/depot/DepotGame.jsx` PALETTE — `sq_sniper` label `"MARKSMEN"` → `"SNIPERS"`; FOE_RACK — `foe_sniper` label `"MARKSMAN PAIR"` → `"SNIPER PAIR"`.

### Step 3 — the rung tables

`src/depot/DepotGame.jsx`, directly under `branchOf` (:866):

```js
// mk2.31 (owner): THE LATTICE — rungs cut by BASE price (v5 mockup),
// bottom-up in array order, cheap→dear inside a rung. Presentation only;
// the price-family rows in specs.js are untouched and a tag never jumps
// rungs on a live price. DAVY is the hero-tier troop; the APC is rung II
// iron, not hero (owner, 2026-08-24).
const LATTICE = {
  troops: [
    { name: "I", keys: ["sq_rifles", "sq_engineers", "sq_mg", "sq_sappers"] },
    { name: "II", keys: ["sq_grenadiers", "sq_rockets", "sq_mortars"] },
    { name: "III", keys: ["sq_medics", "sq_mechanics", "sq_sniper"] },
    { name: "HERO", keys: ["sq_davy"] },
  ],
  buildings: [
    { name: "I", keys: ["mg", "gun"] },
    { name: "II", keys: ["mortar", "tesla"] },
    { name: "III", keys: ["rocket"] },
  ],
  vehicles: [
    { name: "II", keys: ["hero_apc"] },
    { name: "HERO", keys: ["hero_bison", "hero_mech"] },
  ],
  // the bench's rack, by kind — sandbox only
  foes: [
    { name: "MEN", keys: ["foe_rifle", "foe_rocket", "foe_gren", "foe_sapper", "foe_mortar", "foe_sniper", "foe_mg", "foe_eng", "foe_medic", "foe_mechanic", "foe_davy"] },
    { name: "IRON", keys: ["foe_tank", "foe_bison", "foe_apc", "foe_mech"] },
    { name: "TOWERS", keys: ["foe_t_mg", "foe_t_gun", "foe_t_mortar", "foe_t_rocket", "foe_t_tesla"] },
  ],
};
```

### Step 4 — the fold state and handlers

Beside the `buildOpen`/`branch` useState pair (search `setBuildOpen`), `branch` keeps its name and becomes the standing category (`null` = crates row only); add:

```js
  // mk2.31: THE FOLD — packing plays every exit animation, then the trunk's
  // onAnimationEnd unmounts. _packNext carries what stands after the fold:
  // null = all closed; a category key = switch to it. Pure presentation.
  const [packing, setPacking] = useState(false);
  const packNextRef = useRef({ next: null, closeAll: false });
  const beginPack = (next, closeAll) => { if (packing) return; packNextRef.current = { next, closeAll }; setPacking(true); };
  const finishPack = () => {
    const t = packNextRef.current;
    setPacking(false);
    setBranch(t.next);
    if (t.closeAll) setBuildOpen(false);
  };
```

Wiring rules, exact:

- The BUILD/CLOSE crate's tap while open: `closeBuild()` keeps every clear it does today, and its `setBuildOpen(false)` line is REPLACED by `beginPack(null, true)` — the fold now does the closing. (`closeBuild`'s other callers — possession, end states — sit under the outer bar gate, which unmounts instantly; no change.)
- The BUILD crate's tap while closed and a mode is armed: the existing branch-follow (`branchOf`) sets `branch` so the lattice opens straight on the armed category — today's code already does this; it stands.
- A category crate's tap: `branch === b.key ? beginPack(null, false) : branch ? beginPack(b.key, false) : setBranch(b.key)` — first open unfurls directly; switching folds then unfurls (finishPack lands on the next category and its lattice mounts with fresh entrance animations); re-tapping the open one folds it to the crates row.
- A stock tag's tap: `setMode(p.key)` (or `toggleSell()`, or the rack's arm block) exactly as today, THEN `beginPack(null, true)` — the mode arms on the tap, the fold follows. The armed name on the closed crate already renders via the BUILD chip's `line` prop; that line becomes `!buildOpen ? (hud.sellMode ? "SELL" : hud.mode ? (PALETTE_LABEL[hud.mode] || "") : "") : ""`.
- While `packing`, the lattice and crates row carry `pointerEvents: "none"` — no double-fires inside the fold.

### Step 5 — the keyframes and the bar block

The bar's `<style>` tag becomes (one tag, all six keyframes):

```jsx
          <style>{`
@keyframes cs-deal { from { opacity: 0; transform: translate(-16px, 12px) rotate(-8deg) scale(0.85); } to { opacity: 1; transform: var(--restT, none); } }
@keyframes cs-climb { from { transform: scaleY(0); } to { transform: scaleY(1); } }
@keyframes cs-line { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes cs-pack { to { opacity: 0; transform: translate(-16px, 12px) rotate(-8deg) scale(0.85); } }
@keyframes cs-packline { to { transform: scaleX(0); } }
@keyframes cs-packtrunk { to { transform: scaleY(0); } }
`}</style>
```

The bar block is restructured (the whole `:4860-4923` span replaced; every handler body verbatim from today plus the Step 4 wiring):

- **The crates row** stays in `<div style={P.bar}>`: the BUILD/CLOSE CrateChip, then (while `buildOpen`) the category CrateChips — `data-branch` kept, `open={branch === b.key}` — plus THE ENEMY on the bench and the SELL StockTag. While `packing && packNextRef.current.closeAll`, each row element carries `animation: "cs-pack 0.1s ease-in forwards"` with `animationDelay: "0.18s"`; otherwise their existing cs-deal entrances stand. The whole row div gains `pointerEvents: packing ? "none" : "auto"`.
- **The lattice** is a sibling ABOVE the bar, mounted while `branch` stands:

```jsx
      {hud.started && !hud.gameOver && !hud.victory && !hud.possessed && buildOpen && branch && (
        <div data-lattice style={{ position: "absolute", left: 6, right: 6, bottom: "calc(96px + env(safe-area-inset-bottom, 0px))", zIndex: 4, display: "flex", flexDirection: "column-reverse", gap: 2, pointerEvents: packing ? "none" : "auto" }}>
          <div data-trunk style={{ position: "absolute", left: 14, top: -4, bottom: -10, width: 2, background: "#8f9aa8", transformOrigin: "bottom",
            animation: packing ? "cs-packtrunk 0.12s ease-in forwards" : "cs-climb 0.15s ease-out backwards",
            animationDelay: packing ? "0.22s" : "0s" }}
            onAnimationEnd={packing ? finishPack : undefined} />
          {(LATTICE[branch] || []).map((rung, ri) => (
            <div key={branch + ":" + rung.name} style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: 10 }}>
              <div style={{ fontSize: 9, letterSpacing: 1, color: "#b9a86a", border: "1px solid #6a5f3a", borderRadius: 2, padding: "1px 4px", background: "rgba(14,18,24,0.85)", zIndex: 1,
                animation: packing ? "cs-pack 0.1s ease-in forwards" : "cs-deal 0.1s ease-out backwards",
                animationDelay: packing ? "0.12s" : (0.12 + ri * 0.06) + "s", "--restT": "none" }}>{rung.name}</div>
              <div style={{ height: 2, width: 16, background: "#8f9aa8", transformOrigin: "left",
                animation: packing ? "cs-packline 0.1s ease-in forwards" : "cs-line 0.1s ease-out backwards",
                animationDelay: packing ? "0.12s" : (0.12 + ri * 0.06) + "s" }} />
              <div style={{ display: "flex", gap: 6, overflowX: "auto", padding: "6px 2px", alignItems: "center" }}>
                {rung.keys.map((k, ti) => renderLatticeTag(branch, k, ti, ri))}
              </div>
            </div>
          ))}
        </div>
      )}
```

- **`renderLatticeTag(cat, k, ti, ri)`** is a mount-scope helper returning today's tag JSX by kind — for `cat === "foes"` the rack StockTag (its whole current body and arm handler, plus `beginPack(null, true)` appended to the handler), otherwise the palette StockTag (its whole current body — ⓘ badge, icon, label, live `◆` price, afford dimming, sel coloring — with `onClick={() => { setMode(k2); beginPack(null, true); }}` where `k2` is the palette key, and the unlocked filter kept: a palette key not in the live `palette` list renders `null`, so locked plans simply don't hang on the rung). Tag animation props: `tilt={ti % 2 ? 1.5 : -2}`, entrance `delay={(0.17 + ri * 0.06 + ti * 0.035) + "s"}`; while packing the tag's style overrides to `animation: "cs-pack 0.12s ease-in forwards", animationDelay: (ti * 0.02) + "s"` (StockTag takes it via its `style` spread).
- The old flat slot maps, the old branch-only tag rows, and the SELL slot's seat inside the tag flow are all superseded by the above; SELL lives on the crates row as a StockTag with `onClick={() => { toggleSell(); beginPack(null, true); }}`.
- `TREE_BRANCHES`, `branchOf`, `QM_LINES`, and every `data-` attribute survive; `S.mode` and the sim are untouched.

### AMENDMENT 1 — the fold without a lattice (mk2.32, hotfix; owner's live find 2026-08-24)

CLOSE tapped from the crates row with no category open never finishes: the fold's finisher rides the trunk's `onAnimationEnd`, and no trunk stands when `branch` is null — `packing` sticks, the chip stays CLOSE, the row goes pointer-dead. The defect is the plan-writer's.

**Step A1-1.** `src/depot/DepotGame.jsx:946` — `beginPack` gains a first-line guard; the function becomes:

```js
  const beginPack = (next, closeAll) => {
    if (packing) return;
    // mk2.32: no lattice standing = nothing to fold — close without
    // ceremony (the trunk's onAnimationEnd is the only finisher).
    if (!branch) { setBranch(next); if (closeAll) setBuildOpen(false); return; }
    packNextRef.current = { next, closeAll };
    setPacking(true);
  };
```

**Step A1-2.** Append to era 24's mk2.31 block: `ok("lattice: a fold with no trunk closes at once", dg6.match(/if \(!branch\) \{ setBranch\(next\); if \(closeAll\) setBuildOpen\(false\); return; \}/) != null);`

**Step A1-3.** `src/version.js` → `mk2.32`, build AFTER the bump. Gates: `node scripts/gate.mjs depot-test` (one new check, nothing else moves), `depot-lint`, then smoke at mk2.32. Green → commit "the quartermaster's crates — the fold without a lattice, mk2.32" → push. The convoy on paper and the draft deal renumber to mk2.33/mk2.34.

### AMENDMENT 2 — the stand-down and the clear lid (mk2.36; owner's live find 2026-08-24)

Two findings from the owner's phone check of mk2.35:

1. **The lids cross the paper.** The lattice's bottom seat (`calc(96px + …)`) stands rung I inside the open lids' swing — the CLOSE and category lids overlap the first tags.
2. **A placement stands the menu down (owner's ruling).** After a SUCCESSFUL placement the armed mode and its held-ground tint clear back to plain command. This KNOWINGLY reverses the mk1.67 branch-stays-open-for-repeat-placement ruling (owner, 2026-08-24, this amendment is the record; its closing task is this one). The bench's enemy rack is exempt — repeat tap-placement is its ruled flow; refusals (bad ground, no scrap) also keep the armed mode, only success clears.

**Step A2-1.** `src/depot/DepotGame.jsx:4957` — the lattice's `bottom` becomes `"calc(150px + env(safe-area-inset-bottom, 0px))"` — the dial provisional (F5), the owner's eye the acceptance.

**Step A2-2.** Directly above `confirmPending` (:1710), add:

```js
      // mk2.36 (owner): A PLACEMENT STANDS THE MENU DOWN — success clears
      // the armed mode and its ground tint back to plain command. Knowingly
      // reverses mk1.67's stays-armed-for-repeat ruling (owner, 2026-08-24).
      // The bench's enemy rack keeps repeat placement; refusals keep the arm.
      const standDown = () => {
        S.mode = null; S.pending = null; S.buildPt0 = null;
        setHud((h) => ({ ...h, mode: null }));
      };
```

**Step A2-3.** `buildAt`'s success tail — directly after its `recomputeFlow();` line (:1660), add `standDown();`.

**Step A2-4.** `placeSquadAt`'s success tail — directly after its `S._buyAt = world.t;` line (:1770), add `standDown();`.

**Step A2-5.** `placeHero`'s success — directly before its final `return true;` (:2940), add `standDown();`.

**Step A2-6.** Append to era 24:

```js
{ // mk2.36: the stand-down and the clear lid
  const dg9 = src("src/depot/DepotGame.jsx");
  ok("standdown: the helper exists and all three placers call it", dg9.includes("const standDown = ") && dg9.match(/recomputeFlow\(\);\n\s+standDown\(\);/) != null && dg9.match(/S\._buyAt = world\.t;\n\s+standDown\(\);/) != null && dg9.match(/standDown\(\);\n\s+return true;/) != null);
  ok("standdown: the lattice clears the lids", dg9.includes('bottom: "calc(150px + env(safe-area-inset-bottom, 0px))"'));
}
```

(Failing-first: the asserts land and run red before A2-1..A2-5.)

**Step A2-7.** `src/version.js` → `mk2.36`, build AFTER the bump. Gates: `node scripts/gate.mjs depot-test` (two new checks, nothing else moves), `depot-lint`, smoke at mk2.36. Green → commit "the quartermaster's crates — the stand-down and the clear lid, mk2.36" → push.

### Step 6 — gates and the landing

- `node scripts/gate.mjs depot-test` — the mk2.31 block green; the two licensed re-teaches reported old→new; era 23's rack pins and every other era-24 pin unmoved. Anything else: STOP.
- `node scripts/gate.mjs depot-lint` — clean.
- Bump `src/version.js` to `mk2.31`, `npm run build`, THEN `node scripts/gate.mjs smoke` at the new mark (preview server; SMOKE_URL override if 4173 is taken).
- Green → commit → push. The owner's live check, phone and desktop: BUILD → three crates → a category's lattice climbs, rungs light bottom-up, tags deal cheap→dear; picking folds everything into the lone crate wearing the armed name; switching categories folds and re-unfurls; the bench's ENEMY lattice hangs its three kind-rungs; SELL folds the same; a fold mid-animation never eats a tap.

---

## Task 3c — the convoy on paper (mk2.33)

**Suggested model: Sonnet 5** — one JSX block re-dressed, written below in full.

The bell card's five hand rows leave the dark button chrome and become paper — the same StockTag the desk deals, laid as full-width rows fanning from the open THE CONVOY crate. Every attribute, handler, arming gate, and word survives; the T2(e6) `data-hand-kind` pin and the era-24 convoy pins hold by construction. LATER stays a plain chrome button (it is a dismissal, not stock).

**Required reading:** this task's section in full; `src/depot/DepotGame.jsx:4705-4750` (the manifest card block as landed at mk2.32 — re-verify by `data-manifest-card`); `src/depot/Crate.jsx` whole (StockTag's props); `scripts/tests/11-hiring-hall.mjs` T2(e6); `scripts/tests/24-the-quartermaster.mjs` mk2.29 block. Read-confirmation opens the report.

### Step 1 — the failing assert

Append to era 24:

```js
{ // mk2.33: the convoy on paper
  const dg7 = src("src/depot/DepotGame.jsx");
  ok("convoy: the hand rows are paper", dg7.match(/<StockTag[^>]*data-manifest-offer/) != null && dg7.includes('data-hand-kind={c.hire ? "hire" : "plan"}'));
}
```

Run `node scripts/gate.mjs depot-test` — must FAIL before Step 2.

### Step 2 — the rows

The manifest card's local keyframes tag ends at the tilt-safe frame — its one line becomes:

```jsx
            <style>{`@keyframes cs-deal { from { opacity: 0; transform: translate(-14px, 10px) rotate(-6deg) scale(0.88); } to { opacity: 1; transform: var(--restT, none); } }`}</style>
```

The hand row `<button>` (inside `hud.manifest.hand.map`) is replaced by:

```jsx
                <StockTag key={ci + ":" + c.k} data-manifest-offer={c.k} data-hand-kind={c.hire ? "hire" : "plan"}
                  tilt={ci % 2 ? 0.8 : -1.2} delay={(ci * 0.05) + "s"}
                  style={{ width: "100%", minHeight: 44, marginBottom: 6, flexDirection: "row", alignItems: "center", gap: 10, textAlign: "left", padding: "8px 10px 8px 22px", opacity: hud.manifest.armed ? 1 : 0.5 }}
                  onClick={() => { const S = stateRef.current; if (S && S.openInfo) S.openInfo(c.k, c.hire ? "hire" : "manifest"); }}>
                  <span style={{ fontSize: 18 }}>{it.icon}</span>
                  <span style={{ flex: 1 }}>{it.label}</span>
                  <span style={{ color: c.hire ? "#2f6a3a" : "#7a5a1e", fontSize: 11, letterSpacing: 1, fontWeight: 600 }}>{c.hire ? "HIRE" : "PLAN"} ◆{c.price}</span>
                </StockTag>
```

(The map's `it`/`ci` and the null guard stand; the LATER button and everything else in the card is untouched. StockTag's punched hole sits in the row's left padding.)

### Step 3 — gates and the landing

`node scripts/gate.mjs depot-test` (one new check; the mk2.29 pins still match — the rows still carry cs-deal via StockTag), `depot-lint`; bump `src/version.js` to `mk2.33`, `npm run build`, THEN smoke at the new mark. Green → commit "the quartermaster's crates — the convoy on paper, mk2.33" → push. The owner's live check, phone and desktop: the bell rings, five paper rows fan from the crate, buying and hiring unchanged. The draft deal renumbers to mk2.34.

### AMENDMENT 1 (after the agent's honest stop at the first gate — the defect is the plan-writer's)

Step 3's claim "the mk2.29 pins still match" is false: the mk2.29 pin `"convoy: the hand deals out of a crate"` greps `data-manifest-offer[\s\S]{0,600}cs-deal` against DepotGame.jsx, and Step 2 moved the `cs-deal` literal into StockTag's body in Crate.jsx — the truth (the rows deal) is unchanged, its address moved. The pin re-teaches, content-preserving, reported old→new. In `scripts/tests/24-the-quartermaster.mjs:43`, the assert becomes:

```js
  ok("convoy: the hand deals out of a crate (re-taught mk2.33: the deal rides StockTag)", dg3.match(/<StockTag[^>]*data-manifest-offer/) != null && src("src/depot/Crate.jsx").includes("cs-deal"));
```

Nothing else in the task changes. Step 3 proceeds with the re-teach reported: old regex `data-manifest-offer[\s\S]{0,600}cs-deal` on DepotGame.jsx → new form above.

### AMENDMENT 2 — the paper stays on the card (mk2.35, hotfix; owner's live find 2026-08-24, phone screenshot)

The hand rows overflow the card's right edge and the prices run off screen. The cause is the plan-writer's: the row style sets `width: "100%"` beside 32px of horizontal padding, and the tag div sizes content-box (the browser default) — every row renders 32px wider than the card.

**Step A2-1.** `src/depot/DepotGame.jsx` — the hand row StockTag's style object (the `data-manifest-offer` row) gains one token, first in the object: `boxSizing: "border-box",`.

**Step A2-2.** Append to era 24's mk2.33 block: `ok("convoy: the paper stays on the card", dg7.match(/data-manifest-offer[\s\S]{0,300}boxSizing: "border-box"/) != null);`

**Step A2-3.** `src/version.js` → `mk2.35`, build AFTER the bump. Gates: `node scripts/gate.mjs depot-test` (one new check, nothing else moves), `depot-lint`, smoke at mk2.35. Green → commit "the quartermaster's crates — the paper stays on the card, mk2.35" → push. (The draft screen's tags size by minWidth, not width-percent — checked, not affected.)

---

## Task 4c — the draft deal (mk2.34)

**Suggested model: Sonnet 5** — one component's return block re-dressed, written below in full.

The opening draft joins the paper language: an open crate under the title, the seven cards dealt as StockTags in a fan, a picked tag wearing the armed look. The pick machinery — toggle by name, five max, the counter, FIELD THESE FIVE arming at exactly five — is byte-untouched. The era-11 pins (`data-draft-card`, `data-draft-confirm`, `picked.length === 5`) hold by construction.

**Required reading:** this task's section in full; `src/depot/DepotGame.jsx:826-862` (DraftScreen whole — re-verify by `function DraftScreen`); `src/depot/Crate.jsx` whole; `scripts/tests/11-hiring-hall.mjs:715-720` (the draft pins); `scripts/tests/24-the-quartermaster.mjs` tail. Read-confirmation opens the report.

### Step 1 — the failing assert

Append to era 24:

```js
{ // mk2.34: the draft deal
  const dg8 = src("src/depot/DepotGame.jsx");
  ok("draft: the seven deal as paper from the crate", dg8.match(/<StockTag[^>]*data-draft-card/) != null && dg8.match(/DraftScreen[\s\S]{0,900}<CrateChip/) != null);
  ok("draft: the pick machinery stands", dg8.includes("data-draft-confirm") && dg8.includes("picked.length === 5"));
}
```

Run `node scripts/gate.mjs depot-test` — the first check must FAIL before Step 2.

### Step 2 — DraftScreen's return

The component's signature, state, and `toggle` stand. Its `return (...)` block is replaced by:

```jsx
  return (
    <div style={P.ovl}>
      <style>{`@keyframes cs-deal { from { opacity: 0; transform: translate(-16px, 12px) rotate(-8deg) scale(0.85); } to { opacity: 1; transform: var(--restT, none); } }`}</style>
      <div style={{ fontSize: 20, letterSpacing: 3, color: "#9fdcff", marginBottom: 4 }}>THE OPENING DRAFT</div>
      <CrateChip label="THE CONVOY" icon="⚒" open={true} style={{ marginBottom: 6 }} />
      <div style={{ fontSize: 12, opacity: 0.85, maxWidth: 460, lineHeight: 1.6, marginBottom: 14 }}>
        Seven cards dealt — units and plans together. Pick five, free.
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 8, maxWidth: 520, marginBottom: 14 }}>
        {cards.map((c, ci) => {
          const it = PALETTE_BY_KEY[c.k];
          const on = picked.includes(c.k);
          return (
            <StockTag key={c.k} data-draft-card={c.k} data-draft-kind={c.plan ? "plan" : "unit"}
              tilt={ci % 2 ? 1.5 : -2} delay={(ci * 0.06) + "s"}
              onClick={() => toggle(c.k)}
              style={{ minWidth: 88, minHeight: 56, borderColor: on ? "#2f7a44" : "#8f8768", background: on ? "#d3d6a8" : "#cfc6a5" }}>
              <div style={{ fontSize: 16 }}>{it ? it.icon : "?"}</div>
              <div>{it ? it.label : c.k}</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: c.plan ? "#31556a" : "#7a5a1e" }}>{c.plan ? "PLAN" : "UNIT"}</div>
            </StockTag>
          );
        })}
      </div>
      <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 10 }}>PICKED {picked.length} OF 5</div>
      <button data-draft-confirm disabled={picked.length !== 5}
        style={{ ...P.btn, fontSize: 15, padding: "10px 26px", minHeight: 44, minWidth: 44, borderColor: picked.length === 5 ? "#4aff8c" : "#48515f", color: picked.length === 5 ? "#4aff8c" : "#e6ebf1", opacity: picked.length === 5 ? 1 : 0.55 }}
        onClick={() => onConfirm(cards.filter((c) => picked.includes(c.k)))}>
        FIELD THESE FIVE
      </button>
    </div>
  );
```

(DraftScreen sits at module scope where `P`, `PALETTE_BY_KEY`, `CrateChip`, and `StockTag` are all in scope already — verified this session. The map gains the index `ci` for the fan; keys, attributes, toggle, and confirm are today's verbatim.)

### Step 3 — gates and the landing

`node scripts/gate.mjs depot-test` (two new checks, the era-11 draft pins unmoved, nothing else moves), `depot-lint`; bump `src/version.js` to `mk2.34`, `npm run build`, THEN smoke at the new mark. Green → commit "the quartermaster's crates — the draft deal, mk2.34" → push. The owner's live check, phone and desktop: a fresh war's seven cards fan from the crate as paper, picks light green, FIELD THESE FIVE unchanged.

---

## Task 5 — the fog holds its secrets (mk2.37)

**The finding (owner, 2026-08-24, live check):** enemy vehicles and towers show through fog. Plan-time diagnosis: the renderer's fog law — sample the territory at the body; unheld hides it, the seam draws a flat grey silhouette — exists in exactly two sync loops (vehicles at `renderer.js:1863-1872`, instanced infantry at `:2049-2059`). The tower loop (`:1901-1943`) and the mech-family loop (`:2205-2212`) never learned it: every enemy tower and every mech piece draws wherever it stands. Targeting is untouched — guns already read fog honestly; this is a picture-only leak.

**Suggested model: Sonnet 5** — two gate blocks mirroring an existing in-file pattern, written below.

**The law extended, stated:** render-only; DEPOT-only by construction (`opts.territory` is supplied by DEPOT alone, so the demo, campaign, and tower-defense worlds are byte-unaffected); only live team-2 bodies are ever gated (wrecks stay visible — a dead thing found is information earned, the vehicles' standing rule); both new sites feed the existing `fogDbgTotal/fogDbgVisible` counters. One design choice, made here: a SEAM tower draws whole but drops its health bar — towers wear no team dress (one mesh both sides), so the vehicles' silhouette recolor has nothing to hide on them; seam mech pieces DO recolor to `SIL_C` (their hull color is dress). Renderer edits ride the guarded-divergence law — golden runs.

**Required reading:** this task's section in full; `src/render/renderer.js:1259-1277` (fogOn/sample/SIL_C/the counters), `:1840-1898` (the vehicle loop's gate — the pattern being mirrored), `:1901-1943` (the tower loop, gated here), `:2202-2212` (the mech-family loop, gated here), `:2049-2059` (the infantry gate, for the counter idiom); `scripts/smoke.mjs` — the fog assert (search `__DEPOTFOGDBG__`; its shape must tolerate the larger totals — verify, report); `scripts/tests/24-the-quartermaster.mjs` tail. Read-confirmation opens the report.

### Step 1 — the failing asserts

Append to era 24:

```js
{ // mk2.37: the fog holds its secrets — towers and the mech learn the law
  const rr = src("src/render/renderer.js");
  ok("fog: enemy towers hide unheld", rr.match(/kind !== "tower"[\s\S]{0,900}st === "unheld"/) != null);
  ok("fog: mech pieces hide unheld", rr.match(/mechfoot[\s\S]{0,700}st === "unheld"/) != null);
  ok("fog: all four loops feed the counters", (rr.match(/fogDbgTotal\+\+/g) || []).length === 4);
}
```

Run `node scripts/gate.mjs depot-test` — the block must FAIL before Step 2.

### Step 2 — the tower gate

`src/render/renderer.js:1904` — directly after `if (b.kind !== "tower") continue;`, add:

```js
      // mk2.37: DEPOT fog — the tower loop learns the vehicles' law. An
      // unheld enemy tower is not rendered (group hidden, bar/aura/sparks
      // skip with it); a SEAM tower draws whole but drops its bar — towers
      // wear no team dress (one mesh both sides), so there is no color to
      // silhouette. Live team-2 only; render-only; DEPOT-only (opts.territory).
      let fogSilT = false;
      if (opts.territory && b.team === 2 && b.alive) {
        fogDbgTotal++;
        if (fogOn) {
          const st = opts.territory.sample(b.pos.x, b.pos.z);
          if (st === "unheld") { const g0 = towerGroups.get(b.id); if (g0) g0.visible = false; continue; }
          fogSilT = st === "seam";
        }
        fogDbgVisible++;
      }
```

Then two token edits inside the same loop: after the `let g = ...; if (!g) { ... }` pair, add `g.visible = true;` (a tower stepping out of fog un-hides); and the loop's `pushBar(b, 1.6, 1.0);` becomes `if (!fogSilT) pushBar(b, 1.6, 1.0);`.

### Step 3 — the mech gate

`src/render/renderer.js:2206` — directly after the mech-family kind filter line, add:

```js
      // mk2.37: DEPOT fog — unheld enemy mech pieces write no instance (the
      // pod/thruster hardware skips with its torso); seam pieces write the
      // flat silhouette and no bar. Live team-2 only; render-only.
      let fogSilM = false;
      if (opts.territory && b.team === 2 && b.alive) {
        fogDbgTotal++;
        if (fogOn) {
          const st = opts.territory.sample(b.pos.x, b.pos.z);
          if (st === "unheld") continue;
          fogSilM = st === "seam";
        }
        fogDbgVisible++;
      }
```

Then two token edits in the same loop: `if (b.kind === "mech") pushBar(...)` becomes `if (b.kind === "mech" && !fogSilM) pushBar(...)`; and the `setColorAt` line's color argument becomes `fogSilM ? SIL_C : (b.kind === "mech" ? MECH_HULL_C : b.kind === "mechfoot" ? MECH_FOOT_C : MECH_LINK_C)`. (`SIL_C` is in the same closure at `:1272`. The `torsos.push` line stays below the gate — an unheld torso's `continue` already keeps its pod and thrusters unwritten.)

### Step 4 — gates and the landing

- `node scripts/gate.mjs depot-test` — three new checks green; nothing else moves.

*AMENDMENT 1 (after the agent's honest stop before any edit — the defect is the plan-writer's): the required-reading item on smoke's "fog assert" is STRUCK — no such assert exists in `scripts/smoke.mjs` (agent-grepped; the renderer comment at :1273 claiming one is stale and stays untouched — comments are not this task's ground). The fog counters are debug-only, read by `__DEPOTFOGDBG__` alone. Step 4's "smoke fog assert's shape verified" clause is struck with it; everything else stands as written.*
- `node scripts/gate.mjs golden` — 7/7 (renderer touched; the frozen-law gate rides).
- `node scripts/gate.mjs depot-lint` — clean.
- Bump `src/version.js` to `mk2.37`, `npm run build`, THEN `node scripts/gate.mjs smoke` at the new mark (own preview server, SMOKE_URL as needed).
- Green → commit "the fog holds its secrets (mk2.37)" → push. The owner's live check, phone and desktop: fog on, an enemy tower or mech beyond your men's sight is simply not there; walk sight onto it and it appears; the seam shows a grey mech and a bare tower; fog off shows everything, as today.

### AMENDMENT 2 — the whole mech learns its team (mk2.38, hotfix; owner's live find 2026-08-24: "mech still visible")

The defect is the plan-writer's: only the mech's HULL body carries `team` — every link, foot, torso, and arm is built with no team field (`mech.js:505-586`), so the mk2.37 gate's `b.team === 2` matched the hull alone and the rest of the machine kept rendering. Every mech body does carry `b.mechRef` (`mech.js:492`) and the mech carries `team` (`mech.js:616`).

**Step A2-1.** The mech gate's condition in `src/render/renderer.js` — the line

```js
      if (opts.territory && b.team === 2 && b.alive) {
```

INSIDE THE MECH-FAMILY LOOP ONLY (the one below the `mechfoot` kind filter — the tower/vehicle/infantry gates are untouched) becomes:

```js
      if (opts.territory && b.mechRef && b.mechRef.team === 2 && b.alive) {
```

**Step A2-2.** Append to era 24's mk2.37 block: `ok("fog: the whole mech gates by its mech's team, not the body's", rr.match(/mechfoot[\s\S]{0,700}b\.mechRef && b\.mechRef\.team === 2/) != null);` (Failing-first: land the assert, run red, then A2-1.)

**Step A2-3.** `src/version.js` → `mk2.38`, build AFTER the bump. Gates: `node scripts/gate.mjs depot-test` (one new check, nothing else moves), `golden` (renderer touched — 7/7), `depot-lint`, smoke at mk2.38. Green → commit "the whole mech learns its team (mk2.38)" → push.

---

## Standing constraints

- All timing dials provisional (F5); the owner's live check is the only acceptance for look and motion — no screenshot loops.
- No sim, engine, renderer, save, or rng edit anywhere in the four tasks; golden untouched (CI rides it).
- The sweep license, all tasks: only literal text a task itself moves may re-teach, asserted content preserved, every re-teach reported old→new. Plan-time grep found ZERO label pins on the moved names (the three standing label pins — ENGINEERS, MEDICS, MECHANICS — pin unmoved labels); any pin movement beyond that list stops the task.
- Reports: one outcome line, bullets per step and gate with exact counts, fixture seeds named (era 24 uses none — stated plainly in every report), every deviation its own labeled bullet.

## Check pass (plan-writer's own, done before serving)

- Anchors grepped against the live tree this session: `specs.js:38-42/56-93` (labels), `squads.js:38/40`, `DepotGame.jsx:756-786 (PALETTE), 793-815 (FOE_RACK), 859-866 (TREE_BRANCHES), 672-700 (P), 900-925 (MANUAL_KEY idiom), 4833 (cs-unfurl keyframes), 4835-4894 (the bar block), 4849/4858/4872/4889 (branches/rack/slots/SELL), 817-857 (DraftScreen), 4030/4065/4075/4106/4123 (label readers that follow automatically)`.
- Label pins swept across `scripts/tests/*.mjs` and `scripts/smoke.mjs`: the moved literals ("MG", "GUN", "ROCKET", "TESLA", "SNIPER", "MG TEAM", "ROCKETS", "mg team", the rack's tower names) are pinned NOWHERE; the three standing label pins pin labels this plan does not move.
- `infocards.js`, the possession chips, the inspect card, the hiring ticker, and the place ticker all read labels from the live tables — they follow Task 1 with no edit (each verified by grep on `.label`).
- Suite eras end at `23-the-sandbox.mjs`; era 24 is free. `version.js` MK is `mk2.26`; mk2.27-mk2.30 are the next four marks.
- Code blocks syntax-passed (node parse for the JS, the JSX read against the file's own idioms). No `Math.random` anywhere; no draw moves; no save shape moves.
