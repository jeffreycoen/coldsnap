// COLDSNAP DEPOT — run state shape. Kept tiny and dependency-free so
// DepotGame.jsx's loop can stuff a plain object in a ref (React state must
// never be read from the closure — see ColdsnapTD.jsx for why).
import { aimSolve, fireProjectile, addBody } from "../engine/core.js";
import { SQUAD_SPECS, clearSlot } from "./squads.js";
import { scatterSigma, applyScatter, arcClears, marchArc } from "./accuracy.js";
import { planWave, MIN_WAVE_FLOOR, spawnDelayFor } from "./ai.js";
import { STIPEND, payResults, combatIneffective, bookValue } from "./economy.js";
import { composeIntel, openingIntel } from "./intel.js";
import { TOWER_SPECS, ENEMY_SPECS, TANK, INFANTRY_ARMS } from "./specs.js";
import { fogStateForContested } from "./territory.js";

// Targeting gate, symmetric: a shooter of `team` (1 = player tower, 2 =
// attacker rifleman/grenadier/tank) may only acquire a target at canonical
// (u, v) position (x, z) if THEIR OWN field reaches it — fogStateFor mirrors
// the read per team, so a tower checks the player field and an attacker
// checks the sign-flipped one. "unheld" blocks acquisition; "seam" and
// "held" both allow it. No T wired (some tests construct a world without
// territory) -> ungated, so existing asserts that don't care about ground
// control keep passing. Takes explicit (x, z) rather than a body/target
// object because territory.js's coordinate system is CANONICAL (u, v) —
// the map's un-rotated frame, same as the renderer's rim — while body
// positions live in rotated WORLD space; callers convert via invW (DEPOT's
// world-to-canonical transform) before calling this.
// F1.6 BRIDGE (mk0.26): the read is fogStateForContested, not fogStateFor —
// contested ground (within one cell of the boundary) is engageable by both
// sides, so men at contact are not mutually weapon-proof. Reverts to plain
// fogStateFor when vision B3 lands (see territory.js's deletion marker).
export function fieldReaches(T, x, z, team) {
  if (!T) return true;
  return fogStateForContested(T, x, z, team) !== "unheld";
}

// Elevation-scaled acquisition range — the single symmetric rule both towers
// (DepotGame.jsx's stepTowers) and enemy shooters (units.js) consume: high
// ground sees farther. `muzzle` is the shooter's actual firing point (tower:
// pos + hy + 0.45, matching towerShot's own muzzle formula; units: their own
// per-type muzzle offset) — NOT the body's pos.y, which is ground+hy only.
// meanSurroundY samples world.field.heightAt at SURROUND_N points around a
// SURROUND_R-meter ring centered on the muzzle's (x, z); elev is how far the
// muzzle sits above that local average (clamped at 0 — no penalty downhill,
// symmetric with scatterSigma's own elevation treatment). Capped at 1.2x
// (10m+ of relative height buys nothing further).
const SURROUND_R = 6, SURROUND_N = 8;
export function effRange(world, muzzle, spec) {
  let sum = 0;
  for (let i = 0; i < SURROUND_N; i++) {
    const a = (i / SURROUND_N) * Math.PI * 2;
    sum += world.field.heightAt(muzzle.x + Math.cos(a) * SURROUND_R, muzzle.z + Math.sin(a) * SURROUND_R);
  }
  const meanSurroundY = sum / SURROUND_N;
  const elev = Math.max(0, muzzle.y - meanSurroundY);
  return spec.range * Math.min(1.2, 1 + 0.02 * elev);
}

// ---------------------------------------------------------- pending placement
// Task 3's confirm-before-build flow, factored into pure/headless-testable
// pieces so depot-test.mjs can drive the state machine without React/DOM —
// same split as the bell cycle below. DepotGame.jsx's canBuildAt/
// startPending/confirmPending are thin wrappers around these.
//
// validatePlacement: same four checks buildAt makes (occupied, ice, held,
// afford), reduced to booleans/numbers so callers don't need to hand this a
// live grid cell or territory object — just answers already read from one.
export function validatePlacement({ blocked, ice, held, resources, cost }) {
  if (blocked) return { ok: false, msg: "OCCUPIED" };
  if (ice) return { ok: false, msg: "NO GROUND — frozen water" };
  if (!held) return { ok: false, msg: "GROUND NOT HELD" };
  if (resources < cost) return { ok: false, msg: "NO SCRAP" };
  return { ok: true };
}

// Trailing-tap guard (brief): the confirm button appears at the same screen
// spot the opening tap landed on, so it must not register a click for this
// long after appearing, or the tap that opened it double-fires as the
// confirm. Purely a time constant — not RNG, so no depot-lint concern.
export const PENDING_ARM_S = 0.35;
export function pendingArmed(pending, nowT) {
  return !!pending && nowT >= pending.armedAt;
}

// --- confirm-tap thefts (mk0.27) --------------------------------------------
// Two taps used to vanish without a trace:
//  1. ✓ tapped before it arms — confirmPending no-opped silently, so the tap
//     read as broken. It stays inert (the arm guard is the point), but it now
//     SAYS so, and it leaves the pending exactly as it was: the next tap
//     opens/cancels normally.
//  2. panning until the ✓/✗ pair leaves the viewport — the pending was still
//     set, so the next ground tap was silently eaten by the "any canvas tap
//     resolves a pending" rule with no visible thing to resolve. Now the
//     pending auto-cancels (with a toast) the moment its anchor leaves the
//     screen, and a canvas tap only counts as "resolve the pending" while the
//     buttons are actually on-screen.
export const PENDING_EDGE_PAD = 8;   // px — a button half off the edge is not tappable
export function pendingButtonsVisible(screen, rect, pad = PENDING_EDGE_PAD) {
  if (!screen || !rect) return false;
  return screen.x >= rect.left + pad && screen.x <= rect.left + rect.width - pad
      && screen.y >= rect.top + pad && screen.y <= rect.top + rect.height - pad;
}
// Does a canvas tap resolve (cancel) the open pending? Only when the pending
// exists AND its buttons are on-screen — otherwise the tap belongs to whatever
// the player actually tapped.
export function canvasTapConsumesPending(pending, screen, rect) {
  return !!pending && pendingButtonsVisible(screen, rect);
}

// Wall build cost — mirrors DepotGame.jsx's buildAt (`const cost = spec ? spec.cost : 5`).
// specs.js has no wall entry (walls aren't a TOWER_SPECS type), so this is
// the single source of truth the book-value verdict below reads.
const WALL_COST = 5;


