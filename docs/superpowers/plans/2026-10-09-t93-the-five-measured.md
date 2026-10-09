# T93: the five measured (no deploy; the mark stays 0.5.87)

Six copies of the shipped tree run the map on this Raspberry Pi, one after another: the tree as it is, then the tree with one of the five changes in it — the weld list, the pair gate, the single search and the ship's welds, the fixed weights, the plain readout. Every run plays the same game: one seed drawn by the harness and printed first, pinned into the page's dice so the sky is the same sky; the map at its default chips; LAUNCH; ten flown seconds; the ⊕ LOG chip pressed and its rows captured exactly as you export them. The five changes keep every number, so the six logs must agree on everything but timing — the page checks that row by row and says so on its face. Nothing deploys; no version moves; the five changes live in throwaway copies and are gone at the end. What lands is a folder under docs: the six logs, the three scripts that made them, and the page that charts them, served to you as a link.

The browser is the Pi's own Chromium on the Pi's own display, a 960 by 600 desktop window; the phone viewport is not measured. The page itself ships for phone and desktop. The numbers are this machine's; the differences between runs are what carry.

Checked at plan-writing: every anchor below hit its exact count on a fresh copy, every changed file parses or compiles clean, and every script passes a syntax pass. No run was made; the agent's runs are the first.

## Required reading

- This plan, whole.
- `src/game/GravityDebris.jsx` — the loop: the ship's track search (line 152), the fifteen-frame readout (line 257), the corner readout (line 283).
- `src/game/gravitydebris/phys.js` — the sweep (line 480), the gravity pass (line 361), the predictor (line 655), shipConn (line 712).
- `scripts/smoke.mjs` — the browser pattern the driver follows.

## Suggested model

Sonnet 5.5. Every step is pre-written; the agent runs scripts and reports numbers; no design remains.

## Steps

**1. The six copies.** From the repo root. Each copy is a worktree at the tree's own commit, with the main tree's node_modules linked in (the ignore file keeps the link and the build out of git).

```bash
cd /home/batman/coldsnap && git rev-parse --short HEAD && mkdir -p /home/batman/coldsnap-t93 && for N in base c1 c2 c3 c4 c5; do git worktree add --detach /home/batman/coldsnap-t93/$N HEAD >/dev/null && ln -s /home/batman/coldsnap/node_modules /home/batman/coldsnap-t93/$N/node_modules && echo "copy $N"; done
```

Expected: the commit hash, then `copy base` through `copy c5`, with git's own `Preparing worktree` lines between them.

**2. The five changes, one per copy.** Save the block below as `/tmp/t93-changes.py` and run `python3 /tmp/t93-changes.py /home/batman/coldsnap-t93` once. It applies change 1 to copy c1, change 2 to c2, and so on; base is untouched. Every anchor is count-checked; a miss stops the script and the task.

