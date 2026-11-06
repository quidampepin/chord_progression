/* Cadence — licks to try over a progression.
 *
 * A lick is written as a melody in SCALE DEGREES, not frets: "4:1:b 5:.5 4:.5 b3:.5 R:1.5:~".
 * The app then fingers it into whichever position of its scale you choose, so the same phrase
 * can be played in box 1, box 3 or a 3-notes-per-string position, in any key and tuning.
 *
 * Token = NOTES:LENGTH:TECHNIQUE (length and technique optional; tokens follow each other in time)
 *   NOTES      one degree, or several joined by + for a double-stop (they sound together)
 *   degree     R b2 2 #2 b3 3 4 #4 b5 5 #5 b6 6 b7 7, then ^ (octave up) or _ (octave down), repeatable
 *              per-note technique in braces: 4{b}+5 bends only the 4
 *   x          a rest
 *   LENGTH     in beats: 1, .5, 1.5, 2… · t = triplet (1/3) · 2t = 2/3      (default .5)
 *   TECHNIQUE  joined by +:  b whole-step bend · hb half-step bend · qb quarter-tone curl
 *              r pre-bend and release · h hammer-on · p pull-off · / slide from the previous note
 *              si slide in from below · ~ vibrato
 * over: I, IV, V (fits over that chord), turn (turnaround), end (ending), iiVI (jazz ii–V–I), any
 * chrom: degrees that are deliberately outside the scale (passing notes), so tests accept them.
 */