// One trigger pull, general shooter core: 2-pass lead solve against
// `target`'s velocity, then fire spec.volley (or 1) shots. sigma is
// computed once per pull from the led aim point (spec.acc, range/
// elevation/graze) and applied per shot via applyScatter — conditional
// accuracy, not a flat volley spread. Shared by towers (towerShot below)
// and enemy shooters (src/depot/units.js) so every aimed shot in DEPOT —
// player or enemy — runs through the identical accuracy model.
// opts: { high (mortar-style lob arc), attacker ("player"|"enemy"),
//         hitStruct, hitOnly, muzzleStep (per-shot muzzle y offset),
//         volleyDelay (seconds between shots of a multi-round pull; default
//         0.12, see below), owner (core.js's fireProjectile owner-immunity
//         id — REQUIRED for any dynamic-body shooter; towers/enemy units
//         never needed it because they're either static structures
//         core.js's hit scan skips by default, or fire hitOnly:"structure"
//         so units never enter their own hit scan. squadFire's infantry
//         shooters are ordinary dynamic "unit" bodies with no such
//         exemption — without owner, a round's very first flight-path
//         sample sits inside the shooter's own muzzle-adjacent hitbox and
//         detonates at the muzzle, 0 range, every time; found live while
//         building squadFire below) }
export function shooterFire(world, shooter, muzzle, target, spec, opts = {}) {
  const high = !!opts.high;
  const attacker = opts.attacker || "player";
  let ax2 = target.pos.x, az2 = target.pos.z, ay2 = target.pos.y;
  for (let li = 0; li < 2; li++) {
    const ld = Math.max(2, Math.hypot(ax2 - muzzle.x, az2 - muzzle.z));
    const lp = aimSolve(spec.projSpeed, ld, ay2 - muzzle.y, 9.8, high);
    if (lp == null) break;
    const tof = ld / Math.max(1e-3, spec.projSpeed * Math.cos(lp));
    ax2 = target.pos.x + target.v.x * tof;
    az2 = target.pos.z + target.v.z * tof;
    ay2 = world.field.heightAt(ax2, az2) + target.hy;
    // DIVERGENCE (guarded): partial wind hold-off — shooters correct for
    // wind drift by only windComp of the true offset (imperfect by design;
    // doctrine raises it later). No-op without world.wind or spec.windF/
    // windComp. Enemy specs carry the same windF/windComp as their tower
    // analog (Jeff's decision: aim fully equal), so this applies identically.
    if (world.wind && spec.windF && spec.windComp) {
      ax2 -= world.wind.x * spec.windF * tof * spec.windComp;
      az2 -= world.wind.z * spec.windF * tof * spec.windComp;
    }
  }
  const dx = ax2 - muzzle.x, dz = az2 - muzzle.z, dy = ay2 - muzzle.y;
  const sigma = scatterSigma(world, muzzle, { x: ax2, y: ay2, z: az2 }, spec);
  const d = Math.max(2, Math.hypot(dx, dz));
  let pitch = aimSolve(spec.projSpeed, d, dy, 9.8, high);
  if (pitch == null) pitch = high ? 1.1 : 0.45;
  const rawDir = { x: (dx / d) * Math.cos(pitch), y: Math.sin(pitch), z: (dz / d) * Math.cos(pitch) };
  const shots = spec.volley || 1;
  const muzzleStep = opts.muzzleStep != null ? opts.muzzleStep : 0.28;
  // volleyDelay: seconds between successive rounds of a multi-shot trigger
  // pull (fireProjectile's own `delay` param — the round sits inert until
  // world.t catches up, see core.js ~:649). Rocket towers (spec.volley=4)
  // rely on the 0.12 default; squadFire's MG bursts pass INFANTRY_ARMS.mg's
  // burstGap (0.17) here so a "burst" reads as its own spaced mechanism
  // rather than reusing the tower volley's fixed cadence.
  const volleyDelay = opts.volleyDelay != null ? opts.volleyDelay : 0.12;
  for (let si = 0; si < shots; si++) {
    const dir = applyScatter(world, rawDir, sigma);
    fireProjectile(world, { x: muzzle.x, y: muzzle.y + si * muzzleStep, z: muzzle.z }, dir, spec.projSpeed,
      {
        kind: spec.kind, r: spec.blastR, kv: spec.kv, dmg: spec.dmg, dirDmg: spec.dirDmg, crater: spec.crater,
        noImpact: true, attacker, delay: si * volleyDelay, windF: spec.windF,
        // No round passes through a structure (sightlines 6.5 Task 4):
        // every shooterFire round carries hitStruct unless the caller set
        // hitOnly (structure-only shots keep their exact behavior). A
        // unit-target round may now physically eat a wall/rock/tower edge
        // en route — the blast lands where the round stops.
        hitStruct: opts.hitOnly ? opts.hitStruct : true, hitOnly: opts.hitOnly, owner: opts.owner,
      });
  }
}

// One tower trigger pull — thin wrapper over shooterFire. Kept as its own
// export (depot-test.mjs and DepotGame.jsx's stepTowers call it by name).
export function towerShot(world, tower, target, spec) {
  const muzzle = { x: tower.pos.x, y: tower.pos.y + tower.hy + 0.45, z: tower.pos.z };
  const high = tower.towerType === "mortar" || tower.towerType === "rocket";
  // owner: now that every shooterFire round carries hitStruct (Task 4), a
  // tower's own hull is a shootable structure to its own muzzle-adjacent
  // round — thread the uniform muzzle-clearing immunity (self-hit law).
  shooterFire(world, tower, muzzle, target, spec, { high, attacker: "player", owner: tower.id });
}

