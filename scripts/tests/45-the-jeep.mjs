import { ok } from "./harness.mjs";
import { makeWorld, addBody, stepWorld } from "../../src/engine/core.js";
import { eyeOf } from "../../src/depot/sight.js";
import * as SP from "../../src/depot/specs.js";

// ==== mk2.98: the jeep ======================================================
// The fording flag, the per-body eye, and the assembly pins. Seed rolled
// each run.
{
  console.log("\n[mk2.98: the jeep]");
  const SEED = (Date.now() % 1000000) + 1; // rolled each run — no seed is ever special
  console.log("  fixture seed base", SEED);
  const flat = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (x, z, o) => { o.x = 0; o.y = 1; o.z = 0; } };

  // (a) the fording flag: a flagged hull survives the water that kills its twin
  {
    const w = makeWorld({ field: flat, seed: SEED + 0, water: { x0: -10, x1: 10, z0: -10, z1: 10, level: 2.0 } });
    w.depotCombat = true;
    const mk = (x) => addBody(w, { kind: "vehicle", team: 1, mass: 1100, hx: 0.75, hy: 0.5, hz: 1.1, x, y: 0.55, z: 0, hp: 90, friction: 0.8 });
    const dry = mk(-3), wet = mk(3);
    wet.fords = true;
    for (let i = 0; i < 300; i++) stepWorld(w);
    ok("(a) the unflagged hull drowns", dry.alive === false, dry.alive ? "alive" : "drowned");
    ok("(a) the fording hull survives the same water", wet.alive === true, wet.alive ? "fording" : "drowned");
  }

  // (b) the per-body eye: eyeR overrides the vehicle table
  {
    const b = { kind: "vehicle", pos: { x: 0, y: 0, z: 0 }, eyeR: 46 };
    ok("(b) eyeR carries the spotter's reach", eyeOf(b).r === 46, String(eyeOf(b).r));
    const plain = { kind: "vehicle", pos: { x: 0, y: 0, z: 0 } };
    ok("(b) an unmarked hull keeps the table's 36", eyeOf(plain).r === 36, String(eyeOf(plain).r));
  }

  // (c) the spec and its wiring
  ok("(c) the JEEP spec stands", !!SP.JEEP && SP.JEEP.cost === 60 && SP.JEEP.seats === 2 && SP.JEEP.eye === 46 && SP.JEEP.spd2h === 14 && SP.JEEP.spd4l === 4, JSON.stringify(SP.JEEP || null));
  ok("(c) the hand knows the jeep", SP.HAND_KEYS.includes("hero_jeep") && SP.HAND_TAGS.hero_jeep === "hero_jeep");
}
