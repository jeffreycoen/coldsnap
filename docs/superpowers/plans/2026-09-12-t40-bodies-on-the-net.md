# T40: bodies on the net (0.5.39)

The woven net is pushed down the screen by the local well depth; until now everything else — cubes, stars, the ship, the lines, the gate ring, the compass, the hole — was drawn on the flat plane. So every body hovered above its own dip by the dip's full depth: about 97 units of screen in the twins, 110 to 180 in the star system, and 230 to 340 on the map under three stars — three times a planet's height. Now every projected point sinks by the same depth the net uses at that spot, and bodies sit in their bowls at every scale.

- **One rule.** The screen projection adds the well depth at the point being drawn — the very function the net samples on its grid. Every call site inherits it: the stars' art, the ship's arrow and ghost, the other bodies' lines, the gate ring, the compass, the engine plume, the hole. The net itself is unchanged; it already carried the depth.
- **One dip per body.** The cubes are the one place cost mattered — a depth lookup per cube costs about 3 milliseconds a frame on the map. Instead each clump sinks by the depth at its own center, looked up once per body per frame — a third of a millisecond — and a body stays rigid instead of tilting into its well. Measured at the map's bodies: dips of 151 to 343 screen units at unit scale, exactly the heights they hovered at before.
- The depth-sort keeps its order by ground position; the dip is a smooth field, so no body draws through the fabric that a neighbor would have hidden.

Drawing only: the physics, the generator, and every pinned number are untouched, and the acceptance proves it.

Choices made plainly in this plan: the dip per clump comes from the clump's center; a block with no clump yet sinks by the depth at its own spot.

The whole change was applied to a fresh copy of the live tree at plan-writing time from this exact script: every anchor hit exactly once, the file parses and builds, every acceptance line below reproduced.

## Required reading

- This plan, whole.
- `src/game/rubbleworlds/draw.js` — the frame's opening block through the net, and the cube loop.

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
DRAW='src/game/rubbleworlds/draw.js'
# 1. every projected point sinks by the well depth at its spot — the same number the net uses — so bodies sit ON the net
sub1(DRAW,"      const iso = (x, z, y) => ({ x: cx + (x - z) * C30 * sc, y: cy + (x + z) * S30 * sc - (y || 0) * 0.9 * sc });",
'''      // BODIES SIT ON THE NET: the net is pushed down the screen by the local
      // well depth, and until now everything else was drawn on the flat plane —
      // so every body hovered above its own dip by the dip's full depth, three
      // times its height on the map under three stars. Now every projected
      // point sinks by the same depth the net uses at that spot.
      const getD = (sx2, sz2) => wellDepth(sx2, sz2, world.wells, sc);
      const isoRaw = (x, z, y) => ({ x: cx + (x - z) * C30 * sc, y: cy + (x + z) * S30 * sc - (y || 0) * 0.9 * sc });
      const iso = (x, z, y) => { const p = isoRaw(x, z, y); p.y += getD(x, z); return p; };
      // one dip per body: a clump's blocks all sink by the depth at the clump's center, so a body stays rigid and the lookup is paid once per body, not once per cube
      const dipOf = new Map();
      const dipAt = (b) => { const c = world.clumpCenter && world.clumpCenter.get(b.clump); if (!c) return getD(b.x, b.z); let d = dipOf.get(b.clump); if (d == null) { d = getD(c[0], c[2]); dipOf.set(b.clump, d); } return d; };''','iso-sinks')
sub1(DRAW,"      const getD = (sx2, sz2) => wellDepth(sx2, sz2, world.wells, sc);\n      const gxa",
       "      const gxa",'getD-moved')
# 2. the cubes: raw projection plus the body's one dip
sub1(DRAW,"        const p = iso(lx(b), lz(b), ly(b)), rgb = b.sleeping || b.ship ? tints[b.tint] : [214, 74, 52];",
       "        const p = isoRaw(lx(b), lz(b), ly(b)), rgb = b.sleeping || b.ship ? tints[b.tint] : [214, 74, 52];\n        p.y += dipAt(b);",'cubes-dip')
print("all substitutions in")
PYEOF
```

Expected output, exact: `all substitutions in`.

**2. The physics gate.** Nothing in the physics or the generator moves; every number must stand, and the dips are arithmetic. The command, whole:

```bash
node -e "
import('node:crypto').then(async({createHash})=>{
  const h=o=>createHash('sha256').update(JSON.stringify(o)).digest('hex').slice(0,16);
  const{makeScenario}=await import('./src/game/rubbleworlds/gen.js');
  const{stepWorld,SF,G}=await import('./src/game/rubbleworlds/phys.js');
  for(const hash of[false,true]){const w=makeScenario('binary',12345,1);for(let s=0;s<600;s++)stepWorld(w,{welds:true,sleep:true,hash});console.log('evolution 10s hash='+hash,h(w.blocks.map(b=>[Math.round(b.x*1000),Math.round(b.y*1000),Math.round(b.z*1000)])));}
  for(const sc of['ship','binary','duet','moons','trio','system','hole','map'])console.log(sc+' s1',h(makeScenario(sc,12345,1).blocks));
  function wellDepth(x,z,wells,sc){let pP=0,pD=0;for(const w of wells){const r2=(w.x-x)**2+(w.z-z)**2+SF*SF;const p=G*w.m/(1.3*Math.pow(r2,0.65));if(w.deep)pD+=p;else pP+=p;}return Math.min(Math.sqrt(pP)*0.38,150)*sc+Math.min(Math.sqrt(pD)*1.15,560)*sc;}
  const w=makeScenario('map',12345,1);stepWorld(w,{welds:true,sleep:true,hash:true});
  console.log('map body dips (screen units at scale 1):',w.tracks.filter(t=>t.m>=500).map(t=>Math.round(wellDepth(t.x,t.z,w.wells,1))).join(' '));
});"
```

Acceptance, exact — every line:

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
map s1 9c735648f4cb3502
map body dips (screen units at scale 1): 317 298 228 318 343 265 317 263 151
```

**3. Gate.** `node scripts/gate.mjs smoke` — 23 PASS, 0 FAIL, one run. If the tool moves it to the background past its two-minute window, wait and read the pass from the tail of `.superpowers/gates.log` — do not start a second run.

**4. Version and build.** `MK = "0.5.39"`, then `npm run build`.

**5. Land.** Commit `src/game/rubbleworlds/draw.js` and `src/version.js` only (plain-words lowercase subject, e.g. "bodies on the net, 0.5.39"), push. The phase document's table marks T40 LANDED (mark 0.5.39, all numbers unchanged, the smoke count); commit with this plan file, push. The owner's live check — bodies resting in their bowls on the map and in every small scene — is the acceptance, phone and desktop both.

## Report

- One line of outcome, then bullets.
- Read-confirmation first.
- Every acceptance line as printed; the smoke count exactly.
- Fixture seeds: the gate pins 12345 by the plan's own law; the demo rolls its own seed at mount — none special.
- Both commit hashes.
- Every deviation its own labeled bullet.
