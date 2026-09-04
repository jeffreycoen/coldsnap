# Floppy Tier A — the config-only shrink, mk2.59

One task. Four build-config changes, no source file touched: terser minification, the three shader trim with a build-stopping guard, the three console strip, the preload polyfill off. Expected: about 99 KB off the bundle. Baseline numbers come from the floppy budget paper of 2026-08-26 (measured at mk2.53); this task re-measures at head.

**Suggested model:** Sonnet 5 — mechanical config edit, all code given verbatim.

**Required reading (verified to exist):**
- This plan.
- `vite.config.js` (8 lines, whole file).
- `package.json` (whole file).
- `src/version.js` (whole file).

The agent's report opens by confirming these were read.

**Gates for this task:** `node scripts/gate.mjs golden` and `node scripts/gate.mjs smoke`. No others. Golden runs the engine from source and must be untouched by a build-config change; smoke is the only thing that runs the bundle in a browser. The owner's live check on phone and desktop is the acceptance.

---

### Step 1 — pin the start state. These asserts must hold before any change; a mismatch stops the task.

```bash
grep -c "terser" vite.config.js package.json; test $? -eq 1 && echo START-OK
grep -c 'MK = "mk2.58"' src/version.js
wc -l < vite.config.js
```

Expected: `START-OK` (no terser anywhere), `1` (version is mk2.58), `8` (the config is the 8-line file in the reading list). Then a baseline build for the before-number:

```bash
npm run build && stat -c %s dist/assets/index-*.js
```

Record the byte count. Expected near 1,429 KB × 1,024 ≈ 1,463,000 bytes; the report states the exact figure.

### Step 2 — install terser as a devDependency.

```bash
npm install -D terser
```

Expected: `package.json` gains `"terser"` under `devDependencies`; `package-lock.json` updates. No other dependency changes.

### Step 3 — replace `vite.config.js` with this exact content, whole file.

The BLANK list is the 43 shader chunks nothing in this repo reaches (floppy paper §4, A2). The FORBIDDEN guard stops the build if a class whose shaders are blanked enters the source, so a future miss is loud, never a black render. The guard is deliberately conservative: it also blocks `THREE.PointLight` (its shadow path is blanked) — un-blanking is one config edit in whatever task needs it. The console replace neutralizes only three's own `console.warn/error`; `(void 0)&&(…)` short-circuits, so arguments are never evaluated. COLDSNAP's reporters live in app source and are untouched.

```js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";

// Shader chunks three r128 ships that no material in this repo reaches.
// Blanked at build time; the guard below keeps the miss loud if a new
// material joins. Un-blank by deleting the entry.
const BLANK = [
  "lightmap_fragment", "lights_lambert_vertex", "envmap_physical_pars_fragment",
  "lights_phong_fragment", "lights_phong_pars_fragment", "lights_physical_fragment",
  "lights_physical_pars_fragment", "map_particle_fragment", "map_particle_pars_fragment",
  "metalnessmap_fragment", "metalnessmap_pars_fragment", "clearcoat_normal_fragment_begin",
  "clearcoat_normal_fragment_maps", "clearcoat_pars_fragment", "roughnessmap_fragment",
  "roughnessmap_pars_fragment", "shadowmask_pars_fragment", "transmissionmap_fragment",
  "transmissionmap_pars_fragment", "meshlambert_frag", "meshlambert_vert", "meshmatcap_frag",
  "meshmatcap_vert", "meshphong_frag", "meshphong_vert", "meshphysical_frag", "meshphysical_vert",
  "vsm_frag", "vsm_vert", "points_vert", "points_frag", "sprite_vert", "sprite_frag",
  "background_vert", "background_frag", "cube_vert", "cube_frag", "equirect_vert",
  "equirect_frag", "shadow_vert", "shadow_frag", "distanceRGBA_vert", "distanceRGBA_frag",
];

// Classes whose shaders are blanked above. One of these in src/ stops the
// build with the fix named, instead of shipping a black render.
const FORBIDDEN = /THREE\.(MeshStandardMaterial|MeshPhysicalMaterial|MeshLambertMaterial|MeshPhongMaterial|MeshMatcapMaterial|PointsMaterial|SpriteMaterial|ShadowMaterial|Points|Sprite|PointLight|VSMShadowMap|CubeTextureLoader|WebGLCubeRenderTarget|EquirectangularReflectionMapping|EquirectangularRefractionMapping)\b/;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(js|jsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

const threeTrim = {
  name: "three-trim",
  enforce: "pre",
  buildStart() {
    for (const f of walk(path.resolve("src"))) {
      const hit = fs.readFileSync(f, "utf8").match(FORBIDDEN);
      if (hit) throw new Error(
        `three-trim: ${hit[0]} appears in ${f}, but its shaders are blanked. ` +
        `Remove its chunks from BLANK in vite.config.js before using it.`);
    }
  },
  transform(code, id) {
    if (!id.includes("three.module.js")) return null;
    for (const u of BLANK) {
      code = code.replace(new RegExp(`^var ${u} = "(?:[^"\\\\]|\\\\.)*";`, "m"), `var ${u} = "";`);
    }
    code = code.replace(/console\.(warn|error)\(/g, "(void 0)&&(");
    return { code, map: null };
  },
};

// Served at https://jeffreycoen.github.io/coldsnap/
export default defineConfig({
  base: "/coldsnap/",
  plugins: [threeTrim, react()],
  build: {
    minify: "terser",
    terserOptions: { compress: { passes: 2 }, format: { comments: false } },
    modulePreload: { polyfill: false },
  },
});
```

### Step 4 — build and measure.

```bash
npm run build && stat -c %s dist/assets/index-*.js
gzip -c dist/assets/index-*.js | wc -c
```

Expected: bundle at or under 1,376,000 bytes (about 1,344 KB; the paper's stacked measurement was 1,330 KB at mk2.53, head is five tasks heavier). A bundle above that means a lever silently failed to apply — stop and report. The report states both exact figures.

### Step 5 — prove the guard fires.

```bash
echo "const probe = THREE.MeshPhongMaterial;" > src/_trim-probe.js
npm run build; echo "exit=$?"
rm src/_trim-probe.js
```

Expected: the build FAILS with the three-trim message naming `THREE.MeshPhongMaterial` and `src/_trim-probe.js`, `exit=1` or other nonzero. The probe file is deleted after. Then `npm run build` once more, clean, to leave a good `dist`.

### Step 6 — gates.

```bash
node scripts/gate.mjs golden
```

Expected: PASS, hashes unchanged. Then smoke against the new bundle:

```bash
npm run preview &
node scripts/gate.mjs smoke
kill %1
```

Expected: smoke's full pass count, zero FAIL. Any failure stops the task and is reported with output; the sweep license does not cover this task — no test text moves.

### Step 7 — bump, build, commit, push.

`src/version.js` line 6, one change:

```js
export const MK = "mk2.59";
```

Then, build after the bump, never before:

```bash
npm run build
git add vite.config.js package.json package-lock.json src/version.js
git commit -m "the tight bundle — terser, the shader trim with its guard, three's warnings stripped, the preload polyfill off, mk2.59"
git push
```

Expected: clean push to main; Pages deploys. The report ends with before/after bytes, gzip bytes, and floppy headroom in KB (1,440 × 1,024 minus bundle minus `dist/index.html` bytes).

---

**Rollback:** revert the commit. No source file, save format, or gate is touched by this task.
