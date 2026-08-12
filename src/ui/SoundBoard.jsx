// THE SOUNDBOARD (mk0.57) — an audition bench for the game's sounds, reached
// by opening the page with ?sounds=1. It mounts INSTEAD of the game: no world,
// no physics, no renderer, just src/platform/audio.js.
//
// The one rule this file lives by: it NEVER makes a sound of its own. Every
// card hands hand-built EVENTS to the real consume() — the same shapes
// src/engine/core.js pushes when a gun fires and the same bare {type} cues
// DepotGame's bell cycle pushes — so what Jeff hears here is exactly what the
// game plays, coalescer, arrival delay, echo taps and all. If a card ever
// synthesised its own approximation the page would be worthless.
import React, { useEffect, useRef, useState } from "react";
import { COLORS, FONT } from "./theme.js";
import { makeGameAudio } from "../platform/audio.js";
import { MK } from "../version.js";

// WINTER FRONT sets its listener range to 46 / zoom every frame (DepotGame
// ~line 2140); at the default zoom of 1 that is 46 metres. Matching it matters
// for more than loudness: the sniper's echo ring scales on dist/listener.range.
const RANGE = 46;
// "beside you" and "across the map": ~4 m and ~0.9 * range, both off-axis so
// the stereo pan is doing something.
const NEAR = { x: 3, z: -2.6 };    // 3.97 m
const FAR = { x: 12, z: -39.62 };  // 41.4 m — arrives ~121 ms late, by design
// Echo taps need reflectors, or echoes() returns immediately and the sniper
// has nothing to answer it. Three stand-in rock ridges, placed so all three
// clear the 45 ms tap floor from BOTH source points: from FAR they land at
// ~64/80/147 ms — the rolling answer — and from NEAR much later and far
// quieter, which is how a shot at your feet behaves in the game too.
const REFLECTORS = [
  { x: 30, z: -6, r: 8 },
  { x: -14, z: -34, r: 10 },
  { x: 24, z: -62, r: 9 },
];

// A muzzle event exactly as fireProjectile() writes it: kind is what the ROUND
// is, weapon is WHICH GUN fired. consume() reads type/x/z/weapon/kind.
const muzzle = (weapon, kind, at) => ({ type: "muzzle", x: at.x, y: 1, z: at.z, dx: 0, dy: 0, dz: -1, kind, weapon });
// n identical muzzles delivered in ONE drain — which is precisely how a burst
// or a volley reaches the engine. The real coalescer groups them (one key per
// weapon), hands the voice mass = sqrt(n), and WEAPON.mg undoes the sqrt to
// lay six rounds back out at machine-gun cadence. Nothing here shortcuts that.
const burst = (weapon, kind, n, at) => Array.from({ length: n }, () => muzzle(weapon, kind, at));

const CARDS = [
  { id: "bell", name: "MUSTER BELL", desc: "One single deep BONGGG: a big bronze bell struck once, ringing dark and long, about five seconds. Not two strikes. Not bright.", ev: () => [{ type: "bell" }] },
  { id: "pretoll", name: "PRE-TOLL", desc: "A whisper-quiet tick of the same bell — the rope taking up slack before the strike. Blink and you miss it.", ev: () => [{ type: "pretoll" }] },
  { id: "sniper-near", name: "SNIPER, NEAR", desc: "A dry whipcrack right beside you. Sharp, short, almost no tail.", ev: () => [muzzle("sniper", "mg", NEAR)] },
  { id: "sniper-far", name: "SNIPER, FAR", desc: "The same rifle from across the map. Arrives a beat late, duller and quieter up front — but the map answers it: a rolling echo that outlasts the shot itself.", ev: () => [muzzle("sniper", "mg", FAR)] },
  { id: "rifle", name: "RIFLE", desc: "A light snap, clearly higher-pitched than the sniper. The two should never blur.", ev: () => [muzzle("rifle", "mg", NEAR)] },
  { id: "rifle-volley", name: "RIFLE VOLLEY", desc: "Several rifles in the same instant — one denser, thicker snap. Still light, still high.", ev: () => burst("rifle", "mg", 4, NEAR) },
  { id: "mg", name: "MG BURST", desc: "Ratatata: six rapid, distinct taps at machine-gun pace. A burst you could count, not one fat bang.", ev: () => burst("mg", "mg", 6, NEAR) },
  { id: "mortar", name: "MORTAR", desc: "A hollow, deep THOOMP — a tube, not a gun.", ev: () => [muzzle("mortar", "shell", NEAR)] },
  { id: "rocket", name: "ROCKET", desc: "A whooshing roar as the salvo leaves the rail.", ev: () => [muzzle("rocket", "shell", NEAR)] },
  { id: "tank", name: "TANK / SHELL", desc: "A heavy, flat BANG with real chest to it. The biggest single gun on the field.", ev: () => [muzzle("tank", "shell", NEAR)] },
];

