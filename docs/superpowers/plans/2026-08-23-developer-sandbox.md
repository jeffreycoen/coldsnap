# The Developer Sandbox — the complete plan

Three tasks, dispatched one at a time, each its own deploy: mk2.24 the door and the free bench, mk2.25 the enemy rack, mk2.26 the fight switch. Design rulings are the owner's, this session (2026-08-23), recorded here — there is no separate design file.

**The rulings (owner, 2026-08-23):**

- A test bench for any weapon, on a random map, populated with enemies by hand, with a live switch for whether they fight back.
- Reached by a MAIN MENU entry. Random map on entry, with a reroll button mid-session.
- Weapons are a FREE pick list — every buyable, no money.
- Enemies: EVERY kind that exists, placed one tap at a time.
- Fight-back: a LIVE toggle, flippable any time.
- The sandbox NEVER SAVES. Leaving discards everything.
- Structure: a developer switch inside the existing war screen (`DepotGame` gains a `dev` prop) — one file, one truth; the "separate module" is its own menu entry and screen name. (Owner ruled this over a copied file.)
- **SYMMETRY EXEMPTION, recorded as knowing:** the sandbox is one-sided by design — free weapons for the player, hand-placed enemies as targets. The owner rules the sandbox exempt from the symmetry law. The exemption is permanent to the sandbox and closes with no task: it IS the feature. The live war path is untouched by every change below (each is gated on `dev`, default false), so the war's own symmetry never moves.

**The one law every task lives under:** with `dev` false, every touched file behaves byte-for-byte as it does today. No save-resident key or shape changes anywhere (saves are never migrated; the sandbox never writes one).

---

## Task 1 — the door and the free bench (mk2.24)

**Suggested model: Sonnet 5** — every step carries its code; nothing is designed at dispatch.

**Required reading:** this task's section in full; `src/ui/App.jsx` (150 lines, whole file); `src/ui/StartScreen.jsx` (115 lines, whole file); `src/depot/DepotGame.jsx:835-882, 917-945, 1295-1400, 1477-1500, 1540-1560, 1620-1635, 2555-2590, 2680-2690, 2725-2745, 2768-2795, 3310-3320, 3520-3530, 3680-3695, 4406-4430, 4763-4785`; `src/depot/specs.js:196-208` (PLAYER_START); `scripts/tests/22-the-tesla-coil.mjs` (the suite idiom). The agent's report opens by confirming each was read.

### Step 1 — the failing asserts

A new suite era file. Component internals cannot run headlessly, so these are text pins — each pins one wiring fact a later step lands; behavior pins arrive in Task 3 where an exported seam exists. Fixture seed: none (no world is built). It fails until the later steps land.

Create `scripts/tests/23-the-sandbox.mjs`:

```js
// COLDSNAP suite era 23 — THE DEVELOPER SANDBOX (mk2.24-mk2.26). A dev
// switch inside the war screen: menu door, free prices, no bell, no save,
// no ending, reroll. Text pins over the component (it cannot run headless);
// the fight switch's one exported seam gets behavior pins in the mk2.26
// block appended by Task 3. No seed is special; no seed is used.
import { ok } from "./harness.mjs";
import { readFileSync } from "node:fs";

const src = (p) => readFileSync(new URL("../../" + p, import.meta.url), "utf8");
const dg = src("src/depot/DepotGame.jsx");
const app = src("src/ui/App.jsx");
const start = src("src/ui/StartScreen.jsx");

ok("sandbox: the war screen takes the dev switch", dg.includes("dev = false"));
ok("sandbox: the app routes the sandbox screen", app.includes('"devsandbox"') && app.includes("<DepotGame dev"));
ok("sandbox: a reload never resumes into it", !app.match(/RESUME_SCREENS = new Set\(\[[^\]]*devsandbox/));
ok("sandbox: the menu has the door", start.includes('data-menu="devsandbox"'));
ok("sandbox: prices are free on the bench", dg.includes("dev ? 0 :"));
ok("sandbox: the pace gate opens", dg.match(/buyPaced = \(\) => \{\s*\n\s*if \(dev\) return true;/));
ok("sandbox: the bell never rings", dg.includes("if (!dev && stepBell(S, world.t))"));
ok("sandbox: the save is never written", dg.match(/const saveFront = \(\) => \{\s*\n\s*if \(dev\) return;/));
ok("sandbox: the war never ends on the bench", dg.includes("if (!dev) stepDepotCensus"));
ok("sandbox: everything is unlocked", dg.includes("S.manifest.unlocked = PALETTE.map((p) => p.key)"));
ok("sandbox: the reroll button exists", dg.includes("data-dev-reroll"));
```

