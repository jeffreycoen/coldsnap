# T43: the fixed opening (0.5.42)

Temporary, until the layout is right and randomizing returns: every launch of the map opens on the same sky. The seed no longer stirs the set points or rolls the phases; every body takes a set place, laid down the corridor from the great star to the gate on the far rim. The ship starts beside the great star. Nothing sits behind the ship, nothing off to the far side.

- **Fixed phases, no stir.** The stir becomes exactly one; the phases come from a set table, drawn in the order the generator places bodies — lesser star 1, lesser star 2, the four great rings, the four lesser-star planets, the three moons. The moons ride the three outer great-ring planets, always.
- **The corridor.** Ship at (-130, 40), 136 from the great star. Great-ring planets at (83, -83), (199, 17), (260, -150), (424, 90). Lesser star 1 at (298, 108) with planets at (368, 108) and (173, 108); lesser star 2 at (383, -268) with planets at (453, -268) and (258, -268). Moons at (222, 56), (217, -165), (466, 75). Gate at (475, -150). Every body lies between the ship and the gate along the line of flight.
- **Checked once, by hand.** Birth clearance 11 at the tightest — a moon to its host — placed on the first try; a straight shot from the ship at the launch cap threads the gate without touching a body; two different seeds produce the same positions to the unit.
- **Still seeded:** each planet's block-level terrain. The sky is the same; the stones' faces vary.
- **Unwinds as before.** The orbit speeds are the set ones, so the picture opens still and comes apart the moment time runs — a starting picture, not a held pose.

The map's generation number changes because every body moves — old `9c735648f4cb3502`, new `61396c4fe573ab49`; every other scene stays identical and the acceptance proves it.

Choices made plainly in this plan: the phase table; the spawn beside the great star at 136 out, well outside its eating radius of 40; the gate unchanged.

The whole change was applied to a fresh copy of the live tree at plan-writing time from this exact script: every anchor hit exactly once, the file parses, every acceptance line below reproduced.

## Required reading

- This plan, whole.
- `src/game/rubbleworlds/gen.js` — the map branch and the line after the scene chain that places the map's ship and gate.

## Suggested model

Sonnet. Three anchored substitutions, pre-verified; no design remains.

## Steps

**1. The substitutions.** From the repo root:

```bash
python3 - <<'PYEOF'
import sys
def sub1(path, old, new, tag):
    s = open(path).read()
    if s.count(old) != 1: sys.exit("anchor fail: %s (count %d)" % (tag, s.count(old)))
    open(path, 'w').write(s.replace(old, new))
GEN='src/game/rubbleworlds/gen.js'
# 1. no stir, fixed phases: every launch opens on the same sky, laid down the corridor from the great star to the gate
sub1(GEN,"    const nud = () => 1 + (rand() - 0.5) * 2 * 0.03;\n    const ang = () => rand() * Math.PI * 2;",
'''    // FIXED OPENING (temporary, until the layout is right and randomizing
    // returns): no stir, and every body takes a set phase. The phases lay the
    // whole family down the corridor from the great star to the gate on the
    // far rim — nothing behind the ship, nothing off to the far side. Drawn in
    // order: lesser star 1, lesser star 2, the four great rings, the four
    // lesser-star planets, the three moons. Degrees, zero toward +x.
    const PHASES = [20, -35, -45, 5, -30, 12, 0, 180, 0, 180, 60, 200, -20];
    let phaseAt = 0;
    const nud = () => 1;
    const ang = () => (PHASES[phaseAt++] || 0) * Math.PI / 180;''','fixed-phases')
# 2. the moons ride the three outer great-ring planets, always
sub1(GEN,"      moonHosts = []; while (moonHosts.length < 3) { const p = 4 + Math.floor(rand() * 3); if (!moonHosts.includes(p)) moonHosts.push(p); }",
       "      moonHosts = [4, 5, 6];",'moon-hosts')
# 3. the ship starts beside the great star; the gate stays on the far rim
sub1(GEN,'  if (kind === "map") { addShip(world, hull, -world.span * 0.95, world.span * 0.3, 4); world.gate',
       '  if (kind === "map") { addShip(world, hull, -130, 40, 4); world.gate','spawn')
print("all substitutions in")
PYEOF
```

Expected output, exact: `all substitutions in`.

**2. The physics gate.** Every other scene byte-identical; the map's new number; the layout's positions; clearance; the same sky on two seeds; the gate threadable from spawn. The command, whole:

