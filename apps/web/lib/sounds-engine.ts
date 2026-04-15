/** Longer noise loops reduce audible seam when looping (native device sample rate). */
const NOISE_SECONDS = 6;
const RAMP = 0.05;

export type SoundId =
  | "gamma40"
  | "alpha10"
  | "rain"
  | "cafe"
  | "forest"
  | "ocean"
  | "beach"
  | "thunder"
  | "wind"
  | "creek"
  | "campfire"
  | "garden"
  | "train"
  | "office"
  | "night"
  | "white"
  | "brown"
  | "pink"
  | "static"
  | "fan";

export type SoundFamily = "binaural" | "soundscape";

export interface SoundMeta {
  id: SoundId;
  label: string;
  family: SoundFamily;
  tooltip?: string;
  /** CSS background for card art (no external assets). */
  gradient: string;
}

export const SOUND_CATALOG: SoundMeta[] = [
  {
    id: "gamma40",
    label: "Binaural · 40 Hz",
    family: "binaural",
    tooltip: "Gamma-range beat — use stereo headphones",
    gradient: "linear-gradient(145deg, #2d1f4a 0%, #151028 55%, #0c0a12 100%)",
  },
  {
    id: "alpha10",
    label: "Binaural · 10 Hz",
    family: "binaural",
    tooltip: "Alpha-range beat — relaxed alertness",
    gradient: "linear-gradient(145deg, #1f3550 0%, #101c2e 50%, #0a0e16 100%)",
  },
  {
    id: "rain",
    label: "Rainfall",
    family: "soundscape",
    gradient: "linear-gradient(160deg, #3a4a5c 0%, #1e2832 45%, #0f1419 100%)",
  },
  {
    id: "ocean",
    label: "Ocean",
    family: "soundscape",
    gradient: "linear-gradient(160deg, #1a3048 0%, #0f1f2e 50%, #081018 100%)",
  },
  {
    id: "beach",
    label: "Beach",
    family: "soundscape",
    gradient: "linear-gradient(155deg, #4a5c6e 0%, #2a3844 45%, #121a22 100%)",
  },
  {
    id: "thunder",
    label: "Thunderstorm",
    family: "soundscape",
    gradient: "linear-gradient(150deg, #2a2238 0%, #18121f 50%, #0c0a10 100%)",
  },
  {
    id: "wind",
    label: "Wind",
    family: "soundscape",
    gradient: "linear-gradient(165deg, #3d454e 0%, #23292f 50%, #12161a 100%)",
  },
  {
    id: "forest",
    label: "Forest",
    family: "soundscape",
    gradient: "linear-gradient(145deg, #1f3d28 0%, #142218 50%, #0a120d 100%)",
  },
  {
    id: "garden",
    label: "Garden",
    family: "soundscape",
    gradient: "linear-gradient(150deg, #2a4a32 0%, #1a2e1f 50%, #0e1812 100%)",
  },
  {
    id: "creek",
    label: "Creek",
    family: "soundscape",
    gradient: "linear-gradient(155deg, #2a4a48 0%, #162a28 50%, #0a1414 100%)",
  },
  {
    id: "campfire",
    label: "Campfire",
    family: "soundscape",
    gradient: "linear-gradient(145deg, #4a3020 0%, #2a1810 50%, #140c08 100%)",
  },
  {
    id: "cafe",
    label: "Café",
    family: "soundscape",
    gradient: "linear-gradient(150deg, #3a3028 0%, #221c18 50%, #120f0c 100%)",
  },
  {
    id: "office",
    label: "Office",
    family: "soundscape",
    gradient: "linear-gradient(160deg, #383838 0%, #222222 50%, #121212 100%)",
  },
  {
    id: "train",
    label: "Train",
    family: "soundscape",
    gradient: "linear-gradient(155deg, #353038 0%, #1c1820 50%, #0e0c10 100%)",
  },
  {
    id: "night",
    label: "Night",
    family: "soundscape",
    gradient: "linear-gradient(160deg, #1a2240 0%, #0f1428 50%, #080c18 100%)",
  },
  {
    id: "white",
    label: "White noise",
    family: "soundscape",
    gradient: "linear-gradient(145deg, #4a4a52 0%, #2a2a30 50%, #141418 100%)",
  },
  {
    id: "brown",
    label: "Brown noise",
    family: "soundscape",
    gradient: "linear-gradient(150deg, #4a3828 0%, #2a2018 50%, #14100c 100%)",
  },
  {
    id: "pink",
    label: "Pink noise",
    family: "soundscape",
    tooltip: "Equal energy per octave — gentle masking",
    gradient: "linear-gradient(150deg, #4a3a48 0%, #2a2230 50%, #16101a 100%)",
  },
  {
    id: "static",
    label: "TV static",
    family: "soundscape",
    gradient: "linear-gradient(145deg, #3a3a42 0%, #222228 50%, #101014 100%)",
  },
  {
    id: "fan",
    label: "Fan / AC",
    family: "soundscape",
    gradient: "linear-gradient(155deg, #3a4550 0%, #222a32 50%, #101418 100%)",
  },
];

