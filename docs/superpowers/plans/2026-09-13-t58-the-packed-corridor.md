# T58: the packed corridor (0.5.53)

The map's length and width return to their former size, like the ship. The great star sits bottom left of the view and the gate top right; all fourteen doubled triangles, the lesser star, and the caches pack into the band between them; nothing but the ship sits below or left of the star. Triangle overlap is accepted by design. Engine thrust doubles and available fuel doubles. Debris module only.

- **The packed table.** Former rings 175 to 720, bearings -48 to -74 degrees — the corridor band from the star toward the gate — with the doubled widths and eightfold masses carried over unchanged. The ascii layout reviewed is this table.
- **The ship and the gate.** The ship is born at (-72, 90), below and left of the star, the only body there. The gate stands at (450, -560), top right, at its former radius 36. The birth burn fires along the tangent at 260 — the doubled thrust's planning cap — and the computed swing rounds the star at 115 and passes within 253 of the gate at 7.7 simulated seconds.
- **Doubled thrust and fuel.** Burn caps 130 planning / 220 flying at ship scale (from 65/110); fuel 200 plus 420 per tank at birth and at the ceiling (from 100 plus 210).
- **What the packing does, stated plainly.** Overlapping doubled triangles on close rings grind: on the battery seeds, four of five blocks die within the first 5 simulated seconds and most ring rides scatter. The acceptance below pins those numbers as they are — this is the instructed layout with overlap accepted, and the live test judges it.

Measured once on the plan check, seeds 12345 and 69383; the map's generation number: old `98b39c63b9129e1e`, new `be765eb2bee66d6d`.

Design choices, stated plainly: the table's bearings; the ship point, gate point, and cache points; the birth tangent and its 260; the doubled caps and fuel arithmetic.

The whole change was applied to a fresh copy of the live tree at plan-writing time from this exact script: every anchor hit exactly once, every file parses, every acceptance line below reproduced.

## Required reading

- This plan, whole.
- `src/game/gravitydebris/gen.js` — the map branch, the ship function at the top, the ship line at the bottom.
- `src/game/GravityDebris.jsx` — the two burn-cap lines and the fuel ceiling line.

## Suggested model

Sonnet. One pre-verified substitution script; no design remains.

## Steps

**1. The substitutions.** From the repo root:

```bash
python3 - <<'PYEOF'
import sys
def sub1(path, old, new, tag):
    s = open(path).read()
    if s.count(old) != 1: sys.exit("anchor fail: %s (count %d)" % (tag, s.count(old)))
    open(path, 'w').write(s.replace(old, new))
GEN='src/game/gravitydebris/gen.js'; JSX='src/game/GravityDebris.jsx'

# 1. the map returns to its former size; the stars keep their doubled bodies and masses
sub1(GEN, """    const MG = 98500;
    world.span = 1500;""",
     """    const MG = 98500;
    world.span = 750; // the map's length and width stay the former size, like the ship; only the bodies are doubled""", 'span')

# 2. the lesser star rides in the corridor band at the former distance
sub1(GEN, "    { const r = 950, a = 25 * Math.PI / 180, v = vCirc(MG, r);",
     "    { const r = 475, a = -58 * Math.PI / 180, v = vCirc(MG, r);", 'lesser-star')

# 3. the packed corridor: the star bottom left, the gate top right, all fourteen
#    triangles in the band between them — no body below or left of the star;
#    only the ship is born there. Former rings, doubled widths, eightfold masses.
sub1(GEN, """    const TRIS = [
      [350, 40, 80, 40000, 20000, 7200, 18, -1], [350, -75, 26, 3200, 1200, 640, 250, -1],
      [480, -15, 38, 3200, 1200, 640, 205, -1], [480, 75, 52, 7200, 3200, 1200, 330, -1],
      [600, -30, 96, 40000, 7200, 3200, 32, -1], [600, 55, 68, 5600, 5600, 1200, 95, -1],
      [730, 80, 68, 7200, 5600, 3200, 275, -1], [730, -70, 76, 12800, 3200, 3200, 160, -1],
      [900, 12, 104, 40000, 40000, 3200, 0, 1], [900, -55, 64, 5600, 1200, 640, 220, -1],
      [1100, -40, 72, 12800, 7200, 1200, 145, 1], [1100, 25, 80, 20000, 5600, 3200, 300, -1],
      [1300, 0, 112, 40000, 12800, 12800, 48, 1], [1440, -22, 64, 5600, 3200, 3200, 190, 1],
    ];""",
     """    const TRIS = [
      [175, -50, 80, 40000, 20000, 7200, 18, -1], [175, -64, 26, 3200, 1200, 640, 250, -1],
      [240, -48, 38, 3200, 1200, 640, 205, -1], [240, -70, 52, 7200, 3200, 1200, 330, -1],
      [300, -55, 96, 40000, 7200, 3200, 32, -1], [300, -74, 68, 5600, 5600, 1200, 95, -1],
      [365, -48, 68, 7200, 5600, 3200, 275, -1], [365, -62, 76, 12800, 3200, 3200, 160, -1],
      [450, -52, 104, 40000, 40000, 3200, 0, 1], [450, -70, 64, 5600, 1200, 640, 220, -1],
      [550, -48, 72, 12800, 7200, 1200, 145, 1], [550, -60, 80, 20000, 5600, 3200, 300, -1],
      [650, -55, 112, 40000, 12800, 12800, 48, 1], [720, -63, 64, 5600, 3200, 3200, 190, 1],
    ];""", 'packed-table')

# 4. the caches ride the corridor
sub1(GEN, "    world.pickups = [{ x: 300, z: -380, fuel: 300, alive: true }, { x: 840, z: -240, fuel: 300, alive: true }, { x: 1200, z: -500, fuel: 300, alive: true }];",
     "    world.pickups = [{ x: 150, z: -300, fuel: 300, alive: true }, { x: 200, z: -350, fuel: 300, alive: true }, { x: 380, z: -430, fuel: 300, alive: true }];", 'caches')

# 5. the ship below and left of the star — the only body there — and the gate top right; the birth burn at the doubled thrust rounds the star and heads up the corridor
sub1(GEN, '  if (kind === "map") { addShip(world, hull, -220, 70, 2); world.birthAim = 80 * world.shipScale; world.birthDir = [0.3011, 0.9535]; world.gate = { x: world.span * 0.95, z: -world.span * 0.3, r: 72, reached: false }; } // born behind the great star at double distance; the star mass is scaled so the same tangent at 160 flies the same swing, twice as large',
     '  if (kind === "map") { addShip(world, hull, -72, 90, 2); world.birthAim = 130 * world.shipScale; world.birthDir = [0.781, 0.625]; world.gate = { x: 450, z: -560, r: 36, reached: false }; } // born below-left of the great star, the only body there; the tangent at 260 rounds the star at 115 and passes within 253 of the gate at 7.7 simulated seconds', 'ship-and-gate')

# 6. double the engine thrust: the burn caps
sub1(JSX, "        const cap = world.shipPhase === \"plan\" ? Math.min(65 * sc2, world.ship.fuel) : Math.min(110 * sc2, world.ship.fuel);",
     "        const cap = world.shipPhase === \"plan\" ? Math.min(130 * sc2, world.ship.fuel) : Math.min(220 * sc2, world.ship.fuel); // doubled thrust", 'cap-drag')
sub1(JSX, "        const cap = world.shipPhase === \"plan\" ? Math.min(65 * sc3, world.ship.fuel) : Math.min(110 * sc3, world.ship.fuel);",
     "        const cap = world.shipPhase === \"plan\" ? Math.min(130 * sc3, world.ship.fuel) : Math.min(220 * sc3, world.ship.fuel); // doubled thrust", 'cap-chips')

# 7. double the available fuel: birth tanks and the live ceiling
sub1(GEN, "  world.ship = { fuel: (100 + 210 * tanks) * scale, max: (100 + 210 * tanks) * scale, burns: 0 };",
     "  world.ship = { fuel: (200 + 420 * tanks) * scale, max: (200 + 420 * tanks) * scale, burns: 0 }; // doubled fuel", 'fuel-birth')
sub1(JSX, "        const cap = 100 + 210 * tk;",
     "        const cap = 200 + 420 * tk; // doubled fuel", 'fuel-ceiling')
print("all substitutions in")
PYEOF
```

Expected output, exact: `all substitutions in`.

**2. The battery.** From the repo root, save the block below as `/tmp/battery58.mjs` and run `node /tmp/battery58.mjs /home/batman/coldsnap`:

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
map s1 be765eb2bee66d6d blocks 5619
12345: triangles 14 | rings held 1/14 | shapes held 6/14 | runaways 0 | top speed 266 | alive 1052/5619 | NaN false
  rings at 5s: 479 341 301 400 559 -1 994 321 225 352 -1 453 401 691
69383: triangles 14 | rings held 2/14 | shapes held 7/14 | runaways 0 | top speed 309 | alive 840/5619 | NaN false
```

Then confirm the proving range is untouched: `git status --short src/game/rubbleworlds src/game/RubbleWorlds.jsx` prints nothing.

**3. Gate.** `node scripts/gate.mjs smoke` — 23 PASS, 0 FAIL, one run. If the tool moves it to the background past its two-minute window, wait and read the pass from the tail of `.superpowers/gates.log` — do not start a second run.

**4. Version and build.** `MK = "0.5.53"`, then `npm run build`.

**5. Land.** Commit `src/game/gravitydebris/gen.js`, `src/game/GravityDebris.jsx`, and `src/version.js` only (subject `the packed corridor, 0.5.53`), push. The phase document's table adds row T58 — "The packed corridor: former map size, the star bottom left and the gate top right, fourteen doubled triangles packed between them, only the ship below the star; thrust and fuel doubled" — LANDED (mark 0.5.53, debris map number 98b39c63b9129e1e → be765eb2bee66d6d, the battery numbers as pinned, the smoke count); commit with this plan file, push. The live check is the acceptance, phone and desktop both.

## Report

- One line of outcome, then bullets.
- Read-confirmation first.
- Every acceptance line as printed; the smoke count exactly.
- The proving range untouched — the empty git status — as its own labeled bullet.
- The map's changed generation number as its own labeled bullet, old → new.
- Fixture seeds: the battery pins 12345 (the fixed opening's own seed) and 69383 (the playtest seed); the module rolls fresh seeds at reset.
- Both commit hashes.
- Every deviation its own labeled bullet.
