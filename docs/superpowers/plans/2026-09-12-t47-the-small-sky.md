# T47: the small sky (0.5.46)

The ark's clutter arrives as block bodies, so it is destruction: about forty asteroids, four comets, two three-body triads, three fuel caches. Everything under ten blocks never sleeps, so the small sky is awake every step; the owner measures the cost with his eyes on the live build.

- **Asteroids, forty.** One to seven blocks each, mass 40 to 160. Four of every five circle a drifting planet inside its grip at 42 to 90 out, as that planet's children; every fifth drifts free between the planets under the one-percent law. They strike, chip, and are eaten like any block, and they wound the hull by the strike rule.
- **Comets, four.** Single bright blocks flung from a close pass of a planet at 1.6 times circular speed — stretched orbits that cross the corridor and die on planets and stars. Each trails forty frames of its path on screen.
- **Triads, two.** Rotating equilateral triangles of three small bodies at 48 from their center, each triad its own family under its own law — the trio scene's motion — holding for a while, then breaking.
- **Fuel caches, three.** The ark's diamond with its number, at (150, -190), (420, -120), (600, -250); the ship refuels 300 on touch, up to the tank, and the diamond goes out.
- **Placed clear by construction.** Every small body tries fixed candidate spots in order and takes the first that clears everything already placed by six; measured: tightest birth gap 8, placed on the first try, 1102 blocks, 56 families.
- **Known gap, stated plainly:** the ghost reads bodies of 500 mass and up; asteroids, comets, and triad members are lighter, so the ghost does not see them. A comet crossing the line is a surprise. The flight-picture task can lower that floor.

Design choices, stated plainly: the counts, orbits, and cache positions above; the map's generation number changes because the sky fills — old `04ed592988ec8c41`, new `ec162c4fdcbea69f`; every other scene stays identical and the acceptance proves it.

The whole change was applied to a fresh copy of the live tree at plan-writing time from this exact script: every anchor hit exactly once, every file parses and builds, every acceptance line below reproduced.

## Required reading

- This plan, whole.
- `src/game/rubbleworlds/gen.js` — the map branch.
- `src/game/RubbleWorlds.jsx` — the gate and death checks in the loop.
- `src/game/rubbleworlds/draw.js` — the gate ring block.

## Suggested model

Sonnet. Four anchored substitutions, pre-verified; no design remains.

## Steps

**1. The substitutions.** From the repo root:

