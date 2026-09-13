# T55: the tuned sky (0.5.50)

Gravity's debris retuned: twenty asteroids instead of forty, six rotating triangles instead of two with mixed masses 400 to 2500 and block sizes to match, and the light flag removed — gravity fully mutual again. One module; the proving range untouched by construction.

- **Twenty asteroids, born in pairs.** Halving a swarm under mutual gravity left each planet a lopsided half-swarm whose unbalanced tug walked the host off its ring (measured: the inner ring 175 to 209 in 5 seconds). Hosted asteroids are now born as opposite twins sharing a radius and a speed factor, so their tugs on the host cancel. Every fifth asteroid still drifts free.
- **Six triangles, mixed masses.** With all three separations equal, the pull sum points every body exactly at the triple's weight-center with one shared turn rate, whatever the masses — exact under the softened law. Each body rides its own circle about the weight-center: lopsided triples swing the light member wide, and heavier triples turn slower. Six mass triples from 400/900/2500 down to 400/700/900, block size growing with the cube root of mass.
- **Centers off the rings, found by scan.** The old candidate spots sat on the orbital rings and planets plowed through them within a lap; six spots also failed birth clearance for the bigger triangles. The new eight candidates were scanned from the live sky: in the bands between the rings, 92 clear of every body, 140 clear of each other. All six triangles place on the first try.
- **The light flag goes.** It guarded against the contact momentum leak, and the honest impulse removed the leak itself. Small bodies pull again; moons tug their planets; the sky is one physics. Measured safe before ruling: rings hold at 5 seconds on both battery seeds with the flag off, top speeds drop.

Measured, seed 12345 and the playtest seed 69383: all rings within a tenth at 5 simulated seconds, zero runaway blocks, all six triangles holding their shape (member reach moving one to three units over the window), 1342 blocks at birth — a fuller sky than the forty-asteroid one. The map's generation number changes because the sky changes: old `3edfd39c2bb1df1f`, new `8f1b554fd0b9c38c`.

Design choices, stated plainly: the counts, the six mass triples, the size law, the scanned centers, the pairing arithmetic, and the acceptance thresholds (a tenth on rings; a runaway is 400 speed or 2000 out).

The whole change was applied to a fresh copy of the live tree at plan-writing time from this exact script: every anchor hit exactly once, every file parses, every acceptance line below reproduced.

## Required reading

- This plan, whole.
- `src/game/gravitydebris/gen.js` — the small-sky block: asteroids, comets, triads.
- `src/game/gravitydebris/phys.js` — the three one-way factors and the aggregate build line.

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
GEN='src/game/gravitydebris/gen.js'; PHYS='src/game/gravitydebris/phys.js'

# 1. twenty asteroids, hosted ones born in opposite pairs at shared radius so
#    their tugs on the host cancel — under mutual gravity a lopsided half-swarm
#    walks its planet off the ring (measured: the inner ring to 209 in 5 seconds)
sub1(GEN, "    for (let i = 0; i < 40; i++) {", "    const kidBy = drifters.map(() => 0); // children per host, for the paired birth\n    for (let i = 0; i < 20; i++) {", 'asteroid-count')
sub1(GEN, """          const orbR = 55 + (i * 31 % 55) + (t >> 3) * 6, a = ((i * 97 + t * 10) % 360) * Math.PI / 180;
          const x = host[1] + Math.cos(a) * orbR, z = host[2] + Math.sin(a) * orbR;
          if (!clearAt(x, z, rr)) continue;
          const v = vCirc(host[5], orbR) * (0.95 + (i % 3) * 0.05);""",
     """          const kid = kidBy[i % drifters.length]; // paired birth: opposite twins share a radius and a speed factor, so their tugs on the host cancel
          const orbR = 55 + (kid >> 1) * 18 + (t >> 3) * 6, a = ((kid * 180 + (kid >> 1) * 67 + t * 10) % 360) * Math.PI / 180;
          const x = host[1] + Math.cos(a) * orbR, z = host[2] + Math.sin(a) * orbR;
          if (!clearAt(x, z, rr)) continue;
          const v = vCirc(host[5], orbR) * (0.95 + ((kid >> 1) % 3) * 0.05);""", 'paired-birth')
