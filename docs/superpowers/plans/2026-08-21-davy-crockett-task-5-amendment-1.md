# The Davy Crockett, task 5 — Amendment 1: the pin re-teach (mk2.11)

The plan's branch adds a fifth possessed fire path to `state.js`, aiming at the surface like the other four. Two source-pin checks in era 04 count the surface-aim patterns and expect exactly 2 in `state.js`; the branch makes 3, and both pins fail. The pins are re-taught to the new count. The law they guard — every possessed fire path aims at the surface — is unchanged; the davy branch obeys it.

The working tree already holds the plan's Steps 1 and 2 (era 20 created and registered, the branch applied). This amendment finishes the task.

**Suggested model: Sonnet** — three literal edits in one test file, then the plan's own landing.

## Required reading

- This amendment.
- The plan: `docs/superpowers/plans/2026-08-21-davy-crockett-task-5-possessed-trigger.md` (whole).
- `scripts/tests/04-vision-command-possession.mjs` lines 2185–2235 (the two pins).
- `src/depot/state.js` — the applied davy branch in `possessedVolley` (opens at line 776).

## Step 1 — the failing state

Run `node scripts/gate.mjs depot-test`. Exactly these two failures, no others:

```
TRUE RETICLE mk2.01(i) source pin: all four possessed fire paths aim at the surface (aim.y)
TALL ORDER mk2.02(b) source pin: ground aim targets the surface in all four fire paths
```

Any other failure stops the task.

## Step 2 — the re-teach (`scripts/tests/04-vision-command-possession.mjs`)

Three edits, old → new, each reported in the landing.

At line 2196–2197, the first pin:

```js
    ok("TRUE RETICLE mk2.01(i) source pin: all four possessed fire paths aim at the surface (aim.y)",
      (stateSrc.match(/aim\.y != null \? aim\.y : world\.field\.heightAt\(aim\.x, aim\.z\)/g) || []).length === 2 &&
```

becomes:

```js
    ok("TRUE RETICLE mk2.01(i) source pin: all five possessed fire paths aim at the surface (aim.y)",
      (stateSrc.match(/aim\.y != null \? aim\.y : world\.field\.heightAt\(aim\.x, aim\.z\)/g) || []).length === 3 &&
```

At line 2225, the section comment:

```js
  // (b) surface aim: the four possessed tgt lines carry the surface, no phantom.
```

becomes:

```js
  // (b) surface aim: the five possessed tgt lines carry the surface, no phantom.
```

At line 2229–2230, the second pin:



```js
    ok("TALL ORDER mk2.02(b) source pin: ground aim targets the surface in all four fire paths",
      (stateSrc.match(/hy: sy - world\.field\.heightAt\(aim\.x, aim\.z\)/g) || []).length === 2 &&
```

becomes:

```js
    ok("TALL ORDER mk2.02(b) source pin: ground aim targets the surface in all five fire paths",
      (stateSrc.match(/hy: sy - world\.field\.heightAt\(aim\.x, aim\.z\)/g) || []).length === 3 &&
```

The `driversSrc` counts (`=== 2`) in both pins are untouched — nothing moved in `drivers.js`.

## Step 3 — gates

- `node scripts/gate.mjs depot-test` — green, eras 04 and 20 both passing.
- `node scripts/gate.mjs depot-lint` — green.

Any other failing check stops the task; no further license.

## Step 4 — the landing (the plan's own Step 4, unchanged)

- Bump `src/version.js`: `mk2.09` → `mk2.11` (mk2.10 stayed spent on the reverted glyph deploy — owner's ruling at dispatch).
- `npm run build` AFTER the bump.
- Commit `the possessed trigger, mk2.11`, push. The owner's live check — hold FIRE, watch it launch — is the acceptance, phone and desktop.

## Report

One line of outcome; both gate summaries verbatim; fixture seed (11); the commit hash; every re-teach old → new as its own bullet; every deviation its own labeled bullet; skipped steps named as skipped.
