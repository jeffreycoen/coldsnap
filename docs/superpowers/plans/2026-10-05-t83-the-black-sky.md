# T83: the black sky (0.5.78)

Both block screens gain a dark mode behind a DARK chip in the bottom row, beside FRICTION: space goes black, the gravity netting goes white, the sixty dust specks turn from near-black flecks to pale stars, and the pause overlay becomes a dark wash with light text. The chip flips live without a reset, like WELDS, defaults to light, and is not remembered across loads — the same life every chip has. Every other mark keeps its own color on either ground: the suns, the green disks, the orbit lines, the blue ghosts, the teal gate, compass and fuel caches, the orange aim arrow, the cubes. Drawing and chip wiring only — the physics is untouched, and the battery proves it with unchanged evolution hashes, now drawing each frame on both grounds. Interface change, phone and desktop alike: the chip rides the existing wrapping chip row on both. Fourteen substitutions across four files, one commit.

Design choices, stated plainly: black is `#000` as spoken; the netting is white at the net's own existing alphas; the dust stars sit at .4 and .2 against the old .06 and .03, and the pause wash at black .45 with text at white .4 and .25 — these numbers are design choices until played, and your eye on the live site rules them. The disk, orbit, and ghost alphas are untouched on the bet that they read brighter on black; if they wash out or glare, that is a follow-up number change, not this task.

What could stop this, thought through ahead: the smoke never visits these two screens — its sections are start, demo, phone, keymap, mech, td, and depot — so it cannot fail from this change and also cannot exercise it; the battery's dark-ground draw and your live check are the proof. The debris screen's cube stamping creates small canvases, which the battery's document shim already stubs. The sprite cache keys on color, size, and light, none of which dark mode touches. The gate step carries its server precondition in the amended order T82 landed with — bump, build, server, gate — and the server stop uses a pattern that cannot match its own command line, which is what bit the T82 agent. The black hole's body is near-black on black space; it keeps its orange rim and purple glow and is expected to read by them — an eye call after it ships, not a stopper. No save shapes, no depot code, no frozen files are touched.

The substitution script was applied to a fresh copy of the live tree at plan-writing time: every anchor hit its exact count in its file, both draw files pass a node parse, both components compile clean, and the acceptance below reproduced — both evolution hashes match the untouched tree exactly.

## Required reading

- This plan, whole.
- `src/game/rubbleworlds/draw.js` — the background, dust, net, and pause sites.
- `src/game/gravitydebris/draw.js` — the same sites, dent-riding twin.
- `src/game/RubbleWorlds.jsx` — the control ref, the chip row, the drawFrame call.
- `src/game/GravityDebris.jsx` — the same three sites.

## Suggested model

Sonnet. Pre-verified substitutions in four files; no design remains.

## Steps

**1. The substitutions.** From the repo root:

