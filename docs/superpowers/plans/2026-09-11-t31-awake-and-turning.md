# T31: awake and turning (0.5.30)

Two changes from the owner's flight report: the catamaran defect, diagnosed and measured, and the hull turning to face its trajectory line.

- **A ship never sleeps.** The physics lets a calm clump of ten or more blocks sleep as one frozen body. The catamaran is the only hull big enough — eleven blocks — so it froze into a stone the moment it sat calm: burns wrote speed onto its blocks and the sleeping body immediately overwrote them, so the plume fired, the fuel spent, and nothing moved. One condition ends it: a clump containing a ship block stays awake. Measured after the fix: the catamaran takes its burn, flies whole, all fourteen welds and full health after ten seconds of free flight.
- **The hull turns with the trajectory line.** While time is frozen for aiming or planning, the connected hull rotates rigidly about its own center to face where the aim arrow points, so the engines sit aft of the line and the nose leads it. Positions turn; speeds do not — facing is the pilot's statement, the ark's way, and costs nothing until the burn fires. Measured: a quarter turn moves no weld length by more than one part in a hundred million million.

Choices made plainly in this plan:

- The turn rotates only the hull still welded to the cabin; torn-off blocks stay where they drift.
- A hull that is tumbling when the plan freeze takes turns to the aim exactly like a still one; its internal spin resumes on unfreeze and the welds absorb the small disagreement.
- No generation numbers change; the acceptance shows every pinned number standing.

The whole change was applied to a scratch copy at plan-writing time: every anchor hit exactly once, every file parses, every acceptance line below reproduced.

## Required reading

- This plan, whole.
- `src/game/RubbleWorlds.jsx` — whole.
- `src/game/rubbleworlds/phys.js` — the sleep decision inside the clump scan (search "SLEEP_V") and the header comment.

## Suggested model

Sonnet. Two anchored substitutions, both pre-verified; no design remains.

## Steps

**1. The substitutions.** Every edit is one anchored replacement; an anchor that does not appear exactly once stops the task. From the repo root:

```bash
python3 - <<'PYEOF'
import sys
def sub1(path, old, new, tag):
    s = open(path).read()
    if s.count(old) != 1: sys.exit("anchor fail: %s (count %d)" % (tag, s.count(old)))
    open(path, 'w').write(s.replace(old, new))

# 1. phys.js: a ship never sleeps
sub1('src/game/rubbleworlds/phys.js',
  "          if (!k.sleep || g.ids.length < 10 || near || g.rel >= SLEEP_V) { for (const i of g.ids) wb[i].sleeping = false; continue; }",
  "          if (!k.sleep || g.ids.length < 10 || near || g.rel >= SLEEP_V || g.ids.some(i => wb[i].ship)) { for (const i of g.ids) wb[i].sleeping = false; continue; } // A SHIP NEVER SLEEPS: the eleven-block catamaran crossed the ten-block sleep line and froze into a stone that ignored its burns (measured, 2026-09-11)",
  'phys-ship-never-sleeps')

# 2. component: the hull turns with the trajectory line
sub1('src/game/RubbleWorlds.jsx',
  '      const planFrozen = world.ship && (world.shipPhase === "aim" || world.shipPhase === "plan" || (world.shipPaused && world.shipPhase === "fly")); // the ark holds the sky while you aim — time starts at LAUNCH',
  '''      // the hull turns with the trajectory line: while time is frozen the
      // connected hull rotates rigidly about its own center to face the aim.
      // Positions turn; velocities do not — facing is the pilot's statement,
      // the ark's way, and costs nothing until the burn fires.
      if (world.ship && world.shipAim && world.shipAim.on && (world.shipPhase === "aim" || world.shipPhase === "plan")) {
        const tgt = Math.atan2(world.shipAim.vz, world.shipAim.vx);
        let dAng = tgt - (world.shipAng || 0);
        if (dAng > Math.PI) dAng -= 2 * Math.PI; if (dAng < -Math.PI) dAng += 2 * Math.PI;
        if (Math.abs(dAng) > 0.0005) {
          const c4 = shipConn(world);
          if (c4) {
            let mx = 0, mz = 0, M = 0;
            for (const b of c4.set) { mx += b.x * b.m; mz += b.z * b.m; M += b.m; }
            mx /= M; mz /= M;
            const co = Math.cos(dAng), si = Math.sin(dAng);
            for (const b of c4.set) {
              const rx = b.x - mx, rz = b.z - mz;
              b.x = mx + rx * co - rz * si; b.z = mz + rx * si + rz * co;
            }
            world.shipAng = tgt;
          }
        }
      }
      const planFrozen = world.ship && (world.shipPhase === "aim" || world.shipPhase === "plan" || (world.shipPaused && world.shipPhase === "fly")); // the ark holds the sky while you aim — time starts at LAUNCH''',
  'jsx-hull-turns')
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
  const{stepWorld,shipConn}=await import('./src/game/rubbleworlds/phys.js');
  for(const hash of[false,true]){
    const w=makeScenario('binary',12345,1);
    for(let s=0;s<600;s++)stepWorld(w,{welds:true,sleep:true,hash});
    console.log('evolution 10s hash='+hash,h(w.blocks.map(b=>[Math.round(b.x*1000),Math.round(b.y*1000),Math.round(b.z*1000)])));
  }
  for(const sc of SCENES)console.log(sc+' s1',h(makeScenario(sc,12345,1).blocks));
  const w=makeScenario('ship',12345,1,'catamaran');
  stepWorld(w,{welds:true,sleep:true,hash:false});
  for(const b of w.blocks)if(b.ship&&b.alive)b.vx+=-50;
  let minHp=100;
  for(let s=0;s<600;s++){stepWorld(w,{welds:true,sleep:true,hash:false});for(const b of w.blocks)if(b.ship)minHp=Math.min(minHp,b.hp);}
  const conn=shipConn(w);
  const ships=w.blocks.filter(b=>b.ship&&b.alive);
  const maxV=Math.max(...ships.map(b=>Math.hypot(b.vx,b.vz)));
  console.log('catamaran burn: conn',conn?conn.set.length:'null','of',ships.length,'welds',w.welds.filter(x=>x.alive&&w.blocks[x.a].ship).length,'minHp',Math.round(minHp),'speed',Math.round(maxV));
});"
```

Acceptance, exact — every line, and every number unchanged from T30:

```
evolution 10s hash=false 42ae90b308d1e6f6
evolution 10s hash=true 42ae90b308d1e6f6
ship s1 3f0c91218aef32ab
binary s1 1ab5dec0a100e39f
duet s1 815c1643021c10c9
moons s1 55e26401d110fa2c
trio s1 7cbf8f6bbd428266
system s1 1bbb5a4a3205c09c
hole s1 cae5ebf64cc05676
catamaran burn: conn 11 of 11 welds 14 minHp 100 speed 32
```

**3. Gate.** `node scripts/gate.mjs smoke` — 23 PASS, 0 FAIL, one run. If the tool moves it to the background past its two-minute window, wait and read the pass from the tail of `.superpowers/gates.log` — do not start a second run.

**4. Version and build.** `MK = "0.5.30"`, then `npm run build`.

**5. Land.** Commit `src/game/RubbleWorlds.jsx`, `src/game/rubbleworlds/phys.js`, and `src/version.js` only (plain-words lowercase subject, e.g. "awake and turning, 0.5.30"), push. The phase document's table gains the T31 row (mark 0.5.30, status LANDED, numbers unchanged, the smoke count); commit, push. The owner's live flight — a catamaran that answers its burns, every hull swinging its nose along the aim line as he drags — is the acceptance, phone and desktop both.

## Report

- One line of outcome, then bullets.
- Read-confirmation first.
- Every acceptance line as printed; the smoke count exactly.
- Fixture seeds: the gates pin 12345 by the plan's own law; the demo rolls its own seed at mount — none special.
- Both commit hashes.
- Every deviation its own labeled bullet.
