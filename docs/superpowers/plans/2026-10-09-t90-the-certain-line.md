# T90: the certain line and the cone (0.5.85)

Two frame-stealers go in one task. First, the clump scan's tail — the group bookkeeping after the walk, 14 milliseconds in one frame — rests between frames exactly as the walk now does; the step's chunk budget rises 14 to 17; physics byte-identical, both hashes proven unmoved. Second, the ghost is reborn as the certain line and the cone: three predictions ride together — the aim's own path and two brackets tilted .015 either side — building 300 steps per path per frame instead of 2,400 in one; while the brackets hug, the path draws as today's known line; where they first spread past 24 units, certainty ends and the fan between them draws as a translucent cone — short and wide near chaos like the triad, long and narrow over calm ground. The picture fills in over a few frames and refreshes about twice a second. The release snap still uses the whole-run predictor, which is carved in two but proven to answer byte for byte — the battery's new predictor probe pins it. Debris screen only; the rubble twin untouched. Tilt, cut, budget, refresh, and the cone's fills are design choices until played. One commit.

Checked on a fresh copy at plan-writing time: every anchor hit once, all three files parse and compile clean, both evolution hashes unmoved, the predictor probe identical to the untouched tree's own number, and the cone builder proven advancing headless.

## Required reading

- This plan, whole.
- `src/game/gravitydebris/phys.js` — the clump scan's tail, predictShip, the exports.
- `src/game/gravitydebris/draw.js` — the two ghost blocks.
- `src/game/GravityDebris.jsx` — the frame-split chunk budget.

## Suggested model

Sonnet. Pre-verified substitutions in three files; no design remains.

## Steps

**1. The substitutions.** From the repo root, run the script below. It is long because two whole blocks move; every anchor is count-checked.

