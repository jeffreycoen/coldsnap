import React from "react";
import { CAMPAIGN, redact } from "../game/campaign.js";
import { COLORS, FONT } from "./theme.js";

// The order book. All eight orders are always listed; orders beyond the
// player's progress are SEALED — row dimmed to a silhouette, title rendered
// as redaction bars, WO number left visible. The current order is the only
// clickable row. An order reached by progress but not yet authored shows
// AWAITING ISSUE (title revealed, row disabled).
export default function CampaignScreen({ progress, record, onPlay, onBack }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "#10151b", color: COLORS.bright, fontFamily: FONT, display: "flex", flexDirection: "column", alignItems: "center", overflowY: "auto", padding: "28px 12px" }}>
      <div style={{ width: "100%", maxWidth: 560 }}>
        <div style={{ border: `2px solid ${COLORS.bright}`, padding: "10px 14px", marginBottom: 18 }}>
          <div style={{ fontSize: 11, letterSpacing: 2, opacity: 0.7 }}>PROCUREMENT BUREAU · FIELD OPERATIONS DIVISION</div>
          <div style={{ fontSize: 20, letterSpacing: 1, marginTop: 4 }}>CLEARANCE PROGRAM — ORDER BOOK</div>
          <div style={{ fontSize: 10, letterSpacing: 1, opacity: 0.55, marginTop: 4 }}>EIGHT WORK ORDERS · THE TERRITORY IS BEING RE-LET · CARBON 2/3</div>
        </div>

        {CAMPAIGN.map((m, i) => {
          const done = i < progress;
          const current = i === progress;
          const sealed = i > progress;
          const playable = current && !!m.scenario;
          const row = record[m.id];
          const marks = row ? `${row.fulfilled ? "★" : ""}${row.deviated ? "☆" : ""}` : "";
          return (
            <button
              key={m.id}
              data-camp={m.id}
              disabled={!playable}
              onClick={() => playable && onPlay(m)}
              style={{
                display: "flex", alignItems: "baseline", gap: 12, width: "100%", textAlign: "left",
                background: current ? "rgba(201,160,78,0.10)" : "transparent",
                border: `1px solid ${current ? COLORS.gold || "#c9a04e" : "rgba(160,175,190,0.25)"}`,
                borderLeft: `4px solid ${done ? "#7fd7a0" : current ? "#c9a04e" : "rgba(160,175,190,0.25)"}`,
                color: COLORS.bright, fontFamily: FONT, padding: "11px 12px", marginBottom: 8,
                cursor: playable ? "pointer" : "default",
                opacity: sealed ? 0.22 : 1,
                touchAction: "manipulation",
              }}
            >
              <span style={{ fontSize: 12, letterSpacing: 1, opacity: 0.8, flexShrink: 0 }}>{m.wo}</span>
              <span style={{ fontSize: 14, letterSpacing: 1, flexGrow: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {sealed ? redact(m.title) : m.title}
              </span>
              <span style={{ fontSize: 12, flexShrink: 0, color: row && row.deviated && !row.fulfilled ? "#9aa7b4" : "#c9a04e" }}>
                {done ? (marks || "★") : current ? (playable ? "▶ DEPLOY" : "AWAITING ISSUE") : "SEALED"}
              </span>
            </button>
          );
        })}

        <button data-camp="back" onClick={onBack}
          style={{ marginTop: 14, background: "rgba(28,33,41,0.85)", border: `2px solid ${COLORS.btnBorder}`, color: COLORS.bright, fontFamily: FONT, fontSize: 12, letterSpacing: 1, padding: "8px 14px", cursor: "pointer", touchAction: "manipulation" }}>
          ⏏ MENU
        </button>
      </div>
    </div>
  );
}
