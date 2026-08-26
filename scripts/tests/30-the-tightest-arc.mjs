// COLDSNAP suite era 30 — THE TIGHTEST ARC (mk2.56). The gun chooses charge
// and angle TOGETHER to land the tightest group on the aim (owner,
// 2026-08-25): accuracy at short lobs comes from firing weakly. The law
// covers the Bison's gun, both mortars, and both rockets, both sides; the
// propellant varies on every round (a bounded third draw). No seed is
// special; fixture seeds are named below.
import { ok } from "./harness.mjs";
import { readFileSync } from "node:fs";
import { makeWorld, addBody } from "../../src/engine/core.js";
import { shooterFire } from "../../src/depot/state.js";
import { tightSolve, rangeSigma, predictRing, CHARGE_CAP, SCATTER_CAP } from "../../src/depot/accuracy.js";
import { BISON_FIRE, TOWER_SPECS, ENEMY_FIRE, INFANTRY_ARMS, DAVY_FIRE } from "../../src/depot/specs.js";

const src = (p) => readFileSync(new URL("../../" + p, import.meta.url), "utf8");
const DEG = Math.PI / 180;
const flatF = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (x, z, o) => { o.x = 0; o.y = 1; o.z = 0; return o; } };
const idUV = (x, z) => ({ u: x, v: z });
const M = { x: 0, y: 2.97, z: 0 };
const mkSG = () => { const N = 64; return { nx: N, nz: N, cs: 2, halfU: N, halfV: N, gnd: new Float32Array(N * N), occ: new Float32Array(N * N).fill(-Infinity) }; };
const muzzles = (w) => w.events.filter((ev) => ev.type === "muzzle" && ev.kind === "shell");

// T1 — the dials: six rows carry the solver (elevCap 85, chargeSig 0.01),
// both sides' mirrors equal; the Davy and the wave tank carry none.
{
  const rows = [BISON_FIRE.gun, TOWER_SPECS.mortar, TOWER_SPECS.rocket, INFANTRY_ARMS.mortars, INFANTRY_ARMS.rockets, ENEMY_FIRE.lob];
  ok("T1: the six solved guns carry elevCap 85 and chargeSig 0.01",
    rows.every((r) => r.elevCap === 85 && r.chargeSig === 0.01));
  ok("T1: mirrors equal — the grenadier's lob wears the mortar team's dials, aim fully equal",
    ENEMY_FIRE.lob.chargeSig === INFANTRY_ARMS.mortars.chargeSig && ENEMY_FIRE.lob.elevCap === INFANTRY_ARMS.mortars.elevCap);
  ok("T1: the Davy and the wave tank stay off the solver",
    DAVY_FIRE.chargeSig === undefined && ENEMY_FIRE.tank.chargeSig === undefined && TOWER_SPECS.gun.chargeSig === undefined);
}

// T2 — the choice: on clear ground the Bison fires a gentle reduced-charge
// arc near 40°, and its score beats the flat root's; behind the 4 m
// building the pick stays lawful and tight.
{
  const w = makeWorld({ field: flatF, seed: 301 });
  const t = tightSolve(w, M, { x: 20, y: 0, z: 0 }, BISON_FIRE.gun, 0);
  ok("T2: clear 20 m — a gentle arc (30-50°) at a small charge (seed 301)", t && t.pitch > 30 * DEG && t.pitch < 50 * DEG && t.v < 20, JSON.stringify(t));
  const flatS = rangeSigma(-8 * DEG, 85, M.y, 0, BISON_FIRE.gun.acc, BISON_FIRE.gun.chargeSig);
  ok("T2: the chosen arc's landing sigma beats the flat root's by 5x or more", t.s * 5 < flatS, `${t.s.toFixed(2)} vs ${flatS.toFixed(2)}`);
  addBody(w, { kind: "chunk", team: 0, mass: 0, hx: 3, hy: 2, hz: 3, x: 20, y: 2, z: 0, hp: 999 });
  const b = tightSolve(w, M, { x: 26, y: 0, z: 0 }, BISON_FIRE.gun, 0);
  ok("T2: behind the 4 m building — lawful, raised, still small-charge", b && b.pitch > 40 * DEG && b.v < 25, JSON.stringify(b));
}

// T3 — the ring shrinks: clear-ground footprints that smeared 9-20 m under
// the flat root now bound within ~2-3 m, and the ring's arc is the gentle one.
{
  const SG = mkSG();
  const r20 = predictRing(SG, M, { x: 20, y: 0, z: 0 }, BISON_FIRE.gun, 0.02, null, idUV);
  const r30 = predictRing(SG, M, { x: 30, y: 0, z: 0 }, BISON_FIRE.gun, 0.02, null, idUV);
  ok("T3: clear 20 m — the ring's bound is under 2.5 m and its arc is gentle", r20.r < 2.5 && r20.rawDir.y > 0.5, `r ${r20.r.toFixed(2)} dy ${r20.rawDir.y.toFixed(2)}`);
  ok("T3: clear 30 m — the ring's bound is under 3.5 m", r30.r < 3.5, r30.r.toFixed(2));
  ok("T3: still air — the ring's center sits on the aim", Math.hypot(r20.center.x - 20, r20.center.z) < 1.0, JSON.stringify(r20.center));
}

