import "./platform/storage.js";
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./ui/App.jsx";
import SoundBoard from "./ui/SoundBoard.jsx";

// ?sounds=1 mounts the SOUNDBOARD instead of the game (mk0.57): a bench for
// auditioning every voice in src/platform/audio.js by tapping a button, rather
// than waiting for the right thing to happen on the field. Resolved once, the
// same way DepotGame reads ?seed and ?perf — with no flag in the URL the game
// path is byte-for-byte what it was.
const sounds = new URLSearchParams(window.location.search).get("sounds") === "1";

createRoot(document.getElementById("root")).render(sounds ? <SoundBoard /> : <App />);
