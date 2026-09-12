# The Family Sky — phase skeleton

A large seeded map: a built star system that the seed sets faintly astir, so every map starts orderly and comes apart in its own way. A pinned great star holds two lesser stars and four planets; each lesser star holds two planets; three light moons ride the outer great-ring planets. About 6000 across. The ship flies it from the first landing.

## The design, settled by measurement

- **The family tree is the gravity.** Every body carries a family number and knows its parent. A child feels its parent and the whole line above it at full strength, and every other body at one percent. So a moon holds to its planet, a lesser star's planets travel with it as it orbits the great star, and the four great rings barely tug each other. This is the one load-bearing mechanism; it was found by measurement, after a version that gave full pull only to the direct parent tore every subsystem apart.
- **Stars move.** The great star is pinned. The two lesser stars orbit it as point masses — they pull, they bend the net, they eat what touches them, they obey the family law among themselves. They are not block bodies; their mass would cost thousands of blocks.
- **Low-density bodies.** Every planet and moon is sizable but light, so siblings barely perturb each other — the same star-to-planet mass ratio the already-stable system scene holds. The full-strength parent pull does the holding.
- **Chaos is the content.** The layout is ratified stable at its set points; the seed nudges every set point three percent and randomizes every phase. The map decays instead of holding — on an unlucky seed a moon slips loose or a planet is eaten inside the first minute; on a lucky one every body survives minutes while its orbit wanders. Which body goes, and when, is the seed's signature. Measured across many rolled seeds: no body ever reaches not-a-number, the map stays mostly asleep and affordable, and it evolves rather than detonating.
- **Scale.** About 6000 across — the map never fits the frame; the pan and the ship-follow already carry a field bigger than the screen.

## Measured evidence on record

- Performance sweep: a single awake planet costs about 3.6 milliseconds per step at 93 blocks, rising steeply past 500 blocks; a sleeping map of ~2600 blocks steps in about 9 milliseconds on the grid broad-phase. The map sleeps almost entirely, so its true cost is low, with brief wake spikes.
- Stability: the built layout at its set points holds its subsystems together; the lesser-star planets, once the map was widened to 6000 and the bodies lightened, stopped tearing off.
- Chaos flights: five rolled seeds, three simulated minutes each — no not-a-number, worst single frame around 80 milliseconds, most bodies surviving with occasional graceful loss.

## Tasks

| Task | Mark | What lands | Status |
|---|---|---|---|
| T33 | 0.5.32 | The family sky: family-tree gravity, moving stars, the map generator, the MAP chip, the ship aboard | LANDED — mark 0.5.32, existing numbers unchanged, map number b21af822f4ebe4a4 newly pinned, smoke 23/23 |
| T34 | 0.5.33 | The packed sky and the compass: distances cut to a third so the brawl starts in seconds, an end gate on the far rim, an edge-arrow compass with the distance | LANDED — mark 0.5.33, existing numbers unchanged, map number b21af822f4ebe4a4 → acace0dbe7852764, smoke 23/23 |
| T35 | 0.5.34 | The slow packed sky: the map opens at half time, a quarter-time chip, distances halved again with birth clearance by construction, the ship's caps and fuel doubled on the map | LANDED — mark 0.5.34, existing numbers unchanged, map number acace0dbe7852764 → 9c735648f4cb3502, smoke 23/23 |
| T36 | 0.5.35 | The slow chips: ×2 and ×5 leave the time row, ×⅛ and ×1/16 join it; nothing else moves | LANDED — mark 0.5.35, all numbers unchanged, smoke 23/23 |
| T37 | 0.5.36 | Filling in the frames: at a slow chip the drawing blends every body between physics steps so the sky glides instead of hopping; every body but the ship shows two seconds of trajectory, not twenty | LANDED — mark 0.5.36, all numbers unchanged, smoke 23/23 |
| T38 | 0.5.37 | Lines that ride the body: the other bodies' trajectory lines rebuild every drawn frame rooted at the blended position, one simulated second long | LANDED — mark 0.5.37, all numbers unchanged, smoke 23/23 |
| T39 | 0.5.38 | Slower by half: a ×1/32 chip, ×1 leaves the row, every scene opens at ×½, the other bodies' lines fixed at two real seconds at any chip | LANDED — mark 0.5.38, all numbers unchanged, smoke 23/23 |
| T40 | 0.5.39 | Bodies on the net: every drawn point sinks by the well depth the net uses at that spot, one dip per body, so bodies rest in their bowls instead of hovering | LANDED — mark 0.5.39, all numbers unchanged, smoke 23/23 |
| T41 | 0.5.40 | One plane: every body draws on the flat plane again and the net sags a tenth of its former depth, so the sky sits at one height with mass read as a shallow dish | LANDED — mark 0.5.40, all numbers unchanged, smoke 23/23 |
| T42 | 0.5.41 | The slow sky and the fast ship: every scene opens at ×1/16, the map's ship at scale four with the plume to match, the ghost predicting three times as far; the stars stay — the eightfold version burned the map down in ten simulated seconds on the bench | LANDED — mark 0.5.41, all numbers unchanged, smoke 23/23 |
| T43 | — | The moving-star look: the stars' art in flight, the map's camera reach — the owner's eyes the acceptance | PLANNED |

The map's purpose changed after T33 flew: longevity of orbits is not wanted; the chaos of a packed sky is the story. T34 packs it; T35 slows time and packs it again — slower time is cheaper time, so the same machine carries a denser brawl. T36 is deferred polish: the look and feel of the moving sky, checked live, written on the owner's word after T35 lands.
