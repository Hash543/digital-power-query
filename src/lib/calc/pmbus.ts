// PMBus data-format conversions (PMBus Part II, section 7).

export const toSigned = (raw: number, bits: number): number => {
  const mask = (1 << bits) - 1;
  const v = raw & mask;
  return v & (1 << (bits - 1)) ? v - (1 << bits) : v;
};

const toUnsigned = (v: number, bits: number): number =>
  ((v % (1 << bits)) + (1 << bits)) % (1 << bits);

export const hex = (v: number, digits = 4): string =>
  "0x" + v.toString(16).toUpperCase().padStart(digits, "0");

export function parseHex(input: string): number {
  const s = input.trim().replace(/^0x/i, "").replace(/[_\s]/g, "");
  if (!/^[0-9a-f]+$/i.test(s)) throw new Error(`Invalid hex value: "${input}"`);
  return parseInt(s, 16);
}

// ---------- LINEAR11 ----------
export interface Linear11 {
  word: number;
  hex: string;
  exponent: number; // N, 5-bit two's complement
  mantissa: number; // Y, 11-bit two's complement
  value: number;
  error?: number; // encoded value − requested value
}

export function decodeLinear11(word: number): Linear11 {
  if (!Number.isInteger(word) || word < 0 || word > 0xffff) throw new Error("Word must be 0x0000–0xFFFF");
  const exponent = toSigned(word >> 11, 5);
  const mantissa = toSigned(word & 0x7ff, 11);
  return { word, hex: hex(word), exponent, mantissa, value: mantissa * 2 ** exponent };
}

export function linear11Word(exponent: number, mantissa: number): number {
  return ((toUnsigned(exponent, 5) << 11) | toUnsigned(mantissa, 11)) & 0xffff;
}

/**
 * Encode a real value as LINEAR11. If `exponent` is omitted, picks the
 * smallest exponent (finest resolution) whose mantissa still fits.
 */
export function encodeLinear11(value: number, exponent?: number): Linear11 {
  if (!Number.isFinite(value)) throw new Error("Value must be a finite number");
  const candidates = exponent === undefined ? Array.from({ length: 32 }, (_, i) => i - 16) : [exponent];
  for (const n of candidates) {
    if (n < -16 || n > 15) throw new Error("Exponent must be −16…15");
    const y = Math.round(value / 2 ** n);
    if (y >= -1024 && y <= 1023) {
      const word = linear11Word(n, y);
      const r = decodeLinear11(word);
      return { ...r, error: r.value - value };
    }
  }
  throw new Error(
    exponent === undefined
      ? "Value is out of LINEAR11 range (±1023·2^15)"
      : `Mantissa does not fit 11 bits with exponent ${exponent}`,
  );
}

// ---------- VOUT_MODE / LINEAR16 ----------
export type VoutModeKind = "linear" | "vid" | "direct" | "ieee-half" | "reserved";

export interface VoutMode {
  byte: number;
  hex: string;
  mode: VoutModeKind;
  modeBits: number;
  parameter: number; // raw bits 4:0
  exponent?: number; // linear only
}

export function decodeVoutMode(byte: number): VoutMode {
  if (!Number.isInteger(byte) || byte < 0 || byte > 0xff) throw new Error("VOUT_MODE must be 0x00–0xFF");
  const modeBits = byte >> 5;
  const parameter = byte & 0x1f;
  const mode: VoutModeKind = (["linear", "vid", "direct", "ieee-half"] as const)[modeBits] ?? "reserved";
  return {
    byte,
    hex: hex(byte, 2),
    mode,
    modeBits,
    parameter,
    exponent: mode === "linear" ? toSigned(parameter, 5) : undefined,
  };
}

export const voutModeFromExponent = (exponent: number): number => {
  if (exponent < -16 || exponent > 15) throw new Error("Exponent must be −16…15");
  return toUnsigned(exponent, 5);
};

export interface Linear16 {
  word: number;
  hex: string;
  exponent: number;
  mantissa: number;
  value: number;
  lsb: number;
  error?: number;
}

export function decodeLinear16(word: number, exponent: number): Linear16 {
  if (!Number.isInteger(word) || word < 0 || word > 0xffff) throw new Error("Word must be 0x0000–0xFFFF");
  const lsb = 2 ** exponent;
  return { word, hex: hex(word), exponent, mantissa: word, value: word * lsb, lsb };
}

export function encodeLinear16(value: number, exponent: number): Linear16 {
  if (!Number.isFinite(value) || value < 0) throw new Error("LINEAR16 value must be ≥ 0");
  const v = Math.round(value / 2 ** exponent);
  if (v > 0xffff) throw new Error(`Value exceeds LINEAR16 range for exponent ${exponent} (max ${0xffff * 2 ** exponent})`);
  const r = decodeLinear16(v, exponent);
  return { ...r, error: r.value - value };
}

// ---------- DIRECT ----------
export interface DirectCoeffs {
  m: number;
  b: number;
  R: number;
}

export interface Direct {
  word: number;
  hex: string;
  y: number;
  value: number;
  error?: number;
}

export function decodeDirect(word: number, { m, b, R }: DirectCoeffs): Direct {
  if (m === 0) throw new Error("m must not be 0");
  const y = toSigned(word, 16);
  return { word: word & 0xffff, hex: hex(word & 0xffff), y, value: (y * 10 ** -R - b) / m };
}

export function encodeDirect(value: number, c: DirectCoeffs): Direct {
  const y = Math.round((c.m * value + c.b) * 10 ** c.R);
  if (y < -32768 || y > 32767) throw new Error("Result does not fit a 16-bit signed integer");
  const r = decodeDirect(toUnsigned(y, 16), c);
  return { ...r, error: r.value - value };
}

// ---------- PEC (CRC-8, poly 0x07) ----------
export function crc8(bytes: number[]): number {
  let crc = 0;
  for (const b of bytes) {
    crc ^= b & 0xff;
    for (let i = 0; i < 8; i++) crc = crc & 0x80 ? ((crc << 1) ^ 0x07) & 0xff : (crc << 1) & 0xff;
  }
  return crc;
}

export function parseBytes(input: string): number[] {
  const parts = input.trim().split(/[\s,]+/).filter(Boolean);
  if (!parts.length) throw new Error("Enter at least one byte");
  return parts.map((p) => {
    const v = parseHex(p);
    if (v > 0xff) throw new Error(`"${p}" is not a byte`);
    return v;
  });
}
