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

// THE HULLS: the deadweight hangar's eight blueprints, cell for cell from
// docs/superpowers/reference/deadweight-hangar.html. The bridge is the cabin,
// engines and tanks work; every other part rides as a plain hull block —
// weight that can be wounded and torn, its machinery left to later phases.
const HULLS = {
  starter: [["bridge", 0, 0], ["engine", -1, 0], ["pod", 1, 0]],
  courier: [["bridge", 0, 0], ["pod", 1, 0], ["engine", 0, -1], ["engine", 0, 1]],
  longrange: [["bridge", 0, 0], ["engine", -1, 0], ["pod", 1, 0], ["tank", 0, 1], ["tank", 0, -1]],
  hauler: [["bridge", 0, 0], ["engine", -1, 0], ["pod", 1, 0], ["pod", 2, 0], ["pod", 1, -1], ["pod", 1, 1], ["rcs", 2, 1]],
  wingturner: [["bridge", 0, 0], ["engine", -1, 0], ["pod", 1, 0], ["strut", 1, 1], ["strut", 1, 2], ["rcs", 1, 3]],
  gunboat: [["bridge", 0, 0], ["engine", -1, 0], ["pod", 1, 0], ["pod", 1, 1], ["pod", 1, -1], ["mount", 2, 0], ["rack", 2, 1], ["shield", 2, -1]],
  catamaran: [["bridge", 0, 0], ["strut", 0, -1], ["pod", 0, -2], ["engine", -1, -2], ["pod", 1, -2], ["rcs", 2, -2], ["strut", 0, 1], ["pod", 0, 2], ["engine", -1, 2], ["pod", 1, 2], ["rcs", 2, 2]],
  grappler: [["bridge", 0, 0], ["engine", 0, -1], ["engine", 0, 1], ["tank", -1, 0], ["pod", 1, 0], ["pod", 2, 0], ["grapple", 3, 0], ["rcs", 1, 1], ["rcs", 1, -1]],
};
const HULL_LIST = ["starter", "courier", "longrange", "hauler", "wingturner", "gunboat", "catamaran", "grappler"];
const HULL_LABEL = { starter: "STARTER", courier: "COURIER", longrange: "LONG-RANGE", hauler: "HAULER", wingturner: "WING TURNER", gunboat: "GUNBOAT", catamaran: "CATAMARAN", grappler: "GRAPPLER" };
const SCENES = ["ship", "binary", "duet", "moons", "trio", "system", "hole", "map"];
const SCENE_LABEL = { ship: "SHIP", binary: "TWINS", duet: "DUET", moons: "MOONS", trio: "TRIO", system: "SYSTEM", hole: "HOLE", map: "MAP" };
// the flyable ship, appended to any scene: the chosen hull at (sx, sz),
// fuel in the cabin's reserve of 100 plus 210 per tank, aiming from birth.
// Hull blocks stay one block wide at every world size, as they always have.
function addShip(world, hull, sx, sz, scale = 1) {
  const bp = HULLS[hull] || HULLS.longrange;
  let tanks = 0;
  for (const [pt, gx, gy] of bp) {
    if (pt === "tank") tanks++;
    world.blocks.push({ x: sx + gx * BS, y: 0, z: sz + gy * BS, vx: 0, vy: 0, vz: 0, tint: 2, ship: true, eng: pt === "engine", cab: pt === "bridge", tank: pt === "tank", hp: 100, alive: true, sleeping: false, clump: -1, s: BS, cr: BS * 0.55, m: 120 });
  }
  world.ship = { fuel: (100 + 210 * tanks) * scale, max: (100 + 210 * tanks) * scale, burns: 0 };
  world.shipScale = scale; // the map runs at half time, so its ship carries double caps and double fuel: same voyage in real seconds, same share of the tank per burn
  world.shipPhase = "aim";
}
// weld strength per planet size — measured calm loads 17/90/105, same 1.76x margin each
function makeScenario(kind, seed, size = 1, hull = "longrange", shipOn = false) {
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
    // THE SHIP: a deadweight blueprint, welded, rigid at any size, and its
    // welds NEVER reform: damage stays damage. It flies the ark's way: aim a
    // burn, spend fuel. Fuel lives in the cabin's reserve of 100 plus 210 in
    // each tank — the long-range cross keeps its 520.
    world.blocks = makePlanet(0, 0, 0, 0, 0, rand);
    const mr = 105 * size, mv = Math.sqrt(G * PMASS * size ** 3 * mr / Math.pow(mr * mr + SF * SF, 1.15));
    world.blocks.push(...makePlanet(mr, 0, 0, mv, 1, rand, BS * 0.9, 80 * size ** 3));
    addShip(world, hull, -200 * size, 80 * size);
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
  } else if (kind === "map") {
    // THE TRIAD SKY: everything but the two stars rides a rotating triangle.
    // Fourteen triangles on rings around the pinned great star, every one east
    // of it — only the ship is born west, behind the star on the gate line, so
    // the opening move is a slingshot. With all three separations equal, the
    // pull sum points every member exactly at the triple's weight-center with
    // one shared turn rate, whatever the masses — exact under the softened law
    // — so each triangle holds while it rides its ring. Triangle self-spins
    // alternate; every ring ride turns the same way. One hue per triangle,
    // three shades within it; block size follows the cube root of mass. The
    // opening is fixed: the table below is the whole sky.
    const vCirc = (M, r) => Math.sqrt(G * M * r / Math.pow(r * r + SF * SF, 1.15));
    // THE DOUBLED SKY: every length twice what it was — rings, triangle widths,
    // the span, the gate, the caches, the ship's birth point, the stars' kill
    // reach — and every body's mass eight times, because density rides with
    // size: twice the radius is eight times the blocks. The stars instead take
    // 2.46 times their mass — two to the 1.3, the exact factor under this
    // pull law that keeps every speed, the birth burn, and the swing's shape
    // identical at double scale; eight times would trap the ship outright. Only the ship keeps its
    // old size, so the whole world reads twice as large around it.
    const MG = 98500;
    world.span = 1500;
    world.starBodies = [{ x: 0, z: 0, vx: 0, vz: 0, m: MG, r: 80, fam: 0, pin: true }];
    world.fam = { 0: -1 };
    world.hazardFam = 0;
    { const r = 950, a = 25 * Math.PI / 180, v = vCirc(MG, r);
      world.starBodies.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, vx: -Math.sin(a) * v, vz: Math.cos(a) * v, m: 36900, r: 48, fam: 1, pin: false }); world.fam[1] = 0; }
    // [ring, angle degrees, vertex radius, m1, m2, m3, hue degrees, spin]
    // spin +1 turns WITH the ring ride, -1 against it. A prograde spin
    // resonates with the orbit and tears wide or light triangles apart
    // (measured: every breaker in the first cut was prograde, every
    // retrograde held), so prograde goes only to the four outer
    // heavyweights, whose grip affords it.
    const TRIS = [
      [350, 40, 80, 40000, 20000, 7200, 18, -1], [350, -75, 26, 3200, 1200, 640, 250, -1],
      [480, -15, 38, 3200, 1200, 640, 205, -1], [480, 75, 52, 7200, 3200, 1200, 330, -1],
      [600, -30, 96, 40000, 7200, 3200, 32, -1], [600, 55, 68, 5600, 5600, 1200, 95, -1],
      [730, 80, 68, 7200, 5600, 3200, 275, -1], [730, -70, 76, 12800, 3200, 3200, 160, -1],
      [900, 12, 104, 40000, 40000, 3200, 0, 1], [900, -55, 64, 5600, 1200, 640, 220, -1],
      [1100, -40, 72, 12800, 7200, 1200, 145, 1], [1100, 25, 80, 20000, 5600, 3200, 300, -1],
      [1300, 0, 112, 40000, 12800, 12800, 48, 1], [1440, -22, 64, 5600, 3200, 3200, 190, 1],
    ];
    const hsl = (h, sPct, lPct) => { const sat = sPct / 100, li = lPct / 100;
      const f = (n) => { const k = (n + h / 30) % 12; const c = sat * Math.min(li, 1 - li); return Math.round(255 * (li - c * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); };
      return [f(0), f(8), f(4)]; };
    let famN = 2;
    for (let ti = 0; ti < TRIS.length; ti++) {
      const [ring, angD, R2, m1, m2, m3, hue, spin] = TRIS[ti];
      const trip = [m1, m2, m3], M = m1 + m2 + m3, a = angD * Math.PI / 180;
      const bx = Math.cos(a) * ring, bz = Math.sin(a) * ring; // the weight-center rides the ring
      const vR = vCirc(MG, ring), rvx = -Math.sin(a) * vR, rvz = Math.cos(a) * vR; // every ring ride turns the same way
      const L = R2 * Math.sqrt(3);
      const om = Math.sqrt(G * M / Math.pow(L * L + SF * SF, 1.65)) * spin; // the table's spin: mixed, prograde only where the grip affords it
      // vertices on a circle about a geometric center shifted so the mass-weighted mean lands exactly on the ring point
      const raw = [0, 1, 2].map(i => { const th = i * 2 * Math.PI / 3 + ring + angD; return [Math.cos(th) * R2, Math.sin(th) * R2]; });
      let ox = 0, oz = 0; for (let i = 0; i < 3; i++) { ox += raw[i][0] * trip[i] / M; oz += raw[i][1] * trip[i] / M; }
      const tf = famN++; world.fam[tf] = 0;
      for (let i = 0; i < 3; i++) {
        const px = bx + raw[i][0] - ox, pz = bz + raw[i][1] - oz;
        const vx = rvx - (pz - bz) * om, vz = rvz + (px - bx) * om; // ring ride plus the spin about the weight-center
        const blocks = makePlanet(px, pz, vx, vz, ti % 2, rand, BS * 2.2 * Math.cbrt(trip[i] / 3200), trip[i]);
        const rgb = hsl(hue, 38 + i * 9, [62, 48, 38][i]);
        for (const b of blocks) { b.fam = tf; b.rgb = rgb; }
        world.blocks.push(...blocks);
      }
    }
    world.pickups = [{ x: 300, z: -380, fuel: 300, alive: true }, { x: 840, z: -240, fuel: 300, alive: true }, { x: 1200, z: -500, fuel: 300, alive: true }];
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
  if (shipOn && kind !== "ship" && kind !== "map") addShip(world, hull, -world.span * 0.77, world.span * 0.31);
  if (kind === "map") { addShip(world, hull, -220, 70, 2); world.birthAim = 80 * world.shipScale; world.birthDir = [0.3011, 0.9535]; world.gate = { x: world.span * 0.95, z: -world.span * 0.3, r: 72, reached: false }; } // born behind the great star at double distance; the star mass is scaled so the same tangent at 160 flies the same swing, twice as large
  world.welds = buildWelds(world.blocks);
  world.weldOf = new Map();
  for (const w of world.welds) world.weldOf.set(w.a * 100000 + w.b, w);
  world.log = [];
  return world;
}

// gravity of every source on (x,y,z), skipping index `self`. Under the
// mission law (weak=true) two different clumps pull at 1% — the ark's own
// planet-to-planet rule; the star and the hole always pull at full strength.
export { makeRand, makePlanet, buildWelds, makeScenario, SCENES, SCENE_LABEL, HULLS, HULL_LIST, HULL_LABEL };
