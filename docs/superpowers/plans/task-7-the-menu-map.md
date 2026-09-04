# TASK 7 — THE MENU MAP (mk2.45)

Design: `tutorial-cards-and-launch-design.md`. The landing page draws the valley about to be played — a dimmed flat map from the same generator the war uses — and the seed is chosen at the menu and handed to the game. Resume shows the saved war's map; a new front shows the rolled one.

**Suggested model: Sonnet** — the drawing and plumbing are fully specified here. The look ships and the owner's live eyes are the acceptance; no screenshot loop.

## The seed law (from the design, restated as shipped behavior)

- The menu rolls `?seed=` if present, else `Date.now() % 1000000`, runs `makeMap`, and displays **the installed** `MAP_SEED` as FIELD ORDER # — `makeMap` bumps fouled seeds, so the shown number is always the map drawn.
- NEW FRONT hands that installed seed to the game; `DepotGame` re-runs `makeMap` on it at mount (its existing unconditional call), growing the identical map. `?seed=` in the game URL still wins (the smoke's pinned path). Resume and the sandbox are untouched.
- With a saved front, the background is the **save's** map. Arming the burn (first NEW FRONT tap) previews the fresh valley; disarming restores the save's map.

## Pre-licensed re-teach (one)

`scripts/smoke.mjs:85` — "no game canvas on the start screen" — the menu now carries exactly one canvas, the map. Re-taught to pin that: the `[data-menu-map]` canvas present and the canvas count exactly 1. Old→new reported.

## Required reading (read-confirmation opens the report)

1. This plan.
2. `src/ui/StartScreen.jsx` (all).
3. `src/ui/App.jsx` (all).
4. `src/depot/DepotGame.jsx` lines 905–935 (props/refs) and 1035–1060 (the boot's seed lines).
5. `src/depot/mapgen.js` lines 260–310 (`genMap`'s return and `makeMap`).
6. `scripts/smoke.mjs` lines 78–90.
7. `scripts/tests/25-the-teaching-cards.mjs` (all).

## Steps

### Step 1 — failing asserts first: append to era 25

```js
// ---- Task 7 (mk2.45): THE MENU MAP
{
  const ss = src("src/ui/StartScreen.jsx");
  const app = src("src/ui/App.jsx");
  const dg = src("src/depot/DepotGame.jsx");
  ok("T7: the menu draws the valley", /data-menu-map/.test(ss) && /makeMap\(seed\)/.test(ss) && /return MAP_SEED;/.test(ss));
  ok("T7: the burn arm previews the fresh valley", /if \(burnArmed\) paint\(newSeedRef\.current\);/.test(ss));
  ok("T7: the shell hands the menu's seed to the war", /setDepotSeed/.test(app) && /seed=\{depotSeed\}/.test(app));
  ok("T7: the war takes the menu's seed, URL still winning", /menuSeedRef\.current != null \? menuSeedRef\.current/.test(dg) && /Number\.isFinite\(urlSeed\) \? urlSeed/.test(dg));
  ok("T7: the smoke pins the one menu canvas", /data-menu-map/.test(src("scripts/smoke.mjs")));
}
```

Run `node scripts/gate.mjs depot-test` — the five FAIL. Record the PASS count.

### Step 2 — `src/ui/StartScreen.jsx`: the map

2a. Imports — after the existing four import lines:

```js
import { makeMap, MAP_SEED, TOWN, ROCKS, PONDS, ROADS, HILLS, STREAM, fwdU } from "../depot/mapgen.js";
import { MASON } from "../depot/specs.js";
```

2b. Above the component, the drawer:

```js
// THE MENU MAP (Task 7, mk2.45): the valley about to be played, drawn flat
// from the same generator the war uses. makeMap bumps a fouled seed, so the
// number returned — and shown, and handed on — is ALWAYS the installed
// MAP_SEED, never the request. Muted tones plus a final dim so the buttons
// carry; the owner's live look is the acceptance.
const drawMap = (cv, seed) => {
  makeMap(seed);
  const dpr = window.devicePixelRatio || 1;
  const w = cv.clientWidth * dpr, h = cv.clientHeight * dpr;
  cv.width = w; cv.height = h;
  const g = cv.getContext("2d");
  const sc = Math.min(w, h) / 195;
  const X = (x) => w / 2 + x * sc, Z = (z) => h / 2 + z * sc;
  g.fillStyle = "#12161c"; g.fillRect(0, 0, w, h);
  g.fillStyle = "#161c23"; g.fillRect(X(-90), Z(-90), 180 * sc, 180 * sc);
  for (const k of HILLS) { const p = fwdU(k.u, k.v); g.fillStyle = "rgba(38,46,55,0.8)"; g.beginPath(); g.arc(X(p.x), Z(p.z), k.r * sc, 0, 7); g.fill(); }
  for (const k of PONDS) { g.fillStyle = "#1c2a38"; g.beginPath(); g.arc(X(k.x), Z(k.z), k.r * sc, 0, 7); g.fill(); }
  g.strokeStyle = "#242b33"; g.lineWidth = Math.max(1, 2.2 * sc);
  for (const route of ROADS) { g.beginPath(); route.forEach(([x, z], i) => (i ? g.lineTo(X(x), Z(z)) : g.moveTo(X(x), Z(z)))); g.stroke(); }
  if (STREAM) {
    g.strokeStyle = "#1c3040"; g.lineWidth = (STREAM.w + 1) * sc; g.beginPath();
    STREAM.pts.forEach((p, i) => { const wp = fwdU(p.u, p.v); i ? g.lineTo(X(wp.x), Z(wp.z)) : g.moveTo(X(wp.x), Z(wp.z)); });
    g.stroke();
  }
  for (const k of ROCKS) { g.fillStyle = "#2b323b"; g.beginPath(); g.arc(X(k.x), Z(k.z), k.r * sc, 0, 7); g.fill(); }
  for (const t of TOWN) {
    const hx = (t.nx * MASON.pitch) / 2, hz = (t.nz * MASON.pitch) / 2;
    g.fillStyle = t.depot ? (t.team === 2 ? "#43333a" : "#33413a") : "#343b45";
    g.fillRect(X(t.x - hx), Z(t.z - hz), hx * 2 * sc, hz * 2 * sc);
    if (t.depot) {
      g.strokeStyle = t.team === 2 ? "#7a3a3a" : "#3a6a4a";
      g.lineWidth = Math.max(1, 1.5 * sc);
      g.strokeRect(X(t.x - hx), Z(t.z - hz), hx * 2 * sc, hz * 2 * sc);
    }
  }
  g.fillStyle = "rgba(14,16,20,0.52)"; g.fillRect(0, 0, w, h); // the dim — the buttons carry
  return MAP_SEED;
};
```

2c. Inside the component — the refs, the painter, and the three effects, placed after the existing `burnArmed` effect:

```js
  // THE MENU MAP's state: the canvas, the rolled seed (installed value),
  // and the FIELD ORDER # on display. Resume shows the SAVE's map; arming
  // the burn previews the fresh valley; disarming restores the save's.
  const mapCvRef = useRef(null);
  const newSeedRef = useRef(null);
  const [ord, setOrd] = useState(null);
  const paint = (s) => {
    const cv = mapCvRef.current;
    if (cv == null || s == null) return null;
    const inst = drawMap(cv, s);
    setOrd(inst);
    return inst;
  };
  useEffect(() => {
    const url = parseInt(new URLSearchParams(window.location.search).get("seed"), 10);
    const s = Number.isFinite(url) ? url : Math.floor(Date.now() % 1000000);
    const inst = paint(s);
    newSeedRef.current = inst != null ? inst : s;
  }, []);
  useEffect(() => { if (front && front.has && !burnArmed) paint(front.data.map.seed); }, [front]);
  useEffect(() => {
    if (burnArmed) paint(newSeedRef.current);
    else if (front && front.has) paint(front.data.map.seed);
  }, [burnArmed]);
```

2d. `startNewFront`'s two `onDepot()` calls become `onDepot(newSeedRef.current)` (lines 35 and 40).

2e. The render — the canvas behind, the column lifted, the seed line under the mark:

- First child of the root div (before the column div): `<canvas ref={mapCvRef} data-menu-map style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />`
- The column div's style gains `position: "relative", zIndex: 1`.
- After the `data-mk` line in the header block: `<div data-field-order style={{ fontSize: 10, opacity: 0.6, letterSpacing: 2, marginTop: 6 }}>FIELD ORDER #{ord ?? "—"}</div>`

### Step 3 — `src/ui/App.jsx`: the seed rides the shell

- New state beside `depotResume`: `const [depotSeed, setDepotSeed] = useState(null);`
- Line 151 becomes: `onDepot={(s) => { setDepotResume(null); setDepotSeed(s != null ? s : null); setScreen("depot"); }}`
- The depot mount (line 119) becomes: `return <DepotGame resume={depotResume} seed={depotSeed} onExit={() => { setDepotResume(null); setScreen("menu"); }} />;`

### Step 4 — `src/depot/DepotGame.jsx`: the war takes the menu's seed

- Signature: `export default function DepotGame({ onExit, resume = null, dev = false, seed: menuSeed = null })`
- Beside `resumeRef` (same discipline, captured once): `const menuSeedRef = useRef(menuSeed);`
- The seed const (lines 1040–1042) becomes:

```js
      const seed = RES ? RES.map.seed
        : dev ? Math.floor(Date.now() % 1000000)
        : Number.isFinite(urlSeed) ? urlSeed
        : menuSeedRef.current != null ? menuSeedRef.current
        : Math.floor(Date.now() % 1000000);
```

### Step 5 — the licensed smoke re-teach (`scripts/smoke.mjs:85`)

```js
    ok("the menu carries exactly the map canvas", (await page.$$("canvas")).length === 1 && (await page.$("[data-menu-map]")) !== null);
```

### Step 5b — AMENDMENT 1 (owner, 2026-08-25): three licensed re-teaches

Three smoke waits pin "back at the menu" as "no canvas on the page" — `smoke.mjs:99` (demo ESC), `:119` (sandbox ESC), `:142` (mech/tower-defense ESC). The menu now always carries the map canvas, so each wait times out. Re-teach each to the menu's own positive marker, the selector smoke's depot section already uses: `() => !document.querySelector("canvas")` becomes `() => !!document.querySelector('[data-menu="depot"]')` in all three `waitForFunction` calls (options objects untouched). Asserted behavior — ESC lands on the menu — unchanged. Each old→new reported. No other line moves.

### Step 5c — AMENDMENT 2 (owner, 2026-08-25): line 142 reverts

Amendment 1 overreached on `smoke.mjs:142`: that ESC path lands on the campaign order book, which carries no canvas and no `[data-menu="depot"]` marker — the original no-canvas wait was correct there all along. Line 142 reverts to `await page.waitForFunction(() => !document.querySelector("canvas"), { timeout: 20000 });`. Lines 99 and 119 keep Amendment 1's marker. Reported as its own bullet.

### Step 6 — gates

- `node scripts/gate.mjs depot-test` — green, +5 over Step 1.
- `node scripts/gate.mjs depot-lint` — green (all new code lives in `src/ui`; the depot fence is untouched).
- `node scripts/gate.mjs smoke` — green (the depot section's `?seed=11` path is unchanged: the URL seed wins inside DepotGame exactly as before).

### Step 7 — the deploy

Bump `src/version.js` to `mk2.45`; build after the bump; commit ("the menu map — the valley on the front door, mk2.45"); push. The owner's live check — the menu on phone and desktop, resume showing the saved valley, NEW FRONT arming showing the fresh one — is the acceptance.

## Report

Read-confirmation, one line of outcome, PASS counts before/after, the smoke re-teach old→new, gates and verdicts, commit hash, seeds (smoke's pinned 11; eras none). Every nonconformity its own labeled bullet.