```python
import sys, os
root = sys.argv[1]
def subn(path, old, new, n, tag):
    s = open(path).read()
    if s.count(old) != n: sys.exit("anchor fail: %s (count %d, wanted %d)" % (tag, s.count(old), n))
    open(path, 'w').write(s.replace(old, new))

P = lambda c: os.path.join(root, c, 'src/game/gravitydebris/phys.js')
J = lambda c: os.path.join(root, c, 'src/game/GravityDebris.jsx')

# --- change 1, the weld list: the sweeps' skips taken once per step; the sweeps walk the short list ---
subn(P('c1'), '''      let activeWelds = 0;
      if (k.welds) for (const w of welds) if (w.alive && wb[w.a].alive && wb[w.b].alive && !(wb[w.a].sleeping && wb[w.b].sleeping)) activeWelds++;''',
'''      let activeWelds = 0;
      // THE WELD LIST: the sweeps' own skips, taken once — a dead-ended weld dies here as the first sweep would have killed it; sleeping and rigid-internal welds wait outside the list, since neither flag moves during the sweeps
      const liveWelds = [];
      if (k.welds) for (const w of welds) {
        if (!w.alive) continue;
        const a = wb[w.a], b = wb[w.b];
        if (!a.alive || !b.alive) { w.alive = false; continue; }
        if (a.sleeping && b.sleeping) continue;
        activeWelds++;
        const ra = world.rigidOf[w.a], rb = world.rigidOf[w.b];
        if (ra >= 0 && ra === rb) continue;
        liveWelds.push(w);
      }''', 1, 'c1 list')
subn(P('c1'), '''        if (k.welds) for (const w of welds) {
          if (!w.alive) continue;
          const a = wb[w.a], b = wb[w.b];
          if (!a.alive || !b.alive) { w.alive = false; continue; }
          if (a.sleeping && b.sleeping) continue;
          const ra = world.rigidOf[w.a], rb = world.rigidOf[w.b];
          if (ra >= 0 && ra === rb) continue; // inside a rigid island the weld carries no solver work
          const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, d = hyp(dx, dy, dz) || 1;''',
'''        if (k.welds) for (const w of liveWelds) {
          if (!w.alive) continue;
          const a = wb[w.a], b = wb[w.b];
          if (!a.alive || !b.alive) { w.alive = false; continue; }
          const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, d = hyp(dx, dy, dz) || 1;''', 1, 'c1 sweep')

# --- change 2, the pair gate: clump pairs too far apart for any near block take the point branch without measuring ---
subn(P('c2'), '''      for (const [root, g] of awakeClumps) for (const i of g.ids) { const b = wb[i]; const r = hyp(b.x - g.mx, b.y - g.my, b.z - g.mz); if (r > g.rad) g.rad = r; }
      const NEAR = NEAR_F * (world.cell || BS * 1.45);''',
'''      for (const [root, g] of awakeClumps) for (const i of g.ids) { const b = wb[i]; const r = hyp(b.x - g.mx, b.y - g.my, b.z - g.mz); if (r > g.rad) g.rad = r; }
      const NEAR = NEAR_F * (world.cell || BS * 1.45);
      // THE PAIR GATE: two awake clumps whose centers stand farther apart than both radii plus NEAR hold no near pair — every block of one takes the other as a point without measuring; a gated pair still measures block by block, so the answers are the same answers
      const _acl = [...awakeClumps.values()];
      for (let q = 0; q < _acl.length; q++) { _acl[q].idx = q; _acl[q].gate = new Uint8Array(_acl.length); }
      for (let q = 0; q < _acl.length; q++) for (let r = q; r < _acl.length; r++) {
        const A = _acl[q], B = _acl[r];
        const on = q === r || hyp(A.mx - B.mx, A.my - B.my, A.mz - B.mz) < A.rad + B.rad + NEAR + 1e-6 ? 1 : 0;
        A.gate[r] = on; B.gate[q] = on;
      }''', 1, 'c2 gate')
subn(P('c2'), '''        for (const [root, g] of awakeClumps) {
          const w = world.fam ? famW(world, b.fam, wb[g.ids[0]].fam) : (world.weak && root !== b.clump ? 0.01 : 1);
          const d = hyp(g.mx - b.x, g.my - b.y, g.mz - b.z);
          if (root === b.clump || d < g.rad + NEAR) {''',
'''        const _gate = awakeClumps.get(b.clump).gate;
        for (const [root, g] of awakeClumps) {
          const w = world.fam ? famW(world, b.fam, wb[g.ids[0]].fam) : (world.weak && root !== b.clump ? 0.01 : 1);
          if (root === b.clump || (_gate[g.idx] === 1 && hyp(g.mx - b.x, g.my - b.y, g.mz - b.z) < g.rad + NEAR)) {''', 1, 'c2 kick')

# --- change 3, the single search and the ship's welds ---
subn(J('c3'), '''        world.shipTrack = null;
        for (const tk of world.tracks || []) { for (const i2 of [0]) {} }
        for (const tk of world.tracks || []) { const b0 = world.blocks.find(b2 => b2.ship && b2.alive); if (b0 && tk.clump === b0.clump) { world.shipTrack = tk; break; } }''',
'''        world.shipTrack = null;
        const b0 = world.blocks.find(b2 => b2.ship && b2.alive); // one search, not one per clump
        if (b0) for (const tk of world.tracks || []) { if (tk.clump === b0.clump) { world.shipTrack = tk; break; } }''', 1, 'c3 search')
subn(P('c3'), '''  const set = new Set([cab]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const w of world.welds) {
      if (!w.alive) continue;
      const a = wb[w.a], b = wb[w.b];
      if (!a.ship || !b.ship || !a.alive || !b.alive) continue;''',
'''  // THE SHIP'S OWN WELDS: hull and wall welds are born, never cold-formed, so the list stands from birth in weld order; it rebuilds only if the weld count ever moves
  let sw = world._shipWelds;
  if (!sw || sw.n !== world.welds.length) { sw = { n: world.welds.length, list: world.welds.filter(w => wb[w.a].ship && wb[w.b].ship) }; world._shipWelds = sw; }
  const set = new Set([cab]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const w of sw.list) {
      if (!w.alive) continue;
      const a = wb[w.a], b = wb[w.b];
      if (!a.alive || !b.alive) continue;''', 1, 'c3 welds')

# --- change 4, the fixed weights: the predictor's lists of others built once per path and refreshed in place ---
subn(P('c4'), '''  let anchor = null; for (const p of simP) if (!anchor || p.m > anchor.m) anchor = p;
  return { world, simP, statics, gate, gateGrav, anchor, x: st.x, z: st.z, vx: vx0, vz: vz0,''',
'''  let anchor = null; for (const p of simP) if (!anchor || p.m > anchor.m) anchor = p;
  // THE FIXED WEIGHTS: who pulls whom by how much never changes along a path, so each body's list of the others — the family weights already multiplied in — is built once and its positions refreshed in place each step; the sums run in the same order over the same numbers
  const others = simP.map(p => {
    const row = [];
    for (const q of simP) if (q !== p) row.push({ src: q, x: q.x, z: q.z, m: q.m * (world.fam ? famW(world, p.fam, q.fam) : (world.weak ? 0.01 : 1)) });
    for (const o of statics) row.push(world.fam ? { src: o, x: o.x, z: o.z, m: o.m * famW(world, p.fam, o.fam) } : o);
    return row;
  });
  const bodies = [...simP, ...statics, ...gateGrav];
  return { world, simP, statics, gate, gateGrav, anchor, others, bodies, x: st.x, z: st.z, vx: vx0, vz: vz0,''', 1, 'c4 start')
subn(P('c4'), '''    for (const p of simP) {
      const others = [];
      for (const q of simP) if (q !== p) others.push({ x: q.x, z: q.z, m: q.m * (world.fam ? famW(world, p.fam, q.fam) : (world.weak ? 0.01 : 1)) });
      for (const o of statics) others.push(world.fam ? { x: o.x, z: o.z, m: o.m * famW(world, p.fam, o.fam) } : o);
      { const [ax, az] = gaT(p.x, p.z, others); p.vx += ax * DT; p.vz += az * DT; p.x += p.vx * DT; p.z += p.vz * DT; } // kick then drift, exactly as the sky steps its bodies
    }
    const bodies = [...simP, ...statics, ...gateGrav];''',
'''    for (let pi = 0; pi < simP.length; pi++) { const p = simP[pi], others = S.others[pi];
      for (const oo of others) if (oo.src) { oo.x = oo.src.x; oo.z = oo.src.z; }
      { const [ax, az] = gaT(p.x, p.z, others); p.vx += ax * DT; p.vz += az * DT; p.x += p.vx * DT; p.z += p.vz * DT; } // kick then drift, exactly as the sky steps its bodies
    }
    const bodies = S.bodies;''', 1, 'c4 step')

# --- change 5, the plain readout: the numbers go straight into their two lines; React renders only when a chip's input moves ---
subn(J('c5'), "let world = null, seed = 0, lastReset = 0, anim, frame = 0, renderF = 0, tPrev = performance.now(), ftBuf = [];",
              "let world = null, seed = 0, lastReset = 0, anim, frame = 0, renderF = 0, tPrev = performance.now(), ftBuf = [], uiLast = null;", 1, 'c5 decl')
subn(J('c5'), "        setUi(u => ({ ...u, kind: k.kind, seed, eaten: 0 }));",
              "        uiLast = null; setUi(u => ({ ...u, kind: k.kind, seed, eaten: 0 }));", 1, 'c5 reset')
subn(J('c5'), '''        for (const b of wb) { if (!b.alive) continue; if (b.sleeping) asleep++; else awake++; }
        setUi(u => ({ ...u, fps, stepMs: world.stepMs || 0, awake, asleep, eaten: world.eaten, weldsAlive, fuel: world.ship ? Math.round(world.ship.fuel) : null, phase: world.shipPhase || null, aimOn: !!(world.shipAim && world.shipAim.on), engOn: !world.ship || (() => { const c2 = shipConn(world); return !!(c2 && c2.eng); })(), shieldPreset: world.shieldPreset || null, dead: !!world.shipDead, burns: world.ship ? world.ship.burns : 0, deadT: world.shipDead ? Math.round(world.deadAt) : null }));''',
'''        for (const b of wb) { if (!b.alive) continue; if (b.sleeping) asleep++; else awake++; }
        // THE PLAIN READOUT: the numbers go straight into their two lines; React renders only when a chip's own input moves
        const fuel = world.ship ? Math.round(world.ship.fuel) : null;
        if (readA.current) readA.current.textContent = `seed ${seed} · ${fps}fps · ${world.stepMs || 0}ms/step${fuel != null ? ` · fuel ${fuel}` : ""}`;
        if (readB.current) readB.current.textContent = `${awake} awake · ${asleep} asleep · welds ${weldsAlive}${k.kind === "hole" ? ` · eaten ${world.eaten}` : ""}`;
        const nx = { fuel, phase: world.shipPhase || null, aimOn: !!(world.shipAim && world.shipAim.on), engOn: !world.ship || (() => { const c2 = shipConn(world); return !!(c2 && c2.eng); })(), shieldPreset: world.shieldPreset || null, dead: !!world.shipDead, burns: world.ship ? world.ship.burns : 0, deadT: world.shipDead ? Math.round(world.deadAt) : null };
        const lu = uiLast;
        if (!lu || nx.phase !== lu.phase || nx.aimOn !== lu.aimOn || nx.engOn !== lu.engOn || nx.shieldPreset !== lu.shieldPreset || nx.dead !== lu.dead || nx.burns !== lu.burns || nx.deadT !== lu.deadT || (nx.dead && nx.fuel !== lu.fuel)) { uiLast = nx; setUi(u => ({ ...u, ...nx })); }''', 1, 'c5 tick')
subn(J('c5'), '''        <div style={{ fontSize: 11, fontWeight: 500, color: "rgba(0,0,0,.45)", marginTop: 4 }}>seed {ui.seed} · {ui.fps}fps · {ui.stepMs || 0}ms/step{ui.fuel != null ? ` · fuel ${ui.fuel}` : ""}</div>
        <div style={{ fontSize: 11, fontWeight: 500, color: "rgba(0,0,0,.45)", marginTop: 2 }}>{ui.awake} awake · {ui.asleep} asleep · welds {ui.weldsAlive}{ui.kind === "hole" ? ` · eaten ${ui.eaten}` : ""}</div>''',
'''        <div ref={readA} style={{ fontSize: 11, fontWeight: 500, color: "rgba(0,0,0,.45)", marginTop: 4 }}></div>
        <div ref={readB} style={{ fontSize: 11, fontWeight: 500, color: "rgba(0,0,0,.45)", marginTop: 2 }}></div>''', 1, 'c5 lines')
subn(J('c5'), '''  const burnRef = useRef(null);
  const shieldRef = useRef(null);''',
'''  const burnRef = useRef(null);
  const shieldRef = useRef(null);
  const readA = useRef(null), readB = useRef(null); // the two readout lines, written directly''', 1, 'c5 refs')
print("all substitutions in")
```

