/* Cadence — voicings.
 * Piano: candidate voicings per chord, then a shortest-path search (Viterbi)
 *        picks the sequence where the hands move least — classic voice leading.
 * Guitar: searches the fretboard (standard tuning) for every playable shape
 *        (≤4 fingers, ≤4-fret span, barres detected), ranks them, then picks a
 *        path that stays in one area of the neck.
 */
(function (C) {
  'use strict';
  const T = C.theory;
  const { mod } = T;

  /* ---------- piano ---------- */
  const UPPER_LO = 52, UPPER_HI = 81, BASS_LO = 36, BASS_HI = 52;

  // Which chord tones go in the right hand. Big chords drop the 5th (and the root, played by the bass).
  function upperTones(r) {
    let t = r.tones.slice();
    if (t.length >= 5) t = t.filter((x) => x.label !== '5');
    if (t.length >= 5) t = t.filter((x) => x.label !== 'R');
    return t;
  }
  function closeCandidates(pcs) {
    const out = [];
    for (let rot = 0; rot < pcs.length; rot++) {
      const order = pcs.slice(rot).concat(pcs.slice(0, rot));
      for (let start = UPPER_LO; start < UPPER_LO + 12; start++) {
        if (mod(start, 12) !== order[0]) continue;
        const notes = [start];
        for (let k = 1; k < order.length; k++) {
          let n = notes[k - 1] + 1;
          while (mod(n, 12) !== order[k]) n++;
          notes.push(n);
        }
        for (const shift of [0, 12]) {
          const v = notes.map((n) => n + shift);
          if (v[v.length - 1] <= UPPER_HI && v[0] >= UPPER_LO) out.push(v);
        }
      }
    }
    return out;
  }
  function styleVoicing(v, style) {
    if (style === 'drop2' && v.length >= 3) {
      const d = v.slice();
      const i = d.length - 2;
      d[i] -= 12;
      return d.sort((a, b) => a - b);
    }
    return v;
  }
  function shellCandidates(r) {
    const find = (labs) => r.tones.find((t) => labs.includes(t.label));
    const third = find(['3', '♭3', '4', '2']);
    const seventh = find(['♭7', '7', '°7', '6']) || find(['5', '♭5', '♯5']);
    const ext = find(['13', '9', '♭9', '11']);
    const pcs = [third, seventh].filter(Boolean).map((t) => t.pc);
    const out = [];
    if (pcs.length < 2 || pcs[0] === pcs[1]) return out;
    for (let a = UPPER_LO - 4; a < UPPER_LO + 10; a++) {
      if (mod(a, 12) !== pcs[0] && mod(a, 12) !== pcs[1]) continue;
      const other = mod(a, 12) === pcs[0] ? pcs[1] : pcs[0];
      let b = a + 1;
      while (mod(b, 12) !== other) b++;
      const v = [a, b];
      if (ext) { let e = b + 1; while (mod(e, 12) !== ext.pc) e++; v.push(e); }
      out.push(v);
    }
    return out;
  }
  function bassOptions(r, smooth) {
    const opts = [{ pc: r.root.pc, cost: 0, inv: null }];
    if (smooth) {
      const third = r.tones.find((t) => ['3', '♭3'].includes(t.label));
      const fifth = r.tones.find((t) => t.label === '5');
      const sev = r.tones.find((t) => t.label === '♭7');
      if (third) opts.push({ pc: third.pc, cost: 2.6, inv: third });
      if (fifth && r.tones.length === 3) opts.push({ pc: fifth.pc, cost: 6, inv: fifth });
      if (sev) opts.push({ pc: sev.pc, cost: 4, inv: sev });
    }
    const out = [];
    for (const o of opts) for (let m = BASS_LO; m <= BASS_HI; m++) if (mod(m, 12) === o.pc) out.push(Object.assign({ midi: m }, o));
    return out;
  }
  function motion(a, b) {
    // Distance between two sets of notes: each note travels to the nearest note of the other chord.
    let s = 0;
    for (const x of a) s += Math.min(...b.map((y) => Math.abs(x - y)));
    for (const y of b) s += Math.min(...a.map((x) => Math.abs(x - y)));
    return s / 2;
  }

  function pianoVoicings(realized, opts) {
    const style = opts.style || 'close';
    const states = realized.map((r) => {
      const up = upperTones(r).map((t) => t.pc);
      let uppers = style === 'shell' ? shellCandidates(r) : closeCandidates(up).map((v) => styleVoicing(v, style));
      if (!uppers.length) uppers = closeCandidates(r.pcs);
      const basses = bassOptions(r, opts.smoothBass);
      const st = [];
      for (const u of uppers) for (const b of basses) {
        if (u[0] - b.midi < 3) continue;
        const avg = u.reduce((s, x) => s + x, 0) / u.length;
        let cost = b.cost + Math.abs(avg - 66) * 0.12 + Math.abs(b.midi - 43) * 0.05;
        if (u[0] < 55 && u[0] - b.midi < 7) cost += 2; // muddy low interval
        if (b.inv && u.some((n) => mod(n, 12) === b.pc)) cost += 0.8; // doubling the bass of an inversion
        st.push({ upper: u, bass: b, cost });
      }
      return st;
    });
    // Viterbi
    const n = states.length;
    const best = states.map((s) => s.map(() => Infinity));
    const back = states.map((s) => s.map(() => -1));
    states[0].forEach((s, j) => (best[0][j] = s.cost));
    for (let i = 1; i < n; i++) {
      states[i].forEach((s, j) => {
        states[i - 1].forEach((p, k) => {
          const bassMove = Math.abs(s.bass.midi - p.bass.midi);
          const c = best[i - 1][k] + s.cost + motion(p.upper, s.upper) * 0.55 + (bassMove > 7 ? (bassMove - 7) * 0.6 : 0) + (s.bass.inv ? 0 : 0) + (bassMove <= 2 && bassMove > 0 ? -0.6 : 0);
          if (c < best[i][j]) { best[i][j] = c; back[i][j] = k; }
        });
      });
    }
    let j = best[n - 1].indexOf(Math.min(...best[n - 1]));
    const path = [];
    for (let i = n - 1; i >= 0; i--) { path.unshift(states[i][j]); j = back[i][j]; }
    return path.map((s) => ({ bass: s.bass.midi, bassPc: s.bass.pc, inversion: s.bass.inv, upper: s.upper, notes: [s.bass.midi].concat(s.upper) }));
  }

  /* ---------- guitar ---------- */
  // Open-string pitches, lowest string first (MIDI numbers).
  const TUNINGS = {
    standard:   { midi: [40, 45, 50, 55, 59, 64], names: ['E', 'A', 'D', 'G', 'B', 'E'] },
    halfDown:   { midi: [39, 44, 49, 54, 58, 63], names: ['E♭', 'A♭', 'D♭', 'G♭', 'B♭', 'E♭'] },
    dStandard:  { midi: [38, 43, 48, 53, 57, 62], names: ['D', 'G', 'C', 'F', 'A', 'D'] },
    dropD:      { midi: [38, 45, 50, 55, 59, 64], names: ['D', 'A', 'D', 'G', 'B', 'E'] },
    dropC:      { midi: [36, 43, 48, 53, 57, 62], names: ['C', 'G', 'C', 'F', 'A', 'D'] },
    dropB:      { midi: [35, 42, 47, 52, 56, 61], names: ['B', 'F♯', 'B', 'E', 'G♯', 'C♯'] },
    openG:      { midi: [38, 43, 50, 55, 59, 62], names: ['D', 'G', 'D', 'G', 'B', 'D'] },
    openD:      { midi: [38, 45, 50, 54, 57, 62], names: ['D', 'A', 'D', 'F♯', 'A', 'D'] },
    openE:      { midi: [40, 47, 52, 56, 59, 64], names: ['E', 'B', 'E', 'G♯', 'B', 'E'] },
    openC:      { midi: [36, 43, 48, 55, 60, 64], names: ['C', 'G', 'C', 'G', 'C', 'E'] },
    dadgad:     { midi: [38, 45, 50, 55, 57, 62], names: ['D', 'A', 'D', 'G', 'A', 'D'] },
    sevenStd:   { midi: [35, 40, 45, 50, 55, 59, 64], names: ['B', 'E', 'A', 'D', 'G', 'B', 'E'] },
    sevenDropA: { midi: [33, 40, 45, 50, 55, 59, 64], names: ['A', 'E', 'A', 'D', 'G', 'B', 'E'] },
  };
  const TUNING = TUNINGS.standard.midi;
  // Ukuleles: chords are read on all four strings and the lowest string isn't a bass, so no root-in-bass rule.
  const UKE_TUNINGS = {
    ukeStd:  { midi: [67, 60, 64, 69], names: ['G', 'C', 'E', 'A'] },   // re-entrant: high G
    ukeLowG: { midi: [55, 60, 64, 69], names: ['G', 'C', 'E', 'A'] },
    ukeD:    { midi: [69, 62, 66, 71], names: ['A', 'D', 'F♯', 'B'] },
    ukeBari: { midi: [50, 55, 59, 64], names: ['D', 'G', 'B', 'E'] },
  };

  function guitarShapes(r, bassPc, limit, tuning, opts) {
    const TUN = tuning || TUNING;
    const N = TUN.length;
    const free = !!(opts && opts.bassFree);
    const extra = N - 6; // extra low strings (7-string guitars)
    const pow = r.q.fam === 'pow';
    const minStrings = pow ? 2 : Math.min(4, N);
    const pcs = new Set(r.pcs);
    const essential = new Set(r.q.ess.map((i) => r.tones[i].pc));
    const thirdPc = (r.tones.find((t) => ['3', '♭3'].includes(t.label)) || {}).pc;
    const seen = new Map();
    for (let s = 1; s <= 12; s++) {
      const choices = TUN.map((open) => {
        const c = [-1];
        if (pcs.has(mod(open, 12))) c.push(0);
        for (let f = s; f <= s + 3; f++) if (pcs.has(mod(open + f, 12))) c.push(f);
        return c;
      });
      const frets = new Array(N);
      const evaluate = (fr) => {
        const sounding = fr.map((f, i) => (f >= 0 ? i : -1)).filter((i) => i >= 0);
        if (sounding.length < minStrings) return;
        if (pow && !free && sounding.length > 3) return;
        const lo = sounding[0], hi = sounding[sounding.length - 1];
        if (!free && mod(TUN[lo] + fr[lo], 12) !== bassPc) return;
        // mutes: strings below the bass are fine; at most one gap inside (none for power chords)
        let gaps = 0;
        for (let i = lo; i <= hi; i++) if (fr[i] < 0) gaps++;
        if (gaps > (pow ? 0 : 1)) return;
        const notes = sounding.map((i) => mod(TUN[i] + fr[i], 12));
        for (const e of essential) if (!notes.includes(e)) return;
        const fretted = sounding.filter((i) => fr[i] > 0);
        const fv = fretted.map((i) => fr[i]);
        const minF = fv.length ? Math.min(...fv) : 0;
        const maxF = fv.length ? Math.max(...fv) : 0;
        if (maxF - minF > 3) return;
        // fingers: one finger may barre several strings at the same fret
        let barre = null, saving = 0;
        for (const f of new Set(fv)) {
          for (let a = 0; a < N; a++) {
            if (fr[a] !== f) continue;
            let count = 0, last = a;
            for (let b = a; b < N && fr[b] >= f; b++) if (fr[b] === f) { count++; last = b; }
            if (count - 1 > saving || (count - 1 === saving && saving > 0 && f < barre.fret)) { saving = count - 1; barre = { fret: f, from: a, to: last, count }; }
          }
        }
        const fingers = fretted.length - saving;
        // Only draw a barre when it's really played as one: 3+ strings, or more notes than free fingers.
        if (barre && (barre.to - barre.from < 1 || (barre.count < 3 && fretted.length <= 4))) barre = null;
        if (fingers > 4) return;
        const opens = sounding.filter((i) => fr[i] === 0).length;
        if (opens && minF > 5) return; // open strings far up the neck: rarely practical
        const loAdj = lo - extra; // position of the bass string as if on a 6-string
        let score = 0;
        if (pow) {
          // Power chords: root on a low string, root–5th–octave, one or two fingers.
          score += minF * 0.12 + fingers * 0.25 - opens * 0.4;
          if (sounding.length === 2) score += 0.5;
          if (!free && loAdj >= 2) score += (loAdj - 1) * 0.9;
          if (notes[0] !== notes[notes.length - 1] && sounding.length === 3) score += 0.6;
        } else {
          score += minF * 0.32;
          score += maxF <= 3 ? -opens * 0.7 : opens * 0.25;
          score += Math.max(0, 6 - sounding.length) * 0.75;
          score += gaps * 2.5;
          score += fingers * 0.3;
          if (maxF - minF === 3) score += 0.9;
          if (fr[N - 1] < 0) score += 1.2;
          if (!free && loAdj === 2) score += 0.6;
          if (!free && loAdj >= 3) score += 2.5;
          const missing = r.pcs.filter((p) => !notes.includes(p)).length;
          score += missing * 0.45;
          const thirds = notes.filter((p) => p === thirdPc).length;
          if (thirds > 1) score += 0.3 * (thirds - 1);
          for (let i = 0; i < N; i++) {
            if (fr[i] !== 0) continue;
            const below = fr.slice(0, i).some((f) => f === minF && f > 0), above = fr.slice(i + 1).some((f) => f === minF && f > 0);
            if (below && above) score += 1.2; // open string trapped under what wants to be a barre
          }
          const roots = notes.filter((p) => p === r.root.pc).length;
          if (roots > 2) score += 0.6 * (roots - 2);
        }
        const key = fr.join(',');
        if (!seen.has(key) || seen.get(key).score > score) {
          const midi = sounding.map((i) => TUN[i] + fr[i]);
          seen.set(key, { frets: fr, score, barre, fingers, minF, maxF, midi, opens, tuning: TUN });
        }
      };
      const rec = (k, started) => {
        if (k === N) { evaluate(frets.slice()); return; }
        if (!started && k > N - minStrings) return; // not enough strings would remain
        for (const f of choices[k]) {
          if (!free && !started && f >= 0 && mod(TUN[k] + f, 12) !== bassPc) continue;
          frets[k] = f;
          rec(k + 1, started || f >= 0);
        }
      };
      rec(0, false);
    }
    return [...seen.values()].sort((a, b) => a.score - b.score).slice(0, limit || 8);
  }

  function guitarVoicings(realized, piano, tuning, opts) {
    const lists = realized.map((r, i) => {
      const bassPc = piano && piano[i] ? piano[i].bassPc : r.root.pc;
      let l = guitarShapes(r, bassPc, 8, tuning, opts);
      if (!l.length && bassPc !== r.root.pc) l = guitarShapes(r, r.root.pc, 8, tuning, opts);
      // Too many notes for the strings (e.g. a 5-note chord on ukulele): keep root, 3rd and 7th.
      if (!l.length) l = guitarShapes(Object.assign({}, r, { q: Object.assign({}, r.q, { ess: r.q.ess.slice(0, 3) }) }), r.root.pc, 8, tuning, opts);
      if (!l.length) l = guitarShapes(Object.assign({}, r, { q: Object.assign({}, r.q, { ess: [0, 1] }) }), r.root.pc, 8, tuning, opts);
      return l;
    });
    // Stay in one area of the neck: penalise jumps between shape centres.
    const center = (s) => (s.minF === 0 && s.maxF <= 3 ? 1.5 : (s.minF + s.maxF) / 2);
    const n = lists.length;
    const best = lists.map((l) => l.map(() => Infinity));
    const back = lists.map((l) => l.map(() => -1));
    lists[0].forEach((s, j) => (best[0][j] = s.score));
    for (let i = 1; i < n; i++) lists[i].forEach((s, j) => lists[i - 1].forEach((p, k) => {
      const c = best[i - 1][k] + s.score + Math.abs(center(s) - center(p)) * 0.3;
      if (c < best[i][j]) { best[i][j] = c; back[i][j] = k; }
    }));
    const pickIdx = new Array(n).fill(0);
    if (n && lists[n - 1].length) {
      let j = best[n - 1].indexOf(Math.min(...best[n - 1]));
      for (let i = n - 1; i >= 0; i--) { pickIdx[i] = Math.max(0, j); j = j >= 0 ? back[i][j] : -1; }
    }
    return lists.map((l, i) => ({ shapes: l, chosen: pickIdx[i] }));
  }

  C.voicing = { pianoVoicings, guitarShapes, guitarVoicings, TUNING, TUNINGS, UKE_TUNINGS };
})(typeof window !== 'undefined' ? (window.Cadence = window.Cadence || {}) : (globalThis.Cadence = globalThis.Cadence || {}));
