export type SoundId =
  | "gamma40"
  | "alpha10"
  | "rain"
  | "cafe"
  | "forest"
  | "ocean"
  | "white"
  | "brown";

export interface SoundMeta {
  id: SoundId;
  label: string;
  emoji: string;
  tab: "binaural" | "ambient";
  tooltip?: string;
}

export const SOUND_CATALOG: SoundMeta[] = [
  {
    id: "gamma40",
    label: "40Hz Gamma",
    emoji: "🧠",
    tab: "binaural",
    tooltip: "Linked to focus & working memory",
  },
  { id: "alpha10", label: "10Hz Alpha", emoji: "🌊", tab: "binaural" },
  { id: "rain", label: "Rain", emoji: "🌧️", tab: "ambient" },
  { id: "cafe", label: "Café", emoji: "☕", tab: "ambient" },
  { id: "forest", label: "Forest", emoji: "🌲", tab: "ambient" },
  { id: "ocean", label: "Ocean Waves", emoji: "🌊", tab: "ambient" },
  { id: "white", label: "White Noise", emoji: "⬜", tab: "ambient" },
  { id: "brown", label: "Brown Noise", emoji: "🟫", tab: "ambient" },
];

const RAMP = 0.05;

function now(ctx: AudioContext) {
  return ctx.currentTime;
}

function fadeIn(g: GainNode, ctx: AudioContext) {
  const t = now(ctx);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(1, t + RAMP);
}

function fadeOut(g: GainNode, ctx: AudioContext, cb: () => void) {
  const t = now(ctx);
  g.gain.cancelScheduledValues(t);
  g.gain.setValueAtTime(g.gain.value, t);
  g.gain.linearRampToValueAtTime(0, t + RAMP);
  window.setTimeout(cb, RAMP * 1000 + 20);
}

function makeWhiteNoiseBuffer(ctx: AudioContext, seconds = 2) {
  const frames = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

function makeBrownNoiseBuffer(ctx: AudioContext, seconds = 2) {
  const frames = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < frames; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + white * 0.02) * 0.995;
    data[i] = last * 3.5;
  }
  return buffer;
}

function makePinkishBuffer(ctx: AudioContext, seconds = 2) {
  const frames = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  const b0 = [0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < frames; i++) {
    const white = Math.random() * 2 - 1;
    b0[0] = 0.99886 * b0[0] + white * 0.0555179;
    b0[1] = 0.99332 * b0[1] + white * 0.0750759;
    b0[2] = 0.969 * b0[2] + white * 0.153852;
    b0[3] = 0.8665 * b0[3] + white * 0.3104856;
    b0[4] = 0.55 * b0[4] + white * 0.5329522;
    b0[5] = -0.7616 * b0[5] - white * 0.016898;
    data[i] = b0[0] + b0[1] + b0[2] + b0[3] + b0[4] + b0[5] + b0[6] + white * 0.5362;
    b0[6] = white * 0.115926;
  }
  return buffer;
}

interface ActiveSound {
  master: GainNode;
  dispose: () => void;
}

export class FocalAudioEngine {
  private ctx: AudioContext | null = null;
  private readonly actives = new Map<SoundId, ActiveSound>();
  private readonly volumes = new Map<SoundId, number>();

  constructor() {
    for (const s of SOUND_CATALOG) {
      this.volumes.set(s.id, 0.55);
    }
  }

