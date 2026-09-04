# The Jeep — the questions, with the code's answers

The copy of `the-jeep-questions.md`, filled after the reading (2026-09-03). Each question stands verbatim; beneath it, the answer, the reference, and the code it came from. Six survive to the owner's word, listed at the end.

---

**1. What timestep does the sim integrate at, and what spring frequency and damping stay stable inside it?**

ANSWERED. The world integrates at 1/120 s, semi-implicit (gravity into velocity, then contacts, then position). A spring under ~6 Hz with real damping is comfortably stable at that step; the plan will pick numbers inside that and mark them provisional.

`src/engine/core.js:398`
```js
    t: 0, dt: 1 / 120, gravity: 9.8, field,
```
`src/engine/core.js:2048` (velocity integration the springs would join)
```js
    b.v.y -= world.gravity * dt;
```

**2. Will a spring-borne hull fall asleep parked?**

ANSWERED — yes, with one care. Sleep triggers on low velocity held 0.55 s; a settled spring is exactly that. The care: the suspension pass must skip sleeping bodies (like `driveHull` does), or its per-tick forces would jiggle the hull and reset the clock forever.

`src/engine/core.js:2005–2013`
```js
    if (V.len2(b.v) < 0.06 && V.len2(b.w) < 0.09) {
      b.sleepT += dt;
      ...
      if (b.sleepT > 0.55 && ...) { b.sleeping = true; V.set(b.v, 0, 0, 0); V.set(b.w, 0, 0, 0); }
    } else b.sleepT = 0;
```

**3. What marks ground "steep," and is there a physical climb limit?**

ANSWERED. Routing: a cell is steep when any neighbor's rise-over-run exceeds 0.45 (~24°) — the hull route planner refuses it. Physics: there is NO slope limit in the drive itself — traction keys only off tilt and groundedness — so today's hulls fail steep ground by the planner's refusal and by sliding, not by a grip model. The jeep's per-wheel grip cap adds the physical law; 4L raises what it can climb; the 24° planner line stays the ordered-driving law.

`src/depot/route.js:18, 31`
```js
export const CLIMB_MAX_GRAD = 0.45;                 // rise over run, ~24 degrees // provisional (F5)
        if (Math.abs(field.heightAt(np.x, np.z) - h0) / (grid.cs * L) > CLIMB_MAX_GRAD) steep = true;
```
`src/engine/core.js:975` (all the "grip" there is)
```js
  const traction = (b.grounded || b.onBody) ? Math.max(0, Math.min(1, (upY - 0.25) / 0.45)) : 0;
```

**4. What reads hull speed and would a faster jeep strain?**

ANSWERED. Four sites, all in the ordered-driving layer, all constant-tuned: the overrun safety's look-ahead grows with speed (`SAFETY_SPEED_K`), the turn-brake fires above 3 m/s, keep-right assumes closing speeds of two 9.5 m/s hulls, and the progress watch is speed-blind (safe). The engine's own top speed is the 9.5/4.5 velocity targets in `driveHull`; the jeep's ranges replace those per-body. Under possession the jeep bypasses the ordered-driving constants entirely; ordered jeeps in 2H at a moderate target keep all four sites inside their tuning.

`src/depot/drivers.js:125–128`
```js
const ARMOR_WP_R = 2.5, ARMOR_ARRIVE = 3.0, ARMOR_ESCORT_BACK = 4;   // provisional (F5)
const SAFETY_AHEAD = 4, SAFETY_SPEED_K = 0.5, SAFETY_HALF_W = 2.8;   // provisional (F5)
```
`src/engine/core.js:977`
```js
  const target = c.throttle >= 0 ? c.throttle * 9.5 : c.throttle * 4.5;
```

**5. Where do a possessed vehicle's controls live, for the 2H/4L toggle?**

ANSWERED. Possession draws its own absolute-positioned buttons (fire, MG, and friends, bottom-right) plus a keydown listener for desktop; the vehicle pie carries per-hull toggles (TRACKS) when not possessed. The 2H/4L toggle joins the possession buttons (and one key), mirroring the TRACKS button's shape; the gear itself is a body scalar like `tracks`.

`src/depot/DepotGame.jsx:4180` (the TRACKS toggle to mirror)
```js
          { key: "tracks", icon: vr.tracks === "free" ? "●" : "◐", label: vr.tracks === "free" ? "TRACKS FREE" : "TRACKS CAREFUL", ... act: () => { ... C.view.toggleTracks(); ... } },
```
`src/depot/DepotGame.jsx:1940`
```js
      window.addEventListener("keydown", kd);
```

**6. What happens physically when a hull enters the stream?**

ANSWERED. Open water is a killing law, not a slow: a submerged body drags hard and DROWNs at 0.9 s — every hull except the player's own Bison, which floods but survives to climb out. Orders refuse water separately at the tap. So "drive everywhere" lawfully stops at the stream for the jeep unless a future ruling gives it the Bison's exemption — not proposed.

`src/engine/core.js:1955–1961`
```js
      const under = b.pos.y + b.hy * 0.2 < wz.level;
      if (inXZ && under) {
        b.subT += dt;
        ...
        if (b.subT > 0.9 && b.id !== world.bisonId) applyDamage(world, b, 1e6, { cause: CAUSE.DROWN, ... }); // the Bison floods but survives — it has to climb out
```

**7. How does hull traction work today, and is per-wheel load available?**

ANSWERED. Traction is one scalar from tilt (excerpt under Q3); thrust seeks a velocity target and lateral slide is killed by a fixed grip term — no load anywhere. But the suspension itself CREATES the load data: each wheel's spring compression IS its load, so the per-wheel grip cap (load × friction) falls out of the new pass naturally. Nothing existing needs mining.

