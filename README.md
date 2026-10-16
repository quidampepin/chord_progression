# Cadence — chord progression generator

Open `index.html` in a browser (double-click works, no server needed).

## How it's built

| File | Job |
|---|---|
| `js/theory.js` | Note spelling (B♭, not A♯, in F major), modes, 24 chord qualities, Roman-numeral parser (`V7/ii`, `♭VII`, `iiø7`) |
| `js/generator.js` | Templates per style + functional-harmony walk, re-harmonisation passes, colour pass, analysis |
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

Settings, the current progression and recent history are saved in the browser (localStorage).
