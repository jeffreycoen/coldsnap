// game/ContractSandbox.jsx — the contract-sandbox game. Started as a VERBATIM
// extraction of the frozen demo component (src/demo/coldsnap-proving-grounds.jsx
// lines 2763-3582) over the extracted engine/renderer modules, then given the
// buildout plan's Phase 1 voice pass: bureau work-order fiction over the same
// trials — text only, zero mechanics change. Saves live under coldsnap-cs-*
// keys so sandbox progress never touches the demo's records.
import React, { useEffect, useRef, useState } from "react";
import {
  CAUSE, POOL, STATIONS, addBody, thawPool, freezePool, stepWorld,
  snapAim, recoverBison, fireVolley, bisonFire, bisonMg, worldHash, makeAch, heading,
} from "../engine/core.js";
import { buildScenario } from "./scenario.js";
import PROVING_SPEC from "./scenarios/proving-grounds.json";
import { disperseState } from "./altcheck.js";
import { matchKill, CONTRACT_PREDICATES } from "./predicate.js";
import { makeRenderer } from "../render/renderer.js";
import { CONTRACTS } from "./contracts.js";
import { composeAAR } from "../aar/compose.js";
import { loadSettings, saveSettings, loadTally, sanitizeGfx } from "../platform/autosave.js";

