import { ok } from "./harness.mjs";
import { bootWar } from "../../src/depot/boot.js";
import { tickWar, defaultTickInput } from "../../src/depot/api.js";
import { stepWorld, __lists__, __mech__ } from "../../src/engine/core.js";
import { fireDavyDown } from "../../src/depot/witness.js";

// ==== 0.6.10: the live lists ===============================================
// Seed rolled each run. The engine's step walks short lists instead of every
// body and every weld. A rebuild must produce exactly what the full walks
// would visit, in world order; the lists must rebuild when a body wakes and
// stay put when nothing has.
{
  console.log("\n[0.6.10: the live lists]");
  const SEED = (Date.now() % 1000000) + 1;
  console.log("  fixture seed base", SEED);
  const STEP = 1 / 120;
  const war = bootWar({ seed: SEED, dev: true });
  war.run.started = true;
  const input = defaultTickInput();
  for (let i = 0; i < 120; i++) tickWar(war, STEP, input);
  const world = war.world;
  const rebuild = () => { world._blT = -1; world._lwT = -1; __lists__.bodyLists(world); __lists__.liveWelds(world); };
  const equal = (list, want) => {
    if (!list || list.length !== want.length) return false;
    for (let i = 0; i < want.length; i++) if (list[i] !== want[i]) return false;
    return true;
  };
  const massive = (b) => b.invM !== 0;
  const weldsExact = () => equal(world._liveWelds, world.welds.filter((w) => !w.broken && ((w.a.kind === "ice" || w.b.kind === "ice") || !(w.a.sleeping && w.b.sleeping))));
  const bodiesExact = () => equal(world._awake, world.bodies.filter((b) => massive(b) && !b.sleeping))
    && equal(world._file, world.bodies.filter((b) => !((b.sleeping || b.invM === 0) && b._filed)))
    && equal(world._status, world.bodies.filter((b) => massive(b) && !(b.sleeping && (b.kind === "chunk" || b.kind === "tree"))))
    && equal(world._sleepInert, world.bodies.filter((b) => massive(b) && b.sleeping && (b.kind === "chunk" || b.kind === "tree")))
    && equal(world._units, world.bodies.filter((b) => b.kind === "unit"))
    && equal(world._vehicles, world.bodies.filter((b) => b.kind === "vehicle"))
    && equal(world._trees, world.bodies.filter((b) => b.kind === "tree"));
  const n0 = world.bodies.length, w0 = world.welds.length;
  stepWorld(world); rebuild();
  ok("(a) a settled town: a rebuild's live joints are exactly the intact welds with an awake end or ice, in order", weldsExact(), `${world._liveWelds ? world._liveWelds.length : "none"} of ${w0}`);
  ok("(b) a rebuild's body lists are exactly the full walks' visits, in order (the sleeping chunks and trees on their own list)", bodiesExact(), `${world._awake ? world._awake.length : "none"} awake, ${world._status ? world._status.length : "none"} + ${world._sleepInert ? world._sleepInert.length : "none"} of ${n0}, trees ${world._trees ? world._trees.length : "none"}`);
  ok("(c) a quiet step's lists are short against the counts", world._awake && world._awake.length * 4 < n0 && world._liveWelds.length * 4 < w0, `${world._awake ? world._awake.length : "none"} awake of ${n0}, ${world._liveWelds ? world._liveWelds.length : "none"} live of ${w0}`);
  // the stamp: nothing woke, nothing rebuilds; one stone woken by hand, both lists take it in
  const awakeBefore = world._awake.length, liveBefore = world._liveWelds.length, wakesBefore = __lists__.wakes();
  __lists__.bodyLists(world); __lists__.liveWelds(world);
  ok("(d) with no wake the lists stay as they are", world._awake.length === awakeBefore && world._liveWelds.length === liveBefore && __lists__.wakes() === wakesBefore, `${awakeBefore} awake, ${liveBefore} live, counter ${wakesBefore}`);
  const stone = world.bodies.find((b) => b.kind === "chunk" && b.sleeping && (world.weldsOf.get(b.id) || []).some((w) => !w.broken));
  __mech__.wake(stone);
  __lists__.bodyLists(world); __lists__.liveWelds(world);
  const stoneWelds = world.weldsOf.get(stone.id).filter((w) => !w.broken);
  ok("(e) one stone woken by hand moves the counter and enters both lists", __lists__.wakes() === wakesBefore + 1 && world._awake.includes(stone) && !world._sleepInert.includes(stone) && world._status.includes(stone) && stoneWelds.every((w) => world._liveWelds.includes(w)) && bodiesExact() && weldsExact(), `counter ${__lists__.wakes()}, ${stoneWelds.length} joints`);
  // the burst: stones wake mid-step, joints load and break
  const t = war.town.reduce((best, b) => (!b.ruined && (!best || b.stones.length > best.stones.length) ? b : best), null);
  fireDavyDown(world, war.field, t.x, t.z);
  let boomStep = -1;
  for (let i = 0; i < 10 && boomStep < 0; i++) { const n = world.events.length; stepWorld(world); for (let k = n; k < world.events.length; k++) if (world.events[k].type === "boom") boomStep = i; }
  ok("(f) the burst lands within ten steps", boomStep >= 0, `step ${boomStep}`);
  rebuild();
  ok("(g) after the burst step a rebuild is exact with hundreds awake", world._awake.length > 100 && bodiesExact() && weldsExact(), `${world._awake.length} awake, ${world._liveWelds.length} live joints`);
  for (let i = 0; i < 10; i++) stepWorld(world);
  rebuild();
  ok("(h) ten steps on, a rebuild is exact", bodiesExact() && weldsExact(), `${world._awake.length} awake, ${world._liveWelds.length} live joints`);
}
