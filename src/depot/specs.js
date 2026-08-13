// COLDSNAP DEPOT — Phase 0/1 specs. Tower and enemy numbers ported straight
// from src/game/ColdsnapTD.jsx (the reference implementation, left untouched).
// Waves here are flat conscript-only ramps — mixed enemy types, tanks and
// the mech boss all return in later phases.
// mg tower dirDmg is NOT dmg (5) verbatim, same reason as INFANTRY_ARMS
// rifles/mg below: a direct hit lands its full value every time, while the
// blast law it replaces averaged well under dmg per hit. Measured flagged
// (world.depotCombat=true) vs a soft fixture: dmg-equal dirDmg (5) drifted
// tower-mg DPS +45.4% over the pre-wiring baseline; rescaled to 3.4 to land
// within the +/-10% replaces-not-adds contract (measured -1.2%). See
// scripts/depot-test.mjs's towerShot DPS assert.
// SLOW FRONT C0 Task 4 (mk0.33) — ARTILLERY CADENCE HALVED, Jeff-ratified.
// Every tube on the map reloads twice as slowly: mortar fireRate 2.3 -> 4.6,
// rocket 4.4 -> 8.8, and by the symmetry law the infantry mirrors move with
// them (INFANTRY_ARMS.mortars 3.0 -> 6.0, ENEMY_FIRE.lob.cd 3.0 -> 6.0).
// Damage, blast, accuracy and wind are UNTOUCHED — only the wait between
// shells. This is a pace preview, so all four numbers stay provisional (F5).
// P1.5 Task 1 (mk0.50, Jeff) — TOWER PRICES +~50%, integers: mg 15->23,
// gun 25->38, mortar 35->53, rocket 50->75, frost 20->30. Only `cost` moved;
// range/damage/cadence/accuracy are all untouched. Enemy bounties below are
// DELIBERATELY not raised alongside these — the interim cost asymmetry is
// documented in full at SQUAD_SPECS (src/depot/squads.js) and the mercenary
// market is what repairs it. All five prices provisional (F5).
// WEAPON TAGS (P1.5 Task 3, mk0.56): every fire spec in this file carries a
// `weapon` — WHICH GUN this is, as opposed to `kind`, which is what the round
// physically is (a "shell" is fired by the gun tower, the mortar tower, the
// rocket tower, a tank and a grenadier alike, and every infantry arm is
// kind:"mg" whatever it actually is). shooterFire threads it into the
// projectile spec, core.js's fireProjectile hangs it on the muzzle event, and
// src/platform/audio.js gives each tag its own voice. Purely a sound label:
// nothing mechanical reads it, and no spec's numbers moved to add it.
// frost is deliberately untagged — it has no projectile at all (fireRate 0,
// projSpeed 0) and never emits a muzzle event to give a voice to.
export const TOWER_SPECS = {
  // mk0.99 (owner's lethality ruling): 3.4 -> 8 — the MG tower rises flatter
  // than rifles; a six-round burst kills a conscript. The ±10% replaces-not-
  // adds calibration this line once carried is superseded.
  mg:     { range: 15, fireRate: 0.17, projSpeed: 95, dmg: 5, dirDmg: 8, blastR: 0.3, kv: 0.5, cost: 23, hp: 80,  crater: 0, label: "MG",     icon: "⊞", kind: "mg",    weapon: "mg",     hy: 1.0, acc: 0.090, windF: 0.06, windComp: 0,   blurb: "Fast, cheap, short reach", occl: "arc" },
  gun:    { range: 19, fireRate: 1.05, projSpeed: 58, dmg: 25, blastR: 2.3, kv: 8,   cost: 38, hp: 130, crater: 0.55, label: "GUN",    icon: "⚑", kind: "shell", weapon: "shell",  hy: 1.5, acc: 0.07, windF: 0.9,  windComp: 0.6, blurb: "Flat-trajectory workhorse", occl: "arc" },
  mortar: { range: 26, fireRate: 4.6 /* halved cadence (C0 T4) // provisional (F5) */,  projSpeed: 33, dmg: 38, blastR: 3.8, kv: 10,  cost: 53, hp: 95,  crater: 0.8, label: "MORTAR", icon: "◎", kind: "shell", weapon: "mortar", hy: 0.8, acc: 0.020, windF: 0.04, windComp: 0.6, blurb: "Arcs over walls, big blast", occl: "lofted" },
  rocket: { range: 23, fireRate: 8.8 /* halved cadence (C0 T4) // provisional (F5) */,  projSpeed: 30, dmg: 27, blastR: 3.4, kv: 9,   cost: 75, hp: 110, volley: 4, crater: 0.7, label: "ROCKET", icon: "▲", kind: "shell", weapon: "rocket", hy: 1.2, acc: 0.021, windF: 1.3  /* lobbed retune (mk0.25): swept 0.020-0.035 vs the pinned flat baseline 2.4592, curve in the F1.5 artillery plan // provisional (F5) */, windComp: 0.5, blurb: "Four-round salvo, slow reload", occl: "lofted" },
  frost:  { range: 12, fireRate: 0,    projSpeed: 0,  dmg: 0,  blastR: 0,   kv: 0,   cost: 30, hp: 85,  label: "FROST",  icon: "❄", kind: "mg",    slow: 0.42, hy: 1.35, blurb: "Halves their pace in radius" },
};
export const TOWER_ORDER = ["mg", "gun", "mortar", "rocket", "frost"];