// ================================================================= component
const PHYS_CAUSES = new Set([CAUSE.CRUSH, CAUSE.TOSS, CAUSE.COLLAPSE, CAUSE.FLIP, CAUSE.DROWN]);
function detectTouch() {
  if (typeof window === "undefined") return false;
  try { if (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) return true; } catch (e) {}
  const fine = (() => { try { return window.matchMedia && window.matchMedia("(pointer: fine)").matches; } catch (e) { return false; } })();
  return (navigator.maxTouchPoints || 0) > 0 && !fine;
}
const LABEL_COLORS = { PROJECTILE: "#ffb45e", BLAST: "#ff6b5e", CRUSH: "#ffd27a", TOSS: "#c9f06c", COLLAPSE: "#e0e6ee", FLIP: "#b48cff", DROWN: "#7fd7ff", IMPACT: "#ff9e9e" };
function makeAudio() {
  let ctx = null, muted = true;
  const ensure = () => {
    try {
      if (!ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) ctx = new AC(); }
      if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
    } catch (e) {}
  };
  const blip = (f0, f1, dur, type, gain) => {
    if (muted || !ctx) return;
    try {
      const t = ctx.currentTime;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
      g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + dur);
    } catch (e) {}
  };
  const thud = (dur, gain, fc) => {
    if (muted || !ctx) return;
    try {
      const t = ctx.currentTime, n = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      const src = ctx.createBufferSource(); src.buffer = buf;
      const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = fc;
      const g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f).connect(g).connect(ctx.destination); src.start(t);
    } catch (e) {}
  };
  return {
    ensure,
    setMuted(m) { muted = m; }, get muted() { return muted; },
    fire() { blip(150, 55, 0.12, "square", 0.22); thud(0.09, 0.18, 900); },
    boom() { thud(0.32, 0.42, 320); blip(85, 28, 0.28, "sine", 0.32); },
    splash() { thud(0.22, 0.26, 1500); blip(560, 190, 0.16, "sine", 0.12); },
    kill() { blip(760, 1180, 0.06, "square", 0.09); },
    crack() { blip(1500, 300, 0.05, "square", 0.1); thud(0.05, 0.12, 2500); },
    trial() { blip(523, 784, 0.14, "square", 0.16); setTimeout(() => blip(784, 1046, 0.2, "square", 0.16), 130); },
    hook() { blip(200, 900, 0.4, "sawtooth", 0.14); },
  };
}
const TRIALS = [
  { id: "gunnery", title: "GUNNERY", need: 3, par: [10, 18], hint: "Reticle on them — hold FIRE", subjects: "gunnery", focus: () => ({ x: STATIONS.gunnery.x, z: STATIONS.gunnery.z, r: 5 }), setup: (w) => w.pg.respawnSquad("gunnery"), match: (e) => matchKill(CONTRACT_PREDICATES.gunnery, e) },
  { id: "roadkill", title: "ROADKILL", need: 2, par: [9, 16], hint: "Drive through the line with the stick", subjects: "roadlane", focus: () => ({ x: STATIONS.roadlane.x, z: STATIONS.roadlane.z, r: 7 }), setup: (w) => w.pg.respawnSquad("roadlane"), match: (e) => matchKill(CONTRACT_PREDICATES.roadkill, e) },
  { id: "saturation", title: "SATURATION FIRE", need: 3, par: [10, 20], hint: "ONE volley, 3 kills — aim, press VOLLEY", subjects: "gunnery", focus: () => ({ x: STATIONS.gunnery.x, z: STATIONS.gunnery.z, r: 5 }), setup: (w) => w.pg.respawnSquad("gunnery"), volley: true },
  { id: "demolition", title: "DEMOLITION MAN", need: 1, par: [12, 22], hint: "Breach the keep — bury the garrison inside", subjects: "demo", focus: () => ({ x: STATIONS.garrison.x, z: STATIONS.garrison.z, r: 5 }), setup: (w) => { w.pg.repairGarrison(); w.pg.respawnSquad("demo"); }, match: (e) => matchKill(CONTRACT_PREDICATES.demolition, e) },
  { id: "deep_end", title: "THE DEEP END", need: 1, par: [15, 28], hint: "Plow them into the pool — ease off, brake at the lip", subjects: "poolside", focus: () => ({ x: STATIONS.poolside.x, z: STATIONS.poolside.z, r: 5 }), setup: (w) => { thawPool(w); w.pg.respawnSquad("poolside"); }, match: (e) => matchKill(CONTRACT_PREDICATES.deep_end, e) },
  { id: "counter_battery", title: "COUNTER-BATTERY", need: 3, par: [16, 30], hint: "Mortars on the ridge — they shoot back. Silence all three.", subjects: "pit", focus: () => ({ x: STATIONS.pit.x, z: STATIONS.pit.z, r: 6 }), setup: (w) => w.pg.respawnSquad("pit"), match: (e) => matchKill(CONTRACT_PREDICATES.counter_battery, e) },
  { id: "thin_ice", title: "THIN ICE", need: 3, par: [12, 24], hint: "The pond is frozen and the drill squad is on it. Clear them off — any way that works.", subjects: "ponddrill", focus: () => ({ x: 0, z: 28, r: 7 }), setup: (w) => {
    for (let i = w.bodies.length - 1; i >= 0; i--) if (w.bodies[i].group === "ponddrill") { w.byId.delete(w.bodies[i].id); w.bodies.splice(i, 1); }
    freezePool(w);
    for (let i = 0; i < 6; i++) {
      const x = -3 + (i % 3) * 3, z = 25 + Math.floor(i / 3) * 5;
      addBody(w, { kind: "unit", team: 2, group: "ponddrill", mass: 82, hx: 0.26, hy: 0.86, hz: 0.26, x, z, y: 1.132 + 0.88, hp: 30, friction: 0.55 });
    }
    // any-kill experiment (was DROWN-only precision-by-design): every drown
  // still counts as before, plus any player-attributed kill — dead is dead.
  }, match: (e) => matchKill(CONTRACT_PREDICATES.thin_ice, e), alt: { group: "ponddrill", holdS: 4 } }, // any-kill: shards, drowning, blast — the hint promises "any way that works", and the drill squad is provably inert unprovoked. alt: the silent no-kill completion the bureau didn't ask for.
];
// Phase 1 voice pass: overlay the bureau work-order fiction onto the trials.
// Text only — ids, predicates, pars and setups are untouched.
for (const t of TRIALS) {
  const c = CONTRACTS[t.id];
  if (c) { t.title = `${c.wo} · ${c.title}`; t.hint = c.directive; }
}
export default function ColdsnapContractSandbox({ onExit }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const stateRef = useRef(null);
  const [hud, setHud] = useState({ fps: 0, bodies: 0, tally: {}, feed: [], achUnlocked: [], toasts: [], total: 0, cds: { fire: 0, volley: 0 }, flipped: false, iceOn: false, medals: {}, trial: { idx: 0, prog: 0, flashT: 0, free: false, el: 0 } });
  const [fatal, setFatal] = useState(null);
  const [started, setStarted] = useState(false);
  const [achOpen, setAchOpen] = useState(false);
  const [gfxOpen, setGfxOpen] = useState(false);
  const [isTouch] = useState(detectTouch);
  const [gfxUi, setGfxUi] = useState(() => ({ preset: "retro", scale: 1, outline: 1, dither: 1, palette: 1 })); // 1x everywhere: crisp at phone DPI, retro treatment kept. This state is the REAL default — it overwrites the renderer seed on mount.
  const gfxRef = useRef({ preset: "retro", scale: 1, outline: 1, dither: 1, palette: 1 }); // mirror of gfxUi the game loop can read for autosave
  const joyBaseRef = useRef(null);
  const joyKnobRef = useRef(null);
  const labelLayerRef = useRef(null);
  const briefArmRef = useRef({ brief: null, at: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      document.documentElement.style.height = "100%";
      document.body.style.height = "100%";
      document.body.style.margin = "0";
      document.body.style.overflow = "hidden";
      document.documentElement.style.overscrollBehavior = "none";
      document.body.style.overscrollBehavior = "none";
    } catch (e) {}
    let world, R;
    try {
      // the sandbox runs on the scenario pipeline: same proving grounds,
      // rebuilt from data (hash-parity-gated), with sheltering enabled —
      // panicking infantry runs indoors, which the demo's world never did
      world = buildScenario(PROVING_SPEC, { worldSeed: 1234, shelters: true });
      R = makeRenderer(canvas, world);
      R.setGfx({ scale: gfxUi.scale, outline: gfxUi.outline, dither: gfxUi.dither, palette: gfxUi.palette });
    } catch (err) {
      console.error("COLDSNAP boot failed", err);
      setFatal(String((err && err.message) || err));
      return;
    }
    const S = {
      world, R, keys: {}, ndc: { x: 0, y: 0 }, aim: { x: 0, z: 0 },
      focus: { x: 0, y: 2.2, z: -26 }, acc: 0, last: performance.now(),
      hitstop: 0, tally: {}, feed: [], toasts: [], toastSeq: 1,
      frames: 0, fpsT: 0, fps: 0, hudT: 0, resets: 0, savedCount: -1, running: true,
      cds: { fire: 0, volley: 0, recover: 0, mg: 0 }, zoom: 1,
      isTouch, touch: { joyId: null, jx: 0, jy: 0, drive: { t: 0, s: 0 }, aimId: null, ax: 0, ay: 0, moved: 0, downT: 0, pts: new Map() },
      trial: { idx: 0, prog: 0, flashT: 0, t0: 0, volleyCounts: new Map() },
      medals: {}, labels: [], audio: makeAudio(),
    };
    stateRef.current = S;
    const persistLoad = async () => {
      try {
        const r = await window.storage.get("coldsnap-cs-ach");
        if (r && r.value && S.running) {
          const d = JSON.parse(r.value);
          for (const id of d.unlocked || []) S.world.ach.unlocked.add(id);
          S.world.ach.total = Math.max(S.world.ach.total, d.total || 0);
          S.savedCount = S.world.ach.unlocked.size;
        }
      } catch (e) { S.savedCount = S.world.ach.unlocked.size; }
    };
    persistLoad();
    // tally restores by MERGE so a slow async load never clobbers fresh kills
    (async () => {
      const t = await loadTally("coldsnap-cs-tally");
      if (t && S.running) Object.assign(S.tally, t);
    })();
    const enterTrial = (idx) => {
      S.trial.idx = idx; S.trial.prog = 0; S.trial.volleyCounts = new Map();
      S.trial.t0 = S.world.t;
      const t = TRIALS[idx];
      if (t) { try { t.setup(S.world); } catch (e) {} S.world.trialFocus = t.focus(); }
      else S.world.trialFocus = null;
      // the bureau hands you the document: a brief card presented at each new
      // order (the top bar truncates on phones — this is the readable copy)
      S.brief = t ? { title: t.title, directive: t.hint } : null;
      // fresh kill-event log + ordnance counters for this order's AAR
      S.trialLog = { events: [], ordnance: { shell: 0, mg: 0, volley: 0 } };
      S.trial.altT = 0;
    };
    const MEDAL = (t, el) => (el <= t.par[0] ? "GOLD" : el <= t.par[1] ? "SILVER" : "BRONZE");
    const advanceTrial = (skipped) => {
      S.audio.trial();
      const t = TRIALS[S.trial.idx];
      if (t) {
        let title = "COMMENDATION — " + t.title;
        let desc = TRIALS[S.trial.idx + 1] ? "Next: " + TRIALS[S.trial.idx + 1].title : "FREE PLAY unlocked";
        if (!skipped) {
          const el = Math.max(0.1, S.world.t - S.trial.t0);
          const m = MEDAL(t, el);
          title += ` · ${el.toFixed(1)}s ${m === "GOLD" ? "★GOLD" : m === "SILVER" ? "☆SILVER" : "BRONZE"}`;
          const c = CONTRACTS[t.id];
          if (c) desc = c.commendation + " · " + desc;
          const prev = S.medals[t.id];
          if (!prev || el < prev.time) {
            S.medals[t.id] = { time: +el.toFixed(1), medal: m };
            try { window.storage.set("coldsnap-cs-medals", JSON.stringify(S.medals)); } catch (e) {}
          }
          // the report is composed from the order's real kill-event stream
          try {
            const report = composeAAR({
              contract: c || { wo: "WO-??", title: t.title },
              events: S.trialLog ? S.trialLog.events : [],
              ordnance: S.trialLog ? S.trialLog.ordnance : { shell: 0, mg: 0, volley: 0 },
              t0: S.trial.t0, elapsed: el, medal: m, seed: 1234 + S.trial.idx,
            });
            S.aar = { id: t.id, lines: report, medal: m, outcome: "FULFILLED" };
            window.storage.set("coldsnap-cs-aar-" + t.id, JSON.stringify(report));
          } catch (e) {}
        }
        S.toasts.push({ id: S.toastSeq++, title, desc, t: 4 });
      }
      S.trial.flashT = 1.6;
      enterTrial(S.trial.idx + 1);
      try { window.storage.set("coldsnap-cs-trial", String(S.trial.idx)); } catch (e) {}
    };
    // the silent completion the bureau didn't ask for: subjects cleared off
    // the sheet, all alive. Logged UNFULFILLED — DEVIATION, no commendation.
    const advanceDeviation = (t) => {
      S.audio.trial();
      const el = Math.max(0.1, S.world.t - S.trial.t0);
      const dispersed = S.world.bodies.filter((b) => b.group === t.alt.group && b.alive).length;
      const desc = TRIALS[S.trial.idx + 1] ? "Next: " + TRIALS[S.trial.idx + 1].title : "FREE PLAY unlocked";
      S.medals[t.id] = { time: +el.toFixed(1), medal: null, deviation: true };
      try { window.storage.set("coldsnap-cs-medals", JSON.stringify(S.medals)); } catch (e) {}
      try {
        const report = composeAAR({
          contract: CONTRACTS[t.id] || { wo: "WO-??", title: t.title },
          events: S.trialLog ? S.trialLog.events : [],
          ordnance: S.trialLog ? S.trialLog.ordnance : { shell: 0, mg: 0, volley: 0 },
          t0: S.trial.t0, elapsed: el, medal: null, outcome: "UNFULFILLED — DEVIATION", dispersed, seed: 1234 + S.trial.idx,
        });
        S.aar = { id: t.id, lines: report, medal: null, outcome: "UNFULFILLED — DEVIATION" };
        window.storage.set("coldsnap-cs-aar-" + t.id, JSON.stringify(report));
      } catch (e) {}
      S.toasts.push({ id: S.toastSeq++, title: `DEVIATION NOTED — ${t.title} · ${el.toFixed(1)}s`, desc: `${dispersed} subjects dispersed, none processed · ${desc}`, t: 4 });
      S.trial.flashT = 1.6;
      enterTrial(S.trial.idx + 1);
      try { window.storage.set("coldsnap-cs-trial", String(S.trial.idx)); } catch (e) {}
    };
    const trialLoad = async () => {
      try {
        const rm = await window.storage.get("coldsnap-cs-medals");
        const mm = JSON.parse(rm.value);
        if (mm && typeof mm === "object") S.medals = mm;
      } catch (e) {}
      try {
        const r = await window.storage.get("coldsnap-cs-trial");
        const idx = Math.max(0, Math.min(TRIALS.length, parseInt(r.value, 10) || 0));
        if (S.running) enterTrial(idx);
      } catch (e) { if (S.running) enterTrial(0); }
    };
    trialLoad();
    const onTrialKill = (e) => {
      const t = TRIALS[S.trial.idx];
      if (!t) return;
      if (t.volley) {
        if (!e.volley) return;
        const c = (S.trial.volleyCounts.get(e.volley) || 0) + 1;
        S.trial.volleyCounts.set(e.volley, c);
        S.trial.prog = Math.max(S.trial.prog, c);
        if (c >= t.need) advanceTrial();
      } else if (t.match(e)) {
        S.trial.prog++;
        if (S.trial.prog >= t.need) advanceTrial();
      }
    };
    const persistSave = () => {
      const a = S.world.ach;
      if (a.unlocked.size === S.savedCount) return;
      S.savedCount = a.unlocked.size;
      try { window.storage.set("coldsnap-cs-ach", JSON.stringify({ unlocked: [...a.unlocked], total: a.total })); } catch (e) {}
    };
    // settings + tally autosave: change-gated, and held until the restore
    // pass has landed so defaults can't clobber a saved state
    const stateSave = () => {
      if (!S.settingsReady) return;
      const cur = { settings: { gfx: gfxRef.current, zoom: S.zoom, muted: S.audio.muted }, tally: S.tally };
      const j = JSON.stringify(cur);
      if (j === S._stateJ) return;
      S._stateJ = j;
      saveSettings(cur.settings);
      try { window.storage.set("coldsnap-cs-tally", JSON.stringify(cur.tally)); } catch (e) {}
    };
    const groundPoint = (nx, ny) => {
      const cb = R.camBasis;
      const cp = R._cam.position;
      const o = {
        x: cp.x + cb.right.x * nx * cb.halfW() + cb.up.x * ny * cb.halfH(),
        y: cp.y + cb.right.y * nx * cb.halfW() + cb.up.y * ny * cb.halfH(),
        z: cp.z + cb.right.z * nx * cb.halfW() + cb.up.z * ny * cb.halfH(),
      };
      const d = cb.fwd;
      let t0 = 0, t1 = 380, prev = o.y - S.world.field.heightAt(o.x, o.z), hitT = -1;
      for (let t = 6; t <= 380; t += 6) {
        const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
        const f = y - S.world.field.heightAt(x, z);
        if (prev > 0 && f <= 0) { t0 = t - 6; t1 = t; hitT = t; break; }
        prev = f;
      }
      if (hitT < 0) { const t = (o.y - 2.2) / -d.y; return { x: o.x + d.x * t, z: o.z + d.z * t }; }
      for (let k = 0; k < 18; k++) {
        const m = (t0 + t1) / 2;
        const y = o.y + d.y * m - S.world.field.heightAt(o.x + d.x * m, o.z + d.z * m);
        if (y > 0) t0 = m; else t1 = m;
      }
      return { x: o.x + d.x * t1, z: o.z + d.z * t1 };
    };
    const doReset = () => {
      S.resets++;
      const keep = S.world.ach;
      S.world = buildScenario(PROVING_SPEC, { worldSeed: 1234 + S.resets, shelters: true });
      S.world.ach.unlocked = keep.unlocked; S.world.ach.total = keep.total;
      R.setWorld(S.world);
      S.tally = {}; S.feed = [];
      enterTrial(S.trial.idx);
    };
    const onKill = (e) => {
      if (S.trialLog) S.trialLog.events.push({ ...e });
      S.tally[e.cause] = (S.tally[e.cause] || 0) + 1;
      const who = e.kind === "unit" ? "conscript" : e.kind === "vehicle" ? "scout" : e.kind;
      S.feed.unshift(`${e.cause} — ${who}${e.attacker === "player" ? "" : " (world)"}`);
      if (S.feed.length > 5) S.feed.pop();
      if (PHYS_CAUSES.has(e.cause)) S.hitstop = Math.max(S.hitstop, 0.26);
      S.labels.push({ x: e.x, y: (e.y || 2) + 1.4, z: e.z, text: e.cause, t: 1.15, color: LABEL_COLORS[e.cause] || "#fff" });
      try { if (S.isTouch && navigator.vibrate) navigator.vibrate(PHYS_CAUSES.has(e.cause) ? 18 : 9); } catch (err) {}
      if (S.labels.length > 10) S.labels.shift();
      S.audio.kill();
      if (e.cause === CAUSE.DROWN) S.audio.splash();
      onTrialKill(e);
    };
    const onAch = (e) => { S.toasts.push({ id: S.toastSeq++, title: e.name, desc: e.desc, t: 3.6 }); };
    const actions = {
      // ordnance is counted here at the action layer, not from muzzle events —
      // grenadier mortars also route through fireProjectile and would pollute it
      fireAt: (x, z) => { if (S.cds.fire > 0) return false; S.cds.fire = 0.45; bisonFire(S.world, { x, z }); if (S.trialLog) S.trialLog.ordnance.shell++; return true; },
      volleyAt: (x, z) => { if (S.cds.volley > 0) return false; S.cds.volley = 5; fireVolley(S.world, x, z, 6, "player"); if (S.trialLog) S.trialLog.ordnance.volley++; return true; },
      mgAt: (x, z) => { if (S.cds.mg > 0) return false; S.cds.mg = 0.11; bisonMg(S.world, { x, z }); if (S.trialLog) S.trialLog.ordnance.mg++; return true; },
      squads: () => S.world.pg.respawnSquads(),
      scouts: () => S.world.pg.respawnScouts(),
      repair: () => S.world.pg.repairGarrison(),
      reset: doReset,
    };
    S.actions = actions;
    const onKey = (ev, down) => {
      const k = ev.key.toLowerCase();
      if (["w", "a", "s", "d", " "].includes(k)) ev.preventDefault();
      S.keys[k] = down;
      if (!down) return;
      if (k === "v") actions.volleyAt(S.aim.x, S.aim.z);
      if (k === "1") actions.squads();
      if (k === "2") actions.scouts();
      if (k === "3") actions.repair();
      if (k === "0") actions.reset();
    };
    const kd = (e) => { S.audio.ensure(); if (e.key === "m" || e.key === "M") S.audio.setMuted(!S.audio.muted); if ((e.key === "r" || e.key === "R") && window.__COLDSNAP__) window.__COLDSNAP__.recover(); onKey(e, true); };
    const ku = (e) => onKey(e, false);
    const rect = () => {
      const r = canvas.getBoundingClientRect();
      return r.width > 4 ? r : { left: 0, top: 0, width: 960, height: 600 };
    };
    const toNdc = (cx, cy) => {
      const r = rect();
      return { x: ((cx - r.left) / r.width) * 2 - 1, y: -(((cy - r.top) / r.height) * 2 - 1) };
    };
    const setZoomClamped = (z) => { S.zoom = Math.max(0.7, Math.min(2, z)); R.setZoom(S.zoom); };
    const JOY_R = 56;
    const joyCenter = () => { const r = rect(); return { x: 92, y: r.height - 128 }; };
    const joyPlace = () => {
      const b = joyBaseRef.current, k = joyKnobRef.current;
      if (!b || !k || !S.isTouch) return;
      const c = joyCenter();
      b.style.display = "block"; k.style.display = "block";
      b.style.left = c.x - JOY_R + "px"; b.style.top = c.y - JOY_R + "px";
      if (S.touch.joyId == null) { k.style.left = c.x - 22 + "px"; k.style.top = c.y - 22 + "px"; }
      b.style.opacity = k.style.opacity = S.touch.joyId == null ? "0.55" : "1";
    };
    const joyKnob = (x, y) => { const k = joyKnobRef.current; if (k) { k.style.left = x - 22 + "px"; k.style.top = y - 22 + "px"; } };
    const joyRelease = () => {
      S.touch.drive.t = 0; S.touch.drive.s = 0; S.touch.joyId = null;
      joyPlace();
    };
    const nearJoy = (cx, cy) => {
      const r = rect(), c = joyCenter();
      return Math.hypot(cx - r.left - c.x, cy - r.top - c.y) < 130;
    };
    const pinchDist = () => {
      const pts = [...S.touch.pts.values()];
      if (pts.length < 2) return 0;
      return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    };
    const onPointerDown = (e) => {
      setStarted(true);
      S.audio.ensure();
      if (e.target !== canvas) return;
      if (e.cancelable) e.preventDefault();
      const isT = e.pointerType === "touch" || e.pointerType === "pen";
      if (!isT) {
        S.mouseDown = { x: e.clientX, y: e.clientY };
        return;
      }
      S.touch.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (S.touch.pts.size === 2 && S.touch.joyId == null) { S.touch.pinch0 = pinchDist(); S.touch.zoom0 = S.zoom; S.touch.aimId = null; return; }
      if (nearJoy(e.clientX, e.clientY) && S.touch.joyId == null) {
        S.touch.joyId = e.pointerId;
        joyPlace();
        onPointerMove(e); // apply the grab position immediately
      } else if (S.touch.aimId == null) {
        S.touch.aimId = e.pointerId; S.touch.ax = e.clientX; S.touch.ay = e.clientY;
        S.touch.moved = 0; S.touch.downT = performance.now();
        const n = toNdc(e.clientX, e.clientY);
        S.ndc.x = n.x; S.ndc.y = n.y;
      }
    };
    const onPointerMove = (e) => {
      if (e.pointerType === "mouse") {
        if (e.target === canvas || !S.mouseDown) {
          const n = toNdc(e.clientX, e.clientY);
          S.ndc.x = n.x; S.ndc.y = n.y;
        }
        return;
      }
      if (!S.touch.pts.has(e.pointerId)) return;
      if (e.cancelable) e.preventDefault();
      S.touch.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (S.touch.pts.size >= 2 && S.touch.pinch0 > 0) {
        const d = pinchDist();
        if (d > 0) setZoomClamped(S.touch.zoom0 * (d / S.touch.pinch0));
        return;
      }
      if (e.pointerId === S.touch.joyId) {
        const r = rect(), c = joyCenter();
        let dx = e.clientX - r.left - c.x, dy = e.clientY - r.top - c.y;
        const L = Math.hypot(dx, dy);
        if (L > JOY_R) { dx *= JOY_R / L; dy *= JOY_R / L; }
        joyKnob(c.x + dx, c.y + dy);
        const dz = (v) => (Math.abs(v) < 0.15 ? 0 : (v - Math.sign(v) * 0.15) / 0.85);
        S.touch.drive.t = dz(-dy / JOY_R);
        S.touch.drive.s = dz(dx / JOY_R);
      } else if (e.pointerId === S.touch.aimId) {
        S.touch.moved += Math.hypot(e.clientX - S.touch.ax, e.clientY - S.touch.ay);
        S.touch.ax = e.clientX; S.touch.ay = e.clientY;
        const n = toNdc(e.clientX, e.clientY);
        S.ndc.x = n.x; S.ndc.y = n.y;
      }
    };
    const onPointerUp = (e) => {
      if (e.pointerType === "mouse") {
        if (S.mouseDown && e.target === canvas) {
          const moved = Math.hypot(e.clientX - S.mouseDown.x, e.clientY - S.mouseDown.y);
          if (moved < 8) { const g = groundPoint(...Object.values(toNdc(e.clientX, e.clientY))); actions.fireAt(g.x, g.z); }
        }
        S.mouseDown = null;
        return;
      }
      const had = S.touch.pts.delete(e.pointerId);
      if (S.touch.pts.size < 2) S.touch.pinch0 = 0;
      if (e.pointerId === S.touch.joyId) joyRelease();
      else if (had && e.pointerId === S.touch.aimId) {
        const quick = performance.now() - S.touch.downT < 350;
        if (quick && S.touch.moved < 14) {
          // tap aims; the FIRE button shoots
          const n = toNdc(e.clientX, e.clientY);
          S.ndc.x = n.x; S.ndc.y = n.y;
        }
        S.touch.aimId = null;
      }
    };
    const onCtx = (e) => { if (e.target === canvas) e.preventDefault(); };
    const onWheel = (e) => {
      if (e.target !== canvas) return;
      e.preventDefault();
      setZoomClamped(S.zoom * (e.deltaY > 0 ? 0.85 : 1.18));
    };
    S.zoomBy = (f) => setZoomClamped(S.zoom * f);
    S.joyPlace = joyPlace;
    joyPlace();
    // Pointer-event preventDefault does NOT stop touch scrolling; WebViews need
    // real non-passive touch listeners. Block panning for any gesture on the canvas.
    const wrapEl = wrapRef.current;
    const touchBlock = (e) => { if (e.target === canvas) e.preventDefault(); };
    if (wrapEl) {
      wrapEl.addEventListener("touchstart", touchBlock, { passive: false });
      wrapEl.addEventListener("touchmove", touchBlock, { passive: false });
      wrapEl.addEventListener("touchend", touchBlock, { passive: false });
    }
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    window.addEventListener("contextmenu", onCtx);
    window.addEventListener("wheel", onWheel, { passive: false });
    let raf = 0;
    const loop = () => {
      if (!S.running) return;
      raf = window.requestAnimationFrame(loop);
      const now = performance.now();
      let dt = Math.min(0.05, (now - S.last) / 1000);
      S.last = now;
      S.frames++; S.fpsT += dt;
      if (S.fpsT >= 0.5) { S.fps = Math.round(S.frames / S.fpsT); S.frames = 0; S.fpsT = 0; }
      for (const k of ["fire", "volley", "recover", "mg"]) S.cds[k] = Math.max(0, S.cds[k] - dt);
      let ts = 1;
      if (S.hitstop > 0) { S.hitstop -= dt; ts = 0.12; }
      const w = S.world;
      const bison = w.byId.get(w.bisonId);
      if (S.touch.joyId != null && bison) {
        // twin-stick: the tank goes where you point, camera-relative
        const cb = R.camBasis;
        const ux = cb.fwd.x, uz = cb.fwd.z, ul = Math.hypot(ux, uz) || 1;
        const rx = cb.right.x, rz = cb.right.z, rl = Math.hypot(rx, rz) || 1;
        const wx = (rx / rl) * S.touch.drive.s + (ux / ul) * S.touch.drive.t;
        const wz = (rz / rl) * S.touch.drive.s + (uz / ul) * S.touch.drive.t;
        const mag = Math.min(1, Math.hypot(S.touch.drive.s, S.touch.drive.t));
        if (mag > 0.03) {
          const desired = Math.atan2(wx, wz);
          const bodyYaw = Math.atan2(bison.R[6], bison.R[8]);
          let errY = desired - bodyYaw;
          while (errY > Math.PI) errY -= 2 * Math.PI;
          while (errY < -Math.PI) errY += 2 * Math.PI;
          w.control.steer = Math.max(-1, Math.min(1, errY * 1.8));
          w.control.throttle = mag * Math.max(0, Math.cos(errY));
        } else { w.control.throttle = 0; w.control.steer = 0; }
        w.control.brake = 0;
      } else {
        w.control.throttle = (S.keys["w"] ? 1 : 0) + (S.keys["s"] ? -1 : 0);
        w.control.steer = (S.keys["d"] ? 1 : 0) + (S.keys["a"] ? -1 : 0);
        w.control.brake = S.keys[" "] ? 1 : 0;
      }
      S.aim = groundPoint(S.ndc.x, S.ndc.y);
      w.threat = { x: S.aim.x, z: S.aim.z, t: w.t };
      if (S.fireHeld && S.cds.fire <= 0 && S.actions) {
        const g = S.isTouch ? snapAim(S.world, S.aim.x, S.aim.z, 1.5) : { x: S.aim.x, z: S.aim.z, hit: false };
        S.lastFire = g;
        S.actions.fireAt(g.x, g.z);
      }
      if ((S.mgHeld || S.keys["g"]) && S.cds.mg <= 0 && S.actions) {
        const gm = S.isTouch ? snapAim(S.world, S.aim.x, S.aim.z, 1.5) : { x: S.aim.x, z: S.aim.z, hit: false };
        S.actions.mgAt(gm.x, gm.z);
      }
      S.acc += dt * ts;
      const evs = [];
      let guard = 0;
      const stepCap = S.isTouch ? 5 : 10;
      while (S.acc >= w.dt && guard++ < stepCap) {
        w.events.length = 0;
        stepWorld(w);
        for (const e of w.events) evs.push(e);
        S.acc -= w.dt;
      }
      if (S.acc > w.dt * 3) S.acc = w.dt * 3;
      // deviation watch: a matched kill (prog > 0) voids the silent path for
      // the attempt; the detector VOIDs from its side on any subject death
      {
        const td = TRIALS[S.trial.idx];
        if (td && td.alt && S.trial.prog === 0) {
          const st = disperseState(w.bodies, POOL, td.alt.group);
          S.trial.altT = st === "CLEAR" ? (S.trial.altT || 0) + dt : 0;
          if (S.trial.altT >= td.alt.holdS) advanceDeviation(td);
        }
        // subject restock: a cause-restricted order can exhaust its pool —
        // every subject dead the wrong way (blast-through on the garrison,
        // crushing the poolside detail) leaves the acceptance stranded with
        // nothing left to kill. The bureau reissues the detail instead.
        if (td && td.subjects && S.trial.prog < td.need) {
          let pool = 0;
          for (const b of w.bodies) if (b.kind === "unit" && b.group === td.subjects && b.alive) { pool = 1; break; }
          if (pool) S.trial.poolGoneT = 0;
          else {
            S.trial.poolGoneT = (S.trial.poolGoneT || 0) + dt;
            if (S.trial.poolGoneT >= 2) {
              S.trial.poolGoneT = 0;
              td.setup(w);
              if (S.trialLog) S.trialLog.restocks = (S.trialLog.restocks || 0) + 1;
              S.toasts.push({ id: S.toastSeq++, title: "REPLACEMENT DETAIL ISSUED", desc: "Subject pool exhausted. The order stands.", t: 3.6 });
            }
          }
        }
      }
      const rNow = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : null;
      const hNow = rNow && rNow.height > 4 ? rNow.height : 0;
      if (hNow !== S.lastJoyH) { S.lastJoyH = hNow; if (S.joyPlace) S.joyPlace(); }
      for (const e of evs) {
        if (e.type === "kill") onKill(e);
        else if (e.type === "ach") onAch(e);
      }
      let boomed = false;
      for (const e of evs) {
        if (e.type === "boom" && !boomed && now - (S.lastBoomT || 0) > 90) { S.audio.boom(); S.lastBoomT = now; boomed = true; }
        else if (e.type === "muzzle") S.audio.fire();
        else if (e.type === "gmuzzle") S.audio.fire();
        else if (e.type === "splash") S.audio.splash();
        else if (e.type === "weldbreak" && e.ice && now - (S.lastCrackT || 0) > 70) { S.audio.crack(); S.lastCrackT = now; }
      }
      R.consume(evs);
      persistSave();
      stateSave();
      for (let i = S.toasts.length - 1; i >= 0; i--) { S.toasts[i].t -= dt; if (S.toasts[i].t <= 0) S.toasts.splice(i, 1); }
      if (S.trial.flashT > 0) S.trial.flashT -= dt;
      const layer = labelLayerRef.current;
      if (layer) {
        while (layer.children.length < S.labels.length) {
          const d = window.document.createElement("div");
          d.style.cssText = "position:absolute;transform:translate(-50%,-50%);font:bold 13px 'Courier New',monospace;letter-spacing:1px;text-shadow:0 2px 0 #000,0 0 6px rgba(0,0,0,0.7);pointer-events:none;white-space:nowrap;";
          layer.appendChild(d);
        }
        while (layer.children.length > S.labels.length) layer.removeChild(layer.lastChild);
        const rct = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : { width: 0, height: 0 };
        const cw = rct.width > 4 ? rct.width : 960, ch = rct.height > 4 ? rct.height : 600;
        for (let i = S.labels.length - 1; i >= 0; i--) {
          const L = S.labels[i];
          L.t -= dt;
          if (L.t <= 0) { S.labels.splice(i, 1); continue; }
          const pnd = R.project(L.x, L.y + (1.15 - L.t) * 1.6, L.z);
          const el = layer.children[i];
          if (el) {
            el.textContent = L.text;
            el.style.color = L.color;
            el.style.opacity = String(Math.min(1, L.t * 2.2));
            el.style.left = ((pnd.x * 0.5 + 0.5) * cw).toFixed(0) + "px";
            el.style.top = ((-pnd.y * 0.5 + 0.5) * ch).toFixed(0) + "px";
          }
        }
      }
      if (bison) {
        // frame the bison low: look ahead along its heading
        const la = 8.5;
        S.focus.x += ((bison.pos.x + bison.R[6] * la) - S.focus.x) * Math.min(1, 4 * dt);
        S.focus.y += (bison.pos.y - S.focus.y) * Math.min(1, 4 * dt);
        S.focus.z += ((bison.pos.z + bison.R[8] * la) - S.focus.z) * Math.min(1, 4 * dt);
      }
      let ty = 0;
      if (bison) {
        const bodyYaw = Math.atan2(bison.R[6], bison.R[8]);
        ty = Math.atan2(S.aim.x - bison.pos.x, S.aim.z - bison.pos.z) - bodyYaw;
      }
      try { R.render(dt, S.focus, S.aim, ty); } catch (err) {
        console.error("COLDSNAP render failed", err);
        S.running = false;
        setFatal(String((err && err.message) || err));
        return;
      }
      S.hudT += dt;
      if (S.hudT >= 0.2) {
        S.hudT = 0;
        setHud({
          fps: S.fps, bodies: w.bodies.length, tally: { ...S.tally }, feed: [...S.feed],
          achUnlocked: [...w.ach.unlocked], toasts: [...S.toasts], total: w.ach.total,
          cds: { fire: S.cds.fire, volley: S.cds.volley },
          flipped: (() => { const bb2 = w.byId.get(w.bisonId); return bb2 ? bb2.R[4] < 0.45 : false; })(), // matches the engine's recover gate (0.5) minus margin — the demo's 0.3 left a stuck band with no visible RECOVER
          iceOn: !!w.ice,
          trial: { idx: S.trial.idx, prog: S.trial.prog, flashT: S.trial.flashT, free: S.trial.idx >= TRIALS.length, el: Math.max(0, w.t - S.trial.t0) },
          medals: { ...S.medals },
          brief: S.brief,
          aar: S.aar || null,
        });
      }
    };
    raf = window.requestAnimationFrame(loop);
    const api = {
      ...actions,
      setDrive: (t, s, b) => { S.keys["w"] = t > 0; S.keys["s"] = t < 0; S.keys["d"] = s > 0; S.keys["a"] = s < 0; S.keys[" "] = !!b; },
      setGfx: (p) => R.setGfx(p),
      getState: () => ({ t: S.world.t, bodies: S.world.bodies.length, tally: { ...S.tally }, ach: [...S.world.ach.unlocked], total: S.world.ach.total, hash: worldHash(S.world), medals: { ...S.medals }, trial: { idx: S.trial.idx, prog: S.trial.prog, id: TRIALS[S.trial.idx] ? TRIALS[S.trial.idx].id : "free", free: S.trial.idx >= TRIALS.length } }),
      skipTrial: () => advanceTrial(true),
      recover: () => { if (S.cds.recover <= 0 && recoverBison(S.world)) { S.cds.recover = 2.5; S.audio.hook(); } },
      freezePool: () => { S.world.pg.freeze(); S.toasts.push({ id: S.toastSeq++, title: "THE POOL HAS FROZEN", desc: "Thin ice. It remembers weight.", t: 4 }); },
      spawnWingman: () => {
        const w = S.world, lead = w.byId.get(w.bisonId);
        if (!lead) return null;
        const x = lead.pos.x - lead.R[6] * 7, z = lead.pos.z - lead.R[8] * 7;
        const h = addBody(w, { kind: "vehicle", team: 1, group: "squad", mass: 1400, hx: 1.25, hy: 0.7, hz: 1.85, x, z, y: w.field.heightAt(x, z) + 0.72, hp: 220, friction: 0.85, q: heading(null, Math.atan2(lead.R[6], lead.R[8])) });
        h.squad = true; h.follow = true;
        S.toasts.push({ id: S.toastSeq++, title: "WINGMAN ON STATION", desc: "He holds six lengths back.", t: 3 });
        return h.id;
      },
      thawPool: () => { S.world.pg.thaw(); },
      _R: R,
      aimAt: (x, z) => { S.aim = { x, z }; },
      _world: () => S.world, _S: S,
    };
    if (typeof window !== "undefined") window.__COLDSNAP__ = api;
    return () => {
      S.running = false;
      window.cancelAnimationFrame(raf);
      if (wrapEl) {
        wrapEl.removeEventListener("touchstart", touchBlock);
        wrapEl.removeEventListener("touchmove", touchBlock);
        wrapEl.removeEventListener("touchend", touchBlock);
      }
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("contextmenu", onCtx);
      window.removeEventListener("wheel", onWheel);
      try { R.dispose(); } catch (e) {}
      if (typeof window !== "undefined" && window.__COLDSNAP__ === api) delete window.__COLDSNAP__;
      if (stateRef.current === S) stateRef.current = null;
    };
  }, []);

  // autosave restore: raw gfx values (never preset names — preset restore
  // would change the mounted 1x look), then zoom and sound. The loop's
  // stateSave stays gated until this pass lands.
  useEffect(() => {
    let live = true;
    (async () => {
      const s = await loadSettings();
      const S = stateRef.current;
      if (!live || !S) return;
      try {
        const g = sanitizeGfx(s && s.gfx);
        if (g) {
          setGfxUi(g); gfxRef.current = g;
          if (S.R) S.R.setGfx({ scale: g.scale, outline: g.outline, dither: g.dither, palette: g.palette });
        }
        if (s && typeof s.zoom === "number" && S.zoomBy && S.zoom) S.zoomBy(Math.max(0.7, Math.min(2, s.zoom)) / S.zoom);
        if (s && typeof s.muted === "boolean") S.audio.setMuted(s.muted);
      } catch (e) {}
      S.settingsReady = true;
    })();
    return () => { live = false; };
  }, []);

  const applyGfx = (patch) => {
    const S = stateRef.current;
    if (patch.preset === "retro") {
      const g = { preset: "retro", scale: 3, outline: 1, dither: 1, palette: 1 };
      setGfxUi(g); gfxRef.current = g;
      if (S && S.R) S.R.setGfx({ preset: "retro" });
      return;
    }
    if (patch.preset === "clean") {
      const g = { preset: "clean", scale: 2, outline: 1, dither: 0, palette: 1 };
      setGfxUi(g); gfxRef.current = g;
      if (S && S.R) S.R.setGfx({ preset: "clean" });
      return;
    }
    const next = { ...gfxUi, ...patch, preset: "custom" };
    setGfxUi(next); gfxRef.current = next;
    if (S && S.R) S.R.setGfx({ scale: next.scale, outline: next.outline, dither: next.dither, palette: next.palette });
  };
  const act = (name) => { const S = stateRef.current; if (S && S.actions) S.actions[name](); };
  const P = {
    wrap: { position: "relative", width: "100%", height: "100vh", minHeight: 520, background: "#0e1014", overflow: "hidden", fontFamily: "'Courier New', ui-monospace, monospace", userSelect: "none", WebkitUserSelect: "none", touchAction: "none", WebkitTouchCallout: "none", overscrollBehavior: "none" },
    cv: { position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", cursor: "crosshair", touchAction: "none" },
    panel: { position: "absolute", background: "rgba(16,19,24,0.92)", border: "2px solid #3a414b", color: "#cfd6de", padding: "6px 10px", fontSize: isTouch ? 13 : 12, lineHeight: 1.5 },
    btn: { background: "#1c2129", border: "2px solid #4a5361", color: "#e6ebf1", padding: isTouch ? "12px 14px" : "7px 10px", fontSize: isTouch ? 14 : 12, fontFamily: "inherit", cursor: "pointer", letterSpacing: 0.5, touchAction: "manipulation" },
    joyBase: { position: "absolute", width: 112, height: 112, borderRadius: "50%", border: "2px solid rgba(216,67,58,0.55)", background: "rgba(20,24,30,0.35)", display: "none", pointerEvents: "none", zIndex: 4 },
    joyKnob: { position: "absolute", width: 44, height: 44, borderRadius: "50%", background: "rgba(216,67,58,0.75)", border: "2px solid #ff6b5e", display: "none", pointerEvents: "none", zIndex: 4 },
    red: { color: "#ff6b5e" },
  };
  const [menuOpen, setMenuOpen] = useState(false);
  const causeOrder = ["PROJECTILE", "BLAST", "CRUSH", "TOSS", "COLLAPSE", "FLIP", "DROWN", "IMPACT"];
  const trialDef = TRIALS[hud.trial.idx];
  const achDefs = makeAch().defs;
  return (
    <div ref={wrapRef} style={P.wrap}>
      <canvas ref={canvasRef} style={P.cv} />
      <div ref={labelLayerRef} data-coldsnap="labels" style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2, overflow: "hidden" }} />
      <div ref={joyBaseRef} style={P.joyBase} />
      <div ref={joyKnobRef} style={P.joyKnob} />
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, background: hud.trial.flashT > 0 ? "rgba(216,67,58,0.92)" : "rgba(16,19,24,0.92)", borderBottom: "2px solid #3a414b", color: "#e6ebf1", padding: "8px 10px", fontSize: isTouch ? 14 : 13, display: "flex", alignItems: "center", gap: 10, zIndex: 3 }}>
        {onExit && <button data-menu="exit" style={{ ...P.btn, padding: isTouch ? "6px 10px" : "3px 8px", fontSize: isTouch ? 14 : 11, flexShrink: 0 }} onClick={onExit}>⏏</button>}
        {trialDef ? (
          <>
            <span style={{ color: "#ffd27a", whiteSpace: "nowrap", flexShrink: 0 }}>ORDER {hud.trial.idx + 1}/{TRIALS.length}</span>
            <span
              title="re-read the work order"
              onClick={() => { const S = stateRef.current; if (S) S.brief = { title: trialDef.title, directive: trialDef.hint }; }}
              style={{ color: "#ff6b5e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0, flexShrink: 1, cursor: "pointer" }}
            >{trialDef.title}</span>
            {!isTouch && <span style={{ opacity: 0.85, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{trialDef.hint}</span>}
            <span style={{ whiteSpace: "nowrap", opacity: 0.75, flexShrink: 0, marginLeft: "auto" }}>{hud.trial.el.toFixed(0)}s</span>
            <span style={{ whiteSpace: "nowrap", flexShrink: 0 }}>{hud.trial.prog}/{trialDef.need}</span>
            <button style={{ ...P.btn, padding: isTouch ? "6px 10px" : "3px 8px", fontSize: isTouch ? 13 : 11, flexShrink: 0 }} onClick={() => { const S = stateRef.current; if (S) window.__COLDSNAP__ && window.__COLDSNAP__.skipTrial(); }}>SKIP</button>
          </>
        ) : (
          <>
            <span style={{ color: "#ffd27a" }}>FREE PLAY</span>
            {TRIALS.map((t) => {
              const m = hud.medals[t.id];
              // deviations stand in the record as a hollow grey star
              const col = !m ? "#4a5361" : m.deviation ? "#8b93a0" : m.medal === "GOLD" ? "#ffd27a" : m.medal === "SILVER" ? "#cfd6de" : "#b0764a";
              return (
                <span
                  key={t.id}
                  title={t.title + (m ? ` ${m.time}s — open the filed report` : "")}
                  onClick={async () => {
                    const S = stateRef.current;
                    if (!S || !m) return;
                    try {
                      const r = await window.storage.get("coldsnap-cs-aar-" + t.id);
                      const lines = JSON.parse(r.value);
                      if (Array.isArray(lines)) S.aar = { id: t.id, lines, medal: m.medal || null, outcome: m.deviation ? "UNFULFILLED — DEVIATION" : "FULFILLED" };
                    } catch (e) {}
                  }}
                  style={{ color: col, cursor: m ? "pointer" : "default" }}
                >{m && m.deviation ? "☆" : "★"}</span>
              );
            })}
            <span style={{ opacity: 0.8, fontSize: 11 }}>reports on file — tap a star</span>
          </>
        )}
      </div>
      {fatal && (
        <div style={{ ...P.panel, top: "40%", left: "50%", transform: "translate(-50%,-50%)", borderColor: "#d8433a", maxWidth: 420 }}>
          <div style={{ color: "#ff6b5e" }}>ENGINE FAULT</div>
          <div style={{ fontSize: 11, marginTop: 4 }}>{fatal}</div>
        </div>
      )}
      {!started && !fatal && (
        <div
          onClick={() => setStarted(true)}
          style={{ position: "absolute", inset: 0, background: "rgba(10,12,16,0.72)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 5 }}
        >
          <div style={{ ...P.panel, position: "static", borderColor: "#d8433a", textAlign: "center", padding: "16px 26px" }}>
            <div style={{ fontSize: 22, color: "#ff6b5e", letterSpacing: 4 }}>COLDSNAP</div>
            <div style={{ opacity: 0.8, marginBottom: 10 }}>CONTRACT DIVISION</div>
            <div style={{ color: "#ffd27a", marginBottom: 8, fontSize: 13 }}>Seven work orders. The bureau is watching the clock.<br />Follow the gold ring. The far ridge shoots back.</div>
            {isTouch ? (
              <div style={{ textAlign: "left", fontSize: 13, lineHeight: 1.8 }}>
                <div><b>LEFT STICK</b> — the tank goes where you point it</div>
                <div><b>TAP</b> — aim the reticle · hold <b>FIRE</b> to shoot</div>
                <div><b>DRAG</b> — aim without firing</div>
                <div><b>PINCH / + −</b> — zoom</div>
              </div>
            ) : (
              <div style={{ textAlign: "left", fontSize: 12, lineHeight: 1.7 }}>
                <div><b>W A S D</b> — drive the Bison</div>
                <div><b>MOUSE</b> — aim · <b>CLICK</b> — main gun</div>
                <div><b>V</b> — rocket volley</div>
                <div><b>SPACE</b> — brake · <b>WHEEL</b> — zoom</div>
                <div><b>1/2/3</b> — respawn squads / scouts / repair · <b>0</b> — reset</div>
              </div>
            )}
            <div style={{ marginTop: 12, color: "#ffd27a" }}>{isTouch ? "TAP TO DEPLOY" : "CLICK TO DEPLOY"}</div>
          </div>
        </div>
      )}
      {isTouch ? (
        <div style={{ ...P.panel, top: 52, left: 10, padding: "4px 9px" }}>
          <span style={{ color: "#ff6b5e", letterSpacing: 1.5, fontSize: 13 }}>COLDSNAP</span>
          <span style={{ opacity: 0.6, marginLeft: 8, fontSize: 12 }}>{hud.fps} fps</span>
        </div>
      ) : (
        <div style={{ ...P.panel, top: 44, left: 10 }}>
          <div style={{ fontSize: 14, color: "#ff6b5e", letterSpacing: 2 }}>COLDSNAP</div>
          <div style={{ opacity: 0.75 }}>{hud.fps} fps · {hud.bodies} bodies</div>
          <div style={{ opacity: 0.75 }}>WASD drive · click fire · V volley · wheel zoom</div>
        </div>
      )}
      {!isTouch && (
        <div style={{ ...P.panel, top: 44, right: 12, display: "flex", gap: 10, padding: 8 }}>
          <button style={P.btn} onClick={() => { const S = stateRef.current; if (S && S.zoomBy) S.zoomBy(1.18); }}>+</button>
          <button style={P.btn} onClick={() => { const S = stateRef.current; if (S && S.zoomBy) S.zoomBy(0.85); }}>−</button>
          <button style={P.btn} onClick={() => { setAchOpen(!achOpen); setGfxOpen(false); }}>★ {hud.achUnlocked.length}/{achDefs.length}</button>
          <button style={P.btn} onClick={() => { setGfxOpen(!gfxOpen); setAchOpen(false); }}>GFX</button>
        </div>
      )}
      {isTouch ? (
        <div style={{ ...P.panel, bottom: 12, left: 10, padding: "6px 10px" }}>
          <span style={{ color: "#ff6b5e", fontSize: 14 }}>☠ {hud.total}</span>
          {hud.feed[0] && <span style={{ opacity: 0.75, marginLeft: 8, fontSize: 12 }}>{hud.feed[0]}</span>}
        </div>
      ) : (
        <div style={{ ...P.panel, bottom: 64, left: 10, minWidth: 130, maxWidth: 190 }}>
          <div style={{ color: "#ff6b5e", marginBottom: 2 }}>KILLS · {hud.total} lifetime</div>
          {causeOrder.filter((c) => hud.tally[c]).map((c) => (
            <div key={c} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <span>{c}</span><span>{hud.tally[c]}</span>
            </div>
          ))}
          {hud.feed.map((f, i) => (
            <div key={i} style={{ opacity: 0.8 - i * 0.14, fontSize: 11, marginTop: i === 0 ? 6 : 0 }}>{f}</div>
          ))}
        </div>
      )}
      {hud.flipped && (
        <button style={{ ...P.btn, position: "absolute", left: "50%", transform: "translateX(-50%)", bottom: isTouch ? 190 : 64, background: "#8a5a1c", borderColor: "#ffd27a", zIndex: 5, padding: "12px 18px", fontSize: 14 }} onClick={() => window.__COLDSNAP__ && window.__COLDSNAP__.recover()}>
        ⟳ RECOVER {isTouch ? "" : "[R]"}
        </button>
      )}
      {isTouch && (
        <div style={{ position: "absolute", right: 12, bottom: 12, display: "flex", flexDirection: "column", gap: 12, zIndex: 3, alignItems: "stretch" }}>
          <button
            data-fire
            onContextMenu={(e) => e.preventDefault()}
            onPointerDown={(e) => {
              e.preventDefault();
              // the visual is a circle — honor it: corner taps on the square element fall
              // through to nothing instead of firing. Zero-size rects (headless DOM) skip.
              const r = e.currentTarget.getBoundingClientRect(), w2 = r.width / 2;
              if (w2 > 4) { const dx = e.clientX - (r.left + w2), dy = e.clientY - (r.top + r.height / 2); if (dx * dx + dy * dy > w2 * w2) return; }
              const S = stateRef.current; if (S) S.fireHeld = true;
            }}
            onPointerUp={() => { const S = stateRef.current; if (S) S.fireHeld = false; }}
            onPointerCancel={() => { const S = stateRef.current; if (S) S.fireHeld = false; }}
            onPointerLeave={() => { const S = stateRef.current; if (S) S.fireHeld = false; }}
            style={{ ...P.btn, width: 92, height: 92, borderRadius: "50%", alignSelf: "center", fontSize: 15, letterSpacing: 2, touchAction: "none", background: (hud.cds.fire || 0) > 0 ? "#3a2320" : "#5c211b", borderColor: "#ff6b5e", opacity: (hud.cds.fire || 0) > 0 ? 0.6 : 1 }}
          >FIRE</button>
          <button
            data-mg
            onContextMenu={(e) => e.preventDefault()}
            onPointerDown={(e) => {
              e.preventDefault();
              const r = e.currentTarget.getBoundingClientRect(), w2 = r.width / 2;
              if (w2 > 4) { const dx = e.clientX - (r.left + w2), dy = e.clientY - (r.top + r.height / 2); if (dx * dx + dy * dy > w2 * w2) return; }
              const S = stateRef.current; if (S) S.mgHeld = true;
            }}
            onPointerUp={() => { const S = stateRef.current; if (S) S.mgHeld = false; }}
            onPointerCancel={() => { const S = stateRef.current; if (S) S.mgHeld = false; }}
            onPointerLeave={() => { const S = stateRef.current; if (S) S.mgHeld = false; }}
            style={{ ...P.btn, width: 72, height: 72, borderRadius: "50%", alignSelf: "center", fontSize: 12, letterSpacing: 2, touchAction: "none", background: "#23303a", borderColor: "#7fb2d8" }}
          >MG</button>
          <button style={{ ...P.btn, opacity: hud.cds.volley > 0 ? 0.45 : 1, minWidth: 108 }} onClick={() => { const S = stateRef.current; if (S) S.actions.volleyAt(S.aim.x, S.aim.z); }}>
            {hud.cds.volley > 0 ? `VOLLEY ${hud.cds.volley.toFixed(0)}` : "VOLLEY"}
          </button>
          <button style={{ ...P.btn, borderColor: "#bfe3f5", minWidth: 108 }} onClick={() => { const api = window.__COLDSNAP__; if (api) (hud.iceOn ? api.thawPool() : api.freezePool()); }}>
            {hud.iceOn ? "☀ THAW" : "❄ FREEZE"}
          </button>
          <button style={P.btn} onClick={() => setMenuOpen(!menuOpen)}>☰</button>
        </div>
      )}
      {isTouch && menuOpen && (
        <div style={{ ...P.panel, right: 10, bottom: 170, display: "flex", flexDirection: "column", gap: 8, zIndex: 4 }}>
          <button style={P.btn} onClick={() => { setAchOpen(!achOpen); setGfxOpen(false); setMenuOpen(false); }}>★ SERVICE RECORD</button>
          <button style={P.btn} onClick={() => { setGfxOpen(!gfxOpen); setAchOpen(false); setMenuOpen(false); }}>GRAPHICS</button>
          <button style={P.btn} onClick={() => { act("squads"); setMenuOpen(false); }}>RESPAWN SQUADS</button>
          <button style={P.btn} onClick={() => { act("scouts"); setMenuOpen(false); }}>RESPAWN SCOUTS</button>
          <button style={P.btn} onClick={() => { act("repair"); setMenuOpen(false); }}>REPAIR TOWER</button>
          <button style={P.btn} onClick={() => { act("reset"); setMenuOpen(false); }}>RESET RANGE</button>
          <button style={P.btn} onClick={() => { const S = stateRef.current; if (S) S.audio.setMuted(!S.audio.muted); setMenuOpen(false); }}>SOUND ON/OFF</button>
          <button style={P.btn} onClick={() => { const api = window.__COLDSNAP__; if (api) (hud.iceOn ? api.thawPool() : api.freezePool()); setMenuOpen(false); }}>{hud.iceOn ? "THAW POOL" : "FREEZE POOL"}</button>
          <button style={P.btn} onClick={() => { const api = window.__COLDSNAP__; if (api) api.spawnWingman(); setMenuOpen(false); }}>SPAWN WINGMAN (DEBUG)</button>
        </div>
      )}
      <div style={{ position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)", display: isTouch ? "none" : "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", maxWidth: "96%", zIndex: 3 }}>
        <button style={{ ...P.btn, opacity: hud.cds.volley > 0 ? 0.45 : 1 }} onClick={() => { const S = stateRef.current; if (S) S.actions.volleyAt(S.aim.x, S.aim.z); }}>
          {hud.cds.volley > 0 ? `VOLLEY ${hud.cds.volley.toFixed(0)}s` : isTouch ? "VOLLEY" : "ROCKET VOLLEY [V]"}
        </button>
        <button style={{ ...P.btn, borderColor: "#bfe3f5" }} onClick={() => { const api = window.__COLDSNAP__; if (api) (hud.iceOn ? api.thawPool() : api.freezePool()); }}>
          {hud.iceOn ? "☀ THAW POOL" : "❄ FREEZE POOL"}
        </button>
        <button style={P.btn} onClick={() => act("squads")}>{isTouch ? "SQUADS" : "SQUADS [1]"}</button>
        <button style={P.btn} onClick={() => act("scouts")}>{isTouch ? "SCOUTS" : "SCOUTS [2]"}</button>
        <button style={P.btn} onClick={() => act("repair")}>{isTouch ? "REPAIR" : "REPAIR [3]"}</button>
        <button style={P.btn} onClick={() => act("reset")}>{isTouch ? "RESET" : "RESET [0]"}</button>
      </div>
      {started && hud.aar && (() => {
        const stampCol = hud.aar.medal === "GOLD" ? "#ffd27a" : hud.aar.medal === "SILVER" ? "#cfd6de" : hud.aar.medal === "BRONZE" ? "#b0764a" : "#ff6b5e";
        const file = () => { const S = stateRef.current; if (S) S.aar = null; };
        return (
          <div style={{ position: "absolute", inset: 0, background: "rgba(10,12,16,0.55)", zIndex: 6, display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
            <div data-aar onClick={(e) => e.stopPropagation()} style={{ ...P.panel, position: "relative", width: "min(470px, 94vw)", maxHeight: "76vh", overflowY: "auto", padding: "12px 16px" }}>
              <div style={{ borderBottom: "1px dashed #3a414b", paddingBottom: 6, marginBottom: 9, display: "flex", justifyContent: "space-between", gap: 10, fontSize: isTouch ? 10 : 9, letterSpacing: 1.5, color: "#8b93a0", whiteSpace: "nowrap" }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>PROCUREMENT BUREAU · FIELD ACCEPTANCE DIVISION</span>
                <span>FORM AA-7 · CARBON 2/3</span>
              </div>
              <div style={{ position: "absolute", top: 34, right: 16, transform: "rotate(-7deg)", border: `3px double ${stampCol}`, color: stampCol, padding: "3px 10px", fontSize: 13, letterSpacing: 3, opacity: 0.9, textAlign: "center", pointerEvents: "none" }}>
                {hud.aar.outcome.split(" — ")[0]}
                {hud.aar.medal ? (
                  <div style={{ fontSize: 10, letterSpacing: 2 }}>★ {hud.aar.medal}</div>
                ) : hud.aar.outcome.includes(" — ") ? (
                  <div style={{ fontSize: 10, letterSpacing: 2 }}>{hud.aar.outcome.split(" — ")[1]}</div>
                ) : null}
              </div>
              <div style={{ fontSize: isTouch ? 13 : 11.5, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
                {hud.aar.lines.map((ln, i) => {
                  const sub = ln.startsWith("  SUBJECT");
                  const remark = ln.startsWith("REMARK:");
                  const exp = ln.startsWith("EXPENDITURE:");
                  return (
                    <div key={i} style={{
                      color: i === 0 || remark ? "#ffd27a" : sub ? "#a9b3bf" : "#cfd6de",
                      fontSize: i === 0 ? (isTouch ? 15 : 13) : remark ? (isTouch ? 13.5 : 12) : (isTouch ? 13 : 11.5),
                      paddingRight: i <= 1 ? 98 : 0, // the title and status wrap clear of the stamp
                      letterSpacing: i === 0 ? 1 : 0,
                      fontStyle: remark ? "italic" : "normal",
                      borderTop: exp ? "1px solid #3a414b" : "none",
                      marginTop: exp ? 7 : 0, paddingTop: exp ? 7 : 0,
                    }}>{ln}</div>
                  );
                })}
              </div>
              <button data-aar-file onClick={file} style={{ ...P.btn, marginTop: 10, width: "100%", borderColor: "#8a5a1c", letterSpacing: 2 }}>FILE REPORT</button>
            </div>
          </div>
        );
      })()}
      {started && !hud.aar && hud.brief && (() => {
        // the tap that dismisses the deploy overlay starts the game on
        // pointerdown, and its trailing click lands on whatever mounts in the
        // same flush — this modal. On touch, only the button dismisses, and
        // the ack is armed after a beat so that stray click can't file the
        // order unread.
        if (briefArmRef.current.brief !== hud.brief) briefArmRef.current = { brief: hud.brief, at: performance.now() };
        const ack = () => {
          if (performance.now() - briefArmRef.current.at < 500) return;
          const S = stateRef.current; if (S) S.brief = null;
        };
        return (
          <div onClick={isTouch ? undefined : ack} style={{ position: "absolute", inset: 0, background: "rgba(10,12,16,0.5)", zIndex: 6, display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
            <div data-brief onClick={(e) => e.stopPropagation()} style={{ ...P.panel, position: "relative", width: "min(430px, 92vw)", borderColor: "#ffd27a", padding: isTouch ? "16px 18px" : "12px 16px" }}>
              <div style={{ fontSize: isTouch ? 11 : 10, letterSpacing: 2, opacity: 0.7 }}>WORK ORDER</div>
              <div style={{ color: "#ffd27a", letterSpacing: 1, marginTop: 3, fontSize: isTouch ? 16 : 13 }}>{hud.brief.title}</div>
              <div style={{ fontSize: isTouch ? 14 : 12, opacity: 0.92, marginTop: 7, lineHeight: 1.55 }}>{hud.brief.directive}</div>
              <button data-brief-ack style={{ ...P.btn, marginTop: 12, width: "100%", borderColor: "#8a5a1c", letterSpacing: 2 }} onClick={ack}>ACKNOWLEDGE</button>
            </div>
          </div>
        );
      })()}
      <div style={{ position: "absolute", top: isTouch ? 94 : 60, left: "50%", transform: "translateX(-50%)", display: "flex", flexDirection: "column", gap: 6, alignItems: "center", zIndex: 3, maxWidth: "94vw" }}>
        {hud.toasts.map((t) => (
          <div key={t.id} style={{ ...P.panel, position: "static", borderColor: "#d8433a", textAlign: "center" }}>
            <div style={{ color: "#ff6b5e" }}>★ {t.title}</div>
            <div style={{ fontSize: 11, opacity: 0.8 }}>{t.desc}</div>
          </div>
        ))}
      </div>
      {achOpen && (
        <div style={{ ...P.panel, top: 92, right: 10, width: 250, maxHeight: 300, overflowY: "auto", zIndex: 4 }}>
          <div style={{ color: "#ff6b5e", marginBottom: 4 }}>SERVICE RECORD</div>
          {achDefs.map(([id, name, desc]) => {
            const on = hud.achUnlocked.includes(id);
            return (
              <div key={id} style={{ marginBottom: 6, opacity: on ? 1 : 0.45 }}>
                <div style={{ color: on ? "#ffd27a" : "#8b93a0" }}>{on ? "★" : "☆"} {name}</div>
                <div style={{ fontSize: 11 }}>{desc}</div>
              </div>
            );
          })}
        </div>
      )}
      {gfxOpen && (
        <div style={{ ...P.panel, top: 92, right: 10, width: 230, zIndex: 4 }}>
          <div style={{ color: "#ff6b5e", marginBottom: 4 }}>GRAPHICS LAB</div>
          <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            <button style={{ ...P.btn, borderColor: gfxUi.preset === "retro" ? "#d8433a" : "#4a5361" }} onClick={() => applyGfx({ preset: "retro" })}>FULL RETRO</button>
            <button style={{ ...P.btn, borderColor: gfxUi.preset === "clean" ? "#d8433a" : "#4a5361" }} onClick={() => applyGfx({ preset: "clean" })}>HALF-STEP</button>
          </div>
          <div style={{ marginBottom: 4 }}>
            pixel ×{gfxUi.scale}{" "}
            <input type="range" min={1} max={4} step={1} value={gfxUi.scale} onChange={(e) => applyGfx({ preset: null, scale: +e.target.value })} style={{ width: 110, verticalAlign: "middle" }} />
          </div>
          {["outline", "dither", "palette"].map((k) => (
            <label key={k} style={{ display: "block", cursor: "pointer" }}>
              <input type="checkbox" checked={!!gfxUi[k]} onChange={(e) => applyGfx({ preset: null, [k]: e.target.checked ? 1 : 0 })} /> {k}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
