# P7.1 Task 6 — The starting pick (mk1.68)

Before the war starts, the player picks up to FOUR squads from the full troop list — free kit, no scrap, zero picks legal, NO DUPLICATES (owner, 2026-08-19) — the pick is WHICH squads, one of each type at most. The picks replace the auto-gifted runner squad and breaker pair. The enemy mirrors with four count-stable seeded type draws, DEDUPED LIKE THE PLAYER'S (owner, 2026-08-19 — draw-then-clamp: all four draws always burn, duplicate draws field nothing, so his opening is 2-4 distinct packets), his men fielded draw-free beside his garrison, unbooked like all starting kit. The pick row lives on the pre-battle overlay above TAKE COMMAND, with the T4 ⓘ card on every choice. Phone and desktop, one DOM.

**Rulings executed here** (decision record, 2026-08-19): full troop list; free kit; replaces the fielded start; the enemy mirrors with four count-stable seeded draws.

**Suggested model:** Sonnet — the boot-draw arithmetic and every re-teach are pre-computed below.

## The draw arithmetic (the contract, to the digit)

- OLD boot: 45 draws = regiment 2 + garrison 24 (8 men × 3) + commander 1 + fielded start 18 (6 spawnUnit men × 3).
- NEW boot: **31 draws** = regiment 2 + garrison 24 + commander 1 + **mirror 4** (four type draws, drawn UNCONDITIONALLY — draw-then-clamp — even on a fixture with no enemy depot).
- The mirror's MEN spawn DRAW-FREE (the spotter precedent: fixed ring azimuths, derived walk phase), so the count is 31 whatever four types are drawn.
- The player's picks field at TAKE COMMAND through `makeSquad`/`spawnSquadMembers`, which draw NOTHING — the stream is unmoved whether 0 or 4 squads are picked.
- The muster-fixture count (no regiment): 43 → **29**.

## Stated lines