const WIND = {
  id: "wind",
  desc: "Slow breathing gusts that swell and fade over seconds. Known problem: today it reads as steady static — this card exists so you can compare retunes against it.",
};

// tick(world, dt) walks world.bodies twice unguarded and reaches for
// projectiles/contacts/mechs behind guards — so the smallest world that
// satisfies it is a handful of empty lists. The wind bed itself needs nothing
// from the world at all; it is driven by dt.
const STUB_WORLD = { t: 0, bodies: [], projectiles: [], contacts: [], mechs: [] };

export default function SoundBoard() {
  const audioRef = useRef(null);
  const rafRef = useRef(0);
  const [wind, setWind] = useState(false);
  const [last, setLast] = useState(null);

  if (!audioRef.current) {
    const A = makeGameAudio();
    A.setListener(0, 0, RANGE);
    A.setReflectors(REFLECTORS);
    audioRef.current = A;
  }

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    try { audioRef.current.dispose(); } catch (e) {}
  }, []);

  // Browsers only allow the context to start inside a gesture, so ensure() is
  // called on every tap — it is idempotent and also resumes a suspended
  // context (iOS suspends on the way back from a lock screen).
  const fire = (card) => {
    const A = audioRef.current;
    A.ensure();
    A.consume(card.ev());
    setLast(card.id);
  };

  const toggleWind = () => {
    const A = audioRef.current;
    A.ensure();
    setLast(WIND.id);
    if (wind) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      // tick() re-asserts the wind loop every call, so it can never decay
      // itself away; stopAll (behind setMuted) is the engine's own way to end
      // a continuous voice. Flicked straight back off so cards still sound.
      A.setMuted(true);
      A.setMuted(false);
      setWind(false);
      return;
    }
    setWind(true);
    let prev = performance.now();
    const step = (now) => {
      const dt = Math.min(0.1, (now - prev) / 1000);
      prev = now;
      STUB_WORLD.t += dt;
      A.tick(STUB_WORLD, dt);
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  };

  const cardStyle = (hot) => ({
    display: "block",
    width: "100%",
    textAlign: "left",
    background: hot ? "rgba(56,72,86,0.9)" : COLORS.btnBg,
    border: `2px solid ${hot ? "#9fd4e4" : COLORS.btnBorder}`,
    color: COLORS.text,
    fontFamily: FONT,
    padding: "16px 16px",
    marginTop: 12,
    cursor: "pointer",
    touchAction: "manipulation",
    WebkitTapHighlightColor: "transparent",
  });

  return (
    <div data-soundboard style={{ position: "fixed", inset: 0, overflow: "auto", background: COLORS.bg, color: COLORS.text, fontFamily: FONT, userSelect: "none", WebkitUserSelect: "none" }}>
      <div style={{ width: "min(460px, 94vw)", margin: "0 auto", padding: "22px 0 40px" }}>
        <div style={{ textAlign: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 24, color: COLORS.red, letterSpacing: 6 }}>SOUNDBOARD</div>
          <div data-mk style={{ opacity: 0.5, letterSpacing: 2, fontSize: 10, marginTop: 4 }}>{MK}</div>
          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 8, letterSpacing: 1 }}>Tap any card. Wearing headphones is best.</div>
        </div>

        {CARDS.map((c) => (
          <button key={c.id} data-sound={c.id} style={cardStyle(last === c.id)} onClick={() => fire(c)}>
            <div style={{ color: COLORS.bright, fontSize: 15, letterSpacing: 2 }}>{c.name}</div>
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 6, lineHeight: 1.45 }}>{c.desc}</div>
          </button>
        ))}

        <button data-sound={WIND.id} style={cardStyle(wind)} onClick={toggleWind}>
          <div style={{ color: wind ? "#9fd4e4" : COLORS.bright, fontSize: 15, letterSpacing: 2 }}>WIND: {wind ? "ON" : "OFF"}</div>
          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 6, lineHeight: 1.45 }}>{WIND.desc}</div>
        </button>

        <div style={{ textAlign: "center", marginTop: 18, fontSize: 11, opacity: 0.5, lineHeight: 1.5 }}>
          Every sound here is played by the game's own voices — nothing on this page is a re-creation.
          <br />Drop the ?sounds=1 from the address to go back to the game.
        </div>
      </div>
    </div>
  );
}
