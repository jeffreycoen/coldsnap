// src/depot/economy.js — the attacker's books + the book-value verdict.
// Pure state-in/state-out; rng only in makeRegiment (exactly 2 draws).
import { holderAt } from "./territory.js";

const TOWN_PAY = 4; // scrap/scrap per standing building per wave (Task 5 may retune)

// Town pay at stall: every standing (non-ruined) town building pays its
// holder — green ground pays the player scrap, red ground pays the
// attacker's regiment, seam ground pays nobody. `buildings` is DepotGame's
// own buildTown() output ({x, z, ruined}); reused as-is rather than
// duplicated here. Returns the two deltas so the caller (DepotGame.jsx)
// applies them to S.resources / S.reg.scrap — this stays pure/testable.
export function payTown(buildings, T) {
  let player = 0, regiment = 0;
  for (const b of buildings) {
    if (b.ruined) continue;
    const h = holderAt(T, b.x, b.z);
    if (h === 1) player += TOWN_PAY;
    else if (h === 2) regiment += TOWN_PAY;
  }
  return { player, regiment };
}

export function makeRegiment(rng) {
  // seed-varied strength: 300-500 heads, 8-14 tanks; 2 rng draws, always.
  const heads = 300 + Math.floor(rng() * 201);
  const tanks = 8 + Math.floor(rng() * 7);
  return { heads, tanks, heads0: heads, tanks0: tanks, scrap: 60 };
}

export const STIPEND = 90; // mk1.13 (owner): 1 scrap/second × the 90-second bell — the identical clock the player lives on, credited where the regiment spends

export const RESULTS = {
  // uncapped by decision (Jeff)
  structureDmg: 0.06, // scrap per hp of wall/tower damage dealt
  towerKill: 12,
  wallKill: 2,
  buildingKill: 8,
  leak: 10,
};

export function payResults(reg, ev) {
  // ev: {structureDmg, towerKills, wallKills, buildingKills, leaks}
  reg.scrap += ev.structureDmg * RESULTS.structureDmg + ev.towerKills * RESULTS.towerKill
    + ev.wallKills * RESULTS.wallKill + ev.buildingKills * RESULTS.buildingKill + ev.leaks * RESULTS.leak;
}

export function combatIneffective(reg) {
  // attrition victory threshold
  return reg.heads < 0.12 * reg.heads0 && reg.tanks === 0;
}

// bookValue({scrap, assets}) -> number
// Contract: total book value = scrap on hand + assets, where `assets` is a
// single number the CALLER computes ahead of time as
//   assets = Σ over owned builds of (build cost / purchase price)
// i.e. assets is already a total, not a list to reduce here. Kept trivial
// and total on purpose — no per-item bookkeeping lives in this function.
export function bookValue({ scrap, assets }) {
  return scrap + assets;
}
