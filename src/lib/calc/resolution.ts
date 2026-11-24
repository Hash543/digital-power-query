// PWM / ADC resolution and limit-cycle check for a buck-type converter.

export interface PwmInput {
  fclk: number; // Hz
  fsw: number; // Hz
  countMode: "up" | "updown";
  hrStepPs?: number; // optional high-resolution step in ps (HRPWM)
  vin: number; // V, for buck output-step estimate
}

export interface PwmResult {
  countsPerPeriod: number;
  timeStep: number; // s
  dutyStep: number; // fraction
  bits: number; // effective bits
  voutStep: number; // V ≈ Vin · ΔD
  usesHr: boolean;
}

export function pwmResolution({ fclk, fsw, countMode, hrStepPs, vin }: PwmInput): PwmResult {
  if (!(fclk > 0) || !(fsw > 0)) throw new Error("Clock and switching frequency must be > 0");
  if (fsw >= fclk) throw new Error("Switching frequency must be below the PWM clock");
  // Up-down counting: each count step moves both edges, so the duty step is 2/fclk per period.
  const clkStep = countMode === "updown" ? 2 / fclk : 1 / fclk;
  const usesHr = !!hrStepPs && hrStepPs > 0;
  const timeStep = usesHr ? hrStepPs! * 1e-12 : clkStep;
  const period = 1 / fsw;
  const dutyStep = timeStep / period;
  return {
    countsPerPeriod: period / clkStep,
    timeStep,
    dutyStep,
    bits: Math.log2(1 / dutyStep),
    voutStep: vin * dutyStep,
    usesHr,
  };
}

export interface AdcInput {
  bits: number;
  vref: number; // V, full-scale
  gain: number; // feedback divider gain Vadc/Vout (≤ 1)
}

export interface AdcResult {
  lsb: number; // V at ADC pin
  voutLsb: number; // V referred to output
  voutFullScale: number;
}

export function adcResolution({ bits, vref, gain }: AdcInput): AdcResult {
  if (!(bits > 0) || !(vref > 0) || !(gain > 0)) throw new Error("Bits, Vref and gain must be > 0");
  const lsb = vref / 2 ** bits;
  return { lsb, voutLsb: lsb / gain, voutFullScale: vref / gain };
}

export const enobFromSinad = (sinadDb: number) => (sinadDb - 1.76) / 6.02;

export interface LcoResult {
  ok: boolean;
  ratio: number; // ΔV_ADC / ΔV_DPWM (want > 1)
  extraBitsNeeded: number; // DPWM bits to add if !ok
}

/** Peterchev & Sanders necessary condition: ΔV_DPWM < ΔV_ADC (plus integral action). */
export function limitCycleCheck(pwm: PwmResult, adc: AdcResult): LcoResult {
  const ratio = adc.voutLsb / pwm.voutStep;
  return { ok: ratio > 1, ratio, extraBitsNeeded: ratio > 1 ? 0 : Math.ceil(Math.log2(1 / ratio) + 1e-9) || 1 };
}
