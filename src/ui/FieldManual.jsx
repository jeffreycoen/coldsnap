import React, { useState } from "react";
import { FONT } from "./theme.js";

// THE FIELD MANUAL (P6 T8, mk1.15). Six linked cards, the first-entry tour.
// Owner-approved copy — do not edit a word without a ruling.
const CARDS = [
  { title: "REAL STONE", body: "The whole battlefield is real physics. Collapse a wall on the men behind it. Drop a roof on a squad. Rubble is a weapon." },
  { title: "YOUR MEN", body: "Tap a squad, give it orders. Men are your eyes — what they can't see, you can't see. Only engineers build." },
  { title: "TAKE CONTROL", body: "Any squad or tower can be yours. Drive it, aim it, fire it. The front fights on without you." },
  { title: "YOUR ARMOR", body: "A Bison and a transport stand at your depot. Order them like squads — or take the controls yourself. The tracks brake for your own men until you say otherwise. Theirs to kill, and dear to replace: lost armor returns only off a late convoy, at a price." },
  { title: "THE BELL", body: "Scrap flows every second. Every 90 seconds the bell rings and the convoy offers new mercenaries — pick one. Then they attack." },
  { title: "THE MARKET", body: "One market, both armies. What the field is full of costs more. Buy out what they need before they can." },
  { title: "THE FALL", body: "Lose your depot and the save burns. No rewinds. But every valley is drawn fresh — a new front is always waiting." },
];

export default function FieldManual({ onClose }) {
  const [i, setI] = useState(0);
  const [never, setNever] = useState(false);
  const card = CARDS[i];
  const last = i === CARDS.length - 1;
  const B = { background: "#1a212b", border: "1px solid #48515f", color: "#e6ebf1", borderRadius: 8, padding: "10px 18px", fontFamily: "inherit", fontSize: 13, letterSpacing: 1, minHeight: 44, minWidth: 44, cursor: "pointer" };
  return (
    <div data-manual style={{ position: "absolute", inset: 0, zIndex: 9, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(10,13,18,0.82)", fontFamily: FONT, color: "#e6ebf1", padding: 20 }}>
      <div style={{ width: "min(400px, 92vw)", background: "rgba(14,18,24,0.96)", border: "1px solid #48515f", borderRadius: 10, padding: "18px 20px", textAlign: "left" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={{ fontSize: 11, letterSpacing: 3, opacity: 0.6 }}>FIELD MANUAL · {i + 1}/{CARDS.length}</div>
          <button data-manual-skip style={{ ...B, minHeight: 0, minWidth: 0, padding: "4px 10px", fontSize: 11, opacity: 0.8 }} onClick={() => onClose(never)}>SKIP ✕</button>
        </div>
        <div data-manual-card style={{ fontSize: 17, letterSpacing: 3, color: "#ffd27a", marginTop: 12 }}>{card.title}</div>
        <div style={{ fontSize: 13, lineHeight: 1.7, opacity: 0.9, marginTop: 10, minHeight: 88 }}>{card.body}</div>
        <div data-manual-never onClick={() => setNever(!never)} style={{ fontSize: 11, opacity: 0.7, marginTop: 12, cursor: "pointer" }}>
          {never ? "☑" : "☐"} DON'T SHOW THIS AGAIN
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, gap: 10 }}>
          <button data-manual-back style={{ ...B, visibility: i === 0 ? "hidden" : "visible" }} onClick={() => setI(i - 1)}>← BACK</button>
          {last
            ? <button data-manual-close style={{ ...B, borderColor: "#4aff8c", color: "#4aff8c" }} onClick={() => onClose(never)}>CLOSE</button>
            : <button data-manual-next style={{ ...B, borderColor: "#9fd4e4", color: "#9fd4e4" }} onClick={() => setI(i + 1)}>NEXT →</button>}
        </div>
      </div>
    </div>
  );
}
