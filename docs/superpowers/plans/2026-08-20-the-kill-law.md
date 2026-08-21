# THE KILL LAW AND THE SCORE — task plan (proposed mark mk1.93)

*Written 2026-08-20 on the owner's word. One task. Suggested model: Sonnet — every step is specced to the code; the agent executes, never designs. The task draws no randomness anywhere: every draw count, the keystone hash, and the bell's stream stay byte-identical.*

## The five standing rulings (owner, 2026-08-20 — this plan's design truth)

1. **ONE LAW, BOTH SIDES** — an attributed kill pays the killing side a fixed fraction of the victim's LIVE MARKET PRICE at the moment of death, and scores the killer's ledger with the whole price. Symmetric by construction.
2. **EVERYTHING WITH A PRICE** — men (per head), machines, towers, walls, sandbags. Town buildings carry no price; their hand-set pay stands as the named edge.
3. **ATTRIBUTED ONLY** — the kill event's attacker must be the opposing side. World deaths (craters, drowning, collapses, fire) and friendly fire pay and score nobody.
4. **THE SCORE IS LIVE** — both sides' kills and value destroyed on the standing interface, phone and desktop, and the end card carries the match report, both endings. The loss card's old digit-free rule is superseded knowingly by this ruling.
5. **WHAT STANDS** — the enemy's damage pay, leak pay, town pay, and stipend: income for pressure, not kills, untouched.

## Dials (provisional, F5)

| Dial | Value |
|---|---|
| `KILL_CUT` (fraction of live price paid to the books) | 0.30 |
| Score chip format and colors | proposed below; the owner's eye rules at the live check |

At 0.30, a mech kill pays 120 off base and a Bison 60 — today's hand-set hero numbers were already on this law.

## Required reading (agent, before any code; anchors re-verified at dispatch)

This plan whole; `CLAUDE.md`; `src/engine/core.js` — `killBody`/`applyDamage`/`resolveCause` (:838-873), the blast and projectile attacker sites (:560-835), crush/ram attribution (:1746-1805); `src/depot/units.js` — `payBounties` (:83-97), `spawnUnit`/`spawnTank` bounty stamps (:23-81); `src/depot/economy.js` whole; `src/depot/market.js` whole; `src/depot/state.js` — `makeRunState` (:1204), `HUD0` (:1612), `makeEndDispatch` (:1330), `WALL_COST` (:132), `SANDBAG_COST` (:771), `WALL_UPPER_GROUP` (:190), `fireBell`'s results init (:1531), `executeWithdrawal` (:1595); `src/depot/squads.js` — `SQUAD_SPECS` (:33-69); `src/depot/mines.js` — the attacker stamp (:23); `src/depot/DepotGame.jsx` — the two import lines (:21, :27), the `S` literal (:1281), the drain (:2731-2776), `payBounties`' call (:613), the hud tick (:3708-3760), the end-dispatch memo (:873-884), the top bar (:4206-4257), the resume run block (:1383-1400), `__DEPOT__` (:2778); `src/depot/save.js` — the run row (:252-262); `src/depot/bell.js` — the `fireBell` call (:40-47); `src/depot/ai.js` — `cost()` (:13, verify untouched); `scripts/depot-test.mjs` (:15-28); `scripts/tests/harness.mjs` + `shared.mjs`; every re-teach site in the ledger below.

## Trap notes

- **A sandbag's side is `bagSide`, never `team`** — `spawnSandbag` stamps team 1 on every bag and the resume comment at DepotGame :949 says not to trust it. The kill event carries `bagSide` for bags; `scoreKill` reads it.
- **The kill event is built before the vehicle→wreck flip** (`killBody`), so `ev.kind` is `"vehicle"` — never read the corpse; structures leave `world.byId` before the drain runs, so never resolve `ev.id`.
- **The end-dispatch memo must key on primitive numbers** (the mk0.29 dead-button lesson) — the hud's score object is a fresh reference every tick; deps list the four numbers, never the object.
- **`ColdsnapTD.jsx` is untouched** — its own tdkill machinery is the frozen tower-defense reference's.
- **`state.js` gains a `market.js` import.** The cycle state→market→squads→state is the same documented-safe deferred shape accuracy.js/state.js already share: no top-level cross reads, function bodies only. Do not restructure.
- **The task draws no rng.** `depot-lint` stays clean by construction; the keystone hash and every draw-count pin must hold byte-identical — a moved draw count stops the task.
- **The drain's `e.kind === "building"` branch never fires today** (town buildings are chunk bodies). It is preserved verbatim, not fixed.
- **Body `bounty` stamps stay everywhere** — the field is the price basis ai.js spends and the book value reads; only the payout path dies. Spec-value pins (`bounty === price`) hold unmoved.
- **Sealed riders die with their vehicle** through transports.js; whatever attacker their kill events carry is the law's answer — world-attributed rider deaths score nobody, accepted. Verify the events exist; do not add attribution.
- **`scripts/economy-probe.mjs` replicates the old tdkill drain** (:456). It is a diagnostic, not a gate; it goes stale knowingly and joins the polish queue. Do not touch it.

