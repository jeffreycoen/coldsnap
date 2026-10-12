# T6 — The fast dead, the sick clock, and the bench (0.6.6)

Three things. The dead walk at 6.4 meters a second, twice a man's pace, up from 4.8. Every living man who carries the sickness shows the seconds left until he turns, in red numbers above his head, counting down from 30; your men, the enemy's men, and the people alike; a man hidden in the fog shows no number. The sandbox gets the outbreak: a THE DEAD switch beside THEY FIGHT fields the six dead at the middle town and the people at their doors the first time it is turned on and runs them while it is on; off, they halt where they stand; the enemy rack gains a THE DEAD tag that places one of the dead at the tap; the ☣ and ☺ counts show on the sandbox's top bar while the switch is on. The sandbox never saves, so no save shape changes. The war's headless keystone is unchanged.

Checked on a fresh copy at plan-writing time: every anchor hit exactly once, every changed file parses, `depot-lint` PASS, `depot-test` 1707 PASS / 0 FAIL, the keystone unchanged, smoke 27/27.

Suggested model: Sonnet 5.5 — every step is verbatim code at a grepped anchor; nothing is designed.

## Required reading, in this order

1. `CLAUDE.md`
2. This file, whole, before the first edit.
3. `docs/superpowers/plans/2026-10-11-coldsnap-the-outbreak-phase.md` whole
4. `src/depot/specs.js` lines 321–333
5. `src/depot/dead.js` lines 1–48
6. `src/depot/palette.js` lines 43–65
7. `src/depot/placement.js` lines 1–12 and 364–404
8. `src/depot/DepotGame.jsx` lines 26–32, 68–74, 184–216, 290–300, 1310–1320, 1460–1470, 1744–1752, 1842–1870, 2040–2046, 2072–2082, 1886–1892
9. `scripts/tests/51-the-people-indoors.mjs` lines 1–20, `scripts/depot-test.mjs`

The report opens with a line confirming every file above was read.

## Gates

Run only these, each through `node scripts/gate.mjs <name>`: `depot-lint`, `depot-test`, `smoke`. The smoke needs `npm run build` then `npm run preview &` first. `golden` does not run: neither `core.js` nor `renderer.js` changes.

The keystone: `node src/depot/api.js gate 7 20` prints `seed 7  seconds 20 (2400 steps)  worldHash 1278094788  runHash 2033212782` on the untouched tree. Step 0 confirms it; Step 11 confirms it again unchanged. Any other number stops the task.

Sweep license: two asserts in `scripts/tests/51-the-people-indoors.mjs` pin the dead's pace at 4.8 — one by the number, one by the time a hunt takes to close 12 meters — and this task changes the pace; both are re-taught in Step 7, each stated old→new there. No other re-teach is licensed. Any failing test other than the new era file's own asserts before Step 8 stops the task.

## Steps

### Step 0 — the keystone, before

Run `node src/depot/api.js gate 7 20`. The output must read exactly `seed 7  seconds 20 (2400 steps)  worldHash 1278094788  runHash 2033212782`. Record it.

Run `node src/depot/api.js gate 7 20 outbreak`. Record the line.

### Step 1 — the failing era file

Create `scripts/tests/53-the-fast-dead-and-the-sick-clock.mjs`:

```js
import { ok } from "./harness.mjs";
import { makeWorld, addBody } from "../../src/engine/core.js";
import { DEAD, DEAD_TEAM, MAN } from "../../src/depot/specs.js";
import { spawnDead, toggleBenchDead } from "../../src/depot/dead.js";
import { sickSeconds } from "../../src/depot/sickclock.js";
import { FOE_RACK_BY_KEY } from "../../src/depot/palette.js";
import { peopleOf } from "../../src/depot/people.js";
import { bootWar } from "../../src/depot/boot.js";

// ==== 0.6.6: the fast dead, the sick clock, and the bench ===================
// Seed rolled each run.
{
  console.log("\n[0.6.6: the fast dead, the sick clock, and the bench]");
  const SEED = (Date.now() % 1000000) + 1;
  console.log("  fixture seed base", SEED);
  const flat = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (x, z, o) => { o.x = 0; o.y = 1; o.z = 0; return o; } };
  const man = (w, team, x, z) => { const u = addBody(w, { kind: "unit", team, mass: MAN.rifle.mass, hx: MAN.rifle.hx, hy: MAN.rifle.hy, hz: MAN.rifle.hz, x, z, y: MAN.rifle.hy + 0.02, hp: MAN.rifle.hp, friction: 0.5 }); u.maxHp = MAN.rifle.hp; return u; };

  // (a) the pace
  ok("(a) the dead walk at 6.4 meters a second, twice a man's pace", DEAD.speed === 6.4, String(DEAD.speed));

  // (b) the clock: whole seconds left until the turn, or nothing
  {
    const w = makeWorld({ field: flat, seed: SEED }); w.depotCombat = true; w.t = 5;
    const m = man(w, 1, 0, 0), e = man(w, 2, 3, 0), q = man(w, 1, 6, 0), d = spawnDead(w, 9, 0);
    m.sickAt = 5; e.sickAt = 5; q.sickAt = 5; q.alive = false;
    ok("(b) a fresh stamp reads thirty", sickSeconds(w, m) === 30, String(sickSeconds(w, m)));
    w.t = 17.4;
    ok("(b) twelve and a bit seconds on it reads eighteen, both armies alike", sickSeconds(w, m) === 18 && sickSeconds(w, e) === 18, `${sickSeconds(w, m)}/${sickSeconds(w, e)}`);
    m.sickAt = null;
    ok("(b) no stamp, no clock; a dead man, no clock", sickSeconds(w, m) === null && sickSeconds(w, q) === null);
    ok("(b) one of the dead carries no clock", sickSeconds(w, d) === null);
  }

  // (c) the rack
  ok("(c) the enemy rack carries THE DEAD", FOE_RACK_BY_KEY.foe_dead && FOE_RACK_BY_KEY.foe_dead.dead === true && FOE_RACK_BY_KEY.foe_dead.label === "THE DEAD");

  // (d) the bench switch: the first turn-on fields the ring and the people; off halts; on again fields nothing new
  {
    const war = bootWar({ seed: SEED, dev: true });
    const deadOf = () => war.world.bodies.filter((b) => b.kind === "unit" && b.team === DEAD_TEAM && b.alive).length;
    ok("(d) the bench opens with no dead, no people, no outbreak", deadOf() === 0 && peopleOf(war.world).length === 0 && !war.run.outbreak);
    const on1 = toggleBenchDead(war.world, war.map, war.run);
    ok("(d) the first turn-on fields six and the people and runs them", on1 === true && war.run.outbreak === true && deadOf() === 6 && peopleOf(war.world).length > 0, `${deadOf()}/${peopleOf(war.world).length}`);
    const off = toggleBenchDead(war.world, war.map, war.run);
    ok("(d) off halts them where they stand", off === false && war.run.outbreak === false && deadOf() === 6);
    const on2 = toggleBenchDead(war.world, war.map, war.run);
    ok("(d) on again fields nothing new", on2 === true && war.run.outbreak === true && deadOf() === 6, String(deadOf()));
    ok("(d) the outbreak is not a key the war's run carries", bootWar({ seed: SEED }).run.outbreak === undefined);
  }
}
```

In `scripts/depot-test.mjs`, after the line `await import("./tests/52-the-short-lists.mjs");` add the line `await import("./tests/53-the-fast-dead-and-the-sick-clock.mjs");`.

Run `node scripts/gate.mjs depot-test`. The new era file fails to load (`sickclock.js` does not exist yet); every other assert passes. Record the result.

### Step 2 — the pace

