import "./platform/storage.js";
import React from "react";
import { createRoot } from "react-dom/client";
import ColdsnapProvingGrounds from "./demo/coldsnap-proving-grounds.jsx";

// The original proving-grounds demo mounts directly for now; it becomes one
// of the selectable options on the start screen once the contract-sandbox
// game exists alongside it.
createRoot(document.getElementById("root")).render(<ColdsnapProvingGrounds />);
