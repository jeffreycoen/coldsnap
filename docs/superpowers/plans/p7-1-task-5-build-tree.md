# P7.1 Task 5 — The build tree (mk1.67)

*HISTORY (stamped 2026-08-20, owner's order): this document is a record of shipped work, not authority. Design truth lives in CLAUDE.md and the ACTIVE phase's plan documents; where this file disagrees with them, it is wrong.*

The flat build bar collapses into ONE entry. BUILD opens the tree: three branch buttons — TROOPS / BUILDINGS / VEHICLES — plus SELL inside it (ruled); tapping a branch shows that branch's slots, exactly today's slots (price, ⓘ, the two-tap hero arm) unchanged. A branch stays open for repeat placement (ruled); tapping the active type slot still clears it (the standing toggle-off); tapping BUILD again closes the whole tree back to plain command. A manifest pick still arms the bar through the tree (the mk1.47 law): the mode arms immediately, the closed BUILD button names the armed type, and the tree opens on the right branch. Presentation only — `setMode`, `toggleSell`, the pick, the pending flow, and every price read are untouched underneath. One DOM: phone and desktop both, by construction.

**Rulings executed here** (decision record, 2026-08-19): the tree with SELL inside; branches stay open; toggle-off kept; pick-arms-the-bar preserved.

**Suggested model:** Sonnet — a JSX reshape of one block plus four small additions, fully written below.

## Stated lines

- Branch grouping: TROOPS = the `sq_` keys; BUILDINGS = the tower keys; VEHICLES = the `hero_` keys. A branch with nothing unlocked does not render (a fresh war opens with TROOPS alone; BUILDINGS appears with the first tower pick; VEHICLES at the hero tier).
- SELL is a branch-level button (it toggles sell mode, not a sub-list), rendered only while the tree is open.
- Closing the tree clears mode, pending, half-given lines, and sell — the same clears `setMode`'s toggle-off performs, through one helper.
- The sim never sees the tree: `buildOpen`/`branch` are React state; `S.mode` remains the one truth the tap layer reads. `__DEPOTBUILD__` and every debug hook bypass the bar exactly as before.
- No tests move (the bar has no pins — grep-verified at plan time). Suite stays 1416/0.

## Required reading, in order

1. This plan, whole.
2. `src/depot/DepotGame.jsx:671-720` — PALETTE / PALETTE_BY_KEY / PALETTE_LABEL (the grouping's ground truth).
3. `src/depot/DepotGame.jsx:724-746` — the component's useState block (the tree state's home).
4. `src/depot/DepotGame.jsx:2306-2316` — S.pickManifest's auto-arm tail.
5. `src/depot/DepotGame.jsx:3380-3400` — setMode / toggleSell.
6. `src/depot/DepotGame.jsx:3510-3516` — the `palette` unlocked filter.
7. `src/depot/DepotGame.jsx:3915-3950` — the bar block this task replaces (slots + SELL).
8. `src/depot/DepotGame.jsx:600-621` — P.bar / P.slot styles (reused, not edited).

## Trap notes

- The slot JSX (data-tower-key div, ⓘ badge, icon, label, price) moves VERBATIM inside the branch filter — not one attribute changes; the T4 ⓘ door and the audit's habits ride along untouched.
- `setMode` gains ONLY the branch-follow line in its arming tail — its hero branch, toggle-off branch, and clears stay byte-identical.
- Do not edit `P.slot`/`P.bar` — new buttons spread the shared style with their own overrides.
- The BUILD button must render even while the tree is open (it is the CLOSE door) and must never render during possession/end states (the existing bar gate covers it — the whole block is inside it).
- No sim, engine, renderer, or test edits anywhere. `src/version.js` is the only file beyond DepotGame.jsx.
- THE UNFURL uses `backwards` fill, never `both` — a `both` fill pins the keyframe's final opacity and would erase the can't-afford dimming (0.45) after the animation ends. All timing dials provisional (F5).

## Steps

**Step 1 — module scope: the branches.** Directly under `PALETTE_LABEL` (line 717), add:

```js
// P7.1 T5: THE BUILD TREE — one BUILD entry, three branches, SELL inside.
// Pure presentation: S.mode stays the single truth the tap layer reads.
const TREE_BRANCHES = [
  { key: "troops", label: "TROOPS", icon: "∴", match: (k) => k.startsWith("sq_") },
  { key: "buildings", label: "BUILDINGS", icon: "⌂", match: (k) => TOWER_SPECS[k] != null },
  { key: "vehicles", label: "VEHICLES", icon: "⛨", match: (k) => k.startsWith("hero_") },
];
const branchOf = (key) => { const b = TREE_BRANCHES.find((x) => x.match(key)); return b ? b.key : null; };
```

**Step 2 — component state.** Beside the `manualOpen` useState (line ~729), add:

```js
  // P7.1 T5: the tree's presentation state — never the sim's business.
  const [buildOpen, setBuildOpen] = useState(false);
  const [branch, setBranch] = useState("troops");
```

**Step 3 — the close door.** Beside `toggleSell` (line ~3395), add:

```js
  // P7.1 T5: closing the tree clears back to plain command — the ruled
  // toggle-off, one door for mode, pending, half-given lines, and sell.
  const closeBuild = () => {
    setBuildOpen(false);
    const S = stateRef.current; if (!S) return;
    if (S.linePending && S.rejectLine) S.rejectLine();
    S.mode = null; S.pending = null; S.buildPt0 = null; S.sellMode = false;
    setHud((h) => ({ ...h, mode: null, sellMode: false }));
  };
```

**Step 4 — the pick follows into the tree.** In `setMode`'s arming tail, directly after `setHud((h) => ({ ...h, mode: m, sellMode: false }));`, add:

```js
    // P7.1 T5: the pick arms the bar — the tree lands on the armed type's branch.
    const b = branchOf(m);
    if (b) setBranch(b);
```

**Step 5 — the bar block.** Replace the CONTENT of the bar's `<div style={P.bar}>` (line ~3916-3950: the `palette.map` slots and the SELL slot) with, in this order — BUILD, branches, the open branch's slots, SELL. THE UNFURL (owner, 2026-08-19): every tree element rides a ~140ms slide-up-and-fade, staggered ~30ms left to right, so the tree ripples out of the BUILD button; a branch switch replays it on the incoming slots (they remount under new keys). Pure CSS — one keyframes tag, zero per-frame JavaScript. First, directly INSIDE the bar div's opening tag, add the keyframes once:

```jsx
          <style>{`@keyframes cs-unfurl { from { opacity: 0; transform: translateY(10px) scale(0.92); } to { opacity: 1; transform: none; } }`}</style>
```

and define the stagger helper just above the `return` of the component's bar section is NOT needed — the delay is computed inline per element as shown. The block:

```jsx
          <div data-build-toggle
            style={{ ...P.slot, borderColor: buildOpen ? "#4aff8c" : "#48515f", color: buildOpen ? "#4aff8c" : "#e6ebf1", minWidth: isTouch ? 64 : 60 }}
            onClick={() => {
              if (buildOpen) { closeBuild(); return; }
              const S = stateRef.current;
              const b = S && S.mode ? branchOf(S.mode) : null;
              if (b) setBranch(b);
              setBuildOpen(true);
            }}>
            <div style={{ fontSize: 16 }}>⚒</div>
            <div>{buildOpen ? "CLOSE" : "BUILD"}</div>
            <div style={{ color: "#ffd27a", fontSize: 10 }}>{!buildOpen && hud.mode ? (PALETTE_LABEL[hud.mode] || "") : " "}</div>
          </div>
          {buildOpen && TREE_BRANCHES.map((b) => palette.some((p) => b.match(p.key)) ? (
            <div key={b.key} data-branch={b.key}
              style={{ ...P.slot, minWidth: isTouch ? 64 : 60, borderColor: branch === b.key ? "#9fdcff" : "#48515f", color: branch === b.key ? "#9fdcff" : "#e6ebf1", animation: "cs-unfurl 0.14s ease-out backwards", animationDelay: (TREE_BRANCHES.indexOf(b) * 0.03) + "s" }}
              onClick={() => setBranch(b.key)}>
              <div style={{ fontSize: 16 }}>{b.icon}</div>
              <div>{b.label}</div>
              <div style={{ opacity: 0.6, fontSize: 10 }}>{palette.filter((p) => b.match(p.key)).length}</div>
            </div>
          ) : null)}
          {buildOpen && palette.filter((p) => { const b = TREE_BRANCHES.find((x) => x.key === branch); return b && b.match(p.key); }).map((p, pi) => {
            const sel = !hud.sellMode && hud.mode === p.key;
            const priceP = hud.prices?.[p.key] ?? p.cost;
            const afford = hud.resources >= priceP;
            return (
              <div key={branch + ":" + p.key} data-tower-key={p.key}
                style={{ ...P.slot, position: "relative", borderColor: sel ? "#4aff8c" : "#48515f", opacity: afford ? 1 : 0.45, minWidth: isTouch ? 56 : 52, animation: "cs-unfurl 0.14s ease-out backwards", animationDelay: (0.09 + pi * 0.03) + "s" }}
                onClick={() => setMode(p.key)}>
                <div data-info={p.key} onClick={(e) => { e.stopPropagation(); const S = stateRef.current; if (S && S.openInfo) S.openInfo(p.key, "bar"); }}
                  style={{ position: "absolute", top: 0, right: 2, fontSize: 12, opacity: 0.65, padding: "2px 4px", cursor: "pointer" }}>ⓘ</div>
                <div style={{ fontSize: 16 }}>{p.icon}</div>
                <div>{p.label}</div>
                <div style={{ color: "#ffd27a" }}>◆{priceP}</div>
              </div>
            );
          })}
          {buildOpen && (
            <div data-sell-toggle style={{ ...P.slot, borderColor: hud.sellMode ? "#ffb45e" : "#48515f", color: hud.sellMode ? "#ffb45e" : "#e6ebf1", minWidth: isTouch ? 56 : 52, animation: "cs-unfurl 0.14s ease-out backwards", animationDelay: "0.09s" }}
              onClick={toggleSell}>
              <div style={{ fontSize: 16 }}>✕</div>
              <div>SELL</div>
              <div style={{ opacity: 0.7 }}>60%</div>
            </div>
          )}
```

(The slot JSX inside the filter is today's block verbatim — including the T4 ⓘ badge; the SELL slot is today's verbatim with the `buildOpen &&` gate around it.)

**Step 6 — version.** `src/version.js`: `mk1.66` → `mk1.67`. Build AFTER the bump.

## Gates — run ONLY these

1. `node scripts/depot-test.mjs` — 1416 passed / 0 failed, zero movement (no test reads the bar).
2. `node scripts/smoke.mjs` — preview pattern, all green, mark mk1.67 (smoke never drives the bar; boot unaffected).
3. `node scripts/depot-lint.mjs` — clean.

Green → commit `src/depot/DepotGame.jsx`, `src/version.js` — subject "the bar becomes a tree (mk1.67)" — standing trailers, push.

## Report requirements

Read-confirmation (eight items), one outcome line, bullets per step and gate with counts, commit hash. Every deviation its own labeled bullet. The tree's look and flow — open, branch, place twice, toggle off, close, a bell pick landing on the right branch — is the owner's live acceptance, phone and desktop.
