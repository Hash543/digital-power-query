"use client";

import { useState } from "react";
import { T } from "@/components/lang";
import { Card, ErrorText, Field, PageHeader, Results, Select, TextInput, attempt, eng, fmt, parseNum } from "@/components/ui";
import { adcResolution, enobFromSinad, limitCycleCheck, pwmResolution } from "@/lib/calc/resolution";

export default function ResolutionPage() {
  const [fclk, setFclk] = useState("100M");
  const [fsw, setFsw] = useState("500k");
  const [countMode, setCountMode] = useState<"up" | "updown">("up");
  const [hr, setHr] = useState("");
  const [vin, setVin] = useState("12");
  const [bits, setBits] = useState("12");
  const [vref, setVref] = useState("3.3");
  const [gain, setGain] = useState("0.5");
  const [sinad, setSinad] = useState("68");

  const pwm = attempt(() =>
    pwmResolution({ fclk: parseNum(fclk), fsw: parseNum(fsw), countMode, hrStepPs: hr ? parseNum(hr) : undefined, vin: parseNum(vin) }),
  );
  const adc = attempt(() => adcResolution({ bits: parseNum(bits), vref: parseNum(vref), gain: parseNum(gain) }));
  const enob = enobFromSinad(parseNum(sinad));

  return (
    <div>
      <PageHeader
        title={<T en="PWM & ADC resolution" zh="PWM 與 ADC 解析度" />}
        intro={
          <T
            en="Estimates duty-cycle and output-voltage resolution for a buck-type converter and checks the Peterchev–Sanders no-limit-cycle condition (ΔV_DPWM < ΔV_ADC). Values accept SI suffixes: 100M, 500k, 150p."
            zh="估算 Buck 類轉換器的佔空比與輸出電壓解析度，並檢查 Peterchev–Sanders 無極限環條件（ΔV_DPWM < ΔV_ADC）。數值可使用 SI 字尾：100M、500k、150p。"
          />
        }
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="DPWM / HRPWM">
          <div className="grid grid-cols-2 gap-3">
            <Field label={<T en="PWM clock f_clk (Hz)" zh="PWM 時脈 f_clk (Hz)" />}>
              <TextInput value={fclk} onChange={(e) => setFclk(e.target.value)} />
            </Field>
            <Field label={<T en="Switching freq f_sw (Hz)" zh="開關頻率 f_sw (Hz)" />}>
              <TextInput value={fsw} onChange={(e) => setFsw(e.target.value)} />
            </Field>
            <Field label={<T en="Counter mode" zh="計數模式" />}>
              <Select value={countMode} onChange={(e) => setCountMode(e.target.value as "up" | "updown")}>
                <option value="up">Up-count (or down-count)</option>
                <option value="updown">Up-down count (center-aligned)</option>
              </Select>
            </Field>
            <Field label={<T en="HRPWM step (s), optional" zh="HRPWM 步階 (s)，選填" />} hint="e.g. 150p">
              <TextInput value={hr} onChange={(e) => setHr(e.target.value)} placeholder="—" />
            </Field>
            <Field label="V_in (V)">
              <TextInput value={vin} onChange={(e) => setVin(e.target.value)} />
            </Field>
          </div>
          <div className="mt-4">
            {pwm.ok ? (
              <Results
                rows={[
                  [<T key="c" en="Counts / period" zh="每週期計數" />, fmt(pwm.value.countsPerPeriod, 6)],
                  [<T key="t" en="Time step" zh="時間步階" />, eng(pwm.value.timeStep, "s")],
                  [<T key="d" en="Duty step" zh="佔空比步階" />, `${fmt(pwm.value.dutyStep * 100, 4)} %`],
                  [<T key="b" en="Effective bits" zh="有效位元數" />, fmt(pwm.value.bits, 4)],
                  ["ΔV_DPWM ≈ V_in·ΔD", eng(pwm.value.voutStep, "V")],
                ]}
              />
            ) : (
              <ErrorText>{pwm.error}</ErrorText>
            )}
          </div>
        </Card>

        <Card title="ADC">
          <div className="grid grid-cols-2 gap-3">
            <Field label={<T en="Bits" zh="位元數" />}>
              <TextInput value={bits} onChange={(e) => setBits(e.target.value)} />
            </Field>
            <Field label="V_ref (V)">
              <TextInput value={vref} onChange={(e) => setVref(e.target.value)} />
            </Field>
            <Field label={<T en="Divider gain V_adc / V_out" zh="分壓增益 V_adc / V_out" />}>
              <TextInput value={gain} onChange={(e) => setGain(e.target.value)} />
            </Field>
            <Field label="SINAD (dB) → ENOB">
              <TextInput value={sinad} onChange={(e) => setSinad(e.target.value)} />
            </Field>
          </div>
          <div className="mt-4">
            {adc.ok ? (
              <Results
                rows={[
                  [<T key="l" en="LSB at ADC pin" zh="ADC 腳位 LSB" />, eng(adc.value.lsb, "V")],
                  ["ΔV_ADC (at V_out)", eng(adc.value.voutLsb, "V")],
                  [<T key="f" en="V_out full scale" zh="V_out 滿刻度" />, eng(adc.value.voutFullScale, "V")],
                  ["ENOB", Number.isFinite(enob) ? `${fmt(enob, 3)} bits` : "—"],
                ]}
              />
            ) : (
              <ErrorText>{adc.error}</ErrorText>
            )}
          </div>
        </Card>
      </div>

      {pwm.ok && adc.ok && (() => {
        const l = limitCycleCheck(pwm.value, adc.value);
        return (
          <div className={`mt-5 rounded-lg border p-5 ${l.ok ? "border-green-600/40 bg-green-500/10" : "border-amber-600/40 bg-amber-500/10"}`}>
            <h2 className="font-semibold">
              {l.ok ? (
                <T en="✓ DPWM is finer than the ADC" zh="✓ DPWM 解析度優於 ADC" />
              ) : (
                <T en="⚠ Limit-cycle risk: DPWM is coarser than the ADC" zh="⚠ 極限環風險：DPWM 解析度比 ADC 粗" />
              )}
            </h2>
            <p className="mt-1 text-sm">
              ΔV_ADC / ΔV_DPWM = <span className="font-mono">{fmt(l.ratio, 4)}</span>
              {!l.ok && (
                <>
                  {" · "}
                  <T
                    en={`Add at least ${l.extraBitsNeeded} DPWM bit(s) (HRPWM, higher clock or dithering).`}
                    zh={`至少需增加 ${l.extraBitsNeeded} 位元 DPWM 解析度（HRPWM、提高時脈或抖動）。`}
                  />
                </>
              )}
            </p>
            <p className="mt-2 text-xs text-muted">
              <T
                en="Necessary condition only, together with integral action in the loop (Peterchev & Sanders, IEEE TPEL 2003)."
                zh="此為必要條件，且迴路需具積分作用（Peterchev & Sanders, IEEE TPEL 2003）。"
              />
            </p>
          </div>
        );
      })()}
    </div>
  );
}
