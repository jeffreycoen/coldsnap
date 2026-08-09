import React, { useEffect, useRef, useState } from "react";
import ColdsnapProvingGrounds from "../demo/coldsnap-proving-grounds.jsx";
import ColdsnapContractSandbox from "../game/ContractSandbox.jsx";
import StartScreen from "./StartScreen.jsx";
import CampaignScreen from "./CampaignScreen.jsx";
import CampaignRunner from "../game/CampaignRunner.jsx";
import MechRange from "../game/MechRange.jsx";
import ColdsnapTD from "../game/ColdsnapTD.jsx";
import { CAMPAIGN, loadProgress, saveProgress, loadRecord, recordOutcome, resetCampaign } from "../game/campaign.js";
import Controls from "./Controls.jsx";
import { DEFAULTS, loadKeymap, saveKeymap, installKeyRemap } from "../platform/keymap.js";
import { attachExternalAutosave } from "../platform/autosave.js";
import { COLORS, FONT } from "./theme.js";

const GAME_SCREENS = new Set(["demo", "sandbox", "mission"]); // remap + ESC live here
const RESUME_SCREENS = new Set(["demo", "sandbox", "campaign"]); // what a reload returns to (a mission resumes to the order book)

export default function App() {
  const [screen, setScreen] = useState("menu"); // menu | controls | demo | sandbox | campaign | mission
  const [mission, setMission] = useState(null);
  const [campProgress, setCampProgress] = useState(0);
  const [campRecord, setCampRecord] = useState({});
  const [keymap, setKeymap] = useState(DEFAULTS);
  const mapRef = useRef(DEFAULTS);
  const remapRef = useRef(null);
  const dirtyRef = useRef(false); // a user rebind outranks the async load
  const screenLoadedRef = useRef(false); // don't persist "menu" before the resume load lands

  // resume where the player left off (menu is the default; controls never resumes)
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const r = await window.storage.get("coldsnap-screen");
        if (live && RESUME_SCREENS.has(r.value)) setScreen(r.value);
      } catch (e) {}
      screenLoadedRef.current = true;
    })();
    return () => { live = false; };
  }, []);

  useEffect(() => {
    if (!screenLoadedRef.current) return;
    const persist = screen === "mission" ? "campaign" : screen;
    try { window.storage.set("coldsnap-screen", RESUME_SCREENS.has(persist) ? persist : "menu"); } catch (e) {}
  }, [screen]);

  // the frozen demo autosaves settings/tally from outside via its debug api;
  // the sandbox persists the same keys natively
  useEffect(() => {
    if (screen !== "demo") return;
    return attachExternalAutosave("coldsnap-tally");
  }, [screen]);

  useEffect(() => {
    let live = true;
    loadKeymap().then((m) => { if (live && !dirtyRef.current) { mapRef.current = m; setKeymap(m); } });
    const remap = installKeyRemap(() => mapRef.current);
    remap.setSuspended(true); // active only while the demo is up
    remapRef.current = remap;
    return () => { live = false; remap.uninstall(); };
  }, []);

  useEffect(() => {
    if (remapRef.current) remapRef.current.setSuspended(!GAME_SCREENS.has(screen));
  }, [screen]);

  // ESC leaves a game for the menu. Registered in bubble phase so the
  // remapper (capture) runs first — Escape is unbindable, so it always lands.
  useEffect(() => {
    if (!GAME_SCREENS.has(screen) && screen !== "campaign" && screen !== "mechrange" && screen !== "towerdef") return; // the order book and the mech range exit on ESC too (range stays out of GAME_SCREENS: it reads raw key codes, no remap)
    const onEsc = (e) => { if (e.key === "Escape") setScreen(screen === "mission" ? "campaign" : "menu"); };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [screen]);

  const applyKeymap = (m) => { dirtyRef.current = true; mapRef.current = m; setKeymap(m); saveKeymap(m); };

  useEffect(() => {
    let live = true;
    loadProgress().then((n) => { if (live) setCampProgress(n); });
    loadRecord().then((r) => { if (live) setCampRecord(r); });
    return () => { live = false; };
  }, []);

  const onMissionComplete = ({ outcome, elapsed, collateral }) => {
    if (!mission) return;
    const idx = CAMPAIGN.findIndex((c) => c.id === mission.id);
    if (outcome === "fulfilled" || outcome === "deviated") {
      setCampRecord((r) => ({ ...recordOutcome({ ...r }, mission.id, outcome, elapsed, collateral || 0) }));
    }
    setCampProgress((p) => { const n = Math.max(p, idx + 1); saveProgress(n); return n; });
  };

  if (screen === "campaign" || (screen === "mission" && !mission)) {
    return <CampaignScreen progress={campProgress} record={campRecord}
      onPlay={(m) => { setMission(m); setScreen("mission"); }}
      onReset={() => { resetCampaign(); setCampProgress(0); setCampRecord({}); }}
      onBack={() => setScreen("menu")} />;
  }
  if (screen === "mission") {
    return <CampaignRunner key={mission.id} entry={mission} record={campRecord}
      onExit={() => setScreen("campaign")} onComplete={onMissionComplete} />;
  }
  if (screen === "mechrange") {
    return <MechRange onExit={() => setScreen("menu")} />;
  }
  if (screen === "towerdef") {
    return <ColdsnapTD />;
  }
  if (screen === "controls") {
    return <Controls keymap={keymap} onChange={applyKeymap} onBack={() => setScreen("menu")} />;
  }
  if (GAME_SCREENS.has(screen)) {
    // the sandbox carries its own ⏏ in the order bar; the frozen demo can't,
    // so it keeps the overlay button
    if (screen === "sandbox") return <ColdsnapContractSandbox onExit={() => setScreen("menu")} />;
    return (
      <div style={{ position: "relative", width: "100%", height: "100%" }}>
        <ColdsnapProvingGrounds />
        <button
          data-menu="exit"
          onClick={() => setScreen("menu")}
          style={{ position: "absolute", top: 118, left: 10, zIndex: 7, background: "rgba(28,33,41,0.85)", border: `2px solid ${COLORS.btnBorder}`, color: COLORS.bright, fontFamily: FONT, fontSize: 11, letterSpacing: 1, padding: "5px 9px", cursor: "pointer", touchAction: "manipulation" }}
        >⏏ MENU</button>
      </div>
    );
  }
  return <StartScreen onPlay={() => setScreen("demo")} onSandbox={() => setScreen("sandbox")} onCampaign={() => setScreen("campaign")} onControls={() => setScreen("controls")} onMech={() => setScreen("mechrange")} onTowerDef={() => setScreen("towerdef")} />;
}
