# P7.1 Task 9 — the gentle arc and the tight tube (mk1.74)

The owner's artillery rulings (2026-08-19, on the record): MORTARS TIGHTEN HARD — spread 0.020 → 0.005 on all three lobbed tables together (his mortar tower, his mortar teams, the enemy grenadier's lob — the symmetry law). ROCKETS FLY A GENTLE ARC — the flat ballistic solution at a slower speed: a shallow, readable arc peaking a few meters up, honest terrain checks (rockets stop lobbing over tall obstructions and never waste a salvo into a hillside). The ruling carries forward to the ARMS-phase rocket teams when they arrive.

**Ordering (set by the owner's "write the plan" at the artillery exchange):** the artillery retune is Task 9 (mk1.74); LIVE PORTRAITS shift to Task 10 (mk1.75). The record's earlier Task-9-portraits line gets its dated correction at this plan's approval commit.

Suggested model: **Sonnet** — five literals, one line of logic, every edit written below.

## The arithmetic

- The gentle arc, computed: the flat solve at projSpeed 18 gives launch pitch ≈ 22° at the rocket's full 23m reach — apex ≈ 2.3m, flight ≈ 1.4s; at mid range the arc is flatter still. It clears sandbags and low walls mid-flight and reads as a rocket, not a mortar shell. Max flat-solve reach at 18 m/s is 33m — comfortable margin over the 23m spec.
- Rocket SPREAD is deliberately untouched (acc 0.021): the flat flight is ~3× shorter in the air than the old lob, so the same angular spread lands much tighter on its own.
- Wind dials untouched: drift scales with flight time, so the shorter flight shrinks it naturally.
- No draw-count change anywhere — spread and speed are inputs to the existing two scatter draws per shot.
- ONE live pin moves (the whole-suite sweep found exactly one): `01-engine-era.mjs:648` pins the lob-mortar symmetry TO THE DIGIT (`=== 0.020`). The symmetry CONTENT holds; only the digit follows the ruling. Licensed below.
- No fixture builds a live rocket tower through acquisition, and the possessed-tower audit (10-command-refit audit(g)) fires the rocket at 10m — solvable flat at 18 m/s, the pin stands.

## Stated lines

- All three lobbed spread dials move together, both sides — the symmetry law; each stays `// provisional (F5)`.
- The mortar's remaining misses against WALKING men are flight-time physics (three-plus seconds in the air, stale lead) — accepted by the ruling; standing targets and masonry now group tight.
- Honest consequences of `occl: "arc"` on the rocket, all intended: acquisition and the reach preview now march the true flight (a rocket behind a tall wall no longer acquires through it); CAREFUL discipline checks the whole arc (holds more shots near your own walls); the fan preview shrinks behind obstacles.
- No engine (`core.js`) or renderer edits; state.js's one-line change is game-layer.
- The owner's acceptance is live: rockets visibly fly a low rising arc; mortars group tight on anything standing.

## Required reading, in order

1. This plan, whole.
2. `src/depot/specs.js` — whole (the three lobbed tables, the rocket row and its comment history).
3. `src/depot/state.js:330-420` (shooterFire + towerShot — the `high` flag is the one logic change).
4. `src/depot/accuracy.js:81-146` (marchArc/arcClears — what `occl: "arc"` buys the rocket).
5. `scripts/tests/01-engine-era.mjs:640-655` (the lob-symmetry pin — the one licensed re-teach).
6. `scripts/tests/10-command-refit.mjs` — tail (the T8 blocks; the new asserts append after) and `:113-121` (audit(g), the possessed-rocket pin that stands).

## The sweep license

- ONE licensed movement: `01-engine-era.mjs:648` — both `=== 0.020` literals become `=== 0.005` (the windF clauses are untouched); label gains `(re-taught P7.1 T9)`, reported old → new. The symmetry content is identical.
- The KEYSTONE is NOT licensed. Anything else failing: STOP.

## Steps

**Step 1 — specs.js: the dials.** Five literal edits:

- `TOWER_SPECS.mortar`: `acc: 0.020` → `acc: 0.005`, and the line gains `/* mk1.74 (owner): tightened 0.020 -> 0.005 — the lob lands where it looks */` beside the existing provisional marker.
- `INFANTRY_ARMS.mortars`: `acc: 0.020` → `acc: 0.005` (same comment idiom).
- `ENEMY_FIRE.lob`: `acc: 0.020` → `acc: 0.005` (same comment idiom — symmetry, both sides).
- `TOWER_SPECS.rocket`: `projSpeed: 30` → `projSpeed: 18`, and `occl: "lofted"` → `occl: "arc"`, the row gaining `/* mk1.74 (owner): THE GENTLE ARC — flat solve at 18 m/s, ~22° and a 2.3m apex at full reach; terrain checks honest */`.

**Step 2 — state.js: only the mortar lobs.** In `towerShot` (`:414-415`):

```js
  const high = tower.towerType === "mortar" || tower.towerType === "rocket";
```

becomes

```js
  const high = tower.towerType === "mortar"; // P7.1 T9 (owner): rockets fly the GENTLE ARC — the flat solve
```

**Step 3 — the licensed re-teach.** `01-engine-era.mjs:648`: both `=== 0.020` → `=== 0.005`, label gains `(re-taught P7.1 T9: 0.020 -> 0.005)`.

**Step 4 — the internal checkpoint.** `node scripts/depot-test.mjs`: **1448 passed / 0 failed exactly.** Any other movement: STOP.

**Step 5 — the asserts** (appended to `10-command-refit.mjs` after the T8 blocks; imports gain `ENEMY_FIRE` from specs.js and `aimSolve` from `../../src/engine/core.js`):

```js
// ---- P7.1 T9: THE GENTLE ARC AND THE TIGHT TUBE
{
  ok("T9: the three lobbed tables tightened together (symmetry)", TOWER_SPECS.mortar.acc === 0.005 && INFANTRY_ARMS.mortars.acc === 0.005 && ENEMY_FIRE.lob.acc === 0.005);
  ok("T9: the rocket flies slow, flat, and honest", TOWER_SPECS.rocket.projSpeed === 18 && TOWER_SPECS.rocket.occl === "arc");
  const src9 = fs.readFileSync("src/depot/state.js", "utf8");
  ok("T9: only the mortar tower takes the steep solve", /const high = tower\.towerType === "mortar";/.test(src9));
  const p9 = aimSolve(18, 23, 0, 9.8, false);
  ok("T9: the arc is gentle at full reach (a low rising pitch)", p9 != null && p9 > 0.1 && p9 < 0.45, p9 && p9.toFixed(3));
}
```

**Step 6 — version.** `src/version.js`: `mk1.73` → `mk1.74`. Build AFTER the bump.

## Gates — run ONLY these

1. `node scripts/depot-test.mjs` — 0 failed; 4 new asserts, expected total **1452/0**, reported exact. Licensed movement ONLY: the 01-engine-era symmetry digit (0.020 → 0.005). The keystone moving is a DEFECT: stop.
2. `node scripts/smoke.mjs` — preview pattern, all green, mark mk1.74.
3. `node scripts/depot-lint.mjs` — clean (no rng change anywhere).

Green → commit `src/depot/specs.js`, `src/depot/state.js`, `scripts/tests/01-engine-era.mjs`, `scripts/tests/10-command-refit.mjs`, `src/version.js` — subject "the gentle arc and the tight tube (mk1.74)" — standing trailers, push.

## Report requirements

Read-confirmation (six items), one outcome line, then bullets: each step; the one re-teach old → new; the checkpoint's and each gate's exact counts; commit hash; THE SEED LIST (no new fixture seeds — state it plainly). Every deviation its own labeled bullet. The owner's live acceptance: rockets fly a visible low rising arc and stop shooting over tall walls; mortar shells group tight on standing targets and masonry, both sides.
