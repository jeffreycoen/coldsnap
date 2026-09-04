# The Jeep Toughened and Steadied (mk3.00)

The owner's orders (2026-09-04): double the jeep's health; tame the rollover by widening the spring stance to the hull's full width and dropping the ride height. Three numbers in one spec row. Nothing pins any of the old values — the hire card reads `JEEP.hp` live, no test asserts the jeep's hp or its spring dials (the suspension tests carry their own fixture springs).

Suggested model: Sonnet 5 — one file and the gates.

## Steps

1. In `src/depot/specs.js`, in the JEEP row, replace exactly:

```js
export const JEEP = { mass: 1100, hx: 0.85, hy: 0.55, hz: 1.6, hp: 90, bounty: 15, seats: 2, cost: 60, eye: 46,
  spd2h: 14, cap2h: 3.5, spd4l: 4, cap4l: 7,
  susp: { kx: 0.7, kz: 1.3, rest: 0.6, travel: 0.4, rate: 66000, damp: 6000 } }; // mk2.99: grown to the Willys' real footprint
```

with:

```js
export const JEEP = { mass: 1100, hx: 0.85, hy: 0.55, hz: 1.6, hp: 180, bounty: 15, seats: 2, cost: 60, eye: 46,
  spd2h: 14, cap2h: 3.5, spd4l: 4, cap4l: 7,
  susp: { kx: 0.85, kz: 1.3, rest: 0.48, travel: 0.4, rate: 66000, damp: 6000 } }; // mk2.99: grown to the Willys' real footprint // mk3.00 (owner): hp doubled; stance widened to the hull's edge and ride height dropped against the rollover
```

2. Gates, blocking: `node scripts/gate.mjs depot-test`, `node scripts/gate.mjs smoke` — green. No new tests: spec dials with nothing pinning them; the roll behavior is the owner's hands.
3. `src/version.js`: `mk2.99` → `mk3.00`. `npm run build` after the bump. Commit and push: `the jeep toughened and steadied — hp doubled, stance wide, ride low, mk3.00`. Include this plan file.

## Acceptance

`depot-test` and `smoke` exit 0. The owner's live check: the hire card reads HP 180; the jeep corners at speed without flipping where it used to, and still leans honestly. If the roll is still loose, the next dial is the inertia override — a separate plan on the owner's word.
