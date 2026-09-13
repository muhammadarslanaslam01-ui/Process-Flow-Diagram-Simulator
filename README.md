# FDCA Plant PFD Website

Interactive process flow diagram and operator-style simulator of the dissolving pulp → fructose → HMF → FDCA plant, with solvent recovery.

Open `index.html` in a browser. There is no build step and no server is needed.

## Files

| File | What it holds |
|---|---|
| `js/flowsheet-data.js` | All units, streams, instrument tags, positions and design numbers. **Edit this file to change the diagram or its data.** |
| `js/symbols.js` | Drawing functions for each equipment type |
| `js/simulation.js` | The plant simulator: steady-state model, dynamics, alarms, trips. No page code. |
| `js/pfd.js` | Draws the diagram and handles selection, the details panel, pan/zoom |
| `js/control-room.js` | Live layer: runs the simulation loop, instrument tags, vessel levels, trends, alarms, Control room tab |
| `css/styles.css` | Styling |

## What the simulator does

- **Setpoints:** plant load (60–110 %), crystalliser outlet temperature (4–35 °C) and enzyme ultrafilter recovery (90–99 %).
- **Operations:** start and stop the plant, pause, and run at 1×, 10×, 60× or 300× speed.
- **Scenarios:** trip the P52 feed pump, lose U5 cooling (interlock I-501 trips the feed and O2 at 125 °C), restore cooling and reset trips.
- **On the drawing:** 26 live instrument tags with alarm limits, animated agitators and pumps, vessel levels, flow speed that follows the flow rate, and idle equipment greyed out.
- **Panels:** trends with hover readout, an alarm and event list with acknowledgement, and live KPIs (product, heating, cooling, electricity).

## Where the numbers come from

**From the unit models** (`Plant B process Design/`):
- Design values.
- Flows and duties at other loads, scaled linearly with conversions held at design.
- The crystalliser: U8's van't Hoff solubility fit, `ln(S/wt%) = 9.754 − 2896/T`, with the FDCA recycle through U9 → U10 → U11 (40 kg/h catalyst to U1, S16 to U5, 3 % purge) solved to convergence.
- The U5 heat-up rate after loss of cooling: 897 kW on the 36.7 m³ liquid hold-up, about 26 K/h net.

**Illustrative only (not a dynamic model):**
- Start-up and shutdown ripple and all first-order lags.
- Instrument noise.
- The 24 h heat-loss time constant of U5.
- The alarm limits.

Plant A units are at Plant A's own design basis (10 000 t/a pulp, 7510 h/a); Plant B units are at 8000 h/a.

## Extending it

- **New instrument:** add an entry to `instruments` in `flowsheet-data.js` (`src: 'stream:S9:T'`, `'unit:U5:T'` or `'kpi:product'`, position, alarm limits).
- **New steady-state relationship:** extend `steadyFlow()` / `crystalliser()` in `simulation.js`.
- **Links to one item:** `index.html#unit/U5`, `#stream/S14`, `#section/fdca`.
