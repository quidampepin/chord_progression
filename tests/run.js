/* Cadence — music-theory regression tests.
 * Run from the chords folder:  node tests/run.js
 * Each case is a known progression with the answer a theory teacher would give.
 * If a change to the code breaks one of these, the test says which chord and what it got instead.
 */
'use strict';
const path = require('path');
for (const f of ['theory', 'generator', 'voicing', 'scales']) require(path.join(__dirname, '..', 'js', f + '.js'));
const { theory: T, gen: G, voicing: V, scales: S } = globalThis.Cadence;

let pass = 0, fail = 0;
function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++;
  else { fail++; console.log(`  ✗ ${name}\n      expected ${JSON.stringify(want)}\n      got      ${JSON.stringify(got)}`); }
}
const L = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const keyOf = (name, mode) => T.makeKey((PC[name[0]] + (name[1] === 'b' ? -1 : name[1] === '#' ? 1 : 0) + 12) % 12, mode);
const nm = (n) => T.noteName(n);

// [title, key, mode, style, [[numeral, expected scale id, (optional) expected avoid notes]]]
function suite(title, keyName, mode, style, rows) {
  console.log('• ' + title);
  const key = keyOf(keyName, mode);
  for (const [tok, want, avoid] of rows) {
    const ch = T.parseRoman(tok);
    const cs = S.chordScale(ch, key, style);
    check(`${title}: ${tok} → scale`, cs.options[0].id, want);
    if (avoid) {
      const sc = S.build(cs.options[0].id, cs.options[0].root);
      const got = S.avoidNotes(sc, ch, key).map((pc) => nm(sc.notes.find((n) => n.pc === pc)));
      check(`${title}: ${tok} → avoid notes`, got, avoid);
    }
  }
}

/* ---------- chord by chord ---------- */
suite('Diatonic chords in C major', 'C', 'major', 'jazz', [
  ['Imaj7', 'ionian', ['F']], ['ii7', 'dorian', []], ['iii7', 'phrygian', ['F', 'C']], ['IVmaj7', 'lydian', []],
  ['V7', 'mixolydian', ['C']], ['vi7', 'aeolian', ['F']], ['viiø7', 'locrian', ['C']],
]);
suite('Autumn Leaves (G minor)', 'G', 'minor', 'jazz', [
  ['iv7', 'dorian'], ['bVII7', 'mixolydian'], ['bIIImaj7', 'ionian'], ['bVImaj7', 'lydian'],
  ['iiø7', 'locrian'], ['V7', 'phrygianDom'], ['i6', 'melodicMinor'],
]);
suite('Secondary dominants and substitutes in C', 'C', 'major', 'jazz', [
  ['V7/ii', 'phrygianDom'], ['V7/vi', 'phrygianDom'], ['V7/V', 'mixolydian'], ['V7/IV', 'mixolydian'],
  ['bII7', 'lydianDom'], ['#iv°7', 'wholeHalf'],
]);
suite('12-bar blues in A', 'A', 'major', 'blues', [['I7', 'mixolydian'], ['IV7', 'mixolydian'], ['V7', 'mixolydian']]);
suite('“Creep” I–III–IV–iv in G', 'G', 'major', 'pop', [['I', 'ionian'], ['III', 'phrygianDom'], ['IV', 'lydian'], ['iv', 'dorian']]);
suite('Andalusian cadence in A minor', 'A', 'minor', 'flamenco', [['i', 'aeolian'], ['bVII', 'mixolydian'], ['bVI', 'lydian'], ['V', 'phrygianDom']]);
suite('Neapolitan in C minor', 'C', 'minor', 'cinematic', [['bII', 'lydian'], ['V7', 'phrygianDom']]);
suite('Mixolydian rock in D', 'D', 'mixolydian', 'rock', [['I', 'mixolydian'], ['bVII', 'lydian'], ['IV', 'ionian']]);
suite('Dorian vamp in E', 'E', 'dorian', 'funk', [['i7', 'dorian'], ['IV7', 'mixolydian']]);
suite('Borrowed chords in C major', 'C', 'major', 'pop', [['bVI', 'lydian'], ['bVII', 'mixolydian'], ['bIII', 'ionian']]);
suite('Phrygian metal in E', 'E', 'phrygian', 'metal', [['i', 'phrygian'], ['bII', 'lydian']]);