```bash
python3 - <<'PYEOF'
import sys
def sub1(path, old, new, tag):
    s = open(path).read()
    if s.count(old) != 1: sys.exit("anchor fail: %s (count %d)" % (tag, s.count(old)))
    open(path, 'w').write(s.replace(old, new))
GEN='src/game/rubbleworlds/gen.js'; JSX='src/game/RubbleWorlds.jsx'; DRAW='src/game/rubbleworlds/draw.js'

# 1. gen.js: the small sky, placed clear by construction, before the blocks are cut
SMALL = '    // THE SMALL SKY: forty asteroids, four comets, two three-body triads, three\n    // fuel caches — the ark\'s clutter as block bodies, so they are destruction.\n    // Every small body is under ten blocks and therefore never sleeps; the\n    // cost is measured in the plan. The ghost does not see them: it reads\n    // bodies of 500 mass and up, and these are lighter — a known gap.\n    const small = [];   // [fam, cx, cz, vx, vz, mass, R, kind]\n    // PLACED CLEAR BY CONSTRUCTION: every small body tries fixed candidate spots in order and takes the first that clears everything already placed by at least 6\n    const placed = [];\n    for (const p of planets) placed.push([p[1], p[2], PR]);\n    for (const mn of moons) placed.push([mn[1], mn[2], MR]);\n    for (const st of world.starBodies) placed.push([st.x, st.z, st.r]);\n    placed.push([-100, -120, SHIPR]);\n    for (const pk of [[150, -190], [420, -120], [600, -250]]) placed.push([pk[0], pk[1], 18]);\n    const clearAt = (x, z, r) => placed.every(q => Math.hypot(q[0] - x, q[1] - z) - q[2] - r >= 6);\n    const drifters = planets.filter(p => p[0] >= 3 && p[0] <= 6);\n    let smFam = famN;\n    for (let i = 0; i < 40; i++) {\n      const host = drifters[i % drifters.length];\n      const free = i % 5 === 4;                      // every fifth asteroid drifts free between the planets\n      const mass = 40 + (i * 37 % 120), R = BS * (0.5 + (i * 13 % 7) / 10), rr = R + 3;\n      let done = false;\n      for (let t = 0; t < 36 && !done; t++) {\n        if (!free) {\n          const orbR = 42 + (i * 31 % 44) + (t >> 3) * 6, a = ((i * 97 + t * 10) % 360) * Math.PI / 180;\n          const x = host[1] + Math.cos(a) * orbR, z = host[2] + Math.sin(a) * orbR;\n          if (!clearAt(x, z, rr)) continue;\n          const v = vCirc(host[5], orbR) * (0.95 + (i % 3) * 0.05);\n          small.push([smFam, x, z, host[3] - Math.sin(a) * v, host[4] + Math.cos(a) * v, mass, R, "asteroid"]); world.fam[smFam] = host[0];\n        } else {\n          const x = 60 + ((i * 53 + t * 41) % 560), z = -300 + ((i * 71 + t * 29) % 540);\n          if (!clearAt(x, z, rr)) continue;\n          small.push([smFam, x, z, (i % 2 ? 3 : -3), (i % 3 ? -2 : 2), mass, R, "asteroid"]); world.fam[smFam] = -1;\n        }\n        placed.push([small[small.length - 1][1], small[small.length - 1][2], rr]); done = true;\n      }\n      if (done) smFam++;\n    }\n    // comets: single bright blocks flung from a close pass of a planet at 1.6 times circular — stretched orbits crossing the corridor\n    for (let i = 0; i < 4; i++) {\n      const host = drifters[(i + 1) % drifters.length];\n      for (let t = 0; t < 36; t++) {\n        const periR = 70 + i * 12, a = (200 + i * 97 + t * 10) * Math.PI / 180, v = vCirc(host[5], periR) * 1.6, dir = i % 2 ? 1 : -1;\n        const x = host[1] + Math.cos(a) * periR, z = host[2] + Math.sin(a) * periR;\n        if (!clearAt(x, z, BS * 0.5 + 3)) continue;\n        small.push([smFam, x, z, host[3] - Math.sin(a) * v * dir, host[4] + Math.cos(a) * v * dir, 30, BS * 0.5, "comet"]); world.fam[smFam] = host[0]; smFam++;\n        placed.push([x, z, BS * 0.5 + 3]); break;\n      }\n    }\n    // triads: two rotating equilateral triangles of small bodies, each its own family, holding for a while under their own law and then breaking\n    let triadsPlaced = 0;\n    for (const [tcx, tcz] of [[160, -330], [560, -40], [480, 80], [80, 200], [600, -330], [300, 330], [680, 250], [40, -420]]) {\n      if (triadsPlaced >= 2) break;\n      const R2 = 48, L = R2 * Math.sqrt(3), mT = 400;\n      if (!clearAt(tcx, tcz, R2 + BS * 1.1 + 3)) continue;\n      const aC = 2 * G * mT * Math.cos(Math.PI / 6) / Math.pow(L * L + SF * SF, 1.15), vT = Math.sqrt(aC * R2);\n      const tf = smFam++; world.fam[tf] = -1;\n      for (let i = 0; i < 3; i++) { const th = i * 2 * Math.PI / 3; small.push([tf, tcx + Math.cos(th) * R2, tcz + Math.sin(th) * R2, -Math.sin(th) * vT, Math.cos(th) * vT, mT, BS * 1.1, "triad"]); }\n      placed.push([tcx, tcz, R2 + BS * 1.1 + 3]); triadsPlaced++;\n    }\n    world.pickups = [{ x: 150, z: -190, fuel: 300, alive: true }, { x: 420, z: -120, fuel: 300, alive: true }, { x: 600, z: -250, fuel: 300, alive: true }];\n    for (const [f2, cx, cz, vx, vz, m, R, kind] of small) {\n      const blocks = makePlanet(cx, cz, vx, vz, kind === "comet" ? 2 : 1, rand, R, m);\n      for (const b of blocks) { b.fam = f2; if (kind === "comet") b.comet = true; }\n      world.blocks.push(...blocks);\n    }\n'
sub1(GEN, "    world.moonHosts = moonHosts;", SMALL + "    world.moonHosts = moonHosts;", 'small-sky')
# 2. gen.js: the caches join the family's birth check
sub1(GEN, "      for (const mn of moons) bodies.push([mn[1], mn[2], MR]);",
     "      for (const mn of moons) bodies.push([mn[1], mn[2], MR]);\n" + '      for (const pk of [[150, -190], [420, -120], [600, -250]]) bodies.push([pk[0], pk[1], 18]);', 'clearance-caches')
# 3. component: the caches refuel on touch
sub1(JSX, '      if (world.ship && !world.shipDead) {', '      if (world.ship && world.pickups && world.shipTrack && !planFrozen) for (const pk of world.pickups) { // a fuel cache refuels on touch, up to the tank\n        if (pk.alive && Math.hypot(world.shipTrack.x - pk.x, world.shipTrack.z - pk.z) < 18) { pk.alive = false; world.ship.fuel = Math.min(world.ship.max, world.ship.fuel + pk.fuel); }\n      }\n      if (world.ship && !world.shipDead) {', 'pickups')
# 4. draw.js: comet tails and cache diamonds, drawn with the gate
sub1(DRAW, "      // the gate ring — teal pulse until reached, then green, the ark's ring", '      // the small sky\'s marks: a comet trails forty frames of its path; a fuel cache is the ark\'s diamond with its number\n      if (!world._tails) world._tails = new Map();\n      for (let bi = 0; bi < wb.length; bi++) { const b = wb[bi]; if (!b.comet || !b.alive) continue;\n        let tr = world._tails.get(bi); if (!tr) { tr = []; world._tails.set(bi, tr); }\n        tr.push([lx(b), lz(b)]); if (tr.length > 40) tr.shift();\n        if (tr.length > 3) { ctx.beginPath(); const t0 = iso(tr[0][0], tr[0][1], 0); ctx.moveTo(t0.x, t0.y); for (let ti = 1; ti < tr.length; ti++) { const tp = iso(tr[ti][0], tr[ti][1], 0); ctx.lineTo(tp.x, tp.y); }\n          ctx.strokeStyle = "rgba(100,160,255,.10)"; ctx.lineWidth = 7; ctx.stroke(); ctx.strokeStyle = "rgba(200,220,255,.35)"; ctx.lineWidth = 1.5; ctx.stroke(); }\n      }\n      if (world.pickups) for (const pk of world.pickups) { if (!pk.alive) continue; const pp = iso(pk.x, pk.z, 0), pr2 = 8, bob = Math.sin(frame * 0.05 + pk.x) * 0.5;\n        ctx.save(); ctx.shadowColor = "rgba(50,220,220,.4)"; ctx.shadowBlur = 12;\n        ctx.beginPath(); ctx.moveTo(pp.x, pp.y - pr2 + bob); ctx.lineTo(pp.x + pr2 * 0.6, pp.y + bob); ctx.lineTo(pp.x, pp.y + pr2 + bob); ctx.lineTo(pp.x - pr2 * 0.6, pp.y + bob); ctx.closePath();\n        ctx.fillStyle = "rgba(50,220,220,.3)"; ctx.fill(); ctx.strokeStyle = "rgba(50,220,220,.6)"; ctx.lineWidth = 1.5; ctx.stroke();\n        ctx.font = "600 8px -apple-system,sans-serif"; ctx.fillStyle = "rgba(50,220,220,.5)"; ctx.textAlign = "center"; ctx.fillText("+" + pk.fuel, pp.x, pp.y + pr2 + 10); ctx.textAlign = "left"; ctx.restore(); }\n      // the gate ring — teal pulse until reached, then green, the ark\'s ring', 'tails-and-caches')
print("all substitutions in")
PYEOF
```

