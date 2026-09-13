/*
 * EQUIPMENT SYMBOLS
 * Each symbol draws one unit into an SVG group, in absolute sheet
 * coordinates taken from the unit's data (x, y, w, h  or  cx, cy, r).
 * Signature: symbol(group, unit, ctx) where ctx = { el, hatch(color) }.
 */
window.PFD_SYMBOLS = (function () {
  'use strict';

  const INK = '#1f2328';
  const PAPER = '#ffffff';
  const HEATER = { fill: '#f6a39b', stroke: '#d4483f' };
  const COOLER = { fill: '#d3e3f8', stroke: '#4d86cf' };

  /* Vertical vessel with elliptical heads. k = head height. */
  function vesselPath(x, y, w, h, k) {
    const c = k - (4 * k) / 3;
    return `M${x},${y + k} C${x},${y + c} ${x + w},${y + c} ${x + w},${y + k}` +
           ` V${y + h - k} C${x + w},${y + h - c} ${x},${y + h - c} ${x},${y + h - k} Z`;
  }
  const headK = (w) => Math.min(w * 0.22, 16);

  function arrowHead(ctx, g, x1, y1, x2, y2, color, size) {
    const a = Math.atan2(y2 - y1, x2 - x1);
    const s = size || 6;
    const p = (ang) => `${x2 - s * Math.cos(a + ang)},${y2 - s * Math.sin(a + ang)}`;
    ctx.el('polygon', { points: `${x2},${y2} ${p(0.45)} ${p(-0.45)}`, fill: color }, g);
  }

  function vessel(g, u, ctx, opt) {
    const o = opt || {};
    const k = headK(u.w);
    const stroke = u.color || INK;
    const sw = u.color ? 2.3 : 1.9;
    ctx.el('path', { d: vesselPath(u.x, u.y, u.w, u.h, k), fill: PAPER, stroke, 'stroke-width': sw }, g);
    if (o.hatch) {
      ctx.el('rect', { x: u.x + 1, y: o.hatch[0], width: u.w - 2, height: o.hatch[1] - o.hatch[0],
                       fill: ctx.hatch(stroke), stroke, 'stroke-width': 1.6 }, g);
    }
    if (o.seams !== false) {
      ctx.el('line', { x1: u.x, y1: u.y + k, x2: u.x + u.w, y2: u.y + k, stroke, 'stroke-width': 1 }, g);
      ctx.el('line', { x1: u.x, y1: u.y + u.h - k, x2: u.x + u.w, y2: u.y + u.h - k, stroke, 'stroke-width': 1 }, g);
    }
    return k;
  }

  return {
    vesselPath, headK,

    vessel(g, u, ctx) { vessel(g, u, ctx); },

    packedReactor(g, u, ctx) { vessel(g, u, ctx, { hatch: u.hatch }); },

    hatchVessel(g, u, ctx) {
      vessel(g, u, ctx, { hatch: u.hatch, seams: false });
      const k = headK(u.w);
      // inner outline, as drawn on the PFD
      ctx.el('path', { d: vesselPath(u.x + 3, u.y + 3, u.w - 6, u.h - 6, k - 2), fill: 'none',
                       stroke: u.color, 'stroke-width': 0.9, opacity: 0.7 }, g);
    },

    trayColumn(g, u, ctx) {
      const k = vessel(g, u, ctx, { seams: false });
      for (let yy = u.y + k + 12; yy < u.y + u.h - k - 4; yy += 16) {
        ctx.el('line', { x1: u.x + 10, y1: yy, x2: u.x + u.w - 10, y2: yy, stroke: INK,
                         'stroke-width': 1.7, 'stroke-dasharray': '9 6' }, g);
      }
    },

    hydrolysisReactor(g, u, ctx) {
      vessel(g, u, ctx);
      const cx = u.x + u.w / 2;
      const iy = u.y + u.h * 0.46;
      ctx.el('line', { x1: cx, y1: u.y - 10, x2: cx, y2: iy, stroke: INK, 'stroke-width': 3 }, g);
      ctx.el('rect', { x: cx - 10, y: u.y - 36, width: 20, height: 26, rx: 2, fill: PAPER, stroke: INK, 'stroke-width': 1.9 }, g);
      ctx.el('line', { class: 'agitator', x1: cx - 17, y1: iy, x2: cx + 17, y2: iy, stroke: INK, 'stroke-width': 4.5, 'stroke-linecap': 'round' }, g);
    },

    hopper(g, u, ctx) {
      const cx = u.x + u.w / 2;
      ctx.el('path', {
        d: `M${u.x},${u.y} H${u.x + u.w} V${u.y + 32} L${cx + 6},${u.y + 62} V${u.y + u.h} H${cx - 6} V${u.y + 62} L${u.x},${u.y + 32} Z`,
        fill: PAPER, stroke: INK, 'stroke-width': 1.9, 'stroke-linejoin': 'round'
      }, g);
      ctx.el('line', { x1: u.x, y1: u.y + 32, x2: u.x + u.w, y2: u.y + 32, stroke: INK, 'stroke-width': 1.9 }, g);
    },

    filterBox(g, u, ctx) {
      ctx.el('rect', { x: u.x, y: u.y, width: u.w, height: u.h, fill: PAPER, stroke: INK, 'stroke-width': 1.9 }, g);
      ctx.el('line', { x1: u.x, y1: u.y + u.h, x2: u.x + u.w, y2: u.y, stroke: INK, 'stroke-width': 1.6 }, g);
    },

    heater(g, u, ctx) { this._hx(g, u, ctx, HEATER, true); },
    cooler(g, u, ctx) { this._hx(g, u, ctx, COOLER, false); },
    _hx(g, u, ctx, c, isHeater) {
      const { cx, cy, r } = u;
      ctx.el('circle', { class: 'hx-body', cx, cy, r, fill: c.fill, stroke: c.stroke, 'stroke-width': 1.6 }, g);
      ctx.el('polyline', {
        points: `${cx - r},${cy} ${cx - r * 0.5},${cy} ${cx - r * 0.2},${cy - r * 0.42} ${cx + r * 0.2},${cy + r * 0.42} ${cx + r * 0.5},${cy} ${cx + r},${cy}`,
        fill: 'none', stroke: c.stroke, 'stroke-width': 1.6, 'stroke-linejoin': 'round'
      }, g);
      const d = r * 1.25;
      const [x1, y1, x2, y2] = isHeater ? [cx + d, cy - d, cx - d, cy + d] : [cx - d, cy + d, cx + d, cy - d];
      ctx.el('line', { x1, y1, x2, y2, stroke: c.stroke, 'stroke-width': 1.3 }, g);
      arrowHead(ctx, g, x1, y1, x2, y2, c.stroke, 6);
    },

    pump(g, u, ctx) {
      const { cx, cy, r } = u;
      const left = u.outlet === 'left';
      const nx = left ? cx - r - 9 : cx;
      ctx.el('rect', { x: nx, y: cy - r, width: r + 9, height: r * 0.62, fill: u.fill, stroke: u.stroke, 'stroke-width': 1.5 }, g);
      ctx.el('polygon', {
        points: `${cx - r * 0.6},${cy + r * 0.55} ${cx + r * 0.6},${cy + r * 0.55} ${cx + r * 0.95},${cy + r + 5} ${cx - r * 0.95},${cy + r + 5}`,
        fill: u.fill, stroke: u.stroke, 'stroke-width': 1.5, 'stroke-linejoin': 'round'
      }, g);
      ctx.el('circle', { cx, cy, r, fill: u.fill, stroke: u.stroke, 'stroke-width': 1.5 }, g);
      const e = r * 0.4;
      ctx.el('circle', { class: 'rotor', cx, cy, r: e, fill: 'none', stroke: '#ffffff', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-dasharray': `${e * 4.6} ${e * 1.7}` }, g);
    },

    mixer(g, u, ctx) {
      const { x, y, w, h } = u;
      const cx = x + w / 2;
      ctx.el('path', {
        d: `M${x},${y + 12} Q${x},${y} ${x + 12},${y} H${x + w - 12} Q${x + w},${y} ${x + w},${y + 12}` +
           ` V${y + h - 24} Q${x + w},${y + h} ${cx},${y + h} Q${x},${y + h} ${x},${y + h - 24} Z`,
        fill: PAPER, stroke: INK, 'stroke-width': 2.2
      }, g);
      // baffles
      ctx.el('line', { x1: x + 6, y1: y + 18, x2: x + 6, y2: y + h - 30, stroke: INK, 'stroke-width': 1 }, g);
      ctx.el('line', { x1: x + w - 6, y1: y + 18, x2: x + w - 6, y2: y + h - 30, stroke: INK, 'stroke-width': 1 }, g);
      // motor, shaft, impeller
      ctx.el('rect', { x: cx - 5, y: y - 22, width: 10, height: 13, rx: 1.5, fill: PAPER, stroke: INK, 'stroke-width': 1.8 }, g);
      ctx.el('line', { x1: cx, y1: y - 9, x2: cx, y2: y + h - 17, stroke: INK, 'stroke-width': 2 }, g);
      const iy = y + h - 17;
      ctx.el('path', { class: 'agitator', d: `M${cx},${iy} L${cx - 14},${iy - 5} L${cx - 14},${iy + 5} Z M${cx},${iy} L${cx + 14},${iy - 5} L${cx + 14},${iy + 5} Z`,
                       fill: PAPER, stroke: INK, 'stroke-width': 1.6, 'stroke-linejoin': 'round' }, g);
    },

    jacketedReactor(g, u, ctx) {
      const { x, y, w, h } = u;
      const col = u.color;
      const inner = { x: x + 9, y, w: w - 18, h };
      const k = Math.min(inner.w * 0.2, 18);
      ctx.el('path', { d: vesselPath(inner.x, inner.y, inner.w, inner.h, k), fill: PAPER, stroke: col, 'stroke-width': 2.6 }, g);
      ctx.el('path', { d: vesselPath(inner.x + 4, inner.y + 4, inner.w - 8, inner.h - 8, k - 2), fill: 'none', stroke: col, 'stroke-width': 1, opacity: 0.75 }, g);
      ctx.el('path', { d: `M${inner.x},${y + 22} H${x} V${y + h - 22} H${inner.x} M${inner.x + inner.w},${y + 22} H${x + w} V${y + h - 22} H${inner.x + inner.w}`,
                       fill: 'none', stroke: col, 'stroke-width': 2.4 }, g);
    },

    plateHX(g, u, ctx) {
      const { x, y, w, h } = u;
      ctx.el('rect', { x, y, width: w, height: h, fill: PAPER, stroke: INK, 'stroke-width': 1.9 }, g);
      let d = '';
      for (let xx = x + 4; xx < x + w - 2; xx += 4.2) d += `M${xx},${y + 2} V${y + h - 2} `;
      ctx.el('path', { d, stroke: INK, 'stroke-width': 0.8 }, g);
      ctx.el('path', { d: `M${x},${y} L${x + w},${y + h} M${x + w},${y} L${x},${y + h}`, stroke: INK, 'stroke-width': 1.8 }, g);
    },

    valve(g, u, ctx) {
      const { x, y, w, h } = u;
      const cx = x + w / 2, cy = y + h / 2;
      ctx.el('path', { d: `M${x},${y} L${cx},${cy} L${x},${y + h} Z M${x + w},${y} L${cx},${cy} L${x + w},${y + h} Z`,
                       fill: PAPER, stroke: INK, 'stroke-width': 1.5, 'stroke-linejoin': 'round' }, g);
    },

    absorber(g, u, ctx) {
      vessel(g, u, ctx);
      const cx = u.x + u.w / 2;
      const iy = u.y + u.h * 0.64;
      ctx.el('line', { x1: cx, y1: u.y + 2, x2: cx, y2: iy, stroke: INK, 'stroke-width': 2 }, g);
      ctx.el('path', { class: 'agitator', d: `M${cx},${iy} C${cx - 16},${iy - 11} ${cx - 16},${iy + 11} ${cx},${iy} C${cx + 16},${iy - 11} ${cx + 16},${iy + 11} ${cx},${iy}`,
                       fill: 'none', stroke: INK, 'stroke-width': 2.2 }, g);
    },

    filterPress(g, u, ctx) {
      const { x, y, w, h } = u;
      ctx.el('rect', { x, y, width: w, height: h, fill: PAPER, stroke: INK, 'stroke-width': 2.4 }, g);
      const dash = { stroke: INK, 'stroke-width': 1.9 };
      ctx.el('line', Object.assign({ x1: x + 22, y1: y + 10, x2: x + 22, y2: y + h - 8, 'stroke-dasharray': '10 8' }, dash), g);
      ctx.el('line', Object.assign({ x1: x + 46, y1: y + 20, x2: x + 46, y2: y + h - 6, 'stroke-dasharray': '8 9' }, dash), g);
      ctx.el('path', Object.assign({ d: `M${x + 58},${y + 14} H${x + 70} M${x + 60},${y + 36} H${x + 72} M${x + 58},${y + 52} V${y + h - 4}` }, dash), g);
      ctx.el('path', Object.assign({ d: `M${x + w - 28},${y + 8} L${x + w - 6},${y + h / 2} L${x + w - 28},${y + h - 8}`, fill: 'none', 'stroke-dasharray': '6 5' }, dash), g);
    },

    centrifuge(g, u, ctx) {
      const { x, y, w, h } = u;
      const cx = x + w / 2;
      ctx.el('line', { x1: cx, y1: y + h - 20, x2: cx, y2: y + h + 14, stroke: INK, 'stroke-width': 1.6 }, g);
      ctx.el('rect', { x, y, width: w, height: h, fill: PAPER, stroke: INK, 'stroke-width': 1.7 }, g);
      ctx.el('rect', { class: 'basket', x: x + 6, y: y + 12, width: w - 12, height: h - 18, fill: 'none', stroke: INK, 'stroke-width': 1.5 }, g);
      ctx.el('line', { x1: x + 14, y1: y + 56, x2: x + 14, y2: y + h - 14, stroke: INK, 'stroke-width': 1.3 }, g);
      ctx.el('line', { x1: x + 14, y1: y + h - 14, x2: x + w - 14, y2: y + h - 14, stroke: INK, 'stroke-width': 1.3 }, g);
    },

    dryer(g, u, ctx) {
      const { x, y, w, h } = u;
      ctx.el('polygon', { points: `${x + 6},${y} ${x + w - 10},${y} ${x + w},${y + 16} ${x + w},${y + h} ${x},${y + h} ${x},${y + 14}`,
                          fill: PAPER, stroke: INK, 'stroke-width': 1.9, 'stroke-linejoin': 'round' }, g);
    },

    mill(g, u, ctx) {
      const { x, y, w, h } = u;
      ctx.el('polygon', { points: `${x},${y} ${x + w},${y} ${x + w - 12},${y + 22} ${x + w - 22},${y + h} ${x + 22},${y + h} ${x + 12},${y + 22}`,
                          fill: PAPER, stroke: INK, 'stroke-width': 1.9, 'stroke-linejoin': 'round' }, g);
      ctx.el('path', { d: `M${x + 12},${y + 22} L${x + 4},${y + 4} M${x + w - 12},${y + 22} L${x + w - 4},${y + 4}`, stroke: INK, 'stroke-width': 1.2 }, g);
    }
  };
})();
