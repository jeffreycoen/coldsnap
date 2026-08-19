# P7 Task 23 — the manual learns the ground, and the tour returns (mk1.5X)

*2026-08-18. Two owner-ordered documentation items that are code: THE MINES CARD — mines and tripwires shipped at mk1.40 with no card; the tour teaches them now — and THE PHASE-CHANGE RE-SHOW (pulled from Polish II on the owner's "fully"): the don't-show-again flag becomes a manual REVISION STAMP, so when a phase changes the cards, the tour greets every player once more — including those who ticked never — then honors the tick again until the next revision. Interface work: the manual is one overlay on phone and desktop alike. The mark: the next sequential +0.01 at landing (mk1.53 if this lands before the README rewrite, mk1.54 after — sequential, never skipped).*

**Suggested model: Sonnet** — small, fully specced.

**Scope:** `src/ui/FieldManual.jsx`, `src/depot/DepotGame.jsx`, `scripts/tests/09-reorg.mjs` (the current era file), `src/version.js`. Nothing else.

## The card copy (the owner's approval of this plan approves these words — FieldManual.jsx's header requires a ruling to edit)

New card, inserted at index 4 — after YOUR ARMOR, before THE BELL:

```js
  { title: "THE GROUND BITES", body: "Sappers lay mines and tripwires along a tapped line. Yours are invisible to them; theirs to you — always. A tripwire's flare lights the fog. A mine just waits. Minefields are learned by loss, both ways." },
```

## Required reading, in order (verify anchors before code)

1. `src/ui/FieldManual.jsx` whole (43 lines) — the CARDS table, the do-not-edit header, the onClose(never) contract.
2. `src/depot/DepotGame.jsx` 45 (`MANUAL_KEY`), 728–742 (the first-entry gate and `closeManual`), 3864 and 3871 (the reopen button and the mount — read-only, unchanged).
3. `scripts/tests/09-reorg.mjs` — the block end (insertion point); and grep ALL era files for pins on the CARDS table (the mk1.41 armor-card assert pins the card order — it is this task's one known re-teach).
4. `scripts/smoke.mjs` manual section (~219–229) — presence/skip checks only; verify no card-count pin (none existed at mk1.41; confirm still true).

## Trap notes

- **The copy is byte-fixed by this plan** — the card above lands verbatim; the six existing cards' text does not change by one character.
- **Legacy honor:** the stored value today is the string `"off"`. It maps to revision 1 — so every player who ever ticked never gets the tour exactly ONCE more (the new revision), which IS the owner's re-show ruling, not a bug. State this in the report.
- **KNOWN RE-TEACH (named in advance):** the mk1.41 manual assert (in whichever era file carries the T11 block) pins the armor card "after TAKE CONTROL, before THE BELL" — the new chain is REAL STONE → YOUR MEN → TAKE CONTROL → YOUR ARMOR → THE GROUND BITES → THE BELL → THE MARKET → THE FALL; the assert re-teaches to it, old → new reported. Anything ELSE failing is a STOP.
- **The reopen button and the resumed-war suppression are untouched** — only the gate's comparison and the close's write change.

## Steps

**Step 1 — the failing asserts land first.** In `scripts/tests/09-reorg.mjs`, appended at the block end (this era file takes new work, always as part of the file's own flow — no runner change):

```js
// ==== P7 T23: THE MANUAL LEARNS THE GROUND; THE TOUR RETURNS =================
{
  const fmSrc23 = /* the suite's source-read idiom, ../../src/ui/FieldManual.jsx */;
  const dgSrc23 = /* ../../src/depot/DepotGame.jsx */;
  ok("T23(a): the mines card exists, verbatim, at its ruled seat",
    /\{ title: "THE GROUND BITES", body: "Sappers lay mines and tripwires along a tapped line\. Yours are invisible to them; theirs to you — always\. A tripwire's flare lights the fog\. A mine just waits\. Minefields are learned by loss, both ways\." \},/.test(fmSrc23));
  ok("T23(a2): the chain is eight cards in the ruled order",
    /YOUR ARMOR[\s\S]*?THE GROUND BITES[\s\S]*?THE BELL[\s\S]*?THE MARKET[\s\S]*?THE FALL/.test(fmSrc23) &&
    (fmSrc23.match(/\{ title: "/g) || []).length === 8);
  ok("T23(b): the manual carries its revision stamp", /export const MANUAL_REV = 2;/.test(fmSrc23));
  ok("T23(b2): the gate compares revisions and honors the legacy tick once",
    /r\.value === "off" \? 1 : parseInt\(r\.value, 10\)/.test(dgSrc23) && /seen >= MANUAL_REV/.test(dgSrc23));
  ok("T23(b3): the tick stores the revision it was ticked at", /window\.storage\.set\(MANUAL_KEY, String\(MANUAL_REV\)\)/.test(dgSrc23));
}
// ==== end P7 T23 =============================================================
```

Run the suite — T23 fails. Report the failing output.

**Step 2 — the manual learns.** In `src/ui/FieldManual.jsx`: the new card inserted at index 4, verbatim from this plan; and above CARDS:

```js
// THE REVISION STAMP (P7 T23, owner): bumped whenever a phase changes the
// cards — the tour then greets everyone once more, ticked-never included,
// and honors the tick again until the next bump. Rev 1 = the pre-stamp era.
export const MANUAL_REV = 2;
```

**Step 3 — the gate learns revisions.** In `src/depot/DepotGame.jsx`: `MANUAL_REV` joins the FieldManual import (line 36); the first-entry gate (734) becomes:

```js
      try {
        const r = await window.storage.get(MANUAL_KEY);
        const seen = r ? (r.value === "off" ? 1 : parseInt(r.value, 10) || 0) : 0;
        if (live && !(seen >= MANUAL_REV)) setManualOpen(true);
      }
      catch (e) { if (live) setManualOpen(true); }
```

and `closeManual`'s write (741) becomes:

```js
    if (never) { try { window.storage.set(MANUAL_KEY, String(MANUAL_REV)); } catch (e) {} }
```

**Step 4 — the known re-teach.** ~~The mk1.41 card-order assert re-teaches to the eight-card chain.~~ STRUCK BY AMENDMENT 1: no such assert exists — the plan-writer inferred it from the mk1.41 gap analysis, which verified the card by reading the file directly; no suite pin on the CARDS table was ever landed (proven by the agent across the current suite and full git history). Step 4 is now: confirm no CARDS pin exists anywhere (already done at required reading) — ZERO re-teaches expected; ANY pin failing is a STOP.

*(Amendment 1, 2026-08-19, after the agent's honest stop — the trap note's "one known re-teach" is struck with it; everything else stands as written.)*

**Step 5 — gates.** `node scripts/depot-test.mjs`, `node scripts/depot-lint.mjs`, the build, `node scripts/smoke.mjs`. Nothing else. Golden does NOT run.

**Step 6 — the landing.** Bump `src/version.js` to the next sequential mark. Build AFTER the bump. Commit: `the manual learns the ground; the tour returns each phase (mk1.5X)` with the real mark. Push. Report: read-confirmation opening, gate results, the one re-teach old → new, every deviation labeled. The owner's eyes accept the card live.
