/*
 * PLANT SIMULATOR  -  operator-training view of the flowsheet
 * ============================================================================
 * STEADY STATE comes from the unit models:
 *   - flows and duties scale linearly with plant load (conversions, yields
 *     and equipment sizes are held at their design values);
 *   - the U8 crystalliser uses its van't Hoff solubility fit
 *       ln(S / wt%) = 9.754 - 2896 / T
 *     and the FDCA recycle loop (U9 mother liquor -> U10 -> U11 -> 40 kg/h
 *     catalyst to U1 + S16 to U5, 3 % purge) is solved to convergence;
 *   - enzyme purchase follows the ultrafilter recovery.
 *
 * DYNAMICS are illustrative, not a dynamic model:
 *   - every stream relaxes toward its target with a first-order lag, and a
 *     stream only starts once its upstream stream is above 30 % - so start-up
 *     and shutdown ripple through the flowsheet in process order;
 *   - U5 heat-up after loss of cooling uses the 897 kW exotherm on the liquid
 *     hold-up Qv x tau = 36.7 m3 (971.6 kg/m3, cp 3.064 kJ/kg K): ~30 K/h.
 *     Catalyst and steel would slow this in reality.
 *
 * No DOM code here. control-room.js drives SIM.tick() and draws the results.
 */