```bash
node -e "
import('node:crypto').then(async({createHash})=>{
  const h=o=>createHash('sha256').update(JSON.stringify(o)).digest('hex').slice(0,16);
  const{makeScenario}=await import('./src/game/rubbleworlds/gen.js');
  const{stepWorld,predictShip}=await import('./src/game/rubbleworlds/phys.js');
  for(const hash of[false,true]){const w=makeScenario('binary',12345,1);for(let s=0;s<600;s++)stepWorld(w,{welds:true,sleep:true,hash});console.log('evolution 10s hash='+hash,h(w.blocks.map(b=>[Math.round(b.x*1000),Math.round(b.y*1000),Math.round(b.z*1000)])));}
  for(const sc of['ship','binary','duet','moons','trio','system','hole'])console.log(sc+' s1',h(makeScenario(sc,12345,1).blocks));
  const w=makeScenario('map',12345,1);
  console.log('map s1',h(w.blocks),'tries',w.placeTries,'hosts',w.moonHosts.join(','));
  const fams=new Map();
  for(const b of w.blocks){const k=b.ship?'ship':b.fam;let g=fams.get(k);if(!g){g={x:0,z:0,n:0,r:0,pts:[]};fams.set(k,g);}g.x+=b.x;g.z+=b.z;g.n++;g.pts.push(b);}
  for(const g of fams.values()){g.x/=g.n;g.z/=g.n;for(const b of g.pts)g.r=Math.max(g.r,Math.hypot(b.x-g.x,b.z-g.z)+3);}
  console.log('bodies:',[...fams.entries()].map(([k,g])=>k+'@'+Math.round(g.x)+','+Math.round(g.z)).join(' '));
  console.log('stars:',w.starBodies.map(st=>st.fam+'@'+Math.round(st.x)+','+Math.round(st.z)).join(' '),'gate',w.gate.x+','+w.gate.z);
  let minGap=1e9;const arr=[...fams.entries()];
  for(let i=0;i<arr.length;i++)for(let j=i+1;j<arr.length;j++){const a=arr[i][1],b=arr[j][1];minGap=Math.min(minGap,Math.hypot(a.x-b.x,a.z-b.z)-a.r-b.r);}
  for(const [k,g] of arr)for(const st of w.starBodies)minGap=Math.min(minGap,Math.hypot(g.x-st.x,g.z-st.z)-g.r-st.r);
  console.log('birth min gap',Math.round(minGap));
  stepWorld(w,{welds:true,sleep:true,hash:true});
  const w2=makeScenario('map',777,1);stepWorld(w2,{welds:true,sleep:true,hash:true});
  const pos=(ww)=>ww.tracks.filter(t=>t.m>=500).map(t=>Math.round(t.x)+','+Math.round(t.z)).join(' ');
  console.log('same sky on two seeds:',pos(w)===pos(w2));
  const b0=w.blocks.find(b=>b.ship&&b.alive);w.shipTrack=null;for(const tk of w.tracks||[]){if(tk.clump===b0.clump){w.shipTrack=tk;break;}}
  const dx=w.gate.x-w.shipTrack.x,dz=w.gate.z-w.shipTrack.z,dd=Math.hypot(dx,dz);
  const pr=predictShip(w,dx/dd*440,dz/dd*440,1200);
  console.log('spawn to gate',Math.round(dd),'straight shot at 440: threads gate',pr.pts.some(p=>p.hitsGate),'hit',pr.pts.some(p=>p.hit),'pts',pr.pts.length);
});"
```

Acceptance, exact — every line. The first nine are unchanged; the map line carries its new number:

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
map s1 61396c4fe573ab49 tries 1 hosts 4,5,6
bodies: 3@83,-83 4@199,17 5@260,-150 6@424,90 7@368,108 8@173,108 9@453,-268 10@258,-268 11@222,56 12@217,-165 13@466,75 ship@-130,40
stars: 0@0,0 1@298,108 2@383,-268 gate 475,-150
birth min gap 11
same sky on two seeds: true
spawn to gate 634 straight shot at 440: threads gate true hit false pts 41
```

**3. Gate.** `node scripts/gate.mjs smoke` — 23 PASS, 0 FAIL, one run. If the tool moves it to the background past its two-minute window, wait and read the pass from the tail of `.superpowers/gates.log` — do not start a second run.

**4. Version and build.** `MK = "0.5.42"`, then `npm run build`.

**5. Land.** Commit `src/game/rubbleworlds/gen.js` and `src/version.js` only (plain-words lowercase subject, e.g. "the fixed opening, 0.5.42"), push. The phase document's table marks T43 LANDED (mark 0.5.42, existing numbers unchanged, map number old→new, the smoke count); commit with this plan file, push. The owner's live check — the same sky every launch, the ship beside the great star, the whole family laid down the corridor to the gate — is the acceptance, phone and desktop both.

## Report

- One line of outcome, then bullets.
- Read-confirmation first.
- Every acceptance line as printed; the smoke count exactly.
- The map's changed generation number as its own labeled bullet, old→new.
- Fixture seeds: the gate pins 12345 and 777 by the plan's own law; the demo rolls its own seed at mount — none special.
- Both commit hashes.
- Every deviation its own labeled bullet.
