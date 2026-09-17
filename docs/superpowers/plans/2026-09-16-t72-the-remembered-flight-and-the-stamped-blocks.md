# T72: the remembered flight and the stamped blocks (0.5.67)

Two memory-for-work trades in the drawing, one file. First: the ship's two trajectory ghosts keep their computed path in memory and re-simulate only when the velocity they were built from moves, or every sixth frame — instead of running a 2,400-step flight simulation every drawn frame; between physics steps at slow time the velocity holds still, so the memory serves every frame of the gap. Second: each cube face-set draws once into a small stored image per color, size, and light step; every block after that is a single image stamp instead of three filled shapes — the store holds at most four thousand images and clears itself if passed. The physics is untouched.

Design choices, stated plainly: the six-frame ghost age and the 0.01 velocity tolerance; the light quantized to eight steps and the size to half-pixels for the stamps; the four-thousand image cap. The quantized light means a block's shading moves in steps rather than continuously — the visible grain of the trade. Seed 12345 is the fixture. The battery is structural; the map number cannot move — drawing is the only change — and the battery proves it by printing `f75a59862872fd01` unchanged.

The substitution script was applied to a fresh copy of the live tree at plan-writing time: every anchor hit exactly once, the file parses.

## Required reading

- This plan, whole.
- `src/game/gravitydebris/draw.js` — the two ghost blocks and the block-painting loop.

## Suggested model

Sonnet. One pre-verified substitution script on one file; no design remains.

## Steps

**1. The substitutions.** From the repo root:

```bash
python3 - <<'PYEOF'
import sys
def subn(path, old, new, n, tag):
    s = open(path).read()
    if s.count(old) != n: sys.exit("anchor fail: %s (count %d, wanted %d)" % (tag, s.count(old), n))
    open(path, 'w').write(s.replace(old, new))
DRAW='src/game/gravitydebris/draw.js'

# A. THE REMEMBERED FLIGHT: the two ship ghosts keep their computed path in
# memory and re-simulate only when the velocities they were built from move,
# or every sixth frame — instead of a 2400-step simulation every drawn frame.
subn(DRAW, """      if (world.ship && world.shipAim && world.shipAim.on && world.shipTrack) {
        const st = world.shipTrack;
        const pr = predictShip(world, st.vx + world.shipAim.vx, st.vz + world.shipAim.vz, 2400); // forty simulated seconds at the physics step""",
     """      if (world.ship && world.shipAim && world.shipAim.on && world.shipTrack) {
        const st = world.shipTrack;
        const kx = st.vx + world.shipAim.vx, kz = st.vz + world.shipAim.vz;
        let pr; const gA = world._ghostA; // the remembered aim ghost
        if (gA && frame - gA.f0 < 6 && Math.abs(gA.kx - kx) < 0.01 && Math.abs(gA.kz - kz) < 0.01) pr = gA.pr;
        else { pr = predictShip(world, kx, kz, 2400); world._ghostA = { f0: frame, kx, kz, pr }; } // forty simulated seconds, re-simulated only when the aim moves or the memory ages six frames""", 1, 'aim-ghost')
subn(DRAW, """      if (world.ship && world.shipPhase === "fly" && !world.shipDead && world.shipTrack && !(world.shipAim && world.shipAim.on)) {
        const st = world.shipTrack;
        const pr = predictShip(world, st.vx, st.vz, 2400);""",
     """      if (world.ship && world.shipPhase === "fly" && !world.shipDead && world.shipTrack && !(world.shipAim && world.shipAim.on)) {
        const st = world.shipTrack;
        let pr; const gF = world._ghostF; // the remembered flight ghost: between physics steps the velocity holds still, so the memory serves every frame of the gap
        if (gF && frame - gF.f0 < 6 && Math.abs(gF.kx - st.vx) < 0.01 && Math.abs(gF.kz - st.vz) < 0.01) pr = gF.pr;
        else { pr = predictShip(world, st.vx, st.vz, 2400); world._ghostF = { f0: frame, kx: st.vx, kz: st.vz, pr }; }""", 1, 'fly-ghost')

# B. THE STAMPED BLOCKS: each color-shade-size of cube draws once into a small
# stored image; every block after is a single image stamp instead of three
# filled paths. The store caps at four thousand images and clears if passed.
subn(DRAW, """        ctx.fillStyle = shade(rgb, lam * 0.72);
        ctx.beginPath(); ctx.moveTo(p.x - hw, p.y - hh); ctx.lineTo(p.x, p.y); ctx.lineTo(p.x, p.y + vh); ctx.lineTo(p.x - hw, p.y + vh - hh); ctx.closePath(); ctx.fill();
        ctx.fillStyle = shade(rgb, lam * 0.5);
        ctx.beginPath(); ctx.moveTo(p.x + hw, p.y - hh); ctx.lineTo(p.x, p.y); ctx.lineTo(p.x, p.y + vh); ctx.lineTo(p.x + hw, p.y + vh - hh); ctx.closePath(); ctx.fill();
        ctx.fillStyle = shade(rgb, Math.min(lam * 1.25, 1.05));
        ctx.beginPath(); ctx.moveTo(p.x, p.y - hh * 2); ctx.lineTo(p.x + hw, p.y - hh); ctx.lineTo(p.x, p.y); ctx.lineTo(p.x - hw, p.y - hh); ctx.closePath(); ctx.fill();
      }""",
     """        // THE STAMPED BLOCKS: the cube's three faces draw once into a stored
        // image per color, size, and light step; every block after is one stamp.
        const hwq = Math.max(2, Math.round(hw * 2) / 2), lamq = Math.round(Math.min(Math.max(lam, 0.3), 1.1) * 8);
        const sk = (rgb[0] << 16 | rgb[1] << 8 | rgb[2]) + ':' + hwq + ':' + lamq;
        if (!world._spr) world._spr = new Map();
        let sp = world._spr.get(sk);
        if (!sp) {
          const lq = lamq / 8, hhq = hwq * (S30 / C30), vhq = hwq * (0.9 / C30);
          sp = document.createElement('canvas'); sp.width = Math.ceil(hwq * 2 + 2); sp.height = Math.ceil(hhq * 2 + vhq + 2);
          const sx = ctx2 => { const ox = hwq + 1, oy = hhq * 2 + 1;
            ctx2.fillStyle = shade(rgb, lq * 0.72);
            ctx2.beginPath(); ctx2.moveTo(ox - hwq, oy - hhq); ctx2.lineTo(ox, oy); ctx2.lineTo(ox, oy + vhq); ctx2.lineTo(ox - hwq, oy + vhq - hhq); ctx2.closePath(); ctx2.fill();
            ctx2.fillStyle = shade(rgb, lq * 0.5);
            ctx2.beginPath(); ctx2.moveTo(ox + hwq, oy - hhq); ctx2.lineTo(ox, oy); ctx2.lineTo(ox, oy + vhq); ctx2.lineTo(ox + hwq, oy + vhq - hhq); ctx2.closePath(); ctx2.fill();
            ctx2.fillStyle = shade(rgb, Math.min(lq * 1.25, 1.05));
            ctx2.beginPath(); ctx2.moveTo(ox, oy - hhq * 2); ctx2.lineTo(ox + hwq, oy - hhq); ctx2.lineTo(ox, oy); ctx2.lineTo(ox - hwq, oy - hhq); ctx2.closePath(); ctx2.fill(); };
          sx(sp.getContext('2d'));
          if (world._spr.size > 4000) world._spr.clear();
          world._spr.set(sk, sp);
        }
        ctx.drawImage(sp, p.x - hwq - 1, p.y - hwq * (S30 / C30) * 2 - 1);
      }""", 1, 'stamped-blocks')
print("all substitutions in")
PYEOF
```

