// COLDSNAP DEPOT — Phase 0/1 specs. Tower and enemy numbers ported straight
// from src/game/ColdsnapTD.jsx (the reference implementation, left untouched).
// Waves here are flat conscript-only ramps — mixed enemy types, tanks and
// the mech boss all return in later phases.
export const TOWER_SPECS = {
  mg:     { range: 15, fireRate: 0.17, projSpeed: 95, dmg: 5, dirDmg: 5, blastR: 0.3, kv: 0.5, cost: 15, hp: 80,  crater: 0, label: "MG",     icon: "⊞", kind: "mg",    hy: 1.0, acc: 0.090, windF: 0.06, windComp: 0,   blurb: "Fast, cheap, short reach", occl: "arc" },
  gun:    { range: 19, fireRate: 1.05, projSpeed: 58, dmg: 25, blastR: 2.3, kv: 8,   cost: 25, hp: 130, crater: 0.55, label: "GUN",    icon: "⚑", kind: "shell", hy: 1.5, acc: 0.07, windF: 0.9,  windComp: 0.6, blurb: "Flat-trajectory workhorse", occl: "arc" },
  mortar: { range: 26, fireRate: 2.3,  projSpeed: 33, dmg: 38, blastR: 3.8, kv: 10,  cost: 35, hp: 95,  crater: 0.8, label: "MORTAR", icon: "◎", kind: "shell", hy: 0.8, acc: 0.020, windF: 0.04, windComp: 0.6, blurb: "Arcs over walls, big blast", occl: "lofted" },
  rocket: { range: 23, fireRate: 4.4,  projSpeed: 30, dmg: 27, blastR: 3.4, kv: 9,   cost: 50, hp: 110, volley: 4, crater: 0.7, label: "ROCKET", icon: "▲", kind: "shell", hy: 1.2, acc: 0.340, windF: 1.3, windComp: 0.5, blurb: "Four-round salvo, slow reload", occl: "lofted" },
  frost:  { range: 12, fireRate: 0,    projSpeed: 0,  dmg: 0,  blastR: 0,   kv: 0,   cost: 20, hp: 85,  label: "FROST",  icon: "❄", kind: "mg",    slow: 0.42, hy: 1.35, blurb: "Halves their pace in radius" },
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
export const ENEMY_FIRE = {
  rifle: { projSpeed: 70, dmg: 5, dmgHeavy: 9, dirDmg: 5, kind: "mg", blastR: 0.6, kv: 1.0, crater: 0, acc: 0.090, windF: 0.06, windComp: 0, cd: 1.5, cdVar: 0.5, range: 13, occl: "arc" },
  lob:   { projSpeed: 28, dmg: 20, kind: "shell", blastR: 2.6, kv: 6, crater: 0.45, acc: 0.020, windF: 0.04, windComp: 0.6, cd: 3.0, cdVar: 0.6, range: 21, occl: "lofted" },
  tank:  { projSpeed: 85, dmg: TANK.dmg, kind: "shell", blastR: TANK.blastR, kv: 8, crater: 0.5, acc: 0.070, windF: 0.9, windComp: 0.6, cd: TANK.gunCd, cdVar: 1.2, range: TANK.gunRange, occl: "arc" },
};

// 50-wave ramp: unit count and spawn delay scale linearly with wave index,
// same shape as Phase 0/1. The AI brain replaces this table wholesale in
// Task 3/4 — for now the new unit types are seeded into later waves' mixes
// so they're reachable; earlier waves stay conscript-only (mix undefined ==
// all conscripts, same as before).
export const WAVES = Array.from({ length: 50 }, (_, i) => {
  const w = { units: 12 + i * 2, delay: Math.max(0.18, 0.9 - i * 0.014) };
  if (i === 2) w.mix = [["", 14], ["fast", 8]];
  else if (i === 4) w.mix = [["", 16], ["heavy", 4], ["gren", 4]];
  else if (i === 6) w.mix = [["", 18], ["sapper", 6]];
  else if (i === 8) w.mix = [["fast", 16], ["heavy", 8], ["tank", 2]];
  else if (i >= 10 && i % 3 === 0) w.mix = [["", 10], ["fast", 8], ["heavy", 8], ["gren", 6], ["sapper", 4], ["tank", 2]];
  return w;
});

export const MASON = { hcs: 0.40, pitch: 0.83, mass: 100, breakF: 8.0e4 };

// Infantry arms — both teams use identical values (symmetry). All fire flows
// through shooterFire + the accuracy model; occl/windF/windComp like any shooter.
export const INFANTRY_ARMS = {
  sniper: { projSpeed: 120, kind: "mg", dmg: 65, dirDmg: 130, fireRate: 4.5, range: 30,
            acc: 0.006, occl: "arc", windF: 0.10, windComp: 0.8 },
  rifles: { projSpeed: 90, kind: "mg", dmg: 5, dirDmg: 5, fireRate: 1.3, range: 15,
            acc: 0.090, occl: "arc", windF: 0.06, windComp: 0.6 },
  mg:     { projSpeed: 100, kind: "mg", dmg: 5, dirDmg: 5, burst: 6, burstGap: 0.17, fireRate: 2.2,
            range: 17, acc: 0.070, occl: "arc", windF: 0.06, windComp: 0.6 },
};
