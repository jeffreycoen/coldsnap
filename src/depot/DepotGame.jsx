// COLDSNAP DEPOT — Phase 0/1 playable scaffold. Seeded from
// src/game/ColdsnapTD.jsx (the frozen reference implementation — read it
// before touching this file). Same map/grid/flow-field/build-sell/tower-fire
// skeleton, stripped to what Phase 0/1 ships: no tanks, no mech boss, no
// off-map strikes, no village-protection payouts, flat conscript-only waves.
// Every gameplay rng call runs through world.rng() (mulberry32, seeded with
// the map) — the JS built-in unseeded generator is forbidden here — so runs
// replay exactly from ?seed=.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { MK } from "../version.js";
import {
  makeField, makeWorld, addBody, addWeld, stepWorld, fireProjectile,
  applyDamage, mulberry32, heading, explode,
} from "../engine/core.js";
import { TOWER_SPECS, TOWER_ORDER, MASON, INFANTRY_ARMS, BISON, APC, MECH, BISON_FIRE, BARRELS } from "./specs.js";
import { cardFor } from "./infocards.js";
import { TEACH, TEACH_REV } from "./cards.js";
import { windAt } from "./wind.js";
import { HUD0, BELL_PERIOD_S, stepBell, fireBell, nextSpawnTag, withdrawDue, executeWithdrawal, ASSAULT_TIMEOUT, checkLoss, makeEndDispatch, towerShot, friendlyFouls, fieldReaches, effRange, validatePlacement, PENDING_ARM_S, pendingArmed, pendingButtonsVisible, canvasTapConsumesPending, END_CARD_DELAY_S, stampEnd, endCardReady, censusDepotChunks, depotStandingFraction, stepDepotCensus, squadFire, possessedVolley, possessedTowerFire, spawnSquadMembers, spawnSandbag, WALL_COST, SANDBAG_FIELD_COST, WALL_FIELD_COST, WALL_HALF, WALL_THIN, spawnWallCourses, wallOrientAt, forgetWelds, makeManifestState, makeFoeState, takeHandCard, TAP_SQUAD_M, TAP_HULL_M, TAP_TOWER_M, nextPick, squadIdsOfType, scoreKill, placeZoneMask, POSSESS_ACC, stickyLock } from "./state.js";
import { marketCounts, computePrices, fieldPrices, priced } from "./market.js";
import { stepMines, minePrices, MINE_COST, WIRE_COST } from "./mines.js";
import { addFogPatch, stepFog } from "./fog.js";
import { SQUAD_SPECS, makeSquad, slotBlockedPublic, roomMaskPublic, clearSlot } from "./squads.js";
import { reachPolygon, arcClears, squadReach, towerReachCached, scatterSigma, predictRing } from "./accuracy.js";
import { spawnUnit } from "./units.js";
import { possessedArmorFire, possessedArmorMg, mechSighted, barrelTip } from "./drivers.js";
import { unloadApc, apcSeated } from "./transports.js";
import { makeRegiment, payTown, groundRate } from "./economy.js";
import { makeTerritory, stepTerritory, holderAt, canBuild, fogStateFor, valueAt, EMIT } from "./territory.js";
import { makeSight, stepSight, seenAt, eyeOf, steerReticle, reclampReticle, surfaceAt } from "./sight.js";
import { SAVE_KEY, burnFront, restoreBodies, restoreWelds, restoreCensus, restoreSquads } from "./save.js";
import { serializeRun, makeRenderer, renderPortrait, makeGameAudio, storage } from "./api.js";
import { makeBodyLists, rebuildBodyLists } from "./lists.js";
import Dispatch from "./Dispatch.jsx";
import InfoCard from "./InfoCard.jsx";
import CrateChip, { StockTag } from "./Crate.jsx";
import { makeMap, buildDepotTerrain, makeGrid, planTrees, computeFlowField } from "./mapgen.js";
import { armorSpread, armorStable, MECH_SPREAD, musterFreshStart, PICK_POOL } from "./muster.js";
import { startBuildLine, linePieces, stepBuildLine } from "./buildlines.js";
import { ringBell as ringBellOut } from "./bell.js";
import { buildMech, mechCommand, mechFire, mechMissiles, mechBarrage, mechPunt, mechAboutFace, mechPivot, mechAimDir } from "../engine/mech.js";
import { stepDepot, buildTown, townFootprint, makeDepotAssaultState, clockStr, spawnEnemy } from "./sim.js";
import { bootWar, stampBag as bootStampBag } from "./boot.js";
import { tickWar, buildSnapshotOf } from "./tick.js";

// mk2.28: the quartermaster's quiet flag — the purpose lines speak in the
// first war only, then go quiet for good once the first bell has rung.
const QM_KEY = "coldsnap-qm-quiet";
// Task 3 (mk2.41): the teaching cards' seen store — one key, rev-gated
// (the MANUAL_REV law). seen may carry the sentinel "*": every card
// silenced, the smoke test's scripted wars ride under it.
const CARDS_KEY = "coldsnap-wf-cards";



// ============================================================== component
function detectTouch() {
  return (typeof window !== "undefined") && ("ontouchstart" in window || (navigator.maxTouchPoints || 0) > 0);
}
const P = {
  root: { position: "fixed", inset: 0, background: "#0e1218", overflow: "hidden", fontFamily: "ui-monospace, Menlo, Consolas, monospace", color: "#e6ebf1", userSelect: "none", WebkitUserSelect: "none", touchAction: "none" },
  cv: { position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" },
  top: { position: "absolute", top: 0, left: 0, right: 0, display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "linear-gradient(rgba(10,13,18,0.88), rgba(10,13,18,0))", zIndex: 4, fontSize: 12, flexWrap: "wrap" },
  panel: { position: "absolute", background: "rgba(14,18,24,0.88)", border: "1px solid #48515f", borderRadius: 8, padding: 10, fontSize: 12, zIndex: 5 },
  btn: { background: "#1a212b", border: "1px solid #48515f", color: "#e6ebf1", borderRadius: 6, padding: "4px 10px", fontFamily: "inherit", fontSize: 12, cursor: "pointer" },
  // mk0.28: the in-world taps (squad order chips, the ✓/✗ confirm pair) are
  // the ones a thumb has to find mid-game — ~1.5x the chrome button, and at
  // least the 44px touch target every phone guideline asks for.
  btnBig: { background: "#1a212b", border: "1px solid #48515f", color: "#e6ebf1", borderRadius: 8, padding: "10px 16px", fontFamily: "inherit", fontSize: 15, lineHeight: "20px", minHeight: 44, minWidth: 44, cursor: "pointer" },
  stat: { display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", background: "rgba(20,26,34,0.75)", border: "1px solid #303a48", borderRadius: 6 },
  bar: { position: "absolute", left: 0, right: 0, bottom: 0, display: "flex", gap: 6, padding: "8px 8px calc(8px + env(safe-area-inset-bottom, 0px))", justifyContent: "center", background: "linear-gradient(rgba(10,13,18,0), rgba(10,13,18,0.9))", zIndex: 4, flexWrap: "wrap" },
  slot: { display: "flex", flexDirection: "column", alignItems: "center", gap: 2, minWidth: 64, minHeight: 52, padding: "8px 10px", background: "#1a212b", border: "1px solid #48515f", borderRadius: 8, fontSize: 12, cursor: "pointer" }, // mk0.28: wider/taller build slots — bottom bar, thumb reach
  ovl: { position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(10,13,18,0.72)", zIndex: 8, textAlign: "center", padding: 20 },
  toastWrap: { position: "absolute", top: 54, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, zIndex: 6, pointerEvents: "none" },
  // The manifest card's parking spot: top-right, under the top bar, mirroring
  // the intel card's top-left (Dispatch.jsx's `float`). pointerEvents none on
  // the wrapper — only the card box itself takes taps, so the battle behind it
  // keeps every pixel it isn't actually covering.
  cardWrap: { position: "absolute", top: 52, right: 10, zIndex: 6, pointerEvents: "none" },
  toast: { background: "rgba(14,18,24,0.92)", border: "1px solid #ffb45e", color: "#ffd9a0", borderRadius: 6, padding: "4px 12px", fontSize: 12 },
};

// COMMAND 1b (mk0.82): THE PIE. One disc of wedges around the selected
// thing. Equal sectors, twelve o'clock first, hole in the middle so the
// unit stays visible. Choosing ANY wedge closes the pie (the owner's rule:
// the screen must be free for the follow-up taps an order needs) — every
// wedge's onClick runs its action, then onChoose (the call site sets
// view.pieOpen = false there), one mechanism for every slot rather than
// repeating a close in each act.
function RadialMenu({ cx, cy, label, slots, armed, onChoose, press, onCard, showInfo }) {
  const N = slots.length, R0 = 36, R1 = 104;
  const wedge = (i) => {
    const a0 = -Math.PI / 2 + (i - 0.5) * (2 * Math.PI / N);
    const a1 = a0 + 2 * Math.PI / N;
    const p = (r, a) => `${cx + Math.cos(a) * r},${cy + Math.sin(a) * r}`;
    const large = (2 * Math.PI / N) > Math.PI ? 1 : 0;
    return `M ${p(R0, a0)} A ${R0} ${R0} 0 ${large} 1 ${p(R0, a1)} L ${p(R1, a1)} A ${R1} ${R1} 0 ${large} 0 ${p(R1, a0)} Z`;
  };
  return (
    <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 7, pointerEvents: "none", overflow: "visible" }}>
      {slots.map((s, i) => {
        const mid = -Math.PI / 2 + i * (2 * Math.PI / N);
        const lx = cx + Math.cos(mid) * 72, ly = cy + Math.sin(mid) * 72;
        return (
          <g key={s.key} data-radial={s.key} style={{ pointerEvents: "auto", cursor: "pointer" }} onClick={() => { s.act(); onChoose && onChoose(); }} opacity={armed ? 1 : 0.5} {...(s.card && press ? press(s.card) : {})}>
            {/* mk0.83 (owner: "green text on green background is illegible"):
                the wedge keeps its dark panel fill even when lit — the lit
                state is the accent BORDER and a faint tint, and every label
                paints a dark halo under itself (paintOrder stroke) so it
                reads on any fill, any terrain. */}
            <path d={wedge(i)} fill="rgba(14,18,24,0.88)" stroke={s.on ? s.color : "#48515f"} strokeWidth={s.on ? 2.5 : 1.5} />
            {s.on && <path d={wedge(i)} fill={s.color} fillOpacity="0.14" stroke="none" />}
            <text x={lx} y={ly - 4} textAnchor="middle" fontSize="15" fill={s.color} stroke="#0e1218" strokeWidth="3" paintOrder="stroke" style={{ userSelect: "none" }}>{s.icon || ""}</text>
            <text x={lx} y={ly + 12} textAnchor="middle" fontSize="10" letterSpacing="1" fill={s.color} stroke="#0e1218" strokeWidth="3" paintOrder="stroke" fontFamily="inherit" style={{ userSelect: "none" }}>{s.label}</text>
            {s.card && showInfo && (
              <text data-wedge-info={s.card} x={lx} y={s.toggle != null ? ly - 22 : ly + 26} textAnchor="middle" fontSize="11" fill="#9fdcff" stroke="#0e1218" strokeWidth="3" paintOrder="stroke" style={{ cursor: "pointer" }}
                onClick={(e) => { e.stopPropagation(); onCard && onCard(s.card); }}>ⓘ</text>
            )}
            {/* P7.1 T2 (owner): a toggle wedge wears a slider — black at
                rest, slid over and bright green in use. Only slots that
                carry s.toggle draw it; every other wedge is untouched. */}
            {s.toggle != null && (
              <g>
                <rect x={lx - 11} y={ly + 17} width={22} height={10} rx={5}
                  fill={s.toggle ? "rgba(74,255,140,0.28)" : "#0a0d12"}
                  stroke={s.toggle ? "#4aff8c" : "#48515f"} strokeWidth="1" />
                <circle cx={s.toggle ? lx + 6 : lx - 6} cy={ly + 22} r={4}
                  fill={s.toggle ? "#4aff8c" : "#14171a"}
                  stroke={s.toggle ? "#4aff8c" : "#48515f"} strokeWidth="1" />
              </g>
            )}
          </g>
        );
      })}
      <foreignObject x={cx - 60} y={cy + R1 + 6} width="120" height="40" style={{ pointerEvents: "none", overflow: "visible" }}>
        <div style={{ textAlign: "center" }}>
          <span style={{ fontSize: 10, letterSpacing: 1, color: "#7dffa8", background: "rgba(14,18,24,0.85)", padding: "1px 6px", borderRadius: 4 }}>{label}</span>
        </div>
      </foreignObject>
    </svg>
  );
}

// The build palette, in bar order — every buildable the match can ever offer.
// Keys are the mode keys tapAt/setMode dispatch on and, since P1 Task 2, the
// exact keys specs.js's PLAYER_START/PLAYER_TIERS ladder is written in, so the
// unlocked filter below is a plain membership test.
const PALETTE = [
  ...TOWER_ORDER.map((k) => ({ key: k, label: TOWER_SPECS[k].label, icon: TOWER_SPECS[k].icon, cost: TOWER_SPECS[k].cost })),
  // Squads (Phase 5 Task 3): mode keys prefixed sq_ — the MG tower owns "mg"
  { key: "sq_sniper", label: "SNIPERS", icon: "✛", cost: SQUAD_SPECS.sniper.cost },
  { key: "sq_rifles", label: "RIFLES", icon: "∴", cost: SQUAD_SPECS.rifles.cost },
  { key: "sq_mg", label: "GUNNERS", icon: "≣", cost: SQUAD_SPECS.mg.cost },
  // F1 Task 4.5: the demolition team — the only player weapon that moves
  // reinforced depot masonry (rifles measured at zero).
  { key: "sq_sappers", label: "SAPPERS", icon: "✸", cost: SQUAD_SPECS.sappers.cost },
  // F1.5 Task 1: the mortar team — selection shows squadReach's lofted
  // near-circle fan (accuracy.js handles occl "lofted" already).
  { key: "sq_mortars", label: "MORTAR TEAM", icon: "◎", cost: SQUAD_SPECS.mortars.cost },
  // P1.5 T4: the engineer team — in the starting kit, so this slot is on the
  // bar from the first frame of every match.
  { key: "sq_engineers", label: "ENGINEERS", icon: "⚒", cost: SQUAD_SPECS.engineers.cost },
  // mk2.02 (owner): the roster surgery — rockets and grenadiers hold the tier-1 seats.
  { key: "sq_rockets", label: "ROCKET TEAM", icon: "▲", cost: SQUAD_SPECS.rockets.cost },
  { key: "sq_grenadiers", label: "GRENADIERS", icon: "◎", cost: SQUAD_SPECS.grenadiers.cost },
  // P7.2 T6: the medic team — mercy on the bar
  { key: "sq_medics", label: "MEDICS", icon: "✚", cost: SQUAD_SPECS.medics.cost },
  // P7.2 T7: the mechanic team — the paid wrench
  { key: "sq_mechanics", label: "MECHANICS", icon: "⚙", cost: SQUAD_SPECS.mechanics.cost },
  { key: "sq_davy", label: "DAVY CROCKETT", icon: "☢", cost: SQUAD_SPECS.davy.cost },
  // P7 T9: THE HERO TIER — bar-visible only once unlocked like everything
  // else. mk1.95: hero keys are placement modes under the one law.
  { key: "hero_bison", label: "BISON", icon: "⛨", cost: BISON.cost },
  { key: "hero_apc", label: "APC", icon: "⬒", cost: APC.cost },
  { key: "hero_mech", label: "MECH", icon: "✇", cost: MECH.cost },
];
const PALETTE_BY_KEY = Object.fromEntries(PALETTE.map((p) => [p.key, p]));
const PALETTE_LABEL = Object.fromEntries(PALETTE.map((p) => [p.key, p.label]));

// mk2.25: THE ENEMY RACK (sandbox only). Every kind the enemy can field,
// placeable by tap on the bench. tag rows spawn through units.js spawnUnit
// (the marksman pair and the wave tank come out of it whole); hull/mech/
// tower rows mirror the enemy's own park shapes at the tapped cell. n is
// men per tap — the same head-count one enemy buy fields.
const FOE_RACK = [
  { key: "foe_rifle", label: "CONSCRIPT", icon: "∴", tag: "", n: 1 },
  { key: "foe_rocket", label: "ROCKET TEAM", icon: "▲", tag: "rocket", n: 2 },
  { key: "foe_gren", label: "GRENADIERS", icon: "◎", tag: "gren", n: 2 },
  { key: "foe_sapper", label: "SAPPERS", icon: "✸", tag: "sapper", n: 2 },
  { key: "foe_mortar", label: "MORTARS", icon: "◎", tag: "mortar", n: 2 },
  { key: "foe_sniper", label: "SNIPER PAIR", icon: "✛", tag: "sniper", n: 1 },
  { key: "foe_mg", label: "GUNNERS", icon: "≣", tag: "mg", n: 2 },
  { key: "foe_eng", label: "ENGINEER", icon: "⚒", tag: "eng", n: 1 },
  { key: "foe_medic", label: "MEDIC", icon: "✚", tag: "medic", n: 1 },
  { key: "foe_mechanic", label: "MECHANIC", icon: "⚙", tag: "mechanic", n: 1 },
  { key: "foe_davy", label: "ATOMIC CREW", icon: "☢", tag: "davy", n: 2 },
  { key: "foe_tank", label: "WAVE TANK", icon: "⛨", tag: "tank", n: 1 },
  { key: "foe_bison", label: "BISON", icon: "⛨", hull: "bison" },
  { key: "foe_apc", label: "APC", icon: "⬒", hull: "apc" },
  { key: "foe_mech", label: "MECH", icon: "✇", mech: true },
  { key: "foe_t_mg", label: "SPITTER", icon: "⊞", tower: "mg" },
  { key: "foe_t_gun", label: "FIELD GUN", icon: "⚑", tower: "gun" },
  { key: "foe_t_mortar", label: "MORTAR", icon: "◎", tower: "mortar" },
  { key: "foe_t_rocket", label: "SALVO RACK", icon: "▲", tower: "rocket" },
  { key: "foe_t_tesla", label: "TESLA COIL", icon: "⚡", tower: "tesla" },
];
const FOE_RACK_BY_KEY = Object.fromEntries(FOE_RACK.map((f) => [f.key, f]));

// P7.2 T8 (owner): THE DRAFT SCREEN — a NEW pre-start surface, shared DOM
// phone and desktop. Seven cards up, tap toggles a pick, five max; CONFIRM
// arms at exactly five. Styled on the pre-start overlay's own P.btn idiom
// (P.slot's build-bar card, ~44px touch target both platforms).
function DraftScreen({ cards, onConfirm }) {
  const [picked, setPicked] = useState([]);
  const toggle = (k) => {
    if (picked.includes(k)) { setPicked(picked.filter((x) => x !== k)); return; }
    if (picked.length >= 5) return;
    setPicked([...picked, k]);
  };
  return (
    <div style={P.ovl}>
      <style>{`@keyframes cs-deal { from { opacity: 0; transform: translate(-16px, 12px) rotate(-8deg) scale(0.85); } to { opacity: 1; transform: var(--restT, none); } }`}</style>
      <div style={{ fontSize: 20, letterSpacing: 3, color: "#9fdcff", marginBottom: 4 }}>THE OPENING DRAFT</div>
      <CrateChip label="THE CONVOY" icon="⚒" open={true} style={{ marginBottom: 6 }} />
      <div style={{ fontSize: 12, opacity: 0.85, maxWidth: 460, lineHeight: 1.6, marginBottom: 14 }}>
        Seven cards dealt — units and plans together. Pick five, free.
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 8, maxWidth: 520, marginBottom: 14 }}>
        {cards.map((c, ci) => {
          const it = PALETTE_BY_KEY[c.k];
          const on = picked.includes(c.k);
          return (
            <StockTag key={c.k} data-draft-card={c.k} data-draft-kind={c.plan ? "plan" : "unit"}
              tilt={ci % 2 ? 1.5 : -2} delay={(ci * 0.06) + "s"}
              onClick={() => toggle(c.k)}
              style={{ minWidth: 88, minHeight: 56, borderColor: on ? "#2f7a44" : "#8f8768", background: on ? "#d3d6a8" : "#cfc6a5" }}>
              <div style={{ fontSize: 16 }}>{it ? it.icon : "?"}</div>
              <div>{it ? it.label : c.k}</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: c.plan ? "#31556a" : "#7a5a1e" }}>{c.plan ? "PLAN" : "UNIT"}</div>
            </StockTag>
          );
        })}
      </div>
      <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 10 }}>PICKED {picked.length} OF 5</div>
      <button data-draft-confirm disabled={picked.length !== 5}
        style={{ ...P.btn, fontSize: 15, padding: "10px 26px", minHeight: 44, minWidth: 44, borderColor: picked.length === 5 ? "#4aff8c" : "#48515f", color: picked.length === 5 ? "#4aff8c" : "#e6ebf1", opacity: picked.length === 5 ? 1 : 0.55 }}
        onClick={() => onConfirm(cards.filter((c) => picked.includes(c.k)))}>
        FIELD THESE FIVE
      </button>
    </div>
  );
}

// P7.1 T5: THE BUILD TREE — one BUILD entry, three branches, SELL inside.
// Pure presentation: run.mode stays the single truth the tap layer reads.
const TREE_BRANCHES = [
  { key: "troops", label: "TROOPS", icon: "∴", match: (k) => k.startsWith("sq_") },
  { key: "buildings", label: "BUILDINGS", icon: "⌂", match: (k) => TOWER_SPECS[k] != null },
  { key: "vehicles", label: "VEHICLES", icon: "⛨", match: (k) => k.startsWith("hero_") },
];
const branchOf = (key) => { const b = TREE_BRANCHES.find((x) => x.match(key)); return b ? b.key : null; };
// mk2.28 (owner): the quartermaster's purpose lines — first war only.
const QM_LINES = { troops: "men you order", buildings: "iron that stands", vehicles: "iron that moves", foes: "targets for the bench" };
// mk2.31 (owner): THE LATTICE — rungs cut by BASE price (v5 mockup),
// bottom-up in array order, cheap→dear inside a rung. Presentation only;
// the price-family rows in specs.js are untouched and a tag never jumps
// rungs on a live price. DAVY is the hero-tier troop; the APC is rung II
// iron, not hero (owner, 2026-08-24).
const LATTICE = {
  troops: [
    { name: "I", keys: ["sq_rifles", "sq_engineers", "sq_mg", "sq_sappers"] },
    { name: "II", keys: ["sq_grenadiers", "sq_rockets", "sq_mortars"] },
    { name: "III", keys: ["sq_medics", "sq_mechanics", "sq_sniper"] },
    { name: "HERO", keys: ["sq_davy"] },
  ],
  buildings: [
    { name: "I", keys: ["mg", "gun"] },
    { name: "II", keys: ["mortar", "tesla"] },
    { name: "III", keys: ["rocket"] },
  ],
  vehicles: [
    { name: "II", keys: ["hero_apc"] },
    { name: "HERO", keys: ["hero_bison", "hero_mech"] },
  ],
  // the bench's rack, by kind — sandbox only
  foes: [
    { name: "MEN", keys: ["foe_rifle", "foe_rocket", "foe_gren", "foe_sapper", "foe_mortar", "foe_sniper", "foe_mg", "foe_eng", "foe_medic", "foe_mechanic", "foe_davy"] },
    { name: "IRON", keys: ["foe_tank", "foe_bison", "foe_apc", "foe_mech"] },
    { name: "TOWERS", keys: ["foe_t_mg", "foe_t_gun", "foe_t_mortar", "foe_t_rocket", "foe_t_tesla"] },
  ],
};

