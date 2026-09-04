# TASK 6 — THE ON-DEMAND DOOR (mk2.44)

Design: `tutorial-cards-and-launch-design.md`. Any teaching card can be looked up again after its first encounter: hold a control and its card opens. No pause, no seen-marking — a lookup, not a lesson.

**Suggested model: Sonnet** — every edit is in this plan.

## One deviation from the design ruling, for your word at approval

The ruling was "long-press on phone, hover-ⓘ on desktop." This plan makes the **long-press work on both platforms everywhere** (a mouse held 450 ms), and adds the visible ⓘ affordance **on desktop radial wedges only**. Reason: the top-bar chips are small and already carry hover tooltips — a permanent ⓘ on each is clutter, and an appear-on-hover ⓘ is a whole hover-state layer for eight buttons. If you want the hover-ⓘ everywhere regardless, say so and this plan gets an amendment.

## The mechanism

- One helper, `teachPress(key)`, returns pointer props: hold 450 ms → the card opens through the existing `S.openInfo(key, "bar")` (the market-card door — plain CLOSE, no pause, nothing marked seen); the release's click is swallowed so the control does not also activate. Press state lives in a ref keyed by card key, so the 8 Hz interface refresh cannot strand a timer.
- `cardFor` already reads TEACH first (Task 1), so `openInfo` serves teaching cards today; two small fixes make it correct: the phone voice substitutes at the info render, and teaching cards get no portrait (the portrait painter knows only buyables).
- Radial wedges gain a `card` key; the wedge takes the same long-press, and on desktop draws a small ⓘ outside its label that opens the card on click.

## Card assignments (control → card)

Top bar: scrap chip → `scrap`; bell chip → `bell`; score chip → `kill_price`; FOG → `fog`; WIND → `wind`; SPARE OURS → `spare_ours`. Build bar: BUILD crate → `market`; SELL tag → `sell`. Squad pie: DEFEND/MOVE/ATTACK/TAKE CONTROL/SELECT ALL/PATROL/STRUCTURES → `defend`/`move`/`attack`/`possess_squad`/`select_all`/`patrol`/`structures`; BAGS and WALLS → `engineer_lines`; MINES and WIRES → `sapper_lines`. Tower pie: CAREFUL-FREE → `discipline`; TAKE CONTROL → `possess_tower`; SELL → `sell`. Hull pie: DEFEND/MOVE/PATROL → the shared cards; ESCORT → `escort`; TRACKS → `tracks`; TAKE CONTROL → `possess_vehicle` (`possess_mech` when the hull is a mech); LOAD and UNLOAD → `load`. Lattice tags keep their existing market-ⓘ untouched. HEALTH, pause, speed, mute, rotate, MENU: bare, per the ruled map.

## Required reading (read-confirmation opens the report)

1. This plan.
2. `src/depot/DepotGame.jsx` lines 700–760 (RadialMenu), 4670–4740 (top bar), 4820–4870 (info + teach renders), 4890–5045 (the three pies), 5070–5110 (build bar).
3. `src/depot/cards.js` (all).
4. `scripts/tests/25-the-teaching-cards.mjs` (all).

## Steps

### Step 1 — failing asserts first: append to era 25

```js
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
```

Run `node scripts/gate.mjs depot-test` — the five FAIL. Record the PASS count.

### Step 2 — the helper (component level, after `sellInspected`, ~line 4448)

```js
  // Task 6 (mk2.44): THE ON-DEMAND DOOR — hold a carded control 450ms and
  // its card opens through the market-card door (no pause, nothing marked
  // seen); the release's click is swallowed. Press state rides a ref keyed
  // by card, so the 8Hz interface refresh can't strand a timer.
  const lpRef = useRef({});
  const teachPress = (k) => ({
    onPointerDown: () => { const o = lpRef.current[k] = lpRef.current[k] || {}; o.fired = false; o.t = setTimeout(() => { o.fired = true; const S = stateRef.current; if (S && S.openInfo) S.openInfo(k, "bar"); }, 450); },
    onPointerUp: () => { const o = lpRef.current[k]; if (o && o.t) clearTimeout(o.t); },
    onPointerLeave: () => { const o = lpRef.current[k]; if (o && o.t) clearTimeout(o.t); },
    onPointerCancel: () => { const o = lpRef.current[k]; if (o && o.t) clearTimeout(o.t); }, // phones cancel pointers (gestures, second fingers) — a cancelled press must not open the card
    onClickCapture: (e) => { const o = lpRef.current[k]; if (o && o.fired) { o.fired = false; e.preventDefault(); e.stopPropagation(); } },
  });
```

### Step 3 — `RadialMenu` learns the card (line 706)

Signature becomes:

```js
function RadialMenu({ cx, cy, label, slots, armed, onChoose, press, onCard, showInfo }) {
```

The wedge `g` (the element carrying `data-radial={s.key}`) gains the press props — its opening becomes:

```jsx
          <g key={s.key} data-radial={s.key} style={{ pointerEvents: "auto", cursor: "pointer" }} onClick={() => { s.act(); onChoose && onChoose(); }} opacity={armed ? 1 : 0.5} {...(s.card && press ? press(s.card) : {})}>
```

