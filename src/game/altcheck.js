// game/altcheck.js — deviation detector for contracts with a silent no-kill
// completion. thin_ice: all subjects alive and none inside the pond
// footprint (+margin) => "CLEAR". Any subject dead => "VOID" — the kill
// path owns the contract from there. Pure over (bodies, rect, group).
// Verbatim from the buildout plan's verified altcheck.mjs (T4).

export function disperseState(bodies, rect, group, margin = 1) {
  let alive = 0;
  for (const b of bodies) {
    if (b.group !== group) continue;
    if (!b.alive) return "VOID";
    alive++;
    const on = b.pos.x > rect.x0 - margin && b.pos.x < rect.x1 + margin &&
               b.pos.z > rect.z0 - margin && b.pos.z < rect.z1 + margin;
    if (on) return "OCCUPIED";
  }
  return alive > 0 ? "CLEAR" : "VOID";
}
