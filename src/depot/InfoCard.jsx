// COLDSNAP DEPOT — InfoCard.jsx (P7.1 T4): one card, two doors. The
// manifest door carries CONFIRM PICK / ✗ (the decision gate before a bell
// pick); the bar door carries CLOSE (an owned type's reference). Pure
// presentation — every action is a prop (the Dispatch.jsx discipline).
import React from "react";

export default function InfoCard({ card, price, armed, door, onConfirm, onCancel }) {
  if (!card) return null;
  const B = { background: "#1a212b", border: "1px solid #48515f", color: "#e6ebf1", borderRadius: 8, padding: "10px 16px", fontFamily: "inherit", fontSize: 14, minHeight: 44, minWidth: 44, cursor: "pointer" };
  const row = (k, v) => (v == null ? null : (
    <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginTop: 4 }}>
      <span style={{ opacity: 0.65, letterSpacing: 1 }}>{k}</span><span>{v}</span>
    </div>
  ));
  return (
    <div data-info-card={door} style={{ position: "absolute", top: 52, right: 10, zIndex: 7, width: "min(300px, 62vw)", background: "rgba(14,18,24,0.96)", border: "1px solid #9fdcff", borderRadius: 8, padding: 12, fontFamily: "ui-monospace, Menlo, Consolas, monospace", color: "#e6ebf1" }}>
      <div style={{ color: "#9fdcff", letterSpacing: 2, fontSize: 14 }}>{card.label}</div>
      <div style={{ fontSize: 12, opacity: 0.85, lineHeight: 1.5, marginTop: 6 }}>{card.role}</div>
      {row("HEALTH", card.n ? `${card.hp} × ${card.n} men` : card.hp)}
      {row("DAMAGE", card.dmg)}
      {row("RANGE", card.range)}
      {row("SPEED", card.speed != null ? card.speed + " m/s" : null)}
      {row("PRICE", price != null ? "◆" + price : null)}
      <div style={{ marginTop: 8, fontSize: 10, letterSpacing: 1, opacity: 0.7 }}>SKILLS</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
        {card.skills.map((s) => <span key={s} style={{ fontSize: 10, letterSpacing: 1, border: "1px solid #2c3846", borderRadius: 4, padding: "2px 6px", color: "#ffd27a" }}>{s}</span>)}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        {door === "manifest" ? (
          <>
            <button data-info-confirm style={{ ...B, flex: 1, borderColor: "#4aff8c", color: "#4aff8c", opacity: armed ? 1 : 0.5 }} onClick={onConfirm}>CONFIRM PICK</button>
            <button data-info-cancel style={{ ...B, borderColor: "#ff6b5e", color: "#ff6b5e" }} onClick={onCancel}>✗</button>
          </>
        ) : (
          <button data-info-close style={{ ...B, flex: 1 }} onClick={onCancel}>CLOSE</button>
        )}
      </div>
    </div>
  );
}