```bash
python3 - <<'PYEOF'
import sys
def subn(path, old, new, n, tag):
    s = open(path).read()
    if s.count(old) != n: sys.exit("anchor fail: %s (count %d, wanted %d)" % (tag, s.count(old), n))
    open(path, 'w').write(s.replace(old, new))

P = 'src/game/gravitydebris/phys.js'
D = 'src/game/gravitydebris/draw.js'
J = 'src/game/GravityDebris.jsx'

subn(P, '''        const gInfo = [];
        for (const [root, ids] of groups) {''',
        '''        const gInfo = [];
        let _st = 0;
        for (const [root, ids] of groups) {
          _st += ids.length; if (_st >= 800) { _st = 0; yield; } // THE SPREAD TAIL: the group bookkeeping rests between frames too — gInfo is local and the sky stands still''', 1, 'tail:phys')

OLD_PRED = '''function predictShip(world, vx0, vz0, n) {
  const st = world.shipTrack; if (!st) return null;
  const simP = (world.tracks || []).filter(tk => tk.m >= 500 && tk.clump !== st.clump).slice(0, 14)
    .map(tk => ({ x: tk.x, z: tk.z, vx: tk.vx, vz: tk.vz, m: tk.m, rad: tk.rad, fam: tk.fam }));
  const statics = [];
  if (world.hole) statics.push({ x: world.hole.x, z: world.hole.z, m: world.hole.m, rad: world.hole.killR });
  if (world.star) statics.push({ x: world.star.x, z: world.star.z, m: world.star.m, rad: world.star.r });
  if (world.starBodies) for (const sb of world.starBodies) statics.push({ x: sb.x, z: sb.z, vx: sb.vx, vz: sb.vz, m: sb.m, rad: sb.r, fam: sb.fam, pin: sb.pin });
  const gate = world.gate;
  const gateGrav = gate ? [{ x: gate.x, z: gate.z, m: 2500, rad: 0 }] : [];
  let x = st.x, z = st.z, vx = vx0, vz = vz0;
  const pts = []; let minGate = Infinity, minGateIdx = 0;
  let anchor = null; for (const p of simP) if (!anchor || p.m > anchor.m) anchor = p;
  let swept = 0, prevAng = anchor ? Math.atan2(z - anchor.z, x - anchor.x) : 0;
  for (let i = 0; i < n; i++) {'''

NEW_PRED = '''// the predictor, carved in two: Start snapshots the sky and the ship, Step
// advances up to a budget of iterations and may be called across frames —
// the whole-run wrapper below answers byte for byte as the old predictShip.
function predictShipStart(world, vx0, vz0) {
  const st = world.shipTrack; if (!st) return null;
  const simP = (world.tracks || []).filter(tk => tk.m >= 500 && tk.clump !== st.clump).slice(0, 14)
    .map(tk => ({ x: tk.x, z: tk.z, vx: tk.vx, vz: tk.vz, m: tk.m, rad: tk.rad, fam: tk.fam }));
  const statics = [];
  if (world.hole) statics.push({ x: world.hole.x, z: world.hole.z, m: world.hole.m, rad: world.hole.killR });
  if (world.star) statics.push({ x: world.star.x, z: world.star.z, m: world.star.m, rad: world.star.r });
  if (world.starBodies) for (const sb of world.starBodies) statics.push({ x: sb.x, z: sb.z, vx: sb.vx, vz: sb.vz, m: sb.m, rad: sb.r, fam: sb.fam, pin: sb.pin });
  const gate = world.gate;
  const gateGrav = gate ? [{ x: gate.x, z: gate.z, m: 2500, rad: 0 }] : [];
  let anchor = null; for (const p of simP) if (!anchor || p.m > anchor.m) anchor = p;
  return { world, simP, statics, gate, gateGrav, anchor, x: st.x, z: st.z, vx: vx0, vz: vz0,
    pts: [], minGate: Infinity, minGateIdx: 0, swept: 0,
    prevAng: anchor ? Math.atan2(st.z - anchor.z, st.x - anchor.x) : 0, done: false };
}
function predictShipStep(S, budget, nMax) {
  if (!S || S.done) return true;
  const world = S.world, simP = S.simP, statics = S.statics, gate = S.gate, gateGrav = S.gateGrav, anchor = S.anchor, pts = S.pts;
  let x = S.x, z = S.z, vx = S.vx, vz = S.vz, minGate = S.minGate, minGateIdx = S.minGateIdx, swept = S.swept, prevAng = S.prevAng;
  for (let b = 0; b < budget && pts.length < nMax; b++) {'''

subn(P, OLD_PRED, NEW_PRED, 1, 'predhead:phys')

subn(P, '''    if (hit) { pts.push({ x, z, hit: true, danger, hitsGate: hg }); break; }
    pts.push({ x, z, danger, hitsGate: hg });
    if (hg) break;
  }
  return { pts, minGate, minGateIdx, orbit: Math.abs(swept) >= Math.PI * 2 };
}''',
        '''    if (hit) { pts.push({ x, z, hit: true, danger, hitsGate: hg }); S.done = true; break; }
    pts.push({ x, z, danger, hitsGate: hg });
    if (hg) { S.done = true; break; }
  }
  if (pts.length >= nMax) S.done = true;
  S.x = x; S.z = z; S.vx = vx; S.vz = vz; S.minGate = minGate; S.minGateIdx = minGateIdx; S.swept = swept; S.prevAng = prevAng;
  return S.done;
}
function predictShip(world, vx0, vz0, n) {
  const S = predictShipStart(world, vx0, vz0); if (!S) return null;
  predictShipStep(S, n, n);
  return { pts: S.pts, minGate: S.minGate, minGateIdx: S.minGateIdx, orbit: Math.abs(S.swept) >= Math.PI * 2 };
}''', 1, 'predtail:phys')

subn(P, 'stepWorld, stepSlice, predictShip, shipConn };',
        'stepWorld, stepSlice, predictShip, predictShipStart, predictShipStep, shipConn };', 1, 'export:phys')

subn(D, 'import { SF, G, BS, C30, S30, predictShip } from "./phys.js";',
        'import { SF, G, BS, C30, S30, predictShip, predictShipStart, predictShipStep } from "./phys.js";', 1, 'import:draw')

OLD_GHOSTS = '''      // the aimed burn's TRUTHFUL ghost: the ark's own predictor, blue while
      // clear, red through danger, a green dot where it threads the gate
      if (world.ship && world.shipAim && world.shipAim.on && world.shipTrack) {
        const st = world.shipTrack;
        const kx = st.vx + world.shipAim.vx, kz = st.vz + world.shipAim.vz;
        let pr; const gA = world._ghostA; // the remembered aim ghost
        if (gA && frame - gA.f0 < 6 && Math.abs(gA.kx - kx) < 0.01 && Math.abs(gA.kz - kz) < 0.01) pr = gA.pr;
        else { pr = predictShip(world, kx, kz, 2400); world._ghostA = { f0: frame, kx, kz, pr }; } // forty simulated seconds, re-simulated only when the aim moves or the memory ages six frames
        if (pr && pr.pts.length > 3) {
          ctx.lineWidth = 2.2;
          for (let i2 = 3; i2 < pr.pts.length; i2 += 3) {
            const q = pr.pts[i2], q0 = pr.pts[i2 - 3];
            const p0 = iso(q0.x, q0.z, 0), p1 = iso(q.x, q.z, 0);
            p0.y += getD(q0.x, q0.z); p1.y += getD(q.x, q.z); // the line hugs the surface the ship rides
            const fade = Math.max(0.25, 1 - i2 / pr.pts.length);
            ctx.strokeStyle = q.danger > 0.3 ? `rgba(220,55,35,${fade})` : `rgba(60,130,220,${fade * 0.9})`;
            ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
          }
          const last = pr.pts[pr.pts.length - 1];
          if (last.hitsGate) { const p = iso(last.x, last.z, 0); ctx.fillStyle = "rgba(40,170,90,.9)"; ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, Math.PI * 2); ctx.fill(); }
        }
      }
      // the flight ghost: the same forty-second predictor on the ship's own
      // velocity, no burn added, so the flown path reads as far as the aimed
      // one. It replaces the two-second clump tick for the flying ship.
      if (world.ship && world.shipPhase === "fly" && !world.shipDead && world.shipTrack && !(world.shipAim && world.shipAim.on)) {
        const st = world.shipTrack;
        let pr; const gF = world._ghostF; // the remembered flight ghost: between physics steps the velocity holds still, so the memory serves every frame of the gap
        if (gF && frame - gF.f0 < 6 && Math.abs(gF.kx - st.vx) < 0.01 && Math.abs(gF.kz - st.vz) < 0.01) pr = gF.pr;
        else { pr = predictShip(world, st.vx, st.vz, 2400); world._ghostF = { f0: frame, kx: st.vx, kz: st.vz, pr }; }
        if (pr && pr.pts.length > 3) {
          ctx.lineWidth = 2.2;
          for (let i2 = 3; i2 < pr.pts.length; i2 += 3) {
            const q = pr.pts[i2], q0 = pr.pts[i2 - 3];
            const p0 = iso(q0.x, q0.z, 0), p1 = iso(q.x, q.z, 0);
            p0.y += getD(q0.x, q0.z); p1.y += getD(q.x, q.z); // the line hugs the surface the ship rides
            const fade = Math.max(0.25, 1 - i2 / pr.pts.length);
            ctx.strokeStyle = q.danger > 0.3 ? `rgba(220,55,35,${fade})` : `rgba(60,130,220,${fade * 0.9})`;
            ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
          }
          const last = pr.pts[pr.pts.length - 1];
          if (last.hitsGate) { const p = iso(last.x, last.z, 0); ctx.fillStyle = "rgba(40,170,90,.9)"; ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, Math.PI * 2); ctx.fill(); }
        }
      }'''

NEW_GHOSTS = '''      // THE CERTAIN LINE AND THE CONE: three predictions ride together — the
      // aim's own path and two brackets tilted a hair either side. While the
      // brackets hug, the path draws as the known line; where they first
      // spread past the cut, certainty ends and the fan between them draws as
      // the cone — short and wide near chaos, long and narrow over calm
      // ground. All three build on a budget of steps per frame, so no frame
      // stalls; the picture fills in and refreshes about twice a second.
      // Tilt .015, cut 24, budget 300 steps per path per frame, refresh 30
      // frames — design choices, not measured numbers.
      const ghostRun = (slot, kx, kz) => {
        let g = world[slot];
        if (!g || Math.abs(g.kx - kx) > 0.01 || Math.abs(g.kz - kz) > 0.01 || (g.done && frame - g.f0 > 30)) {
          const co2 = Math.cos(0.015), si2 = Math.sin(0.015);
          g = { kx, kz, f0: frame, done: false,
            C: predictShipStart(world, kx, kz),
            L: predictShipStart(world, kx * co2 - kz * si2, kx * si2 + kz * co2),
            R: predictShipStart(world, kx * co2 + kz * si2, -kx * si2 + kz * co2) };
          world[slot] = g;
        }
        if (g.C && !g.done) {
          const dC = predictShipStep(g.C, 300, 2400), dL = predictShipStep(g.L, 300, 2400), dR = predictShipStep(g.R, 300, 2400);
          if (dC && dL && dR) { g.done = true; g.f0 = frame; }
        }
        return g.C ? g : null;
      };
      const ghostDraw = (g) => {
        const pts = g.C.pts; if (pts.length < 4) return;
        const bl = Math.min(pts.length, g.L.pts.length, g.R.pts.length);
        let kCut = bl; // certainty ends where the brackets first spread past the cut
        for (let i2 = 0; i2 < bl; i2++) { const lp = g.L.pts[i2], rp = g.R.pts[i2]; const dx2 = lp.x - rp.x, dz2 = lp.z - rp.z; if (dx2 * dx2 + dz2 * dz2 > 24 * 24) { kCut = i2; break; } }
        ctx.lineWidth = 2.2;
        for (let i2 = 3; i2 < Math.min(kCut + 3, pts.length); i2 += 3) {
          const q = pts[i2], q0 = pts[i2 - 3];
          const p0 = iso(q0.x, q0.z, 0), p1 = iso(q.x, q.z, 0);
          p0.y += getD(q0.x, q0.z); p1.y += getD(q.x, q.z); // the line hugs the surface the ship rides
          const fade = Math.max(0.25, 1 - i2 / pts.length);
          ctx.strokeStyle = q.danger > 0.3 ? `rgba(220,55,35,${fade})` : `rgba(60,130,220,${fade * 0.9})`;
          ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
        }
        if (kCut < bl - 3) {
          ctx.beginPath();
          let started = false;
          for (let i2 = kCut; i2 < g.L.pts.length; i2 += 3) { const q = g.L.pts[i2]; const p = iso(q.x, q.z, 0); p.y += getD(q.x, q.z); if (!started) { ctx.moveTo(p.x, p.y); started = true; } else ctx.lineTo(p.x, p.y); }
          for (let i2 = g.R.pts.length - 1; i2 >= kCut; i2 -= 3) { const q = g.R.pts[i2]; const p = iso(q.x, q.z, 0); p.y += getD(q.x, q.z); ctx.lineTo(p.x, p.y); }
          ctx.closePath();
          ctx.fillStyle = "rgba(60,130,220,.10)"; ctx.fill();
          ctx.strokeStyle = "rgba(60,130,220,.3)"; ctx.lineWidth = 1; ctx.stroke();
        }
        const last = pts[pts.length - 1];
        if (last.hitsGate) { const p = iso(last.x, last.z, 0); ctx.fillStyle = "rgba(40,170,90,.9)"; ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, Math.PI * 2); ctx.fill(); }
      };
      // the aimed burn's ghost: the certain line and the cone on the aim's velocity
      if (world.ship && world.shipAim && world.shipAim.on && world.shipTrack) {
        const st = world.shipTrack;
        const g = ghostRun("_ghostA", st.vx + world.shipAim.vx, st.vz + world.shipAim.vz);
        if (g) ghostDraw(g);
      }
      // the flight ghost: the same machinery on the ship's own velocity, no burn added
      if (world.ship && world.shipPhase === "fly" && !world.shipDead && world.shipTrack && !(world.shipAim && world.shipAim.on)) {
        const st = world.shipTrack;
        const g = ghostRun("_ghostF", st.vx, st.vz);
        if (g) ghostDraw(g);
      }'''

subn(D, OLD_GHOSTS, NEW_GHOSTS, 1, 'ghosts:draw')

subn(J, 'if (world._chunks == null) world._chunks = 14;',
        'if (world._chunks == null) world._chunks = 17;', 1, 'init:jsx')
subn(J, 'if (fIn === 0 && world._chunks >= 14) {',
        'if (fIn === 0 && world._chunks >= 17) {', 1, 'window:jsx')
subn(J, '''        if (world._chunks < 14) {
          const want = Math.min(14, Math.ceil((fIn + 1) * 14 / stepN));''',
        '''        if (world._chunks < 17) {
          const want = Math.min(17, Math.ceil((fIn + 1) * 17 / stepN));''', 1, 'want:jsx')
subn(J, 'if (done) { world._chunks = 14; world._shiftPending = true;',
        'if (done) { world._chunks = 17; world._shiftPending = true;', 1, 'done:jsx')
subn(J, 'if (world._chunks < 14) world._stepAcc += performance.now() - tPhys;',
        'if (world._chunks < 17) world._stepAcc += performance.now() - tPhys;', 1, 'acc:jsx')
print("all substitutions in")
PYEOF
```

