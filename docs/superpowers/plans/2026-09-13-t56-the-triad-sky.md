# T56: the triad sky (0.5.51)

Gravity's debris rebuilt: everything but the two stars rides a rotating triangle. Fourteen triangles on rings around the pinned great star, all east of it — only the ship is born west, behind the star on the gate line, so the star stands between ship and gate and the opening move is a slingshot. One hue per triangle with three shades inside it, block size following the cube root of mass, pebble to planet within a single triangle. The awake-red debugging gauge retires: a block wears its own color and flashes red for a third of a second only when struck; the ship stays gold and is never painted red. The mockup reviewed on the phone is this table drawn to scale.

The mechanics, each measured this session:

- **The triangle law.** With all three separations equal, the pull sum points every member exactly at the triple's weight-center with one shared turn rate, whatever the masses — exact under the softened law. The weight-center rides its ring at circular speed; members carry ring speed plus spin.
- **Spin directions.** Triangle spins are mixed, but prograde — spinning with the ring ride — resonates with the orbit and tears wide or light triangles apart (measured: every breaker in the first cut was prograde, every retrograde held). Prograde goes only to the four outer heavyweights, whose grip affords it; the other ten turn against their ride.
- **Width by tide.** A triangle wider than its ring affords breaks on the star's tide; the inner four entries are sized to the tide law's limit.
- **The opening slingshot.** The ship is born at (-110, 35), behind the star on the gate line, and the birth burn fires along the tangent at 160: the measured swing rounds the star and passes within 45 of the gate at 14.6 simulated seconds — the release snap can thread it from there. The drag still aims anywhere.
- **The strike flash.** The physics stamps both blocks of any contact closing faster than 8; the frame paints a stamped block red for 20 frames, then its own color returns.

Measured, seeds 12345 and 69383: all fourteen ring rides within a tenth at 5 simulated seconds, thirteen of fourteen shapes holding, zero runaway blocks. Two inner dramas stated as content: the inner heavyweight triple grinds itself into one rubble world within the window (members born near-touching kiss and weld; its ring holds throughout), and the inner pebble trio loosens into a drifting bound trio. 807 blocks at birth. The map's generation number changes wholesale: old `8f1b554fd0b9c38c`, new `6189636384589267`.

Design choices, stated plainly: the fourteen-row table — rings, angles, radii, mass triples, hues, spins; the birth point and tangent; the flash length and the strike threshold; the two inner dramas; the acceptance thresholds (a tenth on ring rides, 1.6 times birth reach on shapes, a runaway is 400 speed or 2000 out).

The whole change was applied to a fresh copy of the live tree at plan-writing time from this exact script: every anchor hit exactly once, every file parses, every acceptance line below reproduced.

## Required reading

- This plan, whole.
- `src/game/gravitydebris/gen.js` — the map branch, whole, and the ship line at the bottom.
- `src/game/gravitydebris/phys.js` — the contact-build block.
- `src/game/gravitydebris/draw.js` — the block-painting loop at the file's end.
- `src/game/GravityDebris.jsx` — the reset block that sets the birth aim.

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
GEN='src/game/gravitydebris/gen.js'; PHYS='src/game/gravitydebris/phys.js'; DRAW='src/game/gravitydebris/draw.js'; JSX='src/game/GravityDebris.jsx'

