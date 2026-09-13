# T54: the honest impulse (0.5.49)

A defect fix in gravity's debris alone. The momentum split that shipped in 0.5.48 carried a rescale that multiplies every contact impulse by the block's mass a second time. On mass-1 blocks the factor is exactly 1, so the proving range never felt it; the map's blocks weigh 8 to 34, and there the overshoot feeds back on itself — a broken asteroid's fragments detonate off their siblings and leave the screen at thousands of units a second (measured on a live playtest, seed 69383: a 16-mass fragment to 3828 within half a second, the stored contact impulse ratcheting 937 to 4016 inside one frame). The fix deletes the rescale: the impulse is solved in plain momentum units and lands by each side's true inverse mass. For any pair of equal masses this is arithmetic-identical to the pre-fork solver at any mass value — the identity is by algebra, not by luck.

Fixed against shipped, measured on a fresh copy: seed 69383 goes from 45 runaway blocks and a top speed in the billions to zero runaways and a top speed of 215; seed 12345 goes from 41 runaways to zero, rings holding either way. The map's birth number does not move — generation is untouched.

One file changes: `src/game/gravitydebris/phys.js`. The proving range is untouched by construction and the acceptance checks its status is clean.

## Required reading

- This plan, whole.
- `src/game/gravitydebris/phys.js` — the contact solve and the impulse landing.

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
PHYS='src/game/gravitydebris/phys.js'

# 1. the rescale line goes: the side factors alone are the whole truth
sub1(PHYS, """          cnt.fa = Ra ? arm(Ra, bi) : 1 / bi.m; cnt.fb = Rb ? arm(Rb, bj) : 1 / bj.m;
          cnt.mScale = 2 / (bi.m + bj.m); // rescale so uniform-mass behavior is bit-identical: with equal masses fa+fb doubles against the old units and this halves it back""",
     """          cnt.fa = Ra ? arm(Ra, bi) : 1 / bi.m; cnt.fb = Rb ? arm(Rb, bj) : 1 / bj.m;""", 'drop-mscale')

# 2. the solve in plain momentum units — for equal masses this is the old arithmetic exactly, at any mass
sub1(PHYS, """          let dPn = -(vn - cnt.bias) / ((cnt.fa + cnt.fb) / cnt.mScale) / cnt.mScale; // algebraically -(vn-bias)/(fa+fb); written so the uniform-mass path multiplies and divides by the same number and stays bit-stable""",
     """          let dPn = -(vn - cnt.bias) / (cnt.fa + cnt.fb); // impulse in momentum units; equal masses reproduce the old velocity-unit arithmetic exactly, at any mass""", 'plain-solve')

# 3. impulses land by true inverse mass, nothing rescaled — the shipped rescale
#    multiplied every impulse by the mass a second time and detonated light
#    fragments (measured on seed 69383: a 16-mass block to 3828 in half a second)
sub1(PHYS, """  const Px = Jx / cnt.mScale, Py = Jy / cnt.mScale, Pz = Jz / cnt.mScale; // impulse in momentum units; with equal masses this is J times the block mass, exactly the old arithmetic
  if (cnt.Ra) {
    const R = cnt.Ra;
    R.vx -= Px / R.M; R.vy -= Py / R.M; R.vz -= Pz / R.M;
    R.om -= ((bi.x - R.x) * Pz - (bi.z - R.z) * Px) / R.Iy;
    R.dirty = true;
  } else { bi.vx -= Px / cnt.ma; bi.vy -= Py / cnt.ma; bi.vz -= Pz / cnt.ma; }
  if (cnt.Rb) {
    const R = cnt.Rb;
    R.vx += Px / R.M; R.vy += Py / R.M; R.vz += Pz / R.M;
    R.om += ((bj.x - R.x) * Pz - (bj.z - R.z) * Px) / R.Iy;
    R.dirty = true;
  } else { bj.vx += Px / cnt.mb; bj.vy += Py / cnt.mb; bj.vz += Pz / cnt.mb; }""",
     """  if (cnt.Ra) {
    const R = cnt.Ra;
    R.vx -= Jx / R.M; R.vy -= Jy / R.M; R.vz -= Jz / R.M;
    R.om -= ((bi.x - R.x) * Jz - (bi.z - R.z) * Jx) / R.Iy;
    R.dirty = true;
  } else { bi.vx -= Jx / cnt.ma; bi.vy -= Jy / cnt.ma; bi.vz -= Jz / cnt.ma; }
  if (cnt.Rb) {
    const R = cnt.Rb;
    R.vx += Jx / R.M; R.vy += Jy / R.M; R.vz += Jz / R.M;
    R.om += ((bj.x - R.x) * Jz - (bj.z - R.z) * Jx) / R.Iy;
    R.dirty = true;
  } else { bj.vx += Jx / cnt.mb; bj.vy += Jy / cnt.mb; bj.vz += Jz / cnt.mb; }""", 'plain-landing')
