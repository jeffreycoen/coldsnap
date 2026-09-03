# The Escort Link — Amendment 1: Step 1's required pattern

The plan predicted six failing asserts; the live run produced four. The prediction was wrong, not the fix: the pop's generic `else` branch already copies the entry's kind — "escort" — into the order with an undefined destination, and the escort machinery's no-squad path digs in at once. So pre-fix, the chain drains and the hull ends in defend by accident, with `escortId` never transferred — the very defect the fix's asserts catch.

## The change

Step 1's required result is replaced with:

> Required result: exactly these FOUR asserts FAIL —
> - (a) the arrival pops the queued escort
> - (c) pins: the mech pops escort too
> - (c) pins: the escort tap appends and puts the light out
> - (c) pins: the flags skip the escort leg
>
> "(a) the chain is consumed" and "(b) a dead target ends the chain in defend" PASS pre-fix, for the accidental reason above; after the fix they hold for the right one. Every pre-existing test PASSES. Any other pattern stops the task.

This pattern is the one already on the logged run (2026-09-03, all pre-existing green). Step 1's files are on the tree; on dispatch the agent verifies the logged run matches and proceeds to Step 2 without re-running Step 1. Steps 2–7 stand exactly as written. The plan-writer's pre-serve check now also runs new behavior tests against the unedited tree before predicting their pattern.
