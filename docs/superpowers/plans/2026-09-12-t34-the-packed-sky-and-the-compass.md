# T34: the packed sky and the compass (0.5.33)

The map stops being a slow drift and becomes the brawl it is for. Every orbit distance drops to a third of what held stable, the bodies stay their size, and the sky is full: first welds tear within three to five seconds, and a third to half of all blocks are eaten by the stars inside two minutes. An end gate stands on the far rim, opposite the spawn, so the short line runs through the densest sky and the safe way is the long way around. A compass points to it.

- **The packing.** Lesser stars at 633 and 933; great-ring planets at 233, 400, 600, 867; lesser-star planets at 70 and 125 from their star; moons at 45 from their host; the map about 2000 across. Nested orbits sit slightly wider than an exact third where an exact third would put two bodies touching at birth — measured across rolled seeds, the tightest birth gap is 10, always a moon to its host, never an overlap.
- **The end gate.** The ark's ring, radius 36, on the far rim opposite the ship's spawn. It pulls the ship as the ship scene's gate does, the aim snap bends toward it, and reaching it turns it green — all through the gate machinery already landed. A straight shot from spawn at the launch cap threads it in the predictor, 1992 units out.
- **The compass.** Whenever the ring is off screen, an arrow sits at the screen's edge on the line to it, the ship's distance printed beside it as GATE and a number. It folds away the moment the ring itself is in view, and after the ring is reached.

Measured cost, stated plainly, from three rolled seeds flown two simulated minutes on the bench machine: physics averages 13 to 28 milliseconds a step during the brawl, a quarter to three quarters of frames over 16 milliseconds, worst single frames 140 to 180. The packed map runs its violence at roughly 30 to 45 frames a second here, with hitches, not at 60. The owner's phone and desktop are not this machine; the live check decides whether that reads as violence or as stutter. Nothing reaches not-a-number; every seed stays bounded.

Design choices, stated plainly: the distances above; the spawn at 95 percent of the reach on one side and the gate at 95 percent on the other; compass color the gate's own teal; the map's generation number changes because every body moves — old `b21af822f4ebe4a4`, new `acace0dbe7852764`; every other scene stays identical and the acceptance proves it.

The whole change was applied to a fresh copy of the live tree at plan-writing time from this exact script: every anchor hit exactly once, every file parses, every acceptance line below reproduced.

## Required reading

- This plan, whole.
- `src/game/rubbleworlds/gen.js` — the map branch and the lines after the scene chain.
- `src/game/rubbleworlds/draw.js` — the gate ring block and the ghost block that follows it.

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
GEN='src/game/rubbleworlds/gen.js'; DRAW='src/game/rubbleworlds/draw.js'

# 1. gen.js: the sky packs to a third of its distances; nested orbits only as tight as bodies clear at birth
sub1(GEN,"[[1900, 60000, 1], [2800, 60000, 2]].forEach","[[633, 60000, 1], [933, 60000, 2]].forEach",'lessers')
sub1(GEN,"[[3, 700], [4, 1200], [5, 1800], [6, 2600]].forEach","[[3, 233], [4, 400], [5, 600], [6, 867]].forEach",'rings')
sub1(GEN,"for (const st of lessers) for (const lr0 of [180, 320]) {","for (const st of lessers) for (const lr0 of [70, 125]) {",'lesser-planets')
sub1(GEN,"const r = 120 * nud(), a = ang(), v = vCirc(host[5], r) * nud();","const r = 45 * nud(), a = ang(), v = vCirc(host[5], r) * nud();",'moons')
sub1(GEN,"    world.span = 3000;","    world.span = 1000;",'span')
# 2. gen.js: the ship spawns on the near rim; the end gate stands on the far rim, opposite
sub1(GEN,'  if (kind === "map") addShip(world, hull, -world.span * 0.9, world.span * 0.28);',
       '  if (kind === "map") { addShip(world, hull, -world.span * 0.95, world.span * 0.3); world.gate = { x: world.span * 0.95, z: -world.span * 0.3, r: 36, reached: false }; }','ship-gate')
# 3. gen.js: the map's own comment tells the packed truth
sub1(GEN,"    // ratified stable; the seed's 3% stir and random phase make each map its own.",
       "    // PACKED to a third of the distances that held stable: the sky is a brawl\n    // from the first seconds by design — chaos is the content. The seed's 3% stir\n    // and random phase make each map its own. An end gate stands on the far rim.",'comment')

