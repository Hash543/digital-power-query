// Steady-state duty cycle / frequency / phase-shift and PWM register values for common
// topologies. Ideal lossless converters unless noted; n = N_p / N_s (primary : secondary).

const deg = (rad: number) => (rad * 180) / Math.PI;

function need(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const pos = (v: Record<string, number>) => {
  for (const [k, x] of Object.entries(v)) need(Number.isFinite(x) && x > 0, `${k} must be > 0`);
};

export type CountMode = "up" | "updown";

export interface PwmTiming {
  fsw: number; // Hz
  period: number; // s
  duty: number; // requested duty (0–1)
  onTime: number; // s
  periodCounts: number; // timer counts per switching period (TBPRD-ish; up-down = half)
  compare: number; // compare value that gives the duty (rounded)
  dutyActual: number; // duty after rounding to whole counts
  dutyStep: number; // duty resolution of one count
}

/** Timer values for one PWM output: up-count → N = f_clk/f_sw, up-down → N = f_clk/(2·f_sw). */
export function pwmTiming(fsw: number, duty: number, fclk: number, countMode: CountMode = "up"): PwmTiming {
  pos({ fsw, fclk });
  need(fsw < fclk, "f_sw must be below the PWM clock");
  const d = Math.min(1, Math.max(0, duty));
  const periodCounts = countMode === "updown" ? fclk / (2 * fsw) : fclk / fsw;
  const compare = Math.round(d * periodCounts);
  return {
    fsw,
    period: 1 / fsw,
    duty: d,
    onTime: d / fsw,
    periodCounts,
    compare,
    dutyActual: compare / periodCounts,
    dutyStep: 1 / periodCounts,
  };
}

/* ───────────── PFC (boost and totem-pole) ───────────── */

export interface PfcInput {
  vacRms: number; // V
  vbus: number; // V
  fsw: number;
  fclk: number;
  pout?: number; // W, optional, for peak input current
  eff?: number; // 0–1, default 0.95
  countMode?: CountMode;
}

export interface PfcPoint {
  angleDeg: number; // line angle 0–90°
  vin: number; // |v_ac| at that angle
  duty: number; // boost duty 1 − |v_ac|/V_bus
}

export interface PfcResult {
  vpk: number;
  dutyAtPeak: number; // minimum duty, at the line peak
  points: PfcPoint[];
  iinPeak?: number; // A, peak line current
  pwmAtPeak: PwmTiming;
}

/** Boost PFC: d(θ) = 1 − |√2·V_rms·sin θ| / V_bus. Duty → 1 near the zero crossing. */
export function pfc({ vacRms, vbus, fsw, fclk, pout, eff = 0.95, countMode = "up" }: PfcInput): PfcResult {
  pos({ "V_ac,rms": vacRms, V_bus: vbus });
  const vpk = Math.SQRT2 * vacRms;
  need(vbus > vpk, `V_bus must be above the line peak (${vpk.toFixed(1)} V)`);
  const points = [0, 15, 30, 45, 60, 75, 90].map((a) => {
    const vin = vpk * Math.sin((a * Math.PI) / 180);
    return { angleDeg: a, vin, duty: 1 - vin / vbus };
  });
  const dutyAtPeak = 1 - vpk / vbus;
  const iinPeak = pout && pout > 0 ? (Math.SQRT2 * pout) / (eff * vacRms) : undefined;
  return { vpk, dutyAtPeak, points, iinPeak, pwmAtPeak: pwmTiming(fsw, dutyAtPeak, fclk, countMode) };
}

/* ───────────── LLC (FHA) ───────────── */

export interface LlcInput {
  vin: number; // bridge DC input
  vout: number;
  n: number; // N_p/N_s
  lr: number; // H
  cr: number; // F
  lm: number; // H
  pout: number; // W
  bridge: "half" | "full";
  vf?: number; // rectifier drop, V
  fclk: number;
  deadTime?: number; // s
}

export interface LlcResult {
  fr: number; // series resonance
  fp: number; // resonance with Lm
  ln: number; // Lm / Lr
  q: number;
  rac: number;
  gain: number; // required tank gain M
  gainPeak: number; // max gain available at this load (FHA)
  fn: number; // f_sw / f_r
  fsw: number;
  region: "above" | "below" | "at";
  duty: number; // per switch, after dead time
  pwm: PwmTiming;
  freqStep: number; // Hz change per timer count
}

/** FHA voltage gain of the LLC tank, normalised to the bridge output. */
export function llcGain(fn: number, ln: number, q: number) {
  const a = (ln + 1) * fn * fn - 1;
  const b = q * ln * fn * (fn * fn - 1);
  return (ln * fn * fn) / Math.sqrt(a * a + b * b);
}

export function llc({ vin, vout, n, lr, cr, lm, pout, bridge, vf = 0, fclk, deadTime = 0 }: LlcInput): LlcResult {
  pos({ V_in: vin, V_out: vout, n, L_r: lr, C_r: cr, L_m: lm, P_out: pout });
  const fr = 1 / (2 * Math.PI * Math.sqrt(lr * cr));
  const fp = 1 / (2 * Math.PI * Math.sqrt((lr + lm) * cr));
  const ln = lm / lr;
  const rload = (vout * vout) / pout;
  const rac = (8 * n * n * rload) / (Math.PI * Math.PI);
  const q = Math.sqrt(lr / cr) / rac;
  const k = bridge === "half" ? 0.5 : 1;
  const gain = (n * (vout + vf)) / (k * vin);

  // Find the gain peak between f_p and f_r (gain falls monotonically on either side of it).
  const fnMin = fp / fr;
  let fnPeak = 1;
  let gainPeak = llcGain(1, ln, q);
  for (let i = 0; i <= 2000; i++) {
    const f = fnMin + ((1 - fnMin) * i) / 2000;
    const g = llcGain(f, ln, q);
    if (g > gainPeak) [gainPeak, fnPeak] = [g, f];
  }
  need(gain <= gainPeak, `Gain ${gain.toFixed(3)} is above the tank's peak gain ${gainPeak.toFixed(3)} at this load (capacitive region). Lower n or L_n, or raise V_in.`);
  const fnMax = 10;
  need(gain >= llcGain(fnMax, ln, q), `Gain ${gain.toFixed(3)} needs f_sw > 10·f_r; use burst mode at this operating point.`);

  // Bisection on the inductive side (fn ≥ fnPeak), where M decreases with frequency.
  let lo = fnPeak;
  let hi = fnMax;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (llcGain(mid, ln, q) > gain) lo = mid;
    else hi = mid;
  }
  const fn = (lo + hi) / 2;
  const fsw = fn * fr;
  const duty = Math.max(0, 0.5 - deadTime * fsw);
  const pwm = pwmTiming(fsw, duty, fclk, "up");
  return {
    fr,
    fp,
    ln,
    q,
    rac,
    gain,
    gainPeak,
    fn,
    fsw,
    region: Math.abs(fn - 1) < 0.005 ? "at" : fn > 1 ? "above" : "below",
    duty,
    pwm,
    freqStep: (fsw * fsw) / fclk,
  };
}

