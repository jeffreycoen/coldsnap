# Gravity's Ark — the space phase opens

Opened 2026-09-10, following The Trimmed Range (closed at 0.4.13).
Phase mark 0.5. The long line: a space-faring mode — welded-cube
ships in the real engine, seeded star systems, planetside wars on
valley seeds, the machine as cargo. Built small, one drivable
increment at a time, exactly as the mech line was.

Standing rulings for this phase:

- **The floppy law is SUSPENDED.** The 1.44 megabyte claim stops
  binding while the ark grows; the README's floppy sentence gets
  re-ruled at this phase's closeout.
- The reference works live in the repo under
  `docs/superpowers/reference/`: the gravity sandbox (the seeded
  system generator, flight, and art this phase ports first) and the
  deadweight hangar (the welded-ship economy that informs later
  phases).

| Task | Mark | What lands | Status |
|---|---|---|---|
| T1 | 0.5.0 | GRAVITY'S ARK behind THE PROVING RANGE: the gravity sandbox ported whole as its own module — seeded systems, real orbits, drag-to-burn flight, the 60-level ladder as it stands | LANDED ccd846c00bd9761d5eff73888e01cc8db7d1219f — smoke 23 PASS, 0 FAIL |
| T2 | 0.5.1 | The ark's physics and seeded generator carved out of the component into their own modules — hashes identical, 7/7 | LANDED e7b1448 — smoke 23 PASS, 0 FAIL |
| T3 | 0.5.2 | The drawn frame carves out into its own module; the 60-level ladder retires for one grand system — nine planets, a star, two nebulae, four comets, sixty asteroids, three gates, three fuel caches, across a field twice the old length and width | LANDED ecfe6ec964fc775c95e89738b6754f6af40c9847 — smoke 23 PASS, 0 FAIL — generator hashes at seed 12345: n=0 c94dfccbc4b24065, n=1 77d6c9d46acbf70e, n=2 4821351631a50239 |
| T4 | 0.5.3 | The gate count drops from three to one; the two mid-field waypoints retire, the single gate stays the destination gate at the far end of the field | LANDED b49564d — smoke 23 PASS, 0 FAIL — generator hashes at seed 12345: n=0 83f4020d9011bf74, n=1 4ef7e270c24f35d8, n=2 efae00dd3c323f29 |
| T5 | 0.5.4 | The interface carves out into `hud.jsx`; the camera comes near and rests on the ship; a compass arrow points to the gate when it is off frame | LANDED cbf0762 — smoke 23 PASS, 0 FAIL — generator hashes at seed 12345: n=0 83f4020d9011bf74, n=1 4ef7e270c24f35d8, n=2 efae00dd3c323f29 |
| T6 | 0.5.5 | The start screen's quiet text gets bigger and brighter: the mark, the field order number, the button briefs, the stale-save note, the footer hint | LANDED efbbb4e5c9d62efc183f3e14eb558af01312f02e — smoke 23 PASS, 0 FAIL |
| T7 | 0.5.6 | MENU joins the top-right chip row; the debug readout moves above the control rows; the grid follows the camera; the nebula labels go; the aim controls fit a phone width | LANDED 24a273d27e5991817e00ccad65bc94d976c9c732 — smoke 23 PASS, 0 FAIL — generator hashes at seed 12345: n=0 83f4020d9011bf74, n=1 4ef7e270c24f35d8, n=2 efae00dd3c323f29 |
| T8 | 0.5.7 | RUBBLE WORLDS docks behind the proving range: block planets under real gravity, two scenarios behind one chip — BINARY (two planets in a decaying mutual orbit ending in collision) and BLACK HOLE (one planet streaming into a kill radius in pieces); WELDS and SLEEP toggle live; the ark's delta-v pill and top panel gain userSelect none | LANDED 4988c08 — smoke 23 PASS, 0 FAIL — generator hashes at seed 12345: n=0 83f4020d9011bf74, n=1 4ef7e270c24f35d8, n=2 efae00dd3c323f29 |
| T9 | 0.5.8 | RUBBLE WORLDS rebuilt whole: true spheres of 93 cube blocks in a 3D lattice, physics in all three axes under the same 1/r^2.3 softened law, the ark's bent gravity-well grid under the scene, the hole's rim glow and dashed event horizon; scenario chips, WELDS and SLEEP live arms, seed, counts, contact, welds, sleep, and tide wake unchanged in behavior | LANDED 108b76f — smoke 23 PASS, 0 FAIL — generator hashes at seed 12345: n=0 83f4020d9011bf74, n=1 4ef7e270c24f35d8, n=2 efae00dd3c323f29 |
| T10 | 0.5.9 | The contact spring stiffness drops from 900 to 150, damping rises from 4 to 10 — the binary meeting stays a bound pile instead of detonating; sleeping aggregates gain a proximity wake so a clump wakes before anything can touch it, instead of slingshotting as a bare point; the black-hole dive re-tunes from 60% to 53% of circular for the stable contact | LANDED a773756 — smoke 23 PASS, 0 FAIL — generator hashes at seed 12345: n=0 83f4020d9011bf74, n=1 4ef7e270c24f35d8, n=2 efae00dd3c323f29 |
| T11 | 0.5.10 | Contact becomes the war engine's solver — sequential impulses, accumulated and clamped, a capped Baumgarte bias, warm-started, eight sweeps; welds become distance constraints in the same loop, breaking past 1.35 stretch; the gravity net reads clump mass and center live every frame; each cube lights by its outward direction from the clump center against an up-left sun | LANDED 9753951 — smoke 23 PASS, 0 FAIL — generator hashes at seed 12345: n=0 83f4020d9011bf74, n=1 4ef7e270c24f35d8, n=2 efae00dd3c323f29 |
| T12 | 0.5.11 | Two new scenes prove stable orbits: HEAVY AND LIGHT (a 6000-mass and a 1500-mass world on circular speed around their shared center) and MOONS (three light moons at 60, 105, 160 on circular speed around one planet); cubes draw at full lattice pitch, faces touching; the camera holds fixed per scene, centered on the origin at a span the scene sets; weld bias rises to 0.35 with break stretch 2.2 so welds carry load before breaking | LANDED dd11d8d — smoke 23 PASS, 0 FAIL — generator hashes at seed 12345: n=0 83f4020d9011bf74, n=1 4ef7e270c24f35d8, n=2 efae00dd3c323f29 |
| T13 | 0.5.12 | The weld instability found and killed: a welded pair belongs to its weld alone, contact skips it while the weld lives. Two new scenes: TRIO (three equal worlds on a rotating equilateral triangle) and SYSTEM (a pinned star, nine light planets on rings, planet-to-planet gravity at 1%). Six scene chips (TWINS, DUET, MOONS, TRIO, SYSTEM, HOLE) replace the cycle chip; the world logs a line each second and a LOG chip copies the record with seed, scene, arms, and mark. Deep wells (the hole, the star) get their own steeper, higher funnel apart from the planets' gentle dish | LANDED a47d9db — smoke 23 PASS, 0 FAIL — generator hashes at seed 12345: n=0 83f4020d9011bf74, n=1 4ef7e270c24f35d8, n=2 efae00dd3c323f29 |
| T14 | 0.5.13 | Two defects fixed: a clump near another clump, the hole, or the star may not sleep, and the contact walk pairs an awake block against every alive block instead of the old ascending-index walk that left half the sleeping blocks untouchable — the trio no longer detonates on approach. Welds now break by the impulse they carry each frame (strength 30), not by stretch alone, since the constraint itself holds stretch near zero — the hole's tide tears welds instead of slingshotting the welded remnant out whole | LANDED 4f140da — smoke 23 PASS, 0 FAIL — generator hashes at seed 12345: n=0 83f4020d9011bf74, n=1 4ef7e270c24f35d8, n=2 efae00dd3c323f29 |
| T15 | 0.5.14 | Blocks carry their own size (pitch and contact radius), read by contact, welds, the clump scan, and the cube drawing. Two new scenes: GIANT (a 2x world, 751 blocks at standard pitch, mass 48000, two moons) and TITAN (a 5x world at the same 751 blocks by growing the block pitch to 15, mass 750000, two moons). Every clump above mass 500 draws its projected orbit twenty seconds ahead, refreshed every third frame — green while clear, red through the last two seconds before a predicted contact, ending at the impact. A time row (×½, ×1, ×2, ×5) runs the physics that many steps per rendered frame without changing render cadence | LANDED 56edda8 — smoke 23 PASS, 0 FAIL — generator hashes at seed 12345: n=0 83f4020d9011bf74, n=1 4ef7e270c24f35d8, n=2 efae00dd3c323f29 |
| T16 | 0.5.15 | The GIANT and TITAN scenes retire: a SIZE arm (1x, 2x, 5x) now applies to every scenario, scaling every planet's radius by the size, its mass by the cube, and every orbit distance and span by the size, the hole and the star included. Block pitch comes from a budget — a scene carries about 1700 blocks split across its planets. Weld strength is now per size (30, 160, 185), each the measured calm load with the same 1.76x margin the 1x carries. All chip rows move into one bottom-anchored column that stacks and grows upward; the panel's seed/fps and counts lines rise from 8-pixel to 11-pixel. Orbit line weight rises to 2.2 with a deeper green and a floor opacity a quarter to the far end | LANDED 70fe198 — smoke 23 PASS, 0 FAIL — generator hashes at seed 12345: n=0 83f4020d9011bf74, n=1 4ef7e270c24f35d8, n=2 efae00dd3c323f29 |
| T17 | 0.5.16 | The half-speed gate now counts rendered frames instead of physics steps, so ×½ actually halves instead of freezing on the first skipped frame. SIZE now scales the blocks, not the count: pitch grows with the world so a 2x or 5x planet is the same 93 blocks at 2x or 5x the cube — performance identical at every size; the block-budget machinery retires. The layered-shell idea (finer surfaces on big worlds) failed eight measured configurations and goes to the polish queue as its own experiment | LANDED b35e524 — smoke 23 PASS, 0 FAIL — generator hashes at seed 12345: n=0 83f4020d9011bf74, n=1 4ef7e270c24f35d8, n=2 efae00dd3c323f29 |
| T18 | 0.5.17 | The demo's 549-line component splits into rubbleworlds/phys.js, gen.js, and draw.js; RubbleWorlds.jsx keeps the loop, chips, and log plumbing. The gravity net scales by the square root of the scene's size instead of full proportional scaling | LANDED d5e89c3 — smoke 23 PASS, 0 FAIL — evolution hash 42ae90b308d1e6f6 — ark generator hashes at seed 12345: n=0 83f4020d9011bf74, n=1 4ef7e270c24f35d8, n=2 efae00dd3c323f29 |
| T19 | 0.5.18 | One absolute world scale replaces the fit-to-scene camera — every scene and size renders at one fixed scale, a 1x world reads small, a 5x world overflows the frame. The view rests on the mass-weighted center of the tracked clumps, the hole, and the star; a drag pans the playfield, a quick second tap hands the view back to the mass. The net follows the camera at fixed weave, the absolute ruler across sizes; the square-root rider retires. Landed via amendment 1 after the first dispatch stopped at a stale anchor — the T18 plan's prose promised the square-root rider but the embedded script predated that amendment, so T18 landed riderless; the anchor gate caught it before any damage, and this amendment's step 1 finished the camera work from that stopped state | LANDED 138bba2 — smoke 23 PASS, 0 FAIL — evolution hash 42ae90b308d1e6f6 — ark generator hashes at seed 12345: n=0 83f4020d9011bf74, n=1 4ef7e270c24f35d8, n=2 efae00dd3c323f29 |
| T20 | 0.5.19 | The physics file replaced whole: a HASH chip (default off) arms the war engine's two-tier broadphase, dual-pathed against the old brute walk, off byte-identical to 0.5.18; a FRICTION chip (default off) arms translational tangential clamping at mu 0.6, capped by the normal impulse, welded pairs exempt. Solver tiers drop sweeps from 8 only past constraint loads calm scenes never reach. Every awake block draws in red instead of its planet tint — the live gauge of what sleep is doing. Milliseconds per physics step join the panel line and every flight-log entry, with the active arms recorded beside it | LANDED c741562 — smoke 23 PASS, 0 FAIL — evolution 10s hash=false 42ae90b308d1e6f6 — evolution 10s hash=true 42ae90b308d1e6f6 — ark generator hashes at seed 12345: n=0 83f4020d9011bf74, n=1 4ef7e270c24f35d8, n=2 efae00dd3c323f29 |
| T21 | 0.5.20 | The physics file replaced whole again: the clump scan fits each clump's rigid rotation about the vertical axis and measures calm as deviation from rotation plus translation, so a merged world's orbital spin no longer forbids it to sleep — a sleeping aggregate rotates its member offsets each step, a sleeping top and not a frozen one. Cold welding: an unwelded touching pair whose normal relative velocity stays under 0.3 for 30 frames fuses at its current spacing, at 0.6 of born-weld strength, under the same force-break law. The moons planet's inner moon moves from radius 60 to 70, clearing the planet's own no-sleep margin. Left open: the merged twin binary still churns and does not sleep at any arm setting, part-welded, part-rubble, grinding under sustained spin loads — the rigid-body promotion task's to close, queued next | LANDED 291042f — smoke 23 PASS, 0 FAIL — evolution 10s hash=false 42ae90b308d1e6f6 — evolution 10s hash=true 42ae90b308d1e6f6 — moons re-pin a811e0bfa627ce3f to 55e26401d110fa2c — ark generator hashes at seed 12345: n=0 83f4020d9011bf74, n=1 4ef7e270c24f35d8, n=2 efae00dd3c323f29 |
| T22 | 0.5.21 | The physics file replaced whole again: an awake weld-island of ten or more blocks promotes to a rigid body — one mass, one velocity, one vertical spin, a true moment of inertia. Members conform to the body every step; internal welds leave the solver; contacts against the body resolve as impulses through effective masses at the contact arm, with rotational response. Islands re-derive every frame from the weld graph, so weld breaking is fracture and cold welding is accretion. Friction now reads slip at the material point — body velocity plus spin at the arm — so two spinning bodies can couple, synchronize, and lock. The T21 open case closes: the merged twin binary promotes to two rigid bodies, 910 of 1016 welds survive, interface friction locks the pair into one combined rotation, and all 186 blocks sleep by 120 seconds at 1x; at 2x the spins are measured synchronized and decaying toward lock (0.69 to 0.31 across five minutes), eight times the inertia taking honestly longer | LANDED b1a1841 — smoke 23 PASS, 0 FAIL — evolution 10s hash=false 42ae90b308d1e6f6 — evolution 10s hash=true 42ae90b308d1e6f6 — ark generator hashes at seed 12345: n=0 83f4020d9011bf74, n=1 4ef7e270c24f35d8, n=2 efae00dd3c323f29 — T21 open case CLOSED at 1x, locking at 2x |
| T23 | 0.5.22 | The physics file replaced whole again: contact and cross-island weld solves now read contact-point velocities from the BODY state instead of stale member velocities, making the sweep truly sequential over bodies — fixes the seed-24199 detonation, a fifty-fold overshoot per sweep at first hard contact on the merged twins. Warm starts route through the same impulse application as the solver instead of applying stored impulses directly to member velocities | LANDED c990665c1f9ce3d9557dc4600a5a3e6d931043ac — smoke 23 PASS, 0 FAIL — evolution 10s hash=false 42ae90b308d1e6f6 — evolution 10s hash=true 42ae90b308d1e6f6 — ark generator hashes at seed 12345: n=0 83f4020d9011bf74, n=1 4ef7e270c24f35d8, n=2 efae00dd3c323f29 — blast seed bound: PASS vmax 55 rmax 102 |
| T24 | 0.5.23 | A new SHIP scene: a five-module cross — cabin, engine, two tanks, nose — welded, rigid at any size, gold, never painted red. In the ship scene a drag aims a burn: LAUNCH from rest, PLAN BURN freezes the sim, EXECUTE fires or CANCEL stands down; burns land as uniform delta-v on the hull, cost fuel from a budget of 520, the panel shows the tank, the aimed burn flies ahead as a ghost on the orbit predictor. The shatter rule arrives: an island the solver jerks harder than threshold 12 in one frame demotes for 20 frames, its welds face the true forces, survivors re-promote — ship welds never cold-weld, damage stays damage. The blast-seed acceptance moves from vmax 55 rmax 102 to vmax 76 rmax 173, the rule working as intended | LANDED 84b3b9b — smoke 23 PASS, 0 FAIL — evolution 10s hash=false 42ae90b308d1e6f6 — evolution 10s hash=true 42ae90b308d1e6f6 — ship s1 66300fdf76b09183 — binary s1 1ab5dec0a100e39f — duet s1 815c1643021c10c9 — moons s1 55e26401d110fa2c — trio s1 7cbf8f6bbd428266 — system s1 1bbb5a4a3205c09c — hole s1 cae5ebf64cc05676 — blast seed bound: PASS vmax 76 rmax 173 — ark generator hashes at seed 12345: n=0 83f4020d9011bf74, n=1 4ef7e270c24f35d8, n=2 efae00dd3c323f29 — blast-seed re-pin vmax 55 rmax 102 to vmax 76 rmax 173 |
| T25 | 0.5.24 | Four flight-feel gaps ported from the ark's own behavior: in the ship scene the camera rides the ship unless a drag takes the wheel, double-tap hands it back to the follow; a tap of the sky in flight pauses the sim under a pale veil, the next tap resumes, entering plan burn clears any pause; while an aim is locked, the ark's nudge row stands — turn left, less, more, turn right — and plan mode wears its TIME FROZEN banner; while aiming or planning, the scene row and size chips hide, only the flight controls stand | LANDED a12c52c — smoke 23 PASS, 0 FAIL — evolution 10s hash=false 42ae90b308d1e6f6 — evolution 10s hash=true 42ae90b308d1e6f6 — ship s1 66300fdf76b09183 — binary s1 1ab5dec0a100e39f — duet s1 815c1643021c10c9 — moons s1 55e26401d110fa2c — trio s1 7cbf8f6bbd428266 — system s1 1bbb5a4a3205c09c — hole s1 cae5ebf64cc05676 — ark generator hashes at seed 12345: n=0 83f4020d9011bf74, n=1 4ef7e270c24f35d8, n=2 efae00dd3c323f29 |
| T26 | 0.5.25 | The freeze gate now holds the sim through the ship's aim phase exactly as it holds plan mode — time starts at LAUNCH, so the ship no longer falls uncommanded from its spawn before the first order. Open: a fast rigid body striking a lattice detonates it (a second, unfixed defect from the owner's seed-78994 flight log); a speed-aware wake margin was benched against it and rejected on measurement — OPEN, queued for its own experiment | LANDED 5ef195f — smoke 23 PASS, 0 FAIL — evolution 10s hash=false 42ae90b308d1e6f6 — evolution 10s hash=true 42ae90b308d1e6f6 — ship s1 66300fdf76b09183 — binary s1 1ab5dec0a100e39f — duet s1 815c1643021c10c9 — moons s1 55e26401d110fa2c — trio s1 7cbf8f6bbd428266 — system s1 1bbb5a4a3205c09c — hole s1 cae5ebf64cc05676 — ark generator hashes at seed 12345: n=0 83f4020d9011bf74, n=1 4ef7e270c24f35d8, n=2 efae00dd3c323f29 |
| T27 | 0.5.26 | The ark's own predictor joins the rubble sky: the same symplectic step run over the clump tracks, replacing the coarse projection the aimed ghost rode, so the ghost now flies true. The ship scene gains a gate at the ark's ring radius that pulls the ship alone at mass 2500. Releasing a drag snaps a near-miss aim toward the gate, or, away from the gate, toward a closed orbit, by up to 0.12 radians. The LAUNCH and EXECUTE chips grey until an aim is locked | LANDED 81ea052 — smoke 23 PASS, 0 FAIL — evolution hash 42ae90b308d1e6f6 |
| T28 | 0.5.27 | One physics step now runs at the ship scene's birth, before the aim freeze takes, so the track, the arrow, the burn number, the ghost, and the orbit lines all exist before the first touch. The ship pre-locks its aim toward the gate at burn 50, the ark's own default, standing on screen at birth. The aft module of the five-block cross is marked as the engine; every burn lights the deadweight hangar's plume on it, decaying over 36 frames. No living engine module, no burn — LAUNCH and EXECUTE grey out | LANDED 281994f — smoke 23 PASS, 0 FAIL — evolution hash 42ae90b308d1e6f6 unchanged — ship re-pin old 66300fdf76b09183 to new 65750510510dc87a |