Expected output, exact: `all substitutions in`. Then `node --check src/game/gravitydebris/phys.js` and `node --check src/game/gravitydebris/draw.js` each print nothing, and `node_modules/.bin/esbuild --loader:.jsx=jsx src/game/GravityDebris.jsx --outfile=/dev/null --log-level=error` prints nothing.

**2. The battery.** Build `/tmp/battery90.mjs` from T84's battery block (in `docs/superpowers/plans/2026-10-05-t84-the-shield-walls.md` step 3) with two probes added, then run it ONCE: `node /tmp/battery90.mjs /home/batman/coldsnap`. The probes: immediately BEFORE the battery's existing line `DD.drawFrame({ ctx: stub(), W: 900, H: 600, world: w, frame: w.frame, time: 0.5 });` insert exactly:

```js
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
```

Acceptance, exact — every line. The two evolution hashes and the predictor probe are the untouched tree's own numbers (the probe computed on a fresh untouched copy at plan-writing: `ad9c5d7ef5b11d5f pts 273`), proving the physics never moved and the carved predictor answers byte for byte; the cone probe is the new machinery's own pinned number:

```
rubble system at 5s 582386c0cb544735 alive 171/171
shields at birth: cells 72 | powered 36 | up 36 | preset SPREAD
launched: hull and walls together 41
debris map at 5s 389f479192501c35 alive 1829/2239 | eaten 533
holes punched: 3
after 2.6s on the wall clock: holes 1
after 5.4s: holes 0
preset FORE: fore 18 | aft 0 | left 9 | right 9 | up 36
predictor probe ad9c5d7ef5b11d5f pts 273 | orbit false
cone probe: built 600 | done false
debris frames drawn light+dark | NaN false
STRUCTURE HELD
```

