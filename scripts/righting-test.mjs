// Righting + knockback behavior gate. Locks the intentional core.js
// divergences from the frozen demo (tilt-aware RECOVER, the servo's recover
// window, mass-tempered blast kicks on the hull). The golden gate still
// proves parity on its scripted scenarios — none of them press RECOVER or
// put a >600kg body inside a blast — so THIS file is the behavior lock for
// the diverged paths. If a change breaks these asserts, it changes how the
// tank rights or takes hits, and that is a design decision, not noise.
import { buildProvingGrounds, stepWorld, thawPool, recoverBison, explode, worldHash, bisonFire, freezePool } from "../src/engine/core.js";

const fails = [];
const ok = (name, cond, detail = "") => {
  console.log(`${cond ? "PASS" : "FAIL"} — ${name}${detail ? ` (${detail})` : ""}`);
  if (!cond) fails.push(name);
};

const MORTAR = { r: 3.0, kv: 26, dmg: 42, crater: 0.7, vroll: 6, vlift: 6 };

// place the hull with a given roll about hull-forward, settle, return world+body
function placed(place, roll, { thaw = false } = {}) {
  const world = buildProvingGrounds(1234);
  if (thaw) thawPool(world);
  const b = world.byId.get(world.bisonId);
  b.pos.x = place.x; b.pos.z = place.z;
  b.pos.y = world.field.heightAt(place.x, place.z) + 1.0;
  const h = roll / 2;
  b.q = { x: 0, y: 0, z: Math.sin(h), w: Math.cos(h) };
  b.v.x = b.v.y = b.v.z = 0; b.w.x = b.w.y = b.w.z = 0;
  for (let i = 0; i < 180; i++) stepWorld(world); // settle 1.5s
  return { world, b };
}

// press RECOVER on the component's cadence until upright or out of presses
function rightingRun(place, roll, presses, opts) {
  const { world, b } = placed(place, roll, opts);
  let nextPress = world.t, used = 0;
  const t0 = world.t;
  while (world.t - t0 < 4 + presses * 3) {
    if (b.R[4] > 0.93 && Math.hypot(b.w.x, b.w.z) < 0.4) break;
    if (used < presses && world.t >= nextPress && b.R[4] <= 0.5) {
      recoverBison(world);
      used++;
      nextPress = world.t + 2.6; // the sandbox's RECOVER cooldown
    }
    stepWorld(world);
  }
  return { R4: b.R[4], used, world, b };
}

const LAND = { x: 0, z: 8 };
const POOLC = { x: 0, z: 28 };
const RAMP = { x: 0, z: 17.5 };

// --- righting: every stuck state Jeff reported must resolve
{
  const a = rightingRun(LAND, Math.PI, 2);
  ok("land, inverted: rights within 2 presses", a.R4 > 0.9, `R4=${a.R4.toFixed(2)} presses=${a.used}`);
  const s = rightingRun(LAND, Math.PI / 2, 2);
  ok("land, on side (the old dead zone): rights within 2 presses", s.R4 > 0.9, `R4=${s.R4.toFixed(2)} presses=${s.used}`);
  const w = rightingRun(POOLC, Math.PI, 3, { thaw: true });
  ok("thawed pool, inverted: rights within 3 presses", w.R4 > 0.9, `R4=${w.R4.toFixed(2)} presses=${w.used}`);
  const ws = rightingRun(POOLC, Math.PI / 2, 3, { thaw: true });
  ok("thawed pool, on side: rights within 3 presses", ws.R4 > 0.9, `R4=${ws.R4.toFixed(2)} presses=${ws.used}`);
  const r = rightingRun(RAMP, Math.PI, 3, { thaw: true });
  ok("pool apron bank, inverted: rights within 3 presses", r.R4 > 0.9, `R4=${r.R4.toFixed(2)} presses=${r.used}`);
}

// --- knockback: one mortar near-miss must not invert the hull...
{
  const { world, b } = placed(LAND, 0);
  const v0 = { x: b.v.x, y: b.v.y, z: b.v.z };
  explode(world, b.pos.x + b.hx + 1.5, world.field.heightAt(b.pos.x + b.hx + 1.5, b.pos.z), b.pos.z, MORTAR);
  const dv = Math.hypot(b.v.x - v0.x, b.v.y - v0.y, b.v.z - v0.z);
  let minR4 = 1;
  for (let i = 0; i < 480; i++) { stepWorld(world); if (b.R[4] < minR4) minR4 = b.R[4]; }
  ok("single mortar side-burst: shove under 3.5 m/s", dv < 3.5, `dv=${dv.toFixed(2)}`);
  ok("single mortar side-burst: hull never near inversion", minR4 > 0.5, `minR4=${minR4.toFixed(2)}`);
}

