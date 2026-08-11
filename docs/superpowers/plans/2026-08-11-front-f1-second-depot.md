# FRONT F1 — The Second Depot (for Jeff's approval; no code until approved)

> **For agentic workers:** superpowers:subagent-driven-development, tasks in order, one implementer at a time. Failing asserts first. Commit + PUSH per task, FOREGROUND CI polls, max 3 cycles then BLOCKED. Reports to Jeff: plain language, every nonconformity its own labeled bullet.

**Goal:** The enemy gets a depot — real masonry at their end of the valley, breachable by the same physics as yours — and the war gets its one true ending: a depot falls. Yours = defeat, theirs = victory. This lands vision picks 2 (destroy to win) and 5 (depot-fall is the only game-over). The wave heartbeat stays for now (F2 replaces it); the enemy doesn't defend its depot yet (F3 gives them builders and garrisons — in F1, distance and their army in the field are its defense).

**Vision:** docs/superpowers/plans/2026-08-11-depot-front-vision.md.

## Global Constraints
- Frozen modes + core.js untouched. No `Math.random()` in src/depot. Rng contracts exact; every new decision path draw-free.
- Laws: structure fire never fog-gates; unit fire always fog-gates; owner/selfId threaded on every new fire path; symmetry.
- All numbers provisional (balance pass owns them); label each in-code.
- Scoped gates per task: `node scripts/depot-test.mjs && npm run test:accuracy && npm run lint:depot && npm run build && SMOKE_ONLY=depot node scripts/smoke.mjs` (+`test:td-render` when renderer touched).
- Commit trailer: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

---

### Task 1: their depot stands

**Files:** `src/depot/DepotGame.jsx` (genMap, buildTown, emitters), `src/depot/territory.js` (EMIT reuse only), `src/render/renderer.js` (flag tint by team — DEPOT-gated), `scripts/depot-test.mjs`.

- genMap gains the enemy depot: same footprint as yours (9×7×6, door, corner posts — symmetry), centered at canonical (0, −49) area behind their spawn line (exact spot must clear spawn points, roads, and connectivity — derive at map build, assert clearance). Entry `{id:"depot2", depot:true, team:2}`.
- buildTown builds it exactly like yours: weld ×1.5 (built like it matters — both of them), roof-peak flag body with `team: 2`. Renderer draws the flag cloth tinted by flag team (red for theirs) — DEPOT-gated, other modes unchanged.
- Territory: the enemy depot's flag emits red at EMIT.depot weight/radius (36m — their homeland mirrors yours). The permanent spawn-edge anchor emitters RETIRE — their depot IS their anchor now. Spawn points remain as muster locations only.
- Flow-field/grid: their depot's cells block like any town building; connectivity check covers both depots' approaches.
- [ ] **Failing asserts:** depot2 lattice exists with the same stone count law as yours; flag body team 2; red field reaches ~36m around it; anchors gone (field near spawn edge now decays once their army leaves); connectivity both directions; twin determinism; map-seed sweep (20 seeds) — depot2 placement never collides with roads/rocks/ponds/spawns.
- [ ] fail → implement → gates → Commit "FRONT F1: their depot stands — real stone at the other end" → PUSH + report.

### Task 2: both depots can fall

**Files:** `src/depot/state.js` (second census/breach track), `src/depot/DepotGame.jsx` (wiring), `scripts/depot-test.mjs`.

- censusDepotChunks runs per depot (filter by town id: "depot" and "depot2"); stepDepotCensus drives both at the same ~1Hz gate; standing fraction below DEPOT_BREACH_FRAC (0.58, provisional, same both sides — symmetry):
  - yours → `S.gameOver = true, S.breach = true` (exists today);
  - theirs → `S.victory = true, S.enemyBreach = true` (new).
- End cards (bureau voice, digit-free): theirs falls → "THE OPPOSING DEPOT IS BREACHED. / The position opposite is rubble. The field belongs to the Bureau." Yours falls → existing breach card unchanged.
- [ ] **Failing asserts:** scripted demolition of depot2 past the threshold → victory with the new card; scripted demolition of yours → loss (existing, re-pinned); both idempotent, neither double-fires; fraction exposed for both on the state hook; twin determinism.
- [ ] fail → implement → gates → Commit "FRONT F1: both depots can fall" → PUSH + report.

### Task 3: the only ending (vision pick 5)

**Files:** `src/depot/state.js`, `src/depot/units.js` (checkLeaks retired), `src/depot/DepotGame.jsx` (HUD), `scripts/depot-test.mjs`.

