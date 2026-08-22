# The Tesla Coil — design

The frost tower becomes a lightning weapon, both sides. It strikes one enemy, then the bolt walks outward, hop by hop, through anything near — friend, enemy, vehicle, wall, tower. Blue-white lightning, different every shot. A sizzle at the strike, a long thunder rumble for every unit hit. Its kills leave a black smudge in the snow.

All numbers in this document are design choices, ruled by the owner in review, provisional until played. No published profile exists for the sound; it is tuned by the owner's ear on the soundboard.

## The tower

- The frost tower converts in place: same card slot, same tier-1 deal odds, same market family, both sides. It enters play only through the deal, like every card. No side starts with it.
- Cost 55 (frost was 30). Reach 16. Fires every 5 seconds. Health stays 85.
- The frost slow effect dies with the conversion. It was never wired into the war — units carry a slow factor nothing sets — so no live behavior is lost. Every text that promises a slow (info card, market blurb, portrait notes, README) is rewritten.
- Possession allowed (frost was the one tower barred from it). The possessor aims the first bolt at any enemy in reach and sight; the chain walks itself. That is the only aim the weapon has.
- The enemy's tower is identical in every number and behavior. Symmetry is law.

## The strike and the chain

- Target acquisition: enemies only, by the same reach, sight, and fog laws every tower obeys. The first bolt needs a clear line like any shot.
- On the strike, the chain begins. Each hop jumps up to 4 meters from the last body hit to the nearest body not yet hit — any body: infantry, crew, vehicle, tower, wall, either side. 8 hits maximum per shot. One hit per body per shot; the chain dies when nothing fresh is in hop range.
- Hops spread indiscriminately: no sight check, no fog check, no side check past the first strike. A hop may carry into darkness the player cannot see; the bolt is simply seen vanishing into it.
- Damage: 35 on the strike, then 5 less per hop — 30, 25, 20 — with a floor of 10.
- The hops walk at 150 milliseconds each: a visible march, each strike clearly separate, the full 8-body chain taking just over a second.
- Water conducts. When the chain touches a frozen pond, every body on that pond is hit (counting against the 8, nearest first), and the ice surface lights up and crackles. The conduction test keys off the game's one water test, so the stream — off by the owner's ruling at mk1.94 — conducts automatically if it ever returns.
- Chain selection in the simulation draws from the seeded stream with a fixed draw count per shot, whatever the chain does, so replays and saves hold exactly.

## The avoid-friendlies switch

- One global switch, covering area weapons only: the tesla chain and the Davy Crockett blast. It starts OFF.
- ON: the weapon holds fire while any friendly body stands in the danger zone — the reachable chain area for the tesla, the blast radius for the Davy Crockett. OFF: it fires regardless.
- Ordinary towers keep their existing CAREFUL-discipline path check, untouched.
- The enemy's weapons obey the enemy's own switch the same way.
- Wiring the Davy Crockett to the switch is a named sub-step of this work.

## The look

Owner's ruling: it must be really cool blue-white lightning, different each time — never a canned animation. His eyes accept it live, phone and desktop.

1. **The idle.** Electricity visibly pulses on the coil, with small lightning arcs crawling over it at regular intervals — the tower reads as charged even when silent.
2. **The strike.** A jagged blue-white bolt from coil to target: fresh procedural geometry every shot, forking side-branches, a bright core with a pale halo, alive for a fraction of a second.
3. **The march.** Each hop draws its own fresh bolt from body to body at the 150-millisecond pace, so the chain visibly walks.
4. **The water.** A conducting pond flashes across its whole surface, crackling while the chain stands on it.
5. **The dice.** All lightning geometry lives in the renderer, where true randomness is allowed. The simulation stays seeded and draw-stable.

## The sound

- The strike: an electrical sizzle.
- Each body hit: a long thunder rumble of its own, so a big chain rolls like a storm instead of clapping once. The sound system's same-instant merging must not collapse the chain — each hop is its own sound event, and the stagger spaces them.
- Both sounds are new, unprofiled, provisional; auditioned OLD/NEW on the soundboard, the owner's ear the acceptance.

## The black smudge

- A body whose killing damage is lightning paints a black scorch smudge in the snow instead of the red smear — a third smear style beside the human red and the machine dark-spill, position-hashed like the others so identical runs paint identical ground.
- The style rides through saves like the existing styles.
- A body that dies mid-chain to some other weapon keeps its normal smear.

## Testing

Seeded fixtures, mechanics only (look and sound belong to the owner): the chain hits at most 8, never the same body twice, in hop range, with the right damage ladder; the first strike obeys sight and the hops ignore it; the pond hits every body on it; the switch holds fire with a friendly in the zone and the Davy Crockett obeys the same switch; both sides' specs are equal; draw-count stability; a save mid-chain and the smudge style round-trip; the golden gate stays green.

## Out of scope

Campaign and demo modes (frozen), any change to ordinary tower discipline, rebalancing the deal tiers, the stream's return.