// The zoo returns (Phase 3 Task 2) — ported straight from ColdsnapTD.jsx's
// ENEMY_SPECS (:569-574) and TANK (:836). bounty === TD's price value.
export const ENEMY_SPECS = {
  "":     { mass: 82,  hx: 0.26, hy: 0.86, hz: 0.26, hp: 58,  bounty: 4,  speed: 3.2, gain: 14, label: "conscript" },
  fast:   { mass: 62,  hx: 0.24, hy: 0.82, hz: 0.24, hp: 36,  bounty: 5,  speed: 5.1, gain: 18, label: "runner" },
  heavy:  { mass: 340, hx: 0.46, hy: 1.02, hz: 0.46, hp: 290, bounty: 12, speed: 2.1, gain: 11, label: "breaker" },
  gren:   { mass: 84,  hx: 0.26, hy: 0.92, hz: 0.26, hp: 66,  bounty: 8,  speed: 2.6, gain: 12, label: "grenadier" },
  sapper: { mass: 70,  hx: 0.25, hy: 0.84, hz: 0.25, hp: 30,  bounty: 7,  speed: 3.8, gain: 16, label: "sapper" },
  // Their sniper (Phase 5 Task 4C): marches until VANTAGE (units.js), then
  // holds and works with INFANTRY_ARMS.sniper — one table, both sides.
  // The pair (6.5 Task 6): a marksman buy fields TWO men — sniper + spotter
  // — so bounty (the buy price ai.js spends) rises 30 -> 45, mirroring the
  // player's own 45-scrap pair. Kill payout stays symmetric: units.js splits
  // the 45 across the two bodies (30 sniper + 15 spotter) at spawn.
  // MIRROR BROKEN, INTERIM (P1.5 Task 1, mk0.50): the player's pair now costs
  // 68 and this bounty stays 45 — see the asymmetry note at SQUAD_SPECS
  // (src/depot/squads.js). Deliberate, temporary, market-repaired.
  // RE-DRESSED (C0 T4, mk0.33 — Jeff): dress "android" DELETED. They are
  // ordinary men in the enemy's cold slate coat now, not silver machines;
  // troopkit's coat-is-side rule palettes them by team with no dress field at
  // all. units.js's spotter copies dress from this same spec, so the one
  // deletion re-dresses the whole pair. Campaign androids are unaffected —
  // that dress lives on scenario bodies (src/game/scenario.js), not here.
  sniper: { mass: 82,  hx: 0.26, hy: 0.86, hz: 0.26, hp: 44,  bounty: 45, speed: 2.9, gain: 14, label: "marksman" },
};

// Wave armor: an engine vehicle on the engine's own tread physics (see
// src/depot/units.js's stepTank) — 3.4 tonnes with a cannon. Ported from
// ColdsnapTD.jsx :836.
export const TANK = { mass: 3400, hx: 1.5, hy: 0.8, hz: 2.4, hp: 260, bounty: 25, gunCd: 4.6, gunRange: 34, dmg: 30, blastR: 2.5 };

