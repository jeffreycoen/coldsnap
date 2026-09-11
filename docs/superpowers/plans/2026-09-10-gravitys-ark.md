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
