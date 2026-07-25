// campaign.js — the Clearance Program's order book and its permanent record.
// All eight orders are listed from day one; orders without a built scenario
// (or above the player's progress) render sealed: dimmed row, title as
// redaction bars, WO number visible. Missions are built one at a time —
// adding one means authoring its scenario JSON and setting `scenario` here.
import AC01 from "./scenarios/ac-01-plate.json";
import AC02 from "./scenarios/ac-02-battery.json";
import AC03 from "./scenarios/ac-03-route.json";
import AC04 from "./scenarios/ac-04-crossing.json";
import AC05 from "./scenarios/ac-05-steading.json";
import AC06 from "./scenarios/ac-06-halt.json";
import AC07 from "./scenarios/ac-07-village.json";

export const CAMPAIGN = [
  { id: "ac01", wo: "AC-01", title: "ARMOR PLATE ACCEPTANCE", scenario: AC01 },
  { id: "ac02", wo: "AC-02", title: "BATTERY REDUCTION", scenario: AC02 },
  { id: "ac03", wo: "AC-03", title: "CONVOY INTERDICTION", scenario: AC03 },
  { id: "ac04", wo: "AC-04", title: "CROSSING DENIAL", scenario: AC04 },
  { id: "ac05", wo: "AC-05", title: "OUTBUILDING, OCCUPIED", scenario: AC05 },
  { id: "ac06", wo: "AC-06", title: "THE CONVOY HAS STOPPED", scenario: AC06 },
  { id: "ac07", wo: "AC-07", title: "THE VILLAGE", scenario: AC07 },
  { id: "ac08", wo: "AC-08", title: "SURFACE LOAD RATING, REPEAT", scenario: null },
];

// a sealed title renders as redaction bars sized to the real title
export const redact = (title) => title.replace(/[^ ,]/g, "█");

const PROG_KEY = "coldsnap-camp-progress";
const REC_KEY = "coldsnap-camp-record";

export async function loadProgress() {
  try {
    const r = await window.storage.get(PROG_KEY);
    const n = parseInt(r.value, 10);
    if (Number.isFinite(n)) return Math.max(0, Math.min(CAMPAIGN.length, n));
  } catch (e) {}
  return 0;
}
export function saveProgress(n) {
  try { window.storage.set(PROG_KEY, String(n)); } catch (e) {}
}

// append-only: a faster later run can never erase that a deviation happened
export async function loadRecord() {
  try {
    const r = await window.storage.get(REC_KEY);
    const j = JSON.parse(r.value);
    if (j && typeof j === "object") return j;
  } catch (e) {}
  return {};
}
export function recordOutcome(rec, id, outcome, elapsed) {
  const row = rec[id] || (rec[id] = { fulfilled: 0, deviated: 0, bestTime: null, lastOutcome: null });
  if (outcome === "deviated") row.deviated++;
  else {
    row.fulfilled++;
    if (row.bestTime == null || elapsed < row.bestTime) row.bestTime = elapsed;
  }
  row.lastOutcome = outcome;
  try { window.storage.set(REC_KEY, JSON.stringify(rec)); } catch (e) {}
  return rec;
}
