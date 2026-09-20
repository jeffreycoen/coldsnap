# T79: the slingshot disks (0.5.74)

Every star and planet in Rubble Worlds gets a filled translucent green disk under it, showing where its pull is strong enough to swing the ship. The disk's edge sits where the body's pull falls to a chosen strength, so the radius comes straight from mass: heavy bodies carry wide disks, light ones narrow. Drawing only — the physics is untouched, and the battery proves it with an unchanged evolution hash. One insertion, one file.

Design choices, stated plainly: the edge strength is 30 — a design choice, not a measured number; the owner's eye on the live site rules whether it moves. Bodies lighter than 500 mass (asteroids, comets, moons, triad members) carry no disk, the same cut the orbit lines already use. The ship's own hull carries no disk. The black hole carries no disk — stars and planets only. Fill green at 6% with an 18% edge line. Seed 12345 is the fixture.

The substitution script was applied to a fresh copy of the live tree at plan-writing time: the anchor hit exactly once, the file parses, and the acceptance below reproduced — the evolution hashes match the untouched tree exactly.

## Required reading

- This plan, whole.
- `src/game/rubbleworlds/draw.js` — the drawn frame; the insertion lands between the grid and the projected orbits.

## Suggested model

Sonnet. One pre-verified insertion in one file; no design remains.

## Steps

**1. The substitution.** From the repo root:

```bash
python3 - <<'PYEOF'
import sys
def subn(path, old, new, n, tag):
    s = open(path).read()
    if s.count(old) != n: sys.exit("anchor fail: %s (count %d, wanted %d)" % (tag, s.count(old), n))
    open(path, 'w').write(s.replace(old, new))
D='src/game/rubbleworlds/draw.js'

subn(D, """      // --- PROJECTED ORBITS: each clump's future as a line, green while clear,""",
     """      // --- SLINGSHOT ZONES: a filled translucent green disk under every star
      // and planet — its edge sits where the body's pull falls to the zone
      // strength, so heavy bodies carry wide disks and light ones narrow,
      // straight from mass. The zone strength 30 is a design choice, not a
      // measured number. The ship's own clump carries no disk.
      {
        const A_ZONE = 30;
        const zoneOff = (tk) => { const gi = world.groups && world.groups.get(tk.clump); if (!gi) return [0, 0]; const i0 = gi.find(i => wb[i].alive); if (i0 == null) return [0, 0]; const b0 = wb[i0]; return [lx(b0) - b0.x, lz(b0) - b0.z]; };
        const zones = [];
        const shipCl = world.ship && world.shipTrack ? world.shipTrack.clump : null;
        for (const tk of world.tracks || []) { if (tk.m < 500 || tk.clump === shipCl) continue; const [ox, oz] = zoneOff(tk); zones.push([tk.x + ox, tk.z + oz, tk.m]); }
        if (world.star) zones.push([world.star.x, world.star.z, world.star.m]);
        if (world.starBodies) for (const st of world.starBodies) zones.push([st.px == null ? st.x : st.px + (st.x - st.px) * L, st.pz == null ? st.z : st.pz + (st.z - st.pz) * L, st.m]);
        for (const [zx, zz, zm] of zones) {
          const zr = Math.pow(G * zm / A_ZONE, 1 / 2.3);
          ctx.beginPath();
          for (let a = 0; a <= 40; a++) { const th = a / 40 * Math.PI * 2; const p = iso(zx + Math.cos(th) * zr, zz + Math.sin(th) * zr, 0); if (a === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }
          ctx.closePath();
          ctx.fillStyle = "rgba(40,170,90,.06)"; ctx.fill();
          ctx.strokeStyle = "rgba(40,170,90,.18)"; ctx.lineWidth = 1.2; ctx.stroke();
        }
      }
      // --- PROJECTED ORBITS: each clump's future as a line, green while clear,""", 1, 'zones-in')
print("all substitutions in")
PYEOF
```

Expected output, exact: `all substitutions in`.

Then `node --check src/game/rubbleworlds/draw.js` prints nothing (a clean parse).

**2. The battery.** Save the block below as `/tmp/battery79.mjs` and run `node /tmp/battery79.mjs /home/batman/coldsnap` once:

```js
// THE ZONE BATTERY: seed 12345, two scenes — the sky builds, steps 5 simulated
// seconds, the drawn frame runs headless on a stub canvas, physics unchanged.
const dir = process.argv[2] || '.';
const {createHash} = await import('node:crypto');
const h = o => createHash('sha256').update(JSON.stringify(o)).digest('hex').slice(0,16);
const RG = await import(dir + '/src/game/rubbleworlds/gen.js');
const RP = await import(dir + '/src/game/rubbleworlds/phys.js');
const RD = await import(dir + '/src/game/rubbleworlds/draw.js');
const stub = () => new Proxy({}, { get: (t,p) => (p==='createRadialGradient'||p==='createLinearGradient') ? (()=>({addColorStop(){}})) : (()=>{}), set: () => true });
for (const kind of ['system','map']) {
  const w = RG.makeScenario(kind, 12345, 1);
  for (let s = 0; s < 300; s++) RP.stepWorld(w, {welds:true, sleep:true, hash:true, friction:true});
  console.log(kind + ' at 5s', h(w.blocks), 'alive ' + w.blocks.filter(b=>b.alive).length + '/' + w.blocks.length);
  RD.drawFrame({ ctx: stub(), W: 900, H: 600, world: w, frame: w.frame, time: 0.5 });
  const nan = w.blocks.some(b => b.alive && !isFinite(b.x));
  console.log(kind + ' frame drawn | NaN ' + nan);
}
console.log('STRUCTURE HELD');
```

Acceptance, exact — every line, and the two hashes are the untouched tree's own numbers, proving the physics never moved:

```
system at 5s 582386c0cb544735 alive 171/171
system frame drawn | NaN false
map at 5s 798818739f481d1d alive 1096/1102
map frame drawn | NaN false
STRUCTURE HELD
```

**3. Gate.** `node scripts/gate.mjs smoke` — 23 PASS, 0 FAIL, one run. If the tool moves it to the background past its two-minute window, wait and read the pass from the tail of `.superpowers/gates.log` — do not start a second run.

**4. Version and build.** `MK = "0.5.74"` in `src/version.js`, then `npm run build`.

**5. Land.** Commit `src/game/rubbleworlds/draw.js` and `src/version.js` only (subject `the slingshot disks, 0.5.74`), push. The phase document's table adds row T79 — "The slingshot disks: a green disk under every star and planet, edge at the zone strength" — LANDED (mark 0.5.74, evolution hashes unchanged, the smoke count); commit with this plan file, push. The live check is the acceptance, phone and desktop both.

## Report

- One line of outcome, then bullets.
- Read-confirmation first.
- The battery's printed lines, verbatim; the smoke count exactly.
- The unchanged evolution hashes as their own labeled bullet.
- Fixture seed: 12345; the module rolls fresh seeds at reset.
- Both commit hashes.
- Every deviation its own labeled bullet.