Expected output, exact: `all substitutions in`. Then the syntax pass, one command, the main tree's own esbuild:

```bash
cd /home/batman/coldsnap-t93 && for N in c1 c2 c3 c4; do node --check $N/src/game/gravitydebris/phys.js; done && for N in c3 c5; do /home/batman/coldsnap/node_modules/.bin/esbuild --loader:.jsx=jsx $N/src/game/GravityDebris.jsx --outfile=/dev/null --log-level=error; done && echo SYNTAX CLEAN
```

Expected: `SYNTAX CLEAN` alone.

**3. The battery, six times.** Save the block below as `/tmp/battery93.mjs` — T84's battery with T90's two probes, unchanged — and run it once against each copy: `for N in base c1 c2 c3 c4 c5; do echo "== $N"; node /tmp/battery93.mjs /home/batman/coldsnap-t93/$N; done`.

```js
// THE SHIELD BATTERY: seed 12345 — the untouched rubble twin proves its
// physics never moved; the debris map builds with the shield walls, steps 5
// simulated seconds, and the walls are then exercised headless: three cells
// killed, the rim-inward regrowth marched on a synthetic wall clock, the
// preset cycled to FORE. Frames draw on both grounds at the end.
const dir = process.argv[2] || '.';
const {createHash} = await import('node:crypto');
const h = o => createHash('sha256').update(JSON.stringify(o)).digest('hex').slice(0,16);
const stub = () => new Proxy({}, { get: (t,p) => (p==='createRadialGradient'||p==='createLinearGradient') ? (()=>({addColorStop(){}})) : (()=>{}), set: () => true });
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => stub() }) };
{
  const RG = await import(dir + '/src/game/rubbleworlds/gen.js');
  const RP = await import(dir + '/src/game/rubbleworlds/phys.js');
  const w = RG.makeScenario('system', 12345, 1);
  for (let s = 0; s < 300; s++) RP.stepWorld(w, {welds:true, sleep:true, hash:true, friction:true});
  console.log('rubble system at 5s', h(w.blocks), 'alive ' + w.blocks.filter(b=>b.alive).length + '/' + w.blocks.length);
}
{
  const DG = await import(dir + '/src/game/gravitydebris/gen.js');
  const DP = await import(dir + '/src/game/gravitydebris/phys.js');
  const DD = await import(dir + '/src/game/gravitydebris/draw.js');
  const SH = await import(dir + '/src/game/gravitydebris/shields.js');
  const w = DG.makeScenario('map', 12345, 1);
  const cells = w.shieldCells;
  console.log('shields at birth: cells ' + cells.length + ' | powered ' + cells.filter(c=>c.powered).length + ' | up ' + cells.filter(c=>c.alive).length + ' | preset ' + w.shieldPreset);
  // the game's own opening: one priming step, then the birth aim onto the
  // weld-connected hull — unlaunched, the ship falls into the great star by
  // frame 155 and the star eats the walls whole (measured at plan-writing)
  DP.stepWorld(w, {welds:true, sleep:true, hash:true, friction:true});
  const conn = DP.shipConn(w);
  for (const b of conn.set) { b.vx += w.birthDir[0] * w.birthAim; b.vz += w.birthDir[1] * w.birthAim; }
  console.log('launched: hull and walls together ' + conn.set.length);
  for (let s = 0; s < 300; s++) DP.stepWorld(w, {welds:true, sleep:true, hash:true, friction:true});
  console.log('debris map at 5s', h(w.blocks), 'alive ' + w.blocks.filter(b=>b.alive).length + '/' + w.blocks.length + ' | eaten ' + w.eaten);
  const holes = () => cells.filter(c=>c.powered && !c.alive).length;
  // punch three holes in the fore wall: both rim cells touch undamaged ground, the middle one touches only its dead kin
  const fore = []; for (let i=0;i<cells.length;i++) if (cells[i].wall==='fore-in') fore.push(i);
  for (const i of fore.slice(0,3)) { cells[i].alive = false; cells[i].hp = 0; }
  console.log('holes punched: ' + holes());
  for (let t = 0; t <= 2600; t += 400) SH.stepShields(w, t);
  console.log('after 2.6s on the wall clock: holes ' + holes());
  for (let t = 3000; t <= 5400; t += 400) SH.stepShields(w, t);
  console.log('after 5.4s: holes ' + holes());
  const np = SH.cycleShieldPreset(w);
  const byWall = (p) => cells.filter(c=>c.powered && c.wall.startsWith(p)).length;
  console.log('preset ' + np + ': fore ' + byWall('fore') + ' | aft ' + byWall('aft') + ' | left ' + byWall('left') + ' | right ' + byWall('right') + ' | up ' + cells.filter(c=>c.alive).length);
  { // the predictor probe: the carved predictor must answer byte for byte as the old one
    const b0 = w.blocks.find(b2 => b2.ship && b2.alive);
    for (const tk of w.tracks || []) if (b0 && tk.clump === b0.clump) { w.shipTrack = tk; break; }
    const pr = DP.predictShip(w, 50, 50, 2400);
    console.log('predictor probe', pr ? h(pr.pts) + ' pts ' + pr.pts.length + ' | orbit ' + pr.orbit : 'null');
  }
  // the cone probe: the flight ghost builds across two headless draws
  w.shipPhase = "fly"; w.shipDead = false;
  DD.drawFrame({ ctx: stub(), W: 900, H: 600, world: w, frame: w.frame, time: 0.5 });
  DD.drawFrame({ ctx: stub(), W: 900, H: 600, world: w, frame: w.frame, time: 0.5 });
  const gf = w._ghostF;
  console.log('cone probe: built ' + (gf && gf.C ? gf.C.pts.length : -1) + ' | done ' + !!(gf && gf.done));
  DD.drawFrame({ ctx: stub(), W: 900, H: 600, world: w, frame: w.frame, time: 0.5 });
  DD.drawFrame({ ctx: stub(), W: 900, H: 600, world: w, frame: w.frame, time: 0.5, dark: true });
  console.log('debris frames drawn light+dark | NaN ' + w.blocks.some(b => b.alive && !isFinite(b.x)));
}
console.log('STRUCTURE HELD');
```

Acceptance, exact — T92's block, printed six times, one under each `== name` line. Any line that differs in any copy stops the task: that change moved a number.

```
rubble system at 5s 582386c0cb544735 alive 171/171
shields at birth: cells 72 | powered 36 | up 36 | preset SPREAD
launched: hull and walls together 41
debris map at 5s 5ad744a97cb81787 alive 1829/2239 | eaten 533
holes punched: 3
after 2.6s on the wall clock: holes 1
after 5.4s: holes 0
preset FORE: fore 18 | aft 0 | left 9 | right 9 | up 36
predictor probe 49640eb505b36d53 pts 273 | orbit false
cone probe: built 600 | done false
debris frames drawn light+dark | NaN false
STRUCTURE HELD
```

**4. The six builds.** `for N in base c1 c2 c3 c4 c5; do (cd /home/batman/coldsnap-t93/$N && npm run build >/tmp/t93-build-$N.log 2>&1 && test -f dist/index.html && echo "built $N") || { echo "BUILD FAILED $N"; break; }; done`. Expected: `built base` through `built c5`. A failed build stops the task; its log is `/tmp/t93-build-<name>.log`.