(function (C) {
  'use strict';
  const T = C.theory;
  const S = C.scales;
  const { mod } = T;

  const L = (id, scale, over, lvl, en, fr, line, tipEn, tipFr, extra) =>
    Object.assign({ id, scale, over, lvl, n: { en, fr }, line, tip: { en: tipEn, fr: tipFr } }, extra || {});

  const LICKS = [
    /* ===== minor pentatonic ===== */
    L('bend-five', 'minorPent', 'I', 1, 'Bend up to the 5th', 'Tirer jusqu’à la quinte', '4:1:b 5:.5 4:.5 b3:.5 R:1.5:~',
      'Bend the 4th a whole step until it sounds like the 5th, then walk down to the root. The note right after the bend is the bend’s target pitch: they should match.',
      'Tirez la quarte d’un ton jusqu’à entendre la quinte, puis redescendez vers la tonique. La note qui suit le tiré est sa hauteur cible : elles doivent être identiques.'),
    L('curl', 'minorPent', 'I', 1, 'Blues curl on the ♭3', 'Petit tiré sur la ♭3', 'b3^:1:qb R^:1 b7:1 5:1:~',
      'Push the ♭3 up just a little, about a quarter tone, not all the way to the major 3rd. That in-between pitch is the essence of the blues.',
      'Poussez la ♭3 juste un peu, un quart de ton, sans aller jusqu’à la tierce majeure. Cette note « entre les deux », c’est l’essence du blues.'),
    L('walk-down', 'minorPent', 'any', 1, 'Walk down the box', 'Descendre la boîte', 'b3^ R^ b7 5 4 b3 R:1:~',
      'Straight eighth notes down the scale, ending on the root. Play it slowly and evenly first: it’s the backbone of many longer lines.',
      'Des croches régulières en descendant la gamme, jusqu’à la tonique. Jouez-la d’abord lentement et régulièrement : c’est la base de bien des phrases.'),
    L('hammer-climb', 'minorPent', 'any', 1, 'Hammer-on climb', 'Montée en hammer-on', '4_ 5_::h b7_ R::h b3 4::h b3::p R',
      'Pick only the first note on each string and hammer the second. The line gets smoother and you pick half as much.',
      'Ne grattez que la première note de chaque corde et faites la deuxième en hammer-on. La phrase est plus liée et vous grattez deux fois moins.'),
    L('slide-in', 'minorPent', 'I', 1, 'Slide in and sing', 'Glisser et chanter', 'R^:2:si+~ b7 5:1.5:~',
      'Slide into the root from two frets below and hold it with vibrato. One note played with feel already sounds like a solo.',
      'Glissez vers la tonique depuis deux cases plus bas et tenez-la avec vibrato. Une seule note jouée avec du sentiment, c’est déjà un solo.'),
    L('question-answer', 'minorPent', 'I', 1, 'Question and answer', 'Question et réponse', 'R^ b7 5:2:~ x:1 5 4 b3 R:2.5:~',
      'The first phrase stops on the 5th, which sounds unfinished: a question. The answer lands on the root. The silence between them is part of the music.',
      'La première phrase s’arrête sur la quinte, qui sonne inachevée : une question. La réponse se pose sur la tonique. Le silence entre les deux fait partie de la musique.'),
    L('call-high', 'minorPent', 'I', 1, 'Call and answer, high', 'Question-réponse aiguë', 'R^ R^ b7 R^:1.5:~ x:1 b3^::qb R^ b7 5 R:2:~',
      'A short call around the high root, a breath, then an answer that walks down home. Keep the same rhythm in both halves so they sound related.',
      'Un appel court autour de la tonique aiguë, une respiration, puis une réponse qui redescend. Gardez le même rythme dans les deux moitiés pour qu’elles se répondent.'),
    L('slide-b3', 'minorPent', 'any', 1, 'Slide into the ♭3', 'Glisser vers la ♭3', 'b3:1:si 4 b3 R b7_ R:1:~',
      'A slide into the ♭3 gives a vocal, sliding attack, then a small turn around the root.',
      'Un glissé vers la ♭3 donne une attaque chantée, puis un petit tour autour de la tonique.'),
    L('octaves', 'minorPent', 'any', 1, 'Root, octave, answer', 'Tonique, octave, réponse', 'R_ R b7_ R b3:1:qb R:1:~',
      'Jump from the low root to the octave above: an easy way to know where you are on the neck, then curl the ♭3.',
      'Sautez de la tonique grave à l’octave : un moyen simple de savoir où l’on est sur le manche, puis un petit tiré sur la ♭3.'),
    L('unison', 'minorPent', 'I', 2, 'Unison bend', 'Tiré à l’unisson', '4{b}+5:1 x 4{b}+5:.5 R^:2:~',
      'Bend the 4th while holding the 5th on the next string: when the bend reaches the same pitch, the wobble between them stops. Great training for bending in tune.',
      'Tirez la quarte en tenant la quinte sur la corde voisine : quand le tiré atteint la même hauteur, le battement disparaît. Excellent pour tirer juste.'),
    L('rock-repeat', 'minorPent', 'I', 2, 'Rock repeat', 'Répétition rock', '4{b}:t 5:t R^:t 4{b}:t 5:t R^:t 4{b}:t 5:t R^:t 5:1:~',
      'Bend, 5th, root, three times in triplets. Repetition is a big part of rock soloing: the ear loves a pattern.',
      'Tiré, quinte, tonique, trois fois en triolets. La répétition est au cœur du solo rock : l’oreille adore les motifs.'),
    L('over-iv', 'minorPent', 'IV', 2, 'Follow the IV chord', 'Suivre l’accord IV', 'b3 4::h 5 4 b3 R:1.5:~',
      'Over the IV chord, the key’s 4th is its root, the ♭3 is its ♭7 and the key’s root is its 5th. Ending there makes the line follow the change.',
      'Sur l’accord IV, la quarte est sa fondamentale, la ♭3 sa ♭7 et la tonique sa quinte. Finir là fait suivre le changement d’accord.'),
    L('iv-third', 'minorPent', 'IV', 2, 'Bend to the IV’s 3rd', 'Tirer vers la tierce du IV', '5:1:b 5 4 b3:2:~',
      'Bend the 5th up a whole step: you reach the key’s 6th, the major 3rd of the IV chord. It only sounds sweet over the IV, so save it for that moment.',
      'Tirez la quinte d’un ton : vous atteignez la sixte, la tierce majeure de l’accord IV. Elle ne sonne bien que sur le IV : gardez-la pour ce moment.'),
    L('box3-iv', 'minorPent', 'IV', 2, 'Climb to the IV’s root', 'Monter vers la fondamentale du IV', 'b3 4 5 b7 R^ b7 4:1:~',
      'Up the scale and back, landing on the key’s 4th, which is the root of the IV chord. Try it in position 3.',
      'On monte la gamme et on revient se poser sur la quarte, fondamentale de l’accord IV. Essayez-la en position 3.', { pos: 3 }),
    L('over-v', 'minorPent', 'V', 2, 'Lean on the V', 'S’appuyer sur le V', '4:1:b 5 4 5:2:~',
      'Bend the 4th up to the 5th: that’s the root of the V chord. Touch the 4th again (its ♭7) and come back. You’re playing the chord’s own notes.',
      'Tirez la quarte jusqu’à la quinte : c’est la fondamentale du V. Retouchez la quarte (sa ♭7) et revenez. Vous jouez les notes de l’accord lui-même.'),
    L('v-leading', 'minorPent', 'V', 2, 'Half step into the I', 'Demi-ton vers le I', 'x:2 5 4 7_:1 R:4:h+~',
      'The 3rd of the V chord sits a half step below the key’s root. Play it at the end of the V bar, then step up into the root right as the I chord arrives: the strongest pull in a blues.',
      'La tierce de l’accord V est un demi-ton sous la tonique. Jouez-la à la fin de la mesure du V, puis montez vers la tonique au moment où arrive l’accord I : l’attraction la plus forte du blues.', { chrom: ['7'] }),
    L('box4-run', 'minorPent', 'any', 2, 'High run down', 'Descente aiguë', '5^ 4^ b3^ R^ b7 5 R:1:~',
      'A descent from high on the neck. In position 4 it starts on the 5th under your index finger.',
      'Une descente depuis le haut du manche. En position 4, elle part de la quinte sous l’index.', { pos: 4 }),
    L('box5-bend', 'minorPent', 'I', 2, 'Bend the ♭7 to the root', 'Tirer la ♭7 vers la tonique', 'b7:1:b R^ b7 5 4 5:1:~',
      'The ♭7 bends a whole step up to the root. A strong, singing move: check the pitch against the root you just played.',
      'La ♭7 se tire d’un ton jusqu’à la tonique. Un geste fort et chantant : vérifiez la hauteur avec la tonique que vous venez de jouer.', { pos: 5 }),
    L('pre-bend', 'minorPent', 'any', 2, 'Pre-bend and release', 'Tiré préparé et relâché', '4:1:r b3 R b7_ 5_:1.5:~',
      'Bend the string silently first, then pick it and let it come down. The note “sighs” downward, a very vocal effect.',
      'Tirez d’abord la corde sans la jouer, puis grattez-la et laissez-la redescendre. La note « soupire » vers le bas, un effet très vocal.'),
    L('threes', 'minorPent', 'any', 2, 'Descending in threes', 'Descente par groupes de trois', 'b3^:t R^:t b7:t R^:t b7:t 5:t b7:t 5:t 4:t 5:t 4:t b3:t',
      'Groups of three notes stepping down the scale in triplets. Sequences like this make a scale sound like music instead of an exercise.',
      'Des groupes de trois notes qui descendent la gamme en triolets. Ce genre de séquence fait sonner une gamme comme de la musique.'),
    L('triplet-repeat', 'minorPent', 'any', 2, 'Repeating triplet', 'Triolet répété', 'b3^:t R^:t:p b7:t b3^:t R^:t:p b7:t b3^:t R^:t:p b7:t 4:1:b',
      'Pull off on the top string, then the next string, and repeat. Keep the rhythm even before speeding up.',
      'Pull-off sur la corde aiguë, puis la corde suivante, et on répète. Gardez un rythme régulier avant d’accélérer.'),
    L('berry', 'minorPent', 'I', 2, 'Double-stop shuffle', 'Double-cordes shuffle', 'b7+b3^:2t b7+b3^:t b7+b3^:2t b7+b3^:t 5+R^:2:/+~',
      'Two strings at once with one finger, in a swung rhythm, then slide both down onto the 5th and root. The classic rock-and-roll sound.',
      'Deux cordes d’un seul doigt, en rythme swing, puis glissez les deux vers la quinte et la tonique. Le son rock’n’roll par excellence.'),
    L('turnaround', 'minorPent', 'turn', 2, 'Classic turnaround', 'Turnaround classique', 'b7+R^:1 6+R^:1 b6+R^:1 5+R^:1 5_:4:~',
      'Keep the root ringing on top while the lower note walks down a half step at a time (♭7, 6, ♭6, 5), then land on the V chord’s root. It hands the progression back to bar 1.',
      'Laissez sonner la tonique en haut pendant que la note du dessous descend par demi-tons (♭7, 6, ♭6, 5), puis posez-vous sur la fondamentale du V. Retour à la mesure 1.', { chrom: ['6', '♭6'] }),
    L('minor-ending', 'minorPent', 'end', 1, 'Short minor ending', 'Fin mineure courte', 'b3 R b7_ 5_ 4_ b3_ R_:1:~',
      'A one-bar descent onto the low root. Short and safe to close any minor progression.',
      'Une descente d’une mesure jusqu’à la tonique grave. Courte et sûre pour conclure une progression mineure.'),

    /* ===== blues scale (minor pentatonic + ♭5) ===== */
    L('blue-a', 'blues', 'any', 1, 'Blue note, low', 'Blue note grave', '4_ b5_::h 5_::h 4_::p b3_ R_:1.5:~',
      'Hammer through the ♭5, the “blue note”, on the way from the 4th to the 5th. Never stop on it: it’s a passing tension.',
      'Passez par la ♭5, la « blue note », en hammer-on de la quarte à la quinte. Ne vous y arrêtez jamais : c’est une tension de passage.'),
    L('blue-g', 'blues', 'any', 1, 'Blue note, middle', 'Blue note médium', 'b3 4::h b5::h 4::p b3::p R:1.5:~',
      'Same idea higher up: ♭3, 4, ♭5 and back, all on one string, then drop to the root.',
      'Même idée plus haut : ♭3, quarte, ♭5 et retour sur une seule corde, puis la tonique.'),
    L('low-riff', 'blues', 'any', 1, 'Low blues riff', 'Riff blues grave', 'R_ b3_ 4_ b5_::h 5_::h 4_::p b3_ R_',
      'A riff on the lowest strings. It works as a fill between vocal lines as much as in a solo.',
      'Un riff sur les cordes graves. Il sert autant de remplissage entre deux phrases chantées que dans un solo.'),
    L('blues-triplets', 'blues', 'any', 2, 'Blues triplet descent', 'Descente blues en triolets', 'R^:t b7:t 5:t b5:t 4:t b3:t R:2:~',
      'Six notes in triplets sliding down through the blue note, then a long root. The rhythm does half the work.',
      'Six notes en triolets qui glissent par la blue note, puis une longue tonique. Le rythme fait la moitié du travail.'),
    L('ending', 'blues', 'end', 2, 'Blues ending', 'Fin de blues', '4 b3 R b7_ 5_ b5_ 4_ b3_ R_:4:~',
      'Walk down the scale, slip chromatically through the 5th, ♭5 and 4th, then hold the low root to close the song.',
      'Descendez la gamme, glissez chromatiquement par la quinte, la ♭5 et la quarte, puis tenez la tonique grave pour finir.'),

    /* ===== major pentatonic & country ===== */
    L('major-run', 'majorPent', 'I', 1, 'Sweet major run', 'Descente majeure', 'R^ 6::p 5 3::p 2 R::p 3:1:~',
      'Pulling off down the major pentatonic and ending on the 3rd. Bright and sweet: country, pop and major-key blues.',
      'Des pull-offs en descendant la pentatonique majeure, jusqu’à la tierce. Lumineux : country, pop et blues majeur.'),
    L('major-climb', 'majorPent', 'I', 1, 'Major climb', 'Montée majeure', 'R 2 3 5 6 R^ 6:1:~',
      'Straight up the major pentatonic, ending on the 6th: an open, happy sound.',
      'On monte la pentatonique majeure et on finit sur la sixte : un son ouvert et joyeux.'),
    L('major-qa', 'majorPent', 'I', 1, 'Major question and answer', 'Question-réponse majeure', '3 5 6:1:~ x:2 6 5 3 2 R:2:~',
      'A rising question stopping on the 6th, two beats of silence, then an answer walking home to the root.',
      'Une question qui monte jusqu’à la sixte, deux temps de silence, puis une réponse qui revient à la tonique.'),
    L('third-slide', 'majorPent', 'I', 1, 'Slide into the 3rd', 'Glisser vers la tierce', 'R 2::h 3:1.5:si 2 R:1:~',
      'Slide up into the major 3rd and let it ring. The 3rd makes the I chord sound major, so landing on it always sounds right.',
      'Glissez vers la tierce majeure et laissez-la sonner. C’est la tierce qui rend l’accord majeur : s’y poser sonne toujours juste.'),
    L('country-bend', 'majorPent', 'I', 2, '2-to-3 country bend', 'Tiré country 2 → 3', '2:1:b 5 R^ 5 2::b R:1:~',
      'Bend the 2nd up a whole step to the major 3rd, the signature country move. Then the 5th, the root and the bend again.',
      'Tirez la seconde d’un ton jusqu’à la tierce majeure, le geste country par excellence. Puis la quinte, la tonique, et le tiré encore.'),
    L('chicken', 'majorPent', 'I', 2, 'Country triplet pickup', 'Levée country en triolets', 'R 2 3 R 2:t 3:t 5:t 3:1:~',
      'Eighth notes, then a quick triplet that snaps up to the 5th and back to the 3rd. Pick it crisp and short.',
      'Des croches, puis un triolet rapide qui claque jusqu’à la quinte et revient sur la tierce. Grattez net et court.'),
    L('major-iv', 'majorPent', 'IV', 2, 'Major line over the IV', 'Phrase majeure sur le IV', 'R^ 6::p 5 2 6_:2:~',
      'Over the IV chord, the key’s 6th is its major 3rd. Ending on it makes the line follow the change.',
      'Sur l’accord IV, la sixte de la tonalité est sa tierce majeure. Finir dessus fait suivre le changement d’accord.'),
    L('major-iv-root', 'majorPent', 'IV', 1, 'Rock the IV', 'Balancer sur le IV', 'R^ 6 5 6 R^:1 6:1:~',
      'Root and 6th of the key are the 5th and 3rd of the IV chord: rocking between them outlines the IV.',
      'La tonique et la sixte sont la quinte et la tierce de l’accord IV : alterner entre elles dessine le IV.'),
    L('major-v', 'majorPent', 'V', 2, 'Major line over the V', 'Phrase majeure sur le V', '2:1:b 3 2 R 6_ 5_:1:~',
      'Bend the 2nd (the V chord’s 5th) up, then step down to the key’s 5th, the root of the V chord.',
      'Tirez la seconde (la quinte du V), puis descendez jusqu’à la quinte de la tonalité, fondamentale du V.'),
    L('major-turn', 'majorPent', 'turn', 2, 'Major turnaround', 'Turnaround majeur', 'R^ 6 5 3 5 6 R^:1 2 3 2 R 6_ 5_:1.5:~',
      'One bar over the I, then a bar that lands on the 5th, the root of the V chord, ready to go back to the top.',
      'Une mesure sur le I, puis une mesure qui se pose sur la quinte, fondamentale du V, prête à repartir au début.'),
    L('major-ending', 'majorPent', 'end', 1, 'Major-key ending', 'Fin majeure', '6 5 3 2 R:2:~',
      'Down the major pentatonic and onto the root. Short and conclusive.',
      'On descend la pentatonique majeure jusqu’à la tonique. Court et conclusif.'),
    L('b3-to-3', 'majorBlues', 'I', 1, 'Blues ♭3 into the 3rd', 'La ♭3 bleue vers la tierce', 'R^ 6 5 b3 3::h R:1.5:~',
      'Hammer from the ♭3 to the major 3rd: a little minor smear inside a major sound. Country and blues players use it all the time.',
      'Un hammer-on de la ♭3 à la tierce majeure : une touche de mineur dans un son majeur. Country et blues l’utilisent sans arrêt.'),

    /* ===== Mixolydian / dominant blues ===== */
    L('mixo-3rds', 'mixolydian', 'I', 1, 'Minor to major 3rd', 'De la tierce mineure à la majeure', 'R b3 3::h 5 6 5 b7:1:~',
      'Over a dominant 7th chord, slide from the ♭3 into the major 3rd, then lean on the ♭7: the sound of the I7 chord in a blues.',
      'Sur un accord de septième de dominante, passez de la ♭3 à la tierce majeure, puis appuyez sur la ♭7 : le son du I7 dans un blues.', { chrom: ['♭3'] }),
    L('mixo-run', 'mixolydian', 'any', 1, 'Mixolydian run', 'Descente mixolydienne', 'b7 6 5 4 3 2 R:1:~',
      'Down the Mixolydian scale: a major scale with a ♭7. That ♭7 is what makes it sound bluesy and rock instead of sweet.',
      'On descend le mode mixolydien : une gamme majeure avec une ♭7. C’est cette ♭7 qui le rend blues et rock plutôt que sucré.'),
    L('mixo-arp', 'mixolydian', 'I', 2, 'Dominant 7th arpeggio', 'Arpège de septième de dominante', 'R 3 5 b7 R^ b7 5 3',
      'Up and down the notes of the I7 chord itself. Every note is a chord tone, so it always fits; add scale notes between them later.',
      'On monte et on descend les notes de l’accord I7. Chaque note fait partie de l’accord : ça va toujours. Ajoutez des notes de passage ensuite.'),
    L('mixo-iv', 'mixolydian', 'IV', 2, 'Dominant line over the IV7', 'Phrase sur le IV7', 'R^ b7 6 4 b3 R 6_:1:~',
      'Over the IV7 chord, the key’s ♭3 becomes its ♭7 and the key’s 6th its 3rd. This line visits both.',
      'Sur l’accord IV7, la ♭3 de la tonalité devient sa ♭7 et la sixte sa tierce. Cette phrase passe par les deux.', { chrom: ['♭3'] }),
    L('mixo-curl', 'mixolydian', 'I', 2, 'Bend the 6th to the ♭7', 'Tirer la sixte vers la ♭7', '6:1:hb 5 3 R:2:~',
      'A half-step bend from the 6th to the ♭7, the most Mixolydian note there is, then down to the root.',
      'Un tiré d’un demi-ton de la sixte à la ♭7, la note la plus mixolydienne qui soit, puis la tonique.'),
    L('funk-stops', 'mixolydian', 'any', 2, 'Funky double-stops', 'Double-cordes funky', '5+R^ x 5+R^ 6+2^ x 6+2^ 5+R^:1',
      'Two-note stabs a 4th apart, with rests. In funk the silences matter as much as the notes: keep them tight.',
      'Des attaques de deux notes à la quarte, avec des silences. En funk, les silences comptent autant que les notes : gardez-les serrés.'),

    /* ===== Dorian ===== */
    L('dorian-6', 'dorian', 'I', 1, 'Lean on the Dorian 6th', 'Appuyer la sixte dorienne', 'R 2 b3 4 5 6:1:~ 5',
      'Dorian is natural minor with a raised 6th. Holding that 6th is what makes it sound Dorian: brighter, jazzier, funkier.',
      'Le dorien, c’est le mineur naturel avec une sixte haussée. Tenir cette sixte, c’est ce qui le fait sonner dorien : plus lumineux, plus funky.'),
    L('dorian-iv', 'dorian', 'IV', 2, 'Over the Dorian IV', 'Sur le IV dorien', 'R^ 6 5 6 4:2:~',
      'In Dorian the IV chord is major. The 6th is its 3rd and the 4th its root: end there to follow the change.',
      'En dorien, l’accord IV est majeur. La sixte est sa tierce et la quarte sa fondamentale : finissez là pour suivre le changement.'),
    L('dorian-funk', 'dorian', 'any', 2, 'Funky Dorian riff', 'Riff dorien funky', 'R x b3 4 6 4 b3 R',
      'A short riff with a rest after the first note. Repeat it and lock it to the groove.',
      'Un riff court avec un silence après la première note. Répétez-le et calez-le sur le groove.'),
    L('dorian-pent', 'dorian', 'any', 1, 'Pentatonic plus the 6th', 'Pentatonique plus la sixte', 'R^ b7 6 5 b3 4 R:1:~',
      'Your minor pentatonic with one extra note, the 6th. The simplest way to sound Dorian.',
      'Votre pentatonique mineure avec une note de plus, la sixte. Le moyen le plus simple de sonner dorien.'),
    L('dorian-9', 'dorian', 'I', 2, 'Minor 9 arpeggio', 'Arpège mineur 9', 'R b3 5 b7 2^:1 b7 5',
      'The notes of a minor 9 chord: R, ♭3, 5, ♭7, 9. Arpeggios like this are smooth, soulful and always on the chord.',
      'Les notes d’un accord mineur 9 : tonique, ♭3, quinte, ♭7, neuvième. Ce genre d’arpège est doux, soul, et toujours dans l’accord.'),

    /* ===== natural minor (Aeolian) ===== */
    L('aeolian-b6', 'aeolian', 'I', 1, 'The sad ♭6', 'La ♭6 mélancolique', '5 b6:1 5 4 b3 R:1:~',
      'Natural minor’s ♭6 sits a half step above the 5th. Leaning on it and falling back gives that sad, dramatic sound.',
      'La ♭6 du mineur naturel est un demi-ton au-dessus de la quinte. S’y appuyer puis retomber donne ce son triste et dramatique.'),
    L('aeolian-climb', 'aeolian', 'any', 1, 'Natural minor climb', 'Montée en mineur naturel', 'R:t 2:t b3:t 4:t 5:t b6:t b7:1 R^:1:~',
      'All seven notes of natural minor in a triplet run up to the octave.',
      'Les sept notes du mineur naturel en triolets jusqu’à l’octave.'),
    L('aeolian-bvi', 'aeolian', 'any', 1, 'Toward the ♭VI', 'Vers le ♭VI', 'R 2 b3 5 b6:1:~ 5:1',
      'The ♭6 is the root of the ♭VI chord that natural-minor progressions love. Hold it, then resolve down.',
      'La ♭6 est la fondamentale de l’accord ♭VI, si fréquent en mineur. Tenez-la, puis résolvez vers le bas.'),
    L('aeolian-ballad', 'aeolian', 'I', 2, 'Minor ballad phrase', 'Phrase de ballade mineure', 'b3^:1 2^ R^ b7:1 5:1 b6:1 5 4 b3:2:~',
      'A slow two-bar melody: high, then falling through the ♭6. Play it like a singer, with vibrato on the long notes.',
      'Une mélodie lente sur deux mesures : en haut, puis qui descend par la ♭6. Jouez-la comme un chanteur, avec vibrato sur les notes longues.'),
    L('aeolian-rock', 'aeolian', 'any', 2, 'Minor rock lead', 'Solo rock mineur', 'R^ b7 b6 b7 R^ b7 5:1:~',
      'Circling the root through the ♭7 and ♭6: a classic hard-rock and metal shape.',
      'On tourne autour de la tonique par la ♭7 et la ♭6 : une forme classique du hard rock et du métal.'),

    /* ===== harmonic minor ===== */
    L('harm-v', 'harmonicMinor', 'V', 2, 'Leading tone over the V', 'La sensible sur le V', 'x 5 b6 5 4 b3 2 7_ R:4:~',
      'Over the major V chord, harmonic minor’s raised 7th is the leading tone. It sits a half step below the root and pulls hard into it.',
      'Sur l’accord V majeur, la 7e haussée de la mineure harmonique est la sensible. Elle est un demi-ton sous la tonique et y conduit fortement.'),
    L('harm-dim', 'harmonicMinor', 'V', 2, 'Diminished arpeggio', 'Arpège diminué', '7_:t 2:t 4:t b6:t 4:t 2:t 7_:2 R:4:~',
      'The 7, 2, 4 and ♭6 of harmonic minor form a diminished chord, the most tense sound over the V. It resolves onto the root.',
      'Les degrés 7, 2, 4 et ♭6 de la mineure harmonique forment un accord diminué, le son le plus tendu sur le V. Il se résout sur la tonique.'),
    L('neo-run', 'harmonicMinor', 'any', 2, 'Neoclassical run', 'Course néoclassique', 'R^:t 7:t b6:t 5:t 4:t b3:t 2:t R:t 7_:t R:1:~',
      'A fast descent through harmonic minor with its exotic gap between ♭6 and 7. The sound of neoclassical metal.',
      'Une descente rapide dans la mineure harmonique, avec son intervalle exotique entre ♭6 et 7. Le son du métal néoclassique.'),

    /* ===== Phrygian dominant & Phrygian ===== */
    L('flamenco-b2', 'phrygianDom', 'I', 1, 'Flamenco ♭2 to root', 'Du ♭2 à la tonique, flamenco', '5 4 3 b2 R:2:~',
      'Down to the ♭2 and onto the root: the half-step fall that defines flamenco and Middle-Eastern sounds.',
      'On descend jusqu’au ♭2 puis la tonique : la chute d’un demi-ton qui définit le flamenco et les sons orientaux.'),
    L('phrygdom-run', 'phrygianDom', 'any', 2, 'Exotic run', 'Course exotique', 'R:t b2:t 3:t 4:t 5:t b6:t b7:t b6:t 5:t 3 R',
      'Up Phrygian dominant in triplets and back. The gap between ♭2 and 3 gives it its exotic colour.',
      'On monte le phrygien dominant en triolets et on revient. L’écart entre ♭2 et 3 lui donne sa couleur exotique.'),
    L('phryg-chug', 'phrygian', 'I', 1, 'Phrygian half-step', 'Demi-ton phrygien', 'R b2 R b2 b3 b2 R:1:~',
      'Root and ♭2, a half step apart, back and forth: the dark, heavy sound of Phrygian metal.',
      'La tonique et le ♭2, à un demi-ton, en alternance : le son sombre et lourd du métal phrygien.'),
    L('phryg-climb', 'phrygian', 'any', 2, 'Phrygian climb', 'Montée phrygienne', 'R b2 b3 4 5 b6 5:1:~',
      'Up the Phrygian scale to the ♭6 and back to the 5th.',
      'On monte le mode phrygien jusqu’à la ♭6 et on revient sur la quinte.'),
    L('phryg-trip', 'phrygian', 'any', 2, 'Dark triplets', 'Triolets sombres', 'R^:t b7:t b6:t b7:t b6:t 5:t b6:t 5:t 4:t 5:1:~',
      'Overlapping triplets walking down the top of the Phrygian scale, ending on the 5th.',
      'Des triolets imbriqués qui descendent le haut du mode phrygien, jusqu’à la quinte.'),

    /* ===== major scale ===== */
    L('maj-melody', 'ionian', 'I', 1, 'Stepwise melody', 'Mélodie par degrés', '5 4 3 2 3:1 R:1:~',
      'Simple stepwise motion, like a sung melody. Don’t underestimate it: most memorable melodies move by steps.',
      'Un mouvement par degrés conjoints, comme une mélodie chantée. Ne le sous-estimez pas : la plupart des mélodies marquantes avancent par degrés.'),
    L('maj-hook', 'ionian', 'any', 1, 'Pop hook', 'Accroche pop', '3 3 5:1 3 2 R:1 2 3 2:1 6_ R:1.5:~',
      'A two-bar hook built on repetition: the same short idea, then an answer. Try singing it before playing it.',
      'Une accroche de deux mesures fondée sur la répétition : une petite idée, puis une réponse. Chantez-la avant de la jouer.'),
    L('maj-arp', 'ionian', 'I', 2, 'Major 7 arpeggio', 'Arpège majeur 7', 'R 3 5 7 R^:1:~ 7 5',
      'The notes of the I major 7 chord. The 7th, a half step below the root, gives a soft, dreamy colour.',
      'Les notes de l’accord I majeur 7. La septième, un demi-ton sous la tonique, donne une couleur douce et rêveuse.'),
    L('maj-iv', 'ionian', 'IV', 1, 'Land on the IV', 'Se poser sur le IV', 'R^ 7 6 5 4:1 6:1:~',
      'Down the scale onto the 4th and 6th: the root and 3rd of the IV chord.',
      'On descend la gamme jusqu’à la quarte et la sixte : fondamentale et tierce de l’accord IV.'),
    L('maj-v', 'ionian', 'V', 1, 'From the V home', 'Du V vers la maison', 'x:2 5 4 2 7_ R:4:~',
      'Notes of the V chord (5, 4, 2 and the 7th) at the end of its bar, landing on the root as the next chord arrives. The 7th, a half step below the root, does the pulling.',
      'Les notes de l’accord V (quinte, quarte, seconde et septième) qui mènent à la tonique. La septième, un demi-ton sous la tonique, tire vers elle.'),

    /* ===== jazz ii–V–I ===== */
    L('jazz-guide', 'ionian', 'iiVI', 1, 'Guide tones through ii–V–I', 'Notes guides dans ii–V–I', '4:2 R^:2 7:2 4:2 3:4:~',
      'Only the 3rd and 7th of each chord, and each moves by a half step at most: C to B, F to E. Those “guide tones” are the skeleton of jazz improvisation.',
      'Seulement la tierce et la septième de chaque accord, qui bougent d’un demi-ton au plus : do vers si, fa vers mi. Ces « notes guides » sont le squelette de l’improvisation jazz.'),
    L('jazz-arp', 'ionian', 'iiVI', 2, 'Arpeggios through ii–V–I', 'Arpèges dans ii–V–I', '2 4 6 R^ 2^ R^ 6 4 7_ 2 4 5 7 2^ 4^:1 3^:2:~ x:2',
      'Each bar spells the chord underneath. The V bar ends on its 7th, which falls a half step onto the 3rd of the I: the guide-tone move at the heart of jazz.',
      'Chaque mesure épelle l’accord en dessous. La mesure du V finit sur sa septième, qui descend d’un demi-ton sur la tierce du I : le geste central du jazz.'),
    L('jazz-enclose', 'ionian', 'iiVI', 2, 'Enclosure into the 3rd', 'Encerclement de la tierce', 'R^ 6 4 2 R 2 4 6 7 5 4 2 7_ 2 4 b3 3:2:~ x:2',
      'At the end of the V bar the line circles the target: a note above (4), a note below (♭3), then lands on the 3rd of the I.',
      'À la fin de la mesure du V, la phrase encercle la cible : une note au-dessus (4), une en dessous (♭3), puis se pose sur la tierce du I.', { chrom: ['♭3'] }),
    L('bebop-down', 'ionian', 'I', 2, 'Bebop scale down', 'Gamme bebop descendante', 'R^ 7 6 #5 5 4 3 2',
      'The major scale with an extra passing note between 6 and 5. It puts every chord tone (R, 3, 5, 6) on a beat.',
      'La gamme majeure avec une note de passage entre la sixte et la quinte. Toutes les notes de l’accord tombent ainsi sur les temps.', { chrom: ['♯5'], styles: ['jazz'] }),

    /* ===== more styles ===== */
    L('oblique', 'minorPent', 'I', 2, 'Oblique bend', 'Tiré oblique', '4{b}+b7:1 5 R^ b3^::qb R^:1:~ x',
      'Bend the 4th up to the 5th while the ♭7 rings on the next string, the two notes of a dominant 7th chord. A classic rock and blues-rock sound.',
      'Tirez la quarte jusqu’à la quinte pendant que la ♭7 sonne sur la corde voisine : deux notes d’un accord de septième. Un son classique du blues-rock.', { styles: ['rock', 'blues'] }),
    L('rock-climb', 'minorPent', 'I', 2, 'Climb and bend to the root', 'Monter et tirer vers la tonique', '5 b7:1:b R^ b3^ R^:1.5:~',
      'Climb from the 5th, bend the ♭7 up a whole step into the root, then hang on the top root with vibrato.',
      'Montez depuis la quinte, tirez la ♭7 d’un ton jusqu’à la tonique, puis tenez la tonique aiguë avec vibrato.', { styles: ['rock'], pos: 2 }),
    L('pedal-point', 'aeolian', 'any', 1, 'Pedal-point riff', 'Riff en pédale', 'R_ 5 R_ b6 R_ 5 R_ 4',
      'Alternate a low root with a melody above it. The low note keeps pounding while the top moves: a heavy-metal staple.',
      'Alternez une tonique grave et une mélodie au-dessus. La note grave martèle pendant que le haut bouge : un classique du métal.', { styles: ['metal', 'rock'] }),
    L('synth-arp', 'aeolian', 'I', 1, 'Minor arpeggio pulse', 'Pulsation d’arpège mineur', 'R b3 5 R^ 5 b3 R b3',
      'The notes of the minor tonic chord in steady eighths, like a synth arpeggiator. Play it short and even.',
      'Les notes de l’accord mineur de tonique en croches régulières, comme un arpégiateur. Jouez court et régulier.', { styles: ['synthwave', 'cinematic'] }),
    L('synth-bvi', 'aeolian', 'any', 1, 'Rising minor hook', 'Accroche mineure ascendante', 'R 2 b3 5:1 b3 R:1',
      'A small rising hook that peaks on the 5th and falls back. Repeat it over every chord of a minor loop and listen to how its colour changes.',
      'Une petite accroche qui monte jusqu’à la quinte et redescend. Répétez-la sur chaque accord d’une boucle mineure et écoutez sa couleur changer.', { styles: ['synthwave', 'pop'] }),
    L('octave-melody', 'ionian', 'I', 2, 'Octave melody', 'Mélodie en octaves', 'R+R^:1 2+2^ 3+3^:1.5 5+5^:1',
      'Each note doubled an octave higher, two strings apart, muting the string in between. Big and clear: pop-punk and indie rock.',
      'Chaque note doublée à l’octave, deux cordes plus loin, en étouffant la corde du milieu. Gros et clair : pop-punk et rock indé.', { styles: ['punk', 'rock', 'pop'] }),
    L('funk-16ths', 'dorian', 'I', 2, 'Sixteenth-note funk', 'Funk en doubles croches', 'R:.25 R:.25 x b3:.25 4:.25 x 6 4 b3 R',
      'Short, tight sixteenth notes with rests between them. Keep your strumming hand moving even during the rests.',
      'Des doubles croches courtes et serrées, avec des silences. Gardez la main droite en mouvement même pendant les silences.', { styles: ['funk', 'soul'] }),
    L('reggae-melody', 'majorPent', 'I', 1, 'Off-beat melody', 'Mélodie à contretemps', 'x 3 5 6 5 3 R:1',
      'It starts after the beat, like the reggae “skank”. Leave that first silence: the off-beat is the whole feel.',
      'Elle commence après le temps, comme le « skank » reggae. Respectez ce premier silence : le contretemps, c’est tout le groove.', { styles: ['reggae', 'pop'] }),
    L('gospel-run', 'majorBlues', 'I', 2, 'Gospel run', 'Course gospel', 'R^ 6 5 b3 3::h 2 R:1:~',
      'Down from the root with the bluesy ♭3 hammered into the major 3rd: the sound of church piano, on guitar.',
      'On descend depuis la tonique avec la ♭3 bleue liée à la tierce majeure : le son du piano d’église, à la guitare.', { styles: ['gospel', 'soul'] }),
    L('soul-321', 'majorPent', 'end', 1, 'Soul 3–2–1 ending', 'Fin soul 3–2–1', '3:1:si 2 R 6_ R:1.5:~',
      'Slide into the 3rd, then step down 3, 2, 1 with a dip to the 6th below. A warm, vocal way to end.',
      'Glissez vers la tierce, puis descendez 3, 2, 1 avec un détour par la sixte grave. Une fin chaleureuse et vocale.', { styles: ['soul', 'gospel', 'pop'] }),
    L('country-ending', 'majorBlues', 'end', 1, 'Country ending', 'Fin country', '6 5 b3 3::h R:2:~',
      'The 6th, the 5th, the blue ♭3 sliding into the 3rd, and home. Short and twangy.',
      'La sixte, la quinte, la ♭3 bleue qui glisse vers la tierce, et retour à la maison. Court et twangy.', { styles: ['country'] }),
    L('bb-box', 'majorBlues', 'I', 2, 'Blues box above the root', 'Boîte blues autour de la tonique', 'R^ 2^::b R^ 6 4::b 3 R:1:~',
      'A compact shape just above the root: bend the 2nd up to the 3rd, then the 4th up to the 5th. Classic electric-blues phrasing.',
      'Une forme compacte juste au-dessus de la tonique : tirez la seconde jusqu’à la tierce, puis la quarte jusqu’à la quinte. Le phrasé du blues électrique.', { styles: ['blues'], chrom: ['4'] }),
    L('boogie', 'mixolydian', 'I', 1, 'Boogie bass line', 'Ligne boogie', 'R_ 3_ 5_ 6_ b7_ 6_ 5_ 3_',
      'Up and down the I7 chord with the 6th added, in steady eighths: the rolling boogie-woogie bass line. Swing it.',
      'On monte et descend l’accord I7 avec la sixte, en croches régulières : la ligne de basse boogie-woogie. Jouez-la swing.', { styles: ['blues', 'rock'] }),
    L('maj7-9', 'ionian', 'I', 2, 'Up to the 9th', 'Jusqu’à la neuvième', '3 5 7 2^:1.5:~ R^ 7',
      'Climb the major 7 chord and keep going to the 9th. Holding the 9th gives a soft, open, bossa or neo-soul colour.',
      'Montez l’accord majeur 7 et continuez jusqu’à la neuvième. Tenir la neuvième donne une couleur douce et ouverte, bossa ou néo-soul.', { styles: ['bossa', 'soul', 'jazz'] }),
    L('chromatic-approach', 'ionian', 'I', 2, 'Chromatic approach', 'Approche chromatique', '3 4 #4 5:1 6 5:1:~',
      'A chromatic passing note (♯4) slides into the 5th. Chromatic notes sound great as long as they move on to a chord tone.',
      'Une note de passage chromatique (♯4) glisse vers la quinte. Les notes chromatiques sonnent bien tant qu’elles mènent à une note de l’accord.', { styles: ['jazz', 'bossa', 'soul'], chrom: ['♯4'] }),
    L('minor-iivi', 'harmonicMinor', 'iiVI', 2, 'Minor ii–V–i', 'ii–V–i mineur', '2 4 b6 R^ 2^ R^ b6 4 7_ 2 4 b6 5 4 2 7_ b3:2:~ x:2',
      'Arpeggios of the half-diminished ii and the V7♭9, the leading tone (7) pulling into the minor tonic, landing on its ♭3.',
      'Arpèges du ii demi-diminué et du V7♭9, la sensible (7) qui conduit à la tonique mineure, pour se poser sur sa ♭3.', { styles: ['jazz', 'bossa'] }),
    L('lydian-4', 'lydian', 'I', 1, 'The Lydian ♯4', 'Le ♯4 lydien', 'R 2 3 #4:1:~ 5 3:1',
      'Lydian is the major scale with a raised 4th. Hold that ♯4 and you get the dreamy, floating sound of film scores.',
      'Le lydien, c’est la gamme majeure avec une quarte haussée. Tenez ce ♯4 et vous obtenez le son rêveur des musiques de film.', { styles: ['cinematic', 'synthwave'] }),
    L('lydian-arp', 'lydian', 'I', 2, 'Lydian shimmer', 'Miroitement lydien', 'R 3 5 7 #4^:1:~ 5 x',
      'Major 7 arpeggio topped with the ♯4: bright and suspended, as if the music were hovering.',
      'Un arpège majeur 7 couronné du ♯4 : lumineux et suspendu, comme si la musique flottait.', { styles: ['cinematic'] }),
    L('flamenco-turn', 'phrygianDom', 'any', 1, 'Flamenco turn', 'Tournure flamenca', '3 4 3 b2 R:2:~',
      'A small turn around the major 3rd that falls through the ♭2 onto the root. Play it with a light, quick touch.',
      'Un petit tour autour de la tierce majeure qui tombe par le ♭2 sur la tonique. Jouez-le avec légèreté.', { styles: ['flamenco'] }),
    L('flamenco-sigh', 'phrygianDom', 'any', 1, 'Flamenco sigh', 'Soupir flamenco', '5 4 3 4 b2:1 R:1:~',
      'A little turn around the major 3rd, then the ♭2 leaning into the root: the falling sigh at the end of so many flamenco phrases.',
      'Un petit tour autour de la tierce majeure, puis le ♭2 qui s’appuie sur la tonique : le soupir qui termine tant de phrases flamencas.', { styles: ['flamenco'] }),
    L('flamenco-descent', 'phrygianDom', 'any', 2, 'Phrygian-dominant descent', 'Descente phrygienne dominante', 'R^ b7 b6 5 b6:t 5:t 4:t 3:1:~',
      'Down from the root through the ♭7 and ♭6, a quick triplet, and onto the major 3rd that makes this mode sound Spanish.',
      'On descend depuis la tonique par la ♭7 et la ♭6, un triolet rapide, et on se pose sur la tierce majeure qui donne à ce mode son air espagnol.', { styles: ['flamenco', 'metal'] }),
    L('celtic-roll', 'dorian', 'any', 1, 'Celtic roll', 'Ornement celtique', 'R:t 2:t R:t b7_ R 4 5:1.5:~',
      'A quick triplet ornament around the root, as fiddlers and pipers play, then a leap up to the 5th.',
      'Un ornement rapide en triolet autour de la tonique, à la manière des violoneux, puis un saut vers la quinte.', { styles: ['folk'] }),
    L('mixo-folk', 'mixolydian', 'any', 1, 'Mixolydian folk tune', 'Air folk mixolydien', 'R 2 3 5 b7:1 5 3',
      'A folk-dance phrase that reaches up to the ♭7, the note that gives Celtic and old-time tunes their modal sound.',
      'Une phrase de danse folk qui monte jusqu’à la ♭7, la note qui donne aux airs celtiques et traditionnels leur son modal.', { styles: ['folk', 'rock'] }),
    L('pop-hook2', 'majorPent', 'any', 1, 'Repeated-note hook', 'Accroche sur note répétée', '5 5 6 5 3:1 2:1',
      'Pop hooks often repeat one note before moving. Simple, singable, easy to remember.',
      'Les accroches pop répètent souvent une note avant de bouger. Simple, chantable, facile à retenir.', { styles: ['pop', 'reggae'] }),
    L('pop-climax', 'ionian', 'I', 2, 'Soaring climax', 'Envolée', '3 5 R^:1 7 R^ 2^:1:~',
      'A leap to the high root, a step down and back up to the 9th: the kind of line that ends a big chorus.',
      'Un saut vers la tonique aiguë, un pas en bas, puis jusqu’à la neuvième : le genre de phrase qui conclut un grand refrain.', { styles: ['pop', 'cinematic'] }),
    L('neo-soul-9', 'ionian', 'I', 2, 'Neo-soul descent', 'Descente néo-soul', '2^ R^ 7 5 3 2 R:1',
      'Start on the 9th and float down through the major 7th. Laid back, slightly behind the beat.',
      'Partez de la neuvième et descendez en douceur par la septième majeure. Décontracté, un peu derrière le temps.', { styles: ['soul', 'jazz'] }),
  ];

  /* ---------- parsing the melody notation ---------- */
  const DEG = { R: 0, b2: 1, '2': 2, '#2': 3, b3: 3, '3': 4, '4': 5, '#4': 6, b5: 6, '5': 7, '#5': 8, b6: 8, '6': 9, b7: 10, '7': 11 };
  const NOTE_RE = /^(R|[b#]?[2-7])([\^_]*)(?:\{([^}]*)\})?$/;
  function parseLine(line) {
    const notes = [];
    let t = 0;
    for (const tok of line.trim().split(/\s+/)) {
      const [np, dp, tp] = tok.split(':');
      const d = !dp ? 0.5 : dp === 't' ? 1 / 3 : dp === '2t' ? 2 / 3 : parseFloat(dp);
      if (!(d > 0)) throw new Error('Bad length in "' + tok + '"');
      const shared = tp ? tp.split('+').filter(Boolean) : [];
      if (np !== 'x') {
        for (const part of np.split('+')) {
          const m = NOTE_RE.exec(part);
          if (!m || !(m[1] in DEG)) throw new Error('Bad note "' + part + '" in "' + tok + '"');
          const oct = (m[2].match(/\^/g) || []).length - (m[2].match(/_/g) || []).length;
          const own = m[3] ? m[3].split(',').filter(Boolean) : [];
          notes.push({ semi: DEG[m[1]] + 12 * oct, t, d, tech: own.concat(shared) });
        }
      }
      t += d;
    }
    return { notes, length: t };
  }

  const BEND = { b: 2, hb: 1, qb: 0.5 };
  // Styles a lick belongs to, when it doesn't say: the styles its scale is typical of.
  const STYLE_OF_SCALE = {
    minorPent: ['blues', 'rock'], blues: ['blues', 'rock'], majorPent: ['country', 'pop'], majorBlues: ['blues', 'country'],
    mixolydian: ['blues', 'rock', 'funk'], dorian: ['funk', 'soul', 'jazz'], aeolian: ['rock', 'pop', 'cinematic'],
    harmonicMinor: ['metal', 'cinematic'], phrygian: ['metal'], phrygianDom: ['flamenco', 'metal'], ionian: ['pop', 'folk', 'jazz'], lydian: ['cinematic'],
  };
  const SEMI = ['R', '♭2', '2', '♭3', '3', '4', '♭5', '5', '♭6', '6', '♭7', '7'];
  LICKS.forEach((l) => {
    const p = parseLine(l.line);
    l.notes = p.notes;
    l.bars = Math.max(1, Math.ceil(p.length / 4 - 0.01));
    const tech = new Set();
    l.notes.forEach((n) => n.tech.forEach((t) => tech.add(t in BEND || t === 'r' ? 'bend' : t === '~' ? 'vibrato' : t === 'h' || t === 'p' ? 'legato' : t === '/' || t === 'si' ? 'slide' : t)));
    const starts = l.notes.map((n) => n.t);
    if (starts.some((t, i) => starts.indexOf(t) !== i)) tech.add('doubleStop');
    l.techs = [...tech];
    l.chrom = l.chrom || [];
    l.pos = l.pos || 1;
    l.styles = l.styles || STYLE_OF_SCALE[l.scale] || [];
  });

  /* ---------- which licks suit this key and style ---------- */
  const BLUESY = new Set(['blues', 'rock', 'punk', 'metal', 'funk', 'soul', 'gospel', 'country']);
  const DOMINANT = new Set(['blues', 'rock', 'funk', 'country', 'soul', 'gospel', 'punk']);
  function fits(l, key, styleId) {
    const mode = key.mode;
    switch (l.scale) {
      case 'minorPent': case 'blues':
        return mode === 'minor' || mode === 'dorian' || mode === 'phrygian' || ((mode === 'major' || mode === 'mixolydian') && BLUESY.has(styleId));
      case 'majorPent': case 'majorBlues': return mode === 'major' || mode === 'mixolydian' || mode === 'lydian';
      case 'mixolydian': return mode === 'mixolydian' || (mode === 'major' && DOMINANT.has(styleId));
      case 'dorian': return mode === 'dorian';
      case 'aeolian': case 'harmonicMinor': return mode === 'minor';
      case 'phrygianDom': return mode === 'phrygianDom';
      case 'phrygian': return mode === 'phrygian';
      case 'ionian': return mode === 'major' && styleId !== 'blues';
      case 'lydian': return mode === 'lydian';
    }
    return false;
  }

  /* ---------- fingering a lick into a scale position ----------
   * For each candidate octave, count how many notes the position already contains; keep the best.
   * Notes inside the position use its fingering; passing notes go on the nearest string, close to the box.
   */
  const STD = [40, 45, 50, 55, 59, 64];
  function fitIn(l, pos, tun, tonicPc) {
    const inPos = new Map();
    pos.notes.forEach((x) => { if (!inPos.has(x.m)) inPos.set(x.m, []); inPos.get(x.m).push(x); });
    const posMs = [...inPos.keys()];
    const centre = (Math.min(...posMs) + Math.max(...posMs)) / 2;
    // deliberate passing notes, compared by pitch (♯5 and ♭6 are the same key on the neck)
    const allowed = new Set(l.chrom.map((c) => DEG[c.replace('♭', 'b').replace('♯', '#')]));
    let best = null;
    for (let r0 = tun[0] - 12; r0 <= tun[tun.length - 1] + 12; r0++) {
      if (mod(r0, 12) !== tonicPc) continue;
      const ms = l.notes.map((n) => r0 + n.semi);
      if (Math.min(...ms) < tun[0] || Math.max(...ms) > tun[tun.length - 1] + 20) continue;
      const inside = ms.filter((m) => inPos.has(m)).length;
      const mean = ms.reduce((a, b) => a + b, 0) / ms.length;
      // lead lines sit better toward the treble strings: aim a little above the box's middle
      const score = inside * 10 - Math.abs(mean - (centre + 4)) * 0.2;
      if (!best || score > best.score) best = { r0, score, inside };
    }
    if (!best) return null;
    // assign strings: time order, double-stops on distinct strings, smallest moves
    const out = [];
    let prev = null;
    const groups = new Map();
    l.notes.forEach((n, k) => { const key = n.t.toFixed(4); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(k); });
    for (const ids of groups.values()) {
      const used = new Set();
      ids.sort((a, b) => l.notes[a].semi - l.notes[b].semi);
      for (const k of ids) {
        const n = l.notes[k];
        const m = best.r0 + n.semi;
        const bend = n.tech.some((t) => t in BEND || t === 'r' || t === 'si');
        let opts = (inPos.get(m) || []).filter((x) => !used.has(x.s)).map((x) => ({ s: x.s, f: x.f, inBox: true }));
        if (!opts.length) {
          opts = tun.map((o, s) => ({ s, f: m - o, inBox: false })).filter((x) => !used.has(x.s) && x.f >= 0 && x.f <= 22);
        }
        const cost = (x) => (prev ? Math.abs(x.s - prev.s) * 1.2 + Math.abs(x.f - prev.f) * 0.5 : 0)
          + (x.inBox ? 0 : Math.max(0, pos.minF - 1 - x.f, x.f - pos.maxF - 1) * 3)
          + (bend && x.f === 0 ? 50 : 0);
        opts.sort((a, b) => cost(a) - cost(b));
        const pick = opts[0];
        if (!pick) return null;
        used.add(pick.s);
        const rel = mod(m - tonicPc, 12);
        out[k] = Object.assign({}, n, { s: pick.s, f: pick.f, m, inBox: pick.inBox, rel, label: SEMI[rel] });
        prev = pick;
      }
    }
    const outside = out.filter((x) => !x.inBox && !allowed.has(x.rel)).length;
    const bendOpen = out.some((x) => x.f === 0 && x.tech.some((t) => t in BEND || t === 'r' || t === 'si'));
    return { notes: out, rootMidi: best.r0, outside, bendOpen };
  }

  // positions of the lick's scale, and the lick fingered in the chosen one
  function realize(l, key, tuning, posIndex) {
    const tun = tuning || STD;
    const sc = S.build(l.scale, key.tonic);
    const positions = S.positions(sc, tun, 'auto');
    const fitsAll = positions.map((p) => {
      let f = fitIn(l, p, tun, key.tonic.pc);
      if (f && f.bendOpen) {
        // a bend can't happen on an open string: use the same shape an octave up
        const up = Object.assign({}, p, { notes: p.notes.map((x) => ({ s: x.s, f: x.f + 12, m: x.m + 12 })), minF: p.minF + 12, maxF: p.maxF + 12 });
        const g = fitIn(l, up, tun, key.tonic.pc);
        if (g && !g.bendOpen) { f = g; f.shifted = up; }
      }
      return f;
    });
    let idx = posIndex != null && fitsAll[posIndex] ? posIndex : Math.min(l.pos - 1, positions.length - 1);
    if (!fitsAll[idx]) idx = fitsAll.findIndex(Boolean);
    const f = fitsAll[idx];
    const pos = f && f.shifted ? f.shifted : positions[idx];
    const standard = tun.length >= 6 && tun.slice(tun.length - 6).every((x, i) => x === STD[i]);
    return {
      scale: sc, positions, posIndex: idx, position: pos,
      fullFit: fitsAll.map((x) => !!x && x.outside === 0),
      notes: f ? f.notes : [], refingered: !standard,
    };
  }

  /* ---------- does it fit THIS progression? ----------
   * Every note is checked against the chord sounding under it:
   *   chord tone ........................ good
   *   note of that chord's scale ........ fine (a tension)
   *   avoid note (half step above a chord tone, same rule as the Scales tab) ... rubs
   *   outside the chord's scale, a half step from a chord tone ............... clashes
   *   blue notes (♭3, ♭5, ♭7 over a major/dominant chord) are fine in bluesy styles
   * Long notes and notes on the beat count more; quick passing notes count less; the last note counts double.
   * The lick is tried at every possible start and placed where it fits best.
   */
  const BLUE_STYLES = new Set(['blues', 'rock', 'punk', 'metal', 'funk', 'soul', 'gospel', 'country']);
  function chordInfoCache(chords, key, styleId) {
    return chords.map((c) => {
      const hq = T.harm(c);
      const r = T.realize(Object.assign({}, c, { quality: hq }), key);
      const o = S.chordScale(c, key, styleId).options[0];
      const sc = S.build(o.id, o.root);
      return { pcs: new Set(r.pcs), root: r.root.pc, fam: T.Q[hq].fam, scale: sc.pcs, avoid: new Set(S.avoidNotes(sc, c, key)) };
    });
  }
  function judge(pc, info, bluesy) {
    if (info.pcs.has(pc)) return 'ct';
    const rel = mod(pc - info.root, 12);
    if (bluesy && ['maj', 'dom', 'pow', 'sus'].includes(info.fam) && (rel === 3 || rel === 6 || rel === 10)) return 'blue';
    if (info.scale.has(pc)) return info.avoid.has(pc) ? 'avoid' : 'tension';
    for (const c of info.pcs) if (Math.abs(mod(pc - c + 6, 12) - 6) === 1) return 'clash';
    return 'outside';
  }
  const VALUE = { ct: 1, tension: 0.35, blue: 0.15, avoid: -0.7, outside: -0.6, clash: -1.4 };
  function evaluate(l, chords, key, styleId, startBeat, cache) {
    const info = cache || chordInfoCache(chords, key, styleId);
    const starts = [];
    let acc = 0;
    chords.forEach((c) => { starts.push(acc); acc += c.beats; });
    const total = acc;
    const at = (beat) => { const b = mod(beat, total); let i = 0; for (let j = 0; j < starts.length; j++) if (starts[j] <= b + 1e-6) i = j; return i; };
    const bluesy = BLUE_STYLES.has(styleId);
    const lastT = Math.max(...l.notes.map((n) => n.t));
    let sum = 0, wsum = 0, lastBad = false;
    const kinds = l.notes.map((n) => {
      const bend = n.tech.find((t) => t === 'b' || t === 'hb');
      const semi = n.semi + (bend ? BEND[bend] : 0);           // a bend is heard at its target
      const pc = mod(key.tonic.pc + semi, 12);
      const kind = judge(pc, info[at(startBeat + n.t)], bluesy || n.tech.includes('qb'));
      const onBeat = Math.abs(n.t - Math.round(n.t)) < 0.01;
      let w = Math.min(n.d, 2) * (onBeat ? 1.3 : 1);
      const v = VALUE[kind];
      if (v < 0 && n.d <= 0.5 && !onBeat) w *= 0.35;          // quick off-beat notes are passing notes
      if (n.t === lastT) { w *= 2; if (v < 0) lastBad = true; }
      sum += v * w; wsum += w;
      return kind;
    });
    const score = wsum ? sum / wsum : 0;
    const grade = lastBad || score < 0.15 ? 'poor' : score < 0.45 ? 'ok' : 'good';
    return { score, grade, kinds };
  }

  const OVER_ROOT = { I: 0, IV: 5, V: 7 };
  function place(l, chords, key, styleId) {
    const slots = [];
    let acc = 0;
    chords.forEach((c) => { slots.push({ start: acc, beats: c.beats, rootPc: c.rootPc }); acc += c.beats; });
    const total = acc, totalBars = Math.round(total / 4), need = l.bars * 4;
    let starts = [];
    let reason = null;
    const lastRoot = slots[slots.length - 1].rootPc;
    if (l.over === 'turn' || l.over === 'end') {
      starts = [Math.max(0, totalBars - l.bars) * 4];
      if (l.over === 'turn' && lastRoot !== 7) reason = 'noTurn';
      if (l.over === 'end' && lastRoot !== 0) reason = 'noEnd';
      if (reason) return { startBeat: starts[0], bar: Math.floor(starts[0] / 4), found: false, reason, totalBars, grade: 'poor', score: -1, kinds: l.notes.map(() => 'outside') };
    } else if (l.over === 'iiVI') {
      for (let i = 0; i + 2 < slots.length; i++) {
        const [a, b, c] = [slots[i], slots[i + 1], slots[i + 2]];
        if (a.rootPc === 2 && b.rootPc === 7 && c.rootPc === 0 && a.beats === 4 && b.beats === 4 && a.start % 4 === 0) starts.push(a.start);
      }
      if (!starts.length) reason = 'noIIVI';
    } else if (l.over in OVER_ROOT) {
      // a lick may run past the last bar: the loop carries it into bar 1 (that's how V licks resolve home)
      starts = slots.filter((x) => x.rootPc === OVER_ROOT[l.over] && (x.start + need <= total + 2 || x.start % 4 === 0)).map((x) => x.start);
      if (!starts.length) reason = 'noChord';
    } else {
      for (let b = 0; b * 4 + need <= total; b++) starts.push(b * 4);
      if (!starts.length) starts = [0];
    }
    if (!starts.length) return { startBeat: 0, bar: 0, found: false, reason, totalBars, grade: 'poor', score: -1, kinds: l.notes.map(() => 'outside') };
    if (!key) return { startBeat: starts[0], bar: Math.floor(starts[0] / 4), found: true, totalBars };
    const cache = chordInfoCache(chords, key, styleId);
    let best = null;
    for (const st of starts) {
      const ev = evaluate(l, chords, key, styleId, st, cache);
      if (!best || ev.score > best.score + 1e-9) best = Object.assign({ startBeat: st }, ev);
    }
    return Object.assign(best, { bar: Math.floor(best.startBeat / 4), found: true, totalBars });
  }

  C.licks = { LICKS, fits, realize, place, evaluate, parseLine, BEND };
})(typeof window !== 'undefined' ? (window.Cadence = window.Cadence || {}) : (globalThis.Cadence = globalThis.Cadence || {}));
