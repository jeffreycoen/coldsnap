// COLDSNAP DEPOT — lists.js: typed body sub-lists for the hot scans.
// ONE pass per frame (DepotGame's frame loop, before the sim catch-up loop)
// filters world.bodies into per-predicate pools; every hot scan iterates its
// pool instead of the whole body array. THE CONTRACT: a pool narrows the
// CANDIDATE set by properties fixed for a body's lifetime (kind, team, town
// tag, mass class) — every consumer KEEPS its full original predicate (alive,
// range, sight, arc), so a body that dies mid-tick is skipped exactly as the
// full scan skipped it. Pool order is world.bodies order (one forward pass,
// never sorted), so every scan visits candidates in the order it always did
// — identical picks, identical ties. A body ADDED mid-tick (a laid sandbag, a
// dropped course's rubble) joins the pools on the next tick — an accepted
// one-tick (8ms) delta, stated in the phase plan. No rng. Fixtures that never
// build lists fall back to world.bodies at every consumer (world._L absent).
import { DEAD_TEAM, PERSON } from "./specs.js";
const SOLID_KINDS = new Set(["rock", "wall", "tower", "tree", "chunk"]);

export function makeBodyLists() {
  return { solids: [], statics: [], friends: [], foes: [], structsFor1: [], structsFor2: [], friendly: [], vehicles: [], people: [], units: [] };
}

// structsFor1/structsFor2: hostileStructure(b, team)'s candidate sets — what
// team 1 / team 2 shooters may treat as enemy STRUCTURE targets (state.js).
// friendly: friendlyBlocksPoint's careful-fire set (state.js) — the residual
// invM check stays in the consumer.
export function rebuildBodyLists(world, L) {
  L.solids.length = 0; L.statics.length = 0;
  L.friends.length = 0; L.foes.length = 0; L.vehicles.length = 0;
  L.structsFor1.length = 0; L.structsFor2.length = 0; L.friendly.length = 0; L.people.length = 0; L.units.length = 0;
  for (const b of world.bodies) {
    if (!b.alive) continue;
    const k = b.kind;
    if (k === "unit" || k === "vehicle" || k === "mech") {
      // P7 T12: hulls get their own small pool — slotBlocked's hull test
      // (squads.js) reads it; the statics pool can never carry one (dynamic).
      if (k === "vehicle" || k === "mech") L.vehicles.push(b);
      if (k === "unit") L.units.push(b); // 0.6.5: every living unit, world order — the dead's searches and the people's read this
      // 0.6.1: the dead ride BOTH side pools — each army's scans find them
      // in the pool it already reads; the consumers' own predicates decide.
      if (b.team === 1 || b.team === DEAD_TEAM) L.friends.push(b);
      if (b.team === 2 || b.team === DEAD_TEAM) L.foes.push(b);
      if (b.tag === PERSON.tag) L.people.push(b); // 0.6.2: CAREFUL's people check reads this
      continue;
    }
    if (!SOLID_KINDS.has(k)) continue;
    // solidBlocksPoint/bracedAt's kind-not-mobility rule (accuracy.js)
    if (!(b.invM > 0 && k !== "chunk" && k !== "tree")) L.solids.push(b);
    // exposureAt/slotBlocked/losGraze's strictly-static rule (squads.js)
    if (b.invM === 0) L.statics.push(b);
    if (k === "wall" || k === "tower") {
      if (b.team === 2) L.structsFor1.push(b);                       // F3-ready
      else if (b.team === 1) { L.structsFor2.push(b); L.friendly.push(b); }
    } else if (k === "chunk") {
      if (b.town === "depot2") L.structsFor1.push(b);
      else if (b.town === "depot") L.structsFor2.push(b);
      if (b.team === 0 && b.town !== "depot2") L.friendly.push(b);
    }
  }
  world._L = L;
}
