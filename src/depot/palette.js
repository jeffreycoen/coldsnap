import { TOWER_SPECS, TOWER_ORDER, BISON, APC, JEEP, MECH } from "./specs.js";
import { SQUAD_SPECS } from "./squads.js";

// The build palette, in bar order — every buildable the match can ever offer.
// Keys are the mode keys tapAt/setMode dispatch on and, since P1 Task 2, the
// exact keys specs.js's PLAYER_START/PLAYER_TIERS ladder is written in, so the
// unlocked filter below is a plain membership test.
export const PALETTE = [
  ...TOWER_ORDER.map((k) => ({ key: k, label: TOWER_SPECS[k].label, icon: TOWER_SPECS[k].icon, cost: TOWER_SPECS[k].cost })),
  // Squads (Phase 5 Task 3): mode keys prefixed sq_ — the MG tower owns "mg"
  { key: "sq_sniper", label: "SNIPERS", icon: "✛", cost: SQUAD_SPECS.sniper.cost },
  { key: "sq_rifles", label: "RIFLES", icon: "∴", cost: SQUAD_SPECS.rifles.cost },
  { key: "sq_mg", label: "GUNNERS", icon: "≣", cost: SQUAD_SPECS.mg.cost },
  // F1 Task 4.5: the demolition team — the only player weapon that moves
  // reinforced depot masonry (rifles measured at zero).
  { key: "sq_sappers", label: "SAPPERS", icon: "✸", cost: SQUAD_SPECS.sappers.cost },
  // F1.5 Task 1: the mortar team — selection shows squadReach's lofted
  // near-circle fan (accuracy.js handles occl "lofted" already).
  { key: "sq_mortars", label: "MORTAR TEAM", icon: "◎", cost: SQUAD_SPECS.mortars.cost },
  // P1.5 T4: the engineer team — in the starting kit, so this slot is on the
  // bar from the first frame of every match.
  { key: "sq_engineers", label: "ENGINEERS", icon: "⚒", cost: SQUAD_SPECS.engineers.cost },
  // mk2.02: the roster surgery — rockets and grenadiers hold the tier-1 seats.
  { key: "sq_rockets", label: "ROCKET TEAM", icon: "▲", cost: SQUAD_SPECS.rockets.cost },
  { key: "sq_grenadiers", label: "GRENADIERS", icon: "◎", cost: SQUAD_SPECS.grenadiers.cost },
  // P7.2 T6: the medic team — mercy on the bar
  { key: "sq_medics", label: "MEDICS", icon: "✚", cost: SQUAD_SPECS.medics.cost },
  // P7.2 T7: the mechanic team — the paid wrench
  { key: "sq_mechanics", label: "MECHANICS", icon: "⚙", cost: SQUAD_SPECS.mechanics.cost },
  { key: "sq_davy", label: "DAVY CROCKETT", icon: "☢", cost: SQUAD_SPECS.davy.cost },
  // P7 T9: THE HERO TIER — bar-visible only once unlocked like everything
  // else. mk1.95: hero keys are placement modes under the one law.
  { key: "hero_bison", label: "BISON", icon: "⛨", cost: BISON.cost },
  { key: "hero_apc", label: "APC", icon: "⬒", cost: APC.cost },
  { key: "hero_jeep", label: "JEEP", icon: "⛟", cost: JEEP.cost },
  { key: "hero_mech", label: "MECH", icon: "✇", cost: MECH.cost },
];
export const PALETTE_BY_KEY = Object.fromEntries(PALETTE.map((p) => [p.key, p]));
export const PALETTE_LABEL = Object.fromEntries(PALETTE.map((p) => [p.key, p.label]));