Expected output, exact: `all substitutions in`.

**2. The physics gate.** The command, whole:

```bash
node -e "
import('node:crypto').then(async({createHash})=>{
  const h=o=>createHash('sha256').update(JSON.stringify(o)).digest('hex').slice(0,16);
  const{makeScenario}=await import('./src/game/rubbleworlds/gen.js');
  const{stepWorld}=await import('./src/game/rubbleworlds/phys.js');
  for(const hash of[false,true]){const w=makeScenario('binary',12345,1);for(let s=0;s<600;s++)stepWorld(w,{welds:true,sleep:true,hash});console.log('evolution 10s hash='+hash,h(w.blocks.map(b=>[Math.round(b.x*1000),Math.round(b.y*1000),Math.round(b.z*1000)])));}
  for(const sc of['ship','binary','duet','moons','trio','system','hole'])console.log(sc+' s1',h(makeScenario(sc,12345,1).blocks));
  const w=makeScenario('map',12345,1);
  const fams=new Map();for(const b of w.blocks){const k=b.ship?'ship':b.fam;let g=fams.get(k);if(!g){g={x:0,z:0,n:0,r:0,pts:[]};fams.set(k,g);}g.x+=b.x;g.z+=b.z;g.n++;g.pts.push(b);}
  for(const g of fams.values()){g.x/=g.n;g.z/=g.n;for(const b of g.pts)g.r=Math.max(g.r,Math.hypot(b.x-g.x,b.z-g.z)+3);}
  const arr=[...fams.entries()];let minGap=1e9;
  for(let i=0;i<arr.length;i++)for(let j=i+1;j<arr.length;j++){const a=arr[i][1],b=arr[j][1];if(a.pts[0].fam===b.pts[0].fam)continue;minGap=Math.min(minGap,Math.hypot(a.x-b.x,a.z-b.z)-a.r-b.r);}
  for(const [k,g] of arr)for(const st of w.starBodies)minGap=Math.min(minGap,Math.hypot(g.x-st.x,g.z-st.z)-g.r-st.r);
  for(const pk of w.pickups)for(const [k,g] of arr)minGap=Math.min(minGap,Math.hypot(g.x-pk.x,g.z-pk.z)-g.r-18);
  console.log('map s1',h(w.blocks),'blocks',w.blocks.length,'tries',w.placeTries,'families',fams.size,'birth min gap',Math.round(minGap),'| caches',w.pickups.length,'comet blocks',w.blocks.filter(b=>b.comet).length);
  for(let s=0;s<60;s++)stepWorld(w,{welds:true,sleep:true,hash:true});
  console.log('1 s: NaN',w.blocks.some(b=>b.alive&&!isFinite(b.x)),'alive',w.blocks.filter(b=>b.alive).length+'/'+w.blocks.length);
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
map s1 ec162c4fdcbea69f blocks 1102 tries 1 families 56 birth min gap 8 | caches 3 comet blocks 4
1 s: NaN false alive 1102/1102
```

**3. Gate.** `node scripts/gate.mjs smoke` — 23 PASS, 0 FAIL, one run. If the tool moves it to the background past its two-minute window, wait and read the pass from the tail of `.superpowers/gates.log` — do not start a second run.

**4. Version and build.** `MK = "0.5.46"`, then `npm run build`.

**5. Land.** Commit `src/game/rubbleworlds/gen.js`, `src/game/RubbleWorlds.jsx`, `src/game/rubbleworlds/draw.js`, and `src/version.js` only (plain-words lowercase subject, e.g. "the small sky, 0.5.46"), push. The phase document's table marks T47 LANDED (mark 0.5.46, existing numbers unchanged, map number old→new, the smoke count); commit with this plan file, push. The owner's live flight is the acceptance, phone and desktop both.

## Report

- One line of outcome, then bullets.
- Read-confirmation first.
- Every acceptance line as printed; the smoke count exactly.
- The map's changed generation number as its own labeled bullet, old→new.
- Fixture seeds: the gate pins 12345 by the plan's own law; the demo rolls its own seed at mount — none special.
- Both commit hashes.
- Every deviation its own labeled bullet.
