// COLDSNAP suite era 32 — THE COMMANDER'S EYE (mk2.58). Possession is the
// player's own sight: a possessed trigger answers at
// ANY aim inside its circle — dark ground, far rims, fog — because the
// player sees the whole field. Under its own control every gun keeps the
// sight law untouched. Both sides' autonomous gates identical. No seed is
// special; fixture seeds named below.
import { ok } from "./harness.mjs";
import { makeWorld, addBody, stepWorld } from "../../src/engine/core.js";
import { possessedArmorFire, possessedArmorMg, stepDrivers } from "../../src/depot/drivers.js";
import { steerReticle } from "../../src/depot/sight.js";
import { BISON, BISON_FIRE } from "../../src/depot/specs.js";
import { identFwdDir } from "./shared.mjs";

const flatF = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (x, z, o) => { o.x = 0; o.y = 1; o.z = 0; return o; } };
const idUV = (x, z) => ({ u: x, v: z });
// a sight map with NOTHING lit — the blackest possible field
const darkT = () => ({ sight: { nx: 64, nz: 64, cs: 2, halfU: 64, halfV: 64, seen1: new Uint8Array(64 * 64), seen2: new Uint8Array(64 * 64), gnd: new Float32Array(64 * 64), occ: new Float32Array(64 * 64).fill(-Infinity) } });
const mkBison = (w, team, x, z) => {
  const v = addBody(w, { kind: "vehicle", team, mass: BISON.mass, hx: BISON.hx, hy: BISON.hy, hz: BISON.hz, x, y: BISON.hy + 0.05, z, hp: BISON.hp });
  v.armor = BISON.armor; v.vtype = "bison"; v.drv = "armor"; v.depotDrive = "auto"; v.order = "defend";
  return v;
};
const muzzles = (w) => w.events.filter((ev) => ev.type === "muzzle");

// C1 — the possessed gun fires into the pitch dark: main gun and coax both,
// on a sight map with nothing lit at all.
{
  const w = makeWorld({ field: flatF, seed: 321 }); w.depotCombat = true;
  const v = mkBison(w, 1, 0, 0);
  w.events.length = 0;
  ok("C1: the possessed main gun fires at an utterly dark aim (seed 321)",
    possessedArmorFire(w, v, { x: 20, y: 0, z: 0 }, darkT(), idUV) === true && muzzles(w).some((m) => m.kind === "shell"));
  w.events.length = 0;
  ok("C1: the possessed coax fires at an utterly dark aim too",
    possessedArmorMg(w, v, { x: 10, y: 0, z: 0 }, darkT(), idUV) === true && muzzles(w).length > 0);
}

// C2 — the same hull under its OWN driver keeps the sight law: an enemy man
// standing on dark ground is not acquired; light his cell and the gun answers.
{
  const w = makeWorld({ field: flatF, seed: 322 }); w.depotCombat = true;
  const v = mkBison(w, 1, 0, 0);
  addBody(w, { kind: "unit", team: 2, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x: 15, y: 0.74, z: 0, hp: 50000 });
  const T = darkT();
  const grid = { cellAt: () => null, worldToGrid: () => ({ gx: 0, gz: 0 }), inBounds: () => false, idx: () => 0, cells: [], gridToWorld: () => ({ x: 0, z: 0 }) };
  for (let i = 0; i < 240; i++) { stepDrivers(w, grid, identFwdDir, T, idUV, {}); stepWorld(w); }
  ok("C2: the auto-driven Bison holds at a man on dark ground (seed 322) — the sight law stands for its own driver", muzzles(w).length === 0, muzzles(w).length);
  T.sight.seen1.fill(1);
  for (let i = 0; i < 240; i++) { stepDrivers(w, grid, identFwdDir, T, idUV, {}); stepWorld(w); }
  ok("C2: light the ground and the same hull answers", muzzles(w).length > 0, muzzles(w).length);
}

// C3 — the reticle roams the whole circle over the same black map; only the
// radius clamps it.
{
  let off = { dx: 0, dz: 0 };
  const SG = darkT().sight;
  for (let i = 0; i < 300; i++) off = steerReticle(SG, 1, { x: 0, z: 0 }, 26, off, 1, 0, 1 / 60, idUV);
  ok("C3: the reticle crosses the black to the circle's edge", Math.abs(off.dx - 26) < 0.5, off.dx.toFixed(1));
}
