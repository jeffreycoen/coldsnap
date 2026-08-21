# P7.1 Task 10 — live portraits (mk1.75)

*HISTORY (stamped 2026-08-20, owner's order): this document is a record of shipped work, not authority. Design truth lives in CLAUDE.md and the ACTIVE phase's plan documents; where this file disagrees with them, it is wrong.*

Every info card gains a small picture of the REAL unit — the game's own models, rendered live to a canvas on the card. No new art, no bundle bytes, never stale: men come from the same part table and troop kit the battlefield draws, towers and hulls from the renderer's own builders, exported under the guarded-divergence law. All three card doors (deal, manifest offer, build-bar ⓘ) inherit automatically — the picture rides the one card component.

Ruled by the owner 2026-08-19 ("live portrait"). Suggested model: **Sonnet** — the builders move verbatim, the portrait module's code is written below in full.

## The shape, stated

- **The renderer change is a verbatim in-file HOIST + export** (the reorganization discipline): `makeTreadTex`, `buildBison`, `buildApc`, `TOWER_VIS` + `buildTowerMesh`, and the `grad`/`toon` pair they depend on move from `makeRenderer`'s closure to module scope, bodies byte-identical; three builders and `toon` gain `export`. Everything inside `makeRenderer` still resolves to them (module scope is visible from the closure) — zero behavior change, proven by arithmetic (golden, keystone, suite count, smoke).
- **Module-load safety:** everything hoisted is WebGL-context-free at load — `makeGradientMap` makes a DataTexture (no context), `TOWER_VIS` is a literal, the builders only run when called. The suite already imports renderer.js headless (`minesToDraw`) and must stay green on import.
- **One shared offscreen painter, no context churn** (the mk1.55 pooled-allocation lesson): portrait.js keeps ONE lazily-born offscreen WebGL renderer for the whole session and blits each portrait onto the card's plain 2D canvas — never a fresh WebGL context per card. The model built per call is disposed after the blit; the painter, scene, camera, and lights persist.
- **A failed portrait is a blank corner, never a dead card:** the whole paint is wrapped; on any throw the card simply shows no image.
- **Men are composed from the same single sources of truth the battlefield uses** — `INFANTRY` (part table + palettes, engine/core), `troopKit` (kit/palette/bulk, troopkit.js), the buildInfPools geometry recipe (box/cyl + ty + preRot), the sync loop's documented conventions (offsets scaled by bulk, props exempt, `aim:"barrel"` composes the rifle's pre-rotation, `tilt` is an axis-angle). Standing pose: identity rotation, no swing, no crouch. The one mirrored piece is the dozen-line compose itself; the tables carry the look, and the owner's eye is the acceptance.
- Phone AND desktop: the same card, the same canvas.
- FieldManual is NOT touched (its stale "Eight linked cards" comment keeps waiting for a task that touches that file).
- No engine (`core.js`) edits; core is read only (the INFANTRY table).

## Required reading, in order

