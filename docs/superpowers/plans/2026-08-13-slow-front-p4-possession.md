# SLOW FRONT — Phase 4: Possession (mk0.90-0.93)

*HISTORY (stamped 2026-08-20, owner's order): this document is a record of shipped work, not authority. Design truth lives in CLAUDE.md and the ACTIVE phase's plan documents; where this file disagrees with them, it is wrong.*

*Written 2026-08-13. Tasks 1-3 executed under the owner's standing authorization; Task 4 added after his playtest of mk0.92. Every design point is a ratified owner ruling or the sandbox's established twin-stick convention. All feel acceptance is the owner's playtest. Sequential Sonnet dispatches. (Drift audits after each task RETIRED by the owner, 2026-08-13 — gates + CI are the verification; audits only on the owner's request.)*

**The ruling this phase implements (decision record, "Possession"):** any friendly squad or tower is takeover-able — TAKE CONTROL on every pie. Twin-stick: the stick drives a squad as one body (stick = formation anchor; fire = squad volley at the aim), towers become manual fire control. The front fights on under standing orders; a bell save mid-possession releases to command view. The enemy needs no mirror. Vehicles wait for the Heroes phase (none exist player-side yet).

**Established conventions reused, not invented:** the sandbox's virtual joystick (radius 56, bottom-left, camera-relative drive, deadzone 0.15), its tap-aims / FIRE-button-shoots split, its touch snap-assist, WASD as the keyboard stick. The sight law binds possessed fire exactly as it binds every shot: you shoot only what your side sees.

**Laws binding every task:** zero new dice (possessed shots draw scatter like any shot — player input is not a replayed stream; the SEEDED streams and their counts are untouched); engine/demo/renderer files untouched (the joystick is game-layer interface; camera follow rides `S.focus`, which the game layer already owns); possession is transient — never serialized, released before every save; run ONLY the gates listed; every deviation its own bullet. (The per-task Fable audit is RETIRED — owner, 2026-08-13.)

---

## Task 1 — Take control: the possessed squad walks (mk0.90) — suggested model: Sonnet (all code below)

Tap TAKE CONTROL on a squad's pie: the camera locks to it, a joystick appears, and the stick drives the whole squad as one body — members holding their ring. RELEASE (a button, or the bell) hands them back to standing orders, dug in where you left them. No fire button yet (Task 2); a possessed squad holds fire — your hands, your trigger, and you don't have one yet.

**Required reading (agent, before any code; anchors re-verified at dispatch):** this plan whole; `CLAUDE.md`; `src/depot/squads.js` — module-law header, `MOVE_SPEED`/`seekGoal`/`slotFor`/`clearSlot` (:312-392), `stepSquad` whole; `src/depot/DepotGame.jsx` — the pie slot lists and instant/aiming action closures, `stepDepot`'s squad loop (engageCheck/stepSquad/squadFire), the frame loop (camera focus, keys, projection block), `ringBell`, `tapAt`/pointer handlers (the joystick must claim its pointer first), `clampToRim`; `src/game/ContractSandbox.jsx` :360-540 (the joystick DOM pattern, camera-relative drive — the convention being ported); `scripts/depot-test.mjs` — COMMAND block idioms; grep `possess` everywhere (must be virgin).

**Step 1.1 — failing tests first.** `scripts/depot-test.mjs`, new block `==== POSSESSION T1`: (a) mirror+pin — `drivePossessedSquad` moves the anchor by the stick vector at `MOVE_SPEED` and issues member goals (fixture: squad on flat ground, drive north 2 sim-seconds → anchor ~6.4m north, every live member within ring+tolerance of it); (b) a possessed squad is SKIPPED by the command loop (source pin: the stepDepot squad loop's possession guard); (c) possession never serializes (source pin: `possess` absent from `serializeFront`'s inputs; and a save taken by the test carries no `possess` key anywhere in its JSON); (d) the bell releases (source pin: `ringBell` calls `S.releasePossession()` before `saveFront`); (e) zero new `world.rng` draws while driving (twin-run: drive a squad 2 seconds with and without an enemy nearby — draw counts identical and exactly zero from the drive path). Run: fail first (module absent), then green.

**Step 1.2 — the drive, in the squad module.** `src/depot/squads.js`, after `stepSquad` (movement-pure, fits the module law; `slotFor`/`clearSlot`/`seekGoal` are module-private and in scope here):

```js
// POSSESSION (P4 T1, mk0.90): the owner's hands on one squad. The stick is
// a world-space direction; the anchor walks it at the squads' own march
// speed; members hold the formation ring exactly as defend does. Movement
// only — no orders, no rng, no fire (the trigger is the game layer's, T2).
export function drivePossessedSquad(world, squad, vx, vz, dt) {
  const mag = Math.hypot(vx, vz);
  if (mag > 1) { vx /= mag; vz /= mag; }
  squad.anchor = { x: squad.anchor.x + vx * MOVE_SPEED * dt, z: squad.anchor.z + vz * MOVE_SPEED * dt };
  const members = squad.memberIds.map((id) => world.byId.get(id)).filter((u) => u && u.alive);
  const n = members.length;
  members.forEach((u, i) => {
    const s = slotFor(squad, i, n);
    u.goal = clearSlot(world, s.x, s.z, (u.hx || 0.3) + 0.35);
    u.settled = false;
    seekGoal(world, u, dt);
  });
}
```

**Step 1.3 — the state and the wedge.** `src/depot/DepotGame.jsx`: `S.possess = null` in the state object (`{ kind: "squad", id }` when live). The pie gains TAKE CONTROL on EVERY squad type (`data-radial="possess"`, icon ✥, color the selection green `#7dffa8`), an instant action wired like DEFEND's closure:

```js
      S.takeControl = () => {
        const sq = selectedSquad();
        if (!sq || world.t < S.selArmedAt) return;
        sq.order = "defend"; sq.dest = null; sq._legTarget = null; sq._pauseT = 0; sq._build = null; sq._threatSig = undefined;
        S.possess = { kind: "squad", id: sq.id };
        S.possessInput = { vx: 0, vz: 0 };
        S.selSquadId = null; S.orderMode = null; S.buildPt0 = null; S.linePending = null;
        R.overlay.setLinePreview(false);
      };
      S.releasePossession = () => {
        if (!S.possess) return;
        const sq = S.squads.find((q) => q.id === S.possess.id);
        S.possess = null; S.possessInput = null;
        if (sq) {
          // released where you left them: dig in — the intrinsic default
          sq.order = "defend"; sq.dest = null; sq._legTarget = null; sq._threatSig = undefined;
          sq._surveyPending = true;
        }
      };
```

**Step 1.4 — the command loop steps aside.** `stepDepot`'s squad loop: the possessed squad is driven, not commanded — insert as the loop's first line:

```js
      if (S.possess && S.possess.kind === "squad" && sq.id === S.possess.id) {
        // POSSESSION: the stick owns this squad — no engage check, no order
        // machine, no auto-fire (T2 gives the trigger). Input is the frame's
        // snapshot; the drive runs at the fixed step like all movement.
        const pi = S.possessInput || { vx: 0, vz: 0 };
        drivePossessedSquad(world, sq, pi.vx, pi.vz, world.dt);
        const cl = clampToRim(sq.anchor.x, sq.anchor.z);
        sq.anchor = { x: cl.x, z: cl.z };
        for (const id of sq.memberIds) { const u = world.byId.get(id); if (u && u.alive) uprightMember(u, world.dt); }
        continue;
      }
```

(`drivePossessedSquad` joins the squads.js import list. A possessed squad whose members all die releases automatically: add `if (S.possess && S.possess.kind === "squad" && !S.squads.some((q) => q.id === S.possess.id)) S.releasePossession();` right after `pruneSquads`.)

**Step 1.5 — the stick.** Frame loop, before the sim bracket: keyboard first (`S.keys` WASD already exist — while possessed they drive the squad, camera-relative, NOT the camera), then touch. The joystick is the sandbox's DOM pattern, depot-styled: base+knob divs (radius 56, anchored bottom-left at `(92, height-128)`), shown only while `S.possess` is set; its pointerdown claims the pointer BEFORE the canvas pan/tap handlers (a `data-joy` element with its own handlers and `stopPropagation`); deadzone 0.15; knob follows the finger clamped to the radius. Both inputs land in `S.possessInput` as a camera-relative world vector (the sandbox's own math):

```js
          if (S.possess) {
            const cb2 = R.camBasis;
            const fl = Math.hypot(cb2.up.x, cb2.up.z) || 1, rl2 = Math.hypot(cb2.right.x, cb2.right.z) || 1;
            let st = 0, ss = 0;
            if (S.joy && S.joy.active) { st = S.joy.t; ss = S.joy.s; }
            else {
              st = (S.keys.w || S.keys.arrowup ? 1 : 0) + (S.keys.s || S.keys.arrowdown ? -1 : 0);
              ss = (S.keys.d || S.keys.arrowright ? 1 : 0) + (S.keys.a || S.keys.arrowleft ? -1 : 0);
            }
            S.possessInput = {
              vx: (cb2.right.x / rl2) * ss + (cb2.up.x / fl) * st,
              vz: (cb2.right.z / rl2) * ss + (cb2.up.z / fl) * st,
            };
            const psq = S.squads.find((q) => q.id === S.possess.id);
            if (psq) { S.focus.x = psq.anchor.x; S.focus.z = psq.anchor.z; S.focus.y = field.heightAt(S.focus.x, S.focus.z); }
          }
```

