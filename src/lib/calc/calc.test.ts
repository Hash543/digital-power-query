import { describe, expect, it } from "vitest";
import * as pm from "./pmbus";
import { toQ, fromQHex, qInfo } from "./qformat";
import { pwmResolution, adcResolution, limitCycleCheck, enobFromSinad } from "./resolution";
import { fromPoleZero, fromPid, tustin, bodeAnalog, bodeDiscrete } from "./compensator";

describe("PMBus", () => {
  it("encodes/decodes LINEAR11 with finest exponent", () => {
    const r = pm.encodeLinear11(12);
    expect(r.hex).toBe("0xD300");
    expect(r.exponent).toBe(-6);
    expect(r.mantissa).toBe(768);
    expect(pm.decodeLinear11(0xd300).value).toBe(12);
  });
  it("handles negative LINEAR11", () => {
    const r = pm.encodeLinear11(-0.5);
    expect(pm.decodeLinear11(r.word).value).toBe(-0.5);
  });
  it("LINEAR16 with VOUT_MODE 0x17 (N = −9)", () => {
    const mode = pm.decodeVoutMode(0x17);
    expect(mode.mode).toBe("linear");
    expect(mode.exponent).toBe(-9);
    expect(pm.encodeLinear16(1.0, -9).hex).toBe("0x0200");
    expect(pm.decodeLinear16(0x0266, -9).value).toBeCloseTo(1.19921875);
  });
  it("DIRECT round-trip", () => {
    const c = { m: 100, b: 0, R: 0 };
    const e = pm.encodeDirect(12.34, c);
    expect(e.y).toBe(1234);
    expect(pm.decodeDirect(e.word, c).value).toBeCloseTo(12.34);
  });
  it("PEC CRC-8 check value", () => {
    expect(pm.crc8([..."123456789"].map((c) => c.charCodeAt(0)))).toBe(0xf4);
  });
});

describe("Q format", () => {
  const q15 = { m: 0, n: 15, signed: true };
  it("Q15 values", () => {
    expect(toQ(0.5, q15).hex).toBe("0x4000");
    expect(toQ(-1, q15).hex).toBe("0x8000");
    const s = toQ(1, q15);
    expect(s.saturated).toBe(true);
    expect(s.hex).toBe("0x7FFF");
    expect(fromQHex("0xC000", q15).value).toBe(-0.5);
  });
  it("Q8.24 info", () => {
    const i = qInfo({ m: 7, n: 24, signed: true });
    expect(i.wordBits).toBe(32);
    expect(i.min).toBe(-128);
  });
});

describe("Resolution", () => {
  it("PWM bits", () => {
    const p = pwmResolution({ fclk: 100e6, fsw: 500e3, countMode: "up", vin: 12 });
    expect(p.countsPerPeriod).toBeCloseTo(200);
    expect(p.bits).toBeCloseTo(Math.log2(200));
    expect(p.voutStep).toBeCloseTo(0.06);
  });
  it("HRPWM and LCO check", () => {
    const p = pwmResolution({ fclk: 100e6, fsw: 500e3, countMode: "up", hrStepPs: 150, vin: 12 });
    expect(p.timeStep).toBeCloseTo(150e-12);
    const a = adcResolution({ bits: 12, vref: 3.3, gain: 0.5 });
    expect(a.voutLsb).toBeCloseTo(3.3 / 4096 / 0.5);
    expect(limitCycleCheck(p, a).ok).toBe(true);
    const coarse = pwmResolution({ fclk: 100e6, fsw: 500e3, countMode: "up", vin: 12 });
    const lc = limitCycleCheck(coarse, a);
    expect(lc.ok).toBe(false);
    expect(lc.extraBitsNeeded).toBe(Math.ceil(Math.log2(0.06 / a.voutLsb)));
  });
  it("ENOB", () => expect(enobFromSinad(74)).toBeCloseTo(12, 0));
});

describe("Compensator", () => {
  it("Tustin of an integrator", () => {
    const d = tustin({ num: [1], den: [0, 1] }, 1000);
    expect(d.b[0]).toBeCloseTo(0.0005);
    expect(d.b[1]).toBeCloseTo(0.0005);
    expect(d.a).toEqual([1, -1]);
  });
  it("discrete response matches analog well below fs/2", () => {
    const tf = fromPoleZero({ gain: 5000, integrator: true, zerosHz: [2000], polesHz: [50000] });
    const fs = 1e6;
    const d = tustin(tf, fs);
    const [an] = bodeAnalog(tf, [5000]);
    const [dg] = bodeDiscrete(d, fs, [5000]);
    expect(dg.magDb).toBeCloseTo(an.magDb, 1);
    expect(dg.phaseDeg).toBeCloseTo(an.phaseDeg, 0);
  });
  it("PID is 2nd order (2P2Z)", () => {
    const d = tustin(fromPid({ kp: 1, ki: 1000, kd: 1e-5, fdHz: 1e5 }), 1e6);
    expect(d.b).toHaveLength(3);
    expect(d.a).toHaveLength(3);
    expect(d.a[0]).toBe(1);
  });
});