# 1. the map branch becomes the triad sky, wholesale
s = open(GEN).read()
start = s.find('  } else if (kind === "map") {')
end = s.find('    world.moonHosts = moonHosts;')
if start < 0 or end < 0: sys.exit("anchor fail: map branch bounds")
end += len('    world.moonHosts = moonHosts;')
NEW = '''  } else if (kind === "map") {
    // THE TRIAD SKY: everything but the two stars rides a rotating triangle.
    // Fourteen triangles on rings around the pinned great star, every one east
    // of it — only the ship is born west, behind the star on the gate line, so
    // the opening move is a slingshot. With all three separations equal, the
    // pull sum points every member exactly at the triple's weight-center with
    // one shared turn rate, whatever the masses — exact under the softened law
    // — so each triangle holds while it rides its ring. Triangle self-spins
    // alternate; every ring ride turns the same way. One hue per triangle,
    // three shades within it; block size follows the cube root of mass. The
    // opening is fixed: the table below is the whole sky.
    const vCirc = (M, r) => Math.sqrt(G * M * r / Math.pow(r * r + SF * SF, 1.15));
    const MG = 40000;
    world.span = 750;
    world.starBodies = [{ x: 0, z: 0, vx: 0, vz: 0, m: MG, r: 40, fam: 0, pin: true }];
    world.fam = { 0: -1 };
    world.hazardFam = 0;
    { const r = 475, a = 25 * Math.PI / 180, v = vCirc(MG, r);
      world.starBodies.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, vx: -Math.sin(a) * v, vz: Math.cos(a) * v, m: 15000, r: 24, fam: 1, pin: false }); world.fam[1] = 0; }
    // [ring, angle degrees, vertex radius, m1, m2, m3, hue degrees, spin]
    // spin +1 turns WITH the ring ride, -1 against it. A prograde spin
    // resonates with the orbit and tears wide or light triangles apart
    // (measured: every breaker in the first cut was prograde, every
    // retrograde held), so prograde goes only to the four outer
    // heavyweights, whose grip affords it.
    const TRIS = [
      [175, 40, 32, 5000, 2500, 900, 18, -1], [175, -75, 13, 400, 150, 80, 250, -1],
      [240, -15, 19, 400, 150, 80, 205, -1], [240, 75, 26, 900, 400, 150, 330, -1],
      [300, -30, 48, 5000, 900, 400, 32, -1], [300, 55, 34, 700, 700, 150, 95, -1],
      [365, 80, 34, 900, 700, 400, 275, -1], [365, -70, 38, 1600, 400, 400, 160, -1],
      [450, 12, 52, 5000, 5000, 400, 0, 1], [450, -55, 32, 700, 150, 80, 220, -1],
      [550, -40, 36, 1600, 900, 150, 145, 1], [550, 25, 40, 2500, 700, 400, 300, -1],
      [650, 0, 56, 5000, 1600, 1600, 48, 1], [720, -22, 32, 700, 400, 400, 190, 1],
    ];
    const hsl = (h, sPct, lPct) => { const sat = sPct / 100, li = lPct / 100;
      const f = (n) => { const k = (n + h / 30) % 12; const c = sat * Math.min(li, 1 - li); return Math.round(255 * (li - c * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); };
      return [f(0), f(8), f(4)]; };
    let famN = 2;
    for (let ti = 0; ti < TRIS.length; ti++) {
      const [ring, angD, R2, m1, m2, m3, hue, spin] = TRIS[ti];
      const trip = [m1, m2, m3], M = m1 + m2 + m3, a = angD * Math.PI / 180;
      const bx = Math.cos(a) * ring, bz = Math.sin(a) * ring; // the weight-center rides the ring
      const vR = vCirc(MG, ring), rvx = -Math.sin(a) * vR, rvz = Math.cos(a) * vR; // every ring ride turns the same way
      const L = R2 * Math.sqrt(3);
      const om = Math.sqrt(G * M / Math.pow(L * L + SF * SF, 1.65)) * spin; // the table's spin: mixed, prograde only where the grip affords it
      // vertices on a circle about a geometric center shifted so the mass-weighted mean lands exactly on the ring point
      const raw = [0, 1, 2].map(i => { const th = i * 2 * Math.PI / 3 + ring + angD; return [Math.cos(th) * R2, Math.sin(th) * R2]; });
      let ox = 0, oz = 0; for (let i = 0; i < 3; i++) { ox += raw[i][0] * trip[i] / M; oz += raw[i][1] * trip[i] / M; }
      const tf = famN++; world.fam[tf] = 0;
      for (let i = 0; i < 3; i++) {
        const px = bx + raw[i][0] - ox, pz = bz + raw[i][1] - oz;
        const vx = rvx - (pz - bz) * om, vz = rvz + (px - bx) * om; // ring ride plus the spin about the weight-center
        const blocks = makePlanet(px, pz, vx, vz, ti % 2, rand, BS * 1.1 * Math.cbrt(trip[i] / 400), trip[i]);
        const rgb = hsl(hue, 38 + i * 9, [62, 48, 38][i]);
        for (const b of blocks) { b.fam = tf; b.rgb = rgb; }
        world.blocks.push(...blocks);
      }
    }
    world.pickups = [{ x: 150, z: -190, fuel: 300, alive: true }, { x: 420, z: -120, fuel: 300, alive: true }, { x: 600, z: -250, fuel: 300, alive: true }];'''
open(GEN, 'w').write(s[:start] + NEW + s[end:])
print("map branch replaced")

# 2. the ship is born behind the great star on the gate line; the birth burn is the tangent that starts the swing
sub1(GEN, '  if (kind === "map") { addShip(world, hull, -100, -120, 2); world.birthAim = 110 * world.shipScale; world.gate = { x: world.span * 0.95, z: -world.span * 0.3, r: 36, reached: false }; }',
     '  if (kind === "map") { addShip(world, hull, -110, 35, 2); world.birthAim = 80 * world.shipScale; world.birthDir = [0.3011, 0.9535]; world.gate = { x: world.span * 0.95, z: -world.span * 0.3, r: 36, reached: false }; } // born behind the great star; the birth burn fires along the tangent at 160 — the measured swing passes within 45 of the gate at 14.6 simulated seconds',
     'ship-birth')

