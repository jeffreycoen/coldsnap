# Task 4 combined — Amendment 6: the last five test edits

The finish's gate came back 2,084 / 5. All five failures are now read and
anchored; this amendment writes their exact edits. Amendment 5's rule
stands: a passing check is never edited, split reads are added beside
shared ones, and any failure beyond these five at the next gate run stops
the task. Everything else in the plan and amendments 1–5 stands.

## The five edits

1. **03-bell-polish.mjs line 265** (resume re-claims with the bottom
   course) — re-point: the pattern
   `/if \(b\.course > 0\) continue;/` now tests a boot.js read (the text
   lives at boot.js:221). Add the split read beside line 254's `wsrc`
   per the rule.
2. **03-bell-polish.mjs line 266** (one emitter per wall) — re-point to
   the same boot.js read (the clause lives at boot.js:53).
3. **03-bell-polish.mjs lines 267–268** (counters count walls, not
   courses) — the two-fragment AND splits: the
   `walls\+\+` fragment tests the tick.js read (text at tick.js:157);
   the `nw\+\+` fragment keeps testing `wsrc` (the interface counter
   stays in DepotGame.jsx at line 2957). Both patterns byte-unchanged.
4. **08-debug-pass.mjs line 201** (green-threads cadence) — re-teach,
   old → new. The comment and cadence now live in two places: the flag
   set in tick.js and the path-building in the component keyed on the
   flag. The check re-teaches to assert both:
   old
   `/THE GREEN THREADS[\s\S]{0,200}?if \(terrGuard > 0\) \{/` on the
   tick read
   → new: two clauses joined by `&&` —
   `/THE GREEN THREADS[\s\S]{0,200}?if \(terrGuard > 0\) flags\.orderPaths = true;/`
   on the tick.js read, and
   `/THE GREEN THREADS[\s\S]{0,200}?if \(terrFlagged\) \{/`
   on the existing DepotGame.jsx read (text at DepotGame.jsx:2750–2752).
5. **09-reorg.mjs line 60** (the seat counter) — re-teach, old → new,
   licensed by amendment 2's substitution row (same re-teach the plan
   already names for 07-armor-demolition):
   old
   `/let apcSeqN = 0;/` and `/const nextApcSeq = \(\) => \+\+apcSeqN;/`
   on the DepotGame read
   → new
   `/war\.seq = \{ apc: 0 \};/` and
   `/const nextApcSeq = \(\) => \+\+war\.seq\.apc;/`
   on a boot.js split read (both lines live in boot.js; the check's
   label text "stays a mount let" re-signs to "lives on the war
   (task 4)" — the one label change, reported old→new).

## Then the landing, exactly as amendment 5 wrote it

The gates foreground, once each: depot-test (2,089 / 0 — a sixth
distinct failure stops), golden (7 / 0), smoke (30 / 0). The keystone
re-proof (the four recorded hashes, byte-equal). MK → `"mk2.74"` before
the build. The phase-document index update. One commit, the standing
subject and trailers, push.
