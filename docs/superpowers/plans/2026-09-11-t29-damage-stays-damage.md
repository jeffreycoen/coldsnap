# T29: damage stays damage (0.5.28)

The ship learns to be hurt, the deadweight hangar's way, sized to this sky by measurement. Modules carry health and die; the burn reaches only the hull still welded to the cabin, and needs the engine inside that hull — connected, not merely alive; the cabin's death ends the flight with a plain report card over a wreck that keeps drifting; torn blocks stay ship-tinted and inert, out of reach of every burn, never cold-welding — salvage stays future work.

How a strike wounds, measured before writing:

- A strike wounds ONCE, at first touch, by its closing speed past a graze of 40, times 1.0, capped at 55 per module per frame, with a 30-frame cooldown per module. The cap is deadweight's: one strike never one-shots the cabin.
- The graze sits at 40 because this well's own fall arrives near that speed — measured strike medians ran 21-33 at every approach speed, gravity's floor. Below the graze a touch costs nothing; a one-second drift from spawn ends at 100 health on every module, measured.
- Hull-on-hull contact carries the weld's law, never a wound. Only ship modules carry health; the rubble's own damage model is its welds.
- Stated plainly, from measurement: while the fast-impact defect stands (the solver pumps energy into impacts — the open t26 record), damage scales weakly with approach speed; it scales with how many strikes a crash deals. A braked touch bruises a few modules; a tumble wounds most of the hull and often takes the engine — adrift; only strikes on the cabin itself kill, and the surrounding cross shields it. A speed-graded ladder waits on the impact experiment already queued.

Design choices, stated plainly: health 100 per module; graze 40, factor 1.0, cap 55, cooldown 30 frames — all four are flight-tunable numbers, set by the measurements above; the center block is the cabin; RE-PIN, named: health and the cabin mark enter the ship's blocks, so the ship scene's generation hash changes — old `65750510510dc87a`, new `c2538ff163ef1494`. Every other pinned number is unchanged and the acceptance proves it.

The whole change was applied to a scratch copy at plan-writing time: every anchor hit exactly once, every file parses, every acceptance line below reproduced.

## Required reading

- This plan, whole.
- `src/game/RubbleWorlds.jsx` — whole.
- `src/game/rubbleworlds/phys.js` — the contact loop, the warm-start bookkeeping at the step's end, and the export line.
- `src/game/rubbleworlds/gen.js` — the ship scene block.

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

# 1. gen.js: modules carry health, the cabin is marked
sub1('src/game/rubbleworlds/gen.js',
  "      world.blocks.push({ x: sx + ox, y: 0, z: sz + oz, vx: 0, vy: 0, vz: 0, tint: 2, ship: true, eng: ox === -BS && oz === 0, alive: true, sleeping: false, clump: -1, s: BS, cr: BS * 0.55, m: 120 });",
  "      world.blocks.push({ x: sx + ox, y: 0, z: sz + oz, vx: 0, vy: 0, vz: 0, tint: 2, ship: true, eng: ox === -BS && oz === 0, cab: ox === 0 && oz === 0, hp: 100, alive: true, sleeping: false, clump: -1, s: BS, cr: BS * 0.55, m: 120 });",
  'gen-hp-cabin')

# 2. phys.js: each contact remembers its first-touch closing speed
sub1('src/game/rubbleworlds/phys.js',
  "const cnt = { i, j, nx: dx / d, ny: dy / d, nz: dz / d, depth: cd - d, pn: world.warm.get(key) || 0, key, ptx: 0, pty: 0, ptz: 0 };",
  "const cnt = { i, j, nx: dx / d, ny: dy / d, nz: dz / d, depth: cd - d, pn: world.warm.get(key) || 0, fresh: !world.warm.has(key), cl0: Math.max(0, -((bj.vx - bi.vx) * (dx / d) + (bj.vy - bi.vy) * (dy / d) + (bj.vz - bi.vz) * (dz / d))), key, ptx: 0, pty: 0, ptz: 0 };",
  'phys-fresh-cl0')

