# T36: the slow chips (0.5.35)

The time row loses ×2 and ×5 and gains ×⅛ and ×1/16. It becomes ×1/16, ×⅛, ×¼, ×½, ×1. Nothing else changes: the map still opens at ×½, the other scenes at ×1, the ship's speed and fuel stay as landed.

- A fraction chip steps the physics once every 1/time drawn frames — the rule half speed has always followed and quarter speed joined in T35: ×⅛ steps every eighth frame, ×1/16 every sixteenth. Checked: over 960 drawn frames the row gives 60, 120, 240, 480, and 960 physics steps.
- Stated plainly: at ×1/16 the physics advances about four times a second, and the picture is not smoothed between steps — bodies move in small hops rather than gliding. That is the trade for slowing the sky sixteenfold without touching the physics; a smoothed picture would be its own task.
- No physics or generation file is touched, so every pinned number stands unchanged; the acceptance shows them.

The change was applied to a fresh copy of the live tree at plan-writing time: both anchors hit exactly once, the file builds, the step rates above measured.

## Required reading

- This plan, whole.
- `src/game/RubbleWorlds.jsx` — the time-step lines in the loop and the chip rows.

## Suggested model

Sonnet. Two anchored substitutions, pre-verified; no design remains.

## Steps

**1. The substitutions.** From the repo root:

```bash
python3 - <<'PYEOF'
import sys
def sub1(path, old, new, tag):
    s = open(path).read()
    if s.count(old) != 1: sys.exit("anchor fail: %s (count %d)" % (tag, s.count(old)))
    open(path, 'w').write(s.replace(old, new))
JSX='src/game/RubbleWorlds.jsx'
sub1(JSX,'          {[0.25, 0.5, 1, 2, 5].map(tm => chip(tm === 0.25 ? "×¼" : tm === 0.5 ? "×½" : "×" + tm, ctl.current.time === tm, () => setLive(k => { k.time = tm; })))}',
       '          {[0.0625, 0.125, 0.25, 0.5, 1].map(tm => chip(tm === 0.0625 ? "×1/16" : tm === 0.125 ? "×⅛" : tm === 0.25 ? "×¼" : tm === 0.5 ? "×½" : "×" + tm, ctl.current.time === tm, () => setLive(k => { k.time = tm; })))}','time-chips')
sub1(JSX,"      // time chips: 2x and 5x run the physics that many steps per rendered frame;",
       "      // time chips: fractions step the physics once every 1/time drawn frames (×1/16 every sixteenth);",'comment')
print("all substitutions in")
PYEOF
```

Expected output, exact: `all substitutions in`.

**2. The physics gate.** Nothing in the physics or the generator moves; every number must stand. The command, whole:

```bash
node -e "
import('node:crypto').then(async({createHash})=>{
  const h=o=>createHash('sha256').update(JSON.stringify(o)).digest('hex').slice(0,16);
  const{makeScenario}=await import('./src/game/rubbleworlds/gen.js');
  const{stepWorld}=await import('./src/game/rubbleworlds/phys.js');
  for(const hash of[false,true]){const w=makeScenario('binary',12345,1);for(let s=0;s<600;s++)stepWorld(w,{welds:true,sleep:true,hash});console.log('evolution 10s hash='+hash,h(w.blocks.map(b=>[Math.round(b.x*1000),Math.round(b.y*1000),Math.round(b.z*1000)])));}
  for(const sc of['ship','binary','duet','moons','trio','system','hole','map'])console.log(sc+' s1',h(makeScenario(sc,12345,1).blocks));
  for(const t of [0.0625,0.125,0.25,0.5,1]){let n=0;for(let f=0;f<960;f++){n+=t>=1?t:(f%Math.round(1/t)===0?1:0);}console.log('time',t,'steps in 960 frames',n);}
});"
```

Acceptance, exact — every line:

```
evolution 10s hash=false 42ae90b308d1e6f6
evolution 10s hash=true 42ae90b308d1e6f6
ship s1 3f0c91218aef32ab
binary s1 1ab5dec0a100e39f
duet s1 815c1643021c10c9
moons s1 55e26401d110fa2c
trio s1 7cbf8f6bbd428266
system s1 1bbb5a4a3205c09c
hole s1 cae5ebf64cc05676
map s1 9c735648f4cb3502
time 0.0625 steps in 960 frames 60
time 0.125 steps in 960 frames 120
time 0.25 steps in 960 frames 240
time 0.5 steps in 960 frames 480
time 1 steps in 960 frames 960
```

**3. Gate.** `node scripts/gate.mjs smoke` — 23 PASS, 0 FAIL, one run. If the tool moves it to the background past its two-minute window, wait and read the pass from the tail of `.superpowers/gates.log` — do not start a second run.

**4. Version and build.** `MK = "0.5.35"`, then `npm run build`.

**5. Land.** Commit `src/game/RubbleWorlds.jsx` and `src/version.js` only (plain-words lowercase subject, e.g. "the slow chips, 0.5.35"), push. The phase document's table marks T36 LANDED (mark 0.5.35, all numbers unchanged, the smoke count); commit with this plan file, push. The owner's live check — the new row, the sky at ×⅛ and ×1/16 — is the acceptance, phone and desktop both.

## Report

- One line of outcome, then bullets.
- Read-confirmation first.
- Every acceptance line as printed; the smoke count exactly.
- Fixture seeds: the gate pins 12345 by the plan's own law; the demo rolls its own seed at mount — none special.
- Both commit hashes.
- Every deviation its own labeled bullet.