# 4. draw.js: the compass to the gate
sub1(DRAW,"      // the aimed burn's TRUTHFUL ghost: the ark's own predictor, blue while",
'''      // THE COMPASS: when the gate ring is off screen, an arrow at the screen's
      // edge on the line to it, the distance from the ship printed beside it;
      // it folds away the moment the ring itself is in view
      if (world.gate && !world.gate.reached && world.shipTrack) {
        const gp = iso(world.gate.x, world.gate.z, 0), pad = 24;
        if (gp.x < -pad || gp.x > W + pad || gp.y < -pad || gp.y > H + pad) {
          const cx2 = W / 2, cy2 = H / 2, dx = gp.x - cx2, dy = gp.y - cy2;
          const inset = 44, hw = W / 2 - inset, hh = H / 2 - inset;
          const t = Math.min(hw / Math.max(Math.abs(dx), 1e-6), hh / Math.max(Math.abs(dy), 1e-6));
          const ax = cx2 + dx * t, ay = cy2 + dy * t, ang = Math.atan2(dy, dx);
          const dist = Math.round(Math.hypot(world.gate.x - world.shipTrack.x, world.gate.z - world.shipTrack.z));
          ctx.save(); ctx.translate(ax, ay); ctx.rotate(ang);
          ctx.fillStyle = "rgba(40,150,170,.9)";
          ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -9); ctx.lineTo(-4, 0); ctx.lineTo(-8, 9); ctx.closePath(); ctx.fill();
          ctx.restore();
          ctx.font = "700 11px -apple-system,sans-serif"; ctx.fillStyle = "rgba(40,150,170,.9)"; ctx.textAlign = "center";
          ctx.fillText("GATE " + dist, ax - Math.cos(ang) * 30, ay - Math.sin(ang) * 30 + 4); ctx.textAlign = "left";
        }
      }
      // the aimed burn's TRUTHFUL ghost: the ark's own predictor, blue while''','compass')
print("all substitutions in")
PYEOF
```

Expected output, exact: `all substitutions in`.

**2. The physics gate.** Every existing scene byte-identical; the map's new number; the gate threadable from spawn. The command, whole:

```bash
node -e "
import('node:crypto').then(async({createHash})=>{
  const h=o=>createHash('sha256').update(JSON.stringify(o)).digest('hex').slice(0,16);
  const{makeScenario}=await import('./src/game/rubbleworlds/gen.js');
  const{stepWorld,predictShip}=await import('./src/game/rubbleworlds/phys.js');
  for(const hash of[false,true]){const w=makeScenario('binary',12345,1);for(let s=0;s<600;s++)stepWorld(w,{welds:true,sleep:true,hash});console.log('evolution 10s hash='+hash,h(w.blocks.map(b=>[Math.round(b.x*1000),Math.round(b.y*1000),Math.round(b.z*1000)])));}
  for(const sc of['ship','binary','duet','moons','trio','system','hole'])console.log(sc+' s1',h(makeScenario(sc,12345,1).blocks));
  const w=makeScenario('map',12345,1);
  console.log('map s1',h(w.blocks),'blocks',w.blocks.length,'gate',w.gate.x+','+w.gate.z,'hosts',w.moonHosts.join(','));
  stepWorld(w,{welds:true,sleep:true,hash:true});
  const b0=w.blocks.find(b=>b.ship&&b.alive);w.shipTrack=null;for(const tk of w.tracks||[]){if(tk.clump===b0.clump){w.shipTrack=tk;break;}}
  const dx=w.gate.x-w.shipTrack.x,dz=w.gate.z-w.shipTrack.z,dd=Math.hypot(dx,dz);
  const pr=predictShip(w,dx/dd*110,dz/dd*110,1200);
  console.log('spawn to gate',Math.round(dd),'straight shot threads gate',pr.pts.some(p=>p.hitsGate),'pts',pr.pts.length);
});"
```

Acceptance, exact — every line. The first nine are unchanged from T33; the map line carries its new number:

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
map s1 acace0dbe7852764 blocks 1238 gate 950,-300 hosts 5,6,4
spawn to gate 1992 straight shot threads gate true pts 529
```

**3. Gate.** `node scripts/gate.mjs smoke` — 23 PASS, 0 FAIL, one run. If the tool moves it to the background past its two-minute window, wait and read the pass from the tail of `.superpowers/gates.log` — do not start a second run.

**4. Version and build.** `MK = "0.5.33"`, then `npm run build`.

**5. Land.** Commit `src/game/rubbleworlds/gen.js`, `src/game/rubbleworlds/draw.js`, and `src/version.js` only (plain-words lowercase subject, e.g. "the packed sky and the compass, 0.5.33"), push. The phase document's table marks T34 LANDED (mark 0.5.33, existing numbers unchanged, map number old→new, the smoke count); commit, push. The owner's live flight — the full sky brawling from the first seconds, the compass at the edge, the long way around to the far gate — is the acceptance, phone and desktop both.

## Report

- One line of outcome, then bullets.
- Read-confirmation first.
- Every acceptance line as printed; the smoke count exactly.
- The map's changed generation number as its own labeled bullet, old→new.
- Fixture seeds: the gate pins 12345 by the plan's own law; the demo rolls its own seed at mount — none special.
- Both commit hashes.
- Every deviation its own labeled bullet.
