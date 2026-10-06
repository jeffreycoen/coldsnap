# T82: the fading disks (0.5.77)

The slingshot disks on both screens stop wearing one flat green and instead deepen with the pull felt on the ground they cover. The rim keeps its earned-kick edge from T81 and thins to a light wash; inside it, up to three nested rings each add a step of green, their edges sitting where the body's own pull under the softened law reaches a third, two thirds, and all of a fixed full-green strength. The same pull reads as the same green on every map, so a heavy body shows a wide bright country and a moon shows a faint disk with a small bright heart. On the debris map the great star's disk runs rim 288 with steps at 180, 133, and 112; a drifter runs rim 113 with steps at 113 (its whole disk already pulls past a third), 90, and 75; a moon runs rim 44 with steps at 25, 18, and 14. Drawing only — the physics is untouched, and the battery proves it with unchanged evolution hashes on both screens. Seven substitutions per file, two files, one commit.

Design choices, stated plainly: the full-green strength 400 and the three steps are design choices, not measured numbers; so are the fills — the rim wash at .03 (half the old flat .06), each step adding .06, so the deepest ground reads near .20 against the old .06, still under the grid's well lines and far under the trajectory lines. The rim stroke stays .18 and the hue is unchanged. The ring law reads the body's pull as its strength at that distance under the softened law, the same shape the net and the disks already draw from. Each ring is a drawn disk stacked on the ones below, so the steps build the fade without new path kinds; the debris screen's rings ride the net's dent point by point as the rim already does, and the rubble screen's stay on its one plane. The zone list carries each body's mass again beside its radius — T81 removed it from the tuple; the fade needs it back for the ring radii. Bodies lighter than 500 mass still carry no disk, the ship's own clump carries none, and the black hole carries none.

The substitution script was applied to a fresh copy of the live tree at plan-writing time: every anchor hit exactly once in its file, both files parse, and the acceptance below reproduced — both evolution hashes match the untouched tree exactly.

## Required reading

- This plan, whole.
- `src/game/rubbleworlds/draw.js` — the slingshot-zones block landed by T81.
- `src/game/gravitydebris/draw.js` — the slingshot-zones block landed by T81.

## Suggested model

Sonnet. Pre-verified substitutions in two files; no design remains.

## Steps

**1. The substitutions.** From the repo root:

```bash
python3 - <<'PYEOF'
import sys
def subn(path, old, new, n, tag):
    s = open(path).read()
    if s.count(old) != n: sys.exit("anchor fail: %s (count %d, wanted %d)" % (tag, s.count(old), n))
    open(path, 'w').write(s.replace(old, new))

R = 'src/game/rubbleworlds/draw.js'
D = 'src/game/gravitydebris/draw.js'

COMMENT_NEW_HEAD = """      // --- SLINGSHOT ZONES: a green disk under every star and planet — its
      // edge sits where a dive to a close pass has already paid nine tenths of
      // the body's whole kick. Inside, the green deepens in steps with the pull
      // felt on that ground: each inner ring's edge sits where the body's own
      // pull reaches a third, two thirds, then all of the full-green strength,
      // so the same pull reads as the same green on every map. The nine tenths,
      // the full-green strength, and the step alphas are design choices, not
      // measured numbers. The ship's own clump carries no disk."""

subn(R, """      // --- SLINGSHOT ZONES: a filled translucent green disk under every star
      // and planet — its edge sits where a dive to a close pass has already
      // paid nine tenths of the body's whole kick, so the disk covers only
      // the ground where real speed is gained. The nine tenths is a design
      // choice, not a measured number. The ship's own clump carries no disk.""",
     COMMENT_NEW_HEAD, 1, 'comment:rubble')

subn(D, """      // --- SLINGSHOT ZONES: a filled translucent green disk under every star
      // and planet — its edge sits where a dive to a close pass has already
      // paid nine tenths of the body's whole kick, so the disk covers only
      // the ground where real speed is gained. The nine tenths is a design
      // choice, not a measured number. The ship's own clump carries no disk. Each edge""",
     COMMENT_NEW_HEAD + " Each edge", 1, 'comment:debris')

for F in [R, D]:
    subn(F, "const KZ = Math.pow(1 - 0.9 * 0.9, -1 / 0.65); // the well shape's own exponent turns the nine-tenths promise into a radius",
            "const KZ = Math.pow(1 - 0.9 * 0.9, -1 / 0.65); // the well shape's own exponent turns the nine-tenths promise into a radius\n        const P_FULL = 400, NSTEP = 3; // full green at pull 400, reached in three steps — design choices, not measured numbers", 1, 'const:' + F)
    subn(F, "zones.push([tk.x + ox, tk.z + oz, tk.rad]); }",
            "zones.push([tk.x + ox, tk.z + oz, tk.rad, tk.m]); }", 1, 'tracks:' + F)
    subn(F, "if (world.star) zones.push([world.star.x, world.star.z, world.star.r]);",
            "if (world.star) zones.push([world.star.x, world.star.z, world.star.r, world.star.m]);", 1, 'star:' + F)

subn(R, "zones.push([st.px == null ? st.x : st.px + (st.x - st.px) * L, st.pz == null ? st.z : st.pz + (st.z - st.pz) * L, st.r]);",
        "zones.push([st.px == null ? st.x : st.px + (st.x - st.px) * L, st.pz == null ? st.z : st.pz + (st.z - st.pz) * L, st.r, st.m]);", 1, 'starBodies:rubble')
subn(D, "zones.push([st.px == null ? st.x : st.px + ((st.qx == null ? st.x : st.qx) - st.px) * L, st.pz == null ? st.z : st.pz + ((st.qz == null ? st.z : st.qz) - st.pz) * L, st.r]);",
        "zones.push([st.px == null ? st.x : st.px + ((st.qx == null ? st.x : st.qx) - st.px) * L, st.pz == null ? st.z : st.pz + ((st.qz == null ? st.z : st.qz) - st.pz) * L, st.r, st.m]);", 1, 'starBodies:debris')

subn(R, """        for (const [zx, zz, zrad] of zones) {
          const zr = Math.sqrt((zrad * zrad + SF * SF) * KZ - SF * SF);
          ctx.beginPath();
          for (let a = 0; a <= 40; a++) { const th = a / 40 * Math.PI * 2; const p = iso(zx + Math.cos(th) * zr, zz + Math.sin(th) * zr, 0); if (a === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }
          ctx.closePath();
          ctx.fillStyle = "rgba(40,170,90,.06)"; ctx.fill();
          ctx.strokeStyle = "rgba(40,170,90,.18)"; ctx.lineWidth = 1.2; ctx.stroke();
        }""",
     """        for (const [zx, zz, zrad, zm] of zones) {
          const zr = Math.sqrt((zrad * zrad + SF * SF) * KZ - SF * SF);
          const ring = (rr, fa) => {
            ctx.beginPath();
            for (let a = 0; a <= 40; a++) { const th = a / 40 * Math.PI * 2; const p = iso(zx + Math.cos(th) * rr, zz + Math.sin(th) * rr, 0); if (a === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }
            ctx.closePath(); ctx.fillStyle = `rgba(40,170,90,${fa})`; ctx.fill();
          };
          ring(zr, 0.03);
          ctx.strokeStyle = "rgba(40,170,90,.18)"; ctx.lineWidth = 1.2; ctx.stroke();
          for (let k = 1; k <= NSTEP; k++) {
            const rk2 = Math.pow(G * zm / (P_FULL * k / NSTEP), 1 / 1.15) - SF * SF;
            if (rk2 <= 0) break;
            ring(Math.min(Math.sqrt(rk2), zr), 0.06);
          }
        }""", 1, 'law:rubble')

subn(D, """        for (const [zx, zz, zrad] of zones) {
          const zr = Math.sqrt((zrad * zrad + SF * SF) * KZ - SF * SF);
          ctx.beginPath();
          for (let a = 0; a <= 40; a++) { const th = a / 40 * Math.PI * 2; const ex = zx + Math.cos(th) * zr, ez = zz + Math.sin(th) * zr; const p = iso(ex, ez, 0); p.y += getD(ex, ez); if (a === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }
          ctx.closePath();
          ctx.fillStyle = "rgba(40,170,90,.06)"; ctx.fill();
          ctx.strokeStyle = "rgba(40,170,90,.18)"; ctx.lineWidth = 1.2; ctx.stroke();
        }""",
     """        for (const [zx, zz, zrad, zm] of zones) {
          const zr = Math.sqrt((zrad * zrad + SF * SF) * KZ - SF * SF);
          const ring = (rr, fa) => {
            ctx.beginPath();
            for (let a = 0; a <= 40; a++) { const th = a / 40 * Math.PI * 2; const ex = zx + Math.cos(th) * rr, ez = zz + Math.sin(th) * rr; const p = iso(ex, ez, 0); p.y += getD(ex, ez); if (a === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }
            ctx.closePath(); ctx.fillStyle = `rgba(40,170,90,${fa})`; ctx.fill();
          };
          ring(zr, 0.03);
          ctx.strokeStyle = "rgba(40,170,90,.18)"; ctx.lineWidth = 1.2; ctx.stroke();
          for (let k = 1; k <= NSTEP; k++) {
            const rk2 = Math.pow(G * zm / (P_FULL * k / NSTEP), 1 / 1.15) - SF * SF;
            if (rk2 <= 0) break;
            ring(Math.min(Math.sqrt(rk2), zr), 0.06);
          }
        }""", 1, 'law:debris')
print("all substitutions in")
PYEOF
```