---

# T1: the ark docks (0.5.0)

The gravity sandbox becomes GRAVITY'S ARK, a module beside the mech
range and the tower defense. The port is verbatim: its physics, its
levels, its look, untouched. COLDSNAP contributes a door, an exit,
and a home in the repo.

## Required reading

- This plan, whole.
- The source, whole (901 lines):
  `/home/batman/.claude/uploads/1a2b6d00-52dd-432b-9b47-2e1c5f734ca9/5c198d70-gravitysandbox.tsx`
- `src/ui/App.jsx` — whole (the screen switch).
- `src/ui/DemosScreen.jsx` — whole (the door's home).
- `src/game/MechRange.jsx` lines 1–20 — the module shape the ark
  matches (read only).

## Suggested model

Sonnet. A verbatim move with a four-row substitution table.

## Phone and desktop

The source drives by pointer drag and touch drag — both already in
the file, both named here. The menu button is the one added surface.
The owner's live drive rules.

## INVENTORY — what moves

One file, whole:

- `/home/batman/.claude/uploads/1a2b6d00-52dd-432b-9b47-2e1c5f734ca9/5c198d70-gravitysandbox.tsx`
  → `src/game/GravityArk.jsx`, all 901 lines.

Two files copied unchanged into the record:

- the same source → `docs/superpowers/reference/gravity-sandbox.tsx`
- `/home/batman/.claude/uploads/1a2b6d00-52dd-432b-9b47-2e1c5f734ca9/79debe5b-deadweighthangarhrml.html`
  → `docs/superpowers/reference/deadweight-hangar.html`

## SUBSTITUTION TABLE — every token allowed to differ

The moved module may differ from its source in exactly four ways; an
unlisted difference stops the task.

1. The filename: `5c198d70-gravitysandbox.tsx` → `GravityArk.jsx`.
2. The export line: `export default function App(){` →
   `export default function GravityArk({ onExit }){`.
3. One added element — the exit. Immediately BEFORE the line that
   begins `      {ui.showMap&&<div style={{position:"absolute",bottom:30,`
   insert:

```jsx
      {onExit&&<button onClick={onExit} style={{position:"absolute",top:10,left:10,zIndex:40,pointerEvents:"auto",padding:"8px 14px",font:"inherit",fontSize:12,letterSpacing:1,background:"rgba(20,25,33,.85)",color:"#c2c9d6",border:"1px solid rgba(150,160,178,.4)",borderRadius:10,cursor:"pointer"}}>⏏ MENU</button>}
```

4. Nothing else. Every other byte lands as it left.

## Steps

**1. The record.** Copy both reference files into
`docs/superpowers/reference/` as the inventory names them, unchanged.

**2. The move.** Copy the source to `src/game/GravityArk.jsx` and
apply the substitution table's rows 2 and 3. Verify row 4 by diff:
the only differences between source and module are the export line
and the inserted button.

**3. The door, `src/ui/App.jsx`.** The import block gains
`import GravityArk from "../game/GravityArk.jsx";` beside the
MechRange import. After the `towerdef` screen branch add:

```jsx
  if (screen === "gravark") {
    return <GravityArk onExit={() => setScreen("menu")} />;
  }
```

And the `DemosScreen` element gains the prop
`onArk={() => setScreen("gravark")}`.

**4. The button, `src/ui/DemosScreen.jsx`.** The props gain `onArk`
(destructured beside `onTowerDef`). After the MECH TEST RANGE button
element add a sibling:

```jsx
        <button data-menu="gravark" style={option({ borderColor: "#4e5a7a" })} onClick={onArk}>
          <div style={{ color: "#9fa8d4", fontSize: 15, letterSpacing: 2 }}>▶ GRAVITY'S ARK</div>
          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>Seeded star systems, real orbits. Plan the burn, thread the wells, make the gate.</div>
        </button>
```

**5. Gate.** `node scripts/gate.mjs smoke` — 23 PASS, 0 FAIL (build
and serve the preview for it, stop after, note as scaffolding).
Nothing else is touched; nothing else runs.

**6. Version and build.** `MK = "0.5.0"`, then `npm run build`.

**7. Land.** Commit everything named here (plain-words lowercase
subject, e.g. "gravity's ark docks — the sandbox ports whole behind
the proving range, phase 0.5 opens"), push. This document's T1 row →
LANDED with hash and the smoke count; commit, push. The owner's
drive — phone and desktop, the drag, the burn, the gate — is the
acceptance.

## Report

- One line of outcome, then bullets.
- Read-confirmation first.
- The diff verification of substitution row 4, stated plainly.
- The smoke count exactly.
- No fixture seeds ride this task.
- Both commit hashes.
- Every deviation its own labeled bullet.