`src/engine/core.js:980–983`
```js
  if (traction > 0) V.addScaled(b.v, b.v, fwd, acc * dt * traction);
  // track grip: kill lateral slide (only as much as the treads can bite)
  const vS = V.dot(b.v, side);
  V.addScaled(b.v, b.v, side, -vS * Math.min(1, 7 * dt) * (0.12 + 0.88 * traction));
```

**8. Where does the jeep's big eye go?**

ANSWERED. Sight radii are one table keyed by kind; every vehicle reads `SIGHT.vehicle` (36). The jeep needs a per-body override — one added branch in `eyeOf` on a body field (e.g. `b.eyeR`), set at spawn. Scout numbers land between the spotter's 46 and the mech's 40 — the exact figure is the owner's.

`src/depot/sight.js:19–27, 33`
```js
export const SIGHT = {
  unit: 24, sniper: 40, spotter: 46,
  vehicle: 36,     // tank commander, above ENEMY_FIRE.tank.range 34
  tower: 32, flag: 36, mech: 40,
};
  if (b.kind === "vehicle") return { x: b.pos.x, y: b.pos.y + 1.4, z: b.pos.z, r: SIGHT.vehicle };
```

**9. What would seats on the jeep cost in code?**

ANSWERED — little, if wanted. Seating is keyed to the APC by `vtype` and `APC.seats` throughout `transports.js` (boarding, capacity, unload ring); generalizing means a per-spec `seats` field read where `APC.seats` is read today. Not free, not large. Whether the jeep carries anyone is the owner's.

`src/depot/transports.js:85`
```js
      const free = APC.seats - apcSeated(world, squads, v.apcSeq);
```

**10. What does adding the jeep to the hiring hall touch?**

ANSWERED. A hull hire is: a `HAND_KEYS` entry + `HAND_TAGS` tag (specs.js), a `PICK_POOL` row (muster.js), market pricing rows (market.js counts a live census per vtype), and the spawn that answers the card. The Bison and APC each show the exact five-file trail to copy.

`src/depot/specs.js:213`
```js
export const HAND_KEYS = [..., "hero_bison", "hero_apc", "hero_mech"];
```
`src/depot/muster.js:256–257`
```js
  { key: "hero_bison", kind: "hull", vtype: "bison" },
  { key: "hero_apc", kind: "hull", vtype: "apc" },
```
`src/depot/market.js:95–96`
```js
  player.hero_bison = priced(BISON.cost, "heroBison", counts);
  player.hero_apc = priced(APC.cost, "heroApc", counts);
```

**11. Can wheels animate from suspension state, and which renderer copy?**

ANSWERED. The depot draws through its own fork — `src/depot/api.js` re-exports `makeRenderer` from `src/graphics/renderer.js`; `src/render/renderer.js` serves the other modes and is untouched. Hulls are composed THREE meshes positioned from the body each frame, so wheel meshes reading the body's per-wheel compression (the suspension pass can expose it on the body) is ordinary renderer work in the depot fork alone.

`src/depot/DepotGame.jsx:32`
```js
import { serializeRun, makeRenderer, renderPortrait, makeGameAudio, storage } from "./api.js";
```
`src/graphics/renderer.js:551`
```js
export function makeRenderer(canvas, world0, opts = {}) {
```

**12. What new state must explicitly ride the save?**

ANSWERED. The body's generic orders bag saves plain scalars and flat numeric objects and restores them wholesale — the gear string rides via the explicit key list's neighbor pattern (like `tracks`, a string in the `x` bag: strings ride), and a flat numeric susp config rides free; per-wheel transient state (compression) re-derives and must NOT ride. One care from mk2.90's lesson: arrays of objects are dropped by `plainValue`, so wheel offsets should live in the spec, not on the body.

`src/depot/save.js:73–88` (plainValue's law)
```js
function plainValue(v) {
  ...
  if (Array.isArray(v)) return v.every((n) => typeof n === "number" && Number.isFinite(n)) ? v.map(r4) : undefined;
```

**13. Does the jeep's possession reuse the APC's whole?**

ANSWERED — yes. Possession fire for a coax-only hull is `possessedArmorMg` (drivers.js), already imported and wired through `fireHeld`/`mgHeld`; the reticle, sticks, and release hygiene are kind-"vehicle" generic. The jeep adds nothing here beyond the 2H/4L button.

`src/depot/DepotGame.jsx:26`
```js
import { possessedArmorFire, possessedArmorMg, mechSighted, barrelTip } from "./drivers.js";
```

**14. What would the enemy need to field jeeps?**

ANSWERED — scope confirmed as its own later task. The enemy's draft and muster run off the same `PICK_POOL`/market rows (Q10's excerpts — `foe.hero_*` pricing exists in the same table), so the mechanism is shared; the work is the commander AI valuing and using a scout, which is doctrine, not plumbing. Stays deferred until the owner's word.

`src/depot/market.js:101–102`
```js
  foe.hero_bison = priced(BISON.cost, "heroBison", counts);
  foe.hero_apc = priced(APC.cost, "heroApc", counts);
```

---

## Surviving to the owner's word

1. Price.
2. Seats — none, or a small team (Q9: modest generalization either way).
3. Top speeds, 2H and 4L (design choice, marked provisional; Q4 bounds the ordered-driving side).
4. The jeep's eye radius (Q8: the table's neighbors are 36/40/46).
5. Wheels visibly animating, or suspension as feel only (Q11: both lawful).
6. The label (WILLYS, JEEP, SCOUT — cards, roster, pie).

Held lean, not asked: ordered driving never auto-shifts to 4L; water stays lethal to the jeep.
