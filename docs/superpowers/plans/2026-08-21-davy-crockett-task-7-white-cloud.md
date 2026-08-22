# The Davy Crockett, task 7 — the white cloud, grown slow, held long (mk2.13)

Owner's rulings (2026-08-21): the mushroom cloud must be white; it should take longer to grow and stick around twice as long. Today every smoke particle wears one dark material color. The smoke pool gains per-instance color: battle smoke keeps its dark grey, the cloud's particles (the ones marked `drift`) paint white. The instance color multiplies the material color in the shader, so the material goes white and every instance is painted — the infantry pools' own rule.

The growth and the hold are the cloud's own dials in spawnNuke: the stem climbs at half speed and lives twice as long; the cap's lives double. Every number is a starting dial for the owner's eyes. Battle smoke's timing is untouched — the shared scale-growth curve stays where it is.

**Suggested model: Sonnet** — six edits in one file, all code carried.

## Required reading

- This plan.
- `src/render/renderer.js` lines 940–955 (smokeMat at 946, the pool at 950), 843–853 (the pool helper's instanceColor note), 1076–1100 (spawnNuke — the stem at 1085–1090, the cap at 1091–1096), 2233–2246 (the smoke write loop).
- `scripts/tests/19-the-atomic-look.mjs` whole.

## Step 1 — the failing check

In `scripts/tests/19-the-atomic-look.mjs`, after the line `ok("look: the davy palette joins the man loop", r.includes("DAVY_LIVE"));`, add:

```js
  ok("look: the cloud is white — drift particles paint their own color", r.includes("SMOKE_WHITE"));
```

Run `node scripts/gate.mjs depot-test` — the new check must FAIL. Confirm before any source moves.

## Step 2 — the smoke pool takes color (`src/render/renderer.js`)

Line 946:

```js
  const smokeMat = new THREE.MeshBasicMaterial({ color: 0x2c3036, transparent: true, opacity: 0.55, depthWrite: false });
```

becomes:

```js
  // mk2.13 (owner): THE WHITE CLOUD — the material goes white and every
  // instance paints itself (instance color multiplies material color, the
  // infantry pools' rule). Battle smoke keeps the old dark grey; the
  // mushroom cloud's drift particles wear white. // provisional (F5)
  const smokeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false });
  const SMOKE_GREY = new THREE.Color(0x2c3036), SMOKE_WHITE = new THREE.Color(0xf2f4f6);
```

Line 950, the pool gains instance color (`false` → `true`):

```js
  const smokeMesh = pool(new THREE.PlaneGeometry(1, 1), smokeMat, SMOKE_CAP, false); smokeMesh.layers.set(1);
```

becomes:

```js
  const smokeMesh = pool(new THREE.PlaneGeometry(1, 1), smokeMat, SMOKE_CAP, true); smokeMesh.layers.set(1);
```

## Step 3 — the write loop paints (`src/render/renderer.js`)

In the smoke step (line 2242):

```js
      if (si < SMOKE_CAP) smokeMesh.setMatrixAt(si++, dummy.matrix);
```

becomes:

```js
      if (si < SMOKE_CAP) { smokeMesh.setColorAt(si, p.drift ? SMOKE_WHITE : SMOKE_GREY); smokeMesh.setMatrixAt(si++, dummy.matrix); }
```

The line after the loop (2244):

```js
    smokeMesh.count = si; smokeMesh.instanceMatrix.needsUpdate = true;
```

becomes:

```js
    smokeMesh.count = si; smokeMesh.instanceMatrix.needsUpdate = true;
    if (smokeMesh.instanceColor) smokeMesh.instanceColor.needsUpdate = true;
```

## Step 4 — the slow growth and the long hold (`src/render/renderer.js`)

The stem line (1089):

```js
        vy: 4.5 + Math.random() * 2.5, s: 2.2 + Math.random() * 2 + t * 2, life: 6 + Math.random() * 3, age: 0, drift: true });
```

becomes:

```js
        vy: 2.2 + Math.random() * 1.2, s: 2.2 + Math.random() * 2 + t * 2, life: 12 + Math.random() * 6, age: 0, drift: true }); // mk2.13 (owner): half the climb, twice the life // provisional (F5)
```

The cap line (1095):

```js
        vy: 0.35 + Math.random() * 0.3, s: 3.5 + Math.random() * 3, life: 13 + Math.random() * 5, age: 0, drift: true });
```

becomes:

```js
        vy: 0.35 + Math.random() * 0.3, s: 3.5 + Math.random() * 3, life: 26 + Math.random() * 10, age: 0, drift: true }); // mk2.13 (owner): the cap hangs twice as long // provisional (F5)
```

## Step 5 — gates

- `node scripts/gate.mjs depot-test` — green, era 19 with its new check passing.
- `node scripts/gate.mjs golden` — green. The renderer moved; the frozen law demands it.

Any other failing check stops the task; no sweep license.

## Step 6 — the landing

- Bump `src/version.js`: `mk2.12` → `mk2.13`.
- `npm run build` AFTER the bump.
- Commit `the white cloud, mk2.13`, push.

The acceptance is the owner's, live on the site, phone AND desktop: the cloud rises white, battle smoke stays dark.

## Report

One line of outcome; both gate summaries verbatim; no fixture seed (era 19 builds no world — say so plainly); the commit hash; every deviation its own labeled bullet; skipped steps named as skipped.
