# The Settled Ground — Task 2: Born Ruins (mk2.62)

**DO NOT USE THIS PLAN AS AN EXAMPLE (owner, 2026-08-26).** It shipped and its task landed, but it is needlessly complicated, and it names specific seeds and pins exact totals — both against the random ground rule taken the same day. No future plan copies its shape.

*Written by Claude Fable 5, 2026-08-26, against mk2.61 (commit 069fb5e). Skeleton: `2026-08-26-the-settled-ground-skeleton-draft.md`, ruling 2. Suggested model: Fable was the skeleton's lean because the forms needed judgment at plan time; that judgment is now done and proven in a scratch copy — every code block below ran green before this plan was served. With the code fully specified, Sonnet suffices; the owner rules. Every anchor greps against the live tree.*

## What this task does

A town entry may be born dead (`dead: true` with a `form`). `buildTown` lays it by one of four ruin forms instead of the live lay. A born ruin is `ruined: true` from its first frame: no flag, no pay, no collapse watch, open cells — every skip already exists. The decayed bench buildings and the old-ruin entries become born ruins; the decay-hash look retires from generation. No draw moves: the form is derived from the already-drawn decay value. Scratch-measured: 607 born ruins over seeds 1–200 (about three a map), all four forms represented.

**The knowing behavior change:** today's decayed bench buildings are damaged but ALIVE — they block cells, fly flags, and pay. After this task they are dead ground: cover, not holdings. Both sides lose the same buildings on the same seeds (the ground is neutral); income per seed shifts symmetrically. This is ruling 2's intent, stated here so it is chosen, not incidental.

## The four forms (proven counts on the 4×4×3 exemplar, door 0)

