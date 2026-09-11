# T27: the ark's burns land whole (0.5.26)

The rubble ship's burn planning becomes the ark's, exactly. Four gaps close: the aimed burn's ghost becomes truthful (the ark's own symplectic predictor at the ark's step, replacing the coarse projection the ghost rode), the ship scene gains a gate that pulls the ship the ark's way, releasing a drag snaps a near-miss aim toward the gate — and, away from the gate, toward a closed orbit — and the LAUNCH and EXECUTE chips grey until an aim is locked. Fuel stays the whole economy: each burn costs its arrow's length, as it already does. Freeze rules, caps, drag math, and cost already match the ark; they are not touched.

Design choices, stated plainly:

- The gate sits at (210, −90) times the world's size, radius 36 — the ark's ring radius, absolute, not scaled. Reached, it turns green and stays; nothing else happens. It pulls the ship alone at mass 2500, the ark's number under this sky's own gravity constant.
- The snap bends the release by at most 0.12 radians in 0.03 steps, the ark's numbers. Toward the gate it takes the closest pass and stops at a threading; away from the gate it takes only a full closed orbit around the heaviest other body, found clean of contact, or leaves the aim untouched.
- The predictor advances the clump tracks as point masses under the live law. It does not shadow individual blocks: a torn hull's fragments fly truths the ghost cannot carry, same as the ark's ghost cannot carry an asteroid strike.
- The clump orbit lines keep their own coarser projection; only the ship's aimed ghost changes hands.

The whole change was applied to a scratch copy at plan-writing time: every anchor hit exactly once, every file parses, every pinned hash below reproduced, the predictor exercised headless.

## Required reading

- This plan, whole.
- `src/game/RubbleWorlds.jsx` — whole.
- `src/game/rubbleworlds/phys.js` — the header comment, `stepWorld`'s gravity-kick block, and the export line.
- `src/game/rubbleworlds/draw.js` — whole.
- `src/game/rubbleworlds/gen.js` — the ship scene block.

## Suggested model

Sonnet. Every substitution is anchored and pre-verified; no design remains.

## Steps

**1. The substitutions.** Every edit is one anchored replacement; an anchor that does not appear exactly once stops the task. From the repo root:

```bash
python3 - <<'PYEOF'
import sys
def sub1(path, old, new, tag):
    s = open(path).read()
    if s.count(old) != 1: sys.exit("anchor fail: %s (count %d)" % (tag, s.count(old)))
    open(path, 'w').write(s.replace(old, new))

# --- 1. phys.js: the ark's predictor, carved to the rubble sky ---
PREDICT = '''// the ark's own predictor, carved to the rubble sky: the same symplectic
// coefficients, the same DT*2 step, run over the clump tracks as point
// masses under the live law — weak cross-clump pull only where the world
// itself is weak. The ship is a point; the gate pulls and is the target.
// The orbit ledger sums the angle swept around the heaviest other track:
// a full turn without contact is a closed orbit, and the snap may take it.
const _cbrt2 = Math.cbrt(2), _W1 = 1 / (2 - _cbrt2), _W0 = -_cbrt2 / (2 - _cbrt2);
const _YC = [_W1 / 2, (_W0 + _W1) / 2, (_W0 + _W1) / 2, _W1 / 2], _YD = [_W1, _W0, _W1];
function gaT(x, z, bodies) { let ax = 0, az = 0; for (const b of bodies) { const dx = b.x - x, dz = b.z - z, r2 = dx * dx + dz * dz + SF * SF, rn = Math.pow(r2, 1.65); ax += G * b.m * dx / rn; az += G * b.m * dz / rn; } return [ax, az]; }
function ystepT(x, z, vx, vz, bodies, dt) {
  x += _YC[0] * vx * dt; z += _YC[0] * vz * dt; let [ax, az] = gaT(x, z, bodies); vx += _YD[0] * ax * dt; vz += _YD[0] * az * dt;
  x += _YC[1] * vx * dt; z += _YC[1] * vz * dt; [ax, az] = gaT(x, z, bodies); vx += _YD[1] * ax * dt; vz += _YD[1] * az * dt;
  x += _YC[2] * vx * dt; z += _YC[2] * vz * dt; [ax, az] = gaT(x, z, bodies); vx += _YD[2] * ax * dt; vz += _YD[2] * az * dt;
  x += _YC[3] * vx * dt; z += _YC[3] * vz * dt; return [x, z, vx, vz];
}
function predictShip(world, vx0, vz0, n) {
  const st = world.shipTrack; if (!st) return null;
  const simP = (world.tracks || []).filter(tk => tk.m >= 500 && tk.clump !== st.clump).slice(0, 14)
    .map(tk => ({ x: tk.x, z: tk.z, vx: tk.vx, vz: tk.vz, m: tk.m, rad: tk.rad }));
  const statics = [];
  if (world.hole) statics.push({ x: world.hole.x, z: world.hole.z, m: world.hole.m, rad: world.hole.killR });
  if (world.star) statics.push({ x: world.star.x, z: world.star.z, m: world.star.m, rad: world.star.r });
  const gate = world.gate;
  const gateGrav = gate ? [{ x: gate.x, z: gate.z, m: 2500, rad: 0 }] : [];
  let x = st.x, z = st.z, vx = vx0, vz = vz0;
  const pts = []; let minGate = Infinity, minGateIdx = 0;
  let anchor = null; for (const p of simP) if (!anchor || p.m > anchor.m) anchor = p;
  let swept = 0, prevAng = anchor ? Math.atan2(z - anchor.z, x - anchor.x) : 0;
  for (let i = 0; i < n; i++) {
    for (const p of simP) {
      const others = [];
      for (const q of simP) if (q !== p) others.push({ x: q.x, z: q.z, m: q.m * (world.weak ? 0.01 : 1) });
      for (const o of statics) others.push(o);
      [p.x, p.z, p.vx, p.vz] = ystepT(p.x, p.z, p.vx, p.vz, others, DT * 2);
    }
    const bodies = [...simP, ...statics, ...gateGrav];
    [x, z, vx, vz] = ystepT(x, z, vx, vz, bodies, DT * 2);
    let danger = 0, hit = false;
    for (const p of simP) { const d = Math.hypot(x - p.x, z - p.z); if (d < p.rad * 2.5) danger = Math.max(danger, 1 - (d - p.rad) / (p.rad * 1.5)); if (d < p.rad + BS) hit = true; }
    for (const o of statics) { const d = Math.hypot(x - o.x, z - o.z); if (d < o.rad + BS) hit = true; }
    let hg = false;
    if (gate) { const gd = Math.hypot(x - gate.x, z - gate.z); if (gd < minGate) { minGate = gd; minGateIdx = pts.length; } hg = gd < gate.r; }
    if (anchor) { const a2 = Math.atan2(z - anchor.z, x - anchor.x); let da = a2 - prevAng; if (da > Math.PI) da -= 2 * Math.PI; if (da < -Math.PI) da += 2 * Math.PI; swept += da; prevAng = a2; }
    if (hit) { pts.push({ x, z, hit: true, danger, hitsGate: hg }); break; }
    pts.push({ x, z, danger, hitsGate: hg });
    if (hg) break;
  }
  return { pts, minGate, minGateIdx, orbit: Math.abs(swept) >= Math.PI * 2 };
}
export { DT, SF, G, BS, BR, PMASS, ITERS, SLOP, BETA, BIAS_CAP, WELD_BREAK, WELD_BIAS, SLEEP_V, WAKE_TIDE, WELD_STRENGTH_BY_SIZE, C30, S30, stepWorld, predictShip };'''
sub1('src/game/rubbleworlds/phys.js',
  'export { DT, SF, G, BS, BR, PMASS, ITERS, SLOP, BETA, BIAS_CAP, WELD_BREAK, WELD_BIAS, SLEEP_V, WAKE_TIDE, WELD_STRENGTH_BY_SIZE, C30, S30, stepWorld };',
  PREDICT, 'phys-predict')

# --- 2. phys.js: the gate pulls the live ship, the ark's law (gate mass 2500, ship only) ---
sub1('src/game/rubbleworlds/phys.js',
  '        if (world.star) pull(b, world.star.x, 0, world.star.z, world.star.m, 1, out);',
  '''        if (world.star) pull(b, world.star.x, 0, world.star.z, world.star.m, 1, out);
        if (world.gate && b.ship) pull(b, world.gate.x, 0, world.gate.z, 2500, 1, out); // the gate pulls the ship alone, the ark's rule''',
  'phys-gate-pull')

# --- 3. gen.js: the ship scene gains its gate ---
sub1('src/game/rubbleworlds/gen.js',
  '    world.shipPhase = "aim";',
  '''    world.shipPhase = "aim";
    world.gate = { x: 210 * size, z: -90 * size, r: 36, reached: false }; // the ark's ring, absolute radius''',
  'gen-gate')

# --- 4. component: predictShip joins the import ---
sub1('src/game/RubbleWorlds.jsx',
  'import { stepWorld, C30, S30 } from "./rubbleworlds/phys.js";',
  'import { stepWorld, predictShip, C30, S30 } from "./rubbleworlds/phys.js";',
  'jsx-import')

# --- 5. component: the ark's release snap in pUp ---
sub1('src/game/RubbleWorlds.jsx',
  '''    const pUp = () => {
      if (panDrag && world && world.ship && world.shipPhase === "fly" && (panDrag.moved || 0) < 10) world.shipPaused = !world.shipPaused;
      panDrag = null;
    };''',
  '''    const pUp = () => {
      if (panDrag && world && world.ship && world.shipPhase === "fly" && (panDrag.moved || 0) < 10) world.shipPaused = !world.shipPaused;
      // the ark's release: a near-miss bends toward the gate; away from the gate, toward a closed orbit
      if (panDrag && panDrag.aim && world && world.shipAim && world.shipAim.on && world.shipTrack) {
        const st = world.shipTrack, aim = world.shipAim, vel = Math.hypot(aim.vx, aim.vz);
        const test = vel > 1 ? predictShip(world, st.vx + aim.vx, st.vz + aim.vz, 400) : null;
        if (test && !test.pts.some(p => p.hitsGate)) {
          const wantGate = world.gate && !world.gate.reached && test.minGate < 80;
          const ang0 = Math.atan2(aim.vz, aim.vx);
          let bestAng = ang0, bestDist = test.minGate, found = false;
          for (let da = -0.12; da <= 0.12; da += 0.03) {
            const ta = ang0 + da;
            const t2 = predictShip(world, st.vx + Math.cos(ta) * vel, st.vz + Math.sin(ta) * vel, 400);
            if (!t2) break;
            if (wantGate) {
              if (t2.minGate < bestDist) { bestDist = t2.minGate; bestAng = ta; }
              if (t2.pts.some(p => p.hitsGate)) { bestAng = ta; found = true; break; }
            } else if (t2.orbit && !t2.pts.some(p => p.hit)) { bestAng = ta; found = true; break; }
          }
          if ((wantGate || found) && bestAng !== ang0) world.shipAim = { on: true, vx: Math.cos(bestAng) * vel, vz: Math.sin(bestAng) * vel };
        }
      }
      panDrag = null;
    };''',
  'jsx-snap')

# --- 6. component: the gate check rides the live loop ---
sub1('src/game/RubbleWorlds.jsx',
  '      if (reps > 0) world.stepMs = +((performance.now() - tPhys) / reps).toFixed(2);',
  '''      if (reps > 0) world.stepMs = +((performance.now() - tPhys) / reps).toFixed(2);
      if (world.gate && !world.gate.reached && world.shipTrack && !planFrozen &&
          Math.hypot(world.shipTrack.x - world.gate.x, world.shipTrack.z - world.gate.z) < world.gate.r) world.gate.reached = true;''',
  'jsx-gate-check')

# --- 7. component: the chips read the locked aim, the ark's disabled manner ---
sub1('src/game/RubbleWorlds.jsx',
  '        setUi(u => ({ ...u, fps, stepMs: world.stepMs || 0, awake, asleep, eaten: world.eaten, weldsAlive, fuel: world.ship ? Math.round(world.ship.fuel) : null, phase: world.shipPhase || null }));',
  '        setUi(u => ({ ...u, fps, stepMs: world.stepMs || 0, awake, asleep, eaten: world.eaten, weldsAlive, fuel: world.ship ? Math.round(world.ship.fuel) : null, phase: world.shipPhase || null, aimOn: !!(world.shipAim && world.shipAim.on) }));',
  'jsx-aimon')
sub1('src/game/RubbleWorlds.jsx',
  '          {ui.phase === "aim" && chip("LAUNCH", true, () => fireBurn("launch"))}',
  '          {ui.phase === "aim" && chip("LAUNCH", ui.aimOn === true, () => ui.aimOn && fireBurn("launch"))}',
  'jsx-launch-chip')
sub1('src/game/RubbleWorlds.jsx',
  '          {ui.phase === "plan" && chip("EXECUTE", true, () => fireBurn("exec"))}',
  '          {ui.phase === "plan" && chip("EXECUTE", ui.aimOn === true, () => ui.aimOn && fireBurn("exec"))}',
  'jsx-exec-chip')

# --- 8. draw.js: predictShip joins the import; the Euler ghost retires ---
sub1('src/game/rubbleworlds/draw.js',
  'import { SF, G, BS, C30, S30 } from "./phys.js";',
  'import { SF, G, BS, C30, S30, predictShip } from "./phys.js";',
  'draw-import')
sub1('src/game/rubbleworlds/draw.js',
  '''        // the aimed burn flies as a ghost: the ship's track plus the locked delta-v
        if (world.shipAim && world.shipAim.on && world.shipTrack) {
          const st = world.shipTrack;
          bodies.push({ x: st.x, z: st.z, vx: st.vx + world.shipAim.vx, vz: st.vz + world.shipAim.vz, m: st.m, rad: st.rad, clump: st.clump, pts: [], hit: -1, ghost: true });
        }
''',
  '', 'draw-ghost-retire')

# --- 9. draw.js: the gate ring and the truthful ghost, drawn before the plan banner ---
sub1('src/game/rubbleworlds/draw.js',
  '      if (world.ship && world.shipPhase === "plan") {',
  '''      // the gate ring — teal pulse until reached, then green, the ark's ring
      if (world.gate) {
        const g = world.gate;
        ctx.beginPath();
        for (let a = 0; a <= 32; a++) { const th = a / 32 * Math.PI * 2; const p = iso(g.x + Math.cos(th) * g.r, g.z + Math.sin(th) * g.r, 0); if (a === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }
        const pulse = 0.45 + 0.25 * Math.sin(frame * 0.08);
        ctx.strokeStyle = g.reached ? "rgba(40,170,90,.8)" : `rgba(40,150,170,${pulse})`;
        ctx.lineWidth = 2.5; ctx.stroke();
      }
      // the aimed burn's TRUTHFUL ghost: the ark's own predictor, blue while
      // clear, red through danger, a green dot where it threads the gate
      if (world.ship && world.shipAim && world.shipAim.on && world.shipTrack) {
        const st = world.shipTrack;
        const pr = predictShip(world, st.vx + world.shipAim.vx, st.vz + world.shipAim.vz, 400);
        if (pr && pr.pts.length > 3) {
          ctx.lineWidth = 2.2;
          for (let i2 = 3; i2 < pr.pts.length; i2 += 3) {
            const q = pr.pts[i2], q0 = pr.pts[i2 - 3];
            const p0 = iso(q0.x, q0.z, 0), p1 = iso(q.x, q.z, 0);
            const fade = Math.max(0.25, 1 - i2 / pr.pts.length);
            ctx.strokeStyle = q.danger > 0.3 ? `rgba(220,55,35,${fade})` : `rgba(60,130,220,${fade * 0.9})`;
            ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
          }
          const last = pr.pts[pr.pts.length - 1];
          if (last.hitsGate) { const p = iso(last.x, last.z, 0); ctx.fillStyle = "rgba(40,170,90,.9)"; ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, Math.PI * 2); ctx.fill(); }
        }
      }
      if (world.ship && world.shipPhase === "plan") {''',
  'draw-gate-and-ghost')
print("all substitutions in")
PYEOF
```