# 3. phys.js: module health, the deadweight rule on the rubble sky
sub1('src/game/rubbleworlds/phys.js',
  "      for (const cnt of contacts) world.warm.set(cnt.key, cnt.pn);",
  """      for (const cnt of contacts) world.warm.set(cnt.key, cnt.pn);
      // MODULE HEALTH, the deadweight rule read on this sky: a strike wounds
      // once, at first touch, by its closing speed past the graze, capped per
      // module per frame, with a 30-frame cooldown so a tumble cannot grind a
      // hull to dust. The graze sits at 40 — measured: this well's own fall
      // arrives near 40, so a braked approach bruises and a hard one wounds.
      // Hull-on-hull pairs carry the weld's law, not a wound. A module at
      // zero is gone for good; the surrounding cross shields the cabin.
      if (world.ship) {
        const SHIP_GRAZE = 40, SHIP_DMG = 1.0, SHIP_CAP = 55;
        for (const cnt of contacts) {
          const bi = wb[cnt.i], bj = wb[cnt.j];
          if (!cnt.fresh || bi.ship === bj.ship) continue;
          const dmg = Math.min(SHIP_CAP, Math.max(0, cnt.cl0 - SHIP_GRAZE) * SHIP_DMG);
          if (dmg <= 0) continue;
          const s2 = bi.ship ? bi : bj;
          s2.dmgF = (s2.dmgF || 0) + dmg;
        }
        for (const b of wb) {
          if (b.dmgCd > 0) b.dmgCd--;
          if (!b.ship || !b.dmgF) continue;
          if (!b.dmgCd) { b.hp -= Math.min(SHIP_CAP, b.dmgF); b.dmgCd = 30; if (b.hp <= 0) b.alive = false; }
          b.dmgF = 0;
        }
      }""",
  'phys-damage')

# 4. phys.js: the hull that answers the helm
sub1('src/game/rubbleworlds/phys.js',
  "export { DT, SF, G, BS, BR, PMASS, ITERS, SLOP, BETA, BIAS_CAP, WELD_BREAK, WELD_BIAS, SLEEP_V, WAKE_TIDE, WELD_STRENGTH_BY_SIZE, C30, S30, stepWorld, predictShip };",
  """// the hull that still answers the helm: ship blocks weld-connected to the
// cabin, walked over living welds. Null with the cabin dead. The engine
// flag says whether a working engine sits inside that connected hull.
function shipConn(world) {
  const wb = world.blocks;
  const cab = wb.find(b => b.ship && b.cab && b.alive);
  if (!cab) return null;
  const set = new Set([cab]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const w of world.welds) {
      if (!w.alive) continue;
      const a = wb[w.a], b = wb[w.b];
      if (!a.ship || !b.ship || !a.alive || !b.alive) continue;
      if (set.has(a) && !set.has(b)) { set.add(b); grew = true; }
      else if (set.has(b) && !set.has(a)) { set.add(a); grew = true; }
    }
  }
  let eng = false; for (const b of set) if (b.eng) eng = true;
  return { set: [...set], eng, cab };
}
export { DT, SF, G, BS, BR, PMASS, ITERS, SLOP, BETA, BIAS_CAP, WELD_BREAK, WELD_BIAS, SLEEP_V, WAKE_TIDE, WELD_STRENGTH_BY_SIZE, C30, S30, stepWorld, predictShip, shipConn };""",
  'phys-shipconn')

# 5. component: shipConn joins the import
sub1('src/game/RubbleWorlds.jsx',
  'import { stepWorld, predictShip, C30, S30 } from "./rubbleworlds/phys.js";',
  'import { stepWorld, predictShip, shipConn, C30, S30 } from "./rubbleworlds/phys.js";',
  'jsx-import')

