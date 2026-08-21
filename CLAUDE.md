# COLDSNAP — Standing Orders

The owner directs design, reviews every plan, and is the sole playtester. His word overrides everything here.

**Authority:** this file, the ACTIVE phase's plan documents, and the owner's word — nothing else. This file outranks session memory and conversation summaries; a stale copy gets corrected, never followed. There is no decision log. New rulings are written into the plan document they govern, at ruling time. Ship history lives in git.

**Orientation (orchestrator only, before any work):** read the last ~20 commit subjects — nothing more. Plan documents are read only when the owner directs it. Dispatched agents read only their brief's verified list. All affected code is read in full at plan-writing time; reading lists re-verify at dispatch.

## Speech

- Answer like a vending machine or an ATM: state, result, done. Minimal words, plain words, complete sentences. This applies everywhere — replies, plans, reports, documents, commit messages.
- No jargon, no acronyms.
- Never "waiting on you", "ready when you are", "blocked on owner". State the state; he knows whose move it is.
- The enemy is "it" or "the enemy", never "he".
- Documents are served as the markdown FILE, sent rendered with the file-sending tool — never pasted whole into a reply, never a bare path.

## Plans

- The phase document holds skeleton, status, and index; each task's full plan is its own file, served ALONE for review, written once for one reader, plainly.
- Atomic steps carrying the actual code and exact file/line anchors, in execution order, failing asserts first, a plain sentence above each. Agents execute plans; they never design.
- Every task plan carries its required-reading list and a suggested model (Sonnet or Fable, one-line reason); the owner rules on it at approval.
- Verbatim-move tasks carry an INVENTORY of what moves, a SUBSTITUTION TABLE of every token allowed to differ (an unlisted difference stops the agent), and an ARITHMETIC acceptance — keystone hash and draw count, or the suite's exact pass count. Numbers ratify moves, never judgment.
- **SYMMETRY IS LAW.** Whatever one side can do, buy, build, or suffer, the other can. Every asymmetry, however small or temporary, needs the owner's explicit ruling, recorded as knowing with its closing task named; a plan that finds symmetry inconvenient asks.
- **Before any plan is served,** the plan-writer checks it: every code block gets a syntax pass, and every key name, field, and anchor in it is grepped against the live tree. A plan with unchecked code never reaches the owner.
- The owner approves the plan before any code. No open design questions inside a plan.
- Pause between the design questions and the writing — the owner says when the plan gets written. Every time.
- Every amendment is served for review before any dispatch on it; approval of the original does not carry.
- Decisions are served interactively — the question tool, one decision per question, a stated lean — never option matrices in prose.
- Question options state their mechanism in the owner's own terms, never buried in jargon or a recommended label; if the owner asked for a thing, that thing is one of the options, verbatim, or the question says plainly why it cannot be (owner, 2026-08-21 — the mortar-root lob shipped inside a "recommended" option while the asked-for gradual elevation was never offered).
- "No code yet" covers the whole message it appears in.

## Versioning

- Phases bump +0.1, tasks +0.01, sequential, never skipped. Every deploy bumps `src/version.js`; build AFTER the bump, never before.

## Dispatch

- Implementation agents are Sonnet 5. Fable only on the owner's approval. Never Opus, any version.
- One agent in the working tree at a time; parallel work needs worktree isolation.
- Stop after every task: report the landing, then the owner's word rules the next dispatch. A landing includes the deploy — gates green → commit → push, without asking; the owner's live check is the acceptance.
- "Status" on a running agent means CHECK IT: real elapsed time, what the tree shows changed, which gates have run. Facts only; NO completion estimates ever; no vague times. Unknowable state is said plainly, with the real elapsed time anyway.
- "Deep status" means a full operation report — done / in-flight / pending / open questions, agent reports, commits, the next gate — never re-verification runs.
- Gates in dispatch briefs run through `node scripts/gate.mjs <name>`; every run appends one line to `.superpowers/gates.log`, and a status check on a running task reads that tail. CI calls the gates directly and never writes the log.
- Every dispatch carries a pre-verified reading list and a required read-confirmation opening the agent's report. No trap-notes section: a plan whose steps are copied verbatim carries any warning inside the step it guards (owner).
- Agents verify mechanics, never feel. Look, feel, and sound belong to the owner alone.

## Verification

- Test only what changed; run ONLY the gates the brief lists. No scripted playtesting, ever. The full suite rides CI.
- The sweep license: a plan may pre-license re-teaching tests that pin literal text the task itself moves or re-signs — asserted content stays identical, every re-teach reported old→new. Any other failure stops the task. The license never covers behavior.
- No multi-agent review passes; verification is inline (gates + smoke + screenshots).

## Look and sound

- Interface ships for phone AND desktop, every single time; plans name both explicitly.
- Visual changes deploy and the owner checks them live on the site — no screenshot loops; his eyes are the acceptance.
- Sound is auditioned on the soundboard (`?sounds=1`, OLD/NEW A/B); his ear is the acceptance. Acoustics reference: `docs/superpowers/sound-profiles-reference.md`.

## Reports

- One line of outcome, then short bullets. No essays.
- Every report names the fixture seeds its tests ran; no seed is ever special.
- Every nonconformity, deviation, and re-pin is its own labeled bullet — never buried, filtered, or triaged away.
- Failures stated plainly with output; skipped steps named as skipped.

## Research

- Authority-published sources only. No estimates presented as data; unverifiable numbers are marked as design choices and listed in a gaps section.

## Process

- No momentum: stop and check before each next step.
- Phase closeout re-checks the README's claims and screenshots against the shipped game.
- Deferred items collect in the polish queue, never folded in opportunistically.
- Frozen laws: `src/demo/coldsnap-proving-grounds.jsx` is byte-frozen; `core.js`/`renderer.js` changes are guarded additive divergences with `golden.mjs` green; no `Math.random` in `src/depot` (seeded rng, draw-count stability, `depot-lint` gates CI).
