# TASK 8 — THE MENU MAP WEARS THE REAL LOOK (mk2.46)

Owner's ruling, 2026-08-25, off the live check: the menu map should look like the real map — snow, relief, the game's own colors — not a dark diagram. This task redraws it from the war's own heightfield with the renderer's palette. Look ships and the owner's live eyes are the acceptance.

**Suggested model: Sonnet** — the drawer is fully specified here.

## The method

- Build the real ground exactly as the war does: `makeMap(seed)`, then `makeField(181, 2.0, MAP_SEED)`, then `buildDepotTerrain(field, MAP_SEED)`.
- Shade it exactly as the renderer does (`syncTerrain`, `renderer.js:621–629`): snow `rgb(233,237,242)`, slope-darkened, the cool wet tint below the waterline — into a 181×181 image.
- **The depot's quarter (owner, 2026-08-25)**: the view is not the whole valley — a crop that fills the canvas, ~120 m across the short axis, centered on the player's depot nudged toward the valley's middle, so the depot and its approaches are the picture and the rest runs off the edges.
- Features in the game's own hues: pale-ice ponds, churned-gray roads, steel-gray rocks, pine dots from `planTrees()`, stone town blocks, the depots edged bison-blue (player) and scout-red (enemy), sky `#c4d2e0` beyond the rim.
- Legibility moves from a heavy map dim to a dark panel behind the menu column — the map stays bright and real; the buttons sit on their own glass.
- Colors are design choices, marked provisional; your live look rules them.

## Required reading (read-confirmation opens the report)

1. This plan.
2. `src/ui/StartScreen.jsx` (all — the whole `drawMap` is replaced).
3. `src/render/renderer.js` lines 600–636 (the shading being reproduced; read, not touched).
4. `scripts/tests/25-the-teaching-cards.mjs` (all).

## Steps

### Step 1 — failing asserts first: append to era 25

```js
// ---- Task 8 (mk2.46): THE MENU MAP WEARS THE REAL LOOK
{
  const ss = src("src/ui/StartScreen.jsx");
  ok("T8: the menu builds the war's own ground", /makeField\(181, 2\.0, MAP_SEED\)/.test(ss) && /buildDepotTerrain\(field, MAP_SEED\)/.test(ss));
  ok("T8: the trees are the war's own plan", /planTrees\(\)/.test(ss));
  ok("T8: the snow is shaded like the renderer's", /1 - Math\.min\(0\.45, g2 \* 0\.9\)/.test(ss));
  ok("T8: the column sits on its own glass", /rgba\(10,13,18,0\.78\)/.test(ss));
}
```

Run `node scripts/gate.mjs depot-test` — the four FAIL. Record the PASS count.

### Step 2 — `src/ui/StartScreen.jsx`: the imports grow

The mapgen import line gains `buildDepotTerrain, planTrees`; a new import brings the field builder:

```js
import { makeMap, MAP_SEED, TOWN, ROCKS, PONDS, ROADS, HILLS, STREAM, fwdU, buildDepotTerrain, planTrees } from "../depot/mapgen.js";
import { makeField } from "../engine/core.js";
```

(`HILLS` drops out of use — relief now draws the hills for real; keep or drop the token as the import line tidies, the tests do not pin it.)

### Step 3 — the drawer, replaced whole

