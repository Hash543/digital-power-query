"use client";

import Link from "next/link";
import { useState } from "react";
import { T } from "@/components/lang";
import { Card, ErrorText, Field, PageHeader, Results, Select, TextInput, attempt, eng, fmt, parseNum } from "@/components/ui";
import * as topo from "@/lib/calc/topology";

type Setter = (v: string) => void;
type Row = [React.ReactNode, React.ReactNode];

function useFields<K extends string>(init: Record<K, string>) {
  const [v, setV] = useState(init);
  const set = (k: K): Setter => (x) => setV((s) => ({ ...s, [k]: x }));
  const n = (k: K) => parseNum(v[k]);
  return { v, set, n };
}

function Inputs({ items }: { items: [React.ReactNode, string, Setter, string?][] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {items.map(([label, value, set, hint], i) => (
        <Field key={i} label={label} hint={hint}>
          <TextInput value={value} onChange={(e) => set(e.target.value)} />
        </Field>
      ))}
    </div>
  );
}

const pct = (d: number) => `${fmt(d * 100, 5)} %`;

function pwmRows(p: topo.PwmTiming, name: React.ReactNode = "PWM"): Row[] {
  return [
    [<T key="f" en={<>f_sw / period</>} zh={<>f_sw / 週期</>} />, `${eng(p.fsw, "Hz")} / ${eng(p.period, "s")}`],
    [<>{name} <T en="duty" zh="占空比" /></>, pct(p.duty)],
    [<T key="t" en="On-time" zh="導通時間" />, eng(p.onTime, "s")],
    [<T key="n" en="Period counts" zh="週期計數" />, fmt(p.periodCounts, 7)],
    [<T key="c" en="Compare value" zh="比較值 (CMP)" />, `${p.compare}  →  ${pct(p.dutyActual)}`],
    [<T key="s" en="Duty step (1 count)" zh="占空比步階（1 count）" />, pct(p.dutyStep)],
  ];
}

function Section({
  id,
  title,
  formula,
  children,
}: {
  id: string;
  title: React.ReactNode;
  formula: string;
  children: React.ReactNode;
}) {
  return (
    <div id={id} className="scroll-mt-20">
      <Card
        title={
          <span className="flex flex-wrap items-baseline justify-between gap-2">
            <span>{title}</span>
            <Link href={`/architectures#${id}`} className="text-xs font-normal text-accent">
              <T en="Topology overview →" zh="拓樸介紹 →" />
            </Link>
          </span>
        }
      >
        <p className="mb-4 rounded-md bg-panel px-3 py-2 font-mono text-xs">{formula}</p>
        {children}
      </Card>
    </div>
  );
}

function Out({ r, rows, note }: { r: { ok: true; value: unknown } | { ok: false; error: string }; rows: () => Row[]; note?: React.ReactNode }) {
  return (
    <div className="mt-4">
      {r.ok ? <Results rows={rows()} /> : <ErrorText>{r.error}</ErrorText>}
      {r.ok && note && <p className="mt-3 text-xs text-muted">{note}</p>}
    </div>
  );
}

