// Glancing damage gate: under world.depotCombat, direct projectile impact
// damage scales with impact obliquity (dmg * (0.35 + 0.65*|cos theta|)),
// theta = angle between projectile velocity and the struck AABB face normal
// (axis of least penetration from segBoxHit, exposed as hitAxis). Guard proof:
// without the flag, head-on and grazing hits must deal identical damage.
import { makeWorld, addBody, fireProjectile, stepWorld } from "../src/engine/core.js";

const fails = [];
const ok = (name, cond, detail = "") => { console.log(`${cond ? "PASS" : "FAIL"} — ${name}${detail ? `  [${detail}]` : ""}`); if (!cond) fails.push(name); };

function runOnce({ depotCombat, grazing }) {
  const world = makeWorld({ seed: 1 });
  if (depotCombat) world.depotCombat = true;
  const target = addBody(world, { kind: "vehicle", hx: 1, hy: 1, hz: 1, x: 0, y: 5, z: 20, mass: 500, hp: 1000 });
  // fire toward the target's center (0,5,20); face normal being struck is the
  // z axis. head-on: velocity purely along +z (theta ~ 0, cos ~ 1). grazing:
  // velocity mostly along x with a small z component (~75deg off the normal),
  // aimed so the straight line still passes through the target's center.
  const dir = grazing
    ? { x: Math.sin(75 * Math.PI / 180), y: 0, z: Math.cos(75 * Math.PI / 180) }
    : { x: 0, y: 0, z: 1 };
  const D = 25;
  const from = { x: 0 - dir.x * D, y: 5, z: 20 - dir.z * D };
  // r:0 keeps explode()'s blast contribution at (or effectively at) zero on
  // the very body it struck, isolating the direct-impact damage path (a flat
  // 90 for "shell" in stepProjectiles) so the test measures only the
  // glancing scale-down, not blast falloff noise.
  fireProjectile(world, from, dir, 60, { kind: "shell", r: 0, kv: 12, dmg: 55, crater: 0, attacker: "player" });
  for (let i = 0; i < 240 && world.projectiles.length; i++) stepWorld(world);
  return target.hp;
}

const headOnFlag = runOnce({ depotCombat: true, grazing: false });
const grazeFlag = runOnce({ depotCombat: true, grazing: true });
ok("under depotCombat: grazing hit retains more hp than head-on", grazeFlag > headOnFlag, `head-on hp=${headOnFlag} graze hp=${grazeFlag}`);

const headOnNoFlag = runOnce({ depotCombat: false, grazing: false });
const grazeNoFlag = runOnce({ depotCombat: false, grazing: true });
ok("guard: without depotCombat, head-on and grazing deal identical damage", headOnNoFlag === grazeNoFlag, `head-on hp=${headOnNoFlag} graze hp=${grazeNoFlag}`);

console.log(fails.length ? `\n${fails.length} FAIL(S)` : "\nALL PASS");
process.exit(fails.length ? 1 : 0);
