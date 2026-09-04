# The Jeep — the questions, before the reading

Drafted before any research, per the owner's process (2026-09-03). Each will be answered from the code where the code can answer it; what survives becomes the owner's rulings.

1. What timestep does the sim integrate at, and what spring frequency and damping stay stable inside it?
2. Will a spring-borne hull fall asleep parked? What puts a body to sleep, what wakes it, and would the suspension pass fight the sleep clock?
3. What exactly marks ground "steep" — for the route planner's no-lane refusal, and physically for the drive's traction? Is there a slope no hull can climb today, and where is it set?
4. What reads a hull's speed and was tuned around 9.5 m/s — the overrun safety, the progress watch, the turn-brake, the keep-right — and which constants would a faster jeep strain?
5. Where do a possessed vehicle's controls live (buttons, desktop keys), for the 2H/4L toggle to join them?
6. What happens physically when a hull enters the stream — is water a drown, a block, or a slow — and where is that law written?
7. How does hull traction work today — what does grip key off, and is there any per-contact load information the per-wheel grip cap could reuse?
8. How is a vehicle's sight radius specified — where would the jeep's big eye go?
9. How does APC seating work — what would seats on the jeep cost in code?
10. What defines a hire card in the market — what does adding the jeep to the hiring hall touch?
11. How are hull bodies drawn — could wheels animate from suspension state, and what does the renderer fork (three copies) mean for that work?
12. What new body state must explicitly ride the save (gear, suspension fields), and what rides free?
13. How does possessed fire work for a coax-only hull (the APC) — does the jeep's possession reuse it whole?
14. What would the enemy need to field jeeps — which systems name the vehicle types it musters? (Deferred work; the question is scope, not a task.)

Owner's rulings these cannot answer — expected to survive: the jeep's price; seats or none; its top speed in each range (a design choice, marked as such); whether the wheels visibly animate; its label on cards and the roster; and whether ordered driving ever auto-shifts to 4L (current lean: never — 4L is the possessed hand's tool).