```bash
python3 - <<'PYEOF'
import sys
def subn(path, old, new, n, tag):
    s = open(path).read()
    if s.count(old) != n: sys.exit("anchor fail: %s (count %d, wanted %d)" % (tag, s.count(old), n))
    open(path, 'w').write(s.replace(old, new))

RD = 'src/game/rubbleworlds/draw.js'
DD = 'src/game/gravitydebris/draw.js'
RJ = 'src/game/RubbleWorlds.jsx'
DJ = 'src/game/GravityDebris.jsx'

for F in [RD, DD]:
    subn(F, "const { ctx, W, H, world, frame, time } = env;",
            "const { ctx, W, H, world, frame, time, dark } = env;", 1, 'env:' + F)
    subn(F, '      ctx.fillStyle = "#f5f4f0"; ctx.fillRect(0, 0, W, H);',
            '      // DARK MODE (the chip): black space, white netting, pale dust, a dark pause wash; every other mark keeps its own color on either ground\n      ctx.fillStyle = dark ? "#000" : "#f5f4f0"; ctx.fillRect(0, 0, W, H);', 1, 'bg:' + F)
    subn(F, "ctx.fillStyle = `rgba(0,0,20,${i % 5 === 0 ? 0.06 : 0.03})`;",
            "ctx.fillStyle = dark ? `rgba(235,240,255,${i % 5 === 0 ? 0.4 : 0.2})` : `rgba(0,0,20,${i % 5 === 0 ? 0.06 : 0.03})`;", 1, 'dust:' + F)
    subn(F, "ctx.strokeStyle = `rgba(45,55,75,${a})`; ctx.stroke(); }",
            "ctx.strokeStyle = dark ? `rgba(255,255,255,${a})` : `rgba(45,55,75,${a})`; ctx.stroke(); }", 2, 'net:' + F)
    subn(F, 'ctx.fillStyle = "rgba(245,244,240,.45)"; ctx.fillRect(0, 0, W, H);',
            'ctx.fillStyle = dark ? "rgba(0,0,0,.45)" : "rgba(245,244,240,.45)"; ctx.fillRect(0, 0, W, H);', 1, 'pausewash:' + F)
    subn(F, 'ctx.font = "200 22px -apple-system,sans-serif"; ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.textAlign = "center";',
            'ctx.font = "200 22px -apple-system,sans-serif"; ctx.fillStyle = dark ? "rgba(255,255,255,.4)" : "rgba(0,0,0,.35)"; ctx.textAlign = "center";', 1, 'pausetext:' + F)
    subn(F, 'ctx.font = "400 10px -apple-system,sans-serif"; ctx.fillStyle = "rgba(0,0,0,.2)";',
            'ctx.font = "400 10px -apple-system,sans-serif"; ctx.fillStyle = dark ? "rgba(255,255,255,.25)" : "rgba(0,0,0,.2)";', 1, 'pausetap:' + F)

subn(DJ, 'const ctl = useRef({ kind: "map", welds: true, sleep: true, hash: true, friction: true, time: 0.0625, size: 1, hull: "longrange", shipOn: false, reset: 1 });',
         'const ctl = useRef({ kind: "map", welds: true, sleep: true, hash: true, friction: true, dark: false, time: 0.0625, size: 1, hull: "longrange", shipOn: false, reset: 1 });', 1, 'ctl:debris')
subn(RJ, 'const ctl = useRef({ kind: "binary", welds: true, sleep: true, hash: false, friction: false, time: 0.5, size: 1, hull: "longrange", shipOn: false, reset: 1 });',
         'const ctl = useRef({ kind: "binary", welds: true, sleep: true, hash: false, friction: false, dark: false, time: 0.5, size: 1, hull: "longrange", shipOn: false, reset: 1 });', 1, 'ctl:rubble')

for F in [RJ, DJ]:
    subn(F, "drawFrame({ ctx, W, H, world, frame: world.frame, time: k.time });",
            "drawFrame({ ctx, W, H, world, frame: world.frame, time: k.time, dark: k.dark });", 1, 'call:' + F)
    subn(F, '          {chip(`FRICTION ${ctl.current.friction ? "ON" : "OFF"}`, ctl.current.friction, () => setLive(k => { k.friction = !k.friction; }))}',
            '          {chip(`FRICTION ${ctl.current.friction ? "ON" : "OFF"}`, ctl.current.friction, () => setLive(k => { k.friction = !k.friction; }))}\n          {chip(`DARK ${ctl.current.dark ? "ON" : "OFF"}`, ctl.current.dark, () => setLive(k => { k.dark = !k.dark; }))}', 1, 'chip:' + F)
print("all substitutions in")
PYEOF
```

Expected output, exact: `all substitutions in`.

Then `node --check src/game/rubbleworlds/draw.js` and `node --check src/game/gravitydebris/draw.js` each print nothing, and `node_modules/.bin/esbuild --loader:.jsx=jsx src/game/GravityDebris.jsx --outfile=/dev/null --log-level=error` and the same for `src/game/RubbleWorlds.jsx` each print nothing (all four parse clean).

