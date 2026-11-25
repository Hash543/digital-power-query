"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { T, useLang } from "@/components/lang";
import { TextInput } from "@/components/ui";

const tools = [
  {
    href: "/architectures",
    en: ["Topologies & architectures", "PFC, totem-pole, LLC, ACF, 4-switch buck-boost, PSFB, DAB; CPA, DPA, IBA, FPA, 48 V direct; digitally managed vs. controlled, DSC, state-machine and FPGA control."],
    zh: ["拓樸與架構介紹", "PFC、圖騰柱、LLC、ACF、四開關升降壓、PSFB、DAB；CPA、DPA、IBA、FPA、48 V 直轉；數位管理與數位控制、DSC、狀態機與 FPGA 控制。"],
  },
  {
    href: "/calc/pmbus",
    en: ["PMBus data formats", "LINEAR11, LINEAR16 / VOUT_MODE, DIRECT encode & decode, PEC CRC-8."],
    zh: ["PMBus 資料格式", "LINEAR11、LINEAR16／VOUT_MODE、DIRECT 編碼與解碼，PEC CRC-8。"],
  },
  {
    href: "/calc/qformat",
    en: ["Fixed-point Q format", "Qm.n range, resolution, real ↔ hex with saturation."],
    zh: ["定點 Q 格式", "Qm.n 範圍、解析度，實數 ↔ 十六進位（含飽和）。"],
  },
  {
    href: "/calc/resolution",
    en: ["PWM & ADC resolution", "DPWM/HRPWM bits, ADC LSB, Vout step and limit-cycle check."],
    zh: ["PWM 與 ADC 解析度", "DPWM／HRPWM 位元數、ADC LSB、Vout 步階與極限環檢查。"],
  },
  {
    href: "/calc/topology",
    en: ["Topology duty & PWM", "Duty cycle, frequency or phase shift for PFC, LLC, ACF, 4-switch buck-boost, PSFB and DAB, with PWM period and compare counts."],
    zh: ["拓樸占空比與 PWM", "計算 PFC、LLC、ACF、四開關升降壓、PSFB、DAB 的占空比、頻率或相移，以及 PWM 週期與比較值。"],
  },
  {
    href: "/calc/compensator",
    en: ["Digital compensator", "Type II/III or PID → 2P2Z/3P3Z coefficients (Tustin) with Bode plot."],
    zh: ["數位補償器", "Type II/III 或 PID → 2P2Z/3P3Z 係數（Tustin），附 Bode 圖。"],
  },
];

export default function Home() {
  const { lang } = useLang();
  const router = useRouter();
  const [q, setQ] = useState("");
  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight">
          <T en="Digital power reference & calculators" zh="數位電源名詞查詢與計算工具" />
        </h1>
        <p className="max-w-2xl text-muted">
          <T
            en="Look up digital power terms in English and Traditional Chinese, and convert or calculate the numbers you meet when bringing up a digitally controlled power supply."
            zh="以中英文查詢數位電源相關名詞，並換算或計算開發數位控制電源時常遇到的數值。"
          />
        </p>
        <form
          className="flex max-w-xl gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            router.push(`/terms?q=${encodeURIComponent(q)}`);
          }}
        >
          <TextInput
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={lang === "zh" ? "搜尋名詞，例如 LINEAR11、極限環…" : "Search terms, e.g. LINEAR11, limit cycle…"}
            aria-label="Search terms"
            className="font-sans"
          />
          <button className="rounded-md bg-accent px-4 text-sm font-medium text-white">
            <T en="Search" zh="搜尋" />
          </button>
        </form>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {tools.map((t) => {
          const [title, desc] = lang === "zh" ? t.zh : t.en;
          return (
            <Link
              key={t.href}
              href={t.href}
              className="rounded-lg border border-line bg-surface p-5 transition hover:border-accent"
            >
              <h2 className="font-semibold">{title}</h2>
              <p className="mt-1 text-sm text-muted">{desc}</p>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
