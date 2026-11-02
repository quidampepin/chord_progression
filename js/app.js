/* Cadence — app controller: state, rendering, events. */
(function (C) {
  'use strict';
  const { theory: T, gen: G, voicing: V, audio: A, i18n: I, draw: D, scales: SC, licks: LK } = C;
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => [...(el || document).querySelectorAll(s)];
  const esc = D.esc;

  /* ---------- state ---------- */
  const STORE = 'cadence.v1';
  const defaults = {
    lang: (navigator.language || 'en').toLowerCase().startsWith('fr') ? 'fr' : 'en',
    notation: 'letters', tonic: 0, mode: 'major', style: 'pop', length: 4, color: 0, adventure: 0.35,
    ending: 'loop', rhythm: 'varied', smoothBass: true, pianoStyle: 'close', tuning: 'standard', ukeTuning: 'ukeStd', instrument: 'guitar', pattern: 'pulse', tempo: 100, repeat: true,
    scaleScope: 'key', keyScaleIdx: 0, scaleAnchor: null, posSystem: 'auto', scaleLabels: 'degrees',
    panelTab: 'scales', lickId: null, lickFilter: 'all', lickFitOnly: true, lickSpeed: 0.75, learned: [],
    lickScale: null, lickAnchor: null, extraKeyScale: null,
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
    chordScalePick = {};
    state.extraKeyScale = null;
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
    stopScale();
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
    play: '<svg viewBox="0 0 24 24" aria-hidden="true" class="fill"><path d="M7 4.5v15l13-7.5z"/></svg>',
    stop: '<svg viewBox="0 0 24 24" aria-hidden="true" class="fill"><rect x="6" y="6" width="12" height="12" rx="1.5"/></svg>',
    loop: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h12"/><path d="M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/></svg>',
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
    renderScales();
  }


  /* ---------- scales to play over it ---------- */
  let chordScalePick = {};
  const SCALE_MODES = new Set(['ionian', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'aeolian', 'phrygianDom']);
  function scaleFor(i) {
    const k = derived.key;
    if (state.scaleScope === 'key') {
      const ks = SC.keyScale(k, state.style, prog.chords);
      if (state.extraKeyScale && !ks.options.some((o) => o.id === state.extraKeyScale)) ks.options.push({ id: state.extraKeyScale, root: k.tonic });
      const idx = Math.max(0, Math.min(state.keyScaleIdx || 0, ks.options.length - 1));
      const o = ks.options[idx];
      return { sc: SC.build(o.id, o.root), options: ks.options, idx, reason: null, extra: {} };
    }
    const cs = SC.chordScale(prog.chords[i], k, state.style);
    const idx = Math.min(chordScalePick[i] || 0, cs.options.length - 1);
    const o = cs.options[idx];
    return { sc: SC.build(o.id, o.root), options: cs.options, idx, reason: cs.reason, extra: cs.extra };
  }
  const scaleName = (o) => `${nn(o.root)} ${tr('scaleNames.' + o.id)}`;
  let scaleRun = [];

  function scaleWhy(i, info) {
    const sc = info.sc;
    const name = scaleName(sc);
    const ref = (j) => `\u0002${j}\u0002`;
    let raw;
    if (state.scaleScope === 'key') {
      const id = sc.id;
      const kind = SCALE_MODES.has(id) ? 'keyMode' : id === 'minorPent' || id === 'majorPent' ? 'keyPent' : id === 'blues' ? 'keyBlues' : id === 'majorBlues' ? 'keyMajorBlues' : 'keyHarm';
      raw = tr('sw.' + kind, { scale: name });
      const bluesish = state.style === 'blues' && ['blues', 'minorPent', 'majorBlues'].includes(id);
      const cl = bluesish ? [] : SC.clashes(sc, prog.chords, derived.key);
      const seen = new Set();
      const names = cl.filter((j) => { const t = symbolText(j); if (seen.has(t)) return false; seen.add(t); return true; }).map(ref);
      if (names.length) raw += ' ' + tr('sw.clash', { chords: names.join(', ') });
    } else {
      const changes = (info.extra.changes || []).map((c) => nn(c.from) + ' → ' + nn(c.to)).join(', ');
      raw = tr('sw.' + info.reason, { chord: ref(i), root: nn(sc.root), scale: name, changes, target: info.extra.target ? nn(info.extra.target) + (info.extra.targetMinor ? 'm' : '') : '' });
    }
    const avoid = SC.avoidNotes(sc, prog.chords[i], derived.key);
    if (avoid.length) raw += ' ' + tr('sw.avoid', { notes: avoid.map((pc) => nn(sc.notes.find((n) => n.pc === pc))).join(', '), chord: ref(i) });
    else if (sc.notes.length === 5) raw += ' ' + tr('sw.noAvoid');
    return esc(raw).replace(/\u0002(\d+)\u0002/g, (_, j) => chordRef(+j));
  }

  function renderPanelTabs() {
    $$('.panel-tabs [data-tab]').forEach((b) => { const on = b.dataset.tab === state.panelTab; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
    $('#scales-body').hidden = state.panelTab !== 'scales';
    $('#licks-body').hidden = state.panelTab !== 'licks';
  }
  function renderScales() {
    if (!derived) return;
    renderPanelTabs();
    if (state.panelTab === 'licks') { if (!lickCtx) renderLicks(); return; }
    const i = Math.min(selected, prog.chords.length - 1);
    const info = scaleFor(i);
    const sc = info.sc;
    const r = derived.realized[i];
    const chordTone = new Map(r.tones.map((t) => [t.pc, t.label]));
    const labelOf = (pc) => { const n = sc.notes.find((x) => x.pc === pc); return n ? (state.scaleLabels === 'names' ? nn(n) : n.label) : ''; };
    const avoid = new Set(SC.avoidNotes(sc, prog.chords[i], derived.key));
    const clsOf = (pc) => { const ct = chordTone.get(pc); return (ct === 'R' ? 'croot' : ct ? 'ctone' : 'scale') + (pc === sc.root.pc ? ' sroot' : '') + (avoid.has(pc) ? ' avoid' : ''); };

    $$('#scale-scope [data-scope]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.scope === state.scaleScope)));
    $$('#scale-labels [data-lab]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lab === state.scaleLabels)));
    $('#scale-for').innerHTML = state.scaleScope === 'key'
      ? esc(tr('scaleForKey', { key: nn(derived.key.tonic) + ' ' + tr('modes.' + state.mode).toLowerCase() })) + ' · ' + esc(tr('targetsOf')) + ' ' + chordRef(i)
      : esc(tr('scaleForChord')) + ' ' + chordRef(i);
    $('#scale-options').innerHTML = info.options.map((o, k) => `<button type="button" class="chip${k === info.idx ? ' on' : ''}" data-scale="${k}" aria-pressed="${k === info.idx}">${esc(scaleName(o))}${k === 0 ? `<span class="chip-tag">${esc(tr('best'))}</span>` : ''}</button>`).join('');
    const nLicks = LK.LICKS.filter((l) => l.scale === sc.id).length;
    $('#scale-why').innerHTML = scaleWhy(i, info) + (nLicks ? ` <button type="button" class="link-btn" data-to-licks="${sc.id}">${esc(tr('licksInScale', { n: nLicks }))} →</button>` : '');
    syncScaleButton();

    // Chord by chord: the whole map at a glance.
    const cs = $('#chord-scales');
    cs.hidden = state.scaleScope !== 'chord';
    if (!cs.hidden) {
      const seen = new Set();
      cs.innerHTML = prog.chords.map((c, j) => {
        const o = SC.chordScale(c, derived.key, state.style).options[Math.min(chordScalePick[j] || 0, 9)] || SC.chordScale(c, derived.key, state.style).options[0];
        const sig = symbolText(j) + o.id;
        if (seen.has(sig) && j !== i) return '';
        seen.add(sig);
        return `<button type="button" class="cs-item${j === i ? ' on' : ''}" data-act="select" data-i="${j}"><b>${esc(symbolText(j))}</b><span>${esc(scaleName(o))}</span></button>`;
      }).join('');
    }

    const neckEl = $('#neck');
    const posRow = $('#pos-row');
    if (isFretted()) {
      const tun = currentTuning();
      const positions = SC.positions(sc, tun.midi, state.posSystem);
      let pIdx = -1;
      if (state.scaleAnchor != null && positions.length) {
        let best = Infinity;
        positions.forEach((p, k) => { const d = Math.abs(p.center - state.scaleAnchor); if (d < best) { best = d; pIdx = k; } });
      }
      const pos = pIdx >= 0 ? positions[pIdx] : null;
      const maxF = Math.max(state.instrument === 'ukulele' ? 12 : 15, pos ? pos.maxF : 0);
      const inPos = pos ? new Set(pos.notes.map((x) => x.s + ':' + x.f)) : null;
      const notes = SC.wholeNeck(sc, tun.midi, maxF).map((x) => Object.assign(x, { label: labelOf(x.m % 12), cls: clsOf(x.m % 12), out: !!inPos && !inPos.has(x.s + ':' + x.f) }));
      neckEl.innerHTML = D.neck(tun.midi, tun.names, notes, { maxF, window: pos ? [pos.minF, pos.maxF] : null, aria: scaleName(sc) });
      const hepta = sc.notes.length === 7;
      posRow.hidden = false;
      posRow.innerHTML = `<span class="mini-label">${esc(tr('position'))}</span>
        <div class="chips">
          <button type="button" class="chip${!pos ? ' on' : ''}" data-pos="all" aria-pressed="${!pos}">${esc(tr('wholeNeck'))}</button>
          ${positions.map((p, k) => `<button type="button" class="chip num${k === pIdx ? ' on' : ''}" data-pos="${k}" aria-pressed="${k === pIdx}" title="${esc(tr('frets', { a: p.minF, b: p.maxF }))}">${k + 1}</button>`).join('')}
        </div>
        ${hepta ? `<div class="seg" role="group" id="pos-system">
          <button type="button" data-sys="auto" aria-pressed="${state.posSystem !== 'box'}">${esc(tr('threeNps'))}</button>
          <button type="button" data-sys="box" aria-pressed="${state.posSystem === 'box'}">${esc(tr('boxShape'))}</button>
        </div>` : ''}`;
      scaleRun = SC.runNotes(sc, pos, tun.midi[0] + (state.instrument === 'ukulele' ? 0 : 5));
    } else {
      posRow.hidden = true;
      const lo = 48 + sc.root.pc, hi = lo + 24;
      const marks = new Map();
      for (let m = lo; m <= hi; m++) if (sc.pcs.has(m % 12)) marks.set(m, { label: labelOf(m % 12), cls: clsOf(m % 12) });
      neckEl.innerHTML = `<div class="big-kbd">${D.keyboard(lo, hi, marks, { labels: true, h: 64, aria: scaleName(sc) })}</div>`;
      scaleRun = SC.runNotes(sc, null, 60);
    }
  }

  // The scale button toggles: play the run, or stop it part-way.
  let runTimers = [];
  let runKind = 'scale';
  const scaleRunning = () => runTimers.length > 0;
  function syncScaleButton() {
    const b = $('#play-scale');
    const on = scaleRunning() && runKind === 'scale';
    b.textContent = tr(on ? 'stopScale' : 'playScale');
    b.setAttribute('aria-pressed', String(on));
  }
  function stopScale() {
    if (!scaleRunning()) return;
    runTimers.forEach(clearTimeout);
    runTimers = [];
    A.stopRun();
    $$('.is-sounding').forEach((el) => el.classList.remove('is-sounding'));
    lickHi = -1;
    syncRunButtons();
  }
  function playScale() {
    if (scaleRunning()) { stopScale(); return; }
    if (A.playing) { toast(tr('stopFirst')); return; }
    const notes = scaleRun.slice();
    const times = A.run(notes, state.instrument, Math.max(80, state.tempo));
    if (!times) return;
    runKind = 'scale';
    runTimers = times.map((ms, k) => setTimeout(() => {
      $$('.n-note.is-sounding').forEach((el) => el.classList.remove('is-sounding'));
      $$(`.n-note[data-m="${notes[k]}"]`).forEach((el) => el.classList.add('is-sounding'));
    }, ms));
    // Finished on its own: clear the highlight and reset the button.
    runTimers.push(setTimeout(() => { runTimers = []; $$('.n-note.is-sounding').forEach((el) => el.classList.remove('is-sounding')); syncRunButtons(); }, times[times.length - 1] + 450));
    syncRunButtons();
  }


  /* ---------- licks ---------- */
  let lickCtx = null;      // set while a lick plays over the progression
  let lickHi = -1;
  const SCALE_ORDER = ['minorPent', 'blues', 'majorPent', 'majorBlues', 'mixolydian', 'dorian', 'aeolian', 'harmonicMinor', 'phrygian', 'phrygianDom', 'ionian'];
  function baseLickList() {
    const k = derived.key;
    let list = state.lickFitOnly && !state.lickScale ? LK.LICKS.filter((l) => LK.fits(l, k, state.style)) : LK.LICKS.slice();
    if (state.lickScale) list = list.filter((l) => l.scale === state.lickScale);
    return list;
  }
  function currentLickList() {
    let list = baseLickList();
    const f = state.lickFilter;
    if (f === 'turn') list = list.filter((l) => l.over === 'turn' || l.over === 'end');
    else if (f !== 'all') list = list.filter((l) => l.over === f);
    return list.sort((a, b) => SCALE_ORDER.indexOf(a.scale) - SCALE_ORDER.indexOf(b.scale));
  }
  function currentLick() {
    const list = currentLickList();
    return list.find((l) => l.id === state.lickId) || list[0] || null;
  }
  function lickTuning() { return state.instrument === 'guitar' ? currentTuning() : V.TUNINGS.standard; }
  function chordAtBeat(beat) {
    let start = 0, idx = 0;
    prog.chords.forEach((c, i) => { if (start <= beat) idx = i; start += c.beats; });
    return idx;
  }
  // Same lick, chosen position: follow the remembered area of the neck, else the lick's own home position.
  function lickRealized(l) {
    const tun = lickTuning();
    const base = LK.realize(l, derived.key, tun.midi);
    let idx = base.posIndex;
    if (state.lickAnchor != null && base.positions.length) {
      let best = Infinity;
      base.positions.forEach((p, i) => { const d = Math.abs(p.center - state.lickAnchor); if (d < best) { best = d; idx = i; } });
    }
    const r = idx === base.posIndex ? base : LK.realize(l, derived.key, tun.midi, idx);
    return { r, base, tun };
  }
  const CHROMA_LETTER = [0, 0, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6];
  function pitchName(pc, sc) {
    const inScale = sc.notes.find((n) => n.pc === pc) || derived.key.scale.find((n) => n.pc === pc);
    return nn(inScale || T.spell(CHROMA_LETTER[pc], pc));
  }

  function renderLicks() {
    if (!derived || state.panelTab !== 'licks') return;
    const k = derived.key;
    const learned = new Set(state.learned);
    const list = currentLickList();
    const l = currentLick();
    $('#licks-sub').textContent = tr('licksSub', { n: LK.LICKS.length, m: LK.LICKS.filter((x) => learned.has(x.id)).length });
    $('#lick-fit').checked = state.lickFitOnly;
    $('#lick-fit').disabled = !!state.lickScale;
    const filters = ['all', 'I', 'IV', 'V', 'turn', 'any'].concat(baseLickList().some((x) => x.over === 'iiVI') ? ['iiVI'] : []);
    if (!filters.includes(state.lickFilter)) state.lickFilter = 'all';
    $('#lick-filters').innerHTML = (state.lickScale ? `<button type="button" class="chip on chip-x" data-lact="clearScale" title="${esc(tr('clearFilter'))}">${esc(tr('scaleFilter', { scale: scaleName({ id: state.lickScale, root: k.tonic }) }))} ✕</button>` : '')
      + filters.map((f) => `<button type="button" class="chip${state.lickFilter === f ? ' on' : ''}" data-lfilter="${f}" aria-pressed="${state.lickFilter === f}">${esc(tr('lickFilters.' + f))}</button>`).join('');
    // list, grouped by the scale each lick comes from
    let html = '', group = null;
    for (const x of list) {
      if (x.scale !== group) {
        group = x.scale;
        const count = list.filter((y) => y.scale === group).length;
        html += `<li class="lick-group">${esc(scaleName({ id: group, root: k.tonic }))}<span>${count}</span></li>`;
      }
      html += `<li><button type="button" class="lick-item${l && x.id === l.id ? ' on' : ''}" data-lick="${x.id}" aria-pressed="${!!(l && x.id === l.id)}">
        <span class="li-name">${learned.has(x.id) ? '<span class="li-check" aria-label="' + esc(tr('learned')) + '">✓</span>' : ''}${esc(x.n[state.lang] || x.n.en)}</span>
        <span class="li-meta">${esc(tr('over.' + x.over))} · ${esc(tr('lvl.' + x.lvl))}</span>
      </button></li>`;
    }
    $('#lick-list').innerHTML = html || `<li class="empty">${esc(tr('noLicks'))}</li>`;

    const det = $('#lick-detail');
    if (!l) {
      det.innerHTML = `<div class="lick-empty"><p>${esc(tr('noFit'))}</p>${state.lickFitOnly ? `<button type="button" class="btn-ghost" data-lact="showAll">${esc(tr('showAll'))}</button>` : ''}</div>`;
      return;
    }
    if (state.instrument === 'ukulele') {
      det.innerHTML = `<div class="lick-empty"><p>${esc(tr('ukeNotice'))}</p><button type="button" class="btn-ghost" data-lact="toGuitar">${esc(tr('toGuitar'))}</button></div>`;
      return;
    }
    const { r, base, tun } = lickRealized(l);
    const pl = LK.place(l, prog.chords);
    const isLearned = learned.has(l.id);
    const sc = r.scale;
    const pos = r.position;

    // where it lands in this progression
    const barTxt = l.bars > 1 ? tr('barsRange', { a: pl.bar + 1, b: pl.bar + l.bars }) : tr('barOne', { a: pl.bar + 1 });
    let where;
    if (!pl.found) where = tr(l.over === 'iiVI' ? 'where.missingIIVI' : 'where.missing', { chord: l.over });
    else if (l.over === 'turn') where = tr('where.turn', { bars: barTxt });
    else if (l.over === 'end') where = tr(state.ending === 'resolve' ? 'where.end' : 'where.endLoop', { bars: barTxt });
    else if (l.over === 'any') where = tr('where.any', { bars: barTxt });
    else if (l.over === 'iiVI') where = tr('where.iiVI', { bars: barTxt });
    else where = tr('where.over', { bars: barTxt, chord: symbolText(chordAtBeat(pl.startBeat)) });
    const chords = Array.from({ length: l.bars }, (_, b) => symbolText(chordAtBeat(pl.startBeat + b * 4)));

    // degrees under the tab; green when the note belongs to the chord sounding at that moment
    const label = (n) => (state.scaleLabels === 'names' ? pitchName(n.m % 12, sc) : n.label);
    const degrees = r.notes.map((n) => ({ label: label(n), ct: derived.realized[chordAtBeat(pl.startBeat + n.t)].pcs.includes(n.m % 12) }));

    // the neck: the whole scale, the chosen position outlined, the lick as the highlighted path
    const inPos = new Set(pos.notes.map((x) => x.s + ':' + x.f));
    const lickKeys = new Set(r.notes.map((n) => n.s + ':' + n.f));
    const maxF = Math.min(20, Math.max(12, pos.maxF + 2, ...r.notes.map((n) => n.f + 1)));
    const scaleNotes = SC.wholeNeck(sc, tun.midi, maxF).filter((x) => !lickKeys.has(x.s + ':' + x.f))
      .map((x) => Object.assign(x, { label: state.scaleLabels === 'names' ? pitchName(x.m % 12, sc) : (sc.notes.find((n) => n.pc === x.m % 12) || {}).label || '', cls: 'scale' + (x.m % 12 === sc.root.pc ? ' sroot' : ''), out: !inPos.has(x.s + ':' + x.f) }));
    const seen = new Set();
    const lickNotes = r.notes.filter((n) => { const key = n.s + ':' + n.f; if (seen.has(key)) return false; seen.add(key); return true; })
      .map((n) => ({ s: n.s, f: n.f, m: n.m, label: label(n), cls: (n.label === 'R' ? 'croot' : 'ctone') + ' lick' + (n.inBox ? '' : ' passing') }));

    const tags = [tr('over.' + l.over), tr('lvl.' + l.lvl)].concat(l.techs.map((t) => tr('techs.' + t)));
    const posChips = base.positions.map((p, i) => {
      const on = i === r.posIndex;
      const full = base.fullFit[i];
      return `<button type="button" class="chip num${on ? ' on' : ''}${full ? '' : ' partial'}" data-lpos="${i}" aria-pressed="${on}" title="${esc(tr('frets', { a: p.minF, b: p.maxF }) + ' · ' + tr(full ? 'posFits' : 'posPartly'))}">${i + 1}</button>`;
    }).join('');
    const playingCtx = !!(lickCtx && A.playing);
    det.innerHTML = `
      <div class="lick-top">
        <div class="lick-title">
          <h3 class="lick-name">${esc(l.n[state.lang] || l.n.en)}</h3>
          <p class="lick-tags">${tags.map((t) => `<span>${esc(t)}</span>`).join('')}</p>
        </div>
        <button type="button" class="btn-learned" data-lact="learned" aria-pressed="${isLearned}">${isLearned ? '✓ ' + esc(tr('learned')) : esc(tr('markLearned'))}</button>
      </div>
      <div class="lick-from">
        <span class="mini-label">${esc(tr('fromScale'))}</span>
        <b>${esc(scaleName(sc))}</b>
        <span class="lick-from-notes">${sc.notes.map((n) => `<i>${esc(state.scaleLabels === 'names' ? nn(n) : n.label)}</i>`).join('')}</span>
        <button type="button" class="link-btn" data-lact="toScales">${esc(tr('seeInScales'))} →</button>
      </div>
      <p class="lick-tip">${esc(l.tip[state.lang] || l.tip.en)}</p>
      <div class="lick-controls">
        <button type="button" class="btn-lick" id="lick-play" data-lact="play"></button>
        <button type="button" class="btn-ghost btn-ctx" id="lick-ctx" data-lact="context" aria-pressed="${playingCtx}"></button>
        <div class="speed">
          <span class="mini-label">${esc(tr('speed'))}</span>
          <div class="seg" role="group" id="lick-speed">${[0.5, 0.75, 1].map((v) => `<button type="button" data-speed="${v}" aria-pressed="${state.lickSpeed === v}">${v * 100}%</button>`).join('')}</div>
        </div>
        <span class="lick-status" id="lick-status" hidden></span>
      </div>
      <p class="lick-where">${esc(where)}</p>
      <div class="tab-wrap">${D.tab(r.notes, { strings: tun.midi.length, names: tun.names, bars: l.bars, chords, degrees, aria: l.n.en })}</div>
      <p class="tab-legend">${esc(tr('tabLegendDeg'))} <span class="tl-deg ct">${esc(tr('tabLegendGreen'))}</span> ${esc(tr('tabLegendCt'))}</p>
      <div class="pos-row lick-pos">
        <span class="mini-label">${esc(tr('position'))}</span>
        <div class="chips">${posChips}</div>
        <span class="pos-note">${esc(tr('frets', { a: pos.minF, b: pos.maxF }))} · ${esc(tr(base.fullFit[r.posIndex] ? 'posFits' : 'posPartly'))}</span>
      </div>
      <div class="neck-wrap lick-neck" id="lick-neck">${D.neck(tun.midi, tun.names, scaleNotes.concat(lickNotes), { maxF, window: [pos.minF, pos.maxF], aria: l.n.en })}</div>
      <p class="hint">${esc(tr('lickPosHint'))} ${esc(tr('lickHint'))}${r.refingered ? ' ' + esc(tr('refingered', { tuning: tr('tunings.' + state.tuning) })) : ''}${!isFretted() ? ' ' + esc(tr('pianoNote')) : ''}</p>`;
    syncRunButtons();
  }

  function lickHighlight(k, notes) {
    if (k === lickHi) return;
    lickHi = k;
    $$('#lick-detail .is-sounding').forEach((el) => el.classList.remove('is-sounding'));
    if (k < 0 || !notes || !notes[k]) return;
    const n = notes[k];
    $$(`#lick-detail .tb-note[data-k="${k}"]`).forEach((el) => el.classList.add('is-sounding'));
    $$(`#lick-neck .n-note.lick[data-m="${n.m}"]`).forEach((el) => el.classList.add('is-sounding'));
  }
  function lickStatus(text) {
    const el = $('#lick-status');
    if (!el) return;
    el.hidden = !text;
    el.textContent = text || '';
    el.className = 'lick-status' + (text === tr('yourTurn') ? ' turn' : '');
  }
  function syncRunButtons() {
    syncScaleButton();
    const p = $('#lick-play'), c = $('#lick-ctx');
    if (p) { const on = scaleRunning() && runKind === 'lick'; p.innerHTML = `${on ? ICON.stop : ICON.play}<span>${esc(tr(on ? 'stopLick' : 'playLick'))}</span>`; p.setAttribute('aria-pressed', String(on)); }
    if (c) { const on = !!(lickCtx && A.playing); c.innerHTML = `${on ? ICON.stop : ICON.loop}<span>${esc(tr(on ? 'stopLick' : 'playInContext'))}</span>`; c.setAttribute('aria-pressed', String(on)); }
  }
  function lickData() {
    const l = currentLick();
    if (!l) return null;
    return { l, r: lickRealized(l).r, pl: LK.place(l, prog.chords) };
  }
  function playLickAlone() {
    if (scaleRunning()) { stopScale(); return; }
    const d = lickData(); if (!d || !d.r.notes.length) return;
    if (A.playing) A.stop();
    const res = A.lick(d.r.notes, state.tempo * state.lickSpeed);
    if (!res) return;
    runKind = 'lick';
    runTimers = res.ms.map((ms, k) => setTimeout(() => lickHighlight(k, d.r.notes), ms));
    runTimers.push(setTimeout(() => { runTimers = []; lickHighlight(-1); syncRunButtons(); }, res.endMs + 300));
    syncRunButtons();
  }
  function playLickInContext() {
    if (lickCtx && A.playing) { A.stop(); return; }
    const d = lickData(); if (!d || !d.r.notes.length) return;
    stopScale();
    lickCtx = { start: d.pl.startBeat, notes: d.r.notes };
    const melody = d.r.notes.map((n) => Object.assign({}, n, { t: n.t + d.pl.startBeat }));
    A.play(events(), {
      tempo: state.tempo * state.lickSpeed, loop: true, instrument: state.instrument, pattern: state.pattern, melody, melodyEvery: 2,
      onStep: (i, beat, pass) => {
        markPlaying(i);
        if (!lickCtx) return;
        const listen = pass % 2 === 0;
        lickStatus(tr(listen ? 'listen' : 'yourTurn'));
        let k = -1;
        if (listen) lickCtx.notes.forEach((n, j) => { const s = lickCtx.start + n.t; if (beat >= s && beat < s + n.d) k = j; });
        lickHighlight(k, lickCtx.notes);
      },
      onStop: () => { lickCtx = null; markPlaying(-1); syncPlay(); lickStatus(''); lickHighlight(-1); syncRunButtons(); },
    });
    syncPlay();
    syncRunButtons();
  }
  // Jump between the two tabs, keeping the same scale and the same area of the neck.
  function lickToScales() {
    const l = currentLick(); if (!l) return;
    const { r, base } = lickRealized(l);
    stopScale(); if (lickCtx && A.playing) A.stop();
    state.panelTab = 'scales';
    state.scaleScope = 'key';
    state.extraKeyScale = l.scale;
    state.keyScaleIdx = scaleFor(0).options.findIndex((o) => o.id === l.scale);
    state.posSystem = 'auto';
    state.scaleAnchor = base.positions[r.posIndex] ? base.positions[r.posIndex].center : null;
    persist(); renderScales();
  }
  function scalesToLicks(id) {
    stopScale(); if (A.playing) A.stop();
    state.panelTab = 'licks';
    state.lickScale = id;
    state.lickFilter = 'all';
    state.lickId = null;
    state.lickAnchor = state.scaleAnchor;
    persist(); renderScales();
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
      state.keyScaleIdx = 0;
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
    $('#scale-scope').addEventListener('click', (e) => { const b = e.target.closest('[data-scope]'); if (!b) return; state.scaleScope = b.dataset.scope; renderScales(); persist(); });
    $('#scale-labels').addEventListener('click', (e) => { const b = e.target.closest('[data-lab]'); if (!b) return; state.scaleLabels = b.dataset.lab; renderScales(); persist(); });
    $('#scale-options').addEventListener('click', (e) => {
      const b = e.target.closest('[data-scale]'); if (!b) return;
      if (state.scaleScope === 'key') state.keyScaleIdx = +b.dataset.scale; else chordScalePick[Math.min(selected, prog.chords.length - 1)] = +b.dataset.scale;
      renderScales(); persist();
    });
    $('#pos-row').addEventListener('click', (e) => {
      const p = e.target.closest('[data-pos]');
      if (p) {
        if (p.dataset.pos === 'all') state.scaleAnchor = null;
        else {
          // Remember the area of the neck, not the number: as chords change, the nearest position is shown.
          const i = Math.min(selected, prog.chords.length - 1);
          const sc = scaleFor(i).sc;
          const list = SC.positions(sc, currentTuning().midi, state.posSystem);
          state.scaleAnchor = list[+p.dataset.pos].center;
        }
        renderScales(); persist(); return;
      }
      const s = e.target.closest('[data-sys]');
      if (s) { state.posSystem = s.dataset.sys; renderScales(); persist(); }
    });
    $('#chord-scales').addEventListener('click', onAct);
    $('#play-scale').addEventListener('click', playScale);
    $('.panel-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('[data-tab]'); if (!b || b.dataset.tab === state.panelTab) return;
      stopScale();
      if (lickCtx && A.playing) A.stop();
      state.panelTab = b.dataset.tab; persist(); renderScales();
    });
    $('.panel-tabs').addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      state.panelTab = state.panelTab === 'scales' ? 'licks' : 'scales'; persist(); renderScales();
      $(`.panel-tabs [data-tab="${state.panelTab}"]`).focus();
    });
    $('#lick-filters').addEventListener('click', (e) => {
      if (e.target.closest('[data-lact="clearScale"]')) { state.lickScale = null; persist(); renderLicks(); return; }
      const b = e.target.closest('[data-lfilter]'); if (!b) return; state.lickFilter = b.dataset.lfilter; persist(); renderLicks();
    });
    $('#lick-fit').addEventListener('change', (e) => { state.lickFitOnly = e.target.checked; persist(); renderLicks(); });
    $('#lick-list').addEventListener('click', (e) => {
      const b = e.target.closest('[data-lick]'); if (!b) return;
      stopScale(); if (lickCtx && A.playing) A.stop();
      state.lickId = b.dataset.lick; persist(); renderLicks();
    });
    $('#scale-why').addEventListener('click', (e) => { const b = e.target.closest('[data-to-licks]'); if (b) scalesToLicks(b.dataset.toLicks); });
    $('#lick-detail').addEventListener('click', (e) => {
      const lp = e.target.closest('[data-lpos]');
      if (lp) {
        const l = currentLick(); if (!l) return;
        const wasCtx = lickCtx && A.playing; stopScale(); if (wasCtx) A.stop();
        state.lickAnchor = lickRealized(l).base.positions[+lp.dataset.lpos].center;
        persist(); renderLicks(); if (wasCtx) playLickInContext();
        return;
      }
      const sp = e.target.closest('[data-speed]');
      if (sp) { state.lickSpeed = +sp.dataset.speed; persist(); const wasCtx = lickCtx && A.playing; stopScale(); if (wasCtx) A.stop(); renderLicks(); if (wasCtx) playLickInContext(); return; }
      const b = e.target.closest('[data-lact]'); if (!b) return;
      const act = b.dataset.lact;
      if (act === 'play') playLickAlone();
      else if (act === 'context') playLickInContext();
      else if (act === 'showAll') { state.lickFitOnly = false; state.lickFilter = 'all'; persist(); renderLicks(); }
      else if (act === 'toScales') lickToScales();
      else if (act === 'toGuitar') { state.instrument = 'guitar'; shapePick = {}; refresh(true); }
      else if (act === 'learned') {
        const l = currentLick(); if (!l) return;
        const set = new Set(state.learned);
        if (set.has(l.id)) set.delete(l.id); else set.add(l.id);
        state.learned = [...set]; persist(); renderLicks();
      }
    });
    $('#history').addEventListener('click', (e) => { const b = e.target.closest('[data-hist]'); if (b) restore(history[+b.dataset.hist]); });

    document.addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target.tagName || '').toLowerCase();
      if (['input', 'select', 'textarea'].includes(tag)) return;
      if (e.key === 'Escape') { stopScale(); if (A.playing) A.stop(); return; }
      if (e.code === 'Space' && tag !== 'button') { e.preventDefault(); if (scaleRunning()) stopScale(); else togglePlay(); }
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
