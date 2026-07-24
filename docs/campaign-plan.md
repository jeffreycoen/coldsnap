# COLDSNAP — Campaign & Story Plan (draft for discussion)

Status: DRAFT — nothing here is built. Decision points are marked **[DECIDE]**
with a recommendation. Everything else follows from the buildout plan's
Phase 5 table plus the approved story direction (futuristic; the bureau
clears zones inhabited by androids; opens as pure physics fun; the reveal is
that the "units" had a society and human sympathizers; the true path is
minimal impact).

---

## 1. Where the campaign lives **[DECIDE]**

**Recommendation: a third start-screen option.** The start screen becomes:

    CLEARANCE PROGRAM      — the campaign (new, gold, top position)
    CONTRACT SANDBOX       — the proving grounds, as shipped today
    PROVING GROUNDS        — the frozen demo
    CONTROLS

Rationale: the sandbox is a shipped, save-carrying thing players know; the
campaign is a different world set (authored maps, one contract each). Fiction
seam: the sandbox IS the acceptance trials — the Bison passed, and the
campaign is what the bureau bought it for. WO-07's sheet-rating order
becomes retroactive foreshadowing (AC-08 mirrors it).

Alternative (not recommended): campaign replaces the sandbox's free-play
tail. Cheaper UI, but couples saves and forces campaign pacing onto a space
players use as a toy box.

Name **[DECIDE]**: "CLEARANCE PROGRAM" (recommended) / "FIELD CLEARANCE" /
"THE CAMPAIGN".

## 2. The campaign runner (engineering shape)

One generalized runner component, structurally the sandbox's trial runner
with the proving-grounds specifics moved into data:

- World: `buildScenario(spec, { shelters: true })` per contract — one JSON
  scenario file per contract, one contract per scenario.
- Contract block in the JSON (`spec.contract`): `wo, title, directive,
  commendation, predicate, need, par, volleyMode?, subjects` (the restock
  group — mandatory, so no contract can strand), `alt?` (deviation:
  `{group, holdS}`), `aar` (seed + authored evidence lines), `dress?`
  (android / mixed palette stage).
- Mechanics reused as-is: brief cards, matchKill, AAR compose + Form AA-7,
  deviation watch + UNFULFILLED — DEVIATION, subject restock, autosave.
- Storage: `coldsnap-camp-*` keys, fully separate from sandbox saves.
- CI: every campaign JSON goes through the completability harness
  (accept-with-intended-tactic, strand-proof via restock) + budget lint +
  double-load determinism. Content cannot ship strandable.

**Answer to the standing question: engine changes carry over automatically.**
The sandbox and the campaign share `src/engine/core.js` and the scenario
loader. Physics fixes (water, righting, knockback), restock, AAR, deviation —
all land once and both games get them. Only the frozen demo keeps the old
physics, by design: it is the museum piece.

## 3. The arc — eight contracts

Merged: buildout plan Phase 5 table × the approved reveal pacing
(toy box → dissonance via AAR evidence → flip). The bureau voice NEVER
changes register — the world under it does.

| # | Work order | Predicate | Deviation | Story surface |
|---|---|---|---|---|
| AC-01 | ARMOR PLATE ACCEPTANCE | `{causes:[PROJECTILE], group:"plate"}` — parked hulls & plate racks | — | Pure toy box. Targets are steel. Directive reads like a receiving dock. |
| AC-02 | BATTERY REDUCTION | `{group:"battery"}` — emplacements that shoot back | — | Still fun. First live "units" at distance, under tarps/hulls — nothing to notice yet. |
| AC-03 | CONVOY INTERDICTION | `{group:"convoy"}` — moving trucks, crews bail on foot | — | First time units RUN. Evidence line #1 in the AAR: "Recovered: 37 personal effects. Disposition: incinerate." |
| AC-04 | CROSSING DENIAL | `{group:"crossing"}` on a refrozen pond | disperse | Infrastructure as target — and the AAR notes the crossing was BUILT by the units. First deviation offer. |
| AC-05 | OUTBUILDING, OCCUPIED | `{causes:[COLLAPSE], group:"holdout"}` | — | The directive names the method. AAR carries the first marginalia in another hand — the carbon 2/3 seed pays out: someone keeps the originals. |
| AC-06 | THE CONVOY HAS STOPPED | `{group:"convoy2"}` — halted trucks, crews standing, not fighting | disperse | Dissonance peak. The target does nothing. The form voice does not change. |
| AC-07 | THE VILLAGE | `{causes:[COLLAPSE], group:"village"}` — garrisoned houses | disperse | The flip. Human figures among the androids. The AAR logs them in the same column: "Unregistered biologicals — disposition as per units." |
| AC-08 | SURFACE LOAD RATING, REPEAT | `{group:"ponddrill2"}` | disperse | The mirror of WO-07. Same sheet, same drill squad — and now the player knows what they are. Finale. |

