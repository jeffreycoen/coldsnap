// COLDSNAP DEPOT — cards.js: THE CARD REGISTRY (Task 1, mk2.39). One home
// for every card the game shows. CARDS is the market's nineteen (moved
// verbatim from infocards.js, which now re-exports from here); TEACH is the
// teaching table — empty until Task 2 writes the owner-ruled copy. Numbers
// are READ from the live spec tables at load — a card can never drift from
// the gun it describes. Pure data.
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
  tesla:  tw("tesla", "Chain lightning. Strikes one, then arcs to everything near — friend, foe, stone, or water.", ORDERS_TOWER),
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
// TEACH — the teaching cards (Task 2, owner-ruled copy — do not edit a word
// without a ruling). label/role/skills is InfoCard's own contract; roleTouch
// is the phone voice where the controls differ; desktopOnly marks the one
// card phones never see. Tasks 3/4/7 serve these; nothing reads them yet.
export const TEACH = {
  the_hand: { label: "THE HAND YOU'RE DEALT", role: "Every war opens with seven dealt cards — units and plans together. Pick five, free. Units place by your hand near the depot; plans open your build bar. The enemy drafts five of its own.", skills: [] },
  placing: { label: "PLACING YOUR MEN", role: "Tap ground near your depot to set a ghost. ✓ fields it, ✗ puts it back. The green wash is where you may place. Each pick shows its card first.", skills: [] },
  scrap: { label: "SCRAP", role: "Scrap is the till. One scrap a second, both sides, always. Kills pay more. Everything the convoy sells is paid in scrap.", skills: [] },
  bell: { label: "THE BELL", role: "Every 90 seconds the bell rings and the convoy shows its hand — plans you buy once and build from after, hires that walk on at once. The war is saved at every bell.", skills: [] },
  kill_price: { label: "THE SCORE", role: "Every death is priced at its live market value the moment it falls. Yours in green, the enemy's in red — kills, then value destroyed.", skills: [] },
  convoy: { label: "THE CONVOY", role: "The war pauses while the window is up. Plans cost half and open your build bar; hires field at once by your tap. LATER parks the offer on the top bar until the next bell rewrites it.", skills: [] },
  fog: { label: "SIGHT AND FOG", role: "Men are your eyes — what your side can't see, you can't shoot. This switch only paints the fog; the guns obey sight either way.", skills: [] },
  wind: { label: "WIND", role: "One wind over the whole field. Every shot drifts with it, yours and theirs alike. OFF is dead calm for both sides.", skills: [] },
  spare_ours: { label: "SPARE OURS", role: "With this on, the tesla coil and the atomic crew hold fire while one of your own stands in the blast. Off, they fire regardless.", skills: [] },
  market: { label: "THE MARKET", role: "One market, both armies. What the field is full of costs more. Prices move by the second, and the market paces you — one purchase a second. Buy out what they need before they can.", skills: [] },
  sell: { label: "SELLING", role: "Sell returns 60 percent. Tap SELL, then the tower or wall. A tower's own ring offers SELL too.", skills: [] },
  defend: { label: "DEFEND", role: "Dig in where they stand. They hold the ground, fight what comes, and shuffle to the best nearby stand.", skills: [] },
  move: { label: "MOVE", role: "Tap the ground; they walk there without picking fights on the way. Open water takes no orders — find the crossing.", skills: [] },
  attack: { label: "ATTACK", role: "Tap the ground; they fight their way there, halting to engage whatever they see in reach.", skills: [] },
  possess_squad: { label: "TAKE CONTROL — SQUADS", role: "WASD walks the squad; the mouse carries the aim; hold the left button to fire. The reticle lives inside their own sight. RELEASE hands them back — they dig in where you leave them.", roleTouch: "The left stick walks; the right stick steers the aim; hold FIRE to volley. Tap ground to jump the reticle. RELEASE hands them back — they dig in where you leave them.", skills: [] },
  select_all: { label: "SELECT ALL", role: "Every squad of this type joins the order. One-squad results collapse back to the one.", skills: [] },
  patrol: { label: "PATROL", role: "Two taps set the route — start, then far end. ✓ and they walk it forever, fighting what they see.", skills: [] },
  structures: { label: "ATTACK STRUCTURES", role: "A toggle. On, this squad prefers walls and towers over men.", skills: [] },
  engineer_lines: { label: "THE ENGINEER LINES", role: "BAGS or WALLS, then two taps — start and far end. The ghost line shows every piece and the price. ✓ and they walk the line, laying as scrap allows.", skills: [] },
  sapper_lines: { label: "MINES AND WIRES", role: "The engineer's two taps, buried. Yours are invisible to them; theirs to you — always. A tripwire's flare lights the fog. A mine just waits.", skills: [] },
  discipline: { label: "CAREFUL AND FREE", role: "CAREFUL holds a tower's trigger when the shot would foul your own wall, tower, or depot stone. FREE fires regardless.", skills: [] },
  possess_tower: { label: "TAKE CONTROL — TOWERS", role: "The mouse carries the aim; hold the left button to fire. No walking — a tower stands. Your trigger, your responsibility: CAREFUL does not hold it for you.", roleTouch: "The right stick steers the aim; hold FIRE. No walking — a tower stands. Your trigger, your responsibility.", skills: [] },
  escort: { label: "ESCORT", role: "Tap a squad; the hull shadows it wherever it goes.", skills: [] },
  tracks: { label: "TRACKS", role: "CAREFUL brakes for your own men. FREE takes the safety off — the tracks are a weapon then, both ways.", skills: [] },
  possess_vehicle: { label: "TAKE CONTROL — ARMOR", role: "WASD drives; the mouse aims the turret; the left button fires the main gun, the right button streams the coax. The APC carries one gun — FIRE alone.", roleTouch: "The left stick drives; the right stick aims; FIRE for the main gun, MG for the coax. The APC carries one gun — FIRE alone.", skills: [] },
  possess_mech: { label: "TAKE CONTROL — THE MECH", role: "WASD walks it; A and D turn — hold for the hard pivot. The mouse sets aim and range. Hold the left button to fire; V missiles, B barrage, C punt, T about-face.", roleTouch: "The left stick walks; the right stick turns — hard over pivots. The slider sets range, ◀ ▶ trim the aim. FIRE, MSL, BRG, PUNT.", skills: [] },
  load: { label: "LOAD AND UNLOAD", role: "LOAD: tap a squad; they walk to the ramp and board. Four sealed seats — riders see nothing, fire nothing, and die with the hull. UNLOAD drops the ramp.", skills: [] },
  desktop_keys: { label: "THE KEYS", role: "WASD pans. Q and E rotate — tap snaps a quarter turn, hold swings. The wheel zooms. M mutes. ESC leaves for the menu. Possessed, WASD drives and the mouse aims and fires.", desktopOnly: true, skills: [] },
};
export const cardFor = (key) => TEACH[key] || CARDS[key] || null;