# 6. component: the burn lands only on the connected hull
sub1('src/game/RubbleWorlds.jsx',
  """      if (!aim || !aim.on) return;
      if (!world.blocks.some(b2 => b2.ship && b2.eng && b2.alive)) return; // no engine, no burn — thrust belongs to the engine module
      const cost = Math.hypot(aim.vx, aim.vz);
      if (cost > world.ship.fuel) return;
      world.ship.fuel -= cost;
      if (what === "exec") world.ship.burns++;
      for (const b of world.blocks) if (b.ship && b.alive) { b.vx += aim.vx; b.vz += aim.vz; }""",
  """      if (!aim || !aim.on) return;
      const conn = shipConn(world); // the hull that answers: cabin-connected, engine aboard — connected, not merely alive
      if (!conn || !conn.eng) return;
      const cost = Math.hypot(aim.vx, aim.vz);
      if (cost > world.ship.fuel) return;
      world.ship.fuel -= cost;
      if (what === "exec") world.ship.burns++;
      for (const b of conn.set) { b.vx += aim.vx; b.vz += aim.vz; }""",
  'jsx-burn-conn')

# 7. component: the cabin's death ends the flight
sub1('src/game/RubbleWorlds.jsx',
  """      if (world.gate && !world.gate.reached && world.shipTrack && !planFrozen &&
          Math.hypot(world.shipTrack.x - world.gate.x, world.shipTrack.z - world.gate.z) < world.gate.r) world.gate.reached = true;""",
  """      if (world.gate && !world.gate.reached && world.shipTrack && !planFrozen &&
          Math.hypot(world.shipTrack.x - world.gate.x, world.shipTrack.z - world.gate.z) < world.gate.r) world.gate.reached = true;
      if (world.ship && !world.shipDead) {
        const cab2 = world.blocks.find(b2 => b2.ship && b2.cab);
        if (cab2 && !cab2.alive) { world.shipDead = true; world.deadAt = world.t; } // the wreck keeps drifting; only the flight ends
      }""",
  'jsx-death-check')

# 8. component: the chips read the connected hull; the report card's numbers ride the readout tick
sub1('src/game/RubbleWorlds.jsx',
  ", phase: world.shipPhase || null, aimOn: !!(world.shipAim && world.shipAim.on), engOn: !world.ship || world.blocks.some(b2 => b2.ship && b2.eng && b2.alive) }));",
  ", phase: world.shipPhase || null, aimOn: !!(world.shipAim && world.shipAim.on), engOn: !world.ship || (() => { const c2 = shipConn(world); return !!(c2 && c2.eng); })(), dead: !!world.shipDead, burns: world.ship ? world.ship.burns : 0, deadT: world.shipDead ? Math.round(world.deadAt) : null }));",
  'jsx-ui-fields')
sub1('src/game/RubbleWorlds.jsx',
  '          {ui.phase === "fly" && chip("PLAN BURN", false, () => fireBurn("plan"))}',
  '          {ui.phase === "fly" && !ui.dead && chip("PLAN BURN", false, () => fireBurn("plan"))}',
  'jsx-plan-chip')