In `src/depot/specs.js`, replace `export const DEAD = { ...MAN.rifle, tag: "dead", hp: 116, speed: 4.8, sense: 24, bite: 15, biteCd: 1, turnS: 30, reachPad: 0.35, // 0.6.4: half again a man's pace; thirty seconds to the turn` with `export const DEAD = { ...MAN.rifle, tag: "dead", hp: 116, speed: 6.4, sense: 24, bite: 15, biteCd: 1, turnS: 30, reachPad: 0.35, // 0.6.6: twice a man's pace; thirty seconds to the turn`.

### Step 3 — the sick clock

Create `src/depot/sickclock.js`:

```js
// COLDSNAP DEPOT — sickclock.js: THE SICK CLOCK (0.6.6). Red seconds over
// every living man who carries the sickness stamp: the time left until he
// turns, counted down from DEAD.turnS. A flat drawing layer over the game
// canvas, redrawn every frame from the renderer's own projection; nothing
// here touches the world. A man hidden in the fog shows no number.
import { DEAD, DEAD_TEAM } from "./specs.js";

// sickSeconds: the whole seconds left, or null when there is no clock to show.
export function sickSeconds(world, b) {
  if (b.kind !== "unit" || !b.alive || b.team === DEAD_TEAM || b.sickAt == null) return null;
  return Math.max(0, Math.ceil(DEAD.turnS - (world.t - b.sickAt)));
}

// makeSickClock(canvas): the layer. draw(world, project, shows) paints this
// frame; project is the renderer's world-to-screen (normalized, null behind
// the eye); shows(b) says whether the fog lets the man be seen.
export function makeSickClock(canvas) {
  const cx = canvas.getContext("2d");
  let w = 0, h = 0;
  const fit = () => {
    const r = canvas.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    const nw = Math.max(1, Math.round(r.width * dpr)), nh = Math.max(1, Math.round(r.height * dpr));
    if (nw !== w || nh !== h) { w = nw; h = nh; canvas.width = w; canvas.height = h; }
    return dpr;
  };
  return {
    clear() { if (w || h) cx.clearRect(0, 0, w, h); },
    draw(world, project, shows) {
      const dpr = fit();
      cx.clearRect(0, 0, w, h);
      if (!project) return;
      const pool = world._L ? world._L.units : world.bodies;
      cx.font = "bold " + Math.round(15 * dpr) + "px monospace";
      cx.textAlign = "center"; cx.textBaseline = "bottom";
      cx.lineWidth = 3 * dpr; cx.strokeStyle = "rgba(0,0,0,0.75)"; cx.fillStyle = "#ff3b30";
      for (const b of pool) {
        const s = sickSeconds(world, b);
        if (s == null || !shows(b)) continue;
        const nd = project(b.pos.x, b.pos.y + b.hy + 0.9, b.pos.z);
        if (!nd) continue;
        const x = (nd.x * 0.5 + 0.5) * w, y = (-nd.y * 0.5 + 0.5) * h;
        if (x < -20 || x > w + 20 || y < -20 || y > h + 20) continue;
        cx.strokeText(String(s), x, y); cx.fillText(String(s), x, y);
      }
    },
  };
}
```

### Step 4 — the bench switch and the rack tag

In `src/depot/dead.js`, replace

```js
import { addBody, applyDamage } from "../engine/core.js";
import { DEAD, DEAD_TEAM } from "./specs.js";
import { clearSlot, seekGoal } from "./squads.js";
import { faceTravel } from "./units.js";
```

with

```js
import { addBody, applyDamage } from "../engine/core.js";
import { DEAD, DEAD_TEAM } from "./specs.js";
import { clearSlot, seekGoal } from "./squads.js";
import { faceTravel } from "./units.js";
import { spawnPeople } from "./people.js";
```

and replace

```js
// THE TURN: the same body, the third side. The gun goes (no utype, no
```

with

