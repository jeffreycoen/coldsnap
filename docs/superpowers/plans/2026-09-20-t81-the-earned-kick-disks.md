# T81: the earned-kick disks (0.5.76)

The slingshot disks on both screens tighten to cover only the ground where real speed is gained. The old edge sat where the pull reached a set strength, which painted a wide fringe where a pass gains almost nothing. The new edge sits where a dive from the edge to a close pass has already paid nine tenths of the body's whole kick. The disks shrink: the standard planet's disk goes from about 102 to about 67, the debris map's great star from about 233 to about 151, and inside any disk the dive pays at least 115 speed against burns that run 50 at birth and cap at 110. Drawing only — the physics is untouched, and the battery proves it with unchanged evolution hashes on both screens. Six small substitutions per file, two files, one commit.

Design choices, stated plainly: the nine tenths is a design choice, not a measured number; the owner's eye on the live site rules whether it moves. A flat gained-speed edge was computed and rejected at plan-writing time: these wells pay almost the whole kick in the last stretch of the dive, so any single speed number gives all-or-nothing disks — a hairline at low numbers, erased light planets at high ones. The fraction law holds its shape at every mass. Under it the disk's radius follows the body's physical size, not its mass; the existing cut — bodies lighter than 500 mass carry no disk — still removes the trivia, and the ship's own hull and the black hole still carry none. Fill and edge colors are unchanged. Seed 12345 is the fixture.

The substitution script was applied to a fresh copy of the live tree at plan-writing time: every anchor hit exactly once in each file, both files parse, and the acceptance below reproduced — both evolution hashes match the untouched tree exactly.

## Required reading

- This plan, whole.
- `src/game/rubbleworlds/draw.js` — the slingshot-zones block landed by T79.
- `src/game/gravitydebris/draw.js` — the slingshot-zones block landed by T80.

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

for D, star_old, star_new in [
  ('src/game/rubbleworlds/draw.js',
   'zones.push([st.px == null ? st.x : st.px + (st.x - st.px) * L, st.pz == null ? st.z : st.pz + (st.z - st.pz) * L, st.m]);',
   'zones.push([st.px == null ? st.x : st.px + (st.x - st.px) * L, st.pz == null ? st.z : st.pz + (st.z - st.pz) * L, st.r]);'),
  ('src/game/gravitydebris/draw.js',
   'zones.push([st.px == null ? st.x : st.px + ((st.qx == null ? st.x : st.qx) - st.px) * L, st.pz == null ? st.z : st.pz + ((st.qz == null ? st.z : st.qz) - st.pz) * L, st.m]);',
   'zones.push([st.px == null ? st.x : st.px + ((st.qx == null ? st.x : st.qx) - st.px) * L, st.pz == null ? st.z : st.pz + ((st.qz == null ? st.z : st.qz) - st.pz) * L, st.r]);'),
]:
    subn(D, """      // and planet — its edge sits where the body's pull falls to the zone
      // strength, so heavy bodies carry wide disks and light ones narrow,
      // straight from mass. The zone strength 30 is a design choice, not a
      // measured number.""",
         """      // and planet — its edge sits where a dive to a close pass has already
      // paid nine tenths of the body's whole kick, so the disk covers only
      // the ground where real speed is gained. The nine tenths is a design
      // choice, not a measured number.""", 1, 'comment:'+D)
    subn(D, "        const A_ZONE = 30;",
            "        const KZ = Math.pow(1 - 0.9 * 0.9, -1 / 0.65); // the well shape's own exponent turns the nine-tenths promise into a radius", 1, 'const:'+D)
    subn(D, "zones.push([tk.x + ox, tk.z + oz, tk.m]); }",
            "zones.push([tk.x + ox, tk.z + oz, tk.rad]); }", 1, 'tracks:'+D)
    subn(D, "if (world.star) zones.push([world.star.x, world.star.z, world.star.m]);",
            "if (world.star) zones.push([world.star.x, world.star.z, world.star.r]);", 1, 'star:'+D)
    subn(D, star_old, star_new, 1, 'starBodies:'+D)
    subn(D, """        for (const [zx, zz, zm] of zones) {
          const zr = Math.pow(G * zm / A_ZONE, 1 / 2.3);""",
         """        for (const [zx, zz, zrad] of zones) {
          const zr = Math.sqrt((zrad * zrad + SF * SF) * KZ - SF * SF);""", 1, 'law:'+D)
print("all substitutions in")
PYEOF
```

Expected output, exact: `all substitutions in`.

Then `node --check src/game/rubbleworlds/draw.js` and `node --check src/game/gravitydebris/draw.js` each print nothing (clean parses).

**2. The battery.** Save the block below as `/tmp/battery81.mjs` and run `node /tmp/battery81.mjs /home/batman/coldsnap` once. The document shim exists because the debris frame stamps its cubes into small stored canvases; the stub hands back inert ones.

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

**4. Version and build.** `MK = "0.5.76"` in `src/version.js`, then `npm run build`.

**5. Land.** Commit `src/game/rubbleworlds/draw.js`, `src/game/gravitydebris/draw.js`, and `src/version.js` only (subject `the earned-kick disks, 0.5.76`), push. The phase document's table adds row T81 — "The earned-kick disks: both screens' disks tighten to where nine tenths of the kick is earned" — LANDED (mark 0.5.76, evolution hashes unchanged, the smoke count); commit with this plan file, push. The live check is the acceptance, phone and desktop both.

## Report

- One line of outcome, then bullets.
- Read-confirmation first.
- The battery's printed lines, verbatim; the smoke count exactly.
- The unchanged evolution hashes as their own labeled bullet.
- Fixture seed: 12345; the module rolls fresh seeds at reset.
- Both commit hashes.
- Every deviation its own labeled bullet.