/* ───────────── Active clamp flyback ───────────── */

export interface AcfInput {
  vin: number;
  vout: number;
  n: number;
  vf?: number;
  fsw: number;
  fclk: number;
  deadTime?: number;
}

export interface AcfResult {
  vReflected: number; // n·(V_out + V_f), also ≈ clamp capacitor voltage
  duty: number; // main switch
  clampDuty: number; // high-side clamp switch, after two dead times
  vdsMain: number; // main switch stress
  pwm: PwmTiming;
}

/** Volt-second balance on L_m: V_in·D = n·(V_out+V_f)·(1 − D). */
export function acf({ vin, vout, n, vf = 0, fsw, fclk, deadTime = 0 }: AcfInput): AcfResult {
  pos({ V_in: vin, V_out: vout, n });
  const vr = n * (vout + vf);
  const duty = vr / (vin + vr);
  return {
    vReflected: vr,
    duty,
    clampDuty: Math.max(0, 1 - duty - 2 * deadTime * fsw),
    vdsMain: vin + vr,
    pwm: pwmTiming(fsw, duty, fclk, "up"),
  };
}

/* ───────────── Four-switch buck-boost ───────────── */

export interface FsbbInput {
  vin: number;
  vout: number;
  fsw: number;
  fclk: number;
  band?: number; // ± fraction of V_out treated as the buck-boost region, default 0.1
}

export type FsbbMode = "buck" | "buck-boost" | "boost";