**3. Version and build.** `MK = "0.5.85"` in `src/version.js`, then `npm run build`.

**4. The server, then the gate.** `npm run preview >/tmp/preview90.log 2>&1 &` — prove `SERVER UP` with `curl -sf --retry 20 --retry-delay 1 --retry-all-errors http://localhost:4173/coldsnap/ -o /dev/null && echo SERVER UP` — then `node scripts/gate.mjs smoke`: banner `boot-load smoke 0.5.85`, 23 PASS, 0 FAIL, one run; past the tool window, read the tail of `.superpowers/gates.log`, never a second run. Then `pkill -f "[v]ite preview"` as its own command. A failed gate still stops the server, then stops the task.

**5. Land.** Commit `src/game/gravitydebris/phys.js`, `src/game/gravitydebris/draw.js`, `src/game/GravityDebris.jsx`, `src/version.js` only (subject `the certain line and the cone, 0.5.85`), push. Phase row T90 — "The certain line and the cone: the scan tail spreads, and the ghost becomes a known line ending in a cone of real divergence" — LANDED (mark 0.5.85, hashes unchanged, predictor byte-identical, the smoke count); commit with this plan file, push. The live check is the acceptance, phone and desktop: no scan-frame stutter, the known line ending in a cone that flares near the triad and hugs over calm ground, and the aim and release feeling unchanged.

## Report

- One line of outcome, then bullets.
- Read-confirmation first.
- The battery's printed lines, verbatim; the smoke count exactly.
- Both hashes unchanged and the predictor probe's match as their own labeled bullets.
- Fixture seed: 12345.
- Both commit hashes.
- Every deviation its own labeled bullet.