// squadFire(world, squad, dt, T, toUV): infantry trigger pull, one call per
// squad per tick. Movement lives entirely in squads.js (stepSquad) — this
// stays out of that module so squads.js remains movement-pure with no
// state.js import (this phase's explicit split). squads.js's own module
// note documents the ONE rng draw it makes (attack leg-pause dwell); this
// function makes NONE — the only rng in a fired round is applyScatter's 2
// draws, same as every tower shot.
//
// Fire discipline: members fire ONLY while stationary — order "defend", or
// "attack" mid-leg-pause (squad._pauseT > 0). stepSquad already holds every
// member still in both cases (defend: slot-seek settles; attack pause: no
// new goal is issued), so this is a squad-level gate, not per-member.
//
// Per member: a body-local cooldown (u.fireCd, mirrors tower b.fireCd)
// gates the trigger pull; target acquisition is the EXACT tower stack
// (stepTowers, DepotGame.jsx) — nearest live enemy unit/vehicle within
// effRange(world, muzzle, spec) (elevation-scaled), passing fieldReaches
// (own team's field, so player squads gate on team 1 same as towers) AND
// arcClears with selfId=u.id excluded (Task 6's own-body fix, same reason
// towers need it: the sampler's first point sits inside the shooter's own
// hitbox on a flat shot).
//
// T/toUV: threaded exactly like stepUnits(world, grid, fwdDir, T, toUV) —
// optional, defaulting to an identity toUV and an ungated fieldReaches (no
// T -> "unheld" never triggers), same contract fieldReaches already
// documents, so callers/tests that don't care about ground control don't
// need to construct a territory grid.
//
// MG burst: INFANTRY_ARMS.mg carries burst/burstGap instead of a tower's
// `volley` — kept as its own name so "a burst" reads as this specific
// infantry mechanic, not an alias for the rocket tower's 4-round salvo.
// Mechanically it's the identical primitive: shooterFire's volley loop,
// fired here with spec.volley set to spec.burst and opts.volleyDelay set to
// spec.burstGap (0.17s) instead of the tower default (0.12s) — see
// shooterFire's volleyDelay note above. Sniper/rifles have no `burst`, so
// they fall through as ordinary single-shot pulls (volley defaults to 1).
//
// INTERFACE GAP (documented, not silently patched): the brief's verbatim
// INFANTRY_ARMS table carries no blastR/kv, unlike every other spec table
// in this file's blast path (TOWER_SPECS, ENEMY_FIRE — every entry there
// sets both). fireProjectile's hit always resolves through core.js's
// explode(), which divides by spec.r (`reach = spec.r + ...`, `f = 1 -
// dist/reach`) and multiplies by spec.kv for its impulse — with both
// undefined that's NaN op NaN, and a "hit" deals NaN damage (silently
// leaves hp NaN, body never dies since NaN comparisons are always false).
// Verified by running an infantry shot through the real engine before this
// fallback existed. specs.js is kept verbatim per the brief; this merge is
// the fix, scoped to squadFire only, mirroring TOWER_SPECS.mg's own values
// (0.3/0.5) since every INFANTRY_ARMS entry is itself kind:"mg".
//
// SPEC CONTRADICTION (documented, not silently fixed — see
// scripts/depot-test.mjs's "sniper vs tank" block for the full trace): the
// brief's "chip-only" intent for a sniper vs. a tank assumed core.js's
// b.armor glancing threshold would apply. It never can — spawnTank
// (units.js) never sets t.armor, AND the armor check is hard-excluded for
// CAUSE.BLAST, which is the ONLY cause any shooterFire round (noImpact)
// ever produces. Measured behavior is still chip (~3.5hp/hit) but via an
// unrelated mechanism: explode()'s distance falloff against a tank's own
// large hitbox. Asserting current (accidental) behavior, not adding an
// armor value the brief didn't authorize.
// FRONT F1 (Task 4a): hostileStructure(b, team): what team's shooters may
// treat as an enemy STRUCTURE target. Team 2 (attacker): player towers/walls
// (as today) + the player depot's masonry. Team 1 (player): enemy towers/
// walls (none until F3 — the set is ready for them) + the enemy depot's
// masonry. Structure fire never fog-gates (the law) — range + arcClears only.
export function hostileStructure(b, team) {
  if (!b.alive) return false;
  if (team === 1) {
    if ((b.kind === "tower" || b.kind === "wall") && b.team === 2) return true; // F3-ready
    return b.kind === "chunk" && b.town === "depot2";
  }
  if ((b.kind === "tower" || b.kind === "wall") && b.team === 1) return true;
  return b.kind === "chunk" && b.town === "depot";
}

const INFANTRY_BLAST_R = 0.3, INFANTRY_KV = 0.5;
export function squadFire(world, squad, dt, T, toUV = (x, z) => ({ u: x, v: z })) {
  if (squad.type === "sappers") return; // F1 Task 4.5: tools, not shooters — sappers never rifle-fire (draws nothing)
  if (squad.order === "move") return;   // mk0.28: MOVE travels, it does not fight (draws nothing)
  const spec = INFANTRY_ARMS[squad.type];
  if (!spec) return;
  // mk0.28: "move" is never a firing order — the men double-time with
  // weapons quiet, pause or no pause, until arrival flips them to defend.
  const stationary = squad.order === "defend" || (squad.order === "attack" && squad._pauseT > 0);
  if (!stationary) return;
  const enemyTeam = squad.team === 1 ? 2 : 1;
  const attacker = squad.team === 1 ? "player" : "enemy";
  const fspec = {
    ...spec,
    volley: spec.burst || 1,
    blastR: spec.blastR != null ? spec.blastR : INFANTRY_BLAST_R,
    kv: spec.kv != null ? spec.kv : INFANTRY_KV,
  };
  for (const id of squad.memberIds) {
    const u = world.byId.get(id);
    if (!u || !u.alive) continue;
    if (u.role === "spotter") continue; // binoculars, not a rifle — he NEVER fires (draws nothing)
    u.fireCd = (u.fireCd || 0) - dt;
    if (u.fireCd > 0) continue;
    const muzzle = { x: u.pos.x, y: u.pos.y + 0.5, z: u.pos.z };
    const eR = effRange(world, muzzle, spec);
    let best = null, bd = eR * eR, bestIsStruct = false;
    for (const e of world.bodies) {
      if ((e.kind !== "unit" && e.kind !== "vehicle") || !e.alive || e.team !== enemyTeam) continue;
      const dx = e.pos.x - u.pos.x, dz = e.pos.z - u.pos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 >= bd) continue;
      const c = toUV(e.pos.x, e.pos.z);
      if (!fieldReaches(T, c.u, c.v, squad.team)) continue;
      if (!arcClears(world, muzzle, e.pos, spec, u.id)) continue;
      bd = d2; best = e;
    }
    if (!best) {
      // FRONT F1 (4b): no man in reach — bite stone. Nearest hostile
      // structure in range, LOS by the real arc (selfId), NEVER fog-gated
      // (structure law). Unit targets keep absolute priority: this scan
      // runs only on an empty unit scan. Deterministic pick — nearest, ties
      // by body id order (the scan order gives this). Zero rng draws.
      let bs = eR * eR;
      for (const s of world.bodies) {
        if (!hostileStructure(s, squad.team)) continue;
        const dx = s.pos.x - u.pos.x, dz = s.pos.z - u.pos.z, d2 = dx * dx + dz * dz;
        if (d2 >= bs) continue;
        if (!arcClears(world, muzzle, s.pos, spec, u.id)) continue;
        bs = d2; best = s; bestIsStruct = true;
      }
    }
    if (!best) continue;
    u.fireCd = spec.fireRate;
    // F1.5 Task 1: lofted specs (mortars) lob — shooterFire's high aimSolve
    // branch, the exact flag the mortar TOWER's towerShot passes. Everyone
    // else (occl "arc") is byte-unchanged. Structure shots keep hitOnly
    // "structure" + hitStruct: the shell still detonates ON the wall (core.js
    // ~:690 — isStruct passes on hitOnly === "structure"), so blast lands.
    // Fire discipline note (shipped as-is, flagged for playtest): squadFire
    // has no friendlyFouls check (that's a tower doctrine) — your own
    // mortars CAN hit your own men.
    const high = spec.occl === "lofted";
    shooterFire(world, u, muzzle, best, fspec, bestIsStruct
      ? { attacker, volleyDelay: spec.burstGap, muzzleStep: 0, owner: u.id, hitStruct: true, hitOnly: "structure", high }
      : { attacker, volleyDelay: spec.burstGap, muzzleStep: 0, owner: u.id, high });
  }
}