/* ---------- whole progression ---------- */
console.log('• Whole-progression scales');
{
  const k = keyOf('A', 'major');
  check('blues in A → A blues scale first', S.keyScale(k, 'blues', []).options[0].id, 'blues');
  const km = keyOf('C', 'minor');
  check('pop in C minor → natural minor first', S.keyScale(km, 'pop', []).options[0].id, 'aeolian');
  check('country in G → major pentatonic first', S.keyScale(keyOf('G', 'major'), 'country', []).options[0].id, 'majorPent');
  const prog = ['i', 'iv', 'V7', 'i'].map((t) => T.parseRoman(t));
  check('C natural minor clashes with V7 (B vs B♭)', S.clashes(S.build('aeolian', km.tonic), prog, km), [2]);
  check('C harmonic minor fits i–iv–V7–i', S.clashes(S.build('harmonicMinor', km.tonic), prog, km), []);
  const kc = keyOf('C', 'major');
  check('C major pentatonic over I–V–vi–IV: no clash', S.clashes(S.build('majorPent', kc.tonic), ['I', 'V', 'vi', 'IV'].map((t) => T.parseRoman(t)), kc), []);
  check('C major over ♭VII: clash (B vs B♭)', S.clashes(S.build('ionian', kc.tonic), [T.parseRoman('bVII')], kc), [0]);
}

/* ---------- spelling ---------- */
console.log('• Spelling');
{
  const d = S.chordScale(T.parseRoman('V7/ii'), keyOf('C', 'major'), 'jazz').options[0];
  check('A Phrygian dominant is spelled with B♭ and C♯', S.build(d.id, d.root).notes.map(nm), ['A', 'B♭', 'C♯', 'D', 'E', 'F', 'G']);
  check('F major scale uses B♭, not A♯', S.build('ionian', T.makeKey(5, 'major').tonic).notes.map(nm), ['F', 'G', 'A', 'B♭', 'C', 'D', 'E']);
}

/* ---------- positions ---------- */
console.log('• Positions on the neck');
{
  const std = V.TUNINGS.standard.midi;
  const am = S.build('minorPent', T.makeKey(9, 'minor').tonic);
  const boxes = S.positions(am, std, 'auto');
  check('A minor pentatonic has 5 boxes', boxes.length, 5);
  check('Box 1 sits at frets 5–8', [boxes[0].minF, boxes[0].maxF], [5, 8]);
  check('Every box has 2 notes per string', boxes.every((b) => [0, 1, 2, 3, 4, 5].every((s) => b.notes.filter((x) => x.s === s).length === 2)), true);
  const g = S.build('ionian', T.makeKey(7, 'major').tonic);
  const nps = S.positions(g, std, 'auto');
  check('G major has 7 three-notes-per-string positions', nps.length, 7);
  check('…each with 3 notes on every string', nps.every((p) => [0, 1, 2, 3, 4, 5].every((s) => p.notes.filter((x) => x.s === s).length === 3)), true);
  check('Ukulele positions exist', S.positions(S.build('ionian', T.makeKey(0, 'major').tonic), V.UKE_TUNINGS.ukeStd.midi, 'auto').length > 0, true);
}

/* ---------- harmonic function labels ---------- */
console.log('• Function labels');
{
  const f = (tok, mode, next) => { const i = G.fnInfo(T.parseRoman(tok), mode, next && T.parseRoman(next)); return [i.name, i.fn, i.weak]; };
  check('iv in minor = subdominant, predominant', f('iv', 'minor'), ['subdominant', 'PD', false]);
  check('V in minor = dominant', f('V', 'minor'), ['dominant', 'D', false]);
  check('♭VII → i = subtonic, modal dominant', f('bVII', 'minor', 'i'), ['subtonic', 'D', true]);
  check('♭VII → IV = subtonic acting as predominant', f('bVII', 'mixolydian', 'IV'), ['subtonic', 'PD', false]);
  check('♭II in Phrygian = modal dominant', f('bII', 'phrygian'), ['phrygianII', 'D', true]);
  check('♭II in minor = Neapolitan, predominant', f('bII', 'minor'), ['neapolitan', 'PD', false]);
}