Run `node scripts/gate.mjs depot-test` — the new file must FAIL before Step 2. Report the failure.

### Step 2 — the door

`src/ui/App.jsx:118-120` — after the `"depot"` route, add:

```jsx
  if (screen === "devsandbox") {
    // the developer sandbox (mk2.24): the war screen under its dev switch —
    // never in RESUME_SCREENS, so a reload lands on the menu, never here.
    return <DepotGame dev onExit={() => setScreen("menu")} />;
  }
```

`src/ui/App.jsx:78` — the ESC effect's screen list gains the sandbox. The condition becomes:

```js
    if (!GAME_SCREENS.has(screen) && screen !== "campaign" && screen !== "mechrange" && screen !== "towerdef" && screen !== "depot" && screen !== "devsandbox") return; // the order book and the mech range exit on ESC too (range stays out of GAME_SCREENS: it reads raw key codes, no remap)
```

`src/ui/App.jsx:145-149` — the StartScreen mount gains the prop:

```jsx
  return <StartScreen
    onDepot={() => { setDepotResume(null); setScreen("depot"); }}
    onDepotResume={(data) => { setDepotResume(data); setScreen("depot"); }}
    onDemos={() => setScreen("demos")}
    onDevSandbox={() => setScreen("devsandbox")}
    onControls={() => setScreen("controls")} />;
```

`RESUME_SCREENS` (App.jsx:18) is NOT touched — the pin in Step 1 proves it.

`src/ui/StartScreen.jsx:9` — the signature gains `onDevSandbox`:

```js
export default function StartScreen({ onDepot, onDepotResume, onDemos, onDevSandbox, onControls }) {
```

`src/ui/StartScreen.jsx:105-107` — directly after the CONTROLS button, add:

```jsx
        <button data-menu="devsandbox" style={{ ...option(), marginTop: 8, opacity: 0.7, fontSize: 12 }} onClick={onDevSandbox}>
          SANDBOX — test any weapon on a fresh valley →
        </button>
```

Phone and desktop: the menu is one shared layout (`min(420px, 92vw)`); the button serves both.

### Step 3 — the dev switch

`src/depot/DepotGame.jsx:835` — the signature becomes:

```js
export default function DepotGame({ onExit, resume = null, dev = false }) {
```