**5. The folder and the three scripts.** `mkdir -p /home/batman/coldsnap/docs/superpowers/perf/t93`, then save the four blocks below into it, by the names given.

`run.mjs` — the driver. One run: a headed browser on the Pi's display, the map, LAUNCH, rows until the eleventh (the birth row plus ten flown seconds), the log saved beside the script, one line to experiments.log.

```js
// THE RUN: one headed browser on the Pi's own display, the map at default
// chips, LAUNCH, then the game's own log rows until the eleventh (the birth
// row plus ten flown seconds), captured exactly as the ⊕ LOG chip copies
// them. Usage: node run.mjs <name> <seed> — the seed is the harness's drawn
// seed, pinned into the page's dice so every run builds the same sky.
import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../../..");
const [name, seedArg] = process.argv.slice(2);
if (!name || !seedArg) { console.error("usage: node run.mjs <name> <seed>"); process.exit(2); }
const seed = +seedArg;
const ROWS = 11;
const PAGE_URL = "http://localhost:4173/coldsnap/";
const { MK } = await import(ROOT + "/src/version.js");
console.log(`run ${name} seed ${seed} mk ${MK}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({
  executablePath: "/usr/bin/chromium",
  headless: false,
  defaultViewport: { width: 960, height: 600 },
  args: ["--no-sandbox", "--window-size=960,600", "--window-position=0,0"],
  env: { ...process.env, DISPLAY: ":0" },
  protocolTimeout: 600000,
});
let code = 0;
try {
  const page = await browser.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  await page.evaluateOnNewDocument((s) => {
    // the pinned dice: every Math.random in the page draws from one seeded stream, so the sky's own seed is the same in every run
    let a = s >>> 0;
    Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    // the ⊕ LOG chip copies to the clipboard; here the clipboard is a shelf the driver reads
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: (t) => { window.__log = t; return Promise.resolve(); } } });
  }, seed);
  await page.goto(PAGE_URL, { waitUntil: "networkidle0" });
  await page.bringToFront();
  const raf = await page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const tick = () => { if (++n < 120) requestAnimationFrame(tick); else res(1000 * n / (performance.now() - t0)); }; requestAnimationFrame(tick); }));
  const vis = await page.evaluate(() => document.visibilityState);
  console.log(`raf ${raf.toFixed(1)} visibility ${vis}`);
  if (vis !== "visible") throw new Error("the page is not visible on the display");
  await page.waitForSelector('[data-menu="demos"]');
  await page.evaluate(() => document.querySelector('[data-menu="demos"]').click());
  await page.waitForSelector('[data-menu="debris"]');
  await page.evaluate(() => document.querySelector('[data-menu="debris"]').click());
  await page.waitForFunction(() => document.body.innerText.includes("GRAVITY'S DEBRIS"), { timeout: 60000 });
  const chip = (label) => page.evaluate((l) => { const d = [...document.querySelectorAll("div")].find((x) => x.childElementCount === 0 && x.textContent === l); if (!d) return false; d.click(); return true; }, label);
  const has = (label) => page.evaluate((l) => [...document.querySelectorAll("div")].some((x) => x.childElementCount === 0 && x.textContent === l), label);
  await page.waitForFunction(() => [...document.querySelectorAll("div")].some((x) => x.childElementCount === 0 && x.textContent === "LAUNCH"), { timeout: 120000, polling: 250 });
  let flying = false;
  for (let i = 0; i < 200 && !flying; i++) { await chip("LAUNCH"); await sleep(250); flying = await has("PLAN BURN"); }
  if (!flying) throw new Error("LAUNCH never took");
  const tLaunch = Date.now();
  console.log("launched");
  let data = null;
  for (;;) {
    await sleep(10000);
    if (await page.evaluate(() => document.hidden)) throw new Error("the page went hidden mid-run");
    if (errs.length) throw new Error("page error: " + errs[0]);
    if (!(await chip("⊕ LOG"))) { console.log("LOG chip busy"); continue; }
    await sleep(300);
    const txt = await page.evaluate(() => window.__log || null);
    if (!txt) { console.log("no capture yet"); continue; }
    data = JSON.parse(txt);
    const last = data.log[data.log.length - 1];
    console.log(`rows ${data.log.length} sim ${last.sim} real ${last.real} fpsAvg ${last.fpsAvg} stepMs ${last.stepMs} (${((Date.now() - tLaunch) / 1000).toFixed(0)}s since launch)`);
    if (data.log.length >= ROWS) break;
    if (Date.now() - tLaunch > 40 * 60 * 1000) throw new Error("forty minutes passed before row " + ROWS);
  }
  data.log = data.log.slice(0, ROWS);
  const out = { run: name, harnessSeed: seed, mk: MK, raf: +raf.toFixed(1), viewport: "960x600 desktop, headed chromium on the Pi display", startedAt: new Date().toISOString(), ...data };
  fs.writeFileSync(path.join(HERE, name + ".json"), JSON.stringify(out));
  const flown = out.log.filter((r) => r.sim >= 2);
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const line = `${new Date().toISOString()} t93-perf ${name} harness-seed ${seed} world-seed ${out.seed} rows ${out.log.length} raf ${raf.toFixed(1)} stepMs ${mean(flown.map((r) => r.stepMs)).toFixed(2)} fpsAvg ${mean(flown.map((r) => r.fpsAvg)).toFixed(1)} worstMs ${Math.max(...flown.map((r) => (r.worst ? r.worst.ms : 0))).toFixed(1)}`;
  console.log(line);
  fs.appendFileSync(path.join(ROOT, ".superpowers", "experiments.log"), line + "\n");
  console.log("RUN DONE " + name);
} catch (e) {
  console.error("RUN FAILED " + name + ": " + ((e && e.message) || e));
  code = 1;
} finally {
  await browser.close();
}
process.exit(code);
```

`page.mjs` — the page builder. Reads the six logs beside it, runs the identity check, writes `index.html`, and exits 1 on any mismatch (the page is still written, so the mismatch can be read).

```js
// THE PAGE: reads the six logs beside it, checks that every run tells the
// same story in every non-timing field, and writes index.html — the six runs
// charted side by side, a metric picker, a crosshair readout, before and
// after per change, and the rows themselves. Exits 1 on any mismatch.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const RUNS = [
  ["base", "the shipped tree"],
  ["c1", "the weld list"],
  ["c2", "the pair gate"],
  ["c3", "the single search and the ship's welds"],
  ["c4", "the fixed weights"],
  ["c5", "the plain readout"],
];
const runs = [];
for (const [key, label] of RUNS) {
  const f = path.join(HERE, key + ".json");
  if (!fs.existsSync(f)) { console.error("missing " + f); process.exit(1); }
  runs.push({ key, label, ...JSON.parse(fs.readFileSync(f, "utf8")) });
}
const SAME = ["sim", "hash", "friction", "awake", "asleep", "welds", "eaten"];
const base = runs[0];
const mismatches = [];
for (const r of runs.slice(1)) {
  if (r.seed !== base.seed) mismatches.push(r.key + ": world seed " + r.seed + " against base " + base.seed);
  if (r.harnessSeed !== base.harnessSeed) mismatches.push(r.key + ": harness seed " + r.harnessSeed + " against base " + base.harnessSeed);
  if (r.log.length !== base.log.length) mismatches.push(r.key + ": " + r.log.length + " rows against base " + base.log.length);
  const n = Math.min(r.log.length, base.log.length);
  for (let i = 0; i < n; i++) {
    for (const f of SAME) if (r.log[i][f] !== base.log[i][f]) mismatches.push(r.key + " row " + i + " (sim " + base.log[i].sim + "): " + f + " " + r.log[i][f] + " against " + base.log[i][f]);
    if (JSON.stringify(r.log[i].bodies) !== JSON.stringify(base.log[i].bodies)) mismatches.push(r.key + " row " + i + " (sim " + base.log[i].sim + "): bodies differ");
  }
}
const ok = mismatches.length === 0;
const verdict = ok
  ? "Every run tells the same story: world seed, row count, awake, asleep, welds, eaten, and bodies are identical across all six. Only the timing differs."
  : mismatches.length + " mismatch(es). The first: " + mismatches[0];
