# COLDSNAP — Standing Orders

The project owner directs design, reviews every plan, and is the sole playtester. His word overrides everything below; nothing here is provisional to an agent.

## Speech

- Answer like a vending machine or an ATM: state, result, done. Minimal words, plain words, complete sentences. This applies everywhere — replies, plans, reports, documents, commit messages.
- Never long or verbose. The owner asks when he wants more detail.
- No jargon or acronyms in anything he reads.
- **All markdown documents are served to the owner rendered** — never just a file path.

## Plans

- One plan document per phase. No parts, no split audiences — the owner reads all of it, so it is written once, plainly.
- **Atomic steps with code:** each step names the exact file and line anchor and contains the actual code (or assert) to be added or changed, in execution order, failing-asserts-first where tests exist. Plain-language sentence above each step saying what it does. Agents execute plans; they do not design from intent.
- The owner approves the plan **before any code**. No open design questions may enter a plan.
- **Every amendment is served for review before any agent dispatches on it.** Approval of the original does not carry to the amendment.
- **Decisions are served interactively** (the question tool, one decision per question, with a stated lean) — never buried in prose, never lettered/numbered option matrices.
- "No code yet" covers the whole message it appears in.

## Versioning

- Phases bump the mark **+0.1**. Tasks bump **+0.01**. Sequential — never skip a number, never skip a step.
- Every deploy bumps `src/version.js`. Build AFTER the bump, never before (stale-bundle mark mismatch).

## Dispatch

- Implementation agents are Opus 5 (`model: "opus"`). Never Opus 4.8.
- One agent in the working tree at a time, sequential. Parallel work requires worktree isolation.
- Every dispatch carries: a pre-verified reading list (anchors checked against live code at dispatch), trap notes, and a required read-confirmation opening the agent's report.
- Agents verify **mechanics, never feel**. Perceptibility, look, and sound acceptance belong to the owner alone.

## Verification

- Test only what changed. Load/boot checks and the gates the brief lists — **run ONLY the gates listed, nothing else.** No scripted playtesting, ever. The full suite rides CI.
- Prune unnecessary tests; re-pin honestly and report every re-pin old→new.
- No multi-agent review passes — verification is inline (gates + smoke + screenshots).

## Look and sound

- **Visual changes ship, and the owner checks them live on the deployed site.** No screenshot loops — push the change and say what to look at. Words never ratify a shape; the owner's eyes are the acceptance.
- Sound changes are auditioned on the soundboard (`?sounds=1`, OLD/NEW A/B) — the owner's ear is the acceptance.
- The acoustics reference is `docs/superpowers/2026-08-12-sound-profiles-reference.md`; future sound-domain research appends to it.

## Reports

- One line of outcome, then short bullets. No essays.
- **Every nonconformity, deviation, and re-pin is its own labeled bullet** — never buried in prose, never filtered, never triaged away. Completeness of the defect list is the owner's call.
- Report outcomes faithfully: failures stated plainly with output; skipped steps named as skipped.

## Research

- Authority-published sources only (peer-reviewed, government, standards bodies, established measurement authorities). No estimates presented as data; unverifiable numbers are marked as design choices and listed in a gaps section.

## Process

- No momentum: stop and check before each next step. Slow is smooth, smooth is fast.
- Deferred items collect into the post-phase polish queue — never folded in opportunistically.
- Frozen laws: `src/demo/coldsnap-proving-grounds.jsx` is byte-frozen; `core.js`/`renderer.js` engine changes are guarded additive divergences with `golden.mjs` green; no `Math.random` in `src/depot` (seeded rng + draw-count stability; `depot-lint` gates CI).