After the label `<text>` pair (and before the toggle-slider block), the desktop ⓘ:

```jsx
            {s.card && showInfo && (
              <text data-wedge-info={s.card} x={lx} y={ly + 26} textAnchor="middle" fontSize="11" fill="#9fdcff" stroke="#0e1218" strokeWidth="3" paintOrder="stroke" style={{ cursor: "pointer" }}
                onClick={(e) => { e.stopPropagation(); onCard && onCard(s.card); }}>ⓘ</text>
            )}
```

Note: a toggle wedge's slider also sits at `ly + 17..27` — on slots carrying BOTH `toggle` and `card` (STRUCTURES, TRACKS) the ⓘ would overlap the slider; for those two the ⓘ draws at `ly - 22` instead. Implement as: `y={s.toggle != null ? ly - 22 : ly + 26}`.

### Step 4 — the three pie call sites

Each `<RadialMenu ...>` call gains three props:

```jsx
press={teachPress} showInfo={!isTouch} onCard={(k) => { const S = stateRef.current; if (S && S.openInfo) S.openInfo(k, "bar"); }}
```

And the slot arrays gain `card:` fields per the assignment table:

- Squad pie (line 4896): `defend` → `card: "defend"`, `move` → `card: "move"`, `attack` → `card: "attack"`, `possess` → `card: "possess_squad"`, `select_all` → `card: "select_all"`, `patrol` → `card: "patrol"`, `structures` → `card: "structures"`, `build_bags` and `build_walls` → `card: "engineer_lines"`, `build_mines` and `build_wires` → `card: "sapper_lines"`.
- Tower pie (line 4976): `discipline` → `card: "discipline"`, `possess` → `card: "possess_tower"`, `sell` → `card: "sell"`.
- Hull pie (line 5018): `defend` → `card: "defend"`, `move` → `card: "move"`, `patrol` → `card: "patrol"`, `escort` → `card: "escort"`, `tracks` → `card: "tracks"`, `possess` → `card: vr.kind === "mech" ? "possess_mech" : "possess_vehicle"`, `load` and `unload` → `card: "load"`.

### Step 5 — the top-bar and build-bar presses

- Scrap chip (line 4672): `<div style={P.stat} {...teachPress("scrap")}>`…
- Bell chip (line 4674): the `div data-bell` gains `{...teachPress("bell")}`.
- Score chip (line 4681): gains `{...teachPress("kill_price")}`.
- FOG button (line 4718, the one calling `toggleFog`): gains `{...teachPress("fog")}`.
- WIND button (line 4725): gains `{...teachPress("wind")}`.
- SPARE OURS button (line 4728): gains `{...teachPress("spare_ours")}`.
- BUILD crate (line 5076, `CrateChip data-build-toggle`): gains `{...teachPress("market")}` (CrateChip spreads unknown props onto its root).
- SELL tag (line 5100, `StockTag data-sell-toggle`): gains `{...teachPress("sell")}` (StockTag spreads too).

HEALTH, pause, speed, rotate, mute, MENU take nothing — bare per the ruled map.

### Step 6 — the lookup render fixes (line 4825)

The `hud.info` InfoCard's two props change:

```jsx
        <InfoCard card={(() => { const c = cardFor(hud.info.key); return c && isTouch && c.roleTouch ? { ...c, role: c.roleTouch } : c; })()} door={hud.info.door} armed={hud.info.armed}
```

and the portrait prop becomes:

```jsx
          portrait={TEACH[hud.info.key] ? undefined : (cv) => renderPortrait(cv, hud.info.key)}
```

### Step 6b — AMENDMENT 1 (owner, 2026-08-25): one licensed re-teach

`scripts/tests/10-command-refit.mjs:403` ("T10: the game wires the painter to the card") pins the literal portrait-wiring line Step 6 changes. Re-teach the pin to the new literal — the asserted behavior (the painter is wired to the card) is unchanged; the pin gains the teaching-card skip: old `/portrait=\{\(cv\) => renderPortrait\(cv, hud\.info\.key\)\}/` → new `/portrait=\{TEACH\[hud\.info\.key\] \? undefined : \(cv\) => renderPortrait\(cv, hud\.info\.key\)\}/`. Old→new reported. No other test moves.

### Step 7 — gates

- `node scripts/gate.mjs depot-test` — green, +5 over Step 1.
- `node scripts/gate.mjs depot-lint` — green.
- `node scripts/gate.mjs smoke` — green (no scripted flow long-presses anything; the click-swallow only engages after a 450 ms hold).

### Step 8 — the deploy

Bump `src/version.js` to `mk2.44`; build after the bump; commit ("the teaching cards — the on-demand door, mk2.44"); push. The owner's live check — hold a wedge on phone, hover a wedge's ⓘ on desktop — is the acceptance.

## Report

Read-confirmation, one line of outcome, PASS counts before/after, gates and verdicts, commit hash, seeds (smoke's pinned 11; eras none). Every nonconformity its own labeled bullet.
