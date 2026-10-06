# T86: the death heart (0.5.81)

Every disk gains its death ground, blended green through red: the outer green steps stand as T85 left them, and over the last approach two blend rings shift the green toward red, landing on a full-red heart at the line that kills — the star's own eating radius, a planet's rock with a hot-arrival margin of 1.4 times its spread. Red is the trajectory lines' own red. Drawing only, both screens, one commit. The margin 1.4, the blend alphas (.25, .3, .5), and the blend fractions are design choices until played; your eye rules them live.

The substitutions were applied to a fresh copy at plan-writing time: every anchor hit once per file, both files parse, and the T84 battery reproduced its acceptance line for line — both hashes unmoved.

## Required reading

- This plan, whole.
- `src/game/rubbleworlds/draw.js` — the slingshot-zones block as T85 left it.
- `src/game/gravitydebris/draw.js` — the same block, dent-riding twin.

## Suggested model

Sonnet. Pre-verified substitutions in two files; no design remains.

## Steps

**1. The substitutions.** From the repo root:

```bash
python3 - <<'PYEOF'
import sys
def subn(path, old, new, n, tag):
    s = open(path).read()
    if s.count(old) != n: sys.exit("anchor fail: %s (count %d, wanted %d)" % (tag, s.count(old), n))
    open(path, 'w').write(s.replace(old, new))

R = 'src/game/rubbleworlds/draw.js'
D = 'src/game/gravitydebris/draw.js'

for F in [R, D]:
    subn(F, 'zones.push([tk.x + ox, tk.z + oz, tk.rad, tk.m]); }',
            'zones.push([tk.x + ox, tk.z + oz, tk.rad, tk.m, tk.rad * 1.4]); }', 1, 'tracks:' + F)
    subn(F, 'if (world.star) zones.push([world.star.x, world.star.z, world.star.r, world.star.m]);',
            'if (world.star) zones.push([world.star.x, world.star.z, world.star.r, world.star.m, world.star.r]);', 1, 'star:' + F)

subn(R, 'st.pz + (st.z - st.pz) * L, st.r, st.m]);',
        'st.pz + (st.z - st.pz) * L, st.r, st.m, st.r]);', 1, 'starBodies:rubble')
subn(D, 'st.pz + ((st.qz == null ? st.z : st.qz) - st.pz) * L, st.r, st.m]);',
        'st.pz + ((st.qz == null ? st.z : st.qz) - st.pz) * L, st.r, st.m, st.r]);', 1, 'starBodies:debris')

DEATH = """          // THE DEATH HEART: the ground that kills — the star's eating radius,
          // a planet's rock with a hot-arrival margin — blended green through
          // red over the last approach. The margin 1.4 and the blend alphas
          // are design choices, not measured numbers.
          const rd = Math.min(zd, zr);
          if (rd > 0) {
            const lerp = (t) => Math.round(40 + 180 * t) + "," + Math.round(170 - 115 * t) + "," + Math.round(90 - 55 * t);
            if (rg > rd) { ring(rd + (rg - rd) * 0.67, 0.25, lerp(0.33)); ring(rd + (rg - rd) * 0.33, 0.3, lerp(0.67)); }
            ring(rd, 0.5, "220,55,35");
          }
        }"""

subn(R, """        for (const [zx, zz, zrad, zm] of zones) {
          const zr = Math.sqrt((zrad * zrad + SF * SF) * KZ - SF * SF);
          const ring = (rr, fa) => {
            ctx.beginPath();
            for (let a = 0; a <= 40; a++) { const th = a / 40 * Math.PI * 2; const p = iso(zx + Math.cos(th) * rr, zz + Math.sin(th) * rr, 0); if (a === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }
            ctx.closePath(); ctx.fillStyle = `rgba(40,170,90,${fa})`; ctx.fill();
          };
          ring(zr, 0.06);
          ctx.strokeStyle = "rgba(40,170,90,.18)"; ctx.lineWidth = 1.2; ctx.stroke();
          for (let k = 1; k <= NSTEP; k++) {
            const rk2 = Math.pow(G * zm / (P_FULL * k / NSTEP), 1 / 1.15) - SF * SF;
            if (rk2 <= 0) break;
            ring(Math.min(Math.sqrt(rk2), zr), 0.25);
          }
        }""",
     """        for (const [zx, zz, zrad, zm, zd] of zones) {
          const zr = Math.sqrt((zrad * zrad + SF * SF) * KZ - SF * SF);
          const ring = (rr, fa, rgb) => {
            ctx.beginPath();
            for (let a = 0; a <= 40; a++) { const th = a / 40 * Math.PI * 2; const p = iso(zx + Math.cos(th) * rr, zz + Math.sin(th) * rr, 0); if (a === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }
            ctx.closePath(); ctx.fillStyle = `rgba(${rgb || "40,170,90"},${fa})`; ctx.fill();
          };
          ring(zr, 0.06);
          ctx.strokeStyle = "rgba(40,170,90,.18)"; ctx.lineWidth = 1.2; ctx.stroke();
          let rg = zr;
          for (let k = 1; k <= NSTEP; k++) {
            const rk2 = Math.pow(G * zm / (P_FULL * k / NSTEP), 1 / 1.15) - SF * SF;
            if (rk2 <= 0) break;
            rg = Math.min(Math.sqrt(rk2), zr);
            ring(rg, 0.25);
          }
""" + DEATH, 1, 'law:rubble')

subn(D, """        for (const [zx, zz, zrad, zm] of zones) {
          const zr = Math.sqrt((zrad * zrad + SF * SF) * KZ - SF * SF);
          const ring = (rr, fa) => {
            ctx.beginPath();
            for (let a = 0; a <= 40; a++) { const th = a / 40 * Math.PI * 2; const ex = zx + Math.cos(th) * rr, ez = zz + Math.sin(th) * rr; const p = iso(ex, ez, 0); p.y += getD(ex, ez); if (a === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }
            ctx.closePath(); ctx.fillStyle = `rgba(40,170,90,${fa})`; ctx.fill();
          };
          ring(zr, 0.06);
          ctx.strokeStyle = "rgba(40,170,90,.18)"; ctx.lineWidth = 1.2; ctx.stroke();
          for (let k = 1; k <= NSTEP; k++) {
            const rk2 = Math.pow(G * zm / (P_FULL * k / NSTEP), 1 / 1.15) - SF * SF;
            if (rk2 <= 0) break;
            ring(Math.min(Math.sqrt(rk2), zr), 0.25);
          }
        }""",
     """        for (const [zx, zz, zrad, zm, zd] of zones) {
          const zr = Math.sqrt((zrad * zrad + SF * SF) * KZ - SF * SF);
          const ring = (rr, fa, rgb) => {
            ctx.beginPath();
            for (let a = 0; a <= 40; a++) { const th = a / 40 * Math.PI * 2; const ex = zx + Math.cos(th) * rr, ez = zz + Math.sin(th) * rr; const p = iso(ex, ez, 0); p.y += getD(ex, ez); if (a === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }
            ctx.closePath(); ctx.fillStyle = `rgba(${rgb || "40,170,90"},${fa})`; ctx.fill();
          };
          ring(zr, 0.06);
          ctx.strokeStyle = "rgba(40,170,90,.18)"; ctx.lineWidth = 1.2; ctx.stroke();
          let rg = zr;
          for (let k = 1; k <= NSTEP; k++) {
            const rk2 = Math.pow(G * zm / (P_FULL * k / NSTEP), 1 / 1.15) - SF * SF;
            if (rk2 <= 0) break;
            rg = Math.min(Math.sqrt(rk2), zr);
            ring(rg, 0.25);
          }
""" + DEATH, 1, 'law:debris')
print("all substitutions in")
PYEOF
```

