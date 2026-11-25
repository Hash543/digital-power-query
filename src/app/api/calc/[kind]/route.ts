import * as pm from "@/lib/calc/pmbus";
import { fromQHex, toQ } from "@/lib/calc/qformat";
import { adcResolution, limitCycleCheck, pwmResolution } from "@/lib/calc/resolution";
import * as topo from "@/lib/calc/topology";
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
  // { topology: "pfc"|"llc"|"acf"|"4sbb"|"psfb"|"dab", fclk, ...inputs of that topology }
  //   pfc: vacRms, vbus, fsw, pout?, eff?, countMode?   llc: vin, vout, n, lr, cr, lm, pout, bridge, vf?, deadTime?
  //   acf: vin, vout, n, vf?, fsw, deadTime?   4sbb: vin, vout, fsw, band?   psfb: vin, vout, n, vf?, fsw
  //   dab: v1, v2, n, fsw, l, p
  topology(b) {
    const o = (k: string) => (b[k] === undefined ? undefined : num(b[k], k));
    const r = (k: string) => num(b[k], k);
    const fclk = r("fclk");
    switch (b.topology) {
      case "pfc": return topo.pfc({ vacRms: r("vacRms"), vbus: r("vbus"), fsw: r("fsw"), fclk, pout: o("pout"), eff: o("eff"), countMode: b.countMode === "updown" ? "updown" : "up" });
      case "llc": return topo.llc({ vin: r("vin"), vout: r("vout"), n: r("n"), lr: r("lr"), cr: r("cr"), lm: r("lm"), pout: r("pout"), bridge: b.bridge === "full" ? "full" : "half", vf: o("vf"), fclk, deadTime: o("deadTime") });
      case "acf": return topo.acf({ vin: r("vin"), vout: r("vout"), n: r("n"), vf: o("vf"), fsw: r("fsw"), fclk, deadTime: o("deadTime") });
      case "4sbb": return topo.fourSwitchBuckBoost({ vin: r("vin"), vout: r("vout"), fsw: r("fsw"), fclk, band: o("band") });
      case "psfb": return topo.psfb({ vin: r("vin"), vout: r("vout"), n: r("n"), vf: o("vf"), fsw: r("fsw"), fclk });
      case "dab": return topo.dab({ v1: r("v1"), v2: r("v2"), n: r("n"), fsw: r("fsw"), l: r("l"), p: r("p"), fclk });
      default: throw new Error(`Unknown topology "${b.topology}" (pfc, llc, acf, 4sbb, psfb, dab)`);
    }
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

// POST /api/calc/{pmbus|qformat|resolution|compensator|topology}
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
