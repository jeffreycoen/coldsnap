# THE VISIBLE GRENADE — task plan (proposed mark mk2.04)

**Goal.** The grenade draws: a green box blinking red fast, from throw to blast. Today it has no mesh at all.

**Suggested model:** Sonnet 5 — three small edits, one new check.

**Ruling recorded (owner, 2026-08-21):** grenades are green and blink red fast, and the blink QUICKENS as the fuse runs out — from ~6 Hz at the throw to ~20 Hz at the burst, per grenade. Render-only wall clock; the 2.0 s fuse literal is mirrored render-side, a display copy of GRENADE.fuse. Design dials, owner tunes live.

## Required reading (verified against the live tree)

- `src/render/renderer.js:1290-1310, 2369` — the mine pool idiom, setMines, the return object
- `src/depot/DepotGame.jsx:3595-3610` — the per-frame overlay section (the `R.overlay.setReticle` call's neighborhood)
- `scripts/tests/04-vision-command-possession.mjs` — the mk2.03 block's end

## Steps

### Step 1 — baseline, then the failing test

`node scripts/gate.mjs depot-test` clean; record PASS (expected 1760) BEFORE any edit. Append inside the mk2.03 block, before its closing brace (after the (g) sub-block):

```js
  // (h) mk2.04: the grenade is SEEN — a per-frame pool setter exists and the
  // game layer feeds it the live grenades.
  {
    const rendSrc = fs.readFileSync(new URL("../../src/render/renderer.js", import.meta.url), "utf8");
    const gameSrc = fs.readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");
    ok("VISIBLE GRENADE mk2.04(h): the renderer pools green grenades blinking red",
      /function setGrenades\(list, t\)/.test(rendSrc) && /0x35ff6a/.test(rendSrc) && /0xff2020/.test(rendSrc) && /period = 0\.05 \+ 0\.11 \* left/.test(rendSrc));
    ok("VISIBLE GRENADE mk2.04(h): the game feeds the live grenades every frame",
      /R\.setGrenades\(world\._grenades, world\.t\);/.test(gameSrc));
  }
```

Run depot-test. Expected: FAIL — the two new pins.

### Step 2 — the pool (renderer.js)

After `setMines`'s closing brace (`:1306` region), add:

```js
  // mk2.04 (owner): THE GRENADE, SEEN — green, blinking red, and the blink
  // QUICKENS as the fuse runs out (per grenade, its own clock). Instanced
  // box fed per frame by the game layer (R.setGrenades). Render-only; the
  // 2.0 here is a display mirror of GRENADE.fuse. // provisional (F5)
  const GREN_CAP = 32;
  const GREEN_C = new THREE.Color(0x35ff6a), RED_C = new THREE.Color(0xff2020);
  const grenMesh = pool(new THREE.BoxGeometry(0.22, 0.22, 0.22), new THREE.MeshBasicMaterial({ color: 0xffffff }), GREN_CAP, false);
  function setGrenades(list, t) {
    let gi = 0;
    if (list) for (const g of list) {
      if (!g.alive || gi >= GREN_CAP) continue;
      const left = g.grenade ? Math.max(0, 2.0 - (t - g.grenade.t0)) : 1;
      const period = 0.05 + 0.11 * left;   // ~6Hz fresh, ~20Hz at the burst
      grenMesh.setColorAt(gi, (performance.now() / 1000) % period < period / 2 ? RED_C : GREEN_C);
      writeInst(grenMesh, gi++, g.pos.x, g.pos.y, g.pos.z, null, 1, 1, 1);
    }
    if (grenMesh.instanceColor) grenMesh.instanceColor.needsUpdate = true;
    grenMesh.count = gi; grenMesh.instanceMatrix.needsUpdate = true;
  }
```

The return object (`:2369`) gains `setGrenades,` directly after `setMines,`.

### Step 3 — the feed (DepotGame.jsx)

In the per-frame overlay section, directly BEFORE the `R.overlay.setReticle(...)` call's `let rr9` block, add:

```js
          R.setGrenades(world._grenades, world.t); // mk2.04: the grenade is seen — green, blinking red, quickening
```

### Step 4 — gates and deploy

`node scripts/gate.mjs depot-test` (acceptance: baseline + 2 = 1762; a different number stops the task), `golden`, `depot-lint`; then `src/version.js` → `mk2.04`, build AFTER the bump, `node scripts/gate.mjs smoke` (server on :4173, killed after), commit everything as `the visible grenade, mk2.04`, push. The owner's live check, phone and desktop: green grenades blinking red through the air, the blink racing as the fuse runs out, the bounce, the roll, gone at the blast.

## Report requirements

- No new fixture seed (source pins only); all seeds untouched.
- Both depot-test PASS counts (baseline + 2 = 1762).
- Every deviation its own labeled bullet.
