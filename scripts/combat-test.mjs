// Glancing damage gate: under world.depotCombat, direct projectile impact
// damage scales with impact obliquity (dmg * (0.35 + 0.65*|cos theta|)),
// theta = angle between projectile velocity and the struck AABB face normal
// (axis of least penetration from segBoxHit, exposed as hitAxis). Guard proof:
// without the flag, head-on and grazing hits must deal identical damage.
import { makeWorld, addBody, fireProjectile, stepWorld, applyDamage, CAUSE } from "../src/engine/core.js";

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

// Armor thresholds: under world.depotCombat, a ballistic hit whose dmg is
// below b.armor glances off (dmg * 0.15); dmg >= armor penetrates for full.
// Blast damage bypasses armor entirely (concussion). Guard proof: without
// the flag, armor is ignored regardless of value.
function armorHp(depotCombat, dmg, cause) {
  const world = makeWorld({ seed: 1 });
  if (depotCombat) world.depotCombat = true;
  const b = addBody(world, { kind: "vehicle", hx: 1, hy: 1, hz: 1, x: 0, y: 5, z: 20, mass: 500, hp: 1000 });
  b.armor = 40;
  applyDamage(world, b, dmg, { cause, attacker: "player" });
  return 1000 - b.hp;
}

ok("depotCombat: 30-dmg round vs armor 40 glances (4.5 hp lost)", armorHp(true, 30, CAUSE.PROJECTILE) === 4.5, `lost=${armorHp(true, 30, CAUSE.PROJECTILE)}`);
ok("depotCombat: 50-dmg round vs armor 40 penetrates (50 hp lost)", armorHp(true, 50, CAUSE.PROJECTILE) === 50, `lost=${armorHp(true, 50, CAUSE.PROJECTILE)}`);
ok("depotCombat: 30-dmg blast vs armor 40 bypasses armor (30 hp lost)", armorHp(true, 30, CAUSE.BLAST) === 30, `lost=${armorHp(true, 30, CAUSE.BLAST)}`);
ok("guard: without depotCombat, armor is ignored (30 hp lost)", armorHp(false, 30, CAUSE.PROJECTILE) === 30, `lost=${armorHp(false, 30, CAUSE.PROJECTILE)}`);

// Tree combat: under world.depotCombat, mg direct hits shred a tree's hp
// (default 30) at 4/hit — ~8 hits fells it. A shell/rocket direct hit
// ignites (t.burning = world.t) instead of killing outright; a burning
// tree loses 2 hp/s off world dt/t (not wall clock) and dies ~15s later.
// Unflagged worlds: trees are inert to direct rounds (TD/campaign keep
// their existing blast-only tree damage, unchanged).
function makeTreeWorld(depotCombat) {
  const world = makeWorld({ seed: 1 });
  if (depotCombat) world.depotCombat = true;
  const tree = addBody(world, { kind: "tree", hx: 0.28, hy: 1.6, hz: 0.28, x: 0, y: 1.62, z: 20, mass: 260, friction: 0.5 });
  return { world, tree };
}
// mg: minimal blast (r/dmg near-zero) so the ~8-hit fell is attributable to
// the new direct 4hp/hit path, not the pre-existing (unguarded) blast-on-tree
// mechanic every projectile already triggers via explode(). shell: a real
// blast, to prove ignite fires on the SAME hit that lands it (set before
// explode() runs, so it survives even if that same blast kills the tree).
function fireAt(world, kind) {
  const spec = kind === "mg" ? { kind, r: 0.05, kv: 0.3, dmg: 1, crater: 0, attacker: "player" }
    : { kind, r: 3, kv: 12, dmg: 55, crater: 0, attacker: "player" };
  fireProjectile(world, { x: 0, y: 1.62, z: 0 }, { x: 0, y: 0, z: 1 }, 90, spec);
  for (let i = 0; i < 60 && world.projectiles.length; i++) stepWorld(world);
}

{
  const { world, tree } = makeTreeWorld(true);
  ok("depotCombat: tree spawns with default hp 30", tree.hp === 30, `hp=${tree.hp}`);
  let hits = 0;
  while (tree.alive && hits < 20) { fireAt(world, "mg"); hits++; }
  ok("depotCombat: mg fells a tree in ~8 hits", !tree.alive && hits >= 7 && hits <= 9, `hits=${hits} alive=${tree.alive}`);
}

{
  const { world, tree } = makeTreeWorld(true);
  fireAt(world, "shell");
  ok("depotCombat: shell direct hit ignites the tree", tree.burning != null, `burning=${tree.burning} alive=${tree.alive} hp=${tree.hp}`);
}

{
  const { world, tree } = makeTreeWorld(true);
  tree.burning = 0;
  world.t = 0;
  let steps = 0;
  const dt = world.dt;
  while (tree.alive && steps < Math.ceil(20 / dt)) { stepWorld(world); steps++; }
  const seconds = steps * dt;
  ok("depotCombat: burning tree dies ~15s (2hp/s off world dt/t)", !tree.alive && seconds > 13 && seconds < 17, `died at t=${seconds.toFixed(2)}s`);
}

{
  const { world, tree } = makeTreeWorld(false);
  let hits = 0;
  while (tree.alive && hits < 20) { fireAt(world, "mg"); hits++; }
  ok("guard: without depotCombat, mg direct hits do not fell a tree", tree.alive, `hits=${hits} alive=${tree.alive} hp=${tree.hp}`);
  fireAt(world, "shell");
  ok("guard: without depotCombat, shell direct hit does not ignite", tree.burning == null, `burning=${tree.burning}`);
}

console.log(fails.length ? `\n${fails.length} FAIL(S)` : "\nALL PASS");
process.exit(fails.length ? 1 : 0);
