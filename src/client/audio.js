// Procedural audio. Every sound is synthesised with WebAudio, so the game
// ships with no audio files. Starts muted until the first user gesture,
// which is what browsers require.

export class Audio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.master = null;
    this.budget = 0;
    const unlock = () => {
      this.init();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.enabled = false; return; }
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.22;
      this.master.connect(this.ctx.destination);
    } catch (err) {
      this.enabled = false;
    }
  }

  setVolume(v) {
    if (this.master) this.master.gain.value = v;
  }

  toggleMute() {
    this.enabled = !this.enabled;
    if (this.master) this.master.gain.value = this.enabled ? 0.22 : 0;
    return this.enabled;
  }

  _tone({ type = 'sine', freq = 440, endFreq = null, duration = 0.15, gain = 0.3, delay = 0 }) {
    if (!this.ctx || !this.enabled) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t0 + duration);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  _noise({ duration = 0.3, gain = 0.4, filterFreq = 900, sweepTo = 120 }) {
    if (!this.ctx || !this.enabled) return;
    const t0 = this.ctx.currentTime;
    const length = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFreq, t0);
    filter.frequency.exponentialRampToValueAtTime(sweepTo, t0 + duration);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t0);
  }

  play(name, intensity = 1) {
    if (!this.ctx || !this.enabled) return;
    switch (name) {
      case 'click':
        this._tone({ type: 'square', freq: 620, endFreq: 880, duration: 0.05, gain: 0.10 });
        break;
      case 'command':
        this._tone({ type: 'triangle', freq: 440, endFreq: 660, duration: 0.08, gain: 0.10 });
        break;
      case 'build':
        this._tone({ type: 'sawtooth', freq: 180, endFreq: 320, duration: 0.16, gain: 0.09 });
        break;
      case 'laser':
        this._tone({ type: 'sawtooth', freq: 1200, endFreq: 300, duration: 0.07, gain: 0.045 * intensity });
        break;
      case 'cannon':
        this._tone({ type: 'square', freq: 260, endFreq: 70, duration: 0.13, gain: 0.07 * intensity });
        break;
      case 'explosion':
        this._noise({ duration: 0.34 + 0.3 * intensity, gain: 0.24 * intensity, filterFreq: 1100, sweepTo: 90 });
        this._tone({ type: 'sine', freq: 110, endFreq: 40, duration: 0.3, gain: 0.16 * intensity });
        break;
      case 'unitDone':
        this._tone({ type: 'triangle', freq: 520, endFreq: 780, duration: 0.12, gain: 0.08 });
        break;
      case 'alert':
        this._tone({ type: 'square', freq: 330, duration: 0.1, gain: 0.09 });
        this._tone({ type: 'square', freq: 330, duration: 0.1, gain: 0.09, delay: 0.14 });
        break;
    }
  }

  /** Turn this frame's simulation effects into sound, near the camera only. */
  update(world, camera, dt) {
    if (!this.ctx || !this.enabled) return;
    this.budget = 6;
    const b = camera.viewBounds(200);
    for (const fx of world.effects) {
      if (this.budget <= 0) break;
      if (fx.x < b.left || fx.x > b.right || fx.y < b.top || fx.y > b.bottom) continue;
      if (fx.type === 'explosion') {
        this.play('explosion', fx.big ? 1.5 : 0.7);
        this.budget -= 2;
      } else if (fx.type === 'muzzle' && Math.random() < 0.25) {
        this.play(fx.size > 14 ? 'cannon' : 'laser', 0.8);
        this.budget--;
      } else if (fx.type === 'unitDone') {
        this.play('unitDone');
        this.budget--;
      }
    }
  }
}
