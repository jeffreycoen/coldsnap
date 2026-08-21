*Part of the P7 phase plan — hotfix, owner-approved 2026-08-15 ("knock it out"). Skeleton tasks 8-11 shift one mark.*

*HISTORY (stamped 2026-08-20, owner's order): this document is a record of shipped work, not authority. Design truth lives in CLAUDE.md and the ACTIVE phase's plan documents; where this file disagrees with them, it is wrong.*

# Hotfix — The fault names itself (mk1.37)

**What:** (1) the ENGINE FAULT overlay gains the error's top stack lines so the next screenshot names the throwing site; (2) platform/audio.js clamps every value it hands the browser to finite — the likeliest "non-finite" boundary becomes non-fatal.

**Step 1 — the overlay.** Both catch sites in DepotGame.jsx (the frame loop's and the boot's) extend setFatal:
```js
          const top = err && err.stack ? String(err.stack).split("\n").slice(0, 3).join(" ⏎ ") : "";
          setFatal(String(err && err.message ? err.message : err) + (top ? " — " + top : ""));
```
(comment: `// HOTFIX mk1.37: the overlay names the throwing SITE — "non-finite" alone left the fault anonymous on a phone`). The fatal overlay's text div already word-breaks; no style change.

**Step 2 — the audio boundary.** audio.js gains one helper near the top:
```js
  const fin = (v, d = 0) => (Number.isFinite(v) ? v : d); // HOTFIX mk1.37: the browser throws on non-finite params; a stray value degrades one sound, never the frame
```
Every assignment of a computed number to a WebAudio param (`.value =`, `.setValueAtTime(`, `.linearRampToValueAtTime(`, `.exponentialRampTo...`, `src.start(`, `.stop(`, pan/frequency/gain/playbackRate/delayTime) wraps its value in `fin(...)` — defaults: 0 for gains/pans, `ctx.currentTime` for times, 1 for rates, 440 for frequencies (any finite default is fine; the sound is already wrong if it fires). Exponential ramps additionally floor at 1e-4 (zero throws there).

**Step 3 — the pin.** depot-test gains a source-grep assert: audio.js's count of raw (unwrapped) `.value =` assignments to computed expressions is ZERO — count `\.value = fin\(` equals count `\.value = ` (literal-constant assignments like `.value = 0.5` may stay bare; the assert allows numeric literals via regex). Keep the assert simple and state its regex in a comment.

**Step 4 — ship.** version mk1.36 → mk1.37; gates: depot-test, depot-lint, build, smoke; commit exactly (src/depot/DepotGame.jsx, src/platform/audio.js, scripts/depot-test.mjs, src/version.js), push. Message: `hotfix: the fault names itself; audio never throws (mk1.37)`.

**Owner's live check:** nothing visible in normal play; if the fault ever fires again, the card now carries the site.
