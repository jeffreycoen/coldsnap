# The README Re-measured (mk3.01)

The owner's order (2026-09-04): update the README. Every number below was measured on the shipped tree at plan-writing time (`du -sb dist` = 1,471,611 bytes; `tar -cf - dist | gzip -9 | wc -c` = 457,058; the last depot-test gate = 2,201 PASS; TEACH = 30 cards; core.js = 2,598 lines). The floppy claim survives by 2.9 KB — and says so. Screenshots are untouched (retaking them is its own task if the owner wants the jeep in frame).

Suggested model: Sonnet 5 — one file, text replacements only.

## Steps — all in `README.md`

**1.** Replace exactly:

```md
The whole thing — the war, the engine, five tech demos, every sound — is one 1.38 MB bundle, about 441 KB over the wire. A 1.44 MB floppy still holds it — with 22 KB to spare.
```

with:

```md
The whole thing — the war, the engine, five tech demos, every sound — is one 1.40 MB bundle, about 446 KB over the wire. A 1.44 MB floppy still holds it — with 2.9 KB to spare, and not a byte of room for bad ideas.
```

**2.** Immediately after the line beginning `- **The ground bites.**` (the whole bullet, one line), insert these two bullets:

```md
- **Command is a language.** Every squad and hull answers MOVE, ATTACK, and DEFEND from one radial ring — armor included: an attacking hull halts to fight whatever its guns can reach, then rolls on when the ground goes quiet. Orders chain: light QUEUE and stack a visible plan — move, lay a sandbag line, end on a patrol — every leg a flag on the snow and a row in the list, any leg deletable by tap, any plain order wiping the slate. One green button gathers everything on screen under a single ring, and a roster lists the living force with its kill counts — tap a row and the camera lands on that unit with its orders open.
- **The jeep rides real springs.** The Willys is the game's first suspended body: four spring-and-damper wheels under a rigid hull, so it settles, leans, dives, and rocks by physics — the wheels you watch are reading the springs, not playing a clip. A transfer case under your hands: 2H runs flat out, 4L crawls and climbs grades that send 2H sliding back — and it fords the stream only the Bison could. Two seats, a coax, and the spotter's own eye.
```

**3.** In the teaches-itself bullet (line 31), replace the phrase `twenty-eight one-card lessons` with `thirty one-card lessons` — the phrase appears exactly once in the file; the rest of the line is untouched.

**4.** Replace exactly:

```md
- **Engine** (`src/engine/core.js`, ~2,500 dependency-free lines): sequential-impulse rigid-body solver — boxes, quaternions, friction, stacking — with welds that carry break forces, sleeping bodies, and a fixed 120 Hz timestep.
```

with:

```md
- **Engine** (`src/engine/core.js`, ~2,600 dependency-free lines): sequential-impulse rigid-body solver — boxes, quaternions, friction, stacking — with welds that carry break forces, sleeping bodies, raycast spring suspension for wheeled hulls, and a fixed 120 Hz timestep.
```

**5.** Replace exactly:

```md
2,089 headless checks run green behind seven CI gates on every push.
```

with:

```md
2,201 headless checks run green behind seven CI gates on every push.
```

**6.** Gates, blocking: `node scripts/gate.mjs depot-test`, `node scripts/gate.mjs smoke` — green (the README rides no test, but the landing law holds). Then `src/version.js` `mk3.00` → `mk3.01`, `npm run build` after the bump, verify the built `dist` still fits the claim (`du -sb dist` must be ≤ 1,474,560 bytes — if it is not, STOP and report the number), commit (README.md, version.js, this plan file, .superpowers/gates.log) and push. Commit subject: `the record re-measured — the README catches up to mk3.00, mk3.01`.

## Acceptance

Gates exit 0; `du -sb dist` at most 1,474,560. The owner's read of the page is the acceptance.