console.log("identity: " + verdict);
const DATA = { ok, verdict, mismatches, runs: runs.map((r) => ({ key: r.key, label: r.label, seed: r.seed, harnessSeed: r.harnessSeed, mk: r.mk, raf: r.raf, viewport: r.viewport, startedAt: r.startedAt, log: r.log })) };
const json = JSON.stringify(DATA).replace(/</g, "\\u003c");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const meta = "Mark " + esc(base.mk) + " · harness seed " + esc(base.harnessSeed) + " · world seed " + esc(base.seed) + " · " + esc(base.viewport) + " · run " + esc(String(base.startedAt).slice(0, 10)) + " · frame-rate probe at the start screen: " + runs.map((r) => esc(r.key) + " " + esc(r.raf)).join(", ");

const html = `<title>The Five Measured</title>
<style>
/* layout: one column, 920px wide at most, 16px gutters; the charts fill the column and redraw on resize; the tables scroll sideways in their own boxes */
:root { --bg: #f9f9f7; --surface: #fcfcfb; --ink: #0b0b0b; --ink2: #52514e; --muted: #898781; --grid: #e1e0d9; --axis: #c3c2b7; --ring: rgba(11,11,11,.10); --goodText: #006300; --badText: #d03b3b; --s-base: #2a78d6; --s-c1: #eb6834; --s-c2: #1baf7a; --s-c3: #eda100; --s-c4: #e87ba4; --s-c5: #008300; --font: system-ui, -apple-system, "Segoe UI", sans-serif; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #0d0d0d; --surface: #1a1a19; --ink: #ffffff; --ink2: #c3c2b7; --muted: #898781; --grid: #2c2c2a; --axis: #383835; --ring: rgba(255,255,255,.10); --goodText: #0ca30c; --badText: #d03b3b; --s-base: #3987e5; --s-c1: #d95926; --s-c2: #199e70; --s-c3: #c98500; --s-c4: #d55181; --s-c5: #008300; color-scheme: dark; } }
:root[data-theme="dark"] { --bg: #0d0d0d; --surface: #1a1a19; --ink: #ffffff; --ink2: #c3c2b7; --muted: #898781; --grid: #2c2c2a; --axis: #383835; --ring: rgba(255,255,255,.10); --goodText: #0ca30c; --badText: #d03b3b; --s-base: #3987e5; --s-c1: #d95926; --s-c2: #199e70; --s-c3: #c98500; --s-c4: #d55181; --s-c5: #008300; color-scheme: dark; }
body { margin: 0; background: var(--bg); color: var(--ink); font-family: var(--font); font-size: 14px; line-height: 1.4; padding-inline: 16px; padding-block: 28px 56px; }
.wrap { max-width: 920px; margin: 0 auto; display: grid; gap: 28px; min-width: 0; }
h1 { font-size: 28px; font-weight: 600; margin: 0 0 8px; letter-spacing: -0.01em; text-wrap: balance; }
h2 { font-size: 16px; font-weight: 600; margin: 0 0 10px; }
.lede { max-width: 65ch; color: var(--ink2); margin: 0 0 8px; line-height: 1.45; }
.meta { color: var(--muted); font-size: 12px; margin: 0; max-width: 80ch; }
.pill { display: inline-flex; align-items: flex-start; gap: 8px; padding: 8px 14px; border-radius: 12px; border: 1px solid var(--ring); background: var(--surface); font-size: 13px; max-width: 100%; }
.pill .mark { font-weight: 700; flex: none; }
.pill.ok .mark { color: var(--goodText); }
.pill.bad .mark { color: var(--badText); }
.controls { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 14px; }
.controls label { font-size: 12px; color: var(--muted); letter-spacing: 0.04em; text-transform: uppercase; }
select { font: inherit; padding: 6px 8px; border-radius: 6px; border: 1px solid var(--axis); background: var(--surface); color: var(--ink); max-width: 100%; }
.keys { display: flex; flex-wrap: wrap; gap: 6px; }
.key-btn { font: inherit; font-size: 12px; display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px; border: 1px solid var(--ring); background: var(--surface); color: var(--ink); cursor: pointer; }
.key-btn[aria-pressed="false"] { opacity: .45; }
.swatch { width: 10px; height: 10px; border-radius: 2px; display: inline-block; flex: none; }
.scroll { overflow-x: auto; max-width: 100%; }
table { border-collapse: collapse; font-size: 13px; min-width: 100%; }
th, td { text-align: left; padding: 6px 10px; border-bottom: 1px solid var(--grid); white-space: nowrap; vertical-align: middle; }
th { color: var(--muted); font-weight: 500; font-size: 12px; }
td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
td .swatch { margin-right: 6px; vertical-align: middle; }
.good { color: var(--goodText); }
.bad { color: var(--badText); }
.chart-box { position: relative; min-width: 0; }
.chart { background: var(--surface); border: 1px solid var(--ring); border-radius: 8px; padding: 8px; min-width: 0; }
.chart svg { display: block; width: 100%; height: auto; }
svg text { font-family: var(--font); }
.tip { position: absolute; pointer-events: none; background: var(--surface); border: 1px solid var(--ring); border-radius: 6px; padding: 8px 10px; font-size: 12px; box-shadow: 0 2px 8px rgba(0,0,0,.12); max-width: 280px; z-index: 2; }
.tip-h { color: var(--muted); margin-bottom: 4px; }
.tip-r { display: flex; align-items: center; gap: 6px; white-space: nowrap; }
.tip-r .key { width: 12px; height: 2px; display: inline-block; flex: none; }
.tip-l { color: var(--ink2); }
.note { color: var(--ink2); font-size: 12px; max-width: 65ch; margin: 10px 0 0; }
details summary { cursor: pointer; font-weight: 600; margin-bottom: 10px; }
button:focus-visible, select:focus-visible, summary:focus-visible { outline: 2px solid var(--s-base); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
</style>
<main class="wrap">
  <header>
    <h1>The Five Measured</h1>
    <p class="lede">Six runs of the map on the Raspberry Pi: the shipped tree and the tree with one of five changes in it, one drawn seed, ten flown seconds each, captured as the game's own ⊕ LOG rows.</p>
    <p class="meta">${meta}</p>
  </header>
  <section>
    <span class="pill ${ok ? "ok" : "bad"}" data-verdict><span class="mark">${ok ? "✓" : "✗"}</span><span>${esc(verdict)}</span></span>
  </section>
  <section class="controls">
    <label for="metric">Metric</label>
    <select id="metric"></select>
    <div class="keys" id="keys"></div>
  </section>
  <section>
    <h2>The runs, summarized over seconds 2 to 10</h2>
    <div class="scroll"><table class="sum" id="sum"></table></div>
    <p class="note">Δ is against base. Green reads better, red worse. The row at 1s carries the aim and the launch, so the summary starts at 2s.</p>
  </section>
  <section>
    <h2>Second by second</h2>
    <div class="chart-box"><div id="lines" class="chart"></div><div id="tip" class="tip" hidden></div></div>
  </section>
  <section>
    <h2>Before and after, per change</h2>
    <div id="dumb" class="chart"></div>
  </section>
  <details>
    <summary>The rows themselves</summary>
    <div class="scroll"><table class="rows" id="rows"></table></div>
  </details>
  <footer><p class="meta">Each run: a fresh copy of the tree, a fresh browser, the map at default chips, LAUNCH, the ⊕ LOG chip pressed every ten seconds until the eleventh row. The five changes keep every number; the check above holds them to it.</p></footer>
</main>
<script>const DATA = ${json};</script>
<script>
(function () {
  var RUNS = DATA.runs;
  var COLORS = { base: "var(--s-base)", c1: "var(--s-c1)", c2: "var(--s-c2)", c3: "var(--s-c3)", c4: "var(--s-c4)", c5: "var(--s-c5)" };
  var METRICS = [
    { key: "stepMs", label: "step time, ms", unit: "ms", d: 2, get: function (r) { return r.stepMs; }, agg: "mean", better: "lower" },
    { key: "fpsAvg", label: "frame rate, average", unit: "fps", d: 1, get: function (r) { return r.fpsAvg; }, agg: "mean", better: "higher" },
    { key: "fpsMed", label: "frame rate, median", unit: "fps", d: 1, get: function (r) { return r.fpsMed; }, agg: "mean", better: "higher" },
    { key: "fpsMin", label: "frame rate, worst frame", unit: "fps", d: 0, get: function (r) { return r.fpsMin; }, agg: "min", better: "higher" },
    { key: "fpsMax", label: "frame rate, best frame", unit: "fps", d: 0, get: function (r) { return r.fpsMax; }, agg: "max", better: "higher" },
    { key: "worstMs", label: "worst frame, ms", unit: "ms", d: 1, get: function (r) { return r.worst ? r.worst.ms : null; }, agg: "max", better: "lower" },
    { key: "worstPhys", label: "worst frame, physics ms", unit: "ms", d: 1, get: function (r) { return r.worst ? r.worst.phys : null; }, agg: "max", better: "lower" },
    { key: "worstDraw", label: "worst frame, draw ms", unit: "ms", d: 1, get: function (r) { return r.worst ? r.worst.draw : null; }, agg: "max", better: "lower" },
    { key: "bestMs", label: "best frame, ms", unit: "ms", d: 1, get: function (r) { return r.best ? r.best.ms : null; }, agg: "mean", better: "lower" }
  ];
  var shown = {};
  RUNS.forEach(function (r) { shown[r.key] = true; });
  var metric = METRICS[0];
  function color(key) { return COLORS[key]; }
  function flown(r) { return r.log.filter(function (row) { return row.sim >= 2; }); }
  function vals(r, m) { return flown(r).map(m.get).filter(function (v) { return v != null; }); }
  function agg(a, how) {
    if (!a.length) return null;
    if (how === "min") return Math.min.apply(null, a);
    if (how === "max") return Math.max.apply(null, a);
    var s = 0; a.forEach(function (v) { s += v; }); return s / a.length;
  }
  function fmt(v, d) { if (v == null || isNaN(v)) return "—"; return v.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function pct(a, b) { return a == null || b == null || b === 0 ? null : (a - b) / b * 100; }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function svgEl(tag, attrs, style) { var e = document.createElementNS("http://www.w3.org/2000/svg", tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (style) for (var s in style) e.style[s] = style[s]; return e; }
  function nice(max) { if (!(max > 0)) return 1; var p = Math.pow(10, Math.floor(Math.log10(max))); var f = max / p; var n = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10; return n * p; }
  function delta(p, better, isBase) {
    var td = el("td", "num");
    if (isBase || p == null) { td.textContent = "—"; return td; }
    var good = better === "lower" ? p < 0 : p > 0;
    td.textContent = (p > 0 ? "+" : "") + fmt(p, 1) + "%";
    if (Math.abs(p) >= 0.05) td.className = "num " + (good ? "good" : "bad");
    return td;
  }
  function renderControls() {
    var sel = document.getElementById("metric"); sel.textContent = "";
    METRICS.forEach(function (m) { var o = el("option", null, m.label); o.value = m.key; sel.appendChild(o); });
    sel.value = metric.key;
    sel.addEventListener("change", function () { metric = METRICS.filter(function (m) { return m.key === sel.value; })[0]; renderCharts(); });
    var keys = document.getElementById("keys"); keys.textContent = "";
    RUNS.forEach(function (r) {
      var b = el("button", "key-btn"); b.type = "button"; b.setAttribute("aria-pressed", "true");
      var sw = el("span", "swatch"); sw.style.background = color(r.key); b.appendChild(sw);
      b.appendChild(document.createTextNode(r.key + " · " + r.label));
      b.addEventListener("click", function () { shown[r.key] = !shown[r.key]; b.setAttribute("aria-pressed", shown[r.key] ? "true" : "false"); renderLines(); });
      keys.appendChild(b);
    });
  }
  function renderSummary() {
    var t = document.getElementById("sum"); t.textContent = "";
    var head = ["run", "step ms", "Δ", "fps avg", "Δ", "fps median", "fps worst frame", "worst frame ms", "worst physics ms", "worst draw ms"];
    var tr = el("tr"); head.forEach(function (h, i) { tr.appendChild(el("th", i ? "num" : null, h)); }); t.appendChild(tr);
    var b = RUNS[0];
    var bStep = agg(vals(b, METRICS[0]), "mean"), bFps = agg(vals(b, METRICS[1]), "mean");
    RUNS.forEach(function (r) {
      var row = el("tr");
      var name = el("td"); var sw = el("span", "swatch"); sw.style.background = color(r.key); name.appendChild(sw); name.appendChild(document.createTextNode(r.key + " · " + r.label)); row.appendChild(name);
      var step = agg(vals(r, METRICS[0]), "mean"), fps = agg(vals(r, METRICS[1]), "mean");
      row.appendChild(el("td", "num", fmt(step, 2)));
      row.appendChild(delta(pct(step, bStep), "lower", r.key === "base"));
      row.appendChild(el("td", "num", fmt(fps, 1)));
      row.appendChild(delta(pct(fps, bFps), "higher", r.key === "base"));
      row.appendChild(el("td", "num", fmt(agg(vals(r, METRICS[2]), "mean"), 1)));
      row.appendChild(el("td", "num", fmt(agg(vals(r, METRICS[3]), "min"), 0)));
      row.appendChild(el("td", "num", fmt(agg(vals(r, METRICS[5]), "max"), 1)));
      row.appendChild(el("td", "num", fmt(agg(vals(r, METRICS[6]), "max"), 1)));
      row.appendChild(el("td", "num", fmt(agg(vals(r, METRICS[7]), "max"), 1)));
      t.appendChild(row);
    });
  }
  function renderLines() {
    var wrap = document.getElementById("lines"); wrap.textContent = "";
    var W = Math.max(300, wrap.clientWidth - 16), H = 320, L = 52, R = 16, T = 16, B = 40;
    var xs = RUNS[0].log.filter(function (row) { return row.sim >= 1; }).map(function (row) { return row.sim; });
    if (xs.length < 2) { wrap.appendChild(el("p", "note", "Not enough rows to chart.")); return; }
    var series = RUNS.filter(function (r) { return shown[r.key]; }).map(function (r) {
      return { key: r.key, label: r.label, pts: r.log.filter(function (row) { return row.sim >= 1; }).map(function (row) { return { x: row.sim, y: metric.get(row) }; }) };
    });
    var maxY = 0; series.forEach(function (s) { s.pts.forEach(function (p) { if (p.y != null && p.y > maxY) maxY = p.y; }); });
    var top = nice(maxY * 1.05);
    var x = function (v) { return L + (v - xs[0]) / (xs[xs.length - 1] - xs[0]) * (W - L - R); };
    var y = function (v) { return T + (1 - v / top) * (H - T - B); };
    var svg = svgEl("svg", { viewBox: "0 0 " + W + " " + H, width: W, height: H, role: "img", "aria-label": metric.label + " by flown second, one line per run" });
    for (var i = 0; i <= 5; i++) {
      var v = top * i / 5;
      svg.appendChild(svgEl("line", { x1: L, x2: W - R, y1: y(v), y2: y(v), "stroke-width": 1 }, { stroke: "var(--grid)" }));
      var tl = svgEl("text", { x: L - 8, y: y(v) + 4, "text-anchor": "end", "font-size": 11 }, { fill: "var(--muted)" }); tl.textContent = fmt(v, top >= 10 ? 0 : 1); svg.appendChild(tl);
    }
    svg.appendChild(svgEl("line", { x1: L, x2: W - R, y1: y(0), y2: y(0), "stroke-width": 1 }, { stroke: "var(--axis)" }));
    xs.forEach(function (v) { var tl = svgEl("text", { x: x(v), y: H - B + 18, "text-anchor": "middle", "font-size": 11 }, { fill: "var(--muted)" }); tl.textContent = v + "s"; svg.appendChild(tl); });
    var xl = svgEl("text", { x: (L + W - R) / 2, y: H - 6, "text-anchor": "middle", "font-size": 11 }, { fill: "var(--muted)" }); xl.textContent = "flown second · " + metric.label + (metric.unit ? " (" + metric.unit + ")" : ""); svg.appendChild(xl);
    series.forEach(function (s) {
      var d = "", started = false;
      s.pts.forEach(function (p) { if (p.y == null) { started = false; return; } d += (started ? " L " : " M ") + x(p.x).toFixed(1) + " " + y(p.y).toFixed(1); started = true; });
      if (d) svg.appendChild(svgEl("path", { d: d.trim(), fill: "none", "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }, { stroke: color(s.key) }));
      s.pts.forEach(function (p) { if (p.y == null) return; svg.appendChild(svgEl("circle", { cx: x(p.x), cy: y(p.y), r: 4, "stroke-width": 2 }, { fill: color(s.key), stroke: "var(--surface)" })); });
    });
    var cross = svgEl("line", { x1: 0, x2: 0, y1: T, y2: H - B, "stroke-width": 1, visibility: "hidden" }, { stroke: "var(--axis)" }); svg.appendChild(cross);
    wrap.appendChild(svg);
    var tip = document.getElementById("tip");
    function show(ev) {
      var rect = svg.getBoundingClientRect(); var px = (ev.clientX - rect.left) * W / rect.width;
      var best = 0, bd = Infinity; xs.forEach(function (v, i) { var dd = Math.abs(x(v) - px); if (dd < bd) { bd = dd; best = i; } });
      var xv = xs[best]; cross.setAttribute("x1", x(xv)); cross.setAttribute("x2", x(xv)); cross.setAttribute("visibility", "visible");
      tip.textContent = ""; tip.appendChild(el("div", "tip-h", "at " + xv + "s · " + metric.label));
      series.forEach(function (s) {
        var p = s.pts[best]; var row = el("div", "tip-r");
        var k = el("span", "key"); k.style.background = color(s.key); row.appendChild(k);
        row.appendChild(el("strong", null, fmt(p ? p.y : null, metric.d) + " " + metric.unit));
        row.appendChild(el("span", "tip-l", s.key + " · " + s.label));
        tip.appendChild(row);
      });
      tip.hidden = false;
      var box = wrap.getBoundingClientRect();
      var tx = ev.clientX - box.left + 14, ty = ev.clientY - box.top - 10;
      if (tx + tip.offsetWidth > box.width) tx = Math.max(0, ev.clientX - box.left - tip.offsetWidth - 14);
      tip.style.left = tx + "px"; tip.style.top = ty + "px";
    }
    svg.addEventListener("pointermove", show);
    svg.addEventListener("pointerdown", show);
    svg.addEventListener("pointerleave", function () { tip.hidden = true; cross.setAttribute("visibility", "hidden"); });
  }
  function renderDumb() {
    var wrap = document.getElementById("dumb"); wrap.textContent = "";
    var b = RUNS[0], bv = agg(vals(b, metric), metric.agg);
    var items = RUNS.slice(1).map(function (r) { return { key: r.key, label: r.label, v: agg(vals(r, metric), metric.agg) }; });
    var W = Math.max(300, wrap.clientWidth - 16), rowH = 46, L = 16, R = 132, T = 30, H = T + rowH * items.length + 12;
    var all = items.map(function (i) { return i.v; }).concat([bv]).filter(function (v) { return v != null; });
    if (!all.length) { wrap.appendChild(el("p", "note", "No values for this metric.")); return; }
    var lo = Math.min.apply(null, all), hi = Math.max.apply(null, all);
    var pad = (hi - lo) * 0.25 || Math.abs(hi) * 0.1 || 1; lo -= pad; hi += pad;
    var x = function (v) { return L + (v - lo) / (hi - lo) * (W - L - R); };
    var svg = svgEl("svg", { viewBox: "0 0 " + W + " " + H, width: W, height: H, role: "img", "aria-label": "before and after per change, " + metric.label });
    var cap = svgEl("text", { x: L, y: 14, "font-size": 11 }, { fill: "var(--muted)" });
    cap.textContent = "base " + fmt(bv, metric.d) + " " + metric.unit + " (" + metric.agg + " over seconds 2 to 10) → each change"; svg.appendChild(cap);
    if (bv != null) svg.appendChild(svgEl("line", { x1: x(bv), x2: x(bv), y1: T - 8, y2: H - 8, "stroke-width": 1 }, { stroke: "var(--axis)" }));
    items.forEach(function (it, i) {
      var cy = T + rowH * i + rowH / 2;
      var lab = svgEl("text", { x: L, y: cy - 10, "font-size": 12 }, { fill: "var(--ink2)" }); lab.textContent = it.key + " · " + it.label; svg.appendChild(lab);
      if (it.v == null || bv == null) return;
      svg.appendChild(svgEl("line", { x1: x(bv), x2: x(it.v), y1: cy + 6, y2: cy + 6, "stroke-width": 2, "stroke-linecap": "round" }, { stroke: "var(--axis)" }));
      svg.appendChild(svgEl("circle", { cx: x(bv), cy: cy + 6, r: 5, "stroke-width": 2 }, { fill: color("base"), stroke: "var(--surface)" }));
      svg.appendChild(svgEl("circle", { cx: x(it.v), cy: cy + 6, r: 5, "stroke-width": 2 }, { fill: color(it.key), stroke: "var(--surface)" }));
      var p = pct(it.v, bv); var good = p == null ? null : (metric.better === "lower" ? p < 0 : p > 0);
      var tone = p == null || Math.abs(p) < 0.05 ? "var(--ink2)" : good ? "var(--goodText)" : "var(--badText)";
      var dl = svgEl("text", { x: W - R + 10, y: cy + 10, "font-size": 12, "font-weight": 600 }, { fill: tone });
      dl.textContent = fmt(it.v, metric.d) + " " + metric.unit + " (" + (p > 0 ? "+" : "") + fmt(p, 1) + "%)"; svg.appendChild(dl);
    });
    wrap.appendChild(svg);
  }
  function renderRows() {
    var t = document.getElementById("rows"); t.textContent = "";
    var cols = [
      ["run", function (r, row) { return r.key; }],
      ["sim s", function (r, row) { return row.sim; }],
      ["real s", function (r, row) { return row.real; }],
      ["step ms", function (r, row) { return row.stepMs; }],
      ["fps avg", function (r, row) { return row.fpsAvg; }],
      ["fps med", function (r, row) { return row.fpsMed; }],
      ["fps min", function (r, row) { return row.fpsMin; }],
      ["fps max", function (r, row) { return row.fpsMax; }],
      ["worst ms", function (r, row) { return row.worst ? row.worst.ms : null; }],
      ["worst draw", function (r, row) { return row.worst ? row.worst.draw : null; }],
      ["worst phys", function (r, row) { return row.worst ? row.worst.phys : null; }],
      ["chunks", function (r, row) { return row.worst ? row.worst.chunks : null; }],
      ["scan", function (r, row) { return row.worst ? String(row.worst.scan) : null; }],
      ["ghost", function (r, row) { return row.worst ? String(row.worst.ghost) : null; }],
      ["best ms", function (r, row) { return row.best ? row.best.ms : null; }],
      ["awake", function (r, row) { return row.awake; }],
      ["asleep", function (r, row) { return row.asleep; }],
      ["welds", function (r, row) { return row.welds; }],
      ["eaten", function (r, row) { return row.eaten; }]
    ];
    var tr = el("tr"); cols.forEach(function (c, i) { tr.appendChild(el("th", i ? "num" : null, c[0])); }); t.appendChild(tr);
    RUNS.forEach(function (r) { r.log.forEach(function (row) { var tr2 = el("tr"); cols.forEach(function (c, i) { var v = c[1](r, row); tr2.appendChild(el("td", i ? "num" : null, v == null ? "—" : String(v))); }); t.appendChild(tr2); }); });
  }
  function renderCharts() { renderLines(); renderDumb(); }
  renderControls(); renderSummary(); renderCharts(); renderRows();
  var rt; window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(renderCharts, 120); });
})();
</script>
`;
fs.writeFileSync(path.join(HERE, "index.html"), html);
console.log("wrote index.html");
process.exit(ok ? 0 : 1);
```

`check.mjs` — the page check. Opens the built page headless inside the same skeleton the artifact viewer wraps it in, at desktop and phone widths: no page error, both charts drawn, no sideways scroll.

```js
// THE PAGE CHECK: the built page opens headless, inside the skeleton the
// viewer wraps it in, without a page error; both charts draw; at phone width
// the page does not scroll sideways.
import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const body = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
const doc = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body style="margin:0">' + body + "</body></html>";
const browser = await puppeteer.launch({ executablePath: "/usr/bin/chromium", headless: true, args: ["--no-sandbox", "--disable-gpu", "--window-size=960,600"] });
let code = 0;
try {
  const page = await browser.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  await page.setViewport({ width: 960, height: 600 });
  await page.setContent(doc, { waitUntil: "load" });
  await new Promise((r) => setTimeout(r, 500));
  const svgs = await page.evaluate(() => document.querySelectorAll("svg").length);
  const paths = await page.evaluate(() => document.querySelectorAll("svg path").length);
  const verdict = await page.evaluate(() => { const e = document.querySelector("[data-verdict]"); return e ? e.textContent.trim() : ""; });
  console.log(`desktop: svgs ${svgs} | paths ${paths} | verdict ${verdict.slice(0, 80)} | page errors ${errs.length}`);
  if (errs.length) { console.log(errs.join("\n")); code = 1; }
  if (svgs < 2 || paths < 6) code = 1;
  await page.setViewport({ width: 390, height: 844 });
  await new Promise((r) => setTimeout(r, 400));
  const wide = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  console.log(`phone: sideways scroll ${wide}`);
  if (wide) code = 1;
  console.log(code ? "PAGE CHECK FAILED" : "PAGE CHECK OK");
} finally {
  await browser.close();
}
process.exit(code);
```

`all.sh` — the six runs in order, one drawn seed printed first, then the page and its check.

```bash
#!/bin/bash
# THE SIX RUNS: one drawn seed, printed first; base then the five changes,
# one preview server and one browser each, in order; then the page and its
# check. A rerun passes the drawn seed back: bash all.sh <seed>.
ROOT=/home/batman/coldsnap-t93
OUT=/home/batman/coldsnap/docs/superpowers/perf/t93
SEED=${1:-$(node -e 'console.log(Math.floor(Math.random()*100000))')}
echo "seed $SEED"
for NAME in base c1 c2 c3 c4 c5; do
  pkill -f "[v]ite preview"; sleep 1
  ( cd "$ROOT/$NAME" && npm run preview -- --strictPort --port 4173 >"/tmp/t93-preview-$NAME.log" 2>&1 & )
  if ! curl -sf --retry 30 --retry-delay 1 --retry-all-errors http://localhost:4173/coldsnap/ -o /dev/null; then echo "SERVER DOWN $NAME"; pkill -f "[v]ite preview"; exit 1; fi
  echo "server up $NAME"
  if ! node "$OUT/run.mjs" "$NAME" "$SEED"; then echo "RUN FAILED $NAME"; pkill -f "[v]ite preview"; exit 1; fi
  pkill -f "[v]ite preview"; sleep 1