sub1(GEN, """        placed.push([small[small.length - 1][1], small[small.length - 1][2], rr]); done = true;
      }
      if (done) smFam++;""",
     """        placed.push([small[small.length - 1][1], small[small.length - 1][2], rr]); done = true;
        if (!free) kidBy[i % drifters.length]++;
      }
      if (done) smFam++;""", 'kid-count')

# 2. six triads with unequal masses: with all three separations equal, the pull
#    sum points every body exactly at the triple's weight-center with one shared
#    turn rate, whatever the masses — exact under the softened law.
sub1(GEN, """    // triads: two rotating equilateral triangles of small bodies, each its own family, holding for a while under their own law and then breaking
    let triadsPlaced = 0;
    for (const [tcx, tcz] of [[160, -330], [560, -40], [480, 80], [80, 200], [600, -330], [300, 330], [680, 250], [40, -420]]) {
      if (triadsPlaced >= 2) break;
      const R2 = 48, L = R2 * Math.sqrt(3), mT = 400;
      if (!clearAt(tcx, tcz, R2 + BS * 1.1 + 3)) continue;
      const aC = 2 * G * mT * Math.cos(Math.PI / 6) / Math.pow(L * L + SF * SF, 1.15), vT = Math.sqrt(aC * R2);
      const tf = smFam++; world.fam[tf] = -1;
      for (let i = 0; i < 3; i++) { const th = i * 2 * Math.PI / 3; small.push([tf, tcx + Math.cos(th) * R2, tcz + Math.sin(th) * R2, -Math.sin(th) * vT, Math.cos(th) * vT, mT, BS * 1.1, "triad"]); }
      placed.push([tcx, tcz, R2 + BS * 1.1 + 3]); triadsPlaced++;
    }""",
    """    // triads: six rotating equilateral triangles, each its own family, masses
    // mixed 400 to 2500 with block size to match. With all three separations
    // equal, the pull sum points every body exactly at the triple's
    // weight-center with one shared turn rate, whatever the masses — exact
    // under the softened law — so each body rides its own circle about the
    // weight-center and heavier triples turn slower.
    const TRIPLES = [[400, 900, 2500], [700, 1600, 1000], [400, 400, 1600], [2500, 2500, 400], [900, 1600, 2500], [400, 700, 900]];
    let triadsPlaced = 0;
    // centers sit in the bands BETWEEN the orbital rings (175/300/450/475/650, each ±60), so no ring planet plows through a triangle inside its first laps
    for (const [tcx, tcz] of [[360, 0], [720, 0], [510, 45], [225, -75], [585, -75], [705, -150], [0, -240], [0, 240]]) {
      if (triadsPlaced >= 6) break;
      const R2 = 48, L = R2 * Math.sqrt(3);
      const trip = TRIPLES[triadsPlaced % TRIPLES.length], MT = trip[0] + trip[1] + trip[2];
      const maxR = BS * 1.1 * Math.cbrt(Math.max(...trip) / 400);
      if (!clearAt(tcx, tcz, R2 + maxR + 3)) continue;
      const om = Math.sqrt(G * MT / Math.pow(L * L + SF * SF, 1.65)); // the shared turn rate
      let bx = 0, bz = 0; // the triple's weight-center inside the vertex circle
      const vtx = [0, 1, 2].map(i => { const th = i * 2 * Math.PI / 3; return [tcx + Math.cos(th) * R2, tcz + Math.sin(th) * R2]; });
      for (let i = 0; i < 3; i++) { bx += vtx[i][0] * trip[i] / MT; bz += vtx[i][1] * trip[i] / MT; }
      const tf = smFam++; world.fam[tf] = -1;
      for (let i = 0; i < 3; i++) {
        const rx = vtx[i][0] - bx, rz = vtx[i][1] - bz;
        small.push([tf, vtx[i][0], vtx[i][1], -rz * om, rx * om, trip[i], BS * 1.1 * Math.cbrt(trip[i] / 400), "triad"]);
      }
      placed.push([tcx, tcz, R2 + maxR + 3]); triadsPlaced++;
    }""", 'triads')

# 3. the light flag goes: gravity is fully mutual again
sub1(GEN, "      for (const b of blocks) { b.fam = f2; b.lite = true; } // light: born under 500 mass, pulls nothing outside its own family",
     "      for (const b of blocks) b.fam = f2;", 'moon-flag-off')
