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
  const TUNING = [40, 45, 50, 55, 59, 64]; // E A D G B E

  function guitarShapes(r, bassPc, limit) {
    const pcs = new Set(r.pcs);
    const essential = new Set(r.q.ess.map((i) => r.tones[i].pc));
    const thirdPc = (r.tones.find((t) => ['3', '♭3'].includes(t.label)) || {}).pc;
    const seen = new Map();
    for (let s = 1; s <= 12; s++) {
      const choices = TUNING.map((open) => {
        const c = [-1];
        if (pcs.has(mod(open, 12))) c.push(0);
        for (let f = s; f <= s + 3; f++) if (pcs.has(mod(open + f, 12))) c.push(f);
        return c;
      });
      const frets = new Array(6);
      const rec = (k, started) => {
        if (k === 6) { evaluate(frets.slice()); return; }
        if (!started && k > 2) return; // fewer than 4 strings would remain
        for (const f of choices[k]) {
          if (!started && f >= 0 && mod(TUNING[k] + f, 12) !== bassPc) continue;
          frets[k] = f;
          rec(k + 1, started || f >= 0);
        }
      };
      const evaluate = (fr) => {
        const sounding = fr.map((f, i) => (f >= 0 ? i : -1)).filter((i) => i >= 0);
        if (sounding.length < 4) return;
        const lo = sounding[0];
        if (mod(TUNING[lo] + fr[lo], 12) !== bassPc) return;
        // mutes: low strings below the bass are fine; at most one gap inside; top string may be muted
        let gaps = 0;
        for (let i = lo; i <= sounding[sounding.length - 1]; i++) if (fr[i] < 0) gaps++;
        if (gaps > 1) return;
        const notes = sounding.map((i) => mod(TUNING[i] + fr[i], 12));
        for (const e of essential) if (!notes.includes(e)) return;
        const fretted = sounding.filter((i) => fr[i] > 0);
        const fv = fretted.map((i) => fr[i]);
        const minF = fv.length ? Math.min(...fv) : 0;
        const maxF = fv.length ? Math.max(...fv) : 0;
        if (maxF - minF > 3) return;
        // fingers: one finger may barre several strings at the same fret
        let barre = null, saving = 0;
        for (const f of new Set(fv)) {
          for (let a = 0; a < 6; a++) {
            if (fr[a] !== f) continue;
            let count = 0, last = a;
            for (let b = a; b < 6 && fr[b] >= f; b++) if (fr[b] === f) { count++; last = b; }
            if (count - 1 > saving || (count - 1 === saving && saving > 0 && f < barre.fret)) { saving = count - 1; barre = { fret: f, from: a, to: last }; }
          }
        }
        const fingers = fretted.length - saving;
        if (barre && barre.to - barre.from < 1) barre = null;
        if (fingers > 4) return;
        const opens = sounding.filter((i) => fr[i] === 0).length;
        if (opens && minF > 5) return; // open strings far up the neck: rarely practical
        let score = 0;
        score += minF * 0.32;
        score += maxF <= 3 ? -opens * 0.7 : opens * 0.25;
        score += (6 - sounding.length) * 0.75;
        score += gaps * 2.5;
        score += fingers * 0.3;
        if (maxF - minF === 3) score += 0.9;
        if (fr[5] < 0) score += 1.2;
        if (lo === 2) score += 0.6;
        if (lo >= 3) score += 2.5;
        const missing = r.pcs.filter((p) => !notes.includes(p)).length;
        score += missing * 0.45;
        const thirds = notes.filter((p) => p === thirdPc).length;
        if (thirds > 1) score += 0.3 * (thirds - 1);
        for (let i = 0; i < 6; i++) {
          if (fr[i] !== 0) continue;
          const below = fr.slice(0, i).some((f) => f === minF && f > 0), above = fr.slice(i + 1).some((f) => f === minF && f > 0);
          if (below && above) score += 1.2; // open string trapped under what wants to be a barre
        }
        const roots = notes.filter((p) => p === r.root.pc).length;
        if (roots > 2) score += 0.6 * (roots - 2);
        const key = fr.join(',');
        if (!seen.has(key) || seen.get(key).score > score) {
          const midi = sounding.map((i) => TUNING[i] + fr[i]);
          seen.set(key, { frets: fr, score, barre, fingers, minF, maxF, midi, opens });
        }
      };
      rec(0, false);
    }
    return [...seen.values()].sort((a, b) => a.score - b.score).slice(0, limit || 8);
  }

  function guitarVoicings(realized, piano) {
    const lists = realized.map((r, i) => {
      const bassPc = piano && piano[i] ? piano[i].bassPc : r.root.pc;
      let l = guitarShapes(r, bassPc, 8);
      if (!l.length && bassPc !== r.root.pc) l = guitarShapes(r, r.root.pc, 8);
      if (!l.length) l = guitarShapes(Object.assign({}, r, { q: Object.assign({}, r.q, { ess: [0, 1] }) }), r.root.pc, 8);
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
      for (let i = n - 1; i >= 0; i--) { pickIdx[i] = Math.max(0, j); j = back[i][j]; }
    }
    return lists.map((l, i) => ({ shapes: l, chosen: pickIdx[i] }));
  }

  C.voicing = { pianoVoicings, guitarShapes, guitarVoicings, TUNING };
})(typeof window !== 'undefined' ? (window.Cadence = window.Cadence || {}) : (globalThis.Cadence = globalThis.Cadence || {}));