---

## PHASE A — the event learns its victim

**Step A1 — asserts first.** New era file `scripts/tests/13-the-score.mjs`, registered in `scripts/depot-test.mjs` after era 12 (`await import("./tests/13-the-score.mjs");` before `finish()`). Written failing-first, checks K1–K2: under `depotCombat`, a killed team-2 unit's kill event carries `team: 2` and its tag; without `depotCombat` the event carries no `team` field (the frozen worlds' events stay byte-identical). Fixture seeds fresh at 160+, named in the report.

**Step A2 — the stamp.** `src/engine/core.js` `killBody` (:863-873), between the `ev` construction (:868) and `world.events.push(ev)`:

```js
// DIVERGENCE (guarded, depot-only — the srcId/dmgT precedent): the kill
// event names its victim's side and type, so the game layer can price the
// death after the body is swept. Demo/campaign events stay byte-identical.
if (world.depotCombat) {
  ev.team = b.team; ev.tag = b.tag; ev.utype = b.utype;
  ev.vtype = b.vtype; ev.towerType = b.towerType;
  if (b.sandbag) { ev.sandbag = 1; ev.bagSide = b.bagSide || 1; }
}
```

## PHASE B — the price of a death

**Step B1 — asserts.** Checks K3–K7 (failing-first): an enemy conscript prices at the foe table's per-man value (arithmetic against `priced()`); an enemy marksman-pair man at half the family price; a player rifleman at the rifles squad price over four; tower, wall, and sandbag at their family prices with `counted` false; a town chunk and a flag price null.

**Step B2 — `killPrice`.** `src/depot/market.js`, after `fieldPrices`:

```js
// THE KILL PRICE (owner, 2026-08-20): what one death is worth — the victim's
// live market price at the moment it dies, resolved from the kill event's own
// identity fields (core.js stamps them under depotCombat). Men price per
// head: a squad-family price over the men one buy fields (the sniper-pair
// split generalized). Machines and masonry price whole; `counted` marks what
// joins the kill integer (men and machines — masonry rides the value alone).
// Unpriced things — town stones, flags, loose rubble — return null: the law
// cannot reach them. wallBase/bagBase are threaded in like fieldPrices' own
// (module purity — state.js owns those two numbers).
export function killPrice(ev, counts, wallBase, bagBase) {
  const c = counts || {};
  if (ev.kind === "unit") {
    if (ev.team === 2) {
      const tag = ev.tag || "";
      const fam = FAMILY_OF_TAG[tag];
      const spec = ENEMY_SPECS[tag];
      if (!fam || !spec) return null;
      const per = tag === "sniper" ? 2 : 1; // one marksman buy fields two men
      return { price: priced(spec.bounty, fam, c) / per, counted: true };
    }
    const sp = SQUAD_SPECS[ev.utype];
    const fam = FAMILY_OF_SQUAD[ev.utype];
    if (!sp || !fam) return null;
    return { price: priced(sp.cost, fam, c) / sp.n, counted: true };
  }
  if (ev.kind === "mech") return { price: priced(MECH.cost, "heroMech", c), counted: true };
  if (ev.kind === "vehicle") {
    if (ev.vtype === "bison") return { price: priced(BISON.cost, "heroBison", c), counted: true };
    if (ev.vtype === "apc") return { price: priced(APC.cost, "heroApc", c), counted: true };
    if (ev.tag === "tank") return { price: priced(TANK.bounty, "tank", c), counted: true };
    return null;
  }
  if (ev.kind === "tower") {
    const fam = FAMILY_OF_TOWER[ev.towerType];
    if (!fam) return null;
    return { price: priced(TOWER_SPECS[ev.towerType].cost, fam, c), counted: false };
  }
  if (ev.kind === "wall") return { price: priced(wallBase, "wall", c), counted: false };
  if (ev.kind === "chunk" && ev.sandbag) return { price: priced(bagBase, "sandbag", c), counted: false };
  return null;
}
```