```js
// 0.6.6: THE BENCH SWITCH — the sandbox turns the dead on and off. The first
// turn-on fields the ring and the people; after that the switch only runs or
// halts their step, and the bodies stay. Returns the new state. Draw-free;
// the sandbox never saves.
export function toggleBenchDead(world, map, run) {
  if (run.outbreak) { run.outbreak = false; return false; }
  run.outbreak = true;
  if (!run._benchDead) { run._benchDead = true; spawnOutbreak(world, map); spawnPeople(world, map); }
  return true;
}

// THE TURN: the same body, the third side. The gun goes (no utype, no
```

In `src/depot/palette.js`, replace

```js
  { key: "foe_t_tesla", label: "TESLA COIL", icon: "⚡", tower: "tesla" },
];
```

with

```js
  { key: "foe_t_tesla", label: "TESLA COIL", icon: "⚡", tower: "tesla" },
  { key: "foe_dead", label: "THE DEAD", icon: "☣", dead: true }, // 0.6.6: one of the dead at the tap
];
```

In `src/depot/placement.js`, replace `import { spawnUnit } from "./units.js";` with

```js
import { spawnUnit } from "./units.js";
import { spawnDead } from "./dead.js"; // 0.6.6: the rack's THE DEAD tag
```

and replace

```js
        } else {
          for (let k = 0; k < it.n; k++) spawnUnit(world, { x: d.x, z: d.z }, it.tag);
        }
      };
```

with

```js
        } else if (it.dead) {
          spawnDead(world, d.x, d.z); // 0.6.6: one of the dead, where the tap landed
        } else {
          for (let k = 0; k < it.n; k++) spawnUnit(world, { x: d.x, z: d.z }, it.tag);
        }
      };
```

### Step 5 — the hookup lines

In `src/depot/DepotGame.jsx`:

Replace `import { makeSight, stepSight, seenAt, steerReticle, reclampReticle, surfaceAt } from "./sight.js";` with

```js
import { makeSight, stepSight, seenAt, steerReticle, reclampReticle, surfaceAt } from "./sight.js";
import { makeSickClock } from "./sickclock.js"; // 0.6.6: the red seconds over the sick
import { toggleBenchDead } from "./dead.js";   // 0.6.6: the sandbox's dead switch
```

Replace `  const canvasRef = useRef(null);` with

```js
  const canvasRef = useRef(null);
  const clockRef = useRef(null); // 0.6.6: the sick clock's own layer
```

Replace `        setHealth: (v) => { healthOn = v; view.healthOn = v; R.setHealth(v); try { window.localStorage.setItem("coldsnap-depot-health", v ? "1" : "0"); } catch (e) {} },` with

```js
        setHealth: (v) => { healthOn = v; view.healthOn = v; R.setHealth(v); try { window.localStorage.setItem("coldsnap-depot-health", v ? "1" : "0"); } catch (e) {} },
        toggleBenchDead: () => toggleBenchDead(world, map, run), // 0.6.6: the sandbox's dead switch
```

Replace `      let zoneAcc = 0.25; // the zone's own wall-time accumulator — starts due` with

```js
      // 0.6.6: THE SICK CLOCK's layer and its fog rule — your own men always
      // show; anyone else shows where your side sees, exactly as the renderer draws him.
      const clock = makeSickClock(clockRef.current);
      const fogShows = (b) => { if (b.team === 1 || !view.fogOn) return true; const c = map.invW(b.pos.x, b.pos.z); return seenAt(T.sight, c.u, c.v, 1); };
      let zoneAcc = 0.25; // the zone's own wall-time accumulator — starts due
```

Replace

```js
            R.render(dt, run.focus, AIM_OFF, 0);
            if (perf) { pRen = performance.now() - pRen0; pDrew = 1; }
```

with

```js
            R.render(dt, run.focus, AIM_OFF, 0);
            if (perf) { pRen = performance.now() - pRen0; pDrew = 1; }
            if (run.outbreak) clock.draw(world, R.project, fogShows); else clock.clear(); // 0.6.6: the sick clock rides every drawn frame
```