// ------------------------------------------------------------ squad wiring
// spawnSquadMembers(world, squad): a squad's members spawn as ORDINARY
// team-1 "unit" bodies (brief's sketch, adapted to addBody's real shape) so
// every existing unit-body system — territory emitters, fog, combat,
// physics — sees them for free. dress "human" (the player side reads human;
// androids are the enemy's dress). squadId back-references the roster so
// pruneSquads and the selection UI can walk body -> squad.
export function spawnSquadMembers(world, squad) {
  const spec = SQUAD_SPECS[squad.type];
  for (let i = 0; i < spec.n; i++) {
    const a = (i / spec.n) * Math.PI * 2, r = 1.2;
    // clearSlot (squads.js smallfix): a ring point overlapping a static solid
    // gets the man depenetration-ejected and slam-killed on his first tick —
    // spawn only on vetted ground (member hx 0.28 + the module's 0.35 pad).
    const p = clearSlot(world, squad.anchor.x + Math.cos(a) * r, squad.anchor.z + Math.sin(a) * r, 0.28 + 0.35);
    const u = addBody(world, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28,
      x: p.x, y: world.field.heightAt(p.x, p.z) + 0.74, z: p.z, hp: 58, friction: 0.5 });
    u.utype = squad.type; u.squadId = squad.id; u.dress = "human"; // player side reads human
    // SMEARS ON (C0 T4, mk0.33): every man who falls leaves a permanent red
    // mark in the snow. smearStyle is render-only — the renderer's kill
    // handler reads it off the corpse; nothing in the sim branches on it.
    u.smearStyle = "human";
    // The pair (6.5 Task 6): a sniper squad is sniper + spotter. Member 0
    // carries the rifle; member 1 carries binoculars and NEVER fires until
    // converted (squadFire's role skip below).
    if (squad.type === "sniper") u.role = i === 0 ? "sniper" : "spotter";
    // mk0.23 troop identity: the MG team reads as gun + loader — member 0
    // carries the weapon, member 1 carries nothing. RENDER-ONLY roles: no
    // sim path branches on "gunner"/"loader" (only "sniper"/"spotter" are
    // read by squadFire, accuracy and units.js), and the one side effect —
    // squads.js setting u.settled for any roled man — is itself sim-inert.
    if (squad.type === "mg") u.role = i === 0 ? "gunner" : "loader";
    squad.memberIds.push(u.id);
  }
}

// Sandbag: instant (wall-exempt) 3-scrap cover — a single STATIC sleeping
// chunk body tagged b.sandbag. Static (mass 0 -> invM 0) on purpose:
// squads.js's exposureAt filters out dynamic bodies (invM > 0), so a massy
// sandbag would never read as cover; core.js's projectile hit scan exempts
// chunk-kind from its invM-0 skip (~:691), so rounds still hit it and its
// 60hp still matters. DepotGame's territory emitter builder adds it under
// EMIT.wall (green influence, wall-weight).
export const SANDBAG_COST = 3;
// orient (0|1) swaps hx/hz — axis-aligned bodies only, no rotation matrices.
// Orientation is player input, like placement coords: placement-state only,
// sim/determinism untouched (multiplayer-safe by the same argument).
export function spawnSandbag(world, x, z, orient = 0) {
  const y = world.field.heightAt(x, z);
  const b = addBody(world, {
    kind: "chunk", team: 1, mass: 0,
    hx: orient === 1 ? 0.35 : 0.9, hy: 0.45, hz: orient === 1 ? 0.9 : 0.35,
    x, y: y + 0.45, z, hp: 60, friction: 0.7, restitution: 0.02,
  });
  b.sandbag = true;
  b.sleeping = true;
  b.maxHp = b.hp;
  return b;
}

// sandbagOrientAt: AUTO-CONTINUE. If (x,z) lands within 2.2m of an existing
// live sandbag, orient along the line to the NEAREST such bag (|dx| >= |dz|
// -> long axis x, orient 0; else orient 1) — overrides the toggle for that
// placement. Isolated placements (line starts) fall back to toggleOrient.
export function sandbagOrientAt(world, x, z, toggleOrient) {
  let best = null, bestD2 = 2.2 * 2.2;
  for (const b of world.bodies) {
    if (!b.sandbag || !b.alive) continue;
    const dx = b.pos.x - x, dz = b.pos.z - z, d2 = dx * dx + dz * dz;
    if (d2 <= bestD2) { bestD2 = d2; best = b; }
  }
  if (!best) return toggleOrient;
  return Math.abs(best.pos.x - x) >= Math.abs(best.pos.z - z) ? 0 : 1;
}

// pruneSquads(world, squads): roster hygiene, run once per tick BEFORE
// stepSquad/squadFire (the loop-order contract: prune dead members ->
// delete empty squads -> step -> fire). A member whose body is dead OR
// already swept out of world.byId (DepotGame's 2.5s corpse cleanup is
// team-agnostic by design) leaves the roster; a squad with no members left
// is deleted. Returns the filtered array; the surviving squad objects are
// the same references (selection ids stay valid).
export function pruneSquads(world, squads) {
  for (const sq of squads) {
    sq.memberIds = sq.memberIds.filter((id) => {
      const u = world.byId.get(id);
      return !!u && u.alive;
    });
    // The pair's degradation (6.5 Task 6): sniper dies -> the spotter
    // converts to a lone rifleman — utype/spec swap to rifles, squad
    // relabels (SQUAD_SPECS lookup follows type), existing one-man-squad
    // machinery carries it. He KEEPS his current hp (same man, different
    // tool — no heal, no reset). Spotter dies -> nothing here: direction
    // simply never re-runs (directPair requires both roles alive).
    if (sq.type === "sniper") {
      const members = sq.memberIds.map((id) => world.byId.get(id));
      const hasSniper = members.some((u) => u && u.role === "sniper");
      const spotter = members.find((u) => u && u.role === "spotter");
      if (!hasSniper && spotter) {
        sq.type = "rifles";
        sq._spotGoal = null; sq._snipeGoal = null; sq._threatSig = undefined;
        spotter.role = undefined; spotter.utype = "rifles"; spotter.settled = false;
      }
    }
  }
  return squads.filter((sq) => sq.memberIds.length > 0);
}

