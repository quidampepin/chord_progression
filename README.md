# Cadence — chord progression generator

A chord progression generator for songwriters and guitarists: 16 styles, 7 modes, guitar (13 tunings), ukulele and piano voicings, scales and licks to play over the progression, playback and MIDI export. English and French.

**Use it online:** https://www.davidpepin.ca/chord_progression/  
*En français :* générateur de progressions d'accords bilingue. Changez la langue dans l'application.

## Run it locally

Open `index.html` in a browser (double-click works, no server needed).

## Credits

Idea, direction and testing: David Pépin. Coded with Claude (Anthropic). Part of [davidpepin.ca/projects](https://www.davidpepin.ca/projects/).

The published page loads Google Analytics (page views only, same property as davidpepin.ca). The tag only runs on davidpepin.ca, not when you open the file locally.

## How it's built

| File | Job |
|---|---|
| `js/theory.js` | Note spelling (B♭, not A♯, in F major), modes, 24 chord qualities, Roman-numeral parser (`V7/ii`, `♭VII`, `iiø7`) |
| `js/generator.js` | Templates per style + functional-harmony walk, re-harmonisation passes, colour pass, analysis |
| `js/scales.js` | Scales to play over the progression: per-key and per-chord choices, positions on the neck |
| `js/licks.js` | The licks library: shapes relative to the key root, fit rules, placement in the progression |
| `js/voicing.js` | Piano voice leading (shortest-path search) and guitar shape finder (standard tuning) |
| `js/audio.js` | Web Audio synths (piano, pad, Karplus–Strong guitar), scheduler, MIDI export |
| `js/diagrams.js` | SVG chord boxes and keyboards |
| `js/i18n.js` | English / French text |
| `js/app.js` | State, rendering, events |
| `css/styles.css` | Look and layout (light and dark) |

## How a progression is made

1. **Source** — The "Familiar ↔ Adventurous" slider sets the odds. Familiar mostly picks a proven progression from the style's library (Axis, ii–V–I, 12-bar, Andalusian…). Adventurous mostly uses the **functional walk**: weighted transitions between chords (tonic → predominant → dominant → tonic). It samples ~350 candidates, scores them (strong transitions, a tonic present, variety, a clean loop or a real cadence) and picks among the best. Eight bars often use a question-and-answer phrase (bars 5–6 repeat 1–2).
2. **Re-harmonisation** — Depending on style and slider: secondary dominants (vi → VI7 when it falls a fifth into ii), tritone substitutions (jazz, soul), and modal mixture (IV → iv).
3. **Colour** — Triads, sevenths or extended. An extension is only added if its notes belong to the chord's key context. So iii gets m7, never m9 (the 9th is out of key), and V in a minor key gets 7♭9.
4. **Voicings** — Piano: close, drop 2 or shell voicings, chosen so the hands move as little as possible. "Smooth bass" allows inversions (C/E) when they make the bass walk by step. Guitar: every playable shape (max 4 fingers, barres detected, max 4-fret span), ranked, then chosen so you stay in one area of the neck. Cycle through them with ‹ ›.

## Styles, modes and tunings

- **16 styles**: pop, rock, jazz, blues, neo-soul, folk, cinematic, metal, punk, funk, gospel, bossa nova, country, reggae, synthwave/EDM, flamenco.
- **7 modes**: major, minor, Dorian, Mixolydian, Phrygian, Phrygian dominant, Lydian. In the Phrygian modes, ♭II is treated as the chord that resolves home (the "E–F" metal/flamenco move).
- **Power chords**: metal and punk start at "Power chords" (root + 5th). The chord still keeps its harmonic identity (i, ♭VI…) for the analysis.
- **13 guitar tunings**: standard, half step down, D standard, drop D, drop C, drop B, open G, open D, open E, open C, DADGAD, 7-string standard, 7-string drop A. The shape finder searches whatever tuning is selected, so open tunings favour ringing open strings and drop tunings give one-finger power chords.

## Harmonic rhythm

"Chord rhythm: Varied" lets chords last different lengths, as real songs do: a chord held for two bars (shown with the bar-repeat sign 𝄎 / %), two chords sharing a bar, or a quick "push" chord at the end of a loop that leads back to bar 1. A 4-bar progression can have 2 to 8 chords. Each style has its own habits: funk and reggae vamp on long chords, jazz, gospel and bossa move twice per bar, and rock and folk hold chords. "One per bar" gives the classic steady grid. Templates can use `%` to hold a chord (`I | % | IV | I V`).

## Instruments

One switch (Guitar, Ukulele, Piano, Synth pad) drives the chart, the selected-chord panel and the sound together. Ukulele shapes are searched on 4 strings (standard high-G, low G, D tuning, baritone) without the root-in-the-bass rule, since a re-entrant ukulele has no bass string. The keyboard in the selected-chord panel always shows the exact notes the current instrument plays.

## Scales to play over it

- **Whole progression**: one scale for everything. It's the mode's scale, or a pentatonic or blues scale where the style calls for it (rock, country and folk lead with pentatonics, the blues with the blues scale). If a chord holds a different version of one of the scale's notes (V7 in a minor key, a borrowed ♭VII, a secondary dominant), the app warns you and names the chord.
- **Chord by chord**: each chord gets its own scale, chosen with the same "key context" the colour pass uses. That context is the chord's notes plus the key's notes, read from the chord's root. Examples: ii7 → Dorian, V7 → Mixolydian, V7 in minor → Phrygian dominant, iiø7 → Locrian, secondary dominants → Mixolydian or Phrygian dominant depending on their target, tritone subs → Lydian dominant, °7 → whole–half diminished. Alternatives are offered next to the best fit.
- **On the neck**: chord tones are highlighted as target notes, in sync with the selected or playing chord. Positions are 5 pentatonic boxes (2 notes per string), 7 three-notes-per-string patterns, or one-hand box shapes, for any tuning, 7-string and ukulele included. Pick a position and it stays in that area of the neck as the chords change.

### How sure are the scale choices?

`node tests/run.js` checks the textbook answers: the diatonic modes, Autumn Leaves, secondary dominants, a 12-bar blues, “Creep”, the Andalusian cadence, the Neapolitan, modal vamps, clash warnings, spelling, positions and function labels. Run it after any change to the theory code.

- Chords outside the nearby keys use **least alteration**: keep the key's notes and change only what the chord needs. For example, E major in C changes G to G♯ and gives E Phrygian dominant.
- The jazz minor tonic (i6) gets **melodic minor**. Half-diminished chords offer **Locrian ♮2** as the alternative, because Locrian's ♭2 is an avoid note.
- **Avoid notes** (a scale note a half step above a chord tone, or only the 4th on dominant 7ths) are drawn with a dashed red ring. Pentatonics have none, which is why they feel safe.

## Licks

The Scales panel has a **Licks** tab with 100 short phrases from 16 styles (blues, rock, metal, punk, funk, soul, gospel, jazz, bossa, country, reggae, folk, pop, synthwave, cinematic, flamenco), grouped by the scale they come from: minor pentatonic, blues scale, major pentatonic, major blues, Mixolydian, Dorian, natural minor, harmonic minor, Phrygian, Phrygian dominant, Lydian and the major scale.

- **Checked against your progression, note by note.** Each note is compared with the chord sounding under it: chord tone (good), note of that chord's scale (fine), avoid note or outside note (rubs), a half step against a chord tone (clash). Blue notes are allowed in bluesy styles. Long notes, notes on the beat and the last note count most. The lick is tried at every possible start (and may run past the last bar into bar 1, which is how V licks resolve) and placed where it fits best. Licks built for a chord your progression doesn't have (a V, a ii–V–I, a V at the end for turnarounds, the tonic at the end for endings) are set aside. "Only licks that fit this progression" shows just the ones that pass. Each lick shows a verdict (fits well / some tension / doesn't fit), and under the tab every degree is green (chord tone), amber (rubs) or red (clash).
- **Written in scale degrees, not frets.** A lick is a melody like `4:1:b 5 4 b3 R:1.5:~` (degree, length, technique). The app fingers it into any position of its scale, in any key and tuning, so the same lick can be played in box 1, box 3 or a 3-notes-per-string position. Position chips with a dashed border mean a note or two reach outside that box.
- **Tied to its scale.** The "From" bar names the scale and its degrees, with a link to see it in the Scales tab at the same position. The neck shows the whole scale with the chosen position outlined and the lick as the highlighted path. The Scales tab has a "Licks in this scale" link back.
- **In the progression.** The lick plays in the bar it was placed in: once to listen, then the next time through is your turn. Speed 50/75/100%, and a "learned" mark to track progress.

The notation is documented at the top of `js/licks.js`, so adding a lick is a one-line job. `node tests/run.js` checks every lick (notes in its scale, whole bars, a playable hand position, no bends on open strings) and the fit engine's verdicts on real progressions. The licks are generic idiomatic phrases, not transcriptions of specific recordings.

Settings, the current progression and recent history are saved in the browser (localStorage).