Replace `              mode: run.mode, sellMode: view.sellMode, sandbagOrient: run.sandbagOrient || 0, devSpawn: view.devSpawn, devDummies: input.devDummies,` with `              mode: run.mode, sellMode: view.sellMode, sandbagOrient: run.sandbagOrient || 0, devSpawn: view.devSpawn, devDummies: input.devDummies, outbreakOn: !!run.outbreak,`.

Replace

```js
  // THE FIGHT SWITCH — sandbox only, live, any time.
  const toggleDevFight = () => {
```

with

```js
  // 0.6.6: THE DEAD SWITCH — sandbox only, live, any time.
  const toggleDevDead = () => {
    const C = stateRef.current; if (!C || !C.view.toggleBenchDead) return;
    const on = C.view.toggleBenchDead();
    setHud((h) => ({ ...h, outbreakOn: on }));
  };
  // THE FIGHT SWITCH — sandbox only, live, any time.
  const toggleDevFight = () => {
```

Replace `          <div style={{ color: "#8a2f2f", fontSize: 10, fontWeight: 600 }}>ENEMY</div>` with `          <div style={{ color: "#8a2f2f", fontSize: 10, fontWeight: 600 }}>{f.dead ? "THE THIRD SIDE" : "ENEMY"}</div>`.

Replace `      <canvas key={runId} ref={canvasRef} style={P.cv} />` with

```js
      <canvas key={runId} ref={canvasRef} style={P.cv} />
      <canvas key={"clock" + runId} ref={clockRef} data-sick-clock style={{ ...P.cv, pointerEvents: "none", zIndex: 3 }} />
```

Replace

```js
        {outbreak && <div data-dead style={P.stat} title="the dead standing">☣ {hud.dead || 0}</div>}
        {outbreak && <div data-people style={P.stat} title="the living people">☺ {hud.people || 0}</div>}
```

with

```js
        {(outbreak || hud.outbreakOn) && <div data-dead style={P.stat} title="the dead standing">☣ {hud.dead || 0}</div>}
        {(outbreak || hud.outbreakOn) && <div data-people style={P.stat} title="the living people">☺ {hud.people || 0}</div>}
```

Replace

```js
            {hud.devDummies ? "THEY STAND" : "THEY FIGHT"}
          </button>
        )}
```

with

```js
            {hud.devDummies ? "THEY STAND" : "THEY FIGHT"}
          </button>
        )}
        {dev && (
          <button data-dev-dead style={{ ...P.btn, padding: isTouch ? "5px 10px" : "4px 10px", borderColor: hud.outbreakOn ? "#a63c3c" : "#48515f", color: hud.outbreakOn ? "#ff6b5e" : "#e6ebf1" }} title="the dead and the people on the bench — the first turn-on fields them at the middle town; off halts them where they stand" onClick={toggleDevDead}>
            {hud.outbreakOn ? "THE DEAD WALK" : "THE DEAD"}
          </button>
        )}
```

### Step 6 — the mark

In `src/version.js`, replace `export const MK = "0.6.5";` with `export const MK = "0.6.6";`.

### Step 7 — the re-teach

In `scripts/tests/51-the-people-indoors.mjs`, replace `  ok("(a) the dead walk at 4.8 meters a second and the turn is thirty seconds", DEAD.speed === 4.8 && DEAD.turnS === 30, `${DEAD.speed}/${DEAD.turnS}`);` with `  ok("(a) the turn is thirty seconds", DEAD.turnS === 30, String(DEAD.turnS)); // 0.6.6: the pace moved to 6.4 and is pinned in the 0.6.6 era`.

Old → new: `DEAD.speed === 4.8 && DEAD.turnS === 30` → `DEAD.turnS === 30`; the pace is a design change and its new value is pinned by the new era's (a).

In the same file, replace `    ok("(f) at 4.8 the dead still close 12 meters and bite inside four seconds", bitAt != null && bitAt < 4 && bitAt > 2, bitAt == null ? "no bite" : bitAt.toFixed(2) + "s");` with `    ok("(f) at 6.4 the dead close 12 meters and bite inside three seconds", bitAt != null && bitAt < 3 && bitAt > 1, bitAt == null ? "no bite" : bitAt.toFixed(2) + "s"); // 0.6.6: the bounds follow the pace`.

