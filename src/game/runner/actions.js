// game/runner/actions.js — the campaign fire-control actions: shell, MG,
// and the direct-observation volley discipline (Jeff's rule: the rack
// refuses danger close and without line of sight; refusals never start the
// cooldown). Moved verbatim from CampaignRunner.jsx in the module split;
// closes over the runner's live state object S.
import { bisonFire, bisonMg, fireVolley } from "../../engine/core.js";

export function makeActions(S, doReset) {
  return {
    // ordnance is counted here at the action layer, not from muzzle events —
    // grenadier mortars also route through fireProjectile and would pollute it
    fireAt: (x, z) => { if (S.cds.fire > 0) return false; S.cds.fire = 0.45; bisonFire(S.world, { x, z }); if (S.trialLog) S.trialLog.ordnance.shell++; return true; },
    // the rack is a direct-observation weapon (Jeff's rule): it refuses
    // inside 10m (danger close) and without line of sight to the strike
    // point. Refusals don't start the cooldown.
    volleyAt: (x, z) => {
      if (S.cds.volley > 0) return false;
      const w = S.world, b = w.byId.get(w.bisonId);
      if (b) {
        const refuse = (why, how) => {
          // throttle per reason: a DANGER CLOSE refusal must not swallow a
          // NO LINE OF SIGHT toast half a second later
          if (!S.lastRefuse) S.lastRefuse = {};
          if (S.lastRefuse[why] && performance.now() - S.lastRefuse[why] < 1200) return false;
          S.lastRefuse[why] = performance.now();
          S.toasts.push({ id: S.toastSeq++, title: `RACK HELD · ${why}`, desc: how, t: 2.6 });
          return false;
        };
        const dist = Math.hypot(x - b.pos.x, z - b.pos.z);
        if (dist < 10) return refuse("DANGER CLOSE", "Minimum safe distance 10 meters.");
        const y0 = b.pos.y + 1.6, y1 = w.field.heightAt(x, z) + 1.0;
        const x0 = b.pos.x, z0 = b.pos.z;
        const bx0 = Math.min(x0, x) - 3, bx1 = Math.max(x0, x) + 3, bz0 = Math.min(z0, z) - 3, bz1 = Math.max(z0, z) + 3;
        const cand = [];
        for (const ob of w.bodies) {
          if (ob.id === w.bisonId || ob.kind === "unit" || (!ob.alive && ob.kind !== "wreck")) continue;
          if (ob.pos.x < bx0 || ob.pos.x > bx1 || ob.pos.z < bz0 || ob.pos.z > bz1) continue;
          // the body AT the strike point is the thing being aimed at, not an
          // obstruction — without this, the ray's terminal samples land
          // inside the target's own hull and every aimed volley refuses
          if (Math.abs(x - ob.pos.x) < ob.hx + 0.3 && Math.abs(z - ob.pos.z) < ob.hz + 0.3) continue;
          cand.push(ob);
        }
        const steps = Math.max(8, Math.ceil(dist * 2)); // 0.5m sampling — 1m stepped clean through single-stone walls
        for (let i = 1; i < steps; i++) {
          const t = i / steps;
          const px = x0 + (x - x0) * t, py = y0 + (y1 - y0) * t, pz = z0 + (z - z0) * t;
          if (py <= w.field.heightAt(px, pz) + 0.05) return refuse("NO LINE OF SIGHT", "The launcher needs eyes on the strike point.");
          for (const ob of cand) {
            if (Math.abs(px - ob.pos.x) < ob.hx && Math.abs(py - ob.pos.y) < ob.hy && Math.abs(pz - ob.pos.z) < ob.hz) return refuse("NO LINE OF SIGHT", "The launcher needs eyes on the strike point.");
          }
        }
      }
      S.cds.volley = 10;
      fireVolley(S.world, x, z, 6, "player");
      if (S.trialLog) S.trialLog.ordnance.volley++;
      return true;
    },
    mgAt: (x, z) => { if (S.cds.mg > 0) return false; S.cds.mg = 0.11; const p = bisonMg(S.world, { x, z }); if (S.trialLog) { if (p && S.trialLog.ordnance.mg % 4 === 0) p.tracer = true; S.trialLog.ordnance.mg++; } return true; }, // every 4th round is a tracer — tag only, physics untouched
    squads: () => S.world.pg.respawnSquads(),
    scouts: () => S.world.pg.respawnScouts(),
    repair: () => S.world.pg.repairGarrison(),
    reset: doReset,
  };
}