// ------------------------------------------------------- fire discipline
// friendlyFouls: does THIS round's actual flight path pass through one of
// our own team-1 walls/towers, or a town/depot chunk (team 0)? Same arc
// sampler arcClears (accuracy.js) uses — "arc" specs march the true
// ballistic arc, "lofted" specs only check the muzzle climb-out cone
// (first 15% of flight; a mortar's near-vertical climb still risks its own
// crew's wall overhang, but the rest of its lob is deliberately unchecked,
// mirroring arcClears) — kept as a sibling here rather than imported so the
// friendly-kind filter (team-1 wall/tower + team-0 chunk, +0.4m margin) can
// live next to it without threading a filter callback through arcClears's
// hot path. No rng; pure.
const FRIENDLY_MARGIN = 0.4;
// selfId (Task 6 fix): the shooter's OWN body was never excluded — the
// sampler's first point (s=0.9m from the muzzle) routinely lands inside
// the shooter's own hx/hy/hz+margin box on anything but a dead-flat, long
// shot, so every tower was self-blocking a huge fraction of its own shots
// under CAREFUL (probe's PROBE_DIAG counters caught this: held >>> fired,
// traced to `BLOCK by tower:mg id=N ... blocking point` matching that same
// tower's own position). Passing the shooter's id through lets the check
// skip its own body while still catching every OTHER friendly it might hit.
function friendlyBlocksPoint(world, x, y, z, selfId) {
  for (const b of world.bodies) {
    // Kind-not-mobility filter (6.5 Task 1, mirrors solidBlocksPoint):
    // town/depot chunks are dynamic (mass 88-320), so the old `invM > 0`
    // skip made the team-0-chunk clause below dead code — CAREFUL never
    // actually held the shot the depot would have caught.
    if (!b.alive || (selfId != null && b.id === selfId)) continue;
    const friendly = ((b.kind === "wall" || b.kind === "tower") && b.team === 1) ||
                      // enemy depot masonry (town "depot2") is a VICTORY TARGET,
                      // not a friendly — CAREFUL must never hold fire for it
                      (b.kind === "chunk" && b.team === 0 && b.town !== "depot2");
    if (!friendly) continue;
    if (b.invM > 0 && b.kind !== "chunk") continue; // dynamic non-masonry never fouls
    if (Math.abs(x - b.pos.x) <= b.hx + FRIENDLY_MARGIN &&
        Math.abs(y - b.pos.y) <= b.hy + FRIENDLY_MARGIN &&
        Math.abs(z - b.pos.z) <= b.hz + FRIENDLY_MARGIN) return true;
  }
  return false;
}

// 6.5 Task 2: the private 0.9m-step analytic parabola is gone — friendlyFouls
// marches the SAME flight model arcClears predicts with (accuracy.js's
// marchArc: engine-cadence samples, integrator-exact Euler heights; lofted
// specs keep the climb-out-cone contract). One flight model, two questions —
// this one asks friendlyBlocksPoint. marchArc's null (no ballistic solution:
// there is no flight, so nothing to foul) reads as no-foul, exactly as the
// old `pitch == null -> false` did.
export function friendlyFouls(world, muzzle, target, spec, selfId) {
  return marchArc(world, muzzle, target, spec,
    (x, y, z) => friendlyBlocksPoint(world, x, y, z, selfId)) === true;
}

// ------------------------------------------------------- structural loss
// The depot is a physical lattice of chunks (buildTown, DepotGame.jsx) — its
// own health bar IS the building. "Standing" means alive AND still within
// DEPOT_STANDING_TOL of the chunk's home position: a stone a mortar has
// launched off its perch reads as gone even if the body is technically still
// alive and asleep somewhere downrange (matches the campaign's demolition
// semantics — displacement counts as destruction, not survival).
export const DEPOT_STANDING_TOL = 1.2; // meters
export const DEPOT_BREACH_FRAC = 0.58; // standing fraction below this -> LOSS
export const DEPOT_CENSUS_HZ = 1; // census cadence — NOT per frame

// censusDepotChunks: called once at buildTown time. bodies is world.bodies
// (or any array of chunk-like {id, kind, town, pos}) — picks out one town's
// own chunks (b.town === townId) and records id + home (x, y, z) at build
// time, before anything's had a chance to move. Pure, no world/rng deps.
// FRONT F1: townId parameter — "depot" (default, today's callers) or
// "depot2" (the enemy depot's lattice).
// SIEGE FIX (mk0.21): the census ALSO stamps each stone's home onto the body
// itself (b.home, the very object the census row holds). Sappers need the
// standing/rubble verdict at plant time and have no census in hand — this
// makes the census's own rule readable from any body, with no threading and
// no second source of truth. The one mutation is documented here and in
// standingStructure below; everything else about this function stays pure.
export function censusDepotChunks(bodies, townId = "depot") {
  const out = [];
  for (const b of bodies) {
    if (b.kind !== "chunk" || b.town !== townId) continue;
    const home = { x: b.pos.x, y: b.pos.y, z: b.pos.z };
    b.home = home;
    out.push({ id: b.id, home });
  }
  return out;
}

// standingStructure(b): "is this still the BUILDING, or is it a corpse?" —
// depotStandingFraction's rule, asked of one body. Census-stamped stone
// (b.home) counts only while it sits within DEPOT_STANDING_TOL of where it
// was built; anything else with no home (walls, towers, un-censused fixture
// stone) is standing by definition — it has never been knocked anywhere.
// Sappers (both signs) filter their targets through this: rubble is a corpse,
// and the assault is on the building.
export function standingStructure(b) {
  if (!b || !b.alive) return false;
  const h = b.home;
  if (!h) return true;
  const dx = b.pos.x - h.x, dy = b.pos.y - h.y, dz = b.pos.z - h.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) <= DEPOT_STANDING_TOL;
}

// depotStandingFraction: fraction of the census still standing. byId is a
// Map (world.byId works directly) or anything with a .get(id) -> body-like
// {alive, pos:{x,y,z}}. A census entry with no live body at all (welded off
// and despawned) counts as not-standing, same as one that's merely wandered
// past the tolerance. Empty census reads as 1.0 (nothing to lose yet/ever —
// callers should not invoke this before buildTown has run).
export function depotStandingFraction(census, byId) {
  if (!census || census.length === 0) return 1;
  let standing = 0;
  for (const c of census) {
    const b = byId && byId.get ? byId.get(c.id) : null;
    if (!b || b.alive === false) continue;
    const dx = b.pos.x - c.home.x, dy = b.pos.y - c.home.y, dz = b.pos.z - c.home.z;
    if (Math.sqrt(dx * dx + dy * dy + dz * dz) <= DEPOT_STANDING_TOL) standing++;
  }
  return standing / census.length;
}

