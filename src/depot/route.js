// src/depot/route.js — planRoute, moved verbatim out of DepotGame.jsx (P7
// T2): the motor pool routes hulls on the same movement grid squads march,
// and drivers.js must not import a React component module. P6 T1's design
// note rides with it: breadth-first from the start cell, 8-way with the
// flow field's corner rule, honest clamp to the closest reachable cell,
// thinned to turning points. Deterministic, zero rng.
export function planRoute(grid, ax, az, dx, dz) {
  const s = grid.worldToGrid(ax, az);
  if (!grid.inBounds(s.gx, s.gz)) return null;
  const t = { gx: Math.max(0, Math.min(grid.w - 1, grid.worldToGrid(dx, dz).gx)),
              gz: Math.max(0, Math.min(grid.h - 1, grid.worldToGrid(dx, dz).gz)) };
  const { cells } = grid;
  const prev = new Int32Array(grid.w * grid.h).fill(-2);
  const si = grid.idx(s.gx, s.gz);
  prev[si] = -1;
  const q = [si];
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
  let head = 0, best = si, bestD = Infinity;
  while (head < q.length) {
    const ci = q[head++];
    const cgx = ci % grid.w, cgz = (ci / grid.w) | 0;
    const dd = Math.hypot(cgx - t.gx, cgz - t.gz);
    if (dd < bestD) { bestD = dd; best = ci; if (dd === 0) break; }
    for (const d of dirs) {
      const nx = cgx + d[0], nz = cgz + d[1];
      if (!grid.inBounds(nx, nz)) continue;
      const ni = grid.idx(nx, nz);
      if (prev[ni] !== -2 || cells[ni].blocked) continue;
      if (d[0] !== 0 && d[1] !== 0) {
        if (cells[grid.idx(cgx + d[0], cgz)].blocked || cells[grid.idx(cgx, cgz + d[1])].blocked) continue;
      }
      prev[ni] = ci;
      q.push(ni);
    }
  }
  if (best === si) return null; // nowhere to go (or already there)
  const cellsPath = [];
  for (let ci = best; ci !== -1; ci = prev[ci]) cellsPath.push(ci);
  cellsPath.reverse();
  const pts = [];
  for (let i = 1; i < cellsPath.length; i++) {
    const p0 = cellsPath[i - 1], p1 = cellsPath[i], p2 = cellsPath[i + 1];
    const turn = p2 == null ||
      (p1 % grid.w) - (p0 % grid.w) !== (p2 % grid.w) - (p1 % grid.w) ||
      ((p1 / grid.w) | 0) - ((p0 / grid.w) | 0) !== ((p2 / grid.w) | 0) - ((p1 / grid.w) | 0);
    if (turn) pts.push(grid.gridToWorld(p1 % grid.w, (p1 / grid.w) | 0));
  }
  return { pts, reached: bestD === 0 };
}
