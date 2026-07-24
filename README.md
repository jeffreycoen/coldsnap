# coldsnap

COLDSNAP — a physics-first winter proving grounds. Drive the Bison, complete
the seven field trials. Masonry collapses, ice fractures, the pond drowns.

**Play it:** https://jeffreycoen.github.io/coldsnap/

## Layout

- `src/demo/coldsnap-proving-grounds.jsx` — the original proving-grounds demo,
  kept byte-for-byte unchanged. It will remain playable as an option on the
  start screen as the game grows around it.
- `src/platform/storage.js` — `window.storage` shim (claude.ai artifact API →
  localStorage) so the demo runs unmodified in both environments.
- `coldsnap-buildout-plan-claude-fable-5.md` — the five-phase build-out plan.

## Development

```
npm install
npm run dev      # local dev server
npm run build    # static build in dist/
```

Pushes to `main` deploy to GitHub Pages automatically
(`.github/workflows/deploy.yml`).
