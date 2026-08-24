// COLDSNAP DEPOT — Crate.jsx (mk2.28): THE QUARTERMASTER'S CRATE. A drawn
// wireframe crate in the dot-matrix line voice — slat lines, a hinged lid
// that swings open in 180ms. Pure presentation: no state, no handlers of
// its own; every behavior rides the props. One DOM, phone and desktop.
import React from "react";

export default function CrateChip({ label, icon, count, open, line, active, style, ...rest }) {
  const col = active ? "#9fdcff" : "#e6ebf1";
  return (
    <div {...rest} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
      minWidth: 64, minHeight: 52, padding: "6px 10px 8px", background: "#1a212b",
      border: "1px solid " + (active ? "#9fdcff" : "#48515f"), borderRadius: 8,
      fontSize: 12, cursor: "pointer", color: col, ...style }}>
      <svg width="34" height="26" viewBox="0 0 34 26" style={{ display: "block", overflow: "visible" }}>
        <g stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round">
          <rect x="3" y="8" width="28" height="15" rx="1" />
          <line x1="3" y1="13" x2="31" y2="13" opacity="0.5" />
          <line x1="11" y1="8" x2="11" y2="23" opacity="0.35" />
          <line x1="23" y1="8" x2="23" y2="23" opacity="0.35" />
          <g style={{ transformOrigin: "3px 8px", transform: open ? "rotate(-72deg)" : "none", transition: "transform 0.18s ease-out" }}>
            <rect x="3" y="4" width="28" height="4" rx="1" />
          </g>
        </g>
        <text x="17" y="20" textAnchor="middle" fontSize="8" fill="currentColor" opacity="0.85">{icon}</text>
      </svg>
      <div style={{ letterSpacing: 1 }}>{label}</div>
      <div style={{ fontSize: 9, opacity: 0.6, minHeight: 11 }}>{line || count}</div>
    </div>
  );
}