done
node "$OUT/page.mjs" || { echo "PAGE FAILED (identity or build)"; exit 1; }
node "$OUT/check.mjs" || { echo "PAGE CHECK FAILED"; exit 1; }
echo "ALL DONE seed $SEED"
```

Syntax pass after saving, each printing nothing: `node --check run.mjs`, `node --check page.mjs`, `node --check check.mjs`, `bash -n all.sh` (from inside the folder).

**6. The runs.** From the folder: start `bash all.sh >/tmp/t93-all.log 2>&1` with the Bash tool's background mode and wait for its completion notice. Status checks read `tail -5 /tmp/t93-all.log`. Never start a second `all.sh`; if the log has not grown for fifteen minutes, report that with the tail. The Pi's desktop stays untouched while it runs — a browser window will open on it six times. The first line of the log is the seed; the last line must be `ALL DONE seed <N>`. Any `RUN FAILED`, `SERVER DOWN`, `PAGE FAILED`, or `PAGE CHECK FAILED` stops the task; the agent reports the log tail and the matching `/tmp/t93-*.log`, and does not retry.

Expected in the log, per run: `run <name> seed <N> mk 0.5.87`, `raf <rate> visibility visible`, `launched`, a `rows …` line every ten seconds climbing to `rows 11 sim 10`, the experiments line, `RUN DONE <name>`. Then `identity: Every run tells the same story …`, `wrote index.html`, `desktop: svgs 2 | paths 6 | …| page errors 0`, `phone: sideways scroll false`, `PAGE CHECK OK`, `ALL DONE seed <N>`.

**7. The copies go.** `for N in base c1 c2 c3 c4 c5; do git -C /home/batman/coldsnap worktree remove --force /home/batman/coldsnap-t93/$N; done && rmdir /home/batman/coldsnap-t93 && echo COPIES GONE`. Expected: `COPIES GONE`. The main tree never changed: `git -C /home/batman/coldsnap status --short -- src` prints nothing.

**8. Land.** Commit `docs/superpowers/perf/t93/` whole — `all.sh`, `run.mjs`, `page.mjs`, `check.mjs`, `base.json`, `c1.json` through `c5.json`, `index.html` — with subject `the five measured`, push. Phase row T93 — version column `—`, "The five measured: six runs on the Pi, the shipped tree and one change each, one seed, the game's own log; the page charts them" — LANDED (no deploy, mark stays 0.5.87, battery T92's block on all six copies, rows identical across all six runs); commit with this plan file, subject `t93 lands in the phase document — the five measured, no deploy`, push. No version bump: nothing deploys. The smoke gate does not run: nothing deploys.

**After the landing (orchestrator).** The page file is read and published as a link; the link is the delivery.

## Report

- One line of outcome, then bullets.
- Read-confirmation first.
- The drawn seed, as printed first; the world seed from the logs.
- The six experiments lines, verbatim.
- The battery: T92's block on all six copies, or the differing line named with its copy.
- The identity line from page.mjs, verbatim; the page check's three lines.
- The frame-rate probe per run, from the log.
- Fixture seeds: 12345 for the battery; the harness's drawn seed for the runs.
- Both commit hashes.
- Every deviation its own labeled bullet.