Expected output, exact: `all substitutions in`.

**2. The battery.** From the repo root, save the block below as `/tmp/battery72.mjs` and run `node /tmp/battery72.mjs /home/batman/coldsnap` once:

```js
// THE CLIMB BATTERY: seed 12345, one run — the sky builds, steps 5 simulated seconds, no numeric breakdown.
const dir = process.argv[2] || '.';
const {createHash} = await import('node:crypto');
const h = o => createHash('sha256').update(JSON.stringify(o)).digest('hex').slice(0,16);
const DG = await import(dir + '/src/game/gravitydebris/gen.js');
const DP = await import(dir + '/src/game/gravitydebris/phys.js');
const w = DG.makeScenario('map', 12345, 1);
console.log('map s1', h(w.blocks), 'blocks', w.blocks.length);
for (let s = 0; s < 300; s++) DP.stepWorld(w, {welds:true, sleep:true, hash:true, friction:true});
const nan = w.blocks.some(b => b.alive && !isFinite(b.x));
console.log('at 5s: alive ' + w.blocks.filter(b=>b.alive).length + '/' + w.blocks.length + ' | eaten ' + w.eaten + ' | NaN ' + nan);
console.log(nan ? 'STRUCTURE BROKE' : 'STRUCTURE HELD');
```

Acceptance: the final line prints `STRUCTURE HELD`, NaN reads `false`, and the map number prints `f75a59862872fd01` unchanged.

Then confirm the proving range is untouched: `git status --short src/game/rubbleworlds src/game/RubbleWorlds.jsx` prints nothing.

**3. Gate.** `node scripts/gate.mjs smoke` — 23 PASS, 0 FAIL, one run. If the tool moves it to the background past its two-minute window, wait and read the pass from the tail of `.superpowers/gates.log` — do not start a second run.

**4. Version and build.** `MK = "0.5.67"`, then `npm run build`.

**5. Land.** Commit `src/game/gravitydebris/draw.js` and `src/version.js` only (subject `the remembered flight and the stamped blocks, 0.5.67`), push. The phase document's table adds row T72 — "The remembered flight and the stamped blocks: the ghosts re-simulate only when the aim moves; cubes stamp from stored images" — LANDED (mark 0.5.67, map number unchanged f75a59862872fd01, the smoke count); commit with this plan file, push. The live check is the acceptance, phone and desktop both — the frame readout tells the gain.

## Report

- One line of outcome, then bullets.
- Read-confirmation first.
- The battery's printed lines, verbatim; the smoke count exactly.
- The proving range untouched — the empty git status — as its own labeled bullet.
- The map's generation number unchanged, its own labeled bullet.
- Fixture seed: 12345; the module rolls fresh seeds at reset.
- Both commit hashes.
- Every deviation its own labeled bullet.
