/* Cadence — scales to play over a progression.
 *
 * Two questions, two answers:
 *  - keyScale(): one scale for the whole progression (the mode's scale, or a pentatonic/blues
 *    scale where the style calls for it).
 *  - chordScale(): a scale per chord. It reuses the same "key context" the colour pass uses
 *    to decide extensions: the chord's notes plus the key's notes, read from the chord's root.
 *    Dm7 in C → D Dorian, G7 → G Mixolydian, E7 heading to Am → E Phrygian dominant.
 *
 * positions(): where to play it on a fretted instrument —
 *  pentatonic boxes (2 notes per string), 3-notes-per-string patterns, or one-hand "box" windows.
 */
(function (C) {
  'use strict';
  const T = C.theory;
  const { mod } = T;

  // st: semitones from the root · lt: letter steps (for correct spelling)
  const SCALES = {
    ionian:        { st: [0, 2, 4, 5, 7, 9, 11], lt: [0, 1, 2, 3, 4, 5, 6] },
    dorian:        { st: [0, 2, 3, 5, 7, 9, 10], lt: [0, 1, 2, 3, 4, 5, 6] },
    phrygian:      { st: [0, 1, 3, 5, 7, 8, 10], lt: [0, 1, 2, 3, 4, 5, 6] },
    lydian:        { st: [0, 2, 4, 6, 7, 9, 11], lt: [0, 1, 2, 3, 4, 5, 6] },
    mixolydian:    { st: [0, 2, 4, 5, 7, 9, 10], lt: [0, 1, 2, 3, 4, 5, 6] },
    aeolian:       { st: [0, 2, 3, 5, 7, 8, 10], lt: [0, 1, 2, 3, 4, 5, 6] },
    locrian:       { st: [0, 1, 3, 5, 6, 8, 10], lt: [0, 1, 2, 3, 4, 5, 6] },
    harmonicMinor: { st: [0, 2, 3, 5, 7, 8, 11], lt: [0, 1, 2, 3, 4, 5, 6] },
    locrianNat6:   { st: [0, 1, 3, 5, 6, 9, 10], lt: [0, 1, 2, 3, 4, 5, 6] },
    ionianSharp5:  { st: [0, 2, 4, 5, 8, 9, 11], lt: [0, 1, 2, 3, 4, 5, 6] },
    dorianSharp4:  { st: [0, 2, 3, 6, 7, 9, 10], lt: [0, 1, 2, 3, 4, 5, 6] },
    phrygianDom:   { st: [0, 1, 4, 5, 7, 8, 10], lt: [0, 1, 2, 3, 4, 5, 6] },
    lydianSharp2:  { st: [0, 3, 4, 6, 7, 9, 11], lt: [0, 1, 2, 3, 4, 5, 6] },
    ultralocrian:  { st: [0, 1, 3, 4, 6, 8, 9], lt: [0, 1, 2, 3, 4, 5, 6] },
    melodicMinor:  { st: [0, 2, 3, 5, 7, 9, 11], lt: [0, 1, 2, 3, 4, 5, 6] },
    dorianFlat2:   { st: [0, 1, 3, 5, 7, 9, 10], lt: [0, 1, 2, 3, 4, 5, 6] },
    lydianAug:     { st: [0, 2, 4, 6, 8, 9, 11], lt: [0, 1, 2, 3, 4, 5, 6] },
    mixolydianFlat6: { st: [0, 2, 4, 5, 7, 8, 10], lt: [0, 1, 2, 3, 4, 5, 6] },
    locrianNat2:   { st: [0, 2, 3, 5, 6, 8, 10], lt: [0, 1, 2, 3, 4, 5, 6] },
    lydianDom:     { st: [0, 2, 4, 6, 7, 9, 10], lt: [0, 1, 2, 3, 4, 5, 6] },
    altered:       { st: [0, 1, 3, 4, 6, 8, 10], lt: [0, 1, 1, 2, 3, 5, 6] },
    halfWhole:     { st: [0, 1, 3, 4, 6, 7, 9, 10], lt: [0, 1, 1, 2, 3, 4, 5, 6] },
    wholeHalf:     { st: [0, 2, 3, 5, 6, 8, 9, 11], lt: [0, 1, 2, 3, 4, 5, 5, 6] },
    minorPent:     { st: [0, 3, 5, 7, 10], lt: [0, 2, 3, 4, 6] },
    majorPent:     { st: [0, 2, 4, 7, 9], lt: [0, 1, 2, 4, 5] },
    blues:         { st: [0, 3, 5, 6, 7, 10], lt: [0, 2, 3, 4, 4, 6], base: 'minorPent' },
    majorBlues:    { st: [0, 2, 3, 4, 7, 9], lt: [0, 1, 2, 2, 4, 5], base: 'majorPent' },
  };
  const MAJ = [0, 2, 4, 5, 7, 9, 11];
  // Interval label of each scale step: R, 2, ♭3, ♯4…
  for (const id in SCALES) {
    const s = SCALES[id];
    s.lab = s.st.map((st, k) => {
      if (k === 0) return 'R';
      let a = mod(st - MAJ[s.lt[k]], 12);
      if (a > 6) a -= 12;
      return T.accText(a) + (s.lt[k] + 1);
    });
  }
  const HEPTA = ['ionian', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'aeolian', 'locrian',
    'harmonicMinor', 'locrianNat6', 'ionianSharp5', 'dorianSharp4', 'phrygianDom', 'lydianSharp2', 'ultralocrian',
    'melodicMinor', 'dorianFlat2', 'lydianAug', 'lydianDom', 'mixolydianFlat6', 'locrianNat2', 'altered'];
  const MODE_SCALE = { major: 'ionian', minor: 'aeolian', dorian: 'dorian', mixolydian: 'mixolydian', phrygian: 'phrygian', phrygianDom: 'phrygianDom', lydian: 'lydian' };
  const MINORISH = new Set(['minor', 'dorian', 'phrygian']);

  // A concrete scale: id + spelled root → spelled notes with interval labels.
  function build(id, root) {
    const s = SCALES[id];
    const notes = s.st.map((st, k) => Object.assign(T.spell(root.letter + s.lt[k], root.pc + st), { label: s.lab[k], step: st }));
    return { id, root, notes, pcs: new Set(notes.map((n) => n.pc)) };
  }
  const pentOf = (mode) => (MINORISH.has(mode) ? 'minorPent' : mode === 'phrygianDom' ? null : 'majorPent');

  /* ---------- one scale for the whole progression ---------- */
  function keyScale(key, styleId, chords) {
    const mode = key.mode;
    const main = MODE_SCALE[mode];
    const pent = pentOf(mode);
    let ids;
    if (styleId === 'blues') ids = mode === 'minor' ? ['blues', 'minorPent', 'aeolian', 'dorian'] : ['blues', 'majorBlues', 'minorPent', 'mixolydian'];
    else if (['rock', 'punk', 'country', 'folk', 'reggae'].includes(styleId) && pent) ids = [pent, main].concat(mode === 'major' && styleId !== 'folk' ? ['minorPent'] : []);
    else if (styleId === 'funk') ids = [main, pent || 'minorPent', MINORISH.has(mode) ? 'blues' : 'majorBlues'];
    else ids = [main].concat(pent ? [pent] : [], mode === 'minor' ? ['harmonicMinor'] : []);
    ids = ids.filter((v, i, a) => v && a.indexOf(v) === i);
    return { options: ids.map((id) => ({ id, root: key.tonic })) };
  }
  // Chords with notes the chosen scale doesn't contain (V in minor, borrowed chords, secondary dominants…).
  // A real clash is the scale holding a different version of one of the chord's notes
  // (B♭ in the scale, B in the chord). A note the scale simply leaves out — like a pentatonic does — is no clash.
  function clashes(sc, chords, key) {
    const out = [];
    chords.forEach((c, i) => {
      const r = T.realize(Object.assign({}, c, { quality: T.harm(c) }), key);
      const bad = r.tones.some((t) => !sc.pcs.has(t.pc) && sc.notes.some((n) => n.letter === t.letter && n.pc !== t.pc));
      if (bad) out.push(i);
    });
    return out;
  }

  /* ---------- a scale for each chord ---------- */
  function matchHepta(pcSet, rootPc) {
    const rel = [...pcSet].map((p) => mod(p - rootPc, 12)).sort((a, b) => a - b).join(',');
    return HEPTA.find((id) => SCALES[id].st.join(',') === rel) || null;
  }
  function chordScale(ch, key, styleId) {
    const hq = T.harm(ch);
    const q = T.Q[hq];
    const r = T.realize(Object.assign({}, ch, { quality: hq }), key);
    const root = r.root;
    const rootPc = root.pc;
    const out = (id, reason, alts, extra) => ({ options: [id].concat(alts || []).filter((v, i, a) => v && a.indexOf(v) === i).map((x) => ({ id: x, root })), reason, extra: extra || {} });
    const isDom = q.fam === 'dom' || (q.fam === 'maj' && ch.rootPc === 7 && !['maj7', 'maj9', 'maj69', 'maj6', 'add9'].includes(hq));

    if (ch.role === 'secondary' && ch.target) {
      const tMinor = T.Q[ch.target.quality].fam === 'min';
      const tr = T.realize(Object.assign({}, ch.target, { quality: T.TRIAD_OF_FAMILY[T.Q[ch.target.quality].fam] || 'maj' }), key);
      return out(tMinor ? 'phrygianDom' : 'mixolydian', tMinor ? 'secondaryMinor' : 'secondaryMajor', tMinor ? ['halfWhole', 'altered'] : ['halfWhole', 'lydianDom'], { target: tr.root, targetMinor: tMinor });
    }
    if (ch.role === 'tritone') return out('lydianDom', 'tritone', ['mixolydian']);
    if (q.fam === 'dim7') return out('wholeHalf', 'dim7');
    if (styleId === 'blues' && isDom) return out('mixolydian', 'bluesDom', ['blues', 'minorPent', 'majorPent']);
    // Minor tonic with a major 6th (i6, the jazz minor tonic): melodic minor is the standard choice.
    if (hq === 'min6' && ch.rootPc === 0) return out('melodicMinor', 'minorTonic6', ['dorian', 'minorPent']);

    // Same rule as the colour pass: the first scale (key, harmonic minor, parallel key…) that holds the chord.
    const scales = T.contextScales(key);
    const triad = T.triadPcs(ch, key);
    const idx = scales.findIndex((s) => triad.every((p) => s.has(p)) && r.pcs.every((p) => s.has(p)));
    const found = idx >= 0 ? matchHepta(scales[idx], rootPc) : null;
    let alts = [];
    if (q.fam === 'min' || q.fam === 'pow') alts = ['minorPent'];
    else if (q.fam === 'maj' || q.fam === 'sus') alts = ['majorPent'];
    if (isDom) alts = alts.concat(['halfWhole', 'altered']);
    // Half-diminished: Locrian's ♭2 is an avoid note, so Locrian ♮2 is the smoother alternative.
    if (q.fam === 'hdim' || q.fam === 'dim') alts = ['locrianNat2'];
    // A dominant a half step above its goal (♭II7 → I) works like a tritone substitution.
    if (!found && isDom && ch.rootPc === 1) return out('lydianDom', 'tritone', ['mixolydian']);
    if (!found) {
      // Outside every nearby key (chromatic mediants, the Neapolitan…). Least alteration: keep the key's notes
      // and swap in only the chord's notes that differ (same letter, new accidental). E major in C → G becomes G♯.
      const altered = key.scale.map((n) => r.tones.find((t) => t.letter === n.letter) || n);
      const changes = key.scale.filter((n, k) => altered[k].pc !== n.pc).map((n, k) => ({ from: n, to: r.tones.find((t) => t.letter === n.letter) }));
      const set = new Set(altered.map((n) => n.pc));
      const la = r.pcs.every((p) => set.has(p)) && set.size === 7 ? matchHepta(set, rootPc) : null;
      if (la) return out(la, 'leastAlteration', alts, { changes });
      const def = q.fam === 'min' ? 'dorian' : q.fam === 'hdim' || q.fam === 'dim' ? 'locrian' : isDom ? 'mixolydian' : 'lydian';
      return out(def, 'chromatic', alts.concat(q.fam === 'maj' ? ['ionian'] : []));
    }
    const harmonic = key.mode === 'minor' && idx === 1;
    const reason = idx === 0 ? 'diatonic' : harmonic ? (ch.rootPc === 7 ? 'harmonicV' : 'harmonic') : 'borrowed';
    return out(found, reason, alts);
  }

  /* ---------- avoid notes ----------
   * A scale note a half step above a chord tone rubs hard if you hold it (F over C–E–G: F sits on top of E).
   * Use it in passing, don't land on it. On dominant 7ths only the 4th counts: ♭9 and ♭13 are tensions there.
   */
  function avoidNotes(sc, ch, key) {
    const hq = T.harm(ch);
    const q = T.Q[hq];
    const r = T.realize(Object.assign({}, ch, { quality: hq }), key);
    const chordPcs = new Set(r.pcs);
    const dom = q.fam === 'dom';
    const third = r.tones.find((t) => t.label === '3' || t.label === '♭3');
    const targets = dom ? (third ? [third.pc] : []) : r.pcs;
    return sc.notes.filter((n) => !chordPcs.has(n.pc) && targets.some((p) => mod(n.pc - p, 12) === 1)).map((n) => n.pc);
  }

  /* ---------- positions on a fretted instrument ---------- */
  const MAX_FRET = 17;
  const ascending = (tun) => tun.every((m, i) => i === 0 || m > tun[i - 1]);

  // n notes per string, starting from each scale degree on the lowest string.
  function npsPositions(pcsArr, tun, n) {
    const pcs = new Set(pcsArr);
    const N = tun.length;
    const out = [];
    pcsArr.forEach((pc, d) => {
      let f0 = mod(pc - tun[0], 12);
      const seq = [];
      for (let m = tun[0] + f0; seq.length < n * N && m < tun[0] + 60; m++) if (pcs.has(mod(m, 12))) seq.push(m);
      const notes = [];
      for (let s = 0; s < N; s++) for (let k = 0; k < n; k++) {
        const m = seq[s * n + k];
        notes.push({ s, f: m - tun[s], m });
      }
      if (notes.some((x) => x.f < 0 || x.f > MAX_FRET)) return;
      const fr = notes.map((x) => x.f);
      const minF = Math.min(...fr), maxF = Math.max(...fr);
      if (maxF - minF > (n === 3 ? 6 : 5)) return;
      out.push({ d, notes, minF, maxF });
    });
    return out;
  }
  // One hand position: every scale note inside a window of frets.
  function windowNotes(pcs, tun, lo, hi) {
    const notes = [];
    tun.forEach((open, s) => { for (let f = Math.max(0, lo); f <= Math.min(MAX_FRET, hi); f++) if (pcs.has(mod(open + f, 12))) notes.push({ s, f, m: open + f }); });
    return notes;
  }
  function boxPositions(sc, tun, width) {
    const pcsArr = sc.notes.map((n) => n.pc);
    const pcs = sc.pcs;
    // Anchor the boxes on the parent pentatonic when there is one (that's how the 5 classic shapes relate).
    const majorish = sc.notes.some((n) => n.label === '3');
    const pentId = majorish ? 'majorPent' : 'minorPent';
    const pent = build(pentId, sc.root);
    let anchors = [];
    if ([...pent.pcs].every((p) => pcs.has(p)) && ascending(tun) && tun.length >= 6) {
      anchors = npsPositions(pent.notes.map((x) => x.pc), tun, 2).map((p) => ({ d: p.d, lo: p.minF }));
    } else {
      anchors = pcsArr.map((pc, d) => ({ d, lo: Math.max(0, mod(pc - tun[0], 12) - 1) }));
      // keep windows at least two frets apart
      anchors.sort((a, b) => a.lo - b.lo);
      anchors = anchors.filter((a, i, arr) => i === 0 || a.lo - arr[i - 1].lo >= 2);
    }
    return anchors.map((a) => {
      const notes = windowNotes(pcs, tun, a.lo, a.lo + width - 1);
      const fr = notes.map((x) => x.f);
      return { d: a.d, notes, minF: Math.min(...fr), maxF: Math.max(...fr) };
    });
  }

  // system: 'auto' (2 per string for pentatonics, 3 per string for 7-note scales) or 'box'
  function positions(sc, tun, system) {
    const s = SCALES[sc.id];
    const len = s.st.length;
    const okNps = ascending(tun);
    let list;
    if (system === 'box' || !okNps || len === 8) list = boxPositions(sc, tun, tun.length === 4 ? 4 : 5);
    else if (len === 5) list = npsPositions(sc.notes.map((n) => n.pc), tun, 2);
    else if (len === 6) {
      // Blues scales: the pentatonic box plus the "blue note" wherever it falls inside the box.
      const base = build(s.base, sc.root);
      list = npsPositions(base.notes.map((n) => n.pc), tun, 2).map((p) => {
        const extra = windowNotes(new Set([...sc.pcs].filter((x) => !base.pcs.has(x))), tun, p.minF, p.maxF);
        return Object.assign({}, p, { notes: p.notes.concat(extra) });
      });
    } else list = npsPositions(sc.notes.map((n) => n.pc), tun, 3);
    if (!list.length) list = boxPositions(sc, tun, tun.length === 4 ? 4 : 5);
    // Fold positions high on the neck down an octave when they fit, then order up the neck from the root.
    list.forEach((p) => {
      if (p.minF >= 12) { p.notes = p.notes.map((x) => ({ s: x.s, f: x.f - 12, m: x.m - 12 })); p.minF -= 12; p.maxF -= 12; }
    });
    const rootIdx = list.findIndex((p) => p.d === 0);
    list = rootIdx > 0 ? list.slice(rootIdx).concat(list.slice(0, rootIdx)) : list;
    return list.map((p) => Object.assign(p, { center: (p.minF + p.maxF) / 2 }));
  }

  // Every scale note on the neck.
  function wholeNeck(sc, tun, maxF) {
    return windowNotes(sc.pcs, tun, 0, maxF || 15);
  }

  // A playable run: the position's notes low → high, or one octave from a comfortable root.
  function runNotes(sc, pos, lowMidi) {
    let ms;
    if (pos) ms = [...new Set(pos.notes.map((x) => x.m))].sort((a, b) => a - b);
    else {
      let r = sc.root.pc;
      while (r < lowMidi) r += 12;
      ms = sc.notes.map((n) => r + n.step).concat([r + 12]);
    }
    return ms.concat(ms.slice(0, -1).reverse());
  }

  C.scales = { SCALES, build, keyScale, chordScale, clashes, avoidNotes, positions, wholeNeck, runNotes };
})(typeof window !== 'undefined' ? (window.Cadence = window.Cadence || {}) : (globalThis.Cadence = globalThis.Cadence || {}));