Expected output, exact: `all substitutions in`.

**2. The physics gate.** The gate touches no scene without a gate object and no block outside the ship's hull, so every pinned number stands. The command, whole:

```bash
node -e "
import('node:crypto').then(async({createHash})=>{
  const h=o=>createHash('sha256').update(JSON.stringify(o)).digest('hex').slice(0,16);
  const{makeScenario,SCENES}=await import('./src/game/rubbleworlds/gen.js');
  const{stepWorld}=await import('./src/game/rubbleworlds/phys.js');
  for(const hash of[false,true]){
    const w=makeScenario('binary',12345,1);
    for(let s=0;s<600;s++)stepWorld(w,{welds:true,sleep:true,hash});
    console.log('evolution 10s hash='+hash,h(w.blocks.map(b=>[Math.round(b.x*1000),Math.round(b.y*1000),Math.round(b.z*1000)])));
  }
  for(const sc of SCENES)console.log(sc+' s1',h(makeScenario(sc,12345,1).blocks));
});"
```

Acceptance, exact — every line:

```
evolution 10s hash=false 42ae90b308d1e6f6
evolution 10s hash=true 42ae90b308d1e6f6
ship s1 66300fdf76b09183
binary s1 1ab5dec0a100e39f
duet s1 815c1643021c10c9
moons s1 55e26401d110fa2c
trio s1 7cbf8f6bbd428266
system s1 1bbb5a4a3205c09c
hole s1 cae5ebf64cc05676
```