sub1(GEN, '      for (const b of blocks) { b.fam = f2; b.lite = true; if (kind === "comet") b.comet = true; } // light: born under 500 mass, pulls nothing outside its own family',
     '      for (const b of blocks) { b.fam = f2; if (kind === "comet") b.comet = true; }', 'small-flag-off')
sub1(PHYS, "      const w = (s.lite && s.fam !== myFam ? 0 : 1) * famW(world, myFam, s.fam); // one-way: a light source pulls nothing outside its own family",
     "      const w = famW(world, myFam, s.fam);", 'oneway-accel-off')
sub1(PHYS, "          const w = (wb[g.ids[0]].lite && wb[g.ids[0]].fam !== b.fam ? 0 : 1) * (world.fam ? famW(world, b.fam, wb[g.ids[0]].fam) : (world.weak && root !== b.clump ? 0.01 : 1)); // one-way: light bodies feel the sky and pull nothing outside their family",
     "          const w = world.fam ? famW(world, b.fam, wb[g.ids[0]].fam) : (world.weak && root !== b.clump ? 0.01 : 1);", 'oneway-clumps-off')
sub1(PHYS, "        for (const a of world.aggs) { const w = (a.lite && a.fam !== b.fam ? 0 : 1) * (world.fam ? famW(world, b.fam, a.fam) : (world.weak && a.clump !== b.clump ? 0.01 : 1)); pull(b, a.x, a.y, a.z, a.m, w, out); }",
     "        for (const a of world.aggs) { const w = world.fam ? famW(world, b.fam, a.fam) : (world.weak && a.clump !== b.clump ? 0.01 : 1); pull(b, a.x, a.y, a.z, a.m, w, out); }", 'oneway-aggs-off')
sub1(PHYS, "fam: wb[g.ids[0]].fam, lite: wb[g.ids[0]].lite, om: g.om,",
     "fam: wb[g.ids[0]].fam, om: g.om,", 'agg-flag-off')