# 9. component: the report card
sub1('src/game/RubbleWorlds.jsx',
  """      {onExit && <div onClick={onExit} style={{ position: "absolute", top: 14, right: 14, background: "rgba(245,244,240,.85)", borderRadius: 10, padding: "8px 12px", border: "1px solid rgba(0,0,0,.06)", cursor: "pointer", userSelect: "none", touchAction: "none", fontSize: 10, fontWeight: 600, letterSpacing: 1, color: "rgba(0,0,0,.45)" }}>⏏ MENU</div>}""",
  """      {onExit && <div onClick={onExit} style={{ position: "absolute", top: 14, right: 14, background: "rgba(245,244,240,.85)", borderRadius: 10, padding: "8px 12px", border: "1px solid rgba(0,0,0,.06)", cursor: "pointer", userSelect: "none", touchAction: "none", fontSize: 10, fontWeight: 600, letterSpacing: 1, color: "rgba(0,0,0,.45)" }}>⏏ MENU</div>}
      {ui.dead && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
        <div style={{ background: "rgba(245,244,240,.95)", borderRadius: 16, padding: "22px 28px", border: "1px solid rgba(0,0,0,.08)", textAlign: "center", pointerEvents: "auto" }}>
          <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 2, color: "rgba(160,40,30,.8)" }}>SHIP LOST</div>
          <div style={{ fontSize: 11, color: "rgba(0,0,0,.5)", marginTop: 8 }}>cabin destroyed · {ui.burns} burn{ui.burns !== 1 ? "s" : ""} · fuel {ui.fuel} · {ui.deadT}s</div>
          <div style={{ marginTop: 14, display: "flex", justifyContent: "center" }}>{chip("RESET", true, () => set(() => {}))}</div>
        </div>
      </div>}""",
  'jsx-report-card')
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
  const{stepWorld,shipConn,BS}=await import('./src/game/rubbleworlds/phys.js');
  for(const hash of[false,true]){
    const w=makeScenario('binary',12345,1);
    for(let s=0;s<600;s++)stepWorld(w,{welds:true,sleep:true,hash});
    console.log('evolution 10s hash='+hash,h(w.blocks.map(b=>[Math.round(b.x*1000),Math.round(b.y*1000),Math.round(b.z*1000)])));
  }
  for(const sc of SCENES)console.log(sc+' s1',h(makeScenario(sc,12345,1).blocks));
  const wa=makeScenario('ship',12345,1);
  for(let s=0;s<60;s++)stepWorld(wa,{welds:true,sleep:true,hash:false});
  console.log('adrift 1s hp',wa.blocks.filter(b=>b.ship).map(b=>Math.round(b.hp)).join(','));
  const w=makeScenario('ship',12345,1);
  stepWorld(w,{welds:true,sleep:true,hash:false});
  const R=BS*2.85+BS*1.4;
  for(const b of w.blocks.filter(b2=>b2.ship)){const ox=b.x-(-200), oz=b.z-80; b.x=R+6+ox; b.z=0+oz; b.vx=-40; b.vz=0;}
  for(let s=0;s<300;s++)stepWorld(w,{welds:true,sleep:true,hash:false});
  const conn=shipConn(w);
  console.log('impact40 hp',w.blocks.filter(b=>b.ship).map(b=>Math.round(b.hp)).join(','),'conn',conn?conn.set.length:'null','eng',conn?conn.eng:'-');
});"
```

Acceptance, exact — every line. The ship line is the named re-pin; every other hash is unchanged from T28:

```
evolution 10s hash=false 42ae90b308d1e6f6
evolution 10s hash=true 42ae90b308d1e6f6
ship s1 c2538ff163ef1494
binary s1 1ab5dec0a100e39f
duet s1 815c1643021c10c9
moons s1 55e26401d110fa2c
trio s1 7cbf8f6bbd428266
system s1 1bbb5a4a3205c09c
hole s1 cae5ebf64cc05676
adrift 1s hp 100,100,100,100,100
impact40 hp 45,45,100,45,100 conn 5 eng true
```

**3. Gate.** `node scripts/gate.mjs smoke` — 23 PASS, 0 FAIL, foreground, timeout at least 300 seconds.

**4. Version and build.** `MK = "0.5.28"`, then `npm run build`.

**5. Land.** Commit `src/game/RubbleWorlds.jsx`, `src/game/rubbleworlds/phys.js`, `src/game/rubbleworlds/gen.js`, and `src/version.js` only (plain-words lowercase subject, e.g. "damage stays damage, 0.5.28"), push. The phase document's table gains the T29 row (mark 0.5.28, status LANDED with the hashes, the ship re-pin named old→new, and the smoke count); commit, push. The owner's live flight — a crash that wounds, an engine that can be lost, a cabin whose death ends the flight with the card — is the acceptance, phone and desktop both.

## Report

- One line of outcome, then bullets.
- Read-confirmation first.
- Every acceptance line as printed; the smoke count exactly.
- The ship re-pin as its own labeled bullet, old→new.
- Fixture seeds: the gates pin 12345 by the plan's own law; the demo rolls its own seed at mount — none special.
- Both commit hashes.
- Every deviation its own labeled bullet.
