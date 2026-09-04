# The Jeep (mk2.98)

Task 2 of 2 (owner, 2026-09-03/04). The Willys rides mk2.97's springs onto the field: JEEP, 60 scrap, two seats, coax only, the spotter's eye at 46, 14 m/s in 2H and a 4 m/s crawling 4L that climbs what 2H cannot, fording the stream as the Bison does, wheels visibly riding their springs. Symmetric: the enemy spawn path fits jeeps identically.

Suggested model: Sonnet 5 — eleven files, every code block carried below verbatim, every anchor pre-verified (two spawn blocks are byte-identical twins and are replaced BOTH times, called out below).

Rulings this plan records (owner): price 60; seats 2; 2H 14 / 4L 4 m/s (provisional); eye 46; wheels animate; label JEEP; fords like the Bison; 4L is the possessed hand's tool — ordered driving stays 2H on the routed network; ordered driving never auto-shifts.

Design choices, stated: bounty 15 and the market family cap `heroJeep: 4` are provisional (F5); armor none (a jeep is skin); the gear button lives above RELEASE under possession, phone and desktop both; the CARDS registry count pin re-teaches 19 → 20 (licensed below).

## Required reading

- This plan, whole; `docs/superpowers/plans/the-jeep-questions-answered.md`.
- `src/engine/core.js` lines 1950–1965 (the water law). `src/depot/sight.js` lines 19–37. `src/depot/specs.js` lines 99–135, 210–220. `src/depot/drivers.js` lines 420–440. `src/depot/muster.js` lines 250–260. `src/depot/market.js` lines 25–32, 60–70, 93–103, 135–142. `src/depot/transports.js` whole (122 lines). `src/depot/cards.js` lines 40–50. `src/graphics/renderer.js` lines 85–130, 1905–1950. `src/graphics/portrait.js` lines 7–12, 100–110. `src/depot/DepotGame.jsx` lines 170–180, 280–290, 800–880, 1455–1465, 1515–1525, 2090–2170, 3040–3050, 3310–3320, 3700–3720, and the pie/roster label lines its steps quote.

Report opens with confirmation these were read.

## Steps

### Step 1 — the failing tests

Create `scripts/tests/45-the-jeep.mjs` with exactly:

```js
import { ok } from "./harness.mjs";
import { makeWorld, addBody, stepWorld } from "../../src/engine/core.js";
import { eyeOf } from "../../src/depot/sight.js";
import * as SP from "../../src/depot/specs.js";
import fs from "node:fs";

// ==== mk2.98: the jeep ======================================================
// The fording flag, the per-body eye, and the assembly pins. Seed 160.
{
  console.log("\n[mk2.98: the jeep]");
  const flat = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (x, z, o) => { o.x = 0; o.y = 1; o.z = 0; } };

  // (a) the fording flag: a flagged hull survives the water that kills its twin
  {
    const w = makeWorld({ field: flat, seed: 160, water: { x0: -10, x1: 10, z0: -10, z1: 10, level: 2.0 } });
    w.depotCombat = true;
    const mk = (x) => addBody(w, { kind: "vehicle", team: 1, mass: 1100, hx: 0.75, hy: 0.5, hz: 1.1, x, y: 0.55, z: 0, hp: 90, friction: 0.8 });
    const dry = mk(-3), wet = mk(3);
    wet.fords = true;
    for (let i = 0; i < 300; i++) stepWorld(w);
    ok("(a) the unflagged hull drowns", dry.alive === false, dry.alive ? "alive" : "drowned");
    ok("(a) the fording hull survives the same water", wet.alive === true, wet.alive ? "fording" : "drowned");
  }

  // (b) the per-body eye: eyeR overrides the vehicle table
  {
    const b = { kind: "vehicle", pos: { x: 0, y: 0, z: 0 }, eyeR: 46 };
    ok("(b) eyeR carries the spotter's reach", eyeOf(b).r === 46, String(eyeOf(b).r));
    const plain = { kind: "vehicle", pos: { x: 0, y: 0, z: 0 } };
    ok("(b) an unmarked hull keeps the table's 36", eyeOf(plain).r === 36, String(eyeOf(plain).r));
  }

  // (c) the spec and its wiring
  ok("(c) the JEEP spec stands", !!SP.JEEP && SP.JEEP.cost === 60 && SP.JEEP.seats === 2 && SP.JEEP.eye === 46 && SP.JEEP.spd2h === 14 && SP.JEEP.spd4l === 4, JSON.stringify(SP.JEEP || null));
  ok("(c) the hand knows the jeep", SP.HAND_KEYS.includes("hero_jeep") && SP.HAND_TAGS.hero_jeep === "hero_jeep");

  // (d) pins: driver, muster, market, seats, fit, gear, mesh, portrait, card
  const dr = fs.readFileSync("src/depot/drivers.js", "utf8");
  ok("(d) pins: the jeep drives armor legs with the coax alone", /DRIVERS\.jeep = \{ goal: armorGoal, guns: apcGuns \};/.test(dr));
  const mu = fs.readFileSync("src/depot/muster.js", "utf8");
  ok("(d) pins: the pick pool holds the jeep", /\{ key: "hero_jeep", kind: "hull", vtype: "jeep" \}/.test(mu));
  const ma = fs.readFileSync("src/depot/market.js", "utf8");
  ok("(d) pins: the market prices and counts it", /hero_jeep = priced\(JEEP\.cost, "heroJeep", counts\)/.test(ma) && /vtype === "jeep"\) add\("heroJeep", 1\)/.test(ma));
  const tr = fs.readFileSync("src/depot/transports.js", "utf8");
  ok("(d) pins: seats come from the spec, jeep or APC", /const seatsOf = \(v\) => v\.vtype === "jeep" \? JEEP\.seats : APC\.seats;/.test(tr));
  const dg = fs.readFileSync("src/depot/DepotGame.jsx", "utf8");
  ok("(d) pins: the fit dresses every spawned jeep", /const jeepFit = \(v\) => \{/.test(dg) && (dg.match(/jeepFit\(v\);/g) || []).length >= 3);
  ok("(d) pins: the gear toggle swaps the drive numbers", /view\.toggleGear = \(\) => \{/.test(dg) && /data-jeep-gear/.test(dg));
  const rr = fs.readFileSync("src/graphics/renderer.js", "utf8");
  ok("(d) pins: the mesh has sprung wheels", /export function buildJeep\(team\) \{/.test(rr) && /g\.userData\.wheels && b\._wheelC/.test(rr));
  const pt = fs.readFileSync("src/graphics/portrait.js", "utf8");
  ok("(d) pins: the portrait knows the jeep", /if \(key === "hero_jeep"\) return buildJeep\(1\);/.test(pt));
  const cd = fs.readFileSync("src/depot/cards.js", "utf8");
  ok("(d) pins: the hire card stands", /hero_jeep: \{ label: "JEEP"/.test(cd));
}
```

In `scripts/depot-test.mjs`, after the line

```js
await import("./tests/44-the-suspension.mjs");
```

insert

```js
await import("./tests/45-the-jeep.mjs");
```

Run `node scripts/gate.mjs depot-test` blocking, once. Required result, verified by a live pre-fix run at plan-writing time: exactly THIRTEEN new asserts FAIL — (a) fording-hull, (b) eyeR, both (c), all nine (d) pins — while "(a) the unflagged hull drowns" and "(b) an unmarked hull keeps 36" PASS pre-fix. Every pre-existing test PASSES. Any other pattern stops the task.

### Step 2 — the water law learns the flag (`src/engine/core.js`)

Replace exactly:

```js
        if (b.subT > 0.9 && b.id !== world.bisonId) applyDamage(world, b, 1e6, { cause: CAUSE.DROWN, attacker: b.lastImp && world.t - b.lastImp.t < 4 ? b.lastImp.attacker : "world" }); // the Bison floods but survives — it has to climb out
```

with:

```js
        if (b.subT > 0.9 && b.id !== world.bisonId && !b.fords) applyDamage(world, b, 1e6, { cause: CAUSE.DROWN, attacker: b.lastImp && world.t - b.lastImp.t < 4 ? b.lastImp.attacker : "world" }); // the Bison floods but survives — it has to climb out; mk2.98 (owner): a fording body shares its law
```

### Step 3 — the eye (`src/depot/sight.js`)

Replace exactly:

