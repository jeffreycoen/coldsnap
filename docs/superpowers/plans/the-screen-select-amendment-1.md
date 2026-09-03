# The Screen Select — Amendment 1: the clamp-count pin

One pre-existing pin counts the literal `map.clampToRim(p.x, p.z)` call sites in DepotGame.jsx and requires exactly 4. The plan's Step 4 adds a legitimate fifth site — the group's ground tap is a tap becoming a destination, which is precisely what that clamp exists for. The pin's count is re-taught 4 → 5; the asserted content is otherwise identical. The plan should have pre-licensed this re-teach and did not; that omission is the plan-writer's.

In `scripts/tests/03-bell-polish.mjs`, replace exactly (currently lines 443–444):

```js
    ok("mk0.60/6: build points clamp to the rim through the same clamp shape (wee-t2b: map.clampToRim)",
      /const d = map\.clampToRim\(p\.x, p\.z\);/.test(dsrc) && (dsrc.match(/map\.clampToRim\(p\.x, p\.z\)/g) || []).length === 4);
```

with:

```js
    ok("mk0.60/6: build points clamp to the rim through the same clamp shape (wee-t2b: map.clampToRim)",
      /const d = map\.clampToRim\(p\.x, p\.z\);/.test(dsrc) && (dsrc.match(/map\.clampToRim\(p\.x, p\.z\)/g) || []).length === 5); // mk2.89: the group tap is the fifth site
```

## Dispatch state

Steps 1–9 are already applied on the tree and correct. On dispatch the agent applies the re-teach above, then resumes at Step 10 from the top: depot-test, depot-lint, smoke, all green, then Step 11 unchanged (bump to mk2.89, build, commit, push — the commit includes this amendment file and the re-taught test file). The re-teach is reported old→new in the landing report. Nothing else in the plan changes.
