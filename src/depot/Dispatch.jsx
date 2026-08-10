// depot/Dispatch.jsx — the between-wave stall card. Bureau transmission
// teletypes onto the card; ACKNOWLEDGE is the single gate back into build
// phase (a future multiplayer build swaps this button for a network-ready
// gate that calls the same state.js advance()).
//
// Modal hard-won lesson (verbatim, ported from campaign/TD): a card that
// appears in the same React flush as a tap gets dismissed unread by the
// trailing click. ACKNOWLEDGE is armed only after 500ms. Scrim clicks never
// dismiss — only the button does.
//
// Typed pattern copied from src/game/runner/Typed.jsx — depot stays
// self-contained, no cross-module imports.
import React, { useEffect, useState } from "react";

function Typed({ text, cps = 45, style }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    const iv = setInterval(() => setN((v) => (v >= text.length ? v : v + 1)), 1000 / cps);
    return () => clearInterval(iv);
  }, [text, cps]);
  return <span style={style}>{text.slice(0, n)}{n < text.length ? <span style={{ opacity: 0.6 }}>{"▌"}</span> : null}</span>;
}

export default function Dispatch({ dispatch, gating, onAcknowledge, label }) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    setArmed(false);
    const t = setTimeout(() => setArmed(true), 500);
    return () => clearTimeout(t);
  }, [dispatch]);

  if (!dispatch) return null;

  return (
    <div style={S.scrim}>
      <div style={S.card} data-dispatch-wo={dispatch.wo}>
        <div style={S.head}>
          <span style={{ color: "#7fd7ff", letterSpacing: 2 }}>FIELD DISPATCH</span>
          <span style={{ opacity: 0.6 }}>{dispatch.wo}</span>
        </div>
        <div style={S.body}>
          {dispatch.lines.map((line, i) => (
            <div key={i} style={S.line}><Typed text={line} /></div>
          ))}
        </div>
        <button
          style={{ ...S.ack, opacity: armed ? 1 : 0.4, cursor: armed ? "pointer" : "default" }}
          disabled={!armed}
          onClick={() => { if (armed) onAcknowledge(); }}
        >
          {label || (gating ? "ACKNOWLEDGE" : "CLOSE")}
        </button>
      </div>
    </div>
  );
}

const S = {
  scrim: { position: "absolute", inset: 0, background: "rgba(6,10,16,0.72)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 20 },
  card: { width: "min(420px, 86vw)", background: "#0d1420", border: "1px solid #2c3846", borderRadius: 6, padding: "16px 18px", boxShadow: "0 10px 40px rgba(0,0,0,0.5)" },
  head: { display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 12, borderBottom: "1px solid #2c3846", paddingBottom: 8 },
  body: { minHeight: 64, fontSize: 13, lineHeight: 1.7, color: "#e6ebf1", letterSpacing: 0.5, fontFamily: "monospace" },
  line: { marginBottom: 4 },
  ack: { marginTop: 14, width: "100%", padding: "9px 0", background: "transparent", border: "1px solid #4aff8c", color: "#4aff8c", letterSpacing: 2, fontSize: 12, borderRadius: 4 },
};
