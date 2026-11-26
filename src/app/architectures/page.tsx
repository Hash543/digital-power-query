"use client";

import Link from "next/link";
import { Flow, type Stage } from "@/components/flow";
import { T, useLang } from "@/components/lang";
import { PageHeader } from "@/components/ui";
import { architectures, type Term } from "@/lib/terms";

const loads: Stage = [
  { label: "CPU / ASIC", tone: "load" },
  { label: "DDR", tone: "load" },
  { label: "I/O", tone: "load" },
];

const diagrams: Record<string, Stage[]> = {
  "boost-pfc": [
    [{ label: "AC line", sub: "85–265 V", tone: "source" }],
    [{ label: "EMI filter" }],
    [{ label: "Diode bridge" }],
    [{ label: "Boost", sub: "L + FET + diode" }, { label: "I-loop + V-loop", tone: "digital" }],
    [{ label: "~400 V bus", tone: "load" }],
  ],
  "totem-pole-pfc": [
    [{ label: "AC line", tone: "source" }],
    [{ label: "Boost L" }],
    [{ label: "Fast leg", sub: "GaN/SiC @ f_sw" }, { label: "Slow leg", sub: "FET @ 50/60 Hz" }],
    [{ label: "Zero-crossing logic", tone: "digital" }],
    [{ label: "~400 V bus", tone: "load" }],
  ],
  llc: [
    [{ label: "400 V bus", tone: "source" }],
    [{ label: "Half / full bridge", sub: "50% duty, f_sw" }],
    [{ label: "Lr–Cr tank", sub: "+ Lm" }],
    [{ label: "Transformer", sub: "n : 1" }],
    [{ label: "SR rectifier" }, { label: "Freq. control", tone: "digital" }],
    [{ label: "12 / 48 V", tone: "load" }],
  ],
  acf: [
    [{ label: "Rectified AC", tone: "source" }],
    [{ label: "Main switch", sub: "low side" }, { label: "Clamp switch + C", sub: "high side" }],
    [{ label: "Flyback xfmr", sub: "Lm stores energy" }],
    [{ label: "SR" }, { label: "ZVS timing", tone: "digital" }],
    [{ label: "5–20 V USB-PD", tone: "load" }],
  ],
  "four-switch-buck-boost": [
    [{ label: "V_in", sub: "above or below V_out", tone: "source" }],
    [{ label: "Buck leg", sub: "A high / B low → SW1" }],
    [{ label: "Inductor", sub: "SW1 ↔ SW2" }],
    [{ label: "Boost leg", sub: "SW2 → C low / D high" }, { label: "Mode select", sub: "buck / BB / boost", tone: "digital" }],
    [{ label: "V_out", tone: "load" }],
  ],
  psfb: [
    [{ label: "400 V bus", tone: "source" }],
    [{ label: "Full bridge", sub: "leading + lagging leg" }, { label: "Phase shift", tone: "digital" }],
    [{ label: "Lr + transformer" }],
    [{ label: "Rectifier + LC filter" }],
    [{ label: "12 / 48 V", tone: "load" }],
  ],
  dab: [
    [{ label: "DC bus 1", tone: "source" }],
    [{ label: "Bridge 1", sub: "50% duty" }],
    [{ label: "L + transformer", sub: "n : 1" }, { label: "Phase shift φ", tone: "digital" }],
    [{ label: "Bridge 2", sub: "50% duty" }],
    [{ label: "DC bus 2 / battery", tone: "load" }],
  ],
  "centralized-power": [
    [{ label: "AC / 48 V", tone: "source" }],
    [{ label: "Central PSU", sub: "all rails" }],
    [{ label: "Cables / bus bars", tone: "source" }],
    loads,
  ],
  "distributed-power": [
    [{ label: "AC", tone: "source" }],
    [{ label: "Front end", sub: "48 V bus" }],
    [
      { label: "Isolated brick", sub: "regulated" },
      { label: "Isolated brick", sub: "regulated" },
      { label: "Isolated brick", sub: "regulated" },
    ],
    loads,
  ],
  iba: [
    [{ label: "48 V", tone: "source" }],
    [{ label: "Bus converter", sub: "isolated, ~fixed ratio" }],
    [{ label: "12 V / 5–8 V bus", tone: "source" }],
    [
      { label: "niPOL buck", sub: "0.8 V" },
      { label: "niPOL buck", sub: "1.2 V" },
      { label: "niPOL buck", sub: "3.3 V" },
    ],
    loads,
  ],
  "bus-converter": [
    [{ label: "40–60 V", tone: "source" }],
    [{ label: "DCX", sub: "N:1, ~50% duty" }],
    [{ label: "Vin / N", tone: "source" }],
  ],
  pol: [
    [{ label: "12 V bus", tone: "source" }],
    [{ label: "Sync buck", sub: "next to load" }, { label: "PMBus", tone: "digital" }],
    [{ label: "0.8 V @ 100 A", tone: "load" }],
  ],
  fpa: [
    [{ label: "48 V", tone: "source" }],
    [{ label: "PRM", sub: "regulator" }],
    [{ label: "Factorized bus", tone: "source" }],
    [{ label: "VTM", sub: "fixed ratio K" }, { label: "VTM", sub: "fixed ratio K" }],
    [{ label: "CPU", tone: "load" }, { label: "ASIC", tone: "load" }],
  ],
  "direct-48v": [
    [{ label: "48 V rack bus", tone: "source" }],
    [{ label: "Single stage", sub: "48 V → 1 V" }],
    [{ label: "CPU / GPU", tone: "load" }],
  ],
  "digitally-managed": [
    [{ label: "V_out", tone: "source" }],
    [{ label: "Analog error amp", sub: "R/C compensation" }, { label: "Manager", sub: "telemetry, faults", tone: "digital" }],
    [{ label: "Analog PWM" }, { label: "PMBus", tone: "digital" }],
    [{ label: "Power stage", tone: "load" }],
  ],
  "digitally-controlled": [
    [{ label: "V_out", tone: "source" }],
    [{ label: "ADC / EADC", tone: "digital" }],
    [{ label: "2P2Z / 3P3Z / PID", tone: "digital" }],
    [{ label: "DPWM / HRPWM", tone: "digital" }],
    [{ label: "Power stage", tone: "load" }],
  ],
  "dsc-based": [
    [{ label: "ADC", tone: "digital" }],
    [{ label: "CPU + firmware", sub: "ISR control loop", tone: "digital" }],
    [{ label: "HRPWM", tone: "digital" }, { label: "UART / CAN / PMBus", tone: "digital" }],
  ],
  "state-machine-controller": [
    [{ label: "EADC", tone: "digital" }],
    [{ label: "HW filter + state machine", sub: "registers", tone: "digital" }],
    [{ label: "DPWM", tone: "digital" }],
    [{ label: "Vendor GUI", sub: "via PMBus", tone: "source" }],
  ],
  "fpga-control": [
    [{ label: "Ext. ADC", tone: "source" }],
    [{ label: "FPGA logic", sub: "parallel loop", tone: "digital" }],
    [{ label: "Delay-line PWM", tone: "digital" }],
  ],
  "multiphase-digital": [
    [{ label: "SVID / SVI3 / AVS", tone: "source" }],
    [{ label: "Multiphase controller", tone: "digital" }],
    [
      { label: "Smart power stage", sub: "phase 1" },
      { label: "Smart power stage", sub: "phase 2" },
      { label: "Smart power stage", sub: "phase N" },
    ],
    [{ label: "CPU / GPU", tone: "load" }],
  ],
};

