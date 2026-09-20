# T80: the debris slingshot disks (0.5.75)

Gravity Debris gets the same slingshot disks Rubble Worlds got in T79: a filled translucent green disk under every star and planet, showing where its pull is strong enough to swing the ship. The disk's edge sits where the body's pull falls to the same chosen strength, so the radius comes straight from mass. Two things differ from T79, both carried in the code: every drawn thing on this screen sits sunk into the net, so each edge point of the disk adds the net depth and the disk lies in the dent its body made; and the between-step glide on this screen runs between the last two completed steps, so the star positions use that form. Drawing only — the physics is untouched, and the battery proves it with unchanged evolution hashes. One insertion, one file.

Design choices, stated plainly: the edge strength is 30, the same number as T79 — a design choice, not a measured number; the two screens share one gravity constant and the same masses, so the same strength gives the same disk sizes. Bodies lighter than 500 mass carry no disk, the same cut the orbit lines already use. The ship's own hull carries no disk. The black hole carries no disk. Fill green at 6% with an 18% edge line. Seed 12345 is the fixture.

The substitution script was applied to a fresh copy of the live tree at plan-writing time: the anchor hit exactly once, the file parses, and the acceptance below reproduced — the birth hash matches T78's pinned f36d2b880371b41c and the evolution hash matches the untouched tree exactly.

## Required reading

- This plan, whole.
- `src/game/gravitydebris/draw.js` — the drawn frame; the insertion lands between the grid and the projected orbits.

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
D='src/game/gravitydebris/draw.js'

subn(D, """      // --- PROJECTED ORBITS: each clump's future as a line, green while clear,""",
     """      // --- SLINGSHOT ZONES: a filled translucent green disk under every star
      // and planet — its edge sits where the body's pull falls to the zone
      // strength, so heavy bodies carry wide disks and light ones narrow,
      // straight from mass. The zone strength 30 is a design choice, not a
      // measured number. The ship's own clump carries no disk. Each edge
      // point rides the net at its own depth, so the disk lies in the dent
      // its body made.
      {
        const A_ZONE = 30;
        const zoneOff = (tk) => { const gi = world.groups && world.groups.get(tk.clump); if (!gi) return [0, 0]; const i0 = gi.find(i => wb[i].alive); if (i0 == null) return [0, 0]; const b0 = wb[i0]; return [lx(b0) - b0.x, lz(b0) - b0.z]; };
        const zones = [];
        const shipCl = world.ship && world.shipTrack ? world.shipTrack.clump : null;
        for (const tk of world.tracks || []) { if (tk.m < 500 || tk.clump === shipCl) continue; const [ox, oz] = zoneOff(tk); zones.push([tk.x + ox, tk.z + oz, tk.m]); }
        if (world.star) zones.push([world.star.x, world.star.z, world.star.m]);
        if (world.starBodies) for (const st of world.starBodies) zones.push([st.px == null ? st.x : st.px + ((st.qx == null ? st.x : st.qx) - st.px) * L, st.pz == null ? st.z : st.pz + ((st.qz == null ? st.z : st.qz) - st.pz) * L, st.m]);
        for (const [zx, zz, zm] of zones) {
          const zr = Math.pow(G * zm / A_ZONE, 1 / 2.3);
          ctx.beginPath();
          for (let a = 0; a <= 40; a++) { const th = a / 40 * Math.PI * 2; const ex = zx + Math.cos(th) * zr, ez = zz + Math.sin(th) * zr; const p = iso(ex, ez, 0); p.y += getD(ex, ez); if (a === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }
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

Then `node --check src/game/gravitydebris/draw.js` prints nothing (a clean parse).

**2. The battery.** Save the block below as `/tmp/battery80.mjs` and run `node /tmp/battery80.mjs /home/batman/coldsnap` once. The document shim exists because this screen's frame stamps its cubes into small stored canvases; the stub hands back inert ones.

```js
// THE ZONE BATTERY: seed 12345, the debris map — the sky builds, steps 5
// simulated seconds, the drawn frame runs headless on a stub canvas, physics unchanged.
const dir = process.argv[2] || '.';
const {createHash} = await import('node:crypto');
const h = o => createHash('sha256').update(JSON.stringify(o)).digest('hex').slice(0,16);
const DG = await import(dir + '/src/game/gravitydebris/gen.js');
const DP = await import(dir + '/src/game/gravitydebris/phys.js');
const DD = await import(dir + '/src/game/gravitydebris/draw.js');
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => stub() }) };
const stub = () => new Proxy({}, { get: (t,p) => (p==='createRadialGradient'||p==='createLinearGradient') ? (()=>({addColorStop(){}})) : (()=>{}), set: () => true });
const w = DG.makeScenario('map', 12345, 1);
console.log('map s1', h(w.blocks), 'blocks', w.blocks.length);
for (let s = 0; s < 300; s++) DP.stepWorld(w, {welds:true, sleep:true, hash:true, friction:true});
console.log('map at 5s', h(w.blocks), 'alive ' + w.blocks.filter(b=>b.alive).length + '/' + w.blocks.length + ' | eaten ' + w.eaten);
DD.drawFrame({ ctx: stub(), W: 900, H: 600, world: w, frame: w.frame, time: 0.5 });
const nan = w.blocks.some(b => b.alive && !isFinite(b.x));
console.log('map frame drawn | NaN ' + nan);
console.log(nan ? 'STRUCTURE BROKE' : 'STRUCTURE HELD');
```

Acceptance, exact — every line, and the two hashes are the untouched tree's own numbers, proving the physics never moved:

```
map s1 f36d2b880371b41c blocks 2167
map at 5s 30a0941f931b2e0c alive 1789/2167 | eaten 537
map frame drawn | NaN false
STRUCTURE HELD
```

**3. Gate.** `node scripts/gate.mjs smoke` — 23 PASS, 0 FAIL, one run. If the tool moves it to the background past its two-minute window, wait and read the pass from the tail of `.superpowers/gates.log` — do not start a second run.

**4. Version and build.** `MK = "0.5.75"` in `src/version.js`, then `npm run build`.

**5. Land.** Commit `src/game/gravitydebris/draw.js` and `src/version.js` only (subject `the debris slingshot disks, 0.5.75`), push. The phase document's table adds row T80 — "The debris slingshot disks: the T79 green disks on the debris screen, seated in the net's dents" — LANDED (mark 0.5.75, evolution hashes unchanged, the smoke count); commit with this plan file, push. The live check is the acceptance, phone and desktop both.

## Report

- One line of outcome, then bullets.
- Read-confirmation first.
- The battery's printed lines, verbatim; the smoke count exactly.
- The unchanged evolution hashes as their own labeled bullet.
- Fixture seed: 12345; the module rolls fresh seeds at reset.
- Both commit hashes.
- Every deviation its own labeled bullet.
