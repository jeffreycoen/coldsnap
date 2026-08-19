# P7.1 Task 3 — Visible health (mk1.63)

A health bar over everything with hp — men, hulls, towers, walls, sandbags — shown ONLY while the thing is hurt. Green draining to red, a dark plate behind it, billboarded above the body. The red hit-flash stays; towers keep their damage-shrink; the depot stays census-only (the building is the readout). A HEALTH toggle button sits beside FOG in the top bar (owner, 2026-08-19), default ON, persisted like FOG. DEPOT only — every other mode renders byte-identical.

**Rulings executed here** (decision record, 2026-08-19): hurt-only bar, everything with hp, hit-flash stays; plus the toggle-beside-FOG addition.

**Suggested model:** Sonnet — render-layer + toggle plumbing, fully specced.

## Scope lines (stated, not open)

- Bars ride kinds `unit`, `vehicle`, `tower`, `wall`, and sandbag chunks — the things with real hp. Trees keep their char-and-flame damage look; rocks and town/depot stone are terrain and census. Wrecks and corpses (`alive === false`) never bar.
- A fog-hidden enemy draws no bar; a seam SILHOUETTE draws no bar either — fog costs identification, and a health readout is identification.
- Sealed riders draw nowhere, so they bar nowhere (the existing `riding` skip).
- Men currently carry no `maxHp` — three spawn sites gain it (the bar's denominator). It rides the save's generic field sweep for free.
- All bar dials (widths, lift, colors) provisional (F5); the look is the owner's live acceptance.

## Required reading, in order

1. This plan, whole.
2. `src/render/renderer.js:830-910` — the pool helper and its neighbors (glint/flake pools; the new pools land here).
3. `src/render/renderer.js:1015-1032` — setFog (the setter pattern setHealth mirrors).
4. `src/render/renderer.js:1510-1845` — render(): the vehicle, tower, wall, unit, and chunk loops the bar hooks join.
5. `src/render/renderer.js:2218` — the return object.
6. `src/depot/units.js:23-78` — spawnUnit/spawnTank (maxHp sites).
7. `src/depot/state.js:709-741` — spawnSquadMembers (maxHp site); `state.js:1524-1535` — HUD0.
8. `src/depot/DepotGame.jsx:1114-1165` — the FOG/DISCIPLINE/WIND boot toggles and the S literal's setFog (the plumbing pattern).
9. `src/depot/DepotGame.jsx:3396-3410` and `:3590-3600` — toggleFog/toggleWind and the FOG/WIND buttons.
10. `scripts/tests/10-command-refit.mjs` — tail (the three new asserts append here).

## Trap notes

- Renderer changes are guarded ADDITIVE divergences — golden must stay green. Everything new gates on `world.depotCombat` (plus the toggle), so demo/TD/campaign/mech draw count-0 pools and nothing else.
- The two bar pools are count-clamped at BAR_CAP like every pool — saturation degrades, never throws.
- `b.hp` defaults to 1e9 on bodies with no real health — they carry no `maxHp`, and the `maxHp` gate skips them by construction. Do not add maxHp anywhere beyond the three named spawn sites.
- The suite moves 1404 → 1407 (the three named asserts) and nowhere else.
- The button is one top-bar element — the bar wraps on phones; phone and desktop both carry it by construction. Place it DIRECTLY after the FOG button (owner: beside the fog one).

## Steps

**Step 1 — renderer.js: the pools and the setter.** After the glint pool block (line 901), add:

```js
  // P7.1 T3: HEALTH BARS — a dark plate and a green-to-red fill over any
  // hurt body that carries maxHp. DEPOT only (world.depotCombat) and
  // toggleable (setHealth) — every other mode draws these pools at count 0.
  // Left-anchored geometry: scaling x drains the fill from the right.
  const barBackGeo = new THREE.PlaneGeometry(1, 1); barBackGeo.translate(0.5, 0, 0);
  const barFillGeo = new THREE.PlaneGeometry(1, 1); barFillGeo.translate(0.5, 0, 0);
  const BAR_CAP = 256; // provisional (F5)
  const barBackMesh = pool(barBackGeo, new THREE.MeshBasicMaterial({ color: 0x10141a, transparent: true, opacity: 0.85, depthWrite: false }), BAR_CAP, false); barBackMesh.layers.set(1);
  const barFillMesh = pool(barFillGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false }), BAR_CAP, false); barFillMesh.layers.set(1);
  const BAR_HI = new THREE.Color(0x4aff8c), BAR_LO = new THREE.Color(0xff4433), _barC = new THREE.Color();
  let healthOn = true;
  function setHealth(v) { healthOn = !!v; }
  const _bars = [];
  const pushBar = (b, w, lift) => {
    if (!healthOn || !world.depotCombat) return;
    if (!b.maxHp || !b.alive || !(b.hp > 0) || b.hp >= b.maxHp) return;
    _bars.push({ b, w, lift });
  };
```

**Step 2 — renderer.js: clear per frame.** Beside `fogDbgTotal = 0; fogDbgVisible = 0;` at the top of render() (line 1518), add `_bars.length = 0;`.

**Step 3 — renderer.js: the five loop hooks.**

- Vehicle loop — directly after `g.quaternion.set(b.q.x, b.q.y, b.q.z, b.q.w);` (~1552): `if (b.kind === "vehicle") pushBar(b, 2.6, 1.0); // provisional (F5)`
- Tower loop — directly after `g.position.set(b.pos.x, b.pos.y, b.pos.z);` (~1582): `pushBar(b, 1.6, 1.0); // provisional (F5)`
- Wall loop — directly after `const dy = Math.max(0.05, b.hy - SEAM_Y);` (~1617): `pushBar(b, 1.2, 0.5); // provisional (F5)`
- Unit loop — directly after the fog block's `fogDbgVisible++;` closes (~1719), before `const sp = ...`: `if (!fogSil) pushBar(b, 0.9, 0.55); // provisional (F5) — a silhouette keeps its secrets`
- Chunk loop — inside, after `const bs = b.sandbag ? SEAM_BAG : 0;` (~1830): `if (b.sandbag) pushBar(b, 1.2, 0.4); // provisional (F5)`

**Step 4 — renderer.js: draw the bars.** Directly after the chunk finalize (`chunkStats = { ... };`, line ~1835), add:

```js
    // P7.1 T3: the collected bars — plate first, fill on top, camera-facing,
    // left edge anchored so the fill drains rightward as hp falls.
    {
      let bi2 = 0;
      for (const e of _bars) {
        if (bi2 >= BAR_CAP) break;
        const b = e.b, f = Math.max(0, Math.min(1, b.hp / b.maxHp));
        dummy.position.set(b.pos.x, b.pos.y + b.hy + e.lift, b.pos.z);
        dummy.position.addScaledVector(camRight, -e.w / 2);
        dummy.quaternion.copy(camQ);
        dummy.scale.set(e.w, 0.14, 1); dummy.updateMatrix();
        barBackMesh.setMatrixAt(bi2, dummy.matrix);
        dummy.scale.set(e.w * f, 0.10, 1); dummy.updateMatrix();
        barFillMesh.setMatrixAt(bi2, dummy.matrix);
        _barC.copy(BAR_LO).lerp(BAR_HI, f);
        if (barFillMesh.setColorAt) barFillMesh.setColorAt(bi2, _barC);
        bi2++;
      }
      barBackMesh.count = bi2; barBackMesh.instanceMatrix.needsUpdate = true;
      barFillMesh.count = bi2; barFillMesh.instanceMatrix.needsUpdate = true;
      if (barFillMesh.instanceColor) barFillMesh.instanceColor.needsUpdate = true;
    }
```

**Step 5 — renderer.js: export.** The return object (line 2218) gains `setHealth,` after `setFog,`.

**Step 6 — the maxHp spawn sites.**

- `src/depot/units.js` spawnUnit: after `u.tag = tag || ""; u.bounty = spec.bounty;` add `u.maxHp = spec.hp;`; in the sniper-pair block after `s.tag = "sniper"; ...` add `s.maxHp = spec.hp;`; in spawnTank after `t.armor = 140;` add `t.maxHp = TANK.hp;`.
- `src/depot/state.js` spawnSquadMembers: after `u.utype = squad.type; u.squadId = squad.id; u.dress = "human";` add `u.maxHp = M.hp;`.

**Step 7 — the toggle plumbing (DepotGame.jsx + state.js).**

- Boot (after the WIND toggle block, ~1149):

```js
      // P7.1 T3 (owner): HEALTH BARS toggle — visual only, beside FOG.
      // Same coldsnap-depot-* persistence pattern. Default ON.
      let healthOn = true;
      try { healthOn = window.localStorage.getItem("coldsnap-depot-health") !== "0"; } catch (e) {}
      R.setHealth(healthOn);
```

- The S literal: `paused: false, speed: 1, fogOn, discipline, windOn,` gains `healthOn,`; beside setWind add:

```js
        setHealth: (v) => { healthOn = v; S.healthOn = v; R.setHealth(v); try { window.localStorage.setItem("coldsnap-depot-health", v ? "1" : "0"); } catch (e) {} },
```

- The hud tick's toggle line (`muted: A.muted, fogOn: S.fogOn, windOn: S.windOn, ...`) gains `healthOn: S.healthOn,`.
- Beside toggleWind (~3401):

```js
  const toggleHealth = () => {
    const S = stateRef.current; if (!S || !S.setHealth) return;
    S.setHealth(!S.healthOn);
    setHud((h) => ({ ...h, healthOn: S.healthOn }));
  };
```

- Directly AFTER the FOG button (line 3593-3595), before the WIND button:

```jsx
        <button data-health style={{ ...P.btn, padding: isTouch ? "5px 10px" : "4px 10px", borderColor: hud.healthOn ? "#7fd7ff" : "#48515f", opacity: hud.healthOn ? 1 : 0.6 }} title="health bars on hurt things (visual only)" onClick={toggleHealth}>
          HEALTH {hud.healthOn ? "ON" : "OFF"}
        </button>
```

- `src/depot/state.js` HUD0 (line 1529): `fogOn: true,` gains `healthOn: true,` beside it.

**Step 8 — the three asserts.** Append to `scripts/tests/10-command-refit.mjs`:

```js
// ---- P7.1 T3: every fielded man knows his full health (maxHp at spawn)
{
  const w = makeWorld({ field: flatF, seed: 31 }); w.depotCombat = true;
  const u = spawnUnit(w, { x: 0, z: 0 }, "");
  ok("T3: an enemy man spawns with maxHp", u.maxHp === u.hp && u.maxHp > 0);
  const t = spawnUnit(w, { x: 10, z: 0 }, "tank");
  ok("T3: wave armor spawns with maxHp", t.maxHp === t.hp && t.maxHp > 0);
  const sq = makeSquad(9, "rifles", 1, -10, 0);
  spawnSquadMembers(w, sq);
  const m = w.byId.get(sq.memberIds[0]);
  ok("T3: a squad man spawns with maxHp", m && m.maxHp === m.hp && m.maxHp > 0);
}
```

**Step 9 — version.** `src/version.js`: `mk1.62` → `mk1.63`. Build AFTER the bump.

## Gates — run ONLY these

1. `node scripts/depot-test.mjs` — 1407 passed / 0 failed (the three T3 asserts; zero other movement).
2. `node scripts/golden.mjs` — green (the renderer additions are depotCombat-gated; the frozen demo path is untouched).
3. `node scripts/smoke.mjs` — preview pattern, all green, mark mk1.63.
4. `node scripts/depot-lint.mjs` — clean (no rng anywhere in this task).

Green → commit `src/render/renderer.js`, `src/depot/units.js`, `src/depot/state.js`, `src/depot/DepotGame.jsx`, `scripts/tests/10-command-refit.mjs`, `src/version.js` — subject "the wounded declare themselves: health bars (mk1.63)" — standing trailers, push.

## Report requirements

Read-confirmation (ten items) first, one outcome line, then bullets: each step, each gate with counts, build, commit hash. Every deviation or re-pin its own labeled bullet. The bars' look, the drain color, and the toggle live on both platforms are the owner's acceptance.

---

# AMENDMENT 1 — taller bars (owner, 2026-08-19, off the mk1.63 live check)

"Health bars work but should be twice as tall." Two numbers in the Step 4 draw block (`src/render/renderer.js`, the bar-draw braces after `chunkStats`): the plate's `dummy.scale.set(e.w, 0.14, 1)` becomes `0.28`; the fill's `dummy.scale.set(e.w * f, 0.10, 1)` becomes `0.20`. Both still provisional (F5). Lands alone as mk1.64; tasks 4-6 shift to mk1.65-mk1.67.

**Gates — run ONLY these:** `node scripts/depot-test.mjs` (1407/0, zero movement), `node scripts/golden.mjs`, `node scripts/smoke.mjs` (preview pattern, mark mk1.64), `node scripts/depot-lint.mjs`. Green → commit `src/render/renderer.js` + `src/version.js`, subject "the bars stand taller (mk1.64)", standing trailers, push. The height is the owner's live acceptance.