// Enemy fire specs — acc/windF/windComp EQUAL to the analogous tower (Jeff's
// decision: aim fully equal). rifle mirrors TOWER_SPECS.mg, lob mirrors
// TOWER_SPECS.mortar, tank mirrors TOWER_SPECS.gun. cd/cdVar/range are the
// TD driver's own halt-range and fire-cadence constants (ColdsnapTD.jsx
// :678-721 rifle, :723-754 grenadier, :597-615 tank gun).
// rifle dirDmg: was LEFT at 5 (dmg-equal) while riflemen only ever targeted
// structures (hitOnly: "structure" — the direct-hit component is inert
// against walls/towers, 0% drift, see the enemy-rifle-vs-wall DPS assert).
// Phase 5 Task 4A gives riflemen an anti-personnel pass (units.js's
// nearestPlayerUnit), so dirDmg now FIRES against unit bodies — measured
// flagged (world.depotCombat=true) vs a pinned soft-unit fixture (bodies
// re-pinned per tick: knockback dynamics made a free fixture chaotic):
// dmg-equal dirDmg (5) drifted DPS +7.5% over the pre-wiring blast-only
// baseline (1.9763 -> 2.1254); rescaled to 4.5 (1.9182, -2.9%) to sit
// centered in the ±10% replaces-not-adds contract, mirroring INFANTRY_ARMS'
// own rifles rescale. See depot-test.mjs's "==== TASK 4A" parity assert.
// The wall path is unaffected (dirDmg still inert there).
export const ENEMY_FIRE = {
  // mk0.99 (owner's lethality ruling): 4.5 -> 15 — symmetry holds, both
  // sides rise. The ±10% replaces-not-adds calibration above is superseded.
  rifle: { projSpeed: 70, dmg: 5, dmgHeavy: 9, dirDmg: 15, kind: "mg", weapon: "rifle", blastR: 0.6, kv: 1.0, crater: 0, acc: 0.090, windF: 0.06, windComp: 0, cd: 1.5, cdVar: 0.5, range: 13, occl: "arc" },
  // lob cd 3.0 -> 6.0 (C0 T4, mk0.33): the grenadier's tube halves its cadence
  // alongside TOWER_SPECS.mortar and INFANTRY_ARMS.mortars — symmetry is law,
  // so their lob slows exactly as much as ours. cdVar is a separate dial and
  // was not moved. // provisional (F5)
  lob:   { projSpeed: 28, dmg: 20, kind: "shell", weapon: "mortar", blastR: 2.6, kv: 6, crater: 0.45, acc: 0.020, windF: 0.04, windComp: 0.6, cd: 6.0, cdVar: 0.6, range: 21, occl: "lofted" },
  tank:  { projSpeed: 85, dmg: TANK.dmg, kind: "shell", weapon: "tank", blastR: TANK.blastR, kv: 8, crater: 0.5, acc: 0.070, windF: 0.9, windComp: 0.6, cd: TANK.gunCd, cdVar: 1.2, range: TANK.gunRange, occl: "arc" },
};

// The 50-row WAVES table is DELETED (P1 Task 1, mk0.40). Nothing composes an
// assault from a table any more: ai.js's planWave is the only composer, sized
// by the bell index and rostered by state.js's enemyTierState tier caps.

// ------------------------------------------------------------ THE TWO LADDERS
// P1 Task 2 (mk0.41). Both sides climb the SAME bells (state.js's TIER_BELLS,
// [1, 3, 5]) — the symmetry is the design, so the two columns are written here
// together where a reader can check one against the other:
//
//              PLAYER (build-menu keys)          ENEMY (ENEMY_SPECS tags)
//   START      wall · sandbag · sq_rifles ·      "" conscripts (never gated)
//              sq_engineers
//   TIER 1     mg · sq_mg · frost                fast (runner) · heavy (breaker)
//   TIER 2     gun · sq_sniper · sq_mortars      gren · sapper
//   TIER 3     mortar · rocket · sq_sappers      sniper (marksman) · tank
//
// The enemy column is a READING of state.js's ENEMY_TIERS, not a second copy:
// the live gate stays where Task 1 put it and nothing here is consulted for
// enemy composition. Only the player column is data.
//
// Keys are DepotGame.jsx's palette mode keys exactly — bare keys are
// TOWER_SPECS types, sq_* are squad placement modes (SQUAD_SPECS types with
// the sq_ prefix the MG TOWER/MG TEAM name collision forced) — so the build
// menu's unlocked filter is a plain membership test with no translation table
// in between. // provisional (F5)
// P1.5 Task 4 (mk0.60): the ENGINEER TEAM joins the starting kit — every match
// now opens with rifles AND engineers, so the two-point build order is on the
// bar from bell 0 and never has to be won off the convoy. The enemy column is
// untouched: engineers build, they do not fight, so nothing on the other side
// mirrors them (the sapper split is the "Engineers & Arms" phase's business).
export const PLAYER_START = ["wall", "sandbag", "sq_rifles", "sq_engineers"];
export const PLAYER_TIERS = [
  ["mg", "sq_mg", "frost"],
  ["gun", "sq_sniper", "sq_mortars"],
  ["mortar", "rocket", "sq_sappers"],
];

export const MASON = { hcs: 0.40, pitch: 0.83, mass: 100, breakF: 8.0e4 };