function Pfc({ fclk, mode }: { fclk: number; mode: topo.CountMode }) {
  const f = useFields({ vac: "230", vbus: "400", fsw: "65k", pout: "1000", eff: "0.95" });
  const r = attempt(() => topo.pfc({ vacRms: f.n("vac"), vbus: f.n("vbus"), fsw: f.n("fsw"), fclk, pout: f.n("pout"), eff: f.n("eff"), countMode: mode }));
  return (
    <Section id="boost-pfc" title={<T en="Boost PFC & totem-pole PFC" zh="升壓 PFC 與圖騰柱 PFC" />} formula="d(θ) = 1 − √2·V_rms·|sin θ| / V_bus">
      <Inputs
        items={[
          ["V_ac,rms (V)", f.v.vac, f.set("vac")],
          ["V_bus (V)", f.v.vbus, f.set("vbus")],
          ["f_sw (Hz)", f.v.fsw, f.set("fsw")],
          ["P_out (W)", f.v.pout, f.set("pout")],
          [<T key="e" en="Efficiency" zh="效率" />, f.v.eff, f.set("eff")],
        ]}
      />
      {r.ok && (
        <table className="mt-4 w-full text-sm">
          <thead className="text-left text-xs text-muted">
            <tr>
              <th className="font-normal"><T en="Line angle" zh="市電相角" /></th>
              <th className="font-normal">|v_ac|</th>
              <th className="font-normal"><T en="Boost duty d" zh="升壓占空比 d" /></th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {r.value.points.map((p) => (
              <tr key={p.angleDeg} className="border-t border-line">
                <td>{p.angleDeg}°</td>
                <td>{fmt(p.vin, 4)} V</td>
                <td>{pct(p.duty)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <Out
        r={r}
        rows={() => {
          if (!r.ok) return [];
          const v = r.value;
          return [
            [<T key="p" en="Line peak" zh="市電峰值" />, eng(v.vpk, "V")],
            ...(v.iinPeak ? ([[<T key="i" en="Peak input current" zh="輸入電流峰值" />, eng(v.iinPeak, "A")]] as Row[]) : []),
            ...pwmRows(v.pwmAtPeak, <T en="At line peak:" zh="市電峰值處：" />),
          ];
        }}
        note={
          <T
            en="Totem-pole: in the positive half cycle the fast leg's low-side FET is the boost switch (duty d) and the high-side FET is the synchronous rectifier (1 − d); the slow leg's low side is on. In the negative half cycle the roles swap. Near the zero crossing d → 1, so the controller soft-starts the duty after each crossing."
            zh="圖騰柱：正半週時，快速臂的低側 FET 是升壓開關（占空比 d），高側 FET 做同步整流（1 − d），慢速臂低側導通；負半週時角色互換。過零點附近 d → 1，因此控制器在每次過零後緩啟動占空比。"
          />
        }
      />
    </Section>
  );
}

function Llc({ fclk }: { fclk: number }) {
  const f = useFields({ vin: "390", vout: "12", n: "16", lr: "50u", cr: "20n", lm: "250u", pout: "300", vf: "0", dt: "100n" });
  const [bridge, setBridge] = useState<"half" | "full">("half");
  const r = attempt(() =>
    topo.llc({ vin: f.n("vin"), vout: f.n("vout"), n: f.n("n"), lr: f.n("lr"), cr: f.n("cr"), lm: f.n("lm"), pout: f.n("pout"), bridge, vf: f.n("vf"), fclk, deadTime: f.n("dt") }),
  );
  return (
    <Section id="llc" title={<T en="LLC resonant (FHA)" zh="LLC 諧振（FHA 近似）" />} formula="M = n·V_out / (k·V_in),  k = ½ (half) or 1 (full);  M(f_n) = L_n·f_n² / √(((L_n+1)f_n²−1)² + (Q·L_n·f_n(f_n²−1))²)">
      <Inputs
        items={[
          ["V_in (V)", f.v.vin, f.set("vin")],
          ["V_out (V)", f.v.vout, f.set("vout")],
          ["n = N_p/N_s", f.v.n, f.set("n")],
          ["L_r (H)", f.v.lr, f.set("lr")],
          ["C_r (F)", f.v.cr, f.set("cr")],
          ["L_m (H)", f.v.lm, f.set("lm")],
          ["P_out (W)", f.v.pout, f.set("pout")],
          [<T key="v" en="Rectifier drop (V)" zh="整流壓降 (V)" />, f.v.vf, f.set("vf")],
          [<T key="d" en="Dead time (s)" zh="死區時間 (s)" />, f.v.dt, f.set("dt")],
        ]}
      />
      <div className="mt-3 w-48">
        <Field label={<T en="Bridge" zh="橋式" />}>
          <Select value={bridge} onChange={(e) => setBridge(e.target.value as "half" | "full")}>
            <option value="half">Half bridge</option>
            <option value="full">Full bridge</option>
          </Select>
        </Field>
      </div>
      <Out
        r={r}
        rows={() => {
          if (!r.ok) return [];
          const v = r.value;
          return [
            ["f_r / f_p", `${eng(v.fr, "Hz")} / ${eng(v.fp, "Hz")}`],
            ["L_n / Q / R_ac", `${fmt(v.ln, 4)} / ${fmt(v.q, 4)} / ${eng(v.rac, "Ω")}`],
            [<T key="g" en="Required gain M (peak available)" zh="所需增益 M（可達峰值）" />, `${fmt(v.gain, 5)} (${fmt(v.gainPeak, 4)})`],
            [<T key="fn" en="f_n = f_sw / f_r" zh="f_n = f_sw / f_r" />, `${fmt(v.fn, 5)} (${v.region} resonance)`],
            ...pwmRows(v.pwm, <T en="Each switch" zh="每顆開關" />),
            [<T key="fs" en="Frequency step (1 count)" zh="頻率步階（1 count）" />, eng(v.freqStep, "Hz")],
          ];
        }}
        note={
          <T
            en="LLC is regulated by frequency, not duty: both switches run at ~50% minus dead time, and the controller writes the period register. FHA is accurate near resonance and optimistic far from it; check with simulation."
            zh="LLC 靠頻率而非占空比穩壓：兩顆開關都約 50%（扣除死區），控制器寫入的是週期暫存器。FHA 在諧振點附近準確，遠離諧振時偏樂觀，請以模擬確認。"
          />
        }
      />
    </Section>
  );
}

function Acf({ fclk }: { fclk: number }) {
  const f = useFields({ vin: "150", vout: "20", n: "4", vf: "0.3", fsw: "150k", dt: "50n" });
  const r = attempt(() => topo.acf({ vin: f.n("vin"), vout: f.n("vout"), n: f.n("n"), vf: f.n("vf"), fsw: f.n("fsw"), fclk, deadTime: f.n("dt") }));
  return (
    <Section id="acf" title={<T en="Active clamp flyback" zh="主動箝位返馳式" />} formula="D = n(V_out+V_f) / (V_in + n(V_out+V_f));  V_clamp ≈ n(V_out+V_f)">
      <Inputs
        items={[
          ["V_in (V)", f.v.vin, f.set("vin")],
          ["V_out (V)", f.v.vout, f.set("vout")],
          ["n = N_p/N_s", f.v.n, f.set("n")],
          [<T key="v" en="SR / diode drop (V)" zh="SR／二極體壓降 (V)" />, f.v.vf, f.set("vf")],
          ["f_sw (Hz)", f.v.fsw, f.set("fsw")],
          [<T key="d" en="Dead time (s)" zh="死區時間 (s)" />, f.v.dt, f.set("dt")],
        ]}
      />
      <Out
        r={r}
        rows={() => {
          if (!r.ok) return [];
          const v = r.value;
          return [
            [<T key="r" en="Reflected / clamp voltage" zh="反射電壓／箝位電壓" />, eng(v.vReflected, "V")],
            [<T key="s" en="Main switch V_ds" zh="主開關 V_ds" />, eng(v.vdsMain, "V")],
            [<T key="c" en="Clamp switch duty" zh="箝位開關占空比" />, pct(v.clampDuty)],
            ...pwmRows(v.pwm, <T en="Main switch" zh="主開關" />),
          ];
        }}
        note={
          <T
            en="Complementary mode shown (clamp = 1 − D − 2·t_dead). Transition-mode ACF controllers vary f_sw with load, so treat f_sw as the operating point you want to check."
            zh="此為互補模式（箝位 = 1 − D − 2·t_dead）。轉態模式的 ACF 控制器會隨負載改變 f_sw，請把 f_sw 視為要檢查的工作點。"
          />
        }
      />
    </Section>
  );
}

function Fsbb({ fclk }: { fclk: number }) {
  const f = useFields({ vin: "12", vout: "20", fsw: "300k", band: "0.1" });
  const r = attempt(() => topo.fourSwitchBuckBoost({ vin: f.n("vin"), vout: f.n("vout"), fsw: f.n("fsw"), fclk, band: f.n("band") }));
  return (
    <Section
      id="four-switch-buck-boost"
      title={<T en="Four-switch buck-boost" zh="四開關升降壓" />}
      formula="Buck: D_A = V_out/V_in;  Boost: D_C = 1 − V_in/V_out;  Buck-boost: D_A = D_C = V_out/(V_in+V_out)"
    >
      <Inputs
        items={[
          ["V_in (V)", f.v.vin, f.set("vin")],
          ["V_out (V)", f.v.vout, f.set("vout")],
          ["f_sw (Hz)", f.v.fsw, f.set("fsw")],
          [<T key="b" en="Buck-boost band (± fraction)" zh="升降壓區間（± 比例）" />, f.v.band, f.set("band"), "0.1 = V_in within ±10% of V_out"],
        ]}
      />
      <Out
        r={r}
        rows={() => {
          if (!r.ok) return [];
          const v = r.value;
          return [
            [<T key="m" en="Mode" zh="模式" />, v.mode],
            [<T key="a" en="A / B (buck leg high / low)" zh="A / B（降壓臂高／低側）" />, `${pct(v.a)} / ${pct(v.b)}`],
            [<T key="c" en="C / D (boost leg low / high)" zh="C / D（升壓臂低／高側）" />, `${pct(v.c)} / ${pct(v.d)}`],
            [<T key="pa" en="Switch A compare" zh="開關 A 比較值" />, `${v.pwmBuck.compare} / ${fmt(v.pwmBuck.periodCounts, 7)}`],
            [<T key="pc" en="Switch C compare" zh="開關 C 比較值" />, `${v.pwmBoost.compare} / ${fmt(v.pwmBoost.periodCounts, 7)}`],
            [<T key="t" en="On-time A / C" zh="導通時間 A / C" />, `${eng(v.pwmBuck.onTime, "s")} / ${eng(v.pwmBoost.onTime, "s")}`],
          ];
        }}
        note={
          <T
            en="Inside the band all four switches run (A+C, then B+D). Outside it, one leg stays static and the other runs as a plain buck or boost. Add hysteresis between modes in firmware so the converter does not chatter at the edge."
            zh="在區間內四顆開關都切換（A+C，再 B+D）；區間外則一臂保持靜態，另一臂當一般降壓或升壓運作。韌體應在模式之間加入遲滯，避免在邊界來回跳動。"
          />
        }
      />
    </Section>
  );
}

function Psfb({ fclk }: { fclk: number }) {
  const f = useFields({ vin: "400", vout: "12", n: "16", vf: "0.1", fsw: "100k" });
  const r = attempt(() => topo.psfb({ vin: f.n("vin"), vout: f.n("vout"), n: f.n("n"), vf: f.n("vf"), fsw: f.n("fsw"), fclk }));
  return (
    <Section id="psfb" title={<T en="Phase-shifted full bridge" zh="相移全橋" />} formula="D_eff = n(V_out+V_f) / V_in;  phase = D_eff × 180°;  t_φ = D_eff / (2·f_sw)">
      <Inputs
        items={[
          ["V_in (V)", f.v.vin, f.set("vin")],
          ["V_out (V)", f.v.vout, f.set("vout")],
          ["n = N_p/N_s", f.v.n, f.set("n")],
          [<T key="v" en="Rectifier drop (V)" zh="整流壓降 (V)" />, f.v.vf, f.set("vf")],
          ["f_sw (Hz)", f.v.fsw, f.set("fsw")],
        ]}
      />
      <Out
        r={r}
        rows={() => {
          if (!r.ok) return [];
          const v = r.value;
          return [
            ["D_eff", pct(v.dEff)],
            [<T key="p" en="Phase shift" zh="相移量" />, `${fmt(v.phaseDeg, 5)}°  (${eng(v.phaseTime, "s")})`],
            [<T key="c" en="Phase register (counts)" zh="相位暫存器（counts）" />, `${fmt(v.phaseCounts, 6)} / ${fmt(v.periodCounts, 7)}`],
            [<T key="d" en="Each switch duty" zh="每顆開關占空比" />, "~50 % − dead time"],
            [<T key="o" en="Output filter frequency" zh="輸出濾波頻率" />, eng(v.fOutput, "Hz")],
          ];
        }}
        note={
          <T
            en="Ideal value: leakage inductance causes duty-cycle loss, so the real phase shift needed is somewhat larger."
            zh="此為理想值：漏感造成占空比損失，實際需要的相移量會稍大。"
          />
        }
      />
    </Section>
  );
}

function Dab({ fclk }: { fclk: number }) {
  const f = useFields({ v1: "400", v2: "400", n: "1", fsw: "100k", l: "50u", p: "3000" });
  const r = attempt(() => topo.dab({ v1: f.n("v1"), v2: f.n("v2"), n: f.n("n"), fsw: f.n("fsw"), l: f.n("l"), p: f.n("p"), fclk }));
  return (
    <Section id="dab" title={<T en="Dual active bridge (single phase shift)" zh="雙主動橋（單相移）" />} formula="P = n·V1·V2·φ(π − |φ|) / (2π²·f_sw·L)  →  φ = (π − √(π² − 4K)) / 2">
      <Inputs
        items={[
          ["V1 (V)", f.v.v1, f.set("v1")],
          ["V2 (V)", f.v.v2, f.set("v2")],
          ["n = N1/N2", f.v.n, f.set("n")],
          ["f_sw (Hz)", f.v.fsw, f.set("fsw")],
          [<T key="l" en="L (referred to side 1, H)" zh="L（折算到一次側，H）" />, f.v.l, f.set("l")],
          [<T key="p" en="P (W, − = reverse)" zh="P（W，負值為反向）" />, f.v.p, f.set("p")],
        ]}
      />
      <Out
        r={r}
        rows={() => {
          if (!r.ok) return [];
          const v = r.value;
          return [
            [<T key="phi" en="Phase shift φ" zh="相移 φ" />, `${fmt(v.phiDeg, 5)}°  (${eng(v.phaseTime, "s")})`],
            [<T key="c" en="Phase register (counts)" zh="相位暫存器（counts）" />, fmt(v.phaseCounts, 6)],
            [<T key="m" en="P_max (φ = 90°)" zh="P_max（φ = 90°）" />, eng(v.pMax, "W")],
            [<T key="d" en="Voltage ratio n·V2/V1" zh="電壓比 n·V2/V1" />, fmt(v.voltageRatio, 4)],
            [<T key="s" en="Each switch duty" zh="每顆開關占空比" />, "50 % − dead time"],
          ];
        }}
        note={
          <T
            en="Keep n·V2/V1 near 1 to hold ZVS over a wide load range; when it drifts, extended, dual or triple phase shift reduces circulating current."
            zh="讓 n·V2/V1 接近 1，才能在寬負載範圍維持 ZVS；偏離時可用擴展、雙重或三重相移降低環流。"
          />
        }
      />
    </Section>
  );
}

export default function TopologyCalcPage() {
  const [fclk, setFclk] = useState("100M");
  const [mode, setMode] = useState<topo.CountMode>("up");
  const clk = parseNum(fclk);
  const nav = [
    ["boost-pfc", "PFC"],
    ["llc", "LLC"],
    ["acf", "ACF"],
    ["four-switch-buck-boost", "4SBB"],
    ["psfb", "PSFB"],
    ["dab", "DAB"],
  ];
  return (
    <div>
      <PageHeader
        title={<T en="Topology duty cycle & PWM" zh="拓樸占空比與 PWM 計算" />}
        intro={
          <T
            en="Steady-state duty cycle, switching frequency or phase shift for each topology, plus the PWM timer values (period counts, compare value) a digital controller would load. Ideal lossless converters; n = N_p/N_s. Values accept SI suffixes: 100M, 65k, 50u, 20n."
            zh="計算各拓樸的穩態占空比、切換頻率或相移量，以及數位控制器要載入的 PWM 計時器數值（週期計數、比較值）。以理想無損轉換器計算；n = N_p/N_s。數值可用 SI 字尾：100M、65k、50u、20n。"
          />
        }
      />
      <div className="mb-6 flex flex-wrap items-end gap-4 rounded-lg border border-line bg-surface p-4">
        <div className="w-44">
          <Field label={<T en="PWM clock f_clk (Hz)" zh="PWM 時脈 f_clk (Hz)" />}>
            <TextInput value={fclk} onChange={(e) => setFclk(e.target.value)} />
          </Field>
        </div>
        <div className="w-60">
          <Field label={<T en="Counter mode (PFC)" zh="計數模式（PFC）" />}>
            <Select value={mode} onChange={(e) => setMode(e.target.value as topo.CountMode)}>
              <option value="up">Up-count</option>
              <option value="updown">Up-down (center-aligned)</option>
            </Select>
          </Field>
        </div>
        <nav className="flex flex-wrap gap-2 text-sm">
          {nav.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="rounded-full border border-line px-3 py-1 hover:border-accent">
              {label}
            </a>
          ))}
        </nav>
      </div>
      {!(clk > 0) ? (
        <ErrorText>
          <T en="Enter a valid PWM clock." zh="請輸入有效的 PWM 時脈。" />
        </ErrorText>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <Pfc fclk={clk} mode={mode} />
          <Llc fclk={clk} />
          <Acf fclk={clk} />
          <Fsbb fclk={clk} />
          <Psfb fclk={clk} />
          <Dab fclk={clk} />
        </div>
      )}
    </div>
  );
}
