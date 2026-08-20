# P7.2 Task 4 — His Hand (mk1.84)

**Suggested model: Sonnet** (state-layer contract change plus one muster helper, fully specced).
**Scope (ruled):** the full mirror, symmetry to the letter. The enemy's one-draw pick dies; every bell he is dealt his OWN five cards off the SAME fifteen — towers included (owner, 2026-08-20: the AI player gets towers; everything is symmetrical) — three plans and two hires, the same five-draw splice, count-stable. He pays HALF for plans and FULL for hires off his own books, priced off the PLAYER'S OWN table — one table. His buys are a deterministic walk in dealt order, zero draws, each kept above a muster floor. Bought SQUAD and HERO plans push his tags and his assaults field them AT ONCE — the old tier-bell clamp is DEAD (owner: "fields at once"). Bought TOWER plans join his plans ledger, and he BUILDS from it: one tower build per bell at full price, the reproducible path, exactly what a plan is. Hires — squads, armor, towers alike — field draw-free at his depot through the dealt-hand mirror's machinery. The Task 2 interim closes; no asymmetry remains in the hand.

**Revised at review (owner's word, 2026-08-20 — four findings closed in this draft):** (1) the tower build takes the first owned AND AFFORDABLE type — a dear first type is skipped, never a permanent stall; (2) `parkTower` goes FAIL-PROOF (the parkArmor T3 precedent) — charged tower money always buys a standing tower on a real map, and the bare-opening boot mirror's silent tower give-up closes with it; (3) the conscript key is BORN-OWNED on his side — his rifles plan never deals, dead money closed; (4) the hired squad id derives from the live roster, not a counter — counters do not ride the save (the apcSeq reseed precedent).

## Required reading (verified against the mk1.83 tree at 69b2cfa; re-verify at dispatch)

- `src/depot/state.js` — 1120–1200 (the hand machinery: the draw-law comment block, makeManifestState/makeFoeState, dealConvoyHand, takeHandCard, isUnlocked, enemyTierState and the tier helpers above it), 1420–1480 (fireBell steps 4–5), line 7 (the ai.js import carries MIN_WAVE_FLOOR), line 10 (the specs import).
- `src/depot/specs.js` — the HAND_KEYS block and the two-ladders table above it.
- `src/depot/bell.js` whole (194) — the fireBell call, the T9 hero-replacement block, the imports.
- `src/depot/muster.js` — 38–142 (armorSpread, parkArmor, and parkTower WHOLE — this task rewrites parkTower's body), 188–269 (PICK_POOL, dealHand, spawnMirrorMan, musterFreshStart).
- `src/depot/ai.js` — 181–262 (planWave, read-only), 40 (MIN_WAVE_FLOOR).
- Tests: `01-engine-era.mjs` 1–10 (imports), 62–107 (the tier-clamp block), 109–213 (the hand and foe-mirror blocks), 725–750 (the prediction burn); `07-armor-demolition.mjs` line 3 (imports), ~1100–1180 (T9 pool and ringBell source pins); `11-hiring-hall.mjs` whole; `09-reorg.mjs` 166–219 (the T21 ring fixture — its null grid is a trap this task must survive).

## The design, plainly

1. **His deal.** fireBell step 5 becomes: `dealConvoyHand(ownedKeys, HAND_KEYS, rng)` — five draws, the step-4 shape. His "owned" filter covers both spaces: a squad/hero key is owned when its tag is in `S.foe.unlocked`; a tower key is owned when it is in the new `S.foe.towers` ledger. A new `HAND_TAGS` map in specs.js (eight squad keys and two hero keys → enemy tags; tower keys absent BY ROUTING — a tower plan routes to the ledger, not the wave map). The conscript key (`sq_rifles`, tag `""`) is BORN-OWNED on his side: his conscripts march from bell zero under the never-gated law, so a rifles plan would buy him nothing — it never deals, and his scrap never buys a no-op.
2. **His walk** (same block, zero draws, dealt order): a plan he lacks costs `ceil(price/2)` — squad/hero plans push the tag, tower plans push the key onto `S.foe.towers`; a hire costs full and queues its key on `S.foe.hired`. Every buy keeps `MIN_WAVE_FLOOR` in the till. Prices come from a new `priceP` option; bell.js threads the player's live table; a fixture without `priceP` buys nothing and the draws still burn.
3. **He builds what he owns.** After the walk, one TOWER BUILD per bell (provisional F5): the first owned tower key in table order THE TILL CAN AFFORD — a dear first type is skipped for the next owned one, never a permanent stall — at FULL price, floor kept, queued on the same `S.foe.hired`. The plan/build split is exactly the player's: half to learn, full each build.
4. **His hires and builds field** in bell.js right after fireBell: a new `mirrorFieldKey(world, S, depotE, grid, field, key, nextApcSeq)` export in muster.js — the dealt-hand mirror branches per key (garrison men, engineer squads to `foeSquads`, `parkArmor`, `parkTower`), draw-free, guarded so a bare fixture (null grid/field — the T21 ring fixture) skips fielding. The queue clears BEFORE the bell's save, so `hired` is always empty in the file. AND PARKTOWER GOES FAIL-PROOF (the parkArmor T3 precedent): a hemmed ring falls back to a brute nearest-clear-cell sweep (8–34m), so charged tower money always buys a standing tower on a real map — this also closes the bare-opening boot mirror's silent tower give-up. Hired squad ids derive from the live roster, never a counter (counters do not ride the save).
5. **The clamp dies.** `enemyTierState` becomes membership-only (signature kept). The T9 hero buy-back's `S.bell >= TIER_BELLS[3]` clause drops — ownership alone re-parks a bought hero, any bell (owner's fields-at-once ruling).
6. **What dies:** `FOE_DRAWS`, `drawFoePick`, `foePool`, `ladderPool`. The bell's fireBell draws move 10 → 14 (his 5 replaces his 1); ringBell's unconditional pairs unchanged; the per-bell total is 20 plus intel and the save.
7. **Interaction checklist:** the calm window — his whole hand resolves inside the ring, before the pause engages; the wall arms — he has no card, nothing arms; the bare bar — his ledgers start as empty as yours; the ghosts — untouched; the save — `S.foe` rides the existing JSON clone (`towers`/`hired` come for free, `hired` empty at every save); the keystone — its fixture never rings a bell, expected unmoved (843448507 / 749); the fail-proof parkTower — also reached by the BOOT mirror's tower picks: draw-free either way, zero draw movement, and on a rare formerly-hemmed seed the enemy now stands a tower he silently lost before (a knowing behavior change, named here).

Dials, provisional (F5): the walk's floor is `MIN_WAVE_FLOOR`; one tower build per bell, first affordable owned type.

## Sweep license (each expected re-teach pre-computed below; count-neutral throughout — old ok() count equals new in every block; anything beyond the ledger = honest stop)

## The steps

**Step 1 — the failing asserts.** Append to `scripts/tests/11-hiring-hall.mjs`. Import additions at the top of the file: `HAND_TAGS` joins the specs import; `mirrorFieldKey` joins the muster import; add `import { makeMap, TOWN } from "../../src/depot/mapgen.js";` after the muster import line (`fatReg` is already imported).

```js
// ---- P7.2 T4 (mk1.84): HIS HAND — the full mirror, towers included
{
  // (a) the tag map: squads and heroes map to wave tags; a tower key maps to
  // nothing because it ROUTES to his plans ledger instead — never an exclusion
  ok("T4(a): HAND_TAGS covers the eight squads and both heroes; tower keys route to the ledger",
    Object.keys(HAND_TAGS).length === 10 && ["mg", "gun", "mortar", "rocket", "frost"].every((k) => HAND_TAGS[k] === undefined));
  // (b) his deal: five draws; owned plans of BOTH spaces never re-deal
  {
    let n = 0; const raw = mulberry32(84); const rng = () => { n++; return raw(); };
    const foe = { unlocked: ["fast"], towers: ["gun"] };
    const owned = HAND_KEYS.filter((k) => (HAND_TAGS[k] === undefined ? foe.towers.indexOf(k) >= 0 : (HAND_TAGS[k] === "" || foe.unlocked.indexOf(HAND_TAGS[k]) >= 0)));
    const hand = dealConvoyHand(owned, HAND_KEYS, rng);
    ok("T4(b): his deal burns five draws like the player's", n === 5, n);
    ok("T4(b2): an owned tag and an owned tower plan never re-deal; unowned towers CAN deal (symmetry)",
      hand.filter((c) => !c.hire).every((c) => c.k !== "gun" && (HAND_TAGS[c.k] === undefined || HAND_TAGS[c.k] !== "fast")));
    ok("T4(b3): the conscript key is born-owned — his rifles plan never deals (his conscripts march from bell zero; a rifles plan is dead money)",
      hand.filter((c) => !c.hire).every((c) => c.k !== "sq_rifles"));
  }
  // (c) the walk: deterministic buys off the one table, the floor kept
  {
    const S = makeRunState();
    S.started = true; S.reg = fatReg(); S.reg.scrap = 5000;
    let draws = 0; const raw = mulberry32(85); const rng = () => { draws++; return raw(); };
    fireBell(S, { reg: S.reg, snap: {}, rng, t: BELL_PERIOD_S, priceP: () => 40 });
    ok("T4(c): a rich bell buys plans AND queues hires", (S.foe.unlocked.length + S.foe.towers.length) >= 1 && (S.foe.hired || []).length >= 1, `${S.foe.unlocked.length}+${S.foe.towers.length}/${(S.foe.hired || []).length}`);
    ok("T4(c2): the books were charged", S.reg.scrap < 5000, S.reg.scrap);
    ok("T4(c3): bell draws stay fourteen with the walk buying — zero draws in the walk", draws === 14, draws);
    const S2 = makeRunState();
    S2.started = true; S2.reg = fatReg(); S2.reg.scrap = 0;
    fireBell(S2, { reg: S2.reg, snap: {}, rng: mulberry32(85), t: BELL_PERIOD_S, priceP: () => 200 });
    ok("T4(c4): prices past the till buy nothing — the muster floor holds (the stipend alone cannot fund a 100-scrap plan)",
      S2.foe.unlocked.length === 0 && S2.foe.towers.length === 0 && (S2.foe.hired || []).length === 0);
    const S3 = makeRunState();
    S3.started = true; S3.reg = fatReg();
    fireBell(S3, { reg: S3.reg, snap: {}, rng: mulberry32(85), t: BELL_PERIOD_S });
    ok("T4(c5): no price table (an old fixture) — his walk is a no-op", S3.foe.unlocked.length === 0 && S3.foe.towers.length === 0);
    // (c6) the tower plan-and-build loop: seed a ledger, ring, and the bell
    // queues ONE full-price build of the first owned type in table order
    const S6 = makeRunState();
    S6.started = true; S6.reg = fatReg(); S6.reg.scrap = 5000;
    S6.foe.towers = ["mortar", "mg"];
    fireBell(S6, { reg: S6.reg, snap: {}, rng: mulberry32(86), t: BELL_PERIOD_S, priceP: () => 40 });
    ok("T4(c6): he BUILDS what he owns — one tower build a bell, first owned in table order",
      (S6.foe.hired || []).filter((k) => k === "mg" || k === "mortar").length >= 1 && (S6.foe.hired || []).indexOf("mg") >= 0);
    // (c7) the stall is dead: a ruinous first-owned type is SKIPPED and the
    // next affordable owned type builds instead
    const S7 = makeRunState();
    S7.started = true; S7.reg = fatReg(); S7.reg.scrap = 5000;
    S7.foe.towers = ["mortar", "mg"];
    fireBell(S7, { reg: S7.reg, snap: {}, rng: mulberry32(87), t: BELL_PERIOD_S, priceP: (k) => (k === "mg" ? 99999 : 40) });
    ok("T4(c7): an unaffordable first-owned type is skipped — the first AFFORDABLE owned type builds (no stall)",
      (S7.foe.hired || []).indexOf("mortar") >= 0 && (S7.foe.hired || []).indexOf("mg") < 0);
  }
  // (d) his hires field through the mirror machinery, draw-free
  {
    makeMap(93);
    const flatF4 = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (x, z, o) => { o.x = 0; o.y = 1; o.z = 0; return o; } };
    const w = makeWorld({ field: flatF4, seed: 93 });
    const S4 = { foeSquads: [] };
    const depotE4 = TOWN.find((t) => t.depot && t.team === 2);
    mirrorFieldKey(w, S4, depotE4, {}, flatF4, "sq_rifles", () => 1);
    const men = w.bodies.filter((b) => b.kind === "unit" && b.team === 2 && b.garrison && b.alive);
    ok("T4(d): a hired rifle squad fields four garrison men at his depot", men.length === 4, men.length);
    mirrorFieldKey(w, S4, depotE4, {}, flatF4, "sq_engineers", () => 1);
    ok("T4(d2): a hired engineer squad joins his build roster", S4.foeSquads.length === 1 && S4.foeSquads[0].memberIds.length === 2);
    mirrorFieldKey(w, S4, depotE4, {}, flatF4, "sq_engineers", () => 1);
    ok("T4(d2b): a second hired squad's id never collides — derived from the live roster, save-proof",
      S4.foeSquads.length === 2 && S4.foeSquads[0].id !== S4.foeSquads[1].id && S4.foeSquads.every((q) => q.id >= 9501));
    // a REAL mini-grid for the tower branch (the era-10 mkGrid idiom, local)
    const N = 44, cells = Array.from({ length: N * N }, () => ({ blocked: false, ice: false, water: false, wallId: null }));
    const G = { cells, w: N, h: N, cs: 2,
      idx: (gx, gz) => gz * N + gx,
      inBounds: (gx, gz) => gx >= 0 && gx < N && gz >= 0 && gz < N,
      worldToGrid: (x, z) => ({ gx: Math.floor(x / 2) + (N >> 1), gz: Math.floor(z / 2) + (N >> 1) }),
      gridToWorld: (gx, gz) => ({ x: (gx - (N >> 1)) * 2 + 1, z: (gz - (N >> 1)) * 2 + 1 }) };
    G.cellAt = (x, z) => { const g = G.worldToGrid(x, z); return G.inBounds(g.gx, g.gz) ? cells[G.idx(g.gx, g.gz)] : null; };
    const w2 = makeWorld({ field: flatF4, seed: 94 });
    mirrorFieldKey(w2, { foeSquads: [] }, { x: 0, z: 0, nx: 12, nz: 9, team: 2, depot: true }, G, flatF4, "gun", () => 1);
    const tw = w2.bodies.find((b) => b.kind === "tower" && b.team === 2 && b.alive);
    ok("T4(d3): a hired or built tower stands and fights at his depot", !!tw && tw.towerType === "gun" && tw.discipline === "free");
    ok("T4(d4): a bare fixture (no grid) skips fielding without a throw",
      (() => { mirrorFieldKey(w2, {}, { x: 0, z: 0 }, null, null, "hero_bison", null); return true; })());
    // (d5) the hemmed ring: every cell blocked but one pocket past the ring
    // scan's reach (~33m out — the ring samples only 12-30m) — the fail-proof
    // backstop still parks the paid tower
    const cellsH = Array.from({ length: N * N }, () => ({ blocked: true, ice: false, water: false, wallId: null }));
    const GH = { ...G, cells: cellsH };
    GH.cellAt = (x, z) => { const g = GH.worldToGrid(x, z); return GH.inBounds(g.gx, g.gz) ? cellsH[GH.idx(g.gx, g.gz)] : null; };
    cellsH[GH.idx(38, 22)].blocked = false; // world (33, 1) — ~33m from the depot, inside the 8-34m sweep
    const w4 = makeWorld({ field: flatF4, seed: 95 });
    mirrorFieldKey(w4, { foeSquads: [] }, { x: 0, z: 0, nx: 12, nz: 9, team: 2, depot: true }, GH, flatF4, "gun", () => 1);
    ok("T4(d5): a hemmed ring still parks the paid tower — the fail-proof backstop (the parkArmor precedent)",
      !!w4.bodies.find((b) => b.kind === "tower" && b.alive));
  }
  // (e) the wiring
  {
    const be = fs.readFileSync("src/depot/bell.js", "utf8");
    ok("T4(e): the ring fields his hires draw-free and clears the queue",
      /for \(const k of S\.foe\.hired\) mirrorFieldKey\(world, S, depotH, grid, field, k, ctx\.nextApcSeq\);/.test(be) && /S\.foe\.hired = \[\];/.test(be));
    ok("T4(e2): his hand pays the PLAYER'S price table — one table (owner)",
      /priceP: \(k\) => \(S\._market && S\._market\.player\[k\] != null \? S\._market\.player\[k\] : null\)/.test(be));
    const st = fs.readFileSync("src/depot/state.js", "utf8");
    ok("T4(e3): plans pay half and the floor guards every buy — plan, hire, and the tower build",
      /Math\.max\(1, Math\.ceil\(base \/ 2\)\)/.test(st) && (st.match(/< MIN_WAVE_FLOOR\) continue;/g) || []).length === 3 && /reg\.scrap - priceP\(x\) >= MIN_WAVE_FLOOR/.test(st));
    ok("T4(e4): the old pick machinery is gone", !/drawFoePick/.test(st) && !/foePool/.test(st) && !/FOE_DRAWS/.test(st));
    ok("T4(e5): one tower build a bell, first AFFORDABLE owned in table order, full price",
      /HAND_KEYS\.find\(\(x\) => S\.foe\.towers\.indexOf\(x\) >= 0 && priceP\(x\) != null && reg\.scrap - priceP\(x\) >= MIN_WAVE_FLOOR\)/.test(st));
    ok("T4(e6): the born-owned clause is in the filter — dead money closed at the source",
      /HAND_TAGS\[k\] === "" \|\| S\.foe\.unlocked\.indexOf\(HAND_TAGS\[k\]\) >= 0/.test(st));
  }
}
```

Twenty-three checks, counted from the block above — (a) 1, (b) 3, (c) 7, (d) 6, (e) 6. Expected suite after all steps: **1533/0** (1510 + 23, re-teaches count-neutral). Run the suite now: RED on this block (missing exports) with the 1510 unmoved — the failing-first proof.

**Step 2 — the tag map.** `src/depot/specs.js`, directly under the HAND_KEYS line:

```js
// P7.2 T4: the key -> enemy-tag map for HIS side of the hand. Tower keys
// are deliberately absent — a tower is not a wave tag: his tower plans
// ROUTE to S.foe.towers (the plans ledger he builds from), full symmetry.
export const HAND_TAGS = { sq_rifles: "", sq_runners: "fast", sq_breakers: "heavy", sq_sappers: "sapper", sq_mortars: "gren", sq_sniper: "sniper", sq_mg: "mg", sq_engineers: "eng", hero_bison: "hero_bison", hero_apc: "hero_apc" };
```

**Step 3 — the contract.** `src/depot/state.js`:
- Line 10's specs import gains `HAND_TAGS`.
- The draw-law header comment (the paragraph naming `MANIFEST_DRAWS (4) and FOE_DRAWS (1)`) re-words to: both hands consume a fixed `HAND_DRAWS (5)` each side, drawn up front, clamp-never-drawn-if.
- DELETE: the `FOE_DRAWS` export line; `ladderPool` and its comment; `foePool`; `drawFoePick` and its comment.
- `makeFoeState` returns `{ unlocked: [], hired: [], towers: [] }`.
- `enemyTierState` body becomes membership-only (comment: the bell clamp is dead, owner 2026-08-20; signature kept):

```js
export function enemyTierState(bell, unlocked = []) {
  // P7.2 T4 (owner): the bell clamp is DEAD — a bought plan fields at
  // once, the full mirror of the player's instant build rights. The
  // signature keeps the bell for its callers; membership in his unlocked
  // list is the whole gate now.
  const tags = [""];
  for (const t of unlocked) if (tags.indexOf(t) < 0) tags.push(t);
  return { bell, tags };
}
```
- fireBell's destructure gains `priceP = null`. Step 5's block becomes:

```js
  // 5. HIS HAND, then the muster — the full mirror (P7.2 T4). Five draws,
  // the step-4 shape; the buys are a deterministic walk in dealt order
  // (zero draws): every card he can afford while keeping a muster floor
  // in the till. Squad and hero plans push his tags — his waves field
  // them AT ONCE (the bell clamp is dead, owner 2026-08-20); tower plans
  // join S.foe.towers, his plans ledger; hires queue on S.foe.hired and
  // the game layer fields them at his depot right after the ring. The
  // conscript key is BORN-OWNED (the never-gated law): his conscripts
  // march from bell zero, so a rifles plan is dead money and never deals.
  if (rng) {
    if (!S.foe) S.foe = makeFoeState();
    if (!S.foe.towers) S.foe.towers = [];
    const ownedKeys = HAND_KEYS.filter((k) => (HAND_TAGS[k] === undefined ? S.foe.towers.indexOf(k) >= 0 : (HAND_TAGS[k] === "" || S.foe.unlocked.indexOf(HAND_TAGS[k]) >= 0)));
    const foeHand = dealConvoyHand(ownedKeys, HAND_KEYS, rng);
    if (reg && priceP) {
      for (const c of foeHand) {
        const base = priceP(c.k);
        if (base == null) continue;
        if (!c.hire) {
          const cost = Math.max(1, Math.ceil(base / 2));
          if (HAND_TAGS[c.k] === undefined) {
            if (S.foe.towers.indexOf(c.k) >= 0) continue;
            if (reg.scrap - cost < MIN_WAVE_FLOOR) continue;
            reg.scrap -= cost;
            S.foe.towers.push(c.k);
          } else {
            const tag = HAND_TAGS[c.k];
            if (S.foe.unlocked.indexOf(tag) >= 0) continue;
            if (reg.scrap - cost < MIN_WAVE_FLOOR) continue;
            reg.scrap -= cost;
            S.foe.unlocked.push(tag);
          }
        } else {
          if (reg.scrap - base < MIN_WAVE_FLOOR) continue;
          reg.scrap -= base;
          (S.foe.hired || (S.foe.hired = [])).push(c.k);
        }
      }
      // THE PLAN'S WHOLE POINT: he BUILDS what he owns — one tower build
      // a bell, full price, the first owned type in table order THE TILL
      // CAN AFFORD (a dear first type is skipped, never a stall), the
      // same till floor. Deterministic, zero draws. // provisional (F5)
      if (S.foe.towers.length) {
        const k = HAND_KEYS.find((x) => S.foe.towers.indexOf(x) >= 0 && priceP(x) != null && reg.scrap - priceP(x) >= MIN_WAVE_FLOOR);
        if (k != null) {
          reg.scrap -= priceP(k);
          (S.foe.hired || (S.foe.hired = [])).push(k);
        }
      }
    }
  }
```

**Step 4 — the ring fields him.** `src/depot/bell.js`:
- The state import drops `TIER_BELLS` (its one use dies below); the muster import gains `mirrorFieldKey`.
- The fireBell call gains, after the `priceOf` line:

```js
    // P7.2 T4: HIS HAND pays the PLAYER'S OWN price table — one table to
    // the letter (owner). Null before the market's first tick: his walk
    // then buys nothing, and the five draws still burn (the law).
    priceP: (k) => (S._market && S._market.player[k] != null ? S._market.player[k] : null),
```
- Directly after the fireBell call's closing `});`:

```js
  // P7.2 T4: HIS HIRES AND BUILDS FIELD AT ONCE — seeded ground at his
  // depot, the dealt-hand mirror's own machinery, draw-free. Bare fixtures
  // with no grid skip the fielding (the books were charged; state-layer only).
  if (S.foe && S.foe.hired && S.foe.hired.length) {
    const depotH = TOWN.find((tt) => tt.depot && tt.team === 2);
    if (grid && field && depotH) for (const k of S.foe.hired) mirrorFieldKey(world, S, depotH, grid, field, k, ctx.nextApcSeq);
    S.foe.hired = [];
  }
```
- The T9 hero-replacement gate: `const open = (tag) => S.foe.unlocked.indexOf(tag) >= 0 && S.bell >= TIER_BELLS[3];` becomes `const open = (tag) => S.foe.unlocked.indexOf(tag) >= 0; // P7.2 T4 (owner): a bought hero plan re-parks at ANY bell — the clamp is dead`.

**Step 5a — parkTower goes fail-proof.** `src/depot/muster.js` — REPLACE the whole `parkTower` body (lines 121–142, its doc comment included) with the version below. The ring path is behavior-identical by construction (same checks, same cell snap, same body); the backstop is new behavior for hemmed rings ONLY, draw-free. Sweep bounds read `grid.w`/`grid.h` (not the map constants) so mini-grid fixtures stay in bounds; `cellAt`'s own guard does the rest.

```js
// P7.1 T6: a picked tower parks like armor — vetted clear ring ground,
// the real body, the cached effRange, the grid claim. Draw-free.
// P7.2 T4: FAIL-PROOF (the parkArmor T3 precedent) — a hemmed ring falls
// back to a brute nearest-clear-cell sweep (8-34m), so paid tower money
// always buys a standing tower on a real map. A grid with no clear cell
// at all still returns null (bare fixtures).
export function parkTower(world, grid, field, depotT, team, towerType) {
  if (!depotT) return null;
  const spec = TOWER_SPECS[towerType];
  const clearAt = (bx, bz) => {
    const cell = grid.cellAt(bx, bz);
    if (!cell || cell.blocked || cell.ice || cell.water || cell.wallId) return false;
    if (slotBlockedPublic(world, bx, bz, 1.2)) return false;
    return true;
  };
  const place = (bx, bz) => {
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
  };
  for (let rr = 12; rr <= 30; rr += 1.5) for (let k = 0; k < 16; k++) {
    const az = (k / 16) * Math.PI * 2 + 0.2;
    const bx = depotT.x + Math.sin(az) * rr, bz = depotT.z + Math.cos(az) * rr;
    if (clearAt(bx, bz)) return place(bx, bz);
  }
  // the backstop: nearest clear cell, 8-34m, guaranteed on a real map
  let best = null, bd = 1e9;
  for (let gz = 0; gz < grid.h; gz++) for (let gx = 0; gx < grid.w; gx++) {
    const wp = grid.gridToWorld(gx, gz);
    const d = Math.hypot(wp.x - depotT.x, wp.z - depotT.z);
    if (d > 34 || d < 8 || !clearAt(wp.x, wp.z)) continue;
    if (d < bd) { bd = d; best = wp; }
  }
  return best ? place(best.x, best.z) : null;
}
```

**Step 5b — the mirror helper.** Append to `src/depot/muster.js`:

```js
// P7.2 T4: ONE mirror hire or build fields at his depot — the
// musterFreshStart branches, reusable per key, draw-free. Bare fixtures
// (no grid/field) skip fielding entirely. Squad ids derive from the live
// roster so two hires can never collide — resume included (counters do
// not ride the save; the apcSeq reseed precedent). Boot squads sit at
// 9000+, hires from 9501 up; restored squads keep their ids.
export function mirrorFieldKey(world, S, depotE, grid, field, key, nextApcSeq) {
  const pick = PICK_POOL.find((p) => p.key === key);
  if (!pick || !depotE || !grid || !field) return;
  if (pick.kind === "hull") { parkArmor(world, grid, field, depotE, 2, pick.vtype, nextApcSeq || (() => 1)); return; }
  if (pick.kind === "tower") { parkTower(world, grid, field, depotE, 2, pick.key); return; }
  const gR = Math.hypot(depotE.nx, depotE.nz) * MASON.pitch / 2 + 3.5;
  let mi = 0;
  for (const b of world.bodies) if (b.kind === "unit" && b.team === 2 && b.garrison && b.alive) mi++;
  if (pick.tag === "eng") {
    const a0 = (mi / 16) * Math.PI * 2 + 2.0;
    const p0 = clearSlot(world, depotE.x + Math.sin(a0) * gR, depotE.z + Math.cos(a0) * gR, 0.5);
    let sid = 9501;
    for (const q of (S.foeSquads || [])) if (q.id >= sid) sid = q.id + 1;
    const sq = makeSquad(sid, "engineers", 2, p0.x, p0.z);
    spawnSquadMembers(world, sq);
    for (const id of sq.memberIds) world.byId.get(id).tag = "eng";
    (S.foeSquads || (S.foeSquads = [])).push(sq);
    return;
  }
  let pairLead = null;
  for (let k = 0; k < pick.n; k++) {
    const a = (mi / 16) * Math.PI * 2 + 2.0;
    const u = spawnMirrorMan(world, depotE.x + Math.sin(a) * gR, depotE.z + Math.cos(a) * gR, pick.tag, mi);
    mi++;
    if (pick.tag === "sniper") {
      if (!pairLead) { pairLead = u; u.role = "sniper"; u.bounty = 30; }
      else { u.role = "spotter"; u.bounty = 15; u.pairId = pairLead.id; pairLead.pairId = u.id; }
    }
  }
}
```

**Step 6 — the re-teach ledger** (licensed; count-neutral in every block, each old → new in the report):
- **01, imports:** `FOE_DRAWS`, `foePool`, `drawFoePick` leave the state import; `HAND_TAGS` joins the specs import.
- **01, the tier-clamp block (18 for 18):** the bell-clamp family re-teaches to the ownership law — everything bought fields at bell zero; unbought never fields; double-listed buys dedupe (per old tier row); bought once-gated tags now WALK through planWave from bell one (flip the leak counter into a fielded counter, `>= 1` across the 40 seeds); a muster still always fields men; the 4-draw contract pin stays.
- **01, the foe-mirror block (5 for 5):** re-teaches to his hand with a flat `priceP: () => 30` stub in its fireBell calls — the ladder climbs by PURCHASE across 12 rich bells; everything owned fields at once; the till never negative and the assault never carries an unowned tag; buys lawful per `Object.values(HAND_TAGS)` (the old `ENEMY_TIERS.flat()` reference set is wrong now — mg/eng/conscript tags are lawful); never bought twice.
- **01, the draw-law loop (2 per iteration):** the foe-pick line becomes his-deal-burns-five (`dealConvoyHand` with an all-owned filter); "an empty pool picks nothing" becomes "everything owned still burns five and deals hires alone".
- **01, the prediction burn (~line 740):** `HAND_DRAWS + FOE_DRAWS` → `HAND_DRAWS + HAND_DRAWS` (ten burned before planWave); its comment re-worded.
- **07:** `foePool` leaves the import; `HAND_TAGS` joins the specs import; T9(a6) re-teaches — heroes map to hero tags, tower keys route through the plans ledger (`HAND_TAGS.gun === undefined && HAND_TAGS.sq_mg === "mg"`); T9(d3) re-teaches to the ownership-only gate (assert the `TIER_BELLS[3]` literal is GONE and the `S.foe.unlocked.indexOf(tag) >= 0` gate remains).
- **11:** `FOE_DRAWS` leaves the import; T2(d2)'s bell budget message and pin 10 → 14.
- **Value-shift license (the T15 precedent):** his five draws replace his one, so every fixed-seed `fireBell`/`ringBell` fixture legitimately draws differently downstream; any NUMERIC pin moving for exactly that reason re-bases, measured, threshold never weakened, old → new. Known floors that survive by inspection: 09's T21 ≥16 (the new per-bell total is 20); 01's structural bell fixtures.

**Step 7 — the gates and the deploy.** In order: `node scripts/depot-test.mjs` — expected **1533/0** (1510 + 23; re-teaches count-neutral; any other movement not covered by the value-shift license = stop); `node scripts/depot-lint.mjs` clean; bump `src/version.js` to `mk1.84` BEFORE `npm run build`; smoke (stale 4173 stays; preview 4174 + SMOKE_URL; kill only yours) — green at mk1.84; keystone 843448507 / 749 unmoved (its fixture never rings a bell; movement = stop). Gates green → `git add` the touched files → commit subject exactly `his hand (mk1.84)` → push.

## Trap notes

- fireBell's step ORDER is the contract: intel → the hand → HIS hand → the muster. Only step 5's body changes.
- The T21 ring fixture (09-reorg) passes a NULL grid — the fielding guard (bell.js's `grid && field && depotH` plus mirrorFieldKey's own) is what protects it. Do not weaken either.
- `TIER_BELLS`, `ENEMY_TIERS`, `enemyTierOf`, `tierOpenCount` remain exported — tests and the ladder table still read them; only bell.js's import drops TIER_BELLS.
- The stipend lands BEFORE his walk (step 3 before step 5), so a "broke" fixture is only broke if prices exceed stipend-plus-floor — test premises must respect that.
- `S.foe` rides the save via the existing JSON clone — `towers` and `hired` serialize for free; `hired` is provably empty at every save (cleared before `ctx.saveFront()`).
- The parkTower rewrite (Step 5a) restructures a shipped function into place/clearAt closures — the ring path's checks, cell snap, and body are byte-equivalent by inspection; only the backstop is new. No test pins parkTower's source anywhere in the suite (grep-verified at plan time; re-verify at dispatch), and the boot fixtures (09's T19(b)) count men, never towers.
- The squad-id derivation scans `S.foeSquads` — boot squads (9000 + mi, mi < 16) and player squads (small integers) sit far below the 9501 floor by construction; restored squads keep their saved ids, so the scan is resume-correct with zero persistence.
- No edits to ai.js, market.js, economy.js, save.js, DepotGame.jsx, InfoCard.jsx, renderer, engine.

## The owner's live check

- His assaults grow variety from the early bells — bought types march at once, priced against the same wall you pay.
- HIS TOWERS RISE: hired towers immediately, and once he owns a tower plan, roughly one new tower a bell while his books allow — standing and fighting at his depot.
- Hired armor parks; hired squads dig in with his garrison; your own hand, prices, and interface are untouched.

## Report requirements

Fixture seeds named (84, 85, 86, 87, 93, 94, 95 are the new ones; 42 re-fixtured in the his-hand block). Every re-teach and every value-shift re-base old → new, each its own bullet. The parkTower fail-proof change named as the knowing behavior delta it is (hemmed rings only, draw-free, boot mirror included). Deviations labeled; none stated as none. The suite count to the digit.