print("all substitutions in")
PYEOF
```

Expected output, exact: `all substitutions in`.

**2. The battery.** From the repo root, save the block below as `/tmp/battery55.mjs` and run `node /tmp/battery55.mjs /home/batman/coldsnap`:

```js
const dir = process.argv[2] || './t55';
const {createHash} = await import('node:crypto');
const h = o => createHash('sha256').update(JSON.stringify(o)).digest('hex').slice(0,16);
const DG = await import(dir + '/src/game/gravitydebris/gen.js');
const DP = await import(dir + '/src/game/gravitydebris/phys.js');
for (const seed of [12345, 69383]) {
  const w = DG.makeScenario('map', seed, 1);
  if (seed === 12345) {
    // triad census at birth: fams with exactly 3 bodies of the triple masses
    const tf = new Map(); for (const b of w.blocks) if (b.alive) tf.set(b.fam, (tf.get(b.fam)||0)+1);
    let triBlocks = 0; for (const b of w.blocks) if (b.alive && b.fam >= 12) triBlocks++;
    console.log('map s1', h(w.blocks), 'blocks', w.blocks.length, 'tries', w.placeTries);
  }
  const famC = (f) => { let x=0,z=0,n=0; for (const b of w.blocks) if (b.alive && b.fam===f) { x+=b.x; z+=b.z; n++; } return n?{x:x/n,z:z/n}:null; };
  const r0 = [3,4,5,6].map(f=>Math.round(Math.hypot(famC(f).x,famC(f).z)));
  // find triad fams at birth: exact masses from the TRIPLES set, single-block bodies… identify by kind: blocks whose birth family has 3 clumps of near-equal… simpler: triad blocks were pushed with kind "triad" → no marker. Count triangles by geometry: fams whose members sit ~48 from their center.
  for (let s=0; s<300; s++) DP.stepWorld(w, {welds:true, sleep:true, hash:true, friction:true});
  const r5 = [3,4,5,6].map(f=>Math.round(Math.hypot(famC(f).x,famC(f).z)));
  const hold = r5.every((r,i)=>Math.abs(r-r0[i])<=r0[i]*0.1);
  let fly=0,vmax=0; for (const b of w.blocks) if (b.alive) { const v=Math.hypot(b.vx,b.vz); if(v>vmax)vmax=v; if (v>400||Math.hypot(b.x,b.z)>2000) fly++; }
  console.log(seed+': rings at 5s', r5.join(' '), '| hold', hold?'YES':'NO', '| runaways', fly, '| top speed', Math.round(vmax), '| alive', w.blocks.filter(b=>b.alive).length+'/'+w.blocks.length, '| NaN', w.blocks.some(b=>b.alive&&!isFinite(b.x)));
}
// triad hold: seed 12345 — a triad family is one whose blocks split into 3 clusters ~48 from their shared center
{
  const w = DG.makeScenario('map', 12345, 1);
  const fams = new Map();
  for (const b of w.blocks) if (b.alive && b.fam >= 12) { const g = fams.get(b.fam)||[]; g.push(b); fams.set(b.fam,g); }
  const triFams = [];
  for (const [f,g] of fams) { let cx=0,cz=0,m=0; for (const b of g){cx+=b.x*b.m;cz+=b.z*b.m;m+=b.m;} cx/=m;cz/=m;
    const ds=g.map(b=>Math.hypot(b.x-cx,b.z-cz));
    if (m>=1200 && m<=6000 && Math.max(...ds)>30 && Math.max(...ds)<95 && Math.min(...ds)>8) triFams.push([f,cx,cz,m]); }
  const spread = (f) => { const g = w.blocks.filter(b=>b.alive&&b.fam===f); if(!g.length) return -1; let cx=0,cz=0,m=0; for (const b of g){cx+=b.x*b.m;cz+=b.z*b.m;m+=b.m;} cx/=m;cz/=m; return Math.round(Math.max(...g.map(b=>Math.hypot(b.x-cx,b.z-cz)))); };
  const s0 = triFams.map(([f])=>spread(f));
  for (let s=0; s<300; s++) DP.stepWorld(w, {welds:true, sleep:true, hash:true, friction:true});
  console.log('triads placed', triFams.length, '| member reach at birth', s0.join(' '), '| at 5s', triFams.map(([f])=>spread(f)).join(' '));
}
```

Acceptance, exact — every line:

```
map s1 8f1b554fd0b9c38c blocks 1342 tries 1
12345: rings at 5s 173 302 454 664 | hold YES | runaways 0 | top speed 162 | alive 1249/1342 | NaN false
69383: rings at 5s 165 302 460 663 | hold YES | runaways 0 | top speed 162 | alive 1232/1342 | NaN false
triads placed 6 | member reach at birth 72 63 70 72 67 64 | at 5s 74 61 71 74 70 62
```

Then confirm the proving range is untouched: `git status --short src/game/rubbleworlds src/game/RubbleWorlds.jsx` prints nothing.

**3. Gate.** `node scripts/gate.mjs smoke` — 23 PASS, 0 FAIL, one run. If the tool moves it to the background past its two-minute window, wait and read the pass from the tail of `.superpowers/gates.log` — do not start a second run.

**4. Version and build.** `MK = "0.5.50"`, then `npm run build`.

**5. Land.** Commit `src/game/gravitydebris/gen.js`, `src/game/gravitydebris/phys.js`, and `src/version.js` only (subject `the tuned sky, 0.5.50`), push. The phase document's table adds row T55 — "The tuned sky: twenty paired asteroids, six mixed-mass triangles on scanned centers, the light flag removed — gravity fully mutual" — LANDED (mark 0.5.50, debris map number 3edfd39c2bb1df1f → 8f1b554fd0b9c38c, both battery seeds clean, the smoke count); commit with this plan file, push. The live check is the acceptance, phone and desktop both: six triangles turning at different tempos, lopsided ones visibly swinging their light member wide.

## Report

- One line of outcome, then bullets.
- Read-confirmation first.
- Every acceptance line as printed; the smoke count exactly.
- The proving range untouched — the empty git status — as its own labeled bullet.
- The map's changed generation number as its own labeled bullet, old → new.
- Fixture seeds: the battery pins 12345 (the fixed opening's own seed) and 69383 (the playtest seed); the module rolls fresh seeds at reset.
- Both commit hashes.
- Every deviation its own labeled bullet.
