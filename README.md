# coldsnap

COLDSNAP — a physics-first winter proving grounds. Drive the Bison, complete
the seven field trials. Masonry collapses, ice fractures, the pond drowns.

**Play it:** https://jeffreycoen.github.io/coldsnap/

## Layout

- `src/demo/coldsnap-proving-grounds.jsx` — the original proving-grounds demo,
  kept byte-for-byte unchanged. It stays playable from the start screen as the
  game grows around it.
- `src/engine/core.js` — the physics core, extracted verbatim from the demo
  (lines 1–4, 7–2098). `scripts/golden.mjs` re-extracts that slice at test
  time and asserts bit-identical `worldHash` trajectories, so the module can
  never silently drift from the demo. Runs in CI on every push.
- `src/render/renderer.js` — the renderer, extracted verbatim (lines
  2099–2761) with module imports.
- `src/game/` — the contract-sandbox game: `contracts.js` (the bureau
  work-order table from the buildout plan's Phase 1) and `ContractSandbox.jsx`
  (the demo component over the extracted modules, with the voice-pass overlay;
  saves under `coldsnap-cs-*` keys so it never touches demo records).
- `src/game/predicate.js`, `scenario.js`, `scenarios/*.json` — the Phase 4
  content pipeline: contracts as declarative predicates (parity-gated against
  the demo's closures across the full kill grid) and worlds as JSON scenarios.
  `scenarios/proving-grounds.json` rebuilds the demo's world worldHash-
  identically from data; `ac-01-interdiction.json` is a contract authored
  purely in JSON with zero engine edits. Both gated in CI
  (`test:predicate`, `test:scenario`).
- `src/engine/mech.js` — the biped walker: rig build, hinge/contact island
  solver, gait controller (hip-yaw actuator, CMG, capture-point stepping,
  stabilization rockets, JETS). Gated by `scripts/mech-test.mjs`
  (`npm run test:mech`), `righting-test.mjs`, and the sweep harnesses
  (`scripts/yaw-*.mjs`).
- `src/game/CampaignRunner.jsx` + `campaign.js` — the eight-work-order
  clearance campaign over the extracted engine (`npm run test:campaign`).
- `src/game/MechRange.jsx` — the mech test range (outpost scenario, garrison
  tanks, shoulder missiles).
- `src/game/ColdsnapTD.jsx` — HOLD THE DEPOT, a tower defense on the same
  engine and renderer: flow-field pathing, welded-masonry town, five tower
  types, twelve waves. Gated by `npm run test:td` (headless leak/kill/bounty
  sim) and `npm run test:td-render`.
- `src/aar/` — after-action report composition (`npm run test:aar`).
- `src/render/renderer.js` also carries the mech, tower, wall and overlay
  meshes plus the `tactical` camera mode; every mode shares the one renderer.
- `src/ui/` — the shell: start screen, controls screen, and the app frame that
  mounts the demo (ESC or the ⏏ MENU button returns to the menu).
- `src/platform/keymap.js` — keyboard remapping. A capture-phase interceptor
  translates the player's bindings into the canonical keys the frozen demo
  expects, so rebinding needs no demo edits. Bindings persist in storage.
- `src/platform/storage.js` — `window.storage` shim (claude.ai artifact API →
  localStorage) so the demo runs unmodified in both environments.
- `scripts/smoke.mjs` — end-to-end smoke test (system Chromium via
  puppeteer-core): menu, remap/swap/persistence, demo boot, sandbox
  work-orders and a live-fire WO-01 completion, ESC. Run with
  `npm run build && npm run preview` in one shell, `npm run smoke` in another.
- `scripts/golden.mjs` — the engine determinism gate (`npm run golden`).
- `coldsnap-buildout-plan-claude-fable-5.md` — the five-phase build-out plan.

## Development

```
npm install
npm run dev      # local dev server
npm run build    # static build in dist/
```

Pushes to `main` deploy to GitHub Pages automatically
(`.github/workflows/deploy.yml`).
