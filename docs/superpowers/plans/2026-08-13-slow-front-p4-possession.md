# SLOW FRONT — Phase 4: Possession (mk0.90-0.92)

*Written overnight 2026-08-13 under the owner's standing authorization ("write the plan for phase 4 and continue"). Every design point below is a ratified decision-record ruling or the sandbox's established twin-stick convention — the assessment is that no owner-only fork is open; anything that proves otherwise mid-task STOPS the night per protocol. The owner reviews this plan and every landing in the morning; all feel acceptance is his playtest. Three tasks, sequential Sonnet dispatches, Fable drift audit after each.*

**The ruling this phase implements (decision record, "Possession"):** any friendly squad or tower is takeover-able — TAKE CONTROL on every pie. Twin-stick: the stick drives a squad as one body (stick = formation anchor; fire = squad volley at the aim), towers become manual fire control. The front fights on under standing orders; a bell save mid-possession releases to command view. The enemy needs no mirror. Vehicles wait for the Heroes phase (none exist player-side yet).

**Established conventions reused, not invented:** the sandbox's virtual joystick (radius 56, bottom-left, camera-relative drive, deadzone 0.15), its tap-aims / FIRE-button-shoots split, its touch snap-assist, WASD as the keyboard stick. The sight law binds possessed fire exactly as it binds every shot: you shoot only what your side sees.

**Laws binding every task:** zero new dice (possessed shots draw scatter like any shot — player input is not a replayed stream; the SEEDED streams and their counts are untouched); engine/demo/renderer files untouched (the joystick is game-layer interface; camera follow rides `S.focus`, which the game layer already owns); possession is transient — never serialized, released before every save; run ONLY the gates listed; every deviation its own bullet; a Fable audit gates each advance.

---

## Task 1 — Take control: the possessed squad walks (mk0.90) — suggested model: Sonnet (all code below)

Tap TAKE CONTROL on a squad's pie: the camera locks to it, a joystick appears, and the stick drives the whole squad as one body — members holding their ring. RELEASE (a button, or the bell) hands them back to standing orders, dug in where you left them. No fire button yet (Task 2); a possessed squad holds fire — your hands, your trigger, and you don't have one yet.

**Required reading (agent, before any code; anchors re-verified at dispatch):** this plan whole; `CLAUDE.md`; `docs/superpowers/decision-record.md` "Possession"; `src/depot/squads.js` — module-law header, `MOVE_SPEED`/`seekGoal`/`slotFor`/`clearSlot` (:312-392), `stepSquad` whole; `src/depot/DepotGame.jsx` — the pie slot lists and instant/aiming action closures, `stepDepot`'s squad loop (engageCheck/stepSquad/squadFire), the frame loop (camera focus, keys, projection block), `ringBell`, `tapAt`/pointer handlers (the joystick must claim its pointer first), `clampToRim`; `src/game/ContractSandbox.jsx` :360-540 (the joystick DOM pattern, camera-relative drive — the convention being ported); `scripts/depot-test.mjs` — COMMAND block idioms; grep `possess` everywhere (must be virgin).

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

## Close

Phase code-complete = the owner's morning playtest gates everything: possession feel, stick feel, volley feel, tower gunnery — none of it is verifiable by machine and none was accepted overnight. Roadmap flips Command → DONE, Possession → IN PROGRESS at T1 (fold into its commit: `src/ui/Roadmap.jsx` Command "One ring of orders around every squad and tower — shipped." / Possession "Take direct control of any squad or tower and drive it yourself."). Deferred to later phases by ratified scope: vehicle possession (Heroes), possession of walls (never ruled in), doctrine buttons while possessed, any enemy mirror (ruled out).