/* ---------- licks ---------- */
console.log('• Licks');
{
  require(path.join(__dirname, '..', 'js', 'licks.js'));
  const LK = globalThis.Cadence.licks;
  const MODE_OF = { minorPent: 'minor', blues: 'minor', majorPent: 'major', majorBlues: 'major', mixolydian: 'mixolydian', dorian: 'dorian', aeolian: 'minor', harmonicMinor: 'minor', phrygianDom: 'phrygianDom', phrygian: 'phrygian', ionian: 'major' };
  const DEGS = { R: 0, '♭2': 1, '2': 2, '♭3': 3, '3': 4, '4': 5, '♭5': 6, '♯4': 6, '5': 7, '♯5': 8, '♭6': 8, '6': 9, '♭7': 10, '7': 11 };
  check('At least 70 licks', LK.LICKS.length >= 70, true);
  check('Lick ids are unique', new Set(LK.LICKS.map((l) => l.id)).size, LK.LICKS.length);
  for (const l of LK.LICKS) {
    const k = keyOf('A', MODE_OF[l.scale]);
    const sc = S.build(l.scale, k.tonic);
    const ok = new Set(l.chrom.map((c) => DEGS[c]));
    // every note belongs to the lick's scale, apart from its declared passing notes
    const outside = l.notes.filter((n) => !sc.pcs.has((9 + n.semi + 120) % 12) && !ok.has((n.semi + 120) % 12)).map((n) => n.semi);
    check(`${l.id}: notes stay in ${l.scale}`, outside, []);
    // whole bars, so the lick lines up with the progression
    const len = Math.max(...l.notes.map((n) => n.t + n.d));
    check(`${l.id}: fills whole bars`, Math.abs(len - Math.round(len)) < 0.02 && Math.round(len) <= l.bars * 4, true);
    // playable in its home position: frets in range, compact, bends not on open strings, double-stops on different strings
    const r = LK.realize(l, k, V.TUNINGS.standard.midi);
    const fr = r.notes.map((n) => n.f);
    check(`${l.id}: fingered in standard tuning`, r.notes.length === l.notes.length && Math.min(...fr) >= 0 && Math.max(...fr) <= 20, true);
    check(`${l.id}: fits a hand position (≤ 6 frets)`, Math.max(...fr) - Math.min(...fr) <= 6, true);
    check(`${l.id}: no bends on open strings`, r.notes.some((n) => n.f === 0 && n.tech.some((t) => ['b', 'hb', 'qb', 'r', 'si'].includes(t))), false);
    const clash = r.notes.some((n, i) => r.notes.some((o, j) => j !== i && o.t === n.t && o.s === n.s));
    check(`${l.id}: double-stops on separate strings`, clash, false);
    check(`${l.id}: home position holds every note`, r.fullFit[r.posIndex], true);
  }
  const kA = keyOf('A', 'minor'), kAM = keyOf('A', 'major');
  const byId = (id) => LK.LICKS.find((l) => l.id === id);
  check('Box 1 in A sits at frets 5–8', (() => { const f = LK.realize(byId('walk-down'), kA).notes.map((n) => n.f); return [Math.min(...f), Math.max(...f)]; })(), [5, 8]);
  check('Same lick in position 3 moves up the neck', Math.min(...LK.realize(byId('walk-down'), kA, null, 2).notes.map((n) => n.f)) > 8, true);
  check('Same lick in another position keeps the same pitches',
    LK.realize(byId('bend-five'), kA, null, 1).notes.map((n) => n.m % 12).join(), LK.realize(byId('bend-five'), kA, null, 0).notes.map((n) => n.m % 12).join());
  const blues = ['I7', 'I7', 'I7', 'I7', 'IV7', 'IV7', 'I7', 'I7', 'V7', 'IV7', 'I7', 'V7'].map((t) => Object.assign(T.parseRoman(t), { beats: 4 }));
  const at = (id) => LK.place(byId(id), blues).bar + 1;
  check('12-bar: “over the IV” lands in bar 5', at('over-iv'), 5);
  check('12-bar: “over the V” lands in bar 9', at('over-v'), 9);
  check('12-bar: the turnaround takes bars 11–12', at('turnaround'), 11);
  const iiVI = ['ii7', 'V7', 'Imaj7', 'Imaj7'].map((t) => Object.assign(T.parseRoman(t), { beats: 4 }));
  check('ii–V–I lick starts on the ii chord', LK.place(byId('jazz-guide'), iiVI).found && LK.place(byId('jazz-guide'), iiVI).bar, 0);
  check('Minor-pentatonic licks fit a blues in a major key', LK.fits(byId('bend-five'), kAM, 'blues'), true);
  check('Minor-pentatonic licks don’t claim to fit jazz in major', LK.fits(byId('bend-five'), kAM, 'jazz'), false);
  check('Dorian licks only for Dorian progressions', LK.fits(byId('dorian-6'), kA, 'funk'), false);
  check('Drop D only moves notes on the low string', LK.realize(byId('walk-down'), kA, V.TUNINGS.dropD.midi).notes.map((n) => n.s + ':' + n.f).join(' '), '5:8 5:5 4:8 4:5 3:7 3:5 2:7');
  check('Bad notation is reported', (() => { try { LK.parseLine('9:1'); return false; } catch (e) { return true; } })(), true);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