// mk2.25: THE ENEMY RACK (sandbox only). Every kind the enemy can field,
// placeable by tap on the bench. tag rows spawn through units.js spawnUnit
// (the marksman pair and the wave tank come out of it whole); hull/mech/
// tower rows mirror the enemy's own park shapes at the tapped cell. n is
// men per tap — the same head-count one enemy buy fields.
export const FOE_RACK = [
  { key: "foe_rifle", label: "CONSCRIPT", icon: "∴", tag: "", n: 1 },
  { key: "foe_rocket", label: "ROCKET TEAM", icon: "▲", tag: "rocket", n: 2 },
  { key: "foe_gren", label: "GRENADIERS", icon: "◎", tag: "gren", n: 2 },
  { key: "foe_sapper", label: "SAPPERS", icon: "✸", tag: "sapper", n: 2 },
  { key: "foe_mortar", label: "MORTARS", icon: "◎", tag: "mortar", n: 2 },
  { key: "foe_sniper", label: "SNIPER PAIR", icon: "✛", tag: "sniper", n: 1 },
  { key: "foe_mg", label: "GUNNERS", icon: "≣", tag: "mg", n: 2 },
  { key: "foe_eng", label: "ENGINEER", icon: "⚒", tag: "eng", n: 1 },
  { key: "foe_medic", label: "MEDIC", icon: "✚", tag: "medic", n: 1 },
  { key: "foe_mechanic", label: "MECHANIC", icon: "⚙", tag: "mechanic", n: 1 },
  { key: "foe_davy", label: "ATOMIC CREW", icon: "☢", tag: "davy", n: 2 },
  { key: "foe_tank", label: "WAVE TANK", icon: "⛨", tag: "tank", n: 1 },
  { key: "foe_bison", label: "BISON", icon: "⛨", hull: "bison" },
  { key: "foe_apc", label: "APC", icon: "⬒", hull: "apc" },
  { key: "foe_mech", label: "MECH", icon: "✇", mech: true },
  { key: "foe_t_mg", label: "SPITTER", icon: "⊞", tower: "mg" },
  { key: "foe_t_gun", label: "FIELD GUN", icon: "⚑", tower: "gun" },
  { key: "foe_t_mortar", label: "MORTAR", icon: "◎", tower: "mortar" },
  { key: "foe_t_rocket", label: "SALVO RACK", icon: "▲", tower: "rocket" },
  { key: "foe_t_tesla", label: "TESLA COIL", icon: "⚡", tower: "tesla" },
];
export const FOE_RACK_BY_KEY = Object.fromEntries(FOE_RACK.map((f) => [f.key, f]));

// P7.1 T5: THE BUILD TREE — one BUILD entry, three branches, SELL inside.
// Pure presentation: run.mode stays the single truth the tap layer reads.
export const TREE_BRANCHES = [
  { key: "troops", label: "TROOPS", icon: "∴", match: (k) => k.startsWith("sq_") },
  { key: "buildings", label: "BUILDINGS", icon: "⌂", match: (k) => TOWER_SPECS[k] != null },
  { key: "vehicles", label: "VEHICLES", icon: "⛨", match: (k) => k.startsWith("hero_") },
];
export const branchOf = (key) => { const b = TREE_BRANCHES.find((x) => x.match(key)); return b ? b.key : null; };
// mk2.28: the quartermaster's purpose lines — first war only.
export const QM_LINES = { troops: "men you order", buildings: "iron that stands", vehicles: "iron that moves", foes: "targets for the bench" };
// mk2.31: THE LATTICE — rungs cut by BASE price (v5 mockup),
// bottom-up in array order, cheap→dear inside a rung. Presentation only;
// the price-family rows in specs.js are untouched and a tag never jumps
// rungs on a live price. DAVY is the hero-tier troop; the APC is rung II
// iron, not hero.
export const LATTICE = {
  troops: [
    { name: "I", keys: ["sq_rifles", "sq_engineers", "sq_mg", "sq_sappers"] },
    { name: "II", keys: ["sq_grenadiers", "sq_rockets", "sq_mortars"] },
    { name: "III", keys: ["sq_medics", "sq_mechanics", "sq_sniper"] },
    { name: "HERO", keys: ["sq_davy"] },
  ],
  buildings: [
    { name: "I", keys: ["mg", "gun"] },
    { name: "II", keys: ["mortar", "tesla"] },
    { name: "III", keys: ["rocket"] },
  ],
  vehicles: [
    { name: "II", keys: ["hero_apc", "hero_jeep"] },
    { name: "HERO", keys: ["hero_bison", "hero_mech"] },
  ],
  // the bench's rack, by kind — sandbox only
  foes: [
    { name: "MEN", keys: ["foe_rifle", "foe_rocket", "foe_gren", "foe_sapper", "foe_mortar", "foe_sniper", "foe_mg", "foe_eng", "foe_medic", "foe_mechanic", "foe_davy"] },
    { name: "IRON", keys: ["foe_tank", "foe_bison", "foe_apc", "foe_mech"] },
    { name: "TOWERS", keys: ["foe_t_mg", "foe_t_gun", "foe_t_mortar", "foe_t_rocket", "foe_t_tesla"] },
  ],
};
