# T28: the engine fires (0.5.27)

Three items from the owner's flight report, researched against the deadweight hangar reference (`docs/superpowers/reference/deadweight-hangar.html`).

- **The priming step lands.** The aim phase has been blind since 0.5.25: the freeze runs before any physics step, so no track ever exists, and the arrow, the burn number, the ghost, and the orbit lines all wait on a track. T26's plan named a priming step at the ship scene's birth; its substitution shipped only the freeze. One physics step now runs at scene birth, before the freeze takes. This is the whole cause of the invisible initial burn — the burn's power number already draws at the arrow head and could never appear.
- **The ark's default trajectory.** The ark pre-locks an aim at level birth toward the gate; the rubble ship now does the same — toward the gate at burn 50 — so the trajectory and its number stand on screen before the first touch.
- **The engine module fires.** The aft module of the five-block cross is marked as the engine. Every burn lights the deadweight hangar's plume on it — radial glow, gradient cone, shock diamonds, white-hot core — pointed against the burn, scaled by the burn's size, decaying over 36 frames. And the deadweight rule comes with it: no living engine module, no burn — a hull that loses its aft block is adrift, and LAUNCH and EXECUTE grey out. Damage stays damage.

Design choices, stated plainly:

- Default aim strength 50 — the ark's own default (its half-budget cap at 50).
- The plume lasts 36 frames per burn — an impulse's moment, since these burns are instant where the hangar's are held.
- The flame flicker runs off the frame counter, deterministic; nothing random enters the sim.
- RE-PIN, named: marking the engine adds one field to the ship's blocks, so the ship scene's generation hash changes — old `66300fdf76b09183`, new `65750510510dc87a`. Asserted content is the same hull; the mark is the only difference. Every other pinned number is unchanged and the acceptance below proves it.

The whole change was applied to a scratch copy at plan-writing time: every anchor hit exactly once, every file parses, the acceptance hashes below reproduced, exactly one engine block confirmed.

## Required reading

- This plan, whole.
- `src/game/RubbleWorlds.jsx` — whole.
- `src/game/rubbleworlds/gen.js` — the ship scene block.
- `src/game/rubbleworlds/draw.js` — the aim-arrow block and its surroundings.

## Suggested model

Sonnet. Every substitution is anchored and pre-verified; no design remains.

## Steps

**1. The substitutions.** Every edit is one anchored replacement; an anchor that does not appear exactly once stops the task. From the repo root:

```bash
python3 - <<'PYEOF'
import sys
def sub1(path, old, new, tag):
    s = open(path).read()
    if s.count(old) != 1: sys.exit("anchor fail: %s (count %d)" % (tag, s.count(old)))
    open(path, 'w').write(s.replace(old, new))

# --- 1. gen.js: the aft module is the engine, marked ---
sub1('src/game/rubbleworlds/gen.js',
  '''      world.blocks.push({ x: sx + ox, y: 0, z: sz + oz, vx: 0, vy: 0, vz: 0, tint: 2, ship: true, alive: true, sleeping: false, clump: -1, s: BS, cr: BS * 0.55, m: 120 });''',
  '''      world.blocks.push({ x: sx + ox, y: 0, z: sz + oz, vx: 0, vy: 0, vz: 0, tint: 2, ship: true, eng: ox === -BS && oz === 0, alive: true, sleeping: false, clump: -1, s: BS, cr: BS * 0.55, m: 120 });''',
  'gen-engine-mark')

# --- 2. component: the priming step and the ark's default trajectory ---
sub1('src/game/RubbleWorlds.jsx',
  '''        world = makeScenario(k.kind, seed, k.size);
        setUi(u => ({ ...u, kind: k.kind, seed, eaten: 0 }));''',
  '''        world = makeScenario(k.kind, seed, k.size);
        if (world.ship) {
          stepWorld(world, k); // one priming step: tracks and orbit lines exist before the aim freeze — the t26 intent, landed now
          const b0 = world.blocks.find(b2 => b2.ship && b2.alive);
          if (b0 && world.gate) { // the ark's default trajectory: toward the gate at 50
            const dx = world.gate.x - b0.x, dz = world.gate.z - b0.z, dd = Math.hypot(dx, dz) || 1;
            world.shipAim = { on: true, vx: dx / dd * 50, vz: dz / dd * 50 };
          }
        }
        setUi(u => ({ ...u, kind: k.kind, seed, eaten: 0 }));''',
  'jsx-priming-default-aim')

# --- 3. component: no engine, no burn; the plume is lit on every burn ---
sub1('src/game/RubbleWorlds.jsx',
  '''      if (!aim || !aim.on) return;
      const cost = Math.hypot(aim.vx, aim.vz);
      if (cost > world.ship.fuel) return;
      world.ship.fuel -= cost;
      if (what === "exec") world.ship.burns++;
      for (const b of world.blocks) if (b.ship && b.alive) { b.vx += aim.vx; b.vz += aim.vz; }
      world.shipAim = { on: false, vx: 0, vz: 0 };
      world.shipPhase = "fly";''',
  '''      if (!aim || !aim.on) return;
      if (!world.blocks.some(b2 => b2.ship && b2.eng && b2.alive)) return; // no engine, no burn — thrust belongs to the engine module
      const cost = Math.hypot(aim.vx, aim.vz);
      if (cost > world.ship.fuel) return;
      world.ship.fuel -= cost;
      if (what === "exec") world.ship.burns++;
      for (const b of world.blocks) if (b.ship && b.alive) { b.vx += aim.vx; b.vz += aim.vz; }
      world.flame = { f0: world.frame, dur: 36, dx: -aim.vx / cost, dz: -aim.vz / cost, mag: cost }; // the engine fires against the burn
      world.shipAim = { on: false, vx: 0, vz: 0 };
      world.shipPhase = "fly";''',
  'jsx-engine-gate-flame')

# --- 4. component: the chips read the engine too ---
sub1('src/game/RubbleWorlds.jsx',
  ''', phase: world.shipPhase || null, aimOn: !!(world.shipAim && world.shipAim.on) }));''',
  ''', phase: world.shipPhase || null, aimOn: !!(world.shipAim && world.shipAim.on), engOn: !world.ship || world.blocks.some(b2 => b2.ship && b2.eng && b2.alive) }));''',
  'jsx-engon')
sub1('src/game/RubbleWorlds.jsx',
  '''          {ui.phase === "aim" && chip("LAUNCH", ui.aimOn === true, () => ui.aimOn && fireBurn("launch"))}''',
  '''          {ui.phase === "aim" && chip("LAUNCH", ui.aimOn === true && ui.engOn === true, () => ui.aimOn && ui.engOn && fireBurn("launch"))}''',
  'jsx-launch-chip')
sub1('src/game/RubbleWorlds.jsx',
  '''          {ui.phase === "plan" && chip("EXECUTE", ui.aimOn === true, () => ui.aimOn && fireBurn("exec"))}''',
  '''          {ui.phase === "plan" && chip("EXECUTE", ui.aimOn === true && ui.engOn === true, () => ui.aimOn && ui.engOn && fireBurn("exec"))}''',
  'jsx-exec-chip')

# --- 5. draw.js: the deadweight plume on the aft module, decaying over the burn's moment ---
sub1('src/game/rubbleworlds/draw.js',
  '''      // the ship's aim arrow, the ark's own gesture''',
  '''      // the engine fires: the deadweight hangar's plume — radial glow, gradient
      // cone, shock diamonds, white-hot core — anchored on the aft module,
      // pointed against the burn, thrust-scaled, decaying over the burn's moment
      if (world.flame && world.frame - world.flame.f0 < world.flame.dur) {
        const eng = wb.find(b2 => b2.ship && b2.eng && b2.alive);
        if (eng) {
          const fl = world.flame, age = (world.frame - fl.f0) / fl.dur;
          const th = (1 - age) * Math.min(1, fl.mag / 65);
          const f = (0.85 + 0.15 * Math.sin(world.frame * 0.57)) * Math.max(th, 0.001);
          const ep = iso(eng.x + fl.dx * BS * 0.6, eng.z + fl.dz * BS * 0.6, eng.y);
          const tp = iso(eng.x + fl.dx * (BS * 0.6 + 26 * f), eng.z + fl.dz * (BS * 0.6 + 26 * f), eng.y);
          const dx2 = tp.x - ep.x, dy2 = tp.y - ep.y, L = Math.hypot(dx2, dy2) || 1;
          let pg = ctx.createRadialGradient(ep.x, ep.y, 0, ep.x + dx2 * 0.4, ep.y + dy2 * 0.4, 22 * f + 1);
          pg.addColorStop(0, "rgba(90,140,235,.5)"); pg.addColorStop(1, "rgba(58,98,196,0)");
          ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(ep.x + dx2 * 0.3, ep.y + dy2 * 0.3, 20 * f + 1, 0, Math.PI * 2); ctx.fill();
          ctx.save(); ctx.translate(ep.x, ep.y); ctx.rotate(Math.atan2(dy2, dx2));
          let cg = ctx.createLinearGradient(0, 0, L, 0);
          cg.addColorStop(0, "rgba(220,236,255,.95)"); cg.addColorStop(0.35, "rgba(120,166,240,.7)"); cg.addColorStop(1, "rgba(58,98,196,0)");
          ctx.fillStyle = cg; ctx.beginPath(); ctx.moveTo(0, -3.4 * f); ctx.lineTo(L * 0.75, -1.1 * f); ctx.lineTo(L, 0); ctx.lineTo(L * 0.75, 1.1 * f); ctx.lineTo(0, 3.4 * f); ctx.closePath(); ctx.fill();
          ctx.fillStyle = "rgba(235,245,255,.85)";
          for (const q of [0.22, 0.45, 0.68]) { ctx.beginPath(); ctx.ellipse(L * q, 0, 2.6 * f * (1 - q * 0.7), 1.3 * f * (1 - q * 0.7), 0, 0, Math.PI * 2); ctx.fill(); }
          ctx.restore();
          ctx.save(); ctx.shadowColor = "rgba(200,225,255,.95)"; ctx.shadowBlur = 14;
          ctx.fillStyle = "#f2f8ff"; ctx.beginPath(); ctx.arc(ep.x, ep.y, 2.6 * f + 0.6, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        }
      }
      // the ship's aim arrow, the ark's own gesture''',
  'draw-plume')
print("all substitutions in")
PYEOF
```