export interface FsbbResult {
  mode: FsbbMode;
  /** On-time duty of each switch: A/B = buck leg high/low side, C/D = boost leg low/high side. */
  a: number;
  b: number;
  c: number;
  d: number;
  pwmBuck: PwmTiming; // switch A
  pwmBoost: PwmTiming; // switch C
}

export function fourSwitchBuckBoost({ vin, vout, fsw, fclk, band = 0.1 }: FsbbInput): FsbbResult {
  pos({ V_in: vin, V_out: vout });
  need(band >= 0 && band < 1, "Band must be between 0 and 1");
  let mode: FsbbMode;
  let a: number;
  let c: number;
  if (vin >= vout * (1 + band)) {
    mode = "buck"; // C off, D on: buck with the boost leg passing through
    a = vout / vin;
    c = 0;
  } else if (vin <= vout * (1 - band)) {
    mode = "boost"; // A on, B off: boost with the buck leg passing through
    a = 1;
    c = 1 - vin / vout;
  } else {
    mode = "buck-boost"; // A+C on for D, then B+D on: V_in·D = V_out·(1 − D)
    a = c = vout / (vin + vout);
  }
  return { mode, a, b: 1 - a, c, d: 1 - c, pwmBuck: pwmTiming(fsw, a, fclk), pwmBoost: pwmTiming(fsw, c, fclk) };
}

/* ───────────── Phase-shifted full bridge ───────────── */

export interface PsfbInput {
  vin: number;
  vout: number;
  n: number;
  vf?: number;
  fsw: number;
  fclk: number;
}

export interface PsfbResult {
  dEff: number; // effective duty seen by the secondary (0–1)
  phaseDeg: number;
  phaseTime: number; // s, delay of the lagging leg
  phaseCounts: number; // timer counts of phase shift (up-count timebase)
  periodCounts: number;
  fOutput: number; // ripple frequency at the output filter (2·f_sw)
}

/** V_out + V_f = D_eff · V_in / n, with D_eff = phase shift / 180°. */
export function psfb({ vin, vout, n, vf = 0, fsw, fclk }: PsfbInput): PsfbResult {
  pos({ V_in: vin, V_out: vout, n, f_sw: fsw, f_clk: fclk });
  const dEff = (n * (vout + vf)) / vin;
  need(dEff <= 1, `Needs D_eff = ${dEff.toFixed(3)} > 1: lower n or raise V_in`);
  const periodCounts = fclk / fsw;
  const phaseTime = dEff / (2 * fsw);
  return { dEff, phaseDeg: dEff * 180, phaseTime, phaseCounts: phaseTime * fclk, periodCounts, fOutput: 2 * fsw };
}

/* ───────────── Dual active bridge (single phase shift) ───────────── */

export interface DabInput {
  v1: number;
  v2: number;
  n: number; // N1/N2
  fsw: number;
  l: number; // series inductance referred to side 1, H
  p: number; // W, + = side 1 → side 2
  fclk: number;
}

export interface DabResult {
  phiRad: number;
  phiDeg: number;
  phaseTime: number;
  phaseCounts: number;
  pMax: number; // at φ = 90°
  voltageRatio: number; // n·V2 / V1; ≈ 1 keeps ZVS over the widest load range
}

/** P = n·V1·V2·φ·(π − |φ|) / (2π²·f_s·L). Solved for the smaller φ (|φ| ≤ 90°). */
export function dab({ v1, v2, n, fsw, l, p, fclk }: DabInput): DabResult {
  pos({ V1: v1, V2: v2, n, f_sw: fsw, L: l, f_clk: fclk });
  const pMax = (n * v1 * v2) / (8 * fsw * l);
  need(Math.abs(p) <= pMax, `|P| exceeds the maximum ${pMax.toFixed(0)} W at φ = 90°; lower L or f_sw`);
  const k = (2 * Math.PI ** 2 * fsw * l * Math.abs(p)) / (n * v1 * v2);
  const phi = Math.sign(p) * ((Math.PI - Math.sqrt(Math.PI ** 2 - 4 * k)) / 2);
  const phaseTime = phi / (2 * Math.PI * fsw);
  return {
    phiRad: phi,
    phiDeg: deg(phi),
    phaseTime,
    phaseCounts: phaseTime * fclk,
    pMax,
    voltageRatio: (n * v2) / v1,
  };
}
