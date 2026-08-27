# The Settled Ground — Task 8: The Ridge Set Right (mk2.68)

*Written by Claude Fable 5, 2026-08-27, on the owner's live check of mk2.66: the roofs are inverted — every plate tilts its outer edge up, valley instead of peak. The cause is the rotation sign in the dressing walker; the fix is five sign flips in `layDressing` (`src/depot/mapgen.js`). No counts move, no test changes, no physics change. Rides after Task 7 (the roads) lands. Suggested model: Sonnet — five one-line edits.*

## The five flips, old→new, all in `layDressing`

**1. The pitched roof (houses, crofts, sheds, granary, mill, smithy, inn, springhouse, chapel):**
```js
        axis: ridgeX ? "x" : "z", angle: sgn * ang * (ridgeX ? -1 : 1), tint: "roof", mass: 320 });
```
```js
        axis: ridgeX ? "x" : "z", angle: sgn * ang * (ridgeX ? 1 : -1), tint: "roof", mass: 320 });
```

**2. The row houses' segments:**
```js
          hx: segL / 2 + 0.1, hy: 0.06, hz: slope, axis: "x", angle: -sgn * ang, tint: "roof", mass: 300 });
```
```js
          hx: segL / 2 + 0.1, hy: 0.06, hz: slope, axis: "x", angle: sgn * ang, tint: "roof", mass: 300 });
```

**3. The well's little roof:**
```js
        axis: "x", angle: -sgn * 0.6, tint: "roof", mass: 90 });
```
```js
        axis: "x", angle: sgn * 0.6, tint: "roof", mass: 90 });
```

**4. The belfry and watch cap (the pyramid):**
```js
        axis: ax, angle: -sgn * 0.7, tint: "roof", mass: 120 });
```
```js
        axis: ax, angle: sgn * 0.7, tint: "roof", mass: 120 });
```

**5. The smithy's awning (slopes down and outward):**
```js
      put({ dx: 0, dy: p * 2.45, dz: az + 0.35, hx: aw, hy: 0.05, hz: 0.95, axis: "x", angle: 0.3, tint: "roof", mass: 140 });
```
```js
      put({ dx: 0, dy: p * 2.45, dz: az + 0.35, hx: aw, hy: 0.05, hz: 0.95, axis: "x", angle: -0.3, tint: "roof", mass: 140 });
```

## Steps

1. `src/version.js`: the next sequential mark (mk2.68 if the roads landed as mk2.67).
2. The five flips.
3. Gates straight through: depot-test twice (2,091), depot-lint, `npm run build`, smoke.
4. Commit and push. Subject: `the ridge set right — the roofs peak, mk2.68`. Stage the two code files and this plan.

## License

The five flips and nothing else. No test moves — counts and body totals are unchanged. Any red stops the task.

## The owner's live check

Roofs peak at the ridge everywhere; the awning sheds outward; the belfry cap closes to a point. His eyes are the acceptance — the sign convention has now been wrong once, so the check is the proof.
