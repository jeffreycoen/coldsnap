# P7.1 Task 4 — Market info cards (mk1.65)

*HISTORY (stamped 2026-08-20, owner's order): this document is a record of shipped work, not authority. Design truth lives in CLAUDE.md and the ACTIVE phase's plan documents; where this file disagrees with them, it is wrong.*

One card per buyable type: what it is, its numbers, its skills, its live price. Two doors, one component: a bell offer opens the card with CONFIRM PICK / cancel before anything is taken (ruled), and an ⓘ on any build-bar slot opens the same card for an owned type (ruled). Numbers are READ from the live spec tables so a card can never drift from the gun it describes; the prose is in this plan, word for word — the owner's approval of this plan approves the copy. Phone and desktop both, by construction (one DOM).

**Rulings executed here** (decision record, 2026-08-19): confirm/cancel before the pick; manifest + build bar; one card component.

**Suggested model:** Sonnet — a data module, a presentational component, and wiring, all specced.

## Stated lines

- The pick machinery is untouched: CONFIRM calls the same `S.pickManifest` with all its arming and stale-offer guards; the card adds its own 350ms arm on top (both laws hold, the Dispatch precedent). The `__DEPOTPICK__` debug hook still picks directly — staging unchanged.
- Hero offers confirm like any pick — the pick unlocks the bar slot; the two-tap buy on the slot is unchanged.
- The frost card carries its existing bar blurb ("Halves their pace in radius") — the dead aura is the standing ARMS deferral; this task invents no new claim and fixes no aura.
- A bell ringing while a card is open overwrites the offers; a stale CONFIRM no-ops through pickManifest's own guard and the card closes. Honest by inheritance.
- No rng, no sim edit, no draw-count movement anywhere.

## Required reading, in order

1. This plan, whole.
2. `src/depot/specs.js` — whole (every number the cards read).
3. `src/depot/squads.js:33-67` — SQUAD_SPECS + squadSpeed.
4. `src/depot/DepotGame.jsx:2266-2296` — S.ackIntel/openManifest/dismissManifest/pickManifest (the card actions' neighbors).
5. `src/depot/DepotGame.jsx:3660-3700` — the manifest card (the offer buttons the new door rides).
6. `src/depot/DepotGame.jsx:3885-3905` — the build-bar palette map (the ⓘ door).
7. `src/depot/Dispatch.jsx` — whole (the presentational-component precedent InfoCard.jsx follows).
8. `scripts/tests/10-command-refit.mjs` — tail (the new asserts append here).

## Trap notes

- `PALETTE` lives inside DepotGame.jsx (JSX — the headless suite cannot import it). The test's completeness check therefore carries its own literal key list; if PALETTE ever gains a key, that assert is the alarm.
- The bar slot div needs `position: "relative"` added for the ⓘ badge's absolute anchor — spread it at the slot, do not edit `P.slot` (the style object is shared).
- The ⓘ badge stops propagation — a badge tap must never arm the slot's build mode.
- The info card renders at the manifest card's parking spot with a HIGHER z — it visually replaces the offer list until CONFIRM or ✗ returns you.
- Suite moves 1407 → 1413 (six named asserts), nothing else.

## Steps

**Step 1 — the data module.** Create `src/depot/infocards.js`:

```js
// COLDSNAP DEPOT — infocards.js (P7.1 T4): the market info cards' data.
// One card per buyable type. Numbers are READ from the live spec tables at
// load — a card can never drift from the gun it describes. The prose is
// owner-approved copy (the task plan carries it verbatim). Pure data.
import { TOWER_SPECS, INFANTRY_ARMS, BISON, APC, SATCHEL } from "./specs.js";
import { SQUAD_SPECS, squadSpeed } from "./squads.js";

const ORDERS_ARMED = ["DEFEND", "MOVE", "ATTACK", "PATROL", "ATTACK STRUCTURES", "TAKE CONTROL"];
const ORDERS_TOWER = ["CAREFUL / FREE", "TAKE CONTROL", "SELL"];
const ORDERS_HULL = ["DEFEND", "MOVE", "PATROL", "ESCORT", "TRACKS SAFETY", "TAKE CONTROL"];
const dmgOf = (a) => (a && (a.dirDmg != null ? a.dirDmg : a.dmg)) ?? null;
const sq = (type, role, skills, dmg) => {
  const s = SQUAD_SPECS[type], a = INFANTRY_ARMS[type] || null;
  const M = s.member || { hp: 58 };
  return { label: s.label, role, n: s.n, hp: M.hp, dmg: dmg !== undefined ? dmg : dmgOf(a),
    range: a ? a.range : null, speed: squadSpeed(type), skills };
};
const tw = (t, role, skills) => {
  const s = TOWER_SPECS[t];
  return { label: s.label, role, n: null, hp: s.hp, dmg: s.fireRate > 0 ? dmgOf(s) : null,
    range: s.range, speed: null, skills };
};
export const CARDS = {
  mg:     tw("mg", "Fast, cheap, short reach. Chews infantry; useless against stone.", ORDERS_TOWER),
  gun:    tw("gun", "The flat-trajectory workhorse. Cracks men and masonry alike.", ORDERS_TOWER),
  mortar: tw("mortar", "Arcs over walls. Big blast, slow reload.", ORDERS_TOWER),
  rocket: tw("rocket", "A four-rocket salvo, then a long reload. Saturation over precision.", ORDERS_TOWER),
  frost:  tw("frost", "Halves their pace in its radius.", ["SELL"]),
  sq_sniper:    sq("sniper", "A marksman and his spotter. The longest rifle on the field; the spotter's binoculars are the farthest eyes.", ORDERS_ARMED),
  sq_rifles:    sq("rifles", "Four riflemen. The working infantry of the line.", ORDERS_ARMED),
  sq_mg:        sq("mg", "A gunner and his loader. Six-round bursts that stop a rush.", ORDERS_ARMED),
  sq_sappers:   sq("sappers", "Two men, two satchel charges. They breach masonry and rarely survive the work. They also lay mines and tripwires.", ["DEFEND", "MOVE", "ATTACK (SATCHELS)", "TAKE CONTROL", "LAY MINES", "LAY WIRES"], SATCHEL.dmg),
  sq_mortars:   sq("mortars", "Two men and a tube. Shells over any wall from a distance.", ORDERS_ARMED),
  sq_engineers: sq("engineers", "Two builders — shovels, not rifles. They lay sandbag and wall lines where you draw them.", ["DEFEND", "MOVE", "ATTACK", "TAKE CONTROL", "BUILD BAGS", "BUILD WALLS"], null),
  sq_runners:   sq("runners", "Four fast men. First to a flank, thin as paper.", ORDERS_ARMED),
  sq_breakers:  sq("breakers", "A heavy pair. They grind enemy masonry apart by hand and shrug off rifle fire.", ORDERS_ARMED),
  hero_bison: { label: "BISON", role: "The Bison. Main gun, coax, and tracks that brake for your own. Dear, and dearer to replace.",
    n: null, hp: BISON.hp, dmg: null, range: null, speed: null, skills: ORDERS_HULL },
  hero_apc:   { label: "APC", role: "The transport. Four sealed seats — riders see nothing, fire nothing, and die with the hull.",
    n: null, hp: APC.hp, dmg: null, range: null, speed: null, skills: [...ORDERS_HULL, "LOAD / UNLOAD"] },
};
export const cardFor = (key) => CARDS[key] || null;
```

**Step 2 — the component.** Create `src/depot/InfoCard.jsx`:

```jsx
// COLDSNAP DEPOT — InfoCard.jsx (P7.1 T4): one card, two doors. The
// manifest door carries CONFIRM PICK / ✗ (the decision gate before a bell
// pick); the bar door carries CLOSE (an owned type's reference). Pure
// presentation — every action is a prop (the Dispatch.jsx discipline).
import React from "react";

export default function InfoCard({ card, price, armed, door, onConfirm, onCancel }) {
  if (!card) return null;
  const B = { background: "#1a212b", border: "1px solid #48515f", color: "#e6ebf1", borderRadius: 8, padding: "10px 16px", fontFamily: "inherit", fontSize: 14, minHeight: 44, minWidth: 44, cursor: "pointer" };
  const row = (k, v) => (v == null ? null : (
    <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginTop: 4 }}>
      <span style={{ opacity: 0.65, letterSpacing: 1 }}>{k}</span><span>{v}</span>
    </div>
  ));
  return (
    <div data-info-card={door} style={{ position: "absolute", top: 52, right: 10, zIndex: 7, width: "min(300px, 62vw)", background: "rgba(14,18,24,0.96)", border: "1px solid #9fdcff", borderRadius: 8, padding: 12, fontFamily: "ui-monospace, Menlo, Consolas, monospace", color: "#e6ebf1" }}>
      <div style={{ color: "#9fdcff", letterSpacing: 2, fontSize: 14 }}>{card.label}</div>
      <div style={{ fontSize: 12, opacity: 0.85, lineHeight: 1.5, marginTop: 6 }}>{card.role}</div>
      {row("HEALTH", card.n ? `${card.hp} × ${card.n} men` : card.hp)}
      {row("DAMAGE", card.dmg)}
      {row("RANGE", card.range)}
      {row("SPEED", card.speed != null ? card.speed + " m/s" : null)}
      {row("PRICE", price != null ? "◆" + price : null)}
      <div style={{ marginTop: 8, fontSize: 10, letterSpacing: 1, opacity: 0.7 }}>SKILLS</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
        {card.skills.map((s) => <span key={s} style={{ fontSize: 10, letterSpacing: 1, border: "1px solid #2c3846", borderRadius: 4, padding: "2px 6px", color: "#ffd27a" }}>{s}</span>)}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        {door === "manifest" ? (
          <>
            <button data-info-confirm style={{ ...B, flex: 1, borderColor: "#4aff8c", color: "#4aff8c", opacity: armed ? 1 : 0.5 }} onClick={onConfirm}>CONFIRM PICK</button>
            <button data-info-cancel style={{ ...B, borderColor: "#ff6b5e", color: "#ff6b5e" }} onClick={onCancel}>✗</button>
          </>
        ) : (
          <button data-info-close style={{ ...B, flex: 1 }} onClick={onCancel}>CLOSE</button>
        )}
      </div>
    </div>
  );
}
```

**Step 3 — DepotGame wiring.**

- Imports: `import InfoCard from "./InfoCard.jsx";` beside the Dispatch import; `import { cardFor } from "./infocards.js";` with the depot imports.
- The S literal (beside `heroArm: null,`) gains: `infoKey: null, infoDoor: null, infoArmedAt: 0,`.
- Beside `S.pickManifest` (line ~2278), add:

```js
      // P7.1 T4: THE INFO CARD — two doors, one state. The manifest door's
      // CONFIRM runs the real pick (its own arming and stale-offer guards
      // intact); the card adds its own trailing-tap arm on top.
      S.openInfo = (key, door) => { S.infoKey = key; S.infoDoor = door; S.infoArmedAt = world.t + PENDING_ARM_S; };
      S.closeInfo = () => { S.infoKey = null; S.infoDoor = null; };
      S.confirmInfo = () => {
        if (world.t < S.infoArmedAt) { toast("HOLD — ARMING"); return; }
        const k = S.infoKey;
        S.closeInfo();
        if (k) S.pickManifest(k);
      };
```

- The manifest offer button (line 3684): its `onClick` becomes `onClick={() => { const S = stateRef.current; if (S && S.openInfo) S.openInfo(key, "manifest"); }}` — the card is now the gate; nothing else on the button changes.
- The bar palette slot (line ~3894): the slot's outer div style gains `position: "relative"`, and inside it (first child) add:

```jsx
                <div data-info={p.key} onClick={(e) => { e.stopPropagation(); const S = stateRef.current; if (S && S.openInfo) S.openInfo(p.key, "bar"); }}
                  style={{ position: "absolute", top: 0, right: 2, fontSize: 12, opacity: 0.65, padding: "2px 4px", cursor: "pointer" }}>ⓘ</div>
```

- The hud tick gains (beside `manifest:`): `info: S.infoKey ? { key: S.infoKey, door: S.infoDoor, armed: world.t >= S.infoArmedAt } : null,`.
- Render, directly after the manifest card block (~3700):

```jsx
      {hud.info && !hud.gameOver && !hud.victory && (
        <InfoCard card={cardFor(hud.info.key)} door={hud.info.door} armed={hud.info.armed}
          price={hud.prices?.[hud.info.key] ?? PALETTE_BY_KEY[hud.info.key]?.cost}
          onConfirm={() => { const S = stateRef.current; if (S && S.confirmInfo) S.confirmInfo(); }}
          onCancel={() => { const S = stateRef.current; if (S && S.closeInfo) S.closeInfo(); }} />
      )}
```

**Step 4 — the asserts.** Append to `scripts/tests/10-command-refit.mjs` (imports gain `CARDS, cardFor` from `../../src/depot/infocards.js` and `SATCHEL` on the specs line):

```js
// ---- P7.1 T4: the info cards tell the truth
{
  const want = ["mg", "gun", "mortar", "rocket", "frost", "sq_sniper", "sq_rifles", "sq_mg", "sq_sappers", "sq_mortars", "sq_engineers", "sq_runners", "sq_breakers", "hero_bison", "hero_apc"];
  ok("T4: every buyable has a card", want.every((k) => !!cardFor(k)));
  ok("T4: the rifle card matches its spec", CARDS.sq_rifles.hp === 58 && CARDS.sq_rifles.dmg === INFANTRY_ARMS.rifles.dirDmg && CARDS.sq_rifles.range === INFANTRY_ARMS.rifles.range && CARDS.sq_rifles.n === 4);
  ok("T4: the gun tower card matches its spec", CARDS.gun.hp === TOWER_SPECS.gun.hp && CARDS.gun.dmg === TOWER_SPECS.gun.dmg && CARDS.gun.range === TOWER_SPECS.gun.range);
  ok("T4: tool squads carry no patrol skill", !CARDS.sq_engineers.skills.includes("PATROL") && !CARDS.sq_sappers.skills.includes("PATROL"));
  ok("T4: the sapper card carries the satchel's damage", CARDS.sq_sappers.dmg === SATCHEL.dmg);
  ok("T4: the hulls' cards match their specs", CARDS.hero_bison.hp === BISON.hp && CARDS.hero_apc.hp === APC.hp && CARDS.hero_apc.skills.includes("LOAD / UNLOAD"));
}
```

**Step 5 — version.** `src/version.js`: `mk1.64` → `mk1.65`. Build AFTER the bump.

## Gates — run ONLY these

1. `node scripts/depot-test.mjs` — 1413 passed / 0 failed (the six T4 asserts; zero other movement).
2. `node scripts/smoke.mjs` — preview pattern, all green, mark mk1.65 (smoke never drives the manifest — boot unaffected).
3. `node scripts/depot-lint.mjs` — clean.

Green → commit `src/depot/infocards.js`, `src/depot/InfoCard.jsx`, `src/depot/DepotGame.jsx`, `scripts/tests/10-command-refit.mjs`, `src/version.js` — subject "the convoy shows its papers: info cards (mk1.65)" — standing trailers, push.

## Report requirements

Read-confirmation (eight items), one outcome line, bullets per step and gate with counts, commit hash. Every deviation its own labeled bullet. The card's look on both platforms, both doors, is the owner's acceptance.
