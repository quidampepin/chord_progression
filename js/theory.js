/* Cadence — music theory core.
 * Pitch spelling, modes, chord qualities and Roman-numeral parsing.
 * Everything here is pure (no DOM), so it also runs under Node for tests.
 */
(function (C) {
  'use strict';

  const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const SOLFEGE = ['Do', 'Ré', 'Mi', 'Fa', 'Sol', 'La', 'Si'];
  const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];
  const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11]; // Roman numerals are measured against the major scale (♭VII, ♭VI…)
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
  const mod = (n, m) => ((n % m) + m) % m;

  const MODES = {
    major:      { steps: [0, 2, 4, 5, 7, 9, 11], parallel: 'minor' },
    minor:      { steps: [0, 2, 3, 5, 7, 8, 10], parallel: 'major' },
    dorian:     { steps: [0, 2, 3, 5, 7, 9, 10], parallel: 'major' },
    mixolydian: { steps: [0, 2, 4, 5, 7, 9, 10], parallel: 'minor' },
    phrygian:   { steps: [0, 1, 3, 5, 7, 8, 10], parallel: 'major' },
    phrygianDom: { steps: [0, 1, 4, 5, 7, 8, 10], parallel: 'minor' },
    lydian:     { steps: [0, 2, 4, 6, 7, 9, 11], parallel: 'minor' },
  };
  const HARMONIC_MINOR = [0, 2, 3, 5, 7, 8, 11];

  /* ---------- spelling ---------- */

  // A spelled note: letter index (0=C … 6=B), accidental (-2…+2), pitch class.
  function spell(letter, pc) {
    letter = mod(letter, 7);
    let acc = mod(pc - LETTER_PC[letter], 12);
    if (acc > 6) acc -= 12;
    return { letter, acc, pc: mod(pc, 12) };
  }
  const accText = (a) => (a > 0 ? '♯'.repeat(a) : a < 0 ? '♭'.repeat(-a) : '');
  function noteName(n, notation) {
    return (notation === 'solfege' ? SOLFEGE[n.letter] : LETTERS[n.letter]) + accText(n.acc);
  }
  // If a spelling needs a double accidental, use the enharmonic neighbour instead.
  function simplify(n) {
    if (Math.abs(n.acc) < 2) return n;
    return spell(n.letter + (n.acc > 0 ? 1 : -1), n.pc);
  }

  // Choose the tonic spelling with the smallest key signature (D♭ major, not C♯ major).
  function tonicFor(pc, mode) {
    const steps = MODES[mode].steps;
    let best = null;
    for (let L = 0; L < 7; L++) {
      const t = spell(L, pc);
      if (Math.abs(t.acc) > 1) continue;
      let cost = 0;
      for (let d = 0; d < 7; d++) cost += Math.abs(spell(L + d, pc + steps[d]).acc);
      const prefer = pc === 6 ? t.acc > 0 : t.acc < 0; // tie: F♯ major, E♭ minor…
      if (!best || cost < best.cost || (cost === best.cost && prefer)) best = { t, cost };
    }
    return best.t;
  }

  function makeKey(tonicPc, mode) {
    const tonic = tonicFor(tonicPc, mode);
    const steps = MODES[mode].steps;
    const scale = steps.map((s, d) => spell(tonic.letter + d, tonic.pc + s));
    return { tonic, mode, steps, scale, pcs: new Set(scale.map((n) => n.pc)) };
  }

  // Scales a chord may "belong to", in order of preference. Used to decide which
  // extensions sound in key (e.g. iii gets m7, never m9, because the 9th is out of key).
  function contextScales(key) {
    const t = key.tonic.pc;
    const set = (steps) => new Set(steps.map((s) => mod(t + s, 12)));
    const list = [set(key.steps)];
    if (key.mode === 'minor') list.push(set(HARMONIC_MINOR));
    list.push(set(MODES[MODES[key.mode].parallel].steps), set(MODES.major.steps), set(MODES.minor.steps),
      set(MODES.dorian.steps), set(MODES.mixolydian.steps));
    return list;
  }

  /* ---------- chord qualities ----------
   * iv: semitones above root · lt: letter steps above root (for correct spelling)
   * lab: interval labels · ess: indexes a guitar voicing must contain
   * fam: harmonic family · sym: chord-symbol suffix · rn: Roman-numeral suffix
   */
  const Q = {
    maj:      { iv: [0, 4, 7], lt: [0, 2, 4], lab: ['R', '3', '5'], fam: 'maj', sym: '', rn: '' },
    min:      { iv: [0, 3, 7], lt: [0, 2, 4], lab: ['R', '♭3', '5'], fam: 'min', sym: 'm', rn: '' },
    dim:      { iv: [0, 3, 6], lt: [0, 2, 4], lab: ['R', '♭3', '♭5'], fam: 'dim', sym: '°', rn: '°' },
    aug:      { iv: [0, 4, 8], lt: [0, 2, 4], lab: ['R', '3', '♯5'], fam: 'aug', sym: '+', rn: '+' },
    sus2:     { iv: [0, 2, 7], lt: [0, 1, 4], lab: ['R', '2', '5'], fam: 'sus', sym: 'sus2', rn: 'sus2' },
    sus4:     { iv: [0, 5, 7], lt: [0, 3, 4], lab: ['R', '4', '5'], fam: 'sus', sym: 'sus4', rn: 'sus4' },
    maj7:     { iv: [0, 4, 7, 11], lt: [0, 2, 4, 6], lab: ['R', '3', '5', '7'], ess: [0, 1, 3], fam: 'maj', sym: 'maj7', rn: 'maj7' },
    maj6:     { iv: [0, 4, 7, 9], lt: [0, 2, 4, 5], lab: ['R', '3', '5', '6'], ess: [0, 1, 3], fam: 'maj', sym: '6', rn: '6' },
    maj69:    { iv: [0, 4, 7, 9, 14], lt: [0, 2, 4, 5, 1], lab: ['R', '3', '5', '6', '9'], ess: [0, 1, 3, 4], fam: 'maj', sym: '6/9', rn: '6/9' },
    add9:     { iv: [0, 4, 7, 14], lt: [0, 2, 4, 1], lab: ['R', '3', '5', '9'], ess: [0, 1, 3], fam: 'maj', sym: 'add9', rn: 'add9' },
    maj9:     { iv: [0, 4, 7, 11, 14], lt: [0, 2, 4, 6, 1], lab: ['R', '3', '5', '7', '9'], ess: [0, 1, 3, 4], fam: 'maj', sym: 'maj9', rn: 'maj9' },
    dom7:     { iv: [0, 4, 7, 10], lt: [0, 2, 4, 6], lab: ['R', '3', '5', '♭7'], ess: [0, 1, 3], fam: 'dom', sym: '7', rn: '7' },
    dom9:     { iv: [0, 4, 7, 10, 14], lt: [0, 2, 4, 6, 1], lab: ['R', '3', '5', '♭7', '9'], ess: [0, 1, 3, 4], fam: 'dom', sym: '9', rn: '9' },
    dom13:    { iv: [0, 4, 10, 14, 21], lt: [0, 2, 6, 1, 5], lab: ['R', '3', '♭7', '9', '13'], ess: [0, 1, 2, 4], fam: 'dom', sym: '13', rn: '13' },
    dom7b9:   { iv: [0, 4, 7, 10, 13], lt: [0, 2, 4, 6, 1], lab: ['R', '3', '5', '♭7', '♭9'], ess: [0, 1, 3, 4], fam: 'dom', sym: '7♭9', rn: '7♭9' },
    dom7sus4: { iv: [0, 5, 7, 10], lt: [0, 3, 4, 6], lab: ['R', '4', '5', '♭7'], ess: [0, 1, 3], fam: 'dom', sym: '7sus4', rn: '7sus4' },
    min7:     { iv: [0, 3, 7, 10], lt: [0, 2, 4, 6], lab: ['R', '♭3', '5', '♭7'], ess: [0, 1, 3], fam: 'min', sym: 'm7', rn: '7' },
    min6:     { iv: [0, 3, 7, 9], lt: [0, 2, 4, 5], lab: ['R', '♭3', '5', '6'], ess: [0, 1, 3], fam: 'min', sym: 'm6', rn: '6' },
    madd9:    { iv: [0, 3, 7, 14], lt: [0, 2, 4, 1], lab: ['R', '♭3', '5', '9'], ess: [0, 1, 3], fam: 'min', sym: 'm(add9)', rn: 'add9' },
    min9:     { iv: [0, 3, 7, 10, 14], lt: [0, 2, 4, 6, 1], lab: ['R', '♭3', '5', '♭7', '9'], ess: [0, 1, 3, 4], fam: 'min', sym: 'm9', rn: '9' },
    min11:    { iv: [0, 3, 7, 10, 14, 17], lt: [0, 2, 4, 6, 1, 3], lab: ['R', '♭3', '5', '♭7', '9', '11'], ess: [0, 1, 3, 5], fam: 'min', sym: 'm11', rn: '11' },
    m7b5:     { iv: [0, 3, 6, 10], lt: [0, 2, 4, 6], lab: ['R', '♭3', '♭5', '♭7'], fam: 'hdim', sym: 'm7♭5', rn: 'ø7' },
    pow5:     { iv: [0, 7], lt: [0, 4], lab: ['R', '5'], fam: 'pow', sym: '5', rn: '5' },
    dim7:     { iv: [0, 3, 6, 9], lt: [0, 2, 4, 6], lab: ['R', '♭3', '♭5', '°7'], fam: 'dim7', sym: '°7', rn: '°7' },
  };
  for (const k in Q) if (!Q[k].ess) Q[k].ess = Q[k].iv.map((_, i) => i);

  const TRIAD_OF_FAMILY = { maj: 'maj', min: 'min', dom: 'maj', dim: 'dim', hdim: 'dim', dim7: 'dim', aug: 'aug', pow: 'pow5' };
  // Power chords have no 3rd; for harmony (numeral case, function, key fit) use the chord they stand for.
  const harm = (ch) => (Q[ch.quality].fam === 'pow' && ch.base && Q[ch.base].fam !== 'pow' ? ch.base : ch.quality);

  /* ---------- Roman numerals ---------- */

  const RN = /^([b#♭♯]?)(VII|VI|IV|V|III|II|I|vii|vi|iv|v|iii|ii|i)([^/]*)(?:\/(.+))?$/;
  const NUM_IDX = { i: 0, ii: 1, iii: 2, iv: 3, v: 4, vi: 5, vii: 6 };

  function suffixQuality(s, upper) {
    switch (s) {
      case '': return upper ? 'maj' : 'min';
      case '°': case 'o': return 'dim';
      case 'ø7': case 'ø': return 'm7b5';
      case '°7': case 'o7': return 'dim7';
      case '+': return 'aug';
      case '7': return upper ? 'dom7' : 'min7';
      case 'maj7': return 'maj7';
      case '9': return upper ? 'dom9' : 'min9';
      case 'maj9': return 'maj9';
      case '11': return 'min11';
      case '13': return 'dom13';
      case '7b9': return 'dom7b9';
      case '6': return upper ? 'maj6' : 'min6';
      case '69': return 'maj69';
      case 'add9': return upper ? 'add9' : 'madd9';
      case 'sus2': return 'sus2';
      case 'sus': case 'sus4': return 'sus4';
      case '7sus4': return 'dom7sus4';
      case '5': return 'pow5';
    }
    throw new Error('Unknown chord suffix "' + s + '"');
  }
  function alterFor(deg, pc) {
    let a = mod(pc - MAJOR_STEPS[deg], 12);
    if (a > 6) a -= 12;
    return a;
  }

  // "V7/ii" → { degree:5, rootPc:9, quality:'dom7', role:'secondary', target:{…ii…} }
  function parseRoman(tok) {
    const m = RN.exec(tok);
    if (!m) throw new Error('Cannot read Roman numeral "' + tok + '"');
    const [, accS, num, suf, target] = m;
    const upper = num === num.toUpperCase();
    const quality = suffixQuality(suf, upper);
    if (target) {
      const t = parseRoman(target);
      const degree = mod(t.degree + 4, 7);
      const rootPc = mod(t.rootPc + 7, 12);
      return { degree, alter: alterFor(degree, rootPc), rootPc, quality, explicit: true, role: 'secondary', target: t };
    }
    const degree = NUM_IDX[num.toLowerCase()];
    const alter = accS === 'b' || accS === '♭' ? -1 : accS ? 1 : 0;
    return { degree, alter, rootPc: mod(MAJOR_STEPS[degree] + alter, 12), quality, explicit: suf !== '', role: null, target: null };
  }

  // Build a chord object directly from a root (relative pc) on a scale degree.
  function chordOn(degree, rootPc, quality, role, target) {
    return { degree: mod(degree, 7), alter: alterFor(mod(degree, 7), rootPc), rootPc: mod(rootPc, 12), quality, explicit: true, role: role || null, target: target || null };
  }

  function romanText(ch) {
    const q = Q[ch.quality];
    const lower = ['min', 'dim', 'hdim', 'dim7'].includes(Q[harm(ch)].fam);
    if (ch.role === 'secondary' && ch.target) return 'V' + q.rn + '/' + romanText(Object.assign({}, ch.target, { quality: TRIAD_OF_FAMILY[Q[ch.target.quality].fam] || 'maj', role: null }));
    const n = ROMAN[ch.degree];
    return accText(ch.alter) + (lower ? n.toLowerCase() : n) + q.rn;
  }

  // Base token used by the generator's transition tables ("V7/ii" → "VI", "ii7" → "ii").
  function baseToken(ch) {
    const fam = Q[harm(ch)].fam;
    const triad = fam === 'sus' || fam === 'pow' ? 'maj' : TRIAD_OF_FAMILY[fam];
    const n = ROMAN[ch.degree];
    const a = ch.alter < 0 ? 'b' : ch.alter > 0 ? '#' : '';
    if (triad === 'min') return a + n.toLowerCase();
    if (triad === 'dim') return a + n.toLowerCase() + '°';
    if (triad === 'aug') return a + n + '+';
    return a + n;
  }

  // Concrete notes in a key.
  function realize(ch, key) {
    const q = Q[ch.quality];
    let root = spell(key.tonic.letter + ch.degree, key.tonic.pc + ch.rootPc);
    root = simplify(root);
    const tones = q.iv.map((iv, k) => Object.assign(spell(root.letter + q.lt[k], root.pc + iv), { iv, label: q.lab[k], idx: k }));
    return { root, tones, q, pcs: tones.map((t) => t.pc) };
  }

  function triadPcs(ch, key) {
    const hq = harm(ch);
    const fam = Q[hq].fam;
    const ivs = fam === 'sus' || fam === 'pow' ? Q[hq].iv : Q[TRIAD_OF_FAMILY[fam]].iv;
    return ivs.map((i) => mod(key.tonic.pc + ch.rootPc + i, 12));
  }
  const isDiatonic = (ch, key) => triadPcs(ch, key).every((p) => key.pcs.has(p));

  C.theory = {
    LETTERS, SOLFEGE, MODES, ROMAN, MAJOR_STEPS, Q, TRIAD_OF_FAMILY, mod,
    spell, simplify, accText, noteName, tonicFor, makeKey, contextScales,
    parseRoman, chordOn, romanText, harm, baseToken, realize, triadPcs, isDiatonic, alterFor,
  };
})(typeof window !== 'undefined' ? (window.Cadence = window.Cadence || {}) : (globalThis.Cadence = globalThis.Cadence || {}));
