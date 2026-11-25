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

import * as topo from "./topology";

describe("Topology duty cycles", () => {
  it("computes PWM timer values", () => {
    const up = topo.pwmTiming(100e3, 0.25, 100e6);
    expect(up.periodCounts).toBe(1000);
    expect(up.compare).toBe(250);
    const ud = topo.pwmTiming(100e3, 0.25, 100e6, "updown");
    expect(ud.periodCounts).toBe(500);
    expect(ud.compare).toBe(125);
  });
  it("boost PFC duty follows the line", () => {
    const r = topo.pfc({ vacRms: 230, vbus: 400, fsw: 65e3, fclk: 100e6, pout: 1000 });
    expect(r.dutyAtPeak).toBeCloseTo(1 - (Math.SQRT2 * 230) / 400, 9);
    expect(r.points[0].duty).toBe(1);
    expect(r.iinPeak).toBeCloseTo((Math.SQRT2 * 1000) / (0.95 * 230), 9);
    expect(() => topo.pfc({ vacRms: 300, vbus: 400, fsw: 65e3, fclk: 100e6 })).toThrow();
  });
  it("LLC runs at resonance when the required gain is 1", () => {
    expect(topo.llcGain(1, 5, 0.4)).toBeCloseTo(1, 12);
    const base = { vin: 400, lr: 50e-6, cr: 20e-9, lm: 250e-6, pout: 500, bridge: "half" as const, fclk: 100e6 };
    const at = topo.llc({ ...base, vout: 12, n: 200 / 12 });
    expect(at.fsw / at.fr).toBeCloseTo(1, 3);
    const below = topo.llc({ ...base, vout: 12, n: 200 / 12, vin: 380, pout: 300 });
    expect(() => topo.llc({ ...base, vout: 12, n: 200 / 12, vin: 370 })).toThrow(/peak gain/);
    expect(below.region).toBe("below");
    expect(topo.llcGain(below.fn, below.ln, below.q)).toBeCloseTo(below.gain, 6);
  });
  it("ACF duty from volt-second balance", () => {
    const r = topo.acf({ vin: 100, vout: 20, n: 4, fsw: 100e3, fclk: 100e6 });
    expect(r.duty).toBeCloseTo(80 / 180, 12);
    expect(r.vdsMain).toBe(180);
  });
  it("4-switch buck-boost picks the mode", () => {
    const f = { fsw: 200e3, fclk: 100e6 };
    expect(topo.fourSwitchBuckBoost({ vin: 24, vout: 12, ...f })).toMatchObject({ mode: "buck", a: 0.5, c: 0 });
    expect(topo.fourSwitchBuckBoost({ vin: 12, vout: 20, ...f }).c).toBeCloseTo(0.4, 12);
    expect(topo.fourSwitchBuckBoost({ vin: 12, vout: 12, ...f })).toMatchObject({ mode: "buck-boost", a: 0.5, c: 0.5 });
  });
  it("PSFB phase shift", () => {
    const r = topo.psfb({ vin: 400, vout: 12, n: 16, fsw: 100e3, fclk: 100e6 });
    expect(r.dEff).toBeCloseTo(0.48, 12);
    expect(r.phaseDeg).toBeCloseTo(86.4, 9);
    expect(r.phaseCounts).toBeCloseTo(240, 9);
  });
  it("DAB phase shift reproduces the power", () => {
    const i = { v1: 400, v2: 400, n: 1, fsw: 100e3, l: 50e-6, fclk: 100e6 };
    const pMax = topo.dab({ ...i, p: 0 }).pMax;
    const r = topo.dab({ ...i, p: pMax / 2 });
    const back = (i.n * i.v1 * i.v2 * r.phiRad * (Math.PI - r.phiRad)) / (2 * Math.PI ** 2 * i.fsw * i.l);
    expect(back).toBeCloseTo(pMax / 2, 6);
    expect(topo.dab({ ...i, p: pMax }).phiDeg).toBeCloseTo(90, 6);
    expect(topo.dab({ ...i, p: -pMax / 2 }).phiRad).toBeCloseTo(-r.phiRad, 12);
  });
});