```js
  if (b.kind === "vehicle") return { x: b.pos.x, y: b.pos.y + 1.4, z: b.pos.z, r: SIGHT.vehicle };
```

with:

```js
  if (b.kind === "vehicle") return { x: b.pos.x, y: b.pos.y + 1.4, z: b.pos.z, r: b.eyeR || SIGHT.vehicle }; // mk2.98: the jeep's spotter eye rides the body
```

### Step 4 — the spec (`src/depot/specs.js`)

**4a.** Immediately after the line

```js
export const APC = { mass: 2600, hx: 1.6, hy: 1.0, hz: 3.0, hp: 300, armor: 120, bounty: 45, seats: 4, cost: 140 };
```

insert:

```js
// mk2.98 (owner): THE JEEP — the Willys. Coax only, two seats, the spotter's
// eye, springs under it (mk2.97), 2H runs and 4L climbs, and it fords the
// stream as the Bison does. All dials provisional (F5).
export const JEEP = { mass: 1100, hx: 0.75, hy: 0.5, hz: 1.1, hp: 90, bounty: 15, seats: 2, cost: 60, eye: 46,
  spd2h: 14, cap2h: 3.5, spd4l: 4, cap4l: 7,
  susp: { kx: 0.6, kz: 0.9, rest: 0.55, travel: 0.4, rate: 66000, damp: 6000 } };
```

**4b.** In `HAND_KEYS`, replace `"hero_bison", "hero_apc", "hero_mech"]` with `"hero_bison", "hero_apc", "hero_jeep", "hero_mech"]`. In `HAND_TAGS`, replace `hero_apc: "hero_apc",` with `hero_apc: "hero_apc", hero_jeep: "hero_jeep",`.

### Step 5 — the driver (`src/depot/drivers.js`)

Immediately after the line

```js
DRIVERS.apc = { goal: armorGoal, guns: apcGuns };
```

insert:

```js
DRIVERS.jeep = { goal: armorGoal, guns: apcGuns }; // mk2.98: the jeep — armor's legs, the coax alone
```

### Step 6 — the muster (`src/depot/muster.js`)

Immediately after the line

```js
  { key: "hero_apc", kind: "hull", vtype: "apc" },
```

insert:

```js
  { key: "hero_jeep", kind: "hull", vtype: "jeep" },
```

### Step 7 — the market (`src/depot/market.js`)

Add `JEEP` to the specs.js import list. Then three edits: after `heroBison: 3, heroApc: 3,` append ` heroJeep: 4,` on the same line; after the counts line `else if (b.kind === "vehicle" && b.vtype === "apc") add("heroApc", 1);` insert `    else if (b.kind === "vehicle" && b.vtype === "jeep") add("heroJeep", 1);`; after EACH of the two pricing lines `player.hero_apc = ...` and `foe.hero_apc = ...` insert its twin `  player.hero_jeep = priced(JEEP.cost, "heroJeep", counts);` / `  foe.hero_jeep = priced(JEEP.cost, "heroJeep", counts);`; and after the killPrice line `if (ev.vtype === "apc") return { price: priced(APC.cost, "heroApc", c), counted: true };` insert `    if (ev.vtype === "jeep") return { price: priced(JEEP.cost, "heroJeep", c), counted: true };`.

### Step 8 — the seats (`src/depot/transports.js`)

Add `JEEP` to the specs.js import. Immediately after that import block insert:

```js
const seatsOf = (v) => v.vtype === "jeep" ? JEEP.seats : APC.seats; // mk2.98: seats come from the spec
export { seatsOf };
```

Then replace the two `APC.seats` reads: `const free = APC.seats - apcSeated(world, squads, v.apcSeq);` → `const free = seatsOf(v) - apcSeated(world, squads, v.apcSeq);` and `const a = (i++ / APC.seats) * Math.PI * 2;` → `const a = (i++ / seatsOf(v)) * Math.PI * 2;`.

### Step 9 — the assembly (`src/depot/DepotGame.jsx`)

**9a.** Add `JEEP` to the specs.js import list. Add `seatsOf` to the transports.js import (beside `unloadApc`).

**9b.** After the PALETTE row `  { key: "hero_apc", label: "APC", icon: "⬒", cost: APC.cost },` insert `  { key: "hero_jeep", label: "JEEP", icon: "⛟", cost: JEEP.cost },`.

