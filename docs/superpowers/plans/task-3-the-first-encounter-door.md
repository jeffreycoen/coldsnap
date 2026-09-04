# TASK 3 — THE FIRST-ENCOUNTER DOOR (mk2.41)

Design: `tutorial-cards-and-launch-design.md`. This task makes the teaching cards fire: each card once, the first time its moment comes, pausing the war while it is up (the convoy idiom). Seen-state in one storage key, revision-gated. The sandbox never fires a card.

**Suggested model: Sonnet** — the plan carries every edit verbatim; the work is placement, not design.

## THE FIRING TABLE — when each card fires (your approval ratifies these moments)

| Card | Moment | Anchor |
|---|---|---|
| `the_hand` | the draft opens | `startGame`, drafting branch (`DepotGame.jsx:4311`) |
| `placing` | the placement queue first fills | `S.confirmDraft` (`:2772`) |
| `desktop_keys` | the war starts (fresh war only; desktop only) | `startGame`, started branch (`:4317`) |
| `bell` | the first bell tolls | the `stepBell` ring site (`:3716`) |
| `convoy` | the manifest window first opens | frame loop, beside the ring site |
| `kill_price` | the first kill event, either side | `drainEvents` kill branch (`:3061`) |
| `fog` / `wind` / `spare_ours` | first tap of that toggle (the toggle still flips) | `toggleFog` `:4327`, `toggleWind` `:4332`, `toggleHoldArea` `:4345` |
| `market`, then `scrap` | first BUILD open (two cards, queued) | BUILD crate onClick (`:5002`) |
| `sell` | first SELL arm | `toggleSell` (`:4293`) |
| squad-pie cards | one per pie open: the first unseen among that squad's own wedges, in wedge order | the three sites that open a squad pie (`:2512`, `:1777`, `:2832`) |
| tower-pie cards (`discipline`, `possess_tower`, `sell`) | same rule, tower pie | `:2512` |
| hull-pie cards (`defend`…`load`; `possess_mech` for a mech) | same rule, hull pie | `:2512` |

