import React, { useEffect, useState } from "react";
import { COLORS, FONT, btn, detectTouch } from "./theme.js";
import { MK } from "../version.js";
import { probeFront, burnFront } from "../depot/save.js";

// THE FRONT DOOR (P6 T7, mk1.14). The site opens on WINTER FRONT — one
// identity, one dominant action, three true laws — and the tech demos this
// war was built on live one quiet link away (DemosScreen).
export default function StartScreen({ onDepot, onDepotResume, onDemos }) {
  const [isTouch] = useState(detectTouch);
  // THE SAVED FRONT (P1 Task 3). null until the async probe lands — the menu
  // renders its normal self meanwhile and RESUME FRONT simply appears when
  // (and only when) there is something to resume. Never the other way round:
  // a button that flashes and vanishes reads as a bug.
  const [front, setFront] = useState(null);
  // Starting a NEW front over a saved one is destructive, so it is a two-tap
  // decision — the campaign's own arm/disarm, five seconds of silence disarms.
  const [burnArmed, setBurnArmed] = useState(false);
  useEffect(() => {
    if (!burnArmed) return;
    const t = setTimeout(() => setBurnArmed(false), 5000);
    return () => clearTimeout(t);
  }, [burnArmed]);

  useEffect(() => {
    let live = true;
    // probeFront burns a save from another mark itself and reports it gone —
    // this era runs no migration machinery, so a stale front is simply told.
    (async () => { const f = await probeFront(); if (live) setFront(f); })();
    return () => { live = false; };
  }, []);

  const hasFront = !!(front && front.has);
  const startNewFront = () => {
    if (!hasFront) { onDepot(); return; }
    if (!burnArmed) { setBurnArmed(true); return; }
    setBurnArmed(false);
    burnFront();
    setFront({ has: false });
    onDepot();
  };

  const option = (extra) => ({
    ...btn,
    display: "block",
    width: "100%",
    textAlign: "left",
    padding: "14px 16px",
    marginTop: 12,
    ...extra,
  });

  return (
    <div style={{ position: "fixed", inset: 0, background: COLORS.bg, fontFamily: FONT, color: COLORS.text, display: "flex", overflow: "auto", userSelect: "none", WebkitUserSelect: "none" }}>
      <div style={{ width: "min(420px, 92vw)", padding: "24px 0", margin: "auto" }}>
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <div style={{ fontSize: 34, color: COLORS.red, letterSpacing: 8 }}>COLDSNAP</div>
          <div style={{ fontSize: 13, letterSpacing: 8, color: COLORS.gold, marginTop: 2 }}>WINTER FRONT</div>
          <div data-mk style={{ opacity: 0.5, letterSpacing: 2, fontSize: 10, marginTop: 4 }}>{MK}</div>
          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 10 }}>A winter war in real stone.</div>
        </div>

        <div style={{ fontSize: 11, lineHeight: 1.7, opacity: 0.75, marginTop: 14 }}>
          <div>The muster bell rings every 90 seconds. Everything that reaches this war comes off that truck.</div>
          <div style={{ marginTop: 6 }}>Every wall is real masonry. What you break stays broken — what falls, falls for real.</div>
          <div style={{ marginTop: 6 }}>When a depot falls, its war is over. The save burns. No rewinds.</div>
        </div>

        {hasFront && (
          <button data-menu="depot-resume" style={option({ borderColor: "#c9a04e", background: "rgba(201,160,78,0.10)" })}
            onClick={() => onDepotResume && onDepotResume(front.data)}>
            <div style={{ color: COLORS.gold, fontSize: 15, letterSpacing: 2 }}>▶ RESUME FRONT</div>
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
              The front as you left it, at bell {front.bell}. Same ground, same craters, same men.
            </div>
          </button>
        )}

        {/* background must never be `undefined` here: spreading it over btn's
            background DELETES the property and the UA's light-grey default
            button shows through (mk0.43 regression, Jeff's screenshot) */}
        <button data-menu="depot" style={option({ borderColor: burnArmed ? "#a63c3c" : "#6a8a9a", background: burnArmed ? "rgba(92,33,27,0.85)" : COLORS.btnBg })} onClick={startNewFront}>
          <div style={{ color: burnArmed ? "#ff6b5e" : "#9fd4e4", fontSize: 15, letterSpacing: 2 }}>
            {burnArmed ? "THE FRONT BURNS — CONFIRM" : "▶ NEW FRONT — TAKE COMMAND"}
          </div>
          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
            {burnArmed
              ? "Tap again and the saved front is gone for good."
              : hasFront
                ? "A fresh valley. The saved front is burned when you start one."
                : "Two depots, one frozen valley, a river with one crossing. Break theirs before they break yours."}
          </div>
        </button>

        {front && front.stale && (
          <div data-front-stale style={{ fontSize: 11, opacity: 0.6, marginTop: 8, letterSpacing: 1 }}>
            THE FRONT HAS MOVED ON — a save from an older mark was discarded.
          </div>
        )}

        <button data-menu="demos" style={{ ...option(), marginTop: 22, opacity: 0.7, fontSize: 12 }} onClick={onDemos}>
          THE PROVING RANGE — tech demos this war was built on →
        </button>

        <div style={{ textAlign: "center", marginTop: 18, fontSize: 11, opacity: 0.55 }}>
          {isTouch ? "left stick drives · right stick or tap aims · ⏏ MENU returns here" : "ESC in-game returns to this menu"}
        </div>
      </div>
    </div>
  );
}
