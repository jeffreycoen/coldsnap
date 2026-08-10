// src/depot/orient.js — DEPOT's four 90°-step assault orientations, as pure
// coordinate transforms. Factored out of DepotGame.jsx (where they used to
// live as closures over a module-local `let ORIENT`) so the exact transform
// used to convert body/spawn WORLD (x, z) positions into territory.js's
// CANONICAL (u, v) space is importable and headlessly testable.
//
// This is where the Task 2 coordinate-space bug hid: territory.js's own
// pure functions (fogStateAt/holderAt/canBuild) are orientation-agnostic —
// they just index a (u, v) grid — so testing them alone never exercised the
// world->canonical conversion at all. The bug was entirely in the caller
// (DepotGame.jsx passing raw world x/z into territory.js instead of
// invW(x,z)), and it was invisible on ORIENT===0 (the default, where invW is
// the identity) — exactly the orientation depot-test.mjs's map-dependent
// scenarios always ran under. Pinning fwdU/invW here, with round-trip and
// non-default-orientation asserts in depot-test.mjs, closes that blind spot.
export function fwdUFor(ORIENT, u, v) {
  return ORIENT === 0 ? { x: u, z: v }
    : ORIENT === 1 ? { x: -v, z: u }
    : ORIENT === 2 ? { x: -u, z: -v }
    : { x: v, z: -u };
}
export function fwdDirFor(ORIENT, du, dv) {
  return ORIENT === 0 ? { x: du, z: dv }
    : ORIENT === 1 ? { x: -dv, z: du }
    : ORIENT === 2 ? { x: -du, z: -dv }
    : { x: dv, z: -du };
}
// invWFor is fwdUFor's inverse: world (x, z) -> canonical (u, v).
export function invWFor(ORIENT, x, z) {
  return ORIENT === 0 ? { u: x, v: z }
    : ORIENT === 1 ? { u: z, v: -x }
    : ORIENT === 2 ? { u: -x, v: -z }
    : { u: -z, v: x };
}
