# F1 Verification Fixes — Findings 1-3 (code-bearing; for Jeff's approval; no code until approved)

> **For agentic workers:** one implementer, one task, one commit (mk0.17). Failing asserts first. Scoped verification ONLY (the sections named below — never the full stack; the pipeline runs everything after push). FOREGROUND runs, never background-and-wait. Max 3 cycles then BLOCKED. Report plainly, every deviation its own labeled bullet.

**Goal:** Close verification findings 1-3: (F1) the satchel side-effect measurements exist nowhere in the repo; (F2) mk0.16's "CAREFUL doesn't protect their depot" fix has no test; (F3) mk0.15's "sapper selection doesn't crash" fix has no test.

## Global Constraints
- Measurement + tests ONLY — zero game-behavior changes. If any measurement reveals a defect, report BLOCKED, don't fix.
- Frozen modes + core.js untouched; no `Math.random()` string in src/depot; no rng-contract changes.
- Version: bump src/version.js MK to "mk0.17" in the commit.
- Commit trailer: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

## Verified anchors (re-verify by reading)
- `scripts/measure-satchel.mjs` — the depot charge-curve harness (Task 4½); extend, don't fork.
- `SATCHEL` constant: src/depot/specs.js (shared spec {r:5, kv:45}).
- friendlyBlocksPoint depot2 exclusion: src/depot/state.js:426-429 (the mk0.16 clause `b.town !== "depot2"`).
- friendlyFouls: src/depot/state.js (the CAREFUL predicate towerShot consults via DepotGame stepTowers).
- squadReach unarmed guard: src/depot/accuracy.js ~:237-239 (`if (!arms) return null`).
- Test file: scripts/depot-test.mjs — add one `==== F1 VERIFICATION FIXES (mk0.17)` block; the F1/4½ sections show the fixture style (flat(), makeWorld, addBody chunk with town tag).

---

### Task: the missing evidence (one commit, three parts)

**Part A — satchel side-effect measurements, in-tree (finding 1).**

Extend `scripts/measure-satchel.mjs` with a `--sides` mode (foreground, headless, prints a table; not a CI gate):

```js
// --sides: the four side-measurements the Task 4.5 amendment required.
// Old {r:3.4, kv:9} vs shipped SATCHEL {r:5, kv:45}, chest-height charge:
//  1. WALL (hp 100, kind "wall"):  hp damage at d = 1..6m  → kill range + damage reach
//  2. TOWER (hp 130, kind "tower"): hp damage at d = 1..6m
//  3. UNIT (hp 58, kind "unit"):   lethal radius (binary-search d where hp<=0) + shove |v| at d=0.5
//  4. OWN-TEAM SPLASH: planter + a friendly member at d = 1..4m → who dies
// Each cell: fresh world, one explode() with the spec under test, read hp/v after one step.
// Print old → new per cell. These are the recorded numbers from the mk0.14 report —
// the harness makes them reproducible instead of historical.
```

Run it once; paste the table into the Task 4½ section of `2026-08-11-front-f1-second-depot.md` (plan doc = the permanent record).

One pinning assert in depot-test (the number the enemy throws at YOUR walls — the loud flag):

```js
// F1-fix A: enemy satchel vs player wall — pin the shipped reality so a future
// SATCHEL retune shows up here as a conscious change, not silent drift.
// (Values from the --sides run; assert a band, not equality — physics settle noise.)
{
  const world = makeWorld({ field: flat(), seed: 11 });
  const wall = addBody(world, { kind: "wall", team: 1, mass: 0, hx: .9, hy: .9, hz: .9, x: 0, y: .9, z: 0, hp: 100 });
  explode(world, 0, 1.2, 4, { ...SATCHEL, attacker: "enemy" });   // d=4m — the measured 47-damage case
  stepWorld(world);
  const dmg = 100 - wall.hp;
  ok("F1-fix A: satchel-vs-wall damage at 4m within the recorded band", dmg > 35 && dmg < 60);
}
```

**Part B — pin mk0.16 (finding 2): CAREFUL never protects their depot.**

```js
// F1-fix B: friendlyFouls holds for OWN depot masonry, fires through THEIRS.
{
  const world = makeWorld({ field: flat(), seed: 12 });
  const spec = { projSpeed: 95, occl: "arc" };
  const muzzle = { x: 0, y: 1.5, z: 0 }, tgt = { x: 0, y: 1.2, z: 16 };
  const c = addBody(world, { kind: "chunk", team: 0, mass: 100, hx: .4, hy: .4, hz: .4, x: 0, y: 1.2, z: 8, hp: 50 });
  c.town = "depot";
  ok("F1-fix B: CAREFUL holds for own depot stone", friendlyFouls(world, muzzle, tgt, spec) === true);
  c.town = "depot2";
  ok("F1-fix B: CAREFUL fires through enemy depot stone", friendlyFouls(world, muzzle, tgt, spec) === false);
}
```

**Part C — pin mk0.15 (finding 3): unarmed squads never crash selection.**

```js
// F1-fix C: squadReach is null for sappers (no arms — no fan, no fault) and
// still a 64-point fan for armed squads.
{
  const world = makeWorld({ field: flat(), seed: 13 });
  const u = addBody(world, { kind: "unit", team: 1, mass: 80, hx: .28, hy: .72, hz: .28, x: 0, y: 1, z: 0, hp: 58 });
  const sap = makeSquad(1, "sappers", 1, 0, 0); sap.memberIds.push(u.id);
  ok("F1-fix C: sapper squadReach null", squadReach(world, sap) === null);
  const rif = makeSquad(2, "rifles", 1, 0, 0); rif.memberIds.push(u.id);
  const pts = squadReach(world, rif);
  ok("F1-fix C: armed squadReach 64-point fan", Array.isArray(pts) && pts.length === 64);
}
```

**Plan-note fold-ins (findings 4/6, one line each, no code):** append to the F1 plan's Task 4½ section — "Declared post-ship: a sapper squad on ATTACK does not settle to defend while a charge is carried (second charge was wasted otherwise)" and "Task 3's 'hp drops' asserts measure displacement (stones have no hp) — deviation recorded here, not just in test comments." Delete the dead always-true assert at depot-test.mjs:4932 (finding 5) — its real coverage on the following line stays.

- [ ] **Step 1:** write Parts A-C asserts + the --sides mode; verify B and C asserts PASS immediately (they pin shipped behavior — if either FAILS, that's a live defect: STOP, report BLOCKED); verify A's band against the fresh --sides numbers.
- [ ] **Step 2:** run the --sides table; paste into the F1 plan; make the two plan notes; delete the dead assert.
- [ ] **Step 3 — scoped verification only:** `node scripts/depot-test.mjs` (the one changed gate) + `npm run build`. NOT the accuracy suite, NOT the browser suite — nothing they cover changed.
- [ ] **Step 4:** Commit "mk0.17: the evidence exists — satchel side-measurements in-tree, hotfix pins, plan notes" (MK bumped) → PUSH → FOREGROUND CI poll → report: the --sides table, each assert's result, EVERY deviation bulleted.

---

## Self-review notes
- Pure evidence work: any behavior change discovered = BLOCKED, never fixed silently.
- Part A pins a BAND, not exact values — the physics has settle noise; the band still catches a retune.
- Findings 4/5/6 fold in as documentation because they cost one line each; separating them would be process overhead with no safety gain.
