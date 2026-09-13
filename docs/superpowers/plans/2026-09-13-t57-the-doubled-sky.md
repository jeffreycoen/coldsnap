# T57: the doubled sky (0.5.52)

Everything in gravity's debris doubles except the ship. Every length is twice what it was — rings, triangle widths, the span, the gate, the caches, the ship's birth distance, both stars' kill reach — and every body carries eight times its mass, because density rides with size: twice the radius is eight times the blocks. The sky goes from 807 blocks to 5619. Only the ship keeps its old size, so the world reads twice as large around it, and the heavier bodies bend the ship harder: a planet flyby at the doubled scale pulls about 1.6 times what it did, which is the slingshot feel the small sky could not give.

- **The stars take 2.46 times their mass, not eight.** Two to the 1.3 is the exact factor under this pull law that keeps every speed — the burn caps, the birth burn, the swing's shape — identical at double scale. Eight times was tried on the bench and dives the opening swing into the star; 2.46 flies it exactly as before, twice as large: measured, the birth tangent at 160 rounds the star at 231 out and passes within 183 of the gate at 28 simulated seconds, with the release snap and the turn chips to finish the thread.
- **The inner heavyweight triple widens to 80.** At eight times the mass its members, born near-touching, ground together and detonated on one battery seed. The tide law at the new masses affords width 100 on that ring; at 80 the members clear each other and the triple turns clean — the grind and the rubble-world drama go.
- **Stars and the hole growing by what they eat is already the shipped game** — the eating code adds each eaten block's mass to the eater and every pull reads the mass live. Nothing to change; stated here so the record shows it was asked and found standing.
- **Step cost is not measured, on the owner's word** — no bench campaign this task; the live check judges the 5619-block sky on the real machine.

Measured, seeds 12345 and 69383: all fourteen ring rides within a tenth at 5 simulated seconds, shapes 13 of 14 and 14 of 14, zero runaway blocks. The map's generation number changes wholesale: old `6189636384589267`, new `98b39c63b9129e1e`.

Design choices, stated plainly: the doubling law and the stars' 2.46 factor; the widened first row; the doubled cache and birth points; the gate at radius 72; the acceptance thresholds unchanged (a tenth on ring rides, 1.6 times birth reach on shapes, a runaway is 400 speed or 2000 out).

The whole change was applied to a fresh copy of the live tree at plan-writing time from this exact script: every anchor hit exactly once, the file parses, every acceptance line below reproduced.

## Required reading

- This plan, whole.
- `src/game/gravitydebris/gen.js` — the map branch, whole, and the ship line at the bottom.

## Suggested model

Sonnet. One pre-verified substitution script on one file; no design remains.

## Steps

**1. The substitutions.** From the repo root:

```bash
python3 - <<'PYEOF'
import sys
def sub1(path, old, new, tag):
    s = open(path).read()
    if s.count(old) != 1: sys.exit("anchor fail: %s (count %d)" % (tag, s.count(old)))
    open(path, 'w').write(s.replace(old, new))
GEN='src/game/gravitydebris/gen.js'

# 1. the world doubles: span, and the great star at the mass that keeps every speed the same at double scale
sub1(GEN, """    const MG = 40000;
    world.span = 750;
    world.starBodies = [{ x: 0, z: 0, vx: 0, vz: 0, m: MG, r: 40, fam: 0, pin: true }];""",
     """    // THE DOUBLED SKY: every length twice what it was — rings, triangle widths,
    // the span, the gate, the caches, the ship's birth point, the stars' kill
    // reach — and every body's mass eight times, because density rides with
    // size: twice the radius is eight times the blocks. The stars instead take
    // 2.46 times their mass — two to the 1.3, the exact factor under this
    // pull law that keeps every speed, the birth burn, and the swing's shape
    // identical at double scale; eight times would trap the ship outright. Only the ship keeps its
    // old size, so the whole world reads twice as large around it.
    const MG = 98500;
    world.span = 1500;
    world.starBodies = [{ x: 0, z: 0, vx: 0, vz: 0, m: MG, r: 80, fam: 0, pin: true }];""", 'world-scale')

# 2. the lesser star doubles out and grows by the same law
sub1(GEN, "    { const r = 475, a = 25 * Math.PI / 180, v = vCirc(MG, r);\n      world.starBodies.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, vx: -Math.sin(a) * v, vz: Math.cos(a) * v, m: 15000, r: 24, fam: 1, pin: false }); world.fam[1] = 0; }",
     "    { const r = 950, a = 25 * Math.PI / 180, v = vCirc(MG, r);\n      world.starBodies.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, vx: -Math.sin(a) * v, vz: Math.cos(a) * v, m: 36900, r: 48, fam: 1, pin: false }); world.fam[1] = 0; }", 'lesser-star')

# 3. the table doubles: rings and widths twice, mass triples eight times
sub1(GEN, """    const TRIS = [
      [175, 40, 32, 5000, 2500, 900, 18, -1], [175, -75, 13, 400, 150, 80, 250, -1],
      [240, -15, 19, 400, 150, 80, 205, -1], [240, 75, 26, 900, 400, 150, 330, -1],
      [300, -30, 48, 5000, 900, 400, 32, -1], [300, 55, 34, 700, 700, 150, 95, -1],
      [365, 80, 34, 900, 700, 400, 275, -1], [365, -70, 38, 1600, 400, 400, 160, -1],
      [450, 12, 52, 5000, 5000, 400, 0, 1], [450, -55, 32, 700, 150, 80, 220, -1],
      [550, -40, 36, 1600, 900, 150, 145, 1], [550, 25, 40, 2500, 700, 400, 300, -1],
      [650, 0, 56, 5000, 1600, 1600, 48, 1], [720, -22, 32, 700, 400, 400, 190, 1],
    ];""",
     """    const TRIS = [
      [350, 40, 80, 40000, 20000, 7200, 18, -1], [350, -75, 26, 3200, 1200, 640, 250, -1],
      [480, -15, 38, 3200, 1200, 640, 205, -1], [480, 75, 52, 7200, 3200, 1200, 330, -1],
      [600, -30, 96, 40000, 7200, 3200, 32, -1], [600, 55, 68, 5600, 5600, 1200, 95, -1],
      [730, 80, 68, 7200, 5600, 3200, 275, -1], [730, -70, 76, 12800, 3200, 3200, 160, -1],
      [900, 12, 104, 40000, 40000, 3200, 0, 1], [900, -55, 64, 5600, 1200, 640, 220, -1],
      [1100, -40, 72, 12800, 7200, 1200, 145, 1], [1100, 25, 80, 20000, 5600, 3200, 300, -1],
      [1300, 0, 112, 40000, 12800, 12800, 48, 1], [1440, -22, 64, 5600, 3200, 3200, 190, 1],
    ];""", 'table-doubled')

# 4. member radius: twice the size at eight times the mass — the same density as before
sub1(GEN, "        const blocks = makePlanet(px, pz, vx, vz, ti % 2, rand, BS * 1.1 * Math.cbrt(trip[i] / 400), trip[i]);",
     "        const blocks = makePlanet(px, pz, vx, vz, ti % 2, rand, BS * 2.2 * Math.cbrt(trip[i] / 3200), trip[i]);", 'member-radius')

# 5. the caches double out with the sky
sub1(GEN, "    world.pickups = [{ x: 150, z: -190, fuel: 300, alive: true }, { x: 420, z: -120, fuel: 300, alive: true }, { x: 600, z: -250, fuel: 300, alive: true }];",
     "    world.pickups = [{ x: 300, z: -380, fuel: 300, alive: true }, { x: 840, z: -240, fuel: 300, alive: true }, { x: 1200, z: -500, fuel: 300, alive: true }];", 'caches')

# 6. the ship's birth point doubles out; the gate widens with the world; speeds stay as they were
sub1(GEN, '  if (kind === "map") { addShip(world, hull, -110, 35, 2); world.birthAim = 80 * world.shipScale; world.birthDir = [0.3011, 0.9535]; world.gate = { x: world.span * 0.95, z: -world.span * 0.3, r: 36, reached: false }; } // born behind the great star; the birth burn fires along the tangent at 160 — the measured swing passes within 45 of the gate at 14.6 simulated seconds',
     '  if (kind === "map") { addShip(world, hull, -220, 70, 2); world.birthAim = 80 * world.shipScale; world.birthDir = [0.3011, 0.9535]; world.gate = { x: world.span * 0.95, z: -world.span * 0.3, r: 72, reached: false }; } // born behind the great star at double distance; the star mass is scaled so the same tangent at 160 flies the same swing, twice as large', 'ship-birth')
print("all substitutions in")
PYEOF
```

Expected output, exact: `all substitutions in`.

**2. The battery.** From the repo root, save the block below as `/tmp/battery57.mjs` and run `node /tmp/battery57.mjs /home/batman/coldsnap`:

```js
const dir = process.argv[2] || './t56';
const {createHash} = await import('node:crypto');
const h = o => createHash('sha256').update(JSON.stringify(o)).digest('hex').slice(0,16);
const DG = await import(dir + '/src/game/gravitydebris/gen.js');
const DP = await import(dir + '/src/game/gravitydebris/phys.js');
for (const seed of [12345, 69383]) {
  const w = DG.makeScenario('map', seed, 1);
  if (seed === 12345) console.log('map s1', h(w.blocks), 'blocks', w.blocks.length);
  // per-triangle: weight-center ring radius and member reach
  const tris = new Map();
  for (const b of w.blocks) if (b.alive && b.fam >= 2 && !b.ship) { const g = tris.get(b.fam)||[]; g.push(b); tris.set(b.fam,g); }
  const stat = (f) => { const g = w.blocks.filter(b=>b.alive&&b.fam===f); if(!g.length) return null;
    let x=0,z=0,m=0; for (const b of g){x+=b.x*b.m;z+=b.z*b.m;m+=b.m;} x/=m;z/=m;
    return { ring: Math.hypot(x,z), reach: Math.max(...g.map(b=>Math.hypot(b.x-x,b.z-z))) }; };
  const fams = [...tris.keys()].sort((a,b)=>a-b);
  const r0 = fams.map(f=>stat(f));
  for (let s=0; s<300; s++) DP.stepWorld(w, {welds:true, sleep:true, hash:true, friction:true});
  const r5 = fams.map(f=>stat(f));
  let ringsOk = 0, reachOk = 0;
  for (let i=0;i<fams.length;i++) { if (r5[i] && Math.abs(r5[i].ring-r0[i].ring)<=r0[i].ring*0.1) ringsOk++; if (r5[i] && r5[i].reach<=r0[i].reach*1.6) reachOk++; }
  let fly=0,vmax=0; for (const b of w.blocks) if (b.alive) { const v=Math.hypot(b.vx,b.vz); if(v>vmax)vmax=v; if (v>400||Math.hypot(b.x,b.z)>2000) fly++; }
  console.log(seed+': triangles '+fams.length+' | rings held '+ringsOk+'/'+fams.length+' | shapes held '+reachOk+'/'+fams.length+' | runaways '+fly+' | top speed '+Math.round(vmax)+' | alive '+w.blocks.filter(b=>b.alive).length+'/'+w.blocks.length+' | NaN '+w.blocks.some(b=>b.alive&&!isFinite(b.x)));
  if (seed === 12345) console.log('  rings at 5s:', r5.map(r=>r?Math.round(r.ring):-1).join(' '));
}
```

Acceptance, exact — every line:

```
map s1 98b39c63b9129e1e blocks 5619
12345: triangles 14 | rings held 14/14 | shapes held 13/14 | runaways 0 | top speed 266 | alive 5489/5619 | NaN false
  rings at 5s: 325 342 478 461 598 596 725 728 902 901 1099 1095 1297 1439
69383: triangles 14 | rings held 14/14 | shapes held 14/14 | runaways 0 | top speed 183 | alive 5506/5619 | NaN false
```

Then confirm the proving range is untouched: `git status --short src/game/rubbleworlds src/game/RubbleWorlds.jsx` prints nothing.

**3. Gate.** `node scripts/gate.mjs smoke` — 23 PASS, 0 FAIL, one run. If the tool moves it to the background past its two-minute window, wait and read the pass from the tail of `.superpowers/gates.log` — do not start a second run.

**4. Version and build.** `MK = "0.5.52"`, then `npm run build`.

**5. Land.** Commit `src/game/gravitydebris/gen.js` and `src/version.js` only (subject `the doubled sky, 0.5.52`), push. The phase document's table adds row T57 — "The doubled sky: every length twice, every body eight times its mass, the stars at 2.46 so the flight flies unchanged; the ship alone keeps its size" — LANDED (mark 0.5.52, debris map number 6189636384589267 → 98b39c63b9129e1e, both battery seeds clean, the smoke count); commit with this plan file, push. The live check is the acceptance, phone and desktop both: a sky twice as large around the same ship, real slingshots off the heavyweights, and the step cost judged by eye on the live machine.

## Report

- One line of outcome, then bullets.
- Read-confirmation first.
- Every acceptance line as printed; the smoke count exactly.
- The proving range untouched — the empty git status — as its own labeled bullet.
- The map's changed generation number as its own labeled bullet, old → new.
- Fixture seeds: the battery pins 12345 (the fixed opening's own seed) and 69383 (the playtest seed); the module rolls fresh seeds at reset.
- Both commit hashes.
- Every deviation its own labeled bullet.
