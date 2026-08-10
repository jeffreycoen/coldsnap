import React, { useEffect, useState } from "react";
import { COLORS, FONT, btn, detectTouch } from "./theme.js";

// Display-only mirror of the demo's trial order for the medal star row; the
// demo file is frozen and does not export TRIALS.
const TRIAL_IDS = ["gunnery", "roadkill", "saturation", "demolition", "deep_end", "counter_battery", "thin_ice"];

const medalColor = (m) =>
  !m ? COLORS.btnBorder : m.deviation ? COLORS.dim : m.medal === "GOLD" ? COLORS.gold : m.medal === "SILVER" ? COLORS.text : "#b0764a";

export default function StartScreen({ onPlay, onSandbox, onCampaign, onControls, onMech, onTowerDef, onDepot }) {
  const [medals, setMedals] = useState(null);
  const [csMedals, setCsMedals] = useState(null);
  const [isTouch] = useState(detectTouch);

  useEffect(() => {
    let live = true;
    const load = async (key, set) => {
      try {
        const r = await window.storage.get(key);
        const m = JSON.parse(r.value);
        if (live && m && typeof m === "object") set(m);
      } catch (e) {}
    };
    load("coldsnap-medals", setMedals);
    load("coldsnap-cs-medals", setCsMedals);
    return () => { live = false; };
  }, []);

  const starRow = (m, hook) => m && (
    <div style={{ marginTop: 6, fontSize: 13 }}>
      {TRIAL_IDS.map((id) => (
        <span key={id} style={{ color: medalColor(m[id]), marginRight: 4 }}>{m[id] && m[id].deviation ? "☆" : "★"}</span>
      ))}
      <span style={{ fontSize: 11, opacity: 0.7, marginLeft: 4 }}>{hook}</span>
    </div>
  );

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
          <div style={{ opacity: 0.7, letterSpacing: 3, fontSize: 12 }}>WINTER RANGE COMMAND</div>
        </div>

        <button data-menu="depot" style={option({ borderColor: "#6a8a9a" })} onClick={onDepot}>
          <div style={{ color: "#9fd4e4", fontSize: 15, letterSpacing: 2 }}>▶ COLDSNAP DEPOT</div>
          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>Hold the line through wind and scatter. Read the flags — nothing here shoots straight for free.</div>
        </button>

        <button data-menu="towerdef" style={option({ borderColor: "#4e7a5a" })} onClick={onTowerDef}>
          <div style={{ color: "#8fd4a0", fontSize: 15, letterSpacing: 2 }}>▶ HOLD THE DEPOT</div>
          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>Tower defense on the snowfield. Wall the passes — the ponds won't hold a foundation.</div>
        </button>

        <button data-menu="campaign" style={option({ borderColor: "#c9a04e" })} onClick={onCampaign}>
          <div style={{ color: COLORS.gold, fontSize: 15, letterSpacing: 2 }}>▶ CLEARANCE CAMPAIGN</div>
          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>Eight work orders. The territory is being re-let.</div>
        </button>

        <button data-menu="contracts" style={option({ borderColor: "#8a5a1c" })} onClick={onSandbox}>
          <div style={{ color: COLORS.gold, fontSize: 15, letterSpacing: 2 }}>▶ CONTRACT SANDBOX</div>
          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>Seven work orders from the bureau. The clock is part of the record.</div>
          {starRow(csMedals, "commendations on file")}
        </button>

        <button data-menu="demo" style={option({ borderColor: COLORS.borderHot })} onClick={onPlay}>
          <div style={{ color: COLORS.red, fontSize: 15, letterSpacing: 2 }}>▶ PROVING GROUNDS</div>
          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>The original demo — seven field trials across the winter range.</div>
          {starRow(medals, "best times on record")}
        </button>

        <button data-menu="mech" style={option({ borderColor: "#5f6e80" })} onClick={onMech}>
          <div style={{ color: "#9fb4cc", fontSize: 15, letterSpacing: 2 }}>▶ MECH TEST RANGE</div>
          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>Biped frame MK1 on the flat pad. Gait acceptance pending — it stands, it steps, it falls.</div>
        </button>

        <button data-menu="controls" style={option()} onClick={onControls}>
          <div style={{ color: COLORS.bright, fontSize: 15, letterSpacing: 2 }}>⌨ CONTROLS</div>
          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>Remap the keyboard bindings{isTouch ? " (hardware keyboards)" : ""}.</div>
        </button>

        <div style={{ textAlign: "center", marginTop: 18, fontSize: 11, opacity: 0.55 }}>
          {isTouch ? "left stick drives · right stick or tap aims · ⏏ MENU returns here" : "ESC in-game returns to this menu"}
        </div>
      </div>
    </div>
  );
}