// checkDepotBreach: the second (independent) LOSS track, alongside checkLoss
// (lives). Idempotent — no-op once the run has already ended, same contract
// as checkLoss, and the two never fight: whichever fires first sets gameOver
// and the other's own guard keeps it from overwriting the outcome.
export function checkDepotBreach(S, fraction) {
  if (S.gameOver || S.victory) return false;
  if (fraction < DEPOT_BREACH_FRAC) {
    S.gameOver = true;
    S.breach = true;
    return true;
  }
  return false;
}

// checkEnemyBreach (FRONT F1): the OTHER loss track's mirror — their depot
// below the standing threshold ends the war in the Bureau's favor. Same
// idempotence contract as checkDepotBreach; whichever fires first wins and
// the other's guard keeps it from overwriting the outcome.
export function checkEnemyBreach(S, fraction) {
  if (S.gameOver || S.victory) return false;
  if (fraction < DEPOT_BREACH_FRAC) { // same threshold both sides (symmetry; provisional, F5)
    S.victory = true;
    S.enemyBreach = true;
    return true;
  }
  return false;
}

// stepDepotCensus: the ~1Hz gate. Accumulates dt on S.depotCensusAcc and only
// invokes computeFraction (the caller's — usually
// depotStandingFraction(census, world.byId) — actual work) once the
// accumulator crosses 1/DEPOT_CENSUS_HZ seconds, matching the territory
// step's own accumulator pattern (DepotGame.jsx's TERR_STEP) rather than
// re-scanning every chunk every frame. Returns true the tick it actually ran
// the census (so callers can e.g. throttle a debug log to the same cadence).
export function stepDepotCensus(S, dt, computeFraction) {
  S.depotCensusAcc = (S.depotCensusAcc || 0) + dt;
  if (S.depotCensusAcc < 1 / DEPOT_CENSUS_HZ) return false;
  S.depotCensusAcc -= 1 / DEPOT_CENSUS_HZ;
  // FRONT F1: computeFraction may return {player, enemy} (both depots) or a
  // bare number (legacy player-only callers) — one gate, two readings.
  const f = computeFraction();
  const player = typeof f === "number" ? f : f.player;
  const enemy = typeof f === "number" ? 1 : f.enemy;
  S.depotStanding = player;
  S.enemyStanding = enemy;
  checkDepotBreach(S, player);
  checkEnemyBreach(S, enemy);
  return true;
}

// ------------------------------------------------------------------ the bell
// THE MUSTER BELL — the war's shared clock, and the only thing that brings an
// assault. It runs on SIM time (world.t, advanced by DepotGame.jsx's
// fixed-step accumulator); wall clock and React state are both forbidden here
// by the same law the rest of this file lives under.
export const BELL_PERIOD_S = 120;   // provisional (F5)

// Bell index at which the enemy's tiers 1/2/3 open. Bell 1 is the FIRST bell
// of a match, so tier 1 marches with the opening assault. // provisional (F5)
export const TIER_BELLS = [1, 3, 5];

// The enemy's ladder: ENEMY_SPECS tags (plus "tank", TANK's own row) by tier.
// Conscripts ("") are never gated — they are what a regiment has before it
// has anything. Task 2 writes the player's mirrored table in specs.js against
// these exact three rows; both sides climb on the same bells.
export const ENEMY_TIERS = [
  ["fast", "heavy"],    // tier 1 — runners, breakers
  ["gren", "sapper"],   // tier 2 — grenadiers, sappers
  ["sniper", "tank"],   // tier 3 — marksmen, armour
];

// enemyTierState(bell) -> { bell, tags }: every tag an assault at this bell
// may contain. Pure, no rng — the gate is the bell index and nothing else.
export function enemyTierState(bell) {
  const tags = [""];
  for (let i = 0; i < ENEMY_TIERS.length; i++) {
    if (bell >= TIER_BELLS[i]) for (const t of ENEMY_TIERS[i]) tags.push(t);
  }
  return { bell, tags };
}

// The in-flight assault's ledger: what is still walking out of the spawn
// points, and what it has taken off the player since it mustered. One assault
// is live at a time; the next bell overwrites this whether the last one is
// spent or not.
export function makeAssaultState() {
  return { spawnQueue: 0, spawnTimer: 0, spawnDelay: 1, mixBag: [], results: null, fielded: 0, musterScrap: null, spawnDoneT: null, withdrawn: false, withdrew: 0 };
}

// Seconds of SIM time after an assault finishes spawning before its survivors
// break contact and withdraw in order.
export const ASSAULT_TIMEOUT = 75;

// Player scrap granted at each bell — the retired stall's +12, moved onto the
// clock so the cycle still pays. // provisional (F5)
export const BELL_SCRAP = 12;

export function makeRunState({ startResources = 120 } = {}) {
  return {
    resources: startResources, kills: 0,
    ws: makeAssaultState(), spawnRR: 0,
    mode: "wall", sellMode: false, inspectId: null,
    started: false, gameOver: false, victory: false, attrition: false, ledgerLoss: false,
    starvedStreak: 0, spent: false,
    paused: false, speed: 1,
    // The clock. bellAt is the absolute SIM-clock stamp the next bell is due
    // at; bellT is the readout derived from it (see stepBell).
    bell: 0, bellT: BELL_PERIOD_S, bellAt: BELL_PERIOD_S,
    lastDispatch: null,
    zoom: 1, acc: 0, t: 0, fps: 60, fpsAcc: 0, fpsN: 0,
    hover: null, pointer: null, toasts: [],
    hudT: 0, keys: {}, sellById: null,
  };
}

// Bureau copy for the bell's dispatch. Pure + deterministic (no RNG —
// depot-lint forbids it): `bell` is the bell that just rang. intelLines
// (already composed by the caller — composeIntel/openingIntel run their own
// seeded rng draws before this is called) sit under the header. The card no
// longer gates anything — nothing stops the war for a page of prose — so it
// closes on an end-of-transmission line rather than an instruction.
export function makeDispatch(bell, intelLines = []) {
  const wo = "WO-" + String(1000 + bell).padStart(4, "0");
  return {
    wo,
    lines: [
      `MUSTER BELL ${bell}. THE COLUMN IS MOVING.`,
      ...intelLines,
      "END OF TRANSMISSION.",
    ],
  };
}