**2. The battery.** Save the block below as `/tmp/battery83.mjs` and run `node /tmp/battery83.mjs /home/batman/coldsnap` once. It draws each frame twice — light ground, then dark — so the dark path is proven headless. The document shim exists because the debris frame stamps its cubes into small stored canvases; the stub hands back inert ones.

```js
// THE SKY BATTERY: seed 12345, both screens — skies build, step 5 simulated
// seconds, the drawn frames run headless on stub canvases in BOTH grounds
// (light, then dark), physics unchanged.
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
  RD.drawFrame({ ctx: stub(), W: 900, H: 600, world: w, frame: w.frame, time: 0.5, dark: true });
  console.log('rubble frames drawn light+dark | NaN ' + w.blocks.some(b => b.alive && !isFinite(b.x)));
}
{
  const DG = await import(dir + '/src/game/gravitydebris/gen.js');
  const DP = await import(dir + '/src/game/gravitydebris/phys.js');
  const DD = await import(dir + '/src/game/gravitydebris/draw.js');
  const w = DG.makeScenario('map', 12345, 1);
  for (let s = 0; s < 300; s++) DP.stepWorld(w, {welds:true, sleep:true, hash:true, friction:true});
  console.log('debris map at 5s', h(w.blocks), 'alive ' + w.blocks.filter(b=>b.alive).length + '/' + w.blocks.length + ' | eaten ' + w.eaten);
  DD.drawFrame({ ctx: stub(), W: 900, H: 600, world: w, frame: w.frame, time: 0.5 });
  DD.drawFrame({ ctx: stub(), W: 900, H: 600, world: w, frame: w.frame, time: 0.5, dark: true });
  console.log('debris frames drawn light+dark | NaN ' + w.blocks.some(b => b.alive && !isFinite(b.x)));
}
console.log('STRUCTURE HELD');
```

Acceptance, exact — every line, and both hashes are the untouched tree's own numbers, proving the physics never moved:

```
rubble system at 5s 582386c0cb544735 alive 171/171
rubble frames drawn light+dark | NaN false
debris map at 5s 30a0941f931b2e0c alive 1789/2167 | eaten 537
debris frames drawn light+dark | NaN false
STRUCTURE HELD
```

**3. Version and build.** `MK = "0.5.78"` in `src/version.js`, then `npm run build`.

**4. The server, then the gate.** Start the preview server in the background, logging to `/tmp/preview83.log`:

```bash
npm run preview >/tmp/preview83.log 2>&1 &
```

Prove it is up — expected output, exact: `SERVER UP`:

```bash
curl -sf --retry 20 --retry-delay 1 --retry-all-errors http://localhost:4173/coldsnap/ -o /dev/null && echo SERVER UP
```

Then `node scripts/gate.mjs smoke` — the banner prints `boot-load smoke 0.5.78`, then 23 PASS, 0 FAIL, one run. If the tool moves it to the background past its two-minute window, wait and read the pass from the tail of `.superpowers/gates.log` — do not start a second run. Then stop the server with the bracketed pattern, which can never match its own command line:

```bash
pkill -f "[v]ite preview"
```

A failed gate still stops the server, then stops the task.

**5. Land.** Commit `src/game/rubbleworlds/draw.js`, `src/game/gravitydebris/draw.js`, `src/game/RubbleWorlds.jsx`, `src/game/GravityDebris.jsx`, and `src/version.js` only (subject `the black sky, 0.5.78`), push. The phase document's table adds row T83 — "The black sky: both screens gain the DARK chip — black space, white netting, pale dust, a dark pause wash" — LANDED (mark 0.5.78, evolution hashes unchanged, the smoke count); commit with this plan file, push. The live check is the acceptance, phone and desktop both, light and dark both.

## Report

- One line of outcome, then bullets.
- Read-confirmation first.
- The battery's printed lines, verbatim; the smoke count exactly.
- The unchanged evolution hashes as their own labeled bullet.
- Fixture seed: 12345; the module rolls fresh seeds at reset.
- Both commit hashes.
- Every deviation its own labeled bullet.