window.SIM = (function () {
  'use strict';

  const D = window.FLOWSHEET;
  const AMBIENT = 25;
  const ATM = 1.013;
  const TAU = 90;                               // s, stream lag
  const MAIN_KINDS = new Set(['process', 'feed', 'fructose', 'oxygen']);
  const HISTORY_LEN = 480;
  const SAMPLE_REAL_S = 0.25;
  const START_CLOCK_S = 6 * 3600;               // plant clock starts at 06:00

  const list = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
  const lag = (cur, target, tau, dt) => cur + (target - cur) * (1 - Math.exp(-dt / tau));

  /* ------------------------------------------------------------ topology */
  const streams = D.streams;
  const streamById = new Map(streams.map((s) => [s.id, s]));
  const design = new Map(streams.map((s) => [s.id, {
    flow: s.data && s.data.flow != null ? s.data.flow : null,
    T: s.data && s.data.T != null ? s.data.T : null,
    P: s.data && s.data.P != null ? s.data.P : null
  }]));
  const inlets = new Map(D.units.map((u) => [u.id, []]));
  for (const s of streams) for (const to of list(s.to)) if (inlets.has(to)) inlets.get(to).push(s);

  /* ------------------------------------------------------------ state */
  const sp = { load: 100, u8T: 8, ufRec: 97 };
  const plant = { running: true, trips: { P52: false, O2: false }, coolingFail: false, t: 0, speed: 60, paused: false };
  const S = new Map();                          // stream id -> { x, T, P, a }
  for (const s of streams) {
    const d = design.get(s.id);
    S.set(s.id, { x: 1, a: 1, T: d.T, P: d.P });
  }
  const U = {
    load: 1,
    'U2.T': 180, 'U5.T': 110, 'U8b.T': 8, 'U14.T': 150,
    'E1.level': 50, 'E4.level': 50, 'U6.level': 50, 'U8a.level': 50
  };
  const LEVEL_FEED = { E1: 'A2', E4: 'A7', U6: 'S9', U8a: 'S12V' };

  const x = (id) => S.get(id).x;

  /* ------------------------------------------------------------ U8 crystalliser + FDCA loop */
  function crystalliser(L, T8) {
    const s = Math.exp(9.754 - 2896 / (T8 + 273.15)) / 100;     // mass fraction
    let cat = 40 * L, S16F = 12.694 * L, F = 698 * L, crystals = 0, S14F = 0, avail = 0;
    for (let i = 0; i < 60; i++) {
      F = 645.4 * L + cat + S16F;             // fresh FDCA + FFCA finished in U5 + recycles
      const total = 7578.2 * L + F;           // U8 feed
      crystals = Math.max(0, (F - s * total) / (1 - s));
      S14F = F - 0.985 * crystals;            // dissolved + 1.5 % wash re-dissolution
      avail = 0.97 * (S14F + 0.3 * L);        // after the 3 % U11 purge (+ U12 returns)
      cat = Math.min(40 * L, avail);
      S16F = Math.max(0, avail - 40 * L);
    }
    return {
      solubility: s * 100, F, crystals, recovery: F > 0 ? crystals / F : 0, S14F, cat, S16F, avail,
      product: Math.max(0, 0.985 * crystals - 0.3 * L),
      u5wt: L > 0 ? (100 * F) / (7585.2 * L + F) : 0,
      dutyU8b: (8276.2 * L * 3.064 * Math.max(0, 35 - T8)) / 3600 + 3 * L,
      purgeFDCA: 0.03 * (S14F + 0.3 * L)
    };
  }
  const CAL = 643.7 / crystalliser(1, 8).product;  // pins the design point exactly
  let model = crystalliser(1, 8);

  function steadyFlow(id) {
    const d = design.get(id);
    const L = U.load, m = model;
    switch (id) {
      case 'PROD': case 'S22': case 'S13': return d.flow * (m.product * CAL) / 643.7;
      case 'S14': case 'SCONC': return d.flow * L + (m.S14F - 54.0 * L);
      case 'S16': return 7.8 * L + m.S16F;
      case 'CAT': return 24.6 * L + m.cat;
      case 'RCY': return 32.4 * L + m.cat + m.S16F;
      case 'S9': case 'S9L': case 'S12': case 'S12V': case 'S12I': case 'S12X': return d.flow * L + (m.F - 698 * L);
      case 'A8': return 52.73 * (sp.ufRec / 100) * L;
      default: return d.flow == null ? null : d.flow * L;
    }
  }

  /* ------------------------------------------------------------ activity logic */
  const blocked = (unitId) => unitId === 'P52' && plant.trips.P52;
  function targetActivity(s) {
    if (list(s.to).some(blocked)) return 0;
    if (!s.from) return plant.running && !(s.id === 'O2' && plant.trips.O2) ? 1 : 0;
    if (blocked(s.from)) return 0;
    if (s.requires) return s.requires.every((id) => x(id) > 0.3) ? 1 : 0;
    const main = (inlets.get(s.from) || []).filter((i) => MAIN_KINDS.has(i.kind));
    if (!main.length) return plant.running ? 1 : 0;
    return main.some((i) => x(i.id) > 0.3) ? 1 : 0;
  }
  function unitActive(id) {
    const main = (inlets.get(id) || []).filter((i) => MAIN_KINDS.has(i.kind));
    if (!main.length) return (inlets.get(id) || []).some((i) => x(i.id) > 0.3);
    return main.some((i) => x(i.id) > 0.3);
  }

  /* ------------------------------------------------------------ KPIs */
  function kpis() {
    const L = U.load, m = model;
    const u5gen = 897 * L * x('U5F') * (plant.trips.O2 ? 0 : x('O2'));
    const refrig = (m.dutyU8b / 3.5) * x('S12X');
    return {
      product: m.product * CAL * x('PROD'),
      annual: (m.product * CAL * x('PROD') * 8000) / 1000,
      heating: 1019 * L * x('A11') + 307.9 * L * x('S4') + 735 * L * x('S4H') + (354 + 749) * L * x('S14') + 9.4 * L * x('SCONC') + 108 * L * x('S13'),
      cooling: 661.47 * L * x('A11') + 72.6 * L * x('S5') + 455 * L * x('S5C') + (plant.coolingFail ? 0 : u5gen) + 557 * L * x('S12I') +
               m.dutyU8b * x('S12X') + (675 + 197) * L * x('S15') + 8.9 * L * x('SLA') + 13.7 * L * x('S13'),
      elec: 84 * L * x('A11') + 6.28 * L * x('S4P') + 15.01 * L * x('U5F1') + 3.7 * x('S4') + refrig + 0.466 * L * x('O2') + 9.7 * L * x('PROD'),
      u5gen,
      refrig,
      enzyme: 52.73 * (1 - sp.ufRec / 100) * L * x('A8')
    };
  }

  /* ------------------------------------------------------------ values */
  function streamValue(id, field) {
    const st = S.get(id);
    if (!st) return null;
    if (field === 'flow') { const f = steadyFlow(id); return f == null ? null : f * st.x; }
    if (field === 'T') return id === 'S12X' ? U['U8b.T'] : st.T;
    if (field === 'P') return st.P;
    return null;
  }
  function trueValue(key) {
    const [kind, a, b] = key.split(':');
    if (kind === 'stream') return streamValue(a, b);
    if (kind === 'unit') return U[`${a}.${b}`];
    if (kind === 'kpi') return kpis()[a];
    if (kind === 'model') return a === 'refrig' ? model.dutyU8b / 3.5 : a === 'product' ? model.product * CAL : model[a];
    if (kind === 'tag') return tagShown.get(a);
    return null;
  }

  /* ------------------------------------------------------------ instruments, noise, alarms */
  const tags = D.instruments || [];
  const noise = new Map(tags.map((t) => [t.id, 0]));
  const tagShown = new Map();
  function gauss() {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  function sigmaFor(t, v) {
    const type = t.id[0];
    if (type === 'T') return 0.1;
    if (type === 'L') return 0.7;
    return Math.max(Math.abs(v) * 0.004, type === 'P' ? 0.0008 : 0.01);
  }
  function updateNoise(dt) {
    if (!(dt > 0)) return;
    const k = Math.exp(-dt / 20);
    for (const t of tags) {
      const v = trueValue(t.src);
      if (v == null) { tagShown.set(t.id, null); continue; }
      const n = noise.get(t.id) * k + sigmaFor(t, v) * Math.sqrt(1 - k * k) * gauss();
      noise.set(t.id, n);
      let shown = v + n;
      if (t.id[0] === 'F') shown = v <= 0.5 ? 0 : Math.max(0, shown);
      if (t.id[0] === 'L') shown = Math.min(100, Math.max(0, shown));
      tagShown.set(t.id, shown);
    }
  }

  const alarms = [];                            // newest first
  const alarmLevel = new Map();
  let alarmVersion = 0, seq = 0;
  const LEVEL_TEXT = { HH: 'high-high', H: 'high', L: 'low', LL: 'low-low' };

  function pushEntry(entry) {
    alarms.unshift(Object.assign({ seq: ++seq, t: plant.t }, entry));
    if (alarms.length > 80) alarms.length = 80;
    alarmVersion++;
  }
  function logEvent(text, severity) {
    pushEntry({ kind: 'event', text, severity: severity || 'info', active: false, acked: true });
  }

  function evaluateAlarms() {
    const st = status();
    const enabled = st === 'Running' || st === 'Tripped' || st === 'Upset';
    for (const t of tags) {
      const v = trueValue(t.src);
      const prev = alarmLevel.get(t.id) || '';
      let lvl = '';
      if (v != null && (enabled || t.always)) {
        const db = Math.max(Math.abs(t.hi || t.lo || 1) * 0.01, 0.002);
        const hihi = t.hihi != null ? t.hihi - (prev === 'HH' ? db : 0) : null;
        const hi = t.hi != null ? t.hi - (prev === 'H' || prev === 'HH' ? db : 0) : null;
        // `always` covers the high limits only; low limits are meaningless in a stopped plant
        const lo = t.lo != null && enabled ? t.lo + (prev === 'L' || prev === 'LL' ? db : 0) : null;
        const lolo = t.lolo != null && enabled ? t.lolo + (prev === 'LL' ? db : 0) : null;
        if (hihi != null && v >= hihi) lvl = 'HH';
        else if (hi != null && v >= hi) lvl = 'H';
        else if (lolo != null && v <= lolo) lvl = 'LL';
        else if (lo != null && v <= lo) lvl = 'L';
      }
      if (lvl === prev) continue;
      alarmLevel.set(t.id, lvl);
      for (const a of alarms) if (a.kind === 'alarm' && a.tag === t.id && a.active) a.active = false;
      if (lvl) {
        pushEntry({ kind: 'alarm', tag: t.id, level: lvl, severity: lvl.length === 2 ? 'critical' : 'warning',
                    text: `${t.label} ${LEVEL_TEXT[lvl]}`, active: true, acked: false });
      } else {
        alarmVersion++;
      }
    }
  }

  /* ------------------------------------------------------------ history */
  const HISTORY_KEYS = tags.map((t) => `tag:${t.id}`).concat(['kpi:product', 'kpi:heating', 'kpi:cooling', 'kpi:elec']);
  const history = new Map(HISTORY_KEYS.map((k) => [k, []]));
  let sinceSample = 0;
  function sample() {
    const k = kpis();
    for (const key of HISTORY_KEYS) {
      const v = key.startsWith('tag:') ? tagShown.get(key.slice(4)) : k[key.slice(4)];
      if (v == null || !isFinite(v)) continue;
      const arr = history.get(key);
      arr.push([plant.t, v]);
      if (arr.length > HISTORY_LEN) arr.shift();
    }
  }

  /* ------------------------------------------------------------ status */
  function avgActivity() {
    let sum = 0, n = 0;
    for (const s of streams) if (MAIN_KINDS.has(s.kind)) { sum += S.get(s.id).x; n++; }
    return n ? sum / n : 0;
  }
  function status() {
    if (plant.trips.P52 || plant.trips.O2) return 'Tripped';
    const avg = avgActivity();
    if (plant.running) {
      if (plant.coolingFail) return 'Upset';
      return avg > 0.97 ? 'Running' : 'Starting up';
    }
    return avg > 0.02 ? 'Shutting down' : 'Stopped';
  }

  /* ------------------------------------------------------------ integration */
  function step(dt) {
    plant.t += dt;
    const targets = new Map(streams.map((s) => [s.id, targetActivity(s)]));
    for (const s of streams) {
      const st = S.get(s.id), d = design.get(s.id), a = targets.get(s.id);
      st.a = a;
      st.x = lag(st.x, a, TAU, dt);
      if (a === 0 && st.x < 1e-4) st.x = 0;
      if (d.T != null) st.T = lag(st.T, a ? d.T : AMBIENT, 2 * TAU, dt);
      if (d.P != null) st.P = lag(st.P, a ? d.P : ATM, TAU / 2, dt);
    }

    U.load = lag(U.load, sp.load / 100, 300, dt);
    U['U2.T'] = lag(U['U2.T'], x('S4H') > 0.3 ? 180 : AMBIENT, 600, dt);
    U['U8b.T'] = lag(U['U8b.T'], x('S12I') > 0.3 ? sp.u8T : AMBIENT, 900, dt);
    U['U14.T'] = lag(U['U14.T'], x('SLA') > 0.3 ? 150 : AMBIENT, 600, dt);
    for (const id in LEVEL_FEED) U[`${id}.level`] = lag(U[`${id}.level`], x(LEVEL_FEED[id]) > 0.3 ? 50 : 12, 400, dt);

    // U5 temperature: controlled at 110 C, or heating up on the exotherm if cooling is lost
    const gen = 897 * U.load * x('U5F') * (plant.trips.O2 ? 0 : x('O2'));
    if (!plant.coolingFail) {
      U['U5.T'] = lag(U['U5.T'], x('U5F') > 0.3 ? 110 : AMBIENT, 400, dt);
    } else {
      const heatUp = (gen * 3600) / (36.7 * 971.6 * 3.064) / 3600;   // K/s
      // insulated vessel: slow loss to ambient (24 h time constant, illustrative)
      U['U5.T'] += (heatUp - (U['U5.T'] - AMBIENT) / (24 * 3600)) * dt;
    }
    if (U['U5.T'] >= 125 && !(plant.trips.P52 && plant.trips.O2)) {
      plant.trips.P52 = true;
      plant.trips.O2 = true;
      logEvent('Interlock I-501: U5 temperature high-high. P52 feed pump and oxygen feed tripped.', 'critical');
    }

    model = crystalliser(U.load, U['U8b.T']);
  }

  function tick(dtReal) {
    if (plant.paused || !(dtReal > 0)) return;
    const dtReal2 = Math.min(dtReal, 0.25);
    let simDt = dtReal2 * plant.speed;
    const n = Math.max(1, Math.ceil(simDt / 5));
    for (let i = 0; i < n; i++) step(simDt / n);
    updateNoise(simDt);
    evaluateAlarms();
    sinceSample += dtReal2;
    if (sinceSample >= SAMPLE_REAL_S) { sinceSample = 0; sample(); }
  }

  /* ------------------------------------------------------------ advisories (from setpoints) */
  function advisories() {
    const L = sp.load / 100;
    const m = crystalliser(L, sp.u8T);
    const out = [];
    if (sp.load > 100) out.push({ severity: 'warning', text: `Load above design. Equipment is sized for 100 %; conversions are held at design values here, so treat results above 100 % with care.` });
    if (m.avail < 40 * L - 0.01) out.push({ severity: 'critical', text: `Catalyst loop short: U11 can return only ${m.avail.toFixed(1)} kg/h FDCA to U1 against the ${(40 * L).toFixed(1)} kg/h recipe.` });
    if (m.u5wt > 9.0) out.push({ severity: 'critical', text: `U5 effluent at ${m.u5wt.toFixed(2)} wt% FDCA, above the 9.00 wt% saturation at 110 °C. Warm crystallisation leaves more FDCA in the mother liquor, and the recycle pushes U5 past its solubility limit.` });
    else if (m.u5wt > 8.8) out.push({ severity: 'warning', text: `U5 effluent at ${m.u5wt.toFixed(2)} wt% FDCA, close to the 9.00 wt% saturation limit.` });
    if (sp.u8T - 2 < 6) out.push({ severity: 'warning', text: `Below 8 °C the E-8b approach to 2 °C chilled water falls under its 6 K design value; the installed 45 m² would not hold this temperature.` });
    return { list: out, model: m, product: m.product * CAL };
  }

  /* ------------------------------------------------------------ operator actions */
  function start() {
    if (plant.trips.P52 || plant.trips.O2) { logEvent('Start refused: reset the trips first.', 'warning'); return; }
    if (plant.running) return;
    plant.running = true;
    logEvent('Operator start-up initiated.');
  }
  function stop() {
    if (!plant.running) return;
    plant.running = false;
    logEvent('Operator shutdown initiated. Feeds closing.');
  }
  function tripP52() {
    if (plant.trips.P52) return;
    plant.trips.P52 = true;
    plant.trips.O2 = true;
    logEvent('P52 feed pump tripped. Oxygen feed cut by interlock (no liquid flow to U5).', 'critical');
  }
  function failCooling() {
    if (plant.coolingFail) return;
    plant.coolingFail = true;
    logEvent('U5 coolant circulation lost. Reactor heating on its own exotherm.', 'critical');
  }
  function restoreCooling() {
    if (!plant.coolingFail) return;
    plant.coolingFail = false;
    logEvent('U5 coolant circulation restored.');
  }
  function resetTrips() {
    if (!plant.trips.P52 && !plant.trips.O2) return;
    if (plant.coolingFail) { logEvent('Reset refused: restore U5 cooling first.', 'warning'); return; }
    if (U['U5.T'] >= 115) { logEvent(`Reset refused: U5 at ${U['U5.T'].toFixed(1)} °C, must be below 115 °C.`, 'warning'); return; }
    plant.trips.P52 = false;
    plant.trips.O2 = false;
    logEvent('Trips reset. Feed to U5 restarting.');
  }
  function setSetpoint(key, value) {
    if (!(key in sp) || sp[key] === value) return;
    sp[key] = value;
  }
  function commitSetpoint(key) {
    const labels = { load: ['Plant load', '%'], u8T: ['Crystalliser outlet setpoint', '°C'], ufRec: ['Ultrafilter recovery', '%'] };
    logEvent(`${labels[key][0]} set to ${sp[key]} ${labels[key][1]}.`);
  }
  function ackAll() {
    let changed = false;
    for (const a of alarms) if (!a.acked) { a.acked = true; changed = true; }
    if (changed) alarmVersion++;
  }

  function clockText() {
    const t = Math.floor(plant.t + START_CLOCK_S);
    const day = Math.floor(t / 86400) + 1;
    const hh = String(Math.floor((t % 86400) / 3600)).padStart(2, '0');
    const mm = String(Math.floor((t % 3600) / 60)).padStart(2, '0');
    const ss = String(t % 60).padStart(2, '0');
    return `Day ${day} · ${hh}:${mm}:${ss}`;
  }
  function timeText(t) {
    const s = Math.floor(t + START_CLOCK_S) % 86400;
    return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}`;
  }

  updateNoise(1);
  sample();

  return {
    sp, plant, tags,
    tick, value: trueValue, streamValue, activity: (id) => (S.has(id) ? S.get(id).x : 0),
    unitActive, kpis, model: () => model, advisories, status, history: (key) => history.get(key) || [],
    alarms, alarmVersion: () => alarmVersion, alarmLevel: (id) => alarmLevel.get(id) || '', ackAll,
    start, stop, tripP52, failCooling, restoreCooling, resetTrips, setSetpoint, commitSetpoint,
    setSpeed: (v) => { plant.speed = v; }, setPaused: (v) => { plant.paused = v; },
    clockText, timeText, design: (id) => design.get(id)
  };
})();