// Player-side book value: scrap on hand plus the build cost of every
// standing structure. snap is the same shape DepotGame.jsx's buildSnapshot()
// produces ({mortars, mgs, guns, rockets, frosts, walls}) — live body counts
// by type, read fresh at the moment of the verdict. guns and rockets are
// counted separately and valued at each tower's own real spec cost — the
// AI's counter-play signal elsewhere still lumps gun+rocket together (that's
// a shopping-pressure heuristic, not a ledger), but the book-value verdict
// must not undervalue (or overvalue) a rocket tower at gun price.
function playerBookValue(S, snap) {
  const s = snap || {};
  const assets =
    (s.mortars || 0) * TOWER_SPECS.mortar.cost +
    (s.mgs || 0) * TOWER_SPECS.mg.cost +
    (s.guns || 0) * TOWER_SPECS.gun.cost +
    (s.rockets || 0) * TOWER_SPECS.rocket.cost +
    (s.frosts || 0) * TOWER_SPECS.frost.cost +
    (s.walls || 0) * WALL_COST;
  return bookValue({ scrap: S.resources, assets });
}

// Attacker-side book value: regiment scrap plus the purchase-price value of
// its surviving unfielded pool (heads at conscript price, tanks at tank
// price — same ENEMY_SPECS/TANK bounty values ai.js spends at muster).
function attackerBookValue(S) {
  if (!S.reg) return 0;
  const assets = S.reg.heads * ENEMY_SPECS[""].bounty + S.reg.tanks * TANK.bounty;
  return bookValue({ scrap: S.reg.scrap, assets });
}

// Stub alternate loss condition — a future phase adds a regiment (a
// player-side unit group) that can be wiped out mid-run. Always false for
// now; the hook exists so callers already check it.
export function regimentDestroyed(S) {
  return false;
}

// FRONT F1: lives are gone — the depot's masonry is its own health bar
// (checkDepotBreach sets gameOver directly). What remains here is the
// stubbed regiment-destroyed hook, kept so a future player-side regiment
// wipe still has its single loss gate. Idempotent, headless-testable.
// --- the ending's dignity (mk0.29) ------------------------------------------
// A breach used to slam the dispatch card up the same instant the depot's
// standing fraction crossed the line: the collapse the player just caused
// happened behind a scrim. Now the verdict stamps the world clock, the world
// keeps simming and rendering, and the card mounts END_CARD_DELAY_S later.
// Deterministic (a world-clock stamp, no rng, no wall clock), idempotent (the
// first verdict tick owns the stamp).
export const END_CARD_DELAY_S = 6;   // provisional feel number — Jeff tunes by play
export function stampEnd(S, nowT) {
  if ((S.gameOver || S.victory) && S.endedAt == null) S.endedAt = nowT;
  return S.endedAt;
}
export function endCardReady(S, nowT, delay = END_CARD_DELAY_S) {
  if (!S.gameOver && !S.victory) return false;
  if (S.endedAt == null) return false;
  return nowT - S.endedAt >= delay;
}

export function checkLoss(S) {
  if (S.gameOver || S.victory) return false;
  if (regimentDestroyed(S)) {
    S.gameOver = true;
    return true;
  }
  return false;
}

// FRONT F1: RETIRED AS AN ENDING — nothing in the cycle calls this (the only
// enders are the two breaches). Kept exported because the economy probe still
// reads the book-value verdict; F5 may delete it.
export function checkWin(S, snap = {}) {
  if (playerBookValue(S, snap) >= attackerBookValue(S)) {
    S.victory = true;
  } else {
    S.gameOver = true;
    S.ledgerLoss = true;
  }
  return S.victory;
}

// End-of-run dispatch copy — same teletyped card style as the between-wave
// stall dispatch. FRONT F1: only two endings exist — a depot fell. Victory
// means THEIR depot is rubble; loss means YOURS is. The retired verdict
// branches (attrition, spent, ledger, final-wave) are gone with their
// endings; extra fields in the argument object are tolerated and ignored.
export function makeEndDispatch({ victory, kills = 0 }) {
  const wo = "WO-9999";
  if (victory) {
    return {
      wo,
      lines: [
        "THE OPPOSING DEPOT IS BREACHED.",
        "The position opposite is rubble. The field belongs to the Bureau.",
        `${kills} CONFIRMED. FIELD ORDER CLOSED.`,
      ],
    };
  }
  return {
    wo,
    lines: [
      "THE DEPOT IS BREACHED.",
      "The position is lost. Withdrawal under fire.",
    ],
  };
}

// The bell cycle — the single source of truth for when an assault marches.
// Kept dependency-free (no world/render refs) so it is headless-testable from
// scripts/depot-test.mjs and so DepotGame.jsx's frame loop and the offline
// test drive the exact same code path.

// A wave's mix ([tag, count] pairs) expands into a bag of tags, then a
// fixed-stride-7 shuffle interleaves types instead of clumping them.
// Deterministic — no RNG (the stride is a constant), so this needs no
// world.rng() plumbing.
function buildMixBag(mix) {
  const bag = [];
  for (const m of mix) for (let i = 0; i < m[1]; i++) bag.push(m[0]);
  const out = [];
  let i = 0;
  while (bag.length) { i = (i + 7) % bag.length; out.push(bag.splice(i, 1)[0]); }
  return out;
}

// stepBell(S, worldT): the clock, and only the clock. Returns true on the
// tick the bell is due; the caller rings it (fireBell) so this stays free of
// world and rng dependencies. bellAt is an absolute SIM-clock stamp, not a
// per-frame subtraction, so the period cannot drift with frame length — and
// because world.t only advances while the sim steps, a paused or unstarted
// run holds the bell exactly where it was.
export function stepBell(S, worldT) {
  S.bellT = Math.max(0, S.bellAt - worldT);
  if (worldT < S.bellAt) return false;
  S.bellAt = worldT + BELL_PERIOD_S;
  S.bellT = BELL_PERIOD_S;
  return true;
}

