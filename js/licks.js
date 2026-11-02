/* Cadence — licks to try over a progression.
 *
 * Each lick is a short phrase written the way guitarists learn them: as a shape in a pentatonic box,
 * relative to the key's root on the low E string. That makes every lick work in any key.
 *
 * Note format: [string, fret, start, length, technique]
 *   string: 0 = low E … 5 = high E (standard tuning)
 *   fret:   offset from the key root's fret on the low E string (minor licks: box 1 starts there;
 *           major licks: the major box sits 3 frets lower, so offsets go negative)
 *   start, length: in beats (0.5 = eighth note, 1/3 = triplet)
 *   technique (space-separated): b = bend a whole step · hb = half step · qb = quarter-tone "curl"
 *     r = start bent up a whole step and release · h = hammer-on · p = pull-off
 *     / = slide from the previous note on that string · si = slide in from below · ~ = vibrato
 * over: where it fits — I, IV, V, turn (turnaround, last bars), end (final bars), any
 */
(function (C) {
  'use strict';
  const T = C.theory;
  const { mod } = T;
  const tr3 = (k) => k / 3;

  const L = (id, en, fr, o) => Object.assign({ id, n: { en, fr } }, o);
  const LICKS = [
    /* ---------- minor pentatonic & blues, box 1 ---------- */
    L('bend-five', 'Bend up to the 5th', 'Tirer jusqu’à la quinte', { fam: 'minor', box: 1, over: 'I', lvl: 1,
      tip: { en: 'Bend the 4th on the G string a whole step until it sounds like the 5th, then walk down and land on the root with vibrato. The next note (B string) is the target pitch of the bend: they should match.', fr: 'Tirez la quarte sur la corde de sol d’un ton entier jusqu’à entendre la quinte, puis redescendez et posez-vous sur la tonique avec vibrato. La note suivante (corde de si) est la hauteur visée par le tiré : elles doivent être identiques.' },
      notes: [[3, 2, 0, 1, 'b'], [4, 0, 1, 0.5], [3, 2, 1.5, 0.5], [3, 0, 2, 0.5], [2, 2, 2.5, 1.5, '~']] }),
    L('curl', 'Blues curl on the ♭3', 'Petit tiré sur la ♭3', { fam: 'minor', box: 1, over: 'I', lvl: 1,
      tip: { en: 'Push the ♭3 up just a little, about a quarter tone, not all the way to the major 3rd. That in-between pitch is the essence of the blues.', fr: 'Poussez la ♭3 juste un peu, environ un quart de ton, sans aller jusqu’à la tierce majeure. Cette note « entre les deux », c’est l’essence du blues.' },
      notes: [[5, 3, 0, 1, 'qb'], [5, 0, 1, 1], [4, 3, 2, 1], [4, 0, 3, 1, '~']] }),
    L('walk-down', 'Walk down the box', 'Descendre la boîte', { fam: 'minor', box: 1, over: 'any', lvl: 1,
      tip: { en: 'Straight eighth notes down box 1, ending on the root. Simple, but play it slowly and evenly before speeding up: it’s the backbone of many longer lines.', fr: 'Des croches régulières en descendant la boîte 1, jusqu’à la tonique. Simple, mais jouez-la lentement et régulièrement avant d’accélérer : c’est la base de bien des phrases plus longues.' },
      notes: [[5, 3, 0, 0.5], [5, 0, 0.5, 0.5], [4, 3, 1, 0.5], [4, 0, 1.5, 0.5], [3, 2, 2, 0.5], [3, 0, 2.5, 0.5], [2, 2, 3, 1, '~']] }),
    L('hammer-climb', 'Hammer-on climb', 'Montée en hammer-on', { fam: 'minor', box: 1, over: 'any', lvl: 1,
      tip: { en: 'Pick only the first note on each string and hammer the second one. The line gets smoother and you pick half as much.', fr: 'Ne grattez que la première note de chaque corde et faites la deuxième en hammer-on. La phrase devient plus liée et vous grattez deux fois moins.' },
      notes: [[1, 0, 0, 0.5], [1, 2, 0.5, 0.5, 'h'], [2, 0, 1, 0.5], [2, 2, 1.5, 0.5, 'h'], [3, 0, 2, 0.5], [3, 2, 2.5, 0.5, 'h'], [3, 0, 3, 0.5, 'p'], [2, 2, 3.5, 0.5]] }),
    L('slide-in', 'Slide in and sing', 'Glisser et chanter', { fam: 'minor', box: 1, over: 'I', lvl: 1,
      tip: { en: 'Slide into the root from two frets below and hold it with vibrato. One note, played with feel, already sounds like a solo.', fr: 'Glissez vers la tonique depuis deux cases plus bas et tenez-la avec vibrato. Une seule note jouée avec du sentiment, c’est déjà un solo.' },
      notes: [[5, 0, 0, 2, 'si ~'], [4, 3, 2, 0.5], [4, 0, 2.5, 1.5, '~']] }),
    L('question-answer', 'Question and answer', 'Question et réponse', { fam: 'minor', box: 1, over: 'I', lvl: 1,
      tip: { en: 'The first phrase stops on the 5th, which sounds unfinished: a question. The answer lands on the root. Leave the rest of each bar silent; the space is part of the phrase.', fr: 'La première phrase s’arrête sur la quinte, qui sonne inachevée : une question. La réponse se pose sur la tonique. Laissez le reste de chaque mesure en silence : l’espace fait partie de la phrase.' },
      notes: [[5, 0, 0, 0.5], [4, 3, 0.5, 0.5], [4, 0, 1, 2, '~'], [4, 0, 4, 0.5], [3, 2, 4.5, 0.5], [3, 0, 5, 0.5], [2, 2, 5.5, 2.5, '~']] }),
    L('blue-a', 'Blue note on the A string', 'Blue note sur la corde de la', { fam: 'minor', scale: 'blues', box: 1, over: 'any', lvl: 1,
      tip: { en: 'Hammer through the ♭5, the “blue note”, on the way from the 4th to the 5th. Never stop on it: it’s a passing tension.', fr: 'Passez par la ♭5, la « blue note », en hammer-on de la quarte à la quinte. Ne vous y arrêtez jamais : c’est une tension de passage.' },
      notes: [[1, 0, 0, 0.5], [1, 1, 0.5, 0.5, 'h'], [1, 2, 1, 0.5, 'h'], [1, 0, 1.5, 0.5, 'p'], [0, 3, 2, 0.5], [0, 0, 2.5, 1.5, '~']] }),
    L('blue-g', 'Blue note on the G string', 'Blue note sur la corde de sol', { fam: 'minor', scale: 'blues', box: 1, over: 'any', lvl: 1,
      tip: { en: 'Same idea higher up: ♭3, 4, ♭5 and back down, all on one string, then drop to the root.', fr: 'Même idée plus haut : ♭3, quarte, ♭5 puis retour, sur une seule corde, avant de tomber sur la tonique.' },
      notes: [[3, 0, 0, 0.5], [3, 2, 0.5, 0.5, 'h'], [3, 3, 1, 0.5, 'h'], [3, 2, 1.5, 0.5, 'p'], [3, 0, 2, 0.5, 'p'], [2, 2, 2.5, 1.5, '~']] }),
    L('low-riff', 'Low blues riff', 'Riff blues grave', { fam: 'minor', scale: 'blues', box: 1, over: 'any', lvl: 1,
      tip: { en: 'A riff on the two lowest strings. It works as a fill between vocal lines as much as in a solo.', fr: 'Un riff sur les deux cordes graves. Il sert autant de remplissage entre deux phrases chantées que dans un solo.' },
      notes: [[0, 0, 0, 0.5], [0, 3, 0.5, 0.5], [1, 0, 1, 0.5], [1, 1, 1.5, 0.5, 'h'], [1, 2, 2, 0.5, 'h'], [1, 0, 2.5, 0.5, 'p'], [0, 3, 3, 0.5], [0, 0, 3.5, 0.5]] }),
    L('berry', 'Double-stop shuffle', 'Double-cordes shuffle', { fam: 'minor', box: 1, over: 'I', lvl: 2,
      tip: { en: 'Two strings at once with one finger, in a swung rhythm, then slide both down into the 5th and root. The classic rock-and-roll sound.', fr: 'Deux cordes d’un seul doigt, en rythme swing, puis glissez les deux vers la quinte et la tonique. Le son rock’n’roll par excellence.' },
      notes: [[4, 3, 0, tr3(2)], [5, 3, 0, tr3(2)], [4, 3, tr3(2), tr3(1)], [5, 3, tr3(2), tr3(1)], [4, 3, 1, tr3(2)], [5, 3, 1, tr3(2)], [4, 3, tr3(5), tr3(1)], [5, 3, tr3(5), tr3(1)], [4, 0, 2, 2, '/'], [5, 0, 2, 2, '/ ~']] }),
    L('unison', 'Unison bend', 'Tiré à l’unisson', { fam: 'minor', box: 1, over: 'I', lvl: 2,
      tip: { en: 'Bend the G string while holding the B string: when the bent note reaches the same pitch, the wobble between them stops. Great training for bending in tune.', fr: 'Tirez la corde de sol en tenant la corde de si : quand la note tirée atteint la même hauteur, le battement entre les deux disparaît. Excellent pour apprendre à tirer juste.' },
      notes: [[3, 2, 0, 1, 'b'], [4, 0, 0, 1], [3, 2, 1.5, 0.5, 'b'], [4, 0, 1.5, 0.5], [5, 0, 2, 2, '~']] }),
    L('over-iv', 'Follow the IV chord', 'Suivre l’accord IV', { fam: 'minor', box: 1, over: 'IV', lvl: 2,
      tip: { en: 'Over the IV chord, the key’s 4th is its root, the ♭3 is its ♭7 and the key’s root is its 5th. Ending on that note makes the line follow the change instead of ignoring it.', fr: 'Sur l’accord IV, la quarte de la tonalité est sa fondamentale, la ♭3 est sa ♭7 et la tonique est sa quinte. Finir sur cette note fait suivre le changement d’accord au lieu de l’ignorer.' },
      notes: [[3, 0, 0, 0.5], [3, 2, 0.5, 0.5, 'h'], [4, 0, 1, 0.5], [3, 2, 1.5, 0.5], [3, 0, 2, 0.5], [2, 2, 2.5, 1.5, '~']] }),
    L('iv-third', 'Bend to the IV’s 3rd', 'Tirer vers la tierce du IV', { fam: 'minor', box: 1, over: 'IV', lvl: 2,
      tip: { en: 'Bend the 5th up a whole step: you reach the 6th of the key, which is the major 3rd of the IV chord. It sounds sweet only over the IV, so save it for that moment.', fr: 'Tirez la quinte d’un ton : vous atteignez la sixte de la tonalité, qui est la tierce majeure de l’accord IV. Elle ne sonne bien que sur le IV : gardez-la pour ce moment.' },
      notes: [[4, 0, 0, 1, 'b'], [4, 0, 1, 0.5], [3, 2, 1.5, 0.5], [3, 0, 2, 2, '~']] }),
    L('over-v', 'Lean on the V', 'S’appuyer sur le V', { fam: 'minor', box: 1, over: 'V', lvl: 2,
      tip: { en: 'Over the V chord, bend the 4th up to the 5th: that’s the V chord’s root. Then touch the 4th again (its ♭7) and come back. You’re playing the chord’s own notes.', fr: 'Sur l’accord V, tirez la quarte jusqu’à la quinte : c’est la fondamentale du V. Retouchez ensuite la quarte (sa ♭7) et revenez. Vous jouez les notes de l’accord lui-même.' },
      notes: [[3, 2, 0, 1, 'b'], [4, 0, 1, 0.5], [3, 2, 1.5, 0.5], [4, 0, 2, 2, '~']] }),
    L('v-leading', 'Half step into the I', 'Demi-ton vers le I', { fam: 'minor', box: 1, over: 'V', lvl: 2,
      tip: { en: 'The 3rd of the V chord sits a half step below the key’s root. Play it, then step up into the root: the strongest pull in a blues.', fr: 'La tierce de l’accord V est un demi-ton sous la tonique. Jouez-la puis montez vers la tonique : l’attraction la plus forte du blues.' },
      notes: [[4, 0, 0, 0.5], [3, 2, 0.5, 0.5], [2, 1, 1, 0.5], [2, 2, 1.5, 2.5, 'h ~']] }),
    L('turnaround', 'Classic turnaround', 'Turnaround classique', { fam: 'minor', box: 1, over: 'turn', lvl: 2,
      tip: { en: 'Keep the root ringing on the high E string while the B string walks down a half step at a time (♭7, 6, ♭6, 5), then land on the V chord’s root. It hands the progression back to bar 1.', fr: 'Laissez sonner la tonique sur la corde de mi aigu pendant que la corde de si descend par demi-tons (♭7, 6, ♭6, 5), puis posez-vous sur la fondamentale du V. Le tour est joué : retour à la mesure 1.' },
      notes: [[4, 3, 0, 1], [5, 0, 0, 1], [4, 2, 1, 1], [5, 0, 1, 1], [4, 1, 2, 1], [5, 0, 2, 1], [4, 0, 3, 1], [5, 0, 3, 1], [1, 2, 4, 4, '~']] }),
    L('ending', 'Blues ending', 'Fin de blues', { fam: 'minor', box: 1, over: 'end', lvl: 2,
      tip: { en: 'Walk down the box, slip chromatically through the 5th, ♭5 and 4th, then hold the low root to close the song.', fr: 'Descendez la boîte, glissez chromatiquement par la quinte, la ♭5 et la quarte, puis tenez la tonique grave pour finir le morceau.' },
      notes: [[3, 2, 0, 0.5], [3, 0, 0.5, 0.5], [2, 2, 1, 0.5], [2, 0, 1.5, 0.5], [1, 2, 2, 0.5], [1, 1, 2.5, 0.5], [1, 0, 3, 0.5], [0, 3, 3.5, 0.5], [0, 0, 4, 4, '~']] }),
    L('minor-ending', 'Short minor ending', 'Fin mineure courte', { fam: 'minor', box: 1, over: 'end', lvl: 1,
      tip: { en: 'A one-bar descent through the box onto the low root. Short and safe to close any minor progression.', fr: 'Une descente d’une mesure dans la boîte jusqu’à la tonique grave. Courte et sûre pour conclure n’importe quelle progression mineure.' },
      notes: [[3, 0, 0, 0.5], [2, 2, 0.5, 0.5], [2, 0, 1, 0.5], [1, 2, 1.5, 0.5], [1, 0, 2, 0.5], [0, 3, 2.5, 0.5], [0, 0, 3, 1, '~']] }),
    L('pre-bend', 'Pre-bend and release', 'Tiré préparé et relâché', { fam: 'minor', box: 1, over: 'any', lvl: 2,
      tip: { en: 'Bend the string silently first, then pick it and let it come down. The note “sighs” downward, a very vocal effect.', fr: 'Tirez d’abord la corde sans la jouer, puis grattez-la et laissez-la redescendre. La note « soupire » vers le bas, un effet très vocal.' },
      notes: [[3, 2, 0, 1, 'r'], [3, 0, 1, 0.5], [2, 2, 1.5, 0.5], [2, 0, 2, 0.5], [1, 2, 2.5, 1.5, '~']] }),
    L('threes', 'Descending in threes', 'Descente par groupes de trois', { fam: 'minor', box: 1, over: 'any', lvl: 2,
      tip: { en: 'Groups of three notes stepping down the box in triplets. Sequences like this make a scale sound like music instead of an exercise.', fr: 'Des groupes de trois notes qui descendent la boîte en triolets. Ce genre de séquence fait sonner une gamme comme de la musique, pas comme un exercice.' },
      notes: [[5, 3], [5, 0], [4, 3], [5, 0], [4, 3], [4, 0], [4, 3], [4, 0], [3, 2], [4, 0], [3, 2], [3, 0]].map((x, k) => [x[0], x[1], tr3(k), k === 11 ? tr3(1) + 0.01 : tr3(1)]) }),
    L('triplet-repeat', 'Repeating triplet', 'Triolet répété', { fam: 'minor', box: 1, over: 'any', lvl: 2,
      tip: { en: 'Pull off on the high E, then hit the B string, and repeat. Start slowly: the rhythm has to stay even before you speed it up.', fr: 'Pull-off sur le mi aigu, puis la corde de si, et on répète. Commencez lentement : le rythme doit rester régulier avant d’accélérer.' },
      notes: [0, 1, 2, 3, 4, 5, 6, 7, 8].map((k) => [[5, 3], [5, 0, 'p'], [4, 3]][k % 3]).map((x, k) => [x[0], x[1], tr3(k), tr3(1)].concat(x[2] ? [x[2]] : [])).concat([[3, 2, 3, 1, 'b']]) }),

    /* ---------- minor pentatonic, box 2 ---------- */
    L('box2-bend', 'Box 2: bend to the root', 'Boîte 2 : tirer vers la tonique', { fam: 'minor', box: 2, over: 'I', lvl: 2,
      tip: { en: 'In box 2 the ♭7 on the B string bends up a whole step to the root. Release it, then walk down to the root on the D string.', fr: 'Dans la boîte 2, la ♭7 sur la corde de si se tire d’un ton jusqu’à la tonique. Relâchez, puis descendez jusqu’à la tonique sur la corde de ré.' },
      notes: [[4, 3, 0, 1, 'b'], [4, 3, 1, 0.5, 'r'], [3, 4, 1.5, 0.5], [3, 2, 2, 0.5], [2, 2, 2.5, 1.5, '~']] }),
    L('box2-high', 'Box 2: high bend', 'Boîte 2 : tiré aigu', { fam: 'minor', box: 2, over: 'I', lvl: 2,
      tip: { en: 'Bend the 4th on the high E string up to the 5th, the most singing spot in the box, then come down through the root to the 5th.', fr: 'Tirez la quarte sur le mi aigu jusqu’à la quinte, l’endroit qui « chante » le plus dans la boîte, puis redescendez par la tonique jusqu’à la quinte.' },
      notes: [[5, 5, 0, 1, 'b'], [5, 3, 1, 0.5], [4, 5, 1.5, 0.5], [4, 3, 2, 0.5], [3, 4, 2.5, 1.5, '~']] }),
    L('slide-boxes', 'Slide from box 1 to box 2', 'Glisser de la boîte 1 à la 2', { fam: 'minor', box: '1→2', over: 'any', lvl: 2,
      tip: { en: 'A slide on the G string carries you from box 1 into box 2. This is how players stop feeling stuck in one box.', fr: 'Un glissé sur la corde de sol vous fait passer de la boîte 1 à la boîte 2. C’est comme ça qu’on cesse de se sentir coincé dans une seule boîte.' },
      notes: [[3, 2, 0, 0.5], [3, 4, 0.5, 0.5, '/'], [4, 3, 1, 0.5], [4, 5, 1.5, 2.5, 'h ~']] }),

    /* ---------- major pentatonic ---------- */
    L('major-run', 'Sweet major run', 'Descente majeure', { fam: 'major', box: 'M', over: 'I', lvl: 1,
      tip: { en: 'Major pentatonic, pulling off down the top strings and ending on the 3rd. Bright and sweet: country, pop and major-key blues.', fr: 'Pentatonique majeure, en pull-offs sur les cordes aiguës, jusqu’à la tierce. Lumineux et doux : country, pop et blues majeur.' },
      notes: [[5, 0, 0, 0.5], [5, -3, 0.5, 0.5, 'p'], [4, 0, 1, 0.5], [4, -3, 1.5, 0.5, 'p'], [3, -1, 2, 0.5], [3, -3, 2.5, 0.5, 'p'], [4, -3, 3, 1, '~']] }),
    L('country-bend', '2-to-3 country bend', 'Tiré country 2 → 3', { fam: 'major', box: 'M', over: 'I', lvl: 2,
      tip: { en: 'Bend the 2nd up a whole step to the major 3rd, the signature country move. Then the 5th, the root, and the bend again.', fr: 'Tirez la seconde d’un ton jusqu’à la tierce majeure, le geste country par excellence. Puis la quinte, la tonique, et le tiré encore.' },
      notes: [[3, -1, 0, 1, 'b'], [4, 0, 1, 0.5], [5, 0, 1.5, 0.5], [4, 0, 2, 0.5], [3, -1, 2.5, 0.5, 'b'], [3, -3, 3, 1, '~']] }),
    L('third-slide', 'Slide into the 3rd', 'Glisser vers la tierce', { fam: 'major', box: 'M', over: 'I', lvl: 1,
      tip: { en: 'Slide up into the major 3rd and let it ring. The 3rd is the note that makes the I chord sound major, so landing on it always sounds right.', fr: 'Glissez vers la tierce majeure et laissez-la sonner. C’est la tierce qui rend l’accord I majeur : s’y poser sonne toujours juste.' },
      notes: [[3, -3, 0, 0.5], [3, -1, 0.5, 0.5, 'h'], [4, -3, 1, 1.5, 'si'], [3, -1, 2.5, 0.5], [3, -3, 3, 1, '~']] }),
    L('major-iv', 'Major line over the IV', 'Phrase majeure sur le IV', { fam: 'major', box: 'M', over: 'IV', lvl: 2,
      tip: { en: 'Over the IV chord, the key’s 6th is its major 3rd. Ending on it makes the line follow the change.', fr: 'Sur l’accord IV, la sixte de la tonalité est sa tierce majeure. Finir dessus fait suivre le changement d’accord.' },
      notes: [[5, 0, 0, 0.5], [5, -3, 0.5, 0.5, 'p'], [4, 0, 1, 0.5], [3, -1, 1.5, 0.5], [2, -1, 2, 2, '~']] }),
    L('major-ending', 'Major-key ending', 'Fin majeure', { fam: 'major', box: 'M', over: 'end', lvl: 1,
      tip: { en: 'Down the major pentatonic and onto the root. Short and conclusive.', fr: 'On descend la pentatonique majeure jusqu’à la tonique. Court et conclusif.' },
      notes: [[5, -3, 0, 0.5], [4, 0, 0.5, 0.5], [4, -3, 1, 0.5], [3, -1, 1.5, 0.5], [3, -3, 2, 2, '~']] }),
  ];

  const STD = [40, 45, 50, 55, 59, 64];
  const SEMI = ['R', '♭2', '2', '♭3', '3', '4', '♭5', '5', '♭6', '6', '♭7', '7'];
  const BEND = { b: 2, hb: 1, qb: 0.5 };

  LICKS.forEach((l) => {
    l.notes = l.notes.map((x) => ({ s: x[0], f: x[1], t: x[2], d: x[3], tech: x[4] ? x[4].split(' ') : [] }));
    const end = Math.max(...l.notes.map((n) => n.t + n.d));
    l.bars = Math.max(1, Math.ceil(end / 4 - 0.01));
    const tech = new Set();
    l.notes.forEach((n) => n.tech.forEach((t) => tech.add(t in BEND || t === 'r' ? 'bend' : t === '~' ? 'vibrato' : t === 'h' || t === 'p' ? 'legato' : t === '/' || t === 'si' ? 'slide' : t)));
    const starts = l.notes.map((n) => n.t);
    if (starts.some((t, i) => starts.indexOf(t) !== i)) tech.add('doubleStop');
    l.techs = [...tech];
    l.scale = l.scale || (l.fam === 'major' ? 'majorPent' : 'minorPent');
  });

  // Which licks suit this key and style.
  const MINORISH = new Set(['minor', 'dorian', 'phrygian']);
  const MAJORISH = new Set(['major', 'mixolydian', 'lydian']);
  const BLUESY = new Set(['blues', 'rock', 'punk', 'metal', 'funk', 'soul', 'gospel', 'country']);
  function fits(l, key, styleId) {
    if (l.fam === 'minor') {
      if (key.mode === 'phrygianDom' || key.mode === 'lydian') return false;
      if (MINORISH.has(key.mode)) return true;
      return BLUESY.has(styleId); // in a major key, minor pentatonic is the blues-rock sound
    }
    return MAJORISH.has(key.mode);
  }

  /* Concrete notes in a key and tuning.
   * The shape is placed so the key root sits on the low E string between frets 0 and 12,
   * moved up an octave if a bend would land on an open string. Other tunings are re-fingered
   * string by string, keeping each note on the matching string where possible.
   */
  function realize(l, key, tuning) {
    const tun = tuning || STD;
    let base = mod(key.tonic.pc - 4, 12);
    const fits0 = (b) => l.notes.every((n) => b + n.f >= (n.tech.some((t) => t in BEND || t === 'r' || t === 'si') ? 1 : 0) && b + n.f <= 17);
    if (!fits0(base)) base += 12;
    const extra = tun.length - 6;
    const notes = l.notes.map((n) => {
      const m = STD[n.s] + base + n.f;
      let s = n.s + extra;
      let f = m - tun[s];
      // re-finger for other tunings: try neighbouring strings if this one can't reach the note
      if (f < 0 || f > 20) {
        const cand = tun.map((o, i) => ({ i, f: m - o })).filter((c) => c.f >= 0 && c.f <= 20).sort((a, b) => Math.abs(a.i - s) - Math.abs(b.i - s));
        if (cand.length) { s = cand[0].i; f = cand[0].f; }
      }
      const rel = mod(m - key.tonic.pc, 12);
      return Object.assign({}, n, { s, f, m, label: SEMI[rel] });
    });
    const standard = tun.length === 6 ? tun.every((x, i) => x === STD[i]) : tun.slice(extra).every((x, i) => x === STD[i]);
    return { notes, base, refingered: !standard };
  }

  // Where it goes in the progression: the first bar whose chord matches, or the last bars for turnarounds/endings.
  const OVER_ROOT = { I: 0, IV: 5, V: 7 };
  function place(l, chords) {
    let start = 0;
    const bars = [];
    chords.forEach((c) => { bars.push({ start, rootPc: c.rootPc, bar: Math.floor(start / 4) }); start += c.beats; });
    const total = start;
    const totalBars = Math.round(total / 4);
    if (l.over === 'turn' || l.over === 'end') {
      const b = Math.max(0, totalBars - l.bars);
      return { startBeat: b * 4, bar: b, found: true, totalBars };
    }
    if (l.over in OVER_ROOT) {
      const want = OVER_ROOT[l.over];
      // Prefer a chord that starts on a bar line; otherwise take it wherever it starts.
      const hit = bars.find((x) => x.rootPc === want && x.start % 4 === 0 && x.start + l.bars * 4 <= total)
        || bars.find((x) => x.rootPc === want && x.start + l.bars * 4 <= total + 2);
      if (hit) return { startBeat: hit.start, bar: hit.bar, found: true, totalBars };
      return { startBeat: 0, bar: 0, found: false, totalBars };
    }
    return { startBeat: 0, bar: 0, found: true, totalBars };
  }

  C.licks = { LICKS, fits, realize, place, BEND };
})(typeof window !== 'undefined' ? (window.Cadence = window.Cadence || {}) : (globalThis.Cadence = globalThis.Cadence || {}));
