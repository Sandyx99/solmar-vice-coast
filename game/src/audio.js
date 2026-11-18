// All sound is synthesized with WebAudio — no audio files, no network. An
// engine hum follows the car's speed, a two-tone siren follows the nearest
// police car, gunshots and crashes are filtered noise bursts, and a small
// bass-and-hat loop keeps the Neon Mile feeling like a night out. Everything
// is created lazily on the first user gesture.

const MUSIC_BASS = [55, 0, 65.41, 0, 49, 0, 58.27, 0, 55, 0, 65.41, 0, 73.42, 65.41, 58.27, 49];

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenLfo = null;
  let musicTimer = null;
  let musicStep = 0;
  let muted = false;
  let noiseBuf = null;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 60;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 720;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenLfo = ctx.createOscillator();
      sirenLfo.type = 'square';
      sirenLfo.frequency.value = 0.9;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 260;
      sirenLfo.connect(lfoGain);
      lfoGain.connect(sirenOsc.frequency);
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      sirenLfo.start();
      return true;
    } catch {
      ctx = null;
      return false;
    }
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur, vol, freq) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  return {
    /** Call from any user gesture so the context is allowed to start. */
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume();
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    get muted() {
      return muted;
    },
    /** Engine pitch follows speed; siren gain follows the nearest police car. */
    update(speed, topSpeed, policeNear) {
      if (!ctx || muted) return;
      if (engineOsc) engineOsc.frequency.value = 55 + (Math.abs(speed) / Math.max(1, topSpeed)) * 165;
      if (engineGain) engineGain.gain.value = Math.abs(speed) > 12 ? 0.05 : 0;
      if (sirenGain) sirenGain.gain.value = policeNear ? 0.045 : 0;
    },
    shoot() {
      noise(0.12, 0.5, 2600);
    },
    enemyShoot() {
      noise(0.1, 0.22, 1800);
    },
    crash(strength) {
      noise(0.25, Math.min(0.7, 0.25 + strength / 500), 700);
    },
    punch() {
      noise(0.08, 0.3, 900);
    },
    pickup() {
      blip(660, 0.09, 'sine', 0.3);
      setTimeout(() => blip(990, 0.14, 'sine', 0.3), 70);
    },
    cash() {
      blip(880, 0.1, 'triangle', 0.35, 1320);
    },
    mission() {
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip(f, 0.22, 'triangle', 0.32), i * 90));
    },
    fail() {
      [392, 330, 262].forEach((f, i) => setTimeout(() => blip(f, 0.3, 'sawtooth', 0.22), i * 140));
    },
    wasted() {
      [330, 262, 196, 131].forEach((f, i) => setTimeout(() => blip(f, 0.4, 'sawtooth', 0.25), i * 180));
    },
    startMusic() {
      if (!ensure() || musicTimer) return;
      musicTimer = setInterval(() => {
        if (!ctx || muted) return;
        const step = musicStep % 16;
        musicStep += 1;
        const bass = MUSIC_BASS[step];
        if (bass) blip(bass, 0.22, 'triangle', 0.16);
        if (step % 4 === 2) noise(0.03, 0.05, 6000);
        if (step % 8 === 4) blip(220, 0.1, 'sine', 0.05, 330);
      }, 155);
    },
    stopMusic() {
      if (musicTimer) {
        clearInterval(musicTimer);
        musicTimer = null;
      }
    },
  };
}
