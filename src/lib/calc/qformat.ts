// Fixed-point Qm.n conversions.
// Signed: word length = 1 + m + n (two's complement). Unsigned: word length = m + n.

export interface QSpec {
  m: number; // integer bits (excluding sign)
  n: number; // fractional bits
  signed: boolean;
}

export interface QInfo {
  wordBits: number;
  resolution: number;
  min: number;
  max: number;
}

export interface QResult extends QInfo {
  integer: number; // signed integer represented
  raw: bigint; // unsigned bit pattern
  hex: string;
  binary: string;
  value: number; // value actually represented
  error: number; // represented − requested
  saturated: boolean;
}

export function qInfo({ m, n, signed }: QSpec): QInfo {
  if (!Number.isInteger(m) || !Number.isInteger(n) || m < 0 || n < 0) throw new Error("m and n must be non-negative integers");
  const wordBits = (signed ? 1 : 0) + m + n;
  if (wordBits < 1 || wordBits > 64) throw new Error("Word length must be 1–64 bits");
  const resolution = 2 ** -n;
  return {
    wordBits,
    resolution,
    min: signed ? -(2 ** m) : 0,
    max: 2 ** m - resolution,
  };
}

function build(spec: QSpec, integer: bigint, requested: number, saturated: boolean): QResult {
  const info = qInfo(spec);
  const bits = BigInt(info.wordBits);
  const mod = 1n << bits;
  const raw = ((integer % mod) + mod) % mod;
  const value = Number(integer) * info.resolution;
  const hexDigits = Math.ceil(info.wordBits / 4);
  return {
    ...info,
    integer: Number(integer),
    raw,
    hex: "0x" + raw.toString(16).toUpperCase().padStart(hexDigits, "0"),
    binary: raw.toString(2).padStart(info.wordBits, "0"),
    value,
    error: value - requested,
    saturated,
  };
}

/** Real value → Qm.n (round to nearest, saturate). */
export function toQ(value: number, spec: QSpec): QResult {
  if (!Number.isFinite(value)) throw new Error("Value must be a finite number");
  const info = qInfo(spec);
  const minInt = spec.signed ? -(1n << BigInt(spec.m + spec.n)) : 0n;
  const maxInt = (1n << BigInt(spec.m + spec.n)) - 1n;
  let i = BigInt(Math.round(value / info.resolution));
  let saturated = false;
  if (i > maxInt) [i, saturated] = [maxInt, true];
  if (i < minInt) [i, saturated] = [minInt, true];
  return build(spec, i, value, saturated);
}

/** Hex/bit pattern → real value. */
export function fromQHex(input: string, spec: QSpec): QResult {
  const s = input.trim().replace(/^0x/i, "").replace(/[_\s]/g, "");
  if (!/^[0-9a-f]+$/i.test(s)) throw new Error(`Invalid hex value: "${input}"`);
  const info = qInfo(spec);
  const bits = BigInt(info.wordBits);
  let raw = BigInt("0x" + s);
  if (raw >> bits) throw new Error(`Value does not fit in ${info.wordBits} bits`);
  if (spec.signed && raw & (1n << (bits - 1n))) raw -= 1n << bits;
  const r = build(spec, raw, 0, false);
  return { ...r, error: 0 };
}