const VALID_IDS = new Set(SOUND_CATALOG.map((s) => s.id));

export function isValidSoundId(id: string): id is SoundId {
  return VALID_IDS.has(id as SoundId);
}

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

function makeWhiteNoiseBuffer(ctx: AudioContext, seconds = NOISE_SECONDS) {
  const frames = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

function makeBrownNoiseBuffer(ctx: AudioContext, seconds = NOISE_SECONDS) {
  const frames = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < frames; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + white * 0.02) * 0.995;
    data[i] = last * 3.2;
  }
  return buffer;
}

/** Paul Kellet’s economical “pink” approximation, normalized for headroom. */
function makePinkNoiseBuffer(ctx: AudioContext, seconds = NOISE_SECONDS) {
  const frames = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  const b = [0, 0, 0, 0, 0, 0, 0];
  let peak = 0.0001;
  for (let i = 0; i < frames; i++) {
    const white = Math.random() * 2 - 1;
    b[0] = 0.99886 * b[0] + white * 0.0555179;
    b[1] = 0.99332 * b[1] + white * 0.0750759;
    b[2] = 0.969 * b[2] + white * 0.153852;
    b[3] = 0.8665 * b[3] + white * 0.3104856;
    b[4] = 0.55 * b[4] + white * 0.5329522;
    b[5] = -0.7616 * b[5] - white * 0.016898;
    const p = b[0] + b[1] + b[2] + b[3] + b[4] + b[5] + b[6] + white * 0.5362;
    b[6] = white * 0.115926;
    data[i] = p;
    peak = Math.max(peak, Math.abs(p));
  }
  const scale = 0.45 / peak;
  for (let i = 0; i < frames; i++) data[i] *= scale;
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
      this.volumes.set(s.id, 0.52);
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

  /** Currently playing sound ids (order not guaranteed). */
  getActiveSoundIds(): SoundId[] {
    return [...this.actives.keys()];
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
      active.master.gain.linearRampToValueAtTime(clamped * 0.58, t + 0.02);
    }
  }

  getVolume(id: SoundId) {
    return this.volumes.get(id) ?? 0.52;
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

    let dispose: () => void = () => {};

    switch (id) {
      case "gamma40":
        dispose = this.startBinaural(ctx, master, 200, 240, true);
        break;
      case "alpha10":
        dispose = this.startBinaural(ctx, master, 200, 210, false);
        break;
      case "rain":
        dispose = this.startRain(ctx, master);
        break;
      case "cafe":
        dispose = this.startCafe(ctx, master);
        break;
      case "forest":
        dispose = this.startForest(ctx, master, 2200, 0.08);
        break;
      case "garden":
        dispose = this.startGarden(ctx, master);
        break;
      case "ocean":
        dispose = this.startOcean(ctx, master, 600, 0.45);
        break;
      case "beach":
        dispose = this.startOcean(ctx, master, 950, 0.32, 0.12);
        break;
      case "thunder":
        dispose = this.startThunder(ctx, master);
        break;
      case "wind":
        dispose = this.startWind(ctx, master);
        break;
      case "creek":
        dispose = this.startCreek(ctx, master);
        break;
      case "campfire":
        dispose = this.startCampfire(ctx, master);
        break;
      case "train":
        dispose = this.startTrain(ctx, master);
        break;
      case "office":
        dispose = this.startOffice(ctx, master);
        break;
      case "night":
        dispose = this.startNight(ctx, master);
        break;
      case "white":
        dispose = this.startNoiseLoop(ctx, master, "white");
        break;
      case "brown":
        dispose = this.startNoiseLoop(ctx, master, "brown");
        break;
      case "pink":
        dispose = this.startPink(ctx, master);
        break;
      case "static":
        dispose = this.startStatic(ctx, master);
        break;
      case "fan":
        dispose = this.startFan(ctx, master);
        break;
      default:
        dispose = () => {};
    }

    fadeIn(master, ctx);
    master.gain.linearRampToValueAtTime(vol * 0.58, now(ctx) + RAMP + 0.05);

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
    gl.gain.value = 0.32;
    gr.gain.value = 0.32;
    left.connect(gl);
    right.connect(gr);
    gl.connect(merger, 0, 0);
    gr.connect(merger, 0, 1);
    merger.connect(master);
    if (slowFade) {
      const t = now(ctx);
      gl.gain.setValueAtTime(0, t);
      gr.gain.setValueAtTime(0, t);
      gl.gain.linearRampToValueAtTime(0.32, t + 2.5);
      gr.gain.linearRampToValueAtTime(0.32, t + 2.5);
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
    filt.frequency.value = kind === "white" ? 20000 : 4200;
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

  private startPink(ctx: AudioContext, master: GainNode) {
    const buf = makePinkNoiseBuffer(ctx);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 9000;
    lp.Q.value = 0.5;
    const g = ctx.createGain();
    g.gain.value = 0.85;
    src.connect(lp);
    lp.connect(g);
    g.connect(master);
    src.start();
    return () => {
      src.stop();
      src.disconnect();
      lp.disconnect();
      g.disconnect();
    };
  }

  private startRain(ctx: AudioContext, master: GainNode) {
    const buf = makeWhiteNoiseBuffer(ctx);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 820;
    lp.Q.value = 0.55;
    const trem = ctx.createOscillator();
    trem.type = "sine";
    trem.frequency.value = 0.16;
    const depth = ctx.createGain();
    depth.gain.value = 0.11;
    trem.connect(depth);
    const wet = ctx.createGain();
    wet.gain.value = 0.38;
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

  private startOcean(ctx: AudioContext, master: GainNode, lpHz: number, wetAmt: number, lfoHz = 0.42) {
    const buf = makeWhiteNoiseBuffer(ctx);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = lpHz;
    lp.Q.value = 0.72;
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = lfoHz;
    const depth = ctx.createGain();
    depth.gain.value = 0.2;
    lfo.connect(depth);
    const wet = ctx.createGain();
    wet.gain.value = wetAmt;
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

  private startForest(ctx: AudioContext, master: GainNode, lpHz: number, flutterDepth: number) {
    const buf = makePinkNoiseBuffer(ctx);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = lpHz;
    const flutter = ctx.createOscillator();
    flutter.frequency.value = 0.09;
    const d = ctx.createGain();
    d.gain.value = flutterDepth;
    flutter.connect(d);
    const wet = ctx.createGain();
    wet.gain.value = 0.24;
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

  private startGarden(ctx: AudioContext, master: GainNode) {
    const base = this.startForest(ctx, master, 3200, 0.06);
    let alive = true;
    let chirpTimer: number | undefined;
    const chirp = () => {
      if (!alive) return;
      const t = now(ctx) + 0.02;
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(5200 + Math.random() * 900, t);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.035, t + 0.025);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
      osc.connect(g);
      g.connect(master);
      osc.start(t);
      osc.stop(t + 0.12);
      chirpTimer = window.setTimeout(chirp, 1800 + Math.random() * 4200);
    };
    chirp();
    return () => {
      alive = false;
      if (chirpTimer !== undefined) window.clearTimeout(chirpTimer);
      base();
    };
  }

  private startWind(ctx: AudioContext, master: GainNode) {
    const buf = makeWhiteNoiseBuffer(ctx);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 420;
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 0.11;
    const d = ctx.createGain();
    d.gain.value = 380;
    lfo.connect(d);
    d.connect(hp.frequency);
    const wet = ctx.createGain();
    wet.gain.value = 0.28;
    src.connect(hp);
    hp.connect(wet);
    wet.connect(master);
    lfo.start();
    src.start();
    return () => {
      lfo.stop();
      src.stop();
      lfo.disconnect();
      d.disconnect();
      src.disconnect();
      hp.disconnect();
      wet.disconnect();
    };
  }

  private startCreek(ctx: AudioContext, master: GainNode) {
    const buf = makePinkNoiseBuffer(ctx);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 2600;
    const ripple = ctx.createOscillator();
    ripple.type = "sine";
    ripple.frequency.value = 3.2;
    const d = ctx.createGain();
    d.gain.value = 0.06;
    ripple.connect(d);
    const wet = ctx.createGain();
    wet.gain.value = 0.26;
    d.connect(wet.gain);
    src.connect(lp);
    lp.connect(wet);
    wet.connect(master);
    ripple.start();
    src.start();
    return () => {
      ripple.stop();
      src.stop();
      ripple.disconnect();
      d.disconnect();
      src.disconnect();
      lp.disconnect();
      wet.disconnect();
    };
  }

  private startThunder(ctx: AudioContext, master: GainNode) {
    const brown = makeBrownNoiseBuffer(ctx);
    const src = ctx.createBufferSource();
    src.buffer = brown;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 480;
    const g = ctx.createGain();
    g.gain.value = 0.22;
    src.connect(lp);
    lp.connect(g);
    g.connect(master);
    src.start();

    const rumbleGain = ctx.createGain();
    rumbleGain.gain.value = 0;
    const rumbleSrc = ctx.createBufferSource();
    rumbleSrc.buffer = makeBrownNoiseBuffer(ctx);
    rumbleSrc.loop = true;
    const rlp = ctx.createBiquadFilter();
    rlp.type = "lowpass";
    rlp.frequency.value = 120;
    rumbleSrc.connect(rlp);
    rlp.connect(rumbleGain);
    rumbleGain.connect(master);
    rumbleSrc.start();

    let alive = true;
    let boomTimer: number | undefined;
    const boom = () => {
      if (!alive) return;
      const t = now(ctx) + 0.05;
      rumbleGain.gain.cancelScheduledValues(t);
      rumbleGain.gain.setValueAtTime(0, t);
      rumbleGain.gain.linearRampToValueAtTime(0.55, t + 0.4);
      rumbleGain.gain.exponentialRampToValueAtTime(0.0008, t + 6 + Math.random() * 4);
      boomTimer = window.setTimeout(boom, 8000 + Math.random() * 14000);
    };
    boom();

    return () => {
      alive = false;
      if (boomTimer !== undefined) window.clearTimeout(boomTimer);
      src.stop();
      rumbleSrc.stop();
      src.disconnect();
      lp.disconnect();
      g.disconnect();
      rumbleSrc.disconnect();
      rlp.disconnect();
      rumbleGain.disconnect();
    };
  }

  private startCampfire(ctx: AudioContext, master: GainNode) {
    const brown = makeBrownNoiseBuffer(ctx);
    const src = ctx.createBufferSource();
    src.buffer = brown;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1400;
    const g = ctx.createGain();
    g.gain.value = 0.14;
    src.connect(lp);
    lp.connect(g);
    g.connect(master);
    src.start();

    let alive = true;
    const crackleIv = window.setInterval(() => {
      if (!alive) return;
      if (Math.random() > 0.22) return;
      const t = now(ctx) + 0.01;
      const n = ctx.createBufferSource();
      n.buffer = makeWhiteNoiseBuffer(ctx, 0.08);
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 1800 + Math.random() * 4000;
      bp.Q.value = 1.2;
      const cg = ctx.createGain();
      cg.gain.setValueAtTime(0, t);
      cg.gain.linearRampToValueAtTime(0.12 + Math.random() * 0.1, t + 0.004);
      cg.gain.exponentialRampToValueAtTime(0.0008, t + 0.05 + Math.random() * 0.06);
      n.connect(bp);
      bp.connect(cg);
      cg.connect(master);
      n.start(t);
      n.stop(t + 0.12);
    }, 110);

    return () => {
      alive = false;
      window.clearInterval(crackleIv);
      src.stop();
      src.disconnect();
      lp.disconnect();
      g.disconnect();
    };
  }

  private startTrain(ctx: AudioContext, master: GainNode) {
    const brown = makeBrownNoiseBuffer(ctx);
    const src = ctx.createBufferSource();
    src.buffer = brown;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 380;
    const g = ctx.createGain();
    g.gain.value = 0.18;
    src.connect(lp);
    lp.connect(g);
    g.connect(master);
    src.start();

    let n = 0;
    const id = window.setInterval(() => {
      const t = now(ctx);
      const burst = ctx.createBufferSource();
      burst.buffer = makeWhiteNoiseBuffer(ctx, 0.04);
      const bpf = ctx.createBiquadFilter();
      bpf.type = "bandpass";
      bpf.frequency.value = 2200 + (n % 5) * 400;
      bpf.Q.value = 6;
      const cg = ctx.createGain();
      cg.gain.setValueAtTime(0, t);
      cg.gain.linearRampToValueAtTime(0.09, t + 0.003);
      cg.gain.exponentialRampToValueAtTime(0.0008, t + 0.05);
      burst.connect(bpf);
      bpf.connect(cg);
      cg.connect(master);
      burst.start(t);
      burst.stop(t + 0.06);
      n += 1;
    }, 320);

    return () => {
      window.clearInterval(id);
      src.stop();
      src.disconnect();
      lp.disconnect();
      g.disconnect();
    };
  }

  private startOffice(ctx: AudioContext, master: GainNode) {
    const hum = ctx.createOscillator();
    hum.type = "sine";
    hum.frequency.value = 60;
    const hg = ctx.createGain();
    hg.gain.value = 0.06;
    hum.connect(hg);
    hg.connect(master);
    hum.start();

    const pink = makePinkNoiseBuffer(ctx);
    const src = ctx.createBufferSource();
    src.buffer = pink;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 2800;
    const pg = ctx.createGain();
    pg.gain.value = 0.08;
    src.connect(lp);
    lp.connect(pg);
    pg.connect(master);
    src.start();

    let alive = true;
    let keyTimer: number | undefined;
    const key = () => {
      if (!alive) return;
      const t = now(ctx);
      const burst = ctx.createBufferSource();
      burst.buffer = makeWhiteNoiseBuffer(ctx, 0.03);
      const bpf = ctx.createBiquadFilter();
      bpf.type = "bandpass";
      bpf.frequency.value = 2800 + Math.random() * 2400;
      bpf.Q.value = 8;
      const cg = ctx.createGain();
      cg.gain.setValueAtTime(0, t);
      cg.gain.linearRampToValueAtTime(0.05, t + 0.002);
      cg.gain.exponentialRampToValueAtTime(0.0008, t + 0.04);
      burst.connect(bpf);
      bpf.connect(cg);
      cg.connect(master);
      burst.start(t);
      burst.stop(t + 0.05);
      keyTimer = window.setTimeout(key, 400 + Math.random() * 2800);
    };
    key();

    return () => {
      alive = false;
      if (keyTimer !== undefined) window.clearTimeout(keyTimer);
      hum.stop();
      src.stop();
      hum.disconnect();
      hg.disconnect();
      src.disconnect();
      lp.disconnect();
      pg.disconnect();
    };
  }

  private startNight(ctx: AudioContext, master: GainNode) {
    const buf = makePinkNoiseBuffer(ctx);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 4000;
    const g = ctx.createGain();
    g.gain.value = 0.06;
    src.connect(lp);
    lp.connect(g);
    g.connect(master);
    src.start();

    let alive = true;
    let cricketTimer: number | undefined;
    const cricket = () => {
      if (!alive) return;
      const t = now(ctx) + 0.02;
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(4800 + Math.random() * 700, t);
      const cg = ctx.createGain();
      cg.gain.setValueAtTime(0.0001, t);
      cg.gain.exponentialRampToValueAtTime(0.028, t + 0.015);
      cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      osc.connect(cg);
      cg.connect(master);
      osc.start(t);
      osc.stop(t + 0.1);
      cricketTimer = window.setTimeout(cricket, 900 + Math.random() * 3800);
    };
    cricket();

    return () => {
      alive = false;
      if (cricketTimer !== undefined) window.clearTimeout(cricketTimer);
      src.stop();
      src.disconnect();
      lp.disconnect();
      g.disconnect();
    };
  }

  private startStatic(ctx: AudioContext, master: GainNode) {
    const buf = makeWhiteNoiseBuffer(ctx);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1800;
    bp.Q.value = 2.2;
    const lfo = ctx.createOscillator();
    lfo.type = "triangle";
    lfo.frequency.value = 0.22;
    const d = ctx.createGain();
    d.gain.value = 1400;
    lfo.connect(d);
    d.connect(bp.frequency);
    const wet = ctx.createGain();
    wet.gain.value = 0.32;
    src.connect(bp);
    bp.connect(wet);
    wet.connect(master);
    lfo.start();
    src.start();
    return () => {
      lfo.stop();
      src.stop();
      lfo.disconnect();
      d.disconnect();
      src.disconnect();
      bp.disconnect();
      wet.disconnect();
    };
  }

  private startFan(ctx: AudioContext, master: GainNode) {
    const hum1 = ctx.createOscillator();
    hum1.type = "sine";
    hum1.frequency.value = 118;
    const hum2 = ctx.createOscillator();
    hum2.type = "sine";
    hum2.frequency.value = 236;
    const g1 = ctx.createGain();
    const g2 = ctx.createGain();
    g1.gain.value = 0.05;
    g2.gain.value = 0.018;
    hum1.connect(g1);
    hum2.connect(g2);
    g1.connect(master);
    g2.connect(master);
    hum1.start();
    hum2.start();

    const buf = makePinkNoiseBuffer(ctx);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 6000;
    const pg = ctx.createGain();
    pg.gain.value = 0.07;
    src.connect(lp);
    lp.connect(pg);
    pg.connect(master);
    src.start();

    return () => {
      hum1.stop();
      hum2.stop();
      src.stop();
      hum1.disconnect();
      hum2.disconnect();
      g1.disconnect();
      g2.disconnect();
      src.disconnect();
      lp.disconnect();
      pg.disconnect();
    };
  }

  private startCafe(ctx: AudioContext, master: GainNode) {
    const brown = makeBrownNoiseBuffer(ctx);
    const src = ctx.createBufferSource();
    src.buffer = brown;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1900;
    const g = ctx.createGain();
    g.gain.value = 0.11;
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
    let burstTimer: number | undefined;
    const scheduleBurst = () => {
      if (!alive) return;
      const t = now(ctx) + 0.05 + Math.random() * 4.5;
      tg.gain.cancelScheduledValues(t);
      tg.gain.setValueAtTime(0, t);
      tg.gain.linearRampToValueAtTime(0.014 + Math.random() * 0.02, t + 0.02);
      tg.gain.linearRampToValueAtTime(0, t + 0.12 + Math.random() * 0.08);
      burstTimer = window.setTimeout(scheduleBurst, 400 + Math.random() * 2200);
    };
    scheduleBurst();

    return () => {
      alive = false;
      if (burstTimer !== undefined) window.clearTimeout(burstTimer);
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
