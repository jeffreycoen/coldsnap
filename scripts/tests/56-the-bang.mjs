import { ok } from "./harness.mjs";
import { bootWar } from "../../src/depot/boot.js";
import { tickWar, defaultTickInput } from "../../src/depot/api.js";
import { __bang__, __mech__, worldHash } from "../../src/engine/core.js";
import { fireDavyUp } from "../../src/depot/witness.js";
import { computeFlowField } from "../../src/depot/mapgen.js";

// ==== 0.6.11: the bang =====================================================
// Seed rolled each run. The burst's shadow test walks a grid instead of every
// occluder; a davy round watched aloft brings its frozen bodies' hits
// precounted; the road map is redrawn once a tick. Each must give the old
// answer to the bit.
{
  console.log("\n[0.6.11: the bang]");
  const SEED = (Date.now() % 1000000) + 1;
  console.log("  fixture seed base", SEED);
  const STEP = 1 / 120;
  const { v3, V } = __mech__;
  const { shadowState, shadowOf, shadowFile, shadowAlong, segBoxHit, occluderInDisc, aloft, served } = __bang__;
  const spec = { r: 25, kv: 40, dmg: 200, crater: 10, kind: "shell", weapon: "davy", noImpact: true, hitStruct: true, windF: 0.04 };
  // the old test, verbatim: every occluder in the disc, three rays, the chord
  const oldShadow = (world, x, y, z, b, dist) => {
    const c = v3(x, y, z), oR = spec.r + 8, occluders = [];
    for (const o of world.bodies) {
      if (o.kind === "unit") continue;
      if (!o.alive && o.kind !== "wreck") continue;
      if (Math.max(o.hx, o.hy, o.hz) < 0.25) continue;
      const dox = o.pos.x - x, doz = o.pos.z - z;
      if (dox * dox + doz * doz > oR * oR) continue;
      occluders.push(o);
    }
    if (dist < 1.1) return 1;
    const px = -(b.pos.z - z), pz = (b.pos.x - x);
    const pl = Math.hypot(px, pz) || 1;
    const off = 0.22 * Math.min(1, dist / 2);
    let sum = 0;
    for (let ray = -1; ray <= 1; ray++) {
      const tx = b.pos.x + (px / pl) * off * ray, tz = b.pos.z + (pz / pl) * off * ray;
      const tgt = v3(tx, b.pos.y, tz);
      let occ = 1;
      for (const o of occluders) {
        if (o === b) continue;
        if (b.kind === "ice" && o.kind === "ice") continue;
        const t = segBoxHit(c, tgt, o);
        if (t > 0.03 && t < 0.97) { occ *= 0.35; if (occ < 0.09) { occ = 0.09; break; } }
      }
      for (let k = 2; k <= 4; k++) {
        const t = k / 5;
        if (world.field.heightAt(x + (tx - x) * t, z + (tz - z) * t) > y + (b.pos.y - y) * t + 0.4) { occ *= 0.3; break; }
      }
      sum += occ;
    }
    return sum / 3;
  };
  // the old loop's targets, in order
  const oldTargets = (world, c) => world.bodies.filter((b) => b.invM !== 0 && !(!b.alive && b.kind === "unit") && !(Math.max(0.4, V.len(V.sub(v3(), b.pos, c))) > spec.r + Math.max(b.hx, b.hy, b.hz)));
  const input = defaultTickInput();
  const boot = () => { const w = bootWar({ seed: SEED, dev: true }); w.run.started = true; for (let i = 0; i < 120; i++) tickWar(w, STEP, input); return w; };
  const war = boot();
  const world = war.world;
  const town = war.town.reduce((best, b) => (!b.ruined && (!best || b.stones.length > best.stones.length) ? b : best), null);
  // (a) along a hundred rays from a point over the town, the grid's cells list every body the full scan hits
  {
    const all = world.bodies.filter((o) => o.kind !== "unit" && Math.max(o.hx, o.hy, o.hz) >= 0.25);
    const grid = new Map();
    all.forEach((o, i) => shadowFile(grid, o, i));
    const stamp = new Uint32Array(all.length);
    const c = v3(town.x, world.field.heightAt(town.x, town.z) + 3, town.z);
    let rays = 0, missed = 0, cands = 0, hitsAll = 0;
    for (const b of all) {
      if (rays >= 100) break;
      if (Math.hypot(b.pos.x - c.x, b.pos.z - c.z) > 25) continue;
      rays++;
      const cand = []; shadowAlong(grid, stamp, rays, c.x, c.z, b.pos.x, b.pos.z, cand);
      cands += cand.length;
      const got = new Set(cand.map((i) => all[i]));
      const px = -(b.pos.z - c.z), pz = (b.pos.x - c.x), pl = Math.hypot(px, pz) || 1;
      for (let ray = -1; ray <= 1; ray++) {
        const tgt = v3(b.pos.x + (px / pl) * 0.22 * ray, b.pos.y, b.pos.z + (pz / pl) * 0.22 * ray);
        for (const o of all) { if (o === b) continue; const t = segBoxHit(c, tgt, o); if (t > 0.03 && t < 0.97) { hitsAll++; if (!got.has(o)) missed++; } }
      }
    }
    ok("(a) along a hundred rays the grid's cells list every body the full scan hits", rays === 100 && missed === 0 && hitsAll > 0, `${rays} rays, ${hitsAll} hits, ${missed} missed, ${(cands / Math.max(1, rays)).toFixed(0)} candidates a ray of ${all.length}`);
  }
  // (b) the shadow of every target of a burst over the town, grid against the full scan, to the bit
  {
    const x = town.x, z = town.z, y = world.field.heightAt(x, z) + 2.5, c = v3(x, y, z);
    const S = shadowState(world, x, y, z, spec);
    const want = oldTargets(world, c);
    // the walk's list is a superset the loop's own distance test trims; trimmed, it is the old loop's list in order
    const trimmed = S.targets.filter((b) => !(Math.max(0.4, V.len(V.sub(v3(), b.pos, c))) > spec.r + Math.max(b.hx, b.hy, b.hz)));
    const same = trimmed.length === want.length && trimmed.every((b, i) => b === want[i]);
    let n = 0, diff = 0, shaded = 0;
    for (const b of want) {
      const dist = Math.max(0.4, V.len(V.sub(v3(), b.pos, c)));
      const a = shadowOf(world, S, b, dist), o = oldShadow(world, x, y, z, b, dist);
      n++; if (a !== o) diff++; if (o < 1) shaded++;
    }
    ok("(b) every target of a burst over the town gets the full scan's shadow to the bit, and the walk's targets, trimmed by the loop's own test, are the old loop's in order", same && diff === 0 && n > 100 && shaded > 10, `${n} targets (${S.targets.length} walked), ${shaded} shaded, ${diff} differ, lists ${same ? "same" : "DIFFER"}`);
  }
  // (c) a lofted round: the watch takes the frozen bodies, its ghost lands, and the round bursts exactly where the ghost did
  const tickUntil = (w, pred, max) => { let k = 0; while (k < max && !pred()) { tickWar(w, STEP, input); k++; } return k; };
  fireDavyUp(world, war.field, town.x, town.z, 3);
  tickWar(war, STEP, input);
  const ep = aloft(world);
  const flew = tickUntil(war, () => aloft(world) === null || aloft(world).landed, 30);
  const landed = aloft(world) !== null && aloft(world).landed;
  const frozenN = landed ? ep.list.length : 0, frozenSleepers = landed ? ep.list.filter((b) => b.sleeping).length : 0;
  const pred = landed ? { x: aloft(world).bx, y: aloft(world).by, z: aloft(world).bz } : null;
  ok("(c) the watch starts on the lofted round, files the still bodies over a few ticks, and its ghost lands within thirty", ep !== null && landed && frozenN > 1000 && ep.list.every((b) => b.kind !== "unit" && !b.mechRef && (b.sleeping || b.invM === 0)), `${frozenN} frozen (${frozenSleepers} asleep), ghost flew ${flew} ticks, landed ${landed}`);
  // (d) the precount, once it is done, matches a count by hand over the frozen list
  tickUntil(war, () => aloft(world) === null || (aloft(world).targets !== null && aloft(world).next >= aloft(world).targets.length), 400);
  let counted = 0, wrong = 0;
  if (aloft(world) !== null) {
    const e = aloft(world), x = e.bx, y = e.by, z = e.bz, c = v3(x, y, z), oR = spec.r + 8;
    for (const [b, packed] of e.hits) {
      counted++;
      const dist = Math.max(0.4, V.len(V.sub(v3(), b.pos, c)));
      const px = -(b.pos.z - z), pz = (b.pos.x - x), pl = Math.hypot(px, pz) || 1, off = 0.22 * Math.min(1, dist / 2);
      let want = 0;
      for (let ray = -1; ray <= 1; ray++) {
        const tx = b.pos.x + (px / pl) * off * ray, tz = b.pos.z + (pz / pl) * off * ray, tgt = v3(tx, b.pos.y, tz);
        let hits = 0;
        for (const o of e.list) { if (hits >= 3) break; if (!occluderInDisc(o, x, z, oR) || o === b || (b.kind === "ice" && o.kind === "ice")) continue; const t = segBoxHit(c, tgt, o); if (t > 0.03 && t < 0.97) hits++; }
        let above = 0;
        for (let k = 2; k <= 4; k++) { const t = k / 5; if (world.field.heightAt(x + (tx - x) * t, z + (tz - z) * t) > y + (b.pos.y - y) * t + 0.4) { above = 1; break; } }
        want |= (hits << ((ray + 1) * 2)) | (above << (7 + ray));
      }
      if (want !== packed) wrong++;
    }
  }
  ok("(d) the precounted hits of every frozen target match a count by hand", counted > 100 && wrong === 0, `${counted} counted, ${wrong} wrong`);
  // the burst (tickWar drains the events and returns them)
  const tickBoom = (w, max) => { for (let k = 0; k < max; k++) { const { events } = tickWar(w, STEP, input); for (const e of events) if (e.type === "boom" && e.weapon === "davy") return e; } return null; };
  const served0 = served();
  const boom = tickBoom(war, 600);
  const burstTick = boom !== null;
  ok("(c') the round bursts where the ghost said, to the bit, and the watch's counts serve", burstTick && pred !== null && boom.x === pred.x && boom.y === pred.y && boom.z === pred.z && aloft(world) === null && served() === served0 + 1, boom ? `burst at ${boom.x.toFixed(3)}, ${boom.y.toFixed(3)}, ${boom.z.toFixed(3)}; predicted ${pred ? pred.x.toFixed(3) + ", " + pred.y.toFixed(3) + ", " + pred.z.toFixed(3) : "none"}` : "no burst within 600 ticks");
  // (e) the road map: the burst's collapses raise the flag; each tick's start redraws the map once; the first tick that
  // ends with the flag down (nothing fell in it) holds the map a fresh redraw would give
  const flagged = war.clock._flowDirty === true;
  const settled = tickUntil(war, () => war.clock._flowDirty === false, 1200);
  const cleared = war.clock._flowDirty === false;
  const cells = war.grid.cells, snap = cells.map((c) => [c.dist, c.dx, c.dz]);
  const og = war.grid.worldToGrid(war.map.OBJ_POS.x, war.map.OBJ_POS.z);
  computeFlowField(war.grid, og.gx, og.gz);
  let mapDiff = 0;
  for (let i = 0; i < cells.length; i++) if (cells[i].dist !== snap[i][0] || cells[i].dx !== snap[i][1] || cells[i].dz !== snap[i][2]) mapDiff++;
  ok("(e) the burst raises the road map's flag; the first quiet tick after the collapses leaves the map a fresh redraw would leave", flagged && cleared && mapDiff === 0, `flag ${flagged}, down after ${settled} ticks, ${mapDiff} cells differ of ${cells.length}`);
  // (f) the whole run to the bit: two fresh worlds on the same seed fire the same lofted round, one after the other (the
  // watch is one at a time); the first keeps its watch (the counts serve at the burst), the second drops it once the
  // ghost has landed (the burst tests everything itself)
  {
    const pick = (w) => w.town.reduce((best, b) => (!b.ruined && (!best || b.stones.length > best.stones.length) ? b : best), null);
    const run = (drop) => {
      const w = boot(), t = pick(w);
      let draws = 0;
      const r = w.world.rng; w.world.rng = () => { draws++; return r(); };
      fireDavyUp(w.world, w.field, t.x, t.z, 3);
      const flew = tickUntil(w, () => aloft(w.world) !== null && aloft(w.world).landed, 30);
      const landed = aloft(w.world) !== null && aloft(w.world).landed;
      if (drop) { w.world._aloft = null; w.world._windAt = null; } // dropped, and no new watch on the round still flying
      const s0 = served();
      const b = tickBoom(w, 600);
      const servedHere = served() === s0 + 1;
      for (let i = 0; i < 480; i++) tickWar(w, STEP, input);
      return { flew, landed, burst: b !== null, servedHere, hash: worldHash(w.world), draws };
    };
    const A = run(false), B = run(true);
    const kept = A.landed && A.burst && A.servedHere, dropped = B.landed && B.burst && !B.servedHere && A.flew === B.flew;
    const consumed = true;
    const h1 = A.hash, h2 = B.hash, d1 = A.draws, d2 = B.draws;
    ok("(f) a twin world with its watch dropped runs the same burst and the four seconds after it to the same hash and draw count", kept && dropped && consumed && h1 === h2 && d1 === d2 && d1 > 0, `hash ${h1} / ${h2}, draws ${d1} / ${d2}, watch kept and served ${kept && consumed}, dropped ${dropped}`);
  }
  // (g) the burst's own loop kills trees as it goes; an occluder killed before a later target's turn still shades it, as the
  // old test's one list did — served from the watch or not
  {
    const w = boot(), wd = w.world;
    const tw = w.town.reduce((best, b) => (!b.ruined && (!best || b.stones.length > best.stones.length) ? b : best), null);
    fireDavyUp(wd, w.field, tw.x, tw.z, 3);
    tickUntil(w, () => aloft(wd) !== null && aloft(wd).landed, 30);
    tickUntil(w, () => aloft(wd) === null || (aloft(wd).targets !== null && aloft(wd).next >= aloft(wd).targets.length), 400);
    const e = aloft(wd), x = e.bx, y = e.by, z = e.bz, c = v3(x, y, z), oR = spec.r + 8;
    // a frozen target and a body that shades it, whose death would change the target's shadow
    let tgt = null, occ = null, before = 0;
    for (const b of e.targets) {
      const dist = Math.max(0.4, V.len(V.sub(v3(), b.pos, c)));
      if (dist < 1.1) continue;
      const px = -(b.pos.z - z), pz = (b.pos.x - x), pl = Math.hypot(px, pz) || 1, off = 0.22 * Math.min(1, dist / 2);
      const was = oldShadow(wd, x, y, z, b, dist);
      for (let ray = -1; ray <= 1 && !occ; ray++) {
        const t3 = v3(b.pos.x + (px / pl) * off * ray, b.pos.y, b.pos.z + (pz / pl) * off * ray);
        for (const o of wd.bodies) {
          if (o === b || o.kind === "unit" || o.kind === "wreck" || !o.alive || Math.max(o.hx, o.hy, o.hz) < 0.25) continue;
          const dox = o.pos.x - x, doz = o.pos.z - z; if (dox * dox + doz * doz > oR * oR) continue;
          const t = segBoxHit(c, t3, o); if (!(t > 0.03 && t < 0.97)) continue;
          o.alive = false; const without = oldShadow(wd, x, y, z, b, dist); o.alive = true;
          if (without !== was) { occ = o; break; }
        }
      }
      if (occ) { tgt = b; before = was; break; }
    }
    const dist = Math.max(0.4, V.len(V.sub(v3(), tgt.pos, c)));
    const S = shadowState(wd, x, y, z, e.spec); // the watch serves this state (its own round's spec)
    const S2 = shadowState(wd, x, y, z, e.spec); // the watch is spent: a plain state, built at the same moment
    occ.alive = false; // killed, as the loop kills a tree before the next target's turn
    const servedNow = shadowOf(wd, S, tgt, dist), plainNow = shadowOf(wd, S2, tgt, dist), oldNow = oldShadow(wd, x, y, z, tgt, dist);
    occ.alive = true;
    ok("(g) an occluder killed during the burst's loop still shades the targets after it, served from the watch or not", S.ep !== null && S2.ep === null && servedNow === before && plainNow === before && oldNow !== before, `served ${servedNow}, plain ${plainNow}, before the kill ${before}, a list built after it ${oldNow}; occluder ${occ.kind} ${occ.id}`);
  }
}
