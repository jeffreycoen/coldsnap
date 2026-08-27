# Task 4 combined — Amendment 4: the last free bindings, found by machine

The fourth stop was `structHp`. This amendment dispositions it — and,
so the class dies, every other free name in the moved text was found the
same way the imports were: a machine scan of the exact moved ranges for
names not declared inside them, not imported, and not already assigned by
the plan or amendments. The scan found three more real bindings beyond
`structHp`; everything else it flagged is property names, string text, or
locals the moved code declares itself. The four are dispositioned below.
The plan and amendments 1–3 stand except as written here.

## 1. `structHp` (declared line 1045) — becomes war state

`bootWar` initializes `war.clock._structHp = new Map()` beside
`terrAcc`; the moved drain reads it there. The component's declaration
at 1045 is deleted (its only reader moved). The War typedef's `clock`
note now reads: never saved, holds the territory accumulator and the
structure-damage snapshot.

## 2. `depotCensus` / `depotCensus2` (line 508) — read off the war

The moved census call (lines 3390–3393) closes over the component's
`depotCensus`/`depotCensus2`. Inside the tick file those reads are
`war.census` / `war.census2` — the same objects, already on the war.
Substitution rows added.

## 3. `view._teslaFired` (inside the moved trigger, line 3334) — a flag

The possessed-tower trigger increments a screen debug counter. The
moved line drops the `view.` write; the tick sets
`flags.teslaFired = true` when the trigger fired, and the component
increments `view._teslaFired` on the flag, next to where it counts zaps.
The flag list is now eight booleans: `territory, mines, townFlags,
orderPaths, dressing, bell, withdrew, teslaFired` — the TickFlags
typedef re-signs to this.

## 4. The pool-rebuild block — exact code

Amendment 2 moved it and named the cadence change; this writes the code.
At the top of `tickWar`, replacing the component's `view.acc`-gated form:

```js
if (run._hot) rebuildBodyLists(world, world._L || makeBodyLists());
else world._L = null;
```

## Substitution table — added rows

| moved text | becomes | where |
|---|---|---|
| `structHp` | `war.clock._structHp` | tick.js |
| `depotCensus` / `depotCensus2` | `war.census` / `war.census2` | tick.js |
| `view._teslaFired = (view._teslaFired \|\| 0) + 1` | `flags.teslaFired = true` | tick.js |
| `if (view.acc >= STEP) { ... }` (the pool gate) | the block in section 4, ungated | tick.js |

## The scan's verdict, recorded

Beyond these four, the scan over every Move B line found no referenced
name that is declared in the component, absent from the import lists,
and absent from the plan's and amendments' dispositions. The remaining
flagged tokens are object properties (`spawnQueue`, `mechRef`, ...),
string words from toasts and event names, arithmetic locals the moved
code declares itself (`i1`, `pz`, ...), and names already assigned
(`feedMechCommands` rides `input.feedMech`; the renderer calls are
deleted per the tables). A fifth stop of this class has nothing left to
find; if one happens anyway, it is a scan error and comes back as a
finding, not a workaround.

## What does not change

Everything else: both moves, amendments 1–3, the gates, the acceptance
arithmetic, the mark, the commit subject, the test list. `boot.js` as
written by the stopped agent stands, EXCEPT it gains the
`_structHp: new Map()` entry in the war literal's `clock` object
(section 1) — one line, exact:

```js
clock: { terrAcc: 0, _structHp: new Map() },
```