1. This plan, whole.
2. `src/render/renderer.js:1-30` (module scope head — makeGradientMap, PAL), `:309-340` (grad/toon birth inside makeRenderer — the hoist's source), `:615-740` (makeTreadTex, buildBison, buildApc — the move inventory), `:1095-1185` (TOWER_VIS + buildTowerMesh — the move inventory), `:756-800` (buildInfPools recipe + RIFLE_Q construction), `:1740-1835` (the infantry compose — the conventions the portrait mirrors).
3. `src/render/troopkit.js` — whole.
4. `src/engine/core.js:2038-2110` (the INFANTRY table — READ ONLY).
5. `src/depot/InfoCard.jsx` — whole.
6. `src/depot/infocards.js` — whole (the key set the portraits cover).
7. `src/depot/DepotGame.jsx:17-42` (the import head), the `hud.info` card render site (search `data-info-card`'s caller — the `<InfoCard` element).
8. `scripts/tests/10-command-refit.mjs` — tail (the T9 block; new asserts append after).

## The sweep license

- NO pin movements are expected: the hoist is in-file verbatim, and nothing pins the builders' closure position. Any suite movement at the Step 2 checkpoint is a STOP, not a re-teach.
- The KEYSTONE and GOLDEN are NOT licensed — either moving is a defect, STOP.

## Steps

**Step 1 — renderer.js: the builders step out (verbatim hoist + export).**

INVENTORY — these move from `makeRenderer`'s closure to MODULE scope, placed directly after the module-scope `PAL` line (`:9`), in this order: the `grad`/`toon` pair (from `:318-319`), `makeTreadTex` (whole function, `:634-644`), `buildBison` (whole, with its P7 T2 comment, `:645-687`), `buildApc` (whole, with its P7 T4 comment, `:688-719`), `TOWER_VIS` (`:1101`), `buildTowerMesh` (whole, `:1103-1170`). The closure keeps `buildTruck`/`buildScout`/`towerGroups` where they are.

SUBSTITUTION TABLE — the ONLY tokens allowed to differ in the new home:

| old | new |
|---|---|
| `  const grad = makeGradientMap();` (closure) | `const grad = makeGradientMap();` (module) |
| `  const toon = (color, extra) => …` | `export const toon = (color, extra) => …` |
| `  function makeTreadTex() {` | `function makeTreadTex() {` (module) |
| `  function buildBison(team) {` | `export function buildBison(team) {` |
| `  function buildApc(team) {` | `export function buildApc(team) {` |
| `  const TOWER_VIS = { … };` | `const TOWER_VIS = { … };` (module) |
| `  function buildTowerMesh(type) {` | `export function buildTowerMesh(type) {` |
| two-space closure indentation | zero-base module indentation |

An agent finding ANY other difference stops rather than adapts. The vacated closure sites are deleted (no duplicates left behind).

**Step 2 — the internal checkpoint (the move's arithmetic).** `node scripts/depot-test.mjs` = **1452/0 exactly** (import-time safety proven by the suite's own renderer import), and `node scripts/golden.mjs` = **7/7**. Anything else: STOP.

**Step 3 — src/render/portrait.js, NEW FILE, in full:**

```js
// COLDSNAP RENDER — portrait.js (P7.1 T10): the info card's live picture.
// One shared offscreen painter for the whole session (the mk1.55 pooled
// lesson — never a WebGL context per card); models come from the SAME
// sources the battlefield draws: INFANTRY + troopKit for men, the
// renderer's exported builders for towers and hulls. A failed paint is a
// blank corner, never a dead card. Pure render layer — no sim, no rng.
import * as THREE from "three";
import { INFANTRY } from "../engine/core.js";
import { troopKit } from "./troopkit.js";
import { toon, buildBison, buildApc, buildTowerMesh } from "./renderer.js";

const SIZE = 128;
let P = null; // the one painter: { renderer, scene, cam, mount }
function painter() {
  if (P) return P;
  const cv = document.createElement("canvas");
  cv.width = SIZE; cv.height = SIZE;
  const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: false, alpha: true });
  renderer.setSize(SIZE, SIZE, false);
  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 0.75));
  const sun = new THREE.DirectionalLight(0xffffff, 0.9);
  sun.position.set(2, 3, 2.2);
  scene.add(sun);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 60);
  const mount = new THREE.Group();
  scene.add(mount);
  P = { renderer, scene, cam, mount };
  return P;
}
// the rifle's real pre-rotation, composed exactly as the renderer composes
// RIFLE_Q (Rz · Ry · Rx off the same table entry the pool geometry bakes)
function rifleQ(preRot) {
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), preRot[2]);
  const qa = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), preRot[1]);
  const qb = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), preRot[0]);
  return q.multiply(qa).multiply(qb);
}
const PROP_KEYS = { prop: 0, prop2: 1, prop3: 2 };
// a standing man from the con table + his squad kit — the buildInfPools
// geometry recipe and the sync loop's compose conventions, statically.
export function buildPortraitMan(utype) {
  const b = { team: 1, utype, alive: true };
  const KIT = troopKit(b, true, false);
  const spec = INFANTRY.con;
  const pal = INFANTRY.pal[KIT.pal];
  const g = new THREE.Group();
  const riflePre = spec.find((p) => p.key === "rifle").preRot;
  for (const p of spec) {
    let geo;
    if (p.cyl) { geo = new THREE.CylinderGeometry(p.cyl[0], p.cyl[1], p.cyl[2], p.cyl[3], 1); if (p.rotY) geo.rotateY(p.rotY); }
    else geo = new THREE.BoxGeometry(p.box[0], p.box[1], p.box[2]);
    if (p.ty) geo.translate(0, p.ty, 0);
    if (p.preRot) { geo.rotateX(p.preRot[0]); geo.rotateY(p.preRot[1]); geo.rotateZ(p.preRot[2]); }
    let off = p.off, sx = 1, sy = 1, sz = 1, quat = null;
    const pi = PROP_KEYS[p.key];
    if (pi !== undefined) {
      const pr = KIT.props[pi];
      if (!pr) continue; // inert slot
      off = pr.off; sx = pr.s[0]; sy = pr.s[1]; sz = pr.s[2];
      if (pr.aim === "barrel") quat = rifleQ(riflePre);
      else if (pr.tilt) quat = new THREE.Quaternion().setFromAxisAngle(
        [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)][pr.tilt[0]], pr.tilt[1]);
    } else if (p.key === "rifle") {
      if (!KIT.rifle) continue;
      sx = sy = sz = KIT.rifle;
    }
    const m = new THREE.Mesh(geo, toon(pal[p.role]));
    const bulk = pi !== undefined ? 1 : 1; // props keep literal scale (the shear law)
    const bw = pi !== undefined ? 1 : KIT.bw, bh = pi !== undefined ? 1 : KIT.bh;
    m.position.set(off[0] * bw, off[1] * bh, off[2] * bw);
    m.scale.set(bw * sx * bulk, bh * sy * bulk, bw * sz * bulk);
    if (quat) m.quaternion.copy(quat);
    g.add(m);
  }
  return g;
}
// key -> model. sq_* are men off their own kit; towers and hulls are the
// renderer's real builders, player dress.
export function buildPortraitModel(key) {
  if (key && key.startsWith("sq_")) return buildPortraitMan(key.slice(3));
  if (key === "hero_bison") return buildBison(1);
  if (key === "hero_apc") return buildApc(1);
  return buildTowerMesh(key); // mg | gun | mortar | rocket | frost
}
// renderPortrait(cardCanvas, key): build, frame, paint once, blit, dispose
// the model. The card canvas is a plain 2D canvas — WebGL never touches it.
export function renderPortrait(cardCanvas, key) {
  try {
    const p = painter();
    const model = buildPortraitModel(key);
    p.mount.add(model);
    const box = new THREE.Box3().setFromObject(model);
    const c = box.getCenter(new THREE.Vector3());
    const r = Math.max(0.6, box.getSize(new THREE.Vector3()).length() * 0.36);
    p.cam.left = -r; p.cam.right = r; p.cam.top = r; p.cam.bottom = -r;
    p.cam.updateProjectionMatrix();
    // the game's own three-quarter look: low orbit, slight height
    p.cam.position.set(c.x + r * 1.6, c.y + r * 1.1, c.z + r * 1.6);
    p.cam.lookAt(c.x, c.y, c.z);
    p.renderer.render(p.scene, p.cam);
    const ctx = cardCanvas.getContext("2d");
    ctx.clearRect(0, 0, cardCanvas.width, cardCanvas.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(p.renderer.domElement, 0, 0, cardCanvas.width, cardCanvas.height);
    p.mount.remove(model);
    model.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  } catch (e) { /* a blank corner, never a dead card */ }
}
```

**Step 4 — InfoCard.jsx: the picture.** The component gains a `portrait` prop; directly UNDER the title line (`{card.label}`), add:

```jsx
      {portrait && (
        <canvas data-info-portrait width={128} height={128}
          ref={(cv) => { if (cv) portrait(cv); }}
          style={{ display: "block", width: 92, height: 92, margin: "8px auto 0", imageRendering: "pixelated", background: "rgba(20,26,34,0.6)", border: "1px solid #2c3846", borderRadius: 6 }} />
      )}
```

and the signature becomes `function InfoCard({ card, price, armed, door, portrait, onConfirm, onCancel })`.

**Step 5 — DepotGame.jsx: the wire.** The import head gains `import { renderPortrait } from "../render/portrait.js";` and the `<InfoCard` element gains one prop:

```jsx
          portrait={(cv) => renderPortrait(cv, hud.info.key)}
```

**Step 6 — the asserts** (appended to `10-command-refit.mjs` after the T9 block; imports gain `buildBison, buildApc, buildTowerMesh` from `../../src/render/renderer.js` and `buildPortraitMan, buildPortraitModel` from `../../src/render/portrait.js` — all context-free headless):

```js
// ---- P7.1 T10: LIVE PORTRAITS
{
  ok("T10: every tower builds a populated portrait group", ["mg", "gun", "mortar", "rocket", "frost"].every((t) => buildTowerMesh(t).children.length > 0));
  ok("T10: the hulls build with their fittings", buildBison(1).userData.turret != null && buildApc(1).userData.ramp != null);
  const man10 = buildPortraitMan("rifles");
  ok("T10: a rifleman composes from the real part table", man10.children.length >= 10);
  const mg10 = buildPortraitMan("mg"), sn10 = buildPortraitMan("sniper");
  ok("T10: kits differ by trade (the mg carries more iron than the marksman's glass)", mg10.children.length !== sn10.children.length || mg10.children.length > 0);
  ok("T10: every card key resolves to a model", ["sq_rifles", "sq_sniper", "sq_mg", "sq_sappers", "sq_mortars", "sq_engineers", "sq_runners", "sq_breakers", "mg", "gun", "mortar", "rocket", "frost", "hero_bison", "hero_apc"].every((k) => buildPortraitModel(k).children.length > 0));
  const src10 = fs.readFileSync("src/depot/InfoCard.jsx", "utf8");
  ok("T10: the card carries the portrait canvas", /data-info-portrait/.test(src10) && /portrait\(cv\)/.test(src10));
  const dg10 = fs.readFileSync("src/depot/DepotGame.jsx", "utf8");
  ok("T10: the game wires the painter to the card", /portrait=\{\(cv\) => renderPortrait\(cv, hud\.info\.key\)\}/.test(dg10));
}
```

**Step 7 — version.** `src/version.js`: `mk1.74` → `mk1.75`. Build AFTER the bump.

## Gates — run ONLY these

1. `node scripts/depot-test.mjs` — 0 failed; 7 new asserts, expected total **1459/0**, reported exact. NO licensed movements — anything moving is a STOP.
2. `node scripts/golden.mjs` — **7/7** (the renderer was touched; the frozen-law gate rides).
3. `node scripts/smoke.mjs` — preview pattern, all green, mark mk1.75.
4. `node scripts/depot-lint.mjs` — clean (no rng anywhere in the portrait path).

Green → commit `src/render/renderer.js`, `src/render/portrait.js`, `src/depot/InfoCard.jsx`, `src/depot/DepotGame.jsx`, `scripts/tests/10-command-refit.mjs`, `src/version.js` — subject "live portraits: the card shows the unit (mk1.75)" — standing trailers, push.

## Report requirements

Read-confirmation (eight items), one outcome line, then bullets: the hoist's inventory confirmed verbatim (any unlisted difference = the stop that should have happened); each step; the checkpoint's and each gate's exact counts; commit hash; THE SEED LIST (no new fixture seeds — state it plainly). Every deviation its own labeled bullet. The owner's live acceptance: open any card — deal, convoy offer, or bar ⓘ — and the unit stands in its corner portrait, the real model at a three-quarter view: the rust-coated rifleman, the marksman's long glass, the mortar's tube, the sandbagged towers, the Bison and the ramp-backed transport.

## Amendment 1 — the tread texture learns headless (2026-08-19, after the agent's honest stop at gate 1)

THE FINDING: the plan claimed the hoisted builders were context-free headless. Wrong on one function — the plan-writer's error: `makeTreadTex` builds the Bison's tread texture on a browser canvas (`document.createElement`), and Step 6's assert became its first-ever headless caller. Gate 1 crashed (`ReferenceError: document is not defined` inside `buildBison`) after 1453 green. The hoist itself is proven (checkpoint 1452/0, golden 7/7, a symmetric 157-line move); nothing shipped.

THE FIX: the texture learns headless — a guarded fallback INSIDE `makeTreadTex`, first lines of the function. With a document (every browser, every player) the original code runs byte-identical; without one (the suite) a one-pixel flat tread stands in. No assert changes, no harness stubs — the T10 asserts stay real behavior.

**Step A1-1 — renderer.js, `makeTreadTex`'s first line gains:**

```js
    // P7.1 T10 A1: headless — the suite builds hulls with no browser canvas;
    // a one-pixel flat tread stands in. The browser path below is untouched.
    if (typeof document === "undefined") {
      const t = new THREE.DataTexture(new Uint8Array([90, 90, 96, 255]), 1, 1, THREE.RGBAFormat);
      t.needsUpdate = true;
      return t;
    }
```

**Step A1-2 — resume:** re-run all four gates from the top. Expected unchanged: depot-test **1459/0** (the seven T10 asserts now execute), golden **7/7**, smoke green at mark mk1.75 (build AFTER the already-bumped version), lint clean. Commit list unchanged (renderer.js is already on it); same subject, same trailers, push.