- **The shell** — perimeter only, up to three courses (`min(3, ny)`), the top course ragged at forty percent by the same hash family the old decay used, doorway kept, no roof, welded. 26 stones.
- **The stump** — one corner column to full height, the rest of the perimeter one course, no roof, welded. 14 stones.
- **The rubble mound** — loose stones over the footprint by a deterministic hash (about a quarter of a live form's weight), height one to two, jittered off the lattice, sleeping, UNWELDED. 10 stones.
- **The chimney** — a one-stone column at the footprint's center, five high, welded. 5 stones.

All dials provisional: the forty percent, the mound densities (0.55 / 0.2), the chimney's five.

## Required reading (verified against the tree)

The agent's report opens by confirming each was read.

1. This plan, whole.
2. `docs/superpowers/plans/2026-08-26-the-settled-ground-skeleton-draft.md` — rulings 2 and 6.
3. `src/depot/mapgen.js` — the bench loop (`:219-237`), the old-ruin loop (`:238-246`), makeMap's stamp loop (`:287-297`), `stoneCount` (`:425+`).
4. `src/depot/DepotGame.jsx:202-397` — `townFootprint`, `buildTown` whole (the non-depot branch `:317-367`, the footprint claim `:369-370`, the out row `:381`), `stepTown`.
5. `src/depot/economy.js:13-22` — `payTown`'s ruined skip.
6. `scripts/tests/33-the-settled-ground.mjs` — the file this task extends.
7. `scripts/tests/05-the-front.mjs:514-605` — the T6 keystone this task re-pins.
8. `src/version.js`.

## The licensed re-teaches

1. **The T6 keystone** (`scripts/tests/05-the-front.mjs:540-541`). Seed 1000's map carries born ruins (a chimney and a shell), so the keystone's world and battle legitimately move — the mk1.32/mk1.34/mk1.45/mk2.51 precedent, recaptured off the block's own printed log. Scratch-measured expected values: `T6_HASH` 879989108 → 183285727, `T6_DRAWS` 572 → 566. The agent re-pins to what its own run prints; if the printed values differ from these expected ones, STOP and report — same code must give same numbers.
2. Nothing else. `08-debug-pass.mjs` boot bounds and era-05's sweep bounds are upper bounds and born ruins only lower stone counts; they must pass untouched. Any other red stops the task.

## Steps, in execution order

### Step 1 — the mark

`src/version.js:6`: `mk2.61` → `mk2.62`.

### Step 2 — the failing asserts: era 33 grows a T2 chapter

Append to `scripts/tests/33-the-settled-ground.mjs`. First extend the imports at the top of the file: add `stepWorld` to the core.js import; add these lines after the existing imports:

```js
import { makeSquad, stepSquad } from "../../src/depot/squads.js";
import { spawnSquadMembers } from "../../src/depot/state.js";
import { payTown } from "../../src/depot/economy.js";
```

Then append at the end of the file:

```js
// ==== T2: BORN RUINS (mk2.62) ===============================================
// A dead entry lays as one of four ruin forms; it is ruined from its first
// frame — no flag, no pay, open cells. No draw moves: the form derives from
// the already-drawn decay value. Fixture seeds 1-200; the crossing's map is
// DISCOVERED by the sweep (first map holding a mound), never named.

// T2a: the four forms' arithmetic on one exemplar entry.
{
  console.log("\n[settled t2: born ruins]");
  const EX = [["shell", 26], ["stump", 14], ["mound", 10], ["chimney", 5]];
  for (const [form, want] of EX) {
    const got = stoneCount({ nx: 4, nz: 4, ny: 3, door: 0, dead: true, form });
    ok(`T2a: the ${form} costs ${want} stones on the 4x4x3 exemplar`, got === want, String(got));
  }
}

// T2b/T2c: the sweep — every form appears, every born ruin is ruined with
// open cells, and the T1b equality pin above already holds over dead entries.
{
  let dead = 0, badRow = 0, badCell = 0;
  const seen = new Set();
  for (let s = 1; s <= 200; s++) {
    const Mi = mkMap();
    Mi.makeMap(s);
    const st = Mi.state();
    const world = makeWorld({ field: flatF, seed: 7 });
    world._tdStruct = true;
    const g = Mi.makeGrid(null);
    const out = Mi.buildTown(world, g, flatF);
    for (let i = 0; i < st.TOWN.length; i++) {
      const t = st.TOWN[i];
      if (!t.dead) continue;
      dead++;
      seen.add(t.form);
      if (out[i].ruined !== true) badRow++;
      for (const ci of out[i].cells) if (g.cells[ci].blocked) badCell++;
    }
  }
  ok("T2b: 607 born ruins over seeds 1-200, all four forms drawn", dead === 607 && seen.size === 4, `${dead} dead, forms ${[...seen].sort().join(",")}`);
  ok("T2c: every born ruin is ruined from its first frame", badRow === 0, String(badRow));
  ok("T2c: no born ruin blocks a cell", badCell === 0, String(badCell));
}

// T2d: a born ruin pays neither side, even on held ground.
{
  const T = { cs: 2, nx: 4, nz: 4, halfU: 4, halfV: 4, v: new Float32Array(16).fill(1) };
  const pay = payTown([{ x: 0, z: 0, ruined: true }], T);
  ok("T2d: a born ruin pays nothing", pay.player === 0 && pay.regiment === 0, `p${pay.player} r${pay.regiment}`);
}

// T2e: THE CROSSING — a rifle squad marches straight through a rubble mound
// and arrives whole. The mound's map is the first the sweep finds holding
// one; the seed is discovered each run, never pinned.
{
  const flatW = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (x, z, o) => { o.x = 0; o.y = 1; o.z = 0; return o; } };
  let found = null;
  for (let s = 1; s <= 200 && !found; s++) {
    const Mi = mkMap();
    Mi.makeMap(s);
    const m = Mi.state().TOWN.find((t) => t.dead && t.form === "mound");
    if (m) found = { Mi, m };
  }
  ok("T2e: a mound exists to cross", !!found);
  if (found) {
    const { Mi, m } = found;
    const world = makeWorld({ field: flatW, seed: 9 });
    world._tdStruct = true; world.depotCombat = true;
    world.inRim = () => true; world.pondAt = () => false; world.streamAt = () => false;
    Mi.buildTown(world, Mi.makeGrid(null), flatW);
    const sq = makeSquad(1, "rifles", 1, m.x - 8, m.z);
    spawnSquadMembers(world, sq);
    const DEST = { x: m.x + 8, z: m.z };
    sq.order = "move"; sq.dest = { ...DEST };
    for (let i = 0; i < 60 * 120; i++) { stepSquad(world, sq, 1 / 120); stepWorld(world); }
    let worst = 0, alive = 0;
    for (const id of sq.memberIds) {
      const u = world.byId.get(id);
      if (u && u.alive) { alive++; worst = Math.max(worst, Math.hypot(u.pos.x - DEST.x, u.pos.z - DEST.z)); }
    }
    ok("T2e: all four men cross the mound alive and arrive within 3.5m in 60s", alive === 4 && worst < 3.5, `alive ${alive}, worst ${worst.toFixed(2)}m`);
  }
}

// T2f: source pins — the generation seams.
{
  const mg = fs.readFileSync(new URL("../../src/depot/mapgen.js", import.meta.url), "utf8");
  ok("T2f: the old ruins are born shells", /"oldruin" \+ placed, x, z, nx: 4, nz: 4, ny: 3, door: 0, dead: true, form: "shell"/.test(mg));
  ok("T2f: makeMap's stamp loop skips the dead", /if \(t\.dead\) continue; \/\/ T2: a born ruin blocks no cell/.test(mg));
  ok("T2f: the bench form derives from the drawn decay value, no new draw", /decay < 0\.195 \? "shell" : decay < 0\.27 \? "stump" : decay < 0\.345 \? "mound" : "chimney"/.test(mg));
}
```

Register nothing — the file is already in the runner. Run `node scripts/gate.mjs depot-test` and confirm the T2 checks fail (no `dead` entries exist yet; T2b reads 0 dead). The failing state is the proof the pins bite.

### Step 3 — mapgen: the born-dead entries

Three edits to `src/depot/mapgen.js`, verbatim.

**3a — the bench loop.** Replace (at `:233-234`):

```js
      const decay = r() < 0.2 ? 0.12 + r() * 0.3 : 0;
      town.push({ id: tpl.t + bid++, x, z, nx, nz, ny: tpl.ny, door: r() < 0.5 ? 0 : nx - 1, roof: tpl.roof, ruin: decay || undefined, cols: tpl.cols });
```

with:

```js
      const decay = r() < 0.2 ? 0.12 + r() * 0.3 : 0;
      // T2 (mk2.62, owner): a decayed bench building is BORN DEAD — same two
      // draws, reinterpreted: the drawn decay value picks the ruin form, so
      // the draw count is untouched and every seed keeps its stream.
      const form = !decay ? undefined : decay < 0.195 ? "shell" : decay < 0.27 ? "stump" : decay < 0.345 ? "mound" : "chimney";
      town.push({ id: tpl.t + bid++, x, z, nx, nz, ny: tpl.ny, door: r() < 0.5 ? 0 : nx - 1, roof: tpl.roof, dead: decay ? true : undefined, form, cols: tpl.cols });
```

**3b — the old ruins.** Replace (at `:244`):

```js
    town.push({ id: "oldruin" + placed, x, z, nx: 4, nz: 4, ny: 3, door: 0, ruin: 0.5 });
```

with:

```js
    town.push({ id: "oldruin" + placed, x, z, nx: 4, nz: 4, ny: 3, door: 0, dead: true, form: "shell" }); // T2: born shells
```

**3c — makeMap's stamp loop.** At `:288-289`, after `for (const t of TOWN) {`, insert as its first line:

```js
      if (t.dead) continue; // T2: a born ruin blocks no cell — connectivity judges the true ground
```

### Step 4 — mapgen: `stoneCount` learns the forms

At the top of `stoneCount` (`src/depot/mapgen.js:426`), immediately after `export function stoneCount(t) {`, insert:

```js
  // BORN RUINS (T2, mk2.62): a dead entry plans by its ruin form's own lay.
  if (t.dead) {
    if (t.form === "chimney") return 5;
    if (t.form === "mound") {
      let n = 0;
      for (let ix = 0; ix < t.nx; ix++) for (let iz = 0; iz < t.nz; iz++) {
        const h = ((ix * 31 + iz * 7 + t.nx * 13) % 100) / 100;
        if (h < 0.55) n++;
        if (h < 0.2) n++;
      }
      return n;
    }
    if (t.form === "stump") {
      let n = t.ny;
      for (let ix = 0; ix < t.nx; ix++) for (let iz = 0; iz < t.nz; iz++) {
        const perim = ix === 0 || ix === t.nx - 1 || iz === 0 || iz === t.nz - 1;
        if (perim && !(ix === 0 && iz === 0)) n++;
      }
      return n;
    }
    const H = Math.min(3, t.ny); // the shell
    let n = 0;
    for (let ix = 0; ix < t.nx; ix++) for (let iy = 0; iy < H; iy++) for (let iz = 0; iz < t.nz; iz++) {
      const perim = ix === 0 || ix === t.nx - 1 || iz === 0 || iz === t.nz - 1;
      if (!perim) continue;
      if (ix === t.door && (iz === 1 || iz === 2) && iy <= 2) continue;
      if (iy === H - 1 && ((ix * 31 + iy * 17 + iz * 7) % 100) / 100 < 0.4) continue;
      n++;
    }
    return n;
  }
```

### Step 5 — buildTown: the dead lay

Two edits to `src/depot/DepotGame.jsx`, verbatim.

**5a — the dead branch.** At `:317`, the line `} else {` opening the non-depot branch becomes a three-way split. Replace that single line with:

```js
    } else if (t.dead) {
      // BORN RUINS (Settled Ground T2, mk2.62, owner): a dead entry lays as
      // one of four ruin forms instead of the live lay. No draw: the form
      // rides the entry (mapgen derives it from already-drawn values).
      // Welded by the same neighbor pass the live lay uses — except the
      // mound, which is loose by design (sleeping, unwelded).
      const lay = (ix, iy, iz, jx, jz) => {
        const c = addBody(world, { kind: "chunk", team: 0, mass, hx: hcs, hy: hcs, hz: hcs,
          x: t.x + (ix - (t.nx - 1) / 2) * pitch + (jx || 0),
          y: base + iy * pitch,
          z: t.z + (iz - (t.nz - 1) / 2) * pitch + (jz || 0),
          friction: 0.65, restitution: 0.02 });
        c.sleeping = true; c.town = t.id; c.gpos = [ix, iy, iz];
        grid3.push(c);
      };
      if (t.form === "chimney") {
        const cx = Math.floor(t.nx / 2), cz = Math.floor(t.nz / 2);
        for (let iy = 0; iy < 5; iy++) lay(cx, iy, cz);
      } else if (t.form === "mound") {
        for (let ix = 0; ix < t.nx; ix++) for (let iz = 0; iz < t.nz; iz++) {
          const h = ((ix * 31 + iz * 7 + t.nx * 13) % 100) / 100;
          const j = (((ix * 17 + iz * 29) % 7) - 3) * 0.05; // deterministic jitter, ±0.15m — loose, not a lattice
          if (h < 0.55) lay(ix, 0, iz, j, -j);
          if (h < 0.2) lay(ix, 1, iz, -j, j);
        }
      } else if (t.form === "stump") {
        for (let iy = 0; iy < t.ny; iy++) lay(0, iy, 0);
        for (let ix = 0; ix < t.nx; ix++) for (let iz = 0; iz < t.nz; iz++) {
          const perim = ix === 0 || ix === t.nx - 1 || iz === 0 || iz === t.nz - 1;
          if (!perim || (ix === 0 && iz === 0)) continue;
          lay(ix, 0, iz);
        }
      } else { // the shell
        const H = Math.min(3, t.ny);
        for (let ix = 0; ix < t.nx; ix++) for (let iy = 0; iy < H; iy++) for (let iz = 0; iz < t.nz; iz++) {
          const perim = ix === 0 || ix === t.nx - 1 || iz === 0 || iz === t.nz - 1;
          if (!perim) continue;
          if (ix === t.door && (iz === 1 || iz === 2) && iy <= 2) continue;
          if (iy === H - 1 && ((ix * 31 + iy * 17 + iz * 7) % 100) / 100 < 0.4) continue;
          lay(ix, iy, iz);
        }
      }
      if (t.form !== "mound") {
        const key = (a, b, c2) => a + "," + b + "," + c2;
        const map = new Map(grid3.map((c) => [key(c.gpos[0], c.gpos[1], c.gpos[2]), c]));
        for (const c of grid3) {
          const g = c.gpos;
          for (const d of [[1, 0, 0], [0, 1, 0], [0, 0, 1]]) {
            const o = map.get(key(g[0] + d[0], g[1] + d[1], g[2] + d[2]));
            if (o) addWeld(world, c, o, breakF);
          }
        }
      }
    } else {
```

The old `:329` decay-hash line inside the live branch stays as it is — no live entry carries `ruin` any more, and the dead line costs nothing.

**5b — the claim and the row.** At `:369-370`, the footprint claim gains the dead guard, and at `:381` the out row carries the born verdict:

old:
```js
    const cells = townFootprint(grid, t);
    for (const ci of cells) { const c = grid.cells[ci]; c.blocked = true; c.building = t.id; c.bTeam = t.team === 2 ? 2 : (t.depot ? 1 : 0); }
```
new:
```js
    const cells = townFootprint(grid, t);
    if (!t.dead) for (const ci of cells) { const c = grid.cells[ci]; c.blocked = true; c.building = t.id; c.bTeam = t.team === 2 ? 2 : (t.depot ? 1 : 0); } // T2: a born ruin blocks no cell
```

old:
```js
    out.push({ id: t.id, cells, stones: grid3, n0: grid3.length, ruined: false, x: t.x, z: t.z });
```
new:
```js
    out.push({ id: t.id, cells, stones: grid3, n0: grid3.length, ruined: !!t.dead, x: t.x, z: t.z }); // T2: ruined from the first frame
```

The `buildTown` function line itself (`:221`) and its export (`:385`) never change — three slicers pin them. `stepTown`, the flag rows, `payTown`, the restore path, and `save.js` are all untouched: their existing `ruined` skips do the work.

### Step 6 — the licensed re-teach

`scripts/tests/05-the-front.mjs:540-541`: re-pin `T6_HASH` and `T6_DRAWS` to the values the block's own printed `[t6 keystone]` log line shows, appending the re-capture comment in the block's own style: `(re-captured mk2.62: BORN RUINS — seed 1000's map holds a chimney and a shell)`. Expected from the scratch run: hash 879989108 → 183285727, draws 572 → 566. If the printed values differ from these, STOP and report.

### Step 7 — gates

`node scripts/gate.mjs depot-test`, `node scripts/gate.mjs depot-lint`, `node scripts/gate.mjs smoke`, in that order, all green. Thirteen new checks; suite arithmetic 2,062 → 2,075. The report names the fixture seed ranges (1–200; the crossing's map discovered by the sweep) and the final count.

### Step 8 — the deploy

Build after the bump. Gates green → commit → push. Commit subject: `born ruins — dead ground is cover, not holdings, mk2.62`.

## The owner's live check

Boot valleys (fresh seeds or NEW VALLEY in the sandbox) until each form has been seen: a shell, a stump, a mound, a chimney — about three born ruins a map. No flag over any of them; income unchanged in kind; a squad ordered through a mound walks through. Phone and desktop.

## Acceptance arithmetic

- The four exemplar counts: shell 26, stump 14, mound 10, chimney 5.
- 607 born ruins over seeds 1–200, all four forms drawn; T1b's equality pin holds over them (3,586 buildings, zero mismatches).
- The crossing: four alive, within 3.5m in 60 sim-seconds (scratch-measured worst: 1.53m).
- The one keystone re-pin matches the scratch-expected values exactly.
- Suite 2,062 → 2,075; smoke green.