// T4 — the third draw: a mortar round draws exactly 3 (scatter's two and the
// charge), flies within the charge bound of its fitted speed, and the fixed
// high root is dead — the tube picks its arc. A rocket volley of four draws 12.
{
  const w = makeWorld({ field: flatF, seed: 302 });
  const mm = { x: 0, y: 2.0, z: 0 };
  const sh = addBody(w, { kind: "unit", team: 2, mass: 80, hx: 0.28, hy: 1.0, hz: 0.28, x: 0, y: 1.0, z: 5, hp: 58 });
  let d = 0; const raw = w.rng; w.rng = () => { d++; return raw(); };
  w.events.length = 0;
  shooterFire(w, sh, mm, { pos: { x: 20, y: 0, z: 0 }, v: { x: 0, y: 0, z: 0 }, hy: 0 }, { ...TOWER_SPECS.mortar }, { high: true, attacker: "enemy", owner: sh.id });
  const sol = tightSolve(w, mm, { x: 20, y: 0, z: 0 }, TOWER_SPECS.mortar, sh.id);
  const p0 = w.projectiles[0];
  const sp = Math.hypot(p0.v.x, p0.v.y, p0.v.z);
  ok("T4: the mortar round draws exactly three (seed 302)", d === 3, d);
  ok("T4: the round flies the solved charge, inside the ±3-sigma bound",
    sol && Math.abs(sp - sol.v) <= sol.v * TOWER_SPECS.mortar.chargeSig * CHARGE_CAP + 0.3, `${sp.toFixed(1)} vs ${sol.v.toFixed(1)}`);
  ok("T4: the mortar root is dead — the fired arc is the solver's, far under the old ~70° root",
    muzzles(w)[0].dy < Math.sin(60 * DEG) && Math.abs(Math.asin(muzzles(w)[0].dy) - sol.pitch) < 0.12, muzzles(w)[0].dy);
  const w2 = makeWorld({ field: flatF, seed: 303 });
  const sh2 = addBody(w2, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 1.0, hz: 0.28, x: 0, y: 1.0, z: 5, hp: 58 });
  d = 0; const raw2 = w2.rng; w2.rng = () => { d++; return raw2(); };
  shooterFire(w2, sh2, mm, { pos: { x: 15, y: 0, z: 0 }, v: { x: 0, y: 0, z: 0 }, hy: 0 }, { ...TOWER_SPECS.rocket, volley: 4 }, { attacker: "player", owner: sh2.id });
  ok("T4: a four-round salvo draws 12 and fields 4 rounds (seed 303)", d === 12 && w2.projectiles.length === 4, `${d} / ${w2.projectiles.length}`);
}

// T5 — the hold and the lob, both sides of the mortar mirror: an 18 m wall
// right before the target holds even the mortar now (it tested no terrain
// before); the 4 m building lobs over. Grenadier's lob = mortar team's arc
// on the same ground (symmetry, aim fully equal).
{
  const w = makeWorld({ field: flatF, seed: 304 });
  addBody(w, { kind: "wall", team: 0, mass: 0, hx: 0.9, hy: 9, hz: 0.2, x: 18, y: 9, z: 0, hp: 999 });
  ok("T5: the mortar holds at the 18 m wall — lofted blindness is dead", tightSolve(w, { x: 0, y: 1.5, z: 0 }, { x: 20, y: 0, z: 0 }, TOWER_SPECS.mortar, 0) === null);
  const w2 = makeWorld({ field: flatF, seed: 305 });
  addBody(w2, { kind: "chunk", team: 0, mass: 0, hx: 3, hy: 2, hz: 3, x: 20, y: 2, z: 0, hp: 999 });
  const mb = tightSolve(w2, { x: 0, y: 2.0, z: 0 }, { x: 26, y: 0, z: 0 }, TOWER_SPECS.mortar, 0);
  ok("T5: the mortar lobs the 4 m building (seed 305)", mb && mb.pitch > 40 * DEG && mb.v < TOWER_SPECS.mortar.projSpeed, JSON.stringify(mb));
  const a = tightSolve(w2, { x: 0, y: 1.7, z: 0 }, { x: 18, y: 0, z: 0 }, ENEMY_FIRE.lob, 0);
  const b = tightSolve(w2, { x: 0, y: 1.7, z: 0 }, { x: 18, y: 0, z: 0 }, INFANTRY_ARMS.mortars, 0);
  ok("T5: the grenadier's lob and the mortar team solve the same arc on the same ground",
    a && b && Math.abs(a.pitch - b.pitch) < 1e-9 && Math.abs(a.v - b.v) < 1e-9, JSON.stringify({ a, b }));
}

// T6 — source pins: shooterFire's chargeSig gate outranks the mortar root;
// the charge draw is one bounded uniform; liftedTip solves tight for capped
// specs; the ring walks the charge rim.
{
  const st = src("src/depot/state.js");
  ok("T6: shooterFire routes chargeSig specs to tightSolve and kills their high root",
    /if \(spec\.chargeSig != null\) \{\n    high = false;\n    elev = tightSolve\(world, muzzle, target\.pos, spec, opts\.owner\);/.test(st));
  ok("T6: the charge draw is one bounded uniform per round",
    /const chg = spec\.chargeSig != null \? 1 \+ \(world\.rng\(\) \* 2 - 1\) \* spec\.chargeSig \* CHARGE_CAP : 1;/.test(st));
  ok("T6: the Bison's drawn tube ends at the chosen arc",
    /spec\.chargeSig != null \? tightSolve\(world, flat, aim, spec, v\.id\) : elevSolve\(world, flat, aim, spec, v\.id\)/.test(src("src/depot/drivers.js")));
  ok("T6: the ring's rays walk the charge rim",
    /const chg = cs \? 1 \+ cs \* \(s % 3 - 1\) : 1;/.test(src("src/depot/accuracy.js")));
}
