/* Cadence — SVG drawings: guitar chord boxes and keyboards. Colours come from CSS classes. */
(function (C) {
  'use strict';
  const { mod } = C.theory;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const WHITE = new Set([0, 2, 4, 5, 7, 9, 11]);

  function labelFor(realized, pc) {
    const t = realized.tones.find((x) => x.pc === pc);
    return t ? t.label : '';
  }

  // Chord box: strings vertical (lowest string on the left), nut at the top. Works for 6 or 7 strings.
  function guitar(shape, realized, opts) {
    opts = opts || {};
    if (!shape) return '<svg class="gbox empty" viewBox="0 0 100 118" aria-hidden="true"></svg>';
    const TUNING = shape.tuning || C.voicing.TUNING;
    const fr = shape.frets;
    const N = fr.length;
    const fretted = fr.filter((f) => f > 0);
    const maxF = fretted.length ? Math.max(...fretted) : 0;
    const minF = fretted.length ? Math.min(...fretted) : 0;
    const base = maxF <= 4 ? 1 : minF;
    // 6–7 strings fill the box; a 4-string ukulele gets a narrower, centred one.
    const span = Math.min(66, (N - 1) * 16), rows = 5, x0 = 51 - span / 2, dx = span / (N - 1), y0 = 26, dy = 17.4;
    const rad = Math.min(5.8, dx * 0.46);
    const names = opts.names;
    const H = y0 + rows * dy + (names ? 14 : 4);
    const X = (s) => x0 + s * dx, Y = (f) => y0 + (f - base + 0.5) * dy;
    let g = '';
    for (let k = 0; k <= rows; k++) g += `<line class="g-fret" x1="${X(0)}" x2="${X(N - 1)}" y1="${y0 + k * dy}" y2="${y0 + k * dy}"/>`;
    for (let s = 0; s < N; s++) g += `<line class="g-string" x1="${X(s)}" x2="${X(s)}" y1="${y0}" y2="${y0 + rows * dy}" style="stroke-width:${(1.6 - s * (0.9 / (N - 1))).toFixed(2)}"/>`;
    if (base === 1) g += `<rect class="g-nut" x="${X(0) - 1}" y="${y0 - 4}" width="${X(N - 1) - X(0) + 2}" height="4.2" rx="1"/>`;
    else g += `<text class="g-base" x="${X(0) - 6}" y="${y0 + dy * 0.5 + 3.5}" text-anchor="end">${base}</text>`;
    if (shape.barre && shape.barre.fret > 0) {
      const b = shape.barre;
      g += `<rect class="g-barre" x="${X(b.from) - rad}" y="${Y(b.fret) - rad}" width="${X(b.to) - X(b.from) + rad * 2}" height="${rad * 2}" rx="${rad}"/>`;
    }
    for (let s = 0; s < N; s++) {
      if (names) g += `<text class="g-name" x="${X(s)}" y="${y0 + rows * dy + 11}" text-anchor="middle">${esc(names[s])}</text>`;
      const f = fr[s];
      if (f < 0) { g += `<text class="g-mute" x="${X(s)}" y="${y0 - 9}" text-anchor="middle">×</text>`; continue; }
      const pc = mod(TUNING[s] + f, 12);
      const lab = labelFor(realized, pc);
      const root = lab === 'R';
      if (f === 0) {
        g += `<circle class="g-open${root ? ' root' : ''}" cx="${X(s)}" cy="${y0 - 11}" r="3.4"/>`;
        continue;
      }
      g += `<circle class="g-dot${root ? ' root' : ''}" cx="${X(s)}" cy="${Y(f)}" r="${rad}"/>`;
      if (opts.labels !== false) g += `<text class="g-lab${root ? ' root' : ''}" x="${X(s)}" y="${Y(f) + 2.4}" text-anchor="middle">${esc(lab)}</text>`;
    }
    return `<svg class="gbox" viewBox="0 0 100 ${H}" role="img" aria-label="${esc(opts.aria || '')}">${g}</svg>`;
  }

  // Keyboard from lo to hi (MIDI). marks: Map(midi → {label, cls})
  function keyboard(lo, hi, marks, opts) {
    opts = opts || {};
    while (!WHITE.has(mod(lo, 12))) lo--;
    while (!WHITE.has(mod(hi, 12))) hi++;
    const WW = 10, WH = opts.h || 46, BW = 6.2, BH = WH * 0.62;
    const whites = [];
    for (let m = lo; m <= hi; m++) if (WHITE.has(mod(m, 12))) whites.push(m);
    const xw = new Map(whites.map((m, i) => [m, i * WW]));
    let w = '', b = '';
    for (const m of whites) {
      const mk = marks.get(m);
      w += `<rect class="k-w${mk ? ' on ' + mk.cls : ''}" x="${xw.get(m) + 0.4}" y="0.5" width="${WW - 0.8}" height="${WH - 1}" rx="1.4"/>`;
      if (mk && opts.labels) w += `<text class="k-lab ${mk.cls}" x="${xw.get(m) + WW / 2}" y="${WH - 5}" text-anchor="middle">${esc(mk.label)}</text>`;
      if (opts.octaves && mod(m, 12) === 0 && !mk) w += `<text class="k-oct" x="${xw.get(m) + WW / 2}" y="${WH - 5}" text-anchor="middle">C${Math.floor(m / 12) - 1}</text>`;
    }
    for (let m = lo; m <= hi; m++) {
      if (WHITE.has(mod(m, 12))) continue;
      const x = xw.get(m - 1) + WW - BW / 2;
      const mk = marks.get(m);
      b += `<rect class="k-b${mk ? ' on ' + mk.cls : ''}" x="${x}" y="0" width="${BW}" height="${BH}" rx="1"/>`;
      if (mk && opts.labels) b += `<text class="k-lab k-lab-b ${mk.cls}" x="${x + BW / 2}" y="${BH - 4}" text-anchor="middle">${esc(mk.label)}</text>`;
    }
    return `<svg class="kbd" viewBox="0 0 ${whites.length * WW} ${WH}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(opts.aria || '')}">${w}${b}</svg>`;
  }

  /* Full neck, drawn like tab: highest string on top, nut on the left.
   * notes: [{s, f, m, label, cls, out}] · cls: 'croot' | 'ctone' | 'scale' (+ ' sroot') · out = outside the chosen position
   */
  function neck(tun, names, notes, opts) {
    opts = opts || {};
    const N = tun.length;
    const maxF = opts.maxF || 15;
    const fw = 44, x0 = 50, sp = 24, top = 18;
    const W = x0 + maxF * fw + 14, H = top + (N - 1) * sp + 30;
    const Y = (s) => top + (N - 1 - s) * sp;
    const X = (f) => (f === 0 ? x0 - 15 : x0 + (f - 0.5) * fw);
    let g = '';
    // inlays
    for (const f of [3, 5, 7, 9, 15, 17]) if (f <= maxF) g += `<circle class="n-inlay" cx="${x0 + (f - 0.5) * fw}" cy="${top + ((N - 1) * sp) / 2}" r="5"/>`;
    if (maxF >= 12) { const cx = x0 + 11.5 * fw; g += `<circle class="n-inlay" cx="${cx}" cy="${top + sp * 0.5 + ((N - 1) * sp) / 2 - sp}" r="5"/><circle class="n-inlay" cx="${cx}" cy="${top + ((N - 1) * sp) / 2 + sp - sp * 0.5}" r="5"/>`; }
    for (let f = 1; f <= maxF; f++) g += `<line class="n-fret" x1="${x0 + f * fw}" x2="${x0 + f * fw}" y1="${top}" y2="${top + (N - 1) * sp}"/>`;
    g += `<rect class="n-nut" x="${x0 - 3}" y="${top - 2}" width="5" height="${(N - 1) * sp + 4}" rx="1"/>`;
    for (let s = 0; s < N; s++) {
      g += `<line class="n-string" x1="${x0}" x2="${x0 + maxF * fw}" y1="${Y(s)}" y2="${Y(s)}" style="stroke-width:${(0.8 + (s < N / 2 ? (N / 2 - s) * 0.35 : 0)).toFixed(2)}"/>`;
      g += `<text class="n-name" x="2" y="${Y(s) + 4}">${esc(names[s])}</text>`;
    }
    for (const f of [3, 5, 7, 9, 12, 15, 17]) if (f <= maxF) g += `<text class="n-fnum" x="${x0 + (f - 0.5) * fw}" y="${H - 6}" text-anchor="middle">${f}</text>`;
    if (opts.window) g += `<rect class="n-window" x="${Math.max(x0 - 28, x0 + (opts.window[0] - 1) * fw - 2)}" y="${top - 13}" width="${(opts.window[1] - Math.max(0, opts.window[0] - 1)) * fw + (opts.window[0] === 0 ? 28 : 4)}" height="${(N - 1) * sp + 26}" rx="10"/>`;
    for (const n of notes) {
      const cx = X(n.f), cy = Y(n.s);
      g += `<g class="n-note ${n.cls}${n.out ? ' out' : ''}" data-m="${n.m}"><circle cx="${cx}" cy="${cy}" r="9.5"/><text x="${cx}" y="${cy + 3.4}" text-anchor="middle">${esc(n.label)}</text></g>`;
    }
    return `<svg class="neck" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.aria || '')}">${g}</svg>`;
  }

  C.draw = { guitar, keyboard, neck, esc };
})(window.Cadence = window.Cadence || {});
