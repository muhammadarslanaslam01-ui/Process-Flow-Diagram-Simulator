/*
 * CONTROL ROOM  -  live layer on top of the PFD
 * Runs the SIM loop, draws instrument tags and vessel levels on the sheet,
 * animates running equipment, and renders the Control room tab (setpoints,
 * scenarios, trends, alarms) plus the live blocks in the Details tab.
 */
(function () {
  'use strict';

  const D = window.FLOWSHEET;
  const SIM = window.SIM;
  const PFD = window.PFD;
  const SYM = window.PFD_SYMBOLS;
  const NS = 'http://www.w3.org/2000/svg';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Fixed status palette (never reused for series); always shown with icon + label.
  const STATUS = { good: '#0ca30c', warning: '#fab219', serious: '#ec835a', critical: '#d03b3b', neutral: '#8a919c', info: '#6f7784' };
  const STATUS_OF = {
    Running: 'good', 'Starting up': 'warning', 'Shutting down': 'warning',
    Stopped: 'neutral', Tripped: 'critical', Upset: 'serious'
  };
  const LEVEL_UNITS = { E1: 'unit:E1:level', E4: 'unit:E4:level', U6: 'unit:U6:level', U8a: 'unit:U8a:level' };
  const MODEL_ROWS = {
    U8b: [['FDCA crystallised', 'model:recovery', '%', 1, 100], ['Crystals', 'model:crystals', 'kg/h', 1], ['FDCA left in mother liquor', 'model:S14F', 'kg/h', 1],
          ['FDCA solubility at outlet', 'model:solubility', 'wt%', 3], ['Stage 2 duty', 'model:dutyU8b', 'kW', 0], ['Refrigeration power', 'model:refrig', 'kW', 1]],
    U9:  [['Crystals to centrifuge', 'model:crystals', 'kg/h', 1]],
    U13: [['FDCA product', 'kpi:product', 'kg/h', 1], ['Annual rate', 'kpi:annual', 't/a', 0]],
    U5:  [['FDCA in effluent (saturation 9.00)', 'model:u5wt', 'wt%', 2], ['Heat released', 'kpi:u5gen', 'kW', 0]],
    U11: [['FDCA catalyst to U1', 'model:cat', 'kg/h', 1], ['FDCA in S16 to U5', 'model:S16F', 'kg/h', 1], ['FDCA lost in purge', 'model:purgeFDCA', 'kg/h', 2]],
    ENZ: [['Enzyme purchase', 'kpi:enzyme', 'kg/h', 2]],
    E3:  [['Enzyme recycled', 'stream:A8:flow', 'kg/h', 2]]
  };

  const tagById = new Map(SIM.tags.map((t) => [t.id, t]));
  const unitsById = new Map(D.units.map((u) => [u.id, u]));
  const streamsById = new Map(D.streams.map((s) => [s.id, s]));

  /* ------------------------------------------------------------ helpers */
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function svgEl(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function fmt(v, digits) {
    if (v == null || !isFinite(v)) return '—';
    return v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }
  const autoDigits = (v) => (Math.abs(v) >= 1000 ? 0 : Math.abs(v) >= 10 ? 1 : 2);
  function durationText(sec) {
    if (sec < 90) return `${Math.round(sec)} s`;
    if (sec < 5400) return `${Math.round(sec / 60)} min`;
    return `${(sec / 3600).toFixed(1)} h`;
  }
  function sevIcon(sev) {
    const c = STATUS[sev] || STATUS.info;
    const glyph = {
      good: `<circle cx="8" cy="8" r="7" fill="${c}"/><path d="M4.6 8.3l2.2 2.2 4.6-4.7" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`,
      warning: `<path d="M8 1.2l7.2 13H.8z" fill="${c}" stroke-linejoin="round"/><path d="M8 5.8v4" stroke="#1b1f24" stroke-width="1.7" stroke-linecap="round"/><circle cx="8" cy="12" r="0.95" fill="#1b1f24"/>`,
      serious: `<path d="M8 .8l7.2 7.2L8 15.2.8 8z" fill="${c}"/><path d="M8 4.6v4.2" stroke="#fff" stroke-width="1.7" stroke-linecap="round"/><circle cx="8" cy="11.2" r="0.95" fill="#fff"/>`,
      critical: `<path d="M5.1 1h5.8L15 5.1v5.8L10.9 15H5.1L1 10.9V5.1z" fill="${c}"/><path d="M5.6 5.6l4.8 4.8M10.4 5.6l-4.8 4.8" stroke="#fff" stroke-width="1.7" stroke-linecap="round"/>`,
      neutral: `<rect x="2" y="2" width="12" height="12" rx="2.5" fill="${c}"/>`,
      info: `<circle cx="8" cy="8" r="7" fill="${c}"/><path d="M8 7.2v4.3" stroke="#fff" stroke-width="1.7" stroke-linecap="round"/><circle cx="8" cy="4.8" r="1" fill="#fff"/>`
    }[sev] || '';
    return `<svg class="sev-icon" viewBox="0 0 16 16" aria-hidden="true">${glyph}</svg>`;
  }

  /* ------------------------------------------------------------ diagram layer */
  const instrNodes = new Map();
  let liquidNodes = [], streamNodes = [], unitNodes = [], flowTagNodes = [];

  function drawInstruments(layers) {
    const svg = PFD.svg();
    instrNodes.clear();
    liquidNodes = [];

    const g = svgEl('g', { class: 'instruments' });
    layers.tags.parentNode.insertBefore(g, layers.tags);
    for (const t of SIM.tags) {
      const node = svgEl('g', { class: 'instr', 'data-unit': t.unit, 'data-tag': t.id, transform: `translate(${t.x},${t.y})` }, g);
      svgEl('rect', { class: 'instr-box', x: -28, y: -12, width: 56, height: 24, rx: 4 }, node);
      svgEl('text', { class: 'instr-id', x: 0, y: -2.8 }, node).textContent = t.id;
      const val = svgEl('text', { class: 'instr-val', x: 0, y: 8.6 }, node);
      const flag = svgEl('g', { class: 'instr-flag', transform: 'translate(27,-12)' }, node);
      svgEl('rect', { x: -9, y: -6, width: 18, height: 12, rx: 3 }, flag);
      const flagText = svgEl('text', { x: 0, y: 0.4 }, flag);
      instrNodes.set(t.id, { node, val, flagText, last: '', lvl: null, unacked: null });
    }

    for (const unitId in LEVEL_UNITS) {
      const u = unitsById.get(unitId);
      const shape = svg.querySelector(`.unit[data-unit="${unitId}"] .shape`);
      if (!u || !shape) continue;
      const clipId = `liquid-clip-${unitId}`;
      const cp = svgEl('clipPath', { id: clipId }, layers.defs);
      svgEl('path', { d: SYM.vesselPath(u.x + 1.2, u.y + 1.2, u.w - 2.4, u.h - 2.4, SYM.headK(u.w) - 1) }, cp);
      const liq = svgEl('g', { class: 'liquid', 'clip-path': `url(#${clipId})` });
      shape.insertBefore(liq, shape.children[1] || null);
      const rect = svgEl('rect', { x: u.x, width: u.w, y: u.y + u.h, height: 0 }, liq);
      const surf = svgEl('line', { class: 'liquid-surface', x1: u.x, x2: u.x + u.w, y1: u.y + u.h, y2: u.y + u.h }, liq);
      liquidNodes.push({ u, key: LEVEL_UNITS[unitId], rect, surf });
    }

    streamNodes = [...svg.querySelectorAll('.stream')].map((n) => ({ n, id: n.dataset.stream, dur: 0, idle: null }));
    unitNodes = [...svg.querySelectorAll('.unit')].map((n) => ({ n, id: n.dataset.unit, running: null }));
    flowTagNodes = [...svg.querySelectorAll('.flow-tag')].map((n) => ({ id: n.dataset.for, span: n.querySelectorAll('tspan')[1] }));
    updateDiagram(true);
  }

  function updateDiagram(force) {
    const unacked = new Set(SIM.alarms.filter((a) => a.kind === 'alarm' && a.active && !a.acked).map((a) => a.tag));

    for (const t of SIM.tags) {
      const n = instrNodes.get(t.id);
      if (!n) continue;
      const text = `${fmt(SIM.value(`tag:${t.id}`), t.digits)} ${t.uom}`;
      if (text !== n.last) { n.val.textContent = text; n.last = text; }
      const lvl = SIM.alarmLevel(t.id);
      const un = unacked.has(t.id);
      if (force || lvl !== n.lvl || un !== n.unacked) {
        n.node.classList.toggle('alarm-warning', lvl.length === 1);
        n.node.classList.toggle('alarm-critical', lvl.length === 2);
        n.node.classList.toggle('unacked', un);
        n.flagText.textContent = lvl;
        n.lvl = lvl; n.unacked = un;
      }
    }

    for (const l of liquidNodes) {
      const level = Math.max(0, Math.min(100, SIM.value(l.key) || 0));
      const y = l.u.y + l.u.h * (1 - level / 100);
      l.rect.setAttribute('y', y.toFixed(1));
      l.rect.setAttribute('height', (l.u.y + l.u.h - y).toFixed(1));
      l.surf.setAttribute('y1', y.toFixed(1));
      l.surf.setAttribute('y2', y.toFixed(1));
    }

    for (const s of streamNodes) {
      const x = SIM.activity(s.id);
      const idle = x < 0.05;
      if (idle !== s.idle) { s.n.classList.toggle('is-idle', idle); s.idle = idle; }
      const d = SIM.design(s.id);
      const ratio = d && d.flow ? (SIM.streamValue(s.id, 'flow') || 0) / d.flow : x;
      const dur = Math.min(6, Math.max(0.45, 1.1 / Math.max(ratio, 0.18)));
      if (force || Math.abs(dur - s.dur) / (s.dur || 1) > 0.15) {
        s.n.style.setProperty('--flow-dur', `${dur.toFixed(2)}s`);
        s.dur = dur;
      }
    }

    for (const u of unitNodes) {
      const running = SIM.unitActive(u.id);
      if (running !== u.running) {
        u.n.classList.toggle('is-running', running);
        u.n.classList.toggle('is-idle', !running);
        u.running = running;
      }
    }

    for (const f of flowTagNodes) {
      const v = SIM.streamValue(f.id, 'flow');
      if (f.span && v != null) {
        const text = `${v.toLocaleString('en-US', { maximumFractionDigits: v >= 100 ? 0 : v >= 1 ? 1 : 3 })} kg/h`;
        if (f.span.textContent !== text) f.span.textContent = text;
      }
    }
  }

  /* ------------------------------------------------------------ sparklines */
  function sparkHTML(key, opts) {
    const o = opts || {};
    return `<div class="spark-wrap">
      <svg class="spark" data-spark="${esc(key)}" data-uom="${esc(o.uom || '')}" data-digits="${o.digits != null ? o.digits : 1}"
           ${o.tag ? `data-tag="${esc(o.tag)}"` : ''} role="img" aria-label="${esc(o.label || key)} trend"></svg>
      <div class="spark-tip" hidden></div>
      <p class="spark-foot" data-span="${esc(key)}"></p>
    </div>`;
  }

  function drawSpark(node) {
    const w = Math.round(node.clientWidth);
    if (!w) return;
    const h = 64;
    const key = node.dataset.spark;
    const hist = SIM.history(key);
    const digits = +node.dataset.digits;
    const uom = node.dataset.uom;
    node.setAttribute('viewBox', `0 0 ${w} ${h}`);
    const foot = node.parentNode.querySelector('.spark-foot');
    if (hist.length < 2) { node.innerHTML = ''; return; }

    const tag = node.dataset.tag ? tagById.get(node.dataset.tag) : null;
    const L = 2, R = 52, T = 8, B = 8;
    const t0 = hist[0][0], t1 = hist[hist.length - 1][0];
    let lo = Infinity, hi = -Infinity;
    for (const [, v] of hist) { if (v < lo) lo = v; if (v > hi) hi = v; }
    const minSpan = tag && tag.id[0] === 'T' ? 2 : tag && tag.id[0] === 'L' ? 10 : Math.max(Math.abs(hi) * 0.02, 0.05);
    const span = Math.max(hi - lo, minSpan);

    const limits = [];
    if (tag) {
      for (const [k, sev, lbl] of [['hihi', 'critical', 'HH'], ['hi', 'warning', 'H'], ['lo', 'warning', 'L'], ['lolo', 'critical', 'LL']]) {
        const lv = tag[k];
        if (lv != null && lv <= hi + span * 1.5 && lv >= lo - span * 1.5) limits.push({ lv, sev, lbl });
      }
    }
    for (const l of limits) { lo = Math.min(lo, l.lv); hi = Math.max(hi, l.lv); }
    const mid = (hi + lo) / 2;
    const half = Math.max((hi - lo) / 2, minSpan / 2) * 1.18;
    let yLo = mid - half, yHi = mid + half;
    if (lo >= 0 && yLo < 0) { yHi -= yLo; yLo = 0; }   // flows, levels: never below zero
    const sx = (t) => L + (t1 === t0 ? 1 : (t - t0) / (t1 - t0)) * (w - L - R);
    const sy = (v) => T + (1 - (v - yLo) / (yHi - yLo)) * (h - T - B);

    let d = '';
    hist.forEach(([t, v], i) => { d += `${i ? 'L' : 'M'}${sx(t).toFixed(1)},${sy(v).toFixed(1)}`; });
    const last = hist[hist.length - 1];
    let out = `<line class="spark-base" x1="${L}" x2="${w - R}" y1="${h - B}" y2="${h - B}"/>`;
    let lastLabelY = -99;
    for (const l of limits.sort((a, b) => b.lv - a.lv)) {
      const y = sy(l.lv);
      out += `<line class="spark-limit" x1="${L}" x2="${w - R}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${STATUS[l.sev]}"/>`;
      if (y - lastLabelY > 10) { out += `<text class="spark-label" x="${w - R + 6}" y="${(y + 3.5).toFixed(1)}">${l.lbl} ${fmt(l.lv, digits)}</text>`; lastLabelY = y; }
    }
    if (!limits.length) {
      out += `<text class="spark-label" x="${w - R + 6}" y="${T + 4}">${fmt(yHi, digits)}</text>` +
             `<text class="spark-label" x="${w - R + 6}" y="${h - B + 2}">${fmt(yLo, digits)}</text>`;
    }
    out += `<path class="spark-line" d="${d}"/>`;
    out += `<circle class="spark-dot" cx="${sx(last[0]).toFixed(1)}" cy="${sy(last[1]).toFixed(1)}" r="3.5"/>`;

    const tip = node.parentNode.querySelector('.spark-tip');
    if (node._hoverX != null) {
      const tx = t0 + ((Math.min(Math.max(node._hoverX, L), w - R) - L) / (w - L - R)) * (t1 - t0);
      let best = hist[0];
      for (const p of hist) if (Math.abs(p[0] - tx) < Math.abs(best[0] - tx)) best = p;
      const cx = sx(best[0]), cy = sy(best[1]);
      out += `<line class="spark-cross" x1="${cx.toFixed(1)}" x2="${cx.toFixed(1)}" y1="${T - 4}" y2="${h - B}"/>` +
             `<circle class="spark-dot" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="4"/>`;
      tip.hidden = false;
      tip.innerHTML = `<strong>${fmt(best[1], digits)} ${esc(uom)}</strong> <span>at ${SIM.timeText(best[0])}</span>`;
      const tipW = tip.offsetWidth;
      tip.style.left = `${Math.min(Math.max(cx - tipW / 2, 0), w - tipW)}px`;
    } else {
      tip.hidden = true;
    }
    node.innerHTML = out;
    if (foot) foot.textContent = `Last ${durationText(t1 - t0)} of plant time`;
  }

  /* ------------------------------------------------------------ panel hooks */
  function trendHTML(t) {
    return `<div class="trend">
      <div class="trend-head">
        <span class="tagid">${esc(t.id)}</span><span class="trend-name">${esc(t.label)}</span>
        <span class="trend-val"><span data-alarm="${esc(t.id)}"></span><span data-live="tag:${esc(t.id)}" data-digits="${t.digits}">—</span> <span class="uom">${esc(t.uom)}</span></span>
      </div>
      ${sparkHTML(`tag:${t.id}`, { uom: t.uom, digits: t.digits, tag: t.id, label: t.label })}
    </div>`;
  }

  function modelRowsHTML(rows) {
    return `<dl class="kv">${rows.map(([label, key, uom, digits, scale]) =>
      `<div><dt>${esc(label)}</dt><dd><span data-live="${esc(key)}" data-digits="${digits}"${scale ? ` data-scale="${scale}"` : ''}>—</span> <span class="uom">${esc(uom)}</span></dd></div>`).join('')}</dl>`;
  }

  // Panels are injected as HTML; fill their live values as soon as they are in the DOM.
  function fillSoon() {
    queueMicrotask(() => {
      updateLive();
      document.querySelectorAll('#panel .spark').forEach((n) => { if (n.getClientRects().length) drawSpark(n); });
    });
  }

  function unitLive(u) {
    fillSoon();
    const tags = SIM.tags.filter((t) => t.unit === u.id);
    const rows = MODEL_ROWS[u.id] || [];
    return `<section class="block live-block">
        <div class="block-head"><h3><span class="live-dot" aria-hidden="true"></span>Live</h3><span class="unit-state" data-unitstate="${esc(u.id)}"></span></div>
        ${tags.map(trendHTML).join('')}
        ${rows.length ? `<p class="sub-head">Model at current conditions</p>${modelRowsHTML(rows)}` : ''}
        ${!tags.length && !rows.length ? '<p class="small muted">No instrument on this unit. Its state follows its inlet streams.</p>' : ''}
      </section>
      <p class="design-divider"><span>Design basis</span></p>`;
  }

  function streamLive(s) {
    fillSoon();
    const d = SIM.design(s.id) || {};
    const tile = (label, field, uom, dv) => {
      if (dv == null) return `<div class="stat"><span class="stat-label">${label}</span><span class="stat-value"><span class="muted">—</span></span></div>`;
      const digits = field === 'flow' ? (dv >= 1000 ? 0 : dv >= 1 ? 1 : 4) : field === 'P' ? (dv < 1 ? 3 : 2) : 1;
      return `<div class="stat"><span class="stat-label">${label}</span>
        <span class="stat-value"><span data-live="stream:${esc(s.id)}:${field}" data-digits="${digits}">—</span><span class="uom"> ${uom}</span></span>
        <span class="stat-design">design ${fmt(dv, digits)}</span></div>`;
    };
    return `<div class="block-head live-head"><h3><span class="live-dot" aria-hidden="true"></span>Live</h3><span class="unit-state" data-streamstate="${esc(s.id)}"></span></div>
      <div class="stats">${tile('Mass flow', 'flow', 'kg/h', d.flow)}${tile('Temperature', 'T', '°C', d.T)}${tile('Pressure', 'P', 'bar', d.P)}</div>`;
  }

  function tooltipLive(target) {
    if (target.dataset.stream) {
      const s = streamsById.get(target.dataset.stream);
      const bits = [];
      const f = SIM.streamValue(s.id, 'flow'), T = SIM.streamValue(s.id, 'T'), P = SIM.streamValue(s.id, 'P');
      if (f != null) bits.push(`${fmt(f, f >= 1000 ? 0 : 1)} kg/h`);
      if (T != null) bits.push(`${fmt(T, 1)} °C`);
      if (P != null) bits.push(`${fmt(P, P < 1 ? 3 : 2)} bar`);
      return `<strong>${esc(s.id)} · ${esc(s.name)}</strong><span>${SIM.activity(s.id) < 0.05 ? 'No flow' : esc(bits.join(' · ') || 'Flowing')}</span>`;
    }
    if (target.dataset.unit) {
      const u = unitsById.get(target.dataset.unit);
      const tags = SIM.tags.filter((t) => t.unit === u.id);
      const state = SIM.unitActive(u.id) ? 'Running' : 'Idle';
      const lines = tags.map((t) => {
        const lvl = SIM.alarmLevel(t.id);
        return `<span>${esc(t.id)} ${esc(t.label)}: ${fmt(SIM.value(`tag:${t.id}`), t.digits)} ${esc(t.uom)}${lvl ? ` · alarm ${lvl}` : ''}</span>`;
      }).join('');
      return `<strong>${esc(u.tag)} · ${esc(u.name)}</strong><span>${state}</span>${lines}`;
    }
    return null;
  }

  function kpisHTML() {
    return `
      <div class="kpi"><dt>FDCA product</dt><dd><span data-live="kpi:product" data-digits="1">—</span> <span class="uom">kg/h</span></dd></div>
      <div class="kpi"><dt>Annual rate</dt><dd><span data-live="kpi:annual" data-digits="0">—</span> <span class="uom">t/a</span></dd></div>
      <div class="kpi"><dt>Purity</dt><dd>99.8 <span class="uom">wt%</span></dd></div>
      <div class="kpi"><dt>GVL recovered</dt><dd>99.5 <span class="uom">%</span></dd></div>
      <div class="kpi"><dt>Active alarms</dt><dd><span data-live="alarms:active">0</span></dd></div>`;
  }

  /* ------------------------------------------------------------ control room tab */
  const control = document.getElementById('control-view');

  function sliderHTML(key, label, uom, min, max, step) {
    return `<div class="slider">
      <div class="slider-head"><label for="sp-${key}">${esc(label)}</label><output id="out-${key}" for="sp-${key}">${SIM.sp[key]} ${uom}</output></div>
      <input type="range" id="sp-${key}" data-sp="${key}" data-uom="${uom}" min="${min}" max="${max}" step="${step}" value="${SIM.sp[key]}">
      <div class="slider-scale" aria-hidden="true"><span>${min} ${uom}</span><span>${max} ${uom}</span></div>
    </div>`;
  }

  function renderControl() {
    control.innerHTML = `
      <header class="panel-head">
        <p class="eyebrow">Operator view</p>
        <h2>Control room</h2>
        <p class="lede">Change setpoints or trip equipment and watch the plant respond. Select any unit or stream on the sheet for its live readings.</p>
      </header>

      <section class="block">
        <h3>Production</h3>
        <div class="tile">
          <div class="tile-head"><span class="tile-label">FDCA product</span><span class="tile-sub">design 643.7 kg/h</span></div>
          <div class="tile-value"><span data-live="kpi:product" data-digits="1">—</span><span class="uom"> kg/h</span>
            <span class="tile-aside"><span data-live="kpi:annual" data-digits="0">—</span> t/a</span></div>
          ${sparkHTML('kpi:product', { uom: 'kg/h', digits: 1, label: 'FDCA product' })}
        </div>
        <div class="mini-tiles">
          <div class="mini"><span class="stat-label">Heating</span><span class="stat-value"><span data-live="kpi:heating" data-digits="0">—</span><span class="uom"> kW</span></span></div>
          <div class="mini"><span class="stat-label">Cooling</span><span class="stat-value"><span data-live="kpi:cooling" data-digits="0">—</span><span class="uom"> kW</span></span></div>
          <div class="mini"><span class="stat-label">Electricity</span><span class="stat-value"><span data-live="kpi:elec" data-digits="0">—</span><span class="uom"> kW</span></span></div>
        </div>
      </section>

      <section class="block">
        <h3>Setpoints</h3>
        ${sliderHTML('load', 'Plant load', '%', 60, 110, 1)}
        ${sliderHTML('u8T', 'Crystalliser outlet, U8b', '°C', 4, 35, 0.5)}
        ${sliderHTML('ufRec', 'Enzyme ultrafilter recovery, E3', '%', 90, 99, 0.5)}
        <p class="sub-head">Steady state at these setpoints</p>
        <dl class="kv" id="sp-predict"></dl>
        <div class="advisories" id="advisories" aria-live="polite"></div>
      </section>

      <section class="block">
        <h3>Scenarios</h3>
        <div class="scenario-grid">
          <button class="scenario" data-act="tripP52">Trip P52 feed pump</button>
          <button class="scenario" data-act="failCooling">Lose U5 cooling</button>
          <button class="scenario" data-act="restoreCooling">Restore U5 cooling</button>
          <button class="scenario" data-act="resetTrips">Reset trips</button>
        </div>
        <p class="small muted">Without cooling, U5 heats at about 30 K/h on its own exotherm. At 125 °C, interlock I-501 trips the feed pump and the oxygen. Set the speed to 300× to watch it happen.</p>
      </section>

      <section class="block">
        <h3>Key trends</h3>
        ${trendHTML(tagById.get('TI-501'))}
        ${trendHTML(tagById.get('TI-801'))}
        ${trendHTML(tagById.get('FI-402'))}
      </section>

      <section class="block" id="alarms-block">
        <div class="block-head"><h3>Alarms and events</h3><button class="link small" id="ack-all">Acknowledge all</button></div>
        <ol class="alarm-list" id="alarm-list"></ol>
      </section>

      <p class="note"><strong>How this simulation works.</strong> Steady states come from the unit models: flows and duties scale with plant load at design conversions; the crystalliser uses the U8 solubility fit, with the FDCA recycle through U9, U10 and U11 solved to convergence. The start-up, shutdown and trip responses are illustrative first-order lags, not a dynamic model, and instrument noise is simulated.</p>`;

    control.querySelectorAll('input[type="range"]').forEach((input) => {
      const key = input.dataset.sp;
      input.addEventListener('input', () => {
        SIM.setSetpoint(key, +input.value);
        document.getElementById(`out-${key}`).textContent = `${input.value} ${input.dataset.uom}`;
        renderAdvisories();
      });
      input.addEventListener('change', () => SIM.commitSetpoint(key));
    });
    control.querySelectorAll('.scenario').forEach((b) => b.addEventListener('click', () => SIM[b.dataset.act]()));
    document.getElementById('ack-all').addEventListener('click', () => SIM.ackAll());
    renderAdvisories();
  }

  function renderAdvisories() {
    const adv = SIM.advisories();
    document.getElementById('sp-predict').innerHTML = [
      ['FDCA product', fmt(adv.product, 1), 'kg/h'],
      ['FDCA crystallised in U8', fmt(adv.model.recovery * 100, 1), '%'],
      ['FDCA in U5 effluent', fmt(adv.model.u5wt, 2), 'wt% (sat. 9.00)'],
      ['Enzyme purchase', fmt(52.73 * (1 - SIM.sp.ufRec / 100) * SIM.sp.load / 100, 2), 'kg/h']
    ].map(([k, v, u]) => `<div><dt>${esc(k)}</dt><dd>${v} <span class="uom">${esc(u)}</span></dd></div>`).join('');
    document.getElementById('advisories').innerHTML = adv.list.length
      ? adv.list.map((a) => `<p class="advisory sev-${a.severity}">${sevIcon(a.severity)}<span><strong>${a.severity === 'critical' ? 'Limit exceeded' : 'Caution'}:</strong> ${esc(a.text)}</span></p>`).join('')
      : `<p class="advisory sev-good">${sevIcon('good')}<span><strong>Within limits:</strong> no constraint is active at these setpoints.</span></p>`;
  }

  function renderAlarms() {
    const list = document.getElementById('alarm-list');
    const items = SIM.alarms.slice(0, 40);
    if (!items.length) { list.innerHTML = '<li class="empty">No alarms or events yet.</li>'; return; }
    list.innerHTML = items.map((a) => {
      const sev = a.severity || 'info';
      let state = '';
      if (a.kind === 'alarm') state = `${a.level} · ${a.active ? (a.acked ? 'active' : 'unacknowledged') : 'cleared'}`;
      const tag = a.tag ? tagById.get(a.tag) : null;
      const sevLabel = { critical: 'Critical', warning: 'Warning', serious: 'Serious', good: 'Normal', info: 'Event' }[sev];
      return `<li class="alarm-item sev-${sev}${a.active ? ' is-active' : ''}${a.acked ? '' : ' is-unacked'}${a.kind === 'alarm' && !a.active ? ' is-cleared' : ''}">
        ${sevIcon(sev)}<span class="sr-only">${sevLabel}: </span>
        <span class="ai-time">${SIM.timeText(a.t)}</span>
        <span class="ai-text">${tag ? `<button class="link tagid" data-unit="${esc(tag.unit)}">${esc(a.tag)}</button> ` : ''}${esc(a.text)}${state ? `<span class="ai-state">${esc(state)}</span>` : ''}</span>
      </li>`;
    }).join('');
  }

  /* ------------------------------------------------------------ toolbar */
  const statusEl = document.getElementById('sim-status');
  const runBtn = document.getElementById('sim-run');
  const pauseBtn = document.getElementById('sim-pause');
  const clockEl = document.getElementById('sim-clock');
  const alarmBtn = document.getElementById('alarm-btn');
  const alarmCount = document.getElementById('alarm-count');
  let lastStatus = '';

  function bindToolbar() {
    runBtn.addEventListener('click', () => (SIM.plant.running ? SIM.stop() : SIM.start()));
    pauseBtn.addEventListener('click', () => {
      const paused = pauseBtn.getAttribute('aria-pressed') !== 'true';
      pauseBtn.setAttribute('aria-pressed', String(paused));
      pauseBtn.setAttribute('aria-label', paused ? 'Resume simulation' : 'Pause simulation');
      pauseBtn.title = paused ? 'Resume simulation' : 'Pause simulation';
      document.body.classList.toggle('sim-paused', paused);
      SIM.setPaused(paused);
    });
    document.getElementById('sim-speed').addEventListener('change', (e) => SIM.setSpeed(+e.target.value));
    alarmBtn.addEventListener('click', () => {
      PFD.showTab('control');
      const wrap = document.getElementById('panel-wrap');
      const block = document.getElementById('alarms-block');
      const tabs = wrap.querySelector('.panel-tabs').offsetHeight;
      const top = block.getBoundingClientRect().top - wrap.getBoundingClientRect().top + wrap.scrollTop - tabs;
      wrap.scrollTo({ top, behavior: reducedMotion ? 'auto' : 'smooth' });
      if (window.matchMedia('(max-width: 1000px)').matches) block.scrollIntoView({ block: 'start' });
    });
    control.addEventListener('click', (e) => {
      const t = e.target.closest('[data-unit]');
      if (t) PFD.select({ type: 'unit', id: t.dataset.unit }, { focus: true });
    });
    // sparkline hover (delegated; sparks are re-created with the panels)
    const wrap = document.getElementById('panel-wrap');
    wrap.addEventListener('pointermove', (e) => {
      const node = e.target.closest('.spark');
      if (!node) return;
      node._hoverX = e.clientX - node.getBoundingClientRect().left;
      drawSpark(node);
    });
    wrap.addEventListener('pointerout', (e) => {
      const node = e.target.closest('.spark');
      if (node && !node.contains(e.relatedTarget)) { node._hoverX = null; drawSpark(node); }
    });
  }

  function updateToolbar() {
    const st = SIM.status();
    if (st !== lastStatus) {
      const sev = STATUS_OF[st];
      statusEl.innerHTML = `${sevIcon(sev)}<span>${esc(st)}</span>`;
      statusEl.dataset.sev = sev;
      lastStatus = st;
    }
    const runLabel = SIM.plant.running ? 'Stop plant' : 'Start plant';
    if (runBtn.textContent !== runLabel) runBtn.textContent = runLabel;
    clockEl.textContent = SIM.clockText();

    const active = SIM.alarms.filter((a) => a.kind === 'alarm' && a.active);
    const unacked = SIM.alarms.some((a) => a.kind === 'alarm' && !a.acked);
    alarmCount.textContent = String(active.length);
    alarmBtn.classList.toggle('has-active', active.length > 0);
    alarmBtn.classList.toggle('has-critical', active.some((a) => a.severity === 'critical'));
    alarmBtn.classList.toggle('has-unacked', unacked);

    const p = SIM.plant;
    const set = (act, disabled) => control.querySelectorAll(`[data-act="${act}"]`).forEach((b) => { b.disabled = disabled; });
    set('tripP52', p.trips.P52 || !p.running);
    set('failCooling', p.coolingFail);
    set('restoreCooling', !p.coolingFail);
    set('resetTrips', !(p.trips.P52 || p.trips.O2));
  }

  function updateLive() {
    const activeCount = SIM.alarms.filter((a) => a.kind === 'alarm' && a.active).length;
    for (const el of document.querySelectorAll('[data-live]')) {
      const key = el.dataset.live;
      let text;
      if (key === 'alarms:active') {
        text = String(activeCount);
      } else {
        let v = SIM.value(key);
        if (v != null && el.dataset.scale) v *= +el.dataset.scale;
        const digits = el.dataset.digits != null ? +el.dataset.digits : v == null ? 0 : autoDigits(v);
        text = fmt(v, digits);
      }
      if (el.textContent !== text) el.textContent = text;
    }
    for (const el of document.querySelectorAll('[data-alarm]')) {
      const lvl = SIM.alarmLevel(el.dataset.alarm);
      const html = lvl ? `<span class="alarm-pill sev-${lvl.length === 2 ? 'critical' : 'warning'}">${sevIcon(lvl.length === 2 ? 'critical' : 'warning')}${lvl}</span>` : '';
      if (el.dataset.last !== html) { el.innerHTML = html; el.dataset.last = html; }
    }
    for (const el of document.querySelectorAll('[data-unitstate], [data-streamstate]')) {
      const on = el.dataset.unitstate ? SIM.unitActive(el.dataset.unitstate) : SIM.activity(el.dataset.streamstate) > 0.05;
      const label = el.dataset.unitstate ? (on ? 'Running' : 'Idle') : (on ? 'Flowing' : 'No flow');
      const html = `${sevIcon(on ? 'good' : 'neutral')}<span>${label}</span>`;
      if (el.dataset.last !== html) { el.innerHTML = html; el.dataset.last = html; }
    }
  }

  /* ------------------------------------------------------------ loop */
  let lastFrame = performance.now(), lastUI = 0, lastSpark = 0, alarmVersion = -1;
  function frame(now) {
    SIM.tick((now - lastFrame) / 1000);
    lastFrame = now;
    if (now - lastUI > 250) {
      lastUI = now;
      updateDiagram(false);
      updateLive();
      updateToolbar();
      if (SIM.alarmVersion() !== alarmVersion) { alarmVersion = SIM.alarmVersion(); renderAlarms(); }
    }
    if (now - lastSpark > 500) {
      lastSpark = now;
      document.querySelectorAll('.spark').forEach((n) => { if (n.getClientRects().length) drawSpark(n); });
    }
    requestAnimationFrame(frame);
  }

  /* ------------------------------------------------------------ boot */
  renderControl();
  bindToolbar();
  PFD.hooks.afterRender.push(drawInstruments);
  PFD.hooks.unitLive = unitLive;
  PFD.hooks.streamLive = streamLive;
  PFD.hooks.tooltipExtra = tooltipLive;
  PFD.hooks.kpis = kpisHTML;
  PFD.refresh();
  updateLive();
  updateToolbar();
  renderAlarms();
  requestAnimationFrame(frame);

  /* Redraw everything now (used after scripted SIM changes, e.g. in tests). */
  window.CONTROL_ROOM = {
    redraw() {
      updateDiagram(true); updateLive(); updateToolbar(); renderAlarms();
      document.querySelectorAll('.spark').forEach((n) => { if (n.getClientRects().length) drawSpark(n); });
    }
  };
})();
