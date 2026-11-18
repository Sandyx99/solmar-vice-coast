// All sound is synthesized with WebAudio: an engine hum that follows the
// car, a two-tone siren when the heat is on, and short blips for shots,
// punches, crashes and mission news. Everything is guarded, so a browser
// with no audio (or a headless one taking screenshots) simply stays silent.

export function createAudio() {
  let context = null;
  let engine = null;
  let engineGain = null;
  let engineFilter = null;
  let siren = null;
  let sirenGain = null;
  let sirenOn = false;
  let sirenPhase = 0;
  let muted = false;

  /** Create (or resume) the context. Call from a user gesture. */
  function ensure() {
    try {
      if (context === null) {
        const Ctor = window.AudioContext ?? window.webkitAudioContext;
        if (!Ctor) return;
        context = new Ctor();
      }
      if (context.state === 'suspended') void context.resume();
    } catch {
      context = null;
    }
  }

  function tone(freq, seconds, type, gain, slideTo) {
    if (context === null || muted) return;
    try {
      const osc = context.createOscillator();
      const amp = context.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, context.currentTime);
      if (slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), context.currentTime + seconds);
      amp.gain.setValueAtTime(gain, context.currentTime);
      amp.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + seconds);
      osc.connect(amp);
      amp.connect(context.destination);
      osc.start();
      osc.stop(context.currentTime + seconds + 0.02);
    } catch {
      // A sound failing must never break the game.
    }
  }

  function noise(seconds, gain, cutoff) {
    if (context === null || muted) return;
    try {
      const length = Math.max(1, Math.floor(context.sampleRate * seconds));
      const buffer = context.createBuffer(1, length, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const source = context.createBufferSource();
      source.buffer = buffer;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = cutoff;
      const amp = context.createGain();
      amp.gain.value = gain;
      source.connect(filter);
      filter.connect(amp);
      amp.connect(context.destination);
      source.start();
    } catch {
      // A sound failing must never break the game.
    }
  }

  function startEngine() {
    if (context === null || engine !== null) return;
    try {
      engine = context.createOscillator();
      engine.type = 'sawtooth';
      engine.frequency.value = 55;
      engineFilter = context.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      engineGain = context.createGain();
      engineGain.gain.value = 0;
      engine.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(context.destination);
      engine.start();
    } catch {
      engine = null;
    }
  }

  function startSiren() {
    if (context === null || siren !== null) return;
    try {
      siren = context.createOscillator();
      siren.type = 'triangle';
      siren.frequency.value = 700;
      sirenGain = context.createGain();
      sirenGain.gain.value = 0;
      siren.connect(sirenGain);
      sirenGain.connect(context.destination);
      siren.start();
    } catch {
      siren = null;
    }
  }

  return {
    ensure,
    /** The engine hum follows the car's speed; silent on foot or parked. */
    update(dt, driving, speed01, wanted) {
      if (context === null) return;
      try {
        if (driving) startEngine();
        if (engine !== null && engineGain !== null) {
          engineGain.gain.value = driving ? 0.045 + speed01 * 0.05 : 0;
          engine.frequency.value = 52 + speed01 * 96;
        }
        if (wanted > 0) {
          startSiren();
          sirenOn = true;
        } else {
          sirenOn = false;
        }
        if (siren !== null && sirenGain !== null) {
          sirenPhase += dt;
          const high = Math.floor(sirenPhase * 1.6) % 2 === 0;
          siren.frequency.value = high ? 720 : 540;
          sirenGain.gain.value = sirenOn && !muted ? 0.02 : 0;
        }
      } catch {
        // The engine and siren are ambience, never a reason to stop.
      }
    },
    shot() {
      noise(0.14, 0.5, 2400);
      tone(190, 0.09, 'square', 0.16, 70);
    },
    punch() {
      tone(120, 0.12, 'sine', 0.4, 55);
    },
    crash() {
      noise(0.3, 0.4, 900);
    },
    blip() {
      tone(880, 0.08, 'square', 0.12);
    },
    steal() {
      tone(520, 0.1, 'square', 0.14);
      setTimeout(() => tone(780, 0.12, 'square', 0.14), 90);
    },
    /** Three rising notes when a job pays out. */
    jingle() {
      tone(523, 0.14, 'triangle', 0.2);
      setTimeout(() => tone(659, 0.14, 'triangle', 0.2), 130);
      setTimeout(() => tone(784, 0.22, 'triangle', 0.22), 260);
    },
    setMuted(value) {
      muted = value;
    },
  };
}
