# T84: the shield walls (0.5.79)

The ship gains its shields on the debris map: walls of translucent third-block cells projected one cell outside the hull's own silhouette on all four ship faces, standard on every hull, no blueprint or hangar changes. The cells are real blocks in the physics — they ride the ship's rigid island through born welds, take strikes under the existing module-health law, and die into real holes a small rock can slip through. A SHIELDS chip beside DARK cycles five presets — spread, fore, aft, left, right — a doubled face stacking its opposite wall on top of its own two deep, the opposite side riding bare. One new file carries the whole shield law; the physics file is not touched at all. Phone and desktop alike: the chip rides the existing wrapping row.

The law, as settled: every attackable face wears 9 cells on the long-range (wider hulls wall wider, from their own silhouette), 36 standing at rest. A cell has health 50 — half a hull block — under the hull's own graze law, so a braked touch costs nothing and one hard strike kills a cell outright. A dead cell returns 2 wall-clock seconds after it first touches an undamaged full-health neighbor, whatever the time chip says, so holes close from the rim inward; walls meet at the corners, so even a stripped face reseeds from its neighbors, slowest of all. Wounded cells heal at the generator's own pace but cannot seed a dead neighbor. Cycling the preset moves the walls with their wounds and holes — state travels slot for slot, so the chip can never be pumped for free healing. Shields heal, by standing exception; the hull and its welds keep damage-stays-damage untouched.

How it lands without touching the physics: cells are ship blocks (never sleeping, never cold-welding, exempt from the consuming strike, wounded by the module-health law exactly as the hull is), born welded to the hull and to each other by the existing weld builder — same tint, within its own link reach — so the rigid ship island carries them and the burn kicks them with the hull. The new module owns only what the physics does not: the slot lattice built from the hull's silhouette, the preset transfer, and the wall-clock regrowth, which repositions a returning cell from the cabin's live position and the hull's current turn (fitted from two living hull blocks, because the hull may have spun in flight), revives its born welds — the one recorded exception to welds-never-reform — and refuses to materialize a cell where a foreign block stands, waiting instead. A gap in the frame calls longer than half a second reads as a pause and every timer shifts past it, so paused time heals nothing.

Design choices, stated plainly: cell mass 2, light enough to leave the hull's momentum alone; the shield's color one pale blue, drawn at a third opacity whole and fainter when wounded (0.33 and 0.18); the spawn-refusal margin half a unit; the adjacency reach 2.9, the weld builder's own link for third-blocks, which is what joins the walls at the corners. All are design choices until played; your eye on the live site rules them.

What could stop this, thought through ahead: the debris map's evolution hash moves by design — the sky gains 72 ship-rider blocks — and the battery pins the new number; the rubble twin is untouched and its unchanged line proves it. The smoke never visits this screen, so it cannot fail from the change and cannot test it; the battery and your live play are the proof. Headless, an unlaunched ship falls into the great star by frame 155 and the star eats the walls whole (measured at plan-writing), so the battery launches the ship with the game's own birth burn before stepping. The cost is 36 extra never-sleeping blocks on one island — measured alongside roughly 1800 alive blocks already stepping, and your live check judges the frame rate. No save shapes, no depot code, no frozen files, and no `src/game/rubbleworlds/` file are touched.

The whole change was built and run on a fresh copy of the live tree at plan-writing time: every anchor hit exactly once, all four touched files parse or compile clean, and the battery below reproduced byte for byte across two runs.

## Required reading

- This plan, whole.
- `src/game/gravitydebris/phys.js` — the module-health law, rigid promotion, the weld sweeps, shipConn.
- `src/game/gravitydebris/gen.js` — addShip and the map branch.
- `src/game/gravitydebris/draw.js` — the stamped-blocks loop.
- `src/game/GravityDebris.jsx` — the loop, the burn ref pattern, the chip row.

## Suggested model

Sonnet. The new file and every substitution are pre-written and pre-verified; no design remains.

## Steps

**1. The new file.** Write `src/game/gravitydebris/shields.js` with exactly this content:

```js
// gravitydebris/shields.js — the ship's shield walls: translucent third-block
// cells projected one cell outside the hull's own silhouette on all four ship
// faces, standard on every hull. Cells are real blocks: they ride the ship's
// rigid island through born welds, take strikes under the module-health law,
// and die into real holes a small rock can slip through. This module owns what
// the physics does not: the slot lattice, the preset that moves walls, and the
// regrowth law — a dead cell returns 2 wall-clock seconds after it first
// touches an undamaged powered neighbor, so holes close from the rim inward,
// and walls meet at the corners, so even a stripped face reseeds from its
// neighbors. Wounded cells heal at the same pace but cannot seed. Shields
// heal; the hull and its welds keep damage-stays-damage.
import { BS } from "./phys.js";

const CS = BS / 3;            // cell edge — 9 cells wall a 3-block face
const CELL_HP = 50;           // half a hull block
const CELL_M = 2;             // field mass: light enough to leave the hull's momentum alone
const HEAL_MS = 2000;         // 2 wall-clock seconds, whatever the time chip says
const ADJ_R = 2.9;            // slot adjacency reach — wall neighbors, layers, and the corner diagonal
const PRESETS = ["SPREAD", "FORE", "AFT", "LEFT", "RIGHT"];
// each preset's powered walls in canonical order; state moves slot k to slot k
// across the ordered lists, so the opposite wall stacks onto a doubled face
const WALLS = {
  SPREAD: ["fore-in", "aft-in", "left-in", "right-in"],
  FORE: ["fore-in", "fore-out", "left-in", "right-in"],
  AFT: ["aft-in", "aft-out", "left-in", "right-in"],
  LEFT: ["left-in", "left-out", "fore-in", "aft-in"],
  RIGHT: ["right-in", "right-out", "fore-in", "aft-in"],
};

// the ship's current turn, fitted from the cabin and any other living hull
// block against their born local coordinates — the hull may have spun in
// flight, and the slots must follow the hull as it stands, not as it was born
function frameFit(world) {
  const wb = world.blocks;
  const cab = wb.find((b) => b.ship && b.cab && b.alive);
  if (!cab) return null;
  let th = world.shipAng || 0;
  for (const b of wb) {
    if (!b.ship || b.shieldCell || b.cab || !b.alive || b.slx == null) continue;
    th = Math.atan2(b.z - cab.z, b.x - cab.x) - Math.atan2(b.slz, b.slx);
    break;
  }
  return { cab, co: Math.cos(th), si: Math.sin(th) };
}

// a dead cell returns at its slot — unless a foreign block stands on the spot,
// in which case it waits; materializing inside a rock is a detonation, not care
function reviveAt(world, c, fit) {
  const wx = fit.cab.x + c.slx * fit.co - c.slz * fit.si;
  const wz = fit.cab.z + c.slx * fit.si + c.slz * fit.co;
  for (const o of world.blocks) {
    if (!o.alive || o.ship) continue;
    const cd = c.cr + o.cr + 0.5;
    if ((o.x - wx) * (o.x - wx) + (o.z - wz) * (o.z - wz) < cd * cd && Math.abs(o.y) < cd) return false;
  }
  c.x = wx; c.z = wz; c.y = 0;
  c.vx = fit.cab.vx; c.vy = fit.cab.vy; c.vz = fit.cab.vz;
  c.alive = true; c.hp = CELL_HP; c.sleeping = false; c.dmgF = 0; c.dmgCd = 0;
  c._seedAt = null; c._healT = null;
  const wl = world._cellWelds && world._cellWelds.get(c);
  if (wl) for (const w of wl) { const a = world.blocks[w.a], b = world.blocks[w.b]; if (a.alive && b.alive) w.alive = true; } // the shield exception: a regrown cell rejoins the island; hull welds never reform
  return true;
}

function cellWeldLists(world) {
  if (world._cellWelds) return;
  world._cellWelds = new Map();
  for (const c of world.shieldCells) world._cellWelds.set(c, []);
  for (const w of world.welds) {
    const a = world.blocks[w.a], b = world.blocks[w.b];
    if (a.shieldCell) world._cellWelds.get(a).push(w);
    if (b.shieldCell) world._cellWelds.get(b).push(w);
  }
}

// the slot lattice from the hull's silhouette: inner walls hug it one cell out,
// outer walls one cell further; fore is the hull's own +x, left its -z
function initShields(world) {
  if (!world.ship) return;
  const wb = world.blocks;
  const hull = wb.filter((b) => b.ship && !b.shieldCell);
  const cab = hull.find((b) => b.cab);
  if (!cab) return;
  let minx = 1e9, maxx = -1e9, minz = 1e9, maxz = -1e9;
  for (const b of hull) {
    minx = Math.min(minx, b.slx - BS / 2); maxx = Math.max(maxx, b.slx + BS / 2);
    minz = Math.min(minz, b.slz - BS / 2); maxz = Math.max(maxz, b.slz + BS / 2);
  }
  const span = (a, b) => { const out = []; for (let v = a + CS / 2; v < b; v += CS) out.push(v); return out; };
  const slots = [];
  for (const z of span(minz, maxz)) {
    slots.push({ wall: "fore-in", slx: maxx + CS / 2, slz: z });
    slots.push({ wall: "fore-out", slx: maxx + CS * 1.5, slz: z });
    slots.push({ wall: "aft-in", slx: minx - CS / 2, slz: z });
    slots.push({ wall: "aft-out", slx: minx - CS * 1.5, slz: z });
  }
  for (const x of span(minx, maxx)) {
    slots.push({ wall: "right-in", slx: x, slz: maxz + CS / 2 });
    slots.push({ wall: "right-out", slx: x, slz: maxz + CS * 1.5 });
    slots.push({ wall: "left-in", slx: x, slz: minz - CS / 2 });
    slots.push({ wall: "left-out", slx: x, slz: minz - CS * 1.5 });
  }
  world.shieldPreset = "SPREAD";
  const powered = new Set(WALLS.SPREAD);
  world.shieldCells = [];
  for (const s of slots) {
    const on = powered.has(s.wall);
    const c = { x: cab.x + s.slx, y: 0, z: cab.z + s.slz, vx: 0, vy: 0, vz: 0, tint: 2, ship: true, shieldCell: true, wall: s.wall, slx: s.slx, slz: s.slz, powered: on, hp: CELL_HP, alive: on, sleeping: false, clump: -1, s: CS, cr: CS * 0.55, m: CELL_M };
    wb.push(c); world.shieldCells.push(c);
  }
  world.shieldAdj = world.shieldCells.map((c) => {
    const out = [];
    for (let j = 0; j < world.shieldCells.length; j++) {
      const o = world.shieldCells[j];
      if (o === c) continue;
      const dx = o.slx - c.slx, dz = o.slz - c.slz;
      if (dx * dx + dz * dz <= ADJ_R * ADJ_R) out.push(j);
    }
    return out;
  });
}

// the wall-clock heal, called once per drawn frame while time runs: wounded
// powered cells regain at the generator's pace, dead powered cells with an
// undamaged powered neighbor come back after their 2 seconds. A long gap in
// the calls is a pause, not elapsed care — every timer shifts past it.
function stepShields(world, now) {
  const cells = world.shieldCells;
  if (!cells) return;
  cellWeldLists(world);
  const gap = now - (world._shieldLast == null ? now : world._shieldLast);
  world._shieldLast = now;
  if (gap > 500) for (const c of cells) { if (c._seedAt != null) c._seedAt += gap; if (c._healT != null) c._healT += gap; }
  let fit = null;
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    if (!c.powered) continue;
    if (c.alive) {
      if (c.hp < CELL_HP) {
        if (c._healT == null) c._healT = now;
        c.hp = Math.min(CELL_HP, c.hp + (CELL_HP * (now - c._healT)) / HEAL_MS);
        c._healT = now;
      } else c._healT = null;
      c._seedAt = null;
      continue;
    }
    let seed = false;
    for (const j of world.shieldAdj[i]) { const n = cells[j]; if (n.powered && n.alive && n.hp >= CELL_HP) { seed = true; break; } }
    if (!seed) { c._seedAt = null; continue; }
    if (c._seedAt == null) { c._seedAt = now; continue; }
    if (now - c._seedAt >= HEAL_MS) {
      if (!fit) fit = frameFit(world);
      if (fit) reviveAt(world, c, fit);
    }
  }
}

// the preset chip's turn: capture the powered slots' states in canonical wall
// order, repower the next preset's slots, and carry state k to slot k — live
// cells re-stand at their new slots, holes travel as holes
function cycleShieldPreset(world) {
  const cells = world.shieldCells;
  if (!cells) return null;
  cellWeldLists(world);
  const old = world.shieldPreset || "SPREAD";
  const next = PRESETS[(PRESETS.indexOf(old) + 1) % PRESETS.length];
  const list = (p) => { const out = []; for (const wname of WALLS[p]) for (let i = 0; i < cells.length; i++) if (cells[i].wall === wname) out.push(i); return out; };
  const ol = list(old), nl = list(next);
  const states = ol.map((i) => ({ alive: cells[i].alive, hp: cells[i].hp }));
  for (const i of ol) { const c = cells[i]; c.powered = false; c.alive = false; c._seedAt = null; c._healT = null; }
  const fit = frameFit(world);
  for (let k = 0; k < nl.length; k++) {
    const c = cells[nl[k]], st = states[k] || { alive: false, hp: 0 };
    c.powered = true; c.alive = false; c._seedAt = null; c._healT = null;
    if (st.alive && fit) reviveAt(world, c, fit); // a live cell blocked from its new slot waits as a hole instead
    c.hp = st.hp; // the cell's health travels with its state, wounded or whole
  }
  world.shieldPreset = next;
  return next;
}

export { initShields, stepShields, cycleShieldPreset, CELL_HP, PRESETS };
```