print("all substitutions in")
PYEOF
```

Expected output, exact: `all substitutions in`.

**2. The battery.** From the repo root:

```bash
node -e "
(async()=>{
const {createHash} = await import('node:crypto');
const h = o => createHash('sha256').update(JSON.stringify(o)).digest('hex').slice(0,16);
const DG = await import('./src/game/gravitydebris/gen.js');
const DP = await import('./src/game/gravitydebris/phys.js');
{
  const w = DG.makeScenario('map', 12345, 1);
  console.log('debris map s1', h(w.blocks), 'blocks', w.blocks.length);
  const famC = (f) => { let x=0,z=0,n=0; for (const b of w.blocks) if (b.alive && b.fam===f) { x+=b.x; z+=b.z; n++; } return n?{x:x/n,z:z/n}:null; };
  const r0 = [3,4,5,6].map(f=>Math.round(Math.hypot(famC(f).x,famC(f).z)));
  for (let s=0; s<300; s++) DP.stepWorld(w, {welds:true, sleep:true, hash:true, friction:true});
  const r5 = [3,4,5,6].map(f=>Math.round(Math.hypot(famC(f).x,famC(f).z)));
  const ringOk = r5.every((r,i)=>Math.abs(r-r0[i])<=r0[i]*0.1);
  let fly=0; for (const b of w.blocks) if (b.alive && (Math.hypot(b.vx,b.vz)>400 || Math.hypot(b.x,b.z)>2000)) fly++;
  console.log('12345: rings at 5s', r5.join(' '), '| hold', ringOk?'YES':'NO', '| runaways', fly, '| alive', w.blocks.filter(b=>b.alive).length+'/'+w.blocks.length, '| NaN', w.blocks.some(b=>b.alive&&!isFinite(b.x)));
}
{
  const w = DG.makeScenario('map', 69383, 1);
  for (let s=0; s<300; s++) DP.stepWorld(w, {welds:true, sleep:true, hash:true, friction:true});
  let fly=0, vmax=0; for (const b of w.blocks) if (b.alive) { const v=Math.hypot(b.vx,b.vz); if (v>vmax) vmax=v; if (v>400 || Math.hypot(b.x,b.z)>2000) fly++; }
  console.log('69383: runaways at 5s', fly, '| top speed', Math.round(vmax), '| alive', w.blocks.filter(b=>b.alive).length+'/'+w.blocks.length, '| eaten', w.eaten, '| NaN', w.blocks.some(b=>b.alive&&!isFinite(b.x)));
}
})()"
```

Acceptance, exact — every line:

```
debris map s1 3edfd39c2bb1df1f blocks 1102
12345: rings at 5s 166 294 448 647 | hold YES | runaways 0 | alive 1058/1102 | NaN false
69383: runaways at 5s 0 | top speed 215 | alive 1056/1102 | eaten 46 | NaN false
```

Then confirm the proving range is untouched: `git status --short src/game/rubbleworlds src/game/RubbleWorlds.jsx` prints nothing.

**3. Gate.** `node scripts/gate.mjs smoke` — 23 PASS, 0 FAIL, one run. If the tool moves it to the background past its two-minute window, wait and read the pass from the tail of `.superpowers/gates.log` — do not start a second run.

**4. Version and build.** `MK = "0.5.49"`, then `npm run build`.

**5. Land.** Commit `src/game/gravitydebris/phys.js` and `src/version.js` only (subject `the honest impulse, 0.5.49`), push. The phase document's table adds row T54 — "The honest impulse: the debris fork's contact rescale deleted; impulses in plain momentum units; light fragments no longer detonate" — LANDED (mark 0.5.49, debris map number unchanged 3edfd39c2bb1df1f, both battery seeds clean, the smoke count); commit with this plan file, push. The live check is the acceptance, phone and desktop both: broken asteroids chip and drift instead of vanishing at speed.

## Report

- One line of outcome, then bullets.
- Read-confirmation first.
- Every acceptance line as printed; the smoke count exactly.
- The proving range untouched — the empty git status — as its own labeled bullet.
- Fixture seeds: the battery pins 12345 (the fixed opening's own seed) and 69383 (the playtest seed that surfaced the defect); the module rolls fresh seeds at reset.
- Both commit hashes.
- Every deviation its own labeled bullet.