(Every name used is already imported at market.js's top: `TOWER_SPECS`, `ENEMY_SPECS`, `TANK`, `BISON`, `APC`, `MECH` at :6, `SQUAD_SPECS` at :7; the three family maps and `priced` are module-local.)

## PHASE C — the law

**Step C1 — asserts.** Checks K8–K11 and K16 (failing-first): a world-attributed kill scores nobody and friendly fire scores nobody; an enemy-attributed team-1 man pays `KILL_CUT ×` price onto `reg.scrap` and moves the enemy ledger; a player-attributed team-2 conscript pays `S.resources` and moves the player ledger; a mech-hull event counts a kill while a wall event moves value only and a wall's upper course scores nothing; `executeWithdrawal` deletes bodies with zero events and zero score movement.

**Step C2 — the cut.** `src/depot/economy.js`, after `RESULTS`:

```js
// THE KILL CUT (owner, 2026-08-20): the fraction of a victim's live market
// price the killing side banks. The score ledger takes the whole price;
// the books take this cut of it. // provisional (F5)
export const KILL_CUT = 0.30;
```

**Step C3 — `scoreKill`.** `src/depot/state.js`, after `makeEndDispatch`. Imports: `killPrice` joins a new `./market.js` import line; `KILL_CUT` joins the existing `./economy.js` import (:8).

```js
// THE KILL LAW (owner, 2026-08-20): one attributed kill — the victim's live
// market price scores the killer's ledger WHOLE, and KILL_CUT of it lands on
// the killer's books. Attribution is the event's own attacker: "player" and
// "enemy" are the two sides; "world" (craters, drowning, collapses, fire)
// and friendly fire pay and score nobody. Men and machines count the kill
// integer; masonry rides the value alone. A wall's upper courses never score
// — one wall, one death (the WALL_UPPER_GROUP rule). A sandbag's side is
// bagSide, never team (spawnSandbag stamps team 1 on every bag).
// Pure over (S, ev, counts); returns what it did, or null. No rng.
export function scoreKill(S, ev, counts) {
  if (ev.type !== "kill") return null;
  const att = ev.attacker === "player" ? 1 : ev.attacker === "enemy" ? 2 : 0;
  if (!att) return null;
  const victim = ev.sandbag ? ev.bagSide : ev.team;
  if (victim !== 1 && victim !== 2) return null;
  if (att === victim) return null; // friendly fire pays nobody
  if (ev.kind === "wall" && ev.group === WALL_UPPER_GROUP) return null;
  const kp = killPrice(ev, counts, WALL_COST, SANDBAG_COST);
  if (!kp) return null;
  const pay = kp.price * KILL_CUT;
  const led = att === 1 ? S.score.p : S.score.e;
  led.value += kp.price;
  if (kp.counted) led.kills++;
  if (att === 1) S.resources += pay;
  else if (S.reg) S.reg.scrap += pay;
  return { side: att, price: kp.price, pay, counted: !!kp.counted };
}
```

**Step C4 — the ledger state.** Three literals:

- `src/depot/state.js` `makeRunState` (:1206): `resources: startResources, kills: 0,` → `resources: startResources, score: { p: { kills: 0, value: 0 }, e: { kills: 0, value: 0 } },`
- `src/depot/state.js` `HUD0` (:1613): the `kills: 0,` entry → `score: { pk: 0, pv: 0, ek: 0, ev: 0 },` (the hud mirror is flat — four primitives, see the memo trap note)
- `src/depot/DepotGame.jsx` `S` literal (:1281): `kills: 0, resources: 250,` → `score: { p: { kills: 0, value: 0 }, e: { kills: 0, value: 0 } }, resources: 250,`

## PHASE D — the old payouts die

**Step D1 — asserts.** Checks K12–K13 (failing-first): integration — a fixture tower kills a conscript through the real fire path and `scoreKill` over `world.events` pays and scores exactly once; `RESULTS` carries no `towerKill`/`wallKill` key and `payResults` books the three surviving terms exactly.

**Step D2 — `payBounties` dies.** `src/depot/units.js`: delete the function and its comment block (:83-97). `src/depot/DepotGame.jsx`: `payBounties` leaves the units.js import (:27) and its call leaves `stepDepot` (:613); the dead-mech block's comment reference to it (:615-618) is trimmed to "(Placed here so the existing structureLost→stepWallSupport proximity pin (mk0.52/f) stays intact.)".

**Step D3 — the drain pays the law.** `src/depot/DepotGame.jsx` `drainEvents`, the event loop (:2756-2770) becomes (`scoreKill` joins the state.js import line :21):

```js
for (const e of evs) {
  if (e.type !== "kill") continue;
  // THE KILL LAW (mk1.93): every attributed death pays and scores here.
  scoreKill(S, e, S._market ? S._market.counts : null);
  // Town buildings are unpriced — their hand-set pay is the named edge
  // outside the law. The branch is preserved as it was, not fixed.
  if (e.attacker === "enemy" && S.ws.results && e.kind === "building") S.ws.results.buildingKills++;
}
```

**Step D4 — the enemy's table trims.** `src/depot/economy.js`:

```js
export const RESULTS = {
  // uncapped by decision (Jeff)
  structureDmg: 0.06, // scrap per hp of wall/tower damage dealt
  buildingKill: 8, // town buildings carry no market price — the law's named edge, hand-set
  leak: 10,
};

export function payResults(reg, ev) {
  // ev: {structureDmg, buildingKills, leaks} — tower and wall kills pay
  // through the kill law now (state.js scoreKill), never twice.
  reg.scrap += ev.structureDmg * RESULTS.structureDmg
    + ev.buildingKills * RESULTS.buildingKill + (ev.leaks || 0) * RESULTS.leak;
}
```

**Step D5 — the results init trims.** `src/depot/state.js` `fireBell` (:1531): `ws.results = { structureDmg: 0, towerKills: 0, wallKills: 0, buildingKills: 0, leaks: 0 };` → `ws.results = { structureDmg: 0, buildingKills: 0, leaks: 0 };`

## PHASE E — the ledger rides the save

**Step E1 — assert.** Check K14 (failing-first): a serialized run with a moved score round-trips all four numbers through `serializeFront`/`parseFront` and the restore shape.

**Step E2 — the row.** `src/depot/save.js` run row (:253): `resources: r3(S.resources), kills: S.kills, spawnRR: S.spawnRR,` →

```js
resources: r3(S.resources), spawnRR: S.spawnRR,
score: { pk: S.score.p.kills, pv: r3(S.score.p.value), ek: S.score.e.kills, ev: r3(S.score.e.value) },
```

**Step E3 — the resume.** `src/depot/DepotGame.jsx` (:1385): `S.resources = r.resources; S.kills = r.kills; S.spawnRR = r.spawnRR;` →

```js
S.resources = r.resources; S.spawnRR = r.spawnRR;
S.score = r.score
  ? { p: { kills: r.score.pk, value: r.score.pv }, e: { kills: r.score.ek, value: r.score.ev } }
  : { p: { kills: 0, value: 0 }, e: { kills: 0, value: 0 } };
```

(The fallback is dead for real saves — the mark refusal burns old files — and kept for fixture saves.)

## PHASE F — the score on the screen (phone AND desktop, one top bar)

**Step F1 — assert.** Check K15 (failing-first): `makeEndDispatch` carries the tally line on BOTH endings, with the exact fixture numbers; the victory card still leads with its breach line.

**Step F2 — the end card.** `src/depot/state.js` `makeEndDispatch` (:1330) becomes (copy served for the owner's approval with this plan; the old loss card's digit-free pin is superseded by ruling 4):

```js
export function makeEndDispatch({ victory, score = null }) {
  const wo = "WO-9999";
  const s = score || { pk: 0, pv: 0, ek: 0, ev: 0 };
  const tally = `${s.pk} CONFIRMED, ◆${s.pv} DESTROYED. ITS COUNT: ${s.ek}, ◆${s.ev}.`;
  if (victory) {
    return {
      wo,
      lines: [
        "THE OPPOSING DEPOT IS BREACHED.",
        "The position opposite is rubble. The field belongs to the Bureau.",
        tally,
        "FIELD ORDER CLOSED.",
      ],
    };
  }
  return {
    wo,
    lines: [
      "THE DEPOT IS BREACHED.",
      "The position is lost. Withdrawal under fire.",
      tally,
    ],
  };
}
```

**Step F3 — the hud tick.** `src/depot/DepotGame.jsx` (:3729): `kills: S.kills,` → `score: { pk: S.score.p.kills, pv: Math.round(S.score.p.value), ek: S.score.e.kills, ev: Math.round(S.score.e.value) },` — four primitives, flat.

**Step F4 — the memo.** `src/depot/DepotGame.jsx` (:881-884) — deps are the four numbers, never the object (the mk0.29 lesson):

```js
const endDispatch = useMemo(
  () => (hud.gameOver || hud.victory ? makeEndDispatch({ victory: hud.victory, score: hud.score }) : null),
  [hud.gameOver, hud.victory, hud.score.pk, hud.score.pv, hud.score.ek, hud.score.ev],
);
```

**Step F5 — the chip.** `src/depot/DepotGame.jsx` top bar, after the `☠` chip (:4213) — the one top bar serves phone and desktop alike (it wraps; the chip is one flex item):

```jsx
<div data-score style={P.stat} title="the match score — kills and value destroyed, yours then the enemy's">
  <span style={{ color: "#7dffa8" }}>⚔ {hud.score.pk} ◆{hud.score.pv}</span>
  <span style={{ opacity: 0.5 }}>·</span>
  <span style={{ color: "#ff7a7a" }}>{hud.score.ek} ◆{hud.score.ev}</span>
</div>
```

**Step F6 — the harness keeps its word.** `src/depot/DepotGame.jsx` `__DEPOT__` (:2778): `kills: S.kills,` → `kills: S.score.p.kills, score: { pk: S.score.p.kills, pv: +S.score.p.value.toFixed(1), ek: S.score.e.kills, ev: +S.score.e.value.toFixed(1) },` — the `kills` field survives for the standing diagnostic scripts.

## PHASE G — the sweep ledger, the gates, the landing

**Step G1 — the re-teach ledger (pre-named; behavior re-teaches ruled by the owner's five rulings above, each reported old → new).**

| Site | Old | New |
|---|---|---|
| `scripts/tests/01-engine-era.mjs:319-329` | tank tdkill block: `payBounties` pushes a tdkill of 25, once | `scoreKill` on the tank's kill event pays `KILL_CUT ×` the live tank price and moves the ledger; the once-only assert re-teaches to "one event, one score; the corpse sweep pushes no second event" |
| `01:439` | `makeEndDispatch({ victory: true, kills: 12, ... })` | signature takes `score`; the first-line pin holds unmoved |
| `01:608-617, 754-765, 796, 1020-1021, 1656, 1678` | `RESULTS` arithmetic over five terms | three-term arithmetic (structureDmg, buildingKill, leak); the uncapped pin re-teaches onto buildingKill |
| `01:1453-1456` | breach card digit-free | breach card carries the tally line — the digit-free pin dies on ruling 4, its own named supersession |
| `01:1788-1793` | a dead team-1 member pushes no tdkill | an enemy-attributed team-1 death scores the enemy; a world-attributed one scores nobody |
| `scripts/tests/03-bell-polish.mjs:184, 265` | wallKill counter shape pins in DepotGame source | the one-wall-one-death shape lives in `scoreKill` — the source-shape regexes re-point to state.js |
| `scripts/tests/12-the-mech.mjs:150-156` (M12) | `payBounties` pays 120 on a dead team-2 hull | `scoreKill` on a player-attributed mech kill pays `KILL_CUT ×` the live heroMech price |
| `scripts/tests/02-front-f1.mjs:528` | end-dispatch memo source-shape regex | expected to hold (deps change only) — verified, not re-taught; any other failure stops the task |

Every other failure anywhere stops the task.

**Step G2 — the gates (run ONLY these).** `node scripts/depot-test.mjs` — expected 1664/0 (sixteen new checks K1–K16; every re-teach count-neutral); `node scripts/golden.mjs` — 7/7 (the event stamp is depotCombat-gated; the demo cannot move); `node scripts/depot-lint.mjs` — clean (the task draws nothing); the keystone hash and draw count — byte-identical (zero draws added or moved); the standing smoke run — green.

**Step G3 — the landing.** `src/version.js` → mk1.93; build AFTER the bump; commit; push. The report names every fixture seed, every re-teach old → new, and every deviation as its own labeled bullet.

**The owner's live check** (look and feel are his alone): the score chip moving both directions, phone and desktop; a hero kill jumping the value; a crater death moving nothing; the tally on both end cards; a mid-war save resuming the score intact.

## Named exclusions

- Town-building pricing (the buildingKill edge closes when town stone gains a price — polish queue).
- The enemy's pressure incomes (damage pay, leaks, town pay, stipend) — attacker-side design, standing, not this task's.
- `scripts/economy-probe.mjs` staleness — diagnostic, polish queue.
- Score presentation beyond the one chip and the end card (histories, per-type breakdowns) — nothing here.
