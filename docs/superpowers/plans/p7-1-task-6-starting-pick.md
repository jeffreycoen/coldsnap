# P7.1 Task 6 — The starting pick (mk1.68) — PLAN v2

*HISTORY (stamped 2026-08-20, owner's order): this document is a record of shipped work, not authority. Design truth lives in CLAUDE.md and the ACTIVE phase's plan documents; where this file disagrees with them, it is wrong.*

**THE BARE OPENING (owner, 2026-08-19):** nobody starts with anything. The player picks up to FOUR UNIQUE units from a pool of FIFTEEN — the 8 squad types, the Bison, the APC, and the 5 tower types — and places every pick BY HAND before TAKE COMMAND, each a ground tap within the homeland radius of his depot. The enemy is identical: no free armor, no home guard, no seeded sandbag rings — four seeded draws from the same fifteen (deduped: all four draws burn, duplicates field nothing, 2–4 distinct), auto-placed on his own homeland ring. Enemy towers FIGHT — the tower brain learns its team. The bell-10 hero tier stays the armor-replacement source; the bell-cadence defensive opening (his garrison growth from bell 1) stays.

This v2 supersedes v1 whole (v1's free-kit framing died at review). Suggested model: **Sonnet** — every mechanism below is specced; the re-teach sweep is licensed by name.

## The draw arithmetic (the contract, to the digit)

- OLD boot: 45 = regiment 2 + garrison 24 + commander 1 + fielded 18.
- NEW boot: **7 draws** = regiment 2 + commander 1 + **mirror 4** (unconditional, draw-then-clamp). Everything else that drew at boot is dead by ruling: the garrison (24) and the fielded start (18). The seeded bag rings drew from their own map-seed streams, never world.rng — they die without moving the count.
- The mirror's units place DRAW-FREE (vetted ring scans, derived walk phases). The player's picks place by hand — makeSquad/spawnSquadMembers/the hull and tower placers draw NOTHING.
- Muster-fixture scope (no regiment): 43 → **5**.

## Stated lines

- The pool of fifteen, by pick key: `sq_sniper, sq_rifles, sq_mg, sq_sappers, sq_mortars, sq_engineers, sq_runners, sq_breakers, hero_bison, hero_apc, mg, gun, mortar, rocket, frost` — every key already carries a T4 info card. Frost is in the pool honestly (its dead aura is the standing ARMS deferral).
- The enemy's mg team and engineers exist per the v1 rows, CARRIED into this plan: ENEMY_SPECS.mg/eng, MG_FIRE and its stepRifleman branch, the engineer stand and rifle-exclusion (Steps 5–7 below).
- Enemy picked hulls place through `parkArmor` (unchanged, fail-proof); enemy picked towers through a new `parkTower` (parkArmor's vetting shape, tower body, effRange cache, grid claim).
- THE TOWER BRAIN LEARNS ITS TEAM (Step 8): each tower targets the OPPOSITE team, sight-gates on its OWN side, stamps the attacker by team. CAREFUL's friendly-foul machinery stays team-1-only — enemy towers run discipline "free" (his careful doctrine is Enemy Front work). `marketCounts` widens tower counting to both teams (the one-market law; enemy walls join at Task 7).
- The placement flow: picks place in order by ground taps — vetted (within HOMELAND_R of the own depot flag; clear/flat per kind), refusals toast and wait. NO UNDO this task (a mis-tap stands — stated; the polish queue takes an undo if wanted). TAKE COMMAND completes only when every pick is placed; zero picks starts immediately (a bare opening is legal).
- `HOMELAND_R = 36` — provisional (F5), both sides, measured from the depot flag. Tower picks skip the build-rights (territory) gate — territory hasn't grown pre-start; they keep the leave-them-a-road connectivity refusal.
- `__DEPOTSTART__` force-starts bare (smoke unaffected). A RESUME never re-picks (the flow is pre-start only).
- The commander doctrine, the ferry, and the hero replacement already scan live bodies — they no-op gracefully when the relevant hull was never drawn.

## Required reading, in order

1. This plan, whole.
2. `src/depot/muster.js` — whole (gutted here; parkArmor reused; parkTower lands beside it).
3. `src/depot/units.js` — whole (the MG/eng rows land here; spawnUnit's shape for the mirror men).
4. `src/depot/specs.js:48-70` and `src/depot/market.js:34-70` — ENEMY_SPECS and the market counts.
5. `src/depot/DepotGame.jsx:110-177` (stepTowers), `:1049-1060` (the dying seedBags/parkArmor boot calls), `:1265-1275` (the musterFreshStart call site), `:1342-1393` (buildAt — the free tower placer mirrors its body work), `:2008-2076` (tapAt), `:3436-3443` (startGame), `:3991-4010` (the overlay).
6. `scripts/tests/09-reorg.mjs:55-82` — the T19 boot fixture (re-teaches); `scripts/tests/03-bell-polish.mjs:450-462` and `scripts/tests/06-troops-physics.mjs:245-255` — the seedBags call-site pins (re-teach: the rings are dead by ruling).
7. `scripts/tests/05-the-front.mjs:549-600` — the keystone (re-pins).
8. `scripts/tests/10-command-refit.mjs` — tail (new asserts; runs last, makeMap safe there).

## The sweep license (owner-approved in this plan)

Everything pinning the FREE OPENING re-teaches, each old→new reported:

- `09-reorg.mjs` T19: draws 43 → 5; "two player squads muster" → `S19.squads.length === 0` and no team-1 body; "fourteen standers" → the mirror's men alone (measured on seed 4242, reported); "books stayed honest" 52 → 60 (the guard's −8 died with the guard). The fixture's call gains the new grid/field/nextSeq arguments.
- `03-bell-polish.mjs:455-460` and `06-troops-physics.mjs:250` — the seedBags call-site pins re-teach to the new truth: DepotGame carries NO seedBags call (the export survives for Task 7's enemy lines).
- `05-the-front.mjs` keystone: hash AND draws re-pin old→new (3465970090 / 695 → measured; the T15 precedent — a reshaped opening legitimately differs).
- Dispatch grep for stragglers: any pin on the parked starting armor, the home guard's boot presence, boot draw counts (45/43), or the fielded start re-teaches under this license. (Era 07's armor/guard fixtures build their own bodies — self-contained, verified at plan time.)
- A failure asserting anything OTHER than the free opening stops the task.

## Steps

**Step 1 — muster.js: the fifteen-type pool and the draw-free man.** `SQUAD_SPECS` joins the squads.js import; `ENEMY_SPECS, TOWER_SPECS` join the specs.js import; `effRange` imports from `./state.js`. Above `musterFreshStart`:

```js
// P7.1 T6 (owner): THE BARE OPENING's pool — fifteen unique picks, one
// table both sides. kind routes the placer; tag/n shape the enemy's men.
export const PICK_POOL = [
  { key: "sq_rifles", kind: "squad", type: "rifles", tag: "", n: 4 },
  { key: "sq_runners", kind: "squad", type: "runners", tag: "fast", n: 4 },
  { key: "sq_breakers", kind: "squad", type: "breakers", tag: "heavy", n: 2 },
  { key: "sq_sappers", kind: "squad", type: "sappers", tag: "sapper", n: 2 },
  { key: "sq_mortars", kind: "squad", type: "mortars", tag: "gren", n: 2 },
  { key: "sq_sniper", kind: "squad", type: "sniper", tag: "sniper", n: 2 },
  { key: "sq_mg", kind: "squad", type: "mg", tag: "mg", n: 2 },
  { key: "sq_engineers", kind: "squad", type: "engineers", tag: "eng", n: 2 },
  { key: "hero_bison", kind: "hull", vtype: "bison" },
  { key: "hero_apc", kind: "hull", vtype: "apc" },
  { key: "mg", kind: "tower" }, { key: "gun", kind: "tower" }, { key: "mortar", kind: "tower" },
  { key: "rocket", kind: "tower" }, { key: "frost", kind: "tower" },
];
// One mirror man, DRAW-FREE (the spotter precedent): fixed ring ground via
// clearSlot, walk phase derived from his index — the boot stream never moves.
function spawnMirrorMan(world, x, z, tag, i) {
  const spec = ENEMY_SPECS[tag] || ENEMY_SPECS[""];
  const p = clearSlot(world, x, z, 0.28 + 0.35);
  const u = addBody(world, { kind: "unit", team: 2, mass: spec.mass, hx: spec.hx, hy: spec.hy, hz: spec.hz,
    x: p.x, z: p.z, y: world.field.heightAt(p.x, p.z) + spec.hy + 0.02, hp: spec.hp, friction: 0.38 });
  u.tag = tag; u.bounty = spec.bounty; u.maxHp = spec.hp;
  if (spec.dress) u.dress = spec.dress;
  u.smearStyle = "human"; u.brave = true;
  if (tag === "gren") u.utype = "gren";
  u.wph = (i * 1.7) % 6.28;
  u.hold = true; u.garrison = true;
  return u;
}
```

**Step 2 — muster.js: parkTower.** Beside parkArmor:

```js
// P7.1 T6: a picked tower parks like armor — vetted flat clear ring ground,
// the real body, the cached effRange, the grid claim. Draw-free.
export function parkTower(world, grid, field, depotT, team, towerType) {
  if (!depotT) return null;
  const spec = TOWER_SPECS[towerType];
  for (let rr = 12; rr <= 30; rr += 1.5) for (let k = 0; k < 16; k++) {
    const az = (k / 16) * Math.PI * 2 + 0.2;
    const bx = depotT.x + Math.sin(az) * rr, bz = depotT.z + Math.cos(az) * rr;
    const cell = grid.cellAt(bx, bz);
    if (!cell || cell.blocked || cell.ice || cell.water || cell.wallId) continue;
    if (slotBlockedPublic(world, bx, bz, 1.2)) continue;
    const g = grid.worldToGrid(bx, bz);
    const wp = grid.gridToWorld(g.gx, g.gz);
    const y = field.heightAt(wp.x, wp.z);
    const b = addBody(world, { kind: "tower", team, mass: 0, hx: 0.8, hy: spec.hy, hz: 0.8, x: wp.x, y: y + spec.hy, z: wp.z, hp: spec.hp });
    b.towerType = towerType; b.flagPole = true; b.maxHp = b.hp;
    b.effRange = effRange(world, { x: b.pos.x, y: b.pos.y + b.hy + 0.45, z: b.pos.z }, spec);
    if (team === 2) b.discipline = "free"; // his careful doctrine is Enemy Front work
    const c2 = grid.cells[grid.idx(g.gx, g.gz)];
    c2.blocked = true; c2.wallId = b.id; c2.bTeam = team;
    return b;
  }
  return null; // a hemmed ring parks nothing — the draw burned regardless
}
```

**Step 3 — muster.js: the boot block guts.** `musterFreshStart` re-signs to `(world, S, depotP, grid, field, nextApcSeq)` and its whole body becomes:

```js
export function musterFreshStart(world, S, depotP, grid, field, nextApcSeq) {
  // P7 T8: THE COMMANDER — one draw per war, after makeRegiment's 2.
  // A RESUME never reaches this branch.
  S.cmdr = cmdrOf(world.rng);
  // P7.1 T6 (owner): THE BARE OPENING — his four picks, the same fifteen-
  // type pool as the player's, deduped draw-then-clamp (all four draws
  // always burn; duplicates field nothing). Boot: exactly 7 draws, any seed.
  const mirrorPicks = [];
  for (let d = 0; d < 4; d++) mirrorPicks.push(PICK_POOL[Math.min(PICK_POOL.length - 1, Math.floor(world.rng() * PICK_POOL.length))]);
  const depotE = TOWN.find((tt) => tt.depot && tt.team === 2);
  if (!depotE || !grid || !field) return;
  const gR = Math.hypot(depotE.nx, depotE.nz) * MASON.pitch / 2 + 3.5;
  const fielded = new Set();
  let mi = 0;
  for (const pick of mirrorPicks) {
    if (fielded.has(pick.key)) continue; // deduped like the player (owner)
    fielded.add(pick.key);
    if (pick.kind === "hull") { parkArmor(world, grid, field, depotE, 2, pick.vtype, nextApcSeq || (() => 1)); continue; }
    if (pick.kind === "tower") { parkTower(world, grid, field, depotE, 2, pick.key); continue; }
    let pairLead = null;
    for (let k = 0; k < pick.n; k++) {
      const a = (mi / 16) * Math.PI * 2 + 2.0;
      const u = spawnMirrorMan(world, depotE.x + Math.sin(a) * gR, depotE.z + Math.cos(a) * gR, pick.tag, mi);
      mi++;
      if (pick.tag === "sniper") { // the pair's roles and link, draw-free
        if (!pairLead) { pairLead = u; u.role = "sniper"; u.bounty = 30; }
        else { u.role = "spotter"; u.bounty = 15; u.pairId = pairLead.id; pairLead.pairId = u.id; }
      }
    }
  }
}
```

The home-guard block, its `reg.heads -= 8` line, the old player fielded block, and the old enemy fielded block ALL die.

**Step 4 — DepotGame: the free opening dies at boot.** In the fresh-boot branch: DELETE the two `seedBags(...)` calls (~1049-1050) and the four `parkArmor(...)` calls (~1057-1058); the muster call becomes `musterFreshStart(world, S, depotP, grid, field, nextApcSeq);`. `stampBag` stays (resumed bags and engineer lines use it); the `parkArmor` import stays (hero deliveries); the `seedBags` import LEAVES DepotGame (nothing calls it — its export survives in muster.js for Task 7).

**Step 5 — specs.js: his two new rows.** `ENEMY_SPECS` gains, after `sniper`:

```js
  // P7.1 T6 (owner): the pick pool is the player's full list — his MG team
  // and his engineers join the roster. Bounties provisional (F5).
  mg:  { mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, hp: 58, bounty: 8, speed: 3.2, gain: 14, label: "mg team" },
  eng: { mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, hp: 58, bounty: 6, speed: 3.2, gain: 14, label: "engineer" },
```

**Step 6 — units.js: the MG burst and the unarmed shovel.** After `SNIPER_FIRE`:

```js
// P7.1 T6: his MG team fires the player's own MG table — one table, both
// sides (the SNIPER_FIRE pattern; volley carries the burst).
export const MG_FIRE = { ...INFANTRY_ARMS.mg, blastR: 0.3, kv: 0.5, cd: INFANTRY_ARMS.mg.fireRate, volley: INFANTRY_ARMS.mg.burst };
```

In `stepRifleman`: `const fspec = sniper ? SNIPER_FIRE : u.tag === "mg" ? MG_FIRE : ENEMY_FIRE.rifle;` and `u.fireCd = ((sniper || u.tag === "mg") ? fspec.cd : u.tag === "heavy" ? 1.1 : 1.5) + world.rng() * 0.5;` — nothing else changes. In `stepUnits`, after the sapper dispatch:

```js
    // P7.1 T6 (owner): his engineers — unarmed shovels until Task 7 arms
    // their build lines. A held engineer stands; an unheld one marches.
    if (u.tag === "eng" && u.hold) {
      u.settled = true;
      u.v.x *= 1 - Math.min(1, 6 * dt); u.v.z *= 1 - Math.min(1, 6 * dt);
      continue;
    }
```

and the rifle dispatch gains the exclusion: `if (u.tag !== "gren" && u.tag !== "sapper" && u.tag !== "eng" && stepRifleman(...)) continue;`

**Step 7 — market.js: the families and the two-army towers.** `FAMILY_OF_TAG` gains `mg: "mgteam", eng: "engineer"`. The tower clause drops its team check: `else if (b.kind === "tower" && FAMILY_OF_TOWER[b.towerType]) add(FAMILY_OF_TOWER[b.towerType], 1);` — one market, both armies' standing stock (walls stay team-1 until Task 7).

**Step 8 — the tower brain learns its team.** In DepotGame's `stepTowers`, after the possession skip: `const tTeam = b.team === 2 ? 2 : 1; const foeTeam = tTeam === 1 ? 2 : 1;` — then: both `e.team !== 2`/`best.team !== 2` checks become `!== foeTeam`; both `fieldReaches(T, c.u, c.v, 1)` calls become `(T, c.u, c.v, tTeam)`; the scan pool becomes `world._L ? (foeTeam === 2 ? world._L.foes : world._L.friends) : world.bodies`; the CAREFUL clause gains `tTeam === 1 &&` before `disc !== "free"`. In `state.js`, `towerShot`'s shooterFire opts become `{ high, attacker: tower.team === 2 ? "enemy" : "player", owner: tower.id }`.

**Step 9 — DepotGame: pick and place.**

- `const HOMELAND_R = 36; // provisional (F5)` at mount scope beside the placement helpers; component state `const [picks, setPicks] = useState([]);` (POOL KEYS, unique toggles, max 4).
- The overlay's pick row: fifteen slots (the 8 `sq_`, the 2 `hero_`, the 5 towers off PALETTE), the v1 toggle behavior (green when picked, re-tap or chip removes, fifth/duplicate refused), each slot with its ⓘ; the chip row beneath; the "none picked" line reads `none picked — a bare depot is a legal start`.
- `startGame` becomes the two-stage gate:

```js
  const startGame = () => {
    const S = stateRef.current; if (!S) return;
    if (S.audio) S.audio.ensure();
    if (picks.length > 0 && S._placeQueue == null) {
      // P7.1 T6: PLACE MODE — the overlay steps aside; each pick lands by
      // a ground tap inside the homeland. START completes when all placed.
      S._placeQueue = picks.slice();
      setHud((h) => ({ ...h, placing: S._placeQueue[0] }));
      return;
    }
    S.started = true;
    setHud((h) => ({ ...h, started: true, placing: null }));
  };
```

- The overlay's render gate becomes `!hud.started && !hud.placing && !fatal`; while `hud.placing` a PLACE CHIP renders top-center: `PLACE: <PALETTE_BY_KEY[hud.placing].label> — tap ground near your depot (<n> of <picks.length>)`; when the queue empties (`hud.placing === "done"`), the chip carries a TAKE COMMAND button calling `startGame`.
- `tapAt` gains, at its top (before the `!S.started` early return):

```js
        // P7.1 T6: PLACE MODE — pre-start ground taps put the picks down.
        if (!S.started && S._placeQueue && S._placeQueue.length) {
          const p0 = groundPoint(cx, cy);
          if (p0) placePick(p0);
          return;
        }
```

- `placePick(p)` (mount scope, beside placeSquadAt), with `depotT` = the player depot TOWN entry already computed for S.focus:

```js
      // P7.1 T6: one picked unit onto the ground — vetted per kind, free
      // (the starting kit costs nothing), inside the homeland only.
      const placePick = (p) => {
        const key = S._placeQueue[0];
        const pk = PICK_POOL.find((x) => x.key === key);
        if (!pk) { S._placeQueue.shift(); return; }
        if (Math.hypot(p.x - depotP.x, p.z - depotP.z) > HOMELAND_R) { toast("TOO FAR FROM THE DEPOT"); return; }
        const g = grid.worldToGrid(p.x, p.z);
        if (!grid.inBounds(g.gx, g.gz)) { toast("OFF THE FIELD"); return; }
        const cell = grid.cells[grid.idx(g.gx, g.gz)];
        const wp = grid.gridToWorld(g.gx, g.gz);
        if (pk.kind === "squad") {
          if (cell.water || cell.ice || cell.blocked || cell.wallId) { toast("NO GROUND"); return; }
          const sq = makeSquad(S.nextSquadId++, pk.type, 1, wp.x, wp.z);
          spawnSquadMembers(world, sq);
          S.squads.push(sq);
        } else if (pk.kind === "hull") {
          if (cell.water || cell.ice || cell.blocked || cell.wallId) { toast("NO GROUND"); return; }
          const spec = pk.vtype === "apc" ? APC : BISON;
          if (!armorStable(field, wp.x, wp.z, spec)) { toast("TOO STEEP TO PARK"); return; }
          if (slotBlockedPublic(world, wp.x, wp.z, Math.hypot(spec.hx, spec.hz) + 1.0)) { toast("NO ROOM"); return; }
          const v = addBody(world, { kind: "vehicle", team: 1, mass: spec.mass, hx: spec.hx, hy: spec.hy, hz: spec.hz,
            x: wp.x, y: field.heightAt(wp.x, wp.z) + spec.hy + 0.05, z: wp.z, hp: spec.hp, friction: 0.85,
            q: heading(null, Math.atan2(-wp.x, -wp.z)) });
          v.armor = spec.armor; v.vtype = pk.vtype; v.maxHp = spec.hp;
          v.homeX = wp.x; v.homeZ = wp.z; v.sleeping = true;
          if (pk.vtype === "apc") v.apcSeq = nextApcSeq();
          v.drv = pk.vtype === "apc" ? "apc" : "armor"; v.depotDrive = "auto"; v.order = "defend"; v.tracks = "careful"; v.driver = "player";
        } else { // tower — free, rights-free (territory hasn't grown), road still owed
          if (cell.water || cell.ice || cell.blocked || cell.wallId) { toast("NO GROUND"); return; }
          cell.blocked = true;
          if (!checkConnectivity(grid, SPAWN_POINTS, objG.gx, objG.gz)) { cell.blocked = false; toast("Leave them a road"); return; }
          const spec = TOWER_SPECS[pk.key];
          const b = addBody(world, { kind: "tower", team: 1, mass: 0, hx: 0.8, hy: spec.hy, hz: 0.8, x: wp.x, y: field.heightAt(wp.x, wp.z) + spec.hy, z: wp.z, hp: spec.hp });
          b.towerType = pk.key; b.flagPole = true; b.maxHp = b.hp;
          b.effRange = effRange(world, { x: b.pos.x, y: b.pos.y + b.hy + 0.45, z: b.pos.z }, spec);
          cell.wallId = b.id; cell.bTeam = 1;
          recomputeFlow();
        }
        S._placeQueue.shift();
        const next = S._placeQueue[0];
        setHud((h) => ({ ...h, placing: next || "done" }));
        toast(next ? "PLACED — NEXT: " + (PALETTE_BY_KEY[next] || {}).label : "ALL PLACED — TAKE COMMAND");
      };
```

(`PICK_POOL` and `heading` import into DepotGame; `armorStable` is already imported from muster.js.)

**Step 10 — the asserts.** Appended to `10-command-refit.mjs` (imports gain `musterFreshStart, parkTower, PICK_POOL` from muster.js; `makeMap, TOWN` from mapgen.js; `stepUnits` on the units.js line; `straightGrid` from shared.mjs; `explode` already there):

```js
// ---- P7.1 T6 v2: THE BARE OPENING
{
  makeMap(4242);
  const flatF6 = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (x, z, o) => { o.x = 0; o.y = 1; o.z = 0; return o; } };
  const w = makeWorld({ field: flatF6, seed: 4242 });
  let draws = 0; const raw = w.rng;
  w.rng = () => { draws++; return raw(); };
  const S6 = { reg: { heads: 60 }, squads: [], nextSquadId: 1, cmdr: null };
  const G6 = mkGridA(); // the era-07 mini-grid helper already local to this file
  musterFreshStart(w, S6, TOWN.find((t) => t.depot && t.team !== 2), G6, flatF6, () => 1);
  ok("T6v2: the fresh start draws exactly 5 (commander 1 + mirror 4)", draws === 5, draws);
  ok("T6v2: nothing player-side fields at boot", S6.squads.length === 0 && !w.bodies.some((b) => b.team === 1 && b.alive));
  ok("T6v2: the pool is fifteen, unique keys", PICK_POOL.length === 15 && new Set(PICK_POOL.map((p) => p.key)).size === 15);
  ok("T6v2: his picks fielded something", w.bodies.some((b) => b.team === 2 && b.alive));
}
// ---- P7.1 T6 v2: his MG team and his shovels behave (v1's rows)
{
  const w = makeWorld({ field: flatF, seed: 61 }); w.depotCombat = true;
  const mgMan = spawnUnit(w, { x: 0, z: 0 }, "mg");
  addBody(w, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x: 0, y: 0.74, z: 10, hp: 58, friction: 0.5 });
  const ev0 = w.events.length;
  for (let i = 0; i < 120 * 5; i++) { stepUnits(w, straightGrid(0, 1), identFwdDir, null); stepWorld(w); }
  ok("T6v2: his MG team fires the burst", w.events.slice(ev0).some((e) => e.type === "muzzle" && e.weapon === "mg"));
  const w2 = makeWorld({ field: flatF, seed: 62 }); w2.depotCombat = true;
  const engMan = spawnUnit(w2, { x: 0, z: 0 }, "eng"); engMan.hold = true;
  addBody(w2, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x: 0, y: 0.74, z: 8, hp: 58, friction: 0.5 });
  const ev2 = w2.events.length;
  for (let i = 0; i < 120 * 5; i++) { stepUnits(w2, straightGrid(0, 1), identFwdDir, null); stepWorld(w2); }
  ok("T6v2: his engineer stands unarmed", w2.events.slice(ev2).filter((e) => e.type === "muzzle").length === 0 && Math.hypot(engMan.pos.x, engMan.pos.z) < 2);
}
// ---- P7.1 T6 v2: the tower brain's team lesson (wiring pins — stepTowers
// lives in DepotGame.jsx, unimportable headlessly; the audit precedent)
{
  const src = fs.readFileSync("src/depot/DepotGame.jsx", "utf8");
  ok("T6v2 wiring: stepTowers derives its team", /const tTeam = b\.team === 2 \? 2 : 1/.test(src));
  ok("T6v2 wiring: acquisition hunts the foe team", /e\.team !== foeTeam/.test(src));
  ok("T6v2 wiring: sight gates on the tower's own side", /fieldReaches\(T, c\.u, c\.v, tTeam\)/.test(src));
  ok("T6v2 wiring: careful stays team-1 machinery", /tTeam === 1 && disc !== "free"/.test(src));
  ok("T6v2 wiring: parkTower stands in muster.js", /export function parkTower\(world, grid, field, depotT, team, towerType\)/.test(fs.readFileSync("src/depot/muster.js", "utf8")));
}
```

(`mkGridA` exists in this file from the audit's APC-patrol block; if its size is under 40 cells a side, widen it there — one grid for both, reported.)

**Step 11 — the re-teaches** per the sweep license, each old→new in the report.

**Step 12 — version.** `src/version.js`: `mk1.67` → `mk1.68`. Build AFTER the bump.

## Gates — run ONLY these

1. `node scripts/depot-test.mjs` — 0 failed; the new total reported (1416 + the new asserts; re-teaches keep their counts). Licensed movements ONLY (the sweep list). Anything else red: STOP.
2. `node scripts/smoke.mjs` — preview pattern, all green, mark mk1.68 (`__DEPOTSTART__` starts bare; boot unaffected).
3. `node scripts/depot-lint.mjs` — clean (every new draw is world.rng; the placers draw nothing).

Green → commit `src/depot/muster.js`, `src/depot/specs.js`, `src/depot/units.js`, `src/depot/market.js`, `src/depot/state.js`, `src/depot/DepotGame.jsx`, the re-taught test files (`09-reorg.mjs`, `03-bell-polish.mjs`, `06-troops-physics.mjs`, `05-the-front.mjs`), `scripts/tests/10-command-refit.mjs`, `src/version.js` — subject "the war opens on your terms: the starting pick (mk1.68)" — standing trailers, push.

## Report requirements

Read-confirmation (eight items), one outcome line, then bullets: each step; EVERY re-teach and re-pin old→new (T19's numbers, the bag-ring pins, the keystone's hash and draws); each gate with exact counts; commit hash. Every deviation its own labeled bullet. The owner's live acceptance: pick four of fifteen, place each by hand inside the homeland, TAKE COMMAND, and meet an enemy opening drawn from the same fifteen — some wars, his towers firing back. Phone and desktop.

---

# AMENDMENT 1 — the ticker wipes place mode (mk1.69, hotfix)

Found live by the owner (2026-08-19): picks selected, placement skipped. THE DEFECT IS THE PLAN'S: the hud ticker rebuilds the whole hud from a full literal every 120ms, and the plan never put `placing` in that literal — place mode survives one tick, the overlay returns, and the next TAKE COMMAND tap starts the war past the queue.

**Step 1.** In the hud tick's literal (the line `started: S.started, gameOver: S.gameOver, victory: S.victory,`), add directly after it:

```js
              placing: S._placeQueue ? (S._placeQueue[0] || "done") : null, // P7.1 T6 A1: place mode must survive the ticker
```

**Step 2.** `src/version.js`: `mk1.68` → `mk1.69`. Build AFTER the bump.

**Gates — run ONLY these:** `node scripts/depot-test.mjs` (1427/0, zero movement), `node scripts/smoke.mjs` (preview pattern, mark mk1.69), `node scripts/depot-lint.mjs`. Green → commit `src/depot/DepotGame.jsx` + `src/version.js`, subject "place mode survives the ticker (mk1.69)", standing trailers, push. Task 7 shifts to mk1.70.

---

# AMENDMENT 2 — the chip outlives the start (mk1.70, hotfix)

Owner's live find (2026-08-19, screenshot): TAKE COMMAND on the place chip starts the war but the chip stays. Amendment 1's ticker line reads `S._placeQueue ? ... : null` — after the last placement the queue is an EMPTY ARRAY, which is truthy, so the ticker re-asserts `placing: "done"` forever. The fix: starting the war retires the queue.

**Step 1.** In `startGame`'s start branch, directly before `S.started = true;`, add:

```js
    S._placeQueue = null; // P7.1 T6 A2: the war has begun — the ticker must yield nothing
```

**Step 2.** `src/version.js`: `mk1.69` → `mk1.70`. Build AFTER the bump.

**Gates — run ONLY these:** `node scripts/depot-test.mjs` (1427/0, zero movement), `node scripts/smoke.mjs` (preview pattern, mark mk1.70), `node scripts/depot-lint.mjs`. Green → commit `src/depot/DepotGame.jsx` + `src/version.js`, subject "the chip stands down (mk1.70)", standing trailers, push. Task 7 shifts to mk1.71.
