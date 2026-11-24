"use client";

import type { BodePoint } from "@/lib/calc/compensator";

interface Series {
  label: string;
  points: BodePoint[];
  color: string;
  dashed?: boolean;
}

const W = 640;
const H = 200;
const M = { l: 52, r: 12, t: 10, b: 26 };

function niceTicks(min: number, max: number, count = 5) {
  const span = max - min || 1;
  const step0 = span / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 5, 10].map((k) => k * mag).find((s) => s >= step0)!;
  const ticks = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) ticks.push(+v.toFixed(10));
  return ticks;
}

const fLabel = (f: number) => (f >= 1e6 ? `${f / 1e6}M` : f >= 1e3 ? `${f / 1e3}k` : `${f}`);

function Plot({
  series,
  key_,
  unit,
  fmin,
  fmax,
  marker,
}: {
  series: Series[];
  key_: "magDb" | "phaseDeg";
  unit: string;
  fmin: number;
  fmax: number;
  marker?: { f: number; label: string };
}) {
  const vals = series.flatMap((s) => s.points.map((p) => p[key_])).filter(Number.isFinite);
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  if (hi - lo < 10) [lo, hi] = [lo - 5, hi + 5];
  const ticks = niceTicks(lo, hi);
  lo = Math.min(lo, ticks[0]);
  hi = Math.max(hi, ticks[ticks.length - 1]);
  const x = (f: number) => M.l + ((Math.log10(f) - Math.log10(fmin)) / (Math.log10(fmax) - Math.log10(fmin))) * (W - M.l - M.r);
  const y = (v: number) => M.t + (1 - (v - lo) / (hi - lo)) * (H - M.t - M.b);
  const decades: number[] = [];
  for (let d = Math.ceil(Math.log10(fmin)); d <= Math.floor(Math.log10(fmax)); d++) decades.push(10 ** d);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${key_ === "magDb" ? "Magnitude" : "Phase"} plot`}>
      {decades.map((f) => (
        <g key={f}>
          <line x1={x(f)} x2={x(f)} y1={M.t} y2={H - M.b} stroke="var(--line)" />
          <text x={x(f)} y={H - 8} fontSize="10" textAnchor="middle" fill="var(--muted)">
            {fLabel(f)}
          </text>
        </g>
      ))}
      {ticks.map((t) => (
        <g key={t}>
          <line x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeDasharray={t === 0 ? undefined : "2 3"} />
          <text x={M.l - 6} y={y(t) + 3} fontSize="10" textAnchor="end" fill="var(--muted)">
            {t}
            {unit}
          </text>
        </g>
      ))}
      {marker && marker.f > fmin && marker.f < fmax && (
        <g>
          <line x1={x(marker.f)} x2={x(marker.f)} y1={M.t} y2={H - M.b} stroke="var(--muted)" strokeDasharray="4 3" />
          <text x={x(marker.f) - 4} y={M.t + 10} fontSize="10" textAnchor="end" fill="var(--muted)">
            {marker.label}
          </text>
        </g>
      )}
      {series.map((s) => (
        <polyline
          key={s.label}
          fill="none"
          stroke={s.color}
          strokeWidth={2}
          strokeDasharray={s.dashed ? "5 4" : undefined}
          points={s.points
            .filter((p) => Number.isFinite(p[key_]))
            .map((p) => `${x(p.f).toFixed(1)},${y(p[key_]).toFixed(1)}`)
            .join(" ")}
        />
      ))}
    </svg>
  );
}

export function Bode({ series, fmin, fmax, marker }: { series: Series[]; fmin: number; fmax: number; marker?: { f: number; label: string } }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-4 text-xs">
        {series.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5">
            <svg width="22" height="6">
              <line x1="0" x2="22" y1="3" y2="3" stroke={s.color} strokeWidth="2" strokeDasharray={s.dashed ? "5 4" : undefined} />
            </svg>
            {s.label}
          </span>
        ))}
      </div>
      <Plot series={series} key_="magDb" unit=" dB" fmin={fmin} fmax={fmax} marker={marker} />
      <Plot series={series} key_="phaseDeg" unit="°" fmin={fmin} fmax={fmax} marker={marker} />
    </div>
  );
}