  private ensure(): AudioContext {
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
    }
    return this.ctx;
  }

  async resume() {
    const ctx = this.ensure();
    if (ctx.state === "suspended") await ctx.resume();
  }

  setVolume(id: SoundId, v: number) {
    const clamped = Math.max(0, Math.min(1, v));
    this.volumes.set(id, clamped);
    const active = this.actives.get(id);
    if (active) {
      const ctx = this.ensure();
      const t = now(ctx);
      active.master.gain.cancelScheduledValues(t);
      active.master.gain.setValueAtTime(active.master.gain.value, t);
      active.master.gain.linearRampToValueAtTime(clamped * 0.6, t + 0.02);
    }
  }

  getVolume(id: SoundId) {
    return this.volumes.get(id) ?? 0.55;
  }

  isPlaying(id: SoundId) {
    return this.actives.has(id);
  }

  stop(id: SoundId) {
    const active = this.actives.get(id);
    if (!active) return;
    const ctx = this.ensure();
    fadeOut(active.master, ctx, () => {
      active.dispose();
      this.actives.delete(id);
    });
  }

  async toggle(id: SoundId) {
    await this.resume();
    if (this.actives.has(id)) {
      this.stop(id);
      return;
    }
    this.start(id);
  }

  private start(id: SoundId) {
    const ctx = this.ensure();
    const master = ctx.createGain();
    master.gain.value = 0;
    const vol = this.getVolume(id);
    master.connect(ctx.destination);

    let dispose = () => {};

    if (id === "gamma40") {
      dispose = this.startBinaural(ctx, master, 200, 240, true);
    } else if (id === "alpha10") {
      dispose = this.startBinaural(ctx, master, 200, 210, false);
    } else if (id === "rain") {
      dispose = this.startRain(ctx, master);
    } else if (id === "cafe") {
      dispose = this.startCafe(ctx, master);
    } else if (id === "forest") {
      dispose = this.startForest(ctx, master);
    } else if (id === "ocean") {
      dispose = this.startOcean(ctx, master);
    } else if (id === "white") {
      dispose = this.startNoiseLoop(ctx, master, "white");
    } else if (id === "brown") {
      dispose = this.startNoiseLoop(ctx, master, "brown");
    }

    fadeIn(master, ctx);
    master.gain.linearRampToValueAtTime(vol * 0.6, now(ctx) + RAMP + 0.05);

    this.actives.set(id, {
      master,
      dispose,
    });
  }

  private startBinaural(ctx: AudioContext, master: GainNode, leftF: number, rightF: number, slowFade: boolean) {
    const merger = ctx.createChannelMerger(2);
    const left = ctx.createOscillator();
    const right = ctx.createOscillator();
    left.type = "sine";
    right.type = "sine";
    left.frequency.value = leftF;
    right.frequency.value = rightF;
    const gl = ctx.createGain();
    const gr = ctx.createGain();
    gl.gain.value = 0.35;
    gr.gain.value = 0.35;
    left.connect(gl);
    right.connect(gr);
    gl.connect(merger, 0, 0);
    gr.connect(merger, 0, 1);
    merger.connect(master);
    if (slowFade) {
      const t = now(ctx);
      gl.gain.setValueAtTime(0, t);
      gr.gain.setValueAtTime(0, t);
      gl.gain.linearRampToValueAtTime(0.35, t + 2.5);
      gr.gain.linearRampToValueAtTime(0.35, t + 2.5);
    }
    left.start();
    right.start();
    return () => {
      left.stop();
      right.stop();
      left.disconnect();
      right.disconnect();
      gl.disconnect();
      gr.disconnect();
      merger.disconnect();
    };
  }

  private startNoiseLoop(ctx: AudioContext, master: GainNode, kind: "white" | "brown") {
    const buf = kind === "white" ? makeWhiteNoiseBuffer(ctx) : makeBrownNoiseBuffer(ctx);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const filt = ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = kind === "white" ? 20000 : 4000;
    filt.Q.value = 0.5;
    src.connect(filt);
    filt.connect(master);
    src.start();
    return () => {
      src.stop();
      src.disconnect();
      filt.disconnect();
    };
  }

  private startRain(ctx: AudioContext, master: GainNode) {
    const buf = makeWhiteNoiseBuffer(ctx);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 800;
    lp.Q.value = 0.5;
    const trem = ctx.createOscillator();
    trem.type = "sine";
    trem.frequency.value = 0.18;
    const depth = ctx.createGain();
    depth.gain.value = 0.12;
    trem.connect(depth);
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    depth.connect(wet.gain);
    src.connect(lp);
    lp.connect(wet);
    wet.connect(master);
    trem.start();
    src.start();
    return () => {
      trem.stop();
      src.stop();
      trem.disconnect();
      depth.disconnect();
      src.disconnect();
      lp.disconnect();
      wet.disconnect();
    };
  }

  private startOcean(ctx: AudioContext, master: GainNode) {
    const buf = makeWhiteNoiseBuffer(ctx);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 600;
    lp.Q.value = 0.7;
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 0.45;
    const depth = ctx.createGain();
    depth.gain.value = 0.22;
    lfo.connect(depth);
    const wet = ctx.createGain();
    wet.gain.value = 0.45;
    depth.connect(wet.gain);
    src.connect(lp);
    lp.connect(wet);
    wet.connect(master);
    lfo.start();
    src.start();
    return () => {
      lfo.stop();
      src.stop();
      lfo.disconnect();
      depth.disconnect();
      src.disconnect();
      lp.disconnect();
      wet.disconnect();
    };
  }

  private startForest(ctx: AudioContext, master: GainNode) {
    const buf = makePinkishBuffer(ctx);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 2200;
    const flutter = ctx.createOscillator();
    flutter.frequency.value = 0.08;
    const d = ctx.createGain();
    d.gain.value = 0.08;
    flutter.connect(d);
    const wet = ctx.createGain();
    wet.gain.value = 0.22;
    d.connect(wet.gain);
    src.connect(lp);
    lp.connect(wet);
    wet.connect(master);
    flutter.start();
    src.start();
    return () => {
      flutter.stop();
      src.stop();
      flutter.disconnect();
      d.disconnect();
      src.disconnect();
      lp.disconnect();
      wet.disconnect();
    };
  }

  private startCafe(ctx: AudioContext, master: GainNode) {
    const brown = makeBrownNoiseBuffer(ctx);
    const src = ctx.createBufferSource();
    src.buffer = brown;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1800;
    const g = ctx.createGain();
    g.gain.value = 0.12;
    src.connect(lp);
    lp.connect(g);
    g.connect(master);
    src.start();

    const tinkle = ctx.createOscillator();
    tinkle.type = "sine";
    tinkle.frequency.value = 4200;
    const tg = ctx.createGain();
    tg.gain.value = 0;
    const bpf = ctx.createBiquadFilter();
    bpf.type = "bandpass";
    bpf.frequency.value = 5200;
    bpf.Q.value = 12;
    tinkle.connect(bpf);
    bpf.connect(tg);
    tg.connect(master);
    tinkle.start();

    let alive = true;
    const scheduleBurst = () => {
      if (!alive) return;
      const t = now(ctx) + 0.05 + Math.random() * 4.5;
      tg.gain.cancelScheduledValues(t);
      tg.gain.setValueAtTime(0, t);
      tg.gain.linearRampToValueAtTime(0.015 + Math.random() * 0.02, t + 0.02);
      tg.gain.linearRampToValueAtTime(0, t + 0.12 + Math.random() * 0.08);
      window.setTimeout(scheduleBurst, 400 + Math.random() * 2200);
    };
    scheduleBurst();

    return () => {
      alive = false;
      src.stop();
      tinkle.stop();
      src.disconnect();
      lp.disconnect();
      g.disconnect();
      tinkle.disconnect();
      bpf.disconnect();
      tg.disconnect();
    };
  }
}