**9c.** Replace `    { name: "II", keys: ["hero_apc"] },` with `    { name: "II", keys: ["hero_apc", "hero_jeep"] },`.

**9d.** Replace `      const HERO_MODE = { hero_bison: "bison", hero_apc: "apc", hero_mech: "mech" };` with:

```js
      const HERO_MODE = { hero_bison: "bison", hero_apc: "apc", hero_jeep: "jeep", hero_mech: "mech" };
      // mk2.98 (owner): the jeep's fit — springs, gears, the fording flag,
      // the spotter's eye. "2h" is the standing default everywhere; the
      // possessed gear button is the only thing that shifts it.
      const jeepFit = (v) => {
        v.susp = { ...JEEP.susp };
        v.fords = true; v.eyeR = JEEP.eye; v.gear = "2h";
        v.spdF = JEEP.spd2h; v.spdR = 3; v.accCap = JEEP.cap2h;
      };
      view.toggleGear = () => {
        const P2 = input.possess;
        if (!P2 || P2.kind !== "vehicle") return;
        const v = world.byId.get(P2.id);
        if (!v || v.vtype !== "jeep") return;
        v.gear = (v.gear || "2h") === "2h" ? "4l" : "2h";
        if (v.gear === "4l") { v.spdF = JEEP.spd4l; v.accCap = JEEP.cap4l; } else { v.spdF = JEEP.spd2h; v.accCap = JEEP.cap2h; }
      };
```

**9e.** In `ghostFp`, replace `if (pk.kind === "hull") { const s = pk.vtype === "apc" ? APC : BISON; return { x: s.hx * 2, z: s.hz * 2, h: s.hy * 2 }; }` with the same line reading `const s = pk.vtype === "apc" ? APC : pk.vtype === "jeep" ? JEEP : BISON;`.

**9f.** The player hull spec-select line `          const spec = pk.vtype === "apc" ? APC : BISON;` appears FOUR times, byte-identical — placePick, the placement-mode path, placeHero (the hire path), and the placement-zone vetting. Replace ALL FOUR with `          const spec = pk.vtype === "apc" ? APC : pk.vtype === "jeep" ? JEEP : BISON;`. The spawn tail below appears THREE times (the three spawn sites; the zone vet has none) — replace all three occurrences

```js
          if (pk.vtype === "apc") v.apcSeq = nextApcSeq();
          v.drv = pk.vtype === "apc" ? "apc" : "armor"; v.depotDrive = "auto"; v.order = "defend"; v.tracks = "careful"; v.driver = "player";
```

with:

```js
          if (pk.vtype === "apc" || pk.vtype === "jeep") v.apcSeq = nextApcSeq();
          v.drv = pk.vtype === "apc" ? "apc" : pk.vtype === "jeep" ? "jeep" : "armor"; v.depotDrive = "auto"; v.order = "defend"; v.tracks = "careful"; v.driver = "player";
          if (pk.vtype === "jeep") jeepFit(v);
```

**9g.** The enemy spawn (the `it.hull` block): replace `          const spec = it.hull === "apc" ? APC : BISON;` with `          const spec = it.hull === "apc" ? APC : it.hull === "jeep" ? JEEP : BISON;`, and

```js
          if (it.hull === "apc") v.apcSeq = nextApcSeq();
          v.drv = it.hull === "apc" ? "apc" : "armor"; v.depotDrive = "auto"; v.order = "defend"; v.tracks = "careful";
```

with:

```js
          if (it.hull === "apc" || it.hull === "jeep") v.apcSeq = nextApcSeq();
          v.drv = it.hull === "apc" ? "apc" : it.hull === "jeep" ? "jeep" : "armor"; v.depotDrive = "auto"; v.order = "defend"; v.tracks = "careful";
          if (it.hull === "jeep") jeepFit(v);
```

**9h.** The LOAD tap gate: `          if (v.vtype !== "apc") { view.vehOrderMode = null; return true; }` → `          if (v.vtype !== "apc" && v.vtype !== "jeep") { view.vehOrderMode = null; return true; }`. The load capacity line `          const free = APC.seats - apcSeated(world, run.squads, v.apcSeq);` → `          const free = seatsOf(v) - apcSeated(world, run.squads, v.apcSeq);`.

