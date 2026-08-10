// COLDSNAP DEPOT — Phase 0/1 specs. Tower and enemy numbers ported straight
// from src/game/ColdsnapTD.jsx (the reference implementation, left untouched).
// Waves here are flat conscript-only ramps — mixed enemy types, tanks and
// the mech boss all return in later phases.
export const TOWER_SPECS = {
  mg:     { range: 15, fireRate: 0.17, projSpeed: 95, dmg: 5,  blastR: 0.3, kv: 0.5, cost: 15, hp: 80,  crater: 0, label: "MG",     icon: "⊞", kind: "mg",    hy: 1.0, blurb: "Fast, cheap, short reach" },
  gun:    { range: 19, fireRate: 1.05, projSpeed: 58, dmg: 25, blastR: 2.3, kv: 8,   cost: 25, hp: 130, crater: 0.55, label: "GUN",    icon: "⚑", kind: "shell", hy: 1.5, blurb: "Flat-trajectory workhorse" },
  mortar: { range: 26, fireRate: 2.3,  projSpeed: 33, dmg: 38, blastR: 3.8, kv: 10,  cost: 35, hp: 95,  crater: 0.8, label: "MORTAR", icon: "◎", kind: "shell", hy: 0.8, blurb: "Arcs over walls, big blast" },
  rocket: { range: 23, fireRate: 4.4,  projSpeed: 30, dmg: 27, blastR: 3.4, kv: 9,   cost: 50, hp: 110, volley: 4, crater: 0.7, label: "ROCKET", icon: "▲", kind: "shell", hy: 1.2, blurb: "Four-round salvo, slow reload" },
  frost:  { range: 12, fireRate: 0,    projSpeed: 0,  dmg: 0,  blastR: 0,   kv: 0,   cost: 20, hp: 85,  label: "FROST",  icon: "❄", kind: "mg",    slow: 0.42, hy: 1.35, blurb: "Halves their pace in radius" },
};
export const TOWER_ORDER = ["mg", "gun", "mortar", "rocket", "frost"];

// Conscript-only — the only enemy type Phase 0/1 spawns.
export const ENEMY_SPECS = {
  "": { mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, hp: 58, bounty: 4, speed: 3.2, gain: 14, label: "conscript" },
};

// Flat waves: unit count climbs, spawn delay tightens. No mixes, no armor,
// no boss — those are later-phase scripting.
export const WAVES = [
  { units: 12, delay: 0.9 },
  { units: 16, delay: 0.85 },
  { units: 20, delay: 0.8 },
  { units: 24, delay: 0.75 },
  { units: 28, delay: 0.7 },
  { units: 32, delay: 0.65 },
  { units: 36, delay: 0.6 },
  { units: 40, delay: 0.55 },
  { units: 46, delay: 0.5 },
  { units: 52, delay: 0.45 },
];

export const MASON = { hcs: 0.40, pitch: 0.83, mass: 100, breakF: 8.0e4 };
