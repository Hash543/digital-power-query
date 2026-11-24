// Analog compensator → discrete (Tustin) and Bode evaluation.
// Polynomials are arrays of coefficients in ascending powers: [c0, c1, c2, ...].

export type Poly = number[];

export const polyMul = (a: Poly, b: Poly): Poly => {
  const r = new Array(a.length + b.length - 1).fill(0);
  a.forEach((x, i) => b.forEach((y, j) => (r[i + j] += x * y)));
  return r;
};

const polyAdd = (a: Poly, b: Poly): Poly =>
  Array.from({ length: Math.max(a.length, b.length) }, (_, i) => (a[i] ?? 0) + (b[i] ?? 0));

const polyScale = (a: Poly, k: number): Poly => a.map((x) => x * k);

const polyPow = (a: Poly, n: number): Poly => {
  let r: Poly = [1];
  for (let i = 0; i < n; i++) r = polyMul(r, a);
  return r;
};

const trim = (p: Poly): Poly => {
  const r = [...p];
  while (r.length > 1 && Math.abs(r[r.length - 1]) < 1e-300) r.pop();
  return r;
};

export interface TransferFn {
  num: Poly;
  den: Poly;
}

export interface PoleZeroSpec {
  gain: number; // K
  integrator: boolean; // pole at origin
  zerosHz: number[];
  polesHz: number[];
}

/** G(s) = K · Π(1 + s/ωz) / (s^k · Π(1 + s/ωp)) */
export function fromPoleZero({ gain, integrator, zerosHz, polesHz }: PoleZeroSpec): TransferFn {
  for (const f of [...zerosHz, ...polesHz]) if (!(f > 0)) throw new Error("Pole/zero frequencies must be > 0 Hz");
  let num: Poly = [gain];
  for (const f of zerosHz) num = polyMul(num, [1, 1 / (2 * Math.PI * f)]);
  let den: Poly = integrator ? [0, 1] : [1];
  for (const f of polesHz) den = polyMul(den, [1, 1 / (2 * Math.PI * f)]);
  return { num, den };
}

export interface PidSpec {
  kp: number;
  ki: number; // 1/s
  kd: number; // s
  fdHz: number; // derivative filter pole
}

/** G(s) = Kp + Ki/s + Kd·s/(1 + s/ωd) */
export function fromPid({ kp, ki, kd, fdHz }: PidSpec): TransferFn {
  if (!(fdHz > 0)) throw new Error("Derivative filter frequency must be > 0 Hz");
  const tau = 1 / (2 * Math.PI * fdHz);
  // num = Kp·s(1+τs) + Ki(1+τs) + Kd·s²
  const num = polyAdd(polyAdd(polyScale([0, 1, tau], kp), polyScale([1, tau], ki)), [0, 0, kd]);
  const den = [0, 1, tau];
  return { num, den };
}

export interface Discrete {
  /** b[0..n] for numerator in z⁻¹ (B0 + B1 z⁻¹ + …) */
  b: number[];
  /** a[0..n] with a[0] = 1 (1 + A1 z⁻¹ + …) */
  a: number[];
}

/**
 * Tustin: s = K·(z−1)/(z+1), K = 2/T, or with pre-warping at fwHz: K = ω/tan(ωT/2).
 */
export function tustin(tf: TransferFn, fsHz: number, prewarpHz?: number): Discrete {
  if (!(fsHz > 0)) throw new Error("Sampling frequency must be > 0");
  const T = 1 / fsHz;
  let K = 2 / T;
  if (prewarpHz && prewarpHz > 0) {
    if (prewarpHz >= fsHz / 2) throw new Error("Pre-warp frequency must be below fs/2");
    const w = 2 * Math.PI * prewarpHz;
    K = w / Math.tan((w * T) / 2);
  }
  const num = trim(tf.num);
  const den = trim(tf.den);
  const n = Math.max(num.length, den.length) - 1;
  const zm1 = [-1, 1]; // (z − 1)
  const zp1 = [1, 1]; // (z + 1)
  const map = (p: Poly): Poly => {
    let r: Poly = new Array(n + 1).fill(0);
    p.forEach((c, i) => {
      if (c === 0) return;
      r = polyAdd(r, polyScale(polyMul(polyPow(zm1, i), polyPow(zp1, n - i)), c * K ** i));
    });
    return r;
  };
  // Result is in powers of z (ascending). Divide by z^n → descending powers become z⁻¹ terms.
  const nz = map(num);
  const dz = map(den);
  const a0 = dz[n];
  if (Math.abs(a0) < 1e-300) throw new Error("Degenerate denominator");
  const b = Array.from({ length: n + 1 }, (_, k) => (nz[n - k] ?? 0) / a0);
  const a = Array.from({ length: n + 1 }, (_, k) => (dz[n - k] ?? 0) / a0);
  return { b, a };
}

// ---------- frequency response ----------
type C = [number, number];
const cmul = (x: C, y: C): C => [x[0] * y[0] - x[1] * y[1], x[0] * y[1] + x[1] * y[0]];
const cdiv = (x: C, y: C): C => {
  const d = y[0] * y[0] + y[1] * y[1];
  return [(x[0] * y[0] + x[1] * y[1]) / d, (x[1] * y[0] - x[0] * y[1]) / d];
};
const polyEval = (p: Poly, x: C): C => {
  let r: C = [0, 0];
  for (let i = p.length - 1; i >= 0; i--) r = cmul(r, x).map((v, k) => v + (k === 0 ? p[i] : 0)) as C;
  return r;
};

export interface BodePoint {
  f: number;
  magDb: number;
  phaseDeg: number;
}

const toPoint = (f: number, h: C): BodePoint => ({
  f,
  magDb: 20 * Math.log10(Math.hypot(h[0], h[1])),
  phaseDeg: (Math.atan2(h[1], h[0]) * 180) / Math.PI,
});

export const logspace = (f0: number, f1: number, n: number) =>
  Array.from({ length: n }, (_, i) => f0 * (f1 / f0) ** (i / (n - 1)));

export function bodeAnalog(tf: TransferFn, freqs: number[]): BodePoint[] {
  return freqs.map((f) => {
    const s: C = [0, 2 * Math.PI * f];
    return toPoint(f, cdiv(polyEval(tf.num, s), polyEval(tf.den, s)));
  });
}

export function bodeDiscrete({ b, a }: Discrete, fsHz: number, freqs: number[]): BodePoint[] {
  return freqs.map((f) => {
    const w = (2 * Math.PI * f) / fsHz;
    const zinv: C = [Math.cos(w), -Math.sin(w)]; // e^{-jωT}
    return toPoint(f, cdiv(polyEval(b, zinv), polyEval(a, zinv)));
  });
}

/** Unwrap phase so the plot is continuous. */
export function unwrap(points: BodePoint[]): BodePoint[] {
  let offset = 0;
  return points.map((p, i) => {
    if (i > 0) {
      const prev = points[i - 1].phaseDeg + offset;
      while (p.phaseDeg + offset - prev > 180) offset -= 360;
      while (p.phaseDeg + offset - prev < -180) offset += 360;
    }
    return { ...p, phaseDeg: p.phaseDeg + offset };
  });
}
