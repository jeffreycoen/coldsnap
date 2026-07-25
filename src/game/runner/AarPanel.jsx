// game/runner/AarPanel.jsx — FORM AA-7, the filed after-action report.
// Moved verbatim from CampaignRunner.jsx in the module split. The scrim is
// inert on purpose: a report leaves the desk only via FILE REPORT — a stray
// tap must not dismiss it unread.
import React from "react";

export function AarPanel({ aar, isTouch, P, onFile }) {
  const stampCol = aar.medal === "GOLD" ? "#ffd27a" : aar.medal === "SILVER" ? "#cfd6de" : aar.medal === "BRONZE" ? "#b0764a" : "#ff6b5e";
  return (
    <div style={{ position: "absolute", inset: 0, background: "rgba(10,12,16,0.55)", zIndex: 6, display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
      <style>{`
        @keyframes csPrintout { from { clip-path: inset(0 0 100% 0); } to { clip-path: inset(0 0 0% 0); } }
        @keyframes csStamp { 0% { opacity: 0; transform: rotate(-7deg) scale(2.4); } 70% { opacity: 1; transform: rotate(-7deg) scale(0.92); } 100% { opacity: 0.9; transform: rotate(-7deg) scale(1); } }
        @keyframes csScrawl { from { opacity: 0; } to { opacity: 0.92; } }
        @keyframes csInk { from { border-bottom-color: transparent; } to { border-bottom-color: #b0a68f; } }
      `}</style>
      <div data-aar onClick={(e) => e.stopPropagation()} style={{ ...P.panel, position: "relative", width: "min(470px, 94vw)", maxHeight: "76vh", overflowY: "auto", padding: "12px 16px", animation: "csPrintout 1.5s steps(22) both" }}>
        <div style={{ borderBottom: "1px dashed #3a414b", paddingBottom: 6, marginBottom: 9, display: "flex", justifyContent: "space-between", gap: 10, fontSize: isTouch ? 10 : 9, letterSpacing: 1.5, color: "#8b93a0", whiteSpace: "nowrap" }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>PROCUREMENT BUREAU · FIELD ACCEPTANCE DIVISION</span>
          <span>FORM AA-7 · CARBON 2/3</span>
        </div>
        <div style={{ position: "absolute", top: 34, right: 16, transform: "rotate(-7deg)", border: `3px double ${stampCol}`, color: stampCol, padding: "3px 10px", fontSize: 13, letterSpacing: 3, opacity: 0.9, textAlign: "center", pointerEvents: "none", animation: "csStamp 0.35s 1.6s both" }}>
          {aar.outcome.split(" — ")[0]}
          {aar.medal ? (
            <div style={{ fontSize: 10, letterSpacing: 2 }}>★ {aar.medal}</div>
          ) : aar.outcome.includes(" — ") ? (
            <div style={{ fontSize: 10, letterSpacing: 2 }}>{aar.outcome.split(" — ")[1]}</div>
          ) : null}
        </div>
        <div style={{ fontSize: isTouch ? 13 : 11.5, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
          {aar.lines.map((ln, i, all) => {
            const sub = ln.startsWith("  SUBJECT");
            const remark = ln.startsWith("REMARK:");
            const exp = ln.startsWith("EXPENDITURE:");
            const att = ln.startsWith("ATTACHMENT ");
            // "[underline] <text>" rows render no line of their own —
            // they put the archivist's ink under that phrase where it
            // sits in the attachment above
            if (ln.startsWith("[underline] ")) return null;
            const under = att ? all.filter((l) => l.startsWith("[underline] ")).map((l) => l.slice(12)).find((t) => ln.includes(t)) : null;
            const body = under ? (() => {
              const at = ln.indexOf(under);
              return (<>
                {ln.slice(0, at)}
                <span style={{ display: "inline-block", borderBottom: "2px solid", borderBottomColor: "#b0a68f", transform: "rotate(-0.5deg)", padding: "0 1px", animation: "csInk 0.4s 2.3s both" }}>{under}</span>
                {ln.slice(at + under.length)}
              </>);
            })() : ln;
            // the second hand: pencil on the carbon, written after the
            // stamp — a different script, off the form's grid
            if (ln.startsWith("[margin] ")) return (
              <div key={i} data-margin style={{
                color: "#b0a68f",
                fontFamily: '"Segoe Script","Bradley Hand","Comic Sans MS",cursive',
                fontStyle: "italic",
                fontSize: isTouch ? 14 : 12.5,
                transform: "rotate(-1.6deg)",
                padding: "3px 0 2px 26px",
                letterSpacing: 0.4,
                animation: "csScrawl 0.7s 2.3s both",
              }}>{ln.slice(9)}</div>
            );
            return (
              <div key={i} style={{
                color: i === 0 || remark ? "#ffd27a" : sub || att ? "#a9b3bf" : "#cfd6de",
                fontSize: i === 0 ? (isTouch ? 15 : 13) : remark ? (isTouch ? 13.5 : 12) : att ? (isTouch ? 12 : 10.5) : (isTouch ? 13 : 11.5),
                paddingRight: i <= 1 ? 98 : 0, // the title and status wrap clear of the stamp
                letterSpacing: i === 0 ? 1 : 0,
                fontStyle: remark ? "italic" : "normal",
                borderTop: exp || ln.startsWith("ATTACHMENT A") ? "1px solid #3a414b" : "none",
                marginTop: exp || ln.startsWith("ATTACHMENT A") ? 7 : 0, paddingTop: exp || ln.startsWith("ATTACHMENT A") ? 7 : 0,
              }}>{body}</div>
            );
          })}
        </div>
        <button data-aar-file onClick={onFile} style={{ ...P.btn, marginTop: 10, width: "100%", borderColor: "#8a5a1c", letterSpacing: 2 }}>FILE REPORT</button>
      </div>
    </div>
  );
}