**[DECIDE] 8 vs 7 contracts.** Earlier direction liked the 7-order shape;
the Phase 5 table is 8. Recommendation: keep 8 — AC-01 is the pure-toy-box
cold open the pacing needs, and the beats map cleanly: 1–3 toy box, 4–5
dissonance, 6–8 flip with the mirror finale. Trimming to 7 would cut AC-01
and start the game on live targets.

## 4. The reveal machinery

- **Visual-first**: androids are a palette/part swap in the table-driven
  INFANTRY dress spec (porcelain-to-gunmetal skin, seam accent at the
  joints). AC-01/02 hide it (distance, tarps); AC-03 shows it as crews bail;
  AC-07 mixes human-palette figures among android-palette ones. The player's
  eye learns the truth before any document admits it.
- **AAR evidence lines**: authored per contract in the JSON, injected into
  the Form AA-7 remarks. Inventory language doing story work — effects,
  repairs, gardens, a generator kept running. Never editorializes.
- **Document degradation**: from AC-05 the forms acquire marginalia in a
  second hand, then redactions; the stamps stay crisp. The bureau document
  UI is the story's face — build with the frontend-design pass, no new
  systems needed.
- **Carbon 2/3 payoff**: the header always said CARBON 2/3. The person
  holding the originals is the sympathizer-archivist whose hand appears in
  the marginalia; the good ending's last line is theirs.

## 5. The fork — durable record

New storage: `coldsnap-camp-record` — append-only per-contract history
(`fulfilled` count, `deviated` count, best time, last outcome). The medals
map stays a display layer; the record can never be overwritten by a faster
kill run (the known Phase-3 edge).

Ending = the campaign-final acceptance form (FORM AA-9), its remark pool
keyed by the record:

- **0 deviations** — "The instrument performed. Procurement approved." Full
  marks, dead voice. The star row is all gold and it reads like a receipt.
- **Partial** — "Deviations noted. The instrument has opinions. Procurement
  approved." The bureau doesn't care — which is its own indictment.
- **All four deviations, minimal collateral** — the quiet ending. The form
  is half redacted; the margin hand writes the only unredacted line:
  "The originals are safe. So are they." Hollow stars, kept promises.

**[DECIDE]**: tier thresholds (recommend exactly these three), and whether
collateral (non-subject kills) also feeds the final reading. Recommendation:
count it in the quiet-ending gate only — deviating AC-08 after leveling the
village shouldn't read as mercy.

## 6. Production order (after the plan is agreed — nothing starts yet)

1. **Runner + AC-01/AC-02** — campaign shell playable end-to-end behind the
   new start-screen option; camp storage; per-contract CI completability
   gate (the harness already exists and generalizes).
2. **AC-03..05 + evidence machinery** — evidence lines from JSON, android
   dress stage 1, marginalia rendering.
3. **AC-06..08 + endings** — deviation finale, durable record, AA-9 fork,
   document degradation.
4. **Polish** — campaign star rows on the start screen, smoke extensions,
   mobile pass, itch-style completion playtest.

Kill-criterion from the plan stands: completion cliff at AC-05/06 →
re-pace the dissonance beats.