**9i.** The vehRadial seats: `                  kind: v.kind, vtype: v.vtype, seatsFree: v.vtype === "apc" ? APC.seats - apcSeated(world, run.squads, v.apcSeq) : 0,` → `                  kind: v.kind, vtype: v.vtype, seatsFree: v.vtype === "apc" || v.vtype === "jeep" ? seatsOf(v) - apcSeated(world, run.squads, v.apcSeq) : 0,`; the riders line `                  riders: v.vtype === "apc" ? apcSeated(world, run.squads, v.apcSeq) : 0,` (its line begins the same way) → `                  riders: v.vtype === "apc" || v.vtype === "jeep" ? apcSeated(world, run.squads, v.apcSeq) : 0,`.

**9j.** The pie's LOAD/UNLOAD gates: `        if (vr.vtype === "apc" && vr.seatsFree > 0) {` → `        if ((vr.vtype === "apc" || vr.vtype === "jeep") && vr.seatsFree > 0) {` and `        if (vr.vtype === "apc" && vr.riders > 0) {` → `        if ((vr.vtype === "apc" || vr.vtype === "jeep") && vr.riders > 0) {`.

**9k.** Labels — three chains learn JEEP: `        const vLabel = vr.kind === "mech" ? "MECH" : vr.vtype === "apc" ? "APC" : "BISON";` → `        const vLabel = vr.kind === "mech" ? "MECH" : vr.vtype === "apc" ? "APC" : vr.vtype === "jeep" ? "JEEP" : "BISON";`; the roster row `label: vb.kind === "mech" ? "MECH" : vb.vtype === "apc" ? "APC" : "BISON"` → `label: vb.kind === "mech" ? "MECH" : vb.vtype === "apc" ? "APC" : vb.vtype === "jeep" ? "JEEP" : "BISON"`; the possessed entry `return pv && pv.alive ? { kind: "vehicle", vtype: pv.vtype, label: pv.vtype === "apc" ? "APC" : "BISON" } : null;` → `return pv && pv.alive ? { kind: "vehicle", vtype: pv.vtype, gear: pv.gear || "2h", label: pv.vtype === "apc" ? "APC" : pv.vtype === "jeep" ? "JEEP" : "BISON" } : null;`.

**9l.** The gear button — immediately after the RELEASE button's block

```js
      {hud.possessed && (
        <button data-possess-release
          style={{ ...P.btnBig, position: "absolute", right: 16, bottom: 16, zIndex: 7, borderColor: "#ffb45e", color: "#ffb45e", fontWeight: "bold" }}
          onClick={() => stateRef.current && stateRef.current.input.releasePossession()}>
          RELEASE
        </button>
      )}
```

append:

```js
      {hud.possessed && hud.possessed.kind === "vehicle" && hud.possessed.vtype === "jeep" && (
        <button data-jeep-gear
          style={{ ...P.btnBig, position: "absolute", right: 16, bottom: 68, zIndex: 7, borderColor: hud.possessed.gear === "4l" ? "#ffd27a" : "#7fd7ff", color: hud.possessed.gear === "4l" ? "#ffd27a" : "#7fd7ff", fontWeight: "bold" }}
          onClick={() => stateRef.current && stateRef.current.view.toggleGear()}>
          {hud.possessed.gear === "4l" ? "4L" : "2H"}
        </button>
      )}
```

### Step 10 — the card, with one licensed re-teach (`src/depot/cards.js`)

After the `hero_apc:` card row insert:

```js
  hero_jeep: { label: "JEEP", role: "The Willys. A coax, two seats, and the spotter's eye on wheels. It fords the stream, and 4L climbs what 2H cannot.",
    n: null, hp: JEEP.hp, dmg: null, range: null, speed: null, skills: [...ORDERS_HULL, "LOAD / UNLOAD", "2H / 4L"] },
```