// FRONT F1 Task 4.5 — THE satchel charge, one spec for both sides (the enemy
// sapper's stepSapper and the player sapper squad detonate this exact object;
// symmetry is law). Raised from {r:3.4, kv:9} by Jeff's decision 2026-08-11:
// the old charge peaked at 89,268 force vs the depot's 120,000 joint strength
// — sappers could never breach a depot. Tuned by measurement (see
// scripts/measure-satchel.mjs for the full {r,kv} curve): {r:5, kv:30} is the
// knee. Measured THROUGH PLAY (real squads walking in, wasting charges on
// scattered rubble like real sappers do): kv 30 -> 56 teams, kv 38 -> 18,
// kv 42 -> 17, kv 45 -> 9, kv 60 -> 10 (rubble-waste plateau). kv 45 is the
// smallest charge that breaches with a single-digit team count from the real
// plant distance (hx + 1.3). dmg/crater unchanged from the old charge.
// SIEGE FIX (mk0.21) — Jeff 2026-08-11 directive 1: the charge is DOUBLED.
// Force AND damage double (kv 45 -> 90, dmg 150 -> 300); the radius is a
// separate dial he did not move, so r stays 5. Known consequences, measured
// and reported rather than tuned around: the mk0.17 satchel-vs-wall band
// moves (walls have hp — 150 already one-shot a 100hp wall, 300 merely
// one-shots it harder); the infantry lethal radius grows; and the ENEMY
// sapper carries this same doubled charge against the player's depot and
// walls (symmetry is the law). Depot stones have NO hp at all — displacement
// past DEPOT_STANDING_TOL and weld-breaking (120,000 at a depot) is the only
// demolition currency there, which is what kv buys.
export const SATCHEL = { r: 5, kv: 90, dmg: 300, crater: 0.6, hitStruct: true }; // provisional (F5)

// SIEGE FIX (mk0.21) — Jeff's directive 4: get as close as possible before
// planting. The plant gate was arm's length (chunk hx + 1.3); this is CONTACT
// range, and it is the tightest value the player sapper can physically reach:
// squads.js hands every member a clearSlot-vetted goal, and clearSlot rejects
// any point within (stone hx + member hx 0.28 + SLOT_CLEAR_PAD 0.35) of a
// solid — so hx + 0.63 is the closest a man's CENTER can be legally parked,
// and seekGoal settles within 0.15 of that goal. hx + 0.7 is that floor plus
// a hair of settle margin. The enemy sapper (flow-field driven, no slot
// vetting) can and does close further; he shares the constant so the trigger
// is identical on both signs. Closer plant = more of the blast's force lands
// on the stone, which is the physics reason the old 1.3 under-delivered.
export const SAPPER_PLANT_PAD = 0.7;

// Infantry arms — both teams use identical values (symmetry). All fire flows
// through shooterFire + the accuracy model; occl/windF/windComp like any shooter.
export const INFANTRY_ARMS = {
  sniper: { projSpeed: 120, kind: "mg", weapon: "sniper", dmg: 65, dirDmg: 130, fireRate: 4.5, range: 30,
            acc: 0.006, occl: "arc", windF: 0.10, windComp: 0.8 },
  // rifles/mg dirDmg is NOT dmg (5) verbatim: a direct hit always lands its
  // full value (only obliquity-scaled), while the old blast-only law it
  // replaces averaged well under dmg per hit (explode()'s distance falloff
  // across the burst). Measured flagged (world.depotCombat=true) vs a soft
  // fixture: dmg-equal dirDmg (5) drifted DPS +22.6%/+37.1% (rifles/mg) over
  // the pre-wiring baseline — dirDmg scaled down here (4.1/3.6) to bring
  // flagged DPS back within the ±10% replaces-not-adds contract (measured
  // +0.5%/-1.2%). See scripts/depot-test.mjs's squadFire DPS assert.
  // mk0.99 (owner's lethality ruling): 4.1 -> 15 — rifles kill now; the
  // ±10% replaces-not-adds calibration above is superseded.
  rifles: { projSpeed: 90, kind: "mg", weapon: "rifle", dmg: 5, dirDmg: 15, fireRate: 1.3, range: 15,
            acc: 0.090, occl: "arc", windF: 0.06, windComp: 0.6 },
  // mk0.99 (owner's lethality ruling): 3.6 -> 8 — the MG family rises
  // flatter than rifles; a six-round burst kills roughly one conscript.
  mg:     { projSpeed: 100, kind: "mg", weapon: "mg", dmg: 5, dirDmg: 8, burst: 6, burstGap: 0.17, fireRate: 2.2,
            range: 17, acc: 0.070, occl: "arc", windF: 0.06, windComp: 0.6 },
  // F1.5 Task 1: the tube comes off the tower — the player mirror of the
  // enemy grenadier's lob (ENEMY_FIRE.lob values verbatim, aim fully equal
  // per the standing law). dirDmg none: shells are blast weapons. cd ->
  // fireRate (squadFire's cooldown field), so it tracks ENEMY_FIRE.lob.cd
  // one-for-one: 3.0 -> 6.0 with the C0 T4 cadence halving. // provisional (F5)
  mortars: { projSpeed: 28, kind: "shell", weapon: "mortar", dmg: 20, blastR: 2.6, kv: 6, crater: 0.45,
             fireRate: 6.0, range: 21, acc: 0.020, occl: "lofted", windF: 0.04, windComp: 0.6 },
};
