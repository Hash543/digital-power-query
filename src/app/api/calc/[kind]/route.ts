import * as pm from "@/lib/calc/pmbus";
import { fromQHex, toQ } from "@/lib/calc/qformat";
import { adcResolution, limitCycleCheck, pwmResolution } from "@/lib/calc/resolution";
import { bodeDiscrete, fromPid, fromPoleZero, logspace, tustin } from "@/lib/calc/compensator";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Handler = (body: any) => unknown;

const num = (v: unknown, name: string): number => {
  const n = typeof v === "string" ? Number(v) : v;
  if (typeof n !== "number" || !Number.isFinite(n)) throw new Error(`"${name}" must be a number`);
  return n;
};
const word = (v: unknown, name: string) => (typeof v === "string" ? pm.parseHex(v) : num(v, name));

const handlers: Record<string, Handler> = {
  // { op: "linear11-decode", word } | { op: "linear11-encode", value, exponent? }
  // { op: "linear16-decode", word, voutMode } | { op: "linear16-encode", value, voutMode }
  // { op: "direct-decode", word, m, b, R } | { op: "direct-encode", value, m, b, R }
  // { op: "vout-mode", voutMode } | { op: "pec", bytes: "B6 21 00 02" }
  pmbus(b) {
    const exp = () => {
      const vm = pm.decodeVoutMode(word(b.voutMode, "voutMode"));
      if (vm.exponent === undefined) throw new Error("VOUT_MODE is not linear mode");
      return vm.exponent;
    };
    const coeffs = () => ({ m: num(b.m, "m"), b: num(b.b, "b"), R: num(b.R, "R") });
    switch (b.op) {
      case "linear11-decode": return pm.decodeLinear11(word(b.word, "word"));
      case "linear11-encode": return pm.encodeLinear11(num(b.value, "value"), b.exponent === undefined ? undefined : num(b.exponent, "exponent"));
      case "linear16-decode": return pm.decodeLinear16(word(b.word, "word"), exp());
      case "linear16-encode": return pm.encodeLinear16(num(b.value, "value"), exp());
      case "direct-decode": return pm.decodeDirect(word(b.word, "word"), coeffs());
      case "direct-encode": return pm.encodeDirect(num(b.value, "value"), coeffs());
      case "vout-mode": return pm.decodeVoutMode(word(b.voutMode, "voutMode"));
      case "pec": {
        const bytes = pm.parseBytes(String(b.bytes));
        return { pec: pm.hex(pm.crc8(bytes), 2) };
      }
      default: throw new Error(`Unknown op "${b.op}"`);
    }
  },
  // { m, n, signed, value } or { m, n, signed, hex }
  qformat(b) {
    const spec = { m: num(b.m, "m"), n: num(b.n, "n"), signed: b.signed !== false };
    const r = b.hex !== undefined ? fromQHex(String(b.hex), spec) : toQ(num(b.value, "value"), spec);
    return { ...r, raw: r.raw.toString() };
  },
  // { fclk, fsw, countMode?, hrStepPs?, vin, adcBits, vref, gain }
  resolution(b) {
    const pwm = pwmResolution({
      fclk: num(b.fclk, "fclk"),
      fsw: num(b.fsw, "fsw"),
      countMode: b.countMode === "updown" ? "updown" : "up",
      hrStepPs: b.hrStepPs === undefined ? undefined : num(b.hrStepPs, "hrStepPs"),
      vin: num(b.vin, "vin"),
    });
    const adc = adcResolution({ bits: num(b.adcBits, "adcBits"), vref: num(b.vref, "vref"), gain: num(b.gain, "gain") });
    return { pwm, adc, limitCycle: limitCycleCheck(pwm, adc) };
  },
  // { fs, prewarp?, pid: {kp,ki,kd,fdHz} } or { fs, prewarp?, gain, zerosHz: [], polesHz: [] }
  compensator(b) {
    const fs = num(b.fs, "fs");
    const tf = b.pid
      ? fromPid({ kp: num(b.pid.kp, "kp"), ki: num(b.pid.ki, "ki"), kd: num(b.pid.kd, "kd"), fdHz: num(b.pid.fdHz, "fdHz") })
      : fromPoleZero({
          gain: num(b.gain, "gain"),
          integrator: b.integrator !== false,
          zerosHz: (b.zerosHz ?? []).map((v: unknown) => num(v, "zerosHz")),
          polesHz: (b.polesHz ?? []).map((v: unknown) => num(v, "polesHz")),
        });
    const d = tustin(tf, fs, b.prewarp === undefined ? undefined : num(b.prewarp, "prewarp"));
    const bode = b.bode ? bodeDiscrete(d, fs, logspace(fs / 1e4, fs / 2 * 0.98, 50)) : undefined;
    return { analog: tf, B: d.b, A: d.a, bode };
  },
};

// POST /api/calc/{pmbus|qformat|resolution|compensator}
export async function POST(req: Request, ctx: RouteContext<"/api/calc/[kind]">) {
  const { kind } = await ctx.params;
  const handler = handlers[kind];
  if (!handler) return Response.json({ error: `Unknown calculator "${kind}"`, available: Object.keys(handlers) }, { status: 404 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Body must be JSON" }, { status: 400 });
  }
  try {
    return Response.json(handler(body ?? {}));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