(Add `JEEP` to cards.js's specs import.) LICENSED RE-TEACH: `scripts/tests/25-the-teaching-cards.mjs`'s pin `ok("T1: the registry holds the nineteen market cards", Object.keys(CARDS).length === 19);` re-teaches to `ok("T1: the registry holds the twenty market cards", Object.keys(CARDS).length === 20);` — the count moves with the card, content otherwise identical, reported old→new.

### Step 11 — the mesh and the portrait (`src/graphics/renderer.js`, `src/graphics/portrait.js`)

**11a.** Immediately before `export function buildApc(team) {`'s comment block (the line `// P7 T4 (mk1.33): the APC — four seats, one coax. team parameterizes the`), insert:

```js
// mk2.98 (owner): THE JEEP — open hull, four sprung wheels. The suspension
// pass writes b._wheelC (per-wheel compression); the sync loop drops each
// wheel by its spring and rolls it with the hull's speed. Dials provisional (F5).
export function buildJeep(team) {
  const g = new THREE.Group();
  const hullC = team === 2 ? 0x6e3a34 : 0x4a5d3a;
  const hull = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.55, 2.2), toon(hullC));
  hull.position.y = 0.1; hull.castShadow = true; g.add(hull);
  const screen = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 0.08), toon(0x28303a));
  screen.position.set(0, 0.55, 0.55); screen.rotation.x = -0.2; g.add(screen);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.35, 0.7), toon(0x2a2f27));
  seat.position.set(0, 0.35, -0.35); g.add(seat);
  const coax = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 6), toon(0x33383d));
  coax.rotation.x = Math.PI / 2; coax.position.set(0.35, 0.75, 0.2); g.add(coax);
  g.userData.wheels = [];
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.25, 10), toon(0x1b1e22));
    wh.rotation.z = Math.PI / 2; wh.position.set(sx * 0.72, -0.28, sz * 0.9);
    wh.castShadow = true; g.add(wh);
    g.userData.wheels.push(wh);
  }
  return g;
}
```

**11b.** In the vehicle sync, replace `        g = b.vtype === "apc" ? buildApc(b.team) : b.vtype === "tank" ? buildWaveTank(b.team) : (b.vtype === "bison" || b.id === world.bisonId) ? buildBison(b.team) : (b.vtype === "truck" ? buildTruck() : buildScout());` with the same line carrying `b.vtype === "jeep" ? buildJeep(b.team) :` inserted after the `"apc"` term.

**11c.** Immediately after the sync's quaternion line `      g.quaternion.set(b.q.x, b.q.y, b.q.z, b.q.w);` insert:

```js
      // mk2.98: the jeep's wheels ride their springs and roll with speed
      if (g.userData.wheels && b._wheelC) {
        const spd = Math.hypot(b.v.x, b.v.z) * (b.v.x * b.R[6] + b.v.z * b.R[8] >= 0 ? 1 : -1);
        for (let wi = 0; wi < 4; wi++) {
          const wh = g.userData.wheels[wi];
          wh.position.y = -0.55 + Math.min(0.4, b._wheelC[wi]);
          wh.rotation.y += spd * 0.05;
        }
      }
```

**11d.** portrait.js: add `buildJeep` to the renderer import, and after `  if (key === "hero_apc") return buildApc(1);` insert `  if (key === "hero_jeep") return buildJeep(1);`.

### Step 12 — gates

Run blocking, in order: `node scripts/gate.mjs depot-test` (all FIFTEEN Step-1 asserts PASS, the one licensed re-teach in place, everything else PASSES), `node scripts/gate.mjs golden` (core.js touched; the fords term defaults false everywhere), `node scripts/gate.mjs depot-lint`, `node scripts/gate.mjs smoke` — all green. No other re-teach is licensed.

### Step 13 — version, build, land

- `src/version.js`: `mk2.97` → `mk2.98`.
- `npm run build` (after the bump, never before).
- Commit and push. Suggested subject: `the jeep — the Willys fields on its springs, 2H runs and 4L climbs, mk2.98`. Include this plan file.

## Acceptance

- Arithmetic: `depot-test` exits 0 with all fifteen new asserts PASS plus the re-taught count; `golden`, `depot-lint`, `smoke` exit 0. Fixture seed 160; the rest are pins and pure calls.
- The owner's live check: hire a JEEP for 60 — it rolls out on visible springs; possess it, run 2H flat out, shift 4L on a slope the routing refuses and crawl it; ford the stream; load a sniper team; watch its eye open the fog at 46. Phone and desktop both.