`dev` is a constant primitive for the life of the mount — closing over it inside the mount effect is safe (the effect's no-changing-React-values law guards values React can change; a screen switch unmounts before `dev` could differ). Stated so the agent does not build a ref for it.

`src/depot/DepotGame.jsx:939-940` — the seed line becomes (dev ignores `?seed=` so every entry and every reroll lands fresh ground):

```js
      const seed = RES ? RES.map.seed
        : dev ? Math.floor(Date.now() % 1000000)
        : Number.isFinite(urlSeed) ? urlSeed : Math.floor(Date.now() % 1000000);
```

`src/depot/DepotGame.jsx:865-877` — the field-manual auto-open effect's guard becomes:

```js
    if (resumeRef.current || dev) return; // a resumed war is not a first entry; the sandbox never tours
```

(the effect's dependency array stays `[]` — `dev` is mount-constant, above).

### Step 4 — the free bench

`src/depot/DepotGame.jsx:1392-1394` — the fresh-boot muster block becomes:

```js
      if (!RES && !dev) {
        musterFreshStart(world, S, depotP, grid, field, nextApcSeq);
      }
      if (dev) {
        // mk2.24: THE SANDBOX OPENING — no draft, no enemy opening, no
        // commander (nothing bell-driven ever reads S.cmdr here). The war
        // starts standing, every plan unlocked, and the till is dead weight:
        // priceNow answers 0 on the bench.
        S.started = true;
        S.manifest.unlocked = PALETTE.map((p) => p.key);
      }
```

(musterFreshStart's rng draws are skipped whole in dev — the draw-count law binds live streams against each other; the sandbox is its own stream and never saves, so nothing compares against it. Stated so the agent does not preserve draws.)

`src/depot/DepotGame.jsx:1483` — priceNow becomes:

```js
      const priceNow = (key, base) => (dev ? 0 : S._market && S._market.player[key] != null ? S._market.player[key] : base);
```

`src/depot/DepotGame.jsx:1484-1487` — buyPaced becomes:

```js
      const buyPaced = () => {
        if (dev) return true;
        if (world.t - S._buyAt < 1) { toast("THE MARKET PACES YOU — one purchase a second"); return false; }
        return true;
      };
```

**The held-ground waiver** — the bench builds anywhere on the field. Each of these call sites changes `canBuild(T, c0.u, c0.v)` to `(dev || canBuild(T, c0.u, c0.v))`:

- `src/depot/DepotGame.jsx:1497` (buildAt's early gate)
- `src/depot/DepotGame.jsx:1552` (canBuildAt's validatePlacement `held:`)
- `src/depot/DepotGame.jsx:1628` (canPlaceInfantryAt's validatePlacement `held:`)
- `src/depot/DepotGame.jsx:2683` (placeHire's gate)
- `src/depot/DepotGame.jsx:2738` (placeHero's gate)

`src/depot/DepotGame.jsx:2775-2777` — refreshZone's heldAt becomes:

```js
        const heldAt = dealPhase
          ? (x, z) => Math.hypot(x - depotP.x, z - depotP.z) <= HOMELAND_R
          : dev ? () => true
          : (x, z) => { const c = invW(x, z); return canBuild(T, c.u, c.v); };
```

`src/depot/DepotGame.jsx:3003` (the `__DEPOTCELL__` debug read) is NOT touched — a diagnostic answers the true territory, dev or not.

Wall cost (`buildAt`'s `WALL_COST` fallback at :1500) rides `priceNow`'s tower path only for towers; the wall's own cost line becomes:

```js
        const cost = spec ? priceNow(mode, spec.cost) : (dev ? 0 : WALL_COST); // walls: no TOWER_SPECS row, state.js owns the price
```

Field lines (engineer bags/walls, sapper mines/wires) pay through `stepBuildLine`'s `S.resources` reads — free by a different handle: the sandbox till never runs dry because in dev the mount stamps income irrelevant and `S.resources` starts at 250 and climbs 1/s. Accepted as-is for mk2.24: the pick LIST is free (the ruling); a long engineer line spending pocket scrap on the bench is the one place money still moves, and the owner sees ◆ tick normally. Stated, deliberate — if it grates in play it is one more `dev ? 0 :` at `layPieceAt`'s two cost reads, a polish-queue line, not this task.

### Step 5 — no bell, no save, no ending

`src/depot/DepotGame.jsx:3527` — the bell line becomes:

```js
            if (!dev && stepBell(S, world.t)) { ringBell(); S.manifest.armedAtWall = performance.now() / 1000 + PENDING_ARM_S; }
```

(The pre-toll block under it reads a bell countdown that never moves — `bellSec` stays constant, the edge never fires, no cue. The top-bar bell chip shows a frozen `BELL 1 · 1:30`; Step 6 hides it in dev.)

`src/depot/DepotGame.jsx:2561-2562` — saveFront's first line becomes:

```js
      const saveFront = () => {
        if (dev) return; // mk2.24: the sandbox never saves — the one rng draw below is never drawn either (no live stream compares against a sandbox run)
```

`src/depot/DepotGame.jsx:2585-2589` — burnSave's first line gains the same guard:

```js
      const burnSave = () => {
        if (dev) return; // the sandbox owns no slot to burn — a real front's save must survive a sandbox session untouched
```

(The second guard is load-bearing: without it, a sandbox run that somehow ended would burn the player's REAL saved front — `SAVE_KEY` is one slot.)

`src/depot/DepotGame.jsx:3688` — the census call becomes:

```js
          if (!dev) stepDepotCensus(S, sdt, () => ({
            player: depotStandingFraction(depotCensus, world.byId),
            enemy: depotStandingFraction(depotCensus2, world.byId),
          }));
```

(Both breach verdicts live inside it — with it gated, the sandbox war never ends; knock either depot flat and keep shooting. `checkLoss` in drainEvents stays: its only live trigger is the regiment stub, always false.)

### Step 6 — the reroll and the chrome

`src/depot/DepotGame.jsx:4406-4407` — directly before the ⟳ rotate button, add:

```jsx
        {dev && (
          <button data-dev-reroll style={{ ...P.btn, marginLeft: "auto", padding: isTouch ? "5px 10px" : "4px 10px", borderColor: "#c9a04e", color: "#ffd27a" }} title="a fresh random valley — everything here is discarded" onClick={restart}>
            NEW VALLEY
          </button>
        )}
```

and the ⟳ button loses its `marginLeft: "auto"` ONLY when dev (the reroll takes the spacer role); simplest exact form — the ⟳ style becomes:

```jsx
        <button style={{ ...P.btn, marginLeft: dev ? undefined : "auto", padding: isTouch ? "5px 10px" : "4px 10px" }} title="rotate view (Q/E)"
```

(`restart` at :882 resets fatal/hud and bumps runId — full remount; the dev seed line draws a fresh valley. Phone and desktop: the top bar wraps (`flexWrap`), same DOM both.)

`src/depot/DepotGame.jsx:4374-4378` — the bell chip hides on the bench. The wrapping div's condition: wrap the existing `data-bell` div in `{!dev && ( ... )}`.

`src/depot/DepotGame.jsx:4763` — the pre-start overlay condition gains `&& !dev` (the sandbox starts standing; the overlay never shows):

```jsx
      {!hud.started && !hud.placing && !hud.drafting && !fatal && !dev && (
```

`src/depot/DepotGame.jsx:4785` — same guard on the manual mount line: append `&& !dev` to its condition.

### Step 7 — gates and the landing

- `node scripts/gate.mjs depot-test` — era 23 passes; every other era untouched (dev is false everywhere the suite drives). The sweep license covers only literal text this task moves; any behavior failure stops the task.
- `node scripts/gate.mjs golden` — byte-identical demo.
- `node scripts/gate.mjs depot-lint` — no `Math.random` entered src/depot (the seed line uses `Date.now`, the existing idiom on the very line it extends).
- `node scripts/gate.mjs smoke` — the live war path, dev false, unchanged.
- Bump `src/version.js` to `mk2.24`, THEN build. Gates green → commit → push. The owner's live check: the menu door, a fresh valley, the free build bar with every weapon, NEW VALLEY, no bell ever, leave and re-enter discards, and the REAL war (NEW FRONT / RESUME FRONT) untouched — phone and desktop.

---

## Task 2 — the enemy rack (mk2.25)

**Suggested model: Sonnet 5.**

**Required reading:** this task's section in full; `src/depot/DepotGame.jsx:743-830 (PALETTE, TREE_BRANCHES), 1600-1700 (SQUAD_MODE, placePick), 2267-2405 (tapAt), 2680-2765 (placeHire/placeHero hull+mech branches), 4709-4761 (the build bar)`; `src/depot/units.js:22-83 (spawnUnit/spawnTank)`; `src/depot/muster.js:126-161 (parkTower's place shape)`; `src/depot/specs.js:34-135 (TOWER_SPECS, ENEMY_SPECS, TANK, BISON, APC, MECH)`; `src/engine/mech.js` — the `buildMech` signature only (grep `export function buildMech`). Read-confirmation opens the report.

Everything the enemy can be, placeable by tap. These spawn as the game's own enemies — flow-field marchers, real drivers, real towers — so with the fight switch at FIGHT (Task 3's default, and mk2.25's only mode) they attack the moment they land. That is correct for this deploy and stated in the report.

### Step 1 — the failing asserts

Append to `scripts/tests/23-the-sandbox.mjs`:

```js
{ // mk2.25: the enemy rack
  const dg2 = src("src/depot/DepotGame.jsx");
  ok("rack: the foe list exists", dg2.includes("FOE_RACK"));
  ok("rack: the branch is dev-only", dg2.match(/TREE_BRANCHES[\s\S]{0,400}foes/) || dg2.includes('branch === "foes"'));
  ok("rack: a ground tap spawns", dg2.includes("devSpawnAt"));
  ok("rack: every infantry tag is racked", ["rocket", "gren", "sapper", "mortar", "sniper", "mg", "eng", "medic", "mechanic", "davy", "tank"].every((t) => dg2.match(new RegExp("FOE_RACK[\\s\\S]{0,2400}tag: \"" + t + "\""))));
}
```

Run `node scripts/gate.mjs depot-test` — the block must FAIL before Step 2.

### Step 2 — the rack

`src/depot/DepotGame.jsx` — after `PALETTE_LABEL` (:777), add the module const:

```js
// mk2.25: THE ENEMY RACK (sandbox only). Every kind the enemy can field,
// placeable by tap on the bench. tag rows spawn through units.js spawnUnit
// (the marksman pair and the wave tank come out of it whole); hull/mech/
// tower rows mirror the enemy's own park shapes at the tapped cell. n is
// men per tap — the same head-count one enemy buy fields.
const FOE_RACK = [
  { key: "foe_rifle", label: "CONSCRIPT", icon: "∴", tag: "", n: 1 },
  { key: "foe_rocket", label: "ROCKETS", icon: "▲", tag: "rocket", n: 2 },
  { key: "foe_gren", label: "GRENADIERS", icon: "◎", tag: "gren", n: 2 },
  { key: "foe_sapper", label: "SAPPERS", icon: "✸", tag: "sapper", n: 2 },
  { key: "foe_mortar", label: "MORTARS", icon: "◎", tag: "mortar", n: 2 },
  { key: "foe_sniper", label: "MARKSMAN PAIR", icon: "✛", tag: "sniper", n: 1 },
  { key: "foe_mg", label: "MG TEAM", icon: "≣", tag: "mg", n: 2 },
  { key: "foe_eng", label: "ENGINEER", icon: "⚒", tag: "eng", n: 1 },
  { key: "foe_medic", label: "MEDIC", icon: "✚", tag: "medic", n: 1 },
  { key: "foe_mechanic", label: "MECHANIC", icon: "⚙", tag: "mechanic", n: 1 },
  { key: "foe_davy", label: "ATOMIC CREW", icon: "☢", tag: "davy", n: 2 },
  { key: "foe_tank", label: "WAVE TANK", icon: "⛨", tag: "tank", n: 1 },
  { key: "foe_bison", label: "BISON", icon: "⛨", hull: "bison" },
  { key: "foe_apc", label: "APC", icon: "⬒", hull: "apc" },
  { key: "foe_mech", label: "MECH", icon: "✇", mech: true },
  { key: "foe_t_mg", label: "MG TOWER", icon: "⊞", tower: "mg" },
  { key: "foe_t_gun", label: "GUN TOWER", icon: "⚑", tower: "gun" },
  { key: "foe_t_mortar", label: "MORTAR TOWER", icon: "◎", tower: "mortar" },
  { key: "foe_t_rocket", label: "ROCKET TOWER", icon: "▲", tower: "rocket" },
  { key: "foe_t_tesla", label: "TESLA TOWER", icon: "⚡", tower: "tesla" },
];
const FOE_RACK_BY_KEY = Object.fromEntries(FOE_RACK.map((f) => [f.key, f]));
```

Notes the rack states in the report, not fixes: the enemy engineer stands idle (his build lines are bell-driven and the bell never rings); the enemy medic/mechanic tend their own wounded near where they stand; the enemy sapper marches for the player's depot and plants — that IS his kind.

### Step 3 — the spawner

`src/depot/DepotGame.jsx` — inside the mount, beside `placeHero` (:2727), add:

```js
      // mk2.25: THE ENEMY RACK's placer — sandbox only. Real spawners, real
      // vets where the kind has one (a hull still refuses a slope), team 2
      // throughout. rng draws are lawful here: the sandbox is its own
      // stream and never saves.
      const devSpawnAt = (p) => {
        const it = FOE_RACK_BY_KEY[S.devSpawn];
        if (!it) return;
        const d = clampToRim(p.x, p.z);
        if (streamAt(d.x, d.z)) { toast("OPEN WATER"); return; }
        if (it.tower) {
          const g = grid.worldToGrid(d.x, d.z);
          if (!grid.inBounds(g.gx, g.gz)) { toast("OFF THE FIELD"); return; }
          const cell = grid.cells[grid.idx(g.gx, g.gz)];
          if (cell.water || cell.ice || cell.blocked || cell.wallId) { toast("NO GROUND"); return; }
          const wp = grid.gridToWorld(g.gx, g.gz);
          const spec = TOWER_SPECS[it.tower];
          const b = addBody(world, { kind: "tower", team: 2, mass: 0, hx: 0.8, hy: spec.hy, hz: 0.8, x: wp.x, y: field.heightAt(wp.x, wp.z) + spec.hy, z: wp.z, hp: spec.hp });
          b.towerType = it.tower; b.flagPole = true; b.maxHp = b.hp;
          b.effRange = effRange(world, { x: b.pos.x, y: b.pos.y + b.hy + 0.45, z: b.pos.z }, spec);
          b.discipline = "free"; // the enemy's doctrine (muster.js parkTower's own stamp)
          cell.blocked = true; cell.wallId = b.id; cell.bTeam = 2;
          recomputeFlow();
        } else if (it.hull) {
          const spec = it.hull === "apc" ? APC : BISON;
          if (!armorStable(field, d.x, d.z, spec)) { toast("TOO STEEP TO PARK"); return; }
          if (slotBlockedPublic(world, d.x, d.z, Math.hypot(spec.hx, spec.hz) + 1.0)) { toast("NO ROOM"); return; }
          const v = addBody(world, { kind: "vehicle", team: 2, mass: spec.mass, hx: spec.hx, hy: spec.hy, hz: spec.hz,
            x: d.x, y: field.heightAt(d.x, d.z) + spec.hy + 0.05, z: d.z, hp: spec.hp, friction: 0.85,
            q: heading(null, Math.atan2(-d.x, -d.z)) });
          v.armor = spec.armor; v.vtype = it.hull; v.maxHp = spec.hp; v.bounty = spec.bounty;
          v.homeX = d.x; v.homeZ = d.z; v.sleeping = true;
          if (it.hull === "apc") v.apcSeq = nextApcSeq();
          v.drv = it.hull === "apc" ? "apc" : "armor"; v.depotDrive = "auto"; v.order = "defend"; v.tracks = "careful";
        } else if (it.mech) {
          if (!(armorSpread(field, d.x, d.z, MECH_SPREAD) < 0.28)) { toast("TOO STEEP TO PARK"); return; }
          if (slotBlockedPublic(world, d.x, d.z, 4.5)) { toast("NO ROOM"); return; }
          const m = buildMech(world, { x: d.x, z: d.z, yaw: Math.atan2(-d.x, -d.z), team: 2, hp: MECH.hp });
          m.thrustersOn = true; m.thrustAssist = true;
          m.hull.drv = "mech"; m.hull.order = "defend"; m.hull.tracks = "careful";
          m.hull.maxHp = MECH.hp; m.hull.homeX = d.x; m.hull.homeZ = d.z; m.hull.bounty = MECH.bounty;
        } else {
          for (let k = 0; k < it.n; k++) spawnUnit(world, { x: d.x, z: d.z }, it.tag);
        }
      };
```

Everything the block names is already imported by DepotGame.jsx (`TOWER_SPECS, APC, BISON, MECH` from specs, `armorStable, armorSpread, MECH_SPREAD` from muster, `spawnUnit` from units, `buildMech` from mech, `slotBlockedPublic` from squads, `effRange` from state, `addBody, heading` from core, `clampToRim, streamAt` from mapgen) — the agent verifies each against the import lines at :11-45 before running; a missing one is added to its existing import statement.

Add to the S object (:1295 region, beside `hirePlace`):

```js
        devSpawn: null, // mk2.25: the armed enemy-rack pick (sandbox only)
```

### Step 4 — the tap

`src/depot/DepotGame.jsx:2267` (`tapAt`) — directly after the pre-start place-mode branch (the `if (!S.started && S._placeQueue ...)` block, before `if (!S.started || S.gameOver || S.victory) return;`), add:

```js
        // mk2.25: an armed enemy-rack pick owns every ground tap — repeated
        // taps keep placing until the rack button is tapped again.
        if (dev && S.devSpawn) {
          const pd = groundPoint(cx, cy);
          if (pd) devSpawnAt(pd);
          return;
        }
```

### Step 5 — the bar

`src/depot/DepotGame.jsx:823-828` — `TREE_BRANCHES` stays untouched (module scope, shared with the live game). The dev branch is presentation-local: in the build-bar render (:4727-4735), the branch chips map over a dev-extended list. The two render lines change:

```jsx
          {buildOpen && (dev ? [...TREE_BRANCHES, { key: "foes", label: "THE ENEMY", icon: "☠", match: () => false }] : TREE_BRANCHES).map((b) => (dev && b.key === "foes") || palette.some((p) => b.match(p.key)) ? (
```

(the chip body is unchanged; its count line shows `FOE_RACK.length` when `b.key === "foes"` — exact form:)

```jsx
              <div style={{ opacity: 0.6, fontSize: 10 }}>{b.key === "foes" ? FOE_RACK.length : palette.filter((p) => b.match(p.key)).length}</div>
```

And after the palette slots map (:4736-4751), add the rack's own slots:

```jsx
          {buildOpen && dev && branch === "foes" && FOE_RACK.map((f) => (
            <div key={f.key} data-foe-key={f.key}
              style={{ ...P.slot, borderColor: hud.devSpawn === f.key ? "#ff6b5e" : "#48515f", color: hud.devSpawn === f.key ? "#ff6b5e" : "#e6ebf1", minWidth: isTouch ? 56 : 52 }}
              onClick={() => {
                const S = stateRef.current; if (!S) return;
                S.devSpawn = S.devSpawn === f.key ? null : f.key;
                S.mode = null; S.pending = null; S.sellMode = false;
                setHud((h) => ({ ...h, devSpawn: S.devSpawn, mode: null, sellMode: false }));
              }}>
              <div style={{ fontSize: 16 }}>{f.icon}</div>
              <div>{f.label}</div>
              <div style={{ color: "#ff7a7a", fontSize: 10 }}>ENEMY</div>
            </div>
          ))}
```

`setMode` (:4082) and `closeBuild` (:4112) each gain one line clearing the armed rack: `S.devSpawn = null;` beside their `S.pending = null;` lines, and the hud mirror `devSpawn: null` in their setHud calls. The hud ticker (:3885 region) gains `devSpawn: S.devSpawn,` beside `mode: S.mode`. `HUD0` (state.js:1976) is NOT touched — an absent field reads undefined, and only dev renders read it.

The `branchOf` helper (:828) knows no `foes` — correct: no PALETTE key lands there, and the branch is chosen only by its own chip.

Phone and desktop: the rack rides the existing build bar (44px slots, wrap) — both platforms by construction.

### Step 6 — gates and the landing

- `node scripts/gate.mjs depot-test` (era 23 grows), `golden`, `depot-lint`, `smoke`.
- Bump `src/version.js` to `mk2.25`, build, commit, push. The owner's live check: open BUILD → THE ENEMY, arm a kind, tap the ground repeatedly, watch them land — infantry, pair, tank, hulls, mech, towers — phone and desktop. (They will fight: the switch is mk2.26.)

---

## Task 3 — the fight switch (mk2.26)

**Suggested model: Sonnet 5.**

**Required reading:** this task's section in full; `src/depot/DepotGame.jsx:116-135 (stepTowers head), 425-431 (stepEnemies), 450-470 (uprightMember, stepDepot head), 571-600 (foeSquads + stepTowers call), 4138-4160 (the toggle idiom: toggleWind/toggleHoldArea), 4406-4420 (the top bar buttons)`; `src/depot/units.js:491-535 (stepUnits head)`; `scripts/tests/23-the-sandbox.mjs` as landed by Tasks 1-2. Read-confirmation opens the report.

One switch: THEY FIGHT (default) / THEY STAND. Live, flippable any time. Standing enemies are dummies — no marching, no aiming, no triggers, no drivers — but they remain real bodies: they topple, burn, die, and conduct the chain; physics never pauses.

### Step 1 — the failing asserts

Append to `scripts/tests/23-the-sandbox.mjs`:

```js
{ // mk2.26: the fight switch — the one headless seam is stepTowers' world
  // flag; the rest are wiring pins.
  const { makeField, makeWorld, addBody } = await import("../../src/engine/core.js");
  const { stepTowers } = await import("../../src/depot/DepotGame.jsx").catch(() => ({}));
  const dg3 = src("src/depot/DepotGame.jsx");
  ok("fight: the switch exists", dg3.includes("data-dev-fight"));
  ok("fight: dummies skip the enemy drivers", dg3.includes("if (!S.devDummies) stepEnemies"));
  ok("fight: standing dummies still upright", dg3.match(/devDummies[\s\S]{0,400}uprightMember/));
  ok("fight: enemy towers read the flag", dg3.includes("world._devDummies && b.team === 2"));
  ok("fight: the flag is stamped each tick", dg3.includes("world._devDummies = "));
}
```

(`stepTowers` cannot import headlessly — DepotGame.jsx pulls React and the renderer; the `.catch` keeps the import line honest about that and the pins carry the assert. If the import DOES resolve under the suite's loader, the agent adds a behavior block: a team-2 tower beside a team-1 unit, `world._devDummies = true`, 3 seconds of stepped calls, zero shots — and reports the addition.)

Run `node scripts/gate.mjs depot-test` — the block must FAIL before Step 2.

### Step 2 — the gate

`src/depot/DepotGame.jsx:466-467` — stepDepot's opening becomes:

```js
function stepDepot(world, grid, onStructureLost, town, onRuin, T, discipline, S) {
  // mk2.26: THE FIGHT SWITCH (sandbox). Dummies = no enemy drivers, no
  // enemy fire; bodies stay real (physics, damage, the chain). The flag
  // rides the world so stepTowers reads it without a signature change;
  // undefined in the live war — every existing caller unchanged.
  world._devDummies = !!S.devDummies;
  if (!S.devDummies) stepEnemies(world, grid, T, S);
  else for (const b of world.bodies) if (b.kind === "unit" && b.team === 2 && b.alive) uprightMember(b, world.dt);
```

(The upright pass is stepUnits' own settle snippet, already factored as `uprightMember` — a blast-toppled dummy stands back up instead of lying frozen. Dummy VEHICLES/mechs simply get no driver: parked hulls sleep where they stand; a mech with no commands stands — `stepDrivers` is inside `stepEnemies`, skipped whole. Enemy squads: the foeSquads block at :574 gains the same gate — its condition becomes `if (!S.devDummies && S.foeSquads && S.foeSquads.length)`.)

`src/depot/DepotGame.jsx:118-123` — stepTowers' loop, directly after the possessed-tower cooldown line (:123), gains:

```js
    // mk2.26: a dummy enemy tower holds everything — no scan, no trigger;
    // cooldown decays so the flip back to FIGHT resumes clean.
    if (world._devDummies && b.team === 2) { b.fireCd = (b.fireCd || 0) - dt; continue; }
```

Enemy sapper fuses already lit, grenades in flight, tesla chains mid-walk: all keep running (they are world state, not drivers) — stated, deliberate; the switch stops decisions, not physics.

Add to the S object (beside `devSpawn`):

```js
        devDummies: false, // mk2.26: THEY FIGHT by default; true = dummies (sandbox only)
```

### Step 3 — the button

`src/depot/DepotGame.jsx` — beside `toggleHoldArea` (:4156-4160), add:

```js
  // mk2.26: THE FIGHT SWITCH — sandbox only, live, any time.
  const toggleDevFight = () => {
    const S = stateRef.current; if (!S) return;
    S.devDummies = !S.devDummies;
    setHud((h) => ({ ...h, devDummies: S.devDummies }));
  };
```

Top bar, directly after the NEW VALLEY button:

```jsx
        {dev && (
          <button data-dev-fight style={{ ...P.btn, padding: isTouch ? "5px 10px" : "4px 10px", borderColor: hud.devDummies ? "#48515f" : "#ff6b5e", color: hud.devDummies ? "#e6ebf1" : "#ff6b5e" }} title="whether placed enemies fight back — flips live" onClick={toggleDevFight}>
            {hud.devDummies ? "THEY STAND" : "THEY FIGHT"}
          </button>
        )}
```

Hud ticker gains `devDummies: S.devDummies,`. `HUD0` untouched (the Task 2 rule). Phone and desktop: same top bar, both.

### Step 4 — gates and the landing

- `node scripts/gate.mjs depot-test`, `golden`, `depot-lint`, `smoke`.
- Bump `src/version.js` to `mk2.26`, build, commit, push. The owner's live check: place enemies, flip THEY STAND — everything freezes its will but not its body; shoot a dummy, it dies and smears; flip THEY FIGHT — the same field wakes and comes for the depot. Phone and desktop.

---

## Check pass (plan-writer's own, done before serving)

- Anchors grepped against the live tree this session: `App.jsx:17-18/78/118/145-149`, `StartScreen.jsx:9/105-107`, `DepotGame.jsx:835/882/939/1392-1393/1483-1487/1497/1552/1628/2267/2561/2585/2683/2727/2738/2775-2777/3003/3317/3527/3688/4082/4112/4156-4160/4374/4406/4727-4751/4763/4785`, `DepotGame.jsx:116-135/425/450/466/574 (stepTowers/stepEnemies/uprightMember/stepDepot/foeSquads)`, `state.js:1478/1986 (makeManifestState/HUD0)`, `units.js:23 (spawnUnit)`, `muster.js:126-161 (parkTower)`, gate names from `scripts/gate.mjs` (`depot-test, golden, depot-lint, smoke`), suite eras end at `22-the-tesla-coil.mjs` (23 is free), `version.js` MK is `mk2.23`.
- Every key/field named in the code blocks exists in the read tree: `PALETTE`, `TREE_BRANCHES`, `branchOf`, `restart`, `priceNow`, `buyPaced`, `canBuild`, `stepBell`, `saveFront`, `burnSave`, `stepDepotCensus`, `spawnUnit`, `armorStable`, `armorSpread`, `MECH_SPREAD`, `slotBlockedPublic`, `buildMech`, `heading`, `clampToRim`, `streamAt`, `effRange`, `nextApcSeq`, `uprightMember`, `stepEnemies`, `groundPoint`, `recomputeFlow`.
- Code blocks syntax-passed (node parse of the JS blocks; the JSX blocks parsed through the project's own bundler loader).
- No `Math.random` in any block (dev seed uses `Date.now`, the file's existing idiom; the rack's rng is `world.rng` inside spawnUnit, lawful).
- No save shape moves: nothing new is serialized (`devSpawn`/`devDummies` live on S in a mode that never calls serializeFront; the generic body sweep never sees them — they are run-state fields, not body fields).
- Symmetry: exempt by the recorded ruling above; the live war path is dev-gated at every touched line.
