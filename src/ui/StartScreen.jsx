import React, { useEffect, useRef, useState } from "react";
import { COLORS, FONT, btn, detectTouch } from "./theme.js";
import { MK } from "../version.js";
import { probeFront, burnFront } from "../depot/save.js";
import { makeMap, MAP_SEED, TOWN, ROCKS, PONDS, ROADS, HILLS, STREAM, fwdU } from "../depot/mapgen.js";
import { MASON } from "../depot/specs.js";

// THE FRONT DOOR (P6 T7, mk1.14). The site opens on WINTER FRONT — one
// identity, one dominant action, three true laws — and the tech demos this
// war was built on live one quiet link away (DemosScreen).
// THE MENU MAP (Task 7, mk2.45): the valley about to be played, drawn flat
// from the same generator the war uses. makeMap bumps a fouled seed, so the
// number returned — and shown, and handed on — is ALWAYS the installed
// MAP_SEED, never the request. Muted tones plus a final dim so the buttons
// carry; the owner's live look is the acceptance.
const drawMap = (cv, seed) => {
  makeMap(seed);
  const dpr = window.devicePixelRatio || 1;
  const w = cv.clientWidth * dpr, h = cv.clientHeight * dpr;
  cv.width = w; cv.height = h;
  const g = cv.getContext("2d");
  const sc = Math.min(w, h) / 195;
  const X = (x) => w / 2 + x * sc, Z = (z) => h / 2 + z * sc;
  g.fillStyle = "#12161c"; g.fillRect(0, 0, w, h);
  g.fillStyle = "#161c23"; g.fillRect(X(-90), Z(-90), 180 * sc, 180 * sc);
  for (const k of HILLS) { const p = fwdU(k.u, k.v); g.fillStyle = "rgba(38,46,55,0.8)"; g.beginPath(); g.arc(X(p.x), Z(p.z), k.r * sc, 0, 7); g.fill(); }
  for (const k of PONDS) { g.fillStyle = "#1c2a38"; g.beginPath(); g.arc(X(k.x), Z(k.z), k.r * sc, 0, 7); g.fill(); }
  g.strokeStyle = "#242b33"; g.lineWidth = Math.max(1, 2.2 * sc);
  for (const route of ROADS) { g.beginPath(); route.forEach(([x, z], i) => (i ? g.lineTo(X(x), Z(z)) : g.moveTo(X(x), Z(z)))); g.stroke(); }
  if (STREAM) {
    g.strokeStyle = "#1c3040"; g.lineWidth = (STREAM.w + 1) * sc; g.beginPath();
    STREAM.pts.forEach((p, i) => { const wp = fwdU(p.u, p.v); i ? g.lineTo(X(wp.x), Z(wp.z)) : g.moveTo(X(wp.x), Z(wp.z)); });
    g.stroke();
  }
  for (const k of ROCKS) { g.fillStyle = "#2b323b"; g.beginPath(); g.arc(X(k.x), Z(k.z), k.r * sc, 0, 7); g.fill(); }
  for (const t of TOWN) {
    const hx = (t.nx * MASON.pitch) / 2, hz = (t.nz * MASON.pitch) / 2;
    g.fillStyle = t.depot ? (t.team === 2 ? "#43333a" : "#33413a") : "#343b45";
    g.fillRect(X(t.x - hx), Z(t.z - hz), hx * 2 * sc, hz * 2 * sc);
    if (t.depot) {
      g.strokeStyle = t.team === 2 ? "#7a3a3a" : "#3a6a4a";
      g.lineWidth = Math.max(1, 1.5 * sc);
      g.strokeRect(X(t.x - hx), Z(t.z - hz), hx * 2 * sc, hz * 2 * sc);
    }
  }
  g.fillStyle = "rgba(14,16,20,0.52)"; g.fillRect(0, 0, w, h); // the dim — the buttons carry
  return MAP_SEED;
};

export default function StartScreen({ onDepot, onDepotResume, onDemos, onDevSandbox, onControls }) {
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

  // THE MENU MAP's state: the canvas, the rolled seed (installed value),
  // and the FIELD ORDER # on display. Resume shows the SAVE's map; arming
  // the burn previews the fresh valley; disarming restores the save's.
  const mapCvRef = useRef(null);
  const newSeedRef = useRef(null);
  const [ord, setOrd] = useState(null);
  const paint = (s) => {
    const cv = mapCvRef.current;
    if (cv == null || s == null) return null;
    const inst = drawMap(cv, s);
    setOrd(inst);
    return inst;
  };
  useEffect(() => {
    const url = parseInt(new URLSearchParams(window.location.search).get("seed"), 10);
    const s = Number.isFinite(url) ? url : Math.floor(Date.now() % 1000000);
    const inst = paint(s);
    newSeedRef.current = inst != null ? inst : s;
  }, []);
  useEffect(() => { if (front && front.has && !burnArmed) paint(front.data.map.seed); }, [front]);
  useEffect(() => {
    if (burnArmed) paint(newSeedRef.current);
    else if (front && front.has) paint(front.data.map.seed);
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
    if (!hasFront) { onDepot(newSeedRef.current); return; }
    if (!burnArmed) { setBurnArmed(true); return; }
    setBurnArmed(false);
    burnFront();
    setFront({ has: false });
    onDepot(newSeedRef.current);
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
      <canvas ref={mapCvRef} data-menu-map style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
      <div style={{ width: "min(420px, 92vw)", padding: "24px 0", margin: "auto", position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <div style={{ fontSize: 34, color: COLORS.red, letterSpacing: 8 }}>COLDSNAP</div>
          <div style={{ fontSize: 13, letterSpacing: 8, color: COLORS.gold, marginTop: 2 }}>WINTER FRONT</div>
          <div data-mk style={{ opacity: 0.5, letterSpacing: 2, fontSize: 10, marginTop: 4 }}>{MK}</div>
          <div data-field-order style={{ fontSize: 10, opacity: 0.6, letterSpacing: 2, marginTop: 6 }}>FIELD ORDER #{ord ?? "—"}</div>
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

        <button data-menu="controls" style={{ ...option(), marginTop: 8, opacity: 0.7, fontSize: 12 }} onClick={onControls}>
          CONTROLS — keys and remapping →
        </button>

        <button data-menu="devsandbox" style={{ ...option(), marginTop: 8, opacity: 0.7, fontSize: 12 }} onClick={onDevSandbox}>
          SANDBOX — test any weapon on a fresh valley →
        </button>

        <div style={{ textAlign: "center", marginTop: 18, fontSize: 11, opacity: 0.55 }}>
          {isTouch ? "left stick drives · right stick or tap aims · ⏏ MENU returns here" : "ESC in-game returns to this menu"}
        </div>
      </div>
    </div>
  );
}