Expected output, exact: `all substitutions in`.

Then `node --check src/game/rubbleworlds/draw.js` and `node --check src/game/gravitydebris/draw.js` each print nothing (clean parses).

**2. The battery.** Save the block below as `/tmp/battery82.mjs` and run `node /tmp/battery82.mjs /home/batman/coldsnap` once. The document shim exists because the debris frame stamps its cubes into small stored canvases; the stub hands back inert ones.

```js
// THE ZONE BATTERY: seed 12345, both screens — skies build, step 5 simulated
// seconds, the drawn frames run headless on stub canvases, physics unchanged.
const dir = process.argv[2] || '.';
const {createHash} = await import('node:crypto');
const h = o => createHash('sha256').update(JSON.stringify(o)).digest('hex').slice(0,16);
const stub = () => new Proxy({}, { get: (t,p) => (p==='createRadialGradient'||p==='createLinearGradient') ? (()=>({addColorStop(){}})) : (()=>{}), set: () => true });
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => stub() }) };
{
  const RG = await import(dir + '/src/game/rubbleworlds/gen.js');
  const RP = await import(dir + '/src/game/rubbleworlds/phys.js');
  const RD = await import(dir + '/src/game/rubbleworlds/draw.js');
  const w = RG.makeScenario('system', 12345, 1);
  for (let s = 0; s < 300; s++) RP.stepWorld(w, {welds:true, sleep:true, hash:true, friction:true});
  console.log('rubble system at 5s', h(w.blocks), 'alive ' + w.blocks.filter(b=>b.alive).length + '/' + w.blocks.length);
  RD.drawFrame({ ctx: stub(), W: 900, H: 600, world: w, frame: w.frame, time: 0.5 });
  console.log('rubble frame drawn | NaN ' + w.blocks.some(b => b.alive && !isFinite(b.x)));
}
{
  const DG = await import(dir + '/src/game/gravitydebris/gen.js');
  const DP = await import(dir + '/src/game/gravitydebris/phys.js');
  const DD = await import(dir + '/src/game/gravitydebris/draw.js');
  const w = DG.makeScenario('map', 12345, 1);
  for (let s = 0; s < 300; s++) DP.stepWorld(w, {welds:true, sleep:true, hash:true, friction:true});
  console.log('debris map at 5s', h(w.blocks), 'alive ' + w.blocks.filter(b=>b.alive).length + '/' + w.blocks.length + ' | eaten ' + w.eaten);
  DD.drawFrame({ ctx: stub(), W: 900, H: 600, world: w, frame: w.frame, time: 0.5 });
  console.log('debris frame drawn | NaN ' + w.blocks.some(b => b.alive && !isFinite(b.x)));
}
console.log('STRUCTURE HELD');
```

Acceptance, exact — every line, and both hashes are the untouched tree's own numbers, proving the physics never moved:

```
rubble system at 5s 582386c0cb544735 alive 171/171
rubble frame drawn | NaN false
debris map at 5s 30a0941f931b2e0c alive 1789/2167 | eaten 537
debris frame drawn | NaN false
STRUCTURE HELD
```

**3. Gate.** `node scripts/gate.mjs smoke` — 23 PASS, 0 FAIL, one run. If the tool moves it to the background past its two-minute window, wait and read the pass from the tail of `.superpowers/gates.log` — do not start a second run.

**4. Version and build.** `MK = "0.5.77"` in `src/version.js`, then `npm run build`.

**5. Land.** Commit `src/game/rubbleworlds/draw.js`, `src/game/gravitydebris/draw.js`, and `src/version.js` only (subject `the fading disks, 0.5.77`), push. The phase document's table adds row T82 — "The fading disks: both screens' disks deepen in steps with the pull felt on their ground" — LANDED (mark 0.5.77, evolution hashes unchanged, the smoke count); commit with this plan file, push. The live check is the acceptance, phone and desktop both.

## Report

- One line of outcome, then bullets.
- Read-confirmation first.
- The battery's printed lines, verbatim; the smoke count exactly.
- The unchanged evolution hashes as their own labeled bullet.
- Fixture seed: 12345; the module rolls fresh seeds at reset.
- Both commit hashes.
- Every deviation its own labeled bullet.
