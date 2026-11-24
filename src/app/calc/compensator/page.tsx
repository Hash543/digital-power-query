"use client";

import { useState } from "react";
import { Bode } from "@/components/bode";
import { T } from "@/components/lang";
import { Card, ErrorText, Field, PageHeader, Select, TextInput, attempt, eng, parseNum } from "@/components/ui";
import {
  bodeAnalog,
  bodeDiscrete,
  fromPid,
  fromPoleZero,
  logspace,
  tustin,
  unwrap,
  type TransferFn,
} from "@/lib/calc/compensator";
import { toQ } from "@/lib/calc/qformat";

type Kind = "type2" | "type3" | "pid";

const parseList = (s: string) =>
  s
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(parseNum);

export default function CompensatorPage() {
  const [kind, setKind] = useState<Kind>("type3");
  const [fs, setFs] = useState("500k");
  const [prewarp, setPrewarp] = useState("");
  const [gain, setGain] = useState("2000");
  const [zeros, setZeros] = useState("3k, 3k");
  const [poles, setPoles] = useState("60k, 150k");
  const [kp, setKp] = useState("0.5");
  const [ki, setKi] = useState("2000");
  const [kd, setKd] = useState("20u");
  const [fd, setFd] = useState("100k");
  const [qn, setQn] = useState("24");

  const changeKind = (k: Kind) => {
    setKind(k);
    if (k === "type2") {
      setZeros("2k");
      setPoles("80k");
    } else if (k === "type3") {
      setZeros("3k, 3k");
      setPoles("60k, 150k");
    }
  };

  const r = attempt(() => {
    const fsHz = parseNum(fs);
    let tf: TransferFn;
    if (kind === "pid") {
      tf = fromPid({ kp: parseNum(kp), ki: parseNum(ki), kd: parseNum(kd), fdHz: parseNum(fd) });
    } else {
      const z = parseList(zeros);
      const p = parseList(poles);
      const need = kind === "type2" ? 1 : 2;
      if (z.length !== need || p.length !== need)
        throw new Error(`Type ${kind === "type2" ? "II" : "III"} needs ${need} zero(s) and ${need} pole(s)`);
      tf = fromPoleZero({ gain: parseNum(gain), integrator: true, zerosHz: z, polesHz: p });
    }
    const d = tustin(tf, fsHz, prewarp ? parseNum(prewarp) : undefined);
    const fmax = fsHz / 2 * 0.98;
    const freqs = logspace(Math.max(1, fsHz / 1e5), fmax, 300);
    return {
      fsHz,
      d,
      fmax,
      analog: unwrap(bodeAnalog(tf, freqs)),
      digital: unwrap(bodeDiscrete(d, fsHz, freqs)),
    };
  });

  const qBits = parseInt(qn);
  const order = kind === "type3" ? "3P3Z" : "2P2Z";

  return (
    <div>
      <PageHeader
        title={<T en="Digital compensator (Tustin)" zh="數位補償器（Tustin）" />}
        intro={
          <T
            en="Converts an analog Type II / Type III / PID compensator to 2P2Z / 3P3Z coefficients with the bilinear transform. u[n] = Σ Bk·e[n−k] − Σ Ak·u[n−k]."
            zh="以雙線性轉換將類比 Type II / Type III / PID 補償器轉成 2P2Z / 3P3Z 係數。u[n] = Σ Bk·e[n−k] − Σ Ak·u[n−k]。"
          />
        }
      />
      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <Card title={<T en="Analog design" zh="類比設計" />}>
          <div className="space-y-3">
            <Field label={<T en="Type" zh="類型" />}>
              <Select value={kind} onChange={(e) => changeKind(e.target.value as Kind)}>
                <option value="type2">Type II → 2P2Z</option>
                <option value="type3">Type III → 3P3Z</option>
                <option value="pid">PID (filtered D) → 2P2Z</option>
              </Select>
            </Field>
            {kind === "pid" ? (
              <>
                <p className="font-mono text-xs text-muted">G(s) = Kp + Ki/s + Kd·s/(1+s/ωd)</p>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Kp">
                    <TextInput value={kp} onChange={(e) => setKp(e.target.value)} />
                  </Field>
                  <Field label="Ki (1/s)">
                    <TextInput value={ki} onChange={(e) => setKi(e.target.value)} />
                  </Field>
                  <Field label="Kd (s)">
                    <TextInput value={kd} onChange={(e) => setKd(e.target.value)} />
                  </Field>
                  <Field label="f_d (Hz)">
                    <TextInput value={fd} onChange={(e) => setFd(e.target.value)} />
                  </Field>
                </div>
              </>
            ) : (
              <>
                <p className="font-mono text-xs text-muted">G(s) = K·Π(1+s/ωz) / (s·Π(1+s/ωp))</p>
                <Field label="K (rad/s)" hint={<T en="Integrator gain: |G| = K/ω at low frequency" zh="積分增益：低頻時 |G| = K/ω" />}>
                  <TextInput value={gain} onChange={(e) => setGain(e.target.value)} />
                </Field>
                <Field label={<T en="Zeros (Hz, comma-separated)" zh="零點（Hz，以逗號分隔）" />}>
                  <TextInput value={zeros} onChange={(e) => setZeros(e.target.value)} />
                </Field>
                <Field label={<T en="Poles (Hz, comma-separated)" zh="極點（Hz，以逗號分隔）" />}>
                  <TextInput value={poles} onChange={(e) => setPoles(e.target.value)} />
                </Field>
              </>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Field label={<T en="Sampling f_s (Hz)" zh="取樣頻率 f_s (Hz)" />}>
                <TextInput value={fs} onChange={(e) => setFs(e.target.value)} />
              </Field>
              <Field label={<T en="Pre-warp (Hz)" zh="預扭曲 (Hz)" />} hint={<T en="optional, e.g. f_c" zh="選填，例如 f_c" />}>
                <TextInput value={prewarp} onChange={(e) => setPrewarp(e.target.value)} placeholder="—" />
              </Field>
            </div>
            <Field label={<T en="Coefficient Q format (fraction bits, 32-bit signed)" zh="係數 Q 格式（小數位元，32 位元有號）" />}>
              <TextInput type="number" min={1} max={31} value={qn} onChange={(e) => setQn(e.target.value)} />
            </Field>
          </div>
        </Card>

        <div className="space-y-5">
          {r.ok ? (
            <>
              <Card title={<T en={`${order} coefficients`} zh={`${order} 係數`} />}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-muted">
                      <tr>
                        <th className="py-1 pr-4 font-normal"></th>
                        <th className="py-1 pr-4 font-normal">float</th>
                        <th className="py-1 pr-4 font-normal">Q{31 - qBits}.{qBits}</th>
                        <th className="py-1 font-normal">hex</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono">
                      {[
                        ...r.value.d.b.map((v, i) => [`B${i}`, v] as const),
                        ...r.value.d.a.slice(1).map((v, i) => [`A${i + 1}`, v] as const),
                      ].map(([name, v]) => {
                        const q = qBits >= 1 && qBits <= 31 ? attempt(() => toQ(v, { m: 31 - qBits, n: qBits, signed: true })) : null;
                        return (
                          <tr key={name} className="border-t border-line">
                            <td className="py-1 pr-4">{name}</td>
                            <td className="py-1 pr-4">{v.toExponential(8)}</td>
                            <td className={`py-1 pr-4 ${q?.ok && q.value.saturated ? "text-red-500" : ""}`}>
                              {q?.ok ? q.value.integer : "—"}
                            </td>
                            <td className="py-1">{q?.ok ? q.value.hex : "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 text-xs text-muted">
                  <T
                    en={`Sign convention: denominator is 1 + A1·z⁻¹ + …; many C2000/dsPIC libraries store −A instead. Red = saturated in this Q format. Fs = ${eng(r.value.fsHz, "Hz")}.`}
                    zh={`符號慣例：分母為 1 + A1·z⁻¹ + …；許多 C2000/dsPIC 函式庫儲存的是 −A。紅色表示在此 Q 格式下已飽和。Fs = ${eng(r.value.fsHz, "Hz")}。`}
                  />
                </p>
              </Card>
              <Card title={<T en="Bode plot" zh="Bode 圖" />}>
                <Bode
                  fmin={r.value.analog[0].f}
                  fmax={r.value.fmax}
                  marker={{ f: r.value.fsHz / 10, label: "fs/10" }}
                  series={[
                    { label: "Analog G(s)", points: r.value.analog, color: "var(--muted)", dashed: true },
                    { label: "Digital H(z)", points: r.value.digital, color: "var(--accent)" },
                  ]}
                />
                <p className="mt-2 text-xs text-muted">
                  <T
                    en={`Plotted up to fs/2 (${eng(r.value.fsHz / 2, "Hz")}). Sampling and computation delay are not included.`}
                    zh={`繪製至 fs/2（${eng(r.value.fsHz / 2, "Hz")}）。未包含取樣與運算延遲。`}
                  />
                </p>
              </Card>
            </>
          ) : (
            <ErrorText>{r.error}</ErrorText>
          )}
        </div>
      </div>
    </div>
  );
}