// `resume` (P1 Task 3): a PARSED save object, or null for a fresh front. The
// start screen does the async probe and the mark check (save.js's probeFront)
// and hands the data down already validated, so this mount effect stays
// synchronous — a boot that awaited storage mid-construction would be a world
// half-built for however long the read took.
export default function DepotGame({ onExit, resume = null, dev = false, seed: menuSeed = null }) {
  const canvasRef = useRef(null);
  const stateRef = useRef(null);
  // POSSESSION (P4 T1, mk0.90): the knob's screen position is pushed
  // straight to the DOM from the pointer handlers below — not React state —
  // the same discipline ContractSandbox.jsx's own joystick uses, so a drag
  // never queues a re-render.
  const joyKnobRef = useRef(null);
  // POSSESSION T4 (mk0.93): the right stick's own knob ref — same discipline
  // as joyKnobRef, a separate DOM element and a separate live drag state.
  const joyRKnobRef = useRef(null);
  // FIRE FEEDBACK (mk0.96): the FIRE button's own ref — setFireHeld paints
  // its held state straight to the DOM.
  const fireBtnRef = useRef(null);
  // P7 T2: the Bison's coax MG button — same discipline as fireBtnRef.
  const mgBtnRef = useRef(null);
  // Held in a ref, not read from props inside the effect, for the same reason
  // every other loop input is: the effect must never close over a value React
  // can change under it. Captured once, at mount.
  const resumeRef = useRef(resume);
  const menuSeedRef = useRef(menuSeed);
  const [isTouch] = useState(detectTouch);
  const [hud, setHud] = useState(HUD0);
  const [fatal, setFatal] = useState(null);
  const [runId, setRunId] = useState(0);
  const [rereadDispatch, setRereadDispatch] = useState(false);
  // mk2.28: the quartermaster's purpose lines — quiet by default; the probe
  // opens them only for a first-timer.
  const [qmQuiet, setQmQuiet] = useState(true);
  // P7.1 T5: the tree's presentation state — never the sim's business.
  const [buildOpen, setBuildOpen] = useState(false);
  const [branch, setBranch] = useState("troops");
  // mk2.31: THE FOLD — packing plays every exit animation, then the trunk's
  // onAnimationEnd unmounts. _packNext carries what stands after the fold:
  // null = all closed; a category key = switch to it. Pure presentation.
  const [packing, setPacking] = useState(false);
  const packNextRef = useRef({ next: null, closeAll: false });
  const beginPack = (next, closeAll) => {
    if (packing) return;
    // mk2.32: no lattice standing = nothing to fold — close without
    // ceremony (the trunk's onAnimationEnd is the only finisher).
    if (!branch) { setBranch(next); if (closeAll) setBuildOpen(false); return; }
    packNextRef.current = { next, closeAll };
    setPacking(true);
  };
  const finishPack = () => {
    const t = packNextRef.current;
    setPacking(false);
    setBranch(t.next);
    if (t.closeAll) setBuildOpen(false);
  };
  useEffect(() => {
    if (resumeRef.current || dev) return; // a resumed war is not a first entry; the sandbox never speaks
    let live = true;
    (async () => {
      try {
        const r = await storage.get(QM_KEY);
        if (live && !r) setQmQuiet(false);
      }
      catch (e) {}
    })();
    return () => { live = false; };
  }, []);
  // mk2.28: the quartermaster's lines go quiet for good once the first bell rings.
  useEffect(() => {
    if (hud.bell >= 1 && !qmQuiet) {
      try { storage.set(QM_KEY, "1"); } catch (e) {}
      setQmQuiet(true);
    }
  }, [hud.bell, qmQuiet]);
  const restart = () => { setFatal(null); setHud({ ...HUD0 }); setRunId((r) => r + 1); };
  // mk0.29 — THE DEAD BUTTON, diagnosed: makeEndDispatch() was called inline
  // in the render, so every HUD tick (~8Hz) handed Dispatch a brand-new
  // object. Dispatch's arming effect keys on [dispatch] and re-arms over
  // 500ms, so the timer restarted every 120ms and RETURN TO BASE never armed
  // — permanently disabled, exactly as it played. Memoized on the values the
  // card actually shows, so the reference is stable and the arm completes.
  // (The between-wave card was always fine: its dispatch is a stable object
  // carried on state.)
  const endDispatch = useMemo(
    () => (hud.gameOver || hud.victory ? makeEndDispatch({ victory: hud.victory, score: hud.score }) : null),
    [hud.gameOver, hud.victory, hud.score.pk, hud.score.pv, hud.score.ek, hud.score.ev],
  );
  // mk0.29 — leaving a live battle is a two-tap decision (the NEW CAMPAIGN
  // pattern): first tap arms, five seconds of silence disarms.
  const [menuArmed, setMenuArmed] = useState(false);
  useEffect(() => {
    if (!menuArmed) return;
    const t = setTimeout(() => setMenuArmed(false), 5000);
    return () => clearTimeout(t);
  }, [menuArmed]);
  // mk0.34 — DRAW RATE. Touch draws every other frame by default; the sim is
  // untouched either way (see the frame loop). The ref is what the loop boots
  // from — the loop effect must not re-key on this, or toggling would restart
  // the run — and the state is only the button's label. Persisted through
  // the storage door (the artifact/Pages shim behind it), NOT the localStorage the fog
  // and discipline toggles use, per the settings-restore discipline in
  // platform/autosave.js: the default writes nothing, so a saved choice can
  // never be clobbered before the async restore lands, and only a real toggle
  // saves.
  // The 30fps draw toggle is GONE (Jeff, 2026-08-12, off the mk0.50 evidence
  // run): drawing is ~5ms flat in every scenario and physics is the whole
  // cost, so halving draws bought visible stutter for ~1ms. Stale
  // "coldsnap-depot-fps" storage keys are simply ignored.

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let raf = 0, disposed = false;
    let R = null;
    try {
      // ------------------------------------------------------- THE BOOT ORDER
      // T4 (war-engine-extraction): the boot moved out to boot.js's bootWar.
      // The component resolves the seed and the resume/dev flags, calls
      // through the one door, then re-derives its own pure reads off the
      // returned war (map/town/grid are static; these are cheap).
      const RES = resumeRef.current;
      const urlSeed = parseInt(new URLSearchParams(window.location.search).get("seed"), 10);
      const seed = RES ? RES.map.seed
        : dev ? Math.floor(Date.now() % 1000000)
        : Number.isFinite(urlSeed) ? urlSeed
        : menuSeedRef.current != null ? menuSeedRef.current
        : Math.floor(Date.now() % 1000000);
      const war = bootWar({ seed, resume: RES, dev });
      const { map, field, grid, world, T, town, run } = war;
      const depotCensus = war.census, depotCensus2 = war.census2;
      const rocksLive = war.rocksLive;
      const nextApcSeq = () => ++war.seq.apc;
      const stampBag = (b, side) => bootStampBag(grid, b, side);
      const depotP = map.TOWN.find((t) => t.depot && t.team !== 2), depotE = map.TOWN.find((t) => t.depot && t.team === 2);
      const objG = grid.worldToGrid(map.OBJ_POS.x, map.OBJ_POS.z);
      const townUV = town.map((b) => { const c = map.invW(b.x, b.z); return { id: b.id, x: c.u, z: c.v, marker: b.marker, get ruined() { return b.ruined; } }; });
      const townFlagMeta = new Map(map.TOWN.map((t) => [t.id, { ny: t.ny, depot: !!t.depot, fwall: t.id.startsWith("fwall"), marker: !!t.marker }]));
      if (dev) {
        // mk2.24: THE SANDBOX OPENING — no draft, no enemy opening, no
        // commander (nothing bell-driven ever reads run.cmdr here). The war
        // starts standing, every plan unlocked, and the till is dead weight:
        // priceNow answers 0 on the bench.
        run.started = true;
        run.manifest.unlocked = PALETTE.map((p) => p.key);
      }
      let zoneAcc = 0.25; // mk1.95: the zone's own wall-time accumulator — starts due
      R = makeRenderer(canvas, world, {
        town: false, camera: "tactical", fadeDecals: true,
        // playable rim (matches buildDepotTerrain's falloff box, 60x60
        // canonical): ground/grid/decals beyond it get no geometry to
        // paint on (see renderer.js). TD/campaign/demo pass no rim.
        rim: { halfU: map.RIM_HALF_U, halfV: map.RIM_HALF_V, toCanonical: map.invW, toWorld: map.fwdU },
        // Grid-line faction tint + fog. sample() (WORLD space) drives
        // per-frame enemy visibility and the terrain fog cast; sampleUV
        // (CANONICAL space, matches T's own grid) drives the 4Hz splat-line
        // retint + terrain fog wash via R.updateTerritory().
        territory: {
          T,
          toWorld: map.fwdU,
          // VISION (mk0.73): what the screen hides now follows what your side
          // SEES, not what it holds. Binary — a spot is seen or it is not, so
          // the renderer's "seam" silhouette branch never fires again.
          sample: (x, z) => { const c = map.invW(x, z); return seenAt(T.sight, c.u, c.v, 1) ? "held" : "unheld"; },
          sampleUV: (u, v) => fogStateFor(T, u, v, 1),   // grid tint: ownership, unchanged
          // Raw signed field strength (world space), feeding the area-wash
          // alpha ramp — the ground wash still shows who HOLDS the ground,
          // which is also what build rights read.
          sampleVal: (x, z) => { const c = map.invW(x, z); return valueAt(T, c.u, c.v); },
        },
      });
      const EXT = { x: 95, z: 95 }; // square rim 90 + 5m margin; same at every rotation
      const A = makeGameAudio();
      A.setReflectors([
        ...map.ROCKS.filter((k) => k.r >= 4),
        ...map.TOWN.map((t) => ({ x: t.x, z: t.z, r: Math.max(t.nx, t.nz) * MASON.pitch * 0.6 })),
      ]);
      // T3: the stream's visible water — the canonical centerline sampled at
      // 2m, split at the causeway, widened, world-transformed, at 0.78.
      const streamRibs = [];
      if (map.STREAM) {
        let run = [];
        const flush = () => { if (run.length >= 2) streamRibs.push({ pts: run, w: map.STREAM.w + 1 }); run = []; };
        for (let u = -90; u <= 90; u += 2) {
          if (Math.abs(u - map.STREAM.bridgeU) < 3) { flush(); continue; }
          const i2 = Math.max(0, Math.min(map.STREAM.pts.length - 2, Math.floor((u + 90) / 15)));
          const a = map.STREAM.pts[i2], b = map.STREAM.pts[i2 + 1];
          const t = Math.max(0, Math.min(1, (u - a.u) / (b.u - a.u || 1)));
          const w = map.fwdU(u, a.v + (b.v - a.v) * t);
          run.push({ x: w.x, y: 0.78, z: w.z });
        }
        flush();
      }
      // rocksLive, not map.ROCKS: on a resume a ridge the war already breached
      // must not be painted back onto the ground it no longer occupies.
      R.setDressing({ rocks: rocksLive, ponds: map.PONDS, streams: streamRibs });
      R.setRoads(map.ROADS); // mk2.67: the roads painted — kept ribbons and broken ones, before any smear replays
      R.overlay.setObjective(map.OBJ_POS.x, map.OBJ_POS.z, field.heightAt(map.OBJ_POS.x, map.OBJ_POS.z));
      R.overlay.setBanners(map.SPAWN_POINTS);
      const AIM_OFF = { x: 0, z: -500 };
      // FOG toggle: visuals only (see renderer.js setFog) — default ON,
      // persisted with the same localStorage-key pattern CampaignRunner uses
      // for "coldsnap-camp-deployed". Targeting (fieldReaches in state.js,
      // a sight read since mk0.72) is untouched by this flag.
      let fogOn = true;
      try { fogOn = window.localStorage.getItem("coldsnap-depot-fog") !== "0"; } catch (e) {}
      R.setFog(fogOn);

      // FIRE DISCIPLINE toggle: CAREFUL (default) holds a tower's trigger
      // pull when its round's flight path would foul a friendly wall/tower/
      // town chunk (state.js's friendlyFouls) — FREE fires regardless, the
      // pre-Task-2 behavior. Same coldsnap-depot-* persistence pattern as
      // the FOG toggle above. Enemy fire never consults this.
      let discipline = "careful";
      try { const v = window.localStorage.getItem("coldsnap-depot-discipline"); if (v === "free" || v === "careful") discipline = v; } catch (e) {}

      // WIND toggle (mk0.95, owner's request while tuning possessed-fire
      // accuracy): OFF = dead calm — every shot's drift and hold-off zero
      // out through the one world.wind read in stepDepot. Both sides feel
      // it equally (aim fully equal, the standing law). Same persistence
      // pattern as FOG/DISCIPLINE above. Default ON.
      let windOn = true;
      try { windOn = window.localStorage.getItem("coldsnap-depot-wind") !== "0"; } catch (e) {}

      // P7.1 T3 (owner): HEALTH BARS toggle — visual only, beside FOG.
      // Same coldsnap-depot-* persistence pattern. Default ON.
      let healthOn = true;
      try { healthOn = window.localStorage.getItem("coldsnap-depot-health") !== "0"; } catch (e) {}
      R.setHealth(healthOn);

      // T3 SPLIT: presentation — nothing the sim reads. Every UI method the
      // mount hangs on the state hangs here.
      const view = {
        sellMode: false, inspectId: null,
        paused: false, speed: 1, fogOn, healthOn,
        setFog: (v) => { fogOn = v; view.fogOn = v; R.setFog(v); try { window.localStorage.setItem("coldsnap-depot-fog", v ? "1" : "0"); } catch (e) {} },
        setHealth: (v) => { healthOn = v; view.healthOn = v; R.setHealth(v); try { window.localStorage.setItem("coldsnap-depot-health", v ? "1" : "0"); } catch (e) {} },
        acc: 0, t: 0, fps: 60, fpsAcc: 0, fpsN: 0,
        hover: null, pointer: null, toasts: [], pending: null,
        hirePlace: null, // P7.2 T2: the hire's armed placement ({ key } or null)
        devSpawn: null, // mk2.25: the armed enemy-rack pick (sandbox only)
        infoKey: null, infoDoor: null, infoArmedAt: 0, // P7.1 T4: the info card's own state
        _teachQ: [], _teachIdx: 0, _teachSeen: null, // Task 3/4: the door — the queue pages by index; seen null until the load lands
        // Squads (Phase 5 Task 3): selection/order UI state. selArmedAt
        // mirrors pending's 350ms trailing-tap guard so the tap that
        // selected a squad can't double-fire an order chip.
        // buildPt0 (mk0.60): the FIRST of a build order's two taps, held here
        // until the second lands. Null whenever no build order is half-given.
        // pieOpen (COMMAND 1b, mk0.82): true while the wedge disc is on
        // screen around the selected squad/tower; a wedge tap closes it
        // (view.pieOpen = false) but an aiming order keeps the squad selected
        // so the ground stays tappable — see consumeOrderTap.
        selSquadId: null, selSquadIds: null, selArmedAt: 0, orderMode: null, buildPt0: null, pieOpen: false,
        // P7 T2: the selected vehicle's own selection/order state — the
        // squad selection fields' exact shape, one Bison at a time.
        selVehId: null, vehOrderMode: null,
        // POSSESSION T4/T5 (mk0.93/0.94): THE CARRIED RETICLE. reticleOff is
        // the reticle's offset from the possessed unit; joy is the touch
        // stick's own live drag state (DOM handlers below).
        reticleOff: null, reticleLockId: null, joy: null, joyR: null,
        linePending: null, // COMMAND T2 (mk0.84): the proposed line, awaiting accept/reject
        hudT: 0, keys: {}, sellById: null, audio: A,
        // P7.1 T1: tap = the 90° snap, hold = continuous — accumulated hold
        // time per key, read on keyup to decide tap-vs-hold.
        _rotHeld: { q: 0, e: 0 },
      };
      // T3 SPLIT: the per-tick command object (api.js's TickInput) — every
      // field the sim reads each tick that save.js never touches.
      const input = {
        // POSSESSION (P4 T1, mk0.90): { kind: "squad", id } while live, else
        // null. possessInput is the frame's world-space stick vector.
        possess: null, possessInput: null,
        // The reticle is the derived world point the guns and the red ring
        // read, recomputed every possessed frame; fireHeld/mgHeld mirror the
        // FIRE/coax button state — true while held, read once per sim tick.
        reticle: null, fireHeld: false, mgHeld: false,
        mechWant: null,
        devDummies: false, // mk2.26: THEY FIGHT by default; true = dummies (sandbox only)
        windOn, discipline,
        releasePossession: null, stepBuildLine: null, stepFoeBuildLine: null,
        feedMech: (mech, cdt) => feedMechCommands(mech, cdt),
        bellCtx: null,
      };
      // setDiscipline/setWind: dead code (never called via view.setDiscipline/
      // view.setWind anywhere in this file) — kept as view-hung methods,
      // unassigned by the T3 table since no view.setDiscipline/view.setWind read
      // exists anywhere to derive a bag from (finding, reported at landing).
      view.setDiscipline = (v) => { discipline = v; input.discipline = v; try { window.localStorage.setItem("coldsnap-depot-discipline", v); } catch (e) {} };
      view.setWind = (v) => { windOn = v; input.windOn = v; try { window.localStorage.setItem("coldsnap-depot-wind", v ? "1" : "0"); } catch (e) {} };
      // Task 3 (mk2.41): THE FIRST-ENCOUNTER DOOR. A card fires once, the
      // first time its moment comes; the war pauses while it is up (the
      // convoy idiom, in the frame loop's sdt gate). The sandbox never
      // fires one; the "*" sentinel silences the door for scripted runs.
      view.teachFire = (key) => {
        if (dev) return;
        const tc = TEACH[key];
        if (!tc || (tc.desktopOnly && isTouch)) return;
        if (!view._teachSeen || view._teachSeen.has("*") || view._teachSeen.has(key) || view._teachQ.includes(key)) return;
        view._teachQ.push(key);
      };
      view.teachNext = () => {
        const k = view._teachQ[view._teachIdx];
        if (k && view._teachSeen) {
          view._teachSeen.add(k);
          try { storage.set(CARDS_KEY, JSON.stringify({ rev: TEACH_REV, seen: [...view._teachSeen] })); } catch (e) {}
        }
        view._teachIdx++;
        if (view._teachIdx >= view._teachQ.length) { view._teachQ = []; view._teachIdx = 0; }
      };
      view.teachBack = () => { if (view._teachIdx > 0) view._teachIdx--; };
      view.teachSkip = () => {
        if (view._teachSeen) {
          for (const k of view._teachQ) view._teachSeen.add(k);
          try { storage.set(CARDS_KEY, JSON.stringify({ rev: TEACH_REV, seen: [...view._teachSeen] })); } catch (e) {}
        }
        view._teachQ = []; view._teachIdx = 0;
      };
      // The pie's teaching order — the first unseen wedge card, one per
      // open. Wedge cards shared across pies (defend, move, patrol) are
      // seen once and cover both.
      const PIE_CARDS = {
        squad: (sq) => ["defend", "move", "attack", "possess_squad", "select_all",
          ...(sq.type !== "engineers" && sq.type !== "sappers" ? ["patrol"] : []),
          ...(INFANTRY_ARMS[sq.type] ? ["structures"] : []),
          ...(sq.type === "engineers" ? ["engineer_lines"] : []),
          ...(sq.type === "sappers" ? ["sapper_lines"] : [])],
        tower: () => ["discipline", "possess_tower", "sell"],
        veh: (b) => ["defend", "move", "patrol", "escort", "tracks",
          b.kind === "mech" ? "possess_mech" : "possess_vehicle",
          ...(b.vtype === "apc" ? ["load"] : [])],
      };
      view.teachPie = (kind, thing) => {
        if (!thing || !view._teachSeen || view._teachSeen.has("*")) return;
        for (const k of PIE_CARDS[kind](thing)) view.teachFire(k);
      };
      // Task 10 (mk2.48): THE WALK — the ruled taught order. SHOW ME THE
      // FRONT fills the queue whole (seen-state deliberately not consulted:
      // the walk replays for whoever asks); the paging chrome does the rest,
      // NEXT marks each seen, SKIP the remainder, and an empty queue lands
      // back on the overlay. Touch skips the desktop-only keys card.
      const WALK = ["desktop_keys", "the_hand", "placing", "scrap", "bell", "convoy", "market", "sell", "defend", "move", "attack", "patrol", "engineer_lines", "structures", "select_all", "fog"];
      view.teachWalk = () => {
        view._teachQ = WALK.filter((k) => TEACH[k] && !(TEACH[k].desktopOnly && isTouch));
        view._teachIdx = 0;
      };
      // The seen set loads once, async, off the shim — rev mismatch resets.
      (async () => {
        let seen = [];
        try {
          const r = await storage.get(CARDS_KEY);
          const d = JSON.parse(r.value);
          if (d && Array.isArray(d.seen) && (d.rev === TEACH_REV || d.seen.includes("*"))) seen = d.seen;
        } catch (e) {}
        if (!disposed) view._teachSeen = new Set(seen);
      })();
      if (RES) R.setZoom(run.zoom);
      stateRef.current = { run, view, input };
      // P7 T10: R.setMines is a setDressing-style setter — called once here
      // at boot/restore (fresh boot: run.mines is empty, harmless), then again
      // on every lay and every trigger tick.
      R.setMines(run.mines);
      // Step 6, last: the ground remembers. Every mark where a man fell is
      // replayed through the same paint the kill handler uses, so the snow
      // comes back stained exactly as it was left. Scorch and tread
      // staining are NOT in the ledger and do not come back — the accepted
      // visual loss, stated in the plan.
      if (RES && R.smear) for (const m of RES.smears || []) R.smear(m.u, m.v, m.s, m.x, m.z);

      const toast = (txt) => { view.toasts.push({ txt, t: performance.now() / 1000 }); if (view.toasts.length > 4) view.toasts.shift(); };
      // THE LIVING MARKET (mk1.13): the live price for a bar key, falling
      // back to the base cost whenever the market cache hasn't computed yet
      // (the first second of a run). buyPaced is the once-a-second purchase
      // limiter — towers and squads only (interpretation line 3: engineer
      // line pieces are priced live but not paced).
      const priceNow = (key, base) => (dev ? 0 : run._market && run._market.player[key] != null ? run._market.player[key] : base);
      const buyPaced = () => {
        if (dev) return true;
        if (world.t - run._buyAt < 1) { toast("THE MARKET PACES YOU — one purchase a second"); return false; }
        return true;
      };
      const recomputeFlow = () => computeFlowField(grid, objG.gx, objG.gz);
      const buildAt = (gx, gz, mode) => {
        if (!grid.inBounds(gx, gz)) return;
        const cell = grid.cells[grid.idx(gx, gz)];
        if (cell.water) { toast("NO GROUND — open water"); return; }
        if (cell.blocked || cell.wallId) { toast("OCCUPIED"); return; }
        if (cell.ice) { toast("NO GROUND — frozen water"); return; }
        {
          const wp0 = grid.gridToWorld(gx, gz), c0 = map.invW(wp0.x, wp0.z);
          if (!(dev || canBuild(T, c0.u, c0.v))) { toast("GROUND NOT HELD"); return; }
        }
        const spec = mode === "wall" ? null : TOWER_SPECS[mode];
        const cost = spec ? priceNow(mode, spec.cost) : (dev ? 0 : WALL_COST); // walls: no TOWER_SPECS row, state.js owns the price
        if (run.resources < cost) { toast("NO SCRAP"); return; }
        cell.blocked = true;
        // mk1.96 (owner): the road rule EXPUNGED — a sealed map is the
        // attacker's problem; the siege flow marches it onto the wall.
        if (!buyPaced()) { cell.blocked = false; return; }
        const wp = grid.gridToWorld(gx, gz);
        const y = field.heightAt(wp.x, wp.z);
        let b;
        if (spec) {
          b = addBody(world, { kind: "tower", team: 1, mass: 0, hx: 0.8, hy: spec.hy, hz: 0.8, x: wp.x, y: y + spec.hy, z: wp.z, hp: spec.hp });
          b.towerType = mode;
          b.flagPole = true;
          // effRange cached once (Task 3): towers are static, so the
          // elevation-scaled acquisition range never changes after this.
          // Derived from the LIVE body so it matches towerShot's muzzle
          // (pos.y + hy + 0.45 = turret TOP + 0.45) and can never drift —
          // the old ground+hy+0.45 form sat a full half-height below the
          // muzzle and under-computed the elevation bonus.
          b.effRange = effRange(world, { x: b.pos.x, y: b.pos.y + b.hy + 0.45, z: b.pos.z }, spec);
        } else {
          // P1.5 T2: one wall, three welded courses (state.js owns the
          // dimensions, the hp split and the weld). The CELL owns all three;
          // cell.wallId is the BOTTOM course, because its death is what
          // releases the ground and brings the rest down.
          // mk0.55: walls are thin faces now — default broadside to the
          // enemy's advance (canonical v is the advance axis, so the long
          // axis lies along canonical u: world x when map.ORIENT is even, world
          // z when odd), and a wall built next to a wall continues its line.
          b = spawnWallCourses(world, wp.x, y, wp.z, wallOrientAt(world, wp.x, wp.z, map.ORIENT % 2))[0];
        }
        b.maxHp = b.hp;
        cell.wallId = b.id;
        cell.bTeam = b.team || 1;
        run.resources -= cost;
        run._buyAt = world.t;
        recomputeFlow();
        standDown();
      };
      // Validate-only twin of buildAt's early checks (Task 3): used to gate
      // entry into the pending-confirm flow WITHOUT mutating anything —
      // cell.blocked stays false, no scrap moves, until confirmPending()
      // below actually calls buildAt. Mirrors buildAt's checks exactly
      // (same order, same toasts) so a cell that would fail at confirm time
      // never gets this far in the first place.
      const canBuildAt = (gx, gz, mode) => {
        if (!grid.inBounds(gx, gz)) return { ok: false };
        const cell = grid.cells[grid.idx(gx, gz)];
        if (cell.water) return { ok: false, msg: "NO GROUND — open water" };
        const wp = grid.gridToWorld(gx, gz), c0 = map.invW(wp.x, wp.z);
        const spec = TOWER_SPECS[mode];
        const v = validatePlacement({
          blocked: !!(cell.blocked || cell.wallId), ice: !!cell.ice,
          held: (dev || canBuild(T, c0.u, c0.v)), resources: run.resources, cost: priceNow(mode, spec.cost),
        });
        return v.ok ? { ok: true, spec, wp } : v;
      };
      // Pending placement (Task 3): tap a buildable cell in tower mode ->
      // ghost + reach polygon + ✓/✗, armed after 350ms, no scrap spent until
      // confirmPending. Walls stay exempt (instant, via buildAt directly) —
      // a ring/confirm pair on a 5-scrap wall is meaningless (brief).
      const clearPending = () => {
        if (view.pending && view.pending.hire) { view.hirePlace = null; if (view.openManifest) view.openManifest(); }
        view.pending = null;
      };
      const startPending = (gx, gz, mode, v) => {
        const spec = v.spec, wp = v.wp;
        const y = field.heightAt(wp.x, wp.z);
        // Ghost muzzle at the TRUE turret top (ground + 2*hy + 0.45) —
        // same height buildAt's body-derived effRange and towerShot use, so
        // the preview's sightlines originate where the tower will fire from.
        const muzzle = { x: wp.x, y: y + spec.hy * 2 + 0.45, z: wp.z };
        let poly = null, ringR = 0, color = 0xff5544;
        if (mode === "tesla") {
          // aura, not a gun: plain radius, no LOS clipping, blue-white —
          // "honest about what it does" (brief).
          ringR = spec.range;
          color = 0x9fdcff;
        } else {
          // T deliberately null (playtest fix): the preview shows what the
          // tower COULD reach — terrain/solid clipping only (arcClears is
          // unconditional inside reachPolygon). Live acquisition stays
          // fog-gated (stepTowers' own fieldReaches) — the guns obey what is.
          poly = reachPolygon(world, null, muzzle, spec, 1, map.invW);
        }
        view.pending = { gx, gz, mode, wp, y, poly, ringR, color, cost: priceNow(mode, spec.cost), armedAt: world.t + PENDING_ARM_S };
      };
      // mk2.36 (owner): A PLACEMENT STANDS THE MENU DOWN — success clears
      // the armed mode and its ground tint back to plain command. Knowingly
      // reverses mk1.67's stays-armed-for-repeat ruling (owner, 2026-08-24).
      // The bench's enemy rack keeps repeat placement; refusals keep the arm.
      const standDown = () => {
        run.mode = null; view.pending = null; view.buildPt0 = null;
        setHud((h) => ({ ...h, mode: null }));
      };
      const confirmPending = () => {
        const p = view.pending;
        // mk0.27: the arm guard stays (the opening tap must not double-fire
        // as the confirm), but an early ✓ tap SAYS so instead of vanishing —
        // and leaves the pending exactly as it was, so the next tap works.
        if (!pendingArmed(p, world.t)) { if (p) toast("HOLD — ARMING"); return; }
        // P7.2 T3: the confirm ghosts — ✓ runs the REAL placer; a refusal
        // (bad ground, too far, no scrap) leaves the ghost standing.
        if (p.deal) { const n0 = view._placeQueue.length; placePick(p.wp); if (view._placeQueue.length !== n0) view.pending = null; return; }
        if (p.hire) { placeHire(p.wp); if (!view.hirePlace) view.pending = null; return; }
        if (p.hero) { if (placeHero(p.hero, p.wp)) view.pending = null; return; }
        view.pending = null;
        if (p.squad) { placeSquadAt(p.gx, p.gz, p.squad); return; }
        buildAt(p.gx, p.gz, p.mode);
      };
      // ---------------------------------------------- squads (Phase 5 Task 3)
      // Build-bar mode keys -> squad type. Prefixed (sq_mg vs mg) because the
      // MG TOWER already owns the bare "mg" mode key.
      const SQUAD_MODE = { sq_sniper: "sniper", sq_rifles: "rifles", sq_mg: "mg", sq_sappers: "sappers", sq_mortars: "mortars", sq_engineers: "engineers", sq_rockets: "rockets", sq_grenadiers: "grenadiers", sq_medics: "medics", sq_mechanics: "mechanics", sq_davy: "davy" };
      // mk1.95 (owner): hero keys are placement modes — the one law.
      const HERO_MODE = { hero_bison: "bison", hero_apc: "apc", hero_mech: "mech" };
      // The ghost's true footprint, by key — a hull its hull, the mech its
      // vetted spread, a tower its post, a squad the stand its men take.
      const ghostFp = (key) => {
        const pk = PICK_POOL.find((x) => x.key === key);
        if (!pk) return null;
        if (pk.kind === "hull") { const s = pk.vtype === "apc" ? APC : BISON; return { x: s.hx * 2, z: s.hz * 2, h: s.hy * 2 }; }
        if (pk.kind === "mech") return { x: MECH_SPREAD.hx * 2, z: MECH_SPREAD.hz * 2, h: 4.2 };
        if (pk.kind === "tower") { const s = TOWER_SPECS[pk.key]; return { x: 1.7, z: 1.7, h: s.hy * 2 }; }
        return { x: 2.2, z: 2.2, h: 1.05 };
      };
      // Infantry/sandbag placement checks: same validatePlacement gate as
      // towers (occupied/ice/held/afford) — men don't claim the grid cell
      // (no cell.blocked write, no connectivity re-check: bodies, not
      // structures), but they place by the same ground rules.
      const canPlaceInfantryAt = (gx, gz, cost) => {
        if (!grid.inBounds(gx, gz)) return { ok: false, msg: "OFF THE FIELD" };
        const cell = grid.cells[grid.idx(gx, gz)];
        if (cell.water) return { ok: false, msg: "NO GROUND — open water" };
        const wp = grid.gridToWorld(gx, gz), c0 = map.invW(wp.x, wp.z);
        const v = validatePlacement({
          blocked: !!(cell.blocked || cell.wallId), ice: !!cell.ice,
          held: (dev || canBuild(T, c0.u, c0.v)), resources: run.resources, cost,
        });
        return v.ok ? { ok: true, wp } : v;
      };
      const HOMELAND_R = 36; // provisional (F5)
      const placeSquadAt = (gx, gz, type) => {
        const price = priceNow("sq_" + type, SQUAD_SPECS[type].cost);
        const v = canPlaceInfantryAt(gx, gz, price);
        if (!v.ok) { toast(v.msg); return; }
        if (!buyPaced()) return;
        const sq = makeSquad(run.nextSquadId++, type, 1, v.wp.x, v.wp.z);
        spawnSquadMembers(world, sq);
        run.squads.push(sq);
        // COMMAND T1 (mk0.80): a placed squad comes up already selected with
        // its radial open — defend-here is already its standing order (the
        // intrinsic default, no tap needed).
        view.selSquadId = sq.id; view.selSquadIds = null; view.selArmedAt = world.t + PENDING_ARM_S; view.pieOpen = true;
        view.teachPie("squad", sq);
        run.resources -= price;
        run._buyAt = world.t;
        standDown();
      };
      // P7.1 T6 (owner): one picked unit onto the ground — vetted per kind, free
      // (the starting kit costs nothing), inside the homeland only.
      const placePick = (p) => {
        const key = view._placeQueue[0];
        const pk = PICK_POOL.find((x) => x.key === key);
        if (!pk) { view._placeQueue.shift(); return; }
        if (Math.hypot(p.x - depotP.x, p.z - depotP.z) > HOMELAND_R) { toast("TOO FAR FROM THE DEPOT"); return; }
        const g = grid.worldToGrid(p.x, p.z);
        if (!grid.inBounds(g.gx, g.gz)) { toast("OFF THE FIELD"); return; }
        const cell = grid.cells[grid.idx(g.gx, g.gz)];
        const wp = grid.gridToWorld(g.gx, g.gz);
        if (pk.kind === "squad") {
          if (cell.water || cell.ice || cell.blocked || cell.wallId) { toast("NO GROUND"); return; }
          const sq = makeSquad(run.nextSquadId++, pk.type, 1, wp.x, wp.z);
          spawnSquadMembers(world, sq);
          run.squads.push(sq);
        } else if (pk.kind === "hull") {
          if (cell.water || cell.ice || cell.blocked || cell.wallId) { toast("NO GROUND"); return; }
          const spec = pk.vtype === "apc" ? APC : BISON;
          if (!armorStable(field, wp.x, wp.z, spec)) { toast("TOO STEEP TO PARK"); return; }
          if (slotBlockedPublic(world, wp.x, wp.z, Math.hypot(spec.hx, spec.hz) + 1.0)) { toast("NO ROOM"); return; }
          const v = addBody(world, { kind: "vehicle", team: 1, mass: spec.mass, hx: spec.hx, hy: spec.hy, hz: spec.hz,
            x: wp.x, y: field.heightAt(wp.x, wp.z) + spec.hy + 0.05, z: wp.z, hp: spec.hp, friction: 0.85,
            q: heading(null, Math.atan2(-wp.x, -wp.z)) });
          v.armor = spec.armor; v.vtype = pk.vtype; v.maxHp = spec.hp;
          v.homeX = wp.x; v.homeZ = wp.z; v.sleeping = true;
          if (pk.vtype === "apc") v.apcSeq = nextApcSeq();
          v.drv = pk.vtype === "apc" ? "apc" : "armor"; v.depotDrive = "auto"; v.order = "defend"; v.tracks = "careful"; v.driver = "player";
        } else if (pk.kind === "mech") {
          if (cell.water || cell.ice || cell.blocked || cell.wallId) { toast("NO GROUND"); return; }
          if (!(armorSpread(field, wp.x, wp.z, MECH_SPREAD) < 0.28)) { toast("TOO STEEP TO PARK"); return; }
          if (slotBlockedPublic(world, wp.x, wp.z, 4.5)) { toast("NO ROOM"); return; }
          const m = buildMech(world, { x: wp.x, z: wp.z, yaw: Math.atan2(-wp.x, -wp.z), team: 1, hp: MECH.hp });
          m.thrustersOn = true; m.thrustAssist = true;
          m.hull.drv = "mech"; m.hull.order = "defend"; m.hull.tracks = "careful";
          m.hull.maxHp = MECH.hp; m.hull.homeX = wp.x; m.hull.homeZ = wp.z;
        } else { // tower — free, rights-free (territory hasn't grown), road still owed
          if (cell.water || cell.ice || cell.blocked || cell.wallId) { toast("NO GROUND"); return; }
          cell.blocked = true;
          const spec = TOWER_SPECS[pk.key];
          const b = addBody(world, { kind: "tower", team: 1, mass: 0, hx: 0.8, hy: spec.hy, hz: 0.8, x: wp.x, y: field.heightAt(wp.x, wp.z) + spec.hy, z: wp.z, hp: spec.hp });
          b.towerType = pk.key; b.flagPole = true; b.maxHp = b.hp;
          b.effRange = effRange(world, { x: b.pos.x, y: b.pos.y + b.hy + 0.45, z: b.pos.z }, spec);
          cell.wallId = b.id; cell.bTeam = 1;
          recomputeFlow();
        }
        view._placeQueue.shift();
        const next = view._placeQueue[0];
        if (next && view.openInfo) view.openInfo(next, "deal"); // P7.1 T8: the next card deals before its unit places
        setHud((h) => ({ ...h, placing: next || "done" }));
        toast(next ? "PLACED — NEXT: " + (PALETTE_BY_KEY[next] || {}).label : "ALL PLACED — TAKE COMMAND");
      };
      // Squad placement rides the tower pending-confirm flow. Sniper preview
      // is the reachPolygon fan with INFANTRY_ARMS.sniper, fog-INDEPENDENT
      // (null territory — the Phase-5 preview rule: show what he COULD see,
      // clipped by terrain/solids only; live fire stays fog-gated in
      // squadFire). Rifles/MG get a plain range ring — their reach is short
      // and omnidirectional enough that a fan reads as noise.
      const startPendingSquad = (gx, gz, mode, wp) => {
        const type = SQUAD_MODE[mode];
        const arms = INFANTRY_ARMS[type];
        const y = field.heightAt(wp.x, wp.z);
        let poly = null, ringR = 0;
        if (type === "sniper") {
          const muzzle = { x: wp.x, y: y + 1.24, z: wp.z }; // ground + 0.74 seat + 0.5 squadFire muzzle
          poly = reachPolygon(world, null, muzzle, arms, 1, map.invW);
        } else {
          // sappers carry no arms entry (no rifle) — no reach preview at all;
          // their reach is their feet.
          ringR = arms ? arms.range : 0;
        }
        view.pending = { gx, gz, mode, squad: type, wp, y, poly, ringR, color: 0xffd27a, cost: priceNow(mode, SQUAD_SPECS[type].cost), armedAt: world.t + PENDING_ARM_S }; // amber: a green fan vanishes into the held-terrain wash
      };
      // Selection: tap within 1.6m of any live member selects his squad.
      const squadAtPoint = (p) => {
        for (const sq of run.squads) {
          if (sq.ridingIn != null) continue; // P7 T4: a sealed squad is not tappable
          for (const id of sq.memberIds) {
            const u = world.byId.get(id);
            if (u && u.alive && Math.hypot(u.pos.x - p.x, u.pos.z - p.z) < TAP_SQUAD_M) return sq;
          }
        }
        return null;
      };
      const selectedSquad = () => (view.selSquadId != null ? run.squads.find((q) => q.id === view.selSquadId) || null : null);
      // P7.2 T1: the order fan-out — the SELECT ALL group when one is up,
      // else the one selected squad. Primary first; dead ids drop out.
      const selectedGroup = () => {
        if (view.selSquadIds && view.selSquadIds.length) return view.selSquadIds.map((id) => run.squads.find((q) => q.id === id)).filter(Boolean);
        const sq = selectedSquad();
        return sq ? [sq] : [];
      };
      const selectedVehicle = () => (view.selVehId != null ? world.byId.get(view.selVehId) || null : null);
      // P7 T2: the Bison's own radial orders — DEFEND is instant (mirrors
      // view.orderSquad's defend branch); MOVE/PATROL/ESCORT arm the aiming
      // mode and consumeVehOrderTap's ground/squad tap finishes them.
      view.orderVehicle = (kind) => {
        if (run.gameOver || run.victory) return;
        const v = selectedVehicle();
        if (!v || world.t < view.selArmedAt) return;
        if (kind === "defend") { v.order = "defend"; v.dest = null; v.goal = null; v._route = null; v._routeDest = null; view.vehOrderMode = null; view.buildPt0 = null; }
        else if (kind === "move" || kind === "attack" || kind === "patrol" || kind === "escort" || kind === "load") {
          if (view.vehOrderMode === kind) { view.vehOrderMode = null; view.buildPt0 = null; return; }
          view.vehOrderMode = kind; view.buildPt0 = null;
        }
      };
      // P7 T2: THE OVERRUN SAFETY toggle — CAREFUL (default) brakes for the
      // Bison's own men; FREE takes the safety off (drivers.js reads v.tracks).
      view.toggleTracks = () => {
        const v = selectedVehicle();
        if (!v || world.t < view.selArmedAt) return;
        v.tracks = (v.tracks || "careful") === "careful" ? "free" : "careful";
      };
      // P7 T4: UNLOAD — the pie's own button (only shown when the APC
      // carries riders); unloadApc (transports.js) does the real work.
      view.unloadVehicle = () => {
        const v = selectedVehicle();
        if (!v || world.t < view.selArmedAt) return;
        unloadApc(world, run.squads, v);
      };
      // POSSESSION (P7 T2): TAKE CONTROL on the Bison — same hygiene as
      // view.takeControl/view.takeControlTower: digs in (order defend, goal/route
      // cleared), hands the stick over, clears every other selection/order
      // UI state.
      view.takeControlVehicle = () => {
        const v = selectedVehicle();
        if (!v || world.t < view.selArmedAt) return;
        v.order = "defend"; v.dest = null; v.goal = null; v._route = null; v._routeDest = null;
        input.fireHeld = false; input.mgHeld = false;
        view.reticleLockId = null;
        if (v.kind === "mech") {
          // THE MECH (mk1.92): possessed as its own kind — no reticle, the
          // torso+range convention (mechAimDir/aimRange) owns the aim.
          input.possess = { kind: "mech", id: v.id };
          view.reticleOff = null; input.reticle = null;
        } else {
          input.possess = { kind: "vehicle", id: v.id };
          const pc2 = possessCenter();
          view.reticleOff = pc2 ? reclampReticle(T.sight, 1, pc2, possessSightR(), { dx: 0, dz: 6 }, map.invW) : null;
          input.reticle = pc2 && view.reticleOff ? { x: pc2.x + view.reticleOff.dx, z: pc2.z + view.reticleOff.dz } : null;
        }
        view.selVehId = null; view.vehOrderMode = null; view.selSquadId = null; view.selSquadIds = null; view.orderMode = null; view.buildPt0 = null; view.linePending = null; view.pieOpen = false;
        R.overlay.setLinePreview(false);
      };
      // Order chips (DEFEND | ATTACK). 350ms arming (selArmedAt, same
      // trailing-tap guard as pending ✓) so the selecting tap can't
      // double-fire a chip. DEFEND digs in where the men stand (anchor =
      // live-member centroid); ATTACK arms the next ground tap as dest.
      view.orderSquad = (kind) => {
        if (run.gameOver || run.victory) return;   // mk0.29: the war is over — no more orders
        const sq = selectedSquad();
        if (!sq || world.t < view.selArmedAt) return;
        if (kind === "defend") {
          for (const gsq of selectedGroup()) {
            let cx = 0, cz = 0, n = 0;
            for (const id of gsq.memberIds) { const u = world.byId.get(id); if (u && u.alive) { cx += u.pos.x; cz += u.pos.z; n++; } }
            if (n) gsq.anchor = { x: cx / n, z: cz / n };
            gsq.order = "defend"; gsq.dest = null; gsq._legTarget = null; gsq._pauseT = 0; gsq._threatSig = undefined;
            gsq._surveyPending = true;
            gsq._build = null;
          }
          view.orderMode = null; view.buildPt0 = null;
        } else if (kind === "attack" || kind === "move") {
          // mk0.28: both aiming orders arm the same "tap the ground" flow —
          // the chip only decides whether the men fight their way there.
          view.orderMode = kind; view.buildPt0 = null;
        } else if (kind === "build_bags" || kind === "build_walls") {
          // mk0.60: engineers only. The chip arms a TWO-tap flow (start, then
          // end); re-tapping the armed chip before the second point cancels it
          // cleanly, which is the only way out of a half-given order.
          if (sq.type !== "engineers") return;
          view.selSquadIds = null; // a line is one squad's job — the group narrows to the primary
          if (view.orderMode === kind) { view.orderMode = null; view.buildPt0 = null; return; }
          view.orderMode = kind; view.buildPt0 = null;
        } else if (kind === "build_mines" || kind === "build_wires") {
          // P7 T10: the sapper build gate — engineers' own two-tap shape, sappers only.
          if (sq.type !== "sappers") return;
          view.selSquadIds = null; // a line is one squad's job — the group narrows to the primary
          if (view.orderMode === kind) { view.orderMode = null; view.buildPt0 = null; return; }
          view.orderMode = kind; view.buildPt0 = null;
        } else if (kind === "patrol") {
          // COMMAND T3 (mk0.85): the same two-tap flow the build orders use —
          // no type restriction here (the pie only offers the wedge to
          // squads that aren't engineers or sappers; consumeOrderTap's
          // patrol branch trusts that, same as 2.4's build branch did with
          // its engineer guard).
          if (view.orderMode === kind) { view.orderMode = null; view.buildPt0 = null; return; }
          view.orderMode = kind; view.buildPt0 = null;
        }
      };
      // COMMAND T4 (mk0.86): STRUCTURES — an instant toggle, like DEFEND: it
      // flips squad.prefStruct and the wedge's act closes the pie AND
      // deselects (call site does the deselect, same as DEFEND's). Armed
      // types only (an INFANTRY_ARMS row) — engineers and sappers never get
      // the wedge. squadFire (state.js) reads the flag every tick; it rides
      // a save as a plain boolean (save.js's generic squad serializer).
      view.toggleStructFirst = () => {
        const sq = selectedSquad();
        if (!sq || world.t < view.selArmedAt) return;
        if (!INFANTRY_ARMS[sq.type]) return;
        const v = !sq.prefStruct;
        for (const gsq of selectedGroup()) gsq.prefStruct = v;
      };
      // P7.2 T1 (owner): SELECT ALL OF TYPE — every squad of the selected
      // type joins; one-squad results collapse back to plain selection.
      view.selectAllType = () => {
        const sq = selectedSquad();
        if (!sq || world.t < view.selArmedAt) return;
        const ids = squadIdsOfType(world, run.squads, sq.type);
        view.selSquadIds = ids.length > 1 ? ids : null;
      };

      // POSSESSION T4 (mk0.93): the possessed unit's own sight circle: a
      // squad sees with its best living eye (a sniper pair's spotter reaches
      // 46), a tower with its height. The reticle lives inside THIS circle —
      // the owner's ruling that closes the far-eyes range question.
      const possessCenter = () => {
        const P = input.possess;
        if (!P) return null;
        if (P.kind === "tower") { const b = world.byId.get(P.id); return b ? { x: b.pos.x, z: b.pos.z } : null; }
        if (P.kind === "vehicle") { const b = world.byId.get(P.id); return b ? { x: b.pos.x, z: b.pos.z } : null; }
        const sq = run.squads.find((q) => q.id === P.id);
        return sq ? { x: sq.anchor.x, z: sq.anchor.z } : null;
      };
      const possessSightR = () => {
        const P = input.possess;
        if (!P) return 0;
        if (P.kind === "tower") { const b = world.byId.get(P.id); return b ? eyeOf(b).r : 0; }
        if (P.kind === "vehicle") { const b = world.byId.get(P.id); return b ? eyeOf(b).r : 0; }
        const sq = run.squads.find((q) => q.id === P.id);
        let r = 0;
        if (sq) for (const id of sq.memberIds) { const u = world.byId.get(id); if (u && u.alive) r = Math.max(r, eyeOf(u).r); }
        return r;
      };
      // POSSESSION (P4 T1, mk0.90): TAKE CONTROL — every squad type gets the
      // wedge. Digs the squad in where it stands (defend), hands the stick
      // over, and clears every other selection/order UI state the way
      // DEFEND's own instant action does.
      view.takeControl = () => {
        const sq = selectedSquad();
        if (!sq || world.t < view.selArmedAt) return;
        sq.order = "defend"; sq.dest = null; sq._legTarget = null; sq._pauseT = 0; sq._build = null; sq._threatSig = undefined;
        input.possess = { kind: "squad", id: sq.id };
        input.possessInput = { vx: 0, vz: 0 };
        // POSSESSION HYGIENE (mk0.91 audit item A, carried to T4/T5): a
        // stale reticle or a FIRE flag stuck by a mid-hold bell release can
        // never carry into the next possession — cleared on every take, same
        // as on release; the offset is then freshly seeded 4m ahead
        // (reclampReticle legalizes any seed) and the world point derived.
        input.fireHeld = false;
        view.reticleLockId = null;
        const pc0 = possessCenter();
        view.reticleOff = pc0 ? reclampReticle(T.sight, 1, pc0, possessSightR(), { dx: 0, dz: 4 }, map.invW) : null;
        input.reticle = pc0 && view.reticleOff ? { x: pc0.x + view.reticleOff.dx, z: pc0.z + view.reticleOff.dz } : null;
        view.selSquadId = null; view.selSquadIds = null; view.orderMode = null; view.buildPt0 = null; view.linePending = null;
        R.overlay.setLinePreview(false);
      };
      // POSSESSION (P4 T3, mk0.92): TAKE CONTROL on a tower — gun towers
      // only (the tower pie's possess slot is gated on spec.fireRate > 0;
      // frost has none). No stick, no selection to clear beyond inspect.
      view.takeControlTower = (id) => {
        const b = world.byId.get(id);
        if (!b || b.kind !== "tower") return;
        input.possess = { kind: "tower", id: b.id };
        input.fireHeld = false;
        view.reticleLockId = null;
        const pc1 = possessCenter();
        view.reticleOff = pc1 ? reclampReticle(T.sight, 1, pc1, possessSightR(), { dx: 0, dz: 4 }, map.invW) : null;
        input.reticle = pc1 && view.reticleOff ? { x: pc1.x + view.reticleOff.dx, z: pc1.z + view.reticleOff.dz } : null;
        view.inspectId = null; view.pieOpen = false;
      };
      input.releasePossession = () => {
        if (!input.possess) return;
        const wasSquad = input.possess.kind === "squad";
        const sq = wasSquad ? run.squads.find((q) => q.id === input.possess.id) : null;
        // POSSESSION (P7 T2): the Bison released where you left it — back to
        // auto driving, dug in (order defend), same intrinsic default a
        // released squad gets.
        if (input.possess.kind === "vehicle") {
          const pv = world.byId.get(input.possess.id);
          if (pv && pv.alive) { pv.depotDrive = "auto"; pv.order = "defend"; pv.dest = null; pv.goal = null; }
        }
        // THE MECH (mk1.92): released back to depotDrive-less auto — the
        // driver's own goal policy (drivers.js DRIVERS.mech) resumes next
        // tick off the hull's order/dest, no ctl channel involved.
        if (input.possess.kind === "mech") {
          const pm = world.byId.get(input.possess.id);
          if (pm && pm.alive) { pm.order = "defend"; pm.dest = null; pm._route = null; pm._routeDest = null; }
          R.setTraj(null); // the ballistic preview dies with the possession
        }
        input.possess = null; input.possessInput = null;
        // POSSESSION HYGIENE (mk0.91 audit item A, carried to T4/T5): the
        // same stale-trigger clear, on every release — the reticle and its
        // offset die with the possession, fireHeld can't stick from a
        // mid-hold bell release.
        input.reticle = null; view.reticleOff = null; input.fireHeld = false; input.mgHeld = false;
        view.reticleLockId = null;
        // mk2.02: THE CONVOY WAITS (owner) — a hand dealt during the
        // possession opens the moment the possession ends.
        if (run.manifest && run.manifest.hand.length && !run.manifest.cardUp) { run.manifest.cardUp = true; run.manifest.armedAt = world.t + PENDING_ARM_S; }
        if (sq) {
          // released where you left them: dig in — the intrinsic default
          sq.order = "defend"; sq.dest = null; sq._legTarget = null; sq._threatSig = undefined;
          sq._surveyPending = true;
        }
      };

      // =================================== THE TWO-POINT BUILD LINE (P1.5 T4)
      // Tap where the line starts, tap where it ends. The squad walks to the
      // start, lays end-to-end along the line, and digs in at the far end.
      //
      // GEOMETRY, stated once because it is the whole design constraint: the
      // build grid's pitch is map.GRID_CS (2.0m) and BOTH pieces are 1.8m along
      // their long axis (a bag is 1.8 x 0.9 x 0.7; a wall course is a 1.8m-wide
      // face, WALL_HALF 0.9 / WALL_THIN 0.35). So a straight run lays pieces
      // 2.0m apart that are each 1.8m long: end-to-end bar a 0.2m joint at every
      // cell boundary — exactly the joint a hand-built line already has, since
      // both go through the same grid. The pitch is the constraint, not the
      // piece, and closing it would mean re-pitching every buildable in the game.
      //
      // ONE ROTATION FOR THE WHOLE LINE (Jeff, 2026-08-12 — this supersedes the
      // per-step "staircase" rotation the brief described). The engine's boxes
      // are axis-aligned and there is no rotated collider in this codebase, so
      // a line gets the CLOSEST LOGICAL ROTATION to its overall start->end
      // direction — its dominant axis, computed once at order time — and every
      // piece on the line is laid at that one angle. Most orders are drawn
      // axis-aligned anyway; on an off-axis order the cell path still walks the
      // true segment (4-connected, so consecutive cells always share an EDGE),
      // which puts the uniformly-rotated pieces into parallel offset runs where
      // the path sidesteps. That offset is accepted: a line of pieces all facing
      // the same way reads as one work, and alternating them at every sidestep
      // COMMAND T2 (mk0.84): THE PROPOSED LINE. The second tap of a
      // two-point order proposes; nothing walks until the owner of the tap
      // accepts. Ghost pieces skip exactly the cells laying would skip
      // (scrap aside — that is walk-time), so the preview never lies.
      const LINE_END_R = 2.5;   // m — a tap this close to an endpoint disc picks it up
      const refreshLinePreview = () => {
        const lp = view.linePending;
        if (!lp) { R.overlay.setLinePreview(false); return; }
        const pieces = linePieces(grid, field, T, lp.kind, lp.a, lp.b, map);
        lp.count = pieces.length;
        const fpPrev = run._market ? fieldPrices(run._market.counts, WALL_FIELD_COST, SANDBAG_FIELD_COST) : { wall: WALL_FIELD_COST, bag: SANDBAG_FIELD_COST };
        const mpPrev = run._minePrices || { mine: MINE_COST, wire: WIRE_COST }; // P7 T10
        lp.cost = lp.kind === "walls" ? pieces.length * fpPrev.wall
                : lp.kind === "bags" ? pieces.length * fpPrev.bag
                : lp.kind === "mines" ? pieces.length * mpPrev.mine
                : lp.kind === "wires" ? pieces.length * mpPrev.wire : 0;
        R.overlay.setLinePreview(true, {
          a: { x: lp.a.x, z: lp.a.z, y: field.heightAt(lp.a.x, lp.a.z) },
          b: { x: lp.b.x, z: lp.b.z, y: field.heightAt(lp.b.x, lp.b.z) },
          pieces,
          color: lp.kind === "walls" ? 0x9fdcff : lp.kind === "patrol" ? 0x7fd7ff : 0xffd27a,
        });
      };
      const acceptLine = () => {
        const lp = view.linePending;
        if (!lp) return;
        if (!pendingArmed(lp, world.t)) { toast("HOLD — ARMING"); return; }
        if (lp.veh != null) {
          const v = world.byId.get(lp.veh);
          view.linePending = null;
          R.overlay.setLinePreview(false);
          if (v && v.alive) {
            v._patA = { x: lp.a.x, z: lp.a.z }; v._patB = { x: lp.b.x, z: lp.b.z };
            v.order = "patrol"; v.dest = { x: lp.a.x, z: lp.a.z }; v._route = null; v._routeDest = null;
          }
          view.selVehId = null; view.vehOrderMode = null; view.buildPt0 = null;
          return;
        }
        const sq = run.squads.find((q) => q.id === lp.sq);
        view.linePending = null;
        R.overlay.setLinePreview(false);
        if (sq) {
          if (lp.kind === "patrol") {
            // COMMAND T3 (mk0.85): accept arms the loop — P7.2 T1: for the
            // whole SELECT ALL group when one proposed the line.
            const group = (lp.sqs && lp.sqs.length ? lp.sqs : [lp.sq]).map((id) => run.squads.find((q) => q.id === id)).filter(Boolean);
            for (const gsq of group) {
              gsq._patA = { x: lp.a.x, z: lp.a.z };
              gsq._patB = { x: lp.b.x, z: lp.b.z };
              gsq.order = "patrol";
              gsq.dest = { x: lp.a.x, z: lp.a.z };   // walk to the near end first
              gsq._legTarget = null; gsq._pauseT = 0; gsq._cohesionHoldT = 0; gsq._build = null;
            }
          }
          else startBuildLine(grid, sq, lp.kind, lp.a, lp.b, toast);
        }
        view.selSquadId = null; view.orderMode = null; view.buildPt0 = null; view.selSquadIds = null;
      };
      const rejectLine = () => {
        view.linePending = null;
        R.overlay.setLinePreview(false);
        view.selSquadId = null; view.orderMode = null; view.buildPt0 = null; view.selSquadIds = null;
        view.selVehId = null; view.vehOrderMode = null;
      };
      view.acceptLine = acceptLine; view.rejectLine = rejectLine;
      // The driver, once per sim tick per squad carrying a job.
      const layCtx = { stampBag, recomputeFlow, objG, setMines: (m) => R.setMines(m) };
      input.stepBuildLine = (sq) => stepBuildLine(world, grid, field, T, run, sq, layCtx, toast, map);
      // P7.1 T7: the enemy's build driver — same machinery, his books. The
      // façade carries reg.scrap through run-shaped fields and settles after.
      input.stepFoeBuildLine = (sq) => {
        const SE = { resources: run.reg.scrap, mines: run.mines, sandbagOrient: 0, _market: run._market, _minePrices: run._minePrices };
        stepBuildLine(world, grid, field, T, SE, sq, { stampBag, recomputeFlow, objG, setMines: (m) => R.setMines(m) }, () => {}, map);
        run.reg.scrap = SE.resources;
      };
      // The order flow's ground taps, in one place. tapAt calls this with the
      // point its ray hit; the debug harness calls it with a world point
      // directly, so both drive the identical code.
      const consumeOrderTap = (p) => {
        const om = view.orderMode;
        if (!om) return false;
        const osq = selectedSquad();
        // OFF-MAP CLAMP (mk0.50): the tap ray hits the painted ground well past
        // the playable rim, and a squad ordered out there walks off the field
        // and never arrives. BOTH points of a build order clamp through here
        // too — this is THE site where a ground tap becomes a destination.
        const d = map.clampToRim(p.x, p.z);
        // T3: open water takes no orders — the river is ground for nobody.
        if (map.streamAt(d.x, d.z)) { toast("OPEN WATER — find the crossing"); return true; }
        if (om === "attack" || om === "move") {
          for (const gsq of selectedGroup()) { gsq.order = om; gsq.dest = { x: d.x, z: d.z }; gsq._legTarget = null; gsq._pauseT = 0; gsq._build = null; }
          view.orderMode = null;
          // COMMAND 1b (mk0.82): the order's final ground tap landed — the
          // squad is released (deselected), same as an instant order.
          view.selSquadId = null; view.selSquadIds = null;
          return true;
        }
        if (om === "build_bags" || om === "build_walls") {
          if (!osq || osq.type !== "engineers") { view.orderMode = null; view.buildPt0 = null; view.selSquadId = null; view.selSquadIds = null; return true; }
          if (!view.buildPt0) { view.buildPt0 = { x: d.x, z: d.z }; toast("LINE START — TAP THE FAR END"); return true; }
          // COMMAND T2 (mk0.84): the second tap PROPOSES — view.linePending goes
          // up, the squad stays selected, and nothing walks until acceptLine.
          view.linePending = { kind: om === "build_walls" ? "walls" : "bags", sq: osq.id,
            a: { x: view.buildPt0.x, z: view.buildPt0.z }, b: { x: d.x, z: d.z },
            moving: null, armedAt: world.t + PENDING_ARM_S };
          view.buildPt0 = null; view.orderMode = null;
          refreshLinePreview();
          return true;
        }
        // P7 T10: MINES and WIRES — the identical two-tap shape build_bags/
        // build_walls use, sapper-gated (the type check mirrors the
        // engineer build gate above).
        if (om === "build_mines" || om === "build_wires") {
          if (!osq || osq.type !== "sappers") { view.orderMode = null; view.buildPt0 = null; view.selSquadId = null; view.selSquadIds = null; return true; }
          if (!view.buildPt0) { view.buildPt0 = { x: d.x, z: d.z }; toast("LINE START — TAP THE FAR END"); return true; }
          view.linePending = { kind: om === "build_mines" ? "mines" : "wires", sq: osq.id,
            a: { x: view.buildPt0.x, z: view.buildPt0.z }, b: { x: d.x, z: d.z },
            moving: null, armedAt: world.t + PENDING_ARM_S };
          view.buildPt0 = null; view.orderMode = null;
          refreshLinePreview();
          return true;
        }
        if (om === "patrol") {
          // COMMAND T3 (mk0.85): same shape as the build branch above, kind
          // "patrol", no engineer guard — every squad type the pie offers
          // this wedge to (not engineers, not sappers) rides it.
          if (!osq) { view.orderMode = null; view.buildPt0 = null; view.selSquadId = null; view.selSquadIds = null; return true; }
          if (!view.buildPt0) { view.buildPt0 = { x: d.x, z: d.z }; toast("PATROL START — TAP THE FAR END"); return true; }
          view.linePending = { kind: "patrol", sq: osq.id, sqs: selectedGroup().map((q) => q.id),
            a: { x: view.buildPt0.x, z: view.buildPt0.z }, b: { x: d.x, z: d.z },
            moving: null, armedAt: world.t + PENDING_ARM_S };
          view.buildPt0 = null; view.orderMode = null;
          refreshLinePreview();
          return true;
        }
        return false;
      };
      // P7 T2: the Bison's own ground taps — mirrors consumeOrderTap's
      // shape. ESCORT catches a squad tap here (before squad selection would
      // steal it — tapAt's order matters).
      const consumeVehOrderTap = (p) => {
        const om = view.vehOrderMode;
        if (!om) return false;
        const v = selectedVehicle();
        if (!v) { view.vehOrderMode = null; view.selVehId = null; view.buildPt0 = null; return true; }
        if (om === "escort") {
          const sq = squadAtPoint(p);
          if (!sq) { toast("TAP A SQUAD TO ESCORT"); return true; }
          v.order = "escort"; v.escortId = sq.id; v.dest = null; v.goal = null; v._route = null; v._routeDest = null;
          view.vehOrderMode = null; view.selVehId = null;
          return true;
        }
        // P7 T4: LOAD — tap a squad, it walks to the ramp and boards.
        if (om === "load") {
          if (v.vtype !== "apc") { view.vehOrderMode = null; return true; }
          const sq = squadAtPoint(p);
          if (!sq) { toast("TAP A SQUAD TO LOAD"); return true; }
          if (input.possess && input.possess.kind === "squad" && input.possess.id === sq.id) { toast("RELEASE THEM FIRST"); return true; }
          let live = 0;
          for (const id of sq.memberIds) { const u = world.byId.get(id); if (u && u.alive) live++; }
          const free = APC.seats - apcSeated(world, run.squads, v.apcSeq);
          if (live > free) { toast("NO ROOM — " + free + (free === 1 ? " SEAT" : " SEATS")); return true; }
          sq._boarding = v.apcSeq; sq._build = null;
          view.vehOrderMode = null; view.selVehId = null;
          return true;
        }
        const d = map.clampToRim(p.x, p.z);
        if (map.streamAt(d.x, d.z)) { toast("OPEN WATER — find the crossing"); return true; }
        if (om === "move") {
          v.order = "move"; v.dest = { x: d.x, z: d.z }; v._route = null; v._routeDest = null;
          view.vehOrderMode = null; view.selVehId = null;
          return true;
        }
        if (om === "attack") {   // mk2.88: MOVE's own tap, the fighting order
          v.order = "attack"; v.dest = { x: d.x, z: d.z }; v._route = null; v._routeDest = null;
          view.vehOrderMode = null; view.selVehId = null;
          return true;
        }
        if (om === "patrol") {   // the two-point confirm law, verbatim from squads
          if (!view.buildPt0) { view.buildPt0 = { x: d.x, z: d.z }; toast("PATROL START — TAP THE FAR END"); return true; }
          view.linePending = { kind: "patrol", veh: v.id, a: { x: view.buildPt0.x, z: view.buildPt0.z }, b: { x: d.x, z: d.z }, moving: null, armedAt: world.t + PENDING_ARM_S };
          view.buildPt0 = null; view.vehOrderMode = null;
          refreshLinePreview();
          return true;
        }
        return false;
      };
      const sellAt = (gx, gz) => {
        if (!grid.inBounds(gx, gz)) return;
        const cell = grid.cells[grid.idx(gx, gz)];
        const id = cell.wallId;
        if (!id || !world.byId.has(id)) { toast("NOTHING HERE"); return; }
        const b = world.byId.get(id);
        const refund = b.kind === "tower" ? Math.floor(TOWER_SPECS[b.towerType].cost * 0.6) : 3;
        // ONE cell, ONE structure — and since P1.5 T2 a wall is three courses
        // standing on that cell, so selling takes the whole stack. Matched by
        // FOOTPRINT (which cell each body stands on), never by id: ids do not
        // survive a save/resume, a wall never moves, and this is exactly the
        // rule the restore path re-claims cells by.
        const stack = b.kind === "wall"
          ? world.bodies.filter((w) => {
            if (w.kind !== "wall") return false;
            const wg = grid.worldToGrid(w.pos.x, w.pos.z);
            return wg.gx === gx && wg.gz === gz;
          })
          : [b];
        for (const s of stack) {
          forgetWelds(world, s);
          world.byId.delete(s.id);
          const bi = world.bodies.indexOf(s);
          if (bi >= 0) world.bodies.splice(bi, 1);
        }
        cell.wallId = null; cell.blocked = false; cell.bTeam = 0;
        run.resources += refund;
        recomputeFlow();
        toast("+" + refund + " scrap");
      };
      const sellById = (id) => {
        const b = world.byId.get(id);
        if (!b) return;
        const g = grid.worldToGrid(b.pos.x, b.pos.z);
        sellAt(g.gx, g.gz);
        view.inspectId = null;
      };
      view.sellById = sellById;
      // COMMAND T1 (mk0.80): per-tower fire discipline toggle — the tower
      // radial's CAREFUL/FREE slot. Mirrors stepTowers's own fallback chain.
      view.setTowerDiscipline = (id) => {
        const b = world.byId.get(id);
        if (!b || b.kind !== "tower") return;
        b.discipline = (b.discipline || discipline || "careful") === "careful" ? "free" : "careful";
      };
      view.confirmPending = confirmPending;
      view.clearPending = clearPending;
      view.rotate = (d) => R.rotateStep(d);
      const onStructureLost = (b) => {
        for (const c of grid.cells) if (c.wallId === b.id) { c.wallId = null; c.blocked = false; c.bTeam = 0; }
        recomputeFlow();
      };
      const onRuin = () => recomputeFlow();

      const toNdc = (cx, cy) => {
        const r = canvas.getBoundingClientRect();
        return { x: ((cx - r.left) / Math.max(1, r.width)) * 2 - 1, y: -(((cy - r.top) / Math.max(1, r.height)) * 2 - 1) };
      };
      // pickHeightAt (mound-ray smallfix): height of the RENDERED terrain —
      // the same triangulated PlaneGeometry surface the player sees (two
      // triangles per grid quad, split on the b–d anti-diagonal, matching
      // THREE.PlaneGeometry's index order; syncTerrain maps vertex (i,j) to
      // F.h[j*n+i] 1:1) — NOT field.heightAt's bilinear patch. On convex
      // relief (the depot mound's crest) the bilinear surface bulges ABOVE
      // the drawn triangles, so a tap ray grazing the crest hit a phantom
      // bulge the player can't see and selected a nearer cell than the one
      // visibly under the cursor. Picking against the drawn surface makes
      // taps land where they look. Sim/physics still use field.heightAt —
      // this is view-space picking only.
      const pickHeightAt = (x, z) => {
        const F = field, fx = (x + F.half) / F.cs, fz = (z + F.half) / F.cs;
        let i = Math.floor(fx), j = Math.floor(fz);
        i = Math.max(0, Math.min(F.n - 2, i)); j = Math.max(0, Math.min(F.n - 2, j));
        const tx = Math.max(0, Math.min(1, fx - i)), tz = Math.max(0, Math.min(1, fz - j));
        const h00 = F.h[j * F.n + i], h10 = F.h[j * F.n + i + 1];
        const h01 = F.h[(j + 1) * F.n + i], h11 = F.h[(j + 1) * F.n + i + 1];
        return tx + tz <= 1
          ? h00 + tx * (h10 - h00) + tz * (h01 - h00)
          : h11 + (1 - tx) * (h01 - h11) + (1 - tz) * (h10 - h11);
      };
      const groundPoint = (cx, cy) => {
        const nd = toNdc(cx, cy);
        const cb = R.camBasis, cp = R.cameraPos();
        const hw = cb.halfW(), hh = cb.halfH();
        const ox = cp.x + cb.right.x * nd.x * hw + cb.up.x * nd.y * hh;
        const oy = cp.y + cb.right.y * nd.x * hw + cb.up.y * nd.y * hh;
        const oz = cp.z + cb.right.z * nd.x * hw + cb.up.z * nd.y * hh;
        const f = cb.fwd;
        let lo = 0, hi = 400;
        let prev = 0, found = -1;
        // 0.75m march (was 1.5): a thin crest wholly inside one step would be
        // skipped and the tap would land BEHIND the visible ridge.
        for (let t = 0; t <= 400; t += 0.75) {
          const x = ox + f.x * t, y2 = oy + f.y * t, z = oz + f.z * t;
          if (y2 <= pickHeightAt(x, z)) { found = t; lo = prev; hi = t; break; }
          prev = t;
        }
        if (found < 0) return null;
        for (let i = 0; i < 12; i++) {
          const mid = (lo + hi) / 2;
          const x = ox + f.x * mid, y2 = oy + f.y * mid, z = oz + f.z * mid;
          if (y2 <= pickHeightAt(x, z)) hi = mid; else lo = mid;
        }
        const t = (lo + hi) / 2;
        return { x: ox + f.x * t, z: oz + f.z * t };
      };
      const tapAt = (cx, cy) => {
        // P7.1 T6: PLACE MODE — pre-start ground taps put the picks down.
        if (!run.started && view._placeQueue && view._placeQueue.length) {
          if (view.infoKey) return; // P7.1 T8: the card is up — read it first (PLACE IT closes it)
          const p0 = groundPoint(cx, cy);
          // P7.2 T3 (owner): the tap sets or MOVES a confirm ghost — nothing
          // fields until the ✓. Wall-clock arming: the sim is frozen here.
          if (p0) view.pending = { deal: view._placeQueue[0], wp: { x: p0.x, z: p0.z }, y: field.heightAt(p0.x, p0.z), poly: null, ringR: 0, color: 0x4aff8c, cost: 0, wallArm: true, armedAtWall: performance.now() / 1000 + PENDING_ARM_S, fp: ghostFp(view._placeQueue[0]) };
          return;
        }
        // mk2.25: an armed enemy-rack pick owns every ground tap — repeated
        // taps keep placing until the rack button is tapped again.
        if (dev && view.devSpawn) {
          const pd = groundPoint(cx, cy);
          if (pd) devSpawnAt(pd);
          return;
        }
        if (!run.started || run.gameOver || run.victory) return;
        // P7.2 T2: THE HIRE'S TAP — an armed placement owns the ground tap.
        if (view.hirePlace) {
          const ph = groundPoint(cx, cy);
          // P7.2 T3 (owner): the tap sets or MOVES the confirm ghost.
          if (ph) view.pending = { hire: view.hirePlace.key, wp: { x: ph.x, z: ph.z }, y: field.heightAt(ph.x, ph.z), poly: null, ringR: 0, color: 0x7dffa8, cost: priceNow(view.hirePlace.key, (PALETTE_BY_KEY[view.hirePlace.key] || { cost: 10 }).cost), armedAt: world.t + PENDING_ARM_S, fp: ghostFp(view.hirePlace.key) };
          return;
        }
        // any tap on the canvas while a placement is pending resolves it —
        // confirm/cancel are the ✓/✗ HTML buttons (separate DOM elements,
        // so their own onClick fires instead of this canvas handler); a tap
        // that reaches here is by definition "elsewhere" and cancels.
        // mk0.27: only while the ✓/✗ pair is actually ON SCREEN. Panned off
        // the viewport, the pending is invisible, and eating the player's
        // next ground tap to "resolve" it is a stolen tap.
        if (canvasTapConsumesPending(view.pending, view.pendingScreen, canvas.getBoundingClientRect())) { clearPending(); return; }
        if (view.pending) clearPending();
        const p = groundPoint(cx, cy);
        if (!p) { view.inspectId = null; return; }
        // mk1.99: TAP TO AIM — while possessed, a ground tap JUMPS the
        // reticle: clamped to the sight circle (steerReticle's own
        // arithmetic), refused on dark ground (the reticle stays put), and
        // the loop's sticky snap lands any nearby lock. Fire stays on the
        // trigger. Retires the mk0.93 "taps do nothing" ruling (owner,
        // 2026-08-21). The mech keeps no reticle.
        if (input.possess) {
          if (input.possess.kind === "mech") return;
          const rc0 = possessCenter();
          if (rc0 && view.reticleOff) {
            let dx0 = p.x - rc0.x, dz0 = p.z - rc0.z;
            const rR0 = possessSightR(), d0 = Math.hypot(dx0, dz0);
            if (d0 > rR0 && d0 > 1e-9) { dx0 *= rR0 / d0; dz0 *= rR0 / d0; }
            const cc0 = map.invW(rc0.x + dx0, rc0.z + dz0);
            if (seenAt(T.sight, cc0.u, cc0.v, 1)) {
              view.reticleOff = { dx: dx0, dz: dz0 };
              input.reticle = { x: rc0.x + dx0, z: rc0.z + dz0 };
            }
          }
          return;
        }
        // COMMAND T2 (mk0.84): while a proposed line is up, ground taps belong
        // to it — tap an endpoint disc to pick it up, tap ground to re-place a
        // picked-up endpoint. Accept/reject (the buttons) are the only exits;
        // a stray tap can never fire the order or steal the selection.
        if (view.linePending) {
          const lp = view.linePending;
          if (lp.moving) {
            const m = map.clampToRim(p.x, p.z);
            lp[lp.moving] = { x: m.x, z: m.z };
            lp.moving = null;
            lp.armedAt = world.t + PENDING_ARM_S;
            refreshLinePreview();
          } else if (Math.hypot(p.x - lp.a.x, p.z - lp.a.z) < LINE_END_R) { lp.moving = "a"; toast("TAP THE NEW START"); }
          else if (Math.hypot(p.x - lp.b.x, p.z - lp.b.z) < LINE_END_R) { lp.moving = "b"; toast("TAP THE NEW END"); }
          return;
        }
        // Squad order flow: an armed ATTACK/MOVE consumes this ground tap as the
        // destination (flag marker renders at dest until arrival); an armed
        // BUILD consumes TWO — the line's start, then its far end (mk0.60).
        if (consumeOrderTap(p)) return;
        if (consumeVehOrderTap(p)) return;
        // P7.2 T1: THE TAP CYCLES. Every pickable thing near the tap —
        // squads, hulls, towers (towers only in plain command, so a build
        // tap is never stolen by the tower next door; the exact-cell tower
        // tap below keeps today's behavior in every mode) — nearest first;
        // tapping again hands the pick to the next one around.
        const cands = [];
        for (const sq of run.squads) {
          if (sq.ridingIn != null) continue; // P7 T4: a sealed squad is not tappable
          let dBest = Infinity;
          for (const id of sq.memberIds) {
            const u = world.byId.get(id);
            if (u && u.alive) { const d2 = Math.hypot(u.pos.x - p.x, u.pos.z - p.z); if (d2 < dBest) dBest = d2; }
          }
          if (dBest <= TAP_SQUAD_M) cands.push({ key: "sq:" + sq.id, d: dBest });
        }
        for (const b of world.bodies) {
          if (!b.alive || b.team !== 1) continue;
          if (b.kind === "vehicle" || b.kind === "mech") {
            const d2 = Math.hypot(b.pos.x - p.x, b.pos.z - p.z);
            if (d2 <= TAP_HULL_M) cands.push({ key: "veh:" + b.id, d: d2 });
          } else if (b.kind === "tower" && !run.mode && !view.sellMode) {
            const d2 = Math.hypot(b.pos.x - p.x, b.pos.z - p.z);
            if (d2 <= TAP_TOWER_M) cands.push({ key: "twr:" + b.id, d: d2 });
          }
        }
        const curSel = view.selSquadId != null ? "sq:" + view.selSquadId
          : view.selVehId != null ? "veh:" + view.selVehId
          : view.inspectId != null && cands.some((c) => c.key === "twr:" + view.inspectId) ? "twr:" + view.inspectId : null;
        const pick = nextPick(cands, curSel);
        if (pick) {
          const id = +pick.key.slice(pick.key.indexOf(":") + 1);
          view.selSquadId = null; view.selSquadIds = null; view.selVehId = null; view.inspectId = null;
          view.orderMode = null; view.vehOrderMode = null; view.buildPt0 = null;
          view.selArmedAt = world.t + PENDING_ARM_S; view.pieOpen = true;
          if (pick.key.startsWith("sq:")) view.selSquadId = id;
          else if (pick.key.startsWith("veh:")) view.selVehId = id;
          else view.inspectId = id;
          if (pick.key.startsWith("sq:")) view.teachPie("squad", run.squads.find((q) => q.id === id));
          else if (pick.key.startsWith("veh:")) view.teachPie("veh", world.byId.get(id));
          else view.teachPie("tower", world.byId.get(id));
          return;
        }
        if (view.selSquadId != null) { view.selSquadId = null; view.selSquadIds = null; view.orderMode = null; view.buildPt0 = null; view.pieOpen = false; return; }
        if (view.selVehId != null) { view.selVehId = null; view.vehOrderMode = null; view.buildPt0 = null; view.pieOpen = false; return; }
        const g = grid.worldToGrid(p.x, p.z);
        if (!grid.inBounds(g.gx, g.gz)) { view.inspectId = null; return; }
        const cell2 = grid.cells[grid.idx(g.gx, g.gz)];
        if (view.sellMode) { view.inspectId = null; sellAt(g.gx, g.gz); return; }
        if (cell2.wallId && world.byId.has(cell2.wallId)) { view.inspectId = cell2.wallId; view.pieOpen = true; return; }
        view.inspectId = null;
        if (SQUAD_MODE[run.mode]) {
          const v = canPlaceInfantryAt(g.gx, g.gz, priceNow(run.mode, SQUAD_SPECS[SQUAD_MODE[run.mode]].cost));
          if (!v.ok) { toast(v.msg); return; }
          startPendingSquad(g.gx, g.gz, run.mode, v.wp);
          return;
        }
        if (HERO_MODE[run.mode]) {
          const price = priceNow(run.mode, PALETTE_BY_KEY[run.mode].cost);
          const v = canPlaceInfantryAt(g.gx, g.gz, price);
          if (!v.ok) { toast(v.msg); return; }
          view.pending = { hero: run.mode, wp: v.wp, y: field.heightAt(v.wp.x, v.wp.z), poly: null, ringR: 0, color: 0x9fdcff, cost: price, armedAt: world.t + PENDING_ARM_S, fp: ghostFp(run.mode) };
          return;
        }
        if (run.mode && TOWER_SPECS[run.mode]) {
          const v = canBuildAt(g.gx, g.gz, run.mode);
          if (!v.ok) { toast(v.msg); return; }
          startPending(g.gx, g.gz, run.mode, v);
        }
      };

      const pointers = new Map();
      let pinchD0 = 0, pinchZ0 = 1, pinchA = 0, dragTotal = 0, downPt = null;
      const onPointerDown = (e) => {
        A.ensure();
        // DESKTOP FIRE (P6 T12, mk1.21, owner's playtest): while possessed,
        // the left mouse button IS the trigger — held, it volleys like the
        // phone FIRE button; the click never becomes a pan or a tap. The
        // possession release paths already clear fireHeld.
        // DESKTOP COAX (P7 T2, owner's ruling): while possessing the Bison,
        // the right mouse button IS the coax trigger — held, like FIRE/MG.
        // Checked before the left-button main-gun branch so a right-click
        // never falls through to it.
        if (input.possess && input.possess.kind === "vehicle" && e.pointerType === "mouse" && e.button === 2) {
          // P7 T4: the APC has no coax-and-main-gun split — one gun, FIRE
          // alone. A right-click on the APC does nothing (consumed, not
          // captured — never falls through to a pan/tap).
          const pv0 = world.byId.get(input.possess.id);
          if (!pv0 || pv0.vtype !== "apc") {
            canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
            input.mgHeld = true;
          }
          return;
        }
        if (input.possess && e.pointerType === "mouse" && e.button === 0) {
          canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
          input.fireHeld = true;
          return;
        }
        canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.size === 1) { dragTotal = 0; downPt = { x: e.clientX, y: e.clientY }; }
        else if (pointers.size === 2) {
          const ps = [...pointers.values()];
          pinchD0 = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y);
          pinchZ0 = run.zoom;
          pinchA = Math.atan2(ps[1].y - ps[0].y, ps[1].x - ps[0].x); // P7.1 T1: the twist's running angle
          downPt = null;
        }
      };
      const onPointerMove = (e) => {
        view.pointer = { x: e.clientX, y: e.clientY };
        const pt = pointers.get(e.pointerId);
        if (!pt) return;
        const dx = e.clientX - pt.x, dy = e.clientY - pt.y;
        pt.x = e.clientX; pt.y = e.clientY;
        if (pointers.size === 1) {
          dragTotal += Math.hypot(dx, dy);
          if (dragTotal > 12) {
            const cb = R.camBasis;
            const r = canvas.getBoundingClientRect();
            const kx = (2 * cb.halfW()) / Math.max(1, r.width);
            const ky = (2 * cb.halfH()) / Math.max(1, r.height);
            run.focus.x -= cb.right.x * dx * kx - cb.up.x * dy * ky;
            run.focus.z -= cb.right.z * dx * kx - cb.up.z * dy * ky;
            run.focus.x = Math.max(-EXT.x, Math.min(EXT.x, run.focus.x));
            run.focus.z = Math.max(-EXT.z, Math.min(EXT.z, run.focus.z));
          }
        } else if (pointers.size === 2 && pinchD0 > 0) {
          const ps = [...pointers.values()];
          const d = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y);
          run.zoom = Math.max(0.5, Math.min(2.6, pinchZ0 * (d / pinchD0)));
          R.setZoom(run.zoom);
          // P7.1 T1: TWO-FINGER ROTATION — the twist between the touches
          // steers the yaw. Incremental with wrap, so fingers crossing the
          // ±π seam never jump the view.
          const a = Math.atan2(ps[1].y - ps[0].y, ps[1].x - ps[0].x);
          let da = a - pinchA;
          while (da > Math.PI) da -= 2 * Math.PI;
          while (da < -Math.PI) da += 2 * Math.PI;
          pinchA = a;
          R.rotateBy(da);
        }
      };
      const onPointerUp = (e) => {
        if (e.pointerType === "mouse" && e.button === 2 && input.mgHeld) { input.mgHeld = false; pointers.delete(e.pointerId); return; }
        if (input.fireHeld && e.pointerType === "mouse") { input.fireHeld = false; pointers.delete(e.pointerId); return; }
        pointers.delete(e.pointerId);
        if (downPt && dragTotal <= 12 && pointers.size === 0) tapAt(e.clientX, e.clientY);
        if (pointers.size < 2) pinchD0 = 0;
        if (pointers.size === 0) downPt = null;
      };
      const onWheel = (e) => {
        e.preventDefault();
        run.zoom = Math.max(0.5, Math.min(2.6, run.zoom * (e.deltaY > 0 ? 0.9 : 1.11)));
        R.setZoom(run.zoom);
      };
      // P7.1 T1: tap = the 90° snap, hold = continuous. The frame loop
      // accumulates hold time and rotates past the window; keyup reads the
      // accumulated time to decide tap-vs-hold.
      const ROT_HOLD_S = 0.22, ROT_SPEED = 1.6; // provisional (F5)
      const onKey = (e, down) => { view.keys[e.key.toLowerCase()] = down; };
      const kd = (e) => {
        A.ensure();
        if (e.key === "m" || e.key === "M") { A.setMuted(!A.muted); setHud((h) => ({ ...h, muted: A.muted })); }
        // THE MECH (mk1.92): desktop one-shot triggers, active only while a
        // mech is possessed — FIRE is the held left-click (already generic
        // to any possession, above); these are edge-triggered here exactly
        // like MechRange's own keydown bindings.
        if (!e.repeat && input.possess && input.possess.kind === "mech") {
          const k = e.key.toLowerCase();
          if (k === "v" || k === "b" || k === "c" || k === "t") {
            const w = input.mechWant || (input.mechWant = {});
            if (k === "v") w.msl = true;
            else if (k === "b") w.brg = true;
            else if (k === "c") w.punt = true;
            else if (k === "t") w.face = true;
          }
        }
        onKey(e, true);
      };
      const ku = (e) => {
        const k = e.key.toLowerCase();
        if (k === "q" || k === "e") {
          if ((view._rotHeld[k] || 0) <= ROT_HOLD_S) R.rotateStep(k === "q" ? -1 : 1);
          view._rotHeld[k] = 0;
        }
        onKey(e, false);
      };
      const blockTouch = (e) => e.preventDefault();
      // P7 T2: the right mouse button is the coax trigger while possessing
      // the Bison — the browser's own context menu must never steal it.
      const onCtxMenu = (e) => e.preventDefault();
      canvas.addEventListener("pointerdown", onPointerDown);
      canvas.addEventListener("pointermove", onPointerMove);
      canvas.addEventListener("pointerup", onPointerUp);
      canvas.addEventListener("pointercancel", onPointerUp);
      canvas.addEventListener("contextmenu", onCtxMenu);
      canvas.addEventListener("wheel", onWheel, { passive: false });
      canvas.addEventListener("touchstart", blockTouch, { passive: false });
      window.addEventListener("keydown", kd);
      window.addEventListener("keyup", ku);

      // --- THE FRONT, KEPT (P1 Task 3) -------------------------------------
      // One slot, written at every bell and nowhere else. saveFront draws the
      // resumed run's seed FIRST and unconditionally — that draw is the only
      // rng this feature spends, it happens exactly once per bell whatever
      // else goes right or wrong below, and the draw-count law holds because
      // saving is not optional (see save.js law 2). Serialization is
      // synchronous into a string; the store write is fire-and-forget so the
      // frame never awaits it.
      // --- THE CUE QUEUE (P1 Task 4) ---------------------------------------
      // Audio-only events for the bell cycle. They cannot ride world.events
      // directly: that array is wiped at the top of every frame's sim bracket
      // (see `world.events.length = 0` in the loop) and the bell — like every
      // UI tap — lands outside that bracket, so anything pushed there would be
      // erased unheard. Cues queue here instead and are merged into the drained
      // stream once per frame, downstream of the wipe, so A.consume hears each
      // exactly once. They carry a type and nothing else: no coordinates, no
      // randomness, no sim effect. R.consume ignores types it doesn't know.
      const cues = [];
      const cueN = {};   // debug tally only — see window.__DEPOTCUES__
      const cue = (type) => { cues.push({ type }); cueN[type] = (cueN[type] || 0) + 1; };
      // Last whole second the countdown was seen at — the pre-toll's edge.
      let preTollSec = null;

      let saveStat = null;
      const saveFront = () => {
        if (dev) return; // mk2.24: the sandbox never saves — the one rng draw below is never drawn either (no live stream compares against a sandbox run)
        try {
          const t0 = performance.now();
          const json = serializeRun(war, { smears: R.smearLog ? R.smearLog() : [] });
          saveStat = { ms: +(performance.now() - t0).toFixed(2), bytes: json.length, bell: run.bell };
          cue("uitick"); // the record was written — the one acknowledgement it gets
          // fire-and-forget, but never an unhandled rejection: a store that
          // refuses the write (quota, a runtime that says no) must cost the
          // frame nothing and must not surface as a page error.
          Promise.resolve(storage.set(SAVE_KEY, json)).catch(() => {});
        } catch (e) {
          console.warn("COLDSNAP front save failed", e);
          saveStat = { ms: -1, bytes: 0, bell: run.bell, error: String(e && e.message ? e.message : e) };
        }
      };
      // A lost war does not get replayed, and a won one has nothing left to
      // resume: the slot burns the moment the verdict lands, six seconds
      // BEFORE the end card mounts. Idempotent — the first verdict tick owns
      // it, same discipline as stampEnd.
      const burnSave = () => {
        if (dev) return; // the sandbox owns no slot to burn — a real front's save must survive a sandbox session untouched
        if (run._saveBurned) return;
        run._saveBurned = true;
        burnFront();
      };

      // THE BELL rings here and nowhere else. Town pay closes the cycle
      // alongside the assault's results (fireBell books those): green ground
      // pays the player, red ground pays the regiment, seam ground nobody.
      const bellCtx = { cue, toast, townUV, buildSnapshot: () => buildSnapshotOf(war), nextApcSeq, saveFront: () => saveFront(), possessed: () => !!input.possess };
      input.bellCtx = bellCtx;
      // --- the bell's cards (Task 2). Nothing here touches the sim: they are
      // presentation state, armed on WORLD time via the same trailing-tap law
      // the ✓/✗ confirm pair lives under (PENDING_ARM_S), and they never gate
      // anything. The manifest chip re-opens a dismissed card until the NEXT
      // bell overwrites the offer.
      view.ackIntel = () => { run.intelUp = false; };
      view.openManifest = () => {
        const M = run.manifest;
        if (!M || M.hand.length === 0) return;
        M.cardUp = true;
        M.armedAt = world.t + PENDING_ARM_S;
        M.armedAtWall = performance.now() / 1000 + PENDING_ARM_S;
      };
      view.dismissManifest = () => { if (run.manifest) run.manifest.cardUp = false; };
      // P7.1 T4: THE INFO CARD — two doors, one state. The manifest door's
      // CONFIRM runs the real pick (its own arming and stale-offer guards
      // intact); the card adds its own trailing-tap arm on top.
      view.openInfo = (key, door) => { view.infoKey = key; view.infoDoor = door; view.infoArmedAt = world.t + PENDING_ARM_S; view.infoArmedWall = performance.now() / 1000 + PENDING_ARM_S; };
      view.closeInfo = () => { view.infoKey = null; view.infoDoor = null; };
      view.confirmInfo = () => {
        const armed = performance.now() / 1000 >= view.infoArmedWall;
        if (!armed) { toast("HOLD — ARMING"); return; }
        const k = view.infoKey, door = view.infoDoor;
        view.closeInfo();
        if (k && door === "manifest") view.pickManifest(k);
        else if (k && door === "hire") view.armHire(k);
        // P7.1 T8: the deal door just closes — the ground tap places next.
      };
      // P7.2 T8 (owner): the five picks are FREE — the pick is the payment.
      // Plans open the bar at once; units join the deal-placement queue.
      view.confirmDraft = (picked) => {
        if (!picked || picked.length !== 5) return;
        for (const c of picked) if (c.plan && run.manifest.unlocked.indexOf(c.k) < 0) run.manifest.unlocked.push(c.k);
        view._placeQueue = picked.filter((c) => !c.plan).map((c) => c.k);
        view._placeTotal = view._placeQueue.length;
        if (view._placeQueue.length) view.teachFire("placing");
        view._draftDone = true; view._draftOpen = false; run.draft = null;
        setHud((h) => ({ ...h, drafting: null, unlocked: run.manifest.unlocked.slice(), placing: view._placeQueue[0] || "done" }));
        if (view._placeQueue.length && view.openInfo) view.openInfo(view._placeQueue[0], "deal");
      };
      view.pickManifest = (key) => {
        const M = run.manifest;
        if (!M || performance.now() / 1000 < (M.armedAtWall ?? 0)) { toast("HOLD — ARMING"); return; }
        // P7.2 T2 (owner): A PLAN COSTS HALF the live price — the ladder
        // itself gained a price; each build after pays full. The convoy's
        // window is EXEMPT from the one-buy-per-second law (the hand is
        // one visit): no pacing check, no purchase stamp.
        const it = PALETTE_BY_KEY[key];
        const price = Math.max(1, Math.ceil(priceNow(key, it ? it.cost : 10) / 2));
        if (run.resources < price) { toast("NO SCRAP"); return; }
        if (!takeHandCard(M, key, 0)) return;
        M.unlocked.push(key);
        run.resources -= price;
        cue("uitick"); // the plan is bought
        toast((PALETTE_LABEL[key] || key) + " — PLANS BOUGHT ◆" + price);
        // mk1.95 (owner): THE PICK ARMS THE BAR — every key; hero keys are placement modes under the one law now.
        setMode(key);
      };
      // P7.2 T2 (owner): A HIRE FIELDS AT ONCE, placed by your own ground
      // tap on held ground. Payment lands only when the unit actually
      // fields — the ✗ cancels, charges nothing, and reopens the hand.
      view.armHire = (key) => {
        const M = run.manifest;
        if (!M || performance.now() / 1000 < (M.armedAtWall ?? 0)) { toast("HOLD — ARMING"); return; }
        if (!M.hand.some((c) => c.k === key && c.hire === 1)) return;
        // P7.2 HOTFIX mk1.86 (owner): AFFORDABILITY IS CHECKED FIRST — a hire
        // the till can't cover is refused here, before any ceremony: the card
        // stays in the hand, the window stays open, and the toast names the
        // price. Found live: a Bison hire armed at bell one and died at the
        // last step's tiny toast after the whole ghost dance.
        const price = priceNow(key, (PALETTE_BY_KEY[key] || { cost: 10 }).cost);
        if (run.resources < price) { toast("NO SCRAP — ◆" + price + " TO HIRE"); return; }
        view.hirePlace = { key };
        M.cardUp = false; // the window steps aside for the placement tap
        toast("PLACE THE HIRE — tap held ground");
      };
      view.cancelHire = () => { view.hirePlace = null; };
      const placeHire = (p) => {
        const key = view.hirePlace.key;
        const pk = PICK_POOL.find((x) => x.key === key);
        if (!pk) { view.hirePlace = null; return; }
        const price = priceNow(key, PALETTE_BY_KEY[key].cost);
        if (run.resources < price) { toast("NO SCRAP"); return; } // P7.2 HF mk1.86: the ghost STANDS (the GROUND NOT HELD precedent) — prices breathe by the second; ✗ still returns the card
        const g = grid.worldToGrid(p.x, p.z);
        if (!grid.inBounds(g.gx, g.gz)) { toast("OFF THE FIELD"); return; }
        const cell = grid.cells[grid.idx(g.gx, g.gz)];
        const wp = grid.gridToWorld(g.gx, g.gz);
        const c0 = map.invW(wp.x, wp.z);
        if (!(dev || canBuild(T, c0.u, c0.v))) { toast("GROUND NOT HELD"); return; }
        if (cell.water || cell.ice || cell.blocked || cell.wallId) { toast("NO GROUND"); return; }
        if (pk.kind === "squad") {
          const sq = makeSquad(run.nextSquadId++, pk.type, 1, wp.x, wp.z);
          spawnSquadMembers(world, sq);
          run.squads.push(sq);
          view.selSquadId = sq.id; view.selSquadIds = null; view.selArmedAt = world.t + PENDING_ARM_S; view.pieOpen = true;
          view.teachPie("squad", sq);
        } else if (pk.kind === "hull") {
          const spec = pk.vtype === "apc" ? APC : BISON;
          if (!armorStable(field, wp.x, wp.z, spec)) { toast("TOO STEEP TO PARK"); return; }
          if (slotBlockedPublic(world, wp.x, wp.z, Math.hypot(spec.hx, spec.hz) + 1.0)) { toast("NO ROOM"); return; }
          const v = addBody(world, { kind: "vehicle", team: 1, mass: spec.mass, hx: spec.hx, hy: spec.hy, hz: spec.hz,
            x: wp.x, y: field.heightAt(wp.x, wp.z) + spec.hy + 0.05, z: wp.z, hp: spec.hp, friction: 0.85,
            q: heading(null, Math.atan2(-wp.x, -wp.z)) });
          v.armor = spec.armor; v.vtype = pk.vtype; v.maxHp = spec.hp;
          v.homeX = wp.x; v.homeZ = wp.z; v.sleeping = true;
          if (pk.vtype === "apc") v.apcSeq = nextApcSeq();
          v.drv = pk.vtype === "apc" ? "apc" : "armor"; v.depotDrive = "auto"; v.order = "defend"; v.tracks = "careful"; v.driver = "player";
        } else if (pk.kind === "mech") {
          if (!(armorSpread(field, wp.x, wp.z, MECH_SPREAD) < 0.28)) { toast("TOO STEEP TO PARK"); return; }
          if (slotBlockedPublic(world, wp.x, wp.z, 4.5)) { toast("NO ROOM"); return; }
          const m = buildMech(world, { x: wp.x, z: wp.z, yaw: Math.atan2(-wp.x, -wp.z), team: 1, hp: MECH.hp });
          m.thrustersOn = true; m.thrustAssist = true;
          m.hull.drv = "mech"; m.hull.order = "defend"; m.hull.tracks = "careful";
          m.hull.maxHp = MECH.hp; m.hull.homeX = wp.x; m.hull.homeZ = wp.z;
        } else { // tower — the build law: cell claim + the road owed
          cell.blocked = true;
          const spec = TOWER_SPECS[pk.key];
          const b = addBody(world, { kind: "tower", team: 1, mass: 0, hx: 0.8, hy: spec.hy, hz: 0.8, x: wp.x, y: field.heightAt(wp.x, wp.z) + spec.hy, z: wp.z, hp: spec.hp });
          b.towerType = pk.key; b.flagPole = true; b.maxHp = b.hp;
          b.effRange = effRange(world, { x: b.pos.x, y: b.pos.y + b.hy + 0.45, z: b.pos.z }, spec);
          cell.wallId = b.id; cell.bTeam = 1;
          recomputeFlow();
        }
        takeHandCard(run.manifest, key, 1);
        run.resources -= price;
        view.hirePlace = null;
        if (run.manifest && run.manifest.hand.length && view.openManifest) view.openManifest(); // P7.2 HF mk1.86 (owner): multi-buy is one visit — the hand returns for the next card (the calm window returns with it, the ruled pause of an open hand)
        cue("uitick");
        toast("THE HIRE FIELDS — ◆" + price);
      };
      // mk2.25: THE ENEMY RACK's placer — sandbox only. Real spawners, real
      // vets where the kind has one (a hull still refuses a slope), team 2
      // throughout. rng draws are lawful here: the sandbox is its own
      // stream and never saves.
      const devSpawnAt = (p) => {
        const it = FOE_RACK_BY_KEY[view.devSpawn];
        if (!it) return;
        const d = map.clampToRim(p.x, p.z);
        if (map.streamAt(d.x, d.z)) { toast("OPEN WATER"); return; }
        if (it.tower) {
          const g = grid.worldToGrid(d.x, d.z);
          if (!grid.inBounds(g.gx, g.gz)) { toast("OFF THE FIELD"); return; }
          const cell = grid.cells[grid.idx(g.gx, g.gz)];
          if (cell.water || cell.ice || cell.blocked || cell.wallId) { toast("NO GROUND"); return; }
          const wp = grid.gridToWorld(g.gx, g.gz);
          const spec = TOWER_SPECS[it.tower];
          const b = addBody(world, { kind: "tower", team: 2, mass: 0, hx: 0.8, hy: spec.hy, hz: 0.8, x: wp.x, y: field.heightAt(wp.x, wp.z) + spec.hy, z: wp.z, hp: spec.hp });
          b.towerType = it.tower; b.flagPole = true; b.maxHp = b.hp;
          b.effRange = effRange(world, { x: b.pos.x, y: b.pos.y + b.hy + 0.45, z: b.pos.z }, spec);
          b.discipline = "free"; // the enemy's doctrine (muster.js parkTower's own stamp)
          cell.blocked = true; cell.wallId = b.id; cell.bTeam = 2;
          recomputeFlow();
        } else if (it.hull) {
          const spec = it.hull === "apc" ? APC : BISON;
          if (!armorStable(field, d.x, d.z, spec)) { toast("TOO STEEP TO PARK"); return; }
          if (slotBlockedPublic(world, d.x, d.z, Math.hypot(spec.hx, spec.hz) + 1.0)) { toast("NO ROOM"); return; }
          const v = addBody(world, { kind: "vehicle", team: 2, mass: spec.mass, hx: spec.hx, hy: spec.hy, hz: spec.hz,
            x: d.x, y: field.heightAt(d.x, d.z) + spec.hy + 0.05, z: d.z, hp: spec.hp, friction: 0.85,
            q: heading(null, Math.atan2(-d.x, -d.z)) });
          v.armor = spec.armor; v.vtype = it.hull; v.maxHp = spec.hp; v.bounty = spec.bounty;
          v.homeX = d.x; v.homeZ = d.z; v.sleeping = true;
          if (it.hull === "apc") v.apcSeq = nextApcSeq();
          v.drv = it.hull === "apc" ? "apc" : "armor"; v.depotDrive = "auto"; v.order = "defend"; v.tracks = "careful";
        } else if (it.mech) {
          if (!(armorSpread(field, d.x, d.z, MECH_SPREAD) < 0.28)) { toast("TOO STEEP TO PARK"); return; }
          if (slotBlockedPublic(world, d.x, d.z, 4.5)) { toast("NO ROOM"); return; }
          const m = buildMech(world, { x: d.x, z: d.z, yaw: Math.atan2(-d.x, -d.z), team: 2, hp: MECH.hp });
          m.thrustersOn = true; m.thrustAssist = true;
          m.hull.drv = "mech"; m.hull.order = "defend"; m.hull.tracks = "careful";
          m.hull.maxHp = MECH.hp; m.hull.homeX = d.x; m.hull.homeZ = d.z; m.hull.bounty = MECH.bounty;
        } else {
          for (let k = 0; k < it.n; k++) spawnUnit(world, { x: d.x, z: d.z }, it.tag);
        }
      };
      // mk1.95 (owner): THE HERO FIELDS BY THE ONE PLACEMENT LAW — the bar
      // arms a mode, the ground tap sets the ghost, the ✓ runs this. The
      // enemy's own heroes keep bell.js's replacement walk at its depot.
      const placeHero = (key, p) => {
        const pk = PICK_POOL.find((x) => x.key === key);
        if (!pk) return true;
        const price = priceNow(key, PALETTE_BY_KEY[key].cost);
        if (run.resources < price) { toast("NO SCRAP"); return false; }
        if (!buyPaced()) return false;
        const g = grid.worldToGrid(p.x, p.z);
        if (!grid.inBounds(g.gx, g.gz)) { toast("OFF THE FIELD"); return false; }
        const cell = grid.cells[grid.idx(g.gx, g.gz)];
        const wp = grid.gridToWorld(g.gx, g.gz);
        const c0 = map.invW(wp.x, wp.z);
        if (!(dev || canBuild(T, c0.u, c0.v))) { toast("GROUND NOT HELD"); return false; }
        if (cell.water || cell.ice || cell.blocked || cell.wallId) { toast("NO GROUND"); return false; }
        if (pk.kind === "mech") {
          if (!(armorSpread(field, wp.x, wp.z, MECH_SPREAD) < 0.28)) { toast("TOO STEEP TO PARK"); return false; }
          if (slotBlockedPublic(world, wp.x, wp.z, 4.5)) { toast("NO ROOM"); return false; }
          const m = buildMech(world, { x: wp.x, z: wp.z, yaw: Math.atan2(-wp.x, -wp.z), team: 1, hp: MECH.hp });
          m.thrustersOn = true; m.thrustAssist = true;
          m.hull.drv = "mech"; m.hull.order = "defend"; m.hull.tracks = "careful";
          m.hull.maxHp = MECH.hp; m.hull.homeX = wp.x; m.hull.homeZ = wp.z;
        } else {
          const spec = pk.vtype === "apc" ? APC : BISON;
          if (!armorStable(field, wp.x, wp.z, spec)) { toast("TOO STEEP TO PARK"); return false; }
          if (slotBlockedPublic(world, wp.x, wp.z, Math.hypot(spec.hx, spec.hz) + 1.0)) { toast("NO ROOM"); return false; }
          const v = addBody(world, { kind: "vehicle", team: 1, mass: spec.mass, hx: spec.hx, hy: spec.hy, hz: spec.hz,
            x: wp.x, y: field.heightAt(wp.x, wp.z) + spec.hy + 0.05, z: wp.z, hp: spec.hp, friction: 0.85,
            q: heading(null, Math.atan2(-wp.x, -wp.z)) });
          v.armor = spec.armor; v.vtype = pk.vtype; v.maxHp = spec.hp;
          v.homeX = wp.x; v.homeZ = wp.z; v.sleeping = true;
          if (pk.vtype === "apc") v.apcSeq = nextApcSeq();
          v.drv = pk.vtype === "apc" ? "apc" : "armor"; v.depotDrive = "auto"; v.order = "defend"; v.tracks = "careful"; v.driver = "player";
        }
        run.resources -= price;
        run._buyAt = world.t;
        cue("uitick");
        toast("THE CONVOY DELIVERS — ◆" + price);
        standDown();
        return true;
      };
      // mk1.95: THE PLACEMENT ZONE — while a confirm placement is armed, the
      // ground it may take is shown: held ground for towers, squads, hires
      // and heroes; the homeland ring for the pre-start deal. ~4Hz, wall time.
      const refreshZone = () => {
        if (!R) return;
        const dealPhase = !run.started && view._placeQueue && view._placeQueue.length;
        const armedKey = dealPhase ? view._placeQueue[0]
          : view.hirePlace ? view.hirePlace.key
          : run.mode && (TOWER_SPECS[run.mode] || SQUAD_MODE[run.mode] || HERO_MODE[run.mode]) ? run.mode : null;
        if (!armedKey || run.gameOver || run.victory) { R.overlay.setZone(false); return; }
        const heldAt = dealPhase
          ? (x, z) => Math.hypot(x - depotP.x, z - depotP.z) <= HOMELAND_R
          : dev ? () => true
          : (x, z) => { const c = map.invW(x, z); return canBuild(T, c.u, c.v); };
        // mk1.96 (owner): the zone tells the ARMED unit's own truth — the
        // ground's permanent laws AND the room standing bodies take right
        // now. Hulls vet their flat parking and their clearance; the mech
        // its spread and its 4.5m; squads and towers place by the shared
        // laws alone (their placers refuse on neither slope nor room).
        const pk = PICK_POOL.find((x) => x.key === armedKey);
        let vetAt = null, room = null;
        if (pk && pk.kind === "hull") {
          const spec = pk.vtype === "apc" ? APC : BISON;
          vetAt = (x, z) => armorStable(field, x, z, spec);
          room = roomMaskPublic(world, grid, Math.hypot(spec.hx, spec.hz) + 1.0);
        } else if (pk && pk.kind === "mech") {
          vetAt = (x, z) => armorStable(field, x, z, MECH_SPREAD);
          room = roomMaskPublic(world, grid, 4.5);
        }
        R.overlay.setZone(true, grid, placeZoneMask(grid, heldAt, vetAt, room), (x, z) => field.heightAt(x, z), 0x4aff8c);
      };

      window.__DEPOT__ = () => ({ t: world.t, scrap: run.resources, kills: run.score.p.kills, score: { pk: run.score.p.kills, pv: +run.score.p.value.toFixed(1), ek: run.score.e.kills, ev: +run.score.e.value.toFixed(1) }, bell: run.bell, bellT: run.bellT, bodies: world.bodies.length, fps: view.fps, paused: view.paused, speed: view.speed, reg: { ...run.reg }, depotStanding: run.depotStanding != null ? run.depotStanding : 1, breach: !!run.breach, enemyStanding: run.enemyStanding != null ? run.enemyStanding : 1, enemyBreach: !!run.enemyBreach, withdrew: run.ws.withdrew || 0, endedAt: run.endedAt != null ? run.endedAt : null, endCard: endCardReady(run, world.t) });
      // mk0.27 debug harness: the live pending + its screen anchor (smoke
      // asserts the tap-theft repairs through this).
      window.__DEPOTPENDING__ = () => (view.pending ? { armed: pendingArmed(view.pending, world.t), screen: view.pendingScreen, gx: view.pending.gx, gz: view.pending.gz } : null);
      window.__DEPOTBUILD__ = (gx, gz, mode) => buildAt(gx, gz, mode || "wall");
      // debug harness: world point -> grid cell, so a staging script can build
      // at a point __DEPOTFINDBUILDABLE__ handed it without driving the tap UI.
      window.__DEPOTGRIDAT__ = (x, z) => grid.worldToGrid(x, z);
      window.__DEPOTSPAWN__ = (n) => { for (let i = 0; i < (n || 1); i++) spawnEnemy(world, map.SPAWN_POINTS[run.spawnRR++ % map.SPAWN_POINTS.length]); };
      window.__DEPOTTESLA__ = () => { const C = stateRef.current; return { arcs: C && C.run.arcs ? C.run.arcs.length : -1, fired: C ? C.view._teslaFired || 0 : -1, zaps: C ? C.view._teslaZaps || 0 : -1, held: !!(C && C.input.fireHeld), pk: C && C.input.possess ? C.input.possess.kind : null }; };
      window.__DEPOTSTART__ = () => { run.started = true; };
      window.__DEPOTSETT__ = (t) => { world.t = t; world.wind = windAt(map.MAP_SEED, world.t); };
      window.__DEPOTFLAGS__ = () => world.bodies.filter((b) => b.flagPole).map((b) => ({ id: b.id, kind: b.kind, x: +b.pos.x.toFixed(2), y: +b.pos.y.toFixed(2), z: +b.pos.z.toFixed(2) }));
      window.__DEPOTTOWN__ = () => map.TOWN.map((t) => ({ id: t.id, x: +t.x.toFixed(2), z: +t.z.toFixed(2), nx: t.nx, nz: t.nz, ny: t.ny, slab: !!t.slab, cols: !!t.cols }));
      window.__DEPOTTREES__ = () => world.bodies.filter((b) => b.kind === "tree").map((b) => ({ id: b.id, x: +b.pos.x.toFixed(2), z: +b.pos.z.toFixed(2), y: +b.pos.y.toFixed(2), hp: +b.hp.toFixed(1), alive: b.alive, burning: b.burning }));
      // P1.5 T2 staging harness: the live wall courses, the welds holding them
      // and the loose rubble — so a save/resume run can prove three courses,
      // two welds and a half-dead wall all came back, and a collapse run can
      // watch the uppers leave the wall set.
      window.__DEPOTWALLS__ = () => ({
        courses: world.bodies.filter((b) => b.kind === "wall").map((b) => ({
          course: b.course != null ? b.course : -1, hp: +b.hp.toFixed(1), maxHp: b.maxHp, cap: !!b.capTop,
          x: +b.pos.x.toFixed(2), y: +b.pos.y.toFixed(2), z: +b.pos.z.toFixed(2),
        })),
        welds: world.welds.filter((w) => !w.broken && w.a.kind === "wall" && w.b.kind === "wall").length,
        fallen: world.bodies.filter((b) => b.kind === "chunk" && !b.town && !b.sandbag && b.invM > 0 && b.mass === 100 && b.hy > 0.2).length,
      });
      window.__DEPOTMG__ = (tx, ty, tz) => {
        // debug harness: fire a single mg round at a point (a tree, typically)
        // from 3m out — used for smoke-testing tree shredding under
        // depotCombat, same shot shape combat-test.mjs uses
        const from = { x: tx, y: ty, z: tz - 3 };
        fireProjectile(world, from, { x: 0, y: 0, z: 1 }, 90,
          { kind: "mg", r: 0.05, kv: 0.3, dmg: 1, crater: 0, attacker: "player" });
      };
      window.__DEPOTSHELL__ = (tx, ty, tz) => {
        // debug harness: a real GUN-tower round (noImpact:true, matching
        // TOWER_SPECS.gun and towerShot's fireProjectile call exactly — the
        // flat +55 point-blank impact bonus only applies to non-noImpact
        // specs, which a live tower never fires). A direct shell hit sets
        // tree.burning and, at 70hp (Task 5), leaves it alive to burn down
        // ~2hp/s rather than dying in the same tick.
        const from = { x: tx, y: ty, z: tz - 3 };
        fireProjectile(world, from, { x: 0, y: 0, z: 1 }, 90,
          { kind: "shell", r: 2.3, kv: 8, dmg: 25, crater: 0.55, noImpact: true, attacker: "player" });
      };
      window.__DEPOTTHIN__ = () => {
        // debug harness: instantly clear the field — zero the spawn queue and
        // kill every live enemy — so tests can empty an assault without
        // waiting real time for it to walk (smoke.mjs uses this to stay
        // inside its budget under swiftshader).
        run.ws.spawnQueue = 0;
        for (const b of world.bodies) if (b.kind === "unit" && b.team === 2 && b.alive) applyDamage(world, b, 1e6, { cause: "BLAST", attacker: "player" });
      };
      window.__DEPOTWEDGE__ = () => {
        // debug harness: wedge the current assault — drain the spawn queue and
        // backdate its clock past ASSAULT_TIMEOUT so the next tick times out
        // and every live enemy withdraws (instead of waiting 75 real seconds).
        run.ws.spawnQueue = 0;
        run.ws.withdrawn = false;
        run.ws.spawnDoneT = world.t - (ASSAULT_TIMEOUT + 1);
      };
      window.__DEPOTBELL__ = (inS = 0) => {
        // debug harness: ring the bell now — pulls the next assault forward
        // without waiting out the period. An argument moves the due stamp that
        // many SIM seconds out instead (P1 T4: reaching the pre-toll window
        // without waiting two minutes).
        run.bellAt = world.t + Math.max(0, inS);
      };
      // debug harness (P1 T4): how many of each audio cue this run has raised.
      // Audio cannot be asserted headlessly; this at least proves the cues are
      // pushed where the design says they are.
      window.__DEPOTCUES__ = () => ({ ...cueN });
      window.__DEPOTMANIFEST__ = () => ({
        unlocked: run.manifest.unlocked.slice(), hand: run.manifest.hand.slice(),
        offerBell: run.manifest.offerBell, cardUp: !!run.manifest.cardUp,
        armed: world.t >= run.manifest.armedAt, intelUp: !!run.intelUp,
        foe: run.foe.unlocked.slice(),
      });
      window.__DEPOTPICK__ = (key) => { view.pickManifest(key); return run.manifest.unlocked.slice(); };
      // debug harness (P1 T3): what the last bell's save cost and whether this
      // mount is a resume. Reading it costs nothing; the numbers are recorded
      // by saveFront itself, not measured on demand.
      window.__DEPOTSAVE__ = () => ({ resumed: !!RES, burned: !!run._saveBurned, last: saveStat });
      window.__DEPOTEND__ = (victory) => {
        // debug harness: force the run into its end state for screenshotting
        // the WIN/LOSS end card without simming 50 waves — pattern matches
        // the other window.__DEPOT*__ hooks above.
        if (victory) { run.victory = true; run.enemyBreach = true; } else { run.gameOver = true; run.breach = true; }
      };
      window.__DEPOTPAIR__ = (x, z) => {
        // debug harness (6.5 Task 6): field a sniper PAIR at a world point,
        // cost-free — smoke asserts the spotter climbs / the sniper settles
        // and frames the screenshot without driving the placement UI.
        const sq = makeSquad(run.nextSquadId++, "sniper", 1, x, z);
        spawnSquadMembers(world, sq);
        run.squads.push(sq);
        return sq.id;
      };
      window.__DEPOTPAIRSTATE__ = (id) => {
        const sq = run.squads.find((q) => q.id === id);
        if (!sq) return null;
        return {
          type: sq.type,
          spotGoal: sq._spotGoal || null, snipeGoal: sq._snipeGoal || null,
          members: sq.memberIds.map((mid) => { const u = world.byId.get(mid); return u && { role: u.role || null, x: +u.pos.x.toFixed(2), z: +u.pos.z.toFixed(2), settled: !!u.settled, alive: u.alive }; }),
        };
      };
      window.__DEPOTCELL__ = (x, z) => {
        // debug harness: the grid's verdict on one world point — the same four
        // facts validatePlacement asks about, so a staging run can choose ground
        // that is actually buildable instead of walking a line into a ridge.
        const g = grid.worldToGrid(x, z);
        if (!grid.inBounds(g.gx, g.gz)) return null;
        const cell = grid.cells[grid.idx(g.gx, g.gz)];
        const wp = grid.gridToWorld(g.gx, g.gz), c0 = map.invW(wp.x, wp.z);
        return { gx: g.gx, gz: g.gz, x: +wp.x.toFixed(2), z: +wp.z.toFixed(2),
          blocked: !!(cell.blocked || cell.wallId), ice: !!cell.ice, held: canBuild(T, c0.u, c0.v) };
      };
      window.__DEPOTSQUAD__ = (type, x, z) => {
        // debug harness (P1.5 T4): field ANY squad type at a world point,
        // cost-free — __DEPOTPAIR__ generalised, so a staging run can put an
        // engineer team on the ground without driving the placement UI.
        if (!SQUAD_SPECS[type]) return null;
        const sq = makeSquad(run.nextSquadId++, type, 1, x, z);
        spawnSquadMembers(world, sq);
        run.squads.push(sq);
        return sq.id;
      };
      // THE PROBE'S INSTRUMENT (Phase A, mk1.92): field a mech for either
      // team at a point, read every mech's state, order one directly — the
      // same debug-harness pattern as every __DEPOT*__ hook, cost-free.
      window.__DEPOTMECH__ = (team, x, z, yaw) => {
        const m = buildMech(world, { x, z, yaw: yaw || 0, team: team || 1, hp: MECH.hp });
        m.thrustersOn = true; m.thrustAssist = true;
        m.hull.drv = "mech"; m.hull.order = "defend"; m.hull.tracks = "careful";
        m.hull.maxHp = m.hull.hp; m.hull.homeX = x; m.hull.homeZ = z;
        if (team === 2) m.hull.bounty = MECH.bounty;
        return m.hull.id;
      };
      window.__DEPOTMECHS__ = () => (world.mechs || []).map((m) => ({
        id: m.hull.id, team: m.team, hp: +m.hull.hp.toFixed(1), mode: m.state.mode,
        x: +m.hull.pos.x.toFixed(2), z: +m.hull.pos.z.toFixed(2),
        falls: m.telem.falls, steps: m.telem.steps, order: m.hull.order || null,
      }));
      window.__DEPOTMECHORDER__ = (id, kind, x, z) => {
        const b = world.byId.get(id); if (!b || !b.mechRef) return null;
        b.order = kind; b.dest = x != null ? { x, z } : null; b._route = null; b._routeDest = null;
        return { order: b.order, dest: b.dest };
      };
      window.__DEPOTORDER__ = (id, kind, pts) => {
        // debug harness (P1.5 T4): give a squad an order through the REAL order
        // path — view.orderSquad arms the chip, consumeOrderTap eats the ground
        // points (one for ATTACK/MOVE, two for a build line). Only the camera
        // raycast is skipped; every clamp, gate and arming rule still applies.
        const sq = run.squads.find((q) => q.id === id);
        if (!sq) return null;
        view.selSquadId = id; view.selArmedAt = 0; view.orderMode = null; view.buildPt0 = null;
        view.orderSquad(kind);
        for (const p of (pts || [])) consumeOrderTap(p);
        // COMMAND T2 (mk0.84): the debug path auto-accepts what a human tap
        // would still have to confirm — staging keeps driving the real order
        // path end to end without a screen to tap the ✓ on.
        // AUDIT FIX (mk0.85): acceptLine gates on pendingArmed, and the
        // pending was created THIS tick with armedAt = world.t + PENDING_ARM_S
        // — the old auto-accept always missed its own arming window and
        // silently no-opped. The arming guard protects a human's trailing
        // tap; the staging path has no trailing tap, so backdate the arm,
        // then accept.
        if (view.linePending) { view.linePending.armedAt = world.t; view.acceptLine(); } // staging has no trailing tap — backdate the arm, then accept
        return { order: sq.order, dest: sq.dest, armed: view.orderMode, pt0: view.buildPt0,
          build: sq._build ? { kind: sq._build.kind, cells: sq._build.rows.length, phase: sq._build.phase, orient: sq._build.orient } : null };
      };
      window.__DEPOTFOCUS__ = (x, z, zoom) => {
        // debug harness: point the camera at a world point (e.g. a tree) so
        // smoke-test screenshots can frame a specific body tightly
        run.focus.x = x; run.focus.z = z; run.focus.y = field.heightAt(x, z);
        if (zoom) { run.zoom = zoom; R.setZoom(zoom); }
      };
      // debug harness: read the current camera focus (canvas-center world
      // point) — used by the smoke test's rotation-invariance check to know
      // the intended build cell without racing the render loop's tween.
      window.__DEPOTGETFOCUS__ = () => ({ x: run.focus.x, z: run.focus.z });
      window.__DEPOTHOLD__ = (x, z) => { const c = map.invW(x, z); return holderAt(T, c.u, c.v); };
      // VISION (mk0.72): the sight census — how many cells each side can see
      // right now. Sight is derived and never saved, so this is also the
      // resume check: after a reload the count comes back on the first
      // territory tick, from nothing but the bodies on the field.
      window.__DEPOTSIGHT__ = () => {
        const a = T.sight.seen1, b = T.sight.seen2;
        let lit1 = 0, lit2 = 0;
        for (let i = 0; i < a.length; i++) { lit1 += a[i]; lit2 += b[i]; }
        return { cells: a.length, lit1, lit2 };
      };
      window.__DEPOTSELREACH__ = () => {
        // Task 2b: reports whichever fan is live — selected squad first,
        // else the inspected tower's cached fan (kind flags the source).
        const r = view.selReach || (view.inspectReach && view.inspectReach.pts ? view.inspectReach : null);
        if (!r) return null;
        return { id: r.id, kind: r === view.selReach ? "squad" : "tower", n: r.pts.length, cx: +r.cx.toFixed(2), cz: +r.cz.toFixed(2), maxR: +Math.max(...r.pts.map((p) => Math.hypot(p.x - r.cx, p.z - r.cz))).toFixed(2) };
      };
      // debug harness (Task 2): the nearest buildable+held cell to the depot
      // flag. Build rights now gate placement on holderAt===1 — the depot's
      // own emitter greens ground near itself, but the smoke test's original
      // build-tap point (canvas center at the initial camera focus) sits
      // well outside that radius on the pinned seed. The smoke test polls
      // this until non-null, then points the camera there before tapping.
      // clearR (optional, Task 3): also require no tower/wall/sandbag body
      // within clearR meters of the cell — squad members spawn on a 1.2m
      // ring and seek 2.4m formation slots, and a slot inside a static body
      // gets a man ejected/crushed by contact resolution (found live in the
      // Task 3 smoke: 1 of 4 riflemen died at spawn next to the mg tower).
      window.__DEPOTFINDBUILDABLE__ = (clearR) => {
        const flag = world.bodies.find((b) => b.kind === "flag");
        if (!flag) return null;
        let best = null, bestD = 1e9;
        for (let gz = 0; gz < map.GRID_H; gz++) for (let gx = 0; gx < map.GRID_W; gx++) {
          const cell = grid.cells[grid.idx(gx, gz)];
          if (cell.blocked || cell.wallId || cell.ice) continue;
          const wp = grid.gridToWorld(gx, gz);
          const c = map.invW(wp.x, wp.z);
          if (!canBuild(T, c.u, c.v)) continue;
          if (clearR && world.bodies.some((b) => b.alive && (b.kind === "tower" || b.kind === "wall" || b.kind === "rock" || b.kind === "tree" || b.kind === "chunk") &&
            Math.hypot(wp.x - b.pos.x, wp.z - b.pos.z) < clearR)) continue;
          const d = Math.hypot(wp.x - flag.pos.x, wp.z - flag.pos.z);
          if (d < bestD) { bestD = d; best = { x: wp.x, z: wp.z }; }
        }
        return best;
      };
      // Screenshot harness only (Task 3 verification, not a smoke-test dep):
      // the highest buildable+held cell within reach of the flag, and the
      // buildable+held cell nearest a live rock — so a ring-on-a-rise and a
      // ring-bitten-by-an-obstacle shot can be composed deterministically
      // on the pinned seed instead of eyeballing the procedural map.
      window.__DEPOTFINDRISE__ = () => {
        const flag = world.bodies.find((b) => b.kind === "flag");
        if (!flag) return null;
        let best = null, bestY = -1e9;
        for (let gz = 0; gz < map.GRID_H; gz++) for (let gx = 0; gx < map.GRID_W; gx++) {
          const cell = grid.cells[grid.idx(gx, gz)];
          if (cell.blocked || cell.wallId || cell.ice) continue;
          const wp = grid.gridToWorld(gx, gz);
          const c = map.invW(wp.x, wp.z);
          if (!canBuild(T, c.u, c.v)) continue;
          if (Math.hypot(wp.x - flag.pos.x, wp.z - flag.pos.z) > 40) continue;
          const y = field.heightAt(wp.x, wp.z);
          if (y > bestY) { bestY = y; best = { x: wp.x, z: wp.z, y }; }
        }
        return best;
      };
      window.__DEPOTFINDNEARROCK__ = () => {
        const rocks = world.bodies.filter((b) => b.kind === "rock" && b.alive);
        let best = null, bestD = 1e9;
        for (let gz = 0; gz < map.GRID_H; gz++) for (let gx = 0; gx < map.GRID_W; gx++) {
          const cell = grid.cells[grid.idx(gx, gz)];
          if (cell.blocked || cell.wallId || cell.ice) continue;
          const wp = grid.gridToWorld(gx, gz);
          const c = map.invW(wp.x, wp.z);
          if (!canBuild(T, c.u, c.v)) continue;
          for (const r of rocks) {
            const d = Math.hypot(wp.x - r.pos.x, wp.z - r.pos.z);
            if (d < bestD && d > 2) { bestD = d; best = { x: wp.x, z: wp.z }; }
          }
        }
        return best;
      };
      // Task 4 debug hooks: DOM/pixel-cheap fog asserts for smoke.mjs.
      // __DEPOTFOGDBG__ reports the renderer's own per-frame count of
      // team-2-alive bodies vs how many it actually rendered (some hidden
      // by fog when unheld) — no pixel sampling needed. __DEPOTFOGAT__
      // exposes fogStateFor at a world point for direct state checks.
      window.__DEPOTFOGDBG__ = () => R.getFogDebug();
      window.__DEPOTFOGAT__ = (x, z) => { const c = map.invW(x, z); return fogStateFor(T, c.u, c.v, 1); };
      // Task 3 debug hooks: squad + sandbag state reads for smoke.mjs, plus
      // the live center-ray ground point — the camera pivot TWEENS toward
      // run.focus, so a fixed post-focus sleep lands taps meters off under
      // swiftshader; the smoke polls this until it converges instead.
      window.__DEPOTGROUNDAT__ = (cx, cy) => groundPoint(cx, cy);
      // ...and the inverse: a world point's current client-pixel position,
      // so the smoke can tap a KNOWN cell instead of hoping the tweening
      // center ray lands on one.
      window.__DEPOTSCREENAT__ = (x, z) => {
        if (!R.project) return null;
        // pickHeightAt, not heightAt: project the point where it is DRAWN,
        // so the projection round-trips with groundPoint's mesh picking.
        const nd = R.project(x, pickHeightAt(x, z), z);
        if (!nd) return null;
        const rect = canvas.getBoundingClientRect();
        return { x: rect.left + (nd.x * 0.5 + 0.5) * rect.width, y: rect.top + (-nd.y * 0.5 + 0.5) * rect.height };
      };
      window.__DEPOTSQUADS__ = () => run.squads.map((sq) => ({
        id: sq.id, type: sq.type, order: sq.order,
        anchor: { x: +sq.anchor.x.toFixed(2), z: +sq.anchor.z.toFixed(2) },
        dest: sq.dest ? { x: +sq.dest.x.toFixed(2), z: +sq.dest.z.toFixed(2) } : null,
        sel: view.selSquadId === sq.id, ordering: view.selSquadId === sq.id && view.orderMode === "attack",
        // P1.5 T4: the live build job, if any — kind, how far down the cell list
        // the laying has got, what actually went down and what was skipped.
        build: sq._build ? {
          kind: sq._build.kind, phase: sq._build.phase, cells: sq._build.rows.length,
          i: sq._build.i, laid: sq._build.laid, skipped: sq._build.skipped, dry: !!sq._build.dry,
          pause: +(sq._pauseT || 0).toFixed(2), orient: sq._build.orient,
        } : null,
        members: sq.memberIds.map((id) => {
          const u = world.byId.get(id);
          return u ? { id, x: +u.pos.x.toFixed(2), z: +u.pos.z.toFixed(2), alive: u.alive } : null;
        }).filter(Boolean),
      }));
      window.__DEPOTSANDBAGS__ = () => world.bodies.filter((b) => b.sandbag).map((b) => ({ id: b.id, x: +b.pos.x.toFixed(2), z: +b.pos.z.toFixed(2), hx: b.hx, hz: b.hz, alive: b.alive }));
      window.__DEPOTLOAD__ = () => {
        // the load ramp's gauge (P6 close): live men and the awake/asleep
        // stone split, counted fresh on each call — read-only, no cadence.
        let men = 0, awake = 0, asleep = 0;
        for (const b of world.bodies) {
          if (!b.alive) continue;
          if (b.kind === "unit") men++;
          else if (b.kind === "chunk") { if (b.sleeping) asleep++; else awake++; }
        }
        return { men, awake, asleep };
      };
      window.__DEPOTENEMYPOS__ = () => {
        const b = world.bodies.find((b2) => b2.kind === "unit" && b2.alive && b2.team === 2);
        return b ? { x: b.pos.x, y: b.pos.y, z: b.pos.z } : null;
      };

      let last = performance.now();
      const STEP = 1 / 120;
      // mk0.35 — THE STOPWATCH (?perf=1). A measurement probe, not a feature:
      // it brackets the fixed-step sim block and the R.render call and drops
      // the pair into a ring buffer that scripts/diag-perf.mjs reads back.
      // The flag is resolved ONCE, here — with no ?perf=1 in the URL every
      // probe site below is a single already-false boolean test, nothing is
      // allocated, nothing is sampled and window.__DEPOTPERF__ never exists.
      // Typed arrays, never per-frame objects, so the stopwatch cannot feed
      // the garbage collector it is trying to measure. Body/chunk counts are
      // sampled at ~1Hz (the census cadence), not per frame.
      const perf = new URLSearchParams(window.location.search).get("perf") === "1";
      const PCAP = 4096; // ~68s at 60fps, ~136s at 30 — a 60s window always fits
      let pT = null, pSimA = null, pRenA = null, pFrmA = null, pDrewA = null;
      let pI = 0, pN = 0, pSampT = 0, pBodies = 0, pChunksDrawn = 0, pChunksTotal = 0;
      if (perf) {
        pT = new Float64Array(PCAP); pSimA = new Float64Array(PCAP);
        pRenA = new Float64Array(PCAP); pFrmA = new Float64Array(PCAP);
        pDrewA = new Uint8Array(PCAP);
        window.__DEPOTPERF__ = () => {
          const n = Math.min(pN, PCAP), out = [];
          for (let k = 0; k < n; k++) {
            const j = (pI - n + k + PCAP) % PCAP; // oldest-first
            out.push({ t: pT[j], sim: pSimA[j], render: pRenA[j], frame: pFrmA[j], drew: !!pDrewA[j] });
          }
          return {
            n, cap: PCAP, overflowed: pN > PCAP,
            bodies: pBodies, chunksDrawn: pChunksDrawn, chunksTotal: pChunksTotal,
            frames: out,
          };
        };
        window.__DEPOTPERF__.reset = () => { pI = 0; pN = 0; };
      }
      // THE MECH (mk1.92): possessed commands, ported from MechRange.jsx's
      // feedCommands (jets omitted — no jet mode in the war). Fed once per
      // SIM TICK from inside the accumulator loop below — the range's own
      // cadence law: per-frame feeds fall the machine. Left stick/WASD walk
      // (screen-relative, like the possessed vehicle above); right
      // stick/A,D turn with the steering lock and the hard-over pivot; aim
      // range/yaw from the touch trim+slider or the desktop mouse
      // (groundPoint — the same raycast the reticle uses, not a synthetic
      // screen-offset: the camera is hull-locked, so the mouse already
      // points at the world the way it does for every other possession).
      const feedMechCommands = (mech, cdt) => {
        let tf = view.keys.w ? 0.6 : view.keys.s ? -0.42 : 0;
        let tl = 0;
        if (view.joy && view.joy.active && (Math.abs(view.joy.s) > 0.12 || Math.abs(view.joy.t) > 0.12)) {
          const cb = R.camBasis;
          const fl = Math.hypot(cb.up.x, cb.up.z) || 1, rl = Math.hypot(cb.right.x, cb.right.z) || 1;
          const wxS = (cb.right.x / rl) * view.joy.s + (cb.up.x / fl) * view.joy.t;
          const wzS = (cb.right.z / rl) * view.joy.s + (cb.up.z / fl) * view.joy.t;
          const hS = mech.state.heading;
          const fS = wxS * Math.sin(hS) + wzS * Math.cos(hS);
          const lS = wxS * Math.cos(hS) - wzS * Math.sin(hS);
          tf = fS >= 0 ? Math.min(0.6, fS * 0.6) : Math.max(-0.42, fS * 0.42);
          tl = Math.max(-0.22, Math.min(0.22, lS * 0.26));
        }
        if (view.mechYawT == null) view.mechYawT = mech.state.heading;
        if (view.keys.a) view.mechYawT += 0.7 * cdt;
        if (view.keys.d) view.mechYawT -= 0.7 * cdt;
        view.mechKeyTurnT = (view.keys.a || view.keys.d) ? (view.mechKeyTurnT || 0) + cdt : 0;
        if (view.mechKeyTurnT > 0.6 && mech.state.mode === "WALK" && !mech.state.aboutFace) { mechPivot(world, mech); view.mechKeyTurnT = 0; }
        if (!view.keys.a && !view.keys.d && view.mechKeyTurnPrev && mech.state.afLive && mech.state.aboutFace) { mech.state.aboutFace = null; mech.state.headingT = mech.state.heading; view.mechYawT = mech.state.heading; mech.state.recoverT = Math.max(mech.state.recoverT || 0, 0.5); }
        view.mechKeyTurnPrev = view.keys.a || view.keys.d;
        if (view.joyR && view.joyR.active && Math.abs(view.joyR.s) > 0.15) view.mechYawT -= view.joyR.s * 0.9 * cdt;
        view.mechHardT = view.joyR && view.joyR.active && Math.abs(view.joyR.s) > 0.5 ? (view.mechHardT || 0) + cdt : 0;
        if (view.mechHardT > 0.6 && mech.state.mode === "WALK" && !mech.state.aboutFace) { mechPivot(world, mech); view.mechHardT = 0; }
        {
          const anchor = mech.state.heading;
          let lead = view.mechYawT - anchor;
          while (lead > Math.PI) lead -= 2 * Math.PI;
          while (lead < -Math.PI) lead += 2 * Math.PI;
          view.mechYawT = anchor + Math.max(-0.5, Math.min(0.5, lead));
        }
        if (isTouch) {
          if (view.mechAimHeld) view.mechAimOff = Math.max(-0.85, Math.min(0.85, (view.mechAimOff || 0) + view.mechAimHeld * 0.9 * cdt));
          mech.aimYaw = mech.state.heading + (view.mechAimOff || 0);
          mech.aimRange = view.mechAimRange || 26;
        } else if (view.pointer) {
          const torso = mech.waist ? mech.waist.b : mech.hull;
          const gp = groundPoint(view.pointer.x, view.pointer.y);
          if (gp) {
            mech.aimYaw = Math.atan2(gp.x - torso.pos.x, gp.z - torso.pos.z);
            mech.aimRange = Math.max(6, Math.min(120, Math.hypot(gp.x - torso.pos.x, gp.z - torso.pos.z)));
          }
        }
        if (mech.waist && Math.abs(mech.waist.target) > 0.6 * 0.87 && Math.hypot(tf, tl) > 0.05)
          view.mechYawT += Math.sign(mech.waist.target) * 0.12 * cdt;
        mechCommand(mech, { travel: tf, lateral: tl, heading: mech.state.aboutFace ? null : view.mechYawT });
      };
      const frame = (now) => {
        if (disposed) return;
        raf = requestAnimationFrame(frame);
        let dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        const pFrame0 = perf ? performance.now() : 0;
        let pSim = 0, pRen = 0, pDrew = 0;
        try {
          view.fpsAcc += dt; view.fpsN++;
          if (view.fpsAcc > 0.5) { view.fps = Math.round(view.fpsN / view.fpsAcc); view.fpsAcc = 0; view.fpsN = 0; }
          // mk0.29 (savor the fall): the verdict no longer freezes the world.
          // It stamps the clock; the collapse plays out for END_CARD_DELAY_S
          // of world time, and only when the card is actually up does the sim
          // stop. Orders and building are locked from the verdict itself.
          // (stampEnd itself now runs inside tickWar, once per fixed step.)
          // The record burns with the war, and it burns FIRST — the end card
          // is still six world-seconds away when this runs.
          if (run.gameOver || run.victory) burnSave();
          const cardUp = endCardReady(run, world.t);
          // P7.2 T3 (owner): THE WAR PAUSES FOR THE CONVOY — the whole sim
          // freezes while the hand's window is up; LATER or buying out the
          // hand resumes it. Prices and the bell freeze for free: every
          // accumulator below feeds on sdt.
          const convoyUp = !!(run.manifest && run.manifest.cardUp);
          const teachUp = view._teachQ.length > 0; // Task 3: a teaching card freezes the sim, the convoy's own law
          const sdt = view.paused || !run.started || cardUp || convoyUp || teachUp ? 0 : dt * view.speed;
          const pan = 34 * dt / Math.max(0.5, run.zoom);
          // screen-relative like touch drag: W = screen-up whatever the Q/E yaw
          const cb = R.camBasis;
          const ul = Math.hypot(cb.up.x, cb.up.z) || 1, rl = Math.hypot(cb.right.x, cb.right.z) || 1;
          const ux = cb.up.x / ul, uz = cb.up.z / ul, rx = cb.right.x / rl, rz = cb.right.z / rl;
          // P7.1 T1: held rotation keys — past the tap window the key swings
          // the view continuously; a release inside it snaps 90° (see ku).
          if (view.keys.q) { view._rotHeld.q += dt; if (view._rotHeld.q > ROT_HOLD_S) R.rotateBy(-ROT_SPEED * dt); }
          if (view.keys.e) { view._rotHeld.e += dt; if (view._rotHeld.e > ROT_HOLD_S) R.rotateBy(ROT_SPEED * dt); }
          // POSSESSION (P4 T1, mk0.90): while possessed, WASD drives the
          // squad, NOT the camera — the pan block is gated off entirely.
          if (!input.possess) {
            if (view.keys.w || view.keys.arrowup) { run.focus.x += ux * pan; run.focus.z += uz * pan; }
            if (view.keys.s || view.keys.arrowdown) { run.focus.x -= ux * pan; run.focus.z -= uz * pan; }
            if (view.keys.a || view.keys.arrowleft) { run.focus.x -= rx * pan * 0.8; run.focus.z -= rz * pan * 0.8; }
            if (view.keys.d || view.keys.arrowright) { run.focus.x += rx * pan * 0.8; run.focus.z += rz * pan * 0.8; }
            run.focus.x = Math.max(-EXT.x, Math.min(EXT.x, run.focus.x));
            run.focus.z = Math.max(-EXT.z, Math.min(EXT.z, run.focus.z));
            run.focus.y = field.heightAt(run.focus.x, run.focus.z);
          }
          if (input.possess && input.possess.kind === "squad") {
            // The stick, camera-relative (the sandbox's own twin-stick math,
            // ContractSandbox.jsx :508-513): joystick wins if it's live,
            // WASD/arrows otherwise. The camera locks to the squad — no pan,
            // no drift; a touch drag one finger off the stick still nudges
            // it (pointermove below), but it snaps back here next frame.
            const cb2 = R.camBasis;
            const fl = Math.hypot(cb2.up.x, cb2.up.z) || 1, rl2 = Math.hypot(cb2.right.x, cb2.right.z) || 1;
            let st = 0, ss = 0;
            if (view.joy && view.joy.active) { st = view.joy.t; ss = view.joy.s; }
            else {
              st = (view.keys.w || view.keys.arrowup ? 1 : 0) + (view.keys.s || view.keys.arrowdown ? -1 : 0);
              ss = (view.keys.d || view.keys.arrowright ? 1 : 0) + (view.keys.a || view.keys.arrowleft ? -1 : 0);
            }
            input.possessInput = {
              vx: (cb2.right.x / rl2) * ss + (cb2.up.x / fl) * st,
              vz: (cb2.right.z / rl2) * ss + (cb2.up.z / fl) * st,
            };
            const psq = run.squads.find((q) => q.id === input.possess.id);
            if (psq) { run.focus.x = psq.anchor.x; run.focus.z = psq.anchor.z; run.focus.y = field.heightAt(run.focus.x, run.focus.z); }
          } else if (input.possess && input.possess.kind === "tower") {
            // POSSESSION (P4 T3, mk0.92): towers don't walk — no stick, no
            // possessInput. Camera locks to the tower exactly as it does to
            // a possessed squad.
            const ptw = world.byId.get(input.possess.id);
            if (ptw) { run.focus.x = ptw.pos.x; run.focus.z = ptw.pos.z; run.focus.y = field.heightAt(run.focus.x, run.focus.z); }
          } else if (input.possess && input.possess.kind === "vehicle") {
            const pv = world.byId.get(input.possess.id);
            if (pv) {
              run.focus.x = pv.pos.x; run.focus.z = pv.pos.z; run.focus.y = field.heightAt(run.focus.x, run.focus.z);
              const cbv = R.camBasis;
              const flv = Math.hypot(cbv.up.x, cbv.up.z) || 1, rlv = Math.hypot(cbv.right.x, cbv.right.z) || 1;
              let st = 0, ss = 0;
              if (view.joy && view.joy.active) { st = view.joy.t; ss = view.joy.s; }
              else {
                st = (view.keys.w || view.keys.arrowup ? 1 : 0) + (view.keys.s || view.keys.arrowdown ? -1 : 0);
                ss = (view.keys.d || view.keys.arrowright ? 1 : 0) + (view.keys.a || view.keys.arrowleft ? -1 : 0);
              }
              const wxv = (cbv.right.x / rlv) * ss + (cbv.up.x / flv) * st;
              const wzv = (cbv.right.z / rlv) * ss + (cbv.up.z / flv) * st;
              const magv = Math.min(1, Math.hypot(ss, st));
              pv.depotDrive = "manual";
              if (!pv.ctl) pv.ctl = { throttle: 0, steer: 0, brake: false };
              if (magv > 0.03) {
                const desired = Math.atan2(wxv, wzv);
                let errY = desired - Math.atan2(pv.R[6], pv.R[8]);
                while (errY > Math.PI) errY -= 2 * Math.PI;
                while (errY < -Math.PI) errY += 2 * Math.PI;
                pv.ctl.steer = Math.max(-1, Math.min(1, errY * 1.8));
                pv.ctl.throttle = magv * Math.max(0, Math.cos(errY));
                pv.ctl.brake = false;
              } else { pv.ctl.throttle = 0; pv.ctl.steer = 0; pv.ctl.brake = false; }
            }
          } else if (input.possess && input.possess.kind === "mech") {
            // THE MECH (mk1.92): camera locks to the hull, exactly as a
            // possessed tower or vehicle — the stick/keys/mouse are read at
            // SIM-TICK cadence inside feedMechCommands below, not here
            // (per-frame feeds fall the machine, the range's own law).
            const pm = world.byId.get(input.possess.id);
            if (pm) { run.focus.x = pm.pos.x; run.focus.z = pm.pos.z; run.focus.y = field.heightAt(run.focus.x, run.focus.z); }
          }
          if (input.possess) {
            // POSSESSION T4/T5 (mk0.93/0.94): THE CARRIED RETICLE. The right
            // stick wins if it's live (steerReticle — deflection is
            // velocity, the OFFSET holds on release, so walking carries the
            // reticle with the unit), same precedence the left stick uses
            // (view.joy.active above); otherwise the mouse sets the offset, the
            // sandbox's own convention (ContractSandbox.jsx :413-419/:530) —
            // positional, not velocity. Either way the offset is bounded to
            // the possessed unit's live sight circle every frame
            // (reclampReticle); its ground can go dark and it falls home to
            // the unit's cell. The world point the guns and the red ring
            // read is derived last.
            const rc = possessCenter();
            const rR = possessSightR();
            if (rc && view.reticleOff) {
              if (view.joyR && view.joyR.active) {
                const cb3 = R.camBasis;
                const fl3 = Math.hypot(cb3.up.x, cb3.up.z) || 1, rl3 = Math.hypot(cb3.right.x, cb3.right.z) || 1;
                const rv = {
                  vx: (cb3.right.x / rl3) * view.joyR.s + (cb3.up.x / fl3) * view.joyR.t,
                  vz: (cb3.right.z / rl3) * view.joyR.s + (cb3.up.z / fl3) * view.joyR.t,
                };
                view.reticleOff = steerReticle(T.sight, 1, rc, rR, view.reticleOff, rv.vx, rv.vz, dt, map.invW);
              } else if (!isTouch && view.pointer) {
                const gp = groundPoint(view.pointer.x, view.pointer.y);
                if (gp) view.reticleOff = { dx: gp.x - rc.x, dz: gp.z - rc.z };
              }
              view.reticleOff = reclampReticle(T.sight, 1, rc, rR, view.reticleOff, map.invW);
              input.reticle = { x: rc.x + view.reticleOff.dx, z: rc.z + view.reticleOff.dz };
              // mk2.01: THE SURFACE LAW — nothing blocks the steer; the
              // ground the reticle rests on aims the guns: a solid's top
              // when it sits on one (rooftops, wall tops), the dirt
              // otherwise. Where the shot truly ends is the predictor's
              // ring, never a steering clamp.
              input.reticle.y = surfaceAt(T.sight, input.reticle.x, input.reticle.z, map.invW).y;
              // mk1.99: THE STICKY SNAP — the RAW offset steers; the lock
              // only bends the derived aim onto the man, so pulling the raw
              // point past the radius is the deliberate escape.
              const lk9 = stickyLock(world, view.reticleLockId, input.reticle, T, map.invW);
              view.reticleLockId = lk9 ? lk9.id : null;
              if (lk9) input.reticle = { x: lk9.pos.x, z: lk9.pos.z };
              // P7 T2: keep the turret honest while possessed — the hull's
              // own aim yaw follows the live reticle every frame, not just
              // on a shot.
              if (input.possess.kind === "vehicle" && input.reticle) {
                const pv2 = world.byId.get(input.possess.id);
                if (pv2) pv2._aimYaw = Math.atan2(input.reticle.x - pv2.pos.x, input.reticle.z - pv2.pos.z);
              }
            }
          }
          if (!isTouch && view.pointer && run.started && !run.gameOver && !run.victory && !view.pending) {
            const p = groundPoint(view.pointer.x, view.pointer.y);
            if (p) {
              const g = grid.worldToGrid(p.x, p.z);
              if (grid.inBounds(g.gx, g.gz)) {
                const cell = grid.cells[grid.idx(g.gx, g.gz)];
                const wp = grid.gridToWorld(g.gx, g.gz);
                const spec = run.mode === "wall" ? null : TOWER_SPECS[run.mode];
                view.hover = { x: wp.x, z: wp.z, valid: !cell.blocked && !cell.wallId && !cell.ice, range: spec ? spec.range : 0 };
              } else view.hover = null;
            } else view.hover = null;
          } else view.hover = null;
          if (view.inspectId) {
            const ib = world.byId.get(view.inspectId);
            if (!ib) { view.inspectId = null; view.inspectReach = null; }
            else {
              const ispec = ib.kind === "tower" ? TOWER_SPECS[ib.towerType] : null;
              if (ispec && ib.towerType !== "tesla") {
                // Task 2b: an inspected GUN tower shows its true reach fan
                // (towerReachCached: real muzzle, fog-independent, computed
                // once per selection — static body). Frost keeps its aura
                // ring below (it is not a gun); walls keep no fan.
                if (!view.inspectReach) view.inspectReach = {};
                towerReachCached(view.inspectReach, world, ib, ispec, map.invW);
                view.hover = { x: ib.pos.x, z: ib.pos.z, valid: true, range: 0 };
              } else {
                view.inspectReach = null;
                view.hover = { x: ib.pos.x, z: ib.pos.z, valid: true, range: ispec ? ispec.range : 0 };
              }
            }
          } else view.inspectReach = null;
          // Selected squad: ring overlay at the anchor via the EXISTING hover
          // overlay API (read-only use — renderer belongs to a parallel
          // task). Ring radius = the squad's own weapon range.
          const selSq = view.selSquadId != null ? run.squads.find((q) => q.id === view.selSquadId) : null;
          // Honest ring: ring + chip render at the LIVE-MEMBER CENTROID, not
          // squad.anchor — the anchor is a virtual march point and can lead
          // the men (rubber-band bounds it to COHESION_M, but the ring should
          // sit on the troops, not the ghost). Render-only; falls back to the
          // anchor if no member is alive this frame.
          let sqCx = 0, sqCz = 0;
          if (selSq) {
            let nLive = 0;
            for (const id of selSq.memberIds) {
              const u = world.byId.get(id);
              if (u && u.alive) { sqCx += u.pos.x; sqCz += u.pos.z; nLive++; }
            }
            if (nLive) { sqCx /= nLive; sqCz /= nLive; }
            else { sqCx = selSq.anchor.x; sqCz = selSq.anchor.z; }
          }
          if (selSq) {
            // Every selected squad shows the TRUE reach fan (Task 2b: the
            // sniper's path, generalized to rifles/mg) — squadReach fires
            // from the member's head (pos.y + 0.5, squadFire's own muzzle),
            // elevation-scaled and terrain/solid-clipped, fog-independent
            // like the placement preview (null territory: what he COULD
            // see). The old flat spec.range ring read from the anchor's
            // ground and under-sold every elevated or crest-line shooter.
            // 1Hz refresh: defend micro-shuffles and attack legs move him.
            if (!view.selReach || view.selReach.id !== selSq.id || world.t - view.selReach.t > 1) {
              const u0 = selSq.memberIds.map((id) => world.byId.get(id)).find((u) => u && u.alive);
              const pts = u0 ? squadReach(world, selSq, null, map.invW) : null;
              view.selReach = pts ? { id: selSq.id, t: world.t, pts, cx: u0.pos.x, cz: u0.pos.z } : null;
            }
            view.hover = { x: sqCx, z: sqCz, valid: true, range: 0 };
          } else view.selReach = null;
          if (run.started && !run.gameOver && !run.victory) {
            if (run.manifest && run.manifest.cardUp) view.teachFire("convoy"); // idempotent — seen/queue gates inside
            // THE PRE-TOLL (Task 4). The last five seconds are counted out
            // loud. Edge-triggered on the countdown crossing each whole second
            // — ceiling-rounded exactly as the chip reads it — so it fires once
            // per second at any frame rate, once at 30fps and once at 120, and
            // not at all while paused (run.bellT only moves with world.t). The
            // ring itself resets bellT upward, which is not a crossing
            // downward, so the bell never gets a sixth tick.
            const bellSec = Math.ceil(run.bellT);
            if (bellSec !== preTollSec) {
              if (preTollSec != null && bellSec < preTollSec && bellSec >= 1 && bellSec <= 5) cue("pretoll");
              preTollSec = bellSec;
            }
          }
          view.acc += sdt;
          // T4 (war-engine-extraction): the bell, spawn/withdrawal, income,
          // territory/sight, mines, fog, dead-bag release, the pool rebuild,
          // stepDepot, the possessed triggers, the event drain, the census
          // and the market all moved into tickWar — one call per fixed
          // sub-step below. TickFlags tells the component which renderer
          // twins to refresh.
          let terrFlagged = false, dressFlagged = false;
          const frameEvents = [];
          const pSim0 = perf ? performance.now() : 0; // stopwatch: sim bracket opens
          let guard = 0;
          while (view.acc >= STEP && guard++ < 6) {
            view.acc -= STEP;
            const { events, flags } = tickWar(war, STEP, input);
            frameEvents.push(...events);
            if (flags.bell) { view.teachFire("bell"); run.manifest.armedAtWall = performance.now() / 1000 + PENDING_ARM_S; }
            if (flags.territory) terrFlagged = true;
            if (flags.dressing) dressFlagged = true;
            if (flags.withdrew) toast("THEY BREAK CONTACT");
            if (flags.teslaFired) view._teslaFired = (view._teslaFired || 0) + 1;
            for (const e of events) if (e.type === "kill") view.teachFire("kill_price");
          }
          if (perf) pSim = performance.now() - pSim0; // ...and closes
          if (view.acc > STEP * 6) view.acc = 0;
          // grid-line retint + terrain fog wash: same 4Hz cadence as the
          // territory field itself, not per frame (see renderer.js
          // updateTerritory/retintTerritory/updateFogWash).
          if (terrFlagged && R.updateTerritory) R.updateTerritory();
          // P7 T10: TRIGGERS — a 4Hz game-layer step, beside the territory
          // accumulator (NOT per sim tick). Cheap: setMines only rewrites the
          // two instanced pools when a device actually fired this tick.
          if (terrFlagged) R.setMines(run.mines);
          // mk2.50: map.TOWN FLAGS — holder-colored, render-only; neutral and
          // contested ground fly nothing, ruined buildings fly nothing
          // (they already pay nothing — economy.js payTown). Territory
          // cadence; derived, never saved.
          if (terrFlagged && R.setTownFlags) {
            const rows = [];
            for (const b of town) {
              const m = townFlagMeta.get(b.id);
              if (!m || m.depot || m.fwall || m.marker || b.ruined) continue;
              const c = map.invW(b.x, b.z);
              const h = holderAt(T, c.u, c.v);
              if (h !== 1 && h !== 2) continue;
              rows.push({ x: b.x, y: field.heightAt(b.x, b.z) + m.ny * MASON.pitch, z: b.z, team: h });
            }
            R.setTownFlags(rows);
          }
          // P7 T13 (owner): THE GREEN THREADS — every friendly ordered path,
          // green on the ground, refreshed with the other derived overlays.
          if (terrFlagged) {
            const paths = [];
            for (const sq of run.squads) {
              if (!sq.dest || sq.ridingIn != null) continue;
              if (sq.order !== "move" && sq.order !== "attack" && sq.order !== "build" && sq.order !== "patrol") continue;
              paths.push({ pts: [{ x: sq.anchor.x, z: sq.anchor.z }, ...(sq._route || []), { x: sq.dest.x, z: sq.dest.z }] });
            }
            for (const b of world.bodies) {
              if (b.kind !== "vehicle" || !b.alive || b.team !== 1 || !b.dest) continue;
              if (b.order !== "move" && b.order !== "patrol" && b.order !== "escort") continue;
              paths.push({ pts: [{ x: b.pos.x, z: b.pos.z }, ...(b._route || []), { x: b.dest.x, z: b.dest.z }] });
            }
            R.overlay.setOrderPaths(paths);
          }
          // mk2.14 (owner): a davy burst carved the ground, or a rock
          // breached — re-lay the rock dressing so surviving boulders sink
          // to the new surface instead of floating over the crater.
          if (dressFlagged) { R.setDressing({ rocks: rocksLive, ponds: map.PONDS, streams: streamRibs }); toast("THE RIDGE IS BREACHED"); }
          // THE MOVED BLOCK (T3 split, step 4.3): selection pruning is view
          // work — it left stepDepot and lands here, once per frame instead
          // of once per sim tick (a presentation-only cadence change).
          if (view.selSquadIds) { view.selSquadIds = view.selSquadIds.filter((id) => run.squads.some((q) => q.id === id)); if (view.selSquadIds.length < 2) view.selSquadIds = null; }
          if (view.selSquadId != null && !run.squads.some((q) => q.id === view.selSquadId)) {
            const nextId = view.selSquadIds ? view.selSquadIds.find((id) => id !== view.selSquadId) : null; // the group promotes its next squad
            if (nextId != null) view.selSquadId = nextId;
            else { view.selSquadId = null; view.orderMode = null; view.buildPt0 = null; view.selSquadIds = null; }
          }
          const evs = frameEvents;
          for (const e of evs) if (e.type === "zap") view._teslaZaps = (view._teslaZaps || 0) + 1;
          // ...and the frame's audio-only cues join the stream here, after the
          // wipe that would have eaten them (see the cue queue above).
          if (cues.length) { for (const c of cues) evs.push(c); cues.length = 0; }
          R.consume(evs);
          A.setListener(run.focus.x, run.focus.z, 46 / Math.max(0.6, run.zoom));
          A.consume(evs);
          A.tick(world, dt);
          // POSSESSION T5 (mk0.94): the reticle draws through its own red
          // ring, and the build hover never paints while possessed. mk2.01:
          // THE TRUE RETICLE — the ring is the LANDING BOUND: center at the
          // predicted impact (predictRing — the engine's own flight
          // arithmetic), radius at applyScatter's hard cap. No shot can
          // land outside it. For a squad the bound is drawn from the
          // farthest living shooter — every member's cone lands inside.
          R.setGrenades(world._grenades, world.t); // mk2.04: the grenade is seen — green, blinking red, quickening
          R.setGreenFog(run.fog, world.t); // mk2.09: the poison ground, seen
          let rr9 = 1.2, hit9 = null, ctr9 = null, pts9 = null;
          if (input.possess && input.reticle) {
            const P9 = input.possess;
            let spec9 = null, pb0 = null;
            if (P9.kind === "squad") {
              const sq9 = run.squads.find((q) => q.id === P9.id); spec9 = sq9 ? INFANTRY_ARMS[sq9.type] : null;
              if (sq9) for (const id of sq9.memberIds) {
                const u = world.byId.get(id);
                if (u && u.alive && u.role !== "spotter" && (!pb0 || Math.hypot(u.pos.x - input.reticle.x, u.pos.z - input.reticle.z) > Math.hypot(pb0.pos.x - input.reticle.x, pb0.pos.z - input.reticle.z))) pb0 = u;
              }
            }
            else { pb0 = world.byId.get(P9.id); if (pb0) spec9 = P9.kind === "tower" ? TOWER_SPECS[pb0.towerType] : P9.kind === "vehicle" ? BISON_FIRE.gun : null; }
            const rc9 = possessCenter();
            if (spec9 && spec9.acc != null && rc9) {
              const aim9 = { x: input.reticle.x, y: input.reticle.y != null ? input.reticle.y : field.heightAt(input.reticle.x, input.reticle.z), z: input.reticle.z }; // mk2.02: the surface itself — no phantom
              const muzzle9 = pb0 && P9.kind === "vehicle" ? barrelTip(pb0, aim9, spec9, pb0.vtype === "tank" ? BARRELS.tank : BARRELS.bison)
                                  : pb0 ? { x: pb0.pos.x, y: pb0.pos.y + (P9.kind === "tower" ? pb0.hy + 0.45 : 0.5), z: pb0.pos.z }
                                  : { x: rc9.x, y: field.heightAt(rc9.x, rc9.z) + 0.5, z: rc9.z };
              const sig9 = scatterSigma(world, muzzle9, aim9, { ...spec9, acc: spec9.acc * POSSESS_ACC });
              const pr9 = predictRing(T.sight, muzzle9, aim9, spec9, sig9, world.wind, map.invW);
              ctr9 = pr9.center;
              rr9 = Math.max(0.4, pr9.r);
              pts9 = pr9.pts;
              hit9 = pr9.center.wall ? { y: pr9.center.y, yaw: Math.atan2(pr9.rawDir.x, pr9.rawDir.z) } : null;
              // mk2.03: a possessed gun's barrel wears the live pitch.
              if (pb0) pb0._aimPitch = Math.asin(Math.max(-1, Math.min(1, pr9.rawDir.y)));
            }
          }
          R.overlay.setReticle(!!(input.possess && input.reticle),
            ctr9 ? ctr9.x : (input.reticle ? input.reticle.x : 0), ctr9 ? ctr9.z : (input.reticle ? input.reticle.z : 0),
            ctr9 ? ctr9.y : (input.reticle ? field.heightAt(input.reticle.x, input.reticle.z) : 0), rr9, hit9, pts9);
          if (!input.possess && view.hover) {
            R.overlay.setHover(true, view.hover.x, view.hover.z, field.heightAt(view.hover.x, view.hover.z), view.hover.range, view.hover.valid, map.GRID_CS);
          }
          else R.overlay.setHover(false);
          // mk1.95: THE PLACEMENT ZONE — its own ~4Hz WALL-time tick (the deal
          // phase runs with the sim frozen, so sdt can never drive it).
          zoneAcc += dt;
          if (zoneAcc >= 0.25) { zoneAcc = 0; refreshZone(); }
          if (view.pending) {
            const P0 = view.pending;
            R.overlay.setPending(true, P0.wp.x, P0.y, P0.wp.z, P0.poly, P0.ringR, P0.color, P0.fp);
          } else R.overlay.setPending(false);
          if (R.overlay.setReach) {
            // One overlay slot, one look: squad fan wins if a squad is
            // selected, else the inspected tower's cached fan (Task 2b).
            const fan = view.selReach || (view.inspectReach && view.inspectReach.pts ? view.inspectReach : null);
            if (fan) R.overlay.setReach(true, fan.cx, field.heightAt(fan.cx, fan.cz), fan.cz, fan.pts, 0xffd27a);
            else R.overlay.setReach(false);
          }
          // THE MECH (mk1.92): the trajectory preview, ported from
          // MechRange.jsx :418-441 — a low-passed ballistic arc from muzzle
          // to the commanded range, drawn through the war renderer's own
          // R.setTraj. Render-only; cleared on release (input.releasePossession).
          if (input.possess && input.possess.kind === "mech") {
            const pmR = world.byId.get(input.possess.id);
            if (pmR && pmR.mechRef) {
              try {
                const mech = pmR.mechRef;
                const raw = mechAimDir(world, mech);
                if (!view.pv) view.pv = { m: { ...raw.muzzle }, d: { ...raw.dir } };
                const k3 = Math.min(1, dt / 0.45);
                for (const ax of ["x", "y", "z"]) {
                  view.pv.m[ax] += (raw.muzzle[ax] - view.pv.m[ax]) * k3;
                  view.pv.d[ax] += (raw.dir[ax] - view.pv.d[ax]) * k3;
                }
                const dn = Math.hypot(view.pv.d.x, view.pv.d.y, view.pv.d.z) || 1;
                const muzzle = view.pv.m, dir = { x: view.pv.d.x / dn, y: view.pv.d.y / dn, z: view.pv.d.z / dn };
                const pts = [];
                let px = muzzle.x, py = muzzle.y, pz = muzzle.z;
                let vx = dir.x * 120, vy = dir.y * 120, vz = dir.z * 120;
                let hitIdx = -1;
                const st2 = ((mech.aimRange || 26) / 120) / 14;
                for (let k2 = 0; k2 < 22; k2++) {
                  pts.push({ x: px, y: py, z: pz });
                  vy -= 9.81 * st2;
                  px += vx * st2; py += vy * st2; pz += vz * st2;
                  if (py <= world.field.heightAt(px, pz)) { pts.push({ x: px, y: world.field.heightAt(px, pz), z: pz }); hitIdx = pts.length - 1; break; }
                }
                R.setTraj(pts, hitIdx);
              } catch (e) {}
            }
          }
          // mk0.53: the mk0.34 draw gate is gone — every frame draws (the
          // evidence run showed physics, not drawing, owns the frame budget).
          {
            const pRen0 = perf ? performance.now() : 0; // stopwatch: draw bracket
            R.render(dt, run.focus, AIM_OFF, 0);
            if (perf) { pRen = performance.now() - pRen0; pDrew = 1; }
            // ✓/✗ screen-space anchor (Task 3): rotation-proof because it's
            // recomputed from the live camera via project() — Q/E view
            // rotation or a pan moves the cell's projected point, and this
            // just follows it, rather than being pinned once at tap time.
            // Written to a ref-adjacent plain field on view (not React state)
            // so it doesn't force a rerender every frame; the hud tick
            // below (throttled to ~8Hz) is what actually pushes it to React.
            if (view.pending) {
              const P0 = view.pending;
              const nd = R.project ? R.project(P0.wp.x, P0.y + 1.6, P0.wp.z) : null;
              if (nd) {
                const rect = canvas.getBoundingClientRect();
                view.pendingScreen = { x: rect.left + (nd.x * 0.5 + 0.5) * rect.width, y: rect.top + (-nd.y * 0.5 + 0.5) * rect.height };
              } else view.pendingScreen = null;
              // mk0.27: pan/rotate far enough and the ✓/✗ pair leaves the
              // viewport — an invisible pending that still eats taps. Cancel
              // it out loud the moment its anchor goes off screen.
              if (!pendingButtonsVisible(view.pendingScreen, canvas.getBoundingClientRect())) {
                clearPending(); view.pendingScreen = null; toast("PLACEMENT CANCELLED — MOVED OFF SCREEN");
              }
            } else view.pendingScreen = null;
            // COMMAND T2 (mk0.84): the proposed line's END point only — the
            // buttons live there. Same screen-space recipe as pendingScreen,
            // but going off-screen HIDES the buttons WITHOUT cancelling the
            // pending (the line is big; panning around it is normal work).
            if (view.linePending && R.project) {
              const lp = view.linePending;
              const rect4 = canvas.getBoundingClientRect();
              const nd4 = R.project(lp.b.x, field.heightAt(lp.b.x, lp.b.z) + 1.2, lp.b.z);
              view.lineScreen = nd4 ? { x: rect4.left + (nd4.x * 0.5 + 0.5) * rect4.width, y: rect4.top + (-nd4.y * 0.5 + 0.5) * rect4.height } : null;
            } else view.lineScreen = null;
            // Squad chip + attack-flag anchors: screen-space, recomputed from
            // the live camera (rotation/pan-proof, same rationale as
            // pendingScreen above).
            if (selSq && R.project) {
              const rect2 = canvas.getBoundingClientRect();
              const toScreen = (x, y, z) => {
                const nd = R.project(x, y, z);
                return nd ? { x: rect2.left + (nd.x * 0.5 + 0.5) * rect2.width, y: rect2.top + (-nd.y * 0.5 + 0.5) * rect2.height } : null;
              };
              view.squadScreen = toScreen(sqCx, field.heightAt(sqCx, sqCz) + 2.2, sqCz);
              view.flagScreen = selSq.dest ? toScreen(selSq.dest.x, field.heightAt(selSq.dest.x, selSq.dest.z) + 1.6, selSq.dest.z) : null;
            } else { view.squadScreen = null; view.flagScreen = null; }
            // P7 T2: the Bison's pie anchor — same screen-space recipe,
            // projected off the hull top (the towerScreen recipe).
            if (view.selVehId != null && R.project) {
              const vb = world.byId.get(view.selVehId);
              if (vb && vb.alive) {
                const rect5 = canvas.getBoundingClientRect();
                const nd5 = R.project(vb.pos.x, vb.pos.y + vb.hy + 1.4, vb.pos.z);
                view.vehScreen = nd5 ? { x: rect5.left + (nd5.x * 0.5 + 0.5) * rect5.width, y: rect5.top + (-nd5.y * 0.5 + 0.5) * rect5.height } : null;
              } else view.vehScreen = null;
            } else view.vehScreen = null;
            // Tower radial anchor (COMMAND T1, mk0.80): the same screen-space
            // convention as the squad chip anchor above — projected off the
            // tower's top from the live camera every frame, rotation/pan-proof.
            if (view.inspectId && R.project) {
              const ib2 = world.byId.get(view.inspectId);
              if (ib2 && ib2.kind === "tower") {
                const rect3 = canvas.getBoundingClientRect();
                const nd3 = R.project(ib2.pos.x, ib2.pos.y + ib2.hy + 1.2, ib2.pos.z);
                view.towerScreen = nd3 ? { x: rect3.left + (nd3.x * 0.5 + 0.5) * rect3.width, y: rect3.top + (-nd3.y * 0.5 + 0.5) * rect3.height } : null;
              } else view.towerScreen = null;
            } else view.towerScreen = null;
          }
          view.hudT += dt;
          if (view.hudT > 0.12) {
            view.hudT = 0;
            let en = 0, nw = 0, nt = 0;
            for (const b of world.bodies) {
              if (b.kind === "unit" && b.alive && b.team === 2) en++;
              else if (b.kind === "wall") { if (!b.course) nw++; } // the HUD counts WALLS, not courses (P1.5 T2)
              else if (b.kind === "tower") nt++;
            }
            // P6 T10 / Task 5 Amendment 1 (mk1.19): the idle gate's flag —
            // the war is hot (pools worth building) while any enemy or
            // tower stands, or any squad is fielded. Stashed here (already
            // a full body walk) rather than adding a second one.
            run._hot = en > 0 || nt > 0 || run.squads.length > 0;
            const nowS = performance.now() / 1000;
            view.toasts = view.toasts.filter((t) => nowS - t.t < 2.2);
            setHud({
              // The bell being counted down TO — run.bell is the one that last
              // rang, so the top bar names the next one.
              fps: view.fps, bell: run.bell + 1, bellT: run.bellT, enemies: en,
              stones: R.chunkStats ? `${R.chunkStats().drawn}/${R.chunkStats().cap}` : "",
              resources: Math.floor(run.resources), walls: nw, towers: nt,
              score: { pk: run.score.p.kills, pv: Math.round(run.score.p.value), ek: run.score.e.kills, ev: Math.round(run.score.e.value) },
              lastDispatch: run.lastDispatch,
              // THE LIVING MARKET (mk1.13): the bar and the manifest read
              // prices off this same cache, out to the render each hud tick.
              prices: run._market ? { ...run._market.player } : null,
              // The manifest's mirror. Both cards arm on WORLD time (the
              // trailing-tap law), so the armed flag is computed here on the
              // hud tick exactly the way the pending ✓ already is.
              unlocked: run.manifest.unlocked.slice(),
              manifest: run.manifest.hand.length > 0 ? {
                up: !!run.manifest.cardUp, armed: performance.now() / 1000 >= (run.manifest.armedAtWall ?? 0),
                bell: run.manifest.offerBell,
                hand: run.manifest.hand.map((c) => {
                  const base = (PALETTE_BY_KEY[c.k] || { cost: 10 }).cost;
                  const live = priceNow(c.k, base);
                  return { k: c.k, hire: c.hire, price: c.hire ? live : Math.max(1, Math.ceil(live / 2)) };
                }),
              } : null,
              hiring: view.hirePlace ? { key: view.hirePlace.key, label: (PALETTE_BY_KEY[view.hirePlace.key] || {}).label } : null,
              info: view.infoKey ? { key: view.infoKey, door: view.infoDoor, armed: performance.now() / 1000 >= view.infoArmedWall } : null,
              teach: view._teachQ.length ? { key: view._teachQ[view._teachIdx], i: view._teachIdx, n: view._teachQ.length } : null,
              intel: run.intelUp && run.lastDispatch ? { armed: world.t >= run.intelArmedAt } : null,
              started: run.started, gameOver: run.gameOver, victory: run.victory,
              placing: view._placeQueue ? (view._placeQueue[0] || "done") : null, // P7.1 T6 A1: place mode must survive the ticker
              drafting: view._draftOpen && run.draft && !view._draftDone ? run.draft.map((c) => ({ k: c.k, plan: c.plan })) : null, // T8 A2: the draft survives the ticker (the mk1.69 law)
              endCard: endCardReady(run, world.t),   // mk0.29: the card waits out the collapse
              breach: run.breach, enemyBreach: run.enemyBreach,
              depotStanding: run.depotStanding != null ? run.depotStanding : 1,
              enemyStanding: run.enemyStanding != null ? run.enemyStanding : 1,
              mode: run.mode, sellMode: view.sellMode, sandbagOrient: run.sandbagOrient || 0, devSpawn: view.devSpawn, devDummies: input.devDummies,
              paused: view.paused, speed: view.speed,
              muted: A.muted, fogOn: view.fogOn, windOn: input.windOn, healthOn: view.healthOn, holdAreaOn: !!(run.holdArea && run.holdArea[1]), discipline: input.discipline, seed: map.MAP_SEED,
              toasts: view.toasts.map((t) => t.txt),
              squadSel: (() => {
                const sq = view.selSquadId != null ? run.squads.find((q) => q.id === view.selSquadId) : null;
                if (!sq || !view.squadScreen) return null;
                return { id: sq.id, label: SQUAD_SPECS[sq.type].label, order: sq.order, count: view.selSquadIds ? view.selSquadIds.length : 1, x: view.squadScreen.x, y: view.squadScreen.y, armed: world.t >= view.selArmedAt, aiming: view.orderMode === "attack", aimingMove: view.orderMode === "move",
                  // COMMAND 1b (mk0.82): the pie is up only while view.pieOpen —
                  // a wedge tap closes it but (for aiming orders) keeps the
                  // squad selected, so the status chip renders on its own.
                  showPie: !!view.pieOpen,
                  // P1.5 T4: the BUILD chips exist for engineer squads and no
                  // other type, so the row is per-squad-type by construction.
                  engineer: sq.type === "engineers",
                  // P7 T10: the sapper build gate — mirrors the engineer flag above.
                  sapper: sq.type === "sappers",
                  building: view.orderMode === "build_bags" ? "bags" : view.orderMode === "build_walls" ? "walls"
                          : view.orderMode === "build_mines" ? "mines" : view.orderMode === "build_wires" ? "wires" : null,
                  buildStart: !!view.buildPt0,
                  // COMMAND T3 (mk0.85): PATROL rides every squad type
                  // except engineers and sappers (tools, not shooters — the
                  // wedge would order them to walk a line they never fight
                  // on).
                  patrolOk: sq.type !== "engineers" && sq.type !== "sappers",
                  aimingPatrol: view.orderMode === "patrol",
                  // COMMAND T4 (mk0.86): STRUCTURES rides every armed squad
                  // type (an INFANTRY_ARMS row) — not engineers, not sappers,
                  // same population PATROL offers the wedge to. structFirst
                  // is the wedge's lit state.
                  structOk: !!INFANTRY_ARMS[sq.type],
                  structFirst: !!sq.prefStruct,
                  // COMMAND T2 (mk0.84): the squad stays selected while its
                  // line is up for confirmation — the center chip says so.
                  linePending: !!view.linePending };
              })(),
              squadFlag: view.flagScreen ? { x: view.flagScreen.x, y: view.flagScreen.y } : null,
              // POSSESSION (P4 T1/T3, mk0.90/mk0.92): the RELEASE button/
              // POSSESSED chip key off this — null the instant the squad or
              // tower is gone. The stick (data-joy) additionally checks
              // kind !== "tower" — towers don't walk.
              possessed: !input.possess ? null
                : input.possess.kind === "squad" ? (() => { const psq = run.squads.find((q) => q.id === input.possess.id); return psq ? { kind: "squad", label: SQUAD_SPECS[psq.type].label } : null; })()
                : input.possess.kind === "vehicle" ? (() => { const pv = world.byId.get(input.possess.id); return pv && pv.alive ? { kind: "vehicle", vtype: pv.vtype, label: pv.vtype === "apc" ? "APC" : "BISON" } : null; })()
                : input.possess.kind === "mech" ? (() => {
                    const pm = world.byId.get(input.possess.id);
                    if (!pm || !pm.alive || !pm.mechRef) return null;
                    return { kind: "mech", label: "MECH",
                      mslCd: Math.max(0, 6 - (world.t - (pm.mechRef._lastMsl ?? -99))),
                      brgCd: Math.max(0, 30 - (world.t - (pm.mechRef._lastBar ?? -99))),
                      aimRange: pm.mechRef.aimRange || 26 };
                  })()
                : (() => { const ptw = world.byId.get(input.possess.id); return ptw && ptw.kind === "tower" ? { kind: "tower", label: TOWER_SPECS[ptw.towerType].label } : null; })(),
              // P7 T2: the Bison's own pie, projected off the hull top (the
              // towerScreen recipe) — null unless a vehicle is selected.
              vehRadial: (() => {
                if (view.selVehId == null || !view.vehScreen) return null;
                const v = world.byId.get(view.selVehId);
                if (!v || !v.alive) return null;
                return { id: v.id, x: view.vehScreen.x, y: view.vehScreen.y, order: v.order || "defend", tracks: v.tracks || "careful",
                  kind: v.kind, vtype: v.vtype, seatsFree: v.vtype === "apc" ? APC.seats - apcSeated(world, run.squads, v.apcSeq) : 0,
                  riders: v.vtype === "apc" ? apcSeated(world, run.squads, v.apcSeq) : 0, aimingLoad: view.vehOrderMode === "load",
                  aimingMove: view.vehOrderMode === "move", aimingAttack: view.vehOrderMode === "attack", aimingPatrol: view.vehOrderMode === "patrol", aimingEscort: view.vehOrderMode === "escort",
                  patrolStart: !!view.buildPt0, armed: world.t >= view.selArmedAt, showPie: !!view.pieOpen, linePending: !!view.linePending };
              })(),
              // COMMAND T2 (mk0.84): the proposed line's accept/reject pair —
              // survives the end point going off-screen (buttons just hide).
              linePending: view.linePending && view.lineScreen ? {
                x: view.lineScreen.x, y: view.lineScreen.y,
                cost: view.linePending.cost, count: view.linePending.count,
                armed: pendingArmed(view.linePending, world.t), kind: view.linePending.kind,
              } : null,
              pending: view.pending && view.pendingScreen ? {
                x: view.pendingScreen.x, y: view.pendingScreen.y,
                cost: view.pending.cost, armed: pendingArmed(view.pending, world.t),
              } : null,
              inspect: (() => {
                if (!view.inspectId) return null;
                const b = world.byId.get(view.inspectId);
                if (!b) return null;
                const ispec = b.kind === "tower" ? TOWER_SPECS[b.towerType] : null;
                return {
                  id: b.id,
                  label: ispec ? ispec.label : "WALL",
                  hp: Math.max(0, Math.ceil(b.hp)), maxHp: b.maxHp,
                  refund: b.kind === "tower" ? Math.floor(ispec.cost * 0.6) : 3,
                  blurb: ispec ? ispec.blurb : "Bends their road.",
                };
              })(),
              // COMMAND T1 (mk0.80): the tower radial — CAREFUL/FREE toggle
              // (frost towers have no gun, so they skip that slot) and SELL,
              // for the inspected tower only. Walls keep their inspect
              // behavior untouched (no radial).
              towerRadial: (() => {
                if (!view.inspectId || !view.towerScreen) return null;
                const b = world.byId.get(view.inspectId);
                if (!b || b.kind !== "tower") return null;
                const ispec = TOWER_SPECS[b.towerType];
                return {
                  id: b.id, x: view.towerScreen.x, y: view.towerScreen.y,
                  label: ispec.label,
                  discipline: b.discipline || discipline || "careful",
                  refund: Math.floor(ispec.cost * 0.6),
                  // POSSESSION (P4 T3, mk0.92): TAKE CONTROL — gun towers
                  // only. Frost's fireRate is 0 (no gun to man).
                  canPossess: ispec.fireRate > 0,
                  showPie: !!view.pieOpen,   // COMMAND 1b (mk0.82)
                };
              })(),
            });
          }
          if (perf) {
            // stopwatch: one ring slot per rAF, written last so `frame` covers
            // the whole tick. Skipped draws record render 0 with drew false —
            // the reader averages the draw cost over drawn frames only.
            const pNow = performance.now();
            pSampT += dt;
            if (pSampT >= 1) {
              pSampT = 0;
              pBodies = world.bodies.length;
              const cs = R.chunkStats ? R.chunkStats() : null;
              pChunksDrawn = cs ? cs.drawn : 0; pChunksTotal = cs ? cs.total : 0;
            }
            pT[pI] = pNow; pSimA[pI] = pSim; pRenA[pI] = pRen;
            pFrmA[pI] = pNow - pFrame0; pDrewA[pI] = pDrew;
            pI = (pI + 1) % PCAP; pN++;
          }
        } catch (err) {
          console.error("COLDSNAP DEPOT frame failed", err);
          // HOTFIX mk1.37: the overlay names the throwing SITE — "non-finite" alone left the fault anonymous on a phone
          const top = err && err.stack ? String(err.stack).split("\n").slice(0, 3).join(" ⏎ ") : "";
          setFatal(String(err && err.message ? err.message : err) + (top ? " — " + top : ""));
          disposed = true;
        }
      };
      raf = requestAnimationFrame(frame);

      return () => {
        disposed = true;
        cancelAnimationFrame(raf);
        canvas.removeEventListener("pointerdown", onPointerDown);
        canvas.removeEventListener("pointermove", onPointerMove);
        canvas.removeEventListener("pointerup", onPointerUp);
        canvas.removeEventListener("pointercancel", onPointerUp);
        canvas.removeEventListener("contextmenu", onCtxMenu);
        canvas.removeEventListener("wheel", onWheel);
        canvas.removeEventListener("touchstart", blockTouch);
        window.removeEventListener("keydown", kd);
        window.removeEventListener("keyup", ku);
        for (const k of ["__DEPOT__", "__DEPOTBELL__", "__DEPOTBUILD__", "__DEPOTSPAWN__", "__DEPOTSTART__", "__DEPOTTREES__", "__DEPOTMG__", "__DEPOTSHELL__", "__DEPOTTHIN__", "__DEPOTEND__", "__DEPOTFOCUS__", "__DEPOTGETFOCUS__", "__DEPOTSETT__", "__DEPOTFLAGS__", "__DEPOTTOWN__", "__DEPOTHOLD__", "__DEPOTFINDBUILDABLE__", "__DEPOTFINDRISE__", "__DEPOTFINDNEARROCK__", "__DEPOTFOGDBG__", "__DEPOTFOGAT__", "__DEPOTENEMYPOS__", "__DEPOTSQUADS__", "__DEPOTSANDBAGS__", "__DEPOTGROUNDAT__", "__DEPOTSCREENAT__", "__DEPOTPENDING__", "__DEPOTMANIFEST__", "__DEPOTPICK__", "__DEPOTSAVE__", "__DEPOTGRIDAT__", "__DEPOTSQUAD__", "__DEPOTORDER__", "__DEPOTCELL__"]) delete window[k];
        A.dispose();
        if (R) R.dispose();
        stateRef.current = null;
      };
    } catch (err) {
      console.error("COLDSNAP DEPOT boot failed", err);
      // HOTFIX mk1.37: the overlay names the throwing SITE — "non-finite" alone left the fault anonymous on a phone
      const top = err && err.stack ? String(err.stack).split("\n").slice(0, 3).join(" ⏎ ") : "";
      setFatal(String(err && err.message ? err.message : err) + (top ? " — " + top : ""));
      if (R) R.dispose();
    }
  }, [isTouch, runId]);

  const setMode = (m) => {
    const C = stateRef.current; if (!C) return;
    if (C.run.gameOver || C.run.victory) return;   // mk0.29: the war is over — nothing left to build
    // mk1.95: hero keys are ordinary placement modes — no special case.
    // P7 T17 (owner): TAP AGAIN TO PUT IT AWAY — the active build button is
    // a toggle; the second tap clears back to plain command.
    if (C.run.mode === m) {
      if (C.view.linePending && C.view.rejectLine) C.view.rejectLine();
      C.run.mode = null; C.view.pending = null; C.view.buildPt0 = null; C.view.devSpawn = null;
      setHud((h) => ({ ...h, mode: null, devSpawn: null }));
      return;
    }
    // COMMAND T2 (mk0.84): switching build-menu mode with a line still up
    // clears it through the same door ✗ uses (rejectLine also disposes the
    // renderer's preview group) — it never lingers behind the new mode.
    if (C.view.linePending && C.view.rejectLine) C.view.rejectLine();
    C.run.mode = m; C.view.sellMode = false; C.view.inspectId = null; C.view.pending = null; C.view.selSquadId = null; C.view.selSquadIds = null; C.view.orderMode = null; C.view.buildPt0 = null; C.view.devSpawn = null;
    setHud((h) => ({ ...h, mode: m, sellMode: false, devSpawn: null }));
    // P7.1 T5: the pick arms the bar — the tree lands on the armed type's branch.
    const b = branchOf(m);
    if (b) setBranch(b);
  };
  const toggleSell = () => {
    const C = stateRef.current; if (!C) return;
    if (C.view.linePending && C.view.rejectLine) C.view.rejectLine();
    C.view.sellMode = !C.view.sellMode; C.view.inspectId = null; C.view.pending = null;
    if (C.view.sellMode && C.view.teachFire) C.view.teachFire("sell");
    setHud((h) => ({ ...h, sellMode: C.view.sellMode }));
  };
  // P7.1 T5: closing the tree clears back to plain command — the ruled
  // toggle-off, one door for mode, pending, half-given lines, and sell.
  const closeBuild = () => {
    beginPack(null, true);
    const C = stateRef.current; if (!C) return;
    if (C.view.linePending && C.view.rejectLine) C.view.rejectLine();
    C.run.mode = null; C.view.pending = null; C.view.buildPt0 = null; C.view.sellMode = false; C.view.devSpawn = null;
    setHud((h) => ({ ...h, mode: null, sellMode: false, devSpawn: null }));
  };
  const startGame = () => {
    const C = stateRef.current; if (!C) return;
    if (C.view.audio) C.view.audio.ensure();
    if (C.run.draft && C.run.draft.length && !C.view._draftDone) {
      // P7.2 T8: THE DRAFT — seven cards up, five picks, all free.
      C.view._draftOpen = true;
      if (C.view.teachFire) C.view.teachFire("the_hand");
      setHud((h) => ({ ...h, drafting: C.run.draft.map((c) => ({ k: c.k, plan: c.plan })) }));
      return;
    }
    C.view._placeQueue = null; // P7.1 T6 A2: the war has begun — the ticker must yield nothing
    C.run.started = true;
    if (C.view.teachFire) C.view.teachFire("desktop_keys");
    setHud((h) => ({ ...h, started: true, placing: null }));
  };
  const toggleMute = () => {
    const C = stateRef.current; if (!C || !C.view.audio) return;
    C.view.audio.ensure();
    C.view.audio.setMuted(!C.view.audio.muted);
    setHud((h) => ({ ...h, muted: C.view.audio.muted }));
  };
  const toggleFog = () => {
    const C = stateRef.current; if (!C || !C.view.setFog) return;
    C.view.setFog(!C.view.fogOn);
    if (C.view.teachFire) C.view.teachFire("fog");
    setHud((h) => ({ ...h, fogOn: C.view.fogOn }));
  };
  const toggleWind = () => {
    const C = stateRef.current; if (!C || !C.view.setWind) return;
    C.view.setWind(!C.input.windOn);
    if (C.view.teachFire) C.view.teachFire("wind");
    setHud((h) => ({ ...h, windOn: C.input.windOn }));
  };
  const toggleHealth = () => {
    const C = stateRef.current; if (!C || !C.view.setHealth) return;
    C.view.setHealth(!C.view.healthOn);
    setHud((h) => ({ ...h, healthOn: C.view.healthOn }));
  };
  // mk2.18: THE SWITCH — area weapons (tesla chain, davy blast) hold fire
  // with a friendly in the spread. Per side; only side 1 (the player) ever
  // flips (owner: symmetry is capability, side 2's row stays OFF, untouched).
  const toggleHoldArea = () => {
    const C = stateRef.current; if (!C || !C.run.holdArea) return;
    C.run.holdArea[1] = !C.run.holdArea[1];
    if (C.view.teachFire) C.view.teachFire("spare_ours");
    setHud((h) => ({ ...h, holdAreaOn: C.run.holdArea[1] }));
  };
  // mk2.26: THE FIGHT SWITCH — sandbox only, live, any time.
  const toggleDevFight = () => {
    const C = stateRef.current; if (!C) return;
    C.input.devDummies = !C.input.devDummies;
    setHud((h) => ({ ...h, devDummies: C.input.devDummies }));
  };
  // FIRE FEEDBACK (mk0.96): the held state, and the LOOK of the held state,
  // set in one place — direct DOM writes (the joystick knob's discipline, no
  // React state in the hot path). A hold the browser cancels pops the button
  // dark the instant it dies, so a silent drop is visible.
  const setFireHeld = (v) => {
    const C = stateRef.current; if (C) C.input.fireHeld = v;
    if (fireBtnRef.current) {
      fireBtnRef.current.style.background = v ? "#ff6b5e" : "#2a1418";
      fireBtnRef.current.style.color = v ? "#1a0d0f" : "#ff6b5e";
    }
  };
  // P7 T2: the coax MG's held state — mirrors setFireHeld with its own ref.
  const setMgHeld = (v) => {
    const C = stateRef.current; if (C) C.input.mgHeld = v;
    if (mgBtnRef.current) {
      mgBtnRef.current.style.background = v ? "#ffd27a" : "#2a2214";
      mgBtnRef.current.style.color = v ? "#1a1608" : "#ffd27a";
    }
  };
  const sellInspected = () => { const C = stateRef.current; if (C && C.view.inspectId && C.view.sellById) C.view.sellById(C.view.inspectId); };

  // Task 6 (mk2.44): THE ON-DEMAND DOOR — hold a carded control 450ms and
  // its card opens through the market-card door (no pause, nothing marked
  // seen); the release's click is swallowed. Press state rides a ref keyed
  // by card, so the 8Hz interface refresh can't strand a timer.
  const lpRef = useRef({});
  const teachPress = (k) => ({
    onPointerDown: () => { const o = lpRef.current[k] = lpRef.current[k] || {}; o.fired = false; o.t = setTimeout(() => { o.fired = true; const C = stateRef.current; if (C && C.view.openInfo) C.view.openInfo(k, "bar"); }, 450); },
    onPointerUp: () => { const o = lpRef.current[k]; if (o && o.t) clearTimeout(o.t); },
    onPointerLeave: () => { const o = lpRef.current[k]; if (o && o.t) clearTimeout(o.t); },
    onPointerCancel: () => { const o = lpRef.current[k]; if (o && o.t) clearTimeout(o.t); }, // phones cancel pointers (gestures, second fingers) — a cancelled press must not open the card
    onClickCapture: (e) => { const o = lpRef.current[k]; if (o && o.fired) { o.fired = false; e.preventDefault(); e.stopPropagation(); } },
  });

  // POSSESSION (P4 T1, mk0.90): the touch stick. Depot-styled port of the
  // sandbox's own joystick (ContractSandbox.jsx :365-380, :429-437) — radius
  // 56, deadzone 0.15, knob clamped to the radius and following the finger.
  // Unlike the sandbox's stick (a decorative pair with pointerEvents:none,
  // driven by a window-level proximity test) this one is its OWN real DOM
  // hit target, sitting above the canvas: a pointerdown on it never reaches
  // the canvas's pan/tap handlers at all (sibling elements, not ancestor/
  // descendant — the browser's own hit-test already settles it), and
  // setPointerCapture below pins every subsequent move/up to it too, so a
  // drag that strays off the knob still can't leak to the canvas underneath.
  const JOY_R = 56;
  const joyDz = (v) => (Math.abs(v) < 0.15 ? 0 : (v - Math.sign(v) * 0.15) / 0.85);
  const moveJoy = (e) => {
    const C = stateRef.current;
    if (!C || !C.view.joy || !C.view.joy.active) return;
    const r = e.currentTarget.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let dx = e.clientX - cx, dy = e.clientY - cy;
    const L = Math.hypot(dx, dy);
    if (L > JOY_R) { dx *= JOY_R / L; dy *= JOY_R / L; }
    if (joyKnobRef.current) { joyKnobRef.current.style.left = 70 + dx - 22 + "px"; joyKnobRef.current.style.top = 70 + dy - 22 + "px"; }
    C.view.joy.t = joyDz(-dy / JOY_R);
    C.view.joy.s = joyDz(dx / JOY_R);
  };
  const releaseJoy = () => {
    const C = stateRef.current;
    if (C) C.view.joy = { active: false, t: 0, s: 0 };
    if (joyKnobRef.current) { joyKnobRef.current.style.left = "48px"; joyKnobRef.current.style.top = "48px"; }
  };
  // POSSESSION T4 (mk0.93): the right stick — same math, own knob ref, own
  // live state (view.joyR), mirrored from moveJoy/releaseJoy above.
  const moveJoyR = (e) => {
    const C = stateRef.current;
    if (!C || !C.view.joyR || !C.view.joyR.active) return;
    const r = e.currentTarget.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let dx = e.clientX - cx, dy = e.clientY - cy;
    const L = Math.hypot(dx, dy);
    if (L > JOY_R) { dx *= JOY_R / L; dy *= JOY_R / L; }
    if (joyRKnobRef.current) { joyRKnobRef.current.style.left = 70 + dx - 22 + "px"; joyRKnobRef.current.style.top = 70 + dy - 22 + "px"; }
    C.view.joyR.t = joyDz(-dy / JOY_R);
    C.view.joyR.s = joyDz(dx / JOY_R);
  };
  const releaseJoyR = () => {
    const C = stateRef.current;
    if (C) C.view.joyR = { active: false, t: 0, s: 0 };
    if (joyRKnobRef.current) { joyRKnobRef.current.style.left = "48px"; joyRKnobRef.current.style.top = "48px"; }
  };

  // The bar shows the UNLOCKED set and nothing else (P1 Task 2): a locked
  // item does not render at all — no greyed teasers, because the manifest
  // card IS the reveal. PALETTE's own order is preserved, so an item always
  // arrives in the same slot position it will keep for the rest of the match.
  const unlocked = hud.unlocked || [];
  const palette = PALETTE.filter((p) => unlocked.indexOf(p.key) >= 0);

  // mk2.31: THE LATTICE's rung tags — a rack tag (foes) or a palette tag,
  // today's whole bodies carried over verbatim, packing appended on tap.
  const renderLatticeTag = (cat, k, ti, ri) => {
    const entranceDelay = (0.17 + ri * 0.06 + ti * 0.035) + "s";
    const tilt = ti % 2 ? 1.5 : -2;
    const packStyle = packing ? { animation: "cs-pack 0.12s ease-in forwards", animationDelay: (ti * 0.02) + "s" } : {};
    if (cat === "foes") {
      const f = FOE_RACK.find((x) => x.key === k);
      if (!f) return null;
      return (
        <StockTag key={f.key} data-foe-key={f.key}
          tilt={tilt} delay={entranceDelay}
          style={{ minWidth: isTouch ? 56 : 52, borderColor: hud.devSpawn === f.key ? "#ff6b5e" : "#8f8768", background: hud.devSpawn === f.key ? "#d8c9a5" : "#cfc6a5", ...packStyle }}
          onClick={() => {
            const C = stateRef.current; if (!C) return;
            C.view.devSpawn = C.view.devSpawn === f.key ? null : f.key;
            C.run.mode = null; C.view.pending = null; C.view.sellMode = false;
            setHud((h) => ({ ...h, devSpawn: C.view.devSpawn, mode: null, sellMode: false }));
            beginPack(null, true);
          }}>
          <div style={{ fontSize: 15 }}>{f.icon}</div>
          <div>{f.label}</div>
          <div style={{ color: "#8a2f2f", fontSize: 10, fontWeight: 600 }}>ENEMY</div>
        </StockTag>
      );
    }
    const p = palette.find((x) => x.key === k);
    if (!p) return null;
    const k2 = p.key;
    const sel = !hud.sellMode && hud.mode === k2;
    const priceP = hud.prices?.[k2] ?? p.cost;
    const afford = hud.resources >= priceP;
    return (
      <StockTag key={cat + ":" + k2} data-tower-key={k2}
        tilt={tilt} delay={entranceDelay}
        style={{ minWidth: isTouch ? 56 : 52, opacity: afford ? 1 : 0.45, borderColor: sel ? "#2f7a44" : "#8f8768", background: sel ? "#d3d6a8" : "#cfc6a5", ...packStyle }}
        onClick={() => { setMode(k2); beginPack(null, true); }}>
        <div data-info={k2} onClick={(e) => { e.stopPropagation(); const C = stateRef.current; if (C && C.view.openInfo) C.view.openInfo(k2, "bar"); }}
          style={{ position: "absolute", top: 1, right: 3, fontSize: 12, opacity: 0.6, padding: "2px 4px", cursor: "pointer" }}>ⓘ</div>
        <div style={{ fontSize: 15 }}>{p.icon}</div>
        <div>{p.label}</div>
        <div style={{ color: "#7a5a1e" }}>◆{priceP}</div>
      </StockTag>
    );
  };

  return (
    <div style={P.root}>
      <canvas key={runId} ref={canvasRef} style={P.cv} />
      {/* POSSESSION (P4 T1, mk0.90) ------------------------------------- */}
      {hud.possessed && (
        <div data-possessed-chip style={{ position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)", zIndex: 6, background: "rgba(14,18,24,0.88)", border: "1px solid #7dffa8", color: "#7dffa8", borderRadius: 6, padding: "3px 12px", fontSize: 12, letterSpacing: 1, pointerEvents: "none" }}>
          POSSESSED — {hud.possessed.label}
        </div>
      )}
      {/* POSSESSION (P4 T3, mk0.92): no stick for towers — they don't walk. */}
      {isTouch && hud.possessed && hud.possessed.kind !== "tower" && (
        <div data-joy
          style={{ position: "absolute", left: 92 - 70, bottom: 128 - 70, width: 140, height: 140, zIndex: 7, touchAction: "none" }}
          onPointerDown={(e) => {
            e.stopPropagation();
            e.currentTarget.setPointerCapture(e.pointerId);
            const C = stateRef.current; if (!C) return;
            C.view.joy = { active: true, t: 0, s: 0 };
            moveJoy(e);
          }}
          onPointerMove={(e) => { e.stopPropagation(); moveJoy(e); }}
          onPointerUp={(e) => { e.stopPropagation(); releaseJoy(); }}
          onPointerCancel={(e) => { e.stopPropagation(); releaseJoy(); }}
        >
          <div style={{ position: "absolute", left: 70 - 56, top: 70 - 56, width: 112, height: 112, borderRadius: "50%", border: "2px solid rgba(125,255,168,0.55)", background: "rgba(20,24,30,0.35)", pointerEvents: "none" }} />
          <div ref={joyKnobRef} style={{ position: "absolute", left: 48, top: 48, width: 44, height: 44, borderRadius: "50%", background: "rgba(125,255,168,0.75)", border: "2px solid #7dffa8", pointerEvents: "none" }} />
        </div>
      )}
      {/* POSSESSION T4 (mk0.93): the right stick — steers the reticle.
          Shown for BOTH possessed kinds (towers have no left stick, so this
          is their whole interface). */}
      {isTouch && hud.possessed && (
        <div data-joyr
          style={{ position: "absolute", right: 92 - 70, bottom: 208 - 70, width: 140, height: 140, zIndex: 7, touchAction: "none" }}
          onPointerDown={(e) => {
            e.stopPropagation();
            e.currentTarget.setPointerCapture(e.pointerId);
            const C = stateRef.current; if (!C) return;
            C.view.joyR = { active: true, t: 0, s: 0 };
            moveJoyR(e);
          }}
          onPointerMove={(e) => { e.stopPropagation(); moveJoyR(e); }}
          onPointerUp={(e) => { e.stopPropagation(); releaseJoyR(); }}
          onPointerCancel={(e) => { e.stopPropagation(); releaseJoyR(); }}
        >
          <div style={{ position: "absolute", left: 70 - 56, top: 70 - 56, width: 112, height: 112, borderRadius: "50%", border: "2px solid rgba(125,255,168,0.55)", background: "rgba(20,24,30,0.35)", pointerEvents: "none" }} />
          <div ref={joyRKnobRef} style={{ position: "absolute", left: 48, top: 48, width: 44, height: 44, borderRadius: "50%", background: "rgba(125,255,168,0.75)", border: "2px solid #7dffa8", pointerEvents: "none" }} />
        </div>
      )}
      {hud.possessed && (
        <button data-possess-release
          style={{ ...P.btnBig, position: "absolute", right: 16, bottom: 16, zIndex: 7, borderColor: "#ffb45e", color: "#ffb45e", fontWeight: "bold" }}
          onClick={() => stateRef.current && stateRef.current.input.releasePossession()}>
          RELEASE
        </button>
      )}
      {/* POSSESSION (P4 T2, mk0.91) — FIRE: hold-to-repeat, like the
          sandbox's own trigger. Sets input.fireHeld; the sim bracket (frame loop)
          is what actually attempts a volley, at most once per sim tick. */}
      {isTouch && hud.possessed && (
        <button data-possess-fire ref={fireBtnRef}
          style={{ ...P.btnBig, position: "absolute", right: 132, bottom: 16, zIndex: 7, width: 64, height: 64, borderRadius: "50%", borderColor: "#ff6b5e", color: "#ff6b5e", fontWeight: "bold", background: "#2a1418", touchAction: "none" }}
          onPointerDown={(e) => { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); setFireHeld(true); }}
          onPointerUp={(e) => { e.stopPropagation(); setFireHeld(false); }}
          onPointerCancel={(e) => { e.stopPropagation(); setFireHeld(false); }}>
          FIRE
        </button>
      )}
      {/* P7 T2: the Bison's coax — vehicle possession only, beside FIRE.
          P7 T4: not the APC — one gun, FIRE alone. */}
      {isTouch && hud.possessed && hud.possessed.kind === "vehicle" && hud.possessed.vtype !== "apc" && (
        <button data-possess-mg ref={mgBtnRef}
          style={{ ...P.btnBig, position: "absolute", right: 208, bottom: 16, zIndex: 7, width: 64, height: 64, borderRadius: "50%", borderColor: "#ffd27a", color: "#ffd27a", fontWeight: "bold", background: "#2a2214", touchAction: "none" }}
          onPointerDown={(e) => { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); setMgHeld(true); }}
          onPointerUp={(e) => { e.stopPropagation(); setMgHeld(false); }}
          onPointerCancel={(e) => { e.stopPropagation(); setMgHeld(false); }}>
          MG
        </button>
      )}
      {/* THE MECH (mk1.92): PUNT/MSL/BRG stack above FIRE, cooldown-grey on
          MSL/BRG; the range slider + trim pair set view.mechAimRange/mechAimHeld,
          consumed by feedMechCommands at sim-tick cadence. */}
      {isTouch && hud.possessed && hud.possessed.kind === "mech" && (
        <>
          <button data-mech-punt
            onPointerDown={(e) => { e.stopPropagation(); const C = stateRef.current; if (C) (C.input.mechWant || (C.input.mechWant = {})).punt = true; }}
            style={{ ...P.btnBig, position: "absolute", right: 132, bottom: 100, zIndex: 7, touchAction: "none" }}>
            PUNT
          </button>
          <button data-mech-msl
            onPointerDown={(e) => { e.stopPropagation(); const C = stateRef.current; if (C) (C.input.mechWant || (C.input.mechWant = {})).msl = true; }}
            style={{ ...P.btnBig, position: "absolute", right: 132, bottom: 152, zIndex: 7, touchAction: "none", opacity: hud.possessed.mslCd > 0.1 ? 0.5 : 1, color: hud.possessed.mslCd > 0.1 ? "#7a6055" : "#e8c9b8" }}>
            {hud.possessed.mslCd > 0.1 ? "▲▲ " + Math.ceil(hud.possessed.mslCd) + "s" : "▲▲ MSL"}
          </button>
          <button data-mech-brg
            onPointerDown={(e) => { e.stopPropagation(); const C = stateRef.current; if (C) (C.input.mechWant || (C.input.mechWant = {})).brg = true; }}
            style={{ ...P.btnBig, position: "absolute", right: 132, bottom: 204, zIndex: 7, touchAction: "none", opacity: hud.possessed.brgCd > 0.1 ? 0.5 : 1, color: hud.possessed.brgCd > 0.1 ? "#7a6055" : "#e8c9b8" }}>
            {hud.possessed.brgCd > 0.1 ? "▲▲▲ " + Math.ceil(hud.possessed.brgCd) + "s" : "▲▲▲ BRG"}
          </button>
          <div data-mech-rangeslider
            onPointerDown={(e) => {
              e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId);
              const C = stateRef.current; if (!C) return;
              C.view._mechRngGrab = true;
              const r = e.currentTarget.getBoundingClientRect();
              C.view.mechAimRange = 6 + Math.max(0, Math.min(1, (r.bottom - e.clientY) / r.height)) * 74;
            }}
            onPointerMove={(e) => {
              e.stopPropagation();
              const C = stateRef.current; if (!C || !C.view._mechRngGrab) return;
              const r = e.currentTarget.getBoundingClientRect();
              C.view.mechAimRange = 6 + Math.max(0, Math.min(1, (r.bottom - e.clientY) / r.height)) * 74;
            }}
            onPointerUp={(e) => { e.stopPropagation(); const C = stateRef.current; if (C) C.view._mechRngGrab = false; }}
            onPointerCancel={(e) => { e.stopPropagation(); const C = stateRef.current; if (C) C.view._mechRngGrab = false; }}
            style={{ position: "absolute", right: 12, bottom: 292, width: 44, height: 150, borderRadius: 8, background: "rgba(28,33,41,0.75)", border: "1px solid #7a6a4e", touchAction: "none", zIndex: 7 }}>
            <div style={{ position: "absolute", left: 20, top: 6, bottom: 6, width: 3, background: "#5f6e80" }} />
            <div style={{ position: "absolute", left: 4, width: 36, height: 22, borderRadius: 5, background: "#b89a5e", bottom: Math.max(0, Math.min(128, ((hud.possessed.aimRange - 6) / 74) * 128)) }} />
          </div>
          <div style={{ position: "absolute", right: 8, bottom: 446, width: 52, textAlign: "center", color: "#e8d9b8", fontSize: 13, textShadow: "0 1px 2px #000", zIndex: 7, pointerEvents: "none" }}>{Math.round(hud.possessed.aimRange)}m</div>
          <button data-mech-aiml
            onPointerDown={(e) => { e.stopPropagation(); const C = stateRef.current; if (C) C.view.mechAimHeld = -1; }}
            onPointerUp={(e) => { e.stopPropagation(); const C = stateRef.current; if (C) C.view.mechAimHeld = 0; }}
            onPointerLeave={() => { const C = stateRef.current; if (C) C.view.mechAimHeld = 0; }}
            onPointerCancel={() => { const C = stateRef.current; if (C) C.view.mechAimHeld = 0; }}
            style={{ ...P.btnBig, position: "absolute", left: "calc(50% - 100px)", bottom: 16, width: 56, zIndex: 7, touchAction: "none" }}>{"◀"}</button>
          <button data-mech-aimr
            onPointerDown={(e) => { e.stopPropagation(); const C = stateRef.current; if (C) C.view.mechAimHeld = 1; }}
            onPointerUp={(e) => { e.stopPropagation(); const C = stateRef.current; if (C) C.view.mechAimHeld = 0; }}
            onPointerLeave={() => { const C = stateRef.current; if (C) C.view.mechAimHeld = 0; }}
            onPointerCancel={() => { const C = stateRef.current; if (C) C.view.mechAimHeld = 0; }}
            style={{ ...P.btnBig, position: "absolute", left: "calc(50% + 44px)", bottom: 16, width: 56, zIndex: 7, touchAction: "none" }}>{"▶"}</button>
        </>
      )}
      <div style={P.top}>
        <div style={P.stat} {...teachPress("scrap")}><span style={{ color: "#ffd27a" }}>◆</span>{hud.resources}</div>
        {!dev && (
          <div data-bell style={{ ...P.stat, cursor: hud.lastDispatch ? "pointer" : "default" }}
            onClick={() => { if (hud.lastDispatch) setRereadDispatch(true); }}
            title={hud.lastDispatch ? "re-read last dispatch" : undefined}
            {...teachPress("bell")}>
            BELL {hud.bell} · {clockStr(hud.bellT)}
          </div>
        )}
        <div style={P.stat}>☠ {hud.enemies}</div>
        <div data-score style={P.stat} title="the match score — kills and value destroyed, yours then the enemy's" {...teachPress("kill_price")}>
          <span style={{ color: "#7dffa8" }}>⚔ {hud.score.pk} ◆{hud.score.pv}</span>
          <span style={{ opacity: 0.5 }}>·</span>
          <span style={{ color: "#ff7a7a" }}>{hud.score.ek} ◆{hud.score.ev}</span>
        </div>
        {/* The dismissed manifest waits here — and only until the next bell,
            which re-pools the offer. A skipped bell is a skipped pick. */}
        {hud.manifest && !hud.manifest.up && !hud.gameOver && !hud.victory && (
          <div data-manifest-chip style={{ ...P.stat, cursor: "pointer", borderColor: "#ffd27a", color: "#ffd27a" }}
            title="the convoy is still waiting on your pick"
            onClick={() => { const C = stateRef.current; if (C && C.view.openManifest) C.view.openManifest(); }}>
            ⛊ MANIFEST
          </div>
        )}
        {hud.started && !hud.victory && !hud.gameOver && (
          <>
            <button style={{ ...P.btn, padding: isTouch ? "5px 10px" : "4px 10px", borderColor: hud.paused ? "#ffd27a" : "#48515f", color: hud.paused ? "#ffd27a" : "#e6ebf1" }}
              onClick={() => { const C = stateRef.current; if (C) { C.view.paused = !C.view.paused; setHud((h) => ({ ...h, paused: C.view.paused })); } }}>
              {hud.paused ? "▶" : "❚❚"}
            </button>
            <button style={{ ...P.btn, padding: isTouch ? "5px 10px" : "4px 10px", borderColor: hud.speed > 1 ? "#7fd7ff" : "#48515f" }}
              onClick={() => { const C = stateRef.current; if (C) { C.view.speed = C.view.speed > 1 ? 1 : 2; setHud((h) => ({ ...h, speed: C.view.speed })); } }}>
              {hud.speed > 1 ? "2×" : "1×"}
            </button>
          </>
        )}
        {dev && (
          <button data-dev-reroll style={{ ...P.btn, marginLeft: "auto", padding: isTouch ? "5px 10px" : "4px 10px", borderColor: "#c9a04e", color: "#ffd27a" }} title="a fresh random valley — everything here is discarded" onClick={restart}>
            NEW VALLEY
          </button>
        )}
        {dev && (
          <button data-dev-fight style={{ ...P.btn, padding: isTouch ? "5px 10px" : "4px 10px", borderColor: hud.devDummies ? "#48515f" : "#ff6b5e", color: hud.devDummies ? "#e6ebf1" : "#ff6b5e" }} title="whether placed enemies fight back — flips live" onClick={toggleDevFight}>
            {hud.devDummies ? "THEY STAND" : "THEY FIGHT"}
          </button>
        )}
        <button style={{ ...P.btn, marginLeft: dev ? undefined : "auto", padding: isTouch ? "5px 10px" : "4px 10px" }} title="rotate view (Q/E)"
          onClick={() => { const C = stateRef.current; if (C && C.view.rotate) C.view.rotate(1); }}>⟳</button>
        <button style={{ ...P.btn, padding: isTouch ? "5px 10px" : "4px 10px", borderColor: hud.fogOn ? "#7fd7ff" : "#48515f", opacity: hud.fogOn ? 1 : 0.6 }} title="fog of war (visual only)" onClick={toggleFog} {...teachPress("fog")}>
          FOG {hud.fogOn ? "ON" : "OFF"}
        </button>
        <button data-health style={{ ...P.btn, padding: isTouch ? "5px 10px" : "4px 10px", borderColor: hud.healthOn ? "#7fd7ff" : "#48515f", opacity: hud.healthOn ? 1 : 0.6 }} title="health bars on hurt things (visual only)" onClick={toggleHealth}>
          HEALTH {hud.healthOn ? "ON" : "OFF"}
        </button>
        <button data-wind style={{ ...P.btn, padding: isTouch ? "5px 10px" : "4px 10px", borderColor: hud.windOn ? "#7fd7ff" : "#48515f", opacity: hud.windOn ? 1 : 0.6 }} title="wind (drift on every shot, both sides)" onClick={toggleWind} {...teachPress("wind")}>
          WIND {hud.windOn ? "ON" : "OFF"}
        </button>
        <button data-holdarea style={{ ...P.btn, padding: isTouch ? "5px 10px" : "4px 10px", borderColor: hud.holdAreaOn ? "#7fd7ff" : "#48515f", opacity: hud.holdAreaOn ? 1 : 0.6 }} title="area weapons (tesla chain, davy blast) hold fire while one of your own stands in the spread" onClick={toggleHoldArea} {...teachPress("spare_ours")}>
          SPARE OURS {hud.holdAreaOn ? "ON" : "OFF"}
        </button>
        <button style={{ ...P.btn, padding: isTouch ? "5px 10px" : "4px 10px", opacity: hud.muted ? 0.5 : 1 }} onClick={toggleMute}>
          {hud.muted ? "🔇" : "🔊"}
        </button>
        {onExit && (
          <button data-menu-exit
            style={{ ...P.btn, padding: isTouch ? "5px 10px" : "4px 10px", borderColor: menuArmed ? "#ff6b5e" : "#48515f", color: menuArmed ? "#ff6b5e" : "#e6ebf1" }}
            onClick={() => { if (menuArmed) { setMenuArmed(false); onExit(); } else setMenuArmed(true); }}>
            {menuArmed ? "LEAVE THE FIELD?" : "⏏ MENU"}
          </button>
        )}
        <div style={{ ...P.stat, opacity: 0.65 }}>{hud.fps} fps · {hud.stones || "0/0"} · {MK}</div>
      </div>

      {hud.toasts && hud.toasts.length > 0 && (
        <div style={P.toastWrap}>
          {hud.toasts.map((t, i) => <div key={i} style={P.toast}>{t}</div>)}
        </div>
      )}

      {/* THE INTEL CARD — first thing in the bell sequence. Floating, so it
          cannot eat a combat tap; dismissible; and the assault it precedes
          marches whether or not it is ever read. The bell chip re-reads it
          (as a proper modal) any time after. */}
      {hud.intel && hud.lastDispatch && !rereadDispatch && !hud.gameOver && !hud.victory && (
        <Dispatch
          dispatch={hud.lastDispatch}
          gating={false}
          floating
          armed={hud.intel.armed}
          label="ACKNOWLEDGE"
          onAcknowledge={() => { const C = stateRef.current; if (C && C.view.ackIntel) C.view.ackIntel(); }}
        />
      )}

      {/* Re-read: the bell chip's modal copy of the same dispatch. */}
      {rereadDispatch && hud.lastDispatch && (
        <Dispatch
          dispatch={hud.lastDispatch}
          gating={false}
          onAcknowledge={() => setRereadDispatch(false)}
        />
      )}

      {/* THE MANIFEST CARD — the convoy's offer. Same floating idiom as the
          intel card (no scrim, corner-parked, only the card box takes taps),
          pick buttons armed on world time. LATER dismisses it to the top-bar
          chip; the next bell overwrites the offer either way. */}
      {hud.manifest && hud.manifest.up && !hud.gameOver && !hud.victory && (
        <div style={P.cardWrap}>
          <div data-manifest-card style={{ ...P.panel, position: "static", pointerEvents: "auto", borderColor: "#ffd27a", width: "min(300px, 44vw)" }}>
            <style>{`@keyframes cs-deal { from { opacity: 0; transform: translate(-14px, 10px) rotate(-6deg) scale(0.88); } to { opacity: 1; transform: var(--restT, none); } }`}</style>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, marginBottom: 10, borderBottom: "1px solid #2c3846", paddingBottom: 8 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <CrateChip label="THE CONVOY" icon="⚒" open={true} style={{ minWidth: 0, minHeight: 0, padding: "2px 6px", background: "transparent", border: "none" }} />
                <span style={{ color: "#ffd27a", letterSpacing: 2 }}>CONVOY MANIFEST</span>
              </span>
              <span style={{ opacity: 0.6 }}>BELL {hud.manifest.bell}</span>
            </div>
            <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 10, lineHeight: 1.5 }}>
              Plans build; hires march. Take what your scrap can carry.
              {/* The teaching line, first truck only (mk0.50). Deterministic on
                  the bell index — bell 1 is the first bell of any match, so
                  nothing is stored, nothing is flagged, and a resumed save
                  shows it again only if it resumed to bell 1. */}
              {hud.manifest.bell === 1 && (
                <div data-manifest-teach style={{ marginTop: 6, color: "#ffd27a", opacity: 0.9 }}>
                  The convoy returns each bell — plans build, hires march.
                </div>
              )}
            </div>
            {hud.manifest.hand.map((c, ci) => {
              const it = PALETTE_BY_KEY[c.k];
              if (!it) return null;
              return (
                <StockTag key={ci + ":" + c.k} data-manifest-offer={c.k} data-hand-kind={c.hire ? "hire" : "plan"}
                  tilt={ci % 2 ? 0.8 : -1.2} delay={(ci * 0.05) + "s"}
                  style={{ boxSizing: "border-box", width: "100%", minHeight: 44, marginBottom: 6, flexDirection: "row", alignItems: "center", gap: 10, textAlign: "left", padding: "8px 10px 8px 22px", opacity: hud.manifest.armed ? 1 : 0.5 }}
                  onClick={() => { const C = stateRef.current; if (C && C.view.openInfo) C.view.openInfo(c.k, c.hire ? "hire" : "manifest"); }}>
                  <span style={{ fontSize: 18 }}>{it.icon}</span>
                  <span style={{ flex: 1 }}>{it.label}</span>
                  <span style={{ color: c.hire ? "#2f6a3a" : "#7a5a1e", fontSize: 11, letterSpacing: 1, fontWeight: 600 }}>{c.hire ? "HIRE" : "PLAN"} ◆{c.price}</span>
                </StockTag>
              );
            })}
            <button data-manifest-later
              style={{ ...P.btn, width: "100%", marginTop: 4, opacity: 0.75 }}
              onClick={() => { const C = stateRef.current; if (C && C.view.dismissManifest) C.view.dismissManifest(); }}>
              LATER
            </button>
          </div>
        </div>
      )}

      {hud.info && !hud.gameOver && !hud.victory && (
        <InfoCard card={(() => { const c = cardFor(hud.info.key); return c && isTouch && c.roleTouch ? { ...c, role: c.roleTouch } : c; })()} door={hud.info.door} armed={hud.info.armed}
          afford={hud.info.door === "hire" ? hud.resources >= ((hud.prices?.[hud.info.key] ?? PALETTE_BY_KEY[hud.info.key]?.cost) || 0) : undefined}
          price={(() => {
            if (hud.info.door === "deal") return null;
            const base = hud.prices?.[hud.info.key] ?? PALETTE_BY_KEY[hud.info.key]?.cost;
            return hud.info.door === "manifest" ? Math.max(1, Math.ceil(base / 2)) : base;
          })()}
          portrait={TEACH[hud.info.key] ? undefined : (cv) => renderPortrait(cv, hud.info.key)}
          onConfirm={() => { const C = stateRef.current; if (C && C.view.confirmInfo) C.view.confirmInfo(); }}
          onCancel={() => { const C = stateRef.current; if (C && C.view.closeInfo) C.view.closeInfo(); }} />
      )}

      {/* Task 3: the teaching card — head of the fire queue, above every
          overlay (the draft sits at zIndex 8). The war is frozen while it
          is up; CLOSE marks it seen and resumes. */}
      {hud.teach && !hud.info && (() => {
        const tc = TEACH[hud.teach.key];
        if (!tc) return null;
        const card = { ...tc, role: isTouch && tc.roleTouch ? tc.roleTouch : tc.role };
        return (
          <div data-teach-card={hud.teach.key} style={{ position: "absolute", inset: 0, zIndex: 10, pointerEvents: "none" }}>
            <div style={{ pointerEvents: "auto" }}>
              <InfoCard card={card} door="teach" series={{ i: hud.teach.i, n: hud.teach.n }}
                onConfirm={() => { const C = stateRef.current; if (C && C.view.teachNext) C.view.teachNext(); }}
                onBack={() => { const C = stateRef.current; if (C && C.view.teachBack) C.view.teachBack(); }}
                onCancel={() => { const C = stateRef.current; if (C && C.view.teachSkip) C.view.teachSkip(); }} />
            </div>
          </div>
        );
      })()}

      {hud.pending && (
        <div style={{ position: "absolute", left: hud.pending.x, top: hud.pending.y, transform: "translate(-50%, -50%)", zIndex: 7, display: "flex", gap: 6, pointerEvents: "auto" }}>
          <button data-pending-confirm
            style={{ ...P.btnBig, borderColor: "#4aff8c", color: "#4aff8c", opacity: hud.pending.armed ? 1 : 0.5, fontWeight: "bold" }}
            onClick={() => stateRef.current && stateRef.current.view.confirmPending()}>
            {hud.pending.cost ? "✓ ◆" + hud.pending.cost : "✓ PLACE"}
          </button>
          <button data-pending-cancel
            style={{ ...P.btnBig, borderColor: "#ff6b5e", color: "#ff6b5e", fontWeight: "bold" }}
            onClick={() => stateRef.current && stateRef.current.view.clearPending()}>
            ✗
          </button>
        </div>
      )}

      {hud.linePending && (
        <div style={{ position: "absolute", left: hud.linePending.x, top: hud.linePending.y, transform: "translate(-50%, -50%)", zIndex: 7, display: "flex", gap: 6, pointerEvents: "auto" }}>
          <button data-line-accept
            style={{ ...P.btnBig, borderColor: "#4aff8c", color: "#4aff8c", opacity: hud.linePending.armed ? 1 : 0.5, fontWeight: "bold" }}
            onClick={() => stateRef.current && stateRef.current.view.acceptLine()}>
            {hud.linePending.kind === "patrol" ? "✓ PATROL" : `✓ UP TO ◆${hud.linePending.cost}`}
          </button>
          <button data-line-reject
            style={{ ...P.btnBig, borderColor: "#ff6b5e", color: "#ff6b5e", fontWeight: "bold" }}
            onClick={() => stateRef.current && stateRef.current.view.rejectLine()}>
            ✗
          </button>
        </div>
      )}

      {hud.squadSel && (() => {
        const sq = hud.squadSel;
        // COMMAND T1 (mk0.80): DEFEND, MOVE, ATTACK — engineers additionally
        // get BAGS and WALLS. Same view.orderSquad actions, same order-state
        // colors the old chip row used.
        // COMMAND 1b (mk0.82): DEFEND is instant — its act also fully
        // deselects (view.selSquadId = null), the same rule SELL/CAREFUL-FREE
        // follow on the tower pie. MOVE/ATTACK/BAGS/WALLS stay selected —
        // they arm view.orderMode and consumeOrderTap's ground tap(s) finish
        // them (and deselect there, at completion).
        const slots = [
          { key: "defend", icon: "∴", label: "DEFEND", color: "#7dffa8", on: sq.order === "defend", card: "defend", act: () => { const C = stateRef.current; if (C) { C.view.orderSquad("defend"); C.view.selSquadId = null; C.view.selSquadIds = null; } } },
          { key: "move", icon: "→", label: "MOVE", color: "#7fd7ff", on: sq.aimingMove || sq.order === "move", card: "move", act: () => stateRef.current && stateRef.current.view.orderSquad("move") },
          { key: "attack", icon: "⚑", label: "ATTACK", color: "#ff6b5e", on: sq.aiming, card: "attack", act: () => stateRef.current && stateRef.current.view.orderSquad("attack") },
          // POSSESSION (P4 T1, mk0.90): TAKE CONTROL — every squad type,
          // instant like DEFEND (deselects on choose; the pie itself closes
          // via RadialMenu's onChoose regardless).
          // mk2.00 (owner): the build tree closes with the take — all three TAKE CONTROLs.
          { key: "possess", icon: "✥", label: "TAKE CONTROL", color: "#7dffa8", on: false, card: "possess_squad", act: () => { closeBuild(); const C = stateRef.current; if (C) C.view.takeControl(); } },
          { key: "select_all", icon: "∷", label: "SELECT ALL", color: "#9fdcff", on: sq.count > 1, card: "select_all", act: () => { const C = stateRef.current; if (C) { C.view.selectAllType(); C.view._keepPie = true; } } },
        ];
        // COMMAND T3 (mk0.85): PATROL — two taps propose a route through the
        // same proposed-line confirm the build orders use; accept and the
        // squad walks it forever. Every type except engineers and sappers.
        if (sq.patrolOk) {
          slots.push({ key: "patrol", icon: "⇄", label: "PATROL", color: "#7fd7ff", on: sq.aimingPatrol || sq.order === "patrol", card: "patrol", act: () => stateRef.current && stateRef.current.view.orderSquad("patrol") });
        }
        // COMMAND T4 (mk0.86): STRUCTURES — instant toggle, armed types
        // only (an INFANTRY_ARMS row; not engineers, not sappers). Lit when
        // on. Its act also fully deselects, the DEFEND/SELL/CAREFUL-FREE
        // rule for instant pie actions.
        if (sq.structOk) {
          slots.push({ key: "structures", icon: "▨", label: "ATTACK STRUCTURES", color: "#c9a0ff", on: sq.structFirst, toggle: sq.structFirst, card: "structures", act: () => { const C = stateRef.current; if (C) { C.view.toggleStructFirst(); C.view.selSquadId = null; C.view.selSquadIds = null; } } });
        }
        if (sq.engineer) {
          slots.push(
            { key: "build_bags", icon: "▬", label: "BAGS", color: "#ffd27a", on: sq.building === "bags", card: "engineer_lines", act: () => stateRef.current && stateRef.current.view.orderSquad("build_bags") },
            { key: "build_walls", icon: "▦", label: "WALLS", color: "#ffd27a", on: sq.building === "walls", card: "engineer_lines", act: () => stateRef.current && stateRef.current.view.orderSquad("build_walls") },
          );
        }
        // P7 T10: MINES and WIRES — the sapper team's own two wedges, the
        // identical two-tap build shape the engineer wedges above use.
        if (sq.sapper) {
          slots.push(
            { key: "build_mines", icon: "◆", label: "MINES", color: "#ffb45e", on: sq.building === "mines", card: "sapper_lines", act: () => stateRef.current && stateRef.current.view.orderSquad("build_mines") },
            { key: "build_wires", icon: "⌁", label: "WIRES", color: "#ffb45e", on: sq.building === "wires", card: "sapper_lines", act: () => stateRef.current && stateRef.current.view.orderSquad("build_wires") },
          );
        }
        // COMMAND T2 (mk0.84): a proposed line up takes over the status —
        // it outranks the building/aiming lines below since view.orderMode is
        // already null by the time view.linePending goes up.
        const status = sq.linePending ? " — ACCEPT OR ADJUST THE LINE"
          : sq.building
          ? (sq.buildStart ? " — TAP THE FAR END" : " — TAP THE LINE START")
          // COMMAND T3 (mk0.85): patrol's two-tap status rides the same
          // view.buildPt0 field the build orders' status does.
          : sq.aimingPatrol
          ? (sq.buildStart ? " — TAP THE FAR END" : " — TAP THE PATROL START")
          : sq.aiming || sq.aimingMove ? " — TAP GROUND" : "";
        const lbl = sq.count > 1 ? sq.label + " ×" + sq.count : sq.label;
        // COMMAND 1b (mk0.82): pie open -> the wedge disc; pie closed but
        // still selected (an aiming order armed) -> the center label chip
        // alone, so the ground stays fully tappable for the follow-up taps.
        return sq.showPie
          ? <RadialMenu cx={sq.x} cy={sq.y} label={lbl + status} slots={slots} armed={sq.armed} onChoose={() => { const C = stateRef.current; if (C) { if (C.view._keepPie) C.view._keepPie = false; else C.view.pieOpen = false; } }} press={teachPress} showInfo={!isTouch} onCard={(k) => { const C = stateRef.current; if (C && C.view.openInfo) C.view.openInfo(k, "bar"); }} />
          : <div style={{ position: "absolute", left: sq.x, top: sq.y + 26, transform: "translate(-50%,0)", fontSize: 10, letterSpacing: 1, color: "#7dffa8", background: "rgba(14,18,24,0.85)", padding: "1px 6px", borderRadius: 4, zIndex: 7, pointerEvents: "none" }}>{lbl + status}</div>;
      })()}
      {hud.squadFlag && (
        <div data-squad-flag style={{ position: "absolute", left: hud.squadFlag.x, top: hud.squadFlag.y, transform: "translate(-50%, -100%)", zIndex: 6, pointerEvents: "none", color: "#ff6b5e", fontSize: 18 }}>⚑</div>
      )}

      {hud.inspect && (
        <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", bottom: isTouch ? 96 : 104, zIndex: 5 }}>
          <div style={{ ...P.panel, position: "static", borderColor: "#7fd7ff", display: "flex", alignItems: "center", gap: 10, padding: "6px 10px" }}>
            <div>
              <div style={{ color: "#7fd7ff", letterSpacing: 1 }}>{hud.inspect.label}</div>
              <div style={{ fontSize: 10, opacity: 0.8 }}>HP {hud.inspect.hp}/{hud.inspect.maxHp} · {hud.inspect.blurb}</div>
            </div>
            {/* COMMAND T1 (mk0.80): SELL moved into the tower radial below —
                walls keep today's inspect behavior untouched (no radial). */}
            {!hud.towerRadial && (
              <button style={{ ...P.btn, borderColor: "#ffb45e", color: "#ffb45e" }} onClick={sellInspected}>
                SELL ◆{hud.inspect.refund}
              </button>
            )}
          </div>
        </div>
      )}
      {hud.towerRadial && (() => {
        const tr = hud.towerRadial;
        const slots = [];
        // COMMAND 1b (mk0.82): both tower actions are instant — each act
        // also fully deselects (view.inspectId = null). sellById already nulls
        // it internally; the discipline flip does so explicitly here.
        {
          slots.push({
            key: "discipline",
            icon: tr.discipline === "free" ? "●" : "◐",
            label: tr.discipline === "free" ? "FREE" : "CAREFUL",
            color: tr.discipline === "free" ? "#ff7a7a" : "#4aff8c",
            on: true,
            card: "discipline",
            act: () => { const C = stateRef.current; if (C) { C.view.setTowerDiscipline(tr.id); C.view.inspectId = null; } },
          });
        }
        // POSSESSION (P4 T3, mk0.92): TAKE CONTROL — same wedge as the squad
        // pie, gated on canPossess (gun towers only; frost has none).
        if (tr.canPossess) {
          slots.push({
            key: "possess",
            icon: "✥",
            label: "TAKE CONTROL",
            color: "#7dffa8",
            on: false,
            card: "possess_tower",
            act: () => { closeBuild(); const C = stateRef.current; if (C) C.view.takeControlTower(tr.id); },
          });
        }
        slots.push({
          key: "sell",
          icon: "◆",
          label: `SELL ◆${tr.refund}`,
          color: "#ffb45e",
          on: true,
          card: "sell",
          act: () => stateRef.current && stateRef.current.view.sellById(tr.id),
        });
        return tr.showPie
          ? <RadialMenu cx={tr.x} cy={tr.y} label={tr.label} slots={slots} armed={true} onChoose={() => { const C = stateRef.current; if (C) C.view.pieOpen = false; }} press={teachPress} showInfo={!isTouch} onCard={(k) => { const C = stateRef.current; if (C && C.view.openInfo) C.view.openInfo(k, "bar"); }} />
          : null;
      })()}

      {hud.vehRadial && (() => {
        const vr = hud.vehRadial;
        const vLabel = vr.kind === "mech" ? "MECH" : vr.vtype === "apc" ? "APC" : "BISON";   // P7 T4/mk1.92: label by kind, then vtype
        const slots = [
          { key: "defend", icon: "∴", label: "DEFEND", color: "#7dffa8", on: vr.order === "defend", card: "defend", act: () => { const C = stateRef.current; if (C) { C.view.orderVehicle("defend"); C.view.selVehId = null; } } },
          { key: "move", icon: "→", label: "MOVE", color: "#7fd7ff", on: vr.aimingMove || vr.order === "move", card: "move", act: () => stateRef.current && stateRef.current.view.orderVehicle("move") },
          { key: "attack", icon: "✕", label: "ATTACK", color: "#ff9a7a", on: vr.aimingAttack || vr.order === "attack", card: "attack", act: () => stateRef.current && stateRef.current.view.orderVehicle("attack") },
          { key: "patrol", icon: "⇄", label: "PATROL", color: "#7fd7ff", on: vr.aimingPatrol || vr.order === "patrol", card: "patrol", act: () => stateRef.current && stateRef.current.view.orderVehicle("patrol") },
          { key: "escort", icon: "⛨", label: "ESCORT", color: "#c9a0ff", on: vr.aimingEscort || vr.order === "escort", card: "escort", act: () => stateRef.current && stateRef.current.view.orderVehicle("escort") },
          { key: "tracks", icon: vr.tracks === "free" ? "●" : "◐", label: vr.tracks === "free" ? "TRACKS FREE" : "TRACKS CAREFUL", color: vr.tracks === "free" ? "#ff7a7a" : "#4aff8c", on: true, toggle: vr.tracks !== "free", card: "tracks", act: () => { const C = stateRef.current; if (C) { C.view.toggleTracks(); C.view.selVehId = null; } } },
          { key: "possess", icon: "✥", label: "TAKE CONTROL", color: "#7dffa8", on: false, card: vr.kind === "mech" ? "possess_mech" : "possess_vehicle", act: () => { closeBuild(); const C = stateRef.current; if (C) C.view.takeControlVehicle(); } },
        ];
        // P7 T4: LOAD/UNLOAD — APC only, offered only when there's a seat to
        // fill or a rider to drop.
        if (vr.vtype === "apc" && vr.seatsFree > 0) {
          slots.push({ key: "load", icon: "⬒", label: "LOAD (" + vr.seatsFree + ")", color: "#ffd27a", on: vr.aimingLoad, card: "load", act: () => stateRef.current && stateRef.current.view.orderVehicle("load") });
        }
        if (vr.vtype === "apc" && vr.riders > 0) {
          slots.push({ key: "unload", icon: "⬓", label: "UNLOAD (" + vr.riders + ")", color: "#ffd27a", on: false, card: "load", act: () => { const C = stateRef.current; if (C) { C.view.unloadVehicle(); C.view.selVehId = null; } } });
        }
        const status = vr.linePending ? " — ACCEPT OR ADJUST THE LINE"
          : vr.aimingPatrol ? (vr.patrolStart ? " — TAP THE FAR END" : " — TAP THE PATROL START")
          : vr.aimingEscort ? " — TAP A SQUAD"
          : vr.aimingLoad ? " — TAP A SQUAD"
          : vr.aimingAttack ? " — TAP THE TARGET GROUND"
          : vr.aimingMove ? " — TAP GROUND" : "";
        return vr.showPie
          ? <RadialMenu cx={vr.x} cy={vr.y} label={vLabel + status} slots={slots} armed={vr.armed} onChoose={() => { const C = stateRef.current; if (C) C.view.pieOpen = false; }} press={teachPress} showInfo={!isTouch} onCard={(k) => { const C = stateRef.current; if (C && C.view.openInfo) C.view.openInfo(k, "bar"); }} />
          : <div style={{ position: "absolute", left: vr.x, top: vr.y + 26, transform: "translate(-50%,0)", fontSize: 10, letterSpacing: 1, color: "#7dffa8", background: "rgba(14,18,24,0.85)", padding: "1px 6px", borderRadius: 4, zIndex: 7, pointerEvents: "none" }}>{vLabel + status}</div>;
      })()}

      {hud.started && !hud.gameOver && !hud.victory && !hud.possessed && buildOpen && branch && (
        <div data-lattice style={{ position: "absolute", left: 6, right: 6, bottom: "calc(150px + env(safe-area-inset-bottom, 0px))", zIndex: 4, display: "flex", flexDirection: "column-reverse", gap: 2, pointerEvents: packing ? "none" : "auto" }}>
          <div data-trunk style={{ position: "absolute", left: 14, top: -4, bottom: -10, width: 2, background: "#8f9aa8", transformOrigin: "bottom",
            animation: packing ? "cs-packtrunk 0.12s ease-in forwards" : "cs-climb 0.15s ease-out backwards",
            animationDelay: packing ? "0.22s" : "0s" }}
            onAnimationEnd={packing ? finishPack : undefined} />
          {(LATTICE[branch] || []).map((rung, ri) => (
            <div key={branch + ":" + rung.name} style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: 10 }}>
              <div style={{ fontSize: 9, letterSpacing: 1, color: "#b9a86a", border: "1px solid #6a5f3a", borderRadius: 2, padding: "1px 4px", background: "rgba(14,18,24,0.85)", zIndex: 1,
                animation: packing ? "cs-pack 0.1s ease-in forwards" : "cs-deal 0.1s ease-out backwards",
                animationDelay: packing ? "0.12s" : (0.12 + ri * 0.06) + "s", "--restT": "none" }}>{rung.name}</div>
              <div style={{ height: 2, width: 16, background: "#8f9aa8", transformOrigin: "left",
                animation: packing ? "cs-packline 0.1s ease-in forwards" : "cs-line 0.1s ease-out backwards",
                animationDelay: packing ? "0.12s" : (0.12 + ri * 0.06) + "s" }} />
              <div style={{ display: "flex", gap: 6, overflowX: "auto", padding: "6px 2px", alignItems: "center" }}>
                {rung.keys.map((k, ti) => renderLatticeTag(branch, k, ti, ri))}
              </div>
            </div>
          ))}
        </div>
      )}

      {hud.started && !hud.gameOver && !hud.victory && !hud.possessed && (
        <div style={{ ...P.bar, pointerEvents: packing ? "none" : "auto" }}>
          <style>{`
@keyframes cs-deal { from { opacity: 0; transform: translate(-16px, 12px) rotate(-8deg) scale(0.85); } to { opacity: 1; transform: var(--restT, none); } }
@keyframes cs-climb { from { transform: scaleY(0); } to { transform: scaleY(1); } }
@keyframes cs-line { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes cs-pack { to { opacity: 0; transform: translate(-16px, 12px) rotate(-8deg) scale(0.85); } }
@keyframes cs-packline { to { transform: scaleX(0); } }
@keyframes cs-packtrunk { to { transform: scaleY(0); } }
`}</style>
          <CrateChip data-build-toggle
            label={buildOpen ? "CLOSE" : "BUILD"} icon="⚒" open={buildOpen} active={buildOpen}
            line={!buildOpen ? (hud.sellMode ? "SELL" : hud.mode ? (PALETTE_LABEL[hud.mode] || "") : "") : ""}
            {...teachPress("market")}
            onClick={() => {
              if (buildOpen) { closeBuild(); return; }
              const C = stateRef.current;
              // mk2.00 (owner): no build tree over a live possession.
              if (C && C.input.possess) return;
              const b = C && C.run.mode ? branchOf(C.run.mode) : null;
              if (b) setBranch(b);
              setBuildOpen(true);
              if (C && C.view.teachFire) { C.view.teachFire("market"); C.view.teachFire("scrap"); }
            }} />
          {buildOpen && (dev ? [...TREE_BRANCHES, { key: "foes", label: "THE ENEMY", icon: "☠", match: () => false }] : TREE_BRANCHES).map((b) => (dev && b.key === "foes") || palette.some((p) => b.match(p.key)) ? (
            <CrateChip key={b.key} data-branch={b.key}
              label={b.label} icon={b.icon} open={branch === b.key} active={branch === b.key}
              count={b.key === "foes" ? FOE_RACK.length : palette.filter((p) => b.match(p.key)).length}
              line={!qmQuiet ? QM_LINES[b.key] : null}
              style={packing && packNextRef.current.closeAll
                ? { animation: "cs-pack 0.1s ease-in forwards", animationDelay: "0.18s" }
                : { animation: "cs-deal 0.14s ease-out backwards", animationDelay: (TREE_BRANCHES.indexOf(b) * 0.04) + "s" }}
              onClick={() => { branch === b.key ? beginPack(null, false) : (branch ? beginPack(b.key, false) : setBranch(b.key)); }} />
          ) : null)}
          {buildOpen && (
            <StockTag data-sell-toggle tilt={1.5} delay="0.09s"
              style={packing && packNextRef.current.closeAll
                ? { minWidth: isTouch ? 56 : 52, borderColor: hud.sellMode ? "#a85c1e" : "#8f8768", background: hud.sellMode ? "#dcc9a0" : "#cfc6a5", animation: "cs-pack 0.1s ease-in forwards", animationDelay: "0.18s" }
                : { minWidth: isTouch ? 56 : 52, borderColor: hud.sellMode ? "#a85c1e" : "#8f8768", background: hud.sellMode ? "#dcc9a0" : "#cfc6a5" }}
              {...teachPress("sell")}
              onClick={() => { toggleSell(); beginPack(null, true); }}>
              <div style={{ fontSize: 15 }}>✕</div>
              <div>SELL</div>
              <div style={{ opacity: 0.7 }}>60%</div>
            </StockTag>
          )}
        </div>
      )}

      {!hud.started && !hud.placing && !hud.drafting && !fatal && !dev && (
        <div style={P.ovl}>
          <div style={{ fontSize: 26, letterSpacing: 4, color: "#9fdcff" }}>COLDSNAP</div>
          <div style={{ fontSize: 13, letterSpacing: 8, color: "#ffd27a", marginBottom: 18 }}>WINTER FRONT</div>
          <button style={{ ...P.btn, fontSize: 15, padding: "10px 26px", borderColor: "#4aff8c", color: "#4aff8c" }} onClick={startGame}>
            TAKE COMMAND
          </button>
          <button data-menu="walk" style={{ ...P.btn, marginTop: 14, opacity: 0.8, fontSize: 12, letterSpacing: 1 }}
            onClick={() => { const C = stateRef.current; if (C && C.view.teachWalk) C.view.teachWalk(); }}>
            SHOW ME THE FRONT
          </button>
          <div style={{ fontSize: 10, opacity: 0.55, marginTop: 12, letterSpacing: 2 }}>FIELD ORDER #{hud.seed || "—"} · ?seed= replays a map</div>
        </div>
      )}

      {hud.drafting && !fatal && (
        <DraftScreen cards={hud.drafting} onConfirm={(picked) => { const C = stateRef.current; if (C && C.view.confirmDraft) C.view.confirmDraft(picked); }} />
      )}

      {hud.placing && !hud.info && !fatal && (() => {
        const C = stateRef.current;
        const remaining = C && C.view._placeQueue ? C.view._placeQueue.length : 0;
        const n = Math.max(1, (C && C.view._placeTotal ? C.view._placeTotal : remaining) - remaining + 1);
        return (
          <div style={{ position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)", zIndex: 9,
            background: "#1a212b", border: "1px solid #4aff8c", borderRadius: 8, padding: "8px 16px",
            display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "#e6ebf1", textAlign: "center" }}>
            {hud.placing === "done" ? (
              <>
                <span>ALL PLACED</span>
                <button style={{ ...P.btn, borderColor: "#4aff8c", color: "#4aff8c" }} onClick={startGame}>TAKE COMMAND</button>
              </>
            ) : (
              <span>PLACE: {PALETTE_BY_KEY[hud.placing]?.label} — tap ground near your depot ({n} of {C && C.view._placeTotal ? C.view._placeTotal : remaining})</span>
            )}
          </div>
        );
      })()}

      {hud.hiring && !hud.info && !fatal && (
        <div data-hire-ticker style={{ position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)", zIndex: 9,
          background: "#1a212b", border: "1px solid #7dffa8", borderRadius: 8, padding: "8px 16px",
          display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "#e6ebf1" }}>
          <span>PLACE THE HIRE: {hud.hiring.label} — tap held ground</span>
          <button data-hire-cancel style={{ ...P.btn, borderColor: "#ff6b5e", color: "#ff6b5e" }}
            onClick={() => { const C = stateRef.current; if (C && C.view.cancelHire) { C.view.cancelHire(); if (C.view.openManifest) C.view.openManifest(); } }}>✗</button>
        </div>
      )}

      {(hud.gameOver || hud.victory) && hud.endCard && !fatal && (
        <Dispatch
          dispatch={endDispatch}
          gating={false}
          outcome={hud.victory ? "win" : "loss"}
          label="RETURN TO BASE"
          onAcknowledge={() => { if (onExit) onExit(); else restart(); }}
        />
      )}

      {fatal && (
        <div style={P.ovl}>
          <div style={{ fontSize: 18, color: "#ff7a7a", marginBottom: 10 }}>ENGINE FAULT</div>
          <div style={{ fontSize: 11, opacity: 0.8, maxWidth: 480, marginBottom: 16, wordBreak: "break-word" }}>{fatal}</div>
          <button style={{ ...P.btn, borderColor: "#9fdcff", color: "#9fdcff" }} onClick={restart}>RESTART</button>
        </div>
      )}
    </div>
  );
}
