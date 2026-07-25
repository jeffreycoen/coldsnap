import React from "react";
import { CAMPAIGN, redact } from "../game/campaign.js";
import { composeAA9 } from "../game/closeout.js";
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
          const playable = !!m.scenario && i <= progress; // completed orders stay replayable
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
                {done ? `${marks || "★"} · REPLAY` : current ? (playable ? "▶ DEPLOY" : "AWAITING ISSUE") : "SEALED"}
              </span>
            </button>
          );
        })}

        {progress >= CAMPAIGN.length && (() => {
          // FORM AA-9 — filed under the book once the last order closes.
          // The stamp is identical on every tier; only the record varies.
          const aa9 = composeAA9(record);
          return (
            <div data-aa9={aa9.tier} style={{ position: "relative", border: "1px solid rgba(160,175,190,0.4)", background: "rgba(20,25,32,0.9)", padding: "12px 14px", marginTop: 18, animation: "aa9In 1.2s steps(18) both" }}>
              <style>{`
                @keyframes aa9In { from { clip-path: inset(0 0 100% 0); } to { clip-path: inset(0 0 0% 0); } }
                @keyframes aa9Stamp { 0% { opacity: 0; transform: rotate(-7deg) scale(2.4); } 70% { opacity: 1; transform: rotate(-7deg) scale(0.92); } 100% { opacity: 0.9; transform: rotate(-7deg) scale(1); } }
                @keyframes aa9Scrawl { from { opacity: 0; } to { opacity: 0.92; } }
              `}</style>
              <div style={{ borderBottom: "1px dashed #3a414b", paddingBottom: 6, marginBottom: 9, display: "flex", justifyContent: "space-between", gap: 10, fontSize: 9, letterSpacing: 1.5, color: "#8b93a0", whiteSpace: "nowrap" }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>PROCUREMENT BUREAU · FIELD OPERATIONS DIVISION</span>
                <span>FORM AA-9 · CARBON 2/3</span>
              </div>
              <div style={{ position: "absolute", top: 36, right: 14, transform: "rotate(-7deg)", border: "3px double #c9a04e", color: "#c9a04e", padding: "3px 10px", fontSize: 12, letterSpacing: 3, opacity: 0.9, textAlign: "center", pointerEvents: "none", animation: "aa9Stamp 0.35s 1.3s both" }}>
                PROCUREMENT<div style={{ fontSize: 10, letterSpacing: 2 }}>APPROVED</div>
              </div>
              <div style={{ fontSize: 11.5, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                {aa9.lines.map((ln, i) => {
                  if (ln.startsWith("[margin] ")) return (
                    <div key={i} data-margin style={{ color: "#b0a68f", fontFamily: '"Segoe Script","Bradley Hand","Comic Sans MS",cursive', fontStyle: "italic", fontSize: 13, transform: "rotate(-1.6deg)", padding: "4px 0 2px 26px", letterSpacing: 0.4, animation: "aa9Scrawl 0.7s 2.1s both" }}>{ln.slice(9)}</div>
                  );
                  return (
                    <div key={i} style={{
                      color: i === 0 ? "#ffd27a" : ln === "PROCUREMENT APPROVED." ? "#c9a04e" : "#cfd6de",
                      fontSize: i === 0 ? 13 : 11.5,
                      letterSpacing: i === 0 || ln === "PROCUREMENT APPROVED." ? 1 : 0,
                      paddingRight: i <= 1 ? 96 : 0,
                      marginTop: ln === "PROCUREMENT APPROVED." ? 7 : 0,
                    }}>{ln}</div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        <button data-camp="back" onClick={onBack}
          style={{ marginTop: 14, background: "rgba(28,33,41,0.85)", border: `2px solid ${COLORS.btnBorder}`, color: COLORS.bright, fontFamily: FONT, fontSize: 12, letterSpacing: 1, padding: "8px 14px", cursor: "pointer", touchAction: "manipulation" }}>
          ⏏ MENU
        </button>
      </div>
    </div>
  );
}
