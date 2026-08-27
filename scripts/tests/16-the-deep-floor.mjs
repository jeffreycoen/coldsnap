// COLDSNAP suite era 16 — THE DEEP FLOOR (mk2.07). The crater carve's
// minus-1.5 clamp becomes a per-field dial: default frozen, the war digs
// deeper. Fixture seed: 1. No seed is special.
import { ok } from "./harness.mjs";
import fs from "node:fs";
import { makeField } from "../../src/engine/core.js";

{
  const f = makeField(9, 2.0, 1);
  f.carve(0, 0, 4, 20);
  ok("deep floor: default carve still clamps at -1.5", Math.abs(f.heightAt(0, 0) - -1.5) < 1e-4);
  const f2 = makeField(9, 2.0, 1);
  f2.carveFloor = -12;
  f2.carve(0, 0, 4, 20);
  ok("deep floor: a dialed field carves past the old clamp", Math.abs(f2.heightAt(0, 0) - -12) < 1e-4);
  const src = fs.readFileSync(new URL("../../src/depot/boot.js", import.meta.url), "utf8");
  ok("deep floor: the war sets its own floor at boot", src.includes("field.carveFloor = -12"));
}
