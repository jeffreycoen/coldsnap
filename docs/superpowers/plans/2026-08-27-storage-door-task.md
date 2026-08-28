# The Storage Door (mk2.85) — one task, standalone

Door only, the sound door's pattern: the platform storage shim gains a
named, importable handle; `api.js` exports it; the war game's persistence
calls go through it instead of the `window.storage` global. The store
itself does not change — same keys, same value shapes, same
artifact-runtime-first behavior. Saves are never migrated; nothing here
touches a stored byte.

Interface note (the standing law, named explicitly): no change on phone
or desktop.

**Suggested model: Sonnet 5** — exact-anchor edits with the code given
verbatim; no design.

## Required reading (verify each exists before starting)

1. This plan.
2. `src/platform/storage.js` (22 lines, whole file)
3. `src/depot/api.js` — lines 1–35 (the door blocks this extends)
4. `src/depot/DepotGame.jsx` — lines 30–40, 350–370, 590–650, 1770–1780
5. `src/depot/save.js` — lines 150–165 and 320–345

The report opens with a read-confirmation line naming all five.

## Design constraints (stated, not open)

- The named handle DELEGATES to `window.storage` at call time — it never
  captures the object — so the artifact runtime's own store still wins
  whenever it is present, exactly as today. Headless callers get safe
  nulls.
- `save.js` imports the handle from `../platform/storage.js` DIRECTLY,
  not from `api.js` — `api.js` imports `save.js`, and the other
  direction would be a cycle. The component imports from `./api.js`.
- The old screens (campaign, sandbox, start screen, autosave.js) keep
  their `window.storage` calls untouched — the door is the war's.

## Steps, in order

Step 1 — failing asserts first:

```
git status --porcelain src/ | grep -q . && echo STOP-dirty || echo OK-clean
grep -c "window\.storage\." src/depot/DepotGame.jsx   # expect 6
grep -c "window\.storage\." src/depot/save.js          # expect 3 (two call sites + the line-158 comment)
```

Counts other than shown: stop and report.

Step 2 — `src/platform/storage.js`, the named handle. Append at end of
file (after the shim's closing `}`):

```
// The named handle (the storage door, mk2.85): the same store, importable.
// Delegates to window.storage at CALL time — never captured — so the
// artifact runtime's own store still wins when it is present; headless
// callers get safe nulls. The shim above is unchanged.
export const storage = {
  async get(key) {
    if (typeof window === "undefined" || !window.storage) return { key, value: null };
    return window.storage.get(key);
  },
  async set(key, value) {
    if (typeof window === "undefined" || !window.storage) return { key, value: String(value) };
    return window.storage.set(key, value);
  },
  async delete(key) {
    if (typeof window === "undefined" || !window.storage) return true;
    return window.storage.delete(key);
  },
};
```

Step 3 — `src/depot/api.js`, the storage door. Directly after the sound
door's `export { makeGameAudio };` line, insert:

```
// The storage surface (the storage door, mk2.85): the war game's
// persistence comes through THIS file. The store itself stays the
// platform shim (artifact runtime first, localStorage behind it).
export { storage } from "../platform/storage.js";
```

Step 4 — `src/depot/save.js`, the repoint. Add to the imports at the top
of the file:

```
import { storage } from "../platform/storage.js";
```

Line 158's comment phrase `window.storage.set fire-and-forget` becomes
`storage.set fire-and-forget`. The two call sites:

```
  try { if (window.storage && window.storage.delete) await window.storage.delete(SAVE_KEY); } catch (e) {}
```

becomes

```
  try { await storage.delete(SAVE_KEY); } catch (e) {}
```

and

```
  try { const r = await window.storage.get(SAVE_KEY); raw = r && r.value; } catch (e) {}
```

becomes

```
  try { const r = await storage.get(SAVE_KEY); raw = r && r.value; } catch (e) {}
```

Step 5 — `src/depot/DepotGame.jsx`, the repoint. The api import line
(line 33) gains the name:

```
import { serializeRun, makeRenderer, renderPortrait, makeGameAudio, storage } from "./api.js";
```

Then each of the six call sites (lines 354, 364, 597, 606, 642, 1777)
replaces `window.storage.` with `storage.` — the surrounding code
identical. The line-393 comment mention (`window.storage (the
artifact/Pages shim)`) becomes `the storage door (the artifact/Pages
shim behind it)`.

Step 6 — the arithmetic before gates:

```
grep -c "window\.storage" src/depot/DepotGame.jsx src/depot/save.js   # expect 0 in each
node src/depot/api.js manifest src/depot/DepotGame.jsx
git diff --stat src/game/ src/ui/ src/render/ src/graphics/
```

Expected: zeros; DepotGame's `api.js` manifest key lists `storage`
beside the four existing names; the diff over the untouched directories
prints nothing. (`src/platform/storage.js` IS edited — additive export
only, the shim block byte-identical.)

Step 7 — the version bump. `src/version.js`:

```
export const MK = "mk2.85";
```

Step 8 — the headless gates, then build, preview restart, smoke (the
settled order):

```
node scripts/gate.mjs depot-test
node scripts/gate.mjs golden
node scripts/gate.mjs depot-lint
npm run build
fuser -k 4173/tcp 2>/dev/null; sleep 2
nohup npm run preview >/tmp/coldsnap-preview.log 2>&1 &
sleep 3; curl -sf http://localhost:4173/coldsnap/ >/dev/null && echo PREVIEW-UP || echo STOP-preview-down
node scripts/gate.mjs smoke
```

Expected: 2,089/0, 7/0, lint exit 0, build exit 0, PREVIEW-UP, smoke
30/0. Smoke matters here beyond the mark checks: its resume section
exercises probeFront/burnFront through the repointed calls. Any other
number: stop, do not commit, report.

Step 9 — commit and push (the landing includes the deploy):

```
git add src/platform/storage.js src/depot/api.js src/depot/save.js src/depot/DepotGame.jsx src/version.js
git commit -m "the storage door — the war's persistence comes through api.js, mk2.85"
git push
```

## ARITHMETIC acceptance

- `grep -c "window\.storage"` = 0 in DepotGame.jsx and save.js.
- Manifest: DepotGame's `api.js` key lists `storage`.
- `git diff` over `src/game/`, `src/ui/`, `src/render/`,
  `src/graphics/` empty; `src/platform/storage.js` diff is the appended
  export block only.
- depot-test 2,089/0; golden 7/0; depot-lint exit 0; smoke 30/0; build
  exit 0.

## Report

One line of outcome, then bullets: the grep counts, the manifest key
list, the four gate counts, the build result, the commit hash. Every
deviation its own labeled bullet.

## Closeout record (mk2.86, 2026-08-27)

Landed at commit 2491f15, mk2.85, under two amendments (both plan
defects, both caught by the agent's stop rule before commit): Amendment 1
reworded a second save.js comment the plan had not listed; Amendment 2
granted a one-pin sweep license — the teaching-cards T3 check re-spelled
old `window\.storage\.set(CARDS_KEY` to new `storage\.set(CARDS_KEY`,
same behavior guarded, no other test touched. The orchestrator finished
the gate tail and the commit on the owner's word after the agent stalled
post-depot-test. Gates at landing: depot-test 2,089/0, golden 7/0,
depot-lint clean, smoke 30/0 on the fresh bundle. README claims
re-measured: bundle 1,451,663 bytes (1.38 MB), 441 KB gzip — the door
cost 144 bytes raw; the floppy line and its headroom (now 22,897 bytes)
stand as written. The war game reaches boot, tick, save, drawing, sound,
and storage through src/depot/api.js alone. Closed.