Expected output, exact: `all substitutions in`. Then `node --check` on both files prints nothing.

**2. The battery.** Run T84's battery unchanged: save the battery block from `docs/superpowers/plans/2026-10-05-t84-the-shield-walls.md` step 3 as `/tmp/battery86.mjs` and run `node /tmp/battery86.mjs /home/batman/coldsnap` once. Acceptance: T84's acceptance block, every line identical — both hashes unmoved.

**3. Version and build.** `MK = "0.5.81"` in `src/version.js`, then `npm run build`.

**4. The server, then the gate.** `npm run preview >/tmp/preview86.log 2>&1 &` — prove `SERVER UP` with `curl -sf --retry 20 --retry-delay 1 --retry-all-errors http://localhost:4173/coldsnap/ -o /dev/null && echo SERVER UP` — then `node scripts/gate.mjs smoke`: banner `boot-load smoke 0.5.81`, 23 PASS, 0 FAIL, one run; past the tool window, read the tail of `.superpowers/gates.log`, never a second run. Then `pkill -f "[v]ite preview"` as its own command. A failed gate still stops the server, then stops the task.

**5. Land.** Commit `src/game/rubbleworlds/draw.js`, `src/game/gravitydebris/draw.js`, `src/version.js` only (subject `the death heart, 0.5.81`), push. Phase row T86 — "The death heart: the disks blend green through red to a full-red heart at the line that kills" — LANDED (mark 0.5.81, hashes unchanged, the smoke count); commit with this plan file, push. The live check is the acceptance, phone and desktop, light and dark.

## Report

- One line of outcome, then bullets.
- Read-confirmation first.
- The battery's printed lines, verbatim; the smoke count exactly.
- Both hashes unchanged as their own labeled bullet.
- Fixture seed: 12345.
- Both commit hashes.
- Every deviation its own labeled bullet.