**3. The predictor gate.** The command, whole:

```bash
node -e "
import('node:crypto').then(async()=>{
  const{makeScenario}=await import('./src/game/rubbleworlds/gen.js');
  const{stepWorld,predictShip}=await import('./src/game/rubbleworlds/phys.js');
  const w=makeScenario('ship',12345,1);
  stepWorld(w,{welds:true,sleep:true,hash:false});
  w.shipTrack=null;
  for(const tk of w.tracks||[]){const b0=w.blocks.find(b2=>b2.ship&&b2.alive);if(b0&&tk.clump===b0.clump){w.shipTrack=tk;break;}}
  const pr=predictShip(w,60,-25,400);
  console.log('predict pts',pr.pts.length,'minGate',Math.round(pr.minGate),'orbit',pr.orbit,'gateHit',pr.pts.some(p=>p.hitsGate));
});"
```

Acceptance, exact:

```
predict pts 69 minGate 248 orbit false gateHit false
```

**4. Gate.** `node scripts/gate.mjs smoke` — 23 PASS, 0 FAIL, foreground, timeout at least 300 seconds.

**5. Version and build.** `MK = "0.5.26"`, then `npm run build`.

**6. Land.** Commit `src/game/RubbleWorlds.jsx`, `src/game/rubbleworlds/phys.js`, `src/game/rubbleworlds/gen.js`, `src/game/rubbleworlds/draw.js`, and `src/version.js` only (plain-words lowercase subject, e.g. "the ark's burns land whole, 0.5.26"), push. The phase document's table gains the T27 row (mark 0.5.26, status LANDED with the hashes and the smoke count); commit, push. The owner's live flight — the ghost that flies true, the ring that pulls, the release that bends — is the acceptance, on phone and desktop both.

## Report

- One line of outcome, then bullets.
- Read-confirmation first.
- Every acceptance line as printed; the smoke count exactly.
- Fixture seeds: the gates pin 12345 by the plan's own law; the demo rolls its own seed at mount — none special.
- Both commit hashes.
- Every deviation its own labeled bullet.