# 3. component: the birth burn follows the tangent when the sky names one
sub1(JSX, '''          if (b0) { // the ark's default trajectory: toward the gate at 50, or away from the mass where no gate stands
            const dx = world.gate ? world.gate.x - b0.x : b0.x, dz = world.gate ? world.gate.z - b0.z : b0.z;
            const dd = Math.hypot(dx, dz) || 1;''',
     '''          if (b0) { // the default trajectory: the sky's named tangent where one stands, else toward the gate
            const dx = world.birthDir ? world.birthDir[0] : (world.gate ? world.gate.x - b0.x : b0.x), dz = world.birthDir ? world.birthDir[1] : (world.gate ? world.gate.z - b0.z : b0.z);
            const dd = Math.hypot(dx, dz) || 1;''', 'birth-tangent')

# 4. phys: a hard strike stamps both blocks — the red flash reads from the stamp
sub1(PHYS, "          if (cnt.pn) applyN(world, wb, cnt, bi, bj, cnt.pn); // warm start through the SAME routing as the solver — never directly to a rigid member",
     "          if (cnt.cl0 > 8) { bi.hitF = world.frame; bj.hitF = world.frame; } // a hard strike stamps both blocks; the frame paints the stamp red for a moment\n          if (cnt.pn) applyN(world, wb, cnt, bi, bj, cnt.pn); // warm start through the SAME routing as the solver — never directly to a rigid member", 'strike-stamp')

# 5. draw: the awake-red gauge retires; a block wears its own color and flashes red only when struck
sub1(DRAW, '''        // an awake block burns red — the owner's own gauge of what sleep is doing
        const p = iso(lx(b), lz(b), ly(b)), rgb = b.sleeping || b.ship ? tints[b.tint] : [214, 74, 52];''',
     '''        // a block wears its own color and flashes red only when struck; the ship stays gold and is never painted red
        const struck = b.hitF != null && world.frame - b.hitF < 20;
        const p = iso(lx(b), lz(b), ly(b)), rgb = b.ship ? tints[b.tint] : struck ? [214, 74, 52] : (b.rgb || tints[b.tint]);''', 'red-flash')
print("all substitutions in")
PYEOF
```

Expected output, exact: two lines, `map branch replaced` then `all substitutions in`.

**2. The battery.** From the repo root, save the block below as `/tmp/battery56.mjs` and run `node /tmp/battery56.mjs /home/batman/coldsnap`:

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
map s1 6189636384589267 blocks 807
12345: triangles 14 | rings held 14/14 | shapes held 13/14 | runaways 0 | top speed 147 | alive 775/807 | NaN false
  rings at 5s: 159 166 233 223 293 292 359 362 458 447 548 528 648 718
69383: triangles 14 | rings held 14/14 | shapes held 13/14 | runaways 0 | top speed 143 | alive 775/807 | NaN false
```

Then confirm the proving range is untouched: `git status --short src/game/rubbleworlds src/game/RubbleWorlds.jsx` prints nothing.

**3. Gate.** `node scripts/gate.mjs smoke` — 23 PASS, 0 FAIL, one run. If the tool moves it to the background past its two-minute window, wait and read the pass from the tail of `.superpowers/gates.log` — do not start a second run.

**4. Version and build.** `MK = "0.5.51"`, then `npm run build`.

**5. Land.** Commit `src/game/gravitydebris/gen.js`, `src/game/gravitydebris/phys.js`, `src/game/gravitydebris/draw.js`, `src/game/GravityDebris.jsx`, and `src/version.js` only (subject `the triad sky, 0.5.51`), push. The phase document's table adds row T56 — "The triad sky: everything but the stars in fourteen rotating triangles, the ship born behind the great star for the opening slingshot, one hue per triangle, red only as the strike flash" — LANDED (mark 0.5.51, debris map number 8f1b554fd0b9c38c → 6189636384589267, both battery seeds clean, the smoke count); commit with this plan file, push. The live check is the acceptance, phone and desktop both: fourteen triangles turning at their own tempos in fourteen hues, the opening swing around the great star, red appearing only where something strikes.

## Report

- One line of outcome, then bullets.
- Read-confirmation first.
- Every acceptance line as printed; the smoke count exactly.
- The proving range untouched — the empty git status — as its own labeled bullet.
- The map's changed generation number as its own labeled bullet, old → new.
- Fixture seeds: the battery pins 12345 (the fixed opening's own seed) and 69383 (the playtest seed); the module rolls fresh seeds at reset.
- Both commit hashes.
- Every deviation its own labeled bullet.
