/*
 * PFD RENDERER + INTERACTION
 * Draws window.FLOWSHEET with window.PFD_SYMBOLS into #pfd, then wires up
 * hover tooltips, selection, the details panel, pan/zoom and view toggles.
 *
 * To push new simulation results in later, mutate FLOWSHEET (unit rows,
 * stream data) and call PFD.refresh() - the drawing is rebuilt from data.
 */
(function () {
  'use strict';

  const D = window.FLOWSHEET;
  const S = window.PFD_SYMBOLS;
  const NS = 'http://www.w3.org/2000/svg';

  const svg = document.getElementById('pfd');
  const canvas = document.getElementById('canvas');
  const panel = document.getElementById('panel');
  const panelWrap = document.getElementById('panel-wrap');

  /* Extension points used by control-room.js (live simulation layer). */
  const hooks = {
    afterRender: [],      // (layers) => void, after the sheet is drawn
    unitLive: null,       // (unit) => html inserted at the top of a unit panel
    streamLive: null,     // (stream) => html replacing the design stat tiles
    tooltipExtra: null,   // (element) => html appended to a hover tooltip
    kpis: null            // () => html for the header KPI strip
  };
  const tooltip = document.getElementById('tooltip');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const SHEET = { x: 0, y: 0, w: D.canvas.width, h: D.canvas.height };
  let view = { ...SHEET };
  let unitsById, streamsById, sectionsById;
  let selection = null;           // { type: 'unit' | 'stream' | 'section', id }
  let layers = {};

  /* ------------------------------------------------------------ helpers */
  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const list = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
  const num = (v) => (typeof v === 'number' ? v.toLocaleString('en-US', { maximumFractionDigits: 4 }) : String(v));
  function flowShort(v) {
    if (typeof v !== 'number') return String(v);
    const digits = v >= 100 ? 0 : v >= 1 ? 1 : 3;
    return v.toLocaleString('en-US', { maximumFractionDigits: digits });
  }
  function boxOf(u) {
    return u.r != null ? { x: u.cx - u.r, y: u.cy - u.r, w: 2 * u.r, h: 2 * u.r } : { x: u.x, y: u.y, w: u.w, h: u.h };
  }
  const sectionOf = (u) => sectionsById.get(u.section);
  const unitLabel = (id) => { const u = unitsById.get(id); return u ? `${u.tag} ${u.name}` : id; };

  /* ------------------------------------------------------------ defs */
  const hatchIds = new Map();
  function hatch(color) {
    if (!hatchIds.has(color)) {
      const id = `hatch-${hatchIds.size}`;
      const p = el('pattern', { id, width: 7, height: 7, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, layers.defs);
      el('rect', { width: 7, height: 7, fill: '#ffffff' }, p);
      el('line', { x1: 0, y1: 0, x2: 0, y2: 7, stroke: color, 'stroke-width': 2.2 }, p);
      hatchIds.set(color, id);
    }
    return `url(#${hatchIds.get(color)})`;
  }
  function buildMarkers() {
    for (const kind in D.streamStyles) {
      const m = el('marker', { id: `arr-${kind}`, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 9, markerHeight: 9,
                               markerUnits: 'userSpaceOnUse', orient: 'auto' }, layers.defs);
      el('path', { d: 'M0,1 L10,5 L0,9 Z', fill: D.streamStyles[kind].color }, m);
    }
  }

  /* ------------------------------------------------------------ drawing */
  function render() {
    svg.textContent = '';
    hatchIds.clear();
    svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
    layers = {
      defs: el('defs', null, svg),
      paper: el('g', { class: 'paper' }, svg),
      sections: el('g', { class: 'sections' }, svg),
      streams: el('g', { class: 'streams' }, svg),
      junctions: el('g', { class: 'junctions' }, svg),
      units: el('g', { class: 'units' }, svg),
      texts: el('g', { class: 'texts' }, svg),
      tags: el('g', { class: 'tags', 'aria-hidden': 'true' }, svg),
      sel: el('g', { class: 'sel', 'aria-hidden': 'true' }, svg)
    };
    buildMarkers();
    el('rect', { x: 0, y: 0, width: SHEET.w, height: SHEET.h, fill: '#ffffff' }, layers.paper);

    D.sections.forEach(drawSection);
    D.streams.forEach(drawStream);
    D.junctions.forEach((j) => el('circle', { cx: j.x, cy: j.y, r: 3.4, fill: D.streamStyles[j.kind].color }, layers.junctions));
    D.units.forEach(drawUnit);
    D.texts.forEach((t) => {
      el('text', { x: t.x, y: t.y, class: `pfd-text ${t.cls || ''}`, 'text-anchor': t.anchor || 'middle' }, layers.texts).textContent = t.text;
    });
    drawTags();
    hooks.afterRender.forEach((fn) => fn(layers));
    applySelection();
  }

  function drawSection(s) {
    el('rect', { x: s.x, y: s.y, width: s.w, height: s.h, class: 'section-frame' }, layers.sections);
    const t = el('text', { x: s.tx, y: s.ty, class: 'section-title', 'text-anchor': 'middle', 'data-section': s.id,
                           tabindex: 0, role: 'button', 'aria-label': `${s.title.join(' ')} section` }, layers.sections);
    s.title.forEach((line, i) => el('tspan', { x: s.tx, dy: i ? 26 : 0 }, t).textContent = line);
  }

  function drawStream(s) {
    const st = D.streamStyles[s.kind];
    const d = 'M' + s.points.map((p) => p.join(',')).join(' L');
    const g = el('g', { class: `stream kind-${s.kind}`, 'data-stream': s.id, tabindex: 0, role: 'button',
                        'aria-label': `Stream ${s.name}` }, layers.streams);
    el('path', { d, class: 'hit' }, g);
    el('path', { d, class: 'line', stroke: st.color, 'stroke-width': st.width,
                 'stroke-dasharray': st.dash || null, 'stroke-linecap': st.dash ? 'round' : 'butt',
                 'marker-end': s.arrow === false ? null : `url(#arr-${s.kind})` }, g);
    el('path', { d, class: 'flow', stroke: st.color, 'stroke-width': st.width + 2.8 }, g);
  }

  function drawUnit(u) {
    const b = boxOf(u);
    const g = el('g', { class: 'unit', 'data-unit': u.id, tabindex: 0, role: 'button', 'aria-label': `${u.tag} ${u.name}` }, layers.units);
    el('rect', { class: 'hit', x: b.x - 6, y: b.y - 6, width: b.w + 12, height: b.h + 12, rx: 6 }, g);
    const shape = el('g', { class: 'shape' }, g);
    S[u.symbol](shape, u, { el, hatch });
    if (u.label) {
      const size = u.label.size || 11.5;
      const t = el('text', { x: u.label.x, y: u.label.y, class: 'unit-label', 'text-anchor': u.label.anchor || 'middle',
                             'font-size': size }, g);
      u.label.lines.forEach((line, i) => el('tspan', { x: u.label.x, dy: i ? size * 1.22 : 0 }, t).textContent = line);
    }
  }

  function longestMidpoint(pts) {
    let best = null, bestLen = -1;
    for (let i = 1; i < pts.length; i++) {
      const len = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      if (len > bestLen) { bestLen = len; best = [(pts[i][0] + pts[i - 1][0]) / 2, (pts[i][1] + pts[i - 1][1]) / 2]; }
    }
    return best;
  }

  function drawTags() {
    for (const s of D.streams) {
      if (s.tag === false || !s.data || typeof s.data.flow !== 'number') continue;
      const [x, y] = s.tagAt || longestMidpoint(s.points);
      const g = el('g', { class: 'flow-tag', 'data-for': s.id, transform: `translate(${x},${y})` }, layers.tags);
      const rect = el('rect', { rx: 4 }, g);
      const t = el('text', { x: 0, y: 0, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, g);
      el('tspan', { class: 'id' }, t).textContent = s.id + ' ';
      el('tspan', null, t).textContent = `${flowShort(s.data.flow)} kg/h`;
      const bb = t.getBBox();
      rect.setAttribute('x', bb.x - 5); rect.setAttribute('y', bb.y - 2.5);
      rect.setAttribute('width', bb.width + 10); rect.setAttribute('height', bb.height + 5);
      rect.setAttribute('stroke', D.streamStyles[s.kind].color);
    }
  }

  /* ------------------------------------------------------------ selection */
  function streamsOfUnit(id) {
    return D.streams.filter((s) => list(s.from).includes(id) || list(s.to).includes(id));
  }

  function select(sel, opts) {
    selection = sel;
    applySelection();
    renderPanel();
    if (sel || (opts && opts.showDetails)) showTab('details');
    const hash = sel ? `#${sel.type}/${sel.id}` : '';
    if (location.hash !== hash) {
      try { history.replaceState(null, '', location.href.split('#')[0] + hash); } catch (e) { /* e.g. sandboxed frame */ }
    }
    if (opts && opts.focus && sel && sel.type === 'unit') focusOn(boxOf(unitsById.get(sel.id)));
  }

  function applySelection() {
    svg.querySelectorAll('.related, .selected').forEach((n) => n.classList.remove('related', 'selected'));
    layers.sel.textContent = '';
    svg.classList.toggle('has-focus', !!selection);
    if (!selection) return;

    const mark = (selector, cls) => svg.querySelectorAll(selector).forEach((n) => n.classList.add(cls));
    if (selection.type === 'unit') {
      const u = unitsById.get(selection.id);
      mark(`[data-unit="${u.id}"]`, 'selected');
      mark(`[data-unit="${u.id}"]`, 'related');
      for (const s of streamsOfUnit(u.id)) {
        mark(`[data-stream="${s.id}"]`, 'related');
        mark(`.flow-tag[data-for="${s.id}"]`, 'related');
        [...list(s.from), ...list(s.to)].forEach((id) => mark(`[data-unit="${id}"]`, 'related'));
      }
      const b = boxOf(u);
      el('rect', { x: b.x - 9, y: b.y - 9, width: b.w + 18, height: b.h + 18, rx: 8, class: 'sel-ring' }, layers.sel);
    } else if (selection.type === 'stream') {
      const s = streamsById.get(selection.id);
      mark(`[data-stream="${s.id}"]`, 'selected');
      mark(`[data-stream="${s.id}"]`, 'related');
      mark(`.flow-tag[data-for="${s.id}"]`, 'related');
      [...list(s.from), ...list(s.to)].forEach((id) => mark(`[data-unit="${id}"]`, 'related'));
    } else if (selection.type === 'section') {
      const ids = new Set(D.units.filter((u) => u.section === selection.id).map((u) => u.id));
      ids.forEach((id) => mark(`[data-unit="${id}"]`, 'related'));
      D.streams.filter((s) => [...list(s.from), ...list(s.to)].some((id) => ids.has(id)))
        .forEach((s) => { mark(`[data-stream="${s.id}"]`, 'related'); mark(`.flow-tag[data-for="${s.id}"]`, 'related'); });
      mark(`.section-title[data-section="${selection.id}"]`, 'selected');
    }
  }

  /* ------------------------------------------------------------ panel */
  function rowsHTML(rows) {
    return `<dl class="kv">${rows.map(([k, v, u]) =>
      `<div><dt>${esc(k)}</dt><dd>${esc(num(v))}${u ? ` <span class="uom">${esc(u)}</span>` : ''}</dd></div>`).join('')}</dl>`;
  }
  function swatch(kind) {
    const st = D.streamStyles[kind];
    return `<svg class="swatch" viewBox="0 0 28 8" aria-hidden="true"><line x1="1" y1="4" x2="27" y2="4" stroke="${st.color}" stroke-width="${Math.max(2, st.width)}"${st.dash ? ` stroke-dasharray="${st.dash}" stroke-linecap="round"` : ''}/></svg>`;
  }
  const endpoint = (ids, label) => {
    const arr = list(ids);
    if (!arr.length) return `<span class="terminal">${esc(label || 'Boundary')}</span>`;
    return arr.map((id) => `<button class="link" data-unit="${esc(id)}">${esc(unitLabel(id))}</button>`).join(' <span class="muted">/</span> ');
  };
  const back = '<button class="back" data-overview>&larr; Overview</button>';

  function renderPanel() {
    let html;
    if (!selection) html = overviewHTML();
    else if (selection.type === 'unit') html = unitHTML(unitsById.get(selection.id));
    else if (selection.type === 'stream') html = streamHTML(streamsById.get(selection.id));
    else html = sectionHTML(sectionsById.get(selection.id));
    panel.innerHTML = html;
    if (!panel.hidden) panelWrap.scrollTop = 0;
  }

  function showTab(name) {
    const control = document.getElementById('control-view');
    const isDetails = name === 'details';
    if (panel.hidden !== isDetails) return;
    panel.hidden = !isDetails;
    control.hidden = isDetails;
    document.getElementById('tab-details').setAttribute('aria-selected', String(isDetails));
    document.getElementById('tab-control').setAttribute('aria-selected', String(!isDetails));
    panelWrap.scrollTop = 0;
  }

  function overviewHTML() {
    const sections = D.sections.map((s) => `
      <section class="block">
        <h3><button class="link strong" data-section="${s.id}">${esc(s.title.join(' '))}</button></h3>
        <p class="small">${esc(s.desc)}</p>
        <div class="chips">${D.units.filter((u) => u.section === s.id && u.label)
          .map((u) => `<button class="chip" data-unit="${u.id}">${esc(u.tag)}</button>`).join('')}</div>
      </section>`).join('');
    return `
      <header class="panel-head">
        <p class="eyebrow">Overview</p>
        <h2>${esc(D.meta.title)}</h2>
        <p class="lede">${esc(D.meta.lede)}</p>
        <p class="small muted">${esc(D.meta.basis)}</p>
      </header>
      <section class="block hints">
        <h3>Using the diagram</h3>
        <ul>
          <li>Select a unit or a stream line to see its operating data.</li>
          <li>Scroll to zoom and drag to pan. Press <kbd>0</kbd> to fit the sheet and <kbd>Esc</kbd> to clear a selection.</li>
          <li>Turn on <em>Flow rates</em> to label the main streams in kg/h.</li>
        </ul>
      </section>
      ${sections}`;
  }

  function unitHTML(u) {
    const sec = sectionOf(u);
    const ins = D.streams.filter((s) => list(s.to).includes(u.id));
    const outs = D.streams.filter((s) => list(s.from).includes(u.id));
    const streamBtns = (arr) => arr.length ? arr.map((s) => `
      <button class="stream-row" data-stream="${s.id}">${swatch(s.kind)}<span class="name">${esc(s.name)}</span>
        <span class="val">${s.data && typeof s.data.flow === 'number' ? `${esc(flowShort(s.data.flow))} kg/h` : ''}</span></button>`).join('')
      : '<p class="small muted">None drawn</p>';
    return `
      <header class="panel-head">
        ${back}
        <p class="eyebrow"><button class="link" data-section="${sec.id}">${esc(sec.title.join(' '))}</button></p>
        <h2><span class="tag">${esc(u.tag)}</span>${esc(u.name)}</h2>
        <p class="lede">${esc(u.desc)}</p>
      </header>
      ${hooks.unitLive ? hooks.unitLive(u) : ''}
      ${u.groups.map((g) => `<section class="block"><h3>${esc(g.title)}</h3>${rowsHTML(g.rows)}</section>`).join('')}
      ${(u.notes || []).map((n) => `<p class="note">${esc(n)}</p>`).join('')}
      <section class="block">
        <h3>Inlets</h3><div class="stream-list">${streamBtns(ins)}</div>
        <h3>Outlets</h3><div class="stream-list">${streamBtns(outs)}</div>
      </section>
      <p class="source">Model: <code>${esc(u.model)}</code></p>`;
  }

  function streamHTML(s) {
    const d = s.data || {};
    const st = D.streamStyles[s.kind];
    const stat = (label, v, unit) => `<div class="stat"><span class="stat-label">${label}</span><span class="stat-value">${v == null ? '<span class="muted">—</span>' : `${esc(num(v))}<span class="uom"> ${unit}</span>`}</span></div>`;
    let comp = '';
    if (d.comp) {
      const entries = Object.entries(d.comp);
      const total = entries.reduce((a, [, v]) => a + v, 0);
      comp = `<section class="block"><h3>Composition at design <span class="muted small">kg/h</span></h3><table class="comp"><tbody>
        ${entries.map(([k, v]) => {
          const pct = (100 * v) / total;
          return `<tr><th scope="row">${esc(k)}</th><td class="bar"><span style="width:${Math.max(pct, 0.6).toFixed(2)}%;background:${st.color}"></span></td>
                  <td class="num">${esc(num(v))}</td><td class="num muted">${pct < 0.1 ? '<0.1' : pct.toFixed(1)}%</td></tr>`;
        }).join('')}</tbody></table></section>`;
    }
    return `
      <header class="panel-head">
        ${back}
        <p class="eyebrow">${swatch(s.kind)} ${esc(st.label)}</p>
        <h2><span class="tag">${esc(s.id)}</span>${esc(s.name)}</h2>
        <p class="route">${endpoint(s.from, s.fromLabel)} <span class="arrow" aria-label="to">&rarr;</span> ${endpoint(s.to, s.toLabel)}</p>
      </header>
      ${hooks.streamLive ? hooks.streamLive(s) : `<div class="stats">${stat('Mass flow', d.flow, 'kg/h')}${stat('Temperature', d.T, '°C')}${stat('Pressure', d.P, 'bar')}</div>`}
      ${comp}
      ${s.note ? `<p class="note">${esc(s.note)}</p>` : ''}`;
  }

  function sectionHTML(sec) {
    return `
      <header class="panel-head">
        ${back}
        <p class="eyebrow">Process section</p>
        <h2>${esc(sec.title.join(' '))}</h2>
        <p class="lede">${esc(sec.desc)}</p>
        <p class="small muted">${esc(sec.basis)}</p>
      </header>
      <section class="block"><h3>Key figures</h3>${rowsHTML(sec.rows)}</section>
      <section class="block"><h3>Units</h3><div class="stream-list">
        ${D.units.filter((u) => u.section === sec.id).map((u) => `<button class="stream-row" data-unit="${u.id}"><span class="tag">${esc(u.tag)}</span><span class="name">${esc(u.name)}</span></button>`).join('')}
      </div></section>`;
  }

  /* ------------------------------------------------------------ tooltip */
  function tooltipHTML(target) {
    if (hooks.tooltipExtra) {
      const live = hooks.tooltipExtra(target);
      if (live) return live;
    }
    if (target.dataset.unit) {
      const u = unitsById.get(target.dataset.unit);
      const rows = u.groups.flatMap((g) => g.rows).slice(0, 3);
      return `<strong>${esc(u.tag)} · ${esc(u.name)}</strong>${rows.map(([k, v, un]) => `<span>${esc(k)}: ${esc(num(v))} ${esc(un || '')}</span>`).join('')}`;
    }
    const s = streamsById.get(target.dataset.stream);
    const d = s.data || {};
    const bits = [d.flow != null && `${flowShort(d.flow)} kg/h`, d.T != null && `${num(d.T)} °C`, d.P != null && `${num(d.P)} bar`].filter(Boolean);
    return `<strong>${esc(s.id)} · ${esc(s.name)}</strong>${bits.length ? `<span>${esc(bits.join(' · '))}</span>` : ''}`;
  }
  function moveTooltip(e) {
    const r = canvas.getBoundingClientRect();
    let x = e.clientX - r.left + 14, y = e.clientY - r.top + 14;
    const tw = tooltip.offsetWidth, th = tooltip.offsetHeight;
    if (x + tw > r.width - 8) x = e.clientX - r.left - tw - 14;
    if (y + th > r.height - 8) y = e.clientY - r.top - th - 14;
    tooltip.style.transform = `translate(${Math.max(4, x)}px, ${Math.max(4, y)}px)`;
  }

  /* ------------------------------------------------------------ view */
  function applyView() { svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`); }
  function toSheet(clientX, clientY) {
    const pt = svg.createSVGPoint();
    pt.x = clientX; pt.y = clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  }
  function zoomAt(factor, clientX, clientY) {
    const p = toSheet(clientX, clientY);
    const w = Math.min(Math.max(view.w * factor, SHEET.w / 10), SHEET.w * 1.4);
    const f = w / view.w;
    view = { x: p.x - (p.x - view.x) * f, y: p.y - (p.y - view.y) * f, w, h: view.h * f };
    applyView();
  }
  function zoomCentre(factor) {
    const r = svg.getBoundingClientRect();
    zoomAt(factor, r.left + r.width / 2, r.top + r.height / 2);
  }
  function animateTo(target) {
    if (reducedMotion) { view = target; applyView(); return; }
    const from = { ...view }, t0 = performance.now(), dur = 320;
    (function step(t) {
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      view = { x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e,
               w: from.w + (target.w - from.w) * e, h: from.h + (target.h - from.h) * e };
      applyView();
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }
  function focusOn(b) {
    const w = SHEET.w / 2.6, h = SHEET.h / 2.6;
    animateTo({ x: b.x + b.w / 2 - w / 2, y: b.y + b.h / 2 - h / 2, w, h });
  }
  const fit = () => animateTo({ ...SHEET });

  /* ------------------------------------------------------------ events */
  function bindEvents() {
    // hover
    svg.addEventListener('pointerover', (e) => {
      const t = e.target.closest('[data-unit], [data-stream]');
      if (!t || drag.active) return;
      tooltip.innerHTML = tooltipHTML(t);
      tooltip.hidden = false;
      moveTooltip(e);
    });
    svg.addEventListener('pointermove', (e) => { if (!tooltip.hidden) moveTooltip(e); });
    svg.addEventListener('pointerout', (e) => {
      const t = e.target.closest('[data-unit], [data-stream]');
      if (t && !t.contains(e.relatedTarget)) tooltip.hidden = true;
    });

    // click / keyboard select
    function activate(t) {
      if (!t) { select(null); return; }
      if (t.dataset.unit) select({ type: 'unit', id: t.dataset.unit });
      else if (t.dataset.stream) select({ type: 'stream', id: t.dataset.stream });
      else if (t.dataset.section) select({ type: 'section', id: t.dataset.section });
    }
    svg.addEventListener('click', (e) => {
      if (drag.suppressClick) return;
      activate(e.target.closest('[data-unit], [data-stream], [data-section]'));
    });
    svg.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const t = e.target.closest('[data-unit], [data-stream], [data-section]');
      if (t) { e.preventDefault(); activate(t); }
    });
    panel.addEventListener('click', (e) => {
      const t = e.target.closest('[data-unit], [data-stream], [data-section], [data-overview]');
      if (!t) return;
      if (t.hasAttribute('data-overview')) { select(null, { showDetails: true }); return; }
      if (t.dataset.unit) select({ type: 'unit', id: t.dataset.unit }, { focus: true });
      else activate(t);
    });

    // pan
    const drag = { active: false, down: false, suppressClick: false };
    svg.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      Object.assign(drag, { down: true, active: false, sx: e.clientX, sy: e.clientY, view: { ...view }, scale: svg.getScreenCTM().a, id: e.pointerId });
    });
    svg.addEventListener('pointermove', (e) => {
      if (!drag.down) return;
      const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
      if (!drag.active && Math.hypot(dx, dy) > 4) {
        drag.active = true;
        svg.setPointerCapture(drag.id);
        canvas.classList.add('is-panning');
        tooltip.hidden = true;
      }
      if (drag.active) {
        view = { ...drag.view, x: drag.view.x - dx / drag.scale, y: drag.view.y - dy / drag.scale };
        applyView();
      }
    });
    const endDrag = () => {
      if (drag.active) {
        drag.suppressClick = true;
        setTimeout(() => { drag.suppressClick = false; }, 0);
      }
      drag.down = false; drag.active = false;
      canvas.classList.remove('is-panning');
    };
    svg.addEventListener('pointerup', endDrag);
    svg.addEventListener('pointercancel', endDrag);
    svg.addEventListener('wheel', (e) => { e.preventDefault(); zoomAt(Math.exp(e.deltaY * 0.0015), e.clientX, e.clientY); }, { passive: false });

    // toolbar
    document.getElementById('zoom-in').addEventListener('click', () => zoomCentre(1 / 1.35));
    document.getElementById('zoom-out').addEventListener('click', () => zoomCentre(1.35));
    document.getElementById('zoom-fit').addEventListener('click', fit);
    bindToggle('toggle-flow', 'animate-flow', !reducedMotion);
    bindToggle('toggle-tags', 'show-tags', false);
    bindToggle('toggle-instr', 'show-instruments', true);
    document.getElementById('tab-control').addEventListener('click', () => showTab('control'));
    document.getElementById('tab-details').addEventListener('click', () => showTab('details'));

    const jump = document.getElementById('jump');
    jump.innerHTML = '<option value="">Find a unit…</option>' + D.sections.map((s) =>
      `<optgroup label="${esc(s.title.join(' '))}">${D.units.filter((u) => u.section === s.id)
        .map((u) => `<option value="${u.id}">${esc(u.tag)} · ${esc(u.name)}</option>`).join('')}</optgroup>`).join('');
    jump.addEventListener('change', () => {
      if (jump.value) select({ type: 'unit', id: jump.value }, { focus: true });
      jump.value = '';
    });

    document.addEventListener('keydown', (e) => {
      if (e.target.closest('input, select, textarea')) return;
      if (e.key === 'Escape') select(null);
      else if (e.key === '+' || e.key === '=') zoomCentre(1 / 1.35);
      else if (e.key === '-') zoomCentre(1.35);
      else if (e.key === '0') fit();
    });
  }

  function bindToggle(buttonId, bodyClass, initial) {
    const btn = document.getElementById(buttonId);
    const set = (on) => { btn.setAttribute('aria-pressed', String(on)); document.body.classList.toggle(bodyClass, on); };
    set(initial);
    btn.addEventListener('click', () => set(btn.getAttribute('aria-pressed') !== 'true'));
  }

  /* ------------------------------------------------------------ header + legend */
  function renderChrome() {
    document.getElementById('kpis').innerHTML = hooks.kpis ? hooks.kpis() : D.meta.kpis.map(([k, v, u]) =>
      `<div class="kpi"><dt>${esc(k)}</dt><dd>${esc(num(v))} <span class="uom">${esc(u)}</span></dd></div>`).join('');

    const lines = Object.keys(D.streamStyles).filter((k) => k !== 'feed')
      .map((k) => `<li>${swatch(k)}<span>${esc(D.streamStyles[k].label)}</span></li>`).join('');
    const hx = (fill, stroke) => `<svg class="swatch hx" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.5" fill="${fill}" stroke="${stroke}" stroke-width="1.3"/><polyline points="1.5,8 4.5,8 6.5,5 9.5,11 11.5,8 14.5,8" fill="none" stroke="${stroke}" stroke-width="1.2"/></svg>`;
    document.getElementById('legend').innerHTML =
      `<ul>${lines}<li>${hx('#f6a39b', '#d4483f')}<span>Heater</span></li><li>${hx('#d3e3f8', '#4d86cf')}<span>Cooler</span></li></ul>`;
  }

  /* ------------------------------------------------------------ boot */
  function index() {
    unitsById = new Map(D.units.map((u) => [u.id, u]));
    streamsById = new Map(D.streams.map((s) => [s.id, s]));
    sectionsById = new Map(D.sections.map((s) => [s.id, s]));
  }

  /* #unit/U5, #stream/S9 or #section/fdca opens that item on load */
  function selectionFromHash() {
    const m = /^#(unit|stream|section)\/(.+)$/.exec(decodeURIComponent(location.hash));
    if (!m) return null;
    const map = { unit: unitsById, stream: streamsById, section: sectionsById }[m[1]];
    return map.has(m[2]) ? { type: m[1], id: m[2] } : null;
  }

  index();
  renderChrome();
  render();
  bindEvents();
  const initial = selectionFromHash();
  select(initial, { focus: !!initial });

  window.PFD = {
    data: D,
    hooks,
    select,
    showTab,
    fit,
    svg: () => svg,
    boxOf,
    selection: () => selection,
    rerenderPanel: renderPanel,
    /* Rebuild after FLOWSHEET has been changed, e.g. by simulation results. */
    refresh() { index(); renderChrome(); render(); renderPanel(); }
  };
})();
