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

Settings, the current progression and recent history are saved in the browser (localStorage).
