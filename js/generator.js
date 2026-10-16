/* Cadence — progression generator.
 *
 * Two sources, mixed by the "Familiar ↔ Adventurous" slider:
 *   1. A library of proven progressions (templates), per style and mode.
 *   2. A functional-harmony walk: weighted transitions between chords
 *      (tonic → predominant → dominant → tonic), sampled hundreds of times,
 *      scored for good voice-leading habits, and the best few kept.
 * Then three "re-harmonisation" passes (secondary dominants, tritone subs,
 * modal mixture) and a colour pass (triads → 7ths → extensions) that only
 * adds notes that belong to the chord's key context.
 */
(function (C) {
  'use strict';
  const T = C.theory;
  const { Q, mod } = T;

  /* ---------- seeded randomness ---------- */
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function pick(r, entries) {
    let total = 0;
    for (const [, w] of entries) total += Math.max(0, w);
    if (total <= 0) return entries.length ? entries[0][0] : null;
    let x = r() * total;
    for (const [item, w] of entries) { x -= Math.max(0, w); if (x <= 0) return item; }
    return entries[entries.length - 1][0];
  }

  function hashSeed(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  /* ---------- transition tables (relative weights) ---------- */
  const MATRIX = {
    major: {
      I:     { IV: 3, V: 2.5, vi: 3, ii: 1.5, iii: 0.5 },
      ii:    { V: 5, IV: 0.8, vi: 0.4, 'vii°': 0.5 },
      iii:   { vi: 3, IV: 3, ii: 1 },
      IV:    { I: 3, V: 3, ii: 1, vi: 1.5 },
      V:     { I: 5, vi: 2.5, IV: 1.2 },
      vi:    { IV: 3.5, ii: 2.5, V: 1.5, iii: 0.5, I: 0.5 },
      'vii°': { I: 4, iii: 0.5 },
    },
    minor: {
      i:     { iv: 3, bVI: 3, bVII: 2.5, bIII: 2, v: 1, V: 1.5, 'ii°': 0.8 },
      'ii°': { V: 5, i: 0.3 },
      bIII:  { bVI: 2.5, bVII: 2.5, iv: 2, i: 1 },
      iv:    { i: 2.5, V: 3, bVII: 2.5, bVI: 1, v: 1 },
      v:     { i: 2, bVI: 2, iv: 1.5 },
      V:     { i: 5, bVI: 2 },
      bVI:   { bVII: 3.5, bIII: 2, iv: 1.5, V: 2, i: 1.5, 'ii°': 0.6 },
      bVII:  { i: 3, bIII: 3, bVI: 1.5, iv: 1, V: 0.5 },
    },
    dorian: {
      i:    { IV: 4, bVII: 3, bIII: 2, ii: 1.5, v: 1 },
      ii:   { i: 1, bIII: 2, IV: 1.5, v: 1 },
      bIII: { IV: 3, bVII: 2, i: 1.5 },
      IV:   { i: 4, bVII: 2, bIII: 1.5, v: 1 },
      v:    { i: 2.5, IV: 1.5, bVII: 1 },
      bVII: { i: 3.5, IV: 2.5, bIII: 1 },
    },
    mixolydian: {
      I:    { bVII: 4, IV: 3, v: 2, ii: 1, vi: 1 },
      ii:   { I: 1, IV: 1, bVII: 1.5, v: 1 },
      IV:   { I: 3.5, bVII: 2, v: 1 },
      v:    { I: 2, IV: 2.5, bVII: 1, vi: 1 },
      vi:   { IV: 2, bVII: 2, v: 1.5, ii: 1 },
      bVII: { I: 3.5, IV: 3, v: 1 },
    },
    phrygian: {
      i:    { bII: 4, bIII: 2, iv: 1.5, bVI: 2, bvii: 2 },
      bII:  { i: 5, bIII: 1.5, bvii: 0.6 },
      bIII: { bII: 3, iv: 1.5, i: 1.5, bVI: 1 },
      iv:   { bII: 1.5, i: 2.5, bvii: 1.5, bIII: 1 },
      bVI:  { bvii: 2.5, bII: 2, i: 2 },
      bvii: { i: 3.5, bII: 1.5, bVI: 1 },
    },
    phrygianDom: {
      I:    { bII: 4, iv: 2, bvii: 2 },
      bII:  { I: 5, bvii: 1 },
      iv:   { bII: 2, I: 2.5, bvii: 1 },
      bvii: { bII: 2.5, I: 3, iv: 1 },
    },
    lydian: {
      I:   { II: 4, vi: 1.5, V: 1.5, vii: 0.8 },
      II:  { I: 4, V: 1.5, vi: 1 },
      iii: { II: 1.5, vi: 1.5 },
      V:   { I: 3, II: 1.5, vi: 1 },
      vi:  { II: 2, V: 1.5, I: 1 },
      vii: { I: 3, II: 1.2, iii: 0.6 },
    },
  };
  // Chords borrowed from outside the mode — only unlocked as "adventure" rises.
  const BORROW = {
    major: {
      I:    { bVII: 0.8, bVI: 0.6, iv: 0.4 },
      IV:   { iv: 1.2, bVII: 0.5 },
      vi:   { bVI: 0.3 },
      iv:   { I: 4, V: 1 },
      bVII: { I: 3, IV: 2 },
      bVI:  { bVII: 3, V: 1.5, I: 1 },
      V:    { bVI: 0.6 },
    },
    minor: {
      i:   { IV: 0.5, bII: 0.4 },
      iv:  { bII: 0.5 },
      bII: { V: 4, i: 1 },
      IV:  { i: 2, bVII: 1.5 },
    },
    dorian: { i: { bVI: 0.5 }, bVI: { bVII: 3, i: 1 } },
    mixolydian: { I: { iv: 0.6, bVI: 0.4 }, iv: { I: 3 }, bVI: { bVII: 3, I: 1 } },
    phrygian: { i: { V: 0.3 }, V: { i: 4 } },
    phrygianDom: { iv: { bIII: 2 }, bIII: { bII: 4 }, I: { bIII: 0.4 } },
    lydian: { I: { iv: 0.3 }, iv: { I: 3 } },
  };
  const START = {
    major: { I: 6, vi: 1.5, IV: 1.5, ii: 0.6 },
    minor: { i: 6, bVI: 1.2, iv: 0.8 },
    dorian: { i: 6, IV: 0.8 },
    mixolydian: { I: 6, bVII: 0.6 },
    phrygian: { i: 6, bII: 0.5 },
    phrygianDom: { I: 6, iv: 0.8 },
    lydian: { I: 6 },
  };
  const TONIC = { major: 'I', minor: 'i', dorian: 'i', mixolydian: 'I', phrygian: 'i', phrygianDom: 'I', lydian: 'I' };
  const CADENCES = {
    major: [['V', 'I'], ['IV', 'V', 'I'], ['ii', 'V', 'I']],
    minor: [['V', 'i'], ['iv', 'V', 'i'], ['bVI', 'bVII', 'i']],
    dorian: [['bVII', 'i'], ['IV', 'bVII', 'i']],
    mixolydian: [['bVII', 'I'], ['IV', 'bVII', 'I']],
    phrygian: [['bII', 'i'], ['bvii', 'i'], ['iv', 'bII', 'i']],
    phrygianDom: [['bII', 'I'], ['iv', 'bII', 'I']],
    lydian: [['II', 'I'], ['V', 'I'], ['vi', 'II', 'I']],
  };

  /* ---------- styles ----------
   * t: templates. p = bars separated by "|", chords in a bar by spaces.
   * adv = how adventurous the template is (0 classic … 1 colourful).
   */
  const DEF_COLOR = {
    1: { maj: ['maj7', 'maj6'], min: ['min7'], dom: ['dom7'], hdim: ['m7b5'], dim: ['m7b5'], dim7: ['dim7'], aug: ['aug'] },
    2: { maj: ['maj9', 'maj69', 'maj7', 'maj6'], min: ['min9', 'min7'], dom: ['dom9', 'dom13', 'dom7b9', 'dom7'], hdim: ['m7b5'], dim: ['m7b5'], dim7: ['dim7'], aug: ['aug'] },
  };
  const tpl = (p, en, fr, m, adv) => ({ p, n: { en, fr }, m, adv: adv == null ? 0.2 : adv });

  const STYLES = {
    pop: {
      modes: ['major', 'minor', 'mixolydian', 'dorian'], lengths: [4, 8], defColor: 0, tempo: 100,
      boost: { vi: 1.3, IV: 1.3, V: 1.2, iii: 0.6, bVI: 1.2, bVII: 1.2 },
      passes: { sec: 0.15, tri: 0, mix: 0.25 },
      color: { 1: { maj: ['maj7', 'add9'] }, 2: { maj: ['add9', 'maj7', 'maj9', 'sus2'], min: ['madd9', 'min7'], dom: ['dom7sus4', 'dom7'] } },
      t: [
        tpl('I | V | vi | IV', 'Axis progression', 'Progression « axe »', 'major', 0),
        tpl('vi | IV | I | V', 'Axis, minor rotation', 'Axe, rotation mineure', 'major', 0.1),
        tpl('I | vi | IV | V', '’50s doo-wop', 'Doo-wop des années 50', 'major', 0),
        tpl('I | IV | vi | V', 'Pop four-chord', 'Quatre accords pop', 'major', 0.1),
        tpl('IV | I | V | vi', 'Axis, starting on IV', 'Axe, départ sur IV', 'major', 0.2),
        tpl('I | iii | IV | V', 'Rising pop', 'Montée pop', 'major', 0.3),
        tpl('I | vi | ii | V', 'Classic turnaround', 'Turnaround classique', 'major', 0.2),
        tpl('IV | V | iii | vi', 'Royal Road (J-pop)', 'Royal Road (J-pop)', 'major', 0.5),
        tpl('I | V | vi | iii | IV | I | IV | V', 'Pachelbel’s Canon', 'Canon de Pachelbel', 'major', 0.3),
        tpl('I | IV | iv | I', 'Minor plagal', 'Plagale mineure', 'major', 0.7),
        tpl('I | % | IV | %', 'Two-chord vamp', 'Vamp à deux accords', 'major', 0.1),
        tpl('I | V | vi | IV V', 'Axis with a push', 'Axe avec relance', 'major', 0.3),
        tpl('vi | % | IV | I V', 'Slow-build verse', 'Couplet en montée', 'major', 0.3),
        tpl('I | V | vi | %', 'Three-chord ballad', 'Ballade à trois accords', 'major', 0.2),
        tpl('i | bVI | bIII | bVII', 'Minor axis', 'Axe mineur', 'minor', 0),
        tpl('i | bVII | bVI | bVII', 'Aeolian loop', 'Boucle éolienne', 'minor', 0.1),
        tpl('i | iv | bVI | V', 'Minor lift', 'Élan mineur', 'minor', 0.3),
        tpl('i | bIII | bVII | iv', 'Minor ballad', 'Ballade mineure', 'minor', 0.3),
        tpl('I | bVII | IV | I', 'Mixolydian loop', 'Boucle mixolydienne', 'mixolydian', 0.2),
        tpl('i | IV | i | IV', 'Dorian vamp', 'Vamp dorien', 'dorian', 0.2),
      ],
    },
    rock: {
      modes: ['major', 'minor', 'mixolydian', 'dorian'], lengths: [4, 8], defColor: 0, tempo: 118,
      boost: { bVII: 2, IV: 1.5, bVI: 1.5, bIII: 1.3, ii: 0.5, iii: 0.5, 'vii°': 0.1, 'ii°': 0.2 },
      passes: { sec: 0.05, tri: 0, mix: 0.2 },
      color: { 1: { maj: ['sus2', 'add9', 'maj6'], min: ['min7'], dom: ['dom7'] }, 2: { maj: ['add9', 'sus2', 'sus4', 'maj6'], min: ['madd9', 'min7'], dom: ['dom7sus4', 'dom7'] } },
      t: [
        tpl('I | bVII | IV | I', 'Mixolydian rock', 'Rock mixolydien', 'major', 0.3),
        tpl('I | IV | V | IV', 'Garage rock', 'Rock garage', 'major', 0),
        tpl('I | V | IV | I', 'Bar-band classic', 'Classique de bar', 'major', 0),
        tpl('I | bIII | IV | I', 'Borrowed ♭III', '♭III emprunté', 'major', 0.6),
        tpl('I | bVI | bVII | I', '“Mario” cadence', 'Cadence « Mario »', 'major', 0.6),
        tpl('I | IV | I | V', 'Three-chord rock', 'Rock à trois accords', 'major', 0),
        tpl('I | % | bVII IV | I', 'Riff rock turnaround', 'Turnaround rock à riff', 'major', 0.4),
        tpl('I | % | IV | %', 'Two-chord stomp', 'Stomp à deux accords', 'major', 0),
        tpl('i | % | bVI bVII | i', 'Minor riff', 'Riff mineur', 'minor', 0.2),
        tpl('i | bVII | bVI | bVII', 'Aeolian vamp', 'Vamp éolien', 'minor', 0.1),
        tpl('i | bVII | bVI | V', 'Andalusian cadence', 'Cadence andalouse', 'minor', 0.3),
        tpl('i | bIII | bVII | IV', 'Dorian-tinged rock', 'Rock teinté dorien', 'minor', 0.6),
        tpl('i | bVI | bIII | bVII', 'Minor anthem', 'Hymne mineur', 'minor', 0.2),
        tpl('I | bVII | IV | I', 'Mixolydian riff', 'Riff mixolydien', 'mixolydian', 0.1),
        tpl('I | v | bVII | IV', 'Mixolydian descent', 'Descente mixolydienne', 'mixolydian', 0.5),
        tpl('i | IV | i | IV', 'Dorian groove', 'Groove dorien', 'dorian', 0.1),
        tpl('i | bVII | IV | i', 'Dorian rock', 'Rock dorien', 'dorian', 0.4),
      ],
    },
    jazz: {
      modes: ['major', 'minor'], lengths: [4, 8], defColor: 2, tempo: 132,
      boost: { ii: 2, V: 1.5, vi: 1.3, iii: 1.3, IV: 0.8, bVII: 0.6 },
      passes: { sec: 0.55, tri: 0.5, mix: 0.15 },
      color: { 2: { maj: ['maj69', 'maj9', 'maj7'], min: ['min9', 'min11', 'min7'], dom: ['dom13', 'dom9', 'dom7b9'] } },
      t: [
        tpl('ii7 | V7 | Imaj7 | Imaj7', 'ii–V–I', 'ii–V–I', 'major', 0),
        tpl('Imaj7 | vi7 | ii7 | V7', 'I–vi–ii–V', 'I–vi–ii–V', 'major', 0),
        tpl('Imaj7 | V7/ii | ii7 | V7', 'Rhythm-changes turnaround', 'Turnaround « rhythm changes »', 'major', 0.4),
        tpl('iii7 | vi7 | ii7 | V7', 'Circle turnaround', 'Turnaround en cycle', 'major', 0.3),
        tpl('Imaj7 | iv7 bVII7 | Imaj7 | Imaj7', 'Backdoor ii–V', 'ii–V « backdoor »', 'major', 0.7),
        tpl('Imaj7 | vi7 | ii7 | V7 | iii7 | V7/ii | ii7 V7 | Imaj7', 'Turnaround chain', 'Chaîne de turnarounds', 'major', 0.5),
        tpl('ii7 | V7 | Imaj7 | IVmaj7 | viiø7 | V7/vi | vi7 | vi7', 'Autumn-leaves cycle', 'Cycle à la « Feuilles mortes »', 'major', 0.5),
        tpl('Imaj7 | #iv°7 | ii7 | V7', 'Passing diminished', 'Diminué de passage', 'major', 0.8),
        tpl('iiø7 | V7 | i6 | i6', 'Minor ii–V–i', 'ii–V–i mineur', 'minor', 0),
        tpl('i7 | iv7 | iiø7 | V7', 'Minor turnaround', 'Turnaround mineur', 'minor', 0.2),
        tpl('i7 | bVImaj7 | iiø7 | V7', 'Minor cycle', 'Cycle mineur', 'minor', 0.4),
        tpl('iv7 | bVII7 | bIIImaj7 | bVImaj7 | iiø7 | V7 | i6 | i6', 'Autumn-leaves cycle (minor)', 'Cycle des « Feuilles mortes » (mineur)', 'minor', 0.5),
      ],
    },
    blues: {
      modes: ['major', 'minor'], lengths: [12, 8], defColor: 1, tempo: 92, templatesOnly: true, domMajors: true,
      boost: {}, passes: { sec: 0, tri: 0, mix: 0 },
      color: { 1: { maj: ['dom7'], min: ['min7'] }, 2: { maj: ['dom9', 'dom13'], min: ['min9', 'min7'], dom: ['dom9', 'dom13', 'dom7'] } },
      t: [
        tpl('I7 | I7 | I7 | I7 | IV7 | IV7 | I7 | I7 | V7 | IV7 | I7 | V7', 'Standard 12-bar', '12 mesures standard', 'major', 0),
        tpl('I7 | IV7 | I7 | I7 | IV7 | IV7 | I7 | I7 | V7 | IV7 | I7 | V7', '12-bar, quick change', '12 mesures, « quick change »', 'major', 0.3),
        tpl('I7 | IV7 | I7 | V7/IV | IV7 | #iv°7 | I7 | V7/ii | ii7 | V7 | I7 V7/ii | ii7 V7', 'Jazz blues', 'Blues jazz', 'major', 0.9),
        tpl('I7 | IV7 | I7 | I7 | IV7 | IV7 | I7 | I7 | V7 | V7 | I7 IV7 | I7 V7', '12-bar, turnaround ending', '12 mesures, turnaround final', 'major', 0.5),
        tpl('i7 | i7 | i7 | i7 | iv7 | iv7 | i7 | i7 | bVI7 | V7 | i7 | V7', 'Minor blues', 'Blues mineur', 'minor', 0.2),
        tpl('i7 | iv7 | i7 | i7 | iv7 | iv7 | i7 | i7 | iiø7 | V7 | i7 iv7 | i7 V7', 'Minor blues, jazz turnaround', 'Blues mineur, turnaround jazz', 'minor', 0.8),
        tpl('I7 | V7 | IV7 | IV7 | I7 | V7 | I7 | V7', '8-bar blues', 'Blues 8 mesures', 'major', 0.2),
        tpl('I7 | IV7 | I7 | V7/ii | ii7 | V7 | I7 IV7 | I7 V7', '8-bar blues, gospel turn', 'Blues 8 mesures, couleur gospel', 'major', 0.8),
        tpl('i7 | i7 | iv7 | iv7 | i7 | V7 | i7 | V7', '8-bar minor blues', 'Blues mineur 8 mesures', 'minor', 0.3),
      ],
    },
    soul: {
      modes: ['major', 'minor', 'dorian'], lengths: [4, 8], defColor: 2, tempo: 84,
      boost: { IV: 1.4, iii: 1.5, ii: 1.3, vi: 1.2, bVI: 1.3 },
      passes: { sec: 0.35, tri: 0.25, mix: 0.25 },
      color: { 1: { dom: ['dom7', 'dom7sus4'] }, 2: { maj: ['maj9', 'maj69'], min: ['min9', 'min11'], dom: ['dom13', 'dom9', 'dom7sus4', 'dom7b9'] } },
      t: [
        tpl('IVmaj7 | iii7 | ii7 | Imaj7', 'Neo-soul descent', 'Descente néo-soul', 'major', 0.2),
        tpl('ii7 | V7 | iii7 | vi7', 'Soul cycle', 'Cycle soul', 'major', 0.3),
        tpl('IVmaj7 | V7/vi | vi7 | v7 V7/IV', 'Just the Two of Us', 'Just the Two of Us', 'major', 0.6),
        tpl('Imaj7 | vi7 | ii7 | V7sus4', 'Soft-soul turnaround', 'Turnaround soul doux', 'major', 0.1),
        tpl('IVmaj7 | iv7 | iii7 | vi7', 'Minor-iv slide', 'Glissement iv mineur', 'major', 0.6),
        tpl('bVImaj7 | V7 | i7 | bvii7 bIII7', 'Just the Two of Us', 'Just the Two of Us', 'minor', 0.6),
        tpl('i7 | iv7 | bVIImaj7 | bIIImaj7', 'Minor groove', 'Groove mineur', 'minor', 0.2),
        tpl('i9 | IV9 | i9 | IV9', 'Dorian groove', 'Groove dorien', 'dorian', 0.2),
        tpl('i7 | ii7 | bIIImaj7 | IV7', 'Dorian climb', 'Montée dorienne', 'dorian', 0.4),
      ],
    },
    folk: {
      modes: ['major', 'minor', 'mixolydian', 'dorian'], lengths: [4, 8], defColor: 0, tempo: 96,
      boost: { IV: 1.4, V: 1.3, iii: 0.5, ii: 0.8, bVII: 1.3 },
      passes: { sec: 0.1, tri: 0, mix: 0.1 },
      color: { 1: { maj: ['add9', 'sus2', 'maj6', 'maj7'], min: ['min7', 'madd9'], dom: ['dom7', 'dom7sus4'] }, 2: { maj: ['add9', 'sus2', 'sus4', 'maj9'], min: ['madd9', 'min7', 'min11'], dom: ['dom7sus4', 'dom7'] } },
      t: [
        tpl('I | IV | I | V', 'Campfire', 'Feu de camp', 'major', 0),
        tpl('I | IV | V | I', 'Three-chord song', 'Chanson à trois accords', 'major', 0),
        tpl('I | % | IV | I V', 'Front-porch', 'Sur la galerie', 'major', 0.1),
        tpl('I | IV I | V | %', 'Hymn-like', 'Comme un cantique', 'major', 0.3),
        tpl('I | vi | IV | I', 'Singer-songwriter', 'Auteur-compositeur', 'major', 0.2),
        tpl('I | IV | I | V | I | IV | V | I', 'Folk verse', 'Couplet folk', 'major', 0),
        tpl('I | ii | IV | I', 'Gentle lift', 'Élan doux', 'major', 0.3),
        tpl('vi | IV | I | V', 'Modern folk', 'Folk moderne', 'major', 0.2),
        tpl('I | bVII | I | bVII', 'Celtic drone', 'Bourdon celtique', 'mixolydian', 0.2),
        tpl('I | bVII | IV | I', 'Mixolydian ballad', 'Ballade mixolydienne', 'mixolydian', 0.2),
        tpl('i | IV | i | IV', 'Dorian air', 'Air dorien', 'dorian', 0.1),
        tpl('i | bVII | i | IV', 'Dorian reel', 'Reel dorien', 'dorian', 0.3),
        tpl('i | bVII | i | bVII', 'Modal lament', 'Complainte modale', 'minor', 0.1),
        tpl('i | bVI | bVII | i', 'Minor ballad', 'Ballade mineure', 'minor', 0.2),
        tpl('i | iv | i | V', 'Old-world minor', 'Mineur à l’ancienne', 'minor', 0.2),
      ],
    },
    cinematic: {
      modes: ['minor', 'major', 'lydian'], lengths: [4, 8], defColor: 1, tempo: 72,
      boost: { bVI: 1.8, bIII: 1.4, bVII: 1.4, iv: 1.3, ii: 0.6, 'ii°': 0.3 },
      passes: { sec: 0.1, tri: 0, mix: 0.45 },
      color: { 1: { maj: ['add9', 'maj7'], min: ['madd9', 'min7'], dom: ['dom7sus4', 'dom7'] }, 2: { maj: ['maj9', 'add9', 'sus2'], min: ['madd9', 'min9', 'min11'], dom: ['dom7sus4', 'dom7b9'] } },
      t: [
        tpl('i | bVI | bIII | bVII', 'Epic minor', 'Mineur épique', 'minor', 0),
        tpl('i | % | bVI | bVII', 'Slow swell', 'Lente montée', 'minor', 0.1),
        tpl('i | % | bVI | %', 'Two-chord drone', 'Bourdon à deux accords', 'minor', 0.2),
        tpl('i | bVI | iv | V', 'Tension rise', 'Montée de tension', 'minor', 0.3),
        tpl('i | bVI | bVII | i', 'Heroic minor', 'Mineur héroïque', 'minor', 0.1),
        tpl('i | bIII | bVI | V', 'Dark resolve', 'Résolution sombre', 'minor', 0.4),
        tpl('i | bVI | bII | V', 'Neapolitan shadow', 'Ombre napolitaine', 'minor', 0.8),
        tpl('i | iv | bVI | bVII | i | iv | bVII | i', 'Slow build', 'Montée lente', 'minor', 0.2),
        tpl('I | bVI | bVII | I', 'Heroic major', 'Majeur héroïque', 'major', 0.3),
        tpl('I | III | IV | iv', 'Chromatic mediant', 'Médiante chromatique', 'major', 0.7),
        tpl('IV | V | vi | vi', 'Epic rise', 'Montée épique', 'major', 0.2),
        tpl('vi | IV | I | V', 'Uplifting loop', 'Boucle lumineuse', 'major', 0),
        tpl('I | II | I | II', 'Lydian wonder', 'Émerveillement lydien', 'lydian', 0.2),
        tpl('I | II | vi | V', 'Lydian flight', 'Envol lydien', 'lydian', 0.5),
      ],
    },
    metal: {
      modes: ['minor', 'phrygian', 'phrygianDom', 'dorian'], lengths: [4, 8], defColor: 0, tempo: 140, power: true,
      boost: { bII: 1.8, bVI: 1.6, bVII: 1.5, bIII: 1.2, v: 1.1, V: 0.4, 'ii°': 0.2, ii: 0.5 },
      passes: { sec: 0, tri: 0, mix: 0 },
      color: { 1: { maj: ['maj'], min: ['min'], dom: ['maj'], hdim: ['dim'], dim: ['dim'] }, 2: { maj: ['add9', 'sus2', 'maj'], min: ['madd9', 'min'], dom: ['dom7sus4', 'maj'], hdim: ['dim'], dim: ['dim'] } },
      t: [
        tpl('i | bVI | bVII | i', 'Heroic gallop', 'Galop héroïque', 'minor', 0),
        tpl('i | bVII | bVI | bVII', 'Aeolian riff', 'Riff éolien', 'minor', 0.1),
        tpl('i | % | bVI bVII | i', 'Gallop with a turn', 'Galop avec relance', 'minor', 0.2),
        tpl('i | bII | i | bVI bVII', 'Doom march', 'Marche doom', 'minor', 0.5),
        tpl('i | bVI | bIII | bVII', 'Power ballad', 'Ballade power', 'minor', 0.2),
        tpl('i | iv | bVI | V', 'Neoclassical lift', 'Élan néoclassique', 'minor', 0.5),
        tpl('i | bII | i | bVII', 'Phrygian stab', 'Coup phrygien', 'minor', 0.6),
        tpl('i | bVI | bVII | i | i | bVI | bVII | V', 'Epic gallop', 'Galop épique', 'minor', 0.4),
        tpl('i | bII | i | bII', 'Phrygian chug', 'Chug phrygien', 'phrygian', 0),
        tpl('i | bII | bIII | bII', 'Phrygian climb', 'Montée phrygienne', 'phrygian', 0.3),
        tpl('i | bVI | bvii | i', 'Dark march', 'Marche sombre', 'phrygian', 0.4),
        tpl('I | bII | I | bII', 'Phrygian-dominant riff', 'Riff phrygien dominant', 'phrygianDom', 0.1),
        tpl('iv | bIII | bII | I', 'Andalusian descent', 'Descente andalouse', 'phrygianDom', 0.4),
        tpl('I | bII | bvii | bII', 'Snake-charmer riff', 'Riff charmeur de serpent', 'phrygianDom', 0.6),
        tpl('i | IV | bVII | i', 'Dorian groove metal', 'Groove métal dorien', 'dorian', 0.3),
        tpl('i | bIII | IV | i', 'Dorian riff', 'Riff dorien', 'dorian', 0.4),
      ],
    },
    punk: {
      modes: ['major', 'minor', 'mixolydian'], lengths: [4, 8], defColor: 0, tempo: 172, power: true,
      boost: { IV: 1.5, V: 1.4, vi: 1.2, bVII: 1.3, ii: 0.4, iii: 0.3, 'vii°': 0.05, 'ii°': 0.1 },
      passes: { sec: 0, tri: 0, mix: 0 },
      color: { 1: { maj: ['maj'], min: ['min'], dom: ['maj'] }, 2: { maj: ['sus2', 'add9', 'maj'], min: ['min7', 'min'], dom: ['maj'] } },
      t: [
        tpl('I | IV | V | IV', 'Three-chord punk', 'Punk à trois accords', 'major', 0),
        tpl('I | V | vi | IV', 'Pop-punk axis', 'Axe pop-punk', 'major', 0.1),
        tpl('vi | IV | I | V', 'Emo rotation', 'Rotation emo', 'major', 0.2),
        tpl('I | IV | I | V', 'Garage punk', 'Punk garage', 'major', 0),
        tpl('I | bVII | IV | I', 'Mixolydian punk', 'Punk mixolydien', 'mixolydian', 0.2),
        tpl('i | bVI | bIII | bVII', 'Minor punk anthem', 'Hymne punk mineur', 'minor', 0.1),
        tpl('i | bVII | bVI | bVII', 'Dark punk', 'Punk sombre', 'minor', 0.2),
      ],
    },
    funk: {
      modes: ['dorian', 'mixolydian', 'minor', 'major'], lengths: [4, 8], defColor: 2, tempo: 104, domMajors: true,
      boost: { IV: 1.6, bVII: 1.4, ii: 1.1, iii: 0.5 },
      passes: { sec: 0.2, tri: 0.2, mix: 0.1 },
      color: { 1: { min: ['min7'], dom: ['dom7'] }, 2: { min: ['min9', 'min11', 'min7'], dom: ['dom9', 'dom13', 'dom7sus4'] } },
      t: [
        tpl('i7 | IV7 | i7 | IV7', 'Dorian funk vamp', 'Vamp funk dorien', 'dorian', 0),
        tpl('i7 | i7 | IV7 | IV7', 'Two-chord groove', 'Groove à deux accords', 'dorian', 0.1),
        tpl('i7 | bIII7 | IV7 | i7', 'Dorian strut', 'Démarche dorienne', 'dorian', 0.4),
        tpl('I7 | I7 | IV7 | I7', 'One-chord funk', 'Funk sur un accord', 'mixolydian', 0),
        tpl('I7 | bVII7 | IV7 | I7', 'Mixolydian funk', 'Funk mixolydien', 'mixolydian', 0.3),
        tpl('I7 | IV7 | I7 | IV7', 'Hard-funk vamp', 'Vamp hard-funk', 'major', 0.1),
        tpl('ii7 | V7 | ii7 | V7', 'ii–V vamp', 'Vamp ii–V', 'major', 0.4),
        tpl('i7 | iv7 | i7 | bVII7', 'Minor funk', 'Funk mineur', 'minor', 0.2),
      ],
    },
    gospel: {
      modes: ['major', 'minor'], lengths: [4, 8], defColor: 2, tempo: 76,
      boost: { IV: 1.4, iii: 1.3, vi: 1.3, ii: 1.3 },
      passes: { sec: 0.6, tri: 0.2, mix: 0.45 },
      color: { 2: { maj: ['maj9', 'maj69', 'maj7'], min: ['min9', 'min11', 'min7'], dom: ['dom13', 'dom9', 'dom7b9', 'dom7sus4'] } },
      t: [
        tpl('I | V7/IV | IV | iv', 'Gospel lift (I–I7–IV–iv)', 'Élan gospel (I–I7–IV–iv)', 'major', 0.2),
        tpl('I | iii | IV | iv', 'Gospel walk-up', 'Montée gospel', 'major', 0.3),
        tpl('vi7 | ii7 | V7 | Imaj7', 'Circle home', 'Retour par le cycle', 'major', 0.1),
        tpl('I | V7/vi | vi | V7/IV | IV | iv | I | V', 'Church cycle', 'Cycle d’église', 'major', 0.5),
        tpl('IV | V7/vi | vi | V7/IV | IV | V | I | I', 'Sunday turnaround', 'Turnaround du dimanche', 'major', 0.6),
        tpl('IVmaj7 | iii7 | vi7 | ii7 V7', '4–3–6–2–5', '4–3–6–2–5', 'major', 0.4),
        tpl('i | iv | V7 | i', 'Minor gospel', 'Gospel mineur', 'minor', 0.1),
        tpl('i7 | iv7 | bVII7 | bIIImaj7', 'Minor praise', 'Louange mineure', 'minor', 0.4),
      ],
    },
    bossa: {
      modes: ['major', 'minor'], lengths: [4, 8], defColor: 2, tempo: 130,
      boost: { ii: 1.8, V: 1.3, vi: 1.2, iii: 1.1 },
      passes: { sec: 0.5, tri: 0.45, mix: 0.2 },
      color: { 2: { maj: ['maj9', 'maj69', 'maj7'], min: ['min9', 'min7', 'min6'], dom: ['dom9', 'dom13', 'dom7b9'] } },
      t: [
        tpl('Imaj7 | V7/V | ii7 | bII7', 'Ipanema turnaround', 'Turnaround Ipanema', 'major', 0.4),
        tpl('Imaj7 | Imaj7 | V7/V | V7/V | ii7 | bII7 | Imaj7 | bII7', 'Bossa A section', 'Section A bossa', 'major', 0.5),
        tpl('ii7 | V7 | Imaj7 | V7/ii', 'Bossa ii–V', 'ii–V bossa', 'major', 0.2),
        tpl('Imaj7 | vi7 | ii7 | V7', 'Bossa I–vi–ii–V', 'I–vi–ii–V bossa', 'major', 0),
        tpl('i6 | iv7 | V7 | i6', 'Minor bossa', 'Bossa mineure', 'minor', 0.1),
        tpl('iiø7 | V7 | i7 | bVImaj7', 'Saudade cycle', 'Cycle saudade', 'minor', 0.4),
      ],
    },
    country: {
      modes: ['major', 'mixolydian'], lengths: [4, 8], defColor: 0, tempo: 112,
      boost: { IV: 1.6, V: 1.5, ii: 0.6, iii: 0.3, vi: 0.9 },
      passes: { sec: 0.3, tri: 0, mix: 0.05 },
      color: { 1: { maj: ['maj6', 'maj'], min: ['min7'], dom: ['dom7'] }, 2: { maj: ['maj6', 'add9', 'sus2'], min: ['min7'], dom: ['dom7', 'dom9'] } },
      t: [
        tpl('I | IV | V | I', 'Three chords and the truth', 'Trois accords et la vérité', 'major', 0),
        tpl('I | IV | I | V | I | IV | V | I', 'Country verse', 'Couplet country', 'major', 0),
        tpl('I | V7/V | V | I', 'Swing to the II7', 'Détour par le II7', 'major', 0.4),
        tpl('I | V7/IV | IV | I', 'Honky-tonk', 'Honky-tonk', 'major', 0.3),
        tpl('I | vi | IV | V', 'Country ballad', 'Ballade country', 'major', 0.1),
        tpl('I | I | IV | IV | I | V7/V | V | I', 'Two-step', 'Two-step', 'major', 0.5),
        tpl('I | bVII | IV | I', 'Outlaw country', 'Country outlaw', 'mixolydian', 0.3),
      ],
    },
    reggae: {
      modes: ['major', 'minor'], lengths: [4, 8], defColor: 0, tempo: 76,
      boost: { IV: 1.4, ii: 1.3, V: 1.1, bVII: 1.3, iii: 0.5 },
      passes: { sec: 0.05, tri: 0, mix: 0.05 },
      color: { 1: { maj: ['maj', 'maj7'], min: ['min7'], dom: ['dom7', 'maj'] }, 2: { maj: ['maj7', 'add9'], min: ['min7', 'min9'], dom: ['dom7'] } },
      t: [
        tpl('I | IV | I | IV', 'Skank vamp', 'Vamp skank', 'major', 0),
        tpl('I | IV | V | IV', 'Roots rock', 'Roots rock', 'major', 0.1),
        tpl('I | V | vi | IV', 'Lovers rock', 'Lovers rock', 'major', 0.2),
        tpl('ii | V | ii | V', 'Two-chord riddim', 'Riddim à deux accords', 'major', 0.3),
        tpl('i | bVII | i | bVII', 'One-drop minor', 'One-drop mineur', 'minor', 0),
        tpl('i | iv | i | iv', 'Dub minor', 'Dub mineur', 'minor', 0.1),
        tpl('i | bVII | bVI | bVII', 'Steppers', 'Steppers', 'minor', 0.3),
      ],
    },
    synthwave: {
      modes: ['minor', 'major', 'lydian'], lengths: [4, 8], defColor: 1, tempo: 118,
      boost: { bVI: 1.7, bVII: 1.5, bIII: 1.3, IV: 1.2, vi: 1.3 },
      passes: { sec: 0.05, tri: 0, mix: 0.25 },
      color: { 1: { maj: ['maj7', 'add9'], min: ['min7', 'madd9'], dom: ['dom7sus4', 'maj'] }, 2: { maj: ['maj9', 'add9'], min: ['min9', 'madd9'], dom: ['dom7sus4'] } },
      t: [
        tpl('i | bVI | bIII | bVII', 'Night drive', 'Conduite de nuit', 'minor', 0),
        tpl('bVI | bVII | i | i', 'Lift into the drop', 'Montée vers le drop', 'minor', 0.2),
        tpl('i | bVII | bVI | bVII', 'Neon loop', 'Boucle néon', 'minor', 0.1),
        tpl('i | bIII | bVII | bVI', 'Retro pulse', 'Pulsation rétro', 'minor', 0.3),
        tpl('vi | IV | I | V', 'Festival anthem', 'Hymne de festival', 'major', 0),
        tpl('IV | V | vi | vi', 'Build-up', 'Montée', 'major', 0.2),
        tpl('I | II | I | II', 'Lydian shimmer', 'Miroitement lydien', 'lydian', 0.3),
      ],
    },
    flamenco: {
      modes: ['phrygianDom', 'minor', 'phrygian'], lengths: [4, 8], defColor: 0, tempo: 108,
      boost: { bII: 1.8, iv: 1.3, bIII: 1.3, bVII: 1.3, bVI: 1.3 },
      passes: { sec: 0, tri: 0, mix: 0 },
      color: { 1: { maj: ['maj', 'maj7'], min: ['min'], dom: ['dom7'] }, 2: { maj: ['maj7', 'maj'], min: ['min7', 'min'], dom: ['dom7b9', 'dom7'] } },
      t: [
        tpl('iv | bIII | bII | I', 'Andalusian cadence', 'Cadence andalouse', 'phrygianDom', 0),
        tpl('I | bII | I | bII', 'Phrygian vamp', 'Vamp phrygien', 'phrygianDom', 0.1),
        tpl('I | bII | bIII | bII', 'Soleá-style climb', 'Montée façon soleá', 'phrygianDom', 0.4),
        tpl('I | iv | bIII | bII | I | iv | bII | I', 'Flamenco falseta', 'Falseta flamenca', 'phrygianDom', 0.5),
        tpl('i | bVII | bVI | V', 'Andalusian cadence (minor)', 'Cadence andalouse (mineur)', 'minor', 0),
        tpl('i | bII | i | bII', 'Dark Phrygian', 'Phrygien sombre', 'phrygian', 0.3),
      ],
    },
  };

  /* ---------- helpers ---------- */
  const borrowScale = (adv) => 0.1 + adv * 1.4;
  function trans(mode, style, adv, a, b) {
    const row = MATRIX[mode][a];
    let w = (row && row[b]) || 0;
    const br = BORROW[mode][a];
    if (br && br[b]) w += br[b] * borrowScale(adv);
    return w * (style.boost[b] || 1);
  }
  function vocab(mode) {
    const s = new Set(Object.keys(MATRIX[mode]));
    for (const a in BORROW[mode]) { s.add(a); for (const b in BORROW[mode][a]) s.add(b); }
    for (const a in MATRIX[mode]) for (const b in MATRIX[mode][a]) s.add(b);
    return [...s];
  }
  /* Two different things, kept apart on purpose:
   *  - name: what the chord IS — its scale degree (tonic, supertonic … subdominant, dominant, subtonic…)
   *  - fn:   what it DOES — tonic (home), predominant (moving away), dominant (pulling home)
   * weak = a "modal" dominant: it leads home but has no leading tone (♭VII, minor v, Phrygian ♭II),
   * so its pull is much softer than V's.
   */
  function fnInfo(ch, mode, next) {
    if (ch.role === 'secondary') return { fn: 'D', weak: false, name: 'secondary' };
    if (ch.role === 'tritone') return { fn: 'D', weak: false, name: 'tritone' };
    const fam = Q[T.harm(ch)].fam;
    const phryg = mode === 'phrygian' || mode === 'phrygianDom';
    switch (ch.rootPc) {
      case 0: return { fn: 'T', weak: false, name: 'tonic' };
      case 1: return phryg ? { fn: 'D', weak: true, name: 'phrygianII' } : { fn: 'PD', weak: false, name: 'neapolitan' };
      case 2: return { fn: 'PD', weak: false, name: 'supertonic' };
      case 3: return { fn: 'T', weak: false, name: 'mediant' };
      case 4: return { fn: 'T', weak: false, name: 'mediant' };
      case 5: return { fn: 'PD', weak: false, name: 'subdominant' };
      case 6: return ['dim', 'dim7', 'hdim'].includes(fam) ? { fn: 'D', weak: false, name: 'passingDim' } : { fn: 'PD', weak: false, name: 'raisedFour' };
      case 7: return fam === 'min' ? { fn: 'D', weak: true, name: 'minorDominant' } : { fn: 'D', weak: false, name: 'dominant' };
      case 8: return { fn: 'PD', weak: false, name: 'submediant' };
      case 9: return { fn: 'T', weak: false, name: 'submediant' };
      // ♭VII → IV is the subdominant of the subdominant (double plagal), so it moves away rather than pulling home.
      case 10: return next && next.rootPc === 5 ? { fn: 'PD', weak: false, name: 'subtonic' } : { fn: 'D', weak: true, name: 'subtonic' };
      case 11: return { fn: 'D', weak: false, name: 'leadingTone' };
    }
    return { fn: 'PD', weak: false, name: 'supertonic' };
  }
  const fnOf = (ch, mode) => fnInfo(ch, mode).fn;
  const tokFn = (tok, mode) => fnOf(T.parseRoman(tok), mode);

  /* ---------- functional walk ---------- */
  function scoreSeq(seq, ctx) {
    const { mode, style, adv, ending } = ctx;
    const n = seq.length;
    const tonic = TONIC[mode];
    let s = 0;
    for (let i = 1; i < n; i++) {
      if (seq[i] === seq[i - 1]) s -= 6;
      s += Math.log(trans(mode, style, adv, seq[i - 1], seq[i]) + 0.02);
    }
    if (ending === 'loop') {
      s += Math.log(trans(mode, style, adv, seq[n - 1], seq[0]) + 0.02);
      if (seq[n - 1] === seq[0]) s -= 4;
    } else if (ending === 'resolve') {
      if (seq[n - 1] !== tonic) s -= 12;
    } else if (ending === 'half') {
      if (tokFn(seq[n - 1], mode) !== 'D') s -= 2.5;
    }
    const counts = {};
    seq.forEach((t) => (counts[t] = (counts[t] || 0) + 1));
    const distinct = Object.keys(counts).length;
    const need = Math.min(n - 1, n <= 4 ? 3 : 4);
    if (distinct < need) s -= 2.5 * (need - distinct);
    if (!counts[tonic]) s -= 5;
    const cap = n <= 4 ? 2 : 3;
    for (const k in counts) if (counts[k] > cap) s -= 2 * (counts[k] - cap);
    if ((counts.iii || 0) > 1) s -= 1;
    return s;
  }

  function sampleSeq(n, fixed, ctx, r) {
    const { mode, style, adv } = ctx;
    const V = vocab(mode);
    const seq = [];
    for (let i = 0; i < n; i++) {
      if (fixed[i]) { seq.push(fixed[i]); continue; }
      if (i === 0) {
        const st = Object.entries(START[mode]).map(([k, w]) => [k, w * (style.boost[k] || 1) * (k === TONIC[mode] ? 1 : 0.6 + adv)]);
        seq.push(pick(r, st));
        continue;
      }
      const prev = seq[i - 1];
      const entries = V.filter((b) => b !== prev).map((b) => {
        let w = trans(mode, style, adv, prev, b);
        if (fixed[i + 1]) w *= trans(mode, style, adv, b, fixed[i + 1]) + 0.05;
        if (i === n - 1 && ctx.ending === 'resolve') w *= b === TONIC[mode] ? 8 : 0.2;
        return [b, w];
      });
      seq.push(pick(r, entries) || TONIC[mode]);
    }
    return seq;
  }

  function bestSeq(n, fixed, ctx, r, tries) {
    const seen = new Map();
    for (let k = 0; k < (tries || 350); k++) {
      const seq = sampleSeq(n, fixed, ctx, r);
      const key = seq.join(' ');
      if (seen.has(key) || key === ctx.avoid) continue;
      seen.set(key, scoreSeq(seq, ctx));
    }
    const ranked = [...seen.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    if (!ranked.length) return sampleSeq(n, fixed, ctx, r);
    const top = ranked[0][1];
    const temp = 0.45 + ctx.adv * 1.3;
    return pick(r, ranked.map(([k, s]) => [k, Math.exp((s - top) / temp)])).split(' ');
  }

  // n = number of chords; half = chords in the first 4 bars when both halves share a rhythm (else 0).
  function walk(ctx, r, n, half) {
    const fixed = {};
    (ctx.locks || []).forEach((l, i) => { if (l && i < n) fixed[i] = T.baseToken(l); });
    const hasLocks = Object.keys(fixed).length > 0;
    if (ctx.ending === 'resolve' && !fixed[n - 1]) fixed[n - 1] = TONIC[ctx.mode];
    // 8 bars: antecedent/consequent ("period"). The second phrase starts like the first, then takes a new turn.
    if (half >= 3 && !hasLocks && r() < 0.75 - ctx.adv * 0.3) {
      const a = bestSeq(half, {}, Object.assign({}, ctx, { ending: 'half' }), r);
      const f2 = {};
      a.forEach((t, i) => (f2[i] = t));
      for (let i = 0; i < Math.max(1, half - 2); i++) f2[half + i] = a[i];
      if (fixed[n - 1]) f2[n - 1] = fixed[n - 1];
      return { seq: bestSeq(n, f2, ctx, r), period: true };
    }
    return { seq: bestSeq(n, fixed, ctx, r), period: false };
  }

  /* ---------- harmonic rhythm ----------
   * How long each chord lasts, in beats, over a 4-bar phrase in 4/4.
   * Long chords start on a bar line; 2-beat chords come in pairs inside one bar.
   */
  const RHYTHMS = {
    steady:     [4, 4, 4, 4],
    two:        [8, 8],
    longFirst:  [8, 4, 4],
    longLast:   [4, 4, 8],
    longMid:    [4, 8, 4],
    push:       [4, 4, 4, 2, 2],
    midSplit:   [4, 2, 2, 4, 4],
    twoSplits:  [4, 4, 2, 2, 2, 2],
    swing:      [2, 2, 4, 2, 2, 4],
    doubleTime: [2, 2, 2, 2, 2, 2, 2, 2],
  };
  const DEF_RHYTHM = { steady: 4, longFirst: 1, longLast: 1.2, push: 1.2, two: 0.5 };
  const STYLE_RHYTHM = {
    pop: { steady: 4, longFirst: 1, longLast: 1.5, push: 1.5, two: 0.6, midSplit: 0.6 },
    rock: { steady: 3.5, two: 1.2, longFirst: 1.5, longLast: 1.5, push: 1, longMid: 0.6 },
    jazz: { steady: 1.5, push: 2, twoSplits: 2, swing: 1.5, doubleTime: 1.2, midSplit: 1 },
    soul: { steady: 2.5, push: 2, twoSplits: 1, longLast: 1, midSplit: 1 },
    folk: { steady: 3.5, longFirst: 1.5, longLast: 1.5, two: 1, longMid: 1, push: 0.6 },
    cinematic: { steady: 3, two: 1.5, longFirst: 1.5, longLast: 1.2, longMid: 0.8 },
    metal: { steady: 3, two: 1.5, longFirst: 1, push: 1.5, twoSplits: 1 },
    punk: { steady: 4, push: 1.5, longLast: 1, twoSplits: 0.6 },
    funk: { two: 3, steady: 2, longFirst: 1, longLast: 1 },
    gospel: { steady: 2, push: 2, twoSplits: 2, swing: 1, midSplit: 1 },
    bossa: { steady: 2, push: 1.5, twoSplits: 2, doubleTime: 1, swing: 1 },
    country: { steady: 3, longFirst: 2, longLast: 1.5, two: 1, push: 0.8 },
    reggae: { steady: 3, two: 2, longLast: 1, doubleTime: 0.4 },
    synthwave: { steady: 4, two: 1, longLast: 1, longFirst: 0.8 },
    flamenco: { steady: 3, push: 1.5, twoSplits: 1, longLast: 1 },
  };
  function chooseRhythm(ctx, r) {
    const bars = ctx.length;
    if (ctx.rhythm && ctx.rhythm.length) return { beats: ctx.rhythm.slice(), half: 0 };
    if (ctx.rhythmMode === 'steady') return { beats: new Array(bars).fill(4), half: bars === 8 ? 4 : 0 };
    const w = STYLE_RHYTHM[ctx.styleId] || DEF_RHYTHM;
    const entries = Object.entries(w).filter(([k]) => !(ctx.ending === 'resolve' && k === 'two' && bars === 4)).map(([k, v]) => [k, v]);
    const a = pick(r, entries);
    if (bars === 4) return { beats: RHYTHMS[a].slice(), half: 0 };
    // 8 bars: usually the same rhythm twice (a question and its answer), sometimes a busier second half.
    const b = r() < 0.6 ? a : pick(r, entries);
    return { beats: RHYTHMS[a].concat(RHYTHMS[b]), half: a === b ? RHYTHMS[a].length : 0 };
  }
  function place(chords) {
    let start = 0;
    chords.forEach((c) => { c.start = start; c.bar = Math.floor(start / 4); start += c.beats; });
    return chords;
  }

  // Loops often "push" back to the top: the last bar splits in two, adding a chord that leads to bar 1.
  function addPush(chords, ctx, r) {
    const last = chords[chords.length - 1], first = chords[0];
    if (ctx.ending !== 'loop' || last.beats !== 4 || ctx.style.templatesOnly || ctx.rhythmMode === 'steady') return false;
    if (r() > 0.25 + ctx.adv * 0.25) return false;
    const lt = T.baseToken(last), ft = T.baseToken(first);
    const entries = vocab(ctx.mode).filter((b) => b !== lt && b !== ft).map((b) => [b, trans(ctx.mode, ctx.style, ctx.adv, lt, b) * trans(ctx.mode, ctx.style, ctx.adv, b, ft)]).filter(([, w]) => w > 1.5);
    if (!entries.length) return false;
    const tok = pick(r, entries);
    last.beats = 2;
    chords.push(Object.assign(T.parseRoman(tok), { beats: 2 }));
    return true;
  }

  /* ---------- templates ---------- */
  // "I | % | IV V | vi": bars split by "|", chords in a bar share it, "%" holds the previous chord another bar.
  function parseTemplate(p) {
    const out = [];
    p.split('|').forEach((bar) => {
      const toks = bar.trim().split(/\s+/);
      if (toks.length === 1 && toks[0] === '%') { out[out.length - 1].beats += 4; return; }
      toks.forEach((tok) => out.push(Object.assign(T.parseRoman(tok), { beats: 4 / toks.length })));
    });
    return place(out);
  }
  function fitTemplate(t, ctx) {
    let chords = parseTemplate(t.p);
    const bars = t.p.split('|').length;
    if (bars !== ctx.length) {
      if (bars * 2 !== ctx.length) return null;
      chords = place(chords.concat(chords.map((c) => Object.assign({}, c))));
    }
    // Drop everything from beat `cut` on, shortening a chord that crosses it.
    const cutAt = (cut) => {
      const keep = chords.filter((c) => c.start < cut).map((c) => Object.assign({}, c));
      const lastKept = keep[keep.length - 1];
      if (lastKept) lastKept.beats = Math.min(lastKept.beats, cut - lastKept.start);
      return keep;
    };
    if (ctx.ending === 'resolve') {
      const last = chords[chords.length - 1];
      if (ctx.style.templatesOnly) {
        // Blues: the last chorus simply lands on the tonic in bar 12.
        const keep = cutAt((ctx.length - 1) * 4);
        const ton = Object.assign({}, keep[0], { beats: 4 });
        chords = place(keep.concat([ton]));
      } else if (last.rootPc !== 0 || last.beats !== 4) {
        // Swap the last bars for a cadence formula that fits the mode.
        for (const cad of CADENCES[ctx.mode]) {
          const keep = cutAt((ctx.length - cad.length) * 4);
          const before = keep[keep.length - 1];
          if (before && T.baseToken(before) === cad[0]) continue;
          chords = place(keep.concat(cad.map((tok) => Object.assign(T.parseRoman(tok), { beats: 4 }))));
          break;
        }
      }
    }
    return chords;
  }
  function chooseTemplate(style, ctx, r) {
    const list = style.t.filter((t) => t.m === ctx.mode).map((t) => [t, Math.exp(-Math.pow(t.adv - ctx.adv, 2) / 0.12)]).filter(([t]) => t.p !== ctx.avoidTemplate);
    const usable = list.filter(([t]) => fitTemplate(t, ctx));
    if (!usable.length) return null;
    return pick(r, usable);
  }

  /* ---------- re-harmonisation passes ---------- */
  const triadize = (c) => Object.assign({}, c, { quality: T.TRIAD_OF_FAMILY[Q[c.quality].fam] || 'maj', role: null, target: null });

  function passes(chords, ctx, r) {
    const P = ctx.style.passes;
    const n = chords.length;
    const next = (i) => (i < n - 1 ? chords[i + 1] : ctx.ending === 'loop' ? chords[0] : null);
    const locked = (i) => ctx.lockedIdx && ctx.lockedIdx.has(i);
    // Modal mixture: IV → iv before I or V (major).
    if (ctx.mode === 'major') {
      for (let i = 0; i < n; i++) {
        const c = chords[i], nx = next(i);
        if (locked(i) || !nx || c.role || c.rootPc !== 5 || Q[c.quality].fam !== 'maj') continue;
        if ((nx.rootPc === 0 || nx.rootPc === 7) && r() < P.mix * ctx.adv) chords[i] = Object.assign(T.chordOn(3, 5, 'min'), { beats: c.beats, start: c.start, bar: c.bar, explicit: false });
      }
    }
    // Secondary dominants: a chord whose root is a 5th above the next chord becomes its V7.
    for (let i = 0; i < n; i++) {
      const c = chords[i], nx = next(i);
      if (locked(i) || !nx || c.role || c.rootPc === 7) continue;
      const fam = Q[c.quality].fam;
      if (!['maj', 'min'].includes(fam) || ['dim', 'hdim', 'dim7'].includes(Q[nx.quality].fam)) continue;
      if (mod(c.rootPc - nx.rootPc, 12) !== 7) continue;
      let p = P.sec * (0.3 + ctx.adv);
      if (c.rootPc === 0) p *= i === 0 ? 0 : 0.4;
      if (r() < p) chords[i] = Object.assign(T.chordOn(c.degree, c.rootPc, 'dom7', 'secondary', triadize(nx)), { beats: c.beats, start: c.start, bar: c.bar });
    }
    // Tritone substitution: a dominant falling a 5th is replaced by the dominant a tritone away.
    if (ctx.adv > 0.45 && P.tri > 0) {
      for (let i = 1; i < n; i++) {
        const c = chords[i], nx = next(i);
        if (locked(i) || !nx || c.role === 'tritone') continue;
        const isDom = c.role === 'secondary' || (c.rootPc === 7 && Q[c.quality].fam !== 'min');
        if (!isDom || mod(c.rootPc - nx.rootPc, 12) !== 7) continue;
        if (r() < P.tri * ctx.adv) chords[i] = Object.assign(T.chordOn(c.degree + 4, c.rootPc + 6, 'dom7', 'tritone', triadize(nx)), { beats: c.beats, start: c.start, bar: c.bar });
      }
    }
    return chords;
  }

  /* ---------- colour pass ---------- */
  function contextFor(ch, key) {
    if (ch.role === 'secondary' && ch.target) {
      const tp = mod(key.tonic.pc + ch.target.rootPc, 12);
      const steps = Q[ch.target.quality].fam === 'min' ? [0, 2, 3, 5, 7, 8, 11] : T.MODES.major.steps;
      return new Set(steps.map((s) => mod(tp + s, 12)));
    }
    const tri = T.triadPcs(ch, key);
    return T.contextScales(key).find((s) => tri.every((p) => s.has(p))) || null;
  }

  function colorize(ch, ctx, r) {
    const q = Q[ch.quality];
    const level = ctx.color;
    if (level === 0 && ctx.style.power) return ['dim', 'hdim', 'dim7'].includes(q.fam) ? 'dim' : 'pow5';
    if (q.fam === 'sus') return ch.quality;
    if (ch.quality === 'dom7sus4') return level === 0 ? 'sus4' : ch.quality;
    if (level === 0) return T.TRIAD_OF_FAMILY[q.fam];
    if (q.fam === 'dim7' || q.fam === 'aug') return ch.quality;
    if (ch.explicit && level === 1 && ch.quality !== T.TRIAD_OF_FAMILY[q.fam]) return ch.quality;
    const isDom = q.fam === 'dom' || !!ch.role || (q.fam === 'maj' && (ch.rootPc === 7 || ctx.style.domMajors));
    if (ch.role === 'tritone') return level === 2 ? 'dom9' : 'dom7';
    const famKey = isDom ? 'dom' : q.fam;
    const lists = [ctx.style.color && ctx.style.color[level] && ctx.style.color[level][famKey], DEF_COLOR[level][famKey], DEF_COLOR[1][famKey]];
    const scale = contextFor(ch, ctx.key);
    const root = mod(ctx.key.tonic.pc + ch.rootPc, 12);
    if (!scale) return isDom ? 'dom7' : ch.explicit ? ch.quality : T.TRIAD_OF_FAMILY[q.fam];
    for (const list of lists) {
      if (!list) continue;
      const ok = list.filter((qq) => {
        if (ctx.noSus && /sus/.test(qq)) return false;
        return Q[qq].iv.every((iv) => (isDom && iv === 10) || scale.has(mod(root + iv, 12)));
      });
      if (ok.length) return pick(r, ok.map((qq, i) => [qq, 1 / (1 + i * 0.6)]));
    }
    return isDom ? 'dom7' : T.TRIAD_OF_FAMILY[q.fam];
  }

  // Re-apply colour deterministically (same seed → same choices) when only the colour level changes.
  function recolor(prog, ctxBase) {
    const ctx = Object.assign({}, ctxBase, { style: STYLES[ctxBase.styleId] });
    prog.chords.forEach((c) => {
      if (c.base == null) return;
      c.quality = colorize(Object.assign({}, c, { quality: c.base }), Object.assign({}, ctx, { noSus: !!c.final }), rng(c.seed));
    });
    return prog;
  }

  /* ---------- public API ---------- */
  function generate(opts) {
    const style = STYLES[opts.styleId];
    const seed = opts.seed != null ? opts.seed : Math.floor(Math.random() * 2 ** 31);
    const r = rng(seed);
    const ctx = Object.assign({}, opts, { style, mode: opts.key.mode, adv: opts.adventure });
    const locks = (opts.locks || []).filter(Boolean);
    let chords = null, source = null;

    const useTemplate = style.templatesOnly || (!locks.length && r() < 0.75 - 0.6 * ctx.adv);
    if (useTemplate) {
      const t = chooseTemplate(style, ctx, r);
      if (t) {
        chords = fitTemplate(t, ctx);
        source = { type: 'template', name: t.n, p: t.p };
        if (addPush(chords, ctx, r)) source.push = true;
        place(chords);
      }
    }
    if (!chords) {
      const rh = chooseRhythm(ctx, r);
      const { seq, period } = walk(ctx, r, rh.beats.length, rh.half);
      chords = place(seq.map((tok, i) => Object.assign(T.parseRoman(tok), { beats: rh.beats[i] })));
      source = { type: 'walk', period };
    }
    // Restore locked chords exactly as they were (same rhythm, so indexes line up).
    ctx.lockedIdx = new Set();
    const lockList = opts.locks || [];
    if (locks.length && lockList.length === chords.length) {
      lockList.forEach((l, i) => { if (l) { chords[i] = Object.assign({}, l, { beats: chords[i].beats, start: chords[i].start, bar: chords[i].bar }); ctx.lockedIdx.add(i); } });
    }
    chords = passes(chords, ctx, r);
    chords.forEach((c, i) => {
      if (ctx.lockedIdx.has(i)) { c.locked = true; return; }
      c.base = c.quality;
      // Same chord → same colour everywhere in the progression.
      c.seed = hashSeed(seed + ':' + T.baseToken(c) + ':' + c.quality + ':' + (c.role || ''));
      c.final = i === chords.length - 1 && ctx.ending === 'resolve';
      c.quality = colorize(c, Object.assign({}, ctx, { noSus: c.final }), rng(c.seed));
    });
    return { chords, source, seed, styleId: opts.styleId };
  }

  // Swap one chord for another that fits between its neighbours.
  function reroll(prog, i, opts) {
    const style = STYLES[opts.styleId];
    const r = rng(Math.floor(Math.random() * 2 ** 31));
    const mode = opts.key.mode;
    const ctx = Object.assign({}, opts, { style, mode, adv: Math.max(opts.adventure, 0.35) });
    const ch = prog.chords;
    const n = ch.length;
    const prev = i > 0 ? ch[i - 1] : opts.ending === 'loop' ? ch[n - 1] : null;
    const nxt = i < n - 1 ? ch[i + 1] : opts.ending === 'loop' ? ch[0] : null;
    const cur = T.baseToken(ch[i]);
    const pT = prev && T.baseToken(prev), nT = nxt && T.baseToken(nxt);
    const entries = vocab(mode).filter((b) => b !== cur && b !== pT && b !== nT).map((b) => {
      const w1 = pT ? trans(mode, style, ctx.adv, pT, b) + 0.03 : 1;
      const w2 = nT ? trans(mode, style, ctx.adv, b, nT) + 0.03 : 1;
      return [b, w1 * w2];
    });
    const tok = pick(r, entries);
    if (!tok) return prog;
    const c = Object.assign(T.parseRoman(tok), { beats: ch[i].beats, start: ch[i].start, bar: ch[i].bar, explicit: false });
    c.base = c.quality;
    const twin = ch.find((o, k) => k !== i && o.base === c.base && T.baseToken(o) === tok && !o.role);
    c.seed = twin ? twin.seed : Math.floor(r() * 2 ** 31);
    c.quality = colorize(c, ctx, rng(c.seed));
    ch[i] = c;
    prog.source = { type: 'edited', from: prog.source };
    return prog;
  }

  /* ---------- analysis ---------- */
  // The chord that gives each mode its flavour (root, in semitones above the tonic).
  const SIGNATURE = { dorian: 5, mixolydian: 10, phrygian: 1, phrygianDom: 1, lydian: 2 };
  function analyze(prog, key, ending) {
    const ch = prog.chords;
    const n = ch.length;
    const items = [];
    const modeSet = key.pcs;
    const parallel = T.makeKey(key.tonic.pc, T.MODES[key.mode].parallel);
    ch.forEach((c, i) => {
      if (c.role === 'secondary') items.push({ k: 'secondary', i });
      else if (c.role === 'tritone') items.push({ k: 'tritone', i });
      else if (!T.triadPcs(c, key).every((p) => modeSet.has(p))) {
        if (key.mode === 'minor' && c.rootPc === 7) items.push({ k: 'harmonicV', i });
        else if (c.rootPc === 1 && Q[T.harm(c)].fam === 'maj') items.push({ k: 'neapolitan', i });
        else if (T.triadPcs(c, parallel).every((p) => parallel.pcs.has(p))) items.push({ k: 'borrowed', i, from: parallel.mode });
        else items.push({ k: 'chromatic', i });
      } else if (SIGNATURE[key.mode] === c.rootPc && (key.mode !== 'dorian' || Q[T.harm(c)].fam !== 'min')) {
        items.push({ k: 'modal', i });
      }
    });
    const pairs = [];
    for (let i = 0; i < n; i++) {
      const j = i + 1 < n ? i + 1 : ending === 'loop' ? 0 : -1;
      if (j >= 0 && j !== i) pairs.push([i, j]);
    }
    let fifths = 0;
    for (const [i, j] of pairs) {
      const a = ch[i], b = ch[j];
      const step = mod(b.rootPc - a.rootPc, 12);
      if (step === 5) fifths++;
      const aFam = Q[T.harm(a)].fam;
      if (a.rootPc === 7 && aFam !== 'min' && !a.role && b.rootPc === 0) items.push({ k: 'authentic', i, j });
      else if (a.rootPc === 7 && !a.role && aFam !== 'min' && (b.rootPc === 9 || b.rootPc === 8)) items.push({ k: 'deceptive', i, j });
      else if (a.rootPc === 5 && b.rootPc === 0) items.push({ k: aFam === 'min' && key.mode !== 'minor' && key.mode !== 'dorian' ? 'minorPlagal' : 'plagal', i, j });
      // ♭VII → I: in a major-tonic context it's the gospel/rock "backdoor"; onto a minor tonic it's the Aeolian cadence.
      else if (a.rootPc === 10 && b.rootPc === 0) items.push({ k: Q[T.harm(b)].fam === 'min' ? 'aeolianCad' : 'backdoor', i, j });
      else if (a.rootPc === 1 && b.rootPc === 0 && !a.role) items.push({ k: 'phrygianCad', i, j });
      if (j > i && j + 1 < n && a.rootPc === 2 && b.rootPc === 7 && ch[j + 1].rootPc === 0) items.push({ k: 'iiVI', i, j });
      if (j > i && j + 1 < n && a.rootPc === 10 && b.rootPc === 5 && ch[j + 1].rootPc === 0) items.push({ k: 'doublePlagal', i, j });
    }
    const roots = ch.map((c) => c.rootPc).join(',');
    if (/(^|,)0,10,8,7(,|$)/.test(roots)) items.push({ k: 'andalusian' });
    if (pairs.length >= 3 && fifths / pairs.length >= 0.5) items.push({ k: 'fifths' });
    const last = ch[n - 1];
    const lastInfo = fnInfo(last, key.mode, ending === 'loop' ? ch[0] : null);
    if (ending === 'loop' && lastInfo.fn === 'D') items.push({ k: lastInfo.weak ? 'turnaroundModal' : 'turnaround', i: n - 1 });
    // Keep it readable: one item per kind for cadences, max 6.
    const seen = new Set();
    const out = items.filter((it) => {
      const sig = it.k + (['secondary', 'tritone', 'borrowed', 'chromatic', 'modal', 'neapolitan'].includes(it.k) ? ':' + T.baseToken(ch[it.i]) + ch[it.i].quality : ''); // one note per distinct chord
      if (seen.has(sig)) return false;
      seen.add(sig);
      return true;
    });
    return out.slice(0, 6);
  }

  C.gen = { STYLES, RHYTHMS, generate, reroll, recolor, analyze, fnOf, fnInfo, rng, TONIC, MATRIX };
})(typeof window !== 'undefined' ? (window.Cadence = window.Cadence || {}) : (globalThis.Cadence = globalThis.Cadence || {}));