Expected output, exact: `all substitutions in`.

**2. The physics gate.** The command, whole:

```bash
node -e "
import('node:crypto').then(async({createHash})=>{
  const h=o=>createHash('sha256').update(JSON.stringify(o)).digest('hex').slice(0,16);
  const{makeScenario,SCENES}=await import('./src/game/rubbleworlds/gen.js');
  const{stepWorld}=await import('./src/game/rubbleworlds/phys.js');
  for(const hash of[false,true]){
    const w=makeScenario('binary',12345,1);
    for(let s=0;s<600;s++)stepWorld(w,{welds:true,sleep:true,hash});
    console.log('evolution 10s hash='+hash,h(w.blocks.map(b=>[Math.round(b.x*1000),Math.round(b.y*1000),Math.round(b.z*1000)])));
  }
  for(const sc of SCENES)console.log(sc+' s1',h(makeScenario(sc,12345,1).blocks));
  const w=makeScenario('ship',12345,1);
  stepWorld(w,{welds:true,sleep:true,hash:false});
  console.log('engine blocks',w.blocks.filter(b=>b.ship&&b.eng).length);
});"
```

Acceptance, exact — every line. The ship line is the named re-pin; every other line is unchanged from T27:

```
evolution 10s hash=false 42ae90b308d1e6f6
evolution 10s hash=true 42ae90b308d1e6f6
ship s1 65750510510dc87a
binary s1 1ab5dec0a100e39f
duet s1 815c1643021c10c9
moons s1 55e26401d110fa2c
trio s1 7cbf8f6bbd428266
system s1 1bbb5a4a3205c09c
hole s1 cae5ebf64cc05676
engine blocks 1
```

**3. Gate.** `node scripts/gate.mjs smoke` — 23 PASS, 0 FAIL, foreground, timeout at least 300 seconds.

**4. Version and build.** `MK = "0.5.27"`, then `npm run build`.

**5. Land.** Commit `src/game/RubbleWorlds.jsx`, `src/game/rubbleworlds/gen.js`, `src/game/rubbleworlds/draw.js`, and `src/version.js` only (plain-words lowercase subject, e.g. "the engine fires, 0.5.27"), push. The phase document's table gains the T28 row (mark 0.5.27, status LANDED with the hashes, the ship re-pin named old→new, and the smoke count); commit, push. The owner's live flight — the default trajectory standing at scene birth with its number, the plume on every burn, the greyed chips on a lost engine — is the acceptance, phone and desktop both.

## Report

- One line of outcome, then bullets.
- Read-confirmation first.
- Every acceptance line as printed; the smoke count exactly.
- The ship re-pin as its own labeled bullet, old→new.
- Fixture seeds: the gates pin 12345 by the plan's own law; the demo rolls its own seed at mount — none special.
- Both commit hashes.
- Every deviation its own labeled bullet.
