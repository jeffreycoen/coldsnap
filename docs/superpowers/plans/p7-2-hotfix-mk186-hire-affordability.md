# P7.2 Hotfix — The Hire Answers Its Price (mk1.86)

*HISTORY (stamped 2026-08-20, owner's order): this document is a record of shipped work, not authority. Design truth lives in CLAUDE.md and the ACTIVE phase's plan documents; where this file disagrees with them, it is wrong.*

**Suggested model: Sonnet** (interface-side, three files, fully specced).
**The defect (diagnosed live, 2026-08-20, repro `.superpowers/diag-hire-kinds.mjs`):** hires arm regardless of affordability, and the price check sits at the LAST step. A Bison hire at bell one (live price 200+, till ~126) walks the whole ceremony — info card, CONFIRM HIRE, ground tap, armed ghost, ✓ — then dies on a two-second "NO SCRAP" toast that also clears the armed hire, the ghost, and the ticker, with the hand window left closed. No scrap ever moves (verified to the digit) — but on a phone it reads exactly as "can't place, and it tried to charge me." Squad hires with a sufficient till work end to end on both platforms (verified).

**The fix, ruled shape:** affordability is checked FIRST and the refusal path stands its ground. Phone AND desktop by construction (shared DOM).

## Required reading (verified against the mk1.85 tree; re-verify at dispatch)

- `src/depot/DepotGame.jsx` — 2484–2540 (armHire and placeHire whole), 3977–3986 (the InfoCard render site), 1575–1586 (HUD0's `resources` mirror — confirm the hud field name before wiring the afford prop).
- `src/depot/InfoCard.jsx` — whole (53 lines).
- `scripts/tests/11-hiring-hall.mjs` — whole (the T2(e7) pin `/CONFIRM HIRE/` must stay green — the literal survives in the new button text's affordable branch).

## The steps

**Step 1 — the failing asserts.** Append to `scripts/tests/11-hiring-hall.mjs`:

```js
// ---- P7.2 HOTFIX mk1.86: THE HIRE ANSWERS ITS PRICE — refused up front, never a dead flow
{
  const src = fs.readFileSync("src/depot/DepotGame.jsx", "utf8");
  ok("HF(a): armHire refuses an unaffordable hire up front — the card stays, the hand stays open",
    /S\.armHire = \(key\) => \{[\s\S]{0,900}if \(S\.resources < price\) \{ toast\("NO SCRAP — ◆" \+ price \+ " TO HIRE"\); return; \}[\s\S]{0,120}S\.hirePlace = \{ key \};/.test(src));
  ok("HF(b): a ✓ refusal keeps the armed hire and the ghost — the GROUND NOT HELD precedent",
    !/toast\("NO SCRAP"\); S\.hirePlace = null;/.test(src));
  ok("HF(c): a fielded hire reopens the hand while cards remain — multi-buy stays one visit",
    /S\.hirePlace = null;\n\s+if \(S\.manifest && S\.manifest\.hand\.length && S\.openManifest\) S\.openManifest\(\);/.test(src));
  ok("HF(d): the card door passes the till's own verdict", /afford=\{hud\.info\.door === "hire" \? /.test(src));
  const ic = fs.readFileSync("src/depot/InfoCard.jsx", "utf8");
  ok("HF(e): CONFIRM HIRE greys and names the shortfall when the till can't cover it",
    /afford === false \? "NO SCRAP — ◆" \+ price : "CONFIRM HIRE"/.test(ic) && /disabled=\{afford === false\}/.test(ic));
}
```

Five checks. Expected suite after all steps: **1559/0** (1554 + 5). Run the suite now: RED on this block with the 1554 unmoved — the failing-first proof.

**Step 2 — the up-front gate.** `src/depot/DepotGame.jsx`, armHire (line 2484) becomes:

```js
      S.armHire = (key) => {
        const M = S.manifest;
        if (!M || performance.now() / 1000 < (M.armedAtWall ?? 0)) { toast("HOLD — ARMING"); return; }
        if (!M.hand.some((c) => c.k === key && c.hire === 1)) return;
        // P7.2 HOTFIX mk1.86 (owner): AFFORDABILITY IS CHECKED FIRST — a hire
        // the till can't cover is refused here, before any ceremony: the card
        // stays in the hand, the window stays open, and the toast names the
        // price. Found live: a Bison hire armed at bell one and died at the
        // last step's tiny toast after the whole ghost dance.
        const price = priceNow(key, (PALETTE_BY_KEY[key] || { cost: 10 }).cost);
        if (S.resources < price) { toast("NO SCRAP — ◆" + price + " TO HIRE"); return; }
        S.hirePlace = { key };
        M.cardUp = false; // the window steps aside for the placement tap
        toast("PLACE THE HIRE — tap held ground");
      };
```

**Step 3 — the refusal stands; the hand returns.** `src/depot/DepotGame.jsx`, placeHire:
- The price check (line 2498) becomes:

```js
        if (S.resources < price) { toast("NO SCRAP"); return; } // P7.2 HF mk1.86: the ghost STANDS (the GROUND NOT HELD precedent) — prices breathe by the second; ✗ still returns the card
```

- The success tail (lines 2533–2536) becomes:

```js
        takeHandCard(S.manifest, key, 1);
        S.resources -= price;
        S.hirePlace = null;
        if (S.manifest && S.manifest.hand.length && S.openManifest) S.openManifest(); // P7.2 HF mk1.86 (owner): multi-buy is one visit — the hand returns for the next card (the calm window returns with it, the ruled pause of an open hand)
        cue("uitick");
        toast("THE HIRE FIELDS — ◆" + price);
      };
```

**Step 4 — the greyed door.** `src/depot/InfoCard.jsx`:
- The signature (line 8) gains the prop: `export default function InfoCard({ card, price, armed, door, portrait, onConfirm, onCancel, afford }) {`
- The hire door's confirm button (line 42) becomes:

```js
            <button data-info-hire disabled={afford === false} style={{ ...B, flex: 1, borderColor: afford === false ? "#48515f" : "#7dffa8", color: afford === false ? "#8a93a1" : "#7dffa8", opacity: armed && afford !== false ? 1 : 0.5, cursor: afford === false ? "default" : "pointer" }} onClick={onConfirm}>{afford === false ? "NO SCRAP — ◆" + price : "CONFIRM HIRE"}</button>
```

(the ✗ beside it is untouched; every other door passes no `afford` and is byte-identical.)

**Step 5 — the verdict wire.** `src/depot/DepotGame.jsx`, the InfoCard render site (line 3977): after `armed={hud.info.armed}` add:

```js
          afford={hud.info.door === "hire" ? hud.resources >= ((hud.prices?.[hud.info.key] ?? PALETTE_BY_KEY[hud.info.key]?.cost) || 0) : undefined}
```

(the hud's scrap mirror is `resources` — HUD0's own field; confirm the name against the live hud snapshot before wiring, and STOP if it differs.)

**Step 6 — the gates and the deploy.** In order: `node scripts/depot-test.mjs` — expected **1559/0** (1554 unmoved — T2(e7)'s `/CONFIRM HIRE/` pin survives in the affordable branch; any movement = stop); `node scripts/depot-lint.mjs` clean; keystone 843448507/749 unmoved (no sim touch — movement = stop); bump `src/version.js` to `mk1.86` BEFORE `npm run build`; smoke (stale 4173 stays; preview 4174 + SMOKE_URL; kill only yours) green at mk1.86; then re-run the diagnosis repro `node .superpowers/diag-hire-kinds.mjs` against the FRESH build (it serves dist) — the Bison hire must now refuse AT THE CARD (greyed button or up-front toast), not at the ✓. Gates green → `git add` the touched files → commit subject exactly `the hire answers its price (mk1.86)` → push.

## Trap notes

- armHire's refusal must NOT touch `M.cardUp` — the hand window staying open IS the fix's second half.
- placeHire's late price check is kept deliberately (prices reprice every second between arm and ✓) — only the `S.hirePlace = null` clear leaves it.
- The reopened hand re-engages the calm window's pause — that is the ruled behavior of an open hand, not a new mechanism. Name it in the report, do not "fix" it.
- The 11-hiring-hall T2(e5) pin (`takeHandCard...S.resources -= price`) must stay green — Step 3's tail keeps those two lines adjacent and untouched.
- No edits to state.js, bell.js, market.js, engine, renderer. No sim-side change of any kind.

## The owner's live check

- An unaffordable hire refuses at the card: the button greys and names the price; the hand stays up; nothing arms, nothing vanishes.
- An affordable hire flows as before — and when it fields, the hand comes back on its own for the next card.
- A refusal at the ✓ (price climbed mid-dance) leaves the ghost and ✗ standing.

## Report requirements

No new fixture seeds (source-pin checks only — say so). Suite count to the digit; keystone stated; the repro's fresh-build result stated. Every deviation its own labeled bullet — none stated as none.
