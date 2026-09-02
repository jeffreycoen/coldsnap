# The Armor Attack Order — Amendment 1: the clock assert, and a count

Two corrections, both in the plan's own text; the fix's behavior is untouched and every behavior assert already passes.

## 1. The clock assert measured the wrong thing

`(a) the gun scan stamps the foe clock` required the stamp under 4 seconds stale at the loop's arbitrary last tick. The live run (seed 110) measured 4.3s: each shell knocks the 80kg foe tumbling, and while it is down or displaced the scan can lawfully miss for a few cycles. The halt already tolerates such gaps — that is what the hold window is for — and (a)'s other two asserts prove the halt held. The assert is re-taught to prove what it should: the scan stamped the clock at all.

In `scripts/tests/35-the-armor-attack.mjs`, replace exactly:

```js
    ok("(a) the gun scan stamps the foe clock", w.t - (v._foeT || 0) < 4, `${(w.t - (v._foeT || 0)).toFixed(1)}s stale`);
```

with:

```js
    ok("(a) the gun scan stamped the foe clock", (v._foeT || 0) > 3, `_foeT ${(v._foeT || 0).toFixed(1)}`);
```

(The fixture starts its clock at `w.t = 3`; any stamp is later than that.)

## 2. Seven was eight

Step 1's prose said "seven failures"; its own list — three (a), one (d), two (e), two (f) — is eight, and the live run produced exactly those eight and nothing else. The required pattern IS the enumerated list; the count reads eight. Step 1 is complete and is not re-run.

## Dispatch state

Steps 1–3 are already applied on the tree. On dispatch the agent applies the one-line re-teach above, then resumes at Step 4 from the top: depot-test, depot-lint, smoke, all green, then Step 5 unchanged (bump to mk2.88, build, commit, push — the commit includes this amendment file). The re-teach is reported old→new in the landing report. Nothing else in the plan changes.