Old → new: `bitAt < 4 && bitAt > 2` → `bitAt < 3 && bitAt > 1`. The asserted content — the hunt closes 12 meters and bites — is unchanged; the window follows the pace (12 meters at 6.4 is under two seconds of walking, plus the start).

### Step 8 — the gates

Run, in this order, and record each result line:

1. `node scripts/gate.mjs depot-lint` — `depot-lint PASS`.
2. `node scripts/gate.mjs depot-test` — ends `depot-test PASS`; the new era's 11 asserts all PASS; the total is 1696 + 11 = 1707 PASS / 0 FAIL; the report states the numbers and the era's fixture seed.
3. `npm run build`, then `npm run preview &`, then `node scripts/gate.mjs smoke` — `BOOT-LOAD SMOKE: ALL PASS`, 27 PASS lines. Stop the preview server after.

### Step 9 — the outbreak's own headless run

Run `node src/depot/api.js gate 7 20 outbreak`. It must print a line ending in `  dead N` and must not throw. Record it beside Step 0's; the numbers move (the dead's pace moved) and both go in the report.

### Step 10 — the keystone, after

Run `node src/depot/api.js gate 7 20`. The output must read exactly `seed 7  seconds 20 (2400 steps)  worldHash 1278094788  runHash 2033212782`. Any other number stops the task before the commit; report it.

### Step 11 — the landing

Commit exactly these files in one commit: `src/depot/specs.js`, `src/depot/sickclock.js`, `src/depot/dead.js`, `src/depot/palette.js`, `src/depot/placement.js`, `src/depot/DepotGame.jsx`, `src/version.js`, `scripts/depot-test.mjs`, `scripts/tests/51-the-people-indoors.mjs`, `scripts/tests/53-the-fast-dead-and-the-sick-clock.mjs`, and this plan file. Subject: `the fast dead, the sick clock, and the bench, 0.6.6`. Push to `main`.

Then in `docs/superpowers/plans/2026-10-11-coldsnap-the-outbreak-phase.md`, after the T5 row add the row `| T6 | 0.6.6 | The fast dead, the sick clock, and the bench: the dead at 6.4 meters a second; red seconds over every sick living man until he turns, hidden with him in the fog; the sandbox's THE DEAD switch, its THE DEAD rack tag, and its ☣ ☺ counts | LANDED — mark 0.6.6, keystone unchanged (seed 7, 20 s: 1278094788 / 2033212782), depot-test 1707, smoke 27/27 |`, and in the opening paragraph replace `They walk at 4.8 meters a second, half again a man's pace,` with `They walk at 6.4 meters a second, twice a man's pace,`. Commit that file alone with the subject `t6 lands in the phase document — 0.6.6, the fast dead, the sick clock, and the bench, 27/27`. Push.

### Step 12 — the keystone, confirmed on the pushed tree

Run `node src/depot/api.js gate 7 20` once more and record the line; it must still match Step 0.

## Acceptance

- Step 0, Step 10, and Step 12 print the identical keystone line.
- `depot-test` 1707 PASS / 0 FAIL on a rolled seed; `depot-lint` PASS; smoke 27/27.
- The outbreak gate runs to the end, before and after.
- The live site, phone and desktop. The outbreak: the dead run at twice a man's pace; a bitten man carries red seconds over his head that count down to his turn, and they go with him into the fog. The sandbox: THE DEAD beside THEY FIGHT; the first press fields six at the middle town and the people at their doors and shows ☣ and ☺ on the bar; pressing again halts them; THE DEAD on the enemy rack places one at the tap. The owner's eyes are the acceptance.

## Report

One line of outcome, then: every gate's result line; the three keystone lines; the two outbreak lines; the depot-test totals; the era's fixture seed; the two re-teaches old→new; the commit hashes; every deviation, nonconformity, and re-pin as its own labeled bullet.