Then `node --check src/game/gravitydebris/shields.js` prints nothing.

**2. The substitutions.** From the repo root:

```bash
python3 - <<'PYEOF'
import sys
def subn(path, old, new, n, tag):
    s = open(path).read()
    if s.count(old) != n: sys.exit("anchor fail: %s (count %d, wanted %d)" % (tag, s.count(old), n))
    open(path, 'w').write(s.replace(old, new))

GEN = 'src/game/gravitydebris/gen.js'
DRW = 'src/game/gravitydebris/draw.js'
JSX = 'src/game/GravityDebris.jsx'

subn(GEN, 'import { DT, SF, G, BS, PMASS } from "./phys.js";',
          'import { DT, SF, G, BS, PMASS } from "./phys.js";\nimport { initShields } from "./shields.js";', 1, 'gen:import')
subn(GEN, 'world.blocks.push({ x: sx + gx * BS, y: 0, z: sz + gy * BS, vx: 0, vy: 0, vz: 0, tint: 2, ship: true,',
          'world.blocks.push({ x: sx + gx * BS, y: 0, z: sz + gy * BS, vx: 0, vy: 0, vz: 0, tint: 2, slx: gx * BS, slz: gy * BS, ship: true,', 1, 'gen:locals')
subn(GEN, '  world.shipPhase = "aim";\n}',
          '  world.shipPhase = "aim";\n  initShields(world); // the shield walls stand from birth, standard on every hull\n}', 1, 'gen:init')

subn(DRW, 'const p = iso(lx(b), lz(b), ly(b)), rgb = b.ship ? tints[b.tint] : struck ? [214, 74, 52] : (b.rgb || tints[b.tint]);',
          'const p = iso(lx(b), lz(b), ly(b)), rgb = b.shieldCell ? [130, 200, 255] : b.ship ? tints[b.tint] : struck ? [214, 74, 52] : (b.rgb || tints[b.tint]);', 1, 'draw:rgb')
subn(DRW, '        ctx.drawImage(sp, p.x - hwq - 1, p.y - hwq * (S30 / C30) * 2 - 1);',
          '        if (b.shieldCell) ctx.globalAlpha = b.hp >= 50 ? 0.33 : 0.18; // the shield reads translucent; a wounded cell fainter\n        ctx.drawImage(sp, p.x - hwq - 1, p.y - hwq * (S30 / C30) * 2 - 1);\n        if (b.shieldCell) ctx.globalAlpha = 1;', 1, 'draw:alpha')

subn(JSX, 'import { makeScenario, HULL_LIST, HULL_LABEL } from "./gravitydebris/gen.js";',
          'import { makeScenario, HULL_LIST, HULL_LABEL } from "./gravitydebris/gen.js";\nimport { stepShields, cycleShieldPreset } from "./gravitydebris/shields.js";', 1, 'jsx:import')
subn(JSX, "    // the ark's two-mode burns, landing on the rigid hull as uniform delta-v\n    burnRef.current = (what) => {",
          "    shieldRef.current = () => { if (!world || !world.ship) return; cycleShieldPreset(world); setUi(u => ({ ...u, shieldPreset: world.shieldPreset })); };\n    // the ark's two-mode burns, landing on the rigid hull as uniform delta-v\n    burnRef.current = (what) => {", 1, 'jsx:ref')
subn(JSX, '      if (world.ship && !world.shipDead) {',
          '      if (world.ship && !planFrozen) stepShields(world, performance.now()); // the walls heal on the wall clock, frozen with the sky\n      if (world.ship && !world.shipDead) {', 1, 'jsx:step')
subn(JSX, 'dead: !!world.shipDead, burns: world.ship ? world.ship.burns : 0, deadT: world.shipDead ? Math.round(world.deadAt) : null }));',
          'shieldPreset: world.shieldPreset || null, dead: !!world.shipDead, burns: world.ship ? world.ship.burns : 0, deadT: world.shipDead ? Math.round(world.deadAt) : null }));', 1, 'jsx:ui')
subn(JSX, '  const burnRef = useRef(null);',
          '  const burnRef = useRef(null);\n  const shieldRef = useRef(null);\n  const fireShield = () => { if (shieldRef.current) shieldRef.current(); };', 1, 'jsx:refdecl')
subn(JSX, '          {chip(`DARK ${ctl.current.dark ? "ON" : "OFF"}`, ctl.current.dark, () => setLive(k => { k.dark = !k.dark; }))}',
          '          {chip(`DARK ${ctl.current.dark ? "ON" : "OFF"}`, ctl.current.dark, () => setLive(k => { k.dark = !k.dark; }))}\n          {ui.shieldPreset && chip(`SHIELDS ${ui.shieldPreset}`, false, fireShield)}', 1, 'jsx:chip')
print("all substitutions in")
PYEOF
```

