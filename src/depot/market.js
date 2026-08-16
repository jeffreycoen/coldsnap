// COLDSNAP DEPOT — market.js: the living market (mk1.13, owner's rulings).
// Every purchasable belongs to a TYPE FAMILY; a family's price is its base
// cost times min(4, 1 + standing/K) — both armies' standing stock counted
// together, one shared table both sides pay. Pure counting and arithmetic:
// no rng, no world mutation, recomputed each second by the game layer.
import { TOWER_SPECS, ENEMY_SPECS, TANK, BISON, APC } from "./specs.js";
import { SQUAD_SPECS } from "./squads.js";

// THE TWO WALLS (mk1.20, owner's rulings): both pressures are the same
// asymptotic wall, wall(n, pole) = pole/(pole - n), clamped at 50x.
// The TYPE wall's pole is twice the type's K — the doubling point stays at
// K exactly as before, but the curve goes vertical approaching 2K (the old
// flat 4x cap is dead). The FIELD wall's pole is 88 living men, both
// armies — just past the mk1.19 ramp's confirmed 80: 11x at the measured
// limit, 22x at 84, 50x beyond. The last slots on the field cost like the
// last seats on the plane. // provisional (F5), every number
export const MARKET_KG = 88;
export const WALL_CLAMP = 50;
// K: the standing count at which a family's price doubles. // provisional (F5)
export const MARKET_K = {
  rifles: 16, marksman: 4, sapper: 4, mortarcrew: 6, mgteam: 6, engineer: 6,
  runner: 12, breaker: 6, tank: 3,
  mgtower: 4, guntower: 4, mortartower: 3, rockettower: 3, frosttower: 4,
  wall: 30, sandbag: 40,
  // P7 T9 (owner): THE HERO TIER — K 1, pole 2. ONE standing hull doubles
  // the price and the curve goes vertical approaching two; with the field
  // wall on top, a second hero while yours lives is absurd — the ruling.
  heroBison: 1, heroApc: 1,
};
const FAMILY_OF_SQUAD = { rifles: "rifles", sniper: "marksman", sappers: "sapper", mortars: "mortarcrew", mg: "mgteam", engineers: "engineer", runners: "runner", breakers: "breaker" };
const FAMILY_OF_TAG = { "": "rifles", sniper: "marksman", sapper: "sapper", gren: "mortarcrew", fast: "runner", heavy: "breaker" };
const FAMILY_OF_TOWER = { mg: "mgtower", gun: "guntower", mortar: "mortartower", rocket: "rockettower", frost: "frosttower" };

// marketCounts(world, squads) -> { family: standing count }. Men for
// infantry families (live bodies), things for the rest. One pass over
// world.bodies plus the squads array; deterministic.
export function marketCounts(world, squads) {
  const c = {};
  const add = (fam, n) => { if (fam) c[fam] = (c[fam] || 0) + n; };
  for (const sq of squads || []) {
    let live = 0;
    for (const id of sq.memberIds) { const u = world.byId.get(id); if (u && u.alive) live++; }
    add(FAMILY_OF_SQUAD[sq.type], live);
  }
  for (const b of world.bodies) {
    if (!b.alive) continue;
    if (b.kind === "unit") c._men = (c._men || 0) + 1; // both armies — squad men are unit bodies too
    if (b.kind === "unit" && b.team === 2) add(FAMILY_OF_TAG[b.tag || ""], 1);
    else if (b.kind === "vehicle" && b.team === 2 && b.tag === "tank") add("tank", 1); // P7 T2: only wave armor prices the tank family
    // P7 T9: THE HERO TIER — one shared market, BOTH teams' standing hulls
    // count into the same family (the wall that makes a second hero absurd
    // has to see both sides' iron).
    else if (b.kind === "vehicle" && b.vtype === "bison") add("heroBison", 1);
    else if (b.kind === "vehicle" && b.vtype === "apc") add("heroApc", 1);
    else if (b.kind === "tower" && b.team === 1) add(FAMILY_OF_TOWER[b.towerType], 1);
    else if (b.kind === "wall" && b.team === 1 && !b.course) add("wall", 1);
    else if (b.kind === "chunk" && b.sandbag) add("sandbag", 1);
  }
  return c;
}

const wall = (n, pole) => {
  const m = Math.min(n, pole - 1); // stay off the pole
  return Math.min(WALL_CLAMP, pole / (pole - m));
};
const priced = (base, fam, counts) =>
  Math.max(1, Math.round(base * wall(counts[fam] || 0, 2 * MARKET_K[fam]) * wall(counts._men || 0, MARKET_KG)));

// computePrices(counts) -> { player: {barKey: price}, foe: {tag: price} } —
// the one shared table, read by the bar, the manifest, every purchase
// commit, the engineer field costs, and the enemy's planWave.
export function computePrices(counts) {
  const player = {};
  for (const k in FAMILY_OF_TOWER) player[k] = priced(TOWER_SPECS[k].cost, FAMILY_OF_TOWER[k], counts);
  for (const t in FAMILY_OF_SQUAD) player["sq_" + t] = priced(SQUAD_SPECS[t].cost, FAMILY_OF_SQUAD[t], counts);
  // P7 T9: THE HERO TIER — one price table, both sides, off the specs' own cost.
  player.hero_bison = priced(BISON.cost, "heroBison", counts);
  player.hero_apc = priced(APC.cost, "heroApc", counts);
  const foe = {};
  for (const t in FAMILY_OF_TAG) foe[t] = priced(ENEMY_SPECS[t].bounty, FAMILY_OF_TAG[t], counts);
  foe.tank = priced(TANK.bounty, "tank", counts);
  foe.hero_bison = priced(BISON.cost, "heroBison", counts);
  foe.hero_apc = priced(APC.cost, "heroApc", counts);
  return { player, foe, counts };
}

// field-piece prices for the engineer lines (wall stacks / bags), same curve.
export function fieldPrices(counts, wallBase, bagBase) {
  return { wall: priced(wallBase, "wall", counts), bag: priced(bagBase, "sandbag", counts) };
}