// --- ...but bursts ON the hull footprint still can (design intent: a
// mortar landing at the tracks is the flip, the 1.5m near-miss is not)
{
  const { world, b } = placed(LAND, 0);
  let minR4 = 1;
  for (let hit = 0; hit < 2; hit++) {
    const bx = b.pos.x + b.hx * 0.6;
    explode(world, bx, world.field.heightAt(bx, b.pos.z), b.pos.z, MORTAR);
    for (let i = 0; i < 42; i++) { stepWorld(world); if (b.R[4] < minR4) minR4 = b.R[4]; }
  }
  for (let i = 0; i < 240; i++) { stepWorld(world); if (b.R[4] < minR4) minR4 = b.R[4]; }
  ok("two mortars landing at the tracks still roll the hull hard", minR4 < 0.35, `minR4=${minR4.toFixed(2)}`);
}

// --- determinism: the recover path draws no rng and replays bit-identically
{
  const h1 = (() => { const r = rightingRun(POOLC, Math.PI, 3, { thaw: true }); return worldHash(r.world); })();
  const h2 = (() => { const r = rightingRun(POOLC, Math.PI, 3, { thaw: true }); return worldHash(r.world); })();
  ok("recover sequence is deterministic (replay hash-identical)", h1 === h2, `${h1} vs ${h2}`);
}

// --- trucks take fire damage (divergence #5: the demo's damage gates read
// unit|vehicle, leaving trucks immune to every shell and round — latent
// there because demo trucks only die by CRUSH and DROWN)
{
  const world = buildProvingGrounds(1234);
  const truck = world.bodies.find((b) => b.kind === "truck" && b.alive);
  const b = world.byId.get(world.bisonId);
  b.pos.x = truck.pos.x; b.pos.z = truck.pos.z - 20;
  b.pos.y = world.field.heightAt(b.pos.x, b.pos.z) + 1.0;
  const hp0 = truck.hp;
  let died = null;
  for (let s = 0; s < 4 && truck.alive; s++) {
    bisonFire(world, { x: truck.pos.x, z: truck.pos.z });
    for (let i = 0; i < 180; i++) {
      world.events.length = 0;
      stepWorld(world);
      for (const e of world.events) if (e.type === "kill" && e.id === truck.id) died = e;
      if (!truck.alive) break;
    }
  }
  ok("shells damage trucks", truck.hp < hp0, `hp ${hp0} -> ${truck.hp}`);
  ok("a truck dies to sustained shellfire with a kill event", !truck.alive && !!died, died ? `cause=${died.cause}` : "no kill event");
}

// --- units walk on ice (divergence #6a-d: body-standing grounds; the demo
// grounded terrain contact only, so a man on the frozen sheet was flagged
// airborne forever and deaf to every panic impulse)
{
  const world = buildProvingGrounds(1234);
  freezePool(world);
  const u = (() => {
    // stand a conscript mid-sheet the way the thin_ice trial does
    for (const b of world.bodies) if (b.kind === "unit" && b.alive) {
      b.pos.x = 1; b.pos.z = 27; b.pos.y = 1.132 + b.hy;
      b.v.x = b.v.y = b.v.z = 0;
      return b;
    }
  })();
  for (let i = 0; i < 240; i++) stepWorld(world); // settle on the plates
  const x0 = u.pos.x, z0 = u.pos.z;
  world.scare = { x: 1, z: 20, t: world.t }; // panic from the south lip
  let moved = 0;
  for (let i = 0; i < 360; i++) {
    stepWorld(world);
    if (world.t - world.scare.t < 1.4) world.scare.t = world.t - 0.1; // sustained scare
    const d = Math.hypot(u.pos.x - x0, u.pos.z - z0);
    if (d > moved) moved = d;
  }
  ok("a scared man on the frozen sheet actually runs", moved > 2, `moved ${moved.toFixed(1)}m`);
  ok("and survives his own footing", u.alive);
}

if (fails.length) {
  console.error(`\n${fails.length} FAILURE(S)`);
  process.exit(1);
}
console.log("\nRIGHTING GATE: ALL PASS");
