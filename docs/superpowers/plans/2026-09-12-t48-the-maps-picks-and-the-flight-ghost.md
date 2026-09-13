# T48: the map's picks and the flight ghost (0.5.47)

Two fixes on the map screen. First: picking the map scene now picks its settings with it — speed ×1/16, hash on, friction on — so the screen opens the way it is flown. Size 1x, welds on, and sleep on are already the standing defaults and stay untouched. Second: while the ship flies, it gets its own long trajectory line — the same forty-second predictor that draws while aiming, run on the ship's current velocity with no burn added. Today the flying ship only gets the short two-real-second line every planet gets, and at ×1/16 that line is two points: a tick.

- **The map's picks.** The scene chip handler sets speed ×1/16, hash on, friction on when the map is picked; every other scene keeps today's behavior (speed back to ×½). Leaving the map leaves hash and friction as they stand — the same persistence every hand-flipped toggle has today.
- **The flight ghost.** Drawn only in the fly phase, ship alive, no aim in hand: blue while clear, red through danger, the green dot where it threads the gate — the aim ghost's exact style, so the flown line and the aimed line read as one thing. Cost is one prediction per drawn frame, the same cost the aim ghost already pays.
- **The handoff.** The flying ship's clump leaves the short green planet-line pool, so the ship never carries two lines at once. While aiming or planning, the ship's clump keeps its short line exactly as today, under the full aim ghost.

Design choices, stated plainly: the three map picks and their values; the flight ghost replacing the ship's short line rather than stacking on it. The phase table's T48 row names a larger flight picture — body snapshots with labels, the miss label and cross, the in-flight readout line. This task takes only the ghost in flight; the rest stays pending and moves to a later task at landing. No generation, physics, or save shape changes: all eight scene generation numbers are pinned unchanged below.

The whole change was applied to a fresh copy of the live tree at plan-writing time from this exact script: every anchor hit exactly once, every file parses, every acceptance line below reproduced.

## Required reading

- This plan, whole.
- `src/game/RubbleWorlds.jsx` — the chip rows at the bottom of the component.
- `src/game/rubbleworlds/draw.js` — the projected-orbit block and the aim-ghost block.

## Suggested model

Sonnet. Three anchored substitutions, pre-verified; no design remains.

## Steps

**1. The substitutions.** From the repo root:

```bash
python3 - <<'PYEOF'
import sys
def sub1(path, old, new, tag):
    s = open(path).read()
    if s.count(old) != 1: sys.exit("anchor fail: %s (count %d)" % (tag, s.count(old)))
    open(path, 'w').write(s.replace(old, new))
JSX='src/game/RubbleWorlds.jsx'; DRAW='src/game/rubbleworlds/draw.js'

# 1. component: picking the map picks its settings with it
sub1(JSX, "          {SCENES.map(sn => chip(SCENE_LABEL[sn], ui.kind === sn, () => set(k => { k.kind = sn; k.time = 0.5; })))}",
     "          {SCENES.map(sn => chip(SCENE_LABEL[sn], ui.kind === sn, () => set(k => { k.kind = sn; k.time = sn === \"map\" ? 0.0625 : 0.5; if (sn === \"map\") { k.hash = true; k.friction = true; } })))}", 'map-picks')

# 2. draw.js: the flight ghost, drawn just before the plan banner
sub1(DRAW, "      if (world.ship && world.shipPhase === \"plan\") {",
     '''      // the flight ghost: the same forty-second predictor on the ship's own
      // velocity, no burn added, so the flown path reads as far as the aimed
      // one. It replaces the two-second clump tick for the flying ship.
      if (world.ship && world.shipPhase === "fly" && !world.shipDead && world.shipTrack && !(world.shipAim && world.shipAim.on)) {
        const st = world.shipTrack;
        const pr = predictShip(world, st.vx, st.vz, 2400);
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
      if (world.ship && world.shipPhase === "plan") {''', 'flight-ghost')

# 3. draw.js: the flying ship's clump leaves the short green line to the planets
sub1(DRAW, "        const bodies = (world.tracks || []).filter(tk => tk.m >= 500).slice(0, 14)",
     "        const shipClump = world.ship && world.shipPhase === \"fly\" && world.shipTrack ? world.shipTrack.clump : null; // the flight ghost owns the flying ship's line\n        const bodies = (world.tracks || []).filter(tk => tk.m >= 500 && tk.clump !== shipClump).slice(0, 14)", 'clump-handoff')
print("all substitutions in")
PYEOF
```

Expected output, exact: `all substitutions in`.

**2. The generation gate.** Nothing in generation or physics moves; the command proves it. From the repo root:

```bash
node -e "
import('node:crypto').then(async({createHash})=>{
  const h=o=>createHash('sha256').update(JSON.stringify(o)).digest('hex').slice(0,16);
  const{makeScenario}=await import('./src/game/rubbleworlds/gen.js');
  for(const sc of['ship','binary','duet','moons','trio','system','hole','map'])console.log(sc+' s1',h(makeScenario(sc,12345,1).blocks));
});"
```

Acceptance, exact — every line:

```
ship s1 3f0c91218aef32ab
binary s1 1ab5dec0a100e39f
duet s1 815c1643021c10c9
moons s1 55e26401d110fa2c
trio s1 7cbf8f6bbd428266
system s1 1bbb5a4a3205c09c
hole s1 cae5ebf64cc05676
map s1 ec162c4fdcbea69f
```

**3. Gate.** `node scripts/gate.mjs smoke` — 23 PASS, 0 FAIL, one run. If the tool moves it to the background past its two-minute window, wait and read the pass from the tail of `.superpowers/gates.log` — do not start a second run.

**4. Version and build.** `MK = "0.5.47"`, then `npm run build`.

**5. Land.** Commit `src/game/RubbleWorlds.jsx`, `src/game/rubbleworlds/draw.js`, and `src/version.js` only (plain-words lowercase subject, e.g. "the map's picks and the flight ghost, 0.5.47"), push. The phase document's table marks T48 LANDED (mark 0.5.47, all generation numbers unchanged, the smoke count) and the row's remaining flight-picture items — body snapshots with labels, miss label and cross, the in-flight readout line — move to a new PLANNED row; commit with this plan file, push. The owner's live flight is the acceptance, phone and desktop both.

## Report

- One line of outcome, then bullets.
- Read-confirmation first.
- Every acceptance line as printed; the smoke count exactly.
- All generation numbers unchanged, as its own labeled bullet.
- Fixture seeds: the gate pins 12345 by the plan's own law; the demo rolls its own seed at mount — none special.
- Both commit hashes.
- Every deviation its own labeled bullet.
