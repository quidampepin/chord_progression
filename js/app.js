/* Cadence — app controller: state, rendering, events. */
(function (C) {
  'use strict';
  const { theory: T, gen: G, voicing: V, audio: A, i18n: I, draw: D } = C;
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => [...(el || document).querySelectorAll(s)];
  const esc = D.esc;

  /* ---------- state ---------- */
  const STORE = 'cadence.v1';
  const defaults = {
    lang: (navigator.language || 'en').toLowerCase().startsWith('fr') ? 'fr' : 'en',
    notation: 'letters', tonic: 0, mode: 'major', style: 'pop', length: 4, color: 0, adventure: 0.35,
    ending: 'loop', rhythm: 'varied', smoothBass: true, pianoStyle: 'close', tuning: 'standard', ukeTuning: 'ukeStd', instrument: 'guitar', pattern: 'pulse', tempo: 100, repeat: true,
  };
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(STORE) || 'null'); } catch (e) { saved = null; }
  const state = Object.assign({}, defaults, saved && saved.settings);
  if (!['guitar', 'ukulele', 'piano', 'pad'].includes(state.instrument)) state.instrument = 'guitar';
  delete state.view; // older versions kept a separate display setting
  let prog = (saved && saved.prog) || null;
  let history = (saved && saved.history) || [];
  let shapePick = (saved && saved.shapePick) || {};
  let selected = 0;
  let derived = null;

  const tr = (path, vars) => I.t(state.lang, path, vars);
  function persist() {
    try { localStorage.setItem(STORE, JSON.stringify({ settings: state, prog, history: history.slice(0, 12), shapePick })); } catch (e) { /* storage unavailable: fine */ }
  }

  /* ---------- derived data ---------- */
  const key = () => T.makeKey(state.tonic, state.mode);
  const nn = (n) => T.noteName(n, state.notation);

  function compute() {
    const k = key();
    const realized = prog.chords.map((c) => T.realize(c, k));
    const piano = V.pianoVoicings(realized, { style: state.pianoStyle, smoothBass: state.smoothBass });
    // The chart, the playback and the selected-chord panel all follow one instrument.
    let fret = null;
    if (isFretted()) {
      fret = V.guitarVoicings(realized, piano, currentTuning().midi, { bassFree: state.instrument === 'ukulele' });
      fret.forEach((g, i) => { const p = shapePick[i]; if (p != null && g.shapes[p]) g.chosen = p; });
    }
    derived = { key: k, realized, piano, fret };
  }
  function isFretted() { return state.instrument === 'guitar' || state.instrument === 'ukulele'; }
  function currentTuning() {
    if (state.instrument === 'ukulele') return V.UKE_TUNINGS[state.ukeTuning] || V.UKE_TUNINGS.ukeStd;
    return V.TUNINGS[state.tuning] || V.TUNINGS.standard;
  }
  const tuningKey = () => (state.instrument === 'ukulele' ? state.ukeTuning : state.tuning);
  const currentShape = (i) => { const g = derived.fret && derived.fret[i]; return g ? g.shapes[g.chosen] : null; };

  // Bars of the chart. A chord longer than its bar continues into the next ones (shown as a repeat sign).
  function layout() {
    const bars = [];
    let start = 0;
    prog.chords.forEach((c, i) => {
      const b = Math.floor(start / 4), off = start % 4;
      (bars[b] = bars[b] || []).push({ i, cont: false });
      let rem = c.beats - (4 - off), nb = b + 1;
      while (rem > 0) { (bars[nb] = bars[nb] || []).push({ i, cont: true }); rem -= 4; nb++; }
      start += c.beats;
    });
    return bars.map((items) => { const fresh = items.filter((x) => !x.cont); return fresh.length ? fresh : [items[0]]; });
  }

  // Bass note actually sounding in the current view (for slash chords).
  function bassTone(i) {
    const r = derived.realized[i];
    let pc;
    if (state.instrument === 'ukulele') return null; // no real bass string on a ukulele
    if (state.instrument === 'guitar') {
      const s = currentShape(i);
      if (!s) return null;
      pc = s.midi[0] % 12;
    } else pc = derived.piano[i].bassPc;
    if (pc === r.root.pc) return null;
    return r.tones.find((t) => t.pc === pc) || null;
  }
  function symbolParts(i) {
    const r = derived.realized[i];
    const sym = r.q.sym;
    let inline = '', sup = sym;
    if (/^m(?!aj)/.test(sym)) { inline = 'm'; sup = sym.slice(1); }
    const b = bassTone(i);
    return { root: nn(r.root), inline, sup, bass: b ? nn(b) : '' };
  }
  const symbolText = (i) => { const p = symbolParts(i); return p.root + p.inline + p.sup + (p.bass ? '/' + p.bass : ''); };
  function symbolHTML(i) {
    const p = symbolParts(i);
    return `<span class="sym-root">${esc(p.root)}${esc(p.inline)}</span>${p.sup ? `<sup>${esc(p.sup)}</sup>` : ''}${p.bass ? `<span class="sym-bass">/${esc(p.bass)}</span>` : ''}`;
  }
  function notesFor(i) {
    const s = isFretted() ? currentShape(i) : null;
    return s ? s.midi : derived.piano[i].notes;
  }

  /* ---------- actions ---------- */
  function signature(p) { return p ? p.chords.map(T.baseToken).join(' ') : ''; }
  function generate() {
    const k = key();
    const totalBeats = prog ? prog.chords.reduce((s, c) => s + c.beats, 0) : 0;
    const anyLock = prog && prog.chords.some((c) => c.locked) && totalBeats === state.length * 4;
    // With locked chords, keep the current rhythm so each lock stays in its place.
    const locks = anyLock ? prog.chords.map((c) => (c.locked ? c : null)) : [];
    const rhythm = anyLock ? prog.chords.map((c) => c.beats) : null;
    if (prog) remember();
    prog = G.generate({
      key: k, styleId: state.style, length: state.length, ending: state.ending, rhythmMode: state.rhythm, rhythm,
      adventure: state.adventure, color: state.color, locks,
      avoid: signature(prog), avoidTemplate: prog && prog.source && prog.source.p,
    });
    shapePick = {};
    selected = 0;
    refresh(true);
  }
  function remember() {
    const label = prog.chords.map((c, i) => (derived ? symbolText(i) : T.romanText(c))).join(' – ');
    if (history[0] && history[0].label === label) return;
    history.unshift({ label, prog: JSON.parse(JSON.stringify(prog)), tonic: state.tonic, mode: state.mode, style: state.style, color: state.color, ending: state.ending, length: state.length });
    history = history.slice(0, 12);
  }
  function restore(h) {
    remember();
    Object.assign(state, { tonic: h.tonic, mode: h.mode, style: h.style, color: h.color, ending: h.ending, length: h.length });
    prog = JSON.parse(JSON.stringify(h.prog));
    shapePick = {};
    selected = 0;
    refresh(true);
  }
  function reroll(i) {
    G.reroll(prog, i, { key: key(), styleId: state.style, ending: state.ending, adventure: state.adventure, color: state.color });
    delete shapePick[i];
    selected = i;
    refresh(true);
    audition(i);
  }
  function toggleLock(i) {
    prog.chords[i].locked = !prog.chords[i].locked;
    renderSheet();
    persist();
  }
  function cycleShape(i, dir) {
    const g = derived.fret && derived.fret[i];
    if (!g || !g.shapes.length) return;
    g.chosen = (g.chosen + dir + g.shapes.length) % g.shapes.length;
    shapePick[i] = g.chosen;
    selected = i;
    renderSheet(); renderFocus(); persist();
    audition(i);
  }
  function audition(i) {
    if (A.playing) return;
    A.audition(notesFor(i), state.instrument);
  }
  function events() {
    return prog.chords.map((c, i) => ({ notes: notesFor(i), beats: c.beats, label: symbolText(i) }));
  }
  function togglePlay() {
    if (A.playing) { A.stop(); return; }
    startPlayback();
  }
  function startPlayback() {
    A.play(events(), {
      tempo: state.tempo, loop: state.repeat, instrument: state.instrument, pattern: state.pattern,
      onStep: (i) => markPlaying(i),
      onStop: () => { markPlaying(-1); syncPlay(); },
    });
    syncPlay();
  }
  function restartIfPlaying() { if (A.playing) startPlayback(); }

  let lastPlaying = -1;
  function markPlaying(i) {
    if (i === lastPlaying) return;
    lastPlaying = i;
    $$('.chord, .simile').forEach((el) => el.classList.toggle('is-playing', +el.dataset.i === i));
    if (i >= 0 && i !== selected) { selected = i; renderFocus(); $$('.chord').forEach((el) => el.classList.toggle('is-selected', +el.dataset.i === i)); }
  }

  function chartText() {
    const k = derived.key;
    const tunName = isFretted() ? ` · ${tr('sounds.' + state.instrument)}, ${tr('tunings.' + tuningKey())} (${currentTuning().names.join(' ')})` : '';
    const head = `Cadence — ${nn(k.tonic)} ${tr('modes.' + state.mode).toLowerCase()} · ${tr('styles.' + state.style)} · ${state.tempo} BPM` + tunName;
    const bars = layout();
    const lines = [head, ''];
    for (let r = 0; r < bars.length; r += 4) {
      const row = bars.slice(r, r + 4);
      const cell = (items, f) => ' ' + (items[0].cont ? '%' : items.map((x) => f(x.i)).join('  ')).padEnd(12) + ' ';
      lines.push('|' + row.map((items) => cell(items, symbolText)).join('|') + '|');
      lines.push('|' + row.map((items) => cell(items, (i) => T.romanText(prog.chords[i]))).join('|') + '|');
      lines.push('');
    }
    return lines.join('\n').trim();
  }
  function copyChart() {
    const text = chartText();
    const fallback = () => {
      const ta = document.createElement('textarea');
      ta.value = text; ta.className = 'copy-fallback';
      document.body.appendChild(ta); ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      ta.remove();
      toast(ok ? tr('copied') : tr('copyFail'));
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => toast(tr('copied')), fallback);
    else fallback();
  }
  function downloadMidi() {
    const k = derived.key;
    const name = `Cadence ${nn(k.tonic)} ${state.mode} ${state.style}`;
    const bytes = A.midiFile(events(), state.tempo, name);
    const blob = new Blob([bytes], { type: 'audio/midi' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cadence-${T.LETTERS[k.tonic.letter]}${k.tonic.acc < 0 ? 'b' : k.tonic.acc > 0 ? 's' : ''}-${state.mode}-${state.style}.mid`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  let toastTimer = null;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg; el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.hidden = true), 2200);
  }

  /* ---------- rendering ---------- */
  function fillSelect(sel, items, value) {
    sel.innerHTML = items.map(([v, label]) => `<option value="${esc(v)}">${esc(label)}</option>`).join('');
    sel.value = String(value);
  }
  function renderControls() {
    document.documentElement.lang = state.lang;
    $$('[data-i18n]').forEach((el) => { el.textContent = tr(el.dataset.i18n); });
    const style = G.STYLES[state.style];
    fillSelect($('#key'), Array.from({ length: 12 }, (_, pc) => [pc, nn(T.tonicFor(pc, state.mode))]), state.tonic);
    fillSelect($('#mode'), style.modes.map((m) => [m, tr('modes.' + m)]), state.mode);
    fillSelect($('#style'), Object.keys(G.STYLES).map((s) => [s, tr('styles.' + s)]), state.style);
    fillSelect($('#length'), style.lengths.map((l) => [l, l + ' ' + tr('bars')]), state.length);
    fillSelect($('#pattern'), ['pulse', 'block', 'arp'].map((s) => [s, tr('patterns.' + s)]), state.pattern);
    const tunings = state.instrument === 'ukulele' ? V.UKE_TUNINGS : V.TUNINGS;
    fillSelect($('#tuning'), Object.keys(tunings).map((k) => [k, tr('tunings.' + k) + ' · ' + tunings[k].names.join(' ')]), tuningKey());
    fillSelect($('#piano-style'), ['close', 'drop2', 'shell'].map((s) => [s, tr('pianoStyles.' + s)]), state.pianoStyle);
    $('#adventure').value = state.adventure;
    $('#tempo').value = state.tempo;
    $('#tempo-out').textContent = state.tempo;
    $('#smooth-bass').checked = state.smoothBass;
    $('#repeat').checked = state.repeat;
    const seg = (sel, attr, val) => $$(sel + ' [data-' + attr + ']').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset[attr] === String(val))));
    seg('#color', 'color', state.color);
    seg('#ending', 'ending', state.ending);
    seg('#view', 'inst', state.instrument);
    seg('#rhythm', 'rhythm', state.rhythm);
    $$('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === state.lang)));
    $$('[data-notation]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.notation === state.notation)));
    $('#piano-style-wrap').hidden = isFretted();
    $('#tuning-wrap').hidden = !isFretted();
    // Power-chord styles (metal, punk): the first colour level is power chords, then triads.
    const colorKeys = style.power ? ['colorPower', 'color0', 'color2'] : ['color0', 'color1', 'color2'];
    $$('#color [data-color]').forEach((b, n) => { b.textContent = tr(colorKeys[n]); });
    $('#generate').title = tr('generate') + ' (G)';
    syncPlay();
  }
  function syncPlay() {
    const on = A.playing;
    $('#play').setAttribute('aria-pressed', String(on));
    $('#play-label').textContent = on ? tr('stop') : tr('play');
  }

  const ICON = {
    lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    unlock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.6-1.7"/></svg>',
    swap: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 0 1 13.7-5.6L20 8.5M20 4v4.5h-4.5M20 12a8 8 0 0 1-13.7 5.6L4 15.5M4 20v-4.5h4.5"/></svg>',
    prev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
    next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
  };

  function miniKeyboard(i) {
    const pv = derived.piano[i];
    const r = derived.realized[i];
    const lo = Math.floor(Math.min(...pv.upper) / 12) * 12;
    const hi = Math.max(lo + 23, Math.max(...pv.upper));
    const marks = new Map(pv.upper.map((m) => [m, { cls: (r.tones.find((t) => t.pc === m % 12) || {}).label === 'R' ? 'root' : 'tone' }]));
    const bassLabel = nn(T.spell((r.tones.find((t) => t.pc === pv.bassPc) || r.root).letter, pv.bassPc)) + (Math.floor(pv.bass / 12) - 1);
    return `<div class="mini-kbd"><span class="bass-tag" title="Bass">${esc(bassLabel)}</span>${D.keyboard(lo, hi, marks, { h: 40, aria: symbolText(i) })}</div>`;
  }

  function renderSheet() {
    const k = derived.key;
    $('#sheet-title').textContent = `${nn(k.tonic)} ${tr('modes.' + state.mode).toLowerCase()} · ${tr('styles.' + state.style)}`;
    const src = prog.source || {};
    let s = '';
    if (src.type === 'template') s = tr('src.template', { name: src.name[state.lang] || src.name.en });
    else if (src.type === 'walk') s = tr('src.walk') + (src.period ? ' ' + tr('src.period') : '');
    else if (src.type === 'edited') s = tr('src.edited');
    const bars = layout();
    $('#source').textContent = `${prog.chords.length} ${tr('chords')} · ${bars.length} ${tr('bars')}. ${s}`;
    const canLock = !G.STYLES[state.style].templatesOnly;
    const loop = state.ending === 'loop';
    $('#measures').className = 'measures' + (loop ? ' is-loop' : ' is-final') + (bars.length > 8 ? ' is-long' : '');
    $('#measures').innerHTML = bars.map((items, b) => `
      <div class="bar${b === 0 ? ' first' : ''}${b === bars.length - 1 ? ' last' : ''}" data-bar="${b + 1}">
        <span class="bar-no">${b + 1}</span>
        ${items[0].cont ? simile(items[0].i) : items.map((x) => chordCard(x.i, canLock, items.length > 1)).join('')}
      </div>`).join('');
    renderLegend();
  }

  // Bar-repeat sign: the chord from the previous bar keeps sounding.
  function simile(i) {
    return `<button type="button" class="simile${i === lastPlaying ? ' is-playing' : ''}" data-act="select" data-i="${i}" title="${esc(tr('simile', { a: symbolText(i) }))}" aria-label="${esc(tr('simile', { a: symbolText(i) }))}">
      <svg viewBox="0 0 40 40" aria-hidden="true"><line x1="11" y1="31" x2="29" y2="9"/><circle cx="12" cy="13" r="3"/><circle cx="28" cy="27" r="3"/></svg>
      <span class="simile-name">${esc(symbolText(i))}</span></button>`;
  }

  function chordCard(i, canLock, half) {
    const c = prog.chords[i];
    const info = G.fnInfo(c, state.mode, nextChord(i));
    const fn = info.fn;
    const g = derived.fret && derived.fret[i];
    const visual = g
      ? `<div class="gwrap">${D.guitar(g.shapes[g.chosen], derived.realized[i], { aria: symbolText(i) })}
           ${g.shapes.length > 1 ? `<div class="shape-nav">
             <button type="button" class="icon-btn" data-act="prev" data-i="${i}" title="${esc(tr('prevShape'))}" aria-label="${esc(tr('prevShape'))}">${ICON.prev}</button>
             <span class="shape-count">${g.chosen + 1}/${g.shapes.length}</span>
             <button type="button" class="icon-btn" data-act="next" data-i="${i}" title="${esc(tr('nextShape'))}" aria-label="${esc(tr('nextShape'))}">${ICON.next}</button>
           </div>` : ''}</div>`
      : miniKeyboard(i);
    return `
      <article class="chord fn-${fn}${info.weak ? ' weak' : ''}${half ? ' half' : ''}${i === selected ? ' is-selected' : ''}${c.locked ? ' is-locked' : ''}" data-i="${i}">
        <button type="button" class="chord-main" data-act="select" data-i="${i}" aria-label="${esc(symbolText(i))}">
          <span class="sym">${symbolHTML(i)}</span>
          <span class="rn">${esc(T.romanText(c))}</span>
          <span class="fn-tag" title="${esc(fnTitle(info))}">${esc(tr('deg.' + info.name))}</span>
        </button>
        ${visual}
        <div class="chord-tools">
          ${canLock ? `<button type="button" class="icon-btn${c.locked ? ' on' : ''}" data-act="lock" data-i="${i}" aria-pressed="${!!c.locked}" title="${esc(tr(c.locked ? 'unlock' : 'lock'))}" aria-label="${esc(tr(c.locked ? 'unlock' : 'lock'))}">${c.locked ? ICON.lock : ICON.unlock}</button>` : ''}
          ${!G.STYLES[state.style].templatesOnly ? `<button type="button" class="icon-btn" data-act="swap" data-i="${i}" title="${esc(tr('swap'))}" aria-label="${esc(tr('swap'))}">${ICON.swap}</button>` : ''}
        </div>
      </article>`;
  }

  // A chord's job can depend on where it goes next (♭VII → IV is not a dominant).
  function nextChord(i) { return prog.chords[i + 1] || (state.ending === 'loop' ? prog.chords[0] : null); }
  // Colour = function (what the chord does); the tag text = scale degree (what the chord is).
  function fnTitle(info) { return tr('fnLong.' + info.fn) + (info.weak ? ' — ' + tr('fnWeak') : ''); }
  function renderLegend() {
    $('#legend').innerHTML = `<span class="lg-intro">${esc(tr('legendIntro'))}</span>`
      + ['T', 'PD', 'D'].map((f) => `<span class="lg fn-${f}"><i></i>${esc(tr('fn.' + f))}</span>`).join('')
      + `<span class="lg fn-D weak"><i></i>${esc(tr('legendWeak'))}</span>`
      + `<span class="lg lg-root"><i></i>${state.lang === 'fr' ? 'Fondamentale (R)' : 'Root (R)'}</span>`;
  }

  function renderFocus() {
    const i = Math.min(selected, prog.chords.length - 1);
    const c = prog.chords[i];
    const r = derived.realized[i];
    const g = derived.fret && derived.fret[i];
    const info = G.fnInfo(c, state.mode, nextChord(i));
    const fn = info.fn;
    // The keyboard shows exactly the notes the current instrument plays.
    const played = notesFor(i);
    const marks = new Map();
    played.forEach((m) => { const t = r.tones.find((x) => x.pc === m % 12) || {}; marks.set(m, { label: t.label || '', cls: t.label === 'R' ? 'root' : 'tone' }); });
    const tones = r.tones.map((t) => `<li><span class="tone-name">${esc(nn(t))}</span><span class="tone-int${t.label === 'R' ? ' root' : ''}">${esc(t.label)}</span></li>`).join('');
    const shapes = g ? g.shapes.map((s, k) => `<button type="button" class="alt${k === g.chosen ? ' on' : ''}" data-act="shape" data-i="${i}" data-k="${k}" aria-pressed="${k === g.chosen}" title="${esc(tr('shapeOf', { a: k + 1, b: g.shapes.length }))}">${D.guitar(s, r, { labels: false })}<span>${s.frets.map((f) => (f < 0 ? '×' : f)).join(' ')}</span></button>`).join('') : '';
    const lo = Math.min(36, Math.floor(Math.min(...played) / 12) * 12), hi = Math.max(84, Math.max(...played));
    $('#focus').innerHTML = `
      <div class="focus-head fn-${fn}${info.weak ? ' weak' : ''}">
        <div class="focus-sym">${symbolHTML(i)}</div>
        <div class="focus-meta">
          <span class="rn big">${esc(T.romanText(c))} · ${esc(tr('deg.' + info.name))}</span>
          <span class="fn-tag">${esc(fnTitle(info))}</span>
        </div>
        <ul class="tones" aria-label="${esc(tr('notes'))}">${tones}</ul>
      </div>
      <div class="focus-grid${g ? '' : ' solo'}">
        ${g ? `<div class="focus-guitar">
          <h3 class="h3">${esc(tr(state.instrument === 'ukulele' ? 'ukeShapes' : 'shapes'))} · ${esc(tr('tunings.' + tuningKey()))}</h3>
          <div class="big-g">${D.guitar(g.shapes[g.chosen], r, { aria: symbolText(i), names: currentTuning().names })}</div>
          <div class="alts">${shapes}</div>
        </div>` : ''}
        <div class="focus-piano">
          <h3 class="h3">${esc(g ? tr('soundingNotes') : tr('keyboard'))}</h3>
          <div class="big-kbd">${D.keyboard(lo, hi, marks, { labels: true, octaves: true, h: 64, aria: symbolText(i) })}</div>
          <p class="voicing-notes">${played.map((m) => { const t = r.tones.find((x) => x.pc === m % 12); return esc(nn(t || T.spell(0, m)) + (Math.floor(m / 12) - 1)); }).join(' · ')}</p>
        </div>
      </div>`;
  }

  function chordRef(i) { return `<b class="cref">${esc(symbolText(i))}</b>`; }
  function renderAnalysis() {
    const k = derived.key;
    const items = G.analyze(prog, k, state.ending);
    $('#flow').innerHTML = prog.chords.map((c, i) => { const inf = G.fnInfo(c, state.mode, nextChord(i)); return `<span class="flow-step fn-${inf.fn}${inf.weak ? ' weak' : ''}" title="${esc(fnTitle(inf))}">${esc(tr('fnShort.' + inf.fn))}</span>`; }).join('<span class="flow-arrow" aria-hidden="true">→</span>');
    // Leading tone = the major 3rd; power chords have none, so spell the chord they stand for.
    const lt = (i) => { const t = T.realize(Object.assign({}, prog.chords[i], { quality: T.harm(prog.chords[i]) }), k).tones.find((x) => x.label === '3'); return t ? nn(t) : ''; };
    const lines = items.map((it) => {
      const vars = {
        a: it.i != null ? chordRef(it.i) : '',
        b: it.j != null ? chordRef(it.j) : it.i != null && prog.chords[it.i].target ? `<b class="cref">${esc(nn(T.realize(prog.chords[it.i].target, k).root) + (T.Q[prog.chords[it.i].target.quality].fam === 'min' ? 'm' : ''))}</b>` : '',
        c: it.j != null && prog.chords[it.j + 1] ? chordRef(it.j + 1) : '',
        lt: it.i != null ? esc(lt(it.i)) : '',
        mode: tr('modes.' + state.mode).toLowerCase(),
      };
      let kind = it.k;
      if (kind === 'borrowed') kind = it.from === 'minor' ? 'borrowedDark' : 'borrowedBright';
      // tr() escapes nothing, so build with placeholders then swap in the HTML.
      const raw = tr('it.' + kind, { a: '\u0001a', b: '\u0001b', c: '\u0001c', lt: '\u0001l', mode: vars.mode });
      return '<li>' + esc(raw).replace(/\u0001a/g, vars.a).replace(/\u0001b/g, vars.b).replace(/\u0001c/g, vars.c).replace(/\u0001l/g, vars.lt) + '</li>';
    });
    $('#analysis').innerHTML = lines.join('');
  }

  function renderHistory() {
    const ol = $('#history');
    if (!history.length) { ol.innerHTML = `<li class="empty">${esc(tr('none'))}</li>`; return; }
    ol.innerHTML = history.map((h, n) => `<li><button type="button" data-hist="${n}"><span class="h-chords">${esc(h.label)}</span><span class="h-meta">${esc(nn(T.tonicFor(h.tonic, h.mode)))} ${esc(tr('modes.' + h.mode).toLowerCase())} · ${esc(tr('styles.' + h.style))}</span></button></li>`).join('');
  }

  function refresh(regenerated) {
    compute();
    renderControls();
    renderSheet();
    renderFocus();
    renderAnalysis();
    renderHistory();
    persist();
    if (regenerated) restartIfPlaying();
  }

  /* ---------- events ---------- */
  function bind() {
    $('#generate').addEventListener('click', generate);
    $('#play').addEventListener('click', togglePlay);
    $('#copy').addEventListener('click', copyChart);
    $('#midi').addEventListener('click', downloadMidi);

    $('#key').addEventListener('change', (e) => { state.tonic = +e.target.value; refresh(true); });
    $('#mode').addEventListener('change', (e) => { state.mode = e.target.value; generate(); });
    $('#style').addEventListener('change', (e) => {
      state.style = e.target.value;
      const st = G.STYLES[state.style];
      if (!st.modes.includes(state.mode)) state.mode = st.modes[0];
      if (!st.lengths.includes(state.length)) state.length = st.lengths[0];
      state.color = st.defColor;
      state.tempo = st.tempo;
      generate();
    });
    $('#length').addEventListener('change', (e) => { state.length = +e.target.value; generate(); });
    $('#adventure').addEventListener('input', (e) => { state.adventure = +e.target.value; persist(); });
    $('#adventure').addEventListener('change', () => generate());
    $('#smooth-bass').addEventListener('change', (e) => { state.smoothBass = e.target.checked; shapePick = {}; refresh(true); });
    $('#tuning').addEventListener('change', (e) => { if (state.instrument === 'ukulele') state.ukeTuning = e.target.value; else state.tuning = e.target.value; shapePick = {}; refresh(true); });
    $('#rhythm').addEventListener('click', (e) => { const b = e.target.closest('[data-rhythm]'); if (!b) return; state.rhythm = b.dataset.rhythm; generate(); });
    $('#piano-style').addEventListener('change', (e) => { state.pianoStyle = e.target.value; refresh(true); });
    $('#pattern').addEventListener('change', (e) => { state.pattern = e.target.value; persist(); restartIfPlaying(); });
    $('#repeat').addEventListener('change', (e) => { state.repeat = e.target.checked; persist(); restartIfPlaying(); });
    $('#tempo').addEventListener('input', (e) => { state.tempo = +e.target.value; $('#tempo-out').textContent = state.tempo; });
    $('#tempo').addEventListener('change', () => { persist(); restartIfPlaying(); });

    $('#color').addEventListener('click', (e) => {
      const b = e.target.closest('[data-color]'); if (!b) return;
      state.color = +b.dataset.color;
      G.recolor(prog, { styleId: state.style, key: key(), color: state.color });
      refresh(true);
    });
    $('#ending').addEventListener('click', (e) => { const b = e.target.closest('[data-ending]'); if (!b) return; state.ending = b.dataset.ending; generate(); });
    $('#view').addEventListener('click', (e) => {
      const b = e.target.closest('[data-inst]'); if (!b || b.dataset.inst === state.instrument) return;
      state.instrument = b.dataset.inst;
      shapePick = {};
      refresh(true); // re-voices for the new instrument and restarts playback with its sound
    });
    $$('[data-lang]').forEach((b) => b.addEventListener('click', () => { state.lang = b.dataset.lang; refresh(false); }));
    $$('[data-notation]').forEach((b) => b.addEventListener('click', () => { state.notation = b.dataset.notation; refresh(false); }));

    const onAct = (e) => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const i = +b.dataset.i;
      const act = b.dataset.act;
      if (act === 'select') {
        selected = i;
        $$('.chord').forEach((el) => el.classList.toggle('is-selected', +el.dataset.i === i));
        renderFocus();
        audition(i);
      } else if (act === 'lock') toggleLock(i);
      else if (act === 'swap') reroll(i);
      else if (act === 'prev') cycleShape(i, -1);
      else if (act === 'next') cycleShape(i, 1);
      else if (act === 'shape') { derived.fret[i].chosen = +b.dataset.k; shapePick[i] = +b.dataset.k; renderSheet(); renderFocus(); persist(); audition(i); }
    };
    $('#measures').addEventListener('click', onAct);
    $('#focus').addEventListener('click', onAct);
    $('#history').addEventListener('click', (e) => { const b = e.target.closest('[data-hist]'); if (b) restore(history[+b.dataset.hist]); });

    document.addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target.tagName || '').toLowerCase();
      if (['input', 'select', 'textarea'].includes(tag)) return;
      if (e.code === 'Space' && tag !== 'button') { e.preventDefault(); togglePlay(); }
      else if (e.key === 'g' || e.key === 'G') { e.preventDefault(); generate(); }
    });
  }

  /* ---------- boot ---------- */
  function boot() {
    bind();
    const st = G.STYLES[state.style];
    if (!st) state.style = 'pop';
    if (!prog || !prog.chords || !prog.chords.length) {
      prog = G.generate({ key: key(), styleId: state.style, length: state.length, ending: state.ending, rhythmMode: state.rhythm, adventure: state.adventure, color: state.color, seed: 20261016 });
    }
    try { refresh(false); } catch (err) {
      // A saved progression from an older version can be unreadable: start fresh.
      console.warn('Cadence: resetting saved state', err);
      prog = G.generate({ key: key(), styleId: state.style, length: state.length, ending: state.ending, adventure: state.adventure, color: state.color });
      shapePick = {}; history = [];
      refresh(false);
    }
  }
  boot();
})(window.Cadence);
