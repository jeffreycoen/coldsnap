// P7 T22: module-scope bindings used by more than one era file (cut rule 3).
// Bodies verbatim from scripts/depot-test.mjs; only the `export` keywords
// are new text.

// identity fwdDir (DepotGame.jsx's ORIENT-aware transform, ORIENT===0 case)
// so these headless tests match the default map orientation exactly.
export const identFwdDir = (dx, dz) => ({ x: dx, z: dz });
// a straight-line flow field toward +z, for tests that don't build a real grid
export function straightGrid(dirX, dirZ) {
  return {
    cellAt: () => ({ dist: 1, dx: dirX, dz: dirZ, ice: false }),
    worldToGrid: () => null,
    inBounds: () => false,
    cells: [], idx: () => 0, gridToWorld: () => ({ x: 0, z: 0 }),
  };
}

// A regiment fat enough to muster every bell, and a seeded stream — the bell
// cycle has no static table to drive any more, so every fixture that wants an
// assault wires a real attacker economy.
export const fatReg = () => ({ heads: 400, tanks: 10, heads0: 400, tanks0: 10, scrap: 400 });

export const starvedReg = () => ({ heads: 0, tanks: 0, heads0: 400, tanks0: 10, scrap: 0 });
