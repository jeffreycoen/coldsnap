// COLDSNAP DEPOT — infocards.js (P7.1 T4): the market info cards' data.
// One card per buyable type. Numbers are READ from the live spec tables at
// load — a card can never drift from the gun it describes. The prose is
// owner-approved copy (the task plan carries it verbatim). Pure data.
import { TOWER_SPECS, INFANTRY_ARMS, BISON, APC, MECH, SATCHEL } from "./specs.js";
import { SQUAD_SPECS, squadSpeed } from "./squads.js";

const ORDERS_ARMED = ["DEFEND", "MOVE", "ATTACK", "PATROL", "ATTACK STRUCTURES", "TAKE CONTROL"];
const ORDERS_TOWER = ["CAREFUL / FREE", "TAKE CONTROL", "SELL"];
const ORDERS_HULL = ["DEFEND", "MOVE", "PATROL", "ESCORT", "TRACKS SAFETY", "TAKE CONTROL"];
const dmgOf = (a) => (a && (a.dirDmg != null ? a.dirDmg : a.dmg)) ?? null;
const sq = (type, role, skills, dmg) => {
  const s = SQUAD_SPECS[type], a = INFANTRY_ARMS[type] || null;
  const M = s.member || { hp: 58 };
  return { label: s.label, role, n: s.n, hp: M.hp, dmg: dmg !== undefined ? dmg : dmgOf(a),
    range: a ? a.range : null, speed: squadSpeed(type), skills };
};
const tw = (t, role, skills) => {
  const s = TOWER_SPECS[t];
  return { label: s.label, role, n: null, hp: s.hp, dmg: s.fireRate > 0 ? dmgOf(s) : null,
    range: s.range, speed: null, skills };
};
export const CARDS = {
  mg:     tw("mg", "Fast, cheap, short reach. Chews infantry; useless against stone.", ORDERS_TOWER),
  gun:    tw("gun", "The flat-trajectory workhorse. Cracks men and masonry alike.", ORDERS_TOWER),
  mortar: tw("mortar", "Arcs over walls. Big blast, slow reload.", ORDERS_TOWER),
  rocket: tw("rocket", "A four-rocket salvo, then a long reload. Saturation over precision.", ORDERS_TOWER),
  tesla:  tw("tesla", "Halves their pace in its radius.", ["SELL"]),
  sq_sniper:    sq("sniper", "A marksman and his spotter. The longest rifle on the field; the spotter's binoculars are the farthest eyes.", ORDERS_ARMED),
  sq_rifles:    sq("rifles", "Four riflemen. The working infantry of the line.", ORDERS_ARMED),
  sq_mg:        sq("mg", "A gunner and his loader. Six-round bursts that stop a rush.", ORDERS_ARMED),
  sq_sappers:   sq("sappers", "Two men, two satchel charges. They breach masonry and rarely survive the work. They also lay mines and tripwires.", ["DEFEND", "MOVE", "ATTACK (SATCHELS)", "TAKE CONTROL", "LAY MINES", "LAY WIRES"], SATCHEL.dmg),
  sq_mortars:   sq("mortars", "Two men and a tube. Shells over any wall from a distance.", ORDERS_ARMED),
  sq_engineers: sq("engineers", "Two builders — shovels, not rifles. They lay sandbag and wall lines where you draw them.", ["DEFEND", "MOVE", "ATTACK", "TAKE CONTROL", "BUILD BAGS", "BUILD WALLS"], null),
  sq_rockets:    sq("rockets", "A rocket pair. Slow salvos that crack armor and stone.", ORDERS_ARMED),
  sq_grenadiers: sq("grenadiers", "Four throwers. Short live grenades over the near wall.", ORDERS_ARMED),
  sq_medics:    sq("medics", "Two medics in white, the red cross front and back, a black bag in hand. They walk to the wounded and kneel to treat — no rifle, no fight.", ["DEFEND", "MOVE", "PATROL", "TREAT THE WOUNDED", "TAKE CONTROL"], null),
  sq_mechanics: sq("mechanics", "Two mechanics with a toolbox. They kneel at broken machines and masonry — hulls, towers, walls, bags — and every point of repair is paid in scrap.", ["DEFEND", "MOVE", "PATROL", "REPAIR — PAID IN SCRAP", "TAKE CONTROL"], null),
  sq_davy: sq("davy", "Two men in orange and the smallest atomic weapon ever fielded. The blast spares nobody — outrun it or die with it. Thirty seconds to reload.", ["DEFEND", "MOVE", "ATTACK", "TAKE CONTROL"], 200),
  hero_bison: { label: "BISON", role: "The Bison. Main gun, coax, and tracks that brake for your own. Dear, and dearer to replace.",
    n: null, hp: BISON.hp, dmg: null, range: null, speed: null, skills: ORDERS_HULL },
  hero_apc:   { label: "APC", role: "The transport. Four sealed seats — riders see nothing, fire nothing, and die with the hull.",
    n: null, hp: APC.hp, dmg: null, range: null, speed: null, skills: [...ORDERS_HULL, "LOAD / UNLOAD"] },
  hero_mech: { label: "MECH", role: "The crown machine. A walking siege engine — cannon, rocket salvo, and a saturation barrage; men die under its feet. Slow, dear, and answered only by another.",
    n: null, hp: MECH.hp, dmg: null, range: null, speed: null, skills: ["DEFEND", "MOVE", "PATROL", "ESCORT", "TRACKS SAFETY", "TAKE CONTROL"] },
};
export const cardFor = (key) => CARDS[key] || null;
