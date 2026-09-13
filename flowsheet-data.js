/*
 * FLOWSHEET DATA  -  cellulose -> fructose -> HMF -> FDCA, with solvent recovery
 * ============================================================================
 * Everything the diagram draws and every number the panels show lives here.
 * The renderer (pfd.js) never hard-codes a unit or a stream.
 *
 *   units[]    equipment: drawing symbol + position, and operating data
 *   streams[]  connections: polyline points, from/to, and stream data
 *   texts[]    free labels on the drawing (terminals, group labels)
 *
 * Coordinates are in drawing units on a 1860 x 760 sheet.
 *
 * Numbers are copied from the printed output of the unit models in
 * "Plant B process Design/" (the model file is named on each unit). Plant A
 * units (hydrolysis, isomerisation, SMB) are at Plant A's own design basis
 * (10 000 t/a pulp, 7510 h/a); Plant B units are at 8000 h/a.
 *
 * For the simulation step: replace or update `groups[].rows` and
 * `streams[].data` with model results. Rows are [label, value, unit] and
 * values stay numeric wherever the model gives a number.
 */
window.FLOWSHEET = {
  meta: {
    title: 'Dissolving pulp to polymer-grade FDCA',
    subtitle: 'Interactive process flow diagram',
    lede: 'Cellulose is hydrolysed and isomerised to fructose, dehydrated to HMF in GVL/water, oxidised to FDCA over Pt/C, then crystallised and dried. The GVL solvent, the FDCA catalyst and unconverted intermediates are recovered and recycled.',
    basis: 'Plant B at 8000 h/a · Plant A at its 7510 h/a design basis',
    kpis: [
      ['FDCA product', 643.7, 'kg/h'],
      ['Annual output', 5150, 't/a'],
      ['Purity', 99.8, 'wt%'],
      ['GVL recovered', 99.5, '%'],
      ['Loop checks', '25 / 25', 'pass']
    ]
  },

  canvas: { width: 1860, height: 760 },

  sections: [
    { id: 'hyd', title: ['Hydrolysis'], x: 6, y: 6, w: 547, h: 446, tx: 292, ty: 38,
      desc: 'Enzymatic hydrolysis of dissolving pulp to glucose, with the cellulase recovered by ultrafiltration.',
      basis: 'Plant A design basis: 10 000 t/a pulp, 7510 h/a.',
      rows: [['Dry pulp feed', 1331.56, 'kg/h'], ['Cellulose conversion', 90, '%'], ['Glucose produced', 1318.24, 'kg/h'],
             ['Heating (preheat + reactor)', 155.33, 'kW'], ['Cooling (UF feed)', 169.74, 'kW'], ['Cellulase purchased', 1.58, 'kg/h']] },
    { id: 'iso', title: ['Isomerization and', 'SMB separation'], x: 553, y: 6, w: 324, h: 446, tx: 715, ty: 32,
      desc: 'Glucose is isomerised to fructose and separated by simulated moving bed chromatography. The glucose-rich raffinate is recycled.',
      basis: 'Plant A design basis: 10 000 t/a pulp, 7510 h/a.',
      rows: [['Fructose to extract', 1265.29, 'kg/h'], ['Glucose in extract', 52.95, 'kg/h'], ['Raffinate sugars recycled', 1724.79, 'kg/h'],
             ['Heating', 863.67, 'kW'], ['Cooling', 491.73, 'kW'], ['SMB pumps', 84.0, 'kW']] },
    { id: 'hmf', title: ['HMF synthesis'], x: 877, y: 6, w: 428, h: 446, tx: 1120, ty: 44,
      desc: 'Fructose is dissolved in recycled 50:50 GVL/water with FDCA as catalyst, pressurised, preheated and dehydrated to HMF.',
      basis: 'Plant B basis: 1125 kg/h fructose, 8000 h/a.',
      rows: [['Feed to reactor', 7586.9, 'kg/h'], ['Fructose conversion', 95.6, '%'], ['HMF yield', 70.3, '%'], ['HMF produced', 553.6, 'kg/h'],
             ['Heating (U1 + E2)', 1042.9, 'kW'], ['U2 jacket cooling', 72.6, 'kW']] },
    { id: 'fdca', title: ['FDCA synthesis'], x: 1305, y: 6, w: 549, h: 446, tx: 1566, ty: 44,
      desc: 'The HMF liquor is quenched, cleaned of humins on activated carbon, pressurised and oxidised to FDCA with oxygen over Pt/C.',
      basis: 'Plant B basis: 8000 h/a.',
      rows: [['Fresh HMF to oxidiser', 544.1, 'kg/h'], ['FDCA selectivity', 91, '%'], ['FDCA leaving U5', 698.0, 'kg/h'], ['Oxygen consumed', 198.67, 'kg/h'],
             ['Heat recovered in U3a', 560, 'kW'], ['U5 cooling duty', 897, 'kW']] },
    { id: 'rec', title: ['Solvent Recovery'], x: 6, y: 452, w: 1848, h: 294, tx: 1250, ty: 500,
      desc: 'FDCA is crystallised, washed, dried and packed. The mother liquor is distilled to recover GVL/water, and the concentrate is split into catalyst and intermediate recycles plus levulinic acid, part of which is hydrogenated to GVL make-up.',
      basis: 'Plant B basis: 8000 h/a.',
      rows: [['FDCA product', 643.7, 'kg/h'], ['Crystal recovery', 93.7, '%'], ['GVL recovered (U10)', 99.5, '%'], ['GVL make-up (U14)', 17.99, 'kg/h'],
             ['Surplus levulinic acid', 408, 't/a'], ['U10 reboiler', 749, 'kW']] }
  ],

  units: [
    /* ---------------------------------------------------------------- Hydrolysis */
    { id: 'E1', tag: 'E1', name: 'Slurry storage', section: 'hyd', symbol: 'vessel',
      x: 90, y: 196, w: 67, h: 125, label: { x: 124, y: 340, lines: ['E1', 'slurry', 'storage'] },
      model: '0. Plant A Upstream.py',
      desc: 'Holds the dissolving-pulp slurry, made up to 20 wt% dry solids with process water.',
      groups: [
        { title: 'Feed', rows: [['Dry pulp', 1331.56, 'kg/h'], ['Cellulose', 1318.24, 'kg/h'], ['Xylan (inert)', 11.98, 'kg/h'],
                                ['Process water', 5326.23, 'kg/h'], ['Dry solids', 20, 'wt%'], ['Temperature', 25, '°C']] },
        { title: 'Basis', rows: [['Pulp throughput', 10000, 't/a'], ['Operating year', 7510, 'h/a']] }
      ] },
    { id: 'HX1', tag: 'HX-1', name: 'Hydrolysis feed preheater', section: 'hyd', symbol: 'heater',
      cx: 210, cy: 262, r: 20, model: '0. Plant A Upstream.py',
      desc: 'Heats the slurry from ambient to the hydrolysis temperature.',
      groups: [{ title: 'Duty', rows: [['Inlet', 25, '°C'], ['Outlet', 50, '°C'], ['Flow', 6657, 'kg/h'], ['cp', 3.2, 'kJ/kg·K'], ['Duty', 147.93, 'kW']] }] },
    { id: 'ENZ', tag: 'Enzyme storage', name: 'Cellulase storage', section: 'hyd', symbol: 'hopper',
      x: 258, y: 123, w: 68, h: 87, label: { x: 250, y: 160, lines: ['Enzyme', 'storage'], anchor: 'end' },
      model: '0. Plant A Upstream.py',
      desc: 'Cellulase supply to the hydrolysis reactor. E3 recovers 97 % of the enzyme and returns it here; only the make-up is purchased.',
      groups: [{ title: 'Enzyme', rows: [['Loading', 0.04, 'kg/kg cellulose'], ['Circulating load', 52.73, 'kg/h'], ['Ultrafiltration recovery', 97, '%'], ['Net purchase', 1.58, 'kg/h']] }] },
    { id: 'E2', tag: 'E2', name: 'Hydrolysis reactor', section: 'hyd', symbol: 'hydrolysisReactor',
      x: 258, y: 246, w: 68, h: 112, label: { x: 292, y: 376, lines: ['E2-', 'Hydrolysis'] },
      model: '0. Plant A Upstream.py',
      desc: 'Agitated enzymatic hydrolysis: (C6H10O5)n + n H2O → n C6H12O6.',
      groups: [
        { title: 'Operating conditions', rows: [['Temperature', 50, '°C'], ['Cellulose conversion', 90, '%'], ['Reactor duty (isothermal)', 7.4, 'kW']] },
        { title: 'Mass balance', rows: [['Cellulose reacted', 1186.42, 'kg/h'], ['Water consumed', 131.82, 'kg/h'], ['Glucose formed', 1318.24, 'kg/h'], ['Unreacted cellulose', 131.82, 'kg/h']] },
        { title: 'Equipment', rows: [['Volume', 745, 'm³'], ['Purchased cost', 352878, 'USD']] }
      ] },
    { id: 'HX2', tag: 'HX-2', name: 'Ultrafiltration feed cooler', section: 'hyd', symbol: 'cooler',
      cx: 374, cy: 318, r: 20, model: '0. Plant A Upstream.py',
      desc: 'Cools the hydrolysate before the enzyme ultrafilter.',
      groups: [{ title: 'Duty', rows: [['Inlet', 50, '°C'], ['Outlet', 25, '°C'], ['Flow', 6657, 'kg/h'], ['cp', 3.6718, 'kJ/kg·K'], ['Duty', 169.74, 'kW']] }] },
    { id: 'E3', tag: 'E3', name: 'Enzyme recovery filter', section: 'hyd', symbol: 'filterBox',
      x: 420, y: 218, w: 35, h: 65, label: { x: 437, y: 300, lines: ['E3-', 'Enzyme', 'recovery', 'filter'] },
      model: '0. Plant A Upstream.py',
      desc: 'Ultrafiltration membrane. Retains the cellulase for recycle and passes the glucose solution forward.',
      groups: [{ title: 'Performance', rows: [['Membrane area', 310, 'm²'], ['Enzyme recovery', 97, '%'], ['Enzyme recycled', 51.15, 'kg/h'], ['Purchased cost', 207095, 'USD']] }] },
    { id: 'E4', tag: 'E4', name: 'Buffer tank', section: 'hyd', symbol: 'vessel',
      x: 480, y: 185, w: 60, h: 95, label: { x: 533, y: 298, lines: ['E4', 'buffer', 'tank'] },
      model: '0. Plant A Upstream.py',
      desc: 'Combines fresh glucose with the glucose-rich SMB raffinate returned from E6.',
      groups: [
        { title: 'Streams', rows: [['Fresh glucose in', 1318.24, 'kg/h'], ['Raffinate sugars in', 1724.79, 'kg/h'], ['Sugar to isomeriser', 3043.02, 'kg/h']] },
        { title: 'Equipment', rows: [['Volume', 1253, 'm³'], ['Purchased cost', 145539, 'USD']] }
      ] },

    /* --------------------------------------------------- Isomerization and SMB */
    { id: 'E5', tag: 'E5', name: 'Isomerization reactor', section: 'iso', symbol: 'packedReactor',
      x: 572, y: 170, w: 55, h: 145, hatch: [210, 272], label: { x: 603, y: 333, lines: ['E5-', 'Isomerization', 'Reactor'] },
      model: '0. Plant A Upstream.py',
      desc: 'Glucose ⇌ fructose isomerisation. The feed is fresh glucose plus the recycled SMB raffinate.',
      groups: [
        { title: 'Operating conditions', rows: [['Temperature', 60, '°C'], ['Conversion per pass', 42, '%'], ['Liquid flow', 14569.81, 'kg/h']] },
        { title: 'Mass balance', rows: [['Sugar feed', 3043.02, 'kg/h'], ['Fructose out', 1278.07, 'kg/h'], ['Glucose out', 1764.95, 'kg/h']] },
        { title: 'Energy', rows: [['Feed preheat 25 → 60 °C', 517.03, 'kW'], ['Reactor duty', 5.43, 'kW']] },
        { title: 'Equipment', rows: [['Volume', 1.3, 'm³'], ['Purchased cost', 16660, 'USD']] }
      ] },
    { id: 'HX3', tag: 'HX-3', name: 'SMB feed heater', section: 'iso', symbol: 'heater',
      cx: 678, cy: 240, r: 20, model: '0. Plant A Upstream.py',
      desc: 'Brings the isomerate up to the isothermal SMB temperature.',
      groups: [{ title: 'Duty', rows: [['Inlet', 60, '°C'], ['Outlet', 80, '°C'], ['Flow', 14569.81, 'kg/h'], ['cp', 3.65, 'kJ/kg·K'], ['Duty', 295.44, 'kW']] }] },
    { id: 'E6', tag: 'E6', name: 'SMB separation', section: 'iso', symbol: 'vessel',
      x: 723, y: 172, w: 55, h: 193, label: { x: 815, y: 318, lines: ['E6-SMB', 'separation'] },
      model: '0. Plant A Upstream.py',
      desc: 'Simulated moving bed chromatography. The fructose-rich extract goes to Plant B; the glucose-rich raffinate returns to the isomeriser.',
      groups: [
        { title: 'Operating conditions', rows: [['Temperature (isothermal)', 80, '°C'], ['Fructose recovery to extract', 99, '%'], ['Glucose slip to extract', 3, '%']] },
        { title: 'Streams', rows: [['Feed', 14569.81, 'kg/h'], ['Extract', 6512.69, 'kg/h'], ['Raffinate', 8057.13, 'kg/h']] },
        { title: 'Power and heat', rows: [['Feed pump', 1.931, 'kW'], ['Desorbent pump', 49.24, 'kW'], ['Extract pump', 16.413, 'kW'], ['Raffinate pump', 16.413, 'kW'], ['Heat-loss make-up', 45.77, 'kW']] },
        { title: 'Equipment', rows: [['Columns', '8 × Ø 6.6 m', ''], ['Resin inventory', 16768, 'kg'], ['Purchased cost', 493006, 'USD']] }
      ] },
    { id: 'E6X', tag: 'E6 extract split', name: 'Extract / desorbent water split', section: 'iso', symbol: 'filterBox',
      x: 731, y: 105, w: 34, h: 33, model: '0. Plant A Upstream.py',
      desc: 'Returns desorbent water to slurry make-up and sends the fructose-rich extract on to Plant B.',
      notes: ['Shown on the PFD but not modelled as a separate unit in the Plant A code.'],
      groups: [] },
    { id: 'HX4', tag: 'HX-4', name: 'SMB extract cooler', section: 'iso', symbol: 'cooler',
      cx: 810, cy: 122, r: 20, model: '0. Plant A Upstream.py',
      desc: 'Cools the fructose extract to ambient before it leaves for Plant B.',
      groups: [{ title: 'Duty', rows: [['Inlet', 80, '°C'], ['Outlet', 25, '°C'], ['Flow', 6512.69, 'kg/h'], ['cp', 3.3, 'kJ/kg·K'], ['Duty', 328.35, 'kW']] }] },
    { id: 'HX5', tag: 'HX-5', name: 'SMB raffinate cooler', section: 'iso', symbol: 'cooler',
      cx: 757, cy: 420, r: 17, model: '0. Plant A Upstream.py',
      desc: 'Cools the glucose-rich raffinate back to isomerisation temperature on its way to E4.',
      groups: [{ title: 'Duty', rows: [['Inlet', 80, '°C'], ['Outlet', 60, '°C'], ['Flow', 8057.13, 'kg/h'], ['cp', 3.65, 'kJ/kg·K'], ['Duty', 163.38, 'kW']] }] },

    /* ------------------------------------------------------------- HMF synthesis */
    { id: 'U1', tag: 'U1', name: 'Feed mixer / dissolver', section: 'hmf', symbol: 'mixer',
      x: 960, y: 205, w: 65, h: 95, label: { x: 993, y: 320, lines: ['U1- Mixer'] },
      model: '1. U1 Mixer.py',
      desc: 'Dissolves the sugar syrup in recycled 50:50 GVL/water and adds the recycled FDCA catalyst. No reaction.',
      groups: [
        { title: 'Operating conditions', rows: [['Feed temperature', 25, '°C'], ['Mixer temperature', 70, '°C'], ['Residence time', 0.5, 'h'], ['Pressure', 1.013, 'bar']] },
        { title: 'Recipe', rows: [['Fructose', 14.83, 'wt%'], ['FDCA catalyst', 0.53, 'wt%'], ['Solvent (50:50 GVL/H2O)', 6375, 'kg/h'], ['Feed to U2 (S4)', 7586.9, 'kg/h']] },
        { title: 'Energy', rows: [['Sensible heat', 288.8, 'kW'], ['Heat of solution', 19.1, 'kW'], ['Total duty', 307.9, 'kW']] },
        { title: 'Equipment', rows: [['Working volume', 3.79, 'm³'], ['Design volume', 4.92, 'm³'], ['Diameter × length', '1.61 × 2.42', 'm'], ['Agitator', 3.7, 'kW'], ['Material', '316L', '']] }
      ] },
    { id: 'P2', tag: 'P2', name: 'Reactor feed pump', section: 'hmf', symbol: 'pump',
      cx: 1078, cy: 287, r: 18, outlet: 'right', fill: '#5b95ee', stroke: '#2f6fd6',
      label: { x: 1077, y: 332, lines: ['P2-', 'PUMP'] }, model: '2. P2 Pump.py',
      desc: 'Multistage centrifugal pump. It sits ahead of E2 so the preheater stays liquid-full: the bubble point at 180 °C is 9.74 bar.',
      groups: [
        { title: 'Hydraulics', rows: [['Mass flow', 7586.9, 'kg/h'], ['Volumetric flow', 7.65, 'm³/h'], ['Suction pressure', 1.013, 'bar'], ['Discharge pressure', 17.32, 'bar'], ['Head', 168, 'm'], ['NPSH available', 8.9, 'm']] },
        { title: 'Power', rows: [['Hydraulic', 3.46, 'kW'], ['Shaft', 5.77, 'kW'], ['Electrical', 6.28, 'kW'], ['Motor rating', 7.5, 'kW'], ['Outlet temperature', 70.89, '°C']] }
      ] },
    { id: 'E2H', tag: 'E2', name: 'Reactor feed preheater', section: 'hmf', symbol: 'heater',
      cx: 1147, cy: 274, r: 20, label: { x: 1147, y: 313, lines: ['E2-', 'Heater'] }, model: '3. E2 Preheater.py',
      desc: 'Shell-and-tube preheater on 40 bar saturated steam. Heats the pressurised feed to the U2 reaction temperature.',
      groups: [
        { title: 'Duty', rows: [['Inlet', 70.89, '°C'], ['Outlet', 180, '°C'], ['Outlet pressure', 16.82, 'bar'], ['Mean cp', 3.197, 'kJ/kg·K'], ['Duty', 735, 'kW']] },
        { title: 'Exchanger', rows: [['Steam', '40 bar, 250.4 °C', ''], ['Steam consumption', 1544, 'kg/h'], ['U', 1000, 'W/m²·K'], ['LMTD', 116.6, 'K'], ['Area', 6.3, 'm²'], ['Margin over bubble point', 7.08, 'bar']] }
      ] },
    { id: 'U2', tag: 'U2', name: 'HMF synthesis reactor', section: 'hmf', symbol: 'jacketedReactor',
      x: 1180, y: 155, w: 113, h: 170, color: '#a4561e', label: { x: 1236, y: 237, lines: ['U2-HMF', 'synthesis'] },
      model: '4. U2 Reactor.py',
      desc: 'Liquid-full, baffled up-flow column. Fructose is dehydrated to HMF in GVL/water with FDCA as catalyst.',
      groups: [
        { title: 'Operating conditions', rows: [['Temperature', 180, '°C'], ['Pressure', 15, 'bar'], ['Residence time', 70, 'min'], ['Bubble point at 180 °C', 9.74, 'bar']] },
        { title: 'Performance', rows: [['Fructose conversion', 95.6, '%'], ['HMF yield', 70.3, '%'], ['HMF', 553.6, 'kg/h'], ['Humins', 139.1, 'kg/h'], ['Levulinic + formic acid', '63.1 + 25.0', 'kg/h'], ['Water formed', 317.1, 'kg/h']] },
        { title: 'Energy', rows: [['Exotherm', 72.6, 'kW'], ['Adiabatic rise', 10.3, 'K'], ['Jacket coolant', 'tempered water 165 → 175 °C', ''], ['Coolant flow', 5984, 'kg/h'], ['Jacket area used', '19.9 of 34.0', 'm²']] },
        { title: 'Equipment', rows: [['Volume', 9.9, 'm³'], ['Diameter × height', '1.16 × 9.31', 'm'], ['Baffle compartments', 15, ''], ['Wall thickness', 11, 'mm']] }
      ] },

    /* ------------------------------------------------------------ FDCA synthesis */
    { id: 'U3a', tag: 'U3a', name: 'Quench, feed/effluent exchanger', section: 'fdca', symbol: 'plateHX',
      x: 1327, y: 180, w: 48, h: 67, label: { x: 1351, y: 263, lines: ['a'] }, model: '5. U3 Quench.py',
      desc: 'Welded-plate exchanger. Cools the U2 effluent with the cold U5 feed, recovering heat that would otherwise go to cooling water.',
      groups: [
        { title: 'Hot side (S5)', rows: [['Inlet', 180, '°C'], ['Outlet', 99.08, '°C'], ['Pressure', 15, 'bar'], ['Flow', 7586.9, 'kg/h']] },
        { title: 'Cold side (U5 feed)', rows: [['Inlet', 30, '°C'], ['Outlet', 110, '°C'], ['Pressure in → out', '42.39 → 41.69', 'bar'], ['Flow', 8039.3, 'kg/h']] },
        { title: 'Exchanger', rows: [['Heat recovered', 560, 'kW'], ['U', 3000, 'W/m²·K'], ['LMTD', 69.5, 'K'], ['Area', 2.7, 'm²'], ['Area with fouling allowance', 3.4, 'm²']] }
      ] },
    { id: 'U3b', tag: 'U3b', name: 'Quench, cooling-water trim', section: 'fdca', symbol: 'plateHX',
      x: 1398, y: 238, w: 50, h: 67, label: { x: 1423, y: 322, lines: ['b'] }, model: '5. U3 Quench.py',
      desc: 'Welded-plate trim cooler on site cooling water. Finishes the quench to the adsorber temperature.',
      groups: [
        { title: 'Hot side', rows: [['Inlet', 99.08, '°C'], ['Outlet', 30, '°C'], ['Pressure', 15, 'bar']] },
        { title: 'Exchanger', rows: [['Duty', 455, 'kW'], ['Cooling water', 39.2, 'm³/h'], ['Cooling water ΔT', '25 → 35', '°C'], ['LMTD', 23.2, 'K'], ['Area', 6.5, 'm²']] }
      ] },
    { id: 'P52', tag: 'P52', name: 'Oxidation reactor feed pump', section: 'fdca', symbol: 'pump',
      cx: 1412, cy: 197, r: 15, outlet: 'left', fill: '#7fcad3', stroke: '#3a9aa8',
      label: { x: 1410, y: 158, lines: ['P52-', 'Pump'] }, model: '7. P52 Feed Pump.py',
      desc: 'Takes the conditioned liquor from U4 together with the recycles and raises it to oxidation pressure. It pumps cold, through U3a, into U5.',
      groups: [
        { title: 'Hydraulics', rows: [['Mass flow', 8039.34, 'kg/h'], ['Volumetric flow', 7.81, 'm³/h'], ['Temperature', 30, '°C'], ['Suction pressure', 1.013, 'bar'], ['Discharge pressure', 42.39, 'bar'], ['Head', 410, 'm'], ['NPSH available', 11.1, 'm']] },
        { title: 'Power', rows: [['Hydraulic', 8.98, 'kW'], ['Shaft', 13.81, 'kW'], ['Electrical', 15.01, 'kW'], ['Motor rating', 18.5, 'kW']] }
      ] },
    { id: 'LV1', tag: 'LV', name: 'Adsorber let-down valve', section: 'fdca', symbol: 'valve',
      x: 1462, y: 254, w: 20, h: 16, model: '5. U3 Quench.py',
      desc: 'Let-down after the quench. The liquid is already at 30 °C, so nothing flashes.',
      groups: [{ title: 'Conditions', rows: [['Inlet pressure', 15, 'bar'], ['Outlet pressure', 1, 'bar'], ['Temperature', 30, '°C']] }] },
    { id: 'U4', tag: 'U4', name: 'Humin adsorber', section: 'fdca', symbol: 'absorber',
      x: 1494, y: 172, w: 62, h: 128, label: { x: 1525, y: 316, lines: ['U4-', 'Absorber'] },
      model: '6. U4 Adsorber.py',
      desc: 'Fixed beds of granular activated carbon in lead-lag rotation. Removes humins before oxidation; spent carbon is reactivated off site.',
      groups: [
        { title: 'Operating conditions', rows: [['Temperature', 30, '°C'], ['Liquor flow', 7.38, 'm³/h'], ['Humins in', 139.1, 'kg/h'], ['Humins removed', 132.1, 'kg/h'], ['Removal', 95, '%']] },
        { title: 'Beds', rows: [['Vessels', '3 (2 in series + 1 offline)', ''], ['Diameter × bed length', '2.00 × 6.44', 'm'], ['Carbon per vessel', 10925, 'kg'], ['Service life', 24, 'h'], ['EBCT per bed', 165, 'min'], ['Pressure drop (2 beds)', 0.169, 'bar']] },
        { title: 'Carbon', rows: [['Virgin make-up', 97.2, 'kg/h'], ['Reactivated return', 485.8, 'kg/h'], ['Reactivations per charge', 5, '']] }
      ] },
    { id: 'U5', tag: 'U5', name: 'FDCA synthesis reactor', section: 'fdca', symbol: 'hatchVessel',
      x: 1648, y: 150, w: 107, h: 205, hatch: [208, 295], color: '#9a6cc0',
      label: { x: 1701, y: 318, lines: ['U5-FDCA', 'synthesis'] }, model: '9. U5 Reactor.py',
      desc: 'Multitubular up-flow flooded packed bed. HMF is oxidised to FDCA with oxygen over 4.83 % Pt/C, without added base.',
      groups: [
        { title: 'Operating conditions', rows: [['Temperature', 110, '°C'], ['Pressure (O2)', 40, 'bar'], ['Residence time', 4.3, 'h'], ['Oxygen fed', 198.67, 'kg/h']] },
        { title: 'Performance', rows: [['Fresh HMF', 544.1, 'kg/h'], ['To FDCA', 91, '%'], ['To FFCA', 5, '%'], ['Degradation', 4, '%'], ['FDCA out', 698.0, 'kg/h'], ['FDCA in effluent', '8.43 (sat. 9.00)', 'wt%']] },
        { title: 'Energy', rows: [['Reaction heat', -903, 'kW'], ['Cooling duty', 897, 'kW'], ['Adiabatic rise if uncooled', 121, 'K'], ['Recoverable to U10 preheat', 658, 'kW']] },
        { title: 'Equipment', rows: [['Bed volume', 36.7, 'm³'], ['Tubes', '2823 × DN50 × 6 m', ''], ['Shell diameter', 3.66, 'm'], ['Wall area', 2794, 'm²'], ['Catalyst', 14664, 'kg'], ['Platinum', 708, 'kg'], ['Centreline hot spot', 4.2, 'K']] }
      ] },

    /* ---------------------------------------------------------- Solvent recovery */
    { id: 'U6', tag: 'U6', name: 'Let-down / de-gas KO drum', section: 'rec', symbol: 'vessel',
      x: 1650, y: 548, w: 88, h: 135, label: { x: 1694, y: 632, lines: ['U6-KO', 'Drum'] },
      model: '10. U6 Knockout Pot.py',
      desc: 'Lets the oxidiser effluent down from 40 to 6 bar and vents trace argon. The liquor stays sub-cooled and hot, so FDCA remains dissolved.',
      groups: [
        { title: 'Operating conditions', rows: [['Temperature', 110, '°C'], ['Pressure', '40 → 6', 'bar'], ['Liquor bubble point', 1.21, 'bar'], ['Duty', 0, 'kW']] },
        { title: 'Streams', rows: [['Liquid to U7', 8283.2, 'kg/h'], ['Argon vent', 1.24, 'kg/h']] },
        { title: 'Equipment', rows: [['Diameter × length', '0.85 × 2.54', 'm'], ['Liquid holdup', 5, 'min']] }
      ] },
    { id: 'U7', tag: 'U7', name: 'Hot polish filter', section: 'rec', symbol: 'filterPress',
      x: 1505, y: 597, w: 115, h: 65, label: { x: 1562, y: 681, lines: ['U7-', 'Filter'] },
      model: '11. U7 Filter.py',
      desc: 'Steam-traced candle/leaf pressure filter. It clarifies the liquor while hot, so no FDCA crystallises onto the cake.',
      groups: [
        { title: 'Operating conditions', rows: [['Temperature', 110, '°C'], ['Pressure', 6, 'bar'], ['FDCA saturation', 94, '%']] },
        { title: 'Streams', rows: [['Humins removed', 7.0, 'kg/h'], ['Clarified liquor (S12)', 8276.2, 'kg/h']] },
        { title: 'Equipment', rows: [['Filter area', 17.1, 'm²'], ['Design flux', 500, 'L/m²·h']] }
      ] },
    { id: 'LV2', tag: 'Valve', name: 'Crystalliser inlet let-down', section: 'rec', symbol: 'valve',
      x: 1450, y: 620, w: 20, h: 16, label: { x: 1460, y: 655, lines: ['Valve'], size: 10.5 },
      model: '10. U6 Knockout Pot.py',
      desc: 'Final let-down into the crystalliser. The inlet stays above the liquor bubble point, so there is no flash.',
      groups: [{ title: 'Conditions', rows: [['Inlet pressure', 6, 'bar'], ['Outlet pressure', 1.5, 'bar'], ['Temperature', 110, '°C']] }] },
    { id: 'U8a', tag: 'U8a', name: 'Crystalliser stage 1 (cooling water)', section: 'rec', symbol: 'vessel',
      x: 1350, y: 550, w: 68, h: 130, model: '12. U8 Crystalliser.py',
      desc: 'Draft-tube-baffle cooling crystalliser with an external shell-and-tube cooler (E-8a) on cooling water.',
      groups: [
        { title: 'Operating conditions', rows: [['Temperature', '110 → 35', '°C'], ['Pressure', 1.5, 'bar'], ['Duty', 557, 'kW'], ['Sensible + crystallisation', '531 + 25', 'kW']] },
        { title: 'Cooler E-8a', rows: [['Cooling water', 47.9, 'm³/h'], ['Water ΔT', '25 → 35', '°C'], ['U', 400, 'W/m²·K'], ['LMTD', 32.3, 'K'], ['Area', 43.1, 'm²']] },
        { title: 'Vessel', rows: [['Diameter × length', '2.06 × 3.09', 'm']] }
      ] },
    { id: 'U8b', tag: 'U8b', name: 'Crystalliser stage 2 (chilled water)', section: 'rec', symbol: 'vessel',
      x: 1238, y: 548, w: 68, h: 132, model: '12. U8 Crystalliser.py',
      desc: 'Second stage on chilled water. At 8 °C, 93.7 % of the FDCA crystallises; the dissolved remainder feeds the catalyst recycle.',
      groups: [
        { title: 'Operating conditions', rows: [['Temperature', '35 → 8', '°C'], ['Duty', 190, 'kW'], ['FDCA solubility at 8 °C', 0.58, 'wt%'], ['Residence time (both stages)', 2.0, 'h']] },
        { title: 'Performance', rows: [['FDCA recovered', 93.7, '%'], ['Crystals', 653.8, 'kg/h'], ['FDCA left in mother liquor', 44.2, 'kg/h']] },
        { title: 'Cooler E-8b', rows: [['Chilled water', 27.3, 'm³/h'], ['Water ΔT', '2 → 8', '°C'], ['U', 300, 'W/m²·K'], ['LMTD', 14.0, 'K'], ['Area', 45.3, 'm²'], ['Refrigeration power (COP 3.5)', 54, 'kW']] }
      ] },
    { id: 'U9', tag: 'U9', name: 'Centrifuge + cake wash', section: 'rec', symbol: 'centrifuge',
      x: 1120, y: 548, w: 73, h: 122, label: { x: 1157, y: 590, lines: ['U9-', 'centrifuge'], size: 9.5 },
      model: '13. U9 Centrifuge.py',
      desc: 'Pusher/peeler centrifuge with a counter-current cold-solvent wash. The mother liquor becomes the main recycle stream.',
      groups: [
        { title: 'Operating conditions', rows: [['Temperature', 8, '°C'], ['Slurry feed', 8276.2, 'kg/h'], ['Feed solids', 7.8, 'wt%']] },
        { title: 'Streams', rows: [['Washed cake (S13)', 708.4, 'kg/h'], ['Cake dry solids', 91, '%'], ['FDCA in cake', 644.0, 'kg/h'], ['Mother liquor (S14)', 7567.8, 'kg/h']] },
        { title: 'Wash', rows: [['Cold wash solvent', 966, 'kg/h'], ['Wash ratio', 1.5, 'kg/kg cake'], ['Wash chilling', 13.7, 'kW'], ['Crystals re-dissolved', 1.5, '%']] },
        { title: 'Equipment', rows: [['Basket area', 0.64, 'm²']] }
      ] },
    { id: 'U12', tag: 'U12', name: 'Cold-water wash + vacuum dryer', section: 'rec', symbol: 'dryer',
      x: 1015, y: 560, w: 60, h: 102, label: { x: 1045, y: 606, lines: ['U12-', 'Dryer'] },
      model: '16. U12 Dryer.py',
      desc: 'A cold-water wash displaces the GVL from the cake, which FDCA\'s very low water solubility allows. The cake is then vacuum-dried under N2.',
      groups: [
        { title: 'Wash', rows: [['Wash water', 322, 'kg/h'], ['Wash temperature', 25, '°C'], ['GVL displaced', 30.2, 'kg/h'], ['FDCA lost', 0.3, 'kg/h']] },
        { title: 'Drying', rows: [['Temperature', 120, '°C'], ['Pressure (N2)', 0.1, 'bar'], ['Water evaporated', 50.2, 'kg/h'], ['Final moisture', 0.2, 'wt%'], ['Residual GVL', 9, 'ppm']] },
        { title: 'Energy', rows: [['Sensible heat', 77, 'kW'], ['Evaporation', 31, 'kW'], ['Total', 108, 'kW']] }
      ] },
    { id: 'U13', tag: 'U13', name: 'Mill and packing', section: 'rec', symbol: 'mill',
      x: 903, y: 578, w: 92, h: 65, label: { x: 949, y: 597, lines: ['U13-', 'Mill and', 'packing'], size: 10 },
      model: '17. U13 Milling.py',
      desc: 'Mills the dried FDCA to a consistent particle size and bags it under nitrogen.',
      groups: [
        { title: 'Product', rows: [['Polymer-grade FDCA', 643.7, 'kg/h'], ['Annual output', 5150, 't/a'], ['Purity', 99.8, 'wt%'], ['Water', 1.29, 'kg/h'], ['GVL', 9, 'ppm']] },
        { title: 'Energy', rows: [['Milling power', 9.7, 'kW'], ['Specific energy', 15, 'kWh/t']] }
      ] },
    { id: 'U10', tag: 'U10', name: 'GVL still (mother-liquor distillation)', section: 'rec', symbol: 'trayColumn',
      x: 737, y: 548, w: 82, h: 158, label: { x: 778, y: 725, lines: ['U10 - GVL STILL'] },
      model: '14. U10 GVL Still.py',
      desc: 'Vacuum packed column with a liquid side draw. It returns GVL and water together as solvent, rejects only the net water make overhead, and sends the FDCA/FFCA/LA concentrate to U11.',
      groups: [
        { title: 'Operating conditions', rows: [['Top pressure', 0.1915, 'bar'], ['Bottom pressure', 0.2, 'bar'], ['Top temperature', 59.0, '°C'], ['Side-draw temperature', 60.9, '°C'], ['Bottom temperature', 145.9, '°C']] },
        { title: 'Design', rows: [['Reflux ratio', 0.46, ''], ['Minimum reflux', 0.398, ''], ['Theoretical stages', 18, ''], ['Diameter × height', '1.18 × 10.4', 'm'], ['Vapour traffic', 56.5, 'kmol/h']] },
        { title: 'Energy', rows: [['Feed preheat', 354, 'kW'], ['Reboiler (HP steam)', 749, 'kW'], ['Condenser', 675, 'kW'], ['S15 return cooler', 197, 'kW']] },
        { title: 'Balance', rows: [['Feed', 7953.2, 'kg/h'], ['Recovered solvent (S15)', 6983.3, 'kg/h'], ['Concentrate to U11', 230.6, 'kg/h'], ['Water purge to WWT', 739.3, 'kg/h'], ['GVL recovery', 99.5, '%']] }
      ] },
    { id: 'U11', tag: 'U11', name: 'Recycle split (LA/GVL vacuum stripper)', section: 'rec', symbol: 'trayColumn',
      x: 585, y: 550, w: 88, h: 157, label: { x: 629, y: 738, lines: ['U11 - Recycle Split'] },
      model: '15. U11 Recycle Split.py',
      desc: 'A small reboiled stripper takes LA and GVL overhead to U14. The remaining FDCA/FFCA is metered back as the U1 catalyst charge and the U5 recycle, with a 3 % purge.',
      groups: [
        { title: 'Operating conditions', rows: [['Pressure', 0.08, 'bar'], ['Feed temperature', 145.7, '°C'], ['Bottoms temperature', 155.9, '°C']] },
        { title: 'Split', rows: [['LA + GVL to U14', 69.1, 'kg/h'], ['FDCA catalyst to U1', 40.0, 'kg/h'], ['FFCA via U1', 24.6, 'kg/h'], ['S16 to U5 (FFCA + FDCA)', '7.8 + 12.7', 'kg/h'], ['Purge to WWT', 6.9, 'kg/h']] },
        { title: 'Design', rows: [['Theoretical stages', 2, ''], ['Diameter × height', '0.30 × 1.9', 'm'], ['Reboiler (HP steam)', 9.4, 'kW'], ['Condenser', 8.9, 'kW']] }
      ],
      notes: ['A flat 3 % purge is too small to remove the DEG/FRU make at steady state. The model treats these species as a single pass, so the column size is a lower bound.'] },
    { id: 'U14', tag: 'U14', name: 'Levulinic acid to GVL', section: 'rec', symbol: 'hatchVessel',
      x: 440, y: 577, w: 75, h: 108, hatch: [600, 660], color: '#c8463d',
      label: { x: 477, y: 704, lines: ['U14-LA 2 GVL'] }, model: '18. U14 LA 2 GVL.py',
      desc: 'Fixed-bed RuSn4/C hydrogenation of a small LA slipstream. It makes up the GVL lost from the solvent loop; the rest of the LA is sold.',
      groups: [
        { title: 'Operating conditions', rows: [['Temperature', 150, '°C'], ['Pressure (H2)', 30, 'bar'], ['LHSV', 2.0, '1/h'], ['LA conversion', 98, '%']] },
        { title: 'Balance', rows: [['Slipstream', 2.45, '% of S_LA'], ['GVL hydrogenated', 1.079, 'kg/h'], ['GVL make-up total', 17.99, 'kg/h'], ['Hydrogen fed', 0.0282, 'kg/h'], ['Surplus LA', 50.95, 'kg/h']] },
        { title: 'Energy', rows: [['Exotherm', 0.19, 'kW'], ['Adiabatic rise (slipstream)', 159, 'K']] },
        { title: 'Equipment', rows: [['Diameter × length', '0.15 × 0.45', 'm'], ['Catalyst (fully packed)', 4.8, 'kg']] }
      ],
      notes: ['The slipstream would rise 159 K if run adiabatically, so the reactor needs a cooling jacket for temperature control.'] }
  ],

  texts: [
    { x: 229, y: 76, text: 'Water', cls: 'term' },
    { x: 62, y: 243, text: 'water', cls: 'term' },
    { x: 58, y: 282, text: 'cellulose', cls: 'term' },
    { x: 903, y: 208, text: 'Fructose', cls: 'term' },
    { x: 1343, y: 281, text: 'U3-', cls: 'unit-label' },
    { x: 1343, y: 296, text: 'Quench', cls: 'unit-label' },
    { x: 1290, y: 703, text: 'U8-', cls: 'unit-label' },
    { x: 1290, y: 717, text: 'Crystallizers', cls: 'unit-label' },
    { x: 1626, y: 254, text: 'O2', cls: 'term' },
    { x: 856, y: 602, text: 'FDCA', cls: 'product' },
    { x: 856, y: 620, text: 'Product', cls: 'product' },
    { x: 718, y: 545, text: 'WWT', cls: 'term' },
    { x: 566, y: 726, text: 'WWT', cls: 'term' },
    { x: 546, y: 700, text: 'LA', cls: 'term' },
    { x: 544, y: 652, text: 'H2', cls: 'term', anchor: 'start' },
    { x: 394, y: 612, text: 'GVL', cls: 'term', anchor: 'end' }
  ],

  /*
   * INSTRUMENTS  -  live tags drawn on the sheet by control-room.js.
   * src:  stream:<id>:flow|T|P   unit:<id>:T|level   kpi:<name>
   * Alarm limits hi/hihi/lo/lolo are evaluated while the plant is running;
   * `always` tags (safety) are evaluated in every state.
   */
  instruments: [
    { id: 'FI-101',  label: 'Pulp feed',               unit: 'E1',   src: 'stream:A2:flow',   uom: 'kg/h', digits: 0, x: 48,   y: 172, lo: 700 },
    { id: 'LI-101',  label: 'E1 level',                unit: 'E1',   src: 'unit:E1:level',    uom: '%',    digits: 0, x: 124,  y: 404, hi: 80, lo: 20 },
    { id: 'TI-102',  label: 'Hydrolysis temperature',  unit: 'E2',   src: 'stream:A5:T',      uom: '°C',   digits: 1, x: 292,  y: 414, hi: 55, lo: 45 },
    { id: 'LI-104',  label: 'E4 level',                unit: 'E4',   src: 'unit:E4:level',    uom: '%',    digits: 0, x: 510,  y: 150, hi: 80, lo: 20 },
    { id: 'TI-301',  label: 'Isomeriser temperature',  unit: 'E5',   src: 'stream:A10:T',     uom: '°C',   digits: 1, x: 650,  y: 388, hi: 65, lo: 55 },
    { id: 'TI-302',  label: 'SMB temperature',         unit: 'E6',   src: 'stream:A11:T',     uom: '°C',   digits: 1, x: 815,  y: 368, hi: 85, lo: 75 },
    { id: 'FI-303',  label: 'Fructose syrup to U1',    unit: 'HX4',  src: 'stream:S1:flow',   uom: 'kg/h', digits: 0, x: 805,  y: 178, lo: 600 },
    { id: 'TI-201',  label: 'Mixer temperature',       unit: 'U1',   src: 'stream:S4:T',      uom: '°C',   digits: 1, x: 990,  y: 372, hi: 75, lo: 65 },
    { id: 'PI-202',  label: 'P2 discharge pressure',   unit: 'P2',   src: 'stream:S4P:P',     uom: 'bar',  digits: 2, x: 1078, y: 398, hi: 18.5, lo: 15 },
    { id: 'TI-203',  label: 'Preheater outlet',        unit: 'E2H',  src: 'stream:S4H:T',     uom: '°C',   digits: 1, x: 1150, y: 366, hi: 185, lo: 175 },
    { id: 'TI-210',  label: 'U2 temperature',          unit: 'U2',   src: 'unit:U2:T',        uom: '°C',   digits: 1, x: 1236, y: 352, hi: 185, lo: 175 },
    { id: 'PI-211',  label: 'U2 pressure',             unit: 'U2',   src: 'stream:S5:P',      uom: 'bar',  digits: 2, x: 1236, y: 382, hi: 16, lo: 12, lolo: 11 },
    { id: 'TI-401',  label: 'Quench outlet',           unit: 'U3b',  src: 'stream:S5C:T',     uom: '°C',   digits: 1, x: 1423, y: 380, hi: 40 },
    { id: 'FI-402',  label: 'P52 discharge flow',      unit: 'P52',  src: 'stream:U5F1:flow', uom: 'kg/h', digits: 0, x: 1360, y: 80,  lo: 4000 },
    { id: 'FI-503',  label: 'Oxygen feed',             unit: 'U5',   src: 'stream:O2:flow',   uom: 'kg/h', digits: 1, x: 1619, y: 226, lo: 100 },
    { id: 'TI-501',  label: 'U5 temperature',          unit: 'U5',   src: 'unit:U5:T',        uom: '°C',   digits: 1, x: 1700, y: 386, hi: 115, hihi: 125, lo: 100, always: true },
    { id: 'PI-502',  label: 'U5 pressure',             unit: 'U5',   src: 'stream:S9:P',      uom: 'bar',  digits: 1, x: 1700, y: 416, hi: 42, lo: 36 },
    { id: 'PI-601',  label: 'U6 pressure',             unit: 'U6',   src: 'stream:S9L:P',     uom: 'bar',  digits: 2, x: 1694, y: 526, hi: 7, lo: 4 },
    { id: 'LI-602',  label: 'U6 level',                unit: 'U6',   src: 'unit:U6:level',    uom: '%',    digits: 0, x: 1694, y: 714, hi: 80, lo: 20 },
    { id: 'LI-802',  label: 'U8a level',               unit: 'U8a',  src: 'unit:U8a:level',   uom: '%',    digits: 0, x: 1384, y: 526, hi: 80, lo: 20 },
    { id: 'TI-801',  label: 'Crystalliser outlet',     unit: 'U8b',  src: 'unit:U8b:T',       uom: '°C',   digits: 1, x: 1272, y: 524, hi: 12, lo: 3 },
    { id: 'FI-901',  label: 'Mother liquor to U10',    unit: 'U9',   src: 'stream:S14:flow',  uom: 'kg/h', digits: 0, x: 1060, y: 724, lo: 4000 },
    { id: 'TI-1001', label: 'U10 bottoms temperature', unit: 'U10',  src: 'stream:SCONC:T',   uom: '°C',   digits: 1, x: 860,  y: 550, hi: 150, lo: 140 },
    { id: 'PI-1002', label: 'U10 top pressure',        unit: 'U10',  src: 'stream:PURGE:P',   uom: 'bar',  digits: 3, x: 705,  y: 612, hi: 0.25 },
    { id: 'FI-1301', label: 'FDCA product',            unit: 'U13',  src: 'kpi:product',      uom: 'kg/h', digits: 1, x: 855,  y: 654, lo: 330 },
    { id: 'TI-1401', label: 'U14 temperature',         unit: 'U14',  src: 'unit:U14:T',       uom: '°C',   digits: 1, x: 477,  y: 540, hi: 160, lo: 140 }
  ],

  junctions: [
    { x: 790, y: 507, kind: 'solvent' },
    { x: 930, y: 230, kind: 'solvent' },
    { x: 942, y: 242, kind: 'recycle' },
    { x: 1440, y: 140, kind: 'process' },
    { x: 546, y: 663, kind: 'process' }
  ],

  streamStyles: {
    process:  { label: 'Process stream',           color: '#1f2328', width: 1.6 },
    feed:     { label: 'Raw material feed',        color: '#1f2328', width: 1.3 },
    fructose: { label: 'Fructose to Plant B',      color: '#d99a0b', width: 2.2 },
    water:    { label: 'Water recycle',            color: '#3f7fd6', width: 2.4, dash: '0.1 5' },
    solvent:  { label: 'GVL / water solvent loop', color: '#d6433a', width: 2.2, dash: '0.1 4.5' },
    recycle:  { label: 'Sugar / FDCA recycle',     color: '#1f2328', width: 2.2, dash: '0.1 4.5' },
    oxygen:   { label: 'Oxygen',                   color: '#e03a84', width: 2 },
    utility:  { label: 'Cooling / chilled water',  color: '#2b9aa0', width: 1.5 },
    product:  { label: 'FDCA product',             color: '#a3195b', width: 2.2 }
  },

  streams: [
    /* ---------------------------------------------------------------- Plant A */
    { id: 'A1', name: 'Process water', kind: 'feed', to: 'E1', fromLabel: 'Water supply',
      points: [[38, 228], [90, 228]], tag: false, data: { flow: 5326.23, T: 25 } },
    { id: 'A2', name: 'Dissolving pulp', kind: 'feed', to: 'E1', fromLabel: 'Pulp supply',
      points: [[38, 265], [90, 265]], tag: false,
      data: { flow: 1331.56, T: 25, comp: { Cellulose: 1318.24, Xylan: 11.98, Other: 1.33 } } },
    { id: 'A3', name: 'Pulp slurry', kind: 'process', from: 'E1', to: 'HX1',
      points: [[157, 262], [190, 262]], tag: false, data: { flow: 6657, T: 25 } },
    { id: 'A4', name: 'Heated slurry', kind: 'process', from: 'HX1', to: 'E2',
      points: [[230, 262], [258, 262]], tag: false, data: { flow: 6657, T: 50 } },
    { id: 'A5', name: 'Hydrolysate', kind: 'process', from: 'E2', to: 'HX2',
      points: [[326, 318], [354, 318]], tag: false,
      data: { flow: 6657, T: 50, comp: { Glucose: 1318.24, 'Unreacted cellulose': 131.82, Cellulase: 52.73, Water: 5194.41 } },
      note: 'Total flow from the Plant A energy balance; components from its mass balance.' },
    { id: 'A6', name: 'Cooled hydrolysate', kind: 'process', from: 'HX2', to: 'E3',
      points: [[394, 318], [408, 318], [408, 237], [420, 237]], data: { flow: 6657, T: 25 } },
    { id: 'A7', name: 'Glucose solution', kind: 'process', from: 'E3', to: 'E4',
      points: [[455, 270], [480, 270]], tag: false, data: { T: 25, comp: { Glucose: 1318.24 } },
      note: 'Unreacted cellulose (131.82 kg/h) and xylan leave as solids to disposal.' },
    { id: 'A8', name: 'Recovered cellulase', kind: 'process', from: 'E3', to: 'ENZ',
      points: [[455, 228], [467, 228], [467, 143], [326, 143]], tag: false,
      data: { flow: 51.15, comp: { Cellulase: 51.15 } }, note: '97 % mass recovery by ultrafiltration.' },
    { id: 'A9', name: 'Isomeriser feed', kind: 'process', from: 'E4', to: 'E5',
      points: [[540, 230], [560, 230], [560, 157], [600, 157], [600, 170]],
      data: { flow: 14569.81, T: 25, comp: { 'Fresh glucose': 1318.24, 'Recycled sugars': 1724.79 } } },
    { id: 'A10', name: 'Isomerate', kind: 'process', from: 'E5', to: 'HX3',
      points: [[627, 240], [658, 240]], tag: false,
      data: { flow: 14569.81, T: 60, comp: { Fructose: 1278.07, Glucose: 1764.95 } } },
    { id: 'A11', name: 'SMB feed', kind: 'process', from: 'HX3', to: 'E6',
      points: [[698, 240], [723, 240]], tag: false, data: { flow: 14569.81, T: 80 } },
    { id: 'A12', name: 'SMB extract', kind: 'process', from: 'E6', to: 'E6X',
      points: [[748, 180], [748, 138]], tag: false,
      data: { flow: 6512.69, T: 80, comp: { Fructose: 1265.29, Glucose: 52.95 } } },
    { id: 'A13', name: 'Fructose extract', kind: 'process', from: 'E6X', to: 'HX4',
      points: [[765, 122], [790, 122]], tag: false, data: { T: 80, comp: { Fructose: 1265.29, Glucose: 52.95 } } },
    { id: 'S1', name: 'S1 Fructose syrup', kind: 'fructose', from: 'HX4', to: 'U1',
      points: [[830, 122], [843, 122], [843, 216], [960, 216]], tagAt: [870, 170],
      data: { flow: 1171.9, T: 25, comp: { Fructose: 1125.0, Glucose: 46.9 } },
      note: 'Plant B basis (96 % fructose syrup). At its own design Plant A delivers 1318.24 kg/h of sugar; the integrated balances scale Plant A to this demand.' },
    { id: 'A15', name: 'Desorbent water recycle', kind: 'water', from: 'E6X', to: 'E1',
      points: [[748, 105], [748, 85], [110, 85], [110, 200]], tag: false,
      note: 'Water returned to slurry make-up. The Plant A model does not quantify it separately.' },
    { id: 'A16', name: 'SMB raffinate', kind: 'recycle', from: 'E6', to: 'HX5',
      points: [[758, 360], [758, 403]], tag: false,
      data: { flow: 8057.13, T: 80, comp: { 'Glucose-rich sugars': 1724.79 } } },
    { id: 'A17', name: 'Raffinate recycle', kind: 'recycle', from: 'HX5', to: 'E4',
      points: [[740, 420], [507, 420], [507, 280]], tagAt: [620, 420],
      data: { flow: 8057.13, T: 60, comp: { 'Glucose-rich sugars': 1724.79 } },
      note: 'Recycled in full with no purge, so the Plant A loop closure is an upper bound.' },

    /* ---------------------------------------------------------- HMF synthesis */
    { id: 'S4', name: 'S4 Reactor feed', kind: 'process', from: 'U1', to: 'P2',
      points: [[1020, 287], [1060, 287]], tag: false,
      data: { flow: 7586.9, T: 70, P: 1.013, comp: { Fructose: 1125.0, Glucose: 46.9, FDCA: 40.0, Water: 3187.5, GVL: 3187.5 } } },
    { id: 'S4P', name: 'Pressurised feed', kind: 'process', from: 'P2', to: 'E2H',
      points: [[1105, 274], [1127, 274]], tag: false, data: { flow: 7586.9, T: 70.89, P: 17.32 } },
    { id: 'S4H', name: 'Preheated feed', kind: 'process', from: 'E2H', to: 'U2',
      points: [[1167, 274], [1180, 274]], tag: false, data: { flow: 7586.9, T: 180, P: 16.82 } },
    { id: 'S5', name: 'S5 Reactor effluent', kind: 'process', from: 'U2', to: 'U3a',
      points: [[1293, 185], [1327, 185]], tag: false,
      data: { flow: 7586.9, T: 180, P: 15, comp: { HMF: 553.6, 'Levulinic acid': 63.1, 'Formic acid': 25.0, Furfural: 18.6, Formaldehyde: 5.8, Humins: 139.1, Fructose: 49.5, FDCA: 40.0, Water: 3504.6, GVL: 3187.5 } } },

    /* --------------------------------------------------------- FDCA synthesis */
    { id: 'S5M', name: 'Partly quenched effluent', kind: 'process', from: 'U3a', to: 'U3b', requires: ['S5'],
      points: [[1375, 243], [1398, 243]], tag: false, data: { flow: 7586.9, T: 99.08, P: 15 } },
    { id: 'S5C', name: 'Quenched effluent', kind: 'process', from: 'U3b', to: 'LV1',
      points: [[1448, 262], [1462, 262]], tag: false, data: { flow: 7586.9, T: 30, P: 15 } },
    { id: 'S5Q', name: 'S5Q Adsorber feed', kind: 'process', from: 'LV1', to: 'U4',
      points: [[1482, 262], [1494, 262]], tag: false, data: { flow: 7586.9, T: 30, P: 1 } },
    { id: 'S7', name: 'S7 Conditioned liquor', kind: 'process', from: 'U4', to: 'P52',
      points: [[1556, 280], [1583, 280], [1583, 140], [1440, 140], [1440, 197], [1427, 197]], tagAt: [1510, 140],
      data: { flow: 7429.9, T: 30, P: 1.013, comp: { HMF: 544.1, FDCA: 40.0, Water: 3504.6, GVL: 3187.5 } },
      note: 'Main components shown; pass-through solutes make up the rest.' },
    { id: 'S16', name: 'S16 FFCA/FDCA recycle', kind: 'recycle', from: 'U11', to: 'P52',
      points: [[942, 242], [942, 128], [1440, 128], [1440, 140]], arrow: false, tagAt: [1190, 128],
      data: { flow: 20.5, T: 60, comp: { FFCA: 7.8, FDCA: 12.7 } },
      note: 'Direct branch from U11. Another 24.6 kg/h of FFCA reaches U5 via U1 with the catalyst.' },
    { id: 'TRIM', name: 'Solvent trim to U5', kind: 'solvent', from: 'U10', to: 'U5',
      points: [[930, 230], [930, 110], [1590, 110], [1590, 288], [1648, 288]], tagAt: [1300, 110],
      data: { flow: 609.45, T: 30, comp: { GVL: 304.7, Water: 304.75 } },
      note: 'Part of S15. Keeps FDCA below saturation in U5. The model mixes it in at the P52 suction.' },
    { id: 'U5F1', name: 'U5 feed, pressurised', kind: 'process', from: 'P52', to: 'U3a',
      points: [[1388, 186], [1375, 186]], tag: false, data: { flow: 8039.34, T: 30, P: 42.39 } },
    { id: 'U5F', name: 'U5 feed, preheated', kind: 'process', from: 'U3a', to: 'U5', requires: ['U5F1'],
      points: [[1327, 232], [1313, 232], [1313, 348], [1612, 348], [1612, 318], [1648, 318]], tagAt: [1460, 348],
      data: { flow: 8039.35, T: 110, P: 41.69 } },
    { id: 'O2', name: 'Oxygen', kind: 'oxygen', to: 'U5', fromLabel: 'LOX tank T-51 via P-51 / AV-51',
      points: [[1605, 262], [1648, 262]], tag: false,
      data: { flow: 198.67, T: 10, P: 40, comp: { O2: 198.67 } },
      note: 'P-51 cryogenic pump (1.013 → 42 bar, 0.47 kW electrical) and AV-51 ambient-air vaporiser (21.0 kW, 41 m²). Fully consumed; no O2 recycle.' },
    { id: 'CW3', name: 'Cooling water to U3b', kind: 'utility', to: 'U3b', fromLabel: 'Cooling water supply',
      points: [[1480, 292], [1448, 292]], tag: false, data: { flow: 39200, T: 25 }, note: '39.2 m³/h.' },
    { id: 'CW3R', name: 'Cooling water return', kind: 'utility', from: 'U3b', toLabel: 'Cooling tower',
      points: [[1398, 300], [1386, 300]], tag: false, data: { flow: 39200, T: 35 } },
    { id: 'S9', name: 'S9 Oxidiser effluent', kind: 'process', from: 'U5', to: 'U6',
      points: [[1755, 200], [1793, 200], [1793, 650], [1738, 650]], tagAt: [1793, 420],
      data: { flow: 8283.2, T: 110, P: 40, comp: { FDCA: 698.0, FFCA: 33.5, Degradation: 21.8, Water: 3883.9, GVL: 3492.2, 'Other solutes': 153.7 } } },

    /* -------------------------------------------------------- Solvent recovery */
    { id: 'S9L', name: 'S9L Let-down liquor', kind: 'process', from: 'U6', to: 'U7',
      points: [[1655, 583], [1635, 583], [1635, 630], [1620, 630]], tag: false, data: { flow: 8283.2, T: 110, P: 6 } },
    { id: 'S12', name: 'S12 Clarified liquor', kind: 'process', from: 'U7', to: 'LV2',
      points: [[1505, 628], [1470, 628]], tag: false,
      data: { flow: 8276.2, T: 110, P: 6, comp: { FDCA: 698.0, FFCA: 33.5, 'GVL + water': 7376.2 } } },
    { id: 'S12V', name: 'Crystalliser feed', kind: 'process', from: 'LV2', to: 'U8a',
      points: [[1450, 628], [1418, 628]], tag: false, data: { flow: 8276.2, T: 110, P: 1.5 } },
    { id: 'S12I', name: 'Stage 1 slurry', kind: 'process', from: 'U8a', to: 'U8b',
      points: [[1350, 645], [1306, 645]], tag: false, data: { flow: 8276.2, T: 35 } },
    { id: 'CW8', name: 'Cooling water to E-8a', kind: 'utility', to: 'U8a', fromLabel: 'Cooling water supply',
      points: [[1328, 562], [1350, 562]], tag: false, data: { flow: 47937, T: 25 }, note: '47.9 m³/h.' },
    { id: 'CW8R', name: 'Cooling water return', kind: 'utility', from: 'U8a', toLabel: 'Cooling tower',
      points: [[1418, 664], [1436, 664], [1436, 684]], tag: false, data: { flow: 47937, T: 35 } },
    { id: 'CHW', name: 'Chilled water to E-8b', kind: 'utility', to: 'U8b', fromLabel: 'Chiller',
      points: [[1216, 562], [1238, 562]], tag: false, data: { flow: 27254, T: 2 }, note: '27.3 m³/h.' },
    { id: 'CHWR', name: 'Chilled water return', kind: 'utility', from: 'U8b', toLabel: 'Chiller',
      points: [[1306, 668], [1322, 668], [1322, 684]], tag: false, data: { flow: 27254, T: 8 } },
    { id: 'S12X', name: 'S12x Crystal slurry', kind: 'process', from: 'U8b', to: 'U9',
      points: [[1238, 600], [1220, 600], [1220, 637], [1193, 637]], tag: false,
      data: { flow: 8276.2, T: 8, comp: { 'FDCA crystals': 653.8, 'FDCA dissolved': 44.2, 'Liquor (rest)': 7578.2 } } },
    { id: 'S13', name: 'S13 Washed cake', kind: 'process', from: 'U9', to: 'U12',
      points: [[1120, 637], [1075, 637]], tag: false,
      data: { flow: 708.4, T: 8, comp: { FDCA: 644.0, Water: 33.9, GVL: 30.5 } } },
    { id: 'S14', name: 'S14 Mother liquor', kind: 'process', from: 'U9', to: 'U10',
      points: [[1135, 668], [1135, 697], [819, 697]], tagAt: [960, 697],
      data: { flow: 7567.8, T: 8, comp: { FDCA: 54.0, FFCA: 33.5, Degradation: 21.8, 'Other solutes': 146.8, Water: 3850.0, GVL: 3461.7 } } },
    { id: 'S22', name: 'S22raw Dried FDCA', kind: 'process', from: 'U12', to: 'U13',
      points: [[1015, 610], [984, 610]], tag: false, data: { flow: 645.0, T: 120 } },
    { id: 'SWASH', name: 'Spent wash water', kind: 'process', from: 'U12', to: 'U10',
      points: [[1015, 652], [997, 652], [997, 673], [819, 673]], tag: false,
      data: { flow: 334.9, T: 25 }, note: 'Returned to U10 so the displaced GVL is recovered.' },
    { id: 'S20V', name: 'S20v Dryer vapour', kind: 'process', from: 'U12', to: 'U10',
      points: [[1045, 660], [1045, 685], [819, 685]], tag: false,
      data: { flow: 50.5, comp: { Water: 50.2, GVL: 0.3 } } },
    { id: 'PROD', name: 'FDCA product', kind: 'product', from: 'U13', toLabel: 'Product storage',
      points: [[916, 610], [888, 610]], tag: false,
      data: { flow: 643.7, T: 25, comp: { FDCA: 642.4, Water: 1.29 } },
      note: '99.80 wt% FDCA, 9 ppm GVL, 5150 t/a at 8000 h/a.' },
    { id: 'PURGE', name: 'Water purge', kind: 'process', from: 'U10', toLabel: 'Wastewater treatment',
      points: [[745, 582], [718, 582], [718, 552]], tag: false,
      data: { flow: 739.3, T: 59, P: 0.1915, comp: { Water: 696.1, 'Formic acid / formaldehyde / furfural': 43.2 } },
      note: 'Removes exactly the water made in U2 and U5 plus the U12 wash, so the solvent loop stays balanced.' },
    { id: 'S15', name: 'S15 Recovered solvent', kind: 'solvent', from: 'U10', toLabel: 'Split: S2 to U1, trim to U5',
      points: [[790, 560], [790, 507], [930, 507], [930, 230]], arrow: false, tagAt: [860, 507],
      data: { flow: 6983.3, T: 60.9, P: 0.199, comp: { GVL: 3474.8, Water: 3508.5 } },
      note: 'Side draw at 60.9 °C, cooled to about 28 °C. Topped up with U14 GVL, then split into S2 (to U1) and the trim (to U5).' },
    { id: 'S2', name: 'S2 Recycled solvent', kind: 'solvent', from: 'U10', to: 'U1',
      points: [[930, 230], [960, 230]], tag: false,
      data: { flow: 6375, T: 28, comp: { GVL: 3187.5, Water: 3187.5 } } },
    { id: 'SCONC', name: 'S_conc Concentrate', kind: 'process', from: 'U10', to: 'U11',
      points: [[737, 673], [673, 673]], tag: false,
      data: { flow: 230.6, T: 145.9, comp: { FDCA: 54.3, FFCA: 33.5, 'Levulinic acid': 54.1, Degradation: 21.8, Fructose: 49.5, GVL: 17.5 } } },
    { id: 'RCY', name: 'U11 recycle draw', kind: 'recycle', from: 'U11', toLabel: 'Split: catalyst to U1, S16 to P52',
      points: [[629, 556], [629, 524], [942, 524], [942, 242]], arrow: false, tagAt: [760, 524],
      data: { flow: 85.1, comp: { FDCA: 52.7, FFCA: 32.4 } },
      note: 'Splits into the catalyst charge to U1 and S16 to the U5 feed.' },
    { id: 'CAT', name: 'FDCA catalyst recycle', kind: 'recycle', from: 'U11', to: 'U1',
      points: [[942, 242], [960, 242]], tag: false,
      data: { flow: 64.6, comp: { FDCA: 40.0, FFCA: 24.6 } },
      note: 'U11 meters exactly 40 kg/h of FDCA to U1 as catalyst.' },
    { id: 'SLA', name: 'S_LA LA/GVL distillate', kind: 'process', from: 'U11', to: 'U14',
      points: [[585, 663], [515, 663]], tag: false,
      data: { flow: 69.1, T: 145.7, comp: { 'Levulinic acid': 52.2, GVL: 16.9 } } },
    { id: 'LA', name: 'Surplus levulinic acid', kind: 'process', from: 'U11', toLabel: 'Co-product sales',
      points: [[546, 663], [546, 686]], tag: false,
      data: { flow: 50.95, comp: { 'Levulinic acid': 50.95 } }, note: 'Reactor bypass. 408 t/a saleable co-product.' },
    { id: 'PURGE11', name: 'U11 purge', kind: 'process', from: 'U11', toLabel: 'Wastewater treatment',
      points: [[585, 694], [566, 694], [566, 712]], tag: false, data: { flow: 6.9 }, note: 'Flat 3 % bleed of all species.' },
    { id: 'H2', name: 'Hydrogen', kind: 'feed', to: 'U14', fromLabel: 'Cylinder bank',
      points: [[540, 648], [515, 648]], tag: false, data: { flow: 0.0282, P: 30, comp: { H2: 0.0282 } },
      note: 'Fed at 30 % above stoichiometric; the excess is vented.' },
    { id: 'GVLMU', name: 'GVL make-up', kind: 'solvent', from: 'U14', toLabel: 'Joins S15 solvent loop', requires: ['SLA'],
      points: [[440, 622], [400, 622], [400, 507], [790, 507]], arrow: false, tag: false,
      data: { flow: 17.99, comp: { GVL: 17.99 } },
      note: '16.91 kg/h co-distilled GVL plus 1.08 kg/h made by hydrogenation. Replaces GVL lost from the loop.' }
  ]
};
