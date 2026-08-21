# The Davy Crockett — design

A new troop, both sides: a two-man crew carrying the smallest atomic weapon ever fielded. One shot per hire. The biggest blast in the game, the deepest crater, a mushroom cloud, and poisoned green ground left behind. Named for the real United States weapon of the late 1950s.

All numbers in this document are design choices, ruled by the owner in review, provisional until played.

## The troop

- A two-man crew squad, hired like any other squad. Placement, selection, orders, saving: the existing squad machinery, unchanged.
- Orange jumpsuits, marked with the radiation trefoil ☢ — a new kit palette (the medic-whites pattern) and trefoil props (the red-cross pattern). The tube is a carried prop.
- Top tier. Cost 450 — above the mech's 400, the highest price in the game. Its own market family; the standing-stock wall applies like every family.
- Slowest movers on the map: speed 2.0 (every other squad walks 3.2).
- The enemy fields the identical crew, same numbers, at the matching tier. Symmetry is law: enemy spec tag, pick pool, hand tag, market price, kill price, its own fire behavior — all mirrored.

## The shot

- Lofted arc, range 20. Its own fire path (the sapper precedent: not a normal rifle row) — the crew aims and fires at a structure or a seen enemy by the same sight and accuracy laws every shooter obeys.
- One shot per hire. Firing kills the crew where they stand — explicitly, at the trigger, not left to the blast's falloff. The hire is spent with the round.
- Damage 200, blast radius 25, both sides hurt: every body inside the radius takes the blast — enemy, friendly, structures, rocks. Friendly-fire deaths pay and score nobody, the standing kill law.
- Walls (70 a course), towers (80–130), sandbags (60), and trees are destroyed anywhere inside the radius. Rocks (health ~700–800) take heavy damage and the existing breach machinery finishes any that die.
- Crater 10. The engine's carve floor becomes a per-world dial — default the frozen minus 1.5, so the demo and the golden gate stay byte-identical; the war sets it deep enough for the full pit. A guarded divergence, ruled by the owner.

## The green fog

- The blast leaves a poison patch on the crater: radius 6, 4 damage per second to any living body inside, both sides, fading out after 25 seconds. A fresh blast on old ground restarts the patch.
- Mechanism: a patch list on the run state (the mines' watched-point shape), stepped on the territory clock, saved and restored like mines.
- Look: green ground haze over the patch — instanced, deterministic, no dice in the renderer.

## The look of the blast

Owner's ruling: it must read atomic, and it must be dramatic. His eyes accept it live, phone and desktop.

1. **The flash.** The whole screen goes white the instant the round lands, decaying over about half a second. A full-screen overlay; nothing else in the game does this.
2. **The ground ring.** A thin white shockwave ring expands from the impact past the blast radius in under a second, flattening and fading. Snow and debris fly with it.
3. **The stem.** A dense smoke column climbs from the crater — the demolition column driven several times harder, glowing orange at the base.
4. **The cap.** Smoke at the top of the stem spreads and curls into the mushroom head, hangs for about ten seconds, then drifts downwind and thins to nothing. The smoke particle cap rises from 128 to carry it.
5. **The floor.** The green fog settles under the thinning cloud, over the pit.

Camera shake at maximum through the ring's passage.

## Testing

Seeded fixtures, mechanics only (look and sound belong to the owner): blast damage lands on both sides; the crew dies with the shot; the fog patch damages both sides and expires on time; the crater reaches the deepened floor in the war and the demo carve is byte-identical (golden green); draw-count stability; the two sides' specs are equal; save and resume carry a live patch and a spent crew correctly.

## Out of scope

Sound (auditioned separately on the soundboard), campaign and demo modes (untouched by construction), any second nuclear weapon.