```js
// THE MENU MAP (Task 7, re-dressed Task 8 mk2.46): the valley as the war
// actually shows it — the real heightfield under the renderer's own snow
// shading (syncTerrain's formula), features in the game's hues, the sky
// beyond the rim. makeMap bumps a fouled seed; the number returned — shown
// and handed on — is ALWAYS the installed MAP_SEED. Every hue here is a
// design choice (provisional); the owner's live look is the acceptance.
const drawMap = (cv, seed) => {
  makeMap(seed);
  const field = makeField(181, 2.0, MAP_SEED);
  buildDepotTerrain(field, MAP_SEED);
  const n = field.n;
  // the snow, shaded per cell like the renderer's syncTerrain bake
  const off = document.createElement("canvas");
  off.width = n; off.height = n;
  const og = off.getContext("2d");
  const img = og.createImageData(n, n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = j * n + i;
    const iw = i > 0 ? k - 1 : k, ie = i < n - 1 ? k + 1 : k;
    const jn = j > 0 ? k - n : k, js = j < n - 1 ? k + n : k;
    const g2 = Math.hypot(field.h[ie] - field.h[iw], field.h[js] - field.h[jn]) / (2 * field.cs);
    const shade = 1 - Math.min(0.45, g2 * 0.9); // provisional (F5) — steeper than the renderer's 0.3/0.62 so relief reads at map scale
    const wet = field.h[k] < -0.15;
    const p = k * 4;
    img.data[p] = 233 * shade * (wet ? 0.84 : 1);
    img.data[p + 1] = 237 * shade * (wet ? 0.9 : 1);
    img.data[p + 2] = 242 * shade * (wet ? 0.98 : 1);
    img.data[p + 3] = 255;
  }
  og.putImageData(img, 0, 0);
  const dpr = window.devicePixelRatio || 1;
  const w = cv.clientWidth * dpr, h = cv.clientHeight * dpr;
  cv.width = w; cv.height = h;
  const g = cv.getContext("2d");
  // THE DEPOT'S QUARTER (owner, 2026-08-25): not the whole valley — a crop
  // that FILLS the canvas, centered on the player's depot nudged toward the
  // valley's middle, so the depot and its approaches are the picture.
  const depotT = TOWN.find((t) => t.depot && t.team !== 2) || { x: 0, z: 0 };
  const cx0 = depotT.x * 0.72, cz0 = depotT.z * 0.72; // provisional (F5) — the nudge keeps the depot in frame with the valley opening past it
  const VIEW = 120; // provisional (F5) — meters across the short screen axis
  const sc = Math.max(w, h) / VIEW;
  const X = (x) => w / 2 + (x - cx0) * sc, Z = (z) => h / 2 + (z - cz0) * sc;
  g.fillStyle = "#c4d2e0"; g.fillRect(0, 0, w, h); // the sky beyond the rim
  // the snow image spans ±field.half; draw the whole sheet through the same
  // projection — the crop is the canvas edge, the rim clamps the overrun
  g.imageSmoothingEnabled = true;
  g.drawImage(off, X(-field.half), Z(-field.half), field.half * 2 * sc, field.half * 2 * sc);
  for (const k of PONDS) { g.fillStyle = "#cfe2ee"; g.beginPath(); g.arc(X(k.x), Z(k.z), k.r * sc, 0, 7); g.fill(); g.strokeStyle = "#9fb6c8"; g.lineWidth = Math.max(1, 0.8 * sc); g.stroke(); }
  g.strokeStyle = "rgba(116,130,148,0.75)"; g.lineWidth = Math.max(1, 2.6 * sc);
  for (const route of ROADS) { g.beginPath(); route.forEach(([x, z], i) => (i ? g.lineTo(X(x), Z(z)) : g.moveTo(X(x), Z(z)))); g.stroke(); }
  if (STREAM) {
    g.strokeStyle = "#9cc0d8"; g.lineWidth = (STREAM.w + 1) * sc; g.beginPath();
    STREAM.pts.forEach((p, i) => { const wp = fwdU(p.u, p.v); i ? g.lineTo(X(wp.x), Z(wp.z)) : g.moveTo(X(wp.x), Z(wp.z)); });
    g.stroke();
  }
  g.fillStyle = "#2e4638";
  for (const t of planTrees()) { g.beginPath(); g.arc(X(t.x), Z(t.z), Math.max(1, 0.9 * sc), 0, 7); g.fill(); }
  for (const k of ROCKS) {
    g.fillStyle = "#6b7686"; g.beginPath(); g.arc(X(k.x), Z(k.z), k.r * sc, 0, 7); g.fill();
    g.strokeStyle = "#4e5c6e"; g.lineWidth = Math.max(1, 0.7 * sc); g.stroke();
  }
  for (const t of TOWN) {
    const hx = (t.nx * MASON.pitch) / 2, hz = (t.nz * MASON.pitch) / 2;
    g.fillStyle = "#74828f";
    g.fillRect(X(t.x - hx), Z(t.z - hz), hx * 2 * sc, hz * 2 * sc);
    g.strokeStyle = t.depot ? (t.team === 2 ? "#8a4a44" : "#33619c") : "#4e5c6e"; // the war's own team steels
    g.lineWidth = Math.max(1, (t.depot ? 2 : 0.8) * sc);
    g.strokeRect(X(t.x - hx), Z(t.z - hz), hx * 2 * sc, hz * 2 * sc);
  }
  g.fillStyle = "rgba(14,16,20,0.18)"; g.fillRect(0, 0, w, h); // a whisper of dusk — the map stays bright
  return MAP_SEED;
};
```

### Step 4 — the column's glass

The column div's style (the one that gained `position: "relative", zIndex: 1` in Task 7) additionally gains:

```js
background: "rgba(10,13,18,0.78)", borderRadius: 10, padding: "24px 20px",
```

(The existing `padding: "24px 0"` is replaced by the padded form.)

### Step 5 — gates

- `node scripts/gate.mjs depot-test` — green, +4 over Step 1.
- `node scripts/gate.mjs depot-lint` — green (all in `src/ui`; the depot fence untouched; `makeField` draws no rng).
- `node scripts/gate.mjs smoke` — green (still exactly one canvas; no pinned text moves).

### Step 6 — the deploy

Bump `src/version.js` to `mk2.46`; build after the bump; commit ("the menu map wears the real look, mk2.46"); push. The owner's live check — phone and desktop — is the acceptance; hue adjustments after his look are follow-up rulings, not this task.

## Report

Read-confirmation, one line of outcome, PASS counts before/after, gates and verdicts, commit hash, seeds (smoke's pinned 11; eras none). Every nonconformity its own labeled bullet.
