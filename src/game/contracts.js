// contracts.js — Phase 1 voice pass. Bureau work-order fiction over the
// existing TRIALS. Text only; no mechanics change. Keyed by trial id.
// Verbatim from the buildout plan (T1-verified: all seven trial ids covered).

export const CONTRACTS = {
  gunnery: {
    wo: "WO-01", title: "DIRECT-FIRE ACCEPTANCE",
    directive: "The pad detail is staged. Three kills by main gun or coax — direct fire only. Reticle discipline is assumed.",
    commendation: "Direct-fire lethality within acceptance band.",
  },
  roadkill: {
    wo: "WO-02", title: "OVERRUN TRIAL",
    directive: "Close with the road line under power. The hull is the instrument.",
    commendation: "Contact lethality confirmed. Treads within tolerance.",
  },
  saturation: {
    wo: "WO-03", title: "AREA SATURATION",
    directive: "One salvo. Three kills inside its footprint. Density is the deliverable.",
    commendation: "Coverage per round meets projection.",
  },
  demolition: {
    wo: "WO-04", title: "STRUCTURAL COLLAPSE, OCCUPIED",
    directive: "The keep is garrisoned. Breach it. The masonry completes the work order.",
    commendation: "Load-path failure per design. Occupancy resolved.",
  },
  deep_end: {
    wo: "WO-05", title: "IMMERSION TOLERANCE",
    directive: "Displace the poolside detail into open water. Sustained immersion concludes the test.",
    commendation: "Tolerance recorded at zero.",
  },
  counter_battery: {
    wo: "WO-06", title: "COUNTER-BATTERY",
    directive: "Three tubes on the ridge, firing. Silence is the acceptance criterion.",
    commendation: "Ridge inventory reduced to specification.",
  },
  thin_ice: {
    wo: "WO-07", title: "SURFACE LOAD RATING",
    directive: "The drill squad occupies the sheet. Clear it. Method unspecified.",
    commendation: "Sheet rating established.",
  },
};
