# The Settled Ground — Task 7: The Road Painted (mk2.67)

*Written by Claude Fable 5, 2026-08-27, on the owner's ruling: recognizable roads, some broken like ruins, color doing the work. Roads become ground paint through the renderer's existing decal layer — no bodies, no stone cost, and they follow every rise and dip for free. Both code blocks passed a syntax check; the smoke gate and the owner's eyes judge the look. Suggested model: Sonnet — fully specified. This plan rides with Task 6 (the carpenter) or alone; if together, one mark per task, carpenter first.*

## What this task does

- A KEPT road paints as a solid packed-earth ribbon, about four meters wide, with a darker worn line down its center — earth-brown against snow and stone, unmissable at any zoom.
- A BROKEN road is the same ribbon with hash-drawn stretches missing — the road the years ate. Absence is the ruin; no third color needed.
- Which is which: drawn at generation — each road draws a coin (about half break), and the paint is deterministic from world positions, so identical seeds paint identical ground.
- The paint lands in the decal layer's BASE art, so the fade pass keeps roads forever, and the kill-smear ledger repaints on top as it always has.

## Required reading

Report opens confirming each: this plan whole; `src/render/renderer.js:209-345` (makeSplat — paintBase, paintSmear, the smear ledger, armFade) and `:2655-2668` (the return object); `src/depot/mapgen.js:108-124` (the road draw); `src/depot/DepotGame.jsx:1420-1432` (the dressing calls at boot); `src/ui/startview.js`; `src/version.js`.

## Licensed re-teaches

None expected. The road-draw loop gains one seeded draw per road (the broken coin) — no total or draw-count pin survives in the suite to move. Any red stops the task.

## Steps

### Step 1 — the mark

`src/version.js:6`: `mk2.66` → `mk2.67` (or `mk2.65` → the next mark if this rides before the carpenter lands — sequential, never skipped).

### Step 2 — mapgen: the broken coin

`src/depot/mapgen.js:123`, in the road loop, old→new:

```js
    roads.push(pts);
```
```js
    // mk2.67 (owner): a road is KEPT or BROKEN, drawn here — the paint
    // reads the flag; the flag rides the array (survives the world transform).
    roads.push(Object.assign(pts, { broken: r() < 0.45 }));
```

### Step 3 — the renderer paints roads (`src/render/renderer.js`, inside makeSplat)

**3a.** Insert directly after the `paintBase();` call (`:267`) — the painter and its rows:

```js
  // ---- THE ROAD PAINTED (mk2.67, owner): roads are ground paint, not
  // bodies — stamped over the base art so fades keep them, under the smear
  // ledger's replay. fillRect only (the jsdom stub has no paths). A KEPT
  // road is a solid packed-earth ribbon with a worn center; a BROKEN road
  // drops out in hash-drawn stretches — the years ate it. Deterministic
  // from world positions; identical maps paint identical ground.
  let roadRows = [];
  const paintRoads = () => {
    for (const rd of roadRows) {
      const pts = rd.pts;
      let s = (Math.imul(Math.round(pts[0][0] * 8) | 0, 374761393) ^ Math.imul(Math.round(pts[0][1] * 8) | 0, 668265263)) | 0;
      const rnd = () => { s = Math.imul(s ^ (s >>> 15), 2246822519) | 0; return ((s >>> 8) & 0xffff) / 0x10000; };
      let skipT = 0;
      for (let i = 0; i + 1 < pts.length; i++) {
        const ax = pts[i][0], az = pts[i][1], bx = pts[i + 1][0], bz = pts[i + 1][1];
        const segL = Math.hypot(bx - ax, bz - az), steps = Math.max(1, Math.ceil(segL / 0.7));
        for (let k = 0; k <= steps; k++) {
          const wx = ax + (bx - ax) * (k / steps), wz = az + (bz - az) * (k / steps);
          if (rd.broken) {
            if (skipT > 0) { skipT--; continue; }
            if (rnd() < 0.06) { skipT = 5 + Math.floor(rnd() * 14); continue; }
          }
          const u = gridPx(wx), v = gridPx(wz);
          const half = 2.1 * W2Ug + (rnd() - 0.5) * 3;
          cx.globalAlpha = 1;
          cx.fillStyle = "rgba(122,104,82,0.88)";                    // packed earth
          cx.fillRect(Math.round(u - half), Math.round(v - half), Math.round(half * 2), Math.round(half * 2));
          cx.fillStyle = "rgba(94,78,60,0.55)";                      // the worn center
          cx.fillRect(Math.round(u - 2), Math.round(v - 2), 4, 4);
        }
      }
    }
  };
```

**3b.** In the returned object (the block starting `return { tex,` at `:328`), add one setter beside `clear()`:

```js
    // mk2.67: the road rows land once at boot — repaint base, roads, then
    // the smear ledger back on top; refresh the fade snapshot so a fade
    // greys toward roads, never over them.
    setRoads(list) {
      roadRows = (list || []).map((r2) => ({ pts: r2.pts || r2, broken: !!r2.broken }));
      paintBase();
      paintRoads();
      if (baseCv) { baseCx.drawImage(cv, 0, 0); }
      for (const m of smearLog) paintSmear(m.u, m.v, m.style, m.wx, m.wz);
      tex.needsUpdate = true;
    },
```

**3c.** The renderer's own return object (`:2667`) exposes it: add `setRoads: (list) => splat.setRoads(list),` beside `setDressing`.

### Step 4 — the boot calls

**4a.** `src/depot/DepotGame.jsx:1428`, directly after the `R.setDressing({ rocks: rocksLive, ... });` line at boot (the mount's line, not the breach-refresh copies), insert:

```js
      R.setRoads(ROADS); // mk2.67: the roads painted — kept ribbons and broken ones, before any smear replays
```

(This sits above the RES smear replay, so a resumed war's marks repaint on top — the setter replays the ledger anyway; the order is belt and braces.)

**4b.** `src/ui/startview.js:58`, after its `R.setDressing(...)` line:

```js
  R.setRoads(ROADS); // the menu's opening view shows the same roads
```

(`ROADS` is already imported there.)

### Step 5 — gates

`node scripts/gate.mjs depot-test` TWICE (both green, suite 2,091), `node scripts/gate.mjs depot-lint`, then `npm run build`, THEN `node scripts/gate.mjs smoke`. Straight through, no parking. Quote both [settled sweep] seed lines.

### Step 6 — the deploy

Commit and push. Subject: `the road painted — kept ribbons and broken ones, mk2.67`. Stage the four code files and this plan document.

## The owner's live check

Boot valleys: earth-brown roads running spawn to objective, bending over hills; the town's road whole through its gateposts; broken roads crumbling into stretches of nothing; wheel-worn centers; crossroads reading where the wayside crosses stand. Phone and desktop. Width, colors, break rate, and gap lengths are dials for your eye.