Notes stated plainly: a resumed war fires no `desktop_keys` (startGame never runs on resume — its moment is a war's first start); the bell and convoy cards queue back-to-back at bell one (two CLOSEs); wedge cards shared between pies (`defend`, `move`, `patrol`) are seen once and never repeat on the other pie.

## The mechanism

- `S._teachQ` (fire queue, head renders) and `S._teachSeen` (a Set, null until the async load lands — nothing fires before it).
- Storage: `coldsnap-wf-cards` = `{ rev: TEACH_REV, seen: [keys] }` through `window.storage`. `TEACH_REV = 1` exported from `cards.js`; a rev mismatch resets the seen set (the manual's revision law).
- The sentinel `"*"` in the seen set silences the door entirely — the smoke test seeds it so a scripted war is never paused by a card.
- Pause: the frame loop's `sdt` gate gains `teachUp` beside `convoyUp` — the sim freezes while a card is up; CLOSE resumes.
- Serving: the existing `InfoCard`, door `teach` (bare CLOSE — no code needed in InfoCard, pinned in Task 1). Phone voice: `roleTouch` substitutes for `role` on touch. Rendered above every overlay (the draft screen sits at zIndex 8; the card wrapper at 10).

## Required reading (read-confirmation opens the report)

1. This plan.
2. `src/depot/cards.js` (all).
3. `src/depot/DepotGame.jsx` — lines 1–60 (imports, keys), 900–1000 (mount state), 1408–1520 (the S object), 1766–1790 (`placeSquadAt`), 2400–2545 (`tapAt`), 2740–2870 (`confirmDraft`, `placeHire`), 3055–3075 (`drainEvents`), 3489–3520 (the frame loop's sdt gate), 3710–3720 (the ring site), 4058–4120 (the hud tick), 4271–4360 (`setMode`/`startGame`/toggles), 4760–4800 (the info-card render), 4989–5033 (the build bar).
4. `scripts/tests/25-the-teaching-cards.mjs` (all).
5. `scripts/smoke.mjs` lines 210–235 (the depot section's storage reset).

## Steps

### Step 1 — the failing asserts first: append to `scripts/tests/25-the-teaching-cards.mjs`

```js
// ---- Task 3 (mk2.41): THE FIRST-ENCOUNTER DOOR
{
  const dg = src("src/depot/DepotGame.jsx");
  ok("T3: cards.js stamps the revision", /export const TEACH_REV = 1;/.test(src("src/depot/cards.js")));
  ok("T3: the seen store has its own key", /const CARDS_KEY = "coldsnap-wf-cards";/.test(dg));
  ok("T3: a card up freezes the sim (the convoy idiom)", /const teachUp = S\._teachQ\.length > 0;/.test(dg) && /cardUp \|\| convoyUp \|\| teachUp \? 0 :/.test(dg));
  ok("T3: firing is sandbox-silent, seen-gated, and honors the silence sentinel",
    /S\.teachFire = \(key\) => \{\n\s+if \(dev\) return;/.test(dg) && /S\._teachSeen\.has\("\*"\)/.test(dg));
  ok("T3: closing marks seen and persists the set", /S\._teachSeen\.add\(k\);[\s\S]{0,220}window\.storage\.set\(CARDS_KEY/.test(dg));
  ok("T3: the phone voice serves on touch", /isTouch && tc\.roleTouch \? tc\.roleTouch : tc\.role/.test(dg));
  ok("T3: the pie teaches one card per open", /S\.teachPie = \(kind, thing\) => \{/.test(dg) && /PIE_CARDS/.test(dg));
  ok("T3: the smoke silences the door with the sentinel", /coldsnap-wf-cards/.test(src("scripts/smoke.mjs")));
}
```

Run `node scripts/gate.mjs depot-test` — the eight FAIL. Record the PASS count.

### Step 2 — `src/depot/cards.js`: the revision stamp

Directly above `export const TEACH = {`:

```js
// TEACH_REV — the teaching cards' revision stamp (the MANUAL_REV law):
// bumped when the cards change materially, the door then greets everyone
// once more. Rev 1 = Task 3, the door opens.
export const TEACH_REV = 1;
```

### Step 3 — `DepotGame.jsx`: import, key, state, helpers

3a. After line 19 (`import { cardFor } from "./infocards.js";`):

```js
import { TEACH, TEACH_REV } from "./cards.js";
```

3b. After the `QM_KEY` const (line 55):

```js
// Task 3 (mk2.41): the teaching cards' seen store — one key, rev-gated
// (the MANUAL_REV law). seen may carry the sentinel "*": every card
// silenced, the smoke test's scripted wars ride under it.
const CARDS_KEY = "coldsnap-wf-cards";
```

3c. In the S object literal, after the line `infoKey: null, infoDoor: null, infoArmedAt: 0,` (line 1448):

```js
        _teachQ: [], _teachSeen: null, // Task 3: the first-encounter door — queue renders head; seen null until the async load lands (nothing fires before it)
```

3d. After the S object closes and before `if (!RES && !dev)` (line 1507), the door's three functions and the load:

```js
      // Task 3 (mk2.41): THE FIRST-ENCOUNTER DOOR. A card fires once, the
      // first time its moment comes; the war pauses while it is up (the
      // convoy idiom, in the frame loop's sdt gate). The sandbox never
      // fires one; the "*" sentinel silences the door for scripted runs.
      S.teachFire = (key) => {
        if (dev) return;
        const tc = TEACH[key];
        if (!tc || (tc.desktopOnly && isTouch)) return;
        if (!S._teachSeen || S._teachSeen.has("*") || S._teachSeen.has(key) || S._teachQ.includes(key)) return;
        S._teachQ.push(key);
      };
      S.teachClose = () => {
        const k = S._teachQ.shift();
        if (k && S._teachSeen) {
          S._teachSeen.add(k);
          try { window.storage.set(CARDS_KEY, JSON.stringify({ rev: TEACH_REV, seen: [...S._teachSeen] })); } catch (e) {}
        }
      };
      // The pie's teaching order — the first unseen wedge card, one per
      // open. Wedge cards shared across pies (defend, move, patrol) are
      // seen once and cover both.
      const PIE_CARDS = {
        squad: (sq) => ["defend", "move", "attack", "possess_squad", "select_all",
          ...(sq.type !== "engineers" && sq.type !== "sappers" ? ["patrol"] : []),
          ...(INFANTRY_ARMS[sq.type] ? ["structures"] : []),
          ...(sq.type === "engineers" ? ["engineer_lines"] : []),
          ...(sq.type === "sappers" ? ["sapper_lines"] : [])],
        tower: () => ["discipline", "possess_tower", "sell"],
        veh: (b) => ["defend", "move", "patrol", "escort", "tracks",
          b.kind === "mech" ? "possess_mech" : "possess_vehicle",
          ...(b.vtype === "apc" ? ["load"] : [])],
      };
      S.teachPie = (kind, thing) => {
        if (!thing || !S._teachSeen || S._teachSeen.has("*")) return;
        for (const k of PIE_CARDS[kind](thing)) {
          if (!S._teachSeen.has(k)) { S.teachFire(k); return; }
        }
      };
      // The seen set loads once, async, off the shim — rev mismatch resets.
      (async () => {
        let seen = [];
        try {
          const r = await window.storage.get(CARDS_KEY);
          const d = JSON.parse(r.value);
          if (d && d.rev === TEACH_REV && Array.isArray(d.seen)) seen = d.seen;
        } catch (e) {}
        if (!disposed) S._teachSeen = new Set(seen);
      })();
```

### Step 4 — the firing sites (each a one- or two-line edit)

4a. **sdt gate** (line 3512–3513). Old:

```js
          const convoyUp = !!(S.manifest && S.manifest.cardUp);
          const sdt = S.paused || !S.started || cardUp || convoyUp ? 0 : dt * S.speed;
```

New:

```js
          const convoyUp = !!(S.manifest && S.manifest.cardUp);
          const teachUp = S._teachQ.length > 0; // Task 3: a teaching card freezes the sim, the convoy's own law
          const sdt = S.paused || !S.started || cardUp || convoyUp || teachUp ? 0 : dt * S.speed;
```

4b. **The ring site** (line 3716). Old:

```js
            if (!dev && stepBell(S, world.t)) { ringBell(); S.manifest.armedAtWall = performance.now() / 1000 + PENDING_ARM_S; }
```

New:

```js
            if (!dev && stepBell(S, world.t)) { S.teachFire("bell"); ringBell(); S.manifest.armedAtWall = performance.now() / 1000 + PENDING_ARM_S; }
            if (S.manifest && S.manifest.cardUp) S.teachFire("convoy"); // idempotent — seen/queue gates inside
```

4c. **Kill** — in `drainEvents` (line 3061), after `if (e.type !== "kill") continue;`:

```js
          S.teachFire("kill_price");
```

4d. **Draft and placement** — in `S.confirmDraft` (after line 2773 `S._placeTotal = S._placeQueue.length;`):

```js
        if (S._placeQueue.length) S.teachFire("placing");
```

In `startGame` (component level, line 4311 drafting branch, after `S._draftOpen = true;`):

```js
    if (S.teachFire) S.teachFire("the_hand");
```

And in the started branch (after line 4318 `S.started = true;`):

```js
    if (S.teachFire) S.teachFire("desktop_keys");
```

4e. **Toggles** — one line at the end of each, before the `setHud` call: `toggleFog` → `if (S.teachFire) S.teachFire("fog");`; `toggleWind` → `if (S.teachFire) S.teachFire("wind");`; `toggleHoldArea` → `if (S.teachFire) S.teachFire("spare_ours");`; `toggleSell` → `if (S.sellMode && S.teachFire) S.teachFire("sell");` (fires on arming only).

4f. **BUILD open** — in the BUILD crate's onClick (line 5009, after `setBuildOpen(true);`):

```js
              if (S && S.teachFire) { S.teachFire("market"); S.teachFire("scrap"); }
```

4g. **The pies** — in `tapAt`'s cycle pick (after line 2515 `else S.inspectId = id;`, inside the `if (pick)` block, after the three assignments):

```js
          if (pick.key.startsWith("sq:")) S.teachPie("squad", S.squads.find((q) => q.id === id));
          else if (pick.key.startsWith("veh:")) S.teachPie("veh", world.byId.get(id));
          else S.teachPie("tower", world.byId.get(id));
```

In `placeSquadAt` (after line 1777 `S.selSquadId = sq.id; ... S.pieOpen = true;`):

```js
        S.teachPie("squad", sq);
```

In `placeHire`'s squad branch (after line 2832 `S.selSquadId = sq.id; ... S.pieOpen = true;`):

```js
          S.teachPie("squad", sq);
```

4h. **hud tick** — in the `setHud({...})` object (after the `info:` line, 4099):

```js
              teach: S._teachQ.length ? { key: S._teachQ[0] } : null,
```

### Step 5 — the render (after the `hud.info` InfoCard block closes, line 4777)

```jsx
      {/* Task 3: the teaching card — head of the fire queue, above every
          overlay (the draft sits at zIndex 8). The war is frozen while it
          is up; CLOSE marks it seen and resumes. */}
      {hud.teach && !hud.info && (() => {
        const tc = TEACH[hud.teach.key];
        if (!tc) return null;
        const card = { ...tc, role: isTouch && tc.roleTouch ? tc.roleTouch : tc.role };
        return (
          <div data-teach-card={hud.teach.key} style={{ position: "absolute", inset: 0, zIndex: 10, pointerEvents: "none" }}>
            <div style={{ pointerEvents: "auto" }}>
              <InfoCard card={card} door="teach"
                onCancel={() => { const S = stateRef.current; if (S && S.teachClose) S.teachClose(); }} />
            </div>
          </div>
        );
      })()}
```

### Step 6 — `scripts/smoke.mjs`: silence the door (line 221)

After the manual-clear evaluate line, add:

```js
    // Task 3: the teaching-card door is silenced with its own sentinel —
    // a scripted war must never be paused by a first-encounter card.
    await page.evaluate(() => localStorage.setItem("coldsnap-wf-cards", JSON.stringify({ rev: 1, seen: ["*"] })));
```

### Step 6b — AMENDMENT 1 (owner, 2026-08-25): one licensed re-teach

`scripts/tests/11-hiring-hall.mjs:160` ("T3(b): the convoy freezes the whole sim through the one gate") pins the literal old sdt line. Step 4a rewrites that line. Re-teach the pin to the new literal — the asserted behavior (the convoy freezes the sim through the one gate) is unchanged; only the pinned text grows the `teachUp` term. Old→new reported. No other test moves.

### Step 7 — gates

- `node scripts/gate.mjs depot-test` — green, +8 over Step 1's count.
- `node scripts/gate.mjs depot-lint` — green.
- `node scripts/gate.mjs smoke` — green (the sentinel keeps the scripted war unpaused; the manual flow it pins is untouched until Task 6).

### Step 8 — the deploy

Bump `src/version.js` to `mk2.41`; build after the bump; commit ("the teaching cards — the first-encounter door, mk2.41"); push. The owner's live check — first war on phone and desktop — is the acceptance.

## Report

Read-confirmation, one line of outcome, PASS counts before/after, gates and verdicts, commit hash, seeds (smoke's pinned seed 11; the suite eras use none). Every nonconformity its own labeled bullet.
