/* Cadence — sound.
 * Web Audio only, no samples: an electric-piano-ish tone, a pad, and a
 * Karplus–Strong plucked string for guitar strums. A look-ahead scheduler keeps
 * timing tight; MIDI export writes a standard .mid file.
 */
(function (C) {
  'use strict';
  let ctx = null, master = null, wet = null;
  const ksCache = new Map();
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

  let irBuffer = null;
  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return ctx; }
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    // small generated room for the reverb
    const len = Math.floor(ctx.sampleRate * 1.8);
    irBuffer = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = irBuffer.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    buildGraph();
    return ctx;
  }
  // master → (dry + reverb) → compressor → speakers
  function buildGraph() {
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 3;
    const conv = ctx.createConvolver(); conv.buffer = irBuffer;
    master = ctx.createGain(); master.gain.value = 0.7;
    wet = ctx.createGain(); wet.gain.value = 0.22;
    master.connect(comp); master.connect(conv); conv.connect(wet); wet.connect(comp);
    comp.connect(ctx.destination);
  }

  function envGain(t, a, peak, d, sustain, end, rel) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setTargetAtTime(peak * sustain, t + a, d);
    g.gain.setTargetAtTime(0.0001, end, rel);
    return g;
  }

  function piano(m, t, dur, vel) {
    const end = t + dur;
    const g = envGain(t, 0.006, 0.16 * vel, 0.9, 0.25, end, 0.18);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(Math.min(9000, hz(m) * 9), t);
    lp.frequency.setTargetAtTime(Math.min(3000, hz(m) * 3), t, 0.4);
    const o1 = ctx.createOscillator(); o1.type = 'triangle'; o1.frequency.value = hz(m);
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = hz(m) * 2.001;
    const g2 = ctx.createGain(); g2.gain.value = 0.35;
    o1.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g); g.connect(master);
    [o1, o2].forEach((o) => { o.start(t); o.stop(end + 1.2); });
  }

  function pad(m, t, dur, vel) {
    const end = t + dur;
    const g = envGain(t, 0.35, 0.06 * vel, 1, 0.8, end - 0.05, 0.45);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400; lp.Q.value = 0.6;
    lp.connect(g); g.connect(master);
    for (const det of [-7, 7]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz(m); o.detune.value = det;
      o.connect(lp); o.start(t); o.stop(end + 2);
    }
  }

  // Karplus–Strong: a noise burst circulating in a short, damped delay line.
  function ksBuffer(m) {
    if (ksCache.has(m)) return ksCache.get(m);
    const sr = ctx.sampleRate, f = hz(m);
    const N = Math.max(2, Math.floor(sr / f - 0.5));
    const len = Math.floor(sr * 2.6);
    const buf = ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    const decay = 0.996 - Math.max(0, m - 60) * 0.0002;
    let prev = 0;
    for (let i = 0; i < N; i++) { const x = Math.random() * 2 - 1; d[i] = (x + prev) * 0.5; prev = x; } // softened pick
    for (let i = N; i < len; i++) d[i] = decay * 0.5 * (d[i - N] + d[i - N - 1 >= 0 ? i - N - 1 : 0]);
    const out = { buf, rate: f / (sr / (N + 0.5)) };
    ksCache.set(m, out);
    return out;
  }
  function pluck(m, t, dur, vel) {
    const { buf, rate } = ksBuffer(m);
    const src = ctx.createBufferSource(); src.buffer = buf; src.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.32 * vel, t);
    g.gain.setTargetAtTime(0.0001, t + dur, 0.08);
    const body = ctx.createBiquadFilter(); body.type = 'peaking'; body.frequency.value = 180; body.gain.value = 4;
    src.connect(body); body.connect(g); g.connect(master);
    src.start(t); src.stop(t + dur + 0.6);
  }

  const VOICES = { piano, pad, guitar: pluck };

  /* Play a chord (array of MIDI notes) with a pattern. */
  function hit(notes, t, dur, instrument, pattern, beat) {
    const voice = VOICES[instrument] || piano;
    const sorted = notes.slice().sort((a, b) => a - b);
    if (pattern === 'arp') {
      const step = beat / 2;
      const seq = sorted.concat(sorted.slice(1, -1).reverse());
      for (let k = 0, tt = t; tt < t + dur - 0.01; k++, tt += step) {
        const n = seq[k % seq.length];
        voice(n, tt, Math.min(step * 2.2, t + dur - tt), k === 0 ? 1 : 0.8);
      }
      return;
    }
    if (pattern === 'pulse') {
      for (let b = 0, tt = t; tt < t + dur - 0.01; b++, tt += beat) {
        const down = b % 2 === 0 || instrument !== 'guitar';
        const order = down ? sorted : sorted.slice().reverse();
        order.forEach((n, i) => voice(n, tt + (instrument === 'guitar' ? i * 0.009 : 0), beat * 0.9, (b === 0 ? 1 : 0.75) * (down ? 1 : 0.7)));
      }
      return;
    }
    sorted.forEach((n, i) => voice(n, t + (instrument === 'guitar' ? i * 0.014 : 0), dur, 1));
  }

  /* ---------- transport ---------- */
  const player = { playing: false, timer: null, raf: null, start: 0, onStep: null, onStop: null };

  function play(events, opts) {
    stop();
    ensure();
    const spb = 60 / opts.tempo;
    const total = events.reduce((s, e) => s + e.beats, 0);
    let t0 = ctx.currentTime + 0.08;
    let pass = 0, idx = 0;
    const starts = [];
    events.reduce((s, e) => { starts.push(s); return s + e.beats; }, 0);
    player.playing = true;
    player.start = t0;
    player.onStep = opts.onStep;
    player.onStop = opts.onStop;
    const schedule = () => {
      const horizon = ctx.currentTime + 0.25;
      while (true) {
        const t = t0 + (pass * total + starts[idx]) * spb;
        if (t > horizon) break;
        const e = events[idx];
        hit(e.notes, t, e.beats * spb, opts.instrument, opts.pattern, spb);
        idx++;
        if (idx >= events.length) {
          idx = 0; pass++;
          if (!opts.loop) { player.lastEnd = t0 + pass * total * spb; break; }
        }
      }
      if (!opts.loop && pass >= 1) {
        player.timer = null;
        return;
      }
      player.timer = setTimeout(schedule, 60);
    };
    schedule();
    const tick = () => {
      if (!player.playing) return;
      const now = ctx.currentTime - t0;
      if (!opts.loop && now >= total * spb) { stop(); return; }
      const beat = ((now / spb) % total + total) % total;
      let cur = 0;
      for (let i = 0; i < starts.length; i++) if (beat >= starts[i]) cur = i;
      if (now >= 0 && player.onStep) player.onStep(cur, beat);
      player.raf = requestAnimationFrame(tick);
    };
    player.raf = requestAnimationFrame(tick);
  }
  function stop() {
    const was = player.playing;
    player.playing = false;
    clearTimeout(player.timer);
    cancelAnimationFrame(player.raf);
    if (master && ctx) {
      // Fade the old graph out and drop it, so notes already scheduled are silenced.
      const old = master;
      old.gain.cancelScheduledValues(ctx.currentTime);
      old.gain.setValueAtTime(old.gain.value, ctx.currentTime);
      old.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.06);
      setTimeout(() => { try { old.disconnect(); } catch (e) { /* already gone */ } }, 120);
      buildGraph();
    }
    if (was && player.onStop) player.onStop();
  }
  function audition(notes, instrument) {
    if (player.playing) return;
    ensure();
    hit(notes, ctx.currentTime + 0.02, 1.6, instrument, 'block', 0.5);
  }

  /* ---------- MIDI file ---------- */
  function vlq(n) {
    const bytes = [n & 0x7f];
    while ((n >>= 7)) bytes.unshift((n & 0x7f) | 0x80);
    return bytes;
  }
  function midiFile(events, tempo, name) {
    const PPQ = 480;
    const track = [];
    const push = (delta, bytes) => track.push(...vlq(delta), ...bytes);
    const usPerBeat = Math.round(60000000 / tempo);
    push(0, [0xff, 0x51, 0x03, (usPerBeat >> 16) & 255, (usPerBeat >> 8) & 255, usPerBeat & 255]);
    push(0, [0xff, 0x58, 0x04, 4, 2, 24, 8]);
    const title = Array.from(new TextEncoder().encode(name || 'Cadence'));
    push(0, [0xff, 0x03, title.length, ...title]);
    let pending = 0;
    for (const e of events) {
      const lyric = Array.from(new TextEncoder().encode(e.label || ''));
      if (lyric.length) { push(pending, [0xff, 0x01, lyric.length, ...lyric]); pending = 0; }
      e.notes.forEach((n, i) => { push(i === 0 ? pending : 0, [0x90, n, n < 52 ? 84 : 72]); });
      pending = 0;
      const ticks = Math.round(e.beats * PPQ);
      e.notes.forEach((n, i) => push(i === 0 ? ticks - 10 : 0, [0x80, n, 0]));
      pending = 10;
    }
    push(pending, [0xff, 0x2f, 0x00]);
    const header = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, (PPQ >> 8) & 255, PPQ & 255];
    const len = track.length;
    const trk = [0x4d, 0x54, 0x72, 0x6b, (len >>> 24) & 255, (len >>> 16) & 255, (len >>> 8) & 255, len & 255];
    return new Uint8Array(header.concat(trk, track));
  }

  C.audio = { play, stop, audition, midiFile, get playing() { return player.playing; } };
})(typeof window !== 'undefined' ? (window.Cadence = window.Cadence || {}) : (globalThis.Cadence = globalThis.Cadence || {}));
