import { ok } from "./harness.mjs";
import { bootWar } from "../../src/depot/boot.js";
import { tickWar, defaultTickInput, runHash } from "../../src/depot/api.js";
import { worldHash } from "../../src/engine/core.js";
import { fireDavyDown, countAwake, activeWeldCount, ringOfWalls } from "../../src/depot/witness.js";

// ==== 0.6.8: the davy bench ================================================
// Seed rolled each run.
{
  console.log("\n[0.6.8: the davy bench]");
  const SEED = (Date.now() % 1000000) + 1;
  console.log("  fixture seed base", SEED);
  const STEP = 1 / 120;
  const bench = (walls) => {
    const war = bootWar({ seed: SEED, dev: true });
    war.run.started = true;
    const input = defaultTickInput();
    for (let i = 0; i < 120; i++) tickWar(war, STEP, input);
    const t = war.town.reduce((best, b) => (!b.ruined && (!best || b.stones.length > best.stones.length) ? b : best), null);
    const courses = walls ? ringOfWalls(war.world, war.field, t.x, t.z) : [];
    const before = countAwake(war.world);
    const y = fireDavyDown(war.world, war.field, t.x, t.z);
    let boomStep = -1, booms = 0, lost = 0;
    for (let i = 0; i < 120; i++) {
      const { events } = tickWar(war, STEP, input);
      for (const e of events) {
        if (e.type === "boom" && e.weapon === "davy") { booms++; if (boomStep < 0) boomStep = i; }
        if (e.type === "structureLost") lost++;
      }
    }
    return { war, t, y, courses, before, boomStep, booms, lost, after: countAwake(war.world), welds: activeWeldCount(war.world), wh: worldHash(war.world), rh: runHash(war.run) };
  };
  const a = bench(false), b = bench(false), c = bench(true);
  ok("(a) the sandbox boots with a town to burst", a.t != null && a.t.stones.length > 0, a.t ? String(a.t.stones.length) : "no town");
  ok("(b) the round is fired from above the roof", a.y > a.war.field.heightAt(a.t.x, a.t.z) + 1, a.y.toFixed(2));
  ok("(c) one davy burst lands within ten steps", a.booms === 1 && a.boomStep >= 0 && a.boomStep < 10, `${a.booms} at step ${a.boomStep}`);
  ok("(d) the burst wakes stones", a.after.chunks > a.before.chunks && a.after.awake >= a.after.chunks, `${a.before.chunks} -> ${a.after.chunks}`);
  ok("(e) two benches on one seed agree to the bit", a.wh === b.wh && a.rh === b.rh && a.boomStep === b.boomStep && a.after.chunks === b.after.chunks, `${a.wh}/${a.rh} vs ${b.wh}/${b.rh}`);
  ok("(f) the ring of walls stands and falls", c.courses.length === 48 && c.lost > 0, `${c.courses.length} courses, ${c.lost} lost`);
}
