"use client";

import { useState } from "react";

export function Card({ title, children }: { title?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-surface p-5">
      {title && <h2 className="mb-4 text-base font-semibold">{title}</h2>}
      {children}
    </section>
  );
}

export function Field({ label, hint, children }: { label: React.ReactNode; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-muted">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}

const inputCls =
  "w-full rounded-md border border-line bg-background px-2.5 py-1.5 font-mono text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30";

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputCls} ${props.className ?? ""}`} spellCheck={false} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputCls} font-sans ${props.className ?? ""}`} />;
}

/** Parse numbers like "100e6", "100M", "500k", "1.5u". */
export function parseNum(s: string): number {
  const m = s.trim().match(/^([-+]?\d*\.?\d+(?:e[-+]?\d+)?)\s*([pnuµmkMG]?)$/i);
  if (!m) return NaN;
  const mult: Record<string, number> = { p: 1e-12, n: 1e-9, u: 1e-6, µ: 1e-6, m: 1e-3, k: 1e3, K: 1e3, M: 1e6, G: 1e9, "": 1 };
  const suffix = m[2];
  const factor = suffix === "m" ? 1e-3 : suffix === "M" ? 1e6 : (mult[suffix] ?? mult[suffix.toLowerCase()]);
  return parseFloat(m[1]) * factor;
}

/** Engineering-notation formatting with SI prefix. */
export function eng(v: number, unit = "", digits = 4): string {
  if (!Number.isFinite(v)) return "—";
  if (v === 0) return `0 ${unit}`.trim();
  const prefixes = ["p", "n", "µ", "m", "", "k", "M", "G"];
  const exp = Math.max(-4, Math.min(3, Math.floor(Math.log10(Math.abs(v)) / 3)));
  return `${parseFloat((v / 10 ** (exp * 3)).toPrecision(digits))} ${prefixes[exp + 4]}${unit}`.trim();
}

export const fmt = (v: number, digits = 6) => (Number.isFinite(v) ? parseFloat(v.toPrecision(digits)).toString() : "—");

export function Results({ rows }: { rows: [React.ReactNode, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm">
      {rows.map(([k, v], i) => (
        <div key={i} className="contents">
          <dt className="text-muted">{k}</dt>
          <dd className="font-mono break-all">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ErrorText({ children }: { children: React.ReactNode }) {
  return <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">{children}</p>;
}

/** Run a calculation, catching errors for display. */
export function attempt<T>(fn: () => T): { ok: true; value: T } | { ok: false; error: string } {
  try {
    return { ok: true, value: fn() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export function Tabs<K extends string>({
  tabs,
  initial,
  children,
}: {
  tabs: { key: K; label: React.ReactNode }[];
  initial: K;
  children: (active: K) => React.ReactNode;
}) {
  const [active, setActive] = useState<K>(initial);
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1 border-b border-line" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={active === t.key}
            onClick={() => setActive(t.key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${
              active === t.key ? "border-accent font-medium text-accent" : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {children(active)}
    </div>
  );
}

export function PageHeader({ title, intro }: { title: React.ReactNode; intro?: React.ReactNode }) {
  return (
    <header className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {intro && <p className="mt-2 max-w-3xl text-sm text-muted">{intro}</p>}
    </header>
  );
}