- The enemy's mirror pool is ALL EIGHT squad types (owner, 2026-08-19: "the enemy should be able to do anything I can do") — rifles ("" ×4), runners (fast ×4), breakers (heavy ×2), sappers (×2), mortars (gren ×2 — his tube is the grenadier), the sniper pair (×2, wired), and TWO NEW ROWS this task creates: his MG TEAM ("mg" ×2, firing the real six-round burst table — one table, both sides) and his ENGINEERS ("eng" ×2, unarmed, standing guard until Task 7 of this phase arms their build lines — ruled). Drawn uniformly, four draws, DUPLICATES DROPPED at fielding — strict symmetry with the player's one-of-each rule.
- Mirror men are hold+garrison, unbooked (free kit both sides, the T9 precedent); they join the market's standing counts like the old fast/heavy did.
- The pick row offers the FULL list regardless of unlocked tiers (ruled) — the bell ladder governs everything after the start.
- `__DEPOTSTART__` (smoke/debug) sets `started` directly and fields nothing — smoke is untouched by construction.
- A RESUME never re-picks or re-fields: the overlay renders only pre-start, and the fielding hook exists only on a fresh boot.
- The T4 info card works pre-start (its render is not started-gated; the "bar" door's CLOSE needs no arming).

## Required reading, in order

1. This plan, whole.
2. `src/depot/muster.js` — whole (the boot block this task reshapes).
3. `src/depot/units.js` — whole (spawnUnit's shape; SNIPER_FIRE's pattern; stepRifleman/stepUnits, which gain the MG and engineer rows).
3b. `src/depot/specs.js:48-70` — ENEMY_SPECS (the two new rows' home); `src/depot/market.js:34-36` — FAMILY_OF_TAG.
4. `src/depot/DepotGame.jsx:1265-1275` — the musterFreshStart call site; `:3436-3443` — startGame; `:3991-4010` — the pre-battle overlay.
5. `src/depot/DepotGame.jsx:671-720` — PALETTE (the pick row's source).
6. `scripts/tests/09-reorg.mjs:55-82` — the T19 boot fixture this task re-teaches.
7. `scripts/tests/05-the-front.mjs:549-600` — the T6 keystone (re-pins, licensed).
8. `scripts/tests/10-command-refit.mjs` — tail (the new asserts; this file runs LAST, so it may call makeMap).

## The sweep license (owner-approved in this plan)

The old fielded start is dying, so every pin that asserts IT re-teaches to the new muster, each old→new reported:

- `09-reorg.mjs` T19(b): 43 → 29 draws; T19(b2): "two player squads muster" dies — re-taught to "no player squad musters at boot — the pick fields at TAKE COMMAND" (`S19.squads.length === 0`); T19(b3): 14 standers → 8 + the mirror's men (seed 4242 — pin the measured count, report it); T19(b5): heads 52 unchanged (the mirror is unbooked).
- `05-the-front.mjs` keystone: hash 3465970090 and draws 695 BOTH re-pin old→new (the T15 precedent — the battle over a reshaped opening legitimately differs).
- Dispatch grep: any other pin on "fielded 18", 45 boot draws, or the boot-time runner/breaker squads re-teaches under the same license. (`08-debug-pass.mjs`'s T12 fixture builds its own men at the 0.9/2.3 azimuths and is SELF-CONTAINED — verified at plan time, untouched.)
- A failure asserting anything OTHER than the old fielded start stops the task.

## Steps

**Step 1 — muster.js: the mirror table and the draw-free man.** After the imports, `SQUAD_SPECS` joins the squads.js import line, `ENEMY_SPECS` joins the specs.js import line, and above `musterFreshStart` add:

```js
// P7.1 T6: THE STARTING PICK's enemy mirror — all eight squad types
// (owner: anything the player can field, he can field).
export const MIRROR_TYPES = [
  { tag: "", n: 4 },       // rifles
  { tag: "fast", n: 4 },   // runners
  { tag: "heavy", n: 2 },  // breakers
  { tag: "sapper", n: 2 }, // sappers
  { tag: "gren", n: 2 },   // mortars — his tube is the grenadier
  { tag: "sniper", n: 2 }, // the pair
  { tag: "mg", n: 2 },     // P7.1 T6 (owner): his MG team — the real burst
  { tag: "eng", n: 2 },    // P7.1 T6 (owner): his shovels — armed at Task 7
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

**Step 2 — muster.js: the boot block reshapes.** In `musterFreshStart`, DELETE the player fielded block (`if (depotP) for (const type of ["runners", "breakers"]) { ... }`) and the enemy fielded block (the `["fast","fast","fast","fast","heavy","heavy"].forEach` braces, whole). In their place:

```js
  // P7.1 T6: THE ENEMY'S STARTING PICK — four type draws, unconditional
  // (draw-then-clamp: a fixture with no enemy depot still burns all four),
  // men spawned draw-free. Boot stream: exactly 31 draws, every seed.
  const mirrorPicks = [];
  for (let d = 0; d < 4; d++) mirrorPicks.push(MIRROR_TYPES[Math.min(MIRROR_TYPES.length - 1, Math.floor(world.rng() * MIRROR_TYPES.length))]);
  {
    const depotE5 = TOWN.find((tt) => tt.depot && tt.team === 2);
    if (depotE5) {
      const gR5 = Math.hypot(depotE5.nx, depotE5.nz) * MASON.pitch / 2 + 5.5;
      let mi = 0;
      const fielded6 = new Set();
      for (const pick of mirrorPicks) {
        if (fielded6.has(pick.tag)) continue; // deduped like the player (owner) — the draw burned, the packet doesn't double
        fielded6.add(pick.tag);
        let pairLead = null;
        for (let k = 0; k < pick.n; k++) {
          const a = (mi / 24) * Math.PI * 2 + 2.0;
          const u = spawnMirrorMan(world, depotE5.x + Math.sin(a) * gR5, depotE5.z + Math.cos(a) * gR5, pick.tag, mi);
          mi++;
          if (pick.tag === "sniper") {  // the pair's roles and link, draw-free
            if (!pairLead) { pairLead = u; u.role = "sniper"; u.bounty = 30; }
            else { u.role = "spotter"; u.bounty = 15; u.pairId = pairLead.id; pairLead.pairId = u.id; }
          }
        }
      }
    }
  }
```

**Step 3 — muster.js: the player's fielding hook.** Below `musterFreshStart`, add:

```js
// P7.1 T6: THE STARTING PICK — up to four squads, free kit, fielded at
// TAKE COMMAND on vetted ground by the player depot. Draw-free end to end
// (makeSquad/spawnSquadMembers touch no rng); zero legal; duplicates dropped here defensively — the UI refuses them first.
export function fieldStartingPicks(world, S, depotP, picks) {
  if (!depotP || !picks) return;
  [...new Set(picks)].slice(0, 4).forEach((type, i) => {
    if (!SQUAD_SPECS[type]) return;
    const a0 = 0.9 + i * 0.7;
    const p0 = clearSlot(world, depotP.x + Math.sin(a0) * 11, depotP.z + Math.cos(a0) * 11, 0.5);
    const sq = makeSquad(S.nextSquadId++, type, 1, p0.x, p0.z);
    spawnSquadMembers(world, sq);
    S.squads.push(sq);
  });
}
```

**Step 4 — specs.js: his two new rows.** `ENEMY_SPECS` gains, after `sniper`:

```js
  // P7.1 T6 (owner): the mirror pool is the player's full list — his MG
  // team and his engineers join the roster. Member stats mirror the player
  // squads' own default man; bounties provisional (F5).
  mg:  { mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, hp: 58, bounty: 8, speed: 3.2, gain: 14, label: "mg team" },
  eng: { mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, hp: 58, bounty: 6, speed: 3.2, gain: 14, label: "engineer" },
```

**Step 5 — units.js: the MG burst and the unarmed shovel.**

- After `SNIPER_FIRE` (line ~205), add:

```js
// P7.1 T6: his MG team fires the player's own MG table — one table, both
// sides, the SNIPER_FIRE pattern (blastR/kv merged, cd aliases fireRate,
// volley carries the burst through shooterFire's existing loop).
export const MG_FIRE = { ...INFANTRY_ARMS.mg, blastR: 0.3, kv: 0.5, cd: INFANTRY_ARMS.mg.fireRate, volley: INFANTRY_ARMS.mg.burst };
```

- In `stepRifleman`, the fspec line becomes `const fspec = sniper ? SNIPER_FIRE : u.tag === "mg" ? MG_FIRE : ENEMY_FIRE.rifle;` and the cooldown ternary becomes `u.fireCd = ((sniper || u.tag === "mg") ? fspec.cd : u.tag === "heavy" ? 1.1 : 1.5) + world.rng() * 0.5;` — nothing else in the function changes.
- In `stepUnits`, directly after the sapper dispatch line (`if (u.tag === "sapper" && stepSapper(world, u, dt)) continue;`), add:

```js
    // P7.1 T6 (owner): his engineers — unarmed shovels until Task 7 arms
    // their build lines. A held engineer stands his ground; an unheld one
    // marches the flow like any man (the future lines walk this way).
    if (u.tag === "eng" && u.hold) {
      u.settled = true;
      u.v.x *= 1 - Math.min(1, 6 * dt); u.v.z *= 1 - Math.min(1, 6 * dt);
      continue;
    }
```

- The rifle dispatch line gains the eng exclusion: `if (u.tag !== "gren" && u.tag !== "sapper" && u.tag !== "eng" && stepRifleman(...)) continue;`

**Step 6 — market.js: the two families.** `FAMILY_OF_TAG` gains `mg: "mgteam", eng: "engineer"` — his standing MG teams and engineers price into the same shared families the player's already do.

**Step 7 — DepotGame: the hook and the start.**

- Import `fieldStartingPicks` on the muster.js import line (40).
- At the boot's fresh branch (line ~1269-1271), directly after `musterFreshStart(world, S, depotP);` add:

```js
        // P7.1 T6: the pick fields at TAKE COMMAND — fresh wars only; a
        // resume's squads are already in the save.
        S.fieldPicks = (picks) => fieldStartingPicks(world, S, depotP, picks);
```

- Component state, beside the tree's useState: `const [picks, setPicks] = useState([]);`
- `startGame` (line 3436) gains one line before `S.started = true;`: `if (S.fieldPicks) S.fieldPicks(picks);`

**Step 8 — the pick row.** In the pre-battle overlay (line ~3991), directly ABOVE the TAKE COMMAND button, add:

```jsx
          <div style={{ fontSize: 11, letterSpacing: 2, color: "#ffd27a", marginBottom: 6 }}>THE MUSTER — PICK UP TO FOUR SQUADS</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", maxWidth: 470, marginBottom: 8 }}>
            {PALETTE.filter((p) => p.key.startsWith("sq_")).map((p) => {
              const t = p.key.slice(3), on = picks.includes(t);
              return (
              <div key={p.key} data-pick={p.key}
                style={{ ...P.slot, position: "relative", minWidth: 60, minHeight: 44, borderColor: on ? "#4aff8c" : "#48515f", color: on ? "#4aff8c" : "#e6ebf1", opacity: !on && picks.length >= 4 ? 0.4 : 1, cursor: "pointer" }}
                onClick={() => { if (on) setPicks(picks.filter((x) => x !== t)); else if (picks.length < 4) setPicks([...picks, t]); }}>
                <div data-info={p.key} onClick={(e) => { e.stopPropagation(); const S = stateRef.current; if (S && S.openInfo) S.openInfo(p.key, "bar"); }}
                  style={{ position: "absolute", top: 0, right: 2, fontSize: 12, opacity: 0.65, padding: "2px 4px", cursor: "pointer" }}>ⓘ</div>
                <div style={{ fontSize: 16 }}>{p.icon}</div>
                <div style={{ fontSize: 10 }}>{p.label}</div>
              </div>
            ); })}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", minHeight: 34, marginBottom: 10 }}>
            {picks.length === 0 && <span style={{ fontSize: 11, opacity: 0.5 }}>none picked — the armor alone is a legal start</span>}
            {picks.map((t, i) => (
              <button key={i} data-picked={t} style={{ ...P.btn, borderColor: "#4aff8c", color: "#4aff8c" }}
                onClick={() => setPicks(picks.filter((_, j) => j !== i))}>
                {(PALETTE_BY_KEY["sq_" + t] || {}).label || t} ✕
              </button>
            ))}
          </div>
```

**Step 9 — the asserts.** Append to `scripts/tests/10-command-refit.mjs` (imports gain `musterFreshStart, fieldStartingPicks, MIRROR_TYPES` from `../../src/depot/muster.js`, `makeMap, TOWN` from `../../src/depot/mapgen.js`, `stepUnits` on the units.js line, and `straightGrid` joins the shared.mjs import — this file runs LAST, so makeMap is safe here):

```js
// ---- P7.1 T6: THE STARTING PICK — the boot draws 29 (fixture scope), the
// mirror stands, the picks field draw-free
{
  makeMap(4242);
  const flatF6 = { heightAt: () => 0, dirty: false, carve: () => {}, normalAt: (x, z, o) => { o.x = 0; o.y = 1; o.z = 0; return o; } };
  const w = makeWorld({ field: flatF6, seed: 4242 });
  let draws = 0; const raw = w.rng;
  w.rng = () => { draws++; return raw(); };
  const S6 = { reg: { heads: 60 }, squads: [], nextSquadId: 1, cmdr: null };
  const depotP6 = TOWN.find((t) => t.depot && t.team !== 2);
  musterFreshStart(w, S6, depotP6);
  ok("T6pick: the fresh start draws exactly 29 (guard 24 + commander 1 + mirror 4)", draws === 29, draws);
  ok("T6pick: no player squad musters at boot", S6.squads.length === 0);
  let mirror = 0;
  for (const b of w.bodies) if (b.kind === "unit" && b.team === 2 && b.garrison && b.alive) mirror++;
  ok("T6pick: the guard and the mirror stand (more than the 8 guard alone)", mirror > 8, mirror);
  const d0 = draws;
  fieldStartingPicks(w, S6, depotP6, ["rifles", "rifles", "sniper", "breakers"]);
  ok("T6pick: duplicates are dropped — three distinct squads field", S6.squads.length === 3 && S6.squads.filter((q) => q.type === "rifles").length === 1);
  ok("T6pick: the fielding draws nothing", draws === d0, draws - d0);
  fieldStartingPicks(w, S6, depotP6, ["mg"]);
  ok("T6pick: a later pick call adds its squad (four total now)", S6.squads.length === 4);
  fieldStartingPicks(w, S6, depotP6, []);
  ok("T6pick: zero picks is a legal start", S6.squads.length === 4);
}
// ---- P7.1 T6: his two new rows behave
{
  const w = makeWorld({ field: flatF, seed: 61 }); w.depotCombat = true;
  ok("T6pick: the mirror pool is all eight types", MIRROR_TYPES.length === 8 && MIRROR_TYPES.some((m) => m.tag === "mg") && MIRROR_TYPES.some((m) => m.tag === "eng"));
  const mgMan = spawnUnit(w, { x: 0, z: 0 }, "mg");
  addBody(w, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x: 0, y: 0.74, z: 10, hp: 58, friction: 0.5 });
  const ev0 = w.events.length;
  for (let i = 0; i < 120 * 5; i++) { stepUnits(w, straightGrid(0, 1), identFwdDir, null); stepWorld(w); }
  ok("T6pick: his MG team fires the burst", w.events.slice(ev0).filter((e) => e.type === "muzzle" && e.weapon === "mg").length > 0);
  const w2 = makeWorld({ field: flatF, seed: 62 }); w2.depotCombat = true;
  const engMan = spawnUnit(w2, { x: 0, z: 0 }, "eng"); engMan.hold = true;
  addBody(w2, { kind: "unit", team: 1, mass: 80, hx: 0.28, hy: 0.72, hz: 0.28, x: 0, y: 0.74, z: 8, hp: 58, friction: 0.5 });
  const ev2 = w2.events.length;
  for (let i = 0; i < 120 * 5; i++) { stepUnits(w2, straightGrid(0, 1), identFwdDir, null); stepWorld(w2); }
  ok("T6pick: his engineer stands unarmed — no muzzle, no march", w2.events.slice(ev2).filter((e) => e.type === "muzzle").length === 0 && Math.hypot(engMan.pos.x, engMan.pos.z) < 2);
}
```

**Step 10 — the re-teaches** (the sweep license above): `09-reorg.mjs:71-80` — T19(b) 43 → 29 with its comment following ("guard 24 + commander 1 + mirror 4"); T19(b2) re-taught to `S19.squads.length === 0` under the new name; T19(b3) re-taught to the measured stander count on seed 4242 (report the number); T19(b5) untouched. `05-the-front.mjs:571` region — keystone hash and draws re-pinned old→new as measured. Then the dispatch grep for stragglers.

**Step 11 — version.** `src/version.js`: `mk1.67` → `mk1.68`. Build AFTER the bump.

## Gates — run ONLY these

1. `node scripts/depot-test.mjs` — 0 failed; expected count 1416 + 10 new = 1426 (T19's re-taught asserts keep their count). Licensed movements ONLY: the T19 re-teaches, the keystone hash+draws re-pin, any grep-found old-fielded-start pin. Anything else red: STOP.
2. `node scripts/smoke.mjs` — preview pattern, all green, mark mk1.68 (`__DEPOTSTART__` bypasses the pick; boot unaffected).
3. `node scripts/depot-lint.mjs` — clean.

Green → commit `src/depot/muster.js`, `src/depot/specs.js`, `src/depot/units.js`, `src/depot/market.js`, `src/depot/DepotGame.jsx`, `scripts/tests/10-command-refit.mjs`, `scripts/tests/09-reorg.mjs`, `scripts/tests/05-the-front.mjs` (if re-pinned), `src/version.js` — subject "the war opens on your terms: the starting pick (mk1.68)" — standing trailers, push.

## Report requirements

Read-confirmation (eight items), one outcome line, then bullets: each step; EVERY re-teach and re-pin old→new (T19 draws, standers, the keystone's hash and draw numbers); each gate with exact counts; commit hash. Every deviation its own labeled bullet. The pick row's look and flow — pick four (a picked slot lights green; re-tapping it or its chip removes it; a fifth or a duplicate is refused), read a card, TAKE COMMAND, meet your squads and the enemy's drawn opening — is the owner's live acceptance, phone and desktop.