// fireBell(S, opts) — THE BELL. opts: { reg (the attacker's live regiment —
// makeRegiment output, mutated in place by planWave), snap (buildSnapshot),
// rng (world.rng), t (world.t, for the spawn-done stamp on an empty muster) }.
//
// Fixed order, and the order is the design:
//   1. the cycle that just ended pays out — the attacker banks what its
//      assault took off the player (payResults);
//   2. TASK 2 HOOK (see below) — intel report, income, manifest;
//   3. the muster — planWave composes the assault under THIS bell's tier cap;
//   4. the bureau's read of that muster, onto the re-readable dispatch.
//
// Nothing waits: an assault still standing on the field when the bell rings is
// simply joined by the next one, and no card gates the muster.
export function fireBell(S, opts = {}) {
  const { reg = null, snap = null, rng = null, t = null } = opts;
  const ws = S.ws;
  const prevWithdrew = ws.withdrew || 0;

  // 1. the closing cycle's results
  if (reg && ws.results) payResults(reg, ws.results);

  // 2. ===== TASK 2 HOOK =====================================================
  // The intel report -> income -> manifest sequence is inserted HERE, before
  // the muster below, so the cards describe the assault about to march.
  // Task 1 grants the cycle's income in the hook's place (the stipend and the
  // player's cycle scrap that the retired stall used to pay) — without it the
  // regiment cannot afford a muster and the war starves. Task 2 owns moving
  // this grant into the sequence proper.
  S.resources += BELL_SCRAP;
  if (reg) reg.scrap += STIPEND;
  // =========================================================================

  // 3. the muster. The bell index advances FIRST: bell 1 is the first bell of
  // a match, and TIER_BELLS is read against the bell whose assault this is.
  S.bell++;
  const tier = enemyTierState(S.bell);
  let units = 0, mix = [];
  if (reg && rng) {
    // Muster-time solvency snapshot, BEFORE planWave spends the scrap — the
    // starved check below reads this, never the post-buy balance (which is
    // routinely near zero after a perfectly healthy muster).
    ws.musterScrap = reg.scrap;
    const plan = planWave(reg, snap || {}, S.bell, rng, tier.tags);
    units = plan.buys.reduce((s, b) => s + b.n, 0);
    mix = plan.buys.map((b) => [b.type, b.n]);
    // Intel delay buffer: the plan that governed the PREVIOUS assault (still
    // sitting in S.pendingPlan from the prior bell) becomes the one-bell-old
    // source composeIntel reads now; this bell's fresh plan takes its place
    // and won't surface as intel until the bell after this one. First bell of
    // a run: intelPlan stays null (no history yet), so plan-keyed intel
    // families stay silent.
    S.intelPlan = S.pendingPlan || null;
    S.pendingPlan = plan;
  }
  ws.fielded = units;
  ws.spawnQueue = units;
  ws.spawnDelay = spawnDelayFor(S.bell);
  ws.spawnTimer = 0;
  ws.mixBag = mix.length ? buildMixBag(mix) : [];
  // The withdrawal clock starts when the last man is on the field (DepotGame's
  // spawn driver stamps it). An empty muster has no last man, so it stamps
  // now — otherwise stragglers from the previous assault could never break
  // contact.
  ws.spawnDoneT = units > 0 ? null : t;
  ws.withdrawn = false;
  ws.withdrew = 0;
  ws.results = { structureDmg: 0, towerKills: 0, wallKills: 0, buildingKills: 0, leaks: 0 };

  // 4. the bureau's read. A broken or starved regiment does not END the war —
  // it just can't defend its depot. Each observation is a one-time dispatch
  // line (digit-free bureau voice), spliced onto the card below.
  const observations = [];
  if (reg && !S._reportedBreak && combatIneffective(reg)) {
    S._reportedBreak = true; // one-time dispatch line
    observations.push("The formation opposite is judged combat-ineffective. The guns will say the rest.");
  }
  // Starvation keeps its muster-time solvency rule: a muster that fielded
  // anything always resets the streak.
  if (reg) {
    const starved = (ws.fielded || 0) === 0 && (ws.musterScrap ?? reg.scrap) < MIN_WAVE_FLOOR;
    S.starvedStreak = starved ? (S.starvedStreak || 0) + 1 : 0;
    if (S.starvedStreak >= 3 && !S._reportedSpent) {
      S._reportedSpent = true; // one-time dispatch line
      observations.push("Three musters called and none fielded. The offensive opposite is judged spent.");
    }
  }
  // Intel: the one-bell-old plan plus the live regiment read. rng is optional
  // so callers/tests without a world rng get no intel lines rather than a
  // crash. The first bell gets the opening strength estimate instead — there
  // is no plan history yet for composeIntel to report on.
  let intelLines = [];
  if (rng && reg) {
    if (S.bell === 1) intelLines = [openingIntel(reg)];
    else intelLines = composeIntel(S.intelPlan, reg, rng);
  }
  const d = makeDispatch(S.bell, intelLines);
  for (const line of observations) d.lines.splice(d.lines.length - 1, 0, line);
  // Truthful withdrawal line: appears ONLY when the assault that just ended
  // actually broke contact (never on annihilated ones), and stays digit-free.
  if (prevWithdrew > 0) {
    d.lines.splice(d.lines.length - 1, 0, "Contact broken off. The remainder withdrew in order.");
  }
  S.lastDispatch = d;
  return d;
}

// Next spawn tag for this tick: pulled from the assault's mix bag if it has
// one, "" (conscript) otherwise. Caller pops S.ws.spawnQueue itself.
export function nextSpawnTag(S) {
  const ws = S.ws;
  return ws.mixBag.length ? ws.mixBag.pop() : "";
}

// withdrawDue(S, worldT): a spent assault breaks contact. True on the single
// tick ASSAULT_TIMEOUT seconds of SIM time (never wall clock) have passed
// since the last queued man spawned (ws.spawnDoneT, stamped by DepotGame's
// spawn driver); the sweep itself is executeWithdrawal's job. Raised once per
// assault — the next muster clears ws.withdrawn. The bell is indifferent to
// all of it: the next assault comes on schedule either way.
export function withdrawDue(S, worldT) {
  const ws = S.ws;
  if (ws.withdrawn || ws.spawnQueue > 0 || ws.spawnDoneT == null) return false;
  if (worldT - ws.spawnDoneT <= ASSAULT_TIMEOUT) return false;
  ws.withdrawn = true;
  return true;
}

// The timeout sweep: every ACTUALLY-alive team-2 body (unit|vehicle) leaves
// the world directly (byId.delete + bodies.splice) — no kill
// events, no bounty (nothing dies, so units.js's _paid guard never fires),
// no smears. Their manpower returns to the regiment: they didn't die, the
// books stay honest. Team-1 squad members are structurally untouchable
// (team filter). Dead bodies are left to the normal corpse sweep.
export function executeWithdrawal(S, world) {
  let inf = 0, tanks = 0;
  for (let i = world.bodies.length - 1; i >= 0; i--) {
    const b = world.bodies[i];
    if ((b.kind !== "unit" && b.kind !== "vehicle") || !b.alive || b.team !== 2) continue;
    if (b.kind === "vehicle") tanks++; else inf++;
    world.byId.delete(b.id);
    world.bodies.splice(i, 1);
  }
  if (S.reg) { S.reg.heads += inf; S.reg.tanks += tanks; }
  S.ws.withdrew = inf + tanks;
  return { inf, tanks };
}

export const HUD0 = {
  fps: 0, bell: 1, bellT: BELL_PERIOD_S, enemies: 0, resources: 120, walls: 0, towers: 0, kills: 0,
  lastDispatch: null,
  started: false, gameOver: false, victory: false, breach: false, enemyBreach: false,
  mode: "wall", sellMode: false, sandbagOrient: 0, paused: false, speed: 1, inspect: null, toasts: [],
  pending: null, fogOn: true, discipline: "careful", depotStanding: 1, enemyStanding: 1,
  squadSel: null, squadFlag: null,
};