Expected output, exact: `all substitutions in`.

Then `node --check src/game/gravitydebris/gen.js` and `node --check src/game/gravitydebris/draw.js` each print nothing, and `node_modules/.bin/esbuild --loader:.jsx=jsx src/game/GravityDebris.jsx --outfile=/dev/null --log-level=error` prints nothing.

**3. The battery.** Save the block below as `/tmp/battery84.mjs` and run `node /tmp/battery84.mjs /home/batman/coldsnap` once.

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
  DD.drawFrame({ ctx: stub(), W: 900, H: 600, world: w, frame: w.frame, time: 0.5 });
  DD.drawFrame({ ctx: stub(), W: 900, H: 600, world: w, frame: w.frame, time: 0.5, dark: true });
  console.log('debris frames drawn light+dark | NaN ' + w.blocks.some(b => b.alive && !isFinite(b.x)));
}
console.log('STRUCTURE HELD');
```

Acceptance, exact — every line. The rubble line is the untouched tree's own number, proving the twin never moved; the debris hash is the new pinned number for the sky with walls, reproduced byte for byte across two plan-writing runs:

```
rubble system at 5s 582386c0cb544735 alive 171/171
shields at birth: cells 72 | powered 36 | up 36 | preset SPREAD
launched: hull and walls together 41
debris map at 5s 389f479192501c35 alive 1829/2239 | eaten 533
holes punched: 3
after 2.6s on the wall clock: holes 1
after 5.4s: holes 0
preset FORE: fore 18 | aft 0 | left 9 | right 9 | up 36
debris frames drawn light+dark | NaN false
STRUCTURE HELD
```

**4. Version and build.** `MK = "0.5.79"` in `src/version.js`, then `npm run build`.

**5. The server, then the gate.** Start the preview server in the background, logging to `/tmp/preview84.log`:

```bash
npm run preview >/tmp/preview84.log 2>&1 &
```

Prove it is up — expected output, exact: `SERVER UP`:

```bash
curl -sf --retry 20 --retry-delay 1 --retry-all-errors http://localhost:4173/coldsnap/ -o /dev/null && echo SERVER UP
```

Then `node scripts/gate.mjs smoke` — the banner prints `boot-load smoke 0.5.79`, then 23 PASS, 0 FAIL, one run. If the tool moves it to the background past its two-minute window, wait and read the pass from the tail of `.superpowers/gates.log` — do not start a second run. Then stop the server with the bracketed pattern, which can never match its own command line:

```bash
pkill -f "[v]ite preview"
```

A failed gate still stops the server, then stops the task.

**6. Land.** Commit `src/game/gravitydebris/shields.js`, `src/game/gravitydebris/gen.js`, `src/game/gravitydebris/draw.js`, `src/game/GravityDebris.jsx`, and `src/version.js` only (subject `the shield walls, 0.5.79`), push. The phase document's table adds row T84 — "The shield walls: translucent cells wall the hull, holes punch and heal rim inward, five presets on one chip" — LANDED (mark 0.5.79, the rubble twin's hash unchanged, the smoke count); commit with this plan file, push. The live check is the acceptance, phone and desktop both: the walls stand translucent around the ship, a flight through rubble punches visible holes, holes close from the rim on the wall clock, and the SHIELDS chip walks the five presets.

## Report

- One line of outcome, then bullets.
- Read-confirmation first.
- The battery's printed lines, verbatim; the smoke count exactly.
- The rubble twin's unchanged hash as its own labeled bullet; the debris hash as the new pinned number.
- Fixture seed: 12345; the module rolls fresh seeds at reset.
- Both commit hashes.
- Every deviation its own labeled bullet.
