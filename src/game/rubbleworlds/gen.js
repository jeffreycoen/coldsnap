// rubbleworlds/gen.js — the demo's seeded builders and its six scenes,
// carved whole. Pure and hashable: same seed and size in, same world out.
import { DT, SF, G, BS, PMASS } from "./phys.js";
function makeRand(seed) { let ri = 0; return () => { const v = Math.sin(seed + (ri++) * 9973) * 43758.5453; return v - Math.floor(v); }; }

// a true sphere of cubes: every lattice cell within R of center. `pitch` is the
// block edge — big worlds use bigger blocks so the count stays payable.
function makePlanet(cx, cz, vx, vz, tint, rand, R = BS * 2.85, mass = PMASS, pitch = BS) {
  const blocks = []; const n = Math.ceil(R / pitch);
  for (let ix = -n; ix <= n; ix++) for (let iy = -n; iy <= n; iy++) for (let iz = -n; iz <= n; iz++) {
    const px = ix * pitch, py = iy * pitch, pz = iz * pitch;
    if (Math.sqrt(px * px + py * py + pz * pz) > R) continue;
    blocks.push({ x: cx + px + (rand() - 0.5), y: py + (rand() - 0.5), z: cz + pz + (rand() - 0.5), vx, vy: 0, vz, tint, alive: true, sleeping: false, clump: -1, s: pitch, cr: pitch * 0.55 });
  }
  for (const b of blocks) b.m = mass / blocks.length;
  return blocks;
}

function buildWelds(blocks) {
  const welds = [];
  for (let i = 0; i < blocks.length; i++) for (let j = i + 1; j < blocks.length; j++) {
    if (blocks[i].tint !== blocks[j].tint) continue;
    const dx = blocks[j].x - blocks[i].x, dy = blocks[j].y - blocks[i].y, dz = blocks[j].z - blocks[i].z;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d < Math.max(blocks[i].s, blocks[j].s) * 1.45) welds.push({ a: i, b: j, rest: d, alive: true, acc: 0 });
  }
  return welds;
}

