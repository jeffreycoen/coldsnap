import React, { useEffect, useRef, useState } from "react";
import ColdsnapProvingGrounds from "../demo/coldsnap-proving-grounds.jsx";
import ColdsnapContractSandbox from "../game/ContractSandbox.jsx";
import StartScreen from "./StartScreen.jsx";
import Controls from "./Controls.jsx";
import { DEFAULTS, loadKeymap, saveKeymap, installKeyRemap } from "../platform/keymap.js";
import { COLORS, FONT } from "./theme.js";

const GAME_SCREENS = new Set(["demo", "sandbox"]);

export default function App() {
  const [screen, setScreen] = useState("menu"); // menu | controls | demo | sandbox
  const [keymap, setKeymap] = useState(DEFAULTS);
  const mapRef = useRef(DEFAULTS);
  const remapRef = useRef(null);
  const dirtyRef = useRef(false); // a user rebind outranks the async load

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
    if (!GAME_SCREENS.has(screen)) return;
    const onEsc = (e) => { if (e.key === "Escape") setScreen("menu"); };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [screen]);

  const applyKeymap = (m) => { dirtyRef.current = true; mapRef.current = m; setKeymap(m); saveKeymap(m); };

  if (screen === "controls") {
    return <Controls keymap={keymap} onChange={applyKeymap} onBack={() => setScreen("menu")} />;
  }
  if (GAME_SCREENS.has(screen)) {
    const Game = screen === "sandbox" ? ColdsnapContractSandbox : ColdsnapProvingGrounds;
    return (
      <div style={{ position: "relative", width: "100%", height: "100%" }}>
        <Game />
        <button
          data-menu="exit"
          onClick={() => setScreen("menu")}
          style={{ position: "absolute", top: 118, left: 10, zIndex: 7, background: "rgba(28,33,41,0.85)", border: `2px solid ${COLORS.btnBorder}`, color: COLORS.bright, fontFamily: FONT, fontSize: 11, letterSpacing: 1, padding: "5px 9px", cursor: "pointer", touchAction: "manipulation" }}
        >⏏ MENU</button>
      </div>
    );
  }
  return <StartScreen onPlay={() => setScreen("demo")} onSandbox={() => setScreen("sandbox")} onControls={() => setScreen("controls")} />;
}