- **Lives retire.** The ♥ counter leaves the HUD; leak damage leaves the game. checkLeaks is DELETED — an enemy that reaches your depot no longer despawns for a bookkeeping cost; he stays and fights (his structure fire already chews masonry; sappers already breach). Physical threat replaces the abstract one.
- **Economic endings become means:** checkWin's book-value verdict, attrition, and spent-offensive STOP ending the run (machinery stays — combatIneffective/starvation still gut the enemy's ability to field waves, which is how economic strangulation now wins: an undefended depot). checkLoss keeps only the breach track (+ the stubbed regiment hook).
- **Waves cycle:** past the table's end, wave composition loops its late-game mix (index clamps/cycles — provisional note; F2 replaces this machinery wholesale). The run ends ONLY when a depot falls.
- Dispatch/end-card copy audit: no card may reference lives, wave-50 survival, or ledger verdicts as endings.
- [ ] **Failing asserts:** an enemy reaching your depot survives and damages masonry (no despawn, no lives event); run continues past wave 50; forced combatIneffective no longer sets victory (but its wave-fielding collapse is observable); the ONLY two run-enders are the two breaches; stale HUD/card strings gone (grep pins); twin determinism.
- [ ] fail → implement → gates → Commit "FRONT F1: one way to win, one way to lose" → PUSH + report.

### Task 4: your rifles learn to bite stone (the offense exists)

**Files:** `src/depot/state.js` (squadFire), `src/depot/specs.js` (if a structure-fire delta is needed — measure first), `scripts/depot-test.mjs`.

**Why:** today player squads target only enemy units — with no garrison at depot2 (until F3), the player would have NO way to attack it. The enemy's riflemen already shoot player structures; symmetry demands the mirror.
- squadFire gains structure targeting, exactly mirroring the enemy rifleman's rules: when no unit target is in reach, the nearest enemy-side structure in range (depot2 chunks in F1; enemy towers/walls when F3 builds them) — structure fire never fog-gates (the law), fired with hitStruct + hitOnly "structure" + owner, through the same accuracy model. Anti-personnel keeps priority (units first — the existing urgency rule mirrored).
- Enemy depot chunks need a targetable marking (`b.town === "depot2"` → hostile-structure set for team 1; the mirror set for team 2 already exists as towers/walls). Deterministic target pick (nearest, then id order).
- Expected pace, measured and reported (not tuned): rifles/mg chew stone slowly; sappers don't exist player-side; the real siege tools arrive with F3/F6 (enemy towers to capture ground with, the Bison). F1's win is a long infantry siege — acceptable for this phase, stated plainly to Jeff for playtest framing.
- [ ] **Failing asserts:** an ordered squad in range of depot2 fires on it and stone hp drops; unit targets still outrank stone; fog never gates the stone shots (law, both directions); owner threaded (no self-hits); flagged damage parity on unit targets unchanged; twin determinism.
- [ ] fail → implement → gates → Commit "FRONT F1: the offense exists — rifles bite stone" → PUSH + report.

### Task 5: closer — probe sanity + smoke + Jeff plays

**Files:** `scripts/economy-probe.mjs` (teach it the new endings: verdicts become breach-based; sanity = a median defense survives meaningfully, no-defense loses by breach, a scripted siege can win), `scripts/smoke.mjs` (two-depot section: red flag visible, enemy reaching depot fights instead of despawning, scripted depot2 demolition → victory card; rotated variant), stale-doc cleanup fold-in (state.js armor comment, roadmap table note).
- [ ] Gates + 20-seed probe run recorded (baseline for F2, not tuned) → Commit "FRONT F1 closes: two depots, one ending" → PUSH + report with the matrix and playtest framing: what should feel different, what F2/F3 will fix (pacing, the undefended far depot), one phone screenshot of their depot under fire.

---

## Self-review notes
- Scope discipline: no heartbeat changes (F2), no enemy builders (F3), no new player weapons — the four structural changes only (their depot, symmetric fall, single ending, minimal offense).
- Task 4 is the one gameplay addition and it's the smallest honest mirror of an existing enemy behavior; without it the phase ships an unwinnable game.
- Retiring lives/leaks changes wave-clear dynamics (attackers linger at your walls until timeout) — the wave timeout (75s) already bounds it; probe watches withdrawal rates.
- Numbers introduced (depot2 position, breach threshold reuse, structure-fire pace): all provisional, labeled, F5's problem.