(WASD camera-pan block: gate it with `!S.possess` so the keys drive the squad, not the map. Touch pan stays live — one finger off the stick still looks around; the camera re-locks to the squad each frame, so panning while possessed nudges and returns — acceptable, stated.)

**Step 1.6 — RELEASE and the bell.** An HTML button, bottom-right, shown while possessed (`data-possess-release`, btnBig, amber): `onClick={() => stateRef.current && stateRef.current.releasePossession()}`. In `ringBell`, FIRST line: `if (S.possess) S.releasePossession();` — the ratified bell release, and it runs before `saveFront` so no save ever sees a possession. The hud tick carries `possessed: S.possess ? { label: SQUAD_SPECS[...].label } : null` for the button row and a small "POSSESSED — [label]" chip top-center.

**Behavior stated plainly:** take control and the squad is yours — it walks where the stick says at its own marching pace, men holding formation, and it does not shoot (the trigger arrives in the next task). The war around it continues under standing orders. Release — or the bell — hands it back, dug in where it stands. If every man in it dies, possession ends by itself.

**Gates (ONLY these):** parse changed files · `npm run lint:depot` · `npm run test:depot` (1.1 green; re-pins old→new) · build AFTER bumping `src/version.js` to "mk0.90" · `SMOKE_ONLY=depot` smoke. Allowed files: `squads.js`, `DepotGame.jsx`, `depot-test.mjs`, `version.js`, `Roadmap.jsx` (the Close's phase flip rides this commit). Commit "(mk0.90)", push, CI green, STOP for audit.

---

## Task 2 — The trigger: volley at the aim (mk0.91) — suggested model: Sonnet (all code below)

A possessed squad gets the sandbox's aim-and-fire: tap the ground to aim, hold FIRE to volley — every rifle in the squad at the aimed point, sight-gated like every shot in the game.

**Required reading:** this plan whole; `CLAUDE.md`; `src/depot/state.js` `squadFire` + `shooterFire` (:351-419) + `fieldReaches`; `src/depot/specs.js` `INFANTRY_ARMS`; `src/game/ContractSandbox.jsx` :330-345 + :445-465 + :530-540 (fireAt/cooldowns, tap-aims, snapAim); `src/depot/DepotGame.jsx` T1's possession block, `tapAt`, the hud/JSX possession row; `src/depot/sight.js` `seenAt`; `scripts/depot-test.mjs` POSSESSION T1 block.

**Step 2.1 — failing tests first.** `==== POSSESSION T2`: (a) `possessedVolley` fires one `shooterFire` per living armed member at a synthetic target at the aim (fixture: 4-man rifle squad, aim 10m off, muzzle events == 4 with `weapon:"rifle"`); (b) the sight law holds — aim in a cell team 1 does not see → zero muzzles (fixture with a dark aim cell); (c) spotters and unarmed types never fire (sniper pair fixture: 1 muzzle, not 2; engineer squad: 0 and the volley refuses); (d) per-member cooldowns honored (two volleys 0.1s apart: second fires 0 muzzles); (e) source pin — the volley reads `INFANTRY_ARMS[type]` with squadFire's own blast fallbacks (the `INFANTRY_BLAST_R`/`INFANTRY_KV` constants).

**Step 2.2 — the volley, in state.js** (beside squadFire, sharing its constants and laws):

```js
// POSSESSION (P4 T2, mk0.91): the owner's trigger. One pull = one aimed
// shot from every living armed member off cooldown, at a synthetic ground
// target — through shooterFire, so scatter/lead/wind/sight law all apply
// exactly as they do to every other shot in the game. Sight-gated at the
// aim cell: you shoot only what your side sees. Returns muzzles fired.
export function possessedVolley(world, squad, aim, T, toUV = (x, z) => ({ u: x, v: z })) {
  const spec = INFANTRY_ARMS[squad.type];
  if (!spec) return 0;
  const c = toUV(aim.x, aim.z);
  if (!fieldReaches(T, c.u, c.v, squad.team)) return 0;
  const fspec = { ...spec, volley: spec.burst || 1,
    blastR: spec.blastR != null ? spec.blastR : INFANTRY_BLAST_R,
    kv: spec.kv != null ? spec.kv : INFANTRY_KV };
  const tgt = { pos: { x: aim.x, y: world.field.heightAt(aim.x, aim.z) + 0.9, z: aim.z }, v: { x: 0, y: 0, z: 0 }, hy: 0.9 };
  let fired = 0;
  for (const id of squad.memberIds) {
    const u = world.byId.get(id);
    if (!u || !u.alive || u.role === "spotter") continue;
    u.fireCd = (u.fireCd || 0);
    if (u.fireCd > 0) continue;
    u.fireCd = spec.fireRate;
    const muzzle = { x: u.pos.x, y: u.pos.y + 0.5, z: u.pos.z };
    const high = spec.occl === "lofted";
    shooterFire(world, u, muzzle, tgt, fspec, { attacker: "player", volleyDelay: spec.burstGap, muzzleStep: 0, owner: u.id, high });
    fired++;
  }
  return fired;
}
```

(Member cooldown decay while possessed: the possession block in `stepDepot` decrements `u.fireCd -= world.dt` for living members — squadFire normally does this and is skipped.)

**Step 2.3 — aim and FIRE.** DepotGame: while possessed, a canvas tap is an AIM, not a command — in `tapAt`, before everything else: `if (S.possess) { S.possessAim = clampToRim(p.x, p.z); return; }` (with `groundPoint` already computed; a null ground tap clears nothing). The aim renders through the existing hover ring (`R.overlay.setHover(true, aim.x, aim.z, h, 0, seen, 1.2)` — green when the cell is seen, red when dark, each frame while possessed). FIRE button beside RELEASE (`data-possess-fire`, red, 64px, hold-to-repeat like the sandbox: fires on pointerdown and every frame held): each attempt calls `possessedVolley(world, psq, S.possessAim, T, invW)` inside the sim bracket via a `S.fireHeld` flag — at most one volley attempt per sim tick, cooldowns do the real limiting. Touch aim assist: `snapAim` is sandbox/engine machinery — DO NOT import it; the ground aim with the seen/unseen ring is the depot's own idiom (stated deviation from the sandbox convention, reason: snapAim reads engine-mode structures).

**Behavior stated plainly:** tap ground — a ring marks the aim, green if your side sees it, red if dark. Hold FIRE — every armed man in the squad shoots at it on his own cooldown, through the same scatter and wind as any shot; dark ground refuses silently except the red ring. Spotters keep their binoculars; engineers and sappers have no trigger at all.

**Gates (ONLY these):** parse · lint:depot · test:depot (2.1 green) · build AFTER bump to "mk0.91" · SMOKE_ONLY=depot smoke. Allowed files: `state.js`, `DepotGame.jsx`, `depot-test.mjs`, `version.js`. Commit "(mk0.91)", push, CI green, STOP for audit.

---

## Task 3 — Manual fire control: the possessed tower (mk0.92) — suggested model: Sonnet (all code below)

Take control of a gun tower: its automatic targeting stops, your aim is its aim, FIRE pulls its real trigger on its real cooldown. Frost towers (no gun) offer no TAKE CONTROL.

**Required reading:** this plan whole; `CLAUDE.md`; `src/depot/DepotGame.jsx` `stepTowers` whole + the tower pie slots + T1/T2 possession machinery; `src/depot/state.js` `towerShot`/`shooterFire`/`fieldReaches`; `src/depot/specs.js` `TOWER_SPECS` (fireRate/occl/frost's fireRate 0); `scripts/depot-test.mjs` POSSESSION T1/T2 + COMMAND T1 blocks.

**Step 3.1 — failing tests first.** `==== POSSESSION T3`: (a) a possessed tower does not auto-acquire (source pin: stepTowers' possession guard skips the body); (b) `possessedTowerFire` fires the tower's real spec at the aim honoring `b.fireCd` (fixture: gun tower, two pulls 0.1s apart → 1 muzzle, `weapon:"shell"`); (c) sight law at the aim cell (dark cell → 0 muzzles); (d) frost offers no possession (source pin: the tower pie's possess slot gated on `spec.fireRate > 0`); (e) release restores auto-fire (drive the fixture: possess → release → enemy in range → tower acquires within a scan).

**Step 3.2 — the tower trigger, state.js:**

```js
// POSSESSION (P4 T3, mk0.92): a possessed tower is manual fire control —
// the real spec, the real cooldown, the real muzzle, your aim. Sight-gated
// at the aim like every shot.
export function possessedTowerFire(world, tower, aim, T, toUV = (x, z) => ({ u: x, v: z })) {
  const spec = TOWER_SPECS[tower.towerType];
  if (!spec || spec.fireRate <= 0) return false;
  tower.fireCd = tower.fireCd || 0;
  if (tower.fireCd > 0) return false;
  const c = toUV(aim.x, aim.z);
  if (!fieldReaches(T, c.u, c.v, 1)) return false;
  const tgt = { pos: { x: aim.x, y: world.field.heightAt(aim.x, aim.z) + 0.9, z: aim.z }, v: { x: 0, y: 0, z: 0 }, hy: 0.9 };
  tower.fireCd = spec.fireRate;
  tower.flashT = world.t;
  towerShot(world, tower, tgt, spec);
  return true;
}
```

**Step 3.3 — wiring.** Tower pie gains TAKE CONTROL (`data-radial="possess"`, same ✥, gated `spec.fireRate > 0`), instant action setting `S.possess = { kind: "tower", id }` and clearing selection. `stepTowers` gains the guard as its loop's first body line: `if (possessedId === b.id) { b.fireCd = (b.fireCd || 0) - dt; continue; }` (signature gains an optional `possessedId` argument, threaded from `stepDepot` — default undefined keeps every existing caller and test exact). The frame loop's possession block handles kind "tower": camera locks to the tower, no stick (towers don't walk — the joystick hides), aim + FIRE exactly as T2 (`possessedTowerFire`), RELEASE and the bell release identically; a dead tower auto-releases (guard beside T1's squad-death release). Discipline note: a possessed tower's CAREFUL/FREE is moot while possessed (friendlyFouls is not consulted — your trigger, your responsibility; stated plainly in a comment and here).

**Behavior stated plainly:** your tower, your trigger — real reload, real ballistics, real scatter; the friendly-fire safety is OFF while you hold the trigger, because the trigger is yours. Release and it goes back to picking its own targets under its own discipline. Frost tower has nothing to fire and cannot be taken.

**Gates (ONLY these):** parse · lint:depot · test:depot (3.1 green) · build AFTER bump to "mk0.92" · SMOKE_ONLY=depot smoke. Allowed files: `state.js`, `DepotGame.jsx`, `depot-test.mjs`, `version.js`. Commit "(mk0.92)", push, CI green, STOP for audit.

---

## Task 4 — The steered reticle (mk0.93) — suggested model: Sonnet (all code below)

*Amendment, 2026-08-13, the owner's ruling after playing mk0.92: tap-to-aim is replaced by a right stick that STEERS a persistent ground reticle; the reticle is bounded to the possessed unit's OWN sight circle on seen ground — dark or out-of-view ground is unreachable, not refused; FIRE shoots at the reticle. Left stick unchanged. This also closes the queued far-eyes range question: possessed fire reaches only what the possessed unit itself can view.*

**Required reading (agent, before any code; anchors re-verified at dispatch):** this plan whole; `CLAUDE.md`; `src/depot/sight.js` whole (`SIGHT`/`eyeOf`/`seenAt` — the new helpers live beside them); `src/depot/DepotGame.jsx` — the whole possession machinery as shipped (takeControl/takeControlTower/releasePossession, the frame-loop possession block, the joystick DOM, the FIRE/RELEASE row, tapAt's possession branch, `S.possessAim` sites — all of which this task touches), `stepDepot`'s possessed branches (the volley/tower-fire call sites); `src/game/ContractSandbox.jsx` :413-443 (the mouse-as-reticle convention being mapped); `scripts/depot-test.mjs` — POSSESSION T1-T3 blocks whole; grep `possessAim` (every site dies this task).

**Step 4.1 — failing tests first.** `scripts/depot-test.mjs`, new block `==== POSSESSION T4: the steered reticle` — the two helpers are pure and REALLY imported (no mirrors): (a) `steerReticle` moves the reticle at `RETICLE_SPEED` per second of stick tilt (flat lit fixture: 1s at full tilt = 14m); (b) the sight-circle clamp holds (steer hard away for 3s from a 24m radius — reticle sits ON the circle, never past); (c) an unseen cell stops it dead (hand-lit sight map with a dark band — steering into the band leaves the reticle at its last position); (d) `reclampReticle` drags a left-behind reticle back inside the circle as the center moves; (e) stranded-on-dark falls back to the center (the unit's own ground — its own eye lights it); (f) source pin — both fire paths (`possessedVolley` and `possessedTowerFire` call sites) read `S.reticle`, and `possessAim` appears nowhere in `DepotGame.jsx`; (g) source pin — the right-stick steer runs through `steerReticle` and the walk-drag through `reclampReticle` (no second clamp implementation). Run: (a)-(e) fail on missing exports, (f)/(g) fail on absent wiring; all green after.

**Step 4.2 — the helpers, in sight.js** (beside `seenAt`; pure, zero rng):

```js
// POSSESSION T4 (mk0.93): THE STEERED RETICLE. The right stick pushes a
// ground reticle around the possessed unit — deflection is velocity, it
// stays put on release — and the reticle can only exist inside the unit's
// OWN sight circle on ground the side currently sees. Dark ground is not
// refused; it is unreachable. Pure functions: the game layer owns the
// state, these own the rules.
export const RETICLE_SPEED = 14;   // m/s at full tilt // provisional (F5)
export function steerReticle(SG, team, center, radius, cur, vx, vz, dt, toUV) {
  let nx = cur.x + vx * RETICLE_SPEED * dt, nz = cur.z + vz * RETICLE_SPEED * dt;
  const dx = nx - center.x, dz = nz - center.z;
  const d = Math.hypot(dx, dz);
  if (d > radius && d > 1e-9) { nx = center.x + (dx / d) * radius; nz = center.z + (dz / d) * radius; }
  const c = toUV(nx, nz);
  if (!seenAt(SG, c.u, c.v, team)) return { x: cur.x, z: cur.z };   // stopped dead at the dark
  return { x: nx, z: nz };
}
// The unit walks; the reticle is world-anchored — every tick it is dragged
// back inside the live circle, and if the ground under it has gone dark it
// falls home to the unit's own cell (always lit by the unit's own eye).
export function reclampReticle(SG, team, center, radius, cur, toUV) {
  let nx = cur.x, nz = cur.z;
  const dx = nx - center.x, dz = nz - center.z, d = Math.hypot(dx, dz);
  if (d > radius && d > 1e-9) { nx = center.x + (dx / d) * radius; nz = center.z + (dz / d) * radius; }
  const c = toUV(nx, nz);
  if (seenAt(SG, c.u, c.v, team)) return { x: nx, z: nz };
  return { x: center.x, z: center.z };
}
```

**Step 4.3 — the possessed unit's circle.** `DepotGame.jsx`, beside the possession machinery (`eyeOf` joins the sight.js import):

```js
      // The possessed unit's own sight circle: a squad sees with its best
      // living eye (a sniper pair's spotter reaches 46), a tower with its
      // height. The reticle lives inside THIS circle — the owner's ruling
      // that closes the far-eyes range question.
      const possessCenter = () => {
        const P = S.possess;
        if (!P) return null;
        if (P.kind === "tower") { const b = world.byId.get(P.id); return b ? { x: b.pos.x, z: b.pos.z } : null; }
        const sq = S.squads.find((q) => q.id === P.id);
        return sq ? { x: sq.anchor.x, z: sq.anchor.z } : null;
      };
      const possessSightR = () => {
        const P = S.possess;
        if (!P) return 0;
        if (P.kind === "tower") { const b = world.byId.get(P.id); return b ? eyeOf(b).r : 0; }
        const sq = S.squads.find((q) => q.id === P.id);
        let r = 0;
        if (sq) for (const id of sq.memberIds) { const u = world.byId.get(id); if (u && u.alive) r = Math.max(r, eyeOf(u).r); }
        return r;
      };
```

**Step 4.4 — state and lifecycle.** `S.reticle = null` in the state object. `S.takeControl` and `S.takeControlTower` both seed it — `S.reticle = reclampReticle(T.sight, 1, c, possessSightR(), { x: c.x, z: c.z + 4 }, invW)` computed AFTER `S.possess` is set (adapt the +4 offset through `fwdU`'s camera-up if trivially available; a fixed world offset is acceptable — the reclamp makes any seed legal). `S.releasePossession` clears it (`S.reticle = null;` joins the existing possessAim/fireHeld clears — which this task then DELETES: every `possessAim` site dies, the hygiene clears now clear `S.reticle`/`S.fireHeld`; re-pin the mk0.91 audit pin accordingly, old→new).

**Step 4.5 — the right stick.** A second joystick, mirrored from the left one's DOM pattern: base center at `(width - 92, height - 208)` (above the FIRE/RELEASE row), same radius 56, same deadzone, own pointer capture, visible whenever possessed (towers too — their LEFT stick stays hidden, the right one is their whole interface). Its deflection lands in `S.joyR = { t, s, active }`. In the frame loop's possession block: camera-relative vector exactly as the left stick's math, then

```js
            const rc = possessCenter();
            if (rc && S.reticle) {
              const rv = /* camera-relative vector from S.joyR (touch) — desktop: see below */;
              S.reticle = steerReticle(T.sight, 1, rc, possessSightR(), S.reticle, rv.vx, rv.vz, dt, invW);
              S.reticle = reclampReticle(T.sight, 1, rc, possessSightR(), S.reticle, invW);
            }
```

Desktop maps the sandbox's own convention: the MOUSE is the reticle — each frame, `groundPoint(pointer)` reclamped through `reclampReticle` sets it directly (position, not velocity; the stick ruling governs the stick; the mouse was always positional in the sandbox). Arrow keys are already squad-drive and stay so.

**Step 4.6 — the ring and the trigger.** The aim ring renders at `S.reticle` every possessed frame — always green (the reticle cannot exist on dark ground by construction; the red state dies with possessAim). Both fire paths read the reticle: the volley attempt becomes `possessedVolley(world, psq, S.reticle, T, invW)` and the tower's `possessedTowerFire(world, pb, S.reticle, T, invW)` — their internal sight gates stay (defense in depth, and they still bound `__DEPOT`-driven calls). Taps while possessed stay consumed and now do NOTHING (the reticle is stick-and-mouse only — a thumb tap can no longer yank the aim; stated plainly in the comment).

**Behavior stated plainly:** possess anything and a green reticle lives on the ground near it. The right stick pushes it around like a cursor; it stops dead at the edge of what the unit can see and at the circle of how far it can see; walking drags it along; it comes home if its ground goes dark. FIRE volleys at it, no aiming tap needed, and there is nothing to aim at that the unit couldn't watch — range and sight in one circle. On desktop the mouse is the reticle, the sandbox's own convention.

**Gates (ONLY these):** parse changed files · `npm run lint:depot` · `npm run test:depot` (4.1 green; every re-pin old→new) · build AFTER bumping `src/version.js` to "mk0.93" · `SMOKE_ONLY=depot` smoke. Allowed files: `sight.js`, `DepotGame.jsx`, `depot-test.mjs`, `version.js`. Commit "(mk0.93)", push, CI green, STOP for audit.

---

## Task 5 — Playtest fixes: the red carried reticle, the bell keeps your hands (mk0.94) — suggested model: Sonnet (all code below)

*Amendment, 2026-08-13, the owner's ruling after playing mk0.93. Three changes: (1) the reticle draws as a RED circle; (2) the reticle is CARRIED — release the right stick and it keeps its distance and direction from the unit, so walking with the left stick brings it along; it no longer sits on one spot of ground; (3) the round bell no longer takes the unit away — this REVERSES the ratified "a bell save mid-possession releases to command view" rule. The save still never records a possession; you simply stay in control after it is written.*

**Choices made in this plan (stated, not open):** the reticle's position is stored as an offset from the unit (`S.reticleOff`); the world point `S.reticle` is derived from it each frame, so the fire paths and the ring keep reading the same field. The red circle is a new, additive ring in the renderer (`setReticle`), drawn in the game's established red (`0xff6b5e`); renderer additions are legal as guarded additive divergences with the golden gate green. If the ground under the carried reticle goes dark, it still falls home to the unit — that rule is unchanged.

**Required reading (agent, before any code; anchors re-verified at dispatch):** this plan whole; `CLAUDE.md`; `src/depot/sight.js` — the two T4 helpers (:156-185); `src/depot/DepotGame.jsx` — state init (~:1240), takeControl/takeControlTower/releasePossession (~:1560-1610), the frame-loop possession block (~:2700-2745), the ring render (~:2900-2910), `ringBell` (~:2198), `groundPoint`, `invW`; `src/render/renderer.js` :1160-1195 (`setHover` and the overlay's lazy-null pattern — the new ring copies it); `scripts/depot-test.mjs` — POSSESSION T1(c)/(d) (:4450-4478), audit item A (:4605-4622), the whole T4 block (:4747-4862).

**Step 5.1 — failing tests first.** `scripts/depot-test.mjs`. Four edits, run after all four: the reshaped T4 asserts fail on the old world-point helper shapes, the reversed T1(d) fails on the live release line, the new T5 pins fail on absent wiring. Record the failing run, then green after implementation.

(1) T4 (a)-(e) move to offset semantics — same fixtures, helpers now take and return `{dx, dz}` offsets:

```js
  // (a)
    const r = steerReticle(T.sight, 1, { x: 0, z: 0 }, 50, { dx: 0, dz: 0 }, 0, 1, 1, idUV);
    ok("POSSESSION T4(a): steerReticle moves the offset RETICLE_SPEED (14) m in 1s at full tilt",
      RETICLE_SPEED === 14 && Math.abs(r.dx - 0) < 0.01 && Math.abs(r.dz - 14) < 0.01,
      `r=(${r.dx.toFixed(2)},${r.dz.toFixed(2)})`);
  // (b) — cur starts { dx: 0, dz: 0 }; each step:
      cur = steerReticle(T.sight, 1, center, radius, cur, 1, 0, 0.1, idUV);
      const d = Math.hypot(cur.dx, cur.dz);
  //     (worstD/finalD asserts unchanged in wording; distance is now offset length)
  // (c)
    const cur = { dx: 0, dz: 0 };
    const r = steerReticle(T.sight, 1, { x: 0, z: 0 }, 50, cur, 1, 0, 1, idUV);
    ok("POSSESSION T4(c): steering into an unseen cell leaves the reticle exactly where it was",
      r.dx === cur.dx && r.dz === cur.dz, `r=(${r.dx},${r.dz})`);
  // (d) — the carry law replaces the old drag-behind test:
    const T = litTerritory();
    const off = reclampReticle(T.sight, 1, { x: 20, z: 0 }, 10, { dx: 0, dz: 8 }, idUV);
    ok("POSSESSION T4(d): a lit, in-circle offset survives the walk unchanged — the reticle is carried",
      Math.abs(off.dx - 0) < 0.01 && Math.abs(off.dz - 8) < 0.01, `off=(${off.dx.toFixed(2)},${off.dz.toFixed(2)})`);
    const far = reclampReticle(T.sight, 1, { x: 20, z: 0 }, 10, { dx: 25, dz: 0 }, idUV);
    ok("POSSESSION T4(d): an oversized offset is pulled to the circle's edge, direction kept",
      Math.abs(far.dx - 10) < 0.01 && Math.abs(far.dz - 0) < 0.01, `far=(${far.dx.toFixed(2)},${far.dz.toFixed(2)})`);
  // (e)
    const r = reclampReticle(T.sight, 1, { x: 0, z: 0 }, 10, { dx: 50, dz: 0 }, idUV);
    ok("POSSESSION T4(e): a reclamp that would land on dark ground falls all the way back to the unit",
      r.dx === 0 && r.dz === 0, `r=(${r.dx},${r.dz})`);
```

(2) T4(g)'s two frame-loop regexes re-pin to the offset wiring (import pin unchanged):

```js
    ok("POSSESSION T4(g) source pin: the frame loop steers the OFFSET through steerReticle",
      /S\.reticleOff = steerReticle\(T\.sight, 1, rc, rR, S\.reticleOff, rv\.vx, rv\.vz, dt, invW\);/.test(gameSrc));
    ok("POSSESSION T4(g) source pin: the walk-carry runs through reclampReticle and derives the world point",
      /S\.reticleOff = reclampReticle\(T\.sight, 1, rc, rR, S\.reticleOff, invW\);/.test(gameSrc) &&
      /S\.reticle = \{ x: rc\.x \+ S\.reticleOff\.dx, z: rc\.z \+ S\.reticleOff\.dz \};/.test(gameSrc));
```

(3) T1(d) reverses — the bell keeps possession (T1(c) already proves, with a live possession at save time, that the saved record stays clean; it stands unchanged):

```js
  // (d) source pin, REVERSED by the owner's mk0.93 playtest ruling: the bell
  // no longer releases possession — you keep the unit through the round
  // change. The save it writes still carries no possession (T1(c) proves
  // that with a live possession at save time).
  {
    const ringBellBody = (dsrc.match(/const ringBell = \(\) => \{[\s\S]*?\n      \};/) || [""])[0];
    ok("POSSESSION T1(d): ringBell no longer releases possession — the bell keeps your hands on the unit",
      ringBellBody.length > 0 && !ringBellBody.includes("releasePossession"), ringBellBody.slice(0, 80));
    ok("POSSESSION T1(d): the bell still writes the save",
      ringBellBody.includes("saveFront();"));
  }
```

(4) Audit item A re-pins to the offset seed, and a new T5 block lands after T4:

```js
    ok("POSSESSION T4 audit item A source pin (re-pinned from T2): S.takeControl clears fireHeld and seeds a fresh offset reticle",
      /S\.fireHeld = false;/.test(takeControlBody) && /S\.reticleOff = pc0 \? reclampReticle\(T\.sight, 1, pc0, possessSightR\(\), \{ dx: 0, dz: 4 \}, invW\) : null;/.test(takeControlBody),
      takeControlBody.length);
    ok("POSSESSION T4 audit item A source pin (re-pinned from T2): S.releasePossession clears reticle/offset/fireHeld",
      /S\.reticle = null; S\.reticleOff = null; S\.fireHeld = false;/.test(releaseBody), releaseBody.length);
```

```js
// ==== POSSESSION T5: the red carried reticle, the bell keeps your hands =====
// mk0.94 (Phase 4 Task 5, playtest amendment). The reticle is an offset from
// the unit — walking carries it — and draws as its own red ring, not the
// build ghost's square. The bell no longer ends possession (reversal pinned
// in T1(d) above). JSX/renderer wiring pinned by source regex, T1-T3's own
// convention.
{
  const gameSrc = fs.readFileSync(new URL("../src/depot/DepotGame.jsx", import.meta.url), "utf8");
  const rendSrc = fs.readFileSync(new URL("../src/render/renderer.js", import.meta.url), "utf8");
  ok("POSSESSION T5(a) source pin: the renderer owns a setReticle overlay drawn in the established red",
    /setReticle\(on, x, z, y\)/.test(rendSrc) && /0xff6b5e/.test(String(rendSrc.match(/setReticle\(on, x, z, y\) \{[\s\S]*?\n    \},/) || "")));
  ok("POSSESSION T5(b) source pin: the possessed ring renders through setReticle, not the build ghost's setHover",
    /R\.overlay\.setReticle\(/.test(gameSrc) && !/S\.possess && S\.reticle[\s\S]{0,400}setHover/.test(gameSrc));
  ok("POSSESSION T5(c) source pin: the build hover never paints while possessed",
    /!S\.possess && S\.hover/.test(gameSrc));
}
// ==== end POSSESSION T5 =====================================================
```

**Step 5.2 — the helpers go offset-native.** `src/depot/sight.js` :156-185 — replace the two T4 functions in place (`RETICLE_SPEED` and the comment block stay, comment reworded to the carry law):

```js
// POSSESSION T4/T5 (mk0.93/0.94): THE CARRIED RETICLE. The right stick
// steers an OFFSET from the possessed unit — deflection is velocity, the
// offset holds on release, and walking carries the reticle with the unit.
// It can only exist inside the unit's own sight circle on ground the side
// currently sees: dark ground stops the steer dead, and ground that goes
// dark under a carried reticle drops it home to the unit's own cell. Pure
// functions: the game layer owns the state, these own the rules.
export const RETICLE_SPEED = 14;   // m/s at full tilt // provisional (F5)
export function steerReticle(SG, team, center, radius, off, vx, vz, dt, toUV) {
  let dx = off.dx + vx * RETICLE_SPEED * dt, dz = off.dz + vz * RETICLE_SPEED * dt;
  const d = Math.hypot(dx, dz);
  if (d > radius && d > 1e-9) { dx *= radius / d; dz *= radius / d; }
  const c = toUV(center.x + dx, center.z + dz);
  if (!seenAt(SG, c.u, c.v, team)) return { dx: off.dx, dz: off.dz };   // stopped dead at the dark
  return { dx, dz };
}
export function reclampReticle(SG, team, center, radius, off, toUV) {
  let dx = off.dx, dz = off.dz;
  const d = Math.hypot(dx, dz);
  if (d > radius && d > 1e-9) { dx *= radius / d; dz *= radius / d; }
  const c = toUV(center.x + dx, center.z + dz);
  if (seenAt(SG, c.u, c.v, team)) return { dx, dz };
  return { dx: 0, dz: 0 };   // its ground went dark — home to the unit's own cell
}
```

**Step 5.3 — state, seed, release.** `DepotGame.jsx`: state init gains `reticleOff: null` beside `reticle: null` (comment updated to the carry law). Both take-control closures seed the offset (the derived world point follows); the release clears all three:

```js
        S.fireHeld = false;
        const pc0 = possessCenter();
        S.reticleOff = pc0 ? reclampReticle(T.sight, 1, pc0, possessSightR(), { dx: 0, dz: 4 }, invW) : null;
        S.reticle = pc0 && S.reticleOff ? { x: pc0.x + S.reticleOff.dx, z: pc0.z + S.reticleOff.dz } : null;
```

(`takeControlTower` identical with its `pc1`.) In `S.releasePossession`: `S.reticle = null; S.reticleOff = null; S.fireHeld = false;`.

**Step 5.4 — the frame loop carries.** The possession block's reticle section becomes offset-native — steer moves the offset, the mouse sets it, the reclamp bounds it, and the world point is derived last (fire paths and the ring keep reading `S.reticle`, untouched):

```js
            const rc = possessCenter();
            const rR = possessSightR();
            if (rc && S.reticleOff) {
              if (S.joyR && S.joyR.active) {
                const cb3 = R.camBasis;
                const fl3 = Math.hypot(cb3.up.x, cb3.up.z) || 1, rl3 = Math.hypot(cb3.right.x, cb3.right.z) || 1;
                const rv = {
                  vx: (cb3.right.x / rl3) * S.joyR.s + (cb3.up.x / fl3) * S.joyR.t,
                  vz: (cb3.right.z / rl3) * S.joyR.s + (cb3.up.z / fl3) * S.joyR.t,
                };
                S.reticleOff = steerReticle(T.sight, 1, rc, rR, S.reticleOff, rv.vx, rv.vz, dt, invW);
              } else if (!isTouch && S.pointer) {
                const gp = groundPoint(S.pointer.x, S.pointer.y);
                if (gp) S.reticleOff = { dx: gp.x - rc.x, dz: gp.z - rc.z };
              }
              S.reticleOff = reclampReticle(T.sight, 1, rc, rR, S.reticleOff, invW);
              S.reticle = { x: rc.x + S.reticleOff.dx, z: rc.z + S.reticleOff.dz };
            }
```

**Step 5.5 — the red circle.** `src/render/renderer.js`: `let retRing = null;` joins the overlay's lazy nulls (~:1165), and `setReticle` joins the overlay object beside `setHover` — additive, nothing existing touched:

```js
    // POSSESSION T5 (mk0.94): the possessed reticle — its own red ring, not
    // the build ghost. Lazy like everything here; the game layer drives it
    // only while a possession is live.
    setReticle(on, x, z, y) {
      if (!retRing) {
        retRing = new THREE.Mesh(new THREE.RingGeometry(0.82, 1.0, 44), new THREE.MeshBasicMaterial({ color: 0xff6b5e, transparent: true, opacity: 0.85, depthWrite: false }));
        retRing.rotation.x = -Math.PI / 2; retRing.layers.set(1); scene.add(retRing);
      }
      retRing.visible = !!on;
      if (on) { retRing.position.set(x, y + 0.1, z); retRing.scale.set(1.2, 1.2, 1); }
    },
```

`DepotGame.jsx` ring render: the possessed branch leaves the `setHover` chain — the reticle gets its own call every frame, and the build hover is gated off while possessed:

```js
          R.overlay.setReticle(!!(S.possess && S.reticle),
            S.reticle ? S.reticle.x : 0, S.reticle ? S.reticle.z : 0,
            S.reticle ? field.heightAt(S.reticle.x, S.reticle.z) : 0);
          if (!S.possess && S.hover) {
            // (existing sandbag-ghost / setHover body unchanged)
```

(...and the chain's final `else R.overlay.setHover(false);` stays.)

**Step 5.6 — the bell keeps your hands.** `ringBell` (~:2198): DELETE the line `if (S.possess) S.releasePossession();` and replace with the comment:

```js
        // POSSESSION T5 (mk0.94), REVERSING the mk0.90 rule by the owner's
        // playtest ruling: the bell does NOT release possession — the round
        // changes under your hands. The save it writes still never carries
        // one (serializeFront never reads S.possess; pinned by T1(c)/(d)).
```

Nothing else in the bell path changes; the release-on-death guards stay.

**Behavior stated plainly:** the reticle is a red circle. Push it out with the right stick and let go — it stays that far from the unit, in that direction, and walks with you. It still cannot leave the unit's sight circle or sit on unseen ground; ground that goes dark under it drops it back to the unit. The bell rings, the round changes, the save is written — and you are still driving.

**Gates (ONLY these):** parse changed files · `npm run lint:depot` · `npm run test:depot` (5.1 green; every re-pin old→new) · `npm run golden` (renderer touched — the additive-divergence guard) · build AFTER bumping `src/version.js` to "mk0.94" · `SMOKE_ONLY=depot` smoke. Allowed files: `sight.js`, `DepotGame.jsx`, `renderer.js`, `depot-test.mjs`, `version.js`. Commit "(mk0.94)", push, CI green, STOP for audit.

---

## Task 6 — Wind finish and trigger feedback (mk0.96) — suggested model: Sonnet (all code below)

*Amendment, 2026-08-13, the owner's rulings after mk0.95: the WIND toggle must silence the wind you hear and still the flags, not just the mechanics; the FIRE button must show it is held so a hold the phone cancels is visible the moment it dies. Two-task sequencing ratified (this, then the aim overhaul).*

**Required reading (agent, before any code; anchors re-verified at dispatch):** this plan whole; `CLAUDE.md`; `src/platform/audio.js` :580-660 (the wind bed: WIND_BASE, wSurge/wGust/wFlut, the three setLoop lines — the bed never reads `world.wind` today) and :31-50 (module shape); `src/render/renderer.js` :1891-1923 (the flag block — the amp line's 0.12 floor is the defect) and :1-10; `src/depot/DepotGame.jsx` — FIRE button JSX (~:3344-3352), the joyKnobRef direct-DOM discipline (~:826-833, :3237-3255), stepDepot's wind gate (~:680-684); `scripts/depot-test.mjs` WIND TOGGLE block (~:4880) and the source-pin idiom.

**Step 6.1 — failing tests first.** `scripts/depot-test.mjs`, extend the WIND TOGGLE block:

```js
  ok("WIND TOGGLE source pin: the audio wind bed is scaled by the real wind (world.wind.mag)",
    /const wScale = world\.wind \? Math\.min\(1, \(world\.wind\.mag \|\| 0\) \/ 3\.5\) : 1;/.test(
      fs.readFileSync(new URL("../src/platform/audio.js", import.meta.url), "utf8")));
  {
    const rendSrc = fs.readFileSync(new URL("../src/render/renderer.js", import.meta.url), "utf8");
    ok("WIND TOGGLE source pin: flag ripple has no floor — dead calm means limp cloth",
      /const amp = Math\.min\(0\.55, mag \* 0\.13\);/.test(rendSrc) && !/0\.12 \+ mag \* 0\.09/.test(rendSrc));
  }
  ok("FIRE FEEDBACK source pin: the FIRE button's held state routes through setFireHeld",
    /const setFireHeld = \(v\) => \{/.test(fs.readFileSync(new URL("../src/depot/DepotGame.jsx", import.meta.url), "utf8")));
```

**Step 6.2 — the bed follows the wind.** `src/platform/audio.js`, in `tick`, where `wLvl` is computed (the three drift lines stay — they are the bed's CHARACTER; the new factor is its PERMISSION):

```js
    // WIND TOGGLE (mk0.96): the bed follows the GAME's wind. A depot world
    // carries world.wind — dead calm (mag 0, the toggle off) silences the
    // bed entirely and a real gale brings it up. Worlds with no wind field
    // (sandbox, campaign, demo, mech) keep the old ambient bed exactly.
    const wScale = world.wind ? Math.min(1, (world.wind.mag || 0) / 3.5) : 1; // provisional (F5)
    const wLvl = Math.pow(10, Math.max(-12, Math.min(9, wSurge * 6 + wGust * 4 + wFlut * 1.5)) / 20) * wScale;
```

**Step 6.3 — the flag goes limp.** `src/render/renderer.js` :1898, replace the amp line:

```js
        const amp = Math.min(0.55, mag * 0.13); // no floor: dead calm = limp cloth // provisional (F5)
```

(At a typical live wind of ~3 m/s this is within a hair of the old look; only calm changes. Renderer change → the golden gate rides this task's gates.)

**Step 6.4 — the FIRE button shows its state.** `src/depot/DepotGame.jsx`: a `fireBtnRef` beside `joyRKnobRef`, and one helper beside `toggleWind` (direct DOM writes, the joystick knob's own discipline — no React state in the hot path):

```js
  const fireBtnRef = useRef(null);
  const setFireHeld = (v) => {
    const S = stateRef.current; if (S) S.fireHeld = v;
    if (fireBtnRef.current) {
      fireBtnRef.current.style.background = v ? "#ff6b5e" : "#2a1418";
      fireBtnRef.current.style.color = v ? "#1a0d0f" : "#ff6b5e";
    }
  };
```

The button gains `ref={fireBtnRef}` and its three handlers become: pointerdown `{ e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); setFireHeld(true); }`, pointerup and pointercancel `{ e.stopPropagation(); setFireHeld(false); }`. A hold the phone cancels now visibly pops the button back — the silent-death tell the owner asked for.

**Behavior stated plainly:** WIND OFF is silence and limp flags; WIND ON breathes with the actual gusts. FIRE lights up while your finger truly holds it and goes dark the instant the browser drops the hold.

**Gates (ONLY these):** parse changed files · `npm run lint:depot` · `npm run test:depot` (6.1 green) · `npm run golden` (renderer touched) · build AFTER bumping `src/version.js` to "mk0.96" · `SMOKE_ONLY=depot` smoke. Allowed files: `audio.js`, `renderer.js`, `DepotGame.jsx`, `depot-test.mjs`, `version.js`. Sound acceptance is the owner's ear on the live site (the toggle is its own A/B). Commit "(mk0.96)", push, CI green, STOP for audit.

---

## Task 7 — The sharpened hand: possessed accuracy, lead, cover, fire discipline (mk0.97) — suggested model: Sonnet (all code below)

*Amendment, 2026-08-13, the owner's rulings: possessed fire spreads ×0.25; the reticle near a live enemy aims at the man (real speed, real height — lead); cover becomes a bonus, both sides (graze exempts the muzzle's first 2.5 m; braced shooters tighten ×0.85); a possessed squad forms a firing line perpendicular to the aim; any shooter whose teammate stands in the corridor HOLDS the shot. Damage-per-second pins are expected to move — every re-pin reported old→new, its own bullet.*

**Laws binding this task:** zero new rng draws anywhere (every helper below is deterministic; applyScatter keeps its exact two draws per shot); engine/demo/renderer untouched; enemy shooters keep the shared model, so the cover changes reach them symmetrically (aim fully equal) while the ×0.25 and the lead are possession-only (your hands); mortars' lob is EXEMPT from the corridor check (arcing over your own men is its purpose).

**Required reading (agent, before any code; anchors re-verified at dispatch):** this plan whole; `CLAUDE.md`; `src/depot/state.js` — possessedVolley :602-624, possessedTowerFire :629-641, squadFire :500-595, shooterFire :351-408, fieldReaches :29-32; `src/depot/accuracy.js` whole (SOLID_KINDS :27, losGraze :147-167, scatterSigma :169-176, applyScatter :264-279); `src/depot/squads.js` — slotFor :383-392, drivePossessedSquad :665-711 (the cohesion deviation note), clearSlot :176-186; `src/depot/DepotGame.jsx` — the possessed drive call :640-655, the sim-tick triggers :2885-2902; `src/depot/specs.js` INFANTRY_ARMS :178-200 + TOWER_SPECS :34-40; `scripts/depot-test.mjs` — POSSESSION T1-T5 blocks, and grep `DPS` (every damage-per-second assert that may re-pin).

**Step 7.1 — failing tests first.** `scripts/depot-test.mjs`, new block `==== POSSESSION T7: the sharpened hand`:

(a) the constants exist and are pinned: `POSSESS_ACC === 0.25`, `POSSESS_SNAP_R === 2` (imported from state.js — real imports, no mirrors).
(b) possessed spread: flat world, seeded; 4-man rifle squad, aim 20 m; run 15 volleys (advancing cooldowns), collect every muzzle event's direction, compute each shot's angle off the ideal muzzle→aim line; assert the MEAN angle < 0.035 rad (the ×0.25 hand) — and a control through `squadFire` at an enemy at the same range on the same seed asserts its mean > 0.06 (the machine stays loose).
(c) lead: an enemy walking laterally at 3 m/s, reticle ON him — the fired azimuth deviates from his CURRENT bearing in the direction of his motion (lead is live); the same shot with him standing still fires straight at him.
(d) snap respects the sight law: the enemy within 2 m of the reticle but on a cell team 1 does not see → the volley aims at the GROUND point (no snap; source of truth: the muzzle direction matches the ground solution).
(e) cover is a bonus now: `losGraze` with a sandbag 1 m from the muzzle returns 0 (the exemption); with the same bag at mid-path returns > 0 (real grazing still costs); `bracedAt` true beside a sandbag, and `scatterSigma` there = base × 0.85.
(f) the firing line: `drivePossessedSquad` WITH an aim → the four members' goals are collinear within tolerance on the axis perpendicular to anchor→aim, spaced ~1.5 m; WITHOUT an aim the ring holds (T1(a) stays green untouched).
(g) check fire: 2-man rifle fixture, mate standing dead on the muzzle→aim line 3 m out → `possessedVolley` fires 1 muzzle, and the held man's `fireCd` is NOT consumed (he fires the instant the lane clears); mate stepped 1.5 m aside → 2 muzzles.
(h) mortars exempt: the same blocked geometry with a mortar team → both tubes fire (occl "lofted").
(i) auto squads inherit the discipline: `squadFire` with a mate in the corridor holds that man's shot the same way.

**Step 7.2 — the constants and the snap, in state.js** (beside possessedVolley):

```js
// POSSESSION T7 (mk0.97): THE SHARPENED HAND. Under the owner's control a
// shooter is deliberate: spread tightens to a quarter of the machine's
// (possession-only — auto-fire keeps the loose suppressive model), and a
// reticle resting on or near a live enemy aims at the MAN — his body, his
// speed, his height — through shooterFire's existing lead solve. The snap
// obeys the sight law: a man on unseen ground is not snapped to.
export const POSSESS_ACC = 0.25;   // spread multiplier under player control // provisional (F5)
export const POSSESS_SNAP_R = 2;   // m — reticle-to-enemy snap radius // provisional (F5)
export function snapTargetNear(world, aim, T, toUV, r = POSSESS_SNAP_R) {
  let best = null, bd = r * r;
  for (const b of world.bodies) {
    if ((b.kind !== "unit" && b.kind !== "vehicle") || !b.alive || b.team !== 2) continue;
    const dx = b.pos.x - aim.x, dz = b.pos.z - aim.z, d2 = dx * dx + dz * dz;
    if (d2 >= bd) continue;
    const c = toUV(b.pos.x, b.pos.z);
    if (!fieldReaches(T, c.u, c.v, 1)) continue;   // you snap only to what your side sees
    bd = d2; best = b;
  }
  return best;
}
```

**Step 7.3 — check fire, in state.js** (beside snapTargetNear; closed-form segment distance, no sampling, no draws):

```js
// THE CORRIDOR (T7): a living teammate inside MATE_R of the muzzle->aim
// line means this man HOLDS his shot — cooldown untouched, so he fires the
// instant the lane clears. Lofted specs (mortars) never check: arcing over
// your own men is the tube's whole purpose.
export const MATE_R = 0.5;   // m — corridor half-width // provisional (F5)
export function mateBlocks(world, squad, shooter, muzzle, aimPos) {
  const dx = aimPos.x - muzzle.x, dz = aimPos.z - muzzle.z;
  const d2 = dx * dx + dz * dz;
  if (d2 < 1e-9) return false;
  for (const id of squad.memberIds) {
    if (id === shooter.id) continue;
    const m = world.byId.get(id);
    if (!m || !m.alive) continue;
    const t = ((m.pos.x - muzzle.x) * dx + (m.pos.z - muzzle.z) * dz) / d2;
    if (t <= 0.02 || t >= 1) continue;
    const px = muzzle.x + dx * t, pz = muzzle.z + dz * t;
    if (Math.hypot(m.pos.x - px, m.pos.z - pz) < MATE_R + (m.hx || 0.28)) return true;
  }
  return false;
}
```

**Step 7.4 — the possessed triggers sharpen.** `possessedVolley`: the fspec gains `acc: spec.acc * POSSESS_ACC`; after the sight gate, `const live = snapTargetNear(world, aim, T, toUV);` and the target becomes `const tgt = live || { pos: {...ground...}, v: {0,0,0}, hy: 0.9 };` (the live BODY rides shooterFire exactly as squadFire's targets do — real velocity, real height); the member loop gains, before the cooldown is set: `if (fspec.occl !== "lofted" && mateBlocks(world, squad, u, muzzle, tgt.pos)) continue;`. `possessedTowerFire`: `towerShot(world, tower, tgt, { ...spec, acc: spec.acc * POSSESS_ACC })` with the same snap for `tgt` (towers have no squadmates — no corridor check).

**Step 7.5 — auto squads inherit the discipline.** `squadFire`'s member loop, after a target is chosen and before `u.fireCd = spec.fireRate`: `if (fspec.occl !== "lofted" && mateBlocks(world, squad, u, muzzle, best.pos)) continue;` — the held man's cooldown is untouched, same rule. (Enemy waves are not squads — no roster, no check; stated, not hidden.)

**Step 7.6 — cover becomes a bonus, in accuracy.js.** `losGraze`: the sample loop starts past the muzzle exemption —

```js
const GRAZE_MUZZLE_EXEMPT = 2.5; // m — your own parapet is a rest, not an obstruction // provisional (F5)
  for (let s = Math.max(GRAZE_STEP, GRAZE_MUZZLE_EXEMPT); s < len - GRAZE_STEP; s += GRAZE_STEP) {
```

and beside it the brace (same static-solid set, XZ proximity to the muzzle):

```js
const BRACE_R = 1.2, BRACE_K = 0.85; // provisional (F5)
export function bracedAt(world, x, z) {
  for (const b of world.bodies) {
    if (!b.alive || !SOLID_KINDS.has(b.kind)) continue;
    if (b.invM > 0 && b.kind !== "chunk" && b.kind !== "tree") continue;
    if (Math.abs(x - b.pos.x) <= b.hx + BRACE_R && Math.abs(z - b.pos.z) <= b.hz + BRACE_R) return true;
  }
  return false;
}
```

`scatterSigma`'s return becomes `spec.acc * range * elev * graze * (bracedAt(world, muzzle.x, muzzle.z) ? BRACE_K : 1);` — symmetric: every shooter on both sides who stands at cover shoots tighter, and nobody is punished for his own parapet again.

**Step 7.7 — the firing line, in squads.js.** Beside `slotFor`:

```js
// POSSESSION T7 (mk0.97): under the stick with a live aim, the squad shakes
// out into a FIRING LINE perpendicular to the aim — nobody stands behind
// anybody, so the corridor hold above almost never fires. Ring spacing kept
// (1.5m). Pure geometry, no draws.
function lineSlotFor(squad, idx, n, aim) {
  const dx = aim.x - squad.anchor.x, dz = aim.z - squad.anchor.z;
  const d = Math.hypot(dx, dz) || 1;
  const px = -dz / d, pz = dx / d;
  const o = (idx - (n - 1) / 2) * 1.5;
  return { x: squad.anchor.x + px * o, z: squad.anchor.z + pz * o };
}
```

`drivePossessedSquad(world, squad, vx, vz, dt, aim)` — the new LAST argument defaults undefined (every existing caller and the T1 pins stay exact); the member loop's slot becomes `const s = aim ? lineSlotFor(squad, i, n, aim) : slotFor(squad, i, n);`. `DepotGame.jsx`'s possessed branch threads it: `drivePossessedSquad(world, sq, pi.vx, pi.vz, world.dt, S.reticle);`.

**Behavior stated plainly:** take control and the men fan into a line facing your reticle. Park the reticle on a walking enemy and they lead him — and mostly hit him, because your hands are four times steadier than the machine's. A man behind sandbags shoots tighter, not wider, on both sides of the war. Nobody fires through the back of the man in front; he waits his half-second and the line sorts itself out. Mortars still lob over everyone's heads, yours included.

**Gates (ONLY these):** parse changed files · `npm run lint:depot` · `npm run test:depot` (7.1 green; EVERY damage-per-second re-pin old→new, each its own bullet) · build AFTER bumping `src/version.js` to "mk0.97" · `SMOKE_ONLY=depot` smoke. Allowed files: `state.js`, `accuracy.js`, `squads.js`, `DepotGame.jsx`, `depot-test.mjs`, `version.js`. Feel acceptance (hit rates, line look, hold cadence) is the owner's playtest alone. Commit "(mk0.97)", push, CI green, STOP for audit.

---

## Task 8 — Stone stands: infantry can't knock buildings over (mk0.98) — suggested model: Sonnet (all code below)

*Amendment, 2026-08-13, the owner's ruling after mk0.96 play: a rifle squad walked into a town building and toppled it. That must never happen. Scope ruled (all three): (1) infantry can never wake standing masonry — the categorical physics fix, both sides; (2) the possessed stick stops at buildings the way it stops at the map rim; (3) the build bar hides while possessed (its buttons sit under the joysticks today). Dispatches only after Task 7 lands — one agent in the tree.*

**Why it happens (diagnosis, pinned):** town stones are 100 kg welded chunks, asleep — and a sleeping stone is immovable until woken. The engine's wake rule lets ANY body moving faster than a slow walk wake the whole welded island on touch; an 80 kg rifleman qualifies. Once awake, men shove stones (comparable masses), and a wedged man's depenetration spike shears the mortar joints; freed stones tumble. Possession makes it easy because the stick drives the anchor straight through building footprints.

**The law this task writes:** a sleeping chunk that still holds an unbroken weld ignores contact-wake from any body under 200 kg, under the depot combat flag only. Men lean, stone stands. Blasts and satchels wake unconditionally (explode's own path, untouched); breakers (340 kg) and tanks (3,400 kg) still wake and ram; severed rubble (no live weld) still kicks around underfoot. The frozen demo takes no depot flag, so its behavior is byte-identical — the golden gate proves it.

**Required reading (agent, before any code; anchors re-verified at dispatch):** this plan whole; `CLAUDE.md`; `src/engine/core.js` :1341-1426 (collectContacts — the wake lines are ~:1407-1408), :401-413 (weldNeighbors/wakeIsland), :1874-1922 (stepWorld's shape), the DIVERGENCE comment conventions throughout; `src/depot/DepotGame.jsx` — stepDepot's possessed-squad branch (the drive + rim clamp), `makeGrid`/`worldToGrid`, the build-bar JSX (`{hud.started && !hud.gameOver && !hud.victory && (` near the bottom); `src/depot/state.js` spawnWallCourses (welded walls exist — kind "wall", statics, out of this path's scope); `scripts/depot-test.mjs` — POSSESSION blocks, the fixture idioms (makeWorld/addBody/addWeld/stepWorld are importable).

**Step 8.1 — failing tests first.** `scripts/depot-test.mjs`, new block `==== POSSESSION T8: stone stands`:

(a) the law: a depot-flagged world (`world.depotCombat = true`), two 100 kg chunks welded and asleep, an 82 kg unit driven into them at march speed (set his velocity each step, `stepWorld` ~120 steps) → both stones STILL SLEEPING, positions unmoved to 1 mm, weld unbroken.
(b) heavy still rams: the identical fixture with a 340 kg body → the stones wake.
(c) rubble still kicks: a single UNWELDED sleeping chunk brushed by the same 82 kg unit → wakes (the exemption keys on the live weld, not on kind).
(d) the demo is untouched: the same two-stone fixture WITHOUT `world.depotCombat` → the man wakes the island exactly as before (the guard's own control).
(e) source pin: the possessed anchor's building clamp exists in `DepotGame.jsx` — the branch captures the pre-drive anchor and reverts when the clamped cell is `blocked || wallId`.
(f) source pin: the build bar renders only when `!hud.possessed` (regex on the bar's condition).

**Step 8.2 — the wake gate, in core.js** (a guarded divergence inside `collectContacts`, hoisted above the pair loop; comment in the file's own DIVERGENCE voice):

```js
  // DIVERGENCE (guarded, mk0.98): INFANTRY CAN'T KNOCK MASONRY OVER. Under
  // depotCombat a sleeping chunk that still holds a live weld ignores
  // contact-wake from bodies under 200kg — men lean on a building and it
  // stands. Blasts wake unconditionally (explode's path, untouched);
  // breakers/tanks (mass >= 200) still wake and ram; severed rubble (no
  // live weld) still kicks around underfoot. No flag, no change: the
  // frozen demo path is byte-identical (golden proves it).
  const weldedAsleep = (s) => {
    const wl = world.weldsOf && world.weldsOf.get(s.id);
    if (wl) for (const wd of wl) if (!wd.broken) return true;
    return false;
  };
  const wakeExempt = (s, mover) =>
    world.depotCombat && s.kind === "chunk" && mover.mass < 200 && weldedAsleep(s);
```

...and the two wake lines gain the exemption:

```js
        if (a.sleeping && V.len2(b.v) > 0.6 && !(a.kind === "wreck" && b.mass < 200) && !wakeExempt(a, b)) { if (a.kind === "chunk") wake(a); else wakeIsland(world, a); }
        if (b.sleeping && V.len2(a.v) > 0.6 && !(b.kind === "wreck" && a.mass < 200) && !wakeExempt(b, a)) { if (b.kind === "chunk") wake(b); else wakeIsland(world, b); }
```

(The solver already treats a sleeping body as an immovable anchor — `applyImpulse` skips sleeping sides and both-sleeping welds never enter the active list — so never waking IS the whole fix: the man gets pushed off, the stone takes nothing.)

**Step 8.3 — the stick stops at buildings.** `DepotGame.jsx`, the possessed-squad branch in `stepDepot`: capture the anchor before the drive, and after the rim clamp refuse any move that lands in a blocked cell:

```js
        const a0 = { x: sq.anchor.x, z: sq.anchor.z };
        const pi = S.possessInput || { vx: 0, vz: 0 };
        drivePossessedSquad(world, sq, pi.vx, pi.vz, world.dt, S.reticle);
        const cl = clampToRim(sq.anchor.x, sq.anchor.z);
        // MASONRY (T8, mk0.98): a building footprint (or a rock, or a wall
        // line) refuses the anchor the way the rim does — the formation can
        // never be driven into a lattice it would have to shove through.
        // The whole tick's move reverts (no slide); the stick just stops.
        const gA = grid.worldToGrid(cl.x, cl.z);
        const cellA = grid.inBounds(gA.gx, gA.gz) ? grid.cells[grid.idx(gA.gx, gA.gz)] : null;
        sq.anchor = cellA && (cellA.blocked || cellA.wallId) ? a0 : { x: cl.x, z: cl.z };
```

(Stated consequence, accepted: your own wall line also stops the stick — a possessed squad crosses at a gap, not through its own masonry. The `S.reticle` argument is Task 7's; if Task 7 has not landed when this dispatches, the drive call is still 5-arg — the agent adapts to the live call and reports which form it found.)

**Step 8.4 — the bar hides while possessed.** The build-bar JSX condition gains one clause:

```jsx
      {hud.started && !hud.gameOver && !hud.victory && !hud.possessed && (
```

The bar (and the SELL slot inside it) vanishes the moment a possession begins and returns on release — the joysticks own the bottom of the screen while you drive.

**Behavior stated plainly:** men can lean on, crowd against, and fight around every building on the map and not one stone moves — only ordnance, satchels, breakers and armour move masonry, on both sides. The stick stops dead at a building's edge instead of dragging the squad into it. While possessed, the build bar is gone and the sticks have the bottom of the screen to themselves.

**Gates (ONLY these):** parse changed files · `npm run lint:depot` · `npm run test:depot` (8.1 green; re-pins old→new) · `npm run golden` (core.js touched — the frozen-demo parity proof) · `npm run test:combat` (the depot-flag guard's second witness) · build AFTER bumping `src/version.js` to "mk0.98" · `SMOKE_ONLY=depot` smoke. Allowed files: `core.js`, `DepotGame.jsx`, `depot-test.mjs`, `version.js`. Commit "(mk0.98)", push, CI green, STOP.

---

## Task 9 — Killing rifles: lethality raise and hit feedback (mk0.99) — suggested model: Sonnet (all code below)

*Amendment, 2026-08-13, the owner's rulings after mk0.97 play ("bullets pass right through"): a clean rifle hit rises 4.1 → **15** on BOTH sides (four hits kill a conscript — rifles become a killing arm); the MG family rises flatter to **8** per round (MG team 3.6 → 8, MG tower 3.4 → 8 — a six-round burst ≈ one conscript); and every round that connects with a man visibly READS — he dips and flashes red for a fifth of a second, both sides. Sniper (130) and all blast weapons untouched; the blast splash component (dmg 5) is not the dial and does not move.*

**Laws binding this task:** zero rng anywhere in the new code; the engine and renderer changes are guarded divergences (depot flag only — golden and the combat parity suite must pass untouched, no re-pin there); the old dirDmg calibration comments in specs.js are superseded by this ruling — annotate, don't erase.

**Required reading (agent, before any code; anchors re-verified at dispatch):** this plan whole; `CLAUDE.md`; `src/depot/specs.js` — INFANTRY_ARMS :178-200, ENEMY_FIRE :91-99, TOWER_SPECS :34-40 (and their calibration comments); `src/engine/core.js` — applyDamage :801-809, stepProjectiles' dirDmg branch :739-766, the DIVERGENCE comment voice; `src/render/renderer.js` — the unit render loop :1524-1639 (palettes, setColorAt, the oy offset math, fogSil precedence), the hoisted-scratch conventions; `scripts/depot-test.mjs` — grep `4.1`, `3.6`, `4.5`, `3.4`, `dirDmg` (every pin that must re-pin), the POSSESSION T7 fixtures (angle pins — damage-blind, must stay green); `scripts/combat-test.mjs` header (why flag-off parity survives this).

**Step 9.1 — failing tests first.** `scripts/depot-test.mjs`, new block `==== LETHALITY T9`:

(a) spec pins, real imports: `INFANTRY_ARMS.rifles.dirDmg === 15`, `INFANTRY_ARMS.mg.dirDmg === 8`, `ENEMY_FIRE.rifle.dirDmg === 15`, `TOWER_SPECS.mg.dirDmg === 8`; sniper still 130; `INFANTRY_ARMS.rifles.dmg === 5` (the splash did not move).
(b) time-to-kill, seeded: the possessed-volley loop that killed a 58 hp conscript at 14 m in ~15 rounds under mk0.97 now kills him in **≤ 8 rounds** (same fixture shape as T7's, cooldowns cleared between pulls; assert rounds ≤ 8 and ≥ 3 — deterministic with the pinned seed).
(c) the stamp: `applyDamage(world, unit, 5, {cause})` with `world.depotCombat` sets `unit.dmgT === world.t`; without the flag `dmgT` stays undefined; on a wall body it stays undefined (units only).
(d) renderer source pins: the unit loop computes `hurtK` from `b.dmgT` gated on `world.depotCombat`; the dip term (`- 0.10 * hurtK`) sits in the oy math; the flash lerp (`lerp(HIT_C, 0.7 * hurtK)`) sits in the color branch with fogSil precedence intact (silhouettes never flash — regex the branch order).
(e) re-pin sweep: run the suite; every pre-existing pin carrying the old numbers re-pins old→new, each reported.

**Step 9.2 — the numbers, in specs.js.** Four values move; each keeps its old comment and gains one line: `// mk0.99 (owner's lethality ruling): 4.1 -> 15 — rifles kill now; the ±10% replaces-not-adds calibration above is superseded.` (Wording adapted per line.)

```js
  rifles: ... dirDmg: 15, ...      // was 4.1
  mg:     ... dirDmg: 8, ...       // was 3.6
  // ENEMY_FIRE:
  rifle:  ... dirDmg: 15, ...      // was 4.5 — symmetry holds, both sides rise
  // TOWER_SPECS:
  mg:     ... dirDmg: 8, ...       // was 3.4
```

**Step 9.3 — the stamp, in core.js** (one guarded line in `applyDamage`, after `b.lastHit = info;`):

```js
  // DIVERGENCE (guarded, mk0.99): HIT FEEDBACK STAMP — depot units remember
  // WHEN they were last hurt so the renderer can flinch/flash them. A plain
  // world-clock stamp; nothing in the sim reads it, no rng, no flag no change.
  if (world.depotCombat && b.kind === "unit" && dmg > 0) b.dmgT = world.t;
```

**Step 9.4 — the flinch and the flash, in renderer.js.** Hoisted once near the palettes: `const HIT_C = new THREE.Color(0xff5230); const _hitC = new THREE.Color();`. In the unit loop, after `const KIT = troopKit(...)`:

```js
      // DIVERGENCE (guarded, mk0.99): HIT FEEDBACK — a struck man dips and
      // flashes red for 0.18s. b.dmgT only ever exists under depotCombat
      // (core.js applyDamage); every other mode renders byte-identical.
      const hurtAge = world.depotCombat && b.alive && b.dmgT != null ? world.t - b.dmgT : 1;
      const hurtK = hurtAge < 0.18 ? 1 - hurtAge / 0.18 : 0;
```

The dip: the oy line gains one term — `const oy = o[1] * (...) * crouch - (crouch < 1 ? 0.06 : 0) - 0.10 * hurtK;`. The flash: in the per-part color write, fogSil keeps absolute precedence, then:

```js
          else if (hurtK > 0) { _hitC.copy(pal[p.role]).lerp(HIT_C, 0.7 * hurtK); pools[pi].setColorAt(idx, _hitC); }
          else pools[pi].setColorAt(idx, pal[p.role]);
```

(The spotter's binoculars branch keeps its own gun-color write — a hit spotter still dips; stated, accepted.)

**Behavior stated plainly:** four clean rifle hits drop a conscript; a burst of six MG rounds does the same; the enemy's rifles hit your men just as hard — fights are short and cover is life, on both sides. Every round that lands SHOWS: the man jerks down a hand-span and glows red for a blink. What passes through hit nothing.

**Gates (ONLY these):** parse changed files · `npm run lint:depot` · `npm run test:depot` (9.1 green; every re-pin old→new, its own bullet) · `npm run golden` (core + renderer touched) · `npm run test:combat` (flag-off parity witness) · build AFTER bumping `src/version.js` to "mk0.99" · `SMOKE_ONLY=depot` smoke. Allowed files: `specs.js`, `core.js`, `renderer.js`, `depot-test.mjs`, `version.js`. Feel acceptance (kill pace, flash look) is the owner's playtest alone. Commit "(mk0.99)", push, CI green, STOP.

---

## Close

Phase code-complete = the owner's playtest gates everything: possession feel, stick feel, reticle feel, volley feel, tower gunnery — none of it is verifiable by machine and none is accepted until he plays it. Roadmap flips Command → DONE, Possession → IN PROGRESS at T1 (fold into its commit: `src/ui/Roadmap.jsx` Command "One ring of orders around every squad and tower — shipped." / Possession "Take direct control of any squad or tower and drive it yourself."). Deferred to later phases by ratified scope: vehicle possession (Heroes), possession of walls (never ruled in), doctrine buttons while possessed, any enemy mirror (ruled out).