const SCENES = ["ship", "binary", "duet", "moons", "trio", "system", "hole"];
const SCENE_LABEL = { ship: "SHIP", binary: "TWINS", duet: "DUET", moons: "MOONS", trio: "TRIO", system: "SYSTEM", hole: "HOLE" };
// weld strength per planet size — measured calm loads 17/90/105, same 1.76x margin each
function makeScenario(kind, seed, size = 1) {
  const rand = makeRand(seed);
  const world = { kind, size, blocks: [], welds: [], hole: null, eaten: 0, aggs: [], wells: [], warm: new Map(), t: 0, frame: 0, log: [] };
  // SIZE arm: every planet's radius scales by `size`, its mass by size cubed,
  // and every orbit distance by `size`. The block pitch comes from a budget —
  // more cells for roundness where the scene can pay, bigger cubes where it
  // cannot: a scene carries about 1700 blocks at most, split across planets.
  // SIZE scales the BLOCKS, not the count: pitch grows with the world, so a 5x
  // planet is the same 93 blocks at 5x the cube — performance identical at every
  // size. Finer big-world surfaces wait on the layered-shell experiment: eight
  // mixed-pitch configurations measured 2026-09-11, none stable at the seams.
  const world_mk = (cx, cz, vx, vz, tint, R1, m1) => makePlanet(cx * size, cz * size, vx, vz, tint, rand, R1 * size, m1 * size ** 3, BS * size);
  if (kind === "ship") {
    // THE SHIP: a five-module cross — cabin center, engine aft, a tank each
    // side, nose fore — welded, rigid at any size, and its welds NEVER reform:
    // damage stays damage. It flies the ark's way: aim a burn, spend fuel.
    world.blocks = makePlanet(0, 0, 0, 0, 0, rand);
    const mr = 105 * size, mv = Math.sqrt(G * PMASS * size ** 3 * mr / Math.pow(mr * mr + SF * SF, 1.15));
    world.blocks.push(...makePlanet(mr, 0, 0, mv, 1, rand, BS * 0.9, 80 * size ** 3));
    const sx = -200 * size, sz = 80 * size;
    for (const [ox, oz] of [[0, 0], [-BS, 0], [BS, 0], [0, -BS], [0, BS]]) {
      world.blocks.push({ x: sx + ox, y: 0, z: sz + oz, vx: 0, vy: 0, vz: 0, tint: 2, ship: true, eng: ox === -BS && oz === 0, alive: true, sleeping: false, clump: -1, s: BS, cr: BS * 0.55, m: 120 });
    }
    world.ship = { fuel: 520, max: 520, burns: 0 };
    world.shipPhase = "aim";
    world.gate = { x: 210 * size, z: -90 * size, r: 36, reached: false }; // the ark's ring, absolute radius
    world.span = 260 * size;
  } else if (kind === "binary") {
    const d = 190;
    // half the circular speed for this law — measured headless with the
    // constraint solver: first contact near 14.5 seconds, and the merged
    // world stays bound inside radius ~40 a minute after the meeting
    const dS = d * size, mS = PMASS * size ** 3;
    const vOrb = Math.sqrt(G * mS * dS / Math.pow(2 * dS, 2.3)) * 0.5;
    world.blocks = [
      ...world_mk(-d, 0, 0, -vOrb, 0, BS * 2.85, PMASS),
      ...world_mk(d, 0, 0, vOrb, 1, BS * 2.85, PMASS),
    ];
    world.span = 250 * size;
  } else if (kind === "duet") {
    // a heavy and a light world on the law's own circular speeds around their
    // shared center — measured headless: separation holds 199-201 for three minutes
    const M1 = PMASS * size ** 3, M2 = 1500 * size ** 3, R = 200 * size;
    const d1 = R * M2 / (M1 + M2), d2 = R * M1 / (M1 + M2);
    const v1 = Math.sqrt(G * M2 * d1 / Math.pow(R * R + SF * SF, 1.15));
    const v2 = Math.sqrt(G * M1 * d2 / Math.pow(R * R + SF * SF, 1.15));
    world.blocks = [
      ...world_mk(-d1 / size, 0, 0, -v1, 0, BS * 2.85, PMASS),
      ...world_mk(d2 / size, 0, 0, v2, 1, BS * 1.8, 1500),
    ];
    world.span = 260 * size;
  } else if (kind === "trio") {
    // three equal worlds on a rotating equilateral triangle — the relative
    // equilibrium measured headless (radius band 161-162 for three minutes as
    // points); the blocks' own unevenness is what eventually breaks it
    const L = 280 * size, R2 = L / Math.sqrt(3), mS = PMASS * size ** 3;
    const aC = 2 * G * mS * Math.cos(Math.PI / 6) / Math.pow(L * L + SF * SF, 1.15);
    const vT = Math.sqrt(aC * R2);
    for (let i = 0; i < 3; i++) {
      const th = i * 2 * Math.PI / 3;
      world.blocks.push(...world_mk(Math.cos(th) * R2 / size, Math.sin(th) * R2 / size, -Math.sin(th) * vT, Math.cos(th) * vT, i % 2, BS * 2.85, PMASS));
    }
    world.span = 300 * size;
  } else if (kind === "system") {
    // the mission's own sky: a pinned star, nine light planets on rings, and
    // planet-to-planet gravity at 1% — the ark's law, measured headless:
    // every ring held for three minutes, worst excursion 36%
    world.star = { x: 0, z: 0, m: 40000 * size ** 3, r: 34 * size };
    world.weak = true;
    for (const r of [110, 150, 190, 235, 280, 325, 370, 415, 460]) {
      const rS = r * size, th = rand() * Math.PI * 2;
      const v = Math.sqrt(G * world.star.m * rS / Math.pow(rS * rS + SF * SF, 1.15));
      world.blocks.push(...world_mk(Math.cos(th) * r, Math.sin(th) * r, -Math.sin(th) * v, Math.cos(th) * v, world.blocks.length % 2 === 0 ? 0 : 1, BS * 1.6, 1200));
    }
    world.span = 500 * size;
  } else if (kind === "moons") {
    // three light moons on circular speed, spaced wide so their mutual tug stays
    // small — measured headless: a lone moon holds a 97-101 band for three minutes
    world.blocks = world_mk(0, 0, 0, 0, 0, BS * 2.85, PMASS);
    for (const r of [70, 105, 160]) { // inner moon out to 70: at 60 it wandered inside the planet's no-sleep margin and forbade it to sleep (measured on 0.5.19)
      const rS = r * size, mS = PMASS * size ** 3;
      const v = Math.sqrt(G * mS * rS / Math.pow(rS * rS + SF * SF, 1.15));
      world.blocks.push(...makePlanet(rS, 0, 0, v, 1, rand, BS * 0.9, 80 * size ** 3));
    }
    world.span = 200 * size;
  } else {
    world.hole = { x: 0, z: 0, m: 42000 * size ** 3, killR: 26 * size };
    const px = 240 * size;
    // 53% of circular sits just inside the capture threshold — measured
    // headless with the constraint solver: streaming from 4 seconds,
    // 66 of 93 eaten weldless across two minutes, 51 welded
    const v = Math.sqrt(G * world.hole.m / Math.pow(px, 1.3)) * 0.53;
    world.blocks = world_mk(px / size, 0, 0, v, 0, BS * 2.85, PMASS);
    world.span = 300 * size;
  }
  world.welds = buildWelds(world.blocks);
  world.weldOf = new Map();
  for (const w of world.welds) world.weldOf.set(w.a * 100000 + w.b, w);
  world.log = [];
  return world;
}

// gravity of every source on (x,y,z), skipping index `self`. Under the
// mission law (weak=true) two different clumps pull at 1% — the ark's own
// planet-to-planet rule; the star and the hole always pull at full strength.
export { makeRand, makePlanet, buildWelds, makeScenario, SCENES, SCENE_LABEL };
