# THE TALL ORDER — task plan (proposed mark mk2.02, combined)

**Goal.** One landing, all ruled 2026-08-21: the footprint polygon, ground aim at the surface, the automatic lob (both tanks + tower GUN), the convoy lockout, two-meter men through one shared body table — and the roster surgery: grenadiers are their own troop with their own throw, breakers become grenadiers, the enemy heavy is excised with sappers taking its breach role, the enemy gains a mortar team, and rocket troops replace runners on both sides.

**Suggested model:** Sonnet 5 — every code block is complete; the work is mechanical placement and gate runs. The task is LARGE; the agent works the steps strictly in order and stops on any unlisted failure.

**Symmetry.** One body table (MAN), one arms table (INFANTRY_ARMS) — both sides' grenadiers, rocket troops, and mortars read the same rows. The lob rides `spec.occl` in `shooterFire`, every shooter both sides. Roster after this task, fully paired: conscript↔rifles, rocket↔rockets, gren↔grenadiers, mortar↔mortars, sapper↔sappers, sniper↔pair, mg/eng/medic/mechanic↔same. No heavy, no fast, anywhere.

**Rulings recorded (owner, 2026-08-21):** grenadiers are not mortars — they get a distinct short throw, one spec both sides. Breakers become grenadiers; the enemy heavy is excised everywhere and sappers take its breach signal. The enemy gains a mortar team. Rocket troops replace runners on both sides. Tanks + tower GUN lob automatically; rocket keeps the mk1.74 gentle arc. Every man 2 m, one MAN table, player's numbers seed it. Convoy holds during possession, opens on release. Old saves are irrelevant (cannot be used).

