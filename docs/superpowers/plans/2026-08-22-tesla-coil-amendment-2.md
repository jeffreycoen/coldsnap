# The Tesla Coil — Amendment 2 (Task 2, the invisible bolt)

## The defect

The mk2.16 bolts are drawn as WebGL line primitives. The renderer's own territory-contour comment (`src/render/renderer.js:665-678`) records the failure mode exactly: a WebGL line rasterizes one render-target pixel wide no matter the projection, and a one-pixel hairline "drowns in the dither/quantize post pass" — the green edge contour survives only by drawing the same geometry twice at a half-render-target-pixel screen offset, in saturated green. The bolt is a one-pixel near-white line over near-white snow through that same quantizer; its halo's `scale.setScalar(1.001)` offset is sub-pixel and doubles nothing. The bolt is drawn every frame and erased by the post pass. The event path is proven live (the scorch rides the kill event pushed beside the zap event).

## The fix

Draw bolt segments the way the game already draws things that are provably visible: the tracer idiom — instanced boxes with real thickness, a white core inside a fat saturated-blue halo, with the tracer pass's own 1/zoom screen-thickness floor so a bolt never falls under ~2 screen pixels.

All edits in `src/render/renderer.js`, inside the mk2.16 bolt block.

### Step 1 — the pools replace the lines

Replace these lines (currently after the `spawnBolt` function):

```js
  const boltGeo = new THREE.BufferGeometry();
  const boltPos = new Float32Array(BOLT_CAP * (BOLT_SEGS + 3) * 2 * 3); // main run + one fork per bolt
  boltGeo.setAttribute("position", new THREE.BufferAttribute(boltPos, 3));
  const boltCore = new THREE.LineSegments(boltGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 }));
  const boltHalo = new THREE.LineSegments(boltGeo, new THREE.LineBasicMaterial({ color: 0x7fd0ff, transparent: true, opacity: 0.4 }));
  boltHalo.scale.setScalar(1.001);
  boltCore.frustumCulled = false; boltHalo.frustumCulled = false;
  boltCore.layers.set(1); boltHalo.layers.set(1);
  scene.add(boltCore); scene.add(boltHalo);
```

with:

```js
  // Amendment 2: BOXES, NOT LINES. A GL line is one RT pixel and drowns in
  // the dither/quantize post pass (the edge-contour comment above documents
  // this exact failure); the tracer pools are the proven-visible idiom.
  // White core inside a fat saturated-blue halo — the blue is what reads
  // against snow. pool() adds to the scene and pre-fills instanceColor.
  const BOLT_SEG_CAP = BOLT_CAP * (BOLT_SEGS + 2);
  const boltCoreMesh = pool(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false }), BOLT_SEG_CAP, false);
  const boltHaloMesh = pool(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0x2e9bff, transparent: true, opacity: 0.42, depthWrite: false }), BOLT_SEG_CAP, false);
  boltCoreMesh.layers.set(1); boltHaloMesh.layers.set(1);
  const boltFrom = new THREE.Vector3(), boltTo = new THREE.Vector3(), boltAxis = new THREE.Vector3(0, 0, 1), boltDir = new THREE.Vector3();
```

### Step 2 — writeBolts poses instances

Inside `writeBolts`, replace everything from `let w = 0;` through the end of the function (the `seg` helper, the per-bolt loop's two `seg(...)` fork calls, the buffer zero-fill, `needsUpdate`, and the two material-opacity lines) with:

```js
    let bi = 0;
    const sMin = Math.max(1, 1.35 / zoom); // the tracer pass's screen floor
    const put = (x1, y1, z1, x2, y2, z2, th) => {
      if (bi >= BOLT_SEG_CAP) return;
      boltFrom.set(x1, y1, z1); boltTo.set(x2, y2, z2);
      const len = boltFrom.distanceTo(boltTo);
      if (len < 1e-4) return;
      boltDir.subVectors(boltTo, boltFrom).divideScalar(len);
      dummy.position.set((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
      dummy.quaternion.setFromUnitVectors(boltAxis, boltDir);
      dummy.scale.set(th, th, len);
      dummy.updateMatrix();
      boltCoreMesh.setMatrixAt(bi, dummy.matrix);
      dummy.scale.set(th * 2.4, th * 2.4, len);
      dummy.updateMatrix();
      boltHaloMesh.setMatrixAt(bi++, dummy.matrix);
    };
    for (let i = bolts.length - 1; i >= 0; i--) {
      const b = bolts[i];
      b.age += dt;
      if (b.age >= b.life) { bolts.splice(i, 1); continue; }
      const fade = 1 - b.age / b.life;
      const th = 0.11 * sMin * (0.6 + 0.4 * fade) * (0.75 + Math.random() * 0.5);
      const pts = [{ x: b.ax, y: b.ay, z: b.az }];
      for (let k = 1; k < BOLT_SEGS; k++) {
        const t = k / BOLT_SEGS, j = b.amp * fade * Math.sin(Math.PI * t);
        pts.push({ x: b.ax + (b.bx - b.ax) * t + (Math.random() - 0.5) * j, y: b.ay + (b.by - b.ay) * t + (Math.random() - 0.5) * j * 0.6, z: b.az + (b.bz - b.az) * t + (Math.random() - 0.5) * j });
      }
      pts.push({ x: b.bx, y: b.by, z: b.bz });
      for (let k = 0; k < pts.length - 1; k++) put(pts[k].x, pts[k].y, pts[k].z, pts[k + 1].x, pts[k + 1].y, pts[k + 1].z, th);
      const f = pts[1 + ((Math.random() * (BOLT_SEGS - 2)) | 0)];
      const fl = 0.5 + Math.random() * b.amp;
      put(f.x, f.y, f.z, f.x + (Math.random() - 0.5) * fl * 2, f.y - fl * (0.4 + Math.random() * 0.8), f.z + (Math.random() - 0.5) * fl * 2, th * 0.7);
      put(f.x, f.y, f.z, f.x + (Math.random() - 0.5) * fl, f.y - fl * 0.3, f.z + (Math.random() - 0.5) * fl, th * 0.7);
    }
    boltCoreMesh.count = bi; boltCoreMesh.instanceMatrix.needsUpdate = true;
    boltHaloMesh.count = bi; boltHaloMesh.instanceMatrix.needsUpdate = true;
    boltCoreMesh.material.opacity = 0.55 + Math.random() * 0.4;
    boltHaloMesh.material.opacity = 0.3 + Math.random() * 0.22;
```

(`dummy` and `zoom` are the render-loop's existing locals in this scope — the tracer pass at ~:2372 uses both the same way. The bolt row shape `{ax..bz, life, age, amp}` and `spawnBolt`'s cap-shift are unchanged; strike, hop, idle, and pond callers all stay as they are.)

### Step 3 — gates and the landing

`node scripts/gate.mjs smoke` and `node scripts/gate.mjs golden` (additive: the demo spawns no bolts; count stays 0). Both green → bump `src/version.js` to `mk2.17`, build, commit ("the tesla coil — the visible bolt, mk2.17"), push. The owner's eyes on the live site are the acceptance.

**Version note:** this consumes the mk2.17 slot; the sound task becomes mk2.18 and the switch-and-words task mk2.19. Tasks are sequential and never skipped — the plan's later task headers are re-marked at their dispatch, not rewritten now.