function ArchCard({ t }: { t: Term }) {
  const { lang } = useLang();
  const d = diagrams[t.id];
  return (
    <article id={t.id} className="scroll-mt-20 rounded-lg border border-line bg-surface p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold">
          {t.term} <span className="font-normal text-muted">· {t.zhTerm}</span>
        </h3>
        <span className="flex gap-3 text-xs">
          {t.calc && (
            <Link href={t.calc} className="text-accent">
              <T en="Duty & PWM calc →" zh="占空比與 PWM 計算 →" />
            </Link>
          )}
          <Link href={`/terms/${t.id}`} className="text-accent">
            <T en="Details & sources →" zh="詳細與來源 →" />
          </Link>
        </span>
      </div>
      <p className="mt-2 text-sm leading-relaxed">{t[lang]}</p>
      {d && (
        <div className="mt-3 rounded-md bg-background p-3">
          <Flow stages={d} label={`${t.term} block diagram`} />
        </div>
      )}
      {t.digital && (
        <p className="mt-3 border-l-2 border-amber-500/60 pl-3 text-sm leading-relaxed text-muted">
          <span className="font-semibold text-foreground">
            <T en="Digital control: " zh="數位控制：" />
          </span>
          {t.digital[lang]}
        </p>
      )}
      {(t.pros || t.cons) && (
        <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          {t.pros && (
            <div>
              <h4 className="mb-1 text-xs font-semibold text-green-700 dark:text-green-400">
                <T en="Strengths" zh="優點" />
              </h4>
              <ul className="list-disc space-y-0.5 pl-5 text-muted">
                {t.pros[lang].map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          )}
          {t.cons && (
            <div>
              <h4 className="mb-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
                <T en="Trade-offs" zh="缺點" />
              </h4>
              <ul className="list-disc space-y-0.5 pl-5 text-muted">
                {t.cons[lang].map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

export default function ArchitecturesPage() {
  const groups = [
    {
      key: "topology" as const,
      en: ["Converter topologies", "The power stage itself: how switches, magnetics and capacitors are arranged. These are the topologies digital controllers most often run, from PFC front ends to isolated and bidirectional DC-DC stages."],
      zh: ["轉換器拓樸", "功率級本身：開關、磁性元件與電容如何排列。以下是數位控制器最常控制的拓樸，從 PFC 前級到隔離式與雙向 DC-DC 級。"],
    },
    {
      key: "system" as const,
      en: ["Power-delivery architectures", "How power gets from the input bus to the load: how many conversion stages, where isolation happens, which bus voltage is distributed."],
      zh: ["電源配送架構", "電力如何從輸入匯流排送到負載：經過幾級轉換、在哪裡隔離、配送什麼電壓的匯流排。"],
    },
    {
      key: "control" as const,
      en: ["Digital control architectures", "How much of the converter is digital, and what kind of hardware runs the control loop."],
      zh: ["數位控制架構", "轉換器有多少部分是數位化的，以及由何種硬體執行控制迴路。"],
    },
  ];
  const { lang } = useLang();
  return (
    <div>
      <PageHeader
        title={<T en="Digital power architectures" zh="數位電源架構介紹" />}
        intro={
          <T
            en="An overview of common converter topologies (PFC, LLC, ACF, four-switch buck-boost and more), power-delivery architectures and digital-control architectures, with block diagrams and trade-offs. Vendor efficiency figures vary; check current datasheets and standards before relying on them."
            zh="常見轉換器拓樸（PFC、LLC、ACF、四開關升降壓等）、電源配送架構與數位控制架構的概覽，附方塊圖與優缺點比較。各廠商的效率數據不盡相同，引用前請查閱最新的規格書與標準。"
          />
        }
      />
      <nav className="mb-8 flex flex-wrap gap-2 text-sm">
        {groups.flatMap((g) =>
          architectures(g.key).map((t) => (
            <a key={t.id} href={`#${t.id}`} className="rounded-full border border-line px-3 py-1 hover:border-accent">
              {lang === "zh" ? t.zhTerm : t.term}
            </a>
          )),
        )}
      </nav>
      <div className="space-y-10">
        {groups.map((g) => {
          const [title, desc] = g[lang];
          return (
            <section key={g.key}>
              <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
              <p className="mb-4 mt-1 text-sm text-muted">{desc}</p>
              <div className="grid gap-4 lg:grid-cols-2">
                {architectures(g.key).map((t) => (
                  <ArchCard key={t.id} t={t} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