**Design dials (all provisional F5, the owner tunes live):** the grenade (range 12, blast 2.0, cadence 3.2 s); the shoulder rocket (the tower rocket's round at fireRate 8.8, range 18); GRENADIER SQUAD n 4 cost 40; ROCKET TEAM n 2 cost 45; enemy mortar/rocket bounties 8; ai weights and market K/base seats as written below.

**Knowing:** enemy bodies snap to MAN.rifle (grenadier hp 66→58, sapper 30→58, marksman 44→58, conscript mass/width); per-side speeds unchanged (audit = the roster-mirror closing task); the lobbed 85 m/s shell hangs ~17 s (physical truth); `ENEMY_FIRE.lob` STAYS as a table row (its 01/10 test pins survive) but nothing reads it after this task; `SIGHT_TARGET_H`/`TARGET_H` stay.

## Required reading (verified against the live tree)

- `src/depot/specs.js:45-110, 150-200, 237-272` — ENEMY_SPECS, fire tables, tiers/PICK keys/HAND_TAGS, INFANTRY_ARMS
- `src/depot/squads.js:33-70` — SQUAD_SPECS
- `src/depot/state.js:387-455, 560-570, 706-760, 1128-1135, 1509-1520` — shooterFire, possessed fire, spawnSquadMembers, ENEMY_TIERS, the bell deal
- `src/depot/drivers.js:526-560`; `src/depot/units.js:20-55, 215-232, 265-280, 334-360, 480-545, 583-625` — spawn, rifleman, grenadier, dispatch, breaker ram
- `src/depot/ai.js:1-95, 270-280`; `src/depot/market.js:18-45`; `src/depot/muster.js:240-262`
- `src/depot/sight.js:29-40`; `src/depot/accuracy.js:303-380`
- `src/depot/DepotGame.jsx:592-598, 748-755, 1576-1582, 1891-1921, 3660-3705`; `src/depot/infocards.js:33-38`
- `src/render/renderer.js:1318-1350, 1840-1845`; `src/render/troopkit.js:115-170`
- Tests: `04:1-15, 1546-1551, 2055-2090, 2190-2205`; `07:660-675, 780-920, 1085-1240`; `01:655-670, 820-830`; `02:325-420`; `03:270-276`; `08:35-55`; `10:38-42, 240-250, 395-402`; `11:195-210`

## Trap notes

- Four renderer-block pins re-teach to the new `setReticle(on, x, z, y, r, hit, pts)` signature (sweep table A).
- The mk2.01(i) pins (sig9 line, pr9 line, `aim.y != null ?…heightAt(aim.x, aim.z)` fragments) must SURVIVE — the replacements keep those texts.
- `shooterFire`'s `const high` becomes `let`; the auto line sits BEFORE the lead loop.
- The troop stretch and everything roster touches is depot-side only; golden must stay green (demo modes never read these tables).
- `04:1880` T8(b) "340 kg breaker-class body" is a physics fixture via addBody — untouched.
- `09`/`harness` "runner" hits are the test-runner, not troops — untouched.
- `01:660-661` and `10:383` pin `ENEMY_FIRE.lob` literals — the row stays; do not delete it.
- Line numbers are anchors; match by quoted code; stop if the quoted code cannot be found.

## The sweep license

Everything below is licensed BY THIS TABLE ONLY; any other failure stops the task. Removals are tests whose subject this task deletes; re-teaches keep their assert's meaning under the new roster.

**A — renderer signature re-teaches (4, in place):** `04:1550` T5(a); `04:2061` mk1.99(h) block regex; `04:2078-2081` mk2.00(c) (also: cond → `/PlaneGeometry\(0\.12, 0\.85\)/.test(block) && /0xf0143c/.test(block)`, label `…the crosshair draws in crimson — the band is dead (re-taught mk2.02)`); `04:2197` mk2.01(i) block regex.

**B — roster removals (subjects deleted):** `02:346` breaker-kit pin, `02:347` runner-kit pin, `02:355` enemy-runner palette row, `02:363` enemy-breaker palette row, `02:412-413` breaker-bulk fog pin; `03:273` ram-source pin; `07` T7(b) runner-speed check (`:813`), T7(d) grind check (`:847`), T7(e) both ram checks (`:868` and its team-2 partner in the same block, with their fixtures).

**C — roster re-teaches (fixtures/pins renamed to the new roster, asserted meaning kept):** `01:664` roster pin → keys `["", "rocket", "gren", "sapper", "mortar"]` labels conscript/rocket team/grenadier/sapper/mortar team; `01:824` fixture `"fast"` → `"rocket"`; `02:331` kit fixture rows drop `tag:"heavy"`/`tag:"fast"` entries; `04` mk2.02 block written for the final roster (step 1); `07:670` bag → `["gren", "", "rocket", "sapper", "", "mortar", "sniper", ""]`; `07:787-789` T7(a) pins → rockets n 2 / grenadiers n 4 / `INFANTRY_ARMS.rockets.weapon === "rocket" && INFANTRY_ARMS.grenadiers.weapon === "mortar"`; `07:804-813` the runner-time fixture dies with T7(b) (Removals); `07:875-884` T7(g) → families `rocketteam` counting both sides' rocket men; `07:901-911` T7(h) → `rockets`/`grenadiers` volleys fire; `07:1092-1235` T9(e) fixtures/asserts → `rockets` (n 2) + `grenadiers` (n 4), tags `rocket`×2 + `gren`×4, tag list `:1117` → `["", "rocket", "gren", "sapper", "mortar", "sniper", "tank", "hero_bison", "hero_apc"…]` (keep its tail as found); `08:47-48` fixture → `["rockets", "grenadiers"]` with their azimuths kept; `10:40` ARMED → `["sniper", "rifles", "mg", "mortars", "rockets", "grenadiers"]`; `10:244` and `10:399` key lists → `sq_rockets`/`sq_grenadiers`; `11:199` → `{ unlocked: ["rocket"], towers: ["gun"] }`. Every re-teach reported old → new in the landing report; a hit outside this list stops the task.

## Steps

### Step 1 — baseline, then the failing tests

`node scripts/gate.mjs depot-test` clean; record PASS (expected 1733). Apply sweep tables A, B, C. Test-file imports (04): line 3 gains `shooterFire`; line 6 gains `ENEMY_SPECS, MAN, BISON_FIRE`; line 8 gains `SQUAD_SPECS`. Append after `// ==== end THE TRUE RETICLE (mk2.01)`:

```js
// ==== THE TALL ORDER (mk2.02) ===============================================
// Footprint polygon, surface aim, automatic lob, convoy lockout, 2m men on
// one shared body table, and the ruled roster: grenadiers with their own
// throw, rocket troops for runners, mortars for the enemy, no heavy at all.
{
  const flatField = { heightAt: () => 0, dirty: false, normalAt: (nx, nz, out) => { out.x = 0; out.y = 1; out.z = 0; } };
  const idUV = (x, z) => ({ u: x, v: z });
  const bareSG = () => ({ nx: 32, nz: 32, cs: 2, halfU: 32, halfV: 32,
    seen1: new Uint8Array(32 * 32).fill(1), seen2: new Uint8Array(32 * 32),
    gnd: new Float32Array(32 * 32), occ: new Float32Array(32 * 32).fill(-Infinity) });

  // (a) the footprint: 16 landed points, each on the dirt it landed on.
  {
    const pr = predictRing(bareSG(), { x: -20, y: 1.5, z: 0 }, { x: 0, y: 0, z: 0 }, { projSpeed: 90, occl: "arc", windF: 0 }, 0.02, null, idUV);
    ok("TALL ORDER mk2.02(a): the predictor returns the 16-point footprint", Array.isArray(pr.pts) && pr.pts.length === 16, pr.pts && pr.pts.length);
    ok("TALL ORDER mk2.02(a): on flat dirt every footprint point lies on the ground", pr.pts.every((p) => Math.abs(p.y) < 1e-6));
  }
  // (b) surface aim: the four possessed tgt lines carry the surface, no phantom.
  {
    const stateSrc = fs.readFileSync(new URL("../../src/depot/state.js", import.meta.url), "utf8");
    const driversSrc = fs.readFileSync(new URL("../../src/depot/drivers.js", import.meta.url), "utf8");
    ok("TALL ORDER mk2.02(b) source pin: ground aim targets the surface in all four fire paths",
      (stateSrc.match(/hy: sy - world\.field\.heightAt\(aim\.x, aim\.z\)/g) || []).length === 2 &&
      (driversSrc.match(/hy: sy - world\.field\.heightAt\(aim\.x, aim\.z\)/g) || []).length === 2);
  }
  // (c) THE AUTOMATIC LOB: clear line flat, walled line takes the mortar root.
  {
    const world = makeWorld({ field: flatField, seed: 81 });
    world.depotCombat = true;
    const shooter = addBody(world, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 1.0, hz: 0.28, x: 0, y: 1.0, z: 0, hp: 58 });
    const tgt = { pos: { x: 20, y: 0, z: 0 }, v: { x: 0, y: 0, z: 0 }, hy: 0 };
    world.events.length = 0;
    shooterFire(world, shooter, { x: 0, y: 1.5, z: 0 }, tgt, { ...BISON_FIRE.gun }, { attacker: "player", owner: shooter.id });
    const flat = world.events.find((e) => e.type === "muzzle");
    ok("TALL ORDER mk2.02(c): a clear line fires the flat root", flat && flat.dy < 0.35, flat && flat.dy);
    addBody(world, { kind: "wall", team: 1, mass: 0, hx: 0.9, hy: 1.8, hz: 0.2, x: 10, y: 1.8, z: 0, hp: 200 });
    world.events.length = 0;
    shooterFire(world, shooter, { x: 0, y: 1.5, z: 0 }, tgt, { ...BISON_FIRE.gun }, { attacker: "player", owner: shooter.id });
    const lob = world.events.find((e) => e.type === "muzzle");
    ok("TALL ORDER mk2.02(c): a wall across the line takes the mortar root", lob && lob.dy > 0.7, lob && lob.dy);
  }
  // (d) the grant is exact; the rocket tower keeps the gentle arc.
  ok("TALL ORDER mk2.02(d): both tank guns and the tower GUN lob automatically",
    BISON_FIRE.gun.occl === "auto" && ENEMY_FIRE.tank.occl === "auto" && TOWER_SPECS.gun.occl === "auto");
  ok("TALL ORDER mk2.02(d): the rocket tower keeps the gentle arc", TOWER_SPECS.rocket.occl === "arc");
  // (e) THE CONVOY WAITS: the bell gate and the release-opens, pinned.
  {
    const stateSrc = fs.readFileSync(new URL("../../src/depot/state.js", import.meta.url), "utf8");
    const gameSrc = fs.readFileSync(new URL("../../src/depot/DepotGame.jsx", import.meta.url), "utf8");
    ok("TALL ORDER mk2.02(e) source pin: the bell's deal never opens over a live possession",
      /M\.cardUp = M\.hand\.length > 0 && !S\.possess;/.test(stateSrc));
    ok("TALL ORDER mk2.02(e) source pin: release opens the held deal",
      /if \(S\.manifest && S\.manifest\.hand\.length && !S\.manifest\.cardUp\) \{ S\.manifest\.cardUp = true;/.test(gameSrc));
  }
  // (f) ONE BODY: every enemy row IS MAN.rifle's body, and 2m.
  {
    const FIELDS = ["mass", "hx", "hy", "hz", "hp"];
    ok("TALL ORDER mk2.02(f): every enemy body reads the one MAN row",
      Object.keys(ENEMY_SPECS).every((k) => FIELDS.every((fd) => ENEMY_SPECS[k][fd] === MAN.rifle[fd])));
    ok("TALL ORDER mk2.02(f): the man stands two meters", MAN.rifle.hy === 1.0);
  }
  // (g) the 2m eye rides at 1.8m.
  {
    const e = eyeOf({ kind: "unit", pos: { x: 0, y: 1.0, z: 0 } });
    ok("TALL ORDER mk2.02(g): the infantry eye rides at 1.8m", Math.abs(e.y - 1.8) < 1e-9, e.y);
  }
  // (h) the drawn man stretches to the 2m body, depot-gated.
  {
    const rendSrc = fs.readFileSync(new URL("../../src/render/renderer.js", import.meta.url), "utf8");
    ok("TALL ORDER mk2.02(h) source pin: depot troops draw at the 2m stretch, demo untouched",
      /KIT\.bh \* \(world\.depotCombat \? 2\.0 \/ 1\.44 : 1\)/.test(rendSrc));
  }
  // (i) THE ROSTER: paired, armed, and the old names gone.
  {
    ok("TALL ORDER mk2.02(i): the rosters pair one-to-one, no heavy, no fast",
      !ENEMY_SPECS.heavy && !ENEMY_SPECS.fast && !!ENEMY_SPECS.mortar && !!ENEMY_SPECS.rocket &&
      !SQUAD_SPECS.runners && !SQUAD_SPECS.breakers && !!SQUAD_SPECS.rockets && !!SQUAD_SPECS.grenadiers);
    ok("TALL ORDER mk2.02(i): the grenade is its own throw — short, lofted, not the mortar table",
      INFANTRY_ARMS.grenadiers.range === 12 && INFANTRY_ARMS.grenadiers.occl === "lofted" &&
      INFANTRY_ARMS.grenadiers.range < INFANTRY_ARMS.mortars.range);
    ok("TALL ORDER mk2.02(i): the shoulder rocket is armed on both sides' row",
      INFANTRY_ARMS.rockets.weapon === "rocket" && INFANTRY_ARMS.rockets.kind === "shell");
    ok("TALL ORDER mk2.02(i): the hand maps the new keys to the new tags",
      HAND_TAGS.sq_rockets === "rocket" && HAND_TAGS.sq_grenadiers === "gren" && HAND_TAGS.sq_mortars === "mortar" && HAND_TAGS.sq_breakers === undefined && HAND_TAGS.sq_runners === undefined);
  }
  // (j) the enemy's new hands fire: a mortar-team man lobs the mortar table,
  // a rocket man fires the rocket row — through the real branches.
  {
    const stateSrc = fs.readFileSync(new URL("../../src/depot/units.js", import.meta.url), "utf8");
    ok("TALL ORDER mk2.02(j) source pin: the grenadier/mortar branch reads the shared arms table",
      /INFANTRY_ARMS\[u\.tag === "mortar" \? "mortars" : "grenadiers"\]/.test(stateSrc));
    ok("TALL ORDER mk2.02(j) source pin: the rocket man fires the shared rocket row",
      /u\.tag === "rocket" \? INFANTRY_ARMS\.rockets/.test(stateSrc));
    ok("TALL ORDER mk2.02(j) source pin: the breaker ram is dead",
      !/stepBreakerRam/.test(stateSrc) && !/BREAKER_GRIND/.test(stateSrc));
  }
}
// ==== end THE TALL ORDER (mk2.02) ===========================================
```

(04's specs import already carries `HAND_TAGS`? If not, line 6 gains it too.) Run depot-test. Expected: FAIL.

### Step 2 — bodies, arms, tiers, keys (specs.js)

Above ENEMY_SPECS add:

```js
// mk2.02: ONE BODY TABLE (owner) — every man, both sides, reads this row;
// the player's numbers seed it and every man stands 2m. Speeds/bounties
// stay per-side rows; the speed audit is the roster-mirror closing task.
export const MAN = {
  rifle: { mass: 80, hx: 0.28, hy: 1.0, hz: 0.28, hp: 58 },
};
```

ENEMY_SPECS becomes (comment blocks between rows stay; `fast` and `heavy` rows DELETED; two rows born):

```js
export const ENEMY_SPECS = {
  "":     { ...MAN.rifle, bounty: 4,  speed: 3.2, gain: 14, label: "conscript" },
  gren:   { ...MAN.rifle, bounty: 8,  speed: 2.6, gain: 12, label: "grenadier" },
  sapper: { ...MAN.rifle, bounty: 7,  speed: 3.8, gain: 16, label: "sapper" },
  sniper: { ...MAN.rifle, bounty: 45, speed: 2.9, gain: 14, label: "marksman" },
  mg:  { ...MAN.rifle, bounty: 8, speed: 3.2, gain: 14, label: "mg team" },
  eng: { ...MAN.rifle, bounty: 6, speed: 3.2, gain: 14, label: "engineer" },
  medic: { ...MAN.rifle, bounty: 8, speed: 3.2, gain: 14, label: "medic" },
  mechanic: { ...MAN.rifle, bounty: 8, speed: 3.2, gain: 14, label: "mechanic" },
  // mk2.02 (owner): the roster surgery — rocket troops replace runners,
  // the mortar team joins so the player's tube has its mirror. Dials
  // provisional (F5).
  rocket: { ...MAN.rifle, bounty: 8, speed: 3.2, gain: 16, label: "rocket team" },
  mortar: { ...MAN.rifle, bounty: 8, speed: 3.2, gain: 14, label: "mortar team" },
};
```

INFANTRY_ARMS: the `runners` and `breakers` rows are REPLACED by (comments above them replaced by these):

```js
  // mk2.02 (owner): THE SHOULDER ROCKET — rocket troops replace runners,
  // both sides, one row. The tower rocket's round on infantry legs. // provisional (F5)
  rockets: { projSpeed: 18, kind: "shell", weapon: "rocket", dmg: 27, blastR: 3.4, kv: 9, crater: 0.7,
             fireRate: 8.8, range: 18, acc: 0.021, occl: "arc", windF: 1.3, windComp: 0.5 },
  // mk2.02 (owner): THE GRENADE — grenadiers are not mortars; a short live
  // throw, one row both sides. // provisional (F5)
  grenadiers: { projSpeed: 20, kind: "shell", weapon: "mortar", dmg: 16, blastR: 2.0, kv: 5, crater: 0.3,
                fireRate: 3.2, range: 12, acc: 0.010, occl: "lofted", windF: 0.03, windComp: 0.6 },
```

The lob grant, three literals: `TOWER_SPECS.gun`, `BISON_FIRE.gun`, `ENEMY_FIRE.tank` — `occl: "arc"` → `occl: "auto"`, each with `// mk2.02 (owner): THE AUTOMATIC LOB — flat when the flat arc reaches, mortar root when it cannot`. `TOWER_SPECS.rocket` and `ENEMY_FIRE.lob` untouched.

Keys: in `PLAYER_TIERS` and `HAND_KEYS`, `sq_runners`→`sq_rockets`, `sq_breakers`→`sq_grenadiers`. `HAND_TAGS`: `sq_rifles: ""`, then `sq_rockets: "rocket", sq_grenadiers: "gren", sq_mortars: "mortar"` (the old `sq_runners`/`sq_breakers` entries and `sq_mortars: "gren"` die). The tier comment block (`:150-170`) re-drawn: TIER 1 line reads `mg · sq_mg · frost · sq_rockets · sq_grenadiers   rocket · gren`, TIER 2 `gun · sq_sniper · sq_mortars   mortar · sapper` — a comment, kept truthful.

### Step 3 — squads, spawn, tiers (squads.js, state.js)

`squads.js`: `import { MAN } from "./specs.js";`. Rows 57-60 become:

```js
  rockets: { n: 2, cost: 45, label: "ROCKET TEAM" },        // mk2.02 (owner): rocket troops replace runners // provisional (F5)
  grenadiers: { n: 4, cost: 40, label: "GRENADIER SQUAD" }, // mk2.02 (owner): breakers become grenadiers // provisional (F5)
```

`state.js:757`: `const M = spec.member || { mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, hp: 58 };` → `const M = spec.member || MAN.rifle; // mk2.02: the one body — every man 2m`. Line 11 import gains `MAN`.

`state.js:1128` ENEMY_TIERS becomes:

```js
export const ENEMY_TIERS = [
  ["rocket", "gren"],   // tier 1 — rocket troops, grenadiers (mk2.02: the roster surgery)
  ["mortar", "sapper"], // tier 2 — mortar team, sappers
  ["sniper", "tank"],   // tier 3 — marksmen, armour
  ["hero_bison", "hero_apc"], // tier 4 — THE HERO TIER (owner): lost armor returns off the convoy, dear
];
```

### Step 4 — the automatic lob and the surface (state.js, drivers.js)

`state.js` accuracy import gains `arcClears`. `shooterFire` line 388 `const high = !!opts.high;` becomes:

```js
  let high = !!opts.high;
  // mk2.02: THE AUTOMATIC LOB (owner) — an "auto" spec (both tank guns, the
  // tower GUN) fires the flat root when the flat arc reaches the aim and
  // takes the mortar root when it cannot (arcClears, the reach preview's
  // own march). A lobbed fast shell hangs long — priced in knowingly.
  if (!high && spec.occl === "auto" && !arcClears(world, muzzle, target.pos, { ...spec, occl: "arc" }, opts.owner)) high = true;
```

Surface aim, four sites (`state.js:714`, `:746`; `drivers.js:533`, `:556`), the mk2.01 tgt line becomes at each:

```js
  const sy = aim.y != null ? aim.y : world.field.heightAt(aim.x, aim.z);
  const tgt = live || { pos: { x: aim.x, y: sy, z: aim.z }, v: { x: 0, y: 0, z: 0 }, hy: sy - world.field.heightAt(aim.x, aim.z) }; // mk2.02: ground aim targets the SURFACE (owner) — the phantom body is dead; hy carries roof height over field ground through shooterFire's lead refresh
```

### Step 5 — the enemy's hands (units.js)

`spawnUnit` line 41: after `if (tag === "gren") u.utype = "gren";` add `if (tag === "mortar") u.utype = "mortar";`.

Rifleman fspec (line 220) becomes:

```js
  const fspec = sniper ? SNIPER_FIRE : u.tag === "mg" ? MG_FIRE : u.tag === "rocket" ? INFANTRY_ARMS.rockets : ENEMY_FIRE.rifle;
```

Cadence (line 271) — the heavy branch dies, the rocket reads its own row:

```js
      u.fireCd = ((sniper || u.tag === "mg") ? fspec.cd : u.tag === "rocket" ? INFANTRY_ARMS.rockets.fireRate : 1.5) + world.rng() * 0.5;
```

`stepGrenadier` (line 338): `const fspec = ENEMY_FIRE.lob;` becomes:

```js
  const fspec = INFANTRY_ARMS[u.tag === "mortar" ? "mortars" : "grenadiers"]; // mk2.02: one arms table both sides — the grenadier throws the grenade, the mortar team works the tube
```

Dispatch (line 541): `if (u.tag === "gren" && stepGrenadier(...)` → `if ((u.tag === "gren" || u.tag === "mortar") && stepGrenadier(...)`.

The breaker ram: DELETE `BREAKER_GRIND` and `stepBreakerRam` whole (the comment block `:583-591` through the function's close), and DELETE its call `stepBreakerRam(world);` + trailing comment at `DepotGame.jsx:595` and the import of `stepBreakerRam` from DepotGame's units import. `units.js` needs `INFANTRY_ARMS` in its specs import (line 20 — already present).

### Step 6 — the enemy's purse and pools (ai.js, market.js, muster.js)

`ai.js:12` `const INF_TYPES = ["", "fast", "heavy", "gren", "sapper"];` → `const INF_TYPES = ["", "rocket", "gren", "sapper", "mortar"];`. Lines 73-84, the weight table (comment above it gains `// mk2.02 (owner): the roster surgery — rockets take the fast seat, the mortar team joins, sappers inherit the heavy's wall signal (the breach role). // provisional (F5)`):

```js
  const base = { "": 0.30, rocket: 0.175, gren: 0.175, sapper: 0.175, mortar: 0.175 };
```

with the signal lines: `raw.fast += 0.35 * sig.mortar;` → `raw.rocket += 0.35 * sig.mortar;`, `raw.heavy += 0.18 * sig.wall;` → `raw.sapper += 0.18 * sig.wall;`, the jitter line's `raw.fast` → `raw.rocket`, and the sum line → `const sum = raw[""] + raw.rocket + raw.gren + raw.sapper + raw.mortar;`. `ai.js:274` `HOLD_TAGS` → `["", "rocket", "sniper", "mortar"]`.

`market.js:22` `runner: 12, breaker: 6, tank: 3,` → `rocketteam: 6, grenadier: 8, tank: 3,` (K seats, provisional). `:38` FAMILY_OF_SQUAD: `runners: "runner", breakers: "breaker"` → `rockets: "rocketteam", grenadiers: "grenadier"`. `:39` FAMILY_OF_TAG: `gren: "mortarcrew", fast: "runner", heavy: "breaker"` → `gren: "grenadier", rocket: "rocketteam", mortar: "mortarcrew"`.

`muster.js` PICK_POOL rows 247-248 and the mortars row:

```js
  { key: "sq_rockets", kind: "squad", type: "rockets", tag: "rocket", n: 2 },
  { key: "sq_grenadiers", kind: "squad", type: "grenadiers", tag: "gren", n: 4 },
```

and `{ key: "sq_mortars", ..., tag: "gren", n: 2 }` → `tag: "mortar"`.

### Step 7 — eye, convoy gate, predictor (sight.js, state.js, accuracy.js)

`sight.js:36` → `return { x: b.pos.x, y: b.pos.y + 0.8, z: b.pos.z, r }; // mk2.02: the 2m man's eye — 1.8m over his feet`.

`state.js:1518` → `M.cardUp = M.hand.length > 0 && !S.possess; // mk2.02: THE CONVOY WAITS (owner) — no deal opens over a live possession; release opens it`.

`accuracy.js`: in `flightImpact`, `for (let k = 0; k < 1800; k++)` → `for (let k = 0; k < 2600; k++) { // mk2.02: ~21.7s of flight — a lobbed 85 m/s shell hangs ~17.3s and must land inside the march`. Then replace `predictRing` whole (comment stays + gains `// mk2.02: 16-point footprint returned as pts; "auto" specs mirror shooterFire's lob rule.`):

```js
export function predictRing(SG, muzzle, aim, spec, sigma, wind, toUV) {
  const solve = (hi) => {
    let ax = aim.x, az = aim.z;
    for (let li = 0; li < 2; li++) {
      const ld = Math.max(2, Math.hypot(ax - muzzle.x, az - muzzle.z));
      const lp = aimSolve(spec.projSpeed, ld, aim.y - muzzle.y, 9.8, hi);
      if (lp == null) break;
      const tof = ld / Math.max(1e-3, spec.projSpeed * Math.cos(lp));
      ax = aim.x; az = aim.z;
      if (wind && spec.windF && spec.windComp) {
        ax -= wind.x * spec.windF * tof * spec.windComp;
        az -= wind.z * spec.windF * tof * spec.windComp;
      }
    }
    const dx = ax - muzzle.x, dz = az - muzzle.z, dy = aim.y - muzzle.y;
    const d = Math.max(2, Math.hypot(dx, dz));
    let pitch = aimSolve(spec.projSpeed, d, dy, 9.8, hi);
    if (pitch == null) pitch = hi ? 1.1 : 0.45;
    return { x: (dx / d) * Math.cos(pitch), y: Math.sin(pitch), z: (dz / d) * Math.cos(pitch) };
  };
  let high = spec.occl === "lofted";
  let rawDir = solve(high);
  let center = flightImpact(SG, muzzle, rawDir, spec.projSpeed, spec, wind, toUV);
  if (!high && spec.occl === "auto") {
    const shortfall = Math.hypot(aim.x - muzzle.x, aim.z - muzzle.z) - Math.hypot(center.x - muzzle.x, center.z - muzzle.z);
    if (center.wall || shortfall > 1.5) {
      high = true;
      rawDir = solve(true);
      center = flightImpact(SG, muzzle, rawDir, spec.projSpeed, spec, wind, toUV);
    }
  }
  const cap = SCATTER_CAP * sigma;
  const pts = [];
  let r = 0.4;
  for (let s = 0; s < 16; s++) {
    const hit = flightImpact(SG, muzzle, deflect(rawDir, (s / 16) * Math.PI * 2, cap), spec.projSpeed, spec, wind, toUV);
    pts.push(hit);
    r = Math.max(r, Math.hypot(hit.x - center.x, hit.z - center.z));
  }
  return { center, r, pts, rawDir, high };
}
```

### Step 8 — the game layer (DepotGame.jsx)

- Ring block: `let rr9 = 1.2, hit9 = null, ctr9 = null;` gains `, pts9 = null`; the aim9 line becomes `const aim9 = { x: S.reticle.x, y: S.reticle.y != null ? S.reticle.y : field.heightAt(S.reticle.x, S.reticle.z), z: S.reticle.z }; // mk2.02: the surface itself — no phantom`; after `rr9 = Math.max(0.4, pr9.r);` add `pts9 = pr9.pts;`; the setReticle call's `rr9, hit9);` → `rr9, hit9, pts9);`.
- `releasePossession`, after `S.reticleLockId = null;`:

```js
        // mk2.02: THE CONVOY WAITS (owner) — a hand dealt during the
        // possession opens the moment the possession ends.
        if (S.manifest && S.manifest.hand.length && !S.manifest.cardUp) { S.manifest.cardUp = true; S.manifest.armedAt = world.t + PENDING_ARM_S; }
```

- Palette rows 751-752 become:

```js
  { key: "sq_rockets", label: "ROCKETS", icon: "▲", cost: SQUAD_SPECS.rockets.cost },
  { key: "sq_grenadiers", label: "GRENADIERS", icon: "◎", cost: SQUAD_SPECS.grenadiers.cost },
```

(matching the found rows' exact property shape — if the live rows carry more fields, keep those fields, changing only key/label/icon/cost source). The comment above (750) re-signs: `// mk2.02 (owner): the roster surgery — rockets and grenadiers hold the tier-1 seats.`
- `SQUAD_MODE` (1579): `sq_runners: "runners"` → `sq_rockets: "rockets"`, `sq_breakers: "breakers"` → `sq_grenadiers: "grenadiers"`.
- The `stepBreakerRam(world);` call and its import (step 5) removed.
- Phone AND desktop: these are the same bar and pie on both layouts; nothing layout-specific changes.

`infocards.js:35-36`:

```js
  sq_rockets:    sq("rockets", "A rocket pair. Slow salvos that crack armor and stone."),
  sq_grenadiers: sq("grenadiers", "Four throwers. Short live grenades over the near wall."),
```

(keep the found `sq(...)` helper's exact call shape.)

### Step 9 — the drawn men (renderer.js, troopkit.js)

Renderer: declaration `let retRing = null, retPoly = null; // POSSESSION T5 / mk2.02: the crosshair group + the footprint loop`. Replace `setReticle` whole with:

```js
    setReticle(on, x, z, y, r, hit, pts) {
      if (!retRing) {
        const rmat = new THREE.MeshBasicMaterial({ color: 0xf0143c, depthWrite: false, side: THREE.DoubleSide, fog: false });
        retRing = new THREE.Group();
        // THE LARGE CROSSHAIR (mk2.01) — four bars, scaling and tilting as one.
        for (let ci = 0; ci < 4; ci++) {
          const bar = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.85), rmat);
          const ca = (ci * Math.PI) / 2;
          bar.position.set(Math.sin(ca) * 1.35, Math.cos(ca) * 1.35, 0);
          bar.rotation.z = -ca;
          retRing.add(bar);
        }
        retRing.rotation.x = -Math.PI / 2;
        for (const ch of retRing.children) ch.layers.set(1);
        scene.add(retRing);
        // mk2.02: THE FOOTPRINT POLYGON — the landing bound drawn through
        // its 16 landed points, each at its own ground, hugging hillsides.
        // The circle band is dead; the truth has corners.
        retPoly = new THREE.LineLoop(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xf0143c, fog: false }));
        retPoly.layers.set(1); scene.add(retPoly);
      }
      retRing.visible = !!on;
      const havePts = !!(on && !hit && pts && pts.length > 2);
      retPoly.visible = havePts;
      if (on) {
        const rr = Math.max(0.4, r || 1.2);
        retRing.scale.set(rr, rr, 1);
        // a wall hit stands the crosshair upright on the face, square to
        // the fire line; ground and rooftops keep it flat at the landing.
        if (hit) { retRing.position.set(x, hit.y, z); retRing.rotation.set(0, hit.yaw, 0); }
        else { retRing.position.set(x, y + 0.1, z); retRing.rotation.set(-Math.PI / 2, 0, 0); }
      }
      if (havePts) {
        const arr = new Float32Array(pts.length * 3);
        for (let i = 0; i < pts.length; i++) { arr[i * 3] = pts[i].x; arr[i * 3 + 1] = pts[i].y + 0.14; arr[i * 3 + 2] = pts[i].z; }
        retPoly.geometry.dispose();
        retPoly.geometry = new THREE.BufferGeometry();
        retPoly.geometry.setAttribute("position", new THREE.BufferAttribute(arr, 3));
      }
    },
```

Troop stretch (1842):

```js
      // mk2.02: TWO-METER MEN (owner) — depot bodies are 2m (hy 1.0); the
      // drawn man stretches to match. Demo modes render byte-identical.
      const bw = KIT.bw, bh = KIT.bh * (world.depotCombat ? 2.0 / 1.44 : 1);
```

`troopkit.js`: `BULK` (line 123) → `const BULK = {}; // mk2.02: the heavy and fast frames died with their troops — one 2m frame, kit palettes carry identity`; the gren check (line 137) `const gren = b.utype === "gren";` → `const gren = b.utype === "gren" || b.utype === "grenadiers";`; the hands-free heavy line (168) `: b.tag === "heavy" ? KIT_NONE` deleted (keep the surrounding ternary chain valid). The comment 119-122 re-signs to say the frames are gone.

### Step 10 — gates

`node scripts/gate.mjs depot-test`, `golden`, `depot-lint`, `smoke`, in order, all green (smoke: preview server on :4173, killed after). Arithmetic acceptance: new checks +19 (a2, b1, c2, d2, e2, f2, g1, h1, i4, j3) minus removals −9 (sweep table B: five 02 pins counting `:412-413` as one check each = 5, one 03 pin, three 07 checks) → final depot-test PASS = baseline + 19 − 9 = baseline + 10 (expected 1743). The agent verifies table B's exact removal count while editing — if a listed block holds a different number of `ok(` calls than tabled here, STOP and report before proceeding (the table rules; the arithmetic is re-derived from what the table's removals actually contained, reported explicitly).

### Step 11 — deploy

`src/version.js` → `mk2.02`; build AFTER the bump; commit `the tall order, mk2.02`; push. The owner's live check, phone and desktop: the footprint hugging hillsides; rounds landing on the reticle's dirt; tanks and gun towers dropping fire over walls both directions; the convoy holding until release; two-meter men; grenadier squads throwing short live grenades; rocket teams on both sides; enemy mortar teams working tubes; no breaker, no runner anywhere.

## Report requirements

- Fixture seed named: 81 (new); all others untouched.
- EVERY sweep-table entry reported: removals listed, re-teaches old → new.
- Both depot-test PASS counts with the re-derived arithmetic.
- Every deviation its own labeled bullet.
